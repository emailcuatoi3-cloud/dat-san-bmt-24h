<?php
/**
 * API KÊNH CHỦ SÂN — mọi thao tác chỉ áp dụng cho sân thuộc chủ sân đang đăng nhập (owner_id = tài khoản).
 */
require_once __DIR__ . '/../includes/bootstrap.php';

$OWNER = api_require_owner();

/** Danh sách id sân của chủ sân (kể cả sân trong thùng rác). */
function my_court_ids(): array
{
    global $OWNER;
    return array_column(q_all('SELECT id FROM courts WHERE owner_id = ?', [$OWNER['id']]), 'id');
}

/** Lấy sân của tôi theo id, không phải của tôi thì báo lỗi. */
function my_court(string $id): array
{
    global $OWNER;
    $row = q_one('SELECT * FROM courts WHERE id = ? AND owner_id = ?', [$id, $OWNER['id']]);
    if (!$row) fail('Không tìm thấy sân trong danh sách bạn quản lý.');
    return $row;
}

function my_booking(string $id): array
{
    $ids = my_court_ids();
    $row = $ids ? q_one(BOOKING_SELECT . ' WHERE b.id = ? AND b.court_id IN (' . in_list($ids) . ')', array_merge([$id], $ids)) : null;
    if (!$row) fail('Không tìm thấy đơn đặt sân của sân bạn.');
    return $row;
}

function my_bookings(): array
{
    auto_complete_bookings();
    $ids = my_court_ids();
    if (!$ids) return [];
    $rows = q_all(BOOKING_SELECT . ' WHERE b.court_id IN (' . in_list($ids) . ') ORDER BY b.booking_date DESC, b.created_at DESC', $ids);
    // Lượt giữ sân quá hạn mà chưa báo cọc thì không đưa vào danh sách cho đỡ rối
    return array_values(array_filter(array_map('map_booking', $rows), fn($b) => !$b['expiredHold']));
}

function clean_list($value): array
{
    return array_values(array_filter(array_map(fn($s) => trim((string) $s), is_array($value) ? $value : []), 'strlen'));
}

run_api([
    // Toàn bộ dữ liệu cho bảng điều khiển
    'data' => function () {
        global $OWNER;
        $courts = array_map('map_court', q_all('SELECT * FROM courts WHERE owner_id = ? AND deleted_at IS NULL ORDER BY sort_order, created_at', [$OWNER['id']]));
        $trash = array_map('map_court', q_all('SELECT * FROM courts WHERE owner_id = ? AND deleted_at IS NOT NULL ORDER BY deleted_at DESC', [$OWNER['id']]));
        $ids = array_column($courts, 'id');
        $unreplied = $ids ? (int) q_val("SELECT COUNT(*) FROM reviews WHERE moderation_status <> 'hidden' AND (owner_reply IS NULL OR owner_reply = '') AND court_id IN (" . in_list($ids) . ')', $ids) : 0;
        return [
            'courts' => $courts,
            'trash' => $trash,
            'bookings' => my_bookings(),
            'blocked' => (object) blocked_slots_map(null, $ids),
            'unreplied' => $unreplied,
        ];
    },

    // ---------------- Đơn đặt sân ----------------
    'booking_status' => function () {
        $b = my_booking(in_str('id'));
        $status = in_str('status');
        if (!in_array($status, ['confirmed', 'cancelled', 'completed', 'pending'], true)) fail('Trạng thái không hợp lệ.');
        $reason = $status === 'cancelled' ? (mb_substr(in_str('reason'), 0, 250) ?: null) : null;
        q('UPDATE bookings SET status = ?, reject_reason = ? WHERE id = ?', [$status, $reason, $b['id']]);
        return map_booking(q_one(BOOKING_SELECT . ' WHERE b.id = ?', [$b['id']]));
    },

    // Tạo đơn tại quầy (khách gọi điện / đến trực tiếp)
    'counter_create' => function () {
        $court = map_court(my_court(in_str('courtId')));
        $date = in_str('date');
        if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $date)) fail('Ngày chơi không hợp lệ.');
        $slots = clean_list(input()['slots'] ?? []);
        sort($slots);
        if (!$slots) fail('Vui lòng chọn ít nhất 1 khung giờ.');
        $name = in_str('customerName');
        $phone = preg_replace('/[^\d+]/', '', in_str('customerPhone'));
        if (mb_strlen($name) < 2) fail('Vui lòng nhập tên khách.');
        $occ = array_merge(occupied_slots($date)[$court['id']] ?? [], blocked_slots_map($date, [$court['id']])[$court['id'] . ':' . $date] ?? []);
        if ($clash = array_values(array_intersect($slots, $occ))) fail('Khung giờ ' . implode(', ', $clash) . ' đã có người đặt hoặc đang khóa.');
        $total = 0;
        foreach ($slots as $s) {
            [$h, $m] = array_map('intval', explode(':', $s));
            $price = $court['pricePerHour'];
            foreach ($court['priceBands'] as $b) {
                if ($s >= $b['start'] && $s < $b['end']) { $price = (int) $b['price']; break; }
            }
            $total += $price;
        }
        $paid = in_str('payment');
        $method = in_array(in_str('method'), ['cash', 'vietqr', 'transfer'], true) ? in_str('method') : 'cash';
        $deposit = $paid === 'deposit' ? min($total, max(0, in_int('deposit'))) : 0;
        $status = $paid === 'paid' ? 'paid' : ($deposit > 0 ? 'deposit_paid' : 'unpaid');
        $label = $paid === 'paid' ? 'Đã thu đủ · ' . payment_method_label($method) : ($deposit > 0 ? 'Đã cọc ' . number_format($deposit, 0, ',', '.') . 'đ · ' . payment_method_label($method) : 'Thanh toán tại sân');
        $code = 'BMT' . date('Ymd') . '-' . random_int(1000, 9999);
        while (q_val('SELECT id FROM bookings WHERE code = ?', [$code])) $code = 'BMT' . date('Ymd') . '-' . random_int(1000, 9999);
        $id = uid('ob-');
        q('INSERT INTO bookings (id, code, source, court_id, court_name, sport, area, image, customer_name, customer_phone, booking_date, start_slot, duration_minutes, slots,
             unit_price, base_total, total_price, deposit_amount, payment_method, payment_status, payment_label, status, note)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)', [
            $id, $code, 'owner', $court['id'], $court['name'], $court['sport'], $court['area'], $court['image'], $name, $phone, $date, $slots[0], count($slots) * 60, j($slots),
            $court['pricePerHour'], $total, $total, $deposit, $method, $status, $label, 'confirmed', mb_substr(in_str('note'), 0, 500),
        ]);
        return map_booking(q_one(BOOKING_SELECT . ' WHERE b.id = ?', [$id]));
    },

    'checkin' => function () {
        $code = strtoupper(in_str('code'));
        $id = in_str('id');
        if (!$id && $code) {
            $row = q_one('SELECT id FROM bookings WHERE code = ?', [explode('|', $code)[0]]);
            if (!$row) fail('Không tìm thấy vé với mã này.');
            $id = $row['id'];
        }
        $b = my_booking($id);
        if (!in_array($b['status'], ['confirmed', 'completed'], true)) fail('Đơn chưa được xác nhận nên chưa thể nhận sân.');
        if ($b['checked_in_at']) fail('Vé này đã được check-in lúc ' . date('H:i d/m/Y', strtotime($b['checked_in_at'])) . '.');
        q('UPDATE bookings SET checked_in_at = NOW() WHERE id = ?', [$b['id']]);
        return map_booking(q_one(BOOKING_SELECT . ' WHERE b.id = ?', [$b['id']]));
    },

    // ---------------- Sân ----------------
    'court_save' => function () {
        global $OWNER;
        $d = input();
        $id = in_str('id');
        $name = in_str('name');
        if (mb_strlen($name) < 3) fail('Tên sân cần ít nhất 3 ký tự.');
        $sport = in_str('sport') === 'badminton' ? 'badminton' : 'football';
        $price = in_int('pricePerHour');
        $peak = in_int('peakPrice') ?: $price;
        if ($price <= 0) fail('Vui lòng nhập giá thuê mỗi giờ.');
        $open = in_str('openTime') ?: '05:00';
        $close = in_str('closeTime') ?: '23:00';
        if ($close <= $open) fail('Giờ đóng cửa phải sau giờ mở cửa.');
        $images = clean_list($d['images'] ?? []);
        $bands = [];
        $peakStart = in_str('peakStart') ?: '17:00';
        if ($peak > $price && $peakStart > $open && $peakStart < $close) {
            $bands = [
                ['id' => 'morning', 'label' => 'Buổi sáng và chiều', 'shortLabel' => 'Sáng – chiều', 'start' => $open, 'end' => $peakStart, 'price' => $price],
                ['id' => 'evening', 'label' => 'Buổi tối', 'shortLabel' => 'Tối', 'start' => $peakStart, 'end' => $close, 'price' => $peak, 'peak' => true],
            ];
        } else {
            $bands = [['id' => 'all', 'label' => 'Cả ngày', 'shortLabel' => 'Cả ngày', 'start' => $open, 'end' => $close, 'price' => $price]];
        }
        $fields = [
            'name' => $name, 'sport' => $sport, 'sport_label' => sport_label($sport), 'area' => in_str('area'), 'address' => in_str('address'),
            'price_per_hour' => $price, 'peak_price' => $peak, 'price_bands' => j($bands),
            'price_note' => in_str('priceNote'), 'description' => in_str('description'),
            'highlights' => j(clean_list($d['highlights'] ?? [])), 'facilities' => j(clean_list($d['facilities'] ?? [])),
            'images' => j($images), 'open_time' => $open, 'close_time' => $close,
            'weekly_hours' => !empty($d['weeklyHours']) && is_array($d['weeklyHours']) ? j($d['weeklyHours']) : null,
            'field_types' => j(clean_list($d['fieldTypes'] ?? [])), 'status' => in_array(in_str('status'), ['active', 'maintenance', 'paused'], true) ? in_str('status') : 'active',
            'note' => in_str('note'), 'map_query' => in_str('address'),
        ];
        if ($id) {
            my_court($id);
            $sets = implode(', ', array_map(fn($k) => "`$k` = ?", array_keys($fields)));
            q("UPDATE courts SET $sets WHERE id = ?", array_merge(array_values($fields), [$id]));
        } else {
            $id = 'oc-' . bin2hex(random_bytes(4));
            $slug = slugify($name) ?: $id;
            while (q_val('SELECT id FROM courts WHERE slug = ?', [$slug])) $slug .= '-' . random_int(2, 99);
            $fields += ['id' => $id, 'slug' => $slug, 'owner_id' => $OWNER['id'], 'rating' => 5, 'review_count' => 0];
            $cols = implode(', ', array_map(fn($k) => "`$k`", array_keys($fields)));
            q("INSERT INTO courts ($cols) VALUES (" . in_list($fields) . ')', array_values($fields));
        }
        return map_court(q_one('SELECT * FROM courts WHERE id = ?', [$id]));
    },

    'court_status' => function () {
        $c = my_court(in_str('id'));
        $status = in_str('status');
        if (!in_array($status, ['active', 'maintenance', 'paused'], true)) fail('Trạng thái không hợp lệ.');
        q('UPDATE courts SET status = ? WHERE id = ?', [$status, $c['id']]);
        return true;
    },

    'court_trash' => function () {
        $c = my_court(in_str('id'));
        q("UPDATE courts SET deleted_at = NOW(), status = 'paused' WHERE id = ?", [$c['id']]);
        q('DELETE FROM blocked_slots WHERE court_id = ?', [$c['id']]);
        return true;
    },

    'court_restore' => function () {
        $c = my_court(in_str('id'));
        q("UPDATE courts SET deleted_at = NULL, status = 'paused' WHERE id = ?", [$c['id']]);
        return true;
    },

    'court_purge' => function () {
        $c = my_court(in_str('id'));
        if (!$c['deleted_at']) fail('Chỉ xóa vĩnh viễn được sân đang ở thùng rác.');
        q('DELETE FROM courts WHERE id = ?', [$c['id']]);
        return true;
    },

    // ---------------- Khóa khung giờ ----------------
    'block_slots' => function () {
        $c = my_court(in_str('courtId'));
        $date = in_str('date');
        $slots = clean_list(input()['slots'] ?? []);
        if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $date)) fail('Ngày không hợp lệ.');
        foreach ($slots as $s) {
            if (input()['blocked'] ?? false) q('INSERT IGNORE INTO blocked_slots (court_id, block_date, slot) VALUES (?,?,?)', [$c['id'], $date, $s]);
            else q('DELETE FROM blocked_slots WHERE court_id = ? AND block_date = ? AND slot = ?', [$c['id'], $date, $s]);
        }
        return blocked_slots_map($date, [$c['id']])[$c['id'] . ':' . $date] ?? [];
    },

    // ---------------- Đánh giá ----------------
    'reviews' => function () {
        $ids = my_court_ids();
        if (!$ids) return [];
        return array_map('map_review', q_all(REVIEW_SELECT . " WHERE r.court_id IN (" . in_list($ids) . ") AND r.moderation_status <> 'hidden' ORDER BY r.created_at DESC", $ids));
    },

    'review_reply' => function () {
        $ids = my_court_ids();
        $r = $ids ? q_one('SELECT id FROM reviews WHERE id = ? AND court_id IN (' . in_list($ids) . ')', array_merge([in_str('id')], $ids)) : null;
        if (!$r) fail('Không tìm thấy đánh giá này. Bạn tải lại trang rồi thử lại nhé.');
        $text = mb_substr(in_str('reply'), 0, 500);
        if ($text !== '' && mb_strlen($text) < 5) fail('Phản hồi cần ít nhất 5 ký tự để khách hiểu rõ nội dung.');
        q('UPDATE reviews SET owner_reply = ?, owner_replied_at = ? WHERE id = ?', [$text ?: null, $text ? now_sql() : null, $r['id']]);
        return map_review(q_one(REVIEW_SELECT . ' WHERE r.id = ?', [$r['id']]));
    },

    // ---------------- Hóa đơn & cọc ----------------
    'invoices' => function () {
        $ids = my_court_ids();
        return $ids ? invoices_where('b.court_id IN (' . in_list($ids) . ')', $ids) : [];
    },

    'mark_paid' => function () {
        $b = my_booking(in_str('id'));
        $method = in_array(in_str('method'), ['cash', 'vietqr', 'transfer'], true) ? in_str('method') : 'cash';
        $label = 'Đã thu đủ · ' . payment_method_label($method);
        q("UPDATE bookings SET payment_status = 'paid', payment_method = ?, payment_label = IF(source = 'owner', ?, payment_label) WHERE id = ?", [$method, $label, $b['id']]);
        return map_booking(q_one(BOOKING_SELECT . ' WHERE b.id = ?', [$b['id']]));
    },

    'refunds' => function () {
        global $OWNER;
        return array_map(fn($r) => [
            'id' => $r['id'], 'bookingCode' => $r['booking_code'], 'customerName' => $r['customer_name'], 'courtName' => $r['court_name'],
            'amount' => (int) $r['amount'], 'method' => $r['method'], 'note' => $r['note'], 'createdAt' => iso($r['created_at']),
        ], q_all('SELECT * FROM refunds WHERE owner_id = ? ORDER BY created_at DESC', [$OWNER['id']]));
    },

    'refund_add' => function () {
        global $OWNER;
        $b = my_booking(in_str('bookingId'));
        $amount = in_int('amount');
        if ($amount <= 0) fail('Số tiền hoàn phải lớn hơn 0.');
        if (q_val('SELECT id FROM refunds WHERE booking_code = ? AND owner_id = ?', [$b['code'], $OWNER['id']])) fail('Đơn này đã có phiếu hoàn cọc.');
        q('INSERT INTO refunds (id, owner_id, booking_code, customer_name, court_name, amount, method, note) VALUES (?,?,?,?,?,?,?,?)',
            [uid('rf-'), $OWNER['id'], $b['code'], $b['customer_name'], $b['court_name'], $amount,
                in_array(in_str('method'), ['cash', 'transfer', 'vietqr'], true) ? in_str('method') : 'cash', mb_substr(in_str('note'), 0, 250)]);
        return true;
    },

    'refund_remove' => function () {
        global $OWNER;
        q('DELETE FROM refunds WHERE id = ? AND owner_id = ?', [in_str('id'), $OWNER['id']]);
        return true;
    },

    // ---------------- Dịch vụ bán kèm ----------------
    'services' => function () {
        global $OWNER;
        return array_map(fn($s) => ['id' => $s['id'], 'name' => $s['name'], 'category' => $s['category'], 'unit' => $s['unit'],
            'price' => (int) $s['price'], 'stock' => (int) $s['stock'], 'active' => (bool) $s['active']],
            q_all('SELECT * FROM owner_services WHERE owner_id = ? ORDER BY sort_order, name', [$OWNER['id']]));
    },

    'service_save' => function () {
        global $OWNER;
        $name = in_str('name');
        if (mb_strlen($name) < 2) fail('Vui lòng nhập tên dịch vụ.');
        $cat = in_array(in_str('category'), ['drink', 'rental', 'food', 'other'], true) ? in_str('category') : 'drink';
        $vals = [$name, $cat, in_str('unit') ?: 'cái', max(0, in_int('price')), max(0, in_int('stock')), (input()['active'] ?? true) ? 1 : 0];
        if ($id = in_str('id')) {
            q('UPDATE owner_services SET name = ?, category = ?, unit = ?, price = ?, stock = ?, active = ? WHERE id = ? AND owner_id = ?', array_merge($vals, [$id, $OWNER['id']]));
        } else {
            q('INSERT INTO owner_services (name, category, unit, price, stock, active, id, owner_id, sort_order) VALUES (?,?,?,?,?,?,?,?,999)', array_merge($vals, [uid('sv-'), $OWNER['id']]));
        }
        return true;
    },

    'service_delete' => function () {
        global $OWNER;
        q('DELETE FROM owner_services WHERE id = ? AND owner_id = ?', [in_str('id'), $OWNER['id']]);
        return true;
    },

    // ---------------- Khuyến mãi ----------------
    'promotions' => function () {
        global $OWNER;
        $list = array_map('map_promotion', q_all('SELECT * FROM promotions WHERE owner_id = ? ORDER BY updated_at DESC', [$OWNER['id']]));
        $ids = my_court_ids();
        $uses = $ids ? q_all("SELECT b.code, b.promo_code, b.discount_amount, b.total_price, b.base_total, b.customer_name, b.court_name, b.booking_date, b.status, b.created_at
                              FROM bookings b WHERE b.promo_code IS NOT NULL AND b.court_id IN (" . in_list($ids) . ') ORDER BY b.created_at DESC', $ids) : [];
        return ['promotions' => $list, 'redemptions' => array_map(fn($r) => [
            'bookingCode' => $r['code'], 'code' => $r['promo_code'], 'discount' => (int) $r['discount_amount'], 'paidTotal' => (int) $r['total_price'],
            'baseTotal' => (int) $r['base_total'], 'customerName' => $r['customer_name'], 'courtName' => $r['court_name'],
            'bookingDate' => $r['booking_date'], 'status' => $r['status'], 'createdAt' => iso($r['created_at']),
        ], $uses)];
    },

    'promotion_save' => function () {
        global $OWNER;
        $code = strtoupper(preg_replace('/[^A-Za-z0-9]/', '', in_str('code')));
        if (strlen($code) < 3 || strlen($code) > 16) fail('Mã giảm giá cần 3–16 ký tự chữ hoặc số.');
        $title = in_str('title');
        if (mb_strlen($title) < 3) fail('Vui lòng nhập tên chương trình.');
        $type = in_str('discountType') === 'amount' ? 'amount' : 'percent';
        $value = in_int('discountValue');
        if ($value <= 0 || ($type === 'percent' && $value > 100)) fail('Mức giảm không hợp lệ.');
        $start = in_str('startDate');
        $end = in_str('endDate');
        if (!$start || !$end || $end < $start) fail('Ngày kết thúc phải sau ngày bắt đầu.');
        $id = in_str('id');
        $dup = q_val('SELECT id FROM promotions WHERE code = ? AND id <> ?', [$code, $id]);
        if ($dup) fail('Mã ' . $code . ' đã tồn tại, vui lòng chọn mã khác.');
        $weekdays = array_values(array_unique(array_filter(array_map('intval', in_arr('weekdays')), fn($d) => $d >= 1 && $d <= 7)));
        sort($weekdays);
        $vals = [$OWNER['business_name'] ?: $OWNER['full_name'], $code, $title, in_str('description'), $type, $value,
            ($m = in_int('maxDiscount')) > 0 ? $m : null, max(0, in_int('minOrder')), $start, $end, j($weekdays),
            in_str('startTime'), in_str('endTime'), ($l = in_int('usageLimit')) > 0 ? $l : null, in_str('status') === 'paused' ? 'paused' : 'active'];
        if ($id) {
            if (!q_val('SELECT id FROM promotions WHERE id = ? AND owner_id = ?', [$id, $OWNER['id']])) fail('Không tìm thấy mã của bạn.');
            q('UPDATE promotions SET owner_name=?, code=?, title=?, description=?, discount_type=?, discount_value=?, max_discount=?, min_order=?, start_date=?, end_date=?, weekdays=?, start_time=?, end_time=?, usage_limit=?, status=? WHERE id = ?', array_merge($vals, [$id]));
        } else {
            q('INSERT INTO promotions (owner_name, code, title, description, discount_type, discount_value, max_discount, min_order, start_date, end_date, weekdays, start_time, end_time, usage_limit, status, id, owner_id) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)', array_merge($vals, [uid('promo-'), $OWNER['id']]));
        }
        return true;
    },

    'promotion_status' => function () {
        global $OWNER;
        q('UPDATE promotions SET status = ? WHERE id = ? AND owner_id = ?', [in_str('status') === 'paused' ? 'paused' : 'active', in_str('id'), $OWNER['id']]);
        return true;
    },

    'promotion_delete' => function () {
        global $OWNER;
        q('DELETE FROM promotions WHERE id = ? AND owner_id = ?', [in_str('id'), $OWNER['id']]);
        return true;
    },
]);
