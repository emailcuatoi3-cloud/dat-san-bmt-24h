<?php
namespace Core;

use PDO;
use PDOStatement;
use RuntimeException;

/**
 * BASE MODEL (MODEL CHA)
 * Đóng gói toàn bộ logic tương tác CSDL, CRUD cơ bản, Query Builder thu nhỏ,
 * Phân trang, Transaction và bảo vệ Mass-assignment.
 * 
 * @author Senior Developer (10+ years experience)
 */
abstract class Model
{
    /** @var PDO Đối tượng kết nối CSDL PDO */
    protected PDO $db;

    /** @var string Tên bảng trong CSDL */
    protected string $table = '';

    /** @var string Khóa chính của bảng */
    protected string $primaryKey = 'id';

    /** @var array Các cột được phép gán dữ liệu hàng loạt (tránh lỗi bảo mật Mass Assignment) */
    protected array $fillable = [];

    /** @var array Các cột nhạy cảm cần ẩn khi trả dữ liệu ra bên ngoài (JSON/Array) */
    protected array $hidden = [];

    /** @var bool Tự động quản lý created_at / updated_at nếu có */
    protected bool $timestamps = true;

    public function __construct()
    {
        $this->db = db();
        if (empty($this->table)) {
            $class = (new \ReflectionClass($this))->getShortName();
            $this->table = strtolower(preg_replace('/(?<!^)[A-Z]/', '_$0', str_replace('Model', '', $class))) . 's';
        }
    }

    /**
     * Lấy tên bảng hiện tại.
     */
    public function getTable(): string
    {
        return $this->table;
    }

    /**
     * Lấy khóa chính.
     */
    public function getPrimaryKey(): string
    {
        return $this->primaryKey;
    }

    /**
     * Tìm 1 bản ghi theo ID khóa chính.
     */
    public function find($id, array $columns = ['*']): ?array
    {
        $cols = $this->formatColumns($columns);
        $sql = "SELECT {$cols} FROM `{$this->table}` WHERE `{$this->primaryKey}` = ? LIMIT 1";
        $row = $this->queryOne($sql, [$id]);
        return $row ? $this->filterHidden($row) : null;
    }

    /**
     * Tìm theo ID hoặc ném Exception nếu không tìm thấy.
     */
    public function findOrFail($id, array $columns = ['*']): array
    {
        $record = $this->find($id, $columns);
        if (!$record) {
            throw new RuntimeException("Không tìm thấy bản ghi với ID {$id} trong bảng {$this->table}.");
        }
        return $record;
    }

    /**
     * Lấy bản ghi đầu tiên thỏa mãn điều kiện.
     */
    public function first(array $conditions = [], string $orderBy = '', array $columns = ['*']): ?array
    {
        $rows = $this->where($conditions, $orderBy, 1, 0, $columns);
        return $rows[0] ?? null;
    }

    /**
     * Lấy tất cả bản ghi.
     */
    public function all(string $orderBy = '', array $columns = ['*']): array
    {
        return $this->where([], $orderBy, null, null, $columns);
    }

    /**
     * Tìm kiếm và lọc linh hoạt theo mảng điều kiện:
     * - Key => Value: ['status' => 'active']
     * - Key => [Operator, Value]: ['price', '>=', 100000]
     */
    public function where(array $conditions = [], string $orderBy = '', ?int $limit = null, ?int $offset = null, array $columns = ['*']): array
    {
        $cols = $this->formatColumns($columns);
        [$whereSql, $params] = $this->buildWhere($conditions);

        $sql = "SELECT {$cols} FROM `{$this->table}`" . ($whereSql ? " WHERE {$whereSql}" : '');
        if (!empty($orderBy)) {
            $sql .= " ORDER BY {$orderBy}";
        }
        if ($limit !== null) {
            $sql .= " LIMIT " . (int)$limit;
            if ($offset !== null) {
                $sql .= " OFFSET " . (int)$offset;
            }
        }

        $rows = $this->queryAll($sql, $params);
        return array_map([$this, 'filterHidden'], $rows);
    }

    /**
     * Lọc bản ghi có cột nằm trong danh sách giá trị (WHERE IN).
     */
    public function whereIn(string $column, array $values, string $orderBy = '', array $columns = ['*']): array
    {
        if (empty($values)) {
            return [];
        }
        $cols = $this->formatColumns($columns);
        $placeholders = implode(',', array_fill(0, count($values), '?'));
        $sql = "SELECT {$cols} FROM `{$this->table}` WHERE `{$column}` IN ({$placeholders})";
        if (!empty($orderBy)) {
            $sql .= " ORDER BY {$orderBy}";
        }
        $rows = $this->queryAll($sql, array_values($values));
        return array_map([$this, 'filterHidden'], $rows);
    }

    /**
     * Đếm số bản ghi thỏa điều kiện.
     */
    public function count(array $conditions = []): int
    {
        [$whereSql, $params] = $this->buildWhere($conditions);
        $sql = "SELECT COUNT(*) FROM `{$this->table}`" . ($whereSql ? " WHERE {$whereSql}" : '');
        return (int) $this->queryValue($sql, $params);
    }

    /**
     * Kiểm tra có tồn tại bản ghi thỏa mãn điều kiện hay không.
     */
    public function exists(array $conditions): bool
    {
        return $this->count($conditions) > 0;
    }

    /**
     * Thêm mới 1 bản ghi vào CSDL.
     * Tự động lọc qua danh sách $fillable để đảm bảo an toàn.
     */
    public function create(array $data)
    {
        $safeData = $this->filterFillable($data);
        if (empty($safeData)) {
            throw new RuntimeException("Dữ liệu thêm mới không hợp lệ hoặc không khớp danh sách fillable của {$this->table}.");
        }

        $fields = array_keys($safeData);
        $fieldList = '`' . implode('`, `', $fields) . '`';
        $placeholders = implode(', ', array_fill(0, count($fields), '?'));

        $sql = "INSERT INTO `{$this->table}` ({$fieldList}) VALUES ({$placeholders})";
        $this->execute($sql, array_values($safeData));

        // Trả về ID được tạo hoặc ID được truyền vào
        if (isset($safeData[$this->primaryKey])) {
            return $safeData[$this->primaryKey];
        }
        $lastId = $this->db->lastInsertId();
        return is_numeric($lastId) && (int)$lastId > 0 ? (int)$lastId : $lastId;
    }

    /**
     * Cập nhật bản ghi theo ID khóa chính.
     */
    public function update($id, array $data): bool
    {
        $safeData = $this->filterFillable($data);
        if (empty($safeData)) {
            return false;
        }

        $setParts = [];
        $params = [];
        foreach ($safeData as $field => $val) {
            $setParts[] = "`{$field}` = ?";
            $params[] = $val;
        }
        $params[] = $id;

        $setSql = implode(', ', $setParts);
        $sql = "UPDATE `{$this->table}` SET {$setSql} WHERE `{$this->primaryKey}` = ?";
        return $this->execute($sql, $params)->rowCount() > 0;
    }

    /**
     * Cập nhật nhiều bản ghi theo mảng điều kiện.
     */
    public function updateWhere(array $conditions, array $data): int
    {
        $safeData = $this->filterFillable($data);
        if (empty($safeData)) {
            return 0;
        }

        $setParts = [];
        $params = [];
        foreach ($safeData as $field => $val) {
            $setParts[] = "`{$field}` = ?";
            $params[] = $val;
        }

        [$whereSql, $whereParams] = $this->buildWhere($conditions);
        if (empty($whereSql)) {
            throw new RuntimeException("Không được phép cập nhật toàn bộ bảng mà không có điều kiện WHERE.");
        }

        $params = array_merge($params, $whereParams);
        $sql = "UPDATE `{$this->table}` SET " . implode(', ', $setParts) . " WHERE {$whereSql}";
        return $this->execute($sql, $params)->rowCount();
    }

    /**
     * Xóa 1 bản ghi theo ID khóa chính.
     */
    public function delete($id): bool
    {
        $sql = "DELETE FROM `{$this->table}` WHERE `{$this->primaryKey}` = ?";
        return $this->execute($sql, [$id])->rowCount() > 0;
    }

    /**
     * Xóa bản ghi theo điều kiện.
     */
    public function deleteWhere(array $conditions): int
    {
        [$whereSql, $params] = $this->buildWhere($conditions);
        if (empty($whereSql)) {
            throw new RuntimeException("Không được phép xóa toàn bộ bảng mà không có điều kiện WHERE.");
        }
        $sql = "DELETE FROM `{$this->table}` WHERE {$whereSql}";
        return $this->execute($sql, $params)->rowCount();
    }

    /**
     * Phân trang dữ liệu chuẩn hóa gồm số trang, tổng trang, tổng số bản ghi.
     */
    public function paginate(int $page = 1, int $perPage = 10, array $conditions = [], string $orderBy = ''): array
    {
        $page = max(1, $page);
        $perPage = max(1, min(100, $perPage));
        $total = $this->count($conditions);
        $totalPages = $total > 0 ? (int) ceil($total / $perPage) : 1;
        $offset = ($page - 1) * $perPage;

        $items = $this->where($conditions, $orderBy, $perPage, $offset);

        return [
            'data' => $items,
            'pagination' => [
                'page' => $page,
                'perPage' => $perPage,
                'total' => $total,
                'totalPages' => $totalPages,
                'hasPrev' => $page > 1,
                'hasNext' => $page < $totalPages,
            ]
        ];
    }

    // ---------------- TRANSACTION HELPERS ----------------

    public function beginTransaction(): bool
    {
        return $this->db->beginTransaction();
    }

    public function commit(): bool
    {
        return $this->db->commit();
    }

    public function rollBack(): bool
    {
        if ($this->db->inTransaction()) {
            return $this->db->rollBack();
        }
        return false;
    }

    // ---------------- QUERY PRIMITIVES ----------------

    public function execute(string $sql, array $params = []): PDOStatement
    {
        $stmt = $this->db->prepare($sql);
        $stmt->execute($params);
        return $stmt;
    }

    public function queryAll(string $sql, array $params = []): array
    {
        return $this->execute($sql, $params)->fetchAll(PDO::FETCH_ASSOC);
    }

    public function queryOne(string $sql, array $params = []): ?array
    {
        $row = $this->execute($sql, $params)->fetch(PDO::FETCH_ASSOC);
        return $row === false ? null : $row;
    }

    public function queryValue(string $sql, array $params = [])
    {
        $val = $this->execute($sql, $params)->fetchColumn();
        return $val === false ? null : $val;
    }

    // ---------------- INTERNAL HELPERS ----------------

    protected function formatColumns(array $columns): string
    {
        if (empty($columns) || $columns === ['*']) {
            return '*';
        }
        return implode(', ', array_map(function ($col) {
            $col = trim($col);
            if (str_contains($col, '(') || str_contains($col, ' ') || str_contains($col, '.')) {
                return $col;
            }
            return "`{$col}`";
        }, $columns));
    }

    protected function buildWhere(array $conditions): array
    {
        if (empty($conditions)) {
            return ['', []];
        }
        $parts = [];
        $params = [];
        foreach ($conditions as $key => $val) {
            if (is_int($key) && is_array($val) && count($val) === 3) {
                // Định dạng: ['price', '>=', 100000]
                [$field, $op, $v] = $val;
                $parts[] = "`{$field}` {$op} ?";
                $params[] = $v;
            } elseif ($val === null) {
                $parts[] = "`{$key}` IS NULL";
            } else {
                $parts[] = "`{$key}` = ?";
                $params[] = $val;
            }
        }
        return [implode(' AND ', $parts), $params];
    }

    protected function filterFillable(array $data): array
    {
        if (empty($this->fillable)) {
            return $data;
        }
        return array_intersect_key($data, array_flip($this->fillable));
    }

    protected function filterHidden(array $row): array
    {
        if (empty($this->hidden)) {
            return $row;
        }
        foreach ($this->hidden as $h) {
            unset($row[$h]);
        }
        return $row;
    }
}

