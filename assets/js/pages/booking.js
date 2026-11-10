/**
 * ĐẶT SÂN 3 BƯỚC
 *  1. Chọn sân + ngày + thời lượng + khung giờ (lưới giờ có giá từng ô)
 *  2. Thông tin người đặt + dịch vụ thêm + mã giảm giá + đồng ý chính sách
 *  3. Giữ sân 10 phút, quét VietQR, "Tôi đã chuyển khoản" → hệ thống tự đối soát → mở vé QR
 */
import { $, $$, PAGE, APP, api, esc, url, cx, formatVnd, copyText } from '../core/ui.js';
import { ticketData, ticketQrUrl, downloadTicket, openShareSheet } from '../core/ticket.js';
import { buildDaySlots, calcCourtPriceForRange, getPriceBands, lowestPrice, priceBandAt } from '../lib/courtPricing.js';
import { DURATION_OPTIONS, calcDeposit, endTimeOf, extraServices, formatCountdown, formatTimeRange, remainingHoldSeconds, slotsInRange } from '../lib/booking.js';
import { formatLongDate, getUpcomingDates, isPastSlot, isTodayIso, toIsoDate } from '../lib/format.js';
import { describeDiscount, normalizePromoCode } from '../lib/promotions.js';
import { rememberBookingCode } from '../lib/myBookings.js';
import { bankAccount, buildVietQrUrl, AUTO_CONFIRM_SECONDS, HOTLINE, HOLD_MINUTES } from '../lib/payment.js';
import { formatCancelDeadline, isBeforeCancelCutoff, CANCEL_CUTOFF_HOURS } from '../lib/cancelPolicy.js';

const courts = PAGE.courts || [];
const preset = PAGE.preset || {};
const todayIso = toIsoDate(new Date());
const dateOptions = getUpcomingDates(14);
const presetDate = preset.date && preset.date >= todayIso ? preset.date : todayIso;

const S = {
  step: 1,
  courtSlug: courts.some((c) => c.slug === preset.slug) ? preset.slug : '',
  date: presetDate,
  duration: 60,
  startSlot: preset.slot && !isPastSlot(presetDate, preset.slot) ? preset.slot : '',
  filters: { keyword: '', sport: 'all', area: '', priceId: 'all', sort: 'popular' },
  availability: { occupied: {}, blocked: {}, loading: true },
  form: { name: '', phone: '', email: '', note: '', ...(PAGE.contact || {}) },
  extras: [],
  agree: false,
  fieldErrors: {},
  error: '',
  promoCode: normalizePromoCode(preset.promo || ''),
  promoError: '',
  applied: null, // { promotion, discount }
  depositMode: 'deposit',
  booking: null,
  busy: false,
};
let holdTimer = 0;

const court = () => courts.find((c) => c.slug === S.courtSlug);
const extrasTotal = () => S.extras.reduce((s, id) => s + (extraServices.find((x) => x.id === id)?.price || 0), 0);
const courtPrice = () => (court() && S.startSlot ? calcCourtPriceForRange(court(), S.startSlot, S.duration) : 0);
const subtotal = () => courtPrice() + extrasTotal();
const discount = () => (S.applied ? S.applied.discount : 0);
const total = () => Math.max(0, subtotal() - discount());
const unavailable = () => {
  const c = court();
  if (!c) return [];
  return [...(S.availability.occupied[c.id] || []), ...(S.availability.blocked[`${c.id}:${S.date}`] || [])];
};

// ======================= LỊCH TRỐNG =======================
async function loadAvailability() {
  S.availability.loading = true;
  renderSlots();
  try {
    const data = await api('booking', 'availability', { date: S.date }, 'GET');
    S.availability = { occupied: data.occupied || {}, blocked: data.blocked || {}, loading: false };
  } catch {
    S.availability = { occupied: {}, blocked: {}, loading: false };
  }
  // Khung đã chọn không còn hợp lệ → bỏ chọn
  if (S.startSlot && slotState(S.startSlot) !== 'free') {
    S.startSlot = '';
    S.error = 'Khung giờ vừa chọn không còn trống. Vui lòng chọn khung giờ khác.';
    renderError();
  }
  renderSlots();
  renderSummary();
}

function slotState(slot) {
  const c = court();
  if (isPastSlot(S.date, slot)) return 'past';
  if (!c) return 'free';
  if (endTimeOf(slot, S.duration) > c.closeTime) return 'booked';
  const taken = unavailable();
  return slotsInRange(slot, S.duration).some((s) => taken.includes(s)) ? 'booked' : 'free';
}

// ======================= KHUNG CHUNG =======================
function renderSteps() {
  const steps = ['Chọn sân & giờ', 'Thông tin', 'Cọc & nhận vé'];
  $('#steps').innerHTML = `<div class="rounded-lg border border-background-200 bg-white p-4 md:p-5">
    <div class="flex items-center gap-2.5 md:hidden">
      <span class="whitespace-nowrap text-xs font-semibold text-primary-600">Bước ${S.step}/3</span>
      <div class="h-1.5 flex-1 overflow-hidden rounded-full bg-background-200"><div class="h-full rounded-full bg-primary-500 transition-all" style="width:${(S.step / 3) * 100}%"></div></div>
      <span class="whitespace-nowrap text-xs font-medium text-foreground-600">${steps[S.step - 1]}</span>
    </div>
    <ol class="hidden items-center gap-2 md:flex">${steps
      .map((label, i) => {
        const n = i + 1;
        const done = n < S.step;
        const active = n === S.step;
        return `<li class="flex items-center gap-2 ${i < 2 ? 'flex-1' : ''}"><div class="flex items-center gap-2.5">
          <span class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold transition-colors ${active ? 'bg-accent-500 text-background-950' : done ? 'bg-primary-100 text-primary-700' : 'bg-background-100 text-foreground-400'}">${done ? '<i class="ri-check-line text-base" aria-hidden="true"></i>' : n}</span>
          <span class="whitespace-nowrap text-sm font-medium ${active ? 'text-foreground-950' : done ? 'text-primary-700' : 'text-foreground-400'}">${label}</span></div>
          ${i < 2 ? `<span class="mx-1 h-px flex-1 ${done ? 'bg-primary-300' : 'bg-background-300'}"></span>` : ''}</li>`;
      })
      .join('')}</ol></div>`;
}

function renderError() {
  $('#step-error').innerHTML =
    S.error && S.step !== 3
      ? `<div class="mb-5 flex items-start gap-2.5 rounded-md border border-accent-200 bg-accent-50 px-3.5 py-3"><i class="ri-error-warning-line mt-0.5 text-accent-700" aria-hidden="true"></i><p class="text-sm text-accent-900">${esc(S.error)}</p></div>`
      : '';
}

function renderNav() {
  if (S.step === 3) return ($('#step-nav').innerHTML = '');
  $('#step-nav').innerHTML = `<div class="mt-6 flex flex-col-reverse gap-2.5 border-t border-background-200 pt-5 sm:flex-row sm:items-center sm:justify-between">
    ${
      S.step > 1
        ? `<button type="button" data-back-step class="inline-flex cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-md border border-background-300 px-4 py-2.5 text-sm font-semibold text-foreground-800 transition-colors hover:border-primary-400 hover:text-primary-700"><i class="ri-arrow-left-line" aria-hidden="true"></i>Quay lại</button>`
        : `<a href="${url('/tim-san')}" class="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md border border-background-300 px-4 py-2.5 text-sm font-semibold text-foreground-800 transition-colors hover:border-primary-400 hover:text-primary-700"><i class="ri-arrow-left-line" aria-hidden="true"></i>Xem danh sách sân</a>`
    }
    <button type="button" data-next ${S.busy ? 'disabled' : ''} class="inline-flex cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-md bg-accent-500 px-5 py-3 text-sm font-bold text-background-950 transition-colors hover:bg-accent-600 disabled:cursor-not-allowed disabled:opacity-60">
      ${S.busy ? '<i class="ri-loader-4-line animate-spin text-base" aria-hidden="true"></i>' : ''}${S.step === 2 ? 'Giữ sân &amp; thanh toán cọc' : 'Tiếp tục'}<i class="ri-arrow-right-line" aria-hidden="true"></i></button></div>`;
}

function renderSummary() {
  const c = court();
  $('[data-policy-date]').textContent = formatLongDate(S.date);
  if (!c) {
    $('#summary').innerHTML = `<div class="rounded-lg border border-background-200 bg-white p-5"><h2 class="font-heading text-base font-bold text-foreground-950">Tóm tắt đơn</h2><div class="mt-4 rounded-md border border-dashed border-background-300 bg-background-50 px-4 py-8 text-center"><i class="ri-calendar-2-line text-2xl text-foreground-300" aria-hidden="true"></i><p class="mt-2 text-xs text-foreground-500">Chọn sân để xem tóm tắt đơn của bạn.</p></div></div>`;
    return;
  }
  const band = S.startSlot ? priceBandAt(c, S.startSlot) : null;
  const row = (dt, dd, cls = '') => `<div class="flex items-start justify-between gap-3 ${cls}"><dt class="text-foreground-500">${dt}</dt><dd class="text-right font-medium text-foreground-950">${dd}</dd></div>`;
  $('#summary').innerHTML = `<div class="rounded-lg border border-background-200 bg-white p-5">
    <h2 class="font-heading text-base font-bold text-foreground-950">Tóm tắt đơn</h2>
    <div class="mt-4 flex gap-3">
      <div class="h-16 w-20 shrink-0 overflow-hidden rounded-md bg-background-100"><img src="${esc(c.images[0])}" alt="${esc(c.name)}" class="h-full w-full object-cover object-top"></div>
      <div class="min-w-0"><p class="font-heading text-sm font-bold leading-snug text-foreground-950">${esc(c.name)}</p><p class="mt-0.5 flex items-start gap-1 text-xs text-foreground-500"><i class="ri-map-pin-line mt-0.5" aria-hidden="true"></i><span class="line-clamp-2">${esc(c.address)}</span></p></div>
    </div>
    <dl class="mt-4 space-y-2.5 border-t border-background-200 pt-4 text-sm">
      ${row('Ngày chơi', formatLongDate(S.date))}
      ${row('Khung giờ', S.startSlot ? formatTimeRange(S.startSlot, S.duration) : 'Chưa chọn')}
      ${row('Thời lượng', `${S.duration} phút`)}
      ${row('Khung giá', band ? `${esc(band.shortLabel)}<span class="block text-[11px] font-normal text-foreground-500">${band.start} - ${band.end} · ${formatVnd(band.price)}/giờ</span>` : 'Chưa chọn giờ')}
      ${row('Tiền sân', S.startSlot ? formatVnd(courtPrice()) : '—')}
      ${extrasTotal() > 0 ? row('Dịch vụ thêm', formatVnd(extrasTotal())) : ''}
      ${discount() > 0 ? `<div class="flex items-center justify-between gap-3"><dt class="flex items-center gap-1 text-foreground-500"><i class="ri-coupon-3-line text-primary-600" aria-hidden="true"></i>Mã ${esc(S.applied.promotion.code)}</dt><dd class="font-semibold text-accent-700">-${formatVnd(discount())}</dd></div>` : ''}
    </dl>
    <div class="mt-4 flex items-end justify-between gap-3 rounded-md bg-accent-50 px-3.5 py-3"><span class="text-sm font-semibold text-accent-900">Tổng cộng</span><span class="font-heading text-xl font-extrabold text-accent-900">${S.startSlot ? formatVnd(total()) : '—'}</span></div>
    <p class="mt-2 text-[11px] leading-relaxed text-foreground-500">${S.startSlot ? `Cọc ${formatVnd(calcDeposit(total()))} (30%) để giữ sân trong ${HOLD_MINUTES} phút, phần còn lại trả tại sân.` : 'Chọn khung giờ để xem giá chính xác của lượt chơi.'}</p>
  </div>`;
}

// ======================= BƯỚC 1 =======================
function renderStep1() {
  const f = S.filters;
  const selectCls = 'w-full cursor-pointer appearance-none rounded-md border border-background-300 bg-white py-2.5 pl-8 pr-7 text-sm text-foreground-800 focus:border-primary-400 focus:outline-none';
  $('#step-body').innerHTML = `
    <h2 class="font-heading text-lg font-bold text-foreground-950">Chọn sân và khung giờ</h2>
    <p class="mt-1 text-sm text-foreground-600">Chọn ngày, thời lượng rồi bấm vào ô giờ còn trống. Giá hiển thị ngay trên từng ô.</p>
    <div class="mt-4 rounded-lg border border-background-200 bg-background-50 p-3.5">
      <div class="flex flex-col gap-2.5 lg:flex-row lg:items-center">
        <div class="relative min-w-0 flex-1">
          <i class="ri-search-line pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-base text-foreground-400" aria-hidden="true"></i>
          <input type="search" id="f-keyword" value="${esc(f.keyword)}" placeholder="Tìm theo tên sân, khu vực, địa chỉ..." aria-label="Tìm sân theo tên, khu vực hoặc địa chỉ" class="w-full cursor-text rounded-md border border-background-300 bg-white py-2.5 pl-9 pr-3 text-sm text-foreground-900 placeholder:text-foreground-500 focus:border-primary-400 focus:outline-none focus:ring-1 focus:ring-primary-400">
        </div>
        <div class="grid grid-cols-1 gap-2.5 sm:grid-cols-3 lg:w-[430px] lg:shrink-0">
          <div class="relative min-w-0"><i class="ri-map-pin-line pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-foreground-400" aria-hidden="true"></i>
            <select id="f-area" class="${selectCls}"><option value="">Mọi khu vực</option>${(PAGE.areas || []).map((a) => `<option value="${esc(a)}" ${a === f.area ? 'selected' : ''}>P. ${esc(a)}</option>`).join('')}</select></div>
          <div class="relative min-w-0"><i class="ri-price-tag-3-line pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-foreground-400" aria-hidden="true"></i>
            <select id="f-price" class="${selectCls}">${(PAGE.priceRanges || []).map((r) => `<option value="${r.id}" ${r.id === f.priceId ? 'selected' : ''}>${r.id === 'all' ? 'Mọi mức giá' : esc(r.label)}</option>`).join('')}</select></div>
          <div class="relative min-w-0"><i class="ri-sort-desc pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-foreground-400" aria-hidden="true"></i>
            <select id="f-sort" class="${selectCls}">${[['popular', 'Phổ biến nhất'], ['price-asc', 'Giá thấp đến cao'], ['price-desc', 'Giá cao đến thấp'], ['rating', 'Đánh giá cao nhất']].map(([v, l]) => `<option value="${v}" ${v === f.sort ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
        </div>
      </div>
      <div class="mt-3 flex flex-wrap items-center justify-between gap-2.5">
        <div class="inline-flex items-center gap-1 rounded-full bg-background-100 p-1" id="f-sport"></div>
        <div class="flex items-center gap-3" id="f-count"></div>
      </div>
    </div>
    <div id="court-list"></div>
    <div class="mt-6"><p class="mb-2 text-sm font-semibold text-foreground-900">Ngày chơi</p><div class="grid grid-cols-4 gap-2 sm:grid-cols-5 lg:grid-cols-7" id="dates"></div></div>
    <div class="mt-6 flex flex-wrap items-center justify-between gap-3"><p class="text-sm font-semibold text-foreground-900">Thời lượng</p><div class="inline-flex items-center gap-1 rounded-full bg-background-100 p-1" id="durations"></div></div>
    <div class="mt-4 flex flex-wrap items-center gap-3 text-[11px] text-foreground-500">
      <span class="flex items-center gap-1.5"><span class="h-3 w-3 rounded-sm border border-primary-300 bg-primary-50"></span> Còn trống</span>
      <span class="flex items-center gap-1.5"><span class="h-3 w-3 rounded-sm bg-accent-500"></span> Đang chọn</span>
      <span class="flex items-center gap-1.5"><span class="h-3 w-3 rounded-sm bg-background-300"></span> Đã có người đặt</span>
      <span class="flex items-center gap-1.5"><span class="h-3 w-3 rounded-sm bg-secondary-500"></span> Đã qua</span>
    </div>
    <div id="today-note"></div>
    <div class="mt-4" id="slots"></div>
    <div id="selection"></div>`;
  renderCourtList();
  renderDates();
  renderSlots();
}

function filteredCourts() {
  const f = S.filters;
  const q = f.keyword.trim().toLowerCase();
  const range = (PAGE.priceRanges || []).find((r) => r.id === f.priceId) || { min: 0, max: 1e9 };
  const list = courts.filter((c) => {
    if (f.sport !== 'all' && c.sport !== f.sport) return false;
    if (f.area && c.area !== f.area) return false;
    if (c.pricePerHour < range.min || c.pricePerHour > range.max) return false;
    return !q || [c.name, c.area, c.address, c.sportLabel, ...c.fieldTypes].join(' ').toLowerCase().includes(q);
  });
  if (f.sort === 'price-asc') list.sort((a, b) => a.pricePerHour - b.pricePerHour);
  else if (f.sort === 'price-desc') list.sort((a, b) => b.pricePerHour - a.pricePerHour);
  else if (f.sort === 'rating') list.sort((a, b) => b.rating - a.rating);
  else list.sort((a, b) => Number(b.featured) - Number(a.featured) || b.rating - a.rating);
  return list;
}

function renderCourtList() {
  const f = S.filters;
  const list = filteredCourts();
  const hasFilters = f.sport !== 'all' || f.area || f.priceId !== 'all' || f.keyword.trim();
  $('#f-sport').innerHTML = [['all', 'Tất cả'], ['football', 'Bóng đá'], ['badminton', 'Cầu lông']]
    .map(([v, l]) => `<button type="button" data-sport="${v}" class="cursor-pointer whitespace-nowrap rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors ${f.sport === v ? 'bg-primary-500 text-white' : 'text-foreground-500 hover:bg-background-200 hover:text-foreground-900'}">${l}</button>`)
    .join('');
  $('#f-count').innerHTML = `<p class="text-xs text-foreground-500">Tìm thấy <span class="font-bold text-foreground-950">${list.length}</span> / ${courts.length} sân</p>${
    hasFilters ? `<button type="button" data-reset-filters class="inline-flex cursor-pointer items-center gap-1 whitespace-nowrap rounded-md px-2 py-1 text-xs font-semibold text-primary-600 transition-colors hover:bg-primary-50 hover:text-primary-700"><i class="ri-refresh-line text-sm" aria-hidden="true"></i>Xóa bộ lọc</button>` : ''
  }`;
  $('#court-list').innerHTML = list.length
    ? `<div class="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-2">${list
        .map((c) => {
          const on = c.slug === S.courtSlug;
          return `<button type="button" data-court="${c.slug}" class="flex cursor-pointer items-center gap-3 rounded-lg border p-2.5 text-left transition-colors ${on ? 'border-primary-400 bg-primary-50' : 'border-background-200 bg-white hover:border-primary-300'}">
          <div class="h-16 w-16 shrink-0 overflow-hidden rounded-md bg-background-100"><img src="${esc(c.images[0])}" alt="${esc(c.name)}" loading="lazy" class="h-full w-full object-cover object-top"></div>
          <div class="min-w-0 flex-1">
            <p class="truncate font-heading text-sm font-bold text-foreground-950">${esc(c.name)}</p>
            <p class="mt-0.5 flex items-center gap-1 truncate text-[11px] text-foreground-500"><i class="ri-star-fill text-[10px] text-accent-500" aria-hidden="true"></i><span class="font-semibold text-foreground-800">${c.rating}</span><span>(${c.reviewCount})</span><span class="text-foreground-400">•</span><span class="truncate">P. ${esc(c.area)}</span></p>
            <p class="mt-1 truncate text-xs font-bold text-primary-600">từ ${formatVnd(lowestPrice(c))}/giờ</p>
          </div>
          <span class="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${on ? 'border-primary-500 bg-primary-500 text-white' : 'border-background-400 bg-white'}">${on ? '<i class="ri-check-line text-xs" aria-hidden="true"></i>' : ''}</span></button>`;
        })
        .join('')}</div>`
    : `<div class="mt-3 rounded-lg border border-dashed border-background-300 bg-background-50 px-4 py-10 text-center"><div class="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-background-100 text-foreground-400"><i class="ri-search-eye-line text-xl" aria-hidden="true"></i></div><p class="mt-3 text-sm font-semibold text-foreground-900">Không tìm thấy sân phù hợp</p><p class="mt-1 text-xs text-foreground-500">Thử từ khóa khác, hoặc bỏ bớt điều kiện lọc để xem toàn bộ sân.</p><button type="button" data-reset-filters class="mt-4 inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-md border border-primary-300 bg-primary-50 px-3.5 py-2 text-xs font-semibold text-primary-700 transition-colors hover:bg-primary-100"><i class="ri-refresh-line text-sm" aria-hidden="true"></i>Xóa bộ lọc</button></div>`;
}

function renderDates() {
  $('#dates').innerHTML = dateOptions
    .map((o) => {
      const on = o.iso === S.date;
      return `<button type="button" data-date="${o.iso}" class="cursor-pointer rounded-md border px-2 py-2.5 text-center transition-colors ${on ? 'border-primary-500 bg-primary-500 text-white' : 'border-background-300 bg-white text-foreground-700 hover:border-primary-300'}">
        <span class="block text-[11px] ${on ? 'text-white/85' : 'text-foreground-500'}">${o.weekday}</span><span class="mt-0.5 block font-heading text-base font-bold">${o.day}</span><span class="block text-[11px] ${on ? 'text-white/85' : 'text-foreground-500'}">Th ${o.month}</span></button>`;
    })
    .join('');
  $('#durations').innerHTML = DURATION_OPTIONS.map(
    (o) => `<button type="button" data-duration="${o.value}" class="cursor-pointer whitespace-nowrap rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors ${S.duration === o.value ? 'bg-accent-500 text-background-950' : 'text-foreground-600 hover:text-foreground-950'}">${o.label}</button>`,
  ).join('');
  $('#today-note').innerHTML = isTodayIso(S.date)
    ? `<p class="mt-3 flex items-start gap-2 rounded-md bg-background-50 px-3.5 py-2.5 text-xs leading-relaxed text-foreground-600"><i class="ri-information-line mt-0.5 text-primary-600" aria-hidden="true"></i>Hôm nay chỉ đặt được từ khung giờ sắp tới. Các ô đã qua được đánh dấu “Đã qua”.</p>`
    : '';
}

function renderSlots() {
  if (S.step !== 1 || !$('#slots')) return;
  const c = court();
  let html = '';
  if (!c) html = `<div class="rounded-md border border-dashed border-background-300 bg-background-50 px-4 py-10 text-center text-sm text-foreground-500">Chọn một sân ở trên để xem khung giờ trống.</div>`;
  else if (S.availability.loading) html = `<div class="rounded-md border border-background-200 bg-white px-4 py-10 text-center text-sm text-foreground-500">Đang tải lịch sân...</div>`;
  else {
    html = `<div class="mb-2 flex flex-wrap items-center gap-2 rounded-md bg-background-50 px-3 py-1.5 text-[11px] text-foreground-600"><i class="ri-price-tag-3-line text-primary-600" aria-hidden="true"></i>${getPriceBands(c)
      .map((b) => `<span class="whitespace-nowrap">${esc(b.shortLabel)} (${b.start}-${b.end}): <span class="font-semibold ${b.peak ? 'text-accent-700' : 'text-foreground-900'}">${formatVnd(b.price)}/giờ</span></span>`)
      .join('')}</div>
      <div class="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">${buildDaySlots(c)
        .map((slot) => {
          const st = slotState(slot);
          if (st !== 'free') return `<span title="${st === 'past' ? 'Khung giờ đã qua' : 'Khung giờ đã kín'}" class="cursor-not-allowed rounded-md bg-background-100 px-2 py-2.5 text-center text-xs font-medium text-foreground-400"><span class="block line-through">${slot}</span><span class="mt-0.5 block text-[10px]">${st === 'past' ? 'Đã qua' : 'Đã kín'}</span></span>`;
          const on = S.startSlot === slot;
          return `<button type="button" data-slot="${slot}" class="cursor-pointer rounded-md border px-2 py-2.5 text-center text-xs font-semibold transition-colors ${on ? 'border-accent-500 bg-accent-500 text-background-950' : 'border-primary-200 bg-primary-50 text-primary-800 hover:border-primary-400'}"><span class="block">${slot}</span><span class="mt-0.5 block text-[10px] ${on ? 'text-background-950/80' : 'text-primary-600'}">${formatVnd(calcCourtPriceForRange(c, slot, S.duration))}</span></button>`;
        })
        .join('')}</div>`;
  }
  $('#slots').innerHTML = html;
  $('#selection').innerHTML =
    c && S.startSlot
      ? `<div class="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-md bg-background-50 px-3.5 py-3"><p class="text-sm text-foreground-700">Đã chọn <span class="font-semibold text-foreground-950">${formatTimeRange(S.startSlot, S.duration)} (${S.duration} phút)</span></p><p class="font-heading text-base font-bold text-primary-600">${formatVnd(courtPrice())}</p></div>`
      : '';
}

// ======================= BƯỚC 2 =======================
function fieldError(key) {
  return S.fieldErrors[key] ? `<p class="mt-1 flex items-center gap-1 text-xs text-accent-700"><i class="ri-error-warning-line" aria-hidden="true"></i>${esc(S.fieldErrors[key])}</p>` : '';
}
function inputCls(key) {
  return `w-full rounded-md border bg-white px-3 py-2.5 text-sm text-foreground-950 placeholder:text-foreground-400 focus:outline-none ${S.fieldErrors[key] ? 'border-accent-400' : 'border-background-300 focus:border-primary-400'}`;
}

function renderStep2() {
  const f = S.form;
  $('#step-body').innerHTML = `
    <h2 class="font-heading text-lg font-bold text-foreground-950">Thông tin người đặt</h2>
    <p class="mt-1 text-sm text-foreground-600">Chỉ cần họ tên và số điện thoại. Không cần tạo tài khoản vẫn đặt được sân.</p>
    <div class="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
      <div class="min-w-0"><label for="b-name" class="mb-1.5 block text-sm font-medium text-foreground-800">Họ và tên <span class="text-accent-600">*</span></label><input id="b-name" data-form="name" type="text" maxlength="50" value="${esc(f.name)}" placeholder="Nguyễn Minh Quân" class="${inputCls('name')}">${fieldError('name')}</div>
      <div class="min-w-0"><label for="b-phone" class="mb-1.5 block text-sm font-medium text-foreground-800">Số điện thoại <span class="text-accent-600">*</span></label><input id="b-phone" data-form="phone" type="tel" inputmode="numeric" maxlength="12" value="${esc(f.phone)}" placeholder="0912345678" class="${inputCls('phone')}">${fieldError('phone') || '<p class="mt-1 text-xs text-foreground-400">10 số, bắt đầu bằng 0. Chủ sân gọi xác nhận theo số này.</p>'}</div>
      <div class="min-w-0 sm:col-span-2"><label for="b-email" class="mb-1.5 block text-sm font-medium text-foreground-800">Email <span class="font-normal text-foreground-400">(không bắt buộc)</span></label><input id="b-email" data-form="email" type="email" value="${esc(f.email)}" placeholder="minhquan@gmail.com" class="${inputCls('email')}">${fieldError('email')}</div>
    </div>
    <div class="mt-5"><p class="text-sm font-medium text-foreground-800">Dịch vụ thêm</p><p class="mt-0.5 text-xs text-foreground-500">Trả cùng lúc tại sân, không bắt buộc.</p>
      <div class="mt-2.5 grid grid-cols-1 gap-2 sm:grid-cols-2">${extraServices
        .map((s) => {
          const on = S.extras.includes(s.id);
          return `<label class="flex cursor-pointer items-center justify-between gap-3 rounded-md border px-3.5 py-2.5 transition-colors ${on ? 'border-primary-400 bg-primary-50' : 'border-background-300 bg-white hover:border-primary-300'}"><span class="flex items-center gap-2 text-sm text-foreground-900"><input type="checkbox" data-extra="${s.id}" ${on ? 'checked' : ''} class="h-4 w-4 cursor-pointer accent-primary-500">${esc(s.label)}</span><span class="whitespace-nowrap text-xs font-semibold text-foreground-600">${formatVnd(s.price)}</span></label>`;
        })
        .join('')}</div></div>
    <div class="mt-5" id="promo-box"></div>
    <div class="mt-5"><label for="b-note" class="mb-1.5 block text-sm font-medium text-foreground-800">Ghi chú cho chủ sân</label><textarea id="b-note" data-form="note" rows="3" maxlength="500" placeholder="Ví dụ: đội mình 7 người, cần thêm 10 áo bib..." class="w-full rounded-md border border-background-300 bg-white px-3 py-2.5 text-sm text-foreground-950 placeholder:text-foreground-400 focus:border-primary-400 focus:outline-none">${esc(f.note)}</textarea><p class="mt-1 text-right text-xs text-foreground-400" data-note-count>${f.note.length}/500</p></div>
    <label class="mt-2 flex cursor-pointer items-start gap-2.5 rounded-md border border-background-200 bg-background-50 px-3.5 py-3"><input type="checkbox" data-agree ${S.agree ? 'checked' : ''} class="mt-0.5 h-4 w-4 cursor-pointer accent-primary-500"><span class="text-xs leading-relaxed text-foreground-600">Tôi đồng ý với chính sách hủy sân: chỉ hủy và hoàn 100% tiền cọc khi còn cách giờ chơi từ ${CANCEL_CUTOFF_HOURS} giờ trở lên. Trong ${CANCEL_CUTOFF_HOURS} giờ cuối, nút hủy sẽ khóa và tôi liên hệ hotline để chủ sân hỗ trợ. Lỗi từ phía sân hoàn 100%.</span></label>`;
  renderPromo();
}

function renderPromo() {
  const box = $('#promo-box');
  if (!box) return;
  box.innerHTML = `<div class="flex flex-wrap items-center justify-between gap-1.5"><p class="text-sm font-medium text-foreground-800">Mã giảm giá</p><a href="${url('/uu-dai')}" class="inline-flex items-center gap-1 whitespace-nowrap text-[11px] font-semibold text-primary-700 transition-colors hover:text-primary-800"><i class="ri-coupon-3-line" aria-hidden="true"></i>Xem tất cả mã đang chạy</a></div>
    <p class="mt-0.5 text-xs text-foreground-500">Nhập mã ưu đãi của chủ sân nếu bạn có.</p>
    ${
      S.applied
        ? `<div class="mt-2.5 flex flex-wrap items-center justify-between gap-2 rounded-md border border-primary-300 bg-primary-50 px-3.5 py-3"><div class="min-w-0"><p class="flex items-center gap-1.5 text-sm font-bold text-primary-900"><i class="ri-coupon-3-fill" aria-hidden="true"></i>${esc(S.applied.promotion.code)}</p><p class="mt-0.5 text-[11px] text-primary-800">${esc(describeDiscount(S.applied.promotion))}</p></div><div class="flex items-center gap-3"><span class="whitespace-nowrap text-sm font-extrabold text-accent-700">-${formatVnd(S.applied.discount)}</span><button type="button" data-remove-promo class="cursor-pointer whitespace-nowrap text-[11px] font-semibold text-foreground-600 underline transition-colors hover:text-accent-700">Bỏ mã</button></div></div>`
        : `<div class="mt-2.5 flex flex-col gap-2 sm:flex-row"><input type="text" id="promo-input" value="${esc(S.promoCode)}" maxlength="16" placeholder="Nhập mã, ví dụ BMT20" aria-label="Mã giảm giá" class="w-full min-w-0 rounded-md border border-background-300 bg-white px-3 py-2.5 font-mono text-sm font-semibold uppercase tracking-wider text-foreground-950 placeholder:font-sans placeholder:font-normal placeholder:normal-case placeholder:tracking-normal placeholder:text-foreground-400 focus:border-primary-400 focus:outline-none"><button type="button" data-apply-promo class="inline-flex shrink-0 cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-md bg-primary-500 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-600 disabled:cursor-not-allowed disabled:bg-background-300 disabled:text-foreground-500"><i class="ri-price-tag-3-line" aria-hidden="true"></i>Áp dụng</button></div>`
    }
    ${S.promoError ? `<p class="mt-1.5 flex items-start gap-1 text-xs text-accent-700"><i class="ri-error-warning-line mt-0.5" aria-hidden="true"></i>${esc(S.promoError)}</p>` : ''}`;
}

async function applyPromo(silent = false) {
  const code = normalizePromoCode(S.promoCode);
  if (!code) {
    S.promoError = 'Vui lòng nhập mã giảm giá.';
    return renderPromo();
  }
  const btn = $('[data-apply-promo]');
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<i class="ri-loader-4-line animate-spin" aria-hidden="true"></i>Đang kiểm tra...';
  }
  try {
    const data = await api('booking', 'check_promo', { code, courtSlug: S.courtSlug, date: S.date, startSlot: S.startSlot, duration: S.duration, extras: S.extras });
    S.applied = data;
    S.promoCode = data.promotion.code;
    S.promoError = '';
  } catch (error) {
    S.applied = null;
    S.promoError = silent ? '' : error.message;
  }
  renderPromo();
  renderSummary();
}

/** Khi đổi dịch vụ thêm, kiểm tra lại mã đã áp dụng (đơn tối thiểu / số tiền giảm) */
async function revalidatePromo() {
  if (!S.applied) return renderSummary();
  await applyPromo();
}

// ======================= BƯỚC 3 =======================
function renderStep3() {
  const c = court();
  const b = S.booking;
  const payAmount = b.depositAmount;
  const secondsLeft = remainingHoldSeconds(b.holdExpiresAt);
  const expired = secondsLeft <= 0;
  const extras = extrasTotal();
  const row = (dt, dd) => `<div class="flex items-start justify-between gap-4 px-4 py-3 text-sm"><dt class="text-foreground-500">${dt}</dt><dd class="text-right font-medium text-foreground-950">${dd}</dd></div>`;
  $('#step-body').innerHTML = `
    <h2 class="font-heading text-lg font-bold text-foreground-950">Xác nhận và chuyển khoản cọc</h2>
    <p class="mt-1 text-sm text-foreground-600">Sân đang được giữ cho bạn. Quét mã VietQR bằng app ngân hàng, phần còn lại trả tại sân.</p>
    ${S.error ? `<div class="mt-4 flex items-start gap-2.5 rounded-md border border-accent-200 bg-accent-50 px-3.5 py-3"><i class="ri-error-warning-line mt-0.5 text-accent-700" aria-hidden="true"></i><p class="text-sm text-accent-900">${esc(S.error)}</p></div>` : ''}
    <div class="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-[1fr_300px]">
      <div class="min-w-0">
        <dl class="divide-y divide-background-200 rounded-lg border border-background-200">
          ${row('Sân', `<span class="font-semibold">${esc(c.name)}</span><span class="block text-xs font-normal text-foreground-500">${esc(c.address)}</span>`)}
          ${row('Ngày chơi', formatLongDate(b.date))}
          ${row('Khung giờ', `${formatTimeRange(b.startSlot, b.durationMinutes)} (${b.durationMinutes} phút)`)}
          ${row('Tiền sân', formatVnd(b.baseTotal - extras))}
          ${extras > 0 ? row('Dịch vụ thêm', formatVnd(extras)) : ''}
          ${b.discount > 0 ? `<div class="flex items-start justify-between gap-4 px-4 py-3 text-sm"><dt class="flex items-center gap-1 text-foreground-500"><i class="ri-coupon-3-line text-primary-600" aria-hidden="true"></i>Mã giảm giá ${esc(b.promoCode)}</dt><dd class="text-right font-semibold text-accent-700">-${formatVnd(b.discount)}</dd></div>` : ''}
          <div class="flex items-center justify-between gap-4 bg-background-50 px-4 py-3.5"><dt class="text-sm font-semibold text-foreground-900">Tổng cộng</dt><dd class="font-heading text-xl font-extrabold text-accent-600">${formatVnd(b.totalPrice)}</dd></div>
        </dl>
        <div class="mt-4"><p class="mb-2 text-sm font-medium text-foreground-800">Bạn muốn thanh toán</p>
          <div class="grid grid-cols-1 gap-2.5 sm:grid-cols-2">${[
            ['deposit', `Cọc 30% – ${formatVnd(calcDeposit(b.totalPrice))}`, 'Phần còn lại trả tại sân'],
            ['full', `Trả đủ – ${formatVnd(b.totalPrice)}`, 'Không cần trả thêm khi ra sân'],
          ]
            .map(([v, label, note]) => {
              const on = S.depositMode === v;
              return `<button type="button" data-mode="${v}" class="cursor-pointer rounded-md border px-3.5 py-3 text-left transition-colors ${on ? 'border-accent-400 bg-accent-50' : 'border-background-300 bg-white hover:border-accent-300'}"><span class="flex items-center gap-2 text-sm font-semibold text-foreground-950"><span class="flex h-4 w-4 items-center justify-center rounded-full border ${on ? 'border-accent-500 bg-accent-500' : 'border-background-400 bg-white'}">${on ? '<span class="h-1.5 w-1.5 rounded-full bg-background-950"></span>' : ''}</span>${label}</span><span class="mt-1 block pl-6 text-xs text-foreground-500">${note}</span></button>`;
            })
            .join('')}</div></div>
      </div>
      <div class="min-w-0">
        <div class="rounded-lg border border-background-200 bg-white p-4">
          <div class="flex items-center justify-between gap-2"><p class="font-heading text-sm font-bold text-foreground-950">Mã VietQR</p><span data-countdown class="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${expired ? 'bg-accent-100 text-accent-900' : 'bg-primary-50 text-primary-800'}"><i class="ri-time-line" aria-hidden="true"></i>${expired ? 'Đã hết giữ sân' : `Giữ sân ${formatCountdown(secondsLeft)}`}</span></div>
          <div class="mt-3 flex h-[220px] w-full items-center justify-center overflow-hidden rounded-md border border-background-200 bg-background-50"><img src="${buildVietQrUrl(payAmount, b.code)}" alt="Mã VietQR thanh toán ${formatVnd(payAmount)} cho đơn ${esc(b.code)}" class="h-full w-full object-contain ${expired ? 'opacity-40' : ''}"></div>
          <div class="mt-3 space-y-1.5 text-xs">
            <div class="flex items-center justify-between gap-2"><span class="text-foreground-500">Ngân hàng</span><span class="font-semibold text-foreground-900">${esc(bankAccount.bankName)}</span></div>
            <div class="flex items-center justify-between gap-2"><span class="text-foreground-500">Số tài khoản</span><button type="button" data-copy="${esc(bankAccount.accountNumber)}" class="flex cursor-pointer items-center gap-1.5 whitespace-nowrap font-semibold text-foreground-900 hover:text-primary-600">${esc(bankAccount.accountNumber)}<i class="ri-file-copy-line" aria-hidden="true"></i></button></div>
            <div class="flex items-center justify-between gap-2"><span class="text-foreground-500">Chủ tài khoản</span><span class="font-semibold text-foreground-900">${esc(bankAccount.accountName)}</span></div>
            <div class="flex items-center justify-between gap-2"><span class="text-foreground-500">Số tiền</span><span class="font-semibold text-accent-600">${formatVnd(payAmount)}</span></div>
            <div class="flex items-center justify-between gap-2"><span class="text-foreground-500">Nội dung</span><button type="button" data-copy="${esc(b.code)}" class="flex cursor-pointer items-center gap-1.5 whitespace-nowrap font-semibold text-foreground-900 hover:text-primary-600">${esc(b.code)}<i class="ri-file-copy-line" aria-hidden="true"></i></button></div>
          </div>
        </div>
        <div class="mt-3 rounded-md bg-secondary-50 px-3.5 py-3 text-[11px] leading-relaxed text-secondary-900">Chuyển đúng số tiền và nội dung để hệ thống nhận diện đơn. Sau khi bấm “Tôi đã chuyển khoản”, hệ thống tự đối soát trong khoảng ${AUTO_CONFIRM_SECONDS} giây rồi xác nhận cọc và mở vé QR ngay.</div>
      </div>
    </div>
    <div class="mt-5 flex flex-col gap-2.5 border-t border-background-200 pt-5 sm:flex-row sm:items-center sm:justify-between">
      <button type="button" data-cancel-hold class="inline-flex cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-md border border-background-300 px-4 py-2.5 text-sm font-semibold text-foreground-800 transition-colors hover:border-accent-400 hover:text-accent-700"><i class="ri-close-line" aria-hidden="true"></i>Hủy giữ sân</button>
      <button type="button" data-confirm ${expired || S.busy ? 'disabled' : ''} class="inline-flex cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-md bg-accent-500 px-5 py-3 text-sm font-bold text-background-950 transition-colors hover:bg-accent-600 disabled:cursor-not-allowed disabled:opacity-50"><i class="${S.busy ? 'ri-loader-4-line animate-spin' : 'ri-check-double-line'} text-base" aria-hidden="true"></i>${expired ? 'Đã hết thời gian giữ sân' : S.busy ? 'Đang xác nhận tiền cọc…' : 'Tôi đã chuyển khoản'}</button>
    </div>
    <p class="mt-3 text-center text-xs text-foreground-500">Cần hỗ trợ? Gọi <a href="tel:${HOTLINE.replace(/\D/g, '')}" class="font-semibold text-primary-600 hover:text-primary-700">${HOTLINE}</a></p>`;
}

function startHoldTimer() {
  clearInterval(holdTimer);
  holdTimer = setInterval(() => {
    if (S.step !== 3 || !S.booking) return clearInterval(holdTimer);
    const left = remainingHoldSeconds(S.booking.holdExpiresAt);
    const badge = $('[data-countdown]');
    if (badge) badge.innerHTML = `<i class="ri-time-line" aria-hidden="true"></i>${left <= 0 ? 'Đã hết giữ sân' : `Giữ sân ${formatCountdown(left)}`}`;
    if (left <= 0) {
      clearInterval(holdTimer);
      renderStep3();
    }
  }, 1000);
}

function showVerifyOverlay() {
  const overlay = document.createElement('div');
  overlay.className = 'fixed inset-0 z-[95] flex items-center justify-center bg-foreground-950/70 p-4';
  overlay.innerHTML = `<div class="w-full max-w-sm rounded-lg border border-background-200 bg-white p-6 text-center">
    <span class="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary-50 text-primary-600"><i class="ri-loader-4-line animate-spin text-3xl" aria-hidden="true"></i></span>
    <p class="mt-4 font-heading text-base font-bold text-foreground-950">Đang kiểm tra giao dịch chuyển khoản</p>
    <p class="mt-1.5 text-sm text-foreground-600">Hệ thống tự động đối soát và xác nhận tiền cọc. Bạn không cần làm gì thêm.</p>
    <div class="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-background-200"><div data-bar class="h-full rounded-full bg-primary-500 transition-all duration-1000 ease-linear" style="width:0%"></div></div>
    <p data-left class="mt-2 text-xs font-semibold text-foreground-500"></p></div>`;
  document.body.appendChild(overlay);
  return {
    set(sec) {
      overlay.querySelector('[data-bar]').style.width = `${Math.min(100, ((AUTO_CONFIRM_SECONDS - sec + 1) / AUTO_CONFIRM_SECONDS) * 100)}%`;
      overlay.querySelector('[data-left]').textContent = `Còn khoảng ${Math.max(1, sec)} giây`;
    },
    close: () => overlay.remove(),
  };
}

async function confirmDeposit() {
  S.error = '';
  S.busy = true;
  renderStep3();
  let overlay = null;
  try {
    await api('booking', 'claim', { id: S.booking.id });
    overlay = showVerifyOverlay();
    for (let sec = AUTO_CONFIRM_SECONDS; sec > 0; sec -= 1) {
      overlay.set(sec);
      await new Promise((r) => setTimeout(r, 1000));
    }
    const confirmed = await api('booking', 'auto_confirm', { id: S.booking.id });
    overlay.close();
    S.busy = false;
    showTicket(confirmed);
  } catch (error) {
    if (overlay) overlay.close();
    S.busy = false;
    S.error = error.message;
    renderStep3();
  }
}

// ======================= VÉ ĐIỆN TỬ =======================
function showTicket(b) {
  clearInterval(holdTimer);
  const confirmed = b.status === 'confirmed' || b.status === 'completed' || ['paid', 'deposit_paid'].includes(b.paymentStatus);
  const deposit = b.paymentStatus === 'paid' ? b.totalPrice : b.depositAmount;
  const deadline = formatCancelDeadline(b.date, b.startSlot) || `Trước giờ chơi ${CANCEL_CUTOFF_HOURS} giờ`;
  const canCancel = isBeforeCancelCutoff(b.date, [b.startSlot]);
  $('#booking-header').classList.add('hidden');
  $('#booking-app').classList.add('hidden');
  const view = $('#ticket-view');
  view.classList.remove('hidden');
  view.innerHTML = `<div class="w-full px-4 py-10 md:px-8 md:py-14"><div class="mx-auto w-full max-w-2xl">
    <div class="rounded-lg border border-background-200 bg-white p-6 md:p-8">
      <div class="flex flex-col items-center text-center">
        <span class="flex h-16 w-16 items-center justify-center rounded-full ${confirmed ? 'bg-primary-50 text-primary-600' : 'bg-accent-50 text-accent-600'}"><i class="${confirmed ? 'ri-checkbox-circle-fill' : 'ri-time-line'} text-4xl" aria-hidden="true"></i></span>
        <h1 class="mt-4 font-heading text-2xl font-extrabold text-foreground-950">${confirmed ? 'Đã giữ sân cho bạn!' : 'Đã gửi yêu cầu đặt sân'}</h1>
        <p class="mt-2 max-w-md text-sm leading-relaxed text-foreground-600">${confirmed ? 'Hệ thống đã tự động đối soát và xác nhận khoản cọc của bạn. Vé điện tử bên dưới là căn cứ check-in tại sân — bạn chỉ cần trả phần còn lại khi ra sân.' : 'Hệ thống đang đối soát khoản cọc của bạn. Vé QR sẽ mở ngay khi xác nhận xong — bạn không cần chờ tại đây, mở lại trang này lúc nào cũng xem được.'}</p>
      </div>
      <div class="mt-6 rounded-xl border border-dashed border-primary-300 bg-primary-50/40 p-5">
        <div class="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
          ${confirmed ? `<div class="h-[180px] w-[180px] shrink-0 overflow-hidden rounded-md border border-background-200 bg-white p-2"><img src="${ticketQrUrl(b)}" alt="Mã QR vé đặt sân ${esc(b.code)}" class="h-full w-full object-contain"></div>` : `<div class="flex h-[180px] w-[180px] shrink-0 flex-col items-center justify-center gap-2 rounded-md border border-dashed border-accent-300 bg-white px-4 text-center"><i class="ri-qr-scan-2-line text-3xl text-accent-500" aria-hidden="true"></i><p class="text-[11px] leading-relaxed text-foreground-600">Mã QR mở ngay khi hệ thống xác nhận tiền cọc</p></div>`}
          <div class="min-w-0 flex-1">
            <p class="text-xs font-medium text-foreground-500">Mã vé điện tử</p>
            <p class="mt-1 font-heading text-xl font-extrabold tracking-wide text-primary-900">${esc(b.code)}</p>
            <span class="mt-2 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${confirmed ? 'bg-primary-100 text-primary-800' : 'bg-accent-100 text-accent-900'}"><i class="${confirmed ? 'ri-checkbox-circle-fill' : 'ri-time-fill'}" aria-hidden="true"></i>${confirmed ? 'Đã xác nhận cọc – vé đã mở' : 'Chờ xác nhận tiền cọc'}</span>
            <dl class="mt-3 space-y-2 text-sm"><div><dt class="text-xs text-foreground-500">Sân</dt><dd class="font-semibold text-foreground-950">${esc(b.courtName)}</dd></div><div><dt class="text-xs text-foreground-500">Thời gian</dt><dd class="font-semibold text-foreground-950">${formatTimeRange(b.startSlot, b.durationMinutes)} · ${formatLongDate(b.date)}</dd></div></dl>
          </div>
        </div>
      </div>
      <div class="mt-4 rounded-lg border border-background-200 bg-background-50 p-4"><dl class="space-y-3 text-sm">
        <div class="flex items-start justify-between gap-4"><dt class="text-foreground-500">Địa chỉ</dt><dd class="max-w-[62%] text-right text-foreground-800">${esc(b.address)}</dd></div>
        <div class="flex items-start justify-between gap-4"><dt class="text-foreground-500">Người đặt</dt><dd class="text-right text-foreground-950">${esc(b.customerName)}<span class="block text-xs text-foreground-500">${esc(b.customerPhone)}</span></dd></div>
        <div class="flex items-start justify-between gap-4"><dt class="text-foreground-500">Tổng tiền sân</dt><dd class="text-right font-semibold text-foreground-950">${formatVnd(b.totalPrice)}</dd></div>
        <div class="flex items-start justify-between gap-4"><dt class="text-foreground-500">Tiền cọc</dt><dd class="text-right font-semibold text-accent-600">${formatVnd(deposit)}</dd></div>
        <div class="flex items-start justify-between gap-4 border-t border-background-200 pt-3"><dt class="text-foreground-500">Còn lại tại sân</dt><dd class="text-right font-heading text-lg font-extrabold text-primary-600">${formatVnd(Math.max(0, b.totalPrice - deposit))}</dd></div>
      </dl></div>
      <div class="mt-4 rounded-lg border border-primary-200 bg-primary-50/60 p-4"><div class="flex items-start gap-3">
        <span class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-primary-600"><i class="ri-time-line text-xl" aria-hidden="true"></i></span>
        <div class="min-w-0 flex-1"><p class="text-xs font-semibold uppercase tracking-wide text-primary-700">Hạn hủy vé</p><p class="mt-1 font-heading text-base font-extrabold text-foreground-950">${esc(deadline)}</p><p class="mt-1 text-xs leading-relaxed text-foreground-600">Hủy trước mốc này được hoàn 100% tiền cọc. Sau mốc, nút hủy sẽ khóa — bạn gọi ${HOTLINE} để chủ sân hỗ trợ.</p>
        <p class="mt-2 inline-flex items-center gap-1.5 rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-foreground-700"><i class="${canCancel ? 'ri-checkbox-circle-fill text-primary-600' : 'ri-lock-2-fill text-foreground-500'}" aria-hidden="true"></i>${canCancel ? 'Hiện vẫn còn trong thời gian được hủy' : 'Đã qua hạn hủy, cần liên hệ hotline'}</p></div>
      </div></div>
      <div class="mt-4 rounded-md bg-accent-50 px-4 py-3 text-xs leading-relaxed text-accent-900"><span class="font-semibold">Lưu ý:</span> Có mặt trước giờ chơi 10 phút và đưa mã vé cho nhân viên. Cần đổi giờ, hãy gọi ${HOTLINE}; cần hủy, hãy làm trước hạn ghi trên vé để được hoàn 100% cọc.</div>
      ${
        confirmed
          ? `<div class="mt-6 flex flex-col gap-2.5 sm:flex-row">
        <button type="button" data-download class="flex flex-1 cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-md bg-primary-500 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-primary-600 disabled:opacity-70"><i class="ri-download-2-line text-base" aria-hidden="true"></i>Tải vé về máy</button>
        <button type="button" data-share class="flex cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-md border border-primary-300 bg-primary-50 px-4 py-3 text-sm font-semibold text-primary-800 transition-colors hover:bg-primary-100 sm:flex-none sm:px-5"><i class="ri-share-forward-2-line text-base" aria-hidden="true"></i>Chia sẻ vé</button>
        <button type="button" onclick="window.print()" class="flex cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-md border border-background-300 px-4 py-3 text-sm font-semibold text-foreground-800 transition-colors hover:border-primary-400 hover:text-primary-700 sm:flex-none sm:px-5"><i class="ri-printer-line" aria-hidden="true"></i>In vé</button></div>
        <p class="mt-2 text-center text-[11px] leading-relaxed text-foreground-500">Ảnh vé có đầy đủ mã QR, giờ chơi và hạn hủy — không cần in giấy. Chia sẻ nhanh cho người cùng đội qua Zalo hoặc Messenger.</p>
        <p data-save-note class="mt-3 hidden"></p>`
          : ''
      }
      <a href="${url('/dat-san')}" class="mt-2.5 block w-full cursor-pointer whitespace-nowrap rounded-md border border-background-300 px-4 py-3 text-center text-sm font-semibold text-foreground-800 transition-colors hover:border-primary-400 hover:text-primary-700">Đặt sân mới</a>
      <a href="${url(`/don-dat-san/${encodeURIComponent(b.code)}`)}" class="mt-3 flex items-center justify-between gap-2 rounded-md bg-primary-500 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-primary-600"><span class="flex items-center gap-2"><i class="ri-qr-code-line" aria-hidden="true"></i>Mở trang đơn: vé QR, chia sẻ link, nhắc lịch</span><i class="ri-arrow-right-line" aria-hidden="true"></i></a>
      <a href="${url('/tai-khoan?tab=upcoming')}" class="mt-2.5 flex items-center justify-between gap-2 rounded-md bg-primary-50 px-4 py-3 text-sm font-semibold text-primary-800 transition-colors hover:bg-primary-100"><span class="flex items-center gap-2"><i class="ri-calendar-event-line" aria-hidden="true"></i>Theo dõi đơn trong tài khoản của tôi</span><i class="ri-arrow-right-line" aria-hidden="true"></i></a>
    </div>
    <p class="mt-5 text-center text-xs text-foreground-500">Cần hỗ trợ? Gọi <a href="tel:${HOTLINE.replace(/\D/g, '')}" class="font-semibold text-primary-600 hover:text-primary-700">${HOTLINE}</a> hoặc gửi yêu cầu tại trang <a href="${url('/lien-he')}" class="font-semibold text-primary-600 hover:text-primary-700">Liên hệ</a>.</p>
  </div></div>`;
  const data = ticketData(b);
  view.querySelector('[data-download]')?.addEventListener('click', async (event) => {
    const btn = event.currentTarget;
    btn.disabled = true;
    const note = view.querySelector('[data-save-note]');
    try {
      const msg = await downloadTicket(data);
      note.className = 'mt-3 flex items-start gap-2 rounded-md border border-primary-300 bg-primary-50/70 px-3.5 py-2.5 text-xs leading-relaxed text-foreground-800';
      note.innerHTML = `<i class="ri-checkbox-circle-line mt-0.5 text-primary-600" aria-hidden="true"></i><span>${esc(msg)}</span>`;
    } catch (error) {
      note.className = 'mt-3 flex items-start gap-2 rounded-md border border-accent-300 bg-accent-50 px-3.5 py-2.5 text-xs leading-relaxed text-accent-900';
      note.innerHTML = `<i class="ri-error-warning-line mt-0.5 text-accent-700" aria-hidden="true"></i><span>${esc(error.message || 'Chưa tải được ảnh vé.')}</span>`;
    }
    btn.disabled = false;
  });
  view.querySelector('[data-share]')?.addEventListener('click', () => openShareSheet(data));
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ======================= ĐIỀU HƯỚNG BƯỚC =======================
function renderAll() {
  renderSteps();
  renderError();
  if (S.step === 1) renderStep1();
  else if (S.step === 2) renderStep2();
  else renderStep3();
  renderNav();
  renderSummary();
}

async function goNext() {
  S.error = '';
  if (S.step === 1) {
    if (!court()) S.error = 'Vui lòng chọn sân bạn muốn đặt.';
    else if (!S.startSlot) S.error = 'Vui lòng chọn khung giờ còn trống trên lưới giờ.';
    if (S.error) return renderError();
    S.step = 2;
    renderAll();
    window.scrollTo({ top: 0, behavior: 'smooth' });
    if (S.promoCode && !S.applied) applyPromo(true);
    return;
  }
  // Bước 2: kiểm tra thông tin rồi tạo đơn giữ sân
  const f = S.form;
  const errors = {};
  const name = f.name.trim();
  const phone = f.phone.replace(/\s/g, '');
  if (name.length < 2 || name.length > 50) errors.name = 'Họ tên cần từ 2 đến 50 ký tự.';
  if (!/^0\d{9}$/.test(phone)) errors.phone = 'Số điện thoại phải gồm 10 số và bắt đầu bằng 0.';
  if (f.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email.trim())) errors.email = 'Email chưa đúng định dạng. Ví dụ: minhquan@gmail.com.';
  S.fieldErrors = errors;
  if (Object.keys(errors).length) return renderStep2();
  if (!S.agree) {
    S.error = 'Vui lòng tích đồng ý chính sách hủy sân để tiếp tục.';
    return renderError();
  }
  S.busy = true;
  renderNav();
  try {
    S.booking = await api('booking', 'create', {
      courtSlug: S.courtSlug,
      date: S.date,
      startSlot: S.startSlot,
      duration: S.duration,
      name,
      phone,
      email: f.email.trim(),
      note: f.note.trim(),
      extras: S.extras,
      promoCode: S.applied ? S.applied.promotion.code : '',
      depositMode: S.depositMode,
    });
    rememberBookingCode(S.booking.code);
    S.step = 3;
    S.busy = false;
    renderAll();
    startHoldTimer();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  } catch (error) {
    S.busy = false;
    S.error = `Chưa giữ được sân: ${error.message}`;
    renderError();
    renderNav();
    loadAvailability();
  }
}

function goBack() {
  S.error = '';
  if (S.step === 3 && S.booking) {
    api('booking', 'cancel_hold', { id: S.booking.id }).catch(() => {});
    S.booking = null;
    clearInterval(holdTimer);
  }
  S.step = Math.max(1, S.step - 1);
  renderAll();
  if (S.step === 1) loadAvailability();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ======================= SỰ KIỆN =======================
const app = $('#booking-app');
app.addEventListener('click', async (event) => {
  const t = event.target;
  const el = (sel) => t.closest(sel);
  if (el('[data-next]')) return goNext();
  if (el('[data-back-step]')) return goBack();
  if (el('[data-court]')) {
    S.courtSlug = el('[data-court]').dataset.court;
    S.startSlot = '';
    S.error = '';
    renderError();
    renderCourtList();
    renderSlots();
    return renderSummary();
  }
  if (el('[data-sport]')) {
    S.filters.sport = el('[data-sport]').dataset.sport;
    return renderCourtList();
  }
  if (el('[data-reset-filters]')) {
    S.filters = { keyword: '', sport: 'all', area: '', priceId: 'all', sort: 'popular' };
    return renderStep1();
  }
  if (el('[data-date]')) {
    S.date = el('[data-date]').dataset.date;
    S.startSlot = '';
    S.error = '';
    renderError();
    renderDates();
    renderSummary();
    return loadAvailability();
  }
  if (el('[data-duration]')) {
    S.duration = Number(el('[data-duration]').dataset.duration);
    if (S.startSlot && slotState(S.startSlot) !== 'free') {
      S.startSlot = '';
      S.error = 'Khung giờ vừa chọn không còn trống. Vui lòng chọn khung giờ khác.';
      renderError();
    }
    renderDates();
    renderSlots();
    return renderSummary();
  }
  if (el('[data-slot]')) {
    S.startSlot = el('[data-slot]').dataset.slot;
    S.error = '';
    renderError();
    renderSlots();
    return renderSummary();
  }
  if (el('[data-apply-promo]')) return applyPromo();
  if (el('[data-remove-promo]')) {
    S.applied = null;
    S.promoCode = '';
    S.promoError = '';
    renderPromo();
    return renderSummary();
  }
  if (el('[data-mode]')) {
    S.depositMode = el('[data-mode]').dataset.mode;
    try {
      S.booking = await api('booking', 'set_mode', { id: S.booking.id, mode: S.depositMode });
    } catch (error) {
      S.error = error.message;
    }
    return renderStep3();
  }
  if (el('[data-copy]')) {
    const ok = await copyText(el('[data-copy]').dataset.copy);
    const icon = el('[data-copy]').querySelector('i');
    if (ok && icon) {
      icon.className = 'ri-check-line text-primary-600';
      setTimeout(() => (icon.className = 'ri-file-copy-line'), 1600);
    }
    return;
  }
  if (el('[data-confirm]')) return confirmDeposit();
  if (el('[data-cancel-hold]')) {
    if (S.booking) await api('booking', 'cancel_hold', { id: S.booking.id }).catch(() => {});
    S.booking = null;
    S.error = '';
    S.step = 2;
    clearInterval(holdTimer);
    renderAll();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
});

app.addEventListener('input', (event) => {
  const t = event.target;
  if (t.id === 'f-keyword') {
    S.filters.keyword = t.value;
    return renderCourtList();
  }
  if (t.dataset.form) {
    S.form[t.dataset.form] = t.value;
    if (t.dataset.form === 'note') $('[data-note-count]').textContent = `${t.value.length}/500`;
    return;
  }
  if (t.id === 'promo-input') {
    t.value = t.value.toUpperCase();
    S.promoCode = t.value;
    S.promoError = '';
  }
});

app.addEventListener('change', (event) => {
  const t = event.target;
  if (t.id === 'f-area') S.filters.area = t.value;
  if (t.id === 'f-price') S.filters.priceId = t.value;
  if (t.id === 'f-sort') S.filters.sort = t.value;
  if (['f-area', 'f-price', 'f-sort'].includes(t.id)) return renderCourtList();
  if (t.dataset.extra) {
    const id = t.dataset.extra;
    S.extras = t.checked ? [...S.extras, id] : S.extras.filter((x) => x !== id);
    const label = t.closest('label');
    label.classList.toggle('border-primary-400', t.checked);
    label.classList.toggle('bg-primary-50', t.checked);
    label.classList.toggle('border-background-300', !t.checked);
    label.classList.toggle('bg-white', !t.checked);
    return revalidatePromo();
  }
  if (t.dataset.agree !== undefined) {
    S.agree = t.checked;
    S.error = '';
    renderError();
  }
});

// Cứ 30 giây vẽ lại lưới giờ để khóa các khung vừa trôi qua
setInterval(() => S.step === 1 && renderSlots(), 30000);

renderAll();
loadAvailability();
