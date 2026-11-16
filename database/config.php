<?php
/**
 * CẤU HÌNH CHUNG — chỉ cần sửa file này khi triển khai.
 */

// ---- Kết nối MySQL / MariaDB ----
define('DB_HOST', getenv('DB_HOST') ?: '127.0.0.1');
define('DB_PORT', getenv('DB_PORT') ?: '3306');
define('DB_NAME', getenv('DB_NAME') ?: 'datsan_bmt24h');
define('DB_USER', getenv('DB_USER') ?: 'root');
define('DB_PASS', getenv('DB_PASS') !== false ? getenv('DB_PASS') : '');

// ---- Thông tin website ----
define('SITE_NAME', 'Đặt Sân BMT 24H');
define('HOTLINE', '0262 399 8888');
define('SUPPORT_EMAIL', 'hotro@datsanbmt24h.vn');

// ---- Tài khoản nhận cọc (mã VietQR) ----
define('BANK_BIN', '970422');
define('BANK_NAME', 'MB Bank');
define('BANK_ACCOUNT', '0388888888');
define('BANK_ACCOUNT_NAME', 'DAT SAN BMT 24H');

/** Tỷ lệ cọc mặc định khi khách chọn "cọc 30%" */
define('DEPOSIT_RATE', 0.3);
/** Số phút giữ sân trong lúc khách quét mã chuyển khoản */
define('HOLD_MINUTES', 10);
/** Số giây hệ thống chờ để đối soát giao dịch rồi tự động xác nhận tiền cọc */
define('AUTO_CONFIRM_SECONDS', 5);
/** Chỉ cho hủy khi còn cách giờ chơi từ số giờ này trở lên */
define('CANCEL_CUTOFF_HOURS', 4);

// ---- Cấu hình chống spam đặt sân & giữ chỗ ảo ----
/** Số đơn giữ chỗ (pending chưa cọc) tối đa của 1 số điện thoại tại một thời điểm */
define('MAX_ACTIVE_HOLDS_PER_PHONE', 1);
/** Số lượt đặt sân tối đa trong cùng 1 ngày chơi của 1 số điện thoại */
define('MAX_BOOKINGS_PER_DATE_PER_PHONE', 1);
/** Số lượt tạo đơn tối đa trong vòng 24 giờ của 1 số điện thoại */
define('MAX_BOOKINGS_CREATED_PER_DAY', 2);
/** Thời gian chờ tối thiểu (giây) giữa 2 lần bấm đặt sân từ cùng một phiên/IP */
define('BOOKING_COOLDOWN_SECONDS', 15);
/** Số lần để đơn giữ sân bị hủy do hết hạn tối đa trong ngày trước khi bị tạm khóa */
define('MAX_EXPIRED_HOLDS_PER_DAY', 3);
/** Thời gian tạm khóa (phút) đối với SĐT có dấu hiệu spam bùng cọc liên tiếp */
define('SPAM_COOLDOWN_MINUTES', 60);
/**
 * Tự động xác nhận tiền cọc sau AUTO_CONFIRM_SECONDS giây (bản demo).
 * Để CHỐNG SPAM triệt để: Đặt false -> khách bấm 'Tôi đã chuyển khoản', đơn ở trạng thái
 * 'Chờ chủ sân duyệt'. Chủ sân kiểm tra tiền vào tài khoản rồi bấm 'Duyệt' thì vé mới mở.
 */
define('ENABLE_AUTO_CONFIRM_PAYMENT', false);
/** Danh sách số điện thoại bị chặn đặt sân trực tuyến */
define('BLACKLISTED_PHONES', []);

date_default_timezone_set('Asia/Ho_Chi_Minh');
