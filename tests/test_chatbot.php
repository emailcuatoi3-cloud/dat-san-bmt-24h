<?php
/**
 * TẬP LỆNH KIỂM THỬ TỰ ĐỘNG CHATBOT AI — ĐẶT SÂN BMT 24H
 * Chạy từ dòng lệnh CLI:
 * E:\laragon\bin\php\php-8.3.36-Win32-vs16-x64\php.exe tests/test_chatbot.php
 */

error_reporting(E_ALL);
ini_set('display_errors', '1');

require_once __DIR__ . '/../includes/bootstrap.php';
require_once __DIR__ . '/../includes/chatbot.php';

$testsPassed = 0;
$testsFailed = 0;

function assert_test(string $name, bool $condition, string $detail = ''): void
{
    global $testsPassed, $testsFailed;
    if ($condition) {
        echo "  [PASS] {$name}\n";
        $testsPassed++;
    } else {
        echo "  [FAIL] {$name}" . ($detail ? " — {$detail}" : '') . "\n";
        $testsFailed++;
    }
}

echo "====================================================================\n";
echo "   BẮT ĐẦU KIỂM THỬ TỰ ĐỘNG CHATBOT AI (GEMINI & OPENAI & FALLBACK)\n";
echo "====================================================================\n\n";

// ---------------------------------------------------------------------
// TEST 1: Kiểm tra cơ chế Fallback ngoại tuyến khi CHATBOT_API_KEY rỗng/chưa cấu hình
// ---------------------------------------------------------------------
echo "[1] KIỂM TRA CHẾ ĐỘ FALLBACK NGOẠI TUYẾN & BẢO MẬT KHÓA API...\n";

$fallbackRes = chatbot_fallback_reply("Giá thuê sân bóng đá là bao nhiêu?");
assert_test("Fallback trả về cờ fallback = true", ($fallbackRes['fallback'] ?? false) === true);
assert_test("Fallback trả về provider = offline", ($fallbackRes['provider'] ?? '') === 'offline');
assert_test("Nội dung tư vấn fallback đầy đủ (>50 ký tự)", mb_strlen($fallbackRes['text'] ?? '') > 50);
assert_test("Nội dung tư vấn fallback chứa thông tin giá tham khảo", str_contains($fallbackRes['text'], '150.000') || str_contains($fallbackRes['text'], 'giá'));
assert_test("Fallback cung cấp danh sách liên kết điều hướng", is_array($fallbackRes['links'] ?? null) && count($fallbackRes['links']) >= 3);
assert_test("Fallback có liên kết tìm sân bóng đá", in_array(['Tìm sân bóng đá', '/tim-san?sport=football'], $fallbackRes['links'], true));
assert_test("Fallback có liên kết tìm sân cầu lông", in_array(['Tìm sân cầu lông', '/tim-san?sport=badminton'], $fallbackRes['links'], true));

// Kiểm tra rò rỉ thông tin nhạy cảm
$leakedSensitives = ['Exception', 'API_KEY', 'DB_PASS', 'datsan_bmt24h', 'root', 'Stack trace', 'SQLSTATE'];
$leakFound = false;
foreach ($leakedSensitives as $sens) {
    if (str_contains($fallbackRes['text'], $sens)) {
        $leakFound = true;
        break;
    }
}
assert_test("Tuyệt đối không rò rỉ khóa API, ngoại lệ hay mật khẩu CSDL", !$leakFound);

// Kiểm tra chatbot_reply với câu hỏi giờ mở cửa khi chưa có key
$hoursReply = chatbot_fallback_reply("Mấy giờ sân mở cửa và đóng cửa?");
assert_test("Fallback trả lời đúng câu hỏi giờ mở cửa", str_contains($hoursReply['text'], '05:00') && str_contains($hoursReply['text'], '23:00'));

// ---------------------------------------------------------------------
// TEST 2: Kiểm tra trích xuất ngữ cảnh thời gian thực từ CSDL MySQL (PDO)
// ---------------------------------------------------------------------
echo "\n[2] KIỂM TRA TRÍCH XUẤT NGỮ CẢNH SÂN THỂ THAO TỪ CSDL (PDO)...\n";

$context = build_venue_context();
assert_test("Ngữ cảnh được sinh ra thành công (>200 ký tự)", mb_strlen($context) > 200);
assert_test("Ngữ cảnh chứa tên nền tảng (SITE_NAME)", str_contains($context, SITE_NAME));
assert_test("Ngữ cảnh chứa Hotline hỗ trợ (HOTLINE)", str_contains($context, HOTLINE));
assert_test("Ngữ cảnh chứa tỷ lệ cọc (30% hoặc DEPOSIT_RATE)", str_contains($context, '30%') || str_contains($context, 'cọc'));
assert_test("Ngữ cảnh chứa chính sách hủy sân (4 giờ)", str_contains($context, '4') && str_contains($context, 'hủy'));

// Kiểm tra tên các sân thực tế trong CSDL
$activeCourts = q_all("SELECT name, price_per_hour FROM courts WHERE deleted_at IS NULL AND status = 'active' LIMIT 3");
if (!empty($activeCourts)) {
    $firstCourt = $activeCourts[0];
    assert_test("Ngữ cảnh chứa tên sân thực tế từ CSDL ('{$firstCourt['name']}')", str_contains($context, $firstCourt['name']));
    assert_test("Ngữ cảnh chứa đơn vị giá (đ/h)", str_contains($context, 'đ/h'));
} else {
    echo "  [WARN] Bảng courts hiện không có sân active, kiểm tra fallback context.\n";
}

// Kiểm tra hàm bí danh tương thích
$aliasContext = build_chatbot_context();
assert_test("Bí danh build_chatbot_context() trả về kết quả đồng nhất", $aliasContext === $context);

// ---------------------------------------------------------------------
// TEST 3: Kiểm tra định dạng Payload cho Google Gemini API
// ---------------------------------------------------------------------
echo "\n[3] KIỂM TRA ĐỊNH DẠNG PAYLOAD GOOGLE GEMINI API...\n";

$mockHistory = [
    ['from' => 'user', 'text' => 'Xin chào'],
    ['from' => 'bot', 'text' => 'Chào bạn! Mình có thể giúp gì cho bạn?'],
];
$geminiPayload = format_gemini_payload("Tư vấn sân cầu lông Tân Lợi", $context, $mockHistory);

assert_test("Gemini payload có trường system_instruction", isset($geminiPayload['system_instruction']['parts'][0]['text']));
assert_test("Gemini system_instruction chứa toàn bộ ngữ cảnh sân", $geminiPayload['system_instruction']['parts'][0]['text'] === $context);
assert_test("Gemini contents là mảng có 3 phần tử (2 history + 1 hiện tại)", is_array($geminiPayload['contents']) && count($geminiPayload['contents']) === 3);
assert_test("Lịch sử câu hỏi người dùng có vai trò 'user'", ($geminiPayload['contents'][0]['role'] ?? '') === 'user');
assert_test("Lịch sử câu trả lời bot được ánh xạ thành vai trò 'model'", ($geminiPayload['contents'][1]['role'] ?? '') === 'model');
assert_test("Tin nhắn hiện tại của người dùng có vai trò 'user'", ($geminiPayload['contents'][2]['role'] ?? '') === 'user');
assert_test("Nội dung tin nhắn hiện tại khớp câu hỏi", ($geminiPayload['contents'][2]['parts'][0]['text'] ?? '') === 'Tư vấn sân cầu lông Tân Lợi');
assert_test("Cấu hình thế hệ (generationConfig) chỉ định temperature và maxOutputTokens", 
    isset($geminiPayload['generationConfig']['temperature']) && isset($geminiPayload['generationConfig']['maxOutputTokens']));

// ---------------------------------------------------------------------
// TEST 4: Kiểm tra định dạng Payload cho OpenAI API
// ---------------------------------------------------------------------
echo "\n[4] KIỂM TRA ĐỊNH DẠNG PAYLOAD OPENAI API...\n";

$openaiPayload = format_openai_payload("Tư vấn sân bóng đá cỏ nhân tạo", $context, $mockHistory, 'gpt-4o-mini');

assert_test("OpenAI payload chỉ định đúng model (gpt-4o-mini)", ($openaiPayload['model'] ?? '') === 'gpt-4o-mini');
assert_test("OpenAI messages là mảng gồm 4 phần tử (1 system + 2 history + 1 hiện tại)", is_array($openaiPayload['messages']) && count($openaiPayload['messages']) === 4);
assert_test("OpenAI message 0 có vai trò 'system' chứa ngữ cảnh", ($openaiPayload['messages'][0]['role'] ?? '') === 'system' && $openaiPayload['messages'][0]['content'] === $context);
assert_test("OpenAI message 1 có vai trò 'user'", ($openaiPayload['messages'][1]['role'] ?? '') === 'user');
assert_test("OpenAI message 2 có vai trò 'assistant'", ($openaiPayload['messages'][2]['role'] ?? '') === 'assistant');
assert_test("OpenAI message 3 có vai trò 'user' chứa câu hỏi hiện tại", ($openaiPayload['messages'][3]['role'] ?? '') === 'user' && $openaiPayload['messages'][3]['content'] === 'Tư vấn sân bóng đá cỏ nhân tạo');
assert_test("OpenAI chỉ định temperature và max_tokens", isset($openaiPayload['temperature']) && isset($openaiPayload['max_tokens']));

// ---------------------------------------------------------------------
// TEST 5: Kiểm tra bộ phân giải phản hồi (Response Parsers)
// ---------------------------------------------------------------------
echo "\n[5] KIỂM TRA BỘ PHÂN GIẢI PHẢN HỒI (PARSERS)...\n";

// Parser Gemini
$geminiSampleJson = json_encode([
    'candidates' => [
        [
            'content' => [
                'parts' => [
                    ['text' => "Sân bóng BMT Arena đang mở cửa từ 05:00 đến 23:00, giá 180.000đ/giờ."]
                ]
            ]
        ]
    ]
]);
$geminiParsed = parse_gemini_response($geminiSampleJson);
assert_test("Gemini parser trích xuất đúng chuỗi văn bản tư vấn", $geminiParsed === "Sân bóng BMT Arena đang mở cửa từ 05:00 đến 23:00, giá 180.000đ/giờ.");

$geminiEmptyParsed = parse_gemini_response('{"candidates": []}');
assert_test("Gemini parser xử lý an toàn khi thiếu candidate (trả về null)", $geminiEmptyParsed === null);

// Parser OpenAI
$openaiSampleJson = json_encode([
    'choices' => [
        [
            'message' => [
                'role' => 'assistant',
                'content' => "Tại Buôn Ma Thuột có 7 cụm sân bóng đá mini chất lượng cao."
            ]
        ]
    ]
]);
$openaiParsed = parse_openai_response($openaiSampleJson);
assert_test("OpenAI parser trích xuất đúng nội dung choices[0].message.content", $openaiParsed === "Tại Buôn Ma Thuột có 7 cụm sân bóng đá mini chất lượng cao.");

$openaiEmptyParsed = parse_openai_response('{"error": {"message": "Invalid key"}}');
assert_test("OpenAI parser xử lý an toàn khi payload báo lỗi (trả về null)", $openaiEmptyParsed === null);

// ---------------------------------------------------------------------
// TEST 6: Kiểm tra siêu dữ liệu trạng thái Chatbot (chatbot_status)
// ---------------------------------------------------------------------
echo "\n[6] KIỂM TRA SIÊU DỮ LIỆU TRẠNG THÁI CHATBOT (STATUS)...\n";

$status = chatbot_status();
assert_test("Trạng thái chứa trường provider", isset($status['provider']));
assert_test("Trạng thái chứa cờ configured (boolean)", is_bool($status['configured']));
assert_test("Trạng thái chứa tên model", !empty($status['model']));
assert_test("Trạng thái chứa cờ enabled (boolean)", is_bool($status['enabled']));
assert_test("Tuyệt đối không để lộ khóa bí mật trong trạng thái", !isset($status['api_key']) && !isset($status['key']) && !isset($status['secret']));

// ---------------------------------------------------------------------
// TEST 7: Kiểm tra kịch bản Hỏi - Đáp tùy chỉnh (Custom Q&A)
// ---------------------------------------------------------------------
echo "\n[7] KIỂM TRA KỊCH BẢN HỎI - ĐÁP TÙY CHỈNH (CUSTOM Q&A)...\n";

// Kiểm tra từ khóa kịch bản có sẵn trong hệ thống: "lich co dinh"
$qaReply = chatbot_reply("Mình muốn hỏi về lich co dinh cho công ty");
assert_test("Khớp kịch bản hỏi đáp có sẵn trả về provider = custom_qa", ($qaReply['provider'] ?? '') === 'custom_qa');
assert_test("Kịch bản trả về đúng nội dung hướng dẫn lịch cố định", str_contains($qaReply['text'] ?? '', 'Lịch cố định'));
assert_test("Cờ fallback của custom QA là false", ($qaReply['fallback'] ?? true) === false);

// ---------------------------------------------------------------------
// TEST 8: Kiểm tra hàm chẩn đoán kết nối (chatbot_test_connection)
// ---------------------------------------------------------------------
echo "\n[8] KIỂM TRA HÀM CHẨN ĐOÁN KẾT NỐI (TEST CONNECTION)...\n";

// Khi key rỗng -> Báo fallback an toàn
$connTestEmpty = chatbot_test_connection('gemini', '', 'gemini-1.5-flash');
assert_test("Kiểm tra kết nối khi chưa có key trả về ok = true", $connTestEmpty['ok'] === true);
assert_test("Kiểm tra kết nối khi chưa có key chỉ định connected = false", $connTestEmpty['connected'] === false);
assert_test("Kiểm tra kết nối khi chưa có key báo chế độ fallback ngoại tuyến", $connTestEmpty['fallback'] === true);

// ---------------------------------------------------------------------
// TEST 9: Kiểm tra điều phối API Endpoint thực tế (api/chatbot.php)
// ---------------------------------------------------------------------
echo "\n[9] KIỂM TRA ĐIỀU PHỐI API ENDPOINT THỰC TẾ (API/CHATBOT.PHP)...\n";

$phpBin = 'E:\laragon\bin\php\php-8.3.36-Win32-vs16-x64\php.exe';
if (!is_file($phpBin)) {
    $phpBin = PHP_BINARY;
}

// Kiểm tra endpoint: action=status
$cmdStatus = '"' . $phpBin . '" -r "$_GET=[\'action\'=>\'status\']; require \'' . addslashes(__DIR__ . '/../api/chatbot.php') . '\';"';
$outStatus = shell_exec($cmdStatus);
$jsonStatus = json_decode((string)$outStatus, true);

assert_test("API action=status trả về JSON ok = true", ($jsonStatus['ok'] ?? false) === true);
assert_test("API action=status trả về dữ liệu provider hợp lệ", !empty($jsonStatus['data']['provider']));
assert_test("API action=status trả về trường configured boolean", is_bool($jsonStatus['data']['configured'] ?? null));

// Kiểm tra endpoint: action=message
$cmdMsg = '"' . $phpBin . '" -r "$_GET=[\'action\'=>\'message\']; $_POST=[\'message\'=>\'Gia san bong da\']; require \'' . addslashes(__DIR__ . '/../api/chatbot.php') . '\';"';
$outMsg = shell_exec($cmdMsg);
$jsonMsg = json_decode((string)$outMsg, true);

assert_test("API action=message trả về JSON ok = true", ($jsonMsg['ok'] ?? false) === true);
if (!empty($jsonStatus['data']['configured'])) {
    assert_test("API action=message trả về phản hồi AI trực tuyến (fallback = false)", ($jsonMsg['data']['fallback'] ?? true) === false);
    assert_test("API action=message trả về provider AI hợp lệ (gemini/openai)", in_array($jsonMsg['data']['provider'] ?? '', ['gemini', 'openai']));
} else {
    assert_test("API action=message trả về fallback = true khi chưa có key", ($jsonMsg['data']['fallback'] ?? false) === true);
    assert_test("API action=message trả về provider = offline", ($jsonMsg['data']['provider'] ?? '') === 'offline');
}
assert_test("API action=message chứa nội dung tư vấn hữu ích", !empty($jsonMsg['data']['text']));

// ---------------------------------------------------------------------
// TỔNG KẾT KẾT QUẢ KIỂM THỬ
// ---------------------------------------------------------------------
echo "\n====================================================================\n";
echo "   KẾT QUẢ KIỂM THỬ CHATBOT: {$testsPassed} PASS / {$testsFailed} FAIL\n";
echo "====================================================================\n";

if ($testsFailed > 0) {
    echo "=> CẢNH BÁO: Có {$testsFailed} ca kiểm thử thất bại! Vui lòng khắc phục trước khi báo cáo hoàn thành.\n";
    exit(1);
} else {
    echo "=> THÀNH CÔNG: Toàn bộ 100% ca kiểm thử ĐẠT yêu cầu kỹ thuật!\n";
    exit(0);
}
