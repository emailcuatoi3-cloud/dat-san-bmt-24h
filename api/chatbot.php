<?php
/**
 * API Trợ lý Chatbot AI Đặt Sân BMT 24H
 * - Nhận câu hỏi từ khách hàng (POST /api/chatbot.php?action=message)
 * - Tra cứu trạng thái nhà cung cấp AI (GET /api/chatbot.php?action=status)
 * - Quản trị viên kiểm tra kết nối API (POST /api/chatbot.php?action=test_connection)
 */

require_once __DIR__ . '/../includes/bootstrap.php';

run_api([
    // Tiếp nhận câu hỏi và phản hồi từ Trợ lý AI hoặc kịch bản fallback tư vấn
    'message' => function () {
        $message = in_str('message');
        $raw = input();
        if ($message === '' && isset($raw['message'])) {
            $message = trim((string)$raw['message']);
        }
        if ($message === '' && isset($_POST['message'])) {
            $message = trim((string)$_POST['message']);
        }
        if ($message === '' && isset($_GET['message'])) {
            $message = trim((string)$_GET['message']);
        }

        $history = in_arr('history');
        if (empty($history) && isset($raw['history']) && is_array($raw['history'])) {
            $history = $raw['history'];
        }

        return chatbot_reply($message, $history);
    },

    // Trả về trạng thái cấu hình nhà cung cấp AI an toàn
    'status' => function () {
        return chatbot_status();
    },

    // Kiểm tra kết nối AI trực tiếp (Yêu cầu quyền Quản trị viên)
    'test_connection' => function () {
        api_require_admin('ai');
        $raw = input();
        $provider = !empty($raw['provider']) ? trim((string)$raw['provider']) : null;
        $apiKey = !empty($raw['api_key']) ? trim((string)$raw['api_key']) : null;
        $model = !empty($raw['model']) ? trim((string)$raw['model']) : null;

        return chatbot_test_connection($provider, $apiKey, $model);
    },
]);
