/**
 * Gửi yêu cầu trở thành chủ sân (khách đã đăng nhập) — /dang-ky-chu-san
 */
import { $, api, setBusy, toast } from '../core/ui.js';

const form = $('#owner-request-form');
if (form) {
    const setError = (name, msg) => {
        const box = form.querySelector(`[data-field="${name}"] [data-error]`);
        if (!box) return;
        box.textContent = msg || '';
        box.classList.toggle('hidden', !msg);
    };
    const formError = $('[data-form-error]', form);

    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        const phone = form.phone.value.replace(/[^\d+]/g, '');
        const errors = {
            businessName: form.businessName.value.trim().length < 3 ? 'Vui lòng nhập tên sân hoặc cơ sở của bạn.' : '',
            contactName: form.contactName.value.trim().length < 2 ? 'Vui lòng nhập họ tên người phụ trách.' : '',
            phone: !/^0\d{9,10}$/.test(phone) && !/^\+84\d{9,10}$/.test(phone) ? 'Số điện thoại chưa đúng (ví dụ 0912 345 678).' : '',
            address: form.address.value.trim().length < 8 ? 'Vui lòng nhập địa chỉ sân đầy đủ (số nhà, đường, phường).' : '',
        };
        Object.entries(errors).forEach(([k, v]) => setError(k, v));
        formError.classList.add('hidden');
        if (!form.agree.checked) {
            formError.textContent = 'Bạn cần xác nhận thông tin và đồng ý với điều khoản đối tác.';
            formError.classList.remove('hidden');
            return;
        }
        if (Object.values(errors).some(Boolean)) return;

        const btn = $('button[type=submit]', form);
        setBusy(btn, true, 'Đang gửi...');
        try {
            await api('account', 'owner_request', {
                businessName: form.businessName.value.trim(),
                contactName: form.contactName.value.trim(),
                phone,
                address: form.address.value.trim(),
                sports: form.sports.value,
                courtCount: Number(form.courtCount.value) || 1,
                note: form.note.value.trim(),
            });
            toast('Đã gửi yêu cầu! Quản trị viên sẽ phản hồi trong 24 giờ.');
            setTimeout(() => window.location.reload(), 900);
        } catch (error) {
            formError.textContent = error.message;
            formError.classList.remove('hidden');
            setBusy(btn, false);
        }
    });
}