import React, {useState, useEffect, useRef} from 'react';
import {ArrowUpRight, ArrowRight, Clock, UserRound, RotateCcw, Check} from 'lucide-react';
import {api} from '../services/api';
import {useGuest, Action, Empty, money, time, dateToday, zone, requestId} from './context';
import {toMinutes, clock, rangeSlots, canEndAt, timePoints} from './bookingTime.mjs';
import CourtMap from './CourtMap';

export default function Booking() {
  const {t, lang, data, date, setDate, user, login, preferredZone, refresh, navigate, pay, moveOrder, setMoveOrder, notify} = useGuest();
  const [courtId, setCourtId] = useState('');
  const [start, setStart] = useState(null), [end, setEnd] = useState(null), [hover, setHover] = useState(null);
  const [phase, setPhase] = useState('start'), [options, setOptions] = useState(null);
  const [error, setError] = useState(''), [saving, setSaving] = useState(false);
  const [wantReferee, setWantReferee] = useState(false), [refStart, setRefStart] = useState(''), [refEnd, setRefEnd] = useState(''), [refId, setRefId] = useState('');
  const req = useRef(requestId());
  const courts = data?.courts || [];
  const court = courts.find(c => c.id === courtId) || courts.find(c => zone(c) === preferredZone && c.status === 'ACTIVE') || courts[0];
  const rowsFor = c => (data?.schedules || []).filter(s => s.court === c?.id && s.date === date).sort((a,b) => a.start.localeCompare(b.start));
  const rows = rowsFor(court);
  const ownIds = new Set(moveOrder?.slots?.map(s => s.id) || []);
  const available = s => (s.status === 'AVAILABLE' || ownIds.has(s.id)) && Date.parse(`${date}T${s.start}+07:00`) > Date.now();
  const valid = court?.status === 'ACTIVE' && end !== null && canEndAt(rows, start, end, available);
  const chosen = valid ? rangeSlots(rows, start, end) : [];
  const signature = chosen.map(s => s.id).join(',');
  const reset = () => {setStart(null); setEnd(null); setHover(null); setPhase('start'); setRefId(''); setOptions(null); setError('');};
  useEffect(reset, [court?.id, date, moveOrder?.id]);
  useEffect(() => {setCourtId('');}, [preferredZone]);
  useEffect(() => {setRefStart(start === null ? '' : clock(start)); setRefEnd(end === null ? '' : clock(end)); setRefId(''); req.current = requestId();}, [start, end, court?.id, date]);
  useEffect(() => {
    let live = true; setOptions(null);
    if (valid && user) api('/booking/options', 'POST', {scheduleIds:chosen.map(s => s.id), ...(moveOrder ? {excludeId:moveOrder.id} : {})})
      .then(x => {if (live) {setOptions(x); setError('');}}).catch(e => {if (live) setError(e.message);});
    return () => {live = false;};
  }, [signature, valid, user?.id, moveOrder?.id]);

  const pickTime = minute => {
    setError(''); setHover(null);
    if (phase === 'end' && start !== null) {
      if (!canEndAt(rows, start, minute, available)) return;
      setEnd(minute); setPhase('start');
    } else {
      if (!rows.some(s => toMinutes(s.start) === minute && available(s))) return;
      setStart(minute); setEnd(null); setPhase('end'); setOptions(null);
    }
  };
  const refSlots = chosen.filter(s => refStart && refEnd && toMinutes(s.start) >= toMinutes(refStart) && toMinutes(s.end) <= toMinutes(refEnd));
  const refValid = refSlots.length > 0 && time(refSlots[0].start) === refStart && time(refSlots.at(-1).end) === refEnd;
  const people = refValid && options ? (options.staffSlots?.find(s => s.scheduleId === refSlots[0]?.id)?.staff || [])
    .filter(p => refSlots.every(s => options.staffSlots.find(x => x.scheduleId === s.id)?.staff.some(x => x.id === p.id && x.available))) : [];
  const referee = wantReferee ? people.find(p => p.id === refId) : null;
  const refFee = referee ? (toMinutes(refEnd) - toMinutes(refStart)) * referee.rate / 60 : 0;
  const gross = chosen.reduce((sum,s) => sum+s.price,0), net = options?.courtQuote?.net ?? gross, discount = options?.courtQuote?.discount ?? 0;
  const rangeLabel = valid ? `${clock(start)}–${clock(end)}` : '';
  const displayDate = new Intl.DateTimeFormat(lang === 'en' ? 'en-GB' : 'vi-VN', {weekday:'short', day:'2-digit', month:'2-digit'}).format(new Date(date+'T12:00:00'));
  const ready = valid && !saving && (!user || !!options) && !options?.conflicts?.length && (!wantReferee || !!referee);
  const previewEnd = phase === 'end' && hover !== null && canEndAt(rows, start, hover, available) ? hover : null;
  const instruction = phase === 'end' ? t('Chọn mốc kết thúc cho buổi chơi của bạn.') : valid ? t('Đã chọn giờ chơi. Nhấn mốc khác để bắt đầu chọn lại.') : t('Nhấn một mốc giờ để bắt đầu.');

  const submit = async () => {
    if (!user) {login(); return;}
    if (!ready) return;
    setSaving(true); setError('');
    try {
      const assignments = referee ? refSlots.map(s => ({scheduleId:s.id, staffId:referee.id})) : [];
      if (moveOrder) {
        await api(`/orders/${moveOrder.id}/schedule`, 'PATCH', {scheduleIds:chosen.map(s => s.id), assignments, reason:'Khách đổi lịch', requestId:req.current});
        setMoveOrder(null); navigate('orders'); notify(t('Đã đổi lịch')); await refresh();
      } else {
        const result = await api('/orders', 'POST', {name:user.name, phone:'', accountId:user.id, scheduleIds:chosen.map(s => s.id), assignments, requestId:req.current});
        reset(); navigate('orders'); await refresh(); await pay('ORDER',result.id);
      }
    } catch (e) {setError(e.message); notify(e.message);} finally {setSaving(false);}
  };

  return <div className="ct-pad gx-booking">
    <header className="gx-booking-heading"><div><span className="ct-eyebrow">COURTLY / {t('ĐẶT SÂN')}</span><h1>{t('Chọn sân. Hẹn giờ chơi.')}</h1><p>{t('Một buổi tennis, bắt đầu bằng một cuộc hẹn.')}</p></div><span className="gx-opening"><Clock size={16}/> 06:00–23:00 · {t('Mỗi ngày')}</span></header>
    {moveOrder && <div className="gx-notice">{t('Đang đổi lịch đơn')} #{moveOrder.id.slice(0,8)} <button onClick={() => setMoveOrder(null)}>{t('Bỏ đổi lịch')}</button></div>}
    <div className="gx-date-bar"><label>{t('Ngày chơi')}<input aria-label={t('Ngày chơi')} type="date" min={dateToday()} max={new Date(Date.now()+90*86400000).toISOString().slice(0,10)} value={date} onChange={e => {if (e.target.value) {reset(); setDate(e.target.value);}}}/></label><p><Clock size={16}/>{t('Chọn theo mốc 30 phút. Giá hiển thị theo giờ.')}</p></div>
    <CourtMap courts={courts} selected={court} onSelect={c => {if (c.id !== court?.id) {reset(); setCourtId(c.id);}}} rangeLabel={rangeLabel} availability={c => valid ? canEndAt(rowsFor(c), start, end, available) : null}/>
    <div className="gx-book-layout">
      <section className="gx-play-panel" aria-labelledby="guest-time-title">
        <div className="gx-block-heading"><div><span className="gx-step">02</span><h2 id="guest-time-title">{t('Chọn giờ chơi')}</h2></div><span>{t('Mỗi mốc 30 phút')}</span></div>
        <div className="gx-selected-court"><img src={court?.imageUrl || `/guest/zone-${zone(court).toLowerCase()}-${zone(court)==='A'?'outdoor':zone(court)==='B'?'indoor':'lounge'}.webp`} alt=""/><div><span>{t('Khu')} {zone(court)} · {t(zone(court)==='A'?'Ngoài trời':zone(court)==='B'?'Trong nhà':'VIP')}</span><h3>{court?.name || t('Chọn sân')}</h3><p>{displayDate}</p></div><strong>{money(court?.price)}<small>/ {t('giờ')}</small></strong></div>
        <div className="gx-range-head">
          <button type="button" aria-label={t('Giờ bắt đầu')} aria-pressed={phase==='start' && end===null} onClick={reset}><span>01 · {t('Giờ bắt đầu')}</span><strong data-range-start>{start===null?'— — : — —':clock(start)}</strong></button>
          <ArrowRight aria-hidden="true"/>
          <button type="button" aria-label={t('Giờ kết thúc')} aria-pressed={phase==='end'} disabled={start===null} onClick={() => {setEnd(null); setPhase('end'); setOptions(null);}}><span>02 · {t('Giờ kết thúc')}</span><strong data-range-end>{end===null?'— — : — —':clock(end)}</strong></button>
          <button type="button" className="gx-range-reset" aria-label={t('Chọn lại giờ')} onClick={reset}><RotateCcw size={17}/><span>{t('Chọn lại')}</span></button>
        </div>
        <p className="gx-time-instruction" role="status" aria-live="polite"><span className={valid?'gx-complete-dot':''}/>{instruction}</p>
        <div className="gx-time-grid" aria-label={t('Mốc giờ chơi')} onMouseLeave={() => setHover(null)}>
          {timePoints(rows).map(minute => {
            const enabled = court?.status==='ACTIVE' && (phase==='end' ? canEndAt(rows,start,minute,available) : rows.some(s => toMinutes(s.start)===minute && available(s)));
            const first = minute===start, last = minute===end, between = valid && minute>start && minute<end;
            const preview = previewEnd!==null && minute>start && minute<=previewEnd;
            const label = first ? 'Bắt đầu' : last ? 'Kết thúc' : phase==='end' ? 'Chọn giờ kết thúc' : 'Chọn giờ bắt đầu';
            return <button key={minute} type="button" data-time={clock(minute)} disabled={!enabled} aria-pressed={first||last||between}
              aria-label={`${clock(minute)} · ${t(label)}`} className={[first?'gx-time-start':'',last?'gx-time-end':'',between?'gx-time-between':'',preview?'gx-time-preview':''].join(' ')}
              onMouseEnter={() => setHover(minute)} onFocus={() => setHover(minute)} onBlur={() => setHover(null)} onClick={() => pickTime(minute)}>
              <strong>{clock(minute)}</strong><small>{first?t('Bắt đầu'):last?t('Kết thúc'):between?t('Đã chọn'):!enabled&&phase==='start'&&minute!==1380?t('Không khả dụng'):'\u00a0'}</small>
            </button>;
          })}
        </div>
        {!rows.length && <Empty>{t('Chưa có lịch sân cho ngày này.')}</Empty>}
        <div className="gx-time-legend"><span><i/>{t('Còn trống')}</span><span><i className="gx-legend-busy"/>{t('Không khả dụng')}</span><span><i className="gx-legend-range"/>{t('Khoảng đã chọn')}</span></div>
        <p className="gx-range-help">{t('Nhấn lần đầu để chọn giờ bắt đầu, lần sau để chọn giờ kết thúc. Không thể chọn qua khoảng đã đặt.')}</p>
        <section className="gx-referee-section">
          <label className="gx-referee-toggle"><input type="checkbox" checked={wantReferee} disabled={!valid} onChange={e => {setWantReferee(e.target.checked); setRefId(''); req.current=requestId();}}/><UserRound aria-hidden="true"/><span><strong>{t('Thêm trọng tài')}</strong><small>{t(valid?'Chọn người hỗ trợ trong khoảng giờ bạn cần.':'Chọn đủ giờ chơi để xem trọng tài.')}</small></span><span className="gx-optional">{t('Không bắt buộc')}</span></label>
          {wantReferee && valid && (!user ? <Action secondary onClick={login}>{t('Đăng nhập để xem trọng tài')}</Action> : !options ? <p role="status">{t('Đang tải dữ liệu…')}</p> : <div className="gx-referee-panel">
            <div className="gx-time-select"><label>{t('Từ giờ')}<select aria-label={t('Từ giờ')} value={refStart} onChange={e => {setRefStart(e.target.value); if (toMinutes(refEnd) <= toMinutes(e.target.value)) setRefEnd(clock(end)); setRefId('');}}>{chosen.map(s => <option key={s.id} value={time(s.start)}>{time(s.start)}</option>)}</select></label><label>{t('Đến giờ')}<select aria-label={t('Đến giờ')} value={refEnd} onChange={e => {setRefEnd(e.target.value); setRefId('');}}>{chosen.filter(s => toMinutes(s.end)>toMinutes(refStart)).map(s => <option key={s.id} value={time(s.end)}>{time(s.end)}</option>)}</select></label></div>
            <div className="gx-referees">{people.map(p => <button key={p.id} type="button" className={refId===p.id?'gx-selected':''} aria-pressed={refId===p.id} onClick={() => {setRefId(p.id); req.current=requestId();}}><span className="gx-ref-avatar"><UserRound/></span><strong>{p.name}</strong><small>{p.level||t('Trọng tài câu lạc bộ')}</small><b>{money(p.rate)} / {t('giờ')}</b>{refId===p.id && <Check size={18}/>}</button>)}</div>
            {!people.length && <Empty>{t('Không có trọng tài rảnh toàn khoảng này. Hãy đổi giờ hoặc bỏ dịch vụ.')}</Empty>}
          </div>)}
        </section>
      </section>
      <aside className="gx-quote" aria-label={t('Chi phí buổi chơi')}>
        <span className="ct-eyebrow">{t('BUỔI CHƠI CỦA BẠN')}</span><h2>{court?.name || 'Courtly'}</h2><p className="gx-quote-date">{displayDate}</p>
        <div className="gx-quote-range"><Clock size={18}/><div><strong>{rangeLabel || t('Chưa chọn giờ')}</strong><span>{valid?`${end-start} ${t('phút')}`:t('Chọn giờ bắt đầu và kết thúc')}</span></div></div>
        <dl><div><dt>{t('Tiền sân')}</dt><dd>{money(gross)}</dd></div><div><dt>{t('Ưu đãi hội viên')}</dt><dd>−{money(discount)}</dd></div><div><dt>{t('Trọng tài')}</dt><dd>{money(refFee)}</dd></div><div className="gx-total"><dt>{t('Tổng tiền')}</dt><dd>{money(net+refFee)}</dd></div></dl>
        <div className="gx-deposit"><div><span>{t('Cọc 50% tiền sân')}</span><strong>{money(Math.round(net/2))}</strong></div><p>{t('Phí trọng tài nằm trong phần thanh toán còn lại.')}</p></div>
        {error && <div className="gx-error" role="alert">{t(error)}</div>}
        <Action disabled={!ready} onClick={submit}>{t(saving?'Đang xử lý…':moveOrder?'Xác nhận đổi lịch':'Tiếp tục thanh toán')}<ArrowUpRight size={18}/></Action>
        <p className="gx-quote-note">{t('Lựa chọn chưa giữ chỗ. Sân được kiểm tra lại khi tạo đơn.')}</p>
      </aside>
    </div>
  </div>;
}
