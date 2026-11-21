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

// ---- PSR-4 Autoloader cho Core, Models và Controllers ----
spl_autoload_register(function (string $class): void {
    $prefixes = [
        'Core\\' => __DIR__ . '/Core/',
        'Models\\' => __DIR__ . '/Models/',
        'Controllers\\' => __DIR__ . '/Controllers/',
    ];
    foreach ($prefixes as $prefix => $baseDir) {
        $len = strlen($prefix);
        if (strncmp($prefix, $class, $len) === 0) {
            $relativeClass = substr($class, $len);
            $file = $baseDir . str_replace('\\', '/', $relativeClass) . '.php';
            if (is_file($file)) {
                require_once $file;
                return;
            }
        }
    }
});

require_once __DIR__ . '/migrations.php';
ensure_sitemap_schema();
require_once __DIR__ . '/auth.php';
require_once __DIR__ . '/data.php';
require_once __DIR__ . '/content.php';
require_once __DIR__ . '/chatbot.php';
