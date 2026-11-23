<?php
/**
 * HỆ THỐNG GỬI EMAIL XÁC NHẬN VÉ ĐẶT SÂN & THÔNG BÁO TỰ ĐỘNG
 * - Tự động tạo thư HTML chuyên nghiệp kèm mã QR check-in
 * - Hỗ trợ SMTP Gmail và lưu bản sao xem trước tại /uploads/emails/ khi chạy localhost
 */
require_once __DIR__ . '/bootstrap.php';

function render_ticket_email_html(array $b): string
{
    $code = htmlspecialchars($b['code'] ?? '');
    $name = htmlspecialchars($b['customer_name'] ?? 'Quý khách');
    $court = htmlspecialchars($b['court_name'] ?? 'Sân thể thao');
    $date = date('d/m/Y', strtotime($b['booking_date'] ?? 'now'));
    $slots = is_array($b['slots']) ? $b['slots'] : (json_decode($b['slots'] ?? '[]', true) ?: [$b['start_slot'] ?? '18:00']);
    $start = $slots[0] ?? '18:00';
    $duration = (int) ($b['duration_minutes'] ?? 60);
    $timeRange = $start . ' (' . $duration . ' phút)';
    $total = number_format((int) ($b['total_price'] ?? 0), 0, ',', '.') . 'đ';
    $isPaidFull = ($b['payment_status'] ?? '') === 'paid' || ($b['payment_method'] ?? '') === 'vietqr-full';
    $paidAmount = number_format((int) ($isPaidFull ? ($b['total_price'] ?? 0) : ($b['deposit_amount'] ?? 0)), 0, ',', '.') . 'đ';
    $debt = (int) ($b['total_price'] ?? 0) - (int) ($isPaidFull ? ($b['total_price'] ?? 0) : ($b['deposit_amount'] ?? 0));
    $debtText = $debt > 0 ? number_format($debt, 0, ',', '.') . 'đ (thanh toán tại sân)' : 'Đã thanh toán đủ 100%';
    $qrUrl = 'https://api.qrserver.com/v1/create-qr-code/?size=260x260&margin=6&data=' . urlencode($code);

    return <<<HTML
<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <title>Vé đặt sân #{$code} - {$court}</title>
</head>
<body style="margin: 0; padding: 20px 0; background-color: #f4f6f8; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b;">
  <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width: 600px; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.06); border: 1px solid #e2e8f0;">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #059669 0%, #10b981 100%); padding: 28px 24px; text-align: center; color: #ffffff;">
              <h1 style="margin: 0; font-size: 22px; font-weight: 800; letter-spacing: 0.5px;">ĐẶT SÂN BMT 24H</h1>
              <p style="margin: 6px 0 0; font-size: 13px; opacity: 0.9;">Xác nhận đặt sân &amp; Vé điện tử check-in</p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding: 28px 24px;">
              <p style="margin: 0 0 16px; font-size: 15px; line-height: 1.5;">Xin chào <strong>{$name}</strong>,</p>
              <p style="margin: 0 0 20px; font-size: 14px; line-height: 1.6; color: #475569;">
                Yêu cầu đặt sân của bạn đã được xác nhận tiền cọc thành công! Dưới đây là thông tin chi tiết và <strong>Vé QR Check-in</strong> để bạn xuất trình khi đến sân:
              </p>

              <!-- QR Ticket Box -->
              <table role="presentation" width="100%" style="background-color: #f8fafc; border: 2px dashed #cbd5e1; border-radius: 10px; margin-bottom: 24px;">
                <tr>
                  <td style="padding: 20px; text-align: center;">
                    <span style="display: inline-block; background-color: #ecfdf5; color: #047857; font-size: 11px; font-weight: 700; padding: 4px 10px; border-radius: 9999px; text-transform: uppercase;">Vé điện tử hợp lệ</span>
                    <h2 style="margin: 10px 0 4px; font-size: 20px; font-family: monospace; color: #047857; letter-spacing: 1px;">#{$code}</h2>
                    <p style="margin: 0 0 16px; font-size: 12px; color: #64748b;">Đưa mã QR này cho nhân viên sân đối chiếu</p>
                    <img src="{$qrUrl}" alt="Vé QR {$code}" width="160" height="160" style="display: block; margin: 0 auto; border-radius: 8px; border: 1px solid #e2e8f0; background: #ffffff; padding: 6px;">
                  </td>
                </tr>
              </table>

              <!-- Details Table -->
              <table role="presentation" width="100%" style="border-collapse: collapse; font-size: 13px; line-height: 1.6; margin-bottom: 24px;">
                <tr style="border-bottom: 1px solid #f1f5f9;">
                  <td style="padding: 10px 0; color: #64748b; width: 140px;">Sân thể thao:</td>
                  <td style="padding: 10px 0; font-weight: 700; color: #0f172a;">{$court}</td>
                </tr>
                <tr style="border-bottom: 1px solid #f1f5f9;">
                  <td style="padding: 10px 0; color: #64748b;">Ngày chơi:</td>
                  <td style="padding: 10px 0; font-weight: 600; color: #0f172a;">{$date}</td>
                </tr>
                <tr style="border-bottom: 1px solid #f1f5f9;">
                  <td style="padding: 10px 0; color: #64748b;">Khung giờ:</td>
                  <td style="padding: 10px 0; font-weight: 600; color: #0f172a;">{$timeRange}</td>
                </tr>
                <tr style="border-bottom: 1px solid #f1f5f9;">
                  <td style="padding: 10px 0; color: #64748b;">Tổng tiền sân:</td>
                  <td style="padding: 10px 0; font-weight: 700; color: #0f172a;">{$total}</td>
                </tr>
                <tr style="border-bottom: 1px solid #f1f5f9;">
                  <td style="padding: 10px 0; color: #64748b;">Đã thanh toán/cọc:</td>
                  <td style="padding: 10px 0; font-weight: 700; color: #059669;">{$paidAmount} (Xác nhận thành công)</td>
                </tr>
                <tr>
                  <td style="padding: 10px 0; color: #64748b;">Còn lại tại sân:</td>
                  <td style="padding: 10px 0; font-weight: 600; color: #b45309;">{$debtText}</td>
                </tr>
              </table>

              <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 12px 14px; border-radius: 4px; font-size: 12px; color: #92400e; line-height: 1.5;">
                <strong>Lưu ý:</strong> Vui lòng có mặt trước giờ chơi 10 phút. Nếu có việc bận cần hủy, bạn có thể tự hủy trên web trước giờ chơi ít nhất 4 tiếng để được hoàn lại 100% tiền cọc.
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f8fafc; padding: 20px 24px; border-top: 1px solid #e2e8f0; font-size: 12px; color: #64748b; text-align: center; line-height: 1.6;">
              <p style="margin: 0;">Cần hỗ trợ gấp? Gọi hotline: <strong style="color: #059669;">0262 399 8888</strong></p>
              <p style="margin: 4px 0 0;">Website Đặt Sân Bóng Đá &amp; Cầu Lông Buôn Ma Thuột 24H</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
HTML;
}

/**
 * Gửi email xác nhận đặt sân & vé QR
 */
function send_booking_ticket_email(array $booking): bool
{
    $toEmail = trim($booking['customer_email'] ?? '');
    if (!$toEmail && !empty($booking['customer_id'])) {
        $toEmail = q_val('SELECT email FROM users WHERE id = ?', [$booking['customer_id']]);
    }

    $html = render_ticket_email_html($booking);

    // Luôn lưu bản sao thư tại uploads/emails/ để xem trước trên trình duyệt
    $dir = __DIR__ . '/../uploads/emails';
    if (!is_dir($dir)) {
        @mkdir($dir, 0777, true);
    }
    @file_put_contents($dir . '/' . ($booking['code'] ?? 'ticket') . '.html', $html);

    if (!$toEmail || !filter_var($toEmail, FILTER_VALIDATE_EMAIL)) {
        return false;
    }

    $subject = '=?UTF-8?B?' . base64_encode('Vé đặt sân #' . $booking['code'] . ' - ' . ($booking['court_name'] ?? 'Đặt Sân BMT 24H')) . '?=';

    // Nếu có cấu hình tài khoản SMTP -> Gửi qua SMTP Socket trực tiếp
    if (SMTP_USER && SMTP_PASS) {
        return send_smtp_mail($toEmail, $subject, $html);
    }

    // Nếu chạy trên máy chủ có sendmail -> gọi mail()
    $headers = [
        'MIME-Version: 1.0',
        'Content-type: text/html; charset=UTF-8',
        'From: ' . SMTP_FROM_NAME . ' <' . (SMTP_USER ?: 'no-reply@datsanbmt24h.vn') . '>',
        'X-Mailer: PHP/' . phpversion(),
    ];
    return @mail($toEmail, $subject, $html, implode("\r\n", $headers));
}

/**
 * Gửi thư qua kết nối SMTP Socket bảo mật (TLS/SSL)
 */
function send_smtp_mail(string $to, string $subject, string $html): bool
{
    $host = SMTP_HOST;
    $port = SMTP_PORT;
    $user = SMTP_USER;
    $pass = SMTP_PASS;
    $from = $user;

    $socket = @fsockopen(($port === 465 ? 'ssl://' : '') . $host, $port, $errno, $errstr, 10);
    if (!$socket) return false;

    $read = fn() => fgets($socket, 512);
    $send = fn(string $cmd) => fputs($socket, $cmd . "\r\n");

    $read();
    $send("EHLO " . gethostname());
    while ($line = $read()) {
        if (substr($line, 3, 1) === ' ') break;
    }

    if ($port === 587) {
        $send("STARTTLS");
        $read();
        stream_socket_enable_crypto($socket, true, STREAM_CRYPTO_METHOD_TLS_CLIENT);
        $send("EHLO " . gethostname());
        while ($line = $read()) {
            if (substr($line, 3, 1) === ' ') break;
        }
    }

    $send("AUTH LOGIN");
    $read();
    $send(base64_encode($user));
    $read();
    $send(base64_encode($pass));
    $res = $read();
    if (!str_starts_with($res, '235')) {
        fclose($socket);
        return false;
    }

    $send("MAIL FROM: <$from>");
    $read();
    $send("RCPT TO: <$to>");
    $read();
    $send("DATA");
    $read();

    $headers = "MIME-Version: 1.0\r\n";
    $headers .= "Content-Type: text/html; charset=UTF-8\r\n";
    $headers .= "From: " . SMTP_FROM_NAME . " <$from>\r\n";
    $headers .= "To: <$to>\r\n";
    $headers .= "Subject: $subject\r\n";

    $send($headers . "\r\n" . $html . "\r\n.");
    $read();
    $send("QUIT");
    fclose($socket);
    return true;
}
