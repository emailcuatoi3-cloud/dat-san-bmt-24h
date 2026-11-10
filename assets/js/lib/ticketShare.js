import { formatVnd } from "./format.js";
const buildTicketShareText = (data) => {
  const lines = [
    `VÉ SÂN CỦA ĐỘI — ${data.courtName}`,
    "",
    `Mã vé: ${data.code}`,
    `Ngày chơi: ${data.dateLabel}`,
    `Khung giờ: ${data.timeLabel}`,
    `Địa chỉ: ${data.address}`
  ];
  if (data.customerName) {
    lines.push(`Người đặt: ${data.customerName}${data.phone ? ` · ${data.phone}` : ""}`);
  }
  if (typeof data.total === "number" && data.total > 0) {
    const money = [`Tiền sân: ${formatVnd(data.total)}`];
    if (typeof data.deposit === "number" && data.deposit > 0) {
      money.push(`Đã cọc: ${formatVnd(data.deposit)}`);
      money.push(`Còn lại tại sân: ${formatVnd(Math.max(0, data.total - data.deposit))}`);
    }
    lines.push(money.join(" · "));
  }
  if (data.deadlineLabel) {
    lines.push(`Hạn hủy vé: ${data.deadlineLabel} (hủy trước mốc này được hoàn 100% cọc)`);
  }
  lines.push("");
  lines.push("Có mặt trước giờ chơi 10 phút và đưa mã vé cho nhân viên sân.");
  lines.push(`Hỗ trợ & đổi giờ: ${data.hotline}`);
  return lines.join("\n");
};
const copyTicketText = async (text) => {
  try {
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
  }
  if (typeof document === "undefined") return false;
  try {
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.top = "-1000px";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand("copy");
    area.remove();
    return ok;
  } catch {
    return false;
  }
};
const shareTicketNative = async (params) => {
  if (typeof navigator === "undefined") return "unsupported";
  const nav = navigator;
  if (typeof nav.share !== "function") return "unsupported";
  try {
    const payload = { title: params.title, text: params.text };
    if (params.file && typeof nav.canShare === "function" && nav.canShare({ files: [params.file] })) {
      payload.files = [params.file];
    }
    await nav.share(payload);
    return "shared";
  } catch (error) {
    const name = typeof error === "object" && error !== null ? error.name : "";
    if (name === "AbortError") return "cancelled";
    return "failed";
  }
};
const SHARE_CHANNELS = [
  { key: "zalo", label: "Zalo", hint: "Dán nội dung vào chat", href: "https://zalo.me/", icon: "ri-message-2-line" },
  {
    key: "messenger",
    label: "Messenger",
    hint: "Dán nội dung vào chat",
    href: "https://www.messenger.com/",
    icon: "ri-chat-3-line"
  }
];
export {
  SHARE_CHANNELS,
  buildTicketShareText,
  copyTicketText,
  shareTicketNative
};
