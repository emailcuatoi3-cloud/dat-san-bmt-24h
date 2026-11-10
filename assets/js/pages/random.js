/** Ngẫu nhiên: chia đội (Fisher–Yates), chọn sân còn trống ngẫu nhiên, vòng quay ưu đãi. */
import { $, PAGE, esc, url, formatVnd } from '../core/ui.js';

const shuffle = (items) => {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

// ===================== CHIA ĐỘI =====================
const split = { mode: 'football', count: 0 };
const names = () => $('#team-names').value.split(/[\n,;]+/).map((s) => s.trim()).filter(Boolean);

function paintSplit() {
  $('#player-count').textContent = `${names().length} người trong danh sách`;
  $('#split-modes').innerHTML = [['football', 'Chia 2 đội bóng'], ['badminton', 'Ghép đôi cầu lông']]
    .map(([v, l]) => `<button type="button" data-mode="${v}" class="cursor-pointer whitespace-nowrap rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors ${split.mode === v ? 'bg-primary-500 text-white' : 'text-foreground-600 hover:text-foreground-950'}">${l}</button>`)
    .join('');
  $('#split-btn span').textContent = split.count ? 'Chia lại' : 'Chia đội';
  $('#split-count').textContent = split.count ? `Đã chia ${split.count} lần trong phiên này` : '';
}
function setSplitError(msg) {
  const el = $('#split-error');
  el.innerHTML = msg ? `<i class="ri-error-warning-line" aria-hidden="true"></i>${esc(msg)}` : '';
  el.classList.toggle('hidden', !msg);
  el.classList.toggle('flex', Boolean(msg));
}
$('#split-modes').addEventListener('click', (e) => {
  const b = e.target.closest('[data-mode]');
  if (!b) return;
  split.mode = b.dataset.mode;
  $('#split-result').innerHTML = '';
  setSplitError('');
  paintSplit();
});
$('#team-names').addEventListener('input', paintSplit);
$('#split-btn').addEventListener('click', () => {
  const players = names();
  if (players.length < 2) {
    $('#split-result').innerHTML = '';
    return setSplitError('Bạn cần nhập ít nhất 2 người để chia đội.');
  }
  setSplitError('');
  const mixed = shuffle(players);
  if (split.mode === 'football') {
    const teams = [[], []];
    mixed.forEach((p, i) => teams[i % 2].push(p));
    const tones = [['Đội A', 'bg-primary-500 text-white', 'border-primary-300 bg-primary-50'], ['Đội B', 'bg-accent-500 text-background-950', 'border-accent-300 bg-accent-50']];
    $('#split-result').innerHTML = `<div class="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">${teams
      .map((t, i) => `<div class="rounded-lg border p-4 ${tones[i][2]}"><div class="flex items-center justify-between"><span class="rounded-md px-2.5 py-1 text-xs font-bold ${tones[i][1]}">${tones[i][0]}</span><span class="text-xs font-semibold text-foreground-800">${t.length} người</span></div><ul class="mt-3 space-y-1.5">${t.map((p) => `<li class="flex items-center gap-2 text-sm text-foreground-900"><i class="ri-user-3-line text-foreground-500" aria-hidden="true"></i>${esc(p)}</li>`).join('')}</ul></div>`)
      .join('')}</div>`;
  } else {
    const pairs = [];
    for (let i = 0; i < mixed.length; i += 2) pairs.push([mixed[i], mixed[i + 1] || 'Chờ ghép']);
    $('#split-result').innerHTML = `<div class="mt-5 grid grid-cols-1 gap-2.5 sm:grid-cols-2">${pairs
      .map((p, i) => `<div class="flex items-center gap-2.5 rounded-md border border-background-200 bg-background-50 px-3.5 py-2.5"><span class="flex h-6 w-6 items-center justify-center rounded-full bg-secondary-100 text-[11px] font-bold text-secondary-900">${i + 1}</span><span class="text-sm text-foreground-900">${esc(p[0])} <span class="text-foreground-500">&amp;</span> ${esc(p[1])}</span></div>`)
      .join('')}</div>`;
  }
  split.count += 1;
  paintSplit();
});
$('#split-clear').addEventListener('click', () => {
  $('#split-result').innerHTML = '';
  setSplitError('');
  split.count = 0;
  paintSplit();
});
paintSplit();

// ===================== CHỌN SÂN GIÚP =====================
const candidates = () => {
  const sport = $('#random-sport').value;
  const area = $('#random-area').value;
  const time = $('#random-time').value;
  return (PAGE.courts || []).filter(
    (c) => (sport === 'all' || c.sport === sport) && (area === 'all' || c.area === area) && !((PAGE.taken || {})[c.id] || []).includes(time),
  );
};
const paintCount = () => ($('#pick-count').textContent = `${candidates().length} sân còn trống lúc ${$('#random-time').value}`);
['#random-sport', '#random-area', '#random-time'].forEach((s) => $(s).addEventListener('change', paintCount));
paintCount();
$('#pick-btn').addEventListener('click', () => {
  const list = candidates();
  const box = $('#pick-result');
  if (!list.length) {
    box.innerHTML = `<p class="mt-3 flex items-start gap-1.5 rounded-md border border-accent-200 bg-accent-50 px-3 py-2 text-xs font-medium text-accent-900"><i class="ri-error-warning-line mt-0.5" aria-hidden="true"></i>Không còn sân phù hợp với lựa chọn này. Bạn thử đổi khung giờ hoặc khu vực khác nhé.</p>`;
    return;
  }
  const btn = $('#pick-btn');
  btn.disabled = true;
  btn.innerHTML = '<i class="ri-loader-4-line animate-spin" aria-hidden="true"></i><span>Đang chọn...</span>';
  box.innerHTML = `<div class="mt-4 flex items-center gap-2 rounded-md border border-dashed border-background-300 bg-background-50 px-3.5 py-4"><i class="ri-dice-line animate-spin text-xl text-primary-600" aria-hidden="true"></i><p class="text-sm text-foreground-600">Đang xáo trộn danh sách sân còn trống...</p></div>`;
  setTimeout(() => {
    const c = list[Math.floor(Math.random() * list.length)];
    const time = $('#random-time').value;
    box.innerHTML = `<div class="mt-4 overflow-hidden rounded-lg border border-primary-300 bg-background-50 animate-fade-up"><div class="grid grid-cols-1 sm:grid-cols-[200px_1fr]">
      <div class="h-[150px] w-full overflow-hidden sm:h-full"><img src="${esc(c.images[0])}" alt="${esc(c.name)} được chọn ngẫu nhiên" class="h-full w-full object-cover object-top"></div>
      <div class="p-4"><div class="flex flex-wrap items-center gap-2"><span class="inline-flex items-center gap-1 rounded-full bg-primary-500 px-2.5 py-1 text-[11px] font-bold text-white"><i class="ri-shuffle-line" aria-hidden="true"></i>Sân bạn được chọn</span><span class="rounded-full bg-secondary-50 px-2.5 py-1 text-[11px] font-semibold text-secondary-900">P. ${esc(c.area)}</span></div>
        <h3 class="mt-2 font-heading text-base font-bold text-foreground-950">${esc(c.name)}</h3>
        <p class="mt-1 flex items-start gap-1.5 text-xs text-foreground-600"><i class="ri-map-pin-line mt-0.5" aria-hidden="true"></i>${esc(c.address)}</p>
        <p class="mt-2 text-sm text-foreground-700"><span class="font-heading text-base font-bold text-primary-600">${formatVnd(c.pricePerHour)}</span><span class="text-xs text-foreground-500">/giờ • còn trống lúc ${time}</span></p>
        <div class="mt-3 flex flex-wrap gap-2"><a href="${url(`/dat-san/${c.slug}?slot=${time}`)}" class="inline-flex items-center gap-1.5 whitespace-nowrap rounded-md bg-primary-500 px-3.5 py-2 text-xs font-bold text-white transition-colors hover:bg-primary-600"><i class="ri-calendar-check-line" aria-hidden="true"></i>Đặt sân này</a><a href="${url(`/san/${c.slug}`)}" class="inline-flex items-center gap-1.5 whitespace-nowrap rounded-md border border-background-300 bg-background-200 px-3.5 py-2 text-xs font-semibold text-foreground-950 transition-colors hover:border-primary-400 hover:text-primary-800">Xem chi tiết</a></div>
      </div></div></div>`;
    btn.disabled = false;
    btn.innerHTML = '<i class="ri-dice-line" aria-hidden="true"></i><span>Chọn sân khác</span>';
  }, 900);
});

// ===================== VÒNG QUAY =====================
const prizes = [
  ['Giảm 5%', '-5%', 'Áp dụng cho lần đặt kế tiếp'],
  ['Tặng 1 nước', '+1 nước', 'Nhận tại căng tin của sân'],
  ['Giảm 10%', '-10%', 'Áp dụng cho lần đặt kế tiếp'],
  ['Tặng 30 phút', '+30 phút', 'Cộng vào khung giờ đã đặt'],
  ['Giảm 20%', '-20%', 'Áp dụng cho lần đặt kế tiếp'],
  ['Chúc may mắn', 'May mắn', 'Thử lại ở lượt đặt sân sau'],
];
const SECTOR = 360 / prizes.length;
const wheel = $('#wheel');
let rotation = 0;
let spins = 0;
function paintWheel() {
  wheel.style.transform = `rotate(${rotation}deg)`;
  wheel.innerHTML = prizes
    .map((p, i) => {
      const rad = (i * SECTOR * Math.PI) / 180;
      return `<span class="prize-label absolute whitespace-nowrap text-[11px] font-extrabold leading-none" style="left:${50 + 31 * Math.sin(rad)}%;top:${50 - 31 * Math.cos(rad)}%;transform:translate(-50%,-50%) rotate(${-rotation}deg)">${p[1]}</span>`;
    })
    .join('');
}
function paintResult(prize) {
  $('#spin-result').innerHTML = prize
    ? `<div class="rounded-lg border border-primary-300 bg-primary-50 p-4 animate-fade-up"><p class="text-xs font-semibold uppercase tracking-wide text-primary-800">Kết quả lượt quay</p><p class="mt-1 font-heading text-xl font-extrabold text-primary-900">${prize[0]}</p><p class="mt-1 text-sm text-primary-800">${prize[2]}</p><p class="mt-3 flex items-start gap-1.5 rounded-md bg-background-100 px-2.5 py-2 text-[11px] leading-relaxed text-foreground-600"><i class="ri-information-line mt-0.5" aria-hidden="true"></i>Ưu đãi có hiệu lực 7 ngày. Bạn đọc mã ưu đãi cho nhân viên tại sân khi thanh toán.</p></div>`
    : `<div class="rounded-lg border border-dashed border-background-300 bg-background-50 p-4"><p class="text-sm font-semibold text-foreground-900">${spins >= 1 ? 'Bạn đã dùng lượt quay của phiên này' : 'Bấm nút QUAY ở giữa vòng tròn để thử vận may'}</p><p class="mt-1 text-xs leading-relaxed text-foreground-500">Mỗi đơn đặt sân chỉ được quay một lần. Kết quả hiển thị ngay sau khi vòng quay dừng lại.</p></div>`;
}
$('#prize-list').innerHTML = prizes.map((p) => `<li class="flex items-center gap-2 rounded-md border border-background-200 bg-background-50 px-2.5 py-2 text-xs text-foreground-700"><i class="ri-checkbox-blank-circle-fill text-[8px] text-primary-500" aria-hidden="true"></i>${p[0]}</li>`).join('');
$('#spin-btn').addEventListener('click', () => {
  if (spins >= 1) return;
  const btn = $('#spin-btn');
  btn.disabled = true;
  const index = Math.floor(Math.random() * prizes.length);
  rotation = rotation - (rotation % 360) + 360 * 5 + (360 - (index * SECTOR + SECTOR / 2));
  spins += 1;
  wheel.classList.add('shadow-lg');
  paintWheel();
  paintResult(null);
  setTimeout(() => {
    wheel.classList.remove('shadow-lg');
    paintResult(prizes[index]);
  }, 4300);
});
paintWheel();
paintResult(null);
