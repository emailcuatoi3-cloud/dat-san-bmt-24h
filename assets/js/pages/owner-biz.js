/**
 * Kênh chủ sân — nhóm KINH DOANH: báo cáo, khách hàng, dịch vụ bán kèm, khuyến mãi, tiền cọc.
 */
import { api, esc, toast, confirmBox, setBusy, formData, on, statusBadge, emptyState, loadingBlock, errorBlock, formatDateTime, downloadCsv } from '../core/ui.js';
import { describeDiscount, describeConditions, promotionState, WEEKDAY_SHORT } from '../lib/promotions.js';
import { hoursForDate, toMinutes } from '../lib/openingHours.js';
import {
  S, TODAY, main, actions, BTN, BTN_OUT, BTN_SM, BTN_SM_PRI, BTN_SM_DANGER, INPUT, LABEL, CARD,
  chip, statCard, sectionTitle, modal, slotText, dateText, money, isActive, addDays, phoneKey, sourceBadge,
} from './owner-shared.js';
import { openBookingDetail } from './owner-ops.js';

const table = (head, rows, min = 640) =>
  `<div class="overflow-x-auto"><table class="w-full text-sm" style="min-width:${min}px"><thead class="bg-background-100 text-left text-xs font-semibold uppercase tracking-wide text-foreground-500"><tr>${head.map((h) => `<th class="px-4 py-3 ${h.startsWith('>') ? 'text-right' : ''}">${h.replace(/^>/, '')}</th>`).join('')}</tr></thead><tbody class="divide-y divide-background-200">${rows}</tbody></table></div>`;

// =====================================================================
// BÁO CÁO DOANH THU
// =====================================================================

const rp = { days: 30 };

export function renderReports() {
  const to = TODAY;
  const from = addDays(TODAY, -(rp.days - 1));
  const prevFrom = addDays(from, -rp.days);
  const prevTo = addDays(from, -1);
  const done = (b) => isActive(b) && b.status !== 'pending';
  const inRange = S.bookings.filter((b) => done(b) && b.date >= from && b.date <= to);
  const prev = S.bookings.filter((b) => done(b) && b.date >= prevFrom && b.date <= prevTo);
  const revenue = inRange.reduce((s, b) => s + b.totalPrice, 0);
  const prevRev = prev.reduce((s, b) => s + b.totalPrice, 0);
  const hours = inRange.reduce((s, b) => s + b.slots.length, 0);
  const openHours = S.courts.reduce((s, c) => {
    let t = 0;
    for (let d = from; d <= to; d = addDays(d, 1)) { const h = hoursForDate(c, d); if (!h.closed) t += (toMinutes(h.close) - toMinutes(h.open)) / 60; }
    return s + t;
  }, 0);
  const fill = openHours ? Math.round((hours / openHours) * 100) : 0;
  const cancelled = S.bookings.filter((b) => b.status === 'cancelled' && b.date >= from && b.date <= to).length;
  const growth = prevRev ? Math.round(((revenue - prevRev) / prevRev) * 100) : null;

  // Gom theo ngày (≤31 ngày) hoặc theo tuần (90 ngày)
  const step = rp.days > 31 ? 7 : 1;
  const buckets = [];
  for (let d = from; d <= to; d = addDays(d, step)) {
    const end = step === 1 ? d : (addDays(d, step - 1) > to ? to : addDays(d, step - 1));
    const v = inRange.filter((b) => b.date >= d && b.date <= end).reduce((s, b) => s + b.totalPrice, 0);
    buckets.push({ label: step === 1 ? `${d.slice(8)}/${d.slice(5, 7)}` : `${d.slice(8)}/${d.slice(5, 7)}`, v, d, end });
  }
  const max = Math.max(1, ...buckets.map((b) => b.v));
  const perCourt = S.courts.map((c) => {
    const list = inRange.filter((b) => b.courtId === c.id);
    let open = 0;
    for (let d = from; d <= to; d = addDays(d, 1)) { const h = hoursForDate(c, d); if (!h.closed) open += (toMinutes(h.close) - toMinutes(h.open)) / 60; }
    const hrs = list.reduce((s, b) => s + b.slots.length, 0);
    return { c, n: list.length, hrs, rev: list.reduce((s, b) => s + b.totalPrice, 0), fill: open ? Math.round((hrs / open) * 100) : 0 };
  }).sort((a, b) => b.rev - a.rev);
  const bySport = ['football', 'badminton'].map((sp) => ({ sp, rev: inRange.filter((b) => b.sport === sp).reduce((s, b) => s + b.totalPrice, 0) }));
  const online = inRange.filter((b) => b.source === 'online').length;

  actions().innerHTML = `<div class="flex rounded-md border border-background-300 bg-white p-0.5">${[7, 30, 90].map((d) => `<button type="button" data-days="${d}" class="rounded px-3 py-1.5 text-xs font-semibold ${rp.days === d ? 'bg-primary-500 text-white' : 'text-foreground-700'}">${d} ngày</button>`).join('')}</div><button type="button" id="rp-csv" class="${BTN_OUT}"><i class="ri-file-excel-2-line"></i>Xuất Excel</button>`;
  on(actions(), 'click', '[data-days]', (e, el) => { rp.days = Number(el.dataset.days); renderReports(); });
  actions().querySelector('#rp-csv').onclick = () =>
    downloadCsv([
      ['Báo cáo doanh thu', `${dateText(from)} - ${dateText(to)}`],
      [],
      ['Sân', 'Số đơn', 'Số giờ', 'Tỷ lệ lấp đầy (%)', 'Doanh thu (VND)'],
      ...perCourt.map((p) => [p.c.name, p.n, p.hrs, p.fill, p.rev]),
      ['Tổng', inRange.length, hours, fill, revenue],
      [],
      ['Ngày', 'Mã đơn', 'Sân', 'Khách', 'Khung giờ', 'Nguồn', 'Doanh thu (VND)'],
      ...inRange.sort((a, b) => a.date.localeCompare(b.date)).map((b) => [b.date, b.code, b.courtName, b.customerName, slotText(b), b.source === 'online' ? 'Online' : 'Tại quầy', b.totalPrice]),
    ], `bao-cao-doanh-thu-${from}-${to}.csv`);

  main().innerHTML = `
  <div class="grid grid-cols-2 gap-3 lg:grid-cols-4">
    ${statCard('ri-money-dollar-circle-line', `Doanh thu ${rp.days} ngày`, money(revenue), growth === null ? 'Chưa có kỳ trước để so sánh' : `${growth >= 0 ? '▲' : '▼'} ${Math.abs(growth)}% so với kỳ trước`)}
    ${statCard('ri-calendar-check-line', 'Số đơn', inRange.length, `${online} online · ${inRange.length - online} tại quầy · ${cancelled} hủy`, 'secondary')}
    ${statCard('ri-time-line', 'Tỷ lệ lấp đầy', `${fill}%`, `${hours} / ${Math.round(openHours)} giờ mở cửa`, 'accent')}
    ${statCard('ri-scales-3-line', 'Trung bình / đơn', money(inRange.length ? Math.round(revenue / inRange.length) : 0), '', 'neutral')}
  </div>
  <section class="${CARD} mt-5">${sectionTitle(`Doanh thu theo ${step === 1 ? 'ngày' : 'tuần'}`, `<span class="text-xs text-foreground-500">${dateText(from)} – ${dateText(to)}</span>`)}
    <div class="p-4"><div class="flex h-56 items-end gap-1">${buckets.map((b) => `<div class="group relative flex h-full flex-1 flex-col justify-end" title="${b.label}: ${money(b.v)}"><div class="w-full rounded-t ${b.d <= TODAY && b.end >= TODAY ? 'bg-accent-500' : 'bg-primary-500'} opacity-90 transition-opacity group-hover:opacity-100" style="height:${Math.max(b.v ? 3 : 0, (b.v / max) * 100)}%"></div></div>`).join('')}</div>
    <div class="mt-2 flex gap-1 text-[10px] text-foreground-500">${buckets.map((b, i) => `<span class="flex-1 text-center">${buckets.length <= 14 || i % Math.ceil(buckets.length / 10) === 0 ? b.label : ''}</span>`).join('')}</div></div></section>
  <div class="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-[1.6fr_1fr]">
    <section class="${CARD} overflow-hidden">${sectionTitle('Hiệu quả từng sân')}${table(['Sân', '>Đơn', '>Giờ', 'Lấp đầy', '>Doanh thu'], perCourt.map((p) => `<tr><td class="px-4 py-3 font-medium">${esc(p.c.name)}</td><td class="px-4 py-3 text-right">${p.n}</td><td class="px-4 py-3 text-right">${p.hrs}</td><td class="px-4 py-3"><div class="flex items-center gap-2"><div class="h-1.5 w-20 rounded-full bg-background-200"><div class="h-1.5 rounded-full bg-primary-500" style="width:${Math.min(100, p.fill)}%"></div></div><span class="text-xs">${p.fill}%</span></div></td><td class="px-4 py-3 text-right font-semibold">${money(p.rev)}</td></tr>`).join(''), 560)}</section>
    <section class="${CARD}">${sectionTitle('Theo môn thể thao')}<div class="space-y-4 p-4">${bySport.map((x) => { const pct = revenue ? Math.round((x.rev / revenue) * 100) : 0; return `<div><div class="flex justify-between text-sm"><span class="font-medium">${x.sp === 'football' ? '⚽ Bóng đá' : '🏸 Cầu lông'}</span><span class="font-semibold">${money(x.rev)}</span></div><div class="mt-1.5 h-2.5 rounded-full bg-background-200"><div class="h-2.5 rounded-full ${x.sp === 'football' ? 'bg-primary-500' : 'bg-secondary-500'}" style="width:${pct}%"></div></div><p class="mt-1 text-xs text-foreground-500">${pct}% doanh thu</p></div>`; }).join('')}</div></section>
  </div>`;
}

// =====================================================================
// KHÁCH HÀNG
// =====================================================================

const cf = { filter: 'all', sort: 'spend', q: '' };

function groupCustomers() {
  const map = new Map();
  S.bookings.forEach((b) => {
    const key = phoneKey(b.customerPhone) || b.customerName.toLowerCase();
    if (!map.has(key)) map.set(key, { key, name: b.customerName, phone: b.customerPhone, list: [] });
    map.get(key).list.push(b);
  });
  return [...map.values()].map((c) => {
    const live = c.list.filter((b) => isActive(b));
    return {
      ...c,
      visits: live.length,
      spend: live.filter((b) => b.status !== 'pending').reduce((s, b) => s + b.totalPrice, 0),
      cancelled: c.list.length - live.length,
      last: c.list.map((b) => b.date).sort().pop(),
      courts: [...new Set(c.list.map((b) => b.courtName))],
    };
  });
}

export function renderCustomers() {
  const all = groupCustomers();
  const q = cf.q.toLowerCase();
  const filters = [['all', 'Tất cả', () => true], ['regular', 'Khách quen', (c) => c.visits >= 3], ['new', 'Mới 1 lượt', (c) => c.visits === 1], ['cancel', 'Từng huỷ', (c) => c.cancelled > 0]];
  const fn = filters.find((f) => f[0] === cf.filter)[2];
  const sorters = { spend: (a, b) => b.spend - a.spend, visits: (a, b) => b.visits - a.visits, recent: (a, b) => (b.last || '').localeCompare(a.last || ''), name: (a, b) => a.name.localeCompare(b.name, 'vi') };
  const list = all.filter(fn).filter((c) => !q || `${c.name} ${c.phone}`.toLowerCase().includes(q)).sort(sorters[cf.sort]);

  actions().innerHTML = `<button type="button" id="cu-csv" class="${BTN_OUT}"><i class="ri-file-excel-2-line"></i>Xuất danh sách</button>`;
  actions().querySelector('#cu-csv').onclick = () => downloadCsv([['Khách hàng', 'Số điện thoại', 'Số lượt chơi', 'Tổng chi tiêu (VND)', 'Lượt hủy', 'Lần gần nhất', 'Sân đã chơi'], ...list.map((c) => [c.name, c.phone, c.visits, c.spend, c.cancelled, c.last, c.courts.join('; ')])], `khach-hang-${TODAY}.csv`);

  main().innerHTML = `
  <div class="grid grid-cols-2 gap-3 lg:grid-cols-4">
    ${statCard('ri-group-line', 'Tổng khách', all.length)}
    ${statCard('ri-vip-crown-line', 'Khách quen (≥3 lượt)', all.filter((c) => c.visits >= 3).length, '', 'accent')}
    ${statCard('ri-user-add-line', 'Khách mới 1 lượt', all.filter((c) => c.visits === 1).length, '', 'secondary')}
    ${statCard('ri-money-dollar-circle-line', 'Chi tiêu TB / khách', money(all.length ? Math.round(all.reduce((s, c) => s + c.spend, 0) / all.length) : 0), '', 'neutral')}
  </div>
  <div class="mt-5 mb-3 flex flex-wrap gap-2">${filters.map(([k, l, f]) => `<button type="button" data-cf="${k}" class="${chip(cf.filter === k)}">${l}<span class="opacity-75">${all.filter(f).length}</span></button>`).join('')}</div>
  <div class="mb-4 grid grid-cols-1 gap-2 sm:grid-cols-[1fr_220px]"><input id="cu-q" value="${esc(cf.q)}" class="${INPUT}" placeholder="Tìm tên hoặc số điện thoại..."><select id="cu-sort" class="${INPUT}">${[['spend', 'Chi tiêu nhiều nhất'], ['visits', 'Chơi nhiều nhất'], ['recent', 'Mới chơi gần đây'], ['name', 'Tên A → Z']].map(([v, l]) => `<option value="${v}" ${cf.sort === v ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
  <div class="${CARD} overflow-hidden">${list.length ? table(['Khách hàng', '>Lượt chơi', '>Chi tiêu', '>Hủy', 'Gần nhất', '>Liên hệ'], list.map((c) => `<tr data-cu="${esc(c.key)}" class="cursor-pointer hover:bg-background-50">
    <td class="px-4 py-3"><div class="flex items-center gap-3"><span class="flex h-9 w-9 items-center justify-center rounded-full bg-primary-50 text-xs font-bold text-primary-700">${esc(c.name.split(' ').slice(-1)[0].slice(0, 2).toUpperCase())}</span><div><p class="font-semibold">${esc(c.name)} ${c.visits >= 3 ? '<i class="ri-vip-crown-fill text-accent-500"></i>' : ''}</p><p class="text-xs text-foreground-500">${esc(c.phone || '—')}</p></div></div></td>
    <td class="px-4 py-3 text-right font-semibold">${c.visits}</td><td class="px-4 py-3 text-right font-semibold text-primary-700">${money(c.spend)}</td><td class="px-4 py-3 text-right ${c.cancelled ? 'text-accent-700' : ''}">${c.cancelled}</td><td class="px-4 py-3">${dateText(c.last)}</td>
    <td class="px-4 py-3"><div class="flex justify-end gap-1.5">${c.phone ? `<a href="tel:${esc(phoneKey(c.phone))}" data-stop class="${BTN_SM}"><i class="ri-phone-line"></i>Gọi</a><a href="https://zalo.me/${esc(phoneKey(c.phone))}" target="_blank" data-stop class="${BTN_SM}">Zalo</a>` : ''}</div></td></tr>`).join(''), 760)
    : `<div class="p-4">${emptyState('ri-group-line', 'Không có khách phù hợp')}</div>`}</div>`;

  const root = main();
  on(root, 'click', '[data-cf]', (e, el) => { cf.filter = el.dataset.cf; renderCustomers(); });
  root.querySelector('#cu-q').addEventListener('change', (e) => { cf.q = e.target.value; renderCustomers(); });
  root.querySelector('#cu-sort').addEventListener('change', (e) => { cf.sort = e.target.value; renderCustomers(); });
  on(root, 'click', '[data-cu]', (e, el) => {
    if (e.target.closest('[data-stop]')) return;
    const c = all.find((x) => x.key === el.dataset.cu);
    const m = modal(
      esc(c.name),
      `<div class="grid grid-cols-3 gap-2 text-center text-xs"><div class="rounded-md bg-background-100 py-2"><p class="text-lg font-bold">${c.visits}</p>Lượt chơi</div><div class="rounded-md bg-primary-50 py-2 text-primary-800"><p class="text-lg font-bold">${money(c.spend)}</p>Chi tiêu</div><div class="rounded-md bg-accent-50 py-2 text-accent-800"><p class="text-lg font-bold">${c.cancelled}</p>Lượt hủy</div></div>
       <p class="mt-3 text-sm"><i class="ri-phone-line text-primary-600"></i> ${esc(c.phone || 'Chưa có số')}</p>
       <p class="mt-4 text-xs font-bold uppercase tracking-wide text-foreground-500">Lịch sử đặt sân</p>
       <div class="mt-2 divide-y divide-background-200 rounded-md border border-background-200">${c.list.sort((a, b) => b.date.localeCompare(a.date)).map((b) => `<button type="button" data-bk="${b.id}" class="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left hover:bg-background-50"><div><p class="text-sm font-medium">${esc(b.courtName)}</p><p class="text-xs text-foreground-500">${dateText(b.date)} · ${slotText(b)} · ${money(b.totalPrice)}</p></div>${statusBadge(b.status)}</button>`).join('')}</div>`,
      c.phone ? `<a href="https://zalo.me/${esc(phoneKey(c.phone))}" target="_blank" class="${BTN_OUT}">Nhắn Zalo</a><a href="tel:${esc(phoneKey(c.phone))}" class="${BTN}"><i class="ri-phone-line"></i>Gọi khách</a>` : '',
      'max-w-xl',
    );
    on(m.el, 'click', '[data-bk]', (ev, b) => { m.close(); openBookingDetail(S.bookings.find((x) => x.id === b.dataset.bk)); });
  });
}

// =====================================================================
// DỊCH VỤ BÁN KÈM
// =====================================================================

const CATS = { drink: ['Nước uống', 'ri-cup-line'], rental: ['Cho thuê dụng cụ', 'ri-football-line'], food: ['Đồ ăn nhẹ', 'ri-cake-3-line'], other: ['Khác', 'ri-more-line'] };
const LOW_STOCK = 5;
const sv = { cat: 'all', list: null };

function serviceForm(item = null) {
  const s = item || { category: 'drink', unit: 'chai', price: 0, stock: 0, active: true };
  const m = modal(
    item ? 'Sửa dịch vụ' : 'Thêm dịch vụ',
    `<form class="grid grid-cols-2 gap-3">
      <div class="col-span-2"><label class="${LABEL}">Tên dịch vụ</label><input name="name" value="${esc(s.name || '')}" class="${INPUT}" placeholder="Nước suối Aquafina"></div>
      <div><label class="${LABEL}">Nhóm</label><select name="category" class="${INPUT}">${Object.entries(CATS).map(([k, [l]]) => `<option value="${k}" ${s.category === k ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
      <div><label class="${LABEL}">Đơn vị</label><input name="unit" value="${esc(s.unit)}" class="${INPUT}"></div>
      <div><label class="${LABEL}">Giá bán (đ)</label><input type="number" name="price" min="0" step="1000" value="${s.price}" class="${INPUT}"></div>
      <div><label class="${LABEL}">Tồn kho</label><input type="number" name="stock" min="0" value="${s.stock}" class="${INPUT}"></div>
      <label class="col-span-2 flex items-center gap-2 text-sm"><input type="checkbox" name="active" ${s.active ? 'checked' : ''} class="accent-primary-500">Đang bán</label>
    </form>`,
    `<button type="button" data-close class="${BTN_OUT}">Hủy</button><button type="button" data-ok class="${BTN}">Lưu</button>`,
  );
  m.el.querySelector('[data-ok]').addEventListener('click', async (e) => {
    const form = m.el.querySelector('form');
    const f = formData(form);
    setBusy(e.currentTarget, true, 'Đang lưu...');
    try {
      await api('owner', 'service_save', { ...f, id: item ? item.id : '', price: Number(f.price), stock: Number(f.stock), active: form.active.checked });
      sv.list = null;
      m.close();
      toast('Đã lưu dịch vụ.');
      renderServices();
    } catch (err) { setBusy(e.currentTarget, false); toast(err.message, 'error'); }
  });
}

export async function renderServices() {
  actions().innerHTML = `<button type="button" id="sv-add" class="${BTN}"><i class="ri-add-line"></i>Thêm dịch vụ</button>`;
  actions().querySelector('#sv-add').onclick = () => serviceForm();
  if (!sv.list) {
    main().innerHTML = loadingBlock();
    try { sv.list = await api('owner', 'services'); } catch (e) { main().innerHTML = errorBlock(e.message); return; }
  }
  const all = sv.list;
  const list = all.filter((s) => sv.cat === 'all' || s.category === sv.cat);
  const low = all.filter((s) => s.active && s.stock <= LOW_STOCK);
  main().innerHTML = `
  <div class="grid grid-cols-2 gap-3 lg:grid-cols-4">
    ${statCard('ri-store-3-line', 'Mặt hàng', all.length, `${all.filter((s) => s.active).length} đang bán`)}
    ${statCard('ri-alarm-warning-line', 'Sắp hết hàng', low.length, `Tồn ≤ ${LOW_STOCK}`, 'accent')}
    ${statCard('ri-archive-line', 'Tổng tồn kho', all.reduce((s, x) => s + x.stock, 0), 'đơn vị', 'neutral')}
    ${statCard('ri-money-dollar-circle-line', 'Giá trị tồn kho', money(all.reduce((s, x) => s + x.stock * x.price, 0)), 'Theo giá bán', 'secondary')}
  </div>
  ${low.length ? `<div class="mt-4 flex items-start gap-2 rounded-lg border border-accent-300 bg-accent-50 px-4 py-3 text-sm text-accent-800"><i class="ri-alarm-warning-line mt-0.5"></i><span>Cần nhập thêm: ${low.map((s) => `<b>${esc(s.name)}</b> (còn ${s.stock})`).join(', ')}</span></div>` : ''}
  <div class="mt-5 mb-3 flex flex-wrap gap-2"><button type="button" data-cat="all" class="${chip(sv.cat === 'all')}">Tất cả</button>${Object.entries(CATS).map(([k, [l, i]]) => `<button type="button" data-cat="${k}" class="${chip(sv.cat === k)}"><i class="${i}"></i>${l}</button>`).join('')}</div>
  <div class="${CARD} overflow-hidden">${list.length ? table(['Dịch vụ', 'Nhóm', '>Giá bán', 'Tồn kho', 'Trạng thái', '>Thao tác'], list.map((s) => `<tr class="${s.active ? '' : 'opacity-60'}">
    <td class="px-4 py-3 font-semibold">${esc(s.name)}<p class="text-xs font-normal text-foreground-500">/${esc(s.unit)}</p></td>
    <td class="px-4 py-3 text-xs"><i class="${CATS[s.category][1]}"></i> ${CATS[s.category][0]}</td>
    <td class="px-4 py-3 text-right font-semibold">${money(s.price)}</td>
    <td class="px-4 py-3"><div class="flex items-center gap-1.5"><button type="button" data-stock="${s.id}" data-d="-1" class="flex h-7 w-7 items-center justify-center rounded border border-background-300">−</button><span class="w-10 text-center font-semibold ${s.stock <= LOW_STOCK ? 'text-accent-700' : ''}">${s.stock}</span><button type="button" data-stock="${s.id}" data-d="1" class="flex h-7 w-7 items-center justify-center rounded border border-background-300">+</button><button type="button" data-stock="${s.id}" data-d="10" class="rounded border border-background-300 px-1.5 py-1 text-[11px]">+10</button></div></td>
    <td class="px-4 py-3"><button type="button" data-toggle="${s.id}" class="${s.active ? 'bg-primary-50 text-primary-700' : 'bg-background-100 text-foreground-600'} rounded-full px-2.5 py-1 text-xs font-semibold">${s.active ? 'Đang bán' : 'Tạm ngưng'}</button></td>
    <td class="px-4 py-3"><div class="flex justify-end gap-1.5"><button type="button" data-edit="${s.id}" class="${BTN_SM}"><i class="ri-edit-line"></i>Sửa</button><button type="button" data-del="${s.id}" class="${BTN_SM_DANGER}"><i class="ri-delete-bin-line"></i></button></div></td></tr>`).join(''), 760)
    : `<div class="p-4">${emptyState('ri-cup-line', 'Chưa có dịch vụ', 'Thêm nước uống, dụng cụ cho thuê để bán kèm khi khách đến sân.')}</div>`}</div>`;

  const root = main();
  const find = (id) => sv.list.find((x) => x.id === id);
  const save = async (s) => { try { await api('owner', 'service_save', s); renderServices(); } catch (e) { toast(e.message, 'error'); sv.list = null; renderServices(); } };
  on(root, 'click', '[data-cat]', (e, el) => { sv.cat = el.dataset.cat; renderServices(); });
  on(root, 'click', '[data-edit]', (e, el) => serviceForm(find(el.dataset.edit)));
  on(root, 'click', '[data-stock]', (e, el) => { const s = find(el.dataset.stock); s.stock = Math.max(0, s.stock + Number(el.dataset.d)); save(s); });
  on(root, 'click', '[data-toggle]', (e, el) => { const s = find(el.dataset.toggle); s.active = !s.active; save(s); toast(s.active ? 'Đã mở bán lại.' : 'Đã tạm ngưng bán.'); });
  on(root, 'click', '[data-del]', async (e, el) => {
    const s = find(el.dataset.del);
    if (!(await confirmBox({ title: 'Xóa dịch vụ?', message: `Xóa "${esc(s.name)}" khỏi danh sách bán kèm.`, confirmText: 'Xóa', danger: true }))) return;
    await api('owner', 'service_delete', { id: s.id });
    sv.list = sv.list.filter((x) => x.id !== s.id);
    toast('Đã xóa dịch vụ.');
    renderServices();
  });
}

// =====================================================================
// KHUYẾN MÃI
// =====================================================================

const pm = { data: null, filter: 'all' };
const STATE = { active: ['Đang chạy', 'bg-primary-50 text-primary-700'], upcoming: ['Sắp diễn ra', 'bg-secondary-50 text-secondary-800'], expired: ['Đã hết hạn', 'bg-background-100 text-foreground-600'], paused: ['Tạm dừng', 'bg-accent-50 text-accent-800'] };

function promoForm(p = null) {
  const x = p || { discountType: 'percent', discountValue: 10, startDate: TODAY, endDate: addDays(TODAY, 30), weekdays: [], startTime: '', endTime: '', minOrder: 0, status: 'active' };
  const m = modal(
    p ? `Sửa mã ${esc(p.code)}` : 'Tạo mã khuyến mãi',
    `<form class="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <div><label class="${LABEL}">Mã giảm giá *</label><input name="code" value="${esc(x.code || '')}" class="${INPUT} font-mono uppercase" placeholder="SANGSOM20" maxlength="16"></div>
      <div><label class="${LABEL}">Tên chương trình *</label><input name="title" value="${esc(x.title || '')}" class="${INPUT}" placeholder="Giảm giá giờ sáng"></div>
      <div class="sm:col-span-2"><label class="${LABEL}">Mô tả</label><input name="description" value="${esc(x.description || '')}" class="${INPUT}"></div>
      <div><label class="${LABEL}">Kiểu giảm</label><select name="discountType" class="${INPUT}"><option value="percent" ${x.discountType === 'percent' ? 'selected' : ''}>Theo %</option><option value="amount" ${x.discountType === 'amount' ? 'selected' : ''}>Số tiền cố định</option></select></div>
      <div><label class="${LABEL}">Mức giảm</label><input type="number" name="discountValue" min="1" value="${x.discountValue}" class="${INPUT}"></div>
      <div><label class="${LABEL}">Giảm tối đa (đ, cho kiểu %)</label><input type="number" name="maxDiscount" min="0" step="1000" value="${x.maxDiscount || ''}" class="${INPUT}"></div>
      <div><label class="${LABEL}">Đơn tối thiểu (đ)</label><input type="number" name="minOrder" min="0" step="1000" value="${x.minOrder || 0}" class="${INPUT}"></div>
      <div><label class="${LABEL}">Từ ngày</label><input type="date" name="startDate" value="${x.startDate}" class="${INPUT}"></div>
      <div><label class="${LABEL}">Đến ngày</label><input type="date" name="endDate" value="${x.endDate}" class="${INPUT}"></div>
      <div><label class="${LABEL}">Áp dụng từ giờ (để trống = cả ngày)</label><input type="time" name="startTime" value="${x.startTime}" class="${INPUT}"></div>
      <div><label class="${LABEL}">Đến giờ</label><input type="time" name="endTime" value="${x.endTime}" class="${INPUT}"></div>
      <div class="sm:col-span-2"><label class="${LABEL}">Ngày trong tuần (không chọn = mọi ngày)</label><div class="flex flex-wrap gap-1.5">${[1, 2, 3, 4, 5, 6, 7].map((d) => `<label class="cursor-pointer"><input type="checkbox" name="wd" value="${d}" ${x.weekdays.includes(d) ? 'checked' : ''} class="peer sr-only"><span class="block rounded-md border border-background-300 px-3 py-1.5 text-xs font-semibold peer-checked:border-primary-500 peer-checked:bg-primary-500 peer-checked:text-white">${WEEKDAY_SHORT[d]}</span></label>`).join('')}</div></div>
      <div><label class="${LABEL}">Giới hạn lượt dùng (để trống = không giới hạn)</label><input type="number" name="usageLimit" min="0" value="${x.usageLimit || ''}" class="${INPUT}"></div>
      <div><label class="${LABEL}">Trạng thái</label><select name="status" class="${INPUT}"><option value="active">Đang chạy</option><option value="paused" ${x.status === 'paused' ? 'selected' : ''}>Tạm dừng</option></select></div>
    </form>`,
    `<button type="button" data-close class="${BTN_OUT}">Hủy</button><button type="button" data-ok class="${BTN}">${p ? 'Lưu thay đổi' : 'Tạo mã'}</button>`,
    'max-w-2xl',
  );
  m.el.querySelector('[data-ok]').addEventListener('click', async (e) => {
    const form = m.el.querySelector('form');
    const f = formData(form);
    const weekdays = [...form.querySelectorAll('[name=wd]:checked')].map((i) => Number(i.value));
    setBusy(e.currentTarget, true, 'Đang lưu...');
    try {
      await api('owner', 'promotion_save', { ...f, id: p ? p.id : '', weekdays, discountValue: Number(f.discountValue), maxDiscount: Number(f.maxDiscount) || 0, minOrder: Number(f.minOrder) || 0, usageLimit: Number(f.usageLimit) || 0 });
      pm.data = null;
      m.close();
      toast(p ? 'Đã cập nhật mã.' : 'Đã tạo mã khuyến mãi.');
      renderPromotions();
    } catch (err) { setBusy(e.currentTarget, false); toast(err.message, 'error'); }
  });
}

export async function renderPromotions() {
  actions().innerHTML = `<button type="button" id="pm-add" class="${BTN}"><i class="ri-add-line"></i>Tạo mã mới</button>`;
  actions().querySelector('#pm-add').onclick = () => promoForm();
  if (!pm.data) {
    main().innerHTML = loadingBlock();
    try { pm.data = await api('owner', 'promotions'); } catch (e) { main().innerHTML = errorBlock(e.message); return; }
  }
  const { promotions, redemptions } = pm.data;
  const valid = redemptions.filter((r) => r.status !== 'cancelled');
  const stat = (code) => { const l = valid.filter((r) => r.code === code); return { uses: l.length, discount: l.reduce((s, r) => s + r.discount, 0), revenue: l.reduce((s, r) => s + r.paidTotal, 0) }; };
  const list = promotions.filter((p) => pm.filter === 'all' || promotionState(p, TODAY) === pm.filter);

  main().innerHTML = `
  <div class="grid grid-cols-2 gap-3 lg:grid-cols-4">
    ${statCard('ri-coupon-3-line', 'Mã đang chạy', promotions.filter((p) => promotionState(p, TODAY) === 'active').length, `${promotions.length} mã đã tạo`)}
    ${statCard('ri-shopping-bag-3-line', 'Lượt sử dụng', valid.length, '', 'secondary')}
    ${statCard('ri-price-tag-3-line', 'Tổng tiền đã giảm', money(valid.reduce((s, r) => s + r.discount, 0)), '', 'accent')}
    ${statCard('ri-money-dollar-circle-line', 'Doanh thu từ mã', money(valid.reduce((s, r) => s + r.paidTotal, 0)), '', 'neutral')}
  </div>
  <div class="mt-5 mb-3 flex flex-wrap gap-2">${[['all', 'Tất cả'], ['active', 'Đang chạy'], ['upcoming', 'Sắp diễn ra'], ['paused', 'Tạm dừng'], ['expired', 'Hết hạn']].map(([k, l]) => `<button type="button" data-pf="${k}" class="${chip(pm.filter === k)}">${l}</button>`).join('')}</div>
  ${list.length ? `<div class="grid grid-cols-1 gap-4 md:grid-cols-2">${list.map((p) => { const st = promotionState(p, TODAY); const s = stat(p.code); return `
    <article class="${CARD} p-4">
      <div class="flex items-start justify-between gap-3"><div><p class="font-mono text-lg font-extrabold text-primary-700">${esc(p.code)}</p><p class="text-sm font-semibold text-foreground-950">${esc(p.title)}</p></div><span class="rounded-full px-2.5 py-1 text-[11px] font-semibold ${STATE[st][1]}">${STATE[st][0]}</span></div>
      <p class="mt-2 text-sm font-semibold text-accent-700">${esc(describeDiscount(p))}${p.minOrder ? ` · đơn từ ${money(p.minOrder)}` : ''}</p>
      <p class="mt-1 text-xs text-foreground-500">${esc(describeConditions(p))}</p>
      <div class="mt-3 grid grid-cols-3 gap-2 text-center text-xs"><div class="rounded-md bg-background-100 py-2"><p class="font-bold">${s.uses}${p.usageLimit ? `/${p.usageLimit}` : ''}</p>Lượt dùng</div><div class="rounded-md bg-background-100 py-2"><p class="font-bold">${money(s.discount)}</p>Đã giảm</div><div class="rounded-md bg-background-100 py-2"><p class="font-bold">${money(s.revenue)}</p>Doanh thu</div></div>
      <div class="mt-3 flex flex-wrap gap-1.5"><button type="button" data-edit="${p.id}" class="${BTN_SM}"><i class="ri-edit-line"></i>Sửa</button><button type="button" data-pause="${p.id}" class="${BTN_SM}">${p.status === 'paused' ? '<i class="ri-play-line"></i>Chạy lại' : '<i class="ri-pause-line"></i>Tạm dừng'}</button><button type="button" data-del="${p.id}" class="${BTN_SM_DANGER}"><i class="ri-delete-bin-line"></i>Xóa</button></div>
    </article>`; }).join('')}</div>` : emptyState('ri-coupon-3-line', 'Chưa có mã khuyến mãi', 'Tạo mã giảm giá để thu hút khách vào khung giờ vắng.')}
  <section class="${CARD} mt-6 overflow-hidden">${sectionTitle('Lượt dùng mã gần đây')}${redemptions.length ? table(['Mã', 'Đơn', 'Khách', 'Sân · ngày', '>Đã giảm', '>Khách trả', 'Trạng thái'], redemptions.slice(0, 20).map((r) => `<tr><td class="px-4 py-3 font-mono text-xs font-bold text-primary-700">${esc(r.code)}</td><td class="px-4 py-3 font-mono text-xs">${esc(r.bookingCode)}</td><td class="px-4 py-3">${esc(r.customerName)}</td><td class="px-4 py-3 text-xs">${esc(r.courtName)}<br>${dateText(r.bookingDate)}</td><td class="px-4 py-3 text-right text-accent-700">-${money(r.discount)}</td><td class="px-4 py-3 text-right font-semibold">${money(r.paidTotal)}</td><td class="px-4 py-3">${statusBadge(r.status)}</td></tr>`).join(''), 820) : '<p class="px-4 py-5 text-sm text-foreground-500">Chưa có khách nào dùng mã của bạn.</p>'}</section>`;

  const root = main();
  const find = (id) => promotions.find((p) => p.id === id);
  on(root, 'click', '[data-pf]', (e, el) => { pm.filter = el.dataset.pf; renderPromotions(); });
  on(root, 'click', '[data-edit]', (e, el) => promoForm(find(el.dataset.edit)));
  on(root, 'click', '[data-pause]', async (e, el) => {
    const p = find(el.dataset.pause);
    await api('owner', 'promotion_status', { id: p.id, status: p.status === 'paused' ? 'active' : 'paused' }).catch((err) => toast(err.message, 'error'));
    pm.data = null;
    toast(p.status === 'paused' ? 'Mã đã chạy lại.' : 'Đã tạm dừng mã.');
    renderPromotions();
  });
  on(root, 'click', '[data-del]', async (e, el) => {
    const p = find(el.dataset.del);
    if (!(await confirmBox({ title: `Xóa mã ${esc(p.code)}?`, message: 'Khách sẽ không thể dùng mã này nữa. Lịch sử đơn đã dùng mã vẫn được giữ.', confirmText: 'Xóa mã', danger: true }))) return;
    await api('owner', 'promotion_delete', { id: p.id });
    pm.data = null;
    toast('Đã xóa mã.');
    renderPromotions();
  });
}

// =====================================================================
// TIỀN CỌC
// =====================================================================

const dp = { tab: 'holding', refunds: null };

export async function renderDeposits() {
  if (!dp.refunds) {
    main().innerHTML = loadingBlock();
    try { dp.refunds = await api('owner', 'refunds'); } catch (e) { main().innerHTML = errorBlock(e.message); return; }
  }
  const received = (b) => ['deposit_claimed', 'deposit_paid'].includes(b.paymentStatus);
  const online = S.bookings.filter((b) => b.source === 'online' && b.depositAmount > 0);
  const refunded = new Set(dp.refunds.map((r) => r.bookingCode));
  const holding = online.filter((b) => received(b) && ['pending', 'confirmed'].includes(b.status));
  const settle = online.filter((b) => received(b) && b.status === 'completed');
  const refund = online.filter((b) => (received(b) || b.paymentStatus === 'paid') && b.status === 'cancelled' && !refunded.has(b.code));
  const sum = (l, f) => l.reduce((s, b) => s + f(b), 0);
  const groups = {
    holding: ['Đang giữ cọc', holding, 'Đơn sắp chơi, khách đã chuyển cọc. Phần còn lại thu tại sân.'],
    settle: ['Cần tất toán', settle, 'Khách đã chơi xong nhưng chưa ghi nhận thu phần còn lại.'],
    refund: ['Cần hoàn cọc', refund, 'Đơn đã hủy sau khi khách chuyển cọc — cần hoàn tiền cho khách.'],
    done: ['Đã hoàn', null, 'Phiếu hoàn cọc đã lập.'],
  };
  const rows = (l) => l.map((b) => `<tr>
    <td class="px-4 py-3"><button type="button" data-detail="${b.id}" class="font-mono text-xs font-bold text-primary-700 hover:underline">${esc(b.code)}</button><p class="text-xs text-foreground-500">${esc(b.customerName)} · ${esc(b.customerPhone)}</p></td>
    <td class="px-4 py-3 text-xs">${esc(b.courtName)}<br>${dateText(b.date)} · ${slotText(b)}</td>
    <td class="px-4 py-3 text-right font-semibold">${money(b.totalPrice)}</td>
    <td class="px-4 py-3 text-right font-semibold text-primary-700">${money(b.depositAmount)}<p class="text-[10px] font-normal text-foreground-500">${b.paymentStatus === 'deposit_claimed' ? 'Khách báo đã chuyển' : 'Đã nhận'}</p></td>
    <td class="px-4 py-3 text-right font-semibold text-accent-700">${money(Math.max(0, b.totalPrice - b.depositAmount))}</td>
    <td class="px-4 py-3"><div class="flex justify-end gap-1.5">${dp.tab === 'refund' ? `<button type="button" data-refund="${b.id}" class="${BTN_SM_PRI}"><i class="ri-refund-2-line"></i>Lập phiếu hoàn</button>` : `<button type="button" data-settle="${b.id}" class="${BTN_SM_PRI}"><i class="ri-hand-coin-line"></i>Thu đủ</button>`}</div></td></tr>`).join('');

  main().innerHTML = `
  <div class="grid grid-cols-2 gap-3 lg:grid-cols-4">
    ${statCard('ri-safe-2-line', 'Cọc đang giữ', money(sum(holding, (b) => b.depositAmount)), `${holding.length} đơn sắp chơi`)}
    ${statCard('ri-hand-coin-line', 'Còn phải thu tại sân', money(sum([...holding, ...settle], (b) => b.totalPrice - b.depositAmount)), '', 'secondary')}
    ${statCard('ri-refund-2-line', 'Cần hoàn cho khách', money(sum(refund, (b) => b.depositAmount)), `${refund.length} đơn đã hủy`, 'accent')}
    ${statCard('ri-checkbox-circle-line', 'Đã hoàn', money(dp.refunds.reduce((s, r) => s + r.amount, 0)), `${dp.refunds.length} phiếu`, 'neutral')}
  </div>
  <div class="mt-5 mb-3 flex flex-wrap gap-2">${Object.entries(groups).map(([k, [l, li]]) => `<button type="button" data-dt="${k}" class="${chip(dp.tab === k)}">${l}<span class="opacity-75">${li ? li.length : dp.refunds.length}</span></button>`).join('')}</div>
  <p class="mb-3 text-xs text-foreground-500">${groups[dp.tab][2]}</p>
  <div class="${CARD} overflow-hidden">${
    dp.tab === 'done'
      ? dp.refunds.length ? table(['Mã đơn', 'Khách · sân', '>Số tiền', 'Hình thức', 'Ghi chú', 'Ngày lập', ''], dp.refunds.map((r) => `<tr><td class="px-4 py-3 font-mono text-xs font-bold">${esc(r.bookingCode)}</td><td class="px-4 py-3 text-xs">${esc(r.customerName)}<br>${esc(r.courtName)}</td><td class="px-4 py-3 text-right font-semibold">${money(r.amount)}</td><td class="px-4 py-3 text-xs">${{ cash: 'Tiền mặt', transfer: 'Chuyển khoản', vietqr: 'VietQR' }[r.method]}</td><td class="px-4 py-3 text-xs">${esc(r.note)}</td><td class="px-4 py-3 text-xs">${formatDateTime(r.createdAt)}</td><td class="px-4 py-3 text-right"><button type="button" data-unrefund="${r.id}" class="${BTN_SM_DANGER}">Gỡ</button></td></tr>`).join(''), 820) : `<div class="p-4">${emptyState('ri-refund-2-line', 'Chưa có phiếu hoàn cọc')}</div>`
      : groups[dp.tab][1].length ? table(['Đơn · khách', 'Sân · giờ', '>Tổng', '>Cọc', '>Còn lại', '>Thao tác'], rows(groups[dp.tab][1]), 860) : `<div class="p-4">${emptyState('ri-safe-2-line', 'Không có đơn nào trong mục này')}</div>`
  }</div>`;

  const root = main();
  const find = (id) => S.bookings.find((b) => b.id === id);
  on(root, 'click', '[data-dt]', (e, el) => { dp.tab = el.dataset.dt; renderDeposits(); });
  on(root, 'click', '[data-detail]', (e, el) => openBookingDetail(find(el.dataset.detail)));
  on(root, 'click', '[data-settle]', async (e, el) => {
    const b = find(el.dataset.settle);
    if (!(await confirmBox({ title: 'Ghi nhận thu đủ?', message: `Xác nhận đã thu ${money(b.totalPrice - b.depositAmount)} còn lại của đơn ${esc(b.code)}.`, confirmText: 'Đã thu đủ' }))) return;
    try {
      const u = await api('owner', 'mark_paid', { id: b.id, method: 'cash' });
      Object.assign(b, u);
      toast('Đã tất toán đơn.');
      renderDeposits();
    } catch (err) { toast(err.message, 'error'); }
  });
  on(root, 'click', '[data-refund]', (e, el) => {
    const b = find(el.dataset.refund);
    const m = modal(
      `Hoàn cọc đơn ${esc(b.code)}`,
      `<form class="grid grid-cols-2 gap-3"><div><label class="${LABEL}">Số tiền hoàn</label><input type="number" name="amount" value="${b.depositAmount}" class="${INPUT}"></div><div><label class="${LABEL}">Hình thức</label><select name="method" class="${INPUT}"><option value="transfer">Chuyển khoản</option><option value="cash">Tiền mặt</option><option value="vietqr">VietQR</option></select></div><div class="col-span-2"><label class="${LABEL}">Ghi chú</label><input name="note" class="${INPUT}" value="${esc(b.cancelReason || b.rejectReason || '')}"></div></form>`,
      `<button type="button" data-close class="${BTN_OUT}">Hủy</button><button type="button" data-ok class="${BTN}">Lập phiếu hoàn</button>`,
    );
    m.el.querySelector('[data-ok]').addEventListener('click', async (ev) => {
      const f = formData(m.el.querySelector('form'));
      setBusy(ev.currentTarget, true, 'Đang lưu...');
      try {
        await api('owner', 'refund_add', { bookingId: b.id, amount: Number(f.amount), method: f.method, note: f.note });
        dp.refunds = null;
        m.close();
        toast('Đã lập phiếu hoàn cọc.');
        renderDeposits();
      } catch (err) { setBusy(ev.currentTarget, false); toast(err.message, 'error'); }
    });
  });
  on(root, 'click', '[data-unrefund]', async (e, el) => {
    if (!(await confirmBox({ title: 'Gỡ phiếu hoàn cọc?', message: 'Đơn sẽ quay lại danh sách cần hoàn.', confirmText: 'Gỡ phiếu', danger: true }))) return;
    await api('owner', 'refund_remove', { id: el.dataset.unrefund });
    dp.refunds = null;
    renderDeposits();
  });
}
