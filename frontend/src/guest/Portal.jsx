import React,{useState,useEffect,useCallback,useRef,useMemo} from 'react';
import {X} from 'lucide-react';
import {api} from '../services/api';
import {GuestContext,translate,dateToday,Action,money} from './context';
import {Header,Footer} from './Layout';
import Overview from './Overview';
import Booking from './Booking';
import Pricing from './Pricing.jsx';
import NoticeBar from './NoticeBar.jsx';
import { isOverdueDebt } from '../utils/order-timing.mjs';
import CashDesk from './CashDesk';
import Tournaments,{EventDialog} from './Tournaments';
import {News,Article,Contact,Feedback,Policies} from './Content';
import {Orders,CancelDialog,Membership,Profile,TicketDialog,ZaloZnsDialog,ExtendCourtDialog} from './Account';
import Payments,{PaymentDialog,PaymentChoice} from './Payments';
import GuestAuth from './Auth';
import MyLoyalty from '../pages/MyLoyalty';
import MyVouchers from '../pages/MyVouchers';
import { CourtlyContext } from '../context';
import AiChatbox from './AiChatbox';
import './handoff.css';
import './guest.css';
import './booking.css';
import './header.css';
import './footer.css';
import { withArchivedCourts } from '../utils/courts';

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

const paths={about:'/',booking:'/dat-san',pricing:'/bang-gia',cashdesk:'/quay-thu',news:'/tin-tuc',contact:'/lien-he',feedback:'/feedback',tournaments:'/giai-dau',membership:'/thanh-vien',orders:'/tai-khoan/don',history:'/tai-khoan/lich',payments:'/tai-khoan/thanh-toan',profile:'/tai-khoan',policies:'/chinh-sach',loyalty:'/tai-khoan/hang-diem',vouchers:'/tai-khoan/uu-dai'};
const initialRoute=()=>{ if(location.pathname==='/membership'){ window.history.replaceState({}, '', '/thanh-vien'); return 'membership'; } if(location.pathname==='/thanh-vien') return 'membership';
  if(location.pathname==='/tai-khoan/hang-diem') return 'loyalty';
  if(location.pathname==='/tai-khoan/uu-dai') return 'vouchers'; return Object.entries(paths).find(([,p])=>p===location.pathname)?.[0]||({orders:'orders',history:'history',payments:'payments','profile-orders':'orders','profile-history':'history','profile-payments':'payments','profile-membership':'membership','profile-loyalty':'loyalty','profile-vouchers':'vouchers',loyalty:'loyalty',vouchers:'vouchers',profile:'profile',tournaments:'tournaments'})[location.hash.slice(1)]||'about'; };


function AccountNav({ active, navigate, t }) {
  const tabs = [
    { id: 'profile', label: 'Hồ sơ', icon: '👤' },
    { id: 'loyalty', label: 'Hạng & Điểm', icon: '👑' },
    { id: 'vouchers', label: 'Ưu đãi của tôi', icon: '🎁' },
    { id: 'orders', label: 'Đơn hiện tại', icon: '📋' },
    { id: 'history', label: 'Lịch sử sân', icon: '📅' },
    { id: 'payments', label: 'Thanh toán', icon: '💳' }
  ];
  return (
    <nav className="ct-pad" style={{ paddingBottom: 0, paddingTop: 16 }}>
      <div style={{
        display: 'flex',
        gap: 8,
        overflowX: 'auto',
        borderBottom: '1px solid #e2e8f0',
        paddingBottom: 8,
        whiteSpace: 'nowrap'
      }}>
        {tabs.map(tab => (
          <button
            key={tab.id}
            type="button"
            onClick={() => navigate(tab.id)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '7px 14px',
              borderRadius: 20,
              border: active === tab.id ? '1.5px solid #173c32' : '1px solid #e2e8f0',
              background: active === tab.id ? '#173c32' : '#ffffff',
              color: active === tab.id ? '#def46a' : '#475569',
              fontWeight: active === tab.id ? 700 : 500,
              fontSize: 13,
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
          >
            <span>{tab.icon}</span>
            <span>{t(tab.label)}</span>
          </button>
        ))}
      </div>
    </nav>
  );
}

export default function Portal({session,onSession,onLogout}){
    const [activeCampaignBanners, setActiveCampaignBanners] = useState([]);
  const [unsubscribeModalOpen, setUnsubscribeModalOpen] = useState(false);

  useEffect(() => {
    api('/public/campaigns/active-banners')
      .then(data => { if (Array.isArray(data)) setActiveCampaignBanners(data); })
      .catch(() => {});

    if (location.pathname === '/huy-nhan-tin') {
      const params = new URLSearchParams(location.search);
      const token = params.get('token');
      if (token) {
        api('/public/campaigns/unsubscribe', 'POST', { token })
          .then(() => setUnsubscribeModalOpen(true))
          .catch(() => {});
      } else {
        setUnsubscribeModalOpen(true);
      }
    }
  }, []);

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
        [bannerDismissed,setBannerDismissed]=useState(false),
        [paymentBannerDismissed,setPaymentBannerDismissed]=useState(false),
        [membershipBannerDismissed,setMembershipBannerDismissed]=useState(()=>{
          try { return sessionStorage.getItem('courtly_membership_banner_dismissed') === 'true'; } catch { return false; }
        }),
        [tourneyBannerDismissed,setTourneyBannerDismissed]=useState(()=>{
          try { return sessionStorage.getItem('courtly_tourney_banner_dismissed') === 'true'; } catch { return false; }
        });
  const [debtBannerDismissed, setDebtBannerDismissed] = useState(false);

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

  const navigate=useCallback((id, options = {})=>{
    if (id === 'booking' && !options?.keepMoveOrder) {
      setMoveOrder(null);
    }
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
        setData(withArchivedCourts(d));
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

  const VALID_AUTH_MODES = ['login', 'register', 'activate', 'activate-otp', 'reset-password'];
  const login = (mode = 'login', ctx = null) => {
    const validMode = (typeof mode === 'string' && VALID_AUTH_MODES.includes(mode)) ? mode : 'login';
    const validCtx = (ctx && typeof ctx === 'object' && !(ctx.nativeEvent || ctx.target)) ? ctx : null;
    setAuthMode(validMode);
    setAuthContext(validCtx);
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

// Auto-login on booking route removed (P2)

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

  const protectedRoute=['profile','orders','history','payments','cashdesk','loyalty','vouchers'].includes(route);

  const myOrders = useMemo(() => {
    if (!user || !data?.orders) return [];
    return data.orders.filter(o => o.accountId === user.id || o.email === user.email || o.phone === user.phone);
  }, [user, data?.orders]);

  const hasAnyBooking = myOrders.length > 0;

  const overdueDebtOrder = useMemo(() => {
    if (!user) return null;
    return myOrders.find(o => isOverdueDebt(o));
  }, [user, myOrders]);

  useEffect(() => {
    if (user?.id && hasAnyBooking) {
      try {
        localStorage.setItem('courtly_welcome_dismissed_' + (user?.id || ''), 'true');
        setWelcomeBannerDismissed(true);
      } catch {}
    }
  }, [user?.id, hasAnyBooking]);

  const todayMatch = user && !bannerDismissed && data?.orders?.find(o => {
    const oDate = o.date || o.slots?.[0]?.scheduleDate || '';
    const isMine = o.accountId === user.id || o.email === user.email || o.phone === user.phone;
    return isMine && oDate === dateToday() && ['CONFIRMED', 'CHECKED_IN'].includes(o.status);
  });

  const pendingPaymentOrder = useMemo(() => {
    if (!user || paymentBannerDismissed) return null;
    return myOrders.find(o => ['HOLDING', 'PENDING'].includes(o.status) && (o.paid || 0) < (o.deposit || o.total || 0));
  }, [user, myOrders, paymentBannerDismissed]);

  const isNewCustomer = useMemo(() => {
    if (!user || user.role !== 'CUSTOMER') return false;
    if (hasAnyBooking) return false;
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
  }, [user, hasAnyBooking]);

  const welcomeBannerVisible = user && !hasAnyBooking && !overdueDebtOrder && isNewCustomer && !welcomeBannerDismissed;

  const hasActiveMembership = useMemo(() => {
    if (!user || !data?.memberships) return false;
    return data.memberships.some(m => m.status === 'ACTIVE');
  }, [user, data?.memberships]);

  const membershipBannerVisible = user && hasAnyBooking && !hasActiveMembership && !membershipBannerDismissed;

  const featuredTournament = useMemo(() => {
    if (!data?.tournaments) return null;
    return data.tournaments.find(t => t.status === 'OPEN' && t.start >= dateToday());
  }, [data?.tournaments]);

  const tournamentBannerVisible = user && hasAnyBooking && featuredTournament && !tourneyBannerDismissed;

  const notices = useMemo(() => {
    const list = [];

    // Priority 1: Nợ quá hạn
    if (overdueDebtOrder && !debtBannerDismissed) {
      list.push({
        key: 'debt',
        icon: '🚨',
        accent: '#fef08a',
        bg: 'linear-gradient(90deg, #991b1b 0%, #b91c1c 60%, #7f1d1d 100%)',
        borderBottom: '1px solid rgba(254, 202, 202, 0.4)',
        title: t('Cảnh báo: Đơn quá hạn chưa thanh toán đủ tiền'),
        badge: `${t('CÒN NỢ')}: ${money((overdueDebtOrder.total || 0) - (overdueDebtOrder.paid || 0))}`,
        badgeBg: '#fef08a',
        badgeColor: '#991b1b',
        desc: `${t('Đơn')} #${overdueDebtOrder.id.slice(0, 8).toUpperCase()} (${overdueDebtOrder.date}) ${t('chưa tất toán. Theo chính sách CLB Courtly, quý khách vui lòng tất toán nợ cũ để được mở quyền đặt sân mới.')}`,
        actions: (
          <button
            type="button"
            onClick={() => setDialog({ kind: 'payment', order: overdueDebtOrder, intent: 'BALANCE' })}
            style={{
              background: '#fef08a',
              color: '#991b1b',
              border: 'none',
              padding: '6px 14px',
              borderRadius: 6,
              fontSize: 12,
              fontWeight: 800,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              whiteSpace: 'nowrap'
            }}
          >
            💳 {t('Tất toán nợ ngay')}
          </button>
        ),
        onDismiss: () => setDebtBannerDismissed(true)
      });
    }

    // Priority 2: Đơn giữ chỗ chờ thanh toán cọc
    if (pendingPaymentOrder && !paymentBannerDismissed) {
      list.push({
        key: 'pendingPayment',
        icon: '⚠️',
        accent: '#fef08a',
        bg: 'linear-gradient(90deg, #7c2d12 0%, #9a3412 100%)',
        title: t('Đơn giữ chỗ chờ thanh toán'),
        badge: t('CẦN THU CỌC'),
        badgeBg: '#ea580c',
        badgeColor: '#ffffff',
        desc: `${t('Đơn')} #${pendingPaymentOrder.id.slice(0, 8).toUpperCase()} · ${pendingPaymentOrder.date} · ${t('Còn cần thanh toán')}: ${money((pendingPaymentOrder.deposit || pendingPaymentOrder.total || 0) - (pendingPaymentOrder.paid || 0))}`,
        actions: (
          <button
            type="button"
            onClick={() => setDialog({ kind: 'payment', order: pendingPaymentOrder })}
            style={{
              background: '#fef08a',
              color: '#7c2d12',
              border: 'none',
              padding: '6px 14px',
              borderRadius: 6,
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer',
              whiteSpace: 'nowrap'
            }}
          >
            💳 {t('Thanh toán cọc ngay')}
          </button>
        ),
        onDismiss: () => setPaymentBannerDismissed(true)
      });
    }

    // Priority 3: Lịch thi đấu hôm nay
    if (todayMatch && !bannerDismissed) {
      const courtName = data?.courts?.find(c => c.id === todayMatch.slots?.[0]?.court)?.name || t('Sân Tennis');
      const startH = todayMatch.slots?.[0]?.hour;
      const endH = (todayMatch.slots?.at(-1)?.hour || 0) + 1;
      list.push({
        key: 'todayMatch',
        icon: '🎾',
        accent: '#def46a',
        bg: 'linear-gradient(90deg, #173c32 0%, #1e4d40 100%)',
        title: t('Nhắc lịch thi đấu hôm nay'),
        badge: todayMatch.status === 'CHECKED_IN' ? t('● ĐANG TRÊN SÂN') : t('✓ SẴN SÀNG CHECK-IN'),
        badgeBg: todayMatch.status === 'CHECKED_IN' ? '#2563eb' : '#15803d',
        badgeColor: '#ffffff',
        desc: `${courtName} · ⏰ ${startH}:00 – ${endH}:00 · ${t('Mã vé')}: CT-${todayMatch.id.slice(0, 8).toUpperCase()}`,
        actions: (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'nowrap' }}>
            <button
              type="button"
              onClick={() => setDialog({ kind: 'ticket', order: todayMatch })}
              style={{
                background: '#def46a',
                color: '#173c32',
                border: 'none',
                padding: '6px 12px',
                borderRadius: 6,
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
                whiteSpace: 'nowrap'
              }}
            >
              🎫 {t('Mở Vé QR Check-in')}
            </button>
            {todayMatch.status === 'CHECKED_IN' && (
              <button
                type="button"
                onClick={() => setDialog({ kind: 'extend', order: todayMatch })}
                style={{
                  background: 'rgba(255,255,255,0.18)',
                  color: '#ffffff',
                  border: '1px solid rgba(255,255,255,0.35)',
                  padding: '6px 10px',
                  borderRadius: 6,
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap'
                }}
              >
                ⚡ {t('Gia hạn')}
              </button>
            )}
          </div>
        ),
        onDismiss: () => setBannerDismissed(true)
      });
    }

    // Priority 5: Voucher chào mừng
    if (welcomeBannerVisible) {
      list.push({
        key: 'welcome',
        icon: '🎁',
        accent: '#def46a',
        bg: 'linear-gradient(90deg, #13332b 0%, #1e4d40 60%, #163d33 100%)',
        borderBottom: '1px solid rgba(222, 244, 106, 0.35)',
        title: t('Ưu đãi chào mừng thành viên mới'),
        badge: t('GIẢM 50.000₫'),
        badgeBg: '#def46a',
        badgeColor: '#173c32',
        desc: `${t('Chào mừng')} ${user.name}! ${t('Tặng bạn Voucher')} WELCOME ${t('giảm 50k cho đơn đặt sân đầu tiên.')}`,
        actions: (
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
              if (route !== 'booking') navigate('booking');
              notify(t('Đã kích hoạt Voucher WELCOME (-50.000₫). Vui lòng chọn sân và khung giờ chơi!'));
            }}
            style={{
              background: '#def46a',
              color: '#173c32',
              border: 'none',
              padding: '6px 14px',
              borderRadius: 6,
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              whiteSpace: 'nowrap'
            }}
          >
            <span>🎾</span> {welcomeBannerApplied ? t('✓ Đã áp dụng') : t('Áp dụng ngay')}
          </button>
        ),
        onDismiss: () => {
          setShowWelcomeBanner(false);
          setWelcomeBannerDismissed(true);
          try {
            if (user?.id) localStorage.setItem(`courtly_welcome_dismissed_${user.id}`, 'true');
          } catch {}
        }
      });
    }

    // Priority 6: Giải đấu đang mở
    if (tournamentBannerVisible && !pendingPaymentOrder && featuredTournament) {
      list.push({
        key: 'tournament',
        icon: '🏆',
        accent: '#def46a',
        bg: 'linear-gradient(90deg, #14532d 0%, #052e16 100%)',
        borderBottom: '1px solid rgba(222, 244, 106, 0.3)',
        title: t('Giải đấu đang mở đăng ký'),
        badge: featuredTournament.name,
        badgeBg: '#15803d',
        badgeColor: '#ffffff',
        desc: `${t('Khởi tranh')} ${featuredTournament.start} · ${t('Hạn đăng ký')}: ${featuredTournament.deadline} · ${money(featuredTournament.fee)}`,
        actions: (
          <button
            type="button"
            onClick={() => navigate('tournaments')}
            style={{
              background: '#def46a',
              color: '#14532d',
              border: 'none',
              padding: '6px 12px',
              borderRadius: 6,
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer',
              whiteSpace: 'nowrap'
            }}
          >
            🎾 {t('Đăng ký giải')}
          </button>
        ),
        onDismiss: () => {
          setTourneyBannerDismissed(true);
          sessionStorage.setItem('courtly_tourney_banner_dismissed', 'true');
        }
      });
    }

    return list;
  }, [
    overdueDebtOrder, debtBannerDismissed, pendingPaymentOrder, paymentBannerDismissed,
    todayMatch, bannerDismissed, membershipBannerVisible, welcomeBannerVisible,
    tournamentBannerVisible, featuredTournament, welcomeBannerApplied, user, route, data?.courts, lang
  ]);

  return (
    <GuestContext.Provider value={value}>
      <div id="courtly-balanced-amenities" lang={lang}>
        <Header/>

        <NoticeBar notices={notices} t={t} />

        {user && ['profile', 'loyalty', 'vouchers', 'orders', 'history', 'payments'].includes(route) && (
          <AccountNav active={route} navigate={navigate} t={t} />
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
              <div hidden={route!=='booking'}><Booking/></div>
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
                  {route==='loyalty' && (
                    <CourtlyContext.Provider value={{ user, notify, data, navigate, isAdmin: false, isStaff: false, setActiveVoucherCode }}>
                      <div className="ct-pad">
                        <MyLoyalty />
                      </div>
                    </CourtlyContext.Provider>
                  )}
                  {route==='vouchers' && (
                    <CourtlyContext.Provider value={{ user, notify, data, navigate, isAdmin: false, isStaff: false, setActiveVoucherCode }}>
                      <div className="ct-pad">
                        <MyVouchers />
                      </div>
                    </CourtlyContext.Provider>
                  )}
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
        <AiChatbox/>

        {auth ? (
          <Modal title={t('Đóng đăng nhập')} onClose={()=>setAuth(false)} hideClose>
            <GuestAuth
              initialMode={authMode}
              context={authContext}
              onSuccess={async s=>{
                onSession(s);
                setAuth(false);
                if(['ADMIN','STAFF'].includes(s.user.role)){
                  location.replace('/app#operations');
                  return;
                }
                const userHasOrders = (data?.orders || []).some(o => o.accountId === s.user.id || o.email === s.user.email);
                const voucherUsed = localStorage.getItem(`courtly_welcome_used_${s.user.id}`) === 'true';
                const voucherDismissed = localStorage.getItem(`courtly_welcome_dismissed_${s.user.id}`) === 'true';

                if (!userHasOrders && !voucherUsed && !voucherDismissed) {
                  setShowWelcomeBanner(true);
                  setWelcomeBannerDismissed(false);
                  if (authContext?.targetRoute) { navigate(authContext.targetRoute); } else if (authContext?.from === 'booking' || route === 'booking') {
                    navigate('booking');
                    setActiveVoucherCode('WELCOME');
                    setWelcomeBannerApplied(true);
                    notify(t('Chào mừng bạn! Mã ưu đãi WELCOME (-50.000₫) đã được chuẩn bị cho đơn đầu tiên.'));
                  } else {
                    notify(`${t('Chào mừng')} ${s.user.name || t('bạn')}! ${t('Nhận ngay voucher WELCOME giảm 50.000₫ cho đơn đầu tiên.')}`);
                  }
                } else {
                  setShowWelcomeBanner(false);
                  setWelcomeBannerDismissed(true);
                  notify(`${t('Chào mừng trở lại')}, ${s.user.name || t('bạn')}!`);
                  if (authContext?.targetRoute) { navigate(authContext.targetRoute); } else if (authContext?.from === 'booking' || route === 'booking') {
                    navigate('booking');
                  }
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
