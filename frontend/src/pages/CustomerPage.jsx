import React,{useState,useEffect} from 'react';
import {CalendarDays,Clock,Trophy,ArrowRight,CheckCircle2} from 'lucide-react';
import {MyHistory,MyPayments,MyServices} from './CustomerHistory';
import OrderActions from '../components/OrderActions';
import BookingPicker from '../components/BookingPicker';
import {useCourtly} from '../context';
import {Title,Panel,Button,Chip,Tabs} from '../components/UI';
import {money,today,labels} from '../utils/format';
export default function CustomerPage({route}){
 if(route==='orders')return <MyOrders/>;
 if(route==='history')return <MyHistory/>;
 if(route==='payments')return <MyPayments/>;
 if(route==='services')return <MyServices/>;
 if(route==='tournaments')return <MyTournaments/>;
 return <BookCourt/>;
}
function BookCourt(){
 const {data,user,date,setDate,show}=useCourtly();
 return <><Title subtitle={`Chào ${user.name}. Chọn ngày, sân và giờ để bắt đầu.`}>Đặt sân</Title><BookingPicker data={data} date={date} setDate={setDate} onBook={show}/></>;
}
export function MyOrders(){
 const {data,show,navigate}=useCourtly();const [tab,setTab]=useState('active');
 const rows=data.orders.filter(o=>tab==='all'||(tab==='active'?(['HOLDING','CONFIRMED','CHECKED_IN'].includes(o.status)||o.finance?.review||o.status==='COMPLETED'&&o.paid<o.total):['COMPLETED','CANCELLED','EXPIRED'].includes(o.status)));
 return <><Title subtitle="Theo dõi lịch, tiền cọc và trạng thái từng đơn của bạn." action={<Button className="primary" onClick={()=>navigate('calendar')}>Đặt sân mới</Button>}>Đơn của tôi</Title><Tabs value={tab} onChange={setTab} options={[["all","Tất cả"],["active","Đang hoạt động"],["finished","Đã kết thúc"]]}/><div className="customer-orders">{rows.map(o=><section className="customer-order" key={o.id}><div className="customer-order-top"><span className="meta">MÃ ĐƠN · {o.id.slice(0,8).toUpperCase()}</span><Chip status={o.status}/></div><h2>{o.date.split('-').reverse().join('/')}</h2><div className="booking-times">{o.slots.map(s=><span key={s.id}><Clock size={15}/>{data.courts.find(c=>c.id===s.court)?.name} · {s.hour}:00–{s.hour+1}:00</span>)}</div><div className="order-costs">
  <div><small>Tổng tiền</small><b>{money(o.total)}</b></div>
  <div><small>Đã thu</small><b>{money(o.paid)}</b></div>
  <div><small>{['CANCELLED','EXPIRED'].includes(o.status)?'Không thu thêm':'Còn lại'}</small><b>{money(['CANCELLED','EXPIRED'].includes(o.status)?0:Math.max(0,o.total-o.paid))}</b></div>
</div>
{o.totalExtensionMinutes > 0 && (
  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '3px 8px', borderRadius: 6, background: '#dbeafe', color: '#1e40af', fontSize: 12, fontWeight: 700, margin: '6px 0' }}>
    ⚡ Đã gia hạn +{o.totalExtensionMinutes} phút chơi
  </div>
)}
{['CANCELLED','EXPIRED'].includes(o.status) && (
  (() => {
    const settlement = o.cancellationSettlement || o.metadata?.cancellationSettlement;
    const refunded = o.finance?.refunded || 0;
    const refundPending = o.finance?.refundPending || (settlement ? settlement.refundAmount : 0);
    const policyDesc = settlement?.policyDescription || (
      settlement?.hoursBeforePlay !== undefined && settlement?.hoursBeforePlay !== null
        ? (settlement.hoursBeforePlay >= 24 ? 'Hủy trước > 24h: Hoàn 100% cọc' : settlement.hoursBeforePlay >= 12 ? 'Hủy 12h - 24h: Hoàn 50% cọc' : 'Hủy cận giờ < 12h: Giữ 100% cọc')
        : 'Chính sách hoàn cọc'
    );
    const retained = settlement?.retainedAmount || 0;
    return (
      <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: '10px 12px', margin: '10px 0', fontSize: 12.5 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4, flexWrap: 'wrap', gap: 4 }}>
          <strong style={{ color: '#1e40af' }}>⚖️ {policyDesc}</strong>
          <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 6px', borderRadius: 4, background: refunded > 0 ? '#dcfce7' : (refundPending > 0 ? '#fef3c7' : '#f1f5f9'), color: refunded > 0 ? '#166534' : (refundPending > 0 ? '#b45309' : '#64748b') }}>
            {refunded > 0 ? '✓ Đã hoàn tiền' : (refundPending > 0 ? '⏳ Chờ CLB hoàn tiền' : 'Giữ cọc')}
          </span>
        </div>
        {o.paid > 0 && (
          <div style={{ display: 'flex', gap: 14, color: '#475569', fontSize: 12, marginTop: 4, flexWrap: 'wrap' }}>
            <span>Đã thu: <b>{money(o.paid)}</b></span>
            {refunded > 0 ? (
              <span style={{ color: '#166534' }}>Đã hoàn: <b>{money(refunded)}</b></span>
            ) : (
              <span style={{ color: refundPending > 0 ? '#d97706' : '#64748b' }}>Được hoàn: <b>{money(refundPending)}</b></span>
            )}
            {retained > 0 && <span style={{ color: '#b91c1c' }}>Khấu trừ: <b>{money(retained)}</b></span>}
          </div>
        )}
      </div>
    );
  })()
)}
{o.status==='HOLDING'&&<p className="notice">Giữ chỗ đến {new Date(o.holdUntil).toLocaleTimeString('vi-VN')}. Cọc cần thu: {money(o.deposit)}. Liên hệ quầy để thanh toán.</p>}
<OrderActions order={o}/></section>)}</div>{!rows.length&&<div className="empty"><CalendarDays size={32}/><h3>Chưa có đơn trong mục này</h3><p>Chọn sân và khung giờ để tạo lịch chơi đầu tiên.</p></div>}</>;
}
function MyTournaments(){
 const {data,show}=useCourtly();
 return <><Title subtitle="Khám phá giải đấu và theo dõi đăng ký của bạn.">Giải đấu</Title><div className="grid-cards">{data.tournaments.map(t=>{const reg=data.registrations.find(r=>r.tournamentId===t.id),open=t.status==='OPEN'&&t.deadline>=today();return <section className="customer-order" key={t.id}><div className="customer-order-top"><Trophy size={25}/><Chip status={t.status}/></div><h2>{t.name}</h2><p className="subtitle">{labels[t.format]} · {t.location}</p><div className="detail-grid" style={{marginTop:22}}><div><span>Thời gian</span>{t.start} → {t.end}</div><div><span>Phí đăng ký</span>{money(t.fee)}</div><div><span>Hạn đăng ký</span>{t.deadline}</div><div><span>Đã đăng ký</span>{t.registeredCount}/{t.max}</div></div>{reg?<div className="notice"><b>Đăng ký của bạn: {reg.name}</b><div style={{marginTop:8}}><Chip status={reg.status}/></div><p className="subtitle">Đã thu {money(reg.paid)} / {money(t.fee)}</p></div>:<p className="subtitle">{open?'Sẵn sàng tham gia cùng câu lạc bộ?':'Giải chưa mở hoặc đã đóng đăng ký.'}</p>}<div className="step-row"><Button className="sm" onClick={()=>show({type:'tournament',id:t.id})}>Chi tiết</Button>{!reg&&open&&<Button className="primary sm" onClick={()=>show({type:'registration',id:t.id})}>Đăng ký tham gia</Button>}</div></section>;})}</div>{!data.tournaments.length&&<div className="empty">Chưa có giải đấu được công bố.</div>}</>;
}
