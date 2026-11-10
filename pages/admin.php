<?php
/**
 * TRANG QUẢN TRỊ — /quan-tri?tab=...
 * Chỉ hiện các mục mà bộ quyền của quản trị viên được phép; nội dung do assets/js/pages/admin.js vẽ.
 */
$u = current_user();
$access = admin_access();
$meta = [
    'overview' => ['Tổng quan hệ thống', 'Toàn cảnh tài khoản, sân và đơn đặt sân trên Đặt Sân BMT 24H trong một màn hình.'],
    'accounts' => ['Quản lý tài khoản', 'Tra cứu khách hàng, chủ sân và quản trị viên; đổi vai trò, cấp hoặc thu bộ quyền quản trị và tạm khóa tài khoản vi phạm.'],
    'courts' => ['Sân & cơ sở', 'Giám sát mọi sân trên hệ thống, tạm dừng sân chưa đạt tiêu chuẩn hoặc gỡ sân khỏi nền tảng.'],
    'bookings' => ['Đơn đặt sân', 'Theo dõi toàn bộ đơn của khách, duyệt hoặc từ chối các đơn còn chờ xử lý.'],
    'invoices' => ['Hóa đơn & công nợ', 'Đối soát hóa đơn toàn hệ thống: doanh thu, phần đã thu, công nợ và xuất Excel để lưu trữ.'],
    'categories' => ['Danh mục môn & khu vực', 'Quản lý bộ môn thể thao và khu vực dùng cho bộ lọc tìm sân của khách hàng.'],
    'content' => ['Nội dung website', 'Biên tập banner, tin tức, câu hỏi thường gặp và chính sách hiển thị công khai.'],
    'moderation' => ['Kiểm duyệt & báo cáo vi phạm', 'Duyệt hoặc ẩn đánh giá, tiếp nhận và ghi kết quả xử lý báo cáo vi phạm.'],
    'promotions' => ['Khuyến mãi & mã giảm giá', 'Theo dõi hiệu quả từng mã giảm giá: số lượt dùng, ngân sách đã giảm và doanh thu mang lại.'],
    'audit' => ['Nhật ký thao tác quản trị', 'Tra cứu toàn bộ thao tác duyệt đơn, ẩn đánh giá, đổi nội dung và phân quyền.'],
];
$allowed = $access['allowed'];
$tab = $_GET['tab'] ?? 'overview';
$denied = isset($meta[$tab]) && !in_array($tab, $allowed, true);
if (!isset($meta[$tab]) || $denied) $tab = $allowed[0] ?? 'overview';
$modules = array_values(array_filter(ADMIN_MODULES, fn($m) => in_array($m['key'], $allowed, true)));

render_page([
    'title' => $meta[$tab][0] . ' · Quản trị - ' . SITE_NAME,
    'layout' => 'bare',
    'bodyClass' => 'bg-background-100',
    'script' => 'pages/admin.js',
    'data' => ['tab' => $tab, 'access' => $access, 'denied' => $denied, 'modules' => ADMIN_MODULES],
], function () use ($u, $access, $meta, $tab, $modules, $denied) {
    ?>
<div class="min-h-screen bg-background-100">
  <div id="owner-overlay" class="fixed inset-0 z-40 hidden bg-black/40 lg:hidden"></div>
  <aside id="owner-sidebar" class="fixed inset-y-0 left-0 z-50 flex w-[264px] -translate-x-full flex-col border-r border-background-200 bg-white transition-transform lg:translate-x-0">
    <a href="<?= url('/') ?>" class="flex h-16 shrink-0 items-center gap-2.5 border-b border-background-200 px-5">
      <span class="flex h-9 w-9 items-center justify-center rounded-md bg-secondary-700 text-white"><i class="ri-shield-star-fill text-lg" aria-hidden="true"></i></span>
      <span class="leading-tight"><span class="block font-heading text-sm font-extrabold text-foreground-950">Đặt Sân BMT 24H</span><span class="block text-[11px] font-medium text-foreground-500">Trang quản trị</span></span>
    </a>
    <nav class="flex-1 overflow-y-auto px-3 py-4" aria-label="Điều hướng quản trị">
      <p class="mb-1.5 px-3 text-[10px] font-bold uppercase tracking-[0.12em] text-foreground-400">Quản trị hệ thống</p>
      <?php foreach ($modules as $m): ?>
        <a href="<?= url('/quan-tri?tab=' . $m['key']) ?>" class="<?= $m['key'] === $tab ? 'bg-primary-50 text-primary-700' : 'text-foreground-700 hover:bg-background-100 hover:text-foreground-950' ?> mb-0.5 flex items-center justify-between gap-2 rounded-md px-3 py-2.5 text-sm font-medium transition-colors">
          <span class="flex items-center gap-2.5"><i class="<?= $m['icon'] ?> text-[17px]" aria-hidden="true"></i><?= $m['label'] ?></span>
          <span data-badge="<?= $m['key'] ?>" class="hidden min-w-[20px] rounded-full bg-accent-500 px-1.5 py-0.5 text-center text-[10px] font-bold text-white"></span>
        </a>
      <?php endforeach; ?>
    </nav>
    <div class="border-t border-background-200 p-4">
      <div class="flex items-center gap-2.5">
        <span class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-secondary-700 text-xs font-bold text-white"><?= e(initials_of($u['full_name'], $u['email'])) ?></span>
        <div class="min-w-0"><p class="truncate text-sm font-semibold text-foreground-950"><?= e($access['actorName']) ?></p><p class="truncate text-[11px] text-foreground-500"><?= e($access['roleName']) ?></p></div>
      </div>
      <a href="<?= url('/') ?>" class="mt-3 flex items-center gap-2 text-xs font-semibold text-foreground-600 hover:text-primary-700"><i class="ri-arrow-left-line" aria-hidden="true"></i>Về trang khách hàng</a>
    </div>
  </aside>

  <div class="lg:ml-[264px]">
    <header class="sticky top-0 z-30 flex h-16 items-center justify-between gap-3 border-b border-background-200 bg-white/95 px-4 backdrop-blur md:px-6">
      <div class="flex min-w-0 items-center gap-3">
        <button type="button" id="owner-menu-btn" class="flex h-9 w-9 items-center justify-center rounded-md border border-background-300 text-foreground-700 lg:hidden" aria-label="Mở menu"><i class="ri-menu-line text-lg" aria-hidden="true"></i></button>
        <div class="min-w-0">
          <p class="truncate text-[11px] font-medium text-foreground-500">Xin chào, <?= e($access['actorName']) ?></p>
          <p class="flex items-center gap-1.5 truncate font-heading text-sm font-bold text-foreground-950"><i class="ri-shield-user-line text-primary-600" aria-hidden="true"></i><?= e($access['roleName']) ?></p>
        </div>
      </div>
      <div class="flex items-center gap-2">
        <?php render_language_toggle(false, 'hidden sm:flex'); ?>
        <?php render_theme_toggle(false); ?>
        <a href="<?= url('/') ?>" target="_blank" class="hidden items-center gap-1.5 rounded-md border border-background-300 px-3 py-2 text-sm font-semibold text-foreground-800 hover:border-primary-400 hover:text-primary-700 md:inline-flex"><i class="ri-external-link-line" aria-hidden="true"></i>Xem website</a>
        <button type="button" data-logout class="flex h-9 w-9 items-center justify-center rounded-md border border-background-300 text-foreground-700 hover:border-accent-400 hover:text-accent-700" aria-label="Đăng xuất" title="Đăng xuất"><i class="ri-logout-box-r-line text-lg" aria-hidden="true"></i></button>
      </div>
    </header>

    <main class="mx-auto w-full max-w-[1180px] px-4 py-6 md:px-6 md:py-8">
      <?php if ($denied): ?>
        <div class="mb-5 flex items-start gap-2 rounded-lg border border-accent-300 bg-accent-50 px-4 py-3 text-sm text-accent-800"><i class="ri-lock-line mt-0.5" aria-hidden="true"></i>Bộ quyền "<?= e($access['roleName']) ?>" chưa được cấp quyền cho mục bạn vừa mở. Đã chuyển về mục được phép.</div>
      <?php endif; ?>
      <div class="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 class="font-heading text-2xl font-extrabold text-foreground-950 md:text-[28px]"><?= $meta[$tab][0] ?></h1>
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
