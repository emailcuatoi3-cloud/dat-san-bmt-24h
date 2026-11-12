<?php
/*
 * Module: API Xử lý nghiệp vụ Đặt sân (Mã Minh Hoan - PK04409)
 * - Kiểm tra lịch trống (availability), gợi ý sân tối nay và xác thực mã khuyến mãi
 * - Tính giá theo khung giờ, tạo đơn giữ chỗ 10 phút, chuyển chế độ cọc 30%/100%
 * - Ghi nhận báo chuyển khoản, đối soát tự động cấp vé và hủy giữ chỗ hết hạn
 */
/**
 * API đặt sân của khách: lịch trống, kiểm tra mã giảm giá, giữ sân, báo cọc, tự xác nhận cọc, xem vé.
 * Giá tiền luôn được TÍNH LẠI ở máy chủ, không tin số tiền trình duyệt gửi lên.
 */
require_once __DIR__ . '/../includes/bootstrap.php';

const EXTRA_SERVICES = [
    'bong' => ['Thuê bóng thi đấu', 30000],
    'bib' => ['Thuê áo bib (bộ 10 áo)', 40000],
    'vot' => ['Thuê vợt cầu lông', 20000],
    'cau' => ['Ống cầu lông (3 quả)', 45000],
];

function t2m(string $t): int
{
    [$h, $m] = array_map('intval', explode(':', $t) + [0, 0]);
    return $h * 60 + $m;
}

function m2t(int $m): string
{
    return sprintf('%02d:%02d', intdiv($m, 60) % 24, $m % 60);
}

/** Các khung giờ (mỗi giờ) mà lượt chơi chiếm. */
function slots_in_range(string $start, int $duration): array
{
    $out = [];
    for ($c = t2m($start); $c < t2m($start) + $duration; $c += 60) $out[] = m2t($c);
    return $out;
}

/** Giá mỗi giờ tại một khung giờ theo bảng giá của sân. */
function price_at(array $court, string $slot): int
{
    $m = t2m($slot);
    foreach ($court['priceBands'] as $b) {
        if ($m >= t2m($b['start']) && $m < t2m($b['end'])) return (int) $b['price'];
    }
    return $court['pricePerHour'];
}

/** Tiền sân cho một lượt chơi (tính từng giờ, làm tròn nghìn) — giống calcCourtPriceForRange. */
function court_price(array $court, string $start, int $duration): int
{
    $total = 0;
    $remain = $duration;
    $cursor = t2m($start);
    while ($remain > 0) {
        $chunk = min(60, $remain);
        $total += price_at($court, m2t($cursor)) * $chunk / 60;
        $remain -= $chunk;
        $cursor += $chunk;
    }
    return (int) (round($total / 1000) * 1000);
}

function calc_deposit(int $total): int
{
    return (int) (round($total * DEPOSIT_RATE / 1000) * 1000);
}

/** Các khung giờ đang bận của 1 sân trong 1 ngày (đơn + khóa của chủ sân). */
function taken_slots(string $courtId, string $date, string $excludeId = ''): array
{
    $occ = occupied_slots($date, $excludeId)[$courtId] ?? [];
    $blk = blocked_slots_map($date, [$courtId])[$courtId . ':' . $date] ?? [];
    return array_values(array_unique(array_merge($occ, $blk)));
}

function find_active_promo(string $code): ?array
{
    $row = q_one("SELECT * FROM promotions WHERE code = ? AND status = 'active'", [strtoupper($code)]);
    return $row ? map_promotion($row) : null;
}

function booking_by_code(string $code): ?array
{
    $row = q_one(BOOKING_SELECT . ' WHERE b.code = ?', [$code]);
    return $row ? map_booking($row) : null;
}

run_api([
    // Khung giờ đã bị chiếm + khung giờ chủ sân khóa trong 1 ngày
    'availability' => function () {
        $date = $_GET['date'] ?? date('Y-m-d');
        if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $date)) fail('Ngày không hợp lệ.');
        return ['occupied' => (object) occupied_slots($date), 'blocked' => (object) blocked_slots_map($date)];
    },

    // Sân đang hoạt động + khung giờ tối nay còn trống (dùng cho trợ lý chat)
    'tonight' => function () {
        $date = date('Y-m-d');
        $out = [];
        foreach (public_courts() as $c) {
            if ($c['status'] !== 'active') continue;
            $taken = taken_slots($c['id'], $date);
            $free = array_values(array_filter(['17:00', '18:00', '19:00', '20:00', '21:00'], fn($s) => !in_array($s, $taken, true) && strtotime("$date $s") > time()));
            $out[] = ['id' => $c['id'], 'slug' => $c['slug'], 'name' => $c['name'], 'sport' => $c['sport'], 'area' => $c['area'],
                'image' => $c['image'], 'pricePerHour' => $c['pricePerHour'], 'freeSlots' => $free];
        }
        return $out;
    },

    // Kiểm tra mã giảm giá cho đơn đang đặt
    'check_promo' => function () {
        $code = strtoupper(preg_replace('/[^A-Za-z0-9]/', '', in_str('code')));
        $court = find_court(in_str('courtSlug'));
        $date = in_str('date');
        $start = in_str('startSlot');
        $duration = in_int('duration', 60);
        if (!$code) fail('Vui lòng nhập mã giảm giá.');
        if (!$court || !$start) fail('Hãy chọn sân và khung giờ trước khi áp dụng mã.');
        $promo = find_active_promo($code);
        if (!$promo) fail('Mã không tồn tại hoặc đã ngừng áp dụng.');
        if ($promo['ownerId'] && $court['ownerId'] && $promo['ownerId'] !== $court['ownerId']) fail('Mã này chỉ áp dụng cho sân của ' . $promo['ownerName'] . '.');
        $extras = array_sum(array_map(fn($id) => EXTRA_SERVICES[$id][1] ?? 0, in_arr('extras')));
        $subtotal = court_price($court, $start, $duration) + $extras;
        $err = promo_check($promo, $date, $start, $subtotal);
        if ($err) fail($err);
        return ['promotion' => $promo, 'discount' => promo_discount($promo, $subtotal)];
    },

    // Bước 2 → 3: tạo đơn và giữ sân trong HOLD_MINUTES phút
    'create' => function () {
        $court = find_court(in_str('courtSlug'));
        $date = in_str('date');
        $start = in_str('startSlot');
        $duration = in_int('duration', 60);
        $name = in_str('name');
        $phone = preg_replace('/\s/', '', in_str('phone'));
        $email = in_str('email');
        $note = mb_substr(in_str('note'), 0, 500);
        $mode = in_str('depositMode') === 'full' ? 'full' : 'deposit';

        if (!$court || $court['status'] !== 'active') fail('Vui lòng chọn sân đang hoạt động.');
        if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $date) || $date < date('Y-m-d')) fail('Ngày chơi không hợp lệ.');
        if (!in_array($duration, [60, 90, 120], true)) fail('Thời lượng không hợp lệ.');
        if (!preg_match('/^\d{2}:\d{2}$/', $start)) fail('Vui lòng chọn khung giờ còn trống trên lưới giờ.');
        if (strtotime("$date $start") <= time()) fail('Khung giờ này đã qua. Vui lòng chọn khung giờ khác.');
        if (t2m($start) < t2m($court['openTime']) || t2m($start) + $duration > t2m($court['closeTime'])) fail('Khung giờ nằm ngoài giờ mở cửa của sân.');
        $len = mb_strlen($name);
        if ($len < 2 || $len > 50) fail('Họ tên cần từ 2 đến 50 ký tự.');
        if (!preg_match('/^0\d{9}$/', $phone)) fail('Số điện thoại phải gồm 10 số và bắt đầu bằng 0.');
        if ($email && !filter_var($email, FILTER_VALIDATE_EMAIL)) fail('Email chưa đúng định dạng.');

        $slots = slots_in_range($start, $duration);
        $clash = array_values(array_intersect($slots, taken_slots($court['id'], $date)));
        if ($clash) fail('Khung giờ ' . implode(', ', $clash) . ' vừa có người đặt. Vui lòng chọn khung giờ khác.');

        $extraIds = array_values(array_filter(in_arr('extras'), fn($id) => isset(EXTRA_SERVICES[$id])));
        $extrasTotal = array_sum(array_map(fn($id) => EXTRA_SERVICES[$id][1], $extraIds));
        $courtFee = court_price($court, $start, $duration);
        $subtotal = $courtFee + $extrasTotal;
        $discount = 0;
        $promoCode = null;
        if ($code = strtoupper(in_str('promoCode'))) {
            $promo = find_active_promo($code);
            if ($promo && !promo_check($promo, $date, $start, $subtotal)) {
                $discount = promo_discount($promo, $subtotal);
                $promoCode = $promo['code'];
            }
        }
        $total = max(0, $subtotal - $discount);
        $deposit = $mode === 'full' ? $total : calc_deposit($total);
        $u = current_user();

        $id = uid('cb-');
        $bookingCode = 'BMT' . date('Ymd') . '-' . random_int(1000, 9999);
        while (q_val('SELECT id FROM bookings WHERE code = ?', [$bookingCode])) $bookingCode = 'BMT' . date('Ymd') . '-' . random_int(1000, 9999);

        q('INSERT INTO bookings (id, code, source, court_id, court_name, sport, area, image, customer_id, customer_name, customer_phone, customer_email,
             booking_date, start_slot, duration_minutes, slots, unit_price, base_total, discount_amount, promo_code, total_price, deposit_amount, extras,
             payment_method, payment_status, status, hold_expires_at, note)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)', [
            $id, $bookingCode, 'online', $court['id'], $court['name'], $court['sport'], $court['area'], $court['image'], $u['id'] ?? null,
            $name, $phone, $email ?: null, $date, $start, $duration, j($slots), $court['pricePerHour'], $subtotal, $discount, $promoCode,
            $total, $deposit, j(array_map(fn($x) => ['id' => $x, 'label' => EXTRA_SERVICES[$x][0], 'price' => EXTRA_SERVICES[$x][1]], $extraIds)),
            $mode === 'full' ? 'vietqr-full' : 'vietqr-deposit', 'unpaid', 'pending', date('Y-m-d H:i:s', time() + HOLD_MINUTES * 60), $note ?: null,
        ]);
        return booking_by_code($bookingCode);
    },

    // Đổi giữa "cọc 30%" và "trả đủ" ở bước 3
    'set_mode' => function () {
        $b = q_one('SELECT * FROM bookings WHERE id = ?', [in_str('id')]);
        if (!$b || $b['payment_status'] !== 'unpaid') fail('Không tìm thấy đơn đang giữ sân.');
        $full = in_str('mode') === 'full';
        q('UPDATE bookings SET deposit_amount = ?, payment_method = ? WHERE id = ?',
            [$full ? (int) $b['total_price'] : calc_deposit((int) $b['total_price']), $full ? 'vietqr-full' : 'vietqr-deposit', $b['id']]);
        return booking_by_code($b['code']);
    },

    // Khách bấm "Tôi đã chuyển khoản": kiểm tra đơn, thời gian giữ sân và trùng lịch rồi ghi nhận báo cọc
    'claim' => function () {
        $b = q_one('SELECT * FROM bookings WHERE id = ?', [in_str('id')]);
        if (!$b) fail('Không tìm thấy đơn trong hệ thống nên chưa thể hiện vé. Vui lòng thử lại.');
        if ($b['status'] === 'cancelled') fail('Đơn này đã bị hủy nên không thể hiện vé. Vui lòng đặt lại khung giờ khác.');
        if ($b['payment_status'] === 'unpaid' && $b['hold_expires_at'] && strtotime($b['hold_expires_at']) <= time()) {
            fail('Đã hết thời gian giữ sân. Vui lòng chọn lại khung giờ khác.');
        }
        $clash = array_values(array_intersect(jd($b['slots']), taken_slots($b['court_id'], $b['booking_date'], $b['id'])));
        if ($clash) fail('Khung giờ ' . implode(', ', $clash) . ' vừa được người khác đặt. Vui lòng chọn khung giờ khác.');
        q("UPDATE bookings SET payment_status = 'deposit_claimed' WHERE id = ? AND payment_status = 'unpaid'", [$b['id']]);
        return ['autoConfirmSeconds' => AUTO_CONFIRM_SECONDS];
    },

    // Sau thời gian đối soát, hệ thống tự xác nhận cọc và mở vé
    'auto_confirm' => function () {
        $b = q_one('SELECT * FROM bookings WHERE id = ?', [in_str('id')]);
        if (!$b || $b['payment_status'] === 'unpaid') fail('Không tìm thấy đơn để xác nhận tiền cọc. Vui lòng tải lại trang và thử lại.');
        if ($b['payment_status'] === 'deposit_claimed') {
            $full = $b['payment_method'] === 'vietqr-full' || (int) $b['deposit_amount'] >= (int) $b['total_price'];
            q("UPDATE bookings SET payment_status = ?, status = 'confirmed' WHERE id = ?", [$full ? 'paid' : 'deposit_paid', $b['id']]);
        }
        return booking_by_code($b['code']);
    },

    // Khách hủy lượt giữ sân khi chưa chuyển khoản
    'cancel_hold' => function () {
        q("UPDATE bookings SET status = 'cancelled', cancel_reason = 'Khách hủy giữ sân' WHERE id = ? AND payment_status = 'unpaid' AND status = 'pending'", [in_str('id')]);
        return true;
    },

    // Xem 1 đơn theo mã vé
    'get' => function () {
        $b = booking_by_code(strtoupper(trim($_GET['code'] ?? in_str('code'))));
        if (!$b) fail('Không tìm thấy đơn với mã này.');
        return $b;
    },
]);
