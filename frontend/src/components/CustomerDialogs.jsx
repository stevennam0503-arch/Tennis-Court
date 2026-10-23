import React from 'react';
import BookingFlow from './BookingFlow';
import {FinancialSummary,StaffLines} from './OrderSummary';
import OrderActions from './OrderActions';
import {OrderTimeline} from '../pages/CustomerHistory';
import {useCourtly} from '../context';
import {Modal,FormDialog,Button,Chip,Table} from './UI';
import {OrderActionDialog,InvoiceDialog} from './OrderDialogs';
import {money,labels,today} from '../utils/format';
export default function CustomerDialogs({dialog,onClose}){
 const {data,user,show,mutate,notify,navigate}=useCourtly(),p={...dialog,onClose};

 if(dialog.type==='cancel'||dialog.type==='move')return data.orders.some(o=>o.id===dialog.id)?<OrderActionDialog {...p}/>:null;
 if(dialog.type==='invoice')return data.orders.some(o=>o.id===dialog.id&&o.invoice)?<InvoiceDialog {...p}/>:null;
 if(dialog.type==='booking')return <BookingFlow {...p}/>;
 if(dialog.type==='order'){
  const o=data.orders.find(o=>o.id===dialog.id);if(!o)return null;
  const payments=data.payments.filter(p=>p.orderId===o.id),paymentIds=new Set(payments.map(p=>p.id)),refunds=data.refunds.filter(r=>paymentIds.has(r.paymentId));
  return <Modal title="Chi tiết đơn của tôi" onClose={onClose} wide footer={<><Button onClick={()=>{onClose();navigate('profile-orders');}}>Đơn của tôi</Button><Button onClick={onClose}>Đóng</Button>{o.invoice&&<Button className="primary" onClick={()=>show({type:'invoice',id:o.id})}>Xem phiếu thu</Button>}</>}><div className="detail-head"><div className="customer-order-top"><h2>{o.date}</h2><Chip status={o.status}/></div><small>{o.id}</small></div>{o.slots.map(s=><div className="order-line" key={s.id}><span>{data.courts.find(c=>c.id===s.court)?.name} · {s.hour}:00–{s.hour+1}:00</span><b>{money(s.price)}</b></div>)}{o.products.map(p=><div className="order-line" key={p.id}><span>{p.name} × {p.quantity}{p.type==='RENTAL'?` · ${p.hours} giờ`:''}</span><b>{money(p.lineTotal)}</b></div>)}<StaffLines order={o}/><FinancialSummary order={o}/><div className="summary-line total"><span>Tổng tiền</span><b>{money(o.total)}</b></div><div className="summary-line"><span>Đã thu, trừ hoàn</span><b>{money(o.paid)}</b></div><div className="summary-line"><span>{['CANCELLED','EXPIRED'].includes(o.status)?'Không thu thêm':'Còn phải thu'}</span><b>{money(['CANCELLED','EXPIRED'].includes(o.status)?0:Math.max(0,o.total-o.paid))}</b></div><h3 style={{margin:'20px 0 12px'}}>Lịch sử thanh toán</h3><Table headings={['Thời điểm','Nội dung','Số tiền']} empty={!payments.length&&!refunds.length}>{payments.map(p=><tr key={p.id}><td>{new Date(p.createdAt).toLocaleString('vi-VN')}</td><td>{labels[p.method]}</td><td>{money(p.amount)}</td></tr>)}{refunds.map(r=><tr key={r.id}><td>{new Date(r.createdAt).toLocaleString('vi-VN')}</td><td>Hoàn tiền</td><td>−{money(r.amount)}</td></tr>)}</Table>{o.total>o.paid&&['HOLDING','CONFIRMED','CHECKED_IN'].includes(o.status)&&<div className="notice" style={{marginTop:16}}>{data.club?.paymentInstructions||'Vui lòng liên hệ quầy để thanh toán. Chỉ quản trị viên được ghi nhận khoản thu hoặc hoàn tiền.'}</div>}<OrderActions order={o} details={false}/><details className="history-details"><summary>Lịch sử cập nhật đơn</summary><OrderTimeline order={o} courts={data.courts}/></details>{['CANCELLED','EXPIRED'].includes(o.status)&&o.paid>0&&<p className="notice">Đơn đã kết thúc, còn {money(o.paid)} đã thu sau hoàn. Liên hệ quầy để kiểm tra khoản hoàn theo chính sách.</p>}</Modal>;
 }
 if(dialog.type==='registration'){
  const t=data.tournaments.find(t=>t.id===dialog.id);if(!t)return null;
  return <FormDialog title={`Đăng ký · ${t.name}`} initial={{name:user.name,members:''}} fields={[{name:'name',label:t.format==='SINGLES'?'Tên thi đấu':'Tên đội',full:true},...(t.format!=='SINGLES'?[{name:'members',label:t.format==='DOUBLES'?'Tên đồng đội':'Thành viên bổ sung, mỗi dòng một người',type:'textarea',full:true}]:[])]} onClose={onClose} submitText="Xác nhận đăng ký" onSubmit={async v=>{await mutate(`/tournaments/${t.id}/registrations`,{accountId:user.accountId,name:v.name,members:t.format==='SINGLES'?[]:v.members.split('\n').map(x=>x.trim()).filter(Boolean)});notify('Đã đăng ký giải');show({type:'tournament',id:t.id});}}><div className="notice" style={{marginBottom:18}}>Người đăng ký: {user.name}. Phí tham gia: {money(t.fee)}. {t.fee>0?'Liên hệ quầy để thanh toán và xác nhận đăng ký.':''}</div></FormDialog>;
 }
 if(dialog.type==='tournament'){
  const t=data.tournaments.find(t=>t.id===dialog.id),r=data.registrations.find(r=>r.tournamentId===dialog.id);if(!t)return null;
  return <Modal title={t.name} onClose={onClose} footer={<><Button onClick={onClose}>Đóng</Button>{!r&&t.status==='OPEN'&&t.deadline>=today()&&<Button className="primary" onClick={()=>show({type:'registration',id:t.id})}>Đăng ký</Button>}</>}><div className="detail-head"><Chip status={t.status}/><h3 style={{marginTop:12}}>{labels[t.format]} · {t.location}</h3><p>{t.start} → {t.end}</p></div><div className="summary-line"><span>Phí đăng ký</span><b>{money(t.fee)}</b></div><div className="summary-line"><span>Hạn đăng ký</span><b>{t.deadline}</b></div><div className="summary-line"><span>Đã đăng ký</span><b>{t.registeredCount}/{t.max}</b></div>{r&&<><h3 style={{marginTop:20}}>Đăng ký của bạn</h3><p>{r.name}</p><Chip status={r.status}/><p className="subtitle" style={{marginTop:10}}>{r.members.join(' · ')}</p><div className="summary-line"><span>Đã thanh toán</span><b>{money(r.paid)}</b></div></>}</Modal>;
 }
 return null;
}
