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
    auto_cancel_expired_holds();
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
        staff_need('bookings');
        auto_cancel_expired_holds();
        $b = my_booking(in_str('id'));
        $status = in_str('status');
        if (!in_array($status, ['confirmed', 'cancelled', 'completed', 'pending'], true)) fail('Trạng thái không hợp lệ.');
        $reason = $status === 'cancelled' ? (mb_substr(in_str('reason'), 0, 250) ?: null) : null;
        $now = date('Y-m-d H:i:s');
        if ($status === 'confirmed') {
            $slots = jd($b['slots']);
            $occ = occupied_slots($b['booking_date'], $b['id'])[$b['court_id']] ?? [];
            $blocked = blocked_slots_map($b['booking_date'], [$b['court_id']])[$b['court_id'] . ':' . $b['booking_date']] ?? [];
            $unavailable = array_intersect($slots, array_merge($occ, $blocked));
            if (!empty($unavailable)) {
                fail('Không thể xác nhận đơn vì khung giờ ' . implode(', ', $unavailable) . ' ngày ' . $b['booking_date'] . ' đã bị trùng lịch với đơn khác hoặc đang bị khóa.');
            }
            if ($b['source'] === 'online' && (int)$b['deposit_amount'] > 0 && $b['payment_status'] === 'unpaid') {
                // Khách đặt online chưa cọc: chủ sân duyệt đơn -> cấp 5 phút để khách chuyển cọc
                $holdExp = date('Y-m-d H:i:s', time() + HOLD_MINUTES * 60);
                q('UPDATE bookings SET approved_at = ?, hold_expires_at = ?, status = ? WHERE id = ?', [$now, $holdExp, 'confirmed', $b['id']]);
            } else {
                // Đã cọc hoặc đơn tại quầy / tiền mặt: xác nhận giữ sân thành công, không giới hạn cọc
                q('UPDATE bookings SET approved_at = COALESCE(approved_at, ?), hold_expires_at = NULL, status = ? WHERE id = ?', [$now, 'confirmed', $b['id']]);
            }
        } else {
            q('UPDATE bookings SET status = ?, reject_reason = ? WHERE id = ?', [$status, $reason, $b['id']]);
        }

        $targetUserId = (int) ($b['customer_id'] ?? 0);
        if (!$targetUserId && !empty($b['customer_phone'])) {
            $targetUserId = (int) q_val('SELECT id FROM users WHERE phone = ?', [$b['customer_phone']]);
        }
        if ($targetUserId > 0) {
            if ($status === 'confirmed') {
                push_notification($targetUserId, 'Đơn đặt sân #' . $b['code'] . ' đã được duyệt!', 'Chủ sân đã xác nhận đơn đặt sân tại ' . ($b['court_name'] ?: 'sân thể thao') . ' ngày ' . date('d/m/Y', strtotime($b['booking_date'])) . '. Vui lòng kiểm tra vé và giờ chơi.', 'booking', '/tai-khoan?tab=history');
            } else {
                push_notification($targetUserId, 'Đơn đặt sân #' . $b['code'] . ' đã bị từ chối / hủy', 'Lý do: ' . ($reason ?: 'Chủ sân từ chối đơn') . '.', 'booking', '/tai-khoan?tab=history');
            }
        }

        return map_booking(q_one(BOOKING_SELECT . ' WHERE b.id = ?', [$b['id']]));
    },

    'booking_reschedule' => function () {
        staff_need('bookings');
        auto_cancel_expired_holds();
        $b = my_booking(in_str('id'));
        if (in_array($b['status'], ['completed', 'cancelled'], true)) fail('Không thể đổi giờ cho đơn đã hoàn thành hoặc đã hủy.');
        $court = map_court(my_court($b['court_id']));
        $newDate = in_str('date');
        if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $newDate)) fail('Ngày chơi không hợp lệ.');
        $slots = clean_list(input()['slots'] ?? []);
        sort($slots);
        if (!$slots) fail('Vui lòng chọn ít nhất 1 khung giờ.');

        $occ = array_merge(occupied_slots($newDate, $b['id'])[$court['id']] ?? [], blocked_slots_map($newDate, [$court['id']])[$court['id'] . ':' . $newDate] ?? []);
        if ($clash = array_values(array_intersect($slots, $occ))) fail('Khung giờ ' . implode(', ', $clash) . ' đã có người đặt hoặc đang khóa.');

        $total = 0;
        foreach ($slots as $s) {
            $price = $court['pricePerHour'];
            foreach ($court['priceBands'] as $pb) {
                if ($s >= $pb['start'] && $s < $pb['end']) { $price = (int) $pb['price']; break; }
            }
            $total += $price;
        }

        $oldSlots = jd($b['slots']);
        $oldInfo = $b['booking_date'] . ' (' . implode(', ', $oldSlots) . ')';
        $newInfo = $newDate . ' (' . implode(', ', $slots) . ')';
        $actorTag = is_staff() ? (' bởi ' . current_staff()['name']) : '';
        $note = trim(($b['note'] ?: '') . "\n[Đổi lịch từ " . $oldInfo . " sang " . $newInfo . $actorTag . " vào " . date('d/m/Y H:i') . "]");

        q('UPDATE bookings SET booking_date = ?, start_slot = ?, duration_minutes = ?, slots = ?, total_price = ?, note = ? WHERE id = ?',
            [$newDate, $slots[0], count($slots) * 60, j($slots), $total, $note, $b['id']]);

        return map_booking(q_one(BOOKING_SELECT . ' WHERE b.id = ?', [$b['id']]));
    },

    // Tạo đơn tại quầy (khách gọi điện / đến trực tiếp)
    'counter_create' => function () {
        staff_need('bookings');
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
        $note = mb_substr(in_str('note'), 0, 500);
        if (is_staff()) {
            $st = current_staff();
            $tag = '[Tạo bởi ' . $st['name'] . ' (' . $st['roleName'] . ') vào ' . date('H:i d/m') . ']';
            $note = $note ? ($note . "\n" . $tag) : $tag;
        }
        q('INSERT INTO bookings (id, code, source, court_id, court_name, sport, area, image, customer_name, customer_phone, booking_date, start_slot, duration_minutes, slots,
             unit_price, base_total, total_price, deposit_amount, payment_method, payment_status, payment_label, status, note)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)', [
            $id, $code, 'owner', $court['id'], $court['name'], $court['sport'], $court['area'], $court['image'], $name, $phone, $date, $slots[0], count($slots) * 60, j($slots),
            $court['pricePerHour'], $total, $total, $deposit, $method, $status, $label, 'confirmed', $note,
        ]);
        return map_booking(q_one(BOOKING_SELECT . ' WHERE b.id = ?', [$id]));
    },

    'checkin' => function () {
        staff_need('bookings');
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
        $checkinNote = $b['note'] ?: '';
        if (is_staff()) {
            $st = current_staff();
            $checkinNote = trim($checkinNote . "\n[Check-in bởi " . $st['name'] . ' (' . $st['roleName'] . ') lúc ' . date('H:i d/m') . ']');
        }
        q('UPDATE bookings SET checked_in_at = NOW(), note = ? WHERE id = ?', [$checkinNote, $b['id']]);
        return map_booking(q_one(BOOKING_SELECT . ' WHERE b.id = ?', [$b['id']]));
    },

    // ---------------- Sân ----------------
    'court_save' => function () {
        global $OWNER;
        staff_need('courts');
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
        staff_need('courts');
        $c = my_court(in_str('id'));
        $status = in_str('status');
        if (!in_array($status, ['active', 'maintenance', 'paused'], true)) fail('Trạng thái không hợp lệ.');
        q('UPDATE courts SET status = ? WHERE id = ?', [$status, $c['id']]);
        return true;
    },

    'court_trash' => function () {
        staff_need('courts');
        $c = my_court(in_str('id'));
        q("UPDATE courts SET deleted_at = NOW(), status = 'paused' WHERE id = ?", [$c['id']]);
        q('DELETE FROM blocked_slots WHERE court_id = ?', [$c['id']]);
        return true;
    },

    'court_restore' => function () {
        staff_need('courts');
        $c = my_court(in_str('id'));
        q("UPDATE courts SET deleted_at = NULL, status = 'paused' WHERE id = ?", [$c['id']]);
        return true;
    },

    'court_purge' => function () {
        if (is_staff()) fail('Tài khoản nhân viên không có quyền xóa vĩnh viễn sân.');
        $c = my_court(in_str('id'));
        if (!$c['deleted_at']) fail('Chỉ xóa vĩnh viễn được sân đang ở thùng rác.');
        q('DELETE FROM courts WHERE id = ?', [$c['id']]);
        return true;
    },

    // ---------------- Khóa khung giờ ----------------
    'block_slots' => function () {
        staff_need('courts');
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
        staff_need('customers');
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
        staff_need('payments');
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
        staff_need('payments');
        $b = my_booking(in_str('bookingId'));
        $amount = in_int('amount');
        if ($amount <= 0) fail('Số tiền hoàn phải lớn hơn 0.');
        if (q_val('SELECT id FROM refunds WHERE booking_code = ? AND owner_id = ?', [$b['code'], $OWNER['id']])) fail('Đơn này đã có phiếu hoàn cọc.');
        q('INSERT INTO refunds (id, owner_id, booking_code, customer_name, court_name, amount, method, note) VALUES (?,?,?,?,?,?,?,?)',
            [uid('rf-'), $OWNER['id'], $b['code'], $b['customer_name'], $b['court_name'], $amount,
                in_array(in_str('method'), ['cash', 'transfer', 'vietqr'], true) ? in_str('method') : 'cash', mb_substr(in_str('note'), 0, 250)]);
        q("UPDATE bookings SET payment_status = 'refunded' WHERE id = ?", [$b['id']]);

        $targetUserId = (int) ($b['customer_id'] ?? 0);
        if (!$targetUserId && !empty($b['customer_phone'])) {
            $targetUserId = (int) q_val('SELECT id FROM users WHERE phone = ?', [$b['customer_phone']]);
        }
        if ($targetUserId > 0) {
            push_notification($targetUserId, 'Hoàn tiền cọc đơn #' . $b['code'], 'Chủ sân đã hoàn số tiền ' . number_format($amount, 0, ',', '.') . 'đ cho bạn.', 'payment', '/tai-khoan?tab=history');
        }

        return map_booking(q_one(BOOKING_SELECT . ' WHERE b.id = ?', [$b['id']]));
    },

    'refund_remove' => function () {
        global $OWNER;
        staff_need('payments');
        q('DELETE FROM refunds WHERE id = ? AND owner_id = ?', [in_str('id'), $OWNER['id']]);
        return true;
    },

    // ---------------- Dịch vụ bán kèm & Đa thuộc tính ----------------
    'services' => function () {
        global $OWNER;
        ensure_sitemap_schema();
        $services = q_all('SELECT * FROM owner_services WHERE owner_id = ? ORDER BY sort_order, name', [$OWNER['id']]);
        $sIds = array_column($services, 'id');
        $variantsMap = [];
        if ($sIds) {
            $vars = q_all('SELECT * FROM service_variants WHERE service_id IN (' . in_list($sIds) . ') ORDER BY sort_order, id', $sIds);
            foreach ($vars as $v) {
                $variantsMap[$v['service_id']][] = [
                    'id' => $v['id'],
                    'serviceId' => $v['service_id'],
                    'sku' => $v['sku'],
                    'name' => $v['name'],
                    'attributes' => jd($v['attributes'] ?? '{}'),
                    'price' => (int) $v['price'],
                    'stock' => (int) $v['stock'],
                    'active' => (bool) $v['active'],
                ];
            }
        }
        return array_map(fn($s) => [
            'id' => $s['id'],
            'name' => $s['name'],
            'category' => $s['category'],
            'sport' => $s['sport'] ?? 'all',
            'unit' => $s['unit'],
            'price' => (int) $s['price'],
            'stock' => (int) $s['stock'],
            'hasVariants' => (bool) ($s['has_variants'] ?? 0),
            'attributesSchema' => jd($s['attributes_schema'] ?? '[]'),
            'variants' => $variantsMap[$s['id']] ?? [],
            'active' => (bool) $s['active'],
        ], $services);
    },

    'service_save' => function () {
        global $OWNER;
        staff_need('services');
        ensure_sitemap_schema();
        $name = in_str('name');
        if (mb_strlen($name) < 2) fail('Vui lòng nhập tên dịch vụ.');
        $cat = in_array(in_str('category'), ['drink', 'rental', 'food', 'other'], true) ? in_str('category') : 'drink';
        $sport = in_array(in_str('sport'), ['football', 'badminton', 'all'], true) ? in_str('sport') : 'all';
        $unit = in_str('unit') ?: 'cái';
        $price = max(0, in_int('price'));
        $stock = max(0, in_int('stock'));
        $active = (input()['active'] ?? true) ? 1 : 0;
        $hasVariants = !empty(input()['hasVariants']) ? 1 : 0;
        $attributesSchema = in_arr('attributesSchema');
        $rawVariants = in_arr('variants');

        if ($hasVariants && $rawVariants) {
            $varPrices = array_column($rawVariants, 'price');
            $price = $varPrices ? min(array_map('intval', $varPrices)) : $price;
            $stock = array_sum(array_map(fn($v) => max(0, (int) ($v['stock'] ?? 0)), $rawVariants));
        }

        $id = in_str('id');
        if ($id) {
            $exists = q_one('SELECT id FROM owner_services WHERE id = ? AND owner_id = ?', [$id, $OWNER['id']]);
            if (!$exists) fail('Không tìm thấy dịch vụ để cập nhật.');
            q('UPDATE owner_services SET name = ?, category = ?, sport = ?, unit = ?, price = ?, stock = ?, has_variants = ?, attributes_schema = ?, active = ? WHERE id = ? AND owner_id = ?',
                [$name, $cat, $sport, $unit, $price, $stock, $hasVariants, j($attributesSchema), $active, $id, $OWNER['id']]);
        } else {
            $id = uid('sv-');
            q('INSERT INTO owner_services (id, owner_id, name, category, sport, unit, price, stock, has_variants, attributes_schema, active, sort_order) VALUES (?,?,?,?,?,?,?,?,?,?,?,999)',
                [$id, $OWNER['id'], $name, $cat, $sport, $unit, $price, $stock, $hasVariants, j($attributesSchema), $active]);
        }

        if ($hasVariants && $rawVariants) {
            $keptVarIds = [];
            foreach ($rawVariants as $idx => $v) {
                $vid = !empty($v['id']) ? $v['id'] : uid('svvar-');
                $vname = trim($v['name'] ?? '');
                if (!$vname) continue;
                $vsku = trim($v['sku'] ?? '');
                $vprice = max(0, (int) ($v['price'] ?? $price));
                $vstock = max(0, (int) ($v['stock'] ?? 0));
                $vactive = isset($v['active']) ? ($v['active'] ? 1 : 0) : 1;
                $vattrs = is_array($v['attributes'] ?? null) ? $v['attributes'] : [];
                $keptVarIds[] = $vid;

                q('INSERT INTO service_variants (id, service_id, owner_id, sku, name, attributes, price, stock, active, sort_order)
                   VALUES (?,?,?,?,?,?,?,?,?,?)
                   ON DUPLICATE KEY UPDATE sku = VALUES(sku), name = VALUES(name), attributes = VALUES(attributes), price = VALUES(price), stock = VALUES(stock), active = VALUES(active), sort_order = VALUES(sort_order)',
                   [$vid, $id, $OWNER['id'], $vsku, $vname, j($vattrs), $vprice, $vstock, $vactive, $idx + 1]);
            }
            if ($keptVarIds) {
                q('DELETE FROM service_variants WHERE service_id = ? AND owner_id = ? AND id NOT IN (' . in_list($keptVarIds) . ')', array_merge([$id, $OWNER['id']], $keptVarIds));
            }
        } else {
            q('DELETE FROM service_variants WHERE service_id = ? AND owner_id = ?', [$id, $OWNER['id']]);
        }
        return ['id' => $id];
    },

    'service_delete' => function () {
        global $OWNER;
        staff_need('services');
        $id = in_str('id');
        q('DELETE FROM service_variants WHERE service_id = ? AND owner_id = ?', [$id, $OWNER['id']]);
        q('DELETE FROM owner_services WHERE id = ? AND owner_id = ?', [$id, $OWNER['id']]);
        return true;
    },

    // ---------------- Khuyến mãi ----------------
    'promotions' => function () {
        global $OWNER;
        ensure_sitemap_schema();
        $promos = q_all('SELECT * FROM promotions WHERE owner_id = ? ORDER BY updated_at DESC', [$OWNER['id']]);
        $list = array_map('map_promotion', $promos);

        // Thống kê số lượng khách hàng đã lưu từng mã và trạng thái đếm ngược
        $savedStats = q_all("SELECT UPPER(code) as code, COUNT(*) as saved_count,
                                    SUM(CASE WHEN expires_at >= NOW() AND status = 'available' THEN 1 ELSE 0 END) as active_saved_count,
                                    MIN(CASE WHEN expires_at >= NOW() AND status = 'available' THEN expires_at ELSE NULL END) as next_expiry,
                                    MAX(created_at) as last_saved_at
                             FROM user_vouchers GROUP BY UPPER(code)");
        $savedMap = [];
        foreach ($savedStats as $st) {
            $savedMap[$st['code']] = [
                'savedCount' => (int) $st['saved_count'],
                'activeSavedCount' => (int) $st['active_saved_count'],
                'nextExpiry' => $st['next_expiry'] ? iso($st['next_expiry']) : null,
                'lastSavedAt' => $st['last_saved_at'] ? iso($st['last_saved_at']) : null,
            ];
        }

        foreach ($list as &$item) {
            $c = strtoupper($item['code']);
            $s = $savedMap[$c] ?? ['savedCount' => 0, 'activeSavedCount' => 0, 'nextExpiry' => null, 'lastSavedAt' => null];
            $item['savedCount'] = $s['savedCount'];
            $item['activeSavedCount'] = $s['activeSavedCount'];
            $item['nextExpiry'] = $s['nextExpiry'];
            $item['lastSavedAt'] = $s['lastSavedAt'];
            $claimed = promo_claimed_count($c);
            $item['claimedCount'] = $claimed;
            $item['remainingCount'] = $item['usageLimit'] ? max(0, $item['usageLimit'] - $claimed) : null;
        }
        unset($item);

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
        staff_need('promotions');
        ensure_sitemap_schema();
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
        $countdownHours = max(1, in_int('countdownHours') ?: 24);
        $vals = [$OWNER['business_name'] ?: $OWNER['full_name'], $code, $title, in_str('description'), $type, $value,
            ($m = in_int('maxDiscount')) > 0 ? $m : null, max(0, in_int('minOrder')), $start, $end, j($weekdays),
            in_str('startTime'), in_str('endTime'), ($l = in_int('usageLimit')) > 0 ? $l : null, $countdownHours, in_str('status') === 'paused' ? 'paused' : 'active'];
        if ($id) {
            if (!q_val('SELECT id FROM promotions WHERE id = ? AND owner_id = ?', [$id, $OWNER['id']])) fail('Không tìm thấy mã của bạn.');
            q('UPDATE promotions SET owner_name=?, code=?, title=?, description=?, discount_type=?, discount_value=?, max_discount=?, min_order=?, start_date=?, end_date=?, weekdays=?, start_time=?, end_time=?, usage_limit=?, countdown_hours=?, status=? WHERE id = ?', array_merge($vals, [$id]));
        } else {
            q('INSERT INTO promotions (owner_name, code, title, description, discount_type, discount_value, max_discount, min_order, start_date, end_date, weekdays, start_time, end_time, usage_limit, countdown_hours, status, id, owner_id) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)', array_merge($vals, [uid('promo-'), $OWNER['id']]));
        }
        return true;
    },

    'promotion_status' => function () {
        global $OWNER;
        staff_need('promotions');
        q('UPDATE promotions SET status = ? WHERE id = ? AND owner_id = ?', [in_str('status') === 'paused' ? 'paused' : 'active', in_str('id'), $OWNER['id']]);
        return true;
    },

    'promotion_delete' => function () {
        global $OWNER;
        staff_need('promotions');
        q('DELETE FROM promotions WHERE id = ? AND owner_id = ?', [in_str('id'), $OWNER['id']]);
        return true;
    },

    // ---------------- Lịch cố định ----------------
    'recurring_list' => function () {
        $ids = my_court_ids();
        if (!$ids) return [];
        $rows = q_all('SELECT * FROM recurring_bookings WHERE court_id IN (' . in_list($ids) . ') ORDER BY created_at DESC', $ids);
        return array_map(fn($r) => [
            'id' => $r['id'], 'courtId' => $r['court_id'], 'courtName' => $r['court_name'],
            'customerName' => $r['customer_name'], 'customerPhone' => $r['customer_phone'],
            'weekdays' => jd($r['weekdays']), 'startSlot' => $r['start_slot'],
            'durationMinutes' => (int) $r['duration_minutes'], 'startDate' => $r['start_date'],
            'endDate' => $r['end_date'], 'pricePerSession' => (int) $r['price_per_session'],
            'status' => $r['status'], 'note' => $r['note'], 'createdAt' => iso($r['created_at']),
        ], $rows);
    },

    'recurring_save' => function () {
        global $OWNER;
        staff_need('bookings');
        $court = map_court(my_court(in_str('courtId')));
        $name = in_str('customerName');
        if (mb_strlen($name) < 2) fail('Vui lòng nhập tên khách hàng / đội bóng.');
        $weekdays = array_values(array_unique(array_filter(array_map('intval', in_arr('weekdays')), fn($d) => $d >= 1 && $d <= 7)));
        sort($weekdays);
        if (!$weekdays) fail('Vui lòng chọn ít nhất 1 thứ trong tuần.');
        $startSlot = in_str('startSlot') ?: '18:00';
        $duration = in_int('durationMinutes', 60);
        $startDate = in_str('startDate') ?: date('Y-m-d');
        $endDate = in_str('endDate') ?: date('Y-m-d', strtotime('+30 days'));
        $price = in_int('pricePerSession') ?: (int) round($court['pricePerHour'] * ($duration / 60));
        $id = in_str('id');
        if ($id) {
            q('UPDATE recurring_bookings SET court_id=?, court_name=?, customer_name=?, customer_phone=?, weekdays=?, start_slot=?, duration_minutes=?, start_date=?, end_date=?, price_per_session=?, note=? WHERE id=? AND owner_id=?',
                [$court['id'], $court['name'], $name, in_str('customerPhone'), j($weekdays), $startSlot, $duration, $startDate, $endDate, $price, in_str('note'), $id, $OWNER['id']]);
        } else {
            q('INSERT INTO recurring_bookings (id, court_id, court_name, owner_id, customer_id, customer_name, customer_phone, weekdays, start_slot, duration_minutes, start_date, end_date, price_per_session, status, note) VALUES (?,?,?,?,NULL,?,?,?,?,?,?,?,?,?,?)',
                [uid('rec-'), $court['id'], $court['name'], $OWNER['id'], $name, in_str('customerPhone'), j($weekdays), $startSlot, $duration, $startDate, $endDate, $price, 'active', in_str('note')]);
        }
        return true;
    },

    'recurring_status' => function () {
        staff_need('bookings');
        $ids = my_court_ids();
        if (!$ids) fail('Bạn chưa có sân nào để quản lý lịch cố định.');
        $status = in_str('status');
        if (!in_array($status, ['active', 'paused', 'cancelled'], true)) fail('Trạng thái không hợp lệ.');
        $row = q_one('SELECT id FROM recurring_bookings WHERE id = ? AND court_id IN (' . in_list($ids) . ')', array_merge([in_str('id')], $ids));
        if (!$row) fail('Không tìm thấy lịch cố định thuộc sân của bạn.');
        q('UPDATE recurring_bookings SET status = ? WHERE id = ?', [$status, $row['id']]);
        return true;
    },

    // ---------------- Nhập kho & Tồn kho ----------------
    'inventory_logs' => function () {
        global $OWNER;
        $rows = q_all('SELECT * FROM inventory_logs WHERE owner_id = ? ORDER BY created_at DESC LIMIT 80', [$OWNER['id']]);
        return array_map(fn($r) => [
            'id' => $r['id'], 'serviceId' => $r['service_id'], 'serviceName' => $r['service_name'],
            'type' => $r['type'], 'quantity' => (int) $r['quantity'], 'unitCost' => (int) $r['unit_cost'],
            'note' => $r['note'], 'createdAt' => iso($r['created_at']),
        ], $rows);
    },

    'inventory_adjust' => function () {
        global $OWNER;
        staff_need('services');
        $svcId = in_str('serviceId');
        $varId = in_str('variantId');
        $svc = q_one('SELECT * FROM owner_services WHERE id = ? AND owner_id = ?', [$svcId, $OWNER['id']]) ?: fail('Không tìm thấy dịch vụ.');
        $type = in_array(in_str('type'), ['import', 'export', 'adjust'], true) ? in_str('type') : 'import';
        $qty = max(1, in_int('quantity'));
        $cost = max(0, in_int('unitCost'));

        $varName = '';
        if ($varId) {
            $var = q_one('SELECT * FROM service_variants WHERE id = ? AND service_id = ? AND owner_id = ?', [$varId, $svcId, $OWNER['id']]);
            if ($var) {
                $newVarStock = $type === 'import' ? ((int) $var['stock'] + $qty) : ($type === 'export' ? max(0, (int) $var['stock'] - $qty) : $qty);
                q('UPDATE service_variants SET stock = ? WHERE id = ?', [$newVarStock, $var['id']]);
                $varName = ' (' . $var['name'] . ')';
                $tot = (int) q_val('SELECT SUM(stock) FROM service_variants WHERE service_id = ?', [$svcId]);
                q('UPDATE owner_services SET stock = ? WHERE id = ?', [$tot, $svcId]);
                $newStock = $tot;
            }
        }
        if (!$varName) {
            $newStock = $type === 'import' ? ((int) $svc['stock'] + $qty) : ($type === 'export' ? max(0, (int) $svc['stock'] - $qty) : $qty);
            q('UPDATE owner_services SET stock = ? WHERE id = ?', [$newStock, $svc['id']]);
        }

        $logLabel = $svc['name'] . $varName;
        q('INSERT INTO inventory_logs (id, owner_id, service_id, service_name, type, quantity, unit_cost, note) VALUES (?,?,?,?,?,?,?,?)',
            [uid('inv-'), $OWNER['id'], $svc['id'], $logLabel, $type, $qty, $cost, mb_substr(in_str('note'), 0, 250)]);
        return ['stock' => $newStock];
    },

    // ---------------- Khiếu nại (chỉ thuộc sân / đơn của chủ sân đang đăng nhập) ----------------
    'complaints' => function () {
        $ids = my_court_ids();
        if (!$ids) return [];
        $courts = array_column(q_all('SELECT name FROM courts WHERE id IN (' . in_list($ids) . ')', $ids), 'name');
        $bookingRefs = q_all('SELECT id, code FROM bookings WHERE court_id IN (' . in_list($ids) . ')', $ids);
        $bIds = array_column($bookingRefs, 'id');
        $bCodes = array_column($bookingRefs, 'code');
        $rows = q_all('SELECT * FROM reports ORDER BY created_at DESC LIMIT 80');
        $filtered = array_filter($rows, function ($r) use ($ids, $courts, $bIds, $bCodes) {
            if (in_array($r['target_id'], $ids, true) || in_array($r['target_id'], $bIds, true) || in_array($r['target_id'], $bCodes, true)) return true;
            foreach ($courts as $cn) {
                if ($cn && stripos($r['target_label'], $cn) !== false) return true;
            }
            return false;
        });
        return array_values(array_map(fn($r) => [
            'id' => $r['id'], 'targetType' => $r['target_type'], 'targetLabel' => $r['target_label'],
            'reporterName' => $r['reporter_name'], 'reporterContact' => $r['reporter_contact'],
            'reason' => $r['reason'], 'detail' => (string) $r['detail'], 'severity' => $r['severity'],
            'status' => $r['status'], 'resolutionNote' => $r['resolution_note'], 'createdAt' => iso($r['created_at']),
        ], $filtered));
    },

    'complaint_reply' => function () {
        staff_need('customers');
        $ids = my_court_ids();
        if (!$ids) fail('Bạn chưa có sân nào để xử lý khiếu nại.');
        $id = in_str('id');
        $r = q_one('SELECT * FROM reports WHERE id = ?', [$id]) ?: fail('Không tìm thấy khiếu nại.');
        $courts = array_column(q_all('SELECT name FROM courts WHERE id IN (' . in_list($ids) . ')', $ids), 'name');
        $bookingRefs = q_all('SELECT id, code FROM bookings WHERE court_id IN (' . in_list($ids) . ')', $ids);
        $allowed = in_array($r['target_id'], $ids, true)
            || in_array($r['target_id'], array_column($bookingRefs, 'id'), true)
            || in_array($r['target_id'], array_column($bookingRefs, 'code'), true);
        if (!$allowed) {
            foreach ($courts as $cn) if ($cn && stripos($r['target_label'], $cn) !== false) { $allowed = true; break; }
        }
        if (!$allowed) fail('Khiếu nại này không thuộc sân bạn quản lý.');
        $note = trim(in_str('note'));
        if (mb_strlen($note) < 3) fail('Vui lòng nhập nội dung phản hồi xử lý.');
        q("UPDATE reports SET status = 'reviewing', resolution_note = ? WHERE id = ?", [mb_substr($note, 0, 500), $id]);
        return true;
    },

    // ---------------- Cài đặt, Nhân viên & Tài khoản nhận tiền ----------------
    'settings_get' => function () {
        global $OWNER;
        if (is_staff()) fail('Tài khoản nhân viên không có quyền truy cập cài đặt cơ sở.');
        $row = q_one('SELECT * FROM owner_settings WHERE owner_id = ?', [$OWNER['id']]);
        return [
            'depositRate' => (int) ($row['deposit_rate'] ?? 30),
            'cancelCutoffHours' => (int) ($row['cancel_cutoff_hours'] ?? 4),
            'holdMinutes' => (int) ($row['hold_minutes'] ?? 5),
            'autoApprove' => (bool) ($row['auto_approve'] ?? 0),
            'policyNote' => (string) ($row['policy_note'] ?? ''),
            'notifyNewBooking' => (bool) ($row['notify_new_booking'] ?? 1),
            'notifyCancel' => (bool) ($row['notify_cancel'] ?? 1),
            'notifyReview' => (bool) ($row['notify_review'] ?? 1),
            'bankName' => (string) ($row['bank_name'] ?? ''),
            'bankAccount' => (string) ($row['bank_account'] ?? ''),
            'bankHolder' => (string) ($row['bank_holder'] ?? ''),
        ];
    },

    'settings_save' => function () {
        global $OWNER;
        if (is_staff()) fail('Tài khoản nhân viên không có quyền thay đổi cài đặt cơ sở.');
        $cur = q_one('SELECT * FROM owner_settings WHERE owner_id = ?', [$OWNER['id']]) ?: [];
        $in = input();
        $vals = [
            $OWNER['id'],
            isset($in['depositRate']) ? max(0, min(100, (int) $in['depositRate'])) : (int) ($cur['deposit_rate'] ?? 30),
            isset($in['cancelCutoffHours']) ? max(1, min(72, (int) $in['cancelCutoffHours'])) : (int) ($cur['cancel_cutoff_hours'] ?? 4),
            isset($in['holdMinutes']) ? max(1, min(60, (int) $in['holdMinutes'])) : (int) ($cur['hold_minutes'] ?? 5),
            isset($in['autoApprove']) ? ((int) (bool) $in['autoApprove']) : (int) ($cur['auto_approve'] ?? 0),
            isset($in['policyNote']) ? (string) $in['policyNote'] : (string) ($cur['policy_note'] ?? ''),
            isset($in['notifyNewBooking']) ? ((int) (bool) $in['notifyNewBooking']) : (int) ($cur['notify_new_booking'] ?? 1),
            isset($in['notifyCancel']) ? ((int) (bool) $in['notifyCancel']) : (int) ($cur['notify_cancel'] ?? 1),
            isset($in['notifyReview']) ? ((int) (bool) $in['notifyReview']) : (int) ($cur['notify_review'] ?? 1),
            isset($in['bankName']) ? trim((string) $in['bankName']) : (string) ($cur['bank_name'] ?? ''),
            isset($in['bankAccount']) ? trim((string) $in['bankAccount']) : (string) ($cur['bank_account'] ?? ''),
            isset($in['bankHolder']) ? strtoupper(trim((string) $in['bankHolder'])) : (string) ($cur['bank_holder'] ?? ''),
        ];
        q('INSERT INTO owner_settings (owner_id, deposit_rate, cancel_cutoff_hours, hold_minutes, auto_approve, policy_note, notify_new_booking, notify_cancel, notify_review, bank_name, bank_account, bank_holder)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
           ON DUPLICATE KEY UPDATE deposit_rate=VALUES(deposit_rate), cancel_cutoff_hours=VALUES(cancel_cutoff_hours), hold_minutes=VALUES(hold_minutes), auto_approve=VALUES(auto_approve), policy_note=VALUES(policy_note), notify_new_booking=VALUES(notify_new_booking), notify_cancel=VALUES(notify_cancel), notify_review=VALUES(notify_review), bank_name=VALUES(bank_name), bank_account=VALUES(bank_account), bank_holder=VALUES(bank_holder)', $vals);
        return true;
    },

    'staff_list' => function () {
        global $OWNER;
        if (is_staff()) fail('Chỉ chủ sân mới có quyền xem danh sách nhân viên.');
        return array_map(fn($r) => [
            'id' => $r['id'], 'fullName' => $r['full_name'], 'phone' => $r['phone'], 'email' => $r['email'],
            'roleName' => $r['role_name'], 'permissions' => jd($r['permissions']), 'status' => $r['status'], 'createdAt' => iso($r['created_at']),
            'hasPassword' => !empty($r['password_hash']),
        ], q_all('SELECT * FROM owner_staff WHERE owner_id = ? ORDER BY created_at DESC', [$OWNER['id']]));
    },

    'staff_save' => function () {
        global $OWNER;
        if (is_staff()) fail('Chỉ chủ sân mới có quyền quản lý nhân viên.');
        $name = in_str('fullName');
        if (mb_strlen($name) < 2) fail('Vui lòng nhập họ tên nhân viên.');
        $email = mb_strtolower(trim(in_str('email')));
        if ($email && !valid_email($email)) fail('Email nhân viên chưa đúng định dạng.');
        $phone = trim(in_str('phone'));
        $roleName = in_str('roleName') ?: 'Nhân viên lễ tân';
        $perms = array_values(array_intersect(in_arr('permissions'), ['overview', 'bookings', 'courts', 'services', 'payments', 'customers', 'promotions']));
        if (!$perms) $perms = ['bookings'];
        $status = in_str('status') === 'inactive' ? 'inactive' : 'active';
        $password = (string) (input()['password'] ?? '');
        $id = in_str('id');

        if ($id) {
            $existing = q_one('SELECT * FROM owner_staff WHERE id = ? AND owner_id = ?', [$id, $OWNER['id']]);
            if (!$existing) fail('Không tìm thấy nhân viên.');
            if ($email && $email !== $existing['email']) {
                if (q_val('SELECT id FROM owner_staff WHERE email = ? AND id != ?', [$email, $id]) || q_val('SELECT id FROM users WHERE email = ?', [$email])) {
                    fail('Email này đã được sử dụng bởi tài khoản khác trong hệ thống.');
                }
            }
            if ($password !== '') {
                if (strlen($password) < 6) fail('Mật khẩu nhân viên cần ít nhất 6 ký tự.');
                $pwdHash = password_hash($password, PASSWORD_DEFAULT);
                q('UPDATE owner_staff SET full_name=?, phone=?, email=?, password_hash=?, role_name=?, permissions=?, status=? WHERE id=? AND owner_id=?',
                    [$name, $phone, $email, $pwdHash, $roleName, j($perms), $status, $id, $OWNER['id']]);
            } else {
                q('UPDATE owner_staff SET full_name=?, phone=?, email=?, role_name=?, permissions=?, status=? WHERE id=? AND owner_id=?',
                    [$name, $phone, $email, $roleName, j($perms), $status, $id, $OWNER['id']]);
            }
        } else {
            if (!$email) fail('Vui lòng nhập email đăng nhập cho nhân viên.');
            if (strlen($password) < 6) fail('Vui lòng nhập mật khẩu khởi tạo cho nhân viên (tối thiểu 6 ký tự).');
            if (q_val('SELECT id FROM owner_staff WHERE email = ?', [$email]) || q_val('SELECT id FROM users WHERE email = ?', [$email])) {
                fail('Email này đã được sử dụng trong hệ thống.');
            }
            $pwdHash = password_hash($password, PASSWORD_DEFAULT);
            $newId = uid('st-');
            q('INSERT INTO owner_staff (id, owner_id, full_name, phone, email, password_hash, role_name, permissions, status) VALUES (?,?,?,?,?,?,?,?,?)',
                [$newId, $OWNER['id'], $name, $phone, $email, $pwdHash, $roleName, j($perms), $status]);
        }
        return true;
    },

    'staff_delete' => function () {
        global $OWNER;
        if (is_staff()) fail('Chỉ chủ sân mới có quyền xóa nhân viên.');
        q('DELETE FROM owner_staff WHERE id = ? AND owner_id = ?', [in_str('id'), $OWNER['id']]);
        return true;
    },
]);
