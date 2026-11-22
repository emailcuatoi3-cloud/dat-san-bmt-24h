<?php
/**
 * TEST SUITE: KIỂM THỬ TOÀN DIỆN KIẾN TRÚC BASE MODEL + BASE CONTROLLER
 */
require_once __DIR__ . '/../includes/bootstrap.php';

use Core\Model;
use Core\Controller;
use Models\UserModel;
use Models\CourtModel;
use Models\BookingModel;
use Models\StaffModel;
use Models\ServiceModel;
use Models\PromotionModel;
use Models\RefundModel;
use Controllers\StaffController;
use Controllers\CourtController;

$passed = 0;
$failed = 0;

function assert_test(string $name, bool $condition, string $detail = '') {
    global $passed, $failed;
    if ($condition) {
        $passed++;
        echo "  [PASS] {$name}\n";
    } else {
        $failed++;
        echo "  [FAIL] {$name}" . ($detail ? " ({$detail})" : "") . "\n";
    }
}

echo "====================================================================\n";
echo "   KIỂM THỬ TỰ ĐỘNG KIẾN TRÚC BASE MODEL + BASE CONTROLLER (MVC)\n";
echo "====================================================================\n\n";

// [1] KIỂM TRA PSR-4 AUTOLOADER
echo "[1] KIỂM TRA PSR-4 AUTOLOADER...\n";
assert_test("Class Core\\Model tồn tại và nạp tự động", class_exists(Model::class));
assert_test("Class Core\\Controller tồn tại và nạp tự động", class_exists(Controller::class));
assert_test("Class Models\\UserModel nạp tự động", class_exists(UserModel::class));
assert_test("Class Models\\CourtModel nạp tự động", class_exists(CourtModel::class));
assert_test("Class Models\\BookingModel nạp tự động", class_exists(BookingModel::class));
assert_test("Class Models\\StaffModel nạp tự động", class_exists(StaffModel::class));
assert_test("Class Models\\ServiceModel nạp tự động", class_exists(ServiceModel::class));
assert_test("Class Models\\PromotionModel nạp tự động", class_exists(PromotionModel::class));
assert_test("Class Models\\RefundModel nạp tự động", class_exists(RefundModel::class));
assert_test("Class Controllers\\StaffController nạp tự động", class_exists(StaffController::class));
assert_test("Class Controllers\\CourtController nạp tự động", class_exists(CourtController::class));

// [2] KIỂM TRA KẾ THỪA VÀ CẤU HÌNH MODEL
echo "\n[2] KIỂM TRA KẾ THỪA VÀ CẤU HÌNH MODEL...\n";
$userModel = new UserModel();
$courtModel = new CourtModel();
$staffModel = new StaffModel();
$bookingModel = new BookingModel();

assert_test("UserModel kế thừa từ Core\\Model", $userModel instanceof Model);
assert_test("CourtModel kế thừa từ Core\\Model", $courtModel instanceof Model);
assert_test("StaffModel kế thừa từ Core\\Model", $staffModel instanceof Model);
assert_test("BookingModel kế thừa từ Core\\Model", $bookingModel instanceof Model);

assert_test("UserModel ánh xạ đúng bảng 'users'", $userModel->getTable() === 'users');
assert_test("CourtModel ánh xạ đúng bảng 'courts'", $courtModel->getTable() === 'courts');
assert_test("StaffModel ánh xạ đúng bảng 'owner_staff'", $staffModel->getTable() === 'owner_staff');
assert_test("BookingModel ánh xạ đúng bảng 'bookings'", $bookingModel->getTable() === 'bookings');

// [3] KIỂM TRA CÁC PHƯƠNG THỨC TRUY VẤN CỦA BASE MODEL
echo "\n[3] KIỂM TRA TRUY VẤN VÀ ĐỌC DỮ LIỆU CỦA BASE MODEL...\n";
$admin = $userModel->find(1);
assert_test("find(1) tìm thấy Quản trị viên BMT", $admin !== null && $admin['id'] == 1);
assert_test("Model tự động ẩn password_hash (bảo mật)", !isset($admin['password_hash']));

$allCourts = $courtModel->all();
assert_test("all() lấy được danh sách sân", is_array($allCourts) && count($allCourts) >= 4);

$activeCourts = $courtModel->where(['status' => 'active']);
assert_test("where(['status' => 'active']) lọc đúng sân hoạt động", count($activeCourts) > 0);

$courtsIn = $courtModel->whereIn('id', ['c01', 'c05', 'c10']);
assert_test("whereIn('id', [...]) lọc đúng 3 sân", count($courtsIn) === 3);

$firstFootball = $courtModel->first(['sport' => 'football']);
assert_test("first(['sport' => 'football']) lấy đúng sân bóng đá", $firstFootball !== null && $firstFootball['sport'] === 'football');

$userCount = $userModel->count();
assert_test("count() đếm chính xác số người dùng", $userCount >= 5);

$existsOwner = $userModel->exists(['role' => 'owner', 'email' => 'chusan@bmt24h.vn']);
assert_test("exists() kiểm tra tồn tại chủ sân chính xác", $existsOwner === true);

// [4] KIỂM TRA PHÂN TRANG (PAGINATION)
echo "\n[4] KIỂM TRA PHÂN TRANG CHUẨN CỦA BASE MODEL...\n";
$page1 = $bookingModel->paginate(1, 5, [], 'booking_date DESC');
assert_test("paginate() trả về cấu trúc data hợp lệ", isset($page1['data']) && is_array($page1['data']));
assert_test("paginate() lấy đúng 5 bản ghi mỗi trang", count($page1['data']) <= 5);
assert_test("paginate() chứa metadata phân trang (page, perPage, total, totalPages)", 
    isset($page1['pagination']['page']) && 
    $page1['pagination']['page'] === 1 && 
    $page1['pagination']['perPage'] === 5 && 
    $page1['pagination']['total'] > 0);

// [5] KIỂM TRA THÊM - SỬA - XÓA (CRUD) VÀ MASS ASSIGNMENT
echo "\n[5] KIỂM TRA CRUD VÀ BẢO VỆ MASS ASSIGNMENT...\n";
$testEmail = 'tester.' . time() . '@test.vn';
$newStaffId = 'st-test-' . substr(md5((string)time()), 0, 6);

// Create
$createdId = $staffModel->create([
    'id' => $newStaffId,
    'owner_id' => 2,
    'full_name' => 'Nhân viên Thử Nghiệm',
    'phone' => '0999 888 777',
    'email' => $testEmail,
    'role_name' => 'Thu ngân Test',
    'permissions' => json_encode(['bookings']),
    'status' => 'active',
    'malicious_field' => 'injection_hack', // Trường không nằm trong fillable -> phải bị loại bỏ
]);
assert_test("create() thêm bản ghi mới thành công", $createdId === $newStaffId);

// Check record
$createdRecord = $staffModel->find($newStaffId);
assert_test("find() tìm thấy nhân viên vừa tạo", $createdRecord !== null && $createdRecord['full_name'] === 'Nhân viên Thử Nghiệm');

// Update
$updated = $staffModel->update($newStaffId, [
    'full_name' => 'Nhân viên Đã Cập Nhật',
    'phone' => '0999 000 111',
]);
assert_test("update() cập nhật thông tin thành công", $updated === true);
$afterUpdate = $staffModel->find($newStaffId);
assert_test("Dữ liệu sau cập nhật khớp giá trị mới", $afterUpdate['full_name'] === 'Nhân viên Đã Cập Nhật' && $afterUpdate['phone'] === '0999 000 111');

// Delete
$deleted = $staffModel->delete($newStaffId);
assert_test("delete() xóa bản ghi thành công", $deleted === true);
$afterDelete = $staffModel->find($newStaffId);
assert_test("Bản ghi đã bị xóa hoàn toàn khỏi CSDL", $afterDelete === null);

// [6] KIỂM TRA VALIDATION ENGINE TRÊN BASE CONTROLLER
echo "\n[6] KIỂM TRA VALIDATION ENGINE TRÊN BASE CONTROLLER...\n";
$controller = new class extends Controller {
    public function setTestData(array $data) {
        $this->requestData = $data;
    }
    public function testValidation(array $rules, array $messages = []) {
        return $this->validate($rules, $messages);
    }
};

$controller->setTestData([
    'fullName' => 'Trần Văn A',
    'email' => 'valid.email@bmt24h.vn',
    'price' => '250000',
    'status' => 'active',
]);

$validResult = $controller->testValidation([
    'fullName' => 'required|min:3',
    'email' => 'required|email',
    'price' => 'required|numeric|min:10000',
    'status' => 'required|in:active,inactive',
]);

assert_test("Validation vượt qua khi dữ liệu hợp lệ", is_array($validResult) && count($validResult) === 4);
assert_test("Input helper str() trả về chuỗi chính xác", $controller->str('fullName') === 'Trần Văn A');
assert_test("Input helper int() trả về số nguyên", $controller->int('price') === 250000);
assert_test("Input helper has() kiểm tra sự tồn tại của field", $controller->has('email') === true);

// [7] KIỂM TRA PHƯƠNG THỨC NGHIỆP VỤ TRÊN CÁC MODEL CON
echo "\n[7] KIỂM TRA PHƯƠNG THỨC NGHIỆP VỤ TRÊN MODEL CON...\n";
$ownerStaff = $staffModel->getByOwner(2);
assert_test("StaffModel::getByOwner(2) lấy danh sách nhân sự của chủ sân 2", count($ownerStaff) >= 1);

$ownerCourts = $courtModel->getActiveCourtsByOwner(2);
assert_test("CourtModel::getActiveCourtsByOwner(2) lấy 4 cụm sân", count($ownerCourts) === 4);

$ownerCourtIds = $courtModel->getCourtIdsByOwner(2);
assert_test("CourtModel::getCourtIdsByOwner(2) trả về danh sách mã sân", in_array('c01', $ownerCourtIds));

// Thêm 1 đơn thử nghiệm trong ngày hôm nay để kiểm thử getTodayBookings & getTodayRevenue
$testTodayId = 'bk-test-today-' . substr(md5((string)time()), 0, 6);
$bookingModel->create([
    'id' => $testTodayId,
    'code' => 'TESTTODAY',
    'court_id' => 'c01',
    'court_name' => 'Sân bóng BMT Arena',
    'customer_name' => 'Khách Thử Nghiệm',
    'customer_phone' => '0901234567',
    'customer_email' => 'test@test.vn',
    'booking_date' => date('Y-m-d'),
    'start_slot' => '08:00',
    'duration_minutes' => 60,
    'slots' => json_encode(['08:00']),
    'total_price' => 150000,
    'deposit_amount' => 45000,
    'payment_method' => 'bank_transfer',
    'payment_status' => 'paid',
    'status' => 'confirmed',
]);

$todayBookings = $bookingModel->getTodayBookings($ownerCourtIds);
assert_test("BookingModel::getTodayBookings() lấy các đơn hôm nay", count($todayBookings) >= 1);

$todayRev = $bookingModel->getTodayRevenue($ownerCourtIds);
assert_test("BookingModel::getTodayRevenue() tính doanh thu hôm nay", $todayRev > 0);

// Dọn dẹp bản ghi thử nghiệm
$bookingModel->delete($testTodayId);

echo "\n====================================================================\n";
echo "   KẾT QUẢ KIỂM THỬ: {$passed} PASS / {$failed} FAIL\n";
echo "====================================================================\n";

if ($failed === 0) {
    echo "=> XUẤT SẮC: Kiến trúc Model cha & Controller cha hoạt động hoàn hảo 100%!\n";
} else {
    echo "=> Cần kiểm tra lại các ca thất bại ở trên.\n";
    exit(1);
}
