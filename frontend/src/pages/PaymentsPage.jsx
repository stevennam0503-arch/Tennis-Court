import React,{useState,useEffect} from 'react';
import {Wallet, RefreshCw, Trophy, ChartColumn, Users} from 'lucide-react';
import {useCourtly} from '../context';
import {Title, Stat, Panel, Table, Chip, Button, Tabs} from '../components/UI';
import {money,labels,localDate,dateLabel} from '../utils/format';

export default function PaymentsPage(){
 const {data,show,date,setDate}=useCourtly(); const [tab,setTab]=useState('transactions');
 const [payConfig,setPayConfig]=useState(null);
 useEffect(()=>{fetch('/api/public/payment-config').then(r=>r.ok?r.json():null).then(d=>d&&setPayConfig(d)).catch(()=>{});},[]);

 const memPayments = (data.membershipPayments || []).map(m => ({
   ...m,
   id: m.id,
   orderId: m.membershipId || '',
   type: 'MEMBERSHIP_FEE',
   refundable: 0,
   createdAt: m.createdAt,
   paidAt: m.createdAt,
   isMembership: true
 }));
 const allPayments = [...data.payments, ...memPayments].sort((a,b) => new Date(b.createdAt||b.paidAt) - new Date(a.createdAt||a.paidAt));

 const income = allPayments.reduce((a,p)=>a+p.amount,0);
 const refund = data.refunds.reduce((a,p)=>a+p.amount,0);
 const memTotal = memPayments.reduce((a,p)=>a+p.amount,0);
 const inDay = allPayments.filter(p=>localDate(p.createdAt||p.paidAt)===date);

 return <><Title subtitle="Tiền mặt, chuyển khoản VietQR và lịch sử khoản hoàn." action={<Button className="primary" onClick={()=>show({type:'payment'})}>Thu tiền tại quầy</Button>}>Thu tiền & hoàn tiền</Title>
 <div className="stats">
   <Stat title="Tổng đã thu" value={money(income)} note="Toàn bộ sân, giải & hội viên" icon={Wallet}/>
   <Stat title="Tổng đã hoàn" value={money(refund)} note="Khoản hoàn ghi nhận" icon={RefreshCw}/>
   <Stat title="Thu phí hội viên" value={money(memTotal)} note="Gói Club & Plus" icon={Users}/>
   <Stat title="Thu ròng" value={money(income-refund)} note="Thu trừ hoàn" icon={ChartColumn}/>
 </div>
 <Tabs options={[["transactions","Giao dịch"],["refunds","Hoàn tiền"],["closing","Đối chiếu ca"]]} value={tab} onChange={setTab}/>
 <Panel title={tab==='refunds'?'Lịch sử hoàn tiền':tab==='closing'?'Đối chiếu cuối ngày':'Lịch sử giao dịch'} action={tab==='closing'&&<div className="tools"><input aria-label="Ngày đối chiếu" type="date" value={date} onChange={e=>e.target.value&&setDate(e.target.value)}/><Button className="sm" onClick={()=>show({type:'closing'})}>In đối chiếu</Button></div>}>
 {tab==='transactions'&&<Table headings={['Giao dịch','Đơn / Đăng ký','Loại thu','Phương thức','Số tiền','']} empty={!allPayments.length}>{allPayments.map(p=><tr key={p.id}><td>{p.id.slice(0,8)}<small>{new Date(p.createdAt||p.paidAt).toLocaleString('vi-VN')}</small></td><td>{p.isMembership ? (p.planName ? `Gói ${p.planName}` : 'Hội viên') : (p.orderId||p.registrationId||'').slice(0,8)}</td><td><Chip status={p.type}/></td><td>{labels[p.method]||p.method}</td><td className="name">{money(p.amount)}</td><td><Button className="sm" disabled={p.refundable<=0} onClick={()=>show({type:'refund',id:p.id})}>Hoàn tiền</Button></td></tr>)}</Table>}
 {tab==='refunds'&&<Table headings={['Mã hoàn','Giao dịch','Số tiền','Lý do','Thời điểm']} empty={!data.refunds.length}>{data.refunds.map(r=><tr key={r.id}><td>{r.id.slice(0,8)}</td><td>{r.paymentId.slice(0,8)}</td><td>{money(r.amount)}</td><td>{r.reason}</td><td>{new Date(r.createdAt).toLocaleString('vi-VN')}</td></tr>)}</Table>}
 {tab==='closing'&&<div className="panel-body"><p className="subtitle">{dateLabel(date)}</p>{['CASH','BANK_TRANSFER'].map(m=><div className="summary-line" key={m}><span>{labels[m]||m} • {inDay.filter(p=>p.method===m).length} giao dịch</span><b>{money(inDay.filter(p=>p.method===m).reduce((a,p)=>a+p.amount,0))}</b></div>)}<div className="summary-line"><span>Đã hoàn trong ngày</span><b>{money(data.refunds.filter(r=>localDate(r.createdAt)===date).reduce((a,r)=>a+r.amount,0))}</b></div><div className="notice">Báo cáo đối chiếu tổng hợp doanh thu theo ngày (đã bao gồm tiền mặt & chuyển khoản sân bãi, giải đấu và hội viên).</div></div>}
 </Panel>
 <div className="notice" style={{marginTop:20,background:payConfig?.mode==='LIVE'?'#e8f5e9':'#eff6ff',borderColor:payConfig?.mode==='LIVE'?'#a5d6a7':'#bfdbfe',color:payConfig?.mode==='LIVE'?'#1b5e20':'#1e40af'}}>
   {payConfig?.mode === 'LIVE' ? (
     <>✓ <b>Cổng thanh toán VietQR Napas 24/7 ({payConfig.bankName || 'MB Bank'}) đang hoạt động [LIVE].</b> Tự động khớp lệnh qua webhook SePay.</>
   ) : payConfig?.mode === 'SANDBOX' ? (
     <>⚡ <b>Chế độ Sandbox thử nghiệm ({payConfig?.bankName || 'MB Bank'}).</b> Webhook mô phỏng đang bật để kiểm thử đối soát giao dịch.</>
   ) : (
     <>ℹ <b>Chế độ Demo nội bộ ({payConfig?.bankName || 'MB Bank'}).</b> Hỗ trợ mô phỏng thanh toán chuyển khoản và thu tiền mặt tại quầy.</>
   )}
 </div></>;
}
