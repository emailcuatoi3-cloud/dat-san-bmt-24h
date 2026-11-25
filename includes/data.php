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
    return $r['source'] === 'online' && in_array($r['status'], ['pending', 'confirmed'], true) && $r['payment_status'] === 'unpaid'
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
        case 'refunded': return 'Đã hoàn cọc ' . money($dep ?: $total);
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
        'approvedAt' => iso($r['approved_at'] ?? null),
        'checkedInAt' => iso($r['checked_in_at']),
        'note' => (string) $r['note'],
        'createdAt' => iso($r['created_at']),
    ];
}

/** Câu SELECT đơn kèm slug + địa chỉ sân. */
const BOOKING_SELECT = 'SELECT b.*, c.slug AS court_slug, c.address AS court_address, c.owner_id AS court_owner_id FROM bookings b LEFT JOIN courts c ON c.id = b.court_id';

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

function auto_cancel_expired_holds(): void
{
    q("UPDATE bookings SET status = 'cancelled', cancel_reason = 'Hết thời gian giữ chỗ (5 phút) do chưa thanh toán tiền cọc.'
       WHERE source = 'online' AND status IN ('pending', 'confirmed') AND payment_status = 'unpaid'
         AND hold_expires_at IS NOT NULL AND hold_expires_at <= NOW()");

    // Đồng bộ hủy lịch cố định tương ứng nếu đơn đặt sân giữ chỗ bị hủy
    q("UPDATE recurring_bookings rb
       INNER JOIN bookings b ON rb.note LIKE CONCAT('%Đơn gốc: ', b.code, '%')
       SET rb.status = 'cancelled'
       WHERE b.status = 'cancelled' AND rb.status = 'active'");
}

/**
 * Trích xuất thuộc tính phân loại sân (kích thước, không gian) từ tên sân hoặc ghi chú.
 */
function extract_booking_attributes(?string $courtName, ?string $note = ''): array
{
    $combined = ($courtName ?? '') . ' ' . ($note ?? '');
    $fieldType = '';
    if (str_contains($combined, 'Sân 5 người')) {
        $fieldType = 'Sân 5 người';
    } elseif (str_contains($combined, 'Sân 7 người')) {
        $fieldType = 'Sân 7 người';
    } elseif (str_contains($combined, 'Sân 11 người')) {
        $fieldType = 'Sân 11 người';
    } elseif (str_contains($combined, 'Sân VIP')) {
        $fieldType = 'Sân VIP';
    } elseif (str_contains($combined, 'Sân tập luyện')) {
        $fieldType = 'Sân tập luyện';
    } elseif (str_contains($combined, 'Sân tiêu chuẩn')) {
        $fieldType = 'Sân tiêu chuẩn';
    }

    $spaceType = '';
    if (str_contains($combined, 'Có mái che') || str_contains($combined, 'indoor')) {
        $spaceType = 'indoor';
    } elseif (str_contains($combined, 'Ngoài trời') || str_contains($combined, 'outdoor')) {
        $spaceType = 'outdoor';
    }

    return [
        'fieldType' => $fieldType,
        'spaceType' => $spaceType,
    ];
}

/**
 * Chi tiết khung giờ đã bị chiếm kèm thuộc tính phân loại (fieldType, spaceType).
 * Trả về [court_id => [ ['slot' => '18:00', 'fieldType' => 'Sân 5 người', 'spaceType' => 'outdoor'], ... ]].
 */
function occupied_slots_details(string $date, string $excludeId = ''): array
{
    auto_cancel_expired_holds();
    $rows = q_all("SELECT id, court_id, court_name, slots, source, status, payment_status, hold_expires_at, note FROM bookings
                   WHERE booking_date = ? AND status IN ('pending','confirmed')", [$date]);
    $map = [];
    foreach ($rows as $r) {
        if ($excludeId && $r['id'] === $excludeId) continue;
        if (is_expired_hold($r)) continue;
        $attrs = extract_booking_attributes($r['court_name'] ?? '', $r['note'] ?? '');
        $slots = jd($r['slots']) ?: [];
        foreach ($slots as $s) {
            $map[$r['court_id']][] = [
                'slot' => (string) $s,
                'fieldType' => $attrs['fieldType'],
                'spaceType' => $attrs['spaceType'],
            ];
        }
    }

    // Bổ sung các khung giờ từ Lịch đặt cố định (recurring_bookings) đang có hiệu lực trong chu kỳ
    $isoDay = (int) date('N', strtotime($date)); // 1=Thứ 2 ... 7=Chủ nhật
    $excludeCode = $excludeId ? (string) q_val("SELECT code FROM bookings WHERE id = ?", [$excludeId]) : '';
    $recs = q_all("SELECT id, court_id, court_name, weekdays, start_slot, duration_minutes, note FROM recurring_bookings
                   WHERE status = 'active' AND start_date <= ? AND end_date >= ?", [$date, $date]);
    foreach ($recs as $rec) {
        if ($excludeCode && str_contains((string) ($rec['note'] ?? ''), "Đơn gốc: $excludeCode")) {
            continue;
        }
        $wds = jd($rec['weekdays']) ?: [];
        $matches = false;
        foreach ($wds as $w) {
            if ((int) $w === $isoDay) {
                $matches = true;
                break;
            }
        }
        if ($matches) {
            $duration = (int) ($rec['duration_minutes'] ?: 60);
            $parts = explode(':', $rec['start_slot']);
            $startM = ((int) ($parts[0] ?? 0)) * 60 + ((int) ($parts[1] ?? 0));
            $attrs = extract_booking_attributes($rec['court_name'] ?? '', $rec['note'] ?? '');
            for ($m = $startM; $m < $startM + $duration; $m += 60) {
                $recSlot = sprintf('%02d:%02d', intdiv($m, 60) % 24, $m % 60);
                $map[$rec['court_id']][] = [
                    'slot' => $recSlot,
                    'fieldType' => $attrs['fieldType'],
                    'spaceType' => $attrs['spaceType'],
                ];
            }
        }
    }

    return $map;
}

/**
 * Khung giờ đã bị chiếm trong một ngày: đơn còn hiệu lực + lượt đang giữ sân chưa hết hạn + lịch cố định đang hoạt động.
 * Trả về [court_id => [slot, ...]].
 */
function occupied_slots(string $date, string $excludeId = ''): array
{
    $details = occupied_slots_details($date, $excludeId);
    $map = [];
    foreach ($details as $courtId => $items) {
        $slots = [];
        foreach ($items as $it) {
            $slots[] = $it['slot'];
        }
        $map[$courtId] = array_values(array_unique($slots));
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

/**
 * Các khung giờ đang bận của 1 sân trong 1 ngày (đơn + khóa của chủ sân), có hỗ trợ lọc theo thuộc tính phân loại sân.
 */
function taken_slots(string $courtId, string $date, string $excludeId = '', string $fieldType = '', string $spaceType = ''): array
{
    $details = occupied_slots_details($date, $excludeId)[$courtId] ?? [];
    $occ = [];
    if (!empty($details)) {
        foreach ($details as $item) {
            $matchField = empty($item['fieldType']) || empty($fieldType) || $item['fieldType'] === $fieldType;
            $matchSpace = empty($item['spaceType']) || empty($spaceType) || $item['spaceType'] === $spaceType;
            if ($matchField && $matchSpace) {
                $occ[] = $item['slot'];
            }
        }
        $occ = array_values(array_unique($occ));
    } else {
        $occ = occupied_slots($date, $excludeId)[$courtId] ?? [];
    }

    $blk = blocked_slots_map($date, [$courtId])[$courtId . ':' . $date] ?? [];
    return array_values(array_unique(array_merge($occ, $blk)));
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

/** Hóa đơn từ các lượt chơi đã xác nhận hoặc đã hoàn thành. $where/$params lọc thêm trên bảng b. */
function invoices_where(string $where = '1=1', array $params = []): array
{
    auto_complete_bookings();
    $rows = q_all(BOOKING_SELECT . " WHERE b.status IN ('completed','confirmed') AND ($where) ORDER BY b.booking_date DESC, b.code DESC", $params);
    $list = [];
    foreach ($rows as $r) {
        $b = map_booking($r);
        if (in_array($b['status'], ['completed', 'confirmed'], true)) {
            $list[] = map_invoice($b);
        }
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
        'countdownHours' => isset($r['countdown_hours']) && $r['countdown_hours'] !== null ? (int) $r['countdown_hours'] : 24,
        'savedCount' => isset($r['saved_count']) && $r['saved_count'] !== null ? (int) $r['saved_count'] : null,
        'claimedCount' => isset($r['claimed_count']) && $r['claimed_count'] !== null ? (int) $r['claimed_count'] : null,
        'remainingCount' => isset($r['remaining_count']) && $r['remaining_count'] !== null ? (int) $r['remaining_count'] : null,
        'status' => $r['status'],
        'createdAt' => iso($r['created_at']),
        'updatedAt' => iso($r['updated_at']),
    ];
}

function promo_used_count(string $code): int
{
    return (int) q_val("SELECT COUNT(*) FROM bookings WHERE promo_code = ? AND status <> 'cancelled'", [$code]);
}

/** Đếm tổng số lượng mã đã được người dùng nhận (lưu vào ví) hoặc dùng đặt sân */
function promo_claimed_count(string $code): int
{
    $code = strtoupper(trim($code));
    $saved = (int) q_val("SELECT COUNT(*) FROM user_vouchers WHERE UPPER(code) = ?", [$code]);
    $directBookings = (int) q_val("SELECT COUNT(*) FROM bookings b
                                   WHERE UPPER(b.promo_code) = ?
                                     AND b.status <> 'cancelled'
                                     AND (b.customer_id IS NULL OR b.customer_id NOT IN (
                                         SELECT uv.user_id FROM user_vouchers uv WHERE UPPER(uv.code) = ?
                                     ))", [$code, $code]);
    return $saved + $directBookings;
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


/** Chủ sân/quản trị duyệt đơn online mà khách đã báo chuyển cọc → ghi nhận đã nhận cọc (hoặc đã thu đủ). */
function approve_deposit(array $b, string $status): void
{
    if ($status !== 'confirmed' || $b['source'] !== 'online' || $b['payment_status'] !== 'deposit_claimed') return;
    $full = $b['payment_method'] === 'vietqr-full' || (int) $b['deposit_amount'] >= (int) $b['total_price'];
    q('UPDATE bookings SET payment_status = ? WHERE id = ?', [$full ? 'paid' : 'deposit_paid', $b['id']]);

    $targetUserId = (int) ($b['customer_id'] ?? 0);
    if (!$targetUserId && !empty($b['customer_phone'])) {
        $targetUserId = (int) q_val('SELECT id FROM users WHERE phone = ?', [$b['customer_phone']]);
    }
    if ($targetUserId > 0) {
        $payText = $full ? 'toàn bộ tiền sân' : 'tiền cọc ' . number_format((int) $b['deposit_amount'], 0, ',', '.') . 'đ';
        push_notification($targetUserId, 'Xác nhận thanh toán đơn #' . $b['code'] . ' thành công!', 'Hệ thống đã nhận ' . $payText . ' cho đơn đặt sân tại ' . ($b['court_name'] ?: 'sân thể thao') . '. Lịch đặt của bạn đã chính thức được giữ chỗ!', 'payment', '/tai-khoan?tab=history');
    }
}

// ===================== YÊU CẦU ĐĂNG KÝ CHỦ SÂN =====================
const OWNER_REQUEST_SPORTS = ['football' => 'Bóng đá', 'badminton' => 'Cầu lông', 'both' => 'Bóng đá & cầu lông'];

function map_owner_request(?array $r): ?array
{
    if (!$r) return null;
    $images = !empty($r['images']) ? (is_array($r['images']) ? $r['images'] : jd($r['images'])) : [];
    return [
        'id' => $r['id'], 'userId' => (int) $r['user_id'], 'businessName' => $r['business_name'], 'contactName' => $r['contact_name'],
        'phone' => $r['phone'], 'email' => $r['email'], 'address' => $r['address'], 'sports' => $r['sports'],
        'sportsLabel' => OWNER_REQUEST_SPORTS[$r['sports']] ?? $r['sports'], 'courtCount' => (int) $r['court_count'], 'note' => (string) $r['note'],
        'images' => is_array($images) ? $images : [],
        'status' => $r['status'], 'adminNote' => $r['admin_note'], 'reviewedBy' => $r['reviewed_by'], 'reviewedAt' => iso($r['reviewed_at']),
        'createdAt' => iso($r['created_at']), 'userRole' => $r['user_role'] ?? null, 'userStatus' => $r['user_status'] ?? null,
    ];
}

/** Yêu cầu gần nhất của 1 tài khoản */
function latest_owner_request(int $userId): ?array
{
    return map_owner_request(q_one('SELECT * FROM owner_requests WHERE user_id = ? ORDER BY created_at DESC LIMIT 1', [$userId]));
}

/**
 * Lưu ảnh sân được tải lên (từ $_FILES hoặc chuỗi Base64 / URL) vào /uploads/courts/
 */
function save_court_images(array $files = [], $additionalImages = []): array
{
    $results = [];
    $uploadDir = __DIR__ . '/../uploads/courts';
    if (!is_dir($uploadDir)) {
        @mkdir($uploadDir, 0755, true);
    }

    // 1. Xử lý ảnh dạng file upload qua $_FILES
    if (!empty($files) && isset($files['name'])) {
        $names = is_array($files['name']) ? $files['name'] : [$files['name']];
        $tmpNames = is_array($files['tmp_name']) ? $files['tmp_name'] : [$files['tmp_name']];
        $errors = is_array($files['error']) ? $files['error'] : [$files['error']];
        $sizes = is_array($files['size']) ? $files['size'] : [$files['size']];

        $allowedExts = ['jpg', 'jpeg', 'png', 'webp', 'gif'];
        for ($i = 0; $i < count($names); $i++) {
            if (($errors[$i] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) continue;
            $tmp = $tmpNames[$i] ?? '';
            if (!$tmp || !is_uploaded_file($tmp)) continue;
            if (($sizes[$i] ?? 0) > 8 * 1024 * 1024) continue; // Tối đa 8MB / ảnh

            $ext = strtolower(pathinfo($names[$i] ?? '', PATHINFO_EXTENSION));
            if (!in_array($ext, $allowedExts, true)) $ext = 'jpg';

            $safeName = 'court_' . date('Ymd_His') . '_' . bin2hex(random_bytes(6)) . '.' . $ext;
            $dest = $uploadDir . '/' . $safeName;
            if (move_uploaded_file($tmp, $dest)) {
                $results[] = '/uploads/courts/' . $safeName;
            }
        }
    }

    // 2. Xử lý ảnh bổ sung (chuỗi Base64 hoặc URL)
    $list = is_string($additionalImages) ? json_decode($additionalImages, true) : $additionalImages;
    if (is_array($list)) {
        foreach ($list as $item) {
            $item = trim((string) $item);
            if ($item === '') continue;
            if (preg_match('#^data:image/(png|jpeg|jpg|webp|gif);base64,(.+)$#i', $item, $m)) {
                $ext = strtolower($m[1]) === 'jpeg' ? 'jpg' : strtolower($m[1]);
                $bin = base64_decode($m[2]);
                if ($bin && strlen($bin) <= 8 * 1024 * 1024) {
                    $safeName = 'court_b64_' . date('Ymd_His') . '_' . bin2hex(random_bytes(6)) . '.' . $ext;
                    if (file_put_contents($uploadDir . '/' . $safeName, $bin) !== false) {
                        $results[] = '/uploads/courts/' . $safeName;
                        continue;
                    }
                }
            }
            if (str_starts_with($item, 'http://') || str_starts_with($item, 'https://') || str_starts_with($item, '/uploads/')) {
                $results[] = $item;
            }
        }
    }

    return array_values(array_unique($results));
}

/** Kiểm tra dữ liệu và tạo yêu cầu (trạng thái chờ duyệt) */
function create_owner_request(array $user, array $d): array
{
    $business = trim((string) ($d['businessName'] ?? ''));
    $address = trim((string) ($d['address'] ?? ''));
    $sports = isset(OWNER_REQUEST_SPORTS[$d['sports'] ?? '']) ? $d['sports'] : 'football';
    $count = max(1, min(50, (int) ($d['courtCount'] ?? 1)));
    $phone = preg_replace('/[^\d+]/', '', (string) ($d['phone'] ?? $user['phone']));
    if (mb_strlen($business) < 3) fail('Vui lòng nhập tên sân hoặc cơ sở của bạn.');
    if (mb_strlen($address) < 8) fail('Vui lòng nhập địa chỉ sân đầy đủ (số nhà, đường, phường).');
    if (!preg_match('/^0\d{9,10}$/', $phone) && !preg_match('/^\+84\d{9,10}$/', $phone)) fail('Số điện thoại liên hệ chưa đúng (ví dụ 0912 345 678).');
    if (q_val("SELECT id FROM owner_requests WHERE user_id = ? AND status = 'pending'", [$user['id']])) fail('Bạn đã có một yêu cầu đang chờ duyệt. Vui lòng chờ quản trị viên phản hồi.');

    ensure_sitemap_schema();

    // Thu thập file ảnh từ $_FILES hoặc dữ liệu gửi lên
    $files = $_FILES['images'] ?? ($_FILES['court_images'] ?? []);
    $extraImgs = $d['images'] ?? ($d['court_images'] ?? []);
    $savedImages = save_court_images($files, $extraImgs);

    $id = uid('or-');
    q('INSERT INTO owner_requests (id, user_id, business_name, contact_name, phone, email, address, sports, court_count, note, images) VALUES (?,?,?,?,?,?,?,?,?,?,?)', [
        $id, $user['id'], mb_substr($business, 0, 160), mb_substr(trim((string) ($d['contactName'] ?? $user['full_name'])) ?: $user['full_name'], 0, 120),
        $phone, $user['email'], mb_substr($address, 0, 255), $sports, $count, mb_substr(trim((string) ($d['note'] ?? '')), 0, 1000),
        !empty($savedImages) ? j($savedImages) : null,
    ]);
    return map_owner_request(q_one('SELECT * FROM owner_requests WHERE id = ?', [$id]));
}

// ======================= DỊCH VỤ & BIẾN THỂ (ĐA THUỘC TÍNH) =======================

/** Lấy danh sách dịch vụ kèm biến thể phục vụ đặt sân và quản lý */
function services_with_variants(int $ownerId = 0, string $sport = ''): array
{
    ensure_sitemap_schema();
    $sql = 'SELECT * FROM owner_services WHERE active = 1';
    $params = [];
    if ($ownerId > 0) {
        $sql .= ' AND owner_id = ?';
        $params[] = $ownerId;
    }
    if ($sport !== '' && in_array($sport, ['football', 'badminton'], true)) {
        $sql .= " AND (sport = ? OR sport = 'all')";
        $params[] = $sport;
    }
    $sql .= ' ORDER BY sort_order, name';
    $services = q_all($sql, $params);
    if (!$services && $ownerId > 0) {
        $fbSql = 'SELECT * FROM owner_services WHERE active = 1';
        $fbParams = [];
        if ($sport !== '' && in_array($sport, ['football', 'badminton'], true)) {
            $fbSql .= " AND (sport = ? OR sport = 'all')";
            $fbParams[] = $sport;
        }
        $fbSql .= ' ORDER BY sort_order, name';
        $services = q_all($fbSql, $fbParams);
    }
    $sIds = array_column($services, 'id');
    $variantsMap = [];
    if ($sIds) {
        $vars = q_all('SELECT * FROM service_variants WHERE active = 1 AND service_id IN (' . in_list($sIds) . ') ORDER BY sort_order, id', $sIds);
        foreach ($vars as $v) {
            $variantsMap[$v['service_id']][] = [
                'id' => $v['id'],
                'serviceId' => $v['service_id'],
                'sku' => $v['sku'],
                'name' => $v['name'],
                'attributes' => jd($v['attributes'] ?? '{}'),
                'price' => (int) $v['price'],
                'stock' => (int) $v['stock'],
            ];
        }
    }
    return array_map(function ($s) use ($variantsMap) {
        return [
            'id' => $s['id'],
            'ownerId' => (int) $s['owner_id'],
            'name' => $s['name'],
            'category' => $s['category'],
            'sport' => $s['sport'] ?? 'all',
            'unit' => $s['unit'],
            'price' => (int) $s['price'],
            'stock' => (int) $s['stock'],
            'hasVariants' => (bool) ($s['has_variants'] ?? 0),
            'attributesSchema' => jd($s['attributes_schema'] ?? '[]'),
            'variants' => $variantsMap[$s['id']] ?? [],
        ];
    }, $services);
}
