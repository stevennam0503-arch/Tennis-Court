import React,{useState,useEffect,useCallback,useRef} from 'react';
import {X} from 'lucide-react';
import {api} from '../services/api';
import {GuestContext,translate,dateToday,Action} from './context';
import {Header,Footer} from './Layout';
import Overview from './Overview';
import Booking from './Booking';
import Pricing from './Pricing';
import CashDesk from './CashDesk';
import Tournaments,{EventDialog} from './Tournaments';
import {News,Article,Contact,Feedback,Policies} from './Content';
import {Orders,CancelDialog,Membership,Profile} from './Account';
import Payments,{PaymentDialog,PaymentChoice} from './Payments';
import GuestAuth from './Auth';
import './handoff.css';
import './guest.css';
import './booking.css';
import './header.css';
function Modal({children,onClose,title}){const ref=useRef();useEffect(()=>{const old=document.activeElement,overflow=document.body.style.overflow;document.body.style.overflow='hidden';ref.current?.querySelector('button,input')?.focus();const handler=e=>{if(e.key==='Escape')onClose();if(e.key==='Tab'){const all=[...ref.current.querySelectorAll('button,input,select,textarea,a[href],summary')].filter(x=>!x.disabled&&x.getClientRects().length);if(e.shiftKey&&document.activeElement===all[0]){e.preventDefault();all.at(-1)?.focus()}else if(!e.shiftKey&&document.activeElement===all.at(-1)){e.preventDefault();all[0]?.focus()}}};document.addEventListener('keydown',handler);return()=>{document.body.style.overflow=overflow;document.removeEventListener('keydown',handler);old?.focus()}},[]);return <div className="gx-backdrop" onMouseDown={e=>e.target===e.currentTarget&&onClose()}><section className="gx-dialog" ref={ref} role="dialog" aria-modal="true" aria-label={title}><button className="gx-close" aria-label={title} onClick={onClose}><X/></button>{children}</section></div>}
const paths={about:'/',booking:'/dat-san',pricing:'/bang-gia',cashdesk:'/quay-thu',news:'/tin-tuc',contact:'/lien-he',feedback:'/feedback',tournaments:'/giai-dau',membership:'/membership',orders:'/tai-khoan/don',history:'/tai-khoan/lich',payments:'/tai-khoan/thanh-toan',profile:'/tai-khoan',policies:'/chinh-sach'};
const initialRoute=()=>Object.entries(paths).find(([,p])=>p===location.pathname)?.[0]||({orders:'orders',history:'history',payments:'payments','profile-orders':'orders','profile-history':'history','profile-payments':'payments','profile-membership':'membership',profile:'profile',tournaments:'tournaments'})[location.hash.slice(1)]||'about';
export default function Portal({session,onSession,onLogout}){const [lang,setLang]=useState(()=>localStorage.getItem('courtly-language')||'vi'),[route,setRoute]=useState(initialRoute),[date,setDate]=useState(dateToday),[data,setData]=useState(null),[content,setContent]=useState({}),[transfers,setTransfers]=useState([]),[loading,setLoading]=useState(true),[error,setError]=useState(''),[dialog,setDialog]=useState(null),[auth,setAuth]=useState(false),[preferredZone,setPreferredZone]=useState(()=>new URLSearchParams(location.search).get('khu')||'ALL'),[moveOrder,setMoveOrder]=useState(null),[toast,setToast]=useState('');const serial=useRef(0),timer=useRef();const user=session?.authenticated?session.user:null;const t=useCallback(s=>translate(lang,s),[lang]);
 const navigate=useCallback(id=>{setRoute(id);history.pushState(null,'',paths[id]||'/');window.scrollTo({top:0,behavior:'instant'})},[]);
 useEffect(()=>{const change=()=>setRoute(initialRoute());window.addEventListener('popstate',change);return()=>window.removeEventListener('popstate',change)},[]);
 useEffect(()=>{localStorage.setItem('courtly-language',lang);document.documentElement.lang=lang},[lang]);
 const notify=useCallback(s=>{clearTimeout(timer.current);setToast(s);timer.current=setTimeout(()=>setToast(''),6000)},[]);
 const refresh=useCallback(async()=>{const id=++serial.current;try{const [d,c,ps]=await Promise.all([api(`${user?'/overview':'/public/overview'}?date=${date}`),api('/public/content'),user?api('/transfers'):Promise.resolve([])]);if(id===serial.current){setData(d);setContent(c);setTransfers(ps);setError('')}}catch(e){if(id===serial.current)setError(e.message);throw e}finally{if(id===serial.current)setLoading(false)}},[date,user?.id]);
 useEffect(()=>{setLoading(true);refresh().catch(()=>{})},[refresh]);
 useEffect(()=>()=>clearTimeout(timer.current),[]);
 const login=()=>setAuth(true),logout=async()=>{try{await onLogout();setData(null);setTransfers([]);setDialog(null);setMoveOrder(null);navigate('about')}catch(e){notify(e.message)}};
 const pay=(type,targetId,purpose='DEPOSIT',existing)=>{
  if(!user){login();return;}
  if(existing){setDialog({kind:'payment',intent:existing});return;}
  setDialog({kind:'payment-choice',type,targetId,purpose});
 };
 const choosePayment=async method=>{
  if(method==='CASH'){setDialog(null);notify(t('Vui lòng thanh toán tại quầy trước khi hết hạn giữ chỗ. Nhân viên sẽ xác nhận số tiền thực thu.'));return;}
  try{const x=await api('/transfers','POST',{type:dialog.type,targetId:dialog.targetId,purpose:dialog.purpose});setDialog({kind:'payment',intent:x});refresh().catch(()=>{})}catch(e){notify(e.message)}
 };
 useEffect(()=>{
  if(route!=='booking'&&route!=='orders'&&route!=='history')return;
  const timer=setInterval(()=>refresh().catch(()=>{}),10000);
  return()=>clearInterval(timer);
 },[route,refresh]);
 const value={t,lang,setLang,user,route,navigate,date,setDate,data,content,club:content.club||data?.club||{},transfers,refresh,notify,login,logout,preferredZone,setPreferredZone,moveOrder,setMoveOrder,show:setDialog,pay};
 const protectedRoute=['profile','orders','history','payments','cashdesk'].includes(route);
 return <GuestContext.Provider value={value}><div id="courtly-balanced-amenities" lang={lang}><Header/><main>{error&&<div className="gx-error gx-global-error" role="alert">{t(error)} <button onClick={()=>refresh().catch(()=>{})}>{t('Thử lại')}</button></div>}{loading&&!data?<div className="ct-pad" role="status">{t('Đang tải dữ liệu…')}</div>:<>{route==='about'&&<Overview/>}{route==='pricing'&&<Pricing/>}<div hidden={route!=='booking'}><Booking/></div>{protectedRoute&&!user?<section className="ct-pad gx-login-required"><h1>{t('Đăng nhập để xem tài khoản')}</h1><Action onClick={login}>{t('Đăng nhập')}</Action></section>:<>{route==='orders'&&<Orders/>}{route==='history'&&<Orders history/>}{route==='payments'&&<Payments/>}{route==='profile'&&<Profile/>}{route==='cashdesk'&&<CashDesk/>}</>}{route==='membership'&&<Membership/>}{route==='tournaments'&&<Tournaments/>}{route==='news'&&<News/>}{route==='feedback'&&<Feedback/>}{route==='contact'&&<Contact/>}{route==='policies'&&<Policies/>}</>}</main><Footer/>{auth?<Modal title={t('Đóng đăng nhập')} onClose={()=>setAuth(false)}><GuestAuth onSuccess={async s=>{onSession(s);setAuth(false);if(s.user.role==='ADMIN'){location.assign('/app')}}}/> </Modal>:dialog&&<Modal title={t('Đóng')} onClose={()=>setDialog(null)}>{dialog.kind==='payment-choice'?<PaymentChoice onChoose={choosePayment}/>:dialog.kind==='payment'?<PaymentDialog intent={dialog.intent} onClose={()=>setDialog(null)}/>:dialog.kind==='event'?<EventDialog event={dialog.event} onClose={()=>setDialog(null)}/>:dialog.kind==='article'?<Article article={dialog.article}/>:dialog.kind==='cancel'?<CancelDialog order={dialog.order} onClose={()=>setDialog(null)}/>:null}</Modal>}<div className="gx-toast" role="status" aria-live="polite">{toast&&t(toast)}</div></div></GuestContext.Provider>;
}
