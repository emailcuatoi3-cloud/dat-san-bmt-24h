/** Trang ưu đãi: lọc, tìm kiếm, sao chép mã. */
import { $, PAGE, esc, url, copyText } from '../core/ui.js';
import { WEEKDAY_SHORT, describeConditions, describeDiscount, promotionState } from '../lib/promotions.js';

const items = (PAGE.promotions || []).filter((p) => ['active', 'upcoming'].includes(promotionState(p)));
const st = { filter: 'all', keyword: '', copied: '' };
const meta = {
  active: ['Đang áp dụng', 'bg-primary-50 text-primary-800', 'bg-primary-500'],
  upcoming: ['Sắp mở', 'bg-secondary-100 text-secondary-900', 'bg-secondary-500'],
  expired: ['Đã kết thúc', 'bg-background-200 text-foreground-600', 'bg-foreground-400'],
  paused: ['Tạm dừng', 'bg-accent-100 text-accent-900', 'bg-accent-500'],
};
const day = (iso) => iso.split('-').reverse().join('/');

function card(p) {
  const state = promotionState(p);
  const [label, tone, dot] = meta[state];
  const copied = st.copied === p.code;
  const headline = p.discountType === 'percent' ? `${p.discountValue}%` : `${Math.round(p.discountValue / 1000)}K`;
  return `<article class="flex h-full flex-col overflow-hidden rounded-lg border border-background-200 bg-white transition-shadow hover:shadow-lg">
    <div class="relative flex items-start justify-between gap-3 bg-foreground-950 px-4 py-3.5">
      <div class="min-w-0"><p class="text-[11px] font-semibold uppercase tracking-[0.14em] text-background-300">Mã ưu đãi</p>
        <p class="mt-1 font-heading text-3xl font-extrabold leading-none text-background-50">${headline}<span class="ml-1.5 align-middle text-xs font-semibold text-background-300">${p.discountType === 'percent' ? 'giảm giá' : 'đ'}</span></p>
        <p class="mt-1.5 text-[11px] leading-snug text-background-200">${esc(describeDiscount(p))}</p></div>
      <span class="inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${tone}"><span class="h-1.5 w-1.5 rounded-full ${dot}"></span>${label}</span>
    </div>
    <div class="flex flex-1 flex-col px-4 pb-4">
      <div class="-mx-4 border-t border-dashed border-background-300"></div>
      <button type="button" data-copy-code="${esc(p.code)}" title="Sao chép mã giảm giá" class="mt-3 flex w-full cursor-pointer items-center justify-between gap-2 rounded-md border border-dashed border-primary-300 bg-primary-50 px-3 py-2.5 transition-colors hover:border-primary-500">
        <span class="flex min-w-0 items-center gap-2"><i class="ri-coupon-3-line shrink-0 text-base text-primary-600" aria-hidden="true"></i><span class="truncate font-mono text-sm font-extrabold tracking-widest text-primary-800">${esc(p.code)}</span></span>
        <span class="flex shrink-0 items-center gap-1 text-[11px] font-semibold text-primary-700"><i class="${copied ? 'ri-check-line' : 'ri-file-copy-line'}" aria-hidden="true"></i>${copied ? 'Đã chép' : 'Sao chép'}</span>
      </button>
      <h3 class="mt-3 font-heading text-base font-bold leading-snug text-foreground-950">${esc(p.title)}</h3>
      ${p.description ? `<p class="mt-1.5 line-clamp-3 text-sm leading-relaxed text-foreground-600">${esc(p.description)}</p>` : ''}
      <ul class="mt-3 space-y-1.5 text-xs leading-relaxed text-foreground-600">
        <li class="flex items-start gap-2"><i class="ri-calendar-line mt-0.5 shrink-0 text-foreground-400" aria-hidden="true"></i><span>Áp dụng từ <strong class="font-semibold text-foreground-900">${day(p.startDate)}</strong> đến <strong class="font-semibold text-foreground-900">${day(p.endDate)}</strong></span></li>
        ${p.weekdays.length > 0 && p.weekdays.length < 7 ? `<li class="flex items-start gap-2"><i class="ri-calendar-event-line mt-0.5 shrink-0 text-foreground-400" aria-hidden="true"></i><span class="flex flex-wrap gap-1">${p.weekdays.map((d) => `<span class="rounded-sm bg-background-100 px-1.5 py-0.5 text-[10px] font-semibold text-foreground-700">${WEEKDAY_SHORT[d]}</span>`).join('')}</span></li>` : ''}
        ${p.startTime && p.endTime ? `<li class="flex items-start gap-2"><i class="ri-time-line mt-0.5 shrink-0 text-foreground-400" aria-hidden="true"></i><span>Khung giờ vàng ${p.startTime} – ${p.endTime}</span></li>` : ''}
        ${p.minOrder > 0 ? `<li class="flex items-start gap-2"><i class="ri-shopping-bag-3-line mt-0.5 shrink-0 text-foreground-400" aria-hidden="true"></i><span>Đơn tối thiểu ${p.minOrder.toLocaleString('vi-VN')}đ</span></li>` : ''}
        ${p.ownerName ? `<li class="flex items-start gap-2"><i class="ri-store-2-line mt-0.5 shrink-0 text-foreground-400" aria-hidden="true"></i><span class="truncate">Từ ${esc(p.ownerName)}</span></li>` : ''}
      </ul>
      <p class="mt-2.5 rounded-md bg-background-50 px-2.5 py-2 text-[11px] leading-relaxed text-foreground-500">${esc(describeConditions(p))}</p>
      <div class="mt-auto flex items-center gap-2 pt-4">
        <button type="button" data-copy-code="${esc(p.code)}" class="inline-flex flex-1 cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-md border border-background-300 bg-white px-3 py-2.5 text-xs font-semibold text-foreground-800 transition-colors hover:border-primary-400 hover:text-primary-700"><i class="ri-file-copy-line" aria-hidden="true"></i>Lấy mã</button>
        ${
          state === 'active'
            ? `<a href="${url(`/dat-san?promo=${encodeURIComponent(p.code)}`)}" class="inline-flex flex-1 cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-md bg-primary-500 px-3 py-2.5 text-xs font-bold text-white transition-colors hover:bg-primary-600">Đặt sân ngay<i class="ri-arrow-right-line" aria-hidden="true"></i></a>`
            : `<span class="inline-flex flex-1 cursor-not-allowed items-center justify-center gap-1.5 whitespace-nowrap rounded-md bg-background-200 px-3 py-2.5 text-xs font-bold text-foreground-500">${state === 'upcoming' ? 'Chưa tới ngày' : 'Tạm dừng'}</span>`
        }
      </div>
    </div>
  </article>`;
}

function render() {
  const countOf = (k) => (k === 'all' ? items.length : items.filter((p) => promotionState(p) === k).length);
  $('#promo-filters').innerHTML = [['all', 'Tất cả ưu đãi', 'ri-coupon-3-line'], ['active', 'Dùng được ngay', 'ri-flashlight-line'], ['upcoming', 'Sắp mở', 'ri-time-line']]
    .map(
      ([k, label, icon]) => `<button type="button" data-filter="${k}" class="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${st.filter === k ? 'bg-white text-foreground-950 shadow-sm' : 'text-foreground-600 hover:text-foreground-950'}"><i class="${icon}" aria-hidden="true"></i>${label}<span class="text-[10px] font-bold text-foreground-400">${countOf(k)}</span></button>`,
    )
    .join('');
  const text = st.keyword.trim().toLowerCase();
  const order = { active: 0, upcoming: 1 };
  const list = items
    .filter((p) => st.filter === 'all' || promotionState(p) === st.filter)
    .filter((p) => !text || `${p.code} ${p.title} ${p.ownerName}`.toLowerCase().includes(text))
    .sort((a, b) => order[promotionState(a)] - order[promotionState(b)] || (b.discountType === 'percent' ? b.discountValue : b.discountValue / 1000) - (a.discountType === 'percent' ? a.discountValue : a.discountValue / 1000));
  $('#promo-list').innerHTML = list.length
    ? `<div class="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">${list.map(card).join('')}</div>`
    : `<div class="mt-6 flex flex-col items-center justify-center gap-2 rounded-lg border border-background-200 bg-white px-6 py-16 text-center"><span class="flex h-12 w-12 items-center justify-center rounded-full bg-background-100 text-foreground-500"><i class="ri-coupon-3-line text-2xl" aria-hidden="true"></i></span>
      <p class="text-sm font-semibold text-foreground-950">${items.length === 0 ? 'Hiện chưa có mã giảm giá nào' : 'Không có mã khớp với bộ lọc'}</p>
      <p class="max-w-md text-xs leading-relaxed text-foreground-500">${items.length === 0 ? 'Các chủ sân đang chuẩn bị chương trình mới. Bạn vẫn có thể đặt sân với giá niêm yết và quay lại đây sau nhé.' : 'Thử xoá từ khoá tìm kiếm hoặc chuyển sang nhóm “Tất cả ưu đãi” để xem toàn bộ mã.'}</p>
      ${items.length ? '<button type="button" data-clear class="mt-1 cursor-pointer whitespace-nowrap rounded-md border border-background-300 px-4 py-2 text-xs font-semibold text-foreground-700 transition-colors hover:border-primary-400 hover:text-primary-700">Xoá bộ lọc</button>' : ''}</div>`;
}

document.addEventListener('click', async (event) => {
  const f = event.target.closest('[data-filter]');
  if (f) {
    st.filter = f.dataset.filter;
    return render();
  }
  if (event.target.closest('[data-clear]')) {
    st.filter = 'all';
    st.keyword = '';
    $('#promo-search').value = '';
    return render();
  }
  const c = event.target.closest('[data-copy-code]');
  if (c && (await copyText(c.dataset.copyCode))) {
    st.copied = c.dataset.copyCode;
    render();
    setTimeout(() => {
      st.copied = '';
      render();
    }, 1800);
  }
});
$('#promo-search').addEventListener('input', (e) => {
  st.keyword = e.target.value;
  render();
});
render();
