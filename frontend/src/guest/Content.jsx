import React,{useState} from 'react';
import {Star,ArrowUpRight,MapPin,Phone,Mail} from 'lucide-react';
import {api} from '../services/api';
import {useGuest,Action,Empty,requestId} from './context';
export function News(){const {t,content,show}=useGuest();return <section className="ct-pad"><div className="gx-heading"><span className="ct-eyebrow">COURTLY JOURNAL</span><h1>{t('Những câu chuyện ngoài sân.')}</h1><p>{t('Tin câu lạc bộ, lịch giao lưu và những điều hữu ích cho buổi chơi.')}</p></div><div className="gx-event-grid">{(content.articles||[]).map((a,i)=><article key={a.id}><img src={a.imageUrl||['/guest/zone-a-outdoor.webp','/guest/doubles.webp','/guest/zone-v-lounge.webp'][i%3]} alt={t('Ảnh minh họa tennis')}/><div><span className="ct-eyebrow">{t(a.category)} · {a.publishedAt?.slice(0,10)}</span><h3>{a.title}</h3><p>{a.excerpt}</p><button className="ct-text-button" onClick={()=>show({kind:'article',article:a})}>{t('Đọc bài viết')}<ArrowUpRight/></button></div></article>)}</div>{!content.articles?.length&&<Empty/>}</section>}
export function Article({article:a}){const {t}=useGuest();return <article className="gx-article"><span className="ct-eyebrow">{t(a.category)} · {a.publishedAt?.slice(0,10)}</span><h2>{a.title}</h2><p>{a.excerpt}</p>{String(a.body||'').split('\n').filter(Boolean).map((line,i)=><p key={i}>{line}</p>)}</article>}
export function Contact(){const {t,club,navigate}=useGuest();return <section className="ct-pad"><div className="gx-heading"><span className="ct-eyebrow">SEE YOU ON COURT</span><h1>{t('Một cuộc hẹn. Một kết nối.')}</h1></div><div className="gx-split"><article><h2>{t('Ghé câu lạc bộ')}</h2><dl>{[[MapPin,'Địa chỉ',club.address],[Phone,'Điện thoại',club.phone],[Mail,'Email',club.email]].map(([I,k,v])=><div key={k}><dt><I/>{t(k)}</dt><dd>{v||t('Đang cập nhật')}</dd></div>)}<div><dt>{t('Giờ mở cửa')}</dt><dd>{club.openingHours||'06:00 – 23:00'}</dd></div></dl>{club.address?.includes('DEMO')&&<p>{t('Thông tin liên hệ giả lập, chưa dùng để liên hệ hoặc chỉ đường thực tế.')}</p>}</article><article className="gx-green"><h2>{t('Mỗi chia sẻ đều có ý nghĩa.')}</h2><p>{t('Gửi góp ý để Courtly chăm sóc trải nghiệm của bạn tốt hơn.')}</p><Action secondary onClick={()=>navigate('feedback')}>{t('Gửi feedback')}</Action></article></div></section>}
export function Feedback(){const {t,user,login,content,refresh,notify}=useGuest();const [rating,setRating]=useState(0),[message,setMessage]=useState(''),[topic,setTopic]=useState('COURT'),[consent,setConsent]=useState(false),[error,setError]=useState(''),[busy,setBusy]=useState(false);const [req,setReq]=useState(requestId);
 const submit=async e=>{e.preventDefault();if(!user){login();return}if(!rating)return setError(t('Chọn từ 1 đến 5 sao.'));setBusy(true);setError('');try{await api('/feedback','POST',{rating,message,topic,publishConsent:consent,requestId:req});setMessage('');setRating(0);setReq(requestId());notify(t('Đã gửi phản hồi. Nội dung chỉ công khai sau khi được duyệt.'));await refresh()}catch(e){setError(e.message)}finally{setBusy(false)}};
 return <section className="ct-pad"><div className="gx-heading"><span className="ct-eyebrow">{t('LẮNG NGHE TRẢI NGHIỆM')}</span><h1>{t('Góp ý để Courtly tốt hơn.')}</h1></div><div className="gx-split"><form className="gx-form" onSubmit={submit}><fieldset><legend>{t('Đánh giá trải nghiệm')}</legend><div className="gx-stars">{[1,2,3,4,5].map(n=><label key={n}><input type="radio" name="rating" value={n} checked={rating===n} onChange={()=>setRating(n)} required aria-label={`${n} ${t('sao')}`}/><Star fill={n<=rating?'currentColor':'none'}/></label>)}</div></fieldset><label>{t('Chủ đề')}<select value={topic} onChange={e=>setTopic(e.target.value)}>{['COURT','SERVICE','WEBSITE','TOURNAMENT','OTHER'].map(v=><option key={v} value={v}>{t(v)}</option>)}</select></label><label>{t('Nội dung')}<textarea value={message} onChange={e=>setMessage(e.target.value)} required minLength={10} maxLength={2000} rows={6}/></label><label className="gx-check"><input type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)}/>{t('Tôi đồng ý công khai tên và nội dung sau khi được duyệt.')}</label>{error&&<div className="gx-error" role="alert">{t(error)}</div>}<Action type="submit" disabled={busy}>{t(busy?'Đang gửi…':user?'Gửi đánh giá':'Đăng nhập để gửi đánh giá')}</Action></form><article className="gx-green"><h2>{t('Cảm ơn bạn đã chia sẻ.')}</h2><p>{t('Bạn có thể gửi riêng cho câu lạc bộ. Chỉ chia sẻ công khai khi bạn đồng ý.')}</p>{(content.feedback||[]).map(f=><blockquote key={f.id}><div>{'★'.repeat(f.rating)}</div><p>{f.message}</p><small>{f.displayName}</small>{f.reply&&<p>{f.reply}</p>}</blockquote>)}</article></div></section>}
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
          ['privacy', '🛡️ ' + t('Chính sách & Quyền riêng tư')],
          ['rules', '📜 ' + t('Quy chế hoạt động CLB')],
          ['booking', '⚖️ ' + t('Quy định đặt sân & Hoàn cọc')]
        ].map(([id, label]) => {
          const active = tab === id;
          return (
            <button
              type="button"
              key={id}
              onClick={() => setTab(id)}
              style={{
                padding: '10px 18px',
                borderRadius: 8,
                border: 'none',
                fontSize: 13.5,
                fontWeight: active ? 700 : 500,
                background: active ? '#173c32' : 'transparent',
                color: active ? '#def46a' : '#3c5044',
                cursor: 'pointer',
                boxShadow: active ? '0 2px 8px rgba(23,60,50,0.18)' : 'none',
                transition: 'all 0.15s ease'
              }}
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* TAB 1: PRIVACY & DATA PROTECTION */}
      {tab === 'privacy' && (
        <div className="gx-article" style={{lineHeight: 1.7, color: '#2d3748', fontSize: 14.5}}>
          <div style={{background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 10, padding: '16px 20px', marginBottom: 24, fontSize: 13.5, color: '#1e40af'}}>
            <b>Thông báo tuân thủ pháp lý:</b> Chính sách bảo mật này được xây dựng và áp dụng theo <b>Nghị định 13/2023/NĐ-CP</b> về Bảo vệ Dữ liệu Cá nhân và các quy định pháp luật hiện hành của Việt Nam đối với dịch vụ đặt sân thể thao trực tuyến.
          </div>

          <h3 style={{color: '#173c32', fontSize: 18, marginTop: 24, borderBottom: '1px solid #e2ebd9', paddingBottom: 6}}>
            Điều 1. Phạm vi và Loại dữ liệu thu thập
          </h3>
          <p>
            Nhằm mục đích cung cấp dịch vụ đặt sân tennis, xác nhận vé điện tử QR, quản lý giải đấu và hỗ trợ hội viên, Courtly Tennis Club thu thập các trường dữ liệu do khách hàng tự nguyện cung cấp:
          </p>
          <ul>
            <li><b>Thông tin định danh:</b> Họ và tên, Số điện thoại liên hệ, Địa chỉ Email.</li>
            <li><b>Dữ liệu giao dịch:</b> Lịch sử đặt sân, mã đơn hàng, thời gian thi đấu, trạng thái thanh toán và mã tham chiếu giao dịch chuyển khoản VietQR / tiền mặt.</li>
            <li><b>Thông tin giải đấu & Hội viên:</b> Trình độ thi đấu (elo/hạng), câu lạc bộ liên kết, gói hội viên (Club, Plus) và lịch sử tham gia sự kiện.</li>
          </ul>

          <h3 style={{color: '#173c32', fontSize: 18, marginTop: 24, borderBottom: '1px solid #e2ebd9', paddingBottom: 6}}>
            Điều 2. Mục đích xử lý dữ liệu
          </h3>
          <p>
            Dữ liệu cá nhân chỉ được sử dụng cho các mục đích hợp pháp phục vụ trực tiếp trải nghiệm của khách hàng:
          </p>
          <ul>
            <li>Xác thực lịch giữ chỗ, cấp phát mã QR check-in vào sân tự động tại quầy lễ tân.</li>
            <li>Gửi thông báo nhắc lịch thi đấu, xác nhận giao dịch chuyển khoản và thông tin giải đấu qua hệ thống / Zalo ZNS.</li>
            <li>Đối soát công nợ, quản lý danh sách chờ hoàn tiền cọc và thực hiện hoàn trả theo đúng chính sách hoàn hủy.</li>
            <li>Đảm bảo an ninh, phòng chống gian lận đặt chỗ ảo hoặc nâng quyền truy cập trái phép.</li>
          </ul>

          <h3 style={{color: '#173c32', fontSize: 18, marginTop: 24, borderBottom: '1px solid #e2ebd9', paddingBottom: 6}}>
            Điều 3. Cam kết bảo mật & Chia sẻ bên thứ ba
          </h3>
          <p>
            Courtly Tennis Club cam kết <b>tuyệt đối không kinh doanh, cho thuê hoặc phát tán</b> dữ liệu cá nhân của khách hàng cho bất kỳ bên thứ ba nào vì mục đích quảng cáo hoặc tiếp thị.
          </p>
          <p>
            Dữ liệu được lưu trữ trên hạ tầng máy chủ bảo mật có phân quyền nghiêm ngặt, sử dụng giao thức mã hóa đường truyền SSL/TLS và bảo vệ CSRF/Token xác thực session. Chỉ nhân sự phụ trách vận hành và tài chính của CLB mới có thẩm quyền truy cập thông tin đối soát liên quan.
          </p>

          <h3 style={{color: '#173c32', fontSize: 18, marginTop: 24, borderBottom: '1px solid #e2ebd9', paddingBottom: 6}}>
            Điều 4. Quyền của Chủ thể Dữ liệu
          </h3>
          <p>
            Khách hàng có toàn quyền tra cứu, cập nhật thông tin cá nhân tại trang <b>Hồ sơ của tôi</b>, yêu cầu rà soát lịch sử giao dịch hoặc gửi văn bản/email yêu cầu CLB đóng tài khoản và ẩn các dữ liệu lưu trữ không bắt buộc phục vụ nghĩa vụ thuế/kế toán.
          </p>
        </div>
      )}

      {/* TAB 2: CLUB REGULATIONS */}
      {tab === 'rules' && (
        <div className="gx-article" style={{lineHeight: 1.7, color: '#2d3748', fontSize: 14.5}}>
          <div style={{background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10, padding: '16px 20px', marginBottom: 24, fontSize: 13.5, color: '#166534'}}>
            <b>Thông điệp từ Ban Quản lý:</b> Quy chế hoạt động nhằm xây dựng môi trường thể thao quần vợt văn minh, an toàn và chuyên nghiệp cho tất cả hội viên và người chơi tại cụm sân Courtly Tennis Club.
          </div>

          <h3 style={{color: '#173c32', fontSize: 18, marginTop: 24, borderBottom: '1px solid #e2ebd9', paddingBottom: 6}}>
            Điều 1. Tiêu chuẩn Trang phục & Giày thi đấu
          </h3>
          <ul>
            <li><b>Giày thi đấu:</b> Bắt buộc sử dụng giày tennis chuyên dụng có đế cao su <b>Non-marking</b> (không để lại vết đen/vết xước trên mặt sân acrylic). Tuyệt đối nghiêm cấm đi giày chạy bộ đế gai cứng, giày đinh, giày da hoặc dép lê vào khu vực mặt sân.</li>
            <li><b>Trang phục:</b> Vận động viên và người chơi mặc trang phục thể thao lịch sự, gọn gàng (áo thể thao có tay/áo polo/áo cổ tròn chuyên dụng, quần shorts hoặc váy tennis). Không cởi trần trong suốt thời gian có mặt tại khuôn viên cụm sân.</li>
          </ul>

          <h3 style={{color: '#173c32', fontSize: 18, marginTop: 24, borderBottom: '1px solid #e2ebd9', paddingBottom: 6}}>
            Điều 2. Quy trình Check-in & Khung giờ ra vào sân
          </h3>
          <ul>
            <li><b>Check-in vào sân:</b> Quý khách vui lòng có mặt trước giờ thi đấu 10-15 phút để khởi động. Khi đến nơi, mở <b>Vé điện tử QR</b> trên điện thoại tại quầy lễ tân để nhân viên quét xác thực và hướng dẫn nhận sân.</li>
            <li><b>Trả sân đúng giờ:</b> Khi hết thời gian đã đăng ký theo lịch, quý khách vui lòng dừng trận đấu và rời sân đúng giờ để nhân viên chuẩn bị sân và nhường quyền sử dụng cho ca tiếp theo.</li>
            <li><b>Gia hạn thêm giờ:</b> Nếu muốn tiếp tục chơi, quý khách có thể thực hiện <b>Gia hạn trực tuyến</b> ngay trên ứng dụng hoặc thông báo tại quầy lễ tân (chỉ áp dụng khi khung giờ liền kề của sân đó còn trống).</li>
          </ul>

          <h3 style={{color: '#173c32', fontSize: 18, marginTop: 24, borderBottom: '1px solid #e2ebd9', paddingBottom: 6}}>
            Điều 3. Văn hóa ứng xử & Tinh thần thể thao (Court Etiquette)
          </h3>
          <ul>
            <li>Tôn trọng đối thủ, trọng tài, nhặt bóng và các vận động viên đang thi đấu ở các sân liền kề.</li>
            <li>Không đập vợt, không ném bóng vào lưới hoặc hàng rào với hành vi tức giận; không nói tục, chửi thề hoặc gây gổ mất trật tự trong khuôn viên thể thao.</li>
            <li><b>Nghiêm cấm tuyệt đối:</b> Hút thuốc lá (kể cả thuốc lá điện tử), sử dụng chất kích thích, cờ bạc cá cược hoặc mang đồ uống có cồn vào khu vực thi đấu.</li>
          </ul>

          <h3 style={{color: '#173c32', fontSize: 18, marginTop: 24, borderBottom: '1px solid #e2ebd9', paddingBottom: 6}}>
            Điều 4. An toàn sức khỏe & Bảo quản tư trang cá nhân
          </h3>
          <ul>
            <li>Người chơi tự chịu trách nhiệm về tình trạng sức khỏe tim mạch và thể lực khi tham gia vận động cường độ cao. Khởi động kỹ ít nhất 10 phút trước trận đấu để phòng tránh chấn thương.</li>
            <li>CLB trang bị sẵn tủ sơ cứu y tế (băng dán cơ, túi đá lạnh, thuốc sát trùng) tại quầy lễ tân. Trong trường hợp cần sơ cứu, vui lòng báo ngay cho nhân viên trực ca.</li>
            <li>Khách hàng tự bảo quản tư trang và tài sản cá nhân có giá trị hoặc gửi tại tủ locker có khóa của CLB. Ban quản lý không chịu trách nhiệm đối với việc mất mát tư trang do người chơi để quên.</li>
          </ul>

          <h3 style={{color: '#173c32', fontSize: 18, marginTop: 24, borderBottom: '1px solid #e2ebd9', paddingBottom: 6}}>
            Điều 5. Bảo vệ Cơ sở vật chất & Trách nhiệm bồi thường
          </h3>
          <p>
            Các thiết bị sân bãi bao gồm mặt sân, hệ thống lưới thi đấu, ghế trọng tài, hệ thống đèn chiếu sáng LED và khu vực nghỉ ngơi được đầu tư tiêu chuẩn cao. Khách hàng có hành vi cố ý phá hoại hoặc làm hỏng thiết bị sẽ phải bồi thường toàn bộ chi phí sửa chữa/thay thế theo đơn giá thực tế của nhà cung cấp.
          </p>
        </div>
      )}

      {/* TAB 3: BOOKING, DEPOSIT & REFUND POLICY */}
      {tab === 'booking' && (
        <div className="gx-article" style={{lineHeight: 1.7, color: '#2d3748', fontSize: 14.5}}>
          <div style={{background: '#fefce8', border: '1px solid #facc15', borderRadius: 10, padding: '16px 20px', marginBottom: 24, fontSize: 13.5, color: '#854d0e'}}>
            <b>Minh bạch tài chính & Hoàn tiền:</b> Mọi chính sách đặt sân, đổi lịch và hoàn tiền cọc đều được áp dụng tự động, công khai và thể hiện rõ ràng trên biên lai và trang quản lý đơn của khách hàng.
          </div>

          <h3 style={{color: '#173c32', fontSize: 18, marginTop: 24, borderBottom: '1px solid #e2ebd9', paddingBottom: 6}}>
            Điều 1. Quy định Đặt sân & Đặt cọc
          </h3>
          <ul>
            <li><b>Giữ chỗ tạm thời (Holding):</b> Khi chọn sân trên hệ thống, đơn đặt sẽ được giữ chỗ trong <b>5 phút</b> để khách hàng tiến hành chuyển khoản cọc. Nếu quá thời gian trên chưa thanh toán, hệ thống sẽ tự động hủy đơn và giải phóng sân.</li>
            <li><b>Tỷ lệ đặt cọc:</b> Khách hàng thanh toán tối thiểu <b>50% tổng giá trị đơn đặt</b> để xác nhận đơn thành công. Phần chi phí còn lại (50%) kèm tiền dịch vụ phát sinh (thuê vợt, nước uống, gia hạn thêm giờ) sẽ được thanh toán tại quầy lễ tân khi làm thủ tục Check-out.</li>
          </ul>

          <h3 style={{color: '#173c32', fontSize: 18, marginTop: 24, borderBottom: '1px solid #e2ebd9', paddingBottom: 6}}>
            Điều 2. Chính sách Hủy lịch & Hoàn tiền cọc minh bạch
          </h3>
          <p>
            Nhằm đảm bảo công bằng cho các khách hàng khác có nhu cầu sử dụng sân, chính sách hoàn tiền cọc khi hủy lịch được quy định cụ thể theo các mốc thời gian:
          </p>
          <div style={{display: 'grid', gap: 12, margin: '14px 0'}}>
            <div style={{background: '#f0fdf4', border: '1.5px solid #86efac', borderRadius: 8, padding: '12px 16px'}}>
              <strong style={{color: '#166534', display: 'block', fontSize: 15}}>✓ Hủy trước &gt; 24 giờ so với giờ chơi:</strong>
              <span style={{color: '#15803d', fontSize: 13}}>Khách hàng được <b>hoàn lại 100% tiền cọc đã đóng</b>. Đơn chuyển sang danh sách chờ hoàn của bộ phận kế toán để chuyển trả qua số tài khoản của quý khách.</span>
            </div>
            <div style={{background: '#fffbeb', border: '1.5px solid #fde68a', borderRadius: 8, padding: '12px 16px'}}>
              <strong style={{color: '#b45309', display: 'block', fontSize: 15}}>⚠️ Hủy từ 12 giờ đến 24 giờ trước giờ chơi:</strong>
              <span style={{color: '#92400e', fontSize: 13}}>Khách hàng được <b>hoàn lại 50% tiền cọc</b>. Khoản 50% còn lại được giữ lại theo quy định để bù đắp chi phí giữ chỗ cho khung giờ của CLB.</span>
            </div>
            <div style={{background: '#fef2f2', border: '1.5px solid #fecaca', borderRadius: 8, padding: '12px 16px'}}>
              <strong style={{color: '#b91c1c', display: 'block', fontSize: 15}}>❌ Hủy cận giờ (&lt; 12 giờ) hoặc Vắng mặt (No-show):</strong>
              <span style={{color: '#991b1b', fontSize: 13}}>Không áp dụng hoàn tiền cọc (<b>Giữ 100% tiền cọc</b>) do không đủ thời gian tìm khách thay thế cho khung giờ cao điểm.</span>
            </div>
          </div>

          <h3 style={{color: '#173c32', fontSize: 18, marginTop: 24, borderBottom: '1px solid #e2ebd9', paddingBottom: 6}}>
            Điều 3. Trường hợp Bất khả kháng & Thời tiết bất lợi
          </h3>
          <p>
            Đối với các sân ngoài trời, trong trường hợp xảy ra mưa lớn, sấm sét, thời tiết cực đoan hoặc sự cố kỹ thuật điện chiếu sáng khiến trận đấu không thể diễn ra:
          </p>
          <ul>
            <li>Khách hàng được quyền <b>Dời lịch thi đấu sang ngày khác hoàn toàn miễn phí</b>.</li>
            <li>Hoặc được CLB <b>Duyệt hoàn tiền 100% toàn bộ số tiền đã đóng</b> mà không bị áp dụng bất kỳ khoản phạt nào.</li>
          </ul>

          <h3 style={{color: '#173c32', fontSize: 18, marginTop: 24, borderBottom: '1px solid #e2ebd9', paddingBottom: 6}}>
            Điều 4. Quy định Đổi lịch thi đấu
          </h3>
          <p>
            Khách hàng được đổi lịch sân trước ít nhất <b>24 giờ</b> so với giờ bắt đầu thi đấu. Lịch mới phụ thuộc vào tình trạng sân còn trống trên hệ thống. Nếu đổi sang khung giờ hoặc loại sân có giá cao hơn, khách hàng thanh toán bổ sung phần chênh lệch.
          </p>
        </div>
      )}

      {/* Footer Support Note */}
      <div style={{marginTop: 36, padding: '18px 20px', background: '#f8faf7', border: '1px solid #dce4d6', borderRadius: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 14}}>
        <div>
          <strong style={{color: '#173c32', fontSize: 14, display: 'block'}}>Cần hỗ trợ về quy định hoặc thủ tục hoàn tiền?</strong>
          <span style={{fontSize: 12.5, color: '#52655a'}}>Hotline lễ tân hoạt động 24/7 giải quyết mọi thắc mắc của quý khách.</span>
        </div>
        <button
          type="button"
          onClick={() => navigate('contact')}
          style={{padding: '9px 18px', borderRadius: 8, background: '#173c32', color: '#def46a', border: 'none', fontWeight: 700, fontSize: 13, cursor: 'pointer'}}
        >
          Liên hệ Ban Quản lý →
        </button>
      </div>
    </section>
  );
}
