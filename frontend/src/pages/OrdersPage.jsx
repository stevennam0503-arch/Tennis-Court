import {hasVisitInRange} from '../utils/order-visits.mjs';
import React, { useState, useMemo } from 'react';
import { Calendar, Search, Filter, ChevronLeft, ChevronRight, Clock, Plus } from 'lucide-react';
import { useCourtly } from '../context';
import { Title, Panel, Button, Chip, Modal } from '../components/UI';
import OrderTable from '../components/OrderTable';
import { labels, today, money } from '../utils/format';

export default function OrdersPage() {
  const { data, navigate, mutate, notify, show } = useCourtly();
  const currentToday = today();

  // Search, status and date range filters
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('');
  const [dateRange, setDateRange] = useState('all'); // 'today' | 'upcoming' | 'recent7' | 'month' | 'custom' | 'all'
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');

  // Pagination
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  // Quick QR/Ticket Check-In Dialog State
  const [scannerOpen, setScannerOpen] = useState(false);
  const [ticketInput, setTicketInput] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const matchedOrder = useMemo(() => {
    const raw = (ticketInput || '').trim();
    if (!raw) return null;
    let target = raw;
    try {
      const parsed = JSON.parse(raw);
      if (parsed.orderId) target = parsed.orderId;
      else if (parsed.ticket) target = parsed.ticket;
    } catch {}

    const clean = target.toUpperCase().replace(/^#/, '');
    return data.orders.find(o => {
      const tCode = 'CT' + o.id.replace(/-/g, '').slice(0, 8).toUpperCase();
      const tCodeHyphen = 'CT-' + o.id.replace(/-/g, '').slice(0, 6).toUpperCase();
      return (
        o.id === target ||
        o.id.startsWith(target) ||
        tCode === clean ||
        tCodeHyphen === clean ||
        o.phone === target ||
        (clean.length >= 4 && (tCode.includes(clean) || o.id.replace(/-/g, '').toUpperCase().includes(clean)))
      );
    });
  }, [ticketInput, data.orders]);

  const handleQuickCheckIn = async (orderId) => {
    try {
      setActionLoading(true);
      await mutate(`/orders/${orderId}/check-in`, {});
      notify('✅ Khách đã check-in thành công!');
    } catch (e) {
      notify(e.message || 'Không thể check-in');
    } finally {
      setActionLoading(false);
    }
  };

  const handleQuickCheckOut = async (orderId) => {
    try {
      setActionLoading(true);
      await mutate(`/orders/${orderId}/check-out`, {});
      notify('🏁 Khách đã check-out & hoàn tất!');
    } catch (e) {
      notify(e.message || 'Không thể check-out');
    } finally {
      setActionLoading(false);
    }
  };

  // Status counts for quick tabs
  const counts = useMemo(() => {
    const map = { all: data.orders.length, HOLDING: 0, CONFIRMED: 0, CHECKED_IN: 0, COMPLETED: 0, CANCELLED: 0 };
    for (const o of data.orders) {
      if (map[o.status] !== undefined) map[o.status]++;
      else if (o.status === 'EXPIRED') map.CANCELLED++;
    }
    return map;
  }, [data.orders]);

  // Filter orders
  const filtered = useMemo(() => {
    return data.orders.filter(o => {
      // 1. Search text
      if (query.trim()) {
        const q = query.toLowerCase();
        const match = `${o.name} ${o.phone || ''} ${o.id}`.toLowerCase().includes(q);
        if (!match) return false;
      }

      // 2. Status filter
      if (status) {
        if (status === 'CANCELLED') {
          if (!['CANCELLED', 'EXPIRED'].includes(o.status)) return false;
        } else if (o.status !== status) {
          return false;
        }
      }

      // 3. Date range filter
      if (dateRange === 'today') {
        if (!hasVisitInRange(o, currentToday, currentToday)) return false;
      } else if (dateRange === 'upcoming') {
        if (!hasVisitInRange(o, currentToday, undefined, true) || ['COMPLETED', 'CANCELLED', 'EXPIRED'].includes(o.status)) return false;
      } else if (dateRange === 'recent7') {
        const d7 = new Date();
        d7.setDate(d7.getDate() - 7);
        const d7Str = d7.toISOString().slice(0, 10);
        if (!hasVisitInRange(o, d7Str, currentToday)) return false;
      } else if (dateRange === 'month') {
        const curM = currentToday.slice(0, 7);
        if (!hasVisitInRange(o, curM+'-01', curM+'-31')) return false;
      } else if (dateRange === 'custom') {
        if (!hasVisitInRange(o, customFrom || '', customTo || '9999-12-31')) return false;
      }

      return true;
    }).sort((a, b) => {
      // Newest date first; if same date, compare createdAt
      const dComp = b.date.localeCompare(a.date);
      if (dComp !== 0) return dComp;
      return (b.createdAt || '').localeCompare(a.createdAt || '');
    });
  }, [data.orders, query, status, dateRange, customFrom, customTo, currentToday]);

  // Total pages
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pagedOrders = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, currentPage, pageSize]);

  const handleStatusChange = s => {
    setStatus(s);
    setPage(1);
  };

  const handleDateRangeChange = r => {
    setDateRange(r);
    setPage(1);
  };

  return (
    <>
      <Title
        subtitle="Quản lý vòng đời đơn: từ giữ chỗ, check-in, dịch vụ tại sân đến hóa đơn."
        action={
          <div style={{ display: 'flex', gap: 10 }}>
            <Button
              className="secondary"
              onClick={() => { setScannerOpen(true); setTicketInput(''); }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                background: '#e8f5e9',
                borderColor: '#a5d6a7',
                color: '#1b5e20',
                fontWeight: 600
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
              Quét mã / Check-in vé
            </Button>
            <Button className="primary" onClick={() => navigate('calendar')}>
              <Plus size={16} /> Đặt sân mới
            </Button>
          </div>
        }
      >
        Đơn đặt sân
      </Title>

      {/* Quick Status Tabs with Badges */}
      <div className="tabs" style={{ marginBottom: 16 }}>
        {[
          ['', `Tất cả (${counts.all})`],
          ['HOLDING', `Chờ cọc (${counts.HOLDING})`],
          ['CONFIRMED', `Đã xác nhận (${counts.CONFIRMED})`],
          ['CHECKED_IN', `Đang chơi (${counts.CHECKED_IN})`],
          ['COMPLETED', `Hoàn tất (${counts.COMPLETED})`],
          ['CANCELLED', `Đã hủy / Hết hạn (${counts.CANCELLED})`]
        ].map(([s, label]) => (
          <button
            key={s}
            className={status === s ? 'on' : ''}
            onClick={() => handleStatusChange(s)}
          >
            {label}
          </button>
        ))}
      </div>

      <Panel
        title={`Danh sách đơn hàng (${filtered.length} đơn phù hợp)`}
        action={
          <div className="tools" style={{ gap: 10 }}>
            {/* Date filter selector */}
            <select
              aria-label="Khoảng thời gian"
              value={dateRange}
              onChange={e => handleDateRangeChange(e.target.value)}
              style={{ minWidth: 140 }}
            >
              <option value="all">Toàn bộ thời gian</option>
              <option value="today">Hôm nay ({currentToday})</option>
              <option value="upcoming">Sắp tới (chưa check-in)</option>
              <option value="recent7">7 ngày gần nhất</option>
              <option value="month">Tháng này ({currentToday.slice(0, 7)})</option>
              <option value="custom">Khoảng ngày tùy chọn…</option>
            </select>

            {dateRange === 'custom' && (
              <>
                <input
                  type="date"
                  aria-label="Từ ngày"
                  placeholder="Từ ngày"
                  value={customFrom}
                  onChange={e => { setCustomFrom(e.target.value); setPage(1); }}
                  style={{ width: 145 }}
                />
                <input
                  type="date"
                  aria-label="Đến ngày"
                  placeholder="Đến ngày"
                  value={customTo}
                  onChange={e => { setCustomTo(e.target.value); setPage(1); }}
                  style={{ width: 145 }}
                />
              </>
            )}

            {/* Search Box */}
            <input
              className="search"
              placeholder="Tìm tên khách, số ĐT, mã đơn…"
              value={query}
              onChange={e => { setQuery(e.target.value); setPage(1); }}
              style={{ minWidth: 230 }}
            />
          </div>
        }
      >
        <OrderTable orders={pagedOrders} />

        {/* Pagination Toolbar */}
        {filtered.length > 0 && (
          <div
            className="panel-body"
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              borderTop: '1px solid var(--line)',
              padding: '14px 20px',
              flexWrap: 'wrap',
              gap: 12,
              background: '#fcfdfc'
            }}
          >
            <div style={{ fontSize: 13, color: 'var(--muted)' }}>
              Hiển thị <b>{(currentPage - 1) * pageSize + 1} – {Math.min(currentPage * pageSize, filtered.length)}</b> trong tổng số <b>{filtered.length}</b> đơn hàng
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <label style={{ margin: 0, fontSize: 13, color: 'var(--muted)', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                Số dòng:
                <select
                  value={pageSize}
                  onChange={e => { setPageSize(Number(e.target.value)); setPage(1); }}
                  style={{ minHeight: 34, padding: '4px 8px', width: 'auto' }}
                >
                  <option value={15}>15</option>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
              </label>

              <div style={{ display: 'flex', gap: 6 }}>
                <Button
                  className="sm"
                  disabled={currentPage <= 1}
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                >
                  <ChevronLeft size={16} /> Trang trước
                </Button>
                <span style={{ fontSize: 13, fontWeight: 600, padding: '6px 10px', background: 'white', border: '1px solid var(--line)', borderRadius: 6 }}>
                  {currentPage} / {totalPages}
                </span>
                <Button
                  className="sm"
                  disabled={currentPage >= totalPages}
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                >
                  Trang sau <ChevronRight size={16} />
                </Button>
              </div>
            </div>
          </div>
        )}
      </Panel>

      {scannerOpen && (
        <Modal
          title="Quét mã QR / Check-in vé điện tử"
          onClose={() => { setScannerOpen(false); setTicketInput(''); }}
        >
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6, color: '#173c32' }}>
              Mã vé QR hoặc mã đơn / Số điện thoại:
            </label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                autoFocus
                type="text"
                value={ticketInput}
                onChange={e => setTicketInput(e.target.value)}
                placeholder="Nhập hoặc dán mã vé (CT-XXXX), ID đơn, hoặc quét QR…"
                style={{ flex: 1, padding: '10px 14px', fontSize: 15, borderRadius: 8, border: '1px solid #173c32' }}
              />
              {ticketInput && (
                <Button className="sm" onClick={() => setTicketInput('')}>
                  Xóa
                </Button>
              )}
            </div>
            <small style={{ color: '#666', marginTop: 4, display: 'block' }}>
              Tip: Quét mã QR từ điện thoại của khách hoặc nhập mã vé in trên E-Ticket (ví dụ: CT-ABC123).
            </small>
          </div>

          {matchedOrder ? (
            <div style={{
              background: '#f8faf7',
              border: '1.5px solid #c2dbbe',
              borderRadius: 10,
              padding: 16,
              boxShadow: '0 4px 12px rgba(23,60,50,0.06)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <div>
                  <span style={{
                    display: 'inline-block',
                    background: '#173c32',
                    color: '#fff',
                    padding: '3px 8px',
                    borderRadius: 4,
                    fontSize: 12,
                    fontWeight: 700,
                    letterSpacing: 0.5
                  }}>
                    CT-{matchedOrder.id.replace(/-/g, '').slice(0, 6).toUpperCase()}
                  </span>
                  <h3 style={{ margin: '6px 0 0', fontSize: 18, color: '#173c32' }}>{matchedOrder.name}</h3>
                  <div style={{ fontSize: 13, color: '#666' }}>ĐT: <b>{matchedOrder.phone || 'Chưa cung cấp'}</b></div>
                </div>
                <Chip status={matchedOrder.status} />
              </div>

              <div style={{ background: '#fff', border: '1px solid #e1e7de', borderRadius: 8, padding: '12px 14px', marginBottom: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 13 }}>
                  <span style={{ color: '#666' }}>Lịch sân:</span>
                  <b>{matchedOrder.date} • {matchedOrder.slots.map(s => `${data.courts.find(c => c.id === s.court)?.name || 'Sân'} (${s.hour}:00)`).join(', ')}</b>
                </div>
                {matchedOrder.staff?.length > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 13 }}>
                    <span style={{ color: '#666' }}>Trọng tài:</span>
                    <b>{matchedOrder.staff.map(st => st.name).join(', ')}</b>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, borderTop: '1px dashed #eee', paddingTop: 6, marginTop: 6 }}>
                  <span style={{ color: '#666' }}>Tài chính:</span>
                  <span>Đã thu: <b style={{ color: '#1b5e20' }}>{money(matchedOrder.paid)}</b> / Tổng: <b>{money(matchedOrder.total)}</b></span>
                </div>
              </div>

              {matchedOrder.status === 'HOLDING' && (
                <div style={{ background: '#fffbeb', border: '1px solid #fde68a', color: '#92400e', padding: 10, borderRadius: 6, fontSize: 13, marginBottom: 12 }}>
                  ⏳ Đơn đang giữ chỗ và chưa thanh toán tiền cọc. Lễ tân cần thu cọc <b>{money(matchedOrder.deposit)}</b> trước khi xác nhận check-in.
                </div>
              )}

              {matchedOrder.status === 'CONFIRMED' && (
                <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#166534', padding: 10, borderRadius: 6, fontSize: 13, marginBottom: 12 }}>
                  ✓ Vé hợp lệ! Đã đặt cọc thành công. Khách đã đến sân và sẵn sàng check-in.
                </div>
              )}

              {matchedOrder.status === 'CHECKED_IN' && (
                <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', color: '#1e40af', padding: 10, borderRadius: 6, fontSize: 13, marginBottom: 12 }}>
                  🎾 Khách đang chơi trên sân (Check-in lúc {new Date(matchedOrder.checkInAt).toLocaleTimeString('vi-VN')}). Khi kết thúc giờ chơi, bấm Check-out & Hoàn tất.
                </div>
              )}

              {matchedOrder.status === 'COMPLETED' && (
                <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', color: '#475569', padding: 10, borderRadius: 6, fontSize: 13, marginBottom: 12 }}>
                  ✓ Đơn hàng đã hoàn tất buổi chơi lúc {matchedOrder.checkOutAt ? new Date(matchedOrder.checkOutAt).toLocaleTimeString('vi-VN') : ''}.
                </div>
              )}

              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 14 }}>
                {matchedOrder.status === 'CONFIRMED' && (
                  <Button
                    className="primary"
                    disabled={actionLoading}
                    onClick={() => handleQuickCheckIn(matchedOrder.id)}
                    style={{ background: '#166534', borderColor: '#166534', fontWeight: 700 }}
                  >
                    {actionLoading ? 'Đang xử lý…' : '✅ Xác nhận Check-in ngay'}
                  </Button>
                )}
                {matchedOrder.status === 'CHECKED_IN' && (
                  <Button
                    className="primary"
                    disabled={actionLoading}
                    onClick={() => handleQuickCheckOut(matchedOrder.id)}
                    style={{ background: '#1e40af', borderColor: '#1e40af', fontWeight: 700 }}
                  >
                    {actionLoading ? 'Đang xử lý…' : '🏁 Check-out & Hoàn tất'}
                  </Button>
                )}
                {matchedOrder.status === 'HOLDING' && (
                  <Button
                    className="lime"
                    onClick={() => { setScannerOpen(false); show({ type: 'payment', id: matchedOrder.id }); }}
                  >
                    Thu cọc tại quầy ({money(matchedOrder.deposit)})
                  </Button>
                )}
                <Button
                  onClick={() => { setScannerOpen(false); show({ type: 'order', id: matchedOrder.id }); }}
                >
                  Xem chi tiết đơn
                </Button>
                <Button onClick={() => setScannerOpen(false)}>
                  Đóng
                </Button>
              </div>
            </div>
          ) : ticketInput ? (
            <div style={{ textAlign: 'center', padding: '24px 12px', background: '#fff5f5', border: '1px dashed #feb2b2', borderRadius: 8, color: '#c53030' }}>
              Không tìm thấy đơn hàng nào khớp với mã: <b>"{ticketInput}"</b>.
              <div style={{ fontSize: 12, marginTop: 6, color: '#742a2a' }}>Vui lòng kiểm tra lại mã vé trên điện thoại của khách.</div>
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '28px 12px', background: '#f9f9f9', border: '1px dashed #d1d5db', borderRadius: 8, color: '#6b7280' }}>
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ margin: '0 auto 8px', color: '#9ca3af' }}>
                <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
              </svg>
              <div>Chưa nhập mã vé hoặc chưa quét QR.</div>
              <small>Có thể dán mã vé (ví dụ: CT-XXXX) hoặc quét mã từ camera / máy quét mã vạch.</small>
            </div>
          )}
        </Modal>
      )}
    </>
  );
}
