import React,{useState,useEffect,useMemo} from 'react';
import QRCode from 'qrcode';
import {api} from '../services/api';
import {useGuest,Action,State,Empty,money,time,dateToday,requestId} from './context';

function HoldCountdown({until}){
 const {t}=useGuest();const [now,setNow]=useState(Date.now());
 useEffect(()=>{const timer=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(timer)},[]);
 const left=Math.max(0,Math.ceil((Date.parse(until)-now)/1000));
 const mins=Math.floor(left/60), secs=String(left%60).padStart(2,'0');
 return (
   <div className="gx-hold-box" style={{background:'#fefce8',border:'1.5px solid #facc15',borderRadius:8,padding:'12px 16px',margin:'12px 0'}}>
     <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:8}}>
       <div style={{display:'flex',alignItems:'center',gap:8}}>
         <span style={{width:8,height:8,borderRadius:'50%',background:left>60?'#eab308':'#ef4444',display:'inline-block'}}/>
         <strong style={{color:'#854d0e',fontSize:12,textTransform:'uppercase',letterSpacing:0.5}}>{t('Đang giữ chỗ tạm thời')}</strong>
       </div>
       <div style={{display:'flex',alignItems:'center',gap:6}}>
         <span style={{fontSize:12,color:'#a16207'}}>{t('Thời gian giữ chỗ còn')}:</span>
         <strong style={{fontSize:18,color:left>60?'#854d0e':'#b91c1c',fontFamily:'monospace',fontWeight:700,letterSpacing:1}}>{mins}:{secs}</strong>
       </div>
     </div>
     <p style={{margin:'6px 0 0',fontSize:11.5,lineHeight:1.5,color:'#713f12'}}>
       {left>0
         ? t('Khung giờ được giữ riêng cho bạn. Vui lòng thanh toán cọc 50% trước khi đồng hồ về 0 để hoàn tất đặt sân.')
         : t('Thời gian giữ chỗ đã hết hạn. Hệ thống đang tự động giải phóng sân.')}
     </p>
   </div>
 );
}

export function TicketDialog({order, onClose}) {
  const {t, data, show} = useGuest();
  const [qrUrl, setQrUrl] = useState('');
  const court = data?.courts?.find(c => c.id === order.slots?.[0]?.court);
  const slots = order.slots.filter(s=>(s.date||order.date)===order.date).sort((a,b) => a.start.localeCompare(b.start));
  const startTime = time(slots[0]?.start) || `${slots[0]?.hour}:00`;
  const endTime = time(slots.at(-1)?.end) || `${(slots.at(-1)?.hour || 0) + 1}:00`;
  const refStaff = order.staff?.[0];
  const ticketCode = `CT-${order.id.slice(0,8).toUpperCase()}`;

  useEffect(() => {
    const payload = JSON.stringify({
      type: 'courtly_checkin',
      ticket: ticketCode,
      orderId: order.id,
      customer: order.name,
      court: court?.name,
      date: order.date,
      time: `${startTime}-${endTime}`
    });
    QRCode.toDataURL(payload, { width: 260, margin: 1, color: { dark: '#173c32', light: '#ffffff' } })
      .then(setQrUrl)
      .catch(() => {});
  }, [order.id]);

  return (
    <div className="gx-ticket-modal" style={{maxWidth: 420, margin: '0 auto', textAlign: 'center'}}>
      <div style={{background: '#173c32', color: '#fff', borderRadius: '14px 14px 0 0', padding: '22px 20px', position: 'relative'}}>
        <div style={{fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', color: '#def46a', fontWeight: 600}}>
          COURTLY TENNIS CLUB · VÉ ĐIỆN TỬ
        </div>
        <h2 style={{fontSize: 22, margin: '8px 0 4px', color: '#fff', letterSpacing: 'normal'}}>{t('Vé Check-in Vào Sân')}</h2>
        <div style={{fontSize: 13, color: '#d1dac4'}}>{t('Mã vé')}: <b style={{color: '#def46a', letterSpacing: 1.5, fontFamily: 'monospace', fontSize: 16}}>{ticketCode}</b></div>
      </div>

      <div style={{background: '#fff', border: '1px solid #d1dac4', borderTop: 'none', borderRadius: '0 0 14px 14px', padding: '24px 20px', boxShadow: '0 10px 30px rgba(0,0,0,0.06)'}}>
        <div style={{background: '#f8faf7', border: '2px dashed #b5c3ad', borderRadius: 12, padding: 16, display: 'inline-block', margin: '0 auto 18px'}}>
          {qrUrl ? (
            <img src={qrUrl} alt="Mã QR Check-in" style={{width: 200, height: 200, display: 'block'}}/>
          ) : (
            <div style={{width: 200, height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center'}}>{t('Đang tạo mã QR…')}</div>
          )}
          <span style={{display: 'block', fontSize: 11, color: '#637269', marginTop: 8}}>{t('Đưa mã này cho lễ tân tại quầy để quét')}</span>
        </div>

        <div style={{background: '#f4f6ef', borderRadius: 8, padding: '14px 16px', textAlign: 'left', fontSize: 13, display: 'grid', gap: 8, marginBottom: 18}}>
          <div style={{display: 'flex', justifyContent: 'space-between'}}>
            <span style={{color: '#637269'}}>{t('Khách hàng')}:</span>
            <strong style={{color: '#173c32'}}>{order.name}</strong>
          </div>
          <div style={{display: 'flex', justifyContent: 'space-between'}}>
            <span style={{color: '#637269'}}>{t('Sân thi đấu')}:</span>
            <strong style={{color: '#173c32'}}>{court?.name || t('Sân tennis')}</strong>
          </div>
          <div style={{display: 'flex', justifyContent: 'space-between'}}>
            <span style={{color: '#637269'}}>{t('Thời gian chơi')}:</span>
            <strong style={{color: '#173c32'}}>{startTime} – {endTime} · {order.date}</strong>
          </div>
          {refStaff && (
            <div style={{display: 'flex', justifyContent: 'space-between'}}>
              <span style={{color: '#637269'}}>{t('Trọng tài hỗ trợ')}:</span>
              <strong style={{color: '#173c32'}}>{refStaff.name}</strong>
            </div>
          )}
          <div style={{display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #d1dac4', paddingTop: 8, marginTop: 4}}>
            <span style={{color: '#637269'}}>{t('Trạng thái vé')}:</span>
            <span style={{color: order.status === 'CHECKED_IN' ? '#2563eb' : '#15803d', fontWeight: 700}}>
              {order.status === 'CHECKED_IN' ? t('● ĐANG SỬ DỤNG SÂN') : t('✓ SẴN SÀNG CHECK-IN')}
            </span>
          </div>
        </div>

        <div style={{display: 'grid', gap: 9}}>

          {order.status === 'CHECKED_IN' && (
            <button
              type="button"
              onClick={() => { onClose(); show({kind: 'extend', order}); }}
              style={{
                width: '100%',
                padding: '10px 14px',
                borderRadius: 8,
                border: 'none',
                background: '#173c32',
                color: '#def46a',
                fontSize: 13,
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6
              }}
            >
              <span>⚡</span>
              <span>{t('Gia hạn giờ chơi (+30p / +60p)')}</span>
            </button>
          )}

          <Action onClick={onClose} style={{width: '100%', padding: '11px'}}>{t('Đóng vé')}</Action>
        </div>
      </div>
    </div>
  );
}

export function ZaloZnsDialog({order, onClose}) {
  const {t, data, show} = useGuest();
  const court = data?.courts?.find(c => c.id === order.slots?.[0]?.court);
  const slots = (order.slots || []).filter(s=>(s.date||order.date)===order.date).sort((a,b) => a.start.localeCompare(b.start));
  const startTime = time(slots[0]?.start) || `${slots[0]?.hour}:00`;
  const endTime = time(slots.at(-1)?.end) || `${(slots.at(-1)?.hour || 0) + 1}:00`;
  const refStaff = order.staff?.[0];
  const ticketCode = `CT-${order.id.slice(0,8).toUpperCase()}`;

  return (
    <div style={{maxWidth: 440, margin: '0 auto', fontFamily: 'system-ui, -apple-system, sans-serif'}}>
      <div style={{background: '#0068ff', color: '#fff', padding: '16px 20px', borderRadius: '12px 12px 0 0', display: 'flex', alignItems: 'center', gap: 12}}>
        <div style={{width: 44, height: 44, borderRadius: '50%', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, boxShadow: '0 2px 6px rgba(0,0,0,0.15)'}}>
          🎾
        </div>
        <div style={{flex: 1}}>
          <div style={{display: 'flex', alignItems: 'center', gap: 6}}>
            <strong style={{fontSize: 16, fontWeight: 700, letterSpacing: -0.2}}>Courtly Tennis Club</strong>
            <span title="Tài khoản Zalo Doanh Nghiệp đã xác thực" style={{display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 17, height: 17, borderRadius: '50%', background: '#ffd700', color: '#173c32', fontSize: 11, fontWeight: 900}}>✓</span>
          </div>
          <span style={{fontSize: 12, opacity: 0.9, display: 'block'}}>Zalo Official Account Doanh Nghiệp</span>
        </div>
      </div>

      <div style={{background: '#f4f5f7', border: '1px solid #dcdfe4', borderTop: 'none', borderRadius: '0 0 12px 12px', padding: '18px 16px', boxShadow: '0 8px 24px rgba(0,0,0,0.06)'}}>
        <div style={{background: '#ffffff', borderRadius: 10, padding: '18px 16px', border: '1px solid #e2e5eb', marginBottom: 14}}>
          <div style={{display: 'inline-block', background: '#eff6ff', color: '#1d4ed8', fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 4, textTransform: 'uppercase', marginBottom: 10, letterSpacing: 0.5}}>
            THÔNG BÁO XÁC NHẬN & NHẮC LỊCH ĐẶT SÂN
          </div>
          <h3 style={{fontSize: 16, margin: '0 0 10px', color: '#111827', fontWeight: 700}}>
            Xin chào {order.name},
          </h3>
          <p style={{fontSize: 13, color: '#4b5563', lineHeight: 1.5, margin: '0 0 14px'}}>
            Courtly Tennis Club trân trọng thông báo lịch thi đấu / tập luyện của bạn đã được xác nhận thành công trên hệ thống:
          </p>

          <div style={{background: '#f8fafc', borderRadius: 8, padding: '12px 14px', fontSize: 13, display: 'grid', gap: 8, border: '1px solid #e5e7eb'}}>
            <div style={{display: 'flex', justifyContent: 'space-between'}}>
              <span style={{color: '#6b7280'}}>Mã đặt sân:</span>
              <strong style={{color: '#0068ff', fontFamily: 'monospace', fontSize: 14}}>{ticketCode}</strong>
            </div>
            <div style={{display: 'flex', justifyContent: 'space-between'}}>
              <span style={{color: '#6b7280'}}>Sân thi đấu:</span>
              <strong style={{color: '#111827'}}>{court?.name || 'Sân tiêu chuẩn'} ({labels[court?.type] || 'Sân ngoài trời'})</strong>
            </div>
            <div style={{display: 'flex', justifyContent: 'space-between'}}>
              <span style={{color: '#6b7280'}}>Thời gian chơi:</span>
              <strong style={{color: '#111827'}}>{startTime} – {endTime} · {order.date}</strong>
            </div>
            {refStaff && (
              <div style={{display: 'flex', justifyContent: 'space-between'}}>
                <span style={{color: '#6b7280'}}>Trọng tài hỗ trợ:</span>
                <strong style={{color: '#111827'}}>{refStaff.name}</strong>
              </div>
            )}
            <div style={{display: 'flex', justifyContent: 'space-between'}}>
              <span style={{color: '#6b7280'}}>Tiền cọc đã đóng:</span>
              <strong style={{color: '#15803d'}}>{money(order.paid)} (50%)</strong>
            </div>
            {order.total > order.paid && (
              <div style={{display: 'flex', justifyContent: 'space-between'}}>
                <span style={{color: '#6b7280'}}>Còn lại tại quầy:</span>
                <strong style={{color: '#2563eb'}}>{money(order.total - order.paid)}</strong>
              </div>
            )}
          </div>

          <div style={{background: '#fffbeb', border: '1px solid #fef3c7', borderRadius: 8, padding: '10px 12px', marginTop: 14, fontSize: 12, color: '#92400e', lineHeight: 1.5}}>
            💡 <b>Lưu ý:</b> Quý khách vui lòng có mặt trước giờ chơi 10-15 phút để khởi động và mở <b>Vé điện tử QR</b> tại quầy lễ tân để check-in nhận sân.
          </div>
        </div>

        <div style={{display: 'grid', gap: 10}}>
          <button
            type="button"
            onClick={() => { onClose(); show({kind: 'ticket', order}); }}
            style={{
              width: '100%',
              padding: '12px 16px',
              borderRadius: 8,
              border: 'none',
              background: '#0068ff',
              color: '#ffffff',
              fontSize: 14,
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              boxShadow: '0 2px 8px rgba(0,104,255,0.25)'
            }}
          >
            <span>🎫</span>
            <span>Mở Vé Điện Tử QR Check-in</span>
          </button>

          {order.status === 'CHECKED_IN' && (
            <button
              type="button"
              onClick={() => { onClose(); show({kind: 'extend', order}); }}
              style={{
                width: '100%',
                padding: '10px 16px',
                borderRadius: 8,
                border: '1.5px solid #2563eb',
                background: '#eff6ff',
                color: '#1d4ed8',
                fontSize: 13.5,
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              ⚡ Gia hạn giờ chơi (+30p / +60p)
            </button>
          )}

          <button
            type="button"
            onClick={onClose}
            style={{
              width: '100%',
              padding: '10px 16px',
              borderRadius: 8,
              border: '1px solid #d1d5db',
              background: '#ffffff',
              color: '#4b5563',
              fontSize: 13,
              cursor: 'pointer'
            }}
          >
            Đóng
          </button>
        </div>

        <p style={{margin: '14px 0 0', textAlign: 'center', fontSize: 11, color: '#9ca3af', lineHeight: 1.4}}>
          Tin nhắn dịch vụ tự động ZNS từ hệ thống Courtly Tennis Club gửi tới số điện thoại {order.phone || 'khách hàng'}. Hotline CSKH: 0987 654 321.
        </p>
      </div>
    </div>
  );
}

export function ExtendCourtDialog({order, onClose}) {
  const {t, refresh, notify, pay, show} = useGuest();
  const [loading, setLoading] = useState(true);
  const [extData, setExtData] = useState(null);
  const [error, setError] = useState('');
  const [selectedDuration, setSelectedDuration] = useState(30);
  const [submitting, setSubmitting] = useState(false);
  const [extendedResult, setExtendedResult] = useState(null);

  useEffect(() => {
    api(`/orders/${order.id}/extension-options`)
      .then(res => {
        setExtData(res);
        if (res.options?.length) {
          setSelectedDuration(res.options[0].duration);
        }
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [order.id]);

  const selectedOpt = extData?.options?.find(o => o.duration === selectedDuration) || extData?.options?.[0];

  const handleConfirm = async () => {
    if (!selectedOpt) return;
    setSubmitting(true);
    setError('');
    try {
      await api(`/orders/${order.id}/extend`, 'POST', {
        scheduleIds: selectedOpt.scheduleIds,
        requestId: requestId()
      });
      await refresh();
      notify(t(`Đã gia hạn sân thêm ${selectedOpt.duration} phút thành công!`));
      setExtendedResult(selectedOpt);
    } catch (e) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (extendedResult) {
    return (
      <div style={{maxWidth: 460, margin: '0 auto', textAlign: 'center', padding: '10px 6px'}}>
        <div style={{width: 60, height: 60, borderRadius: '50%', background: '#dcfce7', color: '#15803d', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 32, marginBottom: 14, boxShadow: '0 4px 12px rgba(22,101,52,0.15)'}}>
          ✓
        </div>
        <div style={{display: 'inline-block', background: '#ecfdf5', color: '#047857', border: '1px solid #a7f3d0', padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 700, letterSpacing: 0.5, marginBottom: 8}}>
          {t('GIA HẠN THÀNH CÔNG')}
        </div>
        <h2 style={{fontSize: 22, margin: '0 0 6px', color: '#173c32', fontWeight: 800}}>
          {t('Chúc mừng! Giờ chơi đã được kéo dài')}
        </h2>
        <p style={{fontSize: 14, color: '#4b5563', margin: '0 0 16px', lineHeight: 1.5}}>
          {t('Bạn có thêm')} <b style={{color: '#15803d', fontSize: 16}}>+{extendedResult.duration} {t('phút')}</b> {t('thi đấu trên sân')}.
        </p>

        <div style={{background: '#f8fafc', border: '1.5px solid #e2e8f0', borderRadius: 12, padding: '16px 18px', textAlign: 'left', marginBottom: 20, fontSize: 13.5, display: 'grid', gap: 10}}>
          <div style={{display: 'flex', justifyContent: 'space-between'}}>
            <span style={{color: '#64748b'}}>{t('Sân thi đấu')}:</span>
            <strong style={{color: '#0f172a'}}>{extData?.courtName || t('Sân hiện tại')}</strong>
          </div>
          <div style={{display: 'flex', justifyContent: 'space-between'}}>
            <span style={{color: '#64748b'}}>{t('Giờ kết thúc mới')}:</span>
            <strong style={{color: '#2563eb', fontSize: 16}}>{extendedResult.endTime}</strong>
          </div>
          <div style={{display: 'flex', justifyContent: 'space-between', borderTop: '1px dashed #cbd5e1', paddingTop: 8}}>
            <span style={{color: '#64748b'}}>{t('Phí gia hạn thêm')}:</span>
            <strong style={{color: '#15803d', fontSize: 16}}>+{money(extendedResult.total)}</strong>
          </div>
        </div>

        <div style={{background: '#fffbeb', border: '1px solid #fef3c7', borderRadius: 8, padding: '10px 14px', marginBottom: 20, textAlign: 'left', fontSize: 12.5, color: '#92400e', lineHeight: 1.5}}>
          💡 <b>{t('Thanh toán tiện lợi')}:</b> {t('Khoản phí gia hạn đã được cộng vào tài khoản đơn. Bạn có thể thanh toán tại quầy lễ tân khi làm thủ tục check-out hoặc chuyển khoản VietQR ngay bây giờ.')}
        </div>

        <div style={{display: 'grid', gap: 10}}>
          <Action
            onClick={() => {
              onClose();
              pay('ORDER', order.id, 'BALANCE');
            }}
            style={{background: '#173c32', color: '#def46a', fontWeight: 700, padding: '12px'}}
          >
            📱 {t('Quét mã VietQR thanh toán ngay')} ({money(extendedResult.total)})
          </Action>

          <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10}}>
            <Action
              secondary
              onClick={() => {
                onClose();
                show({kind: 'ticket', order});
              }}
            >
              🎫 {t('Xem Vé Điện Tử')}
            </Action>
            <Action secondary onClick={onClose} style={{fontWeight: 600}}>
              🎾 {t('Tiếp tục thi đấu')}
            </Action>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{maxWidth: 480, margin: '0 auto', padding: '4px'}}>
      {/* Modern Card Hero Header */}
      <div style={{background: 'linear-gradient(135deg, #173c32 0%, #235245 100%)', color: '#ffffff', borderRadius: 14, padding: '20px 18px', marginBottom: 18, position: 'relative', overflow: 'hidden', boxShadow: '0 8px 24px rgba(23,60,50,0.18)'}}>
        <div style={{position: 'absolute', right: -15, top: -15, width: 90, height: 90, borderRadius: '50%', background: 'rgba(222,244,106,0.1)', pointerEvents: 'none'}} />
        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10}}>
          <span style={{background: 'rgba(222,244,106,0.2)', color: '#def46a', border: '1px solid rgba(222,244,106,0.3)', padding: '3px 10px', borderRadius: 12, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, display: 'inline-flex', alignItems: 'center', gap: 6}}>
            <span style={{width: 7, height: 7, borderRadius: '50%', background: '#def46a', display: 'inline-block'}} />
            {t('ĐANG SỬ DỤNG SÂN')}
          </span>
          <span style={{fontSize: 12, color: 'rgba(255,255,255,0.7)', fontFamily: 'monospace'}}>
            #CT-{order.id.slice(0, 8).toUpperCase()}
          </span>
        </div>

        <h2 style={{fontSize: 20, margin: '0 0 6px', color: '#ffffff', fontWeight: 800}}>
          {t('Gia Hạn Thêm Giờ Chơi')}
        </h2>
        <div style={{display: 'flex', alignItems: 'center', gap: 14, fontSize: 13, color: '#d1dac4', flexWrap: 'wrap'}}>
          <span>🏟️ <b>{extData?.courtName || t('Sân của bạn')}</b></span>
          <span>⏰ {t('Kết thúc ca hiện tại')}: <b style={{color: '#def46a'}}>{extData?.currentEndTime || '...'}</b></span>
        </div>
      </div>

      {loading ? (
        <div style={{padding: '36px 0', textAlign: 'center', color: '#637269', fontSize: 14}}>
          <div style={{fontSize: 24, marginBottom: 8}}>🎾</div>
          {t('Đang kiểm tra tính khả dụng của sân và ưu đãi hội viên…')}
        </div>
      ) : error ? (
        <div style={{background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, padding: 16, color: '#b91c1c', fontSize: 13.5, marginBottom: 16}}>
          {error}
        </div>
      ) : !extData?.canExtend ? (
        <div style={{background: '#fffbeb', border: '1.5px solid #fde68a', borderRadius: 12, padding: 18, marginBottom: 18}}>
          <div style={{display: 'flex', gap: 12, alignItems: 'flex-start'}}>
            <span style={{fontSize: 26}}>⚠️</span>
            <div>
              <strong style={{color: '#92400e', fontSize: 15, display: 'block', marginBottom: 4}}>
                {t('Hiện không thể gia hạn sân này')}
              </strong>
              <p style={{fontSize: 13, color: '#b45309', margin: 0, lineHeight: 1.5}}>
                {extData?.reason || t('Sân đã có khách khác đặt trước ngay sau khung giờ hiện tại.')}
              </p>
              <div style={{marginTop: 10, padding: 10, background: 'rgba(255,255,255,0.7)', borderRadius: 8, fontSize: 12, color: '#78350f', lineHeight: 1.4}}>
                💡 <b>{t('Giải pháp')}:</b> {t('Quý khách vui lòng kết thúc trận đúng giờ hoặc ghé quầy lễ tân để kiểm tra chuyển sang sân trống khác.')}
              </div>
            </div>
          </div>
          <Action onClick={onClose} style={{marginTop: 16, width: '100%'}}>{t('Đã hiểu & Đóng')}</Action>
        </div>
      ) : (
        <div>
          <div style={{background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 12.5, color: '#166534', display: 'flex', alignItems: 'center', gap: 8}}>
            <span style={{fontWeight: 700}}>✓</span>
            <span>{t('Sân trống ở khung giờ tiếp theo! Quý khách có thể gia hạn thi đấu ngay lập tức.')}</span>
          </div>

          <label style={{fontSize: 13, fontWeight: 700, color: '#173c32', display: 'block', marginBottom: 8}}>
            {t('Chọn thời gian gia hạn thêm')}:
          </label>

          <div style={{display: 'grid', gap: 12, marginBottom: 18}}>
            {extData.options.map(opt => {
              const isSelected = selectedDuration === opt.duration;
              return (
                <div
                  key={opt.duration}
                  onClick={() => setSelectedDuration(opt.duration)}
                  style={{
                    border: isSelected ? '2px solid #173c32' : '1.5px solid #dce4d6',
                    background: isSelected ? '#f7faf5' : '#ffffff',
                    borderRadius: 12,
                    padding: '14px 16px',
                    cursor: 'pointer',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    boxShadow: isSelected ? '0 4px 12px rgba(23,60,50,0.08)' : 'none',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <div style={{display: 'flex', alignItems: 'center', gap: 12}}>
                    <input
                      type="radio"
                      name="duration"
                      checked={isSelected}
                      onChange={() => setSelectedDuration(opt.duration)}
                      style={{accentColor: '#173c32', width: 18, height: 18}}
                    />
                    <div>
                      <div style={{display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap'}}>
                        <strong style={{fontSize: 16, color: '#173c32'}}>
                          +{opt.duration} {t('phút')}
                        </strong>
                        <span style={{background: isSelected ? '#173c32' : '#e2ebd9', color: isSelected ? '#def46a' : '#2d4538', fontSize: 11.5, fontWeight: 700, padding: '2px 8px', borderRadius: 6}}>
                          {opt.startTime} → {opt.endTime}
                        </span>
                      </div>
                      <span style={{fontSize: 12, color: '#637269', display: 'block', marginTop: 3}}>
                        {opt.duration === 30 ? t('Thi đấu tie-break / giải quyết ván đấu') : t('Thi đấu thêm một set hoàn chỉnh')}
                      </span>
                      {opt.planName && (
                        <span style={{color: '#15803d', fontSize: 12, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 2}}>
                          ★ {t('Ưu đãi')} {opt.planName}: -{money(opt.discount)}
                        </span>
                      )}
                    </div>
                  </div>
                  <div style={{textAlign: 'right'}}>
                    <strong style={{fontSize: 17, color: '#173c32', display: 'block'}}>
                      +{money(opt.total)}
                    </strong>
                    {opt.discount > 0 && (
                      <del style={{fontSize: 12, color: '#94a3b8'}}>{money(opt.total + opt.discount)}</del>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div style={{background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: '12px 14px', fontSize: 12.5, color: '#475569', marginBottom: 18, lineHeight: 1.5}}>
            <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: 4}}>
              <span>{t('Thời gian chơi sau gia hạn')}:</span>
              <strong style={{color: '#173c32'}}>{extData?.currentEndTime} → {selectedOpt?.endTime}</strong>
            </div>
            <div style={{display: 'flex', justifyContent: 'space-between'}}>
              <span>{t('Chi phí phát sinh')}:</span>
              <strong style={{color: '#15803d', fontSize: 14}}>+{money(selectedOpt?.total || 0)}</strong>
            </div>
          </div>

          <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10}}>
            <Action secondary onClick={onClose} disabled={submitting}>
              {t('Hủy bỏ')}
            </Action>
            <Action
              onClick={handleConfirm}
              disabled={submitting}
              style={{background: '#173c32', color: '#def46a', fontWeight: 700, padding: '12px'}}
            >
              {submitting ? t('Đang gia hạn…') : `⚡ ${t('Xác nhận gia hạn')} (+${selectedOpt?.duration || 30}p)`}
            </Action>
          </div>
        </div>
      )}
    </div>
  );
}

export function Orders({history=false}){
  const {t,data,pay,refresh,navigate,setMoveOrder,setDate,show}=useGuest();
  const [filter,setFilter]=useState(history ? 'HISTORY' : 'ALL'),[page,setPage]=useState(0);
  const allOrders = data?.orders || [];
  const todayStr = dateToday();

  const counts = useMemo(() => {
    let upcoming = 0, holding = 0, past = 0;
    for (const o of allOrders) {
      const oDate = o.date || o.slots?.[0]?.scheduleDate || '';
      if (o.status === 'HOLDING') holding++;
      else if (o.status === 'CHECKED_IN' || (o.status === 'CONFIRMED' && oDate >= todayStr)) upcoming++;
      else past++;
    }
    return { all: allOrders.length, upcoming, holding, past };
  }, [allOrders, todayStr]);

  const tabs = useMemo(() => [
    { id: 'ALL', label: t('Tất cả'), count: counts.all },
    { id: 'UPCOMING', label: t('🎫 Sắp tới / Vé QR'), count: counts.upcoming, highlight: counts.upcoming > 0 },
    { id: 'HOLDING', label: t('⏳ Chờ cọc (5p)'), count: counts.holding, urgent: counts.holding > 0 },
    { id: 'HISTORY', label: t('📋 Lịch sử'), count: counts.past }
  ], [counts, t]);

  const rows = useMemo(() => {
    return allOrders.filter(o => {
      const oDate = o.date || o.slots?.[0]?.scheduleDate || '';
      const isPastConfirmed = o.status === 'CONFIRMED' && oDate < todayStr;
      if (filter === 'UPCOMING') return o.status === 'CHECKED_IN' || (o.status === 'CONFIRMED' && oDate >= todayStr);
      if (filter === 'HOLDING') return o.status === 'HOLDING';
      if (filter === 'HISTORY') return ['COMPLETED', 'CANCELLED', 'EXPIRED'].includes(o.status) || isPastConfirmed;
      return true;
    }).sort((a,b) => (b.createdAt || b.date).localeCompare(a.createdAt || a.date));
  }, [allOrders, filter, todayStr]);

  return (
    <section className="ct-pad">
      <div className="gx-heading">
        <span className="ct-eyebrow">COURTLY / {t('TÀI KHOẢN')}</span>
        <h1>{t(history?'Lịch sử đặt sân':'Đơn của tôi')}</h1>
        <p>{t('Theo dõi lịch đặt, vé điện tử QR và trạng thái thanh toán theo thời gian thực.')}</p>
      </div>

      {/* Smart Order Tabs */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 14,
        marginBottom: 24
      }}>
        <div style={{
          display: 'flex',
          gap: 6,
          flexWrap: 'wrap',
          background: '#ecefe6',
          padding: 5,
          borderRadius: 10,
          border: '1px solid #d8dece'
        }}>
          {tabs.map(tab => {
            const isActive = filter === tab.id;
            return (
              <button
                type="button"
                key={tab.id}
                onClick={() => { setFilter(tab.id); setPage(0); }}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 7,
                  padding: '9px 15px',
                  borderRadius: 7,
                  border: 'none',
                  fontSize: 13.5,
                  fontWeight: isActive ? 700 : 500,
                  cursor: 'pointer',
                  background: isActive ? '#173c32' : 'transparent',
                  color: isActive ? '#def46a' : '#455a4f',
                  boxShadow: isActive ? '0 2px 6px rgba(23,60,50,0.18)' : 'none',
                  transition: 'all 0.15s ease'
                }}
              >
                <span>{tab.label}</span>
                <span style={{
                  display: 'inline-block',
                  padding: '2px 7px',
                  borderRadius: 12,
                  fontSize: 11,
                  fontWeight: 700,
                  background: isActive ? 'rgba(222,244,106,0.22)' : 'rgba(23,60,50,0.08)',
                  color: isActive ? '#def46a' : (tab.urgent ? '#b45309' : '#173c32')
                }}>
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>

        <Action onClick={() => navigate('booking')} style={{ padding: '10px 20px', fontSize: 13.5 }}>
          {t('+ Đặt sân mới')}
        </Action>
      </div>

      <div className="gx-records" style={{display:'grid',gap:18}}>
        {rows.slice(page*12,(page+1)*12).map(o=>{
          const sortedSlots=[...o.slots].sort((a,b)=>a.start.localeCompare(b.start));
          const startTime=time(sortedSlots[0]?.start)||`${sortedSlots[0]?.hour}:00`;
          const endTime=time(sortedSlots.at(-1)?.end)||`${(sortedSlots.at(-1)?.hour||0)+1}:00`;
          const courtName=data.courts.find(c=>c.id===sortedSlots[0]?.court)?.name||t('Sân Tennis');
          const refStaff=o.staff?.[0];
          const oDate=o.date||sortedSlots[0]?.scheduleDate||'';
          const isPastConfirmed=o.status==='CONFIRMED'&&oDate<todayStr;
          const meta=(()=>{try{return typeof o.metadataRaw==='string'?JSON.parse(o.metadataRaw):(o.metadataRaw||{})}catch(e){return {}}})();

          return (
            <article key={o.id} style={{background:'#ffffff',borderRadius:12,border:'1.5px solid #dce4d6',padding:20,boxShadow:'0 2px 10px rgba(0,0,0,0.03)'}}>
              {/* Card Header: Code + Date + State Badge */}
              <header style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14,borderBottom:'1px solid #f0f3eb',paddingBottom:12}}>
                <div>
                  <span style={{fontSize:11,color:'#708477',textTransform:'uppercase',letterSpacing:0.5,display:'block'}}>{t('MÃ ĐƠN')}</span>
                  <b style={{fontSize:16,color:'#173c32',fontFamily:'monospace'}}>#CT-{o.id.slice(0,8).toUpperCase()}</b>
                </div>
                <div style={{textAlign:'right'}}>
                  {isPastConfirmed ? (
                    <span style={{background:'#fef3c7',color:'#92400e',padding:'4px 10px',borderRadius:6,fontSize:11,fontWeight:700,letterSpacing:0.5}}>
                      {t('ĐÃ QUA NGÀY CHƠI')}
                    </span>
                  ) : (
                    <State value={o.status}/>
                  )}
                </div>
              </header>

              {/* Card Hero: Court, Date, Time (Clear & Big) */}
              <div style={{background:'#f7faf5',border:'1px solid #e2ebd9',borderRadius:10,padding:'14px 16px',marginBottom:14,display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:12}}>
                <div style={{display:'flex',alignItems:'center',gap:12}}>
                  <div style={{width:42,height:42,borderRadius:8,background:'#173c32',color:'#def46a',display:'inline-flex',alignItems:'center',justifyContent:'center',fontSize:20}}>
                    🎾
                  </div>
                  <div>
                    <div style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap'}}>
                      <h3 style={{margin:0,fontSize:17,color:'#173c32',fontWeight:700}}>{courtName}</h3>
                      {meta.recurringWeeks > 1 && (
                        <span style={{background:'#ccfbf1',color:'#0f766e',fontSize:11.5,fontWeight:700,padding:'2px 8px',borderRadius:6}}>
                          🔄 {meta.recurringSummary || `Định kỳ ${meta.recurringWeeks} tuần`}
                        </span>
                      )}
                    </div>
                    <span style={{fontSize:13,color:'#52655a'}}>
                      ⏰ <b>{startTime} – {endTime}</b> · {meta.recurringWeeks > 1 ? t('Bắt đầu từ') : t('Ngày')} {o.date}
                    </span>
                  </div>
                </div>
                {refStaff && (
                  <div style={{background:'#ffffff',border:'1px solid #c8d7bf',borderRadius:6,padding:'6px 12px',fontSize:12,color:'#173c32',display:'flex',alignItems:'center',gap:6}}>
                    <span>👨‍⚖️ {t('Trọng tài')}:</span>
                    <b>{refStaff.name}</b>
                  </div>
                )}
              </div>

              {o.visits?.length>1&&<details style={{marginBottom:14}}><summary>{t('Các buổi trong đơn')} ({o.visits.length})</summary>{o.visits.map(v=><div key={v.date}>{v.date} · {t(v.status)}</div>)}</details>}
              {/* Financial Summary: 3 Crystal Clear Lines */}
              <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit, minmax(130px, 1fr))',gap:10,background:'#ffffff',border:'1px solid #edf2e8',borderRadius:8,padding:'12px 14px',marginBottom:14}}>
                <div>
                  <span style={{fontSize:11,color:'#708477',display:'block'}}>{t('Tổng chi phí')}:</span>
                  <strong style={{fontSize:16,color:'#173c32'}}>{money(o.total)}</strong>
                </div>
                <div>
                  <span style={{fontSize:11,color:'#708477',display:'block'}}>{t('Tiền cọc (50%)')}:</span>
                  <strong style={{fontSize:15,color:o.paid>=o.deposit?'#15803d':'#b45309'}}>
                    {o.paid>=o.deposit?`✓ ${t('Đã đóng')} ${money(o.deposit)}`:`${t('Chưa đóng')} (${money(o.deposit)})`}
                  </strong>
                </div>
                {o.paid < o.total && !['CANCELLED','EXPIRED'].includes(o.status) && (
                  <div>
                    <span style={{fontSize:11,color:'#708477',display:'block'}}>{t('Thanh toán tại quầy')}:</span>
                    <strong style={{fontSize:15,color:'#2563eb'}}>{money(o.total - o.paid)}</strong>
                  </div>
                )}
                {o.paid >= o.total && (
                  <div>
                    <span style={{fontSize:11,color:'#708477',display:'block'}}>{t('Quyết toán')}:</span>
                    <strong style={{fontSize:15,color:'#15803d'}}>✓ {t('Đã thanh toán đủ')}</strong>
                  </div>
                )}
              </div>

              {/* Holding Countdown Banner */}
              {o.status==='HOLDING' && <HoldCountdown until={o.holdUntil}/>}

              {/* Past Confirmed Banner */}
              {isPastConfirmed && (
                <div style={{background:'#fefce8',border:'1px solid #fef08a',borderRadius:8,padding:'10px 14px',margin:'10px 0',fontSize:12.5,color:'#854d0e'}}>
                  ⚠️ <b>{t('Đơn đã qua ngày chơi')} ({o.date}).</b> {t('Quý khách đã không làm thủ tục check-in vào khung giờ này. Đơn được lưu trong lịch sử.')}
                </div>
              )}

              {/* Confirmed Banner */}
              {o.status==='CONFIRMED' && !isPastConfirmed && (
                <div style={{background:'#f0fdf4',border:'1px solid #bbf7d0',borderRadius:8,padding:'10px 14px',margin:'10px 0',fontSize:12.5,color:'#166534'}}>
                  ✓ <b>{t('Đã xác nhận lịch đặt.')}</b> {t('Xuất trình')} <b>{t('Vé điện tử & Mã QR')}</b> {t('bên dưới cho quầy lễ tân khi đến sân để check-in.')}
                </div>
              )}

              {/* Checked-In Banner */}
              {o.status==='CHECKED_IN' && (
                <div style={{background:'#eff6ff',border:'1px solid #bfdbfe',borderRadius:8,padding:'10px 14px',margin:'10px 0',fontSize:12.5,color:'#1e40af'}}>
                  🎾 <b>{t('Đang sử dụng sân.')}</b> {t('Chúc quý khách có buổi thi đấu và luyện tập tuyệt vời!')}
                </div>
              )}

              {/* Completed Banner */}
              {o.status==='COMPLETED' && (
                <div style={{background:'#f8fafc',border:'1px solid #e2e8f0',borderRadius:8,padding:'10px 14px',margin:'10px 0',fontSize:12.5,color:'#475569'}}>
                  ✓ {t('Buổi chơi đã hoàn tất.')}
                </div>
              )}

              {/* Transparent Refund & Cancellation Settlement Card */}
              {['CANCELLED', 'EXPIRED'].includes(o.status) && (
                (() => {
                  const settlement = o.cancellationSettlement || meta?.cancellationSettlement;
                  const refunded = o.finance?.refunded || 0;
                  const refundPending = o.finance?.refundPending || (settlement ? (settlement.refundAmount || 0) : 0);
                  const policyDesc = settlement?.policyDescription || (
                    settlement?.hoursBeforePlay !== undefined && settlement?.hoursBeforePlay !== null
                      ? (settlement.hoursBeforePlay >= 24 ? 'Hủy trước > 24h: Hoàn 100% cọc' : settlement.hoursBeforePlay >= 12 ? 'Hủy 12h - 24h: Hoàn 50% cọc' : 'Hủy cận giờ < 12h: Giữ 100% cọc')
                      : (o.paid > 0 ? 'Chính sách hoàn hủy CLB' : 'Hủy đơn giữ chỗ')
                  );
                  const retained = settlement?.retainedAmount || 0;
                  const isPending = refundPending > 0 && refunded === 0;

                  return (
                    <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: '14px 16px', margin: '14px 0', fontSize: 13 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, flexWrap: 'wrap', gap: 6 }}>
                        <strong style={{ color: '#1e293b', display: 'flex', alignItems: 'center', gap: 6, fontSize: 13.5 }}>
                          <span>⚖️</span> {t('Đối soát hoàn tiền & Chính sách')}
                        </strong>
                        <span style={{
                          fontSize: 11.5,
                          fontWeight: 700,
                          padding: '3px 9px',
                          borderRadius: 6,
                          background: refunded > 0 ? '#dcfce7' : (isPending ? '#fef3c7' : '#f1f5f9'),
                          color: refunded > 0 ? '#166534' : (isPending ? '#b45309' : '#64748b'),
                          border: `1px solid ${refunded > 0 ? '#bbf7d0' : (isPending ? '#fde68a' : '#e2e8f0')}`
                        }}>
                          {refunded > 0 ? t('✓ ĐÃ HOÀN TIỀN') : (isPending ? t('⏳ ĐANG CHỜ HOÀN TIỀN') : (o.paid > 0 ? t('GIỮ CỌC') : t('ĐÃ HỦY')))}
                        </span>
                      </div>

                      <div style={{ color: '#334155', fontSize: 12.5, marginBottom: 10, lineHeight: 1.5 }}>
                        <b>{t('Chính sách áp dụng')}:</b> <span style={{ color: '#1e40af', fontWeight: 600 }}>{t(policyDesc)}</span>
                        {meta?.cancelReason && (
                          <div style={{ color: '#475569', marginTop: 3 }}>
                            <b>{t('Lý do hủy')}:</b> {meta.cancelReason}
                          </div>
                        )}
                        {settlement?.cancelledBy && (
                          <div style={{ color: '#64748b', fontSize: 11.5, marginTop: 2 }}>
                            {t('Người thực hiện hủy')}: {settlement.cancelledBy}
                          </div>
                        )}
                      </div>

                      {o.paid > 0 && (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 8, background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 8, padding: '10px 12px' }}>
                          <div>
                            <small style={{ color: '#64748b', display: 'block' }}>{t('Tiền đã đóng')}:</small>
                            <b style={{ color: '#0f172a', fontSize: 14 }}>{money(o.paid)}</b>
                          </div>
                          {refunded > 0 ? (
                            <div>
                              <small style={{ color: '#166534', display: 'block' }}>{t('Đã chuyển hoàn')}:</small>
                              <b style={{ color: '#166534', fontSize: 14 }}>{money(refunded)}</b>
                            </div>
                          ) : (
                            <div>
                              <small style={{ color: '#b45309', display: 'block' }}>{t('Số tiền được hoàn')}:</small>
                              <b style={{ color: isPending ? '#d97706' : '#64748b', fontSize: 14 }}>{money(refundPending)}</b>
                            </div>
                          )}
                          <div>
                            <small style={{ color: '#64748b', display: 'block' }}>{t('Khấu trừ / Giữ cọc')}:</small>
                            <b style={{ color: retained > 0 ? '#b91c1c' : '#64748b', fontSize: 14 }}>{money(retained)}</b>
                          </div>
                        </div>
                      )}

                      {isPending && (
                        <div style={{ marginTop: 10, fontSize: 12, color: '#92400e', background: '#fffbeb', padding: '8px 12px', borderRadius: 6, border: '1px solid #fef3c7', lineHeight: 1.5 }}>
                          ℹ️ {t('Khoản hoàn')} <b>{money(refundPending)}</b> {t('đã được ghi nhận vào danh sách chờ hoàn của bộ phận kế toán. Quý khách vui lòng kiểm tra tài khoản đã thanh toán hoặc liên hệ hotline CLB để nhận hoàn sớm nhất.')}
                        </div>
                      )}
                    </div>
                  );
                })()
              )}

              {/* Action Buttons */}
              <div className="gx-order-actions" style={{display:'flex',gap:10,flexWrap:'wrap',alignItems:'center',marginTop:14,paddingTop:12,borderTop:'1px solid #f0f3eb'}}>
                {o.status==='HOLDING' && (
                  <>
                    <Action onClick={()=>pay('ORDER',o.id,'DEPOSIT')} style={{background:'#173c32',color:'#def46a',fontWeight:700}}>
                      {t('Thanh toán cọc ngay')} ({money(o.deposit)}) ↗
                    </Action>
                    <Action secondary onClick={()=>show({kind:'cancel',order:o})}>{t('Hủy giữ chỗ')}</Action>
                  </>
                )}

                {o.status==='CONFIRMED' && isPastConfirmed && (
                  <>
                    <Action secondary onClick={()=>show({kind:'ticket',order:o})}>
                      🎫 {t('Xem lại vé')}
                    </Action>
                  </>
                )}

                {o.status==='CONFIRMED' && !isPastConfirmed && (
                  <>
                    <Action onClick={()=>show({kind:'ticket',order:o})} style={{background:'#173c32',color:'#ffffff'}}>
                      🎫 {t('Xem Vé Điện Tử & Mã QR Check-in')}
                    </Action>
                    <Action secondary onClick={()=>{setDate(o.date);setMoveOrder(o);navigate('booking')}}>{t('Đổi lịch sân')}</Action>
                    <Action secondary onClick={()=>show({kind:'cancel',order:o})}>{t('Hủy đơn')}</Action>
                  </>
                )}

                {o.status==='CHECKED_IN' && (
                  <>
                    <Action onClick={()=>show({kind:'ticket',order:o})} style={{background:'#2563eb',color:'#ffffff'}}>
                      🎫 {t('Xem Vé Điện Tử')}
                    </Action>
                    <Action onClick={()=>show({kind:'extend',order:o})} style={{background:'#173c32',color:'#def46a',fontWeight:700}}>
                      ⚡ {t('Gia hạn giờ chơi')}
                    </Action>
                    {o.paid < o.total && (
                      <Action onClick={()=>pay('ORDER',o.id,'BALANCE')}>{t('Thanh toán còn lại')} ({money(o.total - o.paid)})</Action>
                    )}
                  </>
                )}

                {o.status==='COMPLETED' && (
                  <>
                    <Action secondary onClick={()=>show({kind:'ticket',order:o})}>🎫 {t('Xem lại vé')}</Action>
                  </>
                )}
              </div>
            </article>
          );
        })}
      </div>

      {!rows.length && (
        <Empty>
          {filter === 'UPCOMING'
            ? t('Không có đơn nào sắp diễn ra. Đặt sân ngay để nhận vé QR!')
            : filter === 'HOLDING'
            ? t('Không có đơn nào đang chờ cọc.')
            : filter === 'HISTORY'
            ? t('Chưa có lịch sử đơn chơi trước đây.')
            : t('Bạn chưa có đơn đặt sân nào.')}
        </Empty>
      )}
      {rows.length>12&&(
        <div className="gx-actions" style={{marginTop:20}}>
          <Action secondary disabled={page===0} onClick={()=>setPage(page-1)}>{t('Trang trước')}</Action>
          <span>{page+1} / {Math.ceil(rows.length/12)}</span>
          <Action secondary disabled={(page+1)*12>=rows.length} onClick={()=>setPage(page+1)}>{t('Trang sau')}</Action>
        </div>
      )}
    </section>
  );
}

export function CancelDialog({order,onClose}){
  const {t,refresh}=useGuest();
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [quote,setQuote]=useState(null);
  const [reason,setReason]=useState('Bận việc đột xuất');
  const [customReason,setCustomReason]=useState('');
  const [id]=useState(requestId);

  useEffect(()=>{
    let live=true;
    api(`/orders/${order.id}/cancellation-preview`)
      .then(x=>{if(live)setQuote(x)})
      .catch(e=>{if(live)setError(e.message)});
    return()=>{live=false};
  },[order.id]);

  const finalReason = reason === 'Khác' ? (customReason.trim() || 'Lý do cá nhân') : reason;

  return (
    <div className="gx-form" style={{maxWidth: 460, margin: '0 auto'}}>
      <h2 style={{margin: '0 0 6px', color: '#173c32'}}>{t('Xác nhận hủy đơn đặt sân')}</h2>
      <p style={{margin: '0 0 16px', color: '#52655a', fontSize: 13}}>
        #{order.id.slice(0,8).toUpperCase()} · {order.date}
      </p>

      {quote && (
        <div style={{background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: '14px 16px', marginBottom: 16, fontSize: 13}}>
          <div style={{display: 'inline-block', background: '#dbeafe', color: '#1e40af', padding: '3px 8px', borderRadius: 6, fontWeight: 700, fontSize: 12, marginBottom: 8}}>
            {quote.policyDescription || (quote.refundPercent === 100 ? t('Hoàn 100% tiền cọc') : quote.refundPercent === 50 ? t('Hoàn 50% tiền cọc') : t('Giữ 100% cọc (Không hoàn)'))}
          </div>

          <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, margin: '8px 0'}}>
            <div>
              <span style={{color: '#64748b', fontSize: 12, display: 'block'}}>{t('Tiền cọc đã đóng')}:</span>
              <strong style={{color: '#0f172a', fontSize: 15}}>{money(quote.paid)}</strong>
            </div>
            <div>
              <span style={{color: '#64748b', fontSize: 12, display: 'block'}}>{t('Dự kiến hoàn trả')}:</span>
              <strong style={{color: quote.refundAmount > 0 ? '#15803d' : '#64748b', fontSize: 15}}>
                {money(quote.refundAmount)} ({quote.refundPercent}%)
              </strong>
            </div>
          </div>

          {quote.retainedAmount > 0 && (
            <div style={{color: '#b91c1c', fontSize: 12, marginTop: 4}}>
              * {t('Khấu trừ theo quy định hủy')}: <b>{money(quote.retainedAmount)}</b>
            </div>
          )}

          <div style={{marginTop: 10, fontSize: 11.5, color: '#64748b', borderTop: '1px dashed #cbd5e1', paddingTop: 8, lineHeight: 1.4}}>
            ℹ️ {t('Sân sẽ được giải phóng cho khách khác ngay lập tức. Số tiền hoàn (nếu có) sẽ chuyển sang danh sách đối soát để CLB hoàn tiền về tài khoản của bạn.')}
          </div>
        </div>
      )}

      <div style={{marginBottom: 16}}>
        <label style={{display: 'block', fontSize: 13, fontWeight: 600, color: '#334155', marginBottom: 6}}>
          {t('Lý do hủy đơn')}:
        </label>
        <select
          value={reason}
          onChange={e=>setReason(e.target.value)}
          style={{width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 13}}
        >
          <option value="Bận việc đột xuất">{t('Bận việc đột xuất')}</option>
          <option value="Thời tiết không thuận lợi">{t('Thời tiết không thuận lợi')}</option>
          <option value="Thay đổi kế hoạch của nhóm">{t('Thay đổi kế hoạch của nhóm')}</option>
          <option value="Đặt nhầm ngày / giờ">{t('Đặt nhầm ngày / giờ')}</option>
          <option value="Khác">{t('Lý do khác…')}</option>
        </select>
        {reason === 'Khác' && (
          <input
            style={{width: '100%', marginTop: 8, padding: '8px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 13}}
            placeholder={t('Nhập chi tiết lý do…')}
            value={customReason}
            onChange={e=>setCustomReason(e.target.value)}
            maxLength={120}
          />
        )}
      </div>

      {error && <div className="gx-error" role="alert" style={{marginBottom: 14}}>{t(error)}</div>}

      <div style={{display: 'flex', gap: 10, marginTop: 8}}>
        <Action
          disabled={busy || !quote || !!error}
          onClick={async()=>{
            setBusy(true);
            try{
              await api(`/orders/${order.id}/cancel`,'POST',{requestId: id, reason: finalReason});
              await refresh();
              onClose();
            }catch(e){
              setError(e.message);
            }finally{
              setBusy(false);
            }
          }}
          style={{background: '#dc2626', color: '#fff', border: 'none', flex: 1}}
        >
          {busy ? t('Đang xử lý…') : t('Xác nhận hủy sân')}
        </Action>
        <Action secondary onClick={onClose} style={{flex: 1}}>{t('Giữ lại đơn')}</Action>
      </div>
    </div>
  );
}

export function Membership(){
  const {t,data,user,login,refresh,pay,notify}=useGuest();
  const [busy,setBusy]=useState(false);
  const join=async planId=>{if(!user){login();return}setBusy(true);try{const r=await api('/membership/requests','POST',{planId,requestId:requestId()});await refresh();await pay('MEMBERSHIP',r.id)}catch(e){notify(e.message)}finally{setBusy(false)}};
  const plans=data?.membershipPlans||[];
  return <section className="ct-pad"><div className="gx-heading"><span className="ct-eyebrow">COURTLY MEMBERSHIP</span><h1>{t('Chơi đều hơn. Chủ động hơn.')}</h1><p>{t('Không tự gia hạn. Chỉ kích hoạt sau khi xác nhận đủ phí.')}</p></div><div className="gx-plan-grid"><article className="ct-plan"><h2>Guest</h2><div className="ct-price">{t('Miễn phí')}<span>{t('Không phí hội viên')}</span></div><ul><li>{t('Đặt cả sân thường và VIP')}</li><li>{t('Đặt trước tối đa')} 7 {t('ngày')}</li><li>{t('Thanh toán theo giá niêm yết')}</li><li>{t('Gửi xe theo biểu phí lượt')}</li></ul></article>{plans.map(p=><article key={p.id} className={'ct-plan '+(p.id==='club'?'ct-plan-featured':'')}><h2>{p.name}</h2><div className="ct-price">{money(p.price)}<span>/ {p.days} {t('ngày')}</span></div><ul><li>{t('Giảm tiền sân A/B')}: {p.discountPercent}%</li><li>{t('Giảm tiền sân VIP')}: {p.vipDiscountPercent??(p.id==='plus'?10:5)}%</li><li>{t('Đặt trước tối đa')} {p.advanceDays??(p.id==='plus'?21:14)} {t('ngày')}</li><li>{p.freeChanges??(p.id==='plus'?2:1)} {t('lượt đổi lịch có điều kiện')}</li><li>{t('Miễn phí gửi xe')}</li>{p.id==='plus'&&<li>{t('Đặc quyền phòng VIP Lounge')}</li>}</ul><Action disabled={busy} onClick={()=>join(p.id)}>{t('Chọn')} {p.name}</Action></article>)}</div><p className="gx-notice">{t('Ưu đãi chỉ áp dụng tiền sân trong thời hạn gói. Đổi lịch trước ít nhất 24 giờ, cùng loại sân/thời lượng và còn chỗ; chênh lệch giá vẫn cần thanh toán.')}</p><div className="gx-records">{data?.memberships?.map(m=><article key={m.id}><header><h3>{m.planName}</h3><State value={m.status}/></header><p>{m.startsAt&&new Date(m.startsAt).toLocaleDateString()} {m.endsAt&&' → '+new Date(m.endsAt).toLocaleDateString()}</p>{m.status==='PENDING'&&<div className="gx-actions"><Action onClick={()=>pay('MEMBERSHIP',m.id)}>{t('Thanh toán phí hội viên')}</Action><Action secondary onClick={async()=>{try{await api(`/membership/requests/${m.id}/cancel`,'POST',{requestId:requestId()});await refresh()}catch(e){notify(e.message)}}}>{t('Hủy yêu cầu')}</Action></div>}</article>)}</div></section>;
}

export function Profile(){
  const {t,user,data,refresh,notify}=useGuest();
  const row=data?.accounts?.[0];
  const [name,setName]=useState(user.name),[phone,setPhone]=useState(row?.phone||''),[old,setOld]=useState(''),[password,setPassword]=useState(''),[busy,setBusy]=useState(false);
  const submit=async(e,kind)=>{e.preventDefault();setBusy(true);try{if(kind==='profile')await api('/profile','PATCH',{name,phone});else{await api('/auth/password','POST',{currentPassword:old,newPassword:password});setOld('');setPassword('')}await refresh();notify(t('Đã lưu thông tin'))}catch(e){notify(e.message)}finally{setBusy(false)}};
  return <section className="ct-pad"><div className="gx-heading"><h1>{t('Hồ sơ của tôi')}</h1><p>{user.email}</p></div><div className="gx-split"><form className="gx-form" onSubmit={e=>submit(e,'profile')}><label>{t('Họ và tên')}<input required maxLength={100} value={name} onChange={e=>setName(e.target.value)}/></label><label>{t('Điện thoại')}<input type="tel" maxLength={30} value={phone} onChange={e=>setPhone(e.target.value)}/></label><Action type="submit" disabled={busy}>{t('Lưu hồ sơ')}</Action></form><form className="gx-form" onSubmit={e=>submit(e,'password')}><h3>{t('Đổi mật khẩu')}</h3><label>{t('Mật khẩu hiện tại')}<input type="password" required value={old} onChange={e=>setOld(e.target.value)} autoComplete="current-password"/></label><label>{t('Mật khẩu mới')}<input type="password" required minLength={6} maxLength={72} value={password} onChange={e=>setPassword(e.target.value)} autoComplete="new-password"/></label><p>{t('Từ 6 ký tự, tối đa 72 byte UTF-8.')}</p><Action type="submit" disabled={busy}>{t('Đổi mật khẩu')}</Action></form></div></section>;
}
