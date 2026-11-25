/**
 * Kênh chủ sân — Cấu trúc 9 phân khu theo Sitemap Chủ sân:
 *  1. Tổng quan (Đơn hôm nay, Doanh thu, Chờ xử lý, Thống kê khung giờ, Thống kê doanh thu)
 *  2. Quản lý sân (Danh sách sân, Bảng giá & khung giờ, Khóa sân bảo trì)
 *  3. Đơn đặt sân (Danh sách đơn, Lịch sân, Lịch cố định, Đặt tại quầy)
 *  4. Thanh toán (Hóa đơn, Lịch sử thanh toán & Yêu cầu hoàn tiền)
 *  5. Dịch vụ (Quản lý dịch vụ, Nhập kho, Tồn kho)
 *  6. Khuyến mãi (Mã giảm giá, Ưu đãi giờ vàng)
 *  7. Khách hàng & đánh giá (Danh sách khách hàng, Đánh giá của khách, Khiếu nại)
 *  8. Cài đặt (Chính sách đặt/cọc/hủy, Nhân viên & phân quyền, Thông báo)
 *  9. Tài khoản (Hồ sơ chủ sân, Tài khoản nhận tiền, Đổi mật khẩu, Đăng xuất)
 */
import { APP, api, esc, toast, confirmBox, setBusy, formData, on, emptyState, loadingBlock, formatDateTime, url } from '../core/ui.js';
import { WEEKDAY_SHORT } from '../lib/promotions.js';
import {
  S, PAGE, TODAY, main, actions, BTN, BTN_OUT, BTN_SM, BTN_SM_PRI, BTN_SM_DANGER, INPUT, LABEL, CARD,
  chip, statCard, sectionTitle, modal, slotText, dateText, money, isActive, courtById,
} from './owner-shared.js?v=20261125_02';
import { renderOverview, renderBookings, renderInvoices, renderCourts, renderSchedule, renderBlockedSlotsManager, openQuickBlockModal, renderReviews, openCounterBooking, openBookingDetail } from './owner-ops.js?v=20261125_02';
import { renderReports, renderCustomers, renderServices, renderPromotions, renderDeposits } from './owner-biz.js?v=20261123_02';

const subState = {};
const getSub = (tab, def) => {
  if (!subState[tab]) subState[tab] = PAGE.tab === tab && PAGE.sub ? PAGE.sub : def;
  return subState[tab];
};

function mountSubBar(tab, items, active, onPick) {
  const host = main();
  const bar = document.createElement('div');
  bar.className = 'mb-5 flex flex-wrap items-center gap-1.5 rounded-lg border border-background-200 bg-white p-1.5';
  bar.innerHTML = items
    .map(
      ([k, label, icon]) => `<button type="button" data-ow-sub="${k}" class="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-md px-3.5 py-2 text-xs font-semibold transition-colors ${
        active === k ? 'bg-primary-500 text-white shadow-sm' : 'text-foreground-600 hover:bg-background-100 hover:text-foreground-950'
      }"><i class="${icon} text-sm" aria-hidden="true"></i>${label}</button>`,
    )
    .join('');
  host.prepend(bar);
  bar.addEventListener('click', (e) => {
    const b = e.target.closest('[data-ow-sub]');
    if (!b || b.dataset.owSub === active) return;
    subState[tab] = b.dataset.owSub;
    onPick(b.dataset.owSub);
  });
}

// =====================================================================
// 1. TỔNG QUAN (Đơn hôm nay, Doanh thu, Chờ xử lý, Thống kê khung giờ, Thống kê doanh thu)
// =====================================================================
export function renderSitemapOverview() {
  const sub = getSub('overview', 'dashboard');
  actions().innerHTML = '';
  if (sub === 'dashboard') {
    renderOverview();
  } else if (sub === 'slots') {
    renderSlotStats();
  } else {
    renderReports();
  }
  mountSubBar(
    'overview',
    [
      ['dashboard', 'Đơn hôm nay & Chờ xử lý', 'ri-dashboard-3-line'],
      ['slots', 'Thống kê khung giờ', 'ri-time-line'],
      ['reports', 'Thống kê doanh thu', 'ri-bar-chart-2-line'],
    ],
    sub,
    renderSitemapOverview,
  );
}

function renderSlotStats() {
  const hours = Array.from({ length: 18 }, (_, i) => `${String(i + 5).padStart(2, '0')}:00`);
  const counts = Object.fromEntries(hours.map((h) => [h, { n: 0, rev: 0 }]));
  const live = S.bookings.filter((b) => isActive(b) && b.status !== 'pending');
  live.forEach((b) => {
    const perSlot = Math.round(b.totalPrice / Math.max(1, (b.slots || []).length));
    (b.slots || []).forEach((s) => {
      if (counts[s]) {
        counts[s].n += 1;
        counts[s].rev += perSlot;
      }
    });
  });
  const maxN = Math.max(1, ...Object.values(counts).map((x) => x.n));
  const peak = Object.entries(counts).sort((a, b) => b[1].n - a[1].n)[0];
  const low = Object.entries(counts).filter(([, x]) => x.n > 0).sort((a, b) => a[1].n - b[1].n)[0];
  main().innerHTML = `
  <div class="grid grid-cols-1 gap-3 sm:grid-cols-3 mb-5">
    ${statCard('ri-fire-line', 'Khung giờ cao điểm nhất', peak ? peak[0] : '—', peak ? `${peak[1].n} lượt · ${money(peak[1].rev)}` : '', 'accent')}
    ${statCard('ri-sun-line', 'Khung giờ thấp điểm', low ? low[0] : '09:00', low ? `${low[1].n} lượt — nên tạo ưu đãi giờ vàng` : 'Gợi ý tạo ưu đãi giờ vàng', 'secondary')}
    ${statCard('ri-calendar-check-line', 'Tổng lượt khung giờ', Object.values(counts).reduce((s, x) => s + x.n, 0), 'Trên toàn bộ sân đang quản lý')}
  </div>
  <section class="${CARD}">
    ${sectionTitle('Mật độ đặt sân theo từng khung giờ (05:00 – 22:00)', '<span class="text-xs text-foreground-500">Dữ liệu thực tế từ đơn đã xác nhận & hoàn thành</span>')}
    <div class="p-5">
      <div class="flex h-56 items-end gap-1.5">
        ${hours.map((h) => {
          const d = counts[h];
          const pct = Math.max(d.n ? 8 : 2, Math.round((d.n / maxN) * 100));
          const isEvening = h >= '17:00' && h <= '21:00';
          return `<div class="group flex h-full flex-1 flex-col items-center justify-end" title="${h}: ${d.n} lượt (${money(d.rev)})">
            <span class="mb-1 text-[10px] font-bold text-foreground-600">${d.n || ''}</span>
            <div class="w-full rounded-t ${isEvening ? 'bg-accent-500' : 'bg-primary-500'} transition-opacity group-hover:opacity-80" style="height:${pct}%"></div>
          </div>`;
        }).join('')}
      </div>
      <div class="mt-2 flex gap-1.5 text-[10px] font-semibold text-foreground-500">${hours.map((h) => `<span class="flex-1 text-center">${h.slice(0, 2)}h</span>`).join('')}</div>
    </div>
  </section>`;
}

// =====================================================================
// 2. QUẢN LÝ SÂN (Danh sách sân, Bảng giá & khung giờ, Khóa sân bảo trì)
// =====================================================================
export function renderSitemapCourts() {
  const sub = getSub('courts', 'list');
  actions().innerHTML = '';
  if (sub === 'list') {
    renderCourts();
  } else if (sub === 'schedule') {
    renderSchedule();
  } else {
    renderBlockedSlotsManager();
  }
  mountSubBar(
    'courts',
    [
      ['list', 'Danh sách sân & Giờ mở cửa', 'ri-football-line'],
      ['schedule', 'Lịch theo ngày & Bảng giá', 'ri-time-line'],
      ['blocked', 'Khung giờ bị khóa & Bảo trì', 'ri-lock-2-line'],
    ],
    sub,
    renderSitemapCourts,
  );
}

// =====================================================================
// 3. ĐƠN ĐẶT SÂN (Danh sách đơn, Lịch sân, Lịch cố định, Đặt tại quầy)
// =====================================================================
export async function renderSitemapBookings() {
  const sub = getSub('bookings', 'list');
  actions().innerHTML = '';
  if (sub === 'list') {
    renderBookings();
  } else if (sub === 'calendar') {
    renderBookingCalendar();
  } else {
    await renderOwnerRecurring();
  }
  mountSubBar(
    'bookings',
    [
      ['list', 'Danh sách đơn', 'ri-list-check-2'],
      ['calendar', 'Lịch sân', 'ri-calendar-schedule-line'],
      ['recurring', 'Lịch cố định', 'ri-calendar-2-line'],
    ],
    sub,
    renderSitemapBookings,
  );
}

let calDate = TODAY;
function renderBookingCalendar() {
  actions().innerHTML = `
    <input type="date" id="ow-cal-date" value="${calDate}" class="${INPUT} !w-auto">
    <button type="button" id="ow-cal-block" class="${BTN_OUT}"><i class="ri-tools-line text-accent-600"></i>Khóa bảo trì</button>
    <button type="button" id="ow-cal-counter" class="${BTN}"><i class="ri-add-line"></i>Đặt tại quầy</button>
  `;
  actions().querySelector('#ow-cal-date').onchange = (e) => { calDate = e.target.value; renderSitemapBookings(); };
  actions().querySelector('#ow-cal-block').onclick = () => openQuickBlockModal({ date: calDate });
  actions().querySelector('#ow-cal-counter').onclick = () => openCounterBooking({ date: calDate });

  const hours = Array.from({ length: 17 }, (_, i) => `${String(i + 6).padStart(2, '0')}:00`);
  const dayBookings = S.bookings.filter((b) => b.date === calDate && ['pending', 'confirmed', 'completed'].includes(b.status));
  main().innerHTML = `<section class="${CARD} overflow-hidden">
    ${sectionTitle(`Lịch sân ngày ${dateText(calDate)}`, `<span class="text-xs text-foreground-500">Bấm ô đã đặt để xem chi tiết · Bấm ô trống để đặt nhanh · Bấm ô khóa để mở khóa</span>`)}
    <div class="overflow-x-auto"><table class="w-full min-w-[900px] border-collapse text-xs">
      <thead class="bg-background-100 text-foreground-600"><tr><th class="border border-background-200 px-3 py-2.5 text-left w-48">Sân</th>${hours.map((h) => `<th class="border border-background-200 px-1.5 py-2 text-center">${h.slice(0, 2)}h</th>`).join('')}</tr></thead>
      <tbody>${S.courts.map((c) => {
        const blk = new Set(S.blocked[`${c.id}:${calDate}`] || []);
        return `<tr><td class="border border-background-200 px-3 py-2.5 font-semibold text-foreground-950">${esc(c.name)}<span class="block text-[10px] font-normal text-foreground-500">${esc(c.area)}</span></td>${hours.map((h) => {
          const b = dayBookings.find((x) => x.courtId === c.id && (x.slots || []).includes(h));
          if (b) {
            const cls = b.status === 'pending' ? 'bg-accent-100 text-accent-900 border-accent-300' : 'bg-primary-100 text-primary-900 border-primary-300';
            return `<td class="border border-background-200 p-1"><button type="button" data-cal-b="${b.id}" title="${esc(b.customerName)} · ${esc(b.code)}" class="w-full cursor-pointer truncate rounded border px-1 py-1.5 text-[10px] font-bold ${cls}">${esc((b.customerName || '').split(' ').pop())}</button></td>`;
          }
          if (blk.has(h)) return `<td class="border border-background-200 bg-rose-50 p-1 text-center text-[10px] text-rose-700 font-semibold" title="Đang khóa bảo trì — Bấm để mở khóa"><button type="button" data-cal-unblock="${c.id}:${calDate}:${h}" class="w-full h-full rounded py-1 hover:bg-rose-100 transition-colors cursor-pointer"><i class="ri-lock-line"></i></button></td>`;
          return `<td class="border border-background-200 p-1 text-center"><button type="button" data-cal-empty="${c.id}:${calDate}:${h}" title="Ô trống · Bấm để đặt tại quầy khung ${h}" class="w-full h-full rounded py-1 text-foreground-400 hover:bg-primary-50 hover:text-primary-700 hover:font-bold transition-colors cursor-pointer">·</button></td>`;
        }).join('')}</tr>`;
      }).join('')}</tbody>
    </table></div>
  </section>`;
  on(main(), 'click', '[data-cal-b]', (e, el) => {
    const b = S.bookings.find((x) => x.id === el.dataset.calB);
    if (b) openBookingDetail(b);
  });
  on(main(), 'click', '[data-cal-empty]', (e, el) => {
    const [cId, d, h] = el.dataset.calEmpty.split(':');
    openCounterBooking({ courtId: cId, date: d, slots: [h] });
  });
  on(main(), 'click', '[data-cal-unblock]', async (e, el) => {
    const [cId, d, h] = el.dataset.calUnblock.split(':');
    const c = courtById(cId);
    if (!await confirmBox({
      title: 'Mở khóa khung giờ này?',
      message: `Mở khóa sân "${c ? esc(c.name) : cId}" khung giờ ${h} ngày ${dateText(d)}? Sau khi mở, khách hàng có thể đặt sân bình thường.`,
      confirmText: 'Mở khóa',
    })) return;
    try {
      const res = await api('owner', 'block_slots', { courtId: cId, date: d, slots: [h], blocked: false });
      if (res.blocked) S.blocked = res.blocked;
      if (res.list) S.blockedList = res.list;
      if (res.courtBlocked) S.blocked[`${cId}:${d}`] = res.courtBlocked;
      toast(`Đã mở khóa khung ${h} ngày ${dateText(d)}.`);
      renderSitemapBookings();
    } catch (err) { toast(err.message, 'error'); }
  });
}

async function renderOwnerRecurring() {
  main().innerHTML = loadingBlock('Đang tải danh sách lịch cố định...');
  actions().innerHTML = `<button type="button" id="ow-rec-add" class="${BTN}"><i class="ri-add-line"></i>Tạo lịch cố định</button>`;
  const list = await api('owner', 'recurring_list').catch(() => []);
  actions().querySelector('#ow-rec-add').onclick = () => openOwnerRecurringModal();
  const stBadge = { active: ['Đang hoạt động', 'bg-primary-50 text-primary-700'], paused: ['Tạm dừng', 'bg-accent-50 text-accent-800'], cancelled: ['Đã hủy', 'bg-background-200 text-foreground-600'] };
  main().innerHTML = `<section class="${CARD} overflow-hidden">
    ${sectionTitle(`Lịch cố định (${list.length})`, '<span class="text-xs text-foreground-500">Khách đặt cố định theo thứ trong tuần</span>')}
    ${list.length ? `<div class="divide-y divide-background-200">${list.map((r) => {
      const [lbl, cls] = stBadge[r.status] || stBadge.active;
      return `<div class="flex flex-wrap items-center justify-between gap-3 px-4 py-3.5">
        <div class="min-w-0">
          <p class="flex flex-wrap items-center gap-2 text-sm font-bold text-foreground-950">${esc(r.customerName)} <span class="font-normal text-foreground-500">(${esc(r.customerPhone || '—')})</span><span class="rounded-full px-2 py-0.5 text-[10px] font-bold ${cls}">${lbl}</span></p>
          <p class="mt-0.5 text-xs text-foreground-700"><b>${esc(r.courtName)}</b> · ${(r.weekdays || []).map((d) => WEEKDAY_SHORT[d]).join(', ')} · ${esc(r.startSlot)} (${r.durationMinutes}p) · ${money(r.pricePerSession)}/buổi</p>
          <p class="mt-0.5 text-[11px] text-foreground-500">${dateText(r.startDate)} – ${dateText(r.endDate)}${r.note ? ` · ${esc(r.note)}` : ''}</p>
        </div>
        <div class="flex items-center gap-1.5">
          ${r.status === 'active' ? `<button type="button" data-ow-rec-st="${r.id}:paused" class="${BTN_SM}">Tạm dừng</button>` : r.status === 'paused' ? `<button type="button" data-ow-rec-st="${r.id}:active" class="${BTN_SM_PRI}">Mở lại</button>` : ''}
          ${r.status !== 'cancelled' ? `<button type="button" data-ow-rec-st="${r.id}:cancelled" class="${BTN_SM_DANGER}">Hủy</button>` : ''}
        </div>
      </div>`;
    }).join('')}</div>` : `<div class="p-6">${emptyState('ri-calendar-2-line', 'Chưa có lịch cố định', 'Tạo lịch cố định cho các đội bóng/nhóm cầu lông đánh hàng tuần.')}</div>`}
  </section>`;
  on(main(), 'click', '[data-ow-rec-st]', async (e, el) => {
    const [id, status] = el.dataset.owRecSt.split(':');
    await api('owner', 'recurring_status', { id, status });
    toast('Đã cập nhật trạng thái lịch cố định.');
    renderSitemapBookings();
  });
}

function openOwnerRecurringModal() {
  const nextMonth = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
  const m = modal('Tạo lịch cố định mới', `<form id="ow-rec-form" class="space-y-3">
    <div><label class="${LABEL}">Sân</label><select name="courtId" class="${INPUT}">${S.courts.map((c) => `<option value="${esc(c.id)}">${esc(c.name)}</option>`).join('')}</select></div>
    <div class="grid grid-cols-2 gap-3">
      <div><label class="${LABEL}">Tên khách / đội bóng *</label><input name="customerName" class="${INPUT}" placeholder="FC Ea Tam"></div>
      <div><label class="${LABEL}">Số điện thoại</label><input name="customerPhone" class="${INPUT}" placeholder="0912345678"></div>
    </div>
    <div><label class="${LABEL}">Các ngày trong tuần</label><div class="flex flex-wrap gap-2">${[1,2,3,4,5,6,7].map((d) => `<label class="inline-flex items-center gap-1.5 rounded border border-background-300 px-2.5 py-1 text-xs font-semibold"><input type="checkbox" name="wd" value="${d}" ${d === 2 || d === 5 ? 'checked' : ''} class="accent-primary-500">${WEEKDAY_SHORT[d]}</label>`).join('')}</div></div>
    <div class="grid grid-cols-3 gap-2">
      <div><label class="${LABEL}">Giờ bắt đầu</label><select name="startSlot" class="${INPUT}">${['06:00','07:00','16:00','17:00','18:00','19:00','20:00','21:00'].map((t) => `<option ${t === '18:00' ? 'selected' : ''}>${t}</option>`).join('')}</select></div>
      <div><label class="${LABEL}">Thời lượng</label><select name="durationMinutes" class="${INPUT}"><option value="60">60 phút</option><option value="90">90 phút</option><option value="120" selected>120 phút</option></select></div>
      <div><label class="${LABEL}">Giá / buổi (đ)</label><input type="number" name="pricePerSession" class="${INPUT}" placeholder="Tự tính"></div>
    </div>
    <div class="grid grid-cols-2 gap-3">
      <div><label class="${LABEL}">Từ ngày</label><input type="date" name="startDate" value="${TODAY}" class="${INPUT}"></div>
      <div><label class="${LABEL}">Đến ngày</label><input type="date" name="endDate" value="${nextMonth}" class="${INPUT}"></div>
    </div>
    <div><label class="${LABEL}">Ghi chú</label><input name="note" class="${INPUT}" placeholder="Ghi chú đội cố định..."></div>
  </form>`, `<button type="button" data-close class="${BTN_OUT}">Hủy</button><button type="button" data-ok class="${BTN}">Lưu lịch cố định</button>`, 'max-w-lg');
  m.el.querySelector('[data-ok]').onclick = async (e) => {
    const f = m.el.querySelector('#ow-rec-form');
    const weekdays = [...f.querySelectorAll('[name=wd]:checked')].map((i) => Number(i.value));
    setBusy(e.currentTarget, true, 'Đang lưu...');
    try {
      await api('owner', 'recurring_save', { ...formData(f), weekdays, durationMinutes: Number(f.durationMinutes.value), pricePerSession: Number(f.pricePerSession.value) || 0 });
      m.close();
      toast('Đã tạo lịch cố định.');
      renderSitemapBookings();
    } catch (err) {
      setBusy(e.currentTarget, false);
      toast(err.message, 'error');
    }
  };
}

// =====================================================================
// 4. THANH TOÁN (Hóa đơn, Lịch sử thanh toán & Yêu cầu hoàn tiền)
// =====================================================================
export async function renderSitemapPayments() {
  const sub = getSub('payments', 'invoices');
  actions().innerHTML = '';
  if (sub === 'invoices') {
    await renderInvoices();
  } else {
    await renderDeposits();
  }
  mountSubBar(
    'payments',
    [
      ['invoices', 'Hóa đơn & Chi tiết hóa đơn', 'ri-bill-line'],
      ['refunds', 'Lịch sử thanh toán & Yêu cầu hoàn tiền', 'ri-safe-2-line'],
    ],
    sub,
    renderSitemapPayments,
  );
}

// =====================================================================
// 5. DỊCH VỤ (Quản lý dịch vụ, Nhập kho, Tồn kho)
// =====================================================================
export async function renderSitemapServices() {
  const sub = getSub('services', 'manage');
  actions().innerHTML = '';
  if (sub === 'manage') {
    await renderServices();
  } else {
    await renderInventoryView(sub);
  }
  mountSubBar(
    'services',
    [
      ['manage', 'Quản lý dịch vụ', 'ri-cup-line'],
      ['import', 'Nhập kho', 'ri-inbox-archive-line'],
      ['stock', 'Tồn kho', 'ri-stack-line'],
    ],
    sub,
    renderSitemapServices,
  );
}

async function renderInventoryView(mode) {
  main().innerHTML = loadingBlock('Đang tải dữ liệu kho dịch vụ...');
  const [services, logs] = await Promise.all([api('owner', 'services').catch(() => []), api('owner', 'inventory_logs').catch(() => [])]);
  const lowStock = services.filter((s) => s.stock <= 10);
  const typeLabel = { import: ['Nhập kho', 'bg-primary-50 text-primary-700', '+'], export: ['Xuất kho', 'bg-accent-50 text-accent-800', '-'], adjust: ['Kiểm kê', 'bg-secondary-50 text-secondary-800', '='] };

  if (mode === 'import') {
    const serviceOptions = services.map((s) => {
      if (s.hasVariants && s.variants && s.variants.length > 0) {
        return `<optgroup label="${esc(s.name)} (Đa thuộc tính)">
          ${s.variants.map((v) => `<option value="${esc(s.id)}:::${esc(v.id)}">${esc(s.name)} — ${esc(v.name)} (Tồn: ${v.stock} ${esc(s.unit)})</option>`).join('')}
        </optgroup>`;
      }
      return `<option value="${esc(s.id)}:::">${esc(s.name)} (Tồn: ${s.stock} ${esc(s.unit)})</option>`;
    }).join('');

    main().innerHTML = `<div class="grid grid-cols-1 gap-5 lg:grid-cols-[380px_1fr]">
      <form id="inv-form" class="${CARD} p-5 space-y-3.5 h-fit">
        <h3 class="font-heading text-base font-bold text-foreground-950">Tạo phiếu nhập / xuất kho</h3>
        <div>
          <label class="${LABEL}">Dịch vụ / mặt hàng &amp; Phân loại</label>
          <select name="serviceIdCombined" class="${INPUT}">${serviceOptions}</select>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div><label class="${LABEL}">Loại phiếu</label><select name="type" class="${INPUT}"><option value="import">Nhập kho (+)</option><option value="export">Xuất kho (-)</option><option value="adjust">Đặt lại số tồn (=)</option></select></div>
          <div><label class="${LABEL}">Số lượng</label><input type="number" name="quantity" min="1" value="24" class="${INPUT}"></div>
        </div>
        <div><label class="${LABEL}">Đơn giá nhập (đ)</label><input type="number" name="unitCost" min="0" step="500" value="0" class="${INPUT}"></div>
        <div><label class="${LABEL}">Ghi chú phiếu kho</label><input name="note" class="${INPUT}" placeholder="Nhà cung cấp, số hóa đơn..."></div>
        <button type="submit" class="${BTN} w-full justify-center"><i class="ri-save-line"></i>Lưu phiếu &amp; Cập nhật tồn kho</button>
      </form>
      <section class="${CARD} overflow-hidden">
        ${sectionTitle(`Lịch sử nhập / xuất kho (${logs.length})`)}
        ${logs.length ? `<div class="divide-y divide-background-200">${logs.map((l) => {
          const [lbl, cls, sign] = typeLabel[l.type] || typeLabel.import;
          return `<div class="flex items-center justify-between gap-3 px-4 py-3 text-sm">
            <div class="min-w-0"><p class="font-semibold text-foreground-950">${esc(l.serviceName)} <span class="ml-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${cls}">${lbl}</span></p><p class="text-xs text-foreground-500">${formatDateTime(l.createdAt)}${l.note ? ` · ${esc(l.note)}` : ''}</p></div>
            <div class="text-right shrink-0"><p class="font-heading text-base font-extrabold text-primary-700">${sign}${l.quantity}</p>${l.unitCost ? `<p class="text-[11px] text-foreground-500">${money(l.unitCost)}/đv</p>` : ''}</div>
          </div>`;
        }).join('')}</div>` : `<div class="p-6">${emptyState('ri-inbox-archive-line', 'Chưa có phiếu kho nào')}</div>`}
      </section>
    </div>`;
    main().querySelector('#inv-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const f = formData(e.target);
      const [serviceId, variantId] = (f.serviceIdCombined || '').split(':::');
      try {
        await api('owner', 'inventory_adjust', {
          serviceId,
          variantId: variantId || '',
          type: f.type,
          quantity: Number(f.quantity),
          unitCost: Number(f.unitCost) || 0,
          note: f.note || '',
        });
        toast('Đã cập nhật phiếu kho & số tồn!');
        renderSitemapServices();
      } catch (err) { toast(err.message, 'error'); }
    });
  } else {
    main().innerHTML = `
    <div class="grid grid-cols-2 gap-3 lg:grid-cols-3 mb-5">
      ${statCard('ri-stack-line', 'Tổng mặt hàng', services.length)}
      ${statCard('ri-error-warning-line', 'Sắp hết hàng (≤10)', lowStock.length, 'Cần nhập kho sớm', 'accent')}
      ${statCard('ri-money-dollar-circle-line', 'Giá trị tồn kho ước tính', money(services.reduce((s, x) => s + x.stock * x.price, 0)), '', 'secondary')}
    </div>
    <section class="${CARD} overflow-hidden">
      ${sectionTitle('Bảng kiểm soát tồn kho hiện tại')}
      <div class="overflow-x-auto"><table class="w-full min-w-[600px] text-sm">
        <thead class="bg-background-100 text-left text-xs font-semibold uppercase text-foreground-500"><tr><th class="px-4 py-3">Mặt hàng</th><th class="px-4 py-3 text-right">Giá bán</th><th class="px-4 py-3 text-right">Tồn kho</th><th class="px-4 py-3">Tình trạng</th></tr></thead>
        <tbody class="divide-y divide-background-200">${services.map((s) => {
          const hasVars = s.hasVariants && s.variants && s.variants.length > 0;
          return `
            <tr>
              <td class="px-4 py-3 font-semibold">
                <div class="flex items-center gap-1.5">
                  <span>${esc(s.name)}</span>
                  ${hasVars ? `<span class="rounded bg-primary-100 px-1.5 py-0.5 text-[10px] font-bold text-primary-800">${s.variants.length} phân loại</span>` : ''}
                </div>
                <span class="text-xs font-normal text-foreground-500">(${esc(s.unit)})</span>
              </td>
              <td class="px-4 py-3 text-right">${hasVars ? `<span class="text-xs text-foreground-500">từ </span>` : ''}${money(s.price)}</td>
              <td class="px-4 py-3 text-right font-heading font-extrabold ${s.stock <= 10 ? 'text-accent-700' : 'text-primary-700'}">${s.stock}</td>
              <td class="px-4 py-3">${s.stock === 0 ? '<span class="rounded-full bg-accent-100 px-2 py-0.5 text-[11px] font-bold text-accent-800">Hết hàng</span>' : s.stock <= 10 ? '<span class="rounded-full bg-accent-50 px-2 py-0.5 text-[11px] font-bold text-accent-700">Sắp hết</span>' : '<span class="rounded-full bg-primary-50 px-2 py-0.5 text-[11px] font-bold text-primary-700">Đủ hàng</span>'}</td>
            </tr>
            ${hasVars ? s.variants.map((v) => `
              <tr class="bg-background-50/60 text-xs">
                <td class="px-4 py-2 pl-8 text-foreground-700 flex items-center gap-1.5">
                  <i class="ri-corner-down-right-line text-foreground-400"></i>
                  <b>${esc(v.name)}</b>
                  <span class="font-mono text-[10px] text-foreground-400">(${esc(v.sku || 'N/A')})</span>
                </td>
                <td class="px-4 py-2 text-right text-foreground-700">${money(v.price)}</td>
                <td class="px-4 py-2 text-right font-bold ${v.stock <= 5 ? 'text-accent-700' : 'text-foreground-800'}">${v.stock}</td>
                <td class="px-4 py-2 text-foreground-500">${v.stock === 0 ? 'Hết' : v.stock <= 5 ? 'Ít hàng' : 'Sẵn sàng'}</td>
              </tr>
            `).join('') : ''}
          `;
        }).join('')}</tbody>
      </table></div>
    </section>`;
  }
}

// =====================================================================
// 6. KHUYẾN MÃI (Mã giảm giá & Ưu đãi giờ vàng)
// =====================================================================
export async function renderSitemapPromotions() {
  const sub = getSub('promotions', 'codes');
  actions().innerHTML = '';
  if (sub === 'codes') {
    await renderPromotions();
  } else {
    main().innerHTML = loadingBlock('Đang tải ưu đãi giờ vàng...');
    const data = await api('owner', 'promotions').catch(() => ({ promotions: [] }));
    const golden = (data.promotions || []).filter((p) => p.startTime && p.endTime);
    actions().innerHTML = `<button type="button" id="ow-golden-new" class="${BTN}"><i class="ri-sun-line"></i>Tạo ưu đãi giờ vàng</button>`;
    actions().querySelector('#ow-golden-new').onclick = () => {
      const m = modal('Tạo ưu đãi giờ vàng (thấp điểm)', `<form id="golden-form" class="space-y-3">
        <div class="grid grid-cols-2 gap-3">
          <div><label class="${LABEL}">Mã ưu đãi *</label><input name="code" class="${INPUT} uppercase" placeholder="GIOVANG20"></div>
          <div><label class="${LABEL}">Giảm (%)</label><input type="number" name="discountValue" min="5" max="80" value="20" class="${INPUT}"></div>
        </div>
        <div><label class="${LABEL}">Tên chương trình *</label><input name="title" class="${INPUT}" value="Ưu đãi giờ vàng sáng – chiều"></div>
        <div class="grid grid-cols-2 gap-3">
          <div><label class="${LABEL}">Từ giờ</label><input type="time" name="startTime" value="08:00" class="${INPUT}"></div>
          <div><label class="${LABEL}">Đến giờ</label><input type="time" name="endTime" value="15:00" class="${INPUT}"></div>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div><label class="${LABEL}">Ngày bắt đầu</label><input type="date" name="startDate" value="${TODAY}" class="${INPUT}"></div>
          <div><label class="${LABEL}">Ngày kết thúc</label><input type="date" name="endDate" value="${new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10)}" class="${INPUT}"></div>
        </div>
      </form>`, `<button type="button" data-close class="${BTN_OUT}">Hủy</button><button type="button" data-ok class="${BTN}">Tạo ưu đãi</button>`, 'max-w-lg');
      m.el.querySelector('[data-ok]').onclick = async () => {
        const f = formData(m.el.querySelector('#golden-form'));
        try {
          await api('owner', 'promotion_save', { ...f, discountType: 'percent', discountValue: Number(f.discountValue), weekdays: [1,2,3,4,5], status: 'active' });
          m.close();
          toast('Đã tạo ưu đãi giờ vàng!');
          renderSitemapPromotions();
        } catch (err) { toast(err.message, 'error'); }
      };
    };
    main().innerHTML = `<section class="${CARD} overflow-hidden">
      ${sectionTitle(`Chương trình ưu đãi giờ vàng (${golden.length})`, '<span class="text-xs text-foreground-500">Tự động áp dụng theo khung giờ thấp điểm</span>')}
      ${golden.length ? `<div class="divide-y divide-background-200">${golden.map((p) => `<div class="flex flex-wrap items-center justify-between gap-3 px-4 py-3.5">
        <div><p class="font-bold text-foreground-950"><span class="mr-2 rounded bg-accent-50 px-2 py-0.5 font-mono text-xs text-accent-800">${esc(p.code)}</span>${esc(p.title)}</p>
        <p class="mt-1 text-xs text-foreground-600"><i class="ri-time-line text-accent-600 mr-1"></i>Khung giờ vàng: <b>${esc(p.startTime)} – ${esc(p.endTime)}</b> · Giảm <b>${p.discountType === 'percent' ? `${p.discountValue}%` : money(p.discountValue)}</b> · ${dateText(p.startDate)} – ${dateText(p.endDate)}</p></div>
        <span class="rounded-full px-2.5 py-0.5 text-xs font-bold ${p.status === 'active' ? 'bg-primary-50 text-primary-700' : 'bg-background-200 text-foreground-600'}">${p.status === 'active' ? 'Đang chạy' : 'Tạm dừng'}</span>
      </div>`).join('')}</div>` : `<div class="p-6">${emptyState('ri-sun-line', 'Chưa có ưu đãi giờ vàng', 'Bấm "Tạo ưu đãi giờ vàng" để kích cầu các khung giờ thấp điểm 08:00 – 15:00.')}</div>`}
    </section>`;
  }
  mountSubBar(
    'promotions',
    [
      ['codes', 'Mã giảm giá', 'ri-coupon-3-line'],
      ['golden', 'Ưu đãi giờ vàng', 'ri-sun-line'],
    ],
    sub,
    renderSitemapPromotions,
  );
}

// =====================================================================
// 7. KHÁCH HÀNG & ĐÁNH GIÁ (Danh sách khách hàng, Đánh giá của khách, Khiếu nại)
// =====================================================================
export async function renderSitemapCustomers() {
  const sub = getSub('customers', 'list');
  actions().innerHTML = '';
  if (sub === 'list') {
    renderCustomers();
  } else if (sub === 'reviews') {
    await renderReviews();
  } else {
    main().innerHTML = loadingBlock('Đang tải danh sách khiếu nại...');
    const list = await api('owner', 'complaints').catch(() => []);
    const stLbl = { open: ['Mới tiếp nhận', 'bg-accent-100 text-accent-800'], reviewing: ['Đang xử lý', 'bg-secondary-100 text-secondary-900'], resolved: ['Đã giải quyết', 'bg-primary-50 text-primary-700'], rejected: ['Đã đóng', 'bg-background-200 text-foreground-600'] };
    main().innerHTML = `<section class="${CARD} overflow-hidden">
      ${sectionTitle(`Khiếu nại & phản ánh (${list.length})`)}
      ${list.length ? `<div class="divide-y divide-background-200">${list.map((r) => {
        const [lbl, cls] = stLbl[r.status] || stLbl.open;
        return `<div class="p-4 flex flex-col sm:flex-row sm:items-start justify-between gap-3">
          <div class="min-w-0">
            <p class="flex flex-wrap items-center gap-2 text-sm font-bold text-foreground-950">${esc(r.reason)}<span class="rounded-full px-2 py-0.5 text-[10px] font-bold ${cls}">${lbl}</span></p>
            <p class="mt-1 text-xs text-foreground-600">Đối tượng: <b>${esc(r.targetLabel)}</b> · Người gửi: ${esc(r.reporterName || 'Khách hàng')} (${esc(r.reporterContact || '—')})</p>
            ${r.detail ? `<p class="mt-1 text-xs text-foreground-700">${esc(r.detail)}</p>` : ''}
            ${r.resolutionNote ? `<p class="mt-2 rounded bg-primary-50 px-3 py-1.5 text-xs text-primary-800"><b>Phản hồi xử lý:</b> ${esc(r.resolutionNote)}</p>` : ''}
          </div>
          <button type="button" data-ow-comp="${r.id}" class="${BTN_SM} shrink-0"><i class="ri-reply-line"></i>Phản hồi</button>
        </div>`;
      }).join('')}</div>` : `<div class="p-6">${emptyState('ri-shield-check-line', 'Không có khiếu nại nào', 'Cơ sở của bạn hiện không ghi nhận khiếu nại từ khách hàng.')}</div>`}
    </section>`;
    on(main(), 'click', '[data-ow-comp]', (e, el) => {
      const m = modal('Phản hồi khiếu nại', `<textarea id="comp-note" rows="3" class="${INPUT}" placeholder="Nhập phương án xử lý / giải trình của chủ sân..."></textarea>`, `<button type="button" data-close class="${BTN_OUT}">Hủy</button><button type="button" data-ok class="${BTN}">Gửi phản hồi</button>`, 'max-w-md');
      m.el.querySelector('[data-ok]').onclick = async () => {
        try {
          await api('owner', 'complaint_reply', { id: el.dataset.owComp, note: m.el.querySelector('#comp-note').value });
          m.close();
          toast('Đã gửi phản hồi xử lý khiếu nại.');
          renderSitemapCustomers();
        } catch (err) { toast(err.message, 'error'); }
      };
    });
  }
  mountSubBar(
    'customers',
    [
      ['list', 'Danh sách khách hàng', 'ri-group-line'],
      ['reviews', 'Đánh giá của khách', 'ri-star-smile-line'],
      ['complaints', 'Khiếu nại', 'ri-feedback-line'],
    ],
    sub,
    renderSitemapCustomers,
  );
}

// =====================================================================
// 8. CÀI ĐẶT (Chính sách đặt/cọc/hủy, Nhân viên & phân quyền, Thông báo)
// =====================================================================
export async function renderSitemapSettings() {
  const sub = getSub('settings', 'policy');
  actions().innerHTML = '';
  main().innerHTML = loadingBlock('Đang tải cài đặt cơ sở...');
  if (sub === 'policy') {
    const cfg = await api('owner', 'settings_get').catch(() => ({ depositRate: 30, cancelCutoffHours: 4, holdMinutes: 5, autoApprove: false, policyNote: '' }));
    main().innerHTML = `<form id="ow-policy-form" class="${CARD} p-6 space-y-4 max-w-2xl">
      <h3 class="font-heading text-base font-bold text-foreground-950">Chính sách đặt sân, tiền cọc &amp; hủy sân</h3>
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div><label class="${LABEL}">Tỷ lệ cọc mặc định (%)</label><input type="number" name="depositRate" min="0" max="100" value="${cfg.depositRate}" class="${INPUT}"></div>
        <div><label class="${LABEL}">Mốc hủy miễn phí (giờ)</label><input type="number" name="cancelCutoffHours" min="1" max="48" value="${cfg.cancelCutoffHours}" class="${INPUT}"></div>
        <div><label class="${LABEL}">Giữ chỗ chờ cọc (phút)</label><input type="number" name="holdMinutes" min="1" max="30" value="${cfg.holdMinutes}" class="${INPUT}"></div>
      </div>
      <label class="flex cursor-pointer items-center gap-2 text-sm text-foreground-800"><input type="checkbox" name="autoApprove" ${cfg.autoApprove ? 'checked' : ''} class="h-4 w-4 accent-primary-500">Tự động duyệt đơn khi khung giờ còn trống</label>
      <div><label class="${LABEL}">Ghi chú chính sách riêng hiển thị cho khách</label><textarea name="policyNote" rows="3" class="${INPUT}">${esc(cfg.policyNote)}</textarea></div>
      <div class="flex justify-end"><button type="submit" class="${BTN}"><i class="ri-save-line"></i>Lưu chính sách</button></div>
    </form>`;
    main().querySelector('#ow-policy-form').onsubmit = async (e) => {
      e.preventDefault();
      const f = e.target;
      await api('owner', 'settings_save', { depositRate: Number(f.depositRate.value), cancelCutoffHours: Number(f.cancelCutoffHours.value), holdMinutes: Number(f.holdMinutes.value), autoApprove: f.autoApprove.checked, policyNote: f.policyNote.value });
      toast('Đã lưu chính sách cơ sở.');
    };
  } else {
    const [cfg, notifs] = await Promise.all([api('owner', 'settings_get').catch(() => ({})), api('account', 'notifications').catch(() => [])]);
    main().innerHTML = `<div class="grid grid-cols-1 gap-5 lg:grid-cols-2">
      <form id="ow-nt-form" class="${CARD} p-5 space-y-3 h-fit">
        <h3 class="font-heading text-base font-bold text-foreground-950">Cấu hình nhận thông báo</h3>
        <label class="flex items-center gap-2.5 text-sm"><input type="checkbox" name="notifyNewBooking" ${cfg.notifyNewBooking !== false ? 'checked' : ''} class="h-4 w-4 accent-primary-500">Thông báo khi có đơn đặt sân hoặc lịch cố định mới</label>
        <label class="flex items-center gap-2.5 text-sm"><input type="checkbox" name="notifyCancel" ${cfg.notifyCancel !== false ? 'checked' : ''} class="h-4 w-4 accent-primary-500">Thông báo khi khách hủy đơn hoặc yêu cầu hoàn tiền</label>
        <label class="flex items-center gap-2.5 text-sm"><input type="checkbox" name="notifyReview" ${cfg.notifyReview !== false ? 'checked' : ''} class="h-4 w-4 accent-primary-500">Thông báo khi có đánh giá mới từ khách hàng</label>
        <button type="submit" class="${BTN} mt-2"><i class="ri-save-line"></i>Lưu cấu hình thông báo</button>
      </form>
      <section class="${CARD} overflow-hidden">
        ${sectionTitle(`Thông báo gần đây (${notifs.length})`)}
        ${notifs.length ? `<div class="divide-y divide-background-200">${notifs.map((n) => `<div class="p-4 ${n.isRead ? '' : 'bg-primary-50/40'}"><p class="text-sm font-bold">${esc(n.title)}</p><p class="mt-0.5 text-xs text-foreground-600">${esc(n.body)}</p><p class="mt-1 text-[11px] text-foreground-400">${formatDateTime(n.createdAt)}</p></div>`).join('')}</div>` : `<div class="p-6">${emptyState('ri-notification-off-line', 'Chưa có thông báo')}</div>`}
      </section>
    </div>`;
    main().querySelector('#ow-nt-form').onsubmit = async (e) => {
      e.preventDefault();
      const f = e.target;
      await api('owner', 'settings_save', { notifyNewBooking: f.notifyNewBooking.checked, notifyCancel: f.notifyCancel.checked, notifyReview: f.notifyReview.checked });
      toast('Đã lưu cấu hình thông báo.');
    };
  }
  mountSubBar(
    'settings',
    [
      ['policy', 'Chính sách đặt, cọc, hủy', 'ri-shield-check-line'],
      ['notifications', 'Cấu hình thông báo', 'ri-notification-3-line'],
    ],
    sub,
    renderSitemapSettings,
  );
}

// =====================================================================
// 8B. QUẢN LÝ NHÂN VIÊN (Phân quyền & Tài khoản nhân viên cơ sở)
// =====================================================================
export async function renderSitemapStaff() {
  actions().innerHTML = `<button type="button" id="ow-staff-add" class="${BTN}"><i class="ri-user-add-line"></i>Thêm nhân viên</button>`;
  main().innerHTML = loadingBlock('Đang tải danh sách nhân viên...');

  const list = await api('owner', 'staff_list').catch(() => []);
  const PERMS = [
    ['bookings', 'Đơn đặt & Check-in', 'ri-calendar-check-line'],
    ['courts', 'Quản lý & khóa sân', 'ri-football-line'],
    ['services', 'Dịch vụ & kho nước', 'ri-cup-line'],
    ['payments', 'Thu ngân & hóa đơn', 'ri-money-dollar-circle-line'],
    ['promotions', 'Khuyến mãi & ưu đãi', 'ri-coupon-3-line'],
    ['customers', 'Khách hàng & đánh giá', 'ri-group-line'],
  ];

  let filterStatus = 'all';
  let searchText = '';

  const renderList = () => {
    const totalStaff = list.length;
    const activeStaff = list.filter((s) => s.status === 'active').length;
    const inactiveStaff = totalStaff - activeStaff;
    const hasPwdStaff = list.filter((s) => s.hasPassword).length;

    const filtered = list.filter((s) => {
      if (filterStatus !== 'all' && s.status !== filterStatus) return false;
      if (searchText) {
        const q = searchText.toLowerCase();
        const match = (s.fullName || '').toLowerCase().includes(q)
          || (s.email || '').toLowerCase().includes(q)
          || (s.phone || '').toLowerCase().includes(q)
          || (s.roleName || '').toLowerCase().includes(q);
        if (!match) return false;
      }
      return true;
    });

    main().innerHTML = `
      <div class="grid grid-cols-2 gap-3 lg:grid-cols-4 mb-5">
        ${statCard('ri-team-line', 'Tổng số nhân sự', totalStaff, 'Tài khoản nhân viên cơ sở')}
        ${statCard('ri-user-follow-line', 'Đang làm việc', activeStaff, 'Được phép đăng nhập', 'primary')}
        ${statCard('ri-user-unfollow-line', 'Tạm khóa / Nghỉ', inactiveStaff, 'Đang bị khóa quyền', inactiveStaff ? 'accent' : 'neutral')}
        ${statCard('ri-key-line', 'Đã cấp mật khẩu', hasPwdStaff, 'Có thể vào kênh làm việc', 'secondary')}
      </div>

      <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div class="flex flex-wrap items-center gap-2">
          <button type="button" data-f-status="all" class="${chip(filterStatus === 'all')}">Tất cả (${totalStaff})</button>
          <button type="button" data-f-status="active" class="${chip(filterStatus === 'active')}">Đang làm việc (${activeStaff})</button>
          <button type="button" data-f-status="inactive" class="${chip(filterStatus === 'inactive')}">Tạm khóa (${inactiveStaff})</button>
        </div>
        <div class="w-full sm:w-72">
          <div class="relative">
            <i class="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-foreground-400"></i>
            <input type="search" id="ow-st-search" value="${esc(searchText)}" placeholder="Tìm theo tên, email, SĐT..." class="${INPUT} pl-9 py-2 text-xs">
          </div>
        </div>
      </div>

      <section class="${CARD} overflow-hidden">
        ${sectionTitle(`<i class="ri-team-line text-primary-600 mr-1.5"></i>Danh sách nhân viên cơ sở (${filtered.length})`)}
        ${filtered.length ? `<div class="divide-y divide-background-200">${filtered.map((s) => {
          const initials = (s.fullName || 'NV').split(' ').map(w => w[0]).slice(-2).join('').toUpperCase();
          return `
            <div class="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between transition-colors hover:bg-background-50/60">
              <div class="flex items-start gap-3 min-w-0">
                <span class="flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${s.status === 'active' ? 'bg-primary-600 text-white' : 'bg-background-300 text-foreground-600'} text-sm font-bold shadow-sm">
                  ${esc(initials)}
                </span>
                <div class="min-w-0">
                  <div class="flex flex-wrap items-center gap-2">
                    <p class="font-heading text-sm font-bold text-foreground-950">${esc(s.fullName)}</p>
                    <span class="rounded bg-background-100 px-2 py-0.5 text-[11px] font-semibold text-foreground-700">${esc(s.roleName)}</span>
                    ${s.status === 'active' 
                      ? '<span class="inline-flex items-center gap-1 rounded-full bg-primary-50 px-2 py-0.5 text-[10px] font-bold text-primary-700"><span class="h-1.5 w-1.5 rounded-full bg-primary-500 animate-pulse"></span>Đang làm việc</span>' 
                      : '<span class="rounded-full bg-accent-100 px-2 py-0.5 text-[10px] font-bold text-accent-800">Tạm khóa</span>'}
                  </div>
                  <div class="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-foreground-500">
                    <span class="flex items-center gap-1"><i class="ri-mail-line text-foreground-400"></i> ${esc(s.email || '—')}</span>
                    ${s.phone ? `<span class="flex items-center gap-1">· <i class="ri-phone-line text-foreground-400"></i> <a href="tel:${esc(s.phone)}" class="text-primary-700 hover:underline">${esc(s.phone)}</a></span>` : ''}
                    <span class="flex items-center gap-1">· <i class="ri-key-line ${s.hasPassword ? 'text-primary-600' : 'text-accent-500'}"></i> ${s.hasPassword ? '<span class="text-foreground-600">Đã cấp mật khẩu</span>' : '<span class="text-accent-600 font-medium">Chưa có mật khẩu</span>'}</span>
                  </div>
                  <div class="mt-2 flex flex-wrap gap-1.5">
                    ${(s.permissions || []).map((k) => {
                      const p = PERMS.find((x) => x[0] === k);
                      return `<span class="inline-flex items-center gap-1 rounded bg-primary-50/80 border border-primary-200/50 px-2 py-0.5 text-[10px] font-semibold text-primary-800"><i class="${p ? p[2] : 'ri-check-line'} text-[11px]"></i>${p ? p[1] : k}</span>`;
                    }).join('')}
                  </div>
                </div>
              </div>
              <div class="flex items-center gap-1.5 sm:self-center shrink-0">
                <button type="button" data-st-edit="${s.id}" class="${BTN_SM}" title="Chỉnh sửa thông tin & phân quyền"><i class="ri-edit-line"></i>Sửa</button>
                <button type="button" data-st-pwd="${s.id}" class="${BTN_SM}" title="Đổi hoặc cấp mật khẩu mới"><i class="ri-key-2-line text-primary-600"></i>Đổi pass</button>
                ${s.status === 'active'
                  ? `<button type="button" data-st-toggle="${s.id}" class="${BTN_SM_DANGER}" title="Tạm khóa quyền đăng nhập"><i class="ri-lock-line"></i>Khóa</button>`
                  : `<button type="button" data-st-toggle="${s.id}" class="${BTN_SM}" title="Mở khóa cho nhân viên làm việc"><i class="ri-lock-unlock-line text-primary-600"></i>Mở</button>`}
                <button type="button" data-st-del="${s.id}" class="${BTN_SM_DANGER} !bg-accent-700 hover:!bg-accent-800 text-white" title="Xóa nhân viên"><i class="ri-delete-bin-line"></i></button>
              </div>
            </div>`;
        }).join('')}</div>` : `<div class="p-8 text-center">${emptyState('ri-team-line', 'Không tìm thấy nhân viên nào phù hợp', 'Bạn có thể bấm nút "Thêm nhân viên" ở trên để tạo tài khoản mới.')}</div>`}
      </section>
    `;

    const searchInput = main().querySelector('#ow-st-search');
    if (searchInput) {
      searchInput.oninput = (e) => {
        searchText = e.target.value.trim();
        renderList();
      };
    }
  };

  const openStaffModal = (s = null) => {
    const m = modal(s ? 'Sửa thông tin nhân viên' : 'Thêm tài khoản nhân viên cơ sở', `<form id="st-form" class="space-y-3.5">
      <div class="grid grid-cols-2 gap-3">
        <div><label class="${LABEL}">Họ và tên *</label><input name="fullName" value="${esc(s?.fullName || '')}" required class="${INPUT}" placeholder="Nguyễn Văn A"></div>
        <div><label class="${LABEL}">Chức vụ / Vị trí</label><input name="roleName" value="${esc(s?.roleName || 'Nhân viên lễ tân')}" class="${INPUT}" placeholder="Lễ tân ca tối"></div>
      </div>
      <div class="grid grid-cols-2 gap-3">
        <div><label class="${LABEL}">Số điện thoại</label><input name="phone" value="${esc(s?.phone || '')}" class="${INPUT}" placeholder="09xx xxx xxx"></div>
        <div><label class="${LABEL}">Email đăng nhập *</label><input type="email" name="email" value="${esc(s?.email || '')}" required class="${INPUT}" placeholder="nhanvien@sanbong.vn"></div>
      </div>
      <div class="rounded-lg border border-background-200 bg-background-50 p-3">
        <label class="${LABEL} flex items-center justify-between">
          <span><i class="ri-lock-password-line text-primary-600 mr-1"></i>Mật khẩu đăng nhập ${s ? '<span class="text-xs font-normal text-foreground-500">(để trống nếu giữ nguyên)</span>' : '*'}</span>
        </label>
        <input type="password" name="password" minlength="6" ${s ? '' : 'required'} class="${INPUT} mt-1 bg-white" placeholder="${s ? 'Nhập mật khẩu mới nếu muốn đổi' : 'Tối thiểu 6 ký tự (vd: 123456)'}">
        <p class="mt-1.5 text-[11px] text-foreground-500">Nhân viên sẽ sử dụng Email và Mật khẩu này để đăng nhập trực tiếp tại trang <b>/dang-nhap</b>.</p>
      </div>
      <div>
        <label class="${LABEL}">Phân quyền thao tác</label>
        <div class="grid grid-cols-2 gap-2 mt-1">
          ${PERMS.map(([k, l, icon]) => `<label class="inline-flex items-center gap-2 rounded border border-background-300 bg-white p-2 text-xs font-medium hover:border-primary-400 cursor-pointer transition-colors">
            <input type="checkbox" name="perm" value="${k}" ${(s?.permissions || ['bookings', 'services']).includes(k) ? 'checked' : ''} class="h-4 w-4 rounded accent-primary-600">
            <span class="flex items-center gap-1.5"><i class="${icon} text-primary-600"></i>${l}</span>
          </label>`).join('')}
        </div>
        <p class="mt-1 text-[11px] text-foreground-400 italic">Lưu ý: Nhân viên tuyệt đối không thể xem số tài khoản nhận tiền cọc VietQR và cài đặt tài chính của chủ sân.</p>
      </div>
      <div>
        <label class="${LABEL}">Trạng thái làm việc</label>
        <select name="status" class="${INPUT}">
          <option value="active" ${!s || s.status === 'active' ? 'selected' : ''}>🟢 Đang làm việc (Được phép đăng nhập)</option>
          <option value="inactive" ${s?.status === 'inactive' ? 'selected' : ''}>🔴 Tạm nghỉ / Khóa đăng nhập</option>
        </select>
      </div>
    </form>`, `<button type="button" data-close class="${BTN_OUT}">Hủy</button><button type="button" data-ok class="${BTN}">Lưu tài khoản nhân viên</button>`, 'max-w-lg');

    m.el.querySelector('[data-ok]').onclick = async () => {
      const f = m.el.querySelector('#st-form');
      if (!f.reportValidity()) return;
      const permissions = [...f.querySelectorAll('[name=perm]:checked')].map((i) => i.value);
      if (!permissions.length) {
        toast('Vui lòng chọn ít nhất 1 quyền thao tác cho nhân viên.', 'warning');
        return;
      }
      try {
        await api('owner', 'staff_save', { ...formData(f), id: s?.id || '', permissions });
        m.close();
        toast(s ? 'Đã cập nhật thông tin nhân viên.' : 'Đã tạo tài khoản nhân viên thành công.');
        renderSitemapStaff();
      } catch (err) { toast(err.message, 'error'); }
    };
  };

  const openResetPasswordModal = (s) => {
    const m = modal(`Cấp mật khẩu mới cho ${esc(s.fullName)}`, `<form id="st-pwd-form" class="space-y-3">
      <p class="text-xs text-foreground-600">Đặt mật khẩu mới cho tài khoản đăng nhập <b>${esc(s.email)}</b>:</p>
      <div>
        <label class="${LABEL}">Mật khẩu mới *</label>
        <input type="password" name="password" minlength="6" required class="${INPUT}" placeholder="Tối thiểu 6 ký tự (vd: 123456)">
      </div>
      <p class="text-[11px] text-foreground-400">Sau khi lưu, nhân viên sẽ dùng ngay mật khẩu này để đăng nhập vào Kênh chủ sân.</p>
    </form>`, `<button type="button" data-close class="${BTN_OUT}">Hủy</button><button type="button" data-ok class="${BTN}">Cập nhật mật khẩu</button>`, 'max-w-md');

    m.el.querySelector('[data-ok]').onclick = async () => {
      const f = m.el.querySelector('#st-pwd-form');
      if (!f.reportValidity()) return;
      const pwd = f.password.value;
      try {
        await api('owner', 'staff_save', { id: s.id, fullName: s.fullName, roleName: s.roleName, phone: s.phone, email: s.email, status: s.status, permissions: s.permissions, password: pwd });
        m.close();
        toast(`Đã cập nhật mật khẩu cho ${s.fullName}.`);
        renderSitemapStaff();
      } catch (err) { toast(err.message, 'error'); }
    };
  };

  renderList();

  actions().querySelector('#ow-staff-add').onclick = () => openStaffModal(null);

  on(main(), 'click', '[data-f-status]', (e, el) => {
    filterStatus = el.dataset.fStatus;
    renderList();
  });

  on(main(), 'click', '[data-st-edit]', (e, el) => openStaffModal(list.find((x) => x.id === el.dataset.stEdit)));

  on(main(), 'click', '[data-st-pwd]', (e, el) => openResetPasswordModal(list.find((x) => x.id === el.dataset.stPwd)));

  on(main(), 'click', '[data-st-toggle]', async (e, el) => {
    const s = list.find((x) => x.id === el.dataset.stToggle);
    if (!s) return;
    const newStatus = s.status === 'active' ? 'inactive' : 'active';
    const actionLabel = newStatus === 'active' ? 'Mở khóa tài khoản' : 'Tạm khóa tài khoản';
    if (await confirmBox({ title: `${actionLabel}?`, message: `Xác nhận ${actionLabel.toLowerCase()} của nhân viên <b>${esc(s.fullName)}</b>?`, danger: newStatus === 'inactive' })) {
      try {
        await api('owner', 'staff_save', { id: s.id, fullName: s.fullName, roleName: s.roleName, phone: s.phone, email: s.email, status: newStatus, permissions: s.permissions });
        toast(`Đã ${actionLabel.toLowerCase()} thành công.`);
        renderSitemapStaff();
      } catch (err) { toast(err.message, 'error'); }
    }
  });

  on(main(), 'click', '[data-st-del]', async (e, el) => {
    if (await confirmBox({ title: 'Xóa nhân viên?', message: 'Xác nhận xóa tài khoản nhân viên này khỏi cơ sở? Nhân viên sẽ không thể đăng nhập được nữa.', danger: true })) {
      await api('owner', 'staff_delete', { id: el.dataset.stDel });
      toast('Đã xóa nhân viên.');
      renderSitemapStaff();
    }
  });
}

// =====================================================================
// 9. TÀI KHOẢN (Hồ sơ chủ sân, Tài khoản nhận tiền, Đổi mật khẩu, Đăng xuất)
// =====================================================================
export async function renderSitemapAccount() {
  const sub = getSub('account', 'profile');
  actions().innerHTML = `<button type="button" data-logout class="${BTN_OUT} !border-accent-300 !text-accent-700 hover:!bg-accent-50"><i class="ri-logout-box-r-line"></i>Đăng xuất</button>`;
  const u = APP.user || {};
  if (sub === 'profile') {
    main().innerHTML = `<form id="ow-acc-profile" class="${CARD} p-6 space-y-4 max-w-2xl">
      <h3 class="font-heading text-base font-bold text-foreground-950">Hồ sơ chủ sân</h3>
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div><label class="${LABEL}">Tên cơ sở / cụm sân</label><input name="businessName" value="${esc(u.businessName || '')}" class="${INPUT}"></div>
        <div><label class="${LABEL}">Họ tên chủ sân</label><input name="name" value="${esc(u.fullName || '')}" class="${INPUT}"></div>
        <div><label class="${LABEL}">Số điện thoại</label><input name="phone" value="${esc(u.phone || '')}" class="${INPUT}"></div>
        <div><label class="${LABEL}">Email</label><input name="email" type="email" value="${esc(u.email || '')}" class="${INPUT}"></div>
        <div class="sm:col-span-2"><label class="${LABEL}">Địa chỉ cơ sở</label><input name="address" value="${esc(u.address || '')}" class="${INPUT}"></div>
      </div>
      <div class="flex justify-end"><button type="submit" class="${BTN}"><i class="ri-save-line"></i>Lưu hồ sơ</button></div>
    </form>`;
    main().querySelector('#ow-acc-profile').onsubmit = async (e) => {
      e.preventDefault();
      try {
        const updated = await api('account', 'update_profile', formData(e.target));
        Object.assign(APP.user, updated);
        toast('Đã cập nhật hồ sơ chủ sân.');
      } catch (err) { toast(err.message, 'error'); }
    };
  } else if (sub === 'bank') {
    main().innerHTML = loadingBlock('Đang tải tài khoản nhận tiền...');
    const cfg = await api('owner', 'settings_get').catch(() => ({ bankName: '', bankAccount: '', bankHolder: '' }));
    main().innerHTML = `<form id="ow-bank-form" class="${CARD} p-6 space-y-4 max-w-2xl">
      <h3 class="font-heading text-base font-bold text-foreground-950">Tài khoản ngân hàng nhận tiền đối soát</h3>
      <p class="text-xs text-foreground-600">Thông tin này dùng để quản trị viên đối soát và chuyển khoản tiền cọc đặt sân online cho cơ sở của bạn.</p>
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div><label class="${LABEL}">Ngân hàng</label><input name="bankName" value="${esc(cfg.bankName)}" placeholder="VD: Vietcombank, MB Bank..." class="${INPUT}"></div>
        <div><label class="${LABEL}">Số tài khoản</label><input name="bankAccount" value="${esc(cfg.bankAccount)}" placeholder="0231000688999" class="${INPUT}"></div>
        <div class="sm:col-span-2"><label class="${LABEL}">Tên chủ tài khoản (không dấu)</label><input name="bankHolder" value="${esc(cfg.bankHolder)}" placeholder="TRAN QUOC HUNG" class="${INPUT} uppercase"></div>
      </div>
      <div class="flex justify-end"><button type="submit" class="${BTN}"><i class="ri-save-line"></i>Lưu tài khoản nhận tiền</button></div>
    </form>`;
    main().querySelector('#ow-bank-form').onsubmit = async (e) => {
      e.preventDefault();
      await api('owner', 'settings_save', formData(e.target));
      toast('Đã lưu tài khoản nhận tiền.');
    };
  } else {
    main().innerHTML = `<form id="ow-pwd-form" class="${CARD} p-6 space-y-4 max-w-xl">
      <h3 class="font-heading text-base font-bold text-foreground-950">Đổi mật khẩu tài khoản chủ sân</h3>
      <div><label class="${LABEL}">Mật khẩu hiện tại</label><input type="password" name="current" class="${INPUT}"></div>
      <div><label class="${LABEL}">Mật khẩu mới</label><input type="password" name="password" class="${INPUT}"></div>
      <div><label class="${LABEL}">Nhập lại mật khẩu mới</label><input type="password" name="confirm" class="${INPUT}"></div>
      <div class="flex justify-end"><button type="submit" class="${BTN}"><i class="ri-lock-password-line"></i>Cập nhật mật khẩu</button></div>
    </form>`;
    main().querySelector('#ow-pwd-form').onsubmit = async (e) => {
      e.preventDefault();
      const f = e.target;
      if (f.password.value !== f.confirm.value) return toast('Mật khẩu nhập lại không khớp.', 'error');
      try {
        await api('account', 'change_password', { current: f.current.value, password: f.password.value });
        f.reset();
        toast('Đã đổi mật khẩu thành công.');
      } catch (err) { toast(err.message, 'error'); }
    };
  }
  mountSubBar(
    'account',
    [
      ['profile', 'Hồ sơ chủ sân', 'ri-user-line'],
      ['bank', 'Tài khoản nhận tiền', 'ri-bank-line'],
      ['password', 'Đổi mật khẩu', 'ri-lock-password-line'],
    ],
    sub,
    renderSitemapAccount,
  );
}
