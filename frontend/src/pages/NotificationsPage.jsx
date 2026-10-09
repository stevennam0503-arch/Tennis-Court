import React from 'react';
import {useCourtly} from '../context';
import {Title,Panel,Button} from '../components/UI';
import {today,money} from '../utils/format';
export default function NotificationsPage(){
 const {data,show}=useCourtly();const holds=data.orders.filter(o=>o.status==='HOLDING'),soon=data.orders.filter(o=>o.date===today()&&o.status==='CONFIRMED'),low=data.products.filter(p=>p.stock<10);
 return <><Title subtitle="Nhắc việc trong website khi bạn mở trang.">Thông báo</Title><Panel title="Việc cần xử lý"><div className="panel-body">{holds.map(o=><div className="activity" key={o.id}><div><p>{o.name} · chờ cọc {money(Math.max(0,o.deposit-o.paid))}</p><small>Hạn giữ: {new Date(o.holdUntil).toLocaleTimeString('vi-VN')}</small><Button className="sm" onClick={()=>show({type:'order',id:o.id})}>Xem đơn</Button></div></div>)}{soon.map(o=><div className="activity" key={o.id}><div><p>{o.name} · có lịch hôm nay</p><small>{o.slots.map(s=>s.hour+':00').join(', ')}</small></div></div>)}{low.map(p=><div className="activity" key={p.id}><div><p>{p.name} · còn {p.stock}</p><small>Kiểm tra tồn kho</small></div></div>)}{!holds.length&&!soon.length&&!low.length&&<p className="empty">Không có việc cần chú ý</p>}<div className="notice" style={{marginTop:20}}>Chưa gửi SMS hoặc email. Backend tự kiểm tra hết hạn giữ chỗ mỗi 30 giây.</div></div></Panel></>;
}
