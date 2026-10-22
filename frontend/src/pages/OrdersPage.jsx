import React, { useState, useMemo } from 'react';
import { Calendar, Search, Filter, ChevronLeft, ChevronRight, Clock, Plus } from 'lucide-react';
import { useCourtly } from '../context';
import { Title, Panel, Button, Chip } from '../components/UI';
import OrderTable from '../components/OrderTable';
import { labels, today, money } from '../utils/format';

export default function OrdersPage() {
  const { data, navigate } = useCourtly();
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
        if (o.date !== currentToday) return false;
      } else if (dateRange === 'upcoming') {
        if (o.date < currentToday || ['COMPLETED', 'CANCELLED', 'EXPIRED'].includes(o.status)) return false;
      } else if (dateRange === 'recent7') {
        const d7 = new Date();
        d7.setDate(d7.getDate() - 7);
        const d7Str = d7.toISOString().slice(0, 10);
        if (o.date < d7Str || o.date > currentToday) return false;
      } else if (dateRange === 'month') {
        const curM = currentToday.slice(0, 7);
        if (!o.date.startsWith(curM)) return false;
      } else if (dateRange === 'custom') {
        if (customFrom && o.date < customFrom) return false;
        if (customTo && o.date > customTo) return false;
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
          <Button className="primary" onClick={() => navigate('calendar')}>
            <Plus size={16} /> Đặt sân mới
          </Button>
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
    </>
  );
}
