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
      const urlParams = new URLSearchParams(window.location.search);
      let targetRedirect = urlParams.get('redirect') || (PAGE.redirect && PAGE.redirect !== '/' ? PAGE.redirect : '');
      if (!targetRedirect) {
        try {
          const stored = sessionStorage.getItem('bmt24h_auth_return_url');
          if (stored && stored !== '/') targetRedirect = stored;
        } catch (e) {}
      }
      if (!targetRedirect && document.referrer) {
        try {
          const ref = new URL(document.referrer);
          if (ref.origin === window.location.origin) {
            let refPath = ref.pathname;
            const base = (window.APP && window.APP.base) || '';
            if (base && refPath.startsWith(base)) {
              refPath = refPath.slice(base.length);
              if (!refPath.startsWith('/')) refPath = '/' + refPath;
            }
            refPath = (refPath || '/') + (ref.search || '');
            const authRoutes = ['/dang-nhap', '/dang-ky', '/dang-ky-chu-san', '/quen-mat-khau', '/dat-lai-mat-khau', '/dang-xuat'];
            if (!authRoutes.some((r) => refPath.includes(r)) && refPath !== '/') {
              targetRedirect = refPath;
            }
          }
        } catch (e) {}
      }
      const data = await api('auth', 'login', { email, password, redirect: targetRedirect || '' });
      try { sessionStorage.removeItem('bmt24h_auth_return_url'); } catch (e) {}
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
    $('[data-submit-label]', registerForm).textContent = owner ? 'Gửi đăng ký chủ sân' : 'Tạo tài khoản';
  };
  $$('[data-role]', registerForm).forEach((btn) =>
    btn.addEventListener('click', () => {
      registerForm.role.value = btn.dataset.role;
      paintRole();
    }),
  );
  paintRole();

  // Quản lý ảnh sân đối tác khi đăng ký
  let regOwnerFiles = [];
  const regDropzone = registerForm.querySelector('[data-dropzone]');
  const regImgInput = registerForm.querySelector('[data-images-input]');
  const regPreviewWrapper = registerForm.querySelector('[data-preview-wrapper]');
  const regPreviewGrid = registerForm.querySelector('[data-images-preview]');
  const regCounter = registerForm.querySelector('[data-img-counter]');
  const regClearBtn = registerForm.querySelector('[data-clear-all-images]');

  const renderRegPreviews = () => {
    if (!regPreviewWrapper || !regPreviewGrid) return;
    if (!regOwnerFiles.length) {
      regPreviewWrapper.classList.add('hidden');
      regPreviewGrid.innerHTML = '';
      return;
    }
    regPreviewWrapper.classList.remove('hidden');
    if (regCounter) regCounter.textContent = `Đã chọn ${regOwnerFiles.length} / 10 ảnh sân`;
    regPreviewGrid.innerHTML = regOwnerFiles.map((file, idx) => `
      <div class="group relative flex flex-col overflow-hidden rounded-lg border border-background-200 bg-white shadow-sm">
        <div class="relative aspect-video w-full overflow-hidden bg-background-100">
          <img src="${URL.createObjectURL(file)}" alt="${file.name}" class="h-full w-full object-cover">
          ${idx === 0 ? '<span class="absolute left-1.5 top-1.5 rounded bg-primary-600/90 px-1.5 py-0.5 text-[10px] font-bold text-white shadow-sm">Ảnh chính</span>' : ''}
          <button type="button" data-remove-reg-img="${idx}" class="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white hover:bg-accent-600" title="Xóa ảnh"><i class="ri-close-line text-sm"></i></button>
        </div>
        <div class="p-1.5 text-left"><p class="truncate text-xs font-semibold text-foreground-900">${file.name}</p></div>
      </div>
    `).join('');
  };

  if (regDropzone && regImgInput) {
    regDropzone.addEventListener('click', () => regImgInput.click());
    regImgInput.addEventListener('change', () => {
      Array.from(regImgInput.files || []).forEach((f) => {
        if (f.type.startsWith('image/') && f.size <= 8 * 1024 * 1024 && regOwnerFiles.length < 10) {
          if (!regOwnerFiles.some((x) => x.name === f.name && x.size === f.size)) regOwnerFiles.push(f);
        }
      });
      regImgInput.value = '';
      renderRegPreviews();
    });
    if (regPreviewGrid) {
      regPreviewGrid.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-remove-reg-img]');
        if (!btn) return;
        const idx = parseInt(btn.dataset.removeRegImg, 10);
        if (!isNaN(idx)) { regOwnerFiles.splice(idx, 1); renderRegPreviews(); }
      });
    }
    if (regClearBtn) {
      regClearBtn.addEventListener('click', () => { regOwnerFiles = []; renderRegPreviews(); });
    }
  }

  registerForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const f = registerForm;
    const owner = f.role.value === 'owner';
    const email = f.email.value.trim().toLowerCase();
    const phone = f.phone.value.replace(/[^\d+]/g, '');
    const errors = {};
    if (owner && f.businessName.value.trim().length < 3) errors.businessName = 'Vui lòng nhập tên sân hoặc cơ sở của bạn.';
    if (owner && f.address.value.trim().length < 8) errors.address = 'Vui lòng nhập địa chỉ sân đầy đủ (số nhà, đường, phường).';
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
      const urlParams = new URLSearchParams(window.location.search);
      let targetRedirect = urlParams.get('redirect') || (PAGE.redirect && PAGE.redirect !== '/' ? PAGE.redirect : '');
      let payload;
      if (owner && regOwnerFiles.length > 0) {
        const formData = new FormData();
        formData.append('role', f.role.value);
        formData.append('businessName', f.businessName.value.trim());
        formData.append('address', f.address.value.trim());
        formData.append('sports', f.sports.value);
        formData.append('courtCount', Number(f.courtCount.value) || 1);
        formData.append('note', f.note.value.trim());
        formData.append('name', f.name.value.trim());
        formData.append('phone', phone);
        formData.append('email', email);
        formData.append('password', f.password.value);
        formData.append('redirect', targetRedirect || '');
        regOwnerFiles.forEach((file) => formData.append('court_images[]', file));
        payload = formData;
      } else {
        payload = {
          role: f.role.value,
          businessName: f.businessName.value.trim(),
          address: f.address.value.trim(),
          sports: f.sports.value,
          courtCount: Number(f.courtCount.value) || 1,
          note: f.note.value.trim(),
          name: f.name.value.trim(),
          phone,
          email,
          password: f.password.value,
          redirect: targetRedirect || '',
        };
      }
      const data = await api('auth', 'register', payload);
      try { sessionStorage.removeItem('bmt24h_auth_return_url'); } catch (e) {}
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