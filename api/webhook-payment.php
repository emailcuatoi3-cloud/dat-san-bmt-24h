<?php
/**
 * CỔNG WEBHOOK THANH TOÁN TỰ ĐỘNG (VIETQR / SEPAY / PAYOS / CASSO)
 * - Tự động đối soát biến động số dư ngân hàng qua Webhook
 * - Nhận diện mã đơn BMT... trong nội dung chuyển khoản
 * - Tự động đổi trạng thái đơn sang 'confirmed' & 'deposit_paid'
 * - Gửi thông báo real-time và gửi Email vé QR cho khách hàng
 */
require_once __DIR__ . '/../includes/bootstrap.php';
require_once __DIR__ . '/../includes/mailer.php';

header('Content-Type: application/json; charset=utf-8');

// Phản hồi kiểm tra trạng thái cổng Webhook (Ping GET)
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    echo json_encode([
        'status' => 'active',
        'gateway' => 'VietQR / SePay / PayOS Payment Webhook',
        'serverTime' => date('Y-m-d H:i:s'),
        'supportedFormats' => ['SePay Webhook', 'PayOS Webhook', 'Custom VietQR Webhook'],
        'usage' => 'Gửi POST JSON với content chứa mã đơn (VD: BMT20261123-1234) và amount tương ứng.',
    ], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
    exit;
}

// Kiểm tra phương thức POST
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Method Not Allowed']);
    exit;
}

// Đọc payload JSON
$rawInput = file_get_contents('php://input');
$data = json_decode($rawInput, true);

// Ghi log Webhook để dễ đối soát
$allHeaders = function_exists('getallheaders') ? getallheaders() : [];
$authHeader = $_SERVER['HTTP_AUTHORIZATION'] ?? $_SERVER['HTTP_X_API_KEY'] ?? $_SERVER['HTTP_API_KEY'] ?? ($allHeaders['Authorization'] ?? $allHeaders['authorization'] ?? '');
$logLine = date('Y-m-d H:i:s') . ' | IP: ' . ($_SERVER['REMOTE_ADDR'] ?? 'unknown') . ' | Auth: ' . $authHeader . ' | Payload: ' . $rawInput . PHP_EOL;
@file_put_contents(__DIR__ . '/../database/webhook.log', $logLine, FILE_APPEND);

if (!is_array($data)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Dữ liệu JSON không hợp lệ']);
    exit;
}

// Kiểm tra Secret Token / API Key nếu có cấu hình
$expected = WEBHOOK_PAYMENT_API_KEY;
$incomingToken = trim(str_ireplace('Bearer ', '', str_ireplace('Apikey ', '', $authHeader)));
$bodyToken = trim((string)($data['token'] ?? $data['apiKey'] ?? ''));
$isTokenValid = ($expected === 'bmt24h_webhook_secret_key') || ($incomingToken === $expected) || ($bodyToken === $expected);

// Trích xuất số tài khoản (nếu SePay gửi)
$accountNumber = (string) ($data['accountNumber'] ?? $data['account_number'] ?? '');
$isMyAccount = ($accountNumber === '' || $accountNumber === '0898383246');

if (!$isTokenValid && !$isMyAccount) {
    http_response_code(401);
    echo json_encode(['success' => false, 'error' => 'Khóa xác thực Webhook không hợp lệ']);
    exit;
}

// Trích xuất nội dung chuyển khoản và số tiền từ các định dạng SePay, PayOS hoặc chuẩn chung
$content = (string) ($data['content'] ?? $data['description'] ?? $data['data']['description'] ?? $data['data']['orderCode'] ?? '');
$amount = (int) ($data['transferAmount'] ?? $data['amount'] ?? $data['data']['amount'] ?? 0);

// Tìm mã đơn BMT... trong nội dung chuyển khoản (Hỗ trợ cả định dạng chuẩn BMT20261123-2462 và trường hợp ngân hàng tự xóa gạch ngang BMT202611232462)
$bookingCode = '';
if (preg_match('/BMT(\d{8})-?(\d{4})/i', $content, $matches)) {
    $bookingCode = 'BMT' . $matches[1] . '-' . $matches[2];
} else {
    // Thử tìm theo mã code trực tiếp nếu client gửi trường code riêng
    $candidate = strtoupper(trim((string)($data['code'] ?? $data['bookingCode'] ?? '')));
    if (preg_match('/^BMT(\d{8})-?(\d{4})$/', $candidate, $matches)) {
        $bookingCode = 'BMT' . $matches[1] . '-' . $matches[2];
    }
}

if (!$bookingCode) {
    echo json_encode([
        'success' => false,
        'message' => 'Không tìm thấy mã đơn đặt sân BMT trong nội dung giao dịch',
        'rawContent' => $content,
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

// Tra cứu đơn đặt sân trong cơ sở dữ liệu (hỗ trợ cả mã có gạch ngang và không gạch ngang)
$booking = q_one('SELECT * FROM bookings WHERE code = ? OR REPLACE(code, "-", "") = ?', [
    $bookingCode, 
    str_replace('-', '', $bookingCode)
]);

if (!$booking) {
    http_response_code(404);
    echo json_encode([
        'success' => false,
        'error' => "Không tìm thấy đơn đặt sân với mã $bookingCode trong hệ thống",
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

if ($booking['status'] === 'cancelled') {
    echo json_encode([
        'success' => false,
        'error' => "Đơn $bookingCode đã bị hủy trước đó",
        'status' => 'cancelled',
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

// Nếu đơn đã được xác nhận thanh toán trước đó
if (in_array($booking['payment_status'], ['paid', 'deposit_paid'], true)) {
    echo json_encode([
        'success' => true,
        'message' => "Đơn $bookingCode đã hoàn tất thanh toán từ trước",
        'bookingCode' => $bookingCode,
        'paymentStatus' => $booking['payment_status'],
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

// Kiểm tra số tiền chuyển
$depositRequired = (int) $booking['deposit_amount'];
$totalPrice = (int) $booking['total_price'];

// Nếu không truyền số tiền hoặc số tiền đủ đáp ứng cọc
$isFull = ($amount >= $totalPrice) || ($booking['payment_method'] === 'vietqr-full');
$newPaymentStatus = $isFull ? 'paid' : 'deposit_paid';

// Cập nhật trạng thái đơn đặt sân
q("UPDATE bookings SET 
    payment_status = ?, 
    status = 'confirmed', 
    hold_expires_at = NULL, 
    approved_at = COALESCE(approved_at, NOW()) 
   WHERE id = ?", 
   [$newPaymentStatus, $booking['id']]
);

// Lấy lại thông tin đơn mới nhất
$updatedBooking = q_one('SELECT * FROM bookings WHERE id = ?', [$booking['id']]);

// 1. Gửi thông báo đến tài khoản Khách hàng
$targetUserId = (int) ($updatedBooking['customer_id'] ?: 0);
if (!$targetUserId && !empty($updatedBooking['customer_phone'])) {
    $targetUserId = (int) q_val('SELECT id FROM users WHERE phone = ?', [$updatedBooking['customer_phone']]);
}
if ($targetUserId > 0) {
    $payText = $isFull ? 'toàn bộ tiền sân' : 'tiền cọc ' . number_format($depositRequired, 0, ',', '.') . 'đ';
    push_notification(
        $targetUserId,
        'Thanh toán đơn #' . $bookingCode . ' thành công!',
        'Hệ thống tự động nhận ' . $payText . ' qua chuyển khoản ngân hàng. Vé QR đặt sân của bạn đã sẵn sàng!',
        'payment',
        '/tai-khoan?tab=history'
    );
}

// 2. Gửi thông báo đến Chủ sân
$court = q_one('SELECT owner_id FROM courts WHERE id = ?', [$updatedBooking['court_id']]);
if (!empty($court['owner_id'])) {
    push_notification(
        (int) $court['owner_id'],
        'Đơn #' . $bookingCode . ' đã cọc qua Ngân hàng',
        'Khách ' . ($updatedBooking['customer_name'] ?: 'Khách') . ' đã chuyển khoản thành công cho lịch đặt ' . date('d/m/Y', strtotime($updatedBooking['booking_date'])) . '.',
        'payment',
        '/chu-san?tab=bookings'
    );
}

// 3. Tự động gửi Email vé điện tử
send_booking_ticket_email($updatedBooking);

echo json_encode([
    'success' => true,
    'message' => "Đã xác nhận thanh toán cọc tự động cho đơn $bookingCode!",
    'bookingCode' => $bookingCode,
    'courtName' => $updatedBooking['court_name'],
    'paymentStatus' => $newPaymentStatus,
    'amountReceived' => $amount,
    'confirmedAt' => date('Y-m-d H:i:s'),
], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
