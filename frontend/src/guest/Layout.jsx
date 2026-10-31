import React, { useState, useMemo, useRef, useEffect } from 'react';
import { ArrowUpRight, Menu, LogOut, ChevronDown, Phone, Mail, MapPin, Clock, Bell, CheckCheck } from 'lucide-react';
import { money, today as dateToday } from '../utils/format';
import {useGuest} from './context';
import {customerNavigation} from '../navigation';
export function Logo(){const {navigate,t}=useGuest();return <button className="ct-logo" onClick={()=>navigate('about')} aria-label={t('Courtly trang chủ')}><img src="/favicon.svg" width="38" height="38" alt=""/><span className="ct-original-wordmark">Courtly<em>TENNIS CLUB</em></span></button>;}

export function CustomerNotifications() {
  const { t, user, data, navigate, show, pay } = useGuest();
  const [open, setOpen] = useState(false);
  const [readIds, setReadIds] = useState(() => {
    try {
      if (!user?.id) return [];
      const stored = localStorage.getItem(`courtly_read_notifs_${user.id}`);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  const menuRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  useEffect(() => {
    if (user?.id) {
      try {
        const stored = localStorage.getItem(`courtly_read_notifs_${user.id}`);
        setReadIds(stored ? JSON.parse(stored) : []);
      } catch {}
    }
  }, [user?.id]);

  const notifications = useMemo(() => {
    if (!user || !data) return [];
    const list = [];
    const todayStr = dateToday();
    const orders = data.orders || [];

    // 1. Matches today
    orders.forEach(o => {
      const oDate = o.date || o.slots?.[0]?.scheduleDate || '';
      const courtName = data.courts?.find(c => c.id === o.slots?.[0]?.court)?.name || t('Sân Tennis');
      const timeRange = `${o.slots?.[0]?.hour || 0}:00 – ${(o.slots?.at(-1)?.hour || 0) + 1}:00`;
      
      if (oDate === todayStr && o.status === 'CONFIRMED') {
        list.push({
          id: `match-today-${o.id}`,
          type: 'today_match',
          icon: '🎾',
          title: t('Trận đấu hôm nay sẵn sàng check-in'),
          description: `${courtName} · ⏰ ${timeRange} · Mã vé: CT-${o.id.slice(0, 8).toUpperCase()}`,
          date: oDate,
          actionLabel: t('Mở vé QR'),
          action: () => show({ kind: 'ticket', order: o }),
          urgent: true
        });
      } else if (oDate === todayStr && o.status === 'CHECKED_IN') {
        list.push({
          id: `match-playing-${o.id}`,
          type: 'playing',
          icon: '⚡',
          title: t('Đang sử dụng sân'),
          description: `${courtName} · ⏰ ${timeRange} · Quý khách có thể gia hạn thêm giờ nếu cần`,
          date: oDate,
          actionLabel: t('Gia hạn sân'),
          action: () => show({ kind: 'extend', order: o }),
          urgent: false
        });
      }
    });

    // 2. Orders holding / awaiting deposit
    orders.filter(o => o.status === 'HOLDING').forEach(o => {
      const courtName = data.courts?.find(c => c.id === o.slots?.[0]?.court)?.name || t('Sân Tennis');
      list.push({
        id: `order-holding-${o.id}`,
        type: 'deposit_due',
        icon: '⏳',
        title: t('Đơn giữ chỗ cần thanh toán cọc'),
        description: `Đơn #${o.id.slice(0, 8).toUpperCase()} (${courtName}) · Cọc cần thanh toán: ${money(o.deposit)}`,
        date: o.date,
        actionLabel: t('Thanh toán cọc'),
        action: () => pay('ORDER', o.id, 'DEPOSIT'),
        urgent: true
      });
    });

    // 3. Orders cancelled with refund status
    orders.filter(o => ['CANCELLED', 'EXPIRED'].includes(o.status)).forEach(o => {
      const settlement = o.cancellationSettlement || o.metadata?.cancellationSettlement;
      const refunded = o.finance?.refunded || 0;
      const refundPending = o.finance?.refundPending || (settlement ? settlement.refundAmount : 0);
      
      if (refunded > 0) {
        list.push({
          id: `order-refunded-${o.id}`,
          type: 'refunded',
          icon: '💰',
          title: t('Đã hoàn tiền đơn hủy'),
          description: `Đơn #${o.id.slice(0, 8).toUpperCase()} đã được hoàn ${money(refunded)} thành công.`,
          date: o.date,
          actionLabel: t('Xem đơn'),
          action: () => navigate('orders'),
          urgent: false
        });
      } else if (refundPending > 0) {
        list.push({
          id: `order-refund-pending-${o.id}`,
          type: 'refund_pending',
          icon: '⏳',
          title: t('Khoản hoàn cọc đang chờ xử lý'),
          description: `Đơn #${o.id.slice(0, 8).toUpperCase()} được duyệt hoàn ${money(refundPending)}. Quầy đang xử lý đối chiếu.`,
          date: o.date,
          actionLabel: t('Xem chi tiết'),
          action: () => navigate('orders'),
          urgent: false
        });
      }
    });

    // 4. Upcoming confirmed matches
    orders.filter(o => o.status === 'CONFIRMED' && (o.date || o.slots?.[0]?.scheduleDate) > todayStr)
      .slice(0, 3)
      .forEach(o => {
        const courtName = data.courts?.find(c => c.id === o.slots?.[0]?.court)?.name || t('Sân Tennis');
        const timeRange = `${o.slots?.[0]?.hour || 0}:00 – ${(o.slots?.at(-1)?.hour || 0) + 1}:00`;
        list.push({
          id: `match-upcoming-${o.id}`,
          type: 'upcoming',
          icon: '📅',
          title: t('Lịch thi đấu sắp tới'),
          description: `${o.date} · ${courtName} · ${timeRange}`,
          date: o.date,
          actionLabel: t('Xem vé'),
          action: () => show({ kind: 'ticket', order: o }),
          urgent: false
        });
      });

    // 5. Membership notice
    if (data.membership && data.membership.active) {
      list.push({
        id: `membership-active-${data.membership.id || 'current'}`,
        type: 'membership',
        icon: '👑',
        title: t('Hội viên CLB Courtly'),
        description: t(`Bạn đang sở hữu gói ${data.membership.planName || 'Hội viên'}. Tận hưởng ưu đãi giảm giá và ưu tiên giữ chỗ.`),
        actionLabel: t('Xem thẻ hội viên'),
        action: () => navigate('membership'),
        urgent: false
      });
    }

    return list;
  }, [user, data, t, navigate, show, pay]);

  const unreadCount = notifications.filter(n => !readIds.includes(n.id)).length;

  const markAllRead = () => {
    const allIds = notifications.map(n => n.id);
    setReadIds(allIds);
    if (user?.id) {
      try {
        localStorage.setItem(`courtly_read_notifs_${user.id}`, JSON.stringify(allIds));
      } catch {}
    }
  };

  const markOneRead = (id) => {
    if (!readIds.includes(id)) {
      const next = [...readIds, id];
      setReadIds(next);
      if (user?.id) {
        try {
          localStorage.setItem(`courtly_read_notifs_${user.id}`, JSON.stringify(next));
        } catch {}
      }
    }
  };

  return (
    <div className="ct-notif-wrapper" ref={menuRef} style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
      <button
        type="button"
        className="ct-notif-bell-btn"
        onClick={() => setOpen(prev => !prev)}
        aria-label={t('Thông báo đơn hàng')}
        title={t('Thông báo đơn hàng')}
        style={{
          position: 'relative',
          background: open ? 'rgba(222, 244, 106, 0.2)' : 'rgba(255, 255, 255, 0.08)',
          border: '1px solid rgba(255, 255, 255, 0.22)',
          borderRadius: 8,
          width: 36,
          height: 36,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: open ? '#def46a' : '#ffffff',
          cursor: 'pointer',
          transition: 'all 0.15s ease'
        }}
      >
        <Bell size={18} />
        {unreadCount > 0 && (
          <span style={{
            position: 'absolute',
            top: -3,
            right: -3,
            minWidth: 17,
            height: 17,
            padding: '0 4px',
            borderRadius: 10,
            background: '#ef4444',
            color: '#ffffff',
            fontSize: 10,
            fontWeight: 800,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: '1.5px solid #13332b',
            lineHeight: 1
          }}>
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="ct-notif-popover" style={{
          position: 'absolute',
          top: 'calc(100% + 10px)',
          right: 0,
          width: 350,
          maxWidth: '92vw',
          background: '#ffffff',
          borderRadius: 12,
          boxShadow: '0 12px 36px rgba(0,0,0,0.25), 0 2px 8px rgba(0,0,0,0.08)',
          border: '1px solid #d1d5db',
          zIndex: 1000,
          overflow: 'hidden',
          color: '#1e293b'
        }}>
          <div style={{
            padding: '12px 16px',
            background: '#f8fafc',
            borderBottom: '1px solid #e2e8f0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <strong style={{ fontSize: 14, color: '#0f172a' }}>{t('Thông báo đơn hàng')}</strong>
              {unreadCount > 0 && (
                <span style={{
                  background: '#fee2e2',
                  color: '#b91c1c',
                  fontSize: 11,
                  fontWeight: 700,
                  padding: '1px 6px',
                  borderRadius: 10
                }}>
                  {unreadCount} {t('mới')}
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={markAllRead}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#2563eb',
                  fontSize: 11.5,
                  fontWeight: 600,
                  cursor: 'pointer',
                  padding: 0
                }}
              >
                {t('Đã đọc tất cả')}
              </button>
            )}
          </div>

          <div style={{ maxHeight: 360, overflowY: 'auto', padding: '6px 0' }}>
            {notifications.length === 0 ? (
              <div style={{ padding: '30px 16px', textAlign: 'center', color: '#64748b', fontSize: 13 }}>
                <span style={{ fontSize: 26, display: 'block', marginBottom: 8 }}>📭</span>
                {t('Bạn không có thông báo nào mới.')}
              </div>
            ) : (
              notifications.map(n => {
                const isUnread = !readIds.includes(n.id);
                return (
                  <div
                    key={n.id}
                    style={{
                      padding: '10px 14px',
                      borderBottom: '1px solid #f1f5f9',
                      background: isUnread ? '#f0fdf4' : '#ffffff',
                      display: 'flex',
                      gap: 10,
                      alignItems: 'flex-start',
                      transition: 'background 0.15s'
                    }}
                  >
                    <span style={{ fontSize: 19, marginTop: 1 }}>{n.icon}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6 }}>
                        <b style={{ fontSize: 12.5, color: isUnread ? '#166534' : '#1e293b', fontWeight: isUnread ? 700 : 600 }}>
                          {n.title}
                        </b>
                        {isUnread && <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e', flexShrink: 0 }} />}
                      </div>
                      <p style={{ fontSize: 12, color: '#475569', margin: '3px 0 6px', lineHeight: 1.4 }}>
                        {n.description}
                      </p>
                      {n.actionLabel && (
                        <button
                          type="button"
                          onClick={() => {
                            markOneRead(n.id);
                            setOpen(false);
                            n.action();
                          }}
                          style={{
                            background: n.urgent ? '#15803d' : '#e2ebd9',
                            color: n.urgent ? '#ffffff' : '#173c32',
                            border: 'none',
                            borderRadius: 4,
                            padding: '3px 8px',
                            fontSize: 11,
                            fontWeight: 700,
                            cursor: 'pointer'
                          }}
                        >
                          {n.actionLabel} →
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div style={{
            padding: '8px 16px',
            background: '#f8fafc',
            borderTop: '1px solid #e2e8f0',
            textAlign: 'center'
          }}>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                navigate('orders');
              }}
              style={{
                background: 'none',
                border: 'none',
                color: '#0f766e',
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              {t('Xem danh sách tất cả đơn')} →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function Header(){const {t,lang,setLang,user,navigate,route,login,logout}=useGuest();const [open,setOpen]=useState(false);const links=customerNavigation.map(({id,label})=>[id,label]);return <><div className="ct-prototype"><span>COURTLY · TENNIS CLUB</span><span>{t('MỖI LẦN RA SÂN, MỘT NIỀM VUI.')}</span></div><header className="ct-header ct-original-header"><Logo/><nav id="guest-primary-navigation" className={open?'gx-nav-open':''} aria-label={t('Điều hướng chính')}>{links.map(([id,label])=><button key={id} data-nav={id} data-primary={['pricing','booking','tournaments','membership'].includes(id)?'true':undefined} aria-current={route===id?'page':undefined} onClick={()=>{navigate(id);setOpen(false)}}>{t(label)}</button>)}</nav><div className="cl-header-tools"><div className="cl-language">{['vi','en'].map(l=><button key={l} lang={l} onClick={()=>setLang(l)} aria-pressed={lang===l}>{l.toUpperCase()}</button>)}</div><div className="cl-header-divider" aria-hidden="true"/>{user && <CustomerNotifications/>}{user?<details className="ct-account-menu"><summary className="ct-account"><span className="ca-avatar">{user.name?.slice(0,1)}</span><span className="gx-user-name">{user.name}</span><ChevronDown/></summary><div>{[['profile','Hồ sơ của tôi'],['orders','Đơn của tôi'],['history','Lịch sử đặt sân'],['payments','Lịch sử thanh toán'],['membership','Membership của tôi']].map(([id,label])=><button key={id} onClick={e=>{e.currentTarget.closest('details').open=false;navigate(id)}}>{t(label)}</button>)}{['ADMIN','STAFF'].includes(user.role)&&<button onClick={e=>{e.currentTarget.closest('details').open=false;navigate('cashdesk')}}>{t('Thu tiền tại quầy')}</button>}{['ADMIN','STAFF'].includes(user.role)&&<a href="/app">{user.role==='ADMIN'?t('Quản trị'):t('Vận hành')}</a>}<button onClick={logout}>{t('Đăng xuất')} <LogOut/></button></div></details>:<div className="ct-header-auth-group"><button className="ca-login-button" onClick={()=>login('login')}>{t('Đăng nhập')}</button></div>}<button className="gx-menu" aria-label={t('Mở menu')} aria-controls="guest-primary-navigation" aria-expanded={open} onClick={()=>setOpen(!open)}><Menu/></button></div></header></>;}
export function Footer(){
  const {t,navigate,club,lang,setLang}=useGuest();
  const servicesLinks=[
    ['booking','Đặt sân trực tuyến'],
    ['pricing','Bảng giá & Khung giờ'],
    ['membership','Gói hội viên (Membership)'],
    ['tournaments','Giải đấu & Sự kiện'],
  ];
  const exploreLinks=[
    ['about','Giới thiệu câu lạc bộ'],
    ['news','Tin tức & Hoạt động'],
    ['feedback','Đánh giá & Góp ý'],
    ['policies','Chính sách & Quyền riêng tư'],
    ['rules','Quy chế hoạt động CLB'],
  ];
  return (
    <footer className="ct-footer-pro">
      <div className="ct-footer-main">
        <div className="ct-footer-col ct-footer-brand">
          <Logo/>
          <p className="ct-footer-desc">
            {t('Courtly Tennis Club – Tổ hợp thể thao quần vợt hiện đại, mang đến trải nghiệm sân chơi tiêu chuẩn cao, dịch vụ trọng tài chuyên nghiệp và công nghệ giữ chỗ thông minh.')}
          </p>
          <div className="ct-footer-hours-badge">
            <Clock size={16}/>
            <span>{t('Mở cửa')}: <strong>{club.openingHours||'06:00 – 23:00'}</strong> ({t('Cả tuần & Ngày lễ')})</span>
          </div>
        </div>

        <div className="ct-footer-col">
          <h3 className="ct-footer-heading">{t('DỊCH VỤ SÂN')}</h3>
          <ul className="ct-footer-links">
            {servicesLinks.map(([id,label])=>(
              <li key={id}>
                <button type="button" onClick={()=>navigate(id)}>{t(label)}</button>
              </li>
            ))}
          </ul>
        </div>

        <div className="ct-footer-col">
          <h3 className="ct-footer-heading">{t('VỀ COURTLY')}</h3>
          <ul className="ct-footer-links">
            {exploreLinks.map(([id,label])=>(
              <li key={id}>
                <button type="button" onClick={()=>navigate(id)}>{t(label)}</button>
              </li>
            ))}
          </ul>
        </div>

        <div className="ct-footer-col ct-footer-contact">
          <h3 className="ct-footer-heading">{t('LIÊN HỆ & ĐỊA CHỈ')}</h3>
          <address className="ct-footer-address">
            <div className="ct-contact-row">
              <MapPin size={17} className="ct-icon"/>
              <span>{club.address||'Khu liên hợp thể thao Courtly Tennis Club'}</span>
            </div>
            <div className="ct-contact-row">
              <Phone size={17} className="ct-icon"/>
              <a href={`tel:${club.phone||'0987654321'}`}>
                {club.phone||'0987 654 321'} ({t('Hotline 24/7')})
              </a>
            </div>
            <div className="ct-contact-row">
              <Mail size={17} className="ct-icon"/>
              <a href={`mailto:${club.email||'contact@courtly.vn'}`}>
                {club.email||'contact@courtly.vn'}
              </a>
            </div>
          </address>

          <div className="ct-footer-payments">
            <span className="ct-payment-label">{t('Phương thức thanh toán')}:</span>
            <div className="ct-payment-pills">
              <span className="ct-payment-pill">VietQR 24/7</span>
              <span className="ct-payment-pill">{t('Chuyển khoản')}</span>
              <span className="ct-payment-pill">{t('Tiền mặt tại quầy')}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="ct-footer-sub">
        <div className="ct-sub-left">
          <span>© {new Date().getFullYear()} COURTLY TENNIS CLUB. {t('Bảo lưu mọi quyền.')}</span>
        </div>
        <div className="ct-sub-center">
          <div className="ct-footer-lang-switch">
            <button type="button" onClick={()=>setLang('vi')} aria-pressed={lang==='vi'} style={{fontWeight:lang==='vi'?700:400,background:'none',border:'none',color:lang==='vi'?'#def46a':'inherit',cursor:'pointer',fontSize:12}}>Tiếng Việt</button>
            <span className="ct-dot" style={{margin:'0 6px',opacity:0.5}}>•</span>
            <button type="button" onClick={()=>setLang('en')} aria-pressed={lang==='en'} style={{fontWeight:lang==='en'?700:400,background:'none',border:'none',color:lang==='en'?'#def46a':'inherit',cursor:'pointer',fontSize:12}}>English</button>
          </div>
        </div>
        <div className="ct-sub-right">
          <button type="button" onClick={()=>navigate('policies')}>{t('Chính sách & quyền riêng tư')}</button>
          <span className="ct-dot">•</span>
          <button type="button" onClick={()=>navigate('rules')}>{t('Quy chế CLB')}</button>
          <span className="ct-dot">•</span>
          <button type="button" className="ct-back-to-top" onClick={()=>window.scrollTo({top:0,behavior:'smooth'})}>
            {t('Lên đầu trang')} ↑
          </button>
        </div>
      </div>
    </footer>
  );
}
