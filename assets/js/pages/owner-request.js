/**
 * Gửi yêu cầu trở thành chủ sân / Đăng ký sân (khách đã đăng nhập) — /dang-ky-chu-san
 * Hỗ trợ chọn và kéo thả nhiều hình ảnh bao quát sân (tối đa 10 ảnh).
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

    // Quản lý danh sách hình ảnh bao quát sân
    const input = form.querySelector('[data-images-input]');
    const dropzone = form.querySelector('[data-dropzone]');
    const previewWrapper = form.querySelector('[data-preview-wrapper]');
    const previewGrid = form.querySelector('[data-images-preview]');
    const counter = form.querySelector('[data-img-counter]');
    const clearBtn = form.querySelector('[data-clear-all-images]');

    let selectedFiles = [];
    const MAX_FILES = 10;
    const MAX_SIZE = 8 * 1024 * 1024; // 8MB

    const formatSize = (bytes) => {
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(0) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    };

    const renderPreviews = () => {
        if (!previewWrapper || !previewGrid) return;
        if (!selectedFiles.length) {
            previewWrapper.classList.add('hidden');
            previewGrid.innerHTML = '';
            return;
        }

        previewWrapper.classList.remove('hidden');
        if (counter) {
            counter.textContent = `Đã chọn ${selectedFiles.length} / ${MAX_FILES} ảnh sân`;
        }

        previewGrid.innerHTML = selectedFiles.map((file, idx) => {
            const blobUrl = URL.createObjectURL(file);
            const isCover = idx === 0;
            return `
              <div class="group relative flex flex-col overflow-hidden rounded-lg border border-background-200 bg-white shadow-sm transition-all hover:border-primary-400">
                <div class="relative aspect-video w-full overflow-hidden bg-background-100">
                  <img src="${blobUrl}" alt="${file.name}" class="h-full w-full object-cover">
                  ${isCover ? '<span class="absolute left-1.5 top-1.5 rounded bg-primary-600/90 px-1.5 py-0.5 text-[10px] font-bold text-white shadow-sm backdrop-blur">Ảnh bao quát chính</span>' : ''}
                  <button type="button" data-remove-img="${idx}" class="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white transition-colors hover:bg-accent-600 hover:text-white" title="Xóa ảnh này">
                    <i class="ri-close-line text-sm" aria-hidden="true"></i>
                  </button>
                </div>
                <div class="p-2 text-left">
                  <p class="truncate text-xs font-semibold text-foreground-900" title="${file.name}">${file.name}</p>
                  <p class="text-[11px] text-foreground-500">${formatSize(file.size)}</p>
                </div>
              </div>
            `;
        }).join('');
    };

    const addFiles = (fileList) => {
        const newFiles = Array.from(fileList || []);
        let addedCount = 0;
        let warning = '';

        for (const file of newFiles) {
            if (!file.type.startsWith('image/')) {
                warning = 'Chỉ chấp nhận các định dạng file ảnh (JPG, PNG, WEBP).';
                continue;
            }
            if (file.size > MAX_SIZE) {
                warning = `Ảnh "${file.name}" vượt quá dung lượng tối đa 8MB.`;
                continue;
            }
            if (selectedFiles.length >= MAX_FILES) {
                warning = `Bạn chỉ có thể tải lên tối đa ${MAX_FILES} hình ảnh bao quát sân.`;
                break;
            }
            // Tránh trùng lặp tên & kích thước
            const exists = selectedFiles.some((f) => f.name === file.name && f.size === file.size);
            if (!exists) {
                selectedFiles.push(file);
                addedCount++;
            }
        }

        if (warning) toast(warning, 'error');
        if (addedCount > 0) renderPreviews();
    };

    if (dropzone && input) {
        dropzone.addEventListener('click', () => input.click());

        input.addEventListener('change', () => {
            if (input.files && input.files.length) {
                addFiles(input.files);
                input.value = '';
            }
        });

        // Xử lý Kéo & thả file (Drag and Drop)
        ['dragenter', 'dragover'].forEach((eventName) => {
            dropzone.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
                dropzone.classList.add('border-primary-500', 'bg-primary-50/60');
            });
        });

        ['dragleave', 'dragend', 'drop'].forEach((eventName) => {
            dropzone.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
                dropzone.classList.remove('border-primary-500', 'bg-primary-50/60');
            });
        });

        dropzone.addEventListener('drop', (e) => {
            if (e.dataTransfer && e.dataTransfer.files) {
                addFiles(e.dataTransfer.files);
            }
        });
    }

    if (previewGrid) {
        previewGrid.addEventListener('click', (e) => {
            const btn = e.target.closest('[data-remove-img]');
            if (!btn) return;
            const idx = parseInt(btn.dataset.removeImg, 10);
            if (!isNaN(idx) && idx >= 0 && idx < selectedFiles.length) {
                selectedFiles.splice(idx, 1);
                renderPreviews();
            }
        });
    }

    if (clearBtn) {
        clearBtn.addEventListener('click', () => {
            selectedFiles = [];
            renderPreviews();
        });
    }

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
        setBusy(btn, true, 'Đang gửi yêu cầu & tải ảnh...');
        try {
            const formData = new FormData();
            formData.append('businessName', form.businessName.value.trim());
            formData.append('contactName', form.contactName.value.trim());
            formData.append('phone', phone);
            formData.append('address', form.address.value.trim());
            formData.append('sports', form.sports.value);
            formData.append('courtCount', form.courtCount.value || '1');
            formData.append('note', form.note.value.trim());

            // Đính kèm các file ảnh sân đã chọn
            selectedFiles.forEach((file) => {
                formData.append('court_images[]', file);
            });

            await api('account', 'owner_request', formData);
            toast('Đã gửi yêu cầu đăng ký sân kèm hình ảnh thành công! Quản trị viên sẽ xem xét trong 24 giờ.');
            setTimeout(() => window.location.reload(), 900);
        } catch (error) {
            formError.textContent = error.message;
            formError.classList.remove('hidden');
            setBusy(btn, false);
        }
    });
}
