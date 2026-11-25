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
if (file_exists(__DIR__ . '/data.php')) {
    require_once __DIR__ . '/data.php';
}

/**
 * Trích xuất ngữ cảnh kiến thức sân thể thao, khuyến mãi, dịch vụ và chính sách từ CSDL thời gian thực
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
        $lines[] = "THÔNG TIN NỀN TẢNG & CHÍNH SÁCH (DỮ LIỆU CSDL THỜI GIAN THỰC - NGÀY " . date('d/m/Y') . "):";
        $lines[] = "- Hotline hỗ trợ 24/7: {$hotline}";
        $lines[] = "- Khu vực hoạt động: {$siteAddress}";
        $lines[] = "- Chính sách cọc giữ chỗ: {$depositRate}% tổng tiền sân qua chuyển khoản VietQR (thời gian giữ chỗ thanh toán: {$holdMinutes} phút).";
        $lines[] = "- Chính sách hủy sân: Hoàn 100% tiền cọc khi hủy trước giờ chơi từ {$cutoffHours} giờ trở lên. Dưới {$cutoffHours} giờ tính năng hủy online sẽ tự động khóa, khách hàng cần liên hệ hotline để được hỗ trợ.";
        if ($generalPolicy) {
            $lines[] = "- Lưu ý quy định: " . trim(preg_replace('/\s+/', ' ', $generalPolicy));
        }

        // Các tính năng chính thức đang có trên website
        $totalSpins = (int) q_val("SELECT COUNT(*) FROM wheel_spins");
        $lines[] = "";
        $lines[] = "CÁC TÍNH NĂNG ĐÃ TÍCH HỢP SẴN TRÊN WEBSITE (TUYỆT ĐỐI KHÔNG NÓI LÀ CHƯA CÓ):";
        $lines[] = "• Vòng quay ưu đãi (/uu-dai#vong-quay): ĐÃ CÓ SẴN trên website! Khách hàng đã đăng nhập được quay miễn phí 1 lượt mỗi 48 giờ (hệ thống đã ghi nhận {$totalSpins} lượt quay). Các phần thưởng trên vòng quay gồm: QUAY10 (Giảm 10% đơn từ 100k), QUAY20K (Voucher 20.000đ), NUOCFREE (Tặng 2 chai nước suối), QUAY15 (Giảm 15% giờ vàng 05:00-16:00), QUAY50K (Voucher VIP 50.000đ đơn từ 300k), THEM30P (Tặng 30 phút chơi thêm). Mã trúng thưởng tự động lưu vào Tài khoản → Ví voucher (/tai-khoan?tab=vouchers), hiệu lực 48 giờ.";
        $lines[] = "• Săn mã giảm giá & Khuyến mãi (/uu-dai): Xem, kiểm tra điều kiện và lưu mã về Ví voucher trước khi đặt sân.";
        $lines[] = "• Đặt lịch cố định hàng tuần (/tai-khoan?tab=recurring): Đăng ký giữ sân dài hạn cố định theo thứ trong tuần.";
        $lines[] = "• Ngẫu nhiên & Chia đội (/ngau-nhien): Chia đội hình cân bằng, ghép cặp và chọn sân may mắn.";
        $lines[] = "• Bản đồ sân (/ban-do): Xem trực quan vị trí toàn bộ sân quanh Buôn Ma Thuột.";
        $lines[] = "• Tìm sân (/tim-san), Sân yêu thích & Ví voucher (/tai-khoan).";

        // 1. Đọc danh sách sân thể thao thực tế từ CSDL
        $courts = q_all("SELECT id, name, sport, sport_label, area, address, price_per_hour, peak_price, open_time, close_time, field_types, rating, review_count
                         FROM courts
                         WHERE deleted_at IS NULL AND status = 'active'
                         ORDER BY sort_order ASC, name ASC");

        $footballPrices = [];
        $badmintonPrices = [];
        $courtNamesById = [];

        $lines[] = "";
        $lines[] = "DANH SÁCH SÂN VÀ GIÁ TẠI BUÔN MA THUỘT (" . count($courts) . " cụm sân đang hoạt động):";

        if (!empty($courts)) {
            foreach ($courts as $c) {
                $courtNamesById[$c['id']] = $c['name'];
                $isBadminton = ($c['sport'] === 'badminton');
                $sport = $c['sport_label'] ?: ($isBadminton ? 'Cầu lông' : 'Bóng đá');
                $pBase = (int) $c['price_per_hour'];
                $pPeak = (int) $c['peak_price'];
                if ($isBadminton) {
                    $badmintonPrices[] = $pBase;
                    if ($pPeak > 0) $badmintonPrices[] = $pPeak;
                } else {
                    $footballPrices[] = $pBase;
                    if ($pPeak > 0) $footballPrices[] = $pPeak;
                }

                $priceStr = number_format($pBase, 0, ',', '.') . 'đ/h';
                if ($pPeak > $pBase) {
                    $priceStr .= ' (Cao điểm: ' . number_format($pPeak, 0, ',', '.') . 'đ/h)';
                }
                $hours = ($c['open_time'] ?: '05:00') . '-' . ($c['close_time'] ?: '23:00');
                $typesArr = json_decode((string)($c['field_types'] ?? '[]'), true);
                $typeLabels = [];
                if (is_array($typesArr)) {
                    foreach ($typesArr as $ft) {
                        if (!empty($ft['label'])) $typeLabels[] = $ft['label'];
                    }
                }
                $typeInfo = !empty($typeLabels) ? (' | Loại: ' . implode(', ', array_slice($typeLabels, 0, 3))) : '';
                $ratingInfo = ((float)$c['rating'] > 0) ? (" | Đánh giá: {$c['rating']}★ ({$c['review_count']})") : '';
                $lines[] = "• {$c['name']} ({$sport} - {$c['area']}, {$c['address']}): {$priceStr} | Mở cửa: {$hours}{$typeInfo}{$ratingInfo}";
            }
        } else {
            $lines[] = "• Hệ thống đang cập nhật danh sách sân hoạt động tại Buôn Ma Thuột.";
        }

        if (!empty($footballPrices) || !empty($badmintonPrices)) {
            $rangeParts = [];
            if (!empty($footballPrices)) {
                $rangeParts[] = 'Bóng đá: ' . number_format(min($footballPrices), 0, ',', '.') . 'đ - ' . number_format(max($footballPrices), 0, ',', '.') . 'đ/h';
            }
            if (!empty($badmintonPrices)) {
                $rangeParts[] = 'Cầu lông: ' . number_format(min($badmintonPrices), 0, ',', '.') . 'đ - ' . number_format(max($badmintonPrices), 0, ',', '.') . 'đ/h';
            }
            $lines[] = "→ Khoảng giá thực tế trong CSDL: " . implode('; ', $rangeParts) . ".";
        }

        // 2. Đọc tình trạng đặt sân & khóa giờ hôm nay (khung giờ tối 17:00 trở đi)
        $today = date('Y-m-d');
        $todayBookings = q_all(
            "SELECT court_id, slots FROM bookings WHERE booking_date = ? AND status <> 'cancelled'",
            [$today]
        );
        $todayBlocked = q_all(
            "SELECT court_id, slot FROM blocked_slots WHERE block_date = ?",
            [$today]
        );
        $bookedEveningByCourt = [];
        foreach ($todayBookings as $tb) {
            $cid = $tb['court_id'];
            $slots = json_decode((string)($tb['slots'] ?? '[]'), true);
            if (!is_array($slots)) continue;
            foreach ($slots as $sl) {
                if (strcmp((string)$sl, '17:00') >= 0) {
                    $bookedEveningByCourt[$cid][] = $sl;
                }
            }
        }
        foreach ($todayBlocked as $blk) {
            $cid = $blk['court_id'];
            $sl = (string)$blk['slot'];
            if (strcmp($sl, '17:00') >= 0) {
                $bookedEveningByCourt[$cid][] = $sl;
            }
        }
        $lines[] = "";
        $lines[] = "TÌNH TRẠNG ĐẶT SÂN HÔM NAY ({$today}):";
        if (empty($bookedEveningByCourt)) {
            $lines[] = "• Hầu hết các cụm sân vẫn còn rất nhiều khung giờ trống (kể cả buổi tối 17:00 - 22:00). Khách có thể vào trang Đặt sân để xem chi tiết từng sân con theo thời gian thực.";
        } else {
            $busyNotes = [];
            foreach ($bookedEveningByCourt as $cid => $sls) {
                $cname = $courtNamesById[$cid] ?? $cid;
                $uniqueSls = array_values(array_unique($sls));
                sort($uniqueSls);
                $busyNotes[] = "{$cname} đã có lịch ở khung: " . implode(', ', array_slice($uniqueSls, 0, 5));
            }
            $lines[] = "• Một số khung giờ tối đã có đơn đặt: " . implode('; ', $busyNotes) . ". Các khung giờ khác và các sân còn lại vẫn đang mở đặt trực tiếp trên web.";
        }

        // 3. Đọc danh sách khuyến mãi / voucher đang chạy từ CSDL
        $promos = q_all(
            "SELECT code, title, description, discount_type, discount_value, max_discount, min_order, start_date, end_date, weekdays, start_time, end_time, usage_limit, owner_name
             FROM promotions
             WHERE status = 'active' AND (end_date IS NULL OR end_date >= CURDATE())
             ORDER BY created_at DESC"
        );
        $lines[] = "";
        $lines[] = "MÃ GIẢM GIÁ & KHUYẾN MÃI ĐANG HOẠT ĐỘNG TRONG CSDL:";
        $hasPromo = false;
        foreach ($promos as $p) {
            // Bỏ qua mã kiểm thử nội bộ nếu có
            if (stripos((string)$p['title'], 'test') !== false && stripos((string)$p['code'], 'LIMITCD') === 0) {
                continue;
            }
            $hasPromo = true;
            $discStr = $p['discount_type'] === 'percent'
                ? ("Giảm {$p['discount_value']}%" . (!empty($p['max_discount']) ? " (tối đa " . number_format((int)$p['max_discount'], 0, ',', '.') . "đ)" : ""))
                : ("Giảm " . number_format((int)$p['discount_value'], 0, ',', '.') . "đ");
            $conds = [];
            if ((int)$p['min_order'] > 0) {
                $conds[] = "đơn từ " . number_format((int)$p['min_order'], 0, ',', '.') . "đ";
            }
            if (!empty($p['start_time']) && !empty($p['end_time'])) {
                $conds[] = "khung {$p['start_time']}-{$p['end_time']}";
            }
            $remainStr = '';
            if (!empty($p['usage_limit']) && function_exists('promo_claimed_count')) {
                $rem = max(0, (int)$p['usage_limit'] - promo_claimed_count($p['code']));
                $remainStr = " | Còn {$rem}/{$p['usage_limit']} lượt";
            }
            $scope = !empty($p['owner_name']) ? $p['owner_name'] : 'Toàn hệ thống';
            $condText = !empty($conds) ? (' (' . implode(', ', $conds) . ')') : '';
            $lines[] = "• Mã {$p['code']}: {$p['title']} — {$discStr}{$condText} | Áp dụng: {$scope} | HSD: {$p['end_date']}{$remainStr}";
        }
        if (!$hasPromo) {
            $lines[] = "• Hiện chưa có mã khuyến mãi công khai mới, khách hàng có thể quay Vòng quay ưu đãi tại /uu-dai#vong-quay để nhận mã.";
        }

        // 4. Đọc dịch vụ & tiện ích đi kèm từ CSDL
        $services = q_all("SELECT name, category, sport, unit, price, stock FROM owner_services WHERE active = 1 ORDER BY sort_order ASC, name ASC LIMIT 15");
        if (!empty($services)) {
            $svcList = [];
            foreach ($services as $sv) {
                $svcList[] = "{$sv['name']} (" . number_format((int)$sv['price'], 0, ',', '.') . "đ/{$sv['unit']})";
            }
            $lines[] = "";
            $lines[] = "DỊCH VỤ & TIỆN ÍCH ĐI KÈM TẠI SÂN:";
            $lines[] = "• " . implode(', ', $svcList) . ".";
        }

        $lines[] = "";
        $lines[] = "QUY TẮC TƯ VẤN (BẮT BUỘC):";
        $lines[] = "1. CHỈ TRẢ LỜI DỰA TRÊN DỮ LIỆU THỰC TẾ Ở TRÊN. Tuyệt đối không bịa đặt hoặc phủ nhận những tính năng đã ghi ở mục TÍNH NĂNG ĐÃ TÍCH HỢP (như Vòng quay ưu đãi, Ví voucher, Lịch cố định, Ngẫu nhiên chia đội, Bản đồ sân).";
        $lines[] = "2. TUYỆT ĐỐI KHÔNG tự bịa ra tên miền hay đường dẫn web dạng https://... (vì hệ thống không dùng tên miền cố định đó). Khi hướng dẫn khách mở trang, chỉ nêu tên mục trên website (ví dụ: mục Ưu đãi → Vòng quay ưu đãi, hoặc Tài khoản → Ví voucher) và nhắc khách bấm vào nút gợi ý bên dưới.";
        $lines[] = "3. Trả lời bằng tiếng Việt tự nhiên, NGẮN GỌN, SÚC TÍCH, đúng trọng tâm câu hỏi (dưới 150 từ).";
        $lines[] = "4. Khi khách hỏi giá hoặc tìm sân nói chung: nêu đúng khoảng giá thực tế từ CSDL theo từng môn và chọn gợi ý 3-4 sân tiêu biểu; nếu hỏi 1 sân/khu vực cụ thể thì nêu đầy đủ giá, địa chỉ, giờ mở cửa của sân đó.";
        $lines[] = "5. Khi khách hỏi về Vòng quay ưu đãi hoặc mã giảm giá: khẳng định website đã có sẵn tính năng tại mục Ưu đãi → Vòng quay ưu đãi, nêu rõ thể lệ (mỗi 48h quay 1 lần khi đăng nhập), các phần thưởng (QUAY10, QUAY20K, QUAY50K, NUOCFREE, QUAY15, THEM30P) và giới thiệu ngắn 2-3 mã khuyến mãi đang chạy ở trên.";
        $lines[] = "6. Luôn kết thúc câu trả lời hoàn chỉnh, mời khách đặt sân hoặc liên hệ Hotline {$hotline}.";

        return implode("\n", $lines);
    } catch (Throwable $e) {
        error_log('build_venue_context error: ' . $e->getMessage());
        return "Bạn là Trợ lý AI tư vấn đặt sân thể thao Đặt Sân BMT 24H. Hotline: 0262 399 8888. Hỗ trợ đặt sân bóng đá và cầu lông tại Buôn Ma Thuột. Chính sách cọc 30% qua VietQR, hủy trước 4 giờ hoàn cọc 100%. Website có tính năng Vòng quay ưu đãi tại /uu-dai#vong-quay (quay mỗi 48h nhận voucher). Sân bóng BMT Arena giá 180.000đ/h.";
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
            'temperature' => 0.4,
            'maxOutputTokens' => 2048,
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

    $parts = $data['candidates'][0]['content']['parts'] ?? null;
    if (is_array($parts) && !empty($parts)) {
        $texts = [];
        foreach ($parts as $p) {
            if (isset($p['text']) && empty($p['thought'])) {
                $texts[] = (string)$p['text'];
            }
        }
        $combined = trim(implode('', $texts));
        if ($combined !== '') {
            return $combined;
        }
    }

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
 * Gọi Google Gemini API qua cURL với thời gian chờ tối ưu (kết nối <= 3s, timeout <= 6s)
 * Thoát ngay lập tức nếu mạng bị timeout để chuyển sang Fallback ngoại tuyến, không làm treo giao diện.
 */
function call_gemini_api(string $apiKey, string $model, array $payload): ?string
{
    $apiKey = trim($apiKey);
    if ($apiKey === '') return null;

    $model = trim($model);
    if ($model === '' || $model === 'gemini-1.5-flash' || $model === 'gemini-2.5-flash-lite') {
        $model = 'gemini-flash-lite-latest';
    }

    $candidates = array_values(array_unique([
        $model,
        'gemini-flash-lite-latest',
        'gemini-3.5-flash-lite',
        'gemini-flash-latest',
    ]));

    $jsonPayload = json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);

    foreach ($candidates as $idx => $candidate) {
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
            CURLOPT_HTTP_VERSION => CURL_HTTP_VERSION_1_1,
            CURLOPT_CONNECTTIMEOUT => 4,
            CURLOPT_TIMEOUT => 18,
            CURLOPT_SSL_VERIFYPEER => false,
            CURLOPT_IPRESOLVE => CURL_IPRESOLVE_V4,
            CURLOPT_NOSIGNAL => 1,
        ]);

        $raw = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $curlErr = curl_error($ch);

        // Nếu Google trả về 503 (tải cao nhất thời), tạm dừng 400ms rồi thử lại 1 lần chính candidate này
        if ($httpCode === 503) {
            usleep(400000);
            $rawRetry = curl_exec($ch);
            $retryCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
            if ($rawRetry !== false && $retryCode === 200) {
                $raw = $rawRetry;
                $httpCode = $retryCode;
            }
        }
        curl_close($ch);

        if ($raw !== false && $httpCode === 200) {
            $parsed = parse_gemini_response($raw);
            if ($parsed !== null && trim($parsed) !== '') {
                return $parsed;
            }
        }

        $sanitizedUrl = preg_replace('/key=[^&]+/', 'key=***', $url);
        error_log("Gemini API call ({$candidate}) failed (HTTP {$httpCode}). Curl error: {$curlErr}");

        // Nếu timeout do mạng nghẽn hoàn toàn, dừng sớm
        if ($curlErr && (str_contains($curlErr, 'timed out') || str_contains($curlErr, 'timeout'))) {
            break;
        }

        // Thử tối đa 2 model hợp lệ
        if ($idx >= 2) break;
    }

    return null;
}

/**
 * Gọi OpenAI API qua cURL với thời gian chờ tối ưu (kết nối <= 3s, timeout <= 6s)
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
        CURLOPT_CONNECTTIMEOUT => 3, // Giảm từ 5s xuống 3s
        CURLOPT_TIMEOUT => 6,        // Giảm từ 15s xuống 6s
        CURLOPT_SSL_VERIFYPEER => false,
        CURLOPT_IPRESOLVE => CURL_IPRESOLVE_V4,
        CURLOPT_NOSIGNAL => 1,
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

    // Tư vấn theo chủ đề câu hỏi từ dữ liệu CSDL nếu kết nối AI bị gián đoạn
    $extraText = '';
    if (str_contains($msgLower, 'vòng quay') || str_contains($msgLower, 'ưu đãi') || str_contains($msgLower, 'voucher') || str_contains($msgLower, 'mã giảm') || str_contains($msgLower, 'khuyến mãi')) {
        $promoCodes = [];
        try {
            $activePromos = q_all("SELECT code, title FROM promotions WHERE status = 'active' AND (end_date IS NULL OR end_date >= CURDATE()) ORDER BY created_at DESC LIMIT 4");
            foreach ($activePromos as $ap) {
                if (stripos((string)$ap['title'], 'test') === false) {
                    $promoCodes[] = $ap['code'];
                }
            }
        } catch (Throwable $e) {}
        $codesNote = !empty($promoCodes) ? (' Các mã nổi bật đang chạy: ' . implode(', ', $promoCodes) . '.') : '';
        $extraText = " Website đã tích hợp Vòng quay ưu đãi tại mục Ưu đãi (/uu-dai#vong-quay): bạn có thể quay 1 lượt mỗi 48 giờ khi đăng nhập để nhận voucher giảm giá (QUAY10, QUAY20K, QUAY50K, NUOCFREE...) lưu thẳng vào Ví voucher.{$codesNote}";
    } elseif (str_contains($msgLower, 'giá') || str_contains($msgLower, 'bao nhiêu') || str_contains($msgLower, 'tiền') || str_contains($msgLower, 'phí')) {
        $extraText = " Bảng giá tham khảo tại Buôn Ma Thuột: Sân bóng đá mini 5-7 người dao động 150.000đ - 400.000đ/giờ; Sân cầu lông tiêu chuẩn dao động 65.000đ - 130.000đ/giờ tùy khung giờ.";
    } elseif (str_contains($msgLower, 'giờ') || str_contains($msgLower, 'mở cửa') || str_contains($msgLower, 'đóng cửa')) {
        $extraText = " Đa số cụm sân mở cửa từ 05:00 sáng đến 23:00 tối các ngày trong tuần.";
    } elseif (str_contains($msgLower, 'hủy') || str_contains($msgLower, 'cọc') || str_contains($msgLower, 'hoàn')) {
        $extraText = " Chính sách: Bạn chỉ cần đặt cọc {$depositRate}% qua VietQR để giữ sân. Khi có việc đột xuất, bạn có thể hủy trước giờ chơi từ {$cutoffHours} giờ trở lên để nhận hoàn 100% tiền cọc.";
    }

    $fallbackIntro = "Chào bạn! Hiện tại Trợ lý AI đang hoạt động ở chế độ giải đáp cơ bản (bị kết nối gián đoạn).{$extraText} Bạn có thể tra cứu nhanh danh sách sân, bảng giá và đặt sân trực tiếp tại website, hoặc liên hệ Hotline {$hotline} để được hỗ trợ nhanh nhất 24/7 nhé!";

    $links = [
        ['Tìm sân bóng đá', '/tim-san?sport=football'],
        ['Tìm sân cầu lông', '/tim-san?sport=badminton'],
        ['Vòng quay & Ưu đãi', '/uu-dai#vong-quay'],
        ['Chính sách đặt & hủy sân', '/chinh-sach'],
        ['Hotline hỗ trợ: ' . $hotline, '/lien-he'],
    ];

    return [
        'text' => $fallbackIntro,
        'provider' => 'offline',
        'fallback' => true,
        'links' => $links,
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
            : ($provider === 'openai' ? 'gpt-4o-mini' : 'gemini-flash-lite-latest'));

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
            $msgLower = mb_strtolower($msg, 'UTF-8');
            $links = [
                ['Xem sân còn trống', '/tim-san'],
                ['Đặt sân ngay', '/dat-san'],
            ];
            if (str_contains($msgLower, 'vòng quay') || str_contains($msgLower, 'ưu đãi') || str_contains($msgLower, 'voucher') || str_contains($msgLower, 'mã giảm') || str_contains($msgLower, 'khuyến mãi')) {
                array_unshift($links, ['Mở Vòng quay ưu đãi', '/uu-dai#vong-quay']);
            }
            return [
                'text' => trim($replyText),
                'provider' => $provider,
                'fallback' => false,
                'links' => $links,
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
            : ($provider === 'openai' ? 'gpt-4o-mini' : 'gemini-flash-lite-latest'));

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
        : (!empty($settings['ai_model']) ? trim($settings['ai_model']) : (defined('CHATBOT_MODEL') && CHATBOT_MODEL !== '' ? CHATBOT_MODEL : ($provider === 'openai' ? 'gpt-4o-mini' : 'gemini-flash-lite-latest')));

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
