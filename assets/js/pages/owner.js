/**
 * KÊNH CHỦ SÂN — điểm vào: tải dữ liệu, vẽ tab đang mở, menu di động, nút "Tạo đơn tại quầy".
 */
import { errorBlock, loadingBlock } from '../core/ui.js';
import { PAGE, main, loadData } from './owner-shared.js';
import { renderOverview, renderBookings, renderInvoices, renderCourts, renderSchedule, renderReviews, openCounterBooking, resetInvoices } from './owner-ops.js';
import { renderReports, renderCustomers, renderServices, renderPromotions, renderDeposits } from './owner-biz.js';

const RENDER = {
  overview: renderOverview,
  bookings: renderBookings,
  invoices: renderInvoices,
  courts: renderCourts,
  schedule: renderSchedule,
  reviews: renderReviews,
  reports: renderReports,
  customers: renderCustomers,
  services: renderServices,
  promotions: renderPromotions,
  deposits: renderDeposits,
};

const render = () => {
  resetInvoices();
  (RENDER[PAGE.tab] || renderOverview)();
};
window.__ownerRender = render;

// Menu thanh bên trên điện thoại
const sidebar = document.getElementById('owner-sidebar');
const overlay = document.getElementById('owner-overlay');
const toggleMenu = (open) => {
  sidebar.classList.toggle('-translate-x-full', !open);
  overlay.classList.toggle('hidden', !open);
};
document.getElementById('owner-menu-btn').addEventListener('click', () => toggleMenu(true));
overlay.addEventListener('click', () => toggleMenu(false));

document.getElementById('counter-btn').addEventListener('click', () => openCounterBooking());

(async () => {
  main().innerHTML = loadingBlock('Đang tải dữ liệu kênh chủ sân...');
  try {
    await loadData();
    render();
  } catch (e) {
    main().innerHTML = errorBlock(e.message);
  }
})();
