<?php
require __DIR__ . '/_auth_layout.php';

render_page(['title' => 'Quên mật khẩu - ' . SITE_NAME, 'layout' => 'bare', 'script' => 'pages/auth.js'], function () {
    auth_layout(
        'Quên mật khẩu',
        'Nhập email đã đăng ký, chúng tôi sẽ gửi liên kết đặt lại mật khẩu cho bạn.',
        function () { ?>
<form id="forgot-form" novalidate>
  <?php auth_field('forgot-email', 'email', 'Email đã đăng ký', 'email', 'ban@example.com'); ?>
  <button type="submit" class="mt-5 w-full whitespace-nowrap rounded-md bg-primary-500 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-primary-600 disabled:opacity-70">Gửi liên kết đặt lại</button>
  <div class="mt-4 rounded-md bg-background-50 px-3.5 py-3">
    <p class="text-xs leading-relaxed text-foreground-600">Nếu không nhận được email sau 5 phút, hãy kiểm tra thư mục Spam hoặc gọi hotline <a href="tel:<?= preg_replace('/\D/', '', HOTLINE) ?>" class="font-semibold text-primary-600"><?= HOTLINE ?></a> để được hỗ trợ.</p>
  </div>
</form>
<div id="forgot-sent" class="hidden">
  <div class="flex items-start gap-2.5 rounded-md border border-primary-200 bg-primary-50 px-3.5 py-3">
    <i class="ri-mail-send-line mt-0.5 text-primary-600" aria-hidden="true"></i>
    <div>
      <p class="text-sm font-semibold text-primary-800">Đã ghi nhận yêu cầu</p>
      <p class="mt-1 text-xs leading-relaxed text-primary-800/85">Trong bản demo, email đặt lại mật khẩu chưa được gửi thật. Khi nền tảng kết nối hệ thống email, liên kết sẽ được gửi tới <span class="font-semibold" data-sent-email></span>.</p>
      <a data-demo-link href="#" class="mt-2 hidden text-xs font-bold text-primary-700 underline">Mở liên kết đặt lại mật khẩu (bản demo)</a>
    </div>
  </div>
  <button type="button" data-resend class="mt-4 w-full whitespace-nowrap rounded-md border border-background-300 px-4 py-2.5 text-sm font-semibold text-foreground-800 transition-colors hover:border-primary-400 hover:text-primary-700">Gửi lại với email khác</button>
</div>
<?php
        },
        'Nhớ ra mật khẩu rồi? <a href="' . url('/dang-nhap') . '" class="font-semibold text-primary-600 hover:text-primary-700">Quay lại đăng nhập</a>'
    );
});
