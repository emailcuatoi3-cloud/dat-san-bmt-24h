<?php
namespace Models;

use Core\Model;

/**
 * Model quản lý người dùng & phân quyền (bảng users).
 */
class UserModel extends Model
{
    protected string $table = 'users';
    protected string $primaryKey = 'id';

    protected array $fillable = [
        'email',
        'password_hash',
        'full_name',
        'phone',
        'address',
        'role',
        'business_name',
        'status',
        'favorites',
        'reset_token',
        'reset_expires',
        'created_at',
        'updated_at',
    ];

    protected array $hidden = [
        'password_hash',
        'reset_token',
        'reset_expires',
    ];

    /**
     * Tìm người dùng theo email.
     */
    public function findByEmail(string $email): ?array
    {
        return $this->queryOne("SELECT * FROM `{$this->table}` WHERE `email` = ? LIMIT 1", [trim($email)]);
    }

    /**
     * Xác thực thông tin đăng nhập bằng email & mật khẩu thô.
     */
    public function attempt(string $email, string $password): ?array
    {
        $user = $this->findByEmail($email);
        if (!$user || !password_verify($password, $user['password_hash'])) {
            return null;
        }
        return $user;
    }
}

