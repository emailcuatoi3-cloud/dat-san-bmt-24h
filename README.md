# Đặt Sân BMT 24H — bản PHP + JavaScript thuần

Website đặt sân bóng đá / cầu lông tại TP. Buôn Ma Thuột, chuyển từ React + Supabase sang **PHP 8 + MySQL + JavaScript thuần (ES modules)**. Không cần Node, không cần build khi chạy.

## Yêu cầu
- PHP 8.0 trở lên (bật `pdo_mysql`, `mbstring`)
- MySQL 5.7+ hoặc MariaDB 10.4+
- Apache có `mod_rewrite` (XAMPP/Laragon) — hoặc dùng server có sẵn của PHP

## Cài đặt với XAMPP
1. Chép thư mục `dat_san_24h_php` vào `C:\xampp\htdocs\`.
2. Mở phpMyAdmin → tab **Import** → chọn file `database.sql` → **Go**. File tự tạo CSDL `datsan_bmt24h` kèm dữ liệu mẫu.
3. Mở `config.php`, sửa `DB_HOST`, `DB_USER`, `DB_PASS` nếu khác mặc định (`root` / không mật khẩu).
4. Truy cập `http://localhost/dat_san_24h_php/`.

Chạy nhanh không cần Apache:
```bash
php -S 127.0.0.1:8000 index.php
```
rồi mở `http://127.0.0.1:8000`.

## Tài khoản mẫu (mật khẩu chung: `123456`)
| Email | Vai trò |
|---|---|
| admin@bmt24h.vn | Quản trị cấp cao → `/quan-tri` |
| kiemduyet@bmt24h.vn | Quản trị – bộ quyền Kiểm duyệt viên (bị giới hạn mục) |
| chusan@bmt24h.vn | Chủ sân Hưng Sport BMT → `/chu-san` |
| chusan2@bmt24h.vn | Chủ sân Lộc Sport |
| khach@bmt24h.vn | Khách hàng |

Ngày trong dữ liệu mẫu được tính tương đối theo ngày import (`CURDATE()`), nên lịch đặt sân luôn "đang diễn ra".

## Cấu trúc
```
index.php            Bộ định tuyến (URL đẹp: /tim-san, /san/{slug}, /dat-san, /chu-san, /quan-tri ...)
config.php           Kết nối CSDL, hotline, tài khoản ngân hàng VietQR, tỉ lệ cọc, thời gian giữ sân
includes/            db.php, helpers.php, auth.php (đăng nhập, phân quyền), data.php (truy vấn dùng chung), layout.php
pages/               Từng trang PHP (render khung HTML)
api/                 API JSON: auth, booking, account, reviews, owner, admin  (?action=...)
assets/js/core/      ui.js (gọi API, modal, toast), app.js (header, theme, ngôn ngữ), invoice, ticket, chatbot
assets/js/lib/       Hàm nghiệp vụ (giá, khung giờ, khuyến mãi, check-in...)
assets/js/pages/     Script riêng từng trang (owner-*.js, admin.js ...)
assets/css/app.css   CSS đã build sẵn (Tailwind)
database.sql         Cấu trúc + dữ liệu mẫu
```

## Chức năng chính
- **Khách hàng:** tìm sân, bản đồ, sân ngẫu nhiên, đặt sân 3 bước + cọc VietQR + vé điện tử QR, mã ưu đãi, tra cứu/hủy đơn, hóa đơn, sân yêu thích, đánh giá, chatbot, đa ngôn ngữ VI/EN, giao diện sáng/tối.
- **Chủ sân (`/chu-san`):** tổng quan, duyệt/từ chối đơn (cảnh báo trùng lịch), check-in bằng mã vé, tạo đơn tại quầy, quản lý sân (giờ mở cửa theo thứ, giá giờ cao điểm, thùng rác), khóa khung giờ, phản hồi đánh giá, hóa đơn, báo cáo doanh thu, khách hàng, dịch vụ bán kèm, khuyến mãi, tiền cọc & hoàn cọc.
- **Quản trị (`/quan-tri`):** tổng quan hệ thống, tài khoản & bộ quyền quản trị, sân, đơn, hóa đơn, danh mục, nội dung website (banner/tin/FAQ/chính sách), kiểm duyệt đánh giá & báo cáo vi phạm, khuyến mãi, nhật ký thao tác.

## Sửa giao diện (tùy chọn)
CSS dùng Tailwind đã build sẵn. Nếu thêm class mới, build lại:
```bash
npx tailwindcss@3.4.17 -c tailwind.config.js -i assets/css/input.css -o assets/css/app.css --minify
```

## Ghi chú
- Đăng nhập bằng Google/Facebook và gửi email quên mật khẩu là bản demo (liên kết đặt lại hiển thị ngay trên màn hình).
- Mật khẩu lưu bằng `password_hash`; mọi giá tiền, mã giảm giá, trùng lịch đều được kiểm tra lại ở máy chủ.
