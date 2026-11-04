import GuestPortal from './guest/Portal';

import React,{useState,useCallback,useRef,useEffect,useMemo} from 'react';

import {CalendarDays,ClipboardList,Wallet,Grid2X2,Package,Users,Trophy,ChartColumn,Settings,Bell,Menu,UserRound,LogOut,MessageSquare,Send} from 'lucide-react';

import {CourtlyContext} from './context';

import {useClub} from './hooks/useClub';

import {api} from './services/api';

import {today,dateLabel} from './utils/format';

import {Button} from './components/UI';

import AuthDialog from './components/AuthDialog';

import PublicPage from './pages/PublicPage';

import {PublicHeader,PublicFooter} from './components/PublicLayout';

import MembershipPage from './pages/MembershipPage';

import MembershipAdminPage from './pages/MembershipAdminPage';

import InformationPage from './pages/InformationPage';

import ContentAdminPage from './pages/ContentAdminPage';

import {UserAvatar} from './components/UserAvatar';

import DialogHost from './components/DialogHost';

import CustomerDialogs from './components/CustomerDialogs';

import CustomerPage from './pages/CustomerPage';

import {MyHistory,MyPayments,MyServices} from './pages/CustomerHistory';

import ProfilePage from './pages/ProfilePage';

import OperationsPage from './pages/OperationsPage';

import CalendarPage from './pages/CalendarPage';

import OrdersPage from './pages/OrdersPage';

import PaymentsPage from './pages/PaymentsPage';

import CourtsPage from './pages/CourtsPage';

import StaffPage from './pages/StaffPage';

import AccountsPage from './pages/AccountsPage';

import TournamentsPage from './pages/TournamentsPage';

import ReportsPage from './pages/ReportsPage';

import SystemPage from './pages/SystemPage';

import NotificationsPage from './pages/NotificationsPage';
import SentNotificationsAdminPage from './pages/SentNotificationsAdminPage';

const adminMenu=[['operations',ClipboardList,'Việc cần xử lý'],['history',CalendarDays,'Lịch sử đặt sân'],['payment-history',Wallet,'Lịch sử thanh toán'],['services',Package,'Dịch vụ trọng tài'],['calendar',CalendarDays,'Lịch sân'],['orders',ClipboardList,'Đơn đặt sân'],['payments',Wallet,'Thu tiền & hoàn tiền'],['sent-notifications',Send,'Thông báo đã gửi'],['courts',Grid2X2,'Sân & bảng giá'],['membership',Users,'Membership & hội viên'],['staff',Users,'Nhân sự'],['tournaments',Trophy,'Giải đấu'],['accounts',Users,'Tài khoản & phân quyền'],['reports',ChartColumn,'Báo cáo'],['content',MessageSquare,'Nội dung & feedback'],['system',Settings,'Hệ thống & module'],['profile',UserRound,'Hồ sơ của tôi']];

const staffMenu=[['operations',ClipboardList,'Việc cần xử lý'],['calendar',CalendarDays,'Lịch sân'],['orders',ClipboardList,'Đơn đặt sân'],['payments',Wallet,'Thu tiền & hoàn tiền'],['services',Package,'Dịch vụ trọng tài'],['sent-notifications',Send,'Thông báo đã gửi'],['history',CalendarDays,'Lịch sử đặt sân'],['profile',UserRound,'Hồ sơ của tôi']];

const customerMenu=[['calendar',CalendarDays,'Đặt sân'],['tournaments',Trophy,'Giải đấu']];

const pages={membership:MembershipAdminPage,operations:OperationsPage,history:MyHistory,'payment-history':MyPayments,services:MyServices,calendar:CalendarPage,orders:OrdersPage,payments:PaymentsPage,courts:CourtsPage,staff:StaffPage,tournaments:TournamentsPage,accounts:AccountsPage,reports:ReportsPage,system:SystemPage,notifications:NotificationsPage,'sent-notifications':SentNotificationsAdminPage,profile:ProfilePage,content:ContentAdminPage};

export function AuthenticatedApp({session,onAccessError,onLogout,pending,onConsumed}){

 const [date,setDate]=useState(()=>pending?.date||today()),[route,setRoute]=useState(()=>location.hash.slice(1)||(session.user.role==='ADMIN'||session.user.role==='STAFF'?'operations':'calendar'));

 const [membershipPlan]=useState(pending?.type==='membership'?pending.planId:null);

 const [dialog,setDialog]=useState(null),[mobile,setMobile]=useState(false),[toast,setToast]=useState('');const toastTimer=useRef();

 const club=useClub(date,onAccessError),user=club.data?.viewer||session.user,isAdmin=user.role==='ADMIN',isStaff=user.role==='STAFF',isInternal=isAdmin||isStaff,menu=isAdmin?adminMenu:isStaff?staffMenu:customerMenu;

 const mappedRoute=!isInternal&&['orders','history','payments'].includes(route)?'profile-'+route:route;const safeRoute=mappedRoute.startsWith('profile')||menu.some(x=>x[0]===mappedRoute)||(isAdmin&&mappedRoute==='notifications')?mappedRoute:(isInternal?'operations':'calendar');

 const notify=useCallback(text=>{clearTimeout(toastTimer.current);setToast(text);toastTimer.current=setTimeout(()=>setToast(''),4500);},[]);

 useEffect(()=>()=>clearTimeout(toastTimer.current),[]);

 useEffect(()=>{setDialog(null);},[user.role]);

 const navigate=useCallback((r,replace=false)=>{

  setRoute(r);

  setMobile(false);

  setDialog(null);

  const targetUrl='/app#'+r;

  if(replace||location.hash==='#'+r){

   history.replaceState(null,'',targetUrl);

  }else{

   history.pushState(null,'',targetUrl);

  }

 },[]);

 useEffect(()=>{const warn=()=>notify('Thao tác đã thành công, nhưng chưa tải lại được dữ liệu. Hãy làm mới; không gửi lại thao tác.');window.addEventListener('courtly-committed-refresh-error',warn);return()=>window.removeEventListener('courtly-committed-refresh-error',warn);},[notify]);

 const close=useCallback(()=>setDialog(null),[]);

 const resumed=useRef(false);

 useEffect(()=>{

  if(!club.data||!pending||resumed.current)return;

  resumed.current=true;

  if(pending.type==='navigate'){navigate(pending.route==='payments'&&isAdmin?'payment-history':pending.route);}

  else if(pending.type==='membership'){navigate(isAdmin?'membership':'profile-membership');}

  else if(isInternal){notify(`Đã đăng nhập ${isAdmin?'quản trị':'staff'}. Bạn có thể xử lý lịch và đơn tại đây.`);}

  else if(pending.type==='booking'){

   const selected=club.data.schedules.filter(s=>pending.scheduleIds.includes(s.id));

   if(selected.length===pending.scheduleIds.length&&selected.every(s=>s.status==='AVAILABLE'))setDialog({...pending});

   else {setDialog({...pending});notify('Đang kiểm tra lại lựa chọn. Nếu có xung đột, quay lại chọn khoảng giờ.');}

  }else if(pending.type==='registration'){setRoute('tournaments');setDialog({...pending});}

  onConsumed?.();

 },[club.data,pending,isAdmin,isInternal,notify,onConsumed,navigate]);

 const badges = useMemo(() => {

   if (!club.data) return {};

   const orders = club.data.orders || [];

   const curToday = today();



   const pendingRefunds = orders.filter(o => {

     const isCancelled = ['CANCELLED', 'EXPIRED'].includes(o.status);

     const refunded = o.finance?.refunded || 0;

     const expectedRefund = o.cancellationSettlement?.refundAmount || o.metadata?.cancellationSettlement?.refundAmount || 0;

     const refundPending = o.finance?.refundPending || expectedRefund || 0;

     return isCancelled && (refundPending > 0 || expectedRefund > 0) && refunded === 0;

   }).length;



   const now = new Date();

   const currentMinutes = now.getHours() * 60 + now.getMinutes();



   const urgentOperationsSet = new Set();

   orders.forEach(o => {

     if (['CANCELLED', 'EXPIRED'].includes(o.status)) return;

     const due = (o.total || 0) - (o.paid || 0);

     const slots = o.slots || [];

     let maxEnd = '00:00';

     for (const s of slots) {

       const endStr = s.end ? s.end.slice(0, 5) : hourLabel(s.hour + (s.hours || 1));

       if (endStr > maxEnd) maxEnd = endStr;

     }

     const [h, m] = maxEnd.split(':').map(Number);

     const endMinutes = (h || 0) * 60 + (m || 0);

     const isSessionOverdue = o.date < curToday || (o.date === curToday && currentMinutes > endMinutes + 15);



     if (o.status === 'CHECKED_IN' && isSessionOverdue) {

       urgentOperationsSet.add(o.id);

     }

     if (due > 0 && (o.status === 'COMPLETED' || isSessionOverdue)) {

       urgentOperationsSet.add(o.id);

     }

   });



   const urgentOperationsCount = urgentOperationsSet.size;

   const urgentCount = urgentOperationsCount + pendingRefunds;



   const cancelledNeedingAction = orders.filter(o => 

     ['CANCELLED', 'EXPIRED'].includes(o.status) && (

       (o.finance?.refundPending || 0) > 0 || 

       (o.cancellationSettlement?.refundAmount > 0 && !o.finance?.refunded)

     )

   );

   const holdingCount = orders.filter(o => o.status === 'HOLDING').length;

   const inUseCount = orders.filter(o => o.status === 'CHECKED_IN' && o.date === curToday).length;

   const uncollectedCount = orders.filter(o => {

     if (['CANCELLED', 'EXPIRED'].includes(o.status)) return false;

     const due = (o.total || 0) - (o.paid || 0);

     if (due <= 0) return false;

     return o.status === 'COMPLETED' || (o.status === 'CHECKED_IN' && o.date < curToday) || (o.status === 'CONFIRMED' && o.date < curToday);

   }).length;

   const operationsCount = cancelledNeedingAction.length + holdingCount + inUseCount + uncollectedCount;



   const newOrdersCount = orders.filter(o => {

     const isToday = o.date === curToday || (o.createdAt && o.createdAt.startsWith(curToday));

     return o.status === 'HOLDING' || (isToday && ['CONFIRMED', 'CANCELLED'].includes(o.status));

   }).length;



   const feedbackList = club.data.content?.feedback || [];

   const pendingFeedback = feedbackList.filter(f => !f.reply && !f.published).length;

   const totalAlerts = operationsCount + pendingRefunds + (holdingCount > 0 ? 1 : 0);



   return {

     operations: operationsCount,

     orders: newOrdersCount,

     payments: pendingRefunds,

     content: pendingFeedback,

     totalAlerts,

     urgentCount,

     urgentOperationsCount,

     urgentPaymentsCount: pendingRefunds

   };

 }, [club.data]);



 const menuGroups=isAdmin?[

  {label:'VẬN HÀNH',ids:['operations','calendar','orders','services','payments','sent-notifications']},

  {label:'TRA CỨU',ids:['history','payment-history','reports']},

  {label:'KINH DOANH',ids:['courts','membership','tournaments']},

  {label:'QUẢN TRỊ',ids:['staff','accounts','content','system']}

 ]:isStaff?[

  {label:'VẬN HÀNH',ids:['operations','calendar','orders','payments','services','sent-notifications']},

  {label:'TRA CỨU',ids:['history']}

 ]:[{label:'LỊCH CHƠI CỦA BẠN',ids:customerMenu.map(x=>x[0])}];

 useEffect(()=>{

  const change=()=>{

   if(isInternal&&location.pathname!=='/app'){

    history.replaceState(null,'','/app'+(location.hash||'#operations'));

   }

   const target=location.hash.slice(1)||(isInternal?'operations':'calendar');

   setRoute(target);

   setDialog(null);

  };

  window.addEventListener('popstate',change);

  window.addEventListener('hashchange',change);

  return()=>{

   window.removeEventListener('popstate',change);

   window.removeEventListener('hashchange',change);

  };

 },[isInternal,session.user.role]);

 const Page=pages[safeRoute]||CalendarPage;

 if(!isInternal)return <CourtlyContext.Provider value={{...club,user,isAdmin,isStaff,date,setDate,navigate,show:setDialog,notify}}><div className="customer-workspace"><PublicHeader user={user} onLogout={onLogout}/><main className="main">{club.error&&<div className="error" role="alert">{club.error} <Button onClick={()=>club.refresh().catch(()=>{})}>Thử lại</Button></div>}{club.loading?<div className="loading">Đang tải dữ liệu…</div>:club.data?(safeRoute.startsWith('profile')?<ProfilePage tab={safeRoute.split('-')[1]||'info'} initialPlan={membershipPlan}/>:<CustomerPage key={safeRoute} route={safeRoute}/>):<div className="empty">Không thể kết nối máy chủ. Vui lòng thử lại.</div>}</main><PublicFooter/>{club.data&&dialog&&<CustomerDialogs key={`${dialog.type}-${dialog.id||''}`} dialog={dialog} onClose={close}/>}<div aria-live="polite">{toast&&<div className="toast">{toast}</div>}</div></div></CourtlyContext.Provider>;

 return <CourtlyContext.Provider value={{...club,user,isAdmin,isStaff,date,setDate,navigate,show:setDialog,notify}}><div className="layout"><aside className={`sidebar ${mobile?'open':''}`}><div className="brand"><img src="/favicon.svg" alt="" width="34" height="34"/><div>Courtly<em>TENNIS CLUB</em></div></div><nav className="nav" aria-label={isAdmin?'Quản trị':isStaff?'Staff':'Khách hàng'}>{menuGroups.map(group=><section className="nav-group" key={group.label}><div className="nav-caption">{group.label}</div>{group.ids.map(id=>{

  const [,Icon,label]=menu.find(x=>x[0]===id);

  const badge = badges[id] || 0;

  const isUrgent = (id === 'payments' && badges.urgentPaymentsCount > 0) || (id === 'operations' && badges.urgentOperationsCount > 0);

  const isOrders = id === 'orders';

  const badgeColor = isUrgent ? '#ef4444' : isOrders ? '#2563eb' : '#64748b';

  const badgeBg = isUrgent ? '#fee2e2' : isOrders ? '#dbeafe' : '#f1f5f9';

  const badgeText = isUrgent ? '#b91c1c' : isOrders ? '#1d4ed8' : '#475569';

  return (

    <button

      key={id}

      className={safeRoute===id?'active':''}

      onClick={()=>navigate(id)}

      style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', position: 'relative' }}

    >

      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>

        <span style={{ position: 'relative', display: 'inline-flex' }}>

          <Icon size={19}/>

          {badge > 0 && (

            <span

              style={{

                position: 'absolute',

                top: -3,

                right: -4,

                width: 8,

                height: 8,

                borderRadius: '50%',

                background: badgeColor,

                border: '1.5px solid #173c32',

                boxShadow: `0 0 6px ${badgeColor}`

              }}

            />

          )}

        </span>

        <span>{label}</span>

      </div>

      {badge > 0 && (

        <span

          style={{

            fontSize: 11,

            fontWeight: 700,

            padding: '1px 6px',

            borderRadius: 10,

            background: badgeBg,

            color: badgeText,

            lineHeight: 1.4

          }}

        >

          {badge > 99 ? '99+' : badge}

        </span>

      )}

    </button>

  );

})}</section>)}</nav><div className="side-foot" style={{ borderTop: '1px solid #285444', paddingTop: 14, marginTop: 'auto' }}>

  <button

    type="button"

    className={`signed-user-card ${safeRoute === 'profile' ? 'active' : ''}`}

    onClick={() => navigate('profile')}

    title="Xem và chỉnh sửa hồ sơ của tôi"

    style={{

      width: '100%',

      display: 'flex',

      alignItems: 'center',

      gap: 10,

      padding: '8px 10px',

      borderRadius: 10,

      background: safeRoute === 'profile' ? 'var(--lime)' : 'rgba(255, 255, 255, 0.08)',

      color: safeRoute === 'profile' ? '#173c32' : '#ffffff',

      border: safeRoute === 'profile' ? '1px solid var(--lime)' : '1px solid rgba(255, 255, 255, 0.12)',

      cursor: 'pointer',

      textAlign: 'left',

      transition: 'all 0.15s ease',

      boxSizing: 'border-box'

    }}

  >

    <UserAvatar

      user={user}

      size={34}

      dark={safeRoute !== 'profile'}

      style={{

        background: safeRoute === 'profile' ? '#173c32' : '#2d5849',

        color: safeRoute === 'profile' ? 'var(--lime)' : 'var(--lime)'

      }}

    />

    <div style={{ minWidth: 0, flex: 1 }}>

      <div

        style={{

          fontWeight: 700,

          fontSize: 12.5,

          whiteSpace: 'nowrap',

          overflow: 'hidden',

          textOverflow: 'ellipsis',

          color: safeRoute === 'profile' ? '#173c32' : '#f8fafc'

        }}

      >

        {user.name}

      </div>

      <div

        style={{

          fontSize: 11,

          color: safeRoute === 'profile' ? '#335548' : '#a7c2b3',

          marginTop: 1

        }}

      >

        {isAdmin ? 'Quản trị viên' : isStaff ? 'Nhân viên vận hành' : 'Khách hàng'}

      </div>

    </div>

    <UserRound size={15} style={{ color: safeRoute === 'profile' ? '#173c32' : '#a7c2b3', flexShrink: 0 }} />

  </button>



  <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 10 }}>

    <a

      className="signout"

      href="/"

      target="_blank"

      rel="noopener noreferrer"

      style={{ padding: '6px 4px', fontSize: 12, color: '#c2d3c9', display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none' }}

    >

      Website câu lạc bộ ↗

    </a>

    <a

      className="signout"

      href="/feedback"

      target="_blank"

      rel="noopener noreferrer"

      style={{ padding: '6px 4px', fontSize: 12, color: '#c2d3c9', display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none' }}

    >

      Gửi feedback ↗

    </a>

    <button

      type="button"

      className="signout"

      onClick={onLogout}

      style={{

        padding: '6px 4px',

        fontSize: 12,

        color: '#fca5a5',

        background: 'none',

        border: 'none',

        display: 'flex',

        alignItems: 'center',

        gap: 8,

        cursor: 'pointer',

        textAlign: 'left'

      }}

    >

      <LogOut size={14} /> Đăng xuất

    </button>

  </div>

</div></aside><div className="content"><header className="topbar"><div className="tools"><button className="mobile-menu" aria-label="Mở menu" onClick={()=>setMobile(!mobile)}><Menu size={20}/></button><span className="crumb">Courtly <span className="muted"> / </span>{menu.find(x=>x[0]===safeRoute)?.[2]||'Thông báo'}</span></div><div className="right"><button className="btn sm" style={{background:'#e8f5e9',borderColor:'#a5d6a7',color:'#1b5e20',fontWeight:700,display:'inline-flex',alignItems:'center',gap:6,padding:'5px 12px'}} onClick={()=>setDialog({type:'auto-qr-checkin'})}><span>📷</span> Quét QR Check-in</button><span className="date-label meta">{dateLabel(today())}</span><span className={`chip ${isAdmin?'green':isStaff?'orange':'blue'}`}>{isAdmin?'Admin':isStaff?'Staff':'Khách hàng'}</span>{isAdmin&&<button aria-label="Thông báo" onClick={()=>navigate('notifications')} style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}><Bell size={20}/>{badges.urgentCount > 0 ? <span style={{ position: 'absolute', top: -3, right: -3, minWidth: 16, height: 16, padding: '0 4px', borderRadius: 8, background: '#ef4444', color: '#ffffff', fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1.5px solid #ffffff', lineHeight: 1 }}>{badges.urgentCount > 99 ? '99+' : badges.urgentCount}</span> : (badges.totalAlerts || 0) > 0 ? <span style={{ position: 'absolute', top: -3, right: -3, minWidth: 16, height: 16, padding: '0 4px', borderRadius: 8, background: '#64748b', color: '#ffffff', fontSize: 10, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1.5px solid #ffffff', lineHeight: 1 }}>{badges.totalAlerts > 99 ? '99+' : badges.totalAlerts}</span> : null}</button>}<button className="header-signout" onClick={onLogout} aria-label="Đăng xuất"><LogOut size={19}/></button></div></header><main className="main">{club.error&&<div className="error" role="alert">{club.error} <Button className="sm" onClick={()=>club.refresh().catch(()=>{})}>Thử lại</Button></div>}{club.loading?<div className="loading">Đang tải dữ liệu…</div>:club.data?(safeRoute.startsWith('profile')?<ProfilePage tab={safeRoute.split('-')[1]||'info'}/>:isInternal?<Page key={safeRoute}/>:<CustomerPage key={safeRoute} route={safeRoute}/>):<div className="empty">Không thể kết nối máy chủ. Vui lòng thử lại.</div>}</main></div></div>{club.data&&dialog&&(isInternal?<DialogHost key={`${dialog.type}-${dialog.id||dialog.collection||''}`} dialog={dialog} onClose={close}/>:<CustomerDialogs key={`${dialog.type}-${dialog.id||''}`} dialog={dialog} onClose={close}/>)}<div aria-live="polite">{toast&&<div className="toast">{toast}</div>}</div></CourtlyContext.Provider>;

}

export default function App(){

 const [session,setSession]=useState(null),[error,setError]=useState(''),[loading,setLoading]=useState(true);

 useEffect(()=>{api('/auth/session').then(setSession).catch(e=>setError(e.message)).finally(()=>setLoading(false));},[]);

 const logout=async()=>{await api('/auth/logout','POST',{});setSession(null);history.replaceState(null,'','/');};

 if(loading)return <div className="loading">Courtly…</div>;

 if(session?.authenticated&&['ADMIN','STAFF'].includes(session.user.role)){

  if(location.pathname!=='/app'){

   history.replaceState(null,'','/app'+(location.hash||'#operations'));

  }

  return <AuthenticatedApp session={session} onAccessError={e=>{setError(e.message);setSession(null)}} onLogout={logout}/>;

 }

 return <GuestPortal session={session} onSession={setSession} onLogout={logout}/>;

}

