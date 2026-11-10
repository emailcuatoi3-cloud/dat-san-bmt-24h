// Thông tin nhận cọc — đọc từ config.php (window.APP) để chỉ phải sửa một nơi.
const APP = window.APP || {};
const bank = APP.bank || {};

export const bankAccount = {
  bankBin: bank.bin || '970422',
  bankName: bank.name || 'MB Bank',
  accountNumber: bank.account || '0388888888',
  accountName: bank.accountName || 'DAT SAN BMT 24H',
};

/** Tỷ lệ cọc mặc định khi khách chọn "cọc 30%" */
export const DEPOSIT_RATE = APP.depositRate || 0.3;
/** Số phút giữ sân trong lúc khách quét mã chuyển khoản */
export const HOLD_MINUTES = APP.holdMinutes || 10;
/** Số giây hệ thống chờ để đối soát giao dịch rồi tự động xác nhận tiền cọc */
export const AUTO_CONFIRM_SECONDS = APP.autoConfirmSeconds || 5;
export const HOTLINE = APP.hotline || '0262 399 8888';

export const buildVietQrUrl = (amount, content) =>
  `https://img.vietqr.io/image/${bankAccount.bankBin}-${bankAccount.accountNumber}-compact2.png?amount=${Math.round(
    amount,
  )}&addInfo=${encodeURIComponent(content)}&accountName=${encodeURIComponent(bankAccount.accountName)}`;

export const buildTicketQrUrl = (payload) =>
  `https://api.qrserver.com/v1/create-qr-code/?size=260x260&margin=6&data=${encodeURIComponent(payload)}`;
