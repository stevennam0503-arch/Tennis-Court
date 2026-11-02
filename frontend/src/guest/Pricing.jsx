import React, { useState, useMemo } from 'react';
import {
  Sun,
  House,
  Crown,
  ArrowUpRight,
  Zap,
  Clock,
  ShieldCheck,
  CheckCircle2,
  Ticket,
  Gift,
  LogIn,
  AlertCircle,
  CreditCard,
  RefreshCw,
  Scale,
  SlidersHorizontal,
  Layers
} from 'lucide-react';
import { useGuest, Action, Empty, money, zone } from './context';
import { WEEK_DAYS, getCourtMatrix } from './pricing.mjs';

const ZONE_DEFAULTS = {
  A: { name: 'Sân Ngoài Trời', Icon: Sun, defaultMin: 120000, desc: 'Thoáng mát, rợp bóng cây, đèn LED 500 Lux' },
  B: { name: 'Mái Che Trong Nhà', Icon: House, defaultMin: 180000, desc: 'Mái vòm kiên cố, đệm Pro-Cushion, quạt thông gió' },
  V: { name: 'Sân VIP Clubhouse', Icon: Crown, defaultMin: 300000, desc: 'Phòng chờ riêng, sofa sang trọng & minibar miễn phí' }
};

export default function Pricing() {
  const { t, data, setPreferredZone, navigate } = useGuest();
  const [selectedZone, setSelectedZone] = useState('A');
  const [selectedCourtId, setSelectedCourtId] = useState(null);
  const [modalCell, setModalCell] = useState(null);

  const settings = data?.settings || {};

  // 1. DYNAMICALLY EXTRACT ALL ACTIVE COURTS (SCALES UP ON ADD, SCALES DOWN ON DELETE)
  const allActiveCourts = useMemo(() => {
    return (data?.courts || []).filter(c => c.status !== 'DELETED');
  }, [data?.courts]);

  // 2. DYNAMICALLY DETECT ZONES & COUNTS (ADAPTS ACCORDING TO ACTUAL COURTS)
  const dynamicTabs = useMemo(() => {
    const detectedZones = new Set(allActiveCourts.map(c => zone(c)));
    const zoneOrder = ['A', 'B', 'V'];
    detectedZones.forEach(z => {
      if (!zoneOrder.includes(z)) zoneOrder.push(z);
    });

    return zoneOrder.map(tabId => {
      const meta = ZONE_DEFAULTS[tabId] || {
        name: `Khu sân ${tabId}`,
        Icon: Sun,
        defaultMin: 140000,
        desc: `Khu vực sân ${tabId} tiêu chuẩn`
      };
      const courtsInThisZone = allActiveCourts.filter(c => zone(c) === tabId);
      const activeCount = courtsInThisZone.filter(c => c.status === 'ACTIVE').length;

      // Calculate dynamic minimum price for this zone based on its current courts
      let minVal = Infinity;
      for (const c of courtsInThisZone) {
        const m = getCourtMatrix(c, data?.prices || []);
        for (const block of m || []) {
          for (const dayKey of Object.keys(block.days || {})) {
            const p = block.days[dayKey]?.price;
            if (p && p < minVal) minVal = p;
          }
        }
      }
      const dynamicMinPrice =
        minVal !== Infinity
          ? minVal
          : Math.round(Number(courtsInThisZone[0]?.price || meta.defaultMin) * 0.75);

      return {
        id: tabId,
        name: meta.name,
        Icon: meta.Icon,
        desc: meta.desc,
        totalCount: courtsInThisZone.length,
        activeCount,
        minPrice: dynamicMinPrice,
        courts: courtsInThisZone
      };
    });
  }, [allActiveCourts, data?.prices]);

  const currentTab = dynamicTabs.find(z => z.id === selectedZone) || dynamicTabs[0];
  const courtsInZone = currentTab?.courts || [];

  // Active Court: either explicitly selected court in zone, or first active court
  const activeCourt = useMemo(() => {
    if (selectedCourtId) {
      const match = courtsInZone.find(c => c.id === selectedCourtId);
      if (match) return match;
    }
    return courtsInZone.find(c => c.status === 'ACTIVE') || courtsInZone[0] || null;
  }, [courtsInZone, selectedCourtId]);

  // Calculate pricing matrix dynamically for active court
  const matrix = useMemo(() => {
    return activeCourt ? getCourtMatrix(activeCourt, data?.prices || []) : [];
  }, [activeCourt, data?.prices]);

  const handleZoneChange = zoneId => {
    setSelectedZone(zoneId);
    setSelectedCourtId(null); // Reset court selection on zone change
  };

  const handleCellClick = (block, dayKey, dayData) => {
    const dayMeta = WEEK_DAYS.find(d => d.key === dayKey);
    const isDiscount = dayData.type === 'flash';
    const origPrice = isDiscount ? Math.round(dayData.price / 0.75) : dayData.price;
    const depositPercent = settings.depositPercent || 50;
    const depositPrice = Math.round((dayData.price * depositPercent) / 100);

    setModalCell({
      block,
      dayMeta,
      price: dayData.price,
      origPrice,
      isDiscount,
      depositPercent,
      depositPrice,
      courtName: activeCourt?.name || t('Sân Tennis')
    });
  };

  const handleBookNow = () => {
    setPreferredZone(selectedZone);
    setModalCell(null);
    navigate('booking');
  };

  const outdoorCount = allActiveCourts.filter(c => zone(c) === 'A').length;
  const indoorCount = allActiveCourts.filter(c => zone(c) === 'B').length;
  const vipCount = allActiveCourts.filter(c => zone(c) === 'V').length;

  return (
    <section className="ct-pad gx-pricing" style={{ maxWidth: 1200, margin: '0 auto' }}>
      {/* Header */}
      <div className="gx-heading" style={{ marginBottom: 24 }}>
        <span
          className="ct-eyebrow"
          style={{ color: '#6b8274', letterSpacing: '0.15em', fontWeight: 700, fontSize: 12 }}
        >
          COURTLY · {t('BẢNG GIÁ NIÊM YẾT 2026')}
        </span>
        <h1
          style={{
            color: '#173c32',
            fontSize: 'clamp(28px, 3.5vw, 40px)',
            fontWeight: 800,
            margin: '8px 0 12px'
          }}
        >
          {t('Bảng giá sân theo ngày & khung giờ')}
        </h1>
        <p style={{ color: '#52655a', fontSize: 14, lineHeight: 1.6, maxWidth: 720 }}>
          {t(
            'Biểu phí chuẩn theo giờ và phân bổ riêng biệt cho từng ngày trong tuần. Khung Giờ Vàng (-25%) tự động áp dụng trực tiếp khi tạo đơn.'
          )}
        </p>
      </div>

      {/* DYNAMIC VENUE CAPACITY & SCALE BANNER */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 12,
          background: '#f2f6ee',
          border: '1px solid #d5dcce',
          borderRadius: 10,
          padding: '12px 18px',
          marginBottom: 24
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Scale size={18} color="#173c32" />
          <span style={{ fontSize: 13, color: '#173c32' }}>
            <strong>{t('Quy mô sân vận hành:')}</strong> {allActiveCourts.length} {t('sân tiêu chuẩn ATP')} (
            {outdoorCount} {t('ngoài trời')}, {indoorCount} {t('trong nhà')}, {vipCount} {t('VIP')})
          </span>
        </div>
        <span
          style={{
            fontSize: 12,
            color: '#047857',
            fontWeight: 700,
            background: '#ecfdf5',
            padding: '3px 10px',
            borderRadius: 12,
            border: '1px solid #a7f3d0'
          }}
        >
          ✓ {t('Tự động điều chỉnh theo từng sân')}
        </span>
      </div>

      {/* 1. HORIZONTAL TABS SELECTOR (DYNAMICALLY SCALES WITH ACTIVE COURTS) */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <span
            style={{
              fontSize: 12,
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              color: '#6b8274'
            }}
          >
            {t('Chọn loại sân')}:
          </span>
          <span style={{ fontSize: 12, color: '#52655a' }}>
            {t('Nhấp vào tab để xem biểu giá tương ứng')}
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12 }}>
          {dynamicTabs.map(tab => {
            const isActive = selectedZone === tab.id;
            const Icon = tab.Icon;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => handleZoneChange(tab.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 18px',
                  borderRadius: 8,
                  border: isActive ? '2px solid #173c32' : '1px solid #cbd2c2',
                  background: isActive ? '#173c32' : '#fffefa',
                  color: isActive ? '#ffffff' : '#173c32',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  boxShadow: isActive ? '0 4px 12px rgba(23,60,50,0.18)' : 'none',
                  textAlign: 'left'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Icon size={20} stroke={isActive ? '#def46a' : '#173c32'} />
                  <div>
                    <span style={{ fontSize: 14, fontWeight: 700, display: 'block', letterSpacing: '-0.2px' }}>
                      {t(tab.name)}
                    </span>
                    <span style={{ fontSize: 11, opacity: isActive ? 0.9 : 0.65 }}>
                      {tab.totalCount > 0 ? `${tab.totalCount} ${t('sân đang mở')}` : t('Tạm đóng (0 sân)')}
                    </span>
                  </div>
                </div>
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 800,
                    padding: '3px 8px',
                    borderRadius: 4,
                    background: isActive ? '#def46a' : '#edf2e8',
                    color: '#173c32',
                    border: isActive ? 'none' : '1px solid #cbd2c2'
                  }}
                >
                  {tab.totalCount > 0 ? `${t('Từ')} ${money(tab.minPrice)}` : t('Bảo trì')}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. THE EXCEL MATRIX TABLE CONTAINER */}
      <div
        style={{
          background: '#fffefa',
          borderRadius: 10,
          border: '1px solid #cbd2c2',
          overflow: 'hidden',
          boxShadow: '0 2px 12px rgba(23,60,50,0.06)',
          marginBottom: 36
        }}
      >
        {/* SUB-BAR & COURT SELECTOR CHIPS */}
        <div
          style={{
            background: '#edf1e6',
            padding: '12px 18px',
            borderBottom: '1px solid #cbd2c2',
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 12
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 700, textTransform: 'uppercase', color: '#173c32', fontSize: 12 }}>
              {t('Đang xem')}:
            </span>
            <span
              style={{
                fontWeight: 700,
                background: '#ffffff',
                color: '#173c32',
                padding: '3px 10px',
                borderRadius: 4,
                border: '1px solid #bfc7ba',
                fontSize: 12
              }}
            >
              {t(currentTab?.name || 'Sân Ngoài Trời')} ({courtsInZone.length} {t('sân')})
            </span>

            {/* COURT SELECTOR CHIPS ROW (ALLOWS CHOOSING ANY SPECIFIC COURT IN THIS ZONE) */}
            {courtsInZone.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginLeft: 6 }}>
                <span style={{ fontSize: 11.5, color: '#52655a' }}>{t('Chọn sân')}:</span>
                {courtsInZone.map(c => {
                  const isCurrent = activeCourt?.id === c.id;
                  const isMaint = c.status === 'MAINTENANCE';
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setSelectedCourtId(c.id)}
                      style={{
                        background: isCurrent ? '#173c32' : '#ffffff',
                        color: isCurrent ? '#def46a' : '#173c32',
                        border: isCurrent ? '1.5px solid #173c32' : '1px solid #cbd2c2',
                        borderRadius: 14,
                        padding: '3px 10px',
                        fontSize: 11.5,
                        fontWeight: isCurrent ? 700 : 500,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4
                      }}
                    >
                      <span>{c.name}</span>
                      <span style={{ opacity: 0.8, fontSize: 10.5 }}>· {money(c.price || 140000)}/h</span>
                      {isMaint && (
                        <span style={{ background: '#fef3c7', color: '#92400e', fontSize: 9.5, padding: '1px 4px', borderRadius: 3 }}>
                          {t('Bảo trì')}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: 11, color: '#52655a' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: '#15803d', fontWeight: 600 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#15803d' }} /> {t('Giờ Vàng (-25%)')}
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: '#9a3412', fontWeight: 600 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#ea580c' }} /> {t('Cao điểm đèn')}
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: '#6b21a8', fontWeight: 600 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#8b5cf6' }} /> {t('Cuối tuần')}
            </span>
          </div>
        </div>

        {/* Matrix Table or Empty Zone State */}
        {courtsInZone.length === 0 ? (
          <div style={{ padding: 48, textAlign: 'center', color: '#637269' }}>
            <AlertCircle size={36} color="#d97706" style={{ margin: '0 auto 12px' }} />
            <h3 style={{ fontSize: 16, color: '#173c32', margin: '0 0 6px' }}>
              {t('Khu vực này hiện không có sân nào hoạt động')}
            </h3>
            <p style={{ fontSize: 13, color: '#52655a', margin: 0 }}>
              {t('Các sân trong khu này đã được gỡ bỏ hoặc đang trong thời gian bảo dưỡng. Vui lòng chọn khu sân khác!')}
            </p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#e4e9dc', color: '#173c32', fontWeight: 700, textTransform: 'uppercase', fontSize: 11 }}>
                  <th
                    style={{
                      padding: '12px 14px',
                      width: 160,
                      textAlign: 'center',
                      background: '#d8e0ce',
                      borderRight: '1px solid #cbd2c2',
                      borderBottom: '1px solid #cbd2c2',
                      position: 'sticky',
                      left: 0,
                      zIndex: 10
                    }}
                  >
                    {t('Khung Giờ')}
                  </th>
                  {WEEK_DAYS.map(day => {
                    const isWeekend = day.dayType === 'WEEKEND';
                    return (
                      <th
                        key={day.key}
                        style={{
                          padding: '12px 10px',
                          textAlign: 'center',
                          minWidth: 120,
                          borderRight: '1px solid #cbd2c2',
                          borderBottom: '1px solid #cbd2c2',
                          background: isWeekend ? '#ede8f5' : day.key === 'fri' ? '#dde3d4' : '#e4e9dc',
                          color: isWeekend ? '#5b21b6' : '#173c32'
                        }}
                      >
                        <div>{t(day.label)}</div>
                        <span style={{ fontSize: 9.5, opacity: 0.7, fontWeight: 400 }}>{day.short}</span>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody style={{ background: '#fffefa' }}>
                {matrix.map((row, idx) => (
                  <tr key={idx}>
                    <th
                      style={{
                        padding: '12px 14px',
                        textAlign: 'left',
                        background: '#f3f6ee',
                        borderRight: '1px solid #cbd2c2',
                        borderBottom: '1px solid #cbd2c2',
                        position: 'sticky',
                        left: 0,
                        zIndex: 5
                      }}
                    >
                      <div style={{ fontWeight: 700, color: '#173c32', fontVariantNumeric: 'tabular-nums' }}>
                        {row.time}
                      </div>
                      <div style={{ fontSize: 11, color: '#52655a', fontWeight: 400, marginTop: 2 }}>
                        {t(row.label)}
                      </div>
                    </th>
                    {WEEK_DAYS.map(day => {
                      const dayData = row.days[day.key];
                      const isFlash = dayData.type === 'flash';
                      const isPeak = dayData.type === 'peak';
                      const isWeekend = dayData.type === 'weekend';

                      let badgeStyle = { background: '#f1f4eb', color: '#52655a', border: '1px solid #cbd2c2' };
                      let badgeText = t('Chuẩn');

                      if (isFlash) {
                        badgeStyle = { background: '#d6e9d7', color: '#15803d', border: '1px solid #a7d4aa' };
                        badgeText = t('Giảm 25%');
                      } else if (isPeak) {
                        badgeStyle = { background: '#ffedd5', color: '#9a3412', border: '1px solid #fed7aa' };
                        badgeText = t('Cao điểm');
                      } else if (isWeekend) {
                        badgeStyle = { background: '#f3e8ff', color: '#6b21a8', border: '1px solid #ddd6fe' };
                        badgeText = t('Cuối tuần');
                      }

                      return (
                        <td
                          key={day.key}
                          onClick={() => handleCellClick(row, day.key, dayData)}
                          style={{
                            padding: '12px 10px',
                            textAlign: 'center',
                            borderRight: '1px solid #cbd2c2',
                            borderBottom: '1px solid #cbd2c2',
                            cursor: 'pointer',
                            transition: 'background 0.15s ease',
                            background: isFlash ? '#fbfdf9' : '#ffffff'
                          }}
                        >
                          <div
                            style={{
                              fontWeight: 800,
                              fontSize: 14,
                              color: isFlash ? '#15803d' : '#173c32',
                              fontVariantNumeric: 'tabular-nums'
                            }}
                          >
                            {money(dayData.price)}
                          </div>
                          <span
                            style={{
                              display: 'inline-block',
                              fontSize: 9.5,
                              fontWeight: 700,
                              padding: '1px 6px',
                              borderRadius: 3,
                              marginTop: 4,
                              ...badgeStyle
                            }}
                          >
                            {badgeText}
                          </span>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 3. POLICY & RULES CARDS */}
      <div style={{ marginBottom: 48 }}>
        <h2 style={{ fontSize: 22, color: '#173c32', fontWeight: 800, margin: '0 0 16px' }}>
          {t('Chính sách đặt cọc, Giữ chỗ & Khuyến mãi')}
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16 }}>
          {/* Card 1: Đặt cọc 50% */}
          <article style={{ background: '#fffefa', border: '1px solid #cbd2c2', borderRadius: 8, padding: 22, lineHeight: 1.7 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, color: '#173c32' }}>
              <CreditCard size={18} color="#173c32" />
              <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>{t('Quy định Đặt cọc Giữ chỗ')}</h3>
            </div>
            <p style={{ fontSize: 13, color: '#52655a', margin: '0 0 10px' }}>
              {t('Khách hàng thanh toán')} <b>{settings.depositPercent || 50}%</b> {t('tiền cọc trong vòng')} <b>{settings.holdMinutes || 15} {t('phút')}</b> {t('kể từ lúc đặt sân để hệ thống khóa ca chơi.')}
            </p>
            <p style={{ fontSize: 13, color: '#52655a', margin: 0 }}>
              {t('50% số tiền còn lại sẽ thanh toán tại quầy lễ tân khi check-in hoặc check-out ca chơi.')}
            </p>
          </article>

          {/* Card 2: Hủy & Hoàn cọc */}
          <article style={{ background: '#fffefa', border: '1px solid #cbd2c2', borderRadius: 8, padding: 22, lineHeight: 1.7 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, color: '#173c32' }}>
              <RefreshCw size={18} color="#173c32" />
              <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>{t('Chính sách Hủy sân & Hoàn cọc')}</h3>
            </div>
            <p style={{ fontSize: 13, color: '#52655a', margin: '0 0 10px' }}>
              {t('Hủy trước')} <b>24 {t('giờ')}</b>: {t('Được hoàn')} <b>100%</b> {t('tiền cọc vào ví voucher của tài khoản để đặt ca chơi khác.')}
            </p>
            <p style={{ fontSize: 13, color: '#52655a', margin: 0 }}>
              {t('Hủy trong vòng dưới 24 giờ: Tiền cọc không được hoàn lại do khung giờ đã được giữ riêng.')}
            </p>
          </article>

          {/* Card 3: Khuyến mãi Giờ vàng */}
          <article style={{ background: '#fffefa', border: '1px solid #cbd2c2', borderRadius: 8, padding: 22, lineHeight: 1.7 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, color: '#15803d' }}>
              <Zap size={18} color="#15803d" />
              <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>{t('Khuyến mãi Giờ Vàng Tự Động')}</h3>
            </div>
            <p style={{ fontSize: 13, color: '#52655a', margin: '0 0 10px' }}>
              {t('Khung giờ 09:00 – 16:00 các ngày Thứ 2 đến Thứ 5 được tự động giảm')} <b>25%</b> {t('trên toàn bộ hệ thống sân.')}
            </p>
            <p style={{ fontSize: 13, color: '#52655a', margin: 0 }}>
              {t('Hệ thống tự động áp giá ưu đãi trực tiếp mà người chơi không cần nhập mã khuyến mãi.')}
            </p>
          </article>
        </div>
      </div>

      {/* 4. MODAL DRAWER ON CELL CLICK */}
      {modalCell && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(14, 36, 22, 0.65)',
            backdropFilter: 'blur(3px)',
            zIndex: 100,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16
          }}
          onClick={() => setModalCell(null)}
        >
          <div
            style={{
              background: '#f6f4ee',
              borderRadius: 12,
              maxWidth: 440,
              width: '100%',
              overflow: 'hidden',
              border: '1px solid #b5c3ad',
              boxShadow: '0 16px 40px rgba(0,0,0,0.2)'
            }}
            onClick={e => e.stopPropagation()}
          >
            <div
              style={{
                background: '#173c32',
                color: '#ffffff',
                padding: '16px 20px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}
            >
              <div>
                <span
                  style={{
                    fontSize: 11,
                    textTransform: 'uppercase',
                    letterSpacing: '0.1em',
                    color: '#def46a',
                    fontWeight: 700
                  }}
                >
                  {modalCell.courtName}
                </span>
                <h3 style={{ fontSize: 16, fontWeight: 700, margin: '4px 0 0' }}>
                  {t(modalCell.dayMeta.label)} · {modalCell.block.time}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setModalCell(null)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'rgba(255,255,255,0.8)',
                  fontSize: 22,
                  cursor: 'pointer',
                  padding: 4
                }}
              >
                ✕
              </button>
            </div>

            <div style={{ padding: 20 }}>
              <div
                style={{
                  background: '#fffefa',
                  padding: 16,
                  borderRadius: 8,
                  border: '1px solid #cbd2c2',
                  marginBottom: 16
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#52655a', marginBottom: 6 }}>
                  <span>{t('Giá niêm yết chuẩn')}:</span>
                  <span style={{ textDecoration: modalCell.isDiscount ? 'line-through' : 'none' }}>
                    {money(modalCell.origPrice)}
                  </span>
                </div>
                {modalCell.isDiscount && (
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      fontSize: 12,
                      color: '#15803d',
                      fontWeight: 700,
                      marginBottom: 8
                    }}
                  >
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Zap size={14} /> {t('Ưu đãi Giờ Vàng')}:
                    </span>
                    <span>
                      -25% ({t('Tiết kiệm')} {money(modalCell.origPrice - modalCell.price)})
                    </span>
                  </div>
                )}
                <div
                  style={{
                    paddingTop: 8,
                    borderTop: '1px solid #cbd2c2',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    fontSize: 16,
                    fontWeight: 800,
                    color: '#173c32'
                  }}
                >
                  <span>{t('Giá áp dụng')}:</span>
                  <span style={{ color: '#15803d', fontSize: 19 }}>
                    {money(modalCell.price)} / {t('giờ')}
                  </span>
                </div>
              </div>

              <div
                style={{
                  background: '#eef2e7',
                  padding: 12,
                  borderRadius: 8,
                  border: '1px solid #cbd2c2',
                  fontSize: 12,
                  color: '#52655a',
                  marginBottom: 20
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 6, borderBottom: '1px solid #d8e0ce' }}>
                  <span>{t('Tiền cọc giữ chỗ')} ({modalCell.depositPercent}%):</span>
                  <b style={{ color: '#173c32' }}>{money(modalCell.depositPrice)}</b>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #d8e0ce' }}>
                  <span>{t('Thời hạn giữ chỗ')}:</span>
                  <b style={{ color: '#173c32' }}>
                    {settings.holdMinutes || 15} {t('phút')} ({t('Đếm ngược')})
                  </b>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 6 }}>
                  <span>{t('Chính sách hoàn tiền')}:</span>
                  <span style={{ color: '#15803d', fontWeight: 600 }}>{t('Hoàn 100% nếu hủy trước 24h')}</span>
                </div>
              </div>

              <button
                type="button"
                onClick={handleBookNow}
                style={{
                  width: '100%',
                  padding: '12px 20px',
                  borderRadius: 6,
                  background: '#173c32',
                  color: '#f6f4ee',
                  fontSize: 13,
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  boxShadow: '0 4px 12px rgba(23,60,50,0.2)'
                }}
              >
                <span>{t('Tiến hành đặt sân ngay')}</span>
                <ArrowUpRight size={16} />
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
