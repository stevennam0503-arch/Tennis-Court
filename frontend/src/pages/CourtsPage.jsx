import React, { useState, useMemo } from 'react';
import { Plus, Trash2, SlidersHorizontal, Clock, RotateCcw, Save, Sun, Calendar, Scissors, Eye, EyeOff, AlertCircle } from 'lucide-react';
import { CourtPhoto, courtDescription } from '../components/CourtGallery';
import { useCourtly } from '../context';
import { Title, Chip, Button, Tabs } from '../components/UI';
import { labels, money, today } from '../utils/format';

const HALF_HOURS = [
  '06:00', '06:30', '07:00', '07:30', '08:00', '08:30', '09:00', '09:30',
  '10:00', '10:30', '11:00', '11:30', '12:00', '12:30', '13:00', '13:30',
  '14:00', '14:30', '15:00', '15:30', '16:00', '16:30', '17:00', '17:30',
  '18:00', '18:30', '19:00', '19:30', '20:00', '20:30', '21:00', '21:30',
  '22:00', '22:30', '23:00'
];

const stamp = (n) => `${String(Math.floor(n)).padStart(2, '0')}:${String(Math.round((n % 1) * 60)).padStart(2, '0')}`;
const parseHour = (t) => {
  if (typeof t === 'number') return t;
  const [h, m] = String(t || '06:00').split(':').map(Number);
  return h + (m || 0) / 60;
};

const ZONES = [
  { key: 'OUTDOOR', name: 'Khu A - Ngoài trời', badge: 'OUTDOOR', color: '#166534', defaultPrice: 160000 },
  { key: 'INDOOR', name: 'Khu B - Mái che trong nhà', badge: 'INDOOR', color: '#0369a1', defaultPrice: 240000 },
  { key: 'VIP', name: 'Khu VIP Clubhouse', badge: 'VIP', color: '#a16207', defaultPrice: 400000 },
];

export default function CourtsPage() {
  const { data, show, navigate, mutate, notify } = useCourtly();
  const [deletingId, setDeletingId] = useState(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [tab, setTab] = useState('courts');
  const [courtTypeFilter, setCourtTypeFilter] = useState('ALL');

  // Quản lý Bảng giá theo khu
  const [selectedZone, setSelectedZone] = useState('OUTDOOR');
  const todayStr = today();
  const maxDate = useMemo(() => {
    const [y, m, d] = todayStr.split('-').map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d + 90));
    return dt.toISOString().slice(0, 10);
  }, [todayStr]);
  const [effectiveDate, setEffectiveDate] = useState(() => todayStr);
  const [customTariffs, setCustomTariffs] = useState({});
  const [showPreview, setShowPreview] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const edit = (collection, row) => show({ type: 'entity', collection, row });

  const activeCourts = useMemo(() => {
    return (data.courts || []).filter(c => c.status !== 'DELETED');
  }, [data.courts]);

  const archivedCourts = data.archivedCourts || [];

  const reopenCourt = async (court) => {
    if (deletingId) return;
    setDeletingId(court.id);
    try {
      await mutate(`/catalog/courts/${court.id}`, {
        name: court.name, type: court.type, status: 'ACTIVE', price: court.price,
        description: court.description, address: court.address, amenities: court.amenities,
        imageUrl: court.imageUrl, imageIsIllustration: court.imageIsIllustration
      }, 'PUT');
      notify(`Đã mở lại ${court.name}; sân hiện lại ở trang đặt sân với bảng giá cũ.`);
      setCourtTypeFilter('ALL');
    } catch (e) {
      notify(e.message || 'Không mở lại được sân.');
    } finally {
      setDeletingId(null);
    }
  };

  const executeDeleteCourt = async (court) => {
    if (deletingId) return;
    const activeOrders = (data.orders || []).filter(o =>
      ['HOLDING', 'CONFIRMED', 'CHECKED_IN'].includes(o.status) &&
      o.slots?.some(s => s.court === court.id)
    );
    if (activeOrders.length > 0) {
      notify(`⚠️ Không thể ngừng khai thác "${court.name}" vì hiện có ${activeOrders.length} đơn đặt sân đang chơi hoặc sắp tới (ví dụ #${activeOrders[0].id.slice(0, 8).toUpperCase()} · ${activeOrders[0].name}). Vui lòng hoàn tất hoặc đổi sân cho các đơn này trước!`);
      setConfirmDeleteId(null);
      return;
    }
    setDeletingId(court.id);
    try {
      const result = await mutate(`/catalog/courts/${court.id}`, {}, 'DELETE');
      notify(result.mode === 'ARCHIVED'
        ? `Đã ngừng khai thác ${court.name}. Lịch sử giữ nguyên; xem hoặc mở lại ở mục "Đã ngừng khai thác".`
        : `Đã xóa hẳn ${court.name} (sân chưa từng có đơn).`);
      setConfirmDeleteId(null);
    } catch (e) {
      notify(e.message || 'Lỗi khi xóa sân.');
    } finally {
      setDeletingId(null);
    }
  };

  const courtCounts = useMemo(() => {
    const c = { all: activeCourts.length, VIP: 0, INDOOR: 0, OUTDOOR: 0 };
    for (const court of activeCourts) {
      if (c[court.type] !== undefined) c[court.type]++;
      else c.OUTDOOR++;
    }
    return c;
  }, [activeCourts]);

  const filteredCourts = useMemo(() => {
    if (courtTypeFilter === 'ARCHIVED') return archivedCourts;
    return activeCourts.filter(c => {
      if (courtTypeFilter !== 'ALL' && c.type !== courtTypeFilter) return false;
      return true;
    });
  }, [activeCourts, archivedCourts, courtTypeFilter]);

  // Trích xuất bảng giá từ server cho khu đang chọn
  const zoneCourts = useMemo(() => {
    return activeCourts.filter(c => c.type === selectedZone);
  }, [activeCourts, selectedZone]);

  const serverTariff = useMemo(() => {
    const repCourt = zoneCourts[0];
    const defaultPrice = ZONES.find(z => z.key === selectedZone)?.defaultPrice || 160000;
    if (!repCourt) {
      return {
        weekday: [{ start: '06:00', end: '23:00', pricePerHour: defaultPrice }],
        weekend: [{ start: '06:00', end: '23:00', pricePerHour: defaultPrice }]
      };
    }
    const prices = (data.prices || []).filter(p => p.court === repCourt.id);
    const toRow = p => ({
      start: stamp(p.start),
      end: stamp(p.end),
      pricePerHour: Number(p.price)
    });
    const weekday = prices.filter(p => p.dayType === 'WEEKDAY').sort((a, b) => a.start - b.start).map(toRow);
    const weekend = prices.filter(p => p.dayType === 'WEEKEND').sort((a, b) => a.start - b.start).map(toRow);

    return {
      weekday: weekday.length ? weekday : [{ start: '06:00', end: '23:00', pricePerHour: repCourt.price || defaultPrice }],
      weekend: weekend.length ? weekend : [{ start: '06:00', end: '23:00', pricePerHour: repCourt.price || defaultPrice }]
    };
  }, [zoneCourts, data.prices, selectedZone]);

  const currentTariff = customTariffs[selectedZone] || serverTariff;
  const isDirty = Boolean(customTariffs[selectedZone]);

  const updateZoneRows = (dayType, newRows) => {
    setCustomTariffs(prev => ({
      ...prev,
      [selectedZone]: {
        ...(prev[selectedZone] || serverTariff),
        [dayType]: newRows
      }
    }));
  };

  const handlePriceChange = (dayType, index, val) => {
    const list = [...currentTariff[dayType]];
    list[index] = { ...list[index], pricePerHour: Math.max(0, Number(val) || 0) };
    updateZoneRows(dayType, list);
  };

  const handleSplitRow = (dayType, index) => {
    const list = [...currentTariff[dayType]];
    const row = list[index];
    const s = parseHour(row.start);
    const e = parseHour(row.end);
    if (e - s <= 0.5) {
      notify('Khung giờ tối thiểu là 30 phút, không thể chia nhỏ hơn.');
      return;
    }
    const mid = Math.round(((s + e) / 2) * 2) / 2;
    const midStr = stamp(mid);
    list.splice(index, 1,
      { start: row.start, end: midStr, pricePerHour: row.pricePerHour },
      { start: midStr, end: row.end, pricePerHour: row.pricePerHour }
    );
    updateZoneRows(dayType, list);
  };

  const handleDeleteRow = (dayType, index) => {
    const list = [...currentTariff[dayType]];
    if (list.length <= 1) {
      notify('Bảng giá phải có ít nhất một khung giờ phủ kín từ 06:00 đến 23:00.');
      return;
    }
    if (index === 0) {
      list[1] = { ...list[1], start: '06:00' };
    } else {
      list[index - 1] = { ...list[index - 1], end: list[index].end };
    }
    list.splice(index, 1);
    updateZoneRows(dayType, list);
  };

  const handleEndTimeChange = (dayType, index, newEnd) => {
    const list = [...currentTariff[dayType]];
    if (index >= list.length - 1) return;
    list[index] = { ...list[index], end: newEnd };
    list[index + 1] = { ...list[index + 1], start: newEnd };
    updateZoneRows(dayType, list);
  };

  const handleResetZone = () => {
    setCustomTariffs(prev => {
      const next = { ...prev };
      delete next[selectedZone];
      return next;
    });
    setShowPreview(false);
    notify('Đã khôi phục bảng giá hiện tại của khu.');
  };

  const handleSaveTariff = async () => {
    if (isSaving) return;
    setIsSaving(true);
    try {
      const payload = {
        effectiveFrom: effectiveDate,
        rows: [
          ...currentTariff.weekday.map(r => ({
            dayType: 'WEEKDAY',
            start: r.start,
            end: r.end,
            pricePerHour: Number(r.pricePerHour)
          })),
          ...currentTariff.weekend.map(r => ({
            dayType: 'WEEKEND',
            start: r.start,
            end: r.end,
            pricePerHour: Number(r.pricePerHour)
          }))
        ]
      };
      const res = await mutate(`/catalog/zones/${selectedZone}/tariff`, payload, 'PUT');
      notify(`Đã cập nhật bảng giá khu ${selectedZone}; đã cập nhật ${res?.updatedSlots ?? 0} slot còn trống từ ngày ${effectiveDate}.`);
      setCustomTariffs(prev => {
        const next = { ...prev };
        delete next[selectedZone];
        return next;
      });
      setShowPreview(false);
    } catch (err) {
      notify(err.message || 'Lỗi khi cập nhật bảng giá.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      <Title
        subtitle="Quản lý sân, trạng thái và bảng giá thống nhất theo khu."
        action={
          <div style={{ display: 'flex', gap: 10 }}>
            <Button
              className="secondary"
              onClick={() => setTab('policy')}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
            >
              <SlidersHorizontal size={15} /> Bảng giá theo khu
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
          ['policy', 'Bảng giá theo khu'],
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
              ['ARCHIVED', `Đã ngừng khai thác (${archivedCourts.length})`],
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

          {courtTypeFilter === 'ARCHIVED' ? (
            <p className="notice" style={{ marginBottom: 14 }}>
              Sân đã ngừng không hiện ở trang đặt sân, bảng giá và lịch; đơn và hóa đơn cũ vẫn giữ nguyên tên sân.
              Bấm "Mở lại" để bán sân trở lại với bảng giá cũ. {archivedCourts.length === 0 && 'Hiện chưa có sân nào ngừng khai thác.'}
            </p>
          ) : (
            <p className="notice" style={{ marginBottom: 14 }}>
              "Ngừng khai thác" ẩn sân khỏi trang đặt sân nhưng giữ lịch sử và có thể mở lại; sân chưa từng có đơn sẽ được xóa hẳn.
              Sân còn đơn sắp tới phải đổi lịch hoặc hủy các đơn đó trước. Muốn đóng tạm thời, dùng "Chỉnh sửa" → trạng thái Bảo trì.
            </p>
          )}

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
                    {c.status === 'DELETED' ? <span className="badge">Đã ngừng khai thác</span> : <Chip status={c.status} />}
                  </div>

                  <p style={{ margin: '8px 0 12px', fontSize: 13, color: 'var(--muted)', minHeight: 38 }}>
                    {courtDescription(c)}
                  </p>

                  <div style={{ padding: '8px 12px', background: 'var(--bg-panel)', borderRadius: 6, marginBottom: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 12, color: 'var(--muted)' }}>Giá dự phòng:</span>
                      <strong style={{ fontSize: 15, color: 'var(--green)' }}>
                        {money(c.price || 160000)}/h
                      </strong>
                    </div>
                  </div>

                  {c.status === 'DELETED' ? (
                  <div style={{ display: 'flex', gap: 8, marginTop: 'auto' }}>
                    <Button
                      className="sm"
                      style={{ flex: 1 }}
                      disabled={deletingId === c.id}
                      onClick={() => reopenCourt(c)}
                    >
                      <RotateCcw size={13} /> {deletingId === c.id ? 'Đang mở lại…' : 'Mở lại sân'}
                    </Button>
                  </div>
                  ) : (
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
                          {deletingId === c.id ? 'Đang xử lý…' : 'Xác nhận ngừng'}
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
                        title="Ẩn sân khỏi trang đặt sân, giữ lịch sử; sân chưa từng có đơn sẽ bị xóa hẳn"
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
                        <span>Ngừng khai thác</span>
                      </button>
                    )}
                  </div>
                  )}
                </div>
              </article>
            ))}
          </div>
        </>
      )}

      {/* TAB BẢNG GIÁ THEO KHU: NGUỒN GIÁ DUY NHẤT */}
      {tab === 'policy' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* 1. KHU SELECTOR */}
          <div style={{
            background: '#ffffff',
            borderRadius: 12,
            padding: '18px 20px',
            border: '1px solid #e2e8f0',
            boxShadow: '0 1px 4px rgba(0,0,0,0.03)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 16, color: '#173c32', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Clock size={18} color="#16a34a" />
                  Bảng giá theo phân khu sân
                </h3>
                <p style={{ margin: '4px 0 0', fontSize: 13, color: '#64748b' }}>
                  Giá được cấu hình thống nhất theo khu; áp dụng ngay cho trang Bảng giá khách, sơ đồ sân, form đặt sân và toàn bộ slot trống.
                </p>
              </div>

              {/* ACTION BAR: HIỆU LỰC TỪ NGÀY & LƯU */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#f8fafc', padding: '5px 10px', borderRadius: 6, border: '1px solid #cbd5e1' }}>
                  <span style={{ fontSize: 12.5, fontWeight: 600, color: '#475569' }}>Áp dụng từ:</span>
                  <input
                    type="date"
                    min={todayStr}
                    max={maxDate}
                    value={effectiveDate}
                    onChange={(e) => setEffectiveDate(e.target.value)}
                    style={{ border: 'none', background: 'transparent', fontSize: 13, fontWeight: 700, color: '#0f172a', outline: 'none' }}
                  />
                </div>

                <Button
                  className="secondary"
                  onClick={() => setShowPreview(!showPreview)}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                >
                  {showPreview ? <EyeOff size={15} /> : <Eye size={15} />}
                  {showPreview ? 'Ẩn so sánh' : 'Xem trước'}
                </Button>

                {isDirty && (
                  <Button
                    className="secondary"
                    onClick={handleResetZone}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                  >
                    <RotateCcw size={15} /> Khôi phục
                  </Button>
                )}

                <Button
                  className="primary"
                  onClick={handleSaveTariff}
                  disabled={isSaving}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                >
                  <Save size={15} /> {isSaving ? 'Đang lưu…' : 'Lưu bảng giá'}
                </Button>
              </div>
            </div>

            {/* TAB CHỌN KHU A / B / VIP */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
              {ZONES.map(z => {
                const isSelected = selectedZone === z.key;
                const courtsInThisZone = activeCourts.filter(c => c.type === z.key);
                const isZoneDirty = Boolean(customTariffs[z.key]);
                return (
                  <button
                    key={z.key}
                    type="button"
                    onClick={() => setSelectedZone(z.key)}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'flex-start',
                      padding: '12px 16px',
                      borderRadius: 8,
                      border: isSelected ? `2px solid ${z.color}` : '1px solid #cbd5e1',
                      background: isSelected ? '#f8fafc' : '#ffffff',
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'all 0.15s ease',
                      boxShadow: isSelected ? '0 2px 8px rgba(0,0,0,0.06)' : 'none'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
                      <strong style={{ fontSize: 14, color: isSelected ? z.color : '#1e293b' }}>
                        {z.name}
                      </strong>
                      {isZoneDirty && (
                        <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 4, background: '#fef3c7', color: '#b45309' }}>
                          Chưa lưu
                        </span>
                      )}
                    </div>
                    <span style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>
                      {courtsInThisZone.length} sân hoạt động ({courtsInThisZone.map(c => c.name).join(', ') || 'Chưa có'})
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2. BẢNG XEM TRƯỚC (NẾU BẬT) */}
          {showPreview && (
            <div style={{
              background: '#f0fdf4',
              borderRadius: 12,
              padding: '18px 20px',
              border: '1px solid #86efac',
              boxShadow: '0 2px 8px rgba(22, 163, 74, 0.08)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <Eye size={18} color="#16a34a" />
                <h4 style={{ margin: 0, fontSize: 15, color: '#166534' }}>
                  So sánh bảng giá: Hiện tại → Dự kiến áp dụng từ {effectiveDate}
                </h4>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>
                <div>
                  <strong style={{ fontSize: 13, color: '#166534', display: 'block', marginBottom: 6 }}>
                    Thứ 2 – Thứ 6 (Ngày thường)
                  </strong>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5, background: '#ffffff', borderRadius: 6, overflow: 'hidden' }}>
                    <thead>
                      <tr style={{ background: '#dcfce7', color: '#166534' }}>
                        <th style={{ padding: '6px 10px', textAlign: 'left' }}>Khung giờ</th>
                        <th style={{ padding: '6px 10px', textAlign: 'right' }}>Giá mới / giờ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {currentTariff.weekday.map((r, i) => (
                        <tr key={i} style={{ borderBottom: '1px solid #e2e8f0' }}>
                          <td style={{ padding: '6px 10px', fontWeight: 600 }}>{r.start} – {r.end}</td>
                          <td style={{ padding: '6px 10px', textAlign: 'right', fontWeight: 700, color: '#166534' }}>
                            {money(r.pricePerHour)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div>
                  <strong style={{ fontSize: 13, color: '#7c3aed', display: 'block', marginBottom: 6 }}>
                    Thứ 7 & Chủ Nhật (Cuối tuần)
                  </strong>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5, background: '#ffffff', borderRadius: 6, overflow: 'hidden' }}>
                    <thead>
                      <tr style={{ background: '#f3e8ff', color: '#6b21a8' }}>
                        <th style={{ padding: '6px 10px', textAlign: 'left' }}>Khung giờ</th>
                        <th style={{ padding: '6px 10px', textAlign: 'right' }}>Giá mới / giờ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {currentTariff.weekend.map((r, i) => (
                        <tr key={i} style={{ borderBottom: '1px solid #e2e8f0' }}>
                          <td style={{ padding: '6px 10px', fontWeight: 600 }}>{r.start} – {r.end}</td>
                          <td style={{ padding: '6px 10px', textAlign: 'right', fontWeight: 700, color: '#6b21a8' }}>
                            {money(r.pricePerHour)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* 3. LƯỚI 2 CỘT CHỈNH SỬA TRỰC TIẾP */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 20 }}>
            {/* CỘT 1: THỨ 2 - THỨ 6 */}
            <div style={{
              background: '#ffffff',
              borderRadius: 12,
              padding: '20px',
              border: '1px solid #e2e8f0',
              boxShadow: '0 1px 4px rgba(0,0,0,0.03)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Sun size={17} color="#16a34a" />
                  <h4 style={{ margin: 0, fontSize: 15, color: '#166534' }}>
                    Thứ 2 – Thứ 6 (Ngày thường)
                  </h4>
                </div>
                <span style={{ fontSize: 12, color: '#64748b' }}>
                  {currentTariff.weekday.length} khung giờ
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {currentTariff.weekday.map((row, idx) => {
                  const isLast = idx === currentTariff.weekday.length - 1;
                  const validEndOptions = isLast ? [] : HALF_HOURS.filter(h => h > row.start && h < currentTariff.weekday[idx + 1].end);

                  return (
                    <div
                      key={idx}
                      style={{
                        padding: '12px 14px',
                        background: '#f8fafc',
                        borderRadius: 8,
                        border: '1px solid #e2e8f0',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 10
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                        {/* KHUNG GIỜ */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ fontWeight: 700, fontSize: 13.5, color: '#0f172a' }}>
                            {row.start}
                          </span>
                          <span style={{ color: '#94a3b8' }}>–</span>
                          {isLast ? (
                            <span style={{ fontWeight: 700, fontSize: 13.5, color: '#0f172a' }}>
                              23:00
                            </span>
                          ) : (
                            <select
                              value={row.end}
                              onChange={(e) => handleEndTimeChange('weekday', idx, e.target.value)}
                              style={{
                                padding: '3px 6px',
                                borderRadius: 4,
                                border: '1px solid #cbd5e1',
                                fontSize: 13,
                                fontWeight: 700,
                                color: '#0f172a',
                                background: '#ffffff'
                              }}
                            >
                              {validEndOptions.map(h => (
                                <option key={h} value={h}>{h}</option>
                              ))}
                            </select>
                          )}
                        </div>

                        {/* NÚT THAO TÁC: TÁCH KHUNG / XÓA */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <button
                            type="button"
                            onClick={() => handleSplitRow('weekday', idx)}
                            title="Tách đôi khung giờ này để đặt giá riêng"
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4,
                              padding: '4px 8px',
                              borderRadius: 4,
                              border: '1px solid #cbd5e1',
                              background: '#ffffff',
                              fontSize: 11.5,
                              color: '#334155',
                              cursor: 'pointer',
                              fontWeight: 600
                            }}
                          >
                            <Scissors size={12} /> Tách
                          </button>

                          {currentTariff.weekday.length > 1 && (
                            <button
                              type="button"
                              onClick={() => handleDeleteRow('weekday', idx)}
                              title="Gộp khung giờ này vào khung liền kề"
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 4,
                                padding: '4px 8px',
                                borderRadius: 4,
                                border: '1px solid #fecaca',
                                background: '#fff5f5',
                                fontSize: 11.5,
                                color: '#dc2626',
                                cursor: 'pointer',
                                fontWeight: 600
                              }}
                            >
                              <Trash2 size={12} /> Gộp
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Ô NHẬP ĐƠN GIÁ / GIỜ */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 6, borderTop: '1px dashed #e2e8f0' }}>
                        <span style={{ fontSize: 12.5, color: '#475569' }}>Đơn giá / giờ:</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <input
                            type="number"
                            step="10000"
                            min="1000"
                            value={row.pricePerHour}
                            onChange={(e) => handlePriceChange('weekday', idx, e.target.value)}
                            style={{
                              width: 120,
                              padding: '5px 8px',
                              borderRadius: 6,
                              border: '1px solid #cbd5e1',
                              fontSize: 13.5,
                              fontWeight: 700,
                              textAlign: 'right',
                              color: '#166534'
                            }}
                          />
                          <span style={{ fontSize: 12.5, color: '#64748b' }}>đ/h</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* CỘT 2: THỨ 7 & CHỦ NHẬT */}
            <div style={{
              background: '#ffffff',
              borderRadius: 12,
              padding: '20px',
              border: '1px solid #e2e8f0',
              boxShadow: '0 1px 4px rgba(0,0,0,0.03)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Calendar size={17} color="#7c3aed" />
                  <h4 style={{ margin: 0, fontSize: 15, color: '#6b21a8' }}>
                    Thứ 7 & Chủ Nhật (Cuối tuần)
                  </h4>
                </div>
                <span style={{ fontSize: 12, color: '#64748b' }}>
                  {currentTariff.weekend.length} khung giờ
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {currentTariff.weekend.map((row, idx) => {
                  const isLast = idx === currentTariff.weekend.length - 1;
                  const validEndOptions = isLast ? [] : HALF_HOURS.filter(h => h > row.start && h < currentTariff.weekend[idx + 1].end);

                  return (
                    <div
                      key={idx}
                      style={{
                        padding: '12px 14px',
                        background: '#f8fafc',
                        borderRadius: 8,
                        border: '1px solid #e2e8f0',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 10
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                        {/* KHUNG GIỜ */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ fontWeight: 700, fontSize: 13.5, color: '#0f172a' }}>
                            {row.start}
                          </span>
                          <span style={{ color: '#94a3b8' }}>–</span>
                          {isLast ? (
                            <span style={{ fontWeight: 700, fontSize: 13.5, color: '#0f172a' }}>
                              23:00
                            </span>
                          ) : (
                            <select
                              value={row.end}
                              onChange={(e) => handleEndTimeChange('weekend', idx, e.target.value)}
                              style={{
                                padding: '3px 6px',
                                borderRadius: 4,
                                border: '1px solid #cbd5e1',
                                fontSize: 13,
                                fontWeight: 700,
                                color: '#0f172a',
                                background: '#ffffff'
                              }}
                            >
                              {validEndOptions.map(h => (
                                <option key={h} value={h}>{h}</option>
                              ))}
                            </select>
                          )}
                        </div>

                        {/* NÚT THAO TÁC: TÁCH KHUNG / XÓA */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <button
                            type="button"
                            onClick={() => handleSplitRow('weekend', idx)}
                            title="Tách đôi khung giờ này để đặt giá riêng"
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4,
                              padding: '4px 8px',
                              borderRadius: 4,
                              border: '1px solid #cbd5e1',
                              background: '#ffffff',
                              fontSize: 11.5,
                              color: '#334155',
                              cursor: 'pointer',
                              fontWeight: 600
                            }}
                          >
                            <Scissors size={12} /> Tách
                          </button>

                          {currentTariff.weekend.length > 1 && (
                            <button
                              type="button"
                              onClick={() => handleDeleteRow('weekend', idx)}
                              title="Gộp khung giờ này vào khung liền kề"
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 4,
                                padding: '4px 8px',
                                borderRadius: 4,
                                border: '1px solid #fecaca',
                                background: '#fff5f5',
                                fontSize: 11.5,
                                color: '#dc2626',
                                cursor: 'pointer',
                                fontWeight: 600
                              }}
                            >
                              <Trash2 size={12} /> Gộp
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Ô NHẬP ĐƠN GIÁ / GIỜ */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 6, borderTop: '1px dashed #e2e8f0' }}>
                        <span style={{ fontSize: 12.5, color: '#475569' }}>Đơn giá / giờ:</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <input
                            type="number"
                            step="10000"
                            min="1000"
                            value={row.pricePerHour}
                            onChange={(e) => handlePriceChange('weekend', idx, e.target.value)}
                            style={{
                              width: 120,
                              padding: '5px 8px',
                              borderRadius: 6,
                              border: '1px solid #cbd5e1',
                              fontSize: 13.5,
                              fontWeight: 700,
                              textAlign: 'right',
                              color: '#7c3aed'
                            }}
                          />
                          <span style={{ fontSize: 12.5, color: '#64748b' }}>đ/h</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div style={{ padding: '12px 16px', background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12.5, color: '#64748b' }}>
            💡 <b>Quy tắc hệ thống:</b> Khi lưu bảng giá khu, toàn bộ sân đang hoạt động trong khu sẽ được cập nhật đồng bộ. Các slot còn trống (AVAILABLE) từ ngày áp dụng trở đi sẽ tự động nhận giá mới. Các đơn đã đặt trước đó luôn giữ nguyên đơn giá lịch sử.
          </div>
        </div>
      )}
    </>
  );
}
