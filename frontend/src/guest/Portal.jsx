import React,{useState,useEffect,useCallback,useRef,useMemo} from 'react';
import {X} from 'lucide-react';
import {api} from '../services/api';
import {GuestContext,translate,dateToday,Action} from './context';
import {Header,Footer} from './Layout';
import Overview from './Overview';
import Booking from './Booking';
import Pricing from './Pricing.jsx';
import CashDesk from './CashDesk';
import Tournaments,{EventDialog} from './Tournaments';
import {News,Article,Contact,Feedback,Policies} from './Content';
import {Orders,CancelDialog,Membership,Profile,TicketDialog,ZaloZnsDialog,ExtendCourtDialog} from './Account';
import Payments,{PaymentDialog,PaymentChoice} from './Payments';
import GuestAuth from './Auth';
import './handoff.css';
import './guest.css';
import './booking.css';
import './header.css';
import './footer.css';

function Modal({children,onClose,title,hideClose}){
  const ref=useRef();
  useEffect(()=>{
    const old=document.activeElement,overflow=document.body.style.overflow;
    document.body.style.overflow='hidden';
    ref.current?.querySelector('button,input')?.focus();
    const handler=e=>{
      if(e.key==='Escape')onClose();
      if(e.key==='Tab'){
        const all=[...ref.current.querySelectorAll('button,input,select,textarea,a[href],summary')].filter(x=>!x.disabled&&x.getClientRects().length);
        if(e.shiftKey&&document.activeElement===all[0]){e.preventDefault();all.at(-1)?.focus()}
        else if(!e.shiftKey&&document.activeElement===all.at(-1)){e.preventDefault();all[0]?.focus()}
      }
    };
    document.addEventListener('keydown',handler);
    return()=>{
      document.body.style.overflow=overflow;
      document.removeEventListener('keydown',handler);
      old?.focus()
    }
  },[]);
  return <div className="gx-backdrop" onMouseDown={e=>e.target===e.currentTarget&&onClose()}><section className="gx-dialog" ref={ref} role="dialog" aria-modal="true" aria-label={title}>{!hideClose && <button className="gx-close" aria-label={title} onClick={onClose}><X/></button>}{children}</section></div>;
}

const paths={about:'/',booking:'/dat-san',pricing:'/bang-gia',cashdesk:'/quay-thu',news:'/tin-tuc',contact:'/lien-he',feedback:'/feedback',tournaments:'/giai-dau',membership:'/membership',orders:'/tai-khoan/don',history:'/tai-khoan/lich',payments:'/tai-khoan/thanh-toan',profile:'/tai-khoan',policies:'/chinh-sach'};
const initialRoute=()=>Object.entries(paths).find(([,p])=>p===location.pathname)?.[0]||({orders:'orders',history:'history',payments:'payments','profile-orders':'orders','profile-history':'history','profile-payments':'payments','profile-membership':'membership',profile:'profile',tournaments:'tournaments'})[location.hash.slice(1)]||'about';

export default function Portal({session,onSession,onLogout}){
  const [lang,setLang]=useState(()=>localStorage.getItem('courtly-language')||'vi'),
        [route,setRoute]=useState(initialRoute),
        [date,setDate]=useState(dateToday),
        [data,setData]=useState(null),
        [content,setContent]=useState({}),
        [transfers,setTransfers]=useState([]),
        [loading,setLoading]=useState(true),
        [error,setError]=useState(''),
        [dialog,setDialog]=useState(null),
        [auth,setAuth]=useState(false),
        [authMode,setAuthMode]=useState('login'),
        [authContext,setAuthContext]=useState(null),
        [activeVoucherCode,setActiveVoucherCode]=useState(null),
        [showWelcomeBanner,setShowWelcomeBanner]=useState(false),
        [welcomeBannerApplied,setWelcomeBannerApplied]=useState(false),
        [welcomeBannerDismissed,setWelcomeBannerDismissed]=useState(()=>{
          try {
            const u = session?.user;
            if (!u?.id) return false;
            return localStorage.getItem(`courtly_welcome_dismissed_${u.id}`) === 'true';
          } catch {
            return false;
          }
        }),
        [preferredZone,setPreferredZone]=useState(()=>new URLSearchParams(location.search).get('khu')||'ALL'),
        [moveOrder,setMoveOrder]=useState(null),
        [toast,setToast]=useState(''),
        [bannerDismissed,setBannerDismissed]=useState(false);

  const serial=useRef(0),timer=useRef();
  const user=session?.authenticated?session.user:null;

  useEffect(() => {
    if (user?.id) {
      try {
        setWelcomeBannerDismissed(localStorage.getItem(`courtly_welcome_dismissed_${user.id}`) === 'true');
      } catch {}
    }
  }, [user?.id]);
  const t=useCallback(s=>translate(lang,s),[lang]);

  const navigate=useCallback(id=>{
    setRoute(id);
    history.pushState(null,'',paths[id]||'/');
    window.scrollTo({top:0,behavior:'instant'});
  },[]);

  useEffect(()=>{
    const change=()=>setRoute(initialRoute());
    window.addEventListener('popstate',change);
    return()=>window.removeEventListener('popstate',change);
  },[]);

  useEffect(()=>{
    localStorage.setItem('courtly-language',lang);
    document.documentElement.lang=lang;
  },[lang]);

  const notify=useCallback(s=>{
    clearTimeout(timer.current);
    setToast(s);
    timer.current=setTimeout(()=>setToast(''),6000);
  },[]);

  const refresh=useCallback(async()=>{
    const id=++serial.current;
    try{
      const [d,c,ps]=await Promise.all([
        api(`${user?'/overview':'/public/overview'}?date=${date}`),
        api('/public/content'),
        user?api('/transfers'):Promise.resolve([])
      ]);
      if(id===serial.current){
        setData(d);
        setContent(c);
        setTransfers(ps);
        setError('');
      }
    }catch(e){
      if(id===serial.current)setError(e.message);
      throw e;
    }finally{
      if(id===serial.current)setLoading(false);
    }
  },[date,user?.id]);

  useEffect(()=>{
    setLoading(true);
    refresh().catch(()=>{});
    const interval = setInterval(() => refresh().catch(()=>{}), 30000);
    const onFocus = () => refresh().catch(()=>{});
    window.addEventListener('focus', onFocus);
    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', onFocus);
    };
  },[refresh]);

  useEffect(()=>()=>clearTimeout(timer.current),[]);

  const login=(mode='login',ctx=null)=>{
    setAuthMode(mode);
    setAuthContext(ctx);
    setAuth(true);
  };

  const logout=async()=>{
    try{
      await onLogout();
      setData(null);
      setTransfers([]);
      setDialog(null);
      setMoveOrder(null);
      setShowWelcomeBanner(false);
      setActiveVoucherCode(null);
      navigate('about');
    }catch(e){
      notify(e.message);
    }
  };

  useEffect(()=>{
    if(route==='booking'&&!user){
      login('login',{from:'booking'});
    }
  },[route,user]);

  const pay=(type,targetId,purpose='DEPOSIT',existing)=>{
    if(!user){login();return;}
    if(existing){setDialog({kind:'payment',intent:existing});return;}
    setDialog({kind:'payment-choice',type,targetId,purpose});
  };

  const choosePayment=async method=>{
    if(method==='CASH'){
      setDialog(null);
      notify(t('Vui lòng thanh toán tại quầy trước khi hết hạn giữ chỗ. Nhân viên sẽ xác nhận số tiền thực thu.'));
      return;
    }
    try{
      const x=await api('/transfers','POST',{type:dialog.type,targetId:dialog.targetId,purpose:dialog.purpose});
      setDialog({kind:'payment',intent:x});
      refresh().catch(()=>{});
    }catch(e){
      notify(e.message);
    }
  };

  useEffect(()=>{
    if(route!=='booking'&&route!=='orders'&&route!=='history')return;
    const interval=setInterval(()=>refresh().catch(()=>{}),10000);
    return()=>clearInterval(interval);
  },[route,refresh]);

  const value={
    t,lang,setLang,user,route,navigate,date,setDate,
    data,content,club:content.club||data?.club||{},
    transfers,refresh,notify,login,logout,
    preferredZone,setPreferredZone,moveOrder,setMoveOrder,
    show:setDialog,pay,
    activeVoucherCode,setActiveVoucherCode,
    showWelcomeBanner,setShowWelcomeBanner,
    welcomeBannerApplied,setWelcomeBannerApplied
  };

  const protectedRoute=['profile','orders','history','payments','cashdesk'].includes(route);

  const todayMatch = user && !bannerDismissed && data?.orders?.find(o => {
    const oDate = o.date || o.slots?.[0]?.scheduleDate || '';
    return oDate === dateToday() && ['CONFIRMED', 'CHECKED_IN'].includes(o.status);
  });

  const isNewCustomer = useMemo(() => {
    if (!user || user.role !== 'CUSTOMER') return false;
    if (!data || !Array.isArray(data.orders)) return false;
    if (data.orders.length > 0) return false;
    try {
      if (localStorage.getItem(`courtly_welcome_used_${user.id}`) === 'true') return false;
      if (localStorage.getItem(`courtly_welcome_dismissed_${user.id}`) === 'true') return false;
    } catch {}
    if (user.createdAt) {
      const createdTime = new Date(user.createdAt).getTime();
      const ageDays = (Date.now() - createdTime) / (1000 * 60 * 60 * 24);
      if (ageDays > 7) return false;
    }
    return true;
  }, [user, data]);

  const welcomeBannerVisible = user && (showWelcomeBanner || isNewCustomer) && !welcomeBannerDismissed;

  return (
    <GuestContext.Provider value={value}>
      <div id="courtly-balanced-amenities" lang={lang}>
        <Header/>

        {todayMatch && (
          <aside className="gx-match-reminder-banner" style={{background:'linear-gradient(90deg, #173c32 0%, #1e4d40 100%)',color:'#ffffff',padding:'11px 24px',boxShadow:'0 4px 14px rgba(23,60,50,0.18)',display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:12,position:'sticky',top:60,zIndex:90}}>
            <div style={{display:'flex',alignItems:'center',gap:12}}>
              <span style={{fontSize:22}}>🎾</span>
              <div>
                <div style={{display:'flex',alignItems:'center',gap:8}}>
                  <strong style={{color:'#def46a',fontSize:13,textTransform:'uppercase',letterSpacing:0.5}}>{t('Nhắc lịch thi đấu hôm nay')}</strong>
                  <span style={{background:todayMatch.status==='CHECKED_IN'?'#2563eb':'#15803d',color:'#fff',fontSize:10.5,fontWeight:700,padding:'2px 8px',borderRadius:10}}>
                    {todayMatch.status==='CHECKED_IN'?t('● ĐANG TRÊN SÂN'):t('✓ SẴN SÀNG CHECK-IN')}
                  </span>
                </div>
                <span style={{fontSize:13,color:'#e2ebd9',display:'block',marginTop:2}}>
                  {data?.courts?.find(c=>c.id===todayMatch.slots?.[0]?.court)?.name||t('Sân Tennis')} · ⏰ <b>{todayMatch.slots?.[0]?.hour}:00 – {(todayMatch.slots?.at(-1)?.hour||0)+1}:00</b> · {t('Mã vé')}: <b style={{color:'#def46a',fontFamily:'monospace'}}>CT-{todayMatch.id.slice(0,8).toUpperCase()}</b>
                </span>
              </div>
            </div>
            <div style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap'}}>
              <button type="button" onClick={()=>setDialog({kind:'ticket',order:todayMatch})} style={{background:'#def46a',color:'#173c32',border:'none',padding:'7px 14px',borderRadius:6,fontSize:12.5,fontWeight:700,cursor:'pointer'}}>
                🎫 {t('Mở Vé QR Check-in')}
              </button>
              {todayMatch.status==='CHECKED_IN' && (
                <button type="button" onClick={()=>setDialog({kind:'extend',order:todayMatch})} style={{background:'rgba(255,255,255,0.18)',color:'#ffffff',border:'1px solid rgba(255,255,255,0.35)',padding:'7px 12px',borderRadius:6,fontSize:12.5,fontWeight:600,cursor:'pointer'}}>
                  ⚡ {t('Gia hạn')}
                </button>
              )}
              <button type="button" onClick={()=>setBannerDismissed(true)} aria-label="Đóng thông báo" style={{background:'transparent',border:'none',color:'rgba(255,255,255,0.7)',fontSize:18,cursor:'pointer',padding:'4px 8px'}}>
                ✕
              </button>
            </div>
          </aside>
        )}

        {welcomeBannerVisible && (
          <aside className="gx-welcome-voucher-banner" style={{
            background: 'linear-gradient(90deg, #13332b 0%, #1e4d40 60%, #163d33 100%)',
            color: '#ffffff',
            padding: '12px 24px',
            boxShadow: '0 4px 16px rgba(19, 51, 43, 0.25)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 12,
            position: 'sticky',
            top: todayMatch ? 116 : 60,
            zIndex: 89,
            borderBottom: '1px solid rgba(222, 244, 106, 0.35)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <span style={{ fontSize: 26, filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))' }}>🎁</span>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <strong style={{ color: '#def46a', fontSize: 13, textTransform: 'uppercase', letterSpacing: 0.6 }}>
                    {t('Ưu đãi chào mừng thành viên mới')}
                  </strong>
                  <span style={{ background: '#def46a', color: '#173c32', fontSize: 10.5, fontWeight: 800, padding: '2px 8px', borderRadius: 10 }}>
                    {t('GIẢM 50.000₫')}
                  </span>
                </div>
                <span style={{ fontSize: 13.5, color: '#e2ebd9', display: 'block', marginTop: 3 }}>
                  {t('Chào mừng')} <b>{user.name}</b>! {t('Tặng bạn Voucher')} <b style={{
                    background: 'rgba(255,255,255,0.15)',
                    border: '1px dashed #def46a',
                    padding: '2px 8px',
                    borderRadius: 4,
                    color: '#def46a',
                    fontFamily: 'monospace',
                    letterSpacing: 1
                  }}>WELCOME</b> {t('giảm 50k cho đơn đặt sân đầu tiên.')}
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => {
                  setActiveVoucherCode('WELCOME');
                  setWelcomeBannerApplied(true);
                  setShowWelcomeBanner(false);
                  setWelcomeBannerDismissed(true);
                  try {
                    if (user?.id) localStorage.setItem(`courtly_welcome_dismissed_${user.id}`, 'true');
                  } catch {}
                  if (route !== 'booking') {
                    navigate('booking');
                  }
                  notify(t('Đã kích hoạt Voucher WELCOME (-50.000₫). Vui lòng chọn sân và khung giờ chơi!'));
                }}
                style={{
                  background: '#def46a',
                  color: '#173c32',
                  border: 'none',
                  padding: '8px 18px',
                  borderRadius: 6,
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                  transition: 'all 0.15s ease'
                }}
              >
                <span>🎾</span> {welcomeBannerApplied ? t('✓ Đã áp dụng') : t('Áp dụng ngay')}
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowWelcomeBanner(false);
                  setWelcomeBannerDismissed(true);
                  try {
                    if (user?.id) localStorage.setItem(`courtly_welcome_dismissed_${user.id}`, 'true');
                  } catch {}
                }}
                aria-label={t('Đóng thông báo')}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'rgba(255,255,255,0.7)',
                  fontSize: 18,
                  cursor: 'pointer',
                  padding: '4px 8px'
                }}
              >
                ✕
              </button>
            </div>
          </aside>
        )}

        <main>
          {error && (
            <div className="gx-error gx-global-error" role="alert">
              {t(error)} <button onClick={()=>refresh().catch(()=>{})}>{t('Thử lại')}</button>
            </div>
          )}

          {loading && !data ? (
            <div className="ct-pad" role="status">{t('Đang tải dữ liệu…')}</div>
          ) : (
            <>
              {route==='about' && <Overview/>}
              {route==='pricing' && <Pricing/>}
              {route==='booking' && !user ? (
                <section className="ct-pad gx-login-required" style={{textAlign:'center',padding:'80px 24px',maxWidth:580,margin:'0 auto'}}>
                  <div style={{width:64,height:64,borderRadius:'50%',background:'rgba(23,60,50,0.08)',color:'#173c32',display:'inline-flex',alignItems:'center',justifyContent:'center',marginBottom:20}}>
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                  </div>
                  <h1 style={{fontSize:26,fontWeight:700,color:'#173c32',marginBottom:12}}>
                    {t('Đăng nhập để đặt sân trực tuyến')}
                  </h1>
                  <p style={{color:'#52655a',fontSize:15,lineHeight:1.6,marginBottom:18}}>
                    {t('Để đảm bảo tính xác thực của lịch đặt và giữ chỗ sân theo thời gian thực, vui lòng đăng nhập hoặc tạo tài khoản Courtly trước khi chọn khung giờ.')}
                  </p>
                  <div style={{display:'inline-flex',alignItems:'center',gap:8,background:'#f0fdf4',border:'1px solid #bbf7d0',borderRadius:8,padding:'8px 16px',marginBottom:24,fontSize:13.5,color:'#166534'}}>
                    <span>🎁</span>
                    <span>{t('Đăng ký tài khoản mới nhận ngay Voucher')} <b style={{background:'#def46a',padding:'2px 6px',borderRadius:4,color:'#173c32'}}>WELCOME 50.000₫</b></span>
                  </div>
                  <div style={{display:'flex',justifyContent:'center',gap:12,flexWrap:'wrap'}}>
                    <Action onClick={()=>login('login', { from: 'booking' })} style={{padding:'12px 30px',fontSize:15}}>
                      {t('Đăng nhập')}
                    </Action>
                    <button
                      type="button"
                      onClick={()=>login('register', { from: 'booking' })}
                      style={{
                        background:'#def46a',
                        color:'#173c32',
                        border:'none',
                        borderRadius:8,
                        padding:'12px 26px',
                        fontSize:15,
                        fontWeight:700,
                        cursor:'pointer',
                        display:'inline-flex',
                        alignItems:'center',
                        gap:6
                      }}
                    >
                      <span>🎁</span> {t('Đăng ký nhận 50k')}
                    </button>
                  </div>
                </section>
              ) : (
                <div hidden={route!=='booking'}><Booking/></div>
              )}
              {protectedRoute && !user ? (
                <section className="ct-pad gx-login-required">
                  <h1>{t('Đăng nhập để xem tài khoản')}</h1>
                  <Action onClick={()=>login('login')}>{t('Đăng nhập')}</Action>
                </section>
              ) : (
                <>
                  {route==='orders' && <Orders/>}
                  {route==='history' && <Orders history/>}
                  {route==='payments' && <Payments/>}
                  {route==='profile' && <Profile/>}
                  {route==='cashdesk' && <CashDesk/>}
                </>
              )}
              {route==='membership' && <Membership/>}
              {route==='tournaments' && <Tournaments/>}
              {route==='news' && <News/>}
              {route==='feedback' && <Feedback/>}
              {route==='contact' && <Contact/>}
              {(route==='policies' || route==='rules') && <Policies/>}
            </>
          )}
        </main>

        <Footer/>

        {auth ? (
          <Modal title={t('Đóng đăng nhập')} onClose={()=>setAuth(false)} hideClose>
            <GuestAuth
              initialMode={authMode}
              context={authContext}
              onSuccess={async s=>{
                onSession(s);
                setAuth(false);
                if(['ADMIN','STAFF'].includes(s.user.role)){
                  location.assign('/app');
                  return;
                }
                setShowWelcomeBanner(true);
                sessionStorage.removeItem('courtly_welcome_dismissed');
                setWelcomeBannerDismissed(false);
                if(authContext?.from==='booking'||route==='booking'){
                  navigate('booking');
                  setActiveVoucherCode('WELCOME');
                  setWelcomeBannerApplied(true);
                  notify(t('Chào mừng bạn! Mã ưu đãi WELCOME (-50.000₫) đã được chuẩn bị cho đơn đặt sân của bạn.'));
                }else{
                  notify(t(`Chào mừng ${s.user.name||'bạn'}! Nhận ngay voucher WELCOME giảm 50.000₫.`));
                }
              }}
            />
          </Modal>
        ) : dialog && (
          <Modal title={t('Đóng')} onClose={()=>setDialog(null)}>
            {dialog.kind==='ticket'?<TicketDialog order={dialog.order} onClose={()=>setDialog(null)}/>
            :dialog.kind==='zalo'?<ZaloZnsDialog order={dialog.order} onClose={()=>setDialog(null)}/>
            :dialog.kind==='extend'?<ExtendCourtDialog order={dialog.order} onClose={()=>setDialog(null)}/>
            :dialog.kind==='payment-choice'?<PaymentChoice onChoose={choosePayment}/>
            :dialog.kind==='payment'?<PaymentDialog intent={dialog.intent} onClose={()=>setDialog(null)}/>
            :dialog.kind==='event'?<EventDialog event={dialog.event} onClose={()=>setDialog(null)}/>
            :dialog.kind==='article'?<Article article={dialog.article}/>
            :dialog.kind==='cancel'?<CancelDialog order={dialog.order} onClose={()=>setDialog(null)}/>
            :null}
          </Modal>
        )}

        <div className="gx-toast" role="status" aria-live="polite">
          {toast && t(toast)}
        </div>
      </div>
    </GuestContext.Provider>
  );
}
