/**
 * Vé điện tử: dữ liệu ảnh vé, tải ảnh vé, xem trước ảnh vé, hộp chia sẻ vé.
 */
import { esc, openModal } from './ui.js';
import { renderTicketImageBlob, saveTicketImage } from '../lib/ticketImage.js';
import { SHARE_CHANNELS, buildTicketShareText, copyTicketText, shareTicketNative } from '../lib/ticketShare.js';
import { buildTicketQrUrl, HOTLINE } from '../lib/payment.js';
import { formatLongDate } from '../lib/format.js';
import { formatTimeRange } from '../lib/booking.js';
import { formatCancelDeadline, CANCEL_CUTOFF_HOURS } from '../lib/cancelPolicy.js';

/** Chuỗi mã hóa trong QR vé: mã|sân|ngày|giờ bắt đầu|thời lượng */
export const ticketPayload = (b) => `${b.code}|${b.courtName}|${b.date}|${b.startSlot || b.slots[0]}|${b.durationMinutes || b.slots.length * 60}`;
export const ticketQrUrl = (b) => buildTicketQrUrl(ticketPayload(b));

/** Dữ liệu vẽ ảnh vé từ một đơn (định dạng map_booking của PHP) */
export function ticketData(b) {
  const start = b.startSlot || b.slots[0];
  const duration = b.durationMinutes || b.slots.length * 60;
  return {
    code: b.code,
    courtName: b.courtName,
    dateLabel: formatLongDate(b.date),
    timeLabel: formatTimeRange(start, duration),
    address: b.address || '',
    customerName: b.customerName,
    phone: b.customerPhone,
    total: b.totalPrice,
    deposit: b.paymentStatus === 'paid' ? b.totalPrice : b.depositAmount,
    deadlineLabel: formatCancelDeadline(b.date, start) || `Trước giờ chơi ${CANCEL_CUTOFF_HOURS} giờ`,
    qrUrl: ticketQrUrl(b),
    hotline: HOTLINE,
  };
}

/** Tạo ảnh vé, tải về và mở bản xem trước. Trả về thông báo cho người dùng. */
export async function downloadTicket(data) {
  const blob = await renderTicketImageBlob(data);
  saveTicketImage(blob, data.code);
  openTicketPreview(URL.createObjectURL(blob), data.code);
  return 'Ảnh vé đã sẵn sàng. Trên điện thoại, nhấn giữ vào ảnh để lưu vào Thư viện ảnh.';
}

export function openTicketPreview(imageUrl, code) {
  openModal({
    size: 'max-w-md',
    onClose: () => URL.revokeObjectURL(imageUrl),
    html: `<div class="p-4 sm:p-5">
      <div class="flex items-start justify-between gap-3">
        <div class="min-w-0"><p class="text-[11px] font-semibold uppercase tracking-wide text-foreground-500">Ảnh vé đã tạo</p><p class="mt-0.5 font-mono text-xs font-semibold text-foreground-900">${esc(code)}</p></div>
        <button type="button" data-close aria-label="Đóng" class="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-md text-foreground-500 transition-colors hover:bg-background-100 hover:text-foreground-900"><i class="ri-close-line text-lg" aria-hidden="true"></i></button>
      </div>
      <div class="mt-3 overflow-hidden rounded-md border border-background-200 bg-background-50"><img src="${imageUrl}" alt="Ảnh vé điện tử ${esc(code)}" class="h-auto w-full object-contain"></div>
      <p class="mt-3 flex items-start gap-1.5 rounded-md bg-primary-50/70 px-3 py-2.5 text-[11px] leading-relaxed text-foreground-800"><i class="ri-smartphone-line mt-0.5 text-primary-600" aria-hidden="true"></i><span>Trên điện thoại, bạn <strong class="font-semibold text-foreground-950">nhấn giữ vào ảnh</strong> rồi chọn “Lưu vào ảnh / Tải ảnh xuống”. Trên máy tính, bấm nút tải bên dưới.</span></p>
      <div class="mt-3 flex flex-col gap-2 sm:flex-row">
        <a href="${imageUrl}" download="ve-dien-tu-${esc(code)}.png" class="flex flex-1 cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-md bg-primary-500 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-600"><i class="ri-download-2-line" aria-hidden="true"></i>Tải ảnh vé</a>
        <button type="button" data-close class="cursor-pointer whitespace-nowrap rounded-md border border-background-300 px-4 py-2.5 text-sm font-semibold text-foreground-800 transition-colors hover:border-primary-400 hover:text-primary-700">Xong</button>
      </div>
    </div>`,
  });
}

export function openShareSheet(data) {
  const message = buildTicketShareText(data);
  const modal = openModal({
    size: 'max-w-md',
    html: `<div class="p-4 sm:p-5">
      <div class="flex items-start justify-between gap-3">
        <div class="min-w-0"><p class="text-[11px] font-semibold uppercase tracking-wide text-foreground-500">Chia sẻ vé</p><h2 class="mt-0.5 font-heading text-base font-extrabold text-foreground-950">Gửi vé cho người cùng đội</h2><p class="mt-1 font-mono text-xs font-semibold text-primary-800">${esc(data.code)}</p></div>
        <button type="button" data-close aria-label="Đóng" class="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-md text-foreground-500 transition-colors hover:bg-background-100 hover:text-foreground-900"><i class="ri-close-line text-lg" aria-hidden="true"></i></button>
      </div>
      <div class="mt-3 min-w-0"><p class="text-[11px] font-semibold uppercase tracking-wide text-foreground-500">Nội dung sẽ gửi</p><pre class="mt-1.5 max-h-40 w-full overflow-y-auto whitespace-pre-wrap break-words rounded-md border border-background-200 bg-background-50 p-3 font-sans text-[11px] leading-relaxed text-foreground-800">${esc(message)}</pre></div>
      <div class="mt-3 grid grid-cols-2 gap-2.5">${SHARE_CHANNELS.map(
        (c) => `<a href="${c.href}" target="_blank" rel="noopener noreferrer" data-channel="${c.label}" class="flex cursor-pointer flex-col items-center gap-1 rounded-lg border border-background-200 bg-background-50 px-2 py-3 text-center transition-colors hover:border-primary-400 hover:bg-primary-50/70"><span class="flex h-9 w-9 items-center justify-center rounded-full bg-white text-primary-600"><i class="${c.icon} text-lg" aria-hidden="true"></i></span><span class="text-xs font-semibold text-foreground-900">${c.label}</span><span class="text-[10px] leading-tight text-foreground-500">${c.hint}</span></a>`,
      ).join('')}</div>
      <label class="mt-3 flex cursor-pointer items-start gap-2.5 rounded-md border border-background-200 bg-background-50 px-3 py-2.5"><input type="checkbox" data-include checked class="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-primary-500"><span class="min-w-0 text-[11px] leading-relaxed text-foreground-700"><span class="block font-semibold text-foreground-900">Kèm ảnh vé khi chia sẻ</span><span class="block text-foreground-500">Ảnh vé được gửi kèm ở nút “Chia sẻ kèm ảnh”. Với Zalo / Messenger, bạn đính kèm ảnh đã tải.</span></span></label>
      <div class="mt-3 flex flex-col gap-2">
        <button type="button" data-native class="flex w-full cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-md bg-primary-500 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-600 disabled:cursor-not-allowed disabled:opacity-70"><i class="ri-share-forward-2-line" aria-hidden="true"></i><span>Chia sẻ kèm ảnh</span></button>
        <div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <button type="button" data-copy class="flex w-full cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-md border border-background-300 px-3 py-2.5 text-xs font-semibold text-foreground-800 transition-colors hover:border-primary-400 hover:text-primary-700"><i class="ri-file-copy-line text-sm" aria-hidden="true"></i>Sao chép nội dung</button>
          <button type="button" data-save class="flex w-full cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-md border border-background-300 px-3 py-2.5 text-xs font-semibold text-foreground-800 transition-colors hover:border-primary-400 hover:text-primary-700"><i class="ri-image-line text-sm" aria-hidden="true"></i>Tải ảnh để đính kèm</button>
        </div>
      </div>
      <p data-status class="mt-2.5 hidden"></p>
      <p class="mt-2.5 flex items-start gap-1.5 text-[11px] leading-relaxed text-foreground-500"><i class="ri-information-line mt-0.5" aria-hidden="true"></i><span>Mã vé là căn cứ check-in tại sân, bạn chỉ nên chia sẻ trong nhóm đội của mình.</span></p>
    </div>`,
  });
  const el = modal.el;
  const setStatus = (tone, text) => {
    const box = el.querySelector('[data-status]');
    if (!text) return box.classList.add('hidden');
    box.className = `mt-2.5 flex items-start gap-1.5 rounded-md px-3 py-2.5 text-[11px] leading-relaxed ${
      tone === 'error' ? 'border border-accent-300 bg-accent-50 text-accent-900' : 'border border-primary-300 bg-primary-50/70 text-foreground-800'
    }`;
    box.innerHTML = `<i class="mt-0.5 ${tone === 'error' ? 'ri-error-warning-line text-accent-700' : 'ri-checkbox-circle-line text-primary-600'}" aria-hidden="true"></i><span>${esc(text)}</span>`;
  };
  const include = el.querySelector('[data-include]');
  include.addEventListener('change', () => {
    el.querySelector('[data-native] span').textContent = include.checked ? 'Chia sẻ kèm ảnh' : 'Chia sẻ nội dung vé';
  });
  el.addEventListener('click', async (event) => {
    const channel = event.target.closest('[data-channel]');
    if (channel) {
      const label = channel.dataset.channel;
      const ok = await copyTicketText(message);
      return ok
        ? setStatus('info', `Đã sao chép nội dung vé. Dán vào cuộc trò chuyện ${label} để gửi cho người cùng đội.`)
        : setStatus('error', `Chưa sao chép tự động được. Bấm “Sao chép nội dung” rồi dán vào ${label}.`);
    }
    if (event.target.closest('[data-copy]')) {
      const ok = await copyTicketText(message);
      return ok
        ? setStatus('info', 'Đã sao chép nội dung vé. Bạn có thể dán vào bất kỳ cuộc trò chuyện nào.')
        : setStatus('error', 'Chưa sao chép được. Hãy bôi đen nội dung vé bên trên và sao chép thủ công.');
    }
    if (event.target.closest('[data-save]')) {
      try {
        saveTicketImage(await renderTicketImageBlob(data), data.code);
        setStatus('info', 'Đã tải ảnh vé về máy. Bạn đính kèm ảnh này khi nhắn trong Zalo hoặc Messenger nhé.');
      } catch (error) {
        setStatus('error', error.message || 'Chưa tạo được ảnh vé. Vui lòng thử lại.');
      }
      return;
    }
    const native = event.target.closest('[data-native]');
    if (native) {
      native.disabled = true;
      let file = null;
      if (include.checked) {
        try {
          const blob = await renderTicketImageBlob(data);
          file = new File([blob], `ve-dien-tu-${data.code}.png`, { type: 'image/png' });
        } catch {
          file = null;
        }
      }
      const outcome = await shareTicketNative({ title: `Vé sân ${data.code} · ${data.courtName}`, text: message, file });
      if (outcome === 'shared') setStatus('info', 'Đã mở hộp chia sẻ. Chọn Zalo hoặc Messenger để gửi cho người cùng đội.');
      else if (outcome === 'cancelled') setStatus('', '');
      else if (outcome === 'unsupported') {
        const ok = await copyTicketText(message);
        ok
          ? setStatus('info', 'Thiết bị này chưa hỗ trợ hộp chia sẻ. Nội dung vé đã được sao chép — bạn dán vào Zalo hoặc Messenger nhé.')
          : setStatus('error', 'Chưa chia sẻ được. Bấm “Sao chép nội dung” rồi dán vào Zalo hoặc Messenger.');
      } else setStatus('error', 'Chưa chia sẻ được. Bạn thử chọn Zalo / Messenger bên trên hoặc sao chép nội dung.');
      native.disabled = false;
    }
  });
}
