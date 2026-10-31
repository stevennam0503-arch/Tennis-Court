import React, { useState } from 'react';
import { Sun, House, Crown, ArrowUpRight, Zap, Clock, ShieldCheck, CheckCircle2, Ticket, Gift, LogIn, AlertCircle, CreditCard, RefreshCw, Scale } from 'lucide-react';
import { useGuest, Action, Empty, money, zone } from './context';
import { WEEK_DAYS, getCourtMatrix } from './pricing.mjs';

const TABS = [
  { id: 'A', name: 'Sân Ngoài Trời', Icon: Sun, defaultMin: 105000 },
  { id: 'B', name: 'Mái Che Trong Nhà', Icon: House, defaultMin: 135000 },
  { id: 'V', name: 'Sân VIP Clubhouse', Icon: Crown, defaultMin: 200000 }
];

export default function Pricing() {
  const { t, data, setPreferredZone, navigate } = useGuest();
  const [selectedZone, setSelectedZone] = useState('A');
  const [modalCell, setModalCell] = useState(null);

  const settings = data?.settings || {};
  const policies = settings.policies || {};

  // Find courts in the selected zone
  const courtsInZone = (data?.courts || []).filter(c => zone(c) === selectedZone && c.status !== 'DELETED');
  const activeCourt = courtsInZone.find(c => c.status === 'ACTIVE') || courtsInZone[0];

  // Dynamic minimum price for each zone based on current court prices & pricing rules
  const getTabMinPrice = (tabId, defaultFallback) => {
    const courtsInThisZone = (data?.courts || []).filter(c => zone(c) === tabId && c.status !== 'DELETED');
    if (!courtsInThisZone.length) return defaultFallback;
    const repCourt = courtsInThisZone.find(c => c.status === 'ACTIVE') || courtsInThisZone[0];
    const m = getCourtMatrix(repCourt, data?.prices || []);
    if (m && m.length > 0) {
      let minVal = Infinity;
      for (const block of m) {
        for (const dayKey of Object.keys(block.days || {})) {
          const p = block.days[dayKey]?.price;
          if (p && p < minVal) minVal = p;
        }
      }
      if (minVal !== Infinity) return minVal;
    }
    return Math.round(Number(repCourt.price || defaultFallback) * 0.75);
  };

  // Calculate pricing matrix for active court
  const matrix = activeCourt ? getCourtMatrix(activeCourt, data?.prices || []) : [];

  const handleCellClick = (block, dayKey, dayData) => {
    const dayMeta = WEEK_DAYS.find(d => d.key === dayKey);
    const isDiscount = dayData.type === 'flash';
    const origPrice = isDiscount ? Math.round(dayData.price / 0.75) : dayData.price;
    const depositPercent = settings.depositPercent || 30;
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

  return (
    <section className="ct-pad gx-pricing" style={{ maxWidth: 1200, margin: '0 auto' }}>
      {/* Header */}
      <div className="gx-heading" style={{ marginBottom: 28 }}>
        <span className="ct-eyebrow" style={{ color: '#6b8274', letterSpacing: '0.15em', fontWeight: 700, fontSize: 12 }}>
          COURTLY · {t('BẢNG GIÁ NIÊM YẾT 2026')}
        </span>
        <h1 style={{ color: '#173c32', fontSize: 'clamp(28px, 3.5vw, 40px)', fontWeight: 800, margin: '8px 0 12px' }}>
          {t('Bảng giá sân theo ngày & khung giờ')}
        </h1>
        <p style={{ color: '#52655a', fontSize: 14, lineHeight: 1.6, maxWidth: 720 }}>
          {t('Biểu phí chuẩn theo giờ và phân bổ riêng biệt cho từng ngày trong tuần. Khung Giờ Vàng (-25%) tự động áp dụng trực tiếp khi tạo đơn.')}
        </p>
      </div>

      {/* 1. HORIZONTAL TABS SELECTOR (HÀNG NGANG GỌN GÀNG, KHÔNG CÓ CHỮ NHỎ SÂN 1-4, KHÔNG CÓ Ô ĐƠN VỊ) */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <span style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#6b8274' }}>
            {t('Chọn loại sân')}:
          </span>
          <span style={{ fontSize: 12, color: '#52655a' }}>
            {t('Nhấp vào tab để xem biểu giá tương ứng')}
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12 }}>
          {TABS.map(tab => {
            const isActive = selectedZone === tab.id;
            const Icon = tab.Icon;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setSelectedZone(tab.id)}
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
                  <span style={{ fontSize: 14, fontWeight: 700, letterSpacing: '-0.2px' }}>
                    {t(tab.name)}
                  </span>
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
                  {t('Từ')} {money(getTabMinPrice(tab.id, tab.defaultMin))}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. THE EXCEL MATRIX TABLE */}
      <div style={{ background: '#fffefa', borderRadius: 10, border: '1px solid #cbd2c2', overflow: 'hidden', boxShadow: '0 2px 12px rgba(23,60,50,0.06)', marginBottom: 36 }}>
        {/* Sub-bar */}
        <div style={{ background: '#edf1e6', padding: '12px 18px', borderBottom: '1px solid #cbd2c2', display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
            <span style={{ fontWeight: 700, textTransform: 'uppercase', color: '#173c32' }}>{t('Đang xem')}:</span>
            <span style={{ fontWeight: 700, background: '#ffffff', color: '#173c32', padding: '3px 10px', borderRadius: 4, border: '1px solid #bfc7ba' }}>
              {t(TABS.find(z => z.id === selectedZone)?.name || 'Sân Ngoài Trời')}
            </span>
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

        {/* Matrix Table */}
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#e4e9dc', color: '#173c32', fontWeight: 700, textTransform: 'uppercase', fontSize: 11 }}>
                <th style={{ padding: '12px 14px', width: 160, textAlign: 'center', background: '#d8e0ce', borderRight: '1px solid #cbd2c2', borderBottom: '1px solid #cbd2c2', position: 'sticky', left: 0, zIndex: 10 }}>
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
                  <th style={{ padding: '12px 14px', textAlign: 'left', background: '#f3f6ee', borderRight: '1px solid #cbd2c2', borderBottom: '1px solid #cbd2c2', position: 'sticky', left: 0, zIndex: 5 }}>
                    <div style={{ fontWeight: 700, color: '#173c32', fontVariantNumeric: 'tabular-nums' }}>{row.time}</div>
                    <div style={{ fontSize: 11, color: '#52655a', fontWeight: 400, marginTop: 2 }}>{t(row.label)}</div>
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
                      badgeStyle = { background: '#ede8f5', color: '#5b21b6', border: '1px solid #ddd6fe' };
                      badgeText = t('Cuối tuần');
                    }

                    return (
                      <td
                        key={day.key}
                        onClick={() => handleCellClick(row, day.key, dayData)}
                        title={t('Bấm để xem chi tiết tiền cọc & giữ chỗ')}
                        style={{
                          padding: '10px 8px',
                          textAlign: 'center',
                          borderRight: '1px solid #cbd2c2',
                          borderBottom: '1px solid #cbd2c2',
                          cursor: 'pointer',
                          transition: 'background-color 0.15s ease'
                        }}
                        onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#f0f4ea')}
                        onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                      >
                        <div style={{ fontWeight: 800, color: '#173c32', fontVariantNumeric: 'tabular-nums', fontSize: 13.5 }}>
                          {money(dayData.price)}
                        </div>
                        <span style={{ display: 'inline-block', fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 4, marginTop: 3, ...badgeStyle }}>
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

        {/* Footer Note */}
        <div style={{ background: '#edf1e6', padding: '12px 18px', borderTop: '1px solid #cbd2c2', display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 12, fontSize: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#52655a' }}>
            <CheckCircle2 size={15} color="#173c32" />
            <span>{t('Bấm trực tiếp vào ô giá bất kỳ để xem tiền cọc 30% và chuyển sang đặt lịch.')}</span>
          </div>
          <div style={{ fontWeight: 700, color: '#173c32' }}>
            {t('Hội viên Courtly')}: <span style={{ color: '#15803d' }}>{t('Giảm thêm từ 10% – 20% trên giá niêm yết')}</span>
          </div>
        </div>
      </div>

      {/* 3. BỘ CHÍNH SÁCH VẬN HÀNH ĐẦY ĐỦ 7 NHÓM */}
      <div style={{ marginTop: 44 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
          <ShieldCheck size={24} color="#173c32" />
          <h2 style={{ fontSize: 22, fontWeight: 800, color: '#173c32', margin: 0 }}>
            {t('Quy định & Chính sách hoạt động của CLB')}
          </h2>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 20 }}>
          
          {/* Card 1: Tiền cọc */}
          <article style={{ background: '#fffefa', border: '1px solid #cbd2c2', borderRadius: 8, padding: 22, lineHeight: 1.7 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, color: '#173c32' }}>
              <CreditCard size={18} color="#173c32" />
              <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>{t('Tiền cọc & Thanh toán')}</h3>
            </div>
            <p style={{ fontSize: 13, color: '#52655a', margin: '0 0 10px' }}>
              {t('Đặt sân trực tuyến yêu cầu cọc')} <b>{settings.depositPercent || 30}%</b> {t('tiền sân sau khi trừ ưu đãi hội viên và voucher. Miễn cọc cho hội viên VIP.')}
            </p>
            <p style={{ fontSize: 13, color: '#52655a', margin: 0 }}>
              {t('Thanh toán cọc nhanh qua mã VietQR tự động xác nhận trong 3 giây hoặc nộp tiền mặt tại quầy lễ tân.')}
            </p>
          </article>

          {/* Card 2: Giữ chỗ */}
          <article style={{ background: '#fffefa', border: '1px solid #cbd2c2', borderRadius: 8, padding: 22, lineHeight: 1.7 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, color: '#173c32' }}>
              <Clock size={18} color="#173c32" />
              <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>{t('Thời hạn giữ chỗ 15 phút')}</h3>
            </div>
            <p style={{ fontSize: 13, color: '#52655a', margin: '0 0 10px' }}>
              {t('Hệ thống giữ chỗ trong')} <b>{settings.holdMinutes || 15} {t('phút')}</b> {t('kể từ khi tạo đơn. Khung giờ được khóa độc quyền để không ai khác đặt trùng.')}
            </p>
            <p style={{ fontSize: 13, color: '#52655a', margin: 0 }}>
              {t('Hết 15 phút đếm ngược nếu chưa hoàn tất tiền cọc, hệ thống tự động hủy đơn và giải phóng lịch cho khách khác.')}
            </p>
          </article>

          {/* Card 3: Hủy & Đổi lịch */}
          <article style={{ background: '#fffefa', border: '1px solid #cbd2c2', borderRadius: 8, padding: 22, lineHeight: 1.7 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, color: '#173c32' }}>
              <RefreshCw size={18} color="#173c32" />
              <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>{t('Quy định Hủy / Đổi lịch')}</h3>
            </div>
            <p style={{ fontSize: 13, color: '#52655a', margin: '0 0 10px' }}>
              {t('Hủy trước')} <b>{policies.cancelCutoffMinutes ? Math.round(policies.cancelCutoffMinutes / 60) : 24} {t('tiếng')}</b>: {t('Hoàn')} <b>{settings.cancelRefundPercent || 100}%</b> {t('tiền cọc vào ví hoàn của bạn. Hủy dưới 6 tiếng không hoàn cọc.')}
            </p>
            <p style={{ fontSize: 13, color: '#52655a', margin: 0 }}>
              {t('Đổi lịch trước 24 tiếng hoàn toàn miễn phí. Hệ thống tự động bù hoặc hoàn chênh lệch giá giữa các khung giờ.')}
            </p>
          </article>

          {/* Card 4: Trọng tài & HLV */}
          <article style={{ background: '#fffefa', border: '1px solid #cbd2c2', borderRadius: 8, padding: 22, lineHeight: 1.7 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, color: '#173c32' }}>
              <Scale size={18} color="#173c32" />
              <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>{t('Dịch vụ Trọng tài & HLV')}</h3>
            </div>
            {data?.refereeRates?.length ? (
              <ul style={{ margin: '0 0 10px', paddingLeft: 18, fontSize: 13, color: '#52655a' }}>
                {data.refereeRates.slice(0, 3).map((r, i) => (
                  <li key={i}>
                    <strong>{r.name}</strong> {r.level && `· ${r.level}`}: <b>{money(r.rate)}</b> / {t('giờ')}
                  </li>
                ))}
              </ul>
            ) : (
              <p style={{ fontSize: 13, color: '#52655a', margin: '0 0 10px' }}>
                {t('Thù lao niêm yết từ 100.000 đ – 250.000 đ/giờ tùy cấp bậc trọng tài.')}
              </p>
            )}
            <p style={{ fontSize: 13, color: '#52655a', margin: 0 }}>
              {t('Tính theo slot 30 phút. Trọng tài có mặt trước trận 10 phút kiểm tra bóng và mặt sân tiêu chuẩn.')}
            </p>
          </article>

          {/* Card 5: Khuyến mãi tự động */}
          <article style={{ background: '#fffefa', border: '1px solid #cbd2c2', borderRadius: 8, padding: 22, lineHeight: 1.7 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, color: '#173c32' }}>
              <Zap size={18} color="#15803d" />
              <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>{t('Khuyến mãi Giờ Vàng Tự Động')}</h3>
            </div>
            <p style={{ fontSize: 13, color: '#52655a', margin: '0 0 10px' }}>
              {t('Khung giờ 09:00 – 16:00 các ngày Thứ 2 đến Thứ 5 được tự động giảm')} <b>25%</b> {t('trên toàn bộ hệ thống sân.')}
            </p>
            <p style={{ fontSize: 13, color: '#52655a', margin: 0 }}>
              {t('Đến đúng khung giờ khuyến mãi, hệ thống tự động áp giá ưu đãi mà người chơi không cần nhập mã.')}
            </p>
          </article>

          {/* Card 6: Voucher & Điểm thưởng */}
          <article style={{ background: '#fffefa', border: '1px solid #cbd2c2', borderRadius: 8, padding: 22, lineHeight: 1.7 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, color: '#173c32' }}>
              <Ticket size={18} color="#173c32" />
              <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>{t('Chính sách Voucher & Đổi Điểm')}</h3>
            </div>
            <p style={{ fontSize: 13, color: '#52655a', margin: '0 0 10px' }}>
              {t('Người dùng nhập mã voucher tại trang đặt sân hoặc quầy thu ngân để được khấu trừ trực tiếp vào tiền cọc.')}
            </p>
            <p style={{ fontSize: 13, color: '#52655a', margin: 0 }}>
              {t('Tích lũy 10 điểm cho mỗi 100.000 đ chi tiêu để đổi voucher giảm 50k, 100k cho các lượt đặt sân.')}
            </p>
          </article>

          {/* Card 7: Check-in / Check-out */}
          <article style={{ background: '#fffefa', border: '1px solid #cbd2c2', borderRadius: 8, padding: 22, lineHeight: 1.7 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, color: '#173c32' }}>
              <LogIn size={18} color="#173c32" />
              <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>{t('Quy định Check-in & Check-out')}</h3>
            </div>
            <p style={{ fontSize: 13, color: '#52655a', margin: '0 0 10px' }}>
              {t('Cho phép quét mã QR vé điện tử sớm tối đa')} <b>15 {t('phút')}</b> {t('để nhận sân. Thời gian ân hạn dọn sân là 5 phút sau khi hết giờ.')}
            </p>
            <p style={{ fontSize: 13, color: '#52655a', margin: 0 }}>
              {t('Chơi quá giờ khi sân sau trống sẽ tính phí gia hạn theo slot; nếu có khách kế tiếp, áp dụng phí phụ thu chiếm sân.')}
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
            <div style={{ background: '#173c32', color: '#ffffff', padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <span style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#def46a', fontWeight: 700 }}>
                  {modalCell.courtName}
                </span>
                <h3 style={{ fontSize: 16, fontWeight: 700, margin: '4px 0 0' }}>
                  {t(modalCell.dayMeta.label)} · {modalCell.block.time}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setModalCell(null)}
                style={{ background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.8)', fontSize: 22, cursor: 'pointer', padding: 4 }}
              >
                ✕
              </button>
            </div>

            <div style={{ padding: 20 }}>
              <div style={{ background: '#fffefa', padding: 16, borderRadius: 8, border: '1px solid #cbd2c2', marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#52655a', marginBottom: 6 }}>
                  <span>{t('Giá niêm yết chuẩn')}:</span>
                  <span style={{ textDecoration: modalCell.isDiscount ? 'line-through' : 'none' }}>
                    {money(modalCell.origPrice)}
                  </span>
                </div>
                {modalCell.isDiscount && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#15803d', fontWeight: 700, marginBottom: 8 }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Zap size={14} /> {t('Ưu đãi Giờ Vàng')}:
                    </span>
                    <span>-25% ({t('Tiết kiệm')} {money(modalCell.origPrice - modalCell.price)})</span>
                  </div>
                )}
                <div style={{ paddingTop: 8, borderTop: '1px solid #cbd2c2', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 16, fontWeight: 800, color: '#173c32' }}>
                  <span>{t('Giá áp dụng')}:</span>
                  <span style={{ color: '#15803d', fontSize: 19 }}>{money(modalCell.price)} / {t('giờ')}</span>
                </div>
              </div>

              <div style={{ background: '#eef2e7', padding: 12, borderRadius: 8, border: '1px solid #cbd2c2', fontSize: 12, color: '#52655a', marginBottom: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 6, borderBottom: '1px solid #d8e0ce' }}>
                  <span>{t('Tiền cọc giữ chỗ')} ({modalCell.depositPercent}%):</span>
                  <b style={{ color: '#173c32' }}>{money(modalCell.depositPrice)}</b>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #d8e0ce' }}>
                  <span>{t('Thời hạn giữ chỗ')}:</span>
                  <b style={{ color: '#173c32' }}>{settings.holdMinutes || 15} {t('phút')} ({t('Đếm ngược')})</b>
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
