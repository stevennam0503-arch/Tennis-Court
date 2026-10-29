import React, { useState, useMemo } from 'react';
import { Plus, Filter, Grid2X2, Trash2 } from 'lucide-react';
import { CourtPhoto, courtDescription } from '../components/CourtGallery';
import { useCourtly } from '../context';
import { Title, Panel, Table, Chip, Button, Tabs } from '../components/UI';
import { labels, money } from '../utils/format';

export default function CourtsPage() {
  const { data, show, navigate, mutate, notify } = useCourtly();
  const [deletingId, setDeletingId] = useState(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [tab, setTab] = useState('courts');
  const [courtTypeFilter, setCourtTypeFilter] = useState('ALL');
  const [priceCourtFilter, setPriceCourtFilter] = useState('ALL');
  const [priceDayFilter, setPriceDayFilter] = useState('ALL');

  const edit = (collection, row) => show({ type: 'entity', collection, row });

  const executeDeleteCourt = async (court) => {
    if (deletingId) return;
    setDeletingId(court.id);
    try {
      await mutate(`/catalog/courts/${court.id}`, {}, 'DELETE');
      notify(`Đã xóa thành công sân "${court.name}" khỏi hệ thống.`);
      setConfirmDeleteId(null);
    } catch (e) {
      notify(e.message || 'Không thể xóa sân. Vui lòng thử lại.');
    } finally {
      setDeletingId(null);
    }
  };

  const activeCourts = useMemo(() => {
    return (data.courts || []).filter(c => c.status !== 'DELETED');
  }, [data.courts]);

  // Court counts by the 3 valid types
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

  // Filtered price rules
  const filteredPrices = useMemo(() => {
    return data.prices.filter(p => {
      if (priceCourtFilter !== 'ALL' && p.court !== priceCourtFilter) return false;
      if (priceDayFilter !== 'ALL' && p.dayType !== priceDayFilter) return false;
      return true;
    });
  }, [data.prices, priceCourtFilter, priceDayFilter]);

  return (
    <>
      <Title
        subtitle="3 loại sân tiêu chuẩn (VIP, Trong nhà, Ngoài trời), trạng thái và bảng giá theo giờ."
        action={
          <Button className="primary" onClick={() => edit('courts')}>
            <Plus size={16} style={{ marginRight: 4 }} /> Thêm sân mới
          </Button>
        }
      >
        Sân & bảng giá
      </Title>

      <Tabs
        options={[
          ['courts', `Danh sách sân (${activeCourts.length})`],
          ['prices', `Khung giá giờ (${data.prices.length})`],
        ]}
        value={tab}
        onChange={setTab}
      />

      {tab === 'courts' && (
        <>
          {/* 3 Core Court Types Tabs */}
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
                <CourtPhoto court={c} />
                <div className="card-body">
                  <div className="card-top">
                    <h2>{c.name}</h2>{c.zoneNeedsReview&&<p className="notice">Cần xác nhận khu sân sau nâng cấp dữ liệu.</p>}
                    <Chip status={c.status} />
                  </div>
                  <div className="metric">
                    <span className="muted">Phân loại sân</span>
                    <b style={{ color: c.type === 'VIP' ? '#b45309' : c.type === 'INDOOR' ? '#1d4ed8' : '#15803d' }}>
                      {labels[c.type] || c.type}
                    </b>
                  </div>
                  <div className="metric">
                    <span className="muted">Giá cơ bản / giờ</span>
                    <b>{money(c.price)}</b>
                  </div>
                  <p className="subtitle">{courtDescription(c)}</p>
                  <p className="subtitle" style={{ fontSize: 12, color: '#64748b' }}>
                    {c.address || 'Dùng địa chỉ CLB'}
                  </p>
                  <div className="card-buttons">
                    <Button className="sm" onClick={() => edit('courts', c)}>
                      Sửa thông tin
                    </Button>
                    <Button className="sm" onClick={() => navigate('calendar')}>
                      Xem lịch
                    </Button>
                    {confirmDeleteId === c.id ? (
                      <div style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}>
                        <button
                          type="button"
                          className="btn sm"
                          disabled={deletingId === c.id}
                          onClick={() => executeDeleteCourt(c)}
                          style={{
                            background: '#e11d48',
                            color: '#ffffff',
                            border: '1px solid #be123c',
                            cursor: 'pointer',
                            padding: '5px 9px',
                            borderRadius: 6,
                            fontSize: 11.5,
                            fontWeight: 700
                          }}
                        >
                          {deletingId === c.id ? 'Đang xóa…' : 'Xác nhận xóa'}
                        </button>
                        <button
                          type="button"
                          className="btn sm"
                          onClick={() => setConfirmDeleteId(null)}
                          style={{
                            background: '#f1f5f9',
                            color: '#475569',
                            border: '1px solid #cbd5e1',
                            cursor: 'pointer',
                            padding: '5px 8px',
                            borderRadius: 6,
                            fontSize: 11.5
                          }}
                        >
                          Hủy
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        className="btn sm"
                        onClick={() => setConfirmDeleteId(c.id)}
                        style={{
                          background: '#fff1f2',
                          color: '#e11d48',
                          border: '1px solid #fecdd3',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                          cursor: 'pointer',
                          padding: '5px 10px',
                          borderRadius: 6,
                          fontSize: 12,
                          fontWeight: 600
                        }}
                        title={`Xóa ${c.name}`}
                      >
                        <Trash2 size={13} />
                        <span>Xóa sân</span>
                      </button>
                    )}
                  </div>
                </div>
              </article>
            ))}
          </div>
        </>
      )}

      {tab === 'prices' && (
        <>
          <Panel
            title={`Khung giá theo giờ (${filteredPrices.length})`}
            action={
              <div className="tools" style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <select
                  aria-label="Lọc theo sân"
                  value={priceCourtFilter}
                  onChange={(e) => setPriceCourtFilter(e.target.value)}
                  style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 13 }}
                >
                  <option value="ALL">Tất cả các sân</option>
                  {data.courts.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({labels[c.type] || c.type})
                    </option>
                  ))}
                </select>

                <select
                  aria-label="Lọc loại ngày"
                  value={priceDayFilter}
                  onChange={(e) => setPriceDayFilter(e.target.value)}
                  style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 13 }}
                >
                  <option value="ALL">Tất cả loại ngày</option>
                  <option value="WEEKDAY">Ngày thường (Thứ 2 – Thứ 6)</option>
                  <option value="WEEKEND">Cuối tuần (Thứ 7 & CN)</option>
                </select>

                <Button className="primary sm" onClick={() => edit('prices')}>
                  <Plus size={14} style={{ marginRight: 2 }} /> Thêm khung giá
                </Button>
              </div>
            }
          >
            <Table headings={['Sân', 'Loại ngày', 'Khung giờ', 'Giá / giờ', 'Thao tác']} empty={!filteredPrices.length}>
              {filteredPrices.map((p) => {
                const court = data.courts.find((c) => c.id === p.court);
                return (
                  <tr key={p.id}>
                    <td>
                      <b>{court?.name || 'Sân không xác định'}</b>
                      <small style={{ color: '#64748b' }}>{labels[court?.type] || ''}</small>
                    </td>
                    <td>
                      <span className={`chip ${p.dayType === 'WEEKEND' ? 'orange' : 'blue'}`}>
                        {labels[p.dayType]}
                      </span>
                    </td>
                    <td style={{ fontWeight: 600 }}>
                      {p.start}:00 – {p.end}:00
                    </td>
                    <td className="name">{money(p.price)}</td>
                    <td>
                      <Button className="sm" onClick={() => edit('prices', p)}>
                        Sửa
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </Table>
          </Panel>

          <div className="notice" style={{ marginTop: 20 }}>
            Khung giờ ngoài bảng giá sẽ tự động áp dụng giá cơ bản của sân. Giá được chụp vào lịch khi hệ thống sinh slot cho ngày đó.
          </div>
        </>
      )}
    </>
  );
}
