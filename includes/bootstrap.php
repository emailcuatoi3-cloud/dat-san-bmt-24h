<?php
/**
 * Nạp cấu hình, kết nối CSDL, phiên đăng nhập và các hàm dùng chung.
 * Mọi trang (index.php) và mọi API (api/*.php) đều require file này đầu tiên.
 */
require_once __DIR__ . '/../database/config.php';

if (session_status() !== PHP_SESSION_ACTIVE) {
    session_name('BMT24HSESSID');
    session_set_cookie_params(['lifetime' => 0, 'path' => '/', 'httponly' => true, 'samesite' => 'Lax']);
    session_start();
}

require_once __DIR__ . '/db.php';
require_once __DIR__ . '/helpers.php';
require_once __DIR__ . '/auth.php';
require_once __DIR__ . '/data.php';
require_once __DIR__ . '/content.php';
