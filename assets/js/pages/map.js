/** Bản đồ sân: lọc theo môn, tìm kiếm, định vị GPS, tính khoảng cách & chỉ đường Google Maps. */
import { $, PAGE, esc, url, formatVnd, toast } from '../core/ui.js';

const courts = PAGE.courts || [];
const TONIGHT = ['17:00', '18:00', '19:00', '20:00', '21:00'];
const st = {
  sport: 'all',
  keyword: '',
  selectedId: courts[0] && courts[0].id,
  userLocation: null, // { lat, lng }
};

// Tọa độ đại diện các phường/xã tại Buôn Ma Thuột
const BMT_COORDINATES = {
  'Tân Lợi': { lat: 12.696, lng: 108.0538 },
  'Tân An': { lat: 12.7125, lng: 108.0682 },
  'Thắng Lợi': { lat: 12.6845, lng: 108.0435 },
  'Tân Thành': { lat: 12.678, lng: 108.049 },
  'Ea Tam': { lat: 12.653, lng: 108.032 },
  'Hòa Thắng': { lat: 12.668, lng: 108.105 },
  'Khánh Xuân': { lat: 12.628, lng: 108.012 },
  'Thành Công': { lat: 12.689, lng: 108.037 },
  'Thống Nhất': { lat: 12.686, lng: 108.048 },
  'Tự An': { lat: 12.675, lng: 108.055 },
  default: { lat: 12.683, lng: 108.045 },
};

function getCourtCoordinates(c) {
  return BMT_COORDINATES[c.area] || BMT_COORDINATES.default;
}

function deg2rad(deg) {
  return deg * (Math.PI / 180);
}

function calcDistanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

const freeTonight = (c) => TONIGHT.filter((s) => !((PAGE.taken || {})[c.id] || []).includes(s));

function render() {
  const q = st.keyword.trim().toLowerCase();
  let list = courts.filter(
    (c) => (st.sport === 'all' || c.sport === st.sport) && (!q || `${c.name} ${c.area} ${c.address}`.toLowerCase().includes(q))
  );

  // Tính khoảng cách nếu có GPS
  if (st.userLocation) {
    list = list.map((c) => {
      const coord = getCourtCoordinates(c);
      const dist = calcDistanceKm(st.userLocation.lat, st.userLocation.lng, coord.lat, coord.lng);
      return { ...c, distanceKm: dist };
    });
    list.sort((a, b) => a.distanceKm - b.distanceKm);
  }

  const sel = list.find((c) => c.id === st.selectedId) || list[0] || courts[0];
  if (!sel) return;
  const free = freeTonight(sel);

  $('#map-sports').innerHTML = [
    ['all', 'Tất cả'],
    ['football', 'Bóng đá'],
    ['badminton', 'Cầu lông'],
  ]
    .map(
      ([v, l]) =>
        `<button type="button" data-sport="${v}" class="cursor-pointer whitespace-nowrap rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors ${st.sport === v ? 'bg-primary-500 text-white' : 'text-foreground-600 hover:text-foreground-950'}">${l}</button>`
    )
    .join('');

  const dirUrl = st.userLocation
    ? `https://www.google.com/maps/dir/?api=1&origin=${st.userLocation.lat},${st.userLocation.lng}&destination=${encodeURIComponent(sel.mapQuery || sel.address)}`
    : `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(sel.mapQuery || sel.address)}`;

  const frame = $('#map-main iframe');
  if (!frame || frame.dataset.id !== sel.id) {
    $('#map-main').innerHTML = `<div class="relative"><iframe data-id="${sel.id}" title="Bản đồ vị trí ${esc(sel.name)}" src="https://www.google.com/maps?q=${encodeURIComponent(sel.mapQuery || sel.address)}&z=15&output=embed" class="h-[340px] w-full border-0 md:h-[500px]" referrerpolicy="no-referrer-when-downgrade" allowfullscreen></iframe>
      <span class="pointer-events-none absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-semibold backdrop-blur-sm photo-chip"><i class="ri-map-pin-line text-primary-400" aria-hidden="true"></i>Đang xem: ${esc(sel.name)}</span></div>
      <div class="flex flex-col gap-4 border-t border-background-200 p-4 md:flex-row md:items-center md:justify-between md:p-5">
        <div class="min-w-0">
          <div class="flex flex-wrap items-center gap-2">
            <h2 class="font-heading text-lg font-bold leading-snug text-foreground-950">${esc(sel.name)}</h2>
            <span class="rounded-full bg-primary-50 px-2 py-0.5 text-[11px] font-semibold text-primary-700">${esc(sel.sportLabel)}</span>
            ${sel.distanceKm ? `<span class="inline-flex items-center gap-1 rounded-full bg-accent-50 px-2.5 py-0.5 text-[11px] font-bold text-accent-800 border border-accent-200"><i class="ri-navigation-line"></i>Cách bạn ${sel.distanceKm.toFixed(1)} km</span>` : ''}
          </div>
          <p class="mt-1.5 flex items-start gap-1.5 text-xs text-foreground-600"><i class="ri-map-pin-line mt-0.5 text-foreground-400" aria-hidden="true"></i>${esc(sel.address)}</p>
          <p class="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-foreground-500">
            <span class="flex items-center gap-1"><i class="ri-time-line" aria-hidden="true"></i>${sel.openTime} - ${sel.closeTime}</span>
            <span class="flex items-center gap-1"><i class="ri-calendar-check-line text-primary-600" aria-hidden="true"></i>${free.length ? `Còn ${free.length} khung giờ tối nay` : 'Tối nay đã kín'}</span>
            <span class="flex items-center gap-1"><i class="ri-money-dollar-circle-line text-primary-600" aria-hidden="true"></i>${formatVnd(sel.pricePerHour)}/giờ</span>
          </p>
        </div>
        <div class="flex flex-wrap gap-2">
          <a href="${dirUrl}" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-1.5 whitespace-nowrap rounded-md border border-primary-300 bg-primary-50 px-3.5 py-2 text-xs font-bold text-primary-800 transition-colors hover:bg-primary-100 shadow-sm"><i class="ri-navigation-line text-sm" aria-hidden="true"></i>Chỉ đường Google Maps</a>
          <a href="${url(`/san/${sel.slug}`)}" class="inline-flex items-center gap-1.5 whitespace-nowrap rounded-md border border-background-300 bg-background-100 px-3.5 py-2 text-xs font-semibold text-foreground-900 transition-colors hover:border-primary-400 hover:text-primary-800"><i class="ri-information-line" aria-hidden="true"></i>Chi tiết sân</a>
          <a href="${url(`/dat-san/${sel.slug}`)}" class="inline-flex items-center gap-1.5 whitespace-nowrap rounded-md bg-primary-500 px-3.5 py-2 text-xs font-bold text-white transition-colors hover:bg-primary-600"><i class="ri-calendar-check-line" aria-hidden="true"></i>Đặt sân</a>
        </div>
      </div>`;
  }

  $('#map-count').textContent = `${list.length} sân ${st.userLocation ? '(Gần nhất)' : ''}`;
  $('#map-list').innerHTML = list.length
    ? list
        .map((c) => {
          const active = c.id === sel.id;
          const f = freeTonight(c);
          return `<button type="button" data-court="${c.id}" class="w-[240px] shrink-0 snap-start cursor-pointer overflow-hidden rounded-lg border text-left transition-colors sm:w-[260px] ${active ? 'border-primary-400 bg-primary-50' : 'border-background-200 bg-background-100 hover:border-primary-300'}">
            <span class="relative block h-[124px] w-full overflow-hidden bg-background-100"><img src="${esc(c.images[0])}" alt="${esc(c.name)}" loading="lazy" class="h-full w-full object-cover object-top">
              <span class="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold photo-chip"><i class="${c.sport === 'football' ? 'ri-football-line' : 'ri-ping-pong-line'}" aria-hidden="true"></i>${esc(c.sportLabel)}</span>
              ${active ? '<span class="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-primary-500 text-white"><i class="ri-check-line text-sm" aria-hidden="true"></i></span>' : ''}
              ${c.distanceKm ? `<span class="absolute left-2 bottom-2 inline-flex items-center gap-1 rounded bg-background-950/80 px-2 py-0.5 text-[10px] font-bold text-white backdrop-blur-sm"><i class="ri-navigation-line text-primary-400"></i>${c.distanceKm.toFixed(1)} km</span>` : ''}
            </span>
            <span class="block p-3"><span class="block truncate text-sm font-semibold text-foreground-950">${esc(c.name)}</span><span class="mt-1 block truncate text-[11px] text-foreground-600"><i class="ri-map-pin-line mr-1 text-foreground-400" aria-hidden="true"></i>${esc(c.address)}</span>
              <span class="mt-2 flex items-center justify-between gap-2"><span class="text-xs font-bold text-primary-700">${formatVnd(c.pricePerHour)}/giờ</span><span class="rounded-full bg-background-200 px-2 py-0.5 text-[10px] font-semibold text-foreground-800">P. ${esc(c.area)}</span></span>
              <span class="mt-1.5 block text-[11px] font-medium text-foreground-500">${f.length ? `Còn ${f.length} khung giờ tối nay` : 'Tối nay đã kín'}</span></span></button>`;
        })
        .join('')
    : `<div class="w-full rounded-lg border border-dashed border-background-300 bg-background-50 px-4 py-10 text-center"><i class="ri-map-pin-line text-2xl text-foreground-400" aria-hidden="true"></i><p class="mt-2 text-sm font-semibold text-foreground-900">Không tìm thấy sân phù hợp</p><p class="mt-1 text-xs text-foreground-500">Bạn thử đổi môn thể thao hoặc xoá từ khoá tìm kiếm.</p></div>`;
}

document.addEventListener('click', (e) => {
  const s = e.target.closest('[data-sport]');
  if (s) {
    st.sport = s.dataset.sport;
    return render();
  }
  const c = e.target.closest('[data-court]');
  if (c) {
    st.selectedId = c.dataset.court;
    render();
  }
});

$('#map-search').addEventListener('input', (e) => {
  st.keyword = e.target.value;
  render();
});

// Xử lý nút GPS định vị
$('#btn-gps')?.addEventListener('click', () => {
  if (!navigator.geolocation) {
    return toast('Trình duyệt của bạn không hỗ trợ định vị GPS.', 'error');
  }
  const btn = $('#btn-gps');
  btn.innerHTML = '<i class="ri-loader-4-line animate-spin text-sm text-primary-600"></i> Đang định vị...';
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      st.userLocation = {
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
      };
      btn.innerHTML = '<i class="ri-check-line text-sm text-primary-600"></i> Đã định vị gần bạn';
      btn.classList.add('bg-primary-50', 'border-primary-400');
      toast('Đã tìm thấy vị trí của bạn! Danh sách sân được sắp xếp theo khoảng cách gần nhất.');
      render();
    },
    (err) => {
      btn.innerHTML = '<i class="ri-navigation-line text-sm text-primary-600"></i> Định vị gần tôi';
      toast('Không thể lấy vị trí GPS. Bạn vui lòng bật định vị trên thiết bị.', 'error');
    },
    { timeout: 8000 }
  );
});

render();

