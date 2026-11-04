import MyMembership from './MyMembership';
import MyVouchers from './MyVouchers';
import {MyOrders} from './CustomerPage';
import {MyHistory,MyPayments} from './CustomerHistory';
import React,{useState,useEffect} from 'react';
import {CourtlyContext,useCourtly} from '../context';
import PasswordForm from '../components/PasswordForm';
import {Title,Panel,Chip,Tabs} from '../components/UI';
import {UserAvatar} from '../components/UserAvatar';
import {AVATAR_PRESETS,getStoredAvatar,saveStoredAvatar,resizeImageFile} from '../utils/avatar.mjs';

export function PersonalDetails(){
 const {user,mutate,notify}=useCourtly();
 const userId=user.id||user.accountId||user.email||'me';
 const [name,setName]=useState(user.name);
 const [phone,setPhone]=useState(user.phone||'');
 const [avatar,setAvatar]=useState(()=>user.avatarUrl||user.avatar||getStoredAvatar(userId));
 const [error,setError]=useState('');
 const [saving,setSaving]=useState(false);

 useEffect(()=>{
  setName(user.name);
  setPhone(user.phone||'');
  setAvatar(user.avatarUrl||user.avatar||getStoredAvatar(userId));
 },[user.name,user.phone,userId]);

 const handleSubmit=async(e)=>{
  e.preventDefault();
  if(saving)return;
  setSaving(true);
  setError('');
  try{
   await mutate('/profile',{name,phone},'PATCH');
   saveStoredAvatar(userId,avatar);
   notify('Đã cập nhật hồ sơ và ảnh đại diện');
  }catch(err){
   setError(err.message||'Có lỗi xảy ra khi lưu hồ sơ');
  }finally{
   setSaving(false);
  }
 };

 return (
  <>
   <Title subtitle="Thông tin dùng khi đặt sân và đăng ký giải.">Hồ sơ của tôi</Title>
   <div className="profile-grid">
    <Panel title="Thông tin cá nhân & Ảnh đại diện">
     <form className="panel-body" onSubmit={handleSubmit}>
      <div style={{display:'flex',gap:20,alignItems:'center',marginBottom:22,paddingBottom:20,borderBottom:'1px solid var(--line)'}}>
       <UserAvatar user={{...user,name}} avatar={avatar} size={78}/>
       <div style={{flex:1}}>
        <div style={{fontWeight:700,fontSize:15,marginBottom:4}}>Ảnh đại diện</div>
        <p style={{color:'var(--muted)',fontSize:13,margin:'0 0 10px 0'}}>
         Tải ảnh từ thiết bị hoặc chọn biểu tượng thể thao Courtly.
        </p>
        <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
         <label className="btn sm" style={{cursor:'pointer',display:'inline-flex',alignItems:'center',gap:6}}>
          <span>📷</span> Tải ảnh từ máy
          <input
           type="file"
           accept="image/png,image/jpeg,image/webp,image/jpg"
           style={{display:'none'}}
           onChange={async e=>{
            const file=e.target.files?.[0];
            if(!file)return;
            try{
             const resized=await resizeImageFile(file,256,256);
             setAvatar(resized);
            }catch(err){
             setError(err.message);
            }
           }}
          />
         </label>
         {avatar&&(
          <button
           type="button"
           className="btn sm"
           onClick={()=>setAvatar(null)}
           style={{color:'#ef4444',borderColor:'#fca5a5'}}
          >
           Xóa ảnh
          </button>
         )}
        </div>
       </div>
      </div>

      <div style={{marginBottom:22}}>
       <label style={{display:'block',fontSize:13,fontWeight:600,marginBottom:8}}>
        Biểu tượng đại diện nhanh:
       </label>
       <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
        {AVATAR_PRESETS.map(p=>(
         <button
          key={p.id}
          type="button"
          onClick={()=>setAvatar(p.icon)}
          title={p.label}
          style={{
           width:40,
           height:40,
           borderRadius:'50%',
           border:avatar===p.icon?'2px solid var(--green)':'1px solid #d0dfd6',
           background:avatar===p.icon?'#e8f5e9':'#fff',
           fontSize:20,
           display:'grid',
           placeItems:'center',
           cursor:'pointer',
           transition:'all 0.15s ease',
           boxShadow:avatar===p.icon?'0 0 0 2px rgba(46,125,50,0.2)':'none'
          }}
         >
          {p.icon}
         </button>
        ))}
       </div>
      </div>

      <div className="form-grid">
       <div className="field">
        <label htmlFor="profile-name">Họ và tên</label>
        <input id="profile-name" required maxLength={100} value={name} onChange={e=>setName(e.target.value)}/>
       </div>
       <div className="field">
        <label htmlFor="profile-phone">Số điện thoại</label>
        <input id="profile-phone" type="tel" maxLength={30} value={phone} onChange={e=>setPhone(e.target.value)}/>
       </div>
       <div className="field full">
        <label htmlFor="profile-email">Email đăng nhập</label>
        <input id="profile-email" value={user.email} readOnly/>
        <small>Email dùng để đăng nhập tài khoản Courtly.</small>
       </div>
      </div>

      {error&&<div className="error" role="alert" style={{marginTop:12}}>{error}</div>}
      <button className="btn primary" style={{marginTop:24}} disabled={saving}>
       {saving?'Đang lưu…':'Lưu hồ sơ'}
      </button>
     </form>
    </Panel>

    <Panel title="Quyền truy cập">
     <div className="panel-body">
      <Chip status={user.role}/>
      <p className="subtitle" style={{marginTop:14}}>
       {user.role==='ADMIN'?'Bạn có quyền quản lý vận hành câu lạc bộ, tài khoản và giao dịch.':'Bạn có thể đặt sân, xem và đổi/hủy đơn của mình trước khi check-in, đăng ký giải và cập nhật hồ sơ.'}
      </p>
      {user.isOwner&&<p className="notice" style={{marginTop:18}}>Bạn là chủ Site. Quyền quản trị của tài khoản này được bảo vệ.</p>}
     </div>
    </Panel>
   </div>
   <PasswordForm/>
  </>
 );
}

export default function ProfilePage({tab='info',initialPlan}){
 const {navigate,data,user}=useCourtly(),isAdmin=user.role==='ADMIN';
 const mine={
  ...data,
  orders:isAdmin?data.orders.filter(o=>o.ownerUserId?o.ownerUserId===user.id:o.accountId===user.accountId):data.orders,
  registrations:isAdmin?data.registrations.filter(r=>r.ownerUserId?r.ownerUserId===user.id:r.accountId===user.accountId):data.registrations
 };
 const ids=new Set(mine.orders.map(o=>o.id)),regs=new Set(mine.registrations.map(r=>r.id));
 mine.payments=data.payments.filter(p=>ids.has(p.orderId)||regs.has(p.registrationId));
 const payments=new Set(mine.payments.map(p=>p.id));
 mine.refunds=data.refunds.filter(r=>payments.has(r.paymentId));
 mine.memberships=(data.memberships||[]).filter(m=>m.accountId===user.accountId);
 mine.membershipPayments=(data.membershipPayments||[]).filter(m=>m.accountId===user.accountId);
 const ctx=useCourtly();
 return (
  <>
   <Tabs
    value={tab}
    onChange={t=>navigate(t==='info'?'profile':'profile-'+t)}
    options={[["info","Thông tin cá nhân"],["vouchers","Ưu đãi của tôi"],["membership","Membership của tôi"],["orders","Đơn của tôi"],["history","Lịch sử đặt sân"],["payments","Lịch sử thanh toán"]]}
   />
   <CourtlyContext.Provider value={{...ctx,data:mine,isAdmin:false}}>
    {tab==='vouchers'?<MyVouchers/>:tab==='membership'?<MyMembership initialPlan={initialPlan}/>:tab==='orders'?<MyOrders/>:tab==='history'?<MyHistory/>:tab==='payments'?<MyPayments/>:<PersonalDetails/>}
   </CourtlyContext.Provider>
  </>
 );
}
