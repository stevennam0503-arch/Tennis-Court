import React from 'react';
import { FormDialog } from './UI';
import { useCourtly } from '../context';
import { options, today } from '../utils/format';
export default function EntityDialog({ collection, row = {}, onClose }) {
  const { data, mutate, notify, date } = useCourtly();
  const names = { courts:'sân', prices:'khung giá', accounts:'tài khoản', drinks:'đồ uống', rentals:'đồ thuê', staff:'nhân sự', 'staff-schedules':'lịch làm việc', tournaments:'giải đấu' };
  const f = (name,label,type='text',extra={}) => ({name,label,type,...extra});
  const s = (name,label,values,extra={}) => ({name,label,options:values,...extra});
  const status = s('status','Trạng thái',options(['ACTIVE','INACTIVE']));
  const choose = list => list.map(x => ({value:x.id,label:x.name}));
  let fields = [], defaults = {};
  if (collection === 'courts') { fields = [f('name','Tên sân'),s('type','Loại sân',options(['HARD','CLAY','GRASS'])),f('price','Giá cơ bản / giờ (₫)','number',{min:1}),s('status','Trạng thái',options(['ACTIVE','MAINTENANCE','INACTIVE']))]; defaults={type:'HARD',price:180000,status:'ACTIVE'}; }
  if (collection === 'prices') { fields=[s('court','Sân',choose(data.courts)),s('dayType','Loại ngày',options(['WEEKDAY','WEEKEND'])),f('start','Giờ bắt đầu','number',{min:6,max:22}),f('end','Giờ kết thúc','number',{min:7,max:23}),f('price','Giá / giờ (₫)','number',{min:1,full:true})]; defaults={court:data.courts[0]?.id,dayType:'WEEKDAY',start:6,end:17,price:180000}; }
  if (['drinks','rentals'].includes(collection)) { fields=[f('name','Tên sản phẩm'),f('price',collection==='rentals'?'Giá thuê / giờ (₫)':'Giá bán (₫)','number',{min:1}),f('stock','Tồn kho','number',{min:0}),status]; defaults={price:15000,stock:0,status:'ACTIVE'}; }
  if (collection === 'accounts') { fields=[f('name','Họ tên'),f('email','Email','email'),f('phone','Điện thoại','tel'),s('role','Vai trò',options(['CUSTOMER','STAFF','ADMIN'])),s('status','Trạng thái',options(['ACTIVE','LOCKED']))]; defaults={role:'CUSTOMER',status:'ACTIVE'}; }
  if (collection === 'staff') { fields=[f('name','Họ tên'),s('type','Vị trí',options(['REFEREE','COACH','BALL_BOY'])),f('phone','Điện thoại','tel'),f('rate','Đơn giá / giờ (₫)','number',{min:1}),status]; defaults={type:'REFEREE',rate:120000,status:'ACTIVE'}; }
  if (collection === 'staff-schedules') { fields=[s('staff','Nhân sự',choose(data.staff)),f('date','Ngày làm việc','date'),f('start','Giờ bắt đầu','number',{min:6,max:22}),f('end','Giờ kết thúc','number',{min:7,max:23})]; defaults={staff:data.staff[0]?.id,date,start:6,end:23}; }
  if (collection === 'tournaments') { fields=[f('name','Tên giải','text',{full:true}),s('format','Thể thức',options(['SINGLES','DOUBLES','TEAM'])),s('status','Trạng thái',options(['DRAFT','OPEN','CLOSED','ONGOING','FINISHED','CANCELLED'])),f('startDate','Ngày bắt đầu','date'),f('endDate','Ngày kết thúc','date'),f('deadline','Hạn đăng ký','date'),f('location','Địa điểm'),f('fee','Phí đăng ký (₫)','number',{min:0}),f('max','Số đăng ký tối đa','number',{min:2,max:1024})]; defaults={format:'DOUBLES',status:'OPEN',startDate:row.start||today(),endDate:row.end||today(),deadline:today(),location:'CLB Courtly',fee:300000,max:16}; }
  return <FormDialog title={`${row.id ? 'Sửa' : 'Thêm'} ${names[collection]}`} fields={fields} initial={{...defaults,...row}} onClose={onClose} onSubmit={async values => {
    // Send only the catalog DTO fields, never view-only ids or calculated columns.
    const body=Object.fromEntries(fields.map(f=>[f.name,values[f.name]]));
    await mutate(`/catalog/${collection}${row.id ? '/'+row.id : ''}`,body,row.id?'PUT':'POST');
    notify('Đã lưu thông tin'); onClose();
  }}>{collection==='prices' && <div className="notice" style={{marginBottom:18}}>Giá áp dụng khi sinh lịch mới. Các slot đã sinh giữ giá đã chụp.</div>}{collection==='staff-schedules' && <div className="notice" style={{marginBottom:18}}>Thêm mới sẽ chia khoảng thời gian thành từng slot một giờ.</div>}</FormDialog>;
}
