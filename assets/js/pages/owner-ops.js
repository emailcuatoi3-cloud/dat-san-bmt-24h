/**
 * Kênh chủ sân — nhóm VẬN HÀNH: tổng quan, đơn đặt sân, sân của tôi, lịch & khung giờ, đánh giá, hóa đơn.
 */
import { api, esc, toast, confirmBox, setBusy, formData, on, statusBadge, emptyState, loadingBlock, errorBlock, formatDateTime, downloadCsv } from '../core/ui.js';
import { openInvoiceModal, invoiceBadge, filterByDate, exportInvoices } from '../core/invoice.js';
import { detectBookingConflicts, collectConflictIds } from '../lib/bookingConflicts.js';
import { parseTicketPayload } from '../lib/checkin.js';
import { TIME_OPTIONS, WEEKDAY_KEYS, WEEKDAY_LABELS, normalizeWeeklyHours, weekdaySummary, isWeeklyCustomized, hoursForDate, toMinutes, minutesToTime } from '../lib/openingHours.js';
import {
  S, PAGE, TODAY, main, actions, loadData, refreshBadges, BTN, BTN_OUT, BTN_DANGER, BTN_SM, BTN_SM_PRI, BTN_SM_DANGER, INPUT, LABEL, CARD,
  chip, statCard, sectionTitle, modal, slotText, dateText, longDate, money, isActive, courtById, addDays, sourceBadge, courtOptions,
} from './owner-shared.js?v=20261125_03';

const rerender = () => window.__ownerRender && window.__ownerRender();

// =====================================================================
// HÀNH ĐỘNG VỚI ĐƠN (dùng ở nhiều tab)
// =====================================================================

async function setStatus(b, status, reason = '') {
  const updated = await api('owner', 'booking_status', { id: b.id, status, reason });
  const i = S.bookings.findIndex((x) => x.id === b.id);
  if (i >= 0) S.bookings[i] = updated;
  refreshBadges();
  return updated;
}

let isApproving = false;

export async function approveBooking(b) {
  if (!b || isApproving) return;
  const conflict = detectBookingConflicts(b, S.bookings, S.blocked);
  if (conflict.hasConflict) {
    const lines = conflict.overlaps.map((o) => `<br>• <b>${esc(o.booking.code)}</b> – ${esc(o.booking.customerName)} (${o.slots.join(', ')}) · ${o.booking.status === 'pending' ? 'chờ duyệt' : 'đã xác nhận'}`).join('');
    const blocked = conflict.blockedSlots.length ? `<br>• Khung giờ đang khóa: ${conflict.blockedSlots.join(', ')}` : '';
    const ok = await confirmBox({
      title: 'Đơn này bị trùng lịch',
      message: `Đơn ${esc(b.code)} trùng với:<span class="mt-1 block text-xs">${lines}${blocked}</span><span class="mt-2 block">Bạn vẫn muốn duyệt? Hãy liên hệ khách để sắp xếp lại.</span>`,
      confirmText: 'Vẫn duyệt đơn',
      icon: 'ri-error-warning-line',
      danger: true,
    });
    if (!ok) return;
  }
  isApproving = true;
  try {
    const updated = await setStatus(b, 'confirmed');
    toast(updated?.paymentStatus === 'unpaid' ? `Đã duyệt đơn ${b.code}. Khách có 5 phút để chuyển cọc giữ sân.` : `Đã duyệt đơn ${b.code}.`);
    rerender();
  } catch (e) {
    toast(e.message, 'error');
  } finally {
    isApproving = false;
  }
}

export function rejectBooking(b, cancelMode = false) {
  const reasons = PAGE.rejectReasons || [];
  const m = modal(
    cancelMode ? `Hủy đơn ${esc(b.code)}` : `Từ chối đơn ${esc(b.code)}`,
    `<p class="text-sm text-foreground-600">Chọn lý do để gửi cho khách <b>${esc(b.customerName)}</b>:</p>
     <div class="mt-3 space-y-2">${[...reasons, PAGE.otherReason].map((r, i) => `<label class="flex cursor-pointer items-start gap-2 rounded-md border border-background-200 px-3 py-2.5 text-sm hover:border-primary-300"><input type="radio" name="reason" value="${esc(r)}" ${i === 0 ? 'checked' : ''} class="mt-0.5 accent-primary-500">${esc(r)}</label>`).join('')}</div>
     <textarea data-other rows="3" class="${INPUT} mt-3 hidden" placeholder="Nhập lý do cụ thể..."></textarea>`,
    `<button type="button" data-close class="${BTN_OUT}">Quay lại</button><button type="button" data-ok class="${BTN} !bg-accent-600 hover:!bg-accent-700">${cancelMode ? 'Hủy đơn' : 'Từ chối đơn'}</button>`,
  );
  const other = m.el.querySelector('[data-other]');
  m.el.addEventListener('change', () => other.classList.toggle('hidden', m.el.querySelector('input[name=reason]:checked').value !== PAGE.otherReason));
  m.el.querySelector('[data-ok]').addEventListener('click', async (e) => {
    let reason = m.el.querySelector('input[name=reason]:checked').value;
    if (reason === PAGE.otherReason) reason = other.value.trim();
    if (reason.length < 5) return toast('Vui lòng nhập lý do (ít nhất 5 ký tự).', 'error');
    setBusy(e.currentTarget, true, 'Đang lưu...');
    try {
      await setStatus(b, 'cancelled', reason);
      m.close();
      toast(cancelMode ? 'Đã hủy đơn.' : 'Đã từ chối đơn và gửi lý do cho khách.');
      rerender();
    } catch (err) {
      setBusy(e.currentTarget, false);
      toast(err.message, 'error');
    }
  });
}

export async function checkIn(b, code = '') {
  try {
    const updated = await api('owner', 'checkin', b ? { id: b.id } : { code });
    const i = S.bookings.findIndex((x) => x.id === updated.id);
    if (i >= 0) S.bookings[i] = updated;
    toast(`Đã check-in ${updated.code} – ${updated.customerName}.`);
    rerender();
    return updated;
  } catch (e) {
    toast(e.message, 'error');
    return null;
  }
}

export function openBookingDetail(b) {
  const row = (l, v) => `<div class="flex items-start justify-between gap-3 py-1.5 text-sm"><span class="text-foreground-500">${l}</span><span class="text-right font-medium text-foreground-900">${v}</span></div>`;
  const extras = (b.extras || []).map((x) => {
    const name = esc(x.label || x.name || 'Dịch vụ');
    const vname = x.variantName ? ` - ${esc(x.variantName)}` : '';
    const qty = (x.quantity && x.quantity > 1) ? ` x${x.quantity}` : (x.qty && x.qty > 1 ? ` x${x.qty}` : '');
    const prc = money(x.total || (x.price * (x.qty || x.quantity || 1)) || 0);
    return `${name}${vname}${qty} (${prc})`;
  }).join(', ');
  const remaining = Math.max(0, b.totalPrice - (b.paymentStatus === 'paid' ? b.totalPrice : (b.depositAmount || 0)));
  const btns = [];
  if (b.status === 'pending') {
    if (!b.approvedAt) {
      btns.push(`<button type="button" data-act="reject" class="${BTN_OUT}">Từ chối</button><button type="button" data-act="approve" class="${BTN}">Duyệt đơn</button>`);
    } else {
      btns.push(`<button type="button" data-act="cancel" class="${BTN_OUT}">Hủy đơn</button><span class="text-xs text-primary-700 font-semibold self-center">Chờ khách cọc (5 phút)</span>`);
    }
  }
  if (b.status === 'confirmed') {
    btns.push(`<button type="button" data-act="cancel" class="${BTN_OUT}">Hủy đơn</button>`);
    if (b.paymentStatus !== 'paid' && remaining > 0) btns.push(`<button type="button" data-act="pay" class="${BTN_OUT}"><i class="ri-hand-coin-line"></i>Thu đủ (${money(remaining)})</button>`);
    if (!b.checkedInAt) btns.push(`<button type="button" data-act="checkin" class="${BTN}"><i class="ri-qr-scan-2-line"></i>Check-in</button>`);
  }
  if (['pending', 'confirmed'].includes(b.status)) {
    btns.push(`<button type="button" data-act="reschedule" class="${BTN_OUT}"><i class="ri-calendar-event-line"></i>Đổi giờ</button>`);
  }
  if (b.status === 'completed' && b.paymentStatus !== 'paid' && remaining > 0) {
    btns.push(`<button type="button" data-act="pay" class="${BTN}"><i class="ri-hand-coin-line"></i>Thu đủ tiền (${money(remaining)})</button>`);
  }
  if ((b.depositAmount > 0 || ['deposit_paid', 'paid', 'refunded'].includes(b.paymentStatus)) && (b.status === 'cancelled' || b.paymentStatus === 'refunded')) {
    if (b.paymentStatus === 'refunded') {
      btns.push(`<span class="inline-flex items-center gap-1 rounded bg-secondary-50 px-2.5 py-1 text-xs font-semibold text-secondary-800"><i class="ri-checkbox-circle-line"></i>Đã hoàn cọc</span>`);
    } else {
      btns.push(`<button type="button" data-act="refund" class="${BTN_OUT} border-accent-300 text-accent-700 hover:bg-accent-50"><i class="ri-refund-2-line"></i>Hoàn cọc</button>`);
    }
  }
  const m = modal(
    `Đơn ${esc(b.code)}`,
    `<div class="mb-3 flex flex-wrap items-center gap-2">${statusBadge(b.status)}${sourceBadge(b)}${b.checkedInAt ? `<span class="inline-flex items-center gap-1 rounded-full bg-primary-50 px-2 py-0.5 text-[11px] font-semibold text-primary-700"><i class="ri-checkbox-circle-line"></i>Đã nhận sân ${formatDateTime(b.checkedInAt)}</span>` : ''}</div>
     ${row('Khách hàng', esc(b.customerName))}
     ${row('Số điện thoại', b.customerPhone ? `<a class="text-primary-700 font-semibold" href="tel:${esc(b.customerPhone)}">${esc(b.customerPhone)}</a>` : '—')}
     ${row('Sân', esc(b.courtName))}
     ${row('Ngày chơi', longDate(b.date))}
     ${row('Khung giờ', `${slotText(b)} (${b.slots.length} giờ)`)}
     ${extras ? row('Dịch vụ thêm', extras) : ''}
     ${b.promoCode ? row('Mã ưu đãi', `${esc(b.promoCode)} (-${money(b.discount)})`) : ''}
     ${row('Tổng tiền', `<b class="text-primary-700">${money(b.totalPrice)}</b>`)}
     ${b.depositAmount ? row('Tiền cọc đã nhận', `<span class="text-primary-700 font-semibold">${money(b.depositAmount)}</span>`) : ''}
     ${b.paymentStatus !== 'paid' && remaining > 0 ? row('Còn phải thu tại sân', `<b class="text-accent-700">${money(remaining)}</b>`) : ''}
     ${row('Thanh toán', esc(b.payment))}
     ${b.note ? row('Ghi chú', esc(b.note)) : ''}
     ${b.rejectReason ? row('Lý do từ chối', esc(b.rejectReason)) : ''}
     ${b.cancelReason ? row('Lý do khách hủy', esc(b.cancelReason)) : ''}
     ${row('Tạo lúc', formatDateTime(b.createdAt))}`,
    `<button type="button" data-close class="${BTN_OUT}">Đóng</button>${btns.join('')}`,
    'max-w-2xl',
  );
  on(m.el, 'click', '[data-act]', async (e, el) => {
    const act = el.dataset.act;
    m.close();
    if (act === 'approve') approveBooking(b);
    if (act === 'reject') rejectBooking(b);
    if (act === 'cancel') rejectBooking(b, true);
    if (act === 'checkin') checkIn(b);
    if (act === 'reschedule') openRescheduleModal(b);
    if (act === 'refund') openRefundModal(b);
    if (act === 'pay') {
      const payModal = modal(
        `Thu đủ tiền đơn ${esc(b.code)}`,
        `<div class="space-y-3">
          <p class="text-sm text-foreground-600">Khách: <b>${esc(b.customerName)}</b> · Số tiền cần thu: <b class="text-accent-700">${money(remaining)}</b></p>
          <div><label class="${LABEL}">Hình thức thanh toán</label>
            <select name="method" class="${INPUT}"><option value="cash">Tiền mặt</option><option value="transfer">Chuyển khoản</option><option value="vietqr">VietQR</option></select>
          </div>
        </div>`,
        `<button type="button" data-close class="${BTN_OUT}">Hủy</button><button type="button" data-save-pay class="${BTN}"><i class="ri-check-line"></i>Xác nhận đã thu</button>`
      );
      payModal.el.querySelector('[data-save-pay]').addEventListener('click', async (ev) => {
        const method = payModal.el.querySelector('select[name=method]').value;
        setBusy(ev.currentTarget, true, 'Đang lưu...');
        try {
          const u = await api('owner', 'mark_paid', { id: b.id, method });
          Object.assign(b, u);
          const i = S.bookings.findIndex((x) => x.id === b.id);
          if (i >= 0) S.bookings[i] = u;
          payModal.close();
          toast(`Đã ghi nhận thu đủ tiền cho đơn ${b.code}.`);
          rerender();
        } catch (err) { setBusy(ev.currentTarget, false); toast(err.message, 'error'); }
      });
    }
  });
}

export function openRescheduleModal(b) {
  const court = courtById(b.courtId);
  if (!court) return toast('Không tìm thấy thông tin sân.', 'error');
  const m = modal(
    `Đổi giờ đơn ${esc(b.code)}`,
    `<form id="reschedule-form" class="space-y-4">
      <div class="rounded-md border border-background-200 bg-background-50 p-3 text-xs leading-relaxed">
        <p class="font-semibold text-foreground-950">${esc(b.courtName)} · Khách: ${esc(b.customerName)} (${esc(b.customerPhone || '—')})</p>
        <p class="text-foreground-600 mt-1">Lịch hiện tại: <b class="text-accent-800">${longDate(b.date)} (${slotText(b)})</b></p>
      </div>
      <div>
        <label class="${LABEL}">Chọn ngày chơi mới</label>
        <input type="date" name="date" min="${TODAY}" value="${b.date >= TODAY ? b.date : TODAY}" class="${INPUT}">
      </div>
      <div>
        <label class="${LABEL}">Khung giờ mới <span class="font-normal text-foreground-500">(chọn 1 hoặc nhiều giờ)</span></label>
        <div data-slots class="grid grid-cols-4 gap-1.5 sm:grid-cols-6"></div>
      </div>
      <p data-total class="rounded-md bg-primary-50 px-3 py-2 text-sm font-semibold text-primary-800"></p>
    </form>`,
    `<button type="button" data-close class="${BTN_OUT}">Hủy</button><button type="button" data-ok class="${BTN}"><i class="ri-check-line"></i>Xác nhận đổi giờ</button>`,
    'max-w-xl',
  );
  const form = m.el.querySelector('#reschedule-form');
  let picked = new Set(b.slots || []);
  const priceAt = (c, s) => (c.priceBands || []).find((pb) => s >= pb.start && s < pb.end)?.price || c.pricePerHour;
  const drawSlots = () => {
    const newDate = form.date.value;
    const h = hoursForDate(court, newDate);
    const busy = new Set([
      ...S.bookings.filter((x) => x.id !== b.id && x.courtId === court.id && x.date === newDate && ['pending', 'confirmed'].includes(x.status)).flatMap((x) => x.slots),
      ...(S.blocked[`${court.id}:${newDate}`] || []),
    ]);
    const slots = [];
    if (!h.closed) for (let t = toMinutes(h.open); t + 60 <= toMinutes(h.close); t += 60) slots.push(minutesToTime(t));
    const now = new Date();
    const nowMin = now.getHours() * 60 + now.getMinutes();
    picked = new Set([...picked].filter((s) => slots.includes(s) && !busy.has(s)));
    m.el.querySelector('[data-slots]').innerHTML = slots.length
      ? slots.map((s) => {
          const dis = busy.has(s) || (newDate === TODAY && toMinutes(s) < nowMin - 30);
          return `<button type="button" data-s="${s}" ${dis ? 'disabled' : ''} class="rounded-md border px-2 py-2 text-xs font-semibold ${dis ? 'cursor-not-allowed border-background-200 bg-background-100 text-foreground-400 line-through' : picked.has(s) ? 'border-primary-500 bg-primary-500 text-white' : 'border-background-300 bg-white text-foreground-800 hover:border-primary-400'}">${s}</button>`;
        }).join('')
      : '<p class="col-span-full text-sm text-accent-700">Sân nghỉ vào ngày này.</p>';
    const total = [...picked].reduce((s, x) => s + priceAt(court, x), 0);
    m.el.querySelector('[data-total]').textContent = picked.size ? `Khung giờ mới: ${picked.size} giờ · ${money(total)}` : 'Vui lòng chọn khung giờ';
  };
  form.addEventListener('change', drawSlots);
  on(form, 'click', '[data-s]', (e, el) => {
    picked.has(el.dataset.s) ? picked.delete(el.dataset.s) : picked.add(el.dataset.s);
    drawSlots();
  });
  drawSlots();
  m.el.querySelector('[data-ok]').addEventListener('click', async (e) => {
    if (!picked.size) return toast('Vui lòng chọn ít nhất 1 khung giờ mới.', 'error');
    setBusy(e.currentTarget, true, 'Đang cập nhật...');
    try {
      const updated = await api('owner', 'booking_reschedule', { id: b.id, date: form.date.value, slots: [...picked] });
      const idx = S.bookings.findIndex((x) => x.id === b.id);
      if (idx >= 0) S.bookings[idx] = updated;
      m.close();
      toast(`Đã đổi giờ đơn ${b.code} sang ${longDate(updated.date)} (${slotText(updated)}).`);
      rerender();
    } catch (err) {
      setBusy(e.currentTarget, false);
      toast(err.message, 'error');
    }
  });
}

export function openRefundModal(b) {
  const dep = b.depositAmount || Math.round(b.totalPrice * 0.3);
  const m = modal(
    `Hoàn cọc đơn ${esc(b.code)}`,
    `<form id="refund-form" class="space-y-3">
      <div class="rounded-md border border-accent-200 bg-accent-50 p-3 text-xs leading-relaxed text-accent-950">
        <p class="font-bold">Khách hàng: ${esc(b.customerName)} (${esc(b.customerPhone || '—')})</p>
        <p class="mt-0.5">Sân: ${esc(b.courtName)} · Ngày: ${longDate(b.date)}</p>
        <p class="mt-0.5">Tiền cọc ban đầu: <b class="text-accent-800">${money(dep)}</b></p>
      </div>
      <div>
        <label class="${LABEL}">Số tiền hoàn lại cho khách (đ)</label>
        <input type="number" name="amount" min="1000" step="5000" value="${dep}" class="${INPUT}">
      </div>
      <div>
        <label class="${LABEL}">Phương thức hoàn tiền</label>
        <select name="method" class="${INPUT}">
          <option value="transfer">Chuyển khoản ngân hàng</option>
          <option value="cash">Tiền mặt tại sân</option>
          <option value="vietqr">VietQR / Ví điện tử</option>
        </select>
      </div>
      <div>
        <label class="${LABEL}">Ghi chú hoàn cọc</label>
        <input name="note" class="${INPUT}" placeholder="Số TK khách, ngân hàng, mã tham chiếu...">
      </div>
    </form>`,
    `<button type="button" data-close class="${BTN_OUT}">Hủy</button><button type="button" data-ok class="${BTN} !bg-accent-600 hover:!bg-accent-700"><i class="ri-check-line"></i>Xác nhận đã hoàn</button>`,
    'max-w-md',
  );
  m.el.querySelector('[data-ok]').addEventListener('click', async (e) => {
    const f = formData(m.el.querySelector('#refund-form'));
    const amount = Number(f.amount);
    if (!amount || amount <= 0) return toast('Số tiền hoàn phải lớn hơn 0.', 'error');
    setBusy(e.currentTarget, true, 'Đang lưu...');
    try {
      const updated = await api('owner', 'refund_add', { bookingId: b.id, amount, method: f.method, note: f.note });
      const idx = S.bookings.findIndex((x) => x.id === b.id);
      if (idx >= 0 && updated) S.bookings[idx] = updated;
      else b.paymentStatus = 'refunded';
      m.close();
      toast(`Đã ghi nhận hoàn ${money(amount)} cho đơn ${b.code}.`);
      rerender();
    } catch (err) {
      setBusy(e.currentTarget, false);
      toast(err.message, 'error');
    }
  });
}

/** Tạo đơn tại quầy cho khách gọi điện / đến trực tiếp */
export function openCounterBooking(preset = {}) {
  if (!S.courts.length) return toast('Bạn cần thêm sân trước khi tạo đơn.', 'error');
  const activeSv = (S.services || []).filter((s) => s.active);
  const extraQty = {};
  const m = modal(
    'Tạo đơn tại quầy',
    `<form id="counter-form" class="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <div class="sm:col-span-2"><label class="${LABEL}">Sân</label><select name="courtId" class="${INPUT}">${courtOptions(preset.courtId, '')}</select></div>
      <div><label class="${LABEL}">Ngày chơi</label><input type="date" name="date" min="${TODAY}" value="${preset.date || TODAY}" class="${INPUT}"></div>
      <div><label class="${LABEL}">Tên khách</label><input name="customerName" class="${INPUT}" placeholder="Anh Minh"></div>
      <div><label class="${LABEL}">Số điện thoại</label><input name="customerPhone" class="${INPUT}" placeholder="0905..."></div>
      <div><label class="${LABEL}">Thanh toán</label><select name="payment" class="${INPUT}"><option value="later">Thu tại sân sau</option><option value="deposit">Khách đã cọc</option><option value="paid">Đã thu đủ</option></select></div>
      <div data-dep class="hidden"><label class="${LABEL}">Số tiền cọc</label><input type="number" name="deposit" min="0" step="10000" class="${INPUT}"></div>
      <div data-meth class="hidden"><label class="${LABEL}">Hình thức</label><select name="method" class="${INPUT}"><option value="cash">Tiền mặt</option><option value="transfer">Chuyển khoản</option><option value="vietqr">VietQR</option></select></div>
      <div class="sm:col-span-2"><label class="${LABEL}">Khung giờ <span class="font-normal text-foreground-500">(chọn 1 hoặc nhiều giờ)</span></label><div data-slots class="grid grid-cols-4 gap-1.5 sm:grid-cols-6"></div></div>
      ${activeSv.length ? `
      <div class="sm:col-span-2 rounded-md border border-background-200 bg-background-50/50 p-3">
        <label class="${LABEL} !mb-2"><i class="ri-store-2-line text-primary-600"></i> Dịch vụ bán kèm (tùy chọn)</label>
        <div class="grid grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-3">
          ${activeSv.map((s) => `
            <div class="flex items-center justify-between gap-1.5 rounded-md border border-background-200 bg-white px-2.5 py-1.5 text-xs">
              <div class="min-w-0"><p class="truncate font-semibold text-foreground-900">${esc(s.name)}</p><p class="text-[11px] text-foreground-500">${money(s.price)}/${esc(s.unit)}</p></div>
              <div class="flex items-center gap-1 shrink-0">
                <button type="button" data-sq="${s.id}" data-d="-1" class="flex h-6 w-6 items-center justify-center rounded border border-background-300 bg-background-100 font-bold hover:bg-background-200">−</button>
                <span data-sq-val="${s.id}" class="w-5 text-center font-bold">0</span>
                <button type="button" data-sq="${s.id}" data-d="1" class="flex h-6 w-6 items-center justify-center rounded border border-background-300 bg-background-100 font-bold hover:bg-background-200">+</button>
              </div>
            </div>`).join('')}
        </div>
      </div>` : ''}
      <div class="sm:col-span-2"><label class="${LABEL}">Ghi chú</label><input name="note" class="${INPUT}" placeholder="Ví dụ: khách quen, mang bóng riêng"></div>
      <p data-total class="sm:col-span-2 rounded-md bg-primary-50 px-3 py-2 text-sm font-semibold text-primary-800"></p>
    </form>`,
    `<button type="button" data-close class="${BTN_OUT}">Hủy</button><button type="button" data-ok class="${BTN}"><i class="ri-add-line"></i>Tạo đơn</button>`,
    'max-w-2xl',
  );
  const form = m.el.querySelector('#counter-form');
  let picked = new Set(preset.slots || []);
  const priceAt = (c, s) => (c.priceBands || []).find((b) => s >= b.start && s < b.end)?.price || c.pricePerHour;
  const drawSlots = () => {
    const f = formData(form);
    const c = courtById(f.courtId) || S.courts[0];
    if (!c) return;
    const h = hoursForDate(c, f.date);
    const busy = new Set([
      ...S.bookings.filter((b) => b.courtId === c.id && b.date === f.date && ['pending', 'confirmed', 'completed'].includes(b.status)).flatMap((b) => b.slots),
      ...(S.blocked[`${c.id}:${f.date}`] || []),
    ]);
    const slots = [];
    if (!h.closed) for (let t = toMinutes(h.open); t + 60 <= toMinutes(h.close); t += 60) slots.push(minutesToTime(t));
    const now = new Date();
    const nowMin = now.getHours() * 60 + now.getMinutes();
    picked = new Set([...picked].filter((s) => slots.includes(s) && !busy.has(s)));
    m.el.querySelector('[data-slots]').innerHTML = slots.length
      ? slots.map((s) => {
          const dis = busy.has(s) || (f.date === TODAY && toMinutes(s) < nowMin - 30);
          return `<button type="button" data-s="${s}" ${dis ? 'disabled' : ''} class="rounded-md border px-2 py-2 text-xs font-semibold ${dis ? 'cursor-not-allowed border-background-200 bg-background-100 text-foreground-400 line-through' : picked.has(s) ? 'border-primary-500 bg-primary-500 text-white' : 'border-background-300 bg-white text-foreground-800 hover:border-primary-400'}">${s}</button>`;
        }).join('')
      : '<p class="col-span-full text-sm text-accent-700">Sân nghỉ vào ngày này.</p>';
    const courtTotal = [...picked].reduce((s, x) => s + priceAt(c, x), 0);
    const extraTotal = Object.entries(extraQty).reduce((sum, [id, qty]) => {
      const sv = activeSv.find((s) => s.id === id);
      return sum + (sv ? sv.price * qty : 0);
    }, 0);
    const grandTotal = courtTotal + extraTotal;
    m.el.querySelector('[data-total]').textContent = picked.size
      ? `Tạm tính: ${picked.size} giờ sân (${money(courtTotal)})${extraTotal ? ` + dịch vụ (${money(extraTotal)}) = ${money(grandTotal)}` : ` · ${money(grandTotal)}`}`
      : (extraTotal ? `Dịch vụ: ${money(extraTotal)} (chưa chọn giờ sân)` : 'Chưa chọn khung giờ');
    m.el.querySelector('[data-dep]').classList.toggle('hidden', f.payment !== 'deposit');
    m.el.querySelector('[data-meth]').classList.toggle('hidden', f.payment === 'later');
  };
  form.addEventListener('change', drawSlots);
  on(form, 'click', '[data-s]', (e, el) => {
    picked.has(el.dataset.s) ? picked.delete(el.dataset.s) : picked.add(el.dataset.s);
    drawSlots();
  });
  on(form, 'click', '[data-sq]', (e, el) => {
    const id = el.dataset.sq;
    const delta = Number(el.dataset.d);
    extraQty[id] = Math.max(0, (extraQty[id] || 0) + delta);
    const display = form.querySelector(`[data-sq-val="${id}"]`);
    if (display) display.textContent = extraQty[id];
    drawSlots();
  });
  drawSlots();
  m.el.querySelector('[data-ok]').addEventListener('click', async (e) => {
    const f = formData(form);
    const extras = Object.entries(extraQty)
      .filter(([_, qty]) => qty > 0)
      .map(([id, qty]) => {
        const sv = activeSv.find((s) => s.id === id);
        return { id, label: sv.name, price: sv.price, qty };
      });
    setBusy(e.currentTarget, true, 'Đang tạo...');
    try {
      const b = await api('owner', 'counter_create', { ...f, slots: [...picked], extras });
      S.bookings.unshift(b);
      m.close();
      toast(`Đã tạo đơn ${b.code} cho ${b.customerName}.`);
      rerender();
    } catch (err) {
      setBusy(e.currentTarget, false);
      toast(err.message, 'error');
    }
  });
}

// Dòng đơn rút gọn dùng trong tổng quan
const miniRow = (b, right = '') => `<div class="flex items-center justify-between gap-3 px-4 py-3">
  <button type="button" data-detail="${esc(b.id)}" class="min-w-0 cursor-pointer text-left">
    <p class="truncate text-sm font-semibold text-foreground-950">${esc(b.customerName)} <span class="font-mono text-[11px] font-medium text-foreground-500">${esc(b.code)}</span></p>
    <p class="truncate text-xs text-foreground-500">${esc(b.courtName)} · ${dateText(b.date)} · ${slotText(b)}</p>
  </button>
  <div class="flex shrink-0 items-center gap-1.5">${right}</div></div>`;

let bookingActionsBound = false;
function bindBookingActions(root = main()) {
  if (bookingActionsBound) return;
  const target = document.getElementById('owner-main') || document.body;
  if (!target) return;
  bookingActionsBound = true;
  const find = (id) => S.bookings.find((b) => b.id === id);
  on(target, 'click', '[data-detail]', (e, el) => {
    const b = find(el.dataset.detail);
    if (b) openBookingDetail(b);
  });
  on(target, 'click', '[data-approve]', (e, el) => {
    const b = find(el.dataset.approve);
    if (b) approveBooking(b);
  });
  on(target, 'click', '[data-reject]', (e, el) => {
    const b = find(el.dataset.reject);
    if (b) rejectBooking(b);
  });
  on(target, 'click', '[data-cancel]', (e, el) => {
    const b = find(el.dataset.cancel);
    if (b) rejectBooking(b, true);
  });
  on(target, 'click', '[data-checkin]', (e, el) => {
    const b = find(el.dataset.checkin);
    if (b) checkIn(b);
  });
}

// =====================================================================
// TỔNG QUAN
// =====================================================================

function weekRange() {
  const d = new Date(`${TODAY}T00:00:00`);
  const dow = d.getDay() === 0 ? 7 : d.getDay();
  const start = addDays(TODAY, 1 - dow);
  return [start, addDays(start, 6)];
}

function openHoursInRange(court, from, to) {
  let total = 0;
  for (let d = from; d <= to; d = addDays(d, 1)) {
    const h = hoursForDate(court, d);
    if (!h.closed) total += Math.max(0, (toMinutes(h.close) - toMinutes(h.open)) / 60);
  }
  return total;
}

export function openQrScanner() {
  let stream = null;
  let interval = null;
  const m = modal(
    'Quét mã QR vé nhận sân',
    `<div class="space-y-3">
      <div class="relative overflow-hidden rounded-lg bg-black aspect-video flex items-center justify-center">
        <video id="qr-scan-video" playsinline class="h-full w-full object-cover"></video>
        <div class="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div class="h-44 w-44 rounded-xl border-2 border-primary-400 border-dashed animate-pulse"></div>
        </div>
      </div>
      <p id="qr-scan-msg" class="text-center text-xs text-foreground-600">Đang kết nối camera...</p>
      <div class="flex items-center justify-center gap-2 pt-2 border-t border-background-200">
        <label class="${BTN_SM} cursor-pointer"><i class="ri-image-add-line"></i> Chọn ảnh vé từ máy<input type="file" id="qr-scan-file" accept="image/*" class="hidden"></label>
      </div>
    </div>`,
    `<button type="button" data-close class="${BTN_OUT}">Đóng</button>`,
    'max-w-md',
  );

  const video = m.el.querySelector('#qr-scan-video');
  const msg = m.el.querySelector('#qr-scan-msg');
  const fileInput = m.el.querySelector('#qr-scan-file');

  const stopCamera = () => {
    if (interval) { clearInterval(interval); interval = null; }
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      stream = null;
    }
  };

  m.el.querySelectorAll('[data-close]').forEach((btn) => btn.addEventListener('click', stopCamera));

  const handleFoundCode = async (rawCode) => {
    const code = parseTicketPayload(rawCode).code;
    if (!code) return;
    stopCamera();
    m.close();
    await checkIn(null, code);
  };

  if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
      .then((s) => {
        stream = s;
        video.srcObject = s;
        video.play();
        msg.textContent = 'Hướng camera vào mã QR vé của khách...';

        if ('BarcodeDetector' in window) {
          const detector = new window.BarcodeDetector({ formats: ['qr_code'] });
          interval = setInterval(async () => {
            try {
              if (video.readyState >= 2) {
                const barcodes = await detector.detect(video);
                if (barcodes.length) {
                  await handleFoundCode(barcodes[0].rawValue);
                }
              }
            } catch (_) {}
          }, 300);
        } else {
          msg.textContent = 'Camera đã bật. Bạn có thể hướng vào mã QR hoặc tải ảnh vé bên dưới.';
        }
      })
      .catch((err) => {
        msg.textContent = 'Chưa thể bật camera: ' + (err.message || 'chưa cấp quyền') + '. Bạn có thể tải ảnh vé bên dưới.';
      });
  } else {
    msg.textContent = 'Thiết bị không hỗ trợ camera. Vui lòng tải ảnh vé bên dưới hoặc nhập mã.';
  }

  fileInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if ('BarcodeDetector' in window) {
      try {
        const bmp = await createImageBitmap(file);
        const detector = new window.BarcodeDetector({ formats: ['qr_code'] });
        const barcodes = await detector.detect(bmp);
        if (barcodes.length) {
          await handleFoundCode(barcodes[0].rawValue);
          return;
        }
        toast('Không tìm thấy mã QR trong ảnh. Vui lòng thử lại.', 'error');
      } catch (err) {
        toast('Không đọc được ảnh: ' + err.message, 'error');
      }
    } else {
      toast('Trình duyệt chưa hỗ trợ giải mã ảnh QR. Vui lòng nhập mã vé bằng tay.', 'info');
    }
  });
}

export function renderOverview() {
  actions().innerHTML = `
    <button type="button" id="ov-block" class="${BTN_OUT}"><i class="ri-tools-line text-accent-600"></i>Khóa bảo trì</button>
    <button type="button" id="ov-add" class="${BTN}"><i class="ri-add-line"></i>Tạo đơn tại quầy</button>
  `;
  actions().querySelector('#ov-add').onclick = () => openCounterBooking();
  actions().querySelector('#ov-block').onclick = () => openQuickBlockModal();

  const live = S.bookings.filter(isActive);
  const today = live.filter((b) => b.date === TODAY);
  const pending = S.bookings.filter((b) => b.status === 'pending' && !b.approvedAt);
  const month = TODAY.slice(0, 7);
  const revMonth = live.filter((b) => b.date.startsWith(month) && b.status !== 'pending').reduce((s, b) => s + b.totalPrice, 0);
  const revToday = today.filter((b) => b.status !== 'pending').reduce((s, b) => s + b.totalPrice, 0);
  const upcoming = live.filter((b) => b.status === 'confirmed' && b.date >= TODAY).sort((a, b) => (a.date + a.startSlot).localeCompare(b.date + b.startSlot)).slice(0, 6);
  const [ws, we] = weekRange();
  const fill = S.courts.map((c) => {
    const booked = live.filter((b) => b.courtId === c.id && b.date >= ws && b.date <= we).reduce((s, b) => s + b.slots.length, 0);
    const open = openHoursInRange(c, ws, we);
    return { c, booked, pct: open ? Math.min(100, Math.round((booked / open) * 100)) : 0 };
  });
  const top = S.courts.map((c) => ({ c, n: live.filter((b) => b.courtId === c.id).length })).sort((a, b) => b.n - a.n).slice(0, 4);
  const recent = [...S.bookings].sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || '')).slice(0, 6);
  const activeCourts = S.courts.filter((c) => c.status === 'active').length;
  const notCheckedIn = today.filter((b) => b.status === 'confirmed' && !b.checkedInAt).length;

  const nowHour = `${String(new Date().getHours()).padStart(2, '0')}:00`;
  const blockedUpcoming = (S.blockedList || []).filter((b) => b.date >= TODAY);

  const liveCourts = S.courts.map((c) => {
    const h = hoursForDate(c, TODAY);
    const b = today.find((x) => x.courtId === c.id && (x.slots || []).includes(nowHour));
    const isBlk = (S.blocked[`${c.id}:${TODAY}`] || []).includes(nowHour);
    const isClosed = h.closed || nowHour < h.open || nowHour >= h.close;
    return { c, h, booking: b, isBlocked: isBlk, isClosed };
  });

  main().innerHTML = `
  <!-- Thanh tác vụ nhanh (Quick Actions) -->
  <div class="mb-5 flex flex-wrap items-center gap-2 rounded-lg border border-background-200 bg-white p-3 shadow-xs">
    <span class="text-xs font-bold uppercase tracking-wider text-foreground-500 mr-1"><i class="ri-flashlight-line text-accent-500"></i> Thao tác nhanh:</span>
    <button type="button" id="qa-counter" class="${BTN_SM_PRI}"><i class="ri-add-line"></i>Tạo đơn tại quầy</button>
    <button type="button" id="qa-block" class="${BTN_SM}"><i class="ri-tools-line text-accent-600"></i>Khóa sân bảo trì</button>
    <a href="?tab=bookings&sub=calendar" class="${BTN_SM}"><i class="ri-calendar-schedule-line text-primary-600"></i>Lịch sân trực quan</a>
    <a href="?tab=courts&sub=schedule" class="${BTN_SM}"><i class="ri-time-line text-secondary-600"></i>Bảng giá & Khung giờ</a>
    <a href="?tab=courts&sub=blocked" class="${BTN_SM}"><i class="ri-lock-2-line text-foreground-600"></i>Khung giờ bị khóa (${blockedUpcoming.length})</a>
  </div>

  ${blockedUpcoming.length ? `
    <div class="mb-5 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs text-amber-900">
      <div class="flex items-center gap-2">
        <i class="ri-alert-line text-base text-amber-700"></i>
        <span>Đang có <b>${blockedUpcoming.length} khung giờ</b> bị khóa bảo trì từ hôm nay trở đi.</span>
      </div>
      <a href="?tab=courts&sub=blocked" class="font-bold underline hover:text-amber-950">Xem & quản lý mở khóa →</a>
    </div>
  ` : ''}

  <!-- Tình trạng sân trực tiếp lúc này (Realtime) -->
  <section class="${CARD} mb-5 p-4">
    <div class="flex flex-wrap items-center justify-between gap-2 border-b border-background-200 pb-3 mb-3">
      <div>
        <h3 class="font-heading text-sm font-bold text-foreground-950 flex items-center gap-2">
          <span class="relative flex h-2.5 w-2.5">
            <span class="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
            <span class="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500"></span>
          </span>
          Trạng thái sân trực tiếp lúc này (${nowHour})
        </h3>
        <p class="text-xs text-foreground-500 mt-0.5">Theo dõi trực quan sân nào đang có khách, sân nào đang trống hoặc bảo trì</p>
      </div>
      <div class="flex items-center gap-2 text-xs">
        <span class="inline-flex items-center gap-1"><span class="h-2 w-2 rounded-full bg-emerald-500"></span> Có khách (${liveCourts.filter((x) => x.booking).length})</span>
        <span class="inline-flex items-center gap-1"><span class="h-2 w-2 rounded-full bg-blue-500"></span> Trống (${liveCourts.filter((x) => !x.booking && !x.isBlocked && !x.isClosed).length})</span>
        <span class="inline-flex items-center gap-1"><span class="h-2 w-2 rounded-full bg-rose-500"></span> Khóa (${liveCourts.filter((x) => x.isBlocked).length})</span>
      </div>
    </div>
    <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      ${liveCourts.map(({ c, h, booking, isBlocked, isClosed }) => {
        if (booking) {
          return `
            <div class="rounded-lg border border-emerald-200 bg-emerald-50/50 p-3">
              <div class="flex items-center justify-between">
                <span class="font-bold text-sm text-foreground-950 truncate">${esc(c.name)}</span>
                <span class="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">Có khách</span>
              </div>
              <p class="mt-2 text-xs font-semibold text-emerald-900 truncate">${esc(booking.customerName)} (${esc(booking.customerPhone || '—')})</p>
              <p class="text-[11px] text-emerald-700">Đơn ${esc(booking.code)} · ${booking.startSlot} - ${booking.endSlot}</p>
              <div class="mt-3 flex gap-1">
                <button type="button" data-detail="${booking.id}" class="${BTN_SM} !py-1 !text-xs w-full">Xem chi tiết đơn</button>
              </div>
            </div>
          `;
        }
        if (isBlocked) {
          return `
            <div class="rounded-lg border border-rose-200 bg-rose-50/50 p-3">
              <div class="flex items-center justify-between">
                <span class="font-bold text-sm text-foreground-950 truncate">${esc(c.name)}</span>
                <span class="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-bold text-rose-800"><i class="ri-lock-line"></i> Đang khóa</span>
              </div>
              <p class="mt-2 text-xs text-rose-800">Khung giờ ${nowHour} đang khóa bảo trì</p>
              <p class="text-[11px] text-foreground-500">Khách không thể đặt trực tuyến</p>
              <div class="mt-3 flex gap-1">
                <button type="button" data-quick-unblock="${c.id}:${TODAY}:${nowHour}" class="${BTN_SM} !py-1 !text-xs w-full text-rose-700 hover:bg-rose-100"><i class="ri-lock-unlock-line"></i> Mở khóa ngay</button>
              </div>
            </div>
          `;
        }
        if (isClosed) {
          return `
            <div class="rounded-lg border border-background-200 bg-background-100/50 p-3">
              <div class="flex items-center justify-between">
                <span class="font-bold text-sm text-foreground-950 truncate">${esc(c.name)}</span>
                <span class="rounded-full bg-background-200 px-2 py-0.5 text-[10px] font-bold text-foreground-600">Đóng cửa</span>
              </div>
              <p class="mt-2 text-xs text-foreground-600">${h.closed ? 'Nghỉ cả ngày' : `Mở cửa: ${h.open} - ${h.close}`}</p>
              <p class="text-[11px] text-foreground-500">Ngoài giờ hoạt động</p>
              <div class="mt-3 flex gap-1">
                <a href="?tab=courts&sub=schedule" class="${BTN_SM} !py-1 !text-xs w-full text-center">Chỉnh giờ</a>
              </div>
            </div>
          `;
        }
        return `
          <div class="rounded-lg border border-blue-200 bg-blue-50/40 p-3">
            <div class="flex items-center justify-between">
              <span class="font-bold text-sm text-foreground-950 truncate">${esc(c.name)}</span>
              <span class="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-800">Đang trống</span>
            </div>
            <p class="mt-2 text-xs text-blue-900 font-medium">Khung ${nowHour} sẵn sàng nhận khách</p>
            <p class="text-[11px] text-blue-700 font-semibold">${money(c.pricePerHour)}/giờ</p>
            <div class="mt-3 flex gap-1">
              <button type="button" data-quick-book="${c.id}:${TODAY}:${nowHour}" class="${BTN_SM_PRI} !py-1 !text-xs w-full"><i class="ri-add-line"></i> Đặt tại quầy ngay</button>
            </div>
          </div>
        `;
      }).join('')}
    </div>
  </section>

  <div class="grid grid-cols-2 gap-3 lg:grid-cols-4">
    ${statCard('ri-calendar-event-line', 'Đơn hôm nay', today.length, notCheckedIn ? `${notCheckedIn} đơn chưa nhận sân` : 'Tất cả đã nhận sân')}
    ${statCard('ri-time-line', 'Chờ bạn duyệt', pending.length, pending.length ? 'Duyệt sớm để giữ chân khách' : 'Không có đơn tồn', 'accent')}
    ${statCard('ri-money-dollar-circle-line', 'Doanh thu hôm nay', money(revToday), `Tháng này: ${money(revMonth)}`, 'secondary')}
    ${statCard('ri-football-line', 'Sân đang mở', `${activeCourts}/${S.courts.length}`, 'Sân hiển thị trên trang tìm sân', 'neutral')}
  </div>
  <div class="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-[1.4fr_1fr]">
    <div class="space-y-5">
      <section class="${CARD}">${sectionTitle(`Đơn chờ bạn duyệt <span class="ml-1 rounded-full bg-accent-50 px-2 py-0.5 text-[11px] text-accent-800">${pending.length}</span>`, `<a href="?tab=bookings" class="text-xs font-semibold text-primary-700">Xem tất cả</a>`)}
        <div class="divide-y divide-background-200">${pending.length ? pending.slice(0, 5).map((b) => miniRow(b, `<button type="button" data-reject="${b.id}" class="${BTN_SM}">Từ chối</button><button type="button" data-approve="${b.id}" class="${BTN_SM_PRI}">Duyệt</button>`)).join('') : '<p class="px-4 py-6 text-center text-sm text-foreground-500">Không có đơn nào chờ duyệt.</p>'}</div></section>
      <section class="${CARD}">${sectionTitle('Lịch sắp tới')}
        <div class="divide-y divide-background-200">${upcoming.length ? upcoming.map((b) => miniRow(b, `<span class="text-xs font-semibold text-primary-700">${money(b.totalPrice)}</span>${b.date === TODAY && !b.checkedInAt ? `<button type="button" data-checkin="${b.id}" class="${BTN_SM}"><i class="ri-qr-scan-2-line"></i>Check-in</button>` : ''}`)).join('') : '<p class="px-4 py-6 text-center text-sm text-foreground-500">Chưa có lịch sắp tới.</p>'}</div></section>
      <section class="${CARD}">${sectionTitle('Hoạt động gần đây')}
        <div class="divide-y divide-background-200">${recent.map((b) => miniRow(b, statusBadge(b.status))).join('') || '<p class="px-4 py-6 text-center text-sm text-foreground-500">Chưa có hoạt động.</p>'}</div></section>
    </div>
    <div class="space-y-5">
      <section class="${CARD}">${sectionTitle('Sân bạn đang quản lý', `<a href="?tab=courts" class="text-xs font-semibold text-primary-700">Quản lý</a>`)}
        <div class="divide-y divide-background-200">${S.courts.map((c) => `<div class="flex items-center gap-3 px-4 py-3"><img src="${esc(c.image)}" alt="" class="h-10 w-14 shrink-0 rounded object-cover bg-background-200" loading="lazy"><div class="min-w-0 flex-1"><p class="truncate text-sm font-semibold text-foreground-950">${esc(c.name)}</p><p class="text-xs text-foreground-500">${esc(c.sportLabel)} · ${c.openTime} - ${c.closeTime}</p></div>${statusBadge(c.status)}</div>`).join('') || '<p class="px-4 py-6 text-center text-sm text-foreground-500">Chưa có sân.</p>'}</div></section>
      <section class="${CARD}">${sectionTitle('Tỷ lệ lấp đầy tuần này', `<span class="text-[11px] text-foreground-500">${dateText(ws)} – ${dateText(we)}</span>`)}
        <div class="space-y-3 p-4">${fill.map((f) => `<div><div class="flex justify-between text-xs"><span class="truncate font-medium text-foreground-800">${esc(f.c.name)}</span><span class="font-semibold text-foreground-950">${f.pct}% <span class="font-normal text-foreground-500">(${f.booked} giờ)</span></span></div><div class="mt-1.5 h-2 rounded-full bg-background-200"><div class="h-2 rounded-full bg-primary-500" style="width:${f.pct}%"></div></div></div>`).join('') || '<p class="text-sm text-foreground-500">Chưa có dữ liệu.</p>'}</div></section>
      <section class="${CARD}">${sectionTitle('Sân được đặt nhiều')}
        <ol class="space-y-2 p-4">${top.map((t, i) => `<li class="flex items-center gap-3 text-sm"><span class="flex h-6 w-6 items-center justify-center rounded-full ${i === 0 ? 'bg-accent-500 text-white' : 'bg-background-200 text-foreground-700'} text-xs font-bold">${i + 1}</span><span class="flex-1 truncate">${esc(t.c.name)}</span><span class="font-semibold">${t.n} đơn</span></li>`).join('')}</ol></section>
      <section class="rounded-lg border border-secondary-200 bg-secondary-50 p-4">
        <p class="flex items-center gap-1.5 text-sm font-bold text-secondary-900"><i class="ri-lightbulb-flash-line text-accent-600"></i>Mẹo tăng lượt đặt sân</p>
        <ul class="mt-2 space-y-1.5 text-xs leading-relaxed text-secondary-800">
          <li>• Duyệt đơn trong 15 phút giúp khách yên tâm và quay lại.</li>
          <li>• Tạo mã giảm giá cho khung giờ vắng (sáng, đầu giờ chiều).</li>
          <li>• Cập nhật ảnh sân rõ nét và phản hồi đánh giá của khách.</li>
        </ul></section>
    </div>
  </div>`;
  const root = main();
  bindBookingActions(root);

  const qaCounter = root.querySelector('#qa-counter');
  const qaBlock = root.querySelector('#qa-block');
  if (qaCounter) qaCounter.onclick = () => openCounterBooking();
  if (qaBlock) qaBlock.onclick = () => openQuickBlockModal();

  on(root, 'click', '[data-quick-book]', (e, el) => {
    const [courtId, date, slot] = el.dataset.quickBook.split(':');
    openCounterBooking({ courtId, date, slots: [slot] });
  });

  on(root, 'click', '[data-quick-unblock]', async (e, el) => {
    const [courtId, date, slot] = el.dataset.quickUnblock.split(':');
    try {
      const res = await api('owner', 'block_slots', { courtId, date, slots: [slot], blocked: false });
      if (res.blocked) S.blocked = res.blocked;
      if (res.list) S.blockedList = res.list;
      if (res.courtBlocked) S.blocked[`${courtId}:${date}`] = res.courtBlocked;
      toast('Đã mở khóa khung giờ thành công.');
      rerender();
    } catch (err) { toast(err.message, 'error'); }
  });
}

// =====================================================================
// ĐƠN ĐẶT SÂN
// =====================================================================

const bf = { status: 'all', court: '', q: '', date: '', todayOnly: false };

export function renderBookings() {
  const conflicts = collectConflictIds(S.bookings, S.blocked);
  const counts = { all: S.bookings.length };
  ['pending', 'confirmed', 'completed', 'cancelled'].forEach((s) => (counts[s] = S.bookings.filter((b) => b.status === s).length));
  const q = bf.q.toLowerCase();
  const list = S.bookings
    .filter((b) => bf.status === 'all' || b.status === bf.status)
    .filter((b) => !bf.court || b.courtId === bf.court)
    .filter((b) => !bf.date || b.date === bf.date)
    .filter((b) => !bf.todayOnly || b.date === TODAY)
    .filter((b) => !q || `${b.code} ${b.customerName} ${b.customerPhone}`.toLowerCase().includes(q));
  const waiting = S.bookings.filter((b) => b.date === TODAY && b.status === 'confirmed' && !b.checkedInAt);
  const tabs = [['all', 'Tất cả'], ['pending', 'Chờ duyệt'], ['confirmed', 'Đã xác nhận'], ['completed', 'Hoàn thành'], ['cancelled', 'Đã hủy']];

  actions().innerHTML = `
    <button type="button" id="bk-csv" class="${BTN_OUT}"><i class="ri-file-excel-2-line"></i>Xuất Excel (CSV)</button>
    <button type="button" id="bk-add" class="${BTN}"><i class="ri-add-line"></i>Tạo đơn tại quầy</button>
  `;
  actions().querySelector('#bk-csv').onclick = () => {
    downloadCsv([
      ['Mã đơn', 'Nguồn', 'Sân', 'Khách hàng', 'Số điện thoại', 'Ngày chơi', 'Khung giờ', 'Số tiền (VND)', 'Đã cọc (VND)', 'Thanh toán', 'Trạng thái', 'Check-in', 'Ghi chú'],
      ...list.map((b) => [
        b.code, b.source === 'online' ? 'Online' : 'Tại quầy', b.courtName, b.customerName, b.customerPhone,
        b.date, slotText(b), b.totalPrice, b.depositAmount, b.payment,
        b.status === 'confirmed' ? 'Đã xác nhận' : b.status === 'pending' ? 'Chờ duyệt' : b.status === 'completed' ? 'Hoàn thành' : 'Đã hủy',
        b.checkedInAt ? formatDateTime(b.checkedInAt) : 'Chưa nhận sân', b.note || b.rejectReason || b.cancelReason || '',
      ]),
    ], `danh-sach-don-dat-san-${TODAY}.csv`);
  };
  actions().querySelector('#bk-add').onclick = () => openCounterBooking();

  main().innerHTML = `
  <section class="${CARD} mb-5 p-4">
    <div class="flex flex-col gap-3 md:flex-row md:items-end">
      <div class="flex-1"><label class="${LABEL}"><i class="ri-qr-scan-2-line text-primary-600"></i> Check-in nhanh bằng mã vé</label>
        <form id="quick-checkin" class="flex flex-wrap gap-2 sm:flex-nowrap">
          <input name="code" class="${INPUT} font-mono uppercase placeholder:font-sans placeholder:normal-case" placeholder="Nhập mã vé hoặc dán nội dung QR (VD: BMT20261109-1234)">
          <button type="submit" class="${BTN} whitespace-nowrap">Nhận sân</button>
          <button type="button" id="btn-camera-scan" class="${BTN_OUT} whitespace-nowrap" title="Quét mã QR bằng camera"><i class="ri-camera-lens-line text-base"></i><span class="hidden sm:inline">Quét camera</span></button>
        </form>
      </div>
      <p class="text-xs text-foreground-500 md:w-56">Đơn hôm nay chưa nhận sân: <b class="text-foreground-900">${waiting.length}</b></p>
    </div>
    ${waiting.length ? `<div class="mt-3 flex flex-wrap gap-2">${waiting.map((b) => `<button type="button" data-checkin="${b.id}" class="${BTN_SM}"><i class="ri-login-circle-line"></i>${b.startSlot} · ${esc(b.customerName)} · ${esc(b.courtName)}</button>`).join('')}</div>` : ''}
  </section>
  <div class="mb-3 flex flex-wrap gap-2">${tabs.map(([k, l]) => `<button type="button" data-st="${k}" class="${chip(bf.status === k)}">${l}<span class="opacity-75">${counts[k]}</span></button>`).join('')}</div>
  <div class="mb-4 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-[1fr_200px_170px_auto]">
    <input id="bk-q" value="${esc(bf.q)}" class="${INPUT}" placeholder="Tìm theo mã đơn, tên khách, số điện thoại...">
    <select id="bk-court" class="${INPUT}">${courtOptions(bf.court)}</select>
    <input id="bk-date" type="date" value="${bf.date}" class="${INPUT}">
    <label class="flex cursor-pointer items-center gap-2 rounded-md border border-background-300 bg-white px-3 py-2.5 text-sm font-medium"><input id="bk-today" type="checkbox" ${bf.todayOnly ? 'checked' : ''} class="accent-primary-500">Chỉ hôm nay</label>
  </div>
  <div class="${CARD} overflow-hidden">
    ${list.length ? `<div class="overflow-x-auto"><table class="w-full min-w-[860px] text-sm">
      <thead class="bg-background-100 text-left text-xs font-semibold uppercase tracking-wide text-foreground-500"><tr><th class="px-4 py-3">Đơn</th><th class="px-4 py-3">Khách hàng</th><th class="px-4 py-3">Sân & giờ</th><th class="px-4 py-3 text-right">Tiền</th><th class="px-4 py-3">Trạng thái</th><th class="px-4 py-3 text-right">Thao tác</th></tr></thead>
      <tbody class="divide-y divide-background-200">${list.map((b) => `<tr class="hover:bg-background-50">
        <td class="px-4 py-3"><button type="button" data-detail="${b.id}" class="font-mono text-xs font-bold text-primary-700 hover:underline">${esc(b.code)}</button><div class="mt-1">${sourceBadge(b)}</div></td>
        <td class="px-4 py-3"><p class="font-semibold text-foreground-950">${esc(b.customerName)}</p><p class="text-xs text-foreground-500">${esc(b.customerPhone || '—')}</p></td>
        <td class="px-4 py-3"><p class="font-medium text-foreground-900">${esc(b.courtName)}</p><p class="text-xs text-foreground-500">${dateText(b.date)} · ${slotText(b)}</p>${conflicts.has(b.id) ? '<p class="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold text-accent-700"><i class="ri-error-warning-line"></i>Trùng lịch</p>' : ''}</td>
        <td class="px-4 py-3 text-right"><p class="font-semibold text-foreground-950">${money(b.totalPrice)}</p><p class="text-[11px] text-foreground-500">${esc(b.payment)}</p></td>
        <td class="px-4 py-3">${
          b.status === 'pending' && b.approvedAt && b.paymentStatus === 'unpaid'
            ? `<span class="inline-flex items-center gap-1.5 rounded-full border border-primary-200 bg-primary-50 px-2.5 py-1 text-xs font-semibold text-primary-700"><span class="h-1.5 w-1.5 rounded-full bg-primary-500 animate-pulse"></span>Đã duyệt (Chờ cọc 5p)</span>`
            : statusBadge(b.status)
        }${b.checkedInAt ? '<p class="mt-1 text-[11px] font-semibold text-primary-700"><i class="ri-checkbox-circle-line"></i> Đã nhận sân</p>' : b.status === 'confirmed' && b.date <= TODAY ? '<p class="mt-1 text-[11px] text-foreground-500">Chưa check-in</p>' : ''}</td>
        <td class="px-4 py-3"><div class="flex justify-end gap-1.5">${
          b.status === 'pending'
            ? !b.approvedAt
              ? `<button type="button" data-reject="${b.id}" class="${BTN_SM}">Từ chối</button><button type="button" data-approve="${b.id}" class="${BTN_SM_PRI}">Duyệt</button>`
              : `<button type="button" data-cancel="${b.id}" class="${BTN_SM}">Hủy</button><button type="button" data-detail="${b.id}" class="${BTN_SM}">Chờ cọc</button>`
            : b.status === 'confirmed'
              ? `${!b.checkedInAt ? `<button type="button" data-checkin="${b.id}" class="${BTN_SM_PRI}">Check-in</button>` : ''}<button type="button" data-cancel="${b.id}" class="${BTN_SM}">Hủy</button>`
              : `<button type="button" data-detail="${b.id}" class="${BTN_SM}">Chi tiết</button>`
        }</div></td></tr>`).join('')}</tbody></table></div>`
      : `<div class="p-4">${emptyState('ri-calendar-close-line', 'Không có đơn phù hợp', 'Thử đổi bộ lọc hoặc xem tất cả đơn.')}</div>`}
  </div>`;

  const root = main();
  bindBookingActions(root);
  on(root, 'click', '[data-st]', (e, el) => { bf.status = el.dataset.st; renderBookings(); });
  root.querySelector('#bk-q').addEventListener('input', (e) => { bf.q = e.target.value; clearTimeout(bf.t); bf.t = setTimeout(() => { renderBookings(); const i = main().querySelector('#bk-q'); i.focus(); i.setSelectionRange(i.value.length, i.value.length); }, 250); });
  root.querySelector('#bk-court').addEventListener('change', (e) => { bf.court = e.target.value; renderBookings(); });
  root.querySelector('#bk-date').addEventListener('change', (e) => { bf.date = e.target.value; renderBookings(); });
  root.querySelector('#bk-today').addEventListener('change', (e) => { bf.todayOnly = e.target.checked; renderBookings(); });
  root.querySelector('#btn-camera-scan').addEventListener('click', openQrScanner);
  root.querySelector('#quick-checkin').addEventListener('submit', async (e) => {
    e.preventDefault();
    const input = e.target.code;
    const code = parseTicketPayload(input.value).code;
    if (!code) return toast('Vui lòng nhập mã vé.', 'error');
    const res = await checkIn(null, code);
    if (res) input.value = '';
  });
}

// =====================================================================
// HÓA ĐƠN
// =====================================================================

const inf = { status: 'all', from: '', to: '', q: '', list: null };

export async function renderInvoices() {
  if (!inf.list) {
    main().innerHTML = loadingBlock('Đang tải hóa đơn...');
    try { inf.list = await api('owner', 'invoices'); } catch (e) { main().innerHTML = errorBlock(e.message); return; }
  }
  const q = inf.q.toLowerCase();
  const ranged = filterByDate(inf.list, inf.from, inf.to);
  const list = ranged.filter((i) => inf.status === 'all' || i.status === inf.status).filter((i) => !q || `${i.code} ${i.customerName} ${i.customerPhone} ${i.courtName}`.toLowerCase().includes(q));
  const sum = (k) => ranged.reduce((s, i) => s + i[k], 0);
  actions().innerHTML = `<button type="button" id="inv-csv" class="${BTN_OUT}"><i class="ri-file-excel-2-line"></i>Xuất Excel (CSV)</button>`;
  actions().querySelector('#inv-csv').onclick = () => exportInvoices(list, `hoa-don-${TODAY}.csv`);

  main().innerHTML = `
  <div class="grid grid-cols-2 gap-3 lg:grid-cols-4">
    ${statCard('ri-bill-line', 'Số hóa đơn', ranged.length)}
    ${statCard('ri-money-dollar-circle-line', 'Tổng tiền', money(sum('total')), '', 'secondary')}
    ${statCard('ri-checkbox-circle-line', 'Đã thu', money(sum('paid')))}
    ${statCard('ri-error-warning-line', 'Còn phải thu', money(sum('debt')), `${ranged.filter((i) => i.debt > 0).length} hóa đơn`, 'accent')}
  </div>
  <div class="mt-5 mb-3 flex flex-wrap gap-2">${[['all', 'Tất cả'], ['paid', 'Đã thanh toán'], ['partial', 'Còn nợ'], ['unpaid', 'Chưa thu']].map(([k, l]) => `<button type="button" data-st="${k}" class="${chip(inf.status === k)}">${l}</button>`).join('')}</div>
  <div class="mb-4 grid grid-cols-1 gap-2 sm:grid-cols-[1fr_170px_170px]">
    <input id="inv-q" value="${esc(inf.q)}" class="${INPUT}" placeholder="Tìm mã hóa đơn, khách, sân...">
    <input id="inv-from" type="date" value="${inf.from}" class="${INPUT}" title="Từ ngày">
    <input id="inv-to" type="date" value="${inf.to}" class="${INPUT}" title="Đến ngày">
  </div>
  <div class="${CARD} overflow-hidden">${list.length ? `<div class="overflow-x-auto"><table class="w-full min-w-[780px] text-sm">
    <thead class="bg-background-100 text-left text-xs font-semibold uppercase tracking-wide text-foreground-500"><tr><th class="px-4 py-3">Hóa đơn</th><th class="px-4 py-3">Khách</th><th class="px-4 py-3">Sân · ngày</th><th class="px-4 py-3 text-right">Tổng</th><th class="px-4 py-3 text-right">Còn thu</th><th class="px-4 py-3">Trạng thái</th></tr></thead>
    <tbody class="divide-y divide-background-200">${list.map((i) => `<tr data-inv="${esc(i.id)}" class="cursor-pointer hover:bg-background-50">
      <td class="px-4 py-3"><p class="font-mono text-xs font-bold text-primary-700">${esc(i.code)}</p><p class="text-[11px] text-foreground-500">${i.source === 'customer' ? 'Khách đặt online' : 'Chủ sân nhập'}</p></td>
      <td class="px-4 py-3"><p class="font-semibold">${esc(i.customerName)}</p><p class="text-xs text-foreground-500">${esc(i.customerPhone || '')}</p></td>
      <td class="px-4 py-3"><p>${esc(i.courtName)}</p><p class="text-xs text-foreground-500">${dateText(i.bookingDate)}</p></td>
      <td class="px-4 py-3 text-right font-semibold">${money(i.total)}</td>
      <td class="px-4 py-3 text-right font-semibold ${i.debt ? 'text-accent-700' : 'text-primary-700'}">${money(i.debt)}</td>
      <td class="px-4 py-3">${invoiceBadge(i.status)}</td></tr>`).join('')}</tbody></table></div>`
    : `<div class="p-4">${emptyState('ri-bill-line', 'Chưa có hóa đơn', 'Hóa đơn được tạo tự động khi đơn được xác nhận hoặc hoàn thành.')}</div>`}</div>`;

  const root = main();
  on(root, 'click', '[data-st]', (e, el) => { inf.status = el.dataset.st; renderInvoices(); });
  root.querySelector('#inv-q').addEventListener('change', (e) => { inf.q = e.target.value; renderInvoices(); });
  root.querySelector('#inv-from').addEventListener('change', (e) => { inf.from = e.target.value; renderInvoices(); });
  root.querySelector('#inv-to').addEventListener('change', (e) => { inf.to = e.target.value; renderInvoices(); });
  on(root, 'click', '[data-inv]', (e, el) => {
    const inv = inf.list.find((i) => i.id === el.dataset.inv);
    const extra = inv.debt > 0
      ? `<select data-method class="rounded-md border border-background-300 bg-white px-3 py-2 text-sm"><option value="cash">Tiền mặt</option><option value="transfer">Chuyển khoản</option><option value="vietqr">VietQR</option></select><button type="button" data-pay class="${BTN}"><i class="ri-hand-coin-line"></i>Ghi nhận đã thu đủ</button>`
      : '';
    const m = openInvoiceModal(inv, extra);
    const pay = m.el.querySelector('[data-pay]');
    if (pay) pay.addEventListener('click', async () => {
      setBusy(pay, true, 'Đang lưu...');
      try {
        const b = await api('owner', 'mark_paid', { id: inv.bookingId, method: m.el.querySelector('[data-method]').value });
        const k = S.bookings.findIndex((x) => x.id === b.id);
        if (k >= 0) S.bookings[k] = b;
        inf.list = null;
        m.close();
        toast('Đã ghi nhận thu đủ tiền.');
        renderInvoices();
      } catch (err) { setBusy(pay, false); toast(err.message, 'error'); }
    });
  });
}
export const resetInvoices = () => (inf.list = null);

// =====================================================================
// SÂN CỦA TÔI
// =====================================================================

const timeSelect = (name, value, cls = INPUT) => `<select name="${name}" class="${cls}">${TIME_OPTIONS.map((t) => `<option ${t === value ? 'selected' : ''}>${t}</option>`).join('')}</select>`;

export function openCourtForm(court = null) {
  const c = court || { sport: 'football', status: 'active', openTime: '05:00', closeTime: '23:00', images: [], fieldTypes: [], highlights: [], facilities: [], priceBands: [] };
  const peakBand = (c.priceBands || []).find((b) => b.peak);
  const weekly = normalizeWeeklyHours(c.weeklyHours, c.openTime, c.closeTime);
  const custom = court ? isWeeklyCustomized(c) : false;
  const hasCustomBands = (c.priceBands || []).length > 1;

  const bandRowHtml = (b = {}) => `
    <div class="band-row flex flex-wrap items-center gap-2 rounded-md border border-background-200 bg-white p-2 text-xs">
      <input type="text" data-band-label class="${INPUT} !w-32 !py-1 text-xs" placeholder="Tên khung" value="${esc(b.label || b.shortLabel || '')}">
      <div class="flex items-center gap-1">
        <span class="text-foreground-500 text-[11px]">Từ</span>
        ${timeSelect('b_start', b.start || '05:00', `${INPUT} !w-24 !py-1 text-xs`)}
      </div>
      <div class="flex items-center gap-1">
        <span class="text-foreground-500 text-[11px]">Đến</span>
        ${timeSelect('b_end', b.end || '17:00', `${INPUT} !w-24 !py-1 text-xs`)}
      </div>
      <div class="flex items-center gap-1">
        <span class="text-foreground-500 text-[11px]">Giá</span>
        <input type="number" step="10000" min="0" data-band-price class="${INPUT} !w-28 !py-1 text-xs" placeholder="đ/giờ" value="${b.price || ''}">
      </div>
      <label class="flex items-center gap-1 text-[11px] font-semibold cursor-pointer text-foreground-700">
        <input type="checkbox" data-band-peak ${b.peak ? 'checked' : ''} class="accent-accent-500"> Giờ vàng/Cao điểm
      </label>
      <button type="button" data-remove-band class="${BTN_SM_DANGER} !p-1 ml-auto" title="Xóa khung này"><i class="ri-delete-bin-line"></i></button>
    </div>
  `;

  const m = modal(
    court ? `Sửa sân: ${esc(c.name)}` : 'Thêm sân mới',
    `<form id="court-form" class="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <div class="sm:col-span-2"><label class="${LABEL}">Tên sân *</label><input name="name" value="${esc(c.name || '')}" class="${INPUT}" placeholder="Sân bóng Hưng Phát"></div>
      <div><label class="${LABEL}">Môn thể thao</label><select name="sport" class="${INPUT}"><option value="football" ${c.sport === 'football' ? 'selected' : ''}>Bóng đá</option><option value="badminton" ${c.sport === 'badminton' ? 'selected' : ''}>Cầu lông</option></select></div>
      <div><label class="${LABEL}">Khu vực</label><input name="area" list="area-list" value="${esc(c.area || '')}" class="${INPUT}"><datalist id="area-list">${(PAGE.areas || []).map((a) => `<option value="${esc(a)}">`).join('')}</datalist></div>
      <div class="sm:col-span-2"><label class="${LABEL}">Địa chỉ</label><input name="address" value="${esc(c.address || '')}" class="${INPUT}" placeholder="Số nhà, đường, phường, TP. Buôn Ma Thuột"></div>
      <div><label class="${LABEL}">Giá thường / giờ (đ) *</label><input type="number" name="pricePerHour" min="0" step="10000" value="${c.pricePerHour || ''}" class="${INPUT}"></div>
      <div><label class="${LABEL}">Giá giờ cao điểm / giờ (đ)</label><input type="number" name="peakPrice" min="0" step="10000" value="${c.peakPrice || ''}" class="${INPUT}"></div>
      <div><label class="${LABEL}">Giờ cao điểm bắt đầu từ</label>${timeSelect('peakStart', peakBand ? peakBand.start : '17:00')}</div>
      <div><label class="${LABEL}">Trạng thái</label><select name="status" class="${INPUT}">${[['active', 'Đang hoạt động'], ['maintenance', 'Đang bảo trì'], ['paused', 'Tạm dừng']].map(([v, l]) => `<option value="${v}" ${c.status === v ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
      <div><label class="${LABEL}">Giờ mở cửa</label>${timeSelect('openTime', c.openTime)}</div>
      <div><label class="${LABEL}">Giờ đóng cửa</label>${timeSelect('closeTime', c.closeTime)}</div>

      <div class="sm:col-span-2 rounded-md border border-background-200 bg-background-50/60 p-3">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <label class="flex cursor-pointer items-center gap-2 text-sm font-semibold text-foreground-900">
            <input type="checkbox" name="customPriceBands" ${hasCustomBands ? 'checked' : ''} class="accent-primary-500">
            Bảng giá chi tiết theo khung giờ (Sáng / Chiều / Giờ vàng / Tối)
          </label>
          <div data-preset-wrap class="${hasCustomBands ? '' : 'hidden'} flex flex-wrap gap-1">
            <button type="button" data-preset="2bands" class="${BTN_SM} !py-0.5 !text-[11px]">Mẫu 2 khung (Sáng/Tối)</button>
            <button type="button" data-preset="3bands" class="${BTN_SM} !py-0.5 !text-[11px]">Mẫu 3 khung (Giờ vàng)</button>
            <button type="button" data-preset="4bands" class="${BTN_SM} !py-0.5 !text-[11px]">Mẫu 4 khung</button>
          </div>
        </div>
        <p class="mt-1 text-xs text-foreground-500">Thiết lập giá chi tiết cho từng khoảng thời gian trong ngày. Khách đặt slot nào sẽ tự động tính giá theo khung giờ đó.</p>
        <div data-bands-list class="${hasCustomBands ? '' : 'hidden'} mt-3 space-y-2"></div>
        <button type="button" data-add-band class="${BTN_SM} mt-2 ${hasCustomBands ? '' : 'hidden'}"><i class="ri-add-line"></i>Thêm khung giờ giá</button>
      </div>

      <div class="sm:col-span-2 rounded-md border border-background-200 p-3">
        <label class="flex cursor-pointer items-center gap-2 text-sm font-semibold"><input type="checkbox" name="customWeek" ${custom ? 'checked' : ''} class="accent-primary-500">Giờ mở cửa riêng cho từng ngày trong tuần</label>
        <div data-week class="${custom ? '' : 'hidden'} mt-3 space-y-2">${WEEKDAY_KEYS.map((k) => `<div class="grid grid-cols-[80px_auto_1fr_1fr] items-center gap-2 text-sm"><span class="font-medium">${WEEKDAY_LABELS[k]}</span><label class="flex items-center gap-1 text-xs"><input type="checkbox" data-closed="${k}" ${weekly[k].closed ? 'checked' : ''} class="accent-accent-500">Nghỉ</label>${timeSelect(`wo_${k}`, weekly[k].open, `${INPUT} !py-1.5`)}${timeSelect(`wc_${k}`, weekly[k].close, `${INPUT} !py-1.5`)}</div>`).join('')}</div>
      </div>
      <div class="sm:col-span-2"><label class="${LABEL}">Ảnh sân (mỗi dòng 1 đường dẫn ảnh)</label><textarea name="images" rows="3" class="${INPUT}" placeholder="https://...">${esc((c.images || []).join('\n'))}</textarea>
        <div class="mt-2 flex flex-wrap gap-2">${(PAGE.facilityImages || []).map((u, i) => `<button type="button" data-img="${esc(u)}" class="${BTN_SM}"><i class="ri-image-add-line"></i>Ảnh mẫu ${i + 1}</button>`).join('')}</div></div>
      <div><label class="${LABEL}">Loại sân (phân cách bằng dấu phẩy)</label><input name="fieldTypes" value="${esc((c.fieldTypes || []).join(', '))}" class="${INPUT}" placeholder="Sân 5, Sân 7"></div>
      <div><label class="${LABEL}">Tiện ích (phân cách bằng dấu phẩy)</label><input name="facilities" value="${esc((c.facilities || []).join(', '))}" class="${INPUT}" placeholder="Wifi, Gửi xe, Nước uống"></div>
      <div class="sm:col-span-2"><label class="${LABEL}">Điểm nổi bật (mỗi dòng 1 ý)</label><textarea name="highlights" rows="2" class="${INPUT}">${esc((c.highlights || []).join('\n'))}</textarea></div>
      <div class="sm:col-span-2"><label class="${LABEL}">Mô tả</label><textarea name="description" rows="3" class="${INPUT}">${esc(c.description || '')}</textarea></div>
      <div><label class="${LABEL}">Ghi chú giá</label><input name="priceNote" value="${esc(c.priceNote || '')}" class="${INPUT}" placeholder="Giá đã gồm nước uống"></div>
      <div><label class="${LABEL}">Ghi chú nội bộ</label><input name="note" value="${esc(c.note || '')}" class="${INPUT}"></div>
    </form>`,
    `<button type="button" data-close class="${BTN_OUT}">Hủy</button><button type="button" data-ok class="${BTN}"><i class="ri-save-3-line"></i>${court ? 'Lưu thay đổi' : 'Thêm sân'}</button>`,
    'max-w-3xl',
  );
  const form = m.el.querySelector('#court-form');
  form.customWeek.addEventListener('change', () => m.el.querySelector('[data-week]').classList.toggle('hidden', !form.customWeek.checked));
  on(form, 'click', '[data-img]', (e, el) => { form.images.value = `${form.images.value.trim()}\n${el.dataset.img}`.trim(); });

  const bandsList = m.el.querySelector('[data-bands-list]');
  const presetWrap = m.el.querySelector('[data-preset-wrap]');
  const addBandBtn = m.el.querySelector('[data-add-band]');
  const initialBands = (c.priceBands && c.priceBands.length) ? c.priceBands : [
    { label: 'Sáng – chiều', start: c.openTime || '05:00', end: '17:00', price: c.pricePerHour || 150000, peak: false },
    { label: 'Giờ vàng / Buổi tối', start: '17:00', end: c.closeTime || '23:00', price: c.peakPrice || 250000, peak: true },
  ];
  bandsList.innerHTML = initialBands.map(bandRowHtml).join('');

  form.customPriceBands.addEventListener('change', () => {
    const show = form.customPriceBands.checked;
    bandsList.classList.toggle('hidden', !show);
    presetWrap.classList.toggle('hidden', !show);
    addBandBtn.classList.toggle('hidden', !show);
  });

  addBandBtn.addEventListener('click', () => {
    bandsList.insertAdjacentHTML('beforeend', bandRowHtml({ label: 'Khung giờ mới', start: '17:00', end: '21:00', price: c.peakPrice || 200000, peak: false }));
  });

  on(bandsList, 'click', '[data-remove-band]', (e, el) => {
    const row = el.closest('.band-row');
    if (bandsList.querySelectorAll('.band-row').length > 1) {
      row.remove();
    } else {
      toast('Cần ít nhất 1 khung giờ giá.', 'error');
    }
  });

  on(m.el, 'click', '[data-preset]', (e, el) => {
    const p = el.dataset.preset;
    const op = form.openTime.value || '05:00';
    const cl = form.closeTime.value || '23:00';
    const baseP = Number(form.pricePerHour.value) || 150000;
    const peakP = Number(form.peakPrice.value) || 250000;
    let bds = [];
    if (p === '2bands') {
      bds = [
        { label: 'Sáng – chiều', start: op, end: '17:00', price: baseP, peak: false },
        { label: 'Buổi tối', start: '17:00', end: cl, price: peakP, peak: true },
      ];
    } else if (p === '3bands') {
      bds = [
        { label: 'Buổi sáng', start: op, end: '16:00', price: baseP, peak: false },
        { label: 'Giờ vàng (Cao điểm)', start: '16:00', end: '20:00', price: peakP, peak: true },
        { label: 'Buổi tối muộn', start: '20:00', end: cl, price: Math.round((baseP + peakP) / 2), peak: false },
      ];
    } else if (p === '4bands') {
      bds = [
        { label: 'Sáng sớm thể dục', start: op, end: '08:00', price: baseP, peak: false },
        { label: 'Ban ngày vắng khách', start: '08:00', end: '16:00', price: Math.max(80000, baseP - 20000), peak: false },
        { label: 'Giờ vàng tan ca', start: '16:00', end: '21:00', price: peakP, peak: true },
        { label: 'Khung đêm', start: '21:00', end: cl, price: baseP, peak: false },
      ];
    }
    bandsList.innerHTML = bds.map(bandRowHtml).join('');
    toast(`Đã áp dụng mẫu ${el.textContent}`);
  });

  m.el.querySelector('[data-ok]').addEventListener('click', async (e) => {
    const f = formData(form);
    const split = (v, sep) => (v || '').split(sep).map((s) => s.trim()).filter(Boolean);
    let weeklyHours = null;
    if (form.customWeek.checked) {
      weeklyHours = {};
      WEEKDAY_KEYS.forEach((k) => (weeklyHours[k] = { closed: form.querySelector(`[data-closed="${k}"]`).checked, open: f[`wo_${k}`], close: f[`wc_${k}`] }));
    }

    let priceBands = null;
    let pricePerHour = Number(f.pricePerHour) || 0;
    let peakPrice = Number(f.peakPrice) || 0;
    if (form.customPriceBands.checked) {
      priceBands = [];
      bandsList.querySelectorAll('.band-row').forEach((row, idx) => {
        const lbl = row.querySelector('[data-band-label]').value.trim();
        const st = row.querySelector('select[name="b_start"]').value;
        const en = row.querySelector('select[name="b_end"]').value;
        const pr = Number(row.querySelector('[data-band-price]').value) || 0;
        const pk = row.querySelector('[data-band-peak]').checked;
        if (st && en && st < en && pr > 0) {
          priceBands.push({ id: `band_${idx + 1}`, label: lbl || `${st} - ${en}`, shortLabel: lbl || `${st} - ${en}`, start: st, end: en, price: pr, peak: pk });
        }
      });
      if (priceBands.length) {
        const prs = priceBands.map((x) => x.price);
        pricePerHour = Math.min(...prs);
        peakPrice = Math.max(...prs);
      }
    }

    const body = {
      id: court ? court.id : '', name: f.name, sport: f.sport, area: f.area, address: f.address, pricePerHour, peakPrice,
      peakStart: f.peakStart, status: f.status, openTime: f.openTime, closeTime: f.closeTime, weeklyHours, priceBands, images: split(f.images, '\n'), fieldTypes: split(f.fieldTypes, ','),
      facilities: split(f.facilities, ','), highlights: split(f.highlights, '\n'), description: f.description, priceNote: f.priceNote, note: f.note,
    };
    setBusy(e.currentTarget, true, 'Đang lưu...');
    try {
      await api('owner', 'court_save', body);
      await loadData();
      m.close();
      toast(court ? 'Đã cập nhật thông tin sân.' : 'Đã thêm sân mới.');
      rerender();
    } catch (err) { setBusy(e.currentTarget, false); toast(err.message, 'error'); }
  });
}

export function renderCourts() {
  actions().innerHTML = `<button type="button" id="court-add" class="${BTN}"><i class="ri-add-line"></i>Thêm sân</button>`;
  actions().querySelector('#court-add').onclick = () => openCourtForm();
  const count = (id) => S.bookings.filter((b) => b.courtId === id && isActive(b)).length;
  main().innerHTML = `
  ${S.courts.length ? `<div class="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">${S.courts.map((c) => `
    <article class="${CARD} overflow-hidden">
      <div class="relative h-40 bg-background-200"><img src="${esc(c.image)}" alt="${esc(c.name)}" class="h-full w-full object-cover" loading="lazy"><span class="absolute left-3 top-3">${statusBadge(c.status)}</span></div>
      <div class="p-4">
        <h3 class="font-heading text-base font-bold text-foreground-950">${esc(c.name)}</h3>
        <p class="mt-1 flex items-start gap-1 text-xs text-foreground-500"><i class="ri-map-pin-line mt-0.5"></i>${esc(c.address || c.area)}</p>
        <div class="mt-3 grid grid-cols-2 gap-2 text-xs">
          <div class="rounded-md bg-background-100 px-2.5 py-2"><p class="text-foreground-500">Giá / giờ</p><p class="font-bold text-foreground-950">${money(c.pricePerHour)}${c.peakPrice > c.pricePerHour ? ` – ${money(c.peakPrice)}` : ''}</p></div>
          <div class="rounded-md bg-background-100 px-2.5 py-2"><p class="text-foreground-500">Giờ mở cửa</p><p class="font-bold text-foreground-950">${c.openTime} - ${c.closeTime}</p></div>
          <div class="rounded-md bg-background-100 px-2.5 py-2"><p class="text-foreground-500">Đánh giá</p><p class="font-bold text-foreground-950"><i class="ri-star-fill text-accent-500"></i> ${c.rating.toFixed(1)} (${c.reviewCount})</p></div>
          <div class="rounded-md bg-background-100 px-2.5 py-2"><p class="text-foreground-500">Tổng đơn</p><p class="font-bold text-foreground-950">${count(c.id)}</p></div>
        </div>
        ${isWeeklyCustomized(c) ? `<p class="mt-2 text-[11px] text-foreground-500">${esc(weekdaySummary(c.weeklyHours))}</p>` : ''}
        ${(c.priceBands && c.priceBands.length > 1) ? `
          <div class="mt-2.5 rounded-md border border-background-200 bg-background-50/70 p-2 text-xs">
            <p class="font-semibold text-foreground-700 mb-1 flex items-center gap-1 text-[11px]"><i class="ri-price-tag-3-line text-primary-600"></i> Bảng giá theo khung giờ:</p>
            <div class="space-y-0.5">
              ${c.priceBands.map((b) => `<div class="flex justify-between items-center text-[11px]"><span class="text-foreground-600">${esc(b.shortLabel || b.label)} (${b.start} - ${b.end})${b.peak ? ' <span class="rounded bg-accent-100 text-accent-800 px-1 py-0.2 font-semibold">Giờ vàng</span>' : ''}</span><b class="text-foreground-900">${money(b.price)}</b></div>`).join('')}
            </div>
          </div>` : ''}
        <div class="mt-4 flex flex-wrap gap-1.5">
          <button type="button" data-edit="${c.id}" class="${BTN_SM_PRI}"><i class="ri-edit-line"></i>Sửa</button>
          <select data-status="${c.id}" class="rounded-md border border-background-300 bg-white px-2 py-1.5 text-xs font-semibold">${[['active', 'Đang hoạt động'], ['maintenance', 'Bảo trì'], ['paused', 'Tạm dừng']].map(([v, l]) => `<option value="${v}" ${c.status === v ? 'selected' : ''}>${l}</option>`).join('')}</select>
          <a href="${esc((window.APP.base || '') + '/san/' + c.slug)}" target="_blank" class="${BTN_SM}"><i class="ri-external-link-line"></i>Xem</a>
          <button type="button" data-trash="${c.id}" class="${BTN_SM_DANGER}"><i class="ri-delete-bin-line"></i>Xóa</button>
        </div>
      </div>
    </article>`).join('')}</div>` : emptyState('ri-football-line', 'Bạn chưa có sân nào', 'Thêm sân đầu tiên để khách có thể tìm và đặt sân online.', `<button type="button" data-add class="${BTN}">Thêm sân</button>`)}
  <section class="${CARD} mt-6">${sectionTitle(`<i class="ri-delete-bin-6-line text-foreground-500"></i> Thùng rác (${S.trash.length})`)}
    ${S.trash.length ? `<div class="divide-y divide-background-200">${S.trash.map((c) => `<div class="flex flex-wrap items-center justify-between gap-3 px-4 py-3"><div><p class="text-sm font-semibold">${esc(c.name)}</p><p class="text-xs text-foreground-500">Đã xóa lúc ${formatDateTime(c.deletedAt)}</p></div><div class="flex gap-1.5"><button type="button" data-restore="${c.id}" class="${BTN_SM}"><i class="ri-arrow-go-back-line"></i>Khôi phục</button><button type="button" data-purge="${c.id}" class="${BTN_SM_DANGER}">Xóa vĩnh viễn</button></div></div>`).join('')}</div>` : '<p class="px-4 py-5 text-sm text-foreground-500">Thùng rác trống. Sân bị xóa sẽ nằm ở đây để bạn khôi phục khi cần.</p>'}
  </section>`;

  const root = main();
  const act = async (action, id, msg) => {
    try { await api('owner', action, { id }); await loadData(); toast(msg); rerender(); } catch (e) { toast(e.message, 'error'); }
  };
  on(root, 'click', '[data-add]', () => openCourtForm());
  on(root, 'click', '[data-edit]', (e, el) => openCourtForm(courtById(el.dataset.edit)));
  on(root, 'click', '[data-restore]', (e, el) => act('court_restore', el.dataset.restore, 'Đã khôi phục sân (đang ở trạng thái tạm dừng).'));
  root.addEventListener('change', (e) => {
    const el = e.target.closest('[data-status]');
    if (!el) return;
    api('owner', 'court_status', { id: el.dataset.status, status: el.value }).then(() => { courtById(el.dataset.status).status = el.value; toast('Đã cập nhật trạng thái sân.'); rerender(); }).catch((err) => toast(err.message, 'error'));
  });
  on(root, 'click', '[data-trash]', async (e, el) => {
    const c = courtById(el.dataset.trash);
    const upcoming = S.bookings.filter((b) => b.courtId === c.id && b.date >= TODAY && ['pending', 'confirmed'].includes(b.status)).length;
    if (await confirmBox({ title: `Chuyển "${c.name}" vào thùng rác?`, message: `Sân sẽ ẩn khỏi trang tìm sân và các khung giờ đang khóa sẽ được xóa.${upcoming ? ` Lưu ý: còn ${upcoming} đơn sắp tới của sân này.` : ''} Bạn có thể khôi phục lại sau.`, confirmText: 'Chuyển vào thùng rác', danger: true }))
      act('court_trash', c.id, 'Đã chuyển sân vào thùng rác.');
  });
  on(root, 'click', '[data-purge]', async (e, el) => {
    const c = courtById(el.dataset.purge);
    if (await confirmBox({ title: 'Xóa vĩnh viễn sân?', message: `"${esc(c.name)}" cùng toàn bộ đơn, đánh giá liên quan sẽ bị xóa và không thể khôi phục.`, confirmText: 'Xóa vĩnh viễn', danger: true }))
      act('court_purge', c.id, 'Đã xóa vĩnh viễn sân.');
  });
}

// =====================================================================
// LỊCH & KHUNG GIỜ
// =====================================================================

const sf = { court: '', date: TODAY, picked: new Set() };

export function openQuickBlockModal(preset = {}) {
  const defaultDate = preset.date || TODAY;
  const cOptions = `<option value="all">Tất cả các sân (${S.courts.length} sân)</option>` +
    S.courts.map((c) => `<option value="${c.id}" ${c.id === preset.courtId ? 'selected' : ''}>${esc(c.name)}</option>`).join('');

  const m = modal(
    '<i class="ri-tools-line text-accent-600"></i> Khóa sân bảo trì',
    `<form id="quick-block-form" class="space-y-4 text-xs">
      <div>
        <label class="${LABEL}">Chọn sân cần khóa *</label>
        <select name="courtId" class="${INPUT}">${cOptions}</select>
      </div>
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label class="${LABEL}">Từ ngày *</label>
          <input type="date" name="fromDate" min="${TODAY}" value="${defaultDate}" class="${INPUT}">
        </div>
        <div>
          <label class="${LABEL}">Đến ngày *</label>
          <input type="date" name="toDate" min="${TODAY}" value="${defaultDate}" class="${INPUT}">
        </div>
      </div>
      <div>
        <label class="${LABEL}">Hình thức khóa *</label>
        <select name="mode" class="${INPUT}">
          <option value="allday">Khóa cả ngày (tất cả các khung giờ hoạt động)</option>
          <option value="range">Khóa một khoảng giờ cụ thể (VD: 07:00 - 11:00)</option>
        </select>
      </div>
      <div data-hours-wrap class="hidden grid grid-cols-2 gap-3 rounded-md border border-background-200 bg-background-50 p-3">
        <div>
          <label class="${LABEL}">Từ giờ</label>
          ${timeSelect('fromTime', '07:00')}
        </div>
        <div>
          <label class="${LABEL}">Đến giờ</label>
          ${timeSelect('toTime', '11:00')}
        </div>
      </div>
      <div>
        <label class="${LABEL}">Lý do bảo trì / ghi chú</label>
        <input name="reason" class="${INPUT}" placeholder="VD: Bảo dưỡng cỏ nhân tạo, thay bóng đèn LED, mưa ngập sân...">
        <div class="mt-2 flex flex-wrap gap-1.5" data-reason-tags>
          <button type="button" class="${BTN_SM} !text-[11px] !py-0.5">Bảo dưỡng cỏ</button>
          <button type="button" class="${BTN_SM} !text-[11px] !py-0.5">Sửa đèn LED</button>
          <button type="button" class="${BTN_SM} !text-[11px] !py-0.5">Sửa lưới & khung thành</button>
          <button type="button" class="${BTN_SM} !text-[11px] !py-0.5">Mưa ngập sân</button>
          <button type="button" class="${BTN_SM} !text-[11px] !py-0.5">Giải đấu nội bộ</button>
        </div>
      </div>
      <div class="rounded-md bg-amber-50 border border-amber-200 p-2.5 text-amber-800 text-[11px]">
        <i class="ri-alert-line font-bold"></i> Khách hàng sẽ không thể đặt các khung giờ đã khóa trên website. Bạn có thể mở khóa lại bất kỳ lúc nào.
      </div>
    </form>`,
    `<button type="button" data-close class="${BTN_OUT}">Hủy</button>
     <button type="button" data-ok class="${BTN_DANGER}"><i class="ri-lock-line"></i> Xác nhận khóa bảo trì</button>`,
    'max-w-lg',
  );

  const form = m.el.querySelector('#quick-block-form');
  const modeSelect = form.querySelector('select[name="mode"]');
  const hoursWrap = form.querySelector('[data-hours-wrap]');
  modeSelect.addEventListener('change', () => {
    hoursWrap.classList.toggle('hidden', modeSelect.value !== 'range');
  });

  on(form, 'click', '[data-reason-tags] button', (e, btn) => {
    form.reason.value = btn.textContent.trim();
  });

  m.el.querySelector('[data-ok]').addEventListener('click', async (e) => {
    const f = formData(form);
    if (!f.fromDate || !f.toDate) return toast('Vui lòng chọn ngày bắt đầu và kết thúc.', 'error');
    if (f.fromDate > f.toDate) return toast('Ngày bắt đầu không được lớn hơn ngày kết thúc.', 'error');

    let slots = ['all'];
    if (f.mode === 'range') {
      const startMin = toMinutes(f.fromTime);
      const endMin = toMinutes(f.toTime);
      if (startMin >= endMin) return toast('Giờ bắt đầu phải trước giờ kết thúc.', 'error');
      slots = [];
      for (let t = startMin; t + 60 <= endMin; t += 60) {
        slots.push(minutesToTime(t));
      }
      if (!slots.length) return toast('Khoảng giờ phải tối thiểu 1 tiếng.', 'error');
    }

    setBusy(e.currentTarget, true, 'Đang khóa...');
    try {
      const res = await api('owner', 'block_slots', {
        courtId: f.courtId,
        fromDate: f.fromDate,
        toDate: f.toDate,
        slots,
        blocked: true,
        reason: f.reason || 'Bảo trì',
      });
      if (res.blocked) S.blocked = res.blocked;
      if (res.list) S.blockedList = res.list;
      m.close();
      toast('Đã khóa bảo trì thành công.');
      rerender();
    } catch (err) {
      setBusy(e.currentTarget, false);
      toast(err.message, 'error');
    }
  });
}

export function renderSchedule() {
  if (!S.courts.length) { main().innerHTML = emptyState('ri-time-line', 'Chưa có sân', 'Thêm sân để thiết lập lịch.'); return; }
  if (!courtById(sf.court) || !S.courts.find((c) => c.id === sf.court)) sf.court = S.courts[0].id;
  const c = courtById(sf.court);
  const h = hoursForDate(c, sf.date);
  const blocked = new Set(S.blocked[`${c.id}:${sf.date}`] || []);
  const bookedBy = {};
  S.bookings.filter((b) => b.courtId === c.id && b.date === sf.date && ['pending', 'confirmed', 'completed'].includes(b.status)).forEach((b) => b.slots.forEach((s) => (bookedBy[s] = b)));
  const slots = [];
  if (!h.closed) for (let t = toMinutes(h.open); t + 60 <= toMinutes(h.close); t += 60) slots.push(minutesToTime(t));
  const priceAt = (s) => (c.priceBands || []).find((b) => s >= b.start && s < b.end)?.price || c.pricePerHour;
  const days = Array.from({ length: 14 }, (_, i) => addDays(TODAY, i));
  const wd = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
  const free = slots.filter((s) => !bookedBy[s] && !blocked.has(s)).length;

  actions().innerHTML = `
    <button type="button" id="sc-quick-block" class="${BTN_OUT}"><i class="ri-tools-line text-accent-600"></i>Khóa bảo trì</button>
    <button type="button" id="sc-counter" class="${BTN}"><i class="ri-add-line"></i>Tạo đơn tại quầy</button>
  `;
  actions().querySelector('#sc-quick-block').onclick = () => openQuickBlockModal({ courtId: c.id, date: sf.date });
  actions().querySelector('#sc-counter').onclick = () => openCounterBooking({ courtId: c.id, date: sf.date });

  main().innerHTML = `
  <div class="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_300px]">
    <div class="${CARD} min-w-0 p-4">
      <div class="flex flex-wrap items-center gap-2"><select id="sc-court" class="${INPUT} sm:max-w-xs">${courtOptions(sf.court, '')}</select><input id="sc-date" type="date" value="${sf.date}" class="${INPUT} sm:max-w-[170px]"></div>
      <div class="mt-3 flex gap-1.5 overflow-x-auto pb-1">${days.map((d) => { const x = new Date(`${d}T00:00:00`); return `<button type="button" data-day="${d}" class="flex w-14 shrink-0 flex-col items-center rounded-md border py-1.5 text-xs ${d === sf.date ? 'border-primary-500 bg-primary-500 text-white' : 'border-background-300 bg-white text-foreground-700 hover:border-primary-400'}"><span>${wd[x.getDay()]}</span><span class="font-bold">${x.getDate()}/${x.getMonth() + 1}</span></button>`; }).join('')}</div>
      <div class="mt-4 flex flex-wrap gap-3 text-[11px] text-foreground-600"><span class="flex items-center gap-1"><span class="h-3 w-3 rounded border border-background-300 bg-white"></span>Trống</span><span class="flex items-center gap-1"><span class="h-3 w-3 rounded bg-primary-100"></span>Đã đặt</span><span class="flex items-center gap-1"><span class="h-3 w-3 rounded bg-rose-200"></span>Đang khóa</span><span class="flex items-center gap-1"><span class="h-3 w-3 rounded bg-accent-400"></span>Đang chọn</span></div>
      ${h.closed ? `<div class="mt-4">${emptyState('ri-moon-line', 'Sân nghỉ ngày này', 'Đổi giờ mở cửa trong phần sửa sân nếu cần.')}</div>` : `<div class="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">${slots.map((s) => {
        const b = bookedBy[s];
        const isB = blocked.has(s);
        const sel = sf.picked.has(s);
        const cls = b ? 'border-primary-200 bg-primary-50 cursor-pointer' : sel ? 'border-accent-500 bg-accent-50 ring-2 ring-accent-300 cursor-pointer' : isB ? 'border-rose-300 bg-rose-50 text-rose-800 cursor-pointer' : 'border-background-300 bg-white hover:border-primary-400 cursor-pointer';
        return `<button type="button" ${b ? `data-detail="${b.id}"` : `data-slot="${s}"`} class="rounded-md border p-2.5 text-left ${cls}"><p class="text-sm font-bold text-foreground-950">${s}</p><p class="truncate text-[11px] ${b ? 'text-primary-700' : isB ? 'text-rose-700 font-semibold' : 'text-foreground-500'}">${b ? esc(b.customerName) : isB ? '<i class="ri-lock-line"></i> Đang khóa' : money(priceAt(s))}</p></button>`;
      }).join('')}</div>`}
      <div class="mt-4 flex flex-wrap items-center gap-2 border-t border-background-200 pt-4">
        <span class="text-xs text-foreground-500">Đã chọn ${sf.picked.size} khung giờ</span>
        <button type="button" data-pick-all class="${BTN_SM}"><i class="ri-checkbox-multiple-line"></i>Chọn tất cả giờ trống</button>
        ${sf.picked.size ? `<button type="button" data-clear-pick class="${BTN_SM}"><i class="ri-close-circle-line"></i>Bỏ chọn</button>` : ''}
        <button type="button" data-block="1" class="${BTN_SM_DANGER}" ${sf.picked.size ? '' : 'disabled'}><i class="ri-lock-line"></i>Khóa giờ đã chọn</button>
        <button type="button" data-block="0" class="${BTN_SM}" ${sf.picked.size ? '' : 'disabled'}><i class="ri-lock-unlock-line"></i>Mở khóa</button>
        <button type="button" data-counter class="${BTN_SM_PRI}" ${sf.picked.size ? '' : 'disabled'}><i class="ri-add-line"></i>Tạo đơn cho giờ đã chọn</button>
        <span class="mx-1 text-background-300">|</span>
        <button type="button" data-block-allday="1" class="${BTN_SM}"><i class="ri-shut-down-line text-rose-600"></i>Khóa cả ngày</button>
        <button type="button" data-block-allday="0" class="${BTN_SM}"><i class="ri-restart-line text-emerald-600"></i>Mở khóa cả ngày</button>
      </div>

      <!-- Khung giờ đang khóa trong ngày -->
      ${blocked.size ? `
        <div class="mt-4 rounded-md border border-rose-200 bg-rose-50/60 p-3 text-xs">
          <div class="flex items-center justify-between mb-2">
            <span class="font-bold text-rose-900 flex items-center gap-1.5"><i class="ri-lock-line"></i> ${blocked.size} khung giờ đang khóa bảo trì ngày ${dateText(sf.date)}:</span>
            <button type="button" data-block-allday="0" class="text-xs font-bold text-rose-700 underline hover:text-rose-900">Mở khóa tất cả</button>
          </div>
          <div class="flex flex-wrap gap-1.5">
            ${[...blocked].sort().map((s) => `
              <span class="inline-flex items-center gap-1 rounded bg-white border border-rose-300 px-2 py-0.5 font-bold text-rose-800">
                ${s}
                <button type="button" data-unblock-single="${s}" class="text-rose-600 hover:text-rose-900 font-bold ml-0.5" title="Mở khóa khung này">×</button>
              </span>
            `).join('')}
          </div>
        </div>
      ` : ''}
    </div>
    <aside class="space-y-4">
      <div class="${CARD} p-4"><p class="text-xs font-bold uppercase tracking-wide text-foreground-500">Tình trạng ngày ${dateText(sf.date)}</p>
        <div class="mt-3 grid grid-cols-3 gap-2 text-center text-xs"><div class="rounded-md bg-background-100 py-2"><p class="text-lg font-bold">${free}</p>Trống</div><div class="rounded-md bg-primary-50 py-2 text-primary-800"><p class="text-lg font-bold">${Object.keys(bookedBy).length}</p>Đã đặt</div><div class="rounded-md bg-rose-100 text-rose-800 py-2"><p class="text-lg font-bold">${blocked.size}</p>Khóa</div></div></div>
      <div class="${CARD} p-4"><p class="text-xs font-bold uppercase tracking-wide text-foreground-500">Giờ mở cửa</p>
        <p class="mt-2 text-sm font-semibold">${h.closed ? 'Nghỉ cả ngày' : `${h.open} - ${h.close}`}</p>
        <p class="mt-1 text-xs text-foreground-500">${esc(isWeeklyCustomized(c) ? weekdaySummary(c.weeklyHours) : `Mỗi ngày ${c.openTime} - ${c.closeTime}`)}</p>
        <p class="mt-3 text-xs font-bold uppercase tracking-wide text-foreground-500">Bảng giá theo khung giờ</p>
        <ul class="mt-2 space-y-1 text-sm">${(c.priceBands || []).map((b) => `<li class="flex justify-between items-center text-xs"><span>${esc(b.shortLabel || b.label)} <span class="text-foreground-500 font-normal">(${b.start}-${b.end})</span>${b.peak ? ' <span class="rounded bg-accent-100 text-accent-800 px-1 py-0.2 font-semibold text-[10px]">Vàng</span>' : ''}</span><b>${money(b.price)}</b></li>`).join('') || `<li class="flex justify-between"><span>Cả ngày</span><b>${money(c.pricePerHour)}</b></li>`}</ul>
        <button type="button" data-edit-court class="${BTN_SM} mt-3 w-full"><i class="ri-settings-3-line"></i>Chỉnh giờ & giá</button></div>
    </aside>
  </div>`;

  const root = main();
  bindBookingActions(root);
  root.querySelector('#sc-court').addEventListener('change', (e) => { sf.court = e.target.value; sf.picked.clear(); rerender(); });
  root.querySelector('#sc-date').addEventListener('change', (e) => { sf.date = e.target.value || TODAY; sf.picked.clear(); rerender(); });
  on(root, 'click', '[data-day]', (e, el) => { sf.date = el.dataset.day; sf.picked.clear(); rerender(); });
  on(root, 'click', '[data-slot]', (e, el) => { const s = el.dataset.slot; sf.picked.has(s) ? sf.picked.delete(s) : sf.picked.add(s); rerender(); });
  on(root, 'click', '[data-pick-all]', () => {
    slots.filter((s) => !bookedBy[s] && !blocked.has(s)).forEach((s) => sf.picked.add(s));
    rerender();
  });
  on(root, 'click', '[data-clear-pick]', () => {
    sf.picked.clear();
    rerender();
  });
  on(root, 'click', '[data-edit-court]', () => openCourtForm(c));
  on(root, 'click', '[data-counter]', () => {
    const slots = [...sf.picked].filter((s) => !blocked.has(s));
    sf.picked.clear();
    openCounterBooking({ courtId: c.id, date: sf.date, slots });
  });
  on(root, 'click', '[data-block]', async (e, el) => {
    const block = el.dataset.block === '1';
    try {
      const res = await api('owner', 'block_slots', { courtId: c.id, date: sf.date, slots: [...sf.picked], blocked: block });
      if (res.blocked) S.blocked = res.blocked;
      if (res.list) S.blockedList = res.list;
      if (res.courtBlocked) S.blocked[`${c.id}:${sf.date}`] = res.courtBlocked;
      sf.picked.clear();
      toast(block ? 'Đã khóa khung giờ — khách sẽ không đặt được.' : 'Đã mở khóa khung giờ.');
      rerender();
    } catch (err) { toast(err.message, 'error'); }
  });
  on(root, 'click', '[data-unblock-single]', async (e, el) => {
    const s = el.dataset.unblockSingle;
    try {
      const res = await api('owner', 'block_slots', { courtId: c.id, date: sf.date, slots: [s], blocked: false });
      if (res.blocked) S.blocked = res.blocked;
      if (res.list) S.blockedList = res.list;
      if (res.courtBlocked) S.blocked[`${c.id}:${sf.date}`] = res.courtBlocked;
      toast(`Đã mở khóa khung ${s}.`);
      rerender();
    } catch (err) { toast(err.message, 'error'); }
  });
  on(root, 'click', '[data-block-allday]', async (e, el) => {
    const isLock = el.dataset.blockAllday === '1';
    const actionText = isLock ? 'Khóa toàn bộ khung giờ' : 'Mở khóa toàn bộ khung giờ';
    if (!await confirmBox({
      title: `${actionText} ngày ${dateText(sf.date)}?`,
      message: `${actionText} của sân "${esc(c.name)}" vào ngày ${dateText(sf.date)}.${isLock ? ' Khách sẽ không thể đặt sân vào ngày này.' : ' Khách sẽ có thể đặt sân bình thường.'}`,
      confirmText: actionText,
      danger: isLock,
    })) return;

    try {
      const res = await api('owner', 'block_slots', { courtId: c.id, date: sf.date, slots: ['all'], blocked: isLock });
      if (res.blocked) S.blocked = res.blocked;
      if (res.list) S.blockedList = res.list;
      if (res.courtBlocked) S.blocked[`${c.id}:${sf.date}`] = res.courtBlocked;
      sf.picked.clear();
      toast(isLock ? 'Đã khóa toàn bộ khung giờ ngày này.' : 'Đã mở khóa toàn bộ khung giờ ngày này.');
      rerender();
    } catch (err) { toast(err.message, 'error'); }
  });
}

export function renderBlockedSlotsManager() {
  const list = S.blockedList || [];
  const futureList = list.filter((b) => b.date >= TODAY);
  const courtsAffected = new Set(futureList.map((b) => b.courtId)).size;
  const todayBlocked = futureList.filter((b) => b.date === TODAY).length;

  actions().innerHTML = `
    <button type="button" id="bm-quick-block" class="${BTN_DANGER}"><i class="ri-tools-line"></i>Khóa sân bảo trì mới</button>
  `;
  actions().querySelector('#bm-quick-block').onclick = () => openQuickBlockModal();

  let filterCourt = '';
  let filterDate = '';
  const selectedKeys = new Set();

  const draw = () => {
    const filtered = futureList
      .filter((b) => !filterCourt || b.courtId === filterCourt)
      .filter((b) => !filterDate || b.date === filterDate);

    const host = document.getElementById('bm-table-container');
    if (!host) return;

    if (!filtered.length) {
      host.innerHTML = `<div class="p-8">${emptyState('ri-lock-unlock-line', 'Không có khung giờ nào bị khóa', 'Tất cả các sân đang mở cửa đón khách bình thường.', `<button type="button" id="bm-empty-block" class="${BTN_DANGER}"><i class="ri-tools-line"></i>Khóa bảo trì mới</button>`)}</div>`;
      const btn = host.querySelector('#bm-empty-block');
      if (btn) btn.onclick = () => openQuickBlockModal();
      return;
    }

    host.innerHTML = `
      <div class="overflow-x-auto">
        <table class="w-full text-left text-xs">
          <thead class="border-b border-background-200 bg-background-100 text-foreground-600 font-semibold">
            <tr>
              <th class="p-3 w-10 text-center"><input type="checkbox" id="bm-check-all" class="accent-primary-500"></th>
              <th class="p-3">Sân</th>
              <th class="p-3">Ngày khóa</th>
              <th class="p-3">Khung giờ</th>
              <th class="p-3">Thời gian tạo</th>
              <th class="p-3 text-right">Thao tác</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-background-200">
            ${filtered.map((item) => {
              const key = `${item.courtId}:${item.date}:${item.slot}`;
              const isChecked = selectedKeys.has(key);
              const isToday = item.date === TODAY;
              return `
                <tr class="hover:bg-background-50 transition-colors">
                  <td class="p-3 text-center"><input type="checkbox" data-bm-check="${key}" ${isChecked ? 'checked' : ''} class="accent-primary-500"></td>
                  <td class="p-3 font-bold text-foreground-900">${esc(item.courtName)}</td>
                  <td class="p-3"><span class="font-semibold ${isToday ? 'text-primary-700' : 'text-foreground-800'}">${dateText(item.date)}</span>${isToday ? ' <span class="rounded bg-primary-100 text-primary-800 px-1.5 py-0.5 text-[10px] font-bold">Hôm nay</span>' : ''}</td>
                  <td class="p-3"><span class="inline-flex items-center gap-1 rounded bg-rose-50 border border-rose-200 px-2 py-0.5 text-xs font-bold text-rose-800"><i class="ri-lock-line"></i> ${esc(item.slot)} - ${minutesToTime(toMinutes(item.slot) + 60)}</span></td>
                  <td class="p-3 text-foreground-500">${formatDateTime(item.createdAt)}</td>
                  <td class="p-3 text-right">
                    <button type="button" data-bm-unblock="${key}" class="${BTN_SM}"><i class="ri-lock-unlock-line text-emerald-600"></i> Mở khóa</button>
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    `;

    const unblockSelBtn = document.getElementById('bm-unblock-selected');
    const selCountSpan = document.getElementById('bm-sel-count');
    if (unblockSelBtn && selCountSpan) {
      selCountSpan.textContent = selectedKeys.size;
      unblockSelBtn.disabled = selectedKeys.size === 0;
    }
  };

  main().innerHTML = `
    <div class="grid grid-cols-1 gap-3 sm:grid-cols-3 mb-5">
      ${statCard('ri-lock-2-line', 'Khung giờ đang khóa', futureList.length, 'Tính từ hôm nay trở đi', 'accent')}
      ${statCard('ri-calendar-event-line', 'Khóa hôm nay', todayBlocked, 'Khung giờ tạm dừng đón khách', 'secondary')}
      ${statCard('ri-football-line', 'Sân bị ảnh hưởng', `${courtsAffected}/${S.courts.length}`, 'Sân có lịch bảo trì', 'neutral')}
    </div>

    <section class="${CARD} overflow-hidden">
      ${sectionTitle(`Khung giờ bị khóa bảo trì (${futureList.length})`, `
        <div class="flex flex-wrap items-center gap-2">
          <select id="bm-filter-court" class="${INPUT} !py-1 !text-xs !w-auto">
            <option value="">Tất cả sân</option>
            ${S.courts.map((c) => `<option value="${c.id}">${esc(c.name)}</option>`).join('')}
          </select>
          <input type="date" id="bm-filter-date" class="${INPUT} !py-1 !text-xs !w-auto" placeholder="Lọc theo ngày">
          <button type="button" id="bm-unblock-selected" class="${BTN_SM}" disabled><i class="ri-lock-unlock-line"></i>Mở khóa đã chọn (<span id="bm-sel-count">0</span>)</button>
        </div>
      `)}
      <div id="bm-table-container"></div>
    </section>
  `;

  draw();

  const root = main();
  const cSel = root.querySelector('#bm-filter-court');
  const dInp = root.querySelector('#bm-filter-date');
  if (cSel) cSel.onchange = (e) => { filterCourt = e.target.value; selectedKeys.clear(); draw(); };
  if (dInp) dInp.onchange = (e) => { filterDate = e.target.value; selectedKeys.clear(); draw(); };

  on(root, 'change', '#bm-check-all', (e) => {
    const checked = e.target.checked;
    const filtered = futureList
      .filter((b) => !filterCourt || b.courtId === filterCourt)
      .filter((b) => !filterDate || b.date === filterDate);
    if (checked) {
      filtered.forEach((item) => selectedKeys.add(`${item.courtId}:${item.date}:${item.slot}`));
    } else {
      selectedKeys.clear();
    }
    draw();
  });

  on(root, 'change', '[data-bm-check]', (e, el) => {
    const key = el.dataset.bmCheck;
    if (el.checked) selectedKeys.add(key);
    else selectedKeys.delete(key);
    const unblockSelBtn = document.getElementById('bm-unblock-selected');
    const selCountSpan = document.getElementById('bm-sel-count');
    if (unblockSelBtn && selCountSpan) {
      selCountSpan.textContent = selectedKeys.size;
      unblockSelBtn.disabled = selectedKeys.size === 0;
    }
  });

  on(root, 'click', '[data-bm-unblock]', async (e, el) => {
    const [courtId, date, slot] = el.dataset.bmUnblock.split(':');
    const c = courtById(courtId);
    if (!await confirmBox({
      title: 'Mở khóa khung giờ?',
      message: `Mở khóa sân "${c ? esc(c.name) : courtId}" lúc ${slot} ngày ${dateText(date)}? Khách hàng sẽ có thể đặt sân lại.`,
      confirmText: 'Mở khóa',
    })) return;

    try {
      const res = await api('owner', 'block_slots', { courtId, date, slots: [slot], blocked: false });
      if (res.blocked) S.blocked = res.blocked;
      if (res.list) S.blockedList = res.list;
      selectedKeys.delete(`${courtId}:${date}:${slot}`);
      toast(`Đã mở khóa khung ${slot} ngày ${dateText(date)}.`);
      rerender();
    } catch (err) { toast(err.message, 'error'); }
  });

  on(root, 'click', '#bm-unblock-selected', async () => {
    if (!selectedKeys.size) return;
    if (!await confirmBox({
      title: `Mở khóa ${selectedKeys.size} khung giờ?`,
      message: `Bạn có chắc chắn muốn mở khóa cho ${selectedKeys.size} khung giờ đã chọn?`,
      confirmText: 'Mở khóa tất cả',
    })) return;

    try {
      const items = [...selectedKeys].map((k) => {
        const [courtId, date, slot] = k.split(':');
        return { courtId, date, slot };
      });
      const grouped = {};
      items.forEach((it) => {
        const gKey = `${it.courtId}:${it.date}`;
        if (!grouped[gKey]) grouped[gKey] = [];
        grouped[gKey].push(it.slot);
      });
      for (const [gKey, slots] of Object.entries(grouped)) {
        const [courtId, date] = gKey.split(':');
        const res = await api('owner', 'block_slots', { courtId, date, slots, blocked: false });
        if (res.blocked) S.blocked = res.blocked;
        if (res.list) S.blockedList = res.list;
      }
      selectedKeys.clear();
      toast('Đã mở khóa các khung giờ đã chọn thành công.');
      rerender();
    } catch (err) { toast(err.message, 'error'); }
  });
}

// =====================================================================
// ĐÁNH GIÁ
// =====================================================================

const rf = { court: '', rating: 0, unreplied: false, list: null };

export async function renderReviews() {
  if (!rf.list) {
    main().innerHTML = loadingBlock('Đang tải đánh giá...');
    try { rf.list = await api('owner', 'reviews'); } catch (e) { main().innerHTML = errorBlock(e.message); return; }
  }
  const all = rf.list;
  const list = all.filter((r) => !rf.court || r.courtId === rf.court).filter((r) => !rf.rating || r.rating === rf.rating).filter((r) => !rf.unreplied || !r.ownerReply);
  const avg = all.length ? all.reduce((s, r) => s + r.rating, 0) / all.length : 0;
  const unreplied = all.filter((r) => !r.ownerReply).length;
  S.unreplied = unreplied;
  refreshBadges();
  const dist = [5, 4, 3, 2, 1].map((n) => [n, all.filter((r) => r.rating === n).length]);

  main().innerHTML = `
  <div class="grid grid-cols-1 gap-5 lg:grid-cols-[280px_1fr]">
    <aside class="space-y-4">
      <div class="${CARD} p-4 text-center"><p class="font-heading text-4xl font-extrabold text-foreground-950">${avg.toFixed(1)}</p><p class="mt-1 text-accent-500">${'<i class="ri-star-fill"></i>'.repeat(Math.round(avg))}</p><p class="mt-1 text-xs text-foreground-500">${all.length} đánh giá · ${unreplied} chưa phản hồi</p>
        <div class="mt-3 space-y-1.5">${dist.map(([n, k]) => `<button type="button" data-rating="${n}" class="flex w-full items-center gap-2 text-xs ${rf.rating === n ? 'font-bold text-primary-700' : ''}"><span class="w-6">${n}★</span><span class="h-2 flex-1 rounded-full bg-background-200"><span class="block h-2 rounded-full bg-accent-500" style="width:${all.length ? (k / all.length) * 100 : 0}%"></span></span><span class="w-6 text-right">${k}</span></button>`).join('')}</div></div>
      <div class="${CARD} space-y-2 p-4"><select id="rv-court" class="${INPUT}">${courtOptions(rf.court)}</select>
        <label class="flex cursor-pointer items-center gap-2 text-sm"><input id="rv-unreplied" type="checkbox" ${rf.unreplied ? 'checked' : ''} class="accent-primary-500">Chỉ đánh giá chưa phản hồi</label>
        ${rf.rating ? `<button type="button" data-rating="0" class="text-xs font-semibold text-primary-700">Bỏ lọc số sao</button>` : ''}</div>
    </aside>
    <div class="space-y-3">${list.length ? list.map((r) => `
      <article class="${CARD} p-4">
        <div class="flex items-start justify-between gap-3"><div class="flex items-center gap-3"><span class="flex h-10 w-10 items-center justify-center rounded-full bg-secondary-100 text-sm font-bold text-secondary-800">${esc(r.initials)}</span><div><p class="text-sm font-semibold text-foreground-950">${esc(r.name)} ${r.verified ? '<span class="ml-1 rounded-full bg-primary-50 px-1.5 py-0.5 text-[10px] font-semibold text-primary-700">Đã chơi</span>' : ''}</p><p class="text-xs text-foreground-500">${esc(r.courtName)} · ${esc(r.dateLabel)}</p></div></div><span class="whitespace-nowrap text-sm text-accent-500">${'<i class="ri-star-fill"></i>'.repeat(r.rating)}</span></div>
        <p class="mt-3 text-sm leading-relaxed text-foreground-800">${esc(r.comment)}</p>
        ${(r.tags || []).length ? `<div class="mt-2 flex flex-wrap gap-1.5">${r.tags.map((t) => `<span class="rounded-full bg-background-100 px-2 py-0.5 text-[11px] text-foreground-600">${esc(t)}</span>`).join('')}</div>` : ''}
        ${r.ownerReply ? `<div class="mt-3 rounded-md border-l-4 border-primary-400 bg-primary-50 px-3 py-2"><p class="text-[11px] font-bold text-primary-800">Phản hồi của bạn · ${formatDateTime(r.ownerRepliedAt)}</p><p class="mt-1 text-sm text-foreground-800">${esc(r.ownerReply)}</p><button type="button" data-reply="${r.id}" class="mt-1 text-xs font-semibold text-primary-700">Sửa phản hồi</button></div>`
          : `<form data-reply-form="${r.id}" class="mt-3 flex flex-col gap-2 sm:flex-row"><input name="reply" class="${INPUT}" placeholder="Viết phản hồi công khai cho khách..."><button class="${BTN}">Gửi phản hồi</button></form>`}
      </article>`).join('') : emptyState('ri-star-smile-line', 'Chưa có đánh giá phù hợp', 'Đánh giá của khách sau khi chơi sẽ hiển thị tại đây.')}</div>
  </div>`;

  const root = main();
  on(root, 'click', '[data-rating]', (e, el) => { rf.rating = Number(el.dataset.rating) === rf.rating ? 0 : Number(el.dataset.rating); renderReviews(); });
  root.querySelector('#rv-court').addEventListener('change', (e) => { rf.court = e.target.value; renderReviews(); });
  root.querySelector('#rv-unreplied').addEventListener('change', (e) => { rf.unreplied = e.target.checked; renderReviews(); });
  const save = async (id, reply, btn) => {
    setBusy(btn, true, 'Đang gửi...');
    try {
      const r = await api('owner', 'review_reply', { id, reply });
      rf.list = rf.list.map((x) => (x.id === id ? r : x));
      toast(reply ? 'Đã đăng phản hồi.' : 'Đã gỡ phản hồi.');
      renderReviews();
    } catch (err) { setBusy(btn, false); toast(err.message, 'error'); }
  };
  root.addEventListener('submit', (e) => {
    const f = e.target.closest('[data-reply-form]');
    if (!f) return;
    e.preventDefault();
    save(f.dataset.replyForm, f.reply.value.trim(), f.querySelector('button'));
  });
  on(root, 'click', '[data-reply]', (e, el) => {
    const r = rf.list.find((x) => x.id === el.dataset.reply);
    const m = modal('Sửa phản hồi', `<textarea rows="4" class="${INPUT}">${esc(r.ownerReply)}</textarea><p class="mt-2 text-xs text-foreground-500">Để trống rồi lưu để gỡ phản hồi.</p>`, `<button type="button" data-close class="${BTN_OUT}">Hủy</button><button type="button" data-ok class="${BTN}">Lưu</button>`);
    m.el.querySelector('[data-ok]').addEventListener('click', (ev) => { save(r.id, m.el.querySelector('textarea').value.trim(), ev.currentTarget).then(() => m.close()); });
  });
}
