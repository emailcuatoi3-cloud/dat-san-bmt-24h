<?php
namespace Models;

use Core\Model;

/**
 * Model quản lý nhân viên cơ sở của chủ sân (bảng owner_staff).
 */
class StaffModel extends Model
{
    protected string $table = 'owner_staff';
    protected string $primaryKey = 'id';

    protected array $fillable = [
        'id',
        'owner_id',
        'full_name',
        'phone',
        'email',
        'password_hash',
        'role_name',
        'permissions',
        'status',
        'created_at',
    ];

    protected array $hidden = [
        'password_hash',
    ];

    /**
     * Lấy danh sách nhân viên của 1 chủ sân cụ thể.
     */
    public function getByOwner(int $ownerId, string $status = 'all'): array
    {
        $conditions = ['owner_id' => $ownerId];
        if ($status !== 'all') {
            $conditions['status'] = $status;
        }
        $rows = $this->where($conditions, 'created_at DESC');
        return array_map(function ($r) {
            $r['permissions'] = jd($r['permissions']);
            $r['hasPassword'] = !empty($this->queryValue('SELECT password_hash FROM owner_staff WHERE id = ?', [$r['id']]));
            return $r;
        }, $rows);
    }

    /**
     * Tìm nhân viên theo email (để đăng nhập).
     */
    public function findByEmail(string $email): ?array
    {
        $sql = "SELECT * FROM `{$this->table}` WHERE `email` = ? AND `status` = 'active' LIMIT 1";
        return $this->queryOne($sql, [trim($email)]);
    }

    /**
     * Kiểm tra trùng lặp email với các nhân viên khác.
     */
    public function isEmailTaken(string $email, ?string $excludeId = null): bool
    {
        $sql = "SELECT id FROM `{$this->table}` WHERE `email` = ?" . ($excludeId ? " AND `id` <> ?" : "");
        $params = $excludeId ? [$email, $excludeId] : [$email];
        return $this->queryValue($sql, $params) !== null;
    }
}

