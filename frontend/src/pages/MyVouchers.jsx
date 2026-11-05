import React, { useState, useEffect } from 'react';
import { Title, Panel, Button } from '../components/UI';
import { api } from '../services/api';
import { useCourtly } from '../context';
import { useI18n } from '../utils/i18n';
import { Ticket, Gift, Sparkles, Clock, ArrowRight, Tag, Copy, Check, Search } from 'lucide-react';

export default function MyVouchers() {
  const { t, isEn } = useI18n();
  const ctx = useCourtly() || {};
  const notify = ctx.notify || ((msg) => alert(msg));
  const [vouchers, setVouchers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [inputCode, setInputCode] = useState('');
  const [checking, setChecking] = useState(false);
  const [copiedCode, setCopiedCode] = useState(null);

  const fetchVouchers = () => {
    setLoading(true);
    api('/vouchers/my')
      .then(res => setVouchers(res || []))
      .catch(e => notify(t('Lỗi tải ưu đãi:') + ' ' + e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchVouchers();
  }, []);

  const handleCheckCode = async (e) => {
    e?.preventDefault();
    const code = inputCode.trim().toUpperCase();
    if (!code) {
      notify(t('Vui lòng nhập mã voucher'));
      return;
    }
    setChecking(true);
    try {
      const res = await api('/public/vouchers/validate', 'POST', { code, amount: 200000 });
      if (res && res.valid) {
        notify(isEn ? `🎉 Code ${code} is valid! ${t(res.description || '')} (${res.discountAmount ? Number(res.discountAmount).toLocaleString('vi-VN') + '₫ off' : ''})` : `🎉 Mã ${code} hợp lệ! ${res.description || ''} (Giảm ${res.discountAmount ? Number(res.discountAmount).toLocaleString('vi-VN') + '₫' : ''})`);
        fetchVouchers();
      } else {
        notify(isEn ? `⚠️ Code ${code} is unavailable or expired: ${res?.message || 'Cannot be applied'}` : `⚠️ Mã ${code} không khả dụng hoặc đã hết hạn: ${res?.message || 'Không áp dụng được'}`);
      }
    } catch (err) {
      notify(`⚠️ ${err.message || t('Mã ưu đãi không hợp lệ')}`);
    } finally {
      setChecking(false);
    }
  };

  const handleCopy = (code) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    notify(`${t('Đã sao chép mã')} ${code}`);
    setTimeout(() => setCopiedCode(null), 2500);
  };

  const activeVouchers = vouchers.filter(v => {
    const isActive = v.status === 'ACTIVE' || (v.enabled && !v.status);
    const notExpired = !v.expiresAt || new Date(v.expiresAt) > new Date();
    const notExhausted = !v.usageLimit || v.usedCount < v.usageLimit;
    return isActive && notExpired && notExhausted;
  });

  return (
    <div style={{ maxWidth: 960 }}>
      <Title subtitle={t('Danh sách voucher ưu đãi cá nhân, quà tri ân và bồi thường dịch vụ gắn với tài khoản của bạn.')}>
        {t('Ưu đãi của tôi')}
      </Title>

      {/* Tra cứu / Nhập mã ưu đãi */}
      <div style={{
        background: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: 12,
        padding: '16px 20px',
        marginBottom: 24,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 12
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Tag size={20} color="#173c32" />
          <div>
            <div style={{ fontWeight: 700, fontSize: 14, color: '#173c32' }}>{t('Nhập mã voucher ưu đãi')}</div>
            <div style={{ fontSize: 12, color: '#64748b' }}>{t('Kiểm tra hoặc áp dụng mã khuyến mãi của bạn')}</div>
          </div>
        </div>
        <form onSubmit={handleCheckCode} style={{ display: 'flex', gap: 8, flex: '1 1 320px', maxWidth: 440 }}>
          <input
            type="text"
            value={inputCode}
            onChange={e => setInputCode(e.target.value)}
            placeholder="VD: HE2026, SORRY-..."
            style={{
              flex: 1,
              padding: '8px 12px',
              border: '1px solid #cbd5e1',
              borderRadius: 8,
              fontSize: 13.5,
              textTransform: 'uppercase',
              fontFamily: 'monospace',
              fontWeight: 700
            }}
          />
          <button
            type="submit"
            disabled={checking}
            className="btn primary sm"
            style={{
              padding: '8px 16px',
              borderRadius: 8,
              fontWeight: 700,
              fontSize: 13,
              cursor: checking ? 'wait' : 'pointer'
            }}
          >
            {checking ? t('Đang kiểm tra…') : t('Kiểm tra mã')}
          </button>
        </form>
      </div>

      {loading ? (
        <div className="loading" style={{ textAlign: 'center', padding: 40, color: '#64748b' }}>{t('Đang tải ưu đãi…')}</div>
      ) : activeVouchers.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 20px', background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0' }}>
          <Gift size={40} color="#94a3b8" style={{ marginBottom: 12 }} />
          <div style={{ fontSize: 16, fontWeight: 700, color: '#334155' }}>{t('Chưa có mã ưu đãi nào')}</div>
          <div style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>
            {t('Các mã tri ân, quà sinh nhật và voucher bồi thường dịch vụ sẽ xuất hiện tại đây khi được phát.')}
          </div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
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
                  padding: 18,
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  boxShadow: '0 2px 6px rgba(0,0,0,0.04)',
                  position: 'relative'
                }}
              >
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      <span style={{
                        fontFamily: 'monospace',
                        fontWeight: 800,
                        fontSize: 15,
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
                      <button
                        type="button"
                        onClick={() => handleCopy(v.code)}
                        title={t('Sao chép mã')}
                        style={{
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          padding: 4,
                          color: copiedCode === v.code ? '#16a34a' : '#64748b',
                          display: 'inline-flex',
                          alignItems: 'center'
                        }}
                      >
                        {copiedCode === v.code ? <Check size={14} /> : <Copy size={14} />}
                      </button>
                    </div>
                    <span style={{ fontSize: 12, color: '#059669', fontWeight: 700, background: '#ecfdf5', padding: '3px 8px', borderRadius: 12 }}>
                      {t('Giảm')} {valueDisplay}
                    </span>
                  </div>

                  <div style={{ fontSize: 13.5, fontWeight: 600, color: '#1e293b', marginBottom: 6 }}>
                    {t(v.description || 'Ưu đãi đặt sân Courtly')}
                  </div>

                  <div style={{ fontSize: 12, color: '#64748b', display: 'flex', flexDirection: 'column', gap: 3 }}>
                    {v.minOrder > 0 && (
                      <div>{t('Đơn tối thiểu:')} <b>{Number(v.minOrder).toLocaleString('vi-VN')}₫</b></div>
                    )}
                    {v.maxDiscount && (
                      <div>{t('Giảm tối đa:')} <b>{Number(v.maxDiscount).toLocaleString('vi-VN')}₫</b></div>
                    )}
                    {v.validFromTime && v.validToTime && (
                      <div style={{ color: '#b45309' }}>{t('Khung giờ:')} <b>{v.validFromTime.slice(0, 5)} – {v.validToTime.slice(0, 5)}</b></div>
                    )}
                    {v.zone && (
                      <div>{t('Khu vực:')} <b>{t(v.zone)}</b></div>
                    )}
                    {v.expiresAt && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4, color: '#94a3b8' }}>
                        <Clock size={12} /> {t('Hạn dùng:')} {new Date(v.expiresAt).toLocaleDateString(isEn ? 'en-GB' : 'vi-VN')}
                      </div>
                    )}
                  </div>
                </div>

                <div style={{ marginTop: 16, paddingTop: 12, borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <button
                    type="button"
                    onClick={() => handleCopy(v.code)}
                    style={{
                      background: 'none',
                      border: 'none',
                      fontSize: 12,
                      color: copiedCode === v.code ? '#16a34a' : '#2563eb',
                      fontWeight: 600,
                      cursor: 'pointer',
                      padding: 0
                    }}
                  >
                    {copiedCode === v.code ? `✓ ${t('Đã sao chép')}` : t('Sao chép mã')}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (ctx.navigate) {
                        if (ctx.setActiveVoucherCode) ctx.setActiveVoucherCode(v.code);
                        ctx.navigate('booking');
                      } else {
                        window.location.href = `/dat-san?voucher=${encodeURIComponent(v.code)}`;
                      }
                    }}
                    className="btn primary sm"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}
                  >
                    {t('Dùng ngay')} <ArrowRight size={14} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
