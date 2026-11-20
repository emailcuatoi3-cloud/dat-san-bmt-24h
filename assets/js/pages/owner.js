/**
 * KÊNH CHỦ SÂN — điểm vào: tải dữ liệu, vẽ tab đang mở, menu di động, nút "Tạo đơn tại quầy".
 */
import { errorBlock, loadingBlock, toast } from '../core/ui.js';
import { PAGE, main, actions, loadData, S } from './owner-shared.js';
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
  if (actions()) actions().innerHTML = '';
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
