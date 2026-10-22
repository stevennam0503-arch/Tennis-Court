import React from 'react';
import {ArrowUpRight} from 'lucide-react';
import {useGuest,Action,Empty,money,zone} from './context';
import {tariffRows} from './pricing.mjs';

export default function Pricing(){
 const {t,data,setPreferredZone,navigate}=useGuest();
 const settings=data?.settings||{},policies=settings.policies||{};
 const groups=[['A','Ngoài trời'],['B','Trong nhà'],['V','VIP']];
 return <section className="ct-pad gx-pricing"><div className="gx-heading"><span className="ct-eyebrow">COURTLY / {t('BẢNG GIÁ')}</span><h1>{t('Bảng giá sân & dịch vụ')}</h1><p>{t('Giá theo giờ, áp dụng theo ngày chơi. Thứ 2–6 là ngày trong tuần; thứ 7 và Chủ nhật là cuối tuần.')}</p></div>
 <div className="gx-plan-grid">{groups.map(([id,label])=>{
  const courts=(data?.courts||[]).filter(c=>zone(c)===id);
  return <article className="ct-plan" key={id}><h2>{t(label)}</h2>{courts.length?<div className="gx-price-scroll"><table><caption>{t('Đơn vị: VND / giờ')}</caption><thead><tr><th>{t('Sân / Giờ chơi')}</th><th>{t('Thứ 2–6')}</th><th>{t('Thứ 7–CN')}</th></tr></thead><tbody>{courts.flatMap(c=>tariffRows(c,data?.prices||[]).map(r=><tr key={`${c.id}-${r.start}`}><th scope="row">{c.name}<small>{r.start}–{r.end}</small></th><td>{money(r.weekday)}</td><td>{money(r.weekend)}</td></tr>))}</tbody></table></div>:<Empty/>}<Action disabled={!courts.some(c=>c.status==='ACTIVE')} onClick={()=>{setPreferredZone(id);navigate('booking')}}>{t('Đặt sân ngay')} · {t(label)} <ArrowUpRight size={16}/></Action></article>;
 })}</div>
 <div className="gx-policy-grid"><article><h2>{t('Tiền cọc & giữ chỗ')}</h2><p>{t('Cọc 50% tiền sân sau ưu đãi hội viên. Phí trọng tài thanh toán riêng trong số tiền còn lại.')}</p><p>{t('Giữ chỗ trong')} <b>{settings.holdMinutes??5} {t('phút')}</b> {t('kể từ khi tạo đơn. Sân đang giữ không thể được khách khác đặt; hết hạn chưa đủ cọc thì giải phóng lịch.')}</p><p>{t('Chỉ tạo đơn sau khi đăng nhập. Tiền mặt do nhân viên tại quầy xác nhận; chuyển khoản được xác minh từ ngân hàng. Thông báo đã chuyển tiền chưa phải xác nhận thu tiền.')}</p></article>
 <article><h2>{t('Quy định hủy / đổi lịch')}</h2><p>{t('Đơn đã xác nhận: hủy trước giờ chơi ít nhất')} <b>{policies.cancelCutoffMinutes??1440} {t('phút')}</b>; {t('đổi lịch trước ít nhất')} <b>{policies.changeCutoffMinutes??1440} {t('phút')}</b>. {t('Quá hạn vui lòng liên hệ quầy.')}</p><p>{t('Đơn đang giữ chỗ có thể hủy hoặc đổi trước giờ chơi. Đổi lịch cần còn sân trống; hệ thống báo chênh lệch giá trước khi xác nhận. Hội viên áp dụng thêm điều kiện cùng khu sân, cùng thời lượng và số lượt của gói.')}</p><p>{t('Hủy hợp lệ: số tiền dự kiến hoàn bằng')} <b>{settings.cancelRefundPercent??100}%</b> {t('số tiền đã thu còn giữ. Khoản hoàn chuyển sang chờ CLB xử lý, không tự chuyển tiền về ngân hàng. Đổi sang lịch rẻ hơn cũng ghi nhận khoản chờ hoàn.')}</p></article>
 <article><h2>{t('Giá thuê trọng tài')}</h2>{data?.refereeRates?.length?<ul>{data.refereeRates.map((r,i)=><li key={i}><strong>{r.name}</strong> {r.level&&`· ${r.level}`}<br/>{money(r.rate)} / {t('giờ')}</li>)}</ul>:<p>{t('Chưa có trọng tài được niêm yết.')}</p>}<p>{t('Tính theo thời lượng thực tế đã chọn, tối thiểu một khung 30 phút. Chọn trọng tài còn lịch trống tại bước đặt sân.')}</p></article></div></section>;
}
