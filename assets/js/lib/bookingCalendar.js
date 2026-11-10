import { HOTLINE } from "./payment.js";
import { formatLongDate, parseIsoDate, slotEndTime } from "./format.js";
const getSessionWindow = (booking) => {
  if (!booking.date || booking.slots.length === 0) return null;
  const day = parseIsoDate(booking.date);
  const firstSlot = booking.slots[0];
  const lastSlot = booking.slots[booking.slots.length - 1];
  const [startHour, startMinute] = firstSlot.split(":").map((part) => Number(part));
  const [endHour, endMinute] = slotEndTime(lastSlot).split(":").map((part) => Number(part));
  if ([startHour, startMinute, endHour, endMinute].some((part) => Number.isNaN(part))) return null;
  const start = new Date(day.getFullYear(), day.getMonth(), day.getDate(), startHour, startMinute || 0, 0, 0);
  const end = new Date(day.getFullYear(), day.getMonth(), day.getDate(), endHour, endMinute || 0, 0, 0);
  return { start, end };
};
const buildBookingShareUrl = (code) => {
  if (typeof window === "undefined" || !code) return "";
  const basePath = (window.APP && window.APP.base) || "".split("/").filter(Boolean).join("/");
  const prefix = basePath ? `/${basePath}` : "";
  return `${window.location.origin}${prefix}/don-dat-san/${encodeURIComponent(code)}`;
};
const formatTimeUntil = (ms) => {
  if (ms <= 0) return "0 phút";
  const totalMinutes = Math.floor(ms / 6e4);
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor(totalMinutes % 1440 / 60);
  const minutes = totalMinutes % 60;
  if (days > 0) return `${days} ngày ${hours} giờ`;
  if (hours > 0) return `${hours} giờ ${minutes} phút`;
  return `${Math.max(1, minutes)} phút`;
};
const icsStamp = (date) => date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
const escapeIcsText = (value) => value.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
const foldIcsLine = (line) => {
  if (line.length <= 73) return line;
  const parts = [];
  let rest = line;
  while (rest.length > 73) {
    parts.push(rest.slice(0, 73));
    rest = rest.slice(73);
  }
  parts.push(rest);
  return parts.join("\r\n ");
};
const buildBookingIcs = (booking) => {
  const session = getSessionWindow(booking);
  if (!session) return "";
  const endTime = slotEndTime(booking.slots[booking.slots.length - 1]);
  const summary = `Chơi ${booking.sportLabel.toLowerCase()} · ${booking.courtName}`;
  const description = [
    `Mã vé: ${booking.code}`,
    `Khung giờ: ${booking.slots[0]} - ${endTime} (${formatLongDate(booking.date)})`,
    `Địa chỉ: ${booking.address}`,
    "Có mặt trước giờ chơi 10 phút và đưa mã QR cho nhân viên sân.",
    `Hỗ trợ & đổi giờ: ${HOTLINE}`
  ].join("\n");
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//BMT 24H//Dat san//VI",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${booking.code}@bmt24h`,
    `DTSTAMP:${icsStamp(/* @__PURE__ */ new Date())}`,
    `DTSTART:${icsStamp(session.start)}`,
    `DTEND:${icsStamp(session.end)}`,
    `SUMMARY:${escapeIcsText(summary)}`,
    `LOCATION:${escapeIcsText(booking.address)}`,
    `DESCRIPTION:${escapeIcsText(description)}`,
    "BEGIN:VALARM",
    "TRIGGER:-PT2H",
    "ACTION:DISPLAY",
    `DESCRIPTION:${escapeIcsText(`Còn 2 giờ tới giờ chơi tại ${booking.courtName}`)}`,
    "END:VALARM",
    "BEGIN:VALARM",
    "TRIGGER:-PT45M",
    "ACTION:DISPLAY",
    `DESCRIPTION:${escapeIcsText(`Chuẩn bị ra sân ${booking.courtName} · vé ${booking.code}`)}`,
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR"
  ];
  return `${lines.map(foldIcsLine).join("\r\n")}\r
`;
};
const downloadBookingIcs = (booking) => {
  const content = buildBookingIcs(booking);
  if (!content || typeof document === "undefined") return false;
  const blob = new Blob([content], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `nhac-lich-${booking.code}.ics`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 5e3);
  return true;
};
const buildGoogleCalendarUrl = (booking) => {
  const session = getSessionWindow(booking);
  if (!session) return "";
  const endTime = slotEndTime(booking.slots[booking.slots.length - 1]);
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: `Chơi ${booking.sportLabel.toLowerCase()} · ${booking.courtName}`,
    dates: `${icsStamp(session.start)}/${icsStamp(session.end)}`,
    details: `Mã vé: ${booking.code}
Giờ chơi: ${booking.slots[0]} - ${endTime}
${booking.address}
Hotline: ${HOTLINE}`,
    location: booking.address,
    ctz: "Asia/Ho_Chi_Minh"
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
};
export {
  buildBookingIcs,
  buildBookingShareUrl,
  buildGoogleCalendarUrl,
  downloadBookingIcs,
  formatTimeUntil,
  getSessionWindow
};
