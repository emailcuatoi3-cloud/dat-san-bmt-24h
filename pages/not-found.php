<?php
/** TRANG 404 */
render_page(['title' => 'Không tìm thấy trang - ' . SITE_NAME], function () {
    ?>
<div class="flex flex-col items-center justify-center px-4 py-20 text-center md:py-28">
  <span class="font-heading text-7xl font-extrabold text-primary-100 select-none md:text-9xl">404</span>
  <h1 class="mt-4 font-heading text-2xl font-bold text-foreground-950 md:text-3xl">Không tìm thấy trang này</h1>
  <p class="mt-3 max-w-md text-sm leading-relaxed text-foreground-600">Đường dẫn <span class="font-medium text-foreground-800"><?= e(current_path()) ?></span> không tồn tại hoặc đã được thay đổi. Bạn hãy quay về trang chủ hoặc tìm sân đang trống tại Buôn Ma Thuột.</p>
  <div class="mt-6 flex flex-col gap-2.5 sm:flex-row">
    <a href="<?= url('/') ?>" class="whitespace-nowrap rounded-md bg-primary-500 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-primary-600">Về trang chủ</a>
    <a href="<?= url('/tim-san') ?>" class="whitespace-nowrap rounded-md border border-background-300 px-5 py-3 text-sm font-semibold text-foreground-800 transition-colors hover:border-primary-400 hover:text-primary-700">Tìm sân thể thao</a>
  </div>
</div>
<?php
});
