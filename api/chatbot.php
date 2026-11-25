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

        $sessionId = in_str('session_id');
        if ($sessionId === '' && isset($raw['session_id'])) {
            $sessionId = trim((string)$raw['session_id']);
        }

        $reply = chatbot_reply($message, $history);

        // Tự động lưu lịch sử tin nhắn vào CSDL
        try {
            ensure_sitemap_schema();
            $u = current_user();
            $uid = $u ? (int)$u['id'] : null;
            $finalSessId = $sessionId ?: (session_id() ?: 'guest_' . md5($_SERVER['REMOTE_ADDR'] ?? '127.0.0.1'));
            q('INSERT INTO chatbot_history (id, user_id, session_id, user_message, bot_reply, provider, is_fallback, created_at) VALUES (?,?,?,?,?,?,?,NOW())',
                [uid('ch-'), $uid, $finalSessId, mb_substr($message, 0, 1000), mb_substr($reply['text'] ?? '', 0, 3000), $reply['provider'] ?? 'gemini', !empty($reply['fallback']) ? 1 : 0]);
        } catch (Throwable $t) {
            error_log('Lưu lịch sử chatbot thất bại: ' . $t->getMessage());
        }

        return $reply;
    },

    // Danh sách các phiên hội thoại của người dùng
    'sessions' => function () {
        ensure_sitemap_schema();
        $u = current_user();
        $uid = $u ? (int)$u['id'] : null;
        $sessId = session_id() ?: 'guest_' . md5($_SERVER['REMOTE_ADDR'] ?? '127.0.0.1');

        $rows = $uid
            ? q_all('SELECT session_id, MIN(user_message) as title, COUNT(*) as total, MAX(created_at) as updated_at FROM chatbot_history WHERE user_id = ? GROUP BY session_id ORDER BY updated_at DESC LIMIT 30', [$uid])
            : q_all('SELECT session_id, MIN(user_message) as title, COUNT(*) as total, MAX(created_at) as updated_at FROM chatbot_history WHERE session_id = ? AND user_id IS NULL GROUP BY session_id ORDER BY updated_at DESC LIMIT 30', [$sessId]);

        return ['sessions' => $rows];
    },

    // Đồng bộ toàn bộ các phiên chat và tin nhắn của tài khoản đã đăng nhập
    'sync' => function () {
        ensure_sitemap_schema();
        $u = current_user();
        if (!$u) {
            return ['sessions' => []];
        }
        $uid = (int)$u['id'];
        $rows = q_all('SELECT session_id, user_message, bot_reply, created_at FROM chatbot_history WHERE user_id = ? ORDER BY created_at ASC LIMIT 400', [$uid]);

        $sessionsMap = [];
        foreach ($rows as $r) {
            $sid = $r['session_id'];
            if (!isset($sessionsMap[$sid])) {
                $sessionsMap[$sid] = [
                    'id' => $sid,
                    'title' => mb_substr(trim($r['user_message']), 0, 36),
                    'createdAt' => strtotime($r['created_at']) * 1000,
                    'updatedAt' => strtotime($r['created_at']) * 1000,
                    'messages' => [],
                ];
            }
            $sessionsMap[$sid]['updatedAt'] = strtotime($r['created_at']) * 1000;
            $sessionsMap[$sid]['messages'][] = [
                'from' => 'user',
                'text' => $r['user_message'],
            ];
            $sessionsMap[$sid]['messages'][] = [
                'from' => 'bot',
                'text' => $r['bot_reply'],
            ];
        }

        $sessions = array_values($sessionsMap);
        usort($sessions, fn($a, $b) => $b['updatedAt'] <=> $a['updatedAt']);

        return ['sessions' => $sessions];
    },

    // Gán các phiên chat của khách (trước khi đăng nhập) vào tài khoản vừa đăng nhập
    'claim_guest_sessions' => function () {
        ensure_sitemap_schema();
        $u = current_user();
        if (!$u) {
            return ['claimed' => 0];
        }
        $uid = (int)$u['id'];
        $raw = json_decode(file_get_contents('php://input'), true) ?: [];
        $sessionIds = $raw['session_ids'] ?? [];
        if (!is_array($sessionIds) || empty($sessionIds)) {
            return ['claimed' => 0];
        }
        $cleanIds = array_values(array_unique(array_filter(array_map(fn($id) => trim((string)$id), $sessionIds), fn($id) => $id !== '')));
        if (empty($cleanIds)) {
            return ['claimed' => 0];
        }
        $placeholders = implode(',', array_fill(0, count($cleanIds), '?'));
        $params = array_merge([$uid], $cleanIds);
        q("UPDATE chatbot_history SET user_id = ? WHERE user_id IS NULL AND session_id IN ($placeholders)", $params);
        return ['claimed' => count($cleanIds)];
    },

    // Lấy lịch sử trò chuyện đã lưu trên máy chủ (cho 1 session cụ thể hoặc gần nhất)
    'history' => function () {
        ensure_sitemap_schema();
        $u = current_user();
        $uid = $u ? (int)$u['id'] : null;
        $sessId = session_id() ?: 'guest_' . md5($_SERVER['REMOTE_ADDR'] ?? '127.0.0.1');
        
        $raw = input();
        $targetSession = in_str('session_id') ?: ($raw['session_id'] ?? '');

        if ($targetSession) {
            $rows = $uid
                ? q_all('SELECT user_message, bot_reply, created_at FROM chatbot_history WHERE session_id = ? AND user_id = ? ORDER BY created_at ASC LIMIT 60', [$targetSession, $uid])
                : q_all('SELECT user_message, bot_reply, created_at FROM chatbot_history WHERE session_id = ? AND user_id IS NULL ORDER BY created_at ASC LIMIT 60', [$targetSession]);
        } else {
            $rows = $uid
                ? q_all('SELECT user_message, bot_reply, created_at FROM chatbot_history WHERE user_id = ? ORDER BY created_at ASC LIMIT 40', [$uid])
                : q_all('SELECT user_message, bot_reply, created_at FROM chatbot_history WHERE session_id = ? AND user_id IS NULL ORDER BY created_at ASC LIMIT 40', [$sessId]);
        }

        $messages = [];
        foreach ($rows as $r) {
            $messages[] = ['from' => 'user', 'text' => $r['user_message'], 'time' => $r['created_at']];
            $messages[] = ['from' => 'bot', 'text' => $r['bot_reply'], 'time' => $r['created_at']];
        }
        return ['messages' => $messages];
    },

    // Xóa một phiên hội thoại cụ thể
    'delete_session' => function () {
        ensure_sitemap_schema();
        $u = current_user();
        $uid = $u ? (int)$u['id'] : null;
        $raw = input();
        $targetSession = in_str('session_id') ?: ($raw['session_id'] ?? '');
        if ($targetSession) {
            if ($uid) {
                q('DELETE FROM chatbot_history WHERE session_id = ? AND user_id = ?', [$targetSession, $uid]);
            } else {
                q('DELETE FROM chatbot_history WHERE session_id = ? AND user_id IS NULL', [$targetSession]);
            }
        }
        return ['ok' => true];
    },

    // Xóa toàn bộ lịch sử trò chuyện trên máy chủ
    'clear_history' => function () {
        ensure_sitemap_schema();
        $u = current_user();
        $uid = $u ? (int)$u['id'] : null;
        $sessId = session_id() ?: 'guest_' . md5($_SERVER['REMOTE_ADDR'] ?? '127.0.0.1');

        if ($uid) {
            q('DELETE FROM chatbot_history WHERE user_id = ?', [$uid]);
        } else {
            q('DELETE FROM chatbot_history WHERE session_id = ? AND user_id IS NULL', [$sessId]);
        }
        return ['ok' => true];
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
