<?php
/** Khung chung cho các trang đăng nhập / đăng ký / quên mật khẩu. */
function auth_layout(string $title, string $subtitle, callable $children, string $footerHtml = ''): void
{
    ?>
<div class="flex min-h-screen flex-col bg-background-50 lg:grid lg:grid-cols-[1.05fr_1fr]">
  <div class="relative hidden overflow-hidden bg-background-100 lg:block">
    <img src="https://readdy.ai/api/search-image?query=Floodlit%20artificial%20turf%20football%20pitch%20at%20night%20seen%20from%20a%20low%20angle%2C%20green%20grass%20glowing%20under%20stadium%20lights%2C%20dark%20moody%20sky%2C%20white%20line%20markings%2C%20cinematic%20sports%20photography%2C%20no%20people&width=1200&height=1600&seq=bmt-auth-pitch-01&orientation=portrait" alt="Sân bóng đá ban đêm tại Buôn Ma Thuột" title="Đặt Sân BMT 24H" class="absolute inset-0 h-full w-full object-cover object-top">
    <div class="auth-photo-veil absolute inset-0"></div>
    <div class="relative flex h-full flex-col justify-between p-10 xl:p-14">
      <a href="<?= url('/') ?>" class="flex items-center gap-2.5">
        <span class="w-10 h-10 flex items-center justify-center rounded-lg bg-primary-500 text-white"><i class="ri-football-line text-xl" aria-hidden="true"></i></span>
        <span class="leading-tight"><span class="block font-heading text-[15px] font-extrabold tracking-tight text-white">ĐẶT SÂN BMT</span><span class="block text-[11px] font-semibold tracking-[0.18em] text-accent-500">24H</span></span>
      </a>
      <div class="max-w-md">
        <h2 class="auth-photo-heading font-heading text-3xl font-extrabold leading-tight xl:text-4xl">Sân đã sẵn sàng, chỉ chờ đội của bạn</h2>
        <p class="auth-photo-text mt-4 text-sm leading-relaxed">Quản lý lịch đặt sân, theo dõi khung giờ trống và nhận xác nhận từ chủ sân ngay trên một nền tảng duy nhất.</p>
        <ul class="mt-6 space-y-3">
          <?php foreach (['Theo dõi toàn bộ lịch sử đặt sân', 'Nhận thông báo khi chủ sân xác nhận', 'Hoàn cọc 100% khi hủy trước 4 giờ'] as $item): ?>
            <li class="auth-photo-text flex items-center gap-2.5 text-sm"><span class="auth-photo-mark flex h-5 w-5 shrink-0 items-center justify-center rounded-full"><i class="ri-check-line text-xs" aria-hidden="true"></i></span><?= e($item) ?></li>
          <?php endforeach; ?>
        </ul>
      </div>
      <p class="auth-photo-text-soft text-xs">© <?= date('Y') ?> Đặt Sân BMT 24H • TP. Buôn Ma Thuột, Đắk Lắk</p>
    </div>
  </div>
  <div class="flex flex-1 items-center justify-center px-4 py-10 md:px-8">
    <div class="w-full max-w-md">
      <div class="mb-6 flex items-center justify-between gap-3">
        <a href="<?= url('/') ?>" class="inline-flex items-center gap-2 text-sm font-medium text-foreground-600 hover:text-primary-600"><i class="ri-arrow-left-line" aria-hidden="true"></i>Về trang chủ</a>
        <div class="flex items-center gap-2"><?php render_language_toggle(); render_theme_toggle(); ?></div>
      </div>
      <div class="rounded-lg border border-background-200 bg-white p-6 md:p-8">
        <h1 class="font-heading text-2xl font-extrabold text-foreground-950"><?= e($title) ?></h1>
        <p class="mt-2 text-sm leading-relaxed text-foreground-600"><?= e($subtitle) ?></p>
        <div class="mt-6"><?php $children(); ?></div>
      </div>
      <?php if ($footerHtml): ?><div class="mt-5 text-center text-sm text-foreground-600"><?= $footerHtml ?></div><?php endif; ?>
      <div class="mt-6 flex items-center justify-center gap-2 text-xs text-foreground-500 lg:hidden"><i class="ri-map-pin-line" aria-hidden="true"></i>TP. Buôn Ma Thuột, Đắk Lắk</div>
    </div>
  </div>
</div>
<?php
}

function social_auth_buttons(string $action = 'login'): void
{
    $verb = $action === 'login' ? 'Đăng nhập với' : 'Đăng ký với';
    $btn = 'flex w-full cursor-pointer items-center justify-center gap-2.5 whitespace-nowrap rounded-md border border-background-300 bg-white px-3 py-2.5 text-sm font-semibold text-foreground-900 transition-colors hover:border-primary-300 hover:bg-primary-50/50';
    ?>
<div data-social="<?= e($action) ?>">
  <div class="flex flex-col gap-3">
    <button type="button" data-provider="Google" class="<?= $btn ?>"><span class="flex h-5 w-5 items-center justify-center text-accent-600"><i class="ri-google-fill text-base" aria-hidden="true"></i></span><?= $verb ?> Google</button>
    <button type="button" data-provider="Facebook" class="<?= $btn ?>"><span class="flex h-5 w-5 items-center justify-center text-primary-600"><i class="ri-facebook-circle-fill text-base" aria-hidden="true"></i></span><?= $verb ?> Facebook</button>
  </div>
  <div data-social-notice class="mt-3 hidden items-start gap-2.5 rounded-md border border-primary-200 bg-primary-50 px-3.5 py-2.5"><i class="ri-information-line mt-0.5 text-primary-600" aria-hidden="true"></i><p class="text-xs leading-relaxed text-primary-800"></p></div>
</div>
<div class="my-5 flex items-center gap-3"><span class="h-px flex-1 bg-background-200"></span><span class="whitespace-nowrap text-xs text-foreground-500">hoặc dùng email</span><span class="h-px flex-1 bg-background-200"></span></div>
<?php
}

/** Ô nhập liệu có nhãn + chỗ báo lỗi. */
function auth_field(string $id, string $name, string $label, string $type = 'text', string $placeholder = '', string $autocomplete = '', string $value = ''): void
{
    ?>
<div class="min-w-0" data-field="<?= e($name) ?>">
  <label for="<?= e($id) ?>" class="mb-1.5 block text-sm font-medium text-foreground-800"><span data-label><?= e($label) ?></span> <span class="text-accent-600">*</span></label>
  <input id="<?= e($id) ?>" name="<?= e($name) ?>" type="<?= e($type) ?>" value="<?= e($value) ?>" <?= $autocomplete ? 'autocomplete="' . e($autocomplete) . '"' : '' ?> placeholder="<?= e($placeholder) ?>" class="w-full rounded-md border border-background-300 bg-white px-3 py-2.5 text-sm text-foreground-950 placeholder:text-foreground-400 focus:border-primary-400 focus:outline-none">
  <p data-error class="mt-1 hidden text-xs text-accent-700"></p>
</div>
<?php
}

function auth_alert(string $attr, string $icon, string $tone): void
{
    $cls = $tone === 'error' ? 'border-accent-300 bg-accent-50' : 'border-primary-200 bg-primary-50';
    $txt = $tone === 'error' ? 'text-accent-900' : 'text-primary-800';
    $ic = $tone === 'error' ? 'text-accent-700' : 'text-primary-600';
    echo '<div ' . $attr . ' class="mt-4 hidden items-start gap-2.5 rounded-md border ' . $cls . ' px-3.5 py-3"><i class="' . $icon . ' mt-0.5 ' . $ic . '" aria-hidden="true"></i><p class="text-xs leading-relaxed ' . $txt . '"></p></div>';
}
