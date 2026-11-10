import { minutesToTime, timeToMinutes } from "./booking.js";
const toMinutes = (time) => {
  const [hour, minute] = time.split(":").map((part) => Number(part));
  return hour * 60 + (minute || 0);
};
const buildDaySlots = (court) => {
  const start = toMinutes(court.openTime);
  const end = toMinutes(court.closeTime);
  const slots = [];
  for (let cursor = start; cursor < end; cursor += 60) {
    slots.push(minutesToTime(cursor % 1440));
  }
  return slots;
};
const getPriceBands = (court) => {
  if (court.priceBands && court.priceBands.length > 0) return court.priceBands;
  return [
    {
      id: "all",
      label: "Cả ngày",
      shortLabel: "Cả ngày",
      start: court.openTime,
      end: court.closeTime,
      price: court.pricePerHour
    }
  ];
};
const pricePerHourAt = (court, slot) => {
  const minute = toMinutes(slot);
  const band = getPriceBands(court).find(
    (item) => minute >= toMinutes(item.start) && minute < toMinutes(item.end)
  );
  return band ? band.price : court.pricePerHour;
};
const priceBandAt = (court, slot) => {
  const minute = toMinutes(slot);
  return getPriceBands(court).find((item) => minute >= toMinutes(item.start) && minute < toMinutes(item.end));
};
const calcCourtPriceForRange = (court, startSlot, durationMinutes) => {
  if (!startSlot) return 0;
  let total = 0;
  let remaining = durationMinutes;
  let cursor = timeToMinutes(startSlot);
  while (remaining > 0) {
    const chunk = Math.min(60, remaining);
    total += pricePerHourAt(court, minutesToTime(cursor)) * chunk / 60;
    remaining -= chunk;
    cursor += chunk;
  }
  return Math.round(total / 1e3) * 1e3;
};
const lowestPrice = (court) => Math.min(...getPriceBands(court).map((band) => band.price));
const highestPrice = (court) => Math.max(court.pricePerHour, ...getPriceBands(court).map((band) => band.price));
const peakBand = (court) => getPriceBands(court).find((band) => band.peak);
const fieldPriceStep = (court) => {
  if (typeof court.fieldPriceStep === "number") return court.fieldPriceStep;
  return court.sport === "football" ? 14e4 : 3e4;
};
const formatBandName = (band) => `${band.shortLabel} ${band.start} - ${band.end}`;
const describeBandGap = (court) => {
  const bands = getPriceBands(court);
  if (bands.length < 2) return "";
  const cheapest = [...bands].sort((first, second) => first.price - second.price)[0];
  const priciest = [...bands].sort((first, second) => second.price - first.price)[0];
  if (cheapest.price === priciest.price) return "";
  return `${formatBandName(cheapest)}: ${new Intl.NumberFormat("vi-VN").format(cheapest.price)}đ · ${formatBandName(
    priciest
  )}: ${new Intl.NumberFormat("vi-VN").format(priciest.price)}đ`;
};
export {
  buildDaySlots,
  calcCourtPriceForRange,
  describeBandGap,
  fieldPriceStep,
  getPriceBands,
  highestPrice,
  lowestPrice,
  peakBand,
  priceBandAt,
  pricePerHourAt
};
