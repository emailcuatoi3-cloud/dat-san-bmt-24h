<?php
/**
 * Khung trang: <head>, thanh menu, chân trang, chatbot và nạp script.
 *
 * render_page([
 *   'title' => 'Tiêu đề', 'description' => '...',
 *   'transparentHeader' => false,      // menu trong suốt khi ở đầu trang (trang chủ)
 *   'layout' => 'site' | 'bare',       // bare: không có menu/chân trang (trang đăng nhập, dashboard)
 *   'script' => 'pages/home.js',       // module JS riêng của trang
 *   'data' => [...],                   // dữ liệu nhúng cho JS: window.PAGE
 * ], function () { ...HTML... });
 */

/** In thuộc tính class đổi theo trạng thái menu trong suốt / nền đặc. */
function tcls(bool $transparent, string $t, string $s, string $base = ''): string
{
    if (!$transparent) return 'class="' . e(trim("$base $s")) . '"';
    return 'class="' . e(trim("$base $t")) . '" data-tcls="' . e($t) . '" data-scls="' . e($s) . '"';
}

function app_config(): array
{
    return [
        'base' => base_path(),
        'user' => public_profile(current_user()),
        'hotline' => HOTLINE,
        'bank' => ['bin' => BANK_BIN, 'name' => BANK_NAME, 'account' => BANK_ACCOUNT, 'accountName' => BANK_ACCOUNT_NAME],
        'depositRate' => DEPOSIT_RATE,
        'holdMinutes' => HOLD_MINUTES,
        'autoConfirmSeconds' => AUTO_CONFIRM_SECONDS,
        'cancelCutoffHours' => CANCEL_CUTOFF_HOURS,
        'today' => date('Y-m-d'),
    ];
}

function render_head(array $opt): void
{
    $title = $opt['title'] ?? (SITE_NAME . ' - Đặt sân bóng đá & cầu lông Buôn Ma Thuột');
    $desc = $opt['description'] ?? 'Đặt Sân BMT 24H giúp bạn tìm và đặt sân bóng đá, sân cầu lông tại Buôn Ma Thuột, Đắk Lắk. Giá thuê minh bạch, xem khung giờ trống và đặt sân chỉ trong vài thao tác.';
    ?>
<!doctype html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title><?= e($title) ?></title>
  <meta name="description" content="<?= e($desc) ?>">
  <meta name="keywords" content="đặt sân bóng đá Buôn Ma Thuột, sân cầu lông Buôn Ma Thuột, thuê sân thể thao Đắk Lắk, đặt sân online BMT 24H">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="<?= e(SITE_NAME) ?>">
  <meta property="og:title" content="<?= e($title) ?>">
  <meta property="og:description" content="<?= e($desc) ?>">
  <meta property="og:locale" content="vi_VN">
  <link rel="icon" href="<?= asset('img/favicon.svg') ?>" type="image/svg+xml">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Plus+Jakarta+Sans:wght@500;600;700;800&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="<?= asset('vendor/remixicon/remixicon.css') ?>">
  <link rel="stylesheet" href="<?= asset('css/app.css') ?>">
  <script>
    // Áp dụng giao diện sáng/tối trước khi vẽ trang để không bị nháy màu.
    (function () {
      var theme = null;
      try { theme = localStorage.getItem('bmt24h-theme'); } catch (e) {}
      if (theme !== 'light' && theme !== 'dark') {
        theme = window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
      }
      document.documentElement.classList.toggle('light', theme === 'light');
      document.documentElement.style.colorScheme = theme;
    })();
    window.APP = <?= j_script(app_config()) ?>;
    window.PAGE = <?= j_script($opt['data'] ?? new stdClass()) ?>;
  </script>
</head>
<?php
}

function render_scripts(array $opt): void
{
    ?>
  <script type="module" src="<?= asset('js/core/app.js') ?>"></script>
<?php if (!empty($opt['script'])): ?>
  <script type="module" src="<?= asset('js/' . $opt['script']) ?>"></script>
<?php endif;
}

function render_page(array $opt, callable $content): void
{
    $layout = $opt['layout'] ?? 'site';
    render_head($opt);
    if ($layout === 'bare') {
        echo '<body class="' . e($opt['bodyClass'] ?? 'bg-background-50') . '">';
        $content();
        render_toast_root();
        render_scripts($opt);
        echo "</body>\n</html>";
        return;
    }
    $transparent = !empty($opt['transparentHeader']);
    ?>
<body>
<div class="relative min-h-screen bg-background-50">
  <div class="site-backdrop pointer-events-none fixed inset-0 z-0" aria-hidden="true"></div>
  <div class="relative z-10 flex min-h-screen flex-col">
    <?php render_site_header($transparent); ?>
    <?php if (!$transparent): ?><div class="h-[72px] shrink-0" aria-hidden="true"></div><?php endif; ?>
    <main class="flex-1"><?php $content(); ?></main>
    <?php render_site_footer(); ?>
  </div>
  <?php render_access_notice(); ?>
  <div id="chatbot-root"></div>
</div>
<?php render_toast_root(); ?>
<?php render_scripts($opt); ?>
  <script type="module" src="<?= asset('js/core/chatbot.js') ?>"></script>
</body>
</html>
<?php
}

function render_toast_root(): void
{
    echo '<div id="toast-root" class="pointer-events-none fixed inset-x-0 bottom-5 z-[130] flex flex-col items-center gap-2 px-4"></div><div id="modal-root"></div>';
}

// ---------------------------------------------------------------------------
// THANH MENU
// ---------------------------------------------------------------------------

function render_site_header(bool $tr): void
{
    $u = current_user();
    $path = current_path();
    $sport = $_GET['sport'] ?? '';
    $q = $_GET['q'] ?? '';
    $isOwner = $u && $u['role'] === 'owner';
    $isAdmin = $u && $u['role'] === 'admin';
    $favCount = $u ? count(jd($u['favorites'])) : 0;
    $initials = $u ? initials_of($u['full_name'], $u['email']) : '';
    $short = $u ? short_name_of($u['full_name'], $u['email']) : '';

    $nav = [
        ['/', 'Trang chủ', ''], ['/tim-san', 'Sân bóng đá', 'football'], ['/tim-san', 'Sân cầu lông', 'badminton'],
        ['/gioi-thieu', 'Giới thiệu', ''], ['/lien-he', 'Liên hệ', ''],
    ];
    $explore = [
        ['/ban-do', 'Bản đồ sân', 'ri-map-2-line', 'Xem toàn bộ sân quanh bạn trên bản đồ'],
        ['/ngau-nhien', 'Ngẫu nhiên & chia đội', 'ri-shuffle-line', 'Bốc sân may mắn, chia đội công bằng'],
        ['/uu-dai', 'Ưu đãi & mã giảm giá', 'ri-coupon-3-line', 'Mã giảm giá đang chạy từ các chủ sân'],
    ];
    $isActive = function ($item) use ($path, $sport) {
        if ($item[2]) return $path === '/tim-san' && $sport === $item[2];
        if ($item[0] === '/') return $path === '/';
        return strpos($path, $item[0]) === 0;
    };
    $navLink = function (bool $active) use ($tr) {
        $base = 'shrink-0 whitespace-nowrap rounded-md px-2 py-2 text-[13px] font-medium transition-colors xl:px-3 xl:text-sm';
        return $active
            ? tcls($tr, 'bg-white/15 text-white', 'bg-primary-50 text-primary-700', $base)
            : tcls($tr, 'text-white/85 hover:bg-white/10 hover:text-white', 'text-foreground-600 hover:bg-background-100 hover:text-foreground-950', $base);
    };
    $exploreActive = false;
    foreach ($explore as $x) if (strpos($path, $x[0]) === 0) $exploreActive = true;
    ?>
<header id="site-header" <?= tcls($tr, 'bg-transparent border-b border-white/10', 'bg-background-50/80 backdrop-blur-md border-b border-background-200', 'fixed top-0 left-0 right-0 z-50 transition-all duration-300') ?> <?= $tr ? 'data-transparent="1"' : '' ?>>
  <div class="w-full px-4 md:px-6 xl:px-8 h-[72px] flex items-center justify-between gap-3 xl:gap-6">
    <a href="<?= url('/') ?>" class="flex items-center gap-2.5 shrink-0 group" aria-label="Đặt Sân BMT 24H - Trang chủ">
      <span class="w-10 h-10 flex items-center justify-center rounded-lg bg-primary-500 text-white transition-colors group-hover:bg-primary-600"><i class="ri-football-line text-xl" aria-hidden="true"></i></span>
      <span class="leading-tight">
        <span <?= tcls($tr, 'text-white', 'text-foreground-950', 'block font-heading text-[15px] font-extrabold tracking-tight') ?>>ĐẶT SÂN BMT</span>
        <span class="block text-[11px] font-semibold tracking-[0.18em] text-primary-500">24H</span>
      </span>
    </a>

    <nav class="hidden min-w-0 flex-1 items-center justify-start gap-0.5 overflow-x-auto lg:flex xl:justify-center xl:gap-1" style="scrollbar-width:none" aria-label="Điều hướng chính">
      <?php foreach ($nav as $item): ?>
        <a href="<?= url($item[0] . ($item[2] ? '?sport=' . $item[2] : '')) ?>" <?= $navLink($isActive($item)) ?>><?= e($item[1]) ?></a>
      <?php endforeach; ?>
      <div class="relative">
        <button type="button" data-explore-toggle aria-expanded="false" aria-haspopup="menu" <?= $navLink($exploreActive) ?>>
          <span class="flex items-center gap-1">Khám phá <span class="flex h-4 w-4 items-center justify-center"><i class="ri-arrow-down-s-line" aria-hidden="true"></i></span></span>
        </button>
      </div>
      <?php if ($isAdmin): ?>
        <a href="<?= url('/quan-tri') ?>" title="Quản trị hệ thống" <?= strpos($path, '/quan-tri') === 0
            ? 'class="ml-1 flex shrink-0 items-center gap-1 whitespace-nowrap rounded-md px-2 py-2 text-[13px] font-semibold transition-colors xl:px-3 xl:text-sm bg-accent-100 text-accent-800"'
            : tcls($tr, 'text-white/90 hover:bg-white/10 hover:text-white', 'text-accent-700 hover:bg-accent-50', 'ml-1 flex shrink-0 items-center gap-1 whitespace-nowrap rounded-md px-2 py-2 text-[13px] font-semibold transition-colors xl:px-3 xl:text-sm') ?>>
          <span class="flex h-4 w-4 items-center justify-center"><i class="ri-shield-user-line" aria-hidden="true"></i></span>Quản trị
        </a>
      <?php endif; ?>
    </nav>
    <div id="explore-menu" role="menu" class="fixed z-[60] hidden w-72 overflow-hidden rounded-lg border border-background-200 bg-background-50 p-1.5 shadow-xl">
      <?php foreach ($explore as $x): ?>
        <a href="<?= url($x[0]) ?>" role="menuitem" class="flex items-start gap-2.5 rounded-md px-2.5 py-2.5 transition-colors hover:bg-background-100">
          <span class="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary-50 text-primary-600"><i class="<?= $x[2] ?> text-base" aria-hidden="true"></i></span>
          <span class="min-w-0"><span class="block whitespace-nowrap text-sm font-semibold text-foreground-900"><?= e($x[1]) ?></span><span class="mt-0.5 block text-[11px] leading-snug text-foreground-500"><?= e($x[3]) ?></span></span>
        </a>
      <?php endforeach; ?>
    </div>

    <div class="hidden lg:flex items-center gap-1.5 xl:gap-2 shrink-0">
      <?php $chip = 'flex shrink-0 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-1.5 text-[13px] font-semibold transition-colors'; ?>
      <?php if ($isOwner): ?>
        <a href="<?= url('/chu-san') ?>" title="Kênh chủ sân" <?= tcls($tr, 'border-white/40 text-white hover:border-white hover:bg-white/15', 'border-primary-300 bg-primary-50 text-primary-800 hover:border-primary-400 hover:bg-primary-100', $chip) ?>>
          <span class="flex h-4 w-4 items-center justify-center"><i class="ri-store-2-line" aria-hidden="true"></i></span>
          <span class="hidden xl:inline">Kênh chủ sân</span><span class="xl:hidden">Kênh sân</span>
        </a>
      <?php else: ?>
        <a href="<?= url('/dang-ky-chu-san') ?>" title="Đăng ký tài khoản chủ sân" <?= tcls($tr, 'border-white/40 text-white hover:border-white hover:bg-white/15', 'border-accent-300 bg-accent-50 text-accent-800 hover:border-accent-400 hover:bg-accent-100', $chip) ?>>
          <span class="flex h-4 w-4 items-center justify-center"><i class="ri-store-2-line" aria-hidden="true"></i></span>
          <span class="hidden 2xl:inline">Đăng ký chủ sân</span><span class="2xl:hidden">Đăng ký sân</span>
        </a>
      <?php endif; ?>
      <form action="<?= url('/tim-san') ?>" method="get" role="search" class="hidden 2xl:block">
        <div <?= tcls($tr, 'border-white/30 bg-white/10 focus-within:border-white/60', 'border-background-300 bg-background-100 focus-within:border-primary-400', 'flex items-center gap-2 rounded-full border px-3.5 py-2 transition-colors') ?>>
          <i <?= tcls($tr, 'text-white/70', 'text-primary-500', 'ri-search-line text-sm') ?> aria-hidden="true"></i>
          <input type="search" name="q" value="<?= e($q) ?>" placeholder="Tìm sân..." aria-label="Tìm kiếm sân thể thao" <?= tcls($tr, 'text-white placeholder:text-white/60', 'text-foreground-950 placeholder:text-foreground-500', 'w-[120px] bg-transparent text-sm focus:outline-none 2xl:w-[170px]') ?>>
        </div>
      </form>
      <a href="<?= url('/tim-san') ?>" aria-label="Tìm sân" <?= tcls($tr, 'text-white hover:bg-white/15', 'text-foreground-600 hover:text-primary-600 hover:bg-background-100', 'flex 2xl:hidden w-9 h-9 items-center justify-center rounded-md transition-colors') ?>><i class="ri-search-line text-lg" aria-hidden="true"></i></a>
      <span <?= tcls($tr, 'bg-white/25', 'bg-background-300', 'h-5 w-px') ?>></span>
      <a href="<?= url('/tai-khoan?tab=favorites') ?>" title="Sân yêu thích" aria-label="Sân yêu thích" <?= tcls($tr, 'text-white hover:bg-white/15', 'text-foreground-600 hover:bg-background-100 hover:text-accent-600', 'relative flex h-9 w-9 cursor-pointer items-center justify-center rounded-md transition-colors') ?>>
        <i class="ri-heart-3-line text-lg" aria-hidden="true"></i>
        <span data-fav-count class="absolute -right-0.5 -top-0.5 <?= $favCount ? 'flex' : 'hidden' ?> h-4 min-w-[16px] items-center justify-center rounded-full bg-accent-500 px-1 text-[10px] font-bold text-background-950"><?= $favCount > 9 ? '9+' : $favCount ?></span>
      </a>
      <?php render_language_toggle($tr); ?>
      <?php render_theme_toggle($tr); ?>
      <?php if ($u): ?>
        <div class="relative" data-dropdown>
          <button type="button" data-dropdown-toggle aria-expanded="false" aria-haspopup="menu" <?= tcls($tr, 'text-white hover:bg-white/15', 'text-foreground-800 hover:bg-background-100', 'flex cursor-pointer items-center gap-2 rounded-md py-1.5 pl-1.5 pr-2.5 transition-colors') ?>>
            <span class="flex h-7 w-7 items-center justify-center rounded-full bg-primary-500 text-[11px] font-bold text-white"><?= e($initials) ?></span>
            <span class="hidden max-w-[96px] truncate whitespace-nowrap text-sm font-semibold xl:block"><?= e($short) ?></span>
            <i class="ri-arrow-down-s-line text-base" aria-hidden="true"></i>
          </button>
          <div data-dropdown-menu role="menu" class="absolute right-0 top-[calc(100%+10px)] hidden w-[272px] overflow-hidden rounded-xl border border-background-200 bg-background-50 shadow-xl">
            <div class="flex items-center gap-2.5 border-b border-background-200 bg-background-100 px-3.5 py-3.5">
              <span class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-500 text-[12px] font-bold text-white"><?= e($initials) ?></span>
              <span class="min-w-0">
                <span class="block truncate text-sm font-semibold text-foreground-950"><?= e($u['full_name'] ?: $short) ?></span>
                <span class="mt-0.5 block truncate text-[11px] text-foreground-500"><?= e($u['email']) ?></span>
              </span>
              <span class="ml-auto shrink-0 whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-bold <?= $isAdmin ? 'bg-accent-100 text-accent-800' : ($isOwner ? 'bg-primary-100 text-primary-800' : 'bg-secondary-200 text-secondary-900') ?>"><?= $isAdmin ? 'Quản trị' : ($isOwner ? 'Chủ sân' : 'Khách hàng') ?></span>
            </div>
            <div class="flex flex-col p-1.5">
              <p class="px-2.5 pb-1 pt-1 text-[10px] font-bold uppercase tracking-[0.14em] text-foreground-400">Cá nhân</p>
              <a href="<?= url('/tai-khoan') ?>" role="menuitem" class="flex cursor-pointer items-center gap-2 rounded-md px-2.5 py-2 text-sm font-medium text-foreground-800 transition-colors hover:bg-background-100"><i class="ri-user-line text-base text-foreground-500" aria-hidden="true"></i>Tài khoản của tôi</a>
              <a href="<?= url('/tai-khoan?tab=favorites') ?>" role="menuitem" class="flex cursor-pointer items-center gap-2 rounded-md px-2.5 py-2 text-sm font-medium text-foreground-800 transition-colors hover:bg-background-100"><i class="ri-heart-3-line text-base text-accent-600" aria-hidden="true"></i>Sân yêu thích<?php if ($favCount): ?><span class="ml-auto rounded-full bg-accent-500 px-1.5 py-0.5 text-[10px] font-bold text-background-950"><?= $favCount ?></span><?php endif; ?></a>
              <a href="<?= url('/uu-dai') ?>" role="menuitem" class="flex cursor-pointer items-center gap-2 rounded-md px-2.5 py-2 text-sm font-medium text-foreground-800 transition-colors hover:bg-background-100"><i class="ri-coupon-3-line text-base text-primary-600" aria-hidden="true"></i>Ưu đãi &amp; mã giảm giá</a>
            </div>
            <?php if ($isOwner || $isAdmin): ?>
              <div class="flex flex-col gap-1 border-t border-background-200 p-1.5">
                <p class="px-2.5 pb-0.5 pt-1 text-[10px] font-bold uppercase tracking-[0.14em] text-foreground-400">Kênh quản lý</p>
                <?php if ($isOwner): ?>
                  <a href="<?= url('/chu-san') ?>" role="menuitem" class="flex cursor-pointer items-start gap-2.5 rounded-md border border-primary-200 bg-primary-50 px-2.5 py-2 transition-colors hover:bg-primary-100">
                    <span class="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary-500 text-white"><i class="ri-store-2-line text-sm" aria-hidden="true"></i></span>
                    <span class="min-w-0"><span class="block whitespace-nowrap text-sm font-semibold text-primary-800">Kênh chủ sân</span><span class="mt-0.5 block text-[11px] leading-snug text-primary-700/80">Quản lý sân, lịch đặt và doanh thu</span></span>
                  </a>
                <?php endif; ?>
                <?php if ($isAdmin): ?>
                  <a href="<?= url('/quan-tri') ?>" role="menuitem" class="flex cursor-pointer items-start gap-2.5 rounded-md border border-accent-200 bg-accent-50 px-2.5 py-2 transition-colors hover:bg-accent-100">
                    <span class="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-accent-500 text-background-950"><i class="ri-shield-user-line text-sm" aria-hidden="true"></i></span>
                    <span class="min-w-0"><span class="block whitespace-nowrap text-sm font-semibold text-accent-800">Quản trị hệ thống</span><span class="mt-0.5 block text-[11px] leading-snug text-accent-700/80">Sân, đơn đặt, người dùng và phân quyền</span></span>
                  </a>
                <?php endif; ?>
              </div>
            <?php endif; ?>
            <div class="border-t border-background-200 p-1.5">
              <button type="button" role="menuitem" data-logout class="flex w-full cursor-pointer items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm font-semibold text-accent-700 transition-colors hover:bg-accent-50"><i class="ri-logout-box-r-line text-base" aria-hidden="true"></i>Đăng xuất</button>
            </div>
          </div>
        </div>
      <?php else: ?>
        <a href="<?= url('/dang-nhap') ?>" <?= tcls($tr, 'text-white hover:bg-white/15', 'text-foreground-800 hover:bg-background-100', 'flex items-center gap-2 rounded-md py-1.5 px-2.5 transition-colors') ?>>
          <span class="flex h-7 w-7 items-center justify-center rounded-full bg-secondary-500 text-background-950"><i class="ri-user-line text-sm" aria-hidden="true"></i></span>
          <span class="whitespace-nowrap text-sm font-semibold">Đăng nhập</span>
        </a>
      <?php endif; ?>
      <a href="<?= url('/dat-san') ?>" class="whitespace-nowrap rounded-md bg-primary-500 px-3.5 xl:px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-600">Đặt sân</a>
    </div>

    <button type="button" data-mobile-toggle aria-label="Mở menu" aria-expanded="false" <?= tcls($tr, 'text-white hover:bg-white/15', 'text-foreground-800 hover:bg-background-100', 'lg:hidden w-10 h-10 flex items-center justify-center rounded-md transition-colors') ?>>
      <i class="ri-menu-line text-2xl" aria-hidden="true"></i>
    </button>
  </div>

  <div id="mobile-menu" class="lg:hidden hidden max-h-[calc(100dvh-72px)] overflow-y-auto overscroll-contain bg-background-50 border-t border-background-200 animate-fade-in">
    <nav class="flex flex-col px-4 pt-3 pb-28" aria-label="Điều hướng di động">
      <form action="<?= url('/tim-san') ?>" method="get" role="search" class="mb-2">
        <div class="flex items-center gap-2 rounded-full border border-background-300 bg-background-100 px-3.5 py-2.5 transition-colors focus-within:border-primary-400">
          <i class="ri-search-line text-base text-primary-500" aria-hidden="true"></i>
          <input type="search" name="q" value="<?= e($q) ?>" placeholder="Tìm sân theo tên, đường, khu vực..." aria-label="Tìm kiếm sân thể thao" class="w-full min-w-0 bg-transparent text-sm text-foreground-950 placeholder:text-foreground-500 focus:outline-none">
          <button type="submit" class="shrink-0 whitespace-nowrap rounded-full bg-primary-500 px-4 py-1.5 text-xs font-bold text-white transition-colors hover:bg-primary-600">Tìm</button>
        </div>
      </form>
      <?php if (!$isOwner): ?>
        <a href="<?= url('/dang-ky-chu-san') ?>" class="mt-1 flex items-center justify-between rounded-full border border-accent-300 bg-accent-50 px-3 py-2.5 text-sm font-semibold text-accent-800 hover:bg-accent-100">
          <span class="flex items-center gap-2.5"><i class="ri-store-2-line text-base text-accent-600" aria-hidden="true"></i>Đăng ký chủ sân</span><i class="ri-arrow-right-s-line text-accent-500" aria-hidden="true"></i>
        </a>
      <?php endif; ?>
      <?php foreach ($nav as $item): ?>
        <a href="<?= url($item[0] . ($item[2] ? '?sport=' . $item[2] : '')) ?>" class="flex items-center justify-between rounded-md px-3 py-3 text-sm font-medium text-foreground-800 hover:bg-background-100"><span class="flex items-center gap-2.5"><?= e($item[1]) ?></span><i class="ri-arrow-right-s-line text-foreground-400" aria-hidden="true"></i></a>
      <?php endforeach; ?>
      <?php foreach ($explore as $x): ?>
        <a href="<?= url($x[0]) ?>" class="flex items-center justify-between rounded-md px-3 py-3 text-sm font-medium text-foreground-800 hover:bg-background-100"><span class="flex items-center gap-2.5"><i class="<?= $x[2] ?> text-base text-primary-600" aria-hidden="true"></i><?= e($x[1]) ?></span><i class="ri-arrow-right-s-line text-foreground-400" aria-hidden="true"></i></a>
      <?php endforeach; ?>
      <div class="mt-3 flex flex-col gap-2 border-t border-background-200 pt-3">
        <a href="<?= url('/tai-khoan?tab=favorites') ?>" class="flex items-center gap-2.5 rounded-md px-3 py-2.5 text-sm font-semibold text-foreground-800 hover:bg-background-100">
          <i class="ri-heart-3-line text-base text-accent-600" aria-hidden="true"></i>Sân yêu thích
          <?php if ($favCount): ?><span class="ml-auto rounded-full bg-accent-500 px-2 py-0.5 text-[11px] font-bold text-background-950"><?= $favCount ?></span><?php endif; ?>
          <i class="ri-arrow-right-s-line text-foreground-400" aria-hidden="true"></i>
        </a>
        <div class="flex items-center justify-between gap-2 rounded-md bg-background-100 px-3 py-2">
          <span class="flex min-w-0 items-center gap-2 truncate text-sm font-medium text-foreground-800"><i class="ri-translate-2 text-base text-primary-600" aria-hidden="true"></i>Ngôn ngữ</span>
          <div class="flex shrink-0 items-center"><?php render_language_toggle(false); ?></div>
        </div>
        <div class="flex items-center justify-between gap-2 rounded-md bg-background-100 px-3 py-2">
          <span class="flex min-w-0 items-center gap-2 truncate text-sm font-medium text-foreground-800"><i class="ri-contrast-2-line text-base text-primary-600" aria-hidden="true"></i>Giao diện sáng / tối</span>
          <div class="flex shrink-0 items-center"><?php render_theme_toggle(false); ?></div>
        </div>
        <?php if ($isOwner): ?>
          <a href="<?= url('/chu-san') ?>" class="flex items-center gap-2.5 rounded-md px-3 py-2.5 text-sm font-semibold text-foreground-800 hover:bg-background-100"><i class="ri-store-2-line text-base text-primary-600" aria-hidden="true"></i>Kênh chủ sân<i class="ri-arrow-right-s-line ml-auto text-foreground-400" aria-hidden="true"></i></a>
        <?php endif; ?>
        <?php if ($isAdmin): ?>
          <a href="<?= url('/quan-tri') ?>" class="flex items-center gap-2.5 rounded-md border border-primary-300 bg-primary-50 px-3 py-2.5 text-sm font-semibold text-primary-700"><i class="ri-shield-user-line text-base" aria-hidden="true"></i>Quản trị hệ thống<i class="ri-arrow-right-s-line ml-auto text-primary-400" aria-hidden="true"></i></a>
        <?php endif; ?>
        <?php if ($u): ?>
          <div class="flex items-center gap-2.5 rounded-md bg-background-100 px-3 py-2.5">
            <span class="flex h-8 w-8 items-center justify-center rounded-full bg-primary-500 text-[11px] font-bold text-white"><?= e($initials) ?></span>
            <span class="min-w-0"><span class="block truncate text-sm font-semibold text-foreground-900"><?= e($u['full_name'] ?: $short) ?></span><span class="block truncate text-[11px] text-foreground-500"><?= e($u['email']) ?></span></span>
          </div>
          <button type="button" data-logout class="flex w-full cursor-pointer items-center justify-center gap-2 rounded-md border border-accent-300 bg-accent-50 px-3 py-2.5 text-sm font-semibold text-accent-700 transition-colors hover:bg-accent-100"><i class="ri-logout-box-r-line text-base" aria-hidden="true"></i>Đăng xuất</button>
        <?php else: ?>
          <a href="<?= url('/tai-khoan') ?>" class="flex items-center gap-2.5 rounded-md bg-background-100 px-3 py-2.5 text-sm font-semibold text-foreground-900"><i class="ri-user-line text-base text-primary-600" aria-hidden="true"></i>Tài khoản của tôi</a>
        <?php endif; ?>
        <a href="<?= url('/dat-san') ?>" class="w-full text-center whitespace-nowrap rounded-md bg-primary-500 px-4 py-2.5 text-sm font-semibold text-white">Đặt sân</a>
        <?php if (!$u): ?><a href="<?= url('/dang-nhap') ?>" class="py-1 text-center text-xs font-medium text-foreground-500">Đăng nhập / Đăng ký</a><?php endif; ?>
      </div>
    </nav>
  </div>
</header>
<?php
}

function render_theme_toggle(bool $tr = false, string $extra = ''): void
{
    ?>
<button type="button" data-theme-toggle aria-label="Giao diện sáng / tối" title="Giao diện sáng / tối" <?= tcls($tr, 'border-white/35 text-white hover:bg-white/15', 'border-background-300 text-foreground-700 hover:border-primary-400 hover:bg-background-100 hover:text-primary-700', 'flex h-9 w-9 cursor-pointer items-center justify-center rounded-md border transition-colors ' . $extra) ?>>
  <i class="ri-sun-line text-lg" data-theme-icon aria-hidden="true"></i>
</button>
<?php
}

function render_language_toggle(bool $tr = false, string $extra = ''): void
{
    ?>
<div role="group" aria-label="Ngôn ngữ" data-lang-group <?= $tr ? 'data-transparent="1"' : '' ?> <?= tcls($tr, 'border-white/35 bg-white/10', 'border-background-300 bg-background-100', 'flex h-9 items-center gap-0.5 rounded-md border p-0.5 transition-colors ' . $extra) ?>>
  <button type="button" data-lang="vi" title="Tiếng Việt" class="flex h-full w-7 cursor-pointer items-center justify-center rounded text-[11px] font-bold tracking-wide transition-colors">VI</button>
  <button type="button" data-lang="en" title="English" class="flex h-full w-7 cursor-pointer items-center justify-center rounded text-[11px] font-bold tracking-wide transition-colors">EN</button>
</div>
<?php
}

// ---------------------------------------------------------------------------
// CHÂN TRANG
// ---------------------------------------------------------------------------

function render_site_footer(): void
{
    $explore = [['Sân bóng đá', '/tim-san?sport=football'], ['Sân cầu lông', '/tim-san?sport=badminton'], ['Bản đồ sân', '/ban-do'],
        ['Ngẫu nhiên & chia đội', '/ngau-nhien'], ['Ưu đãi & mã giảm giá', '/uu-dai'], ['Đặt sân nhanh', '/dat-san']];
    $support = [['Giới thiệu về chúng tôi', '/gioi-thieu'], ['Liên hệ hỗ trợ', '/lien-he'], ['Tài khoản của tôi', '/tai-khoan'],
        ['Kênh chủ sân', '/chu-san'], ['Đăng nhập', '/dang-nhap'], ['Tạo tài khoản mới', '/dang-ky'], ['Trở thành đối tác chủ sân', '/dang-ky-chu-san']];
    $socials = [['ri-facebook-fill', 'Facebook'], ['ri-messenger-line', 'Messenger'], ['ri-youtube-fill', 'YouTube'], ['ri-tiktok-fill', 'TikTok']];
    ?>
<footer class="mt-auto border-t border-background-200 bg-background-100 text-foreground-600">
  <div class="w-full px-4 md:px-8 py-12 md:py-16">
    <div class="grid grid-cols-2 gap-x-6 gap-y-8 sm:gap-10 lg:grid-cols-4">
      <div class="col-span-2 sm:col-span-1">
        <a href="<?= url('/') ?>" class="flex items-center gap-2.5 mb-4">
          <span class="w-10 h-10 flex items-center justify-center rounded-lg bg-primary-500 text-white"><i class="ri-football-line text-xl" aria-hidden="true"></i></span>
          <span class="leading-tight"><span class="block font-heading text-[15px] font-extrabold tracking-tight text-foreground-950">ĐẶT SÂN BMT</span><span class="block text-[11px] font-semibold tracking-[0.18em] text-primary-600">24H</span></span>
        </a>
        <p class="text-sm leading-relaxed text-foreground-600">Nền tảng đặt sân bóng đá và sân cầu lông trực tuyến tại Buôn Ma Thuột, Đắk Lắk. Kết nối người chơi với hơn 30 sân thể thao chất lượng trong vài thao tác.</p>
        <div class="flex items-center gap-2 mt-5">
          <?php foreach ($socials as $s): ?>
            <a href="#" aria-label="<?= $s[1] ?>" class="w-9 h-9 flex items-center justify-center rounded-md bg-primary-500/15 text-foreground-700 transition-colors hover:bg-primary-500 hover:text-foreground-950"><i class="<?= $s[0] ?> text-base" aria-hidden="true"></i></a>
          <?php endforeach; ?>
        </div>
        <a href="<?= url('/dang-ky-chu-san') ?>" class="mt-6 inline-flex cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-md border border-primary-300 bg-white px-4 py-2.5 text-sm font-semibold text-primary-700 transition-colors hover:border-primary-500 hover:bg-primary-500 hover:text-white"><i class="ri-store-2-line text-base" aria-hidden="true"></i>Trở thành đối tác chủ sân</a>
        <p class="mt-2 text-xs leading-relaxed text-foreground-500">Miễn phí đăng ký, nhận đơn đặt sân mỗi ngày.</p>
      </div>
      <div>
        <h4 class="font-heading text-sm font-bold uppercase tracking-wide text-foreground-950 mb-4"><a href="<?= url('/tim-san') ?>" class="hover:text-primary-600 transition-colors">Khám phá sân</a></h4>
        <ul class="space-y-2.5"><?php foreach ($explore as $l): ?><li><a href="<?= url($l[1]) ?>" class="text-sm text-foreground-600 transition-colors hover:text-primary-600"><?= e($l[0]) ?></a></li><?php endforeach; ?></ul>
      </div>
      <div>
        <h4 class="font-heading text-sm font-bold uppercase tracking-wide text-foreground-950 mb-4"><a href="<?= url('/gioi-thieu') ?>" class="hover:text-primary-600 transition-colors">Hỗ trợ</a></h4>
        <ul class="space-y-2.5"><?php foreach ($support as $l): ?><li><a href="<?= url($l[1]) ?>" class="text-sm text-foreground-600 transition-colors hover:text-primary-600"><?= e($l[0]) ?></a></li><?php endforeach; ?></ul>
      </div>
      <div class="col-span-2 sm:col-span-1">
        <h4 class="font-heading text-sm font-bold uppercase tracking-wide text-foreground-950 mb-4"><a href="<?= url('/lien-he') ?>" class="hover:text-primary-600 transition-colors">Liên hệ</a></h4>
        <ul class="space-y-3 text-sm text-foreground-600">
          <li class="flex items-start gap-2.5"><i class="ri-map-pin-line text-primary-600 mt-0.5" aria-hidden="true"></i><span>TP. Buôn Ma Thuột, Đắk Lắk, Việt Nam</span></li>
          <li class="flex items-start gap-2.5"><i class="ri-phone-line text-primary-600 mt-0.5" aria-hidden="true"></i><a href="tel:<?= preg_replace('/\D/', '', HOTLINE) ?>" class="hover:text-primary-600 transition-colors"><?= HOTLINE ?></a></li>
          <li class="flex items-start gap-2.5"><i class="ri-mail-line text-primary-600 mt-0.5" aria-hidden="true"></i><a href="mailto:<?= SUPPORT_EMAIL ?>" class="hover:text-primary-600 transition-colors"><?= SUPPORT_EMAIL ?></a></li>
          <li class="flex items-start gap-2.5"><i class="ri-time-line text-primary-600 mt-0.5" aria-hidden="true"></i><span>Hỗ trợ 24/7, kể cả ngày lễ</span></li>
        </ul>
      </div>
    </div>
  </div>
  <div class="border-t border-background-200">
    <div class="w-full px-4 md:px-8 py-5 flex flex-col sm:flex-row items-center justify-between gap-3">
      <p class="text-xs text-foreground-500">© <?= date('Y') ?> Đặt Sân BMT 24H. Tất cả các quyền được bảo lưu.</p>
      <div class="flex items-center gap-5 text-xs text-foreground-500">
        <a href="<?= url('/gioi-thieu') ?>" class="hover:text-primary-600 transition-colors">Điều khoản sử dụng</a>
        <a href="<?= url('/gioi-thieu') ?>" class="hover:text-primary-600 transition-colors">Chính sách bảo mật</a>
      </div>
    </div>
  </div>
</footer>
<?php
}

// ---------------------------------------------------------------------------
// THÔNG BÁO QUYỀN TRUY CẬP (?thong-bao=...)
// ---------------------------------------------------------------------------

function render_access_notice(): void
{
    $code = $_GET['thong-bao'] ?? '';
    if (!$code) return;
    $role = $_GET['vai-tro'] ?? '';
    $labels = ['customer' => 'khách hàng', 'owner' => 'chủ sân', 'admin' => 'quản trị viên'];
    $roleLabel = $labels[$role] ?? 'chưa xác định';
    $notices = [
        'khong-co-quyen' => ['Khu quản trị chỉ dành cho quản trị viên', $role && isset($labels[$role])
            ? "Tài khoản bạn đang đăng nhập có vai trò $roleLabel nên không mở được khu quản trị hệ thống. Bạn vẫn dùng bình thường các khu vực còn lại của website."
            : 'Tài khoản bạn đang đăng nhập chưa được cấp quyền quản trị hệ thống. Bạn vẫn dùng bình thường các khu vực còn lại của website.'],
        'khong-phai-chu-san' => ['Kênh chủ sân chỉ dành cho tài khoản đối tác', $role === 'admin'
            ? 'Tài khoản quản trị cần được cấp thêm vai trò chủ sân để mở kênh này. Vui lòng kiểm tra lại vai trò trong khu quản trị hệ thống.'
            : ($role === 'customer'
                ? 'Tài khoản bạn đang đăng nhập là tài khoản khách hàng nên không mở được kênh chủ sân. Bạn vẫn đặt sân bình thường; nếu muốn cho thuê sân, hãy đăng ký tài khoản đối tác.'
                : 'Tài khoản bạn đang đăng nhập chưa phải tài khoản chủ sân nên không mở được kênh chủ sân. Bạn vẫn đặt sân bình thường; nếu muốn cho thuê sân, hãy đăng ký tài khoản đối tác.')],
        'tai-khoan-bi-khoa' => ['Tài khoản quản trị đang bị tạm khóa', 'Tài khoản của bạn có vai trò quản trị nhưng đang ở trạng thái tạm khóa, nên khu quản trị tạm thời bị đóng. Vui lòng liên hệ người phụ trách hệ thống để mở lại.'],
        'chu-san-bi-khoa' => ['Tài khoản chủ sân đang bị tạm khóa', 'Tài khoản của bạn có vai trò chủ sân nhưng đang ở trạng thái tạm khóa, nên kênh chủ sân tạm thời bị đóng. Các đơn đặt sân đã nhận vẫn được giữ nguyên; vui lòng liên hệ bộ phận vận hành để mở lại.'],
    ];
    if (!isset($notices[$code])) return;
    [$title, $message] = $notices[$code];
    ?>
<div id="access-notice" class="pointer-events-none fixed inset-x-0 bottom-5 z-[120] flex justify-center px-4">
  <div class="pointer-events-auto w-full max-w-lg animate-fade-up rounded-lg border border-accent-300 bg-white px-4 py-3.5">
    <div class="flex items-start gap-3">
      <span class="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent-100 text-accent-700"><i class="ri-shield-keyhole-line text-lg" aria-hidden="true"></i></span>
      <div class="min-w-0 flex-1">
        <p class="text-sm font-semibold text-foreground-950"><?= e($title) ?></p>
        <p class="mt-1 text-[13px] leading-relaxed text-foreground-600"><?= e($message) ?></p>
      </div>
      <button type="button" data-close-notice aria-label="Đóng thông báo" class="flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-sm text-foreground-400 transition-colors hover:bg-background-100 hover:text-foreground-800"><i class="ri-close-line" aria-hidden="true"></i></button>
    </div>
  </div>
</div>
<?php
}

// ---------------------------------------------------------------------------
// THÀNH PHẦN DÙNG CHUNG
// ---------------------------------------------------------------------------

/** Khối tiêu đề trang có nút quay lại + breadcrumb. $crumbs = [['Trang chủ', '/'], ['Tên trang']] */
function page_hero(array $crumbs, string $title, string $description = '', ?callable $children = null): void
{
    ?>
<section class="w-full border-b border-background-200 bg-background-100 px-4 md:px-8 py-9 md:py-12">
  <div class="mx-auto w-full max-w-[1280px]">
    <button type="button" data-back class="mb-4 inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-full border border-background-300 bg-white px-3 py-1.5 text-xs font-medium text-foreground-700 transition-colors hover:border-primary-300 hover:text-primary-700">
      <span class="flex h-4 w-4 items-center justify-center"><i class="ri-arrow-left-line text-sm" aria-hidden="true"></i></span>Quay lại
    </button>
    <nav aria-label="Breadcrumb" class="flex flex-wrap items-center gap-1.5 text-xs text-foreground-500">
      <?php foreach ($crumbs as $i => $c): ?>
        <span class="flex items-center gap-1.5">
          <?php if ($i > 0): ?><i class="ri-arrow-right-s-line text-foreground-400" aria-hidden="true"></i><?php endif; ?>
          <?php if (!empty($c[1])): ?><a href="<?= url($c[1]) ?>" class="transition-colors hover:text-primary-600"><?= e($c[0]) ?></a>
          <?php else: ?><span class="text-foreground-900"><?= e($c[0]) ?></span><?php endif; ?>
        </span>
      <?php endforeach; ?>
    </nav>
    <h1 class="mt-3 font-heading text-2xl font-extrabold leading-tight text-foreground-950 md:text-3xl"><?= e($title) ?></h1>
    <?php if ($description): ?><p class="mt-2.5 max-w-2xl text-sm leading-relaxed text-foreground-600"><?= e($description) ?></p><?php endif; ?>
    <?php if ($children): ?><div class="mt-6"><?php $children(); ?></div><?php endif; ?>
  </div>
</section>
<?php
}

function section_heading(string $title, string $eyebrow = '', string $description = '', string $align = 'left', string $actionHtml = ''): void
{
    $center = $align === 'center';
    ?>
<div class="flex flex-col gap-4 <?= $center ? 'items-center text-center' : 'md:flex-row md:items-end md:justify-between' ?>">
  <div class="max-w-2xl">
    <?php if ($eyebrow): ?><span class="inline-flex items-center gap-2 rounded-full bg-primary-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-primary-700 mb-3"><span class="w-1.5 h-1.5 rounded-full bg-primary-500"></span><?= e($eyebrow) ?></span><?php endif; ?>
    <h2 class="text-2xl md:text-3xl font-bold text-foreground-950"><?= e($title) ?></h2>
    <?php if ($description): ?><p class="mt-3 text-sm md:text-base text-foreground-600 leading-relaxed"><?= e($description) ?></p><?php endif; ?>
  </div>
  <?php if ($actionHtml): ?><div class="shrink-0"><?= $actionHtml ?></div><?php endif; ?>
</div>
<?php
}

function current_path(): string
{
    $path = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';
    $base = base_path();
    if ($base && strpos($path, $base) === 0) $path = substr($path, strlen($base));
    $path = '/' . trim(rawurldecode($path), '/');
    return $path === '' ? '/' : $path;
}