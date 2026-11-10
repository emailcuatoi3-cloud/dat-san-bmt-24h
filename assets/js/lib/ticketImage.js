import { formatVnd } from "./format.js";
const CANVAS_WIDTH = 760;
const CANVAS_HEIGHT = 1240;
const SCALE = 2;
const CARD_X = 28;
const CARD_Y = 28;
const CARD_W = CANVAS_WIDTH - CARD_X * 2;
const PAD = 36;
const CONTENT_X = CARD_X + PAD;
const CONTENT_W = CARD_W - PAD * 2;
const oklchToRgb = (l, c, h) => {
  const hRad = h * Math.PI / 180;
  const a = c * Math.cos(hRad);
  const b = c * Math.sin(hRad);
  const lPrime = l + 0.3963377774 * a + 0.2158037573 * b;
  const mPrime = l - 0.1055613458 * a - 0.0638541728 * b;
  const sPrime = l - 0.0894841775 * a - 1.291485548 * b;
  const l3 = lPrime ** 3;
  const m3 = mPrime ** 3;
  const s3 = sPrime ** 3;
  const linear = [
    4.0767416621 * l3 - 3.3077115913 * m3 + 0.2309699292 * s3,
    -1.2684380046 * l3 + 2.6097574011 * m3 - 0.3413193965 * s3,
    -0.0041960863 * l3 - 0.7034186147 * m3 + 1.707614701 * s3
  ];
  const toSrgb = (value) => {
    const clamped = Math.min(1, Math.max(0, value));
    const gamma = clamped <= 31308e-7 ? 12.92 * clamped : 1.055 * clamped ** (1 / 2.4) - 0.055;
    return Math.round(gamma * 255);
  };
  return [toSrgb(linear[0]), toSrgb(linear[1]), toSrgb(linear[2])];
};
const readToken = (token) => {
  if (typeof window === "undefined") return [15, 150, 100];
  const raw = getComputedStyle(document.documentElement).getPropertyValue(`--${token}`).trim();
  const parts = raw.split(/\s+/).map((part) => Number(part));
  if (parts.length < 3 || parts.some((part) => Number.isNaN(part))) return [15, 150, 100];
  return oklchToRgb(parts[0], parts[1], parts[2]);
};
const solid = (token) => {
  const [r, g, b] = readToken(token);
  return `rgb(${r}, ${g}, ${b})`;
};
const translucent = (token, alpha) => {
  const [r, g, b] = readToken(token);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};
const roundRect = (ctx, x, y, width, height, radius) => {
  const [tl, tr, br, bl] = typeof radius === "number" ? [radius, radius, radius, radius] : radius;
  ctx.beginPath();
  ctx.moveTo(x + tl, y);
  ctx.lineTo(x + width - tr, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + tr);
  ctx.lineTo(x + width, y + height - br);
  ctx.quadraticCurveTo(x + width, y + height, x + width - br, y + height);
  ctx.lineTo(x + bl, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - bl);
  ctx.lineTo(x, y + tl);
  ctx.quadraticCurveTo(x, y, x + tl, y);
  ctx.closePath();
};
const wrapLines = (ctx, text, maxWidth, maxLines = 2) => {
  const words = text.split(/\s+/).filter(Boolean);
  const lines = [];
  let current = "";
  words.forEach((word) => {
    const next = current ? `${current} ${word}` : word;
    if (!current || ctx.measureText(next).width <= maxWidth) {
      current = next;
    } else {
      lines.push(current);
      current = word;
    }
  });
  if (current) lines.push(current);
  if (lines.length <= maxLines) return lines;
  const trimmed = lines.slice(0, maxLines);
  let last = trimmed[maxLines - 1];
  while (last.length > 1 && ctx.measureText(`${last}…`).width > maxWidth) {
    last = last.slice(0, -1);
  }
  trimmed[maxLines - 1] = `${last}…`;
  return trimmed;
};
const loadImage = (url) => new Promise((resolve) => {
  if (!url) {
    resolve(null);
    return;
  }
  const direct = new Image();
  direct.crossOrigin = "anonymous";
  direct.onload = () => resolve(direct);
  direct.onerror = () => {
    fetch(url, { mode: "cors" }).then((response) => response.blob()).then((blob) => {
      const objectUrl = URL.createObjectURL(blob);
      const fallback = new Image();
      fallback.onload = () => {
        resolve(fallback);
        window.setTimeout(() => URL.revokeObjectURL(objectUrl), 8e3);
      };
      fallback.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        resolve(null);
      };
      fallback.src = objectUrl;
    }).catch(() => resolve(null));
  };
  direct.src = url;
});
const renderTicketCanvas = async (data) => {
  const canvas = document.createElement("canvas");
  canvas.width = CANVAS_WIDTH * SCALE;
  canvas.height = CANVAS_HEIGHT * SCALE;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Thiết bị chưa hỗ trợ tạo ảnh vé.");
  ctx.scale(SCALE, SCALE);
  const pageBg = solid("background-50");
  const cardBg = solid("background-100");
  const borderColor = solid("background-300");
  const strongText = solid("foreground-950");
  const mutedText = solid("foreground-600");
  const faintText = solid("foreground-500");
  const primary = solid("primary-500");
  const primaryDeep = solid("primary-800");
  const primarySoft = translucent("primary-500", 0.12);
  const onPrimary = "#ffffff";
  ctx.fillStyle = pageBg;
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  roundRect(ctx, CARD_X, CARD_Y, CARD_W, CANVAS_HEIGHT - CARD_Y * 2, 24);
  ctx.fillStyle = cardBg;
  ctx.fill();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = borderColor;
  ctx.stroke();
  const headerH = 200;
  roundRect(ctx, CARD_X, CARD_Y, CARD_W, headerH, [24, 24, 0, 0]);
  ctx.fillStyle = primary;
  ctx.fill();
  ctx.fillStyle = "rgba(255, 255, 255, 0.78)";
  ctx.font = '700 13px "Plus Jakarta Sans", "Inter", sans-serif';
  ctx.textBaseline = "alphabetic";
  ctx.fillText("VÉ ĐIỆN TỬ · BMT 24H", CONTENT_X, CARD_Y + 52);
  ctx.fillStyle = onPrimary;
  ctx.font = '800 30px "Plus Jakarta Sans", "Inter", sans-serif';
  const nameLines = wrapLines(ctx, data.courtName, CONTENT_W - 20, 2);
  let headerTextY = CARD_Y + 92;
  nameLines.forEach((line) => {
    ctx.fillText(line, CONTENT_X, headerTextY);
    headerTextY += 36;
  });
  ctx.fillStyle = "rgba(255, 255, 255, 0.95)";
  ctx.font = '700 19px "Inter", sans-serif';
  ctx.fillText(data.code, CONTENT_X, CARD_Y + headerH - 26);
  let y = CARD_Y + headerH + 46;
  const label = (text, x, top) => {
    ctx.fillStyle = faintText;
    ctx.font = '700 11px "Inter", sans-serif';
    ctx.fillText(text.toUpperCase(), x, top);
  };
  const value = (text, x, top, size = 18) => {
    ctx.fillStyle = strongText;
    ctx.font = `700 ${size}px "Plus Jakarta Sans", "Inter", sans-serif`;
    ctx.fillText(text, x, top);
  };
  const colRightX = CONTENT_X + CONTENT_W / 2 + 12;
  label("Ngày chơi", CONTENT_X, y);
  value(data.dateLabel, CONTENT_X, y + 26, 17);
  label("Khung giờ", colRightX, y);
  value(data.timeLabel, colRightX, y + 26, 17);
  y += 66;
  label("Địa chỉ sân", CONTENT_X, y);
  ctx.fillStyle = strongText;
  ctx.font = '500 15px "Inter", sans-serif';
  const addressLines = wrapLines(ctx, data.address, CONTENT_W, 2);
  let addressY = y + 24;
  addressLines.forEach((line) => {
    ctx.fillText(line, CONTENT_X, addressY);
    addressY += 21;
  });
  y = addressY + 22;
  label("Người đặt", CONTENT_X, y);
  value(data.customerName || "Khách hàng", CONTENT_X, y + 26, 16);
  label("Điện thoại", colRightX, y);
  value(data.phone || "—", colRightX, y + 26, 16);
  y += 62;
  const deadlineH = 108;
  roundRect(ctx, CONTENT_X, y, CONTENT_W, deadlineH, 16);
  ctx.fillStyle = primarySoft;
  ctx.fill();
  ctx.strokeStyle = translucent("primary-500", 0.45);
  ctx.lineWidth = 1.5;
  ctx.stroke();
  roundRect(ctx, CONTENT_X + 16, y + 22, 5, deadlineH - 44, 3);
  ctx.fillStyle = primary;
  ctx.fill();
  ctx.fillStyle = primaryDeep;
  ctx.font = '700 11px "Inter", sans-serif';
  ctx.fillText("HẠN HỦY VÉ", CONTENT_X + 34, y + 32);
  ctx.fillStyle = strongText;
  ctx.font = '800 21px "Plus Jakarta Sans", "Inter", sans-serif';
  ctx.fillText(data.deadlineLabel, CONTENT_X + 34, y + 62);
  ctx.fillStyle = mutedText;
  ctx.font = '500 12.5px "Inter", sans-serif';
  ctx.fillText("Hủy trước mốc này được hoàn 100% tiền cọc.", CONTENT_X + 34, y + 86);
  y += deadlineH + 30;
  const hasDeposit = typeof data.deposit === "number" && data.deposit > 0;
  const moneyRows = [
    { label: "Tổng tiền sân", valueText: formatVnd(data.total) }
  ];
  if (hasDeposit) {
    moneyRows.push({ label: "Tiền cọc đã chuyển", valueText: formatVnd(data.deposit) });
    moneyRows.push({
      label: "Còn lại tại sân",
      valueText: formatVnd(Math.max(0, data.total - data.deposit)),
      strong: true
    });
  } else if (data.paymentLabel) {
    moneyRows.push({ label: "Hình thức", valueText: data.paymentLabel });
  }
  const moneyH = 34 + moneyRows.length * 34;
  roundRect(ctx, CONTENT_X, y, CONTENT_W, moneyH, 16);
  ctx.fillStyle = pageBg;
  ctx.fill();
  ctx.strokeStyle = borderColor;
  ctx.lineWidth = 1.5;
  ctx.stroke();
  let rowY = y + 34;
  moneyRows.forEach((row) => {
    ctx.fillStyle = row.strong ? primary : mutedText;
    ctx.font = '500 14px "Inter", sans-serif';
    ctx.fillText(row.label, CONTENT_X + 22, rowY);
    ctx.fillStyle = row.strong ? primary : strongText;
    ctx.font = row.strong ? '800 19px "Plus Jakarta Sans", "Inter", sans-serif' : '700 15px "Inter", sans-serif';
    ctx.textAlign = "right";
    ctx.fillText(row.valueText, CONTENT_X + CONTENT_W - 22, rowY + (row.strong ? 2 : 0));
    ctx.textAlign = "left";
    rowY += 34;
  });
  y += moneyH + 28;
  ctx.save();
  ctx.setLineDash([6, 6]);
  ctx.strokeStyle = borderColor;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(CONTENT_X, y);
  ctx.lineTo(CONTENT_X + CONTENT_W, y);
  ctx.stroke();
  ctx.restore();
  y += 28;
  const qrBox = 200;
  const qrX = CARD_X + (CARD_W - qrBox) / 2;
  roundRect(ctx, qrX, y, qrBox, qrBox, 14);
  ctx.fillStyle = "#ffffff";
  ctx.fill();
  ctx.strokeStyle = borderColor;
  ctx.lineWidth = 1.5;
  ctx.stroke();
  const qrImage = await loadImage(data.qrUrl);
  if (qrImage) {
    ctx.drawImage(qrImage, qrX + 16, y + 16, qrBox - 32, qrBox - 32);
  } else {
    ctx.fillStyle = mutedText;
    ctx.font = '600 13px "Inter", sans-serif';
    ctx.textAlign = "center";
    ctx.fillText("Mã QR đặt sân", CANVAS_WIDTH / 2, y + qrBox / 2 - 8);
    ctx.fillText(data.code, CANVAS_WIDTH / 2, y + qrBox / 2 + 14);
    ctx.textAlign = "left";
  }
  y += qrBox + 26;
  ctx.fillStyle = strongText;
  ctx.font = '700 14px "Plus Jakarta Sans", "Inter", sans-serif';
  ctx.textAlign = "center";
  ctx.fillText("Xuất trình mã QR này cho nhân viên sân khi tới nhận sân", CANVAS_WIDTH / 2, y);
  y += 22;
  ctx.fillStyle = mutedText;
  ctx.font = '500 12px "Inter", sans-serif';
  ctx.fillText("Có mặt trước giờ chơi 10 phút để được nhận sân đúng lượt", CANVAS_WIDTH / 2, y);
  ctx.textAlign = "left";
  const footerY = CANVAS_HEIGHT - CARD_Y - 34;
  roundRect(ctx, CONTENT_X, footerY - 58, CONTENT_W, 1, 0);
  ctx.fillStyle = borderColor;
  ctx.fill();
  ctx.fillStyle = translucent("accent-500", 0.9);
  ctx.font = '700 13px "Inter", sans-serif';
  ctx.textAlign = "center";
  ctx.fillText(`Hỗ trợ & đổi giờ: ${data.hotline}`, CANVAS_WIDTH / 2, footerY - 26);
  ctx.fillStyle = faintText;
  ctx.font = '500 11.5px "Inter", sans-serif';
  ctx.fillText("Ảnh vé do khách tự tải · Chỉ chia sẻ với người cùng đội", CANVAS_WIDTH / 2, footerY - 4);
  ctx.textAlign = "left";
  return canvas;
};
const renderTicketImageBlob = async (data) => {
  if (typeof document !== "undefined" && document.fonts && document.fonts.ready) {
    await document.fonts.ready.catch(() => void 0);
  }
  const canvas = await renderTicketCanvas(data);
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
  if (!blob) throw new Error("Chưa tạo được ảnh vé. Vui lòng thử lại.");
  return blob;
};
const saveTicketImage = (blob, code) => {
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = `ve-dien-tu-${code}.png`;
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 6e3);
};
export {
  renderTicketImageBlob,
  saveTicketImage
};
