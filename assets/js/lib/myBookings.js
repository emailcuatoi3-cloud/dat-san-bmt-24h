const CODES_KEY = "bmt24h_my_booking_codes";
const CANCEL_REASONS_KEY = "bmt24h_my_cancel_reasons";
const MAX_CODES = 50;
const readJson = (key, fallback) => {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
};
const writeJson = (key, value) => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
  }
};
const readMyBookingCodes = () => {
  const stored = readJson(CODES_KEY, []);
  return Array.isArray(stored) ? stored.filter((code) => typeof code === "string" && code.trim().length > 0) : [];
};
const rememberBookingCode = (code) => {
  const trimmed = code.trim();
  if (!trimmed) return;
  const next = [trimmed, ...readMyBookingCodes().filter((item) => item !== trimmed)].slice(0, MAX_CODES);
  writeJson(CODES_KEY, next);
};
const readCancelReasons = () => {
  const stored = readJson(CANCEL_REASONS_KEY, {});
  return stored && typeof stored === "object" ? stored : {};
};
const saveCancelReason = (code, reason) => {
  if (!code || !reason) return;
  const next = { ...readCancelReasons(), [code]: reason };
  writeJson(CANCEL_REASONS_KEY, next);
};
export {
  readCancelReasons,
  readMyBookingCodes,
  rememberBookingCode,
  saveCancelReason
};
