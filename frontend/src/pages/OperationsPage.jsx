import React, { useState, useMemo } from 'react';
import { 
  Search, ChevronLeft, ChevronRight, Clock, CheckCircle2, 
  AlertCircle, AlertTriangle, Users, DollarSign, Eye, Calendar, Sparkles
} from 'lucide-react';
import { useCourtly } from '../context';
import { Title, Panel, Button, Chip, Table } from '../components/UI';
import { money, today, slotLabel } from '../utils/format';

export default function OperationsPage() {
  const { data, show } = useCourtly();
  const currentToday = today();

  const [activeTab, setActiveTab] = useState('all');
  const [query, setQuery] = useState('');
  const [dateFilter, setDateFilter] = useState('today'); // 'today' | 'all'
  const [page, setPage] = useState(1);
  const pageSize = 12;

  // Categorize orders
  const groups = useMemo(() => {
    const orders = data.orders || [];

    const upcoming = orders.filter(o => o.status === 'CONFIRMED' && o.date >= currentToday)
      .sort((a, b) => a.date.localeCompare(b.date) || (a.slots[0]?.hour || 0) - (b.slots[0]?.hour || 0));

    const inUse = orders.filter(o => o.status === 'CHECKED_IN');

    const holding = orders.filter(o => o.status === 'HOLDING')
      .sort((a, b) => (a.holdUntil || '').localeCompare(b.holdUntil || ''));

    const finance = orders.filter(o => 
      o.finance?.review || 
      (o.finance?.refundPending || 0) > 0 || 
      (['CONFIRMED', 'CHECKED_IN', 'COMPLETED'].includes(o.status) && (o.paid || 0) < (o.total || 0))
    );

    const cancelled = orders.filter(o => ['CANCELLED', 'EXPIRED'].includes(o.status))
      .sort((a, b) => (b.createdAt || b.date || '').localeCompare(a.createdAt || a.date || ''));

    const referee = orders.filter(o => 
      ['HOLDING', 'CONFIRMED', 'CHECKED_IN'].includes(o.status) && (o.staff || []).length > 0
    );

    // All active operations (deduplicated)
    const allSet = new Set([
      ...upcoming.map(o => o.id),
      ...inUse.map(o => o.id),
      ...holding.map(o => o.id),
      ...finance.map(o => o.id),
      ...referee.map(o => o.id),
      ...cancelled.map(o => o.id)
    ]);
    const all = orders.filter(o => allSet.has(o.id))
      .sort((a, b) => (b.date || '').localeCompare(a.date || ''));

    return {
      all,
      upcoming,
      inUse,
      holding,
      finance,
      cancelled,
      referee
    };
  }, [data.orders, currentToday]);

  // Selected pool based on tab
  const pool = useMemo(() => {
    switch (activeTab) {
      case 'upcoming': return groups.upcoming;
      case 'inUse': return groups.inUse;
      case 'holding': return groups.holding;
      case 'finance': return groups.finance;
      case 'cancelled': return groups.cancelled;
      case 'referee': return groups.referee;
      default: return groups.all;
    }
  }, [activeTab, groups]);

  // Filter pool by date & search query
  const filtered = useMemo(() => {
    return pool.filter(o => {
      // Date filter
      if (dateFilter === 'today' && o.date !== currentToday && activeTab !== 'holding' && activeTab !== 'cancelled') {
        // For holding orders, keep today or upcoming
        if (o.status !== 'HOLDING') return false;
      }

      // Query search
      if (query.trim()) {
        const q = query.toLowerCase();
        const courtNames = (o.slots || []).map(s => {
          const c = data.courts.find(x => x.id === s.court);
          return c ? c.name : '';
        }).join(' ');
        const staffNames = (o.staff || []).map(st => st.name).join(' ');
        const match = `${o.name} ${o.phone || ''} ${o.id} ${o.date} ${courtNames} ${staffNames}`.toLowerCase().includes(q);
        if (!match) return false;
      }

      return true;
    });
  }, [pool, dateFilter, currentToday, activeTab, query, data.courts]);

  const totalPages = Math.ceil(filtered.length / pageSize) || 1;
  const currentPage = Math.min(page, totalPages);
  const paginatedList = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, currentPage, pageSize]);

  // Tab definitions
  const tabs = [
    { id: 'all', label: 'Tất cả việc', count: groups.all.length, color: '#0f172a' },
    { id: 'upcoming', label: 'Khách sắp đến', count: groups.upcoming.length, color: '#16a34a' },
    { id: 'inUse', label: 'Đang dùng sân', count: groups.inUse.length, color: '#0284c7' },
    { id: 'holding', label: 'Chờ cọc / Giữ chỗ', count: groups.holding.length, color: '#d97706' },
    { id: 'finance', label: 'Cần thu / Đối chiếu', count: groups.finance.length, color: '#e11d48' },
    { id: 'cancelled', label: 'Đơn hủy cần xử lý', count: groups.cancelled.length, color: '#dc2626' },
    { id: 'referee', label: 'Phân công trọng tài', count: groups.referee.length, color: '#7c3aed' },
  ];

  return (
    <>
      <Title subtitle="Bảng theo dõi và xử lý nhanh các tác vụ vận hành trong ca làm việc.">
        Việc cần xử lý
      </Title>

      {/* KPI Cards / Quick Tabs */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
        gap: 12,
        marginBottom: 20
      }}>
        {tabs.slice(1).map(t => {
          const isSelected = activeTab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => {
                setActiveTab(isSelected ? 'all' : t.id);
                setPage(1);
              }}
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
                padding: '14px 16px',
                borderRadius: 12,
                border: isSelected ? `2px solid ${t.color}` : '1px solid #e2e8f0',
                background: isSelected ? '#ffffff' : '#f8fafc',
                boxShadow: isSelected ? '0 4px 12px rgba(0,0,0,0.06)' : 'none',
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'all 0.15s ease'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 13, color: '#64748b', fontWeight: 600 }}>{t.label}</span>
                <span
                  style={{
                    fontSize: 11,
                    padding: '2px 8px',
                    borderRadius: 99,
                    background: isSelected ? t.color : '#e2e8f0',
                    color: isSelected ? '#ffffff' : '#475569',
                    fontWeight: 700
                  }}
                >
                  {t.count}
                </span>
              </div>
              <div style={{ fontSize: 24, fontWeight: 700, color: t.color }}>
                {t.count} <span style={{ fontSize: 13, fontWeight: 500, color: '#94a3b8' }}>đơn</span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Filter Tabs & Search Controls */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 12,
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16
      }}>
        {/* Category Tabs */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {tabs.map(t => (
            <button
              key={t.id}
              type="button"
              className={`filter-chip ${activeTab === t.id ? 'active' : ''}`}
              onClick={() => {
                setActiveTab(t.id);
                setPage(1);
              }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 14px',
                borderRadius: 20,
                border: activeTab === t.id ? '1px solid #1e293b' : '1px solid #e2e8f0',
                background: activeTab === t.id ? '#1e293b' : '#ffffff',
                color: activeTab === t.id ? '#ffffff' : '#475569',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              {t.label}
              <span style={{
                fontSize: 11,
                padding: '1px 6px',
                borderRadius: 99,
                background: activeTab === t.id ? 'rgba(255,255,255,0.2)' : '#f1f5f9',
                color: activeTab === t.id ? '#ffffff' : '#64748b'
              }}>
                {t.count}
              </span>
            </button>
          ))}
        </div>

        {/* Date Filter & Search */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <select
            value={dateFilter}
            onChange={e => {
              setDateFilter(e.target.value);
              setPage(1);
            }}
            style={{
              padding: '7px 12px',
              borderRadius: 8,
              border: '1px solid #cbd5e1',
              background: '#ffffff',
              fontSize: 13,
              color: '#334155'
            }}
          >
            <option value="today">📅 Hôm nay ({currentToday.split('-').reverse().join('/')})</option>
            <option value="all">🗓️ Tất cả các ngày</option>
          </select>

          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <Search size={15} style={{ position: 'absolute', left: 10, color: '#94a3b8' }} />
            <input
              style={{
                paddingLeft: 32,
                paddingRight: 12,
                height: 36,
                borderRadius: 8,
                border: '1px solid #cbd5e1',
                fontSize: 13,
                width: 220
              }}
              placeholder="Tìm khách, mã đơn, sân..."
              value={query}
              onChange={e => {
                setQuery(e.target.value);
                setPage(1);
              }}
            />
          </div>
        </div>
      </div>

      {/* Main Paginated Table Panel */}
      <Panel
        title={`${tabs.find(t => t.id === activeTab)?.label || 'Việc cần xử lý'} (${filtered.length})`}
        action={
          <span style={{ fontSize: 13, color: '#64748b' }}>
            {filtered.length} công việc phù hợp
          </span>
        }
      >
        <Table
          headings={['Khách hàng & Đơn', 'Ngày & Giờ chơi', 'Tính chất việc cần xử lý', 'Tài chính', 'Trạng thái', 'Thao tác']}
          empty={!paginatedList.length}
        >
          {paginatedList.map(o => {
            const due = Math.max(0, (o.total || 0) - (o.paid || 0));
            const hasReview = o.finance?.review;
            const refundPending = o.finance?.refundPending || 0;
            const courtsSummary = (o.slots || []).map(s => {
              const court = data.courts.find(c => c.id === s.court);
              return `${court ? court.name : 'Sân'} (${slotLabel(s)})`;
            }).join(', ');

            return (
              <tr key={o.id}>
                {/* 1. Customer & Order */}
                <td>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <b>{o.name}</b>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{
                        fontSize: 11,
                        fontFamily: 'monospace',
                        fontWeight: 700,
                        color: '#2563eb',
                        background: '#eff6ff',
                        padding: '1px 5px',
                        borderRadius: 4
                      }}>
                        #{o.id.slice(0, 8).toUpperCase()}
                      </span>
                      {o.phone && (
                        <small style={{ color: '#64748b' }}>{o.phone}</small>
                      )}
                    </div>
                  </div>
                </td>

                {/* 2. Date & Slots */}
                <td>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: '#1e293b' }}>
                      {o.date.split('-').reverse().join('/')}
                    </span>
                    <small style={{ color: '#64748b' }}>
                      {courtsSummary || 'Chưa có slot'}
                    </small>
                  </div>
                </td>

                {/* 3. Task Nature Badge */}
                <td>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {o.status === 'CHECKED_IN' && (
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                        fontSize: 12,
                        color: '#0369a1',
                        background: '#e0f2fe',
                        padding: '2px 8px',
                        borderRadius: 6,
                        fontWeight: 600
                      }}>
                        <Clock size={12} /> Đang sử dụng sân
                      </span>
                    )}

                    {o.status === 'CONFIRMED' && o.date >= currentToday && (
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                        fontSize: 12,
                        color: '#15803d',
                        background: '#dcfce7',
                        padding: '2px 8px',
                        borderRadius: 6,
                        fontWeight: 600
                      }}>
                        <CheckCircle2 size={12} /> Khách sắp đến nhận sân
                      </span>
                    )}

                    {o.status === 'HOLDING' && (
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                        fontSize: 12,
                        color: '#b45309',
                        background: '#fef3c7',
                        padding: '2px 8px',
                        borderRadius: 6,
                        fontWeight: 600
                      }}>
                        <AlertTriangle size={12} />
                        Hạn giữ: {o.holdUntil ? new Date(o.holdUntil).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : '5 phút'}
                      </span>
                    )}

                    {hasReview && (
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                        fontSize: 12,
                        color: '#b91c1c',
                        background: '#fee2e2',
                        padding: '2px 8px',
                        borderRadius: 6,
                        fontWeight: 600
                      }}>
                        <AlertCircle size={12} /> Cần đối chiếu chênh lệch
                      </span>
                    )}

                    {refundPending > 0 && (
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                        fontSize: 12,
                        color: '#b91c1c',
                        background: '#ffe4e6',
                        padding: '2px 8px',
                        borderRadius: 6,
                        fontWeight: 600
                      }}>
                        Chờ hoàn tiền: {money(refundPending)}
                      </span>
                    )}

                    {(o.staff || []).length > 0 && (
                      <small style={{ color: '#6d28d9', display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Users size={12} />
                        Trọng tài: {o.staff.map(st => st.name).join(', ')}
                      </small>
                    )}
                  </div>
                </td>

                {/* 4. Finance / Due */}
                <td>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <span style={{ fontSize: 13, fontWeight: 600 }}>{money(o.total)}</span>
                    {due > 0 ? (
                      <small style={{ color: '#e11d48', fontWeight: 600 }}>
                        Còn thu: {money(due)}
                      </small>
                    ) : (
                      <small style={{ color: '#16a34a' }}>Đã thanh toán đủ</small>
                    )}
                  </div>
                </td>

                {/* 5. Status */}
                <td>
                  <Chip status={o.status} />
                </td>

                {/* 6. Action */}
                <td>
                  <div style={{ display: 'inline-flex', gap: 6 }}>
                    {['CANCELLED', 'EXPIRED'].includes(o.status) && (o.finance?.refundPending > 0 || (o.cancellationSettlement?.refundAmount > 0 && !o.finance?.refunded)) && (
                      <Button
                        className="sm"
                        style={{ background: '#fff1f2', color: '#e11d48', borderColor: '#fecdd3', whiteSpace: 'nowrap' }}
                        onClick={() => show({ type: 'refund', orderId: o.id })}
                      >
                        Hoàn tiền
                      </Button>
                    )}
                    <Button 
                      className="sm primary" 
                      onClick={() => show({ type: 'order', id: o.id })}
                      style={{ whiteSpace: 'nowrap' }}
                    >
                      <Eye size={14} style={{ marginRight: 4 }} /> Mở đơn
                    </Button>
                  </div>
                </td>
              </tr>
            );
          })}
        </Table>

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 16px',
            borderTop: '1px solid #e2e8f0',
            background: '#f8fafc',
            fontSize: 13,
            color: '#64748b'
          }}>
            <div>
              Hiển thị <b>{(currentPage - 1) * pageSize + 1}</b> - <b>{Math.min(currentPage * pageSize, filtered.length)}</b> trong tổng số <b>{filtered.length}</b> việc
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Button
                className="sm"
                disabled={currentPage <= 1}
                onClick={() => setPage(p => Math.max(1, p - 1))}
              >
                <ChevronLeft size={14} style={{ marginRight: 2 }} /> Trước
              </Button>
              <span style={{ fontWeight: 600, color: '#1e293b', padding: '0 8px' }}>
                Trang {currentPage} / {totalPages}
              </span>
              <Button
                className="sm"
                disabled={currentPage >= totalPages}
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              >
                Sau <ChevronRight size={14} style={{ marginLeft: 2 }} />
              </Button>
            </div>
          </div>
        )}
      </Panel>
    </>
  );
}
