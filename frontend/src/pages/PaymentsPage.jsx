import React, { useState, useEffect, useMemo } from 'react';
import { Wallet, RefreshCw, Trophy, ChartColumn, Users, ShieldAlert, Search, ChevronLeft, ChevronRight } from 'lucide-react';
import { useCourtly } from '../context';
import { Title, Stat, Panel, Table, Chip, Button, Tabs } from '../components/UI';
import { money, labels, localDate, dateLabel } from '../utils/format';
import { api } from '../services/api';

export default function PaymentsPage() {
  const { data, show, date, setDate } = useCourtly();
  const [tab, setTab] = useState('transactions');
  const [payConfig, setPayConfig] = useState(null);
  const [reconcile, setReconcile] = useState(null);
  const [recLoading, setRecLoading] = useState(false);

  // Filters & Pagination
  const [query, setQuery] = useState('');
  const [methodFilter, setMethodFilter] = useState('ALL');
  const [txPage, setTxPage] = useState(1);
  const [refundPage, setRefundPage] = useState(1);
  const pageSize = 15;

  useEffect(() => {
    fetch('/api/public/payment-config')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setPayConfig(d))
      .catch(() => {});
  }, []);

  const loadReconcile = () => {
    setRecLoading(true);
    api('/payments/reconciliation')
      .then(setReconcile)
      .catch(() => {})
      .finally(() => setRecLoading(false));
  };

  useEffect(() => {
    if (tab === 'reconciliation') {
      loadReconcile();
    }
  }, [tab]);

  const memPayments = (data.membershipPayments || []).map((m) => ({
    ...m,
    id: m.id,
    orderId: m.membershipId || '',
    type: 'MEMBERSHIP_FEE',
    refundable: 0,
    createdAt: m.createdAt,
    paidAt: m.createdAt,
    isMembership: true,
  }));
  const allPayments = useMemo(() => {
    return [...data.payments, ...memPayments].sort(
      (a, b) => new Date(b.createdAt || b.paidAt) - new Date(a.createdAt || a.paidAt)
    );
  }, [data.payments, memPayments]);

  const income = allPayments.reduce((a, p) => a + p.amount, 0);
  const refund = data.refunds.reduce((a, p) => a + p.amount, 0);
  const memTotal = memPayments.reduce((a, p) => a + p.amount, 0);
  const inDay = allPayments.filter((p) => localDate(p.createdAt || p.paidAt) === date);

  // Filtered Payments
  const filteredPayments = useMemo(() => {
    return allPayments.filter((p) => {
      if (methodFilter === 'CASH' && p.method !== 'CASH') return false;
      if (methodFilter === 'BANK_TRANSFER' && p.method !== 'BANK_TRANSFER') return false;
      if (methodFilter === 'MEMBERSHIP' && !p.isMembership) return false;
      if (query.trim()) {
        const q = query.toLowerCase();
        const code = (p.transactionCode || p.id || '').toLowerCase();
        const target = (p.orderId || p.registrationId || p.planName || '').toLowerCase();
        const cashier = (p.receivedBy?.name || '').toLowerCase();
        if (!code.includes(q) && !target.includes(q) && !cashier.includes(q)) return false;
      }
      return true;
    });
  }, [allPayments, methodFilter, query]);

  // Pagination for Payments
  const totalTxPages = Math.max(1, Math.ceil(filteredPayments.length / pageSize));
  const currentTxPage = Math.min(txPage, totalTxPages);
  const paginatedPayments = useMemo(() => {
    const start = (currentTxPage - 1) * pageSize;
    return filteredPayments.slice(start, start + pageSize);
  }, [filteredPayments, currentTxPage, pageSize]);

  // Pagination for Refunds
  const totalRefundPages = Math.max(1, Math.ceil(data.refunds.length / pageSize));
  const currentRefundPage = Math.min(refundPage, totalRefundPages);
  const paginatedRefunds = useMemo(() => {
    const start = (currentRefundPage - 1) * pageSize;
    return data.refunds.slice(start, start + pageSize);
  }, [data.refunds, currentRefundPage, pageSize]);

  return (
    <>
      <Title
        subtitle="Thu tiền mặt tại quầy, VietQR chuyển khoản, đối soát và lịch sử khoản hoàn."
        action={
          <Button className="primary" onClick={() => show({ type: 'payment' })}>
            Thu tiền tại quầy
          </Button>
        }
      >
        Thu tiền & hoàn tiền
      </Title>

      <div className="stats">
        <Stat title="Tổng đã thu" value={money(income)} note="Toàn bộ sân, giải & hội viên" icon={Wallet} />
        <Stat title="Tổng đã hoàn" value={money(refund)} note="Khoản hoàn ghi nhận" icon={RefreshCw} />
        <Stat title="Thu phí hội viên" value={money(memTotal)} note="Gói Club & Plus" icon={Users} />
        <Stat title="Thu ròng" value={money(income - refund)} note="Thu trừ hoàn" icon={ChartColumn} />
      </div>

      <Tabs
        options={[
          ['transactions', `Giao dịch (${allPayments.length})`],
          ['refunds', `Hoàn tiền (${data.refunds.length})`],
          ['closing', 'Đối chiếu ca'],
          ['reconciliation', 'Đối soát & Ngoại lệ'],
        ]}
        value={tab}
        onChange={setTab}
      />

      <Panel
        title={
          tab === 'refunds'
            ? `Lịch sử hoàn tiền (${data.refunds.length})`
            : tab === 'closing'
            ? 'Đối chiếu cuối ngày'
            : tab === 'reconciliation'
            ? 'Đối soát giao dịch ngân hàng & Ngoại lệ tài chính'
            : `Lịch sử giao dịch (${filteredPayments.length})`
        }
        action={
          tab === 'transactions' ? (
            <div className="tools" style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <select
                aria-label="Lọc phương thức"
                value={methodFilter}
                onChange={(e) => {
                  setMethodFilter(e.target.value);
                  setTxPage(1);
                }}
                style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 13 }}
              >
                <option value="ALL">Tất cả phương thức</option>
                <option value="CASH">Tiền mặt (CASH)</option>
                <option value="BANK_TRANSFER">Chuyển khoản (VietQR)</option>
                <option value="MEMBERSHIP">Phí hội viên</option>
              </select>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <Search size={15} style={{ position: 'absolute', left: 8, color: '#94a3b8' }} />
                <input
                  className="search"
                  style={{ paddingLeft: 28, width: 200 }}
                  placeholder="Mã giao dịch / Đơn..."
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setTxPage(1);
                  }}
                />
              </div>
            </div>
          ) : tab === 'closing' ? (
            <div className="tools">
              <input
                aria-label="Ngày đối chiếu"
                type="date"
                value={date}
                onChange={(e) => e.target.value && setDate(e.target.value)}
              />
              <Button className="sm" onClick={() => show({ type: 'closing' })}>
                In đối chiếu
              </Button>
            </div>
          ) : tab === 'reconciliation' ? (
            <div className="tools">
              <Button className="sm" onClick={loadReconcile} disabled={recLoading}>
                {recLoading ? 'Đang kiểm tra…' : 'Quét đối soát'}
              </Button>
            </div>
          ) : null
        }
      >
        {tab === 'transactions' && (
          <>
            <Table headings={['Giao dịch', 'Đơn / Đăng ký', 'Thu ngân', 'Loại thu', 'Phương thức', 'Số tiền', '']} empty={!paginatedPayments.length}>
              {paginatedPayments.map((p) => (
                <tr key={p.id}>
                  <td>
                    <b>{p.transactionCode || p.id.slice(0, 8)}</b>
                    <small>{new Date(p.createdAt || p.paidAt).toLocaleString('vi-VN')}</small>
                  </td>
                  <td>
                    {p.isMembership
                      ? p.planName
                        ? `Gói ${p.planName}`
                        : 'Hội viên'
                      : (p.orderId || p.registrationId || '').slice(0, 8)}
                  </td>
                  <td>
                    <small>{p.receivedBy?.name || 'Hệ thống / QR'}</small>
                  </td>
                  <td>
                    <Chip status={p.type} />
                  </td>
                  <td>{labels[p.method] || p.method}</td>
                  <td className="name">{money(p.amount)}</td>
                  <td>
                    <Button
                      className="sm"
                      disabled={p.refundable <= 0}
                      onClick={() => show({ type: 'refund', id: p.id })}
                    >
                      Hoàn tiền
                    </Button>
                  </td>
                </tr>
              ))}
            </Table>

            {totalTxPages > 1 && (
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '12px 18px',
                  borderTop: '1px solid #e2e8f0',
                  background: '#f8fafc',
                  fontSize: 13,
                  color: '#64748b'
                }}
              >
                <span>
                  Hiển thị <b>{(currentTxPage - 1) * pageSize + 1}</b> – <b>{Math.min(currentTxPage * pageSize, filteredPayments.length)}</b> trong số <b>{filteredPayments.length}</b> giao dịch
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Button
                    className="sm"
                    disabled={currentTxPage <= 1}
                    onClick={() => setTxPage((p) => Math.max(1, p - 1))}
                  >
                    <ChevronLeft size={14} style={{ marginRight: 2 }} /> Trước
                  </Button>
                  <span style={{ fontWeight: 600, color: '#1e293b', padding: '0 8px' }}>
                    Trang {currentTxPage} / {totalTxPages}
                  </span>
                  <Button
                    className="sm"
                    disabled={currentTxPage >= totalTxPages}
                    onClick={() => setTxPage((p) => Math.min(totalTxPages, p + 1))}
                  >
                    Sau <ChevronRight size={14} style={{ marginLeft: 2 }} />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}

        {tab === 'refunds' && (
          <>
            <Table headings={['Mã hoàn', 'Giao dịch', 'Số tiền', 'Lý do', 'Thời điểm']} empty={!paginatedRefunds.length}>
              {paginatedRefunds.map((r) => (
                <tr key={r.id}>
                  <td><b>{r.id.slice(0, 8)}</b></td>
                  <td>{r.paymentId.slice(0, 8)}</td>
                  <td style={{ color: '#b91c1c', fontWeight: 600 }}>−{money(r.amount)}</td>
                  <td>{r.reason}</td>
                  <td>{new Date(r.createdAt).toLocaleString('vi-VN')}</td>
                </tr>
              ))}
            </Table>

            {totalRefundPages > 1 && (
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '12px 18px',
                  borderTop: '1px solid #e2e8f0',
                  background: '#f8fafc',
                  fontSize: 13,
                  color: '#64748b'
                }}
              >
                <span>
                  Trang {currentRefundPage} / {totalRefundPages}
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Button
                    className="sm"
                    disabled={currentRefundPage <= 1}
                    onClick={() => setRefundPage((p) => Math.max(1, p - 1))}
                  >
                    Trước
                  </Button>
                  <Button
                    className="sm"
                    disabled={currentRefundPage >= totalRefundPages}
                    onClick={() => setRefundPage((p) => Math.min(totalRefundPages, p + 1))}
                  >
                    Sau
                  </Button>
                </div>
              </div>
            )}
          </>
        )}

        {tab === 'closing' && (
          <div className="panel-body">
            <p className="subtitle">{dateLabel(date)}</p>
            {['CASH', 'BANK_TRANSFER'].map((m) => (
              <div className="summary-line" key={m}>
                <span>
                  {labels[m] || m} • {inDay.filter((p) => p.method === m).length} giao dịch
                </span>
                <b>{money(inDay.filter((p) => p.method === m).reduce((a, p) => a + p.amount, 0))}</b>
              </div>
            ))}
            <div className="summary-line">
              <span>Đã hoàn trong ngày</span>
              <b>
                {money(
                  data.refunds
                    .filter((r) => localDate(r.createdAt) === date)
                    .reduce((a, r) => a + r.amount, 0)
                )}
              </b>
            </div>
            <div className="notice" style={{ marginTop: 16 }}>
              Báo cáo đối chiếu tổng hợp doanh thu theo ngày (đã bao gồm tiền mặt & chuyển khoản sân bãi, giải đấu và hội viên).
            </div>
          </div>
        )}

        {tab === 'reconciliation' && (
          <div className="panel-body">
            <h4 style={{ margin: '0 0 12px 0', display: 'flex', alignItems: 'center', gap: 8 }}>
              <ShieldAlert size={18} color="#e11d48" /> Ngoại lệ tài chính & Đơn cần xử lý ({reconcile?.count || 0})
            </h4>

            {/* Overpayments */}
            <div style={{ marginBottom: 20 }}>
              <h5 style={{ margin: '0 0 8px 0', color: '#b45309' }}>1. Khách chuyển thừa tiền ({reconcile?.overpayments?.length || 0})</h5>
              {(!reconcile?.overpayments || reconcile.overpayments.length === 0) ? (
                <div style={{ fontSize: 13, color: '#64748b' }}>Không có giao dịch thu thừa.</div>
              ) : (
                <Table headings={['Mã đơn', 'Khách hàng', 'Tổng tiền đơn', 'Đã thu', 'Thừa', 'Thao tác']}>
                  {reconcile.overpayments.map((o) => (
                    <tr key={o.orderId}>
                      <td>#{o.orderId.slice(0, 8)}</td>
                      <td>{o.customerName} <small>{o.customerPhone}</small></td>
                      <td>{money(o.total)}</td>
                      <td style={{ color: '#059669', fontWeight: 600 }}>{money(o.paid)}</td>
                      <td style={{ color: '#dc2626', fontWeight: 700 }}>+{money(o.excess)}</td>
                      <td>
                        <Button
                          className="sm"
                          onClick={() => show({ type: 'order', id: o.orderId })}
                        >
                          Xử lý hoàn tiền
                        </Button>
                      </td>
                    </tr>
                  ))}
                </Table>
              )}
            </div>

            {/* Cancelled Orders with Paid Balances */}
            <div style={{ marginBottom: 20 }}>
              <h5 style={{ margin: '0 0 8px 0', color: '#dc2626' }}>2. Đơn đã hủy còn tiền cọc chờ đối soát ({reconcile?.cancelledWithBalance?.length || 0})</h5>
              {(!reconcile?.cancelledWithBalance || reconcile.cancelledWithBalance.length === 0) ? (
                <div style={{ fontSize: 13, color: '#64748b' }}>Không có đơn hủy chờ xử lý tiền.</div>
              ) : (
                <Table headings={['Mã đơn', 'Khách hàng', 'Trạng thái', 'Tiền đã thu', 'Thao tác']}>
                  {reconcile.cancelledWithBalance.map((o) => (
                    <tr key={o.orderId}>
                      <td>#{o.orderId.slice(0, 8)}</td>
                      <td>{o.customerName} <small>{o.customerPhone}</small></td>
                      <td><Chip status={o.status} /></td>
                      <td style={{ fontWeight: 600 }}>{money(o.paid)}</td>
                      <td>
                        <Button
                          className="sm"
                          onClick={() => show({ type: 'order', id: o.orderId })}
                        >
                          Xem xét hoàn cọc
                        </Button>
                      </td>
                    </tr>
                  ))}
                </Table>
              )}
            </div>

            {/* Late Bank Inbound Transfers */}
            <div>
              <h5 style={{ margin: '0 0 8px 0', color: '#475569' }}>3. Tiền vào ngân hàng chưa gán đơn ({reconcile?.unmatchedTransfers?.length || 0})</h5>
              {(!reconcile?.unmatchedTransfers || reconcile.unmatchedTransfers.length === 0) ? (
                <div style={{ fontSize: 13, color: '#64748b' }}>Tất cả giao dịch chuyển khoản đều đã khớp đơn tự động.</div>
              ) : (
                <Table headings={['Mã giao dịch', 'Nội dung CK', 'Số tiền', 'Thời gian']}>
                  {reconcile.unmatchedTransfers.map((t) => (
                    <tr key={t.id}>
                      <td>{t.transactionCode || t.id}</td>
                      <td>{t.content}</td>
                      <td style={{ fontWeight: 600 }}>{money(t.amount)}</td>
                      <td>{t.createdAt}</td>
                    </tr>
                  ))}
                </Table>
              )}
            </div>
          </div>
        )}
      </Panel>
    </>
  );
}
