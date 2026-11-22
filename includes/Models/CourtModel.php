<?php
namespace Models;

use Core\Model;

/**
 * Model quản lý sân thể thao (bảng courts).
 */
class CourtModel extends Model
{
    protected string $table = 'courts';
    protected string $primaryKey = 'id';

    protected array $fillable = [
        'id',
        'slug',
        'owner_id',
        'name',
        'sport',
        'sport_label',
        'area',
        'address',
        'price_per_hour',
        'peak_price',
        'price_note',
        'price_bands',
        'field_price_step',
        'operating_note',
        'rating',
        'review_count',
        'monthly_bookings',
        'description',
        'highlights',
        'facilities',
        'images',
        'open_time',
        'close_time',
        'weekly_hours',
        'field_types',
        'featured',
        'status',
        'map_query',
        'note',
        'sort_order',
        'deleted_at',
        'created_at',
        'updated_at',
    ];

    /**
     * Lấy danh sách sân còn hoạt động của 1 chủ sân.
     */
    public function getActiveCourtsByOwner(int $ownerId): array
    {
        $sql = "SELECT * FROM `{$this->table}` WHERE `owner_id` = ? AND `deleted_at` IS NULL ORDER BY `sort_order`, `created_at`";
        $rows = $this->queryAll($sql, [$ownerId]);
        return array_map('map_court', $rows);
    }

    /**
     * Lấy các sân nằm trong thùng rác của chủ sân.
     */
    public function getTrashCourtsByOwner(int $ownerId): array
    {
        $sql = "SELECT * FROM `{$this->table}` WHERE `owner_id` = ? AND `deleted_at` IS NOT NULL ORDER BY `deleted_at` DESC";
        $rows = $this->queryAll($sql, [$ownerId]);
        return array_map('map_court', $rows);
    }

    /**
     * Lấy mảng ID các sân thuộc quyền quản lý của chủ sân.
     */
    public function getCourtIdsByOwner(int $ownerId): array
    {
        $sql = "SELECT id FROM `{$this->table}` WHERE `owner_id` = ?";
        return array_column($this->queryAll($sql, [$ownerId]), 'id');
    }

    /**
     * Đưa sân vào thùng rác (Soft Delete).
     */
    public function softDelete(string $courtId, int $ownerId): bool
    {
        $sql = "UPDATE `{$this->table}` SET `deleted_at` = NOW() WHERE `id` = ? AND `owner_id` = ?";
        return $this->execute($sql, [$courtId, $ownerId])->rowCount() > 0;
    }

    /**
     * Khôi phục sân từ thùng rác.
     */
    public function restore(string $courtId, int $ownerId): bool
    {
        $sql = "UPDATE `{$this->table}` SET `deleted_at` = NULL WHERE `id` = ? AND `owner_id` = ?";
        return $this->execute($sql, [$courtId, $ownerId])->rowCount() > 0;
    }
}

