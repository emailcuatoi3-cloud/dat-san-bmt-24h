<?php
/** ƯU ĐÃI & MÃ GIẢM GIÁ — /uu-dai */
$today = date('Y-m-d');
$promos = array_map('map_promotion', q_all("SELECT * FROM promotions WHERE status = 'active' AND end_date >= CURDATE() ORDER BY updated_at DESC"));
$active = count(array_filter($promos, fn($p) => $p['startDate'] <= $today));
$upcoming = count($promos) - $active;
$best = array_reduce($promos, fn($m, $p) => $p['discountType'] === 'percent' ? max($m, $p['discountValue']) : $m, 0);
$wheelState = ['cooldownHours' => 48, 'nextSpinAt' => 0, 'lastPrize' => null];
if ($u = current_user()) {
    ensure_sitemap_schema();
    $lastSpin = q_one('SELECT * FROM wheel_spins WHERE user_id = ? ORDER BY spun_at DESC LIMIT 1', [$u['id']]);
    if ($lastSpin) {
        $nextTs = strtotime($lastSpin['spun_at']) + 48 * 3600;
        if ($nextTs > time()) {
            $wheelState['nextSpinAt'] = $nextTs * 1000;
            $wheelState['lastPrize'] = [
                'code' => $lastSpin['prize_code'],
                'title' => $lastSpin['prize_title'],
                'desc' => $lastSpin['prize_desc'],
            ];
        }
    }
}

render_page(['title' => 'Ưu đãi & mã giảm giá - ' . SITE_NAME, 'script' => 'pages/promotions.js', 'data' => ['promotions' => $promos, 'wheel' => $wheelState]],
function () use ($active, $upcoming, $best) {
    page_hero([['Trang chủ', '/'], ['Ưu đãi & mã giảm giá']], 'Ưu đãi & mã giảm giá',
        'Tổng hợp mã giảm giá đang chạy từ các chủ sân trên Đặt Sân BMT 24H. Chọn mã phù hợp, sao chép và dán khi đặt sân để trả ít hơn cho buổi chơi.',
        function () { ?>
<div class="flex flex-wrap items-center gap-3">
  <a href="#vong-quay" class="inline-flex cursor-pointer items-center gap-2 whitespace-nowrap rounded-md bg-accent-500 px-5 py-3 text-sm font-bold text-background-950 transition-colors hover:bg-accent-600"><i class="ri-gift-line text-base" aria-hidden="true"></i>Vòng quay ưu đãi</a>
  <a href="<?= url('/dat-san') ?>" class="inline-flex cursor-pointer items-center gap-2 whitespace-nowrap rounded-md bg-primary-500 px-5 py-3 text-sm font-bold text-white transition-colors hover:bg-primary-600"><i class="ri-calendar-check-line text-base" aria-hidden="true"></i>Đặt sân và dùng mã</a>
  <a href="<?= url('/tai-khoan?tab=vouchers') ?>" class="inline-flex cursor-pointer items-center gap-2 whitespace-nowrap rounded-md border border-background-300 bg-white px-5 py-3 text-sm font-semibold text-foreground-800 transition-colors hover:border-primary-400 hover:text-primary-700"><i class="ri-wallet-3-line text-base" aria-hidden="true"></i>Mở ví voucher</a>
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

    <!-- VÒNG QUAY ƯU ĐÃI (THEO SITEMAP CLIENT) -->
    <style>
      .promo-wheel-stage { position: relative; width: min(312px, 84vw); height: min(312px, 84vw); flex-shrink: 0; }
      .promo-wheel-rim { position: absolute; inset: 0; border-radius: 9999px; padding: 12px; background: radial-gradient(circle at 30% 25%, #233c32, #0d1d17 75%); box-shadow: 0 18px 40px -12px rgba(0, 0, 0, 0.55), 0 0 0 2px rgba(245, 158, 11, 0.35), inset 0 2px 6px rgba(255, 255, 255, 0.14); }
      .promo-wheel-rotor { width: 100%; height: 100%; border-radius: 9999px; overflow: hidden; box-shadow: inset 0 0 0 2px rgba(255, 255, 255, 0.18); will-change: transform; }
      .promo-wheel-rotor svg { display: block; width: 100%; height: 100%; }
      .promo-wheel-pointer { position: absolute; left: 50%; top: -10px; transform: translateX(-50%); z-index: 30; width: 34px; height: 42px; filter: drop-shadow(0 4px 6px rgba(0, 0, 0, 0.45)); pointer-events: none; transition: transform 0.15s ease; }
      .promo-wheel-stage.is-spinning .promo-wheel-pointer { animation: wheelPointerTick 0.22s ease-in-out infinite; }
      @keyframes wheelPointerTick { 0%, 100% { transform: translateX(-50%) rotate(0deg); } 50% { transform: translateX(-50%) rotate(-12deg); } }
      .promo-wheel-hub { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); z-index: 20; width: 76px; height: 76px; border-radius: 9999px; border: 4px solid #fef3c7; background: radial-gradient(circle at 35% 30%, #10b981, #047857 75%); color: #fff; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 1px; cursor: pointer; box-shadow: 0 8px 20px rgba(0, 0, 0, 0.45), 0 0 0 4px rgba(16, 185, 129, 0.28); transition: transform 0.2s ease, box-shadow 0.2s ease, opacity 0.2s ease; }
      .promo-wheel-hub:hover:not(:disabled) { transform: translate(-50%, -50%) scale(1.07); box-shadow: 0 10px 26px rgba(16, 185, 129, 0.45), 0 0 0 6px rgba(245, 158, 11, 0.32); }
      .promo-wheel-hub:active:not(:disabled) { transform: translate(-50%, -50%) scale(0.97); }
      .promo-wheel-hub:disabled { cursor: not-allowed; opacity: 0.85; }
      .promo-wheel-peg { position: absolute; width: 7px; height: 7px; border-radius: 9999px; background: #fde68a; box-shadow: 0 0 6px rgba(251, 191, 36, 0.85); pointer-events: none; z-index: 15; }
      .promo-wheel-stage.is-spinning .promo-wheel-peg:nth-child(odd) { animation: wheelPegBlink 0.35s alternate infinite; }
      .promo-wheel-stage.is-spinning .promo-wheel-peg:nth-child(even) { animation: wheelPegBlink 0.35s alternate-reverse infinite; }
      @keyframes wheelPegBlink { from { opacity: 0.4; transform: translate(-50%, -50%) scale(0.85); } to { opacity: 1; transform: translate(-50%, -50%) scale(1.2); } }
      .promo-prize-item { transition: border-color 0.25s ease, background-color 0.25s ease, transform 0.25s ease, box-shadow 0.25s ease; }
      .promo-prize-item.is-winner { border-color: #10b981 !important; box-shadow: 0 0 0 2px rgba(16, 185, 129, 0.28); transform: translateY(-1px); }
      .promo-wheel-hub.is-locked { background: radial-gradient(circle at 35% 30%, #374151, #1f2937 75%); border-color: rgba(255, 255, 255, 0.25); box-shadow: 0 6px 14px rgba(0, 0, 0, 0.4); }
      .promo-cd-card { width: 100%; max-width: 312px; border-radius: 10px; padding: 10px 12px; text-align: center; }
      .promo-cd-grid { display: flex; align-items: center; justify-content: center; gap: 6px; margin-top: 6px; }
      .promo-cd-unit { min-width: 60px; border-radius: 8px; padding: 6px 8px; background: rgba(16, 185, 129, 0.12); border: 1px solid rgba(16, 185, 129, 0.3); }
      .promo-cd-num { display: block; font-family: 'Plus Jakarta Sans', Inter, sans-serif; font-size: 20px; font-weight: 800; line-height: 1.1; font-variant-numeric: tabular-nums; }
      .promo-cd-lbl { display: block; font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em; opacity: 0.75; margin-top: 2px; }
      .promo-cd-sep { font-size: 18px; font-weight: 800; opacity: 0.55; padding-bottom: 12px; }
    </style>
    <section id="vong-quay" class="scroll-mt-24 mt-10 rounded-lg border border-accent-200 bg-white p-5 md:p-7">
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div class="flex flex-wrap items-center gap-2">
            <span class="inline-flex items-center gap-1.5 rounded-full bg-accent-50 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-accent-800"><i class="ri-gift-line" aria-hidden="true"></i>Vòng quay ưu đãi</span>
            <span id="promo-wheel-status" class="inline-flex items-center gap-1.5 rounded-full bg-primary-50 px-3 py-1 text-[11px] font-bold text-primary-700"><i class="ri-time-line" aria-hidden="true"></i>1 lượt quay / 48 giờ</span>
          </div>
          <h2 class="mt-2.5 font-heading text-xl font-extrabold text-foreground-950 md:text-2xl">Quay may mắn nhận voucher giảm giá vào ví</h2>
          <p class="mt-1.5 max-w-2xl text-sm leading-relaxed text-foreground-600">Mỗi <b>48 giờ</b> bạn nhận 1 lượt quay miễn phí để trúng mã giảm 10%, 15%, 20.000đ, 50.000đ hoặc tặng nước uống. Nếu đã đăng nhập, phần thưởng tự động lưu vào <b>Tài khoản → Ví voucher</b>.</p>
        </div>
        <a href="<?= url('/tai-khoan?tab=vouchers') ?>" class="inline-flex items-center gap-1.5 rounded-md border border-primary-300 bg-primary-50 px-3.5 py-2 text-xs font-bold text-primary-700 hover:bg-primary-100"><i class="ri-wallet-3-line"></i>Xem ví voucher</a>
      </div>
      <div class="mt-7 flex flex-col items-center gap-8 lg:flex-row lg:items-center lg:gap-10">
        <div class="flex flex-col items-center gap-4 shrink-0">
          <div id="promo-wheel-stage" class="promo-wheel-stage">
            <svg class="promo-wheel-pointer" viewBox="0 0 36 44" aria-hidden="true">
              <path d="M18 42 L4 15 A14 14 0 1 1 32 15 Z" fill="#f97316" stroke="#fff7ed" stroke-width="2.5" stroke-linejoin="round"/>
              <circle cx="18" cy="14" r="5" fill="#fff7ed"/>
            </svg>
            <div class="promo-wheel-rim">
              <div id="promo-wheel-pegs" aria-hidden="true"></div>
              <div id="promo-wheel" class="promo-wheel-rotor prize-wheel-spin"></div>
            </div>
            <button type="button" id="promo-spin-btn" class="promo-wheel-hub" aria-label="Quay vòng quay ưu đãi">
              <i class="ri-play-fill text-xl leading-none" aria-hidden="true"></i>
              <span class="text-[11px] font-extrabold uppercase tracking-wider leading-none">Quay</span>
            </button>
          </div>
          <button type="button" id="promo-spin-cta" class="inline-flex cursor-pointer items-center justify-center gap-2 rounded-full bg-primary-500 px-6 py-2.5 text-xs font-bold text-white shadow-sm transition-colors hover:bg-primary-600 disabled:cursor-not-allowed disabled:opacity-60">
            <i class="ri-sparkling-2-line text-sm" aria-hidden="true"></i>
            <span>Quay ngay miễn phí</span>
          </button>
          <div id="promo-wheel-countdown" class="hidden promo-cd-card border border-background-200 bg-background-50">
            <p class="text-[11px] font-bold uppercase tracking-wide text-foreground-500"><i class="ri-hourglass-2-line mr-1 text-accent-600" aria-hidden="true"></i>Lượt quay tiếp theo sau</p>
            <div class="promo-cd-grid">
              <div class="promo-cd-unit"><span id="cd-hours" class="promo-cd-num text-foreground-950">48</span><span class="promo-cd-lbl text-foreground-500">Giờ</span></div>
              <span class="promo-cd-sep text-foreground-400">:</span>
              <div class="promo-cd-unit"><span id="cd-mins" class="promo-cd-num text-foreground-950">00</span><span class="promo-cd-lbl text-foreground-500">Phút</span></div>
              <span class="promo-cd-sep text-foreground-400">:</span>
              <div class="promo-cd-unit"><span id="cd-secs" class="promo-cd-num text-foreground-950">00</span><span class="promo-cd-lbl text-foreground-500">Giây</span></div>
            </div>
          </div>
        </div>
        <div class="min-w-0 flex-1 w-full">
          <div id="promo-spin-result">
            <div class="flex items-center gap-3 rounded-lg border border-dashed border-background-300 bg-background-50 px-4 py-3.5">
              <span class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent-100 text-accent-700"><i class="ri-gift-2-line text-lg" aria-hidden="true"></i></span>
              <div class="min-w-0">
                <p class="text-sm font-bold text-foreground-950">Sẵn sàng thử vận may — 100% lượt quay có quà!</p>
                <p class="mt-0.5 text-xs text-foreground-500">Nhấn nút <b>QUAY</b> ở giữa vòng quay để nhận voucher áp dụng trực tiếp khi đặt sân.</p>
              </div>
            </div>
          </div>
          <ul class="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-2" id="promo-prize-list"></ul>
        </div>
      </div>
    </section>

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