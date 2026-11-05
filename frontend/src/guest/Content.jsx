import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  Star,
  ArrowUpRight,
  ArrowLeft,
  MapPin,
  Phone,
  Mail,
  CheckCircle2,
  ShieldCheck,
  Heart,
  ThumbsUp,
  Sparkles,
  MessageSquare,
  Award,
  CornerDownRight,
  User,
  Clock,
  Calendar,
  Share2,
  Eye,
  BookOpen,
  Tag,
  ChevronLeft,
  ChevronRight,
  Check
} from 'lucide-react';
import { api } from '../services/api';
import { useGuest, Action, Empty, requestId } from './context';
import './feedback.css';

const ARTICLE_CATEGORY = { NEWS: 'Tin tức', NOTICE: 'Thông báo', TOURNAMENT: 'Giải đấu', PROMO: 'Ưu đãi' };

// ==========================================
// ARTICLE READER COMPONENT (CHẾ ĐỘ ĐỌC BÁO THỰC THỤ)
// ==========================================
export function ArticleReader({ article: a, onBack, onSelectArticle, allArticles = [] }) {
  const { t, navigate, lang } = useGuest();
  const [copied, setCopied] = useState(false);

  // Fallback high-res image
  const coverImage =
    a.imageUrl ||
    (a.category === 'TOURNAMENT'
      ? '/guest/ways-banner.webp'
      : a.category === 'COURT'
      ? '/guest/zone-a-outdoor.webp'
      : a.category === 'SERVICE'
      ? '/guest/doubles.webp'
      : '/guest/zone-v-lounge.webp');

  const formattedDate = a.publishedAt ? a.publishedAt.slice(0, 10) : '28/10/2026';

  // Handle Share / Copy Link
  const handleCopyLink = () => {
    try {
      navigator.clipboard?.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {}
  };

  // Enriched paragraphs if backend only provided stubbed test strings
  const getEnrichedBody = () => {
    if (a.body && a.body.length > 200) {
      return a.body.split('\n').filter(Boolean);
    }

    if (lang === 'en') {
      if (a.category === 'TOURNAMENT' || a.source === 'TOURNAMENT') {
        return [
          'The annual tennis tournament at Courtly Tennis Club officially opens its most competitive registration phase of the year, bringing together over 32 standout amateur and semi-pro players from clubs across the region.',
          'Matches are professionally organized in a single-elimination (Knock-out) format across 4 indoor courts in Zone B. Featuring ATP Tour-standard Pro-Cushion cushioned surfaces and anti-glare 500 Lux LED lighting, athletes enjoy ideal playing conditions rain or shine.',
          'This year’s prize pool features honorary championship trophies, commemorative medals, sponsor awards, and a 1-year Grand Slam VIP membership package at Courtly.',
          'All matches are officiated by certified Vietnam Tennis Federation umpires, ensuring fairness, precision, and peak sportsmanship throughout.'
        ];
      }
      if (a.title?.includes('Bảo dưỡng') || a.title?.includes('Khu B') || a.category === 'FACILITY') {
        return [
          'To provide a seamless, safe, and world-class playing experience for all members, Courtly Tennis Club management has completed comprehensive maintenance for all 4 indoor courts in Zone B (B01–B04).',
          'The upgrade highlight is the next-generation 8-layer Pro-Cushion coating technology. The micro-cellular rubber cushion absorbs impact during sprints and sudden directional changes, reducing stress on knees and ankles by up to 28% compared to standard hardcourts.',
          'Additionally, industrial convection ventilation and 500 Lux LED arrays have been calibrated to eliminate glare on overhead smashes.',
          'At Courtly, every moment you hold a racket should be fulfilling, exhilarating, and energized.'
        ];
      }
      return [
        'Tennis requires a harmonious balance of physical endurance, agile footwork, and tactical insight. For recreational players, proper warm-up habits are essential to sustain peak form and prevent injuries.',
        'According to Courtly fitness specialists, every structured session should begin with 10 minutes of dynamic stretching targeting shoulders, wrists, and hamstrings. After match play, 5 minutes of cool-down and a warm foot bath significantly accelerate muscle recovery.',
        'Maintaining hydration and electrolyte replenishment every 15–20 minutes is critical to prevent cramping and maintain optimal body temperature.',
        'Join us at Courtly to experience premier courts and connect with fellow tennis enthusiasts!'
      ];
    }

    if (a.category === 'TOURNAMENT' || a.source === 'TOURNAMENT') {
      return [
        'Giải quần vợt thường niên tại Cụm sân Courtly Tennis Club chính thức bước vào giai đoạn đăng ký tranh tài sôi nổi nhất trong năm. Sự kiện quy tụ hơn 32 tay vợt phong trào và bán chuyên xuất sắc từ khắp các câu lạc bộ trong khu vực.',
        'Hệ thống thi đấu được tổ chức chuyên nghiệp theo thể thức loại trực tiếp (Knock-out) tại 4 sân trong nhà Khu B. Với mặt sân đệm Pro-Cushion đạt chuẩn ATP Tour cùng hệ thống đèn LED 500 Lux chống chói, các vận động viên sẽ có điều kiện thi đấu lý tưởng nhất bất kể thời tiết nắng mưa.',
        'Cơ cấu giải thưởng năm nay bao gồm Cúp vàng danh dự, huy chương lưu niệm cùng các phần thưởng giá trị từ nhà tài trợ và gói đặc quyền hạng Grand Slam VIP 1 năm tại CLB Courtly.',
        'Các trận đấu sẽ được điều hành bởi đội ngũ trọng tài đạt chuẩn Liên đoàn Quần vợt Việt Nam, đảm bảo tính công bằng, chuẩn xác và tinh thần thể thao cao thượng xuyên suốt giải đấu.'
      ];
    }

    if (a.title?.includes('Bảo dưỡng') || a.title?.includes('Khu B') || a.category === 'FACILITY') {
      return [
        'Nhằm mang lại trải nghiệm thi đấu mượt mà và an toàn tối đa cho quý thành viên, Ban Quản Lý Cụm sân Courtly Tennis Club vừa hoàn tất đợt đại tu, bảo dưỡng định kỳ toàn diện cụm 4 sân trong nhà Khu B (B01 – B04).',
        'Điểm nhấn trong đợt nâng cấp lần này là công nghệ sơn phủ 8 lớp giảm chấn Pro-Cushion thế hệ mới. Lớp đệm cao su vi sinh giúp hấp thụ xung lực khi người chơi bật nhảy và đổi hướng đột ngột, giảm tải áp lực lên khớp gối và cổ chân đến 28% so với mặt sân cứng thông thường.',
        'Bên cạnh đó, hệ thống quạt thông gió công nghiệp đối lưu và cụm đèn LED chuyên dụng 500 Lux đã được cân chỉnh góc chiếu hoàn hảo, loại bỏ hoàn toàn hiện tượng lóa mắt khi thực hiện các cú smash trên không.',
        'Courtly luôn tâm niệm rằng: Mỗi phút giây bạn cầm vợt trên sân phải là một trải nghiệm trọn vẹn, thăng hoa và tràn đầy năng lượng tích cực.'
      ];
    }

    return [
      'Bộ môn quần vợt đòi hỏi sự kết hợp hài hòa giữa sức bền thể lực, phản xạ bộ chân và tư duy chiến thuật nhạy bén. Đối với người chơi phong trào, việc xây dựng thói quen khởi động đúng cách là yếu tố tiên quyết để duy trì phong độ đỉnh cao và phòng ngừa chấn thương.',
      'Theo các chuyên gia thể lực tại Courtly, một buổi tập luyện bài bản nên bắt đầu bằng 10 phút giãn cơ động (Dynamic Stretching) tập trung vào khớp vai, cổ tay và nhóm cơ đùi sau. Sau trận đấu, 5 phút thả lỏng kết hợp ngâm chân nước ấm tại khu phòng thay đồ sẽ giúp cơ bắp hồi phục nhanh hơn đáng kể.',
      'Ngoài ra, việc duy trì nhịp bổ sung nước khoáng và dung dịch điện giải sau mỗi 15–20 phút thi đấu là điều vô cùng quan trọng để chống chuột rút và hạ nhiệt cơ thể hiệu quả.',
      'Hãy đến với Courtly để trải nghiệm không gian thi đấu đẳng cấp và giao lưu cùng những người bạn có chung niềm đam mê quần vợt đích thực!'
    ];
  };

  const paragraphs = getEnrichedBody();

  // Related articles
  const relatedArticles = allArticles.filter(item => item.id !== a.id).slice(0, 3);

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', paddingBottom: 60 }}>
      {/* TOP BAR / BACK NAVIGATION */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28, flexWrap: 'wrap', gap: 12 }}>
        <button
          type="button"
          onClick={onBack}
          style={{
            background: '#ffffff',
            border: '1px solid #cfd7c9',
            borderRadius: 30,
            padding: '9px 18px',
            fontSize: 13.5,
            fontWeight: 700,
            color: '#173c32',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            cursor: 'pointer',
            boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
            transition: 'all 0.2s ease'
          }}
        >
          <ArrowLeft size={16} />
          <span>{t('Quay lại danh sách tin tức')}</span>
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            type="button"
            onClick={handleCopyLink}
            style={{
              background: copied ? '#ecfdf5' : '#ffffff',
              border: copied ? '1px solid #10b981' : '1px solid #cfd7c9',
              borderRadius: 30,
              padding: '8px 14px',
              fontSize: 12.5,
              fontWeight: 600,
              color: copied ? '#047857' : '#52655a',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              cursor: 'pointer'
            }}
          >
            {copied ? <Check size={14} /> : <Share2 size={14} />}
            <span>{copied ? t('Đã sao chép link') : t('Chia sẻ')}</span>
          </button>
        </div>
      </div>

      {/* ARTICLE WRAPPER CARD */}
      <article
        style={{
          background: '#ffffff',
          borderRadius: 20,
          border: '1px solid #d8dfd2',
          padding: '40px 48px',
          boxShadow: '0 8px 32px rgba(23,60,50,0.06)'
        }}
      >
        {/* BREADCRUMB */}
        <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1.2, color: '#173c32', marginBottom: 14 }}>
          <span>COURTLY JOURNAL</span>
          <span style={{ margin: '0 8px', color: '#a3b2a2' }}>/</span>
          <span style={{ color: '#047857' }}>{t(ARTICLE_CATEGORY[a.category] || a.category || 'Tin tức')}</span>
        </div>

        {/* HEADLINE */}
        <h1
          style={{
            fontSize: 32,
            fontWeight: 800,
            lineHeight: 1.35,
            color: '#173c32',
            margin: '0 0 20px',
            letterSpacing: '-0.5px'
          }}
        >
          {a.title}
        </h1>

        {/* SAPO / LEAD PARAGRAPH */}
        {a.excerpt && (
          <div
            style={{
              background: '#f5f7f0',
              borderLeft: '4px solid #173c32',
              padding: '14px 20px',
              borderRadius: '0 10px 10px 0',
              fontSize: 15.5,
              fontStyle: 'italic',
              lineHeight: 1.65,
              color: '#2e4438',
              marginBottom: 24
            }}
          >
            "{a.excerpt}"
          </div>
        )}

        {/* BYLINE & METADATA ROW */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 14,
            paddingBottom: 22,
            marginBottom: 26,
            borderBottom: '1px solid #edf1ea',
            fontSize: 13,
            color: '#637269'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: '50%',
                background: '#173c32',
                color: '#def46a',
                display: 'grid',
                placeItems: 'center',
                fontWeight: 800,
                fontSize: 14
              }}
            >
              CJ
            </div>
            <div>
              <strong style={{ display: 'block', color: '#173c32', fontSize: 13.5 }}>
                {t('Ban Biên Tập Courtly Journal')}
              </strong>
              <span style={{ fontSize: 11.5 }}>{t('Chuyên trang Quần vợt & Đời sống CLB')}</span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <Calendar size={14} color="#173c32" />
              {formattedDate}
            </span>
            <span>·</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <Clock size={14} color="#173c32" />
              {t('4 phút đọc')}
            </span>
            <span>·</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <Eye size={14} color="#173c32" />
              1.280 {t('lượt đọc')}
            </span>
          </div>
        </div>

        {/* HERO IMAGE */}
        <figure style={{ margin: '0 0 32px' }}>
          <img
            src={coverImage}
            alt={a.title}
            style={{
              width: '100%',
              maxHeight: 460,
              objectFit: 'cover',
              borderRadius: 14,
              boxShadow: '0 6px 20px rgba(0,0,0,0.08)'
            }}
          />
          <figcaption
            style={{
              fontSize: 12,
              color: '#6b7b71',
              fontStyle: 'italic',
              marginTop: 10,
              textAlign: 'center'
            }}
          >
            {t('Ảnh: Không gian thi đấu và hoạt động phong trào sôi nổi tại cụm sân Courtly Tennis Club.')}
          </figcaption>
        </figure>

        {/* ARTICLE BODY */}
        <div
          style={{
            fontSize: 16,
            lineHeight: 1.85,
            color: '#27382f',
            display: 'flex',
            flexDirection: 'column',
            gap: 20
          }}
        >
          {paragraphs.map((p, i) => (
            <p key={i} style={{ margin: 0, textIndent: i === 0 ? '0' : '0' }}>
              {p}
            </p>
          ))}

          {/* QUOTE CALLOUT BLOCK */}
          <blockquote
            style={{
              margin: '20px 0',
              padding: '24px 28px',
              background: 'linear-gradient(135deg, #173c32 0%, #1e4d40 100%)',
              color: '#ffffff',
              borderRadius: 14,
              boxShadow: '0 6px 20px rgba(23,60,50,0.18)',
              position: 'relative'
            }}
          >
            <span style={{ fontSize: 36, color: '#def46a', lineHeight: 1, display: 'block', marginBottom: 6 }}>
              “
            </span>
            <p style={{ margin: '0 0 10px', fontSize: 17, fontStyle: 'italic', lineHeight: 1.6, color: '#f3f7ed' }}>
              {t('Quần vợt không đơn thuần là rèn luyện thể lực, đó là nơi tôi luyện sự điềm tĩnh trước mỗi đường bóng và kết nối những tâm hồn đam mê thể thao đích thực.')}
            </p>
            <footer style={{ fontSize: 12.5, color: '#def46a', fontWeight: 700 }}>
              {t('— Huấn luyện viên Trưởng Courtly Tennis Academy')}
            </footer>
          </blockquote>

          {/* TIPS CALLOUT BOX */}
          <div
            style={{
              background: '#f0fdf4',
              border: '1px solid #bbf7d0',
              borderRadius: 12,
              padding: '18px 22px',
              fontSize: 14,
              color: '#166534',
              lineHeight: 1.6
            }}
          >
            <strong style={{ display: 'block', fontSize: 14.5, marginBottom: 6, color: '#14532d' }}>
              💡 {t('Lời khuyên cho buổi chơi tại Courtly:')}
            </strong>
            <ul style={{ margin: 0, paddingLeft: 20, display: 'grid', gap: 6 }}>
              <li>{t('Nên đến sân trước 10–15 phút để làm thủ tục check-in bằng mã QR và khởi động nhẹ.')}</li>
              <li>{t('Chọn loại giày tennis đế non-marking nhằm bảo vệ lớp sơn giảm chấn Pro-Cushion của sân.')}</li>
              <li>{t('Tận dụng hệ thống tủ locker và phòng tắm nóng lạnh miễn phí sau mỗi buổi tập luyện.')}</li>
            </ul>
          </div>
        </div>

        {/* TAGS */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 36, paddingTop: 20, borderTop: '1px solid #eef2ea' }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: '#637269', display: 'flex', alignItems: 'center', gap: 4 }}>
            <Tag size={13} /> {t('Thẻ:')}
          </span>
          {['#CourtlyTennis', '#QuanVotPhongTrao', '#SanTennisTrongNha', '#ATPStandard'].map(tag => (
            <span
              key={tag}
              style={{
                background: '#f2f5ec',
                color: '#173c32',
                borderRadius: 20,
                padding: '3px 10px',
                fontSize: 11.5,
                fontWeight: 600
              }}
            >
              {tag}
            </span>
          ))}
        </div>

        {/* AUTHOR BIO CARD */}
        <div
          style={{
            marginTop: 30,
            background: '#fafbf7',
            border: '1px solid #e1e7dc',
            borderRadius: 14,
            padding: '20px 24px',
            display: 'flex',
            alignItems: 'center',
            gap: 16
          }}
        >
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: '50%',
              background: '#173c32',
              color: '#def46a',
              display: 'grid',
              placeItems: 'center',
              fontSize: 22,
              fontWeight: 800,
              flexShrink: 0
            }}
          >
            🎾
          </div>
          <div>
            <strong style={{ fontSize: 14.5, color: '#173c32', display: 'block' }}>
              Courtly Editorial Team
            </strong>
            <p style={{ margin: '4px 0 0', fontSize: 12.5, color: '#52655a', lineHeight: 1.5 }}>
              {t('Kênh truyền thông chính thức phụ trách đưa tin về giải đấu, văn hóa thi đấu, kỹ thuật và nhịp sống thể thao tại Tổ hợp Quần vợt Courtly Tennis Club.')}
            </p>
          </div>
        </div>

        {/* CTA CARD */}
        <div
          style={{
            marginTop: 36,
            background: 'linear-gradient(90deg, #13332b 0%, #1e4d40 100%)',
            borderRadius: 14,
            padding: '24px 28px',
            color: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 16
          }}
        >
          <div>
            <strong style={{ fontSize: 17, display: 'block', color: '#def46a' }}>
              {t('Bạn đã sẵn sàng bước ra sân?')}
            </strong>
            <span style={{ fontSize: 13, color: '#e2ebd9' }}>
              {t('Đặt trước khung giờ đẹp hôm nay và nhận ưu đãi voucher WELCOME 50.000₫.')}
            </span>
          </div>
          <button
            type="button"
            onClick={() => navigate('booking')}
            style={{
              background: '#def46a',
              color: '#173c32',
              border: 'none',
              borderRadius: 30,
              padding: '11px 22px',
              fontSize: 13.5,
              fontWeight: 800,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
            }}
          >
            <span>🎾</span> {t('Đặt sân ngay')}
          </button>
        </div>
      </article>

      {/* RELATED STORIES */}
      {relatedArticles.length > 0 && (
        <section style={{ marginTop: 44 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
            <h2 style={{ fontSize: 20, color: '#173c32', margin: 0, fontWeight: 700 }}>
              {t('Bài viết liên quan & Đáng chú ý')}
            </h2>
            <button
              type="button"
              onClick={onBack}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#173c32',
                fontSize: 13,
                fontWeight: 700,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4
              }}
            >
              {t('Xem tất cả tin tức')} <ArrowUpRight size={14} />
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 20 }}>
            {relatedArticles.map((item, idx) => {
              const itemImg =
                item.imageUrl ||
                ['/guest/zone-a-outdoor.webp', '/guest/doubles.webp', '/guest/zone-v-lounge.webp'][idx % 3];
              return (
                <div
                  key={item.id}
                  onClick={() => onSelectArticle(item)}
                  style={{
                    background: '#ffffff',
                    border: '1px solid #d8dfd2',
                    borderRadius: 14,
                    overflow: 'hidden',
                    cursor: 'pointer',
                    boxShadow: '0 4px 14px rgba(0,0,0,0.03)',
                    transition: 'all 0.2s ease',
                    display: 'flex',
                    flexDirection: 'column'
                  }}
                >
                  <img
                    src={itemImg}
                    alt={item.title}
                    style={{ width: '100%', height: 150, objectFit: 'cover' }}
                  />
                  <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', flex: 1 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#047857', textTransform: 'uppercase', marginBottom: 6 }}>
                      {t(ARTICLE_CATEGORY[item.category] || item.category || 'Tin tức')}
                    </span>
                    <h3 style={{ fontSize: 15, fontWeight: 700, color: '#173c32', margin: '0 0 8px', lineHeight: 1.4 }}>
                      {item.title}
                    </h3>
                    <p style={{ fontSize: 12.5, color: '#52655a', margin: '0 0 12px', lineHeight: 1.5, flex: 1 }}>
                      {item.excerpt?.slice(0, 90)}…
                    </p>
                    <span style={{ fontSize: 12, fontWeight: 700, color: '#173c32', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      {t('Đọc tiếp')} <ArrowUpRight size={13} />
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}

// ==========================================
// ARTICLE COMPONENT (MODAL / BACKWARD COMPATIBLE)
// ==========================================
export function Article({ article: a }) {
  const { t } = useGuest();
  if (!a) return null;
  return <ArticleReader article={a} onBack={() => {}} allArticles={[]} />;
}

// ==========================================
// NEWS COMPONENT (COURTLY JOURNAL LIST & READER)
// ==========================================
export function News() {
  const { t, content, show } = useGuest();
  const [selectedArticle, setSelectedArticle] = useState(null);
  const [activeCategory, setActiveCategory] = useState('ALL');

  const rawArticles = content.articles || [];

  // Enriched curated articles if backend only had drafts
  const articles = useMemo(() => {
    if (rawArticles.length > 0) return rawArticles;
    return [
      {
        id: 'news-nextgen',
        title: 'Khai mạc Giải Đơn Phong Trào NextGen Cup 2026',
        category: 'TOURNAMENT',
        publishedAt: '2026-10-30',
        excerpt: 'Sự kiện quần vợt quy tụ hơn 32 tay vợt phong trào hàng đầu khu vực tranh tài tại cụm 4 sân trong nhà Khu B.',
        imageUrl: '/guest/ways-banner.webp'
      },
      {
        id: 'news-court-b',
        title: 'Bảo dưỡng nâng cấp mặt sân Khu B & Hệ thống đèn 500 Lux',
        category: 'FACILITY',
        publishedAt: '2026-10-28',
        excerpt: 'Hoàn tất lớp sơn phủ Pro-Cushion giảm chấn gối và tinh chỉnh ánh sáng chống chói chuẩn thi đấu ban đêm.',
        imageUrl: '/guest/zone-a-outdoor.webp'
      },
      {
        id: 'news-training',
        title: 'Bí quyết duy trì thể lực và phòng ngừa chấn thương khi thi đấu Tennis',
        category: 'TIPS',
        publishedAt: '2026-10-25',
        excerpt: 'Lời khuyên từ HLV thể lực về bài tập giãn cơ động, bổ sung điện giải và cách chọn độ căng cước vợt phù hợp.',
        imageUrl: '/guest/doubles.webp'
      },
      {
        id: 'news-membership',
        title: 'Courtly Club ra mắt đặc quyền hạng Grand Slam VIP mùa giải mới',
        category: 'CLUB',
        publishedAt: '2026-10-22',
        excerpt: 'Trải nghiệm phòng chờ VIP Lounge thương gia, ưu tiên đặt sân trước 21 ngày và miễn phí đổi lịch thi đấu.',
        imageUrl: '/guest/zone-v-lounge.webp'
      }
    ];
  }, [rawArticles]);

  const categories = [
    { id: 'ALL', label: t('Tất cả bài viết') },
    { id: 'TOURNAMENT', label: t('🏆 Giải đấu') },
    { id: 'FACILITY', label: t('🏟️ Cơ sở & Mặt sân') },
    { id: 'TIPS', label: t('⚡ Kỹ thuật & Sức khỏe') },
    { id: 'CLUB', label: t('👑 Đời sống CLB') }
  ];

  const filteredArticles = useMemo(() => {
    if (activeCategory === 'ALL') return articles;
    return articles.filter(a => a.category === activeCategory || (activeCategory === 'TOURNAMENT' && a.source === 'TOURNAMENT'));
  }, [articles, activeCategory]);

  const openArticle = (article) => {
    setSelectedArticle(article);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // If currently reading an article, render dedicated Reader
  if (selectedArticle) {
    return (
      <section className="ct-pad">
        <ArticleReader
          article={selectedArticle}
          onBack={() => {
            setSelectedArticle(null);
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          onSelectArticle={openArticle}
          allArticles={articles}
        />
      </section>
    );
  }

  const featured = filteredArticles[0];
  const list = filteredArticles.slice(1);

  return (
    <section className="ct-pad" style={{ maxWidth: 1200, margin: '0 auto' }}>
      {/* HEADING */}
      <div className="gx-heading" style={{ marginBottom: 32 }}>
        <span className="ct-eyebrow" style={{ color: '#173c32', letterSpacing: 2 }}>
          {t('COURTLY JOURNAL · BẢNG TIN QUẦN VỢT')}
        </span>
        <h1 style={{ fontSize: 34, margin: '10px 0 14px', color: '#173c32' }}>
          {t('Những câu chuyện ngoài sân bóng')}
        </h1>
        <p style={{ fontSize: 15, color: '#52655a', maxWidth: 640, lineHeight: 1.65 }}>
          {t('Tin tức hoạt động câu lạc bộ, cập nhật giải đấu, chia sẻ kinh nghiệm rèn luyện và văn hóa thể thao cao thượng tại Courtly.')}
        </p>
      </div>

      {/* CATEGORY FILTER TABS */}
      <div
        style={{
          display: 'flex',
          gap: 8,
          flexWrap: 'wrap',
          marginBottom: 32,
          padding: 6,
          background: '#ebefe4',
          borderRadius: 30,
          width: 'fit-content',
          border: '1px solid #d4dccf'
        }}
      >
        {categories.map(c => {
          const active = activeCategory === c.id;
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => setActiveCategory(c.id)}
              style={{
                background: active ? '#173c32' : 'transparent',
                color: active ? '#def46a' : '#2b4437',
                border: 'none',
                borderRadius: 24,
                padding: '8px 18px',
                fontSize: 13,
                fontWeight: active ? 700 : 500,
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              {c.label}
            </button>
          );
        })}
      </div>

      {/* FEATURED STORY BANNER */}
      {featured && (
        <div
          onClick={() => openArticle(featured)}
          style={{
            background: '#ffffff',
            border: '1px solid #d8dfd2',
            borderRadius: 20,
            overflow: 'hidden',
            marginBottom: 36,
            cursor: 'pointer',
            boxShadow: '0 8px 28px rgba(23,60,50,0.06)',
            display: 'grid',
            gridTemplateColumns: 'minmax(300px, 1.2fr) 1fr',
            gap: 0,
            transition: 'all 0.25s ease'
          }}
        >
          <img
            src={
              featured.imageUrl ||
              (featured.category === 'TOURNAMENT' ? '/guest/ways-banner.webp' : '/guest/zone-a-outdoor.webp')
            }
            alt={featured.title}
            style={{ width: '100%', height: '100%', minHeight: 320, objectFit: 'cover' }}
          />
          <div style={{ padding: '36px 36px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <span
                style={{
                  background: '#def46a',
                  color: '#173c32',
                  fontSize: 11,
                  fontWeight: 800,
                  padding: '3px 10px',
                  borderRadius: 12,
                  textTransform: 'uppercase'
                }}
              >
                ★ {t('Tiêu điểm')}
              </span>
              <span style={{ fontSize: 12, color: '#637269', fontWeight: 600 }}>
                {featured.publishedAt?.slice(0, 10) || 'Hôm nay'} · {t('4 phút đọc')}
              </span>
            </div>

            <h2
              style={{
                fontSize: 26,
                fontWeight: 800,
                lineHeight: 1.35,
                color: '#173c32',
                margin: '0 0 14px'
              }}
            >
              {featured.title}
            </h2>

            <p style={{ fontSize: 14.5, color: '#52655a', lineHeight: 1.6, margin: '0 0 22px' }}>
              {featured.excerpt}
            </p>

            <div>
              <span
                style={{
                  background: '#173c32',
                  color: '#def46a',
                  borderRadius: 30,
                  padding: '10px 20px',
                  fontSize: 13,
                  fontWeight: 700,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6
                }}
              >
                {t('Đọc bài báo đầy đủ')} <ArrowUpRight size={15} />
              </span>
            </div>
          </div>
        </div>
      )}

      {/* STORIES GRID */}
      {list.length > 0 ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 26 }}>
          {list.map((a, i) => {
            const img =
              a.imageUrl ||
              ['/guest/zone-a-outdoor.webp', '/guest/doubles.webp', '/guest/zone-v-lounge.webp'][i % 3];
            return (
              <article
                key={a.id}
                onClick={() => openArticle(a)}
                style={{
                  background: '#ffffff',
                  border: '1px solid #d8dfd2',
                  borderRadius: 16,
                  overflow: 'hidden',
                  cursor: 'pointer',
                  boxShadow: '0 4px 16px rgba(0,0,0,0.03)',
                  transition: 'all 0.2s ease',
                  display: 'flex',
                  flexDirection: 'column'
                }}
              >
                <div style={{ position: 'relative' }}>
                  <img src={img} alt={a.title} style={{ width: '100%', height: 200, objectFit: 'cover' }} />
                  <span
                    style={{
                      position: 'absolute',
                      top: 14,
                      left: 14,
                      background: 'rgba(23,60,50,0.85)',
                      backdropFilter: 'blur(4px)',
                      color: '#def46a',
                      fontSize: 11,
                      fontWeight: 700,
                      padding: '3px 10px',
                      borderRadius: 12
                    }}
                  >
                    {t(ARTICLE_CATEGORY[a.category] || a.category || 'Tin tức')}
                  </span>
                </div>

                <div style={{ padding: '22px 24px', display: 'flex', flexDirection: 'column', flex: 1 }}>
                  <span style={{ fontSize: 11.5, color: '#687b70', marginBottom: 8, display: 'block' }}>
                    {a.publishedAt?.slice(0, 10)} · {t('3 phút đọc')}
                  </span>
                  <h3
                    style={{
                      fontSize: 18,
                      fontWeight: 700,
                      color: '#173c32',
                      margin: '0 0 10px',
                      lineHeight: 1.4
                    }}
                  >
                    {a.title}
                  </h3>
                  <p
                    style={{
                      fontSize: 13.5,
                      color: '#52655a',
                      lineHeight: 1.6,
                      margin: '0 0 18px',
                      flex: 1
                    }}
                  >
                    {a.excerpt}
                  </p>
                  <span
                    style={{
                      fontSize: 13,
                      fontWeight: 700,
                      color: '#173c32',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6
                    }}
                  >
                    {t('Đọc bài viết')} <ArrowUpRight size={15} />
                  </span>
                </div>
              </article>
            );
          })}
        </div>
      ) : !featured ? (
        <Empty />
      ) : null}
    </section>
  );
}

// ==========================================
// CONTACT COMPONENT
// ==========================================
export function Contact() {
  const { t, club, navigate, lang } = useGuest();
  return (
    <section className="ct-pad">
      <div className="gx-heading">
        <span className="ct-eyebrow">SEE YOU ON COURT</span>
        <h1>{t('Một cuộc hẹn. Một kết nối.')}</h1>
      </div>
      <div className="gx-split">
        <article>
          <h2>{t('Ghé câu lạc bộ')}</h2>
          <dl>
            {[
              [MapPin, 'Địa chỉ', club.address],
              [Phone, 'Điện thoại', club.phone],
              [Mail, 'Email', club.email]
            ].map(([I, k, v]) => (
              <div key={k}>
                <dt>
                  <I />
                  {t(k)}
                </dt>
                <dd>{v ? t(v) : t('Đang cập nhật')}</dd>
              </div>
            ))}
            <div>
              <dt>{t('Giờ mở cửa')}</dt>
              <dd>{lang === 'en' ? '06:00 – 23:00 · All week & Holidays' : (club.openingHours || '06:00 – 23:00 · Cả tuần & Ngày lễ')}</dd>
            </div>
          </dl>
          
        </article>
        <article className="gx-green">
          <h2>{t('Mỗi chia sẻ đều có ý nghĩa.')}</h2>
          <p>{t('Gửi góp ý để Courtly chăm sóc trải nghiệm của bạn tốt hơn.')}</p>
          <Action secondary onClick={() => navigate('feedback')}>
            {t('Gửi feedback')}
          </Action>
        </article>
      </div>
    </section>
  );
}

// ==========================================
// SHOWCASE FEEDBACK SEED DATA (12 REALISTIC REVIEWS)
// ==========================================
const INITIAL_SHOWCASE_FEEDBACKS = [
  {
    id: 'fb-1',
    userName: 'Trần Hoàng Nam',
    userRole: 'Thành viên Club Plus',
    userInitials: 'HN',
    avatarBg: '#047857',
    rating: 5,
    topic: 'COURT',
    topicLabel: '🏟️ Sân B02 Trong Nhà',
    date: 'Hôm qua · 19:45',
    message: 'Mặt sân trong nhà Khu B đánh rất êm chân, độ nảy bóng chuẩn. Mái che cao ráo, quạt thông gió chạy mát rượi dù ngoài trời đang mưa to. Nhóm mình đánh 3 tiếng liên tục rất đã, sẽ tiếp tục đặt cố định hàng tuần!',
    reply: {
      adminName: 'Ban Quản Lý Courtly Club',
      adminRole: 'Phản hồi chính thức',
      date: 'Hôm qua · 20:15',
      message: 'Dạ cảm ơn anh Nam và hội bạn đã tin tưởng ủng hộ CLB! Courtly vừa hoàn tất bảo dưỡng lớp sơn phủ giảm chấn và tinh chỉnh đèn LED 500 Lux ở sân B02. Chúc anh luôn có những trận cầu thăng hoa ạ! 🎾'
    }
  },
  {
    id: 'fb-2',
    userName: 'Lê Thị Thảo',
    userRole: 'Khách hàng thân thiết',
    userInitials: 'TL',
    avatarBg: '#b45309',
    rating: 5,
    topic: 'SERVICE',
    topicLabel: '👨‍⚖️ Dịch vụ Trọng tài',
    date: '3 ngày trước',
    message: 'Lần đầu thuê trọng tài qua web khi đặt sân, anh Trọng tài Huy cực kỳ đúng giờ, bắt bóng chuẩn xác và giữ nhịp trận đấu rất chuyên nghiệp. Đánh xong có phòng tắm nước nóng sạch sẽ, rất ưng ý.',
    reply: {
      adminName: 'Ban Quản Lý Courtly Club',
      adminRole: 'Phản hồi chính thức',
      date: '3 ngày trước',
      message: 'Chào chị Thảo! CLB rất vui vì trọng tài Huy đã đồng hành trọn vẹn cùng trận đấu của chị. Đội ngũ trọng tài của Courtly đều được đào tạo chuẩn Liên đoàn. Hẹn gặp lại chị ở những buổi chơi tới ạ!'
    }
  },
  {
    id: 'fb-3',
    userName: 'Đặng Hoàng Long',
    userRole: 'Thành viên VIP',
    userInitials: 'HL',
    avatarBg: '#1e3a8a',
    rating: 5,
    topic: 'COURT',
    topicLabel: '⭐ Sân V01 VIP Lounge',
    date: '5 ngày trước',
    message: 'Sân VIP rất riêng tư và đẳng cấp, có phòng chờ máy lạnh và minibar tiện lợi để tiếp đối tác. Check-in quét mã QR tại quầy chỉ mất đúng 3 giây, không phải chờ đợi.',
    reply: {
      adminName: 'Ban Quản Lý Courtly Club',
      adminRole: 'Phản hồi chính thức',
      date: '5 ngày trước',
      message: 'Cảm ơn anh Long đã dành thời gian đánh giá! Khu VIP V01 luôn được ưu tiên chuẩn bị chu đáo trước giờ bóng lăn. CLB luôn sẵn sàng phục vụ anh!'
    }
  },
  {
    id: 'fb-4',
    userName: 'Kiệt Nguyễn',
    userRole: 'Thành viên mới',
    userInitials: 'KN',
    avatarBg: '#15803d',
    rating: 5,
    topic: 'WEBSITE',
    topicLabel: '💻 Đặt sân & QR Check-in',
    date: '1 tuần trước',
    message: 'Hệ thống đặt sân và giữ chỗ trực quan, xem được từng khung giờ 30 phút rất tiện. Đặt xong có vé điện tử QR lưu trong máy, mang đến quầy quét phát là đèn sân tự bật. Rất hiện đại và chuyên nghiệp!',
    reply: {
      adminName: 'Ban Quản Lý Courtly Club',
      adminRole: 'Phản hồi chính thức',
      date: '1 tuần trước',
      message: 'Cảm ơn anh Kiệt! Hệ thống tự động hóa đặt sân và check-in QR của Courtly liên tục được nâng cấp nhằm mang lại sự tiện lợi cao nhất cho khách hàng. Chúc anh có những buổi tập luyện tuyệt vời!'
    }
  },
  {
    id: 'fb-5',
    userName: 'Vũ Minh Trí',
    userRole: 'Khách hàng thân thiết',
    userInitials: 'VT',
    avatarBg: '#0f766e',
    rating: 5,
    topic: 'FACILITY',
    topicLabel: '🚿 Phòng tắm & Tủ Locker',
    date: '1 tuần trước',
    message: 'Tiện ích phụ trợ ở đây làm rất chu đáo. Phòng thay đồ sạch bong, có sẵn dầu gội, máy sấy tóc và khăn tắm thơm tho. Tủ khóa thông minh an tâm cất đồ giá trị.',
    reply: {
      adminName: 'Ban Quản Lý Courtly Club',
      adminRole: 'Phản hồi chính thức',
      date: '1 tuần trước',
      message: 'Dạ Courtly luôn chú trọng khu vực vệ sinh và tiện ích hậu cần để các anh em sau giờ thi đấu mồ hôi đều được sảng khoái và thư giãn nhất. Cảm ơn anh Trí nhiều ạ!'
    }
  },
  {
    id: 'fb-6',
    userName: 'Phan Thu Trang',
    userRole: 'Thành viên Club',
    userInitials: 'TT',
    avatarBg: '#7c3aed',
    rating: 5,
    topic: 'TOURNAMENT',
    topicLabel: '🏆 Giải Đấu NextGen Cup',
    date: '10 ngày trước',
    message: 'Giải NextGen Cup tổ chức rất quy củ, xếp cặp thi đấu rõ ràng và có bảng điểm điện tử cập nhật liên tục. Trọng tài bắt công tâm, nước uống và y tế hỗ trợ kịp thời.',
    reply: {
      adminName: 'Ban Quản Lý Courtly Club',
      adminRole: 'Phản hồi chính thức',
      date: '10 ngày trước',
      message: 'Cảm ơn chị Trang đã cháy hết mình cùng giải đấu! Sắp tới CLB sẽ mở thêm bảng đấu đôi nam nữ, rất mong lại được đón tiếp chị tham gia!'
    }
  },
  {
    id: 'fb-7',
    userName: 'Bùi Anh Khoa',
    userRole: 'Thành viên mới',
    userInitials: 'AK',
    avatarBg: '#c026d3',
    rating: 5,
    topic: 'COURT',
    topicLabel: '🏟️ Sân A03 Ngoài Trời',
    date: '2 tuần trước',
    message: 'Sân ngoài trời đánh buổi chiều tối mát mẻ, dàn đèn LED chiếu sáng đều và không bị chói mắt khi nhìn lên đỡ bóng bổng. Giá sân ngoài trời hợp lý cho học sinh sinh viên.',
    reply: {
      adminName: 'Ban Quản Lý Courtly Club',
      adminRole: 'Phản hồi chính thức',
      date: '2 tuần trước',
      message: 'Dạ cảm ơn Khoa! Khung giờ sáng sớm và chiều mát ở Khu A rất được ưa chuộng. Bạn nhớ săn thêm voucher WELCOME giảm 50k nhé!'
    }
  },
  {
    id: 'fb-8',
    userName: 'Nguyễn Thanh Tùng',
    userRole: 'Khách hàng thân thiết',
    userInitials: 'TT',
    avatarBg: '#0284c7',
    rating: 4,
    topic: 'FACILITY',
    topicLabel: '☕ Quầy nước & Cafe',
    date: '2 tuần trước',
    message: 'Sân bãi tốt, nhân viên thân thiện. Quầy nước có nhiều loại điện giải lạnh bù nước tốt. Góp ý nhỏ là nên bổ sung thêm chuối tươi và gel năng lượng cho người chơi đánh ca dài.',
    reply: {
      adminName: 'Ban Quản Lý Courtly Club',
      adminRole: 'Phản hồi chính thức',
      date: '2 tuần trước',
      message: 'Góp ý của anh Tùng rất thiết thực! Ban Quản Lý đã bổ sung ngay quầy trái cây tươi (chuối, táo) và gel thể thao tại quầy lễ tân từ đầu tuần này rồi ạ!'
    }
  },
  {
    id: 'fb-9',
    userName: 'Hoàng Gia Bảo',
    userRole: 'Thành viên Club',
    userInitials: 'GB',
    avatarBg: '#ea580c',
    rating: 4,
    topic: 'WEBSITE',
    topicLabel: '💻 Đặt sân trực tuyến',
    date: '3 tuần trước',
    message: 'Giao diện web dễ dùng, đặt sân và cọc tiền nhanh. Khung giờ tối 18h-20h thường hết sân khá nhanh, mong CLB mở thêm nhiều sân trong nhà nữa.',
    reply: {
      adminName: 'Ban Quản Lý Courtly Club',
      adminRole: 'Phản hồi chính thức',
      date: '3 tuần trước',
      message: 'Dạ cảm ơn anh Bảo! Khi tích luỹ chi tiêu lên các hạng Masters hoặc Grand Slam, anh sẽ được quyền đặt trước đến 14 - 21 ngày so với khách thông thường nhé ạ!'
    }
  },
  {
    id: 'fb-10',
    userName: 'Đỗ Mai Anh',
    userRole: 'Khách hàng trải nghiệm',
    userInitials: 'MA',
    avatarBg: '#db2777',
    rating: 4,
    topic: 'SERVICE',
    topicLabel: '🎾 Căng cước vợt Yonex',
    date: '3 tuần trước',
    message: 'Máy căng cước điện tử làm rất chuẩn số kg yêu cầu, đánh vào bóng cảm giác đầm tay. Anh kỹ thuật viên tư vấn loại dây cước phù hợp với lực tay phụ nữ.',
    reply: {
      adminName: 'Ban Quản Lý Courtly Club',
      adminRole: 'Phản hồi chính thức',
      date: '3 tuần trước',
      message: 'Cảm ơn chị Mai Anh đã tin tưởng dịch vụ căng cước của Courtly! Chúc chị luôn có những đường bóng uy lực và tự tin trên sân!'
    }
  },
  {
    id: 'fb-11',
    userName: 'Phạm Tiến Dũng',
    userRole: 'Khách hàng thân thiết',
    userInitials: 'TD',
    avatarBg: '#475569',
    rating: 3,
    topic: 'FACILITY',
    topicLabel: '🚗 Bãi đỗ xe ô tô cuối tuần',
    date: '1 tháng trước',
    message: 'Chất lượng sân và phục vụ đều tốt. Tuy nhiên vào tối Thứ 7 tầm 19h bãi xe ô tô phía trước hơi đông, phải đợi bảo vệ hướng dẫn xếp xe mất 5 phút.',
    reply: {
      adminName: 'Ban Quản Lý Courtly Club',
      adminRole: 'Phản hồi chính thức',
      date: '1 tháng trước',
      message: 'Chào anh Dũng, CLB rất tiếc vì sự chậm trễ này! Courtly đã mở rộng thêm bãi đỗ xe dự phòng phía sau (sức chứa thêm 30 ô tô) và tăng cường bảo vệ điều tiết vào các tối cuối tuần rồi ạ.'
    }
  },
  {
    id: 'fb-12',
    userName: 'Trịnh Hải Yến',
    userRole: 'Thành viên mới',
    userInitials: 'HY',
    avatarBg: '#4f46e5',
    rating: 3,
    topic: 'COURT',
    topicLabel: '🌧️ Mái che Khu B khi mưa giông',
    date: '1 tháng trước',
    message: 'Sân Khu B không lo bị ướt, nhưng hôm mưa giông lớn tiếng mưa rơi trên mái tôn hơi vang, phải nói to đồng đội mới nghe rõ tiếng gọi bóng.',
    reply: {
      adminName: 'Ban Quản Lý Courtly Club',
      adminRole: 'Phản hồi chính thức',
      date: '1 tháng trước',
      message: 'Dạ Courtly ghi nhận ý kiến quý giá của chị Yến! CLB vừa thi công lớp xốp cách âm và chống ồn bên dưới hệ thống mái vòm Khu B để triệt tiêu tiếng vang khi mưa to rồi ạ!'
    }
  }
];

// ==========================================
// FEEDBACK MAIN COMPONENT (PAGINATION + FILTERS)
// ==========================================
const FB_TOPICS = [
  { value: 'COURT', label: 'Mặt sân', icon: '🏟️' },
  { value: 'SERVICE', label: 'Trọng tài & HLV', icon: '👨‍⚖️' },
  { value: 'FACILITY', label: 'Tiện ích', icon: '🚿' },
  { value: 'WEBSITE', label: 'Đặt sân online', icon: '💻' },
  { value: 'TOURNAMENT', label: 'Giải đấu', icon: '🏆' },
  { value: 'OTHER', label: 'Khác', icon: '💬' }
];
const FB_RATING_TEXT = ['', 'Rất tệ', 'Chưa hài lòng', 'Bình thường', 'Hài lòng', 'Tuyệt vời'];
const FB_STATUS = { PENDING: { label: 'Chờ duyệt', cls: 'fb-st-pending' }, PUBLISHED: { label: 'Đã đăng', cls: 'fb-st-ok' }, PRIVATE: { label: 'Đã xem, không công khai', cls: 'fb-st-muted' } };

function FbStars({ value, size = 16 }) {
  return (
    <span className="fb-stars-static" aria-label={`${value} / 5`}>
      {[1, 2, 3, 4, 5].map(s => <Star key={s} size={size} fill={s <= value ? '#f5b301' : 'none'} color={s <= value ? '#e0a100' : '#cbd5c4'} strokeWidth={1.5} />)}
    </span>
  );
}

export function Feedback() {
  const { t, user, login, content, refresh, notify } = useGuest();
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [message, setMessage] = useState('');
  const [consent, setConsent] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [req, setReq] = useState(requestId);
  const [eligibleOrders, setEligibleOrders] = useState([]);
  const [orderId, setOrderId] = useState('');
  const [mine, setMine] = useState([]);
  const [filter, setFilter] = useState('ALL');
  const [visible, setVisible] = useState(6);

  const loadMine = () => api('/feedback/mine').then(r => setMine(Array.isArray(r) ? r : [])).catch(() => {});

  useEffect(() => {
    if (!user) return;
    api('/feedback/eligible-orders').then(res => {
      const list = res || [];
      setEligibleOrders(list);
      const urlOrder = new URLSearchParams(window.location.search).get('orderId');
      setOrderId(urlOrder || list[0]?.id || '');
    }).catch(() => {});
    loadMine();
  }, [user]);

  const topicLabel = v => { const tp = FB_TOPICS.find(x => x.value === v); return tp ? `${tp.icon} ${t(tp.label)}` : ''; };

  const submit = async e => {
    e.preventDefault();
    if (!user) { login(); return; }
    if (!rating) { setError(t('Vui lòng chọn số sao.')); return; }
    if (message.trim().length < 10) { setError(t('Vui lòng viết vài dòng (ít nhất 10 ký tự).')); return; }
    setBusy(true); setError('');
    try {
      await api('/feedback', 'POST', { rating, message: message.trim(), topic: 'OTHER', publishConsent: consent, orderId: orderId || null, requestId: req });
      setSent(true);
      setReq(requestId());
      notify(t('Đã gửi đánh giá. Cảm ơn bạn!'));
      setEligibleOrders(list => list.filter(o => o.id !== orderId));
      loadMine();
      refresh().catch(() => {});
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const reset = () => { setSent(false); setRating(0); setMessage(''); setError(''); setOrderId(eligibleOrders[0]?.id || ''); };

  const reviews = useMemo(() => {
    const server = (content.feedback || []).map(f => ({
      id: f.id, userName: f.displayName || 'Thành viên Courtly', rating: f.rating || 5, topic: f.topic || 'OTHER',
      date: f.createdAt ? new Date(f.createdAt).toLocaleDateString('vi-VN') : '', message: f.message, reply: f.reply ? { message: f.reply } : null
    }));
    const showcase = INITIAL_SHOWCASE_FEEDBACKS.map(f => ({ ...f, reply: f.reply ? { message: f.reply.message } : null }));
    return [...server, ...showcase];
  }, [content.feedback]);

  const stats = useMemo(() => {
    const counts = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    let sum = 0;
    reviews.forEach(r => { const s = Math.max(1, Math.min(5, Math.round(r.rating))); counts[s] += 1; sum += r.rating; });
    return { total: reviews.length, avg: reviews.length ? (sum / reviews.length).toFixed(1) : '0.0', counts };
  }, [reviews]);

  const filtered = reviews.filter(r => filter === 'ALL' || (filter === 'REPLY' ? Boolean(r.reply) : filter === 'LOW' ? r.rating <= 3 : r.rating === Number(filter)));
  const shown = filtered.slice(0, visible);
  const changeFilter = f => { setFilter(f); setVisible(6); };
  const display = hover || rating;
  const currentOrder = eligibleOrders.find(o => o.id === orderId);

  return (
    <section className="ct-pad fb-page">
      <header className="fb-head">
        <span className="ct-eyebrow">{t('Đánh giá & góp ý')}</span>
        <h1>{t('Bạn thấy buổi chơi thế nào?')}</h1>
        <p>{t('Mỗi đánh giá được quản lý đọc và phản hồi. Đánh giá công khai sẽ hiển thị sau khi được duyệt.')}</p>
      </header>

      <div className="fb-layout">
        <aside className="fb-side">
          <div className="fb-card fb-form-card">
            {!user ? (
              <div className="fb-empty-state">
                <span className="fb-big-icon">⭐</span>
                <h2>{t('Đăng nhập để đánh giá')}</h2>
                <p>{t('Chỉ khách đã đặt sân mới có thể gửi đánh giá, để mọi nhận xét đều là trải nghiệm thật.')}</p>
                <Action onClick={() => login('login')}>{t('Đăng nhập')}</Action>
              </div>
            ) : sent ? (
              <div className="fb-empty-state">
                <span className="fb-big-icon">✅</span>
                <h2>{t('Đã gửi đánh giá')}</h2>
                <p>{t('Quản lý sẽ xem và phản hồi qua email và chuông thông báo. Nếu bạn cho phép công khai, đánh giá sẽ hiện trên trang sau khi được duyệt.')}</p>
                <button type="button" className="ct-outline" onClick={reset}>{t('Viết đánh giá khác')}</button>
              </div>
            ) : (
              <form onSubmit={submit} className="fb-form fb-simple">
                <div className="fb-rate" onMouseLeave={() => setHover(0)}>
                  <div className="fb-rate-stars" role="radiogroup" aria-label={t('Số sao')}>
                    {[1, 2, 3, 4, 5].map(s => (
                      <button key={s} type="button" role="radio" aria-checked={rating === s} aria-label={`${s} ${t('sao')}`}
                        onMouseEnter={() => setHover(s)} onFocus={() => setHover(s)} onBlur={() => setHover(0)}
                        onClick={() => { setRating(s); setError(''); }}>
                        <Star size={30} fill={s <= display ? '#f5b301' : 'none'} color={s <= display ? '#e0a100' : '#b9c4b2'} strokeWidth={1.4} />
                      </button>
                    ))}
                  </div>
                  <span className="fb-rate-text">{display ? t(FB_RATING_TEXT[display]) : t('Chọn số sao')}</span>
                </div>
                {currentOrder && <p className="fb-for">{t('Cho buổi chơi')} {currentOrder.courtNames || t('Sân')} · {currentOrder.date}</p>}
                <textarea rows={3} maxLength={1000} value={message} onChange={e => setMessage(e.target.value)}
                  aria-label={t('Nội dung đánh giá')} placeholder={t('Chia sẻ trải nghiệm của bạn…')} />
                {error && <p className="fb-error" role="alert">{error}</p>}
                <div className="fb-submit-row">
                  <label className="fb-consent">
                    <input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} />
                    <span>{t('Hiển thị công khai')}</span>
                  </label>
                  <Action type="submit" disabled={busy}>{busy ? t('Đang gửi…') : t('Gửi đánh giá')}</Action>
                </div>
              </form>
            )}
          </div>

          {user && mine.length > 0 && (
            <div className="fb-card fb-mine">
              <h3>{t('Đánh giá của bạn')}</h3>
              <ul>
                {mine.slice().sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || ''))).slice(0, 4).map(m => {
                  const st = FB_STATUS[m.status] || FB_STATUS.PENDING;
                  return (
                    <li key={m.id}>
                      <div className="fb-mine-top">
                        <FbStars value={m.rating || 0} size={13} />
                        <span className={`fb-st ${st.cls}`}>{t(st.label)}</span>
                      </div>
                      <p>{m.message}</p>
                      {m.reply && <p className="fb-mine-reply"><b>Courtly:</b> {m.reply}</p>}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </aside>

        <div className="fb-main">
          <div className="fb-card fb-summary">
            <div className="fb-score">
              <b>{stats.avg}</b>
              <FbStars value={Math.round(Number(stats.avg))} size={18} />
              <small>{stats.total} {t('đánh giá')}</small>
            </div>
            <div className="fb-bars">
              {[5, 4, 3, 2, 1].map(s => {
                const c = stats.counts[s];
                const pct = stats.total ? Math.round(c / stats.total * 100) : 0;
                return (
                  <div key={s} className="fb-bar-row">
                    <span>{s}★</span>
                    <div className="fb-bar"><i style={{ width: `${pct}%` }} /></div>
                    <span className="fb-bar-n">{c}</span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="fb-filters" role="tablist">
            {[['ALL', t('Tất cả')], ['5', '5★'], ['4', '4★'], ['LOW', '≤ 3★'], ['REPLY', t('Có phản hồi')]].map(([k, label]) => (
              <button key={k} type="button" role="tab" aria-selected={filter === k} className={filter === k ? 'on' : ''} onClick={() => changeFilter(k)}>{label}</button>
            ))}
          </div>

          {shown.length === 0 ? <Empty>{t('Chưa có đánh giá phù hợp.')}</Empty> : (
            <div className="fb-list">
              {shown.map(r => (
                <article key={r.id} className="fb-review">
                  <header>
                    <span className="fb-avatar" aria-hidden="true">{String(r.userName || '?').trim().split(/\s+/).slice(-1)[0][0]}</span>
                    <div>
                      <b>{r.userName}</b>
                      <small>{[r.date, topicLabel(r.topic)].filter(Boolean).join(' · ')}</small>
                    </div>
                    <FbStars value={r.rating} />
                  </header>
                  <p>{r.message}</p>
                  {r.reply && (
                    <div className="fb-reply">
                      <b>{t('Phản hồi từ Courtly')}</b>
                      <p>{r.reply.message}</p>
                    </div>
                  )}
                </article>
              ))}
            </div>
          )}
          {filtered.length > visible && (
            <button type="button" className="ct-outline fb-more" onClick={() => setVisible(v => v + 6)}>
              {t('Xem thêm')} ({filtered.length - visible})
            </button>
          )}
        </div>
      </div>
    </section>
  );
}

export function Policies() {
  const { t, lang, route } = useGuest();
  const [tab, setTab] = useState(route === 'rules' ? 'rules' : 'privacy');

  React.useEffect(() => {
    if (route === 'rules') setTab('rules');
    else if (route === 'policies') setTab('privacy');
  }, [route]);

  return (
    <section className="ct-pad" style={{ maxWidth: 960, margin: '0 auto', paddingBottom: 60 }}>
      <div className="gx-heading" style={{ marginBottom: 24 }}>
        <span className="ct-eyebrow">COURTLY TENNIS CLUB · LEGAL & REGULATIONS</span>
        <h1 style={{ fontSize: 28, margin: '8px 0', color: '#173c32' }}>
          {tab === 'rules'
            ? t('Quy chế hoạt động Câu lạc bộ')
            : tab === 'booking'
            ? t('Quy định đặt sân, Hoàn cọc & Gia hạn')
            : t('Chính sách bảo mật & Quyền riêng tư')}
        </h1>
        <p style={{ color: '#52655a', fontSize: 14, margin: 0 }}>
          {t(
            'Văn bản quy định chuẩn mực dịch vụ, bảo vệ quyền lợi thành viên, an toàn sân đấu và bảo mật thông tin cá nhân theo quy định pháp luật.'
          )}
        </p>
      </div>

      {/* Navigation Tabs */}
      <div
        style={{
          display: 'flex',
          gap: 8,
          flexWrap: 'wrap',
          background: '#ecefe6',
          padding: 6,
          borderRadius: 10,
          marginBottom: 28,
          border: '1px solid #d8dece'
        }}
      >
        {[
          ['privacy', '🔒 ' + t('Chính sách & Quyền riêng tư')],
          ['rules', '📜 ' + t('Quy chế hoạt động CLB')],
          ['booking', '📋 ' + t('Quy định đặt sân & Hoàn cọc')]
        ].map(([id, label]) => {
          const active = tab === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              style={{
                background: active ? '#173c32' : 'transparent',
                color: active ? '#def46a' : '#324c3e',
                border: 'none',
                borderRadius: 8,
                padding: '8px 16px',
                fontSize: 13,
                fontWeight: active ? 700 : 500,
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* Nội dung 3 tab: dữ liệu song ngữ, mỗi mục là { h: tiêu đề, p?: đoạn văn, li?: danh sách } */}
      <div
        style={{
          background: '#ffffff',
          border: '1px solid #d5dcce',
          borderRadius: 12,
          padding: '32px 36px',
          lineHeight: 1.8,
          fontSize: 14,
          color: '#27382f',
          boxShadow: '0 4px 20px rgba(0,0,0,0.03)'
        }}
      >
        {(POLICY_TEXT[lang === 'en' ? 'en' : 'vi'][tab] || []).map((sec, i) => (
          <React.Fragment key={sec.h}>
            <h2 style={{ fontSize: 20, color: '#173c32', margin: i === 0 ? '0 0 12px' : '24px 0 12px' }}>{sec.h}</h2>
            {sec.p && <p>{sec.p}</p>}
            {sec.li && (
              <ul style={{ paddingLeft: 22, margin: '8px 0 18px' }}>
                {sec.li.map(item => (
                  <li key={item}>
                    {item.includes('::') ? <><strong>{item.split('::')[0]}:</strong>{item.split('::')[1]}</> : item}
                  </li>
                ))}
              </ul>
            )}
          </React.Fragment>
        ))}
      </div>
    </section>
  );
}

// Văn bản chính sách song ngữ. Mốc hoàn cọc khớp với quy tắc hủy đơn ở backend (OrderApplicationService).
const POLICY_TEXT = {
  vi: {
    privacy: [
      { h: '1. Mục đích thu thập thông tin', p: 'Câu lạc bộ Courtly thu thập thông tin cá nhân (họ tên, số điện thoại, email) nhằm phục vụ các mục đích chính đáng sau:',
        li: ['Xác thực và cấp quyền truy cập tài khoản đặt sân trực tuyến.', 'Gửi thông báo xác nhận giữ chỗ, mã vé điện tử QR check-in vào sân.',
          'Liên hệ khẩn cấp trong trường hợp thay đổi lịch sân do điều kiện thời tiết hoặc bảo trì kỹ thuật.',
          'Gửi thông báo ưu đãi thành viên, voucher và thông tin giải đấu khi người dùng đồng ý nhận tin.'] },
      { h: '2. Phạm vi sử dụng & Bảo mật thông tin', p: 'Courtly bảo mật thông tin khách hàng bằng các biện pháp an toàn dữ liệu (mã hóa đường truyền SSL/TLS, phân quyền truy cập). Chúng tôi không chia sẻ, bán hoặc chuyển giao thông tin của quý khách cho bên thứ ba vì mục đích thương mại, ngoại trừ yêu cầu từ cơ quan có thẩm quyền theo quy định của pháp luật.' },
      { h: '3. Quyền của khách hàng đối với dữ liệu cá nhân', p: 'Quý khách có quyền kiểm tra, cập nhật hoặc yêu cầu xóa thông tin cá nhân bất kỳ lúc nào qua mục Hồ sơ của tôi trên website, hoặc liên hệ Ban Quản lý Câu lạc bộ qua email/hotline chính thức. Quý khách có thể tắt nhận tin khuyến mãi trong Hồ sơ hoặc qua liên kết hủy nhận tin ở cuối mỗi email.' }
    ],
    rules: [
      { h: '1. Quy định trang phục & Giày thi đấu', li: [
        'Giày tennis chuyên dụng::  bắt buộc mang giày đế non-marking (không để lại vết đen) khi vào tất cả các khu sân (Khu A, Khu B và Khu VIP) để bảo vệ lớp sơn đệm mặt sân.',
        'Mặc trang phục thể thao lịch sự, phù hợp với hoạt động quần vợt.'] },
      { h: '2. An ninh & Văn hóa ứng xử trên sân', li: [
        'Nghiêm cấm hút thuốc, sử dụng chất kích thích hoặc mang đồ ăn nhiều dầu mỡ vào khu vực thi đấu.',
        'Không xả rác; vỏ chai nước và bóng hỏng bỏ đúng thùng rác đặt cạnh ghế nghỉ.',
        'Giữ gìn vệ sinh chung tại phòng thay đồ, tủ locker và phòng tắm.',
        'Tôn trọng đối thủ, trọng tài và người chơi ở sân bên cạnh; không gây ồn ào ảnh hưởng trận đấu khác.'] },
      { h: '3. Thời gian thi đấu & Bàn giao sân', li: [
        'Có mặt trước giờ chơi 10–15 phút để check-in tại quầy và khởi động.',
        'Hết giờ, vui lòng dọn bóng, vật dụng cá nhân và bàn giao sân đúng giờ cho lượt khách sau.',
        'Muốn chơi thêm, liên hệ lễ tân hoặc dùng tính năng Gia hạn giờ chơi trên website nếu sân còn trống.'] }
    ],
    booking: [
      { h: '1. Đặt sân & Đặt cọc giữ chỗ', p: 'Khi đặt sân trực tuyến, khách thanh toán tiền cọc 50% tiền sân trong vòng 5 phút kể từ khi tạo đơn (VietQR) hoặc chọn thanh toán tiền mặt tại quầy. Quá thời gian giữ chỗ, hệ thống tự động mở lại khung giờ cho khách khác.' },
      { h: '2. Quy định Hủy đơn & Hoàn tiền cọc', li: [
        'Hủy trước giờ chơi trên 24 tiếng:: hoàn 100% tiền cọc đã đóng.',
        'Hủy trước giờ chơi từ 12 đến 24 tiếng:: hoàn 50% tiền cọc.',
        'Hủy dưới 12 tiếng trước giờ chơi:: không hoàn cọc, do sân đã được giữ riêng cho quý khách và không kịp xếp lượt khách khác.',
        'Trường hợp bất khả kháng (mưa lớn với sân ngoài trời Khu A, sự cố kỹ thuật):: Ban Quản lý liên hệ để dời lịch miễn phí hoặc hoàn 100% tiền cọc.'] },
      { h: '3. Check-in & Thanh toán phần còn lại', p: 'Khi đến sân, mở vé điện tử trên website để lễ tân quét mã QR. Số tiền còn lại (sau khi trừ cọc) thanh toán tại quầy bằng tiền mặt hoặc chuyển khoản khi check-out.' }
    ]
  },
  en: {
    privacy: [
      { h: '1. Why we collect information', p: 'Courtly Tennis Club collects personal information (name, phone number, email) for the following legitimate purposes:',
        li: ['Verifying your identity and giving you access to your online booking account.', 'Sending booking confirmations and your QR check-in e-ticket.',
          'Contacting you urgently if your court time changes because of weather or maintenance.',
          'Sending member offers, vouchers and tournament news when you have opted in.'] },
      { h: '2. Use & Security of information', p: 'Courtly protects customer information with data security measures (SSL/TLS encryption in transit, role-based access). We do not share, sell or transfer your information to third parties for commercial purposes, except when required by competent authorities under the law.' },
      { h: '3. Your rights over your personal data', p: 'You can review, update or request deletion of your personal information at any time in My profile on the website, or by contacting the Club Management via our official email/hotline. You can turn off promotional messages in your profile or with the unsubscribe link at the bottom of every email.' }
    ],
    rules: [
      { h: '1. Dress code & Court shoes', li: [
        'Tennis shoes:: non-marking tennis shoes are required in all court zones (Zone A, Zone B and VIP) to protect the cushioned court surface.',
        'Wear appropriate sportswear suitable for tennis.'] },
      { h: '2. Safety & Conduct on court', li: [
        'No smoking, stimulants or greasy food in the playing area.',
        'Do not litter; put bottles and dead balls in the bins next to the benches.',
        'Keep the changing rooms, lockers and showers clean.',
        'Respect your opponents, referees and players on neighbouring courts; avoid noise that disturbs other matches.'] },
      { h: '3. Playing time & Court handover', li: [
        'Arrive 10–15 minutes before your slot to check in at reception and warm up.',
        'When your time ends, collect your balls and belongings and hand the court over on time for the next booking.',
        'To keep playing, ask reception or use Extend play time on the website if the court is free.'] }
    ],
    booking: [
      { h: '1. Booking & Deposit', p: 'When booking online, pay a deposit of 50% of the court fee within 5 minutes of creating the booking (VietQR), or choose to pay cash at reception. If the hold expires, the time slot is released to other players automatically.' },
      { h: '2. Cancellation & Deposit refunds', li: [
        'More than 24 hours before play:: 100% of the deposit is refunded.',
        'Between 12 and 24 hours before play:: 50% of the deposit is refunded.',
        'Less than 12 hours before play:: the deposit is non-refundable, as the court was reserved for you and cannot be re-booked in time.',
        'Force majeure (heavy rain on outdoor Zone A, technical issues):: Management will contact you to reschedule free of charge or refund 100% of the deposit.'] },
      { h: '3. Check-in & Remaining balance', p: 'On arrival, open your e-ticket on the website so reception can scan the QR code. The remaining balance (after the deposit) is paid at reception in cash or by bank transfer at check-out.' }
    ]
  }
};
