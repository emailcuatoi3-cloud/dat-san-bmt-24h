<?php
/**
 * API xác thực: đăng nhập, đăng ký, đăng xuất, quên / đặt lại mật khẩu.
 */
require_once __DIR__ . '/../includes/bootstrap.php';

function home_of_role(string $role): string
{
    return $role === 'admin' ? '/quan-tri' : ($role === 'owner' ? '/chu-san' : '/tai-khoan');
}

function valid_email(string $email): bool
{
    return (bool) preg_match('/^[^\s@]+@[^\s@]+\.[^\s@]+$/', $email);
}

run_api([
    'login' => function () {
        $email = mb_strtolower(in_str('email'));
        $password = (string) (input()['password'] ?? '');
        if (!valid_email($email)) fail('Email chưa đúng định dạng.');
        if (strlen($password) < 6) fail('Mật khẩu cần ít nhất 6 ký tự.');
        $u = q_one('SELECT id, password_hash, role, status FROM users WHERE email = ?', [$email]);
        if (!$u || !password_verify($password, $u['password_hash'])) fail('Email hoặc mật khẩu không đúng. Vui lòng thử lại.');
        if ($u['status'] === 'suspended') fail('Tài khoản này đang bị tạm khóa. Vui lòng liên hệ quản trị viên để được hỗ trợ.');
        login_user((int) $u['id']);
        $redirect = in_str('redirect');
        $target = ($redirect && $redirect[0] === '/' && strpos($redirect, '//') !== 0) ? $redirect : home_of_role($u['role']);
        return ['redirect' => url($target), 'role' => $u['role']];
    },

    'register' => function () {
        $role = in_str('role') === 'owner' ? 'owner' : 'customer';
        $email = mb_strtolower(in_str('email'));
        $name = in_str('name');
        $phone = preg_replace('/[^\d+]/', '', in_str('phone'));
        $business = in_str('businessName');
        $password = (string) (input()['password'] ?? '');
        if ($role === 'owner' && mb_strlen($business) < 3) fail('Vui lòng nhập tên sân hoặc cơ sở của bạn.');
        if (mb_strlen($name) < 2) fail('Vui lòng nhập họ tên đầy đủ.');
        if (!valid_email($email)) fail('Email chưa đúng định dạng.');
        if (!preg_match('/^0\d{9,10}$/', $phone) && !preg_match('/^\+84\d{9,10}$/', $phone)) fail('Số điện thoại chưa đúng (ví dụ 0912 345 678).');
        if (strlen($password) < 6) fail('Mật khẩu cần ít nhất 6 ký tự.');
        if (q_val('SELECT id FROM users WHERE email = ?', [$email])) fail('Email này đã có tài khoản. Hãy đăng nhập hoặc dùng email khác.');
        if ($role === 'owner' && mb_strlen(trim(in_str('address'))) < 8) fail('Vui lòng nhập địa chỉ sân đầy đủ (số nhà, đường, phường).');
        // Chủ sân mới được tạo như tài khoản khách; quyền chủ sân chỉ mở khi quản trị viên duyệt yêu cầu
        q('INSERT INTO users (email, password_hash, full_name, phone, role, business_name, favorites) VALUES (?,?,?,?,?,?,?)',
            [$email, password_hash($password, PASSWORD_DEFAULT), $name, $phone, 'customer', '', '[]']);
        $id = (int) db()->lastInsertId();
        login_user($id);
        if ($role === 'owner') {
            create_owner_request(q_one('SELECT * FROM users WHERE id = ?', [$id]), input() + ['contactName' => $name]);
            return ['redirect' => url('/dang-ky-chu-san')];
        }
        return ['redirect' => url(home_of_role('customer'))];
    },

    'logout' => function () {
        logout_user();
        return ['redirect' => url('/')];
    },

    'me' => function () {
        return public_profile(current_user());
    },

    'forgot' => function () {
        $email = mb_strtolower(in_str('email'));
        if (!valid_email($email)) fail('Email chưa đúng định dạng. Ví dụ: minhquan@gmail.com.');
        $u = q_one('SELECT id FROM users WHERE email = ?', [$email]);
        $link = null;
        if ($u) {
            $token = bin2hex(random_bytes(24));
            q('UPDATE users SET reset_token = ?, reset_expires = ? WHERE id = ?', [$token, date('Y-m-d H:i:s', time() + 3600), $u['id']]);
            // Bản demo chưa nối dịch vụ gửi email nên trả liên kết về để hiển thị trên màn hình.
            $link = url('/dat-lai-mat-khau?token=' . $token);
        }
        return ['demoLink' => $link];
    },

    'reset' => function () {
        $token = in_str('token');
        $password = (string) (input()['password'] ?? '');
        if (strlen($password) < 6) fail('Mật khẩu cần ít nhất 6 ký tự.');
        $u = q_one('SELECT id FROM users WHERE reset_token = ? AND reset_expires > NOW()', [$token]);
        if (!$token || !$u) fail('Liên kết đặt lại mật khẩu không hợp lệ hoặc đã hết hạn.');
        q('UPDATE users SET password_hash = ?, reset_token = NULL, reset_expires = NULL WHERE id = ?', [password_hash($password, PASSWORD_DEFAULT), $u['id']]);
        return ['redirect' => url('/dang-nhap')];
    },
]);