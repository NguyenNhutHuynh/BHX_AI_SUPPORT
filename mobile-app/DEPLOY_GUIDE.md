# 🚀 Hướng Dẫn Build & Triển Khai BHX Master Mobile App

Tài liệu này hướng dẫn chi tiết các phương án đóng gói, build file `.apk` cài trực tiếp vào điện thoại, hoặc chạy ứng dụng trên điện thoại thật (Android & iOS).

---

## 📱 1. Phương án 1: Build file `.APK` cài trực tiếp lên điện thoại Android (Khuyên dùng)

Sử dụng dịch vụ **EAS Build** (miễn phí của Expo) để tạo file `.apk`. Bạn chỉ cần chạy lệnh, máy chủ Expo sẽ đóng gói tự động và gửi lại link tải file APK trực tiếp.

### Bước 1: Cài đặt EAS CLI (Nếu chưa có)
Mở terminal trong thư mục `mobile-app`:
```bash
npm install -g eas-cli
# hoặc chạy trực tiếp bằng npx: npx eas-cli
```

### Bước 2: Đăng nhập tài khoản Expo
Nếu chưa có tài khoản, hãy đăng ký miễn phí tại [expo.dev](https://expo.dev/signup):
```bash
npx eas-cli login
```

### Bước 3: Cấu hình project EAS (chỉ chạy 1 lần đầu)
```bash
npx eas-cli project:init
```

### Bước 4: Chạy lệnh build file APK
```bash
npm run build:apk
# hoặc: npx eas-cli build -p android --profile preview
```

> 💡 **Kết quả:** Sau khoảng 5 - 8 phút, terminal sẽ hiển thị **đường link download** và **mã QR**. Bạn chỉ cần mở điện thoại quét mã QR hoặc bấm link để tải file `.apk` về cài đặt và sử dụng ngay lập tức!

---

## ⚡ 2. Phương án 2: Chạy tức thì trên điện thoại thật qua Expo Go (Không cần build APK)

Nếu muốn thử nghiệm ngay lập tức trên điện thoại mà không cần đợi đóng gói APK:

### Bước 1: Cài đặt Expo Go trên điện thoại
- **Android:** Tải ứng dụng **Expo Go** từ Google Play Store.
- **iPhone:** Tải ứng dụng **Expo Go** từ App Store.

### Bước 2: Đảm bảo điện thoại và máy tính cùng chung Wi-Fi
Kiểm tra địa chỉ IP LAN của máy tính (Hiện tại máy tính của bạn là: `172.16.10.2`).

### Bước 3: Khởi động Backend Laravel hỗ trợ LAN
Tại thư mục `backend-api`, chạy lệnh:
```bash
php artisan serve --host=0.0.0.0 --port=8000
```
*(Tham số `--host=0.0.0.0` cho phép các thiết bị trong mạng Wi-Fi truy cập được vào máy chủ).*

### Bước 4: Khởi động Mobile App
Tại thư mục `mobile-app`, chạy lệnh:
```bash
npm start
```

### Bước 5: Quét mã QR
- **Android:** Mở ứng dụng **Expo Go** -> Bấm **Scan QR code** -> Quét mã trên terminal.
- **iOS:** Mở ứng dụng **Camera** mặc định -> Quét mã -> Bấm mở liên kết trong Expo Go.

---

## 🌐 3. Phương án 3: Cài đặt như ứng dụng Web PWA (Không cần file APK)

Ứng dụng hỗ trợ công nghệ Progressive Web App (PWA):

1. Xuất bản bản build web:
   ```bash
   npm run export:web
   ```
2. Thư mục `mobile-app/dist` được tạo ra chứa toàn bộ mã nguồn web độc lập.
3. Bạn có thể deploy thư mục `dist` lên Netlify, Vercel, Firebase Hosting hoặc chạy local qua server:
   ```bash
   npx serve dist
   ```
4. Trên điện thoại (Chrome trên Android hoặc Safari trên iOS), truy cập vào đường link website:
   - Trên **Chrome Android**: Bấm menu 3 chấm `⋮` -> Chọn **"Thêm vào màn hình chính" (Add to Home screen)** hoặc **"Cài đặt ứng dụng"**.
   - Trên **Safari iPhone**: Bấm nút **Chia sẻ (Share)** -> Chọn **"Thêm vào MH chính" (Add to Home Screen)**.
   - Ứng dụng sẽ xuất hiện với icon Bách Hóa Xanh và chạy toàn màn hình độc lập như một app gốc!

---

## 🛠️ 4. Tính năng Cấu hình Máy chủ (Server Settings) trên App

Để phục vụ khi cài app ra máy thật hoặc mang máy đi nơi khác:
- Ở góc trên cùng bên phải thanh tiêu đề (Header) của app có nút trạng thái máy chủ:
  - 🟢 **Online (Đèn xanh)**: Kết nối API bình thường (hiển thị kèm độ trễ ms).
  - 🔴 **Offline (Đèn đỏ)**: Mất kết nối hoặc sai địa chỉ IP.
- **Nhấn vào nút đó** để mở bảng **Cấu Hình Máy Chủ**:
  - Nhập địa chỉ IP máy tính mới nếu mạng Wi-Fi thay đổi.
  - Có các nút gợi ý nhanh: `LAN Wi-Fi`, `Android Emulator (10.0.2.2)`, `Localhost`.
  - Có nút **"Kiểm tra" (Test Ping)** để biết ngay kết nối có thông hay không trước khi lưu.
  - Lưu cấu hình vĩnh viễn trên máy không sợ bị mất.
- Nếu bạn đưa backend lên Cloud (VPS, Render, Railway, Cloudflare Tunnel, Ngrok...), bạn chỉ cần nhập URL HTTPS vào ô này là app có thể dùng được ở bất kỳ đâu (kể cả khi bật mạng 4G/5G).

