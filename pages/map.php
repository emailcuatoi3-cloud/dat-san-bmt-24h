<?php
/** BẢN ĐỒ SÂN — /ban-do. Khung giờ trống tối nay lấy thật từ CSDL. */
$today = date('Y-m-d');
$taken = occupied_slots($today);
foreach (blocked_slots_map($today) as $key => $slots) {
    $cid = explode(':', $key)[0];
    $taken[$cid] = array_values(array_unique(array_merge($taken[$cid] ?? [], $slots)));
} 
render_page(['title' => 'Bản đồ sân - ' . SITE_NAME, 'script' => 'pages/map.js', 'data' => ['courts' => public_courts(), 'taken' => (object) $taken]], function () {
    page_hero([['Trang chủ', '/'], ['Bản đồ sân']], 'Bản đồ sân thể thao Buôn Ma Thuột',
        'Xem vị trí toàn bộ sân bóng đá và sân cầu lông trên bản đồ, chọn sân để xem đường đi và khung giờ còn trống tối nay.',
        function () { ?> 
<div class="flex flex-wrap items-center gap-2">
  <div class="inline-flex items-center gap-1 rounded-full bg-background-50 p-1" id="map-sports"></div>
  <div class="flex min-w-0 flex-1 basis-full items-center gap-2 rounded-full border border-background-300 bg-background-50 px-3.5 py-2 focus-within:border-primary-400 sm:basis-auto sm:max-w-[280px]">
    <i class="ri-search-line text-sm text-primary-600" aria-hidden="true"></i>
    <input type="search" id="map-search" placeholder="Tìm theo tên sân, đường..." aria-label="Tìm sân trên bản đồ" class="w-full min-w-0 bg-transparent text-sm text-foreground-950 placeholder:text-foreground-500 focus:outline-none">
  </div>
</div>
<?php });
    ?>
<div class="w-full px-4 md:px-8 py-6 md:py-8">
  <div class="mx-auto w-full max-w-[1280px]">
    <article class="overflow-hidden rounded-lg border border-background-200 bg-background-100" id="map-main"></article>
    <div class="mt-6 md:mt-7">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <div class="flex items-center gap-2"><h2 class="font-heading text-base font-bold text-foreground-950">Tất cả sân trên bản đồ</h2><span id="map-count" class="rounded-full bg-background-200 px-2 py-0.5 text-[11px] font-semibold text-foreground-700"></span></div>
        <div class="flex items-center gap-3"><span class="hidden items-center gap-1.5 text-[11px] text-foreground-500 sm:flex"><i class="ri-arrow-left-right-line" aria-hidden="true"></i>Cuộn ngang để xem thêm</span><a href="<?= url('/tim-san') ?>" class="whitespace-nowrap text-xs font-semibold text-primary-600 hover:text-primary-700">Bộ lọc nâng cao</a></div>
      </div>
      <div class="mt-3 flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2" id="map-list"></div>
    </div>
    <div class="mt-5 grid grid-cols-1 gap-2.5 sm:grid-cols-3">
      <?php foreach ([['ri-parking-box-line', 'Bãi giữ xe', 'Hầu hết sân miễn phí gửi xe cho khách đặt sân.'], ['ri-lightbulb-flash-line', 'Đèn chiếu sáng', 'Sân tối được chiếu sáng tới 23:00.'], ['ri-customer-service-2-line', 'Hỗ trợ 24/7', 'Gọi ' . HOTLINE . ' khi không tìm thấy sân.']] as $it): ?>
        <div class="rounded-md border border-background-200 bg-background-100 px-3.5 py-3"><p class="flex items-center gap-1.5 text-xs font-bold text-foreground-900"><i class="<?= $it[0] ?> text-primary-600" aria-hidden="true"></i><?= $it[1] ?></p><p class="mt-1 text-[11px] leading-relaxed text-foreground-600"><?= $it[2] ?></p></div>
      <?php endforeach; ?>
    </div>
  </div> 
</div>
<?php
});