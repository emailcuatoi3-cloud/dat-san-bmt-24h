const WEEKDAY_KEYS = ["1", "2", "3", "4", "5", "6", "7"];
const WEEKDAY_LABELS = {
  "1": "Thứ Hai",
  "2": "Thứ Ba",
  "3": "Thứ Tư",
  "4": "Thứ Năm",
  "5": "Thứ Sáu",
  "6": "Thứ Bảy",
  "7": "Chủ Nhật"
};
const WEEKDAY_SHORT = {
  "1": "T2",
  "2": "T3",
  "3": "T4",
  "4": "T5",
  "5": "T6",
  "6": "T7",
  "7": "CN"
};
const WEEKLY_MARKER = "[[gio-tuan]]";
const pad = (value) => `${value}`.padStart(2, "0");
const toMinutes = (time) => {
  const [hour, minute] = (time || "").split(":").map((part) => Number(part));
  if (!Number.isFinite(hour)) return 0;
  return hour * 60 + (Number.isFinite(minute) ? minute : 0);
};
const minutesToTime = (minutes) => `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;
const TIME_OPTIONS = Array.from({ length: 49 }, (_, index) => minutesToTime(index * 30));
const OPEN_TIME_OPTIONS = TIME_OPTIONS.filter((time) => toMinutes(time) < 1440);
const CLOSE_TIME_OPTIONS = TIME_OPTIONS.filter((time) => toMinutes(time) >= 60);
const HOUR_PRESETS = [
  { label: "05:00 - 23:00", open: "05:00", close: "23:00" },
  { label: "06:00 - 22:00", open: "06:00", close: "22:00" },
  { label: "05:00 - 24:00", open: "05:00", close: "24:00" },
  { label: "08:00 - 22:00", open: "08:00", close: "22:00" }
];
const makeDayHours = (open, close) => ({ closed: false, open, close });
const buildWeeklyHours = (open, close) => {
  const result = {};
  WEEKDAY_KEYS.forEach((key) => {
    result[key] = makeDayHours(open, close);
  });
  return result;
};
const isTimeString = (value) => typeof value === "string" && /^\d{1,2}:\d{2}$/.test(value);
const normalizeWeeklyHours = (raw, fallbackOpen = "05:00", fallbackClose = "23:00") => {
  const source = raw && typeof raw === "object" ? raw : {};
  const result = {};
  WEEKDAY_KEYS.forEach((key) => {
    const entry = source[key];
    if (entry && typeof entry === "object") {
      const day = entry;
      const open = isTimeString(day.open) ? day.open : fallbackOpen;
      const close = isTimeString(day.close) ? day.close : fallbackClose;
      result[key] = { closed: day.closed === true, open, close };
      return;
    }
    result[key] = makeDayHours(fallbackOpen, fallbackClose);
  });
  return result;
};
const isoWeekdayOf = (dateIso) => {
  const parsed = /* @__PURE__ */ new Date(`${dateIso}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return "1";
  const day = parsed.getDay();
  return `${day === 0 ? 7 : day}`;
};
const hoursForDate = (court, dateIso) => {
  const day = court.weeklyHours?.[isoWeekdayOf(dateIso)];
  if (day) return day;
  return makeDayHours(court.openTime, court.closeTime);
};
const isWeeklyCustomized = (court) => {
  if (!court.weeklyHours) return false;
  return WEEKDAY_KEYS.some((key) => {
    const day = court.weeklyHours?.[key];
    if (!day) return false;
    return day.closed || day.open !== court.openTime || day.close !== court.closeTime;
  });
};
const describeDayHours = (day) => day.closed ? "Nghỉ cả ngày" : `${day.open} - ${day.close}`;
const weekdaySummary = (weekly) => {
  if (!weekly) return "";
  const groups = [];
  WEEKDAY_KEYS.forEach((key) => {
    const day = weekly[key];
    if (!day) return;
    const text = describeDayHours(day);
    const last = groups[groups.length - 1];
    if (last && last.text === text) {
      last.end = key;
      return;
    }
    groups.push({ start: key, end: key, text });
  });
  return groups.map((group) => {
    const label = group.start === group.end ? WEEKDAY_SHORT[group.start] : `${WEEKDAY_SHORT[group.start]} – ${WEEKDAY_SHORT[group.end]}`;
    return `${label}: ${group.text}`;
  }).join(" • ");
};
const parseCourtNote = (raw) => {
  const text = raw || "";
  const index = text.indexOf(WEEKLY_MARKER);
  if (index === -1) return { note: text.trim() };
  const note = text.slice(0, index).trim();
  const payload = text.slice(index + WEEKLY_MARKER.length).trim();
  try {
    return { note, weeklyHours: normalizeWeeklyHours(JSON.parse(payload)) };
  } catch {
    return { note };
  }
};
const serializeCourtNote = (note, weeklyHours) => {
  const clean = (note || "").split(WEEKLY_MARKER)[0].trim();
  if (!weeklyHours) return clean;
  return `${clean}${clean ? "\n\n" : ""}${WEEKLY_MARKER}${JSON.stringify(weeklyHours)}`;
};
export {
  CLOSE_TIME_OPTIONS,
  HOUR_PRESETS,
  OPEN_TIME_OPTIONS,
  TIME_OPTIONS,
  WEEKDAY_KEYS,
  WEEKDAY_LABELS,
  WEEKDAY_SHORT,
  buildWeeklyHours,
  hoursForDate,
  isWeeklyCustomized,
  isoWeekdayOf,
  makeDayHours,
  minutesToTime,
  normalizeWeeklyHours,
  parseCourtNote,
  serializeCourtNote,
  toMinutes,
  weekdaySummary
};
