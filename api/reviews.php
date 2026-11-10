<?php
/**
 * API đánh giá sân: xem đánh giá công khai, gửi đánh giá, chủ sân phản hồi.
 */
require_once __DIR__ . '/../includes/bootstrap.php';

/** Cập nhật điểm trung bình + số lượt đánh giá của sân sau khi có đánh giá mới. */
function refresh_court_rating(string $courtId): void
{
    $row = q_one("SELECT COUNT(*) n, AVG(rating) avg FROM reviews WHERE court_id = ? AND moderation_status <> 'hidden'", [$courtId]);
    if ($row && (int) $row['n'] > 0) {
        // Giữ số lượt đánh giá gốc (dữ liệu cũ) cộng thêm số lượt mới trên hệ thống
        q('UPDATE courts SET rating = ? WHERE id = ?', [round((float) $row['avg'], 1), $courtId]);
    }
}

run_api([
    // Đánh giá công khai của một sân (ẩn các đánh giá bị kiểm duyệt)
    'list' => function () {
        $slug = $_GET['slug'] ?? '';
        $rows = q_all(REVIEW_SELECT . " WHERE c.slug = ? AND r.moderation_status <> 'hidden' ORDER BY r.created_at DESC", [$slug]);
        return array_map('map_review', $rows);
    },

    'submit' => function () {
        $code = strtoupper(in_str('bookingCode'));
        $slug = in_str('courtSlug');
        $rating = in_int('rating');
        $comment = mb_substr(in_str('comment'), 0, 500);
        $name = mb_substr(in_str('customerName'), 0, 60);
        $tags = array_values(array_slice(array_filter(in_arr('tags'), 'is_string'), 0, 4));
        if ($rating < 1 || $rating > 5) fail('Hãy chọn số sao cho lượt chơi này (từ 1 đến 5 sao).');
        if (mb_strlen($comment) < 10) fail('Vui lòng chia sẻ thêm vài dòng cảm nhận (ít nhất 10 ký tự).');
        if (!$code && !$slug) fail('Chưa xác định được sân cần đánh giá. Bạn tải lại trang sân rồi thử lại nhé.');
        $id = uid('rv-');

        if ($code) {
            $b = q_one('SELECT * FROM bookings WHERE code = ?', [$code]);
            if (!$b) fail('Không tìm thấy đơn với mã này. Bạn kiểm tra lại mã in trên vé giúp mình nhé.');
            $slots = jd($b['slots']);
            if ($b['status'] === 'cancelled') fail('Đơn này đã bị hủy nên không thể đánh giá. Bạn đặt lượt chơi mới để chia sẻ cảm nhận nhé.');
            $finished = $b['status'] === 'completed' || ($b['status'] === 'confirmed' && session_ended($b['booking_date'], $slots));
            if (!$finished) fail('Bạn chỉ có thể đánh giá sau khi lượt chơi kết thúc. Hãy quay lại sau giờ chơi nhé.');
            if (q_val('SELECT id FROM reviews WHERE booking_id = ?', [$b['id']])) fail('Đơn này đã được đánh giá rồi. Cảm ơn bạn đã chia sẻ cùng cộng đồng.');
            $label = $slots ? $slots[0] . ' - ' . slot_end(end($slots)) . ' · ' . count($slots) . ' giờ' : 'Lượt chơi đã hoàn thành';
            q('INSERT INTO reviews (id, booking_id, booking_code, court_id, customer_name, booking_label, rating, comment, tags) VALUES (?,?,?,?,?,?,?,?,?)',
                [$id, $b['id'], $b['code'], $b['court_id'], $b['customer_name'] ?: 'Khách chơi', $label, $rating, $comment, j($tags)]);
            refresh_court_rating($b['court_id']);
        } else {
            $court = find_court($slug);
            if (!$court) fail('Chưa tìm thấy sân này để gửi đánh giá. Bạn tải lại trang rồi thử lại nhé.');
            q('INSERT INTO reviews (id, booking_id, booking_code, court_id, customer_name, booking_label, rating, comment, tags) VALUES (?,?,?,?,?,?,?,?,?)',
                [$id, null, 'GUEST', $court['id'], $name ?: 'Khách ghé sân', 'Khách ghé sân', $rating, $comment, j($tags)]);
            refresh_court_rating($court['id']);
        }
        return map_review(q_one(REVIEW_SELECT . ' WHERE r.id = ?', [$id]));
    },

    // Mã đơn (trong danh sách) đã được đánh giá — để ẩn nút đánh giá lần 2
    'reviewed_codes' => function () {
        $codes = array_values(array_filter(in_arr('codes'), 'is_string'));
        if (!$codes) return [];
        return array_column(q_all('SELECT booking_code FROM reviews WHERE booking_id IS NOT NULL AND booking_code IN (' . in_list($codes) . ')', $codes), 'booking_code');
    },
]);
