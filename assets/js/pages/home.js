/** Trang chủ: vẽ thẻ sân nổi bật, accordion câu hỏi thường gặp, form tìm sân. */
import { $, $$, PAGE } from '../core/ui.js';
import { bindFavoriteButtons, courtCard } from '../core/components.js';

// Thẻ sân nổi bật
$$('[data-featured]').forEach((grid) => {
  const list = (PAGE.featured && PAGE.featured[grid.dataset.featured]) || [];
  if (list.length < 4) grid.classList.replace('lg:grid-cols-4', 'lg:grid-cols-3');
  grid.innerHTML = list.map(courtCard).join('');
  bindFavoriteButtons(grid);
});

// Câu hỏi thường gặp: mở một câu tại một thời điểm
const faqItems = $$('[data-faq]');
function paintFaq() {
  faqItems.forEach((item) => {
    const open = item.hasAttribute('data-open');
    $('button', item).setAttribute('aria-expanded', open ? 'true' : 'false');
    $('[data-faq-body]', item).classList.toggle('hidden', !open);
    const icon = $('[data-faq-icon]', item);
    icon.className = `flex h-7 w-7 shrink-0 items-center justify-center rounded-full transition-colors ${open ? 'bg-primary-500 text-white' : 'bg-background-200 text-foreground-600'
      }`;
    icon.innerHTML = `<i class="${open ? 'ri-subtract-line' : 'ri-add-line'}" aria-hidden="true"></i>`;
  });
}
faqItems.forEach((item) =>
  $('button', item).addEventListener('click', () => {
    const wasOpen = item.hasAttribute('data-open');
    faqItems.forEach((other) => other.removeAttribute('data-open'));
    if (!wasOpen) item.setAttribute('data-open', '');
    paintFaq();
  }),
);
paintFaq();

// Form tìm sân: bỏ tham số rỗng cho URL gọn
const heroForm = $('#hero-search');
if (heroForm) {
  heroForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const params = new URLSearchParams();
    new FormData(heroForm).forEach((value, key) => {
      if (value) params.set(key, value);
    });
    const qs = params.toString();
    window.location.href = heroForm.action + (qs ? `?${qs}` : '');
  });
}
