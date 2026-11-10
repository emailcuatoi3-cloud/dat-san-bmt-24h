import { HOTLINE } from "./payment.js";
import { formatLongDate } from "./format.js";
const CANCEL_CUTOFF_HOURS = 4;
const CANCEL_CUTOFF_MS = CANCEL_CUTOFF_HOURS * 60 * 60 * 1e3;
const sessionStartAt = (date, slots) => {
  if (!date || slots.length === 0) return null;
  const start = slots[0];
  if (!start) return null;
  const parsed = /* @__PURE__ */ new Date(`${date}T${start.slice(0, 5)}:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};
const msUntilSession = (date, slots, now = Date.now()) => {
  const startAt = sessionStartAt(date, slots);
  return startAt ? startAt.getTime() - now : null;
};
const isBeforeCancelCutoff = (date, slots, now = Date.now()) => {
  const remaining = msUntilSession(date, slots, now);
  if (remaining === null) return false;
  return remaining >= CANCEL_CUTOFF_MS;
};
const hoursUntilSession = (date, slots, now = Date.now()) => {
  const remaining = msUntilSession(date, slots, now);
  if (remaining === null) return null;
  return Math.round(remaining / (60 * 60 * 1e3) * 10) / 10;
};
const cancelPolicyShort = `Chỉ hủy và hoàn 100% tiền cọc khi còn cách giờ chơi từ ${CANCEL_CUTOFF_HOURS} giờ trở lên.`;
const cancelPolicyFull = `${cancelPolicyShort} Trong ${CANCEL_CUTOFF_HOURS} giờ cuối, nút hủy được khóa — bạn gọi ${HOTLINE} để chủ sân hỗ trợ trực tiếp.`;
const cancelLockedNotice = `Đã qua mốc hủy ${CANCEL_CUTOFF_HOURS} giờ — vui lòng gọi ${HOTLINE} để chủ sân hỗ trợ.`;
const pad2 = (value) => `${value}`.padStart(2, "0");
const cancelDeadline = (date, startSlot) => {
  const startAt = sessionStartAt(date, startSlot ? [startSlot] : []);
  if (!startAt) return null;
  return new Date(startAt.getTime() - CANCEL_CUTOFF_MS);
};
const formatCancelDeadline = (date, startSlot) => {
  const deadline = cancelDeadline(date, startSlot);
  if (!deadline) return "";
  const iso = `${deadline.getFullYear()}-${pad2(deadline.getMonth() + 1)}-${pad2(deadline.getDate())}`;
  const time = `${pad2(deadline.getHours())}:${pad2(deadline.getMinutes())}`;
  return `${formatLongDate(iso)} lúc ${time}`;
};
const formatCancelDeadlineShort = (date, startSlot) => {
  const deadline = cancelDeadline(date, startSlot);
  if (!deadline) return "";
  const day = `${pad2(deadline.getDate())}/${pad2(deadline.getMonth() + 1)}/${deadline.getFullYear()}`;
  return `${day} ${pad2(deadline.getHours())}:${pad2(deadline.getMinutes())}`;
};
export {
  CANCEL_CUTOFF_HOURS,
  CANCEL_CUTOFF_MS,
  cancelDeadline,
  cancelLockedNotice,
  cancelPolicyFull,
  cancelPolicyShort,
  formatCancelDeadline,
  formatCancelDeadlineShort,
  hoursUntilSession,
  isBeforeCancelCutoff,
  msUntilSession,
  sessionStartAt
};
