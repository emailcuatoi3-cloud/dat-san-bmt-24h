<?php
/**
 * API QUẢN TRỊ — mỗi action kiểm tra quyền theo module (admin_access()['allowed']) và ghi nhật ký thao tác.
 */
require_once __DIR__ . '/../includes/bootstrap.php';

$ADMIN = api_require_admin();
const ROLE_LABELS = ['customer' => 'Khách hàng', 'owner' => 'Chủ sân', 'admin' => 'Quản trị viên'];

function need(string ...$modules): void
{
    $allowed = admin_access()['allowed'];
    foreach ($modules as $m) {
        if (in_array($m, $allowed, true)) {
            api_require_admin();
            return;
        }
    }
    api_require_admin($modules[0] ?? '');
}

function require_sudo(): void
{
    if (!is_sudo_active()) {
        json_error('Yêu cầu xác thực Quản trị viên (Sudo Mode) để thực hiện thao tác nhạy cảm này.', 403, ['require_sudo' => true]);
    }
}

function map_user(array $r): array
{
    return [ 
        'id' => (int) $r['id'], 'email' => $r['email'], 'fullName' => $r['full_name'], 'phone' => $r['phone'], 'role' => $r['role'],
        'businessName' => $r['business_name'], 'status' => $r['status'], 'createdAt' => iso($r['created_at']),
        'adminRole' => $r['role_key'] ?? null,
        'courtCount' => (int) ($r['court_count'] ?? 0), 'bookingCount' => (int) ($r['booking_count'] ?? 0),
    ];
}

function map_role(array $r): array
{
    return ['key' => $r['key'], 'name' => $r['name'], 'description' => $r['description'], 'permissions' => jd($r['permissions'])];
}

function all_bookings(): array
{
    auto_complete_bookings();
    $rows = q_all(BOOKING_SELECT . ' ORDER BY b.booking_date DESC, b.created_at DESC');
    return array_values(array_filter(array_map('map_booking', $rows), fn($b) => !$b['expiredHold']));
}

function owner_names(): array
{
    $map = [];
    foreach (q_all("SELECT id, full_name, business_name, email FROM users WHERE role = 'owner'") as $o) {
        $map[(int) $o['id']] = $o['business_name'] ?: ($o['full_name'] ?: $o['email']);
    }
    return $map;
}

run_api([
    // ---------------- Tổng quan ----------------
    'overview' => function () {
        need('overview');
        $bookings = all_bookings();
        $days = [];
        for ($i = 6; $i >= 0; $i--) {
            $d = date('Y-m-d', strtotime("-$i day"));
            $list = array_filter($bookings, fn($b) => $b['date'] === $d && in_array($b['status'], ['confirmed', 'completed'], true));
            $days[] = ['date' => $d, 'revenue' => array_sum(array_column($list, 'totalPrice')), 'count' => count($list)];
        }
        $statuses = [];
        foreach (['pending', 'confirmed', 'completed', 'cancelled'] as $s) $statuses[$s] = count(array_filter($bookings, fn($b) => $b['status'] === $s));
        $courts = array_map('map_court', q_all('SELECT * FROM courts WHERE deleted_at IS NULL'));
        $top = [];
        foreach ($courts as $c) {
            $l = array_filter($bookings, fn($b) => $b['courtId'] === $c['id'] && $b['status'] !== 'cancelled');
            $top[] = ['name' => $c['name'], 'area' => $c['area'], 'count' => count($l), 'revenue' => array_sum(array_column($l, 'totalPrice'))];
        }
        usort($top, fn($a, $b) => $b['revenue'] <=> $a['revenue']);
        $roles = [];
        foreach (q_all('SELECT role, COUNT(*) n FROM users GROUP BY role') as $r) $roles[$r['role']] = (int) $r['n'];
        $month = date('Y-m');
        return [
            'days' => $days, 'statuses' => $statuses, 'topCourts' => array_slice($top, 0, 5), 'roles' => $roles,
            'totals' => [
                'users' => array_sum($roles),
                'suspended' => (int) q_val("SELECT COUNT(*) FROM users WHERE status = 'suspended'"),
                'courts' => count($courts),
                'activeCourts' => count(array_filter($courts, fn($c) => $c['status'] === 'active')),
                'bookings' => count($bookings),
                'monthRevenue' => array_sum(array_column(array_filter($bookings, fn($b) => str_starts_with($b['date'], $month) && in_array($b['status'], ['confirmed', 'completed'], true)), 'totalPrice')),
                'openReports' => (int) q_val("SELECT COUNT(*) FROM reports WHERE status IN ('open','reviewing')"),
                'pendingReviews' => (int) q_val("SELECT COUNT(*) FROM reviews WHERE moderation_status = 'pending'"),
                'pendingOwnerRequests' => (int) q_val("SELECT COUNT(*) FROM owner_requests WHERE status = 'pending'"),
            ],
            'recentAudit' => array_map(fn($a) => ['action' => $a['action'], 'actor' => $a['actor_name'], 'target' => $a['target_label'], 'level' => $a['level'], 'createdAt' => iso($a['created_at'])],
                q_all('SELECT * FROM audit_logs ORDER BY id DESC LIMIT 6')),
        ];
    },

    // ---------------- Tài khoản & phân quyền ----------------
    'accounts' => function () {
        need('accounts');
        $users = q_all("SELECT u.*, a.role_key,
                          (SELECT COUNT(*) FROM courts c WHERE c.owner_id = u.id AND c.deleted_at IS NULL) court_count,
                          (SELECT COUNT(*) FROM bookings b WHERE b.customer_id = u.id) booking_count
                        FROM users u LEFT JOIN admin_role_assignments a ON a.user_id = u.id ORDER BY u.created_at DESC");
        return [
            'users' => array_map('map_user', $users),
            'roles' => array_map('map_role', q_all('SELECT * FROM admin_roles ORDER BY `key` = "super_admin" DESC, name')),
            'modules' => ADMIN_MODULES,
            'me' => (int) current_user()['id'],
        ];
    },

    'account_save' => function () {
        need('accounts');
        require_sudo();
        $id = in_int('id');
        $email = mb_strtolower(in_str('email'));
        $name = in_str('fullName');
        $phone = in_str('phone');
        $role = in_str('role') ?: 'customer';
        $businessName = in_str('businessName');
        $address = in_str('address');
        $status = in_str('status') === 'suspended' ? 'suspended' : 'active';
        $adminRole = in_str('adminRole');
        $password = (string) (input()['password'] ?? '');

        if (!isset(ROLE_LABELS[$role])) fail('Vai trò không hợp lệ.');
        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) fail('Email chưa đúng định dạng. Ví dụ: user@example.com.');
        if (mb_strlen($name) < 2) fail('Họ tên cần ít nhất 2 ký tự.');

        if ($id <= 0) {
            // TẠO MỚI (CREATE)
            if (strlen($password) < 6) fail('Mật khẩu tạo mới cần ít nhất 6 ký tự.');
            if (q_val('SELECT id FROM users WHERE email = ?', [$email])) fail('Email này đã được sử dụng bởi tài khoản khác.');

            q('INSERT INTO users (email, password_hash, full_name, phone, address, role, business_name, status, favorites) VALUES (?,?,?,?,?,?,?,?,?)',
                [$email, password_hash($password, PASSWORD_DEFAULT), $name, $phone, $address, $role, $businessName, $status, '[]']);
            $id = (int) db()->lastInsertId();

            if ($role === 'admin' && $adminRole) {
                q('INSERT INTO admin_role_assignments (user_id, role_key, assigned_by) VALUES (?,?,?)',
                    [$id, $adminRole, admin_access()['actorName']]);
            }
            audit('accounts', 'Tạo tài khoản mới', $email, 'Tạo tài khoản ' . $name . ' (' . (ROLE_LABELS[$role] ?? $role) . ')', 'success');
            return ['id' => $id, 'created' => true];
        } else {
            // CẬP NHẬT (UPDATE)
            $existing = q_one('SELECT * FROM users WHERE id = ?', [$id]) ?: fail('Không tìm thấy tài khoản cần sửa.');
            if (q_val('SELECT id FROM users WHERE email = ? AND id <> ?', [$email, $id])) fail('Email này đã được tài khoản khác sử dụng.');

            $me = (int) current_user()['id'];
            if ($id === $me && $status === 'suspended') fail('Bạn không thể tự khóa tài khoản của chính mình.');
            if ($id === $me && $role !== 'admin') fail('Bạn không thể tự hạ quyền quản trị của chính mình.');

            if ($existing['role'] === 'admin' && ($status === 'suspended' || $role !== 'admin')) {
                $activeAdminCount = (int) q_val("SELECT COUNT(*) FROM users WHERE role = 'admin' AND status = 'active' AND id <> ?", [$id]);
                if ($activeAdminCount === 0) fail('Không thể tạm khóa hoặc chuyển vai trò của Quản trị viên duy nhất còn đang hoạt động trên hệ thống.');
            }

            if ($password !== '') {
                if (strlen($password) < 6) fail('Mật khẩu mới cần ít nhất 6 ký tự.');
                $hash = password_hash($password, PASSWORD_DEFAULT);
                q('UPDATE users SET email = ?, full_name = ?, phone = ?, address = ?, role = ?, business_name = ?, status = ?, password_hash = ? WHERE id = ?',
                    [$email, $name, $phone, $address, $role, $businessName, $status, $hash, $id]);
            } else {
                q('UPDATE users SET email = ?, full_name = ?, phone = ?, address = ?, role = ?, business_name = ?, status = ? WHERE id = ?',
                    [$email, $name, $phone, $address, $role, $businessName, $status, $id]);
            }

            if ($role === 'admin') {
                if ($adminRole) {
                    q('INSERT INTO admin_role_assignments (user_id, role_key, assigned_by) VALUES (?,?,?) ON DUPLICATE KEY UPDATE role_key = VALUES(role_key), assigned_by = VALUES(assigned_by)',
                        [$id, $adminRole, admin_access()['actorName']]);
                } else {
                    q('DELETE FROM admin_role_assignments WHERE user_id = ?', [$id]);
                }
            } else {
                q('DELETE FROM admin_role_assignments WHERE user_id = ?', [$id]);
            }

            audit('accounts', 'Cập nhật tài khoản', $email, "Chỉnh sửa thông tin {$name} (#{$id})", 'info');
            return ['id' => $id, 'created' => false];
        }
    },

    'account_delete' => function () {
        need('accounts');
        require_sudo();
        $id = in_int('id');
        $me = (int) current_user()['id'];
        if ($id === $me) fail('Bạn không thể tự xóa tài khoản của chính mình.');
        $u = q_one('SELECT * FROM users WHERE id = ?', [$id]) ?: fail('Không tìm thấy tài khoản.');

        if ($u['role'] === 'admin') {
            $activeAdminCount = (int) q_val("SELECT COUNT(*) FROM users WHERE role = 'admin' AND status = 'active' AND id <> ?", [$id]);
            if ($activeAdminCount === 0) fail('Không thể xóa Quản trị viên duy nhất còn đang hoạt động trên hệ thống.');
        }

        $courtCount = (int) q_val('SELECT COUNT(*) FROM courts WHERE owner_id = ? AND deleted_at IS NULL', [$id]);
        if ($courtCount > 0) {
            fail("Không thể xóa tài khoản này vì đang phụ trách {$courtCount} sân bóng trên hệ thống. Vui lòng chuyển giao hoặc gỡ sân trước.");
        }

        q('DELETE FROM admin_role_assignments WHERE user_id = ?', [$id]);
        q('UPDATE bookings SET customer_id = NULL WHERE customer_id = ?', [$id]);
        q('DELETE FROM users WHERE id = ?', [$id]);

        audit('accounts', 'Xóa tài khoản', $u['email'], "Đã xóa vĩnh viễn tài khoản {$u['full_name']} (#{$id})", 'danger');
        return true;
    },

    'account_role' => function () {
        need('accounts');
        require_sudo();
        $id = in_int('id');
        $role = in_str('role');
        if (!isset(ROLE_LABELS[$role])) fail('Vai trò không hợp lệ.');
        if ($id === (int) current_user()['id']) fail('Bạn không thể tự đổi vai trò của chính mình.');
        $u = q_one('SELECT * FROM users WHERE id = ?', [$id]) ?: fail('Không tìm thấy tài khoản.');
        if ($u['role'] === 'admin' && $role !== 'admin') {
            $activeAdminCount = (int) q_val("SELECT COUNT(*) FROM users WHERE role = 'admin' AND status = 'active' AND id <> ?", [$id]);
            if ($activeAdminCount === 0) fail('Hệ thống phải có ít nhất một Quản trị viên hoạt động. Không thể chuyển vai trò của Quản trị viên cuối cùng.');
        }
        q('UPDATE users SET role = ?, business_name = IF(? = "owner" AND business_name = "", full_name, business_name) WHERE id = ?', [$role, $role, $id]);
        if ($role !== 'admin') q('DELETE FROM admin_role_assignments WHERE user_id = ?', [$id]);
        audit('accounts', 'Đổi vai trò tài khoản', $u['email'], ROLE_LABELS[$u['role']] . ' → ' . ROLE_LABELS[$role], 'warning');
        return true;
    },

    'account_status' => function () {
        need('accounts');
        require_sudo();
        $id = in_int('id');
        if ($id === (int) current_user()['id']) fail('Bạn không thể tự khóa tài khoản của chính mình.');
        $u = q_one('SELECT * FROM users WHERE id = ?', [$id]) ?: fail('Không tìm thấy tài khoản.');
        $status = in_str('status') === 'suspended' ? 'suspended' : 'active';
        if ($status === 'suspended' && $u['role'] === 'admin') {
            $activeAdminCount = (int) q_val("SELECT COUNT(*) FROM users WHERE role = 'admin' AND status = 'active' AND id <> ?", [$id]);
            if ($activeAdminCount === 0) fail('Không thể tạm khóa Quản trị viên duy nhất còn đang hoạt động trên hệ thống.');
        }
        q('UPDATE users SET status = ? WHERE id = ?', [$status, $id]);
        audit('accounts', $status === 'suspended' ? 'Tạm khóa tài khoản' : 'Mở khóa tài khoản', $u['email'], in_str('reason'), $status === 'suspended' ? 'danger' : 'success');
        return true;
    },

    'assign_admin_role' => function () {
        need('accounts');
        require_sudo();
        $id = in_int('id');
        $key = in_str('roleKey');
        $u = q_one("SELECT * FROM users WHERE id = ? AND role = 'admin'", [$id]) ?: fail('Chỉ gán bộ quyền cho tài khoản quản trị.');
        if ($key === '') {
            q('DELETE FROM admin_role_assignments WHERE user_id = ?', [$id]);
            audit('accounts', 'Thu hồi bộ quyền quản trị', $u['email'], '', 'warning');
            return true;
        }
        $role = q_one('SELECT * FROM admin_roles WHERE `key` = ?', [$key]) ?: fail('Không tìm thấy bộ quyền.');
        q('INSERT INTO admin_role_assignments (user_id, role_key, assigned_by) VALUES (?,?,?) ON DUPLICATE KEY UPDATE role_key = VALUES(role_key), assigned_by = VALUES(assigned_by)',
            [$id, $key, admin_access()['actorName']]);
        audit('accounts', 'Gán bộ quyền quản trị', $u['email'], $role['name'], 'info');
        return true;
    },

    'role_save' => function () {
        need('accounts');
        require_sudo();
        if (admin_access()['roleKey'] !== 'super_admin') fail('Chỉ Quản trị cấp cao được chỉnh bộ quyền.');
        $key = in_str('key') ?: slugify(in_str('name'));
        $name = in_str('name');
        if (mb_strlen($name) < 3) fail('Tên bộ quyền cần ít nhất 3 ký tự.');
        $perms = array_values(array_intersect(in_arr('permissions'), array_column(ADMIN_MODULES, 'key')));
        if (!$perms) fail('Chọn ít nhất 1 mục được phép.');
        if ($key === 'super_admin') $perms = array_column(ADMIN_MODULES, 'key');
        q('INSERT INTO admin_roles (`key`, name, description, permissions) VALUES (?,?,?,?) ON DUPLICATE KEY UPDATE name = VALUES(name), description = VALUES(description), permissions = VALUES(permissions)',
            [$key, $name, in_str('description'), j($perms)]);
        audit('accounts', 'Cập nhật bộ quyền', $name, count($perms) . ' mục được phép', 'warning');
        return true;
    },

    'role_delete' => function () {
        need('accounts');
        require_sudo();
        $key = in_str('key');
        if ($key === 'super_admin') fail('Không thể xóa bộ quyền Quản trị cấp cao.');
        if (q_val('SELECT COUNT(*) FROM admin_role_assignments WHERE role_key = ?', [$key])) fail('Bộ quyền đang được gán cho tài khoản, hãy thu hồi trước.');
        q('DELETE FROM admin_roles WHERE `key` = ?', [$key]);
        audit('accounts', 'Xóa bộ quyền', $key, '', 'danger');
        return true;
    },

    'verify_sudo' => function () {
        $password = (string) (input()['password'] ?? '');
        if ($password === '') fail('Vui lòng nhập mật khẩu quản trị.');
        $u = current_user();
        if (!$u) fail('Phiên đăng nhập đã hết hạn.');
        $row = q_one('SELECT password_hash FROM users WHERE id = ?', [$u['id']]);
        if (!$row || !password_verify($password, $row['password_hash'])) {
            fail('Mật khẩu quản trị không chính xác.');
        }
        activate_sudo(900);
        audit('accounts', 'Xác thực Sudo Mode', $u['email'], 'Mở khóa phiên quản trị nhạy cảm thành công (15 phút)', 'info');
        return ['ok' => true, 'expiresIn' => 900];
    },

    'impersonate' => function () {
        need('accounts');
        require_sudo();
        $id = in_int('id');
        $me = (int) current_user()['id'];
        if ($id === $me) fail('Bạn không thể đăng nhập danh nghĩa chính mình.');
        $target = q_one('SELECT id, email, full_name, role, status FROM users WHERE id = ?', [$id]);
        if (!$target) fail('Không tìm thấy tài khoản người dùng.');
        if ($target['role'] === 'admin' && admin_access()['roleKey'] !== 'super_admin') {
            fail('Chỉ Quản trị cấp cao mới được phép giả lập tài khoản quản trị khác.');
        }
        if (!start_impersonating($id)) fail('Không thể khởi tạo phiên giả lập.');
        
        $redirect = $target['role'] === 'owner' ? url('/chu-san') : ($target['role'] === 'admin' ? url('/quan-tri') : url('/tai-khoan'));
        return ['redirect' => $redirect, 'target' => $target['full_name'] ?: $target['email']];
    },

    'account_detail' => function () {
        need('accounts');
        $id = in_int('id');
        $u = q_one('SELECT u.*, a.role_key FROM users u LEFT JOIN admin_role_assignments a ON a.user_id = u.id WHERE u.id = ?', [$id]);
        if (!$u) fail('Không tìm thấy tài khoản.');

        $rows = q_all(BOOKING_SELECT . ' WHERE b.customer_id = ? ORDER BY b.created_at DESC LIMIT 6', [$id]);
        $recentBookings = array_map('map_booking', $rows);

        $totalSpent = (int) q_val("SELECT COALESCE(SUM(total_price), 0) FROM bookings WHERE customer_id = ? AND status IN ('confirmed', 'completed')", [$id]);
        $totalBookings = (int) q_val("SELECT COUNT(*) FROM bookings WHERE customer_id = ?", [$id]);

        $courts = [];
        $ownerRevenue = 0;
        if ($u['role'] === 'owner') {
            $courts = q_all("SELECT id, name, sport, sport_label, area, status, rating, review_count, monthly_bookings FROM courts WHERE owner_id = ? AND deleted_at IS NULL ORDER BY created_at DESC", [$id]);
            $ownerRevenue = (int) q_val("SELECT COALESCE(SUM(b.total_price), 0) FROM bookings b JOIN courts c ON c.id = b.court_id WHERE c.owner_id = ? AND b.status IN ('confirmed', 'completed')", [$id]);
        }

        $logs = q_all("SELECT * FROM audit_logs WHERE target_label LIKE ? OR detail LIKE ? OR actor_id = ? ORDER BY id DESC LIMIT 10",
            ['%' . $u['email'] . '%', '%' . $u['email'] . '%', $id]);

        return [
            'user' => map_user($u),
            'phone' => $u['phone'],
            'address' => $u['address'],
            'totalSpent' => $totalSpent,
            'totalBookings' => $totalBookings,
            'ownerRevenue' => $ownerRevenue,
            'courts' => $courts,
            'recentBookings' => $recentBookings,
            'auditLogs' => array_map(fn($a) => [
                'action' => $a['action'],
                'actor' => $a['actor_name'],
                'detail' => $a['detail'],
                'level' => $a['level'],
                'createdAt' => iso($a['created_at']),
            ], $logs),
        ];
    },

    // ---------------- Quản lý chủ sân ----------------
    'owners' => function () {
        need('owners', 'accounts');
        $owners = q_all("SELECT u.*,
                            (SELECT COUNT(*) FROM courts c WHERE c.owner_id = u.id AND c.deleted_at IS NULL) court_count,
                            (SELECT GROUP_CONCAT(c.name SEPARATOR ', ') FROM courts c WHERE c.owner_id = u.id AND c.deleted_at IS NULL) court_names,
                            (SELECT COUNT(*) FROM bookings b JOIN courts c ON c.id = b.court_id WHERE c.owner_id = u.id) booking_count,
                            (SELECT COALESCE(SUM(b.total_price), 0) FROM bookings b JOIN courts c ON c.id = b.court_id WHERE c.owner_id = u.id AND b.status IN ('confirmed','completed')) revenue
                         FROM users u
                         WHERE u.role = 'owner'
                         ORDER BY u.created_at DESC");

        $mappedOwners = array_map(function ($u) {
            $user = map_user($u);
            $user['courtCount'] = (int) $u['court_count'];
            $user['courtNames'] = (string) ($u['court_names'] ?? '');
            $user['bookingCount'] = (int) $u['booking_count'];
            $user['revenue'] = (int) $u['revenue'];
            return $user;
        }, $owners);

        $pendingReqs = (int) q_val("SELECT COUNT(*) FROM owner_requests WHERE status = 'pending'");
        $totalCourts = (int) q_val("SELECT COUNT(*) FROM courts WHERE owner_id IS NOT NULL AND deleted_at IS NULL");
        $totalRevenue = (int) q_val("SELECT COALESCE(SUM(total_price), 0) FROM bookings b JOIN courts c ON c.id = b.court_id WHERE c.owner_id IS NOT NULL AND b.status IN ('confirmed','completed')");

        return [
            'owners' => $mappedOwners,
            'roles' => array_map('map_role', q_all('SELECT * FROM admin_roles ORDER BY `key` = "super_admin" DESC, name')),
            'stat' => [
                'total' => count($mappedOwners),
                'active' => count(array_filter($mappedOwners, fn($o) => $o['status'] === 'active')),
                'suspended' => count(array_filter($mappedOwners, fn($o) => $o['status'] === 'suspended')),
                'pendingRequests' => $pendingReqs,
                'totalCourts' => $totalCourts,
                'totalRevenue' => $totalRevenue,
            ],
            'me' => (int) current_user()['id'],
        ];
    },

    // ---------------- Yêu cầu làm chủ sân ----------------
    'owner_requests' => function () {
        need('owners', 'accounts');
        return array_map('map_owner_request', q_all("SELECT r.*, u.role user_role, u.status user_status FROM owner_requests r JOIN users u ON u.id = r.user_id
            ORDER BY FIELD(r.status, 'pending', 'approved', 'rejected'), r.created_at DESC"));
    },

    'owner_request_review' => function () {
        need('owners', 'accounts');
        $r = q_one('SELECT r.*, u.email user_email, u.role user_role FROM owner_requests r JOIN users u ON u.id = r.user_id WHERE r.id = ?', [in_str('id')]) ?: fail('Không tìm thấy yêu cầu.');
        if ($r['status'] !== 'pending') fail('Yêu cầu này đã được xử lý.');
        $approve = in_str('decision') === 'approve';
        $note = mb_substr(in_str('note'), 0, 255);
        if (!$approve && mb_strlen($note) < 5) fail('Vui lòng ghi lý do từ chối (ít nhất 5 ký tự) để gửi cho người đăng ký.');
        q('UPDATE owner_requests SET status = ?, admin_note = ?, reviewed_by = ?, reviewed_at = NOW() WHERE id = ?',
            [$approve ? 'approved' : 'rejected', $note, admin_access()['actorName'], $r['id']]);
        if ($approve) {
            q("UPDATE users SET role = 'owner', business_name = ?, phone = IF(phone = '', ?, phone), address = IF(address = '', ?, address) WHERE id = ?",
                [$r['business_name'], $r['phone'], $r['address'], $r['user_id']]);
            push_notification((int) $r['user_id'], 'Đăng ký chủ sân đã được duyệt!', 'Chúc mừng bạn! Yêu cầu đăng ký cơ sở "' . $r['business_name'] . '" đã được phê duyệt. Kênh chủ sân đã sẵn sàng hoạt động.', 'system', '/chu-san');
        } else {
            push_notification((int) $r['user_id'], 'Yêu cầu đăng ký chủ sân chưa được duyệt', 'Lý do: ' . $note, 'system', '/dang-ky-chu-san');
        }
        // Khi duyệt đăng ký chủ sân: tự động khởi tạo sân mà chủ sân đã đăng ký (gắn đúng owner_id)
        if ($approve && !q_val('SELECT id FROM courts WHERE owner_id = ? AND name = ? AND deleted_at IS NULL', [$r['user_id'], $r['business_name']])) {
            $sport = ($r['sports'] === 'badminton') ? 'badminton' : 'football';
            $cid = 'oc-' . bin2hex(random_bytes(4));
            $slug = slugify($r['business_name']) ?: $cid;
            while (q_val('SELECT id FROM courts WHERE slug = ?', [$slug])) $slug .= '-' . random_int(2, 99);
            $price = $sport === 'badminton' ? 80000 : 180000;
            $peak = $sport === 'badminton' ? 100000 : 240000;
            $bands = [
                ['id' => 'morning', 'label' => 'Buổi sáng và chiều', 'shortLabel' => 'Sáng – chiều', 'start' => '05:00', 'end' => '17:00', 'price' => $price],
                ['id' => 'evening', 'label' => 'Buổi tối', 'shortLabel' => 'Tối', 'start' => '17:00', 'end' => '23:00', 'price' => $peak, 'peak' => true],
            ];
            $img = $sport === 'badminton' ? CATEGORY_IMAGE_BADMINTON : CATEGORY_IMAGE_FOOTBALL;
            q('INSERT INTO courts (id, slug, owner_id, name, sport, sport_label, area, address, price_per_hour, peak_price, price_bands, images, description, status, open_time, close_time, highlights, facilities, map_query) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
                [$cid, $slug, $r['user_id'], $r['business_name'], $sport, sport_label($sport), 'Tân Lợi', $r['address'] ?: 'TP. Buôn Ma Thuột', $price, $peak, j($bands), j([$img]), $r['note'] ?: ('Cơ sở ' . $r['business_name'] . ' tại Buôn Ma Thuột.'), 'active', '05:00', '23:00', j(['Sân mới đăng ký', 'Đặt lịch online 24/7']), j(['Bãi giữ xe', 'Nước uống']), $r['address'] ?: 'TP. Buôn Ma Thuột']);
        }
        audit('accounts', $approve ? 'Duyệt đăng ký chủ sân' : 'Từ chối đăng ký chủ sân', $r['business_name'] . ' · ' . $r['user_email'], $note, $approve ? 'success' : 'warning');
        return true;
    },

    'owner_create' => function () {
        need('owners', 'accounts');
        require_sudo();
        $name = in_str('fullName');
        $business = in_str('businessName');
        $email = strtolower(in_str('email'));
        $phone = preg_replace('/[^\d+]/', '', in_str('phone'));
        $address = in_str('address');
        $password = in_str('password') ?: '123456';
        if (mb_strlen($name) < 2) fail('Vui lòng nhập họ tên chủ sân.');
        if (mb_strlen($business) < 2) fail('Vui lòng nhập tên cơ sở / sân.');
        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) fail('Email không hợp lệ.');
        if (q_val('SELECT id FROM users WHERE email = ?', [$email])) fail('Email này đã được sử dụng.');
        if (strlen($password) < 6) fail('Mật khẩu tối thiểu 6 ký tự.');

        $hash = password_hash($password, PASSWORD_DEFAULT);
        q('INSERT INTO users (email, password_hash, full_name, phone, address, role, business_name, status, favorites) VALUES (?,?,?,?,?,?,?,?,?)',
            [$email, $hash, $name, $phone, $address, 'owner', $business, 'active', '[]']);
        audit('accounts', 'Thêm chủ sân mới', $business . ' · ' . $email, 'Admin tạo trực tiếp', 'success');
        return true;
    },

    'owner_edit' => function () {
        need('owners', 'accounts');
        require_sudo();
        $id = in_int('id');
        $u = q_one("SELECT * FROM users WHERE id = ? AND role = 'owner'", [$id]) ?: fail('Không tìm thấy chủ sân.');
        $name = in_str('fullName');
        $business = in_str('businessName');
        $phone = preg_replace('/[^\d+]/', '', in_str('phone'));
        $address = in_str('address');
        if (mb_strlen($name) < 2) fail('Vui lòng nhập họ tên chủ sân.');
        if (mb_strlen($business) < 2) fail('Vui lòng nhập tên cơ sở / sân.');

        $email = strtolower(in_str('email'));
        if ($email && $email !== $u['email']) {
            if (!filter_var($email, FILTER_VALIDATE_EMAIL)) fail('Email không hợp lệ.');
            if (q_val('SELECT id FROM users WHERE email = ? AND id != ?', [$email, $id])) fail('Email này đã được sử dụng.');
        } else {
            $email = $u['email'];
        }

        q('UPDATE users SET full_name = ?, business_name = ?, phone = ?, address = ?, email = ? WHERE id = ?',
            [$name, $business, $phone, $address, $email, $id]);
        audit('accounts', 'Sửa thông tin chủ sân', $business . ' · ' . $email, 'Cập nhật thông tin cơ sở', 'info');
        return true;
    },

    // ---------------- Sân ----------------
    'courts' => function () {
        need('courts');
        $names = owner_names();
        $bookings = q_all("SELECT court_id, COUNT(*) n, SUM(IF(status IN ('confirmed','completed'), total_price, 0)) rev FROM bookings GROUP BY court_id");
        $stat = array_column($bookings, null, 'court_id');
        return [
            'courts' => array_map(function ($r) use ($names, $stat) {
                $c = map_court($r);
                $c['ownerName'] = $c['ownerId'] ? ($names[$c['ownerId']] ?? 'Không rõ') : 'Hệ thống';
                $c['bookingCount'] = (int) ($stat[$c['id']]['n'] ?? 0);
                $c['revenue'] = (int) ($stat[$c['id']]['rev'] ?? 0);
                return $c;
            }, q_all('SELECT * FROM courts ORDER BY deleted_at IS NOT NULL, sort_order, created_at')),
            'owners' => array_map(fn($id, $n) => ['id' => $id, 'name' => $n], array_keys($names), $names),
        ];
    },

    'court_status' => function () {
        need('courts');
        $c = q_one('SELECT * FROM courts WHERE id = ?', [in_str('id')]) ?: fail('Không tìm thấy sân.');
        $status = in_str('status');
        if (!in_array($status, ['active', 'pending', 'maintenance', 'paused'], true)) fail('Trạng thái không hợp lệ.');
        q('UPDATE courts SET status = ? WHERE id = ?', [$status, $c['id']]);
        $actionLabel = $c['status'] === 'pending' && $status === 'active' ? 'Duyệt sân mới' : ($status === 'active' ? 'Mở lại sân' : 'Tạm dừng sân');
        audit('courts', $actionLabel, $c['name'], in_str('reason'), $status === 'active' ? 'success' : 'warning');
        return true;
    },

    'court_owner' => function () {
        need('courts');
        $c = q_one('SELECT * FROM courts WHERE id = ?', [in_str('id')]) ?: fail('Không tìm thấy sân.');
        $owner = in_int('ownerId');
        if ($owner && !q_val("SELECT id FROM users WHERE id = ? AND role = 'owner'", [$owner])) fail('Tài khoản được chọn không phải chủ sân.');
        q('UPDATE courts SET owner_id = ? WHERE id = ?', [$owner ?: null, $c['id']]);
        audit('courts', 'Đổi chủ sân phụ trách', $c['name'], $owner ? (owner_names()[$owner] ?? '') : 'Hệ thống', 'info');
        return true;
    },

    'court_featured' => function () {
        need('courts');
        $c = q_one('SELECT * FROM courts WHERE id = ?', [in_str('id')]) ?: fail('Không tìm thấy sân.');
        q('UPDATE courts SET featured = 1 - featured WHERE id = ?', [$c['id']]);
        audit('courts', $c['featured'] ? 'Bỏ nổi bật sân' : 'Đánh dấu sân nổi bật', $c['name']);
        return true;
    },

    'court_remove' => function () {
        need('courts');
        $c = q_one('SELECT * FROM courts WHERE id = ?', [in_str('id')]) ?: fail('Không tìm thấy sân.');
        if (input()['restore'] ?? false) {
            q("UPDATE courts SET deleted_at = NULL, status = 'paused' WHERE id = ?", [$c['id']]);
            audit('courts', 'Khôi phục sân', $c['name'], '', 'success');
        } else {
            q("UPDATE courts SET deleted_at = NOW(), status = 'paused' WHERE id = ?", [$c['id']]);
            audit('courts', 'Gỡ sân khỏi nền tảng', $c['name'], in_str('reason'), 'danger');
        }
        return true;
    },

    'court_save' => function () {
        need('courts');
        require_sudo();
        $id = in_str('id');
        $name = in_str('name');
        if (mb_strlen($name) < 3) fail('Tên sân cần ít nhất 3 ký tự.');
        $sport = in_str('sport') === 'badminton' ? 'badminton' : 'football';
        $price = in_int('pricePerHour');
        $peak = in_int('peakPrice') ?: $price;
        if ($price <= 0) fail('Vui lòng nhập giá thuê mỗi giờ.');
        $area = in_str('area') ?: 'Tân Lợi';
        $address = in_str('address') ?: 'Buôn Ma Thuột';
        $ownerId = in_int('ownerId') ?: null;
        $image = in_str('image') ?: 'https://images.unsplash.com/photo-1529900240041-22f114d18e40?w=1000';
        $status = in_array(in_str('status'), ['active', 'pending', 'maintenance', 'paused'], true) ? in_str('status') : 'active';
        $featured = in_int('featured') ? 1 : 0;
        $desc = in_str('description') ?: 'Sân thể thao chất lượng cao tại Buôn Ma Thuột.';

        $bands = [
            ['id' => 'morning', 'label' => 'Buổi sáng và chiều', 'shortLabel' => 'Sáng – chiều', 'start' => '05:00', 'end' => '17:00', 'price' => $price],
            ['id' => 'evening', 'label' => 'Buổi tối', 'shortLabel' => 'Tối', 'start' => '17:00', 'end' => '23:00', 'price' => $peak, 'peak' => true],
        ];

        if (!$id) {
            $num = (int) q_val('SELECT MAX(CAST(SUBSTRING(id, 2) AS UNSIGNED)) FROM courts');
            $id = 'c' . str_pad((string) ($num + 1), 2, '0', STR_PAD_LEFT);
            $slug = slugify($name);
            if (q_val('SELECT id FROM courts WHERE slug = ?', [$slug])) {
                $slug .= '-' . bin2hex(random_bytes(2));
            }
            q('INSERT INTO courts (id, slug, owner_id, name, sport, sport_label, area, address, price_per_hour, peak_price, price_bands, images, description, status, featured, open_time, close_time, highlights, facilities) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
                [$id, $slug, $ownerId, $name, $sport, sport_label($sport), $area, $address, $price, $peak, j($bands), j([$image]), $desc, $status, $featured, '05:00', '23:00', j(['Mặt sân mới', 'Đèn LED chiếu sáng']), j(['Bãi giữ xe', 'Nước uống'])]);
            audit('courts', 'Thêm sân mới', $name, "Tạo sân {$name} ({$area})", 'success');
            return ['id' => $id, 'created' => true];
        } else {
            $c = q_one('SELECT * FROM courts WHERE id = ?', [$id]) ?: fail('Không tìm thấy sân.');
            q('UPDATE courts SET name = ?, sport = ?, sport_label = ?, area = ?, address = ?, owner_id = ?, price_per_hour = ?, peak_price = ?, price_bands = ?, images = ?, description = ?, status = ?, featured = ? WHERE id = ?',
                [$name, $sport, sport_label($sport), $area, $address, $ownerId, $price, $peak, j($bands), j([$image]), $desc, $status, $featured, $id]);
            audit('courts', 'Cập nhật sân', $name, "Sửa thông tin sân {$name} (#{$id})", 'info');
            return ['id' => $id, 'created' => false];
        }
    },

    'court_delete_permanent' => function () {
        need('courts');
        require_sudo();
        $id = in_str('id');
        $c = q_one('SELECT * FROM courts WHERE id = ?', [$id]) ?: fail('Không tìm thấy sân.');
        $bookings = (int) q_val('SELECT COUNT(*) FROM bookings WHERE court_id = ?', [$id]);
        if ($bookings > 0) {
            fail("Sân này đã có {$bookings} đơn đặt trong lịch sử. Để bảo toàn dữ liệu đối soát tài chính, bạn hãy dùng chức năng 'Gỡ sân' thay vì xóa vĩnh viễn.");
        }
        q('DELETE FROM courts WHERE id = ?', [$id]);
        audit('courts', 'Xóa sân vĩnh viễn', $c['name'], "Đã xóa vĩnh viễn sân {$c['name']} khỏi hệ thống", 'danger');
        return true;
    },

    // ---------------- Đơn & hóa đơn ----------------
    'bookings' => function () {
        need('bookings');
        auto_cancel_expired_holds();
        return all_bookings();
    },

    'booking_status' => function () {
        need('bookings');
        auto_cancel_expired_holds();
        $b = q_one('SELECT * FROM bookings WHERE id = ?', [in_str('id')]) ?: fail('Không tìm thấy đơn.');
        $status = in_str('status');
        if (!in_array($status, ['confirmed', 'cancelled'], true)) fail('Trạng thái không hợp lệ.');
        $reason = $status === 'cancelled' ? (in_str('reason') ?: 'Quản trị viên từ chối đơn') : null;
        $now = date('Y-m-d H:i:s');

        if ($status === 'confirmed') {
            $slots = jd($b['slots']);
            $occ = occupied_slots($b['booking_date'], $b['id'])[$b['court_id']] ?? [];
            $blocked = blocked_slots_map($b['booking_date'], [$b['court_id']])[$b['court_id'] . ':' . $b['booking_date']] ?? [];
            $unavailable = array_intersect($slots, array_merge($occ, $blocked));
            if (!empty($unavailable)) {
                fail('Không thể duyệt đơn vì khung giờ ' . implode(', ', $unavailable) . ' ngày ' . $b['booking_date'] . ' đã bị trùng lịch với đơn khác hoặc đang bị khóa.');
            }
            if ($b['source'] === 'online' && (int) $b['deposit_amount'] > 0 && $b['payment_status'] === 'unpaid') {
                $holdExp = date('Y-m-d H:i:s', time() + HOLD_MINUTES * 60);
                q('UPDATE bookings SET approved_at = ?, hold_expires_at = ?, status = ?, reject_reason = NULL WHERE id = ?', [$now, $holdExp, 'confirmed', $b['id']]);
            } else {
                q('UPDATE bookings SET approved_at = COALESCE(approved_at, ?), hold_expires_at = NULL, status = ?, reject_reason = NULL WHERE id = ?', [$now, 'confirmed', $b['id']]);
                approve_deposit($b, $status);
            }
        } else {
            q('UPDATE bookings SET status = ?, reject_reason = ? WHERE id = ?', [$status, $reason, $b['id']]);
            approve_deposit($b, $status);
        }
<<<<<<< HEAD
=======

        $targetUserId = (int) ($b['customer_id'] ?? 0);
        if (!$targetUserId && !empty($b['customer_phone'])) {
            $targetUserId = (int) q_val('SELECT id FROM users WHERE phone = ?', [$b['customer_phone']]);
        }
        if ($targetUserId > 0) {
            if ($status === 'confirmed') {
                push_notification($targetUserId, 'Đơn đặt sân #' . $b['code'] . ' đã được duyệt!', 'Đơn đặt sân tại ' . ($b['court_name'] ?: 'sân thể thao') . ' ngày ' . date('d/m/Y', strtotime($b['booking_date'])) . ' đã được duyệt thành công.', 'booking', '/tai-khoan?tab=history');
            } else {
                push_notification($targetUserId, 'Đơn đặt sân #' . $b['code'] . ' đã bị hủy / từ chối', 'Lý do: ' . ($reason ?: 'Đơn đã bị hủy.') . '.', 'booking', '/tai-khoan?tab=history');
            }
        }
>>>>>>> Dev
        audit('bookings', $status === 'confirmed' ? 'Duyệt đơn đặt sân' : 'Từ chối đơn đặt sân', $b['code'] . ' · ' . $b['court_name'], (string) $reason, $status === 'confirmed' ? 'success' : 'warning');
        return map_booking(q_one(BOOKING_SELECT . ' WHERE b.id = ?', [$b['id']]));
    },

    'invoices' => function () {
        need('payments', 'invoices');
        return invoices_where('1');
    },

    // ---------------- Danh mục (Loại sân, Tiện ích, Khu vực) ----------------
    'categories' => function () {
        need('categories');
        $counts = [];
        foreach (q_all('SELECT sport, area, facilities FROM courts WHERE deleted_at IS NULL') as $c) {
            $counts['sport:' . $c['sport']] = ($counts['sport:' . $c['sport']] ?? 0) + 1;
            $counts['area:' . $c['area']] = ($counts['area:' . $c['area']] ?? 0) + 1;
            foreach (jd($c['facilities']) as $fac) {
                $k = 'amenity:' . mb_strtolower(trim((string) $fac));
                $counts[$k] = ($counts[$k] ?? 0) + 1;
            }
        }
        return array_map(fn($r) => [
            'id' => $r['id'], 'kind' => $r['kind'], 'name' => $r['name'], 'slug' => $r['slug'], 'description' => $r['description'], 'icon' => $r['icon'],
            'sortOrder' => (int) $r['sort_order'], 'active' => (bool) $r['active'],
            'courtCount' => $r['kind'] === 'amenity'
                ? ($counts['amenity:' . mb_strtolower(trim($r['name']))] ?? 0)
                : ($counts[$r['kind'] . ':' . ($r['kind'] === 'sport' ? $r['slug'] : $r['name'])] ?? 0),
        ], q_all('SELECT * FROM categories ORDER BY kind, sort_order, name'));
    },

    'category_save' => function () {
        need('categories');
        if (admin_access()['roleKey'] !== 'super_admin') fail('Chỉ Quản trị hệ thống mới có quyền thêm/sửa danh mục. Nhân viên chỉ có quyền xem.');
        $name = in_str('name');
        if (mb_strlen($name) < 2) fail('Vui lòng nhập tên danh mục.');
        $kind = in_array(in_str('kind'), ['sport', 'area', 'amenity'], true) ? in_str('kind') : 'sport';
        $vals = [$kind, $name, in_str('slug') ?: slugify($name), in_str('description'), in_str('icon') ?: 'ri-price-tag-3-line', in_int('sortOrder'), (input()['active'] ?? true) ? 1 : 0];
        if ($id = in_str('id')) {
            q('UPDATE categories SET kind=?, name=?, slug=?, description=?, icon=?, sort_order=?, active=? WHERE id = ?', array_merge($vals, [$id]));
            audit('categories', 'Cập nhật danh mục', $name);
        } else {
            q('INSERT INTO categories (kind, name, slug, description, icon, sort_order, active, id) VALUES (?,?,?,?,?,?,?,?)', array_merge($vals, [uid('cat-')]));
            audit('categories', 'Thêm danh mục', $name, '', 'success');
        }
        return true;
    },

    'category_toggle' => function () {
        need('categories');
        if (admin_access()['roleKey'] !== 'super_admin') fail('Chỉ Quản trị hệ thống mới có quyền ẩn/hiện danh mục. Nhân viên chỉ có quyền xem.');
        $c = q_one('SELECT * FROM categories WHERE id = ?', [in_str('id')]) ?: fail('Không tìm thấy danh mục.');
        $newActive = $c['active'] ? 0 : 1;
        q('UPDATE categories SET active = ? WHERE id = ?', [$newActive, $c['id']]);
        audit('categories', $newActive ? 'Hiện danh mục' : 'Ẩn danh mục', $c['name'], '', $newActive ? 'success' : 'warning');
        return true;
    },

    'category_delete' => function () {
        need('categories');
        if (admin_access()['roleKey'] !== 'super_admin') fail('Chỉ Quản trị hệ thống mới có quyền xóa danh mục. Nhân viên chỉ có quyền xem.');
        $c = q_one('SELECT * FROM categories WHERE id = ?', [in_str('id')]) ?: fail('Không tìm thấy danh mục.');
        q('DELETE FROM categories WHERE id = ?', [$c['id']]);
        audit('categories', 'Xóa danh mục', $c['name'], '', 'danger');
        return true;
    },

    // ---------------- Nội dung ----------------
    'contents' => function () {
        need('content');
        return array_map(fn($r) => [
            'id' => $r['id'], 'kind' => $r['kind'], 'title' => $r['title'], 'slug' => $r['slug'], 'summary' => $r['summary'], 'body' => (string) $r['body'],
            'image' => $r['image'], 'linkUrl' => $r['link_url'], 'status' => $r['status'], 'pinned' => (bool) $r['pinned'], 'sortOrder' => (int) $r['sort_order'],
            'updatedAt' => iso($r['updated_at']),
        ], q_all('SELECT * FROM contents ORDER BY kind, pinned DESC, sort_order, updated_at DESC'));
    },

    'content_save' => function () {
        need('content');
        $title = in_str('title');
        if (mb_strlen($title) < 3) fail('Tiêu đề cần ít nhất 3 ký tự.');
        $kind = in_array(in_str('kind'), ['banner', 'news', 'faq', 'policy'], true) ? in_str('kind') : 'news';
        $status = in_array(in_str('status'), ['draft', 'published', 'archived'], true) ? in_str('status') : 'draft';
        $vals = [$kind, $title, slugify($title), in_str('summary'), in_str('body'), in_str('image'), in_str('linkUrl'), $status, (input()['pinned'] ?? false) ? 1 : 0, in_int('sortOrder')];
        if ($id = in_str('id')) {
            q('UPDATE contents SET kind=?, title=?, slug=?, summary=?, body=?, image=?, link_url=?, status=?, pinned=?, sort_order=? WHERE id = ?', array_merge($vals, [$id]));
            audit('content', 'Cập nhật nội dung', $title);
        } else {
            q('INSERT INTO contents (kind, title, slug, summary, body, image, link_url, status, pinned, sort_order, id) VALUES (?,?,?,?,?,?,?,?,?,?,?)', array_merge($vals, [uid('ct-')]));
            audit('content', 'Đăng nội dung mới', $title, '', 'success');
        }
        return true;
    },

    'content_delete' => function () {
        need('content');
        $c = q_one('SELECT * FROM contents WHERE id = ?', [in_str('id')]) ?: fail('Không tìm thấy nội dung.');
        q('DELETE FROM contents WHERE id = ?', [$c['id']]);
        audit('content', 'Xóa nội dung', $c['title'], '', 'danger');
        return true;
    },

    // ---------------- Kiểm duyệt ----------------
    'moderation' => function () {
        need('moderation');
        return [
            'reviews' => array_map('map_review', q_all(REVIEW_SELECT . ' ORDER BY FIELD(r.moderation_status, "pending", "hidden", "approved"), r.created_at DESC')),
            'reports' => array_map(fn($r) => [
                'id' => $r['id'], 'targetType' => $r['target_type'], 'targetId' => $r['target_id'], 'targetLabel' => $r['target_label'],
                'reporterName' => $r['reporter_name'], 'reporterContact' => $r['reporter_contact'], 'reason' => $r['reason'], 'detail' => (string) $r['detail'],
                'severity' => $r['severity'], 'status' => $r['status'], 'resolutionNote' => $r['resolution_note'], 'resolvedAt' => iso($r['resolved_at']), 'createdAt' => iso($r['created_at']),
            ], q_all('SELECT * FROM reports ORDER BY FIELD(status, "open", "reviewing", "resolved", "rejected"), created_at DESC')),
        ];
    },

    'review_moderate' => function () {
        need('moderation');
        $r = q_one('SELECT r.*, c.name court_name FROM reviews r JOIN courts c ON c.id = r.court_id WHERE r.id = ?', [in_str('id')]) ?: fail('Không tìm thấy đánh giá.');
        $status = in_array(in_str('status'), ['approved', 'hidden', 'pending'], true) ? in_str('status') : 'approved';
        $note = mb_substr(in_str('note'), 0, 250);
        if ($status === 'hidden' && mb_strlen($note) < 5) fail('Vui lòng ghi lý do ẩn đánh giá (ít nhất 5 ký tự).');
        q('UPDATE reviews SET moderation_status = ?, moderation_note = ?, moderated_by = ? WHERE id = ?', [$status, $note, admin_access()['actorName'], $r['id']]);
        // Cập nhật lại điểm trung bình của sân (chỉ tính đánh giá đang hiển thị)
        $agg = q_one("SELECT COUNT(*) n, AVG(rating) avg FROM reviews WHERE court_id = ? AND moderation_status = 'approved'", [$r['court_id']]);
        if ($agg['n'] > 0) q('UPDATE courts SET rating = ?, review_count = ? WHERE id = ?', [round($agg['avg'], 1), $agg['n'], $r['court_id']]);
        audit('moderation', $status === 'hidden' ? 'Ẩn đánh giá' : 'Duyệt hiển thị đánh giá', $r['customer_name'] . ' · ' . $r['court_name'], $note, $status === 'hidden' ? 'warning' : 'success');
        return true;
    },

    'report_update' => function () {
        need('moderation');
        $r = q_one('SELECT * FROM reports WHERE id = ?', [in_str('id')]) ?: fail('Không tìm thấy báo cáo.');
        $status = in_array(in_str('status'), ['open', 'reviewing', 'resolved', 'rejected'], true) ? in_str('status') : 'reviewing';
        $note = mb_substr(in_str('note'), 0, 500);
        if (in_array($status, ['resolved', 'rejected'], true) && mb_strlen($note) < 5) fail('Vui lòng ghi kết quả xử lý (ít nhất 5 ký tự).');
        q('UPDATE reports SET status = ?, resolution_note = ?, resolved_at = ? WHERE id = ?', [$status, $note, in_array($status, ['resolved', 'rejected'], true) ? now_sql() : null, $r['id']]);
        $labels = ['open' => 'Mở lại báo cáo', 'reviewing' => 'Tiếp nhận báo cáo', 'resolved' => 'Xử lý xong báo cáo', 'rejected' => 'Bác bỏ báo cáo'];
        audit('moderation', $labels[$status], $r['target_label'], $note, $status === 'resolved' ? 'success' : 'info');
        return true;
    },

    // ---------------- Khuyến mãi ----------------
    'promotions' => function () {
        need('content', 'promotions');
        $uses = q_all("SELECT code, promo_code, discount_amount, total_price, customer_name, court_name, booking_date, status, created_at FROM bookings WHERE promo_code IS NOT NULL ORDER BY created_at DESC");
        return [
            'promotions' => array_map('map_promotion', q_all('SELECT * FROM promotions ORDER BY updated_at DESC')),
            'redemptions' => array_map(fn($r) => ['bookingCode' => $r['code'], 'code' => $r['promo_code'], 'discount' => (int) $r['discount_amount'], 'paidTotal' => (int) $r['total_price'],
                'customerName' => $r['customer_name'], 'courtName' => $r['court_name'], 'bookingDate' => $r['booking_date'], 'status' => $r['status'], 'createdAt' => iso($r['created_at'])], $uses),
        ];
    },

    'promotion_status' => function () {
        need('content', 'promotions');
        $p = q_one('SELECT * FROM promotions WHERE id = ?', [in_str('id')]) ?: fail('Không tìm thấy mã.');
        $status = in_str('status') === 'paused' ? 'paused' : 'active';
        q('UPDATE promotions SET status = ? WHERE id = ?', [$status, $p['id']]);
        audit('promotions', $status === 'paused' ? 'Tạm dừng mã giảm giá' : 'Mở lại mã giảm giá', $p['code'], '', 'warning');
        return true;
    },

    // ---------------- Nhật ký ----------------
    'audit' => function () {
        need('settings', 'audit');
        return array_map(fn($a) => ['id' => (int) $a['id'], 'actorName' => $a['actor_name'], 'actorRole' => $a['actor_role'], 'module' => $a['module'], 'action' => $a['action'],
            'targetLabel' => $a['target_label'], 'detail' => $a['detail'], 'level' => $a['level'], 'createdAt' => iso($a['created_at'])],
            q_all('SELECT * FROM audit_logs ORDER BY id DESC LIMIT 500'));
    },

    // ---------------- Thanh toán & đối soát (Chuyển tiền chủ sân + Hoàn tiền) ----------------
    'payouts' => function () {
        need('payments');
        $payouts = array_map(fn($r) => [
            'id' => $r['id'], 'ownerId' => (int) $r['owner_id'], 'ownerName' => $r['owner_name'], 'periodLabel' => $r['period_label'],
            'grossAmount' => (int) $r['gross_amount'], 'commissionRate' => (int) $r['commission_rate'],
            'commissionAmount' => (int) $r['commission_amount'], 'netAmount' => (int) $r['net_amount'],
            'status' => $r['status'], 'note' => $r['note'], 'transferredAt' => iso($r['transferred_at']), 'createdAt' => iso($r['created_at']),
        ], q_all('SELECT * FROM payouts ORDER BY FIELD(status, "pending", "transferred"), created_at DESC'));
        $owners = q_all("SELECT u.id, u.full_name, u.business_name, os.bank_name, os.bank_account, os.bank_holder,
                            (SELECT COALESCE(SUM(b.total_price), 0) FROM bookings b JOIN courts c ON c.id = b.court_id WHERE c.owner_id = u.id AND b.status IN ('confirmed','completed') AND b.source = 'online') online_rev
                         FROM users u LEFT JOIN owner_settings os ON os.owner_id = u.id WHERE u.role = 'owner' ORDER BY u.full_name");
        return [
            'payouts' => $payouts,
            'owners' => array_map(fn($o) => [
                'id' => (int) $o['id'], 'name' => $o['business_name'] ?: $o['full_name'],
                'bankName' => (string) ($o['bank_name'] ?? ''), 'bankAccount' => (string) ($o['bank_account'] ?? ''), 'bankHolder' => (string) ($o['bank_holder'] ?? ''),
                'onlineRevenue' => (int) $o['online_rev'],
            ], $owners),
        ];
    },

    'payout_create' => function () {
        need('payments');
        $ownerId = in_int('ownerId');
        $owner = q_one("SELECT id, full_name, business_name FROM users WHERE id = ? AND role = 'owner'", [$ownerId]) ?: fail('Không tìm thấy chủ sân.');
        $gross = max(0, in_int('grossAmount'));
        if ($gross <= 0) fail('Doanh thu đối soát phải lớn hơn 0.');
        $rate = max(0, min(50, in_int('commissionRate', 5)));
        $comm = (int) round($gross * $rate / 100);
        $net = max(0, $gross - $comm);
        $period = in_str('periodLabel') ?: ('Tháng ' . date('m/Y'));
        q('INSERT INTO payouts (id, owner_id, owner_name, period_label, gross_amount, commission_rate, commission_amount, net_amount, status, note) VALUES (?,?,?,?,?,?,?,?,"pending",?)',
            [uid('po-'), $owner['id'], $owner['business_name'] ?: $owner['full_name'], $period, $gross, $rate, $comm, $net, mb_substr(in_str('note'), 0, 250)]);
        audit('payments', 'Tạo phiếu đối soát chủ sân', ($owner['business_name'] ?: $owner['full_name']) . ' · ' . $period, 'Thực chuyển: ' . money($net), 'info');
        return true;
    },

    'payout_transfer' => function () {
        need('payments');
        $p = q_one('SELECT * FROM payouts WHERE id = ?', [in_str('id')]) ?: fail('Không tìm thấy phiếu đối soát.');
        q("UPDATE payouts SET status = 'transferred', transferred_at = NOW(), note = IF(? <> '', ?, note) WHERE id = ?", [in_str('note'), in_str('note'), $p['id']]);
        push_notification((int) $p['owner_id'], 'Đã nhận tiền đối soát ' . $p['period_label'], 'Hệ thống đã chuyển khoản ' . money((int) $p['net_amount']) . ' về tài khoản ngân hàng của bạn.', 'payment', '/chu-san?tab=payments');
        audit('payments', 'Xác nhận chuyển tiền chủ sân', $p['owner_name'] . ' · ' . $p['period_label'], money((int) $p['net_amount']), 'success');
        return true;
    },

    'refunds_all' => function () {
        need('payments');
        $refunds = array_map(fn($r) => [
            'id' => $r['id'], 'bookingCode' => $r['booking_code'], 'customerName' => $r['customer_name'], 'courtName' => $r['court_name'],
            'amount' => (int) $r['amount'], 'method' => $r['method'], 'note' => $r['note'], 'createdAt' => iso($r['created_at']),
        ], q_all('SELECT * FROM refunds ORDER BY created_at DESC LIMIT 100'));
        $pendingRefunds = array_map('map_booking', q_all(BOOKING_SELECT . " WHERE b.status = 'cancelled' AND b.payment_status IN ('deposit_paid','paid') ORDER BY b.updated_at DESC LIMIT 50"));
        return ['refunds' => $refunds, 'pending' => $pendingRefunds];
    },

    // ---------------- Báo cáo doanh thu ----------------
    'reports_revenue' => function () {
        need('reports', 'overview');
        $days = in_array(in_int('days', 30), [7, 30, 90], true) ? in_int('days', 30) : 30;
        $from = date('Y-m-d', strtotime('-' . ($days - 1) . ' days'));
        $rows = q_all("SELECT b.*, c.owner_id, u.business_name, u.full_name owner_full FROM bookings b
                       LEFT JOIN courts c ON c.id = b.court_id LEFT JOIN users u ON u.id = c.owner_id
                       WHERE b.status IN ('confirmed','completed') AND b.booking_date >= ? ORDER BY b.booking_date ASC", [$from]);
        $byDate = [];
        $byOwner = [];
        $byCourt = [];
        $bySport = ['football' => 0, 'badminton' => 0];
        $totalRev = 0;
        foreach ($rows as $r) {
            $amt = (int) $r['total_price'];
            $totalRev += $amt;
            $d = $r['booking_date'];
            $byDate[$d] = ($byDate[$d] ?? 0) + $amt;
            $sp = $r['sport'] === 'badminton' ? 'badminton' : 'football';
            $bySport[$sp] += $amt;
            $oname = $r['business_name'] ?: ($r['owner_full'] ?: 'Hệ thống');
            if (!isset($byOwner[$oname])) $byOwner[$oname] = ['name' => $oname, 'bookings' => 0, 'revenue' => 0];
            $byOwner[$oname]['bookings']++;
            $byOwner[$oname]['revenue'] += $amt;
            $cname = $r['court_name'];
            if (!isset($byCourt[$cname])) $byCourt[$cname] = ['name' => $cname, 'sport' => $sp, 'bookings' => 0, 'revenue' => 0];
            $byCourt[$cname]['bookings']++;
            $byCourt[$cname]['revenue'] += $amt;
        }
        usort($byOwner, fn($a, $b) => $b['revenue'] <=> $a['revenue']);
        usort($byCourt, fn($a, $b) => $b['revenue'] <=> $a['revenue']);
        return [
            'days' => $days, 'from' => $from, 'to' => date('Y-m-d'),
            'totalRevenue' => $totalRev, 'totalBookings' => count($rows),
            'avgOrder' => count($rows) ? (int) round($totalRev / count($rows)) : 0,
            'byDate' => $byDate, 'bySport' => $bySport,
            'byOwner' => array_values($byOwner), 'byCourt' => array_slice(array_values($byCourt), 0, 12),
        ];
    },

    // ---------------- Quản lý AI & Cấu hình hệ thống ----------------
    'settings_get' => function () {
        need('settings', 'ai');
        $cfg = system_settings_all();
        $cfg['ai_quick_replies_list'] = jd($cfg['ai_quick_replies'] ?? '[]');
        $cfg['ai_custom_qa_list'] = jd($cfg['ai_custom_qa'] ?? '[]');

        // Bổ sung siêu dữ liệu nhà cung cấp Chatbot AI
        $st = chatbot_status();
        $cfg['chatbot_provider'] = $st['provider'];
        $cfg['chatbot_key_configured'] = $st['configured'];
        $cfg['chatbot_model'] = $st['model'];
        $cfg['chatbot_enabled'] = $st['enabled'];
        $cfg['ai_provider'] = $st['provider'];
        $cfg['ai_model'] = $st['model'];
        $cfg['ai_key_configured'] = $st['configured'];
        return $cfg;
    },

    'settings_save' => function () {
        need('settings', 'ai');
        $in = input();
        $allowed = ['site_name', 'hotline', 'support_email', 'site_address', 'bank_id', 'bank_name', 'bank_account', 'bank_holder',
            'deposit_rate', 'hold_minutes', 'cancel_cutoff_hours', 'general_policy', 'ai_enabled', 'ai_bot_name', 'ai_greeting',
            'ai_quick_replies', 'ai_fallback_reply', 'ai_custom_qa', 'ai_provider', 'ai_model', 'ai_api_key'];
        $pairs = [];
        foreach ($allowed as $k) {
            if (array_key_exists($k, $in)) {
                $val = is_array($in[$k]) ? j($in[$k]) : (string) $in[$k];
                if ($k === 'ai_api_key' && (trim($val) === '' || str_contains($val, '***'))) {
                    continue;
                }
                $pairs[$k] = $val;
            }
        }
        if ($pairs) {
            system_settings_save($pairs);
            $isAi = isset($pairs['ai_bot_name']) || isset($pairs['ai_enabled']) || isset($pairs['ai_custom_qa']) || isset($pairs['ai_provider']) || isset($pairs['ai_model']) || isset($pairs['ai_api_key']);
            audit($isAi ? 'ai' : 'settings', $isAi ? 'Cập nhật cấu hình Chatbot AI' : 'Cập nhật cấu hình hệ thống', implode(', ', array_keys($pairs)), '', 'success');
        }
        return true;
    },

    'ai_test' => function () {
        need('ai');
        $raw = input();
        $provider = !empty($raw['provider']) ? trim((string)$raw['provider']) : (!empty($raw['ai_provider']) ? trim((string)$raw['ai_provider']) : null);
        $apiKey = !empty($raw['api_key']) ? trim((string)$raw['api_key']) : (!empty($raw['ai_api_key']) ? trim((string)$raw['ai_api_key']) : null);
        $model = !empty($raw['model']) ? trim((string)$raw['model']) : (!empty($raw['ai_model']) ? trim((string)$raw['ai_model']) : null);
        return chatbot_test_connection($provider, $apiKey, $model);
    },
]);