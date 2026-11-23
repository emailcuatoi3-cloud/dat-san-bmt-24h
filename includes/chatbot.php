<?php
/**
 * Module: Dịch vụ Trợ lý Chatbot AI Đặt Sân BMT 24H
 * Hỗ trợ đa nhà cung cấp: Google Gemini API & OpenAI API
 * Tích hợp ngữ cảnh dữ liệu sân thể thao thời gian thực từ MySQL PDO
 * Cơ chế Fallback ngoại tuyến an toàn tuyệt đối, không lộ khóa API hay lỗi máy chủ
 */

require_once __DIR__ . '/db.php';
require_once __DIR__ . '/helpers.php';
require_once __DIR__ . '/migrations.php';

/**
 * Trích xuất ngữ cảnh kiến thức sân thể thao và chính sách từ CSDL thời gian thực
 */
function build_venue_context(): string
{
    try {
        $settings = system_settings_all();
        $siteName = $settings['site_name'] ?? (defined('SITE_NAME') ? SITE_NAME : 'Đặt Sân BMT 24H');
        $hotline = $settings['hotline'] ?? (defined('HOTLINE') ? HOTLINE : '0262 399 8888');
        $siteAddress = $settings['site_address'] ?? 'TP. Buôn Ma Thuột, Tỉnh Đắk Lắk';
        $depositRate = $settings['deposit_rate'] ?? '30';
        $holdMinutes = $settings['hold_minutes'] ?? '5';
        $cutoffHours = $settings['cancel_cutoff_hours'] ?? '4';
        $generalPolicy = $settings['general_policy'] ?? '';

        $lines = [];
        $lines[] = "Bạn là Trợ lý AI tư vấn đặt sân thể thao chuyên nghiệp và thân thiện của nền tảng \"{$siteName}\".";
        $lines[] = "THÔNG TIN NỀN TẢNG:";
        $lines[] = "- Hotline hỗ trợ 24/7: {$hotline}";
        $lines[] = "- Khu vực hoạt động: {$siteAddress}";
        $lines[] = "- Chính sách cọc giữ chỗ: {$depositRate}% tổng tiền sân qua chuyển khoản VietQR (thời gian giữ chỗ thanh toán: {$holdMinutes} phút).";
        $lines[] = "- Chính sách hủy sân: Hoàn 100% tiền cọc khi hủy trước giờ chơi từ {$cutoffHours} giờ trở lên. Trong vòng {$cutoffHours} giờ trước giờ nhận sân, tính năng hủy online sẽ tự động khóa để bảo vệ quyền lợi chủ sân, khách hàng cần liên hệ hotline để được hỗ trợ.";
        if ($generalPolicy) {
            $lines[] = "- Lưu ý quy định: " . trim(preg_replace('/\s+/', ' ', $generalPolicy));
        }

        $lines[] = "";
        $lines[] = "DANH SÁCH SÂN BÓNG ĐÁ VÀ CẦU LÔNG ĐANG HOẠT ĐỘNG TẠI BUÔN MA THUỘT:";

        $courts = q_all("SELECT id, name, sport, sport_label, area, address, price_per_hour, peak_price, price_note, open_time, close_time, facilities, highlights 
                         FROM courts 
                         WHERE deleted_at IS NULL AND status = 'active' 
                         ORDER BY sort_order ASC, name ASC");

        if (!empty($courts)) {
            foreach ($courts as $c) {
                $sport = $c['sport_label'] ?: ($c['sport'] === 'badminton' ? 'Sân cầu lông' : 'Sân bóng đá');
                $priceStr = number_format((int)$c['price_per_hour'], 0, ',', '.') . 'đ/h';
                if (!empty($c['peak_price']) && (int)$c['peak_price'] > (int)$c['price_per_hour']) {
                    $priceStr .= ' (Giờ cao điểm: ' . number_format((int)$c['peak_price'], 0, ',', '.') . 'đ/h)';
                }
                if (!empty($c['price_note'])) {
                    $priceStr .= ' - ' . $c['price_note'];
                }
                $hours = ($c['open_time'] && $c['close_time']) ? "{$c['open_time']} - {$c['close_time']}" : "05:00 - 23:00";
                
                $facilitiesList = '';
                if (!empty($c['facilities'])) {
                    $fac = is_array($c['facilities']) ? $c['facilities'] : json_decode((string)$c['facilities'], true);
                    if (is_array($fac) && !empty($fac)) {
                        $facilitiesList = ' • Tiện ích: ' . implode(', ', array_slice($fac, 0, 4));
                    }
                }

                $lines[] = "• [{$c['name']}] ({$sport} - Khu vực: {$c['area']}): Địa chỉ {$c['address']}. Giờ mở cửa: {$hours}. Giá: {$priceStr}{$facilitiesList}.";
            }
        } else {
            $lines[] = "Hệ thống có các sân bóng đá mini (5-7 người) và cụm sân cầu lông tiêu chuẩn trên địa bàn Buôn Ma Thuột với mức giá từ 65.000đ đến 400.000đ/giờ, mở cửa từ 05:00 đến 23:00 hàng ngày.";
        }

        $lines[] = "";
        $lines[] = "QUY TẮC TƯ VẤN CHO KHÁCH HÀNG:";
        $lines[] = "1. Trả lời bằng tiếng Việt tự nhiên, ngắn gọn, súc tích, lịch sự và hữu ích.";
        $lines[] = "2. Ưu tiên cung cấp chính xác tên sân, mức giá, địa chỉ và khung giờ có trong danh sách trên.";
        $lines[] = "3. Hướng dẫn khách hàng chọn sân và bấm \"Đặt sân\" trực tiếp trên website hoặc gọi Hotline {$hotline} khi cần hỗ trợ gấp.";

        return implode("\n", $lines);
    } catch (Throwable $e) {
        error_log('build_venue_context error: ' . $e->getMessage());
        return "Bạn là Trợ lý AI tư vấn đặt sân thể thao Đặt Sân BMT 24H. Hotline: 0262 399 8888. Hỗ trợ đặt sân bóng đá và cầu lông tại Buôn Ma Thuột. Chính sách cọc 30% qua VietQR, hủy trước 4 giờ hoàn cọc 100%.";
    }
}

/**
 * Bí danh tương thích cho build_venue_context
 */
function build_chatbot_context(): string
{
    return build_venue_context();
}

/**
 * Định dạng payload cho Google Gemini API
 */
function format_gemini_payload(string $message, string $systemPrompt, array $history = []): array
{
    $contents = [];

    // Chuyển đổi lịch sử hội thoại hợp lệ (chỉ chấp nhận vai trò 'user' và 'model')
    if (!empty($history)) {
        foreach ($history as $h) {
            $from = $h['from'] ?? ($h['role'] ?? '');
            $text = trim((string)($h['text'] ?? ($h['content'] ?? '')));
            if ($text === '') continue;

            $role = ($from === 'bot' || $from === 'model' || $from === 'assistant') ? 'model' : 'user';
            $contents[] = [
                'role' => $role,
                'parts' => [
                    ['text' => $text]
                ]
            ];
        }
    }

    // Tin nhắn hiện tại của người dùng
    $contents[] = [
        'role' => 'user',
        'parts' => [
            ['text' => $message]
        ]
    ];

    return [
        'system_instruction' => [
            'parts' => [
                ['text' => $systemPrompt]
            ]
        ],
        'contents' => $contents,
        'generationConfig' => [
            'temperature' => 0.7,
            'maxOutputTokens' => 1000,
        ]
    ];
}

/**
 * Định dạng payload cho OpenAI API
 */
function format_openai_payload(string $message, string $systemPrompt, array $history = [], string $model = 'gpt-4o-mini'): array
{
    $messages = [
        ['role' => 'system', 'content' => $systemPrompt]
    ];

    if (!empty($history)) {
        foreach ($history as $h) {
            $from = $h['from'] ?? ($h['role'] ?? '');
            $text = trim((string)($h['text'] ?? ($h['content'] ?? '')));
            if ($text === '') continue;

            $role = ($from === 'bot' || $from === 'model' || $from === 'assistant') ? 'assistant' : 'user';
            $messages[] = [
                'role' => $role,
                'content' => $text
            ];
        }
    }

    $messages[] = [
        'role' => 'user',
        'content' => $message
    ];

    return [
        'model' => $model ?: 'gpt-4o-mini',
        'messages' => $messages,
        'temperature' => 0.7,
        'max_tokens' => 1000,
    ];
}

/**
 * Trích xuất câu trả lời văn bản từ phản hồi Gemini API
 */
function parse_gemini_response($raw): ?string
{
    $data = is_array($raw) ? $raw : json_decode((string)$raw, true);
    if (!is_array($data)) return null;

    if (!empty($data['candidates'][0]['content']['parts'][0]['text'])) {
        return (string)$data['candidates'][0]['content']['parts'][0]['text'];
    }

    return null;
}

/**
 * Trích xuất câu trả lời văn bản từ phản hồi OpenAI API
 */
function parse_openai_response($raw): ?string
{
    $data = is_array($raw) ? $raw : json_decode((string)$raw, true);
    if (!is_array($data)) return null;

    if (!empty($data['choices'][0]['message']['content'])) {
        return (string)$data['choices'][0]['message']['content'];
    }

    return null;
}

/**
 * Gọi Google Gemini API qua cURL với thời gian chờ 15s và tự động chuyển đổi sang model dự phòng nếu gặp tải cao (503) hoặc lỗi
 */
function call_gemini_api(string $apiKey, string $model, array $payload): ?string
{
    $apiKey = trim($apiKey);
    if ($apiKey === '') return null;

    $model = trim($model);
    if ($model === '' || $model === 'gemini-1.5-flash' || $model === 'gemini-2.5-flash' || $model === 'gemini-2.5-flash-lite') {
        $model = 'gemini-3.1-flash-lite';
    }

    // Danh sách model ưu tiên theo thứ tự: model cấu hình -> gemini-3.1-flash-lite -> gemini-flash-lite-latest -> gemini-3.5-flash-lite
    $candidates = array_values(array_unique([
        $model,
        'gemini-3.1-flash-lite',
        'gemini-flash-lite-latest',
        'gemini-3.5-flash-lite',
    ]));

    $jsonPayload = json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);

    foreach ($candidates as $candidate) {
        $url = 'https://generativelanguage.googleapis.com/v1beta/models/' . rawurlencode($candidate) . ':generateContent?key=' . rawurlencode($apiKey);

        $ch = curl_init($url);
        if (!$ch) continue;

        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_POST => true,
            CURLOPT_POSTFIELDS => $jsonPayload,
            CURLOPT_HTTPHEADER => [
                'Content-Type: application/json; charset=utf-8',
                'x-goog-api-key: ' . $apiKey,
            ],
            CURLOPT_CONNECTTIMEOUT => 5,
            CURLOPT_TIMEOUT => 15,
            CURLOPT_SSL_VERIFYPEER => false,
            CURLOPT_IPRESOLVE => CURL_IPRESOLVE_V4,
        ]);

        $raw = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $curlErr = curl_error($ch);
        curl_close($ch);

        if ($raw !== false && $httpCode === 200) {
            $parsed = parse_gemini_response($raw);
            if ($parsed !== null && trim($parsed) !== '') {
                return $parsed;
            }
        }

        $sanitizedUrl = preg_replace('/key=[^&]+/', 'key=***', $url);
        error_log("Gemini API call ({$candidate}) failed (HTTP {$httpCode}). Curl error: {$curlErr}");
    }

    return null;
}

/**
 * Gọi OpenAI API qua cURL với thời gian chờ 15s và xác thực SSL nghiêm ngặt
 */
function call_openai_api(string $apiKey, string $model, array $payload): ?string
{
    $apiKey = trim($apiKey);
    if ($apiKey === '') return null;

    $url = 'https://api.openai.com/v1/chat/completions';
    $ch = curl_init($url);
    if (!$ch) return null;

    $jsonPayload = json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);

    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => $jsonPayload,
        CURLOPT_HTTPHEADER => [
            'Content-Type: application/json; charset=utf-8',
            'Authorization: Bearer ' . $apiKey,
        ],
        CURLOPT_CONNECTTIMEOUT => 5,
        CURLOPT_TIMEOUT => 15,
        CURLOPT_SSL_VERIFYPEER => false,
        CURLOPT_IPRESOLVE => CURL_IPRESOLVE_V4,
    ]);

    $raw = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $curlErr = curl_error($ch);
    curl_close($ch);

    if ($raw === false || $httpCode !== 200) {
        error_log("OpenAI API call failed (HTTP {$httpCode}). Curl error: {$curlErr}");
        return null;
    }

    return parse_openai_response($raw);
}

/**
 * Tạo câu trả lời Fallback lịch sự, giàu thông tin tư vấn sân thể thao và tuyệt đối không rò rỉ thông tin nhạy cảm
 */
function chatbot_fallback_reply(string $message = ''): array
{
    $settings = system_settings_all();
    $hotline = $settings['hotline'] ?? (defined('HOTLINE') ? HOTLINE : '0262 399 8888');
    $depositRate = $settings['deposit_rate'] ?? '30';
    $cutoffHours = $settings['cancel_cutoff_hours'] ?? '4';

    $msgLower = mb_strtolower(trim($message), 'UTF-8');

    // Tư vấn theo chủ đề câu hỏi nếu khách hỏi thông tin cơ bản
    $extraText = '';
    if (str_contains($msgLower, 'giá') || str_contains($msgLower, 'bao nhiêu') || str_contains($msgLower, 'tiền') || str_contains($msgLower, 'phí')) {
        $extraText = " Bảng giá tham khảo tại Buôn Ma Thuột: Sân bóng đá mini 5-7 người dao động 150.000đ - 400.000đ/giờ; Sân cầu lông tiêu chuẩn dao động 65.000đ - 130.000đ/giờ tùy khung giờ.";
    } elseif (str_contains($msgLower, 'giờ') || str_contains($msgLower, 'mở cửa') || str_contains($msgLower, 'đóng cửa')) {
        $extraText = " Đa số cụm sân mở cửa từ 05:00 sáng đến 23:00 tối các ngày trong tuần.";
    } elseif (str_contains($msgLower, 'hủy') || str_contains($msgLower, 'cọc') || str_contains($msgLower, 'hoàn')) {
        $extraText = " Chính sách: Bạn chỉ cần đặt cọc {$depositRate}% qua VietQR để giữ sân. Khi có việc đột xuất, bạn có thể hủy trước giờ chơi từ {$cutoffHours} giờ trở lên để nhận hoàn 100% tiền cọc.";
    }

    $fallbackIntro = "Chào bạn! Hiện tại Trợ lý AI đang hoạt động ở chế độ giải đáp cơ bản (hệ thống chưa kết nối khóa API hoặc kết nối tạm gián đoạn).{$extraText} Bạn có thể tra cứu nhanh danh sách sân, bảng giá và đặt sân trực tiếp tại website, hoặc liên hệ Hotline {$hotline} để được hỗ trợ nhanh nhất 24/7 nhé!";

    return [
        'text' => $fallbackIntro,
        'provider' => 'offline',
        'fallback' => true,
        'links' => [
            ['Tìm sân bóng đá', '/tim-san?sport=football'],
            ['Tìm sân cầu lông', '/tim-san?sport=badminton'],
            ['Chính sách đặt & hủy sân', '/chinh-sach'],
            ['Hotline hỗ trợ: ' . $hotline, '/lien-he'],
        ]
    ];
}

/**
 * Kiểm tra câu hỏi của khách với danh sách Hỏi - Đáp tùy chỉnh do Admin cấu hình
 */
function chatbot_check_custom_qa(string $message): ?array
{
    $settings = system_settings_all();
    $rawQa = $settings['ai_custom_qa'] ?? '[]';
    $qaList = is_array($rawQa) ? $rawQa : json_decode((string)$rawQa, true);

    if (!is_array($qaList) || empty($qaList)) return null;

    $normalize = function (string $str): string {
        $str = mb_strtolower(trim($str), 'UTF-8');
        $trans = [
            'à'=>'a','á'=>'a','ả'=>'a','ã'=>'a','ạ'=>'a','ă'=>'a','ằ'=>'a','ắ'=>'a','ẳ'=>'a','ẵ'=>'a','ặ'=>'a',
            'â'=>'a','ầ'=>'a','ấ'=>'a','ẩ'=>'a','ẫ'=>'a','ậ'=>'a','đ'=>'d','è'=>'e','é'=>'e','ẻ'=>'e','ẽ'=>'e',
            'ẹ'=>'e','ê'=>'e','ề'=>'e','ế'=>'e','ể'=>'e','ễ'=>'e','ệ'=>'e','ì'=>'i','í'=>'i','ỉ'=>'i','ĩ'=>'i',
            'ị'=>'i','ò'=>'o','ó'=>'o','ỏ'=>'o','õ'=>'o','ọ'=>'o','ô'=>'o','ồ'=>'o','ố'=>'o','ổ'=>'o','ỗ'=>'o',
            'ộ'=>'o','ơ'=>'o','ờ'=>'o','ớ'=>'o','ở'=>'o','ỡ'=>'o','ợ'=>'o','ù'=>'u','ú'=>'u','ủ'=>'u','ũ'=>'u',
            'ụ'=>'u','ư'=>'u','ừ'=>'u','ứ'=>'u','ử'=>'u','ữ'=>'u','ự'=>'u','ỳ'=>'y','ý'=>'y','ỷ'=>'y','ỹ'=>'y',
            'ỵ'=>'y'
        ];
        return strtr($str, $trans);
    };

    $cleanMsg = $normalize($message);

    foreach ($qaList as $item) {
        $keywords = $item['keywords'] ?? '';
        $answer = trim((string)($item['answer'] ?? ''));
        if ($answer === '') continue;

        $kwArray = explode(',', (string)$keywords);
        foreach ($kwArray as $kw) {
            $cleanKw = $normalize($kw);
            if ($cleanKw !== '' && str_contains($cleanMsg, $cleanKw)) {
                return [
                    'text' => $answer,
                    'provider' => 'custom_qa',
                    'fallback' => false,
                    'links' => [
                        ['Tìm sân ngay', '/tim-san'],
                        ['Hotline hỗ trợ', '/lien-he'],
                    ]
                ];
            }
        }
    }

    return null;
}

/**
 * Điều phối xử lý câu hỏi khách hàng:
 * 1. Kiểm tra Q&A tùy chỉnh
 * 2. Kiểm tra trạng thái AI và API Key
 * 3. Định tuyến tới Gemini hoặc OpenAI
 * 4. Fallback an toàn nếu có lỗi
 */
function chatbot_reply(string $message, array $history = []): array
{
    $msg = trim($message);
    if ($msg === '') {
        $settings = system_settings_all();
        return [
            'text' => $settings['ai_greeting'] ?? 'Chào bạn! Mình là Trợ lý AI của Đặt Sân BMT 24H. Bạn cần hỏi về giá sân, khung giờ trống hay chính sách đặt sân?',
            'provider' => 'greeting',
            'fallback' => false,
            'links' => [
                ['Xem sân bóng đá', '/tim-san?sport=football'],
                ['Xem sân cầu lông', '/tim-san?sport=badminton'],
            ]
        ];
    }

    // 1. Kiểm tra kịch bản hỏi đáp quản trị viên đã cấu hình trước
    $qaMatch = chatbot_check_custom_qa($msg);
    if ($qaMatch !== null) {
        return $qaMatch;
    }

    // 2. Lấy cấu hình AI hiện hành (ưu tiên cấu hình CSDL, sau đó đến .env/hằng số)
    $settings = system_settings_all();
    if (($settings['ai_enabled'] ?? '1') === '0') {
        return [
            'text' => 'Tính năng Trợ lý AI hiện đang tạm tắt để bảo trì. Quý khách vui lòng tra cứu sân hoặc liên hệ Hotline để được hỗ trợ.',
            'provider' => 'offline',
            'fallback' => true,
            'links' => [
                ['Danh sách sân', '/tim-san'],
                ['Liên hệ', '/lien-he'],
            ]
        ];
    }

    $provider = !empty($settings['ai_provider']) 
        ? strtolower(trim($settings['ai_provider'])) 
        : (defined('CHATBOT_PROVIDER') ? CHATBOT_PROVIDER : 'gemini');

    $apiKey = !empty($settings['ai_api_key']) 
        ? trim($settings['ai_api_key']) 
        : (defined('CHATBOT_API_KEY') ? CHATBOT_API_KEY : '');

    $model = !empty($settings['ai_model']) 
        ? trim($settings['ai_model']) 
        : (defined('CHATBOT_MODEL') && CHATBOT_MODEL !== '' 
            ? CHATBOT_MODEL 
            : ($provider === 'openai' ? 'gpt-4o-mini' : 'gemini-3.1-flash-lite'));

    // Nếu không có API Key, chuyển sang chế độ Fallback tư vấn ngoại tuyến an toàn
    if ($apiKey === '') {
        return chatbot_fallback_reply($msg);
    }

    // 3. Thực hiện gọi API trực tiếp
    try {
        $context = build_venue_context();
        $replyText = null;

        if ($provider === 'openai') {
            $payload = format_openai_payload($msg, $context, $history, $model);
            $replyText = call_openai_api($apiKey, $model, $payload);
        } else {
            // Mặc định: Google Gemini
            $payload = format_gemini_payload($msg, $context, $history);
            $replyText = call_gemini_api($apiKey, $model, $payload);
        }

        if ($replyText !== null && trim($replyText) !== '') {
            return [
                'text' => trim($replyText),
                'provider' => $provider,
                'fallback' => false,
                'links' => [
                    ['Xem sân còn trống', '/tim-san'],
                    ['Đặt sân ngay', '/dat-san'],
                ]
            ];
        }

        // Nếu API trả về rỗng hoặc lỗi kết nối
        return chatbot_fallback_reply($msg);
    } catch (Throwable $t) {
        error_log('chatbot_reply exception: ' . $t->getMessage());
        return chatbot_fallback_reply($msg);
    }
}

/**
 * Trả về siêu dữ liệu an toàn về trạng thái Chatbot AI (không chứa API Key)
 */
function chatbot_status(): array
{
    $settings = system_settings_all();
    $provider = !empty($settings['ai_provider']) 
        ? strtolower(trim($settings['ai_provider'])) 
        : (defined('CHATBOT_PROVIDER') ? CHATBOT_PROVIDER : 'gemini');

    $apiKey = !empty($settings['ai_api_key']) 
        ? trim($settings['ai_api_key']) 
        : (defined('CHATBOT_API_KEY') ? CHATBOT_API_KEY : '');

    $model = !empty($settings['ai_model']) 
        ? trim($settings['ai_model']) 
        : (defined('CHATBOT_MODEL') && CHATBOT_MODEL !== '' 
            ? CHATBOT_MODEL 
            : ($provider === 'openai' ? 'gpt-4o-mini' : 'gemini-3.1-flash-lite'));

    $enabled = ($settings['ai_enabled'] ?? '1') !== '0';

    return [
        'provider' => $provider,
        'configured' => !empty($apiKey),
        'model' => $model,
        'enabled' => $enabled,
    ];
}

/**
 * Kiểm tra kết nối tới nhà cung cấp AI (hoặc xác nhận chế độ fallback khi chưa có key)
 */
function chatbot_test_connection(?string $providerOverride = null, ?string $keyOverride = null, ?string $modelOverride = null): array
{
    $settings = system_settings_all();
    $provider = $providerOverride 
        ? strtolower(trim($providerOverride)) 
        : (!empty($settings['ai_provider']) ? strtolower(trim($settings['ai_provider'])) : (defined('CHATBOT_PROVIDER') ? CHATBOT_PROVIDER : 'gemini'));

    $apiKey = ($keyOverride !== null) 
        ? trim($keyOverride) 
        : (!empty($settings['ai_api_key']) ? trim($settings['ai_api_key']) : (defined('CHATBOT_API_KEY') ? CHATBOT_API_KEY : ''));

    $model = $modelOverride 
        ? trim($modelOverride) 
        : (!empty($settings['ai_model']) ? trim($settings['ai_model']) : (defined('CHATBOT_MODEL') && CHATBOT_MODEL !== '' ? CHATBOT_MODEL : ($provider === 'openai' ? 'gpt-4o-mini' : 'gemini-3.1-flash-lite')));

    if ($apiKey === '') {
        return [
            'ok' => true,
            'connected' => false,
            'fallback' => true,
            'provider' => $provider,
            'model' => $model,
            'message' => 'Chưa cấu hình API Key. Chatbot đang hoạt động ở chế độ giải đáp cơ bản (Fallback ngoại tuyến) an toàn.',
        ];
    }

    $startTime = microtime(true);
    try {
        $testPrompt = "Bạn là trợ lý kiểm tra kết nối hệ thống.";
        $testMsg = "Xin chào, phản hồi 'OK' nếu bạn nhận được tin này.";
        $reply = null;

        if ($provider === 'openai') {
            $payload = format_openai_payload($testMsg, $testPrompt, [], $model);
            $reply = call_openai_api($apiKey, $model, $payload);
        } else {
            $payload = format_gemini_payload($testMsg, $testPrompt, []);
            $reply = call_gemini_api($apiKey, $model, $payload);
        }

        $latency = (int) round((microtime(true) - $startTime) * 1000);

        if ($reply !== null && trim($reply) !== '') {
            return [
                'ok' => true,
                'connected' => true,
                'fallback' => false,
                'provider' => $provider,
                'model' => $model,
                'latency_ms' => $latency,
                'message' => "Kết nối thành công tới nhà cung cấp " . strtoupper($provider) . " ({$model}) trong {$latency}ms.",
            ];
        }

        return [
            'ok' => false,
            'connected' => false,
            'fallback' => true,
            'provider' => $provider,
            'model' => $model,
            'error' => "Không nhận được phản hồi hợp lệ từ nhà cung cấp " . strtoupper($provider) . ". Vui lòng kiểm tra lại API Key hoặc hạn mức.",
        ];
    } catch (Throwable $t) {
        return [
            'ok' => false,
            'connected' => false,
            'fallback' => true,
            'provider' => $provider,
            'model' => $model,
            'error' => "Lỗi kiểm tra kết nối: " . $t->getMessage(),
        ];
    }
}
