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
require_once __DIR__ . '/../includes/mailer.php';

const EXTRA_SERVICES = [
    'bong' => ['Thuê bóng thi đấu', 30000],
    'bib' => ['Thuê áo bib (bộ 10 áo)', 40000],
    'vot' => ['Thuê vợt cầu lông', 20000],
    'cau' => ['Ống cầu lông (3 quả)', 45000],
]; 

/** Phân giải dịch vụ thêm & biến thể đa thuộc tính */
function resolve_booking_extras(array $rawExtras): array
{
    $items = [];
    $total = 0;
    foreach ($rawExtras as $item) {
        if (is_string($item)) {
            $sid = trim($item);
            if (isset(EXTRA_SERVICES[$sid])) {
                $p = (int) EXTRA_SERVICES[$sid][1];
                $items[] = [
                    'id' => $sid, 'variantId' => '', 'label' => EXTRA_SERVICES[$sid][0],
                    'variantName' => '', 'price' => $p, 'quantity' => 1, 'total' => $p,
                ];
                $total += $p;
                continue;
            }
            $svc = q_one('SELECT * FROM owner_services WHERE id = ?', [$sid]);
            if ($svc) {
                $p = (int) $svc['price'];
                $items[] = [
                    'id' => $svc['id'], 'variantId' => '', 'label' => $svc['name'],
                    'variantName' => '', 'price' => $p, 'quantity' => 1, 'total' => $p,
                ];
                $total += $p;
            }
            continue;
        }

        if (is_array($item)) {
            $sid = trim((string) ($item['id'] ?? ''));
            $vid = trim((string) ($item['variantId'] ?? ''));
            $qty = max(1, (int) ($item['quantity'] ?? 1));

            if ($vid) {
                $var = q_one('SELECT v.*, s.name as service_name FROM service_variants v JOIN owner_services s ON v.service_id = s.id WHERE v.id = ?', [$vid]);
                if ($var) {
                    $p = (int) $var['price'];
                    $t = $p * $qty;
                    $items[] = [
                        'id' => $var['service_id'], 'variantId' => $var['id'], 'sku' => $var['sku'],
                        'label' => $var['service_name'], 'variantName' => $var['name'],
                        'price' => $p, 'quantity' => $qty, 'total' => $t,
                    ];
                    $total += $t;
                    continue;
                }
            }

            if ($sid) {
                $svc = q_one('SELECT * FROM owner_services WHERE id = ?', [$sid]);
                if ($svc) {
                    $p = (int) $svc['price'];
                    $t = $p * $qty;
                    $items[] = [
                        'id' => $svc['id'], 'variantId' => '', 'label' => $svc['name'],
                        'variantName' => '', 'price' => $p, 'quantity' => $qty, 'total' => $t,
                    ];
                    $total += $t;
                    continue;
                }
                if (isset(EXTRA_SERVICES[$sid])) {
                    $p = (int) EXTRA_SERVICES[$sid][1];
                    $t = $p * $qty;
                    $items[] = [
                        'id' => $sid, 'variantId' => '', 'label' => EXTRA_SERVICES[$sid][0],
                        'variantName' => '', 'price' => $p, 'quantity' => $qty, 'total' => $t,
                    ];
                    $total += $t;
                }
            }
        }
    }
    return ['items' => $items, 'total' => $total];
} 

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
    if ($row) return map_promotion($row);

    $u = current_user();
    if ($u) {
        $uv = q_one("SELECT * FROM user_vouchers WHERE user_id = ? AND UPPER(code) = ? AND status = 'available' AND (expires_at IS NULL OR expires_at >= NOW())", [$u['id'], strtoupper($code)]);
        if ($uv) {
            return [
                'id' => $uv['id'],
                'ownerId' => null,
                'ownerName' => 'Ví cá nhân',
                'code' => strtoupper($uv['code']),
                'title' => $uv['title'],
                'description' => $uv['description'],
                'discountType' => $uv['discount_type'],
                'discountValue' => (int) $uv['discount_value'],
                'maxDiscount' => null,
                'minOrder' => (int) $uv['min_order'],
                'startDate' => substr($uv['created_at'], 0, 10),
                'endDate' => $uv['expires_at'] ? substr($uv['expires_at'], 0, 10) : '2099-12-31',
                'expiresAt' => $uv['expires_at'] ? iso($uv['expires_at']) : null,
                'weekdays' => [],
                'startTime' => '',
                'endTime' => '',
                'usageLimit' => 1,
                'status' => 'active',
                'isUserVoucher' => true,
            ];
        }
    }
    return null;
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

    // Danh sách toàn bộ mã giảm giá đang hoạt động trên hệ thống (và ví cá nhân nếu đăng nhập)
    'promotions' => function () {
        $promos = array_map(function ($r) {
            $p = map_promotion($r);
            $c = strtoupper($p['code']);
            $claimed = promo_claimed_count($c);
            $saved = (int) q_val("SELECT COUNT(*) FROM user_vouchers WHERE UPPER(code) = ?", [$c]);
            $p['savedCount'] = $saved;
            $p['claimedCount'] = $claimed;
            $p['remainingCount'] = $p['usageLimit'] ? max(0, $p['usageLimit'] - $claimed) : null;
            return $p;
        }, q_all("SELECT * FROM promotions WHERE status = 'active' AND end_date >= CURDATE() ORDER BY discount_value DESC, updated_at DESC"));
        $u = current_user();
        if ($u) {
            $uvs = q_all("SELECT * FROM user_vouchers WHERE user_id = ? AND status = 'available' AND (expires_at IS NULL OR expires_at >= NOW())", [$u['id']]);
            $existingCodes = array_map(fn($p) => strtoupper($p['code']), $promos);
            foreach ($uvs as $uv) {
                $c = strtoupper($uv['code']);
                if (!in_array($c, $existingCodes, true)) {
                    $promos[] = [
                        'id' => $uv['id'],
                        'ownerId' => null,
                        'ownerName' => 'Hệ thống',
                        'code' => $c,
                        'title' => $uv['title'],
                        'description' => $uv['description'],
                        'discountType' => $uv['discount_type'],
                        'discountValue' => (int) $uv['discount_value'],
                        'maxDiscount' => null,
                        'minOrder' => (int) $uv['min_order'],
                        'startDate' => substr($uv['created_at'], 0, 10),
                        'endDate' => $uv['expires_at'] ? substr($uv['expires_at'], 0, 10) : '2099-12-31',
                        'expiresAt' => $uv['expires_at'] ? iso($uv['expires_at']) : null,
                        'weekdays' => [],
                        'startTime' => '',
                        'endTime' => '',
                        'usageLimit' => 1,
                        'status' => 'active',
                        'isUserVoucher' => true,
                    ];
                    $existingCodes[] = $c;
                }
            }
        }
        return $promos;
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
        $parsedExtras = resolve_booking_extras(in_arr('extras'));
        $subtotal = court_price($court, $start, $duration) + $parsedExtras['total'];
        $err = promo_check($promo, $date, $start, $subtotal);
        if ($err) fail($err);
        return ['promotion' => $promo, 'discount' => promo_discount($promo, $subtotal)];
    },

    // Tra cứu mã ưu đãi (dùng cho ô nhập mã ưu đãi mới trên trang /uu-dai)
    'lookup_promo' => function () {
        $raw = in_str('code');
        $code = strtoupper(trim(preg_replace('/[^A-Za-z0-9_-]/', '', $raw)));
        if (!$code) fail('Vui lòng nhập mã ưu đãi cần tra cứu.');

        $today = date('Y-m-d');

        // 1. Tìm trong bảng promotions
        $row = q_one('SELECT * FROM promotions WHERE UPPER(code) = ?', [$code]);
        if ($row) {
            $p = map_promotion($row);
            $claimedCount = promo_claimed_count($row['code']);
            $savedCount = (int) q_val("SELECT COUNT(*) FROM user_vouchers WHERE UPPER(code) = ?", [strtoupper($row['code'])]);
            $p['savedCount'] = $savedCount;
            $p['claimedCount'] = $claimedCount;
            $p['remainingCount'] = $p['usageLimit'] ? max(0, $p['usageLimit'] - $claimedCount) : null;
            $isLimitReached = $p['usageLimit'] && $p['usageLimit'] > 0 && $claimedCount >= $p['usageLimit'];

            if ($isLimitReached) {
                return [
                    'found' => true,
                    'promotion' => $p,
                    'state' => 'exhausted',
                    'message' => 'Mã ưu đãi này đã hết số lượng phát hành (tối đa ' . $p['usageLimit'] . ' lượt).',
                ];
            }

            $state = 'active';
            $msg = 'Mã ưu đãi hợp lệ và đang áp dụng!';
            if ($row['status'] === 'paused') {
                $state = 'paused';
                $msg = 'Mã ưu đãi này hiện đang tạm dừng áp dụng.';
            } elseif ($p['startDate'] > $today) {
                $state = 'upcoming';
                $msg = 'Mã ưu đãi sắp mở từ ngày ' . date('d/m/Y', strtotime($p['startDate'])) . '.';
            } elseif ($p['endDate'] < $today) {
                $state = 'expired';
                $msg = 'Mã ưu đãi này đã hết hạn từ ngày ' . date('d/m/Y', strtotime($p['endDate'])) . '.';
            }
            return [
                'found' => true,
                'promotion' => $p,
                'state' => $state,
                'message' => $msg,
            ];
        }

        // 2. Tìm trong danh mục quà tặng Vòng quay may mắn
        $wheelPrizes = [
            'QUAY10' => ['title' => 'Giảm 10% tiền sân', 'discountType' => 'percent', 'discountValue' => 10, 'minOrder' => 100000, 'desc' => 'Áp dụng cho mọi khung giờ từ 100.000đ'],
            'QUAY20K' => ['title' => 'Voucher 20.000đ', 'discountType' => 'amount', 'discountValue' => 20000, 'minOrder' => 0, 'desc' => 'Trừ trực tiếp 20.000đ vào đơn đặt sân'],
            'NUOCFREE' => ['title' => 'Tặng 2 chai nước suối', 'discountType' => 'gift', 'discountValue' => 0, 'minOrder' => 0, 'desc' => 'Đưa mã cho nhân viên sân khi check-in'],
            'QUAY15' => ['title' => 'Giảm 15% giờ vàng', 'discountType' => 'percent', 'discountValue' => 15, 'minOrder' => 0, 'desc' => 'Áp dụng khung sáng – chiều 05:00 - 16:00'],
            'QUAY50K' => ['title' => 'Voucher VIP 50.000đ', 'discountType' => 'amount', 'discountValue' => 50000, 'minOrder' => 300000, 'desc' => 'Áp dụng cho đơn đặt từ 300.000đ'],
            'THEM30P' => ['title' => 'Tặng 30 phút chơi thêm', 'discountType' => 'gift', 'discountValue' => 0, 'minOrder' => 0, 'desc' => 'Áp dụng khi sân còn trống khung liền kề'],
        ];
        if (isset($wheelPrizes[$code])) {
            $wp = $wheelPrizes[$code];
            $promo = [
                'id' => 'wheel-' . strtolower($code),
                'ownerId' => null,
                'ownerName' => 'Vòng quay ưu đãi BMT 24H',
                'code' => $code,
                'title' => $wp['title'],
                'description' => $wp['desc'],
                'discountType' => $wp['discountType'],
                'discountValue' => $wp['discountValue'],
                'maxDiscount' => null,
                'minOrder' => $wp['minOrder'],
                'startDate' => $today,
                'endDate' => date('Y-m-d', strtotime('+30 days')),
                'weekdays' => [],
                'startTime' => '',
                'endTime' => '',
                'usageLimit' => 1,
                'status' => 'active',
                'isWheelPrize' => true,
            ];
            return [
                'found' => true,
                'promotion' => $promo,
                'state' => 'active',
                'message' => 'Mã ưu đãi từ Vòng quay may mắn hợp lệ và sẵn sàng sử dụng!',
            ];
        }

        // 3. Tìm trong ví voucher người dùng (nếu có đăng nhập)
        $u = current_user();
        if ($u) {
            $uv = q_one('SELECT * FROM user_vouchers WHERE user_id = ? AND UPPER(code) = ?', [$u['id'], $code]);
            if ($uv) {
                $isExpired = $uv['expires_at'] && strtotime($uv['expires_at']) < time();
                $isUsed = $uv['status'] === 'used';
                $promo = [
                    'id' => $uv['id'],
                    'ownerId' => null,
                    'ownerName' => 'Ví voucher của bạn',
                    'code' => strtoupper($uv['code']),
                    'title' => $uv['title'],
                    'description' => $uv['description'],
                    'discountType' => $uv['discount_type'],
                    'discountValue' => (int) $uv['discount_value'],
                    'maxDiscount' => null,
                    'minOrder' => (int) $uv['min_order'],
                    'startDate' => substr($uv['created_at'], 0, 10),
                    'endDate' => $uv['expires_at'] ? substr($uv['expires_at'], 0, 10) : date('Y-m-d', strtotime('+30 days')),
                    'expiresAt' => $uv['expires_at'] ? iso($uv['expires_at']) : null,
                    'weekdays' => [],
                    'startTime' => '',
                    'endTime' => '',
                    'usageLimit' => 1,
                    'status' => $isUsed ? 'exhausted' : ($isExpired ? 'expired' : 'active'),
                    'isUserVoucher' => true,
                ];
                if ($isUsed) {
                    return [
                        'found' => true,
                        'promotion' => $promo,
                        'state' => 'exhausted',
                        'message' => 'Mã voucher này đã được sử dụng trước đó.',
                    ];
                }
                return [
                    'found' => true,
                    'promotion' => $promo,
                    'state' => $isExpired ? 'expired' : 'active',
                    'message' => $isExpired ? 'Mã ưu đãi trong ví của bạn đã hết hạn.' : 'Mã ưu đãi có trong Ví voucher của bạn và sẵn sàng sử dụng!',
                ];
            }
        }

        fail('Mã ưu đãi không tồn tại hoặc đã được sử dụng.');
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

        $parsedExtras = resolve_booking_extras(in_arr('extras'));
        $extrasTotal = $parsedExtras['total'];
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
             payment_method, payment_status, status, approved_at, hold_expires_at, note)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)', [
            $id, $bookingCode, 'online', $court['id'], $court['name'], $court['sport'], $court['area'], $court['image'], $u['id'] ?? null,
            $name, $phone, $email ?: null, $date, $start, $duration, j($slots), $court['pricePerHour'], $subtotal, $discount, $promoCode,
            $total, $deposit, j($parsedExtras['items']),
            $mode === 'full' ? 'vietqr-full' : 'vietqr-deposit', 'unpaid', 'pending', null, null, $note ?: null,
        ]);

        // Cập nhật tồn kho dịch vụ / biến thể đã chọn
        foreach ($parsedExtras['items'] as $it) {
            $qty = (int) ($it['quantity'] ?? 1);
            if (!empty($it['variantId'])) {
                q('UPDATE service_variants SET stock = GREATEST(0, stock - ?) WHERE id = ?', [$qty, $it['variantId']]);
                q('UPDATE owner_services SET stock = GREATEST(0, stock - ?) WHERE id = ?', [$qty, $it['id']]);
            } elseif (!empty($it['id'])) {
                q('UPDATE owner_services SET stock = GREATEST(0, stock - ?) WHERE id = ?', [$qty, $it['id']]);
            }
        }
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
        auto_cancel_expired_holds();
        $b = q_one('SELECT * FROM bookings WHERE id = ?', [in_str('id')]);
        if (!$b) fail('Không tìm thấy đơn trong hệ thống nên chưa thể hiện vé. Vui lòng thử lại.');
        if ($b['status'] === 'cancelled') fail('Đơn này đã bị hủy nên không thể chuyển cọc. Vui lòng đặt lại khung giờ khác.');
        if (!$b['approved_at']) fail('Đơn đặt sân đang chờ chủ sân duyệt. Khi chủ sân duyệt xong, hệ thống mới mở cổng nhận cọc.');
        if ($b['payment_status'] === 'unpaid' && $b['hold_expires_at'] && strtotime($b['hold_expires_at']) <= time()) {
            fail('Đã hết thời gian 5 phút chuyển cọc. Đơn đã tự động hủy.');
        }
        $clash = array_values(array_intersect(jd($b['slots']), taken_slots($b['court_id'], $b['booking_date'], $b['id'])));
        if ($clash) fail('Khung giờ ' . implode(', ', $clash) . ' vừa được người khác đặt. Vui lòng chọn khung giờ khác.');
        $u = current_user();
        if (!$b['customer_id'] && $u) {
            q("UPDATE bookings SET customer_id = ?, payment_status = 'deposit_claimed' WHERE id = ? AND payment_status = 'unpaid'", [$u['id'], $b['id']]);
        } else {
            q("UPDATE bookings SET payment_status = 'deposit_claimed' WHERE id = ? AND payment_status = 'unpaid'", [$b['id']]);
        }
        return ['autoConfirmSeconds' => AUTO_CONFIRM_SECONDS];
    },

    // Xác nhận tiền cọc: chỉ xác nhận khi đơn đã được đối soát qua SePay/Webhook thành công
    'auto_confirm' => function () {
        $b = q_one('SELECT * FROM bookings WHERE id = ?', [in_str('id')]);
        if (!$b) fail('Không tìm thấy đơn.');
        if (in_array($b['payment_status'], ['paid', 'deposit_paid'], true)) {
            return booking_by_code($b['code']);
        }
        fail('Hệ thống chưa nhận được tiền chuyển khoản từ tài khoản MBBank. Vui lòng chuyển tiền đúng nội dung đơn hàng rồi kiểm tra lại.');
    },

    // Khách hủy lượt giữ sân khi chưa chuyển khoản
    'cancel_hold' => function () {
        q("UPDATE bookings SET status = 'cancelled', cancel_reason = 'Khách hủy giữ sân' WHERE id = ? AND payment_status = 'unpaid' AND status = 'pending'", [in_str('id')]);
        return true;
    },

    // Xem 1 đơn theo mã vé
    'get' => function () {
        auto_cancel_expired_holds();
        $b = booking_by_code(strtoupper(trim($_GET['code'] ?? in_str('code'))));
        if (!$b) fail('Không tìm thấy đơn với mã này.');
        return $b;
    },

    // Kiểm tra trực tiếp biến động số dư SePay (Real-time Polling siêu nhanh dựa vào Webhook)
    'check_sepay' => function () {
        $id = in_str('id');
        $code = strtoupper(trim(in_str('code')));
        $b = $id ? q_one('SELECT * FROM bookings WHERE id = ?', [$id]) : ($code ? q_one('SELECT * FROM bookings WHERE code = ?', [$code]) : null);
        if (!$b) fail('Không tìm thấy đơn.');

        if (in_array($b['payment_status'], ['paid', 'deposit_paid'], true)) {
            return ['confirmed' => true, 'booking' => booking_by_code($b['code'])];
        }

        return ['confirmed' => false, 'booking' => booking_by_code($b['code'])];
    },
]);
