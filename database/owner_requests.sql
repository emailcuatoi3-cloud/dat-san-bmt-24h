-- Bảng yêu cầu đăng ký làm chủ sân (chạy 1 lần trên CSDL đang dùng)
USE `datsan_bmt24h`;
CREATE TABLE IF NOT EXISTS owner_requests (
  id VARCHAR(40) PRIMARY KEY,
  user_id INT NOT NULL,
  business_name VARCHAR(160) NOT NULL,
  contact_name VARCHAR(120) NOT NULL DEFAULT '',
  phone VARCHAR(30) NOT NULL DEFAULT '',
  email VARCHAR(190) NOT NULL DEFAULT '',
  address VARCHAR(255) NOT NULL DEFAULT '',
  sports VARCHAR(40) NOT NULL DEFAULT 'football',
  court_count INT NOT NULL DEFAULT 1,
  note TEXT NULL,
  status ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
  admin_note VARCHAR(255) NOT NULL DEFAULT '',
  reviewed_by VARCHAR(120) NOT NULL DEFAULT '',
  reviewed_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY (user_id), KEY (status),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;