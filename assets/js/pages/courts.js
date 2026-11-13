/** Trang Tìm sân: bộ lọc, sắp xếp, phân trang (toàn bộ xử lý tại trình duyệt). */
import { $, $$, PAGE, esc, cx } from '../core/ui.js';
import { bindFavoriteButtons, courtCard } from '../core/components.js';
import { formatLongDate } from '../lib/format.js';

const PAGE_SIZE = 6;
const courts = PAGE.courts || [];
const areas = PAGE.areas || [];
const priceRanges = PAGE.priceRanges || [];
const params = PAGE.params || {};

const state = {
  filters: { sport: params.sport || 'all', fieldType: 'all', area: params.area || '', priceId: 'all', activeOnly: true },
  keyword: params.q || '',
  sort: 'featured',
  page: 1,
  openSport: params.sport && params.sport !== 'all' ? params.sport : null,
};

const counts = {
  football: courts.filter((c) => c.sport === 'football').length,
  badminton: courts.filter((c) => c.sport === 'badminton').length,
  active: courts.filter((c) => c.status === 'active').length,
  total: courts.length,
};

const sportChoices = [
  { value: 'all', label: 'Tất cả loại sân', shortLabel: 'tất cả sân', icon: 'ri-apps-2-line' },
  { value: 'football', label: 'Sân bóng đá', shortLabel: 'sân bóng đá', icon: 'ri-football-line' },
  { value: 'badminton', label: 'Sân cầu lông', shortLabel: 'sân cầu lông', icon: 'ri-ping-pong-line' },
];
const subTypesFor = (sport) => {
  const list = [];
  courts.filter((c) => c.sport === sport).forEach((c) => c.fieldTypes.forEach((t) => !list.includes(t) && list.push(t)));
  return list;
};
const subTypeCount = (sport, type) => courts.filter((c) => c.sport === sport && c.fieldTypes.includes(type)).length;
const sportCount = (v) => (v === 'football' ? counts.football : v === 'badminton' ? counts.badminton : counts.total);

function results() {
  const f = state.filters;
  const range = priceRanges.find((r) => r.id === f.priceId) || priceRanges[0];
  const kw = state.keyword.trim().toLowerCase();
  return courts
    .filter((c) => {
      if (f.sport !== 'all' && c.sport !== f.sport) return false;
      if (f.fieldType !== 'all' && !c.fieldTypes.includes(f.fieldType)) return false;
      if (f.area && c.area !== f.area) return false;
      if (c.pricePerHour < range.min || c.pricePerHour > range.max) return false;
      if (f.activeOnly && c.status !== 'active') return false;
      if (kw && !`${c.name} ${c.address} ${c.area} ${c.sportLabel}`.toLowerCase().includes(kw)) return false;
      return true;
    })
    .sort((a, b) => {
      if (state.sort === 'price-asc') return a.pricePerHour - b.pricePerHour;
      if (state.sort === 'price-desc') return b.pricePerHour - a.pricePerHour;
      if (state.sort === 'rating') return b.rating - a.rating;
      return Number(b.featured) - Number(a.featured) || b.rating - a.rating;
    });
}

function filterPanelHtml() {
  const f = state.filters;
  return `
  <div class="flex flex-col gap-6">
    <div class="flex items-center justify-between">
      <h2 class="font-heading text-base font-bold text-foreground-950">Bộ lọc sân</h2>
      <button type="button" data-reset class="whitespace-nowrap text-xs font-semibold text-primary-600 transition-colors hover:text-primary-700">Xóa tất cả</button>
    </div>
    <div>
      <p class="mb-2.5 text-[11px] font-semibold uppercase tracking-wide text-foreground-500">Loại sân</p>
      <div class="flex flex-col gap-1.5">
        ${sportChoices
      .map((ch) => {
        const checked = f.sport === ch.value;
        const expandable = ch.value !== 'all';
        const expanded = expandable && state.openSport === ch.value;
        return `<div>
              <div class="${cx('flex items-center rounded-md border transition-colors', checked ? 'border-primary-300 bg-primary-50 font-semibold text-primary-800' : 'border-background-200 bg-white text-foreground-700 hover:border-primary-200')}">
                <button type="button" data-sport="${ch.value}" class="flex flex-1 cursor-pointer items-center justify-between gap-2 px-3 py-2.5 text-left text-sm">
                  <span class="flex items-center gap-2"><i class="${ch.icon} text-base ${checked ? 'text-primary-600' : 'text-foreground-400'}" aria-hidden="true"></i>${ch.label}</span>
                  <span class="text-xs ${checked ? 'text-primary-700' : 'text-foreground-400'}">${sportCount(ch.value)}</span>
                </button>
                ${expandable ? `<button type="button" data-expand="${ch.value}" aria-label="Mở rộng ${ch.label}" class="flex h-9 w-8 cursor-pointer items-center justify-center rounded-r-md text-foreground-400 transition-colors hover:text-primary-600"><i class="ri-arrow-down-s-line text-base transition-transform ${expanded ? 'rotate-180' : ''}" aria-hidden="true"></i></button>` : ''}
              </div>
              ${expanded
            ? `<div class="ml-3 mt-1.5 flex flex-col gap-1 border-l border-background-200 pl-3">
                  <button type="button" data-field-type="all" data-for="${ch.value}" class="${cx('flex cursor-pointer items-center justify-between rounded-md px-2.5 py-2 text-left text-[13px] transition-colors', f.fieldType === 'all' ? 'bg-secondary-100 font-semibold text-secondary-900' : 'text-foreground-600 hover:bg-background-100 hover:text-foreground-900')}"><span>Tất cả ${ch.shortLabel}</span><span class="text-[11px] opacity-70">${sportCount(ch.value)}</span></button>
                  ${subTypesFor(ch.value)
              .map((type) => {
                const sub = f.fieldType === type;
                return `<button type="button" data-field-type="${esc(type)}" data-for="${ch.value}" class="${cx('flex cursor-pointer items-center justify-between rounded-md px-2.5 py-2 text-left text-[13px] transition-colors', sub ? 'bg-primary-100 font-semibold text-primary-800' : 'text-foreground-600 hover:bg-background-100 hover:text-foreground-900')}"><span class="flex items-center gap-2"><span class="h-1.5 w-1.5 rounded-full ${sub ? 'bg-primary-600' : 'bg-foreground-300'}"></span>${esc(type)}</span><span class="text-[11px] opacity-70">${subTypeCount(ch.value, type)}</span></button>`;
              })
              .join('')}
                </div>`
            : ''
          }
            </div>`;
      })
      .join('')}
      </div>
    </div>
    <div>
      <label class="mb-2.5 block text-[11px] font-semibold uppercase tracking-wide text-foreground-500">Khu vực</label>
      <div class="relative">
        <select data-area class="w-full cursor-pointer appearance-none rounded-md border border-background-300 bg-white px-3 py-2.5 pr-9 text-sm text-foreground-800 focus:border-primary-400 focus:outline-none">
          <option value="">Tất cả khu vực</option>
          ${areas.map((a) => `<option value="${esc(a)}" ${f.area === a ? 'selected' : ''}>Phường ${esc(a)}</option>`).join('')}
        </select>
        <i class="ri-arrow-down-s-line pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-foreground-400" aria-hidden="true"></i>
      </div>
    </div>
    <div>
      <p class="mb-2.5 text-[11px] font-semibold uppercase tracking-wide text-foreground-500">Khoảng giá mỗi giờ</p>
      <div class="flex flex-col gap-1">
        ${priceRanges
      .map((r) => {
        const checked = f.priceId === r.id;
        return `<button type="button" data-price="${r.id}" class="flex cursor-pointer items-center gap-2.5 rounded-md px-1 py-1.5 text-left text-sm text-foreground-700 hover:text-foreground-950">
              <span class="flex h-4 w-4 items-center justify-center rounded-full border ${checked ? 'border-primary-500 bg-primary-500' : 'border-background-400 bg-white'}">${checked ? '<span class="h-1.5 w-1.5 rounded-full bg-white"></span>' : ''}</span>${esc(r.label)}</button>`;
      })
      .join('')}
      </div>
    </div>
    <div>
      <p class="mb-2.5 text-[11px] font-semibold uppercase tracking-wide text-foreground-500">Trạng thái hoạt động</p>
      <label class="flex cursor-pointer items-start gap-2.5 rounded-md border border-background-200 bg-background-50 px-3 py-2.5">
        <input type="checkbox" data-active ${f.activeOnly ? 'checked' : ''} class="mt-0.5 h-4 w-4 cursor-pointer accent-primary-500">
        <span class="text-sm text-foreground-700">Chỉ hiển thị sân đang hoạt động<span class="mt-0.5 block text-xs text-foreground-500">${counts.active} sân sẵn sàng nhận đặt</span></span>
      </label>
    </div>
    <div class="rounded-lg border border-accent-200 bg-accent-50 p-4">
      <div class="flex items-center gap-2"><i class="ri-lightbulb-flash-line text-accent-700" aria-hidden="true"></i><p class="text-sm font-semibold text-accent-900">Mẹo đặt sân</p></div>
      <p class="mt-1.5 text-xs leading-relaxed text-accent-900/80">Khung giờ 17:00 - 20:00 thường kín sớm. Bạn nên đặt trước 1 - 2 ngày để có sân đẹp.</p>
    </div>
  </div>`;
}

function render() {
  const list = results();
  const totalPages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
  state.page = Math.min(state.page, totalPages);
  const paged = list.slice((state.page - 1) * PAGE_SIZE, state.page * PAGE_SIZE);
  const f = state.filters;

  $$('[data-filter-panel]').forEach((panel) => (panel.innerHTML = filterPanelHtml()));

  $('#result-summary').innerHTML = `Tìm thấy <span class="font-semibold text-foreground-950">${list.length}</span> sân phù hợp${f.fieldType !== 'all' ? `<span class="text-foreground-500"> · ${esc(f.fieldType)}</span>` : ''
    }${f.area ? `<span class="text-foreground-500"> tại P. ${esc(f.area)}</span>` : ''}`;

  const active = (f.sport !== 'all') + (f.fieldType !== 'all') + Boolean(f.area) + (f.priceId !== 'all') + f.activeOnly;
  $('#filter-count').innerHTML = active
    ? `<span class="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary-500 px-1 text-[11px] font-bold text-white">${active}</span>`
    : '';
  $('#drawer-apply').textContent = `Xem ${list.length} sân phù hợp`;

  $('#results').innerHTML = paged.length
    ? `<div class="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-2">${paged.map(courtCard).join('')}</div>`
    : `<div class="mt-5 flex flex-col items-center justify-center rounded-lg border border-dashed border-background-300 bg-white px-6 py-16 text-center">
        <span class="flex h-14 w-14 items-center justify-center rounded-full bg-background-100 text-foreground-400"><i class="ri-search-eye-line text-2xl" aria-hidden="true"></i></span>
        <h3 class="mt-4 font-heading text-base font-bold text-foreground-950">Không tìm thấy sân phù hợp</h3>
        <p class="mt-2 max-w-sm text-sm text-foreground-500">Thử mở rộng khoảng giá, chọn khu vực khác hoặc xóa từ khóa tìm kiếm để xem thêm sân tại Buôn Ma Thuột.</p>
        <button type="button" data-reset class="mt-5 whitespace-nowrap rounded-md bg-primary-500 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-600">Xóa bộ lọc</button>
      </div>`;

  const btnBase = 'flex h-9 w-9 items-center justify-center rounded-md border border-background-300 bg-white text-foreground-700 transition-colors hover:border-primary-400 disabled:cursor-not-allowed disabled:opacity-40';
  $('#pager').innerHTML =
    totalPages > 1
      ? `<button type="button" data-page="${state.page - 1}" ${state.page === 1 ? 'disabled' : ''} class="${btnBase}" aria-label="Trang trước"><i class="ri-arrow-left-s-line" aria-hidden="true"></i></button>
        ${Array.from({ length: totalPages }, (_, i) => i + 1)
        .map(
          (n) =>
            `<button type="button" data-page="${n}" class="h-9 w-9 rounded-md border text-sm font-semibold transition-colors ${n === state.page ? 'border-primary-500 bg-primary-500 text-white' : 'border-background-300 bg-white text-foreground-700 hover:border-primary-400'
            }">${n}</button>`,
        )
        .join('')}
        <button type="button" data-page="${state.page + 1}" ${state.page === totalPages ? 'disabled' : ''} class="${btnBase}" aria-label="Trang sau"><i class="ri-arrow-right-s-line" aria-hidden="true"></i></button>`
      : '';
}

function update(next) {
  Object.assign(state.filters, next);
  state.page = 1;
  render();
}
function reset() {
  state.filters = { sport: 'all', fieldType: 'all', area: '', priceId: 'all', activeOnly: false };
  state.keyword = '';
  state.openSport = null;
  $('#keyword-form').keyword.value = '';
  state.page = 1;
  render();
}

// ---- Sự kiện ----
document.addEventListener('click', (event) => {
  const t = event.target;
  const sportBtn = t.closest('[data-sport]');
  if (sportBtn) {
    const v = sportBtn.dataset.sport;
    if (v === 'all') {
      state.openSport = null;
      return update({ sport: 'all', fieldType: 'all' });
    }
    if (state.filters.sport === v) {
      state.openSport = state.openSport === v ? null : v;
      return render();
    }
    state.openSport = v;
    return update({ sport: v, fieldType: 'all' });
  }
  const exp = t.closest('[data-expand]');
  if (exp) {
    state.openSport = state.openSport === exp.dataset.expand ? null : exp.dataset.expand;
    return render();
  }
  const ft = t.closest('[data-field-type]');
  if (ft) return update({ fieldType: ft.dataset.fieldType });
  const price = t.closest('[data-price]');
  if (price) return update({ priceId: price.dataset.price });
  if (t.closest('[data-reset]')) return reset();
  const pg = t.closest('[data-page]');
  if (pg && !pg.disabled) {
    state.page = Number(pg.dataset.page);
    render();
    window.scrollTo({ top: $('#results').getBoundingClientRect().top + window.scrollY - 160, behavior: 'smooth' });
    return;
  }
  if (t.closest('#open-drawer')) return $('#drawer').classList.remove('hidden');
  if (t.closest('[data-close-drawer]')) return $('#drawer').classList.add('hidden');
});
document.addEventListener('change', (event) => {
  if (event.target.matches('[data-area]')) update({ area: event.target.value });
  if (event.target.matches('[data-active]')) update({ activeOnly: event.target.checked });
  if (event.target.id === 'sort') {
    state.sort = event.target.value;
    state.page = 1;
    render();
  }
});

const kwForm = $('#keyword-form');
kwForm.keyword.value = state.keyword;
kwForm.keyword.addEventListener('input', () => {
  state.keyword = kwForm.keyword.value;
  state.page = 1;
  render();
});
kwForm.addEventListener('submit', (event) => {
  event.preventDefault();
  state.page = 1;
  render();
});

if (params.time || params.date) {
  $('#slot-hint').innerHTML = `<div class="mb-4 flex items-center gap-2 rounded-md border border-secondary-200 bg-secondary-50 px-3.5 py-2.5 text-xs text-secondary-900"><i class="ri-calendar-check-line" aria-hidden="true"></i><span>Đang tìm sân trống${params.time ? ` khung giờ <span class="font-semibold">${esc(params.time)}</span>` : ''
    }${params.date ? ` ngày <span class="font-semibold">${esc(formatLongDate(params.date))}</span>` : ''}</span></div>`;
}

bindFavoriteButtons($('#results'));
render();
