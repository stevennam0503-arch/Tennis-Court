import React from 'react';
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

export function BookingDialog({scheduleIds,onCreated,onClose}) {
  const {data,date,mutate,notify,show}=useCourtly();
  const selected=data.schedules.filter(s=>scheduleIds.includes(s.id));
  const total=selected.reduce((a,s)=>a+s.price,0);
  return <FormDialog title="Tạo đơn đặt sân" initial={{accountId:'',name:'',phone:''}} fields={[
    {name:'accountId',label:'Khách hàng',full:true,required:false,options:[{value:'',label:'Khách lẻ tại quầy'},...data.accounts.filter(a=>a.status==='ACTIVE'&&a.role==='CUSTOMER').map(a=>({value:a.id,label:a.name}))]},
    {name:'name',label:'Họ tên khách'}, {name:'phone',label:'Số điện thoại',type:'tel'},
  ]} onChange={(values,name)=>{const a=data.accounts.find(a=>a.id===values.accountId);return name==='accountId'&&a?{...values,name:a.name,phone:a.phone}:values;}} onClose={onClose} submitText="Giữ chỗ & tạo đơn" onSubmit={async values=>{
    const result=await mutate('/orders',{...values,accountId:values.accountId||null,scheduleIds});
    onCreated?.();notify('Đã giữ chỗ');show({type:'order',id:result.id});
  }}><div className="notice" style={{marginBottom:18}}>{date}<br/>{selected.map(s=><div key={s.id}>{data.courts.find(c=>c.id===s.court)?.name} · {s.hour}:00–{s.hour+1}:00</div>)}<div className="summary-line total"><span>Tổng tiền</span><b>{money(total)}</b></div><small>Cọc {data.settings.depositPercent}% · giữ chỗ {data.settings.holdMinutes} phút</small></div></FormDialog>;
}
export function OrderDetail({id,onClose}) {
  const {data,show,mutate,notify}=useCourtly();
  const o=data.orders.find(x=>x.id===id);
  if(!o) return null;
  const doAction=async op=>{try{await mutate(`/orders/${id}/${op}`);notify('Đã cập nhật đơn');}catch(e){notify(e.message);}};
  return <Modal title="Chi tiết đơn đặt sân" onClose={onClose} wide footer={<>{o.status==='CONFIRMED'&&<Button className="primary" onClick={()=>doAction('check-in')}>Check-in</Button>}{o.status==='CHECKED_IN'&&<Button className="primary" onClick={()=>doAction('check-out')}>Check-out</Button>}{active(o)&&o.paid<o.total&&<Button className="lime" onClick={()=>show({type:'payment',id})}>Thu tiền</Button>}{active(o)&&<Button className="danger" onClick={()=>show({type:'cancel',id})}>Hủy đơn</Button>}</>}>
    <div className="detail-head"><div style={{display:'flex',justifyContent:'space-between'}}><h2>{o.name}</h2><Chip status={o.status}/></div><small>{o.id} · {o.phone}</small></div>
    <div className="detail-grid"><div><span>Ngày sử dụng</span>{o.date}</div><div><span>Khách hàng</span>{o.accountId?'Đã có tài khoản':'Khách lẻ tại quầy'}</div>{o.status==='HOLDING'&&<><div><span>Hạn giữ chỗ</span>{new Date(o.holdUntil).toLocaleTimeString('vi-VN')}</div><div><span>Cọc yêu cầu</span>{money(o.deposit)}</div></>}{o.checkInAt&&<div><span>Check-in</span>{new Date(o.checkInAt).toLocaleString('vi-VN')}</div>}{o.checkOutAt&&<div><span>Check-out</span>{new Date(o.checkOutAt).toLocaleString('vi-VN')}</div>}</div>
    <h3>Khung giờ sân</h3>{o.slots.map(s=><div className="order-line" key={s.id}><span>{data.courts.find(c=>c.id===s.court)?.name} · {s.hour}:00–{s.hour+1}:00</span><b>{money(s.price)}</b></div>)}
    <h3 style={{marginTop:20}}>Hàng bán & thiết bị thuê</h3>{o.products.length?o.products.map(p=><div className="order-line" key={p.id}><div>{p.name} × {p.quantity}{p.type==='RENTAL'&&<small> · {p.hours} giờ · {p.returned?'Đã trả':'Chưa trả'}</small>}</div><div>{money(p.lineTotal)}{p.type==='RENTAL'&&!p.returned&&<Button className="sm" onClick={()=>doAction(`products/${p.id}/return`)}>Đã trả</Button>}</div></div>):<p className="subtitle">Chưa có sản phẩm</p>}
    <h3 style={{marginTop:20}}>Nhân sự</h3>{o.staff.length?o.staff.map(s=><div className="order-line" key={s.id}><span>{s.name} · {s.hours} giờ</span><b>{money(s.rate*s.hours)}</b></div>):<p className="subtitle">Chưa phân công</p>}
    <div style={{marginTop:20}}><div className="summary-line total"><span>Tổng tiền</span><b>{money(o.total)}</b></div><div className="summary-line"><span>Đã thu (trừ hoàn)</span><b>{money(o.paid)}</b></div><div className="summary-line"><span>Còn phải thu</span><b>{money(o.total-o.paid)}</b></div></div>
    <div className="step-row no-print">{active(o)&&<><Button className="sm" onClick={()=>show({type:'add-product',id})}>Thêm sản phẩm</Button><Button className="sm" onClick={()=>show({type:'assign-staff',id})}>Thuê nhân sự</Button><Button className="sm" onClick={()=>show({type:'move',id})}>Đổi lịch</Button></>}{!['HOLDING','CANCELLED','EXPIRED'].includes(o.status)&&<Button className="sm" onClick={async()=>{await doAction('invoice');show({type:'invoice',id});}}>In phiếu thu</Button>}</div>
  </Modal>;
}
export function OrderActionDialog({type,id,onClose}) {
  const {data,mutate,notify,show}=useCourtly();
  const order=data.orders.find(o=>o.id===id);
  const done=()=>{notify('Đã cập nhật đơn');show({type:'order',id});};
  if(type==='cancel') return <FormDialog title="Hủy đơn đặt sân" fields={[]} onClose={onClose} submitText="Xác nhận hủy" onSubmit={async()=>{await mutate(`/orders/${id}/cancel`);done();}}><p>Hủy đơn của <b>{order.name}</b> và nhả {order.slots.length} khung giờ?</p><div className="notice" style={{marginTop:16}}>Đã thu {money(order.paid)}. Khoản hoàn được ghi riêng trong lịch sử giao dịch.</div></FormDialog>;
  if(type==='add-product') return <FormDialog title="Thêm sản phẩm vào đơn" initial={{productId:data.products[0]?.id,quantity:1,hours:1}} fields={[{name:'productId',label:'Sản phẩm',full:true,options:data.products.filter(p=>p.status==='ACTIVE').map(p=>({value:p.id,label:`${p.name} · ${money(p.price)}${p.type==='RENTAL'?'/giờ':''}`}))},{name:'quantity',label:'Số lượng',type:'number',min:1,max:999},{name:'hours',label:'Số giờ (đồ thuê)',type:'number',min:1,max:17}]} onClose={onClose} onSubmit={async v=>{await mutate(`/orders/${id}/products`,{...v,type:data.products.find(p=>p.id===v.productId)?.type});done();}}/>;
  if(type==='assign-staff') return <FormDialog title="Phân công nhân sự" initial={{staffId:data.staff.find(s=>s.status==='ACTIVE')?.id}} fields={[{name:'staffId',label:'Nhân sự',full:true,options:data.staff.filter(s=>s.status==='ACTIVE').map(s=>({value:s.id,label:`${s.name} · ${money(s.rate)}/giờ`}))}]} onClose={onClose} onSubmit={async v=>{await mutate(`/orders/${id}/staff`,v);done();}}><div className="notice" style={{marginBottom:18}}>Nhân sự cần có lịch làm việc bao phủ các giờ đặt sân.</div></FormDialog>;
  if(type==='move') return <FormDialog title="Đổi lịch đặt sân" initial={{date:order.date,court:order.slots[0]?.court,start:order.slots[0]?.hour,hours:order.slots.length}} fields={[{name:'date',label:'Ngày mới',type:'date'},{name:'court',label:'Sân',options:data.courts.filter(c=>c.status==='ACTIVE').map(c=>({value:c.id,label:c.name}))},{name:'start',label:'Giờ bắt đầu',type:'number',min:6,max:22},{name:'hours',label:'Số giờ liên tiếp',type:'number',min:1,max:17}]} onClose={onClose} onSubmit={async v=>{const scheduleIds=await resolveSlots(v);await mutate(`/orders/${id}/schedule`,{scheduleIds},'PATCH');done();}}><div className="notice" style={{marginBottom:18}}>Đổi toàn bộ lịch của đơn. Áp dụng cho đơn chưa gắn nhân sự hoặc thiết bị đang thuê.</div></FormDialog>;
  return null;
}
export function PaymentDialog({id,registrationId,onClose}) {
  const {data,mutate,notify}=useCourtly();
  const orders=data.orders.filter(o=>active(o)&&o.paid<o.total);
  const order=data.orders.find(o=>o.id===id)||orders[0];
  const reg=data.registrations.find(r=>r.id===registrationId);
  const due=reg?data.tournaments.find(t=>t.id===reg.tournamentId).fee-reg.paid:order?order.total-order.paid:0;
  return <FormDialog title="Ghi nhận khoản thu" submitText="Xác nhận đã thu" initial={{orderId:reg?null:order?.id,amount:due,method:'CASH',transactionCode:crypto.randomUUID()}} fields={[...(!reg?[{name:'orderId',label:'Đơn đặt sân',full:true,options:orders.map(o=>({value:o.id,label:`${o.name} · còn ${money(o.total-o.paid)}`}))}]:[]),{name:'amount',label:'Số tiền (₫)',type:'number',min:1},{name:'method',label:'Phương thức',options:options(['CASH','BANK_TRANSFER'])}]} onChange={(v,name)=>{const o=data.orders.find(o=>o.id===v.orderId);return name==='orderId'&&o?{...v,amount:o.total-o.paid}:v;}} onClose={onClose} onSubmit={async v=>{await mutate('/payments',{...v,orderId:reg?null:v.orderId,registrationId:registrationId||null});notify('Đã ghi nhận khoản thu');onClose();}}>
    {reg&&<div className="notice" style={{marginBottom:15}}>Phí giải · {reg.name} · còn {money(due)}</div>}<div className="notice warn" style={{marginBottom:18}}>Xác nhận đã nhận tiền trước khi ghi khoản thu. QR và ngân hàng chưa kết nối tự động.</div>
  </FormDialog>;
}
export function RefundDialog({id,onClose}) {
  const {data,mutate,notify}=useCourtly();const p=data.payments.find(p=>p.id===id);
  return <FormDialog title="Ghi nhận hoàn tiền" submitText="Xác nhận đã hoàn" initial={{amount:p.refundable,reason:''}} fields={[{name:'amount',label:'Số tiền hoàn (₫)',type:'number',min:1,max:p.refundable,full:true},{name:'reason',label:'Lý do hoàn',full:true}]} onClose={onClose} onSubmit={async v=>{await mutate(`/payments/${id}/refunds`,v);notify('Đã ghi nhận khoản hoàn');onClose();}}><div className="notice" style={{marginBottom:18}}>Có thể hoàn tối đa <b>{money(p.refundable)}</b>.</div></FormDialog>;
}
export function InvoiceDialog({id,onClose}) {
  const {data}=useCourtly();const o=data.orders.find(x=>x.id===id);
  return <Modal title={`PHIẾU THU · ${o.invoice||''}`} onClose={onClose} wide footer={<><Button onClick={onClose}>Đóng</Button><Button className="primary" onClick={()=>window.print()}>In / Lưu PDF</Button></>}><h2>COURTLY TENNIS CLUB</h2><p className="subtitle">Ngày phát hành: {o.issuedAt?new Date(o.issuedAt).toLocaleString('vi-VN'):''}</p><div className="detail-head" style={{marginTop:20}}>Khách hàng: {o.name}<br/>Điện thoại: {o.phone}<br/>Ngày sử dụng: {o.date}</div><Table headings={['Dịch vụ','Thành tiền']}>{o.slots.map(s=><tr key={s.id}><td>{data.courts.find(c=>c.id===s.court)?.name} · {s.hour}:00–{s.hour+1}:00</td><td>{money(s.price)}</td></tr>)}{o.products.map(p=><tr key={p.id}><td>{p.name} × {p.quantity}{p.type==='RENTAL'?` · ${p.hours} giờ`:''}</td><td>{money(p.lineTotal)}</td></tr>)}{o.staff.map(s=><tr key={s.id}><td>{s.name} · {s.hours} giờ</td><td>{money(s.rate*s.hours)}</td></tr>)}</Table><div className="summary-line total"><span>Tổng tiền</span><b>{money(o.total)}</b></div><div className="summary-line"><span>Đã thu</span><b>{money(o.paid)}</b></div><div className="summary-line"><span>Còn phải thu</span><b>{money(o.total-o.paid)}</b></div><p className="subtitle">Phiếu thu nội bộ · chưa tích hợp hóa đơn điện tử thuế.</p></Modal>;
}
