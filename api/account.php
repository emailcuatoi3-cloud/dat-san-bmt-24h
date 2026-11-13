<?php
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
        $u = api_require_login();
        $hash = q_val('SELECT password_hash FROM users WHERE id = ?', [$u['id']]);
        if (!password_verify((string) (input()['current'] ?? ''), $hash)) fail('Mật khẩu hiện tại chưa đúng.');
        $new = (string) (input()['password'] ?? '');
        if (strlen($new) < 6) fail('Mật khẩu mới cần ít nhất 6 ký tự.');
        q('UPDATE users SET password_hash = ? WHERE id = ?', [password_hash($new, PASSWORD_DEFAULT), $u['id']]);
        return true;
    },
]);