<?php
/**
 * TRANG QUẢN TRỊ — /quan-tri?tab=...
 * Chỉ hiện các mục mà bộ quyền của quản trị viên được phép; nội dung do assets/js/pages/admin.js vẽ.
 */
$u = current_user();
$access = admin_access();
$meta = [
    'overview' => ['Tổng quan hệ thống', 'Toàn cảnh số người dùng, số sân, số đơn, doanh thu và các yêu cầu chờ duyệt.'],
    'accounts' => ['Quản lý tài khoản', 'Tài khoản khách hàng, tài khoản chủ sân, duyệt đăng ký chủ sân và quản trị viên & phân quyền.'],
    'courts' => ['Quản lý sân', 'Danh sách sân, chi tiết sân, duyệt sân mới và tạm ngưng sân vi phạm.'],
    'bookings' => ['Quản lý đơn đặt sân', 'Theo dõi toàn bộ đơn đặt sân của khách, duyệt hoặc từ chối đơn còn chờ xử lý.'],
    'payments' => ['Thanh toán & đối soát', 'Giao dịch toàn hệ thống, đối soát & chuyển tiền chủ sân và xử lý yêu cầu hoàn tiền.'],
    'moderation' => ['Đánh giá & khiếu nại', 'Kiểm duyệt đánh giá công khai và tiếp nhận, xử lý khiếu nại vi phạm.'],
    'content' => ['Nội dung & khuyến mãi', 'Biên tập banner, tin tức, FAQ, chính sách và quản lý mã giảm giá toàn hệ thống.'],
    'categories' => ['Danh mục', 'Quản lý loại sân (môn thể thao), tiện ích sân và khu vực hiển thị.'],
    'reports' => ['Báo cáo doanh thu', 'Thống kê doanh thu toàn hệ thống theo thời gian, chủ sân, sân và bộ môn; xuất Excel.'],
    'ai' => ['Quản lý AI · Cấu hình chatbot', 'Thiết lập trợ lý AI tư vấn khách hàng, lời chào, gợi ý nhanh và kịch bản hỏi – đáp tự động.'],
    'settings' => ['Cấu hình hệ thống', 'Thông tin website, cổng thanh toán VietQR, chính sách chung và nhật ký thao tác quản trị.'],
];
$tabAliases = [
    'owners' => ['accounts', 'owners'],
    'invoices' => ['payments', 'transactions'],
    'promotions' => ['content', 'promotions'],
    'audit' => ['settings', 'audit'],
];
$allowed = $access['allowed'];
$rawTab = $_GET['tab'] ?? 'overview';
$subTab = $_GET['sub'] ?? '';
if (isset($tabAliases[$rawTab])) {
    [$tab, $subTab] = $tabAliases[$rawTab];
} else {
    $tab = $rawTab;
}
$denied = isset($meta[$tab]) && !in_array($tab, $allowed, true);
if (!isset($meta[$tab]) || $denied) $tab = $allowed[0] ?? 'overview';
$modules = array_values(array_filter(ADMIN_MODULES, fn($m) => in_array($m['key'], $allowed, true)));

render_page([
    'title' => $meta[$tab][0] . ' · Quản trị - ' . SITE_NAME,
    'layout' => 'bare',
    'bodyClass' => 'bg-background-100',
    'script' => 'pages/admin.js',
    'data' => ['tab' => $tab, 'sub' => $subTab, 'access' => $access, 'denied' => $denied, 'modules' => ADMIN_MODULES],
], function () use ($u, $access, $meta, $tab, $modules, $denied) {
    $imp = impersonating_admin();
    ?>
<div class="min-h-screen bg-background-100" <?= $imp ? 'style="padding-top: var(--ghost-banner-height, 44px);"' : '' ?>>
  <div id="owner-overlay" class="fixed inset-0 z-40 hidden bg-black/40 lg:hidden"></div>
<<<<<<< HEAD
  <aside id="owner-sidebar" class="fixed inset-y-0 left-0 z-50 flex w-[264px] -translate-x-full flex-col border-r border-background-200 bg-white transition-transform lg:translate-x-0">
    <a href="<?= url('/') ?>" class="flex h-16 shrink-0 items-center gap-2.5 border-b border-background-200 px-5">
      <img src="<?= site_logo() ?>" alt="Logo Đặt Sân BMT 24H" class="h-9 w-9 rounded-md object-contain">
      <span class="leading-tight"><span class="block font-heading text-sm font-extrabold text-foreground-950">Đặt Sân BMT 24H</span><span class="block text-[11px] font-medium text-foreground-500">Trang quản trị</span></span>
=======
  <aside id="owner-sidebar" class="fixed inset-y-0 left-0 z-50 flex w-[264px] -translate-x-full flex-col border-r border-background-200 bg-white transition-transform lg:translate-x-0" <?= $imp ? 'style="top: var(--ghost-banner-height, 44px);"' : '' ?>>
    <a href="<?= url('/') ?>" class="flex h-16 shrink-0 items-center gap-3 border-b border-background-200 px-5 group">
      <img src="<?= site_logo() ?>" alt="Logo Đặt Sân BMT 24H" class="h-10 w-10 rounded-xl object-contain drop-shadow-sm transition-transform group-hover:scale-105">
      <div class="leading-tight">
        <div class="flex items-center gap-1.5">
          <span class="font-heading text-sm font-black text-foreground-950">ĐẶT SÂN BMT</span>
          <span class="rounded bg-accent-500 px-1 py-0.2 text-[10px] font-bold text-background-950">24H</span>
        </div>
        <span class="block text-xs font-medium text-foreground-500">Trang quản trị</span>
      </div>
>>>>>>> Dev
    </a>
    <nav class="flex-1 overflow-y-auto px-3 py-4" aria-label="Điều hướng quản trị">
      <p class="mb-1.5 px-3 text-xs font-bold uppercase tracking-wider text-foreground-400">Quản trị hệ thống</p>
      <?php foreach ($modules as $m): ?>
        <a href="<?= url('/quan-tri?tab=' . $m['key']) ?>" class="<?= $m['key'] === $tab ? 'bg-primary-50 text-primary-700' : 'text-foreground-700 hover:bg-background-100 hover:text-foreground-950' ?> mb-0.5 flex items-center justify-between gap-2 rounded-md px-3 py-2.5 text-sm font-medium transition-colors">
          <span class="flex items-center gap-2.5"><i class="<?= $m['icon'] ?> text-lg" aria-hidden="true"></i><?= $m['label'] ?></span>
          <span data-badge="<?= $m['key'] ?>" class="hidden min-w-[20px] rounded-full bg-accent-500 px-1.5 py-0.5 text-center text-xs font-bold text-white"></span>
        </a>
      <?php endforeach; ?>
    </nav>
    <div class="border-t border-background-200 p-4">
      <div class="flex items-center gap-2.5">
        <span class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-secondary-700 text-xs font-bold text-white"><?= e(initials_of($u['full_name'], $u['email'])) ?></span>
        <div class="min-w-0"><p class="truncate text-sm font-semibold text-foreground-950"><?= e($access['actorName']) ?></p><p class="truncate text-xs text-foreground-500"><?= e($access['roleName']) ?></p></div>
      </div>
      <a href="<?= url('/chu-san') ?>" class="mt-3 flex items-center gap-2 text-xs font-semibold text-primary-700 hover:text-primary-800"><i class="ri-store-2-line" aria-hidden="true"></i>Kênh chủ sân</a>
      <a href="<?= url('/') ?>" class="mt-2 flex items-center gap-2 text-xs font-semibold text-foreground-600 hover:text-primary-700"><i class="ri-arrow-left-line" aria-hidden="true"></i>Về trang khách hàng</a>
    </div>
  </aside>

  <div class="lg:ml-[264px]">
    <header class="sticky z-30 flex h-16 items-center justify-between gap-3 border-b border-background-200 bg-background-50/95 px-4 backdrop-blur-md md:px-6" <?= $imp ? 'style="top: var(--ghost-banner-height, 44px);"' : 'style="top: 0;"' ?>>
      <div class="flex min-w-0 items-center gap-3">
        <button type="button" id="owner-menu-btn" class="flex h-9 w-9 items-center justify-center rounded-md border border-background-300 bg-background-100 text-foreground-700 hover:bg-background-200 lg:hidden" aria-label="Mở menu"><i class="ri-menu-line text-lg" aria-hidden="true"></i></button>
        <div class="min-w-0">
          <p class="truncate text-xs font-medium text-foreground-500">Xin chào, <?= e($access['actorName']) ?></p>
          <p class="flex items-center gap-1.5 truncate font-heading text-sm font-bold text-foreground-950"><i class="ri-shield-user-line text-primary-600" aria-hidden="true"></i><?= e($access['roleName']) ?></p>
        </div>
      </div>
      <div class="flex items-center gap-2">
        <?php render_language_toggle(false, 'hidden sm:flex'); ?>
        <?php render_theme_toggle(false); ?>
        <a href="<?= url('/chu-san') ?>" class="hidden items-center gap-1.5 rounded-md border border-primary-300 bg-primary-50 px-3 py-2 text-sm font-semibold text-primary-800 hover:border-primary-400 hover:bg-primary-100 md:inline-flex"><i class="ri-store-2-line" aria-hidden="true"></i>Kênh chủ sân</a>
        <a href="<?= url('/') ?>" target="_blank" class="hidden items-center gap-1.5 rounded-md border border-background-300 bg-background-100 px-3 py-2 text-sm font-semibold text-foreground-800 hover:border-primary-400 hover:bg-background-200 hover:text-primary-700 md:inline-flex"><i class="ri-external-link-line" aria-hidden="true"></i>Xem website</a>
        <button type="button" data-logout class="flex h-9 w-9 items-center justify-center rounded-md border border-background-300 bg-background-100 text-foreground-700 hover:border-accent-400 hover:bg-accent-50/20 hover:text-accent-600" aria-label="Đăng xuất" title="Đăng xuất"><i class="ri-logout-box-r-line text-lg" aria-hidden="true"></i></button>
      </div>
    </header>

    <main class="mx-auto w-full max-w-[1180px] px-4 py-6 md:px-6 md:py-8">
      <?php if ($denied): ?>
        <div class="mb-5 flex items-start gap-2 rounded-lg border border-accent-300 bg-accent-50 px-4 py-3 text-sm text-accent-800"><i class="ri-lock-line mt-0.5" aria-hidden="true"></i>Bộ quyền "<?= e($access['roleName']) ?>" chưa được cấp quyền cho mục bạn vừa mở. Đã chuyển về mục được phép.</div>
      <?php endif; ?>
      <div class="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 class="font-heading text-2xl font-extrabold text-foreground-950 md:text-3xl"><?= $meta[$tab][0] ?></h1>
          <p class="mt-1.5 max-w-2xl text-sm leading-relaxed text-foreground-600"><?= $meta[$tab][1] ?></p>
        </div>
        <div id="owner-actions" class="flex flex-wrap items-center gap-2"></div>
      </div>
      <div id="owner-main"></div>
    </main>
  </div>
</div>
<?php
});
