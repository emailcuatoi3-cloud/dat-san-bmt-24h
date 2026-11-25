/**
 * KÊNH CHỦ SÂN — điểm vào theo 9 nhóm của Sitemap Chủ sân.
 */
import { errorBlock, loadingBlock } from '../core/ui.js';
import { PAGE, main, actions, loadData } from './owner-shared.js?v=20261125_03';
import { openCounterBooking, resetInvoices } from './owner-ops.js?v=20261125_03';
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
} from './owner-sitemap.js?v=20261125_03';

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
  if (actions()) actions().innerHTML = '';
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

document.querySelectorAll('#counter-btn, [data-open-counter]').forEach((btn) => {
  btn.addEventListener('click', () => {
    toggleMenu(false);
    openCounterBooking();
  });
});

(async () => {
  main().innerHTML = loadingBlock('Đang tải dữ liệu kênh chủ sân...');
  try {
    await loadData();
    render();
  } catch (e) {
    main().innerHTML = errorBlock(e.message);
  }
})();

// Tự động kiểm tra đơn mới mỗi 30 giây khi tab đang hiển thị
setInterval(async () => {
  if (document.hidden) return;
  try {
    const prevPending = S.bookings.filter((b) => b.status === 'pending').length;
    await loadData();
    const newPending = S.bookings.filter((b) => b.status === 'pending').length;
    if (newPending > prevPending) {
      toast(`Có ${newPending - prevPending} đơn đặt sân mới chờ duyệt!`, 'info');
      if (['overview', 'bookings'].includes(PAGE.tab)) {
        render();
      }
    }
  } catch (_) {}
}, 30000);
