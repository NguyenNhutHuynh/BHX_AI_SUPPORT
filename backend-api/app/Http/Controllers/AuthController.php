<?php

namespace App\Http\Controllers;

use App\Models\MealPlan;
use App\Models\User;
use App\Models\UserPantry;
use App\Models\UserPreference;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;

class AuthController extends Controller
{
    /**
     * Lấy thông tin phiên hiện tại (User đăng nhập hoặc Khách vãng lai)
     */
    public function session(Request $request): JsonResponse
    {
        // 1. Kiểm tra nếu có Bearer token hợp lệ
        if ($user = $request->user('sanctum')) {
            return response()->json([
                'success' => true,
                'is_logged_in' => true,
                'user' => $user,
            ]);
        }

        // 2. Chế độ khách (Guest Mode) dựa trên guest_uuid
        $guestUuid = $request->header('X-Guest-Uuid') ?: $request->input('guest_uuid');

        if (!empty($guestUuid)) {
            $guestUser = User::firstOrCreate(
                ['guest_uuid' => $guestUuid],
                [
                    'name' => 'Khách ' . substr($guestUuid, 0, 6),
                    'is_guest' => true,
                ]
            );

            return response()->json([
                'success' => true,
                'is_logged_in' => false,
                'is_guest' => true,
                'user' => $guestUser,
            ]);
        }

        return response()->json([
            'success' => true,
            'is_logged_in' => false,
            'is_guest' => false,
            'user' => null,
        ]);
    }

    /**
     * Gửi mã OTP xác thực số điện thoại
     */
    public function sendOtp(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'phone' => 'required|string|min:9|max:15',
        ]);

        $phone = preg_replace('/[^0-9]/', '', $validated['phone']);
        if (strlen($phone) < 9) {
            return response()->json([
                'success' => false,
                'message' => 'Số điện thoại không hợp lệ.',
            ], 422);
        }

        // Chuẩn hóa định dạng 0xxxxxxxxx
        if (str_starts_with($phone, '84') && strlen($phone) >= 11) {
            $phone = '0' . substr($phone, 2);
        }

        // Tạo mã OTP 6 chữ số ngẫu nhiên
        $otp = (string) rand(100000, 999999);

        // Lưu Cache trong 5 phút (300 giây)
        Cache::put('otp_' . $phone, $otp, now()->addMinutes(5));

        // Ghi log hệ thống
        Log::info("[Đi Chợ Khéo OTP] Số điện thoại: {$phone} | Mã OTP: {$otp}");

        return response()->json([
            'success' => true,
            'message' => "Mã OTP đã được gửi đến số {$phone}. Vui lòng kiểm tra tin nhắn.",
            'phone' => $phone,
            // Cho phép xem mã trực tiếp khi đang thử nghiệm (có thể dùng cả mã 123456 làm mã test)
            'test_otp' => $otp,
            'hint' => 'Mẹo: Bạn có thể nhập mã OTP hiển thị ở đây hoặc nhập mã dự phòng 123456.',
        ]);
    }

    /**
     * Xác thực OTP và cấp Token đăng nhập
     */
    public function verifyOtp(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'phone' => 'required|string|min:9|max:15',
            'otp' => 'required|string',
            'guest_uuid' => 'nullable|string',
        ]);

        $phone = preg_replace('/[^0-9]/', '', $validated['phone']);
        if (str_starts_with($phone, '84') && strlen($phone) >= 11) {
            $phone = '0' . substr($phone, 2);
        }

        $inputOtp = trim($validated['otp']);
        $savedOtp = Cache::get('otp_' . $phone);

        // Hỗ trợ mã test 123456 hoặc mã thực tế từ Cache
        $isValidOtp = ($inputOtp === '123456') || ($savedOtp && $inputOtp === (string) $savedOtp);

        if (!$isValidOtp) {
            return response()->json([
                'success' => false,
                'message' => 'Mã OTP không chính xác hoặc đã hết hạn (5 phút). Vui lòng thử lại!',
            ], 422);
        }

        // Xóa OTP khỏi cache sau khi dùng thành công
        Cache::forget('otp_' . $phone);

        $guestUuid = $validated['guest_uuid'] ?? null;
        $guestUser = $guestUuid ? User::where('guest_uuid', $guestUuid)->first() : null;

        // Tìm xem SĐT này đã từng tạo tài khoản chưa
        $user = User::where('phone', $phone)->first();

        if ($user) {
            // Nếu đã có user SĐT này, hợp nhất dữ liệu từ Guest sang User này
            if ($guestUser && $guestUser->id !== $user->id) {
                UserPantry::where('user_id', $guestUser->id)->update(['user_id' => $user->id]);
                MealPlan::where('user_id', $guestUser->id)->update(['user_id' => $user->id]);
                UserPreference::where('user_id', $guestUser->id)->update(['user_id' => $user->id]);
                $guestUser->delete();
            }
        } else {
            // Nếu chưa có, nâng cấp tài khoản Guest thành tài khoản chính thức hoặc tạo mới
            if ($guestUser) {
                $guestUser->phone = $phone;
                $guestUser->name = 'Thành viên ' . substr($phone, -4);
                $guestUser->is_guest = false;
                $guestUser->guest_uuid = null;
                $guestUser->save();
                $user = $guestUser;
            } else {
                $user = User::create([
                    'phone' => $phone,
                    'name' => 'Thành viên ' . substr($phone, -4),
                    'is_guest' => false,
                ]);
            }
        }

        // Tạo Sanctum Token
        $token = $user->createToken('mobile_web_token')->plainTextToken;

        return response()->json([
            'success' => true,
            'message' => 'Đăng nhập thành công!',
            'token' => $token,
            'user' => [
                'id' => $user->id,
                'name' => $user->name,
                'phone' => $user->phone,
                'is_guest' => false,
            ],
        ]);
    }

    /**
     * Đăng xuất
     */
    public function logout(Request $request): JsonResponse
    {
        if ($user = $request->user('sanctum')) {
            $user->currentAccessToken()->delete();
        }

        return response()->json([
            'success' => true,
            'message' => 'Đã đăng xuất thành công.',
        ]);
    }
}

