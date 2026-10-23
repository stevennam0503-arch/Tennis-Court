import {slotLabel,slotHours,hourLabel} from '../utils/format';
import React,{useRef,useState} from 'react';
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
  const start=Number(values.start),end=start+Number(values.hours);
  const rows=snapshot.schedules.filter(s=>s.court===values.court&&s.hour>=start&&s.hour+slotHours(s)<=end).sort((a,b)=>a.hour-b.hour);
  if(!rows.length||rows[0].hour!==start||rows.reduce((n,s)=>n+slotHours(s),0)!==Number(values.hours)) throw new Error('Khoảng giờ phải liên tục và nằm trong 06:00–23:00.');
  return rows.map(s=>s.id);
}
export {resolveSlots};

export const BookingDialog=BookingFlow;
export function OrderDetail({id,onClose}) {
  const {data,show,mutate,notify}=useCourtly();
  const o=data.orders.find(x=>x.id===id);
  if(!o) return null;
  const doAction=async (op,body={})=>{try{await mutate(`/orders/${id}/${op}`,body);notify('Đã cập nhật đơn');}catch(e){notify(e.message);}};
  return <Modal title="Chi tiết đơn đặt sân" onClose={onClose} wide footer={<>{o.status==='CONFIRMED'&&<Button className="primary" onClick={()=>show({type:'check-in',id})}>Check-in</Button>}{o.status==='CHECKED_IN'&&<Button className="primary" onClick={()=>doAction('check-out')}>Check-out</Button>}{active(o)&&o.paid<o.total&&<Button className="lime" onClick={()=>show({type:'payment',id})}>Thu tiền</Button>}</>}>
    <div className="detail-head"><div style={{display:'flex',justifyContent:'space-between'}}><h2>{o.name}</h2><Chip status={o.status}/></div><small>{o.id} • {o.phone}</small></div>
    <div className="detail-grid"><div><span>Ngày sử dụng</span>{o.date}</div><div><span>Khách hàng</span>{o.accountId?'Đã có tài khoản':'Khách lẻ tại quầy'}</div>{o.status==='HOLDING'&&<><div><span>Hạn giữ chỗ</span>{new Date(o.holdUntil).toLocaleTimeString('vi-VN')}</div><div><span>Cọc yêu cầu</span>{money(o.deposit)}</div></>}{o.checkInAt&&<div><span>Check-in</span>{new Date(o.checkInAt).toLocaleString('vi-VN')}</div>}{o.checkOutAt&&<div><span>Check-out</span>{new Date(o.checkOutAt).toLocaleString('vi-VN')}</div>}</div>
    <h3>Khung giờ sân</h3>{o.slots.map(s=><div className="order-line" key={s.id}><span>{data.courts.find(c=>c.id===s.court)?.name} • {slotLabel(s)}</span><b>{money(s.price)}</b></div>)}
    {o.products.length>0&&<details><summary>Khoản thu lịch sử trước khi ngừng dịch vụ</summary>{o.products.map(p=><div className="order-line" key={p.id}><span>{p.name} × {p.quantity}</span><b>{money(p.lineTotal)}</b></div>)}</details>}
    <h3 style={{marginTop:20}}>Trọng tài</h3><StaffLines order={o}/><FinancialSummary order={o}/>
    <div style={{marginTop:20}}><div className="summary-line total"><span>Tổng tiền</span><b>{money(o.total)}</b></div><div className="summary-line"><span>Đã thu (trừ hoàn)</span><b>{money(o.paid)}</b></div><div className="summary-line"><span>{['CANCELLED','EXPIRED'].includes(o.status)?'Không thu thêm':'Còn phải thu'}</span><b>{money(['CANCELLED','EXPIRED'].includes(o.status)?0:Math.max(0,o.total-o.paid))}</b></div></div>
    <div className="step-row no-print">{active(o)&&<><Button className="sm" onClick={()=>show({type:'assign-staff',id})}>Chọn trọng tài</Button></>}{!['HOLDING','CANCELLED','EXPIRED'].includes(o.status)&&<Button className="sm" onClick={async()=>{await doAction('invoice');show({type:'invoice',id});}}>In phiếu thu</Button>}</div>
    <OrderActions order={o} details={false}/><div className="step-row"><Button className="sm" onClick={()=>show({type:'financial-review',id})}>Đối chiếu / khoản cần hoàn</Button>{['EXPIRED','CANCELLED'].includes(o.status)&&<><Button className="sm" onClick={()=>show({type:'restore',id})}>Kiểm tra khôi phục / đổi lịch</Button><Button className="sm" onClick={()=>show({type:'payment',id})}>Ghi tiền đến muộn</Button></>}</div>
    <details className="history-details"><summary>Lịch sử cập nhật đơn</summary><OrderTimeline order={o} courts={data.courts}/></details>
  </Modal>;
}
export function OrderActionDialog({type,id,onClose}) {
  const {data,mutate,notify,show,isAdmin}=useCourtly();
  const requestId=useRef(crypto.randomUUID());
  const order=data.orders.find(o=>o.id===id);
  const done=()=>{notify('Đã cập nhật đơn');show({type:'order',id});};
  if(type==='cancel') return <FormDialog title="Hủy đơn đặt sân" fields={isAdmin?[{name:'reason',label:'Lý do hủy',full:true}]:[]} onClose={onClose} submitText="Xác nhận hủy" onSubmit={async v=>{await mutate(`/orders/${id}/cancel`,{...v,requestId:requestId.current});done();}}><PolicyNotice/><p>Hủy đơn của <b>{order.name}</b> và nhả {order.slots.length} khung giờ?</p><div className="notice" style={{marginTop:16}}>Đã thu {money(order.paid)}. Hủy sẽ nhả sân và lịch trọng tài. Đơn và giao dịch vẫn được lưu trong lịch sử; tiền không tự hoàn về ngân hàng, cần quầy xử lý riêng.</div></FormDialog>;
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
  const [method,setMethod]=useState('CASH');
  const targetId=reg?reg.id:order?.id;
  const refCode=targetId?('CT'+targetId.replace(/-/g,'').substring(0,16).toUpperCase()):'';
  const qrUrl=due>0&&refCode?`https://img.vietqr.io/image/970422-0345678999-compact2.png?amount=${due}&addInfo=${refCode}&accountName=CLB%20TENNIS%20COURTLY`:null;

  return <FormDialog
    title="Ghi nhận khoản thu"
    submitText="Xác nhận đã thu"
    initial={{orderId:reg?null:order?.id,amount:due,method:'CASH',transactionCode:refCode||crypto.randomUUID()}}
    fields={[
      ...(!reg?[{name:'orderId',label:'Đơn đặt sân',full:true,options:orders.map(o=>({value:o.id,label:`${o.name} • còn ${money(o.total-o.paid)}`}))}]:[]),
      {name:'amount',label:'Số tiền (đ)',type:'number',min:1},
      {name:'method',label:'Phương thức',options:options(['CASH','BANK_TRANSFER'])},
      {name:'reason',label:'Lý do (bắt buộc với tiền đến muộn)',required:false,full:true}
    ]}
    onChange={(v,name)=>{
      if(name==='method')setMethod(v.method);
      const o=data.orders.find(o=>o.id===v.orderId);
      return name==='orderId'&&o?{...v,amount:o.total-o.paid}:v;
    }}
    onClose={onClose}
    onSubmit={async v=>{
      await mutate('/payments',{...v,orderId:reg?null:v.orderId,registrationId:registrationId||null});
      notify('Đã ghi nhận khoản thu thành công');
      onClose();
    }}
  >
    {reg&&<div className="notice" style={{marginBottom:15}}>Phí giải • {reg.name} • cần {money(due)}</div>}

    {method==='BANK_TRANSFER'&&qrUrl&&(
      <div style={{background:'#fdfcf8',border:'1px solid #dcdad2',borderRadius:8,padding:14,marginBottom:16,textAlign:'center'}}>
        <div style={{fontSize:12,fontWeight:700,color:'#173c32',marginBottom:8}}>MÃ VIETQR THU TIỀN TẠI QUẦY (MB BANK)</div>
        <img src={qrUrl} alt="VietQR" style={{maxWidth:240,width:'100%',borderRadius:6,border:'1px solid #ddd',boxShadow:'0 2px 8px rgba(0,0,0,0.06)'}} />
        <div style={{fontSize:11,color:'#555',marginTop:8}}>
          Khách quét app ngân hàng bất kỳ • STK: <b>0345678999</b> (MB Bank)<br/>
          Nội dung chuyển khoản: <b style={{color:'#b71c1c'}}>{refCode}</b>
        </div>
      </div>
    )}

    <div className="notice" style={{marginBottom:14}}>
      {method==='BANK_TRANSFER'
        ? 'Cho khách quét mã VietQR trên điện thoại. Sau khi tiền vào tài khoản hoặc khách báo thành công, bấm [Xác nhận đã thu].'
        : 'Nhận đủ tiền mặt từ khách trước khi bấm [Xác nhận đã thu].'}
    </div>
  </FormDialog>;
}

export function RefundDialog({id,onClose}) {
  const {data,mutate,notify}=useCourtly();const p=data.payments.find(p=>p.id===id);
  return <FormDialog title="Ghi nhận hoàn tiền" submitText="Xác nhận đã hoàn" initial={{amount:p.refundable,reason:'',requestId:crypto.randomUUID()}} fields={[{name:'amount',label:'Số tiền hoàn (đ)',type:'number',min:1,max:p.refundable,full:true},{name:'reason',label:'Lý do hoàn',full:true}]} onClose={onClose} onSubmit={async v=>{await mutate(`/payments/${id}/refunds`,v);notify('Đã ghi nhận khoản hoàn');onClose();}}><div className="notice" style={{marginBottom:18}}>Có thể hoàn tối đa <b>{money(p.refundable)}</b>.</div></FormDialog>;
}
export function InvoiceDialog({id,onClose}) {
  const {data}=useCourtly();const current=data.orders.find(x=>x.id===id);const o=current.invoiceSnapshot||current;
  return <Modal title={`PHIẾU THU • ${o.invoice||''}`} onClose={onClose} wide footer={<><Button onClick={onClose}>Đóng</Button><Button className="primary" onClick={()=>window.print()}>In / Lưu PDF</Button></>}><h2>COURTLY TENNIS CLUB</h2><p className="subtitle">Ngày phát hành: {o.issuedAt?new Date(o.issuedAt).toLocaleString('vi-VN'):''}</p><div className="detail-head" style={{marginTop:20}}>Khách hàng: {o.name}<br/>Điện thoại: {o.phone}<br/>Ngày sử dụng: {o.date}</div><Table headings={['Dịch vụ','Thành tiền']}>{o.slots.map(s=><tr key={s.id}><td>{data.courts.find(c=>c.id===s.court)?.name} • {slotLabel(s)}</td><td>{money(s.price)}</td></tr>)}{o.products.map(p=><tr key={p.id}><td>{p.name} × {p.quantity}{p.type==='RENTAL'?` • ${p.hours} giờ`:''}</td><td>{money(p.lineTotal??p.price*p.quantity*(p.type==='RENTAL'?p.hours:1))}</td></tr>)}{o.staff.map(s=><tr key={s.id}><td>{s.name} • {s.hours} giờ</td><td>{money(s.rate*s.hours)}</td></tr>)}</Table>{o.membershipBenefit?.discount>0&&<div className="summary-line membership-discount"><span>Ưu đãi {o.membershipBenefit.planName}</span><b>–{money(o.membershipBenefit.discount)}</b></div>}<div className="summary-line total"><span>Tổng tiền</span><b>{money(o.total)}</b></div><div className="summary-line"><span>Đã thu</span><b>{money(o.paid)}</b></div><div className="summary-line"><span>{['CANCELLED','EXPIRED'].includes(o.status)?'Không thu thêm':'Còn phải thu'}</span><b>{money(['CANCELLED','EXPIRED'].includes(o.status)?0:Math.max(0,o.total-o.paid))}</b></div><p className="subtitle">Phiếu thu nội bộ • chưa tích hợp hóa đơn điện tử thuế.</p></Modal>;
}
