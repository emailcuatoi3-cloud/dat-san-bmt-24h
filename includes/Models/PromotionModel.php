<?php
namespace Models;

use Core\Model;

/**
 * Model quản lý mã giảm giá & ưu đãi (bảng promotions).
 */
class PromotionModel extends Model
{
    protected string $table = 'promotions';
    protected string $primaryKey = 'id';

    protected array $fillable = [
        'id',
        'owner_id',
        'owner_name',
        'code',
        'title',
        'description',
        'discount_type',
        'discount_value',
        'max_discount',
        'min_order',
        'start_date',
        'end_date',
        'weekdays',
        'start_time',
        'end_time',
        'usage_limit',
        'status',
        'created_at',
        'updated_at',
    ];

    public function findByCode(string $code): ?array
    {
        return $this->first(['code' => trim($code), 'status' => 'active']);
    }

    public function getByOwner(int $ownerId): array
    {
        return $this->where(['owner_id' => $ownerId], 'created_at DESC');
    }
}

