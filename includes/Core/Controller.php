<?php
namespace Core;

use Throwable;
use PDOException;
use RuntimeException;

/**
 * BASE CONTROLLER (CONTROLLER CHA)
 * Đóng gói toàn bộ logic xử lý Request, Input Validation,
 * Phản hồi Response chuẩn hóa (JSON / View / Redirect),
 * Xác thực phiên người dùng và phân quyền RBAC/Staff.
 * 
 * @author Senior Developer (10+ years experience)
 */
abstract class Controller
{
    /** @var array Dữ liệu request body được parse sẵn */
    protected ?array $requestData = null;

    public function __construct()
    {
        $this->parseRequestData();
    }

    // ---------------- REQUEST & INPUT METHODS ----------------

    /**
     * Parse body request hỗ trợ cả JSON payload (Axios / Fetch) và form-data ($_POST / $_GET).
     */
    protected function parseRequestData(): void
    {
        if ($this->requestData === null) {
            $raw = file_get_contents('php://input');
            $decoded = $raw ? json_decode($raw, true) : null;
            if (is_array($decoded)) {
                $this->requestData = array_merge($_GET, $decoded);
            } else {
                $this->requestData = array_merge($_GET, $_POST);
            }
        }
    }

    /**
     * Lấy giá trị input theo key hoặc lấy toàn bộ request.
     */
    public function input(?string $key = null, $default = null)
    {
        if ($key === null) {
            return $this->requestData;
        }
        return $this->requestData[$key] ?? $default;
    }

    public function has(string $key): bool
    {
        return isset($this->requestData[$key]);
    }

    public function str(string $key, string $default = ''): string
    {
        $val = $this->input($key, $default);
        return is_scalar($val) ? trim((string)$val) : $default;
    }

    public function int(string $key, int $default = 0): int
    {
        $val = $this->input($key, $default);
        return is_numeric($val) ? (int)$val : $default;
    }

    public function float(string $key, float $default = 0.0): float
    {
        $val = $this->input($key, $default);
        return is_numeric($val) ? (float)$val : $default;
    }

    public function bool(string $key, bool $default = false): bool
    {
        $val = $this->input($key, $default);
        return filter_var($val, FILTER_VALIDATE_BOOLEAN);
    }

    public function arr(string $key, array $default = []): array
    {
        $val = $this->input($key, $default);
        return is_array($val) ? $val : $default;
    }

    public function only(array $keys): array
    {
        $result = [];
        foreach ($keys as $k) {
            if ($this->has($k)) {
                $result[$k] = $this->input($k);
            }
        }
        return $result;
    }

    /**
     * Bộ validation dữ liệu chuyên nghiệp:
     * Quy tắc hỗ trợ: required, email, min:X, max:X, numeric, in:a,b,c
     */
    public function validate(array $rules, array $customMessages = []): array
    {
        $errors = [];
        $validated = [];

        foreach ($rules as $field => $ruleString) {
            $fieldRules = explode('|', $ruleString);
            $value = $this->input($field);

            foreach ($fieldRules as $rule) {
                $params = [];
                if (str_contains($rule, ':')) {
                    [$rule, $paramStr] = explode(':', $rule, 2);
                    $params = explode(',', $paramStr);
                }

                switch ($rule) {
                    case 'required':
                        if ($value === null || $value === '' || (is_array($value) && empty($value))) {
                            $errors[$field][] = $customMessages["{$field}.required"] ?? "Trường {$field} là bắt buộc.";
                        }
                        break;

                    case 'email':
                        if ($value && !filter_var($value, FILTER_VALIDATE_EMAIL)) {
                            $errors[$field][] = $customMessages["{$field}.email"] ?? "Trường {$field} phải là địa chỉ email hợp lệ.";
                        }
                        break;

                    case 'numeric':
                        if ($value !== null && $value !== '' && !is_numeric($value)) {
                            $errors[$field][] = $customMessages["{$field}.numeric"] ?? "Trường {$field} phải là chữ số.";
                        }
                        break;

                    case 'min':
                        $min = (float)($params[0] ?? 0);
                        if (is_numeric($value)) {
                            if ((float)$value < $min) {
                                $errors[$field][] = $customMessages["{$field}.min"] ?? "Trường {$field} tối thiểu phải là {$min}.";
                            }
                        } elseif (is_string($value) && mb_strlen($value) < (int)$min) {
                            $errors[$field][] = $customMessages["{$field}.min"] ?? "Trường {$field} tối thiểu phải có {$min} ký tự.";
                        }
                        break;

                    case 'max':
                        $max = (float)($params[0] ?? 0);
                        if (is_numeric($value)) {
                            if ((float)$value > $max) {
                                $errors[$field][] = $customMessages["{$field}.max"] ?? "Trường {$field} không được lớn hơn {$max}.";
                            }
                        } elseif (is_string($value) && mb_strlen($value) > (int)$max) {
                            $errors[$field][] = $customMessages["{$field}.max"] ?? "Trường {$field} không được vượt quá {$max} ký tự.";
                        }
                        break;

                    case 'in':
                        if ($value !== null && $value !== '' && !in_array((string)$value, $params, true)) {
                            $errors[$field][] = $customMessages["{$field}.in"] ?? "Trường {$field} phải thuộc danh sách: " . implode(', ', $params);
                        }
                        break;
                }
            }

            if (!isset($errors[$field])) {
                $validated[$field] = $value;
            }
        }

        if (!empty($errors)) {
            $firstError = reset($errors)[0] ?? 'Dữ liệu không hợp lệ.';
            $this->error($firstError, 422, $errors);
        }

        return $validated;
    }

    // ---------------- RESPONSE METHODS ----------------

    /**
     * Trả về JSON thành công chuẩn hóa.
     */
    public function json($data = null, int $status = 200, string $message = ''): void
    {
        if (!headers_sent()) {
            http_response_code($status);
            header('Content-Type: application/json; charset=utf-8');
        }
        $payload = ['ok' => true];
        if ($message !== '') {
            $payload['message'] = $message;
        }
        if ($data !== null) {
            $payload['data'] = $data;
        }
        echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        exit;
    }

    /**
     * Trả về JSON báo lỗi chuẩn hóa.
     */
    public function error(string $message, int $status = 400, array $errors = []): void
    {
        if (!headers_sent()) {
            http_response_code($status);
            header('Content-Type: application/json; charset=utf-8');
        }
        $payload = [
            'ok' => false,
            'error' => $message,
        ];
        if (!empty($errors)) {
            $payload['errors'] = $errors;
        }
        echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        exit;
    }

    /**
     * Chuyển hướng URL.
     */
    public function redirect(string $path): void
    {
        redirect($path);
        exit;
    }

    // ---------------- AUTH & SECURITY GUARDS ----------------

    public function user(): ?array
    {
        return current_user();
    }

    public function userId(): ?int
    {
        $u = $this->user();
        return $u ? (int)$u['id'] : null;
    }

    public function isLoggedIn(): bool
    {
        return $this->user() !== null;
    }

    public function isRole(string $role): bool
    {
        $u = $this->user();
        return $u && $u['role'] === $role;
    }

    public function isStaff(): bool
    {
        return is_staff();
    }

    public function staff(): ?array
    {
        return current_staff();
    }

    /**
     * Yêu cầu người dùng phải đăng nhập, nếu chưa thì trả về lỗi 401.
     */
    public function requireLogin(): array
    {
        $u = $this->user();
        if (!$u) {
            $this->error('Vui lòng đăng nhập để thực hiện thao tác.', 401);
        }
        return $u;
    }

    /**
     * Yêu cầu quyền Chủ sân (Owner).
     */
    public function requireOwner(): array
    {
        $u = $this->requireLogin();
        if ($u['role'] !== 'owner') {
            $this->error('Chức năng này chỉ dành cho chủ sân.', 403);
        }
        return $u;
    }

    /**
     * Yêu cầu quyền Quản trị viên (Admin).
     */
    public function requireAdmin(): array
    {
        $u = $this->requireLogin();
        if ($u['role'] !== 'admin') {
            $this->error('Bạn không có quyền quản trị viên.', 403);
        }
        return $u;
    }

    /**
     * Kiểm tra phân quyền cụ thể của nhân viên cơ sở.
     */
    public function requireStaffPermission(string $module): void
    {
        staff_need($module);
    }

    // ---------------- AUTOMATIC ACTION DISPATCHER ----------------

    /**
     * Tự động điều phối action theo tham số ?action=...
     * Bọc toàn bộ trong try-catch chuẩn để đảm bảo tính ổn định và bảo mật.
     */
    public function dispatch(?string $action = null): void
    {
        $act = $action ?? $this->str('action');
        if (empty($act)) {
            $act = 'index';
        }

        // Tên phương thức tương ứng trong Controller con, ví dụ: actionList(), actionSave()
        $method = 'action' . str_replace(' ', '', ucwords(str_replace(['-', '_'], ' ', $act)));

        if (!method_exists($this, $method)) {
            $this->error("Không tìm thấy thao tác: {$act}", 404);
        }

        try {
            $result = $this->$method();
            // Nếu phương thức trả về dữ liệu (chưa tự exit qua $this->json), tự động format JSON
            if ($result !== null) {
                $this->json($result);
            }
        } catch (PDOException $ex) {
            error_log('Database Error in Controller: ' . $ex->getMessage());
            $this->error('Lỗi kết nối cơ sở dữ liệu. Vui lòng thử lại sau.', 500);
        } catch (RuntimeException $ex) {
            $this->error($ex->getMessage(), 400);
        } catch (Throwable $ex) {
            error_log('System Error in Controller: ' . $ex->getMessage());
            $this->error($ex->getMessage(), 500);
        }
    }
}
