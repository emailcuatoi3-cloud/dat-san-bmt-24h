/**
 * Trợ lý tư vấn (trả lời theo kịch bản từ khóa) — nút nổi góc phải dưới trên mọi trang.
 */
import { api, esc, url, formatVnd } from './ui.js';
import { HOTLINE } from '../lib/payment.js';

const root = document.getElementById('chatbot-root');
if (root) {
  const QUICK = ['Xem giá sân', 'Sân trống tối nay', 'Cách đặt sân', 'Chính sách hủy', 'Gặp nhân viên'];
  const st = {
    open: false,
    typing: false,
    messages: [{ from: 'bot', text: 'Chào bạn, mình là trợ lý của Đặt Sân BMT 24H. Bạn cần hỏi về giá sân, khung giờ trống hay cách đặt sân?' }],
  };
  let courts = null; // nạp khi cần

  const normalize = (v) => v.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').toLowerCase().trim();

  async function reply(raw) {
    const t = normalize(raw);
    if (!t) return { text: 'Bạn muốn hỏi mình điều gì về sân bóng đá hoặc cầu lông tại Buôn Ma Thuột?' };
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
      text: `Mình chưa chắc đã hiểu đúng câu này. Bạn có thể hỏi về giá, giờ mở cửa, chính sách hủy, thuê bóng/vợt hoặc sân trống tối nay.${cheapest ? ` Ví dụ: sân rẻ nhất hiện là ${cheapest.name} với ${formatVnd(cheapest.pricePerHour)}/giờ.` : ''}`,
      links: [[`Gọi hotline ${HOTLINE}`, '/lien-he']],
    };
  }

  function messageHtml(m) {
    const user = m.from === 'user';
    return `<div class="flex ${user ? 'justify-end' : 'justify-start'}"><div class="max-w-[86%] rounded-lg px-3 py-2 text-sm leading-relaxed ${user ? 'rounded-br-sm bg-primary-500 text-white' : 'rounded-bl-sm border border-background-200 bg-background-50 text-foreground-800'}">
      <p>${esc(m.text)}</p>
      ${m.courts ? `<div class="mt-2.5 space-y-2">${m.courts.map((c) => `<a href="${url(`/dat-san/${c.slug}`)}" class="flex items-center gap-2.5 rounded-md border border-background-200 bg-background-100 p-2 transition-colors hover:border-primary-400"><span class="h-11 w-11 shrink-0 overflow-hidden rounded-md"><img src="${esc(c.image)}" alt="${esc(c.name)}" class="h-full w-full object-cover object-top"></span><span class="min-w-0 flex-1"><span class="block truncate text-xs font-semibold text-foreground-950">${esc(c.name)}</span><span class="block text-[11px] text-foreground-500">${formatVnd(c.pricePerHour)}/giờ • ${esc(c.area)}</span></span><i class="ri-arrow-right-s-line text-foreground-400" aria-hidden="true"></i></a>`).join('')}</div>` : ''}
      ${m.links ? `<div class="mt-2 flex flex-wrap gap-1.5">${m.links.map(([l, to]) => `<a href="${url(to)}" class="rounded-full border border-primary-300 bg-primary-50 px-2.5 py-1 text-[11px] font-semibold text-primary-700 transition-colors hover:bg-primary-100">${esc(l)}</a>`).join('')}</div>` : ''}
    </div></div>`;
  }

  function render() {
    root.innerHTML = `${
      st.open
        ? `<section aria-label="Trợ lý tư vấn đặt sân" class="fixed bottom-4 right-4 z-[95] flex h-[520px] max-h-[calc(100vh-6rem)] w-[calc(100vw-2rem)] max-w-[370px] flex-col overflow-hidden rounded-xl border border-background-200 bg-background-100 shadow-2xl animate-fade-up">
        <header class="flex items-center gap-3 border-b border-background-200 bg-background-50 px-4 py-3">
          <span class="flex h-9 w-9 items-center justify-center rounded-full bg-primary-500 text-white"><i class="ri-customer-service-2-line text-lg" aria-hidden="true"></i></span>
          <div class="min-w-0 flex-1"><p class="truncate font-heading text-sm font-bold text-foreground-950">Trợ lý Đặt Sân BMT</p><p class="flex items-center gap-1.5 text-[11px] text-foreground-500"><span class="h-1.5 w-1.5 rounded-full bg-primary-500"></span>Trả lời tự động 24/7</p></div>
          <button type="button" data-chat-toggle aria-label="Đóng cửa sổ tư vấn" class="flex h-8 w-8 cursor-pointer items-center justify-center rounded-md text-foreground-500 transition-colors hover:bg-background-200 hover:text-foreground-900"><i class="ri-close-line text-lg" aria-hidden="true"></i></button>
        </header>
        <div data-chat-scroll class="flex-1 space-y-3 overflow-y-auto px-3.5 py-3.5">${st.messages.map(messageHtml).join('')}${
          st.typing
            ? '<div class="flex justify-start"><div class="flex items-center gap-1 rounded-lg rounded-bl-sm border border-background-200 bg-background-50 px-3 py-2.5"><span class="h-1.5 w-1.5 animate-bounce rounded-full bg-primary-500"></span><span class="h-1.5 w-1.5 animate-bounce rounded-full bg-primary-500 [animation-delay:150ms]"></span><span class="h-1.5 w-1.5 animate-bounce rounded-full bg-primary-500 [animation-delay:300ms]"></span></div></div>'
            : ''
        }</div>
        <div class="border-t border-background-200 px-3 py-2.5">
          <div class="flex flex-wrap gap-1.5">${QUICK.map((q) => `<button type="button" data-quick="${q}" class="cursor-pointer whitespace-nowrap rounded-full border border-background-300 bg-background-50 px-2.5 py-1 text-[11px] font-medium text-foreground-700 transition-colors hover:border-primary-400 hover:text-primary-700">${q}</button>`).join('')}</div>
          <form data-chat-form class="mt-2 flex items-center gap-2"><input type="text" name="q" placeholder="Nhập câu hỏi của bạn..." aria-label="Câu hỏi gửi trợ lý" class="min-w-0 flex-1 rounded-full border border-background-300 bg-background-50 px-3 py-2 text-sm text-foreground-950 placeholder:text-foreground-500 focus:border-primary-400 focus:outline-none"><button type="submit" aria-label="Gửi câu hỏi" class="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full bg-primary-500 text-white transition-colors hover:bg-primary-600"><i class="ri-send-plane-2-line text-base" aria-hidden="true"></i></button></form>
        </div></section>`
        : ''
    }<button type="button" data-chat-toggle aria-label="Mở trợ lý tư vấn đặt sân" aria-expanded="${st.open}" class="fixed bottom-4 right-4 z-[96] flex h-14 w-14 cursor-pointer items-center justify-center rounded-full bg-primary-500 text-white shadow-lg transition-transform hover:scale-105 hover:bg-primary-600 ${st.open ? 'hidden' : ''}"><i class="ri-customer-service-2-line text-2xl" aria-hidden="true"></i><span class="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-accent-500 text-[10px] font-bold text-background-950">1</span></button>`;
    const scroll = root.querySelector('[data-chat-scroll]');
    if (scroll) scroll.scrollTop = scroll.scrollHeight;
    const input = root.querySelector('[data-chat-form] input');
    if (input) input.focus();
  }

  async function send(value) {
    const q = value.trim();
    if (!q) return;
    st.messages.push({ from: 'user', text: q });
    st.typing = true;
    render();
    const [answer] = await Promise.all([reply(q), new Promise((r) => setTimeout(r, 650))]);
    st.messages.push({ from: 'bot', ...answer });
    st.typing = false;
    render();
  }

  root.addEventListener('click', (e) => {
    if (e.target.closest('[data-chat-toggle]')) {
      st.open = !st.open;
      return render();
    }
    const q = e.target.closest('[data-quick]');
    if (q) send(q.dataset.quick);
  });
  root.addEventListener('submit', (e) => {
    e.preventDefault();
    send(e.target.q.value);
  });
  render();
}
