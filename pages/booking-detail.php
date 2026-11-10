<?php
/** CHI TIẾT ĐƠN ĐẶT SÂN — /don-dat-san/{mã vé}. Ai có đường dẫn đều xem được vé (giống bản gốc). */
$code = strtoupper(trim($params[0] ?? ''));
$row = $code ? q_one(BOOKING_SELECT . ' WHERE b.code = ?', [$code]) : null;
$booking = $row ? map_booking($row) : null;

render_page([
    'title' => ($booking ? 'Đơn ' . $booking['code'] : 'Chi tiết đơn đặt sân') . ' - ' . SITE_NAME,
    'script' => 'pages/booking-detail.js',
    'data' => ['booking' => $booking],
], function () use ($booking) {
    page_hero(
        [['Trang chủ', '/'], ['Tài khoản của tôi', '/tai-khoan'], ['Chi tiết đơn đặt sân']],
        $booking ? $booking['courtName'] : 'Chi tiết đơn đặt sân',
        $booking ? 'Mã đơn ' . $booking['code'] . '. Mở vé QR, gửi đường dẫn cho người cùng đội và thêm nhắc lịch chơi vào điện thoại.'
                 : 'Xem lại vé QR, chia sẻ đường dẫn đơn và đặt nhắc lịch để không bỏ lỡ giờ chơi.',
        $booking ? function () { echo '<div id="hero-chips" class="flex flex-wrap items-center gap-2.5"></div>'; } : null
    );
    ?>
<div class="w-full px-4 py-6 md:px-8 md:py-8">
  <div class="mx-auto w-full max-w-[1280px]">
    <?php if (!$booking): ?>
      <div class="mx-auto w-full max-w-xl rounded-lg border border-background-200 bg-white p-6 text-center">
        <span class="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-accent-50 text-accent-600"><i class="ri-file-search-line text-3xl" aria-hidden="true"></i></span>
        <h2 class="mt-4 font-heading text-xl font-extrabold text-foreground-950">Không tìm thấy đơn này</h2>
        <p class="mt-2 text-sm leading-relaxed text-foreground-600">Đường dẫn có thể đã bị sao chép thiếu ký tự, hoặc đơn được đặt trên một thiết bị khác. Bạn tra cứu lại bằng mã vé in trên tin nhắn xác nhận nhé.</p>
        <div class="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-center">
          <a href="<?= url('/tai-khoan?tab=upcoming') ?>" class="inline-flex cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-md bg-primary-500 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-600"><i class="ri-user-line" aria-hidden="true"></i>Mở tài khoản của tôi</a>
          <a href="" class="inline-flex cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-md border border-background-300 px-4 py-2.5 text-sm font-semibold text-foreground-800 transition-colors hover:border-primary-400 hover:text-primary-700"><i class="ri-refresh-line" aria-hidden="true"></i>Thử tải lại</a>
        </div>
        <p class="mt-4 text-xs text-foreground-500">Cần hỗ trợ gấp? Gọi <a href="tel:<?= preg_replace('/\D/', '', HOTLINE) ?>" class="font-semibold text-primary-600 hover:text-primary-700"><?= HOTLINE ?></a>.</p>
      </div>
    <?php else: ?>
      <div class="grid grid-cols-1 items-start gap-5 lg:grid-cols-[1fr_360px]">
        <div class="flex min-w-0 flex-col gap-4"><div id="ticket-card"></div><div id="summary-card"></div></div>
        <aside class="flex min-w-0 flex-col gap-4 lg:sticky lg:top-[88px]">
          <div id="reminder-card"></div>
          <div id="share-card"></div>
          <section class="rounded-lg border border-background-200 bg-white p-5">
            <h2 class="flex items-center gap-2 font-heading text-base font-bold text-foreground-950"><i class="ri-customer-service-2-line text-primary-600" aria-hidden="true"></i>Cần hỗ trợ?</h2>
            <p class="mt-1 text-xs leading-relaxed text-foreground-600">Đổi giờ, đổi sân hoặc cần chủ sân xác nhận lại đơn — gọi hotline để được xử lý nhanh nhất.</p>
            <a href="tel:<?= preg_replace('/\D/', '', HOTLINE) ?>" class="mt-3 flex cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-md border border-primary-300 bg-primary-50 px-4 py-2.5 text-xs font-semibold text-primary-800 transition-colors hover:bg-primary-100"><i class="ri-phone-line" aria-hidden="true"></i>Gọi <?= HOTLINE ?></a>
            <div class="mt-2.5 flex flex-col gap-2">
              <a href="<?= url('/tai-khoan?tab=upcoming') ?>" class="flex cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-md border border-background-300 px-4 py-2.5 text-xs font-semibold text-foreground-800 transition-colors hover:border-primary-400 hover:text-primary-700"><i class="ri-file-list-3-line" aria-hidden="true"></i>Quản lý đơn trong tài khoản</a>
              <a href="<?= url('/dat-san/' . ($booking['courtSlug'] ?? '')) ?>" class="flex cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-md border border-background-300 px-4 py-2.5 text-xs font-semibold text-foreground-800 transition-colors hover:border-primary-400 hover:text-primary-700"><i class="ri-calendar-2-line" aria-hidden="true"></i>Đặt thêm khung giờ khác</a>
            </div>
          </section>
          <p class="px-1 text-[11px] leading-relaxed text-foreground-500">Đường dẫn trang này gắn với mã đơn của bạn, nên có thể lưu vào ghi chú hoặc gửi lại cho chính mình để mở vé nhanh khi tới sân.</p>
        </aside>
      </div>
    <?php endif; ?>
  </div>
</div>
<?php
});
