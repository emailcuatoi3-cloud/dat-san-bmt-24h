<?php
/** TRANG CHỦ */
$courts = public_courts();
$football = array_values(array_slice(array_filter($courts, fn($c) => $c['sport'] === 'football' && $c['featured']), 0, 4));
$badminton = array_values(array_slice(array_filter($courts, fn($c) => $c['sport'] === 'badminton' && $c['featured']), 0, 4));
$countFootball = count(array_filter($courts, fn($c) => $c['sport'] === 'football'));
$countBadminton = count(array_filter($courts, fn($c) => $c['sport'] === 'badminton'));
$areas = court_areas();

// Câu hỏi thường gặp lấy từ mục Nội dung (quản trị) — kind = faq, đã xuất bản
$faqs = q_all("SELECT title, body FROM contents WHERE kind = 'faq' AND status = 'published' ORDER BY pinned DESC, sort_order");
$banner = q_one("SELECT title, summary, link_url FROM contents WHERE kind = 'banner' AND status = 'published' ORDER BY pinned DESC, sort_order LIMIT 1");

render_page([
    'title' => 'Đặt Sân BMT 24H - Đặt sân bóng đá & cầu lông Buôn Ma Thuột',
    'transparentHeader' => true,
    'script' => 'pages/home.js',
    'data' => ['featured' => ['football' => $football, 'badminton' => $badminton]],
], function () use ($areas, $faqs, $banner, $countFootball, $countBadminton) {
    $today = date('Y-m-d');
    ?>
<!-- ========== HERO ========== -->
<section class="relative flex min-h-[560px] lg:min-h-[640px] items-center overflow-hidden">
  <img src="<?= e(HERO_IMAGE) ?>" alt="Sân bóng đá cỏ nhân tạo được chiếu sáng về đêm tại Buôn Ma Thuột" title="Sân bóng đá Buôn Ma Thuột - Đặt Sân BMT 24H" class="absolute inset-0 h-full w-full object-cover object-center">
  <div class="photo-veil absolute inset-0"></div>
  <div class="relative z-10 w-full px-4 md:px-8 pt-28 pb-10 md:pt-32 md:pb-12">
    <div class="mx-auto w-full max-w-5xl text-center">
      <span class="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-4 py-1.5 text-xs font-semibold text-white backdrop-blur-sm"><span class="h-1.5 w-1.5 rounded-full bg-accent-400"></span>Nền tảng đặt sân thể thao tại Buôn Ma Thuột</span>
      <h1 class="mt-5 font-heading text-3xl font-extrabold leading-tight text-white sm:text-4xl lg:text-[52px] lg:leading-[1.1]">Đặt sân thể thao nhanh chóng tại Buôn Ma Thuột</h1>
      <p class="mx-auto mt-4 max-w-2xl text-sm leading-relaxed text-white/80 md:text-base">Tìm kiếm, lựa chọn và đặt sân bóng đá, sân cầu lông chỉ trong vài thao tác.</p>
      <?php if ($banner): ?>
        <a href="<?= e($banner['link_url'] ? url($banner['link_url']) : '#') ?>" class="mx-auto mt-4 inline-flex max-w-full items-center gap-2 rounded-full bg-accent-500 px-4 py-1.5 text-xs font-bold"><i class="ri-coupon-3-line" aria-hidden="true"></i><span class="truncate"><?= e($banner['title']) ?> — <?= e($banner['summary']) ?></span></a>
      <?php endif; ?>
      <div class="mx-auto mt-7 w-full rounded-lg border border-background-300 bg-background-100/95 p-3 text-left shadow-lg shadow-black/40 backdrop-blur-sm md:p-4">
        <form action="<?= url('/tim-san') ?>" method="get" id="hero-search">
          <div class="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-[1.1fr_1.1fr_1.2fr_1fr_auto] lg:items-end">
            <div class="rounded-md px-3 py-2 hover:bg-background-50">
              <label for="hero-sport" class="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-foreground-500">Loại sân</label>
              <div class="flex items-center gap-2"><i class="ri-football-line text-primary-600" aria-hidden="true"></i>
                <select id="hero-sport" name="sport" class="w-full cursor-pointer appearance-none bg-transparent text-sm font-medium text-foreground-950 focus:outline-none">
                  <?php foreach (SPORT_OPTIONS as $o): ?><option value="<?= $o['value'] === 'all' ? '' : $o['value'] ?>"><?= e($o['label']) ?></option><?php endforeach; ?>
                </select>
              </div>
            </div>
            <div class="rounded-md px-3 py-2 hover:bg-background-50">
              <label for="hero-area" class="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-foreground-500">Khu vực</label>
              <div class="flex items-center gap-2"><i class="ri-map-pin-line text-primary-600" aria-hidden="true"></i>
                <select id="hero-area" name="area" class="w-full cursor-pointer appearance-none bg-transparent text-sm font-medium text-foreground-950 focus:outline-none">
                  <option value="">Tất cả khu vực</option>
                  <?php foreach ($areas as $a): ?><option value="<?= e($a) ?>">P. <?= e($a) ?></option><?php endforeach; ?>
                </select>
              </div>
            </div>
            <div class="rounded-md px-3 py-2 hover:bg-background-50">
              <label for="hero-date" class="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-foreground-500">Ngày chơi</label>
              <div class="flex items-center gap-2"><i class="ri-calendar-line text-primary-600" aria-hidden="true"></i>
                <input id="hero-date" name="date" type="date" min="<?= $today ?>" value="<?= $today ?>" class="w-full cursor-pointer bg-transparent text-sm font-medium text-foreground-950 focus:outline-none">
              </div>
            </div>
            <div class="rounded-md px-3 py-2 hover:bg-background-50">
              <label for="hero-time" class="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-foreground-500">Khung giờ</label>
              <div class="flex items-center gap-2"><i class="ri-time-line text-primary-600" aria-hidden="true"></i>
                <select id="hero-time" name="time" class="w-full cursor-pointer appearance-none bg-transparent text-sm font-medium text-foreground-950 focus:outline-none">
                  <option value="">Mọi khung giờ</option>
                  <?php foreach (DEFAULT_SLOTS as $s): ?><option value="<?= $s ?>"><?= $s ?> - <?= slot_end($s) ?></option><?php endforeach; ?>
                </select>
              </div>
            </div>
            <button type="submit" class="flex w-full items-center justify-center gap-2 whitespace-nowrap rounded-md bg-primary-500 px-6 py-3.5 text-sm font-bold text-white transition-colors hover:bg-primary-600 lg:w-auto"><i class="ri-search-line text-base" aria-hidden="true"></i>Tìm sân ngay</button>
          </div>
        </form>
      </div>
      <div class="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <?php foreach (SITE_STATS as $s): ?>
          <div class="rounded-lg border px-3 py-3 backdrop-blur-sm photo-panel">
            <p class="font-heading text-xl font-extrabold text-white md:text-2xl"><?= e($s['value']) ?></p>
            <p class="mt-1 text-[11px] leading-snug text-white/75 md:text-xs"><?= e($s['label']) ?></p>
          </div>
        <?php endforeach; ?>
      </div>
    </div>
  </div>
</section>

<!-- ========== DANH MỤC ========== -->
<section class="w-full px-4 md:px-8 pt-10 pb-12 md:pt-12 md:pb-16">
  <div class="mx-auto w-full max-w-[1280px]">
    <div class="text-center max-w-2xl mx-auto">
      <span class="inline-flex items-center gap-2 rounded-full bg-primary-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-primary-700"><span class="w-1.5 h-1.5 rounded-full bg-primary-500"></span>Danh mục</span>
      <h2 class="mt-3 text-2xl md:text-3xl font-bold text-foreground-950">Chọn môn thể thao của bạn</h2>
      <p class="mt-3 text-sm md:text-base text-foreground-600">Hai loại hình phổ biến nhất tại Buôn Ma Thuột, tất cả đều có sẵn khung giờ để bạn lựa chọn.</p>
    </div>
    <div class="mt-7 grid grid-cols-1 gap-5 md:grid-cols-2">
      <?php foreach ([
          ['Sân bóng đá', 'Sân 5, 7 và 11 người với cỏ nhân tạo mới, đèn chiếu sáng đạt chuẩn.', $countFootball . ' sân', CATEGORY_IMAGE_FOOTBALL, '/tim-san?sport=football', 'ri-football-line'],
          ['Sân cầu lông', 'Sân trong nhà, thảm chống trượt, trần cao và ánh sáng chống chói.', $countBadminton . ' sân', CATEGORY_IMAGE_BADMINTON, '/tim-san?sport=badminton', 'ri-ping-pong-line'],
      ] as $cat): ?>
        <a href="<?= url($cat[4]) ?>" class="group relative block h-[260px] md:h-[300px] overflow-hidden rounded-lg bg-background-50">
          <img src="<?= e($cat[3]) ?>" alt="<?= e($cat[0]) ?> tại Buôn Ma Thuột" title="<?= e($cat[0]) ?> Buôn Ma Thuột" class="absolute inset-0 h-full w-full object-cover object-top transition-transform duration-500 group-hover:scale-105">
          <div class="card-fade absolute inset-0"></div>
          <div class="absolute inset-x-0 bottom-0 p-5 md:p-6">
            <div class="flex items-center gap-3">
              <span class="w-10 h-10 flex items-center justify-center rounded-md bg-primary-500 text-white"><i class="<?= $cat[5] ?> text-lg" aria-hidden="true"></i></span>
              <div><h3 class="font-heading text-lg md:text-xl font-bold text-white"><?= e($cat[0]) ?></h3><p class="text-xs font-medium text-white/85"><?= e($cat[2]) ?> đang hoạt động</p></div>
            </div>
            <p class="mt-3 max-w-md text-sm leading-relaxed text-white/90"><?= e($cat[1]) ?></p>
            <span class="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-white">Khám phá ngay<i class="ri-arrow-right-line transition-transform group-hover:translate-x-1" aria-hidden="true"></i></span>
          </div>
        </a>
      <?php endforeach; ?>
    </div>
  </div>
</section>

<!-- ========== SÂN NỔI BẬT (thẻ sân do JS vẽ) ========== -->
<?php foreach ([
    ['football', 'Sân bóng đá nổi bật', 'Sân bóng đá được đặt nhiều nhất', 'Cụm sân cỏ nhân tạo tại trung tâm Buôn Ma Thuột, đèn chiếu sáng tốt và còn khung giờ tối nay.', '/tim-san?sport=football', 'bg-background-100/35'],
    ['badminton', 'Sân cầu lông nổi bật', 'Sân cầu lông chất lượng cao', 'Sân trong nhà, thảm chống trượt, phù hợp cho cả người mới chơi và các câu lạc bộ phong trào.', '/tim-san?sport=badminton', 'bg-background-100/70'],
] as $f): ?>
<section class="w-full px-4 md:px-8 py-10 md:py-14 <?= $f[5] ?>">
  <div class="mx-auto w-full max-w-[1280px]">
    <?php section_heading($f[2], $f[1], $f[3], 'left', '<a href="' . url($f[4]) . '" class="inline-flex items-center gap-2 whitespace-nowrap rounded-md border border-background-300 bg-white px-4 py-2.5 text-sm font-semibold text-foreground-800 transition-colors hover:border-primary-400 hover:text-primary-700">Xem tất cả<i class="ri-arrow-right-line" aria-hidden="true"></i></a>'); ?>
    <div data-featured="<?= $f[0] ?>" class="-mx-4 mt-7 flex snap-x snap-mandatory scroll-px-4 gap-4 overflow-x-auto px-4 pb-2 [&>*]:w-[84%] [&>*]:shrink-0 [&>*]:snap-start sm:mx-0 sm:grid sm:grid-cols-2 sm:gap-5 sm:overflow-visible sm:px-0 sm:pb-0 sm:[&>*]:w-auto lg:grid-cols-4"></div>
  </div>
</section>
<?php endforeach; ?>

<!-- ========== LỢI ÍCH ========== -->
<section class="w-full border-y border-background-200 bg-background-100/60 px-4 md:px-8 py-10 md:py-14">
  <div class="mx-auto w-full max-w-[1280px]">
    <div class="grid grid-cols-1 gap-8 lg:grid-cols-[0.9fr_1.4fr] lg:items-start">
      <div>
        <span class="inline-flex items-center gap-2 rounded-full bg-accent-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-accent-800"><span class="w-1.5 h-1.5 rounded-full bg-accent-500"></span>Vì sao chọn chúng tôi</span>
        <h2 class="mt-3 text-2xl md:text-3xl font-bold leading-tight text-foreground-950">Đặt sân dễ hơn, chơi thể thao nhiều hơn</h2>
        <p class="mt-4 text-sm md:text-base leading-relaxed text-foreground-700">Chúng tôi làm việc trực tiếp với các chủ sân tại Buôn Ma Thuột để đảm bảo thông tin chính xác, giá niêm yết và khung giờ luôn được cập nhật mỗi ngày.</p>
        <div class="mt-6 flex flex-wrap items-center gap-3">
          <div class="flex items-center gap-2 rounded-md bg-primary-50 px-3 py-2"><i class="ri-shield-check-line text-primary-600" aria-hidden="true"></i><span class="text-xs font-semibold text-primary-800">Sân đã được xác thực</span></div>
          <div class="flex items-center gap-2 rounded-md bg-secondary-50 px-3 py-2"><i class="ri-customer-service-2-line text-secondary-700" aria-hidden="true"></i><span class="text-xs font-semibold text-secondary-900">Hỗ trợ 24/7</span></div>
        </div>
      </div>
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <?php foreach (SITE_BENEFITS as $b): ?>
          <div class="rounded-lg border border-background-200 bg-background-50 p-5 transition-colors hover:border-primary-300">
            <span class="w-11 h-11 flex items-center justify-center rounded-md bg-primary-500 text-white"><i class="<?= $b['icon'] ?> text-xl" aria-hidden="true"></i></span>
            <h3 class="mt-4 font-heading text-base font-bold text-foreground-950"><?= e($b['title']) ?></h3>
            <p class="mt-2 text-sm leading-relaxed text-foreground-700"><?= e($b['description']) ?></p>
          </div>
        <?php endforeach; ?>
      </div>
    </div>
  </div>
</section>

<!-- ========== QUY TRÌNH ========== -->
<section class="w-full border-y border-background-200 bg-primary-50 px-4 md:px-8 py-10 md:py-14">
  <div class="mx-auto w-full max-w-[1280px]">
    <div class="max-w-2xl">
      <span class="inline-flex items-center gap-2 rounded-full bg-primary-500/15 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-primary-700"><span class="w-1.5 h-1.5 rounded-full bg-primary-500"></span>Quy trình đặt sân</span>
      <h2 class="mt-3 text-2xl md:text-3xl font-bold text-foreground-950">Chỉ 3 bước để có sân chơi</h2>
      <p class="mt-3 text-sm md:text-base leading-relaxed text-foreground-600">Không cần gọi điện hỏi từng sân. Mọi thông tin về giá, khung giờ và tiện ích đều có sẵn trên nền tảng.</p>
    </div>
    <div class="mt-8 grid grid-cols-1 gap-5 md:grid-cols-3">
      <?php foreach (SITE_STEPS as $s): ?>
        <div class="relative rounded-lg border border-primary-200/70 bg-background-100 p-6">
          <div class="flex items-center justify-between">
            <span class="font-heading text-3xl font-extrabold text-primary-600"><?= e($s['number']) ?></span>
            <span class="w-10 h-10 flex items-center justify-center rounded-md bg-primary-500/15 text-primary-700"><i class="<?= $s['icon'] ?> text-lg" aria-hidden="true"></i></span>
          </div>
          <h3 class="mt-5 font-heading text-base font-bold text-foreground-950"><?= e($s['title']) ?></h3>
          <p class="mt-2 text-sm leading-relaxed text-foreground-600"><?= e($s['description']) ?></p>
        </div>
      <?php endforeach; ?>
    </div>
    <div class="mt-7 flex flex-wrap items-center gap-4">
      <a href="<?= url('/tim-san') ?>" class="inline-flex items-center gap-2 whitespace-nowrap rounded-md bg-primary-500 px-5 py-3 text-sm font-bold text-white transition-colors hover:bg-primary-600">Bắt đầu tìm sân<i class="ri-arrow-right-line" aria-hidden="true"></i></a>
      <a href="<?= url('/lien-he') ?>" class="inline-flex items-center gap-2 whitespace-nowrap rounded-md border border-background-300 px-5 py-3 text-sm font-semibold text-foreground-800 transition-colors hover:bg-background-200"><i class="ri-phone-line" aria-hidden="true"></i>Cần hỗ trợ? Gọi <?= HOTLINE ?></a>
    </div>
  </div>
</section>

<!-- ========== ĐÁNH GIÁ ========== -->
<section class="w-full px-4 md:px-8 py-10 md:py-14">
  <div class="mx-auto w-full max-w-[1280px]">
    <div class="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div class="max-w-2xl">
        <span class="inline-flex items-center gap-2 rounded-full bg-primary-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-primary-700"><span class="w-1.5 h-1.5 rounded-full bg-primary-500"></span>Người chơi nói gì</span>
        <h2 class="mt-3 text-2xl md:text-3xl font-bold text-foreground-950">Hơn 1.200 lượt đặt sân mỗi tháng</h2>
        <p class="mt-3 text-sm md:text-base leading-relaxed text-foreground-600">Đánh giá thực tế từ các đội bóng và nhóm cầu lông đang sử dụng nền tảng tại Buôn Ma Thuột.</p>
      </div>
      <div class="flex items-center gap-3 rounded-lg border border-background-200 bg-white px-4 py-3">
        <span class="font-heading text-2xl font-extrabold text-foreground-950">4.8</span>
        <div><div class="flex items-center gap-0.5 text-accent-500"><?= str_repeat('<i class="ri-star-fill text-sm" aria-hidden="true"></i>', 5) ?></div><p class="text-xs text-foreground-500">Dựa trên 685 đánh giá</p></div>
      </div>
    </div>
    <div class="mt-8 grid grid-cols-1 gap-5 md:grid-cols-3">
      <?php foreach (SITE_REVIEWS as $r): ?>
        <figure class="flex h-full flex-col rounded-lg border border-background-200 bg-white p-5 md:p-6">
          <div class="flex items-center gap-0.5 text-accent-500"><?= str_repeat('<i class="ri-star-fill text-sm" aria-hidden="true"></i>', (int) $r['rating']) ?></div>
          <blockquote class="mt-4 flex-1 text-sm leading-relaxed text-foreground-700">“<?= e($r['content']) ?>”</blockquote>
          <figcaption class="mt-5 flex items-center gap-3 border-t border-background-200 pt-4">
            <span class="w-10 h-10 flex items-center justify-center rounded-full bg-primary-100 font-heading text-sm font-bold text-primary-800"><?= e($r['initials']) ?></span>
            <div><p class="text-sm font-semibold text-foreground-950"><?= e($r['name']) ?></p><p class="text-xs text-foreground-500"><?= e($r['role']) ?></p></div>
          </figcaption>
        </figure>
      <?php endforeach; ?>
    </div>
  </div>
</section>

<!-- ========== DÀNH CHO CHỦ SÂN ========== -->
<section class="w-full bg-background-100 px-4 py-12 md:px-8 md:py-16">
  <div class="mx-auto grid w-full max-w-[1280px] grid-cols-1 items-center gap-8 lg:grid-cols-2 lg:gap-14">
    <div class="relative order-2 w-full lg:order-1">
      <div class="h-[300px] w-full overflow-hidden rounded-lg md:h-[420px]">
        <img src="https://readdy.ai/api/search-image?query=Confident%20Vietnamese%20sports%20facility%20owner%20standing%20on%20an%20empty%20green%20artificial%20turf%20football%20pitch%20at%20golden%20hour%2C%20holding%20a%20tablet%2C%20manager%20badge%2C%20warm%20sunlight%2C%20blurred%20floodlights%20in%20background%2C%20professional%20editorial%20photography%2C%20clean%20composition%2C%20no%20text&width=1000&height=800&seq=home-owner-partner-01&orientation=landscape&nocache=true" alt="Chủ sân thể thao quản lý lịch đặt sân trên Buôn Ma Thuột" title="Trở thành đối tác chủ sân Đặt Sân BMT 24H" loading="lazy" class="h-full w-full object-cover object-top">
      </div>
      <div class="absolute -bottom-5 left-4 hidden items-center gap-3 rounded-lg border border-background-200 bg-white px-4 py-3 sm:flex md:left-6">
        <span class="flex h-10 w-10 items-center justify-center rounded-md bg-primary-500/15 text-primary-700"><i class="ri-store-3-line text-lg" aria-hidden="true"></i></span>
        <span class="leading-tight"><span class="block font-heading text-lg font-extrabold text-foreground-950">30+</span><span class="block text-xs text-foreground-600">sân đang hợp tác</span></span>
      </div>
    </div>
    <div class="order-1 w-full lg:order-2">
      <span class="inline-flex items-center gap-2 rounded-full bg-primary-500/15 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-primary-800"><i class="ri-add-circle-line" aria-hidden="true"></i>Dành cho chủ sân</span>
      <h2 class="mt-3 font-heading text-2xl font-extrabold leading-tight text-foreground-950 md:text-3xl">Có sân trống? Đưa sân lên Đặt Sân BMT 24H</h2>
      <p class="mt-3 text-sm leading-relaxed text-foreground-700 md:text-base">Mở tài khoản đối tác miễn phí, đăng thông tin sân và bắt đầu nhận đơn đặt sân ngay trong tuần. Bạn toàn quyền quyết định giá, khung giờ và chính sách cọc của sân mình.</p>
      <ul class="mt-6 space-y-4">
        <?php foreach ([['ri-calendar-2-line', 'Lịch sân tự động', 'Đơn đặt sân đổ về một màn hình, không cần ghi sổ tay.'], ['ri-line-chart-line', 'Doanh thu rõ ràng', 'Theo dõi doanh thu theo ngày, tuần, tháng và từng khung giờ.'], ['ri-shield-check-line', 'Đối soát chuyển khoản', 'Xác nhận cọc minh bạch, hạn chế khách bom sân.']] as $p): ?>
          <li class="flex items-start gap-3">
            <span class="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-background-200 bg-white text-primary-600"><i class="<?= $p[0] ?> text-base" aria-hidden="true"></i></span>
            <span class="min-w-0"><span class="block text-sm font-semibold text-foreground-950"><?= $p[1] ?></span><span class="mt-0.5 block text-xs leading-relaxed text-foreground-600 md:text-sm"><?= $p[2] ?></span></span>
          </li>
        <?php endforeach; ?>
      </ul>
      <div class="mt-7 flex flex-col gap-3 sm:flex-row">
        <a href="<?= url('/dang-ky-chu-san') ?>" class="inline-flex cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-md bg-primary-500 px-5 py-3 text-sm font-bold text-white transition-colors hover:bg-primary-600"><i class="ri-store-2-line text-base" aria-hidden="true"></i>Trở thành đối tác chủ sân</a>
        <a href="<?= url('/dang-nhap') ?>" class="inline-flex cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-md border border-background-300 bg-white px-5 py-3 text-sm font-semibold text-foreground-800 transition-colors hover:border-primary-300 hover:text-primary-700">Đã có tài khoản chủ sân</a>
      </div>
    </div>
  </div>
</section>

<!-- ========== CÂU HỎI THƯỜNG GẶP ========== -->
<section class="w-full px-4 md:px-8 py-10 md:py-14">
  <div class="mx-auto grid w-full max-w-[1280px] grid-cols-1 gap-6 lg:grid-cols-[1fr_340px]">
    <div class="min-w-0">
      <span class="inline-flex items-center gap-2 rounded-full bg-primary-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-primary-700"><span class="h-1.5 w-1.5 rounded-full bg-primary-500"></span>Câu hỏi thường gặp</span>
      <h2 class="mt-3 font-heading text-2xl font-bold text-foreground-950 md:text-3xl">Những điều người chơi hay hỏi trước khi ra sân</h2>
      <p class="mt-3 text-sm leading-relaxed text-foreground-600 md:text-base">Nếu chưa thấy câu trả lời, bạn bấm vào khung chat ở góc phải màn hình để được trợ lý hướng dẫn ngay.</p>
      <div class="mt-5 flex flex-col gap-2.5" id="faq-list">
        <?php foreach ($faqs as $i => $f): ?>
          <article class="overflow-hidden rounded-lg border border-background-200 bg-background-100" data-faq <?= $i === 0 ? 'data-open' : '' ?>>
            <h3>
              <button type="button" aria-expanded="<?= $i === 0 ? 'true' : 'false' ?>" class="flex w-full cursor-pointer items-center justify-between gap-3 px-4 py-3.5 text-left transition-colors hover:bg-background-50 md:px-5">
                <span class="text-sm font-semibold text-foreground-950 md:text-[15px]"><?= e($f['title']) ?></span>
                <span data-faq-icon class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full transition-colors"><i aria-hidden="true"></i></span>
              </button>
            </h3>
            <div data-faq-body class="border-t border-background-200 px-4 py-3.5 md:px-5 <?= $i === 0 ? '' : 'hidden' ?>"><p class="text-sm leading-relaxed text-foreground-600"><?= e($f['body']) ?></p></div>
          </article>
        <?php endforeach; ?>
      </div>
    </div>
    <aside class="flex flex-col gap-4">
      <div class="rounded-lg border border-primary-200 bg-primary-50 p-5">
        <span class="flex h-10 w-10 items-center justify-center rounded-full bg-primary-500 text-white"><i class="ri-chat-smile-2-line text-lg" aria-hidden="true"></i></span>
        <h3 class="mt-3 font-heading text-base font-bold text-primary-900">Hỏi trợ lý ngay tại đây</h3>
        <p class="mt-1.5 text-sm leading-relaxed text-primary-800">Trợ lý trả lời giá sân, khung giờ trống tối nay và chính sách hủy trong vài giây, hoạt động 24/7.</p>
        <p class="mt-3 flex items-center gap-1.5 text-xs font-semibold text-primary-800"><i class="ri-cursor-line" aria-hidden="true"></i>Bấm vào nút chat ở góc phải dưới màn hình</p>
      </div>
      <div class="rounded-lg border border-background-200 bg-background-100 p-5">
        <h3 class="font-heading text-base font-bold text-foreground-950">Cần gặp người thật?</h3>
        <p class="mt-1.5 text-sm leading-relaxed text-foreground-600">Đội hỗ trợ trực 24/7, kể cả ngày lễ và các khung giờ tối muộn.</p>
        <a href="tel:<?= preg_replace('/\D/', '', HOTLINE) ?>" class="mt-3 flex items-center gap-2 text-sm font-bold text-primary-600 transition-colors hover:text-primary-700"><i class="ri-phone-line" aria-hidden="true"></i><?= HOTLINE ?></a>
        <a href="<?= url('/lien-he') ?>" class="mt-3 inline-flex items-center gap-1.5 whitespace-nowrap rounded-md border border-background-300 bg-background-200 px-3.5 py-2 text-xs font-semibold text-foreground-950 transition-colors hover:border-primary-400 hover:text-primary-800"><i class="ri-mail-send-line" aria-hidden="true"></i>Gửi yêu cầu hỗ trợ</a>
      </div>
    </aside>
  </div>
</section>

<!-- ========== KÊU GỌI HÀNH ĐỘNG ========== -->
<section class="w-full px-4 md:px-8 pb-10 md:pb-14">
  <div class="mx-auto w-full max-w-[1280px]">
    <div class="relative overflow-hidden rounded-lg border border-primary-300/60 bg-primary-100 px-6 py-10 md:px-12 md:py-14">
      <div class="absolute -right-16 -top-16 h-56 w-56 rounded-full bg-primary-500/20"></div>
      <div class="absolute -bottom-20 right-24 h-48 w-48 rounded-full bg-accent-500/15"></div>
      <div class="relative flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
        <div class="max-w-2xl">
          <span class="inline-flex items-center gap-2 rounded-full border border-primary-300/60 bg-primary-500/15 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-primary-800"><i class="ri-calendar-check-line" aria-hidden="true"></i>Đặt sân hôm nay</span>
          <h2 class="mt-3 font-heading text-2xl font-extrabold leading-tight text-foreground-950 md:text-3xl">Đội của bạn đã sẵn sàng ra sân?</h2>
          <p class="mt-3 text-sm leading-relaxed text-foreground-800 md:text-base">Giữ sân trước 2 phút, chọn khung giờ đẹp nhất trong tuần và nhận xác nhận từ chủ sân ngay sau đó.</p>
        </div>
        <div class="flex flex-col gap-3 sm:flex-row">
          <a href="<?= url('/tim-san') ?>" class="whitespace-nowrap rounded-md bg-foreground-950 px-5 py-3 text-center text-sm font-semibold text-background-50 transition-colors hover:bg-foreground-900">Tìm sân trống</a>
          <a href="<?= url('/dat-san') ?>" class="whitespace-nowrap rounded-md bg-primary-500 px-5 py-3 text-center text-sm font-bold text-white transition-colors hover:bg-primary-600">Đặt sân nhanh</a>
        </div>
      </div>
    </div>
  </div>
</section>
<?php
});