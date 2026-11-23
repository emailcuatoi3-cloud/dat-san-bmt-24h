/**
 * KÊNH CHỦ SÂN — điểm vào theo 9 nhóm của Sitemap Chủ sân.
 */
import { errorBlock, loadingBlock } from '../core/ui.js';
import { PAGE, main, loadData } from './owner-shared.js';
import { openCounterBooking, resetInvoices } from './owner-ops.js';
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
} from './owner-sitemap.js?v=20261122_03';

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

(async () => {
  main().innerHTML = loadingBlock('Đang tải dữ liệu kênh chủ sân...');
  try {
    await loadData();
    render();
  } catch (e) {
    main().innerHTML = errorBlock(e.message);
  }
})();
