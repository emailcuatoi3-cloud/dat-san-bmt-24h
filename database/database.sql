-- =============================================================
-- ĐẶT SÂN BMT 24H — CSDL MySQL / MariaDB
-- Import file này bằng phpMyAdmin hoặc:  mysql -u root -p < database.sql
-- Tài khoản mẫu (mật khẩu đều là 123456):
--   admin@bmt24h.vn      Quản trị viên (super_admin)
--   kiemduyet@bmt24h.vn  Quản trị viên (vai trò Kiểm duyệt viên)
--   chusan@bmt24h.vn     Chủ sân (Hưng Sport BMT)
--   khach@bmt24h.vn      Khách hàng
-- =============================================================
SET NAMES utf8mb4;
SET time_zone = '+07:00';
CREATE DATABASE IF NOT EXISTS `datsan_bmt24h` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `datsan_bmt24h`;

SET FOREIGN_KEY_CHECKS = 0;
DROP TABLE IF EXISTS contact_messages, refunds, owner_services, audit_logs, reports, contents, categories,
  promotions, reviews, blocked_slots, bookings, courts, admin_role_assignments, admin_roles, users;
SET FOREIGN_KEY_CHECKS = 1;

CREATE TABLE users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(190) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  full_name VARCHAR(120) NOT NULL DEFAULT '',
  phone VARCHAR(30) NOT NULL DEFAULT '',
  address VARCHAR(255) NOT NULL DEFAULT '',
  role ENUM('customer','owner','admin') NOT NULL DEFAULT 'customer',
  business_name VARCHAR(160) NOT NULL DEFAULT '',
  status ENUM('active','suspended') NOT NULL DEFAULT 'active',
  favorites TEXT NULL COMMENT 'JSON: danh sách slug sân yêu thích',
  reset_token VARCHAR(64) NULL,
  reset_expires DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE admin_roles (
  `key` VARCHAR(40) PRIMARY KEY,
  name VARCHAR(80) NOT NULL,
  description VARCHAR(255) NOT NULL DEFAULT '',
  permissions TEXT NULL COMMENT 'JSON: các module được phép',
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE admin_role_assignments (
  user_id INT PRIMARY KEY,
  role_key VARCHAR(40) NOT NULL,
  assigned_by VARCHAR(160) NOT NULL DEFAULT '',
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE courts (
  id VARCHAR(40) PRIMARY KEY,
  slug VARCHAR(160) NOT NULL UNIQUE,
  owner_id INT NULL,
  name VARCHAR(160) NOT NULL,
  sport ENUM('football','badminton') NOT NULL DEFAULT 'football',
  sport_label VARCHAR(60) NOT NULL DEFAULT '',
  area VARCHAR(80) NOT NULL DEFAULT '',
  address VARCHAR(255) NOT NULL DEFAULT '',
  price_per_hour INT NOT NULL DEFAULT 0,
  peak_price INT NOT NULL DEFAULT 0,
  price_note VARCHAR(255) NOT NULL DEFAULT '',
  price_bands TEXT NULL COMMENT 'JSON: khung giá theo giờ',
  field_price_step INT NULL,
  operating_note VARCHAR(255) NOT NULL DEFAULT '',
  rating DECIMAL(3,1) NOT NULL DEFAULT 0,
  review_count INT NOT NULL DEFAULT 0,
  monthly_bookings INT NOT NULL DEFAULT 0,
  description TEXT NULL,
  highlights TEXT NULL COMMENT 'JSON',
  facilities TEXT NULL COMMENT 'JSON',
  images TEXT NULL COMMENT 'JSON: danh sách URL ảnh',
  open_time VARCHAR(5) NOT NULL DEFAULT '05:00',
  close_time VARCHAR(5) NOT NULL DEFAULT '23:00',
  weekly_hours TEXT NULL COMMENT 'JSON: giờ mở cửa riêng từng thứ',
  field_types TEXT NULL COMMENT 'JSON',
  featured TINYINT(1) NOT NULL DEFAULT 0,
  status ENUM('active','maintenance','paused') NOT NULL DEFAULT 'active',
  map_query VARCHAR(255) NOT NULL DEFAULT '',
  note TEXT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  deleted_at DATETIME NULL COMMENT 'Khác NULL = đang ở thùng rác',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_owner (owner_id),
  FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE bookings (
  id VARCHAR(40) PRIMARY KEY,
  code VARCHAR(40) NOT NULL UNIQUE,
  source ENUM('online','owner') NOT NULL DEFAULT 'online' COMMENT 'online = khách đặt trên web; owner = chủ sân nhập',
  court_id VARCHAR(40) NOT NULL,
  court_name VARCHAR(160) NOT NULL,
  sport VARCHAR(20) NOT NULL DEFAULT 'football',
  area VARCHAR(80) NOT NULL DEFAULT '',
  image VARCHAR(600) NOT NULL DEFAULT '',
  customer_id INT NULL,
  customer_name VARCHAR(120) NOT NULL,
  customer_phone VARCHAR(30) NOT NULL DEFAULT '',
  customer_email VARCHAR(190) NULL,
  booking_date DATE NOT NULL,
  start_slot VARCHAR(5) NOT NULL,
  duration_minutes INT NOT NULL DEFAULT 60,
  slots TEXT NOT NULL COMMENT 'JSON: các khung giờ',
  unit_price INT NOT NULL DEFAULT 0,
  base_total INT NOT NULL DEFAULT 0 COMMENT 'Tổng trước giảm giá',
  discount_amount INT NOT NULL DEFAULT 0,
  promo_code VARCHAR(20) NULL,
  total_price INT NOT NULL DEFAULT 0,
  deposit_amount INT NOT NULL DEFAULT 0,
  extras TEXT NULL COMMENT 'JSON: dịch vụ thêm',
  payment_method VARCHAR(20) NOT NULL DEFAULT 'vietqr',
  payment_status ENUM('unpaid','deposit_claimed','deposit_paid','paid') NOT NULL DEFAULT 'unpaid',
  payment_label VARCHAR(160) NULL COMMENT 'Ghi chú thanh toán của đơn chủ sân nhập',
  status ENUM('pending','confirmed','cancelled','completed') NOT NULL DEFAULT 'pending',
  reject_reason VARCHAR(255) NULL,
  cancel_reason VARCHAR(255) NULL,
  hold_expires_at DATETIME NULL,
  checked_in_at DATETIME NULL,
  note TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_court_date (court_id, booking_date),
  KEY idx_customer (customer_id),
  KEY idx_phone (customer_phone)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE blocked_slots (
  id INT AUTO_INCREMENT PRIMARY KEY,
  court_id VARCHAR(40) NOT NULL,
  block_date DATE NOT NULL,
  slot VARCHAR(5) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_slot (court_id, block_date, slot),
  FOREIGN KEY (court_id) REFERENCES courts(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE reviews (
  id VARCHAR(40) PRIMARY KEY,
  booking_id VARCHAR(40) NULL UNIQUE COMMENT 'NULL = đánh giá công khai không gắn đơn',
  booking_code VARCHAR(40) NULL,
  court_id VARCHAR(40) NOT NULL,
  customer_name VARCHAR(120) NOT NULL,
  booking_label VARCHAR(120) NOT NULL DEFAULT '',
  rating TINYINT NOT NULL,
  comment TEXT NOT NULL,
  tags TEXT NULL COMMENT 'JSON',
  owner_reply TEXT NULL,
  owner_replied_at DATETIME NULL,
  moderation_status ENUM('approved','pending','hidden') NOT NULL DEFAULT 'approved',
  moderation_note VARCHAR(255) NOT NULL DEFAULT '',
  moderated_by VARCHAR(160) NOT NULL DEFAULT '',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_court (court_id),
  FOREIGN KEY (court_id) REFERENCES courts(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE promotions (
  id VARCHAR(40) PRIMARY KEY,
  owner_id INT NULL,
  owner_name VARCHAR(160) NOT NULL DEFAULT '',
  code VARCHAR(20) NOT NULL UNIQUE,
  title VARCHAR(160) NOT NULL,
  description VARCHAR(500) NOT NULL DEFAULT '',
  discount_type ENUM('percent','amount') NOT NULL DEFAULT 'percent',
  discount_value INT NOT NULL DEFAULT 0,
  max_discount INT NULL,
  min_order INT NOT NULL DEFAULT 0,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  weekdays TEXT NULL COMMENT 'JSON: 1=Thứ Hai … 7=Chủ Nhật',
  start_time VARCHAR(5) NOT NULL DEFAULT '',
  end_time VARCHAR(5) NOT NULL DEFAULT '',
  usage_limit INT NULL,
  status ENUM('active','paused') NOT NULL DEFAULT 'active',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE categories (
  id VARCHAR(40) PRIMARY KEY,
  kind ENUM('sport','area') NOT NULL DEFAULT 'sport',
  name VARCHAR(120) NOT NULL,
  slug VARCHAR(120) NOT NULL,
  description VARCHAR(255) NOT NULL DEFAULT '',
  icon VARCHAR(60) NOT NULL DEFAULT 'ri-price-tag-3-line',
  sort_order INT NOT NULL DEFAULT 0,
  active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE contents (
  id VARCHAR(40) PRIMARY KEY,
  kind ENUM('banner','news','faq','policy') NOT NULL DEFAULT 'news',
  title VARCHAR(200) NOT NULL,
  slug VARCHAR(200) NOT NULL DEFAULT '',
  summary VARCHAR(500) NOT NULL DEFAULT '',
  body TEXT NULL,
  image VARCHAR(600) NOT NULL DEFAULT '',
  link_url VARCHAR(255) NOT NULL DEFAULT '',
  status ENUM('draft','published','archived') NOT NULL DEFAULT 'published',
  pinned TINYINT(1) NOT NULL DEFAULT 0,
  sort_order INT NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE reports (
  id VARCHAR(40) PRIMARY KEY,
  target_type ENUM('review','court','account','booking') NOT NULL DEFAULT 'review',
  target_id VARCHAR(60) NOT NULL DEFAULT '',
  target_label VARCHAR(200) NOT NULL DEFAULT '',
  reporter_name VARCHAR(120) NOT NULL DEFAULT '',
  reporter_contact VARCHAR(160) NOT NULL DEFAULT '',
  reason VARCHAR(255) NOT NULL,
  detail TEXT NULL,
  severity ENUM('low','medium','high') NOT NULL DEFAULT 'medium',
  status ENUM('open','reviewing','resolved','rejected') NOT NULL DEFAULT 'open',
  resolution_note VARCHAR(500) NOT NULL DEFAULT '',
  resolved_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE audit_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  actor_id INT NULL,
  actor_name VARCHAR(160) NOT NULL DEFAULT '',
  actor_role VARCHAR(40) NOT NULL DEFAULT '',
  module VARCHAR(40) NOT NULL,
  action VARCHAR(160) NOT NULL,
  target_label VARCHAR(200) NOT NULL DEFAULT '',
  detail VARCHAR(500) NOT NULL DEFAULT '',
  level ENUM('info','success','warning','danger') NOT NULL DEFAULT 'info',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE owner_services (
  id VARCHAR(40) PRIMARY KEY,
  owner_id INT NOT NULL,
  name VARCHAR(160) NOT NULL,
  category ENUM('drink','rental','food','other') NOT NULL DEFAULT 'drink',
  unit VARCHAR(30) NOT NULL DEFAULT 'cái',
  price INT NOT NULL DEFAULT 0,
  stock INT NOT NULL DEFAULT 0,
  active TINYINT(1) NOT NULL DEFAULT 1,
  sort_order INT NOT NULL DEFAULT 0,
  FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE refunds (
  id VARCHAR(40) PRIMARY KEY,
  owner_id INT NOT NULL,
  booking_code VARCHAR(40) NOT NULL,
  customer_name VARCHAR(120) NOT NULL DEFAULT '',
  court_name VARCHAR(160) NOT NULL DEFAULT '',
  amount INT NOT NULL DEFAULT 0,
  method ENUM('cash','transfer','vietqr') NOT NULL DEFAULT 'cash',
  note VARCHAR(255) NOT NULL DEFAULT '',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE contact_messages (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  phone VARCHAR(30) NOT NULL DEFAULT '',
  email VARCHAR(190) NOT NULL DEFAULT '',
  topic VARCHAR(120) NOT NULL DEFAULT '',
  message TEXT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ===================== DỮ LIỆU MẪU =====================

INSERT INTO `users` (`id`, `email`, `password_hash`, `full_name`, `phone`, `address`, `role`, `business_name`, `status`, `favorites`, `created_at`) VALUES
  (1, 'admin@bmt24h.vn', '$2y$10$a3MJzgR2ejrgmG2riBVNnuGQXDBMHKxEXoMGOguS2wgJHSnqjU3kW', 'Quản trị viên BMT', '0262 399 8888', 'TP. Buôn Ma Thuột', 'admin', '', 'active', '[]', '2025-01-01 08:00:00'),
  (2, 'chusan@bmt24h.vn', '$2y$10$a3MJzgR2ejrgmG2riBVNnuGQXDBMHKxEXoMGOguS2wgJHSnqjU3kW', 'Trần Quốc Hưng', '0935 771 246', '58 Nguyễn Tất Thành, P. Tân An, TP. Buôn Ma Thuột', 'owner', 'Hưng Sport BMT', 'active', '[]', '2025-01-12 09:00:00'),
  (3, 'khach@bmt24h.vn', '$2y$10$a3MJzgR2ejrgmG2riBVNnuGQXDBMHKxEXoMGOguS2wgJHSnqjU3kW', 'Nguyễn Minh Quân', '0912 345 678', '45 Lê Duẩn, P. Tân Lợi, TP. Buôn Ma Thuột', 'customer', '', 'active', '["san-bong-bmt-arena", "cau-long-victory-bmt"]', '2025-03-18 10:00:00'),
  (4, 'kiemduyet@bmt24h.vn', '$2y$10$a3MJzgR2ejrgmG2riBVNnuGQXDBMHKxEXoMGOguS2wgJHSnqjU3kW', 'Lê Thu Hà', '0905 112 233', 'TP. Buôn Ma Thuột', 'admin', '', 'active', '[]', '2025-06-02 10:00:00'),
  (5, 'chusan2@bmt24h.vn', '$2y$10$a3MJzgR2ejrgmG2riBVNnuGQXDBMHKxEXoMGOguS2wgJHSnqjU3kW', 'Phạm Văn Lộc', '0918 556 778', 'P. Tân An, TP. Buôn Ma Thuột', 'owner', 'Lộc Sport', 'active', '[]', '2025-04-20 10:00:00');

INSERT INTO `admin_roles` (`key`, `name`, `description`, `permissions`) VALUES
  ('super_admin', 'Quản trị cấp cao', 'Toàn quyền trên mọi module.', '["overview", "accounts", "courts", "bookings", "invoices", "categories", "content", "moderation", "promotions", "audit"]'),
  ('moderator', 'Kiểm duyệt viên', 'Kiểm duyệt đánh giá, xử lý báo cáo và đơn đặt sân.', '["overview", "bookings", "moderation", "audit"]'),
  ('content_editor', 'Biên tập nội dung', 'Quản lý banner, tin tức, FAQ, danh mục và khuyến mãi.', '["overview", "categories", "content", "promotions"]'),
  ('support', 'Hỗ trợ khách hàng', 'Tra cứu tài khoản, đơn đặt sân và hóa đơn.', '["overview", "accounts", "bookings", "invoices"]');

INSERT INTO `admin_role_assignments` (`user_id`, `role_key`, `assigned_by`) VALUES
  (1, 'super_admin', 'Hệ thống'),
  (4, 'moderator', 'Quản trị viên BMT');

INSERT INTO `courts` (`id`, `slug`, `owner_id`, `name`, `sport`, `sport_label`, `area`, `address`, `price_per_hour`, `peak_price`, `price_note`, `price_bands`, `field_price_step`, `operating_note`, `rating`, `review_count`, `monthly_bookings`, `description`, `highlights`, `facilities`, `images`, `open_time`, `close_time`, `field_types`, `featured`, `status`, `map_query`, `note`, `sort_order`) VALUES
  ('c01', 'san-bong-bmt-arena', 2, 'Sân bóng BMT Arena', 'football', 'Sân bóng đá', 'Tân Lợi', '23 Lê Duẩn, P. Tân Lợi, TP. Buôn Ma Thuột', 180000, 240000, 'Sân 5: 180.000đ • Sân 7: 320.000đ', '[{"id": "morning", "label": "Buổi sáng và chiều", "shortLabel": "Sáng – chiều", "start": "05:00", "end": "16:00", "price": 180000}, {"id": "evening", "label": "Buổi tối", "shortLabel": "Tối", "start": "16:00", "end": "23:00", "price": 240000, "peak": true}]', 140000, 'Mở cửa tất cả các ngày trong tuần, kể cả ngày lễ', 4.8, 126, 214, 'Cụm sân cỏ nhân tạo BMT Arena gồm 3 sân 5 người và 1 sân 7 người, mặt cỏ mới thay năm 2025, hệ thống đèn LED 4 trụ cho ánh sáng đều khắp sân. Sân nằm ngay trung tâm thành phố, thuận tiện cho các đội bóng phong trào sau giờ làm.', '["Cỏ nhân tạo mới thay 2025", "Đèn LED 4 trụ sáng đều", "Có sân 5 và sân 7 người"]', '["Bãi giữ xe miễn phí", "Phòng thay đồ", "Wifi miễn phí", "Căng tin nước uống", "Ghế khán giả", "Lưới & bóng miễn phí"]', '["https://readdy.ai/api/search-image?query=Modern%20artificial%20grass%20five%20a%20side%20football%20pitch%20under%20bright%20floodlights%20at%20night%2C%20vivid%20green%20turf%2C%20white%20line%20markings%2C%20green%20net%20fence%2C%20clean%20sports%20photography%2C%20no%20people&width=1000&height=700&seq=bmt-court-fb-01a&orientation=landscape", "https://readdy.ai/api/search-image?query=Side%20angle%20of%20an%20empty%20artificial%20turf%20football%20field%20at%20dusk%20with%20tall%20light%20poles%2C%20white%20goal%20frame%2C%20tidy%20green%20grass%2C%20calm%20evening%20sky%2C%20architectural%20sports%20photography%2C%20no%20people&width=1000&height=700&seq=bmt-court-fb-01b&orientation=landscape"]', '05:00', '23:00', '["Sân 5 người", "Sân 7 người"]', 1, 'active', '23 Lê Duẩn, Tân Lợi, Buôn Ma Thuột, Đắk Lắk', 'Cỏ nhân tạo mới thay 2025, đèn LED 4 trụ.', 0),
  ('c02', 'san-bong-fc-dak-lak', 5, 'Sân bóng FC Đắk Lắk', 'football', 'Sân bóng đá', 'Tân An', '45 Nguyễn Tất Thành, P. Tân An, TP. Buôn Ma Thuột', 350000, 400000, 'Sân 7: 350.000đ • Sân 11: 620.000đ', '[{"id": "morning", "label": "Buổi sáng và chiều", "shortLabel": "Sáng – chiều", "start": "06:00", "end": "16:00", "price": 350000}, {"id": "evening", "label": "Buổi tối", "shortLabel": "Tối", "start": "16:00", "end": "22:30", "price": 400000, "peak": true}]', 270000, 'Mở cửa tất cả các ngày trong tuần', 4.7, 98, 93, 'Sân bóng FC Đắk Lắk sở hữu mặt cỏ nhân tạo chuẩn thi đấu cùng khán đài 200 chỗ, thường xuyên tổ chức các giải phong trào cấp thành phố. Phù hợp cho các đội 7 người và 11 người muốn thi đấu trên mặt sân rộng.', '["Khán đài 200 chỗ ngồi", "Mặt cỏ chuẩn thi đấu", "Thường tổ chức giải phong trào"]', '["Bãi giữ xe", "Khán đài", "Phòng thay đồ", "Căng tin", "Wifi miễn phí", "Trọng tài theo yêu cầu"]', '["https://readdy.ai/api/search-image?query=Full%20size%20eleven%20a%20side%20football%20pitch%20with%20green%20artificial%20turf%20and%20small%20spectator%20stand%2C%20evening%20sky%2C%20floodlight%20towers%2C%20clean%20highway%20fence%2C%20professional%20sports%20venue%20photography%2C%20no%20people&width=1000&height=700&seq=bmt-court-fb-02a&orientation=landscape", "https://readdy.ai/api/search-image?query=Goal%20net%20close%20up%20on%20an%20empty%20green%20football%20field%20at%20twilight%2C%20dewy%20turf%20texture%2C%20soft%20blue%20evening%20light%2C%20minimal%20clean%20composition%2C%20no%20people&width=1000&height=700&seq=bmt-court-fb-02b&orientation=landscape"]', '06:00', '22:30', '["Sân 7 người", "Sân 11 người"]', 1, 'active', '45 Nguyễn Tất Thành, Tân An, Buôn Ma Thuột, Đắk Lắk', '', 1),
  ('c03', 'san-bong-hoa-thang', NULL, 'Sân bóng Hòa Thắng', 'football', 'Sân bóng đá', 'Hòa Thắng', '12 Trường Chinh, P. Hòa Thắng, TP. Buôn Ma Thuột', 150000, 180000, 'Sân 5: 150.000đ', '[{"id": "morning", "label": "Buổi sáng và chiều", "shortLabel": "Sáng – chiều", "start": "05:30", "end": "16:00", "price": 150000}, {"id": "evening", "label": "Buổi tối", "shortLabel": "Tối", "start": "16:00", "end": "22:00", "price": 180000, "peak": true}]', NULL, 'Mở cửa tất cả các ngày trong tuần', 4.5, 74, 106, 'Sân 5 người giá bình dân tại phường Hòa Thắng, mặt sân phẳng và được vệ sinh hằng ngày. Đây là điểm hẹn quen thuộc của sinh viên và các nhóm bạn trẻ trong khu vực.', '["Giá thuê bình dân", "Gần khu dân cư Hòa Thắng", "Nhận sân đến 22 giờ"]', '["Bãi giữ xe", "Nước uống", "Đèn chiếu sáng", "Lưới & bóng miễn phí"]', '["https://readdy.ai/api/search-image?query=Compact%20neighborhood%20five%20a%20side%20football%20court%20with%20green%20turf%20surrounded%20by%20tropical%20trees%2C%20warm%20late%20afternoon%20sunlight%2C%20simple%20fence%2C%20friendly%20local%20sports%20setting%2C%20no%20people&width=1000&height=700&seq=bmt-court-fb-03a&orientation=landscape", "https://readdy.ai/api/search-image?query=Green%20artificial%20turf%20detail%20texture%20with%20white%20painted%20line%20on%20a%20small%20football%20court%2C%20soft%20evening%20light%2C%20minimal%20close%20up%20sports%20surface%20photography%2C%20no%20people&width=1000&height=700&seq=bmt-court-fb-03b&orientation=landscape"]', '05:30', '22:00', '["Sân 5 người"]', 0, 'active', '12 Trường Chinh, Hòa Thắng, Buôn Ma Thuột, Đắk Lắk', '', 2),
  ('c04', 'san-bong-tan-thanh', NULL, 'Sân bóng Tân Thành', 'football', 'Sân bóng đá', 'Tân Thành', '88 Phan Chu Trinh, P. Tân Thành, TP. Buôn Ma Thuột', 250000, 300000, 'Sân 7: 250.000đ', '[{"id": "morning", "label": "Buổi sáng và chiều", "shortLabel": "Sáng – chiều", "start": "06:00", "end": "16:00", "price": 250000}, {"id": "evening", "label": "Buổi tối", "shortLabel": "Tối", "start": "16:00", "end": "23:00", "price": 300000, "peak": true}]', NULL, 'Mở cửa tất cả các ngày trong tuần', 4.6, 63, 119, 'Sân 7 người có mái che lưới cao, hạn chế mất bóng và phù hợp cả khi trời mưa nhẹ. Khu vực để xe rộng, có phòng thay đồ riêng cho từng đội.', '["Có lưới chắn bóng cao", "Phòng thay đồ riêng", "Sân 7 người rộng rãi"]', '["Bãi giữ xe", "Phòng thay đồ", "Wifi miễn phí", "Căng tin", "Ghế khán giả"]', '["https://readdy.ai/api/search-image?query=Seven%20a%20side%20football%20field%20with%20high%20ball%20netting%20around%20the%20pitch%2C%20evening%20floodlights%2C%20green%20turf%2C%20clean%20urban%20sports%20facility%2C%20no%20people&width=1000&height=700&seq=bmt-court-fb-04a&orientation=landscape", "https://readdy.ai/api/search-image?query=Corner%20view%20of%20an%20empty%20football%20pitch%20with%20white%20corner%20flag%20and%20green%20turf%2C%20stadium%20lights%20glowing%2C%20calm%20night%20atmosphere%2C%20cinematic%20sports%20photography%2C%20no%20people&width=1000&height=700&seq=bmt-court-fb-04b&orientation=landscape"]', '06:00', '23:00', '["Sân 7 người"]', 1, 'active', '88 Phan Chu Trinh, Tân Thành, Buôn Ma Thuột, Đắk Lắk', '', 3),
  ('c05', 'san-bong-ea-tam-sport', 2, 'Sân bóng Ea Tam Sport', 'football', 'Sân bóng đá', 'Ea Tam', '102 Nguyễn Văn Cừ, P. Ea Tam, TP. Buôn Ma Thuột', 160000, 200000, 'Sân 5: 160.000đ • Sân 7: 290.000đ', '[{"id": "morning", "label": "Buổi sáng và chiều", "shortLabel": "Sáng – chiều", "start": "05:00", "end": "16:00", "price": 160000}, {"id": "evening", "label": "Buổi tối", "shortLabel": "Tối", "start": "16:00", "end": "23:00", "price": 200000, "peak": true}]', 130000, 'Mở cửa tất cả các ngày trong tuần', 4.4, 51, 96, 'Cụm sân gần khu công nghiệp Ea Tam, phục vụ đông đảo anh em công nhân và các đội bóng sau giờ tan ca. Có dịch vụ cho thuê áo bib và bơm bóng miễn phí.', '["Mở cửa đến 23 giờ", "Cho thuê áo bib", "Gần khu công nghiệp Ea Tam"]', '["Bãi giữ xe", "Nước uống", "Cho thuê áo bib", "Đèn chiếu sáng", "Wifi miễn phí"]', '["https://readdy.ai/api/search-image?query=Artificial%20grass%20football%20court%20at%20night%20with%20bright%20white%20floodlights%2C%20green%20turf%2C%20industrial%20area%20in%20the%20background%2C%20atmospheric%20sports%20photography%2C%20no%20people&width=1000&height=700&seq=bmt-court-fb-05a&orientation=landscape", "https://readdy.ai/api/search-image?query=Empty%20five%20a%20side%20football%20pitch%20seen%20from%20above%20at%20dusk%2C%20crisp%20white%20markings%2C%20green%20turf%2C%20surrounding%20fence%20and%20trees%2C%20aerial%20sports%20venue%20photography%2C%20no%20people&width=1000&height=700&seq=bmt-court-fb-05b&orientation=landscape"]', '05:00', '23:00', '["Sân 5 người", "Sân 7 người"]', 0, 'active', '102 Nguyễn Văn Cừ, Ea Tam, Buôn Ma Thuột, Đắk Lắk', 'Đang thay lưới chắn bóng phía Đông, mở lại từ 10/11.', 4),
  ('c06', 'san-bong-thang-loi-24h', 2, 'Sân bóng Thắng Lợi', 'football', 'Sân bóng đá', 'Thắng Lợi', '15 Mai Hắc Đế, P. Thắng Lợi, TP. Buôn Ma Thuột', 200000, 250000, 'Sân 5: 200.000đ', '[{"id": "morning", "label": "Buổi sáng và chiều", "shortLabel": "Sáng – chiều", "start": "05:00", "end": "16:00", "price": 200000}, {"id": "evening", "label": "Buổi tối", "shortLabel": "Tối", "start": "16:00", "end": "23:00", "price": 250000, "peak": true}]', NULL, 'Mở cửa hằng ngày 05:00 – 23:00, kể cả ngày lễ', 4.9, 187, 268, 'Sân bóng mở cửa hằng ngày từ 05:00 đến 23:00 với hệ thống đặt sân tự động, mặt cỏ nhân tạo thế hệ mới mềm và êm chân. Được nhiều đội bóng phong trào tại Buôn Ma Thuột đánh giá cao về chất lượng và dịch vụ.', '["Nhận sân đến 23:00", "Cỏ thế hệ mới êm chân", "Đặt sân tự động"]', '["Bãi giữ xe", "Phòng thay đồ", "Căng tin", "Wifi miễn phí", "Ghế khán giả", "Lưới & bóng miễn phí"]', '["https://readdy.ai/api/search-image?query=Premium%20five%20a%20side%20football%20court%20illuminated%20at%20night%2C%20lush%20green%20turf%2C%20glowing%20floodlights%2C%20modern%20clubhouse%20building%20beside%20the%20pitch%2C%20cinematic%20sports%20photography%2C%20no%20people&width=1000&height=700&seq=bmt-court-fb-06a&orientation=landscape", "https://readdy.ai/api/search-image?query=Night%20view%20of%20an%20empty%20green%20football%20pitch%20with%20bright%20stadium%20lights%20and%20misty%20air%2C%20deep%20shadows%2C%20dramatic%20sports%20atmosphere%2C%20no%20people&width=1000&height=700&seq=bmt-court-fb-06b&orientation=landscape"]', '05:00', '23:00', '["Sân 5 người"]', 1, 'active', '15 Mai Hắc Đế, Thắng Lợi, Buôn Ma Thuột, Đắk Lắk', 'Nhận sân xuyên đêm theo yêu cầu, có phòng thay đồ riêng.', 5),
  ('c07', 'nha-thi-dau-cau-long-buon-ma-thuot', NULL, 'Nhà thi đấu Cầu lông Buôn Ma Thuột', 'badminton', 'Sân cầu lông', 'Tân Lợi', '02 Y Moan, P. Tân Lợi, TP. Buôn Ma Thuột', 90000, 110000, '90.000đ/giờ • Thuê vợt 20.000đ', '[{"id": "morning", "label": "Buổi sáng và chiều", "shortLabel": "Sáng – chiều", "start": "05:00", "end": "17:00", "price": 90000}, {"id": "evening", "label": "Buổi tối", "shortLabel": "Tối", "start": "17:00", "end": "22:00", "price": 110000, "peak": true}]', NULL, 'Mở cửa tất cả các ngày trong tuần', 4.8, 154, 158, 'Nhà thi đấu trong nhà với 6 sân tiêu chuẩn, thảm chống trượt và trần cao thoáng, ánh sáng không chói mắt. Có huấn luyện viên nhận dạy kèm cho người mới bắt đầu.', '["6 sân trong nhà", "Thảm chống trượt", "Có HLV dạy kèm"]', '["Điều hòa & quạt trần", "Phòng thay đồ", "Bãi giữ xe", "Cho thuê vợt", "Căng tin nước uống", "Wifi miễn phí"]', '["https://readdy.ai/api/search-image?query=Indoor%20badminton%20hall%20with%20several%20courts%2C%20green%20court%20mats%2C%20high%20ceiling%20and%20bright%20even%20lighting%2C%20clean%20modern%20sports%20facility%2C%20wide%20angle%2C%20no%20people&width=1000&height=700&seq=bmt-court-bd-01a&orientation=landscape", "https://readdy.ai/api/search-image?query=Badminton%20net%20close%20up%20on%20a%20green%20indoor%20court%20with%20white%20line%20markings%20and%20polished%20wooden%20floor%2C%20soft%20sports%20lighting%2C%20minimal%20clean%20composition%2C%20no%20people&width=1000&height=700&seq=bmt-court-bd-01b&orientation=landscape"]', '05:00', '22:00', '["Sân tiêu chuẩn", "Sân tập luyện"]', 1, 'active', '02 Y Moan, Tân Lợi, Buôn Ma Thuột, Đắk Lắk', '', 6),
  ('c08', 'cau-long-tan-an-smash', 5, 'Cầu lông Tân An Smash', 'badminton', 'Sân cầu lông', 'Tân An', '61 Nguyễn Công Trứ, P. Tân An, TP. Buôn Ma Thuột', 70000, 90000, '70.000đ/giờ • Khung sáng 60.000đ', '[{"id": "early", "label": "Sáng sớm", "shortLabel": "Sáng sớm", "start": "05:30", "end": "11:00", "price": 60000}, {"id": "midday", "label": "Giữa ngày", "shortLabel": "Giữa ngày", "start": "11:00", "end": "17:00", "price": 70000}, {"id": "evening", "label": "Buổi tối", "shortLabel": "Tối", "start": "17:00", "end": "22:30", "price": 90000, "peak": true}]', NULL, 'Mở cửa tất cả các ngày trong tuần', 4.6, 92, 171, 'Sân cầu lông trong nhà tại trung tâm Tân An, 4 sân thảm PVC, phù hợp cho nhóm bạn chơi buổi tối. Có bán cầu và nước uống tại chỗ.', '["4 sân thảm PVC", "Giá khung sáng tiết kiệm", "Bán cầu & nước uống"]', '["Bãi giữ xe", "Bán cầu lông", "Nước uống", "Quạt trần", "Wifi miễn phí"]', '["https://readdy.ai/api/search-image?query=Clean%20indoor%20badminton%20courts%20with%20PVC%20floor%20mats%20in%20a%20simple%20sports%20hall%2C%20white%20net%20dividers%2C%20bright%20ceiling%20lights%2C%20no%20people&width=1000&height=700&seq=bmt-court-bd-02a&orientation=landscape", "https://readdy.ai/api/search-image?query=Empty%20badminton%20court%20from%20a%20low%20angle%20showing%20green%20mat%20and%20white%20boundary%20lines%2C%20soft%20indoor%20lighting%2C%20calm%20minimal%20sports%20interior%2C%20no%20people&width=1000&height=700&seq=bmt-court-bd-02b&orientation=landscape"]', '05:30', '22:30', '["Sân tiêu chuẩn"]', 0, 'active', '61 Nguyễn Công Trứ, Tân An, Buôn Ma Thuột, Đắk Lắk', '', 7),
  ('c09', 'cau-long-khanh-xuan', NULL, 'Cầu lông Khánh Xuân', 'badminton', 'Sân cầu lông', 'Khánh Xuân', '33 Đinh Tiên Hoàng, P. Khánh Xuân, TP. Buôn Ma Thuột', 80000, 100000, '80.000đ/giờ', '[{"id": "morning", "label": "Buổi sáng và chiều", "shortLabel": "Sáng – chiều", "start": "05:00", "end": "17:00", "price": 80000}, {"id": "evening", "label": "Buổi tối", "shortLabel": "Tối", "start": "17:00", "end": "21:30", "price": 100000, "peak": true}]', NULL, 'Mở cửa tất cả các ngày trong tuần', 4.5, 66, 184, 'Sân cầu lông 3 sân trong nhà thuộc phường Khánh Xuân, không gian yên tĩnh, phù hợp cho gia đình và nhóm bạn chơi thể thao buổi sáng.', '["Không gian yên tĩnh", "Gần chợ Khánh Xuân", "Có sân cho gia đình"]', '["Bãi giữ xe", "Phòng thay đồ", "Nước uống", "Quạt trần"]', '["https://readdy.ai/api/search-image?query=Simple%20indoor%20badminton%20hall%20with%20three%20green%20courts%2C%20wooden%20floor%2C%20white%20nets%2C%20daylight%20through%20high%20windows%2C%20clean%20calm%20interior%2C%20no%20people&width=1000&height=700&seq=bmt-court-bd-03a&orientation=landscape", "https://readdy.ai/api/search-image?query=Badminton%20racket%20and%20shuttlecock%20resting%20on%20a%20green%20indoor%20court%20floor%2C%20soft%20natural%20light%2C%20minimal%20still%20life%20sports%20photography%2C%20no%20people&width=1000&height=700&seq=bmt-court-bd-03b&orientation=landscape"]', '05:00', '21:30', '["Sân tiêu chuẩn"]', 0, 'active', '33 Đinh Tiên Hoàng, Khánh Xuân, Buôn Ma Thuột, Đắk Lắk', '', 8),
  ('c10', 'cau-long-victory-bmt', 2, 'Cầu lông Victory BMT', 'badminton', 'Sân cầu lông', 'Thành Công', '17 Tôn Đức Thắng, P. Thành Công, TP. Buôn Ma Thuột', 100000, 130000, '100.000đ/giờ • Sân VIP 130.000đ', '[{"id": "morning", "label": "Buổi sáng và chiều", "shortLabel": "Sáng – chiều", "start": "05:00", "end": "17:00", "price": 100000}, {"id": "evening", "label": "Buổi tối", "shortLabel": "Tối", "start": "17:00", "end": "23:00", "price": 130000, "peak": true}]', 30000, 'Mở cửa tất cả các ngày trong tuần', 4.9, 203, 326, 'Câu lạc bộ cầu lông cao cấp nhất Buôn Ma Thuột với 8 sân thảm BWF, trần cao 12m và hệ thống chiếu sáng chống chói. Có khu vực khởi động và phòng tập thể lực riêng.', '["8 sân thảm chuẩn BWF", "Trần cao 12m", "Khu khởi động riêng"]', '["Điều hòa", "Phòng thay đồ", "Tủ đồ có khóa", "Bãi giữ xe", "Căng tin", "Wifi miễn phí", "Cho thuê vợt"]', '["https://readdy.ai/api/search-image?query=Premium%20indoor%20badminton%20club%20with%20eight%20green%20BWF%20mats%2C%20very%20high%20ceiling%2C%20professional%20sports%20lighting%2C%20modern%20interior%20design%2C%20wide%20architectural%20shot%2C%20no%20people&width=1000&height=700&seq=bmt-court-bd-04a&orientation=landscape", "https://readdy.ai/api/search-image?query=Badminton%20court%20corner%20with%20green%20mat%2C%20net%20post%2C%20white%20lines%20and%20polished%20floor%2C%20warm%20indoor%20lighting%2C%20premium%20sports%20interior%20detail%2C%20no%20people&width=1000&height=700&seq=bmt-court-bd-04b&orientation=landscape"]', '05:00', '23:00', '["Sân tiêu chuẩn", "Sân VIP"]', 1, 'active', '17 Tôn Đức Thắng, Thành Công, Buôn Ma Thuột, Đắk Lắk', '8 sân thảm BWF, trần cao 12m, có điều hòa.', 9),
  ('c11', 'cau-long-pho-nui', NULL, 'Cầu lông Phố Núi', 'badminton', 'Sân cầu lông', 'Thống Nhất', '05 Nơ Trang Long, P. Thống Nhất, TP. Buôn Ma Thuột', 65000, 80000, '65.000đ/giờ', '[{"id": "morning", "label": "Buổi sáng và chiều", "shortLabel": "Sáng – chiều", "start": "06:00", "end": "17:00", "price": 65000}, {"id": "evening", "label": "Buổi tối", "shortLabel": "Tối", "start": "17:00", "end": "21:00", "price": 80000, "peak": true}]', NULL, 'Mở cửa tất cả các ngày trong tuần', 4.3, 38, 210, 'Sân cầu lông giá rẻ dành cho học sinh, sinh viên tại phường Thống Nhất. Sân đang bảo trì 1 trong 3 sân, 2 sân còn lại hoạt động bình thường.', '["Giá rẻ cho sinh viên", "Gần trường học", "Nhận đặt theo tháng"]', '["Bãi giữ xe", "Nước uống", "Quạt trần"]', '["https://readdy.ai/api/search-image?query=Basic%20indoor%20badminton%20court%20with%20green%20floor%20mat%20and%20white%20net%2C%20simple%20gym%20hall%20interior%2C%20daylight%2C%20no%20people&width=1000&height=700&seq=bmt-court-bd-05a&orientation=landscape", "https://readdy.ai/api/search-image?query=Badminton%20shuttlecock%20on%20wooden%20bench%20beside%20an%20indoor%20court%2C%20soft%20light%2C%20minimal%20clean%20composition%2C%20no%20people&width=1000&height=700&seq=bmt-court-bd-05b&orientation=landscape"]', '06:00', '21:00', '["Sân tiêu chuẩn"]', 0, 'maintenance', '05 Nơ Trang Long, Thống Nhất, Buôn Ma Thuột, Đắk Lắk', '', 10),
  ('c12', 'cau-long-hoa-thang-arena', NULL, 'Cầu lông Hòa Thắng Arena', 'badminton', 'Sân cầu lông', 'Hòa Thắng', '210 Lý Thường Kiệt, P. Hòa Thắng, TP. Buôn Ma Thuột', 75000, 95000, '75.000đ/giờ • Combo 3 giờ 200.000đ', '[{"id": "morning", "label": "Buổi sáng và chiều", "shortLabel": "Sáng – chiều", "start": "05:00", "end": "17:00", "price": 75000}, {"id": "evening", "label": "Buổi tối", "shortLabel": "Tối", "start": "17:00", "end": "22:00", "price": 95000, "peak": true}]', NULL, 'Mở cửa tất cả các ngày trong tuần', 4.6, 81, 223, 'Sân cầu lông mới khai trương cuối năm 2025 với 5 sân thảm xanh, trần cao và hệ thống thông gió tốt. Có ưu đãi combo 3 giờ cho nhóm đông người.', '["5 sân mới khai trương", "Ưu đãi combo 3 giờ", "Thông gió tốt"]', '["Bãi giữ xe", "Phòng thay đồ", "Quạt trần", "Nước uống", "Wifi miễn phí"]', '["https://readdy.ai/api/search-image?query=New%20indoor%20badminton%20arena%20with%20five%20green%20mats%2C%20high%20ceiling%20with%20ventilation%20fans%2C%20bright%20even%20lighting%2C%20modern%20clean%20sports%20hall%2C%20no%20people&width=1000&height=700&seq=bmt-court-bd-06a&orientation=landscape", "https://readdy.ai/api/search-image?query=Badminton%20net%20and%20green%20court%20mat%20in%20a%20bright%20air%20conditioned%20sports%20hall%2C%20white%20walls%2C%20minimal%20modern%20interior%2C%20no%20people&width=1000&height=700&seq=bmt-court-bd-06b&orientation=landscape"]', '05:00', '22:00', '["Sân tiêu chuẩn"]', 1, 'active', '210 Lý Thường Kiệt, Hòa Thắng, Buôn Ma Thuột, Đắk Lắk', '', 11);

INSERT INTO `bookings` (`id`, `code`, `source`, `court_id`, `court_name`, `sport`, `area`, `image`, `customer_id`, `customer_name`, `customer_phone`, `customer_email`, `booking_date`, `start_slot`, `duration_minutes`, `slots`, `unit_price`, `base_total`, `total_price`, `deposit_amount`, `payment_method`, `payment_status`, `payment_label`, `status`, `reject_reason`, `cancel_reason`, `note`, `created_at`) VALUES
  ('cb-b01', 'BMT20261106-142', 'online', 'c01', 'Sân bóng BMT Arena', 'football', 'Tân Lợi', 'https://readdy.ai/api/search-image?query=Modern%20artificial%20grass%20five%20a%20side%20football%20pitch%20under%20bright%20floodlights%20at%20night%2C%20vivid%20green%20turf%2C%20white%20line%20markings%2C%20green%20net%20fence%2C%20clean%20sports%20photography%2C%20no%20people&width=1000&height=700&seq=bmt-court-fb-01a&orientation=landscape', 3, 'Nguyễn Minh Quân', '0912 345 678', 'minhquan.nguyen@gmail.com', (CURDATE() + INTERVAL 0 DAY), '18:00', 120, '["18:00", "19:00"]', 180000, 360000, 360000, 108000, 'vietqr', 'deposit_paid', NULL, 'confirmed', NULL, NULL, 'Đội mình 10 người, cần thuê thêm 2 bộ áo bib.', ((CURDATE() + INTERVAL -4 DAY) + INTERVAL 9 HOUR)),
  ('cb-b02', 'BMT20261109-318', 'online', 'c10', 'Cầu lông Victory BMT', 'badminton', 'Thành Công', 'https://readdy.ai/api/search-image?query=Premium%20indoor%20badminton%20club%20with%20eight%20green%20BWF%20mats%2C%20very%20high%20ceiling%2C%20professional%20sports%20lighting%2C%20modern%20interior%20design%2C%20wide%20architectural%20shot%2C%20no%20people&width=1000&height=700&seq=bmt-court-bd-04a&orientation=landscape', 3, 'Nguyễn Minh Quân', '0912 345 678', 'minhquan.nguyen@gmail.com', (CURDATE() + INTERVAL 3 DAY), '19:00', 60, '["19:00"]', 100000, 100000, 100000, 30000, 'vietqr', 'unpaid', NULL, 'pending', NULL, NULL, 'Nhóm 4 người, cần thuê 2 vợt.', ((CURDATE() + INTERVAL -3 DAY) + INTERVAL 9 HOUR)),
  ('cb-b03', 'BMT20261114-075', 'online', 'c04', 'Sân bóng Tân Thành', 'football', 'Tân Thành', 'https://readdy.ai/api/search-image?query=Seven%20a%20side%20football%20field%20with%20high%20ball%20netting%20around%20the%20pitch%2C%20evening%20floodlights%2C%20green%20turf%2C%20clean%20urban%20sports%20facility%2C%20no%20people&width=1000&height=700&seq=bmt-court-fb-04a&orientation=landscape', 3, 'Nguyễn Minh Quân', '0912 345 678', 'minhquan.nguyen@gmail.com', (CURDATE() + INTERVAL 8 DAY), '17:00', 120, '["17:00", "18:00"]', 250000, 500000, 500000, 150000, 'vietqr', 'deposit_paid', NULL, 'confirmed', NULL, NULL, 'Trận giao hữu với FC Ea Tam.', ((CURDATE() + INTERVAL -5 DAY) + INTERVAL 9 HOUR)),
  ('cb-b04', 'BMT20261030-204', 'online', 'c06', 'Sân bóng Thắng Lợi', 'football', 'Thắng Lợi', 'https://readdy.ai/api/search-image?query=Premium%20five%20a%20side%20football%20court%20illuminated%20at%20night%2C%20lush%20green%20turf%2C%20glowing%20floodlights%2C%20modern%20clubhouse%20building%20beside%20the%20pitch%2C%20cinematic%20sports%20photography%2C%20no%20people&width=1000&height=700&seq=bmt-court-fb-06a&orientation=landscape', 3, 'Nguyễn Minh Quân', '0912 345 678', 'minhquan.nguyen@gmail.com', (CURDATE() + INTERVAL -7 DAY), '20:00', 120, '["20:00", "21:00"]', 200000, 400000, 400000, 120000, 'vietqr', 'paid', NULL, 'completed', NULL, NULL, 'Đá xong thanh toán tiền mặt tại quầy.', ((CURDATE() + INTERVAL -10 DAY) + INTERVAL 9 HOUR)),
  ('cb-b05', 'BMT20261022-119', 'online', 'c07', 'Nhà thi đấu Cầu lông Buôn Ma Thuột', 'badminton', 'Tân Lợi', 'https://readdy.ai/api/search-image?query=Indoor%20badminton%20hall%20with%20several%20courts%2C%20green%20court%20mats%2C%20high%20ceiling%20and%20bright%20even%20lighting%2C%20clean%20modern%20sports%20facility%2C%20wide%20angle%2C%20no%20people&width=1000&height=700&seq=bmt-court-bd-01a&orientation=landscape', 3, 'Nguyễn Minh Quân', '0912 345 678', 'minhquan.nguyen@gmail.com', (CURDATE() + INTERVAL -15 DAY), '06:00', 120, '["06:00", "07:00"]', 90000, 180000, 180000, 54000, 'vietqr', 'paid', NULL, 'completed', NULL, NULL, 'Chơi buổi sáng cùng nhóm Phố Núi.', ((CURDATE() + INTERVAL -17 DAY) + INTERVAL 9 HOUR)),
  ('cb-b06', 'BMT20261015-060', 'online', 'c02', 'Sân bóng FC Đắk Lắk', 'football', 'Tân An', 'https://readdy.ai/api/search-image?query=Full%20size%20eleven%20a%20side%20football%20pitch%20with%20green%20artificial%20turf%20and%20small%20spectator%20stand%2C%20evening%20sky%2C%20floodlight%20towers%2C%20clean%20highway%20fence%2C%20professional%20sports%20venue%20photography%2C%20no%20people&width=1000&height=700&seq=bmt-court-fb-02a&orientation=landscape', 3, 'Nguyễn Minh Quân', '0912 345 678', 'minhquan.nguyen@gmail.com', (CURDATE() + INTERVAL -22 DAY), '19:00', 60, '["19:00"]', 350000, 350000, 350000, 105000, 'vietqr', 'unpaid', NULL, 'cancelled', NULL, 'Bận việc gia đình, không thể ra sân.', 'Đặt sân 7 người cho đội công ty.', ((CURDATE() + INTERVAL -25 DAY) + INTERVAL 9 HOUR)),
  ('cb-b07', 'BMT20260928-233', 'online', 'c08', 'Cầu lông Tân An Smash', 'badminton', 'Tân An', 'https://readdy.ai/api/search-image?query=Clean%20indoor%20badminton%20courts%20with%20PVC%20floor%20mats%20in%20a%20simple%20sports%20hall%2C%20white%20net%20dividers%2C%20bright%20ceiling%20lights%2C%20no%20people&width=1000&height=700&seq=bmt-court-bd-02a&orientation=landscape', 3, 'Nguyễn Minh Quân', '0912 345 678', 'minhquan.nguyen@gmail.com', (CURDATE() + INTERVAL -39 DAY), '18:00', 60, '["18:00"]', 70000, 70000, 70000, 21000, 'vietqr', 'paid', NULL, 'completed', NULL, NULL, NULL, ((CURDATE() + INTERVAL -42 DAY) + INTERVAL 9 HOUR)),
  ('cb-b08', 'BMT20260912-087', 'online', 'c03', 'Sân bóng Hòa Thắng', 'football', 'Hòa Thắng', 'https://readdy.ai/api/search-image?query=Compact%20neighborhood%20five%20a%20side%20football%20court%20with%20green%20turf%20surrounded%20by%20tropical%20trees%2C%20warm%20late%20afternoon%20sunlight%2C%20simple%20fence%2C%20friendly%20local%20sports%20setting%2C%20no%20people&width=1000&height=700&seq=bmt-court-fb-03a&orientation=landscape', 3, 'Nguyễn Minh Quân', '0912 345 678', 'minhquan.nguyen@gmail.com', (CURDATE() + INTERVAL -55 DAY), '07:00', 120, '["07:00", "08:00"]', 150000, 300000, 300000, 90000, 'vietqr', 'paid', NULL, 'completed', NULL, NULL, 'Đá buổi sáng cuối tuần cùng anh em trong xóm.', ((CURDATE() + INTERVAL -58 DAY) + INTERVAL 9 HOUR)),
  ('ob-ob1', 'BMT20261106-149', 'owner', 'c01', 'Sân bóng BMT Arena', 'football', 'Tân Lợi', 'https://readdy.ai/api/search-image?query=Modern%20artificial%20grass%20five%20a%20side%20football%20pitch%20under%20bright%20floodlights%20at%20night%2C%20vivid%20green%20turf%2C%20white%20line%20markings%2C%20green%20net%20fence%2C%20clean%20sports%20photography%2C%20no%20people&width=1000&height=700&seq=bmt-court-fb-01a&orientation=landscape', NULL, 'Nguyễn Minh Quân', '0912 345 678', 'minhquan.nguyen@gmail.com', (CURDATE() + INTERVAL 0 DAY), '18:00', 120, '["18:00", "19:00"]', 200000, 400000, 400000, 0, 'cash', 'unpaid', 'Thanh toán tại sân', 'pending', NULL, NULL, 'Đội mình 10 người, cần thuê thêm 2 bộ áo bib.', ((CURDATE() + INTERVAL -4 DAY) + INTERVAL 8 HOUR)),
  ('ob-ob2', 'BMT20261105-206', 'owner', 'c10', 'Cầu lông Victory BMT', 'badminton', 'Thành Công', 'https://readdy.ai/api/search-image?query=Premium%20indoor%20badminton%20club%20with%20eight%20green%20BWF%20mats%2C%20very%20high%20ceiling%2C%20professional%20sports%20lighting%2C%20modern%20interior%20design%2C%20wide%20architectural%20shot%2C%20no%20people&width=1000&height=700&seq=bmt-court-bd-04a&orientation=landscape', NULL, 'Lê Hoàng Nam', '0905 112 334', 'hoangnam.le@gmail.com', (CURDATE() + INTERVAL -1 DAY), '19:00', 60, '["19:00"]', 130000, 130000, 130000, 0, 'cash', 'paid', 'Đã thu đủ · Chuyển khoản', 'pending', NULL, NULL, 'Nhóm 4 người, cần thuê 2 vợt và 1 hộp cầu.', ((CURDATE() + INTERVAL -3 DAY) + INTERVAL 8 HOUR)),
  ('ob-ob3', 'BMT20261107-118', 'owner', 'c06', 'Sân bóng Thắng Lợi', 'football', 'Thắng Lợi', 'https://readdy.ai/api/search-image?query=Premium%20five%20a%20side%20football%20court%20illuminated%20at%20night%2C%20lush%20green%20turf%2C%20glowing%20floodlights%2C%20modern%20clubhouse%20building%20beside%20the%20pitch%2C%20cinematic%20sports%20photography%2C%20no%20people&width=1000&height=700&seq=bmt-court-fb-06a&orientation=landscape', NULL, 'Phạm Anh Tuấn', '0977 664 512', 'anhtuan.pham@gmail.com', (CURDATE() + INTERVAL 1 DAY), '20:00', 120, '["20:00", "21:00"]', 250000, 500000, 500000, 0, 'cash', 'unpaid', 'Thanh toán tại sân', 'pending', NULL, NULL, 'Trận giao hữu giữa FC Ea Tam và FC Tân Lợi.', ((CURDATE() + INTERVAL -3 DAY) + INTERVAL 8 HOUR)),
  ('ob-ob4', 'BMT20261108-091', 'owner', 'c05', 'Sân bóng Ea Tam Sport', 'football', 'Ea Tam', 'https://readdy.ai/api/search-image?query=Artificial%20grass%20football%20court%20at%20night%20with%20bright%20white%20floodlights%2C%20green%20turf%2C%20industrial%20area%20in%20the%20background%2C%20atmospheric%20sports%20photography%2C%20no%20people&width=1000&height=700&seq=bmt-court-fb-05a&orientation=landscape', NULL, 'Đỗ Thị Mai', '0938 220 774', 'thimai.do@gmail.com', (CURDATE() + INTERVAL 2 DAY), '17:00', 60, '["17:00"]', 160000, 160000, 160000, 0, 'cash', 'unpaid', 'Thanh toán tại sân', 'pending', NULL, NULL, 'Nhóm công nhân khu Ea Tam, đá sau giờ tan ca.', ((CURDATE() + INTERVAL -2 DAY) + INTERVAL 8 HOUR)),
  ('ob-ob5', 'BMT20261106-233', 'owner', 'c10', 'Cầu lông Victory BMT', 'badminton', 'Thành Công', 'https://readdy.ai/api/search-image?query=Premium%20indoor%20badminton%20club%20with%20eight%20green%20BWF%20mats%2C%20very%20high%20ceiling%2C%20professional%20sports%20lighting%2C%20modern%20interior%20design%2C%20wide%20architectural%20shot%2C%20no%20people&width=1000&height=700&seq=bmt-court-bd-04a&orientation=landscape', NULL, 'Trần Thu Hà', '0913 887 265', 'thuha.tran@gmail.com', (CURDATE() + INTERVAL 0 DAY), '17:00', 120, '["17:00", "18:00"]', 130000, 260000, 260000, 0, 'cash', 'paid', 'Đã thu đủ · Chuyển khoản', 'confirmed', NULL, NULL, 'Nhóm cầu lông Phố Núi, chơi cố định thứ Sáu.', ((CURDATE() + INTERVAL -5 DAY) + INTERVAL 8 HOUR)),
  ('ob-ob6', 'BMT20261109-325', 'owner', 'c10', 'Cầu lông Victory BMT', 'badminton', 'Thành Công', 'https://readdy.ai/api/search-image?query=Premium%20indoor%20badminton%20club%20with%20eight%20green%20BWF%20mats%2C%20very%20high%20ceiling%2C%20professional%20sports%20lighting%2C%20modern%20interior%20design%2C%20wide%20architectural%20shot%2C%20no%20people&width=1000&height=700&seq=bmt-court-bd-04a&orientation=landscape', NULL, 'Nguyễn Minh Quân', '0912 345 678', 'minhquan.nguyen@gmail.com', (CURDATE() + INTERVAL 3 DAY), '19:00', 60, '["19:00"]', 130000, 130000, 130000, 0, 'cash', 'paid', 'Đã thu đủ · Chuyển khoản', 'confirmed', NULL, NULL, 'Nhóm 4 người, cần thuê 2 vợt.', ((CURDATE() + INTERVAL -3 DAY) + INTERVAL 8 HOUR)),
  ('ob-ob7', 'BMT20261110-147', 'owner', 'c01', 'Sân bóng BMT Arena', 'football', 'Tân Lợi', 'https://readdy.ai/api/search-image?query=Modern%20artificial%20grass%20five%20a%20side%20football%20pitch%20under%20bright%20floodlights%20at%20night%2C%20vivid%20green%20turf%2C%20white%20line%20markings%2C%20green%20net%20fence%2C%20clean%20sports%20photography%2C%20no%20people&width=1000&height=700&seq=bmt-court-fb-01a&orientation=landscape', NULL, 'Vũ Đức Thành', '0966 431 208', 'ducthanh.vu@gmail.com', (CURDATE() + INTERVAL 4 DAY), '18:00', 180, '["18:00", "19:00", "20:00"]', 220000, 660000, 660000, 0, 'cash', 'paid', 'Đã thu đủ · Chuyển khoản', 'confirmed', NULL, NULL, 'Giải nội bộ công ty, cần kẻ sân và bơm 3 quả bóng.', ((CURDATE() + INTERVAL -4 DAY) + INTERVAL 8 HOUR)),
  ('ob-ob8', 'BMT20261102-055', 'owner', 'c01', 'Sân bóng BMT Arena', 'football', 'Tân Lợi', 'https://readdy.ai/api/search-image?query=Modern%20artificial%20grass%20five%20a%20side%20football%20pitch%20under%20bright%20floodlights%20at%20night%2C%20vivid%20green%20turf%2C%20white%20line%20markings%2C%20green%20net%20fence%2C%20clean%20sports%20photography%2C%20no%20people&width=1000&height=700&seq=bmt-court-fb-01a&orientation=landscape', NULL, 'Bùi Văn Khoa', '0912 774 019', 'vankhoa.bui@gmail.com', (CURDATE() + INTERVAL -4 DAY), '19:00', 120, '["19:00", "20:00"]', 220000, 440000, 440000, 0, 'cash', 'paid', 'Đã thu đủ · Tiền mặt', 'completed', NULL, NULL, 'Thanh toán tiền mặt tại quầy, đã thu đủ.', ((CURDATE() + INTERVAL -7 DAY) + INTERVAL 8 HOUR)),
  ('ob-ob9', 'BMT20261101-082', 'owner', 'c06', 'Sân bóng Thắng Lợi', 'football', 'Thắng Lợi', 'https://readdy.ai/api/search-image?query=Premium%20five%20a%20side%20football%20court%20illuminated%20at%20night%2C%20lush%20green%20turf%2C%20glowing%20floodlights%2C%20modern%20clubhouse%20building%20beside%20the%20pitch%2C%20cinematic%20sports%20photography%2C%20no%20people&width=1000&height=700&seq=bmt-court-fb-06a&orientation=landscape', NULL, 'Hoàng Nhật Minh', '0904 552 881', 'nhatminh.hoang@gmail.com', (CURDATE() + INTERVAL -5 DAY), '17:00', 60, '["17:00"]', 200000, 200000, 200000, 0, 'cash', 'paid', 'Đã thu đủ · Tiền mặt', 'completed', NULL, NULL, NULL, ((CURDATE() + INTERVAL -8 DAY) + INTERVAL 8 HOUR)),
  ('ob-ob10', 'BMT20261031-011', 'owner', 'c10', 'Cầu lông Victory BMT', 'badminton', 'Thành Công', 'https://readdy.ai/api/search-image?query=Premium%20indoor%20badminton%20club%20with%20eight%20green%20BWF%20mats%2C%20very%20high%20ceiling%2C%20professional%20sports%20lighting%2C%20modern%20interior%20design%2C%20wide%20architectural%20shot%2C%20no%20people&width=1000&height=700&seq=bmt-court-bd-04a&orientation=landscape', NULL, 'Lý Thanh Tùng', '0932 118 640', 'thanhtung.ly@gmail.com', (CURDATE() + INTERVAL -6 DAY), '06:00', 120, '["06:00", "07:00"]', 100000, 200000, 200000, 0, 'cash', 'paid', 'Đã thu đủ · Chuyển khoản', 'completed', NULL, NULL, 'Nhóm chơi buổi sáng, đã hoàn tất.', ((CURDATE() + INTERVAL -9 DAY) + INTERVAL 8 HOUR)),
  ('ob-ob11', 'BMT20261103-174', 'owner', 'c01', 'Sân bóng BMT Arena', 'football', 'Tân Lợi', 'https://readdy.ai/api/search-image?query=Modern%20artificial%20grass%20five%20a%20side%20football%20pitch%20under%20bright%20floodlights%20at%20night%2C%20vivid%20green%20turf%2C%20white%20line%20markings%2C%20green%20net%20fence%2C%20clean%20sports%20photography%2C%20no%20people&width=1000&height=700&seq=bmt-court-fb-01a&orientation=landscape', NULL, 'Trịnh Bảo Châu', '0987 220 913', 'baochau.trinh@gmail.com', (CURDATE() + INTERVAL -3 DAY), '21:00', 60, '["21:00"]', 220000, 220000, 220000, 0, 'cash', 'unpaid', 'Thanh toán tại sân', 'cancelled', 'Khách chủ động hủy trước 8 giờ, đã mở lại khung giờ.', NULL, 'Khách báo bận đột xuất.', ((CURDATE() + INTERVAL -6 DAY) + INTERVAL 8 HOUR)),
  ('ob-ob12', 'BMT20261029-063', 'owner', 'c05', 'Sân bóng Ea Tam Sport', 'football', 'Ea Tam', 'https://readdy.ai/api/search-image?query=Artificial%20grass%20football%20court%20at%20night%20with%20bright%20white%20floodlights%2C%20green%20turf%2C%20industrial%20area%20in%20the%20background%2C%20atmospheric%20sports%20photography%2C%20no%20people&width=1000&height=700&seq=bmt-court-fb-05a&orientation=landscape', NULL, 'Ngô Quốc Việt', '0918 300 442', 'quocviet.ngo@gmail.com', (CURDATE() + INTERVAL -8 DAY), '18:00', 120, '["18:00", "19:00"]', 190000, 380000, 380000, 0, 'cash', 'paid', 'Đã thu đủ · Tiền mặt', 'completed', NULL, NULL, NULL, ((CURDATE() + INTERVAL -11 DAY) + INTERVAL 8 HOUR));

INSERT INTO blocked_slots (court_id, block_date, slot) VALUES
  ('c01', CURDATE() + INTERVAL 1 DAY, '06:00'), ('c01', CURDATE() + INTERVAL 1 DAY, '07:00'),
  ('c10', CURDATE() + INTERVAL 2 DAY, '12:00'), ('c06', CURDATE(), '22:00');

INSERT INTO `reviews` (`id`, `booking_id`, `booking_code`, `court_id`, `customer_name`, `booking_label`, `rating`, `comment`, `tags`, `owner_reply`, `owner_replied_at`, `moderation_status`, `moderation_note`, `created_at`) VALUES
  ('rv-seed-01', 'cb-b04', 'BMT20261030-204', 'c06', 'Nguyễn Minh Quân', 'Lượt chơi đã hoàn thành', 5, 'Sân cỏ mới, đèn sáng đều, chủ sân hỗ trợ nhiệt tình. Sẽ quay lại cùng đội!', '["Mặt sân tốt", "Đèn sáng", "Nhân viên thân thiện"]', 'Cảm ơn anh Quân và cả đội, hẹn gặp lại các anh tuần sau nhé!', (NOW() - INTERVAL 6 DAY), 'approved', '', (NOW() - INTERVAL 7 DAY)),
  ('rv-seed-02', 'cb-b05', 'BMT20261022-119', 'c07', 'Nguyễn Minh Quân', 'Lượt chơi đã hoàn thành', 4, 'Nhà thi đấu rộng, thảm tốt, giờ cao điểm hơi đông nhưng vẫn ổn.', '["Sạch sẽ", "Thảm đẹp"]', NULL, NULL, 'approved', '', (NOW() - INTERVAL 15 DAY)),
  ('rv-seed-03', NULL, NULL, 'c01', 'Trần Thanh Tùng', 'Khách ghé sân', 5, 'Đá tối thứ 6 rất thích, mặt cỏ êm chân, bãi xe rộng rãi.', '["Mặt sân tốt", "Bãi xe rộng"]', 'Cảm ơn anh Tùng đã ủng hộ BMT Arena!', (NOW() - INTERVAL 2 DAY), 'approved', '', (NOW() - INTERVAL 3 DAY)),
  ('rv-seed-04', NULL, NULL, 'c01', 'Lê Hoàng Phúc', 'Khách ghé sân', 4, 'Giá hợp lý, chỉ mong căng tin có thêm nước điện giải.', '["Giá hợp lý"]', NULL, NULL, 'approved', '', (NOW() - INTERVAL 9 DAY)),
  ('rv-seed-05', NULL, NULL, 'c10', 'Võ Ngọc Anh', 'Khách ghé sân', 5, 'Sân VIP có điều hòa, trần cao, đánh rất đã. Đặt online nhanh gọn.', '["Có điều hòa", "Đặt nhanh"]', NULL, NULL, 'approved', '', (NOW() - INTERVAL 4 DAY)),
  ('rv-seed-06', NULL, NULL, 'c02', 'Đỗ Quang Huy', 'Khách ghé sân', 3, 'Mặt sân ổn nhưng hôm mình đá đèn một trụ bị yếu.', '["Mặt sân tốt"]', NULL, NULL, 'approved', '', (NOW() - INTERVAL 12 DAY)),
  ('rv-seed-07', NULL, NULL, 'c12', 'Phan Gia Bảo', 'Khách ghé sân', 2, 'Spam quảng cáo bán giày tại zalo 09xx...', '[]', NULL, NULL, 'hidden', 'Nội dung quảng cáo, vi phạm quy định', (NOW() - INTERVAL 2 DAY));

INSERT INTO promotions (id, owner_id, owner_name, code, title, description, discount_type, discount_value, max_discount, min_order,
  start_date, end_date, weekdays, start_time, end_time, usage_limit, status) VALUES
  ('promo-seed-1', 2, 'Hưng Sport BMT', 'GIOVANG', 'Giờ vàng buổi sáng', 'Giảm 20% cho các khung giờ sáng từ 05:00 đến 15:00.', 'percent', 20, 60000, 100000,
     CURDATE() - INTERVAL 10 DAY, CURDATE() + INTERVAL 50 DAY, '[1,2,3,4,5]', '05:00', '15:00', 200, 'active'),
  ('promo-seed-2', 2, 'Hưng Sport BMT', 'BMT30K', 'Giảm 30K cho đơn từ 300K', 'Áp dụng mọi khung giờ, mọi ngày trong tuần.', 'amount', 30000, NULL, 300000,
     CURDATE() - INTERVAL 5 DAY, CURDATE() + INTERVAL 25 DAY, '[]', '', '', 100, 'active'),
  ('promo-seed-3', 5, 'Lộc Sport', 'CUOITUAN', 'Cuối tuần sôi động', 'Giảm 10% cho đơn đặt Thứ Bảy, Chủ Nhật.', 'percent', 10, 50000, 0,
     CURDATE() - INTERVAL 3 DAY, CURDATE() + INTERVAL 60 DAY, '[6,7]', '', '', NULL, 'active'),
  ('promo-seed-4', NULL, 'Hệ thống BMT 24H', 'CHAOMUNG', 'Chào mừng thành viên mới', 'Giảm 15% cho lần đặt sân đầu tiên.', 'percent', 15, 40000, 0,
     CURDATE() + INTERVAL 5 DAY, CURDATE() + INTERVAL 90 DAY, '[]', '', '', 500, 'active');

INSERT INTO `categories` (`id`, `kind`, `name`, `slug`, `description`, `icon`, `sort_order`, `active`) VALUES
  ('cat-football', 'sport', 'Bóng đá', 'bong-da', 'Sân 5, sân 7 và sân 11 người', 'ri-football-line', 1, 1),
  ('cat-badminton', 'sport', 'Cầu lông', 'cau-long', 'Sân thảm tiêu chuẩn và sân VIP', 'ri-ping-pong-line', 2, 1),
  ('cat-area-1', 'area', 'Tân Lợi', 'tan-loi', 'Phường Tân Lợi, TP. Buôn Ma Thuột', 'ri-map-pin-line', 1, 1),
  ('cat-area-2', 'area', 'Tân An', 'tan-an', 'Phường Tân An, TP. Buôn Ma Thuột', 'ri-map-pin-line', 2, 1),
  ('cat-area-3', 'area', 'Thắng Lợi', 'thang-loi', 'Phường Thắng Lợi, TP. Buôn Ma Thuột', 'ri-map-pin-line', 3, 1),
  ('cat-area-4', 'area', 'Tân Thành', 'tan-thanh', 'Phường Tân Thành, TP. Buôn Ma Thuột', 'ri-map-pin-line', 4, 1),
  ('cat-area-5', 'area', 'Hòa Thắng', 'hoa-thang', 'Phường Hòa Thắng, TP. Buôn Ma Thuột', 'ri-map-pin-line', 5, 1),
  ('cat-area-6', 'area', 'Ea Tam', 'ea-tam', 'Phường Ea Tam, TP. Buôn Ma Thuột', 'ri-map-pin-line', 6, 1),
  ('cat-area-7', 'area', 'Khánh Xuân', 'khanh-xuan', 'Phường Khánh Xuân, TP. Buôn Ma Thuột', 'ri-map-pin-line', 7, 1),
  ('cat-area-8', 'area', 'Thành Công', 'thanh-cong', 'Phường Thành Công, TP. Buôn Ma Thuột', 'ri-map-pin-line', 8, 1),
  ('cat-area-9', 'area', 'Thống Nhất', 'thong-nhat', 'Phường Thống Nhất, TP. Buôn Ma Thuột', 'ri-map-pin-line', 9, 1);

INSERT INTO `contents` (`id`, `kind`, `title`, `slug`, `summary`, `body`, `image`, `link_url`, `status`, `pinned`, `sort_order`) VALUES
  ('faq-1', 'faq', 'Tôi có cần tạo tài khoản để đặt sân không?', '', 'Không bắt buộc. Bạn chỉ cần họ tên và số điện thoại là có thể gửi yêu cầu đặt sân. Tạo tài khoản sẽ giúp bạn theo dõi lịch sử, xem lại mã đặt sân và hủy đơn nhanh hơn.', 'Không bắt buộc. Bạn chỉ cần họ tên và số điện thoại là có thể gửi yêu cầu đặt sân. Tạo tài khoản sẽ giúp bạn theo dõi lịch sử, xem lại mã đặt sân và hủy đơn nhanh hơn.', '', '', 'published', 1, 1),
  ('faq-2', 'faq', 'Giá thuê sân tại Buôn Ma Thuột là bao nhiêu?', '', 'Sân bóng đá từ 150.000đ/giờ (sân 5) đến 620.000đ/giờ (sân 11). Sân cầu lông từ 65.000đ/giờ đến 130.000đ/giờ với sân VIP. Giá được niêm yết theo từng sân và từng loại sân, khung 17:00 - 21:00 có thể ph', 'Sân bóng đá từ 150.000đ/giờ (sân 5) đến 620.000đ/giờ (sân 11). Sân cầu lông từ 65.000đ/giờ đến 130.000đ/giờ với sân VIP. Giá được niêm yết theo từng sân và từng loại sân, khung 17:00 - 21:00 có thể phụ thu 10%.', '', '', 'published', 0, 2),
  ('faq-3', 'faq', 'Sân còn trống thì giữ chỗ trong bao lâu?', '', 'Khung giờ bạn chọn được tạm giữ 10 phút trong lúc hoàn tất thông tin. Quá thời gian này, hệ thống mở lại khung giờ cho người chơi khác để tránh trùng lịch.', 'Khung giờ bạn chọn được tạm giữ 10 phút trong lúc hoàn tất thông tin. Quá thời gian này, hệ thống mở lại khung giờ cho người chơi khác để tránh trùng lịch.', '', '', 'published', 0, 3),
  ('faq-4', 'faq', 'Chính sách hủy sân và hoàn cọc như thế nào?', '', 'Bạn chỉ có thể hủy và được hoàn 100% tiền cọc khi còn cách giờ chơi từ 4 giờ trở lên. Trong 4 giờ cuối, nút hủy sẽ khóa để chủ sân không mất khung giờ đã giữ, bạn gọi hotline 0262 399 8888 để được xử ', 'Bạn chỉ có thể hủy và được hoàn 100% tiền cọc khi còn cách giờ chơi từ 4 giờ trở lên. Trong 4 giờ cuối, nút hủy sẽ khóa để chủ sân không mất khung giờ đã giữ, bạn gọi hotline 0262 399 8888 để được xử lý tay. Lỗi từ phía sân thì luôn hoàn 100%. Đơn đã hủy không thể khôi phục, bạn hủy trực tiếp trong mục "Đơn sắp tới" ở trang tài khoản.', '', '', 'published', 0, 4),
  ('faq-5', 'faq', 'Sân có cho thuê bóng, áo bib và vợt không?', '', 'Phần lớn sân tặng kèm bóng và lưới. Áo bib cho thuê 10.000đ/bộ, bơm bóng miễn phí. Sân cầu lông cho thuê vợt 20.000đ/cây và có bán ống cầu tại chỗ.', 'Phần lớn sân tặng kèm bóng và lưới. Áo bib cho thuê 10.000đ/bộ, bơm bóng miễn phí. Sân cầu lông cho thuê vợt 20.000đ/cây và có bán ống cầu tại chỗ.', '', '', 'published', 0, 5),
  ('faq-6', 'faq', 'Có chỗ gửi xe không? Thanh toán bằng cách nào?', '', 'Tất cả sân trong hệ thống đều có bãi giữ xe, phần lớn miễn phí cho khách đặt sân. Bạn có thể thanh toán tại sân bằng tiền mặt hoặc chuyển khoản theo mã đặt sân.', 'Tất cả sân trong hệ thống đều có bãi giữ xe, phần lớn miễn phí cho khách đặt sân. Bạn có thể thanh toán tại sân bằng tiền mặt hoặc chuyển khoản theo mã đặt sân.', '', '', 'published', 0, 6),
  ('banner-1', 'banner', 'Giờ vàng giảm 20% buổi sáng', 'gio-vang', 'Nhập mã GIOVANG khi đặt sân từ 05:00 đến 15:00 các ngày trong tuần.', '', 'https://readdy.ai/api/search-image?query=Wide%20shot%20of%20a%20floodlit%20artificial%20turf%20football%20pitch%20at%20night%20in%20a%20tropical%20Vietnamese%20city%2C%20deep%20green%20grass%2C%20white%20line%20markings%2C%20glowing%20stadium%20lights%2C%20dramatic%20dark%20sky%2C%20atmospheric%20haze%2C%20cinematic%20sports%20photography&width=1600&height=900&seq=bmt-hero-pitch-01&orientation=landscape', '/uu-dai', 'published', 1, 1),
  ('news-1', 'news', 'Khai trương cụm sân cầu lông Hòa Thắng Arena', 'khai-truong-hoa-thang-arena', '6 sân thảm tiêu chuẩn BWF, có điều hòa, mở cửa từ 05:00 đến 23:00.', 'Cụm sân cầu lông Hòa Thắng Arena chính thức tham gia hệ thống Đặt Sân BMT 24H.', '', '/san/cau-long-hoa-thang-arena', 'published', 0, 1),
  ('policy-1', 'policy', 'Chính sách hủy sân & hoàn cọc', 'chinh-sach-huy', 'Hủy trước 4 giờ hoàn 100% cọc; lỗi từ sân hoàn 100%.', 'Bạn chỉ có thể hủy và được hoàn 100% tiền cọc khi còn cách giờ chơi từ 4 giờ trở lên. Trong 4 giờ cuối, nút hủy sẽ khóa để chủ sân không mất khung giờ đã giữ, bạn gọi hotline 0262 399 8888 để được xử lý tay. Lỗi từ phía sân thì luôn hoàn 100%. Đơn đã hủy không thể khôi phục, bạn hủy trực tiếp trong mục "Đơn sắp tới" ở trang tài khoản.', '', '', 'published', 1, 1),
  ('news-2', 'news', 'Giải bóng đá phong trào BMT Cup 2026', 'bmt-cup-2026', 'Bản nháp thông báo giải đấu cuối năm.', '', '', '', 'draft', 0, 2);

INSERT INTO reports (id, target_type, target_id, target_label, reporter_name, reporter_contact, reason, detail, severity, status, created_at) VALUES
  ('rp-seed-1', 'review', 'rv-seed-07', 'Đánh giá của Phan Gia Bảo – Cầu lông Hòa Thắng Arena', 'Chủ sân Hòa Thắng Arena', '0905 000 111', 'Nội dung quảng cáo', 'Đánh giá chứa số điện thoại bán hàng, không liên quan tới sân.', 'high', 'resolved', NOW() - INTERVAL 2 DAY),
  ('rp-seed-2', 'court', 'c02', 'Sân bóng FC Đắk Lắk', 'Đỗ Quang Huy', 'huy.do@gmail.com', 'Thông tin giá chưa đúng', 'Giá niêm yết sân 7 trên web thấp hơn giá thu thực tế 30.000đ.', 'medium', 'open', NOW() - INTERVAL 1 DAY),
  ('rp-seed-3', 'booking', 'BMT20261103-174', 'Đơn BMT20261103-174', 'Nguyễn Văn Tâm', '0977 123 456', 'Không được hoàn cọc', 'Đơn đã hủy trước 6 tiếng nhưng chưa nhận lại tiền cọc.', 'high', 'reviewing', NOW() - INTERVAL 5 HOUR),
  ('rp-seed-4', 'account', '5', 'Tài khoản Lộc Sport', 'Khách ẩn danh', 'Chưa cung cấp', 'Chủ sân phản hồi thiếu lịch sự', 'Nhắn tin hỏi giá nhưng bị trả lời cộc lốc.', 'low', 'open', NOW() - INTERVAL 3 DAY);

INSERT INTO audit_logs (actor_id, actor_name, actor_role, module, action, target_label, detail, level, created_at) VALUES
  (1, 'Quản trị viên BMT', 'super_admin', 'accounts', 'Cấp quyền chủ sân', 'chusan2@bmt24h.vn', 'Đổi vai trò từ Khách hàng sang Chủ sân', 'success', NOW() - INTERVAL 6 DAY),
  (4, 'Lê Thu Hà', 'moderator', 'moderation', 'Ẩn đánh giá', 'Đánh giá của Phan Gia Bảo', 'Nội dung quảng cáo, vi phạm quy định', 'warning', NOW() - INTERVAL 2 DAY),
  (1, 'Quản trị viên BMT', 'super_admin', 'content', 'Xuất bản nội dung', 'Giờ vàng giảm 20% buổi sáng', 'Banner trang chủ', 'info', NOW() - INTERVAL 1 DAY);

INSERT INTO `owner_services` (`id`, `owner_id`, `name`, `category`, `unit`, `price`, `stock`, `active`, `sort_order`) VALUES
  ('sv-water', 2, 'Nước suối Aquafina 500ml', 'drink', 'chai', 10000, 120, 1, 0),
  ('sv-revive', 2, 'Revive chanh muối', 'drink', 'chai', 15000, 86, 1, 1),
  ('sv-sting', 2, 'Sting dâu', 'drink', 'chai', 12000, 4, 1, 2),
  ('sv-ball', 2, 'Thuê bóng thi đấu', 'rental', 'quả', 20000, 12, 1, 3),
  ('sv-bib', 2, 'Thuê áo bib', 'rental', 'bộ', 30000, 6, 1, 4),
  ('sv-racket', 2, 'Thuê vợt cầu lông', 'rental', 'cây', 25000, 8, 1, 5),
  ('sv-shuttle', 2, 'Hộp cầu lông (12 quả)', 'other', 'hộp', 65000, 15, 1, 6),
  ('sv-noodle', 2, 'Mì tôm trứng', 'food', 'tô', 25000, 3, 1, 7);
