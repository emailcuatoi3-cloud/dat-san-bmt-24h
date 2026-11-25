<?php
/**
 * CỔNG REAL-TIME CẬP NHẬT LỊCH SÂN (SERVER-SENT EVENTS & ADAPTIVE POLLING)
 * - Phát hiện tức thì khi có người đặt chỗ, giữ sân (hold), hủy đơn, hoặc hết hạn 5 phút.
 * - Hỗ trợ cả 2 chế độ:
 *     1. HTML5 Server-Sent Events (SSE: text/event-stream) đẩy luồng sự kiện thời gian thực.
 *     2. Lightweight Polling (JSON với ETag/hash) cho các trình duyệt/mạng không hỗ trợ SSE.
 * - Giải phóng session lock ngay lập tức (session_write_close) để không làm nghẽn các tác vụ khác.
 */

require_once __DIR__ . '/../includes/bootstrap.php';

// Giải phóng lock session ngay lập tức để không cản trở các request khác cùng trình duyệt
if (session_status() === PHP_SESSION_ACTIVE) {
    session_write_close();
}

$date = (string) ($_GET['date'] ?? date('Y-m-d'));
if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $date)) {
    $date = date('Y-m-d');
}

$courtId = trim((string) ($_GET['court'] ?? ''));
$lastHash = trim((string) ($_GET['lastHash'] ?? ''));
$isStream = isset($_GET['stream']) || (isset($_SERVER['HTTP_ACCEPT']) && str_contains($_SERVER['HTTP_ACCEPT'], 'text/event-stream'));

// Hàm tính toán dữ liệu và băm (hash) trạng thái lịch hiện tại
function get_slot_state(string $date, string $courtId = ''): array
{
    auto_cancel_expired_holds();
    $occ = occupied_slots($date);
    $occDetails = occupied_slots_details($date);
    $blk = blocked_slots_map($date);

    // Tính mã băm đại diện cho toàn bộ trạng thái bận/rảnh trong ngày (bao gồm cả phân loại thuộc tính)
    $stateStr = json_encode([$occ, $occDetails, $blk]);
    $hash = md5($stateStr);

    return [
        'date' => $date,
        'hash' => $hash,
        'occupied' => (object) $occ,
        'occupiedDetails' => (object) $occDetails,
        'blocked' => (object) $blk,
        'timestamp' => time(),
    ];
}

// ==========================================
// CHẾ ĐỘ 1: STANDARD JSON POLLING
// ==========================================
if (!$isStream) {
    if (!headers_sent()) {
        header('Content-Type: application/json; charset=utf-8');
        header('Cache-Control: no-cache, no-store, must-revalidate');
    }

    $state = get_slot_state($date, $courtId);
    $changed = ($lastHash === '' || $lastHash !== $state['hash']);

    echo json_encode([
        'success' => true,
        'changed' => $changed,
        'date' => $state['date'],
        'hash' => $state['hash'],
        'occupied' => $changed ? $state['occupied'] : null,
        'occupiedDetails' => $changed ? $state['occupiedDetails'] : null,
        'blocked' => $changed ? $state['blocked'] : null,
        'timestamp' => $state['timestamp'],
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

// ==========================================
// CHẾ ĐỘ 2: SERVER-SENT EVENTS (SSE STREAM)
// ==========================================
if (!headers_sent()) {
    header('Content-Type: text/event-stream; charset=utf-8');
    header('Cache-Control: no-cache, no-transform');
    header('Connection: keep-alive');
    header('X-Accel-Buffering: no');
}

// Tắt hoàn toàn bộ đệm đầu ra (Output Buffering) để dữ liệu bay thẳng về trình duyệt
@ini_set('zlib.output_compression', '0');
while (ob_get_level() > 0) {
    ob_end_clean();
}
@ob_implicit_flush(1);
ignore_user_abort(false);

// Gửi 2KB đệm khởi đầu để vượt qua bộ đệm proxy / Apache Windows
echo ":" . str_repeat(" ", 2048) . "\n\n";

// Thông báo cho EventSource thời gian tự động kết nối lại nếu bị ngắt là 1.2 giây
echo "retry: 1200\n\n";
flush();

$currentHash = $lastHash;
$startTime = time();
$maxExecutionSeconds = 25; // Giới hạn vòng đời mỗi stream 25 giây để Apache tái chế worker an toàn
$pingCounter = 0;

while (!connection_aborted()) {
    $state = get_slot_state($date, $courtId);

    // Nếu trạng thái lịch sân có sự thay đổi so với lần gửi trước (hoặc lần đầu kết nối)
    if ($state['hash'] !== $currentHash) {
        $payload = json_encode([
            'date' => $state['date'],
            'hash' => $state['hash'],
            'occupied' => $state['occupied'],
            'occupiedDetails' => $state['occupiedDetails'],
            'blocked' => $state['blocked'],
            'timestamp' => $state['timestamp'],
        ], JSON_UNESCAPED_UNICODE);

        echo "event: slots_update\n";
        echo "data: {$payload}\n\n";
        flush();

        $currentHash = $state['hash'];
    } else {
        // Gửi heartbeat giữ kết nối sau mỗi 8 giây
        $pingCounter++;
        if ($pingCounter >= 5) {
            echo ": ping\n\n";
            flush();
            $pingCounter = 0;
        }
    }

    // Nếu phiên stream đã chạy đủ 25 giây, đóng nhẹ nhàng để EventSource tự tạo luồng mới
    if (time() - $startTime >= $maxExecutionSeconds) {
        echo "event: cycle\n";
        echo "data: {\"hash\":\"{$currentHash}\"}\n\n";
        flush();
        break;
    }

    // Nghỉ 1.5 giây giữa mỗi chu kỳ kiểm tra
    usleep(1500000);
}

exit;
