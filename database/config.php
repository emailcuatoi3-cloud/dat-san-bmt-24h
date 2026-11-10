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

date_default_timezone_set('Asia/Ho_Chi_Minh');
