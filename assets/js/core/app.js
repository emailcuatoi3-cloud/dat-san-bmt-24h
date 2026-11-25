/**
 * Script chạy trên MỌI trang: thanh menu, giao diện sáng/tối, ngôn ngữ, đăng xuất.
 */
import { $, $$, APP, api, toast, url } from './ui.js';
import { applyLanguage, getStoredLanguage, initDomLanguage, persistLanguage, watchDomChanges } from '../i18n/domTranslator.js';

// ---------------- Giao diện sáng / tối ----------------
const THEME_KEY = 'bmt24h-theme';
const currentTheme = () => (document.documentElement.classList.contains('light') ? 'light' : 'dark');

function applyTheme(theme) {
  document.documentElement.classList.toggle('light', theme === 'light');
  document.documentElement.style.colorScheme = theme;
  $$('[data-theme-icon]').forEach((icon) => {
    icon.className = `${theme === 'light' ? 'ri-moon-clear-line' : 'ri-sun-line'} text-lg`;
  });
  $$('[data-theme-toggle]').forEach((btn) => {
    const label = theme === 'light' ? 'Chuyển sang chế độ tối' : 'Chuyển sang chế độ sáng';
    btn.setAttribute('aria-label', label);
    btn.title = label;
  });
  window.dispatchEvent(new CustomEvent('bmt24h-theme-change', { detail: theme }));
}

document.addEventListener('click', (event) => {
  if (!event.target.closest('[data-theme-toggle]')) return;
  const next = currentTheme() === 'light' ? 'dark' : 'light';
  try {
    localStorage.setItem(THEME_KEY, next);
  } catch {
    /* trình duyệt chặn localStorage */
  }
  applyTheme(next);
});
applyTheme(currentTheme());

// ---------------- Ngôn ngữ VI / EN ----------------
let language = getStoredLanguage();

function paintLanguageButtons() {
  $$('[data-lang-group]').forEach((group) => {
    const transparentMode = group.dataset.transparent === '1' && header && header.dataset.mode === 't';
    $$('[data-lang]', group).forEach((btn) => {
      const active = btn.dataset.lang === language;
      btn.setAttribute('aria-pressed', active ? 'true' : 'false');
      btn.classList.remove('bg-white', 'text-foreground-950', 'bg-primary-500', 'text-white', 'text-white/75', 'hover:text-white', 'text-foreground-600', 'hover:text-foreground-950');
      if (active) btn.classList.add(...(transparentMode ? ['bg-white', 'text-foreground-950'] : ['bg-primary-500', 'text-white']));
      else btn.classList.add(...(transparentMode ? ['text-white/75', 'hover:text-white'] : ['text-foreground-600', 'hover:text-foreground-950']));
    });
  });
}

document.addEventListener('click', (event) => {
  const btn = event.target.closest('[data-lang]');
  if (!btn) return;
  language = btn.dataset.lang === 'en' ? 'en' : 'vi';
  persistLanguage(language);
  applyLanguage(language);
  paintLanguageButtons();
});

initDomLanguage();
applyLanguage(language);
watchDomChanges();

// ---------------- Thanh menu ----------------
const header = $('#site-header');

/** Đổi bộ class trong suốt ↔ nền đặc cho mọi phần tử có data-tcls/data-scls */
function setHeaderMode(mode) {
  if (!header || header.dataset.mode === mode) return;
  header.dataset.mode = mode;
  const nodes = [header, ...$$('[data-tcls]', header)];
  nodes.forEach((node) => {
    if (!node.dataset.tcls) return;
    const remove = (mode === 't' ? node.dataset.scls : node.dataset.tcls).split(/\s+/).filter(Boolean);
    const add = (mode === 't' ? node.dataset.tcls : node.dataset.scls).split(/\s+/).filter(Boolean);
    node.classList.remove(...remove);
    node.classList.add(...add);
  });
  paintLanguageButtons();
}

if (header && header.dataset.transparent === '1') {
  header.dataset.mode = 't';
  const onScroll = () => {
    const mobileOpen = !$('#mobile-menu').classList.contains('hidden');
    setHeaderMode(window.scrollY > 24 || mobileOpen ? 's' : 't');
  };
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });
}
paintLanguageButtons();

// Các menu thả xuống trên thanh điều hướng (Ưu đãi, Tiện ích, Giới thiệu) - Hỗ trợ Hover và Click
let navCloseTimer = null;
let activeNavBtn = null;

function closeNavDropdowns() {
  $$('[data-nav-panel]').forEach((p) => p.classList.add('hidden'));
  $$('[data-nav-toggle]').forEach((b) => b.setAttribute('aria-expanded', 'false'));
  activeNavBtn = null;
}

function openNavDropdown(btn) {
  if (!btn) return;
  const id = btn.dataset.navToggle;
  const panel = document.getElementById(id);
  if (!panel) return;

  clearTimeout(navCloseTimer);

  // Ẩn các panel khác trước khi mở panel hiện tại
  $$('[data-nav-panel]').forEach((p) => {
    if (p !== panel) p.classList.add('hidden');
  });
  $$('[data-nav-toggle]').forEach((b) => {
    if (b !== btn) b.setAttribute('aria-expanded', 'false');
  });

  const rect = btn.getBoundingClientRect();
  const panelWidth = 288;
  const maxLeft = window.innerWidth - panelWidth - 12;
  const left = Math.min(Math.max(12, rect.left + rect.width / 2 - panelWidth / 2), Math.max(12, maxLeft));
  panel.style.top = `${rect.bottom + 6}px`;
  panel.style.left = `${left}px`;
  panel.classList.remove('hidden');
  btn.setAttribute('aria-expanded', 'true');
  activeNavBtn = btn;
}

function scheduleCloseNav(ms = 220) {
  clearTimeout(navCloseTimer);
  navCloseTimer = setTimeout(closeNavDropdowns, ms);
}

// Bắt sự kiện hover cho menu điều hướng
document.addEventListener('mouseover', (event) => {
  const btn = event.target.closest('[data-nav-toggle]');
  if (btn) {
    openNavDropdown(btn);
    return;
  }
  const panel = event.target.closest('[data-nav-panel]');
  if (panel) {
    clearTimeout(navCloseTimer);
    return;
  }
});

document.addEventListener('mouseout', (event) => {
  const btn = event.target.closest('[data-nav-toggle]');
  const panel = event.target.closest('[data-nav-panel]');
  const related = event.relatedTarget;
  if (btn) {
    const id = btn.dataset.navToggle;
    const targetPanel = document.getElementById(id);
    if (btn.contains(related) || (targetPanel && targetPanel.contains(related))) return;
    scheduleCloseNav(200);
  } else if (panel) {
    if (panel.contains(related) || (activeNavBtn && activeNavBtn.contains(related))) return;
    scheduleCloseNav(200);
  }
});

document.addEventListener('click', (event) => {
  const btn = event.target.closest('[data-nav-toggle]');
  if (btn) {
    // Nếu là thẻ liên kết (<a>) có đường dẫn cụ thể, cho phép trình duyệt chuyển trang trực tiếp
    if (btn.tagName === 'A' && btn.getAttribute('href') && !btn.getAttribute('href').startsWith('#')) {
      closeNavDropdowns();
      return;
    }
    event.stopPropagation();
    const id = btn.dataset.navToggle;
    const panel = document.getElementById(id);
    if (!panel) return;
    const isOpen = !panel.classList.contains('hidden');
    if (isOpen) {
      closeNavDropdowns();
    } else {
      openNavDropdown(btn);
    }
    return;
  }
  const openBot = event.target.closest('[data-open-chatbot]');
  if (openBot) {
    event.preventDefault();
    closeNavDropdowns();
    const mm = $('#mobile-menu');
    if (mm && !mm.classList.contains('hidden')) mm.classList.add('hidden');
    window.dispatchEvent(new CustomEvent('bmt24h-open-chatbot'));
    return;
  }
  if (!event.target.closest('[data-nav-panel]') && !event.target.closest('[data-nav-toggle]')) {
    closeNavDropdowns();
  }
});
window.addEventListener('scroll', closeNavDropdowns, { passive: true });
window.addEventListener('resize', closeNavDropdowns);

// Menu tài khoản và các dropdown đơn giản khác (Hỗ trợ cả Hover lẫn Click)
let ddCloseTimer = null;
document.addEventListener('mouseover', (event) => {
  const dd = event.target.closest('[data-dropdown]');
  if (dd) {
    clearTimeout(ddCloseTimer);
    const menu = $('[data-dropdown-menu]', dd);
    const toggle = $('[data-dropdown-toggle]', dd);
    if (menu) menu.classList.remove('hidden');
    if (toggle) toggle.setAttribute('aria-expanded', 'true');
  }
});

document.addEventListener('mouseout', (event) => {
  const dd = event.target.closest('[data-dropdown]');
  if (dd) {
    const related = event.relatedTarget;
    if (dd.contains(related)) return;
    clearTimeout(ddCloseTimer);
    ddCloseTimer = setTimeout(() => {
      const menu = $('[data-dropdown-menu]', dd);
      const toggle = $('[data-dropdown-toggle]', dd);
      if (menu) menu.classList.add('hidden');
      if (toggle) toggle.setAttribute('aria-expanded', 'false');
    }, 200);
  }
});

document.addEventListener('click', (event) => {
  const toggle = event.target.closest('[data-dropdown-toggle]');
  $$('[data-dropdown]').forEach((dd) => {
    const menu = $('[data-dropdown-menu]', dd);
    if (toggle && dd.contains(toggle)) {
      const open = menu.classList.toggle('hidden') === false;
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    } else if (!dd.contains(event.target)) {
      menu.classList.add('hidden');
    }
  });
});
document.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape') return;
  closeNavDropdowns();
  $$('[data-dropdown-menu]').forEach((menu) => menu.classList.add('hidden'));
});

// Menu di động
const mobileBtn = $('[data-mobile-toggle]');
if (mobileBtn) {
  const closeMobileMenuOnDesktop = () => {
    if (window.innerWidth < 1240) return;
    const menu = $('#mobile-menu');
    if (menu && !menu.classList.contains('hidden')) {
      menu.classList.add('hidden');
      mobileBtn.setAttribute('aria-expanded', 'false');
      const icon = mobileBtn.querySelector('i');
      if (icon) icon.className = 'ri-menu-line text-2xl';
      if (header && header.dataset.transparent === '1') setHeaderMode(window.scrollY > 24 ? 's' : 't');
    }
  };
  window.addEventListener('resize', closeMobileMenuOnDesktop);
  mobileBtn.addEventListener('click', () => {
    const menu = $('#mobile-menu');
    const open = menu.classList.toggle('hidden') === false;
    mobileBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
    mobileBtn.querySelector('i').className = open ? 'ri-close-line text-2xl' : 'ri-menu-line text-2xl';
    if (header && header.dataset.transparent === '1') setHeaderMode(open || window.scrollY > 24 ? 's' : 't');
  });
}

// Đăng xuất
document.addEventListener('click', async (event) => {
  const btn = event.target.closest('[data-logout]');
  if (!btn) return;
  btn.disabled = true;
  btn.lastChild.textContent = 'Đang đăng xuất...';
  try {
    // Đóng cửa sổ chat và làm sạch phiên chat của khách vãng lai khi đăng xuất
    localStorage.removeItem('bmt24h_chatbot_sessions_guest');
    localStorage.removeItem('bmt24h_chatbot_active_guest');
    localStorage.removeItem('bmt24h_chatbot_open_guest');
    Object.keys(localStorage).forEach((k) => {
      if (k.includes('_open')) localStorage.removeItem(k);
    });
  } catch (e) {}
  try {
    await api('auth', 'logout', {});
  } catch {
    /* vẫn đưa về trang chủ */
  }
  window.location.href = url('/');
});

// Nút "Quay lại"
document.addEventListener('click', (event) => {
  if (!event.target.closest('[data-back]')) return;
  if (window.history.length > 1) window.history.back();
  else window.location.href = url('/');
});

// Thông báo quyền truy cập: tự đóng sau 11 giây và xóa tham số khỏi URL
const notice = $('#access-notice');
if (notice) {
  const params = new URLSearchParams(window.location.search);
  params.delete('thong-bao');
  params.delete('vai-tro');
  const qs = params.toString();
  window.history.replaceState(null, '', window.location.pathname + (qs ? `?${qs}` : ''));
  const close = () => notice.remove();
  $('[data-close-notice]', notice).addEventListener('click', close);
  setTimeout(close, 11000);
}

// Cập nhật số sân yêu thích trên menu khi người dùng bấm tim
window.addEventListener('bmt24h-favorites', (event) => {
  const count = (event.detail || []).length;
  $$('[data-fav-count]').forEach((badge) => {
    badge.textContent = count > 9 ? '9+' : `${count}`;
    badge.classList.toggle('hidden', count === 0);
    badge.classList.toggle('flex', count > 0);
  });
});

// Ghi nhớ trang nội bộ xem dở (để sau khi đăng nhập quay lại đúng trang này)
try {
  const curPath = window.location.pathname;
  const authRoutes = ['/dang-nhap', '/dang-ky', '/dang-ky-chu-san', '/quen-mat-khau', '/dat-lai-mat-khau', '/dang-xuat'];
  if (!authRoutes.some((r) => curPath.includes(r))) {
    const base = APP.base || '';
    let relPath = window.location.pathname;
    if (base && relPath.startsWith(base)) {
      relPath = relPath.slice(base.length);
      if (!relPath.startsWith('/')) relPath = '/' + relPath;
    }
    const fullPrev = (relPath || '/') + (window.location.search || '');
    if (fullPrev && fullPrev !== '/') {
      sessionStorage.setItem('bmt24h_auth_return_url', fullPrev);
    }
  }
} catch (e) {}

// Đồng bộ chiều cao thanh Ghost Login (khi quản trị viên đang giả lập tài khoản)
const ghostBanner = document.getElementById('ghost-login-banner');
if (ghostBanner) {
  const syncGhostH = () => {
    const h = ghostBanner.offsetHeight || 44;
    document.documentElement.style.setProperty('--ghost-banner-height', `${h}px`);
    const siteH = document.getElementById('site-header');
    if (siteH) siteH.style.top = `${h}px`;
    const sidebars = document.querySelectorAll('#owner-sidebar');
    sidebars.forEach((sb) => { sb.style.top = `${h}px`; });
  };
  syncGhostH();
  window.addEventListener('resize', syncGhostH);
}

export { toast };
