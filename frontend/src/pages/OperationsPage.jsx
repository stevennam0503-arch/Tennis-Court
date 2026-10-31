import React, { useState, useMemo } from 'react';
import { 
  Search, ChevronLeft, ChevronRight, Clock, CheckCircle2, 
  AlertCircle, AlertTriangle, Users, DollarSign, Eye, Calendar, Sparkles
} from 'lucide-react';
import { useCourtly } from '../context';
import { Title, Panel, Button, Chip, Table } from '../components/UI';
import { money, today, slotLabel } from '../utils/format';

export function getOrderTiming(order, currentToday) {
  if (!order) return { state: 'UNKNOWN' };
  const slots = order.slots || [];
  if (!slots.length) return { state: 'UNKNOWN' };

  let maxEnd = '00:00';
  for (const s of slots) {
    const endStr = s.end ? s.end.slice(0, 5) : `${String(Math.floor(s.hour + (s.hours || 1))).padStart(2, '0')}:00`;
    if (endStr > maxEnd) maxEnd = endStr;
  }

  const orderDate = order.date;
  const isPastDay = orderDate < currentToday;
  const isFutureDay = orderDate > currentToday;

  if (isPastDay) {
    return {
      state: 'OVERDUE',
      endTime: maxEnd,
      isOverdue: true,
      diffMinutes: 9999,
      label: `Quá hạn từ ngày ${orderDate.split('-').reverse().join('/')}`
    };
  }

  if (isFutureDay) {
    return {
      state: 'FUTURE',
      endTime: maxEnd,
      isOverdue: false,
      diffMinutes: -9999,
      label: `Lịch ngày ${orderDate.split('-').reverse().join('/')}`
    };
  }

  // Today
  const now = new Date();
  const [endH, endM] = maxEnd.split(':').map(Number);
  const endDateTime = new Date();
  endDateTime.setHours(endH, endM, 0, 0);

  const diffMs = now.getTime() - endDateTime.getTime();
  const diffMinutes = Math.floor(diffMs / (1000 * 60));

  if (diffMinutes < -15) {
    return {
      state: 'PLAYING',
      endTime: maxEnd,
      isOverdue: false,
      diffMinutes,
      label: `Đang chơi (kết thúc ${maxEnd})`
    };
  } else if (diffMinutes >= -15 && diffMinutes <= 0) {
    return {
      state: 'EXPIRING_SOON',
      endTime: maxEnd,
      isOverdue: false,
      diffMinutes,
      remainingMinutes: Math.abs(diffMinutes),
      label: `Sắp hết giờ (còn ${Math.abs(diffMinutes)}p · đến ${maxEnd})`
    };
  } else if (diffMinutes > 0 && diffMinutes <= 15) {
    return {
      state: 'GRACE_PERIOD',
      endTime: maxEnd,
      isOverdue: true,
      diffMinutes,
      graceLeft: 15 - diffMinutes,
      label: `Đến giờ trả sân! Thu tiền & Check-out trong 15p (còn ${15 - diffMinutes}p)`
    };
  } else {
    return {
      state: 'OVERDUE',
      endTime: maxEnd,
      isOverdue: true,
      diffMinutes,
      label: `Quá hạn check-out (+${diffMinutes}p)`
    };
  }
}

export default function OperationsPage() {
  const { data, show } = useCourtly();
  const currentToday = today();

  const [activeTab, setActiveTab] = useState('all');
  const [query, setQuery] = useState('');
  const [dateFilter, setDateFilter] = useState('today'); // 'today' | 'all'
  const [page, setPage] = useState(1);
  const pageSize = 12;

  // Categorize orders with realistic operational boundaries
  const groups = useMemo(() => {
    const orders = data.orders || [];

    // 1. Upcoming confirmed orders
    const upcoming = orders.filter(o => o.status === 'CONFIRMED' && o.date >= currentToday)
      .sort((a, b) => a.date.localeCompare(b.date) || (a.slots[0]?.hour || 0) - (b.slots[0]?.hour || 0));

    // 2. Currently playing today (only active sessions today, not overdue past 15m)
    const inUse = orders.filter(o => {
      if (o.status !== 'CHECKED_IN') return false;
      const timing = getOrderTiming(o, currentToday);
      return o.date === currentToday && timing.state !== 'OVERDUE';
    });

    // 3. Uncollected orders (past due date or overdue > 15m with unpaid balance)
    const uncollected = orders.filter(o => {
      if (['CANCELLED', 'EXPIRED'].includes(o.status)) return false;
      const due = (o.total || 0) - (o.paid || 0);
      if (due <= 0) return false;

      if (o.status === 'COMPLETED') return true;
      if (o.status === 'CHECKED_IN') {
        const timing = getOrderTiming(o, currentToday);
        return timing.state === 'OVERDUE' || o.date < currentToday;
      }
      if (o.status === 'CONFIRMED' && o.date < currentToday) return true;
      return false;
    }).sort((a, b) => b.date.localeCompare(a.date));

    // 4. Overdue check-in orders but paid in full (need admin to click checkout and release court)
    const needCheckout = orders.filter(o => {
      if (o.status !== 'CHECKED_IN') return false;
      const due = (o.total || 0) - (o.paid || 0);
      const timing = getOrderTiming(o, currentToday);
      return (timing.state === 'OVERDUE' || o.date < currentToday) && due <= 0;
    }).sort((a, b) => b.date.localeCompare(a.date));

    // 5. Holding orders waiting for deposit
    const holding = orders.filter(o => o.status === 'HOLDING')
      .sort((a, b) => (a.holdUntil || '').localeCompare(b.holdUntil || ''));

    // 6. Finance review / refunds
    const finance = orders.filter(o => 
      o.finance?.review || 
      (o.finance?.refundPending || 0) > 0 || 
      (['CONFIRMED', 'CHECKED_IN', 'COMPLETED'].includes(o.status) && (o.paid || 0) < (o.total || 0))
    );

    // 7. Cancelled orders needing attention
    const cancelled = orders.filter(o => ['CANCELLED', 'EXPIRED'].includes(o.status))
      .sort((a, b) => (b.createdAt || b.date || '').localeCompare(a.createdAt || a.date || ''));

    // 8. Referee assignments
    const referee = orders.filter(o => 
      ['HOLDING', 'CONFIRMED', 'CHECKED_IN'].includes(o.status) && (o.staff || []).length > 0
    );

    // Real-time notification pools
    const expiringSoon = inUse.filter(o => getOrderTiming(o, currentToday).state === 'EXPIRING_SOON');
    const gracePeriod = inUse.filter(o => getOrderTiming(o, currentToday).state === 'GRACE_PERIOD');

    // All active operations (deduplicated)
    const allSet = new Set([
      ...upcoming.map(o => o.id),
      ...inUse.map(o => o.id),
      ...uncollected.map(o => o.id),
      ...needCheckout.map(o => o.id),
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
      uncollected,
      needCheckout,
      holding,
      finance,
      cancelled,
      referee,
      expiringSoon,
      gracePeriod
    };
  }, [data.orders, currentToday]);

  // Selected pool based on tab
  const pool = useMemo(() => {
    switch (activeTab) {
      case 'upcoming': return groups.upcoming;
      case 'inUse': return groups.inUse;
      case 'uncollected': return groups.uncollected;
      case 'needCheckout': return groups.needCheckout;
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
      // Cross-day tabs should not be filtered out by dateFilter === 'today'
      const isCrossDayTab = ['uncollected', 'needCheckout', 'holding', 'cancelled'].includes(activeTab);
      if (dateFilter === 'today' && o.date !== currentToday && !isCrossDayTab) {
        return false;
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
    { id: 'inUse', label: 'Đang dùng sân', count: groups.inUse.length, color: '#0284c7' },
    { id: 'uncollected', label: 'Đơn chưa thu tiền', count: groups.uncollected.length, color: '#b91c1c' },
    { id: 'needCheckout', label: 'Cần Check-out đóng ca', count: groups.needCheckout.length, color: '#d97706' },
    { id: 'upcoming', label: 'Khách sắp đến', count: groups.upcoming.length, color: '#16a34a' },
    { id: 'holding', label: 'Chờ cọc / Giữ chỗ', count: groups.holding.length, color: '#eab308' },
    { id: 'cancelled', label: 'Đơn hủy cần xử lý', count: groups.cancelled.length, color: '#dc2626' },
    { id: 'referee', label: 'Phân công trọng tài', count: groups.referee.length, color: '#7c3aed' },
  ];

  return (
    <>
      <Title subtitle="Bảng theo dõi và xử lý nhanh các tác vụ vận hành trong ca làm việc.">
        Việc cần xử lý
      </Title>

      {/* Real-time Urgent Operational Notifications */}
      {groups.gracePeriod.length > 0 && (
        <div style={{ background: '#fff1f2', border: '1.5px solid #fecdd3', borderRadius: 10, padding: '14px 16px', marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 24 }}>⏰</span>
            <div>
              <strong style={{ color: '#9f1239', fontSize: 14, display: 'block' }}>
                ĐẾN GIỜ TRẢ SÂN ({groups.gracePeriod.length} ca)! Yêu cầu Admin Check-out & thu tiền trong 15 phút
              </strong>
              <span style={{ fontSize: 12.5, color: '#be123c' }}>
                {groups.gracePeriod.map(o => `${o.name} (${data.courts.find(c => c.id === o.slots?.[0]?.court)?.name || 'Sân'})`).join(' • ')}
              </span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {groups.gracePeriod.slice(0, 2).map(o => (
              <Button
                key={o.id}
                className="sm primary"
                style={{ background: '#e11d48', borderColor: '#be123c', fontWeight: 700 }}
                onClick={() => show({ type: 'check-out', id: o.id })}
              >
                ⚡ Check-out #{o.id.slice(0, 6)}
              </Button>
            ))}
          </div>
        </div>
      )}

      {groups.expiringSoon.length > 0 && (
        <div style={{ background: '#fffbeb', border: '1.5px solid #fde68a', borderRadius: 10, padding: '12px 16px', marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 20 }}>🔔</span>
            <div>
              <strong style={{ color: '#92400e', fontSize: 13.5, display: 'block' }}>
                Chuẩn bị Check-out ({groups.expiringSoon.length} ca sắp hết giờ trong 15 phút tới)
              </strong>
              <span style={{ fontSize: 12, color: '#b45309' }}>
                {groups.expiringSoon.map(o => `${o.name} (${data.courts.find(c => c.id === o.slots?.[0]?.court)?.name || 'Sân'})`).join(' • ')}
              </span>
            </div>
          </div>
          <Button className="sm" onClick={() => { setActiveTab('inUse'); setPage(1); }}>
            Xem ca đang chơi
          </Button>
        </div>
      )}

      {groups.uncollected.length > 0 && activeTab !== 'uncollected' && (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '10px 14px', marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
          <span style={{ fontSize: 13, color: '#991b1b' }}>
            🚨 Phát hiện <b>{groups.uncollected.length} đơn</b> quá hạn chưa thu đủ tiền. Đã tự động đưa vào mục "Đơn chưa thu tiền".
          </span>
          <button
            type="button"
            onClick={() => { setActiveTab('uncollected'); setPage(1); }}
            style={{ border: 'none', background: 'none', color: '#b91c1c', fontWeight: 700, fontSize: 12.5, cursor: 'pointer', textDecoration: 'underline' }}
          >
            Chuyển đến Đơn chưa thu tiền →
          </button>
        </div>
      )}

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
                padding: '7px 14px',
                borderRadius: 20,
                border: activeTab === t.id ? '1px solid #173c32' : '1px solid #e2e8f0',
                background: activeTab === t.id ? '#173c32' : '#ffffff',
                color: activeTab === t.id ? '#def46a' : '#475569',
                fontSize: 13,
                fontWeight: activeTab === t.id ? 700 : 500,
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              <span>{t.label}</span>
              <span style={{
                fontSize: 11,
                padding: '1px 6px',
                borderRadius: 10,
                background: activeTab === t.id ? 'rgba(222,244,106,0.25)' : '#f1f5f9',
                color: activeTab === t.id ? '#def46a' : '#64748b',
                fontWeight: 700
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
            const timing = getOrderTiming(o, currentToday);
            const isCancelled = ['CANCELLED', 'EXPIRED'].includes(o.status);

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
                    {/* Overdue Debt Notice */}
                    {due > 0 && (o.status === 'COMPLETED' || (o.status === 'CHECKED_IN' && (o.date < currentToday || timing.state === 'OVERDUE'))) && (
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                        fontSize: 12,
                        color: '#991b1b',
                        background: '#fee2e2',
                        padding: '3px 8px',
                        borderRadius: 6,
                        fontWeight: 700,
                        border: '1px solid #fecaca'
                      }}>
                        <AlertCircle size={13} /> QUÁ HẠN CHƯA THU ĐỦ TIỀN ({money(due)})
                      </span>
                    )}

                    {/* Overdue but fully paid needing release */}
                    {due <= 0 && o.status === 'CHECKED_IN' && (o.date < currentToday || timing.state === 'OVERDUE') && (
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                        fontSize: 12,
                        color: '#b45309',
                        background: '#fef3c7',
                        padding: '3px 8px',
                        borderRadius: 6,
                        fontWeight: 700,
                        border: '1px solid #fde68a'
                      }}>
                        <Clock size={13} /> ĐÃ ĐÓNG ĐỦ · CẦN CHECK-OUT TRẢ SÂN
                      </span>
                    )}

                    {/* Active playing today */}
                    {o.status === 'CHECKED_IN' && o.date === currentToday && timing.state === 'PLAYING' && (
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
                        <Clock size={12} /> {timing.label}
                      </span>
                    )}

                    {/* Expiring soon (in 15m) */}
                    {o.status === 'CHECKED_IN' && o.date === currentToday && timing.state === 'EXPIRING_SOON' && (
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                        fontSize: 12,
                        color: '#b45309',
                        background: '#fef3c7',
                        padding: '3px 8px',
                        borderRadius: 6,
                        fontWeight: 700,
                        border: '1px solid #fde68a'
                      }}>
                        🔔 {timing.label}
                      </span>
                    )}

                    {/* Grace period (15m to checkout & collect) */}
                    {o.status === 'CHECKED_IN' && o.date === currentToday && timing.state === 'GRACE_PERIOD' && (
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                        fontSize: 12,
                        color: '#dc2626',
                        background: '#fee2e2',
                        padding: '3px 8px',
                        borderRadius: 6,
                        fontWeight: 700,
                        border: '1px solid #fecaca'
                      }}>
                        ⏰ {timing.label}
                      </span>
                    )}

                    {/* Upcoming confirmed */}
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

                    {/* Holding */}
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

                    {/* Cancelled */}
                    {isCancelled && (
                      (() => {
                        const settlement = o.cancellationSettlement || o.metadata?.cancellationSettlement;
                        const refunded = o.finance?.refunded || 0;
                        const hasPending = (o.finance?.refundPending || settlement?.refundAmount || 0) > 0 && refunded === 0;

                        return (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                            <span style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4,
                              fontSize: 12,
                              color: hasPending ? '#b45309' : '#b91c1c',
                              background: hasPending ? '#fef3c7' : '#fee2e2',
                              padding: '2px 8px',
                              borderRadius: 6,
                              fontWeight: 700
                            }}>
                              ❌ {hasPending ? `Khách hủy · Chờ hoàn ${money(settlement?.refundAmount || o.finance?.refundPending)}` : 'Đơn khách đã hủy'}
                            </span>
                            {settlement?.policyDescription && (
                              <small style={{ color: '#1e40af', fontSize: 11, fontWeight: 600 }}>{settlement.policyDescription}</small>
                            )}
                            {o.metadata?.cancelReason && (
                              <small style={{ color: '#64748b', fontSize: 11 }}>Lý do: {o.metadata.cancelReason}</small>
                            )}
                          </div>
                        );
                      })()
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

                    {refundPending > 0 && !isCancelled && (
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
                      <small style={{ color: '#e11d48', fontWeight: 700 }}>
                        Còn thu: {money(due)}
                      </small>
                    ) : (
                      <small style={{ color: '#16a34a', fontWeight: 600 }}>Đã thanh toán đủ</small>
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
                    {o.status === 'CHECKED_IN' && (
                      <Button
                        className="sm primary"
                        style={{
                          background: due > 0 ? '#e11d48' : '#16a34a',
                          borderColor: due > 0 ? '#be123c' : '#15803d',
                          fontWeight: 700,
                          whiteSpace: 'nowrap'
                        }}
                        onClick={() => show({ type: 'check-out', id: o.id })}
                      >
                        {due > 0 ? 'Thu tiền & Check-out' : 'Check-out'}
                      </Button>
                    )}

                    {isCancelled && (o.finance?.refundPending > 0 || (o.cancellationSettlement?.refundAmount > 0 && !o.finance?.refunded)) && (
                      <Button
                        className="sm"
                        style={{ background: '#fff1f2', color: '#e11d48', borderColor: '#fecdd3', whiteSpace: 'nowrap' }}
                        onClick={() => show({ type: 'refund', orderId: o.id })}
                      >
                        Hoàn tiền
                      </Button>
                    )}

                    <Button 
                      className="sm" 
                      onClick={() => show({ type: 'order', id: o.id })}
                      style={{ whiteSpace: 'nowrap' }}
                    >
                      <Eye size={14} style={{ marginRight: 4 }} /> Chi tiết
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
