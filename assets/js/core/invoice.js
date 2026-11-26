/**
 * Hóa đơn dùng chung (khách hàng / chủ sân / quản trị): hộp xem chi tiết, in hóa đơn, xuất CSV.
 */
import { esc, openModal, downloadCsv, formatVnd } from './ui.js?v=20261123_04';
import { formatLongDate, slotEndTime } from '../lib/format.js?v=20261123_04';
import { HOTLINE } from '../lib/payment.js?v=20261123_04';

export const invoiceStatusMeta = {
  paid: ['Đã thanh toán', 'bg-primary-50 text-primary-700 border-primary-200'],
  partial: ['Còn nợ', 'bg-accent-50 text-accent-800 border-accent-200'],
  unpaid: ['Chưa thu', 'bg-background-100 text-foreground-700 border-background-300'],
};
export const invoiceBadge = (status) => {
  const [label, cls] = invoiceStatusMeta[status] || invoiceStatusMeta.unpaid;
  return `<span class="inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold whitespace-nowrap ${cls}">${label}</span>`;
};
export const slotRange = (slots) => (slots && slots.length ? `${slots[0]} - ${slotEndTime(slots[slots.length - 1])} (${slots.length} giờ)` : '--');

export function filterByDate(list, from, to) {
  return list.filter((i) => (!from || i.bookingDate >= from) && (!to || i.bookingDate <= to));
}

/** Chuyển đổi một đối tượng booking sang cấu trúc invoice chuẩn để hiển thị */
export function bookingToInvoice(b) {
  const total = Number(b.totalPrice || b.courtFee || 0);
  const deposit = Number(b.depositAmount || 0);
  const isPaid = b.paymentStatus === 'paid';
  const paid = isPaid ? total : (['deposit_paid', 'deposit_claimed'].includes(b.paymentStatus) ? deposit : 0);
  const debt = Math.max(0, total - paid);
  const status = (total > 0 && paid >= total) ? 'paid' : (paid > 0 ? 'partial' : 'unpaid');
  return {
    id: 'inv-' + b.id,
    code: 'HD-' + b.code,
    bookingId: b.id,
    bookingCode: b.code,
    source: b.source === 'online' ? 'customer' : 'owner',
    courtId: b.courtId,
    courtName: b.courtName,
    customerName: b.customerName,
    customerPhone: b.customerPhone,
    bookingDate: b.date || b.bookingDate,
    slots: b.slots || [],
    courtFee: total,
    deposit: deposit,
    discount: Number(b.discount || 0),
    total: total,
    paid: paid,
    debt: debt,
    status: status,
    method: isPaid ? (b.paymentMethod || 'Tiền mặt tại quầy') : (b.payment || 'Chưa thu đủ'),
    issuedAt: b.createdAt || b.date,
    isMock: false,
  };
}

/** Sinh hóa đơn mẫu mô phỏng chuẩn nghiệp vụ thể thao Buôn Ma Thuột */
export function getMockInvoice(courtName = 'Sân bóng BMT Arena') {
  const today = new Date().toISOString().slice(0, 10);
  return {
    id: 'mock-inv-demo-01',
    code: 'HD-BMT2026-DEMO',
    bookingId: 'demo-b-01',
    bookingCode: 'BMT20261123-DEMO',
    source: 'customer',
    courtId: 'c01',
    courtName: courtName || 'Sân bóng BMT Arena',
    customerName: 'Nguyễn Văn Minh (Khách mẫu)',
    customerPhone: '0912 345 678',
    bookingDate: today,
    slots: ['17:30', '18:30'],
    courtFee: 360000,
    deposit: 120000,
    discount: 20000,
    total: 340000,
    paid: 120000,
    debt: 220000,
    status: 'partial',
    method: 'VietQR (Cọc 30%) + Tiền mặt tại quầy',
    issuedAt: today + ' 15:30:00',
    isMock: true,
  };
}

export function exportInvoices(list, fileName) {
  const src = { customer: 'Khách đặt online', owner: 'Chủ sân nhập' };
  downloadCsv(
    [
      ['Mã hóa đơn', 'Mã đơn', 'Nguồn', 'Sân', 'Khách hàng', 'Số điện thoại', 'Ngày chơi', 'Khung giờ', 'Tiền sân (VND)', 'Đã thu (VND)', 'Còn nợ (VND)', 'Trạng thái', 'Hình thức', 'Ngày lập'],
      ...list.map((i) => [i.code, i.bookingCode, src[i.source] || 'Khách đặt online', i.courtName, i.customerName, i.customerPhone, i.bookingDate, slotRange(i.slots), i.total, i.paid, i.debt, (invoiceStatusMeta[i.status] || invoiceStatusMeta.unpaid)[0], i.method, (i.issuedAt || '').slice(0, 10)]),
    ],
    fileName,
  );
}

/** HTML hóa đơn (dùng cho cả hộp thoại và bản in) */
export function invoiceHtml(inv) {
  const row = (l, v, cls = 'text-foreground-900') => `<div class="flex items-start justify-between gap-3 py-1.5 text-sm"><span class="text-foreground-500">${l}</span><span class="text-right font-medium ${cls}">${v}</span></div>`;
  const isMockNotice = inv.isMock ? `
    <div class="mb-3.5 rounded-lg border border-amber-300 bg-amber-50 p-2.5 text-xs text-amber-900 flex items-start gap-2.5">
      <i class="ri-alert-line text-base text-amber-600 shrink-0 mt-0.5"></i>
      <div class="min-w-0 flex-1">
        <div class="flex items-center gap-1.5">
          <p class="font-bold text-amber-950">Hóa đơn mẫu mô phỏng (Chế độ Thử nghiệm Sandbox)</p>
          <span class="rounded bg-amber-200 px-1.5 py-0.2 text-[9px] font-extrabold uppercase text-amber-900">Sandbox</span>
        </div>
        <p class="mt-0.5 text-[11px] text-amber-800 leading-relaxed">
          Chức năng thanh toán trực tuyến đang trong quá trình hoàn thiện. Hóa đơn này mô phỏng luồng thu ngân thực tế (tiền sân, cọc VietQR 30%, tiền thu tại quầy). Khi thanh toán hoàn thiện, hệ thống sẽ tự động cập nhật đúng hóa đơn thật.
        </p>
      </div>
    </div>` : `
    <div class="mb-3 rounded-md border border-primary-200/60 bg-primary-50/40 px-3 py-1.5 text-xs text-primary-900 flex items-center justify-between">
      <span class="flex items-center gap-1.5"><i class="ri-shield-check-line text-primary-600"></i>Hóa đơn hợp lệ theo đơn đặt sân</span>
      <span class="text-[10px] text-primary-700 font-medium">BMT 24H E-Invoice</span>
    </div>`;

  return `
    ${isMockNotice}
    <div class="flex flex-wrap items-start justify-between gap-3 border-b border-dashed border-background-300 pb-4">
      <div>
        <p class="font-heading text-base font-extrabold text-foreground-950 tracking-tight">${esc(inv.courtName || 'ĐẶT SÂN BMT 24H')}</p>
        <p class="text-[11px] text-foreground-500">TP. Buôn Ma Thuột, Đắk Lắk · Hotline hỗ trợ ${HOTLINE}</p>
      </div>
      <div class="text-right">
        <p class="text-[11px] uppercase tracking-wide text-foreground-500 font-medium">Phiếu thanh toán</p>
        <p class="font-mono text-sm font-bold text-primary-700">${esc(inv.code)}</p>
        <div class="mt-1">${invoiceBadge(inv.status)}</div>
      </div>
    </div>
    <div class="mt-3.5 grid grid-cols-1 gap-x-6 gap-y-0.5 sm:grid-cols-2">
      ${row('Mã đơn đặt', `<span class="font-mono font-semibold">${esc(inv.bookingCode || inv.code)}</span>`)}
      ${row('Nguồn đơn', inv.source === 'customer' ? 'Khách đặt online' : 'Tạo tại quầy')}
      ${row('Khách hàng', esc(inv.customerName))}
      ${row('Số điện thoại', esc(inv.customerPhone || '—'))}
      ${row('Sân phụ trách', `<span class="font-semibold text-foreground-950">${esc(inv.courtName)}</span>`)}
      ${row('Ngày chơi', formatLongDate(inv.bookingDate))}
      ${row('Khung giờ', slotRange(inv.slots))}
      ${row('Hình thức', esc(inv.method || 'Tiền mặt'))}
    </div>
    <div class="mt-3.5 rounded-lg border border-background-200 bg-background-50 px-4 py-2.5">
      ${row('Tiền sân &amp; dịch vụ', formatVnd(inv.courtFee || inv.total))}
      ${inv.discount ? row('Đã giảm (ưu đãi)', `-${formatVnd(inv.discount)}`, 'text-accent-700') : ''}
      ${inv.deposit ? row('Đã nhận cọc VietQR (30%)', formatVnd(inv.deposit), 'text-primary-700 font-medium') : ''}
      ${row('Tổng tiền đã thu', formatVnd(inv.paid), 'text-primary-800 font-bold')}
      <div class="mt-2 flex items-center justify-between gap-3 border-t border-background-200 pt-2 pb-0.5">
        <span class="text-sm font-bold text-foreground-800">Số tiền còn thu tại quầy:</span>
        <span class="font-heading text-lg font-extrabold ${inv.debt > 0 ? 'text-accent-700' : 'text-primary-700'}">${formatVnd(inv.debt)}</span>
      </div>
    </div>`;
}

export function printInvoice(inv) {
  const w = window.open('', '_blank', 'width=720,height=900');
  if (!w) return;
  w.document.write(`<!doctype html><html lang="vi"><head><meta charset="utf-8"><title>${esc(inv.code)}</title><link rel="stylesheet" href="${document.querySelector('link[href*="app.css"]')?.href || ''}"></head><body class="bg-white p-8" style="color:#111"><div class="mx-auto max-w-xl">${invoiceHtml(inv)}<p class="mt-6 text-center text-xs text-gray-500">Cảm ơn quý khách đã sử dụng dịch vụ tại ${esc(inv.courtName)}!</p></div><script>setTimeout(()=>print(),400)<\/script></body></html>`);
  w.document.close();
  w.document.documentElement.classList.add('light');
}

/** Hộp xem hóa đơn. extraHtml: nút thao tác thêm (ví dụ "Ghi nhận thu tiền") */
export function openInvoiceModal(inv, extraHtml = '') {
  const modal = openModal({
    size: 'max-w-xl',
    html: `<div class="flex items-center justify-between gap-3 border-b border-background-200 px-5 py-4">
        <div class="flex items-center gap-2">
          <i class="ri-bill-line text-xl text-primary-600"></i>
          <h2 class="font-heading text-lg font-extrabold text-foreground-950">Chi tiết hóa đơn</h2>
        </div>
        <button type="button" data-close aria-label="Đóng" class="flex h-9 w-9 cursor-pointer items-center justify-center rounded-md text-foreground-500 hover:bg-background-100"><i class="ri-close-line text-xl" aria-hidden="true"></i></button>
      </div>
      <div class="px-5 py-4">${invoiceHtml(inv)}</div>
      <div class="flex flex-col-reverse gap-2 border-t border-background-200 px-5 py-4 sm:flex-row sm:justify-end">
        ${extraHtml}
        <button type="button" data-print class="inline-flex cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-md border border-background-300 px-4 py-2 text-sm font-semibold text-foreground-800 hover:border-primary-400 hover:text-primary-700">
          <i class="ri-printer-line" aria-hidden="true"></i>In hóa đơn
        </button>
      </div>`,
  });
  modal.el.querySelector('[data-print]').addEventListener('click', () => printInvoice(inv));
  return modal;
}
