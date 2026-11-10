<?php
/**
 * BỘ ĐỊNH TUYẾN (front controller).
 * Apache dùng .htaccess để chuyển mọi URL về file này.
 * Chạy thử nhanh không cần Apache:  php -S localhost:8000 index.php
 */

// Khi chạy bằng PHP built-in server: để server tự trả file tĩnh (css/js/ảnh)
if (PHP_SAPI === 'cli-server') {
    $file = __DIR__ . parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
    if (is_file($file) && !preg_match('/\.(php|sql|md)$/i', $file)) return false;
    if (preg_match('#^/api/([a-z_-]+)\.php#', parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH), $m) && is_file(__DIR__ . '/api/' . $m[1] . '.php')) {
        require __DIR__ . '/api/' . $m[1] . '.php';
        return true;
    }
}

require_once __DIR__ . '/includes/bootstrap.php';
require_once __DIR__ . '/includes/layout.php';

$path = current_path();
$params = [];

$routes = [
    '#^/$#' => 'home', 
    '#^/tim-san$#' => 'courts',
    '#^/san/([^/]+)$#' => 'court-detail',
    '#^/ban-do$#' => 'map',
    '#^/ngau-nhien$#' => 'random',
    '#^/dat-san(?:/([^/]+))?$#' => 'booking',
    '#^/don-dat-san/([^/]+)$#' => 'booking-detail',
    '#^/uu-dai$#' => 'promotions',
    '#^/gioi-thieu$#' => 'about',
    '#^/lien-he$#' => 'contact',
    '#^/dang-nhap$#' => 'auth-login',
    '#^/dang-ky$#' => 'auth-register',
    '#^/quen-mat-khau$#' => 'auth-forgot',
    '#^/dat-lai-mat-khau$#' => 'auth-reset',
    '#^/tai-khoan$#' => 'account',
    '#^/chu-san$#' => 'owner',
    '#^/quan-tri$#' => 'admin',
];

// Các đường dẫn cũ chuyển hướng về cổng đăng nhập/đăng ký chung
$aliases = ['/chu-san/dang-nhap' => '/dang-nhap', '/chu-san/dang-ky' => '/dang-ky?vai-tro=owner', '/quan-tri/dang-nhap' => '/dang-nhap'];
if (isset($aliases[$path])) redirect($aliases[$path]);

if ($path === '/dang-xuat') {
    logout_user();
    redirect('/');
}

$page = 'not-found';
foreach ($routes as $pattern => $name) {
    if (preg_match($pattern, $path, $m)) {
        $page = $name;
        $params = array_map('rawurldecode', array_slice($m, 1));
        break;
    }
}

// ---- Bảo vệ khu chủ sân / quản trị ----
if ($page === 'owner' || $page === 'admin') {
    $u = current_user();
    if (!$u) redirect('/dang-nhap?redirect=' . urlencode($path . (empty($_SERVER['QUERY_STRING']) ? '' : '?' . $_SERVER['QUERY_STRING'])));
    if ($page === 'owner') {
        if ($u['role'] !== 'owner') redirect('/?thong-bao=khong-phai-chu-san&vai-tro=' . $u['role']);
        if ($u['status'] !== 'active') redirect('/?thong-bao=chu-san-bi-khoa');
    } else {
        if ($u['role'] !== 'admin') redirect('/?thong-bao=khong-co-quyen&vai-tro=' . $u['role']);
        if ($u['status'] !== 'active') redirect('/?thong-bao=tai-khoan-bi-khoa');
    }
}

if ($page === 'not-found') http_response_code(404);
require __DIR__ . '/pages/' . $page . '.php';
