/**
 * KÊNH CHỦ SÂN — điểm vào theo 9 nhóm của Sitemap Chủ sân.
 */
import { errorBlock, loadingBlock, toast } from '../core/ui.js?v=20261123_04';
import { PAGE, S, main, loadData, refreshBadges } from './owner-shared.js?v=20261123_04';
import { openCounterBooking, resetInvoices } from './owner-ops.js?v=20261123_04';
import {
  renderSitemapOverview,
  renderSitemapCourts,
  renderSitemapBookings,
  renderSitemapPayments,
  renderSitemapServices,
  renderSitemapPromotions,
  renderSitemapCustomers,
  renderSitemapStaff,
  renderSitemapSettings,
  renderSitemapAccount,
} from './owner-sitemap.js?v=20261123_04';

const RENDER = {
  overview: renderSitemapOverview,
  courts: renderSitemapCourts,
  bookings: renderSitemapBookings,
  payments: renderSitemapPayments,
  services: renderSitemapServices,
  promotions: renderSitemapPromotions,
  customers: renderSitemapCustomers,
  staff: renderSitemapStaff,
  settings: renderSitemapSettings,
  account: renderSitemapAccount,
};

const render = () => {
  resetInvoices();
  (RENDER[PAGE.tab] || renderSitemapOverview)();
};
window.__ownerRender = render;

// Menu thanh bên trên điện thoại
const sidebar = document.getElementById('owner-sidebar');
const overlay = document.getElementById('owner-overlay');
const toggleMenu = (open) => {
  if (sidebar) sidebar.classList.toggle('-translate-x-full', !open);
  if (overlay) overlay.classList.toggle('hidden', !open);
};
document.getElementById('owner-menu-btn')?.addEventListener('click', () => toggleMenu(true));
overlay?.addEventListener('click', () => toggleMenu(false));

document.getElementById('counter-btn')?.addEventListener('click', () => openCounterBooking());

// ==================== REAL-TIME ĐỒNG BỘ ĐƠN MỚI CHO CHỦ SÂN ====================
let lastBookingHash = '';
let isInitialLoaded = false;

function computeBookingsHash(bookings = []) {
  return bookings.map((b) => `${b.id}:${b.status}:${b.paymentStatus}:${b.approvedAt || ''}`).join('|');
}

async function syncOwnerRealtime() {
  if (document.hidden) return; // Tiết kiệm tài nguyên khi tab ẩn
  // Không tự động render lại nếu chủ sân đang mở popup hoặc đang gõ phím
  const isModalOpen = Boolean(document.querySelector('.modal-wrapper'));
  const isTyping = Boolean(document.activeElement && ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName));

  try {
    const prevBookings = S.bookings || [];
    const prevPendingCount = prevBookings.filter((b) => b.status === 'pending' && !b.approvedAt).length;

    await loadData();

    const curBookings = S.bookings || [];
    const curPendingCount = curBookings.filter((b) => b.status === 'pending' && !b.approvedAt).length;
    const curHash = computeBookingsHash(curBookings);

    // Phát hiện có đơn đặt sân mới đang chờ duyệt!
    if (isInitialLoaded && curPendingCount > prevPendingCount) {
      const newest = curBookings.find((b) => b.status === 'pending' && !b.approvedAt);
      toast(`🔔 Có đơn đặt sân mới chờ bạn duyệt: #${newest ? newest.code : ''}!`, 'info');
      try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.setValueAtTime(587.33, ctx.currentTime);
        gain.gain.setValueAtTime(0.12, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
        osc.start();
        osc.stop(ctx.currentTime + 0.4);
      } catch { }
    }

    if (isInitialLoaded && curHash !== lastBookingHash && !isModalOpen && !isTyping) {
      render();
    }

    lastBookingHash = curHash;
    isInitialLoaded = true;
  } catch (err) { }
}

(async () => {
  main().innerHTML = loadingBlock('Đang tải dữ liệu kênh chủ sân...');
  try {
    await loadData();
    lastBookingHash = computeBookingsHash(S.bookings || []);
    isInitialLoaded = true;
    render();
    // Tự động kiểm tra đơn mới mỗi 2.5 giây (Realtime)
    setInterval(syncOwnerRealtime, 2500);
  } catch (e) {
    main().innerHTML = errorBlock(e.message);
  }
})();
