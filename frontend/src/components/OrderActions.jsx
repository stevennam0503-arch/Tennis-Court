import React from 'react';
import {useCourtly} from '../context';
import {Button} from './UI';

export const beforePlay = order => order.slots.length > 0 && order.slots.every(slot =>
  Date.parse(`${order.date}T${slot.start||`${String(Math.floor(slot.hour)).padStart(2,'0')}:${slot.hour%1?'30':'00'}:00`}+07:00`) > Date.now());
export const canRent = order => ['HOLDING','CONFIRMED'].includes(order.status) && beforePlay(order);
export const canEdit = (order,isAdmin=false) => ['HOLDING','CONFIRMED'].includes(order.status) && (isAdmin || beforePlay(order));
export const canCancel = (order,isAdmin=false) => isAdmin
  ? ['HOLDING','CONFIRMED','CHECKED_IN'].includes(order.status)
  : canEdit(order);

export default function OrderActions({order,details=true}){
  const {show,isAdmin}=useCourtly();
  return <div className="step-row">
    {details&&<Button className="sm" onClick={()=>show({type:'order',id:order.id})}>Chi tiết đơn</Button>}
    {isAdmin&&canRent(order)&&<Button className="primary sm" onClick={()=>show({type:'assign-staff',id:order.id})}>Chọn trọng tài</Button>}
    {canEdit(order,isAdmin)&&<Button className="sm" onClick={()=>show({type:'move',id:order.id})}>Sửa lịch</Button>}
    {canCancel(order,isAdmin)&&<Button className="sm danger" onClick={()=>show({type:'cancel',id:order.id})}>Hủy lịch</Button>}
  </div>;
}
