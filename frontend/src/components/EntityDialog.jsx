import React from 'react';
import { FormDialog } from './UI';
import { useCourtly } from '../context';
import { options, today } from '../utils/format';

export function getNextCourtName(type, courts = []) {
  const prefix = type === 'VIP' ? 'V' : type === 'INDOOR' ? 'B' : 'A';
  const regex = new RegExp(`^(?:Sân\\s+|San\\s+)?${prefix}(\\d+)$`, 'i');
  let max = 0;
  for (const c of courts) {
    if (c.name) {
      const m = String(c.name).trim().match(regex);
      if (m) {
        const num = parseInt(m[1], 10);
        if (num > max) max = num;
      }
    }
  }
  let next = max + 1;
  const isTaken = candidate => courts.some(c => {
    const cleanExisting = String(c.name || '').trim().replace(/^(Sân|San)\s+/i, '');
    const cleanCand = candidate.trim().replace(/^(Sân|San)\s+/i, '');
    return cleanExisting.toLowerCase() === cleanCand.toLowerCase();
  });
  let candidate = `Sân ${prefix}${String(next).padStart(2, '0')}`;
  while (isTaken(candidate)) {
    next++;
    candidate = `Sân ${prefix}${String(next).padStart(2, '0')}`;
  }
  return candidate;
}

export default function EntityDialog({ collection, row = {}, onClose }) {
  const { data, mutate, notify, date } = useCourtly();
  const names = { courts:'sân', prices:'khung giá', accounts:'tài khoản', staff:'nhân sự', 'staff-schedules':'lịch làm việc', tournaments:'giải đấu' };
  const f = (name,label,type='text',extra={}) => ({name,label,type,...extra});
  const s = (name,label,values,extra={}) => ({name,label,options:values,...extra});
  const status = s('status','Trạng thái',options(['ACTIVE','INACTIVE']));
  const choose = list => list.map(x => ({value:x.id,label:x.name}));
  let fields = [], defaults = {};

  if (collection === 'courts') {
    const initialType = row.type || 'OUTDOOR';
    const autoName = getNextCourtName(initialType, data.courts);
    fields = [
      f('name','Tên sân (tự động tăng STT)','text',{placeholder: autoName}),
      s('type','Loại sân',[
        {value:'OUTDOOR',label:'Sân ngoài trời (Thoáng đãng - Khu A)'},
        {value:'INDOOR',label:'Sân trong nhà (Mái che & đèn LED - Khu B)'},
        {value:'VIP',label:'Sân VIP (Lounge riêng & cao cấp - Khu V)'}
      ]),
      f('price','Giá cơ bản / giờ (₫)','number',{min:1}),
      s('status','Trạng thái',options(['ACTIVE','MAINTENANCE','INACTIVE'])),
      f('description','Mô tả sân','textarea',{full:true,required:false,maxLength:2000}),
      f('address','Địa chỉ sân (để trống dùng địa chỉ CLB)','text',{full:true,required:false,maxLength:400}),
      f('amenities','Tiện ích thực tế','text',{full:true,required:false,maxLength:500}),
      f('imageUrl','URL ảnh HTTPS (để trống dùng ảnh minh họa)','text',{full:true,required:false,maxLength:1000}),
      s('imageIsIllustration','Nguồn ảnh',[{value:'true',label:'Ảnh minh họa'},{value:'false',label:'Ảnh sân thật do CLB cung cấp'}])
    ];
    defaults = {
      name: row.id ? '' : autoName,
      type: initialType,
      price: 200000,
      status: 'ACTIVE',
      description: '',
      address: '',
      amenities: '',
      imageUrl: '',
      imageIsIllustration: true
    };
  }
  if (collection === 'prices') { fields=[s('court','Sân',choose(data.courts)),s('dayType','Loại ngày',options(['WEEKDAY','WEEKEND'])),f('start','Giờ bắt đầu','number',{min:6,max:22.5,step:0.5}),f('end','Giờ kết thúc','number',{min:6.5,max:23,step:0.5}),f('price','Giá / giờ (₫)','number',{min:1,full:true})]; defaults={court:data.courts[0]?.id,dayType:'WEEKDAY',start:6,end:17,price:180000}; }
  if (collection === 'accounts') { fields=[f('name','Họ tên'),f('email','Email đăng nhập','email',{readOnly:!!row.loginLinked}),f('phone','Điện thoại','tel'),s('role','Quyền truy cập',options(['CUSTOMER','STAFF','ADMIN']),{disabled:!!row.isOwner}),s('status','Trạng thái',options(['ACTIVE','LOCKED']),{disabled:!!row.isOwner})]; defaults={role:'CUSTOMER',status:'ACTIVE'}; }
  if (collection === 'staff') { fields=[f('name','Họ tên'),s('type','Vị trí',options(['REFEREE','COACH','BALL_BOY'])),f('phone','Điện thoại','tel'),f('rate','Đơn giá / giờ (₫)','number',{min:1}),status]; defaults={type:'REFEREE',rate:120000,status:'ACTIVE'}; }
  if (collection === 'staff-schedules') { fields=[s('staff','Nhân sự',choose(data.staff)),f('date','Ngày làm việc','date'),f('start','Giờ bắt đầu','number',{min:6,max:22.5,step:0.5}),f('end','Giờ kết thúc','number',{min:6.5,max:23,step:0.5})]; defaults={staff:data.staff[0]?.id,date,start:6,end:23}; }
  if (collection === 'tournaments') { fields=[f('name','Tên giải','text',{full:true}),s('format','Thể thức',options(['SINGLES','DOUBLES','TEAM'])),s('status','Trạng thái',options(['DRAFT','OPEN','CLOSED','ONGOING','FINISHED','CANCELLED'])),f('startDate','Ngày bắt đầu','date'),f('endDate','Ngày kết thúc','date'),f('deadline','Hạn đăng ký','date'),f('location','Địa điểm'),f('fee','Phí đăng ký (₫)','number',{min:0}),f('max','Số đăng ký tối đa','number',{min:2,max:1024})]; defaults={format:'DOUBLES',status:'OPEN',startDate:row.start||today(),endDate:row.end||today(),deadline:today(),location:'CLB Courtly',fee:300000,max:16}; }

  const handleDelete = async () => {
    if (!row.id) return;
    const confirmed = window.confirm(
      `Bạn có chắc chắn muốn xóa sân "${row.name}"?\n\nSau khi xóa, sân sẽ được loại bỏ hoàn toàn khỏi toàn bộ hệ thống và giao diện web (bảng đặt sân khách, sơ đồ sân, danh sách quản lý).`
    );
    if (!confirmed) return;
    try {
      await mutate(`/catalog/${collection}/${row.id}`, {}, 'DELETE');
      notify(`Đã xóa thành công "${row.name}" khỏi hệ thống.`);
      onClose();
    } catch (e) {
      notify(e.message || 'Không thể xóa sân. Vui lòng thử lại.');
    }
  };

  const handleFormChange = (nextValues, changedField) => {
    if (collection === 'courts' && !row.id && changedField === 'type') {
      const generated = getNextCourtName(nextValues.type, data.courts);
      return { ...nextValues, name: generated };
    }
    return nextValues;
  };

  return <FormDialog title={`${row.id ? 'Sửa' : 'Thêm'} ${names[collection]}`} fields={fields} initial={{...defaults,...row}} onChange={handleFormChange} onClose={onClose} onDelete={row.id && collection === 'courts' ? handleDelete : undefined} deleteText="Xóa sân này" onSubmit={async values => {
    if (collection === 'courts') {
      const enteredName = String(values.name || '').trim();
      const cleanEntered = enteredName.replace(/^(Sân|San)\s+/i, '');
      const duplicate = (data.courts || []).some(c => {
        if (row.id && c.id === row.id) return false;
        const cleanExisting = String(c.name || '').trim().replace(/^(Sân|San)\s+/i, '');
        return cleanExisting.toLowerCase() === cleanEntered.toLowerCase();
      });
      if (duplicate) {
        throw new Error(`Tên sân "${enteredName}" đã tồn tại. Vui lòng chọn tên khác.`);
      }
    }
    // Send only the catalog DTO fields, never view-only ids or calculated columns.
    const body=Object.fromEntries(fields.map(f=>[f.name,values[f.name]]));if(collection==='courts')body.imageIsIllustration=String(values.imageIsIllustration??true)==='true';
    await mutate(`/catalog/${collection}${row.id ? '/'+row.id : ''}`,body,row.id?'PUT':'POST');
    notify('Đã lưu thông tin'); onClose();
  }}>{collection==='courts'&&!row.id&&<div className="notice" style={{marginBottom:18}}>Tên sân được tự động đánh số thứ tự tiếp theo theo phân khu (A: Ngoài trời, B: Trong nhà, V: VIP). Bạn có thể đổi loại sân để tự nhảy mã sân tương ứng.</div>}{collection==='accounts'&&<div className="notice" style={{marginBottom:18}}>Khách đăng nhập bằng đúng email này sẽ nhận quyền đã cấp. Email đã liên kết đăng nhập được giữ cố định. Chủ Site không thể bị khóa hoặc hạ quyền.</div>}{collection==='prices' && <div className="notice" style={{marginBottom:18}}>Giá áp dụng khi sinh lịch mới. Các slot đã sinh giữ giá đã chụp.</div>}{collection==='staff-schedules' && <div className="notice" style={{marginBottom:18}}>Thêm mới sẽ chia khoảng thời gian thành từng slot 30 phút.</div>}</FormDialog>;
}
