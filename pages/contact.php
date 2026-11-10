<?php
/**
 * LIÊN HỆ — form gửi bằng POST thuần (PHP xử lý, lưu vào bảng contact_messages),
 * sau đó chuyển hướng lại trang (mẫu Post/Redirect/Get) để tránh gửi trùng khi F5.
 */
$subjects = ['Tôi cần hỗ trợ đặt sân', 'Tôi muốn hợp tác cho thuê sân', 'Báo lỗi thông tin sân', 'Góp ý cải thiện nền tảng', 'Yêu cầu khác'];
$status = $_GET['gui'] ?? '';
$error = '';
$old = ['full_name' => '', 'phone' => '', 'email' => '', 'subject' => $subjects[0], 'message' => ''];

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    foreach ($old as $k => $v) $old[$k] = trim((string) ($_POST[$k] ?? ''));
    if (trim((string) ($_POST['website_alt'] ?? '')) !== '') redirect('/lien-he?gui=ok'); // bẫy chống spam
    if (mb_strlen($old['full_name']) < 2) $error = 'Vui lòng nhập họ và tên.';
    elseif (!filter_var($old['email'], FILTER_VALIDATE_EMAIL)) $error = 'Email chưa đúng định dạng.';
    elseif (mb_strlen($old['message']) < 5) $error = 'Vui lòng nhập nội dung yêu cầu.';
    else {
        q('INSERT INTO contact_messages (name, phone, email, topic, message) VALUES (?,?,?,?,?)',
            [mb_substr($old['full_name'], 0, 120), mb_substr($old['phone'], 0, 30), $old['email'], in_array($old['subject'], $subjects, true) ? $old['subject'] : 'Yêu cầu khác', mb_substr($old['message'], 0, 500)]);
        redirect('/lien-he?gui=ok');
    }
}

render_page(['title' => 'Liên hệ - ' . SITE_NAME], function () use ($subjects, $status, $error, $old) {
    page_hero([['Trang chủ', '/'], ['Liên hệ']], 'Liên hệ Đặt Sân BMT 24H', 'Cần hỗ trợ đặt sân, hợp tác cho thuê sân hoặc góp ý cho nền tảng? Hãy để lại thông tin, chúng tôi luôn sẵn sàng.');
    $input = 'box-border w-full rounded-md border border-background-300 bg-white px-3 py-2.5 text-sm text-foreground-950 placeholder:text-foreground-400 focus:border-primary-400 focus:outline-none';
    $items = [
        ['ri-map-pin-2-line', 'Địa chỉ', ['TP. Buôn Ma Thuột, Đắk Lắk, Việt Nam', 'Văn phòng: 23 Lê Duẩn, P. Tân Lợi']],
        ['ri-phone-line', 'Hotline', [HOTLINE, 'Hỗ trợ đặt sân 24/7']],
        ['ri-mail-line', 'Email', [SUPPORT_EMAIL, 'Phản hồi trong 2 giờ làm việc']],
        ['ri-time-line', 'Giờ làm việc', ['Thứ 2 - Thứ 7: 07:00 - 21:00', 'Chủ nhật: 08:00 - 17:00']],
    ];
    ?>
<div class="w-full px-4 md:px-8 py-10 md:py-14">
  <div class="mx-auto grid w-full max-w-[1280px] grid-cols-1 gap-6 lg:grid-cols-[1fr_420px]">
    <div class="min-w-0">
      <div class="rounded-lg border border-background-200 bg-white p-5 md:p-6">
        <h2 class="font-heading text-lg font-bold text-foreground-950">Gửi yêu cầu cho chúng tôi</h2>
        <p class="mt-1 text-sm text-foreground-600">Điền thông tin bên dưới, đội ngũ hỗ trợ sẽ liên hệ lại trong vòng 2 giờ làm việc.</p>
        <form method="post" action="<?= url('/lien-he') ?>" class="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2" onsubmit="this.querySelector('button[type=submit]').disabled=true">
          <div class="min-w-0"><label for="contact-name" class="mb-1.5 block text-sm font-medium text-foreground-800">Họ và tên <span class="text-accent-600">*</span></label><input id="contact-name" name="full_name" type="text" required value="<?= e($old['full_name']) ?>" placeholder="Nguyễn Minh Quân" class="<?= $input ?>"></div>
          <div class="min-w-0"><label for="contact-phone" class="mb-1.5 block text-sm font-medium text-foreground-800">Số điện thoại</label><input id="contact-phone" name="phone" type="tel" value="<?= e($old['phone']) ?>" placeholder="0912 345 678" class="<?= $input ?>"></div>
          <div class="min-w-0 sm:col-span-2"><label for="contact-email" class="mb-1.5 block text-sm font-medium text-foreground-800">Email <span class="text-accent-600">*</span></label><input id="contact-email" name="email" type="email" required value="<?= e($old['email']) ?>" placeholder="ban@example.com" class="<?= $input ?>"></div>
          <div class="min-w-0 sm:col-span-2"><label for="contact-subject" class="mb-1.5 block text-sm font-medium text-foreground-800">Chủ đề</label>
            <div class="relative"><select id="contact-subject" name="subject" class="<?= $input ?> cursor-pointer appearance-none pr-9"><?php foreach ($subjects as $s): ?><option <?= $s === $old['subject'] ? 'selected' : '' ?>><?= e($s) ?></option><?php endforeach; ?></select><i class="ri-arrow-down-s-line pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-foreground-400" aria-hidden="true"></i></div></div>
          <div class="min-w-0 sm:col-span-2"><label for="contact-message" class="mb-1.5 block text-sm font-medium text-foreground-800">Nội dung <span class="text-accent-600">*</span></label><textarea id="contact-message" name="message" rows="5" required maxlength="500" placeholder="Ví dụ: Mình muốn đặt sân bóng đá 7 người tại P. Tân Lợi vào tối thứ Sáu hằng tuần..." class="<?= $input ?> leading-relaxed"><?= e($old['message']) ?></textarea><p class="mt-1 text-right text-xs text-foreground-400">Tối đa 500 ký tự</p></div>
          <div class="lien-he-ghi-chu-phu" aria-hidden="true"><label for="contact-website-alt">Website phụ</label><input id="contact-website-alt" name="website_alt" type="text" tabindex="-1" autocomplete="off"></div>
          <div class="min-w-0 sm:col-span-2">
            <?php if ($status === 'ok'): ?><div class="mb-4 flex items-start gap-2.5 rounded-md border border-primary-200 bg-primary-50 px-3.5 py-3"><i class="ri-checkbox-circle-line mt-0.5 text-primary-600" aria-hidden="true"></i><p class="text-sm text-primary-800">Cảm ơn bạn! Yêu cầu đã được gửi, chúng tôi sẽ phản hồi trong thời gian sớm nhất.</p></div><?php endif; ?>
            <?php if ($error): ?><div class="mb-4 flex items-start gap-2.5 rounded-md border border-accent-200 bg-accent-50 px-3.5 py-3"><i class="ri-error-warning-line mt-0.5 text-accent-700" aria-hidden="true"></i><p class="text-sm text-accent-900"><?= e($error) ?></p></div><?php endif; ?>
            <button type="submit" class="inline-flex w-full items-center justify-center gap-2 whitespace-nowrap rounded-md bg-primary-500 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-primary-600 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"><i class="ri-send-plane-line text-base" aria-hidden="true"></i>Gửi yêu cầu</button>
            <p class="mt-2 text-xs text-foreground-500">Thông tin của bạn chỉ được dùng để phản hồi yêu cầu này.</p>
          </div>
        </form>
      </div>
    </div>
    <aside class="min-w-0 flex flex-col gap-4">
      <div class="rounded-lg border border-background-200 bg-white p-5">
        <h2 class="font-heading text-base font-bold text-foreground-950">Thông tin liên hệ</h2>
        <ul class="mt-4 space-y-4">
          <?php foreach ($items as $it): ?>
            <li class="flex items-start gap-3"><span class="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary-50 text-primary-600"><i class="<?= $it[0] ?> text-base" aria-hidden="true"></i></span>
              <div><p class="text-sm font-semibold text-foreground-950"><?= $it[1] ?></p><?php foreach ($it[2] as $l): ?><p class="mt-0.5 text-xs leading-relaxed text-foreground-600"><?= e($l) ?></p><?php endforeach; ?></div></li>
          <?php endforeach; ?>
        </ul>
      </div>
      <div class="overflow-hidden rounded-lg border border-background-200 bg-white">
        <iframe title="Bản đồ văn phòng Đặt Sân BMT 24H tại Buôn Ma Thuột" src="https://www.google.com/maps?q=Bu%C3%B4n%20Ma%20Thu%E1%BB%99t%2C%20%C4%90%E1%BA%AFk%20L%E1%BA%AFk&output=embed" class="h-[240px] w-full border-0" loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe>
      </div>
    </aside>
  </div>
</div>
<?php
});
