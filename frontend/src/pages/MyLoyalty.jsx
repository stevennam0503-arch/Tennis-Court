import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import { 
  Crown, Star, Award, Gift, Sparkles, TrendingUp, 
  Clock, CheckCircle2, ChevronRight, Copy, Check, Info
} from 'lucide-react';
import { useCourtly } from '../context';
import { api } from '../services/api';
import { money } from '../utils/format';

const TIER_META = {
  ROOKIE: { label: 'Rookie', color: '#64748b', bg: '#f1f5f9', border: '#cbd5e1', icon: '🎾', discount: '0%', multiplier: '×1,0', next: 'CHALLENGER', target: 3000000 },
  CHALLENGER: { label: 'Challenger', color: '#0284c7', bg: '#e0f2fe', border: '#7dd3fc', icon: '⭐', discount: '−3%', multiplier: '×1,2', next: 'MASTERS', target: 8000000 },
  MASTERS: { label: 'Masters', color: '#7c3aed', bg: '#ede9fe', border: '#c4b5fd', icon: '🏆', discount: '−5%', multiplier: '×1,5', next: 'GRAND_SLAM', target: 20000000 },
  GRAND_SLAM: { label: 'Grand Slam', color: '#b45309', bg: '#fef3c7', border: '#fcd34d', icon: '👑', discount: '−8%', multiplier: '×2,0', next: null, target: 20000000 }
};

export default function MyLoyalty() {
  const { user } = useCourtly();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [vipQrUrl, setVipQrUrl] = useState('');
  const [copiedRef, setCopiedRef] = useState(false);
  const [rewards, setRewards] = useState([]);
  const [redeemBusy, setRedeemBusy] = useState(false);
  const [redeemMsg, setRedeemMsg] = useState('');

  useEffect(() => {
    const fetchLoyalty = async () => {
      try {
        setLoading(true);
        const json = await api('/loyalty/my');
        if (json) {
          setData(json);
          if (json.vipCard && json.vipCard.code) {
            QRCode.toDataURL(json.vipCard.code, {
              width: 220,
              margin: 1,
              color: { dark: '#0f172a', light: '#ffffff' }
            }).then(setVipQrUrl).catch(() => {});
          }
        }
        const rJson = await api('/loyalty/rewards');
        if (rJson) setRewards(rJson);
      } catch (err) {
        console.error('Lỗi tải thông tin hạng & điểm:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchLoyalty();
  }, []);

  const handleRedeem = async (rewardCode) => {
    if (redeemBusy) return;
    setRedeemBusy(true);
    setRedeemMsg('');
    try {
      const resJson = await api(`/loyalty/rewards/${rewardCode}/redeem`, 'POST');
      setRedeemMsg(`🎉 Đổi thành công! Mã voucher: ${resJson.voucherCode} (Đã trừ ${resJson.pointsSpent} điểm)`);
      const lJson = await api('/loyalty/my');
      if (lJson) setData(lJson);
    } catch (err) {
      setRedeemMsg(`⚠️ ${err.message}`);
    } finally {
      setRedeemBusy(false);
    }
  };

  const copyReferralCode = () => {
    if (!data?.referralCode) return;
    navigator.clipboard.writeText(data.referralCode);
    setCopiedRef(true);
    setTimeout(() => setCopiedRef(false), 2000);
  };

  if (loading) {
    return <div style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>Đang tải thông tin thành viên…</div>;
  }

  if (!data) {
    return <div style={{ padding: 40, textAlign: 'center', color: '#ef4444' }}>Không thể kết nối thông tin thành viên.</div>;
  }

  const currentTier = data.tier || 'ROOKIE';
  const meta = TIER_META[currentTier] || TIER_META.ROOKIE;
  const spend = data.spend12m != null ? data.spend12m : (data.spend12Month || 0);
  const nextTarget = meta.target;
  const progressPct = meta.next ? Math.min(100, Math.round((spend / nextTarget) * 100)) : 100;
  const needed = meta.next ? Math.max(0, nextTarget - spend) : 0;

  return (
    <div className="my-loyalty-container" style={{ display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 960 }}>
      {/* 1. TIER HERO CARD */}
      <div 
        style={{ 
          background: currentTier === 'GRAND_SLAM' 
            ? 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)' 
            : currentTier === 'MASTERS'
            ? 'linear-gradient(135deg, #2e1065 0%, #1e1b4b 100%)'
            : currentTier === 'CHALLENGER'
            ? 'linear-gradient(135deg, #0c4a6e 0%, #082f49 100%)'
            : 'linear-gradient(135deg, #1e293b 0%, #334155 100%)',
          borderRadius: 16,
          padding: '24px 28px',
          color: '#fff',
          boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
          position: 'relative',
          overflow: 'hidden'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <span style={{ 
              display: 'inline-flex', 
              alignItems: 'center', 
              gap: 6, 
              padding: '4px 12px', 
              borderRadius: 20, 
              fontSize: 12.5, 
              fontWeight: 800, 
              background: 'rgba(255,255,255,0.18)',
              backdropFilter: 'blur(4px)',
              letterSpacing: '0.04em',
              textTransform: 'uppercase'
            }}>
              <span>{meta.icon}</span> HẠNG THÀNH VIÊN {meta.label}
            </span>
            <h2 style={{ fontSize: 26, fontWeight: 800, margin: '12px 0 4px', color: '#fff' }}>
              {data.name || user?.name}
            </h2>
            <p style={{ margin: 0, fontSize: 13, color: 'rgba(255,255,255,0.8)' }}>
              {data.tierExpiresAt 
                ? `Hạn giữ hạng: ${new Date(data.tierExpiresAt).toLocaleDateString('vi-VN')}` 
                : 'Thành viên CLB Tennis Courtly'}
            </p>
          </div>

          <div style={{ textAlign: 'right', background: 'rgba(255,255,255,0.1)', padding: '12px 20px', borderRadius: 12 }}>
            <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.8)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Điểm khả dụng
            </span>
            <div style={{ fontSize: 30, fontWeight: 900, color: '#fef08a', marginTop: 2 }}>
              {data.pointsBalance || 0} <span style={{ fontSize: 14, fontWeight: 600, color: 'rgba(255,255,255,0.9)' }}>pts</span>
            </div>
            <div style={{ fontSize: 12, color: '#86efac', fontWeight: 600 }}>
              ≈ {money((data.pointsBalance || 0) * 100)}
            </div>
          </div>
        </div>

        {/* TIER PERKS SUMMARY PILLS */}
        <div style={{ display: 'flex', gap: 10, marginTop: 20, flexWrap: 'wrap' }}>
          <div style={{ background: 'rgba(255,255,255,0.14)', padding: '6px 12px', borderRadius: 8, fontSize: 12.5, fontWeight: 600 }}>
            🎾 Giảm tiền sân: <b style={{ color: '#86efac' }}>{meta.discount}</b>
          </div>
          <div style={{ background: 'rgba(255,255,255,0.14)', padding: '6px 12px', borderRadius: 8, fontSize: 12.5, fontWeight: 600 }}>
            ⭐ Tích điểm: <b style={{ color: '#fef08a' }}>{meta.multiplier}</b>
          </div>
          <div style={{ background: 'rgba(255,255,255,0.14)', padding: '6px 12px', borderRadius: 8, fontSize: 12.5, fontWeight: 600 }}>
            📅 Đặt trước: <b>{meta.label === 'Grand Slam' ? '21 ngày' : meta.label === 'Masters' ? '14 ngày' : meta.label === 'Challenger' ? '10 ngày' : '7 ngày'}</b>
          </div>
          {currentTier === 'GRAND_SLAM' && (
            <div style={{ background: '#f59e0b', color: '#78350f', padding: '6px 12px', borderRadius: 8, fontSize: 12.5, fontWeight: 800 }}>
              👑 VIP Lounge Card
            </div>
          )}
        </div>
      </div>

      {/* 2. PROGRESS TO NEXT TIER */}
      {meta.next && (
        <div style={{ background: '#fff', padding: 20, borderRadius: 14, border: '1px solid #e2e8f0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: '#1e293b' }}>
              Tiến độ thăng hạng {TIER_META[meta.next].label}
            </span>
            <span style={{ fontSize: 13, color: '#64748b' }}>
              Chi tiêu 12 tháng: <b>{money(spend)}</b> / {money(nextTarget)}
            </span>
          </div>
          
          <div style={{ height: 10, background: '#e2e8f0', borderRadius: 6, overflow: 'hidden', marginBottom: 8 }}>
            <div 
              style={{ 
                height: '100%', 
                width: `${progressPct}%`, 
                background: meta.color,
                borderRadius: 6,
                transition: 'width 0.4s ease'
              }} 
            />
          </div>

          <div style={{ fontSize: 13, color: '#475569', display: 'flex', justifyContent: 'space-between' }}>
            <span>Đã đạt <b>{progressPct}%</b></span>
            <span>Còn thiếu <b style={{ color: '#dc2626' }}>{money(needed)}</b> để lên hạng {TIER_META[meta.next].label}</span>
          </div>
        </div>
      )}

      {/* 3. VIP LOUNGE PASS (GRAND SLAM MEMBERS ONLY) */}
      {currentTier === 'GRAND_SLAM' && data.vipCard && (
        <div 
          style={{ 
            background: 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)', 
            borderRadius: 16, 
            border: '2px solid #f59e0b', 
            padding: 24,
            boxShadow: '0 4px 16px rgba(245, 158, 11, 0.15)'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 20 }}>
            <div style={{ flex: 1, minWidth: 260 }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#d97706', color: '#fff', padding: '3px 10px', borderRadius: 12, fontSize: 12, fontWeight: 800 }}>
                <span>👑</span> ĐẶC QUYỀN GRAND SLAM
              </div>
              <h3 style={{ fontSize: 20, fontWeight: 800, color: '#78350f', margin: '10px 0 6px' }}>
                Thẻ VIP Lounge Điện Tử
              </h3>
              <p style={{ margin: 0, fontSize: 13.5, color: '#92400e', lineHeight: 1.5 }}>
                Quý khách được sử dụng phòng chờ VIP sang trọng với trà, cà phê và wifi tốc độ cao miễn phí.
              </p>
              
              <div style={{ marginTop: 16, background: '#fff', padding: '10px 14px', borderRadius: 8, border: '1px solid #fde68a', display: 'inline-block' }}>
                <div style={{ fontSize: 11.5, color: '#78350f', textTransform: 'uppercase', fontWeight: 600 }}>Mã thẻ VIP</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: '#0f172a', letterSpacing: '0.05em' }}>
                  {data.vipCard.code}
                </div>
              </div>
            </div>

            {vipQrUrl && (
              <div style={{ textAlign: 'center', background: '#fff', padding: 14, borderRadius: 12, border: '1px solid #fde68a' }}>
                <img src={vipQrUrl} alt="Mã QR VIP Lounge" style={{ width: 140, height: 140, display: 'block', margin: '0 auto' }} />
                <span style={{ fontSize: 11, fontWeight: 700, color: '#92400e', display: 'block', marginTop: 6 }}>
                  Quét QR tại quầy để vào phòng
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 4. EXPIRING POINTS NOTICE IF ANY */}
      {data.expiringSoonPoints > 0 && (
        <div style={{ background: '#fff7ed', border: '1px solid #fdba74', borderRadius: 10, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10, color: '#9a3412' }}>
          <Clock size={20} style={{ flexShrink: 0 }} />
          <div style={{ fontSize: 13.5 }}>
            Bạn có <b>{data.expiringSoonPoints} điểm</b> sẽ hết hạn trong 30 ngày tới. Hãy sử dụng khi đặt sân hoặc đổi dịch vụ!
          </div>
        </div>
      )}

      {/* 4.5. REWARDS CATALOG (ĐỔI ĐIỂM LẤY DỊCH VỤ) */}
      <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e2e8f0', padding: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div>
            <h3 style={{ margin: '0 0 4px', fontSize: 17, fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span>🎁</span> Danh mục đổi điểm lấy quà & dịch vụ
            </h3>
            <p style={{ margin: 0, fontSize: 13, color: '#64748b' }}>
              Dùng điểm thưởng tích lũy để đổi các voucher dịch vụ độc quyền (hạn dùng 60 ngày).
            </p>
          </div>
          <div style={{ fontSize: 13, color: '#059669', fontWeight: 700, background: '#ecfdf5', padding: '6px 12px', borderRadius: 20 }}>
            Điểm của bạn: {data.pointsBalance || 0} pts
          </div>
        </div>

        {redeemMsg && (
          <div style={{
            padding: '10px 14px',
            borderRadius: 8,
            marginBottom: 16,
            fontSize: 13,
            fontWeight: 600,
            background: redeemMsg.startsWith('🎉') ? '#f0fdf4' : '#fef2f2',
            color: redeemMsg.startsWith('🎉') ? '#15803d' : '#b91c1c',
            border: `1px solid ${redeemMsg.startsWith('🎉') ? '#bbf7d0' : '#fecaca'}`
          }}>
            {redeemMsg}
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 14 }}>
          {(rewards.length > 0 ? rewards : [
            { code: 'EXT30', name: 'Gia hạn 30 phút', points: 800, description: 'Voucher miễn phí gia hạn thời gian chơi sân thêm 30 phút (hạn 60 ngày)' },
            { code: 'GOLDEN1H', name: '1 giờ sân giờ vàng (10:00–15:00)', points: 1200, description: 'Voucher 1 giờ sân trong khung giờ vàng 10:00–15:00 (hạn 60 ngày)' },
            { code: 'REF1H', name: '1 giờ trọng tài', points: 2000, description: 'Voucher 1 giờ dịch vụ trọng tài chuyên nghiệp (hạn 60 ngày)' }
          ]).map(r => {
            const canAfford = (data.pointsBalance || 0) >= r.points;
            return (
              <div 
                key={r.code}
                style={{
                  border: '1.5px solid #e2e8f0',
                  borderRadius: 12,
                  padding: 16,
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  background: canAfford ? '#f8fafc' : '#fafafa',
                  opacity: canAfford ? 1 : 0.75
                }}
              >
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <span style={{ fontSize: 11, fontWeight: 800, color: '#0369a1', background: '#e0f2fe', padding: '2px 8px', borderRadius: 10 }}>
                      {r.code}
                    </span>
                    <strong style={{ fontSize: 15, fontWeight: 900, color: '#b45309' }}>
                      {r.points.toLocaleString()} pts
                    </strong>
                  </div>
                  <h4 style={{ margin: '0 0 6px', fontSize: 15, fontWeight: 700, color: '#1e293b' }}>
                    {r.name}
                  </h4>
                  <p style={{ margin: 0, fontSize: 12.5, color: '#64748b', lineHeight: 1.4 }}>
                    {r.description}
                  </p>
                </div>

                <button
                  type="button"
                  disabled={!canAfford || redeemBusy}
                  onClick={() => handleRedeem(r.code)}
                  style={{
                    marginTop: 14,
                    padding: '8px 12px',
                    borderRadius: 8,
                    border: 'none',
                    background: canAfford ? '#173c32' : '#cbd5e1',
                    color: canAfford ? '#def46a' : '#64748b',
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: canAfford && !redeemBusy ? 'pointer' : 'not-allowed',
                    textAlign: 'center',
                    transition: 'all 0.15s'
                  }}
                >
                  {redeemBusy ? 'Đang đổi…' : canAfford ? 'Đổi quà ngay' : `Thiếu ${(r.points - (data.pointsBalance || 0)).toLocaleString()} pts`}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* 5. REFERRAL CODE BOX */}
      <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e2e8f0', padding: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h4 style={{ margin: '0 0 4px', fontSize: 15, fontWeight: 700, color: '#0f172a' }}>
              Mã giới thiệu bạn bè
            </h4>
            <p style={{ margin: 0, fontSize: 13, color: '#64748b' }}>
              Tặng bạn bè trải nghiệm và nhận ngay <b>+200 điểm thưởng</b> khi người được giới thiệu hoàn tất buổi chơi đầu tiên!
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <code style={{ background: '#f1f5f9', padding: '8px 14px', borderRadius: 8, fontSize: 15, fontWeight: 800, color: '#0f172a' }}>
              {data.referralCode || 'CHƯA TẠO'}
            </code>
            <button
              type="button"
              onClick={copyReferralCode}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '8px 14px',
                borderRadius: 8,
                border: '1px solid #cbd5e1',
                background: '#fff',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              {copiedRef ? <Check size={16} color="#16a34a" /> : <Copy size={16} />}
              {copiedRef ? 'Đã sao chép' : 'Sao chép mã'}
            </button>
          </div>
        </div>
      </div>

      {/* 6. RECENT LEDGER TRANSACTIONS */}
      <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0', fontWeight: 700, fontSize: 15, color: '#0f172a' }}>
          Lịch sử giao dịch điểm gần đây
        </div>
        
        {(!data.history || data.history.length === 0) ? (
          <div style={{ padding: 28, textAlign: 'center', color: '#94a3b8', fontSize: 13.5 }}>
            Chưa có giao dịch tích lũy hoặc đổi điểm nào.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {data.history.map(item => {
              const isPlus = item.points > 0;
              return (
                <div 
                  key={item.id} 
                  style={{ 
                    padding: '12px 20px', 
                    borderBottom: '1px solid #f1f5f9', 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center' 
                  }}
                >
                  <div>
                    <div style={{ fontSize: 13.5, fontWeight: 600, color: '#1e293b' }}>
                      {item.note || item.type}
                    </div>
                    <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>
                      {new Date(item.createdAt).toLocaleString('vi-VN')}
                    </div>
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    <span 
                      style={{ 
                        fontSize: 15, 
                        fontWeight: 800, 
                        color: isPlus ? '#16a34a' : '#dc2626' 
                      }}
                    >
                      {isPlus ? `+${item.points}` : item.points} pts
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
