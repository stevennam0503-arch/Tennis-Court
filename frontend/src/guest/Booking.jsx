import React, {useState, useEffect, useRef} from 'react';
import {ArrowUpRight, ArrowRight, Clock, UserRound, RotateCcw, Check, Plus, Tag} from 'lucide-react';
import {api} from '../services/api';
import {useGuest, Action, Empty, money, time, dateToday, zone, requestId} from './context';
import {toMinutes, clock, rangeSlots, canEndAt, timePoints} from './bookingTime.mjs';
import CourtMap from './CourtMap';

export default function Booking() {
  const {t, lang, data, date, setDate, user, login, preferredZone, setPreferredZone, refresh, navigate, pay, moveOrder, setMoveOrder, notify} = useGuest();
  const [courtId, setCourtId] = useState('');
  const [courtRanges, setCourtRanges] = useState({});
  const [hover, setHover] = useState(null);
  const [error, setError] = useState(''), [saving, setSaving] = useState(false);
  const [wantReferee, setWantReferee] = useState(false), [refStart, setRefStart] = useState(''), [refEnd, setRefEnd] = useState(''), [refId, setRefId] = useState('');
  const [options, setOptions] = useState(null);
  const [preview, setPreview] = useState(null);
  const [voucherInput, setVoucherInput] = useState('');
  const [appliedVoucher, setAppliedVoucher] = useState(null);
  const [voucherError, setVoucherError] = useState('');
  const [voucherBusy, setVoucherBusy] = useState(false);
  const [publicVouchers, setPublicVouchers] = useState([]);
  const [recurringWeeks, setRecurringWeeks] = useState(1);
  const req = useRef(requestId());

  useEffect(() => {
    api('/public/vouchers' + (gross > 0 ? `?amount=${gross}` : '')).then(setPublicVouchers).catch(() => {});
  }, [gross, user?.id]);

  const allCourts = data?.courts || [];
  const courts = preferredZone === 'ALL' ? allCourts : allCourts.filter(c => zone(c) === preferredZone);
  const court = courts.find(c => c.id === courtId) || courts.find(c => zone(c) === preferredZone && c.status === 'ACTIVE') || courts[0];

  const currentRange = (court && courtRanges[court.id]) || {start: null, end: null, phase: 'start', valid: false, rangeLabel: '', slots: []};
  const {start, end, phase, valid, rangeLabel} = currentRange;

  const rowsFor = c => (data?.schedules || []).filter(s => s.court === c?.id && s.date === date).sort((a, b) => a.start.localeCompare(b.start));
  const rows = rowsFor(court);
  const ownIds = new Set(moveOrder?.slots?.map(s => s.id) || []);
  const available = s => (s.status === 'AVAILABLE' || ownIds.has(s.id)) && Date.parse(`${date}T${s.start}+07:00`) > Date.now();

  const resetAll = () => {
    setCourtRanges({});
    setHover(null);
    setRefId('');
    setOptions(null);
    setPreview(null);
    setAppliedVoucher(null);
    setVoucherInput('');
    setVoucherError('');
    setError('');
  };

  const resetCurrentCourt = () => {
    if (!court) return;
    setCourtRanges(prev => {
      const copy = {...prev};
      delete copy[court.id];
      return copy;
    });
    setHover(null);
    setError('');
  };

  useEffect(() => {
    resetAll();
  }, [date, moveOrder?.id]);

  useEffect(() => {
    setCourtId('');
  }, [preferredZone]);

  const allChosen = Object.values(courtRanges).flatMap(v => (v.valid ? v.slots : []));
  const signature = allChosen.map(s => s.id).sort().join(',');

  useEffect(() => {
    setPreview(null);
  }, [signature, refId, refStart, refEnd, wantReferee]);

  useEffect(() => {
    setRefStart(start === null ? '' : clock(start));
    setRefEnd(end === null ? '' : clock(end));
    setRefId('');
    req.current = requestId();
  }, [start, end, court?.id, date]);

  useEffect(() => {
    let live = true;
    setOptions(null);
    if (allChosen.length > 0 && user) {
      api('/booking/options', 'POST', {
        scheduleIds: allChosen.map(s => s.id),
        voucherCode: appliedVoucher ? appliedVoucher.code : undefined,
        recurringWeeks: recurringWeeks > 1 ? recurringWeeks : undefined,
        ...(moveOrder ? {excludeId: moveOrder.id} : {})
      })
        .then(x => { if (live) { setOptions(x); setError(''); } })
        .catch(e => { if (live) setError(e.message); });
    }
    return () => { live = false; };
  }, [signature, allChosen.length, user?.id, moveOrder?.id, appliedVoucher?.code, recurringWeeks]);

  const checkMultiCourtGap = (minuteStart, minuteEnd) => {
    const otherCourts = Object.entries(courtRanges).filter(([cid, val]) => cid !== court?.id && val.valid);
    if (!otherCourts.length) return true;
    for (const [_, other] of otherCourts) {
      const overlap = !(minuteEnd <= other.start || minuteStart >= other.end);
      if (overlap) return true;
      const gapBefore = minuteStart - other.end;
      const gapAfter = other.start - minuteEnd;
      if ((gapBefore >= 0 && gapBefore <= 30) || (gapAfter >= 0 && gapAfter <= 30)) return true;
    }
    return false;
  };

  const pickTime = minute => {
    setError('');
    setHover(null);
    if (!court) return;

    if (phase === 'end' && start !== null) {
      if (!canEndAt(rows, start, minute, available)) return;
      if (!checkMultiCourtGap(start, minute)) {
        setError(t('Các sân trong cùng đơn phải cùng khung giờ hoặc nối tiếp nhau (không cách quá 30 phút).'));
        return;
      }
      const slots = rangeSlots(rows, start, minute);
      setCourtRanges(prev => ({
        ...prev,
        [court.id]: {
          courtId: court.id,
          start,
          end: minute,
          phase: 'start',
          valid: true,
          rangeLabel: `${clock(start)}–${clock(minute)}`,
          slots
        }
      }));
    } else {
      const otherValidCourts = Object.entries(courtRanges).filter(([cid, val]) => cid !== court.id && val.valid);
      if (otherValidCourts.length >= 3) {
        setError(t('Tối đa 3 sân trong cùng một đơn đặt.'));
        return;
      }
      if (!rows.some(s => toMinutes(s.start) === minute && available(s))) return;
      setCourtRanges(prev => ({
        ...prev,
        [court.id]: {
          courtId: court.id,
          start: minute,
          end: null,
          phase: 'end',
          valid: false,
          rangeLabel: '',
          slots: []
        }
      }));
    }
  };

  const refSlots = (currentRange.slots || []).filter(s => refStart && refEnd && toMinutes(s.start) >= toMinutes(refStart) && toMinutes(s.end) <= toMinutes(refEnd));
  const refValid = refSlots.length > 0 && time(refSlots[0].start) === refStart && time(refSlots.at(-1).end) === refEnd;
  const people = refValid && options ? (options.staffSlots?.find(s => s.scheduleId === refSlots[0]?.id)?.staff || [])
    .filter(p => refSlots.every(s => options.staffSlots.find(x => x.scheduleId === s.id)?.staff.some(x => x.id === p.id && x.available))) : [];
  const referee = wantReferee ? people.find(p => p.id === refId) : null;
  const refFee = referee ? (toMinutes(refEnd) - toMinutes(refStart)) * referee.rate / 60 : 0;

  const gross = allChosen.reduce((sum, s) => sum + s.price, 0) * recurringWeeks;
  const discount = (options?.courtQuote?.discount ?? 0) * recurringWeeks;
  const baseCourtNet = Math.max(0, gross - discount);
  const voucherDiscount = appliedVoucher ? appliedVoucher.discount : 0;
  const net = Math.max(0, baseCourtNet - voucherDiscount);
  const totalAmount = net + refFee;
  const depositAmount = Math.round(net / 2);
  const displayDate = new Intl.DateTimeFormat(lang === 'en' ? 'en-GB' : 'vi-VN', {weekday: 'short', day: '2-digit', month: '2-digit'}).format(new Date(date + 'T12:00:00'));

  const applyVoucher = async (codeToUse) => {
    const code = (codeToUse || voucherInput).trim().toUpperCase();
    if (!code) return;
    if (!gross) {
      setVoucherError(t('Vui lòng chọn giờ chơi trước khi áp dụng voucher.'));
      return;
    }
    setVoucherBusy(true);
    setVoucherError('');
    try {
      const res = await api('/public/vouchers/validate', 'POST', { code, amount: gross, accountId: user?.id || null });
      setAppliedVoucher(res);
      setVoucherInput(code);
    } catch (e) {
      setVoucherError(e.message);
    } finally {
      setVoucherBusy(false);
    }
  };

  const removeVoucher = () => {
    setAppliedVoucher(null);
    setVoucherInput('');
    setVoucherError('');
  };

  useEffect(() => {
    if (!appliedVoucher) return;
    const currentList = options?.availableVouchers || publicVouchers;
    const current = currentList.find(v => v.code === appliedVoucher.code);
    if (current && !current.applicable) {
      setAppliedVoucher(null);
      setVoucherError(t(`Voucher ${appliedVoucher.code} đã tự động gỡ: ${current.reason || 'Không còn đủ điều kiện áp dụng.'}`));
    }
  }, [gross, options?.availableVouchers]);

  const selectedCourtEntries = Object.entries(courtRanges)
    .filter(([_, v]) => v.valid && v.slots?.length > 0)
    .map(([cid, v]) => ({
      court: data?.courts?.find(c => c.id === cid) || court,
      ...v
    }));

  const ready = allChosen.length > 0 && !saving && (!user || !!options) && !options?.conflicts?.length && (!wantReferee || !!referee);
  const previewEnd = phase === 'end' && hover !== null && canEndAt(rows, start, hover, available) ? hover : null;
  const instruction = phase === 'end'
    ? t('Chọn mốc kết thúc cho sân này.')
    : valid
    ? t('Đã chọn giờ sân này. Bạn có thể bấm sân khác trên bản đồ để chọn thêm sân vào đơn.')
    : t('Nhấn một mốc giờ để bắt đầu.');

  const submit = async () => {
    if (!user) { login(); return; }
    if (!ready) return;
    setSaving(true);
    setError('');
    try {
      const assignments = referee ? refSlots.map(s => ({scheduleId: s.id, staffId: referee.id})) : [];
      if (moveOrder) {
        if (!preview) {
          const result = await api(`/orders/${moveOrder.id}/preview`, 'POST', {scheduleIds: allChosen.map(s => s.id), assignments});
          setPreview(result);
          return;
        }
        await api(`/orders/${moveOrder.id}/schedule`, 'PATCH', {
          scheduleIds: allChosen.map(s => s.id),
          assignments,
          reason: 'Khách đổi lịch',
          expectedTotal: preview.next.total,
          requestId: req.current
        });
        setMoveOrder(null);
        navigate('orders');
        notify(t('Đã đổi lịch'));
        await refresh();
      } else {
        const result = await api('/orders', 'POST', {
          name: user.name,
          phone: '',
          accountId: user.id,
          scheduleIds: allChosen.map(s => s.id),
          assignments,
          voucherCode: appliedVoucher?.code || undefined,
          recurringWeeks: recurringWeeks > 1 ? recurringWeeks : undefined,
          requestId: req.current
        });
        resetAll();
        navigate('orders');
        await refresh();
        await pay('ORDER', result.id);
      }
    } catch (e) {
      setError(e.message);
      notify(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="ct-pad gx-booking">
      <header className="gx-booking-heading">
        <div>
          <span className="ct-eyebrow">COURTLY / {t('ĐẶT SÂN')}</span>
          <h1>{t('Chọn sân. Hẹn giờ chơi.')}</h1>
          <p>{t('Một buổi tennis, bắt đầu bằng một cuộc hẹn. Có thể đặt nhiều sân trong cùng 1 đơn.')}</p>
        </div>
        <span className="gx-opening"><Clock size={16}/> 06:00–23:00 · {t('Mỗi ngày')}</span>
      </header>

      {moveOrder && (
        <div className="gx-notice">
          {t('Đang đổi lịch đơn')} #{moveOrder.id.slice(0, 8)}{' '}
          <button onClick={() => setMoveOrder(null)}>{t('Bỏ đổi lịch')}</button>
        </div>
      )}

      <div className="gx-date-bar">
        <label>
          {t('Ngày chơi')}
          <input
            aria-label={t('Ngày chơi')}
            type="date"
            min={dateToday()}
            max={new Date(Date.now() + 90 * 86400000).toISOString().slice(0, 10)}
            value={date}
            onChange={e => {
              if (e.target.value) {
                resetAll();
                setDate(e.target.value);
              }
            }}
          />
        </label>
        <p><Clock size={16}/>{t('Chọn theo mốc 30 phút. Giá hiển thị theo giờ.')}</p>
      </div>

      <label className="gx-zone-filter">
        {t('Loại sân')}
        <select
          aria-label={t('Loại sân')}
          value={preferredZone}
          onChange={e => {
            setPreferredZone(e.target.value);
            setCourtId('');
          }}
        >
          {[['ALL', 'Tất cả'], ['A', 'Ngoài trời'], ['B', 'Trong nhà'], ['V', 'VIP']].map(([id, label]) => (
            <option key={id} value={id}>{t(label)}</option>
          ))}
        </select>
      </label>

      {/* CourtMap: Hiển thị trạng thái của từng sân, sân nào đã chọn sẽ có viền xanh + nhãn giờ */}
      <CourtMap
        courts={courts}
        selected={court}
        courtSelections={courtRanges}
        onSelect={c => {
          setCourtId(c.id);
          setError('');
        }}
        rangeLabel={rangeLabel}
        availability={c => {
          const sel = courtRanges[c.id];
          return sel && sel.valid ? true : canEndAt(rowsFor(c), start, end, available);
        }}
      />

      <div className="gx-book-layout">
        <section className="gx-play-panel" aria-labelledby="guest-time-title">
          <div className="gx-block-heading">
            <div>
              <span className="gx-step">02</span>
              <h2 id="guest-time-title">{t('Chọn giờ chơi')}</h2>
            </div>
            <span>{t('Mỗi mốc 30 phút')}</span>
          </div>

          {selectedCourtEntries.length > 0 && selectedCourtEntries.length < 3 && !moveOrder && (
            <div style={{
              background: '#eff6ff',
              border: '1px solid #bfdbfe',
              borderRadius: 8,
              padding: '10px 14px',
              marginBottom: 16,
              display: 'flex',
              alignItems: 'center',
              fontSize: 13,
              color: '#1e40af'
            }}>
              <span>
                💡 <b>Đặt nhiều sân:</b> Đang có {selectedCourtEntries.length} sân trong đơn. Bạn có thể chạm vào sân khác trên bản đồ phía trên để chọn thêm giờ.
              </span>
            </div>
          )}

          <div className="gx-selected-court">
            <img
              src={court?.imageUrl || `/guest/zone-${zone(court).toLowerCase()}-${zone(court) === 'A' ? 'outdoor' : zone(court) === 'B' ? 'indoor' : 'lounge'}.webp`}
              alt=""
            />
            <div>
              <span>{t('Khu')} {zone(court)} · {t(zone(court) === 'A' ? 'Ngoài trời' : zone(court) === 'B' ? 'Trong nhà' : 'VIP')}</span>
              <h3>{court?.name || t('Chọn sân')}</h3>
              <p>{displayDate}</p>
            </div>
            <strong>{money(court?.price)}<small>/ {t('giờ')}</small></strong>
          </div>

          <div className="gx-range-head">
            <button
              type="button"
              aria-label={t('Giờ bắt đầu')}
              aria-pressed={phase === 'start' && end === null}
              onClick={resetCurrentCourt}
            >
              <span>01 · {t('Giờ bắt đầu')}</span>
              <strong data-range-start>{start === null ? '— — : — —' : clock(start)}</strong>
            </button>
            <ArrowRight aria-hidden="true"/>
            <button
              type="button"
              aria-label={t('Giờ kết thúc')}
              aria-pressed={phase === 'end'}
              disabled={start === null}
              onClick={() => {
                if (court) {
                  setCourtRanges(prev => ({
                    ...prev,
                    [court.id]: {
                      ...prev[court.id],
                      end: null,
                      phase: 'end',
                      valid: false
                    }
                  }));
                }
              }}
            >
              <span>02 · {t('Giờ kết thúc')}</span>
              <strong data-range-end>{end === null ? '— — : — —' : clock(end)}</strong>
            </button>
            <button
              type="button"
              className="gx-range-reset"
              aria-label={t('Chọn lại giờ')}
              onClick={resetCurrentCourt}
            >
              <RotateCcw size={17}/>
              <span>{t('Chọn lại')}</span>
            </button>
          </div>

          <p className="gx-time-instruction" role="status" aria-live="polite">
            <span className={valid ? 'gx-complete-dot' : ''}/>
            {instruction}
          </p>

          <div className="gx-time-grid" aria-label={t('Mốc giờ chơi')} onMouseLeave={() => setHover(null)}>
            {timePoints(rows).map(minute => {
              const enabled = court?.status === 'ACTIVE' && (phase === 'end' ? canEndAt(rows, start, minute, available) : rows.some(s => toMinutes(s.start) === minute && available(s)));
              const first = minute === start, last = minute === end, between = valid && minute > start && minute < end;
              const preview = previewEnd !== null && minute > start && minute <= previewEnd;
              const label = first ? 'Bắt đầu' : last ? 'Kết thúc' : phase === 'end' ? 'Chọn giờ kết thúc' : 'Chọn giờ bắt đầu';
              return (
                <button
                  key={minute}
                  type="button"
                  data-time={clock(minute)}
                  disabled={!enabled}
                  aria-pressed={first || last || between}
                  aria-label={`${clock(minute)} · ${t(label)}`}
                  className={[first ? 'gx-time-start' : '', last ? 'gx-time-end' : '', between ? 'gx-time-between' : '', preview ? 'gx-time-preview' : ''].join(' ')}
                  onMouseEnter={() => setHover(minute)}
                  onFocus={() => setHover(minute)}
                  onBlur={() => setHover(null)}
                  onClick={() => pickTime(minute)}
                >
                  <strong>{clock(minute)}</strong>
                  <small>{first ? t('Bắt đầu') : last ? t('Kết thúc') : between ? t('Đã chọn') : !enabled && phase === 'start' && minute !== 1380 ? t('Không khả dụng') : '\u00a0'}</small>
                </button>
              );
            })}
          </div>

          {!rows.length && <Empty>{t('Chưa có lịch sân cho ngày này.')}</Empty>}
          <div className="gx-time-legend">
            <span><i/>{t('Còn trống')}</span>
            <span><i className="gx-legend-busy"/>{t('Không khả dụng')}</span>
            <span><i className="gx-legend-range"/>{t('Khoảng đã chọn')}</span>
          </div>

          <p className="gx-range-help">{t('Nhấn lần đầu để chọn giờ bắt đầu, lần sau để chọn giờ kết thúc. Có thể chọn tối đa 3 sân trên bản đồ để gộp chung đơn.')}</p>

          {/* Dịch vụ trọng tài */}
          <section className="gx-referee-section">
            <label className="gx-referee-toggle">
              <input
                type="checkbox"
                checked={wantReferee}
                disabled={!valid}
                onChange={e => {
                  setWantReferee(e.target.checked);
                  setRefId('');
                  req.current = requestId();
                }}
              />
              <UserRound aria-hidden="true"/>
              <span>
                <strong>{t('Thêm trọng tài')}</strong>
                <small>{t(valid ? 'Chọn người hỗ trợ trong khoảng giờ sân này.' : 'Chọn đủ giờ chơi để xem trọng tài.')}</small>
              </span>
              <span className="gx-optional">{t('Không bắt buộc')}</span>
            </label>

            {wantReferee && valid && (!user ? (
              <Action secondary onClick={login}>{t('Đăng nhập để xem trọng tài')}</Action>
            ) : !options ? (
              <p role="status">{t('Đang tải dữ liệu…')}</p>
            ) : (
              <div className="gx-referee-panel">
                <div className="gx-time-select">
                  <label>
                    {t('Từ giờ')}
                    <select
                      aria-label={t('Từ giờ')}
                      value={refStart}
                      onChange={e => {
                        setRefStart(e.target.value);
                        if (toMinutes(refEnd) <= toMinutes(e.target.value)) setRefEnd(clock(end));
                        setRefId('');
                      }}
                    >
                      {currentRange.slots?.map(s => (
                        <option key={s.id} value={time(s.start)}>{time(s.start)}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    {t('Đến giờ')}
                    <select
                      aria-label={t('Đến giờ')}
                      value={refEnd}
                      onChange={e => {
                        setRefEnd(e.target.value);
                        setRefId('');
                      }}
                    >
                      {currentRange.slots?.filter(s => toMinutes(s.end) > toMinutes(refStart)).map(s => (
                        <option key={s.id} value={time(s.end)}>{time(s.end)}</option>
                      ))}
                    </select>
                  </label>
                </div>
                <div className="gx-referees">
                  {people.map(p => (
                    <button
                      key={p.id}
                      type="button"
                      className={refId === p.id ? 'gx-selected gx-ref-card' : 'gx-ref-card'}
                      aria-pressed={refId === p.id}
                      onClick={() => {
                        setRefId(p.id);
                        req.current = requestId();
                      }}
                    >
                      <div className="gx-ref-top">
                        <span className="gx-ref-avatar"><UserRound size={20}/></span>
                        <div className="gx-ref-meta">
                          <strong>{p.name}</strong>
                          <span className="gx-ref-badge">{p.level?.split('·')?.[0]?.trim() || t('Trọng tài CLB')}</span>
                        </div>
                      </div>
                      <p className="gx-ref-desc">{p.level?.split('·')?.slice(1)?.join('·')?.trim() || t('Đạt chuẩn điều hành thi đấu')}</p>
                      <div className="gx-ref-foot">
                        <b className="gx-ref-rate">{money(p.rate)} <small>/ {t('giờ')}</small></b>
                        {refId === p.id ? <span className="gx-ref-chosen"><Check size={16}/> {t('Đã chọn')}</span> : <span className="gx-ref-pick">{t('Chọn')}</span>}
                      </div>
                    </button>
                  ))}
                </div>
                {referee && (
                  <div className="gx-notice" style={{marginTop: 14, background: '#f2f8eb', borderColor: '#b5d3a6'}}>
                    ✓ {t('Đã chọn')} <b>{referee.name}</b>. {t('Trọng tài sẽ có mặt trước giờ bắt đầu 10 phút để kiểm tra sân, lưới và phổ biến điều lệ thi đấu.')}
                  </div>
                )}
                {!people.length && <Empty>{t('Không có trọng tài rảnh toàn khoảng này. Hãy đổi giờ hoặc bỏ dịch vụ.')}</Empty>}
              </div>
            ))}
          </section>
        </section>

        {/* CỘT TỔNG KẾT ĐƠN HÀNG */}
        <aside className="gx-quote" aria-label={t('Chi phí buổi chơi')}>
          <span className="ct-eyebrow">{t('BUỔI CHƠI CỦA BẠN')}</span>
          <h2>{selectedCourtEntries.length > 1 ? `${selectedCourtEntries.length} ${t('sân trong đơn')} · Courtly` : court?.name || 'Courtly'}</h2>
          <p className="gx-quote-date">{displayDate}</p>

          {/* DANH SÁCH TẤT CẢ CÁC SÂN ĐANG CHỌN */}
          {selectedCourtEntries.length > 0 && (
            <div style={{background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: '10px 12px', marginBottom: 14}}>
              <div style={{fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                <span>{t('CÁC SÂN TRONG ĐƠN')} ({selectedCourtEntries.length}/3)</span>
                {selectedCourtEntries.length > 1 && (
                  <span style={{fontSize: 11, color: '#16a34a', fontWeight: 600}}>✓ {t('Gộp chung 1 đơn')}</span>
                )}
              </div>
              {selectedCourtEntries.map(sc => (
                <div
                  key={sc.court.id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '6px 0',
                    borderBottom: '1px dashed #e2e8f0'
                  }}
                >
                  <div>
                    <button
                      type="button"
                      onClick={() => setCourtId(sc.court.id)}
                      style={{
                        background: 'none',
                        border: 'none',
                        padding: 0,
                        cursor: 'pointer',
                        fontWeight: sc.court.id === court?.id ? 700 : 600,
                        color: sc.court.id === court?.id ? '#173c32' : '#334155',
                        fontSize: 13,
                        textAlign: 'left'
                      }}
                    >
                      {sc.court.name} {sc.court.id === court?.id ? `(${t('đang xem')})` : ''}
                    </button>
                    <div style={{fontSize: 11, color: '#64748b'}}>
                      {sc.rangeLabel} ({sc.slots.length * 30} {t('phút')}) · {money(sc.slots.reduce((sum, s) => sum + s.price, 0))}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setCourtRanges(prev => {
                        const copy = {...prev};
                        delete copy[sc.court.id];
                        return copy;
                      });
                    }}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#dc2626',
                      cursor: 'pointer',
                      fontSize: 15,
                      fontWeight: 'bold',
                      padding: '2px 6px'
                    }}
                    title={t('Xóa sân này khỏi đơn')}
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* SÂN ĐANG CHỌN DỞ */}
          {valid && (
            <div className="gx-quote-range">
              <Clock size={18}/>
              <div>
                <strong>{court.name}: {rangeLabel}</strong>
                <span>{`${end - start} ${t('phút')}`}</span>
              </div>
            </div>
          )}
          {!valid && selectedCourtEntries.length === 0 && (
            <div className="gx-quote-range">
              <Clock size={18}/>
              <div>
                <strong>{t('Chưa chọn giờ')}</strong>
                <span>{t('Chọn giờ bắt đầu và kết thúc')}</span>
              </div>
            </div>
          )}

          {/* KHU VỰC NHẬP VÀ CHỌN VOUCHER */}
          <div className="gx-voucher-box" style={{
            margin: '14px 0',
            padding: '12px',
            background: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: 10
          }}>
            <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10}}>
              <div style={{display: 'flex', alignItems: 'center', gap: 6}}>
                <Tag size={15} color="#173c32"/>
                <span style={{fontSize: 12, fontWeight: 700, color: '#173c32', textTransform: 'uppercase', letterSpacing: '0.04em'}}>
                  {t('Mã ưu đãi / Voucher')}
                </span>
              </div>
              {appliedVoucher && (
                <span style={{fontSize: 11, fontWeight: 700, color: '#16a34a', background: '#dcfce7', padding: '2px 8px', borderRadius: 10}}>
                  {t('Đang áp dụng 1 mã')}
                </span>
              )}
            </div>

            {!appliedVoucher ? (
              <>
                <div style={{display: 'flex', gap: 6, marginBottom: 10}}>
                  <input
                    type="text"
                    aria-label={t('Mã voucher')}
                    placeholder={t('Nhập mã voucher (VD: WELCOME, HE2026, VIP10...)')}
                    value={voucherInput}
                    onChange={e => { setVoucherInput(e.target.value.toUpperCase()); setVoucherError(''); }}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); applyVoucher(); } }}
                    style={{
                      flex: 1,
                      padding: '7px 10px',
                      borderRadius: 6,
                      border: '1px solid #cbd5e1',
                      fontSize: 12,
                      fontWeight: 600,
                      textTransform: 'uppercase'
                    }}
                  />
                  <button
                    type="button"
                    disabled={voucherBusy || !voucherInput.trim()}
                    onClick={() => applyVoucher()}
                    style={{
                      background: '#173c32',
                      color: '#def46a',
                      border: 'none',
                      padding: '0 14px',
                      borderRadius: 6,
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: voucherBusy || !voucherInput.trim() ? 'not-allowed' : 'pointer',
                      opacity: voucherBusy || !voucherInput.trim() ? 0.6 : 1
                    }}
                  >
                    {voucherBusy ? '…' : t('Áp dụng')}
                  </button>
                </div>

                {/* Danh sách voucher: Khả dụng (sáng rõ) và Có điều kiện (làm mờ đi) */}
                {(() => {
                  const rawList = options?.availableVouchers?.length ? options.availableVouchers : publicVouchers;
                  if (!rawList || rawList.length === 0) return null;
                  
                  const applicableList = rawList.filter(v => v.applicable);
                  const conditionalList = rawList.filter(v => !v.applicable);

                  return (
                    <div style={{display: 'flex', flexDirection: 'column', gap: 10, marginTop: 10}}>
                      {/* VOUCHER KHẢ DỤNG - HIỆN RÕ */}
                      {applicableList.length > 0 && (
                        <div>
                          <div style={{fontSize: 11, fontWeight: 700, color: '#16a34a', textTransform: 'uppercase', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 4}}>
                            <span>●</span> {t('Voucher khả dụng (có thể dùng ngay)')}
                          </div>
                          <div style={{display: 'flex', flexDirection: 'column', gap: 6}}>
                            {applicableList.map(vc => (
                              <div
                                key={vc.code}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  background: '#ffffff',
                                  border: '1.5px solid #22c55e',
                                  borderRadius: 8,
                                  padding: '8px 10px',
                                  boxShadow: '0 1px 3px rgba(34,197,94,0.1)'
                                }}
                              >
                                <div style={{flex: 1, marginRight: 8}}>
                                  <div style={{display: 'flex', alignItems: 'center', gap: 6}}>
                                    <span style={{
                                      background: '#173c32',
                                      color: '#def46a',
                                      fontSize: 11,
                                      fontWeight: 800,
                                      padding: '2px 7px',
                                      borderRadius: 4,
                                      letterSpacing: '0.04em'
                                    }}>
                                      {vc.code}
                                    </span>
                                    <span style={{fontSize: 12, fontWeight: 700, color: '#16a34a'}}>
                                      {vc.type === 'PERCENT' ? `Giảm ${vc.value}%` : `Giảm ${money(vc.value)}`}
                                    </span>
                                  </div>
                                  <div style={{fontSize: 11.5, color: '#334155', marginTop: 3, fontWeight: 500}}>
                                    {vc.description}
                                  </div>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => applyVoucher(vc.code)}
                                  disabled={voucherBusy}
                                  style={{
                                    background: '#16a34a',
                                    color: '#ffffff',
                                    border: 'none',
                                    padding: '5px 12px',
                                    borderRadius: 6,
                                    fontSize: 11.5,
                                    fontWeight: 700,
                                    cursor: 'pointer',
                                    flexShrink: 0
                                  }}
                                >
                                  {t('Áp dụng')}
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* VOUCHER CÓ ĐIỀU KIỆN - LÀM MỜ ĐI */}
                      {conditionalList.length > 0 && (
                        <div style={{marginTop: applicableList.length > 0 ? 4 : 0}}>
                          <div style={{fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 4}}>
                            <span>○</span> {t('Voucher có điều kiện (chưa đủ điều kiện)')}
                          </div>
                          <div style={{display: 'flex', flexDirection: 'column', gap: 6}}>
                            {conditionalList.map(vc => (
                              <div
                                key={vc.code}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  background: '#f8fafc',
                                  border: '1px dashed #cbd5e1',
                                  borderRadius: 8,
                                  padding: '8px 10px',
                                  opacity: 0.55
                                }}
                              >
                                <div style={{flex: 1, marginRight: 8}}>
                                  <div style={{display: 'flex', alignItems: 'center', gap: 6}}>
                                    <span style={{
                                      background: '#94a3b8',
                                      color: '#ffffff',
                                      fontSize: 11,
                                      fontWeight: 700,
                                      padding: '2px 7px',
                                      borderRadius: 4
                                    }}>
                                      {vc.code}
                                    </span>
                                    <span style={{fontSize: 11.5, fontWeight: 600, color: '#64748b'}}>
                                      {vc.description}
                                    </span>
                                  </div>
                                  <div style={{
                                    fontSize: 11,
                                    color: '#b45309',
                                    marginTop: 3,
                                    fontWeight: 600,
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 4
                                  }}>
                                    <span>⚠️</span> {t(vc.reason || 'Chưa thỏa điều kiện áp dụng')}
                                  </div>
                                </div>
                                <button
                                  type="button"
                                  disabled
                                  style={{
                                    background: '#e2e8f0',
                                    color: '#94a3b8',
                                    border: 'none',
                                    padding: '5px 10px',
                                    borderRadius: 6,
                                    fontSize: 11,
                                    fontWeight: 600,
                                    cursor: 'not-allowed',
                                    flexShrink: 0
                                  }}
                                >
                                  {t('Chưa đủ điều kiện')}
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </>
            ) : (
              /* VOUCHER ĐÃ ÁP DỤNG */
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                background: '#f0fdf4',
                border: '1.5px solid #86efac',
                borderRadius: 8,
                padding: '10px 12px'
              }}>
                <div>
                  <div style={{fontWeight: 800, fontSize: 13, color: '#15803d', display: 'flex', alignItems: 'center', gap: 6}}>
                    <span>✓</span>
                    <span>{appliedVoucher.code}</span>
                    <span style={{background: '#22c55e', color: '#fff', fontSize: 11, padding: '1px 6px', borderRadius: 4}}>
                      −{money(appliedVoucher.discount)}
                    </span>
                  </div>
                  <div style={{fontSize: 11.5, color: '#166534', marginTop: 2}}>
                    {appliedVoucher.description}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={removeVoucher}
                  style={{
                    background: '#fee2e2',
                    border: '1px solid #fca5a5',
                    color: '#b91c1c',
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: 'pointer',
                    padding: '5px 10px',
                    borderRadius: 6
                  }}
                >
                  ✕ {t('Gỡ voucher')}
                </button>
              </div>
            )}

            {voucherError && (
              <div style={{color: '#dc2626', fontSize: 11.5, fontWeight: 600, marginTop: 8, background: '#fef2f2', border: '1px solid #fecaca', padding: '6px 10px', borderRadius: 6}}>
                ⚠️ {voucherError}
              </div>
            )}
          </div>

          {/* CHỌN HÌNH THỨC ĐẶT SÂN: ĐẶT 1 BUỔI HOẶC ĐỊNH KỲ */}
          {!moveOrder && (
            <div className="gx-recurring-box" style={{
              margin: '14px 0',
              padding: '12px',
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: 10
            }}>
              <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8}}>
                <span style={{fontSize: 12, fontWeight: 700, color: '#173c32', textTransform: 'uppercase', letterSpacing: '0.04em'}}>
                  {t('Hình thức đặt')}
                </span>
                {recurringWeeks > 1 && (
                  <span style={{fontSize: 11, color: '#0f766e', fontWeight: 700, background: '#ccfbf1', padding: '2px 8px', borderRadius: 12}}>
                    {t('Định kỳ')} {recurringWeeks} {t('tuần')}
                  </span>
                )}
              </div>
              <div style={{display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6}}>
                {[
                  {weeks: 1, label: t('1 buổi lẻ')},
                  {weeks: 4, label: t('4 tuần')},
                  {weeks: 8, label: t('8 tuần')},
                  {weeks: 12, label: t('12 tuần')}
                ].map(opt => (
                  <button
                    key={opt.weeks}
                    type="button"
                    onClick={() => setRecurringWeeks(opt.weeks)}
                    style={{
                      padding: '8px 4px',
                      fontSize: 11,
                      fontWeight: recurringWeeks === opt.weeks ? 700 : 600,
                      borderRadius: 6,
                      border: recurringWeeks === opt.weeks ? '2px solid #173c32' : '1px solid #cbd5e1',
                      background: recurringWeeks === opt.weeks ? '#173c32' : '#ffffff',
                      color: recurringWeeks === opt.weeks ? '#def46a' : '#334155',
                      cursor: 'pointer',
                      textAlign: 'center',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              {recurringWeeks > 1 && (
                <div style={{fontSize: 11, color: '#0f766e', marginTop: 8, lineHeight: 1.4}}>
                  🔄 {t('Hệ thống tự động giữ khung giờ này cho')} <strong>{recurringWeeks} {t('tuần liên tiếp')}</strong> ({date} → {new Date(new Date(date).getTime() + (recurringWeeks - 1) * 7 * 86400000).toISOString().slice(0, 10)}).
                </div>
              )}
            </div>
          )}

          <dl>
            <div>
              <dt>
                {t('Tiền sân')} ({allChosen.length * 30} {t('phút')}{recurringWeeks > 1 ? ` × ${recurringWeeks} ${t('tuần')}` : ''})
              </dt>
              <dd>{money(gross)}</dd>
            </div>
            {discount > 0 && (
              <div>
                <dt>{t('Ưu đãi hội viên')}{recurringWeeks > 1 ? ` (× ${recurringWeeks} ${t('tuần')})` : ''}</dt>
                <dd>−{money(discount)}</dd>
              </div>
            )}
            {appliedVoucher && (
              <div>
                <dt>{t('Voucher')} ({appliedVoucher.code})</dt>
                <dd style={{color: '#16a34a', fontWeight: 700}}>−{money(appliedVoucher.discount)}</dd>
              </div>
            )}
            <div>
              <dt>{t('Trọng tài')}</dt>
              <dd>{money(refFee)}</dd>
            </div>
            <div className="gx-total">
              <dt>{t('Tổng tiền')}</dt>
              <dd>{money(totalAmount)}</dd>
            </div>
          </dl>

          <div className="gx-deposit">
            <div>
              <span>{t('Cọc 50% tiền sân')} {recurringWeeks > 1 ? `(${recurringWeeks} ${t('tuần')})` : ''}</span>
              <strong>{money(depositAmount)}</strong>
            </div>
            <p>{t('Phí trọng tài nằm trong phần thanh toán còn lại.')}</p>
          </div>

          {preview && (
            <div className="gx-notice" role="status">
              <h3>{t('Xem trước đổi lịch')}</h3>
              <p>{t('Tổng cũ')}: {money(preview.previous.total)} → {t('Tổng mới')}: {money(preview.next.total)}</p>
              <p>{t('Chênh lệch')}: {money(preview.difference)}</p>
              <p>{t('Còn thanh toán')}: {money(preview.additionalDue)}</p>
              <p>{t('Chờ hoàn / đối soát')}: {money(preview.reviewAmount)}</p>
            </div>
          )}

          {!user && (
            <p className="gx-notice">{t('Đăng nhập để tạo đơn gắn với tài khoản của bạn. Lựa chọn hiện tại được giữ khi đăng nhập.')}</p>
          )}

          {error && <div className="gx-error" role="alert">{t(error)}</div>}

          <Action disabled={!ready} onClick={submit}>
            {t(saving ? 'Đang xử lý…' : !user ? 'Đăng nhập để đặt sân' : moveOrder ? (preview ? 'Xác nhận đổi lịch' : 'Xem trước đổi lịch') : 'Tiếp tục thanh toán')}
            <ArrowUpRight size={18}/>
          </Action>
          <p className="gx-quote-note">
            {t('Lựa chọn chưa giữ chỗ. Sân được kiểm tra lại khi tạo đơn.')} {t('Thời gian giữ chỗ')}: {data?.settings?.holdMinutes ?? 5} {t('phút')}.{' '}
            <button onClick={() => navigate('pricing')}>{t('Bảng giá & chính sách')}</button>
          </p>
        </aside>
      </div>
    </div>
  );
}
