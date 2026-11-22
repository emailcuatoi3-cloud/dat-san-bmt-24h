/** Ngẫu nhiên: chia đội (Fisher–Yates), chọn sân còn trống ngẫu nhiên, vòng quay ưu đãi. */
import { $, APP, PAGE, esc, url, formatVnd } from '../core/ui.js';

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

// ===================== GHÉP ĐỘI & BẮT CẶP ĐỐI THỦ NGẪU NHIÊN (THỬ NGHIỆM) =====================
const DEFAULT_OPPONENTS = [
  { id: 'bmt-01', name: 'FC Ban Mê United', sport: 'football', playerCount: 7, area: 'Tân Lợi', level: 'normal', contact: 'Tuấn (0914 234 567)', style: 'Kèo nước ngọt, đá nhiệt tình' },
  { id: 'bmt-02', name: 'FC Ea Tam Phố Núi', sport: 'football', playerCount: 5, area: 'Ea Tam', level: 'fun', contact: 'Hùng (0988 345 678)', style: 'Thể lực vui vẻ, sau trận giao lưu' },
  { id: 'bmt-03', name: 'CLB Cầu Lông Đắk Lắk Trẻ', sport: 'badminton', playerCount: 2, area: 'Thắng Lợi', level: 'normal', contact: 'Trang (0905 123 789)', style: 'Đánh đôi cọ xát kinh nghiệm' },
  { id: 'bmt-04', name: 'FC Buôn Ma Thuột Legend', sport: 'football', playerCount: 7, area: 'Tự An', level: 'hard', contact: 'Bảo (0935 456 789)', style: 'Cọ xát nhiệt huyết, kỹ thuật tốt' },
  { id: 'bmt-05', name: 'Cầu Lông Kpă Klơng', sport: 'badminton', playerCount: 4, area: 'Tân Lập', level: 'fun', contact: 'Huy (0979 678 901)', style: 'Đánh đôi phong trào, vui là chính' },
  { id: 'bmt-06', name: 'FC Cao Nguyên Xanh', sport: 'football', playerCount: 5, area: 'Tân An', level: 'fun', contact: 'Long (0918 890 123)', style: 'Đội văn phòng, thể thao cuối ngày' },
  { id: 'bmt-07', name: 'FC Y Jut Brothers', sport: 'football', playerCount: 7, area: 'Thống Nhất', level: 'hard', contact: 'Thành (0947 567 890)', style: 'Bán chuyên, chạy nhiều, đá chắc' },
  { id: 'bmt-08', name: 'Cầu Lông Cư M\'gar - BMT', sport: 'badminton', playerCount: 2, area: 'Tân Tiến', level: 'normal', contact: 'Đức (0962 345 012)', style: 'Đôi nam nữ giao lưu cuối tuần' },
];

const LOBBY_STORAGE_KEY = 'bmt24h_match_custom_teams';
function getCustomLobbyTeams() {
  try {
    const raw = localStorage.getItem(LOBBY_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}
function saveCustomLobbyTeam(team) {
  try {
    const existing = getCustomLobbyTeams().filter((t) => t.id !== team.id);
    existing.unshift(team);
    localStorage.setItem(LOBBY_STORAGE_KEY, JSON.stringify(existing.slice(0, 10)));
  } catch {}
}

const levelLabels = {
  fun: 'Phong trào vui vẻ',
  normal: 'Trung bình khá',
  hard: 'Bán chuyên nhiệt huyết',
};
const sportLabels = {
  football: 'Bóng đá',
  badminton: 'Cầu lông',
};

function getAllOpponents() {
  const custom = getCustomLobbyTeams();
  return [...custom, ...DEFAULT_OPPONENTS];
}

function renderLobby() {
  const list = getAllOpponents();
  const poolCount = $('#match-pool-count');
  if (poolCount) poolCount.textContent = list.length;
  const container = $('#match-lobby-list');
  if (!container) return;

  container.innerHTML = list
    .slice(0, 8)
    .map(
      (t) => `
    <div class="flex flex-col justify-between rounded-lg border border-background-200 bg-background-50 p-3 transition-shadow hover:shadow-sm">
      <div>
        <div class="flex items-center justify-between gap-1">
          <span class="inline-flex items-center gap-1 rounded bg-primary-50 px-2 py-0.5 text-[10px] font-bold text-primary-700">
            ${sportLabels[t.sport] || 'Thể thao'} • ${t.playerCount} người
          </span>
          <span class="text-[10px] text-foreground-400">P. ${esc(t.area)}</span>
        </div>
        <h4 class="mt-2 font-heading text-sm font-bold text-foreground-950">${esc(t.name)}</h4>
        <p class="mt-0.5 text-xs text-foreground-600 line-clamp-1">${esc(t.style)}</p>
        <p class="mt-1 text-[11px] text-foreground-500"><i class="ri-phone-line mr-1 text-primary-600"></i>${esc(t.contact)}</p>
      </div>
      <button type="button" data-match-direct="${esc(t.id)}" class="mt-3 flex w-full cursor-pointer items-center justify-center gap-1 rounded-md border border-primary-300 bg-white py-1.5 text-xs font-bold text-primary-700 transition-colors hover:bg-primary-50">
        <i class="ri-sword-line"></i>Ghép ngay
      </button>
    </div>
  `,
    )
    .join('');
}

function renderMatchResult(myTeam, oppTeam) {
  const box = $('#match-result');
  if (!box) return;
  box.classList.remove('hidden');

  // Gợi ý sân trung gian
  const courts = (PAGE.courts || []).filter((c) => c.sport === myTeam.sport);
  const randomCourt = courts.length ? courts[Math.floor(Math.random() * courts.length)] : null;

  box.innerHTML = `
    <div class="rounded-xl border-2 border-primary-500/40 bg-gradient-to-br from-primary-50/60 via-background-50 to-white p-5 shadow-sm transition-all duration-300 animate-fade-up">
      <div class="flex flex-wrap items-center justify-between gap-2 border-b border-background-200 pb-3">
        <div class="flex items-center gap-2">
          <span class="flex h-7 w-7 items-center justify-center rounded-full bg-primary-500 text-white font-bold text-xs">
            <i class="ri-check-double-line text-sm"></i>
          </span>
          <span class="text-xs font-bold uppercase tracking-wider text-primary-800">Bắt cặp thành công (Match Found!)</span>
        </div>
        <span class="rounded-full bg-accent-50 px-2.5 py-0.5 text-[11px] font-bold text-accent-800 border border-accent-200">
          Kèo giao lưu ngẫu nhiên
        </span>
      </div>

      <!-- Khung thi đấu 2 đội -->
      <div class="mt-5 grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] items-center gap-4">
        <!-- Đội của bạn -->
        <div class="rounded-lg border border-primary-300 bg-white p-4 shadow-sm">
          <div class="flex items-center justify-between gap-2">
            <span class="rounded bg-primary-500 px-2 py-0.5 text-[10px] font-bold uppercase text-white">Đội của bạn</span>
            <span class="text-xs font-semibold text-foreground-600">${myTeam.playerCount} người</span>
          </div>
          <h3 class="mt-2.5 font-heading text-base font-extrabold text-foreground-950">${esc(myTeam.name)}</h3>
          <p class="mt-1 text-xs text-foreground-600">${sportLabels[myTeam.sport] || 'Thể thao'} • ${levelLabels[myTeam.level] || 'Giao lưu'}</p>
          <div class="mt-3 flex items-center gap-1.5 text-xs text-primary-700 font-medium">
            <i class="ri-shield-user-line"></i><span>Sẵn sàng ra sân</span>
          </div>
        </div>

        <!-- Biểu tượng VS -->
        <div class="flex flex-col items-center justify-center">
          <span class="flex h-12 w-12 items-center justify-center rounded-full bg-foreground-950 text-accent-400 font-heading text-lg font-black shadow-md border-2 border-accent-400">
            VS
          </span>
          <span class="mt-1 text-[10px] font-bold uppercase tracking-widest text-foreground-500">Đối đầu</span>
        </div>

        <!-- Đội đối thủ được ghép ngẫu nhiên -->
        <div class="rounded-lg border border-accent-300 bg-white p-4 shadow-sm">
          <div class="flex items-center justify-between gap-2">
            <span class="rounded bg-accent-500 px-2 py-0.5 text-[10px] font-bold uppercase text-background-950">Đối thủ được ghép</span>
            <span class="text-xs font-semibold text-foreground-600">${oppTeam.playerCount} người</span>
          </div>
          <h3 class="mt-2.5 font-heading text-base font-extrabold text-foreground-950">${esc(oppTeam.name)}</h3>
          <p class="mt-1 text-xs text-foreground-600">Khu vực: P. ${esc(oppTeam.area || 'BMT')} • ${esc(oppTeam.style)}</p>
          <div class="mt-3 flex items-center justify-between gap-2">
            <span class="text-xs font-semibold text-accent-800"><i class="ri-phone-line mr-1"></i>${esc(oppTeam.contact)}</span>
            <a href="tel:${esc((oppTeam.contact || '').replace(/[^\d+]/g, ''))}" class="rounded bg-accent-100 px-2.5 py-1 text-[11px] font-bold text-accent-800 hover:bg-accent-200 transition-colors">Gọi ngay</a>
          </div>
        </div>
      </div>

      <!-- Gợi ý sân trung gian & Đặt sân -->
      ${
        randomCourt
          ? `
      <div class="mt-5 rounded-lg border border-background-200 bg-white p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div class="flex items-center gap-3 min-w-0">
          <img src="${esc(randomCourt.images[0])}" alt="${esc(randomCourt.name)}" class="h-12 w-16 rounded object-cover shrink-0">
          <div class="min-w-0">
            <p class="text-[11px] font-bold uppercase tracking-wide text-primary-700">Gợi ý sân trung gian lý tưởng</p>
            <h4 class="truncate font-heading text-sm font-bold text-foreground-950">${esc(randomCourt.name)}</h4>
            <p class="text-xs text-foreground-500">${esc(randomCourt.address)}</p>
          </div>
        </div>
        <div class="flex shrink-0 items-center gap-2">
          <a href="${url(`/dat-san/${randomCourt.slug}`)}" class="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-md bg-primary-500 px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-primary-600">
            <i class="ri-calendar-check-line"></i>Đặt sân này ngay
          </a>
        </div>
      </div>
      `
          : ''
      }

      <div class="mt-4 flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-background-200">
        <p class="text-xs text-foreground-500">Hai đội có thể gọi điện hoặc chat Zalo để thống nhất giờ đá & chia tiền sân.</p>
        <button type="button" id="match-again-btn" class="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-background-300 bg-white px-3.5 py-1.5 text-xs font-semibold text-foreground-800 transition-colors hover:border-primary-400 hover:text-primary-700">
          <i class="ri-shuffle-line"></i>Ghép đối thủ khác
        </button>
      </div>
    </div>
  `;

  $('#match-again-btn')?.addEventListener('click', () => {
    doRandomMatch(myTeam);
  });
}

function doRandomMatch(myTeam) {
  const box = $('#match-result');
  const btn = $('#match-btn');
  if (!box || !btn) return;

  btn.disabled = true;
  btn.innerHTML = '<i class="ri-loader-4-line animate-spin text-sm"></i><span>Đang tìm đối thủ...</span>';

  box.classList.remove('hidden');
  box.innerHTML = `
    <div class="rounded-lg border border-dashed border-primary-300 bg-primary-50/50 p-6 text-center animate-fade-up">
      <div class="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary-100 text-primary-600">
        <i class="ri-radar-line animate-spin text-2xl"></i>
      </div>
      <h3 class="mt-3 font-heading text-base font-bold text-foreground-950">Đang quét tìm kiếm đối thủ phù hợp...</h3>
      <p class="mt-1 text-xs text-foreground-600">Hệ thống đang đối chiếu môn thi đấu, số người (${myTeam.playerCount} người) và khu vực Buôn Ma Thuột.</p>
    </div>
  `;

  setTimeout(() => {
    const list = getAllOpponents().filter((t) => t.name.toLowerCase() !== myTeam.name.toLowerCase());
    // Ưu tiên đội cùng môn
    let pool = list.filter((t) => t.sport === myTeam.sport);
    if (!pool.length) pool = list;

    // Xáo trộn ngẫu nhiên
    const shuffled = shuffle(pool);
    const opponent = shuffled[0] || {
      id: 'opp-random',
      name: 'FC Cao Nguyên BMT',
      sport: myTeam.sport,
      playerCount: myTeam.playerCount,
      area: 'Buôn Ma Thuột',
      contact: 'Đại diện (0905 999 888)',
      style: 'Giao lưu nhiệt tình, rèn sức khỏe',
    };

    renderMatchResult(myTeam, opponent);
    btn.disabled = false;
    btn.innerHTML = '<i class="ri-sword-line" aria-hidden="true"></i><span>Bắt cặp ngẫu nhiên ngay</span>';
    box.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, 800);
}

function initMatchmaking() {
  const form = $('#match-form');
  const queueBtn = $('#match-queue-btn');
  if (!form) return;

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = $('#match-team-name').value.trim();
    if (name.length < 2) {
      alert('Vui lòng nhập tên đội của bạn (ít nhất 2 ký tự).');
      $('#match-team-name').focus();
      return;
    }

    const myTeam = {
      id: 'my-' + Date.now(),
      name,
      playerCount: Number($('#match-player-count').value) || 7,
      sport: $('#match-sport').value,
      level: $('#match-level').value,
    };

    doRandomMatch(myTeam);
  });

  queueBtn?.addEventListener('click', () => {
    const name = $('#match-team-name').value.trim();
    if (name.length < 2) {
      alert('Vui lòng nhập tên đội của bạn trước khi đưa vào hàng chờ.');
      $('#match-team-name').focus();
      return;
    }

    const newTeam = {
      id: 'user-' + Date.now(),
      name,
      sport: $('#match-sport').value,
      playerCount: Number($('#match-player-count').value) || 7,
      area: 'Tự do BMT',
      level: $('#match-level').value,
      contact: 'Chờ liên hệ tại sân',
      style: 'Vừa đăng ký hàng chờ',
    };

    saveCustomLobbyTeam(newTeam);
    renderLobby();
    alert(`Đã đưa đội "${name}" vào hàng chờ tìm đối thủ giao lưu thành công!`);
  });

  document.addEventListener('click', (e) => {
    const directBtn = e.target.closest('[data-match-direct]');
    if (!directBtn) return;
    const oppId = directBtn.dataset.matchDirect;
    const opp = getAllOpponents().find((t) => t.id === oppId);
    if (!opp) return;

    let myName = $('#match-team-name').value.trim() || 'Đội của bạn';
    const myTeam = {
      id: 'my-' + Date.now(),
      name: myName,
      playerCount: opp.playerCount,
      sport: opp.sport,
      level: opp.level,
    };

    renderMatchResult(myTeam, opp);
    $('#match-result')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  });

  renderLobby();
}

initMatchmaking();
