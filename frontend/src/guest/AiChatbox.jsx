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

export function buildPricingKnowledge(data, isEn) {
  const courts = data?.courts || [];
  const prices = data?.prices || [];
  const refereeRates = data?.refereeRates || [];

  const zoneConfig = [
    { type: 'OUTDOOR', viName: 'Khu A (Ngoài trời · 4 sân A01–A04)', enName: 'Zone A (Outdoor · 4 courts A01–A04)' },
    { type: 'INDOOR', viName: 'Khu B (Trong nhà có mái che · 4 sân B01–B04)', enName: 'Zone B (Indoor with insulated roof · 4 courts B01–B04)' },
    { type: 'VIP', viName: 'Khu V (Sân VIP Clubhouse · 2 sân V01–V02)', enName: 'Zone V (VIP Clubhouse · 2 courts V01–V02)' }
  ];

  const linesVi = [];
  const linesEn = [];

  for (const z of zoneConfig) {
    const courtsInZone = courts.filter(c => c.type === z.type && c.status !== 'DELETED');
    const repCourt = courtsInZone.find(c => c.status === 'ACTIVE') || courtsInZone[0];
    const repPrices = repCourt ? prices.filter(p => p.court === repCourt.id) : [];

    const formatByDay = (dayType) => {
      const dp = repPrices.filter(p => p.dayType === dayType).sort((a, b) => a.start - b.start);
      if (!dp.length) {
        const base = repCourt?.price || (z.type === 'VIP' ? 400000 : z.type === 'INDOOR' ? 240000 : 160000);
        return `${Number(base).toLocaleString('vi-VN')}đ/h`;
      }
      return dp.map(p => {
        const s = `${String(Math.floor(p.start)).padStart(2, '0')}:${String(Math.round((p.start % 1) * 60)).padStart(2, '0')}`;
        const e = `${String(Math.floor(p.end)).padStart(2, '0')}:${String(Math.round((p.end % 1) * 60)).padStart(2, '0')}`;
        return `${s}–${e}: ${Number(p.price).toLocaleString('vi-VN')}đ/h`;
      }).join(', ');
    };

    linesVi.push(`- ${z.viName}: Ngày thường (${formatByDay('WEEKDAY')}); Cuối tuần (${formatByDay('WEEKEND')}).`);
    linesEn.push(`- ${z.enName}: Weekdays (${formatByDay('WEEKDAY')}); Weekends (${formatByDay('WEEKEND')}).`);
  }

  const refTextVi = refereeRates.length
    ? `Dịch vụ Trọng tài & HLV: Có thể chọn trực tiếp khi đặt sân; biểu phí: ${refereeRates.map(r => `${r.name}: ${Number(r.rate).toLocaleString('vi-VN')}đ/giờ`).join(', ')}. Trọng tài đạt chứng chỉ Liên đoàn Quần vợt.`
    : `Dịch vụ Trọng tài & HLV: Có thể chọn trực tiếp khi đặt sân trực tuyến; biểu phí chuẩn từ 150.000đ/giờ.`;

  const refTextEn = refereeRates.length
    ? `Referee & Coach Service: Available during online booking; rates: ${refereeRates.map(r => `${r.name}: ${Number(r.rate).toLocaleString('en-US')} VND/h`).join(', ')}. Certified federation referees.`
    : `Referee & Coach Service: Available during online booking; certified federation referees.`;

  return isEn
    ? `${linesEn.join('\n')}\n- ${refTextEn}`
    : `${linesVi.join('\n')}\n- ${refTextVi}`;
}

const COURTLY_RULES_VI = `
- Giờ mở cửa: 06:00 – 23:00 tất cả các ngày trong tuần (kể cả Thứ 7, Chủ Nhật và ngày lễ). Khung giờ đặt sân theo bước 30 phút.
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
- Hạng thành viên & Khách hàng thân thiết (Loyalty Tiers):
  + Tự động xét hạng dựa trên tổng chi tiêu 12 tháng trượt:
    * Rookie (0₫): Tích điểm 1đ/10k, voucher chào mừng 50k, voucher sinh nhật 30k.
    * Challenger (3.000.000₫): Giảm 3% tiền sân, tích điểm ×1,2, đặt trước 10 ngày, 1 lượt đổi lịch/tháng, quà thăng hạng 200 điểm, voucher sinh nhật 60k.
    * Masters (8.000.000₫): Giảm 5% tiền sân, tích điểm ×1,5, đặt trước 14 ngày, 2 lượt đổi lịch/tháng, quà thăng hạng 500 điểm, voucher sinh nhật 120k.
    * Grand Slam (20.000.000₫): Giảm 8% tiền sân, tích điểm ×2,0, đặt trước 21 ngày, 4 lượt đổi lịch/tháng, quà thăng hạng 1.000 điểm + voucher 300k + thẻ VIP Lounge, voucher sinh nhật 250k.
  + Dùng điểm: 1 điểm = 100₫ trừ trực tiếp vào tiền sân (tối đa 50% tiền sân còn lại) hoặc đổi voucher dịch vụ (gia hạn, 1h sân giờ vàng, 1h trọng tài).
`;

const COURTLY_RULES_EN = `
- Operating Hours: 06:00 – 23:00 daily (including weekends and public holidays). Booking slots in 30-minute steps.
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
- Loyalty Membership Tiers:
  + Automatic progression based on 12-month rolling spend:
    * Rookie (0 VND): Earn 1 pt / 10k VND, 50k welcome gift, 30k birthday voucher.
    * Challenger (3,000,000 VND): 3% court discount, 1.2x points, 10-day advance booking, 1 free reschedule/month, 200 upgrade pts, 60k birthday voucher.
    * Masters (8,000,000 VND): 5% court discount, 1.5x points, 14-day advance booking, 2 free reschedules/month, 500 upgrade pts, 120k birthday voucher.
    * Grand Slam (20,000,000 VND): 8% court discount, 2.0x points, 21-day advance booking, 4 free reschedules/month, 1,000 upgrade pts + 300k voucher + VIP Lounge card, 250k birthday voucher.
  + Points: 1 pt = 100 VND discount on court fees (up to 50% of net court total) or redeem service vouchers.
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
  const { t, lang, navigate, user, data } = useGuest();
  const isEn = lang === 'en';

  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState(() => [
    {
      id: 'welcome',
      role: 'assistant',
      text: isEn
        ? 'Hello! I am Courtly Tennis Assistant 🎾.\nI can assist you with court rates, schedule availability, referee booking, QR check-in, and loyalty tier benefits and point rewards. How can I help you today?'
        : 'Xin chào! Tôi là Trợ lý AI của CLB Quần vợt Courtly 🎾.\nTôi có thể hỗ trợ bạn tức thì về bảng giá 10 sân, lịch trống, dịch vụ trọng tài, check-in mã QR hoặc chính sách hạng thành viên & điểm thưởng. Bạn cần tìm hiểu thông tin gì hôm nay?'
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
              : 'Xin chào! Tôi là Trợ lý AI của CLB Quần vợt Courtly 🎾.\nTôi có thể hỗ trợ bạn tức thì về bảng giá 10 sân, lịch trống, dịch vụ trọng tài, check-in mã QR hoặc chính sách thành viên. Bạn cần tìm hiểu thông tin gì hôm nay?'
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
      const zRateEn = (type) => {
        const courts = (data?.courts || []).filter(c => c.type === type && c.status !== 'DELETED');
        const rep = courts.find(c => c.status === 'ACTIVE') || courts[0];
        const p = rep ? (data?.prices || []).filter(x => x.court === rep.id) : [];
        if (!p.length) return Number(rep?.price || 160000).toLocaleString('en-US') + ' VND/h';
        const min = Math.min(...p.map(x => Number(x.price))), max = Math.max(...p.map(x => Number(x.price)));
        return min === max ? `${min.toLocaleString('en-US')} VND/h` : `from ${min.toLocaleString('en-US')} – ${max.toLocaleString('en-US')} VND/h`;
      };
      return `💰 **Courtly Court Rates (10 ATP Courts):**
• **Zone A (Outdoor):** ${zRateEn('OUTDOOR')}
• **Zone B (Covered Indoor):** ${zRateEn('INDOOR')}
• **Zone V (VIP Clubhouse):** ${zRateEn('VIP')}
*(Challenger tier gets 3% off, Masters gets 5% off, Grand Slam gets 8% off).*`;
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
      raw.includes('tier') ||
      raw.includes('loyalty') ||
      raw.includes('point') ||
      raw.includes('subscription') ||
      raw.includes('plan') ||
      raw.includes('vip')
    ) {
      return `👑 **Courtly Loyalty Membership Tiers:**
• **Rookie (0đ spend):** 1 pt / 10k VND, 50k welcome gift, 30k birthday voucher.
• **Challenger (from 3Mđ/12m):** 3% court discount, 1.2x points, 200 upgrade pts, 60k birthday voucher.
• **Masters (from 8Mđ/12m):** 5% court discount, 1.5x points, 500 upgrade pts, 120k birthday voucher.
• **Grand Slam (from 20Mđ/12m):** 8% court discount, 2.0x points, 1,000 upgrade pts + 300k voucher + VIP Lounge card, 250k birthday voucher.
*(Points: 1 pt = 100đ discount on court fees up to 50% or redeem reward vouchers).*`;
    }

    return `Thank you for reaching out! 🎾
Courtly Tennis Club operates 10 ATP courts daily from **06:00 to 23:00**.
Ask me about court pricing, indoor weather guarantee, referee booking, or loyalty tier benefits!`;
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
• **Thuê trọng tài (150k/h) & 4 Hạng thành viên giảm đến 8%**

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
      norm.includes('thanh vien') ||
      norm.includes('membership') ||
      norm.includes('hang') ||
      norm.includes('diem') ||
      norm.includes('loyalty') ||
      norm.includes('rookie') ||
      norm.includes('challenger') ||
      norm.includes('masters') ||
      norm.includes('grand slam')
    ) {
      return `👑 **4 Hạng thành viên Courtly (xét theo chi tiêu 12 tháng trượt):**
• **Rookie (từ 0₫):** Tích điểm 1đ/10k, voucher chào mừng 50k, voucher sinh nhật 30k.
• **Challenger (từ 3.000.000₫):** Giảm 3% tiền sân, tích điểm ×1,2, đặt trước 10 ngày, quà 200 điểm, voucher sinh nhật 60k.
• **Masters (từ 8.000.000₫):** Giảm 5% tiền sân, tích điểm ×1,5, đặt trước 14 ngày, quà 500 điểm, voucher sinh nhật 120k.
• **Grand Slam (từ 20.000.000₫):** Giảm 8% tiền sân, tích điểm ×2,0, đặt trước 21 ngày, quà 1.000 điểm + voucher 300k + thẻ VIP Lounge, voucher sinh nhật 250k.
*(Dùng điểm: 1 điểm = 100₫ trừ tiền sân tối đa 50% hoặc đổi voucher dịch vụ).*`;
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
      const zRateVi = (type) => {
        const courts = (data?.courts || []).filter(c => c.type === type && c.status !== 'DELETED');
        const rep = courts.find(c => c.status === 'ACTIVE') || courts[0];
        const p = rep ? (data?.prices || []).filter(x => x.court === rep.id) : [];
        if (!p.length) return Number(rep?.price || 160000).toLocaleString('vi-VN') + 'đ/h';
        const min = Math.min(...p.map(x => Number(x.price))), max = Math.max(...p.map(x => Number(x.price)));
        return min === max ? `${min.toLocaleString('vi-VN')}đ/h` : `từ ${min.toLocaleString('vi-VN')}đ – ${max.toLocaleString('vi-VN')}đ/h`;
      };
      return `💰 **Bảng giá thuê sân Courtly (10 sân ATP):**
• **Khu A (Ngoài trời):** ${zRateVi('OUTDOOR')}
• **Khu B (Trong nhà mái che):** ${zRateVi('INDOOR')}
• **Khu V (VIP Clubhouse):** ${zRateVi('VIP')}
*(Hạng thành viên Challenger giảm 3%, Masters giảm 5%, Grand Slam giảm 8%).*`;
    }

    return `Cảm ơn bạn đã liên hệ! 🎾
CLB Quần vợt Courtly có **10 sân tiêu chuẩn ATP**, mở cửa hàng ngày từ **06:00 đến 23:00**.
Bạn có thể hỏi tôi về bảng giá sân, dịch vụ trọng tài, check-in QR hoặc quyền lợi các hạng thành viên!`;
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
Tariff & Services:
${buildPricingKnowledge(data, true)}

${COURTLY_RULES_EN}`
      : `Bạn là Chuyên viên Trợ lý AI cao cấp của CLB Quần vợt Courtly (Courtly Tennis Club).
QUY TẮC BẮT BUỘC VỀ ĐỘ DÀI & NGỮ CẢNH ĐỐI THOẠI:
- Khung chat là CỬA SỔ POPUP NHỎ trên điện thoại và web.
- Trả lời CỰC KỲ NGẮN GỌN, SÚC TÍCH, THÂN THIỆN (tối đa 3 đến 5 dòng).
- BẮT BUỘC HIỂU NGỮ CẢNH: Khi khách hỏi tiếp nối (ví dụ: "chỉ mình chi tiết hơn", "sân đó có mái che không", "hủy thì sao"), bạn phải giải thích ĐÚNG nội dung vừa trao đổi ở tin nhắn trước, tuyệt đối không hỏi lại từ đầu làm cụt hứng khách.
- Dùng in đậm cho số tiền hoặc giờ giấc quan trọng.

Dữ liệu xác thực của CLB:
Bảng giá niêm yết theo khu & Dịch vụ:
${buildPricingKnowledge(data, false)}

${COURTLY_RULES_VI}`;

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
        '⭐ Loyalty tier benefits & points?',
        '💸 Cancellation & Refund policy?'
      ]
    : [
        '🎾 Giờ mở cửa & Bảng giá các khu sân?',
        '🌧️ Sân trong nhà Khu B khi trời mưa?',
        '👨‍⚖️ Phí thuê trọng tài & cách đặt?',
        '🎫 Hướng dẫn check-in bằng mã QR?',
        '⭐ Quyền lợi các hạng thành viên?',
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
