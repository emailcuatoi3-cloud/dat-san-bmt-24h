/**
 * Đăng nhập / đăng ký / quên mật khẩu / đặt lại mật khẩu.
 */
import { $, $$, api, PAGE, setBusy } from '../core/ui.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Hiện / xóa lỗi của từng ô */
function setErrors(form, errors) {
  $$('[data-field]', form).forEach((field) => {
    const name = field.dataset.field;
    const message = errors[name];
    const input = $('input', field);
    const box = $('[data-error]', field);
    if (box) {
      box.textContent = message || '';
      box.classList.toggle('hidden', !message);
    }
    if (input && input.type !== 'checkbox') {
      input.classList.toggle('border-accent-400', Boolean(message));
      input.classList.toggle('border-background-300', !message);
    }
  });
}

function showAlert(form, selector, message) {
  const box = $(selector, form);
  if (!box) return;
  $('p', box).textContent = message || '';
  box.classList.toggle('hidden', !message);
  box.classList.toggle('flex', Boolean(message));
}

// Xóa lỗi khi người dùng gõ lại
document.addEventListener('input', (event) => {
  const field = event.target.closest('[data-field]');
  if (!field) return;
  const box = $('[data-error]', field);
  if (box) box.classList.add('hidden');
  event.target.classList.remove('border-accent-400');
});

// Nút Google / Facebook (chưa mở trong bản này)
$$('[data-social]').forEach((wrap) => {
  const action = wrap.dataset.social;
  $$('[data-provider]', wrap).forEach((btn) =>
    btn.addEventListener('click', () => {
      const notice = $('[data-social-notice]', wrap);
      const verb = action === 'login' ? 'Đăng nhập' : 'Đăng ký';
      $('p', notice).textContent = `${verb} bằng ${btn.dataset.provider} sẽ mở trong bản cập nhật tới. Hiện tại bạn vui lòng dùng email ở bên dưới.`;
      notice.classList.remove('hidden');
      notice.classList.add('flex');
    }),
  );
});

// ---------------- Đăng nhập ----------------
const loginForm = $('#login-form');
if (loginForm) {
  $('[data-toggle-password]', loginForm).addEventListener('click', (event) => {
    const input = $('#login-password');
    const show = input.type === 'password';
    input.type = show ? 'text' : 'password';
    event.currentTarget.innerHTML = `<i class="${show ? 'ri-eye-off-line' : 'ri-eye-line'}" aria-hidden="true"></i>`;
    event.currentTarget.setAttribute('aria-label', show ? 'Ẩn mật khẩu' : 'Hiện mật khẩu');
  });

  $$('[data-demo]', loginForm).forEach((btn) =>
    btn.addEventListener('click', () => {
      loginForm.email.value = btn.dataset.demo;
      loginForm.password.value = '123456';
    }),
  );

  loginForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const email = loginForm.email.value.trim().toLowerCase();
    const password = loginForm.password.value;
    const errors = {};
    if (!EMAIL_RE.test(email)) errors.email = 'Email chưa đúng định dạng.';
    if (password.length < 6) errors.password = 'Mật khẩu cần ít nhất 6 ký tự.';
    setErrors(loginForm, errors);
    showAlert(loginForm, '[data-server-error]', '');
    if (Object.keys(errors).length) return;
    const btn = $('button[type=submit]', loginForm);
    setBusy(btn, true, 'Đang đăng nhập...');
    try {
      const data = await api('auth', 'login', { email, password, redirect: PAGE.redirect || '' });
      window.location.href = data.redirect;
    } catch (error) {
      showAlert(loginForm, '[data-server-error]', error.message);
      setBusy(btn, false);
    }
  });
}

// ---------------- Đăng ký ----------------
const registerForm = $('#register-form');
if (registerForm) {
  const hints = {
    customer: 'Giữ sân, theo dõi lịch đặt và nhận nhắc giờ đá.',
    owner: 'Đưa sân lên hệ thống, quản lý lịch và doanh thu.',
  };
  const paintRole = () => {
    const role = registerForm.role.value;
    const owner = role === 'owner';
    $$('[data-role]', registerForm).forEach((btn) => {
      const active = btn.dataset.role === role;
      btn.setAttribute('aria-pressed', active);
      btn.classList.toggle('bg-white', active);
      btn.classList.toggle('text-primary-700', active);
      btn.classList.toggle('shadow-sm', active);
      btn.classList.toggle('text-foreground-600', !active);
    });
    $('[data-role-hint]', registerForm).textContent = hints[role];
    $('[data-owner-only]', registerForm).classList.toggle('hidden', !owner);
    $('[data-field="name"] [data-label]', registerForm).textContent = owner ? 'Người phụ trách' : 'Họ và tên';
    $('[data-field="name"] input', registerForm).placeholder = owner ? 'Nguyễn Văn Hùng' : 'Nguyễn Minh Quân';
    $('[data-field="email"] [data-label]', registerForm).textContent = owner ? 'Email đối tác' : 'Email';
    $('[data-field="email"] input', registerForm).placeholder = owner ? 'chusan@datsanbmt.vn' : 'ban@example.com';
    $('[data-agree-link]', registerForm).textContent = owner ? 'điều khoản đối tác' : 'điều khoản sử dụng';
    $('[data-agree-text]', registerForm).textContent = owner
      ? 'và chính sách hoa hồng của Đặt Sân BMT 24H.'
      : 'và chính sách bảo mật của Đặt Sân BMT 24H.';
    $('[data-submit-label]', registerForm).textContent = owner ? 'Tạo tài khoản chủ sân' : 'Tạo tài khoản';
  };
  $$('[data-role]', registerForm).forEach((btn) =>
    btn.addEventListener('click', () => {
      registerForm.role.value = btn.dataset.role;
      paintRole();
    }),
  );
  paintRole();

  registerForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const f = registerForm;
    const owner = f.role.value === 'owner';
    const email = f.email.value.trim().toLowerCase();
    const phone = f.phone.value.replace(/[^\d+]/g, '');
    const errors = {};
    if (owner && f.businessName.value.trim().length < 3) errors.businessName = 'Vui lòng nhập tên sân hoặc cơ sở của bạn.';
    if (f.name.value.trim().length < 2) errors.name = owner ? 'Vui lòng nhập họ tên người phụ trách.' : 'Vui lòng nhập họ tên đầy đủ.';
    if (!EMAIL_RE.test(email)) errors.email = 'Email chưa đúng định dạng.';
    if (!/^0\d{9,10}$/.test(phone) && !/^\+84\d{9,10}$/.test(phone)) errors.phone = 'Số điện thoại chưa đúng (ví dụ 0912 345 678).';
    if (f.password.value.length < 6) errors.password = 'Mật khẩu cần ít nhất 6 ký tự.';
    if (f.confirm.value !== f.password.value) errors.confirm = 'Mật khẩu nhập lại không khớp.';
    if (!f.agree.checked) errors.agree = owner ? 'Bạn cần đồng ý với điều khoản dành cho đối tác.' : 'Bạn cần đồng ý với điều khoản sử dụng.';
    setErrors(f, errors);
    showAlert(f, '[data-server-error]', '');
    if (Object.keys(errors).length) return;
    const btn = $('button[type=submit]', f);
    setBusy(btn, true, 'Đang tạo tài khoản...');
    try {
      const data = await api('auth', 'register', {
        role: f.role.value,
        businessName: f.businessName.value.trim(),
        name: f.name.value.trim(),
        phone,
        email,
        password: f.password.value,
      });
      window.location.href = data.redirect;
    } catch (error) {
      showAlert(f, '[data-server-error]', error.message);
      setBusy(btn, false);
    }
  });
}

// ---------------- Quên mật khẩu ----------------
const forgotForm = $('#forgot-form');
if (forgotForm) {
  const sent = $('#forgot-sent');
  forgotForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const email = forgotForm.email.value.trim();
    if (!EMAIL_RE.test(email)) {
      setErrors(forgotForm, { email: 'Email chưa đúng định dạng. Ví dụ: minhquan@gmail.com.' });
      return;
    }
    setErrors(forgotForm, {});
    const btn = $('button[type=submit]', forgotForm);
    setBusy(btn, true, 'Đang gửi...');
    try {
      const data = await api('auth', 'forgot', { email });
      $('[data-sent-email]', sent).textContent = email;
      const link = $('[data-demo-link]', sent);
      if (data.demoLink) {
        link.href = data.demoLink;
        link.classList.remove('hidden');
        link.classList.add('inline-block');
      } else {
        link.classList.add('hidden');
      }
      forgotForm.classList.add('hidden');
      sent.classList.remove('hidden');
    } catch (error) {
      setErrors(forgotForm, { email: error.message });
    } finally {
      setBusy(btn, false);
    }
  });
  $('[data-resend]', sent).addEventListener('click', () => {
    sent.classList.add('hidden');
    forgotForm.classList.remove('hidden');
  });
}

// ---------------- Đặt lại mật khẩu ----------------
const resetForm = $('#reset-form');
if (resetForm) {
  resetForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const errors = {};
    if (resetForm.password.value.length < 6) errors.password = 'Mật khẩu cần ít nhất 6 ký tự.';
    if (resetForm.confirm.value !== resetForm.password.value) errors.confirm = 'Mật khẩu nhập lại không khớp.';
    setErrors(resetForm, errors);
    showAlert(resetForm, '[data-server-error]', '');
    if (Object.keys(errors).length) return;
    const btn = $('button[type=submit]', resetForm);
    setBusy(btn, true, 'Đang lưu...');
    try {
      const data = await api('auth', 'reset', { token: PAGE.token, password: resetForm.password.value });
      showAlert(resetForm, '[data-server-ok]', 'Đã đổi mật khẩu. Đang chuyển tới trang đăng nhập...');
      setTimeout(() => (window.location.href = data.redirect), 1200);
    } catch (error) {
      showAlert(resetForm, '[data-server-error]', error.message);
      setBusy(btn, false);
    }
  });
}
