<?php
require __DIR__ . '/_auth_layout.php';
if (current_user()) redirect('/tai-khoan');
$role = in_array($_GET['vai-tro'] ?? ($_GET['role'] ?? ''), ['owner', 'chu-san'], true) ? 'owner' : 'customer';

render_page(['title' => 'Đăng ký - ' . SITE_NAME, 'layout' => 'bare', 'script' => 'pages/auth.js', 'data' => ['role' => $role]], function () use ($role) {
    auth_layout(
        'Tạo tài khoản',
        'Một cổng đăng ký duy nhất — chọn loại tài khoản phù hợp, hệ thống sẽ mở đúng khu vực cho bạn sau khi đăng nhập.',
        function () use ($role) {
            social_auth_buttons('register'); ?>
<form id="register-form" novalidate>
  <input type="hidden" name="role" value="<?= $role ?>">
  <div>
    <span class="mb-2 block text-sm font-medium text-foreground-800">Bạn đăng ký với vai trò <span class="text-accent-600">*</span></span>
    <div class="inline-flex w-full rounded-full bg-background-100 px-1 py-1">
      <button type="button" data-role="customer" class="flex flex-1 cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-full px-3 py-2 text-xs font-semibold transition-colors"><i class="ri-user-smile-line text-sm" aria-hidden="true"></i>Khách đặt sân</button>
      <button type="button" data-role="owner" class="flex flex-1 cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-full px-3 py-2 text-xs font-semibold transition-colors"><i class="ri-store-2-line text-sm" aria-hidden="true"></i>Chủ sân</button>
    </div>
    <p data-role-hint class="mt-2 text-xs leading-relaxed text-foreground-500"></p>
  </div>
  <div class="mt-4" data-owner-only><?php auth_field('register-business', 'businessName', 'Tên sân / cơ sở', 'text', 'Sân bóng Hoa Phượng'); ?></div>
  <div class="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
    <?php auth_field('register-name', 'name', 'Họ và tên', 'text', 'Nguyễn Minh Quân'); ?>
    <?php auth_field('register-phone', 'phone', 'Số điện thoại', 'tel', '0912 345 678'); ?>
  </div>
  <div class="mt-4"><?php auth_field('register-email', 'email', 'Email', 'email', 'ban@example.com', 'email'); ?></div>
  <div class="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
    <?php auth_field('register-password', 'password', 'Mật khẩu', 'password', 'Tối thiểu 6 ký tự', 'new-password'); ?>
    <?php auth_field('register-confirm', 'confirm', 'Nhập lại mật khẩu', 'password', 'Nhập lại mật khẩu', 'new-password'); ?>
  </div>
  <div data-field="agree">
    <label class="mt-4 flex cursor-pointer items-start gap-2.5 text-xs leading-relaxed text-foreground-600">
      <input type="checkbox" name="agree" class="mt-0.5 h-4 w-4 cursor-pointer accent-primary-500">
      <span>Tôi đồng ý với <a href="<?= url('/gioi-thieu') ?>" class="font-semibold text-primary-600 hover:text-primary-700" data-agree-link>điều khoản sử dụng</a> <span data-agree-text>và chính sách bảo mật của Đặt Sân BMT 24H.</span></span>
    </label>
    <p data-error class="mt-1 hidden text-xs text-accent-700"></p>
  </div>
  <?php auth_alert('data-server-error', 'ri-error-warning-line', 'error'); ?>
  <button type="submit" class="mt-5 flex w-full cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-md bg-primary-500 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-primary-600 disabled:cursor-not-allowed disabled:opacity-70" data-submit-label>Tạo tài khoản</button>
</form>
<?php
        },
        'Đã có tài khoản? <a href="' . url('/dang-nhap') . '" class="font-semibold text-primary-600 hover:text-primary-700">Đăng nhập</a>'
    );
});
