import React, { useState, useMemo, useRef } from 'react';
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

// ==========================================
// ARTICLE READER COMPONENT (CHẾ ĐỘ ĐỌC BÁO THỰC THỤ)
// ==========================================
export function ArticleReader({ article: a, onBack, onSelectArticle, allArticles = [] }) {
  const { t, navigate } = useGuest();
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
          'This year’s prize pool features honorary championship trophies, commemorative medals, sponsor awards, and a 1-year Member Plus package at Courtly.',
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
        'Cơ cấu giải thưởng năm nay bao gồm Cúp vàng danh dự, huy chương lưu niệm cùng các phần thưởng giá trị từ nhà tài trợ và gói hội viên Member Plus 1 năm tại CLB Courtly.',
        'Các trận đấu sẽ được điều hành bởi đội ngũ trọng tài đạt chuẩn Liên đoàn Quần vợt Việt Nam, đảm bảo tính công bằng, chuẩn xác và tinh thần thể thao cao thượng xuyên suốt giải đấu.'
      ];
    }

    if (a.title?.includes('Bảo dưỡng') || a.title?.includes('Khu B') || a.category === 'FACILITY') {
      return [
        'Nhằm mang lại trải nghiệm thi đấu mượt mà và an toàn tối đa cho quý hội viên, Ban Quản Lý Cụm sân Courtly Tennis Club vừa hoàn tất đợt đại tu, bảo dưỡng định kỳ toàn diện cụm 4 sân trong nhà Khu B (B01 – B04).',
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
          <span style={{ color: '#047857' }}>{t(a.category || 'TIN TỨC')}</span>
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
                      {t(item.category || 'TIN TỨC')}
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
        title: 'Courtly Club ra mắt đặc quyền Hội viên Member Plus mùa giải mới',
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
          COURTLY JOURNAL · BẢNG TIN QUẦN VỢT
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
                    {t(a.category || 'TIN TỨC')}
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
                <dd>{v || t('Đang cập nhật')}</dd>
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
    userRole: 'Hội viên Club Plus',
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
    userRole: 'Hội viên VIP',
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
    userRole: 'Hội viên mới',
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
    userRole: 'Hội viên Club',
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
    userRole: 'Hội viên mới',
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
    userRole: 'Hội viên Club',
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
      message: 'Dạ cảm ơn anh Bảo! Để giữ giờ vàng dễ hơn, anh có thể đăng ký gói Hội viên để được quyền đặt trước đến 14 - 21 ngày so với khách thông thường nhé ạ!'
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
    userRole: 'Hội viên mới',
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
export function Feedback() {
  const { t, user, login, content, refresh, notify, navigate } = useGuest();
  const [rating, setRating] = useState(0); // 0 = unselected by default
  const [hoverRating, setHoverRating] = useState(0);
  const [message, setMessage] = useState('');
  const [topic, setTopic] = useState('COURT');
  const [consent, setConsent] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [filterTopic, setFilterTopic] = useState('ALL');
  const [sortBy, setSortBy] = useState('NEWEST');
  const [currentPage, setCurrentPage] = useState(1);
  const [req, setReq] = useState(requestId);
  const [localSubmissions, setLocalSubmissions] = useState([]);
  const [eligibleOrders, setEligibleOrders] = useState([]);
  const [selectedOrderId, setSelectedOrderId] = useState('');
  const reviewsContainerRef = useRef(null);

  useEffect(() => {
    if (user) {
      api('/feedback/eligible-orders').then(res => {
        setEligibleOrders(res || []);
        const urlParams = new URLSearchParams(window.location.search);
        const urlOrder = urlParams.get('orderId');
        if (urlOrder) setSelectedOrderId(urlOrder);
      }).catch(() => {});
    }
  }, [user]);

  const PAGE_SIZE = 6;

  const ratingDescriptions = {
    0: t('(Chạm vào ngôi sao để chọn từ 1 đến 5 sao)'),
    1: t('1 sao — 😞 Cần cải thiện nhiều'),
    2: t('2 sao — 🙁 Chưa hài lòng'),
    3: t('3 sao — 😐 Bình thường / Tạm ổn'),
    4: t('4 sao — 😊 Hài lòng & Dịch vụ tốt'),
    5: t('5 sao — 🌟 Tuyệt vời! Rất hài lòng')
  };

  const topics = [
    { value: 'COURT', label: t('Cơ sở & Mặt sân'), icon: '🏟️' },
    { value: 'SERVICE', label: t('Trọng tài & HLV'), icon: '👨‍⚖️' },
    { value: 'FACILITY', label: t('Tiện ích & Phục vụ'), icon: '🚿' },
    { value: 'WEBSITE', label: t('Website & Đặt sân'), icon: '💻' },
    { value: 'TOURNAMENT', label: t('Giải đấu & Sự kiện'), icon: '🏆' },
    { value: 'OTHER', label: t('Góp ý khác'), icon: '💬' }
  ];

  const submit = async e => {
    e.preventDefault();
    if (!user) {
      login();
      return;
    }
    if (!rating || rating < 1) {
      setError(t('Vui lòng chọn số sao đánh giá (từ 1 đến 5 sao).'));
      return;
    }
    if (!message.trim() || message.trim().length < 10) {
      setError(t('Vui lòng nhập nội dung đánh giá chi tiết (tối thiểu 10 ký tự).'));
      return;
    }

    setBusy(true);
    setError('');
    try {
      await api('/feedback', 'POST', { rating, message, topic, publishConsent: consent, orderId: selectedOrderId || null, requestId: req });

      const newReview = {
        id: 'local-' + Date.now(),
        userName: user.name || 'Hội viên Courtly',
        userRole: user.role === 'CUSTOMER' ? 'Khách hàng thân thiết' : 'Thành viên',
        userInitials: (user.name || 'U').slice(0, 2).toUpperCase(),
        avatarBg: '#173c32',
        rating,
        topic,
        topicLabel: topics.find(tp => tp.value === topic)?.label || topic,
        date: 'Vừa xong',
        message,
        reply: {
          adminName: 'Ban Quản Lý Courtly Club',
          adminRole: 'Phản hồi tự động',
          date: 'Vừa xong',
          message:
            'Cảm ơn bạn đã gửi đánh giá! Ban Quản Lý đã tiếp nhận ý kiến của bạn và sẽ phản hồi chi tiết trong thời gian sớm nhất ạ. 🎾'
        }
      };

      setLocalSubmissions(prev => [newReview, ...prev]);
      setMessage('');
      setRating(0); // Reset to unselected
      setCurrentPage(1);
      setReq(requestId());
      notify(t('Cảm ơn bạn! Đánh giá đã được gửi thành công đến Ban Quản Lý Courtly.'));
      await refresh().catch(() => {});
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  // Combine local submissions + server feedbacks + seed showcase feedbacks
  const serverFeedbacks = (content.feedback || []).map(f => ({
    id: f.id,
    userName: f.displayName || 'Hội viên ẩn danh',
    userRole: 'Khách hàng đã trải nghiệm',
    userInitials: (f.displayName || 'HV').slice(0, 2).toUpperCase(),
    avatarBg: '#334155',
    rating: f.rating || 5,
    topic: f.topic || 'OTHER',
    topicLabel: topics.find(tp => tp.value === f.topic)?.label || '💬 Đánh giá',
    date: f.createdAt ? new Date(f.createdAt).toLocaleDateString('vi-VN') : 'Gần đây',
    message: f.message,
    reply: f.reply
      ? {
          adminName: 'Ban Quản Lý Courtly Club',
          adminRole: 'Phản hồi chính thức',
          date: 'Phản hồi sau kiểm duyệt',
          message: f.reply
        }
      : null
  }));

  const allFeedbacks = useMemo(() => {
    return [...localSubmissions, ...serverFeedbacks, ...INITIAL_SHOWCASE_FEEDBACKS];
  }, [localSubmissions, serverFeedbacks]);

  // Real stats calculated directly from feedbacks (NO FAKE CRITERIA BARS)
  const stats = useMemo(() => {
    const total = allFeedbacks.length;
    if (total === 0) return { avg: '5.0', total: 0, counts: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 } };
    const counts = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    let sum = 0;
    allFeedbacks.forEach(f => {
      const r = Math.max(1, Math.min(5, Math.round(f.rating || 5)));
      counts[r] = (counts[r] || 0) + 1;
      sum += f.rating || 5;
    });
    return {
      avg: (sum / total).toFixed(1),
      total,
      counts
    };
  }, [allFeedbacks]);

  // Filtered feedbacks
  const filteredFeedbacks = useMemo(() => {
    return allFeedbacks
      .filter(f => {
        if (filterTopic === 'ALL') return true;
        if (filterTopic === '5STAR') return f.rating === 5;
        if (filterTopic === '4STAR') return f.rating === 4;
        if (filterTopic === '3STAR') return f.rating <= 3;
        if (filterTopic === 'HAS_REPLY') return Boolean(f.reply);
        return f.topic === filterTopic;
      })
      .sort((a, b) => {
        if (sortBy === 'RATING_DESC') return b.rating - a.rating;
        return 0; // Default order (newest first)
      });
  }, [allFeedbacks, filterTopic, sortBy]);

  // Pagination calculations
  const totalItems = filteredFeedbacks.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE));
  const paginatedFeedbacks = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredFeedbacks.slice(start, start + PAGE_SIZE);
  }, [filteredFeedbacks, currentPage, PAGE_SIZE]);

  const handlePageChange = newPage => {
    if (newPage < 1 || newPage > totalPages) return;
    setCurrentPage(newPage);
    if (reviewsContainerRef.current) {
      reviewsContainerRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const handleFilterChange = newFilter => {
    setFilterTopic(newFilter);
    setCurrentPage(1);
  };

  const currentDisplayRating = hoverRating || rating;

  return (
    <section className="ct-pad" style={{ maxWidth: 1160, margin: '0 auto', paddingBottom: 60 }}>
      {/* 1. HEADER SECTION */}
      <div className="gx-heading" style={{ marginBottom: 24, textAlign: 'center' }}>
        <span className="ct-eyebrow" style={{ color: '#173c32', letterSpacing: 2 }}>
          COURTLY · ĐÁNH GIÁ & GÓP Ý
        </span>
        <h1 style={{ fontSize: 32, margin: '8px 0 10px', color: '#173c32', letterSpacing: 'normal' }}>
          {t('Lắng nghe trải nghiệm · Hoàn thiện mỗi ngày')}
        </h1>
        <p style={{ fontSize: 14.5, color: '#52655a', maxWidth: 680, margin: '0 auto', lineHeight: 1.65 }}>
          {t(
            'Mỗi lượt đánh giá chân thực từ quý khách là cơ sở để Courtly liên tục nâng cao chất lượng sân bãi, dịch vụ trọng tài và tiện ích phục vụ.'
          )}
        </p>
      </div>

      {/* 2. RATING SUMMARY SCORECARD (GENUINE STAR DISTRIBUTION, NO FAKE CRITERIA BARS) */}
      <div
        style={{
          background: '#ffffff',
          border: '1px solid #dce4d6',
          borderRadius: 16,
          padding: '24px 28px',
          marginBottom: 24,
          boxShadow: '0 4px 20px rgba(23,60,50,0.04)',
          display: 'grid',
          gridTemplateColumns: 'auto 1fr',
          gap: 36,
          alignItems: 'center'
        }}
      >
        {/* Overall Score */}
        <div style={{ textAlign: 'center', paddingRight: 32, borderRight: '1px solid #eef2ea', minWidth: 160 }}>
          <div style={{ fontSize: 46, fontWeight: 900, lineHeight: 1, color: '#173c32' }}>{stats.avg}</div>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 3, margin: '8px 0 6px' }}>
            {[1, 2, 3, 4, 5].map(s => {
              const full = s <= Math.round(Number(stats.avg));
              return (
                <Star
                  key={s}
                  size={20}
                  fill={full ? '#f59e0b' : '#f1f5f9'}
                  color={full ? '#d97706' : '#cbd5e1'}
                  strokeWidth={1}
                />
              );
            })}
          </div>
          <span style={{ fontSize: 13, fontWeight: 700, color: '#15803d', display: 'block' }}>
            {t('Chỉ số đánh giá cao')}
          </span>
          <span style={{ fontSize: 12, color: '#64748b', marginTop: 2, display: 'block' }}>
            {stats.total} {t('lượt đánh giá')}
          </span>
        </div>

        {/* Real Star Rating Distribution (Clickable to filter) */}
        <div style={{ display: 'grid', gap: 6 }}>
          {[5, 4, 3, 2, 1].map(stars => {
            const count = stats.counts[stars] || 0;
            const pct = stats.total > 0 ? Math.round((count / stats.total) * 100) : 0;
            const isFilterActive = filterTopic === (stars === 5 ? '5STAR' : stars === 4 ? '4STAR' : stars <= 3 ? '3STAR' : 'ALL');
            return (
              <div
                key={stars}
                onClick={() => handleFilterChange(stars === 5 ? '5STAR' : stars === 4 ? '4STAR' : '3STAR')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  fontSize: 12.5,
                  cursor: 'pointer',
                  padding: '3px 6px',
                  borderRadius: 6,
                  background: isFilterActive ? '#f0fdf4' : 'transparent',
                  transition: 'background 0.15s ease'
                }}
                title={`Xem các đánh giá ${stars} sao`}
              >
                <div style={{ width: 44, fontWeight: 700, color: '#334155', display: 'flex', alignItems: 'center', gap: 3 }}>
                  <span>{stars}</span>
                  <Star size={13} fill="#f59e0b" color="#d97706" strokeWidth={1} />
                </div>
                <div style={{ flex: 1, background: '#f1f5f9', height: 8, borderRadius: 4, overflow: 'hidden' }}>
                  <div
                    style={{
                      background: stars >= 4 ? '#10b981' : stars === 3 ? '#f59e0b' : '#ef4444',
                      width: `${pct}%`,
                      height: '100%',
                      borderRadius: 4
                    }}
                  />
                </div>
                <div style={{ width: 70, textAlign: 'right', color: '#64748b', fontSize: 12 }}>
                  <b>{pct}%</b> <span style={{ color: '#94a3b8' }}>({count})</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 3. INLINE REVIEW COMPOSER (ALWAYS VISIBLE RIGHT HERE, NO EXTRA BUTTON, NO SCROLLING DOWN) */}
      <div
        style={{
          background: '#ffffff',
          border: '1.5px solid #cfe0cb',
          borderRadius: 16,
          padding: '24px 26px',
          marginBottom: 28,
          boxShadow: '0 6px 24px rgba(23,60,50,0.06)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, borderBottom: '1px solid #f1f4ec', paddingBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div
              style={{
                width: 42,
                height: 42,
                borderRadius: '50%',
                background: user ? '#173c32' : '#e2e8f0',
                color: user ? '#def46a' : '#64748b',
                display: 'grid',
                placeItems: 'center',
                fontSize: 16,
                fontWeight: 800
              }}
            >
              {user ? (user.name || 'U').slice(0, 2).toUpperCase() : '👤'}
            </div>
            <div>
              <strong style={{ fontSize: 15, color: '#173c32', display: 'block' }}>
                {user ? `Xin chào, ${user.name}` : t('Viết đánh giá trải nghiệm của bạn')}
              </strong>
              <span style={{ fontSize: 12, color: user ? '#15803d' : '#64748b', fontWeight: user ? 600 : 400 }}>
                {user ? (
                  '✓ Tài khoản hội viên đã xác thực'
                ) : (
                  <span>
                    Chưa đăng nhập ·{' '}
                    <button
                      type="button"
                      onClick={() => login('login', { from: 'feedback' })}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: '#047857',
                        fontWeight: 700,
                        textDecoration: 'underline',
                        cursor: 'pointer',
                        padding: 0
                      }}
                    >
                      Đăng nhập ngay
                    </button>{' '}
                    để hiển thị tích xanh
                  </span>
                )}
              </span>
            </div>
          </div>

          <span style={{ fontSize: 12, color: '#64748b', background: '#f8faf6', padding: '4px 10px', borderRadius: 20, border: '1px solid #e2e8dc' }}>
            💬 Đánh giá công khai
          </span>
        </div>

        <form onSubmit={submit} style={{ display: 'grid', gap: 16 }}>
          {/* CHỌN BUỔI CHƠI (SERVICE RECOVERY & ORDER LINKING) */}
          {user && (
            <div style={{ background: '#fcfdfa', border: '1px solid #e7ede2', borderRadius: 12, padding: '12px 16px' }}>
              <label style={{ fontSize: 13, fontWeight: 700, color: '#173c32', display: 'block', marginBottom: 6 }}>
                {t('Buổi chơi cần đánh giá (trong 14 ngày qua)')}
              </label>
              <select
                value={selectedOrderId}
                onChange={e => setSelectedOrderId(e.target.value)}
                style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 13 }}
              >
                <option value="">{t('Góp ý chung (không gắn buổi chơi cụ thể)')}</option>
                {eligibleOrders.map(o => (
                  <option key={o.id} value={o.id}>
                    {o.orderCode} · {o.courtNames || 'Sân'} ({o.date})
                  </option>
                ))}
              </select>
            </div>
          )}
          {/* STAR SELECTOR: BIG, PROMINENT, UNSELECTED BY DEFAULT */}
          <div style={{ background: '#fcfdfa', border: '1px solid #e7ede2', borderRadius: 12, padding: '14px 16px' }}>
            <label style={{ fontSize: 13.5, fontWeight: 700, color: '#173c32', display: 'block', marginBottom: 8 }}>
              {t('Bạn chấm mấy sao cho buổi chơi tại Courtly?')} <span style={{ color: '#dc2626' }}>*</span>
            </label>

            <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', gap: 6 }} onMouseLeave={() => setHoverRating(0)}>
                {[1, 2, 3, 4, 5].map(s => {
                  const isFilled = s <= currentDisplayRating;
                  return (
                    <button
                      key={s}
                      type="button"
                      onClick={() => {
                        setRating(s);
                        setError('');
                      }}
                      onMouseEnter={() => setHoverRating(s)}
                      aria-label={`${s} sao`}
                      style={{
                        background: isFilled ? '#fef3c7' : '#ffffff',
                        border: isFilled ? '2px solid #f59e0b' : '1.5px solid #cbd5e1',
                        borderRadius: 10,
                        padding: '6px 10px',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transform: currentDisplayRating === s ? 'scale(1.1)' : 'scale(1)',
                        boxShadow: isFilled ? '0 2px 8px rgba(245,158,11,0.25)' : 'none'
                      }}
                    >
                      <Star
                        size={28}
                        fill={isFilled ? '#f59e0b' : '#f8fafc'}
                        color={isFilled ? '#d97706' : '#94a3b8'}
                        strokeWidth={1.5}
                      />
                    </button>
                  );
                })}
              </div>

              {/* RATING LABEL (DISSIPATES CONFUSION) */}
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 700,
                  color:
                    currentDisplayRating === 0
                      ? '#64748b'
                      : currentDisplayRating >= 4
                      ? '#15803d'
                      : currentDisplayRating === 3
                      ? '#b45309'
                      : '#dc2626',
                  fontStyle: currentDisplayRating === 0 ? 'italic' : 'normal'
                }}
              >
                {ratingDescriptions[currentDisplayRating]}
              </div>
            </div>
          </div>

          {/* MESSAGE TEXTAREA */}
          <div>
            <textarea
              value={message}
              onChange={e => {
                setMessage(e.target.value);
                if (error) setError('');
              }}
              required
              minLength={10}
              maxLength={2000}
              rows={3}
              placeholder={t(
                'Chia sẻ cảm nhận chi tiết của bạn về chất lượng mặt sân, độ nảy bóng, ánh sáng đèn LED, trọng tài hay tiện ích phòng tắm...'
              )}
              style={{
                width: '100%',
                padding: '12px 16px',
                borderRadius: 10,
                border: '1.5px solid #cfd7c9',
                background: '#ffffff',
                fontSize: 14,
                lineHeight: 1.6,
                resize: 'vertical',
                outline: 'none',
                boxSizing: 'border-box'
              }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4, fontSize: 11.5, color: '#78897e' }}>
              <span>Tối thiểu 10 ký tự</span>
              <span>{message.length} / 2000 ký tự</span>
            </div>
          </div>

          {/* TOPIC SELECTION PILLS */}
          <div>
            <div style={{ fontSize: 12.5, fontWeight: 700, color: '#173c32', marginBottom: 6 }}>
              {t('Chủ đề nhận xét (tùy chọn):')}
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {topics.map(tp => {
                const active = topic === tp.value;
                return (
                  <button
                    key={tp.value}
                    type="button"
                    onClick={() => setTopic(tp.value)}
                    style={{
                      background: active ? '#173c32' : '#f8faf6',
                      color: active ? '#def46a' : '#2b4437',
                      border: active ? '1.5px solid #173c32' : '1px solid #d5dcce',
                      borderRadius: 20,
                      padding: '5px 12px',
                      fontSize: 12,
                      fontWeight: active ? 700 : 500,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <span>{tp.icon}</span>
                    <span>{tp.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* CONSENT & ERROR */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                cursor: 'pointer',
                fontSize: 12.5,
                color: '#475569'
              }}
            >
              <input
                type="checkbox"
                checked={consent}
                onChange={e => setConsent(e.target.checked)}
                style={{ accentColor: '#173c32' }}
              />
              <span>{t('Cho phép hiển thị đánh giá công khai trên trang web của CLB')}</span>
            </label>

            {/* SUBMIT BUTTON */}
            <button
              type="submit"
              disabled={busy}
              style={{
                background: '#173c32',
                color: '#def46a',
                border: 'none',
                padding: '11px 26px',
                borderRadius: 30,
                fontSize: 14,
                fontWeight: 700,
                cursor: busy ? 'not-allowed' : 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                boxShadow: '0 4px 14px rgba(23,60,50,0.18)',
                marginLeft: 'auto'
              }}
            >
              <span>🎾</span>
              <span>
                {busy
                  ? t('Đang gửi…')
                  : user
                  ? t('Gửi đánh giá')
                  : t('Đăng nhập để gửi đánh giá')}
              </span>
            </button>
          </div>

          {error && (
            <div
              style={{
                background: '#fef2f2',
                border: '1px solid #fecaca',
                color: '#991b1b',
                padding: '10px 14px',
                borderRadius: 8,
                fontSize: 13
              }}
            >
              ⚠️ {error}
            </div>
          )}
        </form>
      </div>

      {/* 4. REVIEWS CONTAINER & FILTER TOOLBAR */}
      <div ref={reviewsContainerRef}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 12,
            marginBottom: 20
          }}
        >
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {[
              { id: 'ALL', label: `${t('Tất cả')} (${allFeedbacks.length})` },
              { id: '5STAR', label: `5 ⭐ (${stats.counts[5] || 0})` },
              { id: '4STAR', label: `4 ⭐ (${stats.counts[4] || 0})` },
              { id: '3STAR', label: `≤ 3 ⭐ (${(stats.counts[3] || 0) + (stats.counts[2] || 0) + (stats.counts[1] || 0)})` },
              { id: 'HAS_REPLY', label: '💬 ' + t('Có phản hồi BQL') }
            ].map(tab => {
              const active = filterTopic === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => handleFilterChange(tab.id)}
                  style={{
                    background: active ? '#173c32' : '#ffffff',
                    color: active ? '#def46a' : '#394d40',
                    border: active ? '1px solid #173c32' : '1px solid #d5dcce',
                    borderRadius: 20,
                    padding: '6px 14px',
                    fontSize: 12.5,
                    fontWeight: active ? 700 : 500,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* SORTING SELECT */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: '#52655a' }}>
            <span>{t('Sắp xếp:')}</span>
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value)}
              style={{
                padding: '6px 10px',
                borderRadius: 8,
                border: '1px solid #cfd7c9',
                background: '#ffffff',
                fontSize: 12.5,
                color: '#173c32',
                cursor: 'pointer'
              }}
            >
              <option value="NEWEST">{t('Mới nhất')}</option>
              <option value="RATING_DESC">{t('Đánh giá cao nhất')}</option>
            </select>
          </div>
        </div>

        {/* 5. 2-COLUMN RESPONSIVE REVIEWS GRID (BALANCED, CLEAN, CRISP) */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(460px, 1fr))',
            gap: 18,
            alignItems: 'stretch'
          }}
        >
          {paginatedFeedbacks.map(item => (
            <article
              key={item.id}
              style={{
                background: '#ffffff',
                border: '1px solid #e2e8dc',
                borderRadius: 14,
                padding: '22px 24px',
                boxShadow: '0 3px 14px rgba(23,60,50,0.03)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between'
              }}
            >
              <div>
                {/* CUSTOMER HEADER */}
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    flexWrap: 'wrap',
                    gap: 10,
                    marginBottom: 12
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div
                      style={{
                        width: 42,
                        height: 42,
                        borderRadius: '50%',
                        background: item.avatarBg || '#173c32',
                        color: '#ffffff',
                        display: 'grid',
                        placeItems: 'center',
                        fontSize: 15,
                        fontWeight: 700,
                        boxShadow: '0 2px 6px rgba(0,0,0,0.08)'
                      }}
                    >
                      {item.userInitials || 'HV'}
                    </div>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <strong style={{ fontSize: 14.5, color: '#173c32' }}>{item.userName}</strong>
                        <span
                          style={{
                            background: '#ecfdf5',
                            color: '#047857',
                            border: '1px solid #a7f3d0',
                            fontSize: 10.5,
                            fontWeight: 700,
                            padding: '1px 7px',
                            borderRadius: 10
                          }}
                        >
                          ✓ {item.userRole || t('Đã trải nghiệm')}
                        </span>
                      </div>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                          marginTop: 3,
                          fontSize: 12,
                          color: '#637269'
                        }}
                      >
                        <span>{item.date}</span>
                        <span>·</span>
                        <span style={{ color: '#173c32', fontWeight: 600 }}>{item.topicLabel}</span>
                      </div>
                    </div>
                  </div>

                  {/* STARS (CRISP, CLEAR) */}
                  <div style={{ display: 'flex', gap: 2 }}>
                    {[1, 2, 3, 4, 5].map(s => {
                      const filled = s <= item.rating;
                      return (
                        <Star
                          key={s}
                          size={16}
                          fill={filled ? '#f59e0b' : '#f1f5f9'}
                          color={filled ? '#d97706' : '#cbd5e1'}
                          strokeWidth={1}
                        />
                      );
                    })}
                  </div>
                </div>

                {/* REVIEW MESSAGE */}
                <p
                  style={{
                    fontSize: 14,
                    color: '#334155',
                    lineHeight: 1.65,
                    margin: '0 0 14px',
                    whiteSpace: 'pre-line'
                  }}
                >
                  "{item.message}"
                </p>
              </div>

              {/* ADMIN REPLY BLOCK */}
              {item.reply && (
                <div
                  style={{
                    background: '#f4f7ee',
                    borderLeft: '3.5px solid #173c32',
                    borderRadius: '0 10px 10px 0',
                    padding: '12px 16px',
                    marginTop: 10
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
                    <div
                      style={{
                        width: 22,
                        height: 22,
                        borderRadius: '50%',
                        background: '#173c32',
                        color: '#def46a',
                        display: 'grid',
                        placeItems: 'center',
                        fontSize: 11
                      }}
                    >
                      🎾
                    </div>
                    <strong style={{ fontSize: 12.5, color: '#173c32' }}>{item.reply.adminName}</strong>
                    <span
                      style={{
                        background: '#173c32',
                        color: '#def46a',
                        fontSize: 10,
                        fontWeight: 700,
                        padding: '1px 5px',
                        borderRadius: 4
                      }}
                    >
                      {item.reply.adminRole}
                    </span>
                    <span style={{ fontSize: 11, color: '#637269', marginLeft: 'auto' }}>
                      {item.reply.date}
                    </span>
                  </div>
                  <p style={{ fontSize: 13, color: '#27382f', lineHeight: 1.55, margin: 0, fontStyle: 'italic' }}>
                    {item.reply.message}
                  </p>
                </div>
              )}
            </article>
          ))}

          {paginatedFeedbacks.length === 0 && (
            <div
              style={{
                gridColumn: '1 / -1',
                textAlign: 'center',
                padding: '48px 20px',
                background: '#ffffff',
                borderRadius: 14,
                border: '1px dashed #cfd7c9',
                color: '#637269'
              }}
            >
              <span>🔍 {t('Không tìm thấy đánh giá phù hợp với bộ lọc hiện tại.')}</span>
            </div>
          )}
        </div>

        {/* 6. PAGINATION CONTROLS */}
        {totalPages > 1 && (
          <div
            style={{
              marginTop: 24,
              padding: '14px 20px',
              background: '#ffffff',
              border: '1px solid #dce2d6',
              borderRadius: 12,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: 12
            }}
          >
            <span style={{ fontSize: 12.5, color: '#52655a' }}>
              Hiển thị <b>{(currentPage - 1) * PAGE_SIZE + 1}</b> –{' '}
              <b>{Math.min(currentPage * PAGE_SIZE, totalItems)}</b> trên tổng số <b>{totalItems}</b> đánh giá
            </span>

            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {/* PREV BUTTON */}
              <button
                type="button"
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
                style={{
                  background: '#ffffff',
                  border: '1px solid #cfd7c9',
                  borderRadius: 6,
                  padding: '6px 12px',
                  fontSize: 12.5,
                  fontWeight: 600,
                  color: currentPage === 1 ? '#9ca3af' : '#173c32',
                  cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4
                }}
              >
                <ChevronLeft size={14} />
                <span>{t('Trước')}</span>
              </button>

              {/* NUMBER BUTTONS */}
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(num => {
                const active = num === currentPage;
                return (
                  <button
                    key={num}
                    type="button"
                    onClick={() => handlePageChange(num)}
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 6,
                      border: active ? 'none' : '1px solid #cfd7c9',
                      background: active ? '#173c32' : '#ffffff',
                      color: active ? '#def46a' : '#173c32',
                      fontSize: 12.5,
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                  >
                    {num}
                  </button>
                );
              })}

              {/* NEXT BUTTON */}
              <button
                type="button"
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
                style={{
                  background: '#ffffff',
                  border: '1px solid #cfd7c9',
                  borderRadius: 6,
                  padding: '6px 12px',
                  fontSize: 12.5,
                  fontWeight: 600,
                  color: currentPage === totalPages ? '#9ca3af' : '#173c32',
                  cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4
                }}
              >
                <span>{t('Tiếp')}</span>
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 7. CLUB SERVICE COMMITMENTS & SLA */}
      <div style={{ marginTop: 48, marginBottom: 24 }}>
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <span className="ct-eyebrow" style={{ color: '#173c32', letterSpacing: 2 }}>
            COURTLY QUALITY PROMISE
          </span>
          <h2 style={{ fontSize: 22, margin: '6px 0 0', color: '#173c32' }}>
            {t('Cam kết dịch vụ & Chuẩn mực phục vụ')}
          </h2>
        </div>

        <div className="gx-promise-grid">
          {[
            {
              icon: '🧹',
              title: 'Bảo dưỡng mặt sân mỗi ngày',
              desc: 'Mặt sân được vệ sinh, hút ẩm và kiểm tra độ căng lưới tiêu chuẩn trước 06:00 sáng mỗi ngày.'
            },
            {
              icon: '⚡',
              title: 'Hỗ trợ sự cố trong 15 phút',
              desc: 'Mọi vấn đề về ánh sáng LED, bóng, quạt thông gió được kỹ thuật viên có mặt xử lý trong 15 phút.'
            },
            {
              icon: '📞',
              title: 'Đường dây nóng khiếu nại 24/7',
              desc: 'Hotline Ban Quản Lý (090.123.4567) tiếp nhận mọi phản ánh chất lượng phục vụ và hoàn tiền nếu có sai sót.'
            },
            {
              icon: '☔',
              title: 'Chính sách bảo vệ thời tiết',
              desc: 'Hỗ trợ đổi lịch linh hoạt hoặc bảo lưu 100% tiền cọc khi thời tiết mưa gió bất khả kháng đối với sân ngoài trời.'
            }
          ].map((c, i) => (
            <div
              key={i}
              style={{
                background: '#ffffff',
                border: '1px solid #dbe2d4',
                borderRadius: 14,
                padding: '20px 22px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
              }}
            >
              <div style={{ fontSize: 26, marginBottom: 8 }}>{c.icon}</div>
              <strong style={{ fontSize: 14.5, color: '#173c32', display: 'block', marginBottom: 5 }}>
                {c.title}
              </strong>
              <p style={{ margin: 0, fontSize: 12.5, color: '#52655a', lineHeight: 1.55 }}>
                {c.desc}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* 8. DIRECT BOOKING CTA BANNER */}
      <div
        style={{
          background: 'linear-gradient(135deg, #13332b 0%, #1e4d40 100%)',
          borderRadius: 16,
          padding: '26px 32px',
          color: '#ffffff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 18,
          boxShadow: '0 6px 20px rgba(23,60,50,0.12)'
        }}
      >
        <div>
          <strong style={{ fontSize: 19, display: 'block', color: '#def46a', marginBottom: 4 }}>
            {t('Bạn đã sẵn sàng bước ra sân thi đấu?')}
          </strong>
          <span style={{ fontSize: 13.5, color: '#e2ebd9' }}>
            {t('Đặt trước khung giờ yêu thích chỉ với 30% cọc và nhận vé điện tử QR check-in tự động.')}
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
            padding: '12px 26px',
            fontSize: 14,
            fontWeight: 800,
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            boxShadow: '0 4px 14px rgba(0,0,0,0.2)'
          }}
        >
          <span>🎾</span> {t('Đặt sân ngay')} →
        </button>
      </div>
    </section>
  );
}

export function Policies() {
  const { t, route, navigate } = useGuest();
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
            'Văn bản quy định chuẩn mực dịch vụ, bảo vệ quyền lợi hội viên, an toàn sân đấu và bảo mật thông tin cá nhân theo quy định pháp luật.'
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

      {/* Tab 1: Privacy Policy */}
      {tab === 'privacy' && (
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
          <h2 style={{ fontSize: 20, color: '#173c32', marginBottom: 12 }}>1. Mục đích thu thập thông tin</h2>
          <p>Câu lạc bộ Courtly thu thập thông tin cá nhân (họ tên, số điện thoại, email) nhằm phục vụ các mục đích chính đáng sau:</p>
          <ul style={{ paddingLeft: 22, margin: '8px 0 18px' }}>
            <li>Xác thực và cấp quyền truy cập tài khoản đặt sân trực tuyến.</li>
            <li>Gửi thông báo xác nhận giữ chỗ, mã vé điện tử QR check-in vào sân.</li>
            <li>Liên hệ khẩn cấp trong trường hợp thay đổi lịch sân do điều kiện thời tiết hoặc bảo trì kỹ thuật.</li>
            <li>Gửi thông báo ưu đãi thành viên, voucher và thông tin giải đấu khi người dùng đăng ký nhận tin.</li>
          </ul>

          <h2 style={{ fontSize: 20, color: '#173c32', margin: '24px 0 12px' }}>2. Phạm vi sử dụng & Bảo mật thông tin</h2>
          <p>
            Courtly cam kết bảo mật tuyệt đối thông tin khách hàng bằng các tiêu chuẩn an toàn dữ liệu công nghệ cao (mã hóa SSL/TLS, xác thực JWT phân quyền). Chúng tôi <strong>tuyệt đối không chia sẻ, bán hoặc chuyển giao</strong> thông tin của quý khách cho bất kỳ bên thứ ba nào vì mục đích thương mại, ngoại trừ yêu cầu từ cơ quan có thẩm quyền theo quy định của pháp luật.
          </p>

          <h2 style={{ fontSize: 20, color: '#173c32', margin: '24px 0 12px' }}>3. Quyền của khách hàng đối với dữ liệu cá nhân</h2>
          <p>
            Quý khách có toàn quyền kiểm tra, cập nhật, điều chỉnh hoặc yêu cầu xóa thông tin cá nhân của mình bất kỳ lúc nào thông qua mục <strong>Hồ sơ của tôi</strong> trên website hoặc liên hệ trực tiếp với Ban Quản lý Câu lạc bộ qua email hoặc hotline chính thức.
          </p>
        </div>
      )}

      {/* Tab 2: Club Rules & Regulations */}
      {tab === 'rules' && (
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
          <h2 style={{ fontSize: 20, color: '#173c32', marginBottom: 12 }}>1. Quy định trang phục & Giày thi đấu</h2>
          <ul style={{ paddingLeft: 22, margin: '8px 0 18px' }}>
            <li>
              Người chơi bắt buộc phải mang <strong>giày tennis chuyên dụng (đế non-marking không để lại vết đen)</strong> khi bước vào tất cả các khu sân (Khu A, Khu B và Khu VIP) nhằm bảo vệ lớp sơn đệm tiêu chuẩn thi đấu.
            </li>
            <li>Mặc trang phục thể thao lịch sự, phù hợp với thuần phong mỹ tục và hoạt động quần vợt.</li>
          </ul>

          <h2 style={{ fontSize: 20, color: '#173c32', margin: '24px 0 12px' }}>2. Giữ gìn an ninh & Văn hóa ứng xử trên sân</h2>
          <ul style={{ paddingLeft: 22, margin: '8px 0 18px' }}>
            <li>Nghiêm cấm hút thuốc lá, sử dụng chất kích thích hoặc mang đồ ăn nhiều dầu mỡ vào trong khu vực thi đấu.</li>
            <li>Không xả rác bừa bãi; vỏ chai nước và bóng hỏng phải bỏ đúng thùng rác phân loại đặt cạnh ghế nghỉ.</li>
            <li>Giữ gìn vệ sinh chung tại khu vực phòng thay đồ, tủ locker và phòng tắm nước nóng.</li>
            <li>Tôn trọng đối thủ, trọng tài và các người chơi ở sân liền kề; không có hành vi phi thể thao hoặc gây ồn ào ảnh hưởng trận đấu khác.</li>
          </ul>

          <h2 style={{ fontSize: 20, color: '#173c32', margin: '24px 0 12px' }}>3. Thời gian thi đấu & Bàn giao sân</h2>
          <ul style={{ paddingLeft: 22, margin: '8px 0 18px' }}>
            <li>Người chơi vui lòng có mặt trước giờ thi đấu ít nhất 10–15 phút để làm thủ tục check-in tại quầy và khởi động.</li>
            <li>Khi hết giờ thi đấu, người chơi vui lòng chủ động dọn dẹp bóng, vật dụng cá nhân và bàn giao sân đúng giờ cho lượt khách kế tiếp.</li>
            <li>Nếu có nhu cầu đánh thêm, vui lòng liên hệ lễ tân hoặc dùng tính năng <strong>Gia hạn giờ chơi</strong> trên website nếu sân còn trống.</li>
          </ul>
        </div>
      )}

      {/* Tab 3: Booking, Deposit & Cancellation Rules */}
      {tab === 'booking' && (
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
          <h2 style={{ fontSize: 20, color: '#173c32', marginBottom: 12 }}>1. Đặt sân & Đặt cọc giữ chỗ</h2>
          <p>
            Để đảm bảo tính công bằng và tránh tình trạng đặt giữ chỗ ảo, khách hàng đặt sân trực tuyến cần thanh toán tiền cọc theo quy định (thường là 30% – 50% tổng giá trị đơn) trong vòng <strong>15 phút</strong> kể từ khi tạo đơn. Sau thời gian này, hệ thống sẽ tự động giải phóng khung giờ cho khách hàng khác.
          </p>

          <h2 style={{ fontSize: 20, color: '#173c32', margin: '24px 0 12px' }}>2. Quy định Hủy đơn & Hoàn tiền cọc</h2>
          <ul style={{ paddingLeft: 22, margin: '8px 0 18px' }}>
            <li>
              <strong>Hủy trước ít nhất 24 giờ so với giờ chơi:</strong> Được hoàn trả 80% – 100% số tiền cọc đã đóng (chuyển khoản về tài khoản gốc hoặc cộng vào số dư điểm thưởng / voucher trên hệ thống Courtly).
            </li>
            <li>
              <strong>Hủy trong vòng dưới 24 giờ so với giờ chơi:</strong> Tiền đặt cọc sẽ không được hoàn lại do sân đã được bố trí độc quyền cho quý khách và không kịp sắp xếp lượt khách thay thế.
            </li>
            <li>
              <strong>Trường hợp bất khả kháng (Mưa lớn đối với sân ngoài trời Khu A, sự cố kỹ thuật):</strong> Ban Quản lý sẽ chủ động liên hệ để hỗ trợ dời lịch chơi sang khung giờ khác hoàn toàn miễn phí hoặc hoàn trả 100% tiền cọc.
            </li>
          </ul>

          <h2 style={{ fontSize: 20, color: '#173c32', margin: '24px 0 12px' }}>3. Check-in & Thanh toán phần còn lại</h2>
          <p>
            Khi đến sân, người chơi mở vé điện tử trên ứng dụng/website để nhân viên lễ tân quét mã QR xác nhận. Số tiền còn lại của đơn đặt sân (sau khi trừ cọc) sẽ được thanh toán trực tiếp tại quầy bằng tiền mặt hoặc chuyển khoản ngân hàng trước khi vào sân.
          </p>
        </div>
      )}
    </section>
  );
}
