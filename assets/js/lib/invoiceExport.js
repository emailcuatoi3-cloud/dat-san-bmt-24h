const statusLabels = {
  paid: "Đã thanh toán",
  partial: "Còn nợ",
  unpaid: "Chưa thu"
};
const sourceLabels = {
  customer: "Khách đặt online",
  owner: "Chủ sân nhập"
};
const filterInvoicesByDateRange = (invoices, from, to) => invoices.filter((invoice) => {
  if (from && invoice.bookingDate < from) return false;
  if (to && invoice.bookingDate > to) return false;
  return true;
});
const exportInvoicesCsv = (invoices, fileName) => {
  const header = [
    "Mã hóa đơn",
    "Mã đơn",
    "Nguồn",
    "Sân",
    "Khách hàng",
    "Số điện thoại",
    "Ngày chơi",
    "Khung giờ",
    "Tiền sân (VND)",
    "Đã thu (VND)",
    "Còn nợ (VND)",
    "Trạng thái",
    "Hình thức",
    "Ngày lập"
  ];
  const rows = invoices.map((invoice) => [
    invoice.code,
    invoice.bookingCode,
    sourceLabels[invoice.source],
    invoice.courtName,
    invoice.customerName,
    invoice.customerPhone,
    invoice.bookingDate,
    `${invoice.slots[0] || "--:--"} - ${invoice.slots[invoice.slots.length - 1] || "--:--"} (${invoice.slots.length} giờ)`,
    `${invoice.total}`,
    `${invoice.paid}`,
    `${invoice.debt}`,
    statusLabels[invoice.status],
    invoice.method,
    invoice.issuedAt
  ]);
  const csv = [header, ...rows].map((line) => line.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\r\n");
  try {
    const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    return true;
  } catch {
    return false;
  }
};
export {
  exportInvoicesCsv,
  filterInvoicesByDateRange
};
