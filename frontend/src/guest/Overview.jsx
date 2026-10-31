import React from 'react';
import {
  ArrowUpRight,
  ArrowDown,
  Armchair,
  Coffee,
  ShowerHead,
  SquareParking,
  Dumbbell,
  ClipboardCheck,
  Sparkles,
  Award,
  Calendar,
  Clock,
  ShieldCheck,
  CheckCircle2,
  ChevronRight
} from 'lucide-react';
import { useGuest, Action, dateToday } from './context';
import { EventCards } from './Tournaments';

export default function Overview() {
  const { t, navigate, date, setDate, setPreferredZone, preferredZone, data } = useGuest();

  return (
    <div data-screen="about">
      {/* 1. HERO SECTION */}
      <section className="haus-hero" aria-label="Courtly Tennis Club">
        <div className="haus-hero-top">
          <span>TENNIS. COMMUNITY. COURTLY.</span>
          <span>{t('MỖI LẦN RA SÂN, MỘT NIỀM VUI.')}</span>
        </div>

        <div className="haus-hero-center">
          <p>{t('THỜI GIAN CỦA BẠN. TRẬN ĐẤU CỦA BẠN.')}</p>
          <h1>
            {t('HẸN NHAU')}
            <br />
            {t('TRÊN SÂN.')}
          </h1>
          <p style={{ fontSize: 16, color: '#f1f5ed', maxWidth: 620, margin: '14px auto 28px', lineHeight: 1.6, letterSpacing: 'normal' }}>
            {t('Khám phá tổ hợp 10 sân tennis tiêu chuẩn quốc tế – Đặt sân nhanh chóng, hỗ trợ trọng tài và tiện ích thư giãn cao cấp.')}
          </p>
          <button className="haus-hero-cta cursor-interaction" onClick={() => navigate('booking')}>
            {t('Đặt sân ngay')}
            <span>
              <ArrowUpRight size={18} />
            </span>
          </button>
        </div>

        <div className="haus-hero-bottom">
          <span>{t('TENNIS THEO NHỊP CỦA BẠN.')}</span>
          <span
            style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}
            onClick={() => {
              document.querySelector('.ct-quick-book')?.scrollIntoView({ behavior: 'smooth' });
            }}
          >
            {t('KHÁM PHÁ COURTLY')} <ArrowDown size={14} />
          </span>
        </div>
      </section>

      {/* 2. QUICK BOOK FLOATING BAR */}
      <section className="ct-quick-book" aria-label={t('Tìm sân nhanh')}>
        <div className="haus-quick-intro">
          <span className="ct-eyebrow">LET'S PLAY</span>
          <strong>
            {t('Trận tiếp theo')}
            <br />
            {t('bắt đầu từ đây.')}
          </strong>
        </div>

        <label>
          {t('Ngày chơi')}
          <input
            type="date"
            value={date}
            min={dateToday()}
            onChange={e => e.target.value && setDate(e.target.value)}
          />
        </label>

        <label>
          {t('Khu sân')}
          <select
            value={preferredZone === 'ALL' ? 'A' : preferredZone}
            onChange={e => setPreferredZone(e.target.value)}
          >
            <option value="A">{t('Ngoài trời')} (Khu A)</option>
            <option value="B">{t('Trong nhà')} (Khu B)</option>
            <option value="V">VIP (Khu V)</option>
          </select>
        </label>

        <Action
          onClick={() => {
            if (preferredZone === 'ALL') setPreferredZone('A');
            navigate('booking');
          }}
        >
          {t('Tìm giờ trống')} <ArrowUpRight size={18} />
        </Action>
      </section>

      {/* 3. COURTS SHOWCASE */}
      <section className="haus-courts ct-pad">
        <div className="haus-section-head">
          <h2>
            {t('Sân của bạn.')}
            <br />
            {t('Cuộc chơi của bạn.')}
          </h2>
          <div>
            <p>{t('Chọn khu sân yêu thích, tìm giờ phù hợp và dành thời gian cho tennis.')}</p>
            <button className="ct-text-button cursor-interaction" onClick={() => navigate('booking')}>
              {t('Khám phá lịch sân')} <ArrowUpRight size={16} />
            </button>
          </div>
        </div>

        <div className="haus-court-grid cm-overview-courts">
          {/* Khu A - Ngoài trời */}
          <article
            className="gx-court-card"
            onClick={() => {
              setPreferredZone('A');
              navigate('booking');
            }}
            style={{ cursor: 'pointer' }}
          >
            <div className="haus-court-img cv-zone-a-photo" role="img" aria-label={t('Ảnh minh họa sân ngoài trời')}>
              <span>{t('NGOÀI TRỜI')}</span>
              <button className="haus-round cursor-interaction" aria-label={t('Chọn khu sân ngoài trời')}>
                <ArrowUpRight size={18} />
              </button>
            </div>
            <div className="haus-court-caption">
              <div>
                <h3 style={{ fontSize: 22, color: '#173c32', margin: '0 0 4px', fontWeight: 700 }}>{t('Khu A')}</h3>
                <span style={{ fontSize: 13, color: '#59635d' }}>{t('A01–A04 · 4 sân')}</span>
              </div>
              <div className="gx-court-perks">
                <span>🌿 {t('Mặt sân cứng tiêu chuẩn, thoáng mát')}</span>
                <span>💡 {t('Đèn LED 500 Lux chống chói ban đêm')}</span>
              </div>
            </div>
          </article>

          {/* Khu B - Trong nhà */}
          <article
            className="gx-court-card"
            onClick={() => {
              setPreferredZone('B');
              navigate('booking');
            }}
            style={{ cursor: 'pointer' }}
          >
            <div className="haus-court-img cv-zone-b-photo" role="img" aria-label={t('Ảnh minh họa sân trong nhà')}>
              <span>{t('TRONG NHÀ')}</span>
              <button className="haus-round cursor-interaction" aria-label={t('Chọn khu sân trong nhà')}>
                <ArrowUpRight size={18} />
              </button>
            </div>
            <div className="haus-court-caption">
              <div>
                <h3 style={{ fontSize: 22, color: '#173c32', margin: '0 0 4px', fontWeight: 700 }}>{t('Khu B')}</h3>
                <span style={{ fontSize: 13, color: '#59635d' }}>{t('B01–B04 · 4 sân')}</span>
              </div>
              <div className="gx-court-perks">
                <span>🏢 {t('Mái che vòm cao cấp, bất chấp thời tiết')}</span>
                <span>🎾 {t('Mặt sân giảm chấn êm ái, bám tốt')}</span>
              </div>
            </div>
          </article>

          {/* Khu V - Sân VIP */}
          <article
            className="gx-court-card"
            onClick={() => {
              setPreferredZone('V');
              navigate('booking');
            }}
            style={{ cursor: 'pointer' }}
          >
            <div className="haus-court-img cv-zone-v-photo" role="img" aria-label={t('Ảnh minh họa khu VIP')}>
              <span>{t('SÂN VIP')}</span>
              <button className="haus-round cursor-interaction" aria-label={t('Chọn sân VIP')}>
                <ArrowUpRight size={18} />
              </button>
            </div>
            <div className="haus-court-caption">
              <div>
                <h3 style={{ fontSize: 22, color: '#173c32', margin: '0 0 4px', fontWeight: 700 }}>{t('Khu V')}</h3>
                <span style={{ fontSize: 13, color: '#59635d' }}>{t('V01–V02 · 2 sân')}</span>
              </div>
              <div className="gx-court-perks">
                <span>⭐ {t('Sân đôi kích thước tiêu chuẩn ATP')}</span>
                <span>🛋️ {t('Phòng chờ VIP riêng & minibar miễn phí')}</span>
              </div>
            </div>
          </article>
        </div>
      </section>

      {/* 4. AMENITIES SECTION */}
      <section className="cm-amenities ct-pad cx-amenities">
        <div className="cm-amenities-head">
          <div>
            <span className="ct-eyebrow">{t('COURTLY / TIỆN ÍCH')}</span>
            <h2>
              {t('Trọn vẹn')}
              <br />
              {t('một buổi chơi.')}
            </h2>
          </div>
          <p>
            {t('10 sân dành cho những nhịp chơi khác nhau. Không gian thể thao tiện nghi và hoàn chỉnh đáp ứng trọn vẹn trước, trong và sau mỗi trận đấu.')}
          </p>
        </div>

        <div className="cm-amenity-row gx-amenities-redesigned">
          <div className="gx-amenity-card">
            <div className="gx-amenity-icon">
              <Armchair size={26} />
            </div>
            <strong>{t('Ghế nghỉ VIP Lounge')}</strong>
            <span>{t('Sofa cao cấp & view toàn cảnh')}</span>
          </div>

          <div className="gx-amenity-card">
            <div className="gx-amenity-icon">
              <Coffee size={26} />
            </div>
            <strong>{t('Cafe & Giải khát')}</strong>
            <span>{t('Thức uống điện giải bù khoáng')}</span>
          </div>

          <div className="gx-amenity-card">
            <div className="gx-amenity-icon">
              <ShowerHead size={26} />
            </div>
            <strong>{t('Phòng tắm nóng lạnh')}</strong>
            <span>{t('Locker tủ đồ bảo mật an toàn')}</span>
          </div>

          <div className="gx-amenity-card">
            <div className="gx-amenity-icon">
              <SquareParking size={26} />
            </div>
            <strong>{t('Bãi giữ xe rộng rãi')}</strong>
            <span>{t('Miễn phí ô tô & xe máy 24/7')}</span>
          </div>

          <div className="gx-amenity-card">
            <div className="gx-amenity-icon">
              <Dumbbell size={26} />
            </div>
            <strong>{t('Khu Warm-up & Giãn cơ')}</strong>
            <span>{t('Dụng cụ khởi động chuẩn thể thao')}</span>
          </div>

          <div className="gx-amenity-card">
            <div className="gx-amenity-icon">
              <Sparkles size={26} />
            </div>
            <strong>{t('Căng vợt & Phụ kiện')}</strong>
            <span>{t('Máy căng điện tử & bóng mới')}</span>
          </div>
        </div>
      </section>

      {/* 5. WAYS TO PLAY SECTION (NO DUPLICATE PHOTO - USES DISTINCT BLUE HARD COURT PHOTO) */}
      <section className="haus-ways">
        <div className="haus-ways-photo" role="img" aria-label={t('Trải nghiệm tennis đỉnh cao tại Courtly')}>
          <div className="gx-ways-photo-banner">
            <span className="gx-ways-badge">EXPERIENCE COURTLY</span>
            <h2>FIND YOUR GAME.</h2>
            <p>{t('Tập trung từng đường bóng · Một mình rèn luyện, cùng đồng đội tranh tài hay tham gia các giải đấu kịch tính.')}</p>
          </div>
        </div>

        <div className="ct-pad">
          <div className="haus-section-head">
            <h2>
              {t('Chơi theo')}
              <br />
              {t('cách của bạn.')}
            </h2>
            <p>{t('Một mình, cùng đồng đội hay trong một giải đấu. Luôn có một cuộc hẹn để chờ đón.')}</p>
          </div>

          <div className="gx-ways-grid">
            <div className="gx-way-card">
              <span className="gx-way-num">01</span>
              <div>
                <h3>{t('Tự do đặt sân')}</h3>
                <p>{t('Chọn sân, chọn nhiều giờ liên tiếp và xem rõ chi phí trước khi xác nhận.')}</p>
              </div>
              <button className="haus-round cursor-interaction" onClick={() => navigate('booking')} aria-label={t('Tự do đặt sân')}>
                <ArrowUpRight size={18} />
              </button>
            </div>

            <div className="gx-way-card">
              <span className="gx-way-num">02</span>
              <div>
                <h3>{t('Trận đấu có trọng tài')}</h3>
                <p>{t('Thêm trọng tài vào đúng khung giờ bạn cần, ngay trong bước đặt sân.')}</p>
              </div>
              <button className="haus-round cursor-interaction" onClick={() => navigate('booking')} aria-label={t('Đặt sân có trọng tài')}>
                <ArrowUpRight size={18} />
              </button>
            </div>

            <div className="gx-way-card">
              <span className="gx-way-num">03</span>
              <div>
                <h3>{t('Thi đấu và kết nối')}</h3>
                <p>{t('Khám phá thể thức, lịch thi đấu và đăng ký giải cùng đồng đội.')}</p>
              </div>
              <button className="haus-round cursor-interaction" onClick={() => navigate('tournaments')} aria-label={t('Khám phá giải đấu')}>
                <ArrowUpRight size={18} />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* 6. REFEREE & COACHING HIGHLIGHT */}
      <section className="ce-ref-overview ct-pad">
        <div className="ce-ref-grid">
          <div className="ce-ref-intro">
            <span className="ct-eyebrow">{t('DỊCH VỤ TRỌNG TÀI')}</span>
            <h2>
              {t('Trận đấu có')}
              <br />
              {t('trọng tài.')}
            </h2>
            <p>{t('Một người giữ nhịp trận đấu, để bạn dành trọn sự tập trung cho từng đường bóng.')}</p>
            <Action onClick={() => navigate('booking')}>
              {t('Chọn giờ & xem trọng tài')} <ArrowUpRight size={16} />
            </Action>
          </div>

          <div className="ce-ref-content">
            <div className="ce-ref-lead">
              <ClipboardCheck size={28} />
              <div>
                <h3>{t('Đúng người. Đúng giờ.')}</h3>
                <p>{t('Xem hồ sơ, kinh nghiệm và mức phí của trọng tài có thể nhận lịch trong khung giờ bạn chọn.')}</p>
              </div>
            </div>

            <ol>
              <li>
                <span>01</span>
                <div>
                  <strong>{t('Chọn sân & giờ chơi')}</strong>
                  <p>{t('Chọn giờ bắt đầu, sau đó chọn giờ kết thúc, theo bước 30 phút.')}</p>
                </div>
              </li>
              <li>
                <span>02</span>
                <div>
                  <strong>{t('Chọn khoảng giờ cần trọng tài')}</strong>
                  <p>{t('Thuê cho cả buổi hoặc một phần thời gian đặt sân.')}</p>
                </div>
              </li>
              <li>
                <span>03</span>
                <div>
                  <strong>{t('Xem hồ sơ & chi phí rõ ràng')}</strong>
                  <p>{t('Chỉ hiện trọng tài còn trống. Phí được tính riêng trước khi thanh toán.')}</p>
                </div>
              </li>
            </ol>

            <div className="ce-ref-rate">
              <strong>{t('Từ 75.000đ / 30 phút')}</strong>
              <span>{t('Mức phí và hồ sơ minh bạch theo thời gian thực.')}</span>
            </div>
          </div>
        </div>
      </section>

      {/* 7. MEMBERSHIP PROMOTION BANNER */}
      <section className="haus-membership">
        <div className="haus-member-art" aria-hidden="true">
          <span>
            THE
            <br />
            COURTLY
            <br />
            CLUB.
          </span>
          <div className="haus-tennis-ball" />
        </div>
        <div className="haus-member-copy">
          <span className="ct-eyebrow">COURTLY MEMBERSHIP</span>
          <h2>
            {t('Thêm lý do')}
            <br />
            {t('để ra sân.')}
          </h2>
          <p>{t('Biến niềm yêu thích thành thói quen. Khám phá gói hội viên, ưu đãi tiền sân và quyền lợi dành cho nhịp chơi của bạn.')}</p>
          <button className="ct-light-button cursor-interaction" onClick={() => navigate('membership')}>
            {t('Khám phá membership')} <ArrowUpRight size={16} />
          </button>
        </div>
      </section>

      {/* 8. TOURNAMENTS SECTION */}
      <section className="haus-events ct-pad">
        <div className="haus-section-head">
          <h2>
            {t('Hẹn nhau')}
            <br />
            {t('ở trận tiếp theo.')}
          </h2>
          <button className="ct-text-button cursor-interaction" onClick={() => navigate('tournaments')}>
            {t('Tất cả giải đấu')} <ArrowUpRight size={16} />
          </button>
        </div>
        <div className="cv-events-list">
          <EventCards
            events={(data?.tournaments || []).filter(x => x.start >= dateToday() && x.status === 'OPEN').slice(0, 3)}
          />
        </div>
      </section>

      {/* 9. FINAL CALL TO ACTION */}
      <section className="haus-end ct-pad">
        <span className="ct-eyebrow">SEE YOU ON COURT</span>
        <h2>
          {t('CHƠI HẾT MÌNH.')}
          <br />
          {t('HẸN NHAU LẦN TỚI.')}
        </h2>
        <button
          className="ct-primary cursor-interaction"
          onClick={() => navigate('booking')}
          style={{ padding: '16px 36px', fontSize: 15, borderRadius: 30, display: 'inline-flex', alignItems: 'center', gap: 10 }}
        >
          {t('Chọn giờ chơi của bạn')} <ArrowUpRight size={18} />
        </button>
      </section>
    </div>
  );
}
