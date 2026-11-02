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

// Comprehensive knowledge base about Courtly Tennis Club
const COURTLY_KNOWLEDGE = `
Courtly Tennis Club là tổ hợp quần vợt cao cấp gồm 10 sân tiêu chuẩn ATP:
- Khu A (Ngoài trời · 4 sân A01–A04): Thoáng mát, rợp bóng cây, hệ thống đèn LED 500 Lux chống chói thi đấu ban đêm. Giá ban ngày (06:00-17:00): 120.000đ/giờ; Buổi tối (17:00-23:00): 180.000đ/giờ.
- Khu B (Trong nhà · 4 sân B01–B04): Mái che vòm kiên cố, cách nhiệt, hệ thống quạt hút gió mát, chơi bất chấp thời tiết mưa bão hay nắng gắt. Mặt sân Pro-Cushion giảm chấn êm ái. Giá ban ngày: 150.000đ/giờ; Buổi tối & Cuối tuần: 220.000đ/giờ.
- Khu V (Sân VIP · 2 sân V01–V02): Chuẩn thi đấu quốc tế, có phòng chờ VIP riêng biệt, sofa cao cấp, minibar phục vụ nước miễn phí. Giá từ 250.000đ - 350.000đ/giờ.
- Giờ mở cửa: 06:00 – 23:00 tất cả các ngày trong tuần (kể cả Thứ 7, Chủ Nhật và ngày lễ). Khung giờ tối thiểu là 30 phút.
- Dịch vụ Trọng tài & HLV: Có thể chọn trực tiếp khi đặt sân trên website, phí 75.000đ / 30 phút (150.000đ/giờ). Trọng tài đạt chuẩn Liên đoàn Quần vợt điều hành trận đấu, tính điểm và bắt lỗi chuẩn xác.
- Đặt sân & Giữ chỗ: Khách cần thanh toán tiền cọc 50% trong vòng 15 phút sau khi tạo đơn (chuyển khoản VietQR hoặc thẻ) để giữ sân. 50% còn lại thanh toán tại quầy khi đến chơi.
- Check-in vào sân: Sau khi đặt sân, khách mở vé điện tử QR Check-in trên website, xuất trình tại quầy lễ tân để nhân viên quét camera. Hệ thống sẽ tự động xác nhận vào sân và kích hoạt đèn chiếu sáng đúng giờ.
- Chính sách Hủy & Hoàn tiền cọc:
  + Hủy trước 24 giờ: Hoàn 100% tiền cọc (vào ví voucher CLB).
  + Hủy dưới 24 giờ: Không hoàn cọc theo quy định vận hành.
  + Đổi lịch: Hội viên được đổi lịch miễn phí trước giờ chơi 12 tiếng.
- Tiện ích đi kèm miễn phí:
  + Bãi đỗ xe rộng rãi miễn phí cho cả ô tô và xe máy, bảo vệ 24/7.
  + Phòng tắm nước nóng lạnh cao cấp, khăn tắm và xà phòng sạch sẽ miễn phí.
  + Tủ khóa đồ cá nhân (locker) an toàn.
  + Có sẵn vợt tập cho mượn và máy căng cước vợt điện tử Yonex chính xác cao tại quầy.
  + Quầy nước giải khát, nước khoáng, nước bù điện giải thể thao (Pocari, Revive).
- Gói Hội viên (Membership):
  + Club Member: 290.000đ/tháng (Giảm 10% tiền sân, đặt trước 14 ngày, miễn phí gửi xe, 1 lượt đổi lịch).
  + Member Plus: 590.000đ/tháng (Giảm 15% tiền sân thường, 10% sân VIP, phòng chờ VIP Lounge, đặt trước 21 ngày, 2 lượt đổi lịch).
- Ưu đãi thành viên mới: Tặng voucher WELCOME giảm ngay 50.000đ cho đơn đặt sân đầu tiên.
- Chính sách Công nợ & Thanh toán:
  + Khách vãng lai bắt buộc cọc tối thiểu 50% qua VietQR để giữ sân và thanh toán 100% trước khi rời sân.
  + Khách có đơn nợ quá hạn chưa thanh toán sẽ tạm thời bị khóa quyền đặt sân mới cho đến khi tất toán.
  + Hội viên doanh nghiệp / sinh hoạt định kỳ có thể ký thỏa thuận công nợ chốt định kỳ cuối tháng.
`;

const QUICK_PROMPTS = [
  '🎾 Giờ mở cửa & Bảng giá các khu sân?',
  '🌧️ Sân trong nhà Khu B khi trời mưa?',
  '👨‍⚖️ Phí thuê trọng tài & cách đặt?',
  '🎫 Hướng dẫn check-in bằng mã QR?',
  '⭐ Quyền lợi các gói Hội viên Club?',
  '💸 Chính sách hủy sân & hoàn tiền cọc?'
];

export default function AiChatbox() {
  const { t, navigate, user } = useGuest();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([
    {
      id: 'welcome',
      role: 'assistant',
      text: 'Xin chào! Tôi là Trợ lý AI của CLB Quần vợt Courtly 🎾.\nTôi có thể hỗ trợ bạn tức thì về bảng giá 10 sân, lịch trống, dịch vụ trọng tài, check-in mã QR hoặc chính sách hội viên. Bạn cần tìm hiểu thông tin gì hôm nay?'
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const chatEndRef = useRef(null);

  // System configured API key (transparent to end-users)
  const apiKey = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_GEMINI_API_KEY) || '';

  useEffect(() => {
    if (open) {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, open]);

  // Robust, comprehensive tennis club domain knowledge matcher
  const getLocalResponse = (q) => {
    const raw = q.toLowerCase().trim();
    // Normalize accents for fuzzy matching
    const norm = raw
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd');

    // 1. Cancellation & Deposit Refund Policy (Highest priority - handles "hủy", "hoàn tiền", "hoàn cọc", "đổi lịch")
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
      return `💸 **Chính sách Hủy sân & Hoàn cọc của Courtly:**
- **Hủy trước 24 giờ:** Hoàn lại **100% tiền cọc** (quy đổi vào ví Voucher tích lũy để bạn sử dụng cho lần đặt tiếp theo).
- **Hủy trong vòng dưới 24 giờ:** Không được hoàn tiền cọc do khung giờ đã được hệ thống khóa độc quyền cho bạn.
- **Trường hợp thời tiết:** Nếu gặp mưa to tại cụm sân ngoài trời Khu A, CLB sẽ chủ động chuyển sang sân trong nhà Khu B hoặc đổi lịch miễn phí 100%.
- **Cách hủy:** Bạn chỉ cần vào mục **Đơn của tôi** -> bấm nút **[Hủy đơn]** để gửi yêu cầu trực tiếp.`;
    }

    // 2. Debt & Credit Policy ("nợ", "công nợ", "ghi nợ", "chưa trả")
    if (
      norm.includes('no') ||
      norm.includes('cong no') ||
      norm.includes('ghi no') ||
      norm.includes('chua thanh toan') ||
      norm.includes('no tien') ||
      norm.includes('cho no')
    ) {
      return `📋 **Chính sách Thanh toán & Quản lý Công nợ tại Courtly:**
- **Khách vãng lai:** Bắt buộc đặt cọc tối thiểu **50% qua VietQR** để giữ chỗ và tất toán 100% trước khi rời sân. Khách hàng đang có đơn nợ quá hạn chưa thanh toán sẽ tạm thời bị khóa quyền đặt sân mới.
- **Hội viên VIP & Doanh nghiệp:** Được quyền mở hạn mức **Công nợ ký sổ (Folio)** cho toàn bộ tiền sân, dịch vụ nước uống, bóng tập và thanh toán tổng hợp một lần vào cuối tháng.
- **Tất toán nợ:** Bạn có thể thanh toán trực tiếp tại quầy tiếp tân hoặc bấm nút **[Tất toán nợ ngay]** trên thanh thông báo cá nhân.`;
    }

    // 3. Referee & Coach services (Must check before general pricing because users might ask "giá trọng tài")
    if (
      norm.includes('trong tai') ||
      norm.includes('referee') ||
      norm.includes('hlv') ||
      norm.includes('huan luyen') ||
      norm.includes('thay day') ||
      norm.includes('nhat bong') ||
      norm.includes('bat loi') ||
      norm.includes('tinh diem')
    ) {
      return `👨‍⚖️ **Dịch vụ Trọng tài & HLV chuyên nghiệp:**
- Phí thuê trọng tài: **75.000đ / 30 phút** (tương đương **150.000đ / 1 giờ**).
- **Tiêu chuẩn:** Đội ngũ trọng tài được đào tạo chuẩn Liên đoàn Quần vợt, cam kết đúng giờ, điều hành chuẩn xác, tính điểm và bắt lỗi chuyên nghiệp.
- **Cách đặt:** Khi đặt sân tại trang **Đặt sân**, bạn chỉ cần tích chọn ô *“Thuê trọng tài bắt trận”* và có thể chọn trọng tài mong muốn.`;
    }

    // 4. Membership tiers & Benefits (Check before general pricing for "giá hội viên", "gói hội viên")
    if (
      norm.includes('hoi vien') ||
      norm.includes('membership') ||
      norm.includes('thanh vien') ||
      norm.includes('member') ||
      norm.includes('plus') ||
      norm.includes('goi tap')
    ) {
      return `👑 **Các gói Hội viên Courtly Club:**
- **Gói Club Member (290.000đ/tháng):**
  • Giảm 10% tiền giờ chơi tất cả các sân
  • Đặt trước lịch sân tối đa **14 ngày**
  • Miễn phí 1 lượt đổi lịch mỗi tháng
  • Tích điểm thưởng đổi giờ chơi

- **Gói Member Plus (590.000đ/tháng):**
  • Giảm 15% sân thường & 10% sân VIP
  • Đặt trước lịch sân tối đa **21 ngày**
  • Miễn phí 2 lượt đổi lịch mỗi tháng
  • Miễn phí sử dụng phòng chờ VIP Lounge
  • Ưu tiên suất tham gia các giải đấu CLB

👉 Bạn có thể vào tab **Hội viên (Membership)** để đăng ký nâng hạng trực tiếp!`;
    }

    // 5. Indoor courts & Rainy / Hot weather (Khu B)
    if (
      norm.includes('khu b') ||
      norm.includes('trong nha') ||
      norm.includes('mua') ||
      norm.includes('nang') ||
      norm.includes('mai che') ||
      norm.includes('thoi tiet') ||
      norm.includes('nong') ||
      norm.includes('mat san b')
    ) {
      return `🏢 **Sân trong nhà Khu B (Sân B01 – B04):**
- **Mái vòm kiên cố:** Thiết kế vòm cao tiêu chuẩn quốc tế, phủ lớp cách nhiệt chống nóng và hệ thống quạt thông gió công nghiệp hút gió mát.
- **Bất chấp thời tiết:** Bạn hoàn toàn yên tâm thi đấu dù bên ngoài mưa rào hay nắng gắt.
- **Mặt sân Pro-Cushion:** Có lớp đệm cao su giảm chấn, bảo vệ khớp gối và cổ chân tối đa khi di chuyển cường độ cao.
- **Giá thuê:** 150.000đ – 220.000đ/giờ.`;
    }

    // 6. VIP courts & VIP Lounge
    if (
      norm.includes('khu v') ||
      norm.includes('vip') ||
      norm.includes('v01') ||
      norm.includes('v02') ||
      norm.includes('phong cho') ||
      norm.includes('lounge')
    ) {
      return `⭐ **Sân VIP Lounge (Khu V · Sân V01 & V02):**
- Không gian thi đấu biệt lập, mặt sân chuẩn thi đấu ATP Tour.
- **Phòng chờ VIP riêng biệt:** Trang bị máy lạnh, sofa da êm ái, minibar nước khoáng thể thao và khăn lạnh miễn phí.
- Phù hợp tiếp khách đối tác, giao lưu doanh nhân và thi đấu nội bộ đỉnh cao.
- **Giá thuê:** 250.000đ – 350.000đ/giờ.`;
    }

    // 7. QR Check-in & Electronic Ticket
    if (
      norm.includes('check in') ||
      norm.includes('checkin') ||
      norm.includes('qr') ||
      norm.includes('ve dien tu') ||
      norm.includes('vao san') ||
      norm.includes('quet') ||
      norm.includes('ticket') ||
      norm.includes('ma ve')
    ) {
      return `🎫 **Quy trình Check-in bằng mã QR tiện lợi:**

1. **Lấy mã vé:** Sau khi hoàn tất đặt sân và đặt cọc, bạn vào mục **Đơn của tôi** hoặc bấm banner **[Mở vé QR Check-in]** trên trang chủ.
2. **Xuất trình tại quầy:** Khi đến sân trước 10-15 phút, bạn đưa mã QR vé điện tử trên điện thoại cho nhân viên tiếp tân.
3. **Kích hoạt tự động:** Lễ tân quét mã chỉ mất 3 giây, hệ thống sẽ xác nhận ca chơi và tự động bật hệ thống đèn chiếu sáng đúng giờ bạn đặt!`;
    }

    // 8. General Court Pricing & Rates (Now with precise keyword matching, excluding bare "tien" that hijacks other intents)
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
      return `💰 **Bảng giá thuê sân Courtly Tennis Club:**

- **Khu A (Ngoài trời · Sân A01–A04):**
  • Ban ngày (06:00 – 17:00): **120.000đ/giờ** (60.000đ / 30 phút)
  • Giờ vàng tối (17:00 – 23:00): **180.000đ/giờ** (90.000đ / 30 phút, bao gồm đèn LED 500 Lux)

- **Khu B (Trong nhà có mái che · Sân B01–B04):**
  • Ban ngày (06:00 – 17:00): **150.000đ/giờ**
  • Buổi tối & Cuối tuần: **220.000đ/giờ** (mát mẻ, không ngại nắng mưa)

- **Khu V (Sân VIP · Sân V01–V02):**
  • Giá từ **250.000đ – 350.000đ/giờ** (đặc quyền phòng chờ VIP Lounge, sofa & nước uống miễn phí)

*(Hội viên Club Member được giảm thêm 10%, Member Plus giảm đến 15% tổng hóa đơn).*`;
    }

    // 9. Booking process & Deposit
    if (
      norm.includes('dat san') ||
      norm.includes('dat cho') ||
      norm.includes('coc') ||
      norm.includes('giu cho') ||
      norm.includes('thanh toan') ||
      norm.includes('chuyen khoan') ||
      norm.includes('vietqr') ||
      norm.includes('the atm')
    ) {
      return `💳 **Quy trình Đặt sân & Đặt cọc giữ chỗ:**
- **Bước 1:** Chọn ngày chơi, khu sân (A, B hoặc VIP) và các khung giờ 30 phút mong muốn.
- **Bước 2:** Chọn thêm dịch vụ trọng tài (nếu cần) và áp dụng mã voucher ưu đãi.
- **Bước 3:** Thanh toán **tiền cọc 50% trong vòng 15 phút** qua cổng chuyển khoản VietQR tự động hoặc thẻ ATM/Visa để hệ thống khóa sân cho bạn.
- **Bước 4:** 50% tiền sân còn lại sẽ thanh toán khi bạn đến sân check-in hoặc check-out.`;
    }

    // 9. Amenities: Parking, showers, rackets, lockers
    if (
      norm.includes('xe') ||
      norm.includes('do xe') ||
      norm.includes('gui xe') ||
      norm.includes('o to') ||
      norm.includes('tam') ||
      norm.includes('nong lanh') ||
      norm.includes('locker') ||
      norm.includes('tu do') ||
      norm.includes('vot') ||
      norm.includes('cang vot') ||
      norm.includes('cang cuoc') ||
      norm.includes('bong') ||
      norm.includes('nuoc')
    ) {
      return `🚿 **Tiện ích và dịch vụ đi kèm tại Courtly:**
- **Bãi đỗ xe:** Rộng rãi, an ninh 24/7, **hoàn toàn miễn phí** cho cả xe máy và ô tô.
- **Phòng thay đồ & Tắm:** Hệ thống vòi sen nước nóng lạnh cao cấp, có khăn tắm sạch và xà phòng miễn phí. Tủ locker khóa từ an toàn.
- **Vợt & Bóng:** Có vợt tập luyện cho mượn và bóng tiêu chuẩn thi đấu tại quầy dịch vụ.
- **Máy căng cước:** Trang bị máy căng cước điện tử Yonex độ chính xác cao, lấy ngay trong 20 phút.
- **Nước giải khát:** Quầy cafe, nước khoáng Aquafina, nước bù điện giải thể thao Pocari Sweat, Revive.`;
    }

    // 10. Membership tiers
    if (
      norm.includes('hoi vien') ||
      norm.includes('membership') ||
      norm.includes('thanh vien') ||
      norm.includes('member') ||
      norm.includes('plus') ||
      norm.includes('goi')
    ) {
      return `👑 **Các gói Hội viên Courtly Club:**
- **Gói Club Member (290.000đ/tháng):**
  • Giảm 10% tiền giờ chơi tất cả các sân
  • Đặt trước lịch sân tối đa **14 ngày**
  • Miễn phí 1 lượt đổi lịch mỗi tháng
  • Tích điểm thưởng đổi giờ chơi

- **Gói Member Plus (590.000đ/tháng):**
  • Giảm 15% sân thường & 10% sân VIP
  • Đặt trước lịch sân tối đa **21 ngày**
  • Miễn phí 2 lượt đổi lịch mỗi tháng
  • Miễn phí sử dụng phòng chờ VIP Lounge
  • Ưu tiên suất tham gia các giải đấu CLB

👉 Bạn có thể vào tab **Hội viên (Membership)** để đăng ký nâng hạng trực tiếp!`;
    }

    // 11. Promotions / Vouchers
    if (
      norm.includes('voucher') ||
      norm.includes('khuyen mai') ||
      norm.includes('giam gia') ||
      norm.includes('uu dai') ||
      norm.includes('welcome') ||
      norm.includes('ma')
    ) {
      return `🎁 **Ưu đãi & Khuyến mãi hiện có:**
- **Voucher WELCOME (-50.000đ):** Tặng ngay cho khách hàng đăng ký tài khoản mới khi đặt sân lần đầu tiên.
- **Ưu đãi giờ vàng:** Giảm giá cho các khung giờ sáng sớm (06:00 – 09:00) ngày trong tuần.
- **Mã giảm giá hội viên:** Tự động áp dụng khi đăng ký gói Club Member hoặc Member Plus.`;
    }

    // 12. Tournaments
    if (
      norm.includes('giai') ||
      norm.includes('tournament') ||
      norm.includes('nextgen') ||
      norm.includes('thi dau') ||
      norm.includes('cup')
    ) {
      return `🏆 **Giải đấu Quần vợt Courtly:**
- CLB thường xuyên tổ chức các giải đấu phong trào và bán chuyên như **NextGen Cup** và **Courtly Masters Open**.
- Thể thức thi đấu đa dạng: Đơn nam, Đơn nữ, Đôi nam nữ.
- Bạn có thể vào mục **Giải đấu** trên thanh điều hướng để xem điều lệ, lịch thi đấu và đăng ký tham gia trực tuyến!`;
    }

    // 13. Location & Contact
    if (
      norm.includes('dia chi') ||
      norm.includes('o dau') ||
      norm.includes('vi tri') ||
      norm.includes('lien he') ||
      norm.includes('so dien thoai') ||
      norm.includes('hotline') ||
      norm.includes('sdt')
    ) {
      return `📍 **Thông tin Liên hệ CLB Quần vợt Courtly:**
- **Địa chỉ:** Tổ hợp Thể thao Tennis Courtly Club (Xem chỉ đường trong tab Liên hệ).
- **Thời gian đón khách:** 06:00 – 23:00 tất cả các ngày.
- **Hotline hỗ trợ:** 0913 555 777 / 0769 496 289.
- Đội ngũ lễ tân luôn túc trực tại quầy để phục vụ và hỗ trợ quý khách!`;
    }

    // 14. Greeting / Small talk
    if (
      norm.includes('chao') ||
      norm.includes('hello') ||
      norm.includes('hi') ||
      norm.includes('hey') ||
      norm.includes('alo')
    ) {
      return `Xin chào bạn! 🎾 Rất vui được đồng hành cùng bạn tại Courtly Tennis Club.
Bạn đang tìm sân ngoài trời thoáng mát, sân trong nhà có mái che mưa nắng hay muốn tìm hiểu bảng giá và thuê trọng tài? Hãy nhắn cho tôi nhé!`;
    }

    // Default Fallback
    return `Cảm ơn câu hỏi của bạn! 🎾
CLB Quần vợt Courtly có **10 sân tiêu chuẩn ATP** (Khu A ngoài trời, Khu B trong nhà có mái che và Khu V VIP), hoạt động xuyên suốt từ **06:00 đến 23:00** hàng ngày.

Bạn có thể bấm vào các gợi ý bên dưới hoặc hỏi tôi về:
• Bảng giá chi tiết từng khu sân
• Sân trong nhà Khu B khi trời mưa
• Phí thuê trọng tài & hướng dẫn check-in QR
• Đặt cọc 50% & chính sách hủy hoàn tiền cọc`;
  };

  // Call Google Gemini API if key is available in environment
  const callGeminiApi = async (userPrompt) => {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
    const payload = {
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: `Bạn là Chuyên viên Trợ lý AI cao cấp của CLB Quần vợt Courtly (Courtly Tennis Club). Hãy trả lời câu hỏi của khách hàng bằng tiếng Việt chuẩn xác, ngắn gọn, súc tích, mang tinh thần thể thao chuyên nghiệp. Tuyệt đối không bịa đặt thông tin sai lệch so với tài liệu của CLB.

Dữ liệu xác thực của CLB:
${COURTLY_KNOWLEDGE}

Câu hỏi của khách hàng: ${userPrompt}
Hãy trình bày câu trả lời có cấu trúc rõ ràng, sử dụng gạch đầu dòng, biểu tượng emoji quần vợt và in đậm các số liệu quan trọng (giá tiền, giờ giấc).`
            }
          ]
        }
      ]
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData?.error?.message || `Lỗi kết nối Gemini API (${response.status})`);
    }

    const data = await response.json();
    const replyText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!replyText) throw new Error('Không nhận được nội dung phản hồi từ Gemini');
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
        // Natural human typing delay
        await new Promise((r) => setTimeout(r, 450));
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
          text: `Rất tiếc, đã có lỗi xảy ra: ${err.message}. Bạn vui lòng thử lại sau giây lát!`
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* FLOATING TRIGGER BUTTON */}
      <aside aria-label="Courtly AI Assistant" style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 999 }}>
        {!open && (
          <button
            type="button"
            onClick={() => setOpen(true)}
            style={{
              background: 'linear-gradient(135deg, #173c32 0%, #1e4d40 100%)',
              color: '#def46a',
              border: '2px solid #def46a',
              borderRadius: '50px',
              padding: '12px 20px',
              boxShadow: '0 8px 25px rgba(23,60,50,0.35)',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              cursor: 'pointer',
              fontWeight: 700,
              fontSize: 14,
              transition: 'all 0.25s ease'
            }}
          >
            <span style={{ fontSize: 20 }}>🎾</span>
            <span style={{ color: '#ffffff' }}>Trợ lý AI Courtly</span>
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
              Trực tuyến
            </span>
          </button>
        )}
      </aside>

      {/* CHAT WINDOW FLYOUT */}
      {open && (
        <div
          role="region"
          aria-label="Courtly AI Chatbox"
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
          {/* HEADER */}
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
                  Trợ lý Tennis Courtly
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
                  Hỗ trợ trực tuyến 24/7
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setOpen(false)}
              title="Đóng trợ lý"
              aria-label="Đóng trợ lý"
              style={{
                background: 'rgba(255,255,255,0.12)',
                color: '#ffffff',
                border: 'none',
                borderRadius: '50%',
                width: 30,
                height: 30,
                display: 'grid',
                placeItems: 'center',
                cursor: 'pointer',
                fontSize: 16
              }}
            >
              <X size={16} />
            </button>
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
                      maxWidth: '82%',
                      background: isUser ? '#173c32' : '#ffffff',
                      color: isUser ? '#ffffff' : '#1f2937',
                      padding: '10px 14px',
                      borderRadius: isUser ? '14px 14px 2px 14px' : '14px 14px 14px 2px',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
                      border: isUser ? 'none' : '1px solid #e3e8de',
                      fontSize: 13,
                      lineHeight: 1.6,
                      whiteSpace: 'pre-line'
                    }}
                  >
                    {m.text}
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
                  <span>Courtly AI đang soạn phản hồi…</span>
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
            {QUICK_PROMPTS.map((prompt, idx) => (
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
              placeholder="Hỏi về giá sân, giờ mở, cọc, QR check-in..."
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
