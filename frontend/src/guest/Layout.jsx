import React,{useState} from 'react';
import {ArrowUpRight,Menu,LogOut,ChevronDown,Phone,Mail,MapPin,Clock} from 'lucide-react';
import {useGuest} from './context';
import {customerNavigation} from '../navigation';
export function Logo(){const {navigate,t}=useGuest();return <button className="ct-logo" onClick={()=>navigate('about')} aria-label={t('Courtly trang chủ')}><img src="/favicon.svg" width="38" height="38" alt=""/><span className="ct-original-wordmark">Courtly<em>TENNIS CLUB</em></span></button>;}
export function Header(){const {t,lang,setLang,user,navigate,route,login,logout}=useGuest();const [open,setOpen]=useState(false);const links=customerNavigation.map(({id,label})=>[id,label]);return <><div className="ct-prototype"><span>COURTLY · TENNIS CLUB</span><span>{t('MỖI LẦN RA SÂN, MỘT NIỀM VUI.')}</span></div><header className="ct-header ct-original-header"><Logo/><nav id="guest-primary-navigation" className={open?'gx-nav-open':''} aria-label={t('Điều hướng chính')}>{links.map(([id,label])=><button key={id} data-nav={id} data-primary={['pricing','booking','tournaments','membership'].includes(id)?'true':undefined} aria-current={route===id?'page':undefined} onClick={()=>{navigate(id);setOpen(false)}}>{t(label)}</button>)}</nav><div className="cl-header-tools"><div className="cl-language">{['vi','en'].map(l=><button key={l} lang={l} onClick={()=>setLang(l)} aria-pressed={lang===l}>{l.toUpperCase()}</button>)}</div><div className="cl-header-divider" aria-hidden="true"/>{user?<details className="ct-account-menu"><summary className="ct-account"><span className="ca-avatar">{user.name?.slice(0,1)}</span><span className="gx-user-name">{user.name}</span><ChevronDown/></summary><div>{[['profile','Hồ sơ của tôi'],['orders','Đơn của tôi'],['history','Lịch sử đặt sân'],['payments','Lịch sử thanh toán'],['membership','Membership của tôi']].map(([id,label])=><button key={id} onClick={e=>{e.currentTarget.closest('details').open=false;navigate(id)}}>{t(label)}</button>)}{['ADMIN','STAFF'].includes(user.role)&&<button onClick={e=>{e.currentTarget.closest('details').open=false;navigate('cashdesk')}}>{t('Thu tiền tại quầy')}</button>}{['ADMIN','STAFF'].includes(user.role)&&<a href="/app">{user.role==='ADMIN'?t('Quản trị'):t('Vận hành')}</a>}<button onClick={logout}>{t('Đăng xuất')} <LogOut/></button></div></details>:<div className="ct-header-auth-group"><button className="ca-login-button" onClick={()=>login('login')}>{t('Đăng nhập')}</button></div>}<button className="gx-menu" aria-label={t('Mở menu')} aria-controls="guest-primary-navigation" aria-expanded={open} onClick={()=>setOpen(!open)}><Menu/></button></div></header></>;}
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
