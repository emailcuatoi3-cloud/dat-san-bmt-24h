<?php
/**
 * KÊNH CHỦ SÂN — /chu-san?tab=...
 * PHP dựng khung (thanh bên + đầu trang), nội dung từng tab do assets/js/pages/owner.js vẽ từ API api/owner.php.
 */
$u = current_user();
// Cấu trúc thanh bên bám sát 9 nhóm của Sitemap Chủ sân
$groups = [
    ['Vận hành', [
        ['overview', 'Tổng quan', 'ri-dashboard-3-line'],
        ['courts', 'Quản lý sân', 'ri-football-line'],
        ['bookings', 'Đơn đặt sân', 'ri-calendar-check-line'],
        ['payments', 'Thanh toán', 'ri-bill-line'],
    ]],
    ['Kinh doanh', [
        ['services', 'Dịch vụ', 'ri-cup-line'],
        ['promotions', 'Khuyến mãi', 'ri-coupon-3-line'],
        ['customers', 'Khách hàng & đánh giá', 'ri-group-line'],
    ]],
    ['Hệ thống cơ sở', [
        ['staff', 'Quản lý nhân viên', 'ri-team-line'],
        ['settings', 'Cài đặt', 'ri-settings-3-line'],
        ['account', 'Tài khoản', 'ri-user-settings-line'],
    ]],
];
$meta = [
    'overview' => ['Tổng quan', 'Đơn hôm nay, doanh thu, yêu cầu chờ xử lý, thống kê khung giờ và thống kê doanh thu.'],
    'courts' => ['Quản lý sân', 'Danh sách sân, chi tiết sân, thêm sân mới, bảng giá & khung giờ và khóa sân bảo trì.'],
    'bookings' => ['Đơn đặt sân', 'Lịch sân trực quan, danh sách đơn đặt, lịch cố định hằng tuần và tạo đơn tại quầy.'],
    'payments' => ['Thanh toán', 'Hóa đơn & chi tiết hóa đơn, lịch sử thanh toán tiền cọc và quản lý yêu cầu hoàn tiền.'],
    'services' => ['Dịch vụ', 'Quản lý dịch vụ bán kèm, nhập kho và theo dõi tồn kho nước uống, dụng cụ.'],
    'promotions' => ['Khuyến mãi', 'Tạo mã giảm giá và thiết lập chương trình ưu đãi giờ vàng thu hút khách.'],
    'customers' => ['Khách hàng & đánh giá', 'Danh sách khách hàng, phản hồi đánh giá công khai và tiếp nhận khiếu nại.'],
    'staff' => ['Quản lý nhân viên', 'Danh sách nhân viên cơ sở, tài khoản đăng nhập, phân quyền thao tác và kiểm soát thu ngân.'],
    'settings' => ['Cài đặt', 'Chính sách đặt sân, tiền cọc, hủy sân và cấu hình nhận thông báo.'],
    'account' => ['Tài khoản', 'Hồ sơ chủ sân, tài khoản ngân hàng nhận tiền VietQR, đổi mật khẩu và đăng xuất.'],
];
// Giữ tương thích với các đường dẫn tab cũ
$tabAliases = [
    'schedule' => ['courts', 'schedule'],
    'invoices' => ['payments', 'invoices'],
    'deposits' => ['payments', 'refunds'],
    'reports' => ['overview', 'reports'],
    'reviews' => ['customers', 'reviews'],
];
$rawTab = $_GET['tab'] ?? 'overview';
$subTab = $_GET['sub'] ?? '';
// Chuyển hướng sub-tab staff cũ sang tab chính staff
if ($rawTab === 'settings' && $subTab === 'staff') {
    $rawTab = 'staff';
    $subTab = '';
}
if (isset($tabAliases[$rawTab])) {
    [$tab, $subTab] = $tabAliases[$rawTab];
} else {
    $tab = isset($meta[$rawTab]) ? $rawTab : 'overview';
}
$business = $u['business_name'] ?: $u['full_name'];

$staff = current_staff();
if ($staff) {
    $filteredGroups = [];
    foreach ($groups as [$grpLabel, $items]) {
        $allowedItems = [];
        foreach ($items as $item) {
            [$key] = $item;
            if (staff_can($key)) {
                $allowedItems[] = $item;
            }
        }
        if ($allowedItems) {
            $filteredGroups[] = [$grpLabel, $allowedItems];
        }
    }
    $groups = $filteredGroups;
    if (!staff_can($tab)) {
        $tab = $groups[0][1][0][0] ?? 'bookings';
    }
}

render_page([
    'title' => $meta[$tab][0] . ' · Kênh chủ sân - ' . SITE_NAME,
    'layout' => 'bare',
    'bodyClass' => 'bg-background-100',
    'script' => 'pages/owner.js',
    'data' => [
        'tab' => $tab, 'sub' => $subTab, 'meta' => $meta, 'business' => $business, 'staff' => $staff,
        'rejectReasons' => OWNER_REJECT_REASONS, 'otherReason' => CANCEL_OTHER_REASON,
        'areas' => court_areas(), 'facilityImages' => FACILITY_IMAGES,
    ],
], function () use ($u, $staff, $groups, $meta, $tab, $business) {
    $imp = impersonating_admin();
    ?>
<div class="min-h-screen bg-background-100" <?= $imp ? 'style="padding-top: var(--ghost-banner-height, 44px);"' : '' ?>>
  <!-- Thanh bên -->
  <div id="owner-overlay" class="fixed inset-0 z-40 hidden bg-black/40 lg:hidden"></div>
  <aside id="owner-sidebar" class="fixed inset-y-0 left-0 z-50 flex w-[264px] -translate-x-full flex-col border-r border-background-200 bg-white transition-transform lg:translate-x-0" <?= $imp ? 'style="top: var(--ghost-banner-height, 44px);"' : '' ?>>
    <a href="<?= url('/') ?>" class="flex h-16 shrink-0 items-center gap-3 border-b border-background-200 px-5 group">
      <img src="<?= site_logo() ?>" alt="Logo Đặt Sân BMT 24H" class="h-10 w-10 rounded-xl object-contain drop-shadow-sm transition-transform group-hover:scale-105">
      <div class="leading-tight">
        <div class="flex items-center gap-1.5">
          <span class="font-heading text-sm font-black text-foreground-950">ĐẶT SÂN BMT</span>
          <span class="rounded bg-primary-500 px-1 py-0.2 text-[10px] font-bold text-white">24H</span>
        </div>
        <span class="block text-xs font-medium text-foreground-500">Kênh chủ sân</span>
      </div>
    </a>
    <div class="border-b border-background-200 p-3">
      <button type="button" data-open-counter class="flex w-full cursor-pointer items-center justify-center gap-2 rounded-md bg-primary-500 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-primary-600"><i class="ri-add-circle-line text-lg" aria-hidden="true"></i>Tạo đơn tại quầy</button>
    </div>
    <nav class="flex-1 overflow-y-auto px-3 py-4" aria-label="Điều hướng chủ sân">
      <?php foreach ($groups as [$label, $items]): ?>
        <p class="mb-1.5 mt-4 px-3 text-xs font-bold uppercase tracking-wider text-foreground-400 first:mt-0"><?= $label ?></p>
        <?php foreach ($items as [$key, $text, $icon]): ?>
          <a href="<?= url('/chu-san?tab=' . $key) ?>" data-tab="<?= $key ?>" class="<?= $key === $tab ? 'bg-primary-50 text-primary-700' : 'text-foreground-700 hover:bg-background-100 hover:text-foreground-950' ?> mb-0.5 flex items-center justify-between gap-2 rounded-md px-3 py-2.5 text-sm font-medium transition-colors">
            <span class="flex items-center gap-2.5"><i class="<?= $icon ?> text-lg" aria-hidden="true"></i><?= $text ?></span>
            <span data-badge="<?= $key ?>" class="hidden min-w-[20px] rounded-full bg-accent-500 px-1.5 py-0.5 text-center text-xs font-bold text-white"></span>
          </a>
        <?php endforeach; ?>
      <?php endforeach; ?>
    </nav>
    <div class="border-t border-background-200 p-4">
      <div class="flex items-center gap-2.5">
        <span class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full <?= $staff ? 'bg-primary-600' : 'bg-secondary-500' ?> text-xs font-bold text-white"><?= e(initials_of($staff ? $staff['name'] : $u['full_name'], $staff ? $staff['email'] : $u['email'])) ?></span>
        <div class="min-w-0">
          <p class="truncate text-sm font-semibold text-foreground-950"><?= e($staff ? $staff['name'] : $business) ?></p>
          <p class="truncate text-xs <?= $staff ? 'font-semibold text-primary-600' : 'text-foreground-500' ?>"><?= e($staff ? ($staff['roleName'] . ' · ' . $business) : $u['email']) ?></p>
        </div>
      </div>
      <a href="<?= url('/') ?>" class="mt-3 flex items-center gap-2 text-xs font-semibold text-foreground-600 hover:text-primary-700"><i class="ri-arrow-left-line" aria-hidden="true"></i>Về trang khách hàng</a>
      <?php if ($imp): ?>
        <a href="<?= url('/thoat-gia-lap') ?>" class="mt-2 flex items-center gap-2 text-xs font-semibold text-accent-700 hover:text-accent-800"><i class="ri-shield-user-line" aria-hidden="true"></i>Thoát giả lập & Về Quản trị</a>
      <?php endif; ?>
    </div>
  </aside>

  <div class="lg:ml-[264px]">
    <!-- Đầu trang -->
    <header class="sticky z-30 flex h-16 items-center justify-between gap-3 border-b border-background-200 bg-background-50/95 px-4 backdrop-blur-md md:px-6" <?= $imp ? 'style="top: var(--ghost-banner-height, 44px);"' : 'style="top: 0;"' ?>>
      <div class="flex min-w-0 items-center gap-3">
        <button type="button" id="owner-menu-btn" class="flex h-9 w-9 items-center justify-center rounded-md border border-background-300 bg-background-100 text-foreground-700 hover:bg-background-200 lg:hidden" aria-label="Mở menu"><i class="ri-menu-line text-lg" aria-hidden="true"></i></button>
        <div class="min-w-0">
          <p class="truncate text-xs font-medium text-foreground-500">Xin chào, <?= e($staff ? $staff['name'] : ($u['full_name'] ?: $business)) ?><?= $staff ? ' <span class="rounded bg-primary-100 px-1.5 py-0.5 text-xs font-bold text-primary-700">Nhân viên</span>' : '' ?></p>
          <p class="truncate font-heading text-sm font-bold text-foreground-950"><?= e($staff ? ($staff['roleName'] . ' · ' . $business) : $business) ?></p>
        </div>
      </div>
      <div class="flex items-center gap-2">
        <?php if ($imp): ?>
          <a href="<?= url('/thoat-gia-lap') ?>" class="inline-flex items-center gap-1.5 rounded-md border border-accent-300 bg-accent-50 px-2.5 py-1.5 text-xs font-bold text-accent-800 hover:bg-accent-100" title="Thoát giả lập và trở lại Quản trị">
            <i class="ri-shield-user-line" aria-hidden="true"></i><span class="hidden sm:inline">Về Quản trị</span>
          </a>
        <?php endif; ?>
        <?php render_language_toggle(false, 'hidden sm:flex'); ?>
        <?php render_theme_toggle(false); ?>
        <a href="<?= url('/chu-san?tab=bookings') ?>" class="relative flex h-9 w-9 items-center justify-center rounded-md border border-background-300 bg-background-100 text-foreground-700 hover:border-primary-400 hover:bg-background-200 hover:text-primary-700" aria-label="Đơn chờ duyệt" title="Đơn chờ duyệt">
          <i class="ri-notification-3-line text-lg" aria-hidden="true"></i>
          <span id="owner-bell" class="absolute -right-1 -top-1 hidden min-w-[18px] rounded-full bg-accent-500 px-1 text-center text-xs font-bold leading-[18px] text-white"></span>
        </a>
        <button type="button" id="counter-btn" class="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-md bg-primary-500 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-primary-600 sm:px-3.5 sm:py-2 sm:text-sm"><i class="ri-add-line text-base" aria-hidden="true"></i><span class="hidden sm:inline">Tạo đơn tại quầy</span><span class="sm:hidden">Tạo đơn</span></button>
        <button type="button" data-logout class="flex h-9 w-9 items-center justify-center rounded-md border border-background-300 bg-background-100 text-foreground-700 hover:border-accent-400 hover:bg-accent-50/20 hover:text-accent-600" aria-label="Đăng xuất" title="Đăng xuất"><i class="ri-logout-box-r-line text-lg" aria-hidden="true"></i></button>
      </div>
    </header>

    <main class="mx-auto w-full max-w-[1180px] px-4 py-6 md:px-6 md:py-8">
      <div class="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 class="font-heading text-2xl font-extrabold text-foreground-950 md:text-3xl"><?= $meta[$tab][0] ?></h1>
          <p class="mt-1.5 max-w-2xl text-sm leading-relaxed text-foreground-600"><?= $meta[$tab][1] ?></p>
        </div>
        <div id="owner-actions" class="flex flex-wrap items-center gap-2"></div>
      </div>
      <div id="owner-main"><?= '' ?></div>
    </main>
  </div>
</div>
<?php
});
