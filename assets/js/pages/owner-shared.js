/**
 * Dùng chung cho kênh chủ sân: trạng thái dữ liệu, nút, ô nhập, khung hộp thoại, thẻ thống kê.
 */
import { APP, PAGE, api, esc, openModal, formatVnd } from '../core/ui.js';
import { slotEndTime, formatLongDate } from '../lib/format.js';

export const TODAY = APP.today;
export const S = { courts: [], trash: [], bookings: [], blocked: {}, unreplied: 0 };
export const main = () => document.getElementById('owner-main');
export const actions = () => document.getElementById('owner-actions');

export async function loadData() {
  Object.assign(S, await api('owner', 'data'));
  refreshBadges();
  return S;
}

export function refreshBadges() {
  const pending = S.bookings.filter((b) => b.status === 'pending').length;
  const set = (el, n) => {
    if (!el) return;
    el.textContent = n > 99 ? '99+' : n;
    el.classList.toggle('hidden', !n);
  };
  set(document.getElementById('owner-bell'), pending);
  set(document.querySelector('[data-badge="bookings"]'), pending);
  set(document.querySelector('[data-badge="reviews"]'), S.unreplied);
}

// ---------- Lớp CSS dùng lại ----------
export const BTN = 'inline-flex cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-md bg-primary-500 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-600 disabled:cursor-not-allowed disabled:opacity-60';
export const BTN_OUT = 'inline-flex cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-md border border-background-300 bg-white px-4 py-2.5 text-sm font-semibold text-foreground-800 transition-colors hover:border-primary-400 hover:text-primary-700 disabled:opacity-60';
export const BTN_SM = 'inline-flex cursor-pointer items-center justify-center gap-1 whitespace-nowrap rounded-md border border-background-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-foreground-800 transition-colors hover:border-primary-400 hover:text-primary-700 disabled:opacity-60';
export const BTN_SM_PRI = 'inline-flex cursor-pointer items-center justify-center gap-1 whitespace-nowrap rounded-md bg-primary-500 px-2.5 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-primary-600 disabled:opacity-60';
export const BTN_SM_DANGER = 'inline-flex cursor-pointer items-center justify-center gap-1 whitespace-nowrap rounded-md border border-accent-200 bg-accent-50 px-2.5 py-1.5 text-xs font-semibold text-accent-800 transition-colors hover:border-accent-400 disabled:opacity-60';
export const INPUT = 'w-full rounded-md border border-background-300 bg-white px-3 py-2.5 text-sm text-foreground-900 outline-none transition-colors focus:border-primary-500 focus:ring-2 focus:ring-primary-100';
export const LABEL = 'mb-1.5 block text-xs font-semibold text-foreground-700';
export const CARD = 'rounded-lg border border-background-200 bg-white';

export const chip = (active) =>
  `inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
    active ? 'border-primary-500 bg-primary-500 text-white' : 'border-background-300 bg-white text-foreground-700 hover:border-primary-400 hover:text-primary-700'
  }`;

export function statCard(icon, label, value, hint = '', tone = 'primary') {
  const tones = {
    primary: 'bg-primary-50 text-primary-600',
    accent: 'bg-accent-50 text-accent-700',
    secondary: 'bg-secondary-50 text-secondary-700',
    neutral: 'bg-background-100 text-foreground-700',
  };
  return `<div class="${CARD} p-4">
    <div class="flex items-center justify-between gap-2"><p class="text-xs font-medium text-foreground-500">${label}</p><span class="flex h-8 w-8 items-center justify-center rounded-md ${tones[tone]}"><i class="${icon} text-base" aria-hidden="true"></i></span></div>
    <p class="mt-2 font-heading text-xl font-extrabold text-foreground-950 md:text-2xl">${value}</p>
    ${hint ? `<p class="mt-1 text-[11px] text-foreground-500">${hint}</p>` : ''}
  </div>`;
}

export const sectionTitle = (title, right = '') =>
  `<div class="flex flex-wrap items-center justify-between gap-2 border-b border-background-200 px-4 py-3"><h2 class="font-heading text-sm font-bold text-foreground-950">${title}</h2>${right}</div>`;

/** Khung hộp thoại chuẩn: tiêu đề + thân + chân */
export function modal(title, body, footer = '', size = 'max-w-lg') {
  return openModal({
    size,
    html: `<div class="flex items-center justify-between gap-3 border-b border-background-200 px-5 py-4"><h2 class="font-heading text-lg font-extrabold text-foreground-950">${title}</h2><button type="button" data-close aria-label="Đóng" class="flex h-9 w-9 cursor-pointer items-center justify-center rounded-md text-foreground-500 hover:bg-background-100"><i class="ri-close-line text-xl" aria-hidden="true"></i></button></div>
      <div class="px-5 py-4">${body}</div>
      ${footer ? `<div class="flex flex-col-reverse gap-2 border-t border-background-200 px-5 py-4 sm:flex-row sm:justify-end">${footer}</div>` : ''}`,
  });
}

export const slotText = (b) => (b.slots && b.slots.length ? `${b.slots[0]} - ${slotEndTime(b.slots[b.slots.length - 1])}` : b.startSlot || '');
export const dateText = (iso) => (iso ? iso.split('-').reverse().join('/') : '');
export const longDate = formatLongDate;
export const money = formatVnd;
export const isActive = (b) => b.status !== 'cancelled';
export const courtById = (id) => S.courts.find((c) => c.id === id) || S.trash.find((c) => c.id === id);

export function addDays(iso, n) {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + n);
  const p = (x) => `${x}`.padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export const phoneKey = (p) => (p || '').replace(/\D/g, '');
export const sourceBadge = (b) =>
  b.source === 'owner'
    ? '<span class="inline-flex items-center gap-1 rounded-full bg-secondary-50 px-2 py-0.5 text-[10px] font-semibold text-secondary-800"><i class="ri-store-line" aria-hidden="true"></i>Tại quầy</span>'
    : '<span class="inline-flex items-center gap-1 rounded-full bg-primary-50 px-2 py-0.5 text-[10px] font-semibold text-primary-700"><i class="ri-global-line" aria-hidden="true"></i>Online</span>';

export const courtOptions = (selected = '', all = 'Tất cả sân') =>
  `${all ? `<option value="">${all}</option>` : ''}${S.courts.map((c) => `<option value="${esc(c.id)}" ${c.id === selected ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}`;

export { PAGE, APP, esc };
