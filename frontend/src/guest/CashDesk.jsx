import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { useGuest, Action, Empty, State, money, requestId } from './context';

export default function CashDesk() {
  const { t, user } = useGuest();
  const [rows, setRows] = useState([]);
  const [selected, setSelected] = useState('');
  const [amount, setAmount] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [receipt, setReceipt] = useState(null);
  const [transaction, setTransaction] = useState(requestId);

  // Shift state
  const [shiftOpen, setShiftOpen] = useState(false);
  const [shiftData, setShiftData] = useState(null);
  const [startingCash, setStartingCash] = useState(1000000);
  const [actualCash, setActualCash] = useState('');
  const [shiftNote, setShiftNote] = useState('');
  const [shiftReport, setShiftReport] = useState(null);

  const allowed = ['ADMIN', 'STAFF'].includes(user?.role);
  const load = () => api('/payments/cash-desk').then(setRows);

  useEffect(() => {
    if (allowed) load().catch((e) => setError(e.message));
  }, [allowed]);

  const order = rows.find((o) => o.id === selected);

  const submit = async (e) => {
    e.preventDefault();
    if (!order) return;
    setBusy(true);
    setError('');
    try {
      const r = await api('/payments', 'POST', {
        orderId: order.id,
        amount: Number(amount),
        method: 'CASH',
        transactionCode: transaction,
      });
      setReceipt({
        id: r.id,
        orderId: order.id,
        customerName: order.name,
        amount: Number(amount),
        cashier: user?.fullName || user?.name || user?.email || 'Thu ngân',
        time: new Date().toLocaleString('vi-VN'),
        transactionCode: transaction,
      });
      setSelected('');
      setAmount('');
      setTransaction(requestId());
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const openShiftModal = async () => {
    setError('');
    try {
      const data = await api('/payments/shift/current');
      setShiftData(data);
      setShiftOpen(true);
      setShiftReport(null);
    } catch (e) {
      setError(e.message);
    }
  };

  const handleCloseShift = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const report = await api('/payments/shift/close', 'POST', {
        startingCash: Number(startingCash) || 0,
        actualCash: Number(actualCash) || 0,
        note: shiftNote,
      });
      setShiftReport(report);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  if (!allowed)
    return (
      <section className="ct-pad">
        <h1>{t('Thu tiền tại quầy')}</h1>
        <Empty>{t('Chỉ nhân viên thu ngân và quản trị được truy cập.')}</Empty>
      </section>
    );

  const expectedCash = (Number(startingCash) || 0) + (shiftData?.cashCollected || 0);
  const difference = (Number(actualCash) || 0) - expectedCash;

  return (
    <section className="ct-pad">
      <div className="gx-heading" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1>{t('Thu tiền mặt tại quầy')}</h1>
          <p>{t('Chỉ xác nhận sau khi đã nhận đủ số tiền nhập bên dưới. Chuyển khoản do ngân hàng xác minh tự động.')}</p>
        </div>
        <div>
          <button type="button" className="ct-outline" style={{ padding: '8px 16px', fontWeight: 600 }} onClick={openShiftModal}>
            💼 {t('Chốt ca thu ngân')}
          </button>
        </div>
      </div>

      <form className="gx-form" onSubmit={submit}>
        <label>
          {t('Chọn đơn')}
          <select
            aria-label={t('Chọn đơn')}
            required
            value={selected}
            onChange={(e) => {
              const o = rows.find((x) => x.id === e.target.value);
              setSelected(e.target.value);
              setAmount(o ? Math.min(o.due, Math.max(0, o.deposit - o.paid) || o.due) : '');
              setTransaction(requestId());
              setReceipt(null);
            }}
          >
            <option value="">{t('Chọn đơn cần thu')}</option>
            {rows.map((o) => (
              <option key={o.id} value={o.id}>
                #{o.id.slice(0, 8)} · {o.name} · {money(o.due)}
              </option>
            ))}
          </select>
        </label>

        {order && (
          <p>
            <State value={order.status} /> · {t('Đã thu')}: {money(order.paid)} · {t('Còn thiếu')}: {money(order.due)}
          </p>
        )}

        <label>
          {t('Số tiền mặt thực nhận (VND)')}
          <input
            required
            type="number"
            min="1"
            step="1"
            max={order?.due}
            value={amount}
            onChange={(e) => {
              setAmount(e.target.value);
              setTransaction(requestId());
            }}
          />
        </label>

        <label className="gx-check">
          <input required type="checkbox" key={selected + transaction} />
          {t('Tôi đã nhận tiền mặt và kiểm tra đúng đơn, đúng số tiền.')}
        </label>

        {error && (
          <div className="gx-error" role="alert">
            {t(error)}
          </div>
        )}

        {/* Printable Receipt Card after collection */}
        {receipt && (
          <div
            style={{
              padding: 20,
              background: '#f8fafc',
              border: '2px dashed #0284c7',
              borderRadius: 8,
              marginTop: 16,
              marginBottom: 16,
            }}
          >
            <div style={{ textAlign: 'center', borderBottom: '1px solid #cbd5e1', paddingBottom: 10, marginBottom: 12 }}>
              <h3 style={{ margin: 0, color: '#0f172a' }}>CLB TENNIS COURTLY</h3>
              <div style={{ fontSize: 13, color: '#64748b' }}>PHIẾU THU TIỀN MẶT TẠI QUẦY</div>
            </div>
            <div style={{ fontSize: 14, lineHeight: 1.8 }}>
              <div><b>Mã phiếu thu:</b> #{receipt.id.slice(0, 8)}</div>
              <div><b>Mã đơn đặt sân:</b> #{receipt.orderId.slice(0, 8)}</div>
              <div><b>Khách hàng:</b> {receipt.customerName}</div>
              <div><b>Số tiền thu:</b> <span style={{ fontSize: 18, color: '#059669', fontWeight: 700 }}>{money(receipt.amount)}</span></div>
              <div><b>Thu ngân:</b> {receipt.cashier}</div>
              <div><b>Thời gian:</b> {receipt.time}</div>
            </div>
            <div style={{ marginTop: 14, display: 'flex', gap: 10 }}>
              <button
                type="button"
                className="ct-primary"
                style={{ padding: '6px 14px', fontSize: 13 }}
                onClick={() => window.print()}
              >
                🖨️ In phiếu thu
              </button>
              <button
                type="button"
                className="ct-outline"
                style={{ padding: '6px 14px', fontSize: 13 }}
                onClick={() => setReceipt(null)}
              >
                Đóng
              </button>
            </div>
          </div>
        )}

        <div style={{ display: 'flex', gap: 10 }}>
          <Action type="submit" disabled={busy || !order}>
            {t(busy ? 'Đang xử lý…' : 'Xác nhận tiền mặt đã thu')}
          </Action>
          <Action secondary disabled={busy} onClick={() => load().catch((e) => setError(e.message))}>
            {t('Làm mới')}
          </Action>
        </div>
      </form>

      {/* Shift Closing Modal (Module 35) */}
      {shiftOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: 16,
          }}
          onClick={() => setShiftOpen(false)}
        >
          <div
            style={{
              background: '#fff',
              borderRadius: 12,
              padding: 24,
              maxWidth: 520,
              width: '100%',
              maxHeight: '90vh',
              overflowY: 'auto',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: 12, marginBottom: 16 }}>
              <h2 style={{ margin: 0, fontSize: 18 }}>💼 Chốt ca thu ngân & Bàn giao két</h2>
              <button
                type="button"
                style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer' }}
                onClick={() => setShiftOpen(false)}
              >
                ✕
              </button>
            </div>

            {shiftReport ? (
              <div>
                <div style={{ padding: 16, background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 8, marginBottom: 16 }}>
                  <h3 style={{ margin: '0 0 8px 0', color: '#166534' }}>✓ Đã hoàn tất chốt ca thành công!</h3>
                  <div style={{ fontSize: 14, lineHeight: 1.8 }}>
                    <div><b>Mã biên bản:</b> #{shiftReport.id.slice(0, 8)}</div>
                    <div><b>Thu ngân:</b> {shiftReport.cashierName}</div>
                    <div><b>Ngày:</b> {shiftReport.date}</div>
                    <div><b>Tiền đầu ca:</b> {money(shiftReport.startingCash)}</div>
                    <div><b>Tiền mặt đã thu:</b> {money(shiftReport.cashCollected)} ({shiftReport.txCount} giao dịch)</div>
                    <div><b>Tiền mặt kỳ vọng:</b> {money(shiftReport.expectedCash)}</div>
                    <div><b>Tiền mặt thực đếm:</b> {money(shiftReport.actualCash)}</div>
                    <div><b>Chênh lệch két:</b> <span style={{ fontWeight: 700, color: shiftReport.difference === 0 ? '#166534' : '#b91c1c' }}>{money(shiftReport.difference)}</span></div>
                    {shiftReport.note && <div><b>Ghi chú:</b> {shiftReport.note}</div>}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button type="button" className="ct-primary" onClick={() => window.print()}>
                    🖨️ In biên bản chốt ca
                  </button>
                  <button type="button" className="ct-outline" onClick={() => setShiftOpen(false)}>
                    Hoàn tất
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleCloseShift}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16, background: '#f8fafc', padding: 12, borderRadius: 8 }}>
                  <div>
                    <span style={{ fontSize: 12, color: '#64748b' }}>Ngày ca:</span>
                    <div style={{ fontWeight: 600 }}>{shiftData?.shiftDate}</div>
                  </div>
                  <div>
                    <span style={{ fontSize: 12, color: '#64748b' }}>Thu ngân:</span>
                    <div style={{ fontWeight: 600 }}>{shiftData?.cashier?.name || user?.fullName || 'Thu ngân'}</div>
                  </div>
                  <div>
                    <span style={{ fontSize: 12, color: '#64748b' }}>Tiền mặt đã thu trong ca:</span>
                    <div style={{ fontWeight: 700, color: '#059669', fontSize: 16 }}>{money(shiftData?.cashCollected || 0)}</div>
                    <small style={{ color: '#64748b' }}>({shiftData?.transactionCount || 0} phiếu thu)</small>
                  </div>
                  <div>
                    <span style={{ fontSize: 12, color: '#64748b' }}>Chuyển khoản (Napas/QR):</span>
                    <div style={{ fontWeight: 700, color: '#0284c7', fontSize: 16 }}>{money(shiftData?.bankCollected || 0)}</div>
                    <small style={{ color: '#64748b' }}>(Đối soát ngân hàng)</small>
                  </div>
                </div>

                <div style={{ marginBottom: 14 }}>
                  <label style={{ display: 'block', marginBottom: 6, fontWeight: 500, fontSize: 14 }}>
                    Tiền mặt đầu ca trong két (VND):
                    <input
                      type="number"
                      required
                      min="0"
                      step="1000"
                      value={startingCash}
                      onChange={(e) => setStartingCash(e.target.value)}
                      style={{ width: '100%', padding: '8px 12px', marginTop: 4, borderRadius: 6, border: '1px solid #cbd5e1' }}
                    />
                  </label>
                </div>

                <div style={{ marginBottom: 14 }}>
                  <label style={{ display: 'block', marginBottom: 6, fontWeight: 500, fontSize: 14 }}>
                    Tiền mặt thực đếm trong két khi giao ca (VND):
                    <input
                      type="number"
                      required
                      min="0"
                      step="1000"
                      value={actualCash}
                      onChange={(e) => setActualCash(e.target.value)}
                      placeholder="Nhập tổng tiền mặt đếm được trong két..."
                      style={{ width: '100%', padding: '8px 12px', marginTop: 4, borderRadius: 6, border: '1px solid #cbd5e1' }}
                    />
                  </label>
                </div>

                <div style={{ padding: 12, background: '#f1f5f9', borderRadius: 8, marginBottom: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 14 }}>
                    <span>Kỳ vọng trong két (Đầu ca + Thu mặt):</span>
                    <b>{money(expectedCash)}</b>
                  </div>
                  {actualCash !== '' && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, paddingTop: 4, borderTop: '1px solid #cbd5e1' }}>
                      <span>Chênh lệch (Thực đếm - Kỳ vọng):</span>
                      <b style={{ color: difference === 0 ? '#166534' : difference > 0 ? '#0284c7' : '#dc2626' }}>
                        {difference > 0 ? '+' : ''}{money(difference)} {difference === 0 ? '(Khớp 100%)' : difference > 0 ? '(Thừa két)' : '(Thiếu két)'}
                      </b>
                    </div>
                  )}
                </div>

                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: 'block', marginBottom: 6, fontWeight: 500, fontSize: 14 }}>
                    Ghi chú bàn giao:
                    <textarea
                      rows={2}
                      value={shiftNote}
                      onChange={(e) => setShiftNote(e.target.value)}
                      placeholder="Ghi chú mệnh giá, sự cố hoặc bàn giao cho ca tiếp theo..."
                      style={{ width: '100%', padding: '8px 12px', marginTop: 4, borderRadius: 6, border: '1px solid #cbd5e1' }}
                    />
                  </label>
                </div>

                {error && <div className="gx-error" style={{ marginBottom: 12 }}>{error}</div>}

                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                  <button type="button" className="ct-outline" onClick={() => setShiftOpen(false)}>
                    Hủy
                  </button>
                  <button type="submit" className="ct-primary" disabled={busy || actualCash === ''}>
                    {busy ? 'Đang lưu…' : 'Xác nhận chốt ca & Lưu biên bản'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
