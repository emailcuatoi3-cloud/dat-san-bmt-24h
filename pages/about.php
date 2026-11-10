<?php
/** GIỚI THIỆU — trang tĩnh, PHP thuần. */
render_page(['title' => 'Giới thiệu - ' . SITE_NAME], function () {
    page_hero([['Trang chủ', '/'], ['Giới thiệu']], 'Giới thiệu Đặt Sân BMT 24H', 'Nền tảng đặt sân thể thao được xây dựng tại Buôn Ma Thuột, dành cho những người yêu bóng đá và cầu lông.');
    $values = [
        ['ri-focus-3-line', 'Minh bạch thông tin', 'Mỗi sân đều có hình ảnh thực tế, bảng giá theo giờ và tiện ích rõ ràng. Không có phụ phí ẩn, không có giá "trên trời".'],
        ['ri-heart-3-line', 'Vì cộng đồng thể thao', 'Chúng tôi sinh ra từ các đội bóng phong trào ở Buôn Ma Thuột, hiểu rằng một cuộc gọi đặt sân có thể làm mất cả buổi tối.'],
        ['ri-hand-heart-line', 'Đồng hành cùng chủ sân', 'Nền tảng giúp chủ sân quản lý lịch, giảm cuộc gọi trùng giờ và tăng tỉ lệ lấp sân vào khung giờ thấp điểm.'],
    ];
    $milestones = [
        ['2024', 'Ý tưởng hình thành', 'Bắt đầu từ một nhóm bạn khó tìm sân cầu lông vào tối thứ Bảy tại TP. Buôn Ma Thuột.'],
        ['2025', 'Ra mắt bản thử nghiệm', 'Kết nối 8 sân đầu tiên tại các phường Tân Lợi, Tân An và Thắng Lợi.'],
        ['2026', 'Mở rộng toàn thành phố', 'Hơn 30 sân bóng đá và cầu lông, phục vụ hơn 1.200 lượt đặt sân mỗi tháng.'],
    ];
    ?>
<div class="w-full px-4 md:px-8 py-12 md:py-16">
  <div class="mx-auto grid w-full max-w-[1280px] grid-cols-1 items-center gap-8 lg:grid-cols-2">
    <div>
      <span class="inline-flex items-center gap-2 rounded-full bg-primary-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-primary-700"><span class="w-1.5 h-1.5 rounded-full bg-primary-500"></span>Câu chuyện của chúng tôi</span>
      <h2 class="mt-3 text-2xl md:text-3xl font-bold leading-tight text-foreground-950">Từ một buổi tối không tìm được sân, đến nền tảng của cả thành phố</h2>
      <div class="mt-4 space-y-4 text-sm md:text-base leading-relaxed text-foreground-600">
        <p>Đặt Sân BMT 24H bắt đầu vào cuối năm 2024, khi nhóm chúng tôi gọi liên tiếp 6 chủ sân ở Buôn Ma Thuột nhưng không còn khung giờ trống. Thông tin sân nằm rải rác trên Facebook, giá cả mỗi nơi một kiểu và không ai cập nhật lịch.</p>
        <p>Chúng tôi quyết định làm một nơi duy nhất để người chơi tìm sân, xem giá và giữ chỗ trước. Đến nay, nền tảng kết nối hơn 30 sân bóng đá và cầu lông tại các phường trung tâm, phục vụ hàng nghìn lượt chơi mỗi tháng.</p>
      </div>
      <div class="mt-6 flex flex-wrap gap-3">
        <a href="<?= url('/tim-san') ?>" class="whitespace-nowrap rounded-md bg-primary-500 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-primary-600">Khám phá sân</a>
        <a href="<?= url('/lien-he') ?>" class="whitespace-nowrap rounded-md border border-background-300 px-5 py-3 text-sm font-semibold text-foreground-800 transition-colors hover:border-primary-400 hover:text-primary-700">Hợp tác cùng chúng tôi</a>
      </div>
    </div>
    <div class="h-[280px] overflow-hidden rounded-lg bg-background-100 md:h-[400px]">
      <img src="https://readdy.ai/api/search-image?query=Group%20of%20friends%20in%20sports%20clothes%20standing%20on%20an%20outdoor%20five%20a%20side%20football%20pitch%20at%20golden%20hour%2C%20green%20turf%2C%20tropical%20trees%20in%20the%20background%2C%20warm%20sunlight%2C%20authentic%20lifestyle%20sports%20photography%2C%20friendly%20community%20atmosphere&width=1200&height=900&seq=bmt-about-city-01&orientation=landscape" alt="Nhóm người chơi thể thao trên sân bóng tại Buôn Ma Thuột" class="h-full w-full object-cover object-top">
    </div>
  </div>
</div>
<div class="w-full bg-white px-4 md:px-8 py-10 md:py-12">
  <div class="mx-auto grid w-full max-w-[1280px] grid-cols-2 gap-6 md:grid-cols-4">
    <?php foreach (SITE_STATS as $s): ?><div class="text-center"><p class="font-heading text-2xl font-extrabold text-primary-600 md:text-3xl"><?= e($s['value']) ?></p><p class="mt-1.5 text-xs leading-snug text-foreground-600 md:text-sm"><?= e($s['label']) ?></p></div><?php endforeach; ?>
  </div>
</div>
<div class="w-full px-4 md:px-8 py-12 md:py-16">
  <div class="mx-auto w-full max-w-[1280px]">
    <div class="max-w-2xl">
      <h2 class="text-2xl md:text-3xl font-bold text-foreground-950">Giá trị chúng tôi theo đuổi</h2>
      <p class="mt-3 text-sm md:text-base leading-relaxed text-foreground-600">Ba nguyên tắc này định hình mọi tính năng trên nền tảng, từ cách hiển thị giá đến cách chủ sân xác nhận đơn đặt.</p>
    </div>
    <div class="mt-8 grid grid-cols-1 gap-5 md:grid-cols-3">
      <?php foreach ($values as $v): ?>
        <div class="rounded-lg border border-background-200 bg-background-50 p-5 md:p-6">
          <span class="w-11 h-11 flex items-center justify-center rounded-md bg-primary-500 text-white"><i class="<?= $v[0] ?> text-xl" aria-hidden="true"></i></span>
          <h3 class="mt-4 font-heading text-base font-bold text-foreground-950"><?= $v[1] ?></h3>
          <p class="mt-2 text-sm leading-relaxed text-foreground-600"><?= e($v[2]) ?></p>
        </div>
      <?php endforeach; ?>
    </div>
  </div>
</div>
<div class="w-full px-4 md:px-8 pb-12 md:pb-16">
  <div class="mx-auto w-full max-w-[1280px] rounded-lg border border-background-200 bg-white p-6 md:p-8">
    <h2 class="font-heading text-xl font-bold text-foreground-950">Hành trình phát triển</h2>
    <div class="mt-6 grid grid-cols-1 gap-6 md:grid-cols-3">
      <?php foreach ($milestones as $m): ?>
        <div class="relative border-l-2 border-primary-200 pl-4">
          <span class="absolute -left-[7px] top-1 h-3 w-3 rounded-full bg-primary-500"></span>
          <p class="font-heading text-sm font-extrabold text-primary-600"><?= $m[0] ?></p>
          <p class="mt-1 font-heading text-sm font-bold text-foreground-950"><?= $m[1] ?></p>
          <p class="mt-1.5 text-xs leading-relaxed text-foreground-600"><?= $m[2] ?></p>
        </div>
      <?php endforeach; ?>
    </div>
  </div>
</div>
<?php
});
