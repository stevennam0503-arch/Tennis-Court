import React from 'react';
import {Wallet,Trophy,Check,Clock} from 'lucide-react';
import {useCourtly} from '../context';
import {Title,Stat,Panel,Button} from '../components/UI';
import {money,labels} from '../utils/format';
export default function ReportsPage(){
 const {data,date,setDate}=useCourtly();
 const valid=data.orders.filter(o=>!['CANCELLED','EXPIRED'].includes(o.status));
 const income=key=>data.payments.filter(p=>p[key]).reduce((a,p)=>a+p.amount,0)-data.refunds.filter(r=>data.payments.find(p=>p.id===r.paymentId)?.[key]).reduce((a,r)=>a+r.amount,0);
 const categories=[['Tiền sân',valid.flatMap(o=>o.slots).reduce((a,s)=>a+s.price,0)],['Đồ uống',valid.flatMap(o=>o.products).filter(p=>p.type==='DRINK').reduce((a,p)=>a+p.lineTotal,0)],['Đồ thuê',valid.flatMap(o=>o.products).filter(p=>p.type==='RENTAL').reduce((a,p)=>a+p.lineTotal,0)],['Nhân sự',valid.flatMap(o=>o.staff).reduce((a,s)=>a+s.hours*s.rate,0)]];
 const max=Math.max(1,...categories.map(x=>x[1]));
 const exportCsv=()=>{
  const escape=v=>'"'+String(v).replace(/^[=+@-]/,"'").replaceAll('"','""')+'"';
  const rows=[['Mã đơn','Khách hàng','Ngày','Trạng thái','Tổng tiền','Đã thu'],...data.orders.map(o=>[o.id,o.name,o.date,labels[o.status],o.total,o.paid])];
  const url=URL.createObjectURL(new Blob(['\ufeff'+rows.map(r=>r.map(escape).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download='bao-cao-courtly.csv';a.click();URL.revokeObjectURL(url);
 };
 return <><Title subtitle="Tiền đã thu và giá trị dịch vụ trên đơn." action={<Button onClick={exportCsv}>Xuất CSV</Button>}>Báo cáo</Title><div className="stats"><Stat title="Thu ròng từ đơn sân" value={money(income('orderId'))} note="Gồm dịch vụ trên đơn" icon={Wallet}/><Stat title="Thu ròng phí giải" value={money(income('registrationId'))} note="Tách khỏi đơn sân" icon={Trophy}/><Stat title="Đơn hoàn tất" value={data.orders.filter(o=>o.status==='COMPLETED').length} note="Đã thanh toán và check-out" icon={Check}/><Stat title="Còn phải thu" value={money(valid.reduce((a,o)=>a+o.total-o.paid,0))} note="Loại đơn hủy và hết hạn" icon={Clock}/></div><div className="split"><Panel title="Giá trị dịch vụ trên đơn"><div className="panel-body">{categories.map(([name,value])=><div className="bar-row" key={name}><span>{name}</span><div className="bar"><b style={{width:`${value/max*100}%`}}/></div><b>{money(value)}</b></div>)}<small>Giá trị đơn chưa đồng nghĩa với tiền đã thu.</small></div></Panel><Panel title="Công suất theo sân"><div className="panel-body"><div className="tools"><input type="date" aria-label="Ngày báo cáo" value={date} onChange={e=>e.target.value&&setDate(e.target.value)}/></div>{data.courts.map(c=>{const used=data.orders.filter(o=>o.date===date&&!['CANCELLED','EXPIRED'].includes(o.status)).flatMap(o=>o.slots).filter(s=>s.court===c.id).length+data.matches.filter(m=>m.date===date&&m.status!=='CANCELLED').flatMap(m=>m.slots).filter(s=>s.court===c.id).length;return <div className="bar-row" key={c.id}><span>{c.name}</span><div className="bar"><b style={{width:`${Math.min(100,used/17*100)}%`}}/></div><b>{Math.round(used/17*100)}%</b></div>;})}<small>Cơ sở 17 khung giờ/sân/ngày; gồm giờ đã phục vụ.</small></div></Panel></div></>;
}
