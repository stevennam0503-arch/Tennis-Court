import React from 'react';
import {useCourtly} from '../context';
import {Modal,FormDialog,Button,Table} from './UI';
import EntityDialog from './EntityDialog';
import {BookingDialog,OrderDetail,OrderActionDialog,PaymentDialog,RefundDialog,InvoiceDialog} from './OrderDialogs';
import {TournamentDetail,TournamentActionDialog,MatchDetail,MatchActionDialog} from './TournamentDialogs';
import OrderTable from './OrderTable';
import {money,labels,localDate} from '../utils/format';
export default function DialogHost({dialog,onClose}){
 const {data,date,mutate,notify}=useCourtly();if(!dialog)return null;
 const p={...dialog,onClose};
 switch(dialog.type){
  case 'entity':return <EntityDialog {...p}/>;
  case 'booking':return <BookingDialog {...p}/>;
  case 'order':return <OrderDetail {...p}/>;
  case 'cancel':case 'move':case 'add-product':case 'assign-staff':return <OrderActionDialog {...p}/>;
  case 'payment':return <PaymentDialog {...p}/>;
  case 'refund':return <RefundDialog {...p}/>;
  case 'invoice':return <InvoiceDialog {...p}/>;
  case 'tournament':return <TournamentDetail {...p}/>;
  case 'registration':case 'draw':return <TournamentActionDialog {...p}/>;
  case 'match':return <MatchDetail {...p}/>;
  case 'match-schedule':case 'match-result':return <MatchActionDialog {...p}/>;
  case 'customer-history':return <Modal title={`Lịch sử · ${data.accounts.find(a=>a.id===dialog.id)?.name}`} onClose={onClose} wide><OrderTable orders={data.orders.filter(o=>o.accountId===dialog.id)}/></Modal>;
  case 'settings':return <FormDialog title="Chính sách giữ chỗ" initial={data.settings} fields={[{name:'holdMinutes',label:'Thời gian giữ (phút)',type:'number',min:1,max:60},{name:'depositPercent',label:'Tiền cọc (%)',type:'number',min:1,max:100},{name:'cancelRefundPercent',label:'Tỷ lệ hoàn tham khảo (%)',type:'number',min:0,max:100,full:true}]} onClose={onClose} onSubmit={async v=>{await mutate('/settings',v,'PUT');notify('Đã lưu chính sách');onClose();}}/>;
  case 'closing':{
   const rows=data.payments.filter(p=>localDate(p.createdAt)===date),refund=data.refunds.filter(r=>localDate(r.createdAt)===date).reduce((a,r)=>a+r.amount,0),total=rows.reduce((a,p)=>a+p.amount,0);
   return <Modal title={`Đối chiếu ca · ${date}`} onClose={onClose} footer={<Button className="primary" onClick={()=>window.print()}>In / Lưu PDF</Button>}><Table headings={['Giao dịch','Phương thức','Tiền thu']} empty={!rows.length}>{rows.map(p=><tr key={p.id}><td>{p.id.slice(0,8)}</td><td>{labels[p.method]}</td><td>{money(p.amount)}</td></tr>)}</Table><div className="summary-line"><span>Tổng thu</span><b>{money(total)}</b></div><div className="summary-line"><span>Đã hoàn</span><b>{money(refund)}</b></div><div className="summary-line total"><span>Thu ròng</span><b>{money(total-refund)}</b></div></Modal>;
  }
  default:return null;
 }
}
