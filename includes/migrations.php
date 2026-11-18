<?php
/**
 * Tự động bổ sung các bảng và cột mở rộng theo kiến trúc Sitemap (Client, Chủ sân, Admin).
 * Chạy an toàn nhiều lần (idempotent) và chỉ kiểm tra 1 lần mỗi tiến trình hoặc khi bảng chưa tồn tại.
 */

function system_settings_all(): array
{
    static $cache = null;
    if ($cache !== null) return $cache;
    ensure_sitemap_schema();
    $rows = q_all('SELECT skey, svalue FROM system_settings');
    $map = [];
    foreach ($rows as $r) $map[$r['skey']] = $r['svalue'];
    $defaults = [
        'site_name' => SITE_NAME,
        'hotline' => HOTLINE,
        'support_email' => SUPPORT_EMAIL,
        'site_address' => 'TP. Buôn Ma Thuột, Tỉnh Đắk Lắk',
        'bank_id' => BANK_BIN,
        'bank_name' => BANK_NAME,
        'bank_account' => BANK_ACCOUNT,
        'bank_holder' => BANK_ACCOUNT_NAME,
        'deposit_rate' => (string) ((int) round(DEPOSIT_RATE * 100)),
        'hold_minutes' => (string) HOLD_MINUTES,
        'cancel_cutoff_hours' => (string) CANCEL_CUTOFF_HOURS,
        'general_policy' => "Khách hàng hủy sân trước giờ chơi từ 4 giờ trở lên được hoàn 100% tiền cọc.\nTrong vòng 4 giờ trước giờ chơi, nút hủy sẽ khóa — vui lòng gọi hotline để chủ sân hỗ trợ.\nSau khi chủ sân duyệt đơn, khách hàng có 5 phút để chuyển khoản tiền cọc giữ chỗ.",
        'ai_enabled' => '1',
        'ai_bot_name' => 'Trợ lý AI BMT 24H',
        'ai_greeting' => 'Chào bạn, mình là trợ lý AI của Đặt Sân BMT 24H. Bạn cần hỏi về giá sân, khung giờ trống, lịch cố định hay ưu đãi hôm nay?',
        'ai_quick_replies' => j(['Xem giá sân', 'Sân trống tối nay', 'Cách đặt sân', 'Chính sách hủy', 'Vòng quay ưu đãi']),
        'ai_fallback_reply' => 'Mình chưa chắc đã hiểu đúng câu này. Bạn có thể hỏi về giá sân, giờ mở cửa, chính sách hủy, ưu đãi hoặc gọi hotline để gặp nhân viên hỗ trợ nhé.',
        'ai_custom_qa' => j([
            ['keywords' => 'lich co dinh, dat thang, co dinh', 'answer' => 'Bạn có thể đăng ký Lịch cố định theo tuần (ví dụ Thứ 3 – Thứ 5 hằng tuần) ngay trong mục Tài khoản của tôi → Lịch cố định để chủ sân giữ sân dài hạn với giá ưu đãi.'],
            ['keywords' => 'voucher, vi voucher, ma giam', 'answer' => 'Bạn hãy mở trang Ưu đãi để lưu mã giảm giá hoặc tham gia Vòng quay ưu đãi. Mọi mã nhận được sẽ lưu tự động trong Tài khoản → Ví voucher.'],
        ]),
    ];
    $cache = array_merge($defaults, $map);
    return $cache;
}

function system_setting(string $key, string $default = ''): string
{
    $all = system_settings_all();
    return array_key_exists($key, $all) ? (string) $all[$key] : $default;
}

function system_settings_save(array $pairs): void
{
    ensure_sitemap_schema();
    foreach ($pairs as $k => $v) {
        q('INSERT INTO system_settings (skey, svalue) VALUES (?, ?) ON DUPLICATE KEY UPDATE svalue = VALUES(svalue)', [(string) $k, (string) $v]);
    }
}

function push_notification(int $userId, string $title, string $body = '', string $type = 'system', string $link = ''): void
{
    if ($userId <= 0) return;
    ensure_sitemap_schema();
    q('INSERT INTO notifications (id, user_id, title, body, type, link) VALUES (?,?,?,?,?,?)',
        [uid('nt-'), $userId, mb_substr($title, 0, 200), mb_substr($body, 0, 500), in_array($type, ['booking', 'payment', 'promo', 'system'], true) ? $type : 'system', mb_substr($link, 0, 255)]);
}

function ensure_sitemap_schema(): void
{
    static $done = false;
    if ($done) return;
    $done = true;

    $pdo = db();
    // Kiểm tra nhanh nếu bảng mới nhất đã tồn tại thì bỏ qua DDL nặng
    try {
        $check = $pdo->query("SHOW TABLES LIKE 'wheel_spins'")->fetchColumn();
        if ($check) return;
    } catch (Throwable $e) {
        return;
    }

    $ddl = [
        "CREATE TABLE IF NOT EXISTS recurring_bookings (
            id VARCHAR(40) PRIMARY KEY,
            court_id VARCHAR(40) NOT NULL,
            court_name VARCHAR(160) NOT NULL,
            owner_id INT NULL,
            customer_id INT NULL,
            customer_name VARCHAR(120) NOT NULL,
            customer_phone VARCHAR(30) NOT NULL DEFAULT '',
            weekdays TEXT NOT NULL COMMENT 'JSON: 1=T2..7=CN',
            start_slot VARCHAR(5) NOT NULL,
            duration_minutes INT NOT NULL DEFAULT 60,
            start_date DATE NOT NULL,
            end_date DATE NOT NULL,
            price_per_session INT NOT NULL DEFAULT 0,
            status ENUM('active','paused','cancelled') NOT NULL DEFAULT 'active',
            note VARCHAR(500) NOT NULL DEFAULT '',
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            KEY idx_rec_owner (owner_id),
            KEY idx_rec_customer (customer_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",

        "CREATE TABLE IF NOT EXISTS user_vouchers (
            id VARCHAR(40) PRIMARY KEY,
            user_id INT NOT NULL,
            code VARCHAR(40) NOT NULL,
            title VARCHAR(160) NOT NULL,
            description VARCHAR(300) NOT NULL DEFAULT '',
            discount_type ENUM('percent','amount','gift') NOT NULL DEFAULT 'percent',
            discount_value INT NOT NULL DEFAULT 0,
            min_order INT NOT NULL DEFAULT 0,
            source ENUM('promo','wheel','system') NOT NULL DEFAULT 'promo',
            status ENUM('available','used','expired') NOT NULL DEFAULT 'available',
            expires_at DATE NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            KEY idx_uv_user (user_id),
            UNIQUE KEY uq_uv_user_code (user_id, code)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",

        "CREATE TABLE IF NOT EXISTS wheel_spins (
            id VARCHAR(40) PRIMARY KEY,
            user_id INT NOT NULL,
            prize_code VARCHAR(40) NOT NULL,
            prize_title VARCHAR(160) NOT NULL,
            prize_desc VARCHAR(300) NOT NULL DEFAULT '',
            spun_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            KEY idx_ws_user_time (user_id, spun_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",

        "CREATE TABLE IF NOT EXISTS notifications (
            id VARCHAR(40) PRIMARY KEY,
            user_id INT NOT NULL,
            title VARCHAR(200) NOT NULL,
            body VARCHAR(500) NOT NULL DEFAULT '',
            type ENUM('booking','payment','promo','system') NOT NULL DEFAULT 'system',
            link VARCHAR(255) NOT NULL DEFAULT '',
            is_read TINYINT(1) NOT NULL DEFAULT 0,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            KEY idx_nt_user (user_id, is_read)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",

        "CREATE TABLE IF NOT EXISTS inventory_logs (
            id VARCHAR(40) PRIMARY KEY,
            owner_id INT NOT NULL,
            service_id VARCHAR(40) NOT NULL,
            service_name VARCHAR(160) NOT NULL,
            type ENUM('import','export','adjust') NOT NULL DEFAULT 'import',
            quantity INT NOT NULL DEFAULT 0,
            unit_cost INT NOT NULL DEFAULT 0,
            note VARCHAR(255) NOT NULL DEFAULT '',
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            KEY idx_inv_owner (owner_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",

        "CREATE TABLE IF NOT EXISTS owner_staff (
            id VARCHAR(40) PRIMARY KEY,
            owner_id INT NOT NULL,
            full_name VARCHAR(120) NOT NULL,
            phone VARCHAR(30) NOT NULL DEFAULT '',
            email VARCHAR(190) NOT NULL DEFAULT '',
            role_name VARCHAR(80) NOT NULL DEFAULT 'Nhân viên lễ tân',
            permissions TEXT NULL COMMENT 'JSON',
            status ENUM('active','inactive') NOT NULL DEFAULT 'active',
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            KEY idx_staff_owner (owner_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",

        "CREATE TABLE IF NOT EXISTS owner_settings (
            owner_id INT PRIMARY KEY,
            deposit_rate INT NOT NULL DEFAULT 30,
            cancel_cutoff_hours INT NOT NULL DEFAULT 4,
            hold_minutes INT NOT NULL DEFAULT 5,
            auto_approve TINYINT(1) NOT NULL DEFAULT 0,
            policy_note TEXT NULL,
            notify_new_booking TINYINT(1) NOT NULL DEFAULT 1,
            notify_cancel TINYINT(1) NOT NULL DEFAULT 1,
            notify_review TINYINT(1) NOT NULL DEFAULT 1,
            bank_name VARCHAR(120) NOT NULL DEFAULT '',
            bank_account VARCHAR(60) NOT NULL DEFAULT '',
            bank_holder VARCHAR(120) NOT NULL DEFAULT '',
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",

        "CREATE TABLE IF NOT EXISTS payouts (
            id VARCHAR(40) PRIMARY KEY,
            owner_id INT NOT NULL,
            owner_name VARCHAR(160) NOT NULL,
            period_label VARCHAR(80) NOT NULL,
            gross_amount INT NOT NULL DEFAULT 0,
            commission_rate INT NOT NULL DEFAULT 5,
            commission_amount INT NOT NULL DEFAULT 0,
            net_amount INT NOT NULL DEFAULT 0,
            status ENUM('pending','transferred') NOT NULL DEFAULT 'pending',
            note VARCHAR(255) NOT NULL DEFAULT '',
            transferred_at DATETIME NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            KEY idx_payout_owner (owner_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",

        "CREATE TABLE IF NOT EXISTS system_settings (
            skey VARCHAR(80) PRIMARY KEY,
            svalue TEXT NULL,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",
    ];

    foreach ($ddl as $sql) {
        $pdo->exec($sql);
    }

    // Mở rộng ENUM cho categories.kind (thêm 'amenity') và courts.status (thêm 'pending')
    try {
        $pdo->exec("ALTER TABLE categories MODIFY COLUMN kind ENUM('sport','area','amenity') NOT NULL DEFAULT 'sport'");
    } catch (Throwable $e) {}
    try {
        $pdo->exec("ALTER TABLE courts MODIFY COLUMN status ENUM('active','pending','maintenance','paused') NOT NULL DEFAULT 'active'");
    } catch (Throwable $e) {}
    try {
        $pdo->exec("ALTER TABLE bookings MODIFY COLUMN payment_status ENUM('unpaid','deposit_claimed','deposit_paid','paid','refunded') NOT NULL DEFAULT 'unpaid'");
    } catch (Throwable $e) {}
    try {
        $hasApproved = $pdo->query("SHOW COLUMNS FROM bookings LIKE 'approved_at'")->fetchColumn();
        if (!$hasApproved) {
            $pdo->exec("ALTER TABLE bookings ADD COLUMN approved_at DATETIME NULL AFTER status");
        }
    } catch (Throwable $e) {}

    // Dữ liệu mẫu ban đầu (chỉ chèn nếu chưa có)
    seed_sitemap_defaults();
}

function seed_sitemap_defaults(): void
{
    // 1. Tiện ích mẫu trong bảng categories
    if ((int) q_val("SELECT COUNT(*) FROM categories WHERE kind = 'amenity'") === 0) {
        $amenities = [
            ['cat-am-1', 'Bãi giữ xe miễn phí', 'bai-giu-xe', 'Khu vực để xe máy và ô tô có bảo vệ', 'ri-parking-box-line', 1],
            ['cat-am-2', 'Đèn LED chiếu sáng', 'den-led', 'Hệ thống chiếu sáng tiêu chuẩn thi đấu buổi tối', 'ri-lightbulb-flash-line', 2],
            ['cat-am-3', 'Phòng thay đồ & tắm', 'phong-thay-do', 'Khu vệ sinh, thay đồ sạch sẽ riêng biệt', 'ri-t-shirt-line', 3],
            ['cat-am-4', 'Căng tin nước uống', 'cang-tin', 'Phục vụ nước suối, nước tăng lực, khăn lạnh', 'ri-cup-line', 4],
            ['cat-am-5', 'Wifi miễn phí', 'wifi-mien-phi', 'Phủ sóng wifi tốc độ cao tại khu chờ', 'ri-wifi-line', 5],
            ['cat-am-6', 'Cho thuê bóng / vợt', 'cho-thue-dung-cu', 'Hỗ trợ thuê bóng thi đấu, áo bib, vợt cầu lông', 'ri-ping-pong-line', 6],
        ];
        foreach ($amenities as $a) {
            q("INSERT IGNORE INTO categories (id, kind, name, slug, description, icon, sort_order, active) VALUES (?,'amenity',?,?,?,?,?,1)", $a);
        }
    }

    // 2. Lịch cố định mẫu
    if ((int) q_val('SELECT COUNT(*) FROM recurring_bookings') === 0) {
        $start = date('Y-m-d');
        $end = date('Y-m-d', strtotime('+60 days'));
        q('INSERT INTO recurring_bookings (id, court_id, court_name, owner_id, customer_id, customer_name, customer_phone, weekdays, start_slot, duration_minutes, start_date, end_date, price_per_session, status, note) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
            ['rec-01', 'c01', 'Sân bóng BMT Arena', 2, 3, 'Nguyễn Minh Quân', '0912 345 678', '[2,5]', '18:00', 120, $start, $end, 440000, 'active', 'Đội FC Ea Tam đá cố định tối Thứ 3 & Thứ 6 hằng tuần.']);
        q('INSERT INTO recurring_bookings (id, court_id, court_name, owner_id, customer_id, customer_name, customer_phone, weekdays, start_slot, duration_minutes, start_date, end_date, price_per_session, status, note) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
            ['rec-02', 'c10', 'Cầu lông Victory BMT', 2, 3, 'Nguyễn Minh Quân', '0912 345 678', '[3,6]', '19:00', 60, $start, $end, 130000, 'active', 'Nhóm cầu lông Phố Núi đánh tối Thứ 4 & Thứ 7.']);
    }

    // 3. Ví voucher mẫu cho khách hàng (user_id = 3)
    if ((int) q_val('SELECT COUNT(*) FROM user_vouchers') === 0) {
        $exp = date('Y-m-d', strtotime('+30 days'));
        q("INSERT IGNORE INTO user_vouchers (id, user_id, code, title, description, discount_type, discount_value, min_order, source, status, expires_at) VALUES
            ('uv-01', 3, 'BMT10', 'Giảm 10% khung giờ sáng – chiều', 'Áp dụng cho đơn đặt sân từ 150.000đ trên toàn hệ thống.', 'percent', 10, 150000, 'promo', 'available', ?),
            ('uv-02', 3, 'VONGQUAY20K', 'Voucher 20.000đ từ Vòng quay ưu đãi', 'Quà tặng thành viên Đặt Sân BMT 24H, dùng cho mọi sân.', 'amount', 20000, 100000, 'wheel', 'available', ?)", [$exp, $exp]);
    }

    // 4. Thông báo mẫu
    if ((int) q_val('SELECT COUNT(*) FROM notifications') === 0) {
        q("INSERT INTO notifications (id, user_id, title, body, type, link, is_read) VALUES
            ('nt-01', 3, 'Chào mừng bạn đến với Đặt Sân BMT 24H!', 'Bạn đang có 2 voucher ưu đãi trong Ví voucher. Đặt sân ngay để áp dụng nhé.', 'promo', '/tai-khoan?tab=vouchers', 0),
            ('nt-02', 3, 'Lịch cố định đang hoạt động', 'Lịch cố định Sân bóng BMT Arena (Thứ 3 & Thứ 6, 18:00) đã được chủ sân xác nhận.', 'booking', '/tai-khoan?tab=recurring', 0),
            ('nt-03', 2, 'Có đơn đặt sân mới cần duyệt', 'Kiểm tra danh sách đơn đặt sân hôm nay để xác nhận lịch sớm cho khách.', 'booking', '/chu-san?tab=bookings', 0)");
    }

    // 5. Cài đặt & Nhân viên chủ sân mẫu (owner_id = 2)
    if ((int) q_val('SELECT COUNT(*) FROM owner_settings') === 0) {
        q("INSERT IGNORE INTO owner_settings (owner_id, deposit_rate, cancel_cutoff_hours, hold_minutes, auto_approve, policy_note, bank_name, bank_account, bank_holder) VALUES
            (2, 30, 4, 5, 0, 'Khách đến trước 10 phút để nhận sân. Hủy trước 4 giờ hoàn 100% cọc.', 'Vietcombank', '0231000688999', 'TRAN QUOC HUNG')");
    }
    if ((int) q_val('SELECT COUNT(*) FROM owner_staff') === 0) {
        q("INSERT INTO owner_staff (id, owner_id, full_name, phone, email, role_name, permissions, status) VALUES
            ('st-01', 2, 'Nguyễn Văn Tài', '0935 111 222', 'tai.nv@hungsport.vn', 'Quản lý ca tối', '[\"bookings\",\"services\",\"payments\"]', 'active'),
            ('st-02', 2, 'Lê Thị Ngọc', '0935 333 444', 'ngoc.lt@hungsport.vn', 'Lễ tân & thu ngân', '[\"bookings\",\"services\"]', 'active')");
    }

    // 6. Nhật ký nhập kho mẫu
    if ((int) q_val('SELECT COUNT(*) FROM inventory_logs') === 0) {
        $svc = q_one('SELECT id, name FROM owner_services WHERE owner_id = 2 LIMIT 1');
        if ($svc) {
            q("INSERT INTO inventory_logs (id, owner_id, service_id, service_name, type, quantity, unit_cost, note) VALUES
                ('inv-01', 2, ?, ?, 'import', 48, 6000, 'Nhập kho đầu tuần từ đại lý BMT')", [$svc['id'], $svc['name']]);
        }
    }

    // 7. Đối soát chuyển tiền mẫu cho Admin
    if ((int) q_val('SELECT COUNT(*) FROM payouts') === 0) {
        $period = 'Tháng ' . date('m/Y');
        q("INSERT INTO payouts (id, owner_id, owner_name, period_label, gross_amount, commission_rate, commission_amount, net_amount, status, note) VALUES
            ('po-01', 2, 'Hưng Sport BMT', ?, 4850000, 5, 242500, 4607500, 'pending', 'Đối soát doanh thu đặt sân online kỳ hiện tại'),
            ('po-02', 5, 'Lộc Sport', ?, 2100000, 5, 105000, 1995000, 'transferred', 'Đã chuyển khoản đợt 1 qua VietQR')", [$period, $period]);
    }
}
