<?php
// MODULE: ĐẶT SÂN & TÍNH TIỀN CỌC
/** ĐẶT SÂN 3 BƯỚC — /dat-san hoặc /dat-san/{slug}. Toàn bộ luồng do assets/js/pages/booking.js điều khiển. */
$u = current_user();
render_page([
    'title' => 'Đặt sân - ' . SITE_NAME,
    'script' => 'pages/booking.js',
    'data' => [
        'courts' => array_values(array_filter(public_courts(), fn($c) => $c['status'] === 'active')),
        'areas' => court_areas(),
        'priceRanges' => PRICE_RANGES,
        'preset' => [
            'slug' => $params[0] ?? '',
            'date' => $_GET['date'] ?? '',
            'slot' => $_GET['slot'] ?? '',
            'promo' => $_GET['promo'] ?? '',
        ],
        'contact' => $u ? ['name' => $u['full_name'], 'phone' => preg_replace('/\D/', '', $u['phone']), 'email' => $u['email']] : null,
    ],
], function () {
    ?>
<div id="booking-header" class="w-full border-b border-background-200 bg-background-100 px-4 py-5 md:px-8">
  <div class="mx-auto w-full max-w-[1280px]">
    <div class="flex flex-wrap items-center gap-1.5 text-xs text-foreground-500">
      <a href="<?= url('/') ?>" class="transition-colors hover:text-primary-600">Trang chủ</a><i class="ri-arrow-right-s-line text-foreground-400" aria-hidden="true"></i>
      <a href="<?= url('/tim-san') ?>" class="transition-colors hover:text-primary-600">Tìm sân thể thao</a><i class="ri-arrow-right-s-line text-foreground-400" aria-hidden="true"></i>
      <span class="text-foreground-900">Đặt sân</span>
    </div>
    <h1 class="mt-2.5 font-heading text-xl font-extrabold text-foreground-950 md:text-2xl">Đặt sân trong 3 bước</h1>
    <p class="mt-1 text-sm text-foreground-600">Chọn giờ → điền thông tin → cọc VietQR và nhận vé điện tử. Không bắt buộc tạo tài khoản.</p>
  </div>
</div>
<div id="booking-app" class="w-full px-4 py-8 md:px-8">
  <div class="mx-auto grid w-full max-w-[1280px] grid-cols-1 gap-6 lg:grid-cols-[1fr_360px]">
    <div class="min-w-0">
      <div id="steps"></div>
      <div class="mt-5 rounded-lg border border-background-200 bg-white p-5 md:p-6">
        <div id="step-error"></div>
        <div id="step-body"></div>
        <div id="step-nav"></div>
      </div>
    </div>
    <aside class="min-w-0">
      <div class="flex flex-col gap-4 lg:sticky lg:top-[88px]">
        <div id="summary"></div>
        <div class="rounded-lg border border-background-200 bg-white p-5">
          <h3 class="font-heading text-sm font-bold text-foreground-950">Chính sách hủy sân</h3>
          <ul class="mt-2.5 space-y-2 text-xs leading-relaxed text-foreground-600">
            <li class="flex gap-2"><i class="ri-check-line mt-0.5 text-primary-600" aria-hidden="true"></i>Còn từ <?= CANCEL_CUTOFF_HOURS ?> giờ trước giờ chơi: được hủy, hoàn 100% tiền cọc</li>
            <li class="flex gap-2"><i class="ri-lock-2-line mt-0.5 text-foreground-500" aria-hidden="true"></i>Trong <?= CANCEL_CUTOFF_HOURS ?> giờ cuối: nút hủy khóa, vui lòng gọi hotline để chủ sân hỗ trợ</li>
            <li class="flex gap-2"><i class="ri-check-line mt-0.5 text-primary-600" aria-hidden="true"></i>Lỗi từ phía sân: hoàn 100% tiền cọc</li>
          </ul>
          <p class="mt-3 text-[11px] leading-relaxed text-foreground-500">Ngày chơi gần nhất: <span class="font-semibold text-foreground-800" data-policy-date></span></p>
        </div>
        <div class="rounded-lg border border-background-200 bg-white p-5">
          <h3 class="font-heading text-sm font-bold text-foreground-950">Cần hỗ trợ?</h3>
          <p class="mt-1.5 text-xs leading-relaxed text-foreground-600">Gọi hotline để được đặt sân qua điện thoại, hoặc gửi yêu cầu cho chúng tôi.</p>
          <a href="tel:<?= preg_replace('/\D/', '', HOTLINE) ?>" class="mt-3 flex items-center gap-2 text-sm font-semibold text-primary-600 hover:text-primary-700"><i class="ri-phone-line" aria-hidden="true"></i><?= HOTLINE ?></a>
          <a href="<?= url('/lien-he') ?>" class="mt-2 flex items-center gap-2 text-sm font-semibold text-foreground-700 hover:text-primary-700"><i class="ri-mail-line" aria-hidden="true"></i>Gửi yêu cầu hỗ trợ</a>
        </div>
      </div>
    </aside>
  </div>
</div>
<div id="ticket-view" class="hidden"></div>
<?php
});
