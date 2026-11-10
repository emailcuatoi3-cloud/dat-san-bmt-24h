<?php
require __DIR__ . '/_auth_layout.php';
$u = current_user();
if ($u) redirect($u['role'] === 'admin' ? '/quan-tri' : ($u['role'] === 'owner' ? '/chu-san' : '/tai-khoan'));

render_page(['title' => 'Đăng nhập - ' . SITE_NAME, 'layout' => 'bare', 'script' => 'pages/auth.js', 'data' => ['redirect' => $_GET['redirect'] ?? '']], function () {
    auth_layout(
        'Đăng nhập tài khoản',
        'Khách hàng, chủ sân và quản trị viên đều đăng nhập tại đây. Hệ thống tự nhận vai trò và mở đúng khu vực của bạn.',
        function () {
            social_auth_buttons('login'); ?>
<form id="login-form" novalidate>
  <?php auth_field('login-email', 'email', 'Email', 'email', 'ban@example.com', 'username'); ?>
  <div class="mt-4" data-field="password">
    <div class="mb-1.5 flex items-center justify-between">
      <label for="login-password" class="block text-sm font-medium text-foreground-800">Mật khẩu <span class="text-accent-600">*</span></label>
      <a href="<?= url('/quen-mat-khau') ?>" class="text-xs font-semibold text-primary-600 hover:text-primary-700">Quên mật khẩu?</a>
    </div>
    <div class="relative">
      <input id="login-password" name="password" type="password" autocomplete="current-password" placeholder="Nhập mật khẩu" class="w-full rounded-md border border-background-300 bg-white px-3 py-2.5 pr-11 text-sm text-foreground-950 placeholder:text-foreground-400 focus:border-primary-400 focus:outline-none">
      <button type="button" data-toggle-password aria-label="Hiện mật khẩu" class="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 cursor-pointer items-center justify-center rounded-sm text-foreground-500 transition-colors hover:bg-background-100"><i class="ri-eye-line" aria-hidden="true"></i></button>
    </div>
    <p data-error class="mt-1 hidden text-xs text-accent-700"></p>
  </div>
  <label class="mt-4 flex cursor-pointer items-center gap-2 text-sm text-foreground-700"><input type="checkbox" name="remember" class="h-4 w-4 cursor-pointer accent-primary-500" checked>Ghi nhớ đăng nhập trên thiết bị này</label>
  <?php auth_alert('data-server-error', 'ri-error-warning-line', 'error'); ?>
  <button type="submit" class="mt-5 flex w-full cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-md bg-primary-500 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-primary-600 disabled:cursor-not-allowed disabled:opacity-70">Đăng nhập</button>
  <div class="mt-5 rounded-md border border-dashed border-background-300 bg-background-50 px-3.5 py-3 text-xs leading-relaxed text-foreground-600">
    <p class="font-semibold text-foreground-800">Tài khoản dùng thử (mật khẩu: 123456)</p>
    <div class="mt-2 grid grid-cols-1 gap-1.5 sm:grid-cols-3">
      <?php foreach ([['khach@bmt24h.vn', 'Khách hàng'], ['chusan@bmt24h.vn', 'Chủ sân'], ['admin@bmt24h.vn', 'Quản trị']] as $demo): ?>
        <button type="button" data-demo="<?= $demo[0] ?>" class="cursor-pointer rounded-md border border-background-300 bg-white px-2 py-1.5 font-semibold text-foreground-800 hover:border-primary-400 hover:text-primary-700"><?= $demo[1] ?></button>
      <?php endforeach; ?>
    </div>
  </div>
</form>
<?php
        },
        'Chưa có tài khoản? <a href="' . url('/dang-ky') . '" class="font-semibold text-primary-600 hover:text-primary-700">Đăng ký miễn phí</a>'
    );
});
