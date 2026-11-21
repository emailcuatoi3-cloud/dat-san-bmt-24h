<?php
namespace Models;

use Core\Model;

/**
 * Model quản lý dịch vụ bán kèm của chủ sân (bảng owner_services).
 */
class ServiceModel extends Model
{
    protected string $table = 'owner_services';
    protected string $primaryKey = 'id';

    protected array $fillable = [
        'id',
        'owner_id',
        'name',
        'category',
        'sport',
        'unit',
        'price',
        'stock',
        'has_variants',
        'attributes_schema',
        'active',
        'sort_order',
    ];

    public function getByOwner(int $ownerId): array
    {
        return $this->where(['owner_id' => $ownerId], 'sort_order ASC, name ASC');
    }
}

