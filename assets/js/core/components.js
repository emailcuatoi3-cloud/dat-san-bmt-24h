/**
 * Thành phần hiển thị dùng ở nhiều trang: thẻ sân, nút sân yêu thích.
 */
import { APP, api, esc, statusBadge, stars, url, formatVnd } from './ui.js';
import { lowestPrice, peakBand } from '../lib/courtPricing.js';

// ---------------- Sân yêu thích (lưu theo tài khoản trong CSDL) ----------------
let favorites = (APP.user && APP.user.favorites) || [];
export const getFavorites = () => favorites;
export const isFavorite = (slug) => favorites.includes(slug);

export async function toggleFavoriteCourt(slug) {
  if (!APP.user) return { ok: false, reason: 'signed-out' };
  try {
    const data = await api('account', 'toggle_favorite', { slug });
    favorites = data.favorites;
    window.dispatchEvent(new CustomEvent('bmt24h-favorites', { detail: favorites }));
    return { ok: true, added: data.added };
  } catch {
    return { ok: false, reason: 'error' };
  }
}

/** Gắn xử lý nút tim cho mọi thẻ sân trong root (dùng 1 lần cho mỗi vùng chứa) */
export function bindFavoriteButtons(root) {
  root.addEventListener('click', async (event) => {
    const btn = event.target.closest('[data-fav]');
    if (!btn) return;
    event.preventDefault();
    const slug = btn.dataset.fav;
    const card = btn.closest('article');
    const notice = card && card.querySelector('[data-fav-notice]');
    const result = await toggleFavoriteCourt(slug);
    let message;
    if (result.ok) message = result.added ? 'Đã thêm vào sân yêu thích' : 'Đã bỏ khỏi sân yêu thích';
    else if (result.reason === 'signed-out') message = 'Đăng nhập để lưu sân yêu thích';
    else message = 'Chưa lưu được, bạn thử lại sau';
    if (result.ok) paintFavButton(btn, isFavorite(slug));
    if (notice) {
      notice.innerHTML = `<i class="ri-heart-3-line text-accent-600" aria-hidden="true"></i>${esc(message)}${
        result.reason === 'signed-out' ? ` <a href="${url('/dang-nhap')}" class="font-semibold text-primary-600 hover:text-primary-700">Đăng nhập</a>` : ''
      }`;
      notice.classList.remove('hidden');
      clearTimeout(notice._timer);
      notice._timer = setTimeout(() => notice.classList.add('hidden'), 3200);
    }
  });
}

function paintFavButton(btn, fav) {
  btn.setAttribute('aria-pressed', fav ? 'true' : 'false');
  btn.className = favButtonClass(fav);
  btn.innerHTML = `<i class="${fav ? 'ri-heart-3-fill' : 'ri-heart-3-line'} text-base" aria-hidden="true"></i>`;
}

const favButtonClass = (fav) =>
  `absolute bottom-3 right-3 flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border backdrop-blur-sm transition-colors ${
    fav
      ? 'border-accent-300 bg-accent-500 text-background-950'
      : 'border-white/40 bg-background-50/80 text-foreground-800 hover:border-accent-300 hover:text-accent-700'
  }`;

// ---------------- Thẻ sân ----------------
export function courtCard(court) {
  const fav = isFavorite(court.slug);
  const evening = peakBand(court);
  const low = lowestPrice(court);
  const maintenance = court.status === 'maintenance';
  return `
  <article class="group flex flex-col overflow-hidden rounded-lg border border-background-200 bg-background-100 transition-colors hover:border-primary-400">
    <div class="relative w-full h-[200px] md:h-[220px] overflow-hidden bg-background-100">
      <img src="${esc(court.images[0] || court.image)}" alt="${esc(court.name)} - ${esc(court.sportLabel.toLowerCase())} tại Buôn Ma Thuột" title="${esc(court.name)} - ${esc(court.sportLabel)}" loading="lazy" class="w-full h-full object-cover object-top transition-transform duration-500 group-hover:scale-[1.03]">
      <div class="absolute top-3 left-3 flex items-center gap-1.5 rounded-full bg-background-50/85 px-2.5 py-1 text-xs font-semibold text-foreground-900 backdrop-blur-sm">
        <i class="${court.sport === 'football' ? 'ri-football-line' : 'ri-ping-pong-line'} text-primary-600" aria-hidden="true"></i>${esc(court.sportLabel)}
      </div>
      <div class="absolute top-3 right-3">${statusBadge(court.status)}</div>
      ${court.featured ? `<div class="absolute bottom-3 left-3 flex items-center gap-1 rounded-full bg-accent-500 px-2.5 py-1 text-[11px] font-semibold text-background-950"><i class="ri-fire-line" aria-hidden="true"></i>Sân nổi bật</div>` : ''}
      <button type="button" data-fav="${esc(court.slug)}" aria-pressed="${fav}" aria-label="${fav ? 'Bỏ khỏi sân yêu thích' : 'Lưu vào sân yêu thích'}" class="${favButtonClass(fav)}">
        <i class="${fav ? 'ri-heart-3-fill' : 'ri-heart-3-line'} text-base" aria-hidden="true"></i>
      </button>
    </div>
    <div class="flex flex-1 flex-col gap-3 p-4 md:p-5">
      <div class="flex items-start justify-between gap-3">
        <h3 class="font-heading text-base font-bold leading-snug text-foreground-950">${esc(court.name)}</h3>
        ${stars(court.rating)}
      </div>
      <p class="flex items-start gap-1.5 text-[13px] font-medium leading-relaxed text-foreground-800"><i class="ri-map-pin-line mt-0.5 text-foreground-600" aria-hidden="true"></i><span>${esc(court.address)}</span></p>
      <p class="flex flex-wrap items-center gap-x-1.5 text-[11px] font-medium text-foreground-600"><i class="ri-time-line" aria-hidden="true"></i>Mở cửa ${esc(court.openTime)} - ${esc(court.closeTime)} hằng ngày</p>
      <p class="text-sm leading-relaxed text-foreground-700 line-clamp-2">${esc(court.description)}</p>
      <p data-fav-notice class="hidden flex items-center gap-1.5 rounded-md bg-background-50 px-2 py-1.5 text-[11px] font-medium text-foreground-700"></p>
      <div class="mt-auto flex flex-wrap items-end justify-between gap-2 pt-3 border-t border-background-200">
        <div>
          <p class="text-[11px] font-semibold uppercase tracking-wide text-foreground-700">Giá thuê từ</p>
          <p class="font-heading text-lg font-bold text-primary-600">${formatVnd(low)}<span class="text-xs font-semibold text-foreground-700">/giờ</span></p>
          ${evening && evening.price > low ? `<p class="mt-0.5 text-[11px] font-medium text-foreground-600">Buổi tối <span class="font-bold text-accent-700">${formatVnd(evening.price)}</span>/giờ</p>` : ''}
        </div>
        <span class="rounded-md bg-secondary-50 px-2 py-1 text-xs font-medium text-secondary-800">${esc(court.area)}</span>
      </div>
      <div class="grid grid-cols-2 gap-2">
        <a href="${url(`/san/${court.slug}`)}" class="whitespace-nowrap rounded-md border border-background-300 bg-background-200 px-3 py-2.5 text-center text-sm font-semibold text-foreground-950 transition-colors hover:border-primary-400 hover:bg-background-300 hover:text-primary-800">Xem chi tiết</a>
        ${
          maintenance
            ? `<span class="flex items-center justify-center whitespace-nowrap rounded-md border border-background-300 bg-background-200 px-3 py-2.5 text-sm font-semibold text-foreground-500">Tạm đóng</span>`
            : `<a href="${url(`/dat-san/${court.slug}`)}" class="whitespace-nowrap rounded-md bg-primary-500 px-3 py-2.5 text-center text-sm font-bold text-white transition-colors hover:bg-primary-600">Đặt ngay</a>`
        }
      </div>
    </div>
  </article>`;
}
