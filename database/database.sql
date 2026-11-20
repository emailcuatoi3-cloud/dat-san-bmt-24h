-- MySQL dump 10.13  Distrib 8.4.3, for Win64 (x86_64)
--
-- Host: localhost    Database: datsan_bmt24h
-- ------------------------------------------------------
-- Server version	8.4.3

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `admin_role_assignments`
--

DROP TABLE IF EXISTS `admin_role_assignments`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `admin_role_assignments` (
  `user_id` int NOT NULL,
  `role_key` varchar(40) COLLATE utf8mb4_unicode_ci NOT NULL,
  `assigned_by` varchar(160) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`user_id`),
  CONSTRAINT `admin_role_assignments_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `admin_role_assignments`
--

LOCK TABLES `admin_role_assignments` WRITE;
/*!40000 ALTER TABLE `admin_role_assignments` DISABLE KEYS */;
INSERT INTO `admin_role_assignments` VALUES (1,'super_admin','Hệ thống','2026-11-10 15:54:00'),(4,'moderator','Quản trị viên BMT','2026-11-10 15:54:00');
/*!40000 ALTER TABLE `admin_role_assignments` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `admin_roles`
--

DROP TABLE IF EXISTS `admin_roles`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `admin_roles` (
  `key` varchar(40) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(80) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `permissions` text COLLATE utf8mb4_unicode_ci COMMENT 'JSON: các module được phép',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `admin_roles`
--

LOCK TABLES `admin_roles` WRITE;
/*!40000 ALTER TABLE `admin_roles` DISABLE KEYS */;
INSERT INTO `admin_roles` VALUES ('content_editor','Biên tập nội dung','Quản lý banner, tin tức, FAQ, danh mục và khuyến mãi.','[\"overview\", \"categories\", \"content\", \"promotions\"]','2026-11-10 15:54:00'),('moderator','Kiểm duyệt viên','Kiểm duyệt đánh giá, xử lý báo cáo và đơn đặt sân.','[\"overview\", \"bookings\", \"moderation\", \"audit\"]','2026-11-10 15:54:00'),('super_admin','Quản trị cấp cao','Toàn quyền trên mọi module.','[\"overview\", \"accounts\", \"courts\", \"bookings\", \"invoices\", \"categories\", \"content\", \"moderation\", \"promotions\", \"audit\"]','2026-11-10 15:54:00'),('support','Hỗ trợ khách hàng','Tra cứu tài khoản, đơn đặt sân và hóa đơn.','[\"overview\", \"accounts\", \"bookings\", \"invoices\"]','2026-11-10 15:54:00');
/*!40000 ALTER TABLE `admin_roles` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `audit_logs`
--

DROP TABLE IF EXISTS `audit_logs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `audit_logs` (
  `id` int NOT NULL AUTO_INCREMENT,
  `actor_id` int DEFAULT NULL,
  `actor_name` varchar(160) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `actor_role` varchar(40) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `module` varchar(40) COLLATE utf8mb4_unicode_ci NOT NULL,
  `action` varchar(160) COLLATE utf8mb4_unicode_ci NOT NULL,
  `target_label` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `detail` varchar(500) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `level` enum('info','success','warning','danger') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'info',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=12 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `audit_logs`
--

LOCK TABLES `audit_logs` WRITE;
/*!40000 ALTER TABLE `audit_logs` DISABLE KEYS */;
INSERT INTO `audit_logs` VALUES (1,1,'Quản trị viên BMT','super_admin','accounts','Cấp quyền chủ sân','chusan2@bmt24h.vn','Đổi vai trò từ Khách hàng sang Chủ sân','success','2026-11-04 15:54:01'),(2,4,'Lê Thu Hà','moderator','moderation','Ẩn đánh giá','Đánh giá của Phan Gia Bảo','Nội dung quảng cáo, vi phạm quy định','warning','2026-11-08 15:54:01'),(3,1,'Quản trị viên BMT','super_admin','content','Xuất bản nội dung','Giờ vàng giảm 20% buổi sáng','Banner trang chủ','info','2026-11-09 15:54:01'),(4,1,'Quản trị viên BMT','super_admin','accounts','Xác thực Sudo Mode','admin@bmt24h.vn','Mở khóa phiên quản trị nhạy cảm thành công (15 phút)','info','2026-11-13 09:58:56'),(5,1,'Quản trị viên BMT','super_admin','accounts','Ghost Login (Đăng nhập danh nghĩa)','khach@bmt24h.vn','Quản trị viên Quản trị viên BMT bắt đầu phiên giả lập tài khoản ID 3','warning','2026-11-13 09:59:04'),(6,1,'Quản trị viên BMT','super_admin','accounts','Ghost Login (Đăng nhập danh nghĩa)','chusan@bmt24h.vn','Quản trị viên Quản trị viên BMT bắt đầu phiên giả lập tài khoản ID 2','warning','2026-11-13 09:59:12'),(7,1,'Quản trị viên BMT','super_admin','accounts','Tạo tài khoản mới','coder_pro@bmt24h.vn','Tạo tài khoản Coder Chuyên Nghiệp ()','success','2026-11-13 10:07:10'),(8,1,'Quản trị viên BMT','super_admin','accounts','Cập nhật tài khoản','coder_pro@bmt24h.vn','Chỉnh sửa thông tin Coder Chuyên Nghiệp (Đã Sửa) (#6)','info','2026-11-13 10:07:27'),(9,1,'Quản trị viên BMT','super_admin','accounts','Xóa tài khoản','coder_pro@bmt24h.vn','Đã xóa vĩnh viễn tài khoản Coder Chuyên Nghiệp (Đã Sửa) (#6)','danger','2026-11-13 10:07:34'),(10,1,'Quản trị viên BMT','super_admin','accounts','Xác thực Sudo Mode','admin@bmt24h.vn','Mở khóa phiên quản trị nhạy cảm thành công (15 phút)','info','2026-11-20 14:33:12'),(11,1,'Quản trị viên BMT','super_admin','accounts','Ghost Login (Đăng nhập danh nghĩa)','kiemduyet@bmt24h.vn','Quản trị viên Quản trị viên BMT bắt đầu phiên giả lập tài khoản ID 4','warning','2026-11-20 14:33:13');
/*!40000 ALTER TABLE `audit_logs` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `blocked_slots`
--

DROP TABLE IF EXISTS `blocked_slots`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `blocked_slots` (
  `id` int NOT NULL AUTO_INCREMENT,
  `court_id` varchar(40) COLLATE utf8mb4_unicode_ci NOT NULL,
  `block_date` date NOT NULL,
  `slot` varchar(5) COLLATE utf8mb4_unicode_ci NOT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_slot` (`court_id`,`block_date`,`slot`),
  CONSTRAINT `blocked_slots_ibfk_1` FOREIGN KEY (`court_id`) REFERENCES `courts` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=8 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `blocked_slots`
--

LOCK TABLES `blocked_slots` WRITE;
/*!40000 ALTER TABLE `blocked_slots` DISABLE KEYS */;
INSERT INTO `blocked_slots` VALUES (1,'c01','2026-11-11','06:00','2026-11-10 15:54:00'),(2,'c01','2026-11-11','07:00','2026-11-10 15:54:00'),(3,'c10','2026-11-12','12:00','2026-11-10 15:54:00'),(4,'c06','2026-11-10','22:00','2026-11-10 15:54:00'),(5,'c01','2026-11-21','11:00','2026-11-20 15:29:17'),(6,'c01','2026-11-21','12:00','2026-11-20 15:29:17'),(7,'c10','2026-11-22','12:00','2026-11-20 15:29:17');
/*!40000 ALTER TABLE `blocked_slots` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `bookings`
--

DROP TABLE IF EXISTS `bookings`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `bookings` (
  `id` varchar(40) COLLATE utf8mb4_unicode_ci NOT NULL,
  `code` varchar(40) COLLATE utf8mb4_unicode_ci NOT NULL,
  `source` enum('online','owner') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'online' COMMENT 'online = khách đặt trên web; owner = chủ sân nhập',
  `court_id` varchar(40) COLLATE utf8mb4_unicode_ci NOT NULL,
  `court_name` varchar(160) COLLATE utf8mb4_unicode_ci NOT NULL,
  `sport` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'football',
  `area` varchar(80) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `image` varchar(600) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `customer_id` int DEFAULT NULL,
  `customer_name` varchar(120) COLLATE utf8mb4_unicode_ci NOT NULL,
  `customer_phone` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `customer_email` varchar(190) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `booking_date` date NOT NULL,
  `start_slot` varchar(5) COLLATE utf8mb4_unicode_ci NOT NULL,
  `duration_minutes` int NOT NULL DEFAULT '60',
  `slots` text COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'JSON: các khung giờ',
  `unit_price` int NOT NULL DEFAULT '0',
  `base_total` int NOT NULL DEFAULT '0' COMMENT 'Tổng trước giảm giá',
  `discount_amount` int NOT NULL DEFAULT '0',
  `promo_code` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `total_price` int NOT NULL DEFAULT '0',
  `deposit_amount` int NOT NULL DEFAULT '0',
  `extras` text COLLATE utf8mb4_unicode_ci COMMENT 'JSON: dịch vụ thêm',
  `payment_method` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'vietqr',
  `payment_status` enum('unpaid','deposit_claimed','deposit_paid','paid','refunded') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'unpaid',
  `payment_label` varchar(160) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Ghi chú thanh toán của đơn chủ sân nhập',
  `status` enum('pending','confirmed','cancelled','completed') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'pending',
  `approved_at` datetime DEFAULT NULL,
  `reject_reason` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `cancel_reason` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `hold_expires_at` datetime DEFAULT NULL,
  `checked_in_at` datetime DEFAULT NULL,
  `note` text COLLATE utf8mb4_unicode_ci,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `code` (`code`),
  KEY `idx_court_date` (`court_id`,`booking_date`),
  KEY `idx_customer` (`customer_id`),
  KEY `idx_phone` (`customer_phone`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `bookings`
--

LOCK TABLES `bookings` WRITE;
/*!40000 ALTER TABLE `bookings` DISABLE KEYS */;
INSERT INTO `bookings` VALUES ('cb-b01','BMT20261106-142','online','c01','Sân bóng BMT Arena','football','Tân Lợi','https://readdy.ai/api/search-image?query=Modern%20artificial%20grass%20five%20a%20side%20football%20pitch%20under%20bright%20floodlights%20at%20night%2C%20vivid%20green%20turf%2C%20white%20line%20markings%2C%20green%20net%20fence%2C%20clean%20sports%20photography%2C%20no%20people&width=1000&height=700&seq=bmt-court-fb-01a&orientation=landscape',3,'Nguyễn Minh Quân','0912 345 678','minhquan.nguyen@gmail.com','2026-11-10','18:00',120,'[\"18:00\", \"19:00\"]',180000,360000,0,NULL,360000,108000,NULL,'vietqr','deposit_paid',NULL,'completed',NULL,NULL,NULL,NULL,NULL,'Đội mình 10 người, cần thuê thêm 2 bộ áo bib.','2026-11-06 09:00:00','2026-11-13 09:33:58'),('cb-b02','BMT20261109-318','online','c10','Cầu lông Victory BMT','badminton','Thành Công','https://readdy.ai/api/search-image?query=Premium%20indoor%20badminton%20club%20with%20eight%20green%20BWF%20mats%2C%20very%20high%20ceiling%2C%20professional%20sports%20lighting%2C%20modern%20interior%20design%2C%20wide%20architectural%20shot%2C%20no%20people&width=1000&height=700&seq=bmt-court-bd-04a&orientation=landscape',3,'Nguyễn Minh Quân','0912 345 678','minhquan.nguyen@gmail.com','2026-11-13','19:00',60,'[\"19:00\"]',100000,100000,0,NULL,100000,30000,NULL,'vietqr','unpaid',NULL,'completed',NULL,NULL,NULL,NULL,NULL,'Nhóm 4 người, cần thuê 2 vợt.','2026-11-07 09:00:00','2026-11-17 22:11:44'),('cb-b03','BMT20261114-075','online','c04','Sân bóng Tân Thành','football','Tân Thành','https://readdy.ai/api/search-image?query=Seven%20a%20side%20football%20field%20with%20high%20ball%20netting%20around%20the%20pitch%2C%20evening%20floodlights%2C%20green%20turf%2C%20clean%20urban%20sports%20facility%2C%20no%20people&width=1000&height=700&seq=bmt-court-fb-04a&orientation=landscape',3,'Nguyễn Minh Quân','0912 345 678','minhquan.nguyen@gmail.com','2026-11-18','17:00',120,'[\"17:00\", \"18:00\"]',250000,500000,0,NULL,500000,150000,NULL,'vietqr','deposit_paid',NULL,'completed',NULL,NULL,NULL,NULL,NULL,'Trận giao hữu với FC Ea Tam.','2026-11-05 09:00:00','2026-11-19 14:16:21'),('cb-b04','BMT20261030-204','online','c06','Sân bóng Thắng Lợi','football','Thắng Lợi','https://readdy.ai/api/search-image?query=Premium%20five%20a%20side%20football%20court%20illuminated%20at%20night%2C%20lush%20green%20turf%2C%20glowing%20floodlights%2C%20modern%20clubhouse%20building%20beside%20the%20pitch%2C%20cinematic%20sports%20photography%2C%20no%20people&width=1000&height=700&seq=bmt-court-fb-06a&orientation=landscape',3,'Nguyễn Minh Quân','0912 345 678','minhquan.nguyen@gmail.com','2026-11-03','20:00',120,'[\"20:00\", \"21:00\"]',200000,400000,0,NULL,400000,120000,NULL,'vietqr','paid',NULL,'completed',NULL,NULL,NULL,NULL,NULL,'Đá xong thanh toán tiền mặt tại quầy.','2026-10-31 09:00:00','2026-11-10 15:54:00'),('cb-b05','BMT20261022-119','online','c07','Nhà thi đấu Cầu lông Buôn Ma Thuột','badminton','Tân Lợi','https://readdy.ai/api/search-image?query=Indoor%20badminton%20hall%20with%20several%20courts%2C%20green%20court%20mats%2C%20high%20ceiling%20and%20bright%20even%20lighting%2C%20clean%20modern%20sports%20facility%2C%20wide%20angle%2C%20no%20people&width=1000&height=700&seq=bmt-court-bd-01a&orientation=landscape',3,'Nguyễn Minh Quân','0912 345 678','minhquan.nguyen@gmail.com','2026-10-26','06:00',120,'[\"06:00\", \"07:00\"]',90000,180000,0,NULL,180000,54000,NULL,'vietqr','paid',NULL,'completed',NULL,NULL,NULL,NULL,NULL,'Chơi buổi sáng cùng nhóm Phố Núi.','2026-10-24 09:00:00','2026-11-10 15:54:00'),('cb-b06','BMT20261015-060','online','c02','Sân bóng FC Đắk Lắk','football','Tân An','https://readdy.ai/api/search-image?query=Full%20size%20eleven%20a%20side%20football%20pitch%20with%20green%20artificial%20turf%20and%20small%20spectator%20stand%2C%20evening%20sky%2C%20floodlight%20towers%2C%20clean%20highway%20fence%2C%20professional%20sports%20venue%20photography%2C%20no%20people&width=1000&height=700&seq=bmt-court-fb-02a&orientation=landscape',3,'Nguyễn Minh Quân','0912 345 678','minhquan.nguyen@gmail.com','2026-10-19','19:00',60,'[\"19:00\"]',350000,350000,0,NULL,350000,105000,NULL,'vietqr','unpaid',NULL,'cancelled',NULL,NULL,'Bận việc gia đình, không thể ra sân.',NULL,NULL,'Đặt sân 7 người cho đội công ty.','2026-10-16 09:00:00','2026-11-10 15:54:00'),('cb-b07','BMT20260928-233','online','c08','Cầu lông Tân An Smash','badminton','Tân An','https://readdy.ai/api/search-image?query=Clean%20indoor%20badminton%20courts%20with%20PVC%20floor%20mats%20in%20a%20simple%20sports%20hall%2C%20white%20net%20dividers%2C%20bright%20ceiling%20lights%2C%20no%20people&width=1000&height=700&seq=bmt-court-bd-02a&orientation=landscape',3,'Nguyễn Minh Quân','0912 345 678','minhquan.nguyen@gmail.com','2026-10-02','18:00',60,'[\"18:00\"]',70000,70000,0,NULL,70000,21000,NULL,'vietqr','paid',NULL,'completed',NULL,NULL,NULL,NULL,NULL,NULL,'2026-09-29 09:00:00','2026-11-10 15:54:00'),('cb-b08','BMT20260912-087','online','c03','Sân bóng Hòa Thắng','football','Hòa Thắng','https://readdy.ai/api/search-image?query=Compact%20neighborhood%20five%20a%20side%20football%20court%20with%20green%20turf%20surrounded%20by%20tropical%20trees%2C%20warm%20late%20afternoon%20sunlight%2C%20simple%20fence%2C%20friendly%20local%20sports%20setting%2C%20no%20people&width=1000&height=700&seq=bmt-court-fb-03a&orientation=landscape',3,'Nguyễn Minh Quân','0912 345 678','minhquan.nguyen@gmail.com','2026-09-16','07:00',120,'[\"07:00\", \"08:00\"]',150000,300000,0,NULL,300000,90000,NULL,'vietqr','paid',NULL,'completed',NULL,NULL,NULL,NULL,NULL,'Đá buổi sáng cuối tuần cùng anh em trong xóm.','2026-09-13 09:00:00','2026-11-10 15:54:00'),('ob-future-01','BMT20261121-011','online','c01','Sân bóng BMT Arena','football','Tân Lợi','https://readdy.ai/api/search-image?query=Modern%20artificial%20grass%20five%20a%20side%20football%20pitch%20under%20bright%20floodlights%20at%20night%2C%20vivid%20green%20turf%2C%20white%20line%20markings%2C%20green%20net%20fence%2C%20clean%20sports%20photography%2C%20no%20people&width=1000&height=700&seq=bmt-court-fb-01a&orientation=landscape',9,'Hoàng Minh Đức','0905 123 456','duc.hm@gmail.com','2026-11-21','17:30',90,'[\"17:30\",\"18:30\"]',240000,360000,0,NULL,360000,120000,NULL,'vietqr','deposit_paid','Đã cọc 120.000đ · VietQR','confirmed','2026-11-20 10:00:00',NULL,NULL,NULL,NULL,'Đã xác nhận cọc, khách chuẩn bị đá chiều Thứ Bảy.','2026-11-20 09:45:00','2026-11-20 15:29:17'),('ob-future-02','BMT20261121-012','online','c10','Cầu lông Victory BMT','badminton','Thành Công','https://readdy.ai/api/search-image?query=Modern%20indoor%20badminton%20court%20with%20green%20mat%20flooring%2C%20crisp%20white%20line%20markings%2C%20taut%20net%2C%20bright%20LED%20ceiling%20lights%2C%20clean%20sports%20facility%2C%20no%20people&width=1000&height=700&seq=bmt-court-bm-02a&orientation=landscape',10,'Trần Thanh Tùng','0913 888 999','tung.tt@gmail.com','2026-11-21','19:00',60,'[\"19:00\"]',130000,130000,13000,'VICTORY10',117000,40000,NULL,'vietqr','deposit_paid','Đã cọc 40.000đ · VietQR','confirmed','2026-11-20 11:00:00',NULL,NULL,NULL,NULL,'Giao lưu cầu lông tối Thứ Bảy.','2026-11-20 10:30:00','2026-11-20 15:29:17'),('ob-future-03','BMT20261122-021','online','c06','Sân bóng Tân An','football','Tân An','https://readdy.ai/api/search-image?query=Lush%20green%20mini%20football%20field%20at%20sunset%20with%20warm%20golden%20light%2C%20neat%20artificial%20turf%2C%20clean%20sidelines%2C%20serene%20sports%20environment%2C%20no%20people&width=1000&height=700&seq=bmt-court-fb-06a&orientation=landscape',12,'Bùi Văn Khoa','0912 774 019','khoa.bv@gmail.com','2026-11-22','16:00',90,'[\"16:00\",\"17:00\"]',200000,300000,0,NULL,300000,100000,NULL,'vietqr','deposit_paid','Đã cọc 100.000đ · VietQR','confirmed','2026-11-20 12:00:00',NULL,NULL,NULL,NULL,'Đá giao lưu Chủ Nhật.','2026-11-20 11:20:00','2026-11-20 15:29:17'),('ob-future-04','BMT20261122-022','online','c05','Sân bóng Ea Tam Sport','football','Ea Tam','https://readdy.ai/api/search-image?query=Artificial%20grass%20football%20court%20at%20night%20with%20bright%20white%20floodlights%2C%20green%20turf%2C%20industrial%20area%20in%20the%20background%2C%20atmospheric%20sports%20photography%2C%20no%20people&width=1000&height=700&seq=bmt-court-fb-05a&orientation=landscape',11,'Lê Phương Mai','0932 777 666','mai.lp@gmail.com','2026-11-22','18:00',60,'[\"18:00\"]',200000,200000,0,NULL,200000,0,NULL,'vietqr','unpaid','Chờ duyệt','pending',NULL,NULL,NULL,NULL,NULL,'Đơn đặt lịch cuối tuần chờ duyệt.','2026-11-20 13:40:00','2026-11-20 15:29:17'),('ob-ob1','BMT20261106-149','owner','c01','Sân bóng BMT Arena','football','Tân Lợi','https://readdy.ai/api/search-image?query=Modern%20artificial%20grass%20five%20a%20side%20football%20pitch%20under%20bright%20floodlights%20at%20night%2C%20vivid%20green%20turf%2C%20white%20line%20markings%2C%20green%20net%20fence%2C%20clean%20sports%20photography%2C%20no%20people&width=1000&height=700&seq=bmt-court-fb-01a&orientation=landscape',NULL,'Nguyễn Minh Quân','0912 345 678','minhquan.nguyen@gmail.com','2026-11-10','18:00',120,'[\"18:00\", \"19:00\"]',200000,400000,0,NULL,400000,0,NULL,'cash','unpaid','Thanh toán tại sân','pending',NULL,NULL,NULL,NULL,NULL,'Đội mình 10 người, cần thuê thêm 2 bộ áo bib.','2026-11-06 08:00:00','2026-11-10 15:54:00'),('ob-ob10','BMT20261031-011','owner','c10','Cầu lông Victory BMT','badminton','Thành Công','https://readdy.ai/api/search-image?query=Premium%20indoor%20badminton%20club%20with%20eight%20green%20BWF%20mats%2C%20very%20high%20ceiling%2C%20professional%20sports%20lighting%2C%20modern%20interior%20design%2C%20wide%20architectural%20shot%2C%20no%20people&width=1000&height=700&seq=bmt-court-bd-04a&orientation=landscape',NULL,'Lý Thanh Tùng','0932 118 640','thanhtung.ly@gmail.com','2026-11-04','06:00',120,'[\"06:00\", \"07:00\"]',100000,200000,0,NULL,200000,0,NULL,'cash','paid','Đã thu đủ · Chuyển khoản','completed',NULL,NULL,NULL,NULL,NULL,'Nhóm chơi buổi sáng, đã hoàn tất.','2026-11-01 08:00:00','2026-11-10 15:54:00'),('ob-ob11','BMT20261103-174','owner','c01','Sân bóng BMT Arena','football','Tân Lợi','https://readdy.ai/api/search-image?query=Modern%20artificial%20grass%20five%20a%20side%20football%20pitch%20under%20bright%20floodlights%20at%20night%2C%20vivid%20green%20turf%2C%20white%20line%20markings%2C%20green%20net%20fence%2C%20clean%20sports%20photography%2C%20no%20people&width=1000&height=700&seq=bmt-court-fb-01a&orientation=landscape',NULL,'Trịnh Bảo Châu','0987 220 913','baochau.trinh@gmail.com','2026-11-07','21:00',60,'[\"21:00\"]',220000,220000,0,NULL,220000,0,NULL,'cash','unpaid','Thanh toán tại sân','cancelled',NULL,'Khách chủ động hủy trước 8 giờ, đã mở lại khung giờ.',NULL,NULL,NULL,'Khách báo bận đột xuất.','2026-11-04 08:00:00','2026-11-10 15:54:00'),('ob-ob12','BMT20261029-063','owner','c05','Sân bóng Ea Tam Sport','football','Ea Tam','https://readdy.ai/api/search-image?query=Artificial%20grass%20football%20court%20at%20night%20with%20bright%20white%20floodlights%2C%20green%20turf%2C%20industrial%20area%20in%20the%20background%2C%20atmospheric%20sports%20photography%2C%20no%20people&width=1000&height=700&seq=bmt-court-fb-05a&orientation=landscape',NULL,'Ngô Quốc Việt','0918 300 442','quocviet.ngo@gmail.com','2026-11-02','18:00',120,'[\"18:00\", \"19:00\"]',190000,380000,0,NULL,380000,0,NULL,'cash','paid','Đã thu đủ · Tiền mặt','completed',NULL,NULL,NULL,NULL,NULL,NULL,'2026-10-30 08:00:00','2026-11-10 15:54:00'),('ob-ob2','BMT20261105-206','owner','c10','Cầu lông Victory BMT','badminton','Thành Công','https://readdy.ai/api/search-image?query=Premium%20indoor%20badminton%20club%20with%20eight%20green%20BWF%20mats%2C%20very%20high%20ceiling%2C%20professional%20sports%20lighting%2C%20modern%20interior%20design%2C%20wide%20architectural%20shot%2C%20no%20people&width=1000&height=700&seq=bmt-court-bd-04a&orientation=landscape',NULL,'Lê Hoàng Nam','0905 112 334','hoangnam.le@gmail.com','2026-11-09','19:00',60,'[\"19:00\"]',130000,130000,0,NULL,130000,0,NULL,'cash','paid','Đã thu đủ · Chuyển khoản','pending',NULL,NULL,NULL,NULL,NULL,'Nhóm 4 người, cần thuê 2 vợt và 1 hộp cầu.','2026-11-07 08:00:00','2026-11-10 15:54:00'),('ob-ob3','BMT20261107-118','owner','c06','Sân bóng Thắng Lợi','football','Thắng Lợi','https://readdy.ai/api/search-image?query=Premium%20five%20a%20side%20football%20court%20illuminated%20at%20night%2C%20lush%20green%20turf%2C%20glowing%20floodlights%2C%20modern%20clubhouse%20building%20beside%20the%20pitch%2C%20cinematic%20sports%20photography%2C%20no%20people&width=1000&height=700&seq=bmt-court-fb-06a&orientation=landscape',NULL,'Phạm Anh Tuấn','0977 664 512','anhtuan.pham@gmail.com','2026-11-11','20:00',120,'[\"20:00\", \"21:00\"]',250000,500000,0,NULL,500000,0,NULL,'cash','unpaid','Thanh toán tại sân','pending',NULL,NULL,NULL,NULL,NULL,'Trận giao hữu giữa FC Ea Tam và FC Tân Lợi.','2026-11-07 08:00:00','2026-11-10 15:54:00'),('ob-ob4','BMT20261108-091','owner','c05','Sân bóng Ea Tam Sport','football','Ea Tam','https://readdy.ai/api/search-image?query=Artificial%20grass%20football%20court%20at%20night%20with%20bright%20white%20floodlights%2C%20green%20turf%2C%20industrial%20area%20in%20the%20background%2C%20atmospheric%20sports%20photography%2C%20no%20people&width=1000&height=700&seq=bmt-court-fb-05a&orientation=landscape',NULL,'Đỗ Thị Mai','0938 220 774','thimai.do@gmail.com','2026-11-12','17:00',60,'[\"17:00\"]',160000,160000,0,NULL,160000,0,NULL,'cash','unpaid','Thanh toán tại sân','pending',NULL,NULL,NULL,NULL,NULL,'Nhóm công nhân khu Ea Tam, đá sau giờ tan ca.','2026-11-08 08:00:00','2026-11-10 15:54:00'),('ob-ob5','BMT20261106-233','owner','c10','Cầu lông Victory BMT','badminton','Thành Công','https://readdy.ai/api/search-image?query=Premium%20indoor%20badminton%20club%20with%20eight%20green%20BWF%20mats%2C%20very%20high%20ceiling%2C%20professional%20sports%20lighting%2C%20modern%20interior%20design%2C%20wide%20architectural%20shot%2C%20no%20people&width=1000&height=700&seq=bmt-court-bd-04a&orientation=landscape',NULL,'Trần Thu Hà','0913 887 265','thuha.tran@gmail.com','2026-11-10','17:00',120,'[\"17:00\", \"18:00\"]',130000,260000,0,NULL,260000,0,NULL,'cash','paid','Đã thu đủ · Chuyển khoản','completed',NULL,NULL,NULL,NULL,NULL,'Nhóm cầu lông Phố Núi, chơi cố định thứ Sáu.','2026-11-05 08:00:00','2026-11-13 09:33:58'),('ob-ob6','BMT20261109-325','owner','c10','Cầu lông Victory BMT','badminton','Thành Công','https://readdy.ai/api/search-image?query=Premium%20indoor%20badminton%20club%20with%20eight%20green%20BWF%20mats%2C%20very%20high%20ceiling%2C%20professional%20sports%20lighting%2C%20modern%20interior%20design%2C%20wide%20architectural%20shot%2C%20no%20people&width=1000&height=700&seq=bmt-court-bd-04a&orientation=landscape',NULL,'Nguyễn Minh Quân','0912 345 678','minhquan.nguyen@gmail.com','2026-11-13','19:00',60,'[\"19:00\"]',130000,130000,0,NULL,130000,0,NULL,'cash','paid','Đã thu đủ · Chuyển khoản','completed',NULL,NULL,NULL,NULL,NULL,'Nhóm 4 người, cần thuê 2 vợt.','2026-11-07 08:00:00','2026-11-16 17:21:50'),('ob-ob7','BMT20261110-147','owner','c01','Sân bóng BMT Arena','football','Tân Lợi','https://readdy.ai/api/search-image?query=Modern%20artificial%20grass%20five%20a%20side%20football%20pitch%20under%20bright%20floodlights%20at%20night%2C%20vivid%20green%20turf%2C%20white%20line%20markings%2C%20green%20net%20fence%2C%20clean%20sports%20photography%2C%20no%20people&width=1000&height=700&seq=bmt-court-fb-01a&orientation=landscape',NULL,'Vũ Đức Thành','0966 431 208','ducthanh.vu@gmail.com','2026-11-14','18:00',180,'[\"18:00\", \"19:00\", \"20:00\"]',220000,660000,0,NULL,660000,0,NULL,'cash','paid','Đã thu đủ · Chuyển khoản','completed',NULL,NULL,NULL,NULL,NULL,'Giải nội bộ công ty, cần kẻ sân và bơm 3 quả bóng.','2026-11-06 08:00:00','2026-11-16 17:21:50'),('ob-ob8','BMT20261102-055','owner','c01','Sân bóng BMT Arena','football','Tân Lợi','https://readdy.ai/api/search-image?query=Modern%20artificial%20grass%20five%20a%20side%20football%20pitch%20under%20bright%20floodlights%20at%20night%2C%20vivid%20green%20turf%2C%20white%20line%20markings%2C%20green%20net%20fence%2C%20clean%20sports%20photography%2C%20no%20people&width=1000&height=700&seq=bmt-court-fb-01a&orientation=landscape',NULL,'Bùi Văn Khoa','0912 774 019','vankhoa.bui@gmail.com','2026-11-06','19:00',120,'[\"19:00\", \"20:00\"]',220000,440000,0,NULL,440000,0,NULL,'cash','paid','Đã thu đủ · Tiền mặt','completed',NULL,NULL,NULL,NULL,NULL,'Thanh toán tiền mặt tại quầy, đã thu đủ.','2026-11-03 08:00:00','2026-11-10 15:54:00'),('ob-ob9','BMT20261101-082','owner','c06','Sân bóng Thắng Lợi','football','Thắng Lợi','https://readdy.ai/api/search-image?query=Premium%20five%20a%20side%20football%20court%20illuminated%20at%20night%2C%20lush%20green%20turf%2C%20glowing%20floodlights%2C%20modern%20clubhouse%20building%20beside%20the%20pitch%2C%20cinematic%20sports%20photography%2C%20no%20people&width=1000&height=700&seq=bmt-court-fb-06a&orientation=landscape',NULL,'Hoàng Nhật Minh','0904 552 881','nhatminh.hoang@gmail.com','2026-11-05','17:00',60,'[\"17:00\"]',200000,200000,0,NULL,200000,0,NULL,'cash','paid','Đã thu đủ · Tiền mặt','completed',NULL,NULL,NULL,NULL,NULL,NULL,'2026-11-02 08:00:00','2026-11-10 15:54:00'),('ob-past-15a','BMT20261115-051','online','c01','Sân bóng BMT Arena','football','Tân Lợi','https://readdy.ai/api/search-image?query=Modern%20artificial%20grass%20five%20a%20side%20football%20pitch%20under%20bright%20floodlights%20at%20night%2C%20vivid%20green%20turf%2C%20white%20line%20markings%2C%20green%20net%20fence%2C%20clean%20sports%20photography%2C%20no%20people&width=1000&height=700&seq=bmt-court-fb-01a&orientation=landscape',10,'Trần Thanh Tùng','0913 888 999','tung.tt@gmail.com','2026-11-15','18:00',120,'[\"18:00\",\"19:00\"]',240000,480000,0,NULL,480000,150000,NULL,'vietqr','paid','Đã thanh toán đủ · VietQR','completed','2026-11-15 10:00:00',NULL,NULL,NULL,'2026-11-15 17:55:00','Đã hoàn thành lượt chơi ngày 15/11.','2026-11-14 16:00:00','2026-11-20 15:29:17'),('ob-past-15b','BMT20261115-052','owner','c10','Cầu lông Victory BMT','badminton','Thành Công','https://readdy.ai/api/search-image?query=Modern%20indoor%20badminton%20court%20with%20green%20mat%20flooring%2C%20crisp%20white%20line%20markings%2C%20taut%20net%2C%20bright%20LED%20ceiling%20lights%2C%20clean%20sports%20facility%2C%20no%20people&width=1000&height=700&seq=bmt-court-bm-02a&orientation=landscape',NULL,'Nguyễn Minh Tuấn','0935 444 333',NULL,'2026-11-15','19:00',60,'[\"19:00\"]',130000,130000,0,NULL,130000,0,NULL,'cash','paid','Đã thu đủ · Tiền mặt','completed','2026-11-15 19:00:00',NULL,NULL,NULL,'2026-11-15 19:00:00','Đã thu đủ tiền mặt tại quầy.','2026-11-15 19:00:00','2026-11-20 15:29:17'),('ob-past-16a','BMT20261116-061','online','c06','Sân bóng Tân An','football','Tân An','https://readdy.ai/api/search-image?query=Lush%20green%20mini%20football%20field%20at%20sunset%20with%20warm%20golden%20light%2C%20neat%20artificial%20turf%2C%20clean%20sidelines%2C%20serene%20sports%20environment%2C%20no%20people&width=1000&height=700&seq=bmt-court-fb-06a&orientation=landscape',12,'Bùi Văn Khoa','0912 774 019','khoa.bv@gmail.com','2026-11-16','17:30',90,'[\"17:30\",\"18:30\"]',200000,300000,0,NULL,300000,100000,NULL,'vietqr','paid','Đã thanh toán đủ · VietQR','completed','2026-11-16 11:00:00',NULL,NULL,NULL,'2026-11-16 17:25:00','Đã hoàn thành trận đấu.','2026-11-15 18:00:00','2026-11-20 15:29:17'),('ob-past-17a','BMT20261117-071','online','c01','Sân bóng BMT Arena','football','Tân Lợi','https://readdy.ai/api/search-image?query=Modern%20artificial%20grass%20five%20a%20side%20football%20pitch%20under%20bright%20floodlights%20at%20night%2C%20vivid%20green%20turf%2C%20white%20line%20markings%2C%20green%20net%20fence%2C%20clean%20sports%20photography%2C%20no%20people&width=1000&height=700&seq=bmt-court-fb-01a&orientation=landscape',9,'Hoàng Minh Đức','0905 123 456','duc.hm@gmail.com','2026-11-17','18:00',90,'[\"18:00\",\"19:00\"]',240000,360000,30000,'BMT30K',330000,110000,NULL,'vietqr','paid','Đã thanh toán đủ · VietQR','completed','2026-11-17 12:00:00',NULL,NULL,NULL,'2026-11-17 17:50:00','Đã hoàn thành.','2026-11-16 19:00:00','2026-11-20 15:29:17'),('ob-past-17b','BMT20261117-072','online','c10','Cầu lông Victory BMT','badminton','Thành Công','https://readdy.ai/api/search-image?query=Modern%20indoor%20badminton%20court%20with%20green%20mat%20flooring%2C%20crisp%20white%20line%20markings%2C%20taut%20net%2C%20bright%20LED%20ceiling%20lights%2C%20clean%20sports%20facility%2C%20no%20people&width=1000&height=700&seq=bmt-court-bm-02a&orientation=landscape',11,'Lê Phương Mai','0932 777 666','mai.lp@gmail.com','2026-11-17','19:00',60,'[\"19:00\"]',130000,130000,0,NULL,130000,40000,NULL,'vietqr','paid','Đã thanh toán đủ · VietQR','completed','2026-11-17 14:00:00',NULL,NULL,NULL,'2026-11-17 18:55:00','Đã hoàn thành.','2026-11-17 10:00:00','2026-11-20 15:29:17'),('ob-past-18a','BMT20261118-081','online','c05','Sân bóng Ea Tam Sport','football','Ea Tam','https://readdy.ai/api/search-image?query=Artificial%20grass%20football%20court%20at%20night%20with%20bright%20white%20floodlights%2C%20green%20turf%2C%20industrial%20area%20in%20the%20background%2C%20atmospheric%20sports%20photography%2C%20no%20people&width=1000&height=700&seq=bmt-court-fb-05a&orientation=landscape',12,'Bùi Văn Khoa','0912 774 019','khoa.bv@gmail.com','2026-11-18','17:30',90,'[\"17:30\",\"18:30\"]',200000,300000,0,NULL,300000,90000,NULL,'cash','paid','Đã thu đủ · Tiền mặt','completed','2026-11-18 10:00:00',NULL,NULL,NULL,'2026-11-18 17:25:00','Đã hoàn thành.','2026-11-17 19:30:00','2026-11-20 15:29:17'),('ob-past-19a','BMT20261119-091','online','c01','Sân bóng BMT Arena','football','Tân Lợi','https://readdy.ai/api/search-image?query=Modern%20artificial%20grass%20five%20a%20side%20football%20pitch%20under%20bright%20floodlights%20at%20night%2C%20vivid%20green%20turf%2C%20white%20line%20markings%2C%20green%20net%20fence%2C%20clean%20sports%20photography%2C%20no%20people&width=1000&height=700&seq=bmt-court-fb-01a&orientation=landscape',10,'Trần Thanh Tùng','0913 888 999','tung.tt@gmail.com','2026-11-19','18:30',90,'[\"18:30\",\"19:30\"]',240000,360000,0,NULL,360000,120000,NULL,'vietqr','paid','Đã thanh toán đủ · VietQR','completed','2026-11-19 12:00:00',NULL,NULL,NULL,'2026-11-19 18:25:00','Đã hoàn thành.','2026-11-18 19:00:00','2026-11-20 15:29:17'),('ob-past-19b','BMT20261119-092','online','c10','Cầu lông Victory BMT','badminton','Thành Công','https://readdy.ai/api/search-image?query=Modern%20indoor%20badminton%20court%20with%20green%20mat%20flooring%2C%20crisp%20white%20line%20markings%2C%20taut%20net%2C%20bright%20LED%20ceiling%20lights%2C%20clean%20sports%20facility%2C%20no%20people&width=1000&height=700&seq=bmt-court-bm-02a&orientation=landscape',9,'Hoàng Minh Đức','0905 123 456','duc.hm@gmail.com','2026-11-19','20:00',60,'[\"20:00\"]',130000,130000,0,NULL,130000,40000,NULL,'vietqr','paid','Đã thanh toán đủ · VietQR','completed','2026-11-19 15:00:00',NULL,NULL,NULL,'2026-11-19 19:55:00','Đã hoàn thành.','2026-11-19 14:00:00','2026-11-20 15:29:17'),('ob-today-01','BMT20261120-001','online','c01','Sân bóng BMT Arena','football','Tân Lợi','https://readdy.ai/api/search-image?query=Modern%20artificial%20grass%20five%20a%20side%20football%20pitch%20under%20bright%20floodlights%20at%20night%2C%20vivid%20green%20turf%2C%20white%20line%20markings%2C%20green%20net%20fence%2C%20clean%20sports%20photography%2C%20no%20people&width=1000&height=700&seq=bmt-court-fb-01a&orientation=landscape',10,'Trần Thanh Tùng','0913 888 999','tung.tt@gmail.com','2026-11-20','17:00',90,'[\"17:00\",\"18:00\"]',240000,360000,0,NULL,360000,120000,NULL,'vietqr','deposit_paid','Đã cọc 120.000đ · VietQR','confirmed','2026-11-20 11:30:00',NULL,NULL,NULL,NULL,'Đội bóng FC BMT đá giao hữu chiều tan làm.','2026-11-20 11:15:00','2026-11-20 15:29:17'),('ob-today-02','BMT20261120-002','online','c10','Cầu lông Victory BMT','badminton','Thành Công','https://readdy.ai/api/search-image?query=Modern%20indoor%20badminton%20court%20with%20green%20mat%20flooring%2C%20crisp%20white%20line%20markings%2C%20taut%20net%2C%20bright%20LED%20ceiling%20lights%2C%20clean%20sports%20facility%2C%20no%20people&width=1000&height=700&seq=bmt-court-bm-02a&orientation=landscape',11,'Lê Phương Mai','0932 777 666','mai.lp@gmail.com','2026-11-20','18:00',60,'[\"18:00\"]',130000,130000,0,NULL,130000,0,NULL,'vietqr','unpaid','Chờ duyệt & cọc','pending',NULL,NULL,NULL,NULL,NULL,'Khách đặt online, đang chờ chủ sân duyệt đơn.','2026-11-20 14:10:00','2026-11-20 15:29:17'),('ob-today-03','BMT20261120-003','online','c06','Sân bóng Tân An','football','Tân An','https://readdy.ai/api/search-image?query=Lush%20green%20mini%20football%20field%20at%20sunset%20with%20warm%20golden%20light%2C%20neat%20artificial%20turf%2C%20clean%20sidelines%2C%20serene%20sports%20environment%2C%20no%20people&width=1000&height=700&seq=bmt-court-fb-06a&orientation=landscape',12,'Bùi Văn Khoa','0912 774 019','khoa.bv@gmail.com','2026-11-20','19:30',90,'[\"19:30\",\"20:30\"]',200000,300000,30000,'BMT30K',270000,90000,NULL,'vietqr','deposit_claimed','Khách đã báo cọc 90.000đ','pending','2026-11-20 13:00:00',NULL,NULL,NULL,NULL,'Khách đã quét VietQR báo chuyển cọc 90K, chờ chủ sân kiểm tra biến động số dư.','2026-11-20 12:45:00','2026-11-20 15:29:17'),('ob-today-04','BMT20261120-004','online','c05','Sân bóng Ea Tam Sport','football','Ea Tam','https://readdy.ai/api/search-image?query=Artificial%20grass%20football%20court%20at%20night%20with%20bright%20white%20floodlights%2C%20green%20turf%2C%20industrial%20area%20in%20the%20background%2C%20atmospheric%20sports%20photography%2C%20no%20people&width=1000&height=700&seq=bmt-court-fb-05a&orientation=landscape',9,'Hoàng Minh Đức','0905 123 456','duc.hm@gmail.com','2026-11-20','06:00',90,'[\"06:00\",\"07:00\"]',160000,240000,48000,'GIOVANG',192000,100000,NULL,'cash','paid','Đã thu đủ · Tiền mặt','completed','2026-11-19 20:00:00',NULL,NULL,NULL,'2026-11-20 05:55:00','Đã đá xong buổi sáng, thanh toán tiền mặt đủ.','2026-11-19 19:30:00','2026-11-20 15:29:17'),('ob-today-05','BMT20261120-005','owner','c10','Cầu lông Victory BMT','badminton','Thành Công','https://readdy.ai/api/search-image?query=Modern%20indoor%20badminton%20court%20with%20green%20mat%20flooring%2C%20crisp%20white%20line%20markings%2C%20taut%20net%2C%20bright%20LED%20ceiling%20lights%2C%20clean%20sports%20facility%2C%20no%20people&width=1000&height=700&seq=bmt-court-bm-02a&orientation=landscape',NULL,'Phạm Gia Huy','0935 222 111',NULL,'2026-11-20','14:00',90,'[\"14:00\",\"15:00\"]',90000,135000,0,NULL,135000,0,NULL,'cash','paid','Đã thu đủ · Tiền mặt','completed','2026-11-20 14:00:00',NULL,NULL,NULL,'2026-11-20 14:00:00','[Tạo bởi Lê Thị Ngọc (Lễ tân & thu ngân) vào 14:00 20/11]\nKhách vãng lai đánh chiều, đã thu đủ tiền mặt tại quầy.','2026-11-20 14:00:00','2026-11-20 15:29:17'),('ob-today-06','BMT20261120-006','online','c01','Sân bóng BMT Arena','football','Tân Lợi','https://readdy.ai/api/search-image?query=Modern%20artificial%20grass%20five%20a%20side%20football%20pitch%20under%20bright%20floodlights%20at%20night%2C%20vivid%20green%20turf%2C%20white%20line%20markings%2C%20green%20net%20fence%2C%20clean%20sports%20photography%2C%20no%20people&width=1000&height=700&seq=bmt-court-fb-01a&orientation=landscape',13,'Phan Hữu Đạt','0908 444 555','dat.ph@gmail.com','2026-11-20','20:30',60,'[\"20:30\"]',240000,240000,0,NULL,240000,0,NULL,'vietqr','unpaid','Đã hủy','cancelled',NULL,NULL,NULL,NULL,NULL,'Khách báo hoãn đá do công ty có lịch họp gấp.','2026-11-20 08:30:00','2026-11-20 15:29:17');
/*!40000 ALTER TABLE `bookings` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `categories`
--

DROP TABLE IF EXISTS `categories`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `categories` (
  `id` varchar(40) COLLATE utf8mb4_unicode_ci NOT NULL,
  `kind` enum('sport','area','amenity') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'sport',
  `name` varchar(120) COLLATE utf8mb4_unicode_ci NOT NULL,
  `slug` varchar(120) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `icon` varchar(60) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'ri-price-tag-3-line',
  `sort_order` int NOT NULL DEFAULT '0',
  `active` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `categories`
--

LOCK TABLES `categories` WRITE;
/*!40000 ALTER TABLE `categories` DISABLE KEYS */;
INSERT INTO `categories` VALUES ('cat-am-1','amenity','Bãi giữ xe miễn phí','bai-giu-xe','Khu vực để xe máy và ô tô có bảo vệ','ri-parking-box-line',1,1,'2026-11-19 14:05:57','2026-11-19 14:05:57'),('cat-am-2','amenity','Đèn LED chiếu sáng','den-led','Hệ thống chiếu sáng tiêu chuẩn thi đấu buổi tối','ri-lightbulb-flash-line',2,1,'2026-11-19 14:05:57','2026-11-19 14:05:57'),('cat-am-3','amenity','Phòng thay đồ & tắm','phong-thay-do','Khu vệ sinh, thay đồ sạch sẽ riêng biệt','ri-t-shirt-line',3,1,'2026-11-19 14:05:57','2026-11-19 14:05:57'),('cat-am-4','amenity','Căng tin nước uống','cang-tin','Phục vụ nước suối, nước tăng lực, khăn lạnh','ri-cup-line',4,1,'2026-11-19 14:05:57','2026-11-19 14:05:57'),('cat-am-5','amenity','Wifi miễn phí','wifi-mien-phi','Phủ sóng wifi tốc độ cao tại khu chờ','ri-wifi-line',5,1,'2026-11-19 14:05:57','2026-11-19 14:05:57'),('cat-am-6','amenity','Cho thuê bóng / vợt','cho-thue-dung-cu','Hỗ trợ thuê bóng thi đấu, áo bib, vợt cầu lông','ri-ping-pong-line',6,1,'2026-11-19 14:05:57','2026-11-19 14:05:57'),('cat-area-1','area','Tân Lợi','tan-loi','Phường Tân Lợi, TP. Buôn Ma Thuột','ri-map-pin-line',1,1,'2026-11-10 15:54:00','2026-11-10 15:54:00'),('cat-area-2','area','Tân An','tan-an','Phường Tân An, TP. Buôn Ma Thuột','ri-map-pin-line',2,1,'2026-11-10 15:54:00','2026-11-10 15:54:00'),('cat-area-3','area','Thắng Lợi','thang-loi','Phường Thắng Lợi, TP. Buôn Ma Thuột','ri-map-pin-line',3,1,'2026-11-10 15:54:00','2026-11-10 15:54:00'),('cat-area-4','area','Tân Thành','tan-thanh','Phường Tân Thành, TP. Buôn Ma Thuột','ri-map-pin-line',4,1,'2026-11-10 15:54:00','2026-11-10 15:54:00'),('cat-area-5','area','Hòa Thắng','hoa-thang','Phường Hòa Thắng, TP. Buôn Ma Thuột','ri-map-pin-line',5,1,'2026-11-10 15:54:00','2026-11-10 15:54:00'),('cat-area-6','area','Ea Tam','ea-tam','Phường Ea Tam, TP. Buôn Ma Thuột','ri-map-pin-line',6,1,'2026-11-10 15:54:00','2026-11-10 15:54:00'),('cat-area-7','area','Khánh Xuân','khanh-xuan','Phường Khánh Xuân, TP. Buôn Ma Thuột','ri-map-pin-line',7,1,'2026-11-10 15:54:00','2026-11-10 15:54:00'),('cat-area-8','area','Thành Công','thanh-cong','Phường Thành Công, TP. Buôn Ma Thuột','ri-map-pin-line',8,1,'2026-11-10 15:54:00','2026-11-10 15:54:00'),('cat-area-9','area','Thống Nhất','thong-nhat','Phường Thống Nhất, TP. Buôn Ma Thuột','ri-map-pin-line',9,1,'2026-11-10 15:54:00','2026-11-10 15:54:00'),('cat-badminton','sport','Cầu lông','cau-long','Sân thảm tiêu chuẩn và sân VIP','ri-ping-pong-line',2,1,'2026-11-10 15:54:00','2026-11-10 15:54:00'),('cat-football','sport','Bóng đá','bong-da','Sân 5, sân 7 và sân 11 người','ri-football-line',1,1,'2026-11-10 15:54:00','2026-11-10 15:54:00');
/*!40000 ALTER TABLE `categories` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `contact_messages`
--

DROP TABLE IF EXISTS `contact_messages`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `contact_messages` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(120) COLLATE utf8mb4_unicode_ci NOT NULL,
  `phone` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `email` varchar(190) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `topic` varchar(120) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `message` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `contact_messages`
--

LOCK TABLES `contact_messages` WRITE;
/*!40000 ALTER TABLE `contact_messages` DISABLE KEYS */;
/*!40000 ALTER TABLE `contact_messages` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `contents`
--

DROP TABLE IF EXISTS `contents`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `contents` (
  `id` varchar(40) COLLATE utf8mb4_unicode_ci NOT NULL,
  `kind` enum('banner','news','faq','policy') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'news',
  `title` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL,
  `slug` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `summary` varchar(500) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `body` text COLLATE utf8mb4_unicode_ci,
  `image` varchar(600) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `link_url` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `status` enum('draft','published','archived') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'published',
  `pinned` tinyint(1) NOT NULL DEFAULT '0',
  `sort_order` int NOT NULL DEFAULT '0',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `contents`
--

LOCK TABLES `contents` WRITE;
/*!40000 ALTER TABLE `contents` DISABLE KEYS */;
INSERT INTO `contents` VALUES ('banner-1','banner','Giờ vàng giảm 20% buổi sáng','gio-vang','Nhập mã GIOVANG khi đặt sân từ 05:00 đến 15:00 các ngày trong tuần.','','https://readdy.ai/api/search-image?query=Wide%20shot%20of%20a%20floodlit%20artificial%20turf%20football%20pitch%20at%20night%20in%20a%20tropical%20Vietnamese%20city%2C%20deep%20green%20grass%2C%20white%20line%20markings%2C%20glowing%20stadium%20lights%2C%20dramatic%20dark%20sky%2C%20atmospheric%20haze%2C%20cinematic%20sports%20photography&width=1600&height=900&seq=bmt-hero-pitch-01&orientation=landscape','/uu-dai','published',1,1,'2026-11-10 15:54:00','2026-11-10 15:54:00'),('faq-1','faq','Tôi có cần tạo tài khoản để đặt sân không?','','Không bắt buộc. Bạn chỉ cần họ tên và số điện thoại là có thể gửi yêu cầu đặt sân. Tạo tài khoản sẽ giúp bạn theo dõi lịch sử, xem lại mã đặt sân và hủy đơn nhanh hơn.','Không bắt buộc. Bạn chỉ cần họ tên và số điện thoại là có thể gửi yêu cầu đặt sân. Tạo tài khoản sẽ giúp bạn theo dõi lịch sử, xem lại mã đặt sân và hủy đơn nhanh hơn.','','','published',1,1,'2026-11-10 15:54:00','2026-11-10 15:54:00'),('faq-2','faq','Giá thuê sân tại Buôn Ma Thuột là bao nhiêu?','','Sân bóng đá từ 150.000đ/giờ (sân 5) đến 620.000đ/giờ (sân 11). Sân cầu lông từ 65.000đ/giờ đến 130.000đ/giờ với sân VIP. Giá được niêm yết theo từng sân và từng loại sân, khung 17:00 - 21:00 có thể ph','Sân bóng đá từ 150.000đ/giờ (sân 5) đến 620.000đ/giờ (sân 11). Sân cầu lông từ 65.000đ/giờ đến 130.000đ/giờ với sân VIP. Giá được niêm yết theo từng sân và từng loại sân, khung 17:00 - 21:00 có thể phụ thu 10%.','','','published',0,2,'2026-11-10 15:54:00','2026-11-10 15:54:00'),('faq-3','faq','Sân còn trống thì giữ chỗ trong bao lâu?','','Khung giờ bạn chọn được tạm giữ 10 phút trong lúc hoàn tất thông tin. Quá thời gian này, hệ thống mở lại khung giờ cho người chơi khác để tránh trùng lịch.','Khung giờ bạn chọn được tạm giữ 10 phút trong lúc hoàn tất thông tin. Quá thời gian này, hệ thống mở lại khung giờ cho người chơi khác để tránh trùng lịch.','','','published',0,3,'2026-11-10 15:54:00','2026-11-10 15:54:00'),('faq-4','faq','Chính sách hủy sân và hoàn cọc như thế nào?','','Bạn chỉ có thể hủy và được hoàn 100% tiền cọc khi còn cách giờ chơi từ 4 giờ trở lên. Trong 4 giờ cuối, nút hủy sẽ khóa để chủ sân không mất khung giờ đã giữ, bạn gọi hotline 0262 399 8888 để được xử ','Bạn chỉ có thể hủy và được hoàn 100% tiền cọc khi còn cách giờ chơi từ 4 giờ trở lên. Trong 4 giờ cuối, nút hủy sẽ khóa để chủ sân không mất khung giờ đã giữ, bạn gọi hotline 0262 399 8888 để được xử lý tay. Lỗi từ phía sân thì luôn hoàn 100%. Đơn đã hủy không thể khôi phục, bạn hủy trực tiếp trong mục \"Đơn sắp tới\" ở trang tài khoản.','','','published',0,4,'2026-11-10 15:54:00','2026-11-10 15:54:00'),('faq-5','faq','Sân có cho thuê bóng, áo bib và vợt không?','','Phần lớn sân tặng kèm bóng và lưới. Áo bib cho thuê 10.000đ/bộ, bơm bóng miễn phí. Sân cầu lông cho thuê vợt 20.000đ/cây và có bán ống cầu tại chỗ.','Phần lớn sân tặng kèm bóng và lưới. Áo bib cho thuê 10.000đ/bộ, bơm bóng miễn phí. Sân cầu lông cho thuê vợt 20.000đ/cây và có bán ống cầu tại chỗ.','','','published',0,5,'2026-11-10 15:54:00','2026-11-10 15:54:00'),('faq-6','faq','Có chỗ gửi xe không? Thanh toán bằng cách nào?','','Tất cả sân trong hệ thống đều có bãi giữ xe, phần lớn miễn phí cho khách đặt sân. Bạn có thể thanh toán tại sân bằng tiền mặt hoặc chuyển khoản theo mã đặt sân.','Tất cả sân trong hệ thống đều có bãi giữ xe, phần lớn miễn phí cho khách đặt sân. Bạn có thể thanh toán tại sân bằng tiền mặt hoặc chuyển khoản theo mã đặt sân.','','','published',0,6,'2026-11-10 15:54:00','2026-11-10 15:54:00'),('news-1','news','Khai trương cụm sân cầu lông Hòa Thắng Arena','khai-truong-hoa-thang-arena','6 sân thảm tiêu chuẩn BWF, có điều hòa, mở cửa từ 05:00 đến 23:00.','Cụm sân cầu lông Hòa Thắng Arena chính thức tham gia hệ thống Đặt Sân BMT 24H.','','/san/cau-long-hoa-thang-arena','published',0,1,'2026-11-10 15:54:00','2026-11-10 15:54:00'),('news-2','news','Giải bóng đá phong trào BMT Cup 2026','bmt-cup-2026','Bản nháp thông báo giải đấu cuối năm.','','','','draft',0,2,'2026-11-10 15:54:00','2026-11-10 15:54:00'),('policy-1','policy','Chính sách hủy sân & hoàn cọc','chinh-sach-huy','Hủy trước 4 giờ hoàn 100% cọc; lỗi từ sân hoàn 100%.','Bạn chỉ có thể hủy và được hoàn 100% tiền cọc khi còn cách giờ chơi từ 4 giờ trở lên. Trong 4 giờ cuối, nút hủy sẽ khóa để chủ sân không mất khung giờ đã giữ, bạn gọi hotline 0262 399 8888 để được xử lý tay. Lỗi từ phía sân thì luôn hoàn 100%. Đơn đã hủy không thể khôi phục, bạn hủy trực tiếp trong mục \"Đơn sắp tới\" ở trang tài khoản.','','','published',1,1,'2026-11-10 15:54:00','2026-11-10 15:54:00');
/*!40000 ALTER TABLE `contents` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `courts`
--

DROP TABLE IF EXISTS `courts`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `courts` (
  `id` varchar(40) COLLATE utf8mb4_unicode_ci NOT NULL,
  `slug` varchar(160) COLLATE utf8mb4_unicode_ci NOT NULL,
  `owner_id` int DEFAULT NULL,
  `name` varchar(160) COLLATE utf8mb4_unicode_ci NOT NULL,
  `sport` enum('football','badminton') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'football',
  `sport_label` varchar(60) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `area` varchar(80) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `address` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `price_per_hour` int NOT NULL DEFAULT '0',
  `peak_price` int NOT NULL DEFAULT '0',
  `price_note` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `price_bands` text COLLATE utf8mb4_unicode_ci COMMENT 'JSON: khung giá theo giờ',
  `field_price_step` int DEFAULT NULL,
  `operating_note` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `rating` decimal(3,1) NOT NULL DEFAULT '0.0',
  `review_count` int NOT NULL DEFAULT '0',
  `monthly_bookings` int NOT NULL DEFAULT '0',
  `description` text COLLATE utf8mb4_unicode_ci,
  `highlights` text COLLATE utf8mb4_unicode_ci COMMENT 'JSON',
  `facilities` text COLLATE utf8mb4_unicode_ci COMMENT 'JSON',
  `images` text COLLATE utf8mb4_unicode_ci COMMENT 'JSON: danh sách URL ảnh',
  `open_time` varchar(5) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '05:00',
  `close_time` varchar(5) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '23:00',
  `weekly_hours` text COLLATE utf8mb4_unicode_ci COMMENT 'JSON: giờ mở cửa riêng từng thứ',
  `field_types` text COLLATE utf8mb4_unicode_ci COMMENT 'JSON',
  `featured` tinyint(1) NOT NULL DEFAULT '0',
  `status` enum('active','pending','maintenance','paused') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'active',
  `map_query` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `note` text COLLATE utf8mb4_unicode_ci,
  `sort_order` int NOT NULL DEFAULT '0',
  `deleted_at` datetime DEFAULT NULL COMMENT 'Khác NULL = đang ở thùng rác',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `slug` (`slug`),
  KEY `idx_owner` (`owner_id`),
  CONSTRAINT `courts_ibfk_1` FOREIGN KEY (`owner_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `courts`
--

LOCK TABLES `courts` WRITE;
/*!40000 ALTER TABLE `courts` DISABLE KEYS */;
INSERT INTO `courts` VALUES ('c01','san-bong-bmt-arena',2,'Sân bóng BMT Arena','football','Sân bóng đá','Tân Lợi','23 Lê Duẩn, P. Tân Lợi, TP. Buôn Ma Thuột',180000,240000,'Sân 5: 180.000đ • Sân 7: 320.000đ','[{\"id\": \"morning\", \"label\": \"Buổi sáng và chiều\", \"shortLabel\": \"Sáng – chiều\", \"start\": \"05:00\", \"end\": \"16:00\", \"price\": 180000}, {\"id\": \"evening\", \"label\": \"Buổi tối\", \"shortLabel\": \"Tối\", \"start\": \"16:00\", \"end\": \"23:00\", \"price\": 240000, \"peak\": true}]',140000,'Mở cửa tất cả các ngày trong tuần, kể cả ngày lễ',4.8,126,214,'Cụm sân cỏ nhân tạo BMT Arena gồm 3 sân 5 người và 1 sân 7 người, mặt cỏ mới thay năm 2025, hệ thống đèn LED 4 trụ cho ánh sáng đều khắp sân. Sân nằm ngay trung tâm thành phố, thuận tiện cho các đội bóng phong trào sau giờ làm.','[\"Cỏ nhân tạo mới thay 2025\", \"Đèn LED 4 trụ sáng đều\", \"Có sân 5 và sân 7 người\"]','[\"Bãi giữ xe miễn phí\", \"Phòng thay đồ\", \"Wifi miễn phí\", \"Căng tin nước uống\", \"Ghế khán giả\", \"Lưới & bóng miễn phí\"]','[\"https://readdy.ai/api/search-image?query=Modern%20artificial%20grass%20five%20a%20side%20football%20pitch%20under%20bright%20floodlights%20at%20night%2C%20vivid%20green%20turf%2C%20white%20line%20markings%2C%20green%20net%20fence%2C%20clean%20sports%20photography%2C%20no%20people&width=1000&height=700&seq=bmt-court-fb-01a&orientation=landscape\", \"https://readdy.ai/api/search-image?query=Side%20angle%20of%20an%20empty%20artificial%20turf%20football%20field%20at%20dusk%20with%20tall%20light%20poles%2C%20white%20goal%20frame%2C%20tidy%20green%20grass%2C%20calm%20evening%20sky%2C%20architectural%20sports%20photography%2C%20no%20people&width=1000&height=700&seq=bmt-court-fb-01b&orientation=landscape\"]','05:00','23:00',NULL,'[\"Sân 5 người\", \"Sân 7 người\"]',1,'active','23 Lê Duẩn, Tân Lợi, Buôn Ma Thuột, Đắk Lắk','Cỏ nhân tạo mới thay 2025, đèn LED 4 trụ.',0,NULL,'2026-11-10 15:54:00','2026-11-10 15:54:00'),('c02','san-bong-fc-dak-lak',5,'Sân bóng FC Đắk Lắk','football','Sân bóng đá','Tân An','45 Nguyễn Tất Thành, P. Tân An, TP. Buôn Ma Thuột',350000,400000,'Sân 7: 350.000đ • Sân 11: 620.000đ','[{\"id\": \"morning\", \"label\": \"Buổi sáng và chiều\", \"shortLabel\": \"Sáng – chiều\", \"start\": \"06:00\", \"end\": \"16:00\", \"price\": 350000}, {\"id\": \"evening\", \"label\": \"Buổi tối\", \"shortLabel\": \"Tối\", \"start\": \"16:00\", \"end\": \"22:30\", \"price\": 400000, \"peak\": true}]',270000,'Mở cửa tất cả các ngày trong tuần',4.7,98,93,'Sân bóng FC Đắk Lắk sở hữu mặt cỏ nhân tạo chuẩn thi đấu cùng khán đài 200 chỗ, thường xuyên tổ chức các giải phong trào cấp thành phố. Phù hợp cho các đội 7 người và 11 người muốn thi đấu trên mặt sân rộng.','[\"Khán đài 200 chỗ ngồi\", \"Mặt cỏ chuẩn thi đấu\", \"Thường tổ chức giải phong trào\"]','[\"Bãi giữ xe\", \"Khán đài\", \"Phòng thay đồ\", \"Căng tin\", \"Wifi miễn phí\", \"Trọng tài theo yêu cầu\"]','[\"https://readdy.ai/api/search-image?query=Full%20size%20eleven%20a%20side%20football%20pitch%20with%20green%20artificial%20turf%20and%20small%20spectator%20stand%2C%20evening%20sky%2C%20floodlight%20towers%2C%20clean%20highway%20fence%2C%20professional%20sports%20venue%20photography%2C%20no%20people&width=1000&height=700&seq=bmt-court-fb-02a&orientation=landscape\", \"https://readdy.ai/api/search-image?query=Goal%20net%20close%20up%20on%20an%20empty%20green%20football%20field%20at%20twilight%2C%20dewy%20turf%20texture%2C%20soft%20blue%20evening%20light%2C%20minimal%20clean%20composition%2C%20no%20people&width=1000&height=700&seq=bmt-court-fb-02b&orientation=landscape\"]','06:00','22:30',NULL,'[\"Sân 7 người\", \"Sân 11 người\"]',1,'active','45 Nguyễn Tất Thành, Tân An, Buôn Ma Thuột, Đắk Lắk','',1,NULL,'2026-11-10 15:54:00','2026-11-10 15:54:00'),('c03','san-bong-hoa-thang',NULL,'Sân bóng Hòa Thắng','football','Sân bóng đá','Hòa Thắng','12 Trường Chinh, P. Hòa Thắng, TP. Buôn Ma Thuột',150000,180000,'Sân 5: 150.000đ','[{\"id\": \"morning\", \"label\": \"Buổi sáng và chiều\", \"shortLabel\": \"Sáng – chiều\", \"start\": \"05:30\", \"end\": \"16:00\", \"price\": 150000}, {\"id\": \"evening\", \"label\": \"Buổi tối\", \"shortLabel\": \"Tối\", \"start\": \"16:00\", \"end\": \"22:00\", \"price\": 180000, \"peak\": true}]',NULL,'Mở cửa tất cả các ngày trong tuần',4.5,74,106,'Sân 5 người giá bình dân tại phường Hòa Thắng, mặt sân phẳng và được vệ sinh hằng ngày. Đây là điểm hẹn quen thuộc của sinh viên và các nhóm bạn trẻ trong khu vực.','[\"Giá thuê bình dân\", \"Gần khu dân cư Hòa Thắng\", \"Nhận sân đến 22 giờ\"]','[\"Bãi giữ xe\", \"Nước uống\", \"Đèn chiếu sáng\", \"Lưới & bóng miễn phí\"]','[\"https://readdy.ai/api/search-image?query=Compact%20neighborhood%20five%20a%20side%20football%20court%20with%20green%20turf%20surrounded%20by%20tropical%20trees%2C%20warm%20late%20afternoon%20sunlight%2C%20simple%20fence%2C%20friendly%20local%20sports%20setting%2C%20no%20people&width=1000&height=700&seq=bmt-court-fb-03a&orientation=landscape\", \"https://readdy.ai/api/search-image?query=Green%20artificial%20turf%20detail%20texture%20with%20white%20painted%20line%20on%20a%20small%20football%20court%2C%20soft%20evening%20light%2C%20minimal%20close%20up%20sports%20surface%20photography%2C%20no%20people&width=1000&height=700&seq=bmt-court-fb-03b&orientation=landscape\"]','05:30','22:00',NULL,'[\"Sân 5 người\"]',0,'active','12 Trường Chinh, Hòa Thắng, Buôn Ma Thuột, Đắk Lắk','',2,NULL,'2026-11-10 15:54:00','2026-11-10 15:54:00'),('c04','san-bong-tan-thanh',NULL,'Sân bóng Tân Thành','football','Sân bóng đá','Tân Thành','88 Phan Chu Trinh, P. Tân Thành, TP. Buôn Ma Thuột',250000,300000,'Sân 7: 250.000đ','[{\"id\": \"morning\", \"label\": \"Buổi sáng và chiều\", \"shortLabel\": \"Sáng – chiều\", \"start\": \"06:00\", \"end\": \"16:00\", \"price\": 250000}, {\"id\": \"evening\", \"label\": \"Buổi tối\", \"shortLabel\": \"Tối\", \"start\": \"16:00\", \"end\": \"23:00\", \"price\": 300000, \"peak\": true}]',NULL,'Mở cửa tất cả các ngày trong tuần',4.6,63,119,'Sân 7 người có mái che lưới cao, hạn chế mất bóng và phù hợp cả khi trời mưa nhẹ. Khu vực để xe rộng, có phòng thay đồ riêng cho từng đội.','[\"Có lưới chắn bóng cao\", \"Phòng thay đồ riêng\", \"Sân 7 người rộng rãi\"]','[\"Bãi giữ xe\", \"Phòng thay đồ\", \"Wifi miễn phí\", \"Căng tin\", \"Ghế khán giả\"]','[\"https://readdy.ai/api/search-image?query=Seven%20a%20side%20football%20field%20with%20high%20ball%20netting%20around%20the%20pitch%2C%20evening%20floodlights%2C%20green%20turf%2C%20clean%20urban%20sports%20facility%2C%20no%20people&width=1000&height=700&seq=bmt-court-fb-04a&orientation=landscape\", \"https://readdy.ai/api/search-image?query=Corner%20view%20of%20an%20empty%20football%20pitch%20with%20white%20corner%20flag%20and%20green%20turf%2C%20stadium%20lights%20glowing%2C%20calm%20night%20atmosphere%2C%20cinematic%20sports%20photography%2C%20no%20people&width=1000&height=700&seq=bmt-court-fb-04b&orientation=landscape\"]','06:00','23:00',NULL,'[\"Sân 7 người\"]',1,'active','88 Phan Chu Trinh, Tân Thành, Buôn Ma Thuột, Đắk Lắk','',3,NULL,'2026-11-10 15:54:00','2026-11-10 15:54:00'),('c05','san-bong-ea-tam-sport',2,'Sân bóng Ea Tam Sport','football','Sân bóng đá','Ea Tam','102 Nguyễn Văn Cừ, P. Ea Tam, TP. Buôn Ma Thuột',160000,200000,'Sân 5: 160.000đ • Sân 7: 290.000đ','[{\"id\": \"morning\", \"label\": \"Buổi sáng và chiều\", \"shortLabel\": \"Sáng – chiều\", \"start\": \"05:00\", \"end\": \"16:00\", \"price\": 160000}, {\"id\": \"evening\", \"label\": \"Buổi tối\", \"shortLabel\": \"Tối\", \"start\": \"16:00\", \"end\": \"23:00\", \"price\": 200000, \"peak\": true}]',130000,'Mở cửa tất cả các ngày trong tuần',4.4,51,96,'Cụm sân gần khu công nghiệp Ea Tam, phục vụ đông đảo anh em công nhân và các đội bóng sau giờ tan ca. Có dịch vụ cho thuê áo bib và bơm bóng miễn phí.','[\"Mở cửa đến 23 giờ\", \"Cho thuê áo bib\", \"Gần khu công nghiệp Ea Tam\"]','[\"Bãi giữ xe\", \"Nước uống\", \"Cho thuê áo bib\", \"Đèn chiếu sáng\", \"Wifi miễn phí\"]','[\"https://readdy.ai/api/search-image?query=Artificial%20grass%20football%20court%20at%20night%20with%20bright%20white%20floodlights%2C%20green%20turf%2C%20industrial%20area%20in%20the%20background%2C%20atmospheric%20sports%20photography%2C%20no%20people&width=1000&height=700&seq=bmt-court-fb-05a&orientation=landscape\", \"https://readdy.ai/api/search-image?query=Empty%20five%20a%20side%20football%20pitch%20seen%20from%20above%20at%20dusk%2C%20crisp%20white%20markings%2C%20green%20turf%2C%20surrounding%20fence%20and%20trees%2C%20aerial%20sports%20venue%20photography%2C%20no%20people&width=1000&height=700&seq=bmt-court-fb-05b&orientation=landscape\"]','05:00','23:00',NULL,'[\"Sân 5 người\", \"Sân 7 người\"]',0,'active','102 Nguyễn Văn Cừ, Ea Tam, Buôn Ma Thuột, Đắk Lắk','Đang thay lưới chắn bóng phía Đông, mở lại từ 10/11.',4,NULL,'2026-11-10 15:54:00','2026-11-10 15:54:00'),('c06','san-bong-thang-loi-24h',2,'Sân bóng Thắng Lợi','football','Sân bóng đá','Thắng Lợi','15 Mai Hắc Đế, P. Thắng Lợi, TP. Buôn Ma Thuột',200000,250000,'Sân 5: 200.000đ','[{\"id\": \"morning\", \"label\": \"Buổi sáng và chiều\", \"shortLabel\": \"Sáng – chiều\", \"start\": \"05:00\", \"end\": \"16:00\", \"price\": 200000}, {\"id\": \"evening\", \"label\": \"Buổi tối\", \"shortLabel\": \"Tối\", \"start\": \"16:00\", \"end\": \"23:00\", \"price\": 250000, \"peak\": true}]',NULL,'Mở cửa hằng ngày 05:00 – 23:00, kể cả ngày lễ',4.9,187,268,'Sân bóng mở cửa hằng ngày từ 05:00 đến 23:00 với hệ thống đặt sân tự động, mặt cỏ nhân tạo thế hệ mới mềm và êm chân. Được nhiều đội bóng phong trào tại Buôn Ma Thuột đánh giá cao về chất lượng và dịch vụ.','[\"Nhận sân đến 23:00\", \"Cỏ thế hệ mới êm chân\", \"Đặt sân tự động\"]','[\"Bãi giữ xe\", \"Phòng thay đồ\", \"Căng tin\", \"Wifi miễn phí\", \"Ghế khán giả\", \"Lưới & bóng miễn phí\"]','[\"https://readdy.ai/api/search-image?query=Premium%20five%20a%20side%20football%20court%20illuminated%20at%20night%2C%20lush%20green%20turf%2C%20glowing%20floodlights%2C%20modern%20clubhouse%20building%20beside%20the%20pitch%2C%20cinematic%20sports%20photography%2C%20no%20people&width=1000&height=700&seq=bmt-court-fb-06a&orientation=landscape\", \"https://readdy.ai/api/search-image?query=Night%20view%20of%20an%20empty%20green%20football%20pitch%20with%20bright%20stadium%20lights%20and%20misty%20air%2C%20deep%20shadows%2C%20dramatic%20sports%20atmosphere%2C%20no%20people&width=1000&height=700&seq=bmt-court-fb-06b&orientation=landscape\"]','05:00','23:00',NULL,'[\"Sân 5 người\"]',1,'active','15 Mai Hắc Đế, Thắng Lợi, Buôn Ma Thuột, Đắk Lắk','Nhận sân xuyên đêm theo yêu cầu, có phòng thay đồ riêng.',5,NULL,'2026-11-10 15:54:00','2026-11-10 15:54:00'),('c07','nha-thi-dau-cau-long-buon-ma-thuot',NULL,'Nhà thi đấu Cầu lông Buôn Ma Thuột','badminton','Sân cầu lông','Tân Lợi','02 Y Moan, P. Tân Lợi, TP. Buôn Ma Thuột',90000,110000,'90.000đ/giờ • Thuê vợt 20.000đ','[{\"id\": \"morning\", \"label\": \"Buổi sáng và chiều\", \"shortLabel\": \"Sáng – chiều\", \"start\": \"05:00\", \"end\": \"17:00\", \"price\": 90000}, {\"id\": \"evening\", \"label\": \"Buổi tối\", \"shortLabel\": \"Tối\", \"start\": \"17:00\", \"end\": \"22:00\", \"price\": 110000, \"peak\": true}]',NULL,'Mở cửa tất cả các ngày trong tuần',4.8,154,158,'Nhà thi đấu trong nhà với 6 sân tiêu chuẩn, thảm chống trượt và trần cao thoáng, ánh sáng không chói mắt. Có huấn luyện viên nhận dạy kèm cho người mới bắt đầu.','[\"6 sân trong nhà\", \"Thảm chống trượt\", \"Có HLV dạy kèm\"]','[\"Điều hòa & quạt trần\", \"Phòng thay đồ\", \"Bãi giữ xe\", \"Cho thuê vợt\", \"Căng tin nước uống\", \"Wifi miễn phí\"]','[\"https://readdy.ai/api/search-image?query=Indoor%20badminton%20hall%20with%20several%20courts%2C%20green%20court%20mats%2C%20high%20ceiling%20and%20bright%20even%20lighting%2C%20clean%20modern%20sports%20facility%2C%20wide%20angle%2C%20no%20people&width=1000&height=700&seq=bmt-court-bd-01a&orientation=landscape\", \"https://readdy.ai/api/search-image?query=Badminton%20net%20close%20up%20on%20a%20green%20indoor%20court%20with%20white%20line%20markings%20and%20polished%20wooden%20floor%2C%20soft%20sports%20lighting%2C%20minimal%20clean%20composition%2C%20no%20people&width=1000&height=700&seq=bmt-court-bd-01b&orientation=landscape\"]','05:00','22:00',NULL,'[\"Sân tiêu chuẩn\", \"Sân tập luyện\"]',1,'active','02 Y Moan, Tân Lợi, Buôn Ma Thuột, Đắk Lắk','',6,NULL,'2026-11-10 15:54:00','2026-11-10 15:54:00'),('c08','cau-long-tan-an-smash',5,'Cầu lông Tân An Smash','badminton','Sân cầu lông','Tân An','61 Nguyễn Công Trứ, P. Tân An, TP. Buôn Ma Thuột',70000,90000,'70.000đ/giờ • Khung sáng 60.000đ','[{\"id\": \"early\", \"label\": \"Sáng sớm\", \"shortLabel\": \"Sáng sớm\", \"start\": \"05:30\", \"end\": \"11:00\", \"price\": 60000}, {\"id\": \"midday\", \"label\": \"Giữa ngày\", \"shortLabel\": \"Giữa ngày\", \"start\": \"11:00\", \"end\": \"17:00\", \"price\": 70000}, {\"id\": \"evening\", \"label\": \"Buổi tối\", \"shortLabel\": \"Tối\", \"start\": \"17:00\", \"end\": \"22:30\", \"price\": 90000, \"peak\": true}]',NULL,'Mở cửa tất cả các ngày trong tuần',4.6,92,171,'Sân cầu lông trong nhà tại trung tâm Tân An, 4 sân thảm PVC, phù hợp cho nhóm bạn chơi buổi tối. Có bán cầu và nước uống tại chỗ.','[\"4 sân thảm PVC\", \"Giá khung sáng tiết kiệm\", \"Bán cầu & nước uống\"]','[\"Bãi giữ xe\", \"Bán cầu lông\", \"Nước uống\", \"Quạt trần\", \"Wifi miễn phí\"]','[\"https://readdy.ai/api/search-image?query=Clean%20indoor%20badminton%20courts%20with%20PVC%20floor%20mats%20in%20a%20simple%20sports%20hall%2C%20white%20net%20dividers%2C%20bright%20ceiling%20lights%2C%20no%20people&width=1000&height=700&seq=bmt-court-bd-02a&orientation=landscape\", \"https://readdy.ai/api/search-image?query=Empty%20badminton%20court%20from%20a%20low%20angle%20showing%20green%20mat%20and%20white%20boundary%20lines%2C%20soft%20indoor%20lighting%2C%20calm%20minimal%20sports%20interior%2C%20no%20people&width=1000&height=700&seq=bmt-court-bd-02b&orientation=landscape\"]','05:30','22:30',NULL,'[\"Sân tiêu chuẩn\"]',0,'active','61 Nguyễn Công Trứ, Tân An, Buôn Ma Thuột, Đắk Lắk','',7,NULL,'2026-11-10 15:54:00','2026-11-10 15:54:00'),('c09','cau-long-khanh-xuan',NULL,'Cầu lông Khánh Xuân','badminton','Sân cầu lông','Khánh Xuân','33 Đinh Tiên Hoàng, P. Khánh Xuân, TP. Buôn Ma Thuột',80000,100000,'80.000đ/giờ','[{\"id\": \"morning\", \"label\": \"Buổi sáng và chiều\", \"shortLabel\": \"Sáng – chiều\", \"start\": \"05:00\", \"end\": \"17:00\", \"price\": 80000}, {\"id\": \"evening\", \"label\": \"Buổi tối\", \"shortLabel\": \"Tối\", \"start\": \"17:00\", \"end\": \"21:30\", \"price\": 100000, \"peak\": true}]',NULL,'Mở cửa tất cả các ngày trong tuần',4.5,66,184,'Sân cầu lông 3 sân trong nhà thuộc phường Khánh Xuân, không gian yên tĩnh, phù hợp cho gia đình và nhóm bạn chơi thể thao buổi sáng.','[\"Không gian yên tĩnh\", \"Gần chợ Khánh Xuân\", \"Có sân cho gia đình\"]','[\"Bãi giữ xe\", \"Phòng thay đồ\", \"Nước uống\", \"Quạt trần\"]','[\"https://readdy.ai/api/search-image?query=Simple%20indoor%20badminton%20hall%20with%20three%20green%20courts%2C%20wooden%20floor%2C%20white%20nets%2C%20daylight%20through%20high%20windows%2C%20clean%20calm%20interior%2C%20no%20people&width=1000&height=700&seq=bmt-court-bd-03a&orientation=landscape\", \"https://readdy.ai/api/search-image?query=Badminton%20racket%20and%20shuttlecock%20resting%20on%20a%20green%20indoor%20court%20floor%2C%20soft%20natural%20light%2C%20minimal%20still%20life%20sports%20photography%2C%20no%20people&width=1000&height=700&seq=bmt-court-bd-03b&orientation=landscape\"]','05:00','21:30',NULL,'[\"Sân tiêu chuẩn\"]',0,'active','33 Đinh Tiên Hoàng, Khánh Xuân, Buôn Ma Thuột, Đắk Lắk','',8,NULL,'2026-11-10 15:54:00','2026-11-10 15:54:00'),('c10','cau-long-victory-bmt',2,'Cầu lông Victory BMT','badminton','Sân cầu lông','Thành Công','17 Tôn Đức Thắng, P. Thành Công, TP. Buôn Ma Thuột',100000,130000,'100.000đ/giờ • Sân VIP 130.000đ','[{\"id\": \"morning\", \"label\": \"Buổi sáng và chiều\", \"shortLabel\": \"Sáng – chiều\", \"start\": \"05:00\", \"end\": \"17:00\", \"price\": 100000}, {\"id\": \"evening\", \"label\": \"Buổi tối\", \"shortLabel\": \"Tối\", \"start\": \"17:00\", \"end\": \"23:00\", \"price\": 130000, \"peak\": true}]',30000,'Mở cửa tất cả các ngày trong tuần',4.9,203,326,'Câu lạc bộ cầu lông cao cấp nhất Buôn Ma Thuột với 8 sân thảm BWF, trần cao 12m và hệ thống chiếu sáng chống chói. Có khu vực khởi động và phòng tập thể lực riêng.','[\"8 sân thảm chuẩn BWF\", \"Trần cao 12m\", \"Khu khởi động riêng\"]','[\"Điều hòa\", \"Phòng thay đồ\", \"Tủ đồ có khóa\", \"Bãi giữ xe\", \"Căng tin\", \"Wifi miễn phí\", \"Cho thuê vợt\"]','[\"https://readdy.ai/api/search-image?query=Premium%20indoor%20badminton%20club%20with%20eight%20green%20BWF%20mats%2C%20very%20high%20ceiling%2C%20professional%20sports%20lighting%2C%20modern%20interior%20design%2C%20wide%20architectural%20shot%2C%20no%20people&width=1000&height=700&seq=bmt-court-bd-04a&orientation=landscape\", \"https://readdy.ai/api/search-image?query=Badminton%20court%20corner%20with%20green%20mat%2C%20net%20post%2C%20white%20lines%20and%20polished%20floor%2C%20warm%20indoor%20lighting%2C%20premium%20sports%20interior%20detail%2C%20no%20people&width=1000&height=700&seq=bmt-court-bd-04b&orientation=landscape\"]','05:00','23:00',NULL,'[\"Sân tiêu chuẩn\", \"Sân VIP\"]',1,'active','17 Tôn Đức Thắng, Thành Công, Buôn Ma Thuột, Đắk Lắk','8 sân thảm BWF, trần cao 12m, có điều hòa.',9,NULL,'2026-11-10 15:54:00','2026-11-10 15:54:00'),('c11','cau-long-pho-nui',NULL,'Cầu lông Phố Núi','badminton','Sân cầu lông','Thống Nhất','05 Nơ Trang Long, P. Thống Nhất, TP. Buôn Ma Thuột',65000,80000,'65.000đ/giờ','[{\"id\": \"morning\", \"label\": \"Buổi sáng và chiều\", \"shortLabel\": \"Sáng – chiều\", \"start\": \"06:00\", \"end\": \"17:00\", \"price\": 65000}, {\"id\": \"evening\", \"label\": \"Buổi tối\", \"shortLabel\": \"Tối\", \"start\": \"17:00\", \"end\": \"21:00\", \"price\": 80000, \"peak\": true}]',NULL,'Mở cửa tất cả các ngày trong tuần',4.3,38,210,'Sân cầu lông giá rẻ dành cho học sinh, sinh viên tại phường Thống Nhất. Sân đang bảo trì 1 trong 3 sân, 2 sân còn lại hoạt động bình thường.','[\"Giá rẻ cho sinh viên\", \"Gần trường học\", \"Nhận đặt theo tháng\"]','[\"Bãi giữ xe\", \"Nước uống\", \"Quạt trần\"]','[\"https://readdy.ai/api/search-image?query=Basic%20indoor%20badminton%20court%20with%20green%20floor%20mat%20and%20white%20net%2C%20simple%20gym%20hall%20interior%2C%20daylight%2C%20no%20people&width=1000&height=700&seq=bmt-court-bd-05a&orientation=landscape\", \"https://readdy.ai/api/search-image?query=Badminton%20shuttlecock%20on%20wooden%20bench%20beside%20an%20indoor%20court%2C%20soft%20light%2C%20minimal%20clean%20composition%2C%20no%20people&width=1000&height=700&seq=bmt-court-bd-05b&orientation=landscape\"]','06:00','21:00',NULL,'[\"Sân tiêu chuẩn\"]',0,'maintenance','05 Nơ Trang Long, Thống Nhất, Buôn Ma Thuột, Đắk Lắk','',10,NULL,'2026-11-10 15:54:00','2026-11-10 15:54:00'),('c12','cau-long-hoa-thang-arena',NULL,'Cầu lông Hòa Thắng Arena','badminton','Sân cầu lông','Hòa Thắng','210 Lý Thường Kiệt, P. Hòa Thắng, TP. Buôn Ma Thuột',75000,95000,'75.000đ/giờ • Combo 3 giờ 200.000đ','[{\"id\": \"morning\", \"label\": \"Buổi sáng và chiều\", \"shortLabel\": \"Sáng – chiều\", \"start\": \"05:00\", \"end\": \"17:00\", \"price\": 75000}, {\"id\": \"evening\", \"label\": \"Buổi tối\", \"shortLabel\": \"Tối\", \"start\": \"17:00\", \"end\": \"22:00\", \"price\": 95000, \"peak\": true}]',NULL,'Mở cửa tất cả các ngày trong tuần',4.6,81,223,'Sân cầu lông mới khai trương cuối năm 2025 với 5 sân thảm xanh, trần cao và hệ thống thông gió tốt. Có ưu đãi combo 3 giờ cho nhóm đông người.','[\"5 sân mới khai trương\", \"Ưu đãi combo 3 giờ\", \"Thông gió tốt\"]','[\"Bãi giữ xe\", \"Phòng thay đồ\", \"Quạt trần\", \"Nước uống\", \"Wifi miễn phí\"]','[\"https://readdy.ai/api/search-image?query=New%20indoor%20badminton%20arena%20with%20five%20green%20mats%2C%20high%20ceiling%20with%20ventilation%20fans%2C%20bright%20even%20lighting%2C%20modern%20clean%20sports%20hall%2C%20no%20people&width=1000&height=700&seq=bmt-court-bd-06a&orientation=landscape\", \"https://readdy.ai/api/search-image?query=Badminton%20net%20and%20green%20court%20mat%20in%20a%20bright%20air%20conditioned%20sports%20hall%2C%20white%20walls%2C%20minimal%20modern%20interior%2C%20no%20people&width=1000&height=700&seq=bmt-court-bd-06b&orientation=landscape\"]','05:00','22:00',NULL,'[\"Sân tiêu chuẩn\"]',1,'active','210 Lý Thường Kiệt, Hòa Thắng, Buôn Ma Thuột, Đắk Lắk','',11,NULL,'2026-11-10 15:54:00','2026-11-10 15:54:00');
/*!40000 ALTER TABLE `courts` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `inventory_logs`
--

DROP TABLE IF EXISTS `inventory_logs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `inventory_logs` (
  `id` varchar(40) COLLATE utf8mb4_unicode_ci NOT NULL,
  `owner_id` int NOT NULL,
  `service_id` varchar(40) COLLATE utf8mb4_unicode_ci NOT NULL,
  `service_name` varchar(160) COLLATE utf8mb4_unicode_ci NOT NULL,
  `type` enum('import','export','adjust') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'import',
  `quantity` int NOT NULL DEFAULT '0',
  `unit_cost` int NOT NULL DEFAULT '0',
  `note` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_inv_owner` (`owner_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `inventory_logs`
--

LOCK TABLES `inventory_logs` WRITE;
/*!40000 ALTER TABLE `inventory_logs` DISABLE KEYS */;
INSERT INTO `inventory_logs` VALUES ('inv-01',2,'sv-ball','Thuê bóng thi đấu','import',48,6000,'Nhập kho đầu tuần từ đại lý BMT','2026-11-19 14:05:57'),('inv-seed-01',2,'sv-revive','Revive chanh muối','import',120,10000,'Nhập 5 thùng nước giải khát phục vụ cuối tuần','2026-11-18 09:30:00'),('inv-seed-02',2,'sv-water','Nước suối Aquafina 500ml','import',200,5000,'Nhập kho lô nước ngọt lớn từ đại lý Tân An','2026-11-19 10:15:00'),('inv-seed-03',2,'sv-shuttle','Hộp cầu lông (12 quả)','import',25,52000,'Bổ sung ống cầu lông Ba Sao cho sân Victory','2026-11-19 14:00:00'),('inv-seed-04',2,'sv-racket','Thuê vợt cầu lông (Yonex Nanoray)','export',2,0,'Thanh lý 2 vợt gãy khung do va chạm khi khách chơi','2026-11-20 08:30:00'),('inv-seed-05',2,'sv-bib','Thuê áo bib (Cam · Size L)','adjust',12,0,'Kiểm kê định kỳ thứ Sáu hàng tuần','2026-11-20 11:00:00');
/*!40000 ALTER TABLE `inventory_logs` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `notifications`
--

DROP TABLE IF EXISTS `notifications`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `notifications` (
  `id` varchar(40) COLLATE utf8mb4_unicode_ci NOT NULL,
  `user_id` int NOT NULL,
  `title` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL,
  `body` varchar(500) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `type` enum('booking','payment','promo','system') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'system',
  `link` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `is_read` tinyint(1) NOT NULL DEFAULT '0',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_nt_user` (`user_id`,`is_read`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `notifications`
--

LOCK TABLES `notifications` WRITE;
/*!40000 ALTER TABLE `notifications` DISABLE KEYS */;
INSERT INTO `notifications` VALUES ('nt-01',3,'Chào mừng bạn đến với Đặt Sân BMT 24H!','Bạn đang có 2 voucher ưu đãi trong Ví voucher. Đặt sân ngay để áp dụng nhé.','promo','/tai-khoan?tab=vouchers',0,'2026-11-19 14:05:57'),('nt-02',3,'Lịch cố định đang hoạt động','Lịch cố định Sân bóng BMT Arena (Thứ 3 & Thứ 6, 18:00) đã được chủ sân xác nhận.','booking','/tai-khoan?tab=recurring',0,'2026-11-19 14:05:57'),('nt-03',2,'Có đơn đặt sân mới cần duyệt','Kiểm tra danh sách đơn đặt sân hôm nay để xác nhận lịch sớm cho khách.','booking','/chu-san?tab=bookings',0,'2026-11-19 14:05:57'),('nt-hs-01',2,'Đơn đặt sân mới cần duyệt','Khách hàng Trần Thanh Tùng vừa gửi yêu cầu đặt Sân Cầu lông Victory BMT khung giờ 18:00 - 19:00 hôm nay.','booking','/chu-san?tab=bookings',0,'2026-11-20 14:15:00'),('nt-hs-02',2,'Khách đã cọc VietQR thành công','Đơn BMT20261120-001 (Sân bóng BMT Arena) đã nhận thanh toán cọc 150.000đ qua VietQR Vietcombank.','payment','/chu-san?tab=payments',0,'2026-11-20 11:30:00'),('nt-hs-03',2,'Đánh giá 5 sao mới từ khách hàng','Khách hàng Lê Phương Mai vừa đánh giá 5 sao cho cụm sân Cầu lông Victory BMT.','system','/chu-san?tab=customers&sub=reviews',0,'2026-11-20 10:15:00'),('nt-hs-04',2,'Nhắc lịch ca trực nhân viên','Nhân viên Nguyễn Văn Tài (Quản lý ca tối) bắt đầu ca trực từ 16:30 đến 22:30 hôm nay.','system','/chu-san?tab=staff',1,'2026-11-20 08:00:00');
/*!40000 ALTER TABLE `notifications` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `owner_requests`
--

DROP TABLE IF EXISTS `owner_requests`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `owner_requests` (
  `id` varchar(40) COLLATE utf8mb4_unicode_ci NOT NULL,
  `user_id` int NOT NULL,
  `business_name` varchar(160) COLLATE utf8mb4_unicode_ci NOT NULL,
  `contact_name` varchar(120) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `phone` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `email` varchar(190) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `address` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `sports` varchar(40) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'football',
  `court_count` int NOT NULL DEFAULT '1',
  `note` text COLLATE utf8mb4_unicode_ci,
  `status` enum('pending','approved','rejected') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'pending',
  `admin_note` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `reviewed_by` varchar(120) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `reviewed_at` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `user_id` (`user_id`),
  KEY `status` (`status`),
  CONSTRAINT `owner_requests_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `owner_requests`
--

LOCK TABLES `owner_requests` WRITE;
/*!40000 ALTER TABLE `owner_requests` DISABLE KEYS */;
/*!40000 ALTER TABLE `owner_requests` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `owner_services`
--

DROP TABLE IF EXISTS `owner_services`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `owner_services` (
  `id` varchar(40) COLLATE utf8mb4_unicode_ci NOT NULL,
  `owner_id` int NOT NULL,
  `name` varchar(160) COLLATE utf8mb4_unicode_ci NOT NULL,
  `category` enum('drink','rental','food','other') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'drink',
  `sport` enum('all','football','badminton') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'all',
  `unit` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'cái',
  `price` int NOT NULL DEFAULT '0',
  `stock` int NOT NULL DEFAULT '0',
  `has_variants` tinyint(1) NOT NULL DEFAULT '0',
  `attributes_schema` text COLLATE utf8mb4_unicode_ci,
  `active` tinyint(1) NOT NULL DEFAULT '1',
  `sort_order` int NOT NULL DEFAULT '0',
  PRIMARY KEY (`id`),
  KEY `owner_id` (`owner_id`),
  CONSTRAINT `owner_services_ibfk_1` FOREIGN KEY (`owner_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `owner_services`
--

LOCK TABLES `owner_services` WRITE;
/*!40000 ALTER TABLE `owner_services` DISABLE KEYS */;
INSERT INTO `owner_services` VALUES ('sv-ball',2,'Thuê bóng thi đấu','rental','football','quả',20000,12,1,'[{\"name\":\"Loại bóng\",\"options\":[\"Bóng số 4 (Sân 5 người)\",\"Bóng số 5 (Sân 7 & 11 người)\"]}]',1,3),('sv-bib',2,'Thuê áo bib','rental','football','bộ',30000,6,1,'[{\"name\":\"Màu sắc\",\"options\":[\"Cam\",\"Xanh neon\",\"Đỏ\"]},{\"name\":\"Kích cỡ\",\"options\":[\"L (Dưới 70kg)\",\"XL (Trên 70kg)\"]}]',1,4),('sv-racket',2,'Thuê vợt cầu lông','rental','badminton','cây',25000,8,1,'[{\"name\":\"Dòng vợt\",\"options\":[\"Yonex Nanoray\",\"Lining Windstorm\"]},{\"name\":\"Độ căng cước\",\"options\":[\"10.5 kg\",\"11.0 kg\"]}]',1,5),('sv-revive',2,'Revive chanh muối','drink','all','chai',15000,86,0,NULL,1,1),('sv-shuttle',2,'Hộp cầu lông (12 quả)','other','badminton','hộp',65000,15,0,NULL,1,6),('sv-sting',2,'Sting dâu','drink','all','chai',12000,4,0,NULL,1,2),('sv-water',2,'Nước suối Aquafina 500ml','drink','all','chai',10000,120,1,'[{\"name\":\"Quy cách & Nhiệt độ\",\"options\":[\"Chai 500ml (Ướp lạnh)\",\"Chai 500ml (Nhiệt độ phòng)\",\"Chai lớn 1.5L (Ướp lạnh)\"]}]',1,0);
/*!40000 ALTER TABLE `owner_services` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `owner_settings`
--

DROP TABLE IF EXISTS `owner_settings`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `owner_settings` (
  `owner_id` int NOT NULL,
  `deposit_rate` int NOT NULL DEFAULT '30',
  `cancel_cutoff_hours` int NOT NULL DEFAULT '4',
  `hold_minutes` int NOT NULL DEFAULT '5',
  `auto_approve` tinyint(1) NOT NULL DEFAULT '0',
  `policy_note` text COLLATE utf8mb4_unicode_ci,
  `notify_new_booking` tinyint(1) NOT NULL DEFAULT '1',
  `notify_cancel` tinyint(1) NOT NULL DEFAULT '1',
  `notify_review` tinyint(1) NOT NULL DEFAULT '1',
  `bank_name` varchar(120) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `bank_account` varchar(60) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `bank_holder` varchar(120) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`owner_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `owner_settings`
--

LOCK TABLES `owner_settings` WRITE;
/*!40000 ALTER TABLE `owner_settings` DISABLE KEYS */;
INSERT INTO `owner_settings` VALUES (2,30,4,5,0,'Khách đến trước 10 phút để nhận sân. Hủy trước 4 giờ hoàn 100% cọc.',1,1,1,'Vietcombank','0231000688999','TRAN QUOC HUNG','2026-11-19 14:05:57');
/*!40000 ALTER TABLE `owner_settings` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `owner_staff`
--

DROP TABLE IF EXISTS `owner_staff`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `owner_staff` (
  `id` varchar(40) COLLATE utf8mb4_unicode_ci NOT NULL,
  `owner_id` int NOT NULL,
  `full_name` varchar(120) COLLATE utf8mb4_unicode_ci NOT NULL,
  `phone` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `email` varchar(190) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `password_hash` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `role_name` varchar(80) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'Nhân viên lễ tân',
  `permissions` text COLLATE utf8mb4_unicode_ci COMMENT 'JSON',
  `status` enum('active','inactive') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'active',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_staff_owner` (`owner_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `owner_staff`
--

LOCK TABLES `owner_staff` WRITE;
/*!40000 ALTER TABLE `owner_staff` DISABLE KEYS */;
INSERT INTO `owner_staff` VALUES ('st-01',2,'Nguyễn Văn Tài','0935 111 222','tai.nv@hungsport.vn','$2y$10$/M4wh/88l5Jfz0SO64sClOUVmc/IywQptlnFGzJypbI0wZfMvLmtm','Quản lý ca tối','[\"bookings\",\"services\",\"payments\"]','active','2026-11-19 14:05:57'),('st-02',2,'Lê Thị Ngọc','0935 333 444','ngoc.lt@hungsport.vn','$2y$10$/M4wh/88l5Jfz0SO64sClOUVmc/IywQptlnFGzJypbI0wZfMvLmtm','Lễ tân & thu ngân','[\"bookings\",\"services\"]','active','2026-11-19 14:05:57'),('st-03',2,'Trần Đình Trọng','0935 555 666','trong.td@hungsport.vn','$2y$10$/M4wh/88l5Jfz0SO64sClOUVmc/IywQptlnFGzJypbI0wZfMvLmtm','Thu ngân & đối soát ca sáng','[\"bookings\",\"services\",\"payments\"]','active','2026-11-20 15:28:33'),('st-04',2,'Võ Hoàng Yến','0935 777 888','yen.vh@hungsport.vn','$2y$10$/M4wh/88l5Jfz0SO64sClOUVmc/IywQptlnFGzJypbI0wZfMvLmtm','Chăm sóc khách hàng & Voucher','[\"customers\",\"promotions\"]','active','2026-11-20 15:28:33'),('st-05',2,'Đặng Hữu Phúc','0935 999 000','phuc.dh@hungsport.vn','$2y$10$/M4wh/88l5Jfz0SO64sClOUVmc/IywQptlnFGzJypbI0wZfMvLmtm','Kỹ thuật & bảo trì sân cỏ','[\"courts\"]','inactive','2026-11-20 15:29:00');
/*!40000 ALTER TABLE `owner_staff` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `payouts`
--

DROP TABLE IF EXISTS `payouts`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `payouts` (
  `id` varchar(40) COLLATE utf8mb4_unicode_ci NOT NULL,
  `owner_id` int NOT NULL,
  `owner_name` varchar(160) COLLATE utf8mb4_unicode_ci NOT NULL,
  `period_label` varchar(80) COLLATE utf8mb4_unicode_ci NOT NULL,
  `gross_amount` int NOT NULL DEFAULT '0',
  `commission_rate` int NOT NULL DEFAULT '5',
  `commission_amount` int NOT NULL DEFAULT '0',
  `net_amount` int NOT NULL DEFAULT '0',
  `status` enum('pending','transferred') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'pending',
  `note` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `transferred_at` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_payout_owner` (`owner_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `payouts`
--

LOCK TABLES `payouts` WRITE;
/*!40000 ALTER TABLE `payouts` DISABLE KEYS */;
INSERT INTO `payouts` VALUES ('po-01',2,'Hưng Sport BMT','Tháng 11/2026',4850000,5,242500,4607500,'pending','Đối soát doanh thu đặt sân online kỳ hiện tại',NULL,'2026-11-19 14:05:57'),('po-02',5,'Lộc Sport','Tháng 11/2026',2100000,5,105000,1995000,'transferred','Đã chuyển khoản đợt 1 qua VietQR',NULL,'2026-11-19 14:05:57');
/*!40000 ALTER TABLE `payouts` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `promotions`
--

DROP TABLE IF EXISTS `promotions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `promotions` (
  `id` varchar(40) COLLATE utf8mb4_unicode_ci NOT NULL,
  `owner_id` int DEFAULT NULL,
  `owner_name` varchar(160) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `code` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `title` varchar(160) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` varchar(500) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `discount_type` enum('percent','amount') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'percent',
  `discount_value` int NOT NULL DEFAULT '0',
  `max_discount` int DEFAULT NULL,
  `min_order` int NOT NULL DEFAULT '0',
  `start_date` date NOT NULL,
  `end_date` date NOT NULL,
  `weekdays` text COLLATE utf8mb4_unicode_ci COMMENT 'JSON: 1=Thứ Hai … 7=Chủ Nhật',
  `start_time` varchar(5) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `end_time` varchar(5) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `usage_limit` int DEFAULT NULL,
  `status` enum('active','paused') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'active',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `code` (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `promotions`
--

LOCK TABLES `promotions` WRITE;
/*!40000 ALTER TABLE `promotions` DISABLE KEYS */;
INSERT INTO `promotions` VALUES ('promo-hungsport-3',2,'Hưng Sport BMT','VICTORY10','Ưu đãi Cầu lông Cuối tuần','Giảm 10% khi đặt sân cầu lông Victory BMT vào Thứ Bảy hoặc Chủ Nhật.','percent',10,40000,120000,'2026-11-10','2027-01-15','[6,7]','07:00','22:00',200,'active','2026-11-20 15:29:17','2026-11-20 15:29:17'),('promo-hungsport-4',2,'Hưng Sport BMT','TRIAN50','Tri ân khách hàng thân thiết 50K','Chương trình tri ân đã tạm dừng đón đợt khuyến mãi Tết.','amount',50000,NULL,500000,'2026-10-15','2026-11-15','[]','','',50,'paused','2026-11-20 15:29:17','2026-11-20 15:29:17'),('promo-seed-1',2,'Hưng Sport BMT','GIOVANG','Giờ vàng buổi sáng','Giảm 20% cho các khung giờ sáng từ 05:00 đến 15:00 từ Thứ 2 đến Thứ 6.','percent',20,60000,100000,'2026-10-01','2026-12-31','[1,2,3,4,5]','05:00','15:00',300,'active','2026-11-10 15:54:00','2026-11-20 15:29:17'),('promo-seed-2',2,'Hưng Sport BMT','BMT30K','Giảm 30K cho hóa đơn từ 300K','Áp dụng cho mọi khung giờ, tất cả các ngày trong tuần tại cụm sân Hưng Sport.','amount',30000,NULL,300000,'2026-11-01','2026-12-15','[]','','',150,'active','2026-11-10 15:54:00','2026-11-20 15:29:17'),('promo-seed-3',5,'Lộc Sport','CUOITUAN','Cuối tuần sôi động','Giảm 10% cho đơn đặt Thứ Bảy, Chủ Nhật.','percent',10,50000,0,'2026-11-07','2027-01-09','[6,7]','','',NULL,'active','2026-11-10 15:54:00','2026-11-10 15:54:00'),('promo-seed-4',NULL,'Hệ thống BMT 24H','CHAOMUNG','Chào mừng thành viên mới','Giảm 15% cho lần đặt sân đầu tiên.','percent',15,40000,0,'2026-11-15','2027-02-08','[]','','',500,'active','2026-11-10 15:54:00','2026-11-10 15:54:00');
/*!40000 ALTER TABLE `promotions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `recurring_bookings`
--

DROP TABLE IF EXISTS `recurring_bookings`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `recurring_bookings` (
  `id` varchar(40) COLLATE utf8mb4_unicode_ci NOT NULL,
  `court_id` varchar(40) COLLATE utf8mb4_unicode_ci NOT NULL,
  `court_name` varchar(160) COLLATE utf8mb4_unicode_ci NOT NULL,
  `owner_id` int DEFAULT NULL,
  `customer_id` int DEFAULT NULL,
  `customer_name` varchar(120) COLLATE utf8mb4_unicode_ci NOT NULL,
  `customer_phone` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `weekdays` text COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'JSON: 1=T2..7=CN',
  `start_slot` varchar(5) COLLATE utf8mb4_unicode_ci NOT NULL,
  `duration_minutes` int NOT NULL DEFAULT '60',
  `start_date` date NOT NULL,
  `end_date` date NOT NULL,
  `price_per_session` int NOT NULL DEFAULT '0',
  `status` enum('active','paused','cancelled') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'active',
  `note` varchar(500) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_rec_owner` (`owner_id`),
  KEY `idx_rec_customer` (`customer_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `recurring_bookings`
--

LOCK TABLES `recurring_bookings` WRITE;
/*!40000 ALTER TABLE `recurring_bookings` DISABLE KEYS */;
INSERT INTO `recurring_bookings` VALUES ('rec-01','c01','Sân bóng BMT Arena',2,10,'Trần Thanh Tùng','0913 888 999','[2,5]','18:00',120,'2026-11-01','2027-02-28',480000,'active','Đội FC Ea Tam đá cố định tối Thứ 3 & Thứ 6 hằng tuần.','2026-11-19 14:05:57'),('rec-02','c10','Cầu lông Victory BMT',2,11,'Lê Phương Mai','0932 777 666','[3,6]','19:00',60,'2026-11-01','2027-01-31',130000,'active','Nhóm Cầu lông Victory sinh hoạt định kỳ Thứ 4 & Thứ 7.','2026-11-19 14:05:57'),('rec-03','c06','Sân bóng Tân An',2,12,'Bùi Văn Khoa','0912 774 019','[1,4]','17:30',90,'2026-11-10','2027-02-10',300000,'active','Đội FC Báo chí Đắk Lắk đá giao hữu chiều Thứ 2 & Thứ 5.','2026-11-20 15:29:17'),('rec-04','c10','Cầu lông Victory BMT',2,9,'Hoàng Minh Đức','0905 123 456','[7]','06:00',120,'2026-11-15','2027-03-30',180000,'active','CLB Cầu lông Sáng Khỏe tập luyện sáng Chủ Nhật hằng tuần.','2026-11-20 15:29:17');
/*!40000 ALTER TABLE `recurring_bookings` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `refunds`
--

DROP TABLE IF EXISTS `refunds`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `refunds` (
  `id` varchar(40) COLLATE utf8mb4_unicode_ci NOT NULL,
  `owner_id` int NOT NULL,
  `booking_code` varchar(40) COLLATE utf8mb4_unicode_ci NOT NULL,
  `customer_name` varchar(120) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `court_name` varchar(160) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `amount` int NOT NULL DEFAULT '0',
  `method` enum('cash','transfer','vietqr') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'cash',
  `note` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `owner_id` (`owner_id`),
  CONSTRAINT `refunds_ibfk_1` FOREIGN KEY (`owner_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `refunds`
--

LOCK TABLES `refunds` WRITE;
/*!40000 ALTER TABLE `refunds` DISABLE KEYS */;
INSERT INTO `refunds` VALUES ('rf-seed-01',2,'BMT20261114-045','Trần Thanh Tùng','Sân bóng BMT Arena',60000,'vietqr','Hoàn 100% tiền cọc cho khách do mưa bão lớn ngập sân chiều 14/11.','2026-11-14 17:30:00'),('rf-seed-02',2,'BMT20261117-088','Phan Hữu Đạt','Sân bóng Tân An',100000,'transfer','Khách báo hủy trước 8 tiếng theo đúng chính sách hoàn tiền của sân.','2026-11-17 11:20:00'),('rf-seed-03',2,'BMT20261119-041','Lê Phương Mai','Cầu lông Victory BMT',50000,'cash','Trả lại tiền thừa dịch vụ trực tiếp tại quầy thanh toán.','2026-11-19 20:15:00');
/*!40000 ALTER TABLE `refunds` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `reports`
--

DROP TABLE IF EXISTS `reports`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `reports` (
  `id` varchar(40) COLLATE utf8mb4_unicode_ci NOT NULL,
  `target_type` enum('review','court','account','booking') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'review',
  `target_id` varchar(60) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `target_label` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `reporter_name` varchar(120) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `reporter_contact` varchar(160) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `reason` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `detail` text COLLATE utf8mb4_unicode_ci,
  `severity` enum('low','medium','high') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'medium',
  `status` enum('open','reviewing','resolved','rejected') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'open',
  `resolution_note` varchar(500) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `resolved_at` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `reports`
--

LOCK TABLES `reports` WRITE;
/*!40000 ALTER TABLE `reports` DISABLE KEYS */;
INSERT INTO `reports` VALUES ('rp-hungsport-1','court','c10','Cầu lông Victory BMT','Nguyễn Hải Nam','0918 223 344','Đề xuất bổ sung nước uống điện giải','Căng tin nên nhập thêm nước Pocari Sweat hoặc Revive chanh muối lạnh vì buổi tối anh em đánh cầu tiêu hao nhiều nước.','low','open','',NULL,'2026-11-20 09:30:00','2026-11-20 09:30:00'),('rp-hungsport-2','booking','BMT20261118-091','Đơn BMT20261118-091 – Sân bóng BMT Arena','Trần Văn Thắng','0905 889 911','Đèn sân góc phải hơi chập chờn','Khung giờ tối qua cột đèn số 3 góc khán đài thỉnh thoảng nhấp nháy, nhờ sân kiểm tra lại giúp anh em.','medium','resolved','Đã cho nhân viên kỹ thuật thay chấn lưu mới sáng nay, hoạt động bình thường.','2026-11-19 10:00:00','2026-11-18 21:00:00','2026-11-18 21:00:00'),('rp-seed-1','review','rv-seed-07','Đánh giá của Phan Gia Bảo – Cầu lông Hòa Thắng Arena','Chủ sân Hòa Thắng Arena','0905 000 111','Nội dung quảng cáo','Đánh giá chứa số điện thoại bán hàng, không liên quan tới sân.','high','resolved','',NULL,'2026-11-08 15:54:00','2026-11-10 15:54:00'),('rp-seed-2','court','c02','Sân bóng FC Đắk Lắk','Đỗ Quang Huy','huy.do@gmail.com','Thông tin giá chưa đúng','Giá niêm yết sân 7 trên web thấp hơn giá thu thực tế 30.000đ.','medium','open','',NULL,'2026-11-09 15:54:00','2026-11-10 15:54:00'),('rp-seed-3','booking','BMT20261103-174','Đơn BMT20261103-174','Nguyễn Văn Tâm','0977 123 456','Không được hoàn cọc','Đơn đã hủy trước 6 tiếng nhưng chưa nhận lại tiền cọc.','high','reviewing','',NULL,'2026-11-10 10:54:00','2026-11-10 15:54:00'),('rp-seed-4','account','5','Tài khoản Lộc Sport','Khách ẩn danh','Chưa cung cấp','Chủ sân phản hồi thiếu lịch sự','Nhắn tin hỏi giá nhưng bị trả lời cộc lốc.','low','open','',NULL,'2026-11-07 15:54:00','2026-11-10 15:54:00');
/*!40000 ALTER TABLE `reports` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `reviews`
--

DROP TABLE IF EXISTS `reviews`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `reviews` (
  `id` varchar(40) COLLATE utf8mb4_unicode_ci NOT NULL,
  `booking_id` varchar(40) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'NULL = đánh giá công khai không gắn đơn',
  `booking_code` varchar(40) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `court_id` varchar(40) COLLATE utf8mb4_unicode_ci NOT NULL,
  `customer_name` varchar(120) COLLATE utf8mb4_unicode_ci NOT NULL,
  `booking_label` varchar(120) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `rating` tinyint NOT NULL,
  `comment` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `tags` text COLLATE utf8mb4_unicode_ci COMMENT 'JSON',
  `owner_reply` text COLLATE utf8mb4_unicode_ci,
  `owner_replied_at` datetime DEFAULT NULL,
  `moderation_status` enum('approved','pending','hidden') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'approved',
  `moderation_note` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `moderated_by` varchar(160) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `booking_id` (`booking_id`),
  KEY `idx_court` (`court_id`),
  CONSTRAINT `reviews_ibfk_1` FOREIGN KEY (`court_id`) REFERENCES `courts` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `reviews`
--

LOCK TABLES `reviews` WRITE;
/*!40000 ALTER TABLE `reviews` DISABLE KEYS */;
INSERT INTO `reviews` VALUES ('rv-hungsport-01',NULL,NULL,'c05','Hoàng Minh Đức','Đã đá tại sân Ea Tam Sport',5,'Mặt cỏ sân Ea Tam rất êm, hệ thống đèn chiếu sáng tốt và bãi giữ xe thoải mái. Nhóm mình đá giải phong trào rất hài lòng!','[\"M\\u1eb7t s\\u00e2n t\\u1ed1t\",\"\\u0110\\u00e8n s\\u00e1ng\",\"B\\u00e3i xe r\\u1ed9ng\"]','Cảm ơn anh Đức và đội bóng đã ủng hộ Ea Tam Sport!','2026-11-19 18:00:00','approved','','','2026-11-19 16:30:00'),('rv-hungsport-02',NULL,NULL,'c10','Lê Phương Mai','Đã chơi tại Cầu lông Victory BMT',5,'Sân thảm tiêu chuẩn BWF, trần cao không bị chói đèn. Nhân viên quầy rất niềm nở, cho mượn dụng cụ chu đáo.','[\"Th\\u1ea3m \\u00eam\",\"Nh\\u00e2n vi\\u00ean th\\u00e2n thi\\u1ec7n\"]',NULL,NULL,'approved','','','2026-11-20 10:15:00'),('rv-seed-01','cb-b04','BMT20261030-204','c06','Nguyễn Minh Quân','Lượt chơi đã hoàn thành',5,'Sân cỏ mới, đèn sáng đều, chủ sân hỗ trợ nhiệt tình. Sẽ quay lại cùng đội!','[\"Mặt sân tốt\", \"Đèn sáng\", \"Nhân viên thân thiện\"]','Cảm ơn anh Quân và cả đội, hẹn gặp lại các anh tuần sau nhé!','2026-11-04 15:54:00','approved','','','2026-11-03 15:54:00'),('rv-seed-02','cb-b05','BMT20261022-119','c07','Nguyễn Minh Quân','Lượt chơi đã hoàn thành',4,'Nhà thi đấu rộng, thảm tốt, giờ cao điểm hơi đông nhưng vẫn ổn.','[\"Sạch sẽ\", \"Thảm đẹp\"]',NULL,NULL,'approved','','','2026-10-26 15:54:00'),('rv-seed-03',NULL,NULL,'c01','Trần Thanh Tùng','Khách ghé sân',5,'Đá tối thứ 6 rất thích, mặt cỏ êm chân, bãi xe rộng rãi.','[\"Mặt sân tốt\", \"Bãi xe rộng\"]','Cảm ơn anh Tùng đã ủng hộ BMT Arena!','2026-11-08 15:54:00','approved','','','2026-11-07 15:54:00'),('rv-seed-04',NULL,NULL,'c01','Lê Hoàng Phúc','Khách ghé sân',4,'Giá hợp lý, chỉ mong căng tin có thêm nước điện giải.','[\"Giá hợp lý\"]',NULL,NULL,'approved','','','2026-11-01 15:54:00'),('rv-seed-05',NULL,NULL,'c10','Võ Ngọc Anh','Khách ghé sân',5,'Sân VIP có điều hòa, trần cao, đánh rất đã. Đặt online nhanh gọn.','[\"Có điều hòa\", \"Đặt nhanh\"]',NULL,NULL,'approved','','','2026-11-06 15:54:00'),('rv-seed-06',NULL,NULL,'c02','Đỗ Quang Huy','Khách ghé sân',3,'Mặt sân ổn nhưng hôm mình đá đèn một trụ bị yếu.','[\"Mặt sân tốt\"]',NULL,NULL,'approved','','','2026-10-29 15:54:00'),('rv-seed-07',NULL,NULL,'c12','Phan Gia Bảo','Khách ghé sân',2,'Spam quảng cáo bán giày tại zalo 09xx...','[]',NULL,NULL,'hidden','Nội dung quảng cáo, vi phạm quy định','','2026-11-08 15:54:00');
/*!40000 ALTER TABLE `reviews` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `service_variants`
--

DROP TABLE IF EXISTS `service_variants`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `service_variants` (
  `id` varchar(40) COLLATE utf8mb4_unicode_ci NOT NULL,
  `service_id` varchar(40) COLLATE utf8mb4_unicode_ci NOT NULL,
  `owner_id` int NOT NULL,
  `sku` varchar(60) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `name` varchar(160) COLLATE utf8mb4_unicode_ci NOT NULL,
  `attributes` text COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'JSON: {"Màu sắc":"Cam","Kích cỡ":"L"}',
  `price` int NOT NULL DEFAULT '0',
  `stock` int NOT NULL DEFAULT '0',
  `active` tinyint(1) NOT NULL DEFAULT '1',
  `sort_order` int NOT NULL DEFAULT '0',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_sv_service` (`service_id`),
  KEY `idx_sv_owner` (`owner_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `service_variants`
--

LOCK TABLES `service_variants` WRITE;
/*!40000 ALTER TABLE `service_variants` DISABLE KEYS */;
INSERT INTO `service_variants` VALUES ('sv-ball-v1','sv-ball',2,'BALL-S4','Bóng số 4 (Sân 5 người)','{\"Loại bóng\":\"Bóng số 4 (Sân 5 người)\"}',20000,8,1,14,'2026-11-20 14:31:35','2026-11-20 14:31:35'),('sv-ball-v2','sv-ball',2,'BALL-S5','Bóng số 5 (Sân 7 & 11 người)','{\"Loại bóng\":\"Bóng số 5 (Sân 7 & 11 người)\"}',30000,6,1,15,'2026-11-20 14:31:35','2026-11-20 14:31:35'),('sv-bib-v1','sv-bib',2,'BIB-CAM-L','Màu Cam · Size L','{\"Màu sắc\":\"Cam\",\"Kích cỡ\":\"L (Dưới 70kg)\"}',30000,12,1,1,'2026-11-20 14:31:35','2026-11-20 14:31:35'),('sv-bib-v2','sv-bib',2,'BIB-CAM-XL','Màu Cam · Size XL','{\"Màu sắc\":\"Cam\",\"Kích cỡ\":\"XL (Trên 70kg)\"}',30000,8,1,2,'2026-11-20 14:31:35','2026-11-20 14:31:35'),('sv-bib-v3','sv-bib',2,'BIB-XANH-L','Màu Xanh neon · Size L','{\"Màu sắc\":\"Xanh neon\",\"Kích cỡ\":\"L (Dưới 70kg)\"}',30000,15,1,3,'2026-11-20 14:31:35','2026-11-20 14:31:35'),('sv-bib-v4','sv-bib',2,'BIB-XANH-XL','Màu Xanh neon · Size XL','{\"Màu sắc\":\"Xanh neon\",\"Kích cỡ\":\"XL (Trên 70kg)\"}',30000,10,1,4,'2026-11-20 14:31:35','2026-11-20 14:31:35'),('sv-bib-v5','sv-bib',2,'BIB-DO-L','Màu Đỏ · Size L','{\"Màu sắc\":\"Đỏ\",\"Kích cỡ\":\"L (Dưới 70kg)\"}',30000,10,1,5,'2026-11-20 14:31:35','2026-11-20 14:31:35'),('sv-bib-v6','sv-bib',2,'BIB-DO-XL','Màu Đỏ · Size XL','{\"Màu sắc\":\"Đỏ\",\"Kích cỡ\":\"XL (Trên 70kg)\"}',30000,10,1,6,'2026-11-20 14:31:35','2026-11-20 14:31:35'),('sv-racket-v1','sv-racket',2,'VOT-YN-105','Yonex Nanoray · 10.5 kg','{\"Dòng vợt\":\"Yonex Nanoray\",\"Độ căng cước\":\"10.5 kg\"}',25000,6,1,7,'2026-11-20 14:31:35','2026-11-20 14:31:35'),('sv-racket-v2','sv-racket',2,'VOT-YN-110','Yonex Nanoray · 11.0 kg','{\"Dòng vợt\":\"Yonex Nanoray\",\"Độ căng cước\":\"11.0 kg\"}',30000,4,1,8,'2026-11-20 14:31:35','2026-11-20 14:31:35'),('sv-racket-v3','sv-racket',2,'VOT-LN-105','Lining Windstorm · 10.5 kg','{\"Dòng vợt\":\"Lining Windstorm\",\"Độ căng cước\":\"10.5 kg\"}',25000,5,1,9,'2026-11-20 14:31:35','2026-11-20 14:31:35'),('sv-racket-v4','sv-racket',2,'VOT-LN-110','Lining Windstorm · 11.0 kg','{\"Dòng vợt\":\"Lining Windstorm\",\"Độ căng cước\":\"11.0 kg\"}',30000,5,1,10,'2026-11-20 14:31:35','2026-11-20 14:31:35'),('sv-water-v1','sv-water',2,'AQ-500-COLD','Chai 500ml · Ướp lạnh','{\"Quy cách & Nhiệt độ\":\"Chai 500ml (Ướp lạnh)\"}',10000,60,1,11,'2026-11-20 14:31:35','2026-11-20 14:31:35'),('sv-water-v2','sv-water',2,'AQ-500-ROOM','Chai 500ml · Nhiệt độ phòng','{\"Quy cách & Nhiệt độ\":\"Chai 500ml (Nhiệt độ phòng)\"}',10000,40,1,12,'2026-11-20 14:31:35','2026-11-20 14:31:35'),('sv-water-v3','sv-water',2,'AQ-1500-COLD','Chai lớn 1.5L · Ướp lạnh','{\"Quy cách & Nhiệt độ\":\"Chai lớn 1.5L (Ướp lạnh)\"}',20000,20,1,13,'2026-11-20 14:31:35','2026-11-20 14:31:35');
/*!40000 ALTER TABLE `service_variants` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `system_settings`
--

DROP TABLE IF EXISTS `system_settings`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `system_settings` (
  `skey` varchar(80) COLLATE utf8mb4_unicode_ci NOT NULL,
  `svalue` text COLLATE utf8mb4_unicode_ci,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`skey`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `system_settings`
--

LOCK TABLES `system_settings` WRITE;
/*!40000 ALTER TABLE `system_settings` DISABLE KEYS */;
/*!40000 ALTER TABLE `system_settings` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `user_vouchers`
--

DROP TABLE IF EXISTS `user_vouchers`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `user_vouchers` (
  `id` varchar(40) COLLATE utf8mb4_unicode_ci NOT NULL,
  `user_id` int NOT NULL,
  `code` varchar(40) COLLATE utf8mb4_unicode_ci NOT NULL,
  `title` varchar(160) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` varchar(300) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `discount_type` enum('percent','amount','gift') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'percent',
  `discount_value` int NOT NULL DEFAULT '0',
  `min_order` int NOT NULL DEFAULT '0',
  `source` enum('promo','wheel','system') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'promo',
  `status` enum('available','used','expired') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'available',
  `expires_at` date DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_uv_user_code` (`user_id`,`code`),
  KEY `idx_uv_user` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `user_vouchers`
--

LOCK TABLES `user_vouchers` WRITE;
/*!40000 ALTER TABLE `user_vouchers` DISABLE KEYS */;
INSERT INTO `user_vouchers` VALUES ('uv-01',3,'BMT10','Giảm 10% khung giờ sáng – chiều','Áp dụng cho đơn đặt sân từ 150.000đ trên toàn hệ thống.','percent',10,150000,'promo','available','2026-12-19','2026-11-19 14:05:57'),('uv-02',3,'VONGQUAY20K','Voucher 20.000đ từ Vòng quay ưu đãi','Quà tặng thành viên Đặt Sân BMT 24H, dùng cho mọi sân.','amount',20000,100000,'wheel','available','2026-12-19','2026-11-19 14:05:57');
/*!40000 ALTER TABLE `user_vouchers` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `users`
--

DROP TABLE IF EXISTS `users`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `users` (
  `id` int NOT NULL AUTO_INCREMENT,
  `email` varchar(190) COLLATE utf8mb4_unicode_ci NOT NULL,
  `password_hash` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `full_name` varchar(120) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `phone` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `address` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `role` enum('customer','owner','admin') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'customer',
  `business_name` varchar(160) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `status` enum('active','suspended') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'active',
  `favorites` text COLLATE utf8mb4_unicode_ci COMMENT 'JSON: danh sách slug sân yêu thích',
  `reset_token` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `reset_expires` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `email` (`email`)
) ENGINE=InnoDB AUTO_INCREMENT=14 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `users`
--

LOCK TABLES `users` WRITE;
/*!40000 ALTER TABLE `users` DISABLE KEYS */;
INSERT INTO `users` VALUES (1,'admin@bmt24h.vn','$2y$10$a3MJzgR2ejrgmG2riBVNnuGQXDBMHKxEXoMGOguS2wgJHSnqjU3kW','Quản trị viên BMT','0262 399 8888','TP. Buôn Ma Thuột','admin','','active','[]',NULL,NULL,'2025-01-01 08:00:00','2026-11-10 15:54:00'),(2,'chusan@bmt24h.vn','$2y$10$a3MJzgR2ejrgmG2riBVNnuGQXDBMHKxEXoMGOguS2wgJHSnqjU3kW','Trần Quốc Hưng','0935 771 246','58 Nguyễn Tất Thành, P. Tân An, TP. Buôn Ma Thuột','owner','Hưng Sport BMT','active','[]',NULL,NULL,'2025-01-12 09:00:00','2026-11-10 15:54:00'),(3,'khach@bmt24h.vn','$2y$10$a3MJzgR2ejrgmG2riBVNnuGQXDBMHKxEXoMGOguS2wgJHSnqjU3kW','Nguyễn Minh Quân','0912 345 678','45 Lê Duẩn, P. Tân Lợi, TP. Buôn Ma Thuột','customer','','active','[\"san-bong-bmt-arena\", \"cau-long-victory-bmt\"]',NULL,NULL,'2025-03-18 10:00:00','2026-11-10 15:54:00'),(4,'kiemduyet@bmt24h.vn','$2y$10$a3MJzgR2ejrgmG2riBVNnuGQXDBMHKxEXoMGOguS2wgJHSnqjU3kW','Lê Thu Hà','0905 112 233','TP. Buôn Ma Thuột','admin','','active','[]',NULL,NULL,'2025-06-02 10:00:00','2026-11-10 15:54:00'),(5,'chusan2@bmt24h.vn','$2y$10$a3MJzgR2ejrgmG2riBVNnuGQXDBMHKxEXoMGOguS2wgJHSnqjU3kW','Phạm Văn Lộc','0918 556 778','P. Tân An, TP. Buôn Ma Thuột','owner','Lộc Sport','active','[]',NULL,NULL,'2025-04-20 10:00:00','2026-11-10 15:54:00'),(9,'duc.hm@gmail.com','$2y$10$7C3NZz2RFWPIjUf/9VnqAuMbP6sN4b1yLX.VCJnDjU.6uJ4yMv2oG','Hoàng Minh Đức','0905 123 456','12 Phan Bội Châu, TP. Buôn Ma Thuột','customer','','active','[]',NULL,NULL,'2026-10-01 08:00:00','2026-11-10 15:00:00'),(10,'tung.tt@gmail.com','$2y$10$7C3NZz2RFWPIjUf/9VnqAuMbP6sN4b1yLX.VCJnDjU.6uJ4yMv2oG','Trần Thanh Tùng','0913 888 999','45 Yersin, TP. Buôn Ma Thuột','customer','','active','[]',NULL,NULL,'2026-10-01 08:00:00','2026-11-10 15:00:00'),(11,'mai.lp@gmail.com','$2y$10$7C3NZz2RFWPIjUf/9VnqAuMbP6sN4b1yLX.VCJnDjU.6uJ4yMv2oG','Lê Phương Mai','0932 777 666','78 Hùng Vương, TP. Buôn Ma Thuột','customer','','active','[]',NULL,NULL,'2026-10-01 08:00:00','2026-11-10 15:00:00'),(12,'khoa.bv@gmail.com','$2y$10$7C3NZz2RFWPIjUf/9VnqAuMbP6sN4b1yLX.VCJnDjU.6uJ4yMv2oG','Bùi Văn Khoa','0912 774 019','89 Trần Phú, TP. Buôn Ma Thuột','customer','','active','[]',NULL,NULL,'2026-10-01 08:00:00','2026-11-10 15:00:00'),(13,'dat.ph@gmail.com','$2y$10$7C3NZz2RFWPIjUf/9VnqAuMbP6sN4b1yLX.VCJnDjU.6uJ4yMv2oG','Phan Hữu Đạt','0908 444 555','102 Ama Khê, TP. Buôn Ma Thuột','customer','','active','[]',NULL,NULL,'2026-10-01 08:00:00','2026-11-10 15:00:00');
/*!40000 ALTER TABLE `users` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `wheel_spins`
--

DROP TABLE IF EXISTS `wheel_spins`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `wheel_spins` (
  `id` varchar(40) COLLATE utf8mb4_unicode_ci NOT NULL,
  `user_id` int NOT NULL,
  `prize_code` varchar(40) COLLATE utf8mb4_unicode_ci NOT NULL,
  `prize_title` varchar(160) COLLATE utf8mb4_unicode_ci NOT NULL,
  `prize_desc` varchar(300) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `spun_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_ws_user_time` (`user_id`,`spun_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `wheel_spins`
--

LOCK TABLES `wheel_spins` WRITE;
/*!40000 ALTER TABLE `wheel_spins` DISABLE KEYS */;
/*!40000 ALTER TABLE `wheel_spins` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-11-20 15:30:01
