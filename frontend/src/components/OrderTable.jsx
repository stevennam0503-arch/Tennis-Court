import React from 'react';
import { Button, Chip, Table } from './UI';
import { useCourtly } from '../context';
import { money, slotLabel } from '../utils/format';

export default function OrderTable({ orders }) {
  const { data, show } = useCourtly();
  return (
    <Table headings={['Khách hàng', 'Lịch sân', 'Tổng tiền', 'Trạng thái', '']} empty={!orders.length}>
      {orders.map(o => {
        const isCancelled = ['CANCELLED', 'EXPIRED'].includes(o.status);
        const refunded = o.finance?.refunded || 0;
        const refundPending = o.finance?.refundPending || o.cancellationSettlement?.refundAmount || 0;
        const hasPending = refundPending > 0 && refunded === 0;
        const extMinutes = o.totalExtensionMinutes || 0;

        return (
          <tr key={o.id}>
            <td className="name">
              {o.name}
              <small>{o.id.slice(0, 8)}</small>
            </td>
            <td>
              {o.slots.slice(0, 2).map(s => (
                <div key={s.id}>
                  {data.courts.find(c => c.id === s.court)?.name} · {slotLabel(s)}
                </div>
              ))}
              {o.slots.length > 2 && <small>+{o.slots.length - 2} khung giờ</small>}
              <small>{o.date}</small>
            </td>
            <td>
              {money(o.total)}
              <small>Đã thu {money(o.paid)}</small>
            </td>
            <td>
              <Chip status={o.status} />
              {extMinutes > 0 && (
                <span style={{ display: 'inline-block', marginLeft: 4, padding: '2px 6px', fontSize: 11, fontWeight: 700, color: '#1d4ed8', background: '#dbeafe', borderRadius: 4 }}>
                  +{extMinutes}p
                </span>
              )}
              {o.status === 'COMPLETED' && o.paid < o.total && (
                <span style={{ display: 'block', marginTop: 4, padding: '2px 6px', fontSize: 11, fontWeight: 700, color: '#b91c1c', background: '#fee2e2', borderRadius: 4 }}>
                  CÒN NỢ {money(o.total - o.paid)}
                </span>
              )}
              {isCancelled && refunded > 0 && (
                <span style={{ display: 'block', marginTop: 4, padding: '2px 6px', fontSize: 11, fontWeight: 700, color: '#166534', background: '#dcfce7', borderRadius: 4, border: '1px solid #bbf7d0' }}>
                  ✓ Đã hoàn {money(refunded)}
                </span>
              )}
              {isCancelled && hasPending && (
                <span style={{ display: 'block', marginTop: 4, padding: '2px 6px', fontSize: 11, fontWeight: 700, color: '#b45309', background: '#fef3c7', borderRadius: 4, border: '1px solid #fde68a' }}>
                  ⏳ Chờ hoàn {money(refundPending)}
                </span>
              )}
              {isCancelled && refunded === 0 && !hasPending && o.paid > 0 && (
                <span style={{ display: 'block', marginTop: 4, padding: '2px 6px', fontSize: 10.5, fontWeight: 600, color: '#64748b', background: '#f1f5f9', borderRadius: 4 }}>
                  Giữ cọc (Hủy cận giờ)
                </span>
              )}
            </td>
            <td>
              <div style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
                {o.status === 'CHECKED_IN' && (
                  <Button className="sm primary" style={{ background: '#16a34a', borderColor: '#15803d' }} onClick={() => show({ type: 'check-out', id: o.id })}>
                    Check-out
                  </Button>
                )}
                {hasPending && (
                  <Button className="sm" style={{ background: '#fff1f2', color: '#e11d48', borderColor: '#fecdd3' }} onClick={() => show({ type: 'refund', orderId: o.id })}>
                    Hoàn tiền
                  </Button>
                )}
                <Button className="sm" onClick={() => show({ type: 'order', id: o.id, visitDate: o.visitDate })}>
                  Chi tiết
                </Button>
              </div>
            </td>
          </tr>
        );
      })}
    </Table>
  );
}
