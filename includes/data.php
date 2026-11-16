<?php
/**
 * Chuyển dòng CSDL thành mảng dữ liệu cho giao diện + các truy vấn nghiệp vụ dùng chung.
 */

function sport_label(string $sport): string
{
    return $sport === 'badminton' ? 'Sân cầu lông' : 'Sân bóng đá';
}

// ======================= SÂN =======================

function map_court(array $r): array
{
    $images = jd($r['images']);
    return [
        'id' => $r['id'],
        'slug' => $r['slug'],
        'ownerId' => $r['owner_id'] !== null ? (int) $r['owner_id'] : null,
        'name' => $r['name'],
        'sport' => $r['sport'] === 'badminton' ? 'badminton' : 'football',
        'sportLabel' => $r['sport_label'] ?: sport_label($r['sport']),
        'area' => $r['area'],
        'address' => $r['address'],
        'pricePerHour' => (int) $r['price_per_hour'],
        'peakPrice' => (int) $r['peak_price'],
        'priceNote' => $r['price_note'],
        'priceBands' => jd($r['price_bands']),
        'fieldPriceStep' => $r['field_price_step'] !== null ? (int) $r['field_price_step'] : null,
        'operatingNote' => $r['operating_note'],
        'rating' => (float) $r['rating'],
        'reviewCount' => (int) $r['review_count'],
        'monthlyBookings' => (int) $r['monthly_bookings'],
        'description' => (string) $r['description'],
        'highlights' => jd($r['highlights']),
        'facilities' => jd($r['facilities']),
        'images' => $images,
        'image' => $images[0] ?? '',
        'openTime' => $r['open_time'],
        'closeTime' => $r['close_time'],
        'weeklyHours' => $r['weekly_hours'] ? jd($r['weekly_hours']) : null,
        'fieldTypes' => jd($r['field_types']),
        'featured' => (bool) $r['featured'],
        'status' => $r['status'],
        'mapQuery' => $r['map_query'] ?: $r['address'],
        'note' => (string) $r['note'],
        'deletedAt' => iso($r['deleted_at']),
        'createdAt' => iso($r['created_at']),
    ];
}

/** Sân hiển thị cho khách: chưa xóa, không bị tạm dừng. */
function public_courts(): array
{
    static $cache = null;
    if ($cache === null) {
        $rows = q_all("SELECT * FROM courts WHERE deleted_at IS NULL AND status <> 'paused' ORDER BY sort_order, created_at");
        $cache = array_map('map_court', $rows);
    }
    return $cache;
}

function find_court(string $idOrSlug): ?array
{
    $row = q_one('SELECT * FROM courts WHERE (id = ? OR slug = ?) AND deleted_at IS NULL', [$idOrSlug, $idOrSlug]);
    return $row ? map_court($row) : null;
}

/** Danh sách khu vực (lấy từ danh mục đang bật, bổ sung khu vực của sân). */
function court_areas(): array
{
    $areas = array_column(q_all("SELECT name FROM categories WHERE kind = 'area' AND active = 1 ORDER BY sort_order"), 'name');
    foreach (public_courts() as $c) {
        if ($c['area'] && !in_array($c['area'], $areas, true)) $areas[] = $c['area'];
    }
    return $areas;
}

// ======================= ĐƠN ĐẶT SÂN =======================

function slot_end(string $slot): string
{
    [$h, $m] = array_map('intval', explode(':', $slot) + [0, 0]);
    return sprintf('%02d:%02d', $h + 1, $m);
}

/** Thời điểm kết thúc lượt chơi (timestamp) — giờ cuối + 60 phút. */
function session_end_ts(string $date, array $slots): ?int
{
    if (!$date || !$slots) return null;
    $last = end($slots);
    [$h, $m] = array_map('intval', explode(':', $last) + [0, 0]);
    $base = strtotime($date . ' 00:00:00');
    return $base ? $base + ($h * 60 + $m + 60) * 60 : null;
}

function session_ended(string $date, array $slots): bool
{
    $end = session_end_ts($date, $slots);
    return $end !== null && $end <= time();
}

function is_expired_hold(array $r): bool
{
    return $r['source'] === 'online' && $r['status'] === 'pending' && $r['payment_status'] === 'unpaid'
        && $r['hold_expires_at'] && strtotime($r['hold_expires_at']) <= time();
}

function payment_method_label(?string $m): string
{
    return ['cash' => 'Tiền mặt', 'vietqr' => 'VietQR', 'transfer' => 'Chuyển khoản'][$m ?? ''] ?? ($m ?: 'VietQR');
}

function booking_payment_label(array $r): string
{
    if ($r['source'] === 'owner') return $r['payment_label'] ?: 'Thanh toán tại sân';
    $total = (int) $r['total_price'];
    $dep = (int) $r['deposit_amount'];
    switch ($r['payment_status']) {
        case 'unpaid': return 'VietQR – chờ cọc ' . money($dep);
        case 'paid': return 'VietQR – đã thu đủ ' . money($total);
        case 'deposit_paid': return 'VietQR – đã nhận cọc ' . money($dep);
        default: return $dep > 0 ? 'VietQR – đã báo cọc ' . money($dep) : 'Thanh toán tại sân';
    }
}

function map_booking(array $r): array
{
    $slots = jd($r['slots']);
    $raw = $r['status'];
    $expired = is_expired_hold($r);
    $status = $expired ? 'cancelled' : (($raw === 'confirmed' && session_ended($r['booking_date'], $slots)) ? 'completed' : $raw);
    return [
        'id' => $r['id'],
        'code' => $r['code'],
        'source' => $r['source'],
        'courtId' => $r['court_id'],
        'courtSlug' => $r['court_slug'] ?? null,
        'courtName' => $r['court_name'],
        'address' => $r['court_address'] ?? '',
        'sport' => $r['sport'] === 'badminton' ? 'badminton' : 'football',
        'sportLabel' => sport_label($r['sport']),
        'area' => $r['area'],
        'image' => $r['image'],
        'customerId' => $r['customer_id'] !== null ? (int) $r['customer_id'] : null,
        'customerName' => $r['customer_name'],
        'customerPhone' => $r['customer_phone'],
        'customerEmail' => (string) $r['customer_email'],
        'date' => $r['booking_date'],
        'startSlot' => $r['start_slot'],
        'durationMinutes' => (int) $r['duration_minutes'],
        'slots' => $slots,
        'unitPrice' => (int) $r['unit_price'],
        'baseTotal' => (int) $r['base_total'],
        'discount' => (int) $r['discount_amount'],
        'promoCode' => $r['promo_code'],
        'totalPrice' => (int) $r['total_price'],
        'depositAmount' => (int) $r['deposit_amount'],
        'extras' => jd($r['extras']),
        'paymentMethod' => $r['payment_method'],
        'paymentStatus' => $r['payment_status'],
        'payment' => booking_payment_label($r),
        'status' => $status,
        'rawStatus' => $raw,
        'expiredHold' => $expired,
        'rejectReason' => $r['reject_reason'],
        'cancelReason' => $expired ? 'Hết thời gian giữ sân do chưa xác nhận tiền cọc.' : $r['cancel_reason'],
        'holdExpiresAt' => iso($r['hold_expires_at']),
        'checkedInAt' => iso($r['checked_in_at']),
        'note' => (string) $r['note'],
        'createdAt' => iso($r['created_at']),
    ];
}

/** Câu SELECT đơn kèm slug + địa chỉ sân. */
const BOOKING_SELECT = 'SELECT b.*, c.slug AS court_slug, c.address AS court_address, c.owner_id AS court_owner_id FROM bookings b LEFT JOIN courts c ON c.id = b.court_id';

/** Tự động hủy các đơn giữ sân quá thời gian chờ cọc trong CSDL để trả lại khung giờ trống ngay lập tức. */
function auto_cancel_expired_holds(): int
{
    $now = date('Y-m-d H:i:s');
    $stmt = q("UPDATE bookings 
               SET status = 'cancelled', cancel_reason = 'Hết thời gian giữ sân (hệ thống tự động hủy)' 
               WHERE source = 'online' AND status = 'pending' AND payment_status = 'unpaid' 
                 AND hold_expires_at IS NOT NULL AND hold_expires_at <= ?", [$now]);
    return $stmt->rowCount();
}

/** Đơn đã duyệt và đã hết giờ chơi thì tự chốt Hoàn thành trong CSDL. */
function auto_complete_bookings(): void
{
    $rows = q_all("SELECT id, booking_date, slots FROM bookings WHERE status = 'confirmed' AND booking_date <= CURDATE()");
    $ids = [];
    foreach ($rows as $r) {
        if (session_ended($r['booking_date'], jd($r['slots']))) $ids[] = $r['id'];
    }
    if ($ids) q('UPDATE bookings SET status = \'completed\' WHERE id IN (' . in_list($ids) . ')', $ids);
}

/**
 * Kiểm tra và ngăn chặn các hành vi spam đặt sân, giữ chỗ ảo, flood request.
 * Ném lỗi RuntimeException (fail) nếu phát hiện hành vi spam.
 */
function check_booking_spam(string $phone, string $date = '', array $targetSlots = [], string $honeypot = '', int $formLoadedAt = 0): void
{
    // 1. Chống Bot qua Honeypot (nếu bot tự điền trường ẩn)
    if (!empty($honeypot)) {
        fail('Phát hiện thao tác bất thường từ trình duyệt. Vui lòng tải lại trang và thử lại.');
    }

    // 2. Chống Bot quét form quá nhanh (< 2 giây từ lúc mở Bước 2)
    if ($formLoadedAt > 0) {
        $nowMs = (int) round(microtime(true) * 1000);
        if ($nowMs - $formLoadedAt < 1800) {
            fail('Thao tác quá nhanh. Vui lòng kiểm tra lại thông tin trước khi gửi.');
        }
    }

    // 3. Chuẩn hóa và kiểm tra số điện thoại
    $cleanPhone = clean_vietnam_phone($phone);
    if (!is_valid_vietnam_phone($cleanPhone)) {
        fail('Số điện thoại không hợp lệ hoặc không thuộc nhà mạng Việt Nam. Vui lòng kiểm tra lại.');
    }

    // 4. Kiểm tra danh sách đen số điện thoại (nếu có)
    if (defined('BLACKLISTED_PHONES') && in_array($cleanPhone, BLACKLISTED_PHONES, true)) {
        fail('Số điện thoại này tạm thời không thể đặt sân trực tuyến. Vui lòng gọi hotline ' . HOTLINE . ' để được hỗ trợ.');
    }

    // 5. Rate limiting: Giới hạn tần suất đặt sân liên tục từ cùng một phiên/người dùng
    $lastTime = $_SESSION['last_booking_create_time'] ?? 0;
    $cooldown = defined('BOOKING_COOLDOWN_SECONDS') ? BOOKING_COOLDOWN_SECONDS : 15;
    $elapsed = time() - $lastTime;
    if ($elapsed < $cooldown) {
        $wait = $cooldown - $elapsed;
        fail("Bạn vừa gửi yêu cầu đặt sân. Vui lòng đợi $wait giây trước khi tạo đơn tiếp theo.");
    }

    // 6. Tự động giải phóng các đơn giữ sân quá hạn trước khi đếm
    auto_cancel_expired_holds();

    // 7. Chống spam giữ chỗ ảo: Giới hạn số đơn đang giữ chỗ (pending) của 1 số điện thoại
    $maxActive = defined('MAX_ACTIVE_HOLDS_PER_PHONE') ? MAX_ACTIVE_HOLDS_PER_PHONE : 1;
    $activeHold = q_one("SELECT code, court_name, booking_date, start_slot, payment_status 
                         FROM bookings 
                         WHERE REPLACE(customer_phone, ' ', '') = ? 
                           AND status = 'pending' 
                           AND (hold_expires_at IS NULL OR hold_expires_at > NOW()) 
                         LIMIT 1", [$cleanPhone]);
    if ($activeHold) {
        if ($activeHold['payment_status'] === 'deposit_claimed') {
            fail("Số điện thoại $cleanPhone đang có đơn " . $activeHold['code'] . " tại " . $activeHold['court_name'] . " đang chờ chủ sân kiểm tra và xác nhận tiền cọc. Vui lòng chờ chủ sân duyệt hoặc bấm Hủy đơn cũ trước khi đặt thêm.");
        }
        fail("Số điện thoại $cleanPhone đang có một lượt giữ sân chưa thanh toán (Đơn " . $activeHold['code'] . " tại " . $activeHold['court_name'] . "). Vui lòng hoàn tất chuyển khoản hoặc bấm Hủy đơn cũ trước khi đặt thêm.");
    }

    // 8. Chống đặt trùng khung giờ chơi: 1 người không thể chơi ở 2 sân cùng lúc trên cùng 1 ngày
    if ($date && $targetSlots) {
        $existingBookings = q_all("SELECT code, court_name, start_slot, slots 
                                   FROM bookings 
                                   WHERE REPLACE(customer_phone, ' ', '') = ? 
                                     AND booking_date = ? 
                                     AND status IN ('pending', 'confirmed')", [$cleanPhone, $date]);
        foreach ($existingBookings as $eb) {
            $bookedSlots = jd($eb['slots']);
            $overlap = array_values(array_intersect($targetSlots, $bookedSlots));
            if ($overlap) {
                fail("Số điện thoại $cleanPhone đã có đơn {$eb['code']} tại {$eb['court_name']} trong khung giờ " . implode(', ', $overlap) . " cùng ngày. Bạn không thể đặt trùng khung giờ ở nhiều sân.");
            }
        }
    }

    // 9. Giới hạn số đơn tối đa trong cùng 1 ngày chơi (mặc định tối đa 1 đơn/ngày chơi)
    if ($date) {
        $maxPerDate = defined('MAX_BOOKINGS_PER_DATE_PER_PHONE') ? MAX_BOOKINGS_PER_DATE_PER_PHONE : 1;
        $countOnDate = (int) q_val("SELECT COUNT(*) FROM bookings 
                                    WHERE REPLACE(customer_phone, ' ', '') = ? 
                                      AND booking_date = ? 
                                      AND status IN ('pending', 'confirmed')", [$cleanPhone, $date]);
        if ($countOnDate >= $maxPerDate) {
            fail("Số điện thoại $cleanPhone đã có $countOnDate đơn đặt sân vào ngày $date. Để chống giữ sân ảo, mỗi khách chỉ được đặt tối đa $maxPerDate lượt trong cùng một ngày. Vui lòng liên hệ hotline " . HOTLINE . " nếu bạn cần đặt thêm.");
        }
    }

    // 10. Giới hạn số đơn tạo trong vòng 24 giờ qua (mặc định tối đa 2 đơn/ngày)
    $maxPerDay = defined('MAX_BOOKINGS_CREATED_PER_DAY') ? MAX_BOOKINGS_CREATED_PER_DAY : 2;
    $countToday = (int) q_val("SELECT COUNT(*) FROM bookings 
                               WHERE REPLACE(customer_phone, ' ', '') = ? 
                                 AND DATE(created_at) = CURDATE() 
                                 AND status IN ('pending', 'confirmed')", [$cleanPhone]);
    if ($countToday >= $maxPerDay) {
        fail("Số điện thoại $cleanPhone đã tạo tối đa $maxPerDay đơn trong ngày hôm nay. Để đảm bảo công bằng cho người chơi khác, bạn không thể tạo thêm đơn trực tuyến lúc này. Vui lòng gọi hotline " . HOTLINE . " để được hỗ trợ.");
    }

    // 11. Chống spam bùng cọc liên tiếp trong ngày:
    $maxExpired = defined('MAX_EXPIRED_HOLDS_PER_DAY') ? MAX_EXPIRED_HOLDS_PER_DAY : 3;
    $spamMinutes = defined('SPAM_COOLDOWN_MINUTES') ? SPAM_COOLDOWN_MINUTES : 60;
    
    $expiredStat = q_one("SELECT COUNT(*) AS total_expired, MAX(created_at) AS last_created 
                          FROM bookings 
                          WHERE REPLACE(customer_phone, ' ', '') = ? 
                            AND status = 'cancelled' 
                            AND cancel_reason LIKE '%Hết thời gian giữ sân%' 
                            AND DATE(created_at) = CURDATE()", [$cleanPhone]);
    
    if ($expiredStat && (int) $expiredStat['total_expired'] >= $maxExpired) {
        $lastExpiredTs = strtotime($expiredStat['last_created']);
        $diffMinutes = (time() - $lastExpiredTs) / 60;
        if ($diffMinutes < $spamMinutes) {
            $remain = (int) ceil($spamMinutes - $diffMinutes);
            fail("Số điện thoại $cleanPhone đã có {$expiredStat['total_expired']} lượt giữ sân quá hạn không thanh toán trong ngày. Quyền đặt chỗ tạm thời bị khóa trong $remain phút. Vui lòng quay lại sau hoặc gọi hotline " . HOTLINE . ".");
        }
    }
}

/**
 * Khung giờ đã bị chiếm trong một ngày: đơn còn hiệu lực + lượt đang giữ sân chưa hết hạn.
 * Trả về [court_id => [slot, ...]].
 */
function occupied_slots(string $date, string $excludeId = ''): array
{
    auto_cancel_expired_holds();
    $rows = q_all("SELECT id, court_id, slots, source, status, payment_status, hold_expires_at FROM bookings
                   WHERE booking_date = ? AND status IN ('pending','confirmed')", [$date]);
    $map = [];
    foreach ($rows as $r) {
        if ($excludeId && $r['id'] === $excludeId) continue;
        if (is_expired_hold($r)) continue;
        $map[$r['court_id']] = array_values(array_unique(array_merge($map[$r['court_id']] ?? [], jd($r['slots']))));
    }
    return $map;
}

/** Khung giờ chủ sân khóa: ["court_id:date" => [slot,...]] (từ hôm nay trở đi hoặc 1 ngày). */
function blocked_slots_map(?string $date = null, ?array $courtIds = null): array
{
    $sql = 'SELECT court_id, block_date, slot FROM blocked_slots WHERE block_date >= CURDATE() - INTERVAL 1 DAY';
    $params = [];
    if ($date) { $sql = 'SELECT court_id, block_date, slot FROM blocked_slots WHERE block_date = ?'; $params[] = $date; }
    if ($courtIds !== null) {
        if (!$courtIds) return [];
        $sql .= ' AND court_id IN (' . in_list($courtIds) . ')';
        $params = array_merge($params, $courtIds);
    }
    $map = [];
    foreach (q_all($sql, $params) as $r) {
        $map[$r['court_id'] . ':' . $r['block_date']][] = $r['slot'];
    }
    return $map;
}

// ======================= HÓA ĐƠN =======================

function map_invoice(array $b): array
{
    $total = $b['totalPrice'];
    if ($b['source'] === 'online') {
        $deposit = min($b['depositAmount'], $total);
        $isPaid = $b['paymentStatus'] === 'paid';
        $paid = $isPaid ? $total : (in_array($b['paymentStatus'], ['deposit_paid', 'deposit_claimed'], true) ? $deposit : 0);
        $method = $isPaid ? payment_method_label($b['paymentMethod']) : ($paid > 0 ? 'Đã cọc qua ' . payment_method_label($b['paymentMethod']) : 'Chưa thu');
    } else {
        $deposit = 0;
        $isPaid = $b['paymentStatus'] === 'paid';
        $paid = $isPaid ? $total : 0;
        $label = $b['payment'];
        $method = $isPaid ? (trim(preg_replace('/[·-]/u', '', str_replace('Đã thu đủ', '', $label))) ?: 'Tiền mặt') : ($label ?: 'Chưa thu');
    }
    $debt = max(0, $total - $paid);
    return [
        'id' => ($b['source'] === 'online' ? 'ci-' : 'oi-') . $b['id'],
        'code' => 'HD-' . $b['code'],
        'bookingId' => $b['id'],
        'bookingCode' => $b['code'],
        'source' => $b['source'] === 'online' ? 'customer' : 'owner',
        'courtId' => $b['courtId'],
        'courtName' => $b['courtName'],
        'customerName' => $b['customerName'],
        'customerPhone' => $b['customerPhone'],
        'bookingDate' => $b['date'],
        'slots' => $b['slots'],
        'courtFee' => $total,
        'deposit' => $deposit,
        'discount' => $b['discount'],
        'total' => $total,
        'paid' => $paid,
        'debt' => $debt,
        'status' => ($total > 0 && $paid >= $total) ? 'paid' : ($paid > 0 ? 'partial' : 'unpaid'),
        'method' => $method,
        'issuedAt' => $b['createdAt'] ?: $b['date'],
    ];
}

/** Hóa đơn từ các lượt chơi đã hoàn thành. $where/$params lọc thêm trên bảng b. */
function invoices_where(string $where = '1=1', array $params = []): array
{
    auto_complete_bookings();
    $rows = q_all(BOOKING_SELECT . " WHERE b.status IN ('completed','confirmed') AND ($where) ORDER BY b.booking_date DESC, b.code DESC", $params);
    $list = [];
    foreach ($rows as $r) {
        $b = map_booking($r);
        if ($b['status'] === 'completed') $list[] = map_invoice($b);
    }
    return $list;
}

// ======================= KHUYẾN MÃI =======================

function map_promotion(array $r): array
{
    return [
        'id' => $r['id'],
        'ownerId' => $r['owner_id'] !== null ? (int) $r['owner_id'] : null,
        'ownerName' => $r['owner_name'],
        'code' => $r['code'],
        'title' => $r['title'],
        'description' => $r['description'],
        'discountType' => $r['discount_type'],
        'discountValue' => (int) $r['discount_value'],
        'maxDiscount' => $r['max_discount'] !== null ? (int) $r['max_discount'] : null,
        'minOrder' => (int) $r['min_order'],
        'startDate' => $r['start_date'],
        'endDate' => $r['end_date'],
        'weekdays' => array_map('intval', jd($r['weekdays'])),
        'startTime' => $r['start_time'],
        'endTime' => $r['end_time'],
        'usageLimit' => $r['usage_limit'] !== null ? (int) $r['usage_limit'] : null,
        'status' => $r['status'],
        'createdAt' => iso($r['created_at']),
        'updatedAt' => iso($r['updated_at']),
    ];
}

function promo_used_count(string $code): int
{
    return (int) q_val("SELECT COUNT(*) FROM bookings WHERE promo_code = ? AND status <> 'cancelled'", [$code]);
}

/** Tính tiền giảm (làm tròn nghìn) — giống utils/promotions.js. */
function promo_discount(array $p, int $total): int
{
    if ($total <= 0) return 0;
    if ($p['discountType'] === 'percent') {
        $raw = (int) (round($total * $p['discountValue'] / 100 / 1000) * 1000);
        $capped = ($p['maxDiscount'] && $p['maxDiscount'] > 0) ? min($raw, $p['maxDiscount']) : $raw;
        return min($capped, $total);
    }
    return min((int) (round($p['discountValue'] / 1000) * 1000), $total);
}

/** Kiểm tra mã có áp dụng được cho đơn không. Trả về chuỗi lỗi hoặc '' nếu hợp lệ. */
function promo_check(array $p, string $date, string $startSlot, int $total): string
{
    $today = date('Y-m-d');
    $vn = fn($d) => implode('/', array_reverse(explode('-', $d)));
    if ($p['status'] === 'paused') return 'Mã này đang tạm dừng, chưa dùng được.';
    if ($today < $p['startDate']) return 'Mã chưa tới ngày áp dụng (từ ' . $vn($p['startDate']) . ').';
    if ($today > $p['endDate']) return 'Mã đã hết hạn từ ' . $vn($p['endDate']) . '.';
    if ($date < $p['startDate'] || $date > $p['endDate']) return 'Ngày chơi bạn chọn nằm ngoài thời gian áp dụng của mã.';
    $wd = (int) date('N', strtotime($date));
    if ($p['weekdays'] && !in_array($wd, $p['weekdays'], true)) return 'Mã không áp dụng cho ngày này trong tuần.';
    if ($p['startTime'] && $p['endTime']) {
        $m = fn($t) => ((int) substr($t, 0, 2)) * 60 + (int) substr($t, 3, 2);
        if ($m($startSlot) < $m($p['startTime']) || $m($startSlot) >= $m($p['endTime'])) {
            return 'Mã chỉ áp dụng cho khung giờ ' . $p['startTime'] . ' – ' . $p['endTime'] . '.';
        }
    }
    if ($p['minOrder'] > 0 && $total < $p['minOrder']) return 'Mã áp dụng cho đơn từ ' . money($p['minOrder']) . '.';
    if ($p['usageLimit'] && promo_used_count($p['code']) >= $p['usageLimit']) return 'Mã đã hết lượt sử dụng.';
    if (promo_discount($p, $total) <= 0) return 'Mã chưa giảm được giá trị nào cho đơn này.';
    return '';
}

// ======================= ĐÁNH GIÁ =======================

function map_review(array $r): array
{
    $verified = !empty($r['booking_id']);
    $name = $r['customer_name'];
    return [
        'id' => $r['id'],
        'bookingId' => (string) $r['booking_id'],
        'bookingCode' => $verified ? (string) $r['booking_code'] : '',
        'courtId' => $r['court_id'],
        'courtSlug' => $r['court_slug'] ?? '',
        'courtName' => $r['court_name'] ?? '',
        'name' => $name,
        'initials' => initials_of($name),
        'bookingLabel' => $r['booking_label'] ?: ($verified ? 'Lượt chơi đã hoàn thành' : 'Khách ghé sân'),
        'dateLabel' => date('d/m/Y', strtotime($r['created_at'])),
        'rating' => max(1, min(5, (int) $r['rating'])),
        'comment' => trim($r['comment']),
        'tags' => jd($r['tags']),
        'verified' => $verified,
        'createdAt' => iso($r['created_at']),
        'ownerReply' => (string) $r['owner_reply'],
        'ownerRepliedAt' => iso($r['owner_replied_at']),
        'moderationStatus' => $r['moderation_status'],
        'moderationNote' => $r['moderation_note'],
        'moderatedBy' => $r['moderated_by'] ?? '',
    ];
}

const REVIEW_SELECT = 'SELECT r.*, c.slug AS court_slug, c.name AS court_name FROM reviews r JOIN courts c ON c.id = r.court_id';
