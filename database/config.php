<?php
/**
 * CẤU HÌNH CHUNG — chỉ cần sửa file này khi triển khai.
 */
// ---- Đọc file .env ở thư mục gốc dự án ----
(function (string $file): void {
    if (!is_file($file)) return;
    foreach (file($file, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) as $line) {
        $line = trim($line);
        if ($line === '' || $line[0] === '#' || !str_contains($line, '=')) continue;
        [$key, $value] = array_map('trim', explode('=', $line, 2));
        if (getenv($key) === false) putenv("$key=" . trim($value, "\"'"));
    }
})(__DIR__ . '/../.env');

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
define('BANK_ACCOUNT', '0898383246');
define('BANK_ACCOUNT_NAME', 'MA MINH HOAN');

/** Tỷ lệ cọc mặc định khi khách chọn "cọc 30%" */
define('DEPOSIT_RATE', 0.3);
/** Số phút giữ sân trong lúc khách quét mã chuyển khoản */
define('HOLD_MINUTES', 5);
/** Số giây hệ thống chờ để đối soát giao dịch rồi tự động xác nhận tiền cọc */
define('AUTO_CONFIRM_SECONDS', 5);
/** Chỉ cho hủy khi còn cách giờ chơi từ số giờ này trở lên */
define('CANCEL_CUTOFF_HOURS', 4);

// ---- Key API (điền trong .env) ----
define('GOOGLE_CLIENT_ID', getenv('GOOGLE_CLIENT_ID') ?: '');
define('GOOGLE_CLIENT_SECRET', getenv('GOOGLE_CLIENT_SECRET') ?: '');
define('FACEBOOK_APP_ID', getenv('FACEBOOK_APP_ID') ?: '');
define('FACEBOOK_APP_SECRET', getenv('FACEBOOK_APP_SECRET') ?: '');
define('CHATBOT_PROVIDER', strtolower(trim((string)(getenv('CHATBOT_PROVIDER') ?: 'gemini'))));
define('CHATBOT_API_KEY', getenv('CHATBOT_API_KEY') ?: '');
define('CHATBOT_MODEL', trim((string)(getenv('CHATBOT_MODEL') ?: '')));

// ---- Cổng Webhook thanh toán tự động (SePay / PayOS / Ngân hàng) ----
define('WEBHOOK_PAYMENT_API_KEY', 'LANEZCK7GWTCZMDU1DJPMMB83LUVJLQLAUV2J9ARBYXM6C9VSPHYVKW5HKJXPIOH');
define('SEPAY_API_TOKEN', 'LANEZCK7GWTCZMDU1DJPMMB83LUVJLQLAUV2J9ARBYXM6C9VSPHYVKW5HKJXPIOH');

// ---- Chế độ thanh toán (TEST MODE / PRODUCTION) ----
/**
 * true  = Chế độ Test/Dev: Bấm "Tôi đã chuyển khoản" là tự động duyệt cọc mở vé ngay lập tức, không cần chuyển tiền thật
 * false = Chế độ Thật: Bắt buộc chuyển khoản MBBank thật và đối soát qua SePay Webhook
 */
define('PAYMENT_TEST_MODE', true);

// ---- Cấu hình gửi thư điện tử (SMTP Gmail) ----
define('SMTP_HOST', getenv('SMTP_HOST') ?: 'smtp.gmail.com');
define('SMTP_PORT', (int)(getenv('SMTP_PORT') ?: 587));
define('SMTP_USER', getenv('SMTP_USER') ?: '');
define('SMTP_PASS', getenv('SMTP_PASS') ?: '');
define('SMTP_FROM_NAME', getenv('SMTP_FROM_NAME') ?: SITE_NAME);

date_default_timezone_set('Asia/Ho_Chi_Minh');
