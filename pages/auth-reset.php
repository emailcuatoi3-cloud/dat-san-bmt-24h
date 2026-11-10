<?php
require __DIR__ . '/_auth_layout.php';
$token = $_GET['token'] ?? '';

render_page(['title' => 'Đặt lại mật khẩu - ' . SITE_NAME, 'layout' => 'bare', 'script' => 'pages/auth.js', 'data' => ['token' => $token]], function () {
    auth_layout(
        'Đặt lại mật khẩu',
        'Nhập mật khẩu mới cho tài khoản của bạn (tối thiểu 6 ký tự).',
        function () { ?>
<form id="reset-form" novalidate>
  <?php auth_field('reset-password', 'password', 'Mật khẩu mới', 'password', 'Tối thiểu 6 ký tự', 'new-password'); ?>
  <div class="mt-4"><?php auth_field('reset-confirm', 'confirm', 'Nhập lại mật khẩu', 'password', 'Nhập lại mật khẩu', 'new-password'); ?></div>
  <?php auth_alert('data-server-error', 'ri-error-warning-line', 'error'); ?>
  <?php auth_alert('data-server-ok', 'ri-checkbox-circle-line', 'ok'); ?>
  <button type="submit" class="mt-5 w-full whitespace-nowrap rounded-md bg-primary-500 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-primary-600 disabled:opacity-70">Lưu mật khẩu mới</button>
</form>
<?php
        },
        '<a href="' . url('/dang-nhap') . '" class="font-semibold text-primary-600 hover:text-primary-700">Quay lại đăng nhập</a>'
    );
});
