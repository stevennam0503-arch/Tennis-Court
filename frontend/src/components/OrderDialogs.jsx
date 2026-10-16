import React,{useRef} from 'react';
import BookingFlow from './BookingFlow';
import MoveDialog from './MoveDialog';
import {FinancialSummary,StaffLines,PolicyNotice} from './OrderSummary';
import OrderActions from './OrderActions';
import {OrderTimeline} from '../pages/CustomerHistory';
import { useCourtly } from '../context';
import { Modal, FormDialog, Button, Chip, Table } from './UI';
import { api } from '../services/api';
import { money, active, options } from '../utils/format';

async function resolveSlots(values) {
  await api('/schedules/generate','POST',{date:values.date});
  const snapshot=await api(`/overview?date=${values.date}`);
  const ids=Array.from({length:values.hours},(_,i)=>snapshot.schedules.find(s=>s.court===values.court&&s.hour===Number(values.start)+i)?.id);
  if(ids.some(x=>!x)) throw new Error('Khoảng giờ phải nằm trong 06:00–23:00.');
  return ids;
}
export {resolveSlots};

export const BookingDialog=BookingFlow;
export function OrderDetail({id,onClose}) {
  const {data,show,mutate,notify}=useCourtly();
  const o=data.orders.find(x=>x.id===id);
  if(!o) return null;
  const doAction=async (op,body={})=>{try{await mutate(`/orders/${id}/${op}`,body);notify('Đã cập nhật đơn');}catch(e){notify(e.message);}};
  return <Modal title="Chi tiết đơn đặt sân" onClose={onClose} wide footer={<>{o.status==='CONFIRMED'&&<Button className="primary" onClick={()=>show({type:'check-in',id})}>Check-in</Button>}{o.status==='CHECKED_IN'&&<Button className="primary" onClick={()=>doAction('check-out')}>Check-out</Button>}{active(o)&&o.paid<o.total&&<Button className="lime" onClick={()=>show({type:'payment',id})}>Thu tiền</Button>}</>}>
    <div className="detail-head"><div style={{display:'flex',justifyContent:'space-between'}}><h2>{o.name}</h2><Chip status={o.status}/></div><small>{o.id} · {o.phone}</small></div>
    <div className="detail-grid"><div><span>Ngày sử dụng</span>{o.date}</div><div><span>Khách hàng</span>{o.accountId?'Đã có tài khoản':'Khách lẻ tại quầy'}</div>{o.status==='HOLDING'&&<><div><span>Hạn giữ chỗ</span>{new Date(o.holdUntil).toLocaleTimeString('vi-VN')}</div><div><span>Cọc yêu cầu</span>{money(o.deposit)}</div></>}{o.checkInAt&&<div><span>Check-in</span>{new Date(o.checkInAt).toLocaleString('vi-VN')}</div>}{o.checkOutAt&&<div><span>Check-out</span>{new Date(o.checkOutAt).toLocaleString('vi-VN')}</div>}</div>
    <h3>Khung giờ sân</h3>{o.slots.map(s=><div className="order-line" key={s.id}><span>{data.courts.find(c=>c.id===s.court)?.name} · {s.hour}:00–{s.hour+1}:00</span><b>{money(s.price)}</b></div>)}
    <h3 style={{marginTop:20}}>Hàng bán & thiết bị thuê</h3>{o.products.length?o.products.map(p=><div className="order-line" key={p.id}><div>{p.name} × {p.quantity}{p.type==='RENTAL'&&<small> · {p.hours} giờ · {p.condition==='DAMAGED'?'Hỏng, đang cách ly':p.condition==='MISSING'?'Thiếu / chưa trả':p.returned?'Đã trả':'Chưa trả'}</small>}</div><div>{money(p.lineTotal??p.price*p.quantity*(p.type==='RENTAL'?p.hours:1))}{p.type==='RENTAL'&&(!p.returned||['DAMAGED','MISSING'].includes(p.condition))&&<Button className="sm" onClick={()=>show({type:'equipment-return',id,lineId:p.id})}>Nhận / xử lý</Button>}</div></div>):<p className="subtitle">Chưa có sản phẩm</p>}
    <h3 style={{marginTop:20}}>Nhân sự</h3><StaffLines order={o}/><FinancialSummary order={o}/>
    <div style={{marginTop:20}}><div className="summary-line total"><span>Tổng tiền</span><b>{money(o.total)}</b></div><div className="summary-line"><span>Đã thu (trừ hoàn)</span><b>{money(o.paid)}</b></div><div className="summary-line"><span>{['CANCELLED','EXPIRED'].includes(o.status)?'Không thu thêm':'Còn phải thu'}</span><b>{money(['CANCELLED','EXPIRED'].includes(o.status)?0:Math.max(0,o.total-o.paid))}</b></div></div>
    <div className="step-row no-print">{active(o)&&<><Button className="sm" onClick={()=>show({type:'add-product',id})}>Thêm sản phẩm</Button><Button className="sm" onClick={()=>show({type:'assign-staff',id})}>Thuê nhân sự</Button></>}{!['HOLDING','CANCELLED','EXPIRED'].includes(o.status)&&<Button className="sm" onClick={async()=>{await doAction('invoice');show({type:'invoice',id});}}>In phiếu thu</Button>}</div>
    <OrderActions order={o} details={false}/><div className="step-row"><Button className="sm" onClick={()=>show({type:'financial-review',id})}>Đối chiếu / khoản cần hoàn</Button>{['EXPIRED','CANCELLED'].includes(o.status)&&<><Button className="sm" onClick={()=>show({type:'restore',id})}>Kiểm tra khôi phục / đổi lịch</Button><Button className="sm" onClick={()=>show({type:'payment',id})}>Ghi tiền đến muộn</Button></>}</div>
    <details className="history-details"><summary>Lịch sử cập nhật đơn</summary><OrderTimeline order={o} courts={data.courts}/></details>
  </Modal>;
}
export function OrderActionDialog({type,id,onClose}) {
  const {data,mutate,notify,show,isAdmin}=useCourtly();
  const requestId=useRef(crypto.randomUUID());
  const order=data.orders.find(o=>o.id===id);
  const done=()=>{notify('Đã cập nhật đơn');show({type:'order',id});};
  if(type==='cancel') return <FormDialog title="Hủy đơn đặt sân" fields={isAdmin?[{name:'reason',label:'Lý do hủy',full:true}]:[]} onClose={onClose} submitText="Xác nhận hủy" onSubmit={async v=>{await mutate(`/orders/${id}/cancel`,{...v,requestId:requestId.current});done();}}><PolicyNotice/><p>Hủy đơn của <b>{order.name}</b> và nhả {order.slots.length} khung giờ?</p><div className="notice" style={{marginTop:16}}>Đã thu {money(order.paid)}. Hủy sẽ nhả sân, trọng tài và thiết bị chưa giao; thiết bị đã giao vẫn phải nhận trả. Đơn và giao dịch vẫn được lưu trong lịch sử; tiền không tự hoàn về ngân hàng, cần quầy xử lý riêng.</div></FormDialog>;
  if(type==='add-product') return <FormDialog title="Thêm sản phẩm vào đơn" initial={{productId:data.products[0]?.id,quantity:1,hours:1}} fields={[{name:'productId',label:'Sản phẩm',full:true,options:data.products.filter(p=>p.status==='ACTIVE').map(p=>({value:p.id,label:`${p.name} · ${money(p.price)}${p.type==='RENTAL'?'/giờ':''}`}))},{name:'quantity',label:'Số lượng',type:'number',min:1,max:999},{name:'hours',label:'Số giờ (đồ thuê)',type:'number',min:1,max:17}]} onClose={onClose} onSubmit={async v=>{await mutate(`/orders/${id}/products`,{...v,type:data.products.find(p=>p.id===v.productId)?.type});done();}}/>;
  if(type==='assign-staff')return <MoveDialog id={id} mode="assign" onClose={onClose}/>;
  if(type==='move')return <MoveDialog id={id} onClose={onClose}/>;
  return null;
}
export function PaymentDialog({id,registrationId,onClose}) {
  const {data,mutate,notify}=useCourtly();
  const orders=data.orders.filter(o=>(active(o)||o.status==='COMPLETED'||o.id===id)&&o.paid<o.total);
  const order=data.orders.find(o=>o.id===id)||orders[0];
  const reg=data.registrations.find(r=>r.id===registrationId);
  const due=reg?data.tournaments.find(t=>t.id===reg.tournamentId).fee-reg.paid:order?order.total-order.paid:0;
  return <FormDialog title="Ghi nhận khoản thu" submitText="Xác nhận đã thu" initial={{orderId:reg?null:order?.id,amount:due,method:'CASH',transactionCode:crypto.randomUUID()}} fields={[...(!reg?[{name:'orderId',label:'Đơn đặt sân',full:true,options:orders.map(o=>({value:o.id,label:`${o.name} · còn ${money(o.total-o.paid)}`}))}]:[]),{name:'amount',label:'Số tiền (₫)',type:'number',min:1},{name:'method',label:'Phương thức',options:options(['CASH','BANK_TRANSFER'])},{name:'reason',label:'Lý do (bắt buộc với tiền đến muộn)',required:false,full:true}]} onChange={(v,name)=>{const o=data.orders.find(o=>o.id===v.orderId);return name==='orderId'&&o?{...v,amount:o.total-o.paid}:v;}} onClose={onClose} onSubmit={async v=>{await mutate('/payments',{...v,orderId:reg?null:v.orderId,registrationId:registrationId||null});notify('Đã ghi nhận khoản thu');onClose();}}>
    {reg&&<div className="notice" style={{marginBottom:15}}>Phí giải · {reg.name} · còn {money(due)}</div>}<div className="notice warn" style={{marginBottom:18}}>Xác nhận đã nhận tiền trước khi ghi khoản thu. QR và ngân hàng chưa kết nối tự động.</div>
  </FormDialog>;
}
export function RefundDialog({id,onClose}) {
  const {data,mutate,notify}=useCourtly();const p=data.payments.find(p=>p.id===id);
  return <FormDialog title="Ghi nhận hoàn tiền" submitText="Xác nhận đã hoàn" initial={{amount:p.refundable,reason:'',requestId:crypto.randomUUID()}} fields={[{name:'amount',label:'Số tiền hoàn (₫)',type:'number',min:1,max:p.refundable,full:true},{name:'reason',label:'Lý do hoàn',full:true}]} onClose={onClose} onSubmit={async v=>{await mutate(`/payments/${id}/refunds`,v);notify('Đã ghi nhận khoản hoàn');onClose();}}><div className="notice" style={{marginBottom:18}}>Có thể hoàn tối đa <b>{money(p.refundable)}</b>.</div></FormDialog>;
}
export function InvoiceDialog({id,onClose}) {
  const {data}=useCourtly();const current=data.orders.find(x=>x.id===id);const o=current.invoiceSnapshot||current;
  return <Modal title={`PHIẾU THU · ${o.invoice||''}`} onClose={onClose} wide footer={<><Button onClick={onClose}>Đóng</Button><Button className="primary" onClick={()=>window.print()}>In / Lưu PDF</Button></>}><h2>COURTLY TENNIS CLUB</h2><p className="subtitle">Ngày phát hành: {o.issuedAt?new Date(o.issuedAt).toLocaleString('vi-VN'):''}</p><div className="detail-head" style={{marginTop:20}}>Khách hàng: {o.name}<br/>Điện thoại: {o.phone}<br/>Ngày sử dụng: {o.date}</div><Table headings={['Dịch vụ','Thành tiền']}>{o.slots.map(s=><tr key={s.id}><td>{data.courts.find(c=>c.id===s.court)?.name} · {s.hour}:00–{s.hour+1}:00</td><td>{money(s.price)}</td></tr>)}{o.products.map(p=><tr key={p.id}><td>{p.name} × {p.quantity}{p.type==='RENTAL'?` · ${p.hours} giờ`:''}</td><td>{money(p.lineTotal??p.price*p.quantity*(p.type==='RENTAL'?p.hours:1))}</td></tr>)}{o.staff.map(s=><tr key={s.id}><td>{s.name} · {s.hours} giờ</td><td>{money(s.rate*s.hours)}</td></tr>)}</Table>{o.membershipBenefit?.discount>0&&<div className="summary-line membership-discount"><span>Ưu đãi {o.membershipBenefit.planName}</span><b>−{money(o.membershipBenefit.discount)}</b></div>}<div className="summary-line total"><span>Tổng tiền</span><b>{money(o.total)}</b></div><div className="summary-line"><span>Đã thu</span><b>{money(o.paid)}</b></div><div className="summary-line"><span>{['CANCELLED','EXPIRED'].includes(o.status)?'Không thu thêm':'Còn phải thu'}</span><b>{money(['CANCELLED','EXPIRED'].includes(o.status)?0:Math.max(0,o.total-o.paid))}</b></div><p className="subtitle">Phiếu thu nội bộ · chưa tích hợp hóa đơn điện tử thuế.</p></Modal>;
}
