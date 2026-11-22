/** Trang ưu đãi: mã giảm giá & ưu đãi giờ vàng + Vòng quay ưu đãi + lưu vào Ví voucher. */
import { $, APP, PAGE, api, esc, url, copyText, toast } from '../core/ui.js';
import { WEEKDAY_SHORT, describeConditions, describeDiscount, promotionState } from '../lib/promotions.js';

const items = (PAGE.promotions || []).filter((p) => ['active', 'upcoming'].includes(promotionState(p)));
const st = { filter: 'all', keyword: '', copied: '', saved: new Set() };
let lastCheckedPromo = null;
const meta = {
  active: ['Đang áp dụng', 'bg-primary-50 text-primary-800', 'bg-primary-500'],
  upcoming: ['Sắp mở', 'bg-secondary-100 text-secondary-900', 'bg-secondary-500'],
  expired: ['Đã kết thúc', 'bg-background-200 text-foreground-600', 'bg-foreground-400'],
  paused: ['Tạm dừng', 'bg-accent-100 text-accent-900', 'bg-accent-500'],
};
const day = (iso) => iso.split('-').reverse().join('/');
const isGoldenHour = (p) => Boolean(p.startTime && p.endTime);

function card(p) {
  const state = promotionState(p);
  const [label, tone, dot] = meta[state];
  const copied = st.copied === p.code;
  const saved = st.saved.has(p.code);
  const headline = p.discountType === 'percent' ? `${p.discountValue}%` : `${Math.round(p.discountValue / 1000)}K`;
  return `<article class="flex h-full flex-col overflow-hidden rounded-lg border border-background-200 bg-white transition-shadow hover:shadow-lg">
    <div class="relative flex items-start justify-between gap-3 bg-foreground-950 px-4 py-3.5">
      <div class="min-w-0"><p class="text-[11px] font-semibold uppercase tracking-[0.14em] text-background-300">${isGoldenHour(p) ? 'Ưu đãi giờ vàng' : 'Mã ưu đãi'}</p>
        <p class="mt-1 font-heading text-3xl font-extrabold leading-none text-background-50">${headline}<span class="ml-1.5 align-middle text-xs font-semibold text-background-300">${p.discountType === 'percent' ? 'giảm giá' : 'đ'}</span></p>
        <p class="mt-1.5 text-[11px] leading-snug text-background-200">${esc(describeDiscount(p))}</p></div>
      <span class="inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${tone}"><span class="h-1.5 w-1.5 rounded-full ${dot}"></span>${label}</span>
    </div>
    <div class="flex flex-1 flex-col px-4 pb-4">
      <div class="-mx-4 border-t border-dashed border-background-300"></div>
      <button type="button" data-copy-code="${esc(p.code)}" title="Sao chép mã giảm giá" class="mt-3 flex w-full cursor-pointer items-center justify-between gap-2 rounded-md border border-dashed border-primary-300 bg-primary-50 px-3 py-2.5 transition-colors hover:border-primary-500">
        <span class="flex min-w-0 items-center gap-2"><i class="ri-coupon-3-line shrink-0 text-base text-primary-600" aria-hidden="true"></i><span class="truncate font-mono text-sm font-extrabold tracking-widest text-primary-800">${esc(p.code)}</span></span>
        <span class="flex shrink-0 items-center gap-1 text-[11px] font-semibold text-primary-700"><i class="${copied ? 'ri-check-line' : 'ri-file-copy-line'}" aria-hidden="true"></i>${copied ? 'Đã chép' : 'Sao chép'}</span>
      </button>
      <h3 class="mt-3 font-heading text-base font-bold leading-snug text-foreground-950">${esc(p.title)}</h3>
      ${p.description ? `<p class="mt-1.5 line-clamp-3 text-sm leading-relaxed text-foreground-600">${esc(p.description)}</p>` : ''}
      <ul class="mt-3 space-y-1.5 text-xs leading-relaxed text-foreground-600">
        <li class="flex items-start gap-2"><i class="ri-calendar-line mt-0.5 shrink-0 text-foreground-400" aria-hidden="true"></i><span>Áp dụng từ <strong class="font-semibold text-foreground-900">${day(p.startDate)}</strong> đến <strong class="font-semibold text-foreground-900">${day(p.endDate)}</strong></span></li>
        ${p.weekdays.length > 0 && p.weekdays.length < 7 ? `<li class="flex items-start gap-2"><i class="ri-calendar-event-line mt-0.5 shrink-0 text-foreground-400" aria-hidden="true"></i><span class="flex flex-wrap gap-1">${p.weekdays.map((d) => `<span class="rounded-sm bg-background-100 px-1.5 py-0.5 text-[10px] font-semibold text-foreground-700">${WEEKDAY_SHORT[d]}</span>`).join('')}</span></li>` : ''}
        ${p.startTime && p.endTime ? `<li class="flex items-start gap-2"><i class="ri-time-line mt-0.5 shrink-0 text-accent-600" aria-hidden="true"></i><span class="font-semibold text-accent-800">Ưu đãi giờ vàng ${p.startTime} – ${p.endTime}</span></li>` : ''}
        ${p.minOrder > 0 ? `<li class="flex items-start gap-2"><i class="ri-shopping-bag-3-line mt-0.5 shrink-0 text-foreground-400" aria-hidden="true"></i><span>Đơn tối thiểu ${p.minOrder.toLocaleString('vi-VN')}đ</span></li>` : ''}
        ${p.ownerName ? `<li class="flex items-start gap-2"><i class="ri-store-2-line mt-0.5 shrink-0 text-foreground-400" aria-hidden="true"></i><span class="truncate">Từ ${esc(p.ownerName)}</span></li>` : ''}
      </ul>
      <p class="mt-2.5 rounded-md bg-background-50 px-2.5 py-2 text-[11px] leading-relaxed text-foreground-500">${esc(describeConditions(p))}</p>
      <div class="mt-auto flex items-center gap-2 pt-4">
        <button type="button" data-save-voucher="${esc(p.code)}" class="inline-flex flex-1 cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-md border ${saved ? 'border-primary-300 bg-primary-50 text-primary-800' : 'border-background-300 bg-white text-foreground-800 hover:border-primary-400 hover:text-primary-700'} px-3 py-2.5 text-xs font-semibold transition-colors"><i class="${saved ? 'ri-check-line' : 'ri-wallet-3-line'}" aria-hidden="true"></i>${saved ? 'Đã lưu ví' : 'Lưu ví'}</button>
        ${state === 'active'
      ? `<a href="${url(`/dat-san?promo=${encodeURIComponent(p.code)}`)}" class="inline-flex flex-1 cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-md bg-primary-500 px-3 py-2.5 text-xs font-bold text-white transition-colors hover:bg-primary-600">Đặt sân ngay<i class="ri-arrow-right-line" aria-hidden="true"></i></a>`
      : `<span class="inline-flex flex-1 cursor-not-allowed items-center justify-center gap-1.5 whitespace-nowrap rounded-md bg-background-200 px-3 py-2.5 text-xs font-bold text-foreground-500">${state === 'upcoming' ? 'Chưa tới ngày' : 'Tạm dừng'}</span>`
    }
      </div>
    </div>
  </article>`;
}

function render() {
  const countOf = (k) => {
    if (k === 'all') return items.length;
    if (k === 'golden') return items.filter(isGoldenHour).length;
    return items.filter((p) => promotionState(p) === k).length;
  };
  $('#promo-filters').innerHTML = [
    ['all', 'Tất cả ưu đãi', 'ri-coupon-3-line'],
    ['golden', 'Ưu đãi giờ vàng', 'ri-sun-line'],
    ['active', 'Dùng được ngay', 'ri-flashlight-line'],
    ['upcoming', 'Sắp mở', 'ri-time-line'],
  ]
    .map(
      ([k, label, icon]) => `<button type="button" data-filter="${k}" class="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${st.filter === k ? 'bg-white text-foreground-950 shadow-sm' : 'text-foreground-600 hover:text-foreground-950'}"><i class="${icon}" aria-hidden="true"></i>${label}<span class="text-[10px] font-bold text-foreground-400">${countOf(k)}</span></button>`,
    )
    .join('');
  const text = st.keyword.trim().toLowerCase();
  const order = { active: 0, upcoming: 1 };
  const list = items
    .filter((p) => (st.filter === 'all' ? true : st.filter === 'golden' ? isGoldenHour(p) : promotionState(p) === st.filter))
    .filter((p) => !text || `${p.code} ${p.title} ${p.ownerName}`.toLowerCase().includes(text))
    .sort((a, b) => order[promotionState(a)] - order[promotionState(b)] || (b.discountType === 'percent' ? b.discountValue : b.discountValue / 1000) - (a.discountType === 'percent' ? a.discountValue : a.discountValue / 1000));
  $('#promo-list').innerHTML = list.length
    ? `<div class="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">${list.map(card).join('')}</div>`
    : `<div class="mt-6 flex flex-col items-center justify-center gap-2 rounded-lg border border-background-200 bg-white px-6 py-16 text-center"><span class="flex h-12 w-12 items-center justify-center rounded-full bg-background-100 text-foreground-500"><i class="ri-coupon-3-line text-2xl" aria-hidden="true"></i></span>
      <p class="text-sm font-semibold text-foreground-950">${items.length === 0 ? 'Hiện chưa có mã giảm giá nào' : 'Không có mã khớp với bộ lọc'}</p>
      <p class="max-w-md text-xs leading-relaxed text-foreground-500">${items.length === 0 ? 'Các chủ sân đang chuẩn bị chương trình mới. Bạn vẫn có thể thử Vòng quay ưu đãi bên dưới nhé.' : 'Thử xoá từ khoá tìm kiếm hoặc chuyển sang nhóm “Tất cả ưu đãi” để xem toàn bộ mã.'}</p>
      ${items.length ? '<button type="button" data-clear class="mt-1 cursor-pointer whitespace-nowrap rounded-md border border-background-300 px-4 py-2 text-xs font-semibold text-foreground-700 transition-colors hover:border-primary-400 hover:text-primary-700">Xoá bộ lọc</button>' : ''}</div>`;
}

// ---------------- VÒNG QUAY ƯU ĐÃI ----------------
const WHEEL_PRIZES = [
  { code: 'QUAY10', short: '-10%', sub: 'Tiền sân', badge: '-10%', title: 'Giảm 10% tiền sân', type: 'percent', value: 10, desc: 'Áp dụng cho mọi khung giờ từ 100.000đ', color: '#15803d', colorDark: '#166534' },
  { code: 'QUAY20K', short: '20K', sub: 'Voucher', badge: '20K', title: 'Voucher 20.000đ', type: 'amount', value: 20000, desc: 'Trừ trực tiếp 20.000đ vào đơn đặt sân', color: '#ea580c', colorDark: '#c2410c' },
  { code: 'NUOCFREE', short: '2 Nước', sub: 'Miễn phí', badge: 'FREE', title: 'Tặng 2 chai nước suối', type: 'gift', value: 0, desc: 'Đưa mã cho nhân viên sân khi check-in', color: '#0f766e', colorDark: '#115e59' },
  { code: 'QUAY15', short: '-15%', sub: 'Giờ vàng', badge: '-15%', title: 'Giảm 15% giờ vàng', type: 'percent', value: 15, desc: 'Áp dụng khung sáng – chiều 05:00 - 16:00', color: '#d97706', colorDark: '#b45309' },
  { code: 'QUAY50K', short: '50K', sub: 'VIP', badge: '50K', title: 'Voucher VIP 50.000đ', type: 'amount', value: 50000, desc: 'Áp dụng cho đơn đặt từ 300.000đ', color: '#2563eb', colorDark: '#1d4ed8' },
  { code: 'THEM30P', short: '+30 Phút', sub: 'Chơi thêm', badge: '+30P', title: 'Tặng 30 phút chơi thêm', type: 'gift', value: 0, desc: 'Áp dụng khi sân còn trống khung liền kề', color: '#7c3aed', colorDark: '#6d28d9' },
];
let wheelDeg = 0;
let wheelBusy = false;
let wheelWinnerIdx = -1;
let wheelNextAt = 0;
let wheelTimer = null;
const WHEEL_COOLDOWN_MS = ((PAGE.wheel && PAGE.wheel.cooldownHours) || 48) * 3600 * 1000;
const wheelStoreKey = () => `bmt24h_wheel_v2_${APP.user ? APP.user.id : 'guest'}`;

function pad2(n) {
  return String(Math.max(0, Math.floor(n))).padStart(2, '0');
}

function readLocalWheel() {
  try {
    const raw = localStorage.getItem(wheelStoreKey());
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveLocalWheel(nextAt, prize) {
  try {
    localStorage.setItem(wheelStoreKey(), JSON.stringify({ nextSpinAt: nextAt, lastPrize: prize || null }));
  } catch { /* ignore */ }
}

function renderWinBanner(prize, savedNote, isHistory = false) {
  const box = $('#promo-spin-result');
  if (!box || !prize) return;
  box.innerHTML = `<div class="rounded-lg border border-primary-300 bg-primary-50 p-4">
    <p class="text-xs font-bold uppercase tracking-wide text-primary-700"><i class="ri-trophy-line mr-1"></i>${isHistory ? 'Phần thưởng lượt quay gần nhất của bạn' : 'Chúc mừng bạn trúng thưởng!'}</p>
    <p class="mt-1 font-heading text-lg font-extrabold text-foreground-950">${esc(prize.title)} <span class="ml-1 inline-block rounded border border-primary-200 bg-white px-2 py-0.5 font-mono text-sm text-primary-700">${esc(prize.code)}</span></p>
    <p class="mt-1 text-xs text-foreground-600">${esc(prize.desc || '')}${savedNote ? ` · <b>${esc(savedNote)}</b>` : ''}</p>
    <div class="mt-3 flex flex-wrap gap-2">
      <button type="button" data-copy-code="${esc(prize.code)}" class="cursor-pointer rounded-md border border-primary-300 bg-white px-3 py-1.5 text-xs font-semibold text-primary-700 hover:bg-primary-100"><i class="ri-file-copy-line mr-1"></i>Sao chép mã</button>
      <a href="${url(`/dat-san?promo=${encodeURIComponent(prize.code)}`)}" class="rounded-md bg-primary-500 px-3 py-1.5 text-xs font-bold text-white hover:bg-primary-600">Đặt sân dùng ngay</a>
    </div>
  </div>`;
}

function buildWheelSvg() {
  const n = WHEEL_PRIZES.length;
  const slice = 360 / n;
  const cx = 160;
  const cy = 160;
  const r = 158;
  const toRad = (deg) => ((deg - 90) * Math.PI) / 180;

  const defs = WHEEL_PRIZES.map(
    (p, i) => `<radialGradient id="wgrad-${i}" cx="50%" cy="50%" r="65%">
      <stop offset="25%" stop-color="${p.color}"/>
      <stop offset="100%" stop-color="${p.colorDark}"/>
    </radialGradient>`,
  ).join('');

  const slices = WHEEL_PRIZES.map((p, i) => {
    const startDeg = i * slice;
    const endDeg = (i + 1) * slice;
    const midDeg = startDeg + slice / 2;
    const x1 = cx + r * Math.cos(toRad(startDeg));
    const y1 = cy + r * Math.sin(toRad(startDeg));
    const x2 = cx + r * Math.cos(toRad(endDeg));
    const y2 = cy + r * Math.sin(toRad(endDeg));
    const largeArc = slice > 180 ? 1 : 0;
    const d = `M ${cx} ${cy} L ${x1.toFixed(2)} ${y1.toFixed(2)} A ${r} ${r} 0 ${largeArc} 1 ${x2.toFixed(2)} ${y2.toFixed(2)} Z`;

    const tx = cx + 104 * Math.cos(toRad(midDeg));
    const ty = cy + 104 * Math.sin(toRad(midDeg));
    return `<g>
      <path d="${d}" fill="url(#wgrad-${i})" stroke="rgba(255,255,255,0.28)" stroke-width="2"/>
      <g transform="translate(${tx.toFixed(2)}, ${ty.toFixed(2)}) rotate(${midDeg})">
        <text x="0" y="-4" text-anchor="middle" fill="#ffffff" font-family="Plus Jakarta Sans, Inter, sans-serif" font-size="17" font-weight="800" style="text-shadow:0 1px 3px rgba(0,0,0,0.45)">${esc(p.short)}</text>
        <text x="0" y="13" text-anchor="middle" fill="rgba(255,255,255,0.9)" font-family="Inter, sans-serif" font-size="10.5" font-weight="600">${esc(p.sub)}</text>
      </g>
    </g>`;
  }).join('');

  return `<svg viewBox="0 0 320 320" role="img" aria-label="Vòng quay ưu đãi 6 phần thưởng">
    <defs>${defs}</defs>
    ${slices}
    <circle cx="${cx}" cy="${cy}" r="${r - 1}" fill="none" stroke="rgba(255,255,255,0.22)" stroke-width="2"/>
    <circle cx="${cx}" cy="${cy}" r="45" fill="rgba(0,0,0,0.18)"/>
  </svg>`;
}

function renderPrizeList() {
  const listEl = $('#promo-prize-list');
  if (!listEl) return;
  listEl.innerHTML = WHEEL_PRIZES.map((p, i) => {
    const won = i === wheelWinnerIdx;
    return `<li class="promo-prize-item ${won ? 'is-winner bg-primary-50/60' : 'bg-background-50'} flex items-center gap-3 rounded-lg border border-background-200 px-3 py-2.5 text-xs">
      <span class="flex h-10 w-12 shrink-0 items-center justify-center rounded-md font-heading text-xs font-extrabold text-white shadow-sm" style="background:linear-gradient(135deg,${p.color},${p.colorDark})">${esc(p.badge)}</span>
      <div class="min-w-0 flex-1">
        <div class="flex items-center gap-1.5">
          <p class="font-bold text-foreground-950 truncate">${esc(p.title)}</p>
          ${won ? '<span class="shrink-0 rounded-full bg-primary-500 px-1.5 py-0.5 text-[9px] font-bold uppercase text-white">Trúng</span>' : ''}
        </div>
        <p class="mt-0.5 text-[11px] text-foreground-500 truncate">${esc(p.desc)}</p>
      </div>
    </li>`;
  }).join('');
}

function updateWheelCooldownUI() {
  const spinBtn = $('#promo-spin-btn');
  const spinCta = $('#promo-spin-cta');
  const cdBox = $('#promo-wheel-countdown');
  const statusEl = $('#promo-wheel-status');
  const remMs = wheelNextAt - Date.now();

  if (wheelBusy) return;

  if (remMs > 0) {
    const totalSec = Math.ceil(remMs / 1000);
    const hrs = Math.floor(totalSec / 3600);
    const mins = Math.floor((totalSec % 3600) / 60);
    const secs = totalSec % 60;
    const hStr = pad2(hrs);
    const mStr = pad2(mins);
    const sStr = pad2(secs);

    if ($('#cd-hours')) $('#cd-hours').textContent = hStr;
    if ($('#cd-mins')) $('#cd-mins').textContent = mStr;
    if ($('#cd-secs')) $('#cd-secs').textContent = sStr;
    cdBox?.classList.remove('hidden');
    spinCta?.classList.add('hidden');
    if (spinBtn) {
      spinBtn.disabled = true;
      spinBtn.classList.add('is-locked');
      spinBtn.innerHTML = `<i class="ri-time-line text-lg leading-none" aria-hidden="true"></i><span class="text-[10px] font-bold tracking-tight leading-none mt-0.5">${hStr}:${mStr}</span>`;
    }
    if (statusEl) {
      statusEl.innerHTML = `<i class="ri-hourglass-2-line" aria-hidden="true"></i>Quay lại sau ${hStr}:${mStr}:${sStr}`;
    }
  } else {
    if (wheelTimer) {
      clearInterval(wheelTimer);
      wheelTimer = null;
    }
    wheelNextAt = 0;
    cdBox?.classList.add('hidden');
    spinCta?.classList.remove('hidden');
    if (spinCta) {
      spinCta.disabled = false;
      spinCta.innerHTML = '<i class="ri-sparkling-2-line text-sm" aria-hidden="true"></i><span>Quay ngay miễn phí</span>';
    }
    if (spinBtn) {
      spinBtn.disabled = false;
      spinBtn.classList.remove('is-locked');
      spinBtn.innerHTML = '<i class="ri-play-fill text-xl leading-none" aria-hidden="true"></i><span class="text-[11px] font-extrabold uppercase tracking-wider leading-none">Quay</span>';
    }
    if (statusEl) {
      statusEl.innerHTML = '<i class="ri-time-line" aria-hidden="true"></i>1 lượt quay / 48 giờ · Sẵn sàng';
    }
  }
}

function startWheelCountdown(nextAt) {
  wheelNextAt = nextAt;
  if (wheelTimer) clearInterval(wheelTimer);
  updateWheelCooldownUI();
  if (wheelNextAt > Date.now()) {
    wheelTimer = setInterval(updateWheelCooldownUI, 1000);
  }
}

function initPromoWheel() {
  const stage = $('#promo-wheel-stage');
  const wheel = $('#promo-wheel');
  const pegsEl = $('#promo-wheel-pegs');
  const spinBtn = $('#promo-spin-btn');
  const spinCta = $('#promo-spin-cta');
  if (!wheel || !spinBtn) return;

  wheel.innerHTML = buildWheelSvg();
  if (pegsEl) {
    pegsEl.innerHTML = Array.from({ length: 12 }, (_, i) => {
      const rad = ((i * 30 - 90) * Math.PI) / 180;
      const x = 50 + 48.1 * Math.cos(rad);
      const y = 50 + 48.1 * Math.sin(rad);
      return `<span class="promo-wheel-peg" style="left:${x.toFixed(2)}%;top:${y.toFixed(2)}%;transform:translate(-50%,-50%)"></span>`;
    }).join('');
  }

  // Khôi phục trạng thái đếm ngược 48h (ưu tiên dữ liệu server khi đã đăng nhập)
  const serverWheel = PAGE.wheel || {};
  const localWheel = readLocalWheel();
  const initialNext = APP.user
    ? Number(serverWheel.nextSpinAt || 0)
    : Number((localWheel && localWheel.nextSpinAt) || 0);
  const initialPrize = APP.user
    ? serverWheel.lastPrize
    : (localWheel && localWheel.lastPrize);

  if (initialNext > Date.now()) {
    if (initialPrize) {
      wheelWinnerIdx = WHEEL_PRIZES.findIndex((p) => p.code === initialPrize.code);
      renderWinBanner(
        initialPrize,
        APP.user ? 'Đã lưu trong Tài khoản → Ví voucher' : 'Đăng nhập để lưu mã vào Ví voucher',
        true,
      );
    }
    renderPrizeList();
    startWheelCountdown(initialNext);
  } else {
    renderPrizeList();
    updateWheelCooldownUI();
  }

  const slice = 360 / WHEEL_PRIZES.length;
  const doSpin = async () => {
    if (wheelBusy || wheelNextAt > Date.now()) return;
    wheelBusy = true;
    wheelWinnerIdx = -1;
    renderPrizeList();
    spinBtn.disabled = true;
    if (spinCta) {
      spinCta.disabled = true;
      spinCta.innerHTML = '<i class="ri-loader-4-line animate-spin text-sm" aria-hidden="true"></i><span>Đang quay...</span>';
    }

    const idx = Math.floor(Math.random() * WHEEL_PRIZES.length);
    const prize = WHEEL_PRIZES[idx];
    let nextAt = Date.now() + WHEEL_COOLDOWN_MS;
    let savedNote = 'Đăng nhập để tự động lưu phần thưởng vào Ví voucher.';

    if (APP.user) {
      try {
        const res = await api('account', 'wheel_spin', {
          code: prize.code,
          title: prize.title,
          description: prize.desc,
          discountType: prize.type,
          discountValue: prize.value,
        });
        if (res && res.nextSpinAt) nextAt = Number(res.nextSpinAt);
        savedNote = 'Đã tự động lưu vào Tài khoản → Ví voucher!';
      } catch (err) {
        wheelBusy = false;
        toast(err.message || 'Bạn chưa hết thời gian chờ 48 giờ.', 'error');
        updateWheelCooldownUI();
        return;
      }
    }

    saveLocalWheel(nextAt, { code: prize.code, title: prize.title, desc: prize.desc });
    stage?.classList.add('is-spinning');

    const jitter = (Math.random() - 0.5) * 14;
    const targetMod = ((360 - (idx * slice + slice / 2) + jitter) % 360 + 360) % 360;
    const curMod = ((wheelDeg % 360) + 360) % 360;
    const delta = (targetMod - curMod + 360) % 360;
    wheelDeg += 360 * 5 + delta;
    wheel.style.transform = `rotate(${wheelDeg}deg)`;

    setTimeout(() => {
      wheelBusy = false;
      wheelWinnerIdx = idx;
      stage?.classList.remove('is-spinning');
      renderPrizeList();
      renderWinBanner(prize, savedNote, false);
      if (APP.user) toast(`Chúc mừng! Đã lưu mã ${prize.code} vào Ví voucher.`);
      startWheelCountdown(nextAt);
    }, 4300);
  };

  spinBtn.addEventListener('click', doSpin);
  spinCta?.addEventListener('click', doSpin);
}

document.addEventListener('click', async (event) => {
  const f = event.target.closest('[data-filter]');
  if (f) {
    st.filter = f.dataset.filter;
    return render();
  }
  if (event.target.closest('[data-clear]')) {
    st.filter = 'all';
    st.keyword = '';
    $('#promo-search').value = '';
    return render();
  }
  const sv = event.target.closest('[data-save-voucher]');
  if (sv) {
    const code = sv.dataset.saveVoucher;
    const p = items.find((x) => x.code === code) || (lastCheckedPromo && lastCheckedPromo.code === code ? lastCheckedPromo : null);
    if (!p) return;
    if (!APP.user) {
      toast('Vui lòng đăng nhập để lưu mã vào Ví voucher.', 'info');
      return;
    }
    try {
      await api('account', 'voucher_save', {
        code: p.code,
        title: p.title,
        description: p.description || describeConditions(p),
        discountType: p.discountType,
        discountValue: p.discountValue,
        minOrder: p.minOrder || 0,
        expiresAt: p.endDate || null,
        source: p.isWheelPrize ? 'wheel' : 'promo',
      });
      st.saved.add(code);
      toast(`Đã lưu mã ${code} vào Ví voucher!`);
      render();
      const btnInResult = $(`#promo-checker-result [data-save-voucher="${code}"]`);
      if (btnInResult) {
        btnInResult.innerHTML = '<i class="ri-check-line text-sm"></i><span>Đã lưu ví</span>';
        btnInResult.classList.remove('border-background-300', 'bg-white', 'text-foreground-800');
        btnInResult.classList.add('border-primary-300', 'bg-primary-50', 'text-primary-800');
      }
    } catch (e) {
      toast(e.message, 'error');
    }
    return;
  }
  const c = event.target.closest('[data-copy-code]');
  if (c && (await copyText(c.dataset.copyCode))) {
    st.copied = c.dataset.copyCode;
    toast(`Đã sao chép mã ${c.dataset.copyCode}`);
    render();
    const btnInResult = $(`#promo-checker-result [data-copy-code="${c.dataset.copyCode}"]`);
    if (btnInResult) {
      btnInResult.innerHTML = '<i class="ri-check-line text-sm"></i><span>Đã chép mã</span>';
      setTimeout(() => {
        if (btnInResult) btnInResult.innerHTML = '<i class="ri-file-copy-line text-sm"></i><span>Sao chép mã</span>';
      }, 1800);
    }
    setTimeout(() => {
      st.copied = '';
      render();
    }, 1800);
  }
});

// ---------------- MỤC NHẬP & TRA CỨU MÃ ƯU ĐÃI MỚI ----------------
function renderCheckResult(promo, state, message) {
  const resultBox = $('#promo-checker-result');
  if (!resultBox) return;
  resultBox.classList.remove('hidden');

  const isExhausted = state === 'exhausted';
  const isExpired = state === 'expired';
  const isPaused = state === 'paused';
  const isUpcoming = state === 'upcoming';
  const isActive = state === 'active';

  const badgeCls = isActive
    ? 'bg-primary-50 text-primary-800 border-primary-200'
    : isUpcoming
      ? 'bg-secondary-50 text-secondary-900 border-secondary-200'
      : isExhausted
        ? 'bg-accent-100 text-accent-900 border-accent-300'
        : 'bg-accent-50 text-accent-800 border-accent-200';

  const badgeText = isActive ? 'Khả dụng & Dùng được ngay' : isUpcoming ? 'Sắp mở áp dụng' : isPaused ? 'Đang tạm dừng' : isExhausted ? 'Đã hết lượt dùng' : 'Đã hết hạn';

  const headline = promo.discountType === 'percent'
    ? `${promo.discountValue}%`
    : promo.discountType === 'gift'
      ? 'QUÀ TẶNG'
      : `${Math.round(promo.discountValue / 1000)}K`;

  const isSaved = st.saved.has(promo.code);

  resultBox.innerHTML = `
    <div class="rounded-lg border-2 border-primary-400/40 bg-gradient-to-r from-primary-50/50 via-white to-background-50 p-4 sm:p-5 shadow-sm transition-all duration-300">
      <div class="flex flex-wrap items-center justify-between gap-2 border-b border-background-200 pb-3">
        <div class="flex items-center gap-2">
          <span class="flex h-6 w-6 items-center justify-center rounded-full ${isExhausted ? 'bg-accent-500 text-white' : 'bg-primary-500 text-white'} text-xs">
            <i class="${isExhausted ? 'ri-error-warning-line' : 'ri-check-line'} font-bold"></i>
          </span>
          <span class="text-xs font-bold uppercase tracking-wider ${isExhausted ? 'text-accent-800' : 'text-primary-800'}">${isExhausted ? 'Mã ưu đãi đã hết lượt dùng' : 'Mã ưu đãi hợp lệ'}</span>
        </div>
        <span class="inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${badgeCls}">
          <span class="h-1.5 w-1.5 rounded-full ${isActive ? 'bg-primary-500' : isUpcoming ? 'bg-secondary-500' : 'bg-accent-500'}"></span>
          ${badgeText}
        </span>
      </div>

      <div class="mt-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div class="min-w-0 flex-1">
          <div class="flex flex-wrap items-center gap-3">
            <span class="rounded-md border-2 border-dashed ${isExhausted ? 'border-accent-400 bg-accent-50 text-accent-800' : 'border-primary-400 bg-white text-primary-700'} px-3 py-1 font-mono text-base sm:text-lg font-extrabold tracking-widest">
              ${esc(promo.code)}
            </span>
            <span class="font-heading text-xl sm:text-2xl font-extrabold text-foreground-950">
              ${headline} <span class="text-xs sm:text-sm font-semibold text-foreground-500">${promo.discountType === 'percent' ? 'giảm giá' : promo.discountType === 'gift' ? '' : 'đ'}</span>
            </span>
          </div>

          <h3 class="mt-2 font-heading text-base font-bold text-foreground-950">${esc(promo.title)}</h3>
          ${promo.description ? `<p class="mt-1 text-xs text-foreground-600 leading-relaxed">${esc(promo.description)}</p>` : ''}

          <div class="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-foreground-600">
            <span class="flex items-center gap-1.5"><i class="ri-calendar-line text-foreground-400"></i>HSD: <b>${promo.endDate ? promo.endDate.split('-').reverse().join('/') : 'Không thời hạn'}</b></span>
            ${promo.minOrder > 0 ? `<span class="flex items-center gap-1.5"><i class="ri-shopping-bag-3-line text-foreground-400"></i>Đơn tối thiểu: <b>${Number(promo.minOrder).toLocaleString('vi-VN')}đ</b></span>` : ''}
            ${promo.startTime && promo.endTime ? `<span class="flex items-center gap-1.5 text-accent-700 font-semibold"><i class="ri-time-line"></i>Giờ vàng: ${promo.startTime} - ${promo.endTime}</span>` : ''}
            ${promo.ownerName ? `<span class="flex items-center gap-1.5"><i class="ri-store-2-line text-foreground-400"></i>Áp dụng: ${esc(promo.ownerName)}</span>` : ''}
          </div>
          <p class="mt-2 text-xs font-semibold ${isExhausted ? 'text-accent-700' : 'text-primary-700'} flex items-center gap-1.5"><i class="${isExhausted ? 'ri-error-warning-line text-accent-600' : 'ri-checkbox-circle-line text-primary-600'}"></i>${esc(message || (isExhausted ? 'Mã ưu đãi này đã hết lượt sử dụng.' : 'Mã ưu đãi sẵn sàng áp dụng!'))}</p>
        </div>

        <div class="flex flex-wrap shrink-0 items-center gap-2 md:flex-col md:items-stretch">
          <button type="button" data-copy-code="${esc(promo.code)}" class="inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-md border border-primary-300 bg-white px-3.5 py-2 text-xs font-bold text-primary-700 transition-colors hover:bg-primary-50">
            <i class="ri-file-copy-line text-sm"></i><span>Sao chép mã</span>
          </button>
          <button type="button" data-save-voucher="${esc(promo.code)}" class="inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-md border ${isSaved ? 'border-primary-300 bg-primary-50 text-primary-800' : 'border-background-300 bg-white text-foreground-800 hover:border-primary-400'} px-3.5 py-2 text-xs font-semibold transition-colors">
            <i class="${isSaved ? 'ri-check-line' : 'ri-wallet-3-line'} text-sm"></i><span>${isSaved ? 'Đã lưu ví' : 'Lưu vào ví'}</span>
          </button>
          ${isActive ? `<a href="${url(`/dat-san?promo=${encodeURIComponent(promo.code)}`)}" class="inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-md bg-primary-500 px-3.5 py-2 text-xs font-bold text-white shadow-sm transition-colors hover:bg-primary-600">
            <i class="ri-calendar-check-line text-sm"></i><span>Đặt sân dùng ngay</span>
          </a>` : isExhausted ? `<span class="inline-flex cursor-not-allowed items-center justify-center gap-1.5 rounded-md bg-background-200 px-3.5 py-2 text-xs font-semibold text-foreground-500"><i class="ri-forbid-2-line"></i><span>Đã hết lượt dùng</span></span>` : ''}
        </div>
      </div>
    </div>
  `;
}

function renderCheckNotFound(code, customMessage) {
  const resultBox = $('#promo-checker-result');
  if (!resultBox) return;
  resultBox.classList.remove('hidden');

  resultBox.innerHTML = `
    <div class="rounded-lg border border-accent-300 bg-accent-50/80 p-4 sm:p-5 shadow-sm transition-all duration-300">
      <div class="flex items-start gap-3.5">
        <span class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent-100 text-accent-700">
          <i class="ri-close-circle-line text-2xl" aria-hidden="true"></i>
        </span>
        <div class="min-w-0 flex-1">
          <h3 class="font-heading text-sm sm:text-base font-bold text-accent-950">
            Mã ưu đãi không tồn tại hoặc đã được sử dụng!
          </h3>
          <p class="mt-1 text-xs leading-relaxed text-accent-800 sm:text-sm">
            ${customMessage ? esc(customMessage) : `Mã ưu đãi không tồn tại hoặc đã được sử dụng.`} Vui lòng kiểm tra lại chính xác các ký tự của mã hoặc tham khảo danh sách các mã đang hoạt động bên dưới.
          </p>
          <div class="mt-3.5 flex flex-wrap items-center gap-2">
            <button type="button" id="promo-retype-btn" class="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-accent-300 bg-white px-3 py-1.5 text-xs font-semibold text-accent-900 transition-colors hover:bg-accent-100">
              <i class="ri-edit-line"></i>Nhập lại mã khác
            </button>
            <a href="#promo-filters" class="inline-flex items-center gap-1.5 rounded-md bg-accent-500 px-3.5 py-1.5 text-xs font-bold text-background-950 transition-colors hover:bg-accent-600">
              <i class="ri-list-check-2"></i>Xem các mã đang chạy
            </a>
            <a href="#vong-quay" class="inline-flex items-center gap-1.5 rounded-md border border-background-300 bg-white px-3.5 py-1.5 text-xs font-semibold text-foreground-800 transition-colors hover:border-primary-400">
              <i class="ri-gift-line"></i>Quay nhận voucher miễn phí
            </a>
          </div>
        </div>
      </div>
    </div>
  `;

  $('#promo-retype-btn')?.addEventListener('click', () => {
    const input = $('#promo-input-code');
    if (input) {
      input.value = '';
      input.focus();
    }
    resultBox.classList.add('hidden');
    resultBox.innerHTML = '';
  });
}

function initPromoChecker() {
  const form = $('#promo-checker-form');
  const input = $('#promo-input-code');
  const clearBtn = $('#promo-clear-input');
  const checkBtn = $('#promo-check-btn');
  const resultBox = $('#promo-checker-result');
  if (!form || !input || !checkBtn || !resultBox) return;

  const toggleClearBtn = () => {
    if (clearBtn) {
      clearBtn.classList.toggle('hidden', !input.value.trim());
    }
  };

  input.addEventListener('input', () => {
    toggleClearBtn();
  });

  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      input.value = '';
      toggleClearBtn();
      resultBox.classList.add('hidden');
      resultBox.innerHTML = '';
      lastCheckedPromo = null;
      input.focus();
    });
  }

  const performCheck = async (rawCode) => {
    const code = (rawCode || input.value).trim().toUpperCase();
    if (!code) {
      toast('Vui lòng nhập mã ưu đãi cần kiểm tra.', 'info');
      input.focus();
      return;
    }
    input.value = code;
    toggleClearBtn();

    const origBtnHtml = checkBtn.innerHTML;
    checkBtn.disabled = true;
    checkBtn.innerHTML = '<i class="ri-loader-4-line animate-spin text-sm"></i><span>Đang kiểm tra...</span>';

    try {
      const data = await api('booking', 'lookup_promo', { code });
      if (data && data.found && data.promotion) {
        lastCheckedPromo = data.promotion;
        renderCheckResult(data.promotion, data.state, data.message);
      } else {
        lastCheckedPromo = null;
        renderCheckNotFound(code, 'Mã ưu đãi không có hoặc không tồn tại trên hệ thống.');
      }
    } catch (err) {
      lastCheckedPromo = null;
      renderCheckNotFound(code, err.message || 'Mã ưu đãi không có hoặc không tồn tại trên hệ thống.');
    } finally {
      checkBtn.disabled = false;
      checkBtn.innerHTML = origBtnHtml;
      resultBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  };

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    performCheck();
  });

  // Tự động kiểm tra nếu có tham số trên URL (?promo=... hoặc ?code=...)
  try {
    const urlParams = new URLSearchParams(window.location.search);
    const queryCode = urlParams.get('promo') || urlParams.get('code');
    if (queryCode) {
      input.value = queryCode;
      toggleClearBtn();
      performCheck(queryCode);
    }
  } catch (e) {}
}

$('#promo-search').addEventListener('input', (e) => {
  st.keyword = e.target.value;
  render();
});
render();
initPromoWheel();
initPromoChecker();
