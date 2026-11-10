<?php
/** NGẪU NHIÊN — chia đội, chọn sân giúp, vòng quay ưu đãi (JS thuần). */
$today = date('Y-m-d');
$taken = occupied_slots($today);
foreach (blocked_slots_map($today) as $key => $slots) {
    $cid = explode(':', $key)[0];
    $taken[$cid] = array_values(array_unique(array_merge($taken[$cid] ?? [], $slots)));
}
render_page(['title' => 'Ngẫu nhiên & chia đội - ' . SITE_NAME, 'script' => 'pages/random.js',
    'data' => ['courts' => array_values(array_filter(public_courts(), fn($c) => $c['status'] === 'active')), 'areas' => court_areas(), 'taken' => (object) $taken]],
function () {
    page_hero([['Trang chủ', '/'], ['Ngẫu nhiên']], 'Ngẫu nhiên & vui cùng đội bóng',
        'Ba công cụ giúp buổi chơi bớt tranh cãi: chia đội công bằng, chọn sân ngẫu nhiên khi cả nhóm chưa quyết được, và vòng quay ưu đãi sau khi đặt sân.',
        function () { ?>
<div class="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
  <?php foreach ([['ri-group-line', 'Chia đội công bằng', 'Xáo trộn ngẫu nhiên, chia đều 2 đội hoặc ghép đôi đánh cầu lông.'], ['ri-dice-line', 'Chọn sân thay bạn', 'Lọc theo môn, khu vực, khung giờ rồi để hệ thống chọn giúp.'], ['ri-gift-line', 'Quay ưu đãi', 'Giảm 5 - 20%, tặng nước hoặc cộng thêm 30 phút chơi.']] as $h): ?>
    <div class="flex items-start gap-2.5 rounded-md border border-background-200 bg-background-50 px-3.5 py-3"><span class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-50 text-primary-700"><i class="<?= $h[0] ?> text-base" aria-hidden="true"></i></span><div class="min-w-0"><p class="text-sm font-semibold text-foreground-950"><?= $h[1] ?></p><p class="mt-0.5 text-xs leading-relaxed text-foreground-500"><?= $h[2] ?></p></div></div>
  <?php endforeach; ?>
</div>
<?php });
    $sel = 'mt-1.5 w-full box-border cursor-pointer rounded-md border border-background-300 bg-background-50 px-3 py-2.5 text-sm text-foreground-950 focus:border-primary-400 focus:outline-none';
    ?>
<div class="w-full px-4 md:px-8 py-7 md:py-10">
  <div class="mx-auto flex w-full max-w-[1080px] flex-col gap-5">

    <!-- CHIA ĐỘI -->
    <section id="chia-doi" class="rounded-lg border border-background-200 bg-background-100 p-5 md:p-6">
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div>
          <span class="inline-flex items-center gap-1.5 rounded-full bg-secondary-50 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-secondary-900"><i class="ri-group-line" aria-hidden="true"></i>Chia đội ngẫu nhiên</span>
          <h2 class="mt-2.5 font-heading text-lg font-bold text-foreground-950">Chia đội bóng &amp; ghép cặp cầu lông</h2>
          <p class="mt-1.5 max-w-xl text-sm leading-relaxed text-foreground-600">Dán danh sách thành viên, chọn kiểu chia và bấm chia đội. Kết quả xáo trộn hoàn toàn ngẫu nhiên, không trùng người.</p>
        </div>
        <span id="player-count" class="rounded-md bg-background-50 px-2.5 py-1.5 text-[11px] font-semibold text-foreground-600"></span>
      </div>
      <div class="mt-4 inline-flex items-center gap-1 rounded-full bg-background-50 p-1" id="split-modes"></div>
      <label for="team-names" class="mt-4 block text-xs font-semibold uppercase tracking-wide text-foreground-500">Danh sách thành viên (mỗi dòng hoặc cách nhau bằng dấu phẩy)</label>
      <textarea id="team-names" rows="4" maxlength="500" class="mt-1.5 w-full box-border resize-y rounded-md border border-background-300 bg-background-50 px-3 py-2.5 text-sm text-foreground-950 placeholder:text-foreground-500 focus:border-primary-400 focus:outline-none" placeholder="Quân, Long, Hà, Minh...">Quân, Long, Hà, Minh, Trang, Đức, Vy, Khánh</textarea>
      <p id="split-error" class="mt-2 hidden items-center gap-1.5 text-xs font-medium text-accent-700"></p>
      <div class="mt-3 flex flex-wrap items-center gap-2">
        <button type="button" id="split-btn" class="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-md bg-primary-500 px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-primary-600"><i class="ri-shuffle-line" aria-hidden="true"></i><span>Chia đội</span></button>
        <button type="button" id="split-clear" class="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-md border border-background-300 bg-background-200 px-4 py-2.5 text-sm font-semibold text-foreground-950 transition-colors hover:border-primary-400 hover:text-primary-800"><i class="ri-delete-bin-6-line" aria-hidden="true"></i>Xoá kết quả</button>
        <span id="split-count" class="text-xs text-foreground-500"></span>
      </div>
      <div id="split-result"></div>
    </section>

    <!-- CHỌN SÂN GIÚP -->
    <section id="chon-san" class="rounded-lg border border-background-200 bg-background-100 p-5 md:p-6">
      <span class="inline-flex items-center gap-1.5 rounded-full bg-secondary-50 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-secondary-900"><i class="ri-magic-line" aria-hidden="true"></i>Chọn sân giúp tôi</span>
      <h2 class="mt-2.5 font-heading text-lg font-bold text-foreground-950">Không biết chọn sân nào?</h2>
      <p class="mt-1.5 max-w-xl text-sm leading-relaxed text-foreground-600">Chọn môn, khu vực và khung giờ bạn muốn chơi, sau đó để hệ thống chọn ngẫu nhiên một sân còn trống.</p>
      <div class="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div class="min-w-0"><label for="random-sport" class="block text-xs font-semibold uppercase tracking-wide text-foreground-500">Môn thể thao</label><select id="random-sport" class="<?= $sel ?>"><option value="all">Tất cả môn</option><option value="football">Bóng đá</option><option value="badminton">Cầu lông</option></select></div>
        <div class="min-w-0"><label for="random-area" class="block text-xs font-semibold uppercase tracking-wide text-foreground-500">Khu vực</label><select id="random-area" class="<?= $sel ?>"><option value="all">Toàn TP. Buôn Ma Thuột</option><?php foreach (court_areas() as $a): ?><option value="<?= e($a) ?>">P. <?= e($a) ?></option><?php endforeach; ?></select></div>
        <div class="min-w-0"><label for="random-time" class="block text-xs font-semibold uppercase tracking-wide text-foreground-500">Khung giờ (hôm nay)</label><select id="random-time" class="<?= $sel ?>"><?php foreach (['17:00', '18:00', '19:00', '20:00', '21:00'] as $t): ?><option <?= $t === '19:00' ? 'selected' : '' ?>><?= $t ?></option><?php endforeach; ?></select></div>
      </div>
      <div class="mt-3 flex flex-wrap items-center gap-2.5">
        <button type="button" id="pick-btn" class="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-md bg-primary-500 px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-primary-600 disabled:cursor-not-allowed disabled:opacity-70"><i class="ri-dice-line" aria-hidden="true"></i><span>Chọn giúp tôi</span></button>
        <span id="pick-count" class="text-xs text-foreground-500"></span>
      </div>
      <div id="pick-result"></div>
    </section>

    <!-- VÒNG QUAY -->
    <section id="vong-quay" class="rounded-lg border border-background-200 bg-background-100 p-5 md:p-6">
      <span class="inline-flex items-center gap-1.5 rounded-full bg-accent-50 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-accent-800"><i class="ri-gift-line" aria-hidden="true"></i>Vòng quay ưu đãi</span>
      <h2 class="mt-2.5 font-heading text-lg font-bold text-foreground-950">Quay may mắn sau khi đặt sân</h2>
      <p class="mt-1.5 max-w-xl text-sm leading-relaxed text-foreground-600">Mỗi lượt đặt sân thành công bạn có một lượt quay. Phần thưởng gồm giảm giá, nước uống và cộng thêm giờ chơi.</p>
      <div class="mt-5 flex flex-col items-center gap-5 md:flex-row md:items-start md:gap-8">
        <div class="relative h-[280px] w-[280px] shrink-0">
          <i class="ri-arrow-down-s-fill absolute left-1/2 top-[-14px] z-20 -ml-4 text-[32px] text-accent-500" aria-hidden="true"></i>
          <div id="wheel" class="prize-wheel prize-wheel-spin absolute inset-0 rounded-full border-[6px] border-background-200"></div>
          <button type="button" id="spin-btn" class="absolute left-1/2 top-1/2 z-10 flex h-[76px] w-[76px] -translate-x-1/2 -translate-y-1/2 cursor-pointer flex-col items-center justify-center rounded-full border-4 border-background-100 bg-foreground-950 text-background-50 transition-transform hover:scale-105 disabled:cursor-not-allowed disabled:opacity-80"><i class="ri-play-fill text-lg" aria-hidden="true"></i><span class="text-[10px] font-bold uppercase tracking-wide">Quay</span></button>
        </div>
        <div class="min-w-0 flex-1"><div id="spin-result"></div><ul class="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2" id="prize-list"></ul></div>
      </div>
    </section>

    <div class="flex flex-col items-start justify-between gap-3 rounded-lg border border-background-200 bg-background-100 p-5 sm:flex-row sm:items-center">
      <div><p class="font-heading text-base font-bold text-foreground-950">Đã chọn được sân ưng ý?</p><p class="mt-1 text-sm text-foreground-600">Giữ chỗ ngay trong 3 bước, không cần tạo tài khoản, khung giờ được tạm giữ 10 phút.</p></div>
      <div class="flex flex-wrap gap-2">
        <a href="<?= url('/dat-san') ?>" class="inline-flex items-center gap-1.5 whitespace-nowrap rounded-md bg-primary-500 px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-primary-600"><i class="ri-calendar-check-line" aria-hidden="true"></i>Đặt sân ngay</a>
        <a href="<?= url('/ban-do') ?>" class="inline-flex items-center gap-1.5 whitespace-nowrap rounded-md border border-background-300 bg-background-200 px-4 py-2.5 text-sm font-semibold text-foreground-950 transition-colors hover:border-primary-400 hover:text-primary-800"><i class="ri-map-2-line" aria-hidden="true"></i>Xem bản đồ sân</a>
      </div>
    </div>
  </div>
</div>
<?php
});
