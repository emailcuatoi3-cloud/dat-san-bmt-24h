/**
 * TRANG QUẢN TRỊ — vẽ từng mục theo ?tab=, dữ liệu lấy từ api/admin.php.
 */
import { api, esc, toast, confirmBox, setBusy, formData, on, statusBadge, emptyState, loadingBlock, errorBlock, formatDateTime, downloadCsv } from '../core/ui.js';
import { openInvoiceModal, invoiceBadge, filterByDate, exportInvoices } from '../core/invoice.js';
import { describeDiscount, describeConditions, promotionState } from '../lib/promotions.js';
import {
  PAGE, TODAY, main, actions, BTN, BTN_OUT, BTN_SM, BTN_SM_PRI, BTN_SM_DANGER, INPUT, LABEL, CARD,
  chip, statCard, sectionTitle, modal, slotText, dateText, longDate, money, sourceBadge,
} from './owner-shared.js';

const ROLE = { customer: 'Khách hàng', owner: 'Chủ sân', admin: 'Quản trị viên' };
const C = {}; // bộ nhớ đệm dữ liệu từng mục
const F = {}; // bộ lọc từng mục
const filter = (k, def) => (F[k] = F[k] || def);
const reload = (k) => { delete C[k]; render(); };
const table = (head, rows, min = 720) =>
  `<div class="overflow-x-auto"><table class="w-full text-sm" style="min-width:${min}px"><thead class="bg-background-100 text-left text-xs font-semibold uppercase tracking-wide text-foreground-500"><tr>${head.map((h) => `<th class="px-4 py-3 ${h.startsWith('>') ? 'text-right' : ''}">${h.replace(/^>/, '')}</th>`).join('')}</tr></thead><tbody class="divide-y divide-background-200">${rows}</tbody></table></div>`;
const td = (html, cls = '') => `<td class="px-4 py-3 ${cls}">${html}</td>`;
const search = (id, value, ph) => `<input id="${id}" value="${esc(value)}" class="${INPUT}" placeholder="${ph}">`;

async function get(key, action) {
  if (!C[key]) C[key] = await api('admin', action);
  return C[key];
}

/** Hộp nhập lý do / ghi chú: trả về chuỗi hoặc null nếu bỏ qua */
function askNote(title, label, { min = 0, value = '', confirm = 'Xác nhận', danger = false } = {}) {
  return new Promise((resolve) => {
    let done = false;
    const m = modal(title, `<label class="${LABEL}">${label}</label><textarea rows="3" class="${INPUT}">${esc(value)}</textarea>`, `<button type="button" data-close class="${BTN_OUT}">Hủy</button><button type="button" data-ok class="${BTN} ${danger ? '!bg-accent-600 hover:!bg-accent-700' : ''}">${confirm}</button>`);
    const close = m.close;
    m.el.querySelector('[data-ok]').addEventListener('click', () => {
      const v = m.el.querySelector('textarea').value.trim();
      if (v.length < min) return toast(`Vui lòng nhập ít nhất ${min} ký tự.`, 'error');
      done = true;
      close();
      resolve(v);
    });
    m.el.closest('.fixed').addEventListener('click', (e) => { if (!done && e.target.closest('[data-close]')) resolve(null); });
  });
}

async function run(promise, msg, key) {
  try {
    await promise;
    if (msg) toast(msg);
    if (key) reload(key);
    return true;
  } catch (e) {
    toast(e.message, 'error');
    return false;
  }
}

// =====================================================================
// TỔNG QUAN
// =====================================================================
async function renderOverview() {
  const d = await get('overview', 'overview');
  const t = d.totals;
  const max = Math.max(1, ...d.days.map((x) => x.revenue));
  const wd = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
  const totalStatus = Object.values(d.statuses).reduce((s, n) => s + n, 0) || 1;
  const sColor = { pending: 'bg-accent-500', confirmed: 'bg-primary-500', completed: 'bg-secondary-500', cancelled: 'bg-foreground-300' };
  const sLabel = { pending: 'Chờ xác nhận', confirmed: 'Đã xác nhận', completed: 'Hoàn thành', cancelled: 'Đã hủy' };
  const lvl = { info: 'bg-secondary-500', success: 'bg-primary-500', warning: 'bg-accent-400', danger: 'bg-accent-600' };
  main().innerHTML = `
  <div class="grid grid-cols-2 gap-3 lg:grid-cols-4">
    ${statCard('ri-group-line', 'Tài khoản', t.users, `${t.suspended} đang bị khóa`)}
    ${statCard('ri-football-line', 'Sân trên hệ thống', t.courts, `${t.activeCourts} đang hoạt động`, 'secondary')}
    ${statCard('ri-calendar-check-line', 'Tổng đơn', t.bookings, `${d.statuses.pending} chờ xác nhận`, 'accent')}
    ${statCard('ri-money-dollar-circle-line', 'Doanh thu tháng này', money(t.monthRevenue), 'Đơn đã xác nhận & hoàn thành', 'neutral')}
  </div>
  ${t.openReports || t.pendingReviews ? `<a href="?tab=moderation" class="mt-4 flex items-center gap-2 rounded-lg border border-accent-300 bg-accent-50 px-4 py-3 text-sm text-accent-800"><i class="ri-alarm-warning-line"></i>Có <b>${t.openReports}</b> báo cáo vi phạm chưa xử lý và <b>${t.pendingReviews}</b> đánh giá chờ duyệt.<span class="ml-auto font-semibold">Xử lý ngay →</span></a>` : ''}
  ${t.pendingOwnerRequests ? `<a href="?tab=accounts" class="mt-3 flex items-center gap-2 rounded-lg border border-accent-300 bg-accent-50 px-4 py-3 text-sm text-accent-800"><i class="ri-store-2-line"></i>Có <b>${t.pendingOwnerRequests}</b> yêu cầu đăng ký chủ sân đang chờ duyệt.<span class="ml-auto font-semibold">Xem ngay →</span></a>` : ''}
  <div class="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-[1.5fr_1fr]">
    <section class="${CARD}">${sectionTitle('Doanh thu 7 ngày gần nhất')}
      <div class="p-4"><div class="flex h-48 items-end gap-3">${d.days.map((x) => `<div class="flex h-full flex-1 flex-col items-center justify-end gap-1" title="${money(x.revenue)} · ${x.count} đơn"><span class="text-[10px] font-semibold text-foreground-600">${x.revenue ? Math.round(x.revenue / 1000) + 'k' : ''}</span><div class="w-full rounded-t ${x.date === TODAY ? 'bg-accent-500' : 'bg-primary-500'}" style="height:${Math.max(x.revenue ? 3 : 0, (x.revenue / max) * 85)}%"></div></div>`).join('')}</div>
      <div class="mt-2 flex gap-3 text-center text-[11px] text-foreground-500">${d.days.map((x) => `<span class="flex-1">${wd[new Date(`${x.date}T00:00:00`).getDay()]}<br>${x.date.slice(8)}/${x.date.slice(5, 7)}</span>`).join('')}</div></div></section>
    <section class="${CARD}">${sectionTitle('Trạng thái đơn')}
      <div class="p-4"><div class="flex h-3 overflow-hidden rounded-full">${Object.entries(d.statuses).map(([k, n]) => `<div class="${sColor[k]}" style="width:${(n / totalStatus) * 100}%"></div>`).join('')}</div>
      <ul class="mt-4 space-y-2 text-sm">${Object.entries(d.statuses).map(([k, n]) => `<li class="flex items-center gap-2"><span class="h-2.5 w-2.5 rounded-full ${sColor[k]}"></span><span class="flex-1">${sLabel[k]}</span><b>${n}</b></li>`).join('')}</ul>
      <p class="mt-5 text-xs font-bold uppercase tracking-wide text-foreground-500">Cơ cấu tài khoản</p>
      <ul class="mt-2 space-y-2 text-sm">${Object.entries(ROLE).map(([k, l]) => `<li class="flex items-center justify-between"><span>${l}</span><b>${d.roles[k] || 0}</b></li>`).join('')}</ul></div></section>
  </div>
  <div class="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-2">
    <section class="${CARD} overflow-hidden">${sectionTitle('Sân doanh thu cao nhất')}${table(['Sân', '>Đơn', '>Doanh thu'], d.topCourts.map((c, i) => `<tr>${td(`<span class="mr-2 inline-flex h-5 w-5 items-center justify-center rounded-full ${i === 0 ? 'bg-accent-500 text-white' : 'bg-background-200'} text-[10px] font-bold">${i + 1}</span>${esc(c.name)}<span class="ml-1 text-xs text-foreground-500">${esc(c.area)}</span>`)}${td(c.count, 'text-right')}${td(money(c.revenue), 'text-right font-semibold')}</tr>`).join(''), 420)}</section>
    <section class="${CARD}">${sectionTitle('Thao tác quản trị gần đây', PAGE.access.allowed.includes('audit') ? '<a href="?tab=audit" class="text-xs font-semibold text-primary-700">Xem nhật ký</a>' : '')}
      <ul class="divide-y divide-background-200">${d.recentAudit.map((a) => `<li class="flex items-start gap-3 px-4 py-3"><span class="mt-1.5 h-2 w-2 shrink-0 rounded-full ${lvl[a.level]}"></span><div class="min-w-0"><p class="text-sm"><b>${esc(a.actor)}</b> · ${esc(a.action)}</p><p class="truncate text-xs text-foreground-500">${esc(a.target)} · ${formatDateTime(a.createdAt)}</p></div></li>`).join('') || '<li class="px-4 py-5 text-sm text-foreground-500">Chưa có thao tác.</li>'}</ul></section>
  </div>`;
}

// =====================================================================
// TÀI KHOẢN & PHÂN QUYỀN
// =====================================================================
function roleForm(d, role = null) {
  const r = role || { key: '', name: '', description: '', permissions: ['overview'] };
  const m = modal(
    role ? `Sửa bộ quyền: ${esc(r.name)}` : 'Tạo bộ quyền mới',
    `<form class="space-y-3"><div><label class="${LABEL}">Tên bộ quyền</label><input name="name" value="${esc(r.name)}" class="${INPUT}" placeholder="Biên tập viên nội dung"></div>
     <div><label class="${LABEL}">Mô tả</label><input name="description" value="${esc(r.description)}" class="${INPUT}"></div>
     <div><p class="${LABEL}">Mục được phép truy cập</p><div class="grid grid-cols-1 gap-2 sm:grid-cols-2">${d.modules.map((mo) => `<label class="flex cursor-pointer items-start gap-2 rounded-md border border-background-200 p-2.5 text-sm hover:border-primary-300"><input type="checkbox" name="perm" value="${mo.key}" ${r.permissions.includes(mo.key) || r.key === 'super_admin' ? 'checked' : ''} ${r.key === 'super_admin' ? 'disabled' : ''} class="mt-0.5 accent-primary-500"><span><b class="flex items-center gap-1"><i class="${mo.icon}"></i>${mo.label}${mo.danger ? ' <span class="text-[10px] text-accent-700">nhạy cảm</span>' : ''}</b><span class="text-xs text-foreground-500">${mo.description}</span></span></label>`).join('')}</div></div></form>`,
    `<button type="button" data-close class="${BTN_OUT}">Hủy</button><button type="button" data-ok class="${BTN}">Lưu bộ quyền</button>`,
    'max-w-2xl',
  );
  m.el.querySelector('[data-ok]').addEventListener('click', async (e) => {
    const f = m.el.querySelector('form');
    setBusy(e.currentTarget, true, 'Đang lưu...');
    if (await run(api('admin', 'role_save', { key: r.key, name: f.name.value, description: f.description.value, permissions: [...f.querySelectorAll('[name=perm]:checked')].map((i) => i.value) }), 'Đã lưu bộ quyền.', 'accounts')) m.close();
    else setBusy(e.currentTarget, false);
  });
}

/** Khối "Yêu cầu đăng ký chủ sân" ở đầu mục Tài khoản */
function ownerRequestsBlock(reqs, showAll) {
  const RS = { pending: ['Chờ duyệt', 'bg-accent-100 text-accent-800'], approved: ['Đã duyệt', 'bg-primary-50 text-primary-700'], rejected: ['Từ chối', 'bg-background-200 text-foreground-700'] };
  const pending = reqs.filter((r) => r.status === 'pending');
  const list = showAll ? reqs : pending;
  return `<section class="${CARD} mb-5 ${pending.length ? 'border-accent-300' : ''}">
    ${sectionTitle(`<i class="ri-store-2-line text-accent-600"></i> Yêu cầu đăng ký chủ sân ${pending.length ? `<span class="ml-1 rounded-full bg-accent-500 px-2 py-0.5 text-[11px] text-white">${pending.length} chờ duyệt</span>` : ''}`,
    reqs.length > pending.length ? `<button type="button" data-or-all class="text-xs font-semibold text-primary-700">${showAll ? 'Chỉ xem chờ duyệt' : `Xem cả đã xử lý (${reqs.length - pending.length})`}</button>` : '')}
    ${list.length ? `<div class="divide-y divide-background-200">${list.map((r) => `<div class="flex flex-col gap-3 px-4 py-4 md:flex-row md:items-start md:justify-between">
      <div class="min-w-0">
        <p class="flex flex-wrap items-center gap-2 font-semibold text-foreground-950">${esc(r.businessName)} <span class="rounded-full px-2 py-0.5 text-[11px] font-semibold ${RS[r.status][1]}">${RS[r.status][0]}</span></p>
        <p class="mt-1 text-xs text-foreground-600"><i class="ri-user-line"></i> ${esc(r.contactName)} · <a href="tel:${esc(r.phone)}" class="text-primary-700">${esc(r.phone)}</a> · ${esc(r.email)}</p>
        <p class="mt-0.5 text-xs text-foreground-600"><i class="ri-map-pin-line"></i> ${esc(r.address)} · ${esc(r.sportsLabel)} · ${r.courtCount} sân</p>
        ${r.note ? `<p class="mt-2 rounded bg-background-100 px-2.5 py-1.5 text-xs text-foreground-700">${esc(r.note)}</p>` : ''}
        ${r.adminNote || r.reviewedBy ? `<p class="mt-1.5 text-[11px] text-foreground-500">${r.reviewedBy ? `Xử lý bởi ${esc(r.reviewedBy)} · ${formatDateTime(r.reviewedAt)}` : ''}${r.adminNote ? ` — ${esc(r.adminNote)}` : ''}</p>` : ''}
        <p class="mt-1 text-[11px] text-foreground-400">Gửi lúc ${formatDateTime(r.createdAt)}</p>
      </div>
      ${r.status === 'pending' ? `<div class="flex shrink-0 gap-1.5"><button type="button" data-or-reject="${r.id}" class="${BTN_SM}"><i class="ri-close-line"></i>Từ chối</button><button type="button" data-or-approve="${r.id}" class="${BTN_SM_PRI}"><i class="ri-check-line"></i>Duyệt làm chủ sân</button></div>` : ''}
    </div>`).join('')}</div>` : '<p class="px-4 py-5 text-sm text-foreground-500">Không có yêu cầu nào đang chờ duyệt.</p>'}
  </section>`;
}

async function renderAccounts() {
  const d = await get('accounts', 'accounts');
  const reqs = await get('ownerReq', 'owner_requests');
  const f = filter('accounts', { role: 'all', status: 'all', q: '' });
  const q = f.q.toLowerCase();
  const list = d.users.filter((u) => f.role === 'all' || u.role === f.role).filter((u) => f.status === 'all' || u.status === f.status).filter((u) => !q || `${u.fullName} ${u.email} ${u.phone} ${u.businessName}`.toLowerCase().includes(q));
  const roleName = (k) => (d.roles.find((r) => r.key === k) || {}).name || 'Toàn quyền (mặc định)';
  const isSuper = PAGE.access.roleKey === 'super_admin';
  actions().innerHTML = `<button type="button" id="ac-csv" class="${BTN_OUT}"><i class="ri-file-excel-2-line"></i>Xuất danh sách</button>`;
  actions().querySelector('#ac-csv').onclick = () => downloadCsv([['Họ tên', 'Email', 'Điện thoại', 'Vai trò', 'Trạng thái', 'Ngày tạo'], ...list.map((u) => [u.fullName, u.email, u.phone, ROLE[u.role], u.status === 'active' ? 'Hoạt động' : 'Tạm khóa', (u.createdAt || '').slice(0, 10)])], `tai-khoan-${TODAY}.csv`);

  main().innerHTML = `
  ${ownerRequestsBlock(reqs, f.orAll)}
  <div class="grid grid-cols-2 gap-3 lg:grid-cols-4">
    ${statCard('ri-user-line', 'Khách hàng', d.users.filter((u) => u.role === 'customer').length)}
    ${statCard('ri-store-2-line', 'Chủ sân', d.users.filter((u) => u.role === 'owner').length, '', 'secondary')}
    ${statCard('ri-shield-user-line', 'Quản trị viên', d.users.filter((u) => u.role === 'admin').length, '', 'neutral')}
    ${statCard('ri-lock-line', 'Đang bị khóa', d.users.filter((u) => u.status === 'suspended').length, '', 'accent')}
  </div>
  <div class="mt-5 mb-3 flex flex-wrap gap-2">${[['all', 'Tất cả'], ...Object.entries(ROLE)].map(([k, l]) => `<button type="button" data-role-f="${k}" class="${chip(f.role === k)}">${l}</button>`).join('')}<span class="mx-1 w-px bg-background-300"></span>${[['all', 'Mọi trạng thái'], ['active', 'Hoạt động'], ['suspended', 'Tạm khóa']].map(([k, l]) => `<button type="button" data-status-f="${k}" class="${chip(f.status === k)}">${l}</button>`).join('')}</div>
  <div class="mb-4">${search('ac-q', f.q, 'Tìm theo tên, email, số điện thoại, tên cơ sở...')}</div>
  <div class="${CARD} overflow-hidden">${list.length ? table(['Tài khoản', 'Vai trò', 'Bộ quyền quản trị', 'Hoạt động', 'Trạng thái', '>Thao tác'], list.map((u) => {
    const me = u.id === d.me;
    return `<tr class="${u.status === 'suspended' ? 'bg-accent-50/40' : ''}">
      ${td(`<p class="font-semibold">${esc(u.fullName || '—')} ${me ? '<span class="rounded bg-primary-50 px-1.5 text-[10px] text-primary-700">Bạn</span>' : ''}</p><p class="text-xs text-foreground-500">${esc(u.email)}${u.phone ? ' · ' + esc(u.phone) : ''}</p>${u.businessName && u.role === 'owner' ? `<p class="text-xs text-secondary-700">${esc(u.businessName)}</p>` : ''}`)}
      ${td(`<select data-role="${u.id}" ${me ? 'disabled' : ''} class="rounded-md border border-background-300 bg-white px-2 py-1.5 text-xs font-semibold">${Object.entries(ROLE).map(([k, l]) => `<option value="${k}" ${u.role === k ? 'selected' : ''}>${l}</option>`).join('')}</select>`)}
      ${td(u.role === 'admin' ? `<select data-arole="${u.id}" class="max-w-[180px] rounded-md border border-background-300 bg-white px-2 py-1.5 text-xs">${`<option value="">Toàn quyền (mặc định)</option>`}${d.roles.map((r) => `<option value="${r.key}" ${u.adminRole === r.key ? 'selected' : ''}>${esc(r.name)}</option>`).join('')}</select>` : '<span class="text-xs text-foreground-400">—</span>')}
      ${td(`<span class="text-xs text-foreground-600">${u.role === 'owner' ? `${u.courtCount} sân` : `${u.bookingCount} đơn`}<br>Từ ${dateText((u.createdAt || '').slice(0, 10))}</span>`)}
      ${td(u.status === 'active' ? '<span class="rounded-full bg-primary-50 px-2 py-1 text-[11px] font-semibold text-primary-700">Hoạt động</span>' : '<span class="rounded-full bg-accent-100 px-2 py-1 text-[11px] font-semibold text-accent-800">Tạm khóa</span>')}
      ${td(me ? '' : `<div class="flex justify-end">${u.status === 'active' ? `<button type="button" data-lock="${u.id}" class="${BTN_SM_DANGER}"><i class="ri-lock-line"></i>Khóa</button>` : `<button type="button" data-unlock="${u.id}" class="${BTN_SM}"><i class="ri-lock-unlock-line"></i>Mở khóa</button>`}</div>`)}
    </tr>`;
  }).join(''), 900) : `<div class="p-4">${emptyState('ri-user-search-line', 'Không tìm thấy tài khoản')}</div>`}</div>
  <section class="${CARD} mt-6">${sectionTitle('Bộ quyền quản trị', isSuper ? `<button type="button" data-role-new class="${BTN_SM_PRI}"><i class="ri-add-line"></i>Tạo bộ quyền</button>` : '<span class="text-xs text-foreground-500">Chỉ Quản trị cấp cao được chỉnh</span>')}
    <div class="grid grid-cols-1 gap-3 p-4 md:grid-cols-2">${d.roles.map((r) => `<div class="rounded-md border border-background-200 p-4"><div class="flex items-start justify-between gap-2"><div><p class="font-semibold">${esc(r.name)}</p><p class="text-xs text-foreground-500">${esc(r.description)}</p></div><span class="whitespace-nowrap text-xs text-foreground-500">${d.users.filter((u) => u.adminRole === r.key).length} người</span></div>
      <div class="mt-2 flex flex-wrap gap-1">${(r.key === 'super_admin' ? d.modules.map((m) => m.key) : r.permissions).map((k) => `<span class="rounded bg-background-100 px-1.5 py-0.5 text-[11px]">${(d.modules.find((m) => m.key === k) || {}).label || k}</span>`).join('')}</div>
      ${isSuper ? `<div class="mt-3 flex gap-1.5"><button type="button" data-role-edit="${r.key}" class="${BTN_SM}"><i class="ri-edit-line"></i>Sửa</button>${r.key !== 'super_admin' ? `<button type="button" data-role-del="${r.key}" class="${BTN_SM_DANGER}"><i class="ri-delete-bin-line"></i>Xóa</button>` : ''}</div>` : ''}</div>`).join('')}</div></section>`;

  const root = main();
  const user = (id) => d.users.find((u) => u.id === Number(id));
  on(root, 'click', '[data-role-f]', (e, el) => { f.role = el.dataset.roleF; render(); });
  on(root, 'click', '[data-or-all]', () => { f.orAll = !f.orAll; render(); });
  const reviewReq = (id, decision, note) => { delete C.ownerReq; return run(api('admin', 'owner_request_review', { id, decision, note }), decision === 'approve' ? 'Đã duyệt — tài khoản đã được mở kênh chủ sân.' : 'Đã từ chối yêu cầu.', 'accounts'); };
  on(root, 'click', '[data-or-approve]', async (e, el) => {
    const r = reqs.find((x) => x.id === el.dataset.orApprove);
    if (await confirmBox({ title: 'Duyệt làm chủ sân?', message: `Tài khoản <b>${esc(r.email)}</b> sẽ trở thành chủ sân của "<b>${esc(r.businessName)}</b>" và vào được kênh chủ sân.`, confirmText: 'Duyệt' })) reviewReq(r.id, 'approve', '');
  });
  on(root, 'click', '[data-or-reject]', async (e, el) => {
    const note = await askNote('Từ chối đăng ký chủ sân', 'Lý do (người đăng ký sẽ thấy nội dung này)', { min: 5, confirm: 'Từ chối', danger: true });
    if (note !== null) reviewReq(el.dataset.orReject, 'reject', note);
  });
  on(root, 'click', '[data-status-f]', (e, el) => { f.status = el.dataset.statusF; render(); });
  root.querySelector('#ac-q').addEventListener('change', (e) => { f.q = e.target.value; render(); });
  root.addEventListener('change', async (e) => {
    const r = e.target.closest('[data-role]');
    if (r) {
      const u = user(r.dataset.role);
      if (await confirmBox({ title: 'Đổi vai trò tài khoản?', message: `${esc(u.email)}: ${ROLE[u.role]} → <b>${ROLE[r.value]}</b>.`, confirmText: 'Đổi vai trò' })) run(api('admin', 'account_role', { id: u.id, role: r.value }), 'Đã đổi vai trò.', 'accounts');
      else r.value = u.role;
    }
    const a = e.target.closest('[data-arole]');
    if (a) run(api('admin', 'assign_admin_role', { id: Number(a.dataset.arole), roleKey: a.value }), a.value ? `Đã gán bộ quyền "${roleName(a.value)}".` : 'Đã thu hồi bộ quyền.', 'accounts');
  });
  on(root, 'click', '[data-lock]', async (e, el) => {
    const u = user(el.dataset.lock);
    const reason = await askNote(`Tạm khóa ${esc(u.email)}`, 'Lý do khóa (ghi vào nhật ký)', { min: 5, confirm: 'Khóa tài khoản', danger: true });
    if (reason !== null) run(api('admin', 'account_status', { id: u.id, status: 'suspended', reason }), 'Đã tạm khóa tài khoản.', 'accounts');
  });
  on(root, 'click', '[data-unlock]', (e, el) => run(api('admin', 'account_status', { id: Number(el.dataset.unlock), status: 'active' }), 'Đã mở khóa tài khoản.', 'accounts'));
  on(root, 'click', '[data-role-new]', () => roleForm(d));
  on(root, 'click', '[data-role-edit]', (e, el) => roleForm(d, d.roles.find((r) => r.key === el.dataset.roleEdit)));
  on(root, 'click', '[data-role-del]', async (e, el) => {
    if (await confirmBox({ title: 'Xóa bộ quyền?', message: 'Bộ quyền chưa gán cho ai mới xóa được.', confirmText: 'Xóa', danger: true })) run(api('admin', 'role_delete', { key: el.dataset.roleDel }), 'Đã xóa bộ quyền.', 'accounts');
  });
}

// =====================================================================
// SÂN & CƠ SỞ
// =====================================================================
async function renderCourts() {
  const d = await get('courts', 'courts');
  const f = filter('courts', { status: 'all', sport: 'all', q: '' });
  const q = f.q.toLowerCase();
  const st = (c) => (c.deletedAt ? 'removed' : c.status);
  const list = d.courts.filter((c) => f.status === 'all' || st(c) === f.status).filter((c) => f.sport === 'all' || c.sport === f.sport).filter((c) => !q || `${c.name} ${c.address} ${c.ownerName} ${c.area}`.toLowerCase().includes(q));
  const count = (s) => d.courts.filter((c) => st(c) === s).length;
  main().innerHTML = `
  <div class="grid grid-cols-2 gap-3 lg:grid-cols-4">
    ${statCard('ri-football-line', 'Tổng sân', d.courts.filter((c) => !c.deletedAt).length)}
    ${statCard('ri-checkbox-circle-line', 'Đang hoạt động', count('active'), '', 'secondary')}
    ${statCard('ri-pause-circle-line', 'Tạm dừng / bảo trì', count('paused') + count('maintenance'), '', 'accent')}
    ${statCard('ri-delete-bin-line', 'Đã gỡ', count('removed'), '', 'neutral')}
  </div>
  <div class="mt-5 mb-3 flex flex-wrap gap-2">${[['all', 'Tất cả'], ['active', 'Hoạt động'], ['maintenance', 'Bảo trì'], ['paused', 'Tạm dừng'], ['removed', 'Đã gỡ']].map(([k, l]) => `<button type="button" data-sf="${k}" class="${chip(f.status === k)}">${l}</button>`).join('')}<span class="mx-1 w-px bg-background-300"></span>${[['all', 'Mọi môn'], ['football', 'Bóng đá'], ['badminton', 'Cầu lông']].map(([k, l]) => `<button type="button" data-sp="${k}" class="${chip(f.sport === k)}">${l}</button>`).join('')}</div>
  <div class="mb-4">${search('ct-q', f.q, 'Tìm tên sân, địa chỉ, chủ sân...')}</div>
  <div class="${CARD} overflow-hidden">${list.length ? table(['Sân', 'Chủ sân', '>Đơn · doanh thu', 'Đánh giá', 'Trạng thái', '>Thao tác'], list.map((c) => `<tr class="${c.deletedAt ? 'opacity-60' : ''}">
    ${td(`<div class="flex items-center gap-3"><img src="${esc(c.image)}" alt="" class="h-10 w-14 rounded bg-background-200 object-cover" loading="lazy"><div class="min-w-0"><a href="${esc((window.APP.base || '') + '/san/' + c.slug)}" target="_blank" class="font-semibold hover:text-primary-700">${esc(c.name)}</a>${c.featured ? ' <i class="ri-star-fill text-accent-500" title="Nổi bật"></i>' : ''}<p class="truncate text-xs text-foreground-500">${esc(c.sportLabel)} · ${esc(c.area)}</p></div></div>`)}
    ${td(`<select data-owner="${c.id}" class="max-w-[170px] rounded-md border border-background-300 bg-white px-2 py-1.5 text-xs"><option value="0">Hệ thống</option>${d.owners.map((o) => `<option value="${o.id}" ${c.ownerId === o.id ? 'selected' : ''}>${esc(o.name)}</option>`).join('')}</select>`)}
    ${td(`${c.bookingCount} đơn<br><b>${money(c.revenue)}</b>`, 'text-right text-xs')}
    ${td(`<i class="ri-star-fill text-accent-500"></i> ${c.rating.toFixed(1)} <span class="text-xs text-foreground-500">(${c.reviewCount})</span>`, 'whitespace-nowrap')}
    ${td(c.deletedAt ? '<span class="rounded-full bg-background-200 px-2 py-1 text-[11px] font-semibold">Đã gỡ</span>' : statusBadge(c.status))}
    ${td(`<div class="flex justify-end gap-1.5">${c.deletedAt ? `<button type="button" data-restore="${c.id}" class="${BTN_SM}"><i class="ri-arrow-go-back-line"></i>Khôi phục</button>` : `${c.status === 'active' ? `<button type="button" data-pause="${c.id}" class="${BTN_SM}"><i class="ri-pause-line"></i>Tạm dừng</button>` : `<button type="button" data-open="${c.id}" class="${BTN_SM_PRI}"><i class="ri-play-line"></i>Mở lại</button>`}<button type="button" data-feat="${c.id}" class="${BTN_SM}" title="Nổi bật"><i class="${c.featured ? 'ri-star-fill text-accent-500' : 'ri-star-line'}"></i></button><button type="button" data-remove="${c.id}" class="${BTN_SM_DANGER}"><i class="ri-delete-bin-line"></i></button>`}</div>`)}
  </tr>`).join(''), 960) : `<div class="p-4">${emptyState('ri-football-line', 'Không có sân phù hợp')}</div>`}</div>`;

  const root = main();
  const court = (id) => d.courts.find((c) => c.id === id);
  on(root, 'click', '[data-sf]', (e, el) => { f.status = el.dataset.sf; render(); });
  on(root, 'click', '[data-sp]', (e, el) => { f.sport = el.dataset.sp; render(); });
  root.querySelector('#ct-q').addEventListener('change', (e) => { f.q = e.target.value; render(); });
  root.addEventListener('change', (e) => { const s = e.target.closest('[data-owner]'); if (s) run(api('admin', 'court_owner', { id: s.dataset.owner, ownerId: Number(s.value) }), 'Đã đổi chủ sân phụ trách.', 'courts'); });
  on(root, 'click', '[data-pause]', async (e, el) => {
    const reason = await askNote(`Tạm dừng ${esc(court(el.dataset.pause).name)}`, 'Lý do tạm dừng (sân sẽ ẩn khỏi trang tìm sân)', { min: 5, confirm: 'Tạm dừng sân', danger: true });
    if (reason !== null) run(api('admin', 'court_status', { id: el.dataset.pause, status: 'paused', reason }), 'Đã tạm dừng sân.', 'courts');
  });
  on(root, 'click', '[data-open]', (e, el) => run(api('admin', 'court_status', { id: el.dataset.open, status: 'active' }), 'Sân đã hoạt động trở lại.', 'courts'));
  on(root, 'click', '[data-feat]', (e, el) => run(api('admin', 'court_featured', { id: el.dataset.feat }), 'Đã cập nhật sân nổi bật.', 'courts'));
  on(root, 'click', '[data-restore]', (e, el) => run(api('admin', 'court_remove', { id: el.dataset.restore, restore: true }), 'Đã khôi phục sân (đang tạm dừng).', 'courts'));
  on(root, 'click', '[data-remove]', async (e, el) => {
    const reason = await askNote(`Gỡ ${esc(court(el.dataset.remove).name)} khỏi nền tảng`, 'Lý do gỡ sân', { min: 5, confirm: 'Gỡ sân', danger: true });
    if (reason !== null) run(api('admin', 'court_remove', { id: el.dataset.remove, reason }), 'Đã gỡ sân khỏi nền tảng.', 'courts');
  });
}

// =====================================================================
// ĐƠN ĐẶT SÂN
// =====================================================================
function bookingDetail(b) {
  const row = (l, v) => `<div class="flex justify-between gap-3 py-1.5 text-sm"><span class="text-foreground-500">${l}</span><span class="text-right font-medium">${v}</span></div>`;
  modal(`Đơn ${esc(b.code)}`, `<div class="mb-3 flex gap-2">${statusBadge(b.status)}${sourceBadge(b)}</div>${row('Khách hàng', esc(b.customerName))}${row('Điện thoại', esc(b.customerPhone || '—'))}${row('Email', esc(b.customerEmail || '—'))}${row('Sân', esc(b.courtName))}${row('Ngày chơi', longDate(b.date))}${row('Khung giờ', slotText(b))}${b.promoCode ? row('Mã ưu đãi', `${esc(b.promoCode)} (-${money(b.discount)})`) : ''}${row('Tổng tiền', `<b class="text-primary-700">${money(b.totalPrice)}</b>`)}${row('Thanh toán', esc(b.payment))}${b.rejectReason ? row('Lý do từ chối', esc(b.rejectReason)) : ''}${b.cancelReason ? row('Lý do hủy', esc(b.cancelReason)) : ''}${row('Tạo lúc', formatDateTime(b.createdAt))}`, `<button type="button" data-close class="${BTN_OUT}">Đóng</button>`);
}

async function renderBookings() {
  const list0 = await get('bookings', 'bookings');
  const f = filter('bookings', { status: 'all', source: 'all', q: '', from: '', to: '' });
  const q = f.q.toLowerCase();
  const list = list0.filter((b) => f.status === 'all' || b.status === f.status).filter((b) => f.source === 'all' || b.source === f.source).filter((b) => (!f.from || b.date >= f.from) && (!f.to || b.date <= f.to)).filter((b) => !q || `${b.code} ${b.customerName} ${b.customerPhone} ${b.courtName}`.toLowerCase().includes(q));
  const cnt = (s) => list0.filter((b) => s === 'all' || b.status === s).length;
  actions().innerHTML = `<button type="button" id="bk-csv" class="${BTN_OUT}"><i class="ri-file-excel-2-line"></i>Xuất Excel</button>`;
  actions().querySelector('#bk-csv').onclick = () => downloadCsv([['Mã đơn', 'Nguồn', 'Sân', 'Khách', 'Điện thoại', 'Ngày', 'Khung giờ', 'Tổng tiền', 'Trạng thái'], ...list.map((b) => [b.code, b.source === 'online' ? 'Online' : 'Tại quầy', b.courtName, b.customerName, b.customerPhone, b.date, slotText(b), b.totalPrice, b.status])], `don-dat-san-${TODAY}.csv`);
  main().innerHTML = `
  <div class="mb-3 flex flex-wrap gap-2">${[['all', 'Tất cả'], ['pending', 'Chờ xác nhận'], ['confirmed', 'Đã xác nhận'], ['completed', 'Hoàn thành'], ['cancelled', 'Đã hủy']].map(([k, l]) => `<button type="button" data-st="${k}" class="${chip(f.status === k)}">${l}<span class="opacity-75">${cnt(k)}</span></button>`).join('')}</div>
  <div class="mb-4 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-[1fr_170px_160px_160px]">${search('bk-q', f.q, 'Tìm mã đơn, khách, sân...')}<select id="bk-src" class="${INPUT}"><option value="all">Mọi nguồn</option><option value="online" ${f.source === 'online' ? 'selected' : ''}>Online</option><option value="owner" ${f.source === 'owner' ? 'selected' : ''}>Tại quầy</option></select><input id="bk-from" type="date" value="${f.from}" class="${INPUT}"><input id="bk-to" type="date" value="${f.to}" class="${INPUT}"></div>
  <div class="${CARD} overflow-hidden">${list.length ? table(['Đơn', 'Khách', 'Sân · giờ', '>Tiền', 'Trạng thái', '>Thao tác'], list.slice(0, 300).map((b) => `<tr>
    ${td(`<button type="button" data-detail="${b.id}" class="font-mono text-xs font-bold text-primary-700 hover:underline">${esc(b.code)}</button><div class="mt-1">${sourceBadge(b)}</div>`)}
    ${td(`<p class="font-semibold">${esc(b.customerName)}</p><p class="text-xs text-foreground-500">${esc(b.customerPhone || '')}</p>`)}
    ${td(`<p>${esc(b.courtName)}</p><p class="text-xs text-foreground-500">${dateText(b.date)} · ${slotText(b)}</p>`)}
    ${td(`<b>${money(b.totalPrice)}</b><p class="text-[11px] text-foreground-500">${esc(b.payment)}</p>`, 'text-right')}
    ${td(statusBadge(b.status))}
    ${td(b.status === 'pending' ? `<div class="flex justify-end gap-1.5"><button type="button" data-reject="${b.id}" class="${BTN_SM}">Từ chối</button><button type="button" data-approve="${b.id}" class="${BTN_SM_PRI}">Duyệt</button></div>` : `<div class="flex justify-end"><button type="button" data-detail="${b.id}" class="${BTN_SM}">Chi tiết</button></div>`)}
  </tr>`).join(''), 900) : `<div class="p-4">${emptyState('ri-calendar-close-line', 'Không có đơn phù hợp')}</div>`}</div>`;
  const root = main();
  const find = (id) => list0.find((b) => b.id === id);
  on(root, 'click', '[data-st]', (e, el) => { f.status = el.dataset.st; render(); });
  [['#bk-q', 'q'], ['#bk-src', 'source'], ['#bk-from', 'from'], ['#bk-to', 'to']].forEach(([s, k]) => root.querySelector(s).addEventListener('change', (e) => { f[k] = e.target.value; render(); }));
  on(root, 'click', '[data-detail]', (e, el) => bookingDetail(find(el.dataset.detail)));
  on(root, 'click', '[data-approve]', (e, el) => run(api('admin', 'booking_status', { id: el.dataset.approve, status: 'confirmed' }), 'Đã duyệt đơn.', 'bookings'));
  on(root, 'click', '[data-reject]', async (e, el) => {
    const reason = await askNote('Từ chối đơn', 'Lý do gửi cho khách', { min: 5, confirm: 'Từ chối đơn', danger: true });
    if (reason !== null) run(api('admin', 'booking_status', { id: el.dataset.reject, status: 'cancelled', reason }), 'Đã từ chối đơn.', 'bookings');
  });
}

// =====================================================================
// HÓA ĐƠN & CÔNG NỢ
// =====================================================================
async function renderInvoices() {
  const all = await get('invoices', 'invoices');
  const f = filter('invoices', { status: 'all', source: 'all', q: '', from: '', to: '' });
  const q = f.q.toLowerCase();
  const ranged = filterByDate(all, f.from, f.to).filter((i) => f.source === 'all' || i.source === f.source);
  const list = ranged.filter((i) => f.status === 'all' || i.status === f.status).filter((i) => !q || `${i.code} ${i.customerName} ${i.courtName}`.toLowerCase().includes(q));
  const sum = (k) => ranged.reduce((s, i) => s + i[k], 0);
  actions().innerHTML = `<button type="button" id="inv-csv" class="${BTN_OUT}"><i class="ri-file-excel-2-line"></i>Xuất Excel (CSV)</button>`;
  actions().querySelector('#inv-csv').onclick = () => exportInvoices(list, `hoa-don-he-thong-${TODAY}.csv`);
  main().innerHTML = `
  <div class="grid grid-cols-2 gap-3 lg:grid-cols-4">${statCard('ri-bill-line', 'Số hóa đơn', ranged.length)}${statCard('ri-money-dollar-circle-line', 'Doanh thu', money(sum('total')), '', 'secondary')}${statCard('ri-checkbox-circle-line', 'Đã thu', money(sum('paid')))}${statCard('ri-error-warning-line', 'Công nợ', money(sum('debt')), '', 'accent')}</div>
  <div class="mt-5 mb-3 flex flex-wrap gap-2">${[['all', 'Tất cả'], ['paid', 'Đã thanh toán'], ['partial', 'Còn nợ'], ['unpaid', 'Chưa thu']].map(([k, l]) => `<button type="button" data-st="${k}" class="${chip(f.status === k)}">${l}</button>`).join('')}</div>
  <div class="mb-4 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-[1fr_180px_160px_160px]">${search('iv-q', f.q, 'Tìm mã hóa đơn, khách, sân...')}<select id="iv-src" class="${INPUT}"><option value="all">Mọi nguồn</option><option value="customer" ${f.source === 'customer' ? 'selected' : ''}>Khách đặt online</option><option value="owner" ${f.source === 'owner' ? 'selected' : ''}>Chủ sân nhập</option></select><input id="iv-from" type="date" value="${f.from}" class="${INPUT}"><input id="iv-to" type="date" value="${f.to}" class="${INPUT}"></div>
  <div class="${CARD} overflow-hidden">${list.length ? table(['Hóa đơn', 'Khách', 'Sân · ngày', '>Tổng', '>Công nợ', 'Trạng thái'], list.map((i) => `<tr data-inv="${esc(i.id)}" class="cursor-pointer hover:bg-background-50">${td(`<p class="font-mono text-xs font-bold text-primary-700">${esc(i.code)}</p><p class="text-[11px] text-foreground-500">${i.source === 'customer' ? 'Khách đặt online' : 'Chủ sân nhập'}</p>`)}${td(esc(i.customerName))}${td(`${esc(i.courtName)}<p class="text-xs text-foreground-500">${dateText(i.bookingDate)}</p>`)}${td(money(i.total), 'text-right font-semibold')}${td(money(i.debt), `text-right font-semibold ${i.debt ? 'text-accent-700' : 'text-primary-700'}`)}${td(invoiceBadge(i.status))}</tr>`).join(''), 820) : `<div class="p-4">${emptyState('ri-bill-line', 'Không có hóa đơn phù hợp')}</div>`}</div>`;
  const root = main();
  on(root, 'click', '[data-st]', (e, el) => { f.status = el.dataset.st; render(); });
  [['#iv-q', 'q'], ['#iv-src', 'source'], ['#iv-from', 'from'], ['#iv-to', 'to']].forEach(([s, k]) => root.querySelector(s).addEventListener('change', (e) => { f[k] = e.target.value; render(); }));
  on(root, 'click', '[data-inv]', (e, el) => openInvoiceModal(all.find((i) => i.id === el.dataset.inv)));
}

// =====================================================================
// DANH MỤC
// =====================================================================
function categoryForm(c = null, kind = 'sport') {
  const x = c || { kind, name: '', slug: '', description: '', icon: kind === 'sport' ? 'ri-football-line' : 'ri-map-pin-line', sortOrder: 0, active: true };
  const m = modal(c ? 'Sửa danh mục' : 'Thêm danh mục', `<form class="grid grid-cols-2 gap-3">
    <div><label class="${LABEL}">Loại</label><select name="kind" class="${INPUT}"><option value="sport" ${x.kind === 'sport' ? 'selected' : ''}>Môn thể thao</option><option value="area" ${x.kind === 'area' ? 'selected' : ''}>Khu vực</option></select></div>
    <div><label class="${LABEL}">Tên</label><input name="name" value="${esc(x.name)}" class="${INPUT}"></div>
    <div><label class="${LABEL}">Mã (slug)</label><input name="slug" value="${esc(x.slug)}" class="${INPUT}" placeholder="tự tạo nếu để trống"></div>
    <div><label class="${LABEL}">Biểu tượng (Remix Icon)</label><input name="icon" value="${esc(x.icon)}" class="${INPUT}"></div>
    <div class="col-span-2"><label class="${LABEL}">Mô tả</label><input name="description" value="${esc(x.description)}" class="${INPUT}"></div>
    <div><label class="${LABEL}">Thứ tự</label><input type="number" name="sortOrder" value="${x.sortOrder}" class="${INPUT}"></div>
    <label class="mt-6 flex items-center gap-2 text-sm"><input type="checkbox" name="active" ${x.active ? 'checked' : ''} class="accent-primary-500">Hiển thị cho khách</label></form>`,
    `<button type="button" data-close class="${BTN_OUT}">Hủy</button><button type="button" data-ok class="${BTN}">Lưu</button>`);
  m.el.querySelector('[data-ok]').addEventListener('click', async () => {
    const form = m.el.querySelector('form');
    if (await run(api('admin', 'category_save', { ...formData(form), id: c ? c.id : '', sortOrder: Number(form.sortOrder.value) || 0, active: form.active.checked }), 'Đã lưu danh mục.', 'categories')) m.close();
  });
}

async function renderCategories() {
  const list = await get('categories', 'categories');
  actions().innerHTML = `<button type="button" id="cat-add" class="${BTN}"><i class="ri-add-line"></i>Thêm danh mục</button>`;
  actions().querySelector('#cat-add').onclick = () => categoryForm();
  const col = (kind, title) => `<section class="${CARD}">${sectionTitle(title, `<button type="button" data-add="${kind}" class="${BTN_SM}"><i class="ri-add-line"></i>Thêm</button>`)}<ul class="divide-y divide-background-200">${list.filter((c) => c.kind === kind).map((c) => `<li class="flex items-center gap-3 px-4 py-3 ${c.active ? '' : 'opacity-60'}"><span class="flex h-9 w-9 items-center justify-center rounded-md bg-primary-50 text-primary-600"><i class="${esc(c.icon)}"></i></span><div class="min-w-0 flex-1"><p class="text-sm font-semibold">${esc(c.name)} ${c.active ? '' : '<span class="text-[10px] text-foreground-500">(ẩn)</span>'}</p><p class="truncate text-xs text-foreground-500">${esc(c.description || c.slug)} · ${c.courtCount} sân</p></div><button type="button" data-edit="${c.id}" class="${BTN_SM}"><i class="ri-edit-line"></i></button><button type="button" data-del="${c.id}" class="${BTN_SM_DANGER}"><i class="ri-delete-bin-line"></i></button></li>`).join('') || '<li class="px-4 py-5 text-sm text-foreground-500">Chưa có danh mục.</li>'}</ul></section>`;
  main().innerHTML = `<div class="grid grid-cols-1 gap-5 lg:grid-cols-2">${col('sport', 'Môn thể thao')}${col('area', 'Khu vực')}</div>`;
  const root = main();
  on(root, 'click', '[data-add]', (e, el) => categoryForm(null, el.dataset.add));
  on(root, 'click', '[data-edit]', (e, el) => categoryForm(list.find((c) => c.id === el.dataset.edit)));
  on(root, 'click', '[data-del]', async (e, el) => {
    const c = list.find((x) => x.id === el.dataset.del);
    if (await confirmBox({ title: `Xóa danh mục "${esc(c.name)}"?`, message: c.courtCount ? `Đang có ${c.courtCount} sân dùng danh mục này — sân vẫn giữ nguyên, chỉ bộ lọc bị mất.` : 'Danh mục sẽ bị xóa khỏi bộ lọc tìm sân.', confirmText: 'Xóa', danger: true }))
      run(api('admin', 'category_delete', { id: c.id }), 'Đã xóa danh mục.', 'categories');
  });
}

// =====================================================================
// NỘI DUNG WEBSITE
// =====================================================================
const KIND = { banner: ['Banner', 'ri-image-line'], news: ['Tin tức', 'ri-newspaper-line'], faq: ['Câu hỏi thường gặp', 'ri-question-answer-line'], policy: ['Chính sách', 'ri-file-shield-2-line'] };
const CSTATUS = { published: ['Đang hiển thị', 'bg-primary-50 text-primary-700'], draft: ['Bản nháp', 'bg-accent-50 text-accent-800'], archived: ['Lưu trữ', 'bg-background-100 text-foreground-600'] };

function contentForm(c = null, kind = 'news') {
  const x = c || { kind, title: '', summary: '', body: '', image: '', linkUrl: '', status: 'draft', pinned: false, sortOrder: 0 };
  const m = modal(c ? 'Sửa nội dung' : 'Thêm nội dung', `<form class="grid grid-cols-1 gap-3 sm:grid-cols-2">
    <div><label class="${LABEL}">Loại</label><select name="kind" class="${INPUT}">${Object.entries(KIND).map(([k, [l]]) => `<option value="${k}" ${x.kind === k ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
    <div><label class="${LABEL}">Trạng thái</label><select name="status" class="${INPUT}">${Object.entries(CSTATUS).map(([k, [l]]) => `<option value="${k}" ${x.status === k ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
    <div class="sm:col-span-2"><label class="${LABEL}">Tiêu đề / câu hỏi</label><input name="title" value="${esc(x.title)}" class="${INPUT}"></div>
    <div class="sm:col-span-2"><label class="${LABEL}">Tóm tắt</label><input name="summary" value="${esc(x.summary)}" class="${INPUT}"></div>
    <div class="sm:col-span-2"><label class="${LABEL}">Nội dung / câu trả lời</label><textarea name="body" rows="5" class="${INPUT}">${esc(x.body)}</textarea></div>
    <div><label class="${LABEL}">Ảnh (URL)</label><input name="image" value="${esc(x.image)}" class="${INPUT}"></div>
    <div><label class="${LABEL}">Đường dẫn khi bấm</label><input name="linkUrl" value="${esc(x.linkUrl)}" class="${INPUT}" placeholder="/uu-dai"></div>
    <div><label class="${LABEL}">Thứ tự</label><input type="number" name="sortOrder" value="${x.sortOrder}" class="${INPUT}"></div>
    <label class="mt-6 flex items-center gap-2 text-sm"><input type="checkbox" name="pinned" ${x.pinned ? 'checked' : ''} class="accent-primary-500">Ghim lên đầu</label></form>`,
    `<button type="button" data-close class="${BTN_OUT}">Hủy</button><button type="button" data-ok class="${BTN}">Lưu nội dung</button>`, 'max-w-2xl');
  m.el.querySelector('[data-ok]').addEventListener('click', async () => {
    const form = m.el.querySelector('form');
    if (await run(api('admin', 'content_save', { ...formData(form), id: c ? c.id : '', sortOrder: Number(form.sortOrder.value) || 0, pinned: form.pinned.checked }), 'Đã lưu nội dung.', 'contents')) m.close();
  });
}

async function renderContent() {
  const all = await get('contents', 'contents');
  const f = filter('content', { kind: 'all' });
  const list = all.filter((c) => f.kind === 'all' || c.kind === f.kind);
  actions().innerHTML = `<button type="button" id="ct-add" class="${BTN}"><i class="ri-add-line"></i>Thêm nội dung</button>`;
  actions().querySelector('#ct-add').onclick = () => contentForm(null, f.kind === 'all' ? 'news' : f.kind);
  main().innerHTML = `
  <div class="mb-4 flex flex-wrap gap-2"><button type="button" data-k="all" class="${chip(f.kind === 'all')}">Tất cả<span class="opacity-75">${all.length}</span></button>${Object.entries(KIND).map(([k, [l, i]]) => `<button type="button" data-k="${k}" class="${chip(f.kind === k)}"><i class="${i}"></i>${l}<span class="opacity-75">${all.filter((c) => c.kind === k).length}</span></button>`).join('')}</div>
  ${list.length ? `<div class="grid grid-cols-1 gap-3 md:grid-cols-2">${list.map((c) => `<article class="${CARD} flex gap-3 p-4">${c.image ? `<img src="${esc(c.image)}" alt="" class="h-20 w-28 shrink-0 rounded bg-background-200 object-cover" loading="lazy">` : `<span class="flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-background-100 text-foreground-500"><i class="${KIND[c.kind][1]} text-xl"></i></span>`}
    <div class="min-w-0 flex-1"><div class="flex flex-wrap items-center gap-1.5"><span class="rounded bg-background-100 px-1.5 py-0.5 text-[10px] font-semibold">${KIND[c.kind][0]}</span><span class="rounded-full px-2 py-0.5 text-[10px] font-semibold ${CSTATUS[c.status][1]}">${CSTATUS[c.status][0]}</span>${c.pinned ? '<i class="ri-pushpin-fill text-accent-500"></i>' : ''}</div>
    <p class="mt-1 font-semibold text-foreground-950">${esc(c.title)}</p><p class="line-clamp-2 text-xs text-foreground-500">${esc(c.summary || c.body)}</p>
    <div class="mt-2 flex items-center gap-1.5"><button type="button" data-edit="${c.id}" class="${BTN_SM}"><i class="ri-edit-line"></i>Sửa</button><button type="button" data-del="${c.id}" class="${BTN_SM_DANGER}"><i class="ri-delete-bin-line"></i></button><span class="ml-auto text-[11px] text-foreground-400">${formatDateTime(c.updatedAt)}</span></div></div></article>`).join('')}</div>` : emptyState('ri-article-line', 'Chưa có nội dung')}`;
  const root = main();
  on(root, 'click', '[data-k]', (e, el) => { f.kind = el.dataset.k; render(); });
  on(root, 'click', '[data-edit]', (e, el) => contentForm(all.find((c) => c.id === el.dataset.edit)));
  on(root, 'click', '[data-del]', async (e, el) => {
    if (await confirmBox({ title: 'Xóa nội dung?', message: 'Nội dung sẽ không còn hiển thị trên website.', confirmText: 'Xóa', danger: true })) run(api('admin', 'content_delete', { id: el.dataset.del }), 'Đã xóa nội dung.', 'contents');
  });
}

// =====================================================================
// KIỂM DUYỆT & BÁO CÁO
// =====================================================================
const RSTATUS = { open: ['Mới', 'bg-accent-100 text-accent-800'], reviewing: ['Đang xử lý', 'bg-secondary-50 text-secondary-800'], resolved: ['Đã xử lý', 'bg-primary-50 text-primary-700'], rejected: ['Bác bỏ', 'bg-background-100 text-foreground-600'] };
const MSTATUS = { approved: ['Đang hiển thị', 'bg-primary-50 text-primary-700'], pending: ['Chờ duyệt', 'bg-accent-50 text-accent-800'], hidden: ['Đã ẩn', 'bg-background-200 text-foreground-700'] };
const SEV = { low: ['Thấp', 'text-foreground-500'], medium: ['Trung bình', 'text-accent-700'], high: ['Cao', 'text-accent-800 font-bold'] };
const TTYPE = { review: 'Đánh giá', court: 'Sân', account: 'Tài khoản', booking: 'Đơn đặt sân' };

async function renderModeration() {
  const d = await get('moderation', 'moderation');
  const f = filter('moderation', { view: 'reviews', rs: 'all', ps: 'all' });
  const reviews = d.reviews.filter((r) => f.rs === 'all' || r.moderationStatus === f.rs);
  const reports = d.reports.filter((r) => f.ps === 'all' || r.status === f.ps);
  main().innerHTML = `
  <div class="grid grid-cols-2 gap-3 lg:grid-cols-4">${statCard('ri-time-line', 'Đánh giá chờ duyệt', d.reviews.filter((r) => r.moderationStatus === 'pending').length, '', 'accent')}${statCard('ri-eye-off-line', 'Đánh giá đã ẩn', d.reviews.filter((r) => r.moderationStatus === 'hidden').length, '', 'neutral')}${statCard('ri-flag-line', 'Báo cáo mới', d.reports.filter((r) => r.status === 'open').length, '', 'accent')}${statCard('ri-checkbox-circle-line', 'Báo cáo đã xử lý', d.reports.filter((r) => r.status === 'resolved').length)}</div>
  <div class="mt-5 mb-4 flex rounded-md border border-background-300 bg-white p-0.5 sm:inline-flex">${[['reviews', 'Đánh giá của khách'], ['reports', 'Báo cáo vi phạm']].map(([k, l]) => `<button type="button" data-view="${k}" class="flex-1 whitespace-nowrap rounded px-4 py-2 text-sm font-semibold ${f.view === k ? 'bg-primary-500 text-white' : 'text-foreground-700'}">${l}</button>`).join('')}</div>
  ${f.view === 'reviews' ? `
    <div class="mb-3 flex flex-wrap gap-2">${[['all', 'Tất cả'], ...Object.entries(MSTATUS).map(([k, [l]]) => [k, l])].map(([k, l]) => `<button type="button" data-rs="${k}" class="${chip(f.rs === k)}">${l}</button>`).join('')}</div>
    <div class="space-y-3">${reviews.map((r) => `<article class="${CARD} p-4"><div class="flex flex-wrap items-start justify-between gap-2"><div><p class="text-sm font-semibold">${esc(r.name)} <span class="text-accent-500">${'★'.repeat(r.rating)}</span></p><p class="text-xs text-foreground-500">${esc(r.courtName)} · ${esc(r.dateLabel)}${r.verified ? ' · Đã chơi' : ''}</p></div><span class="rounded-full px-2.5 py-1 text-[11px] font-semibold ${MSTATUS[r.moderationStatus][1]}">${MSTATUS[r.moderationStatus][0]}</span></div>
      <p class="mt-2 text-sm text-foreground-800">${esc(r.comment)}</p>
      ${r.moderationNote ? `<p class="mt-2 rounded bg-background-100 px-2.5 py-1.5 text-xs text-foreground-600"><i class="ri-sticky-note-line"></i> ${esc(r.moderationNote)}${r.moderatedBy ? ` — ${esc(r.moderatedBy)}` : ''}</p>` : ''}
      <div class="mt-3 flex gap-1.5">${r.moderationStatus !== 'approved' ? `<button type="button" data-approve="${r.id}" class="${BTN_SM_PRI}"><i class="ri-eye-line"></i>Cho hiển thị</button>` : ''}${r.moderationStatus !== 'hidden' ? `<button type="button" data-hide="${r.id}" class="${BTN_SM_DANGER}"><i class="ri-eye-off-line"></i>Ẩn đánh giá</button>` : ''}</div></article>`).join('') || emptyState('ri-star-smile-line', 'Không có đánh giá phù hợp')}</div>`
      : `
    <div class="mb-3 flex flex-wrap gap-2">${[['all', 'Tất cả'], ...Object.entries(RSTATUS).map(([k, [l]]) => [k, l])].map(([k, l]) => `<button type="button" data-ps="${k}" class="${chip(f.ps === k)}">${l}<span class="opacity-75">${d.reports.filter((r) => k === 'all' || r.status === k).length}</span></button>`).join('')}</div>
    <div class="space-y-3">${reports.map((r) => `<article class="${CARD} p-4"><div class="flex flex-wrap items-start justify-between gap-2"><div><p class="text-sm font-semibold"><i class="ri-flag-2-fill text-accent-600"></i> ${esc(r.reason)}</p><p class="text-xs text-foreground-500">${TTYPE[r.targetType]}: <b>${esc(r.targetLabel)}</b> · Người báo: ${esc(r.reporterName)}${r.reporterContact ? ` (${esc(r.reporterContact)})` : ''} · ${formatDateTime(r.createdAt)}</p></div><div class="flex items-center gap-2"><span class="text-xs ${SEV[r.severity][1]}">Mức ${SEV[r.severity][0]}</span><span class="rounded-full px-2.5 py-1 text-[11px] font-semibold ${RSTATUS[r.status][1]}">${RSTATUS[r.status][0]}</span></div></div>
      ${r.detail ? `<p class="mt-2 text-sm text-foreground-700">${esc(r.detail)}</p>` : ''}
      ${r.resolutionNote ? `<p class="mt-2 rounded bg-primary-50 px-2.5 py-1.5 text-xs text-primary-800"><b>Kết quả:</b> ${esc(r.resolutionNote)}${r.resolvedAt ? ` · ${formatDateTime(r.resolvedAt)}` : ''}</p>` : ''}
      <div class="mt-3 flex flex-wrap gap-1.5">${r.status === 'open' ? `<button type="button" data-rp="${r.id}" data-to="reviewing" class="${BTN_SM}"><i class="ri-hand-heart-line"></i>Tiếp nhận</button>` : ''}${['open', 'reviewing'].includes(r.status) ? `<button type="button" data-rp="${r.id}" data-to="resolved" class="${BTN_SM_PRI}"><i class="ri-check-line"></i>Đã xử lý</button><button type="button" data-rp="${r.id}" data-to="rejected" class="${BTN_SM}"><i class="ri-close-line"></i>Bác bỏ</button>` : `<button type="button" data-rp="${r.id}" data-to="open" class="${BTN_SM}"><i class="ri-arrow-go-back-line"></i>Mở lại</button>`}</div></article>`).join('') || emptyState('ri-flag-line', 'Không có báo cáo')}</div>`}`;
  const root = main();
  on(root, 'click', '[data-view]', (e, el) => { f.view = el.dataset.view; render(); });
  on(root, 'click', '[data-rs]', (e, el) => { f.rs = el.dataset.rs; render(); });
  on(root, 'click', '[data-ps]', (e, el) => { f.ps = el.dataset.ps; render(); });
  on(root, 'click', '[data-approve]', (e, el) => run(api('admin', 'review_moderate', { id: el.dataset.approve, status: 'approved' }), 'Đánh giá đã hiển thị.', 'moderation'));
  on(root, 'click', '[data-hide]', async (e, el) => {
    const note = await askNote('Ẩn đánh giá', 'Lý do ẩn (lưu trong ghi chú kiểm duyệt)', { min: 5, confirm: 'Ẩn đánh giá', danger: true });
    if (note !== null) run(api('admin', 'review_moderate', { id: el.dataset.hide, status: 'hidden', note }), 'Đã ẩn đánh giá.', 'moderation');
  });
  on(root, 'click', '[data-rp]', async (e, el) => {
    const to = el.dataset.to;
    const rep = d.reports.find((r) => r.id === el.dataset.rp);
    let note = rep.resolutionNote;
    if (to === 'resolved' || to === 'rejected') {
      note = await askNote(to === 'resolved' ? 'Ghi kết quả xử lý' : 'Lý do bác bỏ', 'Nội dung', { min: 5, value: rep.resolutionNote });
      if (note === null) return;
    }
    run(api('admin', 'report_update', { id: rep.id, status: to, note }), 'Đã cập nhật báo cáo.', 'moderation');
  });
}

// =====================================================================
// KHUYẾN MÃI
// =====================================================================
const PSTATE = { active: ['Đang chạy', 'bg-primary-50 text-primary-700'], upcoming: ['Sắp diễn ra', 'bg-secondary-50 text-secondary-800'], expired: ['Hết hạn', 'bg-background-100 text-foreground-600'], paused: ['Tạm dừng', 'bg-accent-50 text-accent-800'] };

async function renderPromotions() {
  const d = await get('promotions', 'promotions');
  const valid = d.redemptions.filter((r) => r.status !== 'cancelled');
  const rows = d.promotions.map((p) => { const l = valid.filter((r) => r.code === p.code); return { p, uses: l.length, discount: l.reduce((s, r) => s + r.discount, 0), revenue: l.reduce((s, r) => s + r.paidTotal, 0), st: promotionState(p, TODAY) }; }).sort((a, b) => b.revenue - a.revenue);
  const totalDisc = valid.reduce((s, r) => s + r.discount, 0);
  const totalRev = valid.reduce((s, r) => s + r.paidTotal, 0);
  main().innerHTML = `
  <div class="grid grid-cols-2 gap-3 lg:grid-cols-4">${statCard('ri-coupon-3-line', 'Mã đang chạy', rows.filter((r) => r.st === 'active').length, `${rows.length} mã trên hệ thống`)}${statCard('ri-shopping-bag-3-line', 'Lượt sử dụng', valid.length, '', 'secondary')}${statCard('ri-price-tag-3-line', 'Ngân sách đã giảm', money(totalDisc), '', 'accent')}${statCard('ri-money-dollar-circle-line', 'Doanh thu mang lại', money(totalRev), totalDisc ? `ROI ≈ ${(totalRev / totalDisc).toFixed(1)} lần` : '', 'neutral')}</div>
  <section class="${CARD} mt-5 overflow-hidden">${sectionTitle('Xếp hạng hiệu quả mã giảm giá')}${rows.length ? table(['#', 'Mã · chương trình', 'Đơn vị phát hành', 'Điều kiện', '>Lượt dùng', '>Đã giảm', '>Doanh thu', 'Trạng thái', ''], rows.map((r, i) => `<tr>${td(`<b>${i + 1}</b>`)}${td(`<p class="font-mono font-bold text-primary-700">${esc(r.p.code)}</p><p class="text-xs">${esc(r.p.title)}</p>`)}${td(`<span class="text-xs">${esc(r.p.ownerName || 'Hệ thống')}</span>`)}${td(`<p class="text-xs font-semibold text-accent-700">${esc(describeDiscount(r.p))}</p><p class="text-[11px] text-foreground-500">${esc(describeConditions(r.p))}</p>`)}${td(`${r.uses}${r.p.usageLimit ? `/${r.p.usageLimit}` : ''}`, 'text-right')}${td(money(r.discount), 'text-right')}${td(money(r.revenue), 'text-right font-semibold')}${td(`<span class="rounded-full px-2 py-1 text-[11px] font-semibold ${PSTATE[r.st][1]}">${PSTATE[r.st][0]}</span>`)}${td(`<button type="button" data-toggle="${r.p.id}" class="${BTN_SM}">${r.p.status === 'paused' ? 'Mở lại' : 'Tạm dừng'}</button>`, 'text-right')}</tr>`).join(''), 1060) : `<div class="p-4">${emptyState('ri-coupon-3-line', 'Chưa có mã giảm giá')}</div>`}</section>
  <section class="${CARD} mt-5 overflow-hidden">${sectionTitle('Lượt dùng mã gần đây')}${d.redemptions.length ? table(['Mã', 'Đơn', 'Khách', 'Sân · ngày', '>Đã giảm', '>Khách trả', 'Trạng thái'], d.redemptions.slice(0, 20).map((r) => `<tr>${td(`<span class="font-mono text-xs font-bold text-primary-700">${esc(r.code)}</span>`)}${td(`<span class="font-mono text-xs">${esc(r.bookingCode)}</span>`)}${td(esc(r.customerName))}${td(`<span class="text-xs">${esc(r.courtName)}<br>${dateText(r.bookingDate)}</span>`)}${td(`-${money(r.discount)}`, 'text-right text-accent-700')}${td(money(r.paidTotal), 'text-right font-semibold')}${td(statusBadge(r.status))}</tr>`).join(''), 820) : '<p class="px-4 py-5 text-sm text-foreground-500">Chưa có lượt dùng mã.</p>'}</section>`;
  on(main(), 'click', '[data-toggle]', (e, el) => {
    const p = d.promotions.find((x) => x.id === el.dataset.toggle);
    run(api('admin', 'promotion_status', { id: p.id, status: p.status === 'paused' ? 'active' : 'paused' }), 'Đã cập nhật mã.', 'promotions');
  });
}

// =====================================================================
// NHẬT KÝ
// =====================================================================
async function renderAudit() {
  const all = await get('audit', 'audit');
  const f = filter('audit', { module: 'all', level: 'all', q: '' });
  const q = f.q.toLowerCase();
  const list = all.filter((a) => f.module === 'all' || a.module === f.module).filter((a) => f.level === 'all' || a.level === f.level).filter((a) => !q || `${a.actorName} ${a.action} ${a.targetLabel} ${a.detail}`.toLowerCase().includes(q));
  const mods = PAGE.modules;
  const LV = { info: ['Thông tin', 'bg-secondary-50 text-secondary-800'], success: ['Thành công', 'bg-primary-50 text-primary-700'], warning: ['Cảnh báo', 'bg-accent-50 text-accent-800'], danger: ['Nhạy cảm', 'bg-accent-100 text-accent-900'] };
  actions().innerHTML = `<button type="button" id="au-csv" class="${BTN_OUT}"><i class="ri-file-excel-2-line"></i>Xuất nhật ký</button>`;
  actions().querySelector('#au-csv').onclick = () => downloadCsv([['Thời gian', 'Người thực hiện', 'Bộ quyền', 'Mục', 'Thao tác', 'Đối tượng', 'Chi tiết', 'Mức'], ...list.map((a) => [formatDateTime(a.createdAt), a.actorName, a.actorRole, a.module, a.action, a.targetLabel, a.detail, a.level])], `nhat-ky-quan-tri-${TODAY}.csv`);
  main().innerHTML = `
  <div class="mb-4 grid grid-cols-1 gap-2 sm:grid-cols-[1fr_200px_160px]">${search('au-q', f.q, 'Tìm người thực hiện, thao tác, đối tượng...')}<select id="au-mod" class="${INPUT}"><option value="all">Mọi mục</option>${mods.map((m) => `<option value="${m.key}" ${f.module === m.key ? 'selected' : ''}>${m.label}</option>`).join('')}</select><select id="au-lv" class="${INPUT}"><option value="all">Mọi mức</option>${Object.entries(LV).map(([k, [l]]) => `<option value="${k}" ${f.level === k ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
  <div class="${CARD} overflow-hidden">${list.length ? table(['Thời gian', 'Người thực hiện', 'Thao tác', 'Đối tượng', 'Mức'], list.map((a) => `<tr>${td(`<span class="whitespace-nowrap text-xs">${formatDateTime(a.createdAt)}</span>`)}${td(`<p class="font-semibold">${esc(a.actorName)}</p><p class="text-[11px] text-foreground-500">${esc(a.actorRole)}</p>`)}${td(`<p>${esc(a.action)}</p><p class="text-[11px] text-foreground-500">${esc((mods.find((m) => m.key === a.module) || {}).label || a.module)}</p>`)}${td(`<p>${esc(a.targetLabel)}</p>${a.detail ? `<p class="text-[11px] text-foreground-500">${esc(a.detail)}</p>` : ''}`)}${td(`<span class="rounded-full px-2 py-1 text-[11px] font-semibold ${LV[a.level][1]}">${LV[a.level][0]}</span>`)}</tr>`).join(''), 820) : `<div class="p-4">${emptyState('ri-history-line', 'Không có thao tác phù hợp')}</div>`}</div>`;
  const root = main();
  [['#au-q', 'q'], ['#au-mod', 'module'], ['#au-lv', 'level']].forEach(([s, k]) => root.querySelector(s).addEventListener('change', (e) => { f[k] = e.target.value; render(); }));
}

// =====================================================================
const RENDER = { overview: renderOverview, accounts: renderAccounts, courts: renderCourts, bookings: renderBookings, invoices: renderInvoices, categories: renderCategories, content: renderContent, moderation: renderModeration, promotions: renderPromotions, audit: renderAudit };

async function render() {
  actions().innerHTML = '';
  const fn = RENDER[PAGE.tab] || renderOverview;
  const first = !Object.keys(C).length;
  if (first) main().innerHTML = loadingBlock();
  try {
    await fn();
  } catch (e) {
    main().innerHTML = errorBlock(e.message);
  }
}

const sidebar = document.getElementById('owner-sidebar');
const overlay = document.getElementById('owner-overlay');
document.getElementById('owner-menu-btn').addEventListener('click', () => { sidebar.classList.remove('-translate-x-full'); overlay.classList.remove('hidden'); });
overlay.addEventListener('click', () => { sidebar.classList.add('-translate-x-full'); overlay.classList.add('hidden'); });

// Huy hiệu số việc cần xử lý trên thanh bên
api('admin', 'overview').then((d) => {
  C.overview = d;
  const set = (k, n) => { const el = document.querySelector(`[data-badge="${k}"]`); if (el && n) { el.textContent = n; el.classList.remove('hidden'); } };
  set('bookings', d.statuses.pending);
  set('moderation', d.totals.openReports + d.totals.pendingReviews);
  set('accounts', d.totals.pendingOwnerRequests);
}).catch(() => { });

render();