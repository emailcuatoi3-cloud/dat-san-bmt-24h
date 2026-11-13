/*
 * Module: Controller Chi tiết đơn & Vé điện tử (Mã Minh Hoan - PK04409)
 * - Render tiến trình đơn đặt, đếm ngược thời gian tới giờ ra sân
 * - Xử lý popup phóng to mã QR check-in, tải ảnh vé PNG, xuất file lịch .ics và chia sẻ link
 */
/** Chi tiết đơn: vé QR, tóm tắt, nhắc lịch (Google Calendar / .ics), link chia sẻ. */
import { $, PAGE, esc, openModal, statusBadge, formatVnd } from '../core/ui.js';
import { ticketData, ticketQrUrl, downloadTicket } from '../core/ticket.js';
import { formatLongDate, formatRelativeDay, formatShortDate, slotEndTime } from '../lib/format.js';
import { buildBookingShareUrl, buildGoogleCalendarUrl, downloadBookingIcs, formatTimeUntil, getSessionWindow } from '../lib/bookingCalendar.js';
import { cancelPolicyShort, formatCancelDeadline, isBeforeCancelCutoff } from '../lib/cancelPolicy.js';
import { copyTicketText, shareTicketNative } from '../lib/ticketShare.js';
import { HOTLINE } from '../lib/payment.js';

const b = PAGE.booking;
if (b) {
  const endTime = slotEndTime(b.slots[b.slots.length - 1] || b.slots[0] || '18:00');
  const confirmed = ['confirmed', 'completed'].includes(b.status) || ['paid', 'deposit_paid'].includes(b.paymentStatus);
  const isActive = b.status === 'pending' || b.status === 'confirmed';
  const data = ticketData(b);
  const note = (ok, text) =>
    `<p class="mt-2.5 flex items-start gap-1.5 rounded-md px-3 py-2.5 text-[11px] leading-relaxed ${ok ? 'border border-primary-300 bg-primary-50/70 text-foreground-800' : 'border border-accent-300 bg-accent-50 text-accent-900'}"><i class="mt-0.5 ${ok ? 'ri-checkbox-circle-line text-primary-600' : 'ri-error-warning-line text-accent-700'}" aria-hidden="true"></i><span>${esc(text)}</span></p>`;
  const chip = (icon, text) => `<span class="inline-flex items-center gap-1.5 rounded-md border border-background-200 bg-background-50 px-3 py-1.5 text-xs text-foreground-700"><i class="${icon}" aria-hidden="true"></i>${esc(text)}</span>`;

  $('#hero-chips').innerHTML = `${statusBadge(b.status)}${chip('ri-calendar-line text-primary-400', formatLongDate(b.date))}${chip('ri-time-line text-primary-400', `${b.slots[0]} - ${endTime}`)}${chip('ri-alarm-line text-accent-400', formatRelativeDay(b.date))}`;

  // ---- Vé QR ----
  $('#ticket-card').innerHTML = `<section class="rounded-lg border border-primary-200 bg-white p-5 md:p-6">
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div class="min-w-0"><h2 class="flex items-center gap-2 font-heading text-lg font-bold text-foreground-950"><i class="ri-qr-code-line text-primary-600" aria-hidden="true"></i>Vé QR của bạn</h2><p class="mt-1 text-sm leading-relaxed text-foreground-600">Mở vé ngay khi tới sân, không cần tìm lại tin nhắn xác nhận.</p></div>
      <span class="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-semibold ${confirmed ? 'border-primary-200 bg-primary-50 text-primary-700' : 'border-accent-200 bg-accent-50 text-accent-900'}"><i class="${confirmed ? 'ri-checkbox-circle-fill' : 'ri-time-fill'}" aria-hidden="true"></i>${confirmed ? 'Vé còn hiệu lực' : 'Chờ chủ sân xác nhận'}</span>
    </div>
    <div class="mt-4 flex flex-col gap-4 sm:flex-row sm:items-start">
      ${
        confirmed
          ? `<button type="button" data-open-qr aria-label="Phóng to mã QR" class="mx-auto flex h-[190px] w-[190px] shrink-0 cursor-pointer items-center justify-center rounded-lg border border-background-200 bg-white p-2.5 transition-transform hover:scale-[1.02] sm:mx-0"><img src="${ticketQrUrl(b)}" alt="Mã QR vé đặt sân ${esc(b.code)}" class="h-full w-full object-contain"></button>`
          : `<div class="mx-auto flex h-[190px] w-[190px] shrink-0 flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-accent-300 bg-background-50 px-4 text-center sm:mx-0"><i class="ri-qr-scan-2-line text-3xl text-accent-500" aria-hidden="true"></i><p class="text-[11px] leading-relaxed text-foreground-600">Mã QR mở ngay khi chủ sân xác nhận đơn và khoản cọc</p></div>`
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
            : `<span class="inline-flex items-center gap-1.5 rounded-md bg-accent-50 px-3 py-2.5 text-[11px] leading-relaxed text-accent-900"><i class="ri-shield-check-line text-sm" aria-hidden="true"></i>Đơn đang chờ chủ sân đối soát cọc. Vé QR và ảnh vé sẽ mở sau khi có xác nhận.</span>`
        }</div>
      </div>
    </div>
    <p class="mt-4 flex items-start gap-1.5 rounded-md bg-accent-50 px-3 py-2.5 text-[11px] leading-relaxed text-accent-900"><i class="ri-information-line mt-0.5 text-sm" aria-hidden="true"></i><span>Có mặt trước giờ chơi 10 phút. Vé QR là căn cứ check-in tại sân, chỉ chia sẻ với người thật sự cùng đội.</span></p>
    <div data-ticket-note></div>
  </section>`;

  // ---- Tóm tắt đơn ----
  const steps = [
    { title: 'Yêu cầu đặt sân đã gửi', note: `Tạo ngày ${formatShortDate((b.createdAt || b.date).slice(0, 10))}`, done: true },
    {
      title: 'Chủ sân xác nhận',
      note: b.status === 'cancelled' ? 'Đơn đã hủy trước khi xác nhận' : b.status === 'pending' ? 'Đang chờ chủ sân phản hồi qua điện thoại' : 'Chủ sân đã xác nhận lịch chơi',
      done: ['confirmed', 'completed'].includes(b.status),
      pending: b.status === 'pending',
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
        <div class="flex flex-wrap items-center gap-2"><h2 class="font-heading text-lg font-bold text-foreground-950">${esc(b.courtName)}</h2>${statusBadge(b.status)}</div>
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
      <div class="rounded-md border border-background-200 bg-background-50 p-3.5"><p class="text-xs font-bold uppercase tracking-wide text-foreground-500">Thanh toán</p><div class="mt-2 space-y-1.5 text-sm">
        <div class="flex items-start justify-between gap-3 text-foreground-600"><span>Hình thức</span><span class="text-right font-medium text-foreground-900">${esc(b.payment)}</span></div>
        ${b.discount ? `<div class="flex items-center justify-between gap-3 text-foreground-600"><span>Mã ${esc(b.promoCode || '')}</span><span class="text-right text-accent-700">-${formatVnd(b.discount)}</span></div>` : ''}
        <div class="flex items-center justify-between gap-3 text-foreground-600"><span>Tiền sân &amp; dịch vụ (${b.slots.length} giờ)</span><span class="text-right text-foreground-900">${formatVnd(b.totalPrice)}</span></div>
        <div class="flex items-center justify-between gap-3 border-t border-background-200 pt-1.5"><span class="font-semibold text-foreground-700">Tổng cộng</span><span class="font-heading text-base font-extrabold text-primary-700">${formatVnd(b.totalPrice)}</span></div>
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
}
