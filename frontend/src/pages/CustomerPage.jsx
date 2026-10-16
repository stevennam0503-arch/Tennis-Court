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
 return <><Title subtitle="Theo dõi lịch, tiền cọc và trạng thái từng đơn của bạn." action={<Button className="primary" onClick={()=>navigate('calendar')}>Đặt sân mới</Button>}>Đơn của tôi</Title><Tabs value={tab} onChange={setTab} options={[["all","Tất cả"],["active","Đang hoạt động"],["finished","Đã kết thúc"]]}/><div className="customer-orders">{rows.map(o=><section className="customer-order" key={o.id}><div className="customer-order-top"><span className="meta">MÃ ĐƠN · {o.id.slice(0,8).toUpperCase()}</span><Chip status={o.status}/></div><h2>{o.date.split('-').reverse().join('/')}</h2><div className="booking-times">{o.slots.map(s=><span key={s.id}><Clock size={15}/>{data.courts.find(c=>c.id===s.court)?.name} · {s.hour}:00–{s.hour+1}:00</span>)}</div><div className="order-costs"><div><small>Tổng tiền</small><b>{money(o.total)}</b></div><div><small>Đã thu</small><b>{money(o.paid)}</b></div><div><small>{['CANCELLED','EXPIRED'].includes(o.status)?'Không thu thêm':'Còn lại'}</small><b>{money(['CANCELLED','EXPIRED'].includes(o.status)?0:Math.max(0,o.total-o.paid))}</b></div></div>{o.status==='HOLDING'&&<p className="notice">Giữ chỗ đến {new Date(o.holdUntil).toLocaleTimeString('vi-VN')}. Cọc cần thu: {money(o.deposit)}. Liên hệ quầy để thanh toán.</p>}<OrderActions order={o}/></section>)}</div>{!rows.length&&<div className="empty"><CalendarDays size={32}/><h3>Chưa có đơn trong mục này</h3><p>Chọn sân và khung giờ để tạo lịch chơi đầu tiên.</p></div>}</>;
}
function MyTournaments(){
 const {data,show}=useCourtly();
 return <><Title subtitle="Khám phá giải đấu và theo dõi đăng ký của bạn.">Giải đấu</Title><div className="grid-cards">{data.tournaments.map(t=>{const reg=data.registrations.find(r=>r.tournamentId===t.id),open=t.status==='OPEN'&&t.deadline>=today();return <section className="customer-order" key={t.id}><div className="customer-order-top"><Trophy size={25}/><Chip status={t.status}/></div><h2>{t.name}</h2><p className="subtitle">{labels[t.format]} · {t.location}</p><div className="detail-grid" style={{marginTop:22}}><div><span>Thời gian</span>{t.start} → {t.end}</div><div><span>Phí đăng ký</span>{money(t.fee)}</div><div><span>Hạn đăng ký</span>{t.deadline}</div><div><span>Đã đăng ký</span>{t.registeredCount}/{t.max}</div></div>{reg?<div className="notice"><b>Đăng ký của bạn: {reg.name}</b><div style={{marginTop:8}}><Chip status={reg.status}/></div><p className="subtitle">Đã thu {money(reg.paid)} / {money(t.fee)}</p></div>:<p className="subtitle">{open?'Sẵn sàng tham gia cùng câu lạc bộ?':'Giải chưa mở hoặc đã đóng đăng ký.'}</p>}<div className="step-row"><Button className="sm" onClick={()=>show({type:'tournament',id:t.id})}>Chi tiết</Button>{!reg&&open&&<Button className="primary sm" onClick={()=>show({type:'registration',id:t.id})}>Đăng ký tham gia</Button>}</div></section>;})}</div>{!data.tournaments.length&&<div className="empty">Chưa có giải đấu được công bố.</div>}</>;
}
