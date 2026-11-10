/**
 * Hộp thoại viết đánh giá sân — dùng ở trang chi tiết sân và trang tài khoản.
 * openReviewModal({ courtName, courtSlug, bookingCode, onSubmitted })
 * - Có bookingCode: đánh giá gắn đơn đã hoàn thành (nhãn "Đã chơi").
 * - Không có: đánh giá công khai theo sân, có ô "Tên hiển thị".
 */
import { api, esc, openModal } from './ui.js';

const TAGS = ['Mặt sân tốt', 'Đèn sáng', 'Sạch sẽ', 'Nhân viên thân thiện', 'Giá hợp lý', 'Dễ tìm', 'Có chỗ giữ xe', 'Đặt sân nhanh'];
const LABELS = { 1: 'Chưa tốt', 2: 'Cần cải thiện', 3: 'Bình thường', 4: 'Tốt', 5: 'Tuyệt vời' };

export function openReviewModal({ courtName = '', courtSlug = '', bookingCode = '', onSubmitted }) {
  const locked = Boolean(bookingCode);
  const state = { rating: 0, hover: 0, tags: [] };
  const modal = openModal({
    size: 'max-w-lg',
    html: `
    <div class="flex items-start justify-between gap-3 border-b border-background-200 px-5 py-4">
      <div class="min-w-0">
        <h2 class="font-heading text-lg font-extrabold text-foreground-950">Đánh giá lượt chơi</h2>
        <p class="mt-1 text-xs text-foreground-500">${courtName ? `Chia sẻ cảm nhận của bạn về ${esc(courtName)}` : 'Chia sẻ cảm nhận của bạn về sân vừa chơi'}</p>
      </div>
      <button type="button" data-close aria-label="Đóng" class="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-md text-foreground-500 transition-colors hover:bg-background-100 hover:text-foreground-900"><i class="ri-close-line text-xl" aria-hidden="true"></i></button>
    </div>
    <div class="px-5 py-4">
      <div class="rounded-md border border-primary-200 bg-primary-50 px-3.5 py-3">
        <p class="flex items-start gap-2 text-xs leading-relaxed text-primary-900"><i class="ri-shield-check-line mt-0.5 text-base" aria-hidden="true"></i><span>Đánh giá của bạn được đăng công khai ngay sau khi gửi và không cần mã đơn. Nếu bạn đã đặt sân qua website, hãy gửi đánh giá từ mục Tài khoản → Lịch sử để đánh giá được gắn nhãn “Đã chơi”.</span></p>
      </div>
      ${
        locked
          ? `<div class="mt-4 flex items-center gap-2 rounded-md border border-background-300 bg-background-50 px-3 py-2.5"><i class="ri-ticket-2-line text-foreground-500" aria-hidden="true"></i><span class="font-mono text-sm font-semibold text-foreground-950">${esc(bookingCode)}</span><span class="ml-auto text-[11px] font-medium text-primary-700">Đơn đã hoàn thành</span></div>`
          : `<div class="mt-4">
              <label for="review-name" class="mb-1.5 block text-sm font-semibold text-foreground-900">Tên hiển thị</label>
              <input id="review-name" type="text" maxlength="60" placeholder="Ví dụ: Minh Anh" class="w-full rounded-md border border-background-300 bg-white px-3 py-2.5 text-sm text-foreground-950 placeholder:text-foreground-400 focus:border-primary-400 focus:outline-none">
              <p class="mt-1 text-[11px] text-foreground-500">Không bắt buộc. Bỏ trống thì đánh giá sẽ hiển thị với tên “Khách ghé sân”.</p>
            </div>`
      }
      <div class="mt-4">
        <span class="block text-sm font-semibold text-foreground-900">Chất lượng sân <span class="text-accent-600">*</span></span>
        <div class="mt-2 flex flex-wrap items-center gap-1.5" data-stars>
          ${[1, 2, 3, 4, 5]
            .map((s) => `<button type="button" data-star="${s}" aria-label="Chọn ${s} sao" class="flex h-10 w-10 cursor-pointer items-center justify-center rounded-md transition-colors hover:bg-accent-50"><i class="ri-star-line text-2xl text-background-400" aria-hidden="true"></i></button>`)
            .join('')}
          <span data-star-label class="ml-1 text-sm font-semibold text-foreground-800">Chọn số sao</span>
        </div>
      </div>
      <div class="mt-4">
        <span class="block text-sm font-semibold text-foreground-900">Sân có gì nổi bật?</span>
        <p class="mt-0.5 text-[11px] text-foreground-500">Chọn tối đa 4 tiêu chí bạn thấy đúng nhất.</p>
        <div class="mt-2 flex flex-wrap gap-1.5" data-tags></div>
      </div>
      <div class="mt-4">
        <label for="review-comment" class="mb-1.5 block text-sm font-semibold text-foreground-900">Cảm nhận của bạn <span class="text-accent-600">*</span></label>
        <textarea id="review-comment" rows="4" maxlength="500" placeholder="Ví dụ: Mặt sân cỏ êm, đèn sáng đều, nhân viên giữ xe nhiệt tình. Đội mình sẽ quay lại..." class="w-full resize-none rounded-md border border-background-300 bg-white px-3 py-2.5 text-sm text-foreground-950 placeholder:text-foreground-400 focus:border-primary-400 focus:outline-none"></textarea>
        <div class="mt-1.5 flex items-center justify-between gap-3"><p class="text-[11px] text-foreground-500">Đánh giá sẽ hiển thị công khai trên trang chi tiết sân.</p><span data-count class="shrink-0 text-[11px] text-foreground-400">0/500</span></div>
      </div>
      <p data-error class="mt-2 hidden items-start gap-1.5 rounded-md bg-accent-50 px-3 py-2 text-xs font-medium leading-relaxed text-accent-800"></p>
    </div>
    <div class="flex flex-col-reverse gap-2.5 border-t border-background-200 px-5 py-4 sm:flex-row sm:justify-end">
      <button type="button" data-close class="cursor-pointer whitespace-nowrap rounded-md border border-background-300 px-4 py-2.5 text-sm font-semibold text-foreground-800 transition-colors hover:border-primary-400 hover:text-primary-700">Để sau</button>
      <button type="button" data-submit class="inline-flex cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-md bg-primary-500 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-600 disabled:cursor-not-allowed disabled:opacity-70"><i class="ri-send-plane-line" aria-hidden="true"></i>Gửi đánh giá</button>
    </div>`,
  });
  const el = modal.el;
  const q = (s) => el.querySelector(s);
  const setError = (msg) => {
    const box = q('[data-error]');
    box.innerHTML = msg ? `<i class="ri-error-warning-line mt-0.5" aria-hidden="true"></i>${esc(msg)}` : '';
    box.classList.toggle('hidden', !msg);
    box.classList.toggle('flex', Boolean(msg));
  };
  const paintStars = () => {
    const active = state.hover || state.rating;
    el.querySelectorAll('[data-star]').forEach((btn) => {
      const s = Number(btn.dataset.star);
      btn.firstElementChild.className = `text-2xl ${s <= active ? 'ri-star-fill text-accent-500' : 'ri-star-line text-background-400'}`;
    });
    q('[data-star-label]').textContent = active ? LABELS[active] : 'Chọn số sao';
  };
  const paintTags = () => {
    q('[data-tags]').innerHTML = TAGS.map((tag) => {
      const on = state.tags.includes(tag);
      return `<button type="button" data-tag="${esc(tag)}" class="cursor-pointer whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
        on ? 'border-primary-400 bg-primary-50 text-primary-800' : 'border-background-300 bg-white text-foreground-600 hover:border-primary-300 hover:text-primary-700'
      }">${on ? '<i class="ri-check-line mr-1" aria-hidden="true"></i>' : ''}${esc(tag)}</button>`;
    }).join('');
  };
  paintTags();

  el.addEventListener('click', async (event) => {
    const star = event.target.closest('[data-star]');
    if (star) {
      state.rating = Number(star.dataset.star);
      setError('');
      return paintStars();
    }
    const tag = event.target.closest('[data-tag]');
    if (tag) {
      const t = tag.dataset.tag;
      if (state.tags.includes(t)) state.tags = state.tags.filter((x) => x !== t);
      else if (state.tags.length < 4) state.tags.push(t);
      setError('');
      return paintTags();
    }
    const submit = event.target.closest('[data-submit]');
    if (!submit) return;
    const comment = q('#review-comment').value.trim();
    if (!state.rating) return setError('Hãy chọn số sao cho lượt chơi này.');
    if (comment.length < 10) return setError('Vui lòng chia sẻ thêm vài dòng cảm nhận (ít nhất 10 ký tự).');
    submit.disabled = true;
    submit.innerHTML = '<i class="ri-loader-4-line animate-spin" aria-hidden="true"></i>Đang gửi...';
    try {
      const review = await api('reviews', 'submit', {
        courtSlug,
        bookingCode,
        customerName: locked ? '' : q('#review-name').value.trim(),
        rating: state.rating,
        comment,
        tags: state.tags,
      });
      modal.close();
      if (onSubmitted) onSubmitted(review);
    } catch (error) {
      setError(error.message);
      submit.disabled = false;
      submit.innerHTML = '<i class="ri-send-plane-line" aria-hidden="true"></i>Gửi đánh giá';
    }
  });
  const starsBox = q('[data-stars]');
  starsBox.addEventListener('mouseover', (event) => {
    const star = event.target.closest('[data-star]');
    if (star) {
      state.hover = Number(star.dataset.star);
      paintStars();
    }
  });
  starsBox.addEventListener('mouseleave', () => {
    state.hover = 0;
    paintStars();
  });
  q('#review-comment').addEventListener('input', (event) => {
    q('[data-count]').textContent = `${event.target.value.length}/500`;
    setError('');
  });
}
