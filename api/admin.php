<?php
/**
 * API QUẢN TRỊ — mỗi action kiểm tra quyền theo module (admin_access()['allowed']) và ghi nhật ký thao tác.
 */
require_once __DIR__ . '/../includes/bootstrap.php';

$ADMIN = api_require_admin();
const ROLE_LABELS = ['customer' => 'Khách hàng', 'owner' => 'Chủ sân', 'admin' => 'Quản trị viên'];

function need(string $module): void
{
    api_require_admin($module);
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

    'account_role' => function () {
        need('accounts');
        $id = in_int('id');
        $role = in_str('role');
        if (!isset(ROLE_LABELS[$role])) fail('Vai trò không hợp lệ.');
        if ($id === (int) current_user()['id']) fail('Bạn không thể tự đổi vai trò của chính mình.');
        $u = q_one('SELECT * FROM users WHERE id = ?', [$id]) ?: fail('Không tìm thấy tài khoản.');
        q('UPDATE users SET role = ?, business_name = IF(? = "owner" AND business_name = "", full_name, business_name) WHERE id = ?', [$role, $role, $id]);
        if ($role !== 'admin') q('DELETE FROM admin_role_assignments WHERE user_id = ?', [$id]);
        audit('accounts', 'Đổi vai trò tài khoản', $u['email'], ROLE_LABELS[$u['role']] . ' → ' . ROLE_LABELS[$role], 'warning');
        return true;
    },

    'account_status' => function () {
        need('accounts');
        $id = in_int('id');
        if ($id === (int) current_user()['id']) fail('Bạn không thể tự khóa tài khoản của chính mình.');
        $u = q_one('SELECT * FROM users WHERE id = ?', [$id]) ?: fail('Không tìm thấy tài khoản.');
        $status = in_str('status') === 'suspended' ? 'suspended' : 'active';
        q('UPDATE users SET status = ? WHERE id = ?', [$status, $id]);
        audit('accounts', $status === 'suspended' ? 'Tạm khóa tài khoản' : 'Mở khóa tài khoản', $u['email'], in_str('reason'), $status === 'suspended' ? 'danger' : 'success');
        return true;
    },

    'assign_admin_role' => function () {
        need('accounts');
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
        $key = in_str('key');
        if ($key === 'super_admin') fail('Không thể xóa bộ quyền Quản trị cấp cao.');
        if (q_val('SELECT COUNT(*) FROM admin_role_assignments WHERE role_key = ?', [$key])) fail('Bộ quyền đang được gán cho tài khoản, hãy thu hồi trước.');
        q('DELETE FROM admin_roles WHERE `key` = ?', [$key]);
        audit('accounts', 'Xóa bộ quyền', $key, '', 'danger');
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
        if (!in_array($status, ['active', 'maintenance', 'paused'], true)) fail('Trạng thái không hợp lệ.');
        q('UPDATE courts SET status = ? WHERE id = ?', [$status, $c['id']]);
        audit('courts', $status === 'active' ? 'Mở lại sân' : 'Tạm dừng sân', $c['name'], in_str('reason'), $status === 'active' ? 'success' : 'warning');
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

    // ---------------- Đơn & hóa đơn ----------------
    'bookings' => function () {
        need('bookings');
        return all_bookings();
    },

    'booking_status' => function () {
        need('bookings');
        $b = q_one('SELECT * FROM bookings WHERE id = ?', [in_str('id')]) ?: fail('Không tìm thấy đơn.');
        $status = in_str('status');
        if (!in_array($status, ['confirmed', 'cancelled'], true)) fail('Trạng thái không hợp lệ.');
        $reason = $status === 'cancelled' ? (in_str('reason') ?: 'Quản trị viên từ chối đơn') : null;
        q('UPDATE bookings SET status = ?, reject_reason = ? WHERE id = ?', [$status, $reason, $b['id']]);
        audit('bookings', $status === 'confirmed' ? 'Duyệt đơn đặt sân' : 'Từ chối đơn đặt sân', $b['code'] . ' · ' . $b['court_name'], (string) $reason, $status === 'confirmed' ? 'success' : 'warning');
        return map_booking(q_one(BOOKING_SELECT . ' WHERE b.id = ?', [$b['id']]));
    },

    'invoices' => function () {
        need('invoices');
        return invoices_where('1');
    },

    // ---------------- Danh mục ----------------
    'categories' => function () {
        need('categories');
        $counts = [];
        foreach (q_all('SELECT sport, area FROM courts WHERE deleted_at IS NULL') as $c) {
            $counts['sport:' . $c['sport']] = ($counts['sport:' . $c['sport']] ?? 0) + 1;
            $counts['area:' . $c['area']] = ($counts['area:' . $c['area']] ?? 0) + 1;
        }
        return array_map(fn($r) => [
            'id' => $r['id'], 'kind' => $r['kind'], 'name' => $r['name'], 'slug' => $r['slug'], 'description' => $r['description'], 'icon' => $r['icon'],
            'sortOrder' => (int) $r['sort_order'], 'active' => (bool) $r['active'],
            'courtCount' => $counts[$r['kind'] . ':' . ($r['kind'] === 'sport' ? $r['slug'] : $r['name'])] ?? 0,
        ], q_all('SELECT * FROM categories ORDER BY kind, sort_order, name'));
    },

    'category_save' => function () {
        need('categories');
        $name = in_str('name');
        if (mb_strlen($name) < 2) fail('Vui lòng nhập tên danh mục.');
        $kind = in_str('kind') === 'area' ? 'area' : 'sport';
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

    'category_delete' => function () {
        need('categories');
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
        need('promotions');
        $uses = q_all("SELECT code, promo_code, discount_amount, total_price, customer_name, court_name, booking_date, status, created_at FROM bookings WHERE promo_code IS NOT NULL ORDER BY created_at DESC");
        return [
            'promotions' => array_map('map_promotion', q_all('SELECT * FROM promotions ORDER BY updated_at DESC')),
            'redemptions' => array_map(fn($r) => ['bookingCode' => $r['code'], 'code' => $r['promo_code'], 'discount' => (int) $r['discount_amount'], 'paidTotal' => (int) $r['total_price'],
                'customerName' => $r['customer_name'], 'courtName' => $r['court_name'], 'bookingDate' => $r['booking_date'], 'status' => $r['status'], 'createdAt' => iso($r['created_at'])], $uses),
        ];
    },

    'promotion_status' => function () {
        need('promotions');
        $p = q_one('SELECT * FROM promotions WHERE id = ?', [in_str('id')]) ?: fail('Không tìm thấy mã.');
        $status = in_str('status') === 'paused' ? 'paused' : 'active';
        q('UPDATE promotions SET status = ? WHERE id = ?', [$status, $p['id']]);
        audit('promotions', $status === 'paused' ? 'Tạm dừng mã giảm giá' : 'Mở lại mã giảm giá', $p['code'], '', 'warning');
        return true;
    },

    // ---------------- Nhật ký ----------------
    'audit' => function () {
        need('audit');
        return array_map(fn($a) => ['id' => (int) $a['id'], 'actorName' => $a['actor_name'], 'actorRole' => $a['actor_role'], 'module' => $a['module'], 'action' => $a['action'],
            'targetLabel' => $a['target_label'], 'detail' => $a['detail'], 'level' => $a['level'], 'createdAt' => iso($a['created_at'])],
            q_all('SELECT * FROM audit_logs ORDER BY id DESC LIMIT 500'));
    },
]);
