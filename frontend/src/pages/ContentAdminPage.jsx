import React,{useState,useEffect} from 'react';
import {api} from '../services/api';
import {Title,Panel,Button,Modal,Table} from '../components/UI';
import {Stars} from './InformationPage';

const articleEmpty = {
  title: '',
  excerpt: '',
  body: '',
  category: 'NEWS',
  status: 'PUBLISHED',
  tournamentId: '',
  imageUrl: '/guest/zone-a-outdoor.webp'
};

const profileFields = [
  ['name','Tên câu lạc bộ',100],
  ['tagline','Câu giới thiệu ngắn',160],
  ['intro','Đoạn mở đầu',800,'textarea'],
  ['story','Câu chuyện / thông tin về câu lạc bộ',5000,'textarea'],
  ['mission','Định hướng trải nghiệm',1000,'textarea'],
  ['address','Địa chỉ',400],
  ['phone','Điện thoại',30,'tel'],
  ['email','Email liên hệ',254,'email'],
  ['openingHours','Giờ tiếp nhận / hỗ trợ',250],
  ['mapUrl','Link bản đồ HTTPS',500,'url'],
  ['socialUrl','Link mạng xã hội HTTPS',500,'url'],
  ['paymentInstructions','Hướng dẫn cọc, thanh toán và hoàn tiền',2000,'textarea']
];

const photoPresets = [
  { label: 'Sân ngoài trời Khu A', url: '/guest/zone-a-outdoor.webp' },
  { label: 'Sân trong nhà Khu B', url: '/guest/zone-b-indoor.webp' },
  { label: 'VIP Lounge Clubhouse', url: '/guest/zone-v-lounge.webp' },
  { label: 'Giải đấu / Sự kiện', url: '/guest/ways-banner.webp' },
  { label: 'Tập luyện / Đôi nam', url: '/guest/doubles.webp' }
];

export default function ContentAdminPage(){
  const [data,setData] = useState(null);
  const [tab,setTab] = useState('club');
  const [error,setError] = useState('');
  const [notice,setNotice] = useState('');
  const [busy,setBusy] = useState(false);
  const [editor,setEditor] = useState(null);
  const [review,setReview] = useState(null);
  const [filter,setFilter] = useState('ALL');

  const load = async () => {
    const d = await api('/content');
    setData(d);
    return d;
  };

  useEffect(() => {
    load().catch(e => setError(e.message));
  }, []);

  const save = async (path, method, body, done) => {
    if (busy) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await api(path, method, body);
      await load();
      done?.();
      setNotice('Đã lưu thay đổi.');
    } catch(e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const change = (key, value) => setData(d => ({ ...d, club: { ...d.club, [key]: value } }));

  return (
    <>
      <Title
        subtitle="Quản lý thông tin công khai câu lạc bộ, đăng bài viết tin tức và phản hồi ý kiến khách hàng."
        action={<a className="btn" href="/tin-tuc" target="_blank" rel="noreferrer">Xem trang tin tức</a>}
      >
        Nội dung & feedback
      </Title>

      <div className="time-filters" role="group" aria-label="Quản lý nội dung">
        {[
          ['club', 'Giới thiệu & liên hệ'],
          ['articles', 'Tin tức & thông báo'],
          ['feedback', 'Feedback & Đánh giá']
        ].map(([key, label]) => (
          <button
            key={key}
            className={tab === key ? 'on' : ''}
            aria-pressed={tab === key}
            onClick={() => { setTab(key); setError(''); setNotice(''); }}
          >
            {label}
            {key === 'feedback' && data ? ` (${data.feedback.filter(f => f.status === 'PENDING').length})` : ''}
          </button>
        ))}
      </div>

      {error && <div className="error" role="alert">{error}</div>}
      {notice && <div className="notice" role="status" style={{ marginBottom: 16 }}>{notice}</div>}
      
      {!data ? (
        <div className="loading">Đang tải nội dung…</div>
      ) : (
        <>
          {tab === 'club' && (
            <Panel title="Thông tin câu lạc bộ">
              <form className="panel-body" onSubmit={e => { e.preventDefault(); save('/content/club', 'PUT', data.club); }}>
                <div className="form-grid">
                  {profileFields.map(([key, label, max, type]) => (
                    <div className={`field ${type === 'textarea' ? 'full' : ''}`} key={key}>
                      <label htmlFor={'club-' + key}>{label}</label>
                      {type === 'textarea' ? (
                        <textarea
                          id={'club-' + key}
                          rows={key === 'story' ? 6 : 3}
                          maxLength={max}
                          required={['intro', 'story', 'mission'].includes(key)}
                          value={data.club[key] || ''}
                          onChange={e => change(key, e.target.value)}
                        />
                      ) : (
                        <input
                          id={'club-' + key}
                          type={type || 'text'}
                          maxLength={max}
                          required={['name', 'tagline'].includes(key)}
                          value={data.club[key] || ''}
                          onChange={e => change(key, e.target.value)}
                        />
                      )}
                    </div>
                  ))}
                </div>
                <button className="btn primary" disabled={busy} style={{ marginTop: 24 }}>
                  {busy ? 'Đang lưu…' : 'Lưu thông tin công khai'}
                </button>
              </form>
            </Panel>
          )}

          {tab === 'articles' && (
            <Panel
              title="Bài viết & tin tức câu lạc bộ"
              action={
                <Button className="primary" onClick={() => { setError(''); setEditor({ ...articleEmpty }); }}>
                  + Viết bài mới
                </Button>
              }
            >
              <Table headings={['Tiêu đề bài viết', 'Chuyên mục', 'Trạng thái', 'Hành động']} empty={!data.articles.length}>
                {data.articles.map(a => (
                  <tr key={a.id}>
                    <td className="name">
                      <strong>{a.title}</strong>
                      <small style={{ color: '#64748b', display: 'block', marginTop: 3 }}>
                        {a.publishedAt ? `Ngày đăng: ${new Date(a.publishedAt).toLocaleDateString('vi-VN')}` : 'Chưa xuất bản'}
                      </small>
                    </td>
                    <td>
                      {{
                        NEWS: 'Tin câu lạc bộ',
                        NOTICE: 'Thông báo',
                        TOURNAMENT: 'Giải đấu'
                      }[a.category] || a.category}
                    </td>
                    <td>
                      <span className={`chip ${a.status === 'PUBLISHED' ? 'green' : 'orange'}`}>
                        {a.status === 'PUBLISHED' ? 'Đã xuất bản' : 'Bản nháp'}
                      </span>
                    </td>
                    <td>
                      <div className="row-actions">
                        <Button
                          className="sm"
                          onClick={() => {
                            setError('');
                            setEditor({
                              ...a,
                              tournamentId: a.tournamentId || '',
                              imageUrl: a.imageUrl || '/guest/zone-a-outdoor.webp'
                            });
                          }}
                        >
                          Biên tập
                        </Button>
                        {a.status === 'PUBLISHED' && (
                          <>
                            <a className="btn sm" href={'/tin-tuc/' + a.id} target="_blank" rel="noreferrer">
                              Xem bài
                            </a>
                            <Button
                              className="sm"
                              disabled={busy}
                              onClick={() => save('/content/articles/' + a.id, 'PUT', { ...a, status: 'DRAFT' })}
                            >
                              Gỡ bài
                            </Button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </Table>
            </Panel>
          )}

          {tab === 'feedback' && (
            <Panel
              title="Hộp thư góp ý & đánh giá"
              action={
                <select aria-label="Lọc phản hồi" value={filter} onChange={e => setFilter(e.target.value)}>
                  <option value="ALL">Tất cả</option>
                  <option value="PENDING">Đang chờ xử lý</option>
                  <option value="PUBLISHED">Đã công khai</option>
                  <option value="PRIVATE">Giữ riêng</option>
                </select>
              }
            >
              <Table
                headings={['Người gửi', 'Đánh giá', 'Nội dung', 'Hiển thị', '']}
                empty={!data.feedback.some(f => filter === 'ALL' || f.status === filter)}
              >
                {data.feedback.filter(f => filter === 'ALL' || f.status === filter).map(f => (
                  <tr key={f.id}>
                    <td>
                      <strong>{f.displayName}</strong>
                      <small style={{ color: '#64748b', display: 'block', marginTop: 3 }}>
                        {new Date(f.createdAt).toLocaleString('vi-VN')}
                      </small>
                    </td>
                    <td><Stars rating={f.rating} /></td>
                    <td><p className="feedback-excerpt">{f.message}</p></td>
                    <td>
                      {f.status === 'PUBLISHED' ? 'Công khai' : f.status === 'PRIVATE' ? 'Giữ riêng' : 'Đang chờ xử lý'}
                    </td>
                    <td>
                      <Button className="sm" onClick={() => { setError(''); setReview({ ...f }); }}>
                        Xem & trả lời
                      </Button>
                    </td>
                  </tr>
                ))}
              </Table>
            </Panel>
          )}
        </>
      )}

      {editor && (
        <Modal
          title={editor.id ? 'Biên tập bài viết' : 'Viết bài tin tức mới'}
          wide
          onClose={() => !busy && setEditor(null)}
        >
          <form
            className="auth-fields"
            onSubmit={e => {
              e.preventDefault();
              save(
                '/content/articles' + (editor.id ? '/' + editor.id : ''),
                editor.id ? 'PUT' : 'POST',
                editor,
                () => setEditor(null)
              );
            }}
          >
            <div className="field">
              <label htmlFor="article-title">Tiêu đề bài viết</label>
              <input
                id="article-title"
                required
                maxLength={160}
                placeholder="Nhập tiêu đề tin tức, thông báo hoặc sự kiện..."
                value={editor.title}
                onChange={e => setEditor(a => ({ ...a, title: e.target.value }))}
              />
            </div>

            <div className="form-grid">
              <div className="field">
                <label htmlFor="article-category">Chuyên mục</label>
                <select
                  id="article-category"
                  value={editor.category}
                  onChange={e => setEditor(a => ({ ...a, category: e.target.value }))}
                >
                  <option value="NEWS">Tin câu lạc bộ</option>
                  <option value="NOTICE">Thông báo vận hành</option>
                  <option value="TOURNAMENT">Giải đấu & Sự kiện</option>
                </select>
              </div>

              <div className="field">
                <label htmlFor="article-status">Trạng thái phát hành</label>
                <select
                  id="article-status"
                  value={editor.status}
                  onChange={e => setEditor(a => ({ ...a, status: e.target.value }))}
                >
                  <option value="PUBLISHED">Xuất bản công khai</option>
                  <option value="DRAFT">Lưu bản nháp</option>
                </select>
              </div>
            </div>

            <div className="field">
              <label htmlFor="article-tournament">Gắn giải đấu liên quan (Tùy chọn)</label>
              <select
                id="article-tournament"
                value={editor.tournamentId || ''}
                onChange={e => setEditor(a => ({ ...a, tournamentId: e.target.value }))}
              >
                <option value="">Không gắn giải đấu</option>
                {(data?.tournaments || []).map(t => (
                  <option key={t.id} value={t.id}>
                    {t.name}{t.status === 'DRAFT' ? ' (bản nháp)' : ''}
                  </option>
                ))}
              </select>
            </div>

            <div className="field">
              <label>Ảnh bìa bài viết</label>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
                {photoPresets.map(preset => (
                  <button
                    key={preset.url}
                    type="button"
                    onClick={() => setEditor(a => ({ ...a, imageUrl: preset.url }))}
                    style={{
                      padding: '4px 10px',
                      borderRadius: 16,
                      fontSize: 12,
                      border: '1px solid',
                      borderColor: editor.imageUrl === preset.url ? '#1e3a2b' : '#cbd5e1',
                      background: editor.imageUrl === preset.url ? '#1e3a2b' : '#f8fafc',
                      color: editor.imageUrl === preset.url ? '#ffffff' : '#334155',
                      cursor: 'pointer'
                    }}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
              <input
                type="text"
                placeholder="URL ảnh (/guest/... hoặc https://...)"
                value={editor.imageUrl || ''}
                onChange={e => setEditor(a => ({ ...a, imageUrl: e.target.value }))}
              />
            </div>

            <div className="field">
              <label htmlFor="article-excerpt">Đoạn tóm tắt mở đầu (Sapo)</label>
              <textarea
                id="article-excerpt"
                required
                maxLength={400}
                rows={3}
                placeholder="Tóm tắt ngắn gọn nội dung tin tức..."
                value={editor.excerpt}
                onChange={e => setEditor(a => ({ ...a, excerpt: e.target.value }))}
              />
            </div>

            <div className="field">
              <label htmlFor="article-body">Nội dung chi tiết bài viết</label>
              <textarea
                id="article-body"
                required
                maxLength={12000}
                rows={9}
                placeholder="Nhập toàn văn bài viết, xuống dòng để ngắt đoạn..."
                value={editor.body}
                onChange={e => setEditor(a => ({ ...a, body: e.target.value }))}
              />
            </div>

            {error && <div className="error" role="alert">{error}</div>}

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 16 }}>
              <button
                type="button"
                className="btn secondary"
                disabled={busy}
                onClick={() => setEditor(null)}
              >
                Hủy
              </button>
              <button className="btn primary" disabled={busy}>
                {busy ? 'Đang lưu…' : editor.status === 'PUBLISHED' ? 'Lưu & Xuất bản' : 'Lưu bản nháp'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {review && (
        <Modal title="Phản hồi ý kiến khách hàng" onClose={() => !busy && setReview(null)}>
          <Stars rating={review.rating} />
          <p className="preserve-lines" style={{ margin: '16px 0', fontSize: 14 }}>{review.message}</p>
          <p className="subtitle" style={{ color: '#64748b' }}>
            {review.displayName} · {review.publishConsent ? 'Khách đồng ý công khai' : 'Khách chỉ gửi riêng cho CLB'}
          </p>
          <form
            className="auth-fields"
            style={{ marginTop: 20 }}
            onSubmit={e => {
              e.preventDefault();
              save(
                '/content/feedback/' + review.id,
                'PATCH',
                { status: review.status, reply: review.reply },
                () => setReview(null)
              );
            }}
          >
            <div className="field">
              <label htmlFor="review-status">Chế độ hiển thị</label>
              <select
                id="review-status"
                value={review.status}
                onChange={e => setReview(f => ({ ...f, status: e.target.value }))}
              >
                <option value="PENDING">Đang chờ xử lý</option>
                <option value="PRIVATE">Giữ riêng nội bộ</option>
                <option value="PUBLISHED" disabled={!review.publishConsent}>
                  Công khai trên trang Đánh giá
                </option>
              </select>
            </div>
            <div className="field">
              <label htmlFor="review-reply">Phản hồi của câu lạc bộ</label>
              <textarea
                id="review-reply"
                rows={4}
                maxLength={2000}
                placeholder="Nhập nội dung phản hồi gửi đến khách hàng..."
                value={review.reply || ''}
                onChange={e => setReview(f => ({ ...f, reply: e.target.value }))}
              />
            </div>
            {error && <div className="error" role="alert">{error}</div>}
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 16 }}>
              <button
                type="button"
                className="btn secondary"
                disabled={busy}
                onClick={() => setReview(null)}
              >
                Đóng
              </button>
              <button className="btn primary" disabled={busy}>
                {busy ? 'Đang lưu…' : 'Lưu phản hồi'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
