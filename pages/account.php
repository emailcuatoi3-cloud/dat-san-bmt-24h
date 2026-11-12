<?php
/*
 * Module: Giao diện Tài khoản khách hàng (Mã Minh Hoan - PK04409)
 * - Quản lý 6 phân khu: Tổng quan, Đơn sắp tới, Lịch sử đặt, Hóa đơn, Sân yêu thích, Hồ sơ
 * - Hỗ trợ tra cứu đơn nhanh qua mã vé + SĐT dành cho khách vãng lai
 */
/**
 * TÀI KHOẢN CỦA TÔI — /tai-khoan?tab=overview|upcoming|history|invoices|favorites|profile
 * Đã đăng nhập: lấy đơn theo tài khoản + số điện thoại. Khách vãng lai: theo mã vé lưu trên thiết bị.
 */
$u = current_user();
$tabs = ['overview', 'upcoming', 'history', 'invoices', 'favorites', 'profile'];
$tab = in_array($_GET['tab'] ?? '', $tabs, true) ? $_GET['tab'] : 'overview';

render_page([
    'title' => 'Tài khoản của tôi - ' . SITE_NAME,
    'script' => 'pages/account.js',
    'data' => ['tab' => $tab, 'courts' => public_courts(), 'cancelReasons' => CANCEL_REASONS, 'cancelOther' => CANCEL_OTHER_REASON, 'accountImage' => ACCOUNT_IMAGE],
], function () use ($u) {
    $name = $u ? ($u['full_name'] ?: $u['email']) : 'Khách vãng lai';
    page_hero([['Trang chủ', '/'], ['Tài khoản của tôi']], 'Tài khoản của tôi', 'Quản lý lịch đặt sân, theo dõi trạng thái đơn và cập nhật thông tin liên hệ của bạn.',
        function () { echo '<div id="hero-stats" class="flex flex-wrap items-center gap-2.5"></div>'; });
    $nav = [['overview', 'Tổng quan', 'ri-dashboard-line'], ['upcoming', 'Đơn sắp tới', 'ri-calendar-event-line'], ['history', 'Lịch sử đặt sân', 'ri-history-line'],
        ['invoices', 'Hóa đơn của tôi', 'ri-receipt-line'], ['favorites', 'Sân yêu thích', 'ri-heart-3-line'], ['profile', 'Thông tin cá nhân', 'ri-user-settings-line']];
    $roleLabel = ['customer' => 'Khách hàng', 'owner' => 'Chủ sân', 'admin' => 'Quản trị'][$u['role'] ?? ''] ?? 'Chưa đăng nhập';
    ?>
<div class="w-full px-4 py-6 md:px-8 md:py-8">
  <div class="mx-auto grid w-full max-w-[1280px] grid-cols-1 items-start gap-5 lg:grid-cols-[280px_1fr]">
    <aside class="min-w-0">
      <div class="rounded-lg border border-background-200 bg-white p-5">
        <div class="flex items-center gap-3">
          <span class="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary-500 font-heading text-base font-extrabold text-white"><?= $u ? e(initials_of($u['full_name'], $u['email'])) : '<i class="ri-user-line" aria-hidden="true"></i>' ?></span>
          <div class="min-w-0"><p class="truncate font-heading text-base font-bold text-foreground-950"><?= e($name) ?></p><p class="truncate text-xs text-foreground-500"><?= e($u['email'] ?? 'Đơn được lưu theo thiết bị này') ?></p></div>
        </div>
        <div class="mt-3.5 flex items-center gap-2 border-t border-background-200 pt-3.5">
          <span class="inline-flex items-center gap-1 rounded-full bg-secondary-50 px-2 py-1 text-[11px] font-semibold text-secondary-800"><i class="ri-shield-user-line" aria-hidden="true"></i><?= $roleLabel ?></span>
          <span class="text-[11px] text-foreground-500"><?= $u ? 'Thành viên từ ' . date('m/Y', strtotime($u['created_at'])) : '' ?></span>
        </div>
        <?php if (!$u): ?>
          <a href="<?= url('/dang-nhap?redirect=/tai-khoan') ?>" class="mt-3 flex items-center justify-center gap-2 rounded-md bg-primary-500 px-3 py-2 text-xs font-semibold text-white hover:bg-primary-600"><i class="ri-login-box-line" aria-hidden="true"></i>Đăng nhập để đồng bộ đơn</a>
        <?php endif; ?>
      </div>
      <nav class="mt-3 flex gap-1.5 overflow-x-auto rounded-lg border border-background-200 bg-white p-2 lg:flex-col lg:overflow-visible" aria-label="Điều hướng tài khoản" id="account-nav">
        <?php foreach ($nav as $n): ?>
          <a href="<?= url('/tai-khoan?tab=' . $n[0]) ?>" data-tab="<?= $n[0] ?>" class="flex shrink-0 items-center gap-2 whitespace-nowrap rounded-md px-3 py-2.5 text-sm font-medium transition-colors lg:justify-between">
            <span class="flex items-center gap-2"><i class="<?= $n[2] ?> text-base" aria-hidden="true"></i><?= $n[1] ?></span><span data-count></span>
          </a>
        <?php endforeach; ?>
      </nav>
      <?php if (($u['role'] ?? '') !== 'customer' || !$u): ?>
      <div class="mt-3 rounded-lg border border-secondary-200 bg-secondary-50 p-4">
        <p class="flex items-center gap-1.5 text-xs font-bold text-secondary-900"><i class="ri-store-2-line text-primary-600" aria-hidden="true"></i>Bạn là chủ sân?</p>
        <p class="mt-1.5 text-[11px] leading-relaxed text-secondary-800">Quản lý sân, duyệt đơn đặt sân và cấu hình khung giờ trong kênh dành riêng cho đối tác.</p>
        <a href="<?= url('/chu-san') ?>" class="mt-2.5 inline-flex items-center gap-1 rounded-md bg-foreground-100 px-3 py-1.5 text-[11px] font-semibold text-foreground-950 transition-colors hover:bg-foreground-200">Mở kênh chủ sân<i class="ri-arrow-right-line" aria-hidden="true"></i></a>
      </div>
      <?php endif; ?>
      <div class="mt-3 rounded-lg border border-background-200 bg-white p-4">
        <p class="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-foreground-500"><i class="ri-customer-service-2-line text-primary-600" aria-hidden="true"></i>Cần hỗ trợ</p>
        <a href="tel:<?= preg_replace('/\D/', '', HOTLINE) ?>" class="mt-2 flex items-center gap-2 text-sm font-semibold text-primary-600 hover:text-primary-700"><i class="ri-phone-line" aria-hidden="true"></i><?= HOTLINE ?></a>
        <a href="<?= url('/lien-he') ?>" class="mt-1.5 flex items-center gap-2 text-sm font-medium text-foreground-700 hover:text-primary-700"><i class="ri-mail-line" aria-hidden="true"></i>Gửi yêu cầu hỗ trợ</a>
        <?php if ($u): ?><button type="button" data-logout class="mt-3 flex w-full items-center gap-2 border-t border-background-200 pt-3 text-xs font-semibold text-foreground-500 hover:text-accent-700"><i class="ri-logout-box-r-line" aria-hidden="true"></i><span>Đăng xuất khỏi tài khoản</span></button><?php endif; ?>
      </div>
    </aside>
    <div class="min-w-0" id="account-main"></div>
  </div>
</div>
<?php
});
