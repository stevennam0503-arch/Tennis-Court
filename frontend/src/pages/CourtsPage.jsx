import React, { useState, useMemo } from 'react';
import { Plus, Trash2, SlidersHorizontal, Clock, Percent, RotateCcw, Save, Sun, Moon, Zap, Calendar } from 'lucide-react';
import { CourtPhoto, courtDescription } from '../components/CourtGallery';
import { useCourtly } from '../context';
import { Title, Chip, Button, Tabs } from '../components/UI';
import { labels, money } from '../utils/format';

const TIME_STEPS = [
  '06:00', '07:00', '08:00', '09:00', '10:00', '11:00', '12:00',
  '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00',
  '20:00', '21:00', '22:00', '23:00'
];

const DEFAULT_CONFIG = {
  weekday: {
    goldenStart: '09:00',
    goldenEnd: '16:00',
    goldenPercent: -25,
    ledStart: '18:00',
    ledEnd: '22:00',
    ledPercent: 40
  },
  weekend: {
    dayPercent: 25,
    ledStart: '17:00',
    ledEnd: '22:00',
    primePercent: 50,
    latePercent: 20
  }
};

const parseSavedConfig = (savedStr) => {
  if (!savedStr) return DEFAULT_CONFIG;
  try {
    const p = JSON.parse(savedStr);
    if (p.weekday && p.weekend) {
      return {
        weekday: { ...DEFAULT_CONFIG.weekday, ...p.weekday },
        weekend: { ...DEFAULT_CONFIG.weekend, ...p.weekend }
      };
    }
    return {
      weekday: {
        goldenStart: p.goldenStart || '09:00',
        goldenEnd: p.goldenEnd || '16:00',
        goldenPercent: typeof p.goldenPercent === 'number' ? p.goldenPercent : -25,
        ledStart: p.ledStart || '18:00',
        ledEnd: p.ledEnd || '22:00',
        ledPercent: typeof p.ledPercent === 'number' ? p.ledPercent : 40
      },
      weekend: {
        dayPercent: typeof p.weekendPercent === 'number' ? p.weekendPercent : 25,
        ledStart: '17:00',
        ledEnd: '22:00',
        primePercent: 50,
        latePercent: 20
      }
    };
  } catch (e) {
    return DEFAULT_CONFIG;
  }
};

export default function CourtsPage() {
  const { data, show, navigate, mutate, notify } = useCourtly();
  const [deletingId, setDeletingId] = useState(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [tab, setTab] = useState('courts');
  const [courtTypeFilter, setCourtTypeFilter] = useState('ALL');

  const [scheduleTab, setScheduleTab] = useState('WEEKDAY');

  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [categoryInputs, setCategoryInputs] = useState({ OUTDOOR: 160000, INDOOR: 240000, VIP: 400000 });
  const [isSavingRates, setIsSavingRates] = useState(false);

  const [config, setConfig] = useState(() => {
    try {
      const saved = localStorage.getItem('courtly_hourly_pricing_config');
      return parseSavedConfig(saved);
    } catch (e) {}
    return DEFAULT_CONFIG;
  });
  const [isDirty, setIsDirty] = useState(false);

  const edit = (collection, row) => show({ type: 'entity', collection, row });

  const executeDeleteCourt = async (court) => {
    if (deletingId) return;
    const activeOrders = (data.orders || []).filter(o =>
      ['HOLDING', 'CONFIRMED', 'CHECKED_IN'].includes(o.status) &&
      o.slots?.some(s => s.court === court.id)
    );
    if (activeOrders.length > 0) {
      notify(`⚠️ Không thể xóa "${court.name}" vì hiện có ${activeOrders.length} đơn đặt sân đang chơi hoặc sắp tới (ví dụ #${activeOrders[0].id.slice(0, 8).toUpperCase()} · ${activeOrders[0].name}). Vui lòng hoàn tất hoặc đổi sân cho các đơn này trước!`);
      setConfirmDeleteId(null);
      return;
    }
    setDeletingId(court.id);
    try {
      await mutate(`/catalog/courts/${court.id}`, {}, 'DELETE');
      notify(`Đã xóa sân ${court.name} khỏi hệ thống.`);
      setConfirmDeleteId(null);
    } catch (e) {
      notify(e.message || 'Lỗi khi xóa sân.');
    } finally {
      setDeletingId(null);
    }
  };

  const activeCourts = useMemo(() => {
    return (data.courts || []).filter(c => c.status !== 'DELETED');
  }, [data.courts]);

  const categoryRates = useMemo(() => {
    const getRate = (type, fallback) => {
      const match = activeCourts.find(c => c.type === type && c.price);
      return match ? Number(match.price) : fallback;
    };
    return {
      OUTDOOR: getRate('OUTDOOR', 160000),
      INDOOR: getRate('INDOOR', 240000),
      VIP: getRate('VIP', 400000)
    };
  }, [activeCourts]);

  const openCategoryModal = () => {
    setCategoryInputs({ ...categoryRates });
    setShowCategoryModal(true);
  };

  const handleSaveCategoryRates = async (e) => {
    e.preventDefault();
    setIsSavingRates(true);
    try {
      const parsed = {
        OUTDOOR: Math.max(1, Number(categoryInputs.OUTDOOR) || 160000),
        INDOOR: Math.max(1, Number(categoryInputs.INDOOR) || 240000),
        VIP: Math.max(1, Number(categoryInputs.VIP) || 400000),
      };
      for (const court of activeCourts) {
        const newPrice = parsed[court.type] || parsed.OUTDOOR;
        if (Number(court.price) !== newPrice) {
          await mutate(`/catalog/courts/${court.id}`, { ...court, price: newPrice }, 'PUT');
        }
      }
      notify('Đã cập nhật giá 3 phân khu.');
      setShowCategoryModal(false);
    } catch (err) {
      notify(err.message || 'Lỗi cập nhật giá.');
    } finally {
      setIsSavingRates(false);
    }
  };

  const toMinutes = (t) => {
    const [h, m] = String(t || '00:00').split(':').map(Number);
    return h * 60 + (m || 0);
  };
  const toTimeStr = (m) => {
    const h = Math.floor(m / 60);
    const min = m % 60;
    return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
  };

  const handleWeekdayTimeChange = (field, newTime) => {
    let gStart = toMinutes(config.weekday.goldenStart);
    let gEnd = toMinutes(config.weekday.goldenEnd);
    let lStart = toMinutes(config.weekday.ledStart);
    let lEnd = toMinutes(config.weekday.ledEnd);
    let val = toMinutes(newTime);

    const minClub = 6 * 60;
    const maxClub = 23 * 60;

    if (field === 'goldenStart') {
      val = Math.max(minClub, Math.min(gEnd - 60, val));
      gStart = val;
    } else if (field === 'goldenEnd') {
      val = Math.max(gStart + 60, val);
      if (val > lStart) {
        lStart = val;
        if (lStart >= lEnd) {
          lEnd = Math.min(maxClub, lStart + 60);
          if (lEnd === maxClub && lStart >= lEnd) {
            lStart = maxClub - 60;
            val = lStart;
          }
        }
      }
      gEnd = val;
    } else if (field === 'ledStart') {
      val = Math.min(lEnd - 60, val);
      if (val < gEnd) {
        gEnd = val;
        if (gEnd <= gStart) {
          gStart = Math.max(minClub, gEnd - 60);
        }
      }
      lStart = val;
    } else if (field === 'ledEnd') {
      val = Math.min(maxClub, Math.max(lStart + 60, val));
      lEnd = val;
    }

    setConfig(prev => ({
      ...prev,
      weekday: {
        ...prev.weekday,
        goldenStart: toTimeStr(gStart),
        goldenEnd: toTimeStr(gEnd),
        ledStart: toTimeStr(lStart),
        ledEnd: toTimeStr(lEnd)
      }
    }));
    setIsDirty(true);
  };

  const handleWeekendTimeChange = (field, newTime) => {
    let lStart = toMinutes(config.weekend.ledStart);
    let lEnd = toMinutes(config.weekend.ledEnd);
    let val = toMinutes(newTime);

    const minClub = 6 * 60;
    const maxClub = 23 * 60;

    if (field === 'ledStart') {
      val = Math.max(minClub + 60, Math.min(lEnd - 60, val));
      lStart = val;
    } else if (field === 'ledEnd') {
      val = Math.min(maxClub, Math.max(lStart + 60, val));
      lEnd = val;
    }

    setConfig(prev => ({
      ...prev,
      weekend: {
        ...prev.weekend,
        ledStart: toTimeStr(lStart),
        ledEnd: toTimeStr(lEnd)
      }
    }));
    setIsDirty(true);
  };

  const handleWeekdayPercentChange = (field, val) => {
    const num = Number(val);
    setConfig(prev => ({
      ...prev,
      weekday: { ...prev.weekday, [field]: isNaN(num) ? 0 : num }
    }));
    setIsDirty(true);
  };

  const handleWeekendPercentChange = (field, val) => {
    const num = Number(val);
    setConfig(prev => ({
      ...prev,
      weekend: { ...prev.weekend, [field]: isNaN(num) ? 0 : num }
    }));
    setIsDirty(true);
  };

  const handleSaveConfig = () => {
    try {
      localStorage.setItem('courtly_hourly_pricing_config', JSON.stringify(config));
      notify('Đã lưu chính sách giá.');
      setIsDirty(false);
    } catch (e) {
      notify('Lỗi lưu: ' + e.message);
    }
  };

  const handleResetConfig = () => {
    setConfig(DEFAULT_CONFIG);
    try {
      localStorage.removeItem('courtly_hourly_pricing_config');
    } catch (e) {}
    notify('Đã khôi phục giá mặc định.');
    setIsDirty(false);
  };

  const weekdaySegments = useMemo(() => {
    const segments = [];
    const minTime = '06:00';
    const maxTime = '23:00';
    const w = config.weekday;

    if (w.goldenStart > minTime) {
      segments.push({
        id: 'w_morning_std',
        name: 'Sáng tiêu chuẩn',
        timeRange: `${minTime} – ${w.goldenStart}`,
        type: 'STANDARD',
        percent: 0,
        badgeBg: '#f1f5f9',
        badgeColor: '#475569'
      });
    }

    segments.push({
      id: 'w_golden',
      name: 'Giờ vàng',
      timeRange: `${w.goldenStart} – ${w.goldenEnd}`,
      type: 'DISCOUNT',
      percent: w.goldenPercent,
      badgeBg: '#dcfce7',
      badgeColor: '#166534'
    });

    if (w.ledStart > w.goldenEnd) {
      segments.push({
        id: 'w_afternoon_std',
        name: 'Chiều tiêu chuẩn',
        timeRange: `${w.goldenEnd} – ${w.ledStart}`,
        type: 'STANDARD',
        percent: 0,
        badgeBg: '#f1f5f9',
        badgeColor: '#475569'
      });
    }

    segments.push({
      id: 'w_led',
      name: 'Tối đèn LED',
      timeRange: `${w.ledStart} – ${w.ledEnd}`,
      type: 'SURCHARGE',
      percent: w.ledPercent,
      badgeBg: '#ffedd5',
      badgeColor: '#9a3412'
    });

    if (w.ledEnd < maxTime) {
      segments.push({
        id: 'w_night_std',
        name: 'Đêm tiêu chuẩn',
        timeRange: `${w.ledEnd} – ${maxTime}`,
        type: 'STANDARD',
        percent: 0,
        badgeBg: '#f1f5f9',
        badgeColor: '#475569'
      });
    }

    return segments;
  }, [config.weekday]);

  const weekendSegments = useMemo(() => {
    const segments = [];
    const minTime = '06:00';
    const maxTime = '23:00';
    const w = config.weekend;

    segments.push({
      id: 'we_day',
      name: 'Ban ngày cuối tuần',
      timeRange: `${minTime} – ${w.ledStart}`,
      type: 'WEEKEND_DAY',
      percent: w.dayPercent,
      badgeBg: '#f3e8ff',
      badgeColor: '#6b21a8'
    });

    segments.push({
      id: 'we_prime_led',
      name: 'Tối đèn LED cuối tuần',
      timeRange: `${w.ledStart} – ${w.ledEnd}`,
      type: 'WEEKEND_PRIME',
      percent: w.primePercent,
      badgeBg: '#fef2f2',
      badgeColor: '#b91c1c'
    });

    if (w.ledEnd < maxTime) {
      segments.push({
        id: 'we_late',
        name: 'Đêm muộn',
        timeRange: `${w.ledEnd} – ${maxTime}`,
        type: 'WEEKEND_LATE',
        percent: w.latePercent,
        badgeBg: '#f1f5f9',
        badgeColor: '#475569'
      });
    }

    return segments;
  }, [config.weekend]);

  const courtCounts = useMemo(() => {
    const c = { all: activeCourts.length, VIP: 0, INDOOR: 0, OUTDOOR: 0 };
    for (const court of activeCourts) {
      if (c[court.type] !== undefined) c[court.type]++;
      else c.OUTDOOR++;
    }
    return c;
  }, [activeCourts]);

  const filteredCourts = useMemo(() => {
    return activeCourts.filter(c => {
      if (courtTypeFilter !== 'ALL' && c.type !== courtTypeFilter) return false;
      return true;
    });
  }, [activeCourts, courtTypeFilter]);

  const calcRate = (base, percent) => Math.round(base * (1 + percent / 100));

  const activeSegments = scheduleTab === 'WEEKDAY' ? weekdaySegments : weekendSegments;

  return (
    <>
      <Title
        subtitle="Quản lý sân, trạng thái và chính sách giá."
        action={
          <div style={{ display: 'flex', gap: 10 }}>
            <Button
              className="secondary"
              onClick={openCategoryModal}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
            >
              <SlidersHorizontal size={15} /> Giá 3 phân khu
            </Button>
            <Button className="primary" onClick={() => edit('courts')}>
              <Plus size={16} style={{ marginRight: 4 }} /> Thêm sân
            </Button>
          </div>
        }
      >
        Sân & bảng giá
      </Title>

      <Tabs
        options={[
          ['courts', `Danh sách sân (${activeCourts.length})`],
          ['policy', 'Chính sách giá theo giờ'],
        ]}
        value={tab}
        onChange={setTab}
      />

      {tab === 'courts' && (
        <>
          <div className="tabs" style={{ marginBottom: 18 }}>
            {[
              ['ALL', `Tất cả (${courtCounts.all})`],
              ['VIP', `Sân VIP (${courtCounts.VIP})`],
              ['INDOOR', `Sân trong nhà (${courtCounts.INDOOR})`],
              ['OUTDOOR', `Sân ngoài trời (${courtCounts.OUTDOOR})`],
            ].map(([t, label]) => (
              <button
                key={t}
                className={courtTypeFilter === t ? 'on' : ''}
                onClick={() => setCourtTypeFilter(t)}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="grid-cards">
            {filteredCourts.map((c) => (
              <article className="item-card" key={c.id}>
                <CourtPhoto
                  court={c}
                  style={{
                    width: '100%',
                    height: 190,
                    objectFit: 'cover',
                    borderRadius: '8px 8px 0 0',
                    display: 'block'
                  }}
                />

                <div className="card-body">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 8 }}>
                    <div>
                      <h3 style={{ margin: '0 0 4px', fontSize: 16 }}>{c.name}</h3>
                      <span className="badge info">{labels[c.type] || c.type}</span>
                    </div>
                    <Chip status={c.status} />
                  </div>

                  <p style={{ margin: '8px 0 12px', fontSize: 13, color: 'var(--muted)', minHeight: 38 }}>
                    {courtDescription(c)}
                  </p>

                  <div style={{ padding: '8px 12px', background: 'var(--bg-panel)', borderRadius: 6, marginBottom: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 12, color: 'var(--muted)' }}>Giá niêm yết:</span>
                      <strong style={{ fontSize: 15, color: 'var(--green)' }}>
                        {money(c.price || categoryRates[c.type] || 160000)}/h
                      </strong>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 8, marginTop: 'auto' }}>
                    <Button
                      className="secondary sm"
                      style={{ flex: 1 }}
                      onClick={() => edit('courts', c)}
                    >
                      Chỉnh sửa
                    </Button>

                    {confirmDeleteId === c.id ? (
                      <div style={{ display: 'flex', gap: 4 }}>
                        <Button
                          className="danger sm"
                          disabled={deletingId === c.id}
                          onClick={() => executeDeleteCourt(c)}
                          style={{ padding: '0 10px' }}
                        >
                          {deletingId === c.id ? 'Đang xóa…' : 'Xác nhận'}
                        </Button>
                        <Button
                          className="secondary sm"
                          onClick={() => setConfirmDeleteId(null)}
                          style={{ padding: '0 8px' }}
                        >
                          Hủy
                        </Button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        className="btn-danger-icon"
                        title="Xóa sân"
                        onClick={() => setConfirmDeleteId(c.id)}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                          padding: '6px 10px',
                          border: '1px solid #fee2e2',
                          borderRadius: 6,
                          background: '#fff5f5',
                          color: '#dc2626',
                          cursor: 'pointer',
                          fontSize: 12,
                          fontWeight: 500,
                          transition: 'all 0.15s ease'
                        }}
                      >
                        <Trash2 size={13} />
                        <span>Xóa</span>
                      </button>
                    )}
                  </div>
                </div>
              </article>
            ))}
          </div>
        </>
      )}

      {/* TAB CHÍNH SÁCH GIÁ: GỌN GÀNG, HIỆU QUẢ */}
      {tab === 'policy' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* PANEL 1: CẤU HÌNH KHUNG GIỜ */}
          <div style={{
            background: '#ffffff',
            borderRadius: 12,
            padding: '20px',
            border: '1px solid #e2e8f0',
            boxShadow: '0 1px 4px rgba(0,0,0,0.03)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Clock size={18} color="#16a34a" />
                <h3 style={{ margin: 0, fontSize: 16, color: '#173c32' }}>
                  Chính sách giá theo khung giờ
                </h3>
              </div>

              <div style={{ display: 'flex', gap: 8 }}>
                {isDirty && (
                  <button
                    type="button"
                    onClick={handleResetConfig}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '7px 12px',
                      borderRadius: 6,
                      border: '1px solid #cbd5e1',
                      background: '#ffffff',
                      color: '#475569',
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    <RotateCcw size={14} /> Khôi phục
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleSaveConfig}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '7px 16px',
                    borderRadius: 6,
                    border: 'none',
                    background: '#173c32',
                    color: '#def46a',
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  <Save size={14} /> Lưu thay đổi
                </button>
              </div>
            </div>

            {/* TAB THỨ 2-6 VS THỨ 7-CN */}
            <div style={{
              display: 'flex',
              gap: 8,
              marginBottom: 16,
              padding: '4px',
              background: '#f1f5f9',
              borderRadius: 8,
              width: 'fit-content'
            }}>
              <button
                type="button"
                onClick={() => setScheduleTab('WEEKDAY')}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '8px 16px',
                  borderRadius: 6,
                  border: 'none',
                  background: scheduleTab === 'WEEKDAY' ? '#ffffff' : 'transparent',
                  color: scheduleTab === 'WEEKDAY' ? '#166534' : '#64748b',
                  fontWeight: 700,
                  fontSize: 13.5,
                  cursor: 'pointer',
                  boxShadow: scheduleTab === 'WEEKDAY' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none'
                }}
              >
                <Sun size={15} color={scheduleTab === 'WEEKDAY' ? '#16a34a' : '#64748b'} />
                Thứ 2 – Thứ 6
              </button>

              <button
                type="button"
                onClick={() => setScheduleTab('WEEKEND')}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '8px 16px',
                  borderRadius: 6,
                  border: 'none',
                  background: scheduleTab === 'WEEKEND' ? '#ffffff' : 'transparent',
                  color: scheduleTab === 'WEEKEND' ? '#7c3aed' : '#64748b',
                  fontWeight: 700,
                  fontSize: 13.5,
                  cursor: 'pointer',
                  boxShadow: scheduleTab === 'WEEKEND' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none'
                }}
              >
                <Calendar size={15} color={scheduleTab === 'WEEKEND' ? '#7c3aed' : '#64748b'} />
                Thứ 7 & Chủ Nhật
              </button>
            </div>

            {/* THANH TIMELINE TRỰC QUAN */}
            <div style={{ marginBottom: 18, padding: '14px 16px', background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>
                  Khung giờ 06:00 – 23:00
                </span>
              </div>

              <div style={{ width: '100%', height: 34, borderRadius: 6, display: 'flex', overflow: 'hidden' }}>
                {activeSegments.map(seg => {
                  const [sH, sM] = seg.timeRange.split(' – ')[0].split(':').map(Number);
                  const [eH, eM] = seg.timeRange.split(' – ')[1].split(':').map(Number);
                  const durHours = (eH + (eM || 0) / 60) - (sH + (sM || 0) / 60);
                  const widthPct = Math.max(5, (durHours / 17) * 100);

                  let bg = '#94a3b8';
                  if (seg.type === 'DISCOUNT') bg = '#16a34a';
                  else if (seg.type === 'SURCHARGE') bg = '#ea580c';
                  else if (seg.type === 'WEEKEND_DAY') bg = '#8b5cf6';
                  else if (seg.type === 'WEEKEND_PRIME') bg = '#dc2626';

                  return (
                    <div
                      key={seg.id}
                      style={{
                        width: `${widthPct}%`,
                        background: bg,
                        color: '#ffffff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 6,
                        fontSize: 11.5,
                        fontWeight: 700,
                        borderRight: '1px solid #ffffff',
                        padding: '0 4px',
                        overflow: 'hidden',
                        whiteSpace: 'nowrap'
                      }}
                      title={`${seg.name}: ${seg.timeRange}`}
                    >
                      <span>{seg.timeRange}</span>
                      <span style={{ opacity: 0.9, fontSize: 11 }}>
                        {seg.percent > 0 ? `+${seg.percent}%` : seg.percent < 0 ? `${seg.percent}%` : 'Chuẩn'}
                      </span>
                    </div>
                  );
                })}
              </div>

              <div style={{ display: 'flex', gap: 14, marginTop: 8, fontSize: 11.5, color: '#64748b' }}>
                {scheduleTab === 'WEEKDAY' ? (
                  <>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#16a34a' }} />
                      Giờ vàng {config.weekday.goldenPercent}%
                    </span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#ea580c' }} />
                      Tối đèn LED +{config.weekday.ledPercent}%
                    </span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#94a3b8' }} />
                      Tiêu chuẩn
                    </span>
                  </>
                ) : (
                  <>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#8b5cf6' }} />
                      Ban ngày +{config.weekend.dayPercent}%
                    </span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#dc2626' }} />
                      Tối đèn LED +{config.weekend.primePercent}%
                    </span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#94a3b8' }} />
                      Đêm muộn +{config.weekend.latePercent}%
                    </span>
                  </>
                )}
              </div>
            </div>

            {/* CÁC THẺ ĐIỀU CHỈNH: GỌN GÀNG, HIỆU QUẢ */}
            {scheduleTab === 'WEEKDAY' ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14 }}>
                <div style={{ background: '#f8fafc', borderRadius: 8, padding: '14px', border: '1px solid #bbf7d0' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <strong style={{ fontSize: 14, color: '#166534', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Sun size={15} color="#16a34a" /> Giờ vàng
                    </strong>
                    <span style={{ fontSize: 11, fontWeight: 700, padding: '1px 6px', borderRadius: 4, background: '#dcfce7', color: '#166534' }}>
                      Giảm giá
                    </span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: 12.5, color: '#475569' }}>Khung giờ:</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <select
                          value={config.weekday.goldenStart}
                          onChange={e => handleWeekdayTimeChange('goldenStart', e.target.value)}
                          style={{ padding: '4px 6px', borderRadius: 4, border: '1px solid #cbd5e1', fontSize: 13, fontWeight: 600 }}
                        >
                          {TIME_STEPS.filter(t => t < config.weekday.goldenEnd).map(t => (
                            <option key={t} value={t}>{t}</option>
                          ))}
                        </select>
                        <span style={{ color: '#94a3b8' }}>–</span>
                        <select
                          value={config.weekday.goldenEnd}
                          onChange={e => handleWeekdayTimeChange('goldenEnd', e.target.value)}
                          style={{ padding: '4px 6px', borderRadius: 4, border: '1px solid #cbd5e1', fontSize: 13, fontWeight: 600 }}
                        >
                          {TIME_STEPS.filter(t => t > config.weekday.goldenStart && t <= '22:00').map(t => (
                            <option key={t} value={t}>{t}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: 12.5, color: '#475569' }}>Tỷ lệ:</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <input
                          type="number"
                          step="5"
                          min="-80"
                          max="0"
                          value={config.weekday.goldenPercent}
                          onChange={e => handleWeekdayPercentChange('goldenPercent', e.target.value)}
                          style={{ width: 70, padding: '4px 8px', borderRadius: 4, border: '1px solid #cbd5e1', fontSize: 13, fontWeight: 700, textAlign: 'right', color: '#16a34a' }}
                        />
                        <span style={{ fontSize: 13, color: '#64748b' }}>%</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div style={{ background: '#f8fafc', borderRadius: 8, padding: '14px', border: '1px solid #fed7aa' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <strong style={{ fontSize: 14, color: '#9a3412', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Zap size={15} color="#ea580c" /> Tối đèn LED
                    </strong>
                    <span style={{ fontSize: 11, fontWeight: 700, padding: '1px 6px', borderRadius: 4, background: '#ffedd5', color: '#9a3412' }}>
                      Phụ thu
                    </span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: 12.5, color: '#475569' }}>Khung giờ:</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <select
                          value={config.weekday.ledStart}
                          onChange={e => handleWeekdayTimeChange('ledStart', e.target.value)}
                          style={{ padding: '4px 6px', borderRadius: 4, border: '1px solid #cbd5e1', fontSize: 13, fontWeight: 600 }}
                        >
                          {TIME_STEPS.filter(t => t >= '12:00' && t < config.weekday.ledEnd).map(t => (
                            <option key={t} value={t}>{t}</option>
                          ))}
                        </select>
                        <span style={{ color: '#94a3b8' }}>–</span>
                        <select
                          value={config.weekday.ledEnd}
                          onChange={e => handleWeekdayTimeChange('ledEnd', e.target.value)}
                          style={{ padding: '4px 6px', borderRadius: 4, border: '1px solid #cbd5e1', fontSize: 13, fontWeight: 600 }}
                        >
                          {TIME_STEPS.filter(t => t > config.weekday.ledStart && t <= '23:00').map(t => (
                            <option key={t} value={t}>{t}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: 12.5, color: '#475569' }}>Tỷ lệ:</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <input
                          type="number"
                          step="5"
                          min="0"
                          max="150"
                          value={config.weekday.ledPercent}
                          onChange={e => handleWeekdayPercentChange('ledPercent', e.target.value)}
                          style={{ width: 70, padding: '4px 8px', borderRadius: 4, border: '1px solid #cbd5e1', fontSize: 13, fontWeight: 700, textAlign: 'right', color: '#ea580c' }}
                        />
                        <span style={{ fontSize: 13, color: '#64748b' }}>%</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14 }}>
                <div style={{ background: '#f8fafc', borderRadius: 8, padding: '14px', border: '1px solid #e9d5ff' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <strong style={{ fontSize: 14, color: '#6b21a8', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Calendar size={15} color="#7c3aed" /> Ban ngày
                    </strong>
                    <span style={{ fontSize: 11, fontWeight: 700, padding: '1px 6px', borderRadius: 4, background: '#f3e8ff', color: '#6b21a8' }}>
                      Phụ thu
                    </span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: 12.5, color: '#475569' }}>Khung giờ:</span>
                      <span style={{ fontSize: 13, fontWeight: 600, color: '#334155' }}>
                        06:00 – {config.weekend.ledStart}
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: 12.5, color: '#475569' }}>Tỷ lệ:</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <input
                          type="number"
                          step="5"
                          min="0"
                          max="150"
                          value={config.weekend.dayPercent}
                          onChange={e => handleWeekendPercentChange('dayPercent', e.target.value)}
                          style={{ width: 70, padding: '4px 8px', borderRadius: 4, border: '1px solid #cbd5e1', fontSize: 13, fontWeight: 700, textAlign: 'right', color: '#7c3aed' }}
                        />
                        <span style={{ fontSize: 13, color: '#64748b' }}>%</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div style={{ background: '#f8fafc', borderRadius: 8, padding: '14px', border: '1px solid #fca5a5' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <strong style={{ fontSize: 14, color: '#b91c1c', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Zap size={15} color="#dc2626" /> Tối đèn LED
                    </strong>
                    <span style={{ fontSize: 11, fontWeight: 700, padding: '1px 6px', borderRadius: 4, background: '#fee2e2', color: '#b91c1c' }}>
                      Phụ thu
                    </span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: 12.5, color: '#475569' }}>Khung giờ:</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <select
                          value={config.weekend.ledStart}
                          onChange={e => handleWeekendTimeChange('ledStart', e.target.value)}
                          style={{ padding: '4px 6px', borderRadius: 4, border: '1px solid #cbd5e1', fontSize: 13, fontWeight: 600 }}
                        >
                          {TIME_STEPS.filter(t => t >= '12:00' && t < config.weekend.ledEnd).map(t => (
                            <option key={t} value={t}>{t}</option>
                          ))}
                        </select>
                        <span style={{ color: '#94a3b8' }}>–</span>
                        <select
                          value={config.weekend.ledEnd}
                          onChange={e => handleWeekendTimeChange('ledEnd', e.target.value)}
                          style={{ padding: '4px 6px', borderRadius: 4, border: '1px solid #cbd5e1', fontSize: 13, fontWeight: 600 }}
                        >
                          {TIME_STEPS.filter(t => t > config.weekend.ledStart && t <= '23:00').map(t => (
                            <option key={t} value={t}>{t}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: 12.5, color: '#475569' }}>Tỷ lệ:</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <input
                          type="number"
                          step="5"
                          min="0"
                          max="200"
                          value={config.weekend.primePercent}
                          onChange={e => handleWeekendPercentChange('primePercent', e.target.value)}
                          style={{ width: 70, padding: '4px 8px', borderRadius: 4, border: '1px solid #cbd5e1', fontSize: 13, fontWeight: 700, textAlign: 'right', color: '#b91c1c' }}
                        />
                        <span style={{ fontSize: 13, color: '#64748b' }}>%</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div style={{ background: '#f8fafc', borderRadius: 8, padding: '14px', border: '1px solid #cbd5e1' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <strong style={{ fontSize: 14, color: '#334155', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Moon size={15} color="#475569" /> Đêm muộn
                    </strong>
                    <span style={{ fontSize: 11, fontWeight: 700, padding: '1px 6px', borderRadius: 4, background: '#e2e8f0', color: '#334155' }}>
                      Phụ thu
                    </span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: 12.5, color: '#475569' }}>Khung giờ:</span>
                      <span style={{ fontSize: 13, fontWeight: 600, color: '#334155' }}>
                        {config.weekend.ledEnd} – 23:00
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: 12.5, color: '#475569' }}>Tỷ lệ:</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <input
                          type="number"
                          step="5"
                          min="0"
                          max="100"
                          value={config.weekend.latePercent}
                          onChange={e => handleWeekendPercentChange('latePercent', e.target.value)}
                          style={{ width: 70, padding: '4px 8px', borderRadius: 4, border: '1px solid #cbd5e1', fontSize: 13, fontWeight: 700, textAlign: 'right', color: '#475569' }}
                        />
                        <span style={{ fontSize: 13, color: '#64748b' }}>%</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* PANEL 2: BẢNG GIÁ MÔ PHỎNG */}
          <div style={{
            background: '#ffffff',
            borderRadius: 12,
            padding: '20px',
            border: '1px solid #e2e8f0',
            boxShadow: '0 1px 4px rgba(0,0,0,0.03)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
              <h3 style={{ margin: 0, fontSize: 15, color: '#173c32', display: 'flex', alignItems: 'center', gap: 6 }}>
                <Percent size={16} color="#0284c7" />
                Bảng giá theo khung giờ
              </h3>

              <div style={{ fontSize: 12, color: '#64748b' }}>
                Giá gốc: Khu A {money(categoryRates.OUTDOOR)} · Khu B {money(categoryRates.INDOOR)} · Khu VIP {money(categoryRates.VIP)}
              </div>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                    <th style={{ padding: '10px 12px', color: '#475569', fontWeight: 600 }}>Khung giờ</th>
                    <th style={{ padding: '10px 12px', color: '#475569', fontWeight: 600, textAlign: 'center' }}>Tỷ lệ</th>
                    <th style={{ padding: '10px 12px', color: '#166534', fontWeight: 600 }}>Khu A - Ngoài trời</th>
                    <th style={{ padding: '10px 12px', color: '#0369a1', fontWeight: 600 }}>Khu B - Trong nhà</th>
                    <th style={{ padding: '10px 12px', color: '#a16207', fontWeight: 600 }}>Khu V - VIP</th>
                  </tr>
                </thead>
                <tbody>
                  <tr style={{ background: '#f0fdf4' }}>
                    <td colSpan={5} style={{ padding: '8px 12px', fontWeight: 700, color: '#166534', fontSize: 12.5 }}>
                      Thứ 2 – Thứ 6
                    </td>
                  </tr>
                  {weekdaySegments.map((seg, idx) => {
                    const priceA = calcRate(categoryRates.OUTDOOR, seg.percent);
                    const priceB = calcRate(categoryRates.INDOOR, seg.percent);
                    const priceV = calcRate(categoryRates.VIP, seg.percent);

                    return (
                      <tr
                        key={seg.id}
                        style={{
                          borderBottom: '1px solid #f1f5f9',
                          background: idx % 2 === 0 ? '#ffffff' : '#fafafa'
                        }}
                      >
                        <td style={{ padding: '10px 12px' }}>
                          <span style={{ fontWeight: 600, color: '#0f172a' }}>{seg.name}</span>
                          <span style={{ color: '#64748b', marginLeft: 8 }}>{seg.timeRange}</span>
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                          <span style={{
                            display: 'inline-block',
                            padding: '2px 8px',
                            borderRadius: 10,
                            fontSize: 11.5,
                            fontWeight: 700,
                            background: seg.badgeBg,
                            color: seg.badgeColor
                          }}>
                            {seg.percent > 0 ? `+${seg.percent}%` : seg.percent < 0 ? `${seg.percent}%` : '0%'}
                          </span>
                        </td>
                        <td style={{ padding: '10px 12px' }}>
                          <b style={{ color: '#166534' }}>{money(priceA)}/h</b>
                          <small style={{ color: '#94a3b8', marginLeft: 6 }}>{money(priceA / 2)}/slot</small>
                        </td>
                        <td style={{ padding: '10px 12px' }}>
                          <b style={{ color: '#0369a1' }}>{money(priceB)}/h</b>
                          <small style={{ color: '#94a3b8', marginLeft: 6 }}>{money(priceB / 2)}/slot</small>
                        </td>
                        <td style={{ padding: '10px 12px' }}>
                          <b style={{ color: '#a16207' }}>{money(priceV)}/h</b>
                          <small style={{ color: '#94a3b8', marginLeft: 6 }}>{money(priceV / 2)}/slot</small>
                        </td>
                      </tr>
                    );
                  })}

                  <tr style={{ background: '#faf5ff' }}>
                    <td colSpan={5} style={{ padding: '8px 12px', fontWeight: 700, color: '#6b21a8', fontSize: 12.5 }}>
                      Thứ 7 & Chủ Nhật
                    </td>
                  </tr>
                  {weekendSegments.map((seg, idx) => {
                    const priceA = calcRate(categoryRates.OUTDOOR, seg.percent);
                    const priceB = calcRate(categoryRates.INDOOR, seg.percent);
                    const priceV = calcRate(categoryRates.VIP, seg.percent);

                    return (
                      <tr
                        key={seg.id}
                        style={{
                          borderBottom: '1px solid #f1f5f9',
                          background: seg.type === 'WEEKEND_PRIME' ? '#fff5f5' : (idx % 2 === 0 ? '#ffffff' : '#fafafa')
                        }}
                      >
                        <td style={{ padding: '10px 12px' }}>
                          <span style={{ fontWeight: 600, color: seg.type === 'WEEKEND_PRIME' ? '#b91c1c' : '#6b21a8' }}>
                            {seg.name}
                          </span>
                          <span style={{ color: '#64748b', marginLeft: 8 }}>{seg.timeRange}</span>
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                          <span style={{
                            display: 'inline-block',
                            padding: '2px 8px',
                            borderRadius: 10,
                            fontSize: 11.5,
                            fontWeight: 700,
                            background: seg.badgeBg,
                            color: seg.badgeColor
                          }}>
                            +{seg.percent}%
                          </span>
                        </td>
                        <td style={{ padding: '10px 12px' }}>
                          <b style={{ color: '#166534' }}>{money(priceA)}/h</b>
                          <small style={{ color: '#94a3b8', marginLeft: 6 }}>{money(priceA / 2)}/slot</small>
                        </td>
                        <td style={{ padding: '10px 12px' }}>
                          <b style={{ color: '#0369a1' }}>{money(priceB)}/h</b>
                          <small style={{ color: '#94a3b8', marginLeft: 6 }}>{money(priceB / 2)}/slot</small>
                        </td>
                        <td style={{ padding: '10px 12px' }}>
                          <b style={{ color: '#a16207' }}>{money(priceV)}/h</b>
                          <small style={{ color: '#94a3b8', marginLeft: 6 }}>{money(priceV / 2)}/slot</small>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* MODAL CÀI ĐẶT GIÁ 3 PHÂN KHU */}
      {showCategoryModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.4)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: 20
        }}>
          <div style={{
            background: '#ffffff',
            borderRadius: 10,
            width: '100%',
            maxWidth: 460,
            boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
            border: '1px solid #cbd5e1'
          }}>
            <div style={{ padding: '14px 18px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: 15, color: '#173c32' }}>Cài đặt giá theo phân khu</h3>
              <button
                type="button"
                onClick={() => setShowCategoryModal(false)}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 16, color: '#64748b' }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveCategoryRates} style={{ padding: 18 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: '#f8fafc', borderRadius: 6, border: '1px solid #e2e8f0' }}>
                  <span style={{ fontSize: 13.5, fontWeight: 600, color: '#166534' }}>Khu A - Ngoài trời</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <input
                      type="number"
                      step="10000"
                      min="10000"
                      value={categoryInputs.OUTDOOR}
                      onChange={(e) => setCategoryInputs({ ...categoryInputs, OUTDOOR: e.target.value })}
                      style={{ width: 110, padding: '5px 8px', borderRadius: 4, border: '1px solid #cbd5e1', fontSize: 13, fontWeight: 700, textAlign: 'right' }}
                    />
                    <span style={{ fontSize: 12.5, color: '#64748b' }}>đ/h</span>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: '#f8fafc', borderRadius: 6, border: '1px solid #e2e8f0' }}>
                  <span style={{ fontSize: 13.5, fontWeight: 600, color: '#0369a1' }}>Khu B - Trong nhà</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <input
                      type="number"
                      step="10000"
                      min="10000"
                      value={categoryInputs.INDOOR}
                      onChange={(e) => setCategoryInputs({ ...categoryInputs, INDOOR: e.target.value })}
                      style={{ width: 110, padding: '5px 8px', borderRadius: 4, border: '1px solid #cbd5e1', fontSize: 13, fontWeight: 700, textAlign: 'right' }}
                    />
                    <span style={{ fontSize: 12.5, color: '#64748b' }}>đ/h</span>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: '#f8fafc', borderRadius: 6, border: '1px solid #e2e8f0' }}>
                  <span style={{ fontSize: 13.5, fontWeight: 600, color: '#a16207' }}>Khu V - VIP</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <input
                      type="number"
                      step="10000"
                      min="10000"
                      value={categoryInputs.VIP}
                      onChange={(e) => setCategoryInputs({ ...categoryInputs, VIP: e.target.value })}
                      style={{ width: 110, padding: '5px 8px', borderRadius: 4, border: '1px solid #cbd5e1', fontSize: 13, fontWeight: 700, textAlign: 'right' }}
                    />
                    <span style={{ fontSize: 12.5, color: '#64748b' }}>đ/h</span>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
                <Button type="button" className="secondary sm" onClick={() => setShowCategoryModal(false)}>
                  Hủy
                </Button>
                <Button type="submit" className="primary sm" disabled={isSavingRates}>
                  {isSavingRates ? 'Đang lưu…' : 'Lưu giá'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
