import {slotLabel,slotHours,hourLabel} from '../utils/format';
import React from 'react';
import {useCourtly} from '../context';
import {Modal,FormDialog,Button,Table} from './UI';
import ServicesDialog from './ServicesDialog';
import MoveDialog from './MoveDialog';
import EntityDialog from './EntityDialog';
import {BookingDialog,OrderDetail,OrderActionDialog,PaymentDialog,RefundDialog,InvoiceDialog} from './OrderDialogs';
import {TournamentDetail,TournamentActionDialog,MatchDetail,MatchActionDialog} from './TournamentDialogs';
import OrderTable from './OrderTable';
import {money,labels,localDate} from '../utils/format';
export default function DialogHost({dialog,onClose}){
 const {data,date,mutate,notify}=useCourtly();if(!dialog)return null;
 const p={...dialog,onClose};
 switch(dialog.type){
  case 'legacy-staff':{const order=data.orders.find(o=>o.id===dialog.id),line=order.staff.find(x=>x.id===dialog.lineId);return <FormDialog title="Xác minh phân công cũ — giữ ID và giá" initial={{requestId:crypto.randomUUID(),reason:''}} fields={[...Array.from({length:line.hours},(_,i)=>({name:'slot'+i,label:'Slot phục vụ '+(i+1),options:[{value:'',label:'Chọn slot thực tế'},...order.slots.map(s=>({value:s.id,label:`${data.courts.find(c=>c.id===s.court)?.name} ${slotLabel(s)}`}))]})),{name:'reason',label:'Căn cứ xác minh tại quầy',full:true}]} onClose={onClose} onSubmit={async v=>{await mutate(`/orders/${dialog.id}/legacy-staff`,{lineId:line.id,scheduleIds:Array.from({length:line.hours},(_,i)=>v['slot'+i]),reason:v.reason,requestId:v.requestId});notify('Đã xác minh, giữ nguyên ID và giá lịch sử');onClose();}}><p className="notice">{line.name} · {line.hours} giờ · giá lịch sử {money(line.rate)}/giờ. Chỉ chọn khi có căn cứ thực tế; hệ thống kiểm tra lịch làm việc và trùng giờ. Nếu chưa đủ dữ liệu, đóng và giữ nhãn cần kiểm tra.</p></FormDialog>;}
  case 'restore':return <MoveDialog {...p} mode="restore"/>;
  case 'check-in':return <FormDialog title="Kiểm tra check-in" fields={[{name:'reason',label:'Lý do ngoại lệ (nếu ngoài giờ cấu hình hoặc thiếu cọc)',required:false,full:true}]} onClose={onClose} submitText="Check-in" onSubmit={async v=>{await mutate(`/orders/${dialog.id}/check-in`,v);notify('Đã check-in');onClose();}}><p className="notice">Giờ check-in sớm: {data.settings.policies?.checkInEarlyMinutes??'chưa cấu hình'} phút. Ngoài cửa sổ giờ hoặc chưa đủ cọc cần lý do ngoại lệ.</p></FormDialog>;
  case 'equipment-return':return <FormDialog title="Nhận trả & xử lý thiết bị" initial={{requestId:crypto.randomUUID(),condition:'GOOD',reason:''}} fields={[{name:'condition',label:'Tình trạng thực tế',options:[{value:'GOOD',label:'Đã nhận đủ, tình trạng tốt'},{value:'DAMAGED',label:'Đã nhận, bị hỏng — cách ly'},{value:'MISSING',label:'Thiếu / chưa trả'},{value:'READY',label:'Đã xử lý, xác nhận sẵn sàng trở lại'}]},{name:'reason',label:'Ghi chú (bắt buộc khi cần xử lý)',required:false,full:true}]} onClose={onClose} onSubmit={async v=>{await mutate(`/orders/${dialog.id}/products/${dialog.lineId}/return`,v);notify('Đã ghi tình trạng thiết bị');onClose();}}><p>Không tự tính phí mất/hỏng. Chỉ xác nhận sẵn sàng sau khi nhận đủ và kiểm tra thực tế.</p></FormDialog>;
  case 'financial-review':return <FormDialog title="Đối chiếu tiền" initial={{requestId:crypto.randomUUID(),action:'review',amount:0,reason:''}} fields={[{name:'action',label:'Xử lý',options:[{value:'review',label:'Ghi nhận đã đối chiếu'},{value:'refund-request',label:'Duyệt khoản cần hoàn, chờ thực hiện'}]},{name:'amount',label:'Số tiền hoàn dự kiến (nếu duyệt hoàn)',type:'number',min:0},{name:'reason',label:'Kết quả đối chiếu / cơ sở quyết định',full:true}]} onClose={onClose} onSubmit={async v=>{await mutate(`/orders/${dialog.id}/${v.action}`,{...v,resolved:true});notify('Đã ghi kết quả đối chiếu');onClose();}}><p className="notice">Không khôi phục lịch tự động. Khoản hoàn chỉ ghi là đã hoàn sau khi thực hiện và ghi nhận tại Thu tiền & hoàn tiền.</p></FormDialog>;
  case 'services':return <ServicesDialog {...p}/>;
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
  case 'settings':return <FormDialog title="Chính sách giữ chỗ" initial={{...data.settings,...data.settings.policies}} fields={[{name:'holdMinutes',label:'Thời gian giữ (phút)',type:'number',min:1,max:60},{name:'depositPercent',label:'Tiền cọc (%)',type:'number',min:1,max:100},{name:'cancelRefundPercent',label:'Tỷ lệ tham khảo cũ (%) — không tự áp dụng',type:'number',min:0,max:100,full:true},...['cancelCutoffMinutes','changeCutoffMinutes','checkInEarlyMinutes','additionalPaymentMinutes'].map((key,i)=>({name:key,label:['Hạn hủy trước giờ chơi (phút)','Hạn đổi trước giờ chơi (phút)','Cho check-in sớm (phút)','Hạn thu thêm sau đổi lịch (phút)'][i],type:'number',min:0,max:10080,required:false})),...['lateCancellation','noShow','closureWeather'].map((key,i)=>({name:key,label:['Hủy sát giờ: hướng dẫn xử lý','Khách không đến: hướng dẫn xử lý','Sân đóng / thời tiết / bảo trì: hướng dẫn'][i],type:'textarea',full:true,required:false}))]} onClose={onClose} onSubmit={async v=>{await mutate('/settings',{...v,policies:Object.fromEntries(['cancelCutoffMinutes','changeCutoffMinutes','checkInEarlyMinutes','additionalPaymentMinutes','lateCancellation','noShow','closureWeather'].map(k=>[k,v[k]??null]))},'PUT');notify('Đã lưu chính sách');onClose();}}/>;
  case 'closing':{
   const rows=data.payments.filter(p=>localDate(p.createdAt)===date),refund=data.refunds.filter(r=>localDate(r.createdAt)===date).reduce((a,r)=>a+r.amount,0),total=rows.reduce((a,p)=>a+p.amount,0);
   return <Modal title={`Đối chiếu ca · ${date}`} onClose={onClose} footer={<Button className="primary" onClick={()=>window.print()}>In / Lưu PDF</Button>}><Table headings={['Giao dịch','Phương thức','Tiền thu']} empty={!rows.length}>{rows.map(p=><tr key={p.id}><td>{p.id.slice(0,8)}</td><td>{labels[p.method]}</td><td>{money(p.amount)}</td></tr>)}</Table><div className="summary-line"><span>Tổng thu</span><b>{money(total)}</b></div><div className="summary-line"><span>Đã hoàn</span><b>{money(refund)}</b></div><div className="summary-line total"><span>Thu ròng</span><b>{money(total-refund)}</b></div></Modal>;
  }
  default:return null;
 }
}
