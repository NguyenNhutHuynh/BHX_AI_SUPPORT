<?php

use App\Http\Controllers\AuthController;
use App\Http\Controllers\BhxProductController;
use App\Http\Controllers\MealPlanController;
use Illuminate\Support\Facades\Route;

Route::get('/health', function () {
    return response()->json([
        'status' => 'ok',
        'service' => 'Đi Chợ Khéo API',
        'timestamp' => now()->toIso8601String(),
    ]);
});

// Xác thực & Quản lý phiên (Khách vãng lai & Đăng nhập Số điện thoại OTP)
Route::prefix('auth')->group(function () {
    Route::get('/session', [AuthController::class, 'session']);
    Route::post('/send-otp', [AuthController::class, 'sendOtp']);
    Route::post('/verify-otp', [AuthController::class, 'verifyOtp']);
    Route::post('/logout', [AuthController::class, 'logout']);
});

// Danh mục và sản phẩm
Route::get('/bhx-products', [BhxProductController::class, 'index']);
Route::post('/bhx-products/sync-realtime-prices', [BhxProductController::class, 'syncRealtimePrices']);

// Quản lý Thiết lập người dùng
Route::post('/preferences', [MealPlanController::class, 'savePreferences']);

// Lập kế hoạch Thực đơn thông minh AI & BHX
Route::post('/meal-plans/generate', [MealPlanController::class, 'generate']);
Route::post('/meal-plans/{id}/complete', [MealPlanController::class, 'complete']);

// Quản lý Tủ lạnh ảo (Virtual Pantry)
Route::get('/pantry', [MealPlanController::class, 'getPantry']);
