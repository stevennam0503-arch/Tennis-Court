import React, { useState, useEffect, useRef } from 'react';
import {
  MessageSquare,
  Send,
  Sparkles,
  Bot,
  X,
  Key,
  RefreshCw,
  ChevronDown,
  ExternalLink,
  CheckCircle2,
  HelpCircle
} from 'lucide-react';
import { useGuest } from './context';

// Comprehensive knowledge base about Courtly Tennis Club
const COURTLY_KNOWLEDGE = `
Courtly Tennis Club là tổ hợp quần vợt cao cấp gồm 10 sân tiêu chuẩn ATP:
- Khu A (Ngoài trời · 4 sân A01–A04): Thoáng mát, rợp bóng cây, hệ thống đèn LED 500 Lux chống chói thi đấu ban đêm. Giá từ 120.000đ - 180.000đ/giờ.
- Khu B (Trong nhà · 4 sân B01–B04): Mái che vòm kiên cố, cách nhiệt, hệ thống quạt hút gió mát, chơi bất chấp thời tiết nắng mưa. Mặt sân giảm chấn êm ái. Giá từ 150.000đ - 220.000đ/giờ.
- Khu V (Sân VIP · 2 sân V01–V02): Chuẩn thi đấu quốc tế, có phòng chờ VIP riêng biệt, sofa cao cấp, minibar phục vụ nước miễn phí. Giá từ 250.000đ - 350.000đ/giờ.
- Giờ mở cửa: 06:00 – 23:00 tất cả các ngày trong tuần (kể cả lễ, Tết).
- Dịch vụ Trọng tài & HLV: Có thể thuê trực tiếp khi đặt sân, phí từ 75.000đ / 30 phút. Trọng tài đạt chuẩn Liên đoàn điều hành trận đấu.
- Đặt sân & Giữ chỗ: Khách cần thanh toán tiền cọc 30% - 50% trong vòng 15 phút để đảm bảo giữ chỗ.
- Check-in vào sân: Khách mở vé điện tử QR Check-in trên trang web, đưa nhân viên lễ tân tại quầy quét mã QR để mở cửa sân và bật đèn tự động.
- Chính sách Hủy & Hoàn tiền:
  + Hủy trước 24 giờ: Hoàn 80% - 100% tiền cọc (theo chính sách CLB hoặc chuyển thành điểm voucher).
  + Hủy dưới 24 giờ: Không hoàn cọc theo quy định vận hành.
- Gói Hội viên (Membership):
  + Club Member: Giảm 10% tiền sân, đặt trước tối đa 14 ngày, miễn phí gửi xe, 1 lượt đổi lịch.
  + Member Plus: Giảm 15% tiền sân thường, 10% sân VIP, phòng chờ VIP Lounge, đặt trước tối đa 21 ngày, 2 lượt đổi lịch.
- Tiện ích đi kèm: Bãi giữ xe rộng rãi miễn phí cho ô tô và xe máy, phòng tắm nóng lạnh & tủ khóa locker bảo mật, quầy cafe giải khát bù khoáng thể thao, máy căng vợt điện tử.
`;

const QUICK_PROMPTS = [
  '🎾 Giờ mở cửa & Bảng giá sân?',
  '🌧️ Sân trong nhà Khu B ra sao?',
  '👨‍⚖️ Cách thuê trọng tài trên web?',
  '🎫 Cách dùng vé QR Check-in?',
  '⭐ Quyền lợi các gói Hội viên?',
  '💸 Chính sách hủy sân & hoàn tiền?'
];

export default function AiChatbox() {
  const { t, navigate, user } = useGuest();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([
    {
      id: 'welcome',
      role: 'assistant',
      text: 'Xin chào! Tôi là Trợ lý AI của CLB Quần vợt Courtly 🎾.\nTôi có thể hỗ trợ bạn tra cứu lịch sân, bảng giá, dịch vụ trọng tài, check-in bằng mã QR hoặc quyền lợi hội viên. Bạn cần tôi hỗ trợ điều gì hôm nay?'
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [apiKey, setApiKey] = useState(() => {
    try {
      return localStorage.getItem('courtly_gemini_api_key') || import.meta.env.VITE_GEMINI_API_KEY || '';
    } catch {
      return '';
    }
  });
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [tempKey, setTempKey] = useState('');
  const chatEndRef = useRef(null);

  useEffect(() => {
    if (open) {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, open]);

  // Local rule-based fallback response engine
  const getLocalResponse = (q) => {
    const query = q.toLowerCase();
    if (query.includes('giá') || query.includes('bao nhiêu') || query.includes('tiền') || query.includes('bảng giá')) {
      return '💰 **Bảng giá thuê sân Courtly Tennis:**\n\n- **Khu A (Ngoài trời):** 120.000đ – 180.000đ/giờ\n- **Khu B (Trong nhà có mái che):** 150.000đ – 220.000đ/giờ\n- **Khu V (Sân VIP Lounge):** 250.000đ – 350.000đ/giờ\n\n*(Khung giờ sau 17:00 các ngày trong tuần và cuối tuần áp dụng giá cao điểm. Hội viên được giảm thêm 10% - 15%).*';
    }
    if (query.includes('giờ mở') || query.includes('mấy giờ') || query.includes('thời gian')) {
      return '⏰ **Giờ hoạt động:**\nCLB mở cửa từ **06:00 đến 23:00** tất cả các ngày trong tuần (kể cả Thứ 7, Chủ Nhật và ngày lễ). Bạn có thể đặt sân theo từng khung giờ 30 phút hoặc liên tục nhiều giờ.';
    }
    if (query.includes('khu b') || query.includes('trong nhà') || query.includes('mưa')) {
      return '🏢 **Sân trong nhà Khu B (B01 - B04):**\nĐược trang bị mái vòm thép kiên cố, chống nóng cách nhiệt và quạt hút thông gió. Giúp bạn thi đấu thoải mái bất chấp trời mưa to hay nắng gắt. Mặt sân có lớp đệm giảm chấn thương êm ái!';
    }
    if (query.includes('trọng tài') || query.includes('hlv') || query.includes('huấn luyện')) {
      return '👨‍⚖️ **Dịch vụ Trọng tài & Huấn luyện viên:**\nBạn có thể tích chọn thuê trọng tài ngay ở bước đặt sân. Phí dịch vụ từ **75.000đ / 30 phút**. Trọng tài đạt chuẩn Liên đoàn sẽ có mặt đúng giờ để điều hành trận đấu, tính điểm và bắt lỗi chuẩn xác.';
    }
    if (query.includes('check-in') || query.includes('checkin') || query.includes('qr') || query.includes('vào sân')) {
      return '🎫 **Hướng dẫn Check-in bằng mã QR:**\n\n1. Sau khi đặt sân, bạn vào mục **Đơn của tôi** hoặc bấm nút **[Open QR Check-in Ticket]** trên thanh thông báo.\n2. Mở mã QR vé điện tử trên điện thoại.\n3. Đưa mã QR cho nhân viên lễ tân tại quầy quét camera để hệ thống tự động xác nhận vào sân và bật đèn chiếu sáng!';
    }
    if (query.includes('hội viên') || query.includes('membership') || query.includes('gói')) {
      return '⭐ **Chính sách Hội viên Courtly Club:**\n\n- **Club Member:** Giảm 10% tiền sân, đặt trước 14 ngày, miễn phí gửi xe.\n- **Member Plus:** Giảm 15% sân thường, 10% sân VIP, phòng chờ VIP Lounge, đặt trước 21 ngày và miễn phí đổi lịch 2 lần.\n\n👉 Bạn có thể vào tab **Membership** trên thanh menu để đăng ký ngay!';
    }
    if (query.includes('hủy') || query.includes('hoàn tiền') || query.includes('đổi')) {
      return '💸 **Chính sách Hủy sân & Hoàn cọc:**\n\n- **Hủy trước 24 giờ:** Được hoàn lại 80% – 100% tiền cọc (theo quy chế CLB hoặc hoàn vào ví voucher).\n- **Hủy dưới 24 giờ:** Không được hoàn tiền cọc do sân đã được giữ chỗ riêng.\n- Khách hàng có thể bấm nút **[Hủy đơn]** trong chi tiết đơn đặt sân để gửi yêu cầu.';
    }
    if (query.includes('chào') || query.includes('hello') || query.includes('hi')) {
      return 'Xin chào bạn! 🎾 Bạn đang quan tâm đến việc đặt sân, xem bảng giá hay tìm hiểu giải đấu tại Courtly? Hãy cứ hỏi tôi nhé!';
    }
    return 'Cảm ơn câu hỏi của bạn về Courtly Tennis Club! 🎾\n\nCourtly hiện có **10 sân tiêu chuẩn ATP** (Khu A ngoài trời, Khu B mái che trong nhà và Khu V VIP), mở cửa từ 06:00 đến 23:00 hàng ngày. Bạn có thể bấm vào các gợi ý bên dưới hoặc hỏi chi tiết về giá sân, trọng tài, check-in QR hoặc hội viên nhé!';
  };

  // Call Google Gemini API
  const callGeminiApi = async (userPrompt) => {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
    const payload = {
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: `Bạn là Trợ lý AI thông minh, tận tâm và thân thiện của CLB Quần vợt Courtly (Courtly Tennis Club). Hãy trả lời người chơi quần vợt bằng tiếng Việt ngắn gọn, chuyên nghiệp, truyền cảm hứng thể thao.\n\nThông tin CLB:\n${COURTLY_KNOWLEDGE}\n\nCâu hỏi của khách hàng: ${userPrompt}`
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
      throw new Error(errData?.error?.message || `Lỗi Gemini API: ${response.status}`);
    }

    const data = await response.json();
    const replyText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!replyText) throw new Error('Không nhận được phản hồi từ Gemini');
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
          botReply = `${getLocalResponse(q)}\n\n*(Lưu ý: Đang dùng bộ hỗ trợ cục bộ do kết nối Gemini API gặp gián đoạn: ${apiErr.message})*`;
        }
      } else {
        // Simulated natural delay for local engine
        await new Promise((r) => setTimeout(r, 600));
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
          text: `Rất tiếc, đã có lỗi xảy ra: ${err.message}. Bạn có thể thử lại sau giây lát!`
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const saveCustomKey = () => {
    try {
      localStorage.setItem('courtly_gemini_api_key', tempKey.trim());
      setApiKey(tempKey.trim());
      setShowKeyModal(false);
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          role: 'assistant',
          text: tempKey.trim()
            ? '✓ Đã cập nhật Gemini API Key thành công! Giờ đây bạn có thể trò chuyện tự do với Google Gemini AI.'
            : 'Đã xóa API Key. Hệ thống chuyển về Trợ lý thông minh Courtly Smart AI.'
        }
      ]);
    } catch (e) {
      alert('Không thể lưu key: ' + e.message);
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
              {apiKey ? 'Gemini AI' : 'Hỏi đáp'}
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
            width: 'min(400px, calc(100vw - 32px))',
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
                  Courtly AI Assistant
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
                  {apiKey ? 'Powered by Google Gemini' : 'Courtly Smart Assistant (Online)'}
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <button
                type="button"
                onClick={() => {
                  setTempKey(apiKey);
                  setShowKeyModal(true);
                }}
                title="Cài đặt Gemini API Key"
                style={{
                  background: 'rgba(255,255,255,0.12)',
                  color: '#def46a',
                  border: 'none',
                  borderRadius: 6,
                  padding: 6,
                  cursor: 'pointer'
                }}
              >
                <Key size={16} />
              </button>

              <button
                type="button"
                onClick={() => setOpen(false)}
                title="Đóng chatbox"
                style={{
                  background: 'transparent',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: 6,
                  padding: 6,
                  cursor: 'pointer',
                  fontSize: 18
                }}
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* API KEY CONFIG MODAL */}
          {showKeyModal && (
            <div
              style={{
                background: '#f4f6ef',
                borderBottom: '1px solid #d1dac4',
                padding: '12px 16px',
                fontSize: 12.5
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontWeight: 700 }}>
                <span>🔑 Cài đặt Google Gemini API Key:</span>
                <button
                  type="button"
                  onClick={() => setShowKeyModal(false)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#637269' }}
                >
                  ✕
                </button>
              </div>
              <input
                type="password"
                placeholder="Dán API Key (AIzaSy...)"
                value={tempKey}
                onChange={(e) => setTempKey(e.target.value)}
                style={{
                  width: '100%',
                  padding: '7px 10px',
                  borderRadius: 6,
                  border: '1px solid #b5c3ad',
                  fontSize: 12,
                  marginBottom: 8
                }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 11, color: '#637269' }}>
                  {apiKey ? '✓ Đang dùng key tùy chỉnh' : 'Chưa có key (dùng bộ nội bộ)'}
                </span>
                <button
                  type="button"
                  onClick={saveCustomKey}
                  style={{
                    background: '#173c32',
                    color: '#def46a',
                    border: 'none',
                    borderRadius: 6,
                    padding: '5px 12px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    fontSize: 12
                  }}
                >
                  Lưu Key
                </button>
              </div>
            </div>
          )}

          {/* CHAT MESSAGES AREA */}
          <div
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: '16px',
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
              background: '#f9faf7'
            }}
          >
            {messages.map((m) => {
              const isUser = m.role === 'user';
              return (
                <div
                  key={m.id}
                  style={{
                    display: 'flex',
                    justifyContent: isUser ? 'flex-end' : 'flex-start',
                    gap: 8,
                    alignItems: 'flex-start'
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
                        fontSize: 14,
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
                      padding: '10px 14px',
                      borderRadius: isUser ? '14px 14px 2px 14px' : '14px 14px 14px 2px',
                      background: isUser ? '#173c32' : '#ffffff',
                      color: isUser ? '#ffffff' : '#152a22',
                      fontSize: 13,
                      lineHeight: 1.55,
                      boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
                      border: isUser ? 'none' : '1px solid #e1e7db',
                      whiteSpace: 'pre-wrap'
                    }}
                  >
                    {m.text}
                  </div>
                </div>
              );
            })}

            {loading && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#59635d', fontSize: 12.5 }}>
                <div
                  style={{
                    width: 26,
                    height: 26,
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
                <span>Courtly AI đang soạn câu trả lời…</span>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* QUICK PROMPT CHIPS */}
          <div
            style={{
              padding: '8px 14px',
              background: '#f4f6ef',
              borderTop: '1px solid #e2e8dc',
              display: 'flex',
              gap: 6,
              overflowX: 'auto',
              whiteSpace: 'nowrap'
            }}
          >
            {QUICK_PROMPTS.map((p, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleSend(p)}
                style={{
                  background: '#ffffff',
                  border: '1px solid #cfd5c8',
                  borderRadius: 14,
                  padding: '4px 10px',
                  fontSize: 11.5,
                  color: '#173c32',
                  cursor: 'pointer',
                  flexShrink: 0,
                  fontWeight: 500
                }}
              >
                {p}
              </button>
            ))}
          </div>

          {/* INPUT BAR */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            style={{
              padding: '12px 14px',
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
              placeholder="Nhắn tin với Trợ lý AI Courtly…"
              style={{
                flex: 1,
                border: '1px solid #cfd5c8',
                borderRadius: 20,
                padding: '9px 14px',
                fontSize: 13,
                outline: 'none',
                minHeight: 'unset'
              }}
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              style={{
                width: 38,
                height: 38,
                borderRadius: '50%',
                background: input.trim() && !loading ? '#173c32' : '#d1dac4',
                color: input.trim() && !loading ? '#def46a' : '#ffffff',
                border: 'none',
                display: 'grid',
                placeItems: 'center',
                cursor: input.trim() && !loading ? 'pointer' : 'not-allowed',
                flexShrink: 0,
                minHeight: 'unset',
                transition: 'all 0.15s ease'
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
