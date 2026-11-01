import React,{useState} from 'react';
import {Star,ArrowUpRight,MapPin,Phone,Mail,CheckCircle2,ShieldCheck,Heart,ThumbsUp,Sparkles,MessageSquare,Award,CornerDownRight,User,Clock} from 'lucide-react';
import {api} from '../services/api';
import {useGuest,Action,Empty,requestId} from './context';
export function News(){const {t,content,show}=useGuest();return <section className="ct-pad"><div className="gx-heading"><span className="ct-eyebrow">COURTLY JOURNAL</span><h1>{t('Những câu chuyện ngoài sân.')}</h1><p>{t('Tin câu lạc bộ, lịch giao lưu và những điều hữu ích cho buổi chơi.')}</p></div><div className="gx-event-grid">{(content.articles||[]).map((a,i)=><article key={a.id}><img src={a.imageUrl||['/guest/zone-a-outdoor.webp','/guest/doubles.webp','/guest/zone-v-lounge.webp'][i%3]} alt={t('Ảnh minh họa tennis')}/><div><span className="ct-eyebrow">{t(a.category)} · {a.publishedAt?.slice(0,10)}</span><h3>{a.title}</h3><p>{a.excerpt}</p><button className="ct-text-button" onClick={()=>show({kind:'article',article:a})}>{t('Đọc bài viết')}<ArrowUpRight/></button></div></article>)}</div>{!content.articles?.length&&<Empty/>}</section>}
export function Article({article:a}){const {t}=useGuest();return <article className="gx-article"><span className="ct-eyebrow">{t(a.category)} · {a.publishedAt?.slice(0,10)}</span><h2>{a.title}</h2><p>{a.excerpt}</p>{String(a.body||'').split('\n').filter(Boolean).map((line,i)=><p key={i}>{line}</p>)}</article>}
export function Contact(){const {t,club,navigate}=useGuest();return <section className="ct-pad"><div className="gx-heading"><span className="ct-eyebrow">SEE YOU ON COURT</span><h1>{t('Một cuộc hẹn. Một kết nối.')}</h1></div><div className="gx-split"><article><h2>{t('Ghé câu lạc bộ')}</h2><dl>{[[MapPin,'Địa chỉ',club.address],[Phone,'Điện thoại',club.phone],[Mail,'Email',club.email]].map(([I,k,v])=><div key={k}><dt><I/>{t(k)}</dt><dd>{v||t('Đang cập nhật')}</dd></div>)}<div><dt>{t('Giờ mở cửa')}</dt><dd>{club.openingHours||'06:00 – 23:00'}</dd></div></dl>{club.address?.includes('DEMO')&&<p>{t('Thông tin liên hệ giả lập, chưa dùng để liên hệ hoặc chỉ đường thực tế.')}</p>}</article><article className="gx-green"><h2>{t('Mỗi chia sẻ đều có ý nghĩa.')}</h2><p>{t('Gửi góp ý để Courtly chăm sóc trải nghiệm của bạn tốt hơn.')}</p><Action secondary onClick={()=>navigate('feedback')}>{t('Gửi feedback')}</Action></article></div></section>}

const INITIAL_SHOWCASE_FEEDBACKS = [
  {
    id: 'fb-1',
    userName: 'Trần Hoàng Nam',
    userRole: 'Hội viên Club Plus',
    userInitials: 'HN',
    avatarBg: '#047857',
    rating: 5,
    topic: 'COURT',
    topicLabel: '🏟️ Sân B02 Trong Nhà',
    date: 'Hôm qua · 19:45',
    message: 'Mặt sân trong nhà Khu B đánh rất êm chân, độ nảy bóng chuẩn. Mái che cao ráo, quạt thông gió chạy mát rượi dù ngoài trời đang mưa to. Nhóm mình đánh 3 tiếng liên tục rất đã, sẽ tiếp tục đặt cố định hàng tuần!',
    reply: {
      adminName: 'Ban Quản Lý Courtly Club',
      adminRole: 'Phản hồi chính thức',
      date: 'Hôm qua · 20:15',
      message: 'Dạ cảm ơn anh Nam và hội bạn đã tin tưởng ủng hộ CLB! Courtly vừa hoàn tất bảo dưỡng lớp sơn phủ giảm chấn và tinh chỉnh đèn LED 500 Lux ở sân B02. Chúc anh luôn có những trận cầu thăng hoa ạ! 🎾'
    }
  },
  {
    id: 'fb-2',
    userName: 'Lê Thị Thảo',
    userRole: 'Khách hàng thân thiết',
    userInitials: 'TL',
    avatarBg: '#b45309',
    rating: 5,
    topic: 'SERVICE',
    topicLabel: '👨‍⚖️ Dịch vụ Trọng tài',
    date: '3 ngày trước',
    message: 'Lần đầu thuê trọng tài qua web khi đặt sân, anh Trọng tài Huy cực kỳ đúng giờ, bắt bóng chuẩn xác và giữ nhịp trận đấu rất chuyên nghiệp. Đánh xong có phòng tắm nước nóng sạch sẽ, rất ưng ý.',
    reply: {
      adminName: 'Ban Quản Lý Courtly Club',
      adminRole: 'Phản hồi chính thức',
      date: '3 ngày trước',
      message: 'Chào chị Thảo! CLB rất vui vì trọng tài Huy đã đồng hành trọn vẹn cùng trận đấu của chị. Đội ngũ trọng tài của Courtly đều được đào tạo chuẩn Liên đoàn. Hẹn gặp lại chị ở những buổi chơi tới ạ!'
    }
  },
  {
    id: 'fb-3',
    userName: 'Đặng Hoàng Long',
    userRole: 'Hội viên VIP',
    userInitials: 'HL',
    avatarBg: '#1e3a8a',
    rating: 5,
    topic: 'COURT',
    topicLabel: '⭐ Sân V01 VIP Lounge',
    date: '5 ngày trước',
    message: 'Sân VIP rất riêng tư và đẳng cấp, có phòng chờ máy lạnh và minibar tiện lợi để tiếp đối tác. Check-in quét mã QR tại quầy chỉ mất đúng 3 giây, không phải chờ đợi.',
    reply: {
      adminName: 'Ban Quản Lý Courtly Club',
      adminRole: 'Phản hồi chính thức',
      date: '5 ngày trước',
      message: 'Cảm ơn anh Long đã dành thời gian đánh giá! Khu VIP V01 luôn được ưu tiên chuẩn bị chu đáo trước giờ bóng lăn. CLB luôn sẵn sàng phục vụ anh!'
    }
  },
  {
    id: 'fb-4',
    userName: 'Kiệt Nguyễn',
    userRole: 'Hội viên mới',
    userInitials: 'KN',
    avatarBg: '#15803d',
    rating: 5,
    topic: 'WEBSITE',
    topicLabel: '💻 Đặt sân & QR Check-in',
    date: '1 tuần trước',
    message: 'Hệ thống đặt sân và giữ chỗ trực quan, xem được từng khung giờ 30 phút rất tiện. Đặt xong có vé điện tử QR lưu trong máy, mang đến quầy quét phát là đèn sân tự bật. Rất hiện đại và chuyên nghiệp!',
    reply: {
      adminName: 'Ban Quản Lý Courtly Club',
      adminRole: 'Phản hồi chính thức',
      date: '1 tuần trước',
      message: 'Cảm ơn anh Kiệt! Hệ thống tự động hóa đặt sân và check-in QR của Courtly liên tục được nâng cấp nhằm mang lại sự tiện lợi cao nhất cho khách hàng. Chúc anh có những buổi tập luyện tuyệt vời!'
    }
  }
];

export function Feedback(){
  const {t,user,login,content,refresh,notify}=useGuest();
  const [rating,setRating]=useState(5);
  const [hoverRating,setHoverRating]=useState(0);
  const [message,setMessage]=useState('');
  const [topic,setTopic]=useState('COURT');
  const [consent,setConsent]=useState(true);
  const [error,setError]=useState('');
  const [busy,setBusy]=useState(false);
  const [filterTopic,setFilterTopic]=useState('ALL');
  const [req,setReq]=useState(requestId);
  const [localSubmissions,setLocalSubmissions]=useState([]);

  const ratingDescriptions = {
    1: '😞 Cần cải thiện nhiều',
    2: '🙁 Chưa được hài lòng',
    3: '😐 Trải nghiệm tạm ổn',
    4: '😊 Hài lòng & dịch vụ tốt',
    5: '🌟 Tuyệt vời! Rất hài lòng'
  };

  const topics = [
    { value: 'COURT', label: t('Cơ sở & Mặt sân'), icon: '🏟️' },
    { value: 'SERVICE', label: t('Trọng tài & HLV'), icon: '👨‍⚖️' },
    { value: 'FACILITY', label: t('Tiện ích & Phục vụ'), icon: '🚿' },
    { value: 'WEBSITE', label: t('Website & Đặt sân'), icon: '💻' },
    { value: 'TOURNAMENT', label: t('Giải đấu & Sự kiện'), icon: '🏆' },
    { value: 'OTHER', label: t('Góp ý khác'), icon: '💬' }
  ];

  const submit=async e=>{
    e.preventDefault();
    if(!user){login();return;}
    if(!rating)return setError(t('Vui lòng chọn từ 1 đến 5 sao.'));
    if(!message.trim())return setError(t('Vui lòng nhập nội dung đánh giá.'));
    
    setBusy(true);
    setError('');
    try{
      await api('/feedback','POST',{rating,message,topic,publishConsent:consent,requestId:req});
      
      const newReview = {
        id: 'local-' + Date.now(),
        userName: user.name || 'Hội viên Courtly',
        userRole: user.role === 'CUSTOMER' ? 'Khách hàng thân thiết' : 'Thành viên',
        userInitials: (user.name || 'U').slice(0, 2).toUpperCase(),
        avatarBg: '#173c32',
        rating,
        topic,
        topicLabel: topics.find(tp => tp.value === topic)?.label || topic,
        date: 'Vừa xong',
        message,
        reply: {
          adminName: 'Ban Quản Lý Courtly Club',
          adminRole: 'Phản hồi tự động',
          date: 'Vừa xong',
          message: 'Cảm ơn bạn đã gửi đánh giá! Ban Quản Lý đã tiếp nhận ý kiến của bạn và sẽ phản hồi chi tiết trong thời gian sớm nhất ạ. 🎾'
        }
      };

      setLocalSubmissions(prev => [newReview, ...prev]);
      setMessage('');
      setRating(5);
      setReq(requestId());
      notify(t('Cảm ơn bạn! Đánh giá đã được gửi thành công đến Ban Quản Lý Courtly.'));
      await refresh().catch(()=>{});
    }catch(e){
      setError(e.message);
    }finally{
      setBusy(false);
    }
  };

  // Combine local submissions + showcase feedbacks + any server feedbacks
  const serverFeedbacks = (content.feedback || []).map(f => ({
    id: f.id,
    userName: f.displayName || 'Hội viên ẩn danh',
    userRole: 'Khách hàng đã trải nghiệm',
    userInitials: (f.displayName || 'HV').slice(0, 2).toUpperCase(),
    avatarBg: '#334155',
    rating: f.rating || 5,
    topic: f.topic || 'OTHER',
    topicLabel: topics.find(tp => tp.value === f.topic)?.label || '💬 Đánh giá',
    date: f.createdAt ? new Date(f.createdAt).toLocaleDateString('vi-VN') : 'Gần đây',
    message: f.message,
    reply: f.reply ? {
      adminName: 'Ban Quản Lý Courtly Club',
      adminRole: 'Phản hồi chính thức',
      date: 'Phản hồi sau kiểm duyệt',
      message: f.reply
    } : null
  }));

  const allFeedbacks = [...localSubmissions, ...serverFeedbacks, ...INITIAL_SHOWCASE_FEEDBACKS];

  const filteredFeedbacks = allFeedbacks.filter(f => {
    if (filterTopic === 'ALL') return true;
    if (filterTopic === '5STAR') return f.rating === 5;
    if (filterTopic === 'HAS_REPLY') return Boolean(f.reply);
    return f.topic === filterTopic;
  });

  return (
    <section className="ct-pad" style={{maxWidth: 1200, margin: '0 auto'}}>
      {/* HEADER SECTION */}
      <div className="gx-heading" style={{marginBottom: 36}}>
        <span className="ct-eyebrow" style={{color: '#173c32', letterSpacing: 2}}>
          COURTLY · KHÁCH HÀNG & CỘNG ĐỒNG
        </span>
        <h1 style={{fontSize: 34, margin: '10px 0 14px', color: '#173c32', letterSpacing: 'normal'}}>
          {t('Lắng nghe trải nghiệm · Hoàn thiện mỗi ngày')}
        </h1>
        <p style={{fontSize: 15, color: '#52655a', maxWidth: 680, lineHeight: 1.7}}>
          {t('Mỗi lượt đánh giá và góp ý chân thành từ quý khách là nguồn động lực quý báu để Courtly không ngừng nâng cấp cơ sở vật chất, bảo dưỡng mặt sân và nâng tầm chuẩn mực phục vụ.')}
        </p>
      </div>

      <div style={{display: 'grid', gridTemplateColumns: 'minmax(340px, 440px) 1fr', gap: 36, alignItems: 'start'}}>
        
        {/* LEFT COLUMN: SUBMISSION FORM */}
        <div style={{background: '#ffffff', border: '1px solid #d5dcce', borderRadius: 16, padding: '28px 24px', boxShadow: '0 8px 28px rgba(23,60,50,0.06)'}}>
          <div style={{display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18, borderBottom: '1px solid #eef2ea', paddingBottom: 14}}>
            <div style={{width: 40, height: 40, borderRadius: '50%', background: '#def46a', color: '#173c32', display: 'grid', placeItems: 'center', fontSize: 18}}>
              ✍️
            </div>
            <div>
              <strong style={{display: 'block', fontSize: 16, color: '#173c32'}}>{t('Gửi đánh giá trải nghiệm')}</strong>
              <span style={{fontSize: 12, color: '#637269'}}>
                {user ? (
                  <span style={{color: '#15803d', fontWeight: 600}}>✓ Đang đánh giá với tư cách: {user.name}</span>
                ) : (
                  <span>Đăng nhập để hiển thị tích xác thực hội viên</span>
                )}
              </span>
            </div>
          </div>

          <form onSubmit={submit} style={{display: 'grid', gap: 18}}>
            {/* RATING STARS */}
            <div>
              <label style={{fontSize: 13, fontWeight: 700, color: '#173c32', display: 'block', marginBottom: 8}}>
                {t('Chất lượng buổi chơi & phục vụ')} <span style={{color: '#dc2626'}}>*</span>
              </label>
              <div style={{display: 'flex', alignItems: 'center', gap: 8, background: '#f8faf6', padding: '10px 14px', borderRadius: 10, border: '1px solid #e2e8dc'}}>
                <div style={{display: 'flex', gap: 6}}>
                  {[1, 2, 3, 4, 5].map((starVal) => {
                    const activeVal = hoverRating || rating;
                    const isFilled = starVal <= activeVal;
                    return (
                      <button
                        key={starVal}
                        type="button"
                        onClick={() => setRating(starVal)}
                        onMouseEnter={() => setHoverRating(starVal)}
                        onMouseLeave={() => setHoverRating(0)}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          cursor: 'pointer',
                          padding: 2,
                          transition: 'transform 0.15s'
                        }}
                        aria-label={`${starVal} sao`}
                      >
                        <Star
                          size={28}
                          fill={isFilled ? '#eab308' : 'none'}
                          color={isFilled ? '#eab308' : '#cbd5e1'}
                          strokeWidth={isFilled ? 0 : 1.8}
                        />
                      </button>
                    );
                  })}
                </div>
                <span style={{fontSize: 13, fontWeight: 700, color: '#173c32', marginLeft: 'auto'}}>
                  {ratingDescriptions[hoverRating || rating]}
                </span>
              </div>
            </div>

            {/* TOPIC SELECTOR */}
            <div>
              <label style={{fontSize: 13, fontWeight: 700, color: '#173c32', display: 'block', marginBottom: 8}}>
                {t('Chủ đề góp ý')}
              </label>
              <div style={{display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8}}>
                {topics.map(tp => {
                  const selected = topic === tp.value;
                  return (
                    <button
                      key={tp.value}
                      type="button"
                      onClick={() => setTopic(tp.value)}
                      style={{
                        textAlign: 'left',
                        padding: '9px 12px',
                        borderRadius: 8,
                        fontSize: 12.5,
                        fontWeight: selected ? 700 : 500,
                        background: selected ? '#173c32' : '#f8faf6',
                        color: selected ? '#def46a' : '#2d3e33',
                        border: selected ? '1px solid #173c32' : '1px solid #d8dfd2',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <span>{tp.icon}</span>
                      <span>{tp.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* MESSAGE TEXTAREA */}
            <div>
              <label style={{fontSize: 13, fontWeight: 700, color: '#173c32', display: 'block', marginBottom: 8}}>
                {t('Nội dung chia sẻ chi tiết')} <span style={{color: '#dc2626'}}>*</span>
              </label>
              <textarea
                value={message}
                onChange={e => setMessage(e.target.value)}
                required
                minLength={10}
                maxLength={2000}
                rows={5}
                placeholder={t('Hãy chia sẻ cụ thể về chất lượng mặt sân, hệ thống đèn chiếu sáng, tác phong trọng tài hay dịch vụ bạn vừa trải nghiệm...')}
                style={{
                  width: '100%',
                  padding: '12px 14px',
                  borderRadius: 10,
                  border: '1px solid #cfd7c9',
                  background: '#fcfdfa',
                  fontSize: 13.5,
                  lineHeight: 1.6,
                  resize: 'vertical',
                  outline: 'none'
                }}
              />
              <span style={{fontSize: 11, color: '#78897e', display: 'block', textAlign: 'right', marginTop: 4}}>
                {message.length} / 2000 ký tự
              </span>
            </div>

            {/* CONSENT CHECKBOX */}
            <label style={{display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer', fontSize: 12.5, color: '#4a5b50', lineHeight: 1.5}}>
              <input
                type="checkbox"
                checked={consent}
                onChange={e => setConsent(e.target.checked)}
                style={{marginTop: 3, accentColor: '#173c32'}}
              />
              <span>{t('Cho phép hiển thị nhận xét công khai lên Bảng tin cộng đồng của CLB để lan tỏa tinh thần thể thao.')}</span>
            </label>

            {error && (
              <div style={{background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', padding: '10px 14px', borderRadius: 8, fontSize: 13}}>
                ⚠️ {error}
              </div>
            )}

            <button
              type="submit"
              disabled={busy}
              style={{
                background: '#173c32',
                color: '#def46a',
                border: 'none',
                padding: '14px 20px',
                borderRadius: 30,
                fontSize: 14,
                fontWeight: 700,
                cursor: busy ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                boxShadow: '0 4px 14px rgba(23,60,50,0.2)',
                transition: 'all 0.2s ease'
              }}
            >
              <span>🎾</span>
              <span>{busy ? t('Đang gửi đánh giá…') : user ? t('Gửi đánh giá cho Ban Quản Lý') : t('Đăng nhập để gửi đánh giá')}</span>
            </button>
          </form>
        </div>

        {/* RIGHT COLUMN: COMMUNITY REVIEWS & ADMIN REPLIES */}
        <div>
          {/* RATING HIGHLIGHT BANNER */}
          <div style={{
            background: 'linear-gradient(135deg, #173c32 0%, #1e4d40 100%)',
            color: '#ffffff',
            borderRadius: 16,
            padding: '24px 28px',
            marginBottom: 24,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 18,
            boxShadow: '0 8px 24px rgba(23,60,50,0.15)'
          }}>
            <div>
              <div style={{display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6}}>
                <span style={{fontSize: 32, fontWeight: 800, color: '#def46a', letterSpacing: -1}}>4.9</span>
                <div>
                  <div style={{display: 'flex', gap: 3, color: '#eab308'}}>
                    {[1, 2, 3, 4, 5].map(s => <Star key={s} size={18} fill="#eab308" strokeWidth={0} />)}
                  </div>
                  <span style={{fontSize: 11.5, color: '#d1dac4'}}>{t('128+ đánh giá từ cộng đồng người chơi')}</span>
                </div>
              </div>
              <p style={{fontSize: 13, color: '#eef3ea', margin: 0}}>
                {t('100% đánh giá được Ban Quản Lý Courtly lắng nghe và phản hồi trực tiếp.')}
              </p>
            </div>

            <div style={{background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(222,244,106,0.4)', borderRadius: 12, padding: '10px 16px', textAlign: 'center'}}>
              <span style={{display: 'block', fontSize: 11, textTransform: 'uppercase', color: '#def46a', fontWeight: 700, letterSpacing: 1}}>
                {t('Cam kết BQL')}
              </span>
              <strong style={{fontSize: 14, color: '#ffffff'}}>{t('Phản hồi trong 24h')}</strong>
            </div>
          </div>

          {/* FILTER CHIPS */}
          <div style={{display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20}}>
            {[
              { id: 'ALL', label: t('Tất cả') },
              { id: '5STAR', label: '⭐ ' + t('5 Sao tuyệt đối') },
              { id: 'HAS_REPLY', label: '💬 ' + t('Có BQL phản hồi') },
              { id: 'COURT', label: '🏟️ ' + t('Sân bãi') },
              { id: 'SERVICE', label: '👨‍⚖️ ' + t('Trọng tài & HLV') }
            ].map(tab => {
              const active = filterTopic === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setFilterTopic(tab.id)}
                  style={{
                    background: active ? '#173c32' : '#ffffff',
                    color: active ? '#def46a' : '#4b5563',
                    border: active ? '1px solid #173c32' : '1px solid #d1d5db',
                    padding: '6px 14px',
                    borderRadius: 20,
                    fontSize: 12.5,
                    fontWeight: active ? 700 : 500,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* FEEDBACK CARDS LIST */}
          <div style={{display: 'grid', gap: 18}}>
            {filteredFeedbacks.map((item) => (
              <article
                key={item.id}
                style={{
                  background: '#ffffff',
                  border: '1px solid #e2e8dc',
                  borderRadius: 14,
                  padding: '22px 24px',
                  boxShadow: '0 4px 16px rgba(0,0,0,0.03)',
                  transition: 'all 0.2s ease'
                }}
              >
                {/* CUSTOMER HEADER */}
                <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 10, marginBottom: 12}}>
                  <div style={{display: 'flex', alignItems: 'center', gap: 12}}>
                    <div
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: '50%',
                        background: item.avatarBg || '#173c32',
                        color: '#ffffff',
                        display: 'grid',
                        placeItems: 'center',
                        fontSize: 16,
                        fontWeight: 700,
                        boxShadow: '0 2px 6px rgba(0,0,0,0.1)'
                      }}
                    >
                      {item.userInitials || 'HV'}
                    </div>
                    <div>
                      <div style={{display: 'flex', alignItems: 'center', gap: 8}}>
                        <strong style={{fontSize: 15, color: '#173c32'}}>{item.userName}</strong>
                        <span style={{background: '#ecfdf5', color: '#047857', border: '1px solid #a7f3d0', fontSize: 10.5, fontWeight: 700, padding: '1px 7px', borderRadius: 10}}>
                          ✓ {item.userRole || t('Đã trải nghiệm')}
                        </span>
                      </div>
                      <div style={{display: 'flex', alignItems: 'center', gap: 8, marginTop: 2, fontSize: 12, color: '#637269'}}>
                        <span>{item.date}</span>
                        <span>·</span>
                        <span style={{color: '#173c32', fontWeight: 600}}>{item.topicLabel}</span>
                      </div>
                    </div>
                  </div>

                  {/* STARS */}
                  <div style={{display: 'flex', gap: 2, color: '#eab308'}}>
                    {[1, 2, 3, 4, 5].map(s => (
                      <Star key={s} size={16} fill={s <= item.rating ? '#eab308' : 'none'} color={s <= item.rating ? '#eab308' : '#cbd5e1'} strokeWidth={0} />
                    ))}
                  </div>
                </div>

                {/* REVIEW MESSAGE */}
                <p style={{fontSize: 14, color: '#334155', lineHeight: 1.7, margin: '0 0 16px', whiteSpace: 'pre-line'}}>
                  "{item.message}"
                </p>

                {/* ADMIN REPLY BLOCK */}
                {item.reply && (
                  <div
                    style={{
                      background: '#f4f7ee',
                      borderLeft: '3.5px solid #173c32',
                      borderRadius: '0 10px 10px 0',
                      padding: '14px 18px',
                      marginTop: 14
                    }}
                  >
                    <div style={{display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6}}>
                      <div style={{width: 24, height: 24, borderRadius: '50%', background: '#173c32', color: '#def46a', display: 'grid', placeItems: 'center', fontSize: 12}}>
                        🎾
                      </div>
                      <strong style={{fontSize: 13, color: '#173c32'}}>{item.reply.adminName}</strong>
                      <span style={{background: '#173c32', color: '#def46a', fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 4}}>
                        {item.reply.adminRole}
                      </span>
                      <span style={{fontSize: 11, color: '#637269', marginLeft: 'auto'}}>{item.reply.date}</span>
                    </div>
                    <p style={{fontSize: 13.5, color: '#27382f', lineHeight: 1.6, margin: 0, fontStyle: 'italic'}}>
                      {item.reply.message}
                    </p>
                  </div>
                )}
              </article>
            ))}
          </div>
        </div>

      </div>
    </section>
  );
}

export function Policies(){
  const {t, route, navigate} = useGuest();
  const [tab, setTab] = useState(route === 'rules' ? 'rules' : 'privacy');

  React.useEffect(() => {
    if (route === 'rules') setTab('rules');
    else if (route === 'policies') setTab('privacy');
  }, [route]);

  return (
    <section className="ct-pad" style={{maxWidth: 960, margin: '0 auto', paddingBottom: 60}}>
      <div className="gx-heading" style={{marginBottom: 24}}>
        <span className="ct-eyebrow">COURTLY TENNIS CLUB · LEGAL & REGULATIONS</span>
        <h1 style={{fontSize: 28, margin: '8px 0', color: '#173c32'}}>
          {tab === 'rules' ? t('Quy chế hoạt động Câu lạc bộ') : tab === 'booking' ? t('Quy định đặt sân, Hoàn cọc & Gia hạn') : t('Chính sách bảo mật & Quyền riêng tư')}
        </h1>
        <p style={{color: '#52655a', fontSize: 14, margin: 0}}>
          {t('Văn bản quy định chuẩn mực dịch vụ, bảo vệ quyền lợi hội viên, an toàn sân đấu và bảo mật thông tin cá nhân theo quy định pháp luật.')}
        </p>
      </div>

      {/* Navigation Tabs */}
      <div style={{display: 'flex', gap: 8, flexWrap: 'wrap', background: '#ecefe6', padding: 6, borderRadius: 10, marginBottom: 28, border: '1px solid #d8dece'}}>
        {[
          ['privacy', '🔒 ' + t('Chính sách & Quyền riêng tư')],
          ['rules', '📜 ' + t('Quy chế hoạt động CLB')],
          ['booking', '📋 ' + t('Quy định đặt sân & Hoàn cọc')]
        ].map(([id, label]) => {
          const active = tab === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              style={{
                background: active ? '#173c32' : 'transparent',
                color: active ? '#def46a' : '#324c3e',
                border: 'none',
                borderRadius: 8,
                padding: '8px 16px',
                fontSize: 13,
                fontWeight: active ? 700 : 500,
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* Tab 1: Privacy Policy */}
      {tab === 'privacy' && (
        <div style={{background: '#ffffff', border: '1px solid #d5dcce', borderRadius: 12, padding: '32px 36px', lineHeight: 1.8, fontSize: 14, color: '#27382f', boxShadow: '0 4px 20px rgba(0,0,0,0.03)'}}>
          <h2 style={{fontSize: 20, color: '#173c32', marginBottom: 12}}>1. Mục đích thu thập thông tin</h2>
          <p>Câu lạc bộ Courtly thu thập thông tin cá nhân (họ tên, số điện thoại, email) nhằm phục vụ các mục đích chính đáng sau:</p>
          <ul style={{paddingLeft: 22, margin: '8px 0 18px'}}>
            <li>Xác thực và cấp quyền truy cập tài khoản đặt sân trực tuyến.</li>
            <li>Gửi thông báo xác nhận giữ chỗ, mã vé điện tử QR check-in vào sân.</li>
            <li>Liên hệ khẩn cấp trong trường hợp thay đổi lịch sân do điều kiện thời tiết hoặc bảo trì kỹ thuật.</li>
            <li>Gửi thông báo ưu đãi thành viên, voucher và thông tin giải đấu khi người dùng đăng ký nhận tin.</li>
          </ul>

          <h2 style={{fontSize: 20, color: '#173c32', margin: '24px 0 12px'}}>2. Phạm vi sử dụng & Bảo mật thông tin</h2>
          <p>
            Courtly cam kết bảo mật tuyệt đối thông tin khách hàng bằng các tiêu chuẩn an toàn dữ liệu công nghệ cao (mã hóa SSL/TLS, xác thực JWT phân quyền). Chúng tôi <strong>tuyệt đối không chia sẻ, bán hoặc chuyển giao</strong> thông tin của quý khách cho bất kỳ bên thứ ba nào vì mục đích thương mại, ngoại trừ yêu cầu từ cơ quan có thẩm quyền theo quy định của pháp luật.
          </p>

          <h2 style={{fontSize: 20, color: '#173c32', margin: '24px 0 12px'}}>3. Quyền của khách hàng đối với dữ liệu cá nhân</h2>
          <p>
            Quý khách có toàn quyền kiểm tra, cập nhật, điều chỉnh hoặc yêu cầu xóa thông tin cá nhân của mình bất kỳ lúc nào thông qua mục <strong>Hồ sơ của tôi</strong> trên website hoặc liên hệ trực tiếp với Ban Quản lý Câu lạc bộ qua email hoặc hotline chính thức.
          </p>
        </div>
      )}

      {/* Tab 2: Club Rules & Regulations */}
      {tab === 'rules' && (
        <div style={{background: '#ffffff', border: '1px solid #d5dcce', borderRadius: 12, padding: '32px 36px', lineHeight: 1.8, fontSize: 14, color: '#27382f', boxShadow: '0 4px 20px rgba(0,0,0,0.03)'}}>
          <h2 style={{fontSize: 20, color: '#173c32', marginBottom: 12}}>1. Quy định trang phục & Giày thi đấu</h2>
          <ul style={{paddingLeft: 22, margin: '8px 0 18px'}}>
            <li>Người chơi bắt buộc phải mang <strong>giày tennis chuyên dụng (đế non-marking không để lại vết đen)</strong> khi bước vào tất cả các khu sân (Khu A, Khu B và Khu VIP) nhằm bảo vệ lớp sơn đệm tiêu chuẩn thi đấu.</li>
            <li>Mặc trang phục thể thao lịch sự, phù hợp với thuần phong mỹ tục và hoạt động quần vợt.</li>
          </ul>

          <h2 style={{fontSize: 20, color: '#173c32', margin: '24px 0 12px'}}>2. Giữ gìn an ninh & Văn hóa ứng xử trên sân</h2>
          <ul style={{paddingLeft: 22, margin: '8px 0 18px'}}>
            <li>Nghiêm cấm hút thuốc lá, sử dụng chất kích thích hoặc mang đồ ăn nhiều dầu mỡ vào trong khu vực thi đấu.</li>
            <li>Không xả rác bừa bãi; vỏ chai nước và bóng hỏng phải bỏ đúng thùng rác phân loại đặt cạnh ghế nghỉ.</li>
            <li>Giữ gìn vệ sinh chung tại khu vực phòng thay đồ, tủ locker và phòng tắm nước nóng.</li>
            <li>Tôn trọng đối thủ, trọng tài và các người chơi ở sân liền kề; không có hành vi phi thể thao hoặc gây ồn ào ảnh hưởng trận đấu khác.</li>
          </ul>

          <h2 style={{fontSize: 20, color: '#173c32', margin: '24px 0 12px'}}>3. Thời gian thi đấu & Bàn giao sân</h2>
          <ul style={{paddingLeft: 22, margin: '8px 0 18px'}}>
            <li>Người chơi vui lòng có mặt trước giờ thi đấu ít nhất 10–15 phút để làm thủ tục check-in tại quầy và khởi động.</li>
            <li>Khi hết giờ thi đấu, người chơi vui lòng chủ động dọn dẹp bóng, vật dụng cá nhân và bàn giao sân đúng giờ cho lượt khách kế tiếp.</li>
            <li>Nếu có nhu cầu đánh thêm, vui lòng liên hệ lễ tân hoặc dùng tính năng <strong>Gia hạn giờ chơi</strong> trên website nếu sân còn trống.</li>
          </ul>
        </div>
      )}

      {/* Tab 3: Booking, Deposit & Cancellation Rules */}
      {tab === 'booking' && (
        <div style={{background: '#ffffff', border: '1px solid #d5dcce', borderRadius: 12, padding: '32px 36px', lineHeight: 1.8, fontSize: 14, color: '#27382f', boxShadow: '0 4px 20px rgba(0,0,0,0.03)'}}>
          <h2 style={{fontSize: 20, color: '#173c32', marginBottom: 12}}>1. Đặt sân & Đặt cọc giữ chỗ</h2>
          <p>
            Để đảm bảo tính công bằng và tránh tình trạng đặt giữ chỗ ảo, khách hàng đặt sân trực tuyến cần thanh toán tiền cọc theo quy định (thường là 30% – 50% tổng giá trị đơn) trong vòng <strong>15 phút</strong> kể từ khi tạo đơn. Sau thời gian này, hệ thống sẽ tự động giải phóng khung giờ cho khách hàng khác.
          </p>

          <h2 style={{fontSize: 20, color: '#173c32', margin: '24px 0 12px'}}>2. Quy định Hủy đơn & Hoàn tiền cọc</h2>
          <ul style={{paddingLeft: 22, margin: '8px 0 18px'}}>
            <li><strong>Hủy trước ít nhất 24 giờ so với giờ chơi:</strong> Được hoàn trả 80% – 100% số tiền cọc đã đóng (chuyển khoản về tài khoản gốc hoặc cộng vào số dư điểm thưởng / voucher trên hệ thống Courtly).</li>
            <li><strong>Hủy trong vòng dưới 24 giờ so với giờ chơi:</strong> Tiền đặt cọc sẽ không được hoàn lại do sân đã được bố trí độc quyền cho quý khách và không kịp sắp xếp lượt khách thay thế.</li>
            <li><strong>Trường hợp bất khả kháng (Mưa lớn đối với sân ngoài trời Khu A, sự cố kỹ thuật):</strong> Ban Quản lý sẽ chủ động liên hệ để hỗ trợ dời lịch chơi sang khung giờ khác hoàn toàn miễn phí hoặc hoàn trả 100% tiền cọc.</li>
          </ul>

          <h2 style={{fontSize: 20, color: '#173c32', margin: '24px 0 12px'}}>3. Check-in & Thanh toán phần còn lại</h2>
          <p>
            Khi đến sân, người chơi mở vé điện tử trên ứng dụng/website để nhân viên lễ tân quét mã QR xác nhận. Số tiền còn lại của đơn đặt sân (sau khi trừ cọc) sẽ được thanh toán trực tiếp tại quầy bằng tiền mặt hoặc chuyển khoản ngân hàng trước khi vào sân.
          </p>
        </div>
      )}
    </section>
  );
}
