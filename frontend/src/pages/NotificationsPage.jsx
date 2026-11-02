import React, { useState, useMemo } from 'react';
import { useCourtly } from '../context';
import { Title, Panel, Button } from '../components/UI';
import { today, money, hourLabel, labels } from '../utils/format';
import { 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  CreditCard, 
  Calendar, 
  MessageSquare, 
  ExternalLink,
  ChevronRight,
  UserCheck,
  Flame,
  ShieldCheck,
  Filter,
  Check
} from 'lucide-react';

export default function NotificationsPage() {
  const { data, show, navigate } = useCourtly();
  const [filter, setFilter] = useState('ALL'); // ALL, HOLDING, TODAY, IN_USE, UNPAID, FEEDBACK
  const curToday = today();

  const orders = data?.orders || [];
  const feedbackList = data?.content?.feedback || [];

  // Helper format time range for slots
  const formatSlotsTime = (slots) => {
    if (!slots || !slots.length) return '';
    const sorted = [...slots].sort((a, b) => (a.hour ?? 0) - (b.hour ?? 0));
    const first = sorted[0];
    const last = sorted[sorted.length - 1];
    const startStr = first.start?.slice(0, 5) || hourLabel(first.hour);
    const endStr = last.end?.slice(0, 5) || hourLabel(last.hour + (last.hour % 1 !== 0 ? 0.5 : 1));
    return `${startStr} – ${endStr} (${slots.length * 0.5}h)`;
  };

  // 1. Holding / Awaiting deposit
  const holdingOrders = useMemo(() => {
    return orders.filter(o => o.status === 'HOLDING');
  }, [orders]);

  // 2. Scheduled for today (Confirmed, awaiting check-in)
  const todayOrders = useMemo(() => {
    return orders.filter(o => o.date === curToday && o.status === 'CONFIRMED');
  }, [orders, curToday]);

  // 3. Currently checked-in on court
  const inUseOrders = useMemo(() => {
    return orders.filter(o => o.date === curToday && o.status === 'CHECKED_IN');
  }, [orders, curToday]);

  // 4. Uncollected debt / Pending balance
  const unpaidOrders = useMemo(() => {
    return orders.filter(o => {
      if (['CANCELLED', 'EXPIRED'].includes(o.status)) return false;
      const due = (o.total || 0) - (o.paid || 0);
      return due > 0 && (o.status === 'COMPLETED' || o.date < curToday || (o.date === curToday && o.status === 'CHECKED_IN'));
    });
  }, [orders, curToday]);

  // 5. Pending feedbacks
  const pendingFeedbacks = useMemo(() => {
    return feedbackList.filter(f => !f.reply && !f.published);
  }, [feedbackList]);

  // Filter items
  const counts = {
    ALL: holdingOrders.length + todayOrders.length + inUseOrders.length + unpaidOrders.length + pendingFeedbacks.length,
    HOLDING: holdingOrders.length,
    TODAY: todayOrders.length,
    IN_USE: inUseOrders.length,
    UNPAID: unpaidOrders.length,
    FEEDBACK: pendingFeedbacks.length
  };

  return (
    <>
      <Title subtitle="Trung tâm điều phối & nhắc việc vận hành trực tiếp trong ngày">
        Thông báo & Việc cần xử lý
      </Title>

      {/* FILTER PILLS */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
        {[
          { key: 'ALL', label: 'Tất cả việc cần làm', count: counts.ALL },
          { key: 'HOLDING', label: 'Chờ thanh toán cọc', count: counts.HOLDING, color: '#f59e0b' },
          { key: 'TODAY', label: 'Khách đến hôm nay', count: counts.TODAY, color: '#10b981' },
          { key: 'IN_USE', label: 'Đang trên sân', count: counts.IN_USE, color: '#3b82f6' },
          { key: 'UNPAID', label: 'Công nợ cần thu', count: counts.UNPAID, color: '#ef4444' },
          { key: 'FEEDBACK', label: 'Đánh giá chờ duyệt', count: counts.FEEDBACK, color: '#8b5cf6' }
        ].map(tab => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setFilter(tab.key)}
            style={{
              padding: '8px 14px',
              borderRadius: 20,
              fontSize: 13,
              fontWeight: filter === tab.key ? 700 : 500,
              background: filter === tab.key ? '#173c32' : '#ffffff',
              color: filter === tab.key ? '#ffffff' : '#334155',
              border: filter === tab.key ? '1px solid #173c32' : '1px solid #cbd5e1',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              transition: 'all 0.15s ease'
            }}
          >
            <span>{tab.label}</span>
            {tab.count > 0 && (
              <span
                style={{
                  background: filter === tab.key ? '#def46a' : (tab.color || '#e2e8f0'),
                  color: filter === tab.key ? '#173c32' : (tab.color ? '#ffffff' : '#475569'),
                  fontSize: 11,
                  fontWeight: 800,
                  padding: '1px 6px',
                  borderRadius: 10,
                  lineHeight: 1.3
                }}
              >
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      <div style={{ display: 'grid', gap: 16 }}>
        {/* SECTION 1: HOLDING ORDERS */}
        {(filter === 'ALL' || filter === 'HOLDING') && holdingOrders.length > 0 && (
          <Panel title={`⏰ Chờ thanh toán cọc — Cần theo dõi giữ chỗ (${holdingOrders.length})`}>
            <div style={{ display: 'grid', gap: 10 }}>
              {holdingOrders.map(o => {
                const depositDue = Math.max(0, (o.depositRequired || o.deposit || 0) - (o.paid || 0));
                const holdTime = o.holdUntil ? new Date(o.holdUntil).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : '15 phút';
                return (
                  <div
                    key={o.id}
                    style={{
                      background: '#fffdf5',
                      border: '1px solid #fef3c7',
                      borderRadius: 10,
                      padding: '14px 18px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 16,
                      flexWrap: 'wrap'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                      <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#fef3c7', color: '#d97706', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                        <Clock size={20} />
                      </div>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          <strong style={{ fontSize: 14.5, color: '#173c32' }}>{o.name || o.customerName}</strong>
                          <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 4, background: '#fef3c7', color: '#b45309' }}>
                            Đang giữ chỗ
                          </span>
                        </div>
                        <div style={{ fontSize: 12.5, color: '#64748b', marginTop: 4 }}>
                          Chờ thanh toán cọc: <strong style={{ color: '#b45309' }}>{money(depositDue)}</strong> · Hạn thanh toán: <strong>{holdTime}</strong>
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: 8 }}>
                      <Button className="sm" onClick={() => show({ type: 'order', id: o.id })}>
                        Xem chi tiết & Thu cọc
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </Panel>
        )}

        {/* SECTION 2: TODAY ORDERS (CHECK-IN) */}
        {(filter === 'ALL' || filter === 'TODAY') && todayOrders.length > 0 && (
          <Panel title={`🎾 Khách có lịch đến sân hôm nay — Sẵn sàng Check-in (${todayOrders.length})`}>
            <div style={{ display: 'grid', gap: 10 }}>
              {todayOrders.map(o => {
                const timeStr = formatSlotsTime(o.slots);
                const hasReferee = o.slots?.some(s => s.referee || s.hasReferee);
                return (
                  <div
                    key={o.id}
                    style={{
                      background: '#ffffff',
                      border: '1px solid #e2e8f0',
                      borderRadius: 10,
                      padding: '14px 18px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 16,
                      flexWrap: 'wrap'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                      <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#ecfdf5', color: '#059669', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                        <Calendar size={20} />
                      </div>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          <strong style={{ fontSize: 14.5, color: '#173c32' }}>{o.name || o.customerName}</strong>
                          <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 4, background: '#dcfce7', color: '#15803d' }}>
                            Đã cọc thành công
                          </span>
                          {hasReferee && (
                            <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 4, background: '#ede9fe', color: '#6d28d9' }}>
                              👨‍⚖️ Có Trọng tài
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: 12.5, color: '#64748b', marginTop: 4 }}>
                          Khung giờ: <strong style={{ color: '#0f172a' }}>{timeStr}</strong> · Điện thoại: {o.phone || o.customerPhone || 'Không có'}
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: 8 }}>
                      <Button className="primary sm" onClick={() => show({ type: 'order', id: o.id })}>
                        <UserCheck size={14} style={{ marginRight: 4 }} />
                        Check-in đón khách
                      </Button>
                      <Button className="sm" onClick={() => show({ type: 'order', id: o.id })}>
                        Xem đơn
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </Panel>
        )}

        {/* SECTION 3: IN USE ORDERS */}
        {(filter === 'ALL' || filter === 'IN_USE') && inUseOrders.length > 0 && (
          <Panel title={`🔥 Đang sử dụng sân — Chuẩn bị kết thúc & Check-out (${inUseOrders.length})`}>
            <div style={{ display: 'grid', gap: 10 }}>
              {inUseOrders.map(o => {
                const timeStr = formatSlotsTime(o.slots);
                const due = Math.max(0, (o.total || 0) - (o.paid || 0));
                return (
                  <div
                    key={o.id}
                    style={{
                      background: '#eff6ff',
                      border: '1px solid #bfdbfe',
                      borderRadius: 10,
                      padding: '14px 18px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 16,
                      flexWrap: 'wrap'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                      <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#dbeafe', color: '#2563eb', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                        <Flame size={20} />
                      </div>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          <strong style={{ fontSize: 14.5, color: '#173c32' }}>{o.name || o.customerName}</strong>
                          <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 4, background: '#dbeafe', color: '#1d4ed8' }}>
                            Đang thi đấu
                          </span>
                        </div>
                        <div style={{ fontSize: 12.5, color: '#64748b', marginTop: 4 }}>
                          Ca chơi: <strong>{timeStr}</strong> {due > 0 ? <>· Còn thiếu: <strong style={{ color: '#dc2626' }}>{money(due)}</strong></> : '· Đã thanh toán 100%'}
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: 8 }}>
                      <Button className="primary sm" onClick={() => show({ type: 'order', id: o.id })}>
                        Bàn giao & Check-out
                      </Button>
                      <Button className="sm" onClick={() => show({ type: 'order', id: o.id })}>
                        Chi tiết đơn
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </Panel>
        )}

        {/* SECTION 4: UNPAID ORDERS */}
        {(filter === 'ALL' || filter === 'UNPAID') && unpaidOrders.length > 0 && (
          <Panel title={`💳 Công nợ cần tất toán — Thu tiền tại quầy (${unpaidOrders.length})`}>
            <div style={{ display: 'grid', gap: 10 }}>
              {unpaidOrders.map(o => {
                const due = (o.total || 0) - (o.paid || 0);
                return (
                  <div
                    key={o.id}
                    style={{
                      background: '#fef2f2',
                      border: '1px solid #fee2e2',
                      borderRadius: 10,
                      padding: '14px 18px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 16,
                      flexWrap: 'wrap'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                      <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#fee2e2', color: '#dc2626', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                        <CreditCard size={20} />
                      </div>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          <strong style={{ fontSize: 14.5, color: '#173c32' }}>{o.name || o.customerName}</strong>
                          <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 4, background: '#fee2e2', color: '#b91c1c' }}>
                            Chưa tất toán
                          </span>
                        </div>
                        <div style={{ fontSize: 12.5, color: '#64748b', marginTop: 4 }}>
                          Ngày đơn: <strong>{o.date}</strong> · Còn nợ: <strong style={{ color: '#dc2626' }}>{money(due)}</strong>
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: 8 }}>
                      <Button className="primary sm" onClick={() => show({ type: 'order', id: o.id })}>
                        Thu tiền tại quầy
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </Panel>
        )}

        {/* SECTION 5: PENDING FEEDBACK */}
        {(filter === 'ALL' || filter === 'FEEDBACK') && pendingFeedbacks.length > 0 && (
          <Panel title={`💬 Đánh giá mới từ khách hàng (${pendingFeedbacks.length})`}>
            <div style={{ display: 'grid', gap: 10 }}>
              {pendingFeedbacks.map(f => (
                <div
                  key={f.id}
                  style={{
                    background: '#faf5ff',
                    border: '1px solid #f3e8ff',
                    borderRadius: 10,
                    padding: '14px 18px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 16,
                    flexWrap: 'wrap'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                    <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#f3e8ff', color: '#7c3aed', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                      <MessageSquare size={20} />
                    </div>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <strong style={{ fontSize: 14.5, color: '#173c32' }}>{f.displayName || f.author || 'Khách hàng'}</strong>
                        <span style={{ fontSize: 12, color: '#eab308' }}>{'★'.repeat(f.rating || 5)}</span>
                        <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 4, background: '#f3e8ff', color: '#6d28d9' }}>
                          Chờ duyệt & phản hồi
                        </span>
                      </div>
                      <p style={{ margin: '4px 0 0', fontSize: 13, color: '#475569', fontStyle: 'italic' }}>
                        "{f.message || f.content}"
                      </p>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 8 }}>
                    <Button className="sm" onClick={() => navigate('content')}>
                      Duyệt & Phản hồi
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </Panel>
        )}

        {/* EMPTY STATE */}
        {counts.ALL === 0 && (
          <div style={{ textAlign: 'center', padding: '60px 20px', background: '#ffffff', borderRadius: 12, border: '1px solid #e2e8f0' }}>
            <CheckCircle2 size={48} color="#10b981" style={{ margin: '0 auto 16px' }} />
            <h3 style={{ fontSize: 18, color: '#173c32', margin: '0 0 8px' }}>Mọi việc đã được xử lý chu toàn!</h3>
            <p style={{ fontSize: 13.5, color: '#64748b', margin: 0 }}>
              Không có đơn nào chờ cọc quá hạn hoặc công nợ tồn đọng trong ca trực hiện tại.
            </p>
          </div>
        )}
      </div>
    </>
  );
}
