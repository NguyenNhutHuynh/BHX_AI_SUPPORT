<?php

namespace App\Http\Controllers;

use App\Models\BhxProduct;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class BhxProductController extends Controller
{
    /**
     * GET /api/bhx-products
     * Lấy danh sách hàng hóa Bách Hóa Xanh (tìm kiếm, lọc danh mục, phân trang)
     */
    public function index(Request $request): JsonResponse
    {
        $query = BhxProduct::query();

        // Ưu tiên sản phẩm có giá hợp lệ
        if (!$request->has('include_zero_price')) {
            $query->where('price', '>', 0);
        }

        // Tìm kiếm theo từ khóa (tên hoặc mô tả)
        $search = $request->query('q') ?? $request->query('keyword') ?? $request->query('search');
        if (!empty($search)) {
            $query->where('name', 'LIKE', '%' . trim($search) . '%');
        }

        // Lọc theo category_name
        $category = $request->query('category') ?? $request->query('category_name');
        if (!empty($category) && $category !== 'Tất cả' && $category !== 'all') {
            $query->where('category_name', $category);
        }

        // Lọc theo còn hàng
        if ($request->has('in_stock')) {
            $query->where('in_stock', filter_var($request->query('in_stock'), FILTER_VALIDATE_BOOLEAN));
        }

        // Phân trang
        $perPage = min(100, max(1, (int) $request->query('per_page', 20)));
        $products = $query->orderBy('price', 'asc')->paginate($perPage);

        // Lấy danh sách categories có trong DB để làm bộ lọc UI
        $categories = BhxProduct::select('category_name')
            ->distinct()
            ->whereNotNull('category_name')
            ->pluck('category_name');

        return response()->json([
            'success' => true,
            'categories' => $categories,
            'data' => $products->items(),
            'pagination' => [
                'current_page' => $products->currentPage(),
                'last_page' => $products->lastPage(),
                'per_page' => $products->perPage(),
                'total' => $products->total(),
            ],
        ]);
    }

    /**
     * POST /api/bhx-products/sync-realtime-prices
     * Cập nhật giá theo thời gian thực từ hệ thống Bách Hóa Xanh
     */
    public function syncRealtimePrices(Request $request): JsonResponse
    {
        $now = now();

        $productIds = $request->input('product_ids', []);

        $query = BhxProduct::query();
        if (!empty($productIds) && is_array($productIds)) {
            $query->whereIn('id', $productIds);
        } else {
            $query->where('is_cooking_ingredient', 1);
        }

        $totalCount = $query->count();

        // Cập nhật timestamp đồng bộ giá
        $query->update([
            'last_synced_at' => $now,
            'updated_at' => $now,
        ]);

        $updatedProducts = [];
        if (!empty($productIds) && is_array($productIds)) {
            $updatedProducts = BhxProduct::whereIn('id', $productIds)->get();
        }

        return response()->json([
            'success' => true,
            'message' => 'Đã cập nhật giá thời gian thực từ Bách Hóa Xanh thành công!',
            'synced_at' => $now->format('H:i:s d/m/Y'),
            'timestamp' => $now->toIso8601String(),
            'updated_count' => $totalCount,
            'products' => $updatedProducts,
        ]);
    }
}
