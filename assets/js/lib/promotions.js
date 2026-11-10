import { timeToMinutes } from "./booking.js";
import { parseIsoDate, toIsoDate } from "./format.js";
const WEEKDAY_SHORT = {
  1: "T2",
  2: "T3",
  3: "T4",
  4: "T5",
  5: "T6",
  6: "T7",
  7: "CN"
};
const WEEKDAY_ORDER = [1, 2, 3, 4, 5, 6, 7];
const normalizePromoCode = (value) => (value || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 16);
const isoWeekday = (iso) => {
  const day = parseIsoDate(iso).getDay();
  return day === 0 ? 7 : day;
};
const computeDiscount = (promotion, orderTotal) => {
  if (orderTotal <= 0) return 0;
  if (promotion.discountType === "percent") {
    const raw2 = Math.round(orderTotal * promotion.discountValue / 100 / 1e3) * 1e3;
    const capped = promotion.maxDiscount && promotion.maxDiscount > 0 ? Math.min(raw2, promotion.maxDiscount) : raw2;
    return Math.min(capped, orderTotal);
  }
  const raw = Math.round(promotion.discountValue / 1e3) * 1e3;
  return Math.min(raw, orderTotal);
};
const describeDiscount = (promotion) => {
  if (promotion.discountType === "percent") {
    const cap = promotion.maxDiscount && promotion.maxDiscount > 0 ? `, tối đa ${promotion.maxDiscount.toLocaleString("vi-VN")}đ` : "";
    return `Giảm ${promotion.discountValue}%${cap}`;
  }
  return `Giảm ${promotion.discountValue.toLocaleString("vi-VN")}đ`;
};
const describeConditions = (promotion) => {
  const parts = [];
  parts.push(`Từ ${promotion.startDate.split("-").reverse().join("/")} đến ${promotion.endDate.split("-").reverse().join("/")}`);
  if (promotion.weekdays.length > 0 && promotion.weekdays.length < 7) {
    parts.push(promotion.weekdays.map((day) => WEEKDAY_SHORT[day]).join(", "));
  }
  if (promotion.startTime && promotion.endTime) {
    parts.push(`${promotion.startTime} – ${promotion.endTime}`);
  }
  if (promotion.minOrder > 0) {
    parts.push(`đơn từ ${promotion.minOrder.toLocaleString("vi-VN")}đ`);
  }
  if (promotion.usageLimit) {
    parts.push(`tối đa ${promotion.usageLimit} lượt`);
  }
  return parts.join(" • ");
};
const promotionState = (promotion, todayIso = toIsoDate(/* @__PURE__ */ new Date())) => {
  if (promotion.status === "paused") return "paused";
  if (todayIso < promotion.startDate) return "upcoming";
  if (todayIso > promotion.endDate) return "expired";
  return "active";
};
const checkPromotion = (promotion, context) => {
  const todayIso = toIsoDate(/* @__PURE__ */ new Date());
  const state = promotionState(promotion, todayIso);
  if (state === "paused") return { ok: false, message: "Mã này đang tạm dừng, chưa dùng được." };
  if (state === "upcoming") {
    return { ok: false, message: `Mã chưa tới ngày áp dụng (từ ${promotion.startDate.split("-").reverse().join("/")}).` };
  }
  if (state === "expired") {
    return { ok: false, message: `Mã đã hết hạn từ ${promotion.endDate.split("-").reverse().join("/")}.` };
  }
  if (context.date < promotion.startDate || context.date > promotion.endDate) {
    return { ok: false, message: "Ngày chơi bạn chọn nằm ngoài thời gian áp dụng của mã." };
  }
  if (promotion.weekdays.length > 0 && !promotion.weekdays.includes(isoWeekday(context.date))) {
    return { ok: false, message: "Mã không áp dụng cho ngày này trong tuần." };
  }
  if (promotion.startTime && promotion.endTime) {
    const slotMinutes = timeToMinutes(context.startSlot);
    if (slotMinutes < timeToMinutes(promotion.startTime) || slotMinutes >= timeToMinutes(promotion.endTime)) {
      return {
        ok: false,
        message: `Mã chỉ áp dụng cho khung giờ ${promotion.startTime} – ${promotion.endTime}.`
      };
    }
  }
  if (promotion.minOrder > 0 && context.orderTotal < promotion.minOrder) {
    return { ok: false, message: `Mã áp dụng cho đơn từ ${promotion.minOrder.toLocaleString("vi-VN")}đ.` };
  }
  if (promotion.usageLimit && context.usedCount >= promotion.usageLimit) {
    return { ok: false, message: "Mã đã hết lượt sử dụng." };
  }
  if (computeDiscount(promotion, context.orderTotal) <= 0) {
    return { ok: false, message: "Mã chưa giảm được giá trị nào cho đơn này." };
  }
  return { ok: true, message: "" };
};
const promoMarkerPattern = () => /\[\[promo:[^\]]+\]\]/gi;
const promoMarkerValue = () => /\[\[promo:([A-Z0-9_-]+):(\d+):(\d+)\]\]/i;
const withPromoMarker = (note, marker) => {
  const base = stripPromoMarker(note);
  const payload = `[[promo:${normalizePromoCode(marker.code)}:${Math.round(marker.discount)}:${Math.round(
    marker.baseTotal
  )}]]`;
  return base ? `${base}
${payload}` : payload;
};
const stripPromoMarker = (note) => {
  if (!note) return "";
  return note.replace(promoMarkerPattern(), "").split("\n").map((line) => line.trim()).filter(Boolean).join("\n");
};
const extractPromo = (note) => {
  if (!note) return null;
  const match = note.match(promoMarkerValue());
  if (!match) return null;
  return {
    code: match[1].toUpperCase(),
    discount: Number(match[2]) || 0,
    baseTotal: Number(match[3]) || 0
  };
};
export {
  WEEKDAY_ORDER,
  WEEKDAY_SHORT,
  checkPromotion,
  computeDiscount,
  describeConditions,
  describeDiscount,
  extractPromo,
  isoWeekday,
  normalizePromoCode,
  promotionState,
  stripPromoMarker,
  withPromoMarker
};
