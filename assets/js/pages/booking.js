/*
 * Module: Controller luồng Đặt sân 3 bước (Mã Minh Hoan - PK04409)
 * - Quản lý state đặt sân, tải slot bận theo ngày và vẽ lưới giờ kèm giá động
 * - Validate form thông tin, kiểm tra điều kiện voucher và tính tổng tiền real-time
 * - Điều khiển luồng duyệt đơn & đồng hồ giữ chỗ 5 phút, đối soát thanh toán VietQR và render vé QR
 */

import { $, $$, PAGE, APP, api, esc, url, cx, formatVnd, copyText, openModal, toast } from '../core/ui.js';
import { ticketData, ticketQrUrl, downloadTicket, openShareSheet } from '../core/ticket.js';
import { buildDaySlots, calcCourtPriceForRange, getPriceBands, lowestPrice, priceBandAt } from '../lib/courtPricing.js';
import { DURATION_OPTIONS, calcDeposit, endTimeOf, extraServices, formatCountdown, formatTimeRange, remainingHoldSeconds, slotsInRange } from '../lib/booking.js';
import { formatLongDate, getUpcomingDates, isPastSlot, isTodayIso, toIsoDate } from '../lib/format.js';
import { describeDiscount, describeConditions, computeDiscount, checkPromotion, normalizePromoCode } from '../lib/promotions.js';
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

const DRAFT_KEY = 'datsan_booking_draft';

function saveDraft() {
  try {
    sessionStorage.setItem(
      DRAFT_KEY,
      JSON.stringify({
        step: S.step,
        courtSlug: S.courtSlug,
        date: S.date,
        duration: S.duration,
        startSlot: S.startSlot,
        form: S.form,
        extras: S.extras,
        agree: S.agree,
        promoCode: S.promoCode,
        applied: S.applied,
        depositMode: S.depositMode,
        booking: S.booking,
        savedAt: Date.now(),
      })
    );
  } catch (e) { }
}

function clearDraft() {
  try {
    sessionStorage.removeItem(DRAFT_KEY);
  } catch (e) { }
}

function restoreDraft() {
  try {
    const raw = sessionStorage.getItem(DRAFT_KEY);
    if (!raw) return false;
    const draft = JSON.parse(raw);
    if (!draft || typeof draft !== 'object') return false;
    // Hết hạn sau 30 phút
    if (Date.now() - (draft.savedAt || 0) > 30 * 60 * 1000) {
      clearDraft();
      return false;
    }
    // Nếu URL preset slug khác court đã lưu thì không phục hồi
    if (preset.slug && draft.courtSlug && preset.slug !== draft.courtSlug) {
      return false;
    }
    if (draft.courtSlug && courts.some((c) => c.slug === draft.courtSlug)) {
      S.courtSlug = draft.courtSlug;
    }
    if (draft.date && draft.date >= todayIso) S.date = draft.date;
    if (draft.duration && [60, 90, 120].includes(draft.duration)) S.duration = draft.duration;
    if (draft.startSlot) S.startSlot = draft.startSlot;
    if (Array.isArray(draft.extras)) S.extras = draft.extras;
    if (draft.agree !== undefined) S.agree = draft.agree;
    if (draft.promoCode) S.promoCode = draft.promoCode;
    if (draft.applied) S.applied = draft.applied;
    if (draft.depositMode) S.depositMode = draft.depositMode;

    // Ưu tiên thông tin của tài khoản nếu vừa mới đăng nhập thành công
    S.form = { ...(draft.form || {}), ...(PAGE.contact || {}) };

    // Bước 3: Đang chờ duyệt hoặc chuyển cọc
    if (draft.step === 3 && draft.booking) {
      if (!draft.booking.approvedAt) {
        S.booking = draft.booking;
        S.step = 3;
        return true;
      }
      const remaining = remainingHoldSeconds(draft.booking.holdExpiresAt);
      if (remaining > 0) {
        S.booking = draft.booking;
        S.step = 3;
        return true;
      } else {
        S.step = 2;
        S.error = 'Thời gian 5 phút chuyển cọc trước đó đã hết hạn. Vui lòng gửi lại yêu cầu đặt sân nhé.';
        return true;
      }
    }

    if (draft.step === 2 && S.courtSlug && S.startSlot) {
      S.step = 2;
      return true;
    }
  } catch (e) { }
  return false;
}

const court = () => courts.find((c) => c.slug === S.courtSlug);
const currentServices = () => {
  const c = court();
  const all = Array.isArray(PAGE.services) && PAGE.services.length > 0
    ? PAGE.services
    : extraServices.map((x) => ({ id: x.id, name: x.label, price: x.price, unit: 'lượt', hasVariants: false, variants: [], sport: 'all' }));
  if (!c) return all;

  // Lọc chỉ những dịch vụ thuộc đúng môn thể thao của sân đang chọn (hoặc dùng chung 'all'):
  const sport = c.sport; // 'football' hoặc 'badminton'
  let list = all.filter((s) => !s.sport || s.sport === 'all' || s.sport === sport);

  if (c.ownerId) {
    const ownerList = list.filter((s) => s.ownerId === c.ownerId);
    if (ownerList.length > 0) return ownerList;
  }
  return list;
};

/** Lấy số lượng đã chọn của 1 biến thể cụ thể */
const getVarQty = (vid) => {
  const it = S.extras.find((x) => typeof x === 'object' && x?.variantId === vid);
  return it ? Math.max(0, Number(it.quantity) || 0) : 0;
};

/** Lấy số lượng đã chọn của 1 dịch vụ đơn giản (không có biến thể) */
const getSimpleQty = (sid) => {
  const it = S.extras.find((x) => typeof x === 'string' ? x === sid : (x.id === sid && !x.variantId));
  return it ? (typeof it === 'string' ? 1 : Math.max(1, Number(it.quantity) || 1)) : 0;
};

/** Lấy tổng số lượng tất cả biến thể của 1 dịch vụ */
const getServiceTotalQty = (sid) => {
  return S.extras.reduce((sum, x) => {
    if (typeof x === 'string') return x === sid ? sum + 1 : sum;
    if (x && x.id === sid) return sum + Math.max(1, Number(x.quantity) || 1);
    return sum;
  }, 0);
};

/** Lấy tổng tiền đã chọn của 1 dịch vụ */
const getServiceTotalPrice = (sid) => {
  return S.extras.reduce((sum, x) => {
    if (typeof x === 'string') {
      if (x === sid) {
        const s = currentServices().find((s0) => s0.id === sid);
        return sum + Number(s?.price || 0);
      }
      return sum;
    }
    if (x && x.id === sid) {
      return sum + Number(x.price || 0) * Math.max(1, Number(x.quantity) || 1);
    }
    return sum;
  }, 0);
};

/** Kiểm tra xem dịch vụ này có ít nhất 1 biến thể / lượt chọn hay không */
const isServiceSelected = (sid) => getServiceTotalQty(sid) > 0;

/** Danh sách các biến thể đang được chọn của 1 dịch vụ */
const getServiceSelectedVariants = (sid) => {
  return S.extras.filter((x) => typeof x === 'object' && x?.id === sid && x?.variantId && (Number(x.quantity) || 0) > 0);
};
const findExtra = (id) => S.extras.find((x) => (typeof x === 'string' ? x === id : x.id === id));
const extrasTotal = () => {
  return S.extras.reduce((sum, item) => {
    if (typeof item === 'string') {
      const s = currentServices().find((x) => x.id === item) || extraServices.find((x) => x.id === item);
      return sum + (s ? Number(s.price || 0) : 0);
    }
    const price = Number(item.price || 0);
    const qty = Math.max(1, Number(item.quantity) || 1);
    return sum + price * qty;
  }, 0);
};
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
  const steps = ['Chọn sân & giờ', 'Thông tin', 'Duyệt & Chuyển cọc'];
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
    ${S.step > 1
      ? `<button type="button" data-back-step class="inline-flex cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-md border border-background-300 px-4 py-2.5 text-sm font-semibold text-foreground-800 transition-colors hover:border-primary-400 hover:text-primary-700"><i class="ri-arrow-left-line" aria-hidden="true"></i>Quay lại</button>`
      : `<a href="${url('/tim-san')}" class="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md border border-background-300 px-4 py-2.5 text-sm font-semibold text-foreground-800 transition-colors hover:border-primary-400 hover:text-primary-700"><i class="ri-arrow-left-line" aria-hidden="true"></i>Xem danh sách sân</a>`
    }
    <button type="button" data-next ${S.busy ? 'disabled' : ''} class="inline-flex cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-md bg-accent-500 px-5 py-3 text-sm font-bold text-background-950 transition-colors hover:bg-accent-600 disabled:cursor-not-allowed disabled:opacity-60">
      ${S.busy ? '<i class="ri-loader-4-line animate-spin text-base" aria-hidden="true"></i>' : ''}${S.step === 2 ? 'Gửi yêu cầu đặt sân' : 'Tiếp tục'}<i class="ri-arrow-right-line" aria-hidden="true"></i></button></div>`;
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
  const tPrice = total();
  const depPrice = calcDeposit(tPrice);
  const remPrice = Math.max(0, tPrice - depPrice);
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
      ${band ? `${row('Khung giá', `${esc(band.shortLabel)}<span class="block text-[11px] font-normal text-foreground-500">${band.start} - ${band.end} · ${formatVnd(band.price)}/giờ</span>`)}` : row('Khung giá', 'Chưa chọn giờ')}
      ${extrasTotal() > 0 ? `
        <div class="space-y-1.5 border-t border-dashed border-background-200 pt-2 text-xs">
          <div class="flex items-center justify-between font-bold text-foreground-800">
            <span>Dịch vụ thêm:</span>
            <span class="text-primary-700">${formatVnd(extrasTotal())}</span>
          </div>
          ${S.extras.map((x) => {
    if (typeof x === 'string') {
      const s = currentServices().find((s0) => s0.id === x) || extraServices.find((s0) => s0.id === x);
      return `<div class="flex justify-between text-foreground-600 pl-2"><span>• ${esc(s?.name || s?.label || x)}</span><span>${formatVnd(s?.price || 0)}</span></div>`;
    }
    const q = Math.max(1, x.quantity || 1);
    return `<div class="flex justify-between text-foreground-600 pl-2">
              <span class="truncate max-w-[210px]">• ${esc(x.label || x.name)}${x.variantName ? ` <i class="text-[11px] text-primary-700 font-normal">(${esc(x.variantName)})</i>` : ''}${q > 1 ? ` x${q}` : ''}</span>
              <span class="shrink-0 font-medium">${formatVnd((x.price || 0) * q)}</span>
            </div>`;
  }).join('')}
        </div>
      ` : ''}
      ${discount() > 0 ? `<div class="flex items-center justify-between gap-3"><dt class="flex items-center gap-1 text-foreground-500"><i class="ri-coupon-3-line text-primary-600" aria-hidden="true"></i>Mã ${esc(S.applied.promotion.code)}</dt><dd class="font-semibold text-accent-700">-${formatVnd(discount())}</dd></div>` : ''}
    </dl>
    <div class="mt-4 rounded-lg border border-background-200 bg-background-50 p-4">
      <div class="flex items-center justify-between text-sm">
        <span class="font-medium text-foreground-600">Tổng tiền sân:</span>
        <span class="font-heading text-base font-bold text-foreground-950">${S.startSlot ? formatVnd(tPrice) : '—'}</span>
      </div>
      <div class="mt-2.5 flex items-center justify-between border-t border-background-200 pt-2.5 text-sm">
        <div>
          <span class="font-semibold text-primary-700 dark:text-primary-300">Tiền cọc (30%):</span>
          <span class="block text-[10px] text-foreground-500">Chuyển sau khi chủ sân duyệt</span>
        </div>
        <span class="font-heading text-lg font-bold text-primary-600 dark:text-primary-400">${S.startSlot ? formatVnd(depPrice) : '—'}</span>
      </div>
      ${S.startSlot ? `
        <div class="mt-2 flex items-center justify-between border-t border-dashed border-background-200 pt-2 text-xs text-foreground-600">
          <span>Còn lại thanh toán tại sân:</span>
          <span class="font-medium text-foreground-800">${formatVnd(remPrice)}</span>
        </div>
      ` : ''}
    </div>
    <div class="mt-3 rounded-md bg-primary-50/60 p-2.5 text-[11px] leading-relaxed text-foreground-600 dark:bg-primary-950/30">
      <i class="ri-information-line mr-1 text-primary-600" aria-hidden="true"></i>
      ${S.startSlot ? `Sau khi gửi yêu cầu, chủ sân sẽ duyệt lịch. Khi chủ sân duyệt, bạn có <b>5 phút</b> để chuyển cọc giữ chỗ. Quá 5 phút chưa cọc, sân sẽ tự động hủy.` : 'Chọn khung giờ để xem chi tiết tiền sân và tiền cọc.'}
    </div>
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
  $('#f-count').innerHTML = `<p class="text-xs text-foreground-500">Tìm thấy <span class="font-bold text-foreground-950">${list.length}</span> / ${courts.length} sân</p>${hasFilters ? `<button type="button" data-reset-filters class="inline-flex cursor-pointer items-center gap-1 whitespace-nowrap rounded-md px-2 py-1 text-xs font-semibold text-primary-600 transition-colors hover:bg-primary-50 hover:text-primary-700"><i class="ri-refresh-line text-sm" aria-hidden="true"></i>Xóa bộ lọc</button>` : ''
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

/** Hộp thoại Pop-up chọn phân loại biến thể đa thuộc tính */
function openVariantModal(serviceId) {
  const s = currentServices().find((x) => x.id === serviceId);
  if (!s || !s.variants || s.variants.length === 0) return;

  const tempQty = {};
  s.variants.forEach((v) => {
    tempQty[v.id] = getVarQty(v.id);
  });

  let activeFilter = 'all';
  const firstAttr = Array.isArray(s.attributesSchema) && s.attributesSchema.length > 0 ? s.attributesSchema[0] : null;

  const countForOpt = (opt) => s.variants.filter((v) => {
    if (!v.attributes || typeof v.attributes !== 'object') return false;
    return Object.values(v.attributes).some((val) => val === opt || String(val).includes(opt));
  }).length;

  const validFilterOptions = firstAttr && Array.isArray(firstAttr.options)
    ? firstAttr.options.filter((opt) => countForOpt(opt) > 0)
    : [];

  const modalInstance = openModal({
    size: 'max-w-lg',
    html: `<div id="modal-var-body"></div>`,
    dismissible: true,
  });

  const renderModalContent = () => {
    const totalSelectedQty = Object.values(tempQty).reduce((a, b) => a + b, 0);
    const totalSelectedMoney = s.variants.reduce((sum, v) => sum + (tempQty[v.id] || 0) * v.price, 0);

    const filteredVariants = activeFilter === 'all'
      ? s.variants
      : s.variants.filter((v) => {
        if (!v.attributes || typeof v.attributes !== 'object') return true;
        return Object.values(v.attributes).some((val) => val === activeFilter || String(val).includes(activeFilter));
      });

    const body = modalInstance.el.querySelector('#modal-var-body');
    if (!body) return;

    body.innerHTML = `
      <div class="p-5 md:p-6">
        <div class="flex items-start justify-between gap-3 border-b border-background-200 pb-3.5">
          <div class="min-w-0">
            <div class="flex items-center gap-2 flex-wrap">
              <span class="inline-flex items-center justify-center h-7 w-7 rounded-md bg-primary-100 text-primary-700 text-sm"><i class="ri-apps-2-line"></i></span>
              <h3 class="font-heading text-lg font-bold text-foreground-950">${esc(s.name)}</h3>
            </div>
            <p class="mt-1 text-xs text-foreground-500">
              Chọn phân loại và số lượng phù hợp cho nhu cầu của bạn. Có thể chọn cùng lúc nhiều loại.
            </p>
          </div>
          <button type="button" data-modal-close class="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-background-200 bg-white text-foreground-500 hover:bg-background-100 hover:text-foreground-900 transition-colors cursor-pointer" aria-label="Đóng">
            <i class="ri-close-line text-lg"></i>
          </button>
        </div>

        ${validFilterOptions.length > 1 ? `
          <div class="mt-3.5 flex items-center gap-1.5 overflow-x-auto pb-1 text-xs" style="scrollbar-width:none">
            <span class="text-foreground-500 font-medium shrink-0 mr-1">${esc(firstAttr.name)}:</span>
            <button type="button" data-filter-attr="all" class="cursor-pointer whitespace-nowrap rounded-full px-3 py-1 font-semibold transition-colors ${activeFilter === 'all' ? 'bg-primary-600 text-white shadow-2xs' : 'bg-background-100 text-foreground-700 hover:bg-background-200'}">Tất cả (${s.variants.length})</button>
            ${validFilterOptions.map((opt) => `
              <button type="button" data-filter-attr="${esc(opt)}" class="cursor-pointer whitespace-nowrap rounded-full px-3 py-1 font-semibold transition-colors ${activeFilter === opt ? 'bg-primary-600 text-white shadow-2xs' : 'bg-background-100 text-foreground-700 hover:bg-background-200'}">${esc(opt)} (${countForOpt(opt)})</button>
            `).join('')}
          </div>
        ` : ''}

        <div class="mt-3.5 space-y-2 min-h-[160px] max-h-[50vh] overflow-y-auto pr-1">
          ${filteredVariants.length === 0 ? `
            <div class="py-12 text-center text-xs text-foreground-400 flex flex-col items-center justify-center">
              <i class="ri-inbox-line text-3xl text-foreground-300 mb-2"></i>
              <span>Không có phân loại nào thuộc nhóm này.</span>
            </div>
          ` : filteredVariants.map((v) => {
      const qty = tempQty[v.id] || 0;
      const on = qty > 0;
      const maxStock = Number(v.stock) || 99;
      const attrLabels = v.attributes && typeof v.attributes === 'object'
        ? Object.entries(v.attributes).map(([k, val]) => `<span class="inline-flex items-center rounded bg-background-100 px-2 py-0.5 text-[11px] font-medium text-foreground-700">${esc(k)}: <b class="ml-1 text-foreground-900">${esc(val)}</b></span>`).join(' ')
        : '';

      return `
              <div class="flex items-center justify-between gap-3 rounded-lg border p-3 transition-colors ${on ? 'border-primary-400 bg-primary-50/60 shadow-2xs' : 'border-background-200 bg-white hover:border-background-300'}">
                <div class="min-w-0 flex-1">
                  <div class="flex items-center gap-2 flex-wrap">
                    <p class="font-bold text-sm text-foreground-950">${esc(v.name)}</p>
                    ${v.sku ? `<span class="text-[10px] font-mono text-foreground-400 bg-background-100 px-1 rounded">${esc(v.sku)}</span>` : ''}
                  </div>
                  <div class="flex flex-wrap items-center gap-1.5 mt-1">
                    ${attrLabels}
                  </div>
                  <div class="flex items-center gap-2 mt-1.5 text-xs">
                    <span class="font-extrabold text-primary-700 text-sm">${formatVnd(v.price)}</span>
                    <span class="text-foreground-300">•</span>
                    <span class="${v.stock <= 5 ? 'text-accent-600 font-bold' : 'text-foreground-500'}">Còn ${v.stock} ${esc(s.unit || 'món')}</span>
                  </div>
                </div>

                <div class="flex items-center gap-1.5 shrink-0 bg-background-100 p-1 rounded-md border border-background-200">
                  <button type="button" data-m-var="${esc(v.id)}" data-m-delta="-1" class="flex h-7 w-7 items-center justify-center rounded border border-background-300 bg-white text-xs font-bold text-foreground-800 hover:bg-background-50 transition-colors ${qty <= 0 ? 'opacity-30 cursor-not-allowed' : 'cursor-pointer'}" ${qty <= 0 ? 'disabled' : ''}>-</button>
                  <span class="w-7 text-center font-bold text-sm ${on ? 'text-primary-800' : 'text-foreground-500'}">${qty}</span>
                  <button type="button" data-m-var="${esc(v.id)}" data-m-delta="1" class="flex h-7 w-7 items-center justify-center rounded border border-background-300 bg-white text-xs font-bold text-foreground-800 hover:bg-background-50 transition-colors ${v.stock > 0 && qty >= maxStock ? 'opacity-30 cursor-not-allowed' : 'cursor-pointer'}" ${v.stock > 0 && qty >= maxStock ? 'disabled' : ''}>+</button>
                </div>
              </div>
            `;
    }).join('')}
        </div>

        <div class="mt-4 pt-3.5 border-t border-background-200 flex flex-wrap items-center justify-between gap-3">
          <div>
            <div class="flex items-center gap-2">
              <span class="text-xs text-foreground-500 block">Tổng phân loại đã chọn:</span>
              ${totalSelectedQty > 0 ? `<button type="button" data-m-reset class="cursor-pointer text-[11px] font-semibold text-accent-600 hover:underline">Bỏ chọn hết</button>` : ''}
            </div>
            <div class="flex items-baseline gap-1.5 mt-0.5">
              <span class="font-heading text-lg font-extrabold text-primary-700">${formatVnd(totalSelectedMoney)}</span>
              <span class="text-xs font-semibold text-foreground-700">(${totalSelectedQty} ${esc(s.unit || 'món')})</span>
            </div>
          </div>
          <div class="flex items-center gap-2 ml-auto">
            <button type="button" data-modal-cancel class="cursor-pointer rounded-md border border-background-300 bg-white px-3.5 py-2 text-xs font-semibold text-foreground-700 hover:bg-background-100 transition-colors">Hủy</button>
            <button type="button" data-modal-apply class="cursor-pointer inline-flex items-center gap-1.5 rounded-md bg-primary-600 px-4 py-2 text-xs font-bold text-white hover:bg-primary-700 transition-colors shadow-xs">
              <i class="ri-check-line text-sm"></i>Áp dụng vào đơn
            </button>
          </div>
        </div>
      </div>
    `;
  };

  renderModalContent();

  modalInstance.el.addEventListener('click', (ev) => {
    const t = ev.target;
    if (t.closest('[data-modal-close]') || t.closest('[data-modal-cancel]')) {
      return modalInstance.close();
    }
    const filterBtn = t.closest('[data-filter-attr]');
    if (filterBtn) {
      activeFilter = filterBtn.dataset.filterAttr;
      return renderModalContent();
    }
    if (t.closest('[data-m-reset]')) {
      s.variants.forEach((v) => {
        tempQty[v.id] = 0;
      });
      return renderModalContent();
    }
    const qtyBtn = t.closest('[data-m-var]');
    if (qtyBtn) {
      const vid = qtyBtn.dataset.mVar;
      const delta = Number(qtyBtn.dataset.mDelta) || 0;
      const v = s.variants.find((v0) => v0.id === vid);
      const cur = tempQty[vid] || 0;
      const next = Math.max(0, cur + delta);
      if (v && v.stock > 0 && next > v.stock) {
        tempQty[vid] = v.stock;
      } else {
        tempQty[vid] = next;
      }
      return renderModalContent();
    }
    if (t.closest('[data-modal-apply]')) {
      S.extras = S.extras.filter((x) => (typeof x === 'string' ? x !== s.id : x.id !== s.id));
      s.variants.forEach((v) => {
        const qty = tempQty[v.id] || 0;
        if (qty > 0) {
          S.extras.push({
            id: s.id,
            variantId: v.id,
            sku: v.sku,
            label: s.name,
            variantName: v.name,
            price: v.price,
            quantity: qty,
          });
        }
      });
      saveDraft();
      modalInstance.close();
      renderStep2();
      renderSummary();
      revalidatePromo();
    }
  });
}

function renderStep2() {
  const f = S.form;
  const loggedIn = !!PAGE.contact;
  $('#step-body').innerHTML = `
    <h2 class="font-heading text-lg font-bold text-foreground-950">Thông tin người đặt</h2>
    <p class="mt-1 text-sm text-foreground-600">Chỉ cần họ tên và số điện thoại. Không cần tạo tài khoản vẫn đặt được sân.</p>
    ${!loggedIn ? `
      <div class="mt-3 flex items-center justify-between gap-3 rounded-md border border-primary-200 bg-primary-50 px-3.5 py-2.5 text-xs text-primary-900">
        <span class="flex items-center gap-2"><i class="ri-user-line text-sm text-primary-600" aria-hidden="true"></i>Đã có tài khoản? Đăng nhập để tự động điền thông tin và lưu lịch sử đặt sân.</span>
        <a href="${url('/dang-nhap?redirect=' + encodeURIComponent(window.location.pathname + window.location.search))}" data-login-now class="font-bold text-primary-700 underline hover:text-primary-800">Đăng nhập</a>
      </div>
    ` : ''}
    <div class="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
      <div class="min-w-0"><label for="b-name" class="mb-1.5 block text-sm font-medium text-foreground-800">Họ và tên <span class="text-accent-600">*</span></label><input id="b-name" data-form="name" type="text" maxlength="50" value="${esc(f.name)}" placeholder="Nguyễn Minh Quân" class="${inputCls('name')}">${fieldError('name')}</div>
      <div class="min-w-0"><label for="b-phone" class="mb-1.5 block text-sm font-medium text-foreground-800">Số điện thoại <span class="text-accent-600">*</span></label><input id="b-phone" data-form="phone" type="tel" inputmode="numeric" maxlength="12" value="${esc(f.phone)}" placeholder="0912345678" class="${inputCls('phone')}">${fieldError('phone') || '<p class="mt-1 text-xs text-foreground-400">10 số, bắt đầu bằng 0. Chủ sân gọi xác nhận theo số này.</p>'}</div>
      <div class="min-w-0 sm:col-span-2"><label for="b-email" class="mb-1.5 block text-sm font-medium text-foreground-800">Email <span class="font-normal text-foreground-400">(không bắt buộc)</span></label><input id="b-email" data-form="email" type="email" value="${esc(f.email)}" placeholder="minhquan@gmail.com" class="${inputCls('email')}">${fieldError('email')}</div>
    </div>
    <div class="mt-5">
      <div class="flex items-center justify-between gap-2">
        <div>
          <p class="text-sm font-bold text-foreground-900 flex items-center gap-1.5"><i class="ri-shopping-basket-line text-primary-600"></i>Dịch vụ &amp; Đồ thuê tại sân</p>
          <p class="mt-0.5 text-xs text-foreground-500">Phục vụ trực tiếp tại sân. Bấm "Chọn phân loại" để chọn quy cách, kích cỡ theo nhu cầu.</p>
        </div>
        ${extrasTotal() > 0 ? `<span class="rounded bg-primary-100 text-primary-800 px-2.5 py-0.5 text-xs font-bold">+${formatVnd(extrasTotal())}</span>` : ''}
      </div>
      <div class="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        ${currentServices().map((s) => {
    const hasVars = s.hasVariants && Array.isArray(s.variants) && s.variants.length > 0;
    const totalQty = getServiceTotalQty(s.id);
    const totalPrice = getServiceTotalPrice(s.id);
    const isSelected = totalQty > 0;
    const minPrice = hasVars ? Math.min(...s.variants.map((v) => v.price)) : s.price;
    const selVars = hasVars ? getServiceSelectedVariants(s.id) : [];
    const attrHint = Array.isArray(s.attributesSchema) && s.attributesSchema.length > 0
      ? `Chọn ${s.attributesSchema.map((a) => a.name.toLowerCase()).join(', ')}`
      : `${s.variants?.length || 0} lựa chọn`;

    return `
            <div class="rounded-lg border p-3.5 transition-all ${isSelected ? 'border-primary-400 bg-primary-50/50 shadow-xs' : 'border-background-300 bg-white hover:border-primary-300'}">
              <div class="flex items-start justify-between gap-2.5 ${hasVars ? 'cursor-pointer' : ''}" ${hasVars ? `data-open-variants="${esc(s.id)}"` : ''}>
                <div class="min-w-0 flex-1">
                  <div class="flex items-center gap-1.5 flex-wrap">
                    <p class="font-bold text-sm text-foreground-950">${esc(s.name)}</p>
                    ${hasVars ? `<span class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-primary-100 text-primary-800"><i class="ri-apps-2-line mr-1 text-[11px]"></i>${s.variants.length} phân loại</span>` : ''}
                  </div>
                  <p class="text-xs text-foreground-500 mt-0.5">
                    ${hasVars ? `Giá từ <span class="font-bold text-primary-700">${formatVnd(minPrice)}</span>/${esc(s.unit || 'món')}` : `${formatVnd(s.price)}/${esc(s.unit || 'món')}`}
                  </p>
                </div>
                <div class="text-right shrink-0">
                  ${isSelected ? `
                    <span class="block text-xs font-extrabold text-primary-700">${formatVnd(totalPrice)}</span>
                    <span class="block text-[10px] font-semibold text-primary-800">${totalQty} ${esc(s.unit || 'món')}</span>
                  ` : `
                    <span class="block text-xs font-bold text-foreground-700">${formatVnd(minPrice)}</span>
                    <span class="block text-[10px] text-foreground-400">/${esc(s.unit || 'món')}</span>
                  `}
                </div>
              </div>

              ${hasVars ? `
                <div class="mt-3 pt-2.5 border-t border-primary-200/60 flex items-center justify-between text-xs">
                  ${isSelected ? `
                    <div class="min-w-0 flex-1 mr-2 cursor-pointer" data-open-variants="${esc(s.id)}">
                      <p class="text-[11px] text-foreground-700 truncate" title="${selVars.map((v) => `${v.variantName} x${v.quantity}`).join(', ')}">
                        Đã chọn: <span class="font-bold text-foreground-950">${selVars.map((v) => `${v.variantName} x${v.quantity}`).join(', ')}</span>
                      </p>
                    </div>
                    <div class="flex items-center gap-2 shrink-0">
                      <button type="button" data-open-variants="${esc(s.id)}" class="cursor-pointer font-bold text-primary-700 hover:text-primary-800 hover:underline inline-flex items-center gap-1"><i class="ri-edit-line"></i>Đổi loại</button>
                      <button type="button" data-clear-service="${esc(s.id)}" class="cursor-pointer text-foreground-400 hover:text-accent-600 p-1" title="Bỏ chọn dịch vụ này"><i class="ri-close-circle-line text-base"></i></button>
                    </div>
                  ` : `
                    <span class="text-foreground-500 text-[11px] truncate max-w-[55%]">${esc(attrHint)}</span>
                    <button type="button" data-open-variants="${esc(s.id)}" class="cursor-pointer inline-flex items-center gap-1.5 rounded border border-primary-500 bg-primary-50 px-2.5 py-1 text-xs font-bold text-primary-700 hover:bg-primary-100 transition-colors shadow-2xs">
                      <i class="ri-add-line font-bold"></i>Chọn phân loại
                    </button>
                  `}
                </div>
              ` : `
                <div class="mt-3 pt-2.5 border-t border-primary-200/60 flex items-center justify-between text-xs">
                  <label class="flex cursor-pointer items-center gap-2">
                    <input type="checkbox" data-simple-toggle="${esc(s.id)}" ${isSelected ? 'checked' : ''} class="h-4 w-4 rounded accent-primary-600 cursor-pointer">
                    <span class="text-foreground-700">${isSelected ? 'Đã thêm' : 'Chọn dùng'}</span>
                  </label>
                  ${isSelected ? `
                    <div class="flex items-center gap-1.5">
                      <button type="button" data-extra-simple-qty="${esc(s.id)}" data-delta="-1" class="flex h-6 w-6 items-center justify-center rounded border border-background-300 bg-white font-bold hover:bg-background-100 transition-colors cursor-pointer">-</button>
                      <span class="w-6 text-center font-bold text-foreground-950">${getSimpleQty(s.id)}</span>
                      <button type="button" data-extra-simple-qty="${esc(s.id)}" data-delta="1" class="flex h-6 w-6 items-center justify-center rounded border border-background-300 bg-white font-bold hover:bg-background-100 transition-colors cursor-pointer">+</button>
                    </div>
                  ` : ''}
                </div>
              `}
            </div>
          `;
  }).join('')}
      </div>
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
  box.innerHTML = `<div class="flex flex-wrap items-center justify-between gap-1.5"><p class="text-sm font-medium text-foreground-800">Mã giảm giá</p><button type="button" data-open-voucher-modal class="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap text-xs font-semibold text-primary-700 transition-colors hover:text-primary-800 hover:underline"><i class="ri-coupon-3-line text-sm" aria-hidden="true"></i>Xem tất cả mã đang chạy</button></div>
    <p class="mt-0.5 text-xs text-foreground-500">Nhập mã ưu đãi của chủ sân nếu bạn có hoặc chọn từ danh sách voucher.</p>
    ${S.applied
      ? `<div class="mt-2.5 flex flex-wrap items-center justify-between gap-2 rounded-md border border-primary-300 bg-primary-50 px-3.5 py-3"><div class="min-w-0"><p class="flex items-center gap-1.5 text-sm font-bold text-primary-900"><i class="ri-coupon-3-fill" aria-hidden="true"></i>${esc(S.applied.promotion.code)}<span class="rounded bg-primary-200 px-1.5 py-0.2 text-[10px] font-bold text-primary-800">Đang áp dụng</span></p><p class="mt-0.5 text-[11px] text-primary-800">${esc(describeDiscount(S.applied.promotion))}</p></div><div class="flex items-center gap-2.5"><span class="whitespace-nowrap text-sm font-extrabold text-accent-700">-${formatVnd(S.applied.discount)}</span><button type="button" data-open-voucher-modal class="cursor-pointer whitespace-nowrap text-[11px] font-semibold text-primary-700 underline transition-colors hover:text-primary-900">Đổi mã</button><button type="button" data-remove-promo class="cursor-pointer whitespace-nowrap text-[11px] font-semibold text-foreground-600 underline transition-colors hover:text-accent-700">Bỏ mã</button></div></div>`
      : `<div class="mt-2.5 flex flex-col gap-2 sm:flex-row"><div class="relative flex-1"><input type="text" id="promo-input" value="${esc(S.promoCode)}" maxlength="16" placeholder="Nhập mã, ví dụ BMT20" aria-label="Mã giảm giá" class="w-full min-w-0 rounded-md border border-background-300 bg-white px-3 py-2.5 font-mono text-sm font-semibold uppercase tracking-wider text-foreground-950 placeholder:font-sans placeholder:font-normal placeholder:normal-case placeholder:tracking-normal placeholder:text-foreground-400 focus:border-primary-400 focus:outline-none"></div><div class="flex items-center gap-2 shrink-0"><button type="button" data-apply-promo class="inline-flex shrink-0 cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-md bg-primary-500 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-600 disabled:cursor-not-allowed disabled:bg-background-300 disabled:text-foreground-500"><i class="ri-price-tag-3-line" aria-hidden="true"></i>Áp dụng</button><button type="button" data-open-voucher-modal class="inline-flex shrink-0 cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-md border border-primary-300 bg-primary-50 px-3.5 py-2.5 text-sm font-semibold text-primary-700 transition-colors hover:bg-primary-100 hover:border-primary-400"><i class="ri-coupon-3-line" aria-hidden="true"></i>Chọn voucher</button></div></div>`
    }
    ${S.promoError ? `<p class="mt-1.5 flex items-start gap-1 text-xs text-accent-700"><i class="ri-error-warning-line mt-0.5" aria-hidden="true"></i>${esc(S.promoError)}</p>` : ''}`;
}

function formatVoucherCountdown(expiresAt) {
  if (!expiresAt) return '';
  const exp = new Date(expiresAt).getTime();
  const now = Date.now();
  const diff = exp - now;
  if (isNaN(exp) || diff <= 0) return 'Đã hết hạn';
  const totalSecs = Math.floor(diff / 1000);
  const hours = Math.floor(totalSecs / 3600);
  const mins = Math.floor((totalSecs % 3600) / 60);
  const secs = totalSecs % 60;
  if (hours >= 24) {
    const days = Math.floor(hours / 24);
    const remH = hours % 24;
    return `${days} ngày ${remH}h ${mins}m`;
  }
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(hours)}:${pad(mins)}:${pad(secs)}`;
}

let voucherModalTab = 'all';

async function openVoucherModal() {
  let promos = PAGE.promotions;
  if (!promos || !promos.length) {
    try {
      promos = await api('booking', 'promotions');
      PAGE.promotions = promos;
    } catch (e) {
      promos = [];
    }
  }

  const orderTotal = subtotal();
  const c = court();
  const currentSlot = S.startSlot;
  const currentDate = S.date;

  // Đánh giá từng voucher theo điều kiện của đơn hiện tại
  const evaluated = (promos || []).map((p) => {
    let eligible = true;
    let reason = '';
    let discountAmount = 0;

    // 1. Kiểm tra giới hạn chủ sân
    if (p.ownerId && c?.ownerId && Number(p.ownerId) !== Number(c.ownerId)) {
      eligible = false;
      reason = `Chỉ áp dụng cho các sân thuộc cơ sở "${p.ownerName || 'Chủ sân khác'}"`;
    } else if (!currentSlot) {
      if (p.minOrder > 0) {
        eligible = false;
        reason = `Đơn tối thiểu ${formatVnd(p.minOrder)} (Vui lòng chọn khung giờ để tính tiền đơn)`;
      } else {
        eligible = true;
        reason = '';
      }
    } else {
      const ctx = {
        date: currentDate,
        startSlot: currentSlot,
        orderTotal,
        usedCount: 0,
      };
      const check = checkPromotion(p, ctx);
      if (!check.ok) {
        eligible = false;
        if (p.minOrder > 0 && orderTotal < p.minOrder) {
          const needed = p.minOrder - orderTotal;
          reason = `Đơn tối thiểu ${formatVnd(p.minOrder)} (Đơn hiện tại: ${formatVnd(orderTotal)} — cần thêm ${formatVnd(needed)} để dùng)`;
        } else {
          reason = check.message;
        }
      } else {
        eligible = true;
        discountAmount = computeDiscount(p, orderTotal);
      }
    }

    if (eligible && !p.isUserVoucher && p.usageLimit && p.remainingCount !== null && p.remainingCount !== undefined && p.remainingCount <= 0) {
      eligible = false;
      reason = 'Mã ưu đãi này đã hết số lượng phát hành.';
    }

    return {
      ...p,
      eligible,
      reason,
      discountAmount,
    };
  });

  const eligibleList = evaluated.filter((x) => x.eligible);
  const ineligibleList = evaluated.filter((x) => !x.eligible);

  function renderModalContent(activeTab = voucherModalTab) {
    voucherModalTab = activeTab;
    const isAll = activeTab === 'all';
    const isEligible = activeTab === 'eligible';
    const isIneligible = activeTab === 'ineligible';

    const displayList = isEligible ? eligibleList : isIneligible ? ineligibleList : evaluated;

    const renderVoucherCard = (item) => {
      const isSelected = S.applied && S.applied.promotion.code === item.code;
      const isPercent = item.discountType === 'percent';
      const badgeVal = isPercent ? `${item.discountValue}%` : (item.discountValue >= 1000 ? `${Math.round(item.discountValue / 1000)}K` : formatVnd(item.discountValue));
      const endFormatted = item.endDate ? item.endDate.split('-').reverse().join('/') : '';

      if (item.eligible) {
        return `
          <div class="relative flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3.5 rounded-xl border-2 ${isSelected ? 'border-primary-500 bg-primary-50/60 shadow-md' : 'border-background-200 bg-white hover:border-primary-400 hover:shadow-xs'} p-3.5 transition-all">
            <div class="flex items-start gap-3 min-w-0 flex-1">
              <div class="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 text-white shadow-xs">
                <span class="text-base font-extrabold leading-none">${badgeVal}</span>
                <span class="mt-0.5 text-[10px] font-bold uppercase tracking-wider opacity-90">GIẢM</span>
              </div>
              <div class="min-w-0 flex-1">
                <div class="flex flex-wrap items-center gap-1.5">
                  <span class="rounded bg-primary-100 px-2 py-0.5 font-mono text-xs font-bold text-primary-900">${esc(item.code)}</span>
                  ${item.ownerName ? `<span class="rounded bg-background-100 px-1.5 py-0.5 text-[10px] font-medium text-foreground-600">${esc(item.ownerName)}</span>` : '<span class="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold text-emerald-800">Toàn hệ thống</span>'}
                  ${item.isUserVoucher ? '<span class="rounded bg-accent-100 px-1.5 py-0.5 text-[10px] font-bold text-accent-800">Ví cá nhân</span>' : ''}
                </div>
                <h4 class="mt-1 font-heading text-sm font-bold text-foreground-950 truncate">${esc(item.title)}</h4>
                <p class="text-xs text-foreground-600 line-clamp-1">${esc(describeDiscount(item))} &bull; ${esc(describeConditions(item))}</p>
                <div class="mt-1 flex flex-wrap items-center gap-3 text-[11px]">
                  ${item.isUserVoucher && item.expiresAt ? `
                    <span class="flex items-center gap-1 font-bold text-accent-700 bg-accent-50 px-2 py-0.5 rounded border border-accent-200">
                      <i class="ri-timer-flash-line animate-pulse"></i>
                      Còn <span data-voucher-countdown="${item.expiresAt}">${formatVoucherCountdown(item.expiresAt)}</span>
                    </span>
                  ` : `
                    <span class="text-foreground-400 flex items-center gap-1"><i class="ri-time-line"></i>HSD: ${esc(endFormatted)}</span>
                  `}
                  ${item.discountAmount > 0 ? `<span class="font-bold text-emerald-700 flex items-center gap-0.5"><i class="ri-checkbox-circle-fill"></i>Tiết kiệm: -${formatVnd(item.discountAmount)}</span>` : ''}
                  ${item.usageLimit ? `<span class="text-foreground-500 font-mono text-[10px] flex items-center gap-0.5"><i class="ri-numbers-line"></i>Còn ${item.remainingCount !== undefined && item.remainingCount !== null ? item.remainingCount : item.usageLimit}/${item.usageLimit}</span>` : ''}
                </div>
              </div>
            </div>
            <div class="shrink-0 flex sm:flex-col justify-end items-center gap-2">
              ${isSelected
                ? `<button type="button" data-modal-select="${esc(item.code)}" class="w-full sm:w-auto inline-flex items-center justify-center gap-1 rounded-lg border border-primary-500 bg-primary-500 px-3.5 py-2 text-xs font-bold text-white shadow-xs transition-colors cursor-pointer"><i class="ri-check-line"></i>Đang dùng</button>`
                : `<button type="button" data-modal-select="${esc(item.code)}" class="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 rounded-lg bg-primary-500 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-primary-600 transition-all cursor-pointer"><i class="ri-coupon-3-line"></i>Áp dụng</button>`
              }
            </div>
          </div>
        `;
      } else {
        return `
          <div class="relative flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3.5 rounded-xl border border-background-200 bg-background-50/70 p-3.5 opacity-85 transition-all">
            <div class="flex items-start gap-3 min-w-0 flex-1">
              <div class="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-xl bg-background-200 text-foreground-400">
                <span class="text-base font-extrabold leading-none">${badgeVal}</span>
                <span class="mt-0.5 text-[10px] font-bold uppercase tracking-wider opacity-80">GIẢM</span>
              </div>
              <div class="min-w-0 flex-1">
                <div class="flex flex-wrap items-center gap-1.5">
                  <span class="rounded bg-background-200 px-2 py-0.5 font-mono text-xs font-semibold text-foreground-600">${esc(item.code)}</span>
                  ${item.ownerName ? `<span class="text-[10px] text-foreground-500">${esc(item.ownerName)}</span>` : ''}
                </div>
                <h4 class="mt-1 font-heading text-sm font-semibold text-foreground-800 truncate">${esc(item.title)}</h4>
                <p class="text-xs text-foreground-500 line-clamp-1">${esc(describeDiscount(item))} &bull; ${esc(describeConditions(item))}</p>
                ${item.isUserVoucher && item.expiresAt ? `
                  <div class="mt-1.5 flex items-center gap-1 text-[11px] font-bold text-accent-700">
                    <i class="ri-timer-line"></i>
                    Còn <span data-voucher-countdown="${item.expiresAt}">${formatVoucherCountdown(item.expiresAt)}</span>
                  </div>
                ` : ''}
                <div class="mt-2 flex items-start gap-1.5 rounded-md border border-amber-200/80 bg-amber-50/90 px-2.5 py-1.5 text-xs font-medium text-amber-800">
                  <i class="ri-error-warning-line shrink-0 text-amber-600 mt-0.5"></i>
                  <span>${esc(item.reason)}</span>
                </div>
              </div>
            </div>
            <div class="shrink-0 flex justify-end">
              <button type="button" disabled class="w-full sm:w-auto inline-flex items-center justify-center rounded-lg border border-background-300 bg-background-200 px-3.5 py-2 text-xs font-medium text-foreground-400 cursor-not-allowed">
                Chưa đủ ĐK
              </button>
            </div>
          </div>
        `;
      }
    };

    let listHtml = '';
    if (!displayList.length) {
      listHtml = `
        <div class="py-10 text-center">
          <div class="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-background-100 text-2xl text-foreground-400">
            <i class="ri-coupon-3-line"></i>
          </div>
          <p class="mt-3 text-sm font-semibold text-foreground-800">Không có mã nào ở mục này</p>
          <p class="mt-1 text-xs text-foreground-500">Hãy chuyển sang tab "Tất cả" để khám phá thêm ưu đãi nhé!</p>
        </div>
      `;
    } else if (isAll) {
      listHtml = `
        ${eligibleList.length ? `
          <div class="mb-4">
            <div class="mb-2.5 flex items-center justify-between">
              <h4 class="text-xs font-bold uppercase tracking-wide text-primary-800 flex items-center gap-1.5">
                <i class="ri-checkbox-circle-fill text-emerald-600"></i> Mã khả dụng cho đơn này (${eligibleList.length})
              </h4>
            </div>
            <div class="space-y-2.5">
              ${eligibleList.map(renderVoucherCard).join('')}
            </div>
          </div>
        ` : ''}
        ${ineligibleList.length ? `
          <div class="mt-5">
            <div class="mb-2.5 flex items-center justify-between">
              <h4 class="text-xs font-bold uppercase tracking-wide text-foreground-500 flex items-center gap-1.5">
                <i class="ri-error-warning-line text-amber-600"></i> Mã chưa đủ điều kiện (${ineligibleList.length})
              </h4>
              <span class="text-[11px] text-foreground-400">Xem lý do chi tiết dưới mỗi mã</span>
            </div>
            <div class="space-y-2.5">
              ${ineligibleList.map(renderVoucherCard).join('')}
            </div>
          </div>
        ` : ''}
      `;
    } else {
      listHtml = `<div class="space-y-2.5">${displayList.map(renderVoucherCard).join('')}</div>`;
    }

    return `
      <div class="flex items-center justify-between border-b border-background-200 bg-background-50 px-5 py-4">
        <div class="flex items-center gap-2.5">
          <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-100 text-primary-700 text-xl">
            <i class="ri-coupon-3-fill"></i>
          </div>
          <div>
            <h3 class="font-heading text-base font-bold text-foreground-950">Mã giảm giá & Voucher</h3>
            <p class="text-xs text-foreground-500">Đơn hiện tại: <b class="text-foreground-900">${formatVnd(orderTotal)}</b> &bull; ${c ? esc(c.name) : 'Chưa chọn sân'}</p>
          </div>
        </div>
        <button type="button" data-close class="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-foreground-400 transition-colors hover:bg-background-200 hover:text-foreground-700" aria-label="Đóng popup">
          <i class="ri-close-line text-xl"></i>
        </button>
      </div>

      <div class="border-b border-background-200 bg-white p-4">
        <form id="modal-promo-form" class="flex gap-2">
          <div class="relative flex-1">
            <span class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-foreground-400">
              <i class="ri-price-tag-3-line text-sm"></i>
            </span>
            <input type="text" name="code" placeholder="Nhập mã ưu đãi khác (vd: BMT20)..." maxlength="16" value="${esc(S.promoCode)}" class="w-full rounded-lg border border-background-300 bg-background-50 pl-9 pr-3 py-2 text-sm font-mono font-semibold uppercase text-foreground-950 placeholder:font-sans placeholder:font-normal placeholder:normal-case placeholder:text-foreground-400 focus:border-primary-500 focus:bg-white focus:outline-none">
          </div>
          <button type="submit" class="inline-flex shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-lg bg-primary-500 px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-primary-600">
            Áp dụng
          </button>
        </form>
        <p id="modal-promo-msg" class="mt-2 hidden text-xs flex items-center gap-1"></p>
      </div>

      <div class="border-b border-background-200 bg-background-100/60 px-4 py-2">
        <div class="flex flex-wrap items-center gap-1.5">
          <button type="button" data-vtab="all" class="cursor-pointer rounded-full px-3 py-1 text-xs font-semibold transition-colors ${isAll ? 'bg-primary-500 text-white shadow-xs' : 'bg-background-200 text-foreground-700 hover:bg-background-300'}">
            Tất cả (${evaluated.length})
          </button>
          <button type="button" data-vtab="eligible" class="cursor-pointer rounded-full px-3 py-1 text-xs font-semibold transition-colors ${isEligible ? 'bg-primary-500 text-white shadow-xs' : 'bg-background-200 text-foreground-700 hover:bg-background-300'}">
            Khả dụng (${eligibleList.length})
          </button>
          <button type="button" data-vtab="ineligible" class="cursor-pointer rounded-full px-3 py-1 text-xs font-semibold transition-colors ${isIneligible ? 'bg-primary-500 text-white shadow-xs' : 'bg-background-200 text-foreground-700 hover:bg-background-300'}">
            Chưa đủ điều kiện (${ineligibleList.length})
          </button>
        </div>
      </div>

      <div id="voucher-list-body" class="max-h-[50vh] overflow-y-auto p-4 md:p-5 space-y-3">
        ${listHtml}
      </div>

      <div class="flex items-center justify-between border-t border-background-200 bg-background-50 px-5 py-3">
        <a href="${url('/uu-dai')}" target="_blank" class="inline-flex items-center gap-1 text-xs font-semibold text-primary-700 hover:underline">
          <i class="ri-gift-line"></i> Vòng quay & ưu đãi khác <i class="ri-external-link-line text-[10px]"></i>
        </a>
        <button type="button" data-close class="cursor-pointer rounded-lg border border-background-300 bg-white px-4 py-1.5 text-xs font-semibold text-foreground-700 hover:bg-background-100">
          Đóng
        </button>
      </div>
    `;
  }

  const modalInstance = openModal({
    size: 'max-w-xl',
    html: renderModalContent('all'),
  });

  const modalEl = modalInstance.el;

  const cdTimer = setInterval(() => {
    if (!modalEl || !document.body.contains(modalEl)) {
      clearInterval(cdTimer);
      return;
    }
    modalEl.querySelectorAll('[data-voucher-countdown]').forEach((el) => {
      const exp = el.getAttribute('data-voucher-countdown');
      if (exp) el.textContent = formatVoucherCountdown(exp);
    });
  }, 1000);

  modalEl.addEventListener('click', async (e) => {
    const tabBtn = e.target.closest('[data-vtab]');
    if (tabBtn) {
      modalEl.innerHTML = renderModalContent(tabBtn.dataset.vtab);
      return;
    }

    const selectBtn = e.target.closest('[data-modal-select]');
    if (selectBtn) {
      const code = selectBtn.dataset.modalSelect;
      if (S.applied && S.applied.promotion.code === code) {
        S.applied = null;
        S.promoCode = '';
        S.promoError = '';
        renderPromo();
        renderSummary();
        modalEl.innerHTML = renderModalContent(voucherModalTab);
        return;
      }
      S.promoCode = code;
      selectBtn.disabled = true;
      selectBtn.innerHTML = '<i class="ri-loader-4-line animate-spin"></i>';
      await applyPromo();
      modalInstance.close();
      return;
    }
  });

  modalEl.addEventListener('submit', async (e) => {
    const form = e.target.closest('#modal-promo-form');
    if (!form) return;
    e.preventDefault();
    const val = form.code.value.trim();
    if (!val) return;
    S.promoCode = val;
    const submitBtn = form.querySelector('button[type=submit]');
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<i class="ri-loader-4-line animate-spin"></i>';
    }
    await applyPromo();
    if (S.applied) {
      modalInstance.close();
    } else {
      const msgEl = modalEl.querySelector('#modal-promo-msg');
      if (msgEl) {
        msgEl.className = 'mt-2 text-xs flex items-center gap-1 text-accent-700';
        msgEl.innerHTML = `<i class="ri-error-warning-line"></i> ${esc(S.promoError || 'Mã không hợp lệ.')}`;
        msgEl.classList.remove('hidden');
      }
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = 'Áp dụng';
      }
    }
  });
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
let waitingApprovalPoll = 0;

function startWaitingApprovalPoll() {
  clearInterval(waitingApprovalPoll);
  waitingApprovalPoll = setInterval(async () => {
    if (S.step !== 3 || !S.booking) return clearInterval(waitingApprovalPoll);
    try {
      const latest = await api('booking', 'get', { code: S.booking.code }, 'GET');
      if (latest && (latest.approvedAt || latest.status !== 'pending')) {
        clearInterval(waitingApprovalPoll);
        S.booking = latest;
        saveDraft();
        if (latest.status === 'cancelled') {
          renderStep3();
        } else if (latest.paymentStatus === 'unpaid') {
          // Chủ sân đã duyệt, mở cổng nhận cọc và đếm ngược 5 phút
          renderStep3();
          startHoldTimer();
        } else {
          showTicket(latest);
        }
      }
    } catch (e) { }
  }, 3000);
}

function renderStep3() {
  const c = court();
  const b = S.booking;
  if (!b) return;

  if ((b.status === 'confirmed' || b.status === 'completed') && b.paymentStatus !== 'unpaid') {
    return showTicket(b);
  }

  // Đơn bị hủy (quá 5 phút chưa cọc hoặc chủ sân từ chối)
  if (b.status === 'cancelled') {
    clearInterval(holdTimer);
    clearInterval(waitingApprovalPoll);
    $('#step-body').innerHTML = `
      <div class="rounded-lg border border-accent-200 bg-white p-6 text-center">
        <div class="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-accent-100 text-accent-700">
          <i class="ri-close-circle-line text-3xl" aria-hidden="true"></i>
        </div>
        <h2 class="mt-4 font-heading text-xl font-extrabold text-foreground-950">${b.approvedAt ? 'Thanh toán thất bại — Đơn đã bị hủy' : 'Đơn đặt sân đã bị hủy'}</h2>
        <p class="mt-2 max-w-md mx-auto text-sm leading-relaxed text-foreground-600">
          ${esc(b.cancelReason || b.rejectReason || 'Đã hết thời gian 5 phút chuyển cọc hoặc chủ sân đã từ chối yêu cầu.')}
        </p>
        <div class="mt-6 flex flex-col gap-2.5 sm:flex-row sm:justify-center">
          <button type="button" data-rebook class="inline-flex cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-md bg-primary-500 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-primary-600"><i class="ri-refresh-line" aria-hidden="true"></i>Chọn khung giờ khác</button>
          <a href="${url('/tim-san')}" class="inline-flex cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-md border border-background-300 px-4 py-2.5 text-sm font-semibold text-foreground-800 transition-colors hover:border-primary-400 hover:text-primary-700">Xem danh sách sân</a>
        </div>
      </div>
    `;
    return;
  }

  // GIAI ĐOẠN 3A: Chờ chủ sân duyệt đơn trước (chưa nhận cọc)
  if (!b.approvedAt) {
    clearInterval(holdTimer);
    $('#step-body').innerHTML = `
      <div class="rounded-lg border border-background-200 bg-white p-6 text-center">
        <div class="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-accent-50 text-accent-600">
          <i class="ri-time-line text-3xl animate-pulse" aria-hidden="true"></i>
        </div>
        <h2 class="mt-4 font-heading text-xl font-extrabold text-foreground-950">Yêu cầu đặt sân đã gửi — Đang chờ chủ sân duyệt</h2>
        <p class="mt-2 max-w-md mx-auto text-sm leading-relaxed text-foreground-600">
          Chủ sân đang kiểm tra và duyệt lịch đặt sân. Ngay khi chủ sân duyệt, hệ thống sẽ mở mã VietQR để bạn chuyển cọc trong vòng <b>5 phút</b>.
        </p>

        <div class="mt-5 rounded-lg border border-accent-200 bg-accent-50/70 p-3.5 text-xs text-accent-900 max-w-md mx-auto flex items-center justify-center gap-2">
          <i class="ri-loader-4-line animate-spin text-base text-accent-700" aria-hidden="true"></i>
          <span>Hệ thống đang kết nối với chủ sân... Màn hình sẽ tự động mở mã chuyển cọc ngay khi được duyệt.</span>
        </div>

        <div class="mt-5 max-w-md mx-auto rounded-lg border border-background-200 bg-background-50 p-4 text-left text-sm space-y-2.5">
          <div class="flex items-center justify-between"><span class="text-xs text-foreground-500">Mã đơn</span><span class="font-mono font-bold text-primary-700">${esc(b.code)}</span></div>
          <div class="flex items-center justify-between"><span class="text-xs text-foreground-500">Sân</span><span class="font-semibold text-foreground-950">${esc(c.name)}</span></div>
          <div class="flex items-center justify-between"><span class="text-xs text-foreground-500">Khung giờ</span><span class="font-semibold text-foreground-950">${formatTimeRange(b.startSlot, b.durationMinutes)} · ${formatLongDate(b.date)}</span></div>
          <div class="flex items-center justify-between border-t border-background-200 pt-2"><span class="text-xs text-foreground-500">Tổng tiền sân</span><span class="font-bold text-foreground-950">${formatVnd(b.totalPrice)}</span></div>
          <div class="flex items-center justify-between"><span class="text-xs font-semibold text-primary-700">Tiền cọc cần chuyển (30%)</span><span class="font-heading text-base font-bold text-primary-600">${formatVnd(calcDeposit(b.totalPrice))}</span></div>
        </div>

        <div class="mt-6 flex flex-col gap-2.5 sm:flex-row sm:justify-center">
          <button type="button" data-cancel-hold class="inline-flex cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-md border border-background-300 px-4 py-2.5 text-sm font-semibold text-foreground-800 transition-colors hover:border-accent-400 hover:text-accent-700"><i class="ri-close-line" aria-hidden="true"></i>Hủy yêu cầu đặt sân</button>
          <a href="tel:${HOTLINE.replace(/\D/g, '')}" class="inline-flex cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-md border border-primary-300 bg-primary-50 px-4 py-2.5 text-sm font-semibold text-primary-800 transition-colors hover:bg-primary-100"><i class="ri-phone-line" aria-hidden="true"></i>Hotline chủ sân: ${HOTLINE}</a>
        </div>
      </div>
    `;
    startWaitingApprovalPoll();
    return;
  }

  // GIAI ĐOẠN 3B: Chủ sân đã duyệt -> Mở cổng cọc VietQR (đếm ngược 5 phút)
  clearInterval(waitingApprovalPoll);
  const isFull = S.depositMode === 'full' || b.paymentMethod === 'vietqr-full';
  const payAmount = isFull ? b.totalPrice : calcDeposit(b.totalPrice);
  const remainingAtCourt = Math.max(0, b.totalPrice - payAmount);
  const secondsLeft = remainingHoldSeconds(b.holdExpiresAt);
  const expired = secondsLeft <= 0;
  const extras = extrasTotal();
  const row = (dt, dd) => `<div class="flex items-start justify-between gap-4 px-4 py-3 text-sm"><dt class="text-foreground-500">${dt}</dt><dd class="text-right font-medium text-foreground-950">${dd}</dd></div>`;

  $('#step-body').innerHTML = `
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h2 class="flex items-center gap-2 font-heading text-lg font-bold text-foreground-950">
          <i class="ri-checkbox-circle-fill text-primary-600 text-xl" aria-hidden="true"></i>Chủ sân đã duyệt — Chuyển khoản cọc
        </h2>
        <p class="mt-1 text-sm text-foreground-600">Vui lòng chuyển cọc trong vòng <b>5 phút</b> để hoàn tất giữ sân. Quá 5 phút chưa cọc, hệ thống sẽ tự động hủy sân.</p>
      </div>
      <span data-countdown class="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold ${expired ? 'bg-accent-100 text-accent-900 border border-accent-300' : 'bg-accent-50 text-accent-900 border border-accent-300 animate-pulse'}">
        <i class="ri-time-line" aria-hidden="true"></i>${expired ? 'Đã hết giờ chuyển cọc' : `Thời gian cọc còn lại: ${formatCountdown(secondsLeft)}`}
      </span>
    </div>

    ${expired ? `
      <div class="mt-4 flex items-start gap-2.5 rounded-md border border-accent-300 bg-accent-50 p-4 text-xs leading-relaxed text-accent-950">
        <i class="ri-error-warning-line mt-0.5 text-base text-accent-700" aria-hidden="true"></i>
        <div>
          <p class="font-bold text-accent-900">Đã hết thời gian 5 phút chuyển cọc</p>
          <p class="mt-0.5 text-accent-800">Đơn đặt sân đã tự động bị hủy để nhả khung giờ cho khách khác. Bạn vui lòng chọn lại khung giờ nhé.</p>
        </div>
      </div>
    ` : ''}

    ${S.error ? `<div class="mt-4 flex items-start gap-2.5 rounded-md border border-accent-200 bg-accent-50 px-3.5 py-3"><i class="ri-error-warning-line mt-0.5 text-accent-700" aria-hidden="true"></i><p class="text-sm text-accent-900">${esc(S.error)}</p></div>` : ''}

    <div class="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-[1fr_310px]">
      <div class="min-w-0">
        <dl class="divide-y divide-background-200 rounded-lg border border-background-200 bg-white">
          ${row('Sân', `<span class="font-semibold text-foreground-950">${esc(c.name)}</span><span class="block text-xs font-normal text-foreground-500">${esc(c.address)}</span>`)}
          ${row('Ngày chơi', `<span class="font-semibold text-foreground-950">${formatLongDate(b.date)}</span>`)}
          ${row('Khung giờ', `<span class="font-semibold text-foreground-950">${formatTimeRange(b.startSlot, b.durationMinutes)} (${b.durationMinutes} phút)</span>`)}
          ${row('Tiền sân', `<span class="font-medium text-foreground-900">${formatVnd(b.baseTotal - extras)}</span>`)}
          ${extras > 0 ? row('Dịch vụ thêm', `<span class="font-medium text-foreground-900">${formatVnd(extras)}</span>`) : ''}
          ${b.discount > 0 ? `<div class="flex items-start justify-between gap-4 px-4 py-3 text-sm"><dt class="flex items-center gap-1 text-foreground-500"><i class="ri-coupon-3-line text-primary-600" aria-hidden="true"></i>Mã giảm giá ${esc(b.promoCode)}</dt><dd class="text-right font-semibold text-accent-700">-${formatVnd(b.discount)}</dd></div>` : ''}
          
          <div class="flex items-center justify-between gap-4 bg-background-50 px-4 py-3 text-sm">
            <dt class="font-semibold text-foreground-700">Tổng tiền sân</dt>
            <dd class="font-heading text-base font-bold text-foreground-950">${formatVnd(b.totalPrice)}</dd>
          </div>

          <div class="flex items-center justify-between gap-4 border-t-2 border-primary-500 bg-primary-50/80 px-4 py-3.5 dark:bg-primary-950/40">
            <dt>
              <span class="block font-bold text-primary-900 dark:text-primary-200">
                ${isFull ? 'Thanh toán toàn bộ (100%)' : 'Tiền cọc cần chuyển ngay (30%)'}
              </span>
              <span class="block text-[11px] text-primary-700 dark:text-primary-300">
                Chủ sân đã duyệt đơn. Chuyển cọc để hoàn tất giữ sân.
              </span>
            </dt>
            <dd class="text-right font-heading text-2xl font-black text-primary-600 dark:text-primary-400">
              ${formatVnd(payAmount)}
            </dd>
          </div>

          ${!isFull ? `
            <div class="flex items-center justify-between gap-4 bg-background-50/80 px-4 py-2.5 text-xs text-foreground-600">
              <dt>Còn lại thanh toán tại sân</dt>
              <dd class="font-bold text-foreground-900">${formatVnd(remainingAtCourt)} <span class="font-normal text-foreground-500">(trả khi nhận sân)</span></dd>
            </div>
          ` : ''}
        </dl>

        <div class="mt-4">
          <p class="mb-2 text-sm font-semibold text-foreground-900">Phương thức thanh toán cọc</p>
          <div class="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            <button type="button" data-mode="deposit" class="cursor-pointer rounded-lg border-2 p-3 text-left transition-all ${!isFull ? 'border-primary-500 bg-primary-50/70 ring-1 ring-primary-500/20 dark:bg-primary-950/40' : 'border-background-300 bg-white hover:border-primary-300'}">
              <div class="flex items-center justify-between">
                <span class="text-xs font-bold uppercase tracking-wider text-primary-700 dark:text-primary-300">Cọc 30%</span>
                <span class="font-heading text-base font-extrabold text-primary-600 dark:text-primary-400">${formatVnd(calcDeposit(b.totalPrice))}</span>
              </div>
              <p class="mt-1 text-xs text-foreground-600">Còn lại <b class="text-foreground-900">${formatVnd(b.totalPrice - calcDeposit(b.totalPrice))}</b> trả tại sân</p>
            </button>
            <button type="button" data-mode="full" class="cursor-pointer rounded-lg border-2 p-3 text-left transition-all ${isFull ? 'border-primary-500 bg-primary-50/70 ring-1 ring-primary-500/20 dark:bg-primary-950/40' : 'border-background-300 bg-white hover:border-primary-300'}">
              <div class="flex items-center justify-between">
                <span class="text-xs font-bold uppercase tracking-wider text-primary-700 dark:text-primary-300">Trả đủ 100%</span>
                <span class="font-heading text-base font-extrabold text-primary-600 dark:text-primary-400">${formatVnd(b.totalPrice)}</span>
              </div>
              <p class="mt-1 text-xs text-foreground-600">Thanh toán đủ, không cần trả thêm khi ra sân</p>
            </button>
          </div>
        </div>
      </div>

      <div class="min-w-0">
        <div class="rounded-lg border border-background-200 bg-white p-4">
          <div class="flex items-center justify-between gap-2">
            <p class="font-heading text-sm font-bold text-foreground-950">Mã VietQR</p>
            <span class="text-xs font-semibold text-primary-700">Chủ sân đã duyệt</span>
          </div>

          <!-- Highlight rõ ràng số tiền chuyển khoản -->
          <div class="mt-3 rounded-lg border border-primary-200 bg-primary-50/90 p-2.5 text-center dark:border-primary-800 dark:bg-primary-950/50">
            <span class="text-[11px] font-medium text-foreground-600">Số tiền cần chuyển:</span>
            <div class="font-heading text-2xl font-black text-primary-600 dark:text-primary-400">${formatVnd(payAmount)}</div>
          </div>

          <div class="mt-2.5 flex h-[210px] w-full items-center justify-center overflow-hidden rounded-md border border-background-200 bg-background-50 p-1">
            <img src="${buildVietQrUrl(payAmount, b.code)}" alt="Mã VietQR thanh toán ${formatVnd(payAmount)} cho đơn ${esc(b.code)}" class="h-full w-full object-contain ${expired ? 'opacity-40' : ''}">
          </div>

          <div class="mt-3 space-y-1.5 text-xs">
            <div class="flex items-center justify-between gap-2"><span class="text-foreground-500">Ngân hàng</span><span class="font-semibold text-foreground-900">${esc(bankAccount.bankName)}</span></div>
            <div class="flex items-center justify-between gap-2"><span class="text-foreground-500">Số tài khoản</span><button type="button" data-copy="${esc(bankAccount.accountNumber)}" class="flex cursor-pointer items-center gap-1.5 whitespace-nowrap font-mono font-bold text-foreground-900 hover:text-primary-600">${esc(bankAccount.accountNumber)}<i class="ri-file-copy-line" aria-hidden="true"></i></button></div>
            <div class="flex items-center justify-between gap-2"><span class="text-foreground-500">Chủ tài khoản</span><span class="font-semibold text-foreground-900">${esc(bankAccount.accountName)}</span></div>
            <div class="flex items-center justify-between gap-2"><span class="text-foreground-500">Số tiền</span><span class="font-bold text-primary-600 dark:text-primary-400">${formatVnd(payAmount)}</span></div>
            <div class="flex items-center justify-between gap-2"><span class="text-foreground-500">Nội dung CK</span><button type="button" data-copy="${esc(b.code)}" class="flex cursor-pointer items-center gap-1.5 whitespace-nowrap font-mono font-bold text-primary-600 hover:text-primary-700">${esc(b.code)}<i class="ri-file-copy-line" aria-hidden="true"></i></button></div>
          </div>
          ${!PAGE.contact ? `
            <div class="mt-3 border-t border-background-200 pt-2.5 text-center text-xs text-foreground-600">
              Đã có tài khoản? <a href="${url('/dang-nhap?redirect=' + encodeURIComponent(window.location.pathname + window.location.search))}" data-login-now class="font-bold text-primary-600 underline hover:text-primary-700">Đăng nhập</a> để gắn vé vào tài khoản.
            </div>
          ` : ''}
        </div>
        <div class="mt-3 rounded-md bg-secondary-50 px-3.5 py-3 text-[11px] leading-relaxed text-secondary-900">Sau khi chuyển khoản, bạn bấm <b>“Tôi đã chuyển khoản”</b>. Hệ thống tự động xác nhận và mở vé QR check-in ngay.</div>
      </div>
    </div>
    <div class="mt-5 flex flex-col gap-2.5 border-t border-background-200 pt-5 sm:flex-row sm:items-center sm:justify-between">
      <button type="button" data-cancel-hold class="inline-flex cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-md border border-background-300 px-4 py-2.5 text-sm font-semibold text-foreground-800 transition-colors hover:border-accent-400 hover:text-accent-700"><i class="ri-close-line" aria-hidden="true"></i>Hủy giữ sân</button>
      <button type="button" data-confirm ${expired || S.busy ? 'disabled' : ''} class="inline-flex cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-md bg-accent-500 px-5 py-3 text-sm font-bold text-background-950 transition-colors hover:bg-accent-600 disabled:cursor-not-allowed disabled:opacity-50"><i class="${S.busy ? 'ri-loader-4-line animate-spin' : 'ri-check-double-line'} text-base" aria-hidden="true"></i>${expired ? 'Đã hết thời gian chuyển cọc' : S.busy ? 'Đang xác nhận tiền cọc…' : 'Tôi đã chuyển khoản'}</button>
    </div>
    <p class="mt-3 text-center text-xs text-foreground-500">Cần hỗ trợ? Gọi <a href="tel:${HOTLINE.replace(/\D/g, '')}" class="font-semibold text-primary-600 hover:text-primary-700">${HOTLINE}</a></p>`;

  startHoldTimer();
  startSepayRealtimeCheck(b.id);
}

let sepayPollingInterval = null;
function startSepayRealtimeCheck(bookingId) {
  if (sepayPollingInterval) clearInterval(sepayPollingInterval);
  sepayPollingInterval = setInterval(async () => {
    if (S.step !== 3 || !S.booking || S.booking.id !== bookingId) {
      clearInterval(sepayPollingInterval);
      return;
    }
    // Chỉ dừng khi ĐÃ CỌC hoặc ĐÃ THANH TOÁN XONG (không dùng status vì chủ sân duyệt đã là confirmed)
    if (['paid', 'deposit_paid'].includes(S.booking.paymentStatus)) {
      clearInterval(sepayPollingInterval);
      return;
    }
    try {
      const res = await api('booking', 'check_sepay', { id: bookingId });
      if (res && res.confirmed) {
        clearInterval(sepayPollingInterval);
        clearInterval(holdTimer);
        S.booking = res.booking;
        toast('Đã nhận tiền chuyển khoản SePay thành công! Đang kích hoạt vé QR...');
        showTicket(res.booking);
      }
    } catch {}
  }, 1500);
}

function startHoldTimer() {
  clearInterval(holdTimer);
  holdTimer = setInterval(() => {
    if (S.step !== 3 || !S.booking) return clearInterval(holdTimer);
    const left = remainingHoldSeconds(S.booking.holdExpiresAt);
    const badge = $('[data-countdown]');
    if (badge) badge.innerHTML = `<i class="ri-time-line" aria-hidden="true"></i>${left <= 0 ? 'Đã hết giờ chuyển cọc' : `Thời gian cọc còn lại: ${formatCountdown(left)}`}`;
    if (left <= 0) {
      clearInterval(holdTimer);
      clearInterval(sepayPollingInterval);
      renderStep3();
    }
  }, 1000);
}

function showVerifyOverlay(onCancel) {
  const overlay = document.createElement('div');
  overlay.className = 'fixed inset-0 z-[95] flex items-center justify-center bg-foreground-950/70 p-4 animate-fade-in backdrop-blur-[2px]';
  overlay.innerHTML = `<div class="w-full max-w-sm rounded-2xl border border-background-200 bg-white p-6 text-center shadow-2xl">
    <div class="relative mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary-50 text-primary-600 ring-8 ring-primary-50/60">
      <i class="ri-loader-4-line animate-spin text-3xl" aria-hidden="true"></i>
    </div>
    <h3 class="mt-4 font-heading text-base font-bold text-foreground-950">Đang đối soát giao dịch MBBank</h3>
    <p class="mt-1.5 text-xs text-foreground-600 leading-relaxed">Hệ thống đang kiểm tra biến động số dư qua SePay...</p>
    <div class="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-background-200">
      <div data-bar class="h-full rounded-full bg-primary-500 transition-all duration-1000 ease-linear" style="width:0%"></div>
    </div>
    <div class="mt-2.5 flex items-center justify-between text-[11px] text-foreground-500 font-medium">
      <span>Đang kết nối ngân hàng</span>
      <span data-left>Còn 6 giây</span>
    </div>
    <button type="button" data-close-overlay class="mt-4 text-xs font-semibold text-foreground-500 hover:text-foreground-800 transition-colors cursor-pointer">
      Đóng và chờ tự động mở vé
    </button>
  </div>`;
  document.body.appendChild(overlay);

  overlay.querySelector('[data-close-overlay]')?.addEventListener('click', () => {
    overlay.remove();
    if (typeof onCancel === 'function') onCancel();
  });

  return {
    set(sec, total = 6) {
      const pct = Math.min(100, Math.max(0, ((total - sec + 1) / total) * 100));
      const bar = overlay.querySelector('[data-bar]');
      const left = overlay.querySelector('[data-left]');
      if (bar) bar.style.width = `${pct}%`;
      if (left) left.textContent = `Còn khoảng ${Math.max(1, sec)}s`;
    },
    close: () => overlay.remove(),
  };
}

function showPaymentPendingModal(b) {
  const isFull = b.paymentMethod === 'vietqr-full';
  const payAmount = isFull ? b.totalPrice : (b.depositAmount || calcDeposit(b.totalPrice));

  const modal = openModal({
    size: 'max-w-md',
    dismissible: true,
    html: `
      <div class="p-5 sm:p-6 text-center">
        <div class="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-amber-50 text-amber-500 ring-8 ring-amber-50/60">
          <i class="ri-time-line text-3xl" aria-hidden="true"></i>
        </div>
        <h3 class="mt-4 font-heading text-lg font-bold text-foreground-950">Chưa nhận được tiền chuyển khoản</h3>
        <p class="mt-1.5 text-xs text-foreground-600 leading-relaxed">
          Tài khoản ngân hàng chưa ghi nhận biến động số dư cho mã đơn <span class="font-mono font-bold text-primary-700">${esc(b.code)}</span>.
        </p>

        <div class="mt-4 rounded-xl border border-background-200 bg-background-50/90 p-3.5 text-left text-xs space-y-2">
          <div class="flex items-center justify-between text-foreground-600">
            <span>Ngân hàng thụ hưởng:</span>
            <span class="font-bold text-foreground-900">${esc(bankAccount.bankName)}</span>
          </div>
          <div class="flex items-center justify-between text-foreground-600">
            <span>Số tài khoản:</span>
            <span class="font-mono font-bold text-foreground-900">${esc(bankAccount.accountNumber)}</span>
          </div>
          <div class="flex items-center justify-between text-foreground-600">
            <span>Chủ tài khoản:</span>
            <span class="font-bold text-foreground-900">${esc(bankAccount.accountName)}</span>
          </div>
          <div class="flex items-center justify-between text-foreground-600">
            <span>Số tiền cần chuyển:</span>
            <span class="font-bold text-primary-600">${formatVnd(payAmount)}</span>
          </div>
          <div class="flex items-center justify-between text-foreground-600 border-t border-background-200 pt-2">
            <span>Nội dung chuyển khoản:</span>
            <span class="font-mono font-bold text-primary-700">${esc(b.code)}</span>
          </div>
        </div>

        <div class="mt-3.5 rounded-xl border border-amber-200 bg-amber-50/80 p-3 text-left text-xs leading-relaxed text-amber-900">
          <div class="flex items-start gap-2">
            <i class="ri-lightbulb-line mt-0.5 text-base text-amber-600 shrink-0"></i>
            <div>
              <p class="font-bold text-amber-950">Lưu ý đối soát:</p>
              <ul class="mt-1 list-disc pl-3.5 space-y-1 text-[11px] text-amber-900/90">
                <li><b>Nếu bạn vừa chuyển tiền:</b> Ngân hàng có thể mất 10 - 30 giây để gửi thông báo. Bạn chỉ cần chờ tại màn hình, hệ thống sẽ <b>tự động mở vé QR</b> ngay khi nhận được tiền.</li>
                <li><b>Nếu bạn chưa chuyển:</b> Quét lại mã VietQR trên màn hình để chuyển khoản chính xác số tiền và nội dung.</li>
              </ul>
            </div>
          </div>
        </div>

        <div class="mt-5 flex flex-col-reverse sm:flex-row items-center gap-2.5">
          <button type="button" data-close data-modal-close class="w-full sm:flex-1 cursor-pointer rounded-lg border border-background-300 bg-white py-2.5 text-xs font-semibold text-foreground-700 hover:bg-background-50 transition-colors">
            Đóng, tôi sẽ chờ
          </button>
          <button type="button" data-recheck class="w-full sm:flex-1 cursor-pointer rounded-lg bg-accent-500 py-2.5 text-xs font-bold text-background-950 hover:bg-accent-600 transition-colors">
            <i class="ri-refresh-line mr-1" aria-hidden="true"></i>Kiểm tra lại
          </button>
        </div>
      </div>
    `,
  });

  modal.el.querySelector('[data-modal-close], [data-close]')?.addEventListener('click', () => {
    modal.close();
  });
  modal.el.querySelector('[data-recheck]')?.addEventListener('click', () => {
    modal.close();
    confirmDeposit();
  });
}

async function confirmDeposit() {
  S.error = '';
  S.busy = true;
  renderStep3();
  let overlay = null;
  try {
    // 1. Kiểm tra ngay xem SePay Webhook đã ghi nhận chưa
    const check1 = await api('booking', 'check_sepay', { id: S.booking.id });
    if (check1 && check1.confirmed) {
      clearInterval(sepayPollingInterval);
      S.busy = false;
      toast('Đã ghi nhận tiền chuyển khoản qua MBBank thành công!');
      return showTicket(check1.booking);
    }

    // 2. Hiển thị popup đối soát SePay trong 6 giây, kiểm tra mỗi 1 giây
    let cancelled = false;
    overlay = showVerifyOverlay(() => {
      cancelled = true;
    });

    const waitSeconds = 6;
    for (let sec = waitSeconds; sec > 0; sec -= 1) {
      if (cancelled) break;
      overlay.set(sec, waitSeconds);
      await new Promise((r) => setTimeout(r, 1000));
      if (cancelled) break;

      const midCheck = await api('booking', 'check_sepay', { id: S.booking.id });
      if (midCheck && midCheck.confirmed) {
        clearInterval(sepayPollingInterval);
        overlay.close();
        S.busy = false;
        toast('Đã ghi nhận tiền chuyển khoản qua MBBank thành công!');
        return showTicket(midCheck.booking);
      }
    }

    if (overlay) overlay.close();
    S.busy = false;
    renderStep3();

    if (!cancelled) {
      toast('Chưa nhận được tiền chuyển khoản cho mã đơn ' + S.booking.code, 'warning');
      showPaymentPendingModal(S.booking);
    }
  } catch (error) {
    if (overlay) overlay.close();
    S.busy = false;
    S.error = error.message || 'Lỗi kiểm tra thanh toán';
    renderStep3();
  }
}

// ======================= VÉ ĐIỆN TỬ =======================
let ticketPollInterval = 0;

function showTicket(b) {
  clearDraft();
  clearInterval(holdTimer);
  clearInterval(sepayPollingInterval);
  clearInterval(ticketPollInterval);
  document.querySelectorAll('.modal-wrapper').forEach((m) => {
    if (typeof m._closeModal === 'function') m._closeModal();
    else m.remove();
  });
  document.body.style.overflow = '';
  const confirmed = b.status === 'confirmed' || b.status === 'completed';
  const isPending = b.status === 'pending';
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
        <span class="flex h-16 w-16 items-center justify-center rounded-full ${confirmed ? 'bg-primary-50 text-primary-600' : 'bg-accent-50 text-accent-600'}">
          <i class="${confirmed ? 'ri-checkbox-circle-fill' : 'ri-time-line animate-pulse'} text-4xl" aria-hidden="true"></i>
        </span>
        <h1 class="mt-4 font-heading text-2xl font-extrabold text-foreground-950">
          ${confirmed ? 'Đã giữ sân thành công cho bạn!' : 'Đã nhận cọc — Đang chờ chủ sân duyệt'}
        </h1>
        <p class="mt-2 max-w-md text-sm leading-relaxed text-foreground-600">
          ${confirmed
      ? 'Chủ sân đã xác nhận và duyệt đơn đặt sân của bạn. Vé điện tử bên dưới là căn cứ check-in tại sân — bạn chỉ cần trả phần còn lại khi ra sân.'
      : 'Hệ thống đã ghi nhận khoản cọc của bạn và gửi yêu cầu tới chủ sân. Khi chủ sân duyệt đơn, thông báo giữ sân chính thức và vé QR check-in sẽ được kích hoạt tại đây.'}
        </p>
      </div>

      ${isPending ? `
        <div class="mt-5 flex items-start gap-3 rounded-lg border border-accent-300 bg-accent-50/70 p-4 text-xs leading-relaxed text-accent-950">
          <i class="ri-loader-4-line mt-0.5 animate-spin text-base text-accent-700" aria-hidden="true"></i>
          <div class="min-w-0">
            <p class="font-bold text-accent-900">Yêu cầu giữ sân đang chờ chủ sân duyệt</p>
            <p class="mt-0.5 text-accent-800/90">Trang này sẽ tự động chuyển sang thông báo <b>"Đã giữ sân thành công"</b> ngay khi chủ sân bấm duyệt. Bạn có thể giữ trang này hoặc lưu lại mã đơn để kiểm tra.</p>
          </div>
        </div>
      ` : ''}

      <div class="mt-5 rounded-xl border border-dashed border-primary-300 bg-primary-50/40 p-5 dark:border-primary-800 dark:bg-primary-950/30">
        <div class="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
          ${confirmed
      ? `<div class="h-[180px] w-[180px] shrink-0 overflow-hidden rounded-md border border-background-200 bg-white p-2"><img src="${ticketQrUrl(b)}" alt="Mã QR vé đặt sân ${esc(b.code)}" class="h-full w-full object-contain"></div>`
      : `<div class="flex h-[180px] w-[180px] shrink-0 flex-col items-center justify-center gap-2 rounded-md border border-dashed border-accent-300 bg-white p-4 text-center dark:bg-background-100">
                <i class="ri-time-line text-3xl text-accent-600 animate-pulse" aria-hidden="true"></i>
                <p class="text-xs font-bold text-accent-900">Chờ chủ sân duyệt</p>
                <p class="text-[10px] leading-relaxed text-foreground-500">Mã QR check-in mở ngay khi chủ sân duyệt đơn</p>
               </div>`
    }
          <div class="min-w-0 flex-1">
            <p class="text-xs font-medium text-foreground-500">Mã vé điện tử</p>
            <p class="mt-1 font-heading text-xl font-extrabold tracking-wide text-primary-900 dark:text-primary-300">${esc(b.code)}</p>
            <span class="mt-2 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${confirmed ? 'bg-primary-100 text-primary-800' : 'bg-accent-100 text-accent-900 border border-accent-300'}">
              <i class="${confirmed ? 'ri-checkbox-circle-fill' : 'ri-time-fill'}" aria-hidden="true"></i>
              ${confirmed ? 'Chủ sân đã duyệt – Sân đã giữ' : 'Chờ chủ sân duyệt đơn'}
            </span>
            <dl class="mt-3 space-y-2 text-sm">
              <div><dt class="text-xs text-foreground-500">Sân</dt><dd class="font-semibold text-foreground-950">${esc(b.courtName)}</dd></div>
              <div><dt class="text-xs text-foreground-500">Thời gian</dt><dd class="font-semibold text-foreground-950">${formatTimeRange(b.startSlot, b.durationMinutes)} · ${formatLongDate(b.date)}</dd></div>
            </dl>
          </div>
        </div>
      </div>

      <!-- Bảng giá rõ ràng, tối ưu chi tiết -->
      <div class="mt-4 rounded-lg border border-background-200 bg-background-50 p-4">
        <dl class="space-y-3 text-sm">
          <div class="flex items-start justify-between gap-4"><dt class="text-foreground-500">Địa chỉ sân</dt><dd class="max-w-[62%] text-right text-foreground-800">${esc(b.address)}</dd></div>
          <div class="flex items-start justify-between gap-4"><dt class="text-foreground-500">Người đặt</dt><dd class="text-right text-foreground-950">${esc(b.customerName)}<span class="block text-xs text-foreground-500">${esc(b.customerPhone)}</span></dd></div>
          <div class="flex items-start justify-between gap-4"><dt class="text-foreground-500">Tổng tiền sân</dt><dd class="text-right font-bold text-foreground-950">${formatVnd(b.totalPrice)}</dd></div>
          <div class="flex items-start justify-between gap-4">
            <dt class="text-foreground-500">Tiền cọc đã chuyển</dt>
            <dd class="text-right font-bold text-accent-600">
              ${formatVnd(deposit)} <span class="rounded bg-accent-100 px-1.5 py-0.5 text-[10px] font-semibold text-accent-800">Đã nhận cọc</span>
            </dd>
          </div>
          <div class="flex items-start justify-between gap-4 border-t border-background-200 pt-3">
            <dt class="font-semibold text-foreground-700">Còn lại thanh toán tại sân</dt>
            <dd class="text-right font-heading text-lg font-black text-primary-600 dark:text-primary-400">
              ${formatVnd(Math.max(0, b.totalPrice - deposit))}
            </dd>
          </div>
        </dl>
      </div>

      <div class="mt-4 rounded-lg border border-primary-200 bg-primary-50/60 p-4"><div class="flex items-start gap-3">
        <span class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-primary-600"><i class="ri-time-line text-xl" aria-hidden="true"></i></span>
        <div class="min-w-0 flex-1"><p class="text-xs font-semibold uppercase tracking-wide text-primary-700">Hạn hủy vé</p><p class="mt-1 font-heading text-base font-extrabold text-foreground-950">${esc(deadline)}</p><p class="mt-1 text-xs leading-relaxed text-foreground-600">Hủy trước mốc này được hoàn 100% tiền cọc. Sau mốc, nút hủy sẽ khóa — bạn gọi ${HOTLINE} để chủ sân hỗ trợ.</p>
        <p class="mt-2 inline-flex items-center gap-1.5 rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-foreground-700"><i class="${canCancel ? 'ri-checkbox-circle-fill text-primary-600' : 'ri-lock-2-fill text-foreground-500'}" aria-hidden="true"></i>${canCancel ? 'Hiện vẫn còn trong thời gian được hủy' : 'Đã qua hạn hủy, cần liên hệ hotline'}</p></div>
      </div></div>
      <div class="mt-4 rounded-md bg-accent-50 px-4 py-3 text-xs leading-relaxed text-accent-900"><span class="font-semibold">Lưu ý:</span> Có mặt trước giờ chơi 10 phút và đưa mã vé cho nhân viên. Cần đổi giờ, hãy gọi ${HOTLINE}; cần hủy, hãy làm trước hạn ghi trên vé để được hoàn 100% cọc.</div>
      ${confirmed
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

  if (isPending) {
    ticketPollInterval = setInterval(async () => {
      try {
        const latest = await api('booking', 'get', { code: b.code });
        if (latest && latest.status !== 'pending') {
          clearInterval(ticketPollInterval);
          showTicket(latest);
        }
      } catch (e) { }
    }, 4000);
  }
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
    saveDraft();
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
    saveDraft();
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
    api('booking', 'cancel_hold', { id: S.booking.id }).catch(() => { });
    S.booking = null;
    clearInterval(holdTimer);
  }
  S.step = Math.max(1, S.step - 1);
  renderAll();
  saveDraft();
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
    const nextSlug = el('[data-court]').dataset.court;
    if (nextSlug !== S.courtSlug) {
      S.courtSlug = nextSlug;
      S.startSlot = '';
      S.error = '';
      // Lọc bỏ các dịch vụ đã chọn nếu không thuộc môn thể thao của sân mới:
      const validSids = new Set(currentServices().map((s) => s.id));
      S.extras = S.extras.filter((x) => validSids.has(typeof x === 'string' ? x : x?.id));
      renderError();
      renderCourtList();
      renderSlots();
      return renderSummary();
    }
    return;
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
  if (el('[data-open-voucher-modal]')) return openVoucherModal();
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
  if (el('[data-rebook]')) {
    S.booking = null;
    S.error = '';
    S.step = 1;
    clearDraft();
    clearInterval(holdTimer);
    clearInterval(waitingApprovalPoll);
    renderAll();
    loadAvailability();
    window.scrollTo({ top: 0, behavior: 'smooth' });
    return;
  }
  if (el('[data-cancel-hold]')) {
    if (S.booking) await api('booking', 'cancel_hold', { id: S.booking.id }).catch(() => { });
    S.booking = null;
    S.error = '';
    S.step = 2;
    clearInterval(holdTimer);
    clearInterval(waitingApprovalPoll);
    renderAll();
    saveDraft();
    window.scrollTo({ top: 0, behavior: 'smooth' });
    return;
  }
  const varQtyBtn = el('[data-var-qty]');
  if (varQtyBtn) {
    const vid = varQtyBtn.dataset.varQty;
    const sid = varQtyBtn.dataset.sid;
    const delta = Number(varQtyBtn.dataset.delta) || 0;
    const s = currentServices().find((x) => x.id === sid);
    const v = s?.variants?.find((v0) => v0.id === vid);
    if (s && v) {
      const idx = S.extras.findIndex((x) => typeof x === 'object' && x?.variantId === vid);
      if (idx === -1) {
        if (delta > 0) {
          S.extras.push({
            id: s.id,
            variantId: v.id,
            sku: v.sku,
            label: s.name,
            variantName: v.name,
            price: v.price,
            quantity: 1,
          });
        }
      } else {
        const cur = Number(S.extras[idx].quantity) || 1;
        const next = cur + delta;
        if (next <= 0) {
          S.extras.splice(idx, 1);
        } else if (v.stock > 0 && next > v.stock) {
          S.extras[idx].quantity = v.stock;
        } else {
          S.extras[idx].quantity = next;
        }
      }
      saveDraft();
      renderStep2();
      renderSummary();
      revalidatePromo();
    }
    return;
  }

  const clearSvcBtn = el('[data-clear-service]');
  if (clearSvcBtn) {
    const sid = clearSvcBtn.dataset.clearService;
    S.extras = S.extras.filter((x) => (typeof x === 'string' ? x !== sid : x.id !== sid));
    saveDraft();
    renderStep2();
    renderSummary();
    revalidatePromo();
    return;
  }
  const openVarBtn = el('[data-open-variants]');
  if (openVarBtn) {
    openVariantModal(openVarBtn.dataset.openVariants);
    return;
  }

  const simpleQtyBtn = el('[data-extra-simple-qty]');
  if (simpleQtyBtn) {
    const sid = simpleQtyBtn.dataset.extraSimpleQty;
    const delta = Number(simpleQtyBtn.dataset.delta) || 0;
    const s = currentServices().find((x) => x.id === sid);
    const idx = S.extras.findIndex((x) => typeof x === 'string' ? x === sid : (x.id === sid && !x.variantId));
    if (idx !== -1 && s) {
      const cur = typeof S.extras[idx] === 'string' ? 1 : Math.max(1, Number(S.extras[idx].quantity) || 1);
      const next = Math.max(1, cur + delta);
      if (s.stock > 0 && next > s.stock) {
        S.extras[idx].quantity = s.stock;
      } else {
        if (typeof S.extras[idx] === 'string') {
          S.extras[idx] = { id: s.id, variantId: '', label: s.name, variantName: '', price: s.price, quantity: next };
        } else {
          S.extras[idx].quantity = next;
        }
      }
      saveDraft();
      renderStep2();
      renderSummary();
      revalidatePromo();
    }
    return;
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
    saveDraft();
    return;
  }
  if (t.id === 'promo-input') {
    t.value = t.value.toUpperCase();
    S.promoCode = t.value;
    S.promoError = '';
    saveDraft();
  }
});

app.addEventListener('change', (event) => {
  const t = event.target;
  if (t.id === 'f-area') S.filters.area = t.value;
  if (t.id === 'f-price') S.filters.priceId = t.value;
  if (t.id === 'f-sort') S.filters.sort = t.value;
  if (['f-area', 'f-price', 'f-sort'].includes(t.id)) return renderCourtList();
  if (t.dataset.simpleToggle) {
    const sid = t.dataset.simpleToggle;
    const s = currentServices().find((x) => x.id === sid);
    if (t.checked) {
      if (s && !isServiceSelected(sid)) {
        S.extras.push({
          id: s.id,
          variantId: '',
          label: s.name,
          variantName: '',
          price: s.price,
          quantity: 1,
        });
      }
    } else {
      S.extras = S.extras.filter((x) => (typeof x === 'string' ? x !== sid : x.id !== sid));
    }
    saveDraft();
    renderStep2();
    renderSummary();
    return revalidatePromo();
  }
  if (t.dataset.serviceToggle) {
    const sid = t.dataset.serviceToggle;
    const s = currentServices().find((x) => x.id === sid);
    const hasVars = s && s.hasVariants && Array.isArray(s.variants) && s.variants.length > 0;
    if (t.checked) {
      if (s && !isServiceSelected(sid)) {
        if (hasVars) {
          const v = s.variants[0];
          S.extras.push({
            id: s.id,
            variantId: v.id,
            sku: v.sku,
            label: s.name,
            variantName: v.name,
            price: v.price,
            quantity: 1,
          });
        } else {
          S.extras.push({
            id: s.id,
            variantId: '',
            label: s.name,
            variantName: '',
            price: s.price,
            quantity: 1,
          });
        }
      }
    } else {
      S.extras = S.extras.filter((x) => (typeof x === 'string' ? x !== sid : x.id !== sid));
    }
    saveDraft();
    renderStep2();
    renderSummary();
    return revalidatePromo();
  }
  if (t.dataset.agree !== undefined) {
    S.agree = t.checked;
    S.error = '';
    saveDraft();
    renderError();
  }
});

document.addEventListener('click', (e) => {
  if (e.target.closest('[data-login-now]') || e.target.closest('header a[href*="dang-nhap"]')) {
    saveDraft();
  }
});

// Cứ 30 giây vẽ lại lưới giờ để khóa các khung vừa trôi qua
setInterval(() => S.step === 1 && renderSlots(), 30000);

// Cảnh báo rời trang (BeforeUnload Confirmation) chỉ áp dụng riêng cho Bước 2 (Nhập thông tin đặt sân)
const handleBeforeUnload = (event) => {
  if (S.step === 2) {
    event.preventDefault();
    event.returnValue = 'Dữ liệu đặt sân đang nhập có thể không được lưu.';
    return 'Dữ liệu đặt sân đang nhập có thể không được lưu.';
  }
};
window.addEventListener('beforeunload', handleBeforeUnload);
window.onbeforeunload = handleBeforeUnload;

const restored = restoreDraft();
renderAll();
if (S.step === 1) {
  loadAvailability();
} else if (S.step === 3 && S.booking) {
  if (S.booking.approvedAt && S.booking.paymentStatus === 'unpaid') {
    startHoldTimer();
  } else if (!S.booking.approvedAt) {
    startWaitingApprovalPoll();
  }
}
