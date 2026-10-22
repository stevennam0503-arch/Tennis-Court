import React,{useState,useEffect} from 'react';
import {api} from '../services/api';
import {useGuest,Action,Empty,State,money,requestId} from './context';

export default function CashDesk(){
 const {t,user}=useGuest();const [rows,setRows]=useState([]),[selected,setSelected]=useState(''),[amount,setAmount]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[receipt,setReceipt]=useState('');
 const [transaction,setTransaction]=useState(requestId);
 const allowed=['ADMIN','STAFF'].includes(user?.role);
 const load=()=>api('/payments/cash-desk').then(setRows);
 useEffect(()=>{if(allowed)load().catch(e=>setError(e.message))},[allowed]);
 const order=rows.find(o=>o.id===selected);
 const submit=async e=>{
  e.preventDefault();if(!order)return;setBusy(true);setError('');
  try{const r=await api('/payments','POST',{orderId:order.id,amount:Number(amount),method:'CASH',transactionCode:transaction});setReceipt(r.id);setSelected('');setAmount('');setTransaction(requestId());await load()}catch(e){setError(e.message)}finally{setBusy(false)}
 };
 if(!allowed)return <section className="ct-pad"><h1>{t('Thu tiền tại quầy')}</h1><Empty>{t('Chỉ nhân viên thu ngân và quản trị được truy cập.')}</Empty></section>;
 return <section className="ct-pad"><div className="gx-heading"><h1>{t('Thu tiền mặt tại quầy')}</h1><p>{t('Chỉ xác nhận sau khi đã nhận đủ số tiền nhập bên dưới. Chuyển khoản do ngân hàng xác minh tự động.')}</p></div><form className="gx-form" onSubmit={submit}><label>{t('Chọn đơn')}<select aria-label={t('Chọn đơn')} required value={selected} onChange={e=>{const o=rows.find(x=>x.id===e.target.value);setSelected(e.target.value);setAmount(o?Math.min(o.due,Math.max(0,o.deposit-o.paid)||o.due):'');setTransaction(requestId());setReceipt('')}}><option value="">{t('Chọn đơn cần thu')}</option>{rows.map(o=><option key={o.id} value={o.id}>#{o.id.slice(0,8)} · {o.name} · {money(o.due)}</option>)}</select></label>{order&&<p><State value={order.status}/> · {t('Đã thu')}: {money(order.paid)} · {t('Còn thiếu')}: {money(order.due)}</p>}<label>{t('Số tiền mặt thực nhận (VND)')}<input required type="number" min="1" step="1" max={order?.due} value={amount} onChange={e=>{setAmount(e.target.value);setTransaction(requestId())}}/></label><label className="gx-check"><input required type="checkbox" key={selected+transaction}/>{t('Tôi đã nhận tiền mặt và kiểm tra đúng đơn, đúng số tiền.')}</label>{error&&<div className="gx-error" role="alert">{t(error)}</div>}{receipt&&<p role="status">{t('Đã ghi nhận phiếu thu')}: {receipt}</p>}<Action type="submit" disabled={busy||!order}>{t(busy?'Đang xử lý…':'Xác nhận tiền mặt đã thu')}</Action><Action secondary disabled={busy} onClick={()=>load().catch(e=>setError(e.message))}>{t('Làm mới')}</Action></form></section>;
}
