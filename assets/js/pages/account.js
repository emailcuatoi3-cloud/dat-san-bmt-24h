/** Trang tài khoản khách hàng: tổng quan, đơn sắp tới, lịch sử, hóa đơn, sân yêu thích, hồ sơ. */
import { $, $$, APP, PAGE, api, esc, url, toast, openModal, statusBadge, setBusy, formatVnd, loadingBlock } from '../core/ui.js';
import { bindFavoriteButtons, courtCard, getFavorites } from '../core/components.js';
import { openReviewModal } from '../core/reviewModal.js';
import { ticketData, ticketQrUrl, downloadTicket } from '../core/ticket.js';
import { invoiceBadge, openInvoiceModal, exportInvoices, slotRange } from '../core/invoice.js';
import { formatLongDate, formatRelativeDay, formatShortDate, isTodayOrLater, parseIsoDate, slotEndTime } from '../lib/format.js';
import { readMyBookingCodes, rememberBookingCode } from '../lib/myBookings.js';
import { CANCEL_CUTOFF_HOURS, cancelLockedNotice, cancelPolicyFull, formatCancelDeadline, isBeforeCancelCutoff } from '../lib/cancelPolicy.js';
import { HOTLINE } from '../lib/payment.js';

const user = APP.user;
const st = { tab: PAGE.tab, bookings: [], reviewed: new Set(), loading: true, error: '', historyFilter: 'all', invoices: null, invoiceFilter: 'all' };
const main = $('#account-main');

// ---------------- Dữ liệu ----------------
async function load() {
  st.loading = true;
  render();
  try {
    const data = await api('account', 'bookings', { codes: readMyBookingCodes() });
    st.bookings = data.bookings;
    st.reviewed = new Set(data.reviewed);
    st.error = '';
  } catch {
    st.error = 'Chưa tải được các đơn đã đặt trên thiết bị này. Vui lòng thử lại.';
  }
  st.loading = false;
  render();
}

const isUpcoming = (b) => (b.status === 'pending' || b.status === 'confirmed') && isTodayOrLater(b.date);
function groups() {
  const upcoming = st.bookings.filter(isUpcoming).sort((a, b) => parseIsoDate(a.date) - parseIsoDate(b.date) || a.startSlot.localeCompare(b.startSlot));
  const history = st.bookings.filter((b) => !isUpcoming(b)).sort((a, b) => parseIsoDate(b.date) - parseIsoDate(a.date));
  const completed = st.bookings.filter((b) => b.status === 'completed');
  return {
    upcoming,
    history,
    completedCount: completed.length,
    totalHours: completed.reduce((s, b) => s + b.slots.length, 0),
    totalSpent: completed.reduce((s, b) => s + b.totalPrice, 0),
  };
}

// ---------------- Thành phần ----------------
const btn = (attrs, icon, label, cls) => `<button type="button" ${attrs} class="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-2 text-xs font-semibold transition-colors ${cls}"><i class="${icon}" aria-hidden="true"></i>${label}</button>`;
const emptyState = (icon, title, desc) => `<div class="flex flex-col items-center justify-center rounded-lg border border-dashed border-background-300 bg-white px-6 py-12 text-center"><span class="flex h-14 w-14 items-center justify-center rounded-full bg-background-100 text-foreground-400"><i class="${icon} text-2xl" aria-hidden="true"></i></span><p class="mt-4 font-heading text-base font-bold text-foreground-950">${title}</p><p class="mt-1.5 max-w-md text-sm leading-relaxed text-foreground-600">${desc}</p><a href="${url('/tim-san')}" class="mt-5 inline-flex items-center gap-1.5 whitespace-nowrap rounded-md bg-primary-500 px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-primary-600">Tìm sân ngay</a></div>`;

function bookingItem(b) {
  const active = b.status === 'pending' || b.status === 'confirmed';
  const canCancel = active && isBeforeCancelCutoff(b.date, b.slots);
  const locked = active && isTodayOrLater(b.date) && !canCancel;
  return `<article class="overflow-hidden rounded-lg border border-background-200 bg-white transition-colors hover:border-primary-200"><div class="flex flex-col sm:flex-row">
    <div class="relative h-[160px] w-full shrink-0 overflow-hidden bg-background-100 sm:h-auto sm:min-h-[150px] sm:w-[190px]"><img src="${esc(b.image)}" alt="${esc(b.courtName)}" loading="lazy" class="h-full w-full object-cover object-top">
      <span class="absolute left-2.5 top-2.5 inline-flex items-center gap-1 rounded-full bg-background-50/90 px-2 py-0.5 text-[11px] font-semibold text-foreground-950 backdrop-blur-sm"><i class="${b.sport === 'football' ? 'ri-football-line' : 'ri-ping-pong-line'} text-primary-600" aria-hidden="true"></i>${esc(b.sportLabel)}</span></div>
    <div class="flex min-w-0 flex-1 flex-col gap-2.5 p-4">
      <div class="flex flex-wrap items-start justify-between gap-2">
        <div class="min-w-0"><div class="flex flex-wrap items-center gap-2"><h3 class="font-heading text-base font-bold text-foreground-950">${esc(b.courtName)}</h3>${statusBadge(b.status)}</div><p class="mt-1 flex items-start gap-1.5 text-xs text-foreground-500"><i class="ri-map-pin-line mt-0.5" aria-hidden="true"></i><span class="line-clamp-1">${esc(b.address)}</span></p></div>
        <a href="${url(`/don-dat-san/${b.code}`)}" title="Mở trang chi tiết đơn" class="inline-flex items-center gap-1 rounded-md bg-background-100 px-2 py-1 font-mono text-[11px] font-semibold text-foreground-600 transition-colors hover:bg-primary-50 hover:text-primary-800">${esc(b.code)}<i class="ri-arrow-right-up-line text-[11px]" aria-hidden="true"></i></a>
      </div>
      <dl class="grid grid-cols-1 gap-x-4 gap-y-1.5 sm:grid-cols-2">
        <div class="flex items-center gap-1.5 text-xs text-foreground-700"><i class="ri-calendar-line text-foreground-400" aria-hidden="true"></i><dd class="font-medium">${formatLongDate(b.date)}</dd></div>
        <div class="flex items-center gap-1.5 text-xs text-foreground-700"><i class="ri-time-line text-foreground-400" aria-hidden="true"></i><dd class="font-medium">${b.slots[0]} - ${slotEndTime(b.slots[b.slots.length - 1])} (${b.slots.length} giờ)</dd></div>
        <div class="flex items-center gap-1.5 text-xs text-foreground-700"><i class="ri-wallet-3-line text-foreground-400" aria-hidden="true"></i><dd class="font-semibold text-primary-700">${formatVnd(b.totalPrice)}</dd></div>
        <div class="flex items-center gap-1.5 text-xs text-foreground-700"><i class="ri-bank-card-line text-foreground-400" aria-hidden="true"></i><dd>${esc(b.payment)}</dd></div>
      </dl>
      ${active && isTodayOrLater(b.date) ? `<p class="flex items-center gap-1.5 rounded-md bg-accent-50 px-2.5 py-1.5 text-[11px] font-semibold text-accent-800"><i class="ri-alarm-line" aria-hidden="true"></i>${formatRelativeDay(b.date)} • ${b.status === 'pending' ? 'Đang chờ chủ sân xác nhận' : 'Chủ sân đã xác nhận'}</p>` : ''}
      ${locked ? `<p class="flex items-start gap-1.5 rounded-md bg-background-100 px-2.5 py-1.5 text-[11px] font-medium text-foreground-600"><i class="ri-lock-2-line mt-0.5" aria-hidden="true"></i>${cancelLockedNotice}</p>` : ''}
      ${b.status === 'cancelled' && b.cancelReason ? `<p class="flex items-start gap-1.5 rounded-md bg-background-100 px-2.5 py-1.5 text-[11px] text-foreground-600"><i class="ri-information-line mt-0.5" aria-hidden="true"></i>Lý do hủy: ${esc(b.cancelReason)}</p>` : ''}
      <div class="mt-auto flex flex-wrap items-center gap-2 pt-1">
        ${btn(`data-view="${b.id}"`, 'ri-file-list-3-line', 'Xem chi tiết', 'border border-background-300 bg-background-200 text-foreground-950 hover:border-primary-400')}
        ${btn(`data-view="${b.id}"`, 'ri-qr-code-line', 'Vé QR', 'border border-primary-200 bg-primary-50 text-primary-800 hover:border-primary-400')}
        ${canCancel ? btn(`data-cancel="${b.id}"`, 'ri-close-circle-line', 'Hủy đơn', 'border border-accent-300 text-accent-800 hover:bg-accent-50') : ''}
        ${b.status === 'completed' ? (st.reviewed.has(b.code) ? '<span class="inline-flex items-center gap-1.5 whitespace-nowrap rounded-md bg-primary-50 px-3 py-2 text-xs font-semibold text-primary-700"><i class="ri-checkbox-circle-line" aria-hidden="true"></i>Đã đánh giá</span>' : btn(`data-review="${b.id}"`, 'ri-star-smile-line', 'Đánh giá sân', 'border border-accent-300 bg-accent-50 text-accent-800 hover:bg-accent-100')) : ''}
        ${b.status === 'completed' || b.status === 'cancelled' ? `<a href="${url(`/dat-san/${b.courtSlug}`)}" class="ml-auto inline-flex items-center gap-1.5 whitespace-nowrap rounded-md bg-primary-500 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-primary-600"><i class="ri-refresh-line" aria-hidden="true"></i>Đặt lại sân</a>` : ''}
      </div>
    </div></div></article>`;
}

const lookupHtml = `<div class="rounded-lg border border-background-200 bg-white p-5">
  <div class="flex items-start gap-2.5"><span class="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-secondary-50 text-secondary-800"><i class="ri-search-eye-line text-lg" aria-hidden="true"></i></span><div class="min-w-0"><h3 class="font-heading text-sm font-bold text-foreground-950">Không thấy đơn của bạn?</h3><p class="mt-1 text-xs leading-relaxed text-foreground-600">Nhập mã đơn trên vé điện tử và số điện thoại đã dùng khi đặt sân để mở lại đơn trên thiết bị này.</p></div></div>
  <form data-lookup class="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-[1fr_1fr_auto]">
    <div class="min-w-0"><label class="mb-1.5 block text-xs font-semibold text-foreground-800">Mã đơn</label><input name="code" type="text" placeholder="BMT20261106-1234" class="w-full rounded-md border border-background-300 bg-background-50 px-3 py-2.5 font-mono text-sm uppercase text-foreground-950 placeholder:font-sans placeholder:normal-case placeholder:text-foreground-400 focus:border-primary-400 focus:outline-none"></div>
    <div class="min-w-0"><label class="mb-1.5 block text-xs font-semibold text-foreground-800">Số điện thoại đặt sân</label><input name="phone" type="tel" inputmode="numeric" placeholder="0912345678" class="w-full rounded-md border border-background-300 bg-background-50 px-3 py-2.5 text-sm text-foreground-950 placeholder:text-foreground-400 focus:border-primary-400 focus:outline-none"></div>
    <div class="flex items-end"><button type="submit" class="inline-flex w-full cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-md bg-primary-500 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-600"><i class="ri-search-line text-base" aria-hidden="true"></i>Tra cứu</button></div>
  </form><div data-lookup-result></div></div>`;

const loadState = (empty) =>
  (st.error ? `<div class="flex flex-wrap items-center justify-between gap-3 rounded-md border border-accent-200 bg-accent-50 px-4 py-3"><p class="flex items-center gap-2 text-xs text-accent-900"><i class="ri-error-warning-line" aria-hidden="true"></i>${esc(st.error)}</p><button type="button" data-reload class="cursor-pointer whitespace-nowrap rounded-md border border-accent-300 bg-white px-3 py-1.5 text-xs font-semibold text-accent-900 transition-colors hover:bg-accent-100">Thử lại</button></div>` : '') +
  (st.loading && empty ? `<div class="flex items-center gap-2 rounded-md border border-background-200 bg-white px-4 py-3 text-xs text-foreground-600"><i class="ri-loader-4-line animate-spin text-base text-primary-600" aria-hidden="true"></i>Đang tải các đơn bạn vừa đặt...</div>` : '');

// ---------------- Các tab ----------------
function renderOverview(g) {
  const next = g.upcoming[0];
  const first = user ? (user.fullName || '').split(' ').slice(-2).join(' ') || 'bạn' : 'bạn';
  const stats = [
    ['ri-calendar-event-line', 'Đơn sắp tới', `${g.upcoming.length}`, g.upcoming.length ? `Gần nhất ${formatRelativeDay(g.upcoming[0].date).toLowerCase()}` : 'Chưa có lịch chơi', 'bg-primary-50 text-primary-700'],
    ['ri-checkbox-circle-line', 'Lượt chơi hoàn thành', `${g.completedCount}`, `${g.totalHours} giờ trên sân`, 'bg-secondary-50 text-secondary-800'],
    ['ri-wallet-3-line', 'Tổng chi cho sân', formatVnd(g.totalSpent), 'Đã thanh toán tại sân', 'bg-accent-50 text-accent-800'],
  ];
  return `<div class="flex flex-col gap-4">
    <section class="overflow-hidden rounded-lg border border-background-200 bg-white"><div class="grid grid-cols-1 lg:grid-cols-[1fr_320px]">
      <div class="p-5 md:p-6"><span class="inline-flex items-center gap-1.5 rounded-full bg-primary-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-primary-700"><i class="ri-shake-hands-line" aria-hidden="true"></i>Chào mừng trở lại</span>
        <h2 class="mt-3 font-heading text-xl font-extrabold leading-snug text-foreground-950 md:text-2xl">Xin chào, ${esc(first)}!</h2>
        <p class="mt-2 max-w-md text-sm leading-relaxed text-foreground-600">${g.upcoming.length ? `Bạn có ${g.upcoming.length} lượt đặt sân sắp diễn ra. Hãy có mặt trước giờ chơi 10 phút và mang theo mã đơn để chủ sân đối chiếu.` : 'Bạn chưa có lịch chơi nào sắp tới. Chọn ngay một sân bóng đá hoặc sân cầu lông gần bạn tại Buôn Ma Thuột.'}</p>
        <div class="mt-4 flex flex-wrap gap-2"><a href="${url('/tai-khoan?tab=upcoming')}" data-goto="upcoming" class="cursor-pointer whitespace-nowrap rounded-md bg-primary-500 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-600">Xem đơn sắp tới</a><a href="${url('/tim-san')}" class="whitespace-nowrap rounded-md border border-background-300 px-4 py-2.5 text-sm font-semibold text-foreground-800 transition-colors hover:border-primary-400 hover:text-primary-700">Đặt sân mới</a></div>
      </div>
      <div class="relative h-[150px] w-full overflow-hidden bg-background-100 lg:h-full"><img src="${esc(PAGE.accountImage)}" alt="Đội bóng phong trào tại Buôn Ma Thuột" class="h-full w-full object-cover object-top"></div>
    </div></section>
    <section class="grid grid-cols-1 gap-3 sm:grid-cols-3">${stats.map((s) => `<div class="rounded-lg border border-background-200 bg-white p-4"><div class="flex items-center justify-between gap-2"><p class="text-xs font-medium text-foreground-500">${s[1]}</p><span class="flex h-8 w-8 items-center justify-center rounded-md ${s[4]}"><i class="${s[0]} text-base" aria-hidden="true"></i></span></div><p class="mt-2 font-heading text-2xl font-extrabold text-foreground-950">${s[2]}</p><p class="mt-0.5 text-[11px] text-foreground-500">${s[3]}</p></div>`).join('')}</section>
    <section class="rounded-lg border border-background-200 bg-white p-5">
      <div class="flex flex-wrap items-center justify-between gap-2"><h2 class="font-heading text-base font-bold text-foreground-950">Lượt chơi gần nhất</h2><a href="${url('/tai-khoan?tab=upcoming')}" data-goto="upcoming" class="inline-flex cursor-pointer items-center gap-1 whitespace-nowrap text-xs font-semibold text-primary-600 hover:text-primary-700">Xem tất cả đơn<i class="ri-arrow-right-line" aria-hidden="true"></i></a></div>
      ${
        next
          ? `<div class="mt-3 rounded-md border border-primary-200 bg-primary-50/60 p-4"><div class="flex flex-wrap items-center justify-between gap-2"><span class="inline-flex items-center gap-1.5 rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-primary-700"><i class="ri-alarm-line" aria-hidden="true"></i>${formatRelativeDay(next.date)} • ${next.slots[0]}</span><span class="text-[11px] font-medium text-primary-800">${esc(next.code)}</span></div>
            <div class="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center"><div class="h-[86px] w-full shrink-0 overflow-hidden rounded-md bg-background-100 sm:w-[130px]"><img src="${esc(next.image)}" alt="${esc(next.courtName)}" class="h-full w-full object-cover object-top"></div>
            <div class="min-w-0 flex-1"><p class="font-heading text-sm font-bold text-foreground-950">${esc(next.courtName)}</p><p class="mt-0.5 text-xs text-foreground-600">${formatLongDate(next.date)}</p><p class="text-xs text-foreground-600">${next.slots[0]} - ${slotEndTime(next.slots[next.slots.length - 1])} • ${next.slots.length} giờ • ${formatVnd(next.totalPrice)}</p></div>
            <div class="flex shrink-0 gap-2"><button type="button" data-view="${next.id}" class="cursor-pointer whitespace-nowrap rounded-md border border-primary-300 bg-white px-3 py-2 text-xs font-semibold text-primary-700 transition-colors hover:bg-primary-50">Chi tiết</button>${isBeforeCancelCutoff(next.date, next.slots) ? `<button type="button" data-cancel="${next.id}" class="cursor-pointer whitespace-nowrap rounded-md px-3 py-2 text-xs font-semibold text-accent-800 transition-colors hover:bg-accent-50">Hủy đơn</button>` : ''}</div></div></div>`
          : `<div class="mt-3">${st.loading ? loadingBlock('Đang tải các đơn của bạn...') : emptyState('ri-calendar-line', 'Chưa có lượt chơi nào sắp tới', 'Đặt sân bóng đá hoặc cầu lông gần bạn để giữ chỗ trước giờ cao điểm.')}</div>`
      }
      <div class="mt-4"><div class="flex items-center justify-between gap-2"><h3 class="text-xs font-bold uppercase tracking-wide text-foreground-500">Lịch sử gần đây</h3><a href="${url('/tai-khoan?tab=history')}" data-goto="history" class="inline-flex cursor-pointer items-center gap-1 whitespace-nowrap text-xs font-semibold text-foreground-600 hover:text-primary-700">Toàn bộ lịch sử<i class="ri-arrow-right-line" aria-hidden="true"></i></a></div>
        <ul class="mt-2 divide-y divide-background-200">${
          g.history
            .slice(0, 3)
            .map((b) => `<li class="flex flex-wrap items-center justify-between gap-2 py-2.5"><div class="min-w-0"><p class="truncate text-sm font-medium text-foreground-900">${esc(b.courtName)}</p><p class="text-[11px] text-foreground-500">${formatLongDate(b.date)} • ${b.slots.length} giờ</p></div><div class="flex items-center gap-2"><span class="text-xs font-semibold text-foreground-700">${formatVnd(b.totalPrice)}</span><button type="button" data-view="${b.id}" aria-label="Xem chi tiết" class="flex h-7 w-7 cursor-pointer items-center justify-center rounded-md text-foreground-500 transition-colors hover:bg-background-100 hover:text-primary-700"><i class="ri-arrow-right-s-line text-lg" aria-hidden="true"></i></button></div></li>`)
            .join('') || '<li class="py-4 text-center text-xs text-foreground-500">Chưa có lịch sử đặt sân.</li>'
        }</ul></div>
    </section></div>`;
}

function renderUpcoming(g) {
  return `<div class="flex flex-col gap-4">
    <div class="flex flex-wrap items-end justify-between gap-3 rounded-lg border border-background-200 bg-white p-5"><div><h2 class="font-heading text-lg font-bold text-foreground-950">Đơn sắp tới</h2><p class="mt-1 text-sm text-foreground-600">${g.upcoming.length ? `Bạn có ${g.upcoming.length} lượt chơi đã lên lịch. Đơn chỉ hủy được khi còn cách giờ chơi từ ${CANCEL_CUTOFF_HOURS} giờ.` : 'Các đơn đã xác nhận và đang chờ xác nhận sẽ hiển thị tại đây.'}</p></div><a href="${url('/tim-san')}" class="inline-flex items-center gap-1.5 whitespace-nowrap rounded-md bg-primary-500 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-600"><i class="ri-add-line" aria-hidden="true"></i>Đặt sân mới</a></div>
    ${loadState(!g.upcoming.length)}
    ${g.upcoming.length ? `<div class="flex flex-col gap-3">${g.upcoming.map(bookingItem).join('')}</div>` : st.loading ? '' : emptyState('ri-calendar-line', 'Chưa có đơn sắp tới', 'Bạn chưa có lịch chơi nào. Tìm sân bóng đá hoặc sân cầu lông tại Buôn Ma Thuột và giữ chỗ ngay hôm nay.')}
    ${lookupHtml}
    <div class="rounded-lg border border-accent-200 bg-accent-50 p-4"><p class="flex items-start gap-2 text-xs leading-relaxed text-accent-900"><i class="ri-information-line mt-0.5 text-base" aria-hidden="true"></i><span><span class="font-semibold">Chính sách hủy sân:</span> chỉ hủy và hoàn 100% tiền cọc khi còn cách giờ chơi từ ${CANCEL_CUTOFF_HOURS} giờ trở lên. Trong ${CANCEL_CUTOFF_HOURS} giờ cuối, nút hủy sẽ khóa — bạn gọi ${HOTLINE} để chủ sân xử lý. Đơn đã hủy không thể khôi phục, vui lòng đặt lại sân nếu cần.</span></p></div>
  </div>`;
}

function renderHistory(g) {
  const list = g.history.filter((b) => st.historyFilter === 'all' || b.status === st.historyFilter);
  const chip = (icon, label, value) => `<div class="flex items-center gap-2 rounded-md bg-background-50 px-3 py-2"><i class="${icon}" aria-hidden="true"></i><span class="text-xs text-foreground-600">${label}: <span class="font-semibold text-foreground-950">${value}</span></span></div>`;
  return `<div class="flex flex-col gap-4">
    <div class="rounded-lg border border-background-200 bg-white p-5">
      <div class="flex flex-wrap items-end justify-between gap-3"><div><h2 class="font-heading text-lg font-bold text-foreground-950">Lịch sử đặt sân</h2><p class="mt-1 text-sm text-foreground-600">Tổng ${g.history.length} đơn đã hoàn thành hoặc đã hủy. Bấm vào từng đơn để xem chi tiết.</p></div>
        <div class="inline-flex items-center gap-1 rounded-full bg-background-100 p-1">${[['all', 'Tất cả'], ['completed', 'Hoàn thành'], ['cancelled', 'Đã hủy']].map(([v, l]) => `<button type="button" data-hfilter="${v}" class="cursor-pointer whitespace-nowrap rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors ${st.historyFilter === v ? 'bg-white text-foreground-950' : 'text-foreground-600 hover:text-foreground-950'}">${l}</button>`).join('')}</div></div>
      <div class="mt-4 flex flex-wrap gap-2 border-t border-background-200 pt-4">${chip('ri-checkbox-circle-line text-primary-600', 'Hoàn thành', `${g.completedCount} đơn`)}${chip('ri-time-line text-secondary-700', 'Tổng giờ chơi', `${g.totalHours} giờ`)}${chip('ri-close-circle-line text-accent-600', 'Đã hủy', `${g.history.filter((b) => b.status === 'cancelled').length} đơn`)}${chip('ri-wallet-3-line text-foreground-500', 'Tổng chi', formatVnd(g.totalSpent))}</div>
    </div>
    ${lookupHtml}
    ${loadState(!list.length)}
    ${list.length ? `<div class="flex flex-col gap-3">${list.map(bookingItem).join('')}</div>` : st.loading ? '' : emptyState('ri-history-line', 'Không có đơn phù hợp', 'Chưa có đơn nào ở trạng thái này. Hãy chọn bộ lọc khác để xem toàn bộ lịch sử đặt sân.')}
    <div class="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-background-200 bg-white p-4"><p class="text-xs text-foreground-600">Cần xem lại tiền sân, tiền cọc và khoản còn phải trả của từng lượt chơi? Mở mục Hóa đơn của tôi.</p><a href="${url('/tai-khoan?tab=invoices')}" data-goto="invoices" class="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-md border border-background-300 px-3.5 py-2 text-xs font-semibold text-foreground-800 transition-colors hover:border-primary-400 hover:text-primary-700"><i class="ri-receipt-line" aria-hidden="true"></i>Xem hóa đơn của tôi</a></div>
  </div>`;
}

function renderInvoices() {
  if (st.invoices === null) {
    api('account', 'invoices', { codes: readMyBookingCodes() })
      .then((list) => (st.invoices = list))
      .catch(() => (st.invoices = []))
      .finally(render);
    return loadingBlock('Đang tải hóa đơn của bạn...');
  }
  const all = st.invoices;
  const list = all.filter((i) => st.invoiceFilter === 'all' || (st.invoiceFilter === 'debt' ? i.debt > 0 : i.debt === 0));
  const sum = (k) => all.reduce((s, i) => s + i[k], 0);
  const card = (icon, tone, label, value) => `<div class="rounded-lg border border-background-200 bg-white p-4"><div class="flex items-center justify-between"><p class="text-xs font-medium text-foreground-500">${label}</p><span class="flex h-8 w-8 items-center justify-center rounded-md ${tone}"><i class="${icon}" aria-hidden="true"></i></span></div><p class="mt-2 font-heading text-xl font-extrabold text-foreground-950">${value}</p></div>`;
  return `<div class="flex flex-col gap-4">
    <div class="flex flex-wrap items-end justify-between gap-3 rounded-lg border border-background-200 bg-white p-5"><div><h2 class="font-heading text-lg font-bold text-foreground-950">Hóa đơn của tôi</h2><p class="mt-1 text-sm text-foreground-600">Mỗi lượt chơi đã hoàn thành có một hóa đơn: tiền sân, tiền cọc và khoản còn phải trả.</p></div>
      <button type="button" data-export ${all.length ? '' : 'disabled'} class="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-md border border-background-300 px-3.5 py-2 text-xs font-semibold text-foreground-800 hover:border-primary-400 hover:text-primary-700 disabled:opacity-50"><i class="ri-file-excel-2-line" aria-hidden="true"></i>Xuất CSV</button></div>
    <div class="grid grid-cols-1 gap-3 sm:grid-cols-3">${card('ri-receipt-line', 'bg-primary-50 text-primary-700', 'Tổng tiền sân', formatVnd(sum('total')))}${card('ri-checkbox-circle-line', 'bg-secondary-50 text-secondary-800', 'Đã thanh toán', formatVnd(sum('paid')))}${card('ri-error-warning-line', 'bg-accent-50 text-accent-800', 'Còn phải trả', formatVnd(sum('debt')))}</div>
    <div class="inline-flex w-fit items-center gap-1 rounded-full bg-background-100 p-1">${[['all', 'Tất cả'], ['debt', 'Còn phải trả'], ['paid', 'Đã thanh toán']].map(([v, l]) => `<button type="button" data-ifilter="${v}" class="cursor-pointer whitespace-nowrap rounded-full px-3.5 py-1.5 text-xs font-semibold ${st.invoiceFilter === v ? 'bg-white text-foreground-950' : 'text-foreground-600 hover:text-foreground-950'}">${l}</button>`).join('')}</div>
    ${
      list.length
        ? `<div class="overflow-hidden rounded-lg border border-background-200 bg-white"><ul class="divide-y divide-background-200">${list
            .map(
              (i) => `<li class="flex flex-wrap items-center justify-between gap-3 px-4 py-3.5"><div class="min-w-0"><p class="flex flex-wrap items-center gap-2 text-sm font-semibold text-foreground-950"><span class="font-mono">${esc(i.code)}</span>${invoiceBadge(i.status)}</p><p class="mt-0.5 text-xs text-foreground-600">${esc(i.courtName)} · ${formatShortDate(i.bookingDate)} · ${slotRange(i.slots)}</p></div>
              <div class="flex items-center gap-4"><div class="text-right"><p class="text-sm font-bold text-foreground-950">${formatVnd(i.total)}</p><p class="text-[11px] ${i.debt ? 'text-accent-700' : 'text-primary-700'}">${i.debt ? `Còn ${formatVnd(i.debt)}` : 'Đã thanh toán đủ'}</p></div><button type="button" data-invoice="${i.id}" class="cursor-pointer whitespace-nowrap rounded-md border border-background-300 px-3 py-2 text-xs font-semibold text-foreground-800 hover:border-primary-400 hover:text-primary-700">Xem</button></div></li>`,
            )
            .join('')}</ul></div>`
        : emptyState('ri-receipt-line', all.length ? 'Không có hóa đơn ở trạng thái này' : 'Chưa có hóa đơn nào', 'Hóa đơn được tạo tự động sau khi lượt chơi của bạn kết thúc.')
    }
  </div>`;
}

function renderFavorites() {
  const favs = getFavorites();
  const list = (PAGE.courts || []).filter((c) => favs.includes(c.slug));
  return `<div class="flex flex-col gap-4">
    <div class="flex flex-wrap items-end justify-between gap-3 rounded-lg border border-background-200 bg-white p-5"><div><h2 class="font-heading text-lg font-bold text-foreground-950">Sân yêu thích</h2><p class="mt-1 text-sm text-foreground-600">${list.length ? `Bạn đang lưu ${list.length} sân. Bấm vào trái tim trên thẻ sân để bỏ lưu.` : 'Bấm vào biểu tượng trái tim trên thẻ sân để lưu lại những sân bạn hay chơi.'}</p></div><a href="${url('/tim-san')}" class="inline-flex items-center gap-1.5 whitespace-nowrap rounded-md bg-primary-500 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-600"><i class="ri-search-line" aria-hidden="true"></i>Tìm thêm sân</a></div>
    ${!user ? `<div class="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-accent-200 bg-accent-50 p-4"><p class="flex items-start gap-2 text-xs leading-relaxed text-accent-900"><i class="ri-information-line mt-0.5 text-base" aria-hidden="true"></i><span>Danh sách yêu thích được lưu theo tài khoản. Bạn đăng nhập để xem và đồng bộ trên mọi thiết bị.</span></p><a href="${url('/dang-nhap?redirect=/tai-khoan?tab=favorites')}" class="whitespace-nowrap rounded-md bg-primary-500 px-3.5 py-2 text-xs font-semibold text-white transition-colors hover:bg-primary-600">Đăng nhập</a></div>` : ''}
    ${list.length ? `<div class="grid grid-cols-1 gap-4 sm:grid-cols-2" data-fav-grid>${list.map(courtCard).join('')}</div>` : emptyState('ri-heart-3-line', 'Chưa có sân yêu thích', 'Hãy dạo qua danh sách sân và lưu lại những sân có mặt cỏ đẹp, đèn sáng hoặc gần nhà để lần sau đặt nhanh hơn.')}
  </div>`;
}

function renderProfile() {
  if (!user)
    return `<div class="rounded-lg border border-background-200 bg-white p-6 text-center"><span class="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary-50 text-primary-600"><i class="ri-user-settings-line text-2xl" aria-hidden="true"></i></span><p class="mt-4 font-heading text-base font-bold text-foreground-950">Đăng nhập để cập nhật thông tin cá nhân</p><p class="mt-1.5 text-sm text-foreground-600">Bạn vẫn có thể đặt sân không cần tài khoản. Tạo tài khoản giúp lưu lịch sử và sân yêu thích trên mọi thiết bị.</p><div class="mt-5 flex justify-center gap-2"><a href="${url('/dang-nhap?redirect=/tai-khoan?tab=profile')}" class="rounded-md bg-primary-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary-600">Đăng nhập</a><a href="${url('/dang-ky')}" class="rounded-md border border-background-300 px-4 py-2.5 text-sm font-semibold text-foreground-800 hover:border-primary-400">Tạo tài khoản</a></div></div>`;
  const input = 'w-full rounded-md border border-background-300 bg-white px-3 py-2.5 text-sm text-foreground-950 focus:border-primary-400 focus:outline-none';
  const field = (name, label, value, type = 'text', req = true, span = '') => `<div class="min-w-0 ${span}" data-field="${name}"><label class="mb-1.5 block text-sm font-medium text-foreground-800">${label}${req ? ' <span class="text-accent-600">*</span>' : ''}</label><input name="${name}" type="${type}" value="${esc(value || '')}" class="${input}"><p data-error class="mt-1 hidden text-xs text-accent-700"></p></div>`;
  return `<div class="flex flex-col gap-4">
    <form data-profile novalidate class="rounded-lg border border-background-200 bg-white p-5 md:p-6">
      <div class="flex flex-wrap items-start justify-between gap-3"><div><h2 class="font-heading text-lg font-bold text-foreground-950">Thông tin cá nhân</h2><p class="mt-1 text-sm text-foreground-600">Thông tin này được dùng để chủ sân liên hệ xác nhận khi bạn đặt sân.</p></div><span class="inline-flex items-center gap-1.5 rounded-full bg-primary-50 px-3 py-1 text-xs font-semibold text-primary-700"><i class="ri-verified-badge-line" aria-hidden="true"></i>Tài khoản đang hoạt động</span></div>
      <div class="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        ${field('name', 'Họ và tên', user.fullName)}${field('phone', 'Số điện thoại', user.phone, 'tel')}
        ${field('email', 'Email', user.email, 'email')}${user.role === 'owner' ? field('businessName', 'Tên sân / cơ sở', user.businessName, 'text', false) : '<div></div>'}
        ${field('address', 'Địa chỉ liên hệ', user.address, 'text', false, 'sm:col-span-2')}
      </div>
      <div class="mt-6 flex flex-col-reverse gap-2.5 border-t border-background-200 pt-5 sm:flex-row sm:items-center sm:justify-between"><p class="text-xs text-foreground-500">Tham gia từ ${formatShortDate((user.createdAt || '').slice(0, 10))}</p><button type="submit" class="cursor-pointer whitespace-nowrap rounded-md bg-primary-500 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-600">Lưu thay đổi</button></div>
    </form>
    <form data-password class="rounded-lg border border-background-200 bg-white p-5 md:p-6">
      <h2 class="font-heading text-base font-bold text-foreground-950">Đổi mật khẩu</h2>
      <div class="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">${field('current', 'Mật khẩu hiện tại', '', 'password')}${field('password', 'Mật khẩu mới', '', 'password')}${field('confirm', 'Nhập lại mật khẩu mới', '', 'password')}</div>
      <div class="mt-4 flex justify-end"><button type="submit" class="cursor-pointer whitespace-nowrap rounded-md border border-background-300 px-5 py-2.5 text-sm font-semibold text-foreground-800 hover:border-primary-400 hover:text-primary-700">Cập nhật mật khẩu</button></div>
    </form></div>`;
}

// ---------------- Vẽ trang ----------------
function render() {
  const g = groups();
  $('#hero-stats').innerHTML = [
    ['ri-calendar-check-line text-primary-400', `<span class="font-semibold text-foreground-950">${g.upcoming.length}</span> đơn sắp tới`],
    ['ri-history-line text-primary-400', `<span class="font-semibold text-foreground-950">${g.history.length}</span> đơn trong lịch sử`],
    ['ri-wallet-3-line text-accent-400', `Đã chi <span class="font-semibold text-foreground-950">${formatVnd(g.totalSpent)}</span>`],
  ]
    .map(([i, t]) => `<div class="flex items-center gap-2 rounded-md border border-background-200 bg-background-50 px-3.5 py-2"><i class="${i}" aria-hidden="true"></i><span class="text-xs text-foreground-700">${t}</span></div>`)
    .join('');
  $$('#account-nav [data-tab]').forEach((a) => {
    const active = a.dataset.tab === st.tab;
    a.className = `flex shrink-0 items-center gap-2 whitespace-nowrap rounded-md px-3 py-2.5 text-sm font-medium transition-colors lg:justify-between ${active ? 'bg-primary-50 text-primary-700' : 'text-foreground-600 hover:bg-background-100 hover:text-foreground-950'}`;
    const count = a.dataset.tab === 'upcoming' ? g.upcoming.length : a.dataset.tab === 'history' ? g.history.length : 0;
    $('[data-count]', a).innerHTML = count ? `<span class="rounded-full px-1.5 py-0.5 text-[11px] font-bold ${active ? 'bg-primary-500 text-white' : 'bg-background-200 text-foreground-700'}">${count}</span>` : '';
  });
  const views = { overview: renderOverview, upcoming: renderUpcoming, history: renderHistory, invoices: renderInvoices, favorites: renderFavorites, profile: renderProfile };
  main.innerHTML = views[st.tab](g);
  const grid = $('[data-fav-grid]');
  if (grid) bindFavoriteButtons(grid);
}

function goTab(tab) {
  st.tab = tab;
  history.replaceState(null, '', url(`/tai-khoan?tab=${tab}`));
  render();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ---------------- Hộp thoại ----------------
function openDetail(b) {
  const confirmed = ['confirmed', 'completed'].includes(b.status) || ['paid', 'deposit_paid'].includes(b.paymentStatus);
  const active = b.status === 'pending' || b.status === 'confirmed';
  const canCancel = active && isBeforeCancelCutoff(b.date, b.slots);
  const steps = [
    ['Yêu cầu đặt sân đã gửi', `Tạo ngày ${formatShortDate((b.createdAt || b.date).slice(0, 10))}`, true],
    ['Chủ sân xác nhận', b.status === 'cancelled' ? 'Đơn đã hủy trước khi xác nhận' : b.status === 'pending' ? 'Đang chờ chủ sân phản hồi (trong 15 phút)' : 'Chủ sân đã xác nhận qua điện thoại', ['confirmed', 'completed'].includes(b.status)],
    [b.status === 'cancelled' ? 'Đơn đã hủy' : 'Hoàn thành lượt chơi', b.status === 'cancelled' ? b.cancelReason || 'Khách hàng đã hủy đơn' : b.status === 'completed' ? 'Buổi chơi đã kết thúc, cảm ơn bạn đã sử dụng dịch vụ' : `Dự kiến ${formatLongDate(b.date)}`, b.status === 'completed'],
  ];
  const dd = (l, v) => `<div><dt class="text-xs text-foreground-500">${l}</dt><dd class="text-sm font-medium text-foreground-900">${v}</dd></div>`;
  const modal = openModal({
    size: 'max-w-2xl',
    html: `<div class="flex items-start justify-between gap-3 border-b border-background-200 px-5 py-4"><div><h2 class="font-heading text-lg font-extrabold text-foreground-950">Chi tiết đơn đặt sân</h2><p class="mt-0.5 font-mono text-xs text-foreground-500">${esc(b.code)}</p></div><button type="button" data-close aria-label="Đóng" class="flex h-9 w-9 cursor-pointer items-center justify-center rounded-md text-foreground-500 hover:bg-background-100"><i class="ri-close-line text-xl" aria-hidden="true"></i></button></div>
    <div class="px-5 py-4">
      <div class="flex flex-col gap-4 rounded-lg border border-primary-200 bg-primary-50/40 p-4 sm:flex-row sm:items-center">
        ${confirmed ? `<div class="mx-auto h-[150px] w-[150px] shrink-0 overflow-hidden rounded-md border border-background-200 bg-white p-2 sm:mx-0"><img src="${ticketQrUrl(b)}" alt="Vé QR ${esc(b.code)}" class="h-full w-full object-contain"></div>` : `<div class="mx-auto flex h-[150px] w-[150px] shrink-0 flex-col items-center justify-center gap-2 rounded-md border border-dashed border-accent-300 bg-white px-3 text-center sm:mx-0"><i class="ri-qr-scan-2-line text-3xl text-accent-500" aria-hidden="true"></i><p class="text-[11px] text-foreground-600">Vé QR mở khi đơn được xác nhận</p></div>`}
        <div class="min-w-0 flex-1"><p class="text-xs font-semibold uppercase tracking-wide text-primary-700">Vé điện tử của bạn</p><p class="mt-1 font-heading text-lg font-extrabold text-foreground-950">${esc(b.courtName)}</p><p class="mt-0.5 text-sm text-foreground-700">${b.slots[0]} - ${slotEndTime(b.slots[b.slots.length - 1])} · ${formatLongDate(b.date)}</p><p class="mt-1 text-xs text-foreground-500">Đưa mã này cho nhân viên sân khi tới nhận sân.</p>
          ${confirmed ? `<button type="button" data-dl class="mt-3 inline-flex cursor-pointer items-center gap-1.5 rounded-md bg-primary-500 px-3.5 py-2 text-xs font-semibold text-white hover:bg-primary-600"><i class="ri-download-2-line" aria-hidden="true"></i>Tải vé về máy</button>` : ''}</div>
      </div>
      <dl class="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">${dd('Mã đơn', `<span class="font-mono text-xs">${esc(b.code)}</span>`)}${dd('Loại sân', esc(b.sportLabel))}${dd('Ngày chơi', formatLongDate(b.date))}${dd('Khung giờ', `${b.slots[0]} - ${slotEndTime(b.slots[b.slots.length - 1])}`)}${dd('Thời lượng', `${b.slots.length} giờ`)}${dd('Giá trung bình', `${formatVnd(Math.round(b.totalPrice / Math.max(1, b.slots.length)))}/giờ`)}</dl>
      <div class="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div class="rounded-md border border-background-200 bg-background-50 p-3.5"><p class="text-xs font-bold uppercase tracking-wide text-foreground-500">Thông tin liên hệ</p><p class="mt-2 text-sm font-semibold text-foreground-950">${esc(b.customerName)}</p><p class="text-xs text-foreground-600">${esc(b.customerPhone)}</p>${b.note ? `<p class="mt-2 border-t border-background-200 pt-2 text-xs text-foreground-600"><span class="font-semibold text-foreground-800">Ghi chú: </span>${esc(b.note)}</p>` : ''}<p class="mt-2 text-xs text-foreground-600"><span class="font-semibold text-foreground-800">Địa chỉ sân: </span>${esc(b.address)}</p></div>
        <div class="rounded-md border border-background-200 bg-background-50 p-3.5"><p class="text-xs font-bold uppercase tracking-wide text-foreground-500">Thanh toán</p><div class="mt-2 space-y-1.5 text-sm"><div class="flex justify-between gap-3"><span class="text-foreground-600">Hình thức</span><span class="text-right font-medium text-foreground-900">${esc(b.payment)}</span></div><div class="flex justify-between gap-3 border-t border-background-200 pt-1.5"><span class="font-semibold text-foreground-700">Tổng cộng</span><span class="font-heading text-base font-extrabold text-primary-700">${formatVnd(b.totalPrice)}</span></div></div></div>
      </div>
      <p class="mt-4 text-xs font-bold uppercase tracking-wide text-foreground-500">Trạng thái đơn</p>
      <ol class="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-3">${steps.map(([t, n, done], i) => `<li class="flex gap-2.5"><span class="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${b.status === 'cancelled' && i === 2 ? 'bg-accent-100 text-accent-700' : done ? 'bg-primary-100 text-primary-700' : 'bg-background-200 text-foreground-400'}"><i class="text-[11px] ${b.status === 'cancelled' && i === 2 ? 'ri-close-line' : done ? 'ri-check-line' : 'ri-time-line'}" aria-hidden="true"></i></span><div class="min-w-0"><p class="text-sm font-semibold text-foreground-900">${t}</p><p class="text-xs leading-relaxed text-foreground-500">${esc(n)}</p></div></li>`).join('')}</ol>
      ${active ? `<p class="mt-4 rounded-md bg-background-50 px-3 py-2 text-xs text-foreground-600"><span class="font-semibold">Hạn hủy vé: </span>${formatCancelDeadline(b.date, b.slots[0]) || 'Đã qua mốc hủy vé'}</p>` : ''}
    </div>
    <div class="flex flex-col-reverse gap-2 border-t border-background-200 px-5 py-4 sm:flex-row sm:justify-end">
      <a href="${url(`/don-dat-san/${b.code}`)}" class="inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-md border border-background-300 px-4 py-2.5 text-sm font-semibold text-foreground-800 hover:border-primary-400 hover:text-primary-700"><i class="ri-external-link-line" aria-hidden="true"></i>Mở trang đơn</a>
      ${b.status === 'completed' && !st.reviewed.has(b.code) ? `<button type="button" data-rv class="inline-flex cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-md border border-accent-300 bg-accent-50 px-4 py-2.5 text-sm font-semibold text-accent-800 hover:bg-accent-100"><i class="ri-star-smile-line" aria-hidden="true"></i>Đánh giá lượt chơi</button>` : ''}
      ${canCancel ? `<button type="button" data-cx class="inline-flex cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-md border border-accent-300 px-4 py-2.5 text-sm font-semibold text-accent-800 hover:bg-accent-50"><i class="ri-close-circle-line" aria-hidden="true"></i>Hủy đơn</button>` : ''}
    </div>`,
  });
  modal.el.querySelector('[data-dl]')?.addEventListener('click', () => downloadTicket(ticketData(b)).catch((e) => toast(e.message, 'error')));
  modal.el.querySelector('[data-cx]')?.addEventListener('click', () => {
    modal.close();
    openCancel(b);
  });
  modal.el.querySelector('[data-rv]')?.addEventListener('click', () => {
    modal.close();
    review(b);
  });
}

function openCancel(b) {
  const reasons = PAGE.cancelReasons || [];
  const other = PAGE.cancelOther;
  const allowed = isBeforeCancelCutoff(b.date, b.slots);
  const modal = openModal({
    size: 'max-w-lg',
    html: `<div class="flex items-start justify-between gap-3 border-b border-background-200 px-5 py-4"><div><h2 class="font-heading text-lg font-extrabold text-foreground-950">Hủy đơn đặt sân</h2><p class="mt-1 text-xs text-foreground-500">Mã đơn ${esc(b.code)}</p></div><button type="button" data-close aria-label="Đóng" class="flex h-9 w-9 cursor-pointer items-center justify-center rounded-md text-foreground-500 transition-colors hover:bg-background-100 hover:text-foreground-900"><i class="ri-close-line text-xl" aria-hidden="true"></i></button></div>
    <div class="px-5 py-4">
      <div class="rounded-md border border-background-200 bg-background-50 p-3.5"><p class="font-heading text-sm font-bold text-foreground-950">${esc(b.courtName)}</p><p class="mt-1 text-xs text-foreground-600">${formatLongDate(b.date)}</p><p class="text-xs text-foreground-600">${b.slots[0]} - ${slotEndTime(b.slots[b.slots.length - 1])} • ${formatVnd(b.totalPrice)}</p></div>
      <div class="mt-4 flex items-start gap-2.5 rounded-md border border-accent-200 bg-accent-50 px-3.5 py-3"><i class="ri-error-warning-line mt-0.5 text-accent-700" aria-hidden="true"></i><p class="text-xs leading-relaxed text-accent-900">Đơn đã hủy sẽ không thể khôi phục và khung giờ này sẽ được mở lại cho người chơi khác. ${cancelPolicyFull}</p></div>
      ${!allowed ? `<div class="mt-3 flex items-start gap-2.5 rounded-md border border-accent-300 bg-accent-100 px-3.5 py-3"><i class="ri-lock-2-line mt-0.5 text-accent-800" aria-hidden="true"></i><div class="text-xs leading-relaxed text-accent-900"><p>Đơn này đã vào ${CANCEL_CUTOFF_HOURS} giờ cuối nên không hủy tự động được. Bạn liên hệ hotline để chủ sân hỗ trợ đổi giờ hoặc xử lý.</p><a href="tel:${HOTLINE.replace(/\D/g, '')}" class="mt-1 inline-flex font-semibold underline">Gọi ${HOTLINE}</a></div></div>` : ''}
      <fieldset class="mt-4"><legend class="text-sm font-semibold text-foreground-900">Lý do hủy <span class="text-accent-600">*</span></legend><div class="mt-2 space-y-1.5">${reasons.map((r) => `<label class="flex cursor-pointer items-center gap-2.5 rounded-md border border-background-200 px-3 py-2.5 text-sm text-foreground-700 hover:border-background-300 has-[:checked]:border-primary-400 has-[:checked]:bg-primary-50"><input type="radio" name="reason" value="${esc(r)}" class="h-4 w-4 cursor-pointer accent-primary-500">${esc(r)}</label>`).join('')}</div></fieldset>
      <div data-other class="mt-3 hidden"><label class="mb-1.5 block text-sm font-semibold text-foreground-900">Lý do cụ thể <span class="text-accent-600">*</span></label><textarea rows="3" maxlength="200" placeholder="Ví dụ: đội mình có người bị ốm đột xuất..." class="w-full resize-none rounded-md border border-background-300 bg-white px-3 py-2.5 text-sm text-foreground-950 placeholder:text-foreground-400 focus:border-primary-400 focus:outline-none"></textarea></div>
      <p data-err class="mt-2 hidden items-center gap-1.5 text-xs font-medium text-accent-700"></p>
    </div>
    <div class="flex flex-col-reverse gap-2.5 border-t border-background-200 px-5 py-4 sm:flex-row sm:justify-end"><button type="button" data-close class="cursor-pointer whitespace-nowrap rounded-md border border-background-300 px-4 py-2.5 text-sm font-semibold text-foreground-800 transition-colors hover:border-primary-400 hover:text-primary-700">Giữ lại đơn</button>${allowed ? '<button type="button" data-ok class="cursor-pointer whitespace-nowrap rounded-md bg-primary-500 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-600">Xác nhận hủy đơn</button>' : ''}</div>`,
  });
  const el = modal.el;
  const err = (m) => {
    const p = el.querySelector('[data-err]');
    p.innerHTML = m ? `<i class="ri-error-warning-line" aria-hidden="true"></i>${esc(m)}` : '';
    p.classList.toggle('hidden', !m);
    p.classList.toggle('flex', Boolean(m));
  };
  el.addEventListener('change', () => el.querySelector('[data-other]').classList.toggle('hidden', el.querySelector('input[name=reason]:checked')?.value !== other));
  el.querySelector('[data-ok]')?.addEventListener('click', async (e) => {
    const picked = el.querySelector('input[name=reason]:checked')?.value;
    const note = el.querySelector('textarea').value.trim();
    if (!picked) return err('Vui lòng chọn lý do hủy đơn để chúng tôi hỗ trợ tốt hơn.');
    if (picked === other && note.length < 3) return err('Vui lòng ghi rõ lý do bạn hủy sân (ít nhất 3 ký tự).');
    setBusy(e.currentTarget, true, 'Đang hủy...');
    try {
      const updated = await api('account', 'cancel', { id: b.id, reason: picked === other ? `${other}: ${note}` : picked, codes: readMyBookingCodes() });
      st.bookings = st.bookings.map((x) => (x.id === b.id ? updated : x));
      st.invoices = null;
      modal.close();
      toast(`Đã hủy đơn ${b.code}. Khung giờ vừa hủy đã được mở lại cho người chơi khác.`);
      render();
    } catch (error) {
      setBusy(e.currentTarget, false);
      err(error.message);
    }
  });
}

function review(b) {
  openReviewModal({
    courtName: b.courtName,
    bookingCode: b.code,
    onSubmitted: (r) => {
      st.reviewed.add(b.code);
      toast(`Cảm ơn bạn đã đánh giá ${r.rating} sao! Đánh giá vừa gửi đã được hiển thị trên trang chi tiết sân.`);
      render();
    },
  });
}

// ---------------- Sự kiện ----------------
const byId = (id) => st.bookings.find((b) => b.id === id);
document.addEventListener('click', (e) => {
  const t = e.target;
  const tabLink = t.closest('#account-nav [data-tab], [data-goto]');
  if (tabLink) {
    e.preventDefault();
    return goTab(tabLink.dataset.tab || tabLink.dataset.goto);
  }
  if (!main.contains(t)) return;
  const v = t.closest('[data-view]');
  if (v) return openDetail(byId(v.dataset.view));
  const c = t.closest('[data-cancel]');
  if (c) return openCancel(byId(c.dataset.cancel));
  const r = t.closest('[data-review]');
  if (r) return review(byId(r.dataset.review));
  if (t.closest('[data-reload]')) return load();
  const hf = t.closest('[data-hfilter]');
  if (hf) {
    st.historyFilter = hf.dataset.hfilter;
    return render();
  }
  const ifl = t.closest('[data-ifilter]');
  if (ifl) {
    st.invoiceFilter = ifl.dataset.ifilter;
    return render();
  }
  if (t.closest('[data-export]')) return exportInvoices(st.invoices, 'hoa-don-cua-toi.csv');
  const inv = t.closest('[data-invoice]');
  if (inv) openInvoiceModal(st.invoices.find((i) => i.id === inv.dataset.invoice));
});

main.addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = e.target;
  const submit = form.querySelector('button[type=submit]');
  if (form.matches('[data-lookup]')) {
    const code = form.code.value.trim().toUpperCase();
    const phone = form.phone.value.replace(/\s/g, '');
    const box = form.parentElement.querySelector('[data-lookup-result]');
    const show = (ok, msg) => (box.innerHTML = `<p class="mt-3 flex items-start gap-2 rounded-md px-3 py-2.5 text-xs leading-relaxed ${ok ? 'bg-primary-50 text-primary-800' : 'bg-accent-50 text-accent-900'}"><i class="mt-0.5 ${ok ? 'ri-checkbox-circle-line' : 'ri-error-warning-line'}" aria-hidden="true"></i><span>${esc(msg)}</span></p>`);
    if (!code) return show(false, 'Vui lòng nhập mã đơn in trên vé điện tử.');
    if (!/^0\d{9}$/.test(phone)) return show(false, 'Số điện thoại phải gồm 10 số và bắt đầu bằng 0.');
    setBusy(submit, true, 'Đang tra...');
    try {
      const found = await api('account', 'lookup', { code, phone });
      rememberBookingCode(found.code);
      if (!st.bookings.some((b) => b.id === found.id)) st.bookings.unshift(found);
      st.invoices = null;
      render();
      toast(`Đã mở lại đơn ${found.code} trong lịch sử đặt sân của bạn.`);
    } catch (error) {
      setBusy(submit, false);
      show(false, error.message);
    }
    return;
  }
  const setErr = (errors) =>
    $$('[data-field]', form).forEach((f) => {
      const m = errors[f.dataset.field];
      const p = $('[data-error]', f);
      p.textContent = m || '';
      p.classList.toggle('hidden', !m);
    });
  if (form.matches('[data-profile]')) {
    setBusy(submit, true, 'Đang lưu...');
    try {
      const data = Object.fromEntries(new FormData(form));
      const profile = await api('account', 'update_profile', data);
      Object.assign(user, profile);
      setErr({});
      toast('Đã lưu thông tin cá nhân của bạn.');
    } catch (error) {
      toast(error.message, 'error');
    }
    setBusy(submit, false);
  }
  if (form.matches('[data-password]')) {
    if (form.password.value !== form.confirm.value) return setErr({ confirm: 'Mật khẩu nhập lại không khớp.' });
    setBusy(submit, true, 'Đang lưu...');
    try {
      await api('account', 'change_password', { current: form.current.value, password: form.password.value });
      form.reset();
      setErr({});
      toast('Đã đổi mật khẩu.');
    } catch (error) {
      setErr({ current: error.message });
    }
    setBusy(submit, false);
  }
});

window.addEventListener('bmt24h-favorites', () => st.tab === 'favorites' && render());
load();
