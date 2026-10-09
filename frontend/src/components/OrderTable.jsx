import React from 'react';
import { Button, Chip, Table } from './UI';
import { useCourtly } from '../context';
import { money } from '../utils/format';
export default function OrderTable({ orders }) {
  const { data, show } = useCourtly();
  return <Table headings={['Khách hàng','Lịch sân','Tổng tiền','Trạng thái','']} empty={!orders.length}>{orders.map(o => <tr key={o.id}><td className="name">{o.name}<small>{o.id.slice(0,8)}</small></td><td>{o.slots.slice(0,2).map(s => <div key={s.id}>{data.courts.find(c=>c.id===s.court)?.name} · {s.hour}:00</div>)}{o.slots.length>2 && <small>+{o.slots.length-2} giờ</small>}<small>{o.date}</small></td><td>{money(o.total)}<small>Đã thu {money(o.paid)}</small></td><td><Chip status={o.status}/></td><td><Button className="sm" onClick={()=>show({type:'order',id:o.id})}>Chi tiết</Button></td></tr>)}</Table>;
}
