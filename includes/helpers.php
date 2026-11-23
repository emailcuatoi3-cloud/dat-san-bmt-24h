<?php
/** Thoát HTML. */
function e($value): string
{
    return htmlspecialchars((string) $value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}

/** Thư mục gốc của website trên URL (vd: "" hoặc "/dat_san_24h_php"). */
function base_path(): string
{
    static $base = null; 
    if ($base === null) {
        $root = realpath(__DIR__ . '/..');
        $doc = realpath($_SERVER['DOCUMENT_ROOT'] ?? '') ?: '';
        if ($doc && strpos($root, $doc) === 0) {
            $base = str_replace('\\', '/', substr($root, strlen($doc)));
        } else {
            $base = rtrim(str_replace('\\', '/', dirname($_SERVER['SCRIPT_NAME'] ?? '/')), '/');
            if (substr($base, -4) === '/api') $base = substr($base, 0, -4);
        }
        $base = rtrim($base, '/');
    }
    return $base;
}

/** Tạo URL nội bộ: url('/tim-san') → /base/tim-san */
function url(string $path = '/'): string
{
    return base_path() . ($path === '' ? '/' : $path);
}

/** URL tài nguyên tĩnh kèm phiên bản để tránh cache cũ. */
function asset(string $path): string
{
    $file = __DIR__ . '/../assets/' . ltrim($path, '/');
    $ver = is_file($file) ? filemtime($file) : 1;
    return url('/assets/' . ltrim($path, '/')) . '?v=' . $ver;
}

/** Đường dẫn logo chính của website */
function site_logo(): string
{
    return asset('img/logo_new.png');
}

function redirect(string $path): void
{
    header('Location: ' . (preg_match('#^https?://#', $path) ? $path : url($path)));
    exit;
}

/** Mã hóa JSON giữ nguyên tiếng Việt. */
function j($value): string
{
    return json_encode($value, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
}

/** Mã hóa JSON an toàn để nhúng vào thẻ <script>. */
function j_script($value): string
{
    return json_encode($value, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT);
}

/** Giải mã cột JSON trong CSDL, luôn trả về mảng. */
function jd($value): array
{
    if (is_array($value)) return $value;
    if ($value === null || $value === '') return [];
    $decoded = json_decode((string) $value, true);
    return is_array($decoded) ? $decoded : [];
}

function money(int $value): string
{
    return number_format($value, 0, ',', '.') . 'đ';
}

function now_sql(): string
{
    return date('Y-m-d H:i:s');
}

/** Chuyển "Y-m-d H:i:s" (giờ VN) thành ISO 8601 có múi giờ, để JS đọc đúng. */
function iso($datetime): ?string
{
    if (!$datetime) return null;
    $ts = strtotime((string) $datetime);
    return $ts ? date('c', $ts) : null;
}

/** Mã định danh ngẫu nhiên có tiền tố. */
function uid(string $prefix = ''): string
{
    return $prefix . date('ymdHis') . '-' . bin2hex(random_bytes(3));
}

function initials_of(string $name, string $email = ''): string
{
    $words = preg_split('/\s+/u', trim($name), -1, PREG_SPLIT_NO_EMPTY);
    if (count($words) >= 2) {
        return mb_strtoupper(mb_substr($words[count($words) - 2], 0, 1) . mb_substr($words[count($words) - 1], 0, 1));
    }
    if (count($words) === 1) return mb_strtoupper(mb_substr($words[0], 0, 2));
    if ($email) return mb_strtoupper(mb_substr($email, 0, 2));
    return 'KH';
}

function short_name_of(string $name, string $email = ''): string
{
    $words = preg_split('/\s+/u', trim($name), -1, PREG_SPLIT_NO_EMPTY);
    if (count($words) >= 2) return implode(' ', array_slice($words, -2));
    if (count($words) === 1) return $words[0];
    if ($email) return explode('@', $email)[0];
    return 'Tài khoản';
}

/** Bỏ dấu tiếng Việt, tạo slug. */
function slugify(string $text): string
{
    $text = mb_strtolower(trim($text));
    $map = ['à|á|ạ|ả|ã|â|ầ|ấ|ậ|ẩ|ẫ|ă|ằ|ắ|ặ|ẳ|ẵ' => 'a', 'è|é|ẹ|ẻ|ẽ|ê|ề|ế|ệ|ể|ễ' => 'e', 'ì|í|ị|ỉ|ĩ' => 'i',
        'ò|ó|ọ|ỏ|õ|ô|ồ|ố|ộ|ổ|ỗ|ơ|ờ|ớ|ợ|ở|ỡ' => 'o', 'ù|ú|ụ|ủ|ũ|ư|ừ|ứ|ự|ử|ữ' => 'u', 'ỳ|ý|ỵ|ỷ|ỹ' => 'y', 'đ' => 'd'];
    foreach ($map as $pattern => $replace) $text = preg_replace('/' . $pattern . '/u', $replace, $text);
    $text = preg_replace('/[^a-z0-9]+/', '-', $text);
    return trim($text, '-');
}

/** Lấy địa chỉ IP của người dùng truy cập. */
function client_ip(): string
{
    $keys = ['HTTP_CF_CONNECTING_IP', 'HTTP_X_FORWARDED_FOR', 'REMOTE_ADDR'];
    foreach ($keys as $k) {
        if (!empty($_SERVER[$k])) {
            $ip = trim(explode(',', (string) $_SERVER[$k])[0]);
            if (filter_var($ip, FILTER_VALIDATE_IP)) return $ip;
        }
    }
    return '127.0.0.1';
}

/** Chuẩn hóa và kiểm tra số điện thoại hợp lệ theo các nhà mạng viễn thông Việt Nam. */
function clean_vietnam_phone(string $phone): string
{
    $digits = preg_replace('/\D/', '', $phone);
    if (str_starts_with($digits, '84') && strlen($digits) === 11) {
        $digits = '0' . substr($digits, 2);
    }
    return $digits;
}

function is_valid_vietnam_phone(string $phone): bool
{
    $digits = clean_vietnam_phone($phone);
    if (!preg_match('/^0\d{9}$/', $digits)) return false;

    // Chặn số ảo lặp (0000000000, 0111111111, 0999999999...)
    if (preg_match('/^0(\d)\1{8}$/', $digits)) return false;
    // Chặn số thứ tự giả lập
    if (in_array($digits, ['0123456789', '0987654321', '0123456780'], true)) return false;

    // Các đầu số di động hợp lệ tại Việt Nam: Viettel, Mobifone, Vinaphone, Vietnamobile, Gmobile, Wintel, Itelecom
    $validPrefixes = '/^(086|096|097|098|032|033|034|035|036|037|038|039|089|090|093|070|076|077|078|079|088|091|094|081|082|083|084|085|092|052|056|058|099|059|087|055)/';
    return (bool) preg_match($validPrefixes, $digits);
}

// ---------------- API helpers ----------------

/** Đọc body JSON của request (hoặc $_POST). */
function input(): array
{
    static $data = null;
    if ($data === null) {
        $raw = file_get_contents('php://input');
        $decoded = $raw ? json_decode($raw, true) : null;
        $data = is_array($decoded) ? $decoded : $_POST;
    }
    return $data;
}

function in_str(string $key, string $default = ''): string
{
    $v = input()[$key] ?? $default;
    return is_scalar($v) ? trim((string) $v) : $default;
}

function in_int(string $key, int $default = 0): int
{
    $v = input()[$key] ?? $default;
    return is_numeric($v) ? (int) round((float) $v) : $default;
}

function in_arr(string $key): array
{
    $v = input()[$key] ?? [];
    return is_array($v) ? $v : [];
}

function json_out($data, int $status = 200): void
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    echo j($data);
    exit;
}

function json_error(string $message, int $status = 400, array $extra = []): void
{
    json_out(array_merge(['ok' => false, 'error' => $message], $extra), $status);
}

/**
 * Chạy API theo tham số ?action=..., bắt lỗi chung.
 * $routes = ['ten_action' => function () { ... return [...]; }]
 */
function run_api(array $routes): void
{
    $action = $_GET['action'] ?? '';
    if (!isset($routes[$action])) json_error('Không tìm thấy chức năng: ' . $action, 404);
    try {
        $result = $routes[$action]();
        json_out(['ok' => true, 'data' => $result]);
    } catch (PDOException $ex) {
        error_log($ex->getMessage());
        json_error('Lỗi cơ sở dữ liệu. Vui lòng thử lại sau.', 500);
    } catch (Throwable $ex) {
        json_error($ex->getMessage(), 400);
    }
}

/** Ném lỗi nghiệp vụ (thông điệp hiển thị cho người dùng). */
function fail(string $message): void
{
    throw new RuntimeException($message);
}
