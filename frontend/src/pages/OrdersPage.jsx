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
    const o = data.orders.find(x => x.id === orderId);
    if (o && (o.paid < o.total || o.paid > o.total)) {
      show({ type: 'check-out', id: orderId });
      return;
    }
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
    const map = { all: data.orders.length, HOLDING: 0, CONFIRMED: 0, CHECKED_IN: 0, COMPLETED: 0, CANCELLED: 0, REFUND_PENDING: 0 };
    for (const o of data.orders) {
      if (map[o.status] !== undefined) map[o.status]++;
      else if (o.status === 'EXPIRED') map.CANCELLED++;

      const isCancelled = ['CANCELLED', 'EXPIRED'].includes(o.status);
      const refunded = o.finance?.refunded || 0;
      const settlement = o.cancellationSettlement || o.metadata?.cancellationSettlement;
      const expectedRefund = settlement ? (settlement.refundAmount || 0) : 0;
      const refundPending = o.finance?.refundPending || expectedRefund || 0;
      if (isCancelled && (refundPending > 0 || (expectedRefund > 0 && refunded < expectedRefund)) && refunded === 0) {
        map.REFUND_PENDING++;
      }
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
        if (status === 'REFUND_PENDING') {
          const isCancelled = ['CANCELLED', 'EXPIRED'].includes(o.status);
          const refunded = o.finance?.refunded || 0;
          const settlement = o.cancellationSettlement || o.metadata?.cancellationSettlement;
          const expectedRefund = settlement ? (settlement.refundAmount || 0) : 0;
          const refundPending = o.finance?.refundPending || expectedRefund || 0;
          if (!isCancelled || ((refundPending <= 0 && expectedRefund <= 0) || refunded > 0)) {
            return false;
          }
        } else if (status === 'CANCELLED') {
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
              onClick={() => show({ type: 'auto-qr-checkin' })}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                background: '#e8f5e9',
                borderColor: '#a5d6a7',
                color: '#1b5e20',
                fontWeight: 700
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
              Quét QR Check-in tự động
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
          ['CANCELLED', `Đã hủy / Hết hạn (${counts.CANCELLED})`],
          ['REFUND_PENDING', `💸 Chờ hoàn tiền (${counts.REFUND_PENDING})`]
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


    </>
  );
}
