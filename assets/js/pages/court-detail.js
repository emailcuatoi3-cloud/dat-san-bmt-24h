/** Chi tiết sân: thư viện ảnh, khung giờ trống hôm nay, đánh giá, sân lân cận. */
import { $, $$, PAGE, api, esc, url, statusBadge, formatVnd } from '../core/ui.js';
import { bindFavoriteButtons, courtCard } from '../core/components.js';
import { openReviewModal } from '../core/reviewModal.js';
import { buildDaySlots, pricePerHourAt } from '../lib/courtPricing.js';
import { formatLongDate, isPastSlot, toIsoDate } from '../lib/format.js';

const court = PAGE.court;
const gallery = PAGE.gallery || [];

// ---- Thư viện ảnh ----
$$('[data-gallery-thumb]').forEach((btn) =>
  btn.addEventListener('click', () => {
    const index = Number(btn.dataset.galleryThumb);
    $('[data-gallery-main]').src = gallery[index];
    $('[data-gallery-count]').textContent = `Ảnh ${index + 1} / ${gallery.length}`;
    $$('[data-gallery-thumb]').forEach((other) => {
      const active = other === btn;
      other.classList.toggle('border-primary-500', active);
      other.classList.toggle('border-transparent', !active);
    });
  }),
);
$$('[data-status-badge]').forEach((el) => (el.outerHTML = statusBadge(el.dataset.statusBadge)));

// ---- Khung giờ trống hôm nay ----
const today = toIsoDate(new Date());
$('[data-today-label]').textContent = `Hôm nay, ${formatLongDate(today)}`;
let taken = [];

function renderSlots() {
  const slots = buildDaySlots(court);
  const now = Date.now();
  $('#slot-grid').innerHTML = slots
    .map((slot) => {
      const booked = taken.includes(slot);
      const past = isPastSlot(today, slot, now);
      if (booked || past || court.status === 'maintenance') {
        return `<span title="${past ? 'Khung giờ đã qua' : 'Khung giờ đã kín'}" class="cursor-not-allowed rounded-md bg-background-100 px-2 py-2 text-center text-xs font-medium text-foreground-400"><span class="block line-through">${slot}</span><span class="mt-0.5 block text-[10px]">${past ? 'Đã qua' : 'Đã kín'}</span></span>`;
      }
      return `<a href="${url(`/dat-san/${court.slug}?date=${today}&slot=${slot}`)}" class="rounded-md border border-primary-200 bg-primary-50 px-2 py-2 text-center text-xs font-semibold text-primary-800 transition-colors hover:border-primary-400 hover:bg-primary-100"><span class="block whitespace-nowrap">${slot}</span><span class="mt-0.5 block whitespace-nowrap text-[10px] font-medium text-primary-600">${formatVnd(pricePerHourAt(court, slot))}</span></a>`;
    })
    .join('');
}
renderSlots();
setInterval(renderSlots, 30000);
api('booking', 'availability', { date: today }, 'GET')
  .then((data) => {
    taken = [...(data.occupied[court.id] || []), ...(data.blocked[`${court.id}:${today}`] || [])];
    renderSlots();
  })
  .catch(() => {});

// ---- Sân lân cận ----
const related = $('#related');
related.innerHTML = (PAGE.related || []).map(courtCard).join('');
bindFavoriteButtons(related);

// ---- Đánh giá ----
const rv = { list: [], loading: true, error: '', star: null, tags: [], expanded: false, success: '' };

function summarize(list) {
  const dist = [5, 4, 3, 2, 1].map((star) => ({ star, count: list.filter((r) => Math.round(r.rating) === star).length }));
  const total = list.reduce((s, r) => s + r.rating, 0);
  return {
    count: list.length,
    average: list.length ? Math.round((total / list.length) * 10) / 10 : 0,
    recommend: list.length ? Math.round((list.filter((r) => r.rating >= 4).length / list.length) * 100) : 0,
    distribution: dist.map((d) => ({ ...d, percent: list.length ? Math.round((d.count / list.length) * 100) : 0 })),
  };
}

const starsHtml = (n, size = 'text-[11px]') =>
  Array.from({ length: 5 }, (_, i) => `<i class="${size} ${i < n ? 'ri-star-fill text-accent-500' : 'ri-star-line text-background-400'}" aria-hidden="true"></i>`).join('');

function renderReviews() {
  const s = summarize(rv.list);
  const has = s.count > 0;
  if (has) {
    $('[data-head-rating]').textContent = s.average.toFixed(1);
    $('[data-head-count]').textContent = `(${s.count} đánh giá)`;
  }
  const tagCounts = {};
  rv.list.forEach((r) => r.tags.forEach((t) => (tagCounts[t] = (tagCounts[t] || 0) + 1)));
  const tagOptions = Object.entries(tagCounts).sort((a, b) => b[1] - a[1]);
  const filtered = rv.list.filter((r) => {
    if (rv.star !== null && Math.round(r.rating) !== rv.star) return false;
    if (rv.tags.length && !rv.tags.some((t) => r.tags.includes(t))) return false;
    return true;
  });
  const filterActive = rv.star !== null || rv.tags.length > 0;
  const visible = rv.expanded ? filtered : filtered.slice(0, 3);
  const remaining = filtered.length - 3;

  $('#reviews').innerHTML = `
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div class="min-w-0">
        <h2 class="font-heading text-base font-bold text-foreground-950">Đánh giá từ khách hàng</h2>
        <p class="mt-1.5 text-xs leading-relaxed text-foreground-500">Chia sẻ cảm nhận của bạn chỉ với vài giây — không cần mã đơn. Đánh giá của khách đã đặt sân qua website được gắn nhãn “Đã chơi”, và chủ sân thường phản hồi ngay dưới mỗi cảm nhận.</p>
      </div>
      <button type="button" data-write-review class="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-md bg-primary-500 px-4 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-primary-600"><i class="ri-star-smile-line" aria-hidden="true"></i>Viết đánh giá</button>
    </div>
    ${rv.success ? `<p class="mt-3 flex items-start gap-2 rounded-md border border-primary-200 bg-primary-50 px-3.5 py-2.5 text-xs leading-relaxed text-primary-900"><i class="ri-checkbox-circle-line mt-0.5" aria-hidden="true"></i>${esc(rv.success)}</p>` : ''}
    ${rv.loading ? `<div class="mt-4 flex items-center gap-2 rounded-md border border-background-200 bg-background-50 px-4 py-3 text-xs text-foreground-600"><i class="ri-loader-4-line animate-spin text-base text-primary-600" aria-hidden="true"></i>Đang tải đánh giá của khách...</div>` : ''}
    ${!rv.loading && rv.error ? `<div class="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-md border border-accent-200 bg-accent-50 px-4 py-3"><p class="flex items-start gap-2 text-xs leading-relaxed text-accent-900"><i class="ri-error-warning-line mt-0.5" aria-hidden="true"></i>${esc(rv.error)}</p><button type="button" data-reload class="cursor-pointer whitespace-nowrap rounded-md border border-accent-300 bg-white px-3 py-1.5 text-xs font-semibold text-accent-900 transition-colors hover:bg-accent-100">Thử lại</button></div>` : ''}
    ${
      !rv.loading && has
        ? `<div class="mt-4 grid grid-cols-1 gap-4 rounded-md border border-background-200 bg-background-50 p-4 md:grid-cols-[200px_1fr] md:gap-6">
        <div class="flex flex-col items-start justify-center">
          <p class="font-heading text-3xl font-extrabold leading-none text-foreground-950">${s.average.toFixed(1)}</p>
          <div class="mt-2 flex items-center gap-0.5">${starsHtml(Math.round(s.average), 'text-sm')}</div>
          <p class="mt-2 text-xs text-foreground-500">${s.count} đánh giá từ khách hàng</p>
          <p class="mt-1 text-xs font-semibold text-primary-700">${s.recommend}% khách muốn quay lại</p>
        </div>
        <ul class="flex flex-col justify-center gap-1.5">
          ${s.distribution
            .map(
              (d) => `<li><button type="button" data-star-filter="${d.star}" ${d.count === 0 ? 'disabled' : ''} class="group flex w-full cursor-pointer items-center gap-2 rounded px-1 py-0.5 transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${rv.star === d.star ? 'bg-accent-100' : 'hover:bg-background-100'}">
              <span class="flex w-9 shrink-0 items-center gap-0.5 text-[11px] ${rv.star === d.star ? 'font-bold text-accent-900' : 'text-foreground-600'}">${d.star}<i class="ri-star-fill text-[9px] text-accent-500" aria-hidden="true"></i></span>
              <span class="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-background-200"><span class="block h-full rounded-full bg-accent-500" style="width:${d.percent}%"></span></span>
              <span class="w-16 shrink-0 text-right text-[11px] text-foreground-500">${d.count} lượt · ${d.percent}%</span></button></li>`,
            )
            .join('')}
        </ul>
      </div>
      <div class="mt-4 rounded-md border border-background-200 bg-background-50 p-3.5">
        <div class="flex flex-wrap items-center gap-x-3 gap-y-2">
          <span class="text-[11px] font-semibold uppercase tracking-wide text-foreground-500">Lọc theo sao</span>
          <div class="flex flex-wrap gap-1.5">
            <button type="button" data-reset-filter class="cursor-pointer whitespace-nowrap rounded-full border px-3 py-1 text-[11px] font-semibold transition-colors ${!filterActive ? 'border-primary-500 bg-primary-500 text-white' : 'border-background-300 bg-white text-foreground-700 hover:border-primary-300 hover:text-primary-700'}">Tất cả (${s.count})</button>
            ${[5, 4, 3, 2, 1]
              .map((star) => {
                const count = s.distribution.find((d) => d.star === star).count;
                const on = rv.star === star;
                return `<button type="button" data-star-filter="${star}" ${count === 0 ? 'disabled' : ''} class="inline-flex cursor-pointer items-center gap-1 whitespace-nowrap rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-45 ${on ? 'border-accent-500 bg-accent-500 text-white' : 'border-background-300 bg-white text-foreground-700 hover:border-accent-300 hover:text-accent-900'}">${star}<i class="text-[9px] ri-star-fill ${on ? 'text-white' : 'text-accent-500'}" aria-hidden="true"></i><span class="${on ? 'text-white/80' : 'text-foreground-400'}">(${count})</span></button>`;
              })
              .join('')}
          </div>
        </div>
        ${
          tagOptions.length
            ? `<div class="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-background-200 pt-3"><span class="text-[11px] font-semibold uppercase tracking-wide text-foreground-500">Lọc theo tiêu chí</span><div class="flex flex-wrap gap-1.5">${tagOptions
                .map(([label, count]) => {
                  const on = rv.tags.includes(label);
                  return `<button type="button" data-tag-filter="${esc(label)}" class="inline-flex cursor-pointer items-center gap-1 whitespace-nowrap rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors ${on ? 'border-primary-500 bg-primary-500 text-white' : 'border-background-300 bg-white text-foreground-700 hover:border-primary-300 hover:text-primary-700'}">${on ? '<i class="ri-check-line text-[10px]" aria-hidden="true"></i>' : ''}${esc(label)}<span class="${on ? 'text-white/75' : 'text-foreground-400'}">(${count})</span></button>`;
                })
                .join('')}</div></div>`
            : ''
        }
        <div class="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-background-200 pt-3">
          <p class="text-[11px] text-foreground-600">${filterActive ? `Tìm thấy ${filtered.length} đánh giá phù hợp` : `Đang hiển thị ${Math.min(3, rv.list.length)} mới nhất trong ${s.count} đánh giá`}</p>
          ${filterActive ? `<button type="button" data-reset-filter class="inline-flex cursor-pointer items-center gap-1 whitespace-nowrap rounded-md border border-background-300 bg-white px-2.5 py-1 text-[11px] font-semibold text-foreground-700 transition-colors hover:border-accent-300 hover:text-accent-900"><i class="ri-close-line" aria-hidden="true"></i>Bỏ bộ lọc</button>` : ''}
        </div>
      </div>`
        : ''
    }
    ${
      !rv.loading && !has && !rv.error
        ? `<div class="mt-4 rounded-md border border-dashed border-background-300 bg-background-50 px-4 py-6 text-center"><span class="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-white text-foreground-400"><i class="ri-chat-3-line text-xl" aria-hidden="true"></i></span><p class="mt-2.5 text-sm font-semibold text-foreground-900">Sân này chưa có đánh giá nào</p><p class="mx-auto mt-1 max-w-md text-xs leading-relaxed text-foreground-500">Bạn đã chơi tại ${esc(court.name)}? Hãy là người đầu tiên chia sẻ cảm nhận về sân cho cộng đồng cùng xem.</p><button type="button" data-write-review class="mt-3 inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-md border border-primary-300 bg-white px-3.5 py-2 text-xs font-semibold text-primary-700 transition-colors hover:bg-primary-50"><i class="ri-edit-2-line" aria-hidden="true"></i>Đánh giá sân này</button></div>`
        : ''
    }
    ${
      !rv.loading && has && filtered.length === 0
        ? `<div class="mt-4 rounded-md border border-dashed border-background-300 bg-background-50 px-4 py-5 text-center"><span class="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-white text-foreground-400"><i class="ri-filter-off-line text-lg" aria-hidden="true"></i></span><p class="mt-2 text-sm font-semibold text-foreground-900">Chưa có đánh giá nào khớp bộ lọc</p><p class="mx-auto mt-1 max-w-md text-xs leading-relaxed text-foreground-500">Thử chọn số sao khác hoặc bỏ bớt tiêu chí để xem thêm cảm nhận của khách tại ${esc(court.name)}.</p><button type="button" data-reset-filter class="mt-3 inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-md border border-primary-300 bg-white px-3.5 py-2 text-xs font-semibold text-primary-700 transition-colors hover:bg-primary-50"><i class="ri-refresh-line" aria-hidden="true"></i>Xem tất cả đánh giá</button></div>`
        : ''
    }
    ${
      !rv.loading && visible.length
        ? `<ul class="mt-2 divide-y divide-background-200">${visible
            .map(
              (r) => `<li class="py-4"><div class="flex items-start gap-3">
            <span class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-50 text-[11px] font-bold text-primary-800">${esc(r.initials)}</span>
            <div class="min-w-0 flex-1">
              <div class="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
                <div class="min-w-0">
                  <p class="flex flex-wrap items-center gap-1.5 text-sm font-semibold text-foreground-950">${esc(r.name)}${r.verified ? '<span class="inline-flex items-center gap-0.5 rounded-full bg-primary-50 px-1.5 py-0.5 text-[10px] font-semibold text-primary-700"><i class="ri-verified-badge-line" aria-hidden="true"></i>Đã chơi</span>' : ''}</p>
                  <p class="text-[11px] text-foreground-500">${esc(r.bookingLabel)} · ${esc(r.dateLabel)}</p>
                </div>
                <div class="flex items-center gap-0.5">${starsHtml(r.rating)}</div>
              </div>
              ${r.comment ? `<p class="mt-2 text-sm leading-relaxed text-foreground-700">${esc(r.comment)}</p>` : ''}
              ${r.tags.length ? `<div class="mt-2 flex flex-wrap gap-1.5">${r.tags.map((t) => `<button type="button" data-tag-filter="${esc(t)}" class="cursor-pointer rounded-full px-2 py-0.5 text-[11px] font-medium transition-colors ${rv.tags.includes(t) ? 'bg-primary-500 text-white' : 'bg-background-100 text-foreground-600 hover:bg-primary-50 hover:text-primary-700'}">${esc(t)}</button>`).join('')}</div>` : ''}
              ${r.ownerReply ? `<div class="mt-2.5 rounded-md border border-primary-200 bg-primary-50 px-3 py-2"><p class="flex items-center gap-1.5 text-[11px] font-bold text-primary-800"><i class="ri-store-2-line" aria-hidden="true"></i>Phản hồi từ chủ sân</p><p class="mt-1 text-xs leading-relaxed text-primary-900">${esc(r.ownerReply)}</p></div>` : ''}
            </div></div></li>`,
            )
            .join('')}</ul>`
        : ''
    }
    ${!rv.loading && remaining > 0 ? `<div class="mt-1 border-t border-background-200 pt-4"><button type="button" data-expand-reviews class="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-md border border-background-300 bg-background-50 px-3.5 py-2 text-xs font-semibold text-foreground-800 transition-colors hover:border-primary-300 hover:text-primary-700"><i class="${rv.expanded ? 'ri-arrow-up-s-line' : 'ri-arrow-down-s-line'}" aria-hidden="true"></i>${rv.expanded ? 'Thu gọn đánh giá' : `Xem thêm ${remaining} đánh giá khác`}</button></div>` : ''}
    <p class="mt-4 flex items-start gap-1.5 border-t border-background-200 pt-3 text-[11px] leading-relaxed text-foreground-500"><i class="ri-information-line mt-0.5" aria-hidden="true"></i>Đánh giá được đăng ngay sau khi gửi và hiển thị công khai. Nhãn “Đã chơi” cho biết đánh giá đó đến từ một đơn đặt sân đã hoàn thành tại ${esc(court.name)}.</p>`;
}

async function loadReviews() {
  rv.loading = true;
  rv.error = '';
  renderReviews();
  try {
    rv.list = await api('reviews', 'list', { slug: court.slug }, 'GET');
  } catch (error) {
    rv.error = 'Chưa tải được đánh giá của khách. ' + error.message;
  }
  rv.loading = false;
  renderReviews();
}

$('#reviews').addEventListener('click', (event) => {
  const t = event.target;
  if (t.closest('[data-write-review]')) {
    rv.success = '';
    return openReviewModal({
      courtName: court.name,
      courtSlug: court.slug,
      onSubmitted: (review) => {
        rv.success = `Cảm ơn ${review.name}! Đánh giá ${review.rating} sao của bạn đã được đăng công khai trên trang sân.`;
        loadReviews();
      },
    });
  }
  if (t.closest('[data-reload]')) return loadReviews();
  const star = t.closest('[data-star-filter]');
  if (star) {
    const v = Number(star.dataset.starFilter);
    rv.star = rv.star === v ? null : v;
    rv.expanded = false;
    return renderReviews();
  }
  const tag = t.closest('[data-tag-filter]');
  if (tag) {
    const v = tag.dataset.tagFilter;
    rv.tags = rv.tags.includes(v) ? rv.tags.filter((x) => x !== v) : [...rv.tags, v];
    rv.expanded = false;
    return renderReviews();
  }
  if (t.closest('[data-reset-filter]')) {
    rv.star = null;
    rv.tags = [];
    rv.expanded = false;
    return renderReviews();
  }
  if (t.closest('[data-expand-reviews]')) {
    rv.expanded = !rv.expanded;
    renderReviews();
  }
});
loadReviews();
