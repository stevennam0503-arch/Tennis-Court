import React, { useState, useEffect, useRef } from 'react';
import {
  MessageSquare,
  Send,
  Sparkles,
  Bot,
  X,
  ChevronDown,
  ExternalLink,
  CheckCircle2,
  HelpCircle,
  Clock,
  MapPin,
  Calendar,
  CreditCard,
  ShieldCheck
} from 'lucide-react';
import { useGuest } from './context';

// Comprehensive Vietnamese knowledge base about Courtly Tennis Club
const COURTLY_KNOWLEDGE_VI = `
Courtly Tennis Club là tổ hợp quần vợt cao cấp gồm 10 sân tiêu chuẩn ATP:
- Khu A (Ngoài trời · 4 sân A01–A04): Thoáng mát, rợp bóng cây, hệ thống đèn LED 500 Lux chống chói. Giá chuẩn: 160.000đ/giờ. Giờ vàng ngày thường (09:00–16:00): 120.000đ/h (-25%). Tối đèn LED ngày thường (18:00–22:00): 224.000đ/h (+40%). Ban ngày cuối tuần (06:00–17:00): 200.000đ/h (+25%). Tối cuối tuần cực đỉnh & LED (17:00–22:00): 240.000đ/h (+50%).
- Khu B (Trong nhà có mái che · 4 sân B01–B04): Mái che vòm kiên cố cao 12m, chơi bất chấp thời tiết mưa bão. Mặt sân Pro-Cushion giảm chấn. Giá chuẩn: 240.000đ/giờ. Giờ vàng ngày thường: 180.000đ/h. Tối đèn LED ngày thường: 336.000đ/h. Ban ngày cuối tuần: 300.000đ/h. Tối cuối tuần cực đỉnh: 360.000đ/h.
- Khu V (Sân VIP Clubhouse · 2 sân V01–V02): Chuẩn thi đấu ATP, có phòng chờ VIP riêng biệt, sofa cao cấp, minibar phục vụ nước miễn phí. Giá chuẩn: 400.000đ/giờ. Giờ vàng ngày thường: 300.000đ/h. Tối đèn LED ngày thường: 560.000đ/h. Ban ngày cuối tuần: 500.000đ/h. Tối cuối tuần cực đỉnh: 600.000đ/h.
- Giờ mở cửa: 06:00 – 23:00 tất cả các ngày trong tuần (kể cả Thứ 7, Chủ Nhật và ngày lễ). Khung giờ đặt sân theo bước 30 phút.
- Dịch vụ Trọng tài & HLV: Có thể chọn trực tiếp khi đặt sân trên website, phí 75.000đ / 30 phút (150.000đ/giờ). Trọng tài đạt chuẩn Liên đoàn Quần vợt điều hành trận đấu, tính điểm và bắt lỗi chuẩn xác.
- Đặt sân & Giữ chỗ: Khách cần thanh toán tiền cọc 30% - 50% trong vòng 15 phút sau khi tạo đơn qua VietQR để khóa slot độc quyền. Phần còn lại thanh toán tại quầy khi đến chơi.
- Check-in vào sân: Sau khi đặt sân, khách mở vé điện tử QR Check-in trên website, xuất trình tại quầy lễ tân để nhân viên quét camera xác nhận vào sân.
- Chính sách Hủy & Hoàn tiền cọc:
  + Hủy trước 24 giờ: Hoàn 100% tiền cọc (vào ví voucher CLB).
  + Hủy dưới 24 giờ: Không hoàn cọc theo quy định vận hành.
  + Mưa bão: Sân ngoài trời Khu A được đổi sang sân trong nhà Khu B miễn phí hoặc dời lịch 100%.
- Tiện ích đi kèm miễn phí:
  + Bãi đỗ xe rộng rãi miễn phí cho cả ô tô và xe máy, bảo vệ 24/7.
  + Phòng tắm nước nóng lạnh cao cấp, khăn tắm sạch sẽ miễn phí.
  + Tủ khóa đồ cá nhân (locker) an toàn.
  + Có sẵn vợt tập cho mượn và máy căng cước vợt điện tử Yonex chính xác cao tại quầy.
- Gói Hội viên (Membership):
  + Gói Club: 249.000đ / 30 ngày (Giảm 10% tiền sân thường, 5% sân VIP, đặt trước 14 ngày, 1 lượt đổi lịch).
  + Gói Member Plus: 499.000đ / 30 ngày (Giảm 15% tiền sân thường, 10% sân VIP, phòng chờ VIP Lounge, đặt trước 21 ngày, miễn phí gửi xe).
`;

// Comprehensive English knowledge base about Courtly Tennis Club
const COURTLY_KNOWLEDGE_EN = `
Courtly Tennis Club is a premier tennis facility featuring 10 ATP-standard courts:
- Zone A (Outdoor · 4 courts A01–A04): Open-air hard courts surrounded by greenery with 500 Lux anti-glare LED lighting. Standard rate: 160,000 VND/hour. Weekday Golden Hours (09:00–16:00): 120,000 VND/h (-25%). Weekday Night LED (18:00–22:00): 224,000 VND/h (+40%). Weekend Day (06:00–17:00): 200,000 VND/h (+25%). Weekend Prime Night & LED (17:00–22:00): 240,000 VND/h (+50%).
- Zone B (Indoor with insulated roof · 4 courts B01–B04): 12m high arch roof, Pro-Cushion shock absorption surface, playable in any weather. Standard rate: 240,000 VND/hour. Weekday Golden Hours: 180,000 VND/h. Weekday Night LED: 336,000 VND/h. Weekend Day: 300,000 VND/h. Weekend Prime Night: 360,000 VND/h.
- Zone V (VIP Clubhouse · 2 courts V01–V02): ATP tournament standard with private VIP Lounge, luxury sofas, and complimentary refreshments. Standard rate: 400,000 VND/hour. Weekday Golden Hours: 300,000 VND/h. Weekday Night LED: 560,000 VND/h. Weekend Day: 500,000 VND/h. Weekend Prime Night: 600,000 VND/h.
- Operating Hours: 06:00 – 23:00 daily (including weekends and public holidays). Booking slots in 30-minute steps.
- Referee & Coach Service: Can be booked directly online at 75,000 VND / 30 mins (150,000 VND/hour). Certified federation referees for scoring and fair play.
- Booking & Deposit: 30% to 50% deposit required within 15 minutes via VietQR to secure court exclusively. Balance paid at reception upon check-in or check-out.
- Check-in: Open digital QR ticket on mobile, scan at reception camera upon arrival.
- Cancellation & Refund Policy:
  + Over 24 hours notice: 100% refund into club credit/voucher wallet.
  + Under 24 hours: Non-refundable due to reserved slot.
  + Weather guarantee: Outdoor Zone A players can transfer to indoor Zone B for free or reschedule without penalty if it rains.
- Complimentary Amenities:
  + Free spacious parking for cars and motorbikes with 24/7 security.
  + Premium hot/cold shower rooms, clean towels provided.
  + Secure personal lockers.
  + Training rackets available to borrow and high-precision Yonex electronic stringing machine at reception.
- Membership Plans:
  + Club Member: 249,000 VND / 30 days (10% discount on standard courts, 5% on VIP, 14-day advance booking).
  + Member Plus: 499,000 VND / 30 days (15% discount on standard courts, 10% on VIP, VIP Lounge access, 21-day advance booking).
`;

const BUILTIN_GEMINI_KEY = import.meta.env.VITE_GEMINI_API_KEY || '';

// Zero-dependency, lightweight Markdown renderer tailored for mobile chat bubbles
function FormattedMessage({ text, isUser }) {
  if (!text) return null;
  const lines = text.split('\n');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {lines.map((line, idx) => {
        const trimmed = line.trim();
        if (!trimmed) {
          return <div key={idx} style={{ height: 4 }} />;
        }

        // Check if line is bullet list item (*, -, •)
        const isBullet = /^[*\-•]\s+/.test(trimmed);
        const rawContent = isBullet ? trimmed.replace(/^[*\-•]\s+/, '') : trimmed;

        // Parse inline **bold** markers cleanly without literal asterisks
        const parts = rawContent.split(/(\*\*[^*]+\*\*)/g);
        const renderedParts = parts.map((part, pIdx) => {
          if (part.startsWith('**') && part.endsWith('**')) {
            return (
              <strong
                key={pIdx}
                style={{
                  fontWeight: 700,
                  color: isUser ? '#def46a' : '#111827'
                }}
              >
                {part.slice(2, -2)}
              </strong>
            );
          }
          return part;
        });

        if (isBullet) {
          return (
            <div
              key={idx}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 6,
                paddingLeft: 4,
                lineHeight: 1.55
              }}
            >
              <span
                style={{
                  color: isUser ? '#def46a' : '#16a34a',
                  fontWeight: 800,
                  fontSize: 14,
                  lineHeight: '18px',
                  userSelect: 'none'
                }}
              >
                •
              </span>
              <span style={{ flex: 1 }}>{renderedParts}</span>
            </div>
          );
        }

        return (
          <div key={idx} style={{ lineHeight: 1.55 }}>
            {renderedParts}
          </div>
        );
      })}
    </div>
  );
}

export default function AiChatbox() {
  const { t, lang, navigate, user } = useGuest();
  const isEn = lang === 'en';

  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState(() => [
    {
      id: 'welcome',
      role: 'assistant',
      text: isEn
        ? 'Hello! I am Courtly Tennis Assistant 🎾.\nI can assist you with court rates, schedule availability, referee booking, QR check-in, and membership plans. How can I help you today?'
        : 'Xin chào! Tôi là Trợ lý AI của CLB Quần vợt Courtly 🎾.\nTôi có thể hỗ trợ bạn tức thì về bảng giá 10 sân, lịch trống, dịch vụ trọng tài, check-in mã QR hoặc chính sách hội viên. Bạn cần tìm hiểu thông tin gì hôm nay?'
    }
  ]);

  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [closeHovered, setCloseHovered] = useState(false);
  const chatEndRef = useRef(null);

  // Sync welcome message when language changes if conversation hasn't started yet
  useEffect(() => {
    setMessages((prev) => {
      if (prev.length === 1 && prev[0].id === 'welcome') {
        return [
          {
            id: 'welcome',
            role: 'assistant',
            text: isEn
              ? 'Hello! I am Courtly Tennis Assistant 🎾.\nI can assist you with court rates, schedule availability, referee booking, QR check-in, and membership plans. How can I help you today?'
              : 'Xin chào! Tôi là Trợ lý AI của CLB Quần vợt Courtly 🎾.\nTôi có thể hỗ trợ bạn tức thì về bảng giá 10 sân, lịch trống, dịch vụ trọng tài, check-in mã QR hoặc chính sách hội viên. Bạn cần tìm hiểu thông tin gì hôm nay?'
          }
        ];
      }
      return prev;
    });
  }, [isEn]);

  // Read API key strictly from environment / built-in backend without exposing UI to users
  const apiKey =
    (typeof import.meta !== 'undefined' && import.meta.env?.VITE_GEMINI_API_KEY) ||
    BUILTIN_GEMINI_KEY;

  useEffect(() => {
    if (open) {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, open]);

  // Compact, conversational English fallback matcher
  const getLocalResponseEn = (q) => {
    const raw = q.toLowerCase().trim();

    if (
      raw.includes('who are you') ||
      raw.includes('what can you do') ||
      raw.includes('help') ||
      raw.includes('hello') ||
      raw.includes('hi') ||
      raw.includes('capability') ||
      raw.includes('scope') ||
      raw.includes('feature')
    ) {
      return `Welcome! 🎾 I am **Courtly AI Assistant**.
I can quickly help you with:
• **10 ATP Court Rates** (from 120,000đ to 400,000đ/h)
• **Online Booking & VietQR Deposit (30%–50%)**
• **QR Check-in & Cancellation Refund Policy**
• **Referee Booking (150k/h) & Membership Plans**

What specific topic would you like to explore?`;
    }

    if (
      raw.includes('price') ||
      raw.includes('rate') ||
      raw.includes('cost') ||
      raw.includes('fee') ||
      raw.includes('how much')
    ) {
      return `💰 **Courtly Court Rates (10 ATP Courts):**
• **Zone A (Outdoor):** 160,000đ/h (Golden Hours: 120,000đ · LED Night: 224,000đ)
• **Zone B (Covered Indoor):** 240,000đ/h (LED Night: 336,000đ)
• **Zone V (VIP Clubhouse):** 400,000đ/h (Includes private VIP Lounge)
*(Club members get 10% off; Member Plus get 15% off).*`;
    }

    if (
      raw.includes('rain') ||
      raw.includes('weather') ||
      raw.includes('indoor') ||
      raw.includes('storm') ||
      raw.includes('wet')
    ) {
      return `🌧️ **Playing in Rainy Weather:**
• **Zone B (Courts B01–B04)** features a solid 12m roof for all-weather play.
• If you booked outdoor Zone A and it rains, we offer **100% free transfer to indoor Zone B** or free rescheduling.`;
    }

    if (
      raw.includes('referee') ||
      raw.includes('coach') ||
      raw.includes('umpire')
    ) {
      return `👨‍⚖️ **Referee & Coaching Services:**
• **Fee:** **75,000đ / 30 mins** (150,000đ/hour).
• Certified federation referees for scoring and fair play.
• You can select referee service directly while booking online.`;
    }

    if (
      raw.includes('cancel') ||
      raw.includes('refund') ||
      raw.includes('reschedule')
    ) {
      return `💸 **Cancellation & Refund Policy:**
• **24+ hours ahead:** **100% deposit refund** into your voucher wallet.
• **Within 24 hours:** Deposit is non-refundable.
• To cancel, open **My Bookings** and click **[Cancel Booking]**.`;
    }

    if (
      raw.includes('check in') ||
      raw.includes('check-in') ||
      raw.includes('qr') ||
      raw.includes('ticket')
    ) {
      return `🎫 **Digital QR Check-in:**
1. Open your digital ticket in **My Bookings**.
2. Scan QR code at reception camera.
3. Express check-in in under 3 seconds!`;
    }

    if (
      raw.includes('member') ||
      raw.includes('subscription') ||
      raw.includes('plan') ||
      raw.includes('vip')
    ) {
      return `👑 **Membership Plans:**
• **Club (249,000đ / 30 days):** 10% off court rates, 14-day advance booking.
• **Member Plus (499,000đ / 30 days):** 15% off, VIP Lounge access, 21-day advance booking.`;
    }

    return `Thank you for reaching out! 🎾
Courtly Tennis Club operates 10 ATP courts daily from **06:00 to 23:00**.
Ask me about court pricing, indoor weather guarantee, referee booking, or membership benefits!`;
  };

  // Compact, conversational Vietnamese fallback matcher
  const getLocalResponseVi = (q) => {
    const raw = q.toLowerCase().trim();
    const norm = raw
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd');

    if (
      norm.includes('tra loi duoc') ||
      norm.includes('nhung cau hoi gi') ||
      norm.includes('lam duoc gi') ||
      norm.includes('giup duoc gi') ||
      norm.includes('hoi duoc gi') ||
      norm.includes('ban la ai') ||
      norm.includes('chuc nang') ||
      norm.includes('gioi thieu') ||
      norm.includes('gioi han') ||
      norm.includes('nang luc') ||
      norm.includes('cau hoi nao') ||
      norm.includes('huong dan su dung')
    ) {
      return `Xin chào bạn! 🎾 Tôi là **Trợ lý AI Courtly**.
Tôi có thể hỗ trợ nhanh cho bạn về:
• **Bảng giá 10 sân ATP** (từ 120.000đ – 400.000đ/h)
• **Đặt sân & cọc VietQR 30%–50%**
• **Vé QR Check-in & Chính sách hủy hoàn cọc**
• **Thuê trọng tài (150k/h) & Gói Hội viên giảm đến 15%**

Bạn cần tìm hiểu thông tin cụ thể nào, hãy nhắn cho tôi nhé!`;
    }

    if (
      norm.includes('huy') ||
      norm.includes('hoan tien') ||
      norm.includes('hoan coc') ||
      norm.includes('chinh sach huy') ||
      norm.includes('tra coc') ||
      norm.includes('doi lich') ||
      norm.includes('doi san') ||
      norm.includes('doi gio')
    ) {
      return `💸 **Chính sách Hủy sân & Hoàn cọc:**
• **Hủy trước 24 giờ:** Hoàn lại **100% tiền cọc** vào ví Voucher tích lũy.
• **Hủy dưới 24 giờ:** Không hoàn cọc theo quy định vận hành.
• Thao tác: Vào mục **Đơn của tôi** bấm **[Hủy đơn]**.`;
    }

    if (
      norm.includes('trong tai') ||
      norm.includes('referee') ||
      norm.includes('hlv') ||
      norm.includes('huan luyen')
    ) {
      return `👨‍⚖️ **Dịch vụ Trọng tài & Huấn luyện viên:**
• **Chi phí:** **75.000đ / 30 phút** (150.000đ/giờ).
• Trọng tài đạt chứng chỉ Liên đoàn, bắt lỗi và tính điểm chính xác.
• Bạn có thể tích chọn dịch vụ ngay trong bước đặt sân.`;
    }

    if (
      norm.includes('mua') ||
      norm.includes('troi mua') ||
      norm.includes('san trong nha') ||
      norm.includes('mai che') ||
      norm.includes('khu b')
    ) {
      return `🌧️ **Trời mưa tại CLB Courtly:**
• **Khu B (Sân B01–B04)** có mái che vòm cao 12m, chơi thoải mái bất chấp mưa bão.
• Nếu bạn đặt sân ngoài trời Khu A mà gặp mưa to, CLB hỗ trợ **chuyển sang sân trong nhà miễn phí** hoặc dời lịch 100%.`;
    }

    if (
      norm.includes('hoi vien') ||
      norm.includes('membership') ||
      norm.includes('member plus') ||
      norm.includes('goi club')
    ) {
      return `👑 **Gói Hội viên Courtly:**
• **Club (249.000đ / 30 ngày):** Giảm 10% tiền sân, đặt trước 14 ngày.
• **Member Plus (499.000đ / 30 ngày):** Giảm 15% tiền sân, phòng chờ VIP Lounge, đặt trước 21 ngày.`;
    }

    if (
      norm.includes('check in') ||
      norm.includes('check-in') ||
      norm.includes('qr') ||
      norm.includes('ve')
    ) {
      return `🎫 **Hướng dẫn Check-in QR:**
1. Mở vé điện tử trong mục **Đơn của tôi**.
2. Xuất trình mã QR tại quầy tiếp tân để quét camera.
3. Xác nhận vào sân chỉ trong 3 giây!`;
    }

    if (
      norm.includes('bang gia') ||
      norm.includes('gia san') ||
      norm.includes('gia thue') ||
      norm.includes('bao nhieu tien') ||
      norm.includes('chi phi thue') ||
      norm.includes('phi thue san') ||
      norm.includes('bao tien mot gio') ||
      (norm.includes('gia') && (norm.includes('san') || norm.includes('gio') || norm.includes('khu a') || norm.includes('khu b') || norm.includes('khu v')))
    ) {
      return `💰 **Bảng giá thuê sân Courtly (10 sân ATP):**
• **Khu A (Ngoài trời):** 160.000đ/h (Giờ vàng: 120.000đ/h · Tối LED: 224.000đ/h)
• **Khu B (Trong nhà mái che):** 240.000đ/h (Tối LED: 336.000đ/h)
• **Khu V (VIP Clubhouse):** 400.000đ/h (Kèm phòng chờ VIP Lounge)
*(Hội viên Club giảm 10%, Member Plus giảm 15%).*`;
    }

    return `Cảm ơn bạn đã liên hệ! 🎾
CLB Quần vợt Courtly có **10 sân tiêu chuẩn ATP**, mở cửa hàng ngày từ **06:00 đến 23:00**.
Bạn có thể hỏi tôi về bảng giá sân, dịch vụ trọng tài, check-in QR hoặc các gói hội viên!`;
  };

  const getLocalResponse = (q) => {
    if (isEn) return getLocalResponseEn(q);
    return getLocalResponseVi(q);
  };

  // Call Google Gemini API with conversational context memory & strict brevity
  const callGeminiApi = async (userPrompt) => {
    const keyToUse = apiKey || BUILTIN_GEMINI_KEY;
    const model = 'gemini-3.5-flash';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${keyToUse}`;

    const systemText = isEn
      ? `You are an elite AI Concierge for Courtly Tennis Club.
CRITICAL FORMATTING & CONTEXT RULES:
- The chat window is a COMPACT POPUP on mobile and desktop.
- Keep answers CONCISE, FRIENDLY, and DIRECT (under 3 to 5 short lines maximum).
- ALWAYS MAINTAIN CONVERSATIONAL CONTEXT: If the customer asks a follow-up query (e.g. "tell me more details", "does it have a roof?"), you MUST follow up directly on the previous topic discussed without asking them to clarify from scratch.
- Answer only what the user specifically asked. Use bold for key numbers (prices, hours).

Official Club Knowledge:
${COURTLY_KNOWLEDGE_EN}`
      : `Bạn là Chuyên viên Trợ lý AI cao cấp của CLB Quần vợt Courtly (Courtly Tennis Club).
QUY TẮC BẮT BUỘC VỀ ĐỘ DÀI & NGỮ CẢNH ĐỐI THOẠI:
- Khung chat là CỬA SỔ POPUP NHỎ trên điện thoại và web.
- Trả lời CỰC KỲ NGẮN GỌN, SÚC TÍCH, THÂN THIỆN (tối đa 3 đến 5 dòng).
- BẮT BUỘC HIỂU NGỮ CẢNH: Khi khách hỏi tiếp nối (ví dụ: "chỉ mình chi tiết hơn", "sân đó có mái che không", "hủy thì sao"), bạn phải giải thích ĐÚNG nội dung vừa trao đổi ở tin nhắn trước, tuyệt đối không hỏi lại từ đầu làm cụt hứng khách.
- Dùng in đậm cho số tiền hoặc giờ giấc quan trọng.

Dữ liệu xác thực của CLB:
${COURTLY_KNOWLEDGE_VI}`;

    // Build multi-turn conversational history (up to last 6 turns)
    const historyTurns = messages
      .filter((m) => m.id !== 'welcome')
      .slice(-6)
      .map((m) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.text }]
      }));

    const currentTurn = {
      role: 'user',
      parts: [{ text: userPrompt }]
    };

    const payload = {
      systemInstruction: {
        parts: [{ text: systemText }]
      },
      contents: [...historyTurns, currentTurn]
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData?.error?.message || `API error (${response.status})`);
    }

    const data = await response.json();
    const replyText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!replyText) throw new Error(isEn ? 'No content returned from AI' : 'Không nhận được nội dung từ AI');
    return replyText;
  };

  const handleSend = async (textToSend) => {
    const q = (textToSend || input).trim();
    if (!q || loading) return;

    const userMsg = { id: Date.now().toString(), role: 'user', text: q };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      let botReply = '';
      if (apiKey && apiKey.trim().length > 10) {
        try {
          botReply = await callGeminiApi(q);
        } catch (apiErr) {
          console.warn('Gemini API call failed, falling back to smart local engine:', apiErr);
          botReply = getLocalResponse(q);
        }
      } else {
        await new Promise((r) => setTimeout(r, 400));
        botReply = getLocalResponse(q);
      }

      setMessages((prev) => [
        ...prev,
        { id: (Date.now() + 1).toString(), role: 'assistant', text: botReply }
      ]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          text: isEn
            ? `Sorry, an error occurred: ${err.message}. Please try again!`
            : `Rất tiếc, đã có lỗi xảy ra: ${err.message}. Bạn vui lòng thử lại sau giây lát!`
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const quickPrompts = isEn
    ? [
        '🎾 Operating hours & Court rates?',
        '🌧️ Indoor Zone B for rainy days?',
        '👨‍⚖️ Referee service & Booking?',
        '🎫 How to check in with QR code?',
        '⭐ Membership plans & benefits?',
        '💸 Cancellation & Refund policy?'
      ]
    : [
        '🎾 Giờ mở cửa & Bảng giá các khu sân?',
        '🌧️ Sân trong nhà Khu B khi trời mưa?',
        '👨‍⚖️ Phí thuê trọng tài & cách đặt?',
        '🎫 Hướng dẫn check-in bằng mã QR?',
        '⭐ Quyền lợi các gói Hội viên Club?',
        '💸 Chính sách hủy sân & hoàn tiền cọc?'
      ];

  return (
    <>
      {/* FLOATING TRIGGER BUTTON */}
      <aside aria-label={isEn ? 'Courtly AI Assistant' : 'Trợ lý AI Courtly'}>
        {!open && (
          <button
            type="button"
            className="courtly-ai-fab"
            onClick={() => setOpen(true)}
            aria-label={isEn ? 'Open Courtly AI Assistant' : 'Mở Trợ lý AI Courtly'}
            style={{
              position: 'fixed',
              bottom: 24,
              right: 24,
              zIndex: 9990,
              background: '#173c32',
              color: '#def46a',
              border: '2px solid #def46a',
              borderRadius: 30,
              padding: '10px 18px',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              boxShadow: '0 8px 24px rgba(23,60,50,0.35)',
              cursor: 'pointer',
              fontWeight: 700,
              fontSize: 14,
              transition: 'all 0.25s ease'
            }}
          >
            <span style={{ fontSize: 20 }}>🎾</span>
            <span style={{ color: '#ffffff' }}>{isEn ? 'Courtly Assistant' : 'Trợ lý AI Courtly'}</span>
            <span
              style={{
                background: '#def46a',
                color: '#173c32',
                fontSize: 11,
                padding: '2px 8px',
                borderRadius: 10,
                fontWeight: 800
              }}
            >
              {isEn ? 'Online' : 'Trực tuyến'}
            </span>
          </button>
        )}
      </aside>

      {/* CHAT WINDOW FLYOUT */}
      {open && (
        <div
          role="region"
          aria-label={isEn ? 'Courtly AI Chatbox' : 'Hộp thoại Trợ lý AI Courtly'}
          style={{
            position: 'fixed',
            bottom: 24,
            right: 24,
            zIndex: 9999,
            width: 'min(420px, calc(100vw - 32px))',
            height: 'min(580px, calc(100vh - 48px))',
            background: '#ffffff',
            borderRadius: 16,
            boxShadow: '0 16px 50px rgba(10,35,26,0.25)',
            border: '1px solid #cfd5c8',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden'
          }}
        >
          {/* HEADER (CLEAN & PROFESSIONAL - NO SETTINGS BUTTON FOR REGULAR USERS) */}
          <div
            style={{
              background: '#173c32',
              color: '#ffffff',
              padding: '14px 18px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              borderBottom: '1px solid rgba(222,244,106,0.3)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: '50%',
                  background: '#def46a',
                  color: '#173c32',
                  display: 'grid',
                  placeItems: 'center',
                  fontSize: 18,
                  fontWeight: 800
                }}
              >
                🎾
              </div>
              <div>
                <strong style={{ display: 'block', fontSize: 14, color: '#def46a' }}>
                  {isEn ? 'Courtly Assistant' : 'Trợ lý Tennis Courtly'}
                </strong>
                <span style={{ fontSize: 11.5, color: '#d1dac4', display: 'flex', alignItems: 'center', gap: 5 }}>
                  <span
                    style={{
                      width: 7,
                      height: 7,
                      borderRadius: '50%',
                      background: '#4ade80',
                      display: 'inline-block'
                    }}
                  />
                  {isEn ? 'Online' : 'Trực tuyến'}
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center' }}>
              <button
                type="button"
                onClick={() => setOpen(false)}
                title={isEn ? 'Close assistant' : 'Đóng trợ lý'}
                aria-label={isEn ? 'Close assistant' : 'Đóng trợ lý'}
                onMouseEnter={() => setCloseHovered(true)}
                onMouseLeave={() => setCloseHovered(false)}
                style={{
                  background: closeHovered ? 'rgba(255,255,255,0.15)' : 'transparent',
                  color: closeHovered ? '#def46a' : 'rgba(255,255,255,0.85)',
                  border: 'none',
                  borderRadius: '50%',
                  width: 32,
                  height: 32,
                  minWidth: 32,
                  minHeight: 32,
                  padding: 0,
                  margin: 0,
                  boxSizing: 'border-box',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  flexShrink: 0
                }}
              >
                <X size={18} strokeWidth={2.2} />
              </button>
            </div>
          </div>

          {/* MESSAGES LIST */}
          <div
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: '16px 14px',
              background: '#f9faf7',
              display: 'flex',
              flexDirection: 'column',
              gap: 12
            }}
          >
            {messages.map((m) => {
              const isUser = m.role === 'user';
              return (
                <div
                  key={m.id}
                  style={{
                    display: 'flex',
                    flexDirection: isUser ? 'row-reverse' : 'row',
                    alignItems: 'flex-start',
                    gap: 8
                  }}
                >
                  {!isUser && (
                    <div
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: '50%',
                        background: '#173c32',
                        color: '#def46a',
                        display: 'grid',
                        placeItems: 'center',
                        fontSize: 13,
                        flexShrink: 0,
                        marginTop: 2
                      }}
                    >
                      🎾
                    </div>
                  )}

                  <div
                    style={{
                      maxWidth: '84%',
                      background: isUser ? '#173c32' : '#ffffff',
                      color: isUser ? '#ffffff' : '#1f2937',
                      padding: '10px 14px',
                      borderRadius: isUser ? '14px 14px 2px 14px' : '14px 14px 14px 2px',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
                      border: isUser ? 'none' : '1px solid #e3e8de',
                      fontSize: 13
                    }}
                  >
                    <FormattedMessage text={m.text} isUser={isUser} />
                  </div>
                </div>
              );
            })}

            {loading && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: '50%',
                    background: '#173c32',
                    color: '#def46a',
                    display: 'grid',
                    placeItems: 'center',
                    fontSize: 13
                  }}
                >
                  🎾
                </div>
                <div
                  style={{
                    background: '#ffffff',
                    border: '1px solid #e3e8de',
                    padding: '8px 14px',
                    borderRadius: 14,
                    fontSize: 12.5,
                    color: '#6b7280',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6
                  }}
                >
                  <span>{isEn ? 'Courtly AI is typing…' : 'Courtly AI đang soạn phản hồi…'}</span>
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* QUICK PROMPT CHIPS */}
          <div
            style={{
              padding: '8px 12px',
              background: '#f2f5ec',
              borderTop: '1px solid #e0e6d8',
              display: 'flex',
              gap: 6,
              overflowX: 'auto',
              whiteSpace: 'nowrap'
            }}
          >
            {quickPrompts.map((prompt, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleSend(prompt)}
                disabled={loading}
                style={{
                  background: '#ffffff',
                  color: '#173c32',
                  border: '1px solid #cad4c1',
                  borderRadius: 20,
                  padding: '5px 11px',
                  fontSize: 11.5,
                  fontWeight: 600,
                  cursor: 'pointer',
                  flexShrink: 0
                }}
              >
                {prompt}
              </button>
            ))}
          </div>

          {/* INPUT FORM */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            style={{
              padding: '10px 12px',
              background: '#ffffff',
              borderTop: '1px solid #e2e8dc',
              display: 'flex',
              alignItems: 'center',
              gap: 8
            }}
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={isEn ? 'Ask about rates, hours, deposit, check-in...' : 'Hỏi về giá sân, giờ mở, cọc, QR check-in...'}
              disabled={loading}
              style={{
                flex: 1,
                border: '1px solid #cfd7c9',
                borderRadius: 22,
                padding: '9px 14px',
                fontSize: 13,
                outline: 'none',
                background: '#fcfdfa'
              }}
            />
            <button
              type="submit"
              disabled={!input.trim() || loading}
              style={{
                background: '#173c32',
                color: '#def46a',
                border: 'none',
                borderRadius: '50%',
                width: 36,
                height: 36,
                display: 'grid',
                placeItems: 'center',
                cursor: !input.trim() || loading ? 'not-allowed' : 'pointer',
                opacity: !input.trim() || loading ? 0.5 : 1
              }}
            >
              <Send size={16} />
            </button>
          </form>
        </div>
      )}
    </>
  );
}
