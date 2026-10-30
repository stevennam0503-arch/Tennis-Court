import React, { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight, Search, Calendar, Filter, ArrowDownLeft, ArrowUpRight } from 'lucide-react';
import { useCourtly } from '../context';
import { Title, Panel, Button, Chip, Table, Tabs } from '../components/UI';
import OrderActions, { canRent } from '../components/OrderActions';
import { money, labels, localDate, slotLabel } from '../utils/format';

const dateLabel = d => d?.split('-').reverse().join('/');
const timeLabel = d => d ? new Date(d).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }) : '—';

export function OrderTimeline({ order, courts }) {
  const events = order.history?.length ? order.history : [];
  const names = {
    CREATED: 'Tạo đơn đặt sân',
    SCHEDULE: 'Đổi lịch sân',
    CANCEL: 'Hủy lịch đặt',
    SERVICES: 'Thêm dịch vụ thuê',
    PRODUCTS: 'Thêm sản phẩm',
    STAFF: 'Thêm nhân sự',
    'CHECK-IN': 'Check-in',
    'CHECK-OUT': 'Hoàn tất buổi chơi',
    RETURN: 'Trả thiết bị',
    INVOICE: 'Xuất phiếu thu',
    EXPIRED: 'Hết hạn giữ chỗ'
  };
  const slots = e => `${dateLabel(e.date)} · ${e.slots?.map(s => `${courts.find(c => c.id === s.court)?.name || s.court} ${slotLabel(s)}`).join(', ')}`;
  if (!events.length) return <p className="notice">Đơn cũ chưa có nhật ký chi tiết. Các thông tin hiện tại vẫn được giữ nguyên.</p>;
  return (
    <ol className="order-timeline">
      {[...events].reverse().map(e => (
        <li key={e.id}>
          <div>
            <b>{names[e.type] || e.type}</b>
            <time>{timeLabel(e.at)}</time>
          </div>
          {e.type === 'SCHEDULE' && e.previous && <p><span>Trước: </span>{slots(e.previous)}</p>}
          <p>{slots(e)}</p>
          {e.total !== undefined && <small>Tổng đơn tại thời điểm này: {money(e.total)}</small>}
        </li>
      ))}
    </ol>
  );
}

export function MyHistory() {
  const { data, show, isAdmin } = useCourtly();
  const [query, setQuery] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const rows = useMemo(() => {
    return (data.orders || []).filter(o => {
      const targetStr = `${o.id} ${isAdmin ? o.name : ''} ${o.phone || ''}`.toLowerCase();
      if (query.trim() && !targetStr.includes(query.toLowerCase())) return false;
      if (from && o.date < from) return false;
      if (to && o.date > to) return false;
      if (status && o.status !== status) return false;
      return true;
    }).sort((a, b) => b.date.localeCompare(a.date));
  }, [data.orders, query, from, to, status, isAdmin]);

  const totalPages = Math.ceil(rows.length / pageSize) || 1;
  const currentPage = Math.min(page, totalPages);
  const paginatedOrders = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return rows.slice(start, start + pageSize);
  }, [rows, currentPage, pageSize]);

  return (
    <>
      <Title subtitle="Tra cứu mọi lịch đã đặt, kể cả đơn đã hủy hoặc hết hạn.">
        Lịch sử đặt sân
      </Title>

      <div className="history-filters" style={{ flexWrap: 'wrap', gap: 10, marginBottom: 16 }}>
        <label>
          {isAdmin ? 'Tên khách / mã đơn / SĐT' : 'Mã đơn'}
          <input
            value={query}
            onChange={e => {
              setQuery(e.target.value);
              setPage(1);
            }}
            placeholder="Tìm đơn đặt sân…"
          />
        </label>
        <label>
          Từ ngày
          <input
            type="date"
            value={from}
            onChange={e => {
              setFrom(e.target.value);
              setPage(1);
            }}
          />
        </label>
        <label>
          Đến ngày
          <input
            type="date"
            min={from}
            value={to}
            onChange={e => {
              setTo(e.target.value);
              setPage(1);
            }}
          />
        </label>
        <label>
          Trạng thái
          <select
            value={status}
            onChange={e => {
              setStatus(e.target.value);
              setPage(1);
            }}
          >
            <option value="">Tất cả trạng thái</option>
            {['HOLDING', 'CONFIRMED', 'CHECKED_IN', 'COMPLETED', 'CANCELLED', 'EXPIRED'].map(s => (
              <option key={s} value={s}>{labels[s]}</option>
            ))}
          </select>
        </label>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <p className="subtitle" style={{ margin: 0 }}>
          Tìm thấy <b>{rows.length}</b> lịch đặt phù hợp
        </p>
        {totalPages > 1 && (
          <span style={{ fontSize: 13, color: '#64748b' }}>
            Trang {currentPage} / {totalPages}
          </span>
        )}
      </div>

      <div className="history-list">
        {paginatedOrders.map(o => (
          <article className="customer-order" key={o.id}>
            <div className="customer-order-top">
              <div>
                <h2>{dateLabel(o.date)}</h2>
                <small>
                  #{o.id.slice(0, 8).toUpperCase()}
                  {isAdmin && o.name ? ` · ${o.name}` : ''}
                  {isAdmin && o.phone ? ` (${o.phone})` : ''}
                </small>
              </div>
              <Chip status={o.status} />
            </div>
            <p className="subtitle">
              {o.slots.map(s => `${data.courts.find(c => c.id === s.court)?.name || 'Sân'} · ${slotLabel(s)}`).join(' / ')}
            </p>
            {o.totalExtensionMinutes > 0 && (
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '3px 8px', borderRadius: 6, background: '#dbeafe', color: '#1e40af', fontSize: 12, fontWeight: 700, margin: '4px 0 8px' }}>
                ⚡ Đã gia hạn +{o.totalExtensionMinutes} phút chơi
              </div>
            )}
            {['CANCELLED','EXPIRED'].includes(o.status) && (
              (() => {
                const settlement = o.cancellationSettlement || o.metadata?.cancellationSettlement;
                const refunded = o.finance?.refunded || 0;
                const refundPending = o.finance?.refundPending || (settlement ? settlement.refundAmount : 0);
                const policyDesc = settlement?.policyDescription || (
                  settlement?.hoursBeforePlay !== undefined && settlement?.hoursBeforePlay !== null
                    ? (settlement.hoursBeforePlay >= 24 ? 'Hủy trước > 24h: Hoàn 100% cọc' : settlement.hoursBeforePlay >= 12 ? 'Hủy 12h - 24h: Hoàn 50% cọc' : 'Hủy cận giờ < 12h: Giữ 100% cọc')
                    : 'Chính sách hoàn cọc'
                );
                const retained = settlement?.retainedAmount || 0;
                return (
                  <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: '10px 12px', margin: '8px 0', fontSize: 12.5 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4, flexWrap: 'wrap', gap: 4 }}>
                      <strong style={{ color: '#1e40af' }}>⚖️ {policyDesc}</strong>
                      <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 6px', borderRadius: 4, background: refunded > 0 ? '#dcfce7' : (refundPending > 0 ? '#fef3c7' : '#f1f5f9'), color: refunded > 0 ? '#166534' : (refundPending > 0 ? '#b45309' : '#64748b') }}>
                        {refunded > 0 ? '✓ Đã hoàn tiền' : (refundPending > 0 ? '⏳ Chờ hoàn tiền' : 'Giữ cọc')}
                      </span>
                    </div>
                    {o.paid > 0 && (
                      <div style={{ display: 'flex', gap: 14, color: '#475569', fontSize: 12, marginTop: 4, flexWrap: 'wrap' }}>
                        <span>Đã thu: <b>{money(o.paid)}</b></span>
                        {refunded > 0 ? (
                          <span style={{ color: '#166534' }}>Đã hoàn: <b>{money(refunded)}</b></span>
                        ) : (
                          <span style={{ color: refundPending > 0 ? '#d97706' : '#64748b' }}>Được hoàn: <b>{money(refundPending)}</b></span>
                        )}
                        {retained > 0 && <span style={{ color: '#b91c1c' }}>Khấu trừ: <b>{money(retained)}</b></span>}
                      </div>
                    )}
                  </div>
                );
              })()
            )}
            <OrderActions order={o} />
            <details className="history-details">
              <summary>Xem các lần cập nhật</summary>
              <OrderTimeline order={o} courts={data.courts} />
            </details>
          </article>
        ))}
      </div>

      {!rows.length && (
        <p className="empty">Chưa có lịch đặt trong khoảng đã chọn.</p>
      )}

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 16px',
          marginTop: 16,
          borderRadius: 8,
          border: '1px solid #e2e8f0',
          background: '#f8fafc',
          fontSize: 13,
          color: '#64748b'
        }}>
          <div>
            Hiển thị <b>{(currentPage - 1) * pageSize + 1}</b> - <b>{Math.min(currentPage * pageSize, rows.length)}</b> trong tổng số <b>{rows.length}</b> đơn
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
    </>
  );
}

export function MyPayments() {
  const { data, show, isAdmin, navigate } = useCourtly();
  const allPayments = useMemo(() => [
    ...data.payments,
    ...(data.membershipPayments || []).map(p => ({ ...p, type: 'MEMBERSHIP_FEE' }))
  ], [data.payments, data.membershipPayments]);

  const [query, setQuery] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [kindFilter, setKindFilter] = useState('ALL'); // 'ALL' | 'PAYMENT' | 'REFUND'
  const [methodFilter, setMethodFilter] = useState('ALL');
  const [page, setPage] = useState(1);
  const pageSize = 15;

  const received = allPayments.reduce((n, p) => n + (p.amount || 0), 0);
  const refunded = (data.refunds || []).reduce((n, p) => n + (p.amount || 0), 0);

  const rows = useMemo(() => {
    const combined = [
      ...allPayments.map(p => ({ ...p, kind: 'PAYMENT' })),
      ...(data.refunds || []).map(r => {
        const p = data.payments.find(x => x.id === r.paymentId);
        return {
          ...r,
          kind: 'REFUND',
          orderId: p?.orderId,
          registrationId: p?.registrationId,
          method: p?.method
        };
      })
    ];

    return combined.filter(p => {
      if (kindFilter === 'PAYMENT' && p.kind !== 'PAYMENT') return false;
      if (kindFilter === 'REFUND' && p.kind !== 'REFUND') return false;
      if (kindFilter === 'DEPOSIT' && (p.kind !== 'PAYMENT' || p.type !== 'DEPOSIT')) return false;
      if (kindFilter === 'BALANCE' && (p.kind !== 'PAYMENT' || (p.type !== 'BALANCE' && p.type !== 'ORDER' && p.type !== undefined))) return false;
      if (kindFilter === 'OTHER' && (p.kind !== 'PAYMENT' || !['TOURNAMENT_FEE', 'MEMBERSHIP_FEE'].includes(p.type))) return false;
      if (methodFilter !== 'ALL' && p.method !== methodFilter) return false;
      if (from && localDate(p.createdAt) < from) return false;
      if (to && localDate(p.createdAt) > to) return false;

      if (query.trim()) {
        const orderName = isAdmin && p.orderId ? (data.orders.find(o => o.id === p.orderId)?.name || '') : '';
        const targetStr = `${p.id} ${p.orderId || ''} ${p.transactionCode || ''} ${orderName}`.toLowerCase();
        if (!targetStr.includes(query.toLowerCase())) return false;
      }

      return true;
    }).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [allPayments, data.refunds, data.payments, data.orders, kindFilter, methodFilter, from, to, query, isAdmin]);

  const totalPages = Math.ceil(rows.length / pageSize) || 1;
  const currentPage = Math.min(page, totalPages);
  const paginatedRows = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return rows.slice(start, start + pageSize);
  }, [rows, currentPage, pageSize]);

  return (
    <>
      <Title subtitle={isAdmin ? 'Tra cứu giao dịch của mọi khách hàng, bao gồm khoản thu và hoàn tiền.' : 'Các khoản thực tế đã được quầy ghi nhận cho tài khoản của bạn.'}>
        Lịch sử thanh toán
      </Title>

      <div className="payment-summary" style={{ marginBottom: 16 }}>
        <div>
          <small>Tổng đã thanh toán</small>
          <b>{money(received)}</b>
        </div>
        <div>
          <small>Tổng đã hoàn</small>
          <b style={{ color: '#b91c1c' }}>{money(refunded)}</b>
        </div>
        <div>
          <small>Thanh toán sau hoàn</small>
          <b style={{ color: '#047857' }}>{money(received - refunded)}</b>
        </div>
      </div>

      {/* Filter Row */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 10,
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 16
      }}>
        {/* Kind tabs */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {[
            { id: 'ALL', label: `Tất cả (${rows.length})` },
            { id: 'DEPOSIT', label: 'Tiền cọc' },
            { id: 'BALANCE', label: 'Thanh toán đơn' },
            { id: 'REFUND', label: 'Hoàn tiền' },
            { id: 'OTHER', label: 'Giải & Hội viên' }
          ].map(k => (
            <button
              key={k.id}
              type="button"
              className={`filter-chip ${kindFilter === k.id ? 'active' : ''}`}
              onClick={() => {
                setKindFilter(k.id);
                setPage(1);
              }}
              style={{
                padding: '6px 14px',
                borderRadius: 20,
                border: kindFilter === k.id ? '1px solid #1e293b' : '1px solid #e2e8f0',
                background: kindFilter === k.id ? '#1e293b' : '#ffffff',
                color: kindFilter === k.id ? '#ffffff' : '#475569',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              {k.label}
            </button>
          ))}
        </div>

        {/* Date & Search */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <select
            value={methodFilter}
            onChange={e => {
              setMethodFilter(e.target.value);
              setPage(1);
            }}
            style={{
              padding: '6px 10px',
              borderRadius: 8,
              border: '1px solid #cbd5e1',
              fontSize: 13,
              background: '#ffffff'
            }}
          >
            <option value="ALL">Tất cả phương thức</option>
            <option value="CASH">Tiền mặt</option>
            <option value="BANK_TRANSFER">Chuyển khoản VietQR</option>
            <option value="MEMBERSHIP">Hội viên</option>
          </select>

          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <input
              type="date"
              value={from}
              onChange={e => { setFrom(e.target.value); setPage(1); }}
              style={{ height: 34, padding: '4px 8px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 13 }}
            />
            <span style={{ color: '#94a3b8' }}>-</span>
            <input
              type="date"
              min={from}
              value={to}
              onChange={e => { setTo(e.target.value); setPage(1); }}
              style={{ height: 34, padding: '4px 8px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 13 }}
            />
          </div>

          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <Search size={14} style={{ position: 'absolute', left: 10, color: '#94a3b8' }} />
            <input
              aria-label="Tìm giao dịch"
              placeholder={isAdmin ? 'Tìm khách, mã đơn, mã GD...' : 'Mã đơn hoặc mã giao dịch...'}
              value={query}
              onChange={e => { setQuery(e.target.value); setPage(1); }}
              style={{
                height: 34,
                paddingLeft: 30,
                paddingRight: 10,
                borderRadius: 6,
                border: '1px solid #cbd5e1',
                fontSize: 13,
                width: 200
              }}
            />
          </div>
        </div>
      </div>

      <Panel
        title={`Lịch sử thu & hoàn tiền (${rows.length})`}
        action={
          <span style={{ fontSize: 13, color: '#64748b' }}>
            Trang {currentPage} / {totalPages}
          </span>
        }
      >
        <Table headings={['Thời điểm', 'Phân loại', 'Số tiền', 'Phương thức', 'Trạng thái', 'Đơn / Đối tượng']} empty={!paginatedRows.length}>
          {paginatedRows.map(p => (
            <tr key={p.kind + p.id}>
              <td>
                {timeLabel(p.createdAt)}
                <small style={{ display: 'block', color: '#64748b', fontFamily: 'monospace' }}>
                  {p.transactionCode || p.id}
                </small>
              </td>
              <td>
                {p.kind === 'REFUND' ? (
                  <span style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    fontSize: 11.5,
                    fontWeight: 700,
                    padding: '3px 8px',
                    borderRadius: 6,
                    background: '#fee2e2',
                    color: '#b91c1c'
                  }}>
                    <ArrowDownLeft size={13} /> Hoàn tiền
                  </span>
                ) : p.type === 'DEPOSIT' ? (
                  <span style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    fontSize: 11.5,
                    fontWeight: 700,
                    padding: '3px 8px',
                    borderRadius: 6,
                    background: '#fef3c7',
                    color: '#b45309'
                  }}>
                    <ArrowUpRight size={13} /> Tiền cọc (50%)
                  </span>
                ) : p.type === 'MEMBERSHIP_FEE' ? (
                  <span style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    fontSize: 11.5,
                    fontWeight: 700,
                    padding: '3px 8px',
                    borderRadius: 6,
                    background: '#dcfce7',
                    color: '#15803d'
                  }}>
                    <ArrowUpRight size={13} /> Phí hội viên
                  </span>
                ) : p.type === 'TOURNAMENT_FEE' ? (
                  <span style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    fontSize: 11.5,
                    fontWeight: 700,
                    padding: '3px 8px',
                    borderRadius: 6,
                    background: '#f3e8ff',
                    color: '#7e22ce'
                  }}>
                    <ArrowUpRight size={13} /> Phí giải đấu
                  </span>
                ) : (
                  <span style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    fontSize: 11.5,
                    fontWeight: 700,
                    padding: '3px 8px',
                    borderRadius: 6,
                    background: '#e0f2fe',
                    color: '#0369a1'
                  }}>
                    <ArrowUpRight size={13} /> Thanh toán đơn
                  </span>
                )}
              </td>
              <td style={{ fontWeight: 700, color: p.kind === 'REFUND' ? '#b91c1c' : '#15803d' }}>
                {p.kind === 'REFUND' ? '−' : '+'}{money(p.amount)}
              </td>
              <td>{labels[p.method] || p.method || '—'}</td>
              <td>
                {p.kind === 'REFUND' ? (
                  <div>
                    <span style={{
                      display: 'inline-block',
                      fontSize: 11,
                      fontWeight: 700,
                      padding: '2px 8px',
                      borderRadius: 6,
                      background: '#fee2e2',
                      color: '#991b1b'
                    }}>
                      {p.status === 'DONE' || !p.status ? '✓ Đã hoàn tiền' : 'Chờ quầy xử lý'}
                    </span>
                    {p.reason && (
                      <small style={{ display: 'block', color: '#64748b', marginTop: 2 }}>
                        {p.reason}
                      </small>
                    )}
                  </div>
                ) : (
                  <div>
                    <span style={{
                      display: 'inline-block',
                      fontSize: 11,
                      fontWeight: 700,
                      padding: '2px 8px',
                      borderRadius: 6,
                      background: '#dcfce7',
                      color: '#166534'
                    }}>
                      ✓ Đã thu tiền
                    </span>
                    {p.orderId && (() => {
                      const ord = data.orders.find(o => o.id === p.orderId);
                      return ord ? (
                        <small style={{ display: 'block', color: '#64748b', marginTop: 2 }}>
                          Đơn: <b>{labels[ord.status] || ord.status}</b>
                        </small>
                      ) : null;
                    })()}
                  </div>
                )}
              </td>
              <td>
                {isAdmin && p.orderId && (
                  <small style={{ display: 'block', fontWeight: 600, color: '#1e293b' }}>
                    {data.orders.find(o => o.id === p.orderId)?.name}
                  </small>
                )}
                {p.membershipId ? (
                  <Button className="sm" onClick={() => navigate(isAdmin ? 'membership' : 'profile-membership')}>
                    {p.planName || 'Membership'}
                  </Button>
                ) : p.orderId ? (
                  <Button className="sm" onClick={() => show({ type: 'order', id: p.orderId })}>
                    #{p.orderId.slice(0, 8).toUpperCase()}
                  </Button>
                ) : (
                  <Button className="sm" onClick={() => show({ type: 'tournament', id: data.registrations.find(r => r.id === p.registrationId)?.tournamentId })}>
                    {data.registrations.find(r => r.id === p.registrationId)?.name || 'Đăng ký giải'}
                  </Button>
                )}
              </td>
            </tr>
          ))}
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
              Hiển thị <b>{(currentPage - 1) * pageSize + 1}</b> - <b>{Math.min(currentPage * pageSize, rows.length)}</b> trong tổng số <b>{rows.length}</b> giao dịch
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

      <p className="notice" style={{ marginTop: 20 }}>
        Hủy lịch không tự chuyển tiền hoàn về ngân hàng. Khoản hoàn chỉ xuất hiện sau khi quầy xử lý và đối chiếu thực tế.
      </p>
    </>
  );
}

export function MyServices() {
  const { data, show, navigate, isAdmin } = useCourtly();
  const [tab, setTab] = useState('available');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const eligible = (data.orders || []).filter(canRent);
  const rented = (data.orders || []).filter(o => (o.staff || []).length > 0);

  const orders = useMemo(() => {
    return (tab === 'available' ? eligible : rented).filter(o => {
      const targetStr = `${o.id} ${o.date} ${isAdmin ? o.name : ''}`.toLowerCase();
      return targetStr.includes(query.toLowerCase());
    }).sort((a, b) => tab === 'available' ? a.date.localeCompare(b.date) : b.date.localeCompare(a.date));
  }, [tab, eligible, rented, query, isAdmin]);

  const totalPages = Math.ceil(orders.length / pageSize) || 1;
  const currentPage = Math.min(page, totalPages);
  const paginatedOrders = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return orders.slice(start, start + pageSize);
  }, [orders, currentPage, pageSize]);

  return (
    <>
      <Title
        subtitle={isAdmin ? 'Phân công trọng tài theo sân và khung giờ của từng đơn.' : 'Chọn trọng tài cho lịch sân của bạn. Xem giá trước khi xác nhận.'}
        action={<Button onClick={() => navigate('orders')}>Xem đơn hàng</Button>}
      >
        Dịch vụ trọng tài
      </Title>

      <div className="rental-intro">
        <article>
          <h2>Thuê trọng tài chuyên nghiệp</h2>
          <p>Trọng tài có chứng chỉ VTF, chấm điểm chuẩn xác cho các trận giao hữu và giải đấu. Chi phí tính theo số giờ thi đấu.</p>
        </article>
      </div>

      {isAdmin && (
        <div className="step-row" style={{ marginBottom: 16 }}>
          <Button onClick={() => navigate('staff')}>Quản lý trọng tài & lịch trực</Button>
        </div>
      )}

      <Tabs
        value={tab}
        onChange={t => {
          setTab(t);
          setPage(1);
        }}
        options={[
          ['available', `Đặt thêm dịch vụ (${eligible.length})`],
          ['rented', `Lịch sử thuê (${rented.length})`]
        ]}
      />

      <div className="history-filters" style={{ marginBottom: 16 }}>
        <label>
          {isAdmin ? 'Tìm khách, mã đơn hoặc ngày' : 'Tìm mã đơn hoặc ngày'}
          <input
            value={query}
            onChange={e => {
              setQuery(e.target.value);
              setPage(1);
            }}
            placeholder="Tìm đơn thuê…"
          />
        </label>
      </div>

      <div className="history-list">
        {paginatedOrders.map(o => (
          <article className="customer-order" key={o.id}>
            <div className="customer-order-top">
              <div>
                <h2>{dateLabel(o.date)}</h2>
                <small>#{o.id.slice(0, 8).toUpperCase()}{isAdmin ? ` · ${o.name}` : ''}</small>
              </div>
              <Chip status={o.status} />
            </div>
            <p className="subtitle">
              {o.slots.map(s => `${data.courts.find(c => c.id === s.court)?.name || 'Sân'} ${slotLabel(s)}`).join(' / ')}
            </p>
            {(o.staff || []).map(st => (
              <div className="order-line" key={st.id}>
                <span>{st.name} · {st.hours} giờ</span>
                <b>{money((st.rate || 0) * (st.hours || 1))}</b>
              </div>
            ))}
            <OrderActions order={o} />
          </article>
        ))}
      </div>

      {!orders.length && (
        <div className="empty">
          <h3>{query ? 'Không tìm thấy đơn phù hợp' : tab === 'rented' ? 'Chưa có lịch sử thuê dịch vụ' : 'Chưa có lịch sân phù hợp để thuê'}</h3>
          <p>{tab === 'available' ? 'Cần có đơn sắp tới, chưa check-in. Chọn lịch sân trước để kiểm tra trọng tài còn trống.' : 'Dịch vụ sau khi xác nhận sẽ được lưu cùng đơn đặt sân tại đây.'}</p>
          {tab === 'available' && <Button className="primary" onClick={() => navigate('calendar')}>Đặt sân</Button>}
        </div>
      )}

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 16px',
          marginTop: 16,
          borderRadius: 8,
          border: '1px solid #e2e8f0',
          background: '#f8fafc',
          fontSize: 13,
          color: '#64748b'
        }}>
          <div>
            Hiển thị <b>{(currentPage - 1) * pageSize + 1}</b> - <b>{Math.min(currentPage * pageSize, orders.length)}</b> trong tổng số <b>{orders.length}</b> đơn
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
    </>
  );
}
