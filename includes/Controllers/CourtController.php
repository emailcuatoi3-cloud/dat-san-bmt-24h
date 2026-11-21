<?php
namespace Controllers;

use Core\Controller;
use Models\CourtModel;

/**
 * Controller quản lý cụm sân thể thao của chủ sân.
 */
class CourtController extends Controller
{
    protected CourtModel $courtModel;

    public function __construct()
    {
        parent::__construct();
        $this->courtModel = new CourtModel();
    }

    /**
     * Lấy danh sách sân của chủ sân (sân đang chạy & thùng rác).
     */
    public function actionList(): void
    {
        $owner = $this->requireOwner();
        $ownerId = (int)$owner['id'];

        $courts = $this->courtModel->getActiveCourtsByOwner($ownerId);
        $trash = $this->courtModel->getTrashCourtsByOwner($ownerId);

        $this->json([
            'courts' => $courts,
            'trash' => $trash,
        ]);
    }

    /**
     * Chuyển đổi trạng thái sân (Hoạt động / Tạm dừng).
     */
    public function actionStatus(): void
    {
        $owner = $this->requireOwner();
        $this->requireStaffPermission('courts');

        $id = $this->str('id');
        $status = $this->str('status') === 'paused' ? 'paused' : 'active';

        $court = $this->courtModel->find($id);
        if (!$court || (int)$court['owner_id'] !== (int)$owner['id']) {
            $this->error('Không tìm thấy sân trong danh sách quản lý của bạn.', 404);
        }

        $this->courtModel->update($id, ['status' => $status]);
        $this->json(['id' => $id, 'status' => $status], 200, 'Đã cập nhật trạng thái sân.');
    }

    /**
     * Đưa sân vào thùng rác (Soft delete).
     */
    public function actionTrash(): void
    {
        $owner = $this->requireOwner();
        $this->requireStaffPermission('courts');

        $id = $this->str('id');
        $success = $this->courtModel->softDelete($id, (int)$owner['id']);

        if (!$success) {
            $this->error('Không thể chuyển sân vào thùng rác.', 400);
        }
        $this->json(true, 200, 'Đã chuyển sân vào thùng rác.');
    }

    /**
     * Khôi phục sân từ thùng rác.
     */
    public function actionRestore(): void
    {
        $owner = $this->requireOwner();
        $this->requireStaffPermission('courts');

        $id = $this->str('id');
        $success = $this->courtModel->restore($id, (int)$owner['id']);

        if (!$success) {
            $this->error('Không thể khôi phục sân.', 400);
        }
        $this->json(true, 200, 'Đã khôi phục sân thành công.');
    }
}

