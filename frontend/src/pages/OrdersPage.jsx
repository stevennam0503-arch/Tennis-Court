import React, { useState } from 'react';
import { useCourtly } from '../context';
import { Title, Panel, Button } from '../components/UI';
import OrderTable from '../components/OrderTable';
import { labels } from '../utils/format';
export default function OrdersPage(){
  const {data,navigate}=useCourtly();
  const [query,setQuery]=useState(''),[status,setStatus]=useState('');
  const orders=data.orders.filter(o=>(!status||o.status===status)&&`${o.name} ${o.phone} ${o.id}`.toLowerCase().includes(query.toLowerCase()));
  return <><Title subtitle="Từ giữ chỗ đến hoàn tất và xuất phiếu thu." action={<Button className="primary" onClick={()=>navigate('calendar')}>Đặt sân mới</Button>}>Đơn đặt sân</Title><Panel title="Danh sách đơn" action={<div className="tools"><input className="search" placeholder="Tìm khách, mã đơn, số điện thoại" value={query} onChange={e=>setQuery(e.target.value)}/><select aria-label="Trạng thái" value={status} onChange={e=>setStatus(e.target.value)}><option value="">Tất cả trạng thái</option>{['HOLDING','CONFIRMED','CHECKED_IN','COMPLETED','CANCELLED','EXPIRED'].map(s=><option key={s} value={s}>{labels[s]}</option>)}</select></div>}><OrderTable orders={orders}/></Panel></>;
}
