const formatVnd = (value) => `${value.toLocaleString("vi-VN")}đ`;
const parseIsoDate = (iso) => {
  const [year, month, day] = iso.split("-").map((part) => Number(part));
  return new Date(year, month - 1, day);
};
const toIsoDate = (date) => {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
};
const weekdayLabels = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];
const getUpcomingDates = (count = 14) => {
  const today = /* @__PURE__ */ new Date();
  const result = [];
  for (let index = 0; index < count; index += 1) {
    const date = new Date(today.getFullYear(), today.getMonth(), today.getDate() + index);
    const iso = toIsoDate(date);
    const weekday = weekdayLabels[date.getDay()];
    const day = `${date.getDate()}`.padStart(2, "0");
    const month = `${date.getMonth() + 1}`.padStart(2, "0");
    const prefix = index === 0 ? "Hôm nay" : index === 1 ? "Ngày mai" : weekday;
    result.push({
      iso,
      weekday: prefix,
      day,
      month,
      label: `${prefix}, ${day}/${month}`
    });
  }
  return result;
};
const formatLongDate = (iso) => {
  const date = parseIsoDate(iso);
  const weekday = ["Chủ nhật", "Thứ hai", "Thứ ba", "Thứ tư", "Thứ năm", "Thứ sáu", "Thứ bảy"][date.getDay()];
  const day = `${date.getDate()}`.padStart(2, "0");
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  return `${weekday}, ${day}/${month}/${date.getFullYear()}`;
};
const formatShortDate = (iso) => {
  const date = parseIsoDate(iso);
  const day = `${date.getDate()}`.padStart(2, "0");
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  return `${day}/${month}/${date.getFullYear()}`;
};
const buildBookingCode = () => {
  const now = /* @__PURE__ */ new Date();
  const random = Math.floor(100 + Math.random() * 900);
  return `BMT${now.getFullYear()}${`${now.getMonth() + 1}`.padStart(2, "0")}${`${now.getDate()}`.padStart(2, "0")}-${random}`;
};
const slotEndTime = (slot) => {
  const [hour] = slot.split(":");
  const nextHour = Number(hour) + 1;
  return `${`${nextHour}`.padStart(2, "0")}:00`;
};
const slotStartDate = (iso, slot) => {
  const date = parseIsoDate(iso);
  const [hour, minute] = slot.split(":").map((part) => Number(part));
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), hour, minute || 0, 0, 0);
};
const isPastSlot = (iso, slot, now = Date.now()) => slotStartDate(iso, slot).getTime() <= now;
const isTodayIso = (iso) => iso === toIsoDate(/* @__PURE__ */ new Date());
const isTodayOrLater = (iso) => {
  const today = /* @__PURE__ */ new Date();
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  return parseIsoDate(iso).getTime() >= todayStart;
};
const formatRelativeDay = (iso) => {
  const today = /* @__PURE__ */ new Date();
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const diffDays = Math.round((parseIsoDate(iso).getTime() - todayStart) / 864e5);
  if (diffDays === 0) return "Hôm nay";
  if (diffDays === 1) return "Ngày mai";
  if (diffDays === 2) return "Ngày kia";
  if (diffDays > 2) return `Còn ${diffDays} ngày`;
  if (diffDays === -1) return "Hôm qua";
  return `${Math.abs(diffDays)} ngày trước`;
};
export {
  buildBookingCode,
  formatLongDate,
  formatRelativeDay,
  formatShortDate,
  formatVnd,
  getUpcomingDates,
  isPastSlot,
  isTodayIso,
  isTodayOrLater,
  parseIsoDate,
  slotEndTime,
  slotStartDate,
  toIsoDate,
  weekdayLabels
};
