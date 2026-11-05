import {slotLabel,slotHours,hourLabel} from '../utils/format';
import React, { useRef, useState, useEffect } from 'react';
import QRCode from 'qrcode';
import { Printer, Receipt, FileText } from 'lucide-react';
import BookingFlow from './BookingFlow';
import MoveDialog from './MoveDialog';
import {FinancialSummary,StaffLines,PolicyNotice} from './OrderSummary';
import OrderActions from './OrderActions';
import {OrderTimeline} from '../pages/CustomerHistory';
import { useCourtly } from '../context';
import { Modal, FormDialog, Button, Chip, Table } from './UI';
import { api } from '../services/api';
import { money, active, options, labels } from '../utils/format';
import { buildCheckoutBreakdown } from '../utils/checkout.mjs';

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
export function OrderDetail({id,onClose,visitDate}) {
  const {data,show,mutate,notify,isAdmin}=useCourtly();
  const o=data.orders.find(x=>x.id===id);
  if(!o) return null;
  const acc=data.accounts?.find(a=>a.id===o.accountId);
  const doAction=async (op,body={})=>{try{await mutate(`/orders/${id}/${op}`,body);notify('Đã cập nhật đơn');}catch(e){notify(e.message);}};

  return <Modal title={`Chi tiết đơn đặt sân #${o.id.slice(0,8)}`} onClose={onClose} wide footer={<>
    {o.status==='HOLDING'&&<Button className="lime" onClick={()=>show({type:'payment',id,mode:'DEPOSIT'})}>Thu cọc tại quầy ({money(o.deposit)})</Button>}
    {o.status==='CONFIRMED'&&<Button className="primary" onClick={()=>show({type:'check-in',id,visitDate})}>Thực hiện Check-in vào sân</Button>}
    {o.status==='CHECKED_IN'&&<Button className="primary" onClick={()=>show({type:'check-out',id:o.id})}>🏁 Check-out & Hoàn tất</Button>}
    {o.status==='CHECKED_IN'&&<Button onClick={()=>show({type:'extend-order',id})}>⚡ Gia hạn giờ chơi</Button>}
    {['HOLDING','CONFIRMED'].includes(o.status)&&<Button onClick={()=>show({type:'move',id})}>🔄 Đổi lịch sân</Button>}
    {['CONFIRMED','HOLDING','CHECKED_IN'].includes(o.status)&&<Button onClick={async()=>{try{await api('/admin/orders/'+id+'/send-reminder','POST');notify('Đã gửi thông báo nhắc lịch tới khách qua Email và thông báo trong ứng dụng!');}catch(e){notify('Lỗi gửi nhắc: '+e.message);}}}>🔔 Gửi nhắc ngay</Button>}
    {active(o)&&o.paid<o.total&&o.status!=='HOLDING'&&<Button className="lime" onClick={()=>show({type:'payment',id,mode:'BALANCE'})}>Thu nốt tiền ({money(o.total-o.paid)})</Button>}
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

    {visitDate&&<p className="notice">Buổi đang xem trên lịch: <b>{visitDate}</b>. Chi tiết bên dưới gồm toàn bộ đơn.</p>}
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
        ✓ <b>Lịch đặt đã được xác nhận</b> (Đã cọc {money(o.paid)}). Lễ tân kiểm tra mã QR đặt sân/thông tin và bấm <b>"Thực hiện Check-in vào sân"</b> khi khách tới.
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
    {['CANCELLED', 'EXPIRED'].includes(o.status) && (() => {
      const settlement = o.cancellationSettlement;
      const refundPending = o.finance?.refundPending || settlement?.refundAmount || 0;
      const refunded = o.finance?.refunded || 0;
      const isRefunded = refunded > 0;
      const hasPending = refundPending > 0 && !isRefunded;
      const policyDesc = settlement?.policyDescription || settlement?.description || (o.paid === 0 ? 'Đơn chưa thanh toán tiền cọc.' : 'Hủy cận giờ chơi (< 12 tiếng), tiền cọc được giữ lại theo chính sách CLB.');
      return (
        <div className="notice" style={{
          marginTop: 12,
          background: isRefunded ? '#f0fdf4' : hasPending ? '#fffbeb' : '#f8fafc',
          borderColor: isRefunded ? '#bbf7d0' : hasPending ? '#fde68a' : '#e2e8f0',
          color: isRefunded ? '#166534' : hasPending ? '#92400e' : '#475569'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8 }}>
            <div>
              <strong style={{ fontSize: 14, display: 'block', marginBottom: 4 }}>
                {isRefunded
                  ? `✓ Đã hoàn tiền thành công: ${money(refunded)}`
                  : hasPending
                  ? `⏳ Khoản hoàn tiền đang chờ thực hiện: ${money(refundPending)}`
                  : 'ℹ️ Không đủ điều kiện hoàn tiền cọc'}
              </strong>
              <div style={{ fontSize: 13, lineHeight: 1.5 }}>
                <b>Lý do & chính sách:</b> {policyDesc}
              </div>
              {settlement && (
                <small style={{ display: 'block', marginTop: 4, color: '#64748b' }}>
                  Thời điểm hủy: {settlement.hoursBeforePlay ? `Trước giờ chơi ${settlement.hoursBeforePlay} tiếng` : 'Đã ghi nhận'} • Tỷ lệ hoàn: {settlement.refundPercent}% • Đã nộp: {money(o.paid)} • Giữ lại: {money(settlement.retainedAmount || 0)}
                </small>
              )}
            </div>
            {hasPending && (
              isAdmin ? (
                <Button className="primary sm" style={{ background: '#e11d48', borderColor: '#be123c', color: '#fff' }} onClick={() => show({ type: 'refund', orderId: o.id })}>
                  💳 Thực hiện hoàn tiền ngay
                </Button>
              ) : (
                <span style={{ fontSize: 12, fontWeight: 700, color: '#b45309', background: '#fef3c7', padding: '4px 8px', borderRadius: 4, border: '1px solid #fde68a' }}>
                  Chờ Admin duyệt hoàn
                </span>
              )
            )}
          </div>
        </div>
      );
    })()}

    <div className="detail-grid" style={{marginTop:14}}>
      <div><span>Ngày chơi</span><b>{o.date}</b></div>
      <div><span>Phân loại khách</span><b>{o.accountId?'Tài khoản thành viên':'Khách lẻ tại quầy'}</b></div>
      {o.status==='HOLDING'&&<><div><span>Hạn giữ chỗ</span><b>{new Date(o.holdUntil).toLocaleTimeString('vi-VN')}</b></div><div><span>Cọc yêu cầu</span><b>{money(o.deposit)}</b></div></>}
      {o.checkInAt&&<div><span>Thời gian Check-in</span><b>{new Date(o.checkInAt).toLocaleString('vi-VN')}</b></div>}
      {o.checkOutAt&&<div><span>Thời gian Check-out</span><b>{new Date(o.checkOutAt).toLocaleString('vi-VN')}</b></div>}
      {o.totalExtensionMinutes > 0 && <div><span>Đã gia hạn thêm</span><b style={{color: '#2563eb'}}>+{o.totalExtensionMinutes} phút ({money(o.totalExtensionFee || 0)})</b></div>}
    </div>

    <h3 style={{marginTop:20}}>Khung giờ sân</h3>
    {o.visits?.length>1&&<section className="notice"><b>Các buổi trong đơn</b>{o.visits.map(v=><div key={v.date}>{v.date} · {v.status==='COMPLETED'?'Đã chơi':v.status==='CHECKED_IN'?'Đang chơi':v.status==='CANCELLED'?'Đã hủy':'Chưa chơi'}</div>)}</section>}
    {o.slots.map(s=><div className="order-line" key={s.id}><span>{data.courts.find(c=>c.id===s.court)?.name} • {s.date} • {slotLabel(s)}</span><b>{money(s.price)}</b></div>)}
    
    <h3 style={{marginTop:20}}>Trọng tài</h3><StaffLines order={o}/><FinancialSummary order={o}/>
    <div style={{marginTop:20}}><div className="summary-line total"><span>Tổng tiền</span><b>{money(o.total)}</b></div><div className="summary-line"><span>Đã thu (trừ hoàn)</span><b>{money(o.paid)}</b></div><div className="summary-line"><span>{['CANCELLED','EXPIRED'].includes(o.status)?'Không thu thêm':'Còn phải thu'}</span><b>{money(['CANCELLED','EXPIRED'].includes(o.status)?0:Math.max(0,o.total-o.paid))}</b></div></div>
    <div className="step-row no-print" style={{marginTop:16}}>{active(o)&&<><Button className="sm" onClick={()=>show({type:'assign-staff',id})}>Chọn trọng tài</Button></>}{!['HOLDING','CANCELLED','EXPIRED'].includes(o.status)&&<Button className="sm" onClick={async()=>{await doAction('invoice');show({type:'invoice',id});}}>In phiếu thu</Button>}</div>
    <OrderActions order={o} details={false}/>
    <div className="step-row" style={{marginTop:10}}><Button className="sm" onClick={()=>show({type:'financial-review',id})}>Đối chiếu / khoản cần hoàn</Button>{['EXPIRED','CANCELLED'].includes(o.status)&&<><Button className="sm" onClick={()=>show({type:'restore',id})}>Kiểm tra khôi phục / đổi lịch</Button><Button className="sm" onClick={()=>show({type:'payment',id})}>Ghi tiền đến muộn</Button></>}</div>
    <details className="history-details" style={{marginTop:16}}><summary>Lịch sử cập nhật đơn</summary><OrderTimeline order={o} courts={data.courts}/></details>
  </Modal>;
}
export function OrderCancelDialog({id, onClose}) {
  const {data, mutate, notify, show, isAdmin} = useCourtly();
  const o = data.orders.find(x => x.id === id);
  const [loading, setLoading] = useState(true);
  const [quote, setQuote] = useState(null);
  const [error, setError] = useState('');
  const [reason, setReason] = useState('');
  const [fullRefund, setFullRefund] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api(`/orders/${id}/cancellation-preview`)
      .then(res => setQuote(res))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  if (!o) return null;

  const handleConfirmCancel = async () => {
    if (isAdmin && !reason.trim()) {
      setError('Vui lòng nhập lý do hủy đơn');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      await mutate(`/orders/${id}/cancel`, {
        reason: reason || 'Khách yêu cầu hủy đơn',
        fullRefund: isAdmin ? fullRefund : false,
        requestId: crypto.randomUUID()
      });
      notify(`Đã hủy đơn #${o.id.slice(0, 8)} thành công.`);
      onClose();
      show({ type: 'order', id: o.id });
    } catch (e) {
      setError(e.message || 'Lỗi khi hủy đơn');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal title={`Hủy đơn đặt sân · #${o.id.slice(0, 8)} (${o.name})`} onClose={onClose}>
      <p className="subtitle">
        Sân: <b>{o.slots?.map(s => data.courts.find(c => c.id === s.court)?.name).filter(Boolean).join(', ') || 'Sân'}</b> • Ngày: <b>{o.date}</b>
      </p>

      {loading ? (
        <p role="status">Đang tính toán chính sách hoàn tiền…</p>
      ) : error ? (
        <p className="error" role="alert">{error}</p>
      ) : (
        <div>
          <div style={{
            background: quote?.refundPercent === 100 || fullRefund ? '#f0fdf4' : quote?.refundPercent === 50 ? '#fffbeb' : '#fef2f2',
            border: quote?.refundPercent === 100 || fullRefund ? '1px solid #bbf7d0' : quote?.refundPercent === 50 ? '1px solid #fde68a' : '1px solid #fecaca',
            borderRadius: 8,
            padding: 14,
            marginBottom: 16
          }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: quote?.refundPercent === 100 || fullRefund ? '#166534' : quote?.refundPercent === 50 ? '#92400e' : '#b91c1c', marginBottom: 6 }}>
              {fullRefund
                ? '⭐ Duyệt hoàn 100% tiền đã thu (Ngoại lệ Quản trị)'
                : quote?.refundPercent === 100
                ? '✓ Đủ điều kiện hoàn 100% tiền cọc (Hủy trước > 24 tiếng)'
                : quote?.refundPercent === 50
                ? '⚠️ Hoàn 50% tiền cọc / Phạt giữ 50% (Hủy trước 12h–24h)'
                : '❌ Giữ lại 100% tiền cọc (Hủy cận giờ dưới 12 tiếng)'}
            </div>

            <div style={{ fontSize: 13, color: '#334155', lineHeight: 1.5 }}>
              {fullRefund ? 'Quản trị viên chọn hoàn toàn bộ tiền cho khách do sự cố sân / thời tiết / bất khả kháng.' : (quote?.policyDescription || quote?.description)}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 10, paddingTop: 10, borderTop: '1px dashed #cbd5e1', fontSize: 13 }}>
              <div>Đã thu: <b>{money(quote?.paid || o.paid)}</b></div>
              <div>Trước giờ chơi: <b>{quote?.hoursBeforePlay ?? quote?.hoursUntilMatch ?? '...'} tiếng</b></div>
              <div style={{ color: '#16a34a' }}>Dự kiến hoàn: <b>{money(fullRefund ? (quote?.paid || o.paid) : quote?.refundAmount)}</b> ({fullRefund ? 100 : quote?.refundPercent}%)</div>
              <div style={{ color: '#dc2626' }}>Giữ lại: <b>{money(fullRefund ? 0 : quote?.retainedAmount)}</b></div>
            </div>
          </div>

          {isAdmin && (
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, cursor: 'pointer', background: '#f8fafc', padding: '8px 12px', borderRadius: 6, border: '1px solid #e2e8f0', fontSize: 13, fontWeight: 600 }}>
              <input type="checkbox" checked={fullRefund} onChange={e => setFullRefund(e.target.checked)} />
              <span>Duyệt hoàn 100% tiền cho khách (Lý do sự cố sân / thời tiết / kỹ thuật)</span>
            </label>
          )}

          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
              Lý do hủy đơn {isAdmin && <span style={{ color: '#e11d48' }}>*</span>}
            </label>
            <textarea
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder="Nhập lý do hủy (ví dụ: Khách bận việc đột xuất, Mưa lớn ngập sân...)"
              style={{ width: '100%', minHeight: 60, padding: 8, borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 13 }}
            />
          </div>

          <div className="notice" style={{ fontSize: 12, marginBottom: 16 }}>
            Sau khi hủy, toàn bộ khung giờ sân sẽ được giải phóng ngay lập tức. Khoản hoàn tiền ({money(fullRefund ? (quote?.paid || o.paid) : quote?.refundAmount)}) sẽ được lưu vào danh sách <b>Chờ hoàn tiền</b> để quầy thực hiện chuyển khoản cho khách.
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            <Button disabled={submitting} onClick={onClose}>Không hủy / Giữ đơn</Button>
            <Button className="danger" disabled={submitting} onClick={handleConfirmCancel}>
              {submitting ? 'Đang hủy đơn…' : 'Xác nhận hủy đơn'}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}

export function OrderActionDialog({type,id,onClose}) {
  if(type==='cancel') return <OrderCancelDialog id={id} onClose={onClose}/>;
  if(type==='assign-staff')return <MoveDialog id={id} mode="assign" onClose={onClose}/>;
  if(type==='move')return <MoveDialog id={id} onClose={onClose}/>;
  return null;
}
export function PaymentDialog({id, registrationId, mode, onClose}) {
  const {data, mutate, notify} = useCourtly();
  const orders = data.orders.filter(o => (active(o) || o.status === 'COMPLETED' || o.id === id) && o.paid < o.total);
  const order = data.orders.find(o => o.id === id) || orders[0];
  const reg = data.registrations?.find(r => r.id === registrationId);

  const [selectedOrderId, setSelectedOrderId] = useState(order?.id || '');
  const currentOrder = data.orders.find(o => o.id === selectedOrderId) || order;

  const total = currentOrder?.total || 0;
  const paid = currentOrder?.paid || 0;
  const depositReq = currentOrder?.deposit != null ? currentOrder.deposit : (currentOrder?.depositRequired || 0);
  const depositDue = Math.max(0, depositReq - paid);
  const balanceDue = Math.max(0, total - paid);
  const regDue = reg ? ((data.tournaments?.find(t => t.id === reg.tournamentId)?.fee || 0) - reg.paid) : 0;

  const defaultAmount = reg ? regDue : (mode === 'DEPOSIT' || (!mode && currentOrder?.status === 'HOLDING'))
    ? (depositDue > 0 ? depositDue : balanceDue)
    : balanceDue;

  const [amount, setAmount] = useState(defaultAmount);
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (currentOrder && !reg) {
      const curTot = currentOrder.total || 0;
      const curPd = currentOrder.paid || 0;
      const curDep = currentOrder.deposit != null ? currentOrder.deposit : (currentOrder.depositRequired || 0);
      const curDepDue = Math.max(0, curDep - curPd);
      const curBalDue = Math.max(0, curTot - curPd);
      if (mode === 'DEPOSIT' || (!mode && currentOrder.status === 'HOLDING')) {
        setAmount(curDepDue > 0 ? curDepDue : curBalDue);
      } else {
        setAmount(curBalDue);
      }
    }
  }, [selectedOrderId]);

  const targetId = reg ? reg.id : currentOrder?.id;
  const refCode = 'CASH-' + (targetId ? targetId.replace(/-/g, '').substring(0, 8).toUpperCase() : '') + '-' + Date.now().toString(36).toUpperCase();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting) return;
    const numAmount = Number(amount);
    if (!numAmount || numAmount <= 0) {
      setError('Vui lòng nhập số tiền hợp lệ (> 0đ)');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      await mutate('/payments', {
        orderId: reg ? null : selectedOrderId,
        registrationId: registrationId || null,
        amount: numAmount,
        method: 'CASH',
        transactionCode: refCode,
        reason: reason || undefined
      });
      notify('Đã ghi nhận thu tiền mặt thành công');
      onClose();
    } catch (err) {
      setError(err.message || 'Lỗi khi ghi nhận thu tiền');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      title="Ghi nhận thu tiền mặt tại quầy"
      onClose={onClose}
      footer={<>
        <Button onClick={onClose} disabled={submitting}>Đóng</Button>
        <button
          type="submit"
          form="cash-payment-form"
          className="btn primary"
          disabled={submitting}
        >
          {submitting ? 'Đang lưu…' : 'Xác nhận đã nhận tiền mặt'}
        </button>
      </>}
    >
      {reg && <div className="notice" style={{ marginBottom: 15 }}>Phí giải • {reg.name} • cần {money(regDue)}</div>}

      <div className="notice" style={{ marginBottom: 14 }}>
        Nhận đủ tiền mặt từ khách tại quầy trước khi bấm [Xác nhận đã nhận tiền mặt]. Khách muốn chuyển khoản vui lòng quét mã VietQR trên đơn đặt sân hoặc hồ sơ cá nhân.
      </div>

      <form id="cash-payment-form" onSubmit={handleSubmit}>
        <div className="form-grid">
          {!reg && (
            <div className="field full">
              <label htmlFor="field-orderId">Đơn đặt sân</label>
              <select
                id="field-orderId"
                value={selectedOrderId}
                onChange={e => setSelectedOrderId(e.target.value)}
              >
                {orders.map(o => (
                  <option key={o.id} value={o.id}>
                    {o.name || ('#' + o.id.slice(0, 8))} • còn {money(o.total - o.paid)}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="field full">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <label htmlFor="field-amount" style={{ margin: 0 }}>Số tiền mặt (đ)</label>
              {!reg && currentOrder && (
                <div style={{ display: 'inline-flex', gap: 6 }}>
                  {depositDue > 0 && (
                    <button
                      type="button"
                      className="btn sm"
                      onClick={() => setAmount(depositDue)}
                      style={{
                        background: amount === depositDue ? '#173c32' : '#f1f5f9',
                        color: amount === depositDue ? '#def46a' : '#1e293b',
                        borderColor: amount === depositDue ? '#173c32' : '#cbd5e1',
                        fontSize: 12,
                        fontWeight: 700,
                        padding: '3px 8px',
                        cursor: 'pointer'
                      }}
                    >
                      Cọc 50%: {money(depositDue)}
                    </button>
                  )}
                  <button
                    type="button"
                    className="btn sm"
                    onClick={() => setAmount(balanceDue)}
                    style={{
                      background: amount === balanceDue ? '#173c32' : '#f1f5f9',
                      color: amount === balanceDue ? '#def46a' : '#1e293b',
                      borderColor: amount === balanceDue ? '#173c32' : '#cbd5e1',
                      fontSize: 12,
                      fontWeight: 700,
                      padding: '3px 8px',
                      cursor: 'pointer'
                    }}
                  >
                    Cả đơn: {money(balanceDue)}
                  </button>
                </div>
              )}
            </div>
            <input
              id="field-amount"
              type="number"
              min={1}
              required
              value={amount ?? ''}
              onChange={e => setAmount(e.target.value !== '' ? Number(e.target.value) : '')}
            />
          </div>

          <div className="field full">
            <label htmlFor="field-reason">Lý do (bắt buộc với tiền đến muộn)</label>
            <input
              id="field-reason"
              type="text"
              maxLength={255}
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder="VD: Thu cọc tại quầy, thu nốt tiền sân khi vào chơi..."
            />
          </div>
        </div>

        {error && (
          <div className="error" role="alert" style={{ marginTop: 12 }}>
            <p style={{ margin: 0 }}>{error}</p>
          </div>
        )}
      </form>
    </Modal>
  );
}

export function RefundDialog({id, orderId, onClose}) {
  const {data, mutate, notify, isAdmin} = useCourtly();
  if (!isAdmin) {
    return (
      <Modal title="Ghi nhận hoàn tiền" onClose={onClose}>
        <div className="notice" style={{ background: '#fef2f2', borderColor: '#fecaca', color: '#b91c1c' }}>
          Chỉ Quản trị viên (Admin) mới có quyền duyệt hoàn tiền.
        </div>
      </Modal>
    );
  }
  const order = orderId ? data.orders.find(o => o.id === orderId) : null;
  const p = id
    ? data.payments.find(p => p.id === id)
    : data.payments.find(p => p.orderId === orderId && p.refundable > 0) || data.payments.find(p => p.orderId === orderId);

  if (!p) {
    return (
      <Modal title="Ghi nhận hoàn tiền" onClose={onClose}>
        <div className="notice" style={{ background: '#fef2f2', borderColor: '#fecaca', color: '#b91c1c' }}>
          Không tìm thấy giao dịch đã thu có thể hoàn tiền cho đơn này. Khách chưa thanh toán hoặc toàn bộ giao dịch đã được hoàn tất trước đó.
        </div>
        <div style={{ marginTop: 14, textAlign: 'right' }}><Button onClick={onClose}>Đóng</Button></div>
      </Modal>
    );
  }

  const initialAmount = order?.finance?.refundPending ? Math.min(order.finance.refundPending, p.refundable) : p.refundable;
  const initialReason = order?.cancellationSettlement?.policyDescription || order?.cancellationSettlement?.description || 'Hoàn tiền cọc theo chính sách hủy hợp lệ của CLB';

  return (
    <FormDialog
      title={`Ghi nhận hoàn tiền · Đơn #${(order || p.orderId ? (order?.id || p.orderId).slice(0, 8) : p.id.slice(0, 8))}`}
      submitText="Xác nhận đã chuyển khoản / hoàn tiền"
      initial={{
        amount: initialAmount,
        reason: initialReason,
        requestId: crypto.randomUUID()
      }}
      fields={[
        {name: 'amount', label: 'Số tiền hoàn cho khách (₫)', type: 'number', min: 1, max: p.refundable, full: true},
        {name: 'reason', label: 'Lý do hoàn tiền (hiển thị cho khách và lưu sổ đối soát)', full: true}
      ]}
      onClose={onClose}
      onSubmit={async v => {
        await mutate(`/payments/${p.id}/refunds`, v);
        notify(`Đã ghi nhận hoàn ${money(v.amount)} thành công!`);
        onClose();
      }}
    >
      <div className="notice" style={{ marginBottom: 14 }}>
        Giao dịch gốc: <b>#{p.id.slice(0, 8)}</b> • Đã thu: <b>{money(p.amount)}</b> • Khả dụng hoàn: <b>{money(p.refundable)}</b>.
      </div>
      {order && (
        <div style={{ background: '#f8fafc', padding: '10px 12px', borderRadius: 6, marginBottom: 14, fontSize: 13, border: '1px solid #e2e8f0' }}>
          <div>Khách hàng: <b>{order.name}</b> ({order.phone || 'Chưa có SĐT'})</div>
          <div>Khoản chờ hoàn theo chính sách: <b style={{ color: '#b91c1c' }}>{money(order.finance?.refundPending || p.refundable)}</b></div>
        </div>
      )}
    </FormDialog>
  );
}
export function InvoiceDialog({id, onClose}) {
  const {data, user} = useCourtly();
  const current = data.orders.find(x => x.id === id);
  const o = current.invoiceSnapshot || current;
  const invoiceCode = o.invoice || ('HD-' + o.id.slice(0, 8).toUpperCase());
  const issueDate = o.issuedAt ? new Date(o.issuedAt).toLocaleString('vi-VN') : new Date().toLocaleString('vi-VN');

  const [format, setFormat] = useState('k80'); // 'k80' (bill nhiệt 80mm) | 'a4' (khổ A4 chuẩn)
  const [qrSrc, setQrSrc] = useState('');

  useEffect(() => {
    const payload = o.qrPayload || ('CHECKIN:' + o.id + ':' + (o.phone || ''));
    QRCode.toDataURL(payload, { width: 140, margin: 1, errorCorrectionLevel: 'M' })
      .then(url => setQrSrc(url))
      .catch(() => {});
  }, [o]);

  useEffect(() => {
    const cleanup = () => {
      document.body.classList.remove('print-k80', 'print-a4', 'printing-report');
    };
    window.addEventListener('afterprint', cleanup);
    return () => window.removeEventListener('afterprint', cleanup);
  }, []);

  const handlePrint = () => {
    document.body.classList.remove('print-k80', 'print-a4', 'printing-report');
    document.body.classList.add(format === 'k80' ? 'print-k80' : 'print-a4');
    window.print();
  };

  const cashierName = user?.name || 'Lễ tân CLB';
  const remainingAmount = Math.max(0, o.total - o.paid);

  return (
    <Modal
      title={`HÓA ĐƠN DỊCH VỤ • ${invoiceCode}`}
      onClose={onClose}
      wide
      footer={
        <>
          <Button onClick={onClose}>Đóng</Button>
          <Button className="primary" onClick={handlePrint}>
            <Printer size={16} /> In {format === 'k80' ? 'Bill Nhiệt K80 (Quầy)' : 'Hóa Đơn A4 / Xuất PDF'}
          </Button>
        </>
      }
    >
      {/* Format Selector Bar */}
      <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, padding: '10px 14px', background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0', flexWrap: 'wrap', gap: 10 }}>
        <div style={{ fontSize: 13, color: '#475569', fontWeight: 600 }}>
          Chọn định dạng đầu ra phiếu in:
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            type="button"
            className={`invoice-format-pill ${format === 'k80' ? 'active' : ''}`}
            onClick={() => setFormat('k80')}
          >
            <Receipt size={14} /> Khổ Bill nhiệt K80 (Quầy POS)
          </button>
          <button
            type="button"
            className={`invoice-format-pill ${format === 'a4' ? 'active' : ''}`}
            onClick={() => setFormat('a4')}
          >
            <FileText size={14} /> Khổ A4 Chuẩn (Kế toán & Đoàn)
          </button>
        </div>
      </div>

      {format === 'k80' ? (
        /* K80 THERMAL RECEIPT PREVIEW */
        <div className="k80-wrapper">
          <div className="printable-invoice-k80">
            <div style={{ textAlign: 'center', marginBottom: 10 }}>
              <div style={{ fontSize: 15, fontWeight: 800, color: '#173c32', letterSpacing: 0.5 }}>COURTLY TENNIS CLUB</div>
              <div style={{ fontSize: 11, color: '#475569', marginTop: 2 }}>Khu Liên Hợp Thể Thao Cao Cấp</div>
              <div style={{ fontSize: 10.5, color: '#64748b' }}>Hotline: 0988 123 456 · MST: 0109887766</div>
              <div style={{ borderBottom: '1px dashed #94a3b8', margin: '8px 0' }} />
              <div style={{ fontSize: 13.5, fontWeight: 800, letterSpacing: 1, textTransform: 'uppercase', color: '#0f172a' }}>PHIẾU THANH TOÁN</div>
              <div style={{ fontSize: 11, color: '#0284c7', fontWeight: 600, marginTop: 2 }}>Số: #{invoiceCode}</div>
              <div style={{ fontSize: 10.5, color: '#64748b' }}>{issueDate}</div>
            </div>

            <div style={{ fontSize: 11.5, marginBottom: 6 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                <span style={{ color: '#64748b' }}>Khách hàng:</span>
                <b>{o.name}</b>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                <span style={{ color: '#64748b' }}>Số điện thoại:</span>
                <span>{o.phone || 'Vãng lai'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                <span style={{ color: '#64748b' }}>Ngày chơi:</span>
                <span>{o.date}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#64748b' }}>Thu ngân:</span>
                <span>{cashierName}</span>
              </div>
            </div>

            <div style={{ borderBottom: '1px dashed #94a3b8', margin: '8px 0' }} />

            <div style={{ fontSize: 11, fontWeight: 700, marginBottom: 6, color: '#334155' }}>CHI TIẾT SÂN & DỊCH VỤ</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {o.slots.map((s, idx) => (
                <div key={s.id || idx}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600 }}>
                    <span>{data.courts.find(c => c.id === s.court)?.name || 'Sân'} ({slotLabel(s)})</span>
                    <span>{money(s.price)}</span>
                  </div>
                  <div style={{ fontSize: 10, color: '#64748b' }}>{slotHours(s) * 60} phút thi đấu</div>
                </div>
              ))}
              {o.staff?.map((s, idx) => (
                <div key={s.id || idx}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600 }}>
                    <span>Trọng tài • {s.name} ({s.hours}h)</span>
                    <span>{money(s.rate * s.hours)}</span>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ borderBottom: '1px dashed #94a3b8', margin: '8px 0' }} />

            <div style={{ fontSize: 11.5 }}>
              {(o.membershipBenefit?.discount > 0 || o.tierBenefit?.discount > 0) && (
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#16a34a', marginBottom: 2 }}>
                  <span>{o.tierBenefit?.planName || o.membershipBenefit?.planName || 'Giảm theo hạng'}:</span>
                  <b>–{money(o.tierBenefit?.discount || o.membershipBenefit?.discount)}</b>
                </div>
              )}
              {o.voucherBenefit?.discount > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#16a34a', marginBottom: 2 }}>
                  <span>Voucher ({o.voucherBenefit.code}):</span>
                  <b>–{money(o.voucherBenefit.discount)}</b>
                </div>
              )}
              {(o.pointsDiscount > 0 || o.pointsRedeemed > 0) && (
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#16a34a', marginBottom: 2 }}>
                  <span>Dùng điểm ({o.pointsRedeemed || Math.round(o.pointsDiscount / 100)} điểm):</span>
                  <b>–{money(o.pointsDiscount || (o.pointsRedeemed * 100))}</b>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: 12.5, marginTop: 4 }}>
                <span>TỔNG CỘNG:</span>
                <span style={{ color: '#173c32' }}>{money(o.total)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 2, color: '#059669' }}>
                <span>Đã thanh toán / cọc:</span>
                <b>{money(o.paid)}</b>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, paddingTop: 4, borderTop: '1px dotted #cbd5e1', fontSize: 12.5, fontWeight: 800 }}>
                <span>CÒN PHẢI THU:</span>
                <span style={{ color: remainingAmount > 0 ? '#b45309' : '#059669' }}>
                  {['CANCELLED', 'EXPIRED'].includes(o.status) ? (labels[o.status] || o.status) : money(remainingAmount)}
                </span>
              </div>
            </div>

            <div style={{ borderBottom: '1px dashed #94a3b8', margin: '10px 0 8px' }} />

            {qrSrc && (
              <div style={{ textAlign: 'center', margin: '6px 0' }}>
                <img src={qrSrc} alt="QR Check-in" style={{ width: 110, height: 110, display: 'inline-block' }} />
                <div style={{ fontSize: 10.5, fontWeight: 700, color: '#173c32', marginTop: 3 }}>MÃ QR CHECK-IN VÀO SÂN</div>
                <div style={{ fontSize: 9.5, color: '#64748b' }}>Xuất trình mã tại quầy lễ tân hoặc cổng tự động</div>
              </div>
            )}

            <div style={{ textAlign: 'center', marginTop: 10, fontSize: 10, color: '#64748b', lineHeight: 1.4 }}>
              <div>Wifi: <b>CourtlyTennis</b> · Pass: <b>666888</b></div>
              <div style={{ marginTop: 2 }}><i>Cảm ơn Quý khách & Chúc trận đấu tuyệt vời!</i></div>
            </div>
          </div>
        </div>
      ) : (
        /* A4 STANDARD INVOICE */
        <div className="printable-invoice-a4" style={{ padding: '8px 4px' }}>
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
              <div style={{ fontSize: 12, color: '#64748b' }}>Thu ngân: {cashierName}</div>
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
              <tr key={s.id || idx}>
                <td>{idx + 1}</td>
                <td><b>{data.courts.find(c => c.id === s.court)?.name}</b> • {slotLabel(s)}</td>
                <td>{slotHours(s) * 60} phút</td>
                <td>{money(s.price)}</td>
                <td className="name">{money(s.price)}</td>
              </tr>
            ))}

            {o.staff?.map((s, idx) => (
              <tr key={s.id || idx}>
                <td>{o.slots.length + idx + 1}</td>
                <td>Dịch vụ trọng tài • {s.name}</td>
                <td>{s.hours} giờ</td>
                <td>{money(s.rate)}/h</td>
                <td className="name">{money(s.rate * s.hours)}</td>
              </tr>
            ))}
          </Table>

          <div style={{ marginTop: 16, borderTop: '1px solid #e2e8f0', paddingTop: 12 }}>
            {(o.membershipBenefit?.discount > 0 || o.tierBenefit?.discount > 0) && (
              <div className="summary-line membership-discount" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span>{o.tierBenefit?.planName || o.membershipBenefit?.planName || 'Giảm theo hạng'}</span>
                <b style={{ color: '#16a34a' }}>–{money(o.tierBenefit?.discount || o.membershipBenefit?.discount)}</b>
              </div>
            )}
            {o.voucherBenefit?.discount > 0 && (
              <div className="summary-line voucher-discount" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span>Voucher ({o.voucherBenefit.code})</span>
                <b style={{ color: '#16a34a' }}>–{money(o.voucherBenefit.discount)}</b>
              </div>
            )}
            {(o.pointsDiscount > 0 || o.pointsRedeemed > 0) && (
              <div className="summary-line points-discount" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span>Dùng điểm ({o.pointsRedeemed || Math.round(o.pointsDiscount / 100)} điểm)</span>
                <b style={{ color: '#16a34a' }}>–{money(o.pointsDiscount || (o.pointsRedeemed * 100))}</b>
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
              <b style={{ color: ['CANCELLED', 'EXPIRED'].includes(o.status) ? '#dc2626' : remainingAmount > 0 ? '#b45309' : '#059669' }}>
                {['CANCELLED', 'EXPIRED'].includes(o.status) ? (labels[o.status] || o.status) : money(remainingAmount)}
              </b>
            </div>
          </div>

          {/* QR Code and Signatures block */}
          <div style={{ display: 'grid', gridTemplateColumns: '180px 1fr 1fr', gap: 20, marginTop: 24, paddingTop: 16, borderTop: '1px solid #e2e8f0', alignItems: 'center' }}>
            <div style={{ textAlign: 'center', borderRight: '1px dashed #cbd5e1', paddingRight: 16 }}>
              {qrSrc && <img src={qrSrc} alt="QR Check-in" style={{ width: 110, height: 110, display: 'inline-block' }} />}
              <div style={{ fontSize: 11, fontWeight: 700, color: '#173c32', marginTop: 4 }}>MÃ QR VÉ VÀO SÂN</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>KHÁCH HÀNG</div>
              <div style={{ fontSize: 11, color: '#64748b', fontStyle: 'italic' }}>(Ký và ghi rõ họ tên)</div>
              <div style={{ height: 60 }} />
              <div style={{ fontSize: 12, fontWeight: 600 }}>{o.name}</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>NGƯỜI LẬP PHIẾU / THU NGÂN</div>
              <div style={{ fontSize: 11, color: '#64748b', fontStyle: 'italic' }}>(Ký và ghi rõ họ tên)</div>
              <div style={{ height: 60 }} />
              <div style={{ fontSize: 12, fontWeight: 600 }}>{cashierName}</div>
            </div>
          </div>

          <div style={{ textAlign: 'center', marginTop: 20, paddingTop: 12, borderTop: '1px dashed #cbd5e1', fontSize: 12, color: '#64748b' }}>
            <i>Cảm ơn Quý khách đã sử dụng dịch vụ tại Courtly Tennis Club! Hẹn gặp lại Quý khách.</i>
          </div>
        </div>
      )}
    </Modal>
  );
}

export function ExtendOrderDialog({id, onClose}) {
  const {data, mutate, notify, show, isAdmin} = useCourtly();
  const o = data.orders.find(x => x.id === id);
  const [loading, setLoading] = useState(true);
  const [extData, setExtData] = useState(null);
  const [error, setError] = useState('');
  const [selectedDuration, setSelectedDuration] = useState(30);
  const [submitting, setSubmitting] = useState(false);
  const [successOpt, setSuccessOpt] = useState(null);

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
      setSuccessOpt(selectedOpt);
    } catch (e) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (successOpt) {
    return (
      <Modal title={`Gia hạn thành công · Đơn #${o.id.slice(0, 8)}`} onClose={onClose}>
        <div style={{ textAlign: 'center', padding: '16px 0' }}>
          <div style={{ width: 50, height: 50, borderRadius: '50%', background: '#f0fdf4', color: '#16a34a', fontSize: 26, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
            ✓
          </div>
          <h2 style={{ fontSize: 18, color: '#173c32', margin: '0 0 6px' }}>Đã gia hạn giờ chơi thành công!</h2>
          <p style={{ fontSize: 14, color: '#475569', margin: 0 }}>
            Thời gian mới: <b>+{successOpt.duration} phút</b> (Đến <b>{successOpt.endTime}</b>)
          </p>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#15803d', margin: '10px 0 16px' }}>
            Phí gia hạn: +{money(successOpt.total)}
          </div>

          <div style={{ background: '#f8fafc', padding: 12, borderRadius: 8, fontSize: 12.5, color: '#64748b', marginBottom: 18, textAlign: 'left', border: '1px solid #e2e8f0', lineHeight: 1.5 }}>
            Khung giờ đã được cập nhật trực tiếp trên lịch sân. Lễ tân có thể thu tiền mặt ngay hoặc để khách chơi tiếp và thu một thể khi làm thủ tục Check-out.
          </div>

          <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
            <Button onClick={onClose}>🏁 Thu khi Check-out & Đóng</Button>
            <Button className="primary" onClick={() => { onClose(); show({ type: 'payment', id: o.id }); }}>
              💵 Thu tiền mặt ngay ({money(successOpt.total)})
            </Button>
          </div>
        </div>
      </Modal>
    );
  }

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
                      {opt.planName && <small style={{display: 'block', color: '#15803d'}}>★ {opt.planName}: −{money(opt.discount)}</small>}
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

export function CheckOutDialog({id, onClose}) {
  const {data, mutate, notify, show, isAdmin} = useCourtly();
  const o = data.orders.find(x => x.id === id);
  const [submitting, setSubmitting] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const [error, setError] = useState('');

  if (!o) return null;

  const breakdown = buildCheckoutBreakdown(o);
  if (!breakdown) return null;

  const {
    courtBase,
    extMinutes,
    extFee,
    tierDiscount,
    tierPlanName,
    voucherDiscount,
    voucherCode,
    pointsDiscount,
    pointsRedeemed,
    refereeFee,
    totalAmount,
    paidAmount,
    remainingDue,
    excessRefund
  } = breakdown;

  const total = totalAmount;
  const paid = paidAmount;
  const due = remainingDue;
  const excess = excessRefund;

  const handleCashCheckOut = async () => {
    setSubmitting(true);
    setError('');
    try {
      if (due > 0) {
        await mutate('/payments', {
          orderId: o.id,
          amount: due,
          method: 'CASH',
          transactionCode: 'CO-' + o.id.slice(0, 8).toUpperCase() + '-' + Date.now().toString(36).toUpperCase(),
          reason: extMinutes > 0 ? `Thu nốt tiền sân & phí gia hạn (${extMinutes}p) khi check-out` : 'Thu nốt tiền sân khi check-out'
        });
      }
      await mutate(`/orders/${o.id}/check-out`, {});
      notify(`🏁 Đã thu đủ ${due > 0 ? money(due) + ' ' : ''}và hoàn tất Check-out cho đơn #${o.id.slice(0, 8)}!`);
      onClose();
    } catch (e) {
      setError(e.message || 'Lỗi khi check-out');
    } finally {
      setSubmitting(false);
    }
  };

  const handlePureCheckOut = async () => {
    setSubmitting(true);
    setError('');
    try {
      await mutate(`/orders/${o.id}/check-out`, {});
      notify(`🏁 Đã Check-out & hoàn tất buổi chơi #${o.id.slice(0, 8)} thành công!`);
      onClose();
    } catch (e) {
      setError(e.message || 'Lỗi khi check-out');
    } finally {
      setSubmitting(false);
    }
  };

  const currentSettings = data.settings || {};
  const qrRef = 'CT' + o.id.replace(/-/g, '').slice(0, 10).toUpperCase();
  const qrUrl = due > 0
    ? `https://img.vietqr.io/image/${currentSettings.bankBin || '970422'}-${currentSettings.accountNumber || '0345678999'}-compact2.png?amount=${due}&addInfo=${encodeURIComponent(qrRef)}&accountName=${encodeURIComponent(currentSettings.accountName || 'CLB TENNIS COURTLY')}`
    : '';

  const courtNames = o.slots?.map(s => data.courts.find(c => c.id === s.court)?.name).filter(Boolean);
  const uniqueCourts = [...new Set(courtNames)].join(', ') || 'Sân tennis';

  return (
    <Modal title={`Thủ tục Check-out & Trả sân · #${o.id.slice(0, 8)}`} onClose={onClose} wide>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, background: '#f8fafc', padding: 14, borderRadius: 8, marginBottom: 16 }}>
        <div>
          <span style={{ fontSize: 12, color: '#64748b' }}>Khách hàng:</span>
          <div style={{ fontWeight: 700, fontSize: 15, color: '#0f172a' }}>{o.name}</div>
          <div style={{ fontSize: 12.5, color: '#475569' }}>{o.phone || 'Khách vãng lai'}</div>
        </div>
        <div>
          <span style={{ fontSize: 12, color: '#64748b' }}>Sân sử dụng:</span>
          <div style={{ fontWeight: 700, fontSize: 15, color: '#173c32' }}>{uniqueCourts}</div>
          <div style={{ fontSize: 12.5, color: '#475569' }}>
            Check-in: <b>{o.checkInAt ? new Date(o.checkInAt).toLocaleTimeString('vi-VN') : 'Đúng giờ'}</b> → Giờ trả sân: <b>{new Date().toLocaleTimeString('vi-VN')}</b>
          </div>
        </div>
      </div>

      {extMinutes > 0 && (
        <div className="notice" style={{ background: '#eff6ff', borderColor: '#bfdbfe', color: '#1e40af', marginBottom: 14 }}>
          ⚡ <b>Lượt chơi có gia hạn thêm giờ:</b> Đã gia hạn <b>+{extMinutes} phút</b> trên sân. Phí gia hạn: <b>+{money(extFee)}</b> đã được cộng vào hóa đơn đối soát.
        </div>
      )}

      {/* Financial Settlement Breakdown */}
      <div style={{ border: '1.5px solid #e2e8f0', borderRadius: 8, padding: '14px 16px', marginBottom: 18 }}>
        <h3 style={{ margin: '0 0 12px', fontSize: 15, color: '#173c32', borderBottom: '1px solid #f1f5f9', paddingBottom: 8 }}>
          Bảng kê đối soát tài chính khi Check-out
        </h3>

        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 13.5 }}>
          <span>Tiền sân ban đầu:</span>
          <b>{money(courtBase)}</b>
        </div>

        {extFee > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 13.5, color: '#2563eb' }}>
            <span>Phí gia hạn thêm giờ (+{extMinutes}p):</span>
            <b>+{money(extFee)}</b>
          </div>
        )}

        {tierDiscount > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 13.5, color: '#16a34a' }}>
            <span>{tierPlanName}:</span>
            <b>–{money(tierDiscount)}</b>
          </div>
        )}
        {voucherDiscount > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 13.5, color: '#16a34a' }}>
            <span>Voucher ({voucherCode || 'Ưu đãi'}):</span>
            <b>–{money(voucherDiscount)}</b>
          </div>
        )}
        {pointsDiscount > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 13.5, color: '#16a34a' }}>
            <span>Dùng điểm ({pointsRedeemed} điểm):</span>
            <b>–{money(pointsDiscount)}</b>
          </div>
        )}
        {refereeFee > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 13.5, color: '#0369a1' }}>
            <span>Phí dịch vụ trọng tài:</span>
            <b>+{money(refereeFee)}</b>
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10, paddingTop: 10, borderTop: '1px dashed #cbd5e1', fontSize: 15, fontWeight: 700 }}>
          <span>Tổng giá trị đơn:</span>
          <b style={{ color: '#0f172a' }}>{money(totalAmount)}</b>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: 14, color: '#059669' }}>
          <span>Đã thanh toán (Cọc / chuyển khoản trước):</span>
          <b>–{money(paidAmount)}</b>
        </div>

        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginTop: 12,
          padding: '10px 14px',
          borderRadius: 6,
          background: due > 0 ? '#fff1f2' : excess > 0 ? '#fffbeb' : '#f0fdf4',
          border: due > 0 ? '1.5px solid #fecdd3' : excess > 0 ? '1.5px solid #fde68a' : '1.5px solid #bbf7d0'
        }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: due > 0 ? '#e11d48' : excess > 0 ? '#b45309' : '#166534' }}>
            {due > 0 ? 'CÒN THIẾU CẦN THU TẠI QUẦY:' : excess > 0 ? 'TIỀN THỪA CẦN HOÀN TRẢ KHÁCH:' : 'TRẠNG THÁI CÔNG NỢ:'}
          </span>
          <b style={{ fontSize: 18, color: due > 0 ? '#e11d48' : excess > 0 ? '#b45309' : '#166534' }}>
            {due > 0 ? money(due) : excess > 0 ? money(excess) : 'ĐÃ THANH TOÁN ĐỦ 100%'}
          </b>
        </div>
      </div>

      {error && <div className="error" role="alert" style={{ marginBottom: 14 }}>{error}</div>}

      {showQR && due > 0 && (
        <div style={{ background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: 8, padding: 14, textAlign: 'center', marginBottom: 16 }}>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4, color: '#173c32' }}>
            Mã VietQR chuyển khoản thanh toán Check-out
          </div>
          <div style={{ fontSize: 12.5, color: '#64748b', marginBottom: 10 }}>
            Số tiền: <b>{money(due)}</b> • Nội dung: <b>{qrRef}</b>
          </div>
          <img src={qrUrl} alt="VietQR" style={{ maxWidth: 220, borderRadius: 8, border: '1px solid #e2e8f0', margin: '0 auto', display: 'block' }} />
          <div style={{ marginTop: 12 }}>
            <Button className="primary" disabled={submitting} onClick={handleCashCheckOut}>
              {submitting ? 'Đang hoàn tất…' : `✓ Khách đã chuyển khoản xong • Xác nhận Check-out`}
            </Button>
          </div>
        </div>
      )}

      {due > 0 && (
        <div style={{ background: '#fff1f2', border: '1.5px solid #fecdd3', borderRadius: 8, padding: '12px 14px', marginBottom: 16, color: '#9f1239', fontSize: 13, lineHeight: 1.5 }}>
          <strong>⚠️ ĐƠN HÀNG CHƯA THANH TOÁN ĐỦ (CÒN THIẾU {money(due)}):</strong>
          <div style={{ marginTop: 4, color: '#be123c' }}>
            Quy định CLB yêu cầu phải thu đủ 100% tiền sân & chi phí phát sinh trước khi làm thủ tục Check-out. Vui lòng thu tiền mặt tại quầy hoặc mở mã VietQR để khách chuyển khoản trước khi hoàn tất.
          </div>
        </div>
      )}

      {/* Action Footer */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, flexWrap: 'wrap', paddingTop: 12, borderTop: '1px solid #e2e8f0' }}>
        <Button disabled={submitting} onClick={onClose}>Đóng / Chờ thu tiền</Button>

        {due > 0 && (
          <>
            <Button disabled={submitting} onClick={() => setShowQR(!showQR)}>
              📱 {showQR ? 'Ẩn mã QR' : 'Mở mã VietQR chuyển khoản'}
            </Button>
            <Button className="primary" disabled={submitting} onClick={handleCashCheckOut} style={{ background: '#16a34a', borderColor: '#15803d', fontWeight: 700 }}>
              {submitting ? 'Đang xử lý…' : `💵 Thu đủ tiền mặt ${money(due)} & Hoàn tất Check-out`}
            </Button>
          </>
        )}

        {due === 0 && excess === 0 && (
          <Button className="primary" disabled={submitting} onClick={handlePureCheckOut} style={{ background: '#173c32', borderColor: '#173c32', fontWeight: 700 }}>
            {submitting ? 'Đang check-out…' : '🏁 Đã thanh toán đủ • Xác nhận Check-out & Giải phóng sân'}
          </Button>
        )}

        {excess > 0 && (
          <>
            {isAdmin ? (
              <Button className="primary" style={{ background: '#e11d48', borderColor: '#be123c' }} onClick={() => { onClose(); show({ type: 'refund', orderId: o.id }); }}>
                💳 Hoàn trả tiền thừa ({money(excess)})
              </Button>
            ) : (
              <span style={{ fontSize: 12, fontWeight: 700, color: '#b45309', background: '#fef3c7', padding: '6px 10px', borderRadius: 6, border: '1px solid #fde68a' }}>
                Chờ Admin duyệt hoàn tiền thừa ({money(excess)})
              </span>
            )}
            <Button className="primary" disabled={submitting} onClick={handlePureCheckOut}>
              {submitting ? 'Đang check-out…' : 'Xác nhận Check-out'}
            </Button>
          </>
        )}
      </div>
    </Modal>
  );
}