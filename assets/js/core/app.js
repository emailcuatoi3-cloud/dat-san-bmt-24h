/**
 * Script chạy trên MỌI trang: thanh menu, giao diện sáng/tối, ngôn ngữ, đăng xuất.
 */
import { $, $$, api, toast, url } from './ui.js';
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

// Menu "Khám phá" (định vị cố định để không bị cắt bởi thanh cuộn ngang)
const exploreBtn = $('[data-explore-toggle]');
const exploreMenu = $('#explore-menu');
function closeExplore() {
  if (!exploreMenu) return;
  exploreMenu.classList.add('hidden');
  exploreBtn && exploreBtn.setAttribute('aria-expanded', 'false');
}
if (exploreBtn && exploreMenu) {
  exploreBtn.addEventListener('click', (event) => {
    event.stopPropagation();
    if (!exploreMenu.classList.contains('hidden')) return closeExplore();
    const rect = exploreBtn.getBoundingClientRect();
    const panelWidth = 288;
    const maxLeft = window.innerWidth - panelWidth - 12;
    const left = Math.min(Math.max(12, rect.left + rect.width / 2 - panelWidth / 2), Math.max(12, maxLeft));
    exploreMenu.style.top = `${rect.bottom + 10}px`;
    exploreMenu.style.left = `${left}px`;
    exploreMenu.classList.remove('hidden');
    exploreBtn.setAttribute('aria-expanded', 'true');
  });
  window.addEventListener('scroll', closeExplore, { passive: true });
  window.addEventListener('resize', closeExplore);
}

// Menu tài khoản và các dropdown đơn giản khác
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
  if (exploreMenu && !exploreMenu.contains(event.target) && !event.target.closest('[data-explore-toggle]')) closeExplore();
});
document.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape') return;
  closeExplore();
  $$('[data-dropdown-menu]').forEach((menu) => menu.classList.add('hidden'));
});

// Menu di động
const mobileBtn = $('[data-mobile-toggle]');
if (mobileBtn) {
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

export { toast };
