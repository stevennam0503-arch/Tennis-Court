import React from 'react';
import {Sun, House, Crown, Check, Construction} from 'lucide-react';
import {useGuest, money, zone} from './context';

const zones = [
  {id:'A', name:'Ngoài trời', style:'outdoor', Icon:Sun},
  {id:'B', name:'Trong nhà', style:'indoor', Icon:House},
  {id:'V', name:'VIP', style:'vip', Icon:Crown},
];

export default function CourtMap({courts, selected, onSelect, availability, rangeLabel, courtSelections = {}}) {
  const {t} = useGuest();
  return <section className="gx-map-section" aria-labelledby="guest-court-map-title">
    <div className="gx-block-heading">
      <div>
        <span className="gx-step">01</span>
        <h2 id="guest-court-map-title">{t('Chọn sân của bạn')}</h2>
      </div>
      <span>{rangeLabel || t('Chạm vào sân để xem hoặc chọn giờ')}</span>
    </div>
    <div className="dg-board" aria-label={t('Bản đồ sân')}>
      {zones.filter(z=>courts.some(c=>zone(c)===z.id)).map(({id, name, style, Icon}) => {
        const items = courts.filter(court => zone(court) === id);
        return <section className={`dg-zone dg-${style}`} key={id} aria-label={`${t('Khu')} ${id} · ${t(name)}`}>
          <div className="dg-zone-head"><Icon aria-hidden="true"/><div><h3>{t(name)}</h3><span>{t('Khu')} {id} · {items.length} {t('sân')}</span></div></div>
          <div className="dg-zone-courts">{items.map(court => {
            const maintenance = court.status !== 'ACTIVE';
            const busy = !maintenance && availability(court) === false;
            const chosen = court.id === selected?.id;
            const courtSel = courtSelections[court.id];
            const hasRange = Boolean(courtSel && courtSel.valid);
            const status = maintenance ? 'Bảo trì' : hasRange ? `✓ ${courtSel.rangeLabel}` : busy ? 'Bận trong giờ đã chọn' : chosen ? 'Đang xem' : rangeLabel ? 'Còn trống' : 'Xem lịch';
            return <button key={court.id} type="button" data-court-id={court.name} aria-pressed={chosen || hasRange}
              aria-label={`${court.name} · ${t(name)} · ${t(status)} · ${money(court.price)} / ${t('giờ')}`}
              className={`dg-court ${maintenance ? 'gm-maintenance' : busy ? 'gm-busy' : ''} ${chosen ? 'chosen' : ''}`}
              style={hasRange ? {borderColor: '#16a34a', background: '#f0fdf4', boxShadow: '0 0 0 2px rgba(22, 163, 74, 0.2)'} : {}}
              disabled={maintenance} onClick={() => onSelect(court)}>
              <span className="dg-art" aria-hidden="true">
                {id === 'A' && <><span className="dg-fence"/><span className="dg-light dg-light-left"/><span className="dg-light dg-light-right"/></>}
                {id === 'B' && <><span className="dg-building"/><span className="dg-roof"/></>}
                {id === 'V' && <><span className="dg-vip-frame"/><span className="dg-crown"><Crown/></span></>}
                <span className="dg-field"><span className="dg-service"/><span className="dg-net"/></span>
                <span className="dg-maintenance-mark"><Construction/></span>
                <span className="dg-selected" style={hasRange ? {display: 'flex', background: '#16a34a', color: '#fff'} : {}}><Check/></span>
              </span>
              <span className="dg-court-caption">
                <strong className="dg-court-id">{court.name}</strong>
                <span className="gm-court-state" style={hasRange ? {color: '#15803d', fontWeight: 700} : {}}>{t(status)}</span>
              </span>
              <span className="gx-map-price">{money(court.price)} <span>/ {t('giờ')}</span></span>
            </button>;
          })}</div>
          {!items.length && <p className="gx-map-empty">{t('Chưa có sân trong khu này.')}</p>}
        </section>;
      })}
    </div>
    <p className="gx-map-note">{t('Chạm vào từng sân để chọn giờ. Có thể chọn tối đa 3 sân cùng lúc trong cùng một đơn đặt.')}</p>
  </section>;
}
