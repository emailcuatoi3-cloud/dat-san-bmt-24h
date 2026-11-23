<?php
namespace Models;

use Core\Model;

/**
 * Model quản lý đơn đặt sân (bảng bookings).
 */
class BookingModel extends Model
{
    protected string $table = 'bookings';
    protected string $primaryKey = 'id';

    protected array $fillable = [
        'id',
        'code',
        'source',
        'court_id',
        'court_name',
        'sport',
        'area',
        'image',
        'customer_id',
        'customer_name',
        'customer_phone',
        'customer_email',
        'booking_date',
        'start_slot',
        'duration_minutes',
        'slots',
        'unit_price',
        'base_total',
        'discount_amount',
        'promo_code',
        'total_price',
        'deposit_amount',
        'extras',
        'payment_method',
        'payment_status',
        'payment_label',
        'status',
        'approved_at',
        'reject_reason',
        'cancel_reason',
        'hold_expires_at',
        'checked_in_at',
        'note',
        'created_at',
        'updated_at',
    ];

    /**
     * Lấy toàn bộ đơn đặt sân thuộc danh sách sân chỉ định.
     */
    public function getByCourtIds(array $courtIds): array
    {
        if (empty($courtIds)) return [];
        auto_cancel_expired_holds();
        auto_complete_bookings();
        $in = in_list($courtIds);
        $sql = BOOKING_SELECT . " WHERE b.court_id IN ({$in}) ORDER BY b.booking_date DESC, b.created_at DESC";
        $rows = $this->queryAll($sql, $courtIds);
        return array_values(array_filter(array_map('map_booking', $rows), fn($b) => !$b['expiredHold']));
    }

    /**
     * Lấy các đơn hôm nay của cụm sân.
     */
    public function getTodayBookings(array $courtIds): array
    {
        if (empty($courtIds)) return [];
        $in = in_list($courtIds);
        $sql = BOOKING_SELECT . " WHERE b.court_id IN ({$in}) AND b.booking_date = CURDATE() ORDER BY b.start_slot ASC";
        $rows = $this->queryAll($sql, $courtIds);
        return array_map('map_booking', $rows);
    }

    /**
     * Tính tổng doanh thu hôm nay của các sân.
     */
    public function getTodayRevenue(array $courtIds): int
    {
        if (empty($courtIds)) return 0;
        $in = in_list($courtIds);
        $sql = "SELECT COALESCE(SUM(total_price), 0) FROM `{$this->table}` WHERE court_id IN ({$in}) AND booking_date = CURDATE() AND status <> 'pending' AND status <> 'cancelled'";
        return (int) $this->queryValue($sql, $courtIds);
    }
}

