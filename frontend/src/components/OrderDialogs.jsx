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
  const acc=data.accounts?.find(a=>a.id===o.accountId);
  const doAction=async (op,body={})=>{try{await mutate(`/orders/${id}/${op}`,body);notify('Đã cập nhật đơn');}catch(e){notify(e.message);}};

  return <Modal title={`Chi tiết đơn đặt sân #${o.id.slice(0,8)}`} onClose={onClose} wide footer={<>
    {o.status==='HOLDING'&&<Button className="lime" onClick={()=>show({type:'payment',id})}>Thu cọc tại quầy ({money(o.deposit)})</Button>}
    {o.status==='CONFIRMED'&&<Button className="primary" onClick={()=>show({type:'check-in',id})}>Thực hiện Check-in vào sân</Button>}
    {o.status==='CHECKED_IN'&&<Button className="primary" onClick={()=>doAction('check-out')}>Check-out & Hoàn tất</Button>}
    {o.status==='CHECKED_IN'&&<Button onClick={()=>show({type:'extend-order',id})}>⚡ Gia hạn giờ chơi</Button>}
    {['HOLDING','CONFIRMED'].includes(o.status)&&<Button onClick={()=>show({type:'move',id})}>🔄 Đổi lịch sân</Button>}
    {active(o)&&o.paid<o.total&&o.status!=='HOLDING'&&<Button className="lime" onClick={()=>show({type:'payment',id})}>Thu nốt tiền ({money(o.total-o.paid)})</Button>}
    {!['HOLDING','CANCELLED','EXPIRED'].includes(o.status)&&<Button onClick={async()=>{await doAction('invoice');show({type:'invoice',id});}}>In phiếu thu</Button>}
    <Button onClick={onClose}>Đóng</Button>
  </>}>
    <div className="order-lifecycle-bar" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, margin: '0 0 18px', padding: '12px 14px', background: '#f8faf7', borderRadius: 8, border: '1px solid #dce4d6' }}>
      <div style={{ textAlign: 'center', opacity: ['HOLDING', 'CONFIRMED', 'CHECKED_IN', 'COMPLETED'].includes(o.status) ? 1 : 0.4 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: o.status === 'HOLDING' ? '#b45309' : '#173c32' }}>1. GIỮ CHỖ</span>
        <small style={{ display: 'block', fontSize: 10, color: '#666', marginTop: 2 }}>{o.status === 'HOLDING' ? 'Đang giữ 5p' : '✓ Đã tạo đơn'}</small>
      </div>
      <div style={{ textAlign: 'center', opacity: ['CONFIRMED', 'CHECKED_IN', 'COMPLETED'].includes(o.status) ? 1 : 0.4 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: o.status === 'CONFIRMED' ? '#15803d' : '#173c32' }}>2. ĐÃ CỌC (50%)</span>
        <small style={{ display: 'block', fontSize: 10, color: '#666', marginTop: 2 }}>{o.paid >= o.deposit ? `✓ ${money(o.deposit)}` : 'Chờ cọc'}</small>
      </div>
      <div style={{ textAlign: 'center', opacity: ['CHECKED_IN', 'COMPLETED'].includes(o.status) ? 1 : 0.4 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: o.status === 'CHECKED_IN' ? '#2563eb' : '#173c32' }}>3. CHECK-IN</span>
        <small style={{ display: 'block', fontSize: 10, color: '#666', marginTop: 2 }}>{o.checkInAt ? new Date(o.checkInAt).toLocaleTimeString('vi-VN') : 'Chưa vào sân'}</small>
      </div>
      <div style={{ textAlign: 'center', opacity: o.status === 'COMPLETED' ? 1 : 0.4 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: o.status === 'COMPLETED' ? '#173c32' : '#666' }}>4. HOÀN TẤT</span>
        <small style={{ display: 'block', fontSize: 10, color: '#666', marginTop: 2 }}>{o.checkOutAt ? new Date(o.checkOutAt).toLocaleTimeString('vi-VN') : 'Check-out'}</small>
      </div>
    </div>

    <div className="detail-head">
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
        <h2>{o.name}</h2>
        <Chip status={o.status}/>
      </div>
      <small style={{display:'block',marginTop:4}}>Mã đơn: <b>{o.id}</b> • Điện thoại: <b>{o.phone || acc?.phone || 'Chưa cung cấp'}</b> • Email: <b>{acc?.email || 'Khách vãng lai tại quầy'}</b></small>
    </div>

    {o.status==='HOLDING' && (
      <div className="notice" style={{marginTop:12, background:'#fffbeb', borderColor:'#fde68a', color:'#92400e'}}>
        ⏳ <b>Đơn đang trong thời hạn giữ chỗ:</b> Hạn thanh toán cọc đến {new Date(o.holdUntil).toLocaleTimeString('vi-VN')}. Nếu khách không cọc hoặc quầy không xác nhận, hệ thống sẽ tự động giải phóng sân.
      </div>
    )}
    {o.status==='CONFIRMED' && (
      <div className="notice" style={{marginTop:12, background:'#f0fdf4', borderColor:'#bbf7d0', color:'#166534'}}>
        ✓ <b>Lịch đặt đã được xác nhận</b> (Đã cọc {money(o.paid)}). Lễ tân kiểm tra thẻ hội viên/thông tin và bấm <b>"Thực hiện Check-in vào sân"</b> khi khách tới.
      </div>
    )}
    {o.status==='CHECKED_IN' && (
      <div className="notice" style={{marginTop:12, background:'#eff6ff', borderColor:'#bfdbfe', color:'#1e40af'}}>
        🎾 <b>Khách đang chơi trên sân</b> (Check-in lúc {new Date(o.checkInAt).toLocaleTimeString('vi-VN')}). Khi hết giờ, kiểm tra sân và bấm <b>"Check-out & Hoàn tất"</b>.
      </div>
    )}
    {o.status==='COMPLETED' && (
      <div className="notice" style={{marginTop:12, background:'#f8fafc', borderColor:'#e2e8f0', color:'#475569'}}>
        ✓ <b>Buổi chơi đã hoàn tất</b> (Check-out lúc {o.checkOutAt ? new Date(o.checkOutAt).toLocaleTimeString('vi-VN') : 'Đúng giờ'}).
      </div>
    )}

    <div className="detail-grid" style={{marginTop:14}}>
      <div><span>Ngày chơi</span><b>{o.date}</b></div>
      <div><span>Phân loại khách</span><b>{o.accountId?'Tài khoản thành viên':'Khách lẻ tại quầy'}</b></div>
      {o.status==='HOLDING'&&<><div><span>Hạn giữ chỗ</span><b>{new Date(o.holdUntil).toLocaleTimeString('vi-VN')}</b></div><div><span>Cọc yêu cầu</span><b>{money(o.deposit)}</b></div></>}
      {o.checkInAt&&<div><span>Thời gian Check-in</span><b>{new Date(o.checkInAt).toLocaleString('vi-VN')}</b></div>}
      {o.checkOutAt&&<div><span>Thời gian Check-out</span><b>{new Date(o.checkOutAt).toLocaleString('vi-VN')}</b></div>}
    </div>

    <h3 style={{marginTop:20}}>Khung giờ sân</h3>
    {o.slots.map(s=><div className="order-line" key={s.id}><span>{data.courts.find(c=>c.id===s.court)?.name} • {slotLabel(s)}</span><b>{money(s.price)}</b></div>)}
    {o.products.length>0&&<details><summary>Khoản thu lịch sử trước khi ngừng dịch vụ</summary>{o.products.map(p=><div className="order-line" key={p.id}><span>{p.name} × {p.quantity}</span><b>{money(p.lineTotal)}</b></div>)}</details>}
    <h3 style={{marginTop:20}}>Trọng tài</h3><StaffLines order={o}/><FinancialSummary order={o}/>
    <div style={{marginTop:20}}><div className="summary-line total"><span>Tổng tiền</span><b>{money(o.total)}</b></div><div className="summary-line"><span>Đã thu (trừ hoàn)</span><b>{money(o.paid)}</b></div><div className="summary-line"><span>{['CANCELLED','EXPIRED'].includes(o.status)?'Không thu thêm':'Còn phải thu'}</span><b>{money(['CANCELLED','EXPIRED'].includes(o.status)?0:Math.max(0,o.total-o.paid))}</b></div></div>
    <div className="step-row no-print" style={{marginTop:16}}>{active(o)&&<><Button className="sm" onClick={()=>show({type:'assign-staff',id})}>Chọn trọng tài</Button></>}{!['HOLDING','CANCELLED','EXPIRED'].includes(o.status)&&<Button className="sm" onClick={async()=>{await doAction('invoice');show({type:'invoice',id});}}>In phiếu thu</Button>}</div>
    <OrderActions order={o} details={false}/>
    <div className="step-row" style={{marginTop:10}}><Button className="sm" onClick={()=>show({type:'financial-review',id})}>Đối chiếu / khoản cần hoàn</Button>{['EXPIRED','CANCELLED'].includes(o.status)&&<><Button className="sm" onClick={()=>show({type:'restore',id})}>Kiểm tra khôi phục / đổi lịch</Button><Button className="sm" onClick={()=>show({type:'payment',id})}>Ghi tiền đến muộn</Button></>}</div>
    <details className="history-details" style={{marginTop:16}}><summary>Lịch sử cập nhật đơn</summary><OrderTimeline order={o} courts={data.courts}/></details>
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
  const targetId=reg?reg.id:order?.id;
  const refCode=targetId?('CT'+targetId.replace(/-/g,'').substring(0,16).toUpperCase()):'';

  return <FormDialog
    title="Ghi nhận thu tiền mặt tại quầy"
    submitText="Xác nhận đã nhận tiền mặt"
    initial={{orderId:reg?null:order?.id,amount:due,method:'CASH',transactionCode:refCode||crypto.randomUUID()}}
    fields={[
      ...(!reg?[{name:'orderId',label:'Đơn đặt sân',full:true,options:orders.map(o=>({value:o.id,label:`${o.name} • còn ${money(o.total-o.paid)}`}))}]:[]),
      {name:'amount',label:'Số tiền mặt (đ)',type:'number',min:1},
      {name:'reason',label:'Lý do (bắt buộc với tiền đến muộn)',required:false,full:true}
    ]}
    onChange={(v,name)=>{
      const o=data.orders.find(o=>o.id===v.orderId);
      return name==='orderId'&&o?{...v,amount:o.total-o.paid}:v;
    }}
    onClose={onClose}
    onSubmit={async v=>{
      await mutate('/payments',{...v,method:'CASH',orderId:reg?null:v.orderId,registrationId:registrationId||null});
      notify('Đã ghi nhận thu tiền mặt thành công');
      onClose();
    }}
  >
    {reg&&<div className="notice" style={{marginBottom:15}}>Phí giải • {reg.name} • cần {money(due)}</div>}

    <div className="notice" style={{marginBottom:14}}>
      Nhận đủ tiền mặt từ khách tại quầy trước khi bấm [Xác nhận đã nhận tiền mặt]. Khách muốn chuyển khoản vui lòng quét mã VietQR trên đơn đặt sân hoặc hồ sơ cá nhân.
    </div>
  </FormDialog>;
}

export function RefundDialog({id,onClose}) {
  const {data,mutate,notify}=useCourtly();const p=data.payments.find(p=>p.id===id);
  return <FormDialog title="Ghi nhận hoàn tiền" submitText="Xác nhận đã hoàn" initial={{amount:p.refundable,reason:'',requestId:crypto.randomUUID()}} fields={[{name:'amount',label:'Số tiền hoàn (đ)',type:'number',min:1,max:p.refundable,full:true},{name:'reason',label:'Lý do hoàn',full:true}]} onClose={onClose} onSubmit={async v=>{await mutate(`/payments/${id}/refunds`,v);notify('Đã ghi nhận khoản hoàn');onClose();}}><div className="notice" style={{marginBottom:18}}>Có thể hoàn tối đa <b>{money(p.refundable)}</b>.</div></FormDialog>;
}
export function InvoiceDialog({id, onClose}) {
  const {data} = useCourtly();
  const current = data.orders.find(x => x.id === id);
  const o = current.invoiceSnapshot || current;
  const invoiceCode = o.invoice || ('HD-' + o.id.slice(0, 8).toUpperCase());
  const issueDate = o.issuedAt ? new Date(o.issuedAt).toLocaleString('vi-VN') : new Date().toLocaleString('vi-VN');

  return (
    <Modal
      title={`HÓA ĐƠN DỊCH VỤ • ${invoiceCode}`}
      onClose={onClose}
      wide
      footer={
        <>
          <Button onClick={onClose}>Đóng</Button>
          <Button className="primary" onClick={() => window.print()}>
            🖨️ In Hóa Đơn / Xuất PDF
          </Button>
        </>
      }
    >
      <div className="printable-invoice" style={{ padding: '8px 4px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2px solid #173c32', paddingBottom: 16, marginBottom: 16 }}>
          <div>
            <h2 style={{ margin: 0, color: '#173c32', fontSize: 22, fontWeight: 800 }}>COURTLY TENNIS CLUB</h2>
            <div style={{ fontSize: 13, color: '#475569', marginTop: 4 }}>Khu liên hợp thể thao Courtly Tennis Club</div>
            <div style={{ fontSize: 12, color: '#64748b' }}>MST: 0109887766 · Hotline: 0988 123 456 · Email: contact@courtly.vn</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: '#173c32' }}>HÓA ĐƠN DỊCH VỤ</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#0284c7' }}>Số: #{invoiceCode}</div>
            <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>Ngày: {issueDate}</div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, background: '#f8fafc', padding: 12, borderRadius: 8, marginBottom: 18, fontSize: 13 }}>
          <div>
            <span style={{ color: '#64748b' }}>Khách hàng:</span>
            <div style={{ fontWeight: 700, color: '#0f172a' }}>{o.name}</div>
          </div>
          <div>
            <span style={{ color: '#64748b' }}>Số điện thoại:</span>
            <div style={{ fontWeight: 600 }}>{o.phone || 'Khách vãng lai'}</div>
          </div>
          <div>
            <span style={{ color: '#64748b' }}>Ngày sử dụng:</span>
            <div style={{ fontWeight: 600 }}>{o.date}</div>
          </div>
        </div>

        <Table headings={['STT', 'Dịch vụ / Hạng mục', 'Thời lượng / SL', 'Đơn giá', 'Thành tiền']}>
          {o.slots.map((s, idx) => (
            <tr key={s.id}>
              <td>{idx + 1}</td>
              <td><b>{data.courts.find(c => c.id === s.court)?.name}</b> • {slotLabel(s)}</td>
              <td>{slotHours(s) * 60} phút</td>
              <td>{money(s.price)}</td>
              <td className="name">{money(s.price)}</td>
            </tr>
          ))}
          {o.products.map((p, idx) => (
            <tr key={p.id}>
              <td>{o.slots.length + idx + 1}</td>
              <td>{p.name} {p.type === 'RENTAL' ? '(Thuê)' : '(F&B / Hàng hóa)'}</td>
              <td>{p.quantity} {p.type === 'RENTAL' ? `(${p.hours} giờ)` : 'món'}</td>
              <td>{money(p.price)}</td>
              <td className="name">{money(p.lineTotal ?? p.price * p.quantity * (p.type === 'RENTAL' ? p.hours : 1))}</td>
            </tr>
          ))}
          {o.staff.map((s, idx) => (
            <tr key={s.id}>
              <td>{o.slots.length + o.products.length + idx + 1}</td>
              <td>Dịch vụ trọng tài • {s.name}</td>
              <td>{s.hours} giờ</td>
              <td>{money(s.rate)}/h</td>
              <td className="name">{money(s.rate * s.hours)}</td>
            </tr>
          ))}
        </Table>

        <div style={{ marginTop: 16, borderTop: '1px solid #e2e8f0', paddingTop: 12 }}>
          {o.membershipBenefit?.discount > 0 && (
            <div className="summary-line membership-discount" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span>Ưu đãi hội viên ({o.membershipBenefit.planName})</span>
              <b style={{ color: '#16a34a' }}>–{money(o.membershipBenefit.discount)}</b>
            </div>
          )}
          {o.voucherBenefit?.discount > 0 && (
            <div className="summary-line voucher-discount" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span>Voucher giảm giá ({o.voucherBenefit.code})</span>
              <b style={{ color: '#16a34a' }}>–{money(o.voucherBenefit.discount)}</b>
            </div>
          )}
          <div className="summary-line total" style={{ display: 'flex', justifyContent: 'space-between', fontSize: 16, fontWeight: 700, marginBottom: 6 }}>
            <span>Tổng cộng thanh toán:</span>
            <b style={{ color: '#173c32' }}>{money(o.total)}</b>
          </div>
          <div className="summary-line" style={{ display: 'flex', justifyContent: 'space-between', color: '#059669', marginBottom: 6 }}>
            <span>Đã thanh toán:</span>
            <b>{money(o.paid)}</b>
          </div>
          <div className="summary-line" style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600 }}>
            <span>{['CANCELLED', 'EXPIRED'].includes(o.status) ? 'Trạng thái đơn' : 'Còn lại cần thu:'}</span>
            <b style={{ color: ['CANCELLED', 'EXPIRED'].includes(o.status) ? '#dc2626' : o.total - o.paid > 0 ? '#b45309' : '#059669' }}>
              {['CANCELLED', 'EXPIRED'].includes(o.status) ? (labels[o.status] || o.status) : money(Math.max(0, o.total - o.paid))}
            </b>
          </div>
        </div>

        <div style={{ textAlign: 'center', marginTop: 24, paddingTop: 12, borderTop: '1px dashed #cbd5e1', fontSize: 12, color: '#64748b' }}>
          <i>Cảm ơn Quý khách đã sử dụng dịch vụ tại Courtly Tennis Club! Hẹn gặp lại Quý khách.</i>
        </div>
      </div>
    </Modal>
  );
}

export function ExtendOrderDialog({id, onClose}) {
  const {data, mutate, notify} = useCourtly();
  const o = data.orders.find(x => x.id === id);
  const [loading, setLoading] = useState(true);
  const [extData, setExtData] = useState(null);
  const [error, setError] = useState('');
  const [selectedDuration, setSelectedDuration] = useState(30);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api(`/orders/${id}/extension-options`)
      .then(res => {
        setExtData(res);
        if (res.options?.length) setSelectedDuration(res.options[0].duration);
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  if (!o) return null;
  const selectedOpt = extData?.options?.find(opt => opt.duration === selectedDuration) || extData?.options?.[0];

  const handleConfirm = async () => {
    if (!selectedOpt) return;
    setSubmitting(true);
    setError('');
    try {
      await mutate(`/orders/${id}/extend`, {
        scheduleIds: selectedOpt.scheduleIds,
        requestId: crypto.randomUUID()
      });
      notify(`Đã gia hạn sân thêm ${selectedOpt.duration} phút thành công!`);
      onClose();
    } catch (e) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal title={`Gia hạn sân · Đơn #${o.id.slice(0,8)} (${o.name})`} onClose={onClose}>
      <p className="subtitle">
        Sân: <b>{extData?.courtName || 'Đang sử dụng'}</b> · Giờ kết thúc hiện tại: <b>{extData?.currentEndTime || '...'}</b>
      </p>

      {loading ? (
        <p role="status">Đang kiểm tra tính khả dụng của sân và bảng giá…</p>
      ) : error ? (
        <p className="error" role="alert">{error}</p>
      ) : !extData?.canExtend ? (
        <div className="notice" style={{background: '#fffbeb', borderColor: '#fde68a', color: '#92400e', marginTop: 14}}>
          <strong style={{display: 'block', marginBottom: 4}}>⚠️ Không thể gia hạn sân này</strong>
          <p style={{margin: 0}}>{extData?.reason || 'Sân đã có lịch đặt tiếp theo ngay sau giờ chơi.'}</p>
          <small style={{display: 'block', marginTop: 6, color: '#78350f'}}>
            Vui lòng yêu cầu khách trả sân đúng giờ hoặc kiểm tra lịch để sắp xếp sân khác còn trống.
          </small>
          <div style={{marginTop: 14}}>
            <Button onClick={onClose}>Đóng</Button>
          </div>
        </div>
      ) : (
        <div>
          <div className="notice" style={{background: '#f0fdf4', borderColor: '#bbf7d0', color: '#166534', margin: '12px 0'}}>
            ✓ Sân trống ở khung giờ liền kề. Có thể gia hạn cho khách ngay!
          </div>

          <div style={{display: 'grid', gap: 10, margin: '14px 0'}}>
            {extData.options.map(opt => {
              const isSelected = selectedDuration === opt.duration;
              return (
                <label
                  key={opt.duration}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '12px 14px',
                    borderRadius: 8,
                    border: isSelected ? '2px solid #173c32' : '1px solid #dce4d6',
                    background: isSelected ? '#f7faf5' : '#fff',
                    cursor: 'pointer'
                  }}
                >
                  <div style={{display: 'flex', alignItems: 'center', gap: 10}}>
                    <input
                      type="radio"
                      name="staff-ext-duration"
                      checked={isSelected}
                      onChange={() => setSelectedDuration(opt.duration)}
                    />
                    <div>
                      <strong>+{opt.duration} phút ({opt.startTime} – {opt.endTime})</strong>
                      {opt.planName && <small style={{display: 'block', color: '#15803d'}}>★ Ưu đãi {opt.planName}: -{money(opt.discount)}</small>}
                    </div>
                  </div>
                  <b>+{money(opt.total)}</b>
                </label>
              );
            })}
          </div>

          <p className="notice">
            Tiền gia hạn (+{money(selectedOpt?.total || 0)}) sẽ được cộng vào công nợ của đơn. Lễ tân có thể thu nốt tại quầy trước hoặc khi làm thủ tục check-out.
          </p>

          <div className="step-row" style={{marginTop: 16}}>
            <Button disabled={submitting} onClick={onClose}>Hủy</Button>
            <Button className="primary" disabled={submitting} onClick={handleConfirm}>
              {submitting ? 'Đang gia hạn…' : `Xác nhận gia hạn (+${selectedOpt?.duration || 30}p)`}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
