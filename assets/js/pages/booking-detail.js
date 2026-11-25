/*
 * Module: Controller Chi tiết đơn & Vé điện tử (Mã Minh Hoan - PK04409)
 * - Render tiến trình đơn đặt, đếm ngược thời gian tới giờ ra sân
 * - Xử lý popup phóng to mã QR check-in, tải ảnh vé PNG, xuất file lịch .ics và chia sẻ link
 */
/** Chi tiết đơn: vé QR, tóm tắt, nhắc lịch (Google Calendar / .ics), link chia sẻ. */
import { $, PAGE, esc, openModal, statusBadge, formatVnd, api } from '../core/ui.js';
import { ticketData, ticketQrUrl, downloadTicket } from '../core/ticket.js';
import { formatLongDate, formatRelativeDay, formatShortDate, slotEndTime } from '../lib/format.js';
import { buildBookingShareUrl, buildGoogleCalendarUrl, downloadBookingIcs, formatTimeUntil, getSessionWindow } from '../lib/bookingCalendar.js';
import { cancelPolicyShort, formatCancelDeadline, isBeforeCancelCutoff } from '../lib/cancelPolicy.js';
import { copyTicketText, shareTicketNative } from '../lib/ticketShare.js';
import { HOTLINE, bankAccount, buildVietQrUrl } from '../lib/payment.js';
import { formatCountdown, remainingHoldSeconds } from '../lib/booking.js';

const b = PAGE.booking;
if (b) {
  const endTime = slotEndTime(b.slots[b.slots.length - 1] || b.slots[0] || '18:00');
  const confirmed = ['confirmed', 'completed'].includes(b.status) && b.paymentStatus !== 'unpaid';
  const isPending = b.status === 'pending';
  const isApprovedWaitingDeposit = b.approvedAt && b.paymentStatus === 'unpaid' && b.status !== 'cancelled';
  const isWaitingApproval = isPending && !b.approvedAt;
  const isActive = isPending || confirmed || isApprovedWaitingDeposit;
  const secondsLeft = isApprovedWaitingDeposit ? remainingHoldSeconds(b.holdExpiresAt) : 0;
  const expired = isApprovedWaitingDeposit && secondsLeft <= 0;
  const data = ticketData(b);
  const note = (ok, text) =>
    `<p class="mt-2.5 flex items-start gap-1.5 rounded-md px-3 py-2.5 text-[11px] leading-relaxed ${ok ? 'border border-primary-300 bg-primary-50/70 text-foreground-800' : 'border border-accent-300 bg-accent-50 text-accent-900'}"><i class="mt-0.5 ${ok ? 'ri-checkbox-circle-line text-primary-600' : 'ri-error-warning-line text-accent-700'}" aria-hidden="true"></i><span>${esc(text)}</span></p>`;
  const chip = (icon, text) => `<span class="inline-flex items-center gap-1.5 rounded-md border border-background-200 bg-background-50 px-3 py-1.5 text-xs text-foreground-700"><i class="${icon}" aria-hidden="true"></i>${esc(text)}</span>`;

  const deposit = b.paymentStatus === 'paid' ? b.totalPrice : (b.depositAmount || Math.round(b.totalPrice * 0.3));
  const remainder = Math.max(0, b.totalPrice - deposit);

  const statusBadgeHtml = isApprovedWaitingDeposit
    ? `<span class="inline-flex items-center gap-1.5 rounded-full border border-accent-300 bg-accent-50 px-2.5 py-1 text-xs font-bold text-accent-900 animate-pulse"><span class="h-1.5 w-1.5 rounded-full bg-accent-500"></span>Chờ chuyển cọc (<span data-countdown="${esc(b.holdExpiresAt || '')}">${formatCountdown(secondsLeft)}</span>)</span>`
    : statusBadge(b.status);

  $('#hero-chips').innerHTML = `${statusBadgeHtml}${chip('ri-calendar-line text-primary-400', formatLongDate(b.date))}${chip('ri-time-line text-primary-400', `${b.slots[0]} - ${endTime}`)}${chip('ri-alarm-line text-accent-400', formatRelativeDay(b.date))}`;

  // ---- Vé QR hoặc Khối thanh toán cọc ----
  $('#ticket-card').innerHTML = `<section class="rounded-lg border border-primary-200 bg-white p-5 md:p-6">
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div class="min-w-0">
        <h2 class="flex items-center gap-2 font-heading text-lg font-bold text-foreground-950">
          <i class="${confirmed ? 'ri-qr-code-line text-primary-600' : isApprovedWaitingDeposit ? 'ri-bank-card-line text-accent-600' : 'ri-time-line text-accent-600'}" aria-hidden="true"></i>
          ${confirmed ? 'Vé QR của bạn' : isApprovedWaitingDeposit ? 'Chủ sân đã duyệt — Chuyển khoản cọc' : 'Yêu cầu đặt sân'}
        </h2>
        <p class="mt-1 text-sm leading-relaxed text-foreground-600">
          ${confirmed
            ? 'Mở vé ngay khi tới sân để check-in nhận sân.'
            : isApprovedWaitingDeposit
              ? 'Vui lòng chuyển cọc trong vòng <b>5 phút</b> để hoàn tất giữ sân. Quá 5 phút chưa cọc, hệ thống tự động hủy sân.'
              : 'Yêu cầu đặt sân đang chờ chủ sân duyệt. Khi chủ sân duyệt, hệ thống sẽ mở mã VietQR để bạn chuyển cọc.'}
        </p>
      </div>
      <span class="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-semibold ${confirmed ? 'border-primary-200 bg-primary-50 text-primary-700' : isApprovedWaitingDeposit ? 'border-accent-300 bg-accent-50 text-accent-900 animate-pulse' : isWaitingApproval ? 'border-accent-300 bg-accent-50 text-accent-900' : 'border-background-300 bg-background-100 text-foreground-600'}">
        <i class="${confirmed ? 'ri-checkbox-circle-fill' : isApprovedWaitingDeposit ? 'ri-time-fill' : isWaitingApproval ? 'ri-time-line animate-pulse' : 'ri-close-circle-fill'}" aria-hidden="true"></i>
        ${confirmed ? 'Chủ sân đã duyệt – Sân đã giữ' : isApprovedWaitingDeposit ? (expired ? 'Đã hết giờ chuyển cọc' : `Chờ cọc (<span data-countdown="${esc(b.holdExpiresAt || '')}">${formatCountdown(secondsLeft)}</span>)`) : isWaitingApproval ? 'Chờ chủ sân duyệt đơn' : 'Đơn đã hủy'}
      </span>
    </div>

    ${isApprovedWaitingDeposit ? `
      <div class="mt-4 rounded-xl border border-accent-300 bg-accent-50/70 p-4">
        <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-3 mb-3 border-b border-accent-200">
          <div class="flex items-center gap-2">
            <i class="ri-alarm-warning-line text-lg text-accent-700 animate-pulse shrink-0"></i>
            <span class="text-xs font-bold text-accent-950">Thời gian giữ sân để bạn chuyển cọc:</span>
          </div>
          <span class="inline-flex items-center gap-1.5 font-mono text-sm font-extrabold text-accent-700 bg-white px-3 py-1 rounded-md border border-accent-300 shadow-sm">
            <i class="ri-time-line text-xs"></i><span data-countdown="${esc(b.holdExpiresAt || '')}">${formatCountdown(secondsLeft)}</span>
          </span>
        </div>
        <div class="flex flex-col gap-4 sm:flex-row sm:items-center">
          <div class="mx-auto flex h-[190px] w-[190px] shrink-0 items-center justify-center rounded-lg border border-background-200 bg-white p-2">
            <img src="${buildVietQrUrl(deposit, b.code)}" alt="VietQR cọc ${formatVnd(deposit)}" class="h-full w-full object-contain ${expired ? 'opacity-40' : ''}">
          </div>
          <div class="min-w-0 flex-1 space-y-2 text-xs">
            <div class="flex justify-between"><span class="text-foreground-500">Ngân hàng</span><span class="font-semibold text-foreground-900">${esc(bankAccount.bankName)}</span></div>
            <div class="flex justify-between"><span class="text-foreground-500">Số tài khoản</span><span class="font-mono font-bold text-foreground-900">${esc(bankAccount.accountNumber)}</span></div>
            <div class="flex justify-between"><span class="text-foreground-500">Chủ tài khoản</span><span class="font-semibold text-foreground-900">${esc(bankAccount.accountName)}</span></div>
            <div class="flex justify-between"><span class="text-foreground-500">Số tiền cọc</span><span class="font-heading font-black text-primary-600 text-sm">${formatVnd(deposit)}</span></div>
            <div class="flex justify-between"><span class="text-foreground-500">Nội dung CK</span><span class="font-mono font-bold text-primary-700">${esc(b.code)}</span></div>
            <div class="mt-3 flex gap-2 pt-2">
              <button type="button" data-claim-deposit ${expired ? 'disabled' : ''} class="inline-flex cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-md bg-accent-500 px-4 py-2.5 text-xs font-bold text-background-950 transition-colors hover:bg-accent-600 disabled:opacity-50">
                <i class="ri-check-double-line"></i>Tôi đã chuyển khoản
              </button>
            </div>
          </div>
        </div>
      </div>
    ` : `
      <div class="mt-4 flex flex-col gap-4 sm:flex-row sm:items-start">
        ${
          confirmed
            ? `<button type="button" data-open-qr aria-label="Phóng to mã QR" class="mx-auto flex h-[190px] w-[190px] shrink-0 cursor-pointer items-center justify-center rounded-lg border border-background-200 bg-white p-2.5 transition-transform hover:scale-[1.02] sm:mx-0"><img src="${ticketQrUrl(b)}" alt="Mã QR vé đặt sân ${esc(b.code)}" class="h-full w-full object-contain"></button>`
            : `<div class="mx-auto flex h-[190px] w-[190px] shrink-0 flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-accent-300 bg-accent-50/50 p-4 text-center sm:mx-0">
                <i class="ri-time-line text-3xl text-accent-600 animate-pulse" aria-hidden="true"></i>
                <p class="text-xs font-bold text-accent-900">Đang chờ chủ sân duyệt</p>
                <p class="text-[11px] leading-relaxed text-foreground-600">Khi chủ sân duyệt, hệ thống sẽ mở mã VietQR để bạn chuyển cọc trong 5 phút</p>
               </div>`
        }
        <div class="min-w-0 flex-1">
          <p class="text-xs font-medium text-foreground-500">Mã vé điện tử</p>
          <p class="mt-0.5 font-heading text-xl font-extrabold tracking-wide text-primary-700">${esc(b.code)}</p>
          <dl class="mt-3 space-y-2 text-sm"><div><dt class="text-xs text-foreground-500">Sân</dt><dd class="font-semibold text-foreground-950">${esc(b.courtName)}</dd></div><div><dt class="text-xs text-foreground-500">Thời gian</dt><dd class="font-semibold text-foreground-950">${b.slots[0]} - ${endTime} · ${formatLongDate(b.date)}</dd></div></dl>
          <div class="mt-3 flex flex-wrap gap-2">${
            confirmed
              ? `<button type="button" data-open-qr class="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-md bg-primary-500 px-3.5 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-primary-600"><i class="ri-qr-scan-2-line text-sm" aria-hidden="true"></i>Mở vé QR nhanh</button>
                 <button type="button" data-download class="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-md border border-background-300 px-3.5 py-2.5 text-xs font-semibold text-foreground-800 transition-colors hover:border-primary-400 hover:text-primary-700"><i class="ri-download-2-line text-sm" aria-hidden="true"></i>Tải ảnh vé</button>
                 <button type="button" onclick="window.print()" class="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-md border border-background-300 px-3.5 py-2.5 text-xs font-semibold text-foreground-800 transition-colors hover:border-primary-400 hover:text-primary-700"><i class="ri-printer-line text-sm" aria-hidden="true"></i>In vé</button>`
              : `<span class="inline-flex items-center gap-1.5 rounded-md bg-accent-50 px-3 py-2 text-xs leading-relaxed text-accent-900 border border-accent-200"><i class="ri-time-line text-sm text-accent-700" aria-hidden="true"></i>Yêu cầu đang chờ chủ sân kiểm tra và duyệt lịch. Vé check-in sẽ mở sau khi hoàn tất cọc.</span>`
          }</div>
        </div>
      </div>
    `}
    <p class="mt-4 flex items-start gap-1.5 rounded-md bg-background-50 px-3 py-2.5 text-[11px] leading-relaxed text-foreground-600"><i class="ri-information-line mt-0.5 text-sm" aria-hidden="true"></i><span>Có mặt trước giờ chơi 10 phút. Vé QR là căn cứ check-in tại sân, chỉ chia sẻ với người cùng đội.</span></p>
    <div data-ticket-note></div>
  </section>`;

  // ---- Tóm tắt đơn ----
  const steps = [
    { title: 'Yêu cầu đặt sân đã gửi', note: `Tạo ngày ${formatShortDate((b.createdAt || b.date).slice(0, 10))}`, done: true },
    {
      title: 'Chủ sân duyệt đơn',
      note: b.status === 'cancelled' ? (b.rejectReason ? `Chủ sân từ chối: ${b.rejectReason}` : 'Đơn đã hủy') : b.approvedAt ? 'Chủ sân đã duyệt lịch đặt sân' : 'Chủ sân đang kiểm tra và duyệt lịch',
      done: Boolean(b.approvedAt || confirmed),
      pending: isWaitingApproval,
    },
    {
      title: 'Thanh toán cọc giữ sân (5 phút)',
      note: confirmed ? 'Đã nhận tiền cọc thành công' : isApprovedWaitingDeposit ? (expired ? 'Đã hết thời gian 5 phút chuyển cọc' : 'Vui lòng chuyển cọc trong vòng 5 phút') : 'Mở khi chủ sân duyệt đơn',
      done: confirmed,
      pending: isApprovedWaitingDeposit,
      danger: expired && isPending,
    },
    {
      title: b.status === 'cancelled' ? 'Đơn đã hủy' : 'Hoàn thành lượt chơi',
      note: b.status === 'cancelled' ? b.cancelReason || b.rejectReason || 'Khách hàng đã hủy đơn' : b.status === 'completed' ? 'Buổi chơi đã kết thúc, cảm ơn bạn đã sử dụng dịch vụ' : `Dự kiến ${formatLongDate(b.date)}`,
      done: b.status === 'completed',
      danger: b.status === 'cancelled',
    },
  ];
  const dd = (label, value, cls = 'text-foreground-900') => `<div><dt class="text-xs text-foreground-500">${label}</dt><dd class="${cls}">${value}</dd></div>`;
  $('#summary-card').innerHTML = `<section class="overflow-hidden rounded-lg border border-background-200 bg-white">
    <div class="flex flex-col sm:flex-row">
      <div class="h-[170px] w-full shrink-0 overflow-hidden bg-background-100 sm:h-auto sm:w-[240px]"><img src="${esc(b.image)}" alt="${esc(b.courtName)}" class="h-full w-full object-cover object-top"></div>
      <div class="min-w-0 flex-1 p-5">
        <div class="flex flex-wrap items-center gap-2"><h2 class="font-heading text-lg font-bold text-foreground-950">${esc(b.courtName)}</h2>${statusBadgeHtml}</div>
        <p class="mt-1 flex items-start gap-1.5 text-xs text-foreground-500"><i class="ri-map-pin-line mt-0.5" aria-hidden="true"></i><span>${esc(b.address)}</span></p>
        <dl class="mt-4 grid grid-cols-1 gap-x-5 gap-y-3 text-sm sm:grid-cols-2">
          ${dd('Mã đơn', esc(b.code), 'font-mono text-xs font-semibold text-foreground-900')}${dd('Loại sân', esc(b.sportLabel))}
          ${dd('Ngày chơi', formatLongDate(b.date), 'font-medium text-foreground-900')}${dd('Khung giờ', `${b.slots[0]} - ${endTime} (${b.slots.length} giờ)`, 'font-medium text-foreground-900')}
          ${dd('Giá trung bình', `${formatVnd(Math.round(b.totalPrice / Math.max(1, b.slots.length)))}/giờ`)}${dd('Khu vực', esc(b.area))}
        </dl>
      </div>
    </div>
    <div class="grid grid-cols-1 gap-3 border-t border-background-200 p-5 sm:grid-cols-2">
      <div class="rounded-md border border-background-200 bg-background-50 p-3.5"><p class="text-xs font-bold uppercase tracking-wide text-foreground-500">Thông tin liên hệ</p><p class="mt-2 text-sm font-semibold text-foreground-950">${esc(b.customerName || 'Khách hàng')}</p>${b.customerPhone ? `<p class="mt-0.5 text-xs text-foreground-600">${esc(b.customerPhone)}</p>` : ''}${b.customerEmail ? `<p class="text-xs text-foreground-600">${esc(b.customerEmail)}</p>` : ''}${b.note ? `<p class="mt-2 border-t border-background-200 pt-2 text-xs leading-relaxed text-foreground-600"><span class="font-semibold text-foreground-800">Ghi chú: </span>${esc(b.note)}</p>` : ''}</div>
      <div class="rounded-md border border-background-200 bg-background-50 p-3.5"><p class="text-xs font-bold uppercase tracking-wide text-foreground-500">Thanh toán</p><div class="mt-2 space-y-2 text-sm">
        <div class="flex items-start justify-between gap-3 text-foreground-600"><span>Hình thức</span><span class="text-right font-medium text-foreground-900">${esc(b.payment)}</span></div>
        <div class="flex items-center justify-between gap-3 text-foreground-600"><span>Tiền sân (${b.slots.length} giờ)</span><span class="text-right text-foreground-900">${formatVnd(b.baseTotal || b.totalPrice)}</span></div>
        ${Array.isArray(b.extras) && b.extras.length > 0 ? `
          <div class="space-y-1 border-t border-dashed border-background-200 pt-2 text-xs">
            <span class="font-semibold text-foreground-700">Dịch vụ & Tiện ích thêm:</span>
            ${b.extras.map((x) => {
              const q = Number(x.quantity) || 1;
              const name = x.label || x.name || (typeof x === 'string' ? x : 'Dịch vụ');
              const vName = x.variantName ? ` (${esc(x.variantName)})` : '';
              const p = Number(x.price) || 0;
              return `<div class="flex justify-between pl-2 text-foreground-600">
                <span>• ${esc(name)}${vName}${q > 1 ? ` x${q}` : ''}</span>
                <span class="font-medium">${formatVnd(p * q)}</span>
              </div>`;
            }).join('')}
          </div>
        ` : ''}
        ${b.discount ? `<div class="flex items-center justify-between gap-3 text-accent-700"><span class="flex items-center gap-1"><i class="ri-coupon-3-line" aria-hidden="true"></i>Mã ${esc(b.promoCode || '')}</span><span class="text-right font-semibold">-${formatVnd(b.discount)}</span></div>` : ''}
        <div class="flex items-center justify-between gap-3 border-t border-background-200 pt-2 text-foreground-800"><span class="font-semibold">Tổng tiền sân</span><span class="font-heading font-bold text-foreground-950">${formatVnd(b.totalPrice)}</span></div>
        <div class="flex items-center justify-between gap-3 rounded bg-accent-50/80 px-2.5 py-1.5 text-xs dark:bg-accent-950/40">
          <span class="font-medium text-accent-900 dark:text-accent-200">${b.paymentStatus === 'paid' ? 'Đã thanh toán (100%):' : 'Tiền cọc đã thanh toán:'}</span>
          <span class="font-heading font-bold text-accent-700 dark:text-accent-300">${formatVnd(deposit)}</span>
        </div>
        ${b.paymentStatus !== 'paid' ? `
          <div class="flex items-center justify-between gap-3 border-t border-dashed border-background-200 pt-1.5 text-xs text-foreground-600">
            <span>Còn lại thanh toán tại sân:</span>
            <span class="font-heading text-sm font-extrabold text-primary-600 dark:text-primary-400">${formatVnd(remainder)}</span>
          </div>` : ''}
      </div></div>
    </div>
    <div class="border-t border-background-200 p-5"><p class="text-xs font-bold uppercase tracking-wide text-foreground-500">Trạng thái đơn</p>
      <ol class="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">${steps
        .map(
          (s) => `<li class="flex gap-2.5"><span class="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${s.danger ? 'bg-accent-100 text-accent-700' : s.done ? 'bg-primary-100 text-primary-700' : s.pending ? 'bg-accent-100 text-accent-700' : 'bg-background-200 text-foreground-400'}"><i class="text-[11px] ${s.danger ? 'ri-close-line' : s.done ? 'ri-check-line' : s.pending ? 'ri-time-line' : 'ri-subtract-line'}" aria-hidden="true"></i></span><div class="min-w-0"><p class="text-sm font-semibold text-foreground-900">${s.title}</p><p class="text-xs leading-relaxed text-foreground-500">${esc(s.note)}</p></div></li>`,
        )
        .join('')}</ol></div>
    <div class="border-t border-background-200 bg-background-50 p-5"><div class="flex items-start gap-2.5"><span class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-primary-600"><i class="ri-shield-check-line text-lg" aria-hidden="true"></i></span><div class="min-w-0">
      <p class="text-xs font-semibold uppercase tracking-wide text-foreground-500">Chính sách hủy sân</p>
      <p class="mt-1 text-xs leading-relaxed text-foreground-600">${cancelPolicyShort} ${isActive ? `<span class="font-semibold text-foreground-800">Hạn hủy vé của đơn này: ${formatCancelDeadline(b.date, b.slots[0]) || 'đã qua'}.</span>` : ''}</p>
      <p class="mt-1.5 text-[11px] leading-relaxed text-foreground-500">Cần đổi giờ hoặc hủy sát giờ, gọi <a href="tel:${HOTLINE.replace(/\D/g, '')}" class="font-semibold text-primary-600 hover:text-primary-700">${HOTLINE}</a> để chủ sân hỗ trợ trực tiếp.${isActive && !isBeforeCancelCutoff(b.date, b.slots) ? ' Hiện đã qua mốc hủy tự động trên hệ thống.' : ''}</p>
    </div></div></div>
  </section>`;

  // ---- Nhắc lịch ----
  const calBooking = { ...b, address: b.address };
  function renderReminder() {
    const session = getSessionWindow(calBooking);
    const now = Date.now();
    const startAt = session ? session.start.getTime() : 0;
    const endAt = session ? session.end.getTime() : 0;
    let box = '';
    if (isActive && session && startAt - now > 0)
      box = `<div class="mt-3 rounded-lg border border-primary-200 bg-primary-50/50 p-3.5"><p class="text-[11px] font-semibold uppercase tracking-wide text-primary-700">Còn lại tới giờ chơi</p><p class="mt-1 font-heading text-2xl font-extrabold leading-tight text-foreground-950">${formatTimeUntil(startAt - now)}</p><p class="mt-1 text-[11px] text-foreground-600">Bắt đầu ${b.slots[0]} · ${formatLongDate(b.date)}</p></div>`;
    else if (isActive && session && now >= startAt && now < endAt)
      box = `<div class="mt-3 rounded-lg border border-primary-200 bg-primary-50/50 p-3.5"><p class="text-[11px] font-semibold uppercase tracking-wide text-primary-700">Đang trong giờ chơi</p><p class="mt-1 font-heading text-xl font-extrabold leading-tight text-foreground-950">Kết thúc sau ${formatTimeUntil(endAt - now)}</p><p class="mt-1 text-[11px] text-foreground-600">Khung giờ ${b.slots[0]} - ${endTime}</p></div>`;
    else if (!isActive)
      box = `<div class="mt-3 rounded-lg border border-background-200 bg-background-50 p-3.5"><p class="text-xs leading-relaxed text-foreground-600">${b.status === 'cancelled' ? 'Đơn này đã hủy nên không còn lịch nhắc. Bạn có thể đặt lại khung giờ khác nếu cần.' : session && now >= endAt ? 'Lượt chơi đã kết thúc. Bạn có thể đặt lại sân cho tuần tới.' : 'Đơn đã hoàn thành, lịch nhắc không còn cần thiết.'}</p></div>`;
    $('#reminder-card [data-remind-box]').innerHTML = box;
  }
  $('#reminder-card').innerHTML = `<section class="rounded-lg border border-background-200 bg-white p-5">
    <h2 class="flex items-center gap-2 font-heading text-base font-bold text-foreground-950"><i class="ri-notification-3-line text-accent-500" aria-hidden="true"></i>Nhắc lịch chơi</h2>
    <p class="mt-1 text-xs leading-relaxed text-foreground-600">Thêm vào lịch điện thoại để không quên giờ ra sân.</p>
    <div data-remind-box></div>
    <div class="mt-3 flex flex-col gap-2">
      <a href="${esc(buildGoogleCalendarUrl(calBooking))}" target="_blank" rel="noopener noreferrer" class="flex cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-md bg-primary-500 px-4 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-primary-600"><i class="ri-google-fill" aria-hidden="true"></i>Thêm vào Google Calendar</a>
      <button type="button" data-ics class="flex cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-md border border-background-300 px-4 py-2.5 text-xs font-semibold text-foreground-800 transition-colors hover:border-primary-400 hover:text-primary-700"><i class="ri-calendar-check-line" aria-hidden="true"></i>Tải nhắc lịch (.ics)</button>
    </div>
    <div data-ics-note></div>
    <div class="mt-3 flex flex-wrap gap-1.5"><span class="inline-flex items-center gap-1 rounded-full bg-background-100 px-2.5 py-1 text-[10px] font-medium text-foreground-600"><i class="ri-alarm-line" aria-hidden="true"></i>Nhắc trước 2 giờ</span><span class="inline-flex items-center gap-1 rounded-full bg-background-100 px-2.5 py-1 text-[10px] font-medium text-foreground-600"><i class="ri-alarm-line" aria-hidden="true"></i>Nhắc trước 45 phút</span></div>
  </section>`;
  renderReminder();
  setInterval(renderReminder, 30000);

  // ---- Link chia sẻ ----
  const shareUrl = buildBookingShareUrl(b.code);
  $('#share-card').innerHTML = `<section class="rounded-lg border border-background-200 bg-white p-5">
    <h2 class="flex items-center gap-2 font-heading text-base font-bold text-foreground-950"><i class="ri-link text-primary-600" aria-hidden="true"></i>Link chia sẻ đơn</h2>
    <p class="mt-1 text-xs leading-relaxed text-foreground-600">Gửi đường dẫn này cho người cùng đội để họ tự mở vé QR và xem giờ chơi, không cần chụp lại vé.</p>
    <div class="mt-3 flex items-center gap-2 rounded-md border border-background-300 bg-background-50 px-3 py-2"><i class="ri-links-line shrink-0 text-foreground-400" aria-hidden="true"></i><input type="text" readonly value="${esc(shareUrl)}" onfocus="this.select()" aria-label="Đường dẫn chia sẻ của đơn đặt sân" class="min-w-0 flex-1 cursor-text bg-transparent text-xs text-foreground-800 outline-none"></div>
    <div class="mt-2.5 flex flex-col gap-2 sm:flex-row">
      <button type="button" data-copy-link class="flex flex-1 cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-md bg-primary-500 px-3 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-primary-600"><i class="ri-file-copy-line text-sm" aria-hidden="true"></i>Sao chép link</button>
      <button type="button" data-share-link class="flex flex-1 cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-md border border-background-300 px-3 py-2.5 text-xs font-semibold text-foreground-800 transition-colors hover:border-primary-400 hover:text-primary-700"><i class="ri-share-forward-2-line text-sm" aria-hidden="true"></i>Chia sẻ</button>
    </div>
    <div data-share-note></div>
    <p class="mt-2.5 flex items-start gap-1.5 text-[11px] leading-relaxed text-foreground-500"><i class="ri-lock-2-line mt-0.5" aria-hidden="true"></i><span>Ai có đường dẫn đều xem được vé của đơn này. Chỉ chia sẻ trong nhóm đội của bạn và thu hồi tin nhắn khi không cần nữa.</span></p>
  </section>`;

  // ---- Modal vé QR phóng to ----
  function openQrModal() {
    const modal = openModal({
      size: 'max-w-md',
      html: `<div class="p-5">
        <div class="flex items-start justify-between gap-3"><div class="min-w-0"><p class="text-[11px] font-semibold uppercase tracking-wide text-foreground-500">Vé điện tử</p><h2 class="mt-0.5 font-heading text-base font-extrabold text-foreground-950">${esc(b.courtName)}</h2><p class="mt-0.5 font-mono text-xs font-semibold text-primary-700">${esc(b.code)}</p></div><button type="button" data-close aria-label="Đóng" class="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-md text-foreground-500 transition-colors hover:bg-background-100 hover:text-foreground-900"><i class="ri-close-line text-xl" aria-hidden="true"></i></button></div>
        <div class="mt-4 w-full rounded-xl border border-dashed border-primary-300 bg-primary-50/30 p-4"><div class="mx-auto h-[260px] w-[260px] max-w-full overflow-hidden rounded-lg bg-white p-3"><img src="${ticketQrUrl(b)}" alt="Mã QR vé đặt sân ${esc(b.code)}" class="h-full w-full object-contain"></div><p class="mt-3 text-center text-xs font-semibold text-primary-900">Đưa mã này cho nhân viên sân khi tới nhận sân</p><p class="mt-1 text-center text-[11px] leading-relaxed text-foreground-600">Mẹo: tăng độ sáng màn hình để máy quét nhận mã nhanh hơn.</p></div>
        <dl class="mt-3 grid grid-cols-1 gap-y-2 rounded-md border border-background-200 bg-background-50 p-3.5 text-sm sm:grid-cols-2"><div><dt class="text-xs text-foreground-500">Ngày chơi</dt><dd class="font-semibold text-foreground-950">${formatLongDate(b.date)}</dd></div><div><dt class="text-xs text-foreground-500">Khung giờ</dt><dd class="font-semibold text-foreground-950">${b.slots[0]} - ${endTime}</dd></div><div class="sm:col-span-2"><dt class="text-xs text-foreground-500">Địa chỉ</dt><dd class="text-foreground-800">${esc(b.address)}</dd></div></dl>
        <div class="mt-3 flex flex-col gap-2"><button type="button" data-download class="flex w-full cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-md bg-primary-500 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-primary-600"><i class="ri-download-2-line text-base" aria-hidden="true"></i>Tải ảnh vé về máy</button><button type="button" data-close class="w-full cursor-pointer whitespace-nowrap rounded-md border border-background-300 px-4 py-2.5 text-sm font-semibold text-foreground-800 transition-colors hover:border-primary-400 hover:text-primary-700">Đóng vé</button></div>
      </div>`,
    });
    modal.el.querySelector('[data-download]').addEventListener('click', () => doDownload(modal.el));
  }

  async function doDownload(scope) {
    const target = scope.querySelector('[data-ticket-note]') || scope.firstElementChild;
    try {
      const msg = await downloadTicket(data);
      if (target === scope.querySelector('[data-ticket-note]')) target.innerHTML = note(true, msg);
    } catch (error) {
      $('[data-ticket-note]').innerHTML = note(false, error.message || 'Chưa tạo được ảnh vé. Vui lòng thử lại.');
    }
  }

  document.addEventListener('click', async (event) => {
    const t = event.target;
    if (t.closest('[data-claim-deposit]')) {
      const btn = t.closest('[data-claim-deposit]');
      btn.disabled = true;
      btn.innerHTML = '<i class="ri-loader-4-line animate-spin text-sm"></i> Đang xác nhận cọc…';
      try {
        await api('booking', 'claim', { id: b.id });
        await new Promise((r) => setTimeout(r, 4000));
        await api('booking', 'auto_confirm', { id: b.id });
        location.reload();
      } catch (err) {
        alert(err.message);
        location.reload();
      }
      return;
    }
    if (t.closest('[data-open-qr]')) return openQrModal();
    if (t.closest('#ticket-card [data-download]')) return doDownload($('#ticket-card'));
    if (t.closest('[data-ics]')) {
      const ok = downloadBookingIcs(calBooking);
      $('[data-ics-note]').innerHTML = note(ok, ok ? 'Đã tải tệp nhắc lịch. Mở tệp bằng ứng dụng Lịch (iPhone/Android) để thêm sự kiện kèm 2 lần nhắc.' : 'Chưa tạo được tệp nhắc lịch. Bạn thử lại hoặc dùng nút Google Calendar bên trên.');
      return;
    }
    if (t.closest('[data-copy-link]')) {
      const ok = await copyTicketText(shareUrl);
      $('[data-share-note]').innerHTML = note(ok, ok ? 'Đã sao chép đường dẫn. Gửi vào nhóm Zalo hoặc Messenger của đội là mở được ngay.' : 'Chưa sao chép tự động được. Bấm giữ vào ô đường dẫn để chép tay.');
      return;
    }
    if (t.closest('[data-share-link]')) {
      const outcome = await shareTicketNative({ title: `Đơn đặt sân ${b.code}`, text: `${b.courtName} · ${b.slots[0]} - ${endTime} · ${formatLongDate(b.date)}\n${shareUrl}` });
      if (outcome === 'shared') $('[data-share-note]').innerHTML = note(true, 'Đã mở hộp chia sẻ của thiết bị. Chọn ứng dụng để gửi đường dẫn đơn.');
      else if (outcome === 'cancelled') $('[data-share-note]').innerHTML = '';
      else {
        const ok = await copyTicketText(shareUrl);
        $('[data-share-note]').innerHTML = note(ok, ok ? 'Thiết bị chưa hỗ trợ hộp chia sẻ. Đường dẫn đã được sao chép để bạn dán vào cuộc trò chuyện.' : 'Chưa chia sẻ được. Bạn bấm giữ vào ô đường dẫn để chép tay.');
      }
    }
  });

  if (new URLSearchParams(location.search).get('ve') === '1' && confirmed) openQrModal();

  if (isPending || isApprovedWaitingDeposit) {
    const detailPollInterval = setInterval(async () => {
      try {
        const latest = await api('booking', 'get', { code: b.code }, 'GET');
        if (latest) {
          if (latest.approvedAt !== b.approvedAt || latest.status !== b.status || latest.paymentStatus !== b.paymentStatus) {
            clearInterval(detailPollInterval);
            location.reload();
          }
        }
      } catch (e) {
        // ignore background poll errors
      }
    }, 3000);
  }

  if (isApprovedWaitingDeposit && !expired) {
    const countdownInterval = setInterval(() => {
      const sec = remainingHoldSeconds(b.holdExpiresAt);
      document.querySelectorAll('[data-countdown]').forEach((el) => {
        el.textContent = formatCountdown(sec);
      });
      if (sec <= 0) {
        clearInterval(countdownInterval);
        location.reload();
      }
    }, 1000);
  }
}
