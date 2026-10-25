import React,{useState,useEffect,useMemo} from 'react';
import QRCode from 'qrcode';
import {api} from '../services/api';
import {useGuest,Action,State,Empty,money,time,requestId} from './context';

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
  const {t, data} = useGuest();
  const [qrUrl, setQrUrl] = useState('');
  const court = data?.courts?.find(c => c.id === order.slots?.[0]?.court);
  const slots = [...order.slots].sort((a,b) => a.start.localeCompare(b.start));
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
        <h2 style={{fontSize: 22, margin: '8px 0 4px', color: '#fff'}}>{t('Vé Check-in Vào Sân')}</h2>
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

        <Action onClick={onClose} style={{width: '100%', padding: '12px'}}>{t('Đóng vé')}</Action>
      </div>
    </div>
  );
}

export function Orders({history=false}){
  const {t,data,pay,refresh,navigate,setMoveOrder,setDate,show}=useGuest();
  const [filter,setFilter]=useState(history ? 'HISTORY' : 'ALL'),[page,setPage]=useState(0);
  const allOrders = data?.orders || [];

  const counts = useMemo(() => {
    let upcoming = 0, holding = 0, past = 0;
    for (const o of allOrders) {
      if (['CONFIRMED', 'CHECKED_IN'].includes(o.status)) upcoming++;
      else if (o.status === 'HOLDING') holding++;
      else if (['COMPLETED', 'CANCELLED', 'EXPIRED'].includes(o.status)) past++;
    }
    return { all: allOrders.length, upcoming, holding, past };
  }, [allOrders]);

  const tabs = useMemo(() => [
    { id: 'ALL', label: t('Tất cả'), count: counts.all },
    { id: 'UPCOMING', label: t('🎫 Sắp tới / Vé QR'), count: counts.upcoming, highlight: counts.upcoming > 0 },
    { id: 'HOLDING', label: t('⏳ Chờ cọc (5p)'), count: counts.holding, urgent: counts.holding > 0 },
    { id: 'HISTORY', label: t('📋 Lịch sử'), count: counts.past }
  ], [counts, t]);

  const rows = useMemo(() => {
    return allOrders.filter(o => {
      if (filter === 'UPCOMING') return ['CONFIRMED', 'CHECKED_IN'].includes(o.status);
      if (filter === 'HOLDING') return o.status === 'HOLDING';
      if (filter === 'HISTORY') return ['COMPLETED', 'CANCELLED', 'EXPIRED'].includes(o.status);
      return true;
    }).sort((a,b) => (b.createdAt || b.date).localeCompare(a.createdAt || a.date));
  }, [allOrders, filter]);

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

          return (
            <article key={o.id} style={{background:'#ffffff',borderRadius:12,border:'1.5px solid #dce4d6',padding:20,boxShadow:'0 2px 10px rgba(0,0,0,0.03)'}}>
              {/* Card Header: Code + Date + State Badge */}
              <header style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14,borderBottom:'1px solid #f0f3eb',paddingBottom:12}}>
                <div>
                  <span style={{fontSize:11,color:'#708477',textTransform:'uppercase',letterSpacing:0.5,display:'block'}}>{t('MÃ ĐƠN')}</span>
                  <b style={{fontSize:16,color:'#173c32',fontFamily:'monospace'}}>#CT-{o.id.slice(0,8).toUpperCase()}</b>
                </div>
                <div style={{textAlign:'right'}}>
                  <State value={o.status}/>
                </div>
              </header>

              {/* Card Hero: Court, Date, Time (Clear & Big) */}
              <div style={{background:'#f7faf5',border:'1px solid #e2ebd9',borderRadius:10,padding:'14px 16px',marginBottom:14,display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:12}}>
                <div style={{display:'flex',alignItems:'center',gap:12}}>
                  <div style={{width:42,height:42,borderRadius:8,background:'#173c32',color:'#def46a',display:'inline-flex',alignItems:'center',justifyContent:'center',fontSize:20}}>
                    🎾
                  </div>
                  <div>
                    <h3 style={{margin:0,fontSize:17,color:'#173c32',fontWeight:700}}>{courtName}</h3>
                    <span style={{fontSize:13,color:'#52655a'}}>
                      ⏰ <b>{startTime} – {endTime}</b> · Ngày {o.date}
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

              {/* Confirmed Banner */}
              {o.status==='CONFIRMED' && (
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

              {o.finance?.refundPending>0&&<p className="gx-notice">{t('Chờ hoàn')}: {money(o.finance.refundPending)} · {t('CLB đang xử lý; chưa chuyển hoàn tự động.')}</p>}
              {o.cancellationSettlement&&<p>{t('Tiền giữ lại theo chính sách')}: {money(o.cancellationSettlement.retainedAmount)}</p>}

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

                {o.status==='CONFIRMED' && (
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
                    {o.paid < o.total && (
                      <Action onClick={()=>pay('ORDER',o.id,'BALANCE')}>{t('Thanh toán còn lại')} ({money(o.total - o.paid)})</Action>
                    )}
                  </>
                )}

                {o.status==='COMPLETED' && (
                  <Action secondary onClick={()=>show({kind:'ticket',order:o})}>🎫 {t('Xem lại vé')}</Action>
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
 const {t,refresh}=useGuest();const [busy,setBusy]=useState(false),[error,setError]=useState(''),[quote,setQuote]=useState(null);
 const [id]=useState(requestId);
 useEffect(()=>{let live=true;api(`/orders/${order.id}/cancellation-preview`).then(x=>{if(live)setQuote(x)}).catch(e=>{if(live)setError(e.message)});return()=>{live=false}},[order.id]);
 return <div className="gx-form"><h2>{t('Xác nhận hủy đơn')}</h2><p>#{order.id.slice(0,8)} · {order.date}</p>{quote&&<><p>{t('Đã thu')}: {money(quote.paid)}</p><p>{t('Dự kiến hoàn')}: {money(quote.refundAmount)} ({quote.refundPercent}%)</p><p>{t('Giữ lại theo chính sách')}: {money(quote.retainedAmount)}</p><p>{t('Sân sẽ được giải phóng. Khoản hoàn chuyển sang chờ CLB xử lý, chưa tự chuyển tiền về ngân hàng.')}</p></>}{error&&<div className="gx-error" role="alert">{t(error)}</div>}<Action disabled={busy||!quote||!!error} onClick={async()=>{setBusy(true);try{await api(`/orders/${order.id}/cancel`,'POST',{requestId:id});await refresh();onClose()}catch(e){setError(e.message)}finally{setBusy(false)}}}>{t('Xác nhận hủy')}</Action><Action secondary onClick={onClose}>{t('Giữ đơn')}</Action></div>;
}

export function Membership(){
  const {t,data,user,login,refresh,pay,notify}=useGuest();
  const [busy,setBusy]=useState(false);
  const join=async planId=>{if(!user){login();return}setBusy(true);try{const r=await api('/membership/requests','POST',{planId,requestId:requestId()});await refresh();await pay('MEMBERSHIP',r.id)}catch(e){notify(e.message)}finally{setBusy(false)}};
  const plans=data?.membershipPlans||[];
  return <section className="ct-pad"><div className="gx-heading"><span className="ct-eyebrow">COURTLY MEMBERSHIP</span><h1>{t('Chơi đều hơn. Chủ động hơn.')}</h1><p>{t('Không tự gia hạn. Chỉ kích hoạt sau khi xác nhận đủ phí.')}</p></div><div className="gx-plan-grid"><article className="ct-plan"><h2>Guest</h2><div className="ct-price">{t('Miễn phí')}<span>{t('Không phí hội viên')}</span></div><ul><li>{t('Đặt cả sân thường và VIP')}</li><li>{t('Đặt trước tối đa')} 7 {t('ngày')}</li><li>{t('Thanh toán theo giá niêm yết')}</li></ul></article>{plans.map(p=><article key={p.id} className={'ct-plan '+(p.id==='club'?'ct-plan-featured':'')}><h2>{p.name}</h2><div className="ct-price">{money(p.price)}<span>/ {p.days} {t('ngày')}</span></div><ul><li>{t('Giảm tiền sân A/B')}: {p.discountPercent}%</li><li>{t('Giảm tiền sân VIP')}: {p.vipDiscountPercent??(p.id==='plus'?10:5)}%</li><li>{t('Đặt trước tối đa')} {p.advanceDays??(p.id==='plus'?21:14)} {t('ngày')}</li><li>{p.freeChanges??(p.id==='plus'?2:1)} {t('lượt đổi lịch có điều kiện')}</li></ul><Action disabled={busy} onClick={()=>join(p.id)}>{t('Chọn')} {p.name}</Action></article>)}</div><p className="gx-notice">{t('Ưu đãi chỉ áp dụng tiền sân trong thời hạn gói. Đổi lịch trước ít nhất 24 giờ, cùng loại sân/thời lượng và còn chỗ; chênh lệch giá vẫn cần thanh toán.')}</p><div className="gx-records">{data?.memberships?.map(m=><article key={m.id}><header><h3>{m.planName}</h3><State value={m.status}/></header><p>{m.startsAt&&new Date(m.startsAt).toLocaleDateString()} {m.endsAt&&' → '+new Date(m.endsAt).toLocaleDateString()}</p>{m.status==='PENDING'&&<div className="gx-actions"><Action onClick={()=>pay('MEMBERSHIP',m.id)}>{t('Thanh toán phí hội viên')}</Action><Action secondary onClick={async()=>{try{await api(`/membership/requests/${m.id}/cancel`,'POST',{requestId:requestId()});await refresh()}catch(e){notify(e.message)}}}>{t('Hủy yêu cầu')}</Action></div>}</article>)}</div></section>;
}

export function Profile(){
  const {t,user,data,refresh,notify}=useGuest();
  const row=data?.accounts?.[0];
  const [name,setName]=useState(user.name),[phone,setPhone]=useState(row?.phone||''),[old,setOld]=useState(''),[password,setPassword]=useState(''),[busy,setBusy]=useState(false);
  const submit=async(e,kind)=>{e.preventDefault();setBusy(true);try{if(kind==='profile')await api('/profile','PATCH',{name,phone});else{await api('/auth/password','POST',{currentPassword:old,newPassword:password});setOld('');setPassword('')}await refresh();notify(t('Đã lưu thông tin'))}catch(e){notify(e.message)}finally{setBusy(false)}};
  return <section className="ct-pad"><div className="gx-heading"><h1>{t('Hồ sơ của tôi')}</h1><p>{user.email}</p></div><div className="gx-split"><form className="gx-form" onSubmit={e=>submit(e,'profile')}><label>{t('Họ và tên')}<input required maxLength={100} value={name} onChange={e=>setName(e.target.value)}/></label><label>{t('Điện thoại')}<input type="tel" maxLength={30} value={phone} onChange={e=>setPhone(e.target.value)}/></label><Action type="submit" disabled={busy}>{t('Lưu hồ sơ')}</Action></form><form className="gx-form" onSubmit={e=>submit(e,'password')}><h3>{t('Đổi mật khẩu')}</h3><label>{t('Mật khẩu hiện tại')}<input type="password" required value={old} onChange={e=>setOld(e.target.value)} autoComplete="current-password"/></label><label>{t('Mật khẩu mới')}<input type="password" required minLength={8} maxLength={72} value={password} onChange={e=>setPassword(e.target.value)} autoComplete="new-password"/></label><p>{t('Từ 8 ký tự, tối đa 72 byte UTF-8.')}</p><Action type="submit" disabled={busy}>{t('Đổi mật khẩu')}</Action></form></div></section>;
}
