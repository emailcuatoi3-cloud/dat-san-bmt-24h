<?php
/**
 * KÊNH CHỦ SÂN — /chu-san?tab=...
 * PHP dựng khung (thanh bên + đầu trang), nội dung từng tab do assets/js/pages/owner.js vẽ từ API api/owner.php.
 */
$u = current_user();
$groups = [
    ['Bảng điều khiển', [['overview', 'Tổng quan', 'ri-dashboard-3-line']]],
    ['Vận hành sân', [
        ['bookings', 'Đơn đặt sân', 'ri-calendar-check-line'],
        ['courts', 'Sân của tôi', 'ri-football-line'],
        ['schedule', 'Lịch & khung giờ', 'ri-time-line'],
        ['reviews', 'Đánh giá', 'ri-star-smile-line'],
        ['invoices', 'Hóa đơn', 'ri-bill-line'],
    ]],
    ['Kinh doanh', [
        ['reports', 'Báo cáo doanh thu', 'ri-bar-chart-2-line'],
        ['customers', 'Khách hàng', 'ri-group-line'],
        ['services', 'Dịch vụ bán kèm', 'ri-cup-line'],
        ['promotions', 'Khuyến mãi', 'ri-coupon-3-line'],
        ['deposits', 'Tiền cọc', 'ri-safe-2-line'],
    ]],
];
$meta = [
    'overview' => ['Tổng quan', 'Theo dõi đơn đặt sân, doanh thu và tình hình hoạt động của các sân trong ngày.'],
    'bookings' => ['Đơn đặt sân', 'Duyệt yêu cầu mới, theo dõi đơn đã xác nhận và tra cứu lịch sử đơn của khách.'],
    'invoices' => ['Hóa đơn', 'Mỗi lượt chơi hoàn thành tự sinh một hóa đơn. In, gửi cho khách và theo dõi khoản còn phải thu.'],
    'courts' => ['Sân của tôi', 'Cập nhật thông tin, giá thuê và trạng thái hiển thị của từng sân trên trang tìm sân.'],
    'reviews' => ['Đánh giá của khách', 'Đọc cảm nhận của khách về từng sân và phản hồi công khai để giữ uy tín cho cơ sở của bạn.'],
    'schedule' => ['Lịch & khung giờ', 'Thiết lập giờ mở cửa, khóa khung giờ bảo trì và điều chỉnh giá theo từng khung giờ.'],
    'reports' => ['Báo cáo doanh thu', 'Doanh thu, tỷ lệ lấp đầy và hiệu quả từng sân theo tuần, tháng, quý — xuất Excel để đối chiếu.'],
    'customers' => ['Khách hàng', 'Danh sách khách đã từng đặt sân, số lượt chơi, tổng chi tiêu và lịch sử đặt của từng người.'],
    'services' => ['Dịch vụ bán kèm', 'Quản lý nước uống, dụng cụ cho thuê và đồ ăn nhẹ kèm giá bán, tồn kho để cộng vào hóa đơn.'],
    'promotions' => ['Khuyến mãi', 'Tạo mã giảm theo % hoặc số tiền, giới hạn ngày và khung giờ áp dụng, theo dõi hiệu quả từng mã.'],
    'deposits' => ['Tiền cọc', 'Theo dõi tiền cọc khách đã chuyển, phần còn phải thu tại sân và các khoản cần hoàn khi huỷ.'],
];
$tab = isset($meta[$_GET['tab'] ?? '']) ? $_GET['tab'] : 'overview';
$business = $u['business_name'] ?: $u['full_name'];

render_page([
    'title' => $meta[$tab][0] . ' · Kênh chủ sân - ' . SITE_NAME,
    'layout' => 'bare',
    'bodyClass' => 'bg-background-100',
    'script' => 'pages/owner.js',
    'data' => [
        'tab' => $tab, 'meta' => $meta, 'business' => $business,
        'rejectReasons' => OWNER_REJECT_REASONS, 'otherReason' => CANCEL_OTHER_REASON,
        'areas' => court_areas(), 'facilityImages' => FACILITY_IMAGES,
    ],
], function () use ($u, $groups, $meta, $tab, $business) {
    ?>
<div class="min-h-screen bg-background-100">
  <!-- Thanh bên -->
  <div id="owner-overlay" class="fixed inset-0 z-40 hidden bg-black/40 lg:hidden"></div>
  <aside id="owner-sidebar" class="fixed inset-y-0 left-0 z-50 flex w-[264px] -translate-x-full flex-col border-r border-background-200 bg-white transition-transform lg:translate-x-0">
    <a href="<?= url('/') ?>" class="flex h-16 shrink-0 items-center gap-2.5 border-b border-background-200 px-5">
      <span class="flex h-9 w-9 items-center justify-center rounded-md bg-primary-500 text-white"><i class="ri-football-fill text-lg" aria-hidden="true"></i></span>
      <span class="leading-tight"><span class="block font-heading text-sm font-extrabold text-foreground-950">Đặt Sân BMT 24H</span><span class="block text-[11px] font-medium text-foreground-500">Kênh chủ sân</span></span>
    </a>
    <nav class="flex-1 overflow-y-auto px-3 py-4" aria-label="Điều hướng chủ sân">
      <?php foreach ($groups as [$label, $items]): ?>
        <p class="mb-1.5 mt-4 px-3 text-[10px] font-bold uppercase tracking-[0.12em] text-foreground-400 first:mt-0"><?= $label ?></p>
        <?php foreach ($items as [$key, $text, $icon]): ?>
          <a href="<?= url('/chu-san?tab=' . $key) ?>" data-tab="<?= $key ?>" class="<?= $key === $tab ? 'bg-primary-50 text-primary-700' : 'text-foreground-700 hover:bg-background-100 hover:text-foreground-950' ?> mb-0.5 flex items-center justify-between gap-2 rounded-md px-3 py-2.5 text-sm font-medium transition-colors">
            <span class="flex items-center gap-2.5"><i class="<?= $icon ?> text-[17px]" aria-hidden="true"></i><?= $text ?></span>
            <span data-badge="<?= $key ?>" class="hidden min-w-[20px] rounded-full bg-accent-500 px-1.5 py-0.5 text-center text-[10px] font-bold text-white"></span>
          </a>
        <?php endforeach; ?>
      <?php endforeach; ?>
    </nav>
    <div class="border-t border-background-200 p-4">
      <div class="flex items-center gap-2.5">
        <span class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-secondary-500 text-xs font-bold text-white"><?= e(initials_of($u['full_name'], $u['email'])) ?></span>
        <div class="min-w-0"><p class="truncate text-sm font-semibold text-foreground-950"><?= e($business) ?></p><p class="truncate text-[11px] text-foreground-500"><?= e($u['email']) ?></p></div>
      </div>
      <a href="<?= url('/') ?>" class="mt-3 flex items-center gap-2 text-xs font-semibold text-foreground-600 hover:text-primary-700"><i class="ri-arrow-left-line" aria-hidden="true"></i>Về trang khách hàng</a>
    </div>
  </aside>

  <div class="lg:ml-[264px]">
    <!-- Đầu trang -->
    <header class="sticky top-0 z-30 flex h-16 items-center justify-between gap-3 border-b border-background-200 bg-white/95 px-4 backdrop-blur md:px-6">
      <div class="flex min-w-0 items-center gap-3">
        <button type="button" id="owner-menu-btn" class="flex h-9 w-9 items-center justify-center rounded-md border border-background-300 text-foreground-700 lg:hidden" aria-label="Mở menu"><i class="ri-menu-line text-lg" aria-hidden="true"></i></button>
        <div class="min-w-0">
          <p class="truncate text-[11px] font-medium text-foreground-500">Xin chào, <?= e($u['full_name'] ?: $business) ?></p>
          <p class="truncate font-heading text-sm font-bold text-foreground-950"><?= e($business) ?></p>
        </div>
      </div>
      <div class="flex items-center gap-2">
        <?php render_language_toggle(false, 'hidden sm:flex'); ?>
        <?php render_theme_toggle(false); ?>
        <a href="<?= url('/chu-san?tab=bookings') ?>" class="relative flex h-9 w-9 items-center justify-center rounded-md border border-background-300 text-foreground-700 hover:border-primary-400 hover:text-primary-700" aria-label="Đơn chờ duyệt" title="Đơn chờ duyệt">
          <i class="ri-notification-3-line text-lg" aria-hidden="true"></i>
          <span id="owner-bell" class="absolute -right-1 -top-1 hidden min-w-[18px] rounded-full bg-accent-500 px-1 text-center text-[10px] font-bold leading-[18px] text-white"></span>
        </a>
        <button type="button" id="counter-btn" class="hidden items-center gap-1.5 whitespace-nowrap rounded-md bg-primary-500 px-3.5 py-2 text-sm font-semibold text-white hover:bg-primary-600 md:inline-flex"><i class="ri-add-line" aria-hidden="true"></i>Tạo đơn tại quầy</button>
        <button type="button" data-logout class="flex h-9 w-9 items-center justify-center rounded-md border border-background-300 text-foreground-700 hover:border-accent-400 hover:text-accent-700" aria-label="Đăng xuất" title="Đăng xuất"><i class="ri-logout-box-r-line text-lg" aria-hidden="true"></i></button>
      </div>
    </header>

    <main class="mx-auto w-full max-w-[1180px] px-4 py-6 md:px-6 md:py-8">
      <div class="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 class="font-heading text-2xl font-extrabold text-foreground-950 md:text-[28px]"><?= $meta[$tab][0] ?></h1>
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
