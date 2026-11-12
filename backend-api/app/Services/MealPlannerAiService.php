<?php

namespace App\Services;

use App\Models\BhxProduct;
use App\Models\UserPantry;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class MealPlannerAiService
{
    protected ?string $apiKey;
    protected string $model;

    public function __construct()
    {
        $this->apiKey = config('services.gemini.api_key') ?: env('GEMINI_API_KEY');
        $this->model = config('services.gemini.model') ?: 'gemini-2.5-flash';
    }

    /**
     * Tạo kế hoạch thực đơn thông minh bằng AI Gemini kết hợp dữ liệu BHX & Tủ lạnh ảo
     */
    public function generatePlan(array $params): array
    {
        $userId = $params['user_id'] ?? 1;
        $dailyBudget = (int) ($params['daily_budget'] ?? 70000);
        $daysCount = max(1, min(7, (int) ($params['days_count'] ?? 1)));
        $mealsPerDay = (int) ($params['meals_per_day'] ?? 2);
        $servings = (int) ($params['servings'] ?? 1);
        $cookware = !empty($params['cookware']) ? $params['cookware'] : ['Chảo chống dính', 'Nồi cơm điện', 'Nồi canh'];
        $preferences = $params['disliked_foods'] ?? ($params['preferences'] ?? []);

        $totalBudget = $dailyBudget * $daysCount;

        // 1. Lấy danh sách nguyên liệu hiện có trong Tủ lạnh ảo (user_pantries)
        $pantryItems = UserPantry::with('product')
            ->where('user_id', $userId)
            ->where('remaining_value', '>', 0)
            ->get()
            ->map(function ($item) {
                return [
                    'bhx_product_id' => $item->bhx_product_id,
                    'name' => $item->product ? $item->product->name : ('Sản phẩm #' . $item->bhx_product_id),
                    'remaining_value' => (float) $item->remaining_value,
                    'unit' => $item->unit,
                ];
            })
            ->toArray();

        // 2. Truy vấn danh sách nguyên liệu từ bảng bhx_products
        $query = BhxProduct::where('in_stock', true)
            ->where('is_cooking_ingredient', true)
            ->where('price', '>', 0);

        // Lọc các món kiêng cữ
        foreach ($preferences as $pref) {
            $trimmed = trim($pref);
            if (str_starts_with($trimmed, 'Không ')) {
                $excluded = trim(str_replace('Không ', '', $trimmed));
                if (!empty($excluded)) {
                    $query->where('name', 'NOT LIKE', '%' . $excluded . '%');
                }
            } elseif (str_contains($trimmed, 'Dị ứng')) {
                $excluded = trim(str_replace('Dị ứng ', '', $trimmed));
                if (!empty($excluded)) {
                    $query->where('name', 'NOT LIKE', '%' . $excluded . '%');
                }
            }
        }

        // Lấy danh sách nguyên liệu khả dụng (toàn bộ sản phẩm còn hàng)
        $availableProducts = $query->orderBy('price', 'asc')
            ->get([
                'id',
                'name',
                'category_name',
                'price',
                'unit_label',
                'net_weight_value',
                'net_weight_unit',
                'image_url',
            ]);

        $productsMap = $availableProducts->keyBy('id');

        // Chuẩn bị dữ liệu danh sách sản phẩm gửi AI nếu có key
        $productsContext = $availableProducts->map(function ($p) {
            return [
                'id' => $p->id,
                'name' => $p->name,
                'category' => $p->category_name,
                'price' => $p->price,
                'weight' => $p->net_weight_value . ($p->net_weight_unit ?: $p->unit_label),
            ];
        })->toArray();

        // 3. Gọi Gemini AI nếu có key hợp lệ
        $aiResult = null;
        if (!empty($this->apiKey) && !str_starts_with($this->apiKey, 'your_') && strlen($this->apiKey) > 20) {
            $aiResult = $this->callGeminiApi([
                'total_budget' => $totalBudget,
                'daily_budget' => $dailyBudget,
                'days_count' => $daysCount,
                'meals_per_day' => $mealsPerDay,
                'servings' => $servings,
                'cookware' => $cookware,
                'preferences' => $preferences,
                'pantry_items' => $pantryItems,
                'products' => $productsContext,
            ]);
        }

        // Nếu không có API key hoặc gọi AI thất bại -> Dùng Heuristic Planner đa dạng mâm cơm
        if (!$aiResult) {
            $aiResult = $this->generateHeuristicPlan(
                $availableProducts,
                $pantryItems,
                $totalBudget,
                $daysCount,
                $mealsPerDay,
                $cookware,
                $preferences
            );
        }

        // 4. Đối soát giá thật và tính lượng thừa sang Tủ lạnh ảo
        return $this->reconcileAndCalculateRealCost($aiResult, $productsMap, $pantryItems, $totalBudget);
    }

    /**
     * Gọi Gemini API
     */
    protected function callGeminiApi(array $context): ?array
    {
        $url = "https://generativelanguage.googleapis.com/v1beta/models/{$this->model}:generateContent?key={$this->apiKey}";

        $systemInstruction = "Bạn là chuyên gia dinh dưỡng và đầu bếp chuyên nghiệp tại Việt Nam. " .
            "Nhiệm vụ: Lập mâm cơm Việt Nam hoàn chỉnh (gồm Món Mặn + Món Canh + Rau) dựa trên nguyên liệu thật từ Bách Hóa Xanh và Tủ lạnh ảo. " .
            "Quy tắc nghiêm ngặt: " .
            "1. Mỗi bữa ăn PHẢI CÓ ÍT NHẤT 2 MÓN: Món Mặn (đạm chính) và Món Canh (rau củ). " .
            "2. Tuân thủ mục tiêu dinh dưỡng (Giảm cân/Eat Clean, Tăng cơ, hoặc Cơm gia đình) và sở thích thịt bò/gà/heo. " .
            "3. Tổng ngân sách tối đa: {$context['total_budget']} VNĐ cho {$context['days_count']} ngày. " .
            "4. Tận dụng tối đa nguyên liệu có sẵn trong tủ lạnh (pantry) trước khi mua mới.";

        $prompt = "Yêu cầu lập thực đơn:\n" .
            "- Ngân sách: " . number_format($context['total_budget']) . " VNĐ ({$context['days_count']} ngày, {$context['meals_per_day']} bữa/ngày)\n" .
            "- Khẩu phần: {$context['servings']} người ăn\n" .
            "- Dụng cụ: " . implode(', ', $context['cookware']) . "\n" .
            "- Mục tiêu & Sở thích: " . implode(', ', $context['preferences']) . "\n" .
            "- Tủ lạnh có sẵn: " . json_encode($context['pantry_items'], JSON_UNESCAPED_UNICODE) . "\n" .
            "- Kho hàng BHX: " . json_encode($context['products'], JSON_UNESCAPED_UNICODE) . "\n" .
            "Hãy lên thực đơn chuẩn mâm cơm Việt Nam (đủ món mặn, món canh) kèm danh sách mua sắm và lượng cất tủ lạnh.";

        $jsonSchema = [
            'type' => 'OBJECT',
            'properties' => [
                'shopping_list' => [
                    'type' => 'ARRAY',
                    'items' => [
                        'type' => 'OBJECT',
                        'properties' => [
                            'bhx_product_id' => ['type' => 'INTEGER'],
                            'name' => ['type' => 'STRING'],
                            'quantity' => ['type' => 'INTEGER'],
                            'unit_price' => ['type' => 'INTEGER'],
                        ],
                        'required' => ['bhx_product_id', 'name', 'quantity', 'unit_price'],
                    ],
                ],
                'meals' => [
                    'type' => 'ARRAY',
                    'items' => [
                        'type' => 'OBJECT',
                        'properties' => [
                            'day' => ['type' => 'INTEGER'],
                            'meal_number' => ['type' => 'INTEGER'],
                            'dish_name' => ['type' => 'STRING'],
                            'main_dish' => ['type' => 'STRING'],
                            'soup_dish' => ['type' => 'STRING'],
                            'instructions' => ['type' => 'STRING'],
                            'cookware_used' => ['type' => 'STRING'],
                            'ingredients' => [
                                'type' => 'ARRAY',
                                'items' => [
                                    'type' => 'OBJECT',
                                    'properties' => [
                                        'bhx_product_id' => ['type' => 'INTEGER'],
                                        'name' => ['type' => 'STRING'],
                                        'amount_used' => ['type' => 'NUMBER'],
                                        'unit' => ['type' => 'STRING'],
                                    ],
                                    'required' => ['name', 'amount_used', 'unit'],
                                ],
                            ],
                        ],
                        'required' => ['day', 'meal_number', 'dish_name', 'instructions', 'cookware_used', 'ingredients'],
                    ],
                ],
                'leftover_to_pantry' => [
                    'type' => 'ARRAY',
                    'items' => [
                        'type' => 'OBJECT',
                        'properties' => [
                            'bhx_product_id' => ['type' => 'INTEGER'],
                            'name' => ['type' => 'STRING'],
                            'remaining_value' => ['type' => 'NUMBER'],
                            'unit' => ['type' => 'STRING'],
                        ],
                        'required' => ['bhx_product_id', 'name', 'remaining_value', 'unit'],
                    ],
                ],
            ],
            'required' => ['shopping_list', 'meals', 'leftover_to_pantry'],
        ];

        try {
            $response = Http::timeout(30)->post($url, [
                'systemInstruction' => ['parts' => [['text' => $systemInstruction]]],
                'contents' => [['parts' => [['text' => $prompt]]]],
                'generationConfig' => [
                    'responseMimeType' => 'application/json',
                    'responseSchema' => $jsonSchema,
                    'temperature' => 0.4,
                ],
            ]);

            if ($response->successful()) {
                $data = $response->json();
                $text = $data['candidates'][0]['content']['parts'][0]['text'] ?? null;
                if ($text) {
                    $decoded = json_decode($text, true);
                    if (is_array($decoded) && isset($decoded['meals'])) {
                        return $decoded;
                    }
                }
            } else {
                Log::warning('Gemini API call failed: ' . $response->body());
            }
        } catch (\Throwable $e) {
            Log::error('Gemini API Exception: ' . $e->getMessage());
        }

        return null;
    }

    /**
     * Rút gọn tên sản phẩm BHX để đặt tên món ăn tự nhiên và ngon miệng
     */
    protected function cleanProductName(string $name): string
    {
        if (preg_match('/trứng\s*(?:gà|vịt|cút)?/iu', $name, $matches)) {
            return mb_convert_case(trim($matches[0]), MB_CASE_TITLE, "UTF-8");
        }
        $cleaned = preg_replace('/^(?:combo\s*\d*\s*)/iu', '', $name);
        $cleaned = preg_replace('/\s+(?:khay|túi|gói|hộp|chai|vỉ|\d+\s*(?:g|gr|kg|ml|quả)).*$/iu', '', $cleaned);
        return trim($cleaned);
    }

    /**
     * Heuristic Planner Đa Dạng Mâm Cơm & 100% Đồng Nhất Giữa Giỏ Hàng Và Món Ăn
     */
    protected function generateHeuristicPlan(
        $availableProducts,
        array $pantryItems,
        int $totalBudget,
        int $daysCount,
        int $mealsPerDay,
        array $cookware,
        array $preferences
    ): array {
        $prefString = mb_strtolower(implode(' ', $preferences));

        // Kiêng cữ tuyệt đối (Strict Exclusions)
        $noPork = str_contains($prefString, 'không thịt heo') || str_contains($prefString, 'không heo');
        $noChicken = str_contains($prefString, 'không thịt gà') || str_contains($prefString, 'không gà');
        $noBeef = str_contains($prefString, 'không thịt bò') || str_contains($prefString, 'không bò');
        $noSeafood = str_contains($prefString, 'dị ứng hải sản') || str_contains($prefString, 'không hải sản') || str_contains($prefString, 'không cá');

        // Sở thích đạm chính (Inclusions)
        $wantsBeef = (str_contains($prefString, 'thích thịt bò') || str_contains($prefString, 'thịt bò')) && !$noBeef;
        $wantsChicken = (str_contains($prefString, 'thích thịt gà') || str_contains($prefString, 'thịt gà')) && !$noChicken;
        $wantsPork = (str_contains($prefString, 'thích thịt heo') || str_contains($prefString, 'thịt heo')) && !$noPork;
        $wantsTofuEgg = str_contains($prefString, 'trứng') || str_contains($prefString, 'đậu hũ') || str_contains($prefString, 'tofu');
        $wantsMoreGreens = str_contains($prefString, 'nhiều rau') || str_contains($prefString, 'rau xanh');

        // Chế độ ăn & mục tiêu dinh dưỡng
        $isEatClean = str_contains($prefString, 'giảm cân') || str_contains($prefString, 'eat clean') || str_contains($prefString, 'thanh đạm');
        $isHighProtein = str_contains($prefString, 'tăng cơ') || str_contains($prefString, 'protein');
        $isSaving = str_contains($prefString, 'tiết kiệm') || $totalBudget <= 40000;

        // Phân loại nhóm nguyên liệu BHX (tôn trọng kiêng cữ)
        $beefs = $noBeef ? collect() : $availableProducts->filter(function ($p) {
            $n = mb_strtolower($p->name . ' ' . $p->category_name);
            return str_contains($n, 'bò') && !str_contains($n, 'dầu') && !str_contains($n, 'combo');
        })->sortByDesc('price')->values();

        $chickens = $noChicken ? collect() : $availableProducts->filter(function ($p) {
            $n = mb_strtolower($p->name . ' ' . $p->category_name);
            return (str_contains($n, 'gà') || str_contains($n, 'thịt gà'))
                && !str_contains($n, 'nấm') && !str_contains($n, 'trứng') && !str_contains($n, 'dầu') && !str_contains($n, 'thùng')
                && !str_contains($n, 'chân gà') && !str_contains($n, 'xương') && !str_contains($n, 'lòng');
        })->sortByDesc('price')->values();

        $porks = $noPork ? collect() : $availableProducts->filter(function ($p) {
            $n = mb_strtolower($p->name . ' ' . $p->category_name);
            return (str_contains($n, 'heo') || str_contains($n, 'ba rọi') || str_contains($n, 'sườn') || str_contains($n, 'chân giò') || str_contains($n, 'nạc'))
                && !str_contains($n, 'dầu') && !str_contains($n, 'chao') && !str_contains($n, 'thùng') && !str_contains($n, 'mỡ');
        })->sortByDesc('price')->values();

        $eggsAndTofu = $availableProducts->filter(function ($p) {
            $n = mb_strtolower($p->name);
            return (str_contains($n, 'trứng gà') || str_contains($n, 'trứng vịt') || str_contains($n, 'đậu hũ') || str_contains($n, 'tofu'))
                && !str_contains($n, 'mì') && !str_contains($n, 'bánh') && !str_contains($n, 'thùng');
        })->sortByDesc('price')->values();

        // Rau nấu canh & xào thực thụ (loại trừ các loại rau nêm/rau sống nhỏ)
        $cookingGreens = $availableProducts->filter(function ($p) {
            $n = mb_strtolower($p->name);
            return (str_contains($n, 'mồng tơi') || str_contains($n, 'cải ngọt') || str_contains($n, 'cải thìa') ||
                    str_contains($n, 'cải bẹ xanh') || str_contains($n, 'cải ngồng') || str_contains($n, 'rau muống') ||
                    str_contains($n, 'rau dền') || str_contains($n, 'cà chua') || str_contains($n, 'bông cải') ||
                    str_contains($n, 'nấm đùi gà') || str_contains($n, 'bầu') || str_contains($n, 'bí'))
                && !str_contains($n, 'ngò') && !str_contains($n, 'răm') && !str_contains($n, 'thì là') && !str_contains($n, 'húng');
        })->sortByDesc('price')->values();

        $oils = $availableProducts->filter(function ($p) {
            $n = mb_strtolower($p->name . ' ' . $p->category_name);
            return str_contains($n, 'dầu') && !str_contains($n, 'thùng') && !str_contains($n, '12 chai') && !str_contains($n, '6 can');
        })->sortByDesc('price')->values();

        $sauces = $availableProducts->filter(function ($p) {
            $n = mb_strtolower($p->name . ' ' . $p->category_name);
            return (str_contains($n, 'mắm') || str_contains($n, 'nước tương') || str_contains($n, 'nước chấm'))
                && !str_contains($n, 'thùng') && !str_contains($n, 'chay') && !str_contains($n, '12 chai');
        })->sortByDesc('price')->values();

        // 1. Tuyển chọn danh sách đi chợ thông minh & tối ưu hóa ngân sách sát sao
        $shoppingList = [];
        $currentCost = 0;
        $boughtIds = [];

        $addItem = function ($product, $qty = 1) use (&$shoppingList, &$currentCost, &$boughtIds, $totalBudget) {
            if (!$product) return false;
            $cost = $product->price * $qty;
            if ($currentCost + $cost > $totalBudget) return false;

            $existingIdx = null;
            foreach ($shoppingList as $idx => $item) {
                if ($item['bhx_product_id'] === $product->id) {
                    $existingIdx = $idx;
                    break;
                }
            }

            if ($existingIdx !== null) {
                $shoppingList[$existingIdx]['quantity'] += $qty;
            } else {
                $shoppingList[] = [
                    'bhx_product_id' => $product->id,
                    'name' => $product->name,
                    'quantity' => $qty,
                    'unit_price' => $product->price,
                ];
                $boughtIds[] = $product->id;
            }
            $currentCost += $cost;
            return true;
        };

        // A. Chọn Đạm Chính (Primary Protein) theo đúng sở thích người dùng và ngân sách
        $cand = null;
        if ($wantsChicken && $chickens->isNotEmpty()) {
            $cand = $chickens->first(fn($p) => $p->price <= $totalBudget * 0.45) ?: $chickens->last();
        } elseif ($wantsPork && $porks->isNotEmpty()) {
            $cand = $porks->first(fn($p) => $p->price <= $totalBudget * 0.45) ?: $porks->last();
        } elseif ($wantsTofuEgg && $eggsAndTofu->isNotEmpty()) {
            $cand = $eggsAndTofu->first(fn($p) => $p->price <= $totalBudget * 0.45) ?: $eggsAndTofu->last();
        } elseif ($wantsBeef && $beefs->isNotEmpty()) {
            $cand = $beefs->first(fn($p) => $p->price <= $totalBudget * 0.45) ?: $beefs->last();
        } elseif ($isEatClean) {
            $cand = $chickens->first(fn($p) => str_contains(mb_strtolower($p->name), 'ức gà') && $p->price <= $totalBudget * 0.45)
                ?: ($eggsAndTofu->first(fn($p) => $p->price <= $totalBudget * 0.45) ?: $chickens->first());
        } elseif ($isSaving) {
            $cand = $chickens->first(fn($p) => $p->price <= 25000)
                ?: ($porks->first(fn($p) => $p->price <= 25000) ?: $eggsAndTofu->first());
        } else {
            // Mặc định: theo ngân sách
            if ($totalBudget >= 180000 && $beefs->isNotEmpty()) {
                $cand = $beefs->first(fn($p) => $p->price <= $totalBudget * 0.35) ?: $beefs->first();
            } else {
                $cand = $chickens->first(fn($p) => $p->price <= $totalBudget * 0.5)
                    ?: ($porks->first(fn($p) => $p->price <= $totalBudget * 0.5) ?: $eggsAndTofu->first());
            }
        }
        $addItem($cand);

        // B. Chọn Rau Nấu Canh (Primary Veggie)
        if ($totalBudget >= 150000) {
            $candVeg = $cookingGreens->first(fn($p) => !in_array($p->id, $boughtIds) && str_contains(mb_strtolower($p->name), 'bông cải') && ($currentCost + $p->price <= $totalBudget))
                ?: $cookingGreens->first(fn($p) => !in_array($p->id, $boughtIds) && $currentCost + $p->price <= $totalBudget);
            $addItem($candVeg);
        } else {
            $candVeg = $cookingGreens->first(fn($p) => !in_array($p->id, $boughtIds) && str_contains(mb_strtolower($p->name), 'mồng tơi') && ($currentCost + $p->price <= $totalBudget))
                ?: $cookingGreens->first(fn($p) => !in_array($p->id, $boughtIds) && $currentCost + $p->price <= $totalBudget);
            $addItem($candVeg);
        }

        // C. Chọn Đạm Thứ 2 (Secondary Protein)
        $rem = $totalBudget - $currentCost;
        if ($rem >= 12000) {
            $candProt2 = null;
            if ($totalBudget >= 180000) {
                $candProt2 = $porks->first(fn($p) => !in_array($p->id, $boughtIds) && $p->price <= $rem * 0.5)
                    ?: ($chickens->first(fn($p) => !in_array($p->id, $boughtIds) && $p->price <= $rem * 0.5)
                    ?: $eggsAndTofu->first(fn($p) => !in_array($p->id, $boughtIds) && $p->price <= $rem));
            } else {
                $candProt2 = $eggsAndTofu->first(fn($p) => !in_array($p->id, $boughtIds) && $p->price <= $rem)
                    ?: ($chickens->first(fn($p) => !in_array($p->id, $boughtIds) && $p->price <= $rem)
                    ?: $porks->first(fn($p) => !in_array($p->id, $boughtIds) && $p->price <= $rem));
            }
            $addItem($candProt2);
        }

        // D. Chọn Rau Thứ 2 / Nấm / Cà Chua (Secondary Veggie)
        $rem = $totalBudget - $currentCost;
        if ($rem >= 5000) {
            $candVeg2 = $cookingGreens->first(fn($p) => !in_array($p->id, $boughtIds) && (str_contains(mb_strtolower($p->name), 'nấm') || str_contains(mb_strtolower($p->name), 'cà chua') || str_contains(mb_strtolower($p->name), 'cải')) && $p->price <= $rem)
                ?: $cookingGreens->first(fn($p) => !in_array($p->id, $boughtIds) && $p->price <= $rem);
            $addItem($candVeg2);
        }

        // E. Chọn Nước Mắm / Nước Chấm phù hợp ngân sách
        $rem = $totalBudget - $currentCost;
        if ($rem >= 15000) {
            $candSauce = $sauces->first(fn($p) => !in_array($p->id, $boughtIds) && $p->price <= min($rem * 0.5, 70000))
                ?: $sauces->last();
            $addItem($candSauce);
        }

        // F. NẾU NGÂN SÁCH CÒN DỒI DÀO (>= 20.000đ): Tự động mở rộng mua thêm đạm cao cấp, dầu ăn, nấm, trứng
        $maxRounds = 12;
        $hasOil = false;
        while ($maxRounds-- > 0 && ($totalBudget - $currentCost) >= 12000) {
            $rem = $totalBudget - $currentCost;
            $added = false;

            // Nếu người dùng chọn "Nhiều rau xanh" -> Ưu tiên thêm nấm, cà chua, bông cải trước
            if ($wantsMoreGreens) {
                $candExtraVeg = $cookingGreens->first(fn($p) => !in_array($p->id, $boughtIds) && $p->price <= $rem);
                if ($candExtraVeg) {
                    $addItem($candExtraVeg);
                    $added = true;
                    continue;
                }
            }

            // Nếu còn tiền >= 45.000đ và chưa có dầu ăn -> Thêm chai dầu ăn chất lượng
            if (!$hasOil && $rem >= 45000 && $oils->isNotEmpty()) {
                $candOil = $oils->first(fn($p) => !in_array($p->id, $boughtIds) && $p->price <= min($rem * 0.7, 90000))
                    ?: $oils->first(fn($p) => !in_array($p->id, $boughtIds) && $p->price <= $rem);
                if ($candOil) {
                    $addItem($candOil);
                    $hasOil = true;
                    $added = true;
                    continue;
                }
            }

            // Thêm đạm tiếp theo theo sở thích
            $candExtraMeat = null;
            if ($wantsChicken && $chickens->isNotEmpty()) {
                $candExtraMeat = $chickens->first(fn($p) => !in_array($p->id, $boughtIds) && $p->price <= $rem);
            } elseif ($wantsPork && $porks->isNotEmpty()) {
                $candExtraMeat = $porks->first(fn($p) => !in_array($p->id, $boughtIds) && $p->price <= $rem);
            } elseif ($wantsBeef && $beefs->isNotEmpty()) {
                $candExtraMeat = $beefs->first(fn($p) => !in_array($p->id, $boughtIds) && $p->price <= $rem);
            }

            if (!$candExtraMeat) {
                $candExtraMeat = $beefs->first(fn($p) => !in_array($p->id, $boughtIds) && $p->price <= $rem)
                    ?: ($porks->first(fn($p) => !in_array($p->id, $boughtIds) && $p->price <= $rem)
                    ?: ($chickens->first(fn($p) => !in_array($p->id, $boughtIds) && $p->price <= $rem)
                    ?: $eggsAndTofu->first(fn($p) => !in_array($p->id, $boughtIds) && $p->price <= $rem)));
            }

            if ($candExtraMeat && $candExtraMeat->price <= $rem) {
                $addItem($candExtraMeat);
                $added = true;
                continue;
            }

            // Thêm nấm / cà chua / bông cải / rau sạch
            $candExtraVeg = $cookingGreens->first(fn($p) => !in_array($p->id, $boughtIds) && $p->price <= $rem);
            if ($candExtraVeg) {
                $addItem($candExtraVeg);
                $added = true;
                continue;
            }

            if (!$added) break;
        }

        // Tập hợp toàn bộ ĐẠM và RAU ĐÃ MUA vào giỏ hàng để nấu ăn đa dạng
        $boughtProductIds = array_column($shoppingList, 'bhx_product_id');
        $cartProteins = $availableProducts->whereIn('id', $boughtProductIds)->filter(function ($p) {
            $n = mb_strtolower($p->name . ' ' . $p->category_name);
            return (str_contains($n, 'bò') || str_contains($n, 'gà') || str_contains($n, 'heo') || str_contains($n, 'sườn') || str_contains($n, 'trứng') || str_contains($n, 'đậu hũ') || str_contains($n, 'tofu'))
                && !str_contains($n, 'dầu')
                && !str_contains($n, 'nấm');
        })->values()->all();

        $cartVeggies = $availableProducts->whereIn('id', $boughtProductIds)->filter(function ($p) {
            $n = mb_strtolower($p->name . ' ' . $p->category_name);
            return (str_contains($n, 'rau') || str_contains($n, 'cải') || str_contains($n, 'bông cải') || str_contains($n, 'nấm') || str_contains($n, 'cà chua') || str_contains($n, 'bầu') || str_contains($n, 'bí'))
                && !str_contains($n, 'chay') && !str_contains($n, 'dầu');
        })->values()->all();

        // Dự phòng tối thiểu nếu chưa lọc được
        if (empty($cartProteins) && $primaryProtein) $cartProteins = [$primaryProtein];
        if (empty($cartVeggies) && $primaryVeggie) $cartVeggies = [$primaryVeggie];

        // Dụng cụ nấu ăn
        $panTool = in_array('Chảo chống dính', $cookware) ? 'Chảo chống dính' : ($cookware[0] ?? 'Chảo/Bếp');
        $potTool = in_array('Nồi cơm điện', $cookware) ? 'Nồi cơm điện' : ($cookware[1] ?? 'Nồi nấu canh');

        // Bộ từ điển phong cách ẩm thực Việt phong phú, chống trùng lặp món ăn tuyệt đối
        $meatStyles = [
            ["xào thơm sốt tiêu", "ướp thịt cùng chút tiêu tỏi, cho vào %s xào nhanh lửa lớn 3-4 phút cho vừa chín tới mềm ngọt."],
            ["áp chảo sốt thảo mộc", "dùng %s áp chảo vàng ruộm hai mặt, rưới nhẹ sốt thảo mộc dậy mùi thơm lừng khó cưỡng."],
            ["rim mặn ngọt đưa cơm", "đảo đều trên %s với lửa vừa, nêm mắm đường tiêu cho sốt keo lại sóng sánh đậm đà đưa cơm."],
            ["rang cháy cạnh tỏi ớt", "rang cháy cạnh xém vàng trên %s, phi tỏi ớt thơm nức mũi đảo đều bùi béo hấp dẫn."],
            ["xào chua ngọt đậm đà", "xào cùng sốt chua ngọt thanh tao trên %s, áo đều từng miếng thịt chín mềm bóng bẩy."],
            ["kho tiêu gừng ấm nồng", "kho cùng gừng thái sợi và tiêu cay nồng trên %s, đun liu riu ngấm trọn gia vị ấm áp bữa cơm."]
        ];

        $eggStyles = [
            ["chiên xốp mềm vàng óng", "đập trứng vào tô đánh tan cùng chút mắm tiêu, cho vào %s chiên bông xốp vàng ruộm hai mặt."],
            ["ốp la lòng đào sốt mặn ngọt", "dùng %s ốp la với lòng đào dẻo béo, rưới sốt mặn ngọt cay nhẹ thơm lừng."],
            ["cuộn rau củ thanh đạm", "đánh tan trứng, tráng mỏng trên %s cuộn tròn khéo léo, cắt khoanh vừa ăn thanh tao."],
            ["sốt mặn ngọt đậm đà", "chiên vàng trên %s rồi rim nhẹ cùng sốt chua ngọt mặn mà, rưới lên cơm nóng ăn cực ngon."]
        ];

        $tofuStyles = [
            ["sốt cà chua đậm đà", "cắt miếng vừa ăn, sốt cùng cà chua chín mọng trên %s, rưới sốt sánh mịn đậm vị."],
            ["áp chảo giòn mặt", "dùng %s áp chảo nhẹ hai mặt tạo lớp vỏ ngoài giòn bùi, bên trong mềm béo."],
            ["sốt nấm thanh vị", "sốt cùng nấm ngọt tự nhiên trên %s, nêm vừa miệng tạo món thanh tịnh ngon ngọt."],
            ["hấp hành gừng thơm lừng", "hấp chín tới cùng hành hoa và gừng sợi thái chỉ, vừa giải cảm vừa thanh nhiệt."]
        ];

        $vegStyles = [
            ["Canh %s thanh mát ngọt nước", "đun sôi nước với %s, thả rau vào nấu sôi bùng 2 phút nêm vừa ăn, giữ trọn độ xanh ngọt."],
            ["Canh %s nấu thanh nhiệt", "đun sôi nước ngọt mát với %s, thả rau vào nêm gia vị thanh nhẹ giúp giải nhiệt cơ thể."],
            ["Canh chua %s giải nhiệt", "nấu nước canh chua dịu mát cùng %s, nêm chút đường mắm thanh mát ngày oi ả."],
            ["Canh %s nấu ngọt tự nhiên", "dùng %s đun sôi với chút gia vị, thả rau vào nấu chín tới nước canh trong vắt."],
            ["Canh %s nấu gừng ấm bụng", "đun sôi nước với nhánh gừng đập dập trên %s, thả rau vào nấu thanh đạm dễ tiêu."],
            ["Canh rau %s giải ngấy", "dùng %s nấu canh nhanh lửa lớn, giữ nguyên màu xanh tươi giòn mát cho bữa cơm."]
        ];

        // Gia vị nếu có mua trong giỏ hàng
        $condiment = $availableProducts->whereIn('id', $boughtProductIds)->first(function ($p) {
            $n = mb_strtolower($p->name . ' ' . $p->category_name);
            return str_contains($n, 'mắm') || str_contains($n, 'nước tương') || str_contains($n, 'nước chấm');
        });

        // 2. Thiết kế MÂM CƠM ĐỒNG NHẤT 100% VỚI GIỎ HÀNG & KHÔNG BAO GIỜ TRÙNG LẶP MÓN ĂN
        $meals = [];
        $totalMeals = $daysCount * $mealsPerDay;
        $globalMealIndex = 0;

        for ($d = 1; $d <= $daysCount; $d++) {
            for ($m = 1; $m <= $mealsPerDay; $m++) {
                // Xác định Protein và Rau xoay vòng theo từng bữa để luôn tươi mới
                $protItem = $cartProteins[$globalMealIndex % count($cartProteins)] ?? null;
                $vegItem = $cartVeggies[$globalMealIndex % count($cartVeggies)] ?? null;

                $usedIngredients = [];
                $mainDishName = "Món mặn đậm đà";
                $soupDishName = "Món canh thanh ngọt";
                $protStep = "";
                $vegStep = "";

                if ($protItem) {
                    $shortProt = $this->cleanProductName($protItem->name);
                    $pWeight = $protItem->net_weight_value ?: 300;
                    $pUnit = $protItem->net_weight_unit ?: 'g';

                    $timesUsedProt = max(1, (int) ceil($totalMeals / count($cartProteins)));
                    $amountProt = ($pUnit === 'quả') ? min(2, max(1, (int) ($pWeight / $timesUsedProt))) : round($pWeight / $timesUsedProt, 0);
                    if ($amountProt <= 0) $amountProt = 1;

                    $protLower = mb_strtolower($shortProt);
                    if (str_contains($protLower, 'trứng')) {
                        $st = $eggStyles[$globalMealIndex % count($eggStyles)];
                        $mainDishName = "Trứng " . $st[0];
                        $protStep = sprintf($st[1], $panTool);
                    } elseif (str_contains($protLower, 'đậu hũ') || str_contains($protLower, 'tofu')) {
                        $st = $tofuStyles[$globalMealIndex % count($tofuStyles)];
                        $mainDishName = "{$shortProt} " . $st[0];
                        $protStep = sprintf($st[1], $panTool);
                    } else {
                        $st = $meatStyles[$globalMealIndex % count($meatStyles)];
                        $mainDishName = "{$shortProt} " . $st[0];
                        $protStep = sprintf($st[1], $panTool);
                    }

                    $usedIngredients[] = [
                        'bhx_product_id' => $protItem->id,
                        'name' => $protItem->name,
                        'amount_used' => $amountProt,
                        'unit' => $pUnit,
                        'image_url' => $protItem->image_url,
                        'category_name' => $protItem->category_name,
                    ];
                }

                if ($vegItem) {
                    $shortVeg = $this->cleanProductName($vegItem->name);
                    $vWeight = $vegItem->net_weight_value ?: 300;
                    $vUnit = $vegItem->net_weight_unit ?: 'g';

                    $timesUsedVeg = max(1, (int) ceil($totalMeals / count($cartVeggies)));
                    $amountVeg = round($vWeight / $timesUsedVeg, 0);
                    if ($amountVeg <= 0) $amountVeg = 50;

                    $vSt = $vegStyles[$globalMealIndex % count($vegStyles)];
                    $soupDishName = sprintf($vSt[0], $shortVeg);
                    $vegStep = sprintf($vSt[1], $potTool);

                    $usedIngredients[] = [
                        'bhx_product_id' => $vegItem->id,
                        'name' => $vegItem->name,
                        'amount_used' => $amountVeg,
                        'unit' => $vUnit,
                        'image_url' => $vegItem->image_url,
                        'category_name' => $vegItem->category_name,
                    ];
                }

                // Gia vị nếu có mua trong giỏ hàng
                if ($condiment) {
                    $usedIngredients[] = [
                        'bhx_product_id' => $condiment->id,
                        'name' => $condiment->name,
                        'amount_used' => 15,
                        'unit' => 'ml',
                        'image_url' => $condiment->image_url,
                        'category_name' => $condiment->category_name,
                    ];
                }

                // Hướng dẫn nấu ăn chi tiết từng món
                $protInstruction = $protItem ? "1. MÓN MẶN: Lấy {$usedIngredients[0]['amount_used']}{$protItem->net_weight_unit} " . $this->cleanProductName($protItem->name) . ", {$protStep}\n" : "";
                $vegInstruction = $vegItem ? "2. MÓN CANH & RAU: Dùng {$usedIngredients[1]['amount_used']}{$vegItem->net_weight_unit} " . $this->cleanProductName($vegItem->name) . ", {$vegStep}\n" : "";
                $condInstruction = $condiment ? "3. Nêm nếm và chấm kèm " . $this->cleanProductName($condiment->name) . " cho bữa cơm thêm tròn vị." : "3. Nêm nếm vừa khẩu vị và dọn ra thưởng thức nóng cùng cơm.";

                $dishTitle = "Bữa {$m} (Ngày {$d}): Mâm cơm [Món mặn: {$mainDishName}] & [Món canh: {$soupDishName}]";

                $meals[] = [
                    'day' => $d,
                    'meal_number' => $m,
                    'dish_name' => $dishTitle,
                    'main_dish' => $mainDishName,
                    'soup_dish' => $soupDishName,
                    'image_url' => $protItem?->image_url ?: ($vegItem?->image_url ?: null),
                    'instructions' => "🍲 MÓN MẶN:\n{$protInstruction}\n🥣 MÓN CANH & RAU:\n{$vegInstruction}\n🥢 THƯỞNG THỨC:\n{$condInstruction}",
                    'cookware_used' => "{$panTool} & {$potTool}",
                    'ingredients' => $usedIngredients,
                ];

                $globalMealIndex++;
            }
        }

        return [
            'shopping_list' => $shoppingList,
            'meals' => $meals,
            'leftover_to_pantry' => [],
        ];
    }

    /**
     * Tự tính toán lại chi phí thật từ DB và đối soát lượng dư thừa vào Tủ lạnh ảo (Pantry)
     */
    protected function reconcileAndCalculateRealCost(
        array $aiResult,
        $productsMap,
        array $pantryItems,
        int $totalBudget
    ): array {
        $shoppingList = $aiResult['shopping_list'] ?? [];
        $meals = $aiResult['meals'] ?? [];

        // 1. Tính toán lại tổng chi phí thực tế từ bảng bhx_products trong MySQL
        $realTotalCost = 0;
        $reconciledShoppingList = [];
        $purchasedWeights = [];

        foreach ($shoppingList as $item) {
            $productId = $item['bhx_product_id'] ?? null;
            $qty = max(1, (int) ($item['quantity'] ?? 1));
            $product = $productsMap->get($productId);

            if ($product) {
                $unitPrice = (int) $product->price;
                $itemTotal = $unitPrice * $qty;
                $realTotalCost += $itemTotal;

                $reconciledShoppingList[] = [
                    'bhx_product_id' => $product->id,
                    'name' => $product->name,
                    'category_name' => $product->category_name,
                    'quantity' => $qty,
                    'unit_price' => $unitPrice,
                    'total_price' => $itemTotal,
                    'unit_label' => $product->unit_label,
                    'net_weight_value' => $product->net_weight_value,
                    'net_weight_unit' => $product->net_weight_unit,
                    'image_url' => $product->image_url,
                ];

                if ($product->net_weight_value) {
                    $purchasedWeights[$product->id] = [
                        'name' => $product->name,
                        'total_weight' => $product->net_weight_value * $qty,
                        'unit' => $product->net_weight_unit ?: 'g',
                    ];
                }
            }
        }

        // 2. Tính tổng lượng nguyên liệu đã sử dụng & làm sạch tuyệt đối nguyên liệu trong món ăn
        $validProductIds = collect($reconciledShoppingList)->pluck('bhx_product_id')
            ->merge(collect($pantryItems)->pluck('bhx_product_id'))
            ->all();

        $sanitizedMeals = [];
        $usedWeights = [];
        foreach ($meals as $m) {
            $cleanedIngredients = [];
            foreach ($m['ingredients'] ?? [] as $ing) {
                $pid = $ing['bhx_product_id'] ?? null;
                if ($pid && in_array($pid, $validProductIds)) {
                    $prod = $productsMap->get($pid);
                    if ($prod) {
                        $ing['image_url'] = $prod->image_url;
                        $ing['category_name'] = $prod->category_name;
                    }
                    $cleanedIngredients[] = $ing;
                    $amount = (float) ($ing['amount_used'] ?? 0);
                    $usedWeights[$pid] = ($usedWeights[$pid] ?? 0) + $amount;
                }
            }
            $m['ingredients'] = $cleanedIngredients;
            if (empty($m['image_url']) && !empty($cleanedIngredients[0]['image_url'])) {
                $m['image_url'] = $cleanedIngredients[0]['image_url'];
            }
            $sanitizedMeals[] = $m;
        }

        // 3. Tự động tính lượng nguyên liệu còn dư để chuyển vào Tủ lạnh ảo (leftover_to_pantry)
        $leftovers = [];
        $pantryMap = collect($pantryItems)->keyBy('bhx_product_id');

        foreach ($purchasedWeights as $pid => $info) {
            $initialPantry = $pantryMap->has($pid) ? (float) $pantryMap[$pid]['remaining_value'] : 0;
            $totalAvailable = $info['total_weight'] + $initialPantry;
            $totalUsed = $usedWeights[$pid] ?? 0;
            $remaining = max(0, $totalAvailable - $totalUsed);

            if ($remaining > 0) {
                $leftovers[] = [
                    'bhx_product_id' => $pid,
                    'name' => $info['name'],
                    'remaining_value' => round($remaining, 2),
                    'unit' => $info['unit'],
                ];
            }
        }

        return [
            'total_estimated_cost' => $realTotalCost,
            'budget_limit' => $totalBudget,
            'is_within_budget' => $realTotalCost <= $totalBudget,
            'shopping_list' => $reconciledShoppingList,
            'meals' => $sanitizedMeals,
            'leftover_to_pantry' => $leftovers,
        ];
    }
}
