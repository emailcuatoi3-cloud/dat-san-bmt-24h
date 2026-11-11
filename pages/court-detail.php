<?php
/** CHI TIẾT SÂN — /san/{slug} */
$court = find_court($params[0] ?? '');
if ($court && $court['status'] === 'paused') $court = null;

if (!$court) {
    http_response_code(404);
    render_page(['title' => 'Không tìm thấy sân - ' . SITE_NAME], function () { ?>
<div class="flex flex-col items-center justify-center px-4 py-24 text-center">
  <span class="flex h-16 w-16 items-center justify-center rounded-full bg-background-100 text-foreground-400"><i class="ri-error-warning-line text-3xl" aria-hidden="true"></i></span>
  <h1 class="mt-5 font-heading text-2xl font-bold text-foreground-950">Không tìm thấy sân này</h1>
  <p class="mt-2 max-w-md text-sm text-foreground-600">Sân có thể đã được gỡ khỏi hệ thống hoặc đường dẫn không chính xác. Bạn hãy quay lại trang tìm kiếm để chọn sân khác.</p>
  <a href="<?= url('/tim-san') ?>" class="mt-6 whitespace-nowrap rounded-md bg-primary-500 px-5 py-3 text-sm font-bold text-white transition-colors hover:bg-primary-600">Tìm sân khác</a>
</div>
<?php });
    return;
}

$gallery = array_values(array_filter([$court['images'][0] ?? '', $court['images'][1] ?? '', FACILITY_IMAGES[0], FACILITY_IMAGES[1]]));
$related = array_values(array_slice(array_filter(public_courts(), fn($c) => $c['sport'] === $court['sport'] && $c['id'] !== $court['id']), 0, 3));
$bands = $court['priceBands'] ?: [['id' => 'all', 'label' => 'Cả ngày', 'shortLabel' => 'Cả ngày', 'start' => $court['openTime'], 'end' => $court['closeTime'], 'price' => $court['pricePerHour']]];
$step = $court['fieldPriceStep'] ?? ($court['sport'] === 'football' ? 140000 : 30000);
$sorted = $bands;
usort($sorted, fn($a, $b) => $a['price'] <=> $b['price']);
$cheapest = $sorted[0];
$priciest = end($sorted);
$lowest = min(array_column($bands, 'price'));

render_page([
    'title' => $court['name'] . ' - ' . SITE_NAME,
    'description' => mb_substr($court['description'], 0, 160),
    'script' => 'pages/court-detail.js',
    'data' => ['court' => $court, 'related' => $related, 'gallery' => $gallery],
], function () use ($court, $gallery, $bands, $step, $cheapest, $priciest, $lowest) {
    $wh = $court['weeklyHours'];
    $weekday = $wh['1'] ?? null;
    $weekend = $wh['6'] ?? null;
    $hours = fn($d) => $d ? ($d['closed'] ? 'Nghỉ cả ngày' : $d['open'] . ' - ' . $d['close']) : $court['openTime'] . ' - ' . $court['closeTime'];
    ?>
<div class="w-full border-b border-background-200 bg-background-100 px-4 md:px-8 py-4">
  <div class="mx-auto flex w-full max-w-[1280px] flex-wrap items-center gap-x-3 gap-y-2 text-xs text-foreground-500">
    <button type="button" data-back class="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-md border border-background-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-foreground-800 transition-colors hover:border-primary-300 hover:bg-primary-50 hover:text-primary-700"><span class="flex h-4 w-4 items-center justify-center"><i class="ri-arrow-left-line" aria-hidden="true"></i></span>Quay lại</button>
    <span class="hidden h-4 w-px bg-background-300 sm:block"></span>
    <a href="<?= url('/') ?>" class="transition-colors hover:text-primary-600">Trang chủ</a>
    <i class="ri-arrow-right-s-line text-foreground-400" aria-hidden="true"></i>
    <a href="<?= url('/tim-san?sport=' . $court['sport']) ?>" class="transition-colors hover:text-primary-600"><?= e($court['sportLabel']) ?></a>
    <i class="ri-arrow-right-s-line text-foreground-400" aria-hidden="true"></i>
    <span class="text-foreground-900"><?= e($court['name']) ?></span>
  </div>
</div>

<!-- Thư viện ảnh -->
<div class="w-full px-4 md:px-8 pt-6">
  <div class="mx-auto w-full max-w-[1280px]">
    <div class="grid grid-cols-1 gap-2 lg:h-[520px] lg:grid-cols-[2fr_1fr]" id="gallery">
      <div class="relative h-[280px] overflow-hidden rounded-lg bg-background-100 md:h-[420px] lg:h-full">
        <img data-gallery-main src="<?= e($gallery[0]) ?>" alt="<?= e($court['name']) ?> - ảnh 1" title="<?= e($court['name']) ?> tại Buôn Ma Thuột" class="h-full w-full object-cover object-top">
        <span data-gallery-count class="absolute bottom-3 left-3 rounded-md bg-background-50/75 px-2.5 py-1 text-xs font-medium text-foreground-950">Ảnh 1 / <?= count($gallery) ?></span>
      </div>
      <div class="grid grid-cols-4 gap-2 lg:h-full lg:grid-cols-2 lg:grid-rows-2">
        <?php foreach ($gallery as $i => $img): ?>
          <button type="button" data-gallery-thumb="<?= $i ?>" aria-label="Xem ảnh <?= $i + 1 ?>" class="relative h-[64px] cursor-pointer overflow-hidden rounded-md border-2 transition-colors sm:h-[80px] md:h-[100px] lg:h-full <?= $i === 0 ? 'border-primary-500' : 'border-transparent hover:border-primary-300' ?>">
            <img src="<?= e($img) ?>" alt="<?= e($court['name']) ?> - ảnh thu nhỏ <?= $i + 1 ?>" loading="lazy" class="h-full w-full object-cover object-top">
          </button>
        <?php endforeach; ?>
      </div>
    </div>
  </div>
</div>

<div class="w-full px-4 md:px-8 py-8">
  <div class="mx-auto grid w-full max-w-[1280px] grid-cols-1 gap-8 lg:grid-cols-[1fr_360px]">
    <div class="min-w-0">
      <div class="flex flex-wrap items-center gap-2">
        <span class="inline-flex items-center gap-1.5 rounded-full bg-primary-50 px-2.5 py-1 text-xs font-semibold text-primary-700"><i class="<?= $court['sport'] === 'football' ? 'ri-football-line' : 'ri-ping-pong-line' ?>" aria-hidden="true"></i><?= e($court['sportLabel']) ?></span>
        <span data-status-badge="<?= e($court['status']) ?>"></span>
        <?php if ($court['featured']): ?><span class="inline-flex items-center gap-1 rounded-full bg-accent-50 px-2.5 py-1 text-xs font-semibold text-accent-800"><i class="ri-fire-line" aria-hidden="true"></i>Sân nổi bật</span><?php endif; ?>
      </div>
      <h1 class="mt-3 font-heading text-2xl font-extrabold leading-tight text-foreground-950 md:text-[32px]"><?= e($court['name']) ?></h1>
      <div class="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2">
        <div class="flex items-center gap-1.5"><i class="ri-star-fill text-accent-500 text-sm" aria-hidden="true"></i><span class="text-sm font-semibold text-foreground-950" data-head-rating><?= number_format($court['rating'], 1) ?></span><span class="text-xs text-foreground-500" data-head-count>(<?= $court['reviewCount'] ?> đánh giá)</span></div>
        <span class="flex items-start gap-1.5 text-sm text-foreground-600"><i class="ri-map-pin-line mt-0.5 text-foreground-400" aria-hidden="true"></i><?= e($court['address']) ?></span>
      </div>

      <div class="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div class="rounded-md border border-background-200 bg-white px-3.5 py-3"><p class="text-[11px] uppercase tracking-wide text-foreground-500">Giờ mở cửa</p><p class="mt-0.5 text-sm font-semibold text-foreground-950"><?= e($court['openTime'] . ' - ' . $court['closeTime']) ?></p><p class="mt-0.5 text-[11px] text-foreground-500">Hằng ngày</p></div>
        <div class="rounded-md border border-background-200 bg-white px-3.5 py-3"><p class="text-[11px] uppercase tracking-wide text-foreground-500">Loại sân</p><p class="mt-0.5 text-sm font-semibold text-foreground-950"><?= count($court['fieldTypes']) ?> hình thức</p></div>
        <div class="rounded-md border border-background-200 bg-white px-3.5 py-3"><p class="text-[11px] uppercase tracking-wide text-foreground-500">Khu vực</p><p class="mt-0.5 text-sm font-semibold text-foreground-950">P. <?= e($court['area']) ?></p></div>
        <div class="rounded-md border border-background-200 bg-white px-3.5 py-3"><p class="text-[11px] uppercase tracking-wide text-foreground-500">Giá từ</p><p class="mt-0.5 text-sm font-semibold text-primary-600"><?= money($lowest) ?>/giờ</p><p class="mt-0.5 text-[11px] text-foreground-500">Giá thấp nhất trong ngày</p></div>
      </div>

      <div class="mt-5 rounded-lg border border-background-200 bg-white p-5">
        <h2 class="font-heading text-base font-bold text-foreground-950">Giới thiệu sân</h2>
        <p class="mt-2.5 text-sm leading-relaxed text-foreground-600"><?= nl2br(e($court['description'])) ?></p>
        <div class="mt-4 flex flex-wrap gap-2">
          <?php foreach ($court['highlights'] as $h): ?><span class="inline-flex items-center gap-1.5 rounded-md bg-secondary-50 px-2.5 py-1.5 text-xs font-medium text-secondary-900"><i class="ri-checkbox-circle-line" aria-hidden="true"></i><?= e($h) ?></span><?php endforeach; ?>
        </div>
      </div>

      <div class="mt-5 rounded-lg border border-background-200 bg-white p-5">
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div><h2 class="font-heading text-base font-bold text-foreground-950">Giờ hoạt động</h2><p class="mt-1 text-sm text-foreground-600">Sân mở cửa hằng ngày, bạn có thể đặt sân trực tuyến bất cứ lúc nào.</p></div>
          <span class="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-primary-50 px-2.5 py-1 text-xs font-bold text-primary-700"><i class="ri-time-line" aria-hidden="true"></i><?= e($court['openTime'] . ' - ' . $court['closeTime']) ?></span>
        </div>
        <div class="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div class="rounded-md border border-background-200 bg-background-50 px-3.5 py-3"><p class="text-[11px] uppercase tracking-wide text-foreground-500">Thứ 2 - Thứ 6</p><p class="mt-1 text-sm font-semibold text-foreground-950"><?= e($hours($weekday)) ?></p></div>
          <div class="rounded-md border border-background-200 bg-background-50 px-3.5 py-3"><p class="text-[11px] uppercase tracking-wide text-foreground-500">Thứ 7 - Chủ nhật</p><p class="mt-1 text-sm font-semibold text-foreground-950"><?= e($hours($weekend)) ?></p></div>
          <div class="rounded-md border border-background-200 bg-background-50 px-3.5 py-3"><p class="text-[11px] uppercase tracking-wide text-foreground-500">Lượt chơi cuối</p><p class="mt-1 text-sm font-semibold text-foreground-950">Kết thúc trước <?= e($court['closeTime']) ?></p></div>
        </div>
        <p class="mt-3 flex items-start gap-2 text-xs leading-relaxed text-foreground-600"><i class="ri-information-line mt-0.5 text-primary-600" aria-hidden="true"></i><?= e($court['operatingNote'] ?: 'Mở cửa tất cả các ngày trong tuần') ?> · Khung giờ tối là giờ cao điểm nên giá cao hơn khung sáng.</p>
      </div>

      <div class="mt-5 grid grid-cols-1 gap-5 md:grid-cols-2">
        <div class="rounded-lg border border-background-200 bg-white p-5">
          <h2 class="font-heading text-base font-bold text-foreground-950">Tiện ích tại sân</h2>
          <ul class="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            <?php foreach ($court['facilities'] as $f): ?><li class="flex items-start gap-2 text-sm text-foreground-600"><i class="ri-check-line mt-0.5 text-primary-600" aria-hidden="true"></i><?= e($f) ?></li><?php endforeach; ?>
          </ul>
        </div>
        <div class="rounded-lg border border-background-200 bg-white p-5">
          <div class="flex flex-wrap items-center justify-between gap-2"><h2 class="font-heading text-base font-bold text-foreground-950">Bảng giá theo khung giờ</h2><span class="rounded-full bg-background-100 px-2 py-0.5 text-[11px] font-semibold text-foreground-600">Giá / giờ</span></div>
          <div class="mt-3 overflow-x-auto">
            <table class="w-full min-w-[360px] text-sm">
              <thead>
                <tr class="text-left text-[11px] uppercase tracking-wide text-foreground-500"><th class="pb-1 font-semibold">Loại sân</th><?php foreach ($bands as $b): ?><th class="pb-1 pl-2 text-right font-semibold"><?= e($b['shortLabel']) ?></th><?php endforeach; ?></tr>
                <tr class="text-[10px] text-foreground-400"><td></td><?php foreach ($bands as $b): ?><td class="whitespace-nowrap pb-2 pl-2 text-right"><?= e($b['start'] . ' - ' . $b['end']) ?></td><?php endforeach; ?></tr>
              </thead>
              <tbody>
                <?php foreach (($court['fieldTypes'] ?: ['Sân tiêu chuẩn']) as $i => $type): ?>
                  <tr class="border-t border-background-200"><td class="py-2.5 pr-2 text-foreground-700"><?= e($type) ?></td>
                    <?php foreach ($bands as $b): ?><td class="whitespace-nowrap py-2.5 pl-2 text-right font-semibold <?= !empty($b['peak']) ? 'text-accent-700' : 'text-foreground-950' ?>"><?= money($b['price'] + $i * $step) ?></td><?php endforeach; ?>
                  </tr>
                <?php endforeach; ?>
              </tbody>
            </table>
          </div>
          <?php if ($priciest['price'] > $cheapest['price']): ?>
            <p class="mt-3 rounded-md bg-accent-50 px-3 py-2 text-xs leading-relaxed text-accent-900">Khung <?= e(mb_strtolower($priciest['shortLabel'])) ?> (<?= e($priciest['start'] . ' - ' . $priciest['end']) ?>) là giờ cao điểm, cao hơn khung <?= e(mb_strtolower($cheapest['shortLabel'])) ?> <?= money($priciest['price'] - $cheapest['price']) ?>/giờ. Lượt chơi kéo dài qua nhiều khung giờ sẽ được tính theo từng giờ tương ứng.</p>
          <?php endif; ?>
        </div>
      </div>

      <div class="mt-5 rounded-lg border border-background-200 bg-white p-5">
        <div class="flex flex-wrap items-center justify-between gap-2"><h2 class="font-heading text-base font-bold text-foreground-950">Khung giờ trống</h2><span class="rounded-md bg-background-100 px-2.5 py-1 text-xs font-medium text-foreground-600" data-today-label></span></div>
        <div class="mt-3 flex flex-wrap items-center gap-3 text-xs text-foreground-500">
          <span class="flex items-center gap-1.5"><span class="h-2.5 w-2.5 rounded-sm border border-primary-300 bg-primary-50"></span>Còn trống</span>
          <span class="flex items-center gap-1.5"><span class="h-2.5 w-2.5 rounded-sm bg-background-200"></span>Đã kín</span>
          <span class="flex items-center gap-1.5"><span class="h-2.5 w-2.5 rounded-sm border border-background-300 bg-background-100"></span>Đã qua</span>
        </div>
        <div class="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6" id="slot-grid"></div>
        <div class="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-background-200 pt-4">
          <p class="text-xs text-foreground-500">Bấm vào khung giờ để đặt sân nhanh, hoặc chọn ngày khác.</p>
          <a href="<?= url('/dat-san/' . $court['slug']) ?>" class="inline-flex items-center gap-1.5 whitespace-nowrap text-sm font-semibold text-primary-600 hover:text-primary-700">Chọn ngày khác<i class="ri-arrow-right-line" aria-hidden="true"></i></a>
        </div>
      </div>

      <div class="mt-5 rounded-lg border border-background-200 bg-white p-5">
        <h2 class="font-heading text-base font-bold text-foreground-950">Vị trí sân</h2>
        <p class="mt-1.5 flex items-start gap-1.5 text-sm text-foreground-600"><i class="ri-map-pin-2-line mt-0.5 text-primary-600" aria-hidden="true"></i><?= e($court['address']) ?></p>
        <div class="mt-3 overflow-hidden rounded-md border border-background-200">
          <iframe title="Bản đồ vị trí <?= e($court['name']) ?>" src="https://www.google.com/maps?q=<?= urlencode($court['mapQuery']) ?>&output=embed" class="h-[300px] w-full border-0" loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe>
        </div>
      </div>

      <section class="mt-5 rounded-lg border border-background-200 bg-white p-5" id="reviews"></section>
    </div>

    <?php if ($court['status'] !== 'maintenance'): ?>
    <!-- Thanh đặt sân cố định ở đáy màn hình (chỉ điện thoại / tablet) -->
    <div id="mobile-book-bar" class="fixed inset-x-0 bottom-0 z-40 flex items-center justify-between gap-3 border-t border-background-200 bg-white/95 px-4 py-3 backdrop-blur lg:hidden">
      <div class="min-w-0"><p class="text-[11px] text-foreground-500">Giá thuê từ</p><p class="font-heading text-lg font-extrabold leading-tight text-primary-600"><?= money($lowest) ?><span class="text-xs font-medium text-foreground-500">/giờ</span></p></div>
      <a href="<?= url('/dat-san/' . $court['slug']) ?>" class="inline-flex shrink-0 items-center gap-2 rounded-md bg-primary-500 px-5 py-3 text-sm font-bold text-white hover:bg-primary-600"><i class="ri-calendar-check-line" aria-hidden="true"></i>Đặt sân ngay</a>
    </div>
    <div class="h-16 lg:hidden"></div>
    <?php endif; ?>
    <aside class="min-w-0">
      <div class="lg:sticky lg:top-[88px]">
        <div class="rounded-lg border border-background-200 bg-white p-5">
          <div class="flex items-end justify-between gap-3">
            <div><p class="text-[11px] uppercase tracking-wide text-foreground-500">Giá thuê từ</p><p class="font-heading text-2xl font-extrabold text-primary-600"><?= money($lowest) ?><span class="text-sm font-medium text-foreground-500">/giờ</span></p></div>
            <div class="flex items-center gap-1.5"><i class="ri-star-fill text-accent-500 text-sm" aria-hidden="true"></i><span class="text-sm font-semibold text-foreground-950"><?= number_format($court['rating'], 1) ?></span><span class="text-xs text-foreground-500">(<?= $court['reviewCount'] ?> đánh giá)</span></div>
          </div>
          <p class="mt-2 text-xs text-foreground-500"><?= e($court['priceNote']) ?></p>
          <div class="mt-3 divide-y divide-background-200 rounded-md border border-background-200">
            <?php foreach ($bands as $b): $peak = !empty($b['peak']); ?>
              <div class="flex items-center justify-between gap-2 px-3 py-2">
                <div class="min-w-0">
                  <p class="flex flex-wrap items-center gap-1.5 text-xs font-semibold text-foreground-900"><i class="<?= $peak ? 'ri-moon-line text-accent-600' : 'ri-sun-line text-primary-600' ?>" aria-hidden="true"></i><?= e($b['label']) ?><?php if ($peak): ?><span class="rounded-full bg-accent-100 px-1.5 py-0.5 text-[10px] font-bold text-accent-900">Cao điểm</span><?php endif; ?></p>
                  <p class="mt-0.5 pl-5 text-[11px] text-foreground-500"><?= e($b['start'] . ' - ' . $b['end']) ?></p>
                </div>
                <p class="whitespace-nowrap text-sm font-bold <?= $peak ? 'text-accent-700' : 'text-foreground-950' ?>"><?= money($b['price']) ?><span class="text-[11px] font-medium text-foreground-500">/giờ</span></p>
              </div>
            <?php endforeach; ?>
          </div>
          <div class="mt-4 space-y-2.5 rounded-md bg-background-50 p-3.5 text-sm">
            <div class="flex items-start justify-between gap-3"><span class="flex items-center gap-2 text-foreground-600"><i class="ri-time-line text-foreground-400" aria-hidden="true"></i>Giờ hoạt động</span><span class="text-right font-semibold text-foreground-950"><?= e($court['openTime'] . ' - ' . $court['closeTime']) ?><span class="block text-[11px] font-medium text-foreground-500">Mở cửa hằng ngày</span></span></div>
            <div class="flex items-center justify-between gap-3"><span class="flex items-center gap-2 text-foreground-600"><i class="ri-layout-grid-line text-foreground-400" aria-hidden="true"></i>Loại sân</span><span class="text-right font-semibold text-foreground-950"><?= e(implode(', ', $court['fieldTypes'])) ?></span></div>
            <div class="flex items-center justify-between gap-3"><span class="flex items-center gap-2 text-foreground-600"><i class="ri-map-pin-line text-foreground-400" aria-hidden="true"></i>Khu vực</span><span class="font-semibold text-foreground-950">P. <?= e($court['area']) ?></span></div>
          </div>
          <?php if ($court['status'] === 'maintenance'): ?>
            <div class="mt-4 rounded-md border border-accent-200 bg-accent-50 px-4 py-3 text-center text-sm font-semibold text-accent-900">Sân đang bảo trì, tạm thời không nhận đặt</div>
          <?php else: ?>
            <a href="<?= url('/dat-san/' . $court['slug']) ?>" class="mt-4 flex w-full items-center justify-center gap-2 whitespace-nowrap rounded-md bg-primary-500 px-4 py-3 text-sm font-bold text-white transition-colors hover:bg-primary-600"><i class="ri-calendar-check-line text-base" aria-hidden="true"></i>Đặt sân ngay</a>
          <?php endif; ?>
          <a href="<?= url('/lien-he') ?>" class="mt-2 flex w-full items-center justify-center gap-2 whitespace-nowrap rounded-md border border-background-300 px-4 py-2.5 text-sm font-semibold text-foreground-800 transition-colors hover:border-primary-400 hover:text-primary-700"><i class="ri-phone-line" aria-hidden="true"></i>Liên hệ chủ sân</a>
          <ul class="mt-4 space-y-2 border-t border-background-200 pt-4 text-xs text-foreground-600">
            <li class="flex items-center gap-2"><i class="ri-check-line text-primary-600" aria-hidden="true"></i>Xác nhận đặt sân trong 15 phút</li>
            <li class="flex items-center gap-2"><i class="ri-check-line text-primary-600" aria-hidden="true"></i>Hoàn cọc 100% khi hủy trước 4 giờ</li>
            <li class="flex items-center gap-2"><i class="ri-check-line text-primary-600" aria-hidden="true"></i>Thanh toán tại sân hoặc chuyển khoản</li>
          </ul>
        </div>
      </div>
    </aside>
  </div>
</div>

<div class="w-full px-4 md:px-8 pb-14">
  <div class="mx-auto w-full max-w-[1280px]">
    <div class="flex items-end justify-between gap-3">
      <h2 class="font-heading text-xl font-bold text-foreground-950"><?= e($court['sportLabel']) ?> lân cận</h2>
      <a href="<?= url('/tim-san?sport=' . $court['sport']) ?>" class="whitespace-nowrap text-sm font-semibold text-primary-600 hover:text-primary-700">Xem tất cả</a>
    </div>
    <div class="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3" id="related"></div>
  </div>
</div>
<?php
});