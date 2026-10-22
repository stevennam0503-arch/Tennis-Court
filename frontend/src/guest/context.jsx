import React,{createContext,useContext} from 'react';
import translations from './translations.json';
export const GuestContext=createContext(null);
export const useGuest=()=>useContext(GuestContext);
const states={ALL:['Tất cả','All'],HOLDING:['Đang giữ chỗ','On hold'],CONFIRMED:['Đã xác nhận','Confirmed'],CHECKED_IN:['Đang chơi','Checked in'],COMPLETED:['Hoàn tất','Completed'],CANCELLED:['Đã hủy','Cancelled'],EXPIRED:['Hết hạn','Expired'],PENDING:['Chờ xử lý','Pending'],CHECKING:['Chờ đối soát','Checking'],REVIEW:['Cần đối soát','Under review'],ACTIVE:['Hoạt động','Active'],BOOKED:['Đã đặt','Booked'],LOCKED:['Đang giữ chỗ','On hold'],BLOCKED:['Bảo trì','Maintenance'],IN_MATCH:['Thi đấu','Match'],SINGLES:['Đơn','Singles'],DOUBLES:['Đôi','Doubles'],TEAM:['Đồng đội','Team'],CASH:['Tiền mặt','Cash'],BANK_TRANSFER:['Chuyển khoản','Bank transfer'],ORDER:['Đơn sân','Court booking'],TOURNAMENT:['Giải đấu','Tournament'],MEMBERSHIP:['Hội viên','Membership'],COURT:['Chất lượng sân','Court quality'],SERVICE:['Dịch vụ','Service'],WEBSITE:['Website','Website'],OTHER:['Khác','Other'],NEWS:['Tin tức','News'],NOTICE:['Thông báo','Notice']};
export const translate=(lang,text)=>states[text]?.[lang==='en'?1:0]||(lang==='en'?(translations[text]||text):text);
export const dateToday=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Ho_Chi_Minh',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
export const time=s=>String(s||'').slice(0,5);
export const minutes=s=>{const [h,m]=time(s).split(':').map(Number);return h*60+m;};
export const stamp=n=>`${String(Math.floor(n/60)).padStart(2,'0')}:${String(n%60).padStart(2,'0')}`;
export const zone=c=>/^B/i.test(c?.name)?'B':/^V/i.test(c?.name)?'V':'A';
export const money=n=>new Intl.NumberFormat('vi-VN').format(Number(n||0))+'₫';
export const requestId=()=>crypto.randomUUID();
export function Action({children,onClick,type='button',secondary=false,...props}){return <button type={type} className={secondary?'ct-outline':'ct-primary'} onClick={onClick} {...props}>{children}</button>;}
export function State({value}){const {t}=useGuest();return <span className={'gx-status gx-'+value}>{t(value)}</span>;}
export function Empty({children}){const {t}=useGuest();return <div className="gx-empty">{children||t('Chưa có dữ liệu')}</div>;}
