/**
 * Trợ lý tư vấn AI (BMT 24H) — nút nổi góc phải dưới trên mọi trang.
 * Hỗ trợ:
 * - Lưu và quản lý lịch sử các cuộc trò chuyện (Chat History) trực tiếp trên giao diện website.
 * - Cho phép xem lại toàn bộ các đoạn chat cũ, mở lại hoặc xóa từng đoạn chat.
 * - Khởi tạo đoạn chat mới mà không làm mất các cuộc hội thoại trước đó.
 * - Đồng bộ lịch sử qua localStorage và CSDL máy chủ (không mất khi chuyển trang hay refresh F5).
 * - Cập nhật DOM trực tiếp, mượt mà, không gián đoạn giao diện khi bấm câu hỏi gợi ý.
 */
import { APP, api, esc, url, formatVnd, toast } from './ui.js';
import { HOTLINE } from '../lib/payment.js';

const root = document.getElementById('chatbot-root');
const aiCfg = APP.ai || {};

if (root && aiCfg.enabled !== false) {
  // Tách biệt lịch sử theo tài khoản người dùng đăng nhập; khách vãng lai dùng 'guest'
  const currentUserId = (APP.user && APP.user.id) ? String(APP.user.id) : 'guest';
  const STORAGE_KEY_SESSIONS = `bmt24h_chatbot_sessions_${currentUserId}`;
  const STORAGE_KEY_ACTIVE_ID = `bmt24h_chatbot_active_${currentUserId}`;
  const STORAGE_KEY_OPEN = `bmt24h_chatbot_open_${currentUserId}`;

  // Dọn dẹp triệt để các khóa cũ dùng chung không phân biệt tài khoản để chống rò rỉ lịch sử sau khi đăng xuất
  try {
    localStorage.removeItem('bmt24h_chatbot_sessions');
    localStorage.removeItem('bmt24h_chatbot_messages');
    localStorage.removeItem('bmt24h_chatbot_active_id');
    localStorage.removeItem('bmt24h_chatbot_open');
  } catch (e) {}

  const QUICK = Array.isArray(aiCfg.quickReplies) && aiCfg.quickReplies.length
    ? aiCfg.quickReplies
    : ['Xem giá sân', 'Sân trống tối nay', 'Cách đặt sân', 'Chính sách hủy', 'Vòng quay ưu đãi'];
  const botName = aiCfg.botName || 'Trợ lý AI BMT 24H';
  const customQa = Array.isArray(aiCfg.customQa) ? aiCfg.customQa : [];
  const defaultGreeting = aiCfg.greeting || 'Chào bạn, mình là trợ lý của Đặt Sân BMT 24H. Bạn cần hỏi về giá sân, khung giờ trống hay cách đặt sân?';

  function createSessionObj(title = 'Đoạn chat mới', initialMessages = null) {
    const now = Date.now();
    return {
      id: 'sess_' + now + '_' + Math.random().toString(36).slice(2, 6),
      title: title,
      createdAt: now,
      updatedAt: now,
      messages: initialMessages || [{ from: 'bot', text: defaultGreeting }],
    };
  }

  function loadSessions() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_SESSIONS);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch (e) {
      console.warn('Lỗi đọc danh sách phiên chatbot:', e);
    }
    const initial = [createSessionObj()];
    saveSessionsToStorage(initial);
    return initial;
  }

  function saveSessionsToStorage(sessions) {
    try {
      const trimmed = sessions.slice(0, 30).map((s) => ({
        ...s,
        messages: (s.messages || []).slice(-40),
      }));
      localStorage.setItem(STORAGE_KEY_SESSIONS, JSON.stringify(trimmed));
    } catch (e) {
      console.warn('Lỗi lưu danh sách phiên chatbot:', e);
    }
  }

  function loadActiveSessionId(sessions) {
    try {
      const id = localStorage.getItem(STORAGE_KEY_ACTIVE_ID);
      if (id && sessions.some((s) => s.id === id)) {
        return id;
      }
    } catch (e) {}
    return sessions[0] ? sessions[0].id : '';
  }

  function saveActiveSessionId(id) {
    try {
      localStorage.setItem(STORAGE_KEY_ACTIVE_ID, id);
    } catch (e) {}
  }

  function loadSavedOpen() {
    try {
      return localStorage.getItem(STORAGE_KEY_OPEN) === '1';
    } catch (e) {
      return false;
    }
  }

  function saveOpen(isOpen) {
    try {
      localStorage.setItem(STORAGE_KEY_OPEN, isOpen ? '1' : '0');
    } catch (e) {}
  }

  function formatTime(timestamp) {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    const timeStr = date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
    if (isToday) {
      return `Hôm nay ${timeStr}`;
    }
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    return `${day}/${month} ${timeStr}`;
  }

  function migrateGuestSessions(userSessions) {
    if (currentUserId === 'guest') return { sessions: userSessions, migratedActiveId: '' };
    try {
      const rawGuest = localStorage.getItem('bmt24h_chatbot_sessions_guest');
      if (!rawGuest) return { sessions: userSessions, migratedActiveId: '' };
      const parsedGuest = JSON.parse(rawGuest);
      if (!Array.isArray(parsedGuest)) return { sessions: userSessions, migratedActiveId: '' };

      const guestWithMsgs = parsedGuest.filter(
        (s) => s && Array.isArray(s.messages) && s.messages.some((m) => m.from === 'user')
      );
      if (guestWithMsgs.length === 0) return { sessions: userSessions, migratedActiveId: '' };

      const map = new Map();
      userSessions.forEach((s) => {
        if (s && s.id) map.set(s.id, s);
      });
      guestWithMsgs.forEach((gs) => {
        if (gs && gs.id && !map.has(gs.id)) {
          map.set(gs.id, gs);
        }
      });

      const merged = Array.from(map.values())
        .filter((s) => (s.messages || []).some((m) => m.from === 'user'))
        .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));

      const finalSessions = merged.length > 0 ? merged : userSessions;
      saveSessionsToStorage(finalSessions);

      const guestActiveId = localStorage.getItem('bmt24h_chatbot_active_guest') || '';
      const targetActiveId = (guestActiveId && finalSessions.some((s) => s.id === guestActiveId))
        ? guestActiveId
        : (guestWithMsgs[0] ? guestWithMsgs[0].id : '');

      if (targetActiveId) {
        saveActiveSessionId(targetActiveId);
      }

      // Dọn dẹp bộ nhớ tạm của khách sau khi đã chuyển sang tài khoản đăng nhập
      localStorage.removeItem('bmt24h_chatbot_sessions_guest');
      localStorage.removeItem('bmt24h_chatbot_active_guest');
      localStorage.removeItem('bmt24h_chatbot_open_guest');

      return { sessions: finalSessions, migratedActiveId: targetActiveId, migratedIds: guestWithMsgs.map((s) => s.id) };
    } catch (e) {
      console.warn('Lỗi chuyển lịch sử chat từ khách sang tài khoản:', e);
      return { sessions: userSessions, migratedActiveId: '', migratedIds: [] };
    }
  }

  let sessions = loadSessions();
  const migration = migrateGuestSessions(sessions);
  sessions = migration.sessions;
  const migratedGuestIds = migration.migratedIds || [];
  let activeId = migration.migratedActiveId || loadActiveSessionId(sessions);

  const getActiveSession = () => {
    let cur = sessions.find((s) => s.id === activeId);
    if (!cur) {
      cur = sessions[0] || createSessionObj();
      activeId = cur.id;
      saveActiveSessionId(activeId);
    }
    return cur;
  };

  const st = {
    open: loadSavedOpen(),
    view: 'chat', // 'chat' | 'history'
    typing: false,
  };

  let courts = null;

  const normalize = (v) => v.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').toLowerCase().trim();

  async function reply(raw) {
    const t = normalize(raw);
    if (!t) return { text: 'Bạn muốn hỏi mình điều gì về sân bóng đá hoặc cầu lông tại Buôn Ma Thuột?' };
    for (const qa of customQa) {
      const kws = String(qa.keywords || '').split(',').map((k) => normalize(k)).filter(Boolean);
      if (kws.length && kws.some((k) => t.includes(k))) {
        return { text: String(qa.answer || '') };
      }
    }
    if (t.includes('gia') || t.includes('bao nhieu') || t.includes('phi'))
      return {
        text: 'Giá thuê tại Buôn Ma Thuột dao động 150.000đ - 350.000đ/giờ với sân bóng đá (sân 5 rẻ hơn sân 7, 11) và 65.000đ - 130.000đ/giờ với sân cầu lông. Giá đã niêm yết theo từng sân, khung 17:00 - 21:00 có thể phụ thu 10%.',
        links: [['Xem sân bóng đá', '/tim-san?sport=football'], ['Xem sân cầu lông', '/tim-san?sport=badminton']],
      };
    if (['gio mo', 'may gio', 'mo cua', 'hoat dong'].some((k) => t.includes(k)))
      return { text: 'Các sân trong hệ thống đều mở cửa từ 05:00 và đóng lúc 21:30 - 23:00 tùy sân, không có sân nào hoạt động qua đêm. Giờ mở cửa chi tiết có trên trang từng sân.' };
    if (t.includes('huy') || t.includes('hoan') || t.includes('coc'))
      return {
        text: `Chính sách hoàn cọc: bạn hủy được và hoàn 100% tiền cọc khi còn cách giờ chơi từ 4 giờ trở lên. Trong 4 giờ cuối, nút hủy sẽ khóa, bạn gọi hotline ${HOTLINE} để chủ sân hỗ trợ. Lỗi từ phía sân thì hoàn 100%. Bạn có thể hủy trong mục "Đơn sắp tới" ở trang tài khoản.`,
        links: [['Mở tài khoản của tôi', '/tai-khoan?tab=upcoming']],
      };
    if (t.includes('bong') && (t.includes('thue') || t.includes('muon')))
      return { text: 'Hầu hết sân đều tặng kèm bóng và lưới khi thuê sân. Áo bib cho thuê 10.000đ/bộ, bơm bóng miễn phí. Sân cầu lông cho thuê vợt 20.000đ/cây, bán ống cầu từ 80.000đ.' };
    if (t.includes('xe') || t.includes('giu xe'))
      return { text: 'Tất cả sân trong hệ thống đều có bãi giữ xe, phần lớn miễn phí cho khách đặt sân. Bạn nên tới sớm 10 phút để gửi xe và khởi động.' };
    if (t.includes('toi nay') || t.includes('toi') || t.includes('trong') || t.includes('con san')) {
      if (!courts) courts = await api('booking', 'tonight', {}, 'GET').catch(() => []);
      const sport = t.includes('cau long') ? 'badminton' : t.includes('bong') ? 'football' : '';
      const open = courts.filter((c) => (!sport || c.sport === sport) && c.freeSlots.length).sort((a, b) => b.freeSlots.length - a.freeSlots.length).slice(0, 2);
      if (open.length) return { text: `Tối nay mình tìm được ${open.length} sân còn khung giờ trống. Bạn bấm "Đặt sân" để giữ chỗ ngay nhé:`, courts: open };
      return { text: 'Tối nay các sân đã kín khung giờ đẹp. Bạn thử khung 21:00 - 22:00 hoặc chuyển sang ngày mai, mình gợi ý sân còn trống nhé.', links: [['Tìm sân còn trống', '/tim-san']] };
    }
    if (['chia doi', 'ngau nhien', 'random', 'quay'].some((k) => t.includes(k)))
      return { text: 'Trang "Ngẫu nhiên" có chia đội bóng đá, ghép cặp đánh đôi cầu lông, chọn sân giúp bạn và vòng quay ưu đãi. Rất tiện khi cả nhóm chưa biết chia đội thế nào.', links: [['Mở trang Ngẫu nhiên', '/ngau-nhien']] };
    if (['ban do', 'gan toi', 'vi tri'].some((k) => t.includes(k)))
      return { text: 'Trang Bản đồ hiển thị toàn bộ sân tại Buôn Ma Thuột. Bạn chọn một sân ở danh sách bên dưới, bản đồ sẽ tự di chuyển tới vị trí sân đó.', links: [['Mở bản đồ sân', '/ban-do']] };
    if (t.includes('dat') || t.includes('quy trinh') || t.includes('cach'))
      return { text: 'Đặt sân chỉ 3 bước: (1) chọn ngày và khung giờ còn trống, (2) điền họ tên và số điện thoại, (3) xác nhận để nhận mã đặt sân. Không bắt buộc tạo tài khoản.', links: [['Đặt sân ngay', '/dat-san']] };
    if (['nhan vien', 'hotline', 'goi', 'zalo', 'lien he'].some((k) => t.includes(k)))
      return { text: `Bạn gọi hotline ${HOTLINE} (hỗ trợ 24/7) hoặc nhắn Zalo cùng số để gặp nhân viên trực. Nếu cần gửi yêu cầu dài, bạn dùng trang Liên hệ nhé.`, links: [['Trang liên hệ', '/lien-he']] };
    if (!courts) courts = await api('booking', 'tonight', {}, 'GET').catch(() => []);
    const cheapest = [...courts].sort((a, b) => a.pricePerHour - b.pricePerHour)[0];
    return {
      text: aiCfg.fallbackReply
        ? `${aiCfg.fallbackReply}${cheapest ? ` Ví dụ: sân rẻ nhất hiện là ${cheapest.name} (${formatVnd(cheapest.pricePerHour)}/giờ).` : ''}`
        : `Mình chưa chắc đã hiểu đúng câu này. Bạn có thể hỏi về giá, giờ mở cửa, chính sách hủy, thuê bóng/vợt hoặc sân trống tối nay.${cheapest ? ` Ví dụ: sân rẻ nhất hiện là ${cheapest.name} với ${formatVnd(cheapest.pricePerHour)}/giờ.` : ''}`,
      links: [[`Gọi hotline ${HOTLINE}`, '/lien-he']],
    };
  }

  function formatAiText(str) {
    if (!str) return '';
    return esc(str)
      .replace(/\*\*(.+?)\*\*/g, '<strong class="font-semibold text-foreground-950">$1</strong>')
      .replace(/^\s*[\*\-]\s+(.+)$/gm, '&bull; $1');
  }

  function messageHtml(m) {
    const user = m.from === 'user';
    return `<div class="flex ${user ? 'justify-end' : 'justify-start'} animate-fade-in"><div class="max-w-[85%] rounded-lg px-3 py-2 text-xs md:text-sm leading-relaxed ${user ? 'rounded-br-sm bg-primary-500 text-white shadow-xs' : 'rounded-bl-sm border border-background-200 bg-background-50 text-foreground-800 shadow-xs'}">
      <div class="whitespace-pre-wrap">${user ? esc(m.text) : formatAiText(m.text)}</div>
      ${m.courts ? `<div class="mt-2 space-y-1.5">${m.courts.map((c) => `<a href="${url(`/dat-san/${c.slug}`)}" class="flex items-center gap-2 rounded-md border border-background-200 bg-background-100 p-1.5 transition-colors hover:border-primary-400"><span class="h-9 w-9 shrink-0 overflow-hidden rounded-md"><img src="${esc(c.image)}" alt="${esc(c.name)}" class="h-full w-full object-cover object-top"></span><span class="min-w-0 flex-1"><span class="block truncate text-xs font-semibold text-foreground-950">${esc(c.name)}</span><span class="block text-[11px] text-foreground-500">${formatVnd(c.pricePerHour)}/giờ • ${esc(c.area)}</span></span><i class="ri-arrow-right-s-line text-foreground-400" aria-hidden="true"></i></a>`).join('')}</div>` : ''}
      ${m.links ? `<div class="mt-1.5 flex flex-wrap gap-1">${m.links.map(([l, to]) => `<a href="${url(to)}" class="rounded-full border border-primary-300 bg-primary-50 px-2 py-0.5 text-[11px] font-semibold text-primary-700 transition-colors hover:bg-primary-100">${esc(l)}</a>`).join('')}</div>` : ''}
    </div></div>`;
  }

  const activeSess = getActiveSession();

  // Khởi dựng khung giao diện chính (nhỏ gọn, thanh thoát, cố định kích thước 360px x 490px)
  root.innerHTML = `
    <section data-chat-panel aria-label="Trợ lý tư vấn đặt sân" class="${st.open ? '' : 'hidden'} fixed bottom-4 right-4 z-[95] flex max-w-sm flex-col overflow-hidden rounded-xl border border-background-200 bg-background-100 shadow-2xl transition-all duration-200" style="width: 360px; max-width: calc(100vw - 2rem); height: 490px; max-height: calc(100vh - 5rem);">
      
      <!-- HEADER KHUNG CHAT (CHUYỂN ĐỔI THEO VIEW) -->
      <header data-header-chat class="flex items-center gap-2 border-b border-background-200 bg-background-50 px-3 py-2">
        <span class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-500 text-white shadow-xs"><i class="ri-customer-service-2-line text-base" aria-hidden="true"></i></span>
        <div class="min-w-0 flex-1">
          <p class="truncate font-heading text-xs font-bold text-foreground-950">${esc(botName)}</p>
          <p class="flex items-center gap-1 text-[11px] text-foreground-500"><span class="h-1.5 w-1.5 rounded-full bg-primary-500 animate-pulse"></span>Trả lời tự động 24/7</p>
        </div>
        <button type="button" data-action-history title="Xem lịch sử trò chuyện" aria-label="Lịch sử chat" class="flex h-7 w-7 cursor-pointer items-center justify-center rounded text-foreground-600 transition-colors hover:bg-background-200 hover:text-primary-600"><i class="ri-history-line text-sm" aria-hidden="true"></i></button>
        <button type="button" data-action-new-chat title="Bắt đầu đoạn chat mới" aria-label="Đoạn chat mới" class="flex h-7 w-7 cursor-pointer items-center justify-center rounded text-foreground-600 transition-colors hover:bg-background-200 hover:text-primary-600"><i class="ri-chat-new-line text-sm" aria-hidden="true"></i></button>
        <button type="button" data-action-close title="Đóng cửa sổ" aria-label="Đóng" class="flex h-7 w-7 cursor-pointer items-center justify-center rounded text-foreground-500 transition-colors hover:bg-background-200 hover:text-foreground-900"><i class="ri-close-line text-base" aria-hidden="true"></i></button>
      </header>

      <header data-header-history class="hidden flex items-center justify-between border-b border-background-200 bg-background-50 px-3 py-2">
        <div class="flex items-center gap-1.5">
          <button type="button" data-action-back-chat title="Quay lại hội thoại" aria-label="Quay lại chat" class="flex h-7 w-7 cursor-pointer items-center justify-center rounded text-foreground-600 transition-colors hover:bg-background-200 hover:text-primary-600"><i class="ri-arrow-left-s-line text-lg" aria-hidden="true"></i></button>
          <div>
            <p class="font-heading text-xs font-bold text-foreground-950">Lịch sử chat</p>
            <p class="text-[10px] text-foreground-500" data-history-count>0 cuộc trò chuyện</p>
          </div>
        </div>
        <div class="flex items-center gap-1">
          <button type="button" data-action-new-chat title="Bắt đầu đoạn chat mới" class="flex h-7 w-7 cursor-pointer items-center justify-center rounded text-foreground-600 transition-colors hover:bg-background-200 hover:text-primary-600"><i class="ri-chat-new-line text-sm" aria-hidden="true"></i></button>
          <button type="button" data-action-close title="Đóng cửa sổ" class="flex h-7 w-7 cursor-pointer items-center justify-center rounded text-foreground-500 transition-colors hover:bg-background-200 hover:text-foreground-900"><i class="ri-close-line text-base" aria-hidden="true"></i></button>
        </div>
      </header>

      <!-- VIEW 1: MÀN HÌNH CHAT TRỰC TIẾP -->
      <div data-view-chat class="flex flex-1 flex-col overflow-hidden">
        <div data-chat-scroll class="flex-1 space-y-2.5 overflow-y-auto px-3 py-3">
          <div data-chat-list class="space-y-2.5">${(activeSess.messages || []).map(messageHtml).join('')}</div>
          <div data-chat-typing class="hidden flex justify-start">
            <div class="flex items-center gap-1 rounded-lg rounded-bl-sm border border-background-200 bg-background-50 px-2.5 py-2 shadow-xs">
              <span class="h-1.5 w-1.5 animate-bounce rounded-full bg-primary-500"></span>
              <span class="h-1.5 w-1.5 animate-bounce rounded-full bg-primary-500 [animation-delay:150ms]"></span>
              <span class="h-1.5 w-1.5 animate-bounce rounded-full bg-primary-500 [animation-delay:300ms]"></span>
            </div>
          </div>
        </div>
        <div class="border-t border-background-200 bg-background-50/95 px-3 py-2 backdrop-blur-sm">
          <div class="mb-1.5 flex items-center justify-between px-0.5 text-[10px] text-foreground-500">
            <span class="flex items-center gap-1"><i class="ri-history-line text-primary-600"></i>Lịch sử tự lưu</span>
            <button type="button" data-action-history class="cursor-pointer font-medium text-primary-600 hover:underline flex items-center gap-1">
              <i class="ri-time-line"></i>Lịch sử chat (<span data-badge-sessions>${sessions.filter((s) => (s.messages || []).some((m) => m.from === 'user')).length}</span>)
            </button>
          </div>
          <div data-chat-quick class="flex flex-wrap gap-1">
            ${QUICK.map((q) => `<button type="button" data-quick="${esc(q)}" class="cursor-pointer whitespace-nowrap rounded-full border border-background-300 bg-background-50 px-2 py-0.5 text-[11px] font-medium text-foreground-700 transition-colors hover:border-primary-400 hover:text-primary-700 disabled:opacity-50 disabled:cursor-not-allowed">${esc(q)}</button>`).join('')}
          </div>
          <form data-chat-form class="mt-1.5 flex items-center gap-1.5">
            <input type="text" name="q" placeholder="Nhập câu hỏi của bạn..." aria-label="Câu hỏi gửi trợ lý" autocomplete="off" class="min-w-0 flex-1 rounded-full border border-background-300 bg-background-50 px-3 py-1.5 text-xs text-foreground-950 placeholder:text-foreground-500 focus:border-primary-400 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed">
            <button type="submit" aria-label="Gửi câu hỏi" class="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-full bg-primary-500 text-white shadow-xs transition-colors hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed"><i class="ri-send-plane-2-line text-sm" aria-hidden="true"></i></button>
          </form>
        </div>
      </div>

      <!-- VIEW 2: MÀN HÌNH LỊCH SỬ CÁC CUỘC TRÒ CHUYỆN -->
      <div data-view-history class="hidden flex flex-1 flex-col overflow-hidden bg-background-100">
        <div class="flex items-center justify-between border-b border-background-200 bg-white px-3 py-1.5 text-[11px] text-foreground-600">
          <span>Các cuộc trò chuyện của bạn</span>
          <button type="button" data-action-clear-history class="cursor-pointer font-semibold text-rose-600 hover:text-rose-700 flex items-center gap-1">
            <i class="ri-delete-bin-line"></i>Xóa tất cả
          </button>
        </div>
        <div data-history-list class="flex-1 space-y-2 overflow-y-auto p-2.5">
          <!-- Render danh sách phiên hội thoại -->
        </div>
      </div>

    </section>

    <!-- NÚT NỔI MỞ CHATBOT GÓC MÀN HÌNH -->
    <button type="button" data-chat-toggle aria-label="Mở trợ lý tư vấn đặt sân" aria-expanded="${st.open}" class="${st.open ? 'hidden' : ''} fixed bottom-4 right-4 z-[96] flex h-14 w-14 cursor-pointer items-center justify-center rounded-full bg-primary-500 text-white shadow-lg transition-transform hover:scale-105 hover:bg-primary-600">
      <i class="ri-customer-service-2-line text-2xl" aria-hidden="true"></i>
      <span class="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-accent-500 text-xs font-bold text-background-950">1</span>
    </button>
  `;

  const panel = root.querySelector('[data-chat-panel]');
  const triggerBtn = root.querySelector('button[data-chat-toggle]');
  const headerChat = root.querySelector('[data-header-chat]');
  const headerHistory = root.querySelector('[data-header-history]');
  const viewChat = root.querySelector('[data-view-chat]');
  const viewHistory = root.querySelector('[data-view-history]');
  const scrollEl = root.querySelector('[data-chat-scroll]');
  const listEl = root.querySelector('[data-chat-list]');
  const historyListEl = root.querySelector('[data-history-list]');
  const historyCountEl = root.querySelector('[data-history-count]');
  const badgeSessionsEl = root.querySelector('[data-badge-sessions]');
  const typingEl = root.querySelector('[data-chat-typing]');
  const quickBox = root.querySelector('[data-chat-quick]');
  const form = root.querySelector('[data-chat-form]');
  const inputEl = form.querySelector('input[name="q"]');
  const submitBtn = form.querySelector('button[type="submit"]');

  const scrollToBottom = (smooth = true) => {
    if (!scrollEl) return;
    scrollEl.scrollTo({ top: scrollEl.scrollHeight, behavior: smooth ? 'smooth' : 'auto' });
  };

  const getUserSessions = () => sessions.filter((s) => (s.messages || []).some((m) => m.from === 'user'));

  const updateSessionBadges = () => {
    const count = getUserSessions().length;
    if (badgeSessionsEl) badgeSessionsEl.textContent = count;
    if (historyCountEl) historyCountEl.textContent = `${count} cuộc trò chuyện`;
  };

  const renderHistoryList = () => {
    updateSessionBadges();
    const userSess = getUserSessions();
    if (!userSess || userSess.length === 0) {
      historyListEl.innerHTML = `
        <div class="flex flex-col items-center justify-center py-12 px-4 text-center">
          <span class="flex h-12 w-12 items-center justify-center rounded-full bg-background-200 text-foreground-400 mb-2">
            <i class="ri-chat-history-line text-2xl"></i>
          </span>
          <p class="text-sm font-bold text-foreground-950">Chưa có lịch sử hội thoại</p>
          <p class="mt-1 text-xs text-foreground-500">Các cuộc trò chuyện với AI sẽ được tự động lưu tại đây.</p>
          <button type="button" data-action-new-chat class="mt-4 inline-flex items-center gap-1.5 rounded-full bg-primary-500 px-4 py-1.5 text-xs font-semibold text-white hover:bg-primary-600 transition-colors">
            <i class="ri-chat-new-line"></i>Bắt đầu chat ngay
          </button>
        </div>
      `;
      return;
    }

    historyListEl.innerHTML = userSess.map((sess) => {
      const isActive = sess.id === activeId;
      const msgs = sess.messages || [];
      const userMsgs = msgs.filter((m) => m.from === 'user');
      const lastMsg = msgs[msgs.length - 1];
      const previewText = lastMsg ? (lastMsg.text || '').replace(/\n/g, ' ').slice(0, 70) : 'Trợ lý sẵn sàng hỗ trợ bạn';
      const timeLabel = formatTime(sess.updatedAt || sess.createdAt);

      return `
        <div class="group relative rounded-lg border ${isActive ? 'border-primary-400 bg-white ring-1 ring-primary-300' : 'border-background-200 bg-white hover:border-primary-300'} p-3 shadow-xs transition-all">
          <div class="flex items-start justify-between gap-2">
            <div class="min-w-0 flex-1 cursor-pointer" data-select-session="${sess.id}">
              <div class="flex items-center gap-1.5">
                <span class="flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${isActive ? 'bg-primary-500 text-white' : 'bg-primary-50 text-primary-700'} text-xs">
                  <i class="ri-chat-3-line"></i>
                </span>
                <p class="truncate text-xs font-bold text-foreground-950">${esc(sess.title || 'Cuộc trò chuyện')}</p>
                ${isActive ? `<span class="rounded bg-primary-500 px-1.5 py-0.2 text-[10px] font-semibold text-white">Đang mở</span>` : ''}
              </div>
              <p class="mt-1 line-clamp-1 text-[11px] text-foreground-600">${esc(previewText)}</p>
              <div class="mt-2 flex items-center gap-2 text-[10px] text-foreground-500">
                <span><i class="ri-time-line mr-0.5"></i>${timeLabel}</span>
                <span>•</span>
                <span>${userMsgs.length} câu hỏi (${msgs.length} tin)</span>
              </div>
            </div>
            <button type="button" data-delete-session="${sess.id}" title="Xóa đoạn chat này" class="shrink-0 rounded p-1 text-foreground-400 hover:bg-rose-50 hover:text-rose-600 transition-colors cursor-pointer" aria-label="Xóa đoạn chat">
              <i class="ri-delete-bin-line text-sm"></i>
            </button>
          </div>
        </div>
      `;
    }).join('');
  };

  const switchView = (targetView) => {
    st.view = targetView;
    if (targetView === 'history') {
      headerChat.classList.add('hidden');
      viewChat.classList.add('hidden');
      headerHistory.classList.remove('hidden');
      viewHistory.classList.remove('hidden');
      renderHistoryList();
      syncServerHistory();
    } else {
      headerHistory.classList.add('hidden');
      viewHistory.classList.add('hidden');
      headerChat.classList.remove('hidden');
      viewChat.classList.remove('hidden');
      updateSessionBadges();
      const cur = getActiveSession();
      listEl.innerHTML = (cur.messages || []).map(messageHtml).join('');
      scrollToBottom(false);
      setTimeout(() => {
        if (st.open && inputEl && !st.typing) inputEl.focus();
      }, 50);
    }
  };

  const setOpen = (open, animate = false) => {
    st.open = open;
    saveOpen(open);
    if (open) {
      panel.classList.remove('hidden');
      if (animate) {
        panel.classList.add('animate-fade-up');
      } else {
        panel.classList.remove('animate-fade-up');
      }
      triggerBtn.classList.add('hidden');
      triggerBtn.setAttribute('aria-expanded', 'true');
      switchView(st.view || 'chat');
    } else {
      panel.classList.add('hidden');
      panel.classList.remove('animate-fade-up');
      triggerBtn.classList.remove('hidden');
      triggerBtn.setAttribute('aria-expanded', 'false');
    }
  };

  const setTyping = (typing) => {
    st.typing = typing;
    if (typing) {
      typingEl.classList.remove('hidden');
      inputEl.disabled = true;
      inputEl.placeholder = 'Trợ lý đang suy nghĩ...';
      submitBtn.disabled = true;
      quickBox.querySelectorAll('button').forEach((b) => b.disabled = true);
      scrollToBottom(true);
    } else {
      typingEl.classList.add('hidden');
      inputEl.disabled = false;
      inputEl.placeholder = 'Nhập câu hỏi của bạn...';
      submitBtn.disabled = false;
      quickBox.querySelectorAll('button').forEach((b) => b.disabled = false);
      scrollToBottom(true);
      setTimeout(() => {
        if (st.open && inputEl && st.view === 'chat') inputEl.focus();
      }, 50);
    }
  };

  const startNewChat = () => {
    const cur = getActiveSession();
    const hasUserMsg = (cur.messages || []).some((m) => m.from === 'user');
    if (hasUserMsg) {
      const newSess = createSessionObj();
      sessions.unshift(newSess);
      activeId = newSess.id;
      saveActiveSessionId(activeId);
      saveSessionsToStorage(sessions);
      switchView('chat');
      toast('Đã bắt đầu đoạn chat mới.');
    } else {
      // Nếu đoạn chat hiện tại chưa nhắn gì, chỉ cần quay về chat view
      switchView('chat');
      toast('Đang ở cuộc trò chuyện mới.');
    }
  };

  const openSessionById = (sessId) => {
    const target = sessions.find((s) => s.id === sessId);
    if (target) {
      activeId = target.id;
      saveActiveSessionId(activeId);
      switchView('chat');
      toast(`Đang xem: ${target.title}`);
    }
  };

  const deleteSessionById = (sessId) => {
    const idx = sessions.findIndex((s) => s.id === sessId);
    if (idx === -1) return;
    const deleted = sessions.splice(idx, 1)[0];
    saveSessionsToStorage(sessions);
    api('chatbot', 'delete_session', { session_id: sessId }).catch(() => {});

    if (activeId === sessId) {
      const remainingUserSess = getUserSessions();
      if (remainingUserSess.length > 0) {
        activeId = remainingUserSess[0].id;
        saveActiveSessionId(activeId);
      } else {
        const fresh = createSessionObj();
        sessions = [fresh];
        activeId = fresh.id;
        saveActiveSessionId(activeId);
        saveSessionsToStorage(sessions);
      }
    }
    renderHistoryList();
    toast(`Đã xóa đoạn chat "${deleted.title}" khỏi lịch sử.`);
  };

  const clearAllChatHistory = () => {
    if (!confirm('Bạn có chắc chắn muốn xóa toàn bộ lịch sử các cuộc trò chuyện?')) return;
    const fresh = createSessionObj();
    sessions = [fresh];
    activeId = fresh.id;
    saveActiveSessionId(activeId);
    saveSessionsToStorage(sessions);
    api('chatbot', 'clear_history').catch(() => {});
    renderHistoryList();
    toast('Đã xóa toàn bộ lịch sử chat.');
  };

  const appendMessage = (m) => {
    const cur = getActiveSession();
    if (!cur.messages) cur.messages = [];
    cur.messages.push(m);
    cur.updatedAt = Date.now();

    // Tự động đặt tiêu đề theo câu hỏi đầu tiên của người dùng
    if (m.from === 'user' && (!cur.title || cur.title === 'Đoạn chat mới')) {
      cur.title = m.text.trim().slice(0, 36) + (m.text.length > 36 ? '...' : '');
    }

    saveSessionsToStorage(sessions);
    updateSessionBadges();

    const div = document.createElement('div');
    div.innerHTML = messageHtml(m);
    const child = div.firstElementChild;
    if (child) listEl.appendChild(child);
    scrollToBottom(true);
  };

  async function send(value) {
    const q = (value || '').trim();
    if (!q || st.typing) return;

    // Hiển thị tin nhắn người dùng ngay lập tức (KHÔNG load lại khung chat)
    appendMessage({ from: 'user', text: q });
    setTyping(true);

    try {
      const cur = getActiveSession();
      const history = (cur.messages || []).slice(-7, -1).map((m) => ({
        from: m.from,
        text: m.text,
      }));

      let answer = null;
      try {
        const res = await api('chatbot', 'message', { message: q, history, session_id: cur.id });
        if (res && res.text) {
          answer = res;
        }
      } catch (apiErr) {
        console.warn('Backend Chatbot API unreachable, using local fallback:', apiErr);
      }

      if (!answer) {
        answer = await reply(q);
      }

      appendMessage({ from: 'bot', ...answer });
    } catch (err) {
      console.error('Chatbot error:', err);
      appendMessage({
        from: 'bot',
        text: `Đã xảy ra sự cố tạm thời khi xử lý câu hỏi. Bạn vui lòng liên hệ Hotline ${HOTLINE} để được nhân viên hỗ trợ trực tiếp nhé!`,
        links: [['Gọi Hotline ' + HOTLINE, '/lien-he']],
      });
    } finally {
      setTyping(false);
    }
  }

  // Bắt sự kiện Click trên toàn bộ khung chat
  root.addEventListener('click', (e) => {
    if (e.target.closest('[data-chat-toggle]') || e.target.closest('[data-action-close]')) {
      e.preventDefault();
      setOpen(!st.open, true);
      return;
    }
    if (e.target.closest('[data-action-history]')) {
      e.preventDefault();
      switchView('history');
      return;
    }
    if (e.target.closest('[data-action-back-chat]')) {
      e.preventDefault();
      switchView('chat');
      return;
    }
    if (e.target.closest('[data-action-new-chat]')) {
      e.preventDefault();
      startNewChat();
      return;
    }
    if (e.target.closest('[data-action-clear-history]')) {
      e.preventDefault();
      clearAllChatHistory();
      return;
    }

    const selBtn = e.target.closest('[data-select-session]');
    if (selBtn) {
      e.preventDefault();
      openSessionById(selBtn.dataset.selectSession);
      return;
    }

    const delBtn = e.target.closest('[data-delete-session]');
    if (delBtn) {
      e.preventDefault();
      deleteSessionById(delBtn.dataset.deleteSession);
      return;
    }

    const qBtn = e.target.closest('[data-quick]');
    if (qBtn && !st.typing) {
      e.preventDefault();
      send(qBtn.dataset.quick || qBtn.textContent);
    }
  });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (st.typing) return;
    const val = inputEl.value;
    inputEl.value = '';
    send(val);
  });

  // Hỗ trợ mở chatbot từ các trang khác qua CustomEvent hoặc thuộc tính data
  window.addEventListener('bmt24h-open-chatbot', () => {
    setOpen(true, true);
    switchView('chat');
  });

  window.addEventListener('bmt24h-open-chatbot-history', () => {
    setOpen(true, true);
    switchView('history');
  });

  document.addEventListener('click', (e) => {
    if (e.target.closest('[data-open-chatbot-history]')) {
      e.preventDefault();
      setOpen(true, true);
      switchView('history');
    }
  });

  // Đồng bộ toàn bộ lịch sử các cuộc hội thoại từ CSDL máy chủ khi người dùng đã đăng nhập
  async function syncServerHistory() {
    if (currentUserId === 'guest') return;
    try {
      if (migratedGuestIds.length > 0) {
        await api('chatbot', 'claim_guest_sessions', { session_ids: migratedGuestIds }).catch(() => {});
      }
      const res = await api('chatbot', 'sync', {}, 'GET');
      if (res && Array.isArray(res.sessions) && res.sessions.length > 0) {
        const serverSessions = res.sessions.map((ss) => {
          const msgs = Array.isArray(ss.messages) ? [...ss.messages] : [];
          if (msgs.length > 0 && msgs[0].from !== 'bot') {
            msgs.unshift({ from: 'bot', text: defaultGreeting });
          }
          return {
            id: ss.id,
            title: ss.title || 'Cuộc trò chuyện',
            createdAt: ss.createdAt || Date.now(),
            updatedAt: ss.updatedAt || Date.now(),
            messages: msgs,
          };
        });

        const hasLocalUserMsgs = sessions.some((s) => (s.messages || []).some((m) => m.from === 'user'));
        if (!hasLocalUserMsgs) {
          sessions = serverSessions;
          activeId = sessions[0].id;
          saveActiveSessionId(activeId);
        } else {
          const map = new Map();
          serverSessions.forEach((s) => map.set(s.id, s));
          sessions.forEach((s) => {
            if (!map.has(s.id)) {
              map.set(s.id, s);
            } else {
              const srv = map.get(s.id);
              if ((s.messages || []).length >= (srv.messages || []).length) {
                map.set(s.id, s);
              }
            }
          });
          sessions = Array.from(map.values()).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
        }

        saveSessionsToStorage(sessions);
        updateSessionBadges();

        if (st.view === 'chat') {
          const cur = getActiveSession();
          if (listEl) {
            listEl.innerHTML = (cur.messages || []).map(messageHtml).join('');
            scrollToBottom(false);
          }
        } else if (st.view === 'history') {
          renderHistoryList();
        }
      }
    } catch (e) {
      console.warn('Lỗi đồng bộ lịch sử chatbot từ máy chủ:', e);
    }
  }

  // Khởi tạo trạng thái mở ban đầu nếu đã mở trước đó
  if (st.open) {
    switchView('chat');
    scrollToBottom(false);
  }

  // Tự động đồng bộ lịch sử trò chuyện từ máy chủ khi người dùng đã đăng nhập
  syncServerHistory();
}
