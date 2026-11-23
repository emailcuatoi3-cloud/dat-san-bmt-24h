<?php
namespace Controllers;

use Core\Controller;
use Models\StaffModel;
use Models\UserModel;

/**
 * Controller quản lý tài khoản & phân quyền nhân viên cơ sở.
 * Kế thừa toàn bộ sức mạnh từ Base Controller.
 */
class StaffController extends Controller
{
    protected StaffModel $staffModel;
    protected UserModel $userModel;

    public function __construct()
    {
        parent::__construct();
        $this->staffModel = new StaffModel();
        $this->userModel = new UserModel();
    }

    /**
     * Lấy danh sách nhân viên của chủ sân đang đăng nhập.
     * GET/POST ?action=staff_list
     */
    public function actionList(): void
    {
        $owner = $this->requireOwner();
        if ($this->isStaff()) {
            $this->error('Nhân viên không có quyền quản lý nhân sự cơ sở.', 403);
        }

        $list = $this->staffModel->getByOwner((int)$owner['id']);
        $this->json($list);
    }

    /**
     * Thêm mới hoặc cập nhật thông tin nhân viên.
     * POST ?action=staff_save
     */
    public function actionSave(): void
    {
        $owner = $this->requireOwner();
        if ($this->isStaff()) {
            $this->error('Nhân viên không có quyền thực hiện thao tác này.', 403);
        }

        // Validate dữ liệu chuyên nghiệp thông qua Controller cha
        $this->validate([
            'fullName' => 'required|min:2',
            'email' => 'required|email',
        ], [
            'fullName.required' => 'Vui lòng nhập họ tên nhân viên.',
            'fullName.min' => 'Họ tên nhân viên tối thiểu 2 ký tự.',
            'email.required' => 'Vui lòng nhập email đăng nhập.',
            'email.email' => 'Email không đúng định dạng.',
        ]);

        $id = $this->str('id');
        $email = strtolower($this->str('email'));
        $ownerId = (int)$owner['id'];

        // Kiểm tra trùng email với tài khoản hệ thống hoặc nhân viên khác
        if ($this->userModel->exists(['email' => $email])) {
            $this->error('Email này đã được sử dụng bởi một tài khoản trên hệ thống.');
        }
        if ($this->staffModel->isEmailTaken($email, $id ?: null)) {
            $this->error('Email này đã được gán cho nhân viên khác.');
        }

        $permissions = $this->arr('permissions');
        $status = $this->str('status') === 'inactive' ? 'inactive' : 'active';
        $password = $this->str('password');

        $data = [
            'owner_id' => $ownerId,
            'full_name' => $this->str('fullName'),
            'role_name' => $this->str('roleName', 'Nhân viên lễ tân'),
            'phone' => preg_replace('/[^\d+]/', '', $this->str('phone')),
            'email' => $email,
            'permissions' => json_encode(array_values($permissions), JSON_UNESCAPED_UNICODE),
            'status' => $status,
        ];

        if ($password !== '') {
            if (mb_strlen($password) < 6) {
                $this->error('Mật khẩu tối thiểu phải từ 6 ký tự.');
            }
            $data['password_hash'] = password_hash($password, PASSWORD_BCRYPT);
        }

        if (!empty($id)) {
            // Cập nhật
            $existing = $this->staffModel->find($id);
            if (!$existing || (int)$existing['owner_id'] !== $ownerId) {
                $this->error('Không tìm thấy nhân viên trong cơ sở của bạn.', 404);
            }
            $this->staffModel->update($id, $data);
            $this->json(['id' => $id], 200, 'Đã cập nhật thông tin nhân viên.');
        } else {
            // Thêm mới
            if (empty($password)) {
                $this->error('Vui lòng nhập mật khẩu khởi tạo cho nhân viên mới.');
            }
            $data['id'] = uid('st-');
            $data['created_at'] = date('Y-m-d H:i:s');
            $newId = $this->staffModel->create($data);
            $this->json(['id' => $newId], 201, 'Đã tạo tài khoản nhân viên thành công.');
        }
    }

    /**
     * Xóa tài khoản nhân viên.
     * POST ?action=staff_delete
     */
    public function actionDelete(): void
    {
        $owner = $this->requireOwner();
        if ($this->isStaff()) {
            $this->error('Nhân viên không có quyền xóa nhân sự.', 403);
        }

        $id = $this->str('id');
        if (empty($id)) {
            $this->error('Thiếu mã nhân viên cần xóa.');
        }

        $existing = $this->staffModel->find($id);
        if (!$existing || (int)$existing['owner_id'] !== (int)$owner['id']) {
            $this->error('Không tìm thấy nhân viên trong cơ sở của bạn.', 404);
        }

        $this->staffModel->delete($id);
        $this->json(true, 200, 'Đã xóa tài khoản nhân viên thành công.');
    }
}

