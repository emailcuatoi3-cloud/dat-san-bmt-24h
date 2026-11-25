/**
 * CLIENT REALTIME MANAGER - ĐỒNG BỘ LỊCH SÂN THỜI GIAN THỰC
 * - Kết nối qua HTML5 Server-Sent Events (SSE) với api/realtime-slots.php
 * - Tự động phát hiện khi có slot mới bị đặt (justTaken) hoặc slot vừa được mở lại (justFreed)
 * - Tự động fallback sang Adaptive Polling thông minh nếu mạng/proxy chặn SSE
 * - Giảm tần suất khi tab ẩn (Page Visibility API) để tiết kiệm tài nguyên
 */

import { url, toast } from './ui.js';

export function subscribeSlots({
  date,
  courtId = '',
  onUpdate,
  onSlotTaken,
  onSlotFreed,
  onStatusChange,
} = {}) {
  let currentDate = date || new Date().toISOString().slice(0, 10);
  let currentCourtId = courtId;
  let lastHash = '';
  let prevCourtTaken = null;
  let isUnsubscribed = false;

  let eventSource = null;
  let pollTimer = null;
  let isPollingFallback = false;
  let pollIntervalMs = 3000;

  // Lấy danh sách khung giờ bị chiếm của sân đang theo dõi
  function extractCourtTaken(occupied = {}, blocked = {}) {
    if (!currentCourtId) {
      // Nếu không chỉ định courtId, gom toàn bộ
      const allOcc = Object.values(occupied).flat();
      const allBlk = Object.values(blocked).flat();
      return Array.from(new Set([...allOcc, ...allBlk]));
    }
    const occ = Array.isArray(occupied[currentCourtId]) ? occupied[currentCourtId] : [];
    const blkKey = `${currentCourtId}:${currentDate}`;
    const blk = Array.isArray(blocked[blkKey]) ? blocked[blkKey] : [];
    return Array.from(new Set([...occ, ...blk]));
  }

  // Xử lý dữ liệu trả về từ server (cả SSE và Poll)
  function handlePayload(data) {
    if (isUnsubscribed || !data) return;

    const occupied = data.occupied || {};
    const blocked = data.blocked || {};
    const newTaken = extractCourtTaken(occupied, blocked);

    let justTaken = [];
    let justFreed = [];

    if (prevCourtTaken !== null) {
      justTaken = newTaken.filter((slot) => !prevCourtTaken.includes(slot));
      justFreed = prevCourtTaken.filter((slot) => !newTaken.includes(slot));
    }

    prevCourtTaken = newTaken;
    lastHash = data.hash || lastHash;

    if (typeof onUpdate === 'function') {
      onUpdate({
        occupied,
        blocked,
        date: currentDate,
        hash: lastHash,
        allTaken: newTaken,
        justTaken,
        justFreed,
      });
    }

    if (justTaken.length > 0 && typeof onSlotTaken === 'function') {
      onSlotTaken(justTaken);
    }

    if (justFreed.length > 0 && typeof onSlotFreed === 'function') {
      onSlotFreed(justFreed);
    }
  }

  // Khởi động kết nối SSE
  function startSse() {
    if (isUnsubscribed) return;

    if (typeof window.EventSource === 'undefined') {
      startPollingFallback();
      return;
    }

    cleanupConnection();

    const sseUrl = url(
      `/api/realtime-slots.php?stream=1&date=${encodeURIComponent(currentDate)}${
        currentCourtId ? `&court=${encodeURIComponent(currentCourtId)}` : ''
      }&lastHash=${encodeURIComponent(lastHash)}`
    );

    let sseErrorCount = 0;
    try {
      eventSource = new EventSource(sseUrl);

      eventSource.addEventListener('open', () => {
        sseErrorCount = 0;
        console.log('[Realtime] Đã kết nối luồng thời gian thực SSE:', currentDate);
        if (typeof onStatusChange === 'function') {
          onStatusChange('connected', 'sse');
        }
      });

      eventSource.addEventListener('slots_update', (e) => {
        try {
          const data = JSON.parse(e.data);
          handlePayload(data);
        } catch (err) {
          console.warn('[Realtime SSE] Parse error:', err);
        }
      });

      eventSource.addEventListener('cycle', (e) => {
        try {
          const data = JSON.parse(e.data);
          if (data && data.hash) lastHash = data.hash;
        } catch { }
      });

      eventSource.onerror = () => {
        sseErrorCount++;
        // Sau 2 lần lỗi SSE liên tiếp (ví dụ do Apache buffer hoặc mạng), tự động chuyển sang Polling fallback 2.5s
        if (!isPollingFallback) {
          if (typeof onStatusChange === 'function') {
            onStatusChange('reconnecting', 'sse');
          }
          if (sseErrorCount >= 2) {
            startPollingFallback();
          }
        }
      };
    } catch {
      startPollingFallback();
    }
  }

  // Khởi động chế độ Fallback Polling (khi SSE bị chặn hoặc lỗi)
  function startPollingFallback() {
    if (isUnsubscribed || isPollingFallback) return;
    isPollingFallback = true;
    cleanupSse();
    console.log('[Realtime] Đang chạy chế độ Adaptive Polling (chu kỳ 3s)');

    if (typeof onStatusChange === 'function') {
      onStatusChange('connected', 'poll');
    }

    scheduleNextPoll(100);
  }

  async function executePoll() {
    if (isUnsubscribed) return;

    try {
      const pollUrl = url(
        `/api/realtime-slots.php?date=${encodeURIComponent(currentDate)}${
          currentCourtId ? `&court=${encodeURIComponent(currentCourtId)}` : ''
        }&lastHash=${encodeURIComponent(lastHash)}&_t=${Date.now()}`
      );

      const res = await fetch(pollUrl, { credentials: 'same-origin' });
      if (res.ok) {
        const json = await res.json();
        if (json && json.success && json.changed) {
          handlePayload(json);
        }
      }
    } catch { }

    // Điều chỉnh tần suất khi tab ẩn
    const delay = document.hidden ? pollIntervalMs * 3 : pollIntervalMs;
    scheduleNextPoll(delay);
  }

  function scheduleNextPoll(delay) {
    if (isUnsubscribed) return;
    clearTimeout(pollTimer);
    pollTimer = setTimeout(executePoll, delay);
  }

  function cleanupSse() {
    if (eventSource) {
      try {
        eventSource.close();
      } catch { }
      eventSource = null;
    }
  }

  function cleanupConnection() {
    cleanupSse();
    clearTimeout(pollTimer);
  }

  // Lắng nghe sự kiện chuyển tab (Visibility) để tiết kiệm tài nguyên
  const handleVisibilityChange = () => {
    if (document.hidden) {
      pollIntervalMs = 8000;
    } else {
      pollIntervalMs = 3000;
      // Khi người dùng quay lại tab, kiểm tra ngay lập tức
      if (isPollingFallback) {
        scheduleNextPoll(50);
      }
    }
  };
  document.addEventListener('visibilitychange', handleVisibilityChange);

  // Bắt đầu luồng
  startSse();

  return {
    setDate(newDate) {
      if (newDate === currentDate) return;
      currentDate = newDate;
      lastHash = '';
      prevCourtTaken = null;
      if (isPollingFallback) {
        scheduleNextPoll(50);
      } else {
        startSse();
      }
    },
    setCourt(newCourtId) {
      if (newCourtId === currentCourtId) return;
      currentCourtId = newCourtId;
      prevCourtTaken = null;
      if (isPollingFallback) {
        scheduleNextPoll(50);
      } else {
        startSse();
      }
    },
    refreshNow() {
      if (isPollingFallback) {
        scheduleNextPoll(10);
      } else {
        startSse();
      }
    },
    unsubscribe() {
      isUnsubscribed = true;
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      cleanupConnection();
      if (typeof onStatusChange === 'function') {
        onStatusChange('disconnected', 'none');
      }
    },
  };
}

/**
 * Tạo huy hiệu hiển thị trạng thái Real-time trực quan trên giao diện
 */
export function createLivePulseBadge(label = 'Trực tiếp') {
  const span = document.createElement('span');
  span.className =
    'inline-flex items-center gap-1.5 rounded-full border border-primary-300 bg-primary-50 px-2.5 py-0.5 text-[11px] font-semibold text-primary-800 shadow-2xs transition-all';
  span.innerHTML = `
    <span class="relative flex h-2 w-2">
      <span class="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary-400 opacity-75"></span>
      <span class="relative inline-flex h-2 w-2 rounded-full bg-primary-500"></span>
    </span>
    <span data-live-text>${label}</span>
  `;
  return span;
}
