<?php
/**
 * ĐĂNG KÝ CHỦ SÂN — /dang-ky-chu-san
 *  - Chưa đăng nhập: form tạo tài khoản + gửi yêu cầu (dùng chung form đăng ký, khóa vai trò "Chủ sân").
 *  - Khách đã đăng nhập: form gửi yêu cầu cho quản trị viên + theo dõi trạng thái duyệt.
 *  - Chủ sân / quản trị: chuyển về đúng kênh của mình.
 */
$u = current_user();
if (!$u) {
    $OWNER_PAGE = true;
    require __DIR__ . '/auth-register.php';
    return;
}
if ($u['role'] === 'owner') redirect('/chu-san');
if ($u['role'] === 'admin') redirect('/quan-tri');

require_once __DIR__ . '/_auth_layout.php';
$req = latest_owner_request((int) $u['id']);
$canSubmit = !$req || $req['status'] === 'rejected';

render_page([
    'title' => 'Đăng ký chủ sân - ' . SITE_NAME,
    'script' => 'pages/owner-request.js',
], function () use ($u, $req, $canSubmit) {
    page_hero([['Trang chủ', '/'], ['Đăng ký chủ sân']], 'Đăng ký trở thành chủ sân',
        'Gửi thông tin sân của bạn cho quản trị viên Đặt Sân BMT 24H. Khi được duyệt, tài khoản sẽ mở kênh chủ sân để thêm sân và nhận đơn online.');
    $input = 'w-full rounded-md border border-background-300 bg-white px-3 py-2.5 text-sm text-foreground-950 placeholder:text-foreground-400 focus:border-primary-400 focus:outline-none';
    ?>
<div class="w-full px-4 py-8 md:px-8 md:py-10">
  <div class="mx-auto grid w-full max-w-[1100px] grid-cols-1 items-start gap-6 lg:grid-cols-[1fr_340px]">
    <div class="min-w-0 space-y-5">
      <?php if ($req): ?>
        <?php
        $meta = [
            'pending' => ['ri-time-line', 'border-accent-300 bg-accent-50', 'text-accent-800', 'Đang chờ quản trị viên duyệt', 'Yêu cầu của bạn đã được gửi. Quản trị viên sẽ xem xét trong 24 giờ — bạn có thể quay lại trang này để theo dõi.'],
            'approved' => ['ri-checkbox-circle-line', 'border-primary-300 bg-primary-50', 'text-primary-800', 'Yêu cầu đã được duyệt', 'Tài khoản của bạn đã mở kênh chủ sân.'],
            'rejected' => ['ri-close-circle-line', 'border-accent-300 bg-accent-50', 'text-accent-800', 'Yêu cầu chưa được duyệt', 'Bạn có thể chỉnh lại thông tin và gửi yêu cầu mới bên dưới.'],
        ][$req['status']];
        ?>
        <section class="rounded-lg border <?= $meta[1] ?> p-5">
          <div class="flex items-start gap-3">
            <span class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white <?= $meta[2] ?>"><i class="<?= $meta[0] ?> text-xl" aria-hidden="true"></i></span>
            <div class="min-w-0 flex-1">
              <p class="font-heading text-base font-bold <?= $meta[2] ?>"><?= $meta[3] ?></p>
              <p class="mt-1 text-sm text-foreground-700"><?= $meta[4] ?></p>
              <?php if ($req['adminNote']): ?><p class="mt-2 rounded-md bg-white px-3 py-2 text-sm text-foreground-800"><b>Phản hồi của quản trị viên:</b> <?= e($req['adminNote']) ?></p><?php endif; ?>
              <dl class="mt-3 grid grid-cols-1 gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2">
                <div><dt class="inline text-foreground-500">Tên sân: </dt><dd class="inline font-semibold text-foreground-950"><?= e($req['businessName']) ?></dd></div>
                <div><dt class="inline text-foreground-500">Môn: </dt><dd class="inline font-semibold text-foreground-950"><?= e($req['sportsLabel']) ?> · <?= $req['courtCount'] ?> sân</dd></div>
                <div class="sm:col-span-2"><dt class="inline text-foreground-500">Địa chỉ: </dt><dd class="inline text-foreground-900"><?= e($req['address']) ?></dd></div>
                <div><dt class="inline text-foreground-500">Gửi lúc: </dt><dd class="inline text-foreground-900"><?= date('H:i d/m/Y', strtotime($req['createdAt'])) ?></dd></div>
              </dl>
            </div>
          </div>
        </section>
      <?php endif; ?>

      <?php if ($canSubmit): ?>
      <section class="rounded-lg border border-background-200 bg-white p-5 md:p-6">
        <h2 class="font-heading text-lg font-extrabold text-foreground-950"><?= $req ? 'Gửi lại yêu cầu' : 'Thông tin sân của bạn' ?></h2>
        <p class="mt-1 text-sm text-foreground-600">Tài khoản gửi yêu cầu: <b><?= e($u['email']) ?></b></p>
        <form id="owner-request-form" class="mt-5" novalidate>
          <?php auth_field('or-business', 'businessName', 'Tên sân / cơ sở', 'text', 'Sân bóng Hoa Phượng', '', $req['businessName'] ?? ''); ?>
          <div class="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <?php auth_field('or-contact', 'contactName', 'Người phụ trách', 'text', 'Nguyễn Văn Hùng', 'name', $u['full_name']); ?>
            <?php auth_field('or-phone', 'phone', 'Số điện thoại liên hệ', 'tel', '0912 345 678', 'tel', $u['phone']); ?>
          </div>
          <div class="mt-4"><?php auth_field('or-address', 'address', 'Địa chỉ sân', 'text', 'Số nhà, đường, phường, TP. Buôn Ma Thuột', '', $req['address'] ?? ''); ?></div>
          <?php owner_request_extra_fields('or'); ?>
          <label class="mt-4 flex cursor-pointer items-start gap-2.5 text-xs leading-relaxed text-foreground-600" data-field="agree">
            <input type="checkbox" name="agree" class="mt-0.5 h-4 w-4 cursor-pointer accent-primary-500">
            <span>Tôi xác nhận thông tin trên là chính xác và đồng ý với <a href="<?= url('/gioi-thieu') ?>" class="font-semibold text-primary-600">điều khoản đối tác</a> của Đặt Sân BMT 24H.</span>
          </label>
          <p data-form-error class="mt-3 hidden rounded-md border border-accent-300 bg-accent-50 px-3 py-2 text-sm text-accent-900"></p>
          <button type="submit" class="mt-5 flex w-full items-center justify-center gap-2 rounded-md bg-primary-500 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-primary-600 disabled:opacity-70 sm:w-auto sm:px-8"><i class="ri-send-plane-line" aria-hidden="true"></i>Gửi yêu cầu cho quản trị viên</button>
        </form>
      </section>
      <?php endif; ?>
    </div>

    <aside class="space-y-4">
      <div class="rounded-lg border border-background-200 bg-white p-5">
        <p class="font-heading text-sm font-bold text-foreground-950">Quy trình duyệt</p>
        <ol class="mt-3 space-y-3 text-sm">
          <?php foreach ([['Gửi thông tin sân', 'Điền form bên cạnh, chỉ mất khoảng 1 phút.'], ['Quản trị viên xem xét', 'Kiểm tra thông tin và liên hệ lại nếu cần, trong 24 giờ.'], ['Mở kênh chủ sân', 'Thêm sân, bảng giá và bắt đầu nhận đơn đặt sân online.']] as $i => $st): ?>
            <li class="flex gap-3"><span class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary-500 text-xs font-bold text-white"><?= $i + 1 ?></span><span><b class="text-foreground-950"><?= $st[0] ?></b><br><span class="text-xs text-foreground-600"><?= $st[1] ?></span></span></li>
          <?php endforeach; ?>
        </ol>
      </div>
      <div class="rounded-lg border border-secondary-200 bg-secondary-50 p-5 text-sm text-secondary-900">
        <p class="font-semibold">Cần hỗ trợ đăng ký?</p>
        <a href="tel:<?= preg_replace('/\D/', '', HOTLINE) ?>" class="mt-2 flex items-center gap-2 font-semibold text-primary-700"><i class="ri-phone-line" aria-hidden="true"></i><?= HOTLINE ?></a>
      </div>
    </aside>
  </div>
</div>
<?php
});