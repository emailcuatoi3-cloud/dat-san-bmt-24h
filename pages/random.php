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
    page_hero([['Trang chủ', '/'], ['Ngẫu nhiên & Ghép đội']], 'Ngẫu nhiên & Ghép đội giao lưu',
        'Các công cụ tiện ích cho cộng đồng thể thao Buôn Ma Thuột: chia đội nội bộ, bắt cặp giao lưu ngẫu nhiên giữa các đội và chọn sân thay bạn khi chưa quyết định được.',
        function () { ?>
<div class="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
  <?php foreach ([['ri-group-line', 'Chia đội nội bộ', 'Xáo trộn ngẫu nhiên, chia đều 2 đội bóng hoặc ghép đôi cầu lông.'], ['ri-sword-line', 'Bắt cặp giao lưu', 'Nhập tên đội & số người, hệ thống tự động ghép đối thủ phù hợp.'], ['ri-dice-line', 'Chọn sân thay bạn', 'Lọc theo môn, khu vực, khung giờ rồi để hệ thống chọn giúp.']] as $h): ?>
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

    <!-- GHÉP ĐỘI & BẮT CẶP ĐỐI THỦ NGẪU NHIÊN (THỬ NGHIỆM) -->
    <section id="ghep-doi" class="rounded-lg border border-primary-200 bg-background-100 p-5 md:p-6 shadow-sm">
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div>
          <span class="inline-flex items-center gap-1.5 rounded-full bg-primary-50 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-primary-700"><i class="ri-sword-line" aria-hidden="true"></i>Ghép đội &amp; Bắt cặp đối thủ (Thử nghiệm)</span>
          <h2 class="mt-2.5 font-heading text-lg font-bold text-foreground-950">Bắt cặp giao lưu ngẫu nhiên giữa các đội</h2>
          <p class="mt-1.5 max-w-xl text-sm leading-relaxed text-foreground-600">Đội bạn đang thiếu đối thủ cọ xát? Nhập tên đội và số lượng thành viên, hệ thống sẽ tự động ghép cặp ngẫu nhiên với một đội đối thủ phù hợp tại Buôn Ma Thuột.</p>
        </div>
        <span class="inline-flex items-center gap-1 rounded-md bg-accent-50 px-2.5 py-1 text-xs font-semibold text-accent-800"><i class="ri-flask-line" aria-hidden="true"></i>Tính năng thử nghiệm</span>
      </div>

      <form id="match-form" class="mt-5 space-y-4" novalidate>
        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div class="min-w-0">
            <label for="match-team-name" class="block text-xs font-semibold uppercase tracking-wide text-foreground-600">Tên đội của bạn <span class="text-accent-600">*</span></label>
            <input type="text" id="match-team-name" name="teamName" placeholder="VD: FC Ea Tam, Ban Mê United..." maxlength="50" class="mt-1.5 w-full rounded-md border border-background-300 bg-background-50 px-3 py-2 text-sm text-foreground-950 placeholder:text-foreground-400 focus:border-primary-500 focus:bg-white focus:outline-none" value="FC Ea Tam">
          </div>

          <div class="min-w-0">
            <label for="match-player-count" class="block text-xs font-semibold uppercase tracking-wide text-foreground-600">Số người chơi <span class="text-accent-600">*</span></label>
            <div class="relative mt-1.5">
              <select id="match-player-count" name="playerCount" class="w-full cursor-pointer rounded-md border border-background-300 bg-background-50 px-3 py-2 text-sm text-foreground-950 focus:border-primary-500 focus:bg-white focus:outline-none">
                <option value="5">5 người (Sân 5)</option>
                <option value="7" selected>7 người (Sân 7)</option>
                <option value="2">2 người (Đôi cầu lông)</option>
                <option value="4">4 người (Nhóm cầu lông)</option>
                <option value="6">6 người (Bóng chuyền / Cầu lông)</option>
                <option value="11">11 người (Sân lớn 11)</option>
              </select>
            </div>
          </div>

          <div class="min-w-0">
            <label for="match-sport" class="block text-xs font-semibold uppercase tracking-wide text-foreground-600">Môn thể thao</label>
            <select id="match-sport" name="sport" class="mt-1.5 w-full cursor-pointer rounded-md border border-background-300 bg-background-50 px-3 py-2 text-sm text-foreground-950 focus:border-primary-500 focus:bg-white focus:outline-none">
              <option value="football">Bóng đá mini</option>
              <option value="badminton">Cầu lông</option>
            </select>
          </div>

          <div class="min-w-0">
            <label for="match-level" class="block text-xs font-semibold uppercase tracking-wide text-foreground-600">Trình độ / Phong cách</label>
            <select id="match-level" name="level" class="mt-1.5 w-full cursor-pointer rounded-md border border-background-300 bg-background-50 px-3 py-2 text-sm text-foreground-950 focus:border-primary-500 focus:bg-white focus:outline-none">
              <option value="fun">Phong trào vui vẻ, rèn thể lực</option>
              <option value="normal" selected>Trung bình khá, có chút kèo nước</option>
              <option value="hard">Bán chuyên, cọ xát nhiệt huyết</option>
            </select>
          </div>
        </div>

        <div class="flex flex-wrap items-center justify-between gap-3 pt-1">
          <div class="flex flex-wrap items-center gap-2">
            <button type="submit" id="match-btn" class="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-md bg-primary-500 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition-colors hover:bg-primary-600">
              <i class="ri-sword-line" aria-hidden="true"></i><span>Bắt cặp ngẫu nhiên ngay</span>
            </button>
            <button type="button" id="match-queue-btn" class="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-md border border-background-300 bg-background-200 px-4 py-2.5 text-xs font-semibold text-foreground-800 transition-colors hover:border-primary-400 hover:text-primary-800">
              <i class="ri-user-add-line" aria-hidden="true"></i>Đưa đội vào hàng chờ
            </button>
          </div>
          <p id="match-hint" class="text-xs text-foreground-500">Đang có <b id="match-pool-count" class="text-primary-700">8</b> đội đang tìm đối thủ tại BMT</p>
        </div>
      </form>

      <!-- Khung kết quả bắt cặp ngẫu nhiên -->
      <div id="match-result" class="mt-5 hidden"></div>

      <!-- Danh sách các đội đang chờ giao lưu (Lobby) -->
      <div class="mt-6 border-t border-background-200 pt-5">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <h3 class="text-xs font-bold uppercase tracking-wider text-foreground-600"><i class="ri-broadcast-line mr-1 text-primary-600"></i>Hàng chờ các đội đang tìm đối thủ giao lưu tại BMT</h3>
          <span class="text-[11px] text-foreground-500">Bấm "Ghép ngay" để bắt cặp trực tiếp</span>
        </div>
        <div id="match-lobby-list" class="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4"></div>
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
