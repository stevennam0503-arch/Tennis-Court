import GuestPortal from './guest/Portal';
import React,{useState,useCallback,useRef,useEffect} from 'react';
import {CalendarDays,ClipboardList,Wallet,Grid2X2,Package,Users,Trophy,ChartColumn,Settings,Bell,Menu,UserRound,LogOut,MessageSquare} from 'lucide-react';
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
import ProductsPage from './pages/ProductsPage';
import StaffPage from './pages/StaffPage';
import AccountsPage from './pages/AccountsPage';
import TournamentsPage from './pages/TournamentsPage';
import ReportsPage from './pages/ReportsPage';
import SystemPage from './pages/SystemPage';
import NotificationsPage from './pages/NotificationsPage';
const adminMenu=[['operations',ClipboardList,'Việc cần xử lý'],['history',CalendarDays,'Lịch sử đặt sân'],['payment-history',Wallet,'Lịch sử thanh toán'],['services',Package,'Dịch vụ tại quầy'],['calendar',CalendarDays,'Lịch sân'],['orders',ClipboardList,'Đơn đặt sân'],['payments',Wallet,'Thu tiền & hoàn tiền'],['courts',Grid2X2,'Sân & bảng giá'],['products',Package,'Đồ uống & đồ thuê'],['membership',Users,'Membership & hội viên'],['staff',Users,'Nhân sự'],['tournaments',Trophy,'Giải đấu'],['accounts',Users,'Tài khoản & phân quyền'],['reports',ChartColumn,'Báo cáo'],['content',MessageSquare,'Nội dung & feedback'],['system',Settings,'Hệ thống & module'],['profile',UserRound,'Hồ sơ của tôi']];
const customerMenu=[['calendar',CalendarDays,'Đặt sân'],['tournaments',Trophy,'Giải đấu']];
const pages={membership:MembershipAdminPage,operations:OperationsPage,history:MyHistory,'payment-history':MyPayments,services:MyServices,calendar:CalendarPage,orders:OrdersPage,payments:PaymentsPage,courts:CourtsPage,products:ProductsPage,staff:StaffPage,tournaments:TournamentsPage,accounts:AccountsPage,reports:ReportsPage,system:SystemPage,notifications:NotificationsPage,profile:ProfilePage,content:ContentAdminPage};
export function AuthenticatedApp({session,onAccessError,onLogout,pending,onConsumed}){
 const [date,setDate]=useState(()=>pending?.date||today()),[route,setRoute]=useState(()=>location.hash.slice(1)||(session.user.role==='ADMIN'?'operations':'calendar'));
 const [membershipPlan]=useState(pending?.type==='membership'?pending.planId:null);
 const [dialog,setDialog]=useState(null),[mobile,setMobile]=useState(false),[toast,setToast]=useState('');const toastTimer=useRef();
 const club=useClub(date,onAccessError),user=club.data?.viewer||session.user,isAdmin=user.role==='ADMIN',menu=isAdmin?adminMenu:customerMenu;
 const mappedRoute=!isAdmin&&['orders','history','payments'].includes(route)?'profile-'+route:route;const safeRoute=mappedRoute.startsWith('profile')||menu.some(x=>x[0]===mappedRoute)||(isAdmin&&mappedRoute==='notifications')?mappedRoute:'calendar';
 const notify=useCallback(text=>{clearTimeout(toastTimer.current);setToast(text);toastTimer.current=setTimeout(()=>setToast(''),4500);},[]);
 useEffect(()=>()=>clearTimeout(toastTimer.current),[]);
 useEffect(()=>{setDialog(null);},[user.role]);
 const navigate=useCallback(r=>{setRoute(r);setMobile(false);setDialog(null);history.replaceState(null,'','#'+r);},[]);
 useEffect(()=>{const warn=()=>notify('Thao tác đã thành công, nhưng chưa tải lại được dữ liệu. Hãy làm mới; không gửi lại thao tác.');window.addEventListener('courtly-committed-refresh-error',warn);return()=>window.removeEventListener('courtly-committed-refresh-error',warn);},[notify]);
 const close=useCallback(()=>setDialog(null),[]);
 const resumed=useRef(false);
 useEffect(()=>{
  if(!club.data||!pending||resumed.current)return;
  resumed.current=true;
  if(pending.type==='navigate'){navigate(pending.route==='payments'&&isAdmin?'payment-history':pending.route);}
  else if(pending.type==='membership'){navigate(isAdmin?'membership':'profile-membership');}
  else if(isAdmin){notify('Đã đăng nhập quản trị. Bạn có thể xử lý lịch và đơn tại đây.');}
  else if(pending.type==='booking'){
   const selected=club.data.schedules.filter(s=>pending.scheduleIds.includes(s.id));
   if(selected.length===pending.scheduleIds.length&&selected.every(s=>s.status==='AVAILABLE'))setDialog({...pending});
   else {setDialog({...pending});notify('Đang kiểm tra lại lựa chọn. Nếu có xung đột, quay lại chọn khoảng giờ.');}
  }else if(pending.type==='registration'){setRoute('tournaments');setDialog({...pending});}
  onConsumed?.();
 },[club.data,pending,isAdmin,notify,onConsumed,navigate]);
 const menuGroups=isAdmin?[{label:'VẬN HÀNH',ids:['operations','calendar','orders','services','payments']},{label:'TRA CỨU',ids:['history','payment-history','reports']},{label:'KINH DOANH',ids:['courts','products','membership','tournaments']},{label:'QUẢN TRỊ',ids:['staff','accounts','content','system','profile']}]:[{label:'LỊCH CHƠI CỦA BẠN',ids:customerMenu.map(x=>x[0])}];
 useEffect(()=>{const change=()=>setRoute(location.hash.slice(1)||'calendar');window.addEventListener('hashchange',change);return()=>window.removeEventListener('hashchange',change);},[]);
 const Page=pages[safeRoute]||CalendarPage;
 if(!isAdmin)return <CourtlyContext.Provider value={{...club,user,isAdmin,date,setDate,navigate,show:setDialog,notify}}><div className="customer-workspace"><PublicHeader user={user} onLogout={onLogout}/><main className="main">{club.error&&<div className="error" role="alert">{club.error} <Button onClick={()=>club.refresh().catch(()=>{})}>Thử lại</Button></div>}{club.loading?<div className="loading">Đang tải dữ liệu…</div>:club.data?(safeRoute.startsWith('profile')?<ProfilePage tab={safeRoute.split('-')[1]||'info'} initialPlan={membershipPlan}/>:<CustomerPage key={safeRoute} route={safeRoute}/>):<div className="empty">Không thể kết nối máy chủ. Vui lòng thử lại.</div>}</main><PublicFooter/>{club.data&&dialog&&<CustomerDialogs key={`${dialog.type}-${dialog.id||''}`} dialog={dialog} onClose={close}/>}<div aria-live="polite">{toast&&<div className="toast">{toast}</div>}</div></div></CourtlyContext.Provider>;
 return <CourtlyContext.Provider value={{...club,user,isAdmin,date,setDate,navigate,show:setDialog,notify}}><div className="layout"><aside className={`sidebar ${mobile?'open':''}`}><div className="brand"><img src="/favicon.svg" alt="" width="34" height="34"/><div>Courtly<em>TENNIS CLUB</em></div></div><nav className="nav" aria-label={isAdmin?'Quản trị':'Khách hàng'}>{menuGroups.map(group=><section className="nav-group" key={group.label}><div className="nav-caption">{group.label}</div>{group.ids.map(id=>{const [,Icon,label]=menu.find(x=>x[0]===id);return <button key={id} className={safeRoute===id?'active':''} onClick={()=>navigate(id)}><Icon size={19}/>{label}</button>;})}</section>)}</nav><div className="side-foot"><button className="signed-user avatar-button" aria-label="Hồ sơ của tôi" onClick={()=>navigate('profile')}><span className="avatar">{user.name.slice(0,1).toUpperCase()}</span><div><b>{user.name}</b><small>{isAdmin?'Quản trị viên':'Khách hàng'}</small></div></button><a className="signout" href="/">Website câu lạc bộ ↗</a><a className="signout" href="/feedback">Gửi feedback ↗</a><button className="signout" onClick={onLogout}><LogOut size={16}/>Đăng xuất</button></div></aside><div className="content"><header className="topbar"><div className="tools"><button className="mobile-menu" aria-label="Mở menu" onClick={()=>setMobile(!mobile)}><Menu size={20}/></button><span className="crumb">Courtly <span className="muted"> / </span>{menu.find(x=>x[0]===safeRoute)?.[2]||'Thông báo'}</span></div><div className="right"><span className="date-label meta">{dateLabel(today())}</span><span className={`chip ${isAdmin?'green':'blue'}`}>{isAdmin?'Admin':'Khách hàng'}</span>{isAdmin&&<button aria-label="Thông báo" onClick={()=>navigate('notifications')}><Bell size={20}/></button>}<button className="header-signout" onClick={onLogout} aria-label="Đăng xuất"><LogOut size={19}/></button></div></header><main className="main">{club.error&&<div className="error" role="alert">{club.error} <Button className="sm" onClick={()=>club.refresh().catch(()=>{})}>Thử lại</Button></div>}{club.loading?<div className="loading">Đang tải dữ liệu…</div>:club.data?(safeRoute.startsWith('profile')?<ProfilePage tab={safeRoute.split('-')[1]||'info'}/>:isAdmin?<Page key={safeRoute}/>:<CustomerPage key={safeRoute} route={safeRoute}/>):<div className="empty">Không thể kết nối máy chủ. Vui lòng thử lại.</div>}</main></div></div>{club.data&&dialog&&(isAdmin?<DialogHost key={`${dialog.type}-${dialog.id||dialog.collection||''}`} dialog={dialog} onClose={close}/>:<CustomerDialogs key={`${dialog.type}-${dialog.id||''}`} dialog={dialog} onClose={close}/>)}<div aria-live="polite">{toast&&<div className="toast">{toast}</div>}</div></CourtlyContext.Provider>;
}
export default function App(){
 const [session,setSession]=useState(null),[error,setError]=useState(''),[loading,setLoading]=useState(true);
 useEffect(()=>{api('/auth/session').then(setSession).catch(e=>setError(e.message)).finally(()=>setLoading(false));},[]);
 const logout=async()=>{await api('/auth/logout','POST',{});setSession(null);history.replaceState(null,'','/');};
 if(loading)return <div className="loading">Courtly…</div>;
 if(session?.authenticated&&session.user.role==='ADMIN'&&location.pathname==='/app')return <AuthenticatedApp session={session} onAccessError={e=>{setError(e.message);setSession(null)}} onLogout={logout}/>;
 return <GuestPortal session={session} onSession={setSession} onLogout={logout}/>;
}
