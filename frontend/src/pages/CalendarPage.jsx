import React, { useEffect, useState } from 'react';
import { Wallet, CalendarDays, Users, Grid2X2, Plus, RefreshCw } from 'lucide-react';
import { useCourtly } from '../context';
import { Title, Stat, Panel, Button } from '../components/UI';
import OrderTable from '../components/OrderTable';
import { active, money, localDate, today, labels } from '../utils/format';
export default function CalendarPage() {
  const { data, date, setDate, show, refresh, notify } = useCourtly();
  const [selected,setSelected] = useState([]);
  useEffect(()=>setSelected([]),[date]);
  const orders=data.orders.filter(o=>o.date===date);
  const occupied=data.schedules.filter(s=>s.status!=='AVAILABLE').length;
  const income=data.payments.filter(p=>p.orderId && localDate(p.createdAt)===date).reduce((a,p)=>a+p.amount,0)-data.refunds.filter(r=>localDate(r.createdAt)===date && data.payments.find(p=>p.id===r.paymentId)?.orderId).reduce((a,r)=>a+r.amount,0);
  const choose = id => setSelected(previous=>previous.includes(id)?previous.filter(x=>x!==id):[...previous,id]);
  const create = () => { if(!selected.length) return notify('Chọn các khung giờ trống trước.'); show({type:'booking',scheduleIds:selected,onCreated:()=>setSelected([])}); };
  return <><Title subtitle="Theo dõi lịch và đặt sân trong một màn hình." action={<Button className="primary" onClick={create}><Plus size={17}/>Tạo đơn đặt sân</Button>}>Lịch sân</Title><div className="stats"><Stat title="Tiền thu từ đơn sân" value={money(income)} note="Trong ngày · đã trừ hoàn" icon={Wallet}/><Stat title="Đơn đặt sân" value={orders.length} note="Ngày đang xem" icon={CalendarDays}/><Stat title="Công suất sân" value={`${Math.round(occupied/Math.max(1,data.courts.filter(c=>c.status==='ACTIVE').length*17)*100)}%`} note={`${occupied} khung giờ đã giữ/đặt`} icon={Grid2X2}/><Stat title="Khách đang chơi" value={orders.filter(o=>o.status==='CHECKED_IN').length} note="Đơn đã check-in" icon={Users}/></div>
    <Panel title="Lịch sử dụng sân" action={<div className="tools"><Button className="sm" onClick={()=>setDate(today())}>Hôm nay</Button><input type="date" aria-label="Ngày xem lịch" value={date} onChange={e=>{if(e.target.value)setDate(e.target.value);}}/><Button className="sm" aria-label="Cập nhật" onClick={()=>refresh().catch(e=>notify(e.message))}><RefreshCw size={16}/></Button></div>}>
      <div className="panel-body" style={{paddingTop:14,paddingBottom:14}}><div className="legend">{[['#d9e6da','Còn trống'],['#83b599','Đã đặt'],['#ebc66c','Giữ chỗ'],['#b6a1d9','Thi đấu'],['#cfd5cf','Bảo trì']].map(([color,text])=><span key={text}><i style={{background:color}}/>{text}</span>)}</div></div>
      <div className="schedule-scroll" style={{maxHeight:620}}><div className="schedule" style={{'--cols':Math.max(1,data.courts.length)}}><div className="court-head">Giờ</div>{data.courts.map(c=><div className="court-head" key={c.id}>{c.name}<small>{labels[c.type]}</small></div>)}
        {Array.from({length:17},(_,i)=>i+6).map(hour=><React.Fragment key={hour}><div className="time-cell">{String(hour).padStart(2,'0')}:00</div>{data.courts.map(c=>{
          const slot=data.schedules.find(s=>s.court===c.id&&s.hour===hour);
          const order=orders.find(o=>active(o)&&o.slots.some(s=>s.id===slot?.id));
          const match=data.matches.find(m=>!['FINISHED','CANCELLED'].includes(m.status)&&m.slots.some(s=>s.id===slot?.id));
          const disabled=c.status!=='ACTIVE'||!slot;
          const status=disabled?'maintenance':selected.includes(slot.id)?'selected':slot.status==='LOCKED'?'holding':slot.status==='BOOKED'?'booked':slot.status==='IN_MATCH'?'match':'available';
          return <div className="slot-wrap" key={c.id}><button className={`slot ${status}`} disabled={disabled} aria-pressed={!!slot&&selected.includes(slot.id)} aria-label={`${c.name} ${hour} giờ`} onClick={()=>order?show({type:'order',id:order.id}):match?show({type:'match',id:match.id}):slot.status==='AVAILABLE'?choose(slot.id):refresh()}><span>{disabled?labels[c.status]:order?.name||match?.roundName||(selected.includes(slot.id)?'Đã chọn':labels[slot.status])}</span><small>{disabled?'Tạm ngừng':order?labels[order.status]:match?'Lịch thi đấu':money(slot.price)+'/giờ'}</small></button></div>;
        })}</React.Fragment>)}
      </div></div><div className="schedule-foot"><span>{selected.length ? `${selected.length} khung giờ · ${money(data.schedules.filter(s=>selected.includes(s.id)).reduce((a,s)=>a+s.price,0))}` : 'Chọn một hoặc nhiều khung giờ trống để đặt sân.'}</span><div className="tools">{!!selected.length&&<Button className="sm" onClick={()=>setSelected([])}>Bỏ chọn</Button>}<Button className="primary sm" onClick={create}>Đặt khung giờ đã chọn</Button></div></div>
    </Panel><div className="bottom-grid"><Panel title="Đơn trong ngày"><OrderTable orders={orders.slice(0,5)}/></Panel><Panel title="Cần chú ý"><div className="panel-body"><div className="activity"><div><p>{data.orders.filter(o=>o.status==='HOLDING').length} đơn đang giữ chỗ</p><small>Tự nhả sau {data.settings.holdMinutes} phút nếu chưa đủ cọc.</small></div></div><div className="activity"><div><p>{data.products.filter(p=>p.stock<10).length} sản phẩm tồn thấp</p><small>Kiểm tra hàng bán và thiết bị trước khi nhận đơn.</small></div></div><div className="activity"><div><p>{data.tournaments.filter(t=>t.status==='OPEN').length} giải mở đăng ký</p><small>Phí giải được theo dõi riêng.</small></div></div></div></Panel></div>
  </>;
}
