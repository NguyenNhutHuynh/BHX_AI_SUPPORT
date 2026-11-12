<?php

use App\Http\Controllers\BhxProductController;
use App\Http\Controllers\MealPlanController;
use Illuminate\Support\Facades\Route;

Route::get('/health', function () {
    return response()->json([
        'status' => 'ok',
        'service' => 'BHX Master API',
        'timestamp' => now()->toIso8601String(),
    ]);
});

// Danh mục và sản phẩm Bách Hóa Xanh
Route::get('/bhx-products', [BhxProductController::class, 'index']);
Route::post('/bhx-products/sync-realtime-prices', [BhxProductController::class, 'syncRealtimePrices']);

// Quản lý Thiết lập người dùng
Route::post('/preferences', [MealPlanController::class, 'savePreferences']);

// Lập kế hoạch Thực đơn thông minh AI & BHX
Route::post('/meal-plans/generate', [MealPlanController::class, 'generate']);
Route::post('/meal-plans/{id}/complete', [MealPlanController::class, 'complete']);

// Quản lý Tủ lạnh ảo (Virtual Pantry)
Route::get('/pantry', [MealPlanController::class, 'getPantry']);
