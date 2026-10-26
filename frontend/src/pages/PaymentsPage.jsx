import React, { useState, useEffect } from 'react';
import { Wallet, RefreshCw, Trophy, ChartColumn, Users, ShieldAlert } from 'lucide-react';
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
  const allPayments = [...data.payments, ...memPayments].sort(
    (a, b) => new Date(b.createdAt || b.paidAt) - new Date(a.createdAt || a.paidAt)
  );

  const income = allPayments.reduce((a, p) => a + p.amount, 0);
  const refund = data.refunds.reduce((a, p) => a + p.amount, 0);
  const memTotal = memPayments.reduce((a, p) => a + p.amount, 0);
  const inDay = allPayments.filter((p) => localDate(p.createdAt || p.paidAt) === date);

  return (
    <>
      <Title
        subtitle="Tiền mặt, chuyển khoản VietQR, đối soát và lịch sử khoản hoàn."
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
          ['transactions', 'Giao dịch'],
          ['refunds', 'Hoàn tiền'],
          ['closing', 'Đối chiếu ca'],
          ['reconciliation', 'Đối soát & Ngoại lệ'],
        ]}
        value={tab}
        onChange={setTab}
      />
      <Panel
        title={
          tab === 'refunds'
            ? 'Lịch sử hoàn tiền'
            : tab === 'closing'
            ? 'Đối chiếu cuối ngày'
            : tab === 'reconciliation'
            ? 'Đối soát giao dịch ngân hàng & Ngoại lệ tài chính'
            : 'Lịch sử giao dịch'
        }
        action={
          tab === 'closing' ? (
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
          <Table headings={['Giao dịch', 'Đơn / Đăng ký', 'Thu ngân', 'Loại thu', 'Phương thức', 'Số tiền', '']} empty={!allPayments.length}>
            {allPayments.map((p) => (
              <tr key={p.id}>
                <td>
                  {p.id.slice(0, 8)}
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
        )}
        {tab === 'refunds' && (
          <Table headings={['Mã hoàn', 'Giao dịch', 'Số tiền', 'Lý do', 'Thời điểm']} empty={!data.refunds.length}>
            {data.refunds.map((r) => (
              <tr key={r.id}>
                <td>{r.id.slice(0, 8)}</td>
                <td>{r.paymentId.slice(0, 8)}</td>
                <td>{money(r.amount)}</td>
                <td>{r.reason}</td>
                <td>{new Date(r.createdAt).toLocaleString('vi-VN')}</td>
              </tr>
            ))}
          </Table>
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
            <div className="notice">
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
                        <Button className="sm" onClick={() => show({ type: 'order', id: o.orderId })}>
                          Xem đơn & Xử lý
                        </Button>
                      </td>
                    </tr>
                  ))}
                </Table>
              )}
            </div>

            {/* Pending refunds */}
            <div style={{ marginBottom: 20 }}>
              <h5 style={{ margin: '0 0 8px 0', color: '#1d4ed8' }}>2. Đơn chờ hoàn tiền theo chính sách ({reconcile?.pendingRefunds?.length || 0})</h5>
              {(!reconcile?.pendingRefunds || reconcile.pendingRefunds.length === 0) ? (
                <div style={{ fontSize: 13, color: '#64748b' }}>Không có yêu cầu hoàn tiền đang chờ.</div>
              ) : (
                <Table headings={['Mã đơn', 'Khách hàng', 'Trạng thái', 'Tiền hoàn chờ xử lý', 'Lý do', 'Thao tác']}>
                  {reconcile.pendingRefunds.map((o) => (
                    <tr key={o.orderId}>
                      <td>#{o.orderId.slice(0, 8)}</td>
                      <td>{o.customerName} <small>{o.customerPhone}</small></td>
                      <td><Chip status={o.status} /></td>
                      <td style={{ color: '#0284c7', fontWeight: 700 }}>{money(o.refundPending)}</td>
                      <td>{o.reason}</td>
                      <td>
                        <Button className="sm" onClick={() => show({ type: 'order', id: o.orderId })}>
                          Xem & Hoàn tiền
                        </Button>
                      </td>
                    </tr>
                  ))}
                </Table>
              )}
            </div>

            {/* Late payments */}
            <div>
              <h5 style={{ margin: '0 0 8px 0', color: '#6b7280' }}>3. Đơn đã hủy / hết hạn có tiền vào ({reconcile?.latePayments?.length || 0})</h5>
              {(!reconcile?.latePayments || reconcile.latePayments.length === 0) ? (
                <div style={{ fontSize: 13, color: '#64748b' }}>Không có khoản tiền vào sau khi hủy/hết hạn.</div>
              ) : (
                <Table headings={['Mã đơn', 'Khách hàng', 'Trạng thái', 'Số tiền đã nhận', 'Thao tác']}>
                  {reconcile.latePayments.map((o) => (
                    <tr key={o.orderId}>
                      <td>#{o.orderId.slice(0, 8)}</td>
                      <td>{o.customerName} <small>{o.customerPhone}</small></td>
                      <td><Chip status={o.status} /></td>
                      <td style={{ color: '#059669', fontWeight: 600 }}>{money(o.paid)}</td>
                      <td>
                        <Button className="sm" onClick={() => show({ type: 'order', id: o.orderId })}>
                          Xem đơn
                        </Button>
                      </td>
                    </tr>
                  ))}
                </Table>
              )}
            </div>
          </div>
        )}
      </Panel>
      <div
        className="notice"
        style={{
          marginTop: 20,
          background: payConfig?.mode === 'LIVE' ? '#e8f5e9' : '#eff6ff',
          borderColor: payConfig?.mode === 'LIVE' ? '#a5d6a7' : '#bfdbfe',
          color: payConfig?.mode === 'LIVE' ? '#1b5e20' : '#1e40af',
        }}
      >
        {payConfig?.mode === 'LIVE' ? (
          <>
            ✓ <b>Cổng thanh toán VietQR Napas 24/7 ({payConfig.bankName || 'MB Bank'}) đang hoạt động [LIVE].</b> Tự động khớp lệnh qua webhook SePay.
          </>
        ) : payConfig?.mode === 'SANDBOX' ? (
          <>
            ⚡ <b>Chế độ Sandbox thử nghiệm ({payConfig?.bankName || 'MB Bank'}).</b> Webhook mô phỏng đang bật để kiểm thử đối soát giao dịch.
          </>
        ) : (
          <>
            ℹ <b>Chế độ Demo nội bộ ({payConfig?.bankName || 'MB Bank'}).</b> Hỗ trợ mô phỏng thanh toán chuyển khoản và thu tiền mặt tại quầy.
          </>
        )}
      </div>
    </>
  );
}
