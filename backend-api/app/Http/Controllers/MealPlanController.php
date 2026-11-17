<?php

namespace App\Http\Controllers;

use App\Models\MealPlan;
use App\Models\User;
use App\Models\UserPantry;
use App\Models\UserPreference;
use App\Services\MealPlannerAiService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class MealPlanController extends Controller
{
    protected MealPlannerAiService $plannerService;

    public function __construct(MealPlannerAiService $plannerService)
    {
        $this->plannerService = $plannerService;
    }

    /**
     * Xác định Người dùng hiện tại (hỗ trợ User đăng nhập SĐT, Khách Guest UUID, hoặc User ID)
     */
    protected function resolveUser(Request $request): User
    {
        // 1. Người dùng đã xác thực bằng Sanctum Token
        if ($user = $request->user('sanctum')) {
            return $user;
        }

        // 2. Chế độ khách vãng lai dựa trên Guest UUID (lưu trên thiết bị)
        $guestUuid = $request->header('X-Guest-Uuid') ?: $request->input('guest_uuid', $request->query('guest_uuid'));
        if (!empty($guestUuid)) {
            return User::firstOrCreate(
                ['guest_uuid' => $guestUuid],
                [
                    'name' => 'Khách ' . substr($guestUuid, 0, 6),
                    'is_guest' => true,
                ]
            );
        }

        // 3. Fallback theo user_id truyền lên hoặc mặc định user 1
        $userId = (int) ($request->input('user_id') ?: $request->query('user_id', 1));
        return User::firstOrCreate(
            ['id' => $userId],
            [
                'name' => 'Khách ' . $userId,
                'is_guest' => true,
            ]
        );
    }

    /**
     * POST /api/preferences
     * Lưu hoặc cập nhật thiết lập người dùng (ngân sách, dụng cụ, đồ kiêng)
     */
    public function savePreferences(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'user_id' => 'nullable|integer',
            'guest_uuid' => 'nullable|string',
            'daily_budget' => 'nullable|integer|min:10000',
            'meals_per_day' => 'nullable|integer|min:1|max:5',
            'servings' => 'nullable|integer|min:1|max:10',
            'cookware' => 'nullable|array',
            'liked_foods' => 'nullable|array',
            'disliked_foods' => 'nullable|array',
        ]);

        $user = $this->resolveUser($request);
        $userId = $user->id;

        $preference = UserPreference::updateOrCreate(
            ['user_id' => $userId],
            [
                'daily_budget' => $validated['daily_budget'] ?? 70000,
                'meals_per_day' => $validated['meals_per_day'] ?? 2,
                'servings' => $validated['servings'] ?? 1,
                'cookware' => $validated['cookware'] ?? ['chảo chống dính', 'nồi cơm điện'],
                'liked_foods' => $validated['liked_foods'] ?? [],
                'disliked_foods' => $validated['disliked_foods'] ?? [],
            ]
        );

        return response()->json([
            'success' => true,
            'message' => 'Lưu thiết lập người dùng thành công.',
            'user' => [
                'id' => $user->id,
                'name' => $user->name,
                'is_guest' => $user->is_guest,
            ],
            'data' => $preference,
        ]);
    }

    /**
     * POST /api/meal-plans/generate
     * Tạo thực đơn thông minh bằng AI Gemini từ dữ liệu BHX và Tủ lạnh ảo
     */
    public function generate(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'user_id' => 'nullable|integer',
            'guest_uuid' => 'nullable|string',
            'days_count' => 'nullable|integer|min:1|max:7',
            'daily_budget' => 'nullable|integer|min:10000',
            'meals_per_day' => 'nullable|integer|min:1|max:5',
            'servings' => 'nullable|integer|min:1|max:10',
            'cookware' => 'nullable|array',
            'disliked_foods' => 'nullable|array',
        ]);

        $user = $this->resolveUser($request);
        $userId = $user->id;

        // Lấy thông tin preferences đã lưu nếu có
        $savedPref = UserPreference::where('user_id', $userId)->first();

        $params = [
            'user_id' => $userId,
            'days_count' => $validated['days_count'] ?? 1,
            'daily_budget' => $validated['daily_budget'] ?? ($savedPref->daily_budget ?? 70000),
            'meals_per_day' => $validated['meals_per_day'] ?? ($savedPref->meals_per_day ?? 2),
            'servings' => $validated['servings'] ?? ($savedPref->servings ?? 1),
            'cookware' => $validated['cookware'] ?? ($savedPref->cookware ?? ['chảo chống dính', 'nồi cơm điện', 'nồi canh']),
            'disliked_foods' => $validated['disliked_foods'] ?? ($savedPref->disliked_foods ?? []),
        ];

        // Lập kế hoạch thực đơn
        $planResult = $this->plannerService->generatePlan($params);

        // Lưu vào cơ sở dữ liệu (bảng meal_plans)
        $mealPlan = MealPlan::create([
            'user_id' => $userId,
            'plan_date' => now()->toDateString(),
            'total_estimated_cost' => $planResult['total_estimated_cost'],
            'shopping_list' => $planResult['shopping_list'],
            'meals_data' => [
                'meals' => $planResult['meals'],
                'leftover_to_pantry' => $planResult['leftover_to_pantry'],
                'budget_limit' => $planResult['budget_limit'],
                'is_within_budget' => $planResult['is_within_budget'],
            ],
            'is_completed' => false,
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Tạo thực đơn thông minh thành công.',
            'user' => [
                'id' => $user->id,
                'name' => $user->name,
                'is_guest' => $user->is_guest,
            ],
            'data' => [
                'plan_id' => $mealPlan->id,
                'plan_date' => $mealPlan->plan_date,
                'total_cost' => $mealPlan->total_estimated_cost,
                'budget_limit' => $planResult['budget_limit'],
                'is_within_budget' => $planResult['is_within_budget'],
                'shopping_list' => $mealPlan->shopping_list,
                'meals' => $mealPlan->meals_data['meals'] ?? [],
                'leftover_to_pantry' => $mealPlan->meals_data['leftover_to_pantry'] ?? [],
                'created_at' => $mealPlan->created_at,
            ],
        ]);
    }

    /**
     * POST /api/meal-plans/{id}/complete
     * Đánh dấu đã nấu xong thực đơn và tự động chuyển nguyên liệu thừa vào Tủ lạnh ảo (user_pantries)
     */
    public function complete(int $id, Request $request): JsonResponse
    {
        $mealPlan = MealPlan::findOrFail($id);

        if ($mealPlan->is_completed) {
            return response()->json([
                'success' => true,
                'message' => 'Thực đơn này đã được đánh dấu hoàn tất trước đó.',
                'data' => $mealPlan,
            ]);
        }

        $mealPlan->update(['is_completed' => true]);

        // Trích xuất lượng thừa để chuyển vào Tủ lạnh ảo
        $leftovers = $mealPlan->meals_data['leftover_to_pantry'] ?? [];
        $addedToPantry = [];

        foreach ($leftovers as $leftover) {
            $productId = $leftover['bhx_product_id'] ?? null;
            $remaining = (float) ($leftover['remaining_value'] ?? 0);
            $unit = $leftover['unit'] ?? 'g';

            if ($productId && $remaining > 0) {
                $pantry = UserPantry::where('user_id', $mealPlan->user_id)
                    ->where('bhx_product_id', $productId)
                    ->first();

                if ($pantry) {
                    $pantry->remaining_value += $remaining;
                    $pantry->save();
                    $addedToPantry[] = $pantry;
                } else {
                    $newPantry = UserPantry::create([
                        'user_id' => $mealPlan->user_id,
                        'bhx_product_id' => $productId,
                        'remaining_value' => $remaining,
                        'unit' => $unit,
                        'expires_at' => now()->addDays(5)->toDateString(),
                    ]);
                    $addedToPantry[] = $newPantry;
                }
            }
        }

        // Lấy lại danh sách tủ lạnh hiện tại
        $currentPantry = UserPantry::with('product')
            ->where('user_id', $mealPlan->user_id)
            ->get();

        return response()->json([
            'success' => true,
            'message' => 'Đã đánh dấu hoàn tất nấu ăn và cộng nguyên liệu thừa vào Tủ lạnh ảo.',
            'data' => [
                'plan_id' => $mealPlan->id,
                'is_completed' => true,
                'added_leftovers' => $leftovers,
                'current_pantry' => $currentPantry,
            ],
        ]);
    }

    /**
     * GET /api/pantry
     * Xem toàn bộ nguyên liệu đang có trong Tủ lạnh ảo của người dùng
     */
    public function getPantry(Request $request): JsonResponse
    {
        $user = $this->resolveUser($request);
        $userId = $user->id;

        $pantryItems = UserPantry::with('product')
            ->where('user_id', $userId)
            ->where('remaining_value', '>', 0)
            ->orderBy('expires_at', 'asc')
            ->get()
            ->map(function ($item) {
                return [
                    'id' => $item->id,
                    'bhx_product_id' => $item->bhx_product_id,
                    'product_name' => $item->product ? $item->product->name : null,
                    'category_name' => $item->product ? $item->product->category_name : null,
                    'image_url' => $item->product ? $item->product->image_url : null,
                    'remaining_value' => (float) $item->remaining_value,
                    'unit' => $item->unit,
                    'expires_at' => $item->expires_at ? $item->expires_at->toDateString() : null,
                    'updated_at' => $item->updated_at,
                ];
            });

        return response()->json([
            'success' => true,
            'user' => [
                'id' => $user->id,
                'name' => $user->name,
                'is_guest' => $user->is_guest,
            ],
            'total_items' => $pantryItems->count(),
            'data' => $pantryItems,
        ]);
    }
}
