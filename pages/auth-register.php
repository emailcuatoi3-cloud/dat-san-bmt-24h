<?php
require __DIR__ . '/_auth_layout.php';
if (current_user()) redirect('/tai-khoan');
$ownerPage = !empty($OWNER_PAGE); // true khi mở từ /dang-ky-chu-san
$role = $ownerPage || in_array($_GET['vai-tro'] ?? ($_GET['role'] ?? ''), ['owner', 'chu-san'], true) ? 'owner' : 'customer';

render_page(['title' => ($ownerPage ? 'Đăng ký chủ sân - ' : 'Đăng ký - ') . SITE_NAME, 'layout' => 'bare', 'script' => 'pages/auth.js', 'data' => ['role' => $role]], function () use ($role, $ownerPage) {
    auth_layout(
        $ownerPage ? 'Đăng ký chủ sân' : 'Tạo tài khoản',
        $ownerPage
            ? 'Tạo tài khoản đối tác miễn phí để đưa sân lên Đặt Sân BMT 24H và bắt đầu nhận đơn đặt sân online.'
            : 'Một cổng đăng ký duy nhất — chọn loại tài khoản phù hợp, hệ thống sẽ mở đúng khu vực cho bạn sau khi đăng nhập.',
        function () use ($role, $ownerPage) {
            if ($ownerPage): ?>
<ol class="mb-5 grid grid-cols-3 gap-2 text-center text-[11px] font-semibold text-foreground-700">
  <?php foreach ([['ri-user-add-line', 'Tạo tài khoản'], ['ri-football-line', 'Thêm sân & giá'], ['ri-calendar-check-line', 'Nhận đơn online']] as $i => $st): ?>
    <li class="rounded-md border border-primary-200 bg-primary-50 px-2 py-2.5"><span class="mx-auto mb-1 flex h-7 w-7 items-center justify-center rounded-full bg-primary-500 text-white"><i class="<?= $st[0] ?>" aria-hidden="true"></i></span><?= $i + 1 ?>. <?= $st[1] ?></li>
  <?php endforeach; ?>
</ol>
<p class="mb-4 flex items-start gap-2 rounded-md bg-secondary-50 px-3 py-2.5 text-xs leading-relaxed text-secondary-900"><i class="ri-shield-check-line mt-0.5 text-primary-600" aria-hidden="true"></i>Sau khi gửi, quản trị viên sẽ xem xét và duyệt trong 24 giờ. Khi được duyệt, tài khoản của bạn sẽ mở kênh chủ sân.</p>
<?php       else:
                social_auth_buttons('register');
            endif; ?>
<form id="register-form" novalidate>
  <input type="hidden" name="role" value="<?= $role ?>">
  <div class="<?= $ownerPage ? 'hidden' : '' ?>">
    <span class="mb-2 block text-sm font-medium text-foreground-800">Bạn đăng ký với vai trò <span class="text-accent-600">*</span></span>
    <div class="inline-flex w-full rounded-full bg-background-100 px-1 py-1">
      <button type="button" data-role="customer" class="flex flex-1 cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-full px-3 py-2 text-xs font-semibold transition-colors"><i class="ri-user-smile-line text-sm" aria-hidden="true"></i>Khách đặt sân</button>
      <button type="button" data-role="owner" class="flex flex-1 cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-full px-3 py-2 text-xs font-semibold transition-colors"><i class="ri-store-2-line text-sm" aria-hidden="true"></i>Chủ sân</button>
    </div>
    <p data-role-hint class="mt-2 text-xs leading-relaxed text-foreground-500"></p>
  </div>
  <div class="mt-4" data-owner-only>
    <?php auth_field('register-business', 'businessName', 'Tên sân / cơ sở', 'text', 'Sân bóng Hoa Phượng'); ?>
    <div class="mt-4"><?php auth_field('register-address', 'address', 'Địa chỉ sân', 'text', 'Số nhà, đường, phường, TP. Buôn Ma Thuột'); ?></div>
    <?php owner_request_extra_fields('register'); ?>
  </div>
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
        $ownerPage
            ? 'Đã có tài khoản chủ sân? <a href="' . url('/dang-nhap') . '" class="font-semibold text-primary-600 hover:text-primary-700">Đăng nhập</a><br><span class="mt-1 inline-block text-xs">Bạn là người chơi? <a href="' . url('/dang-ky') . '" class="font-semibold text-primary-600 hover:text-primary-700">Đăng ký tài khoản khách</a></span>'
            : 'Đã có tài khoản? <a href="' . url('/dang-nhap') . '" class="font-semibold text-primary-600 hover:text-primary-700">Đăng nhập</a>',
        $ownerPage ? [
            'Đưa sân của bạn lên Đặt Sân BMT 24H',
            'Nhận đơn đặt sân online 24/7, quản lý lịch, tiền cọc và doanh thu trong một kênh dành riêng cho chủ sân.',
            ['Miễn phí đăng ký, không phí duy trì', 'Duyệt đơn, khóa giờ và check-in bằng vé QR', 'Báo cáo doanh thu, khách quen và tiền cọc'],
        ] : null
    );
});