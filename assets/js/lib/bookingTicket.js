import { buildTicketQrUrl, HOTLINE } from "./payment.js";
import { formatLongDate, slotEndTime } from "./format.js";
import { formatCancelDeadline } from "./cancelPolicy.js";
const buildBookingQrUrl = (booking) => {
  const payload = `${booking.code}|${booking.courtName}|${booking.date}|${booking.slots[0]}|${booking.slots.length}`;
  return buildTicketQrUrl(payload);
};
const buildBookingTicketData = (booking) => {
  const endTime = slotEndTime(booking.slots[booking.slots.length - 1] || booking.slots[0] || "18:00");
  return {
    code: booking.code,
    courtName: booking.courtName,
    dateLabel: formatLongDate(booking.date),
    timeLabel: `${booking.slots[0]} - ${endTime}`,
    address: booking.address,
    customerName: booking.customerName || "",
    phone: booking.customerPhone || "",
    total: booking.totalPrice,
    paymentLabel: booking.payment,
    deadlineLabel: formatCancelDeadline(booking.date, booking.slots[0]) || "Đã qua mốc hủy vé",
    qrUrl: buildBookingQrUrl(booking),
    hotline: HOTLINE
  };
};
export {
  buildBookingQrUrl,
  buildBookingTicketData
};
