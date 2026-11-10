import { DEPOSIT_RATE } from "./payment.js";
const DURATION_OPTIONS = [
  { value: 60, label: "60 phút" },
  { value: 90, label: "90 phút" },
  { value: 120, label: "120 phút" }
];
const pad = (value) => `${value}`.padStart(2, "0");
const timeToMinutes = (slot) => {
  const [hour, minute] = slot.split(":").map((part) => Number(part));
  return hour * 60 + (minute || 0);
};
const minutesToTime = (minutes) => `${pad(Math.floor(minutes / 60) % 24)}:${pad(minutes % 60)}`;
const endTimeOf = (startSlot, durationMinutes) => minutesToTime(timeToMinutes(startSlot) + durationMinutes);
const slotsInRange = (startSlot, durationMinutes) => {
  const start = timeToMinutes(startSlot);
  const end = start + durationMinutes;
  const result = [];
  for (let cursor = start; cursor < end; cursor += 60) {
    result.push(minutesToTime(cursor));
  }
  return result;
};
const formatTimeRange = (startSlot, durationMinutes) => `${startSlot} - ${endTimeOf(startSlot, durationMinutes)}`;
const calcCourtPrice = (pricePerHour, durationMinutes) => Math.round(pricePerHour * durationMinutes / 60 / 1e3) * 1e3;
const calcDeposit = (total) => Math.round(total * DEPOSIT_RATE / 1e3) * 1e3;
const formatCountdown = (seconds) => {
  const safe = Math.max(0, seconds);
  return `${pad(Math.floor(safe / 60))}:${pad(safe % 60)}`;
};
const sessionEndAt = (date, slots) => {
  if (!date || slots.length === 0) return null;
  const base = /* @__PURE__ */ new Date(`${date}T00:00:00`);
  if (Number.isNaN(base.getTime())) return null;
  const endMinutes = timeToMinutes(slots[slots.length - 1]) + 60;
  return new Date(base.getTime() + endMinutes * 60 * 1e3);
};
const hasSessionEnded = (date, slots, now = Date.now()) => {
  const endAt = sessionEndAt(date, slots);
  return endAt ? endAt.getTime() <= now : false;
};
const remainingHoldSeconds = (expiresAt, now = Date.now()) => Math.max(0, Math.floor((new Date(expiresAt).getTime() - now) / 1e3));
const buildHoldExpiry = (minutes) => new Date(Date.now() + minutes * 60 * 1e3).toISOString();
const extraServices = [
  { id: "bong", label: "Thuê bóng thi đấu", price: 3e4 },
  { id: "bib", label: "Thuê áo bib (bộ 10 áo)", price: 4e4 },
  { id: "vot", label: "Thuê vợt cầu lông", price: 2e4 },
  { id: "cau", label: "Ống cầu lông (3 quả)", price: 45e3 }
];
export {
  DURATION_OPTIONS,
  buildHoldExpiry,
  calcCourtPrice,
  calcDeposit,
  endTimeOf,
  extraServices,
  formatCountdown,
  formatTimeRange,
  hasSessionEnded,
  minutesToTime,
  remainingHoldSeconds,
  sessionEndAt,
  slotsInRange,
  timeToMinutes
};
