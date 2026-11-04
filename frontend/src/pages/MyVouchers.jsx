import React, { useState, useEffect } from 'react';
import { Title, Panel, Button } from '../components/UI';
import { api } from '../services/api';
import { useCourtly } from '../context';
import { Ticket, Gift, Sparkles, Clock, ArrowRight, Tag } from 'lucide-react';

export default function MyVouchers() {
  const { notify } = useCourtly();
  const [vouchers, setVouchers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api('/vouchers/my')
      .then(res => setVouchers(res || []))
      .catch(e => notify('Lỗi tải ưu đãi: ' + e.message))
      .finally(() => setLoading(false));
  }, []);

  const activeVouchers = vouchers.filter(v => {
    const isActive = v.status === 'ACTIVE' || (v.enabled && !v.status);
    const notExpired = !v.expiresAt || new Date(v.expiresAt) > new Date();
    const notExhausted = !v.usageLimit || v.usedCount < v.usageLimit;
    return isActive && notExpired && notExhausted;
  });

  return (
    <>
      <Title subtitle="Danh sách voucher ưu đãi cá nhân, quà tri ân và bồi thường dịch vụ gắn với tài khoản của bạn.">
        Ưu đãi của tôi
      </Title>

      {loading ? (
        <div className="loading">Đang tải ưu đãi…</div>
      ) : activeVouchers.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 20px', background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0' }}>
          <Gift size={40} color="#94a3b8" style={{ marginBottom: 12 }} />
          <div style={{ fontSize: 16, fontWeight: 700, color: '#334155' }}>Chưa có mã ưu đãi nào</div>
          <div style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>
            Các mã tri ân, quà sinh nhật và voucher bồi thường dịch vụ sẽ xuất hiện tại đây khi được phát.
          </div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
          {activeVouchers.map(v => {
            const isPercent = v.type === 'PERCENT';
            const valueDisplay = isPercent ? `${v.value}%` : `${Number(v.value).toLocaleString('vi-VN')}₫`;
            const isSorry = v.source === 'FEEDBACK_RECOVERY' || v.code.startsWith('SORRY');

            return (
              <div
                key={v.id}
                style={{
                  background: '#fff',
                  border: isSorry ? '1.5px solid #f59e0b' : '1px solid #e2e8f0',
                  borderRadius: 12,
                  padding: 16,
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  boxShadow: '0 2px 6px rgba(0,0,0,0.04)',
                  position: 'relative'
                }}
              >
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                    <span style={{
                      fontFamily: 'monospace',
                      fontWeight: 800,
                      fontSize: 16,
                      background: isSorry ? '#fef3c7' : '#f1f5f9',
                      color: isSorry ? '#b45309' : '#0f172a',
                      padding: '4px 8px',
                      borderRadius: 6,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6
                    }}>
                      <Tag size={14} /> {v.code}
                    </span>
                    <span style={{ fontSize: 12, color: '#059669', fontWeight: 700, background: '#ecfdf5', padding: '3px 8px', borderRadius: 12 }}>
                      Giảm {valueDisplay}
                    </span>
                  </div>

                  <div style={{ fontSize: 13, fontWeight: 600, color: '#1e293b', marginBottom: 6 }}>
                    {v.description || 'Ưu đãi đặt sân Courtly'}
                  </div>

                  <div style={{ fontSize: 12, color: '#64748b', display: 'flex', flexDirection: 'column', gap: 3 }}>
                    {v.minOrder > 0 && (
                      <div>Đơn tối thiểu: <b>{Number(v.minOrder).toLocaleString('vi-VN')}₫</b></div>
                    )}
                    {v.maxDiscount && (
                      <div>Giảm tối đa: <b>{Number(v.maxDiscount).toLocaleString('vi-VN')}₫</b></div>
                    )}
                    {v.expiresAt && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4, color: '#94a3b8' }}>
                        <Clock size={12} /> Hạn dùng: {new Date(v.expiresAt).toLocaleDateString('vi-VN')}
                      </div>
                    )}
                  </div>
                </div>

                <div style={{ marginTop: 16, paddingTop: 12, borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'flex-end' }}>
                  <a
                    href={`/dat-san?voucher=${encodeURIComponent(v.code)}`}
                    className="btn primary sm"
                    style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                  >
                    Dùng ngay <ArrowRight size={14} />
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
