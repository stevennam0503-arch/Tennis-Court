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
  Star,
  CheckCircle2,
  MessageSquare
} from 'lucide-react';
import tree from './overview.json';
import { useGuest, Action, dateToday, zone } from './context';
import { EventCards } from './Tournaments';

const icons = {
  'arrow-up-right': ArrowUpRight,
  'arrow-down': ArrowDown,
  armchair: Armchair,
  coffee: Coffee,
  'shower-head': ShowerHead,
  'square-parking': SquareParking,
  dumbbell: Dumbbell,
  'clipboard-check': ClipboardCheck,
  sparkles: Sparkles
};

const FEATURED_TESTIMONIALS = [
  {
    name: 'Trần Hoàng Nam',
    role: 'Hội viên Club Plus',
    initials: 'HN',
    bg: '#047857',
    stars: 5,
    tag: 'Sân B02 Trong Nhà',
    comment:
      'Mặt sân trong nhà Khu B đánh rất êm chân, độ nảy bóng chuẩn. Mái che cao ráo, quạt thông gió chạy mát rượi dù ngoài trời đang mưa to. Nhóm mình đánh 3 tiếng liên tục rất đã!'
  },
  {
    name: 'Lê Thị Thảo',
    role: 'Khách hàng thân thiết',
    initials: 'LT',
    bg: '#b45309',
    stars: 5,
    tag: 'Dịch vụ Trọng tài',
    comment:
      'Lần đầu thuê trọng tài qua web khi đặt sân, anh Trọng tài Huy cực kỳ đúng giờ, bắt bóng chuẩn xác và giữ nhịp trận đấu rất chuyên nghiệp. Phòng thay đồ sạch sẽ, thơm tho.'
  },
  {
    name: 'Đặng Hoàng Long',
    role: 'Hội viên VIP',
    initials: 'HL',
    bg: '#1e3a8a',
    stars: 5,
    tag: 'Sân V01 VIP Lounge',
    comment:
      'Sân VIP rất riêng tư và đẳng cấp, có phòng chờ máy lạnh và minibar tiện lợi để tiếp đối tác. Check-in quét mã QR tại quầy chỉ mất đúng 3 giây, không phải chờ đợi.'
  }
];

export default function Overview() {
  const { t, navigate, date, setDate, setPreferredZone, preferredZone, data } = useGuest();

  const quick = (
    <section className="ct-quick-book">
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
        <input type="date" value={date} min={dateToday()} onChange={e => e.target.value && setDate(e.target.value)} />
      </label>
      <label>
        {t('Khu sân')}
        <select onChange={e => setPreferredZone(e.target.value)} defaultValue="A">
          <option value="A">{t('Ngoài trời')}</option>
          <option value="B">{t('Trong nhà')}</option>
          <option value="V">VIP</option>
        </select>
      </label>
      <Action
        onClick={() => {
          if (preferredZone === 'ALL') setPreferredZone('A');
          navigate('booking');
        }}
      >
        {t('Tìm giờ trống')}
        <ArrowUpRight />
      </Action>
    </section>
  );

  function render(n, key) {
    if (typeof n === 'string') return t(n.trim());
    const a = n.attrs || {};
    if (a.class === 'ct-quick-book') return <React.Fragment key={key}>{quick}</React.Fragment>;
    if ('data-overview-events' in a)
      return (
        <EventCards
          key={key}
          events={(data?.tournaments || []).filter(x => x.start >= dateToday() && x.status === 'OPEN').slice(0, 3)}
        />
      );
    if ('data-overview-events-empty' in a) return null;
    if (a.class === 'ce-proposal' || a.class === 'haus-fine-print') return null;
    if (a['data-lucide']) {
      const I = icons[a['data-lucide']] || ArrowUpRight;
      return <I key={key} aria-hidden="true" />;
    }
    const props = { key };
    for (const [k, v] of Object.entries(a)) {
      if (k === 'style' || k === 'hidden') continue;
      if (k === 'class') props.className = v;
      else if (k === 'aria-label') props[k] = t(v);
      else if (k === 'src') props[k] = v.replace('assets/images/', '/guest/');
      else props[k] = v === null ? '' : v;
    }
    const dest = a['data-page'] || a['data-info'];
    if (dest) props.onClick = () => navigate(dest === 'courts' ? 'booking' : dest === 'overview' ? 'about' : dest);
    if (a['data-choose-court'])
      props.onClick = () => {
        setPreferredZone(a['data-choose-court'][0]);
        navigate('booking');
      };
    if ('data-book-referee' in a) props.onClick = () => navigate('booking');
    if (a.class === 'ce-ref-rate')
      return (
        <div className="ce-ref-rate" key={key}>
          <strong>{t('Trọng tài theo lịch trống thực tế')}</strong>
          <span>{t('Phí được tính riêng theo khoảng giờ đã chọn.')}</span>
        </div>
      );
    return React.createElement(n.tag, props, ...n.children.map((c, i) => render(c, key + '-' + i)));
  }

  return (
    <>
      {render(tree, 'overview')}

      {/* TESTIMONIALS STRIP ON HOMEPAGE */}
      <section
        className="ct-pad"
        style={{
          maxWidth: 1200,
          margin: '20px auto 40px',
          padding: '40px 24px',
          borderTop: '1px solid #e3e9dd'
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 16,
            marginBottom: 28
          }}
        >
          <div>
            <span className="ct-eyebrow" style={{ color: '#173c32', letterSpacing: 2 }}>
              COMMUNITY VOICES · 4.9 ★ (280+ ĐÁNH GIÁ)
            </span>
            <h2 style={{ fontSize: 28, color: '#173c32', margin: '8px 0 0', fontWeight: 800 }}>
              {t('Trải nghiệm thực tế từ cộng đồng người chơi 🎾')}
            </h2>
          </div>
          <button
            type="button"
            onClick={() => navigate('feedback')}
            style={{
              background: '#173c32',
              color: '#def46a',
              border: 'none',
              borderRadius: 30,
              padding: '10px 20px',
              fontSize: 13,
              fontWeight: 700,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6
            }}
          >
            <MessageSquare size={14} />
            <span>{t('Xem tất cả & Viết đánh giá')}</span>
            <ArrowUpRight size={14} />
          </button>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
            gap: 20
          }}
        >
          {FEATURED_TESTIMONIALS.map((item, idx) => (
            <div
              key={idx}
              style={{
                background: '#ffffff',
                border: '1px solid #dce4d6',
                borderRadius: 16,
                padding: '24px',
                boxShadow: '0 4px 18px rgba(23,60,50,0.04)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between'
              }}
            >
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                  <div style={{ display: 'flex', gap: 3, color: '#eab308' }}>
                    {[1, 2, 3, 4, 5].map(s => (
                      <Star key={s} size={15} fill="#eab308" strokeWidth={0} />
                    ))}
                  </div>
                  <span
                    style={{
                      background: '#f2f6ee',
                      color: '#173c32',
                      fontSize: 11,
                      fontWeight: 700,
                      padding: '2px 8px',
                      borderRadius: 12
                    }}
                  >
                    {item.tag}
                  </span>
                </div>

                <p
                  style={{
                    fontSize: 13.5,
                    color: '#334155',
                    lineHeight: 1.65,
                    margin: '0 0 18px',
                    fontStyle: 'italic'
                  }}
                >
                  "{item.comment}"
                </p>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 10, borderTop: '1px solid #f1f4ec', paddingTop: 14 }}>
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: '50%',
                    background: item.bg,
                    color: '#ffffff',
                    display: 'grid',
                    placeItems: 'center',
                    fontSize: 13,
                    fontWeight: 700
                  }}
                >
                  {item.initials}
                </div>
                <div>
                  <strong style={{ fontSize: 13.5, color: '#173c32', display: 'block' }}>{item.name}</strong>
                  <span style={{ fontSize: 11.5, color: '#059669', display: 'flex', alignItems: 'center', gap: 3, fontWeight: 600 }}>
                    <CheckCircle2 size={12} /> {item.role}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
