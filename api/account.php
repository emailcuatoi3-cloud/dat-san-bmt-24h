<?php
/*
 * Module: API Quản lý Tài khoản & Đơn hàng (Mã Minh Hoan - PK04409)
 * - Phân quyền truy xuất đơn theo tài khoản đăng nhập hoặc mã vé trên thiết bị
 * - Xử lý tra cứu đơn, hủy đơn (ràng buộc mốc 4 giờ), xuất hóa đơn, lưu sân yêu thích
 * - Cập nhật thông tin hồ sơ cá nhân và đổi mật khẩu bảo mật
 */
/**
 * API tài khoản khách hàng: đơn của tôi, tra cứu đơn, hủy đơn, hóa đơn, sân yêu thích, hồ sơ, đổi mật khẩu.
 * Khách vãng lai vẫn xem được đơn qua danh sách mã vé lưu trên thiết bị (localStorage).
 */
require_once __DIR__ . '/../includes/bootstrap.php';

/** Điều kiện SQL lấy các đơn "của tôi": theo tài khoản / số điện thoại / mã vé trên thiết bị. */
function my_scope(array $codes): array
{
    $codes = array_values(array_unique(array_filter(array_map(fn($c) => strtoupper(trim((string) $c)), $codes))));
    $where = [];
    $params = [];
    if ($codes) {
        $where[] = 'b.code IN (' . in_list($codes) . ')';
        $params = $codes;
    }
    if ($u = current_user()) {
        $where[] = 'b.customer_id = ?';
        $params[] = $u['id'];
        $phone = preg_replace('/\D/', '', $u['phone']);
        if ($phone) {
            $where[] = "REPLACE(b.customer_phone, ' ', '') = ?";
            $params[] = $phone;
        }
    }
    return [$where ? '(' . implode(' OR ', $where) . ')' : '0', $params];
}

function owns_booking(array $b, array $codes): bool
{
    $u = current_user();
    if (in_array($b['code'], array_map('strtoupper', $codes), true)) return true;
    if (!$u) return false;
    return (int) $b['customer_id'] === (int) $u['id'] || preg_replace('/\D/', '', $b['customer_phone']) === preg_replace('/\D/', '', $u['phone']);
}

run_api([
    'bookings' => function () {
        auto_cancel_expired_holds();
        auto_complete_bookings();
        [$where, $params] = my_scope(in_arr('codes'));
        $rows = q_all(BOOKING_SELECT . " WHERE b.source = 'online' AND $where ORDER BY b.booking_date DESC, b.created_at DESC", $params);
        $list = array_map('map_booking', $rows);
        $codes = array_column($list, 'code');
        $reviewed = $codes ? array_column(q_all('SELECT booking_code FROM reviews WHERE booking_id IS NOT NULL AND booking_code IN (' . in_list($codes) . ')', $codes), 'booking_code') : [];
        return ['bookings' => $list, 'reviewed' => $reviewed];
    },

    'lookup' => function () {
        $code = strtoupper(in_str('code'));
        $phone = preg_replace('/\s/', '', in_str('phone'));
        $row = q_one(BOOKING_SELECT . ' WHERE b.code = ?', [$code]);
        if (!$row) fail('Không tìm thấy đơn với mã này. Bạn kiểm tra lại mã in trên vé điện tử nhé.');
        if (preg_replace('/\s/', '', $row['customer_phone']) !== $phone) fail('Số điện thoại không khớp với đơn đặt sân này. Vui lòng thử lại.');
        return map_booking($row);
    },

    'cancel' => function () {
        $row = q_one('SELECT * FROM bookings WHERE id = ?', [in_str('id')]);
        if (!$row || !owns_booking($row, in_arr('codes'))) fail('Không tìm thấy đơn của bạn.');
        if (!in_array($row['status'], ['pending', 'confirmed'], true)) fail('Đơn này không còn hiệu lực để hủy.');
        $start = strtotime($row['booking_date'] . ' ' . $row['start_slot']);
        if ($start - time() < CANCEL_CUTOFF_HOURS * 3600) {
            fail('Đã qua mốc hủy ' . CANCEL_CUTOFF_HOURS . ' giờ — vui lòng gọi ' . HOTLINE . ' để chủ sân hỗ trợ.');
        }
        $reason = mb_substr(in_str('reason'), 0, 250) ?: 'Khách hàng đã hủy đơn';
        q("UPDATE bookings SET status = 'cancelled', cancel_reason = ? WHERE id = ?", [$reason, $row['id']]);
        return map_booking(q_one(BOOKING_SELECT . ' WHERE b.id = ?', [$row['id']]));
    },

    'invoices' => function () {
        [$where, $params] = my_scope(in_arr('codes'));
        return invoices_where("b.source = 'online' AND $where", $params);
    },

    'toggle_favorite' => function () {
        $u = api_require_login();
        $slug = in_str('slug');
        if (!find_court($slug)) fail('Không tìm thấy sân.');
        $fav = jd($u['favorites']);
        $added = !in_array($slug, $fav, true);
        $fav = $added ? array_merge($fav, [$slug]) : array_values(array_diff($fav, [$slug]));
        q('UPDATE users SET favorites = ? WHERE id = ?', [j(array_values($fav)), $u['id']]);
        return ['favorites' => array_values($fav), 'added' => $added];
    },

    'update_profile' => function () {
        if (impersonating_admin()) fail('Đang trong chế độ Ghost Login: Không thể sửa đổi thông tin của người dùng.');
        $u = api_require_login();
        $name = in_str('name');
        $phone = preg_replace('/[^\d+]/', '', in_str('phone'));
        $email = mb_strtolower(in_str('email'));
        $address = in_str('address');
        if (mb_strlen($name) < 2) fail('Vui lòng nhập họ tên đầy đủ.');
        if (!preg_match('/^0\d{9,10}$/', $phone) && !preg_match('/^\+84\d{9,10}$/', $phone)) fail('Số điện thoại chưa đúng. Ví dụ: 0912345678.');
        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) fail('Email chưa đúng định dạng.');
        if (q_val('SELECT id FROM users WHERE email = ? AND id <> ?', [$email, $u['id']])) fail('Email này đã được tài khoản khác sử dụng.');
        q('UPDATE users SET full_name = ?, phone = ?, email = ?, address = ?, business_name = ? WHERE id = ?',
            [$name, $phone, $email, $address, $u['role'] === 'owner' ? (in_str('businessName') ?: $u['business_name']) : $u['business_name'], $u['id']]);
        return public_profile(q_one('SELECT * FROM users WHERE id = ?', [$u['id']]));
    },

    // Khách hàng đã có tài khoản gửi yêu cầu trở thành chủ sân
    'owner_request' => function () {
        $u = api_require_login();
        if ($u['role'] !== 'customer') fail('Tài khoản của bạn không cần gửi yêu cầu này.');
        return create_owner_request($u, input());
    },

    'change_password' => function () {
        if (impersonating_admin()) fail('Đang trong chế độ Ghost Login: Không thể thay đổi mật khẩu của người dùng.');
        if (is_staff()) {
            $st = current_staff();
            $hash = q_val('SELECT password_hash FROM owner_staff WHERE id = ?', [$st['id']]);
            if (!password_verify((string) (input()['current'] ?? ''), $hash)) fail('Mật khẩu hiện tại chưa đúng.');
            $new = (string) (input()['password'] ?? '');
            if (strlen($new) < 6) fail('Mật khẩu mới cần ít nhất 6 ký tự.');
            q('UPDATE owner_staff SET password_hash = ? WHERE id = ?', [password_hash($new, PASSWORD_DEFAULT), $st['id']]);
            return true;
        }
        $u = api_require_login();
        $hash = q_val('SELECT password_hash FROM users WHERE id = ?', [$u['id']]);
        if (!password_verify((string) (input()['current'] ?? ''), $hash)) fail('Mật khẩu hiện tại chưa đúng.');
        $new = (string) (input()['password'] ?? '');
        if (strlen($new) < 6) fail('Mật khẩu mới cần ít nhất 6 ký tự.');
        q('UPDATE users SET password_hash = ? WHERE id = ?', [password_hash($new, PASSWORD_DEFAULT), $u['id']]);
        return true;
    },

    // ---------------- Lịch cố định của tôi ----------------
    'recurring_list' => function () {
        $u = current_user();
        if (!$u) return [];
        $phone = preg_replace('/\D/', '', $u['phone']);
        $rows = $phone
            ? q_all("SELECT * FROM recurring_bookings WHERE customer_id = ? OR REPLACE(customer_phone, ' ', '') = ? ORDER BY created_at DESC", [$u['id'], $phone])
            : q_all('SELECT * FROM recurring_bookings WHERE customer_id = ? ORDER BY created_at DESC', [$u['id']]);
        return array_map(fn($r) => [
            'id' => $r['id'], 'courtId' => $r['court_id'], 'courtName' => $r['court_name'],
            'weekdays' => jd($r['weekdays']), 'startSlot' => $r['start_slot'],
            'durationMinutes' => (int) $r['duration_minutes'], 'startDate' => $r['start_date'],
            'endDate' => $r['end_date'], 'pricePerSession' => (int) $r['price_per_session'],
            'status' => $r['status'], 'note' => $r['note'], 'createdAt' => iso($r['created_at']),
        ], $rows);
    },

    'recurring_create' => function () {
        $u = api_require_login();
        $court = find_court(in_str('courtId')) ?: fail('Vui lòng chọn sân hợp lệ.');
        $weekdays = array_values(array_unique(array_filter(array_map('intval', in_arr('weekdays')), fn($d) => $d >= 1 && $d <= 7)));
        sort($weekdays);
        if (!$weekdays) fail('Vui lòng chọn ít nhất 1 ngày trong tuần.');
        $startSlot = in_str('startSlot') ?: '18:00';
        $duration = in_int('durationMinutes', 60);
        if (!in_array($duration, [60, 90, 120], true)) $duration = 60;
        $startDate = in_str('startDate') ?: date('Y-m-d');
        $endDate = in_str('endDate') ?: date('Y-m-d', strtotime('+30 days'));
        if ($endDate < $startDate) fail('Ngày kết thúc phải từ ngày bắt đầu trở đi.');
        $hours = $duration / 60;
        $price = (int) round($court['pricePerHour'] * $hours);
        $id = uid('rec-');
        q('INSERT INTO recurring_bookings (id, court_id, court_name, owner_id, customer_id, customer_name, customer_phone, weekdays, start_slot, duration_minutes, start_date, end_date, price_per_session, status, note) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
            [$id, $court['id'], $court['name'], $court['ownerId'], $u['id'], $u['full_name'] ?: $u['email'], $u['phone'], j($weekdays), $startSlot, $duration, $startDate, $endDate, $price, 'active', mb_substr(in_str('note'), 0, 400)]);
        if ($court['ownerId']) {
            push_notification((int) $court['ownerId'], 'Yêu cầu lịch cố định mới', ($u['full_name'] ?: $u['email']) . ' đăng ký lịch cố định tại ' . $court['name'] . ' lúc ' . $startSlot, 'booking', '/chu-san?tab=bookings');
        }
        push_notification((int) $u['id'], 'Đã tạo lịch cố định thành công', 'Lịch cố định tại ' . $court['name'] . ' (' . $startSlot . ') đã được lưu và gửi tới chủ sân.', 'booking', '/tai-khoan?tab=recurring');
        return ['id' => $id];
    },

    'recurring_status' => function () {
        $u = api_require_login();
        $id = in_str('id');
        $status = in_str('status');
        if (!in_array($status, ['active', 'paused', 'cancelled'], true)) fail('Trạng thái không hợp lệ.');
        $row = q_one('SELECT * FROM recurring_bookings WHERE id = ? AND customer_id = ?', [$id, $u['id']]) ?: fail('Không tìm thấy lịch cố định.');
        q('UPDATE recurring_bookings SET status = ? WHERE id = ?', [$status, $row['id']]);
        return true;
    },

    // ---------------- Ví voucher ----------------
    'vouchers' => function () {
        $u = current_user();
        if (!$u) return [];
        $rows = q_all('SELECT * FROM user_vouchers WHERE user_id = ? ORDER BY created_at DESC', [$u['id']]);
        return array_map(fn($r) => [
            'id' => $r['id'], 'code' => $r['code'], 'title' => $r['title'], 'description' => $r['description'],
            'discountType' => $r['discount_type'], 'discountValue' => (int) $r['discount_value'],
            'minOrder' => (int) $r['min_order'], 'source' => $r['source'], 'status' => $r['status'],
            'expiresAt' => $r['expires_at'], 'createdAt' => iso($r['created_at']),
        ], $rows);
    },

    'voucher_save' => function () {
        $u = api_require_login();
        $code = strtoupper(trim(in_str('code')));
        if (!$code) fail('Mã voucher không hợp lệ.');
        $title = in_str('title') ?: ('Mã ưu đãi ' . $code);
        $desc = mb_substr(in_str('description'), 0, 290);
        $dtype = in_array(in_str('discountType'), ['percent', 'amount', 'gift'], true) ? in_str('discountType') : 'percent';
        $dval = in_int('discountValue');
        $minOrder = in_int('minOrder');
        $source = in_array(in_str('source'), ['promo', 'wheel', 'system'], true) ? in_str('source') : 'promo';
        $expires = in_str('expiresAt') ?: date('Y-m-d', strtotime('+30 days'));
        q('INSERT INTO user_vouchers (id, user_id, code, title, description, discount_type, discount_value, min_order, source, status, expires_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)
           ON DUPLICATE KEY UPDATE title = VALUES(title), description = VALUES(description), expires_at = VALUES(expires_at), status = "available"',
            [uid('uv-'), $u['id'], $code, $title, $desc, $dtype, $dval, $minOrder, $source, 'available', $expires]);
        return true;
    },

    'wheel_spin' => function () {
        $u = api_require_login();
        $cooldown = 48 * 3600;
        $last = q_one('SELECT * FROM wheel_spins WHERE user_id = ? ORDER BY spun_at DESC LIMIT 1', [$u['id']]);
        if ($last) {
            $nextTs = strtotime($last['spun_at']) + $cooldown;
            if ($nextTs > time()) {
                $rem = $nextTs - time();
                $h = floor($rem / 3600);
                $m = floor(($rem % 3600) / 60);
                fail("Bạn vừa quay lượt gần nhất. Vui lòng quay lại sau {$h} giờ {$m} phút.", 429);
            }
        }
        $code = strtoupper(trim(in_str('code')));
        if (!$code) fail('Mã phần thưởng không hợp lệ.');
        $title = in_str('title') ?: ('Mã ưu đãi ' . $code);
        $desc = mb_substr(in_str('description'), 0, 290);
        $dtype = in_array(in_str('discountType'), ['percent', 'amount', 'gift'], true) ? in_str('discountType') : 'percent';
        $dval = in_int('discountValue');
        $expires = date('Y-m-d', strtotime('+30 days'));
        q('INSERT INTO wheel_spins (id, user_id, prize_code, prize_title, prize_desc) VALUES (?,?,?,?,?)',
            [uid('ws-'), $u['id'], $code, $title, $desc]);
        q('INSERT INTO user_vouchers (id, user_id, code, title, description, discount_type, discount_value, min_order, source, status, expires_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)
           ON DUPLICATE KEY UPDATE title = VALUES(title), description = VALUES(description), expires_at = VALUES(expires_at), status = "available"',
            [uid('uv-'), $u['id'], $code, $title, $desc, $dtype, $dval, 0, 'wheel', 'available', $expires]);
        return [
            'nextSpinAt' => (time() + $cooldown) * 1000,
            'code' => $code,
            'title' => $title,
            'desc' => $desc,
        ];
    },

    // ---------------- Thông báo ----------------
    'notifications' => function () {
        $u = current_user();
        if (!$u) return [];
        $rows = q_all('SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 50', [$u['id']]);
        return array_map(fn($r) => [
            'id' => $r['id'], 'title' => $r['title'], 'body' => $r['body'], 'type' => $r['type'],
            'link' => $r['link'], 'isRead' => (bool) $r['is_read'], 'createdAt' => iso($r['created_at']),
        ], $rows);
    },

    'notification_read' => function () {
        $u = api_require_login();
        $id = in_str('id');
        if ($id === 'all') {
            q('UPDATE notifications SET is_read = 1 WHERE user_id = ?', [$u['id']]);
        } else {
            q('UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?', [$id, $u['id']]);
        }
        return true;
    },
]);