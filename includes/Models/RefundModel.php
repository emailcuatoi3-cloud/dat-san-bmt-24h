<?php
namespace Models;

use Core\Model;

/**
 * Model quản lý hoàn tiền cọc & thanh toán (bảng refunds).
 */
class RefundModel extends Model
{
    protected string $table = 'refunds';
    protected string $primaryKey = 'id';

    protected array $fillable = [
        'id',
        'owner_id',
        'booking_code',
        'customer_name',
        'court_name',
        'amount',
        'method',
        'note',
        'created_at',
    ];

    public function getByOwner(int $ownerId): array
    {
        return $this->where(['owner_id' => $ownerId], 'created_at DESC');
    }
}

