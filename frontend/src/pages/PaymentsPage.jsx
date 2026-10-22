import React,{useState} from 'react';
import {Wallet, RefreshCw, Trophy, ChartColumn} from 'lucide-react';
import {useCourtly} from '../context';
import {Title, Stat, Panel, Table, Chip, Button, Tabs} from '../components/UI';
import {money,labels,localDate,dateLabel} from '../utils/format';

export default function PaymentsPage(){
 const {data,show,date,setDate}=useCourtly(); const [tab,setTab]=useState('transactions');
 const income=data.payments.reduce((a,p)=>a+p.amount,0),refund=data.refunds.reduce((a,p)=>a+p.amount,0),fee=data.payments.filter(p=>p.registrationId).reduce((a,p)=>a+p.amount,0);
 const inDay=data.payments.filter(p=>localDate(p.createdAt)===date);

 return <><Title subtitle="Tiền mặt, chuyển khoản VietQR và lịch sử khoản hoàn." action={<Button className="primary" onClick={()=>show({type:'payment'})}>Thu tiền tại quầy</Button>}>Thu tiền & hoàn tiền</Title>
 <div className="stats">
   <Stat title="Tổng đã thu" value={money(income)} note="Toàn bộ giao dịch" icon={Wallet}/>
   <Stat title="Tổng đã hoàn" value={money(refund)} note="Khoản hoàn ghi nhận" icon={RefreshCw}/>
   <Stat title="Thu phí giải" value={money(fee)} note="Theo đăng ký giải" icon={Trophy}/>
   <Stat title="Thu ròng" value={money(income-refund)} note="Thu trừ hoàn" icon={ChartColumn}/>
 </div>
 <Tabs options={[["transactions","Giao dịch"],["refunds","Hoàn tiền"],["closing","Đối chiếu ca"]]} value={tab} onChange={setTab}/>
 <Panel title={tab==='refunds'?'Lịch sử hoàn tiền':tab==='closing'?'Đối chiếu cuối ngày':'Lịch sử giao dịch'} action={tab==='closing'&&<div className="tools"><input aria-label="Ngày đối chiếu" type="date" value={date} onChange={e=>e.target.value&&setDate(e.target.value)}/><Button className="sm" onClick={()=>show({type:'closing'})}>In đối chiếu</Button></div>}>
 {tab==='transactions'&&<Table headings={['Giao dịch','Đơn / Đăng ký','Loại thu','Phương thức','Số tiền','']} empty={!data.payments.length}>{data.payments.map(p=><tr key={p.id}><td>{p.id.slice(0,8)}<small>{new Date(p.createdAt||p.paidAt).toLocaleString('vi-VN')}</small></td><td>{(p.orderId||p.registrationId||'').slice(0,8)}</td><td><Chip status={p.type}/></td><td>{labels[p.method]||p.method}</td><td className="name">{money(p.amount)}</td><td><Button className="sm" disabled={p.refundable<=0} onClick={()=>show({type:'refund',id:p.id})}>Hoàn tiền</Button></td></tr>)}</Table>}
 {tab==='refunds'&&<Table headings={['Mã hoàn','Giao dịch','Số tiền','Lý do','Thời điểm']} empty={!data.refunds.length}>{data.refunds.map(r=><tr key={r.id}><td>{r.id.slice(0,8)}</td><td>{r.paymentId.slice(0,8)}</td><td>{money(r.amount)}</td><td>{r.reason}</td><td>{new Date(r.createdAt).toLocaleString('vi-VN')}</td></tr>)}</Table>}
 {tab==='closing'&&<div className="panel-body"><p className="subtitle">{dateLabel(date)}</p>{['CASH','BANK_TRANSFER'].map(m=><div className="summary-line" key={m}><span>{labels[m]||m} • {inDay.filter(p=>p.method===m).length} giao dịch</span><b>{money(inDay.filter(p=>p.method===m).reduce((a,p)=>a+p.amount,0))}</b></div>)}<div className="summary-line"><span>Đã hoàn trong ngày</span><b>{money(data.refunds.filter(r=>localDate(r.createdAt)===date).reduce((a,r)=>a+r.amount,0))}</b></div><div className="notice">Báo cáo đối chiếu tổng hợp doanh thu theo ngày.</div></div>}
 </Panel>
 <div className="notice" style={{marginTop:20,background:'#e8f5e9',borderColor:'#a5d6a7',color:'#1b5e20'}}>
   ✓ <b>Hệ thống VietQR Napas 24/7 (MB Bank) và Webhook SePay đang hoạt động.</b> Mã QR chuẩn ngân hàng được tạo tự động cho từng đơn hàng với nội dung đối soát riêng biệt.
 </div></>;
}
