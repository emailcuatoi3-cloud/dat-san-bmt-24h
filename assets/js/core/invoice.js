/**
 * Hóa đơn dùng chung (khách hàng / chủ sân / quản trị): hộp xem chi tiết, in hóa đơn, xuất CSV.
 */
import { esc, openModal, downloadCsv, formatVnd } from './ui.js';
import { formatLongDate, slotEndTime } from '../lib/format.js';
import { HOTLINE } from '../lib/payment.js';

export const invoiceStatusMeta = {
  paid: ['Đã thanh toán', 'bg-primary-50 text-primary-700 border-primary-200'],
  partial: ['Còn nợ', 'bg-accent-50 text-accent-800 border-accent-200'],
  unpaid: ['Chưa thu', 'bg-background-100 text-foreground-700 border-background-300'],
};
export const invoiceBadge = (status) => {
  const [label, cls] = invoiceStatusMeta[status] || invoiceStatusMeta.unpaid;
  return `<span class="inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold whitespace-nowrap ${cls}">${label}</span>`;
};
export const slotRange = (slots) => (slots.length ? `${slots[0]} - ${slotEndTime(slots[slots.length - 1])} (${slots.length} giờ)` : '--');

export function filterByDate(list, from, to) {
  return list.filter((i) => (!from || i.bookingDate >= from) && (!to || i.bookingDate <= to));
}

export function exportInvoices(list, fileName) {
  const src = { customer: 'Khách đặt online', owner: 'Chủ sân nhập' };
  downloadCsv(
    [
      ['Mã hóa đơn', 'Mã đơn', 'Nguồn', 'Sân', 'Khách hàng', 'Số điện thoại', 'Ngày chơi', 'Khung giờ', 'Tiền sân (VND)', 'Đã thu (VND)', 'Còn nợ (VND)', 'Trạng thái', 'Hình thức', 'Ngày lập'],
      ...list.map((i) => [i.code, i.bookingCode, src[i.source], i.courtName, i.customerName, i.customerPhone, i.bookingDate, slotRange(i.slots), i.total, i.paid, i.debt, invoiceStatusMeta[i.status][0], i.method, (i.issuedAt || '').slice(0, 10)]),
    ],
    fileName,
  );
}

/** HTML hóa đơn (dùng cho cả hộp thoại và bản in) */
export function invoiceHtml(inv) {
  const row = (l, v, cls = 'text-foreground-900') => `<div class="flex items-start justify-between gap-3 py-1.5 text-sm"><span class="text-foreground-500">${l}</span><span class="text-right font-medium ${cls}">${v}</span></div>`;
  return `<div class="flex flex-wrap items-start justify-between gap-3 border-b border-dashed border-background-300 pb-4">
      <div><p class="font-heading text-base font-extrabold text-foreground-950">ĐẶT SÂN BMT 24H</p><p class="text-[11px] text-foreground-500">TP. Buôn Ma Thuột, Đắk Lắk · Hotline ${HOTLINE}</p></div>
      <div class="text-right"><p class="text-[11px] uppercase tracking-wide text-foreground-500">Hóa đơn</p><p class="font-mono text-sm font-bold text-primary-700">${esc(inv.code)}</p>${invoiceBadge(inv.status)}</div>
    </div>
    <div class="mt-3 grid grid-cols-1 gap-x-6 sm:grid-cols-2">
      ${row('Mã đơn', `<span class="font-mono">${esc(inv.bookingCode)}</span>`)}
      ${row('Nguồn đơn', inv.source === 'customer' ? 'Khách đặt online' : 'Chủ sân nhập')}
      ${row('Khách hàng', esc(inv.customerName))}
      ${row('Số điện thoại', esc(inv.customerPhone || '—'))}
      ${row('Sân', esc(inv.courtName))}
      ${row('Ngày chơi', formatLongDate(inv.bookingDate))}
      ${row('Khung giờ', slotRange(inv.slots))}
      ${row('Hình thức', esc(inv.method))}
    </div>
    <div class="mt-3 rounded-md border border-background-200 bg-background-50 px-4 py-2">
      ${row('Tiền sân &amp; dịch vụ', formatVnd(inv.courtFee))}
      ${inv.discount ? row('Đã giảm (mã ưu đãi)', `-${formatVnd(inv.discount)}`, 'text-accent-700') : ''}
      ${inv.deposit ? row('Tiền cọc', formatVnd(inv.deposit)) : ''}
      ${row('Đã thu', formatVnd(inv.paid), 'text-primary-700')}
      <div class="mt-1 flex items-center justify-between gap-3 border-t border-background-200 pt-2 pb-1"><span class="text-sm font-semibold text-foreground-800">Còn phải thu</span><span class="font-heading text-lg font-extrabold ${inv.debt > 0 ? 'text-accent-700' : 'text-primary-700'}">${formatVnd(inv.debt)}</span></div>
    </div>`;
}

export function printInvoice(inv) {
  const w = window.open('', '_blank', 'width=720,height=900');
  if (!w) return;
  w.document.write(`<!doctype html><html lang="vi"><head><meta charset="utf-8"><title>${esc(inv.code)}</title><link rel="stylesheet" href="${document.querySelector('link[href*="app.css"]').href}"></head><body class="bg-white p-8" style="color:#111"><div class="mx-auto max-w-xl">${invoiceHtml(inv)}<p class="mt-6 text-center text-xs">Cảm ơn quý khách đã sử dụng dịch vụ!</p></div><script>setTimeout(()=>print(),400)<\/script></body></html>`);
  w.document.close();
  w.document.documentElement.classList.add('light');
}

/** Hộp xem hóa đơn. extraHtml: nút thao tác thêm (ví dụ "Ghi nhận thu tiền") */
export function openInvoiceModal(inv, extraHtml = '') {
  const modal = openModal({
    size: 'max-w-xl',
    html: `<div class="flex items-center justify-between gap-3 border-b border-background-200 px-5 py-4"><h2 class="font-heading text-lg font-extrabold text-foreground-950">Chi tiết hóa đơn</h2><button type="button" data-close aria-label="Đóng" class="flex h-9 w-9 cursor-pointer items-center justify-center rounded-md text-foreground-500 hover:bg-background-100"><i class="ri-close-line text-xl" aria-hidden="true"></i></button></div>
      <div class="px-5 py-4">${invoiceHtml(inv)}</div>
      <div class="flex flex-col-reverse gap-2 border-t border-background-200 px-5 py-4 sm:flex-row sm:justify-end">${extraHtml}<button type="button" data-print class="inline-flex cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-md border border-background-300 px-4 py-2.5 text-sm font-semibold text-foreground-800 hover:border-primary-400 hover:text-primary-700"><i class="ri-printer-line" aria-hidden="true"></i>In hóa đơn</button></div>`,
  });
  modal.el.querySelector('[data-print]').addEventListener('click', () => printInvoice(inv));
  return modal;
}
