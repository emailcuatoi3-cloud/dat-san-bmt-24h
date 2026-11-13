<?php
/** ƯU ĐÃI & MÃ GIẢM GIÁ — /uu-dai */
$today = date('Y-m-d');
$promos = array_map('map_promotion', q_all("SELECT * FROM promotions WHERE status = 'active' AND end_date >= CURDATE() ORDER BY updated_at DESC"));
$active = count(array_filter($promos, fn($p) => $p['startDate'] <= $today));
$upcoming = count($promos) - $active;
$best = array_reduce($promos, fn($m, $p) => $p['discountType'] === 'percent' ? max($m, $p['discountValue']) : $m, 0);

render_page(['title' => 'Ưu đãi & mã giảm giá - ' . SITE_NAME, 'script' => 'pages/promotions.js', 'data' => ['promotions' => $promos]],
function () use ($active, $upcoming, $best) {
    page_hero([['Trang chủ', '/'], ['Ưu đãi & mã giảm giá']], 'Ưu đãi & mã giảm giá',
        'Tổng hợp mã giảm giá đang chạy từ các chủ sân trên Đặt Sân BMT 24H. Chọn mã phù hợp, sao chép và dán khi đặt sân để trả ít hơn cho buổi chơi.',
        function () { ?>
<div class="flex flex-wrap items-center gap-3">
  <a href="<?= url('/dat-san') ?>" class="inline-flex cursor-pointer items-center gap-2 whitespace-nowrap rounded-md bg-primary-500 px-5 py-3 text-sm font-bold text-white transition-colors hover:bg-primary-600"><i class="ri-calendar-check-line text-base" aria-hidden="true"></i>Đặt sân và dùng mã</a>
  <a href="<?= url('/tim-san') ?>" class="inline-flex cursor-pointer items-center gap-2 whitespace-nowrap rounded-md border border-background-300 bg-white px-5 py-3 text-sm font-semibold text-foreground-800 transition-colors hover:border-primary-400 hover:text-primary-700"><i class="ri-search-line text-base" aria-hidden="true"></i>Xem sân còn trống</a>
</div>
<?php });
    $stat = function ($icon, $tone, $value, $unit, $label) { ?>
      <div class="flex items-center gap-3 rounded-lg border border-background-200 bg-background-50 px-4 py-3.5">
        <span class="flex h-10 w-10 shrink-0 items-center justify-center rounded-md <?= $tone ?>"><i class="<?= $icon ?> text-lg" aria-hidden="true"></i></span>
        <div class="min-w-0"><p class="font-heading text-xl font-extrabold leading-none text-foreground-950"><?= $value ?><?php if ($unit): ?><span class="ml-1 text-xs font-semibold text-foreground-400"><?= $unit ?></span><?php endif; ?></p><p class="mt-1 text-[11px] font-medium text-foreground-500"><?= $label ?></p></div>
      </div>
    <?php };
    ?>
<div class="w-full bg-white px-4 py-6 md:px-8">
  <div class="mx-auto grid w-full max-w-[1280px] grid-cols-1 gap-3 sm:grid-cols-3">
    <?php $stat('ri-flashlight-line', 'bg-primary-100 text-primary-700', $active, 'mã', 'Đang dùng được ngay');
    $stat('ri-percent-line', 'bg-accent-100 text-accent-700', $best ? $best . '%' : '—', '', 'Mức giảm cao nhất hiện có');
    $stat('ri-time-line', 'bg-secondary-200 text-secondary-900', $upcoming, 'mã', 'Chương trình sắp mở'); ?>
  </div>
</div>
<div class="w-full px-4 pb-12 pt-2 md:px-8 md:pb-16">
  <div class="mx-auto w-full max-w-[1280px]">
    <div class="flex flex-col gap-3 rounded-lg border border-background-200 bg-white p-4 md:flex-row md:items-center md:justify-between">
      <div class="flex flex-wrap items-center gap-1 rounded-full bg-background-100 p-1" id="promo-filters"></div>
      <div class="flex w-full items-center gap-2 rounded-md border border-background-200 px-3 py-2.5 md:w-[320px]">
        <i class="ri-search-line shrink-0 text-sm text-foreground-400" aria-hidden="true"></i>
        <input type="search" id="promo-search" placeholder="Tìm mã, tên chương trình hoặc chủ sân" aria-label="Tìm mã giảm giá" class="w-full min-w-0 bg-transparent text-sm text-foreground-900 placeholder:text-foreground-400 focus:outline-none">
      </div>
    </div>
    <div id="promo-list"></div>

    <section class="mt-10 rounded-lg border border-background-200 bg-white p-5 md:p-7">
      <div class="max-w-2xl">
        <span class="inline-flex items-center gap-2 rounded-full bg-primary-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-primary-700"><i class="ri-guide-line" aria-hidden="true"></i>Cách dùng mã</span>
        <h2 class="mt-3 font-heading text-xl font-extrabold text-foreground-950 md:text-2xl">Ba bước để trả ít hơn cho buổi chơi</h2>
      </div>
      <div class="mt-6 grid grid-cols-1 gap-5 md:grid-cols-3">
        <?php foreach ([
            ['ri-search-eye-line', 'Chọn ưu đãi phù hợp', 'Lọc theo khung giờ, ngày trong tuần và mức giảm để chọn mã đúng với buổi chơi của bạn.'],
            ['ri-file-copy-line', 'Sao chép mã', 'Bấm vào ô mã hoặc nút “Lấy mã”. Mã được lưu tạm vào bộ nhớ, dán lại rất nhanh.'],
            ['ri-coupon-2-line', 'Dán mã khi đặt sân', 'Ở bước điền thông tin, dán mã vào ô “Mã giảm giá” rồi bấm áp dụng. Giá giảm hiện ngay trên tóm tắt đơn.'],
        ] as $i => $s): ?>
          <div class="relative rounded-lg border border-background-200 bg-background-50 p-4">
            <span class="absolute right-3 top-3 font-heading text-2xl font-extrabold text-background-300">0<?= $i + 1 ?></span>
            <span class="flex h-10 w-10 items-center justify-center rounded-md bg-primary-500 text-white"><i class="<?= $s[0] ?> text-lg" aria-hidden="true"></i></span>
            <h3 class="mt-3 font-heading text-sm font-bold text-foreground-950"><?= $s[1] ?></h3>
            <p class="mt-1.5 text-xs leading-relaxed text-foreground-600"><?= $s[2] ?></p>
          </div>
        <?php endforeach; ?>
      </div>
      <div class="mt-5 flex flex-col gap-3 rounded-md border border-secondary-200 bg-secondary-50 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div class="flex items-start gap-2.5"><i class="ri-information-line mt-0.5 text-secondary-900" aria-hidden="true"></i><p class="text-xs leading-relaxed text-secondary-900">Mỗi lượt đặt chỉ dùng một mã. Mã áp dụng cho tiền sân và dịch vụ thêm, không áp dụng cho đơn đã thanh toán trước đó.</p></div>
        <a href="<?= url('/dat-san') ?>" class="inline-flex shrink-0 cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-md bg-secondary-500 px-4 py-2.5 text-xs font-bold text-background-50 transition-colors hover:bg-secondary-600">Đặt sân ngay<i class="ri-arrow-right-line" aria-hidden="true"></i></a>
      </div>
    </section>
    <section class="mt-6 flex flex-col items-start justify-between gap-4 rounded-lg border border-primary-200 bg-primary-50 p-5 md:flex-row md:items-center md:p-6">
      <div class="max-w-2xl">
        <h2 class="font-heading text-base font-extrabold text-primary-900 md:text-lg">Bạn là chủ sân và muốn kéo khách vào khung giờ thấp điểm?</h2>
        <p class="mt-1.5 text-sm leading-relaxed text-primary-800/80">Tạo mã giảm giá theo phần trăm hoặc số tiền, giới hạn ngày và khung giờ áp dụng ngay trong kênh chủ sân.</p>
      </div>
      <a href="<?= url('/dang-ky-chu-san') ?>" class="inline-flex shrink-0 cursor-pointer items-center gap-2 whitespace-nowrap rounded-md bg-primary-500 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-600"><i class="ri-store-2-line text-base" aria-hidden="true"></i>Đăng ký chủ sân</a>
    </section>
  </div>
</div>
<?php
});