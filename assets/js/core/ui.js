/**
 * Các hàm giao diện dùng chung cho mọi trang (JavaScript thuần, không framework).
 */
import { formatVnd } from '../lib/format.js';

export const APP = window.APP || {};
export const PAGE = window.PAGE || {};
export { formatVnd };

/** Chọn phần tử */
export const $ = (selector, root = document) => root.querySelector(selector);
export const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

/** Thoát ký tự HTML khi chèn chuỗi người dùng nhập vào template */
export const esc = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

/** URL nội bộ có tiền tố thư mục cài đặt */
export const url = (path = '/') => `${APP.base || ''}${path}`;

/** Ghép class có điều kiện: cx('a', cond && 'b') */
export const cx = (...parts) => parts.filter(Boolean).join(' ');

/** Lặp mảng → chuỗi HTML */
export const each = (list, fn) => (list || []).map(fn).join('');

/** Gọi API PHP: api('booking', 'create', {...}) → data (ném lỗi nếu ok=false) */
export async function api(file, action, body = undefined, method = undefined) {
  const opts = { method: method || (body === undefined ? 'GET' : 'POST'), headers: {}, credentials: 'same-origin' };
  let target = url(`/api/${file}.php?action=${encodeURIComponent(action)}`);
  if (opts.method === 'GET' && body) {
    target += '&' + new URLSearchParams(body).toString();
  } else if (body !== undefined) {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(body);
  }
  let res;
  try {
    res = await fetch(target, opts);
  } catch {
    throw new Error('Không kết nối được máy chủ. Vui lòng kiểm tra mạng và thử lại.');
  }
  let json = null;
  try {
    json = await res.json();
  } catch {
    throw new Error('Máy chủ trả về dữ liệu không hợp lệ.');
  }
  if (!json || json.ok === false) {
    const error = new Error((json && json.error) || 'Đã có lỗi xảy ra.');
    error.status = res.status;
    error.requireSudo = Boolean(json && json.require_sudo);
    error.payload = json;
    throw error;
  }
  return json.data;
}

/** Thông báo nhỏ ở cuối màn hình */
export function toast(message, tone = 'success', ms = 3200) {
  const root = document.getElementById('toast-root');
  if (!root) return;
  const icon = tone === 'error' ? 'ri-error-warning-line' : tone === 'info' ? 'ri-information-line' : 'ri-checkbox-circle-line';
  const color =
    tone === 'error'
      ? 'border-accent-300 text-accent-800'
      : tone === 'info'
        ? 'border-secondary-300 text-foreground-800'
        : 'border-primary-300 text-primary-800';
  const el = document.createElement('div');
  el.className = `pointer-events-auto flex max-w-md items-center gap-2 rounded-lg border bg-white px-4 py-3 text-sm font-semibold shadow-lg animate-fade-up ${color}`;
  el.innerHTML = `<i class="${icon} text-lg" aria-hidden="true"></i><span>${esc(message)}</span>`;
  root.appendChild(el);
  setTimeout(() => {
    el.style.transition = 'opacity .3s';
    el.style.opacity = '0';
    setTimeout(() => el.remove(), 320);
  }, ms);
}

/**
 * Hộp thoại (modal). Trả về { el, close }.
 * openModal({ html, size: 'max-w-lg', onClose, dismissible })
 */
export function openModal({ html, size = 'max-w-lg', onClose, dismissible = true, panelClass = '' }) {
  const root = document.getElementById('modal-root') || document.body;
  const wrap = document.createElement('div');
  wrap.className = 'fixed inset-0 z-[100] flex items-end justify-center bg-black/60 p-0 backdrop-blur-[2px] sm:items-center sm:p-4 animate-fade-in';
  wrap.innerHTML = `<div class="relative max-h-[92vh] w-full ${size} overflow-y-auto rounded-t-2xl border border-background-200 bg-background-50 shadow-2xl sm:rounded-2xl ${panelClass}" role="dialog" aria-modal="true">${html}</div>`;
  const prevOverflow = document.body.style.overflow;
  document.body.style.overflow = 'hidden';
  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    wrap.remove();
    document.body.style.overflow = prevOverflow;
    document.removeEventListener('keydown', onKey);
    if (onClose) onClose();
  };
  const onKey = (event) => {
    if (event.key === 'Escape' && dismissible) close();
  };
  document.addEventListener('keydown', onKey);
  wrap.addEventListener('mousedown', (event) => {
    if (event.target === wrap && dismissible) close();
  });
  wrap.addEventListener('click', (event) => {
    if (event.target.closest('[data-close]')) close();
  });
  root.appendChild(wrap);
  return { el: wrap.firstElementChild, close };
}

/** Hộp xác nhận: await confirmBox({title, message, confirmText, danger}) → true/false */
export function confirmBox({ title, message, confirmText = 'Xác nhận', cancelText = 'Hủy', danger = false, icon }) {
  return new Promise((resolve) => {
    let answered = false;
    const modal = openModal({
      size: 'max-w-md',
      html: `
        <div class="p-6">
          <div class="flex items-start gap-3">
            <span class="flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${danger ? 'bg-accent-100 text-accent-700' : 'bg-primary-100 text-primary-700'}">
              <i class="${icon || (danger ? 'ri-error-warning-line' : 'ri-question-line')} text-xl" aria-hidden="true"></i>
            </span>
            <div class="min-w-0">
              <h3 class="font-heading text-lg font-bold text-foreground-950">${esc(title)}</h3>
              <p class="mt-1.5 text-sm leading-relaxed text-foreground-600">${message}</p>
            </div>
          </div>
          <div class="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button type="button" data-close class="cursor-pointer whitespace-nowrap rounded-md border border-background-300 px-4 py-2.5 text-sm font-semibold text-foreground-800 hover:bg-background-100">${esc(cancelText)}</button>
            <button type="button" data-ok class="cursor-pointer whitespace-nowrap rounded-md px-4 py-2.5 text-sm font-bold ${danger ? 'bg-accent-500 hover:bg-accent-600' : 'bg-primary-500 text-white hover:bg-primary-600'}">${esc(confirmText)}</button>
          </div>
        </div>`,
      onClose: () => {
        if (!answered) resolve(false);
      },
    });
    modal.el.querySelector('[data-ok]').addEventListener('click', () => {
      answered = true;
      modal.close();
      resolve(true);
    });
  });
}

/** Nút đang xử lý: setBusy(btn, true, 'Đang lưu...') */
export function setBusy(button, busy, text) {
  if (!button) return;
  if (busy) {
    button.dataset.label = button.innerHTML;
    button.disabled = true;
    if (text) button.innerHTML = `<i class="ri-loader-4-line animate-spin" aria-hidden="true"></i> ${esc(text)}`;
  } else {
    button.disabled = false;
    if (button.dataset.label) button.innerHTML = button.dataset.label;
  }
}

/** Đọc toàn bộ giá trị form thành object */
export function formData(form) {
  const data = {};
  new FormData(form).forEach((value, key) => {
    data[key] = typeof value === 'string' ? value.trim() : value;
  });
  return data;
}

/** Gắn sự kiện theo kiểu ủy quyền: on(root, 'click', '[data-x]', (e, el) => ...) */
export function on(root, type, selector, handler) {
  root.addEventListener(type, (event) => {
    const el = event.target.closest(selector);
    if (el && root.contains(el)) handler(event, el);
  });
}

// ---------------- Thành phần hiển thị ----------------

const statusMap = {
  active: ['Đang hoạt động', 'bg-primary-50 text-primary-700 border-primary-200', 'bg-primary-500'],
  maintenance: ['Đang bảo trì', 'bg-accent-50 text-accent-800 border-accent-200', 'bg-accent-500'],
  paused: ['Tạm dừng', 'bg-background-100 text-foreground-600 border-background-300', 'bg-foreground-400'],
  pending: ['Chờ xác nhận', 'bg-accent-50 text-accent-800 border-accent-200', 'bg-accent-500'],
  confirmed: ['Đã xác nhận', 'bg-primary-50 text-primary-700 border-primary-200', 'bg-primary-500'],
  cancelled: ['Đã hủy', 'bg-background-100 text-foreground-600 border-background-300', 'bg-foreground-400'],
  completed: ['Hoàn thành', 'bg-secondary-50 text-secondary-800 border-secondary-200', 'bg-secondary-500'],
};

export const statusLabel = (status) => (statusMap[status] || statusMap.pending)[0];

export function statusBadge(status) {
  const [label, cls, dot] = statusMap[status] || statusMap.pending;
  return `<span class="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium whitespace-nowrap ${cls}"><span class="w-1.5 h-1.5 rounded-full ${dot}"></span>${label}</span>`;
}

export function stars(rating, reviewCount) {
  return `<div class="flex items-center gap-1.5"><i class="ri-star-fill text-accent-500 text-sm" aria-hidden="true"></i><span class="text-sm font-semibold text-foreground-950">${Number(rating || 0).toFixed(1)}</span>${
    typeof reviewCount === 'number' ? `<span class="text-xs text-foreground-500">(${reviewCount} đánh giá)</span>` : ''
  }</div>`;
}

/** Ô trạng thái rỗng */
export function emptyState(icon, title, desc = '', actionHtml = '') {
  return `<div class="flex flex-col items-center justify-center rounded-lg border border-dashed border-background-300 bg-background-100 px-6 py-12 text-center">
    <span class="flex h-14 w-14 items-center justify-center rounded-full bg-primary-50 text-primary-600"><i class="${icon} text-2xl" aria-hidden="true"></i></span>
    <p class="mt-4 font-heading text-base font-bold text-foreground-950">${esc(title)}</p>
    ${desc ? `<p class="mt-1.5 max-w-md text-sm leading-relaxed text-foreground-600">${esc(desc)}</p>` : ''}
    ${actionHtml ? `<div class="mt-5">${actionHtml}</div>` : ''}
  </div>`;
}

export const loadingBlock = (text = 'Đang tải dữ liệu...') =>
  `<div class="flex items-center justify-center gap-2 rounded-lg border border-background-200 bg-background-100 px-6 py-12 text-sm text-foreground-600"><i class="ri-loader-4-line animate-spin text-lg text-primary-500" aria-hidden="true"></i>${esc(text)}</div>`;

export const errorBlock = (text) =>
  `<div class="flex items-start gap-2 rounded-lg border border-accent-300 bg-accent-50 px-4 py-3 text-sm text-accent-800"><i class="ri-error-warning-line mt-0.5" aria-hidden="true"></i><span>${esc(text)}</span></div>`;

/** Định dạng ngày giờ ISO → "HH:mm dd/MM/yyyy" */
export function formatDateTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const p = (n) => `${n}`.padStart(2, '0');
  return `${p(d.getHours())}:${p(d.getMinutes())} ${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}`;
}

/** Tải file CSV (có BOM để Excel đọc đúng tiếng Việt) */
export function downloadCsv(rows, fileName) {
  const csv = rows.map((line) => line.map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(',')).join('\r\n');
  const blob = new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(link.href), 4000);
}

/** Sao chép vào clipboard */
export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const area = document.createElement('textarea');
    area.value = text;
    document.body.appendChild(area);
    area.select();
    let ok = false;
    try {
      ok = document.execCommand('copy');
    } catch {
      ok = false;
    }
    area.remove();
    return ok;
  }
}
