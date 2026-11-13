<?php
/** Người dùng đang đăng nhập (đọc lại từ CSDL mỗi request) hoặc null. */
function current_user(): ?array
{
    static $loaded = false, $user = null;
    if (!$loaded) {
        $loaded = true;
        $id = $_SESSION['user_id'] ?? null;
        if ($id) {
            $user = q_one('SELECT id, email, full_name, phone, address, role, business_name, status, favorites, created_at FROM users WHERE id = ?', [$id]);
            if (!$user) unset($_SESSION['user_id']);
        }
    }
    return $user;
}

function user_role(): string
{
    return current_user()['role'] ?? '';
}

function is_admin(): bool
{
    $u = current_user();
    return $u && $u['role'] === 'admin' && $u['status'] === 'active';
}

function is_owner(): bool
{
    $u = current_user();
    return $u && $u['role'] === 'owner' && $u['status'] === 'active';
}

function login_user(int $id): void
{
    session_regenerate_id(true);
    $_SESSION['user_id'] = $id;
}

function logout_user(): void
{
    $_SESSION = [];
    if (ini_get('session.use_cookies')) {
        $p = session_get_cookie_params();
        setcookie(session_name(), '', time() - 42000, $p['path'], $p['domain'] ?? '', $p['secure'], $p['httponly']);
    }
    session_destroy();
}

/** Kiểm tra quản trị viên có đang giả lập (Ghost Login) tài khoản khác không. */
function impersonating_admin(): ?array
{
    if (!empty($_SESSION['impersonator_admin_id'])) {
        return [
            'id' => (int) $_SESSION['impersonator_admin_id'],
            'name' => $_SESSION['impersonator_admin_name'] ?? 'Quản trị viên',
            'email' => $_SESSION['impersonator_admin_email'] ?? '',
        ];
    }
    return null;
}

/** Bắt đầu phiên giả lập tài khoản. */
function start_impersonating(int $targetUserId): bool
{
    $admin = current_user();
    if (!$admin || $admin['role'] !== 'admin') return false;
    $target = q_one('SELECT id, email, full_name, role, status FROM users WHERE id = ?', [$targetUserId]);
    if (!$target) return false;
    if ((int) $target['id'] === (int) $admin['id']) return false;

    // Lưu phiên quản trị viên gốc
    $_SESSION['impersonator_admin_id'] = (int) $admin['id'];
    $_SESSION['impersonator_admin_name'] = $admin['full_name'] ?: $admin['email'];
    $_SESSION['impersonator_admin_email'] = $admin['email'];

    // Đăng nhập danh nghĩa người dùng đích
    $_SESSION['user_id'] = (int) $target['id'];

    audit('accounts', 'Ghost Login (Đăng nhập danh nghĩa)', $target['email'], 'Quản trị viên ' . ($admin['full_name'] ?: $admin['email']) . ' bắt đầu phiên giả lập tài khoản ID ' . $target['id'], 'warning');
    return true;
}

/** Kết thúc phiên giả lập và trở về tài khoản quản trị viên. */
function stop_impersonating(): bool
{
    if (empty($_SESSION['impersonator_admin_id'])) return false;
    $targetId = $_SESSION['user_id'] ?? null;
    $adminId = (int) $_SESSION['impersonator_admin_id'];

    $target = $targetId ? q_one('SELECT email FROM users WHERE id = ?', [$targetId]) : null;
    $targetEmail = $target['email'] ?? ('User ID ' . $targetId);

    $_SESSION['user_id'] = $adminId;
    unset($_SESSION['impersonator_admin_id'], $_SESSION['impersonator_admin_name'], $_SESSION['impersonator_admin_email']);

    audit('accounts', 'Thoát Ghost Login', $targetEmail, 'Quản trị viên đã kết thúc phiên giả lập và trở lại tài khoản quản trị.', 'info');
    return true;
}

/** Kiểm tra phiên Sudo (xác thực mật khẩu thao tác nhạy cảm). */
function is_sudo_active(): bool
{
    return !empty($_SESSION['admin_sudo_until']) && $_SESSION['admin_sudo_until'] > time();
}

/** Kích hoạt phiên Sudo (mặc định 15 phút = 900 giây). */
function activate_sudo(int $seconds = 900): void
{
    $_SESSION['admin_sudo_until'] = time() + $seconds;
}

/** Thông tin hồ sơ gọn để gửi cho JavaScript. */
function public_profile(?array $u): ?array
{
    if (!$u) return null;
    return [
        'id' => (int) $u['id'],
        'email' => $u['email'],
        'fullName' => $u['full_name'],
        'phone' => $u['phone'],
        'address' => $u['address'],
        'role' => $u['role'],
        'businessName' => $u['business_name'],
        'status' => $u['status'],
        'favorites' => jd($u['favorites']),
        'createdAt' => iso($u['created_at']),
    ];
}

// ---------------- Phân quyền quản trị ----------------

const ADMIN_MODULES = [
    ['key' => 'overview', 'label' => 'Tổng quan', 'description' => 'Xem bảng điều khiển và số liệu toàn hệ thống.', 'icon' => 'ri-dashboard-3-line'],
    ['key' => 'accounts', 'label' => 'Tài khoản', 'description' => 'Xem, đổi vai trò và tạm khóa tài khoản.', 'icon' => 'ri-group-line'],
    ['key' => 'courts', 'label' => 'Sân & cơ sở', 'description' => 'Tạm dừng hoặc gỡ sân khỏi nền tảng.', 'icon' => 'ri-football-line', 'danger' => true],
    ['key' => 'bookings', 'label' => 'Đơn đặt sân', 'description' => 'Duyệt hoặc từ chối đơn đặt sân.', 'icon' => 'ri-calendar-check-line'],
    ['key' => 'invoices', 'label' => 'Hóa đơn & công nợ', 'description' => 'Đối soát doanh thu, công nợ và xuất Excel.', 'icon' => 'ri-receipt-line'],
    ['key' => 'categories', 'label' => 'Danh mục', 'description' => 'Quản lý môn thể thao và khu vực hiển thị.', 'icon' => 'ri-price-tag-3-line'],
    ['key' => 'content', 'label' => 'Nội dung', 'description' => 'Banner, tin tức, FAQ và chính sách.', 'icon' => 'ri-article-line'],
    ['key' => 'moderation', 'label' => 'Kiểm duyệt & báo cáo', 'description' => 'Ẩn đánh giá vi phạm và xử lý báo cáo.', 'icon' => 'ri-shield-check-line', 'danger' => true],
    ['key' => 'promotions', 'label' => 'Khuyến mãi & mã giảm giá', 'description' => 'Theo dõi hiệu quả mã giảm giá toàn hệ thống.', 'icon' => 'ri-coupon-3-line'],
    ['key' => 'audit', 'label' => 'Nhật ký thao tác', 'description' => 'Xem lịch sử thao tác của quản trị viên.', 'icon' => 'ri-history-line'],
];

/** Vai trò quản trị + danh sách module được phép của người đang đăng nhập. */
function admin_access(): array
{
    static $access = null;
    if ($access !== null) return $access;
    $u = current_user();
    $all = array_column(ADMIN_MODULES, 'key');
    $access = ['roleKey' => 'super_admin', 'roleName' => 'Quản trị viên', 'actorName' => $u['full_name'] ?? 'Quản trị viên', 'allowed' => $all];
    if (!$u) return $access;
    $row = q_one('SELECT r.`key`, r.name, r.permissions FROM admin_role_assignments a JOIN admin_roles r ON r.`key` = a.role_key WHERE a.user_id = ?', [$u['id']]);
    if ($row) {
        $perms = array_values(array_intersect(jd($row['permissions']), $all));
        $access['roleKey'] = $row['key'];
        $access['roleName'] = $row['name'];
        $access['allowed'] = ($row['key'] === 'super_admin' || !$perms) ? $all : $perms;
    }
    $access['actorName'] = ($u['full_name'] ?: $u['email']);
    return $access;
}

// ---------------- Chặn truy cập cho API ----------------

function api_require_login(): array
{
    $u = current_user();
    if (!$u) json_error('Bạn cần đăng nhập để dùng chức năng này.', 401);
    if ($u['status'] !== 'active') json_error('Tài khoản đang bị tạm khóa.', 403);
    return $u;
}

/** Chủ sân (hoặc quản trị) mới được gọi. */
function api_require_owner(): array
{
    $u = api_require_login();
    if (!in_array($u['role'], ['owner', 'admin'], true)) json_error('Chức năng chỉ dành cho chủ sân.', 403);
    return $u;
}

/** Quản trị viên có quyền với module $module. */
function api_require_admin(string $module = ''): array
{
    $u = api_require_login();
    if ($u['role'] !== 'admin') json_error('Chức năng chỉ dành cho quản trị viên.', 403);
    if ($module && !in_array($module, admin_access()['allowed'], true)) {
        json_error('Vai trò quản trị của bạn chưa được cấp quyền cho mục này.', 403);
    }
    return $u;
}

/** Ghi nhật ký thao tác quản trị. */
function audit(string $module, string $action, string $target, string $detail = '', string $level = 'info'): void
{
    $u = current_user();
    $acc = admin_access();
    try {
        q('INSERT INTO audit_logs (actor_id, actor_name, actor_role, module, action, target_label, detail, level) VALUES (?,?,?,?,?,?,?,?)',
            [$u['id'] ?? null, $acc['actorName'], $acc['roleKey'], $module, $action, mb_substr($target, 0, 200), mb_substr($detail, 0, 500), $level]);
    } catch (Throwable $ex) {
        // Không chặn thao tác chính nếu ghi nhật ký lỗi.
    }
}
