const parseTicketPayload = (raw) => {
  const text = (raw || "").trim();
  const parts = text.split("|").map((part) => part.trim());
  return {
    code: (parts[0] || "").toUpperCase(),
    courtName: parts[1] || void 0,
    date: parts[2] || void 0,
    startSlot: parts[3] || void 0,
    duration: parts[4] || void 0,
    raw: text
  };
};
const markerPattern = () => /\[\[checkin:[^\]]+\]\]/gi;
const markerValue = () => /\[\[checkin:([^\]]+)\]\]/i;
const extractCheckInAt = (note) => {
  if (!note) return void 0;
  const match = note.match(markerValue());
  if (!match) return void 0;
  const parsed = new Date(match[1]);
  return Number.isNaN(parsed.getTime()) ? void 0 : parsed.toISOString();
};
const stripCheckInMarker = (note) => {
  if (!note) return "";
  return note.replace(markerPattern(), "").split("\n").map((line) => line.trim()).filter(Boolean).join("\n");
};
const withCheckInMarker = (note, checkedInAt) => {
  const base = stripCheckInMarker(note);
  return base ? `${base}
[[checkin:${checkedInAt}]]` : `[[checkin:${checkedInAt}]]`;
};
const formatCheckInTime = (iso) => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const hours = `${date.getHours()}`.padStart(2, "0");
  const minutes = `${date.getMinutes()}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  return `${hours}:${minutes} ${day}/${month}/${date.getFullYear()}`;
};
export {
  extractCheckInAt,
  formatCheckInTime,
  parseTicketPayload,
  stripCheckInMarker,
  withCheckInMarker
};
