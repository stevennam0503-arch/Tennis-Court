import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { useCourtly } from '../context';
import { Title, Panel, Button, Modal, Table } from '../components/UI';
import { Stars } from './InformationPage';
import { 
  AlertTriangle, CheckCircle2, Clock, Gift, User, 
  MessageSquare, ShieldAlert, Sparkles, ChevronRight, X 
} from 'lucide-react';

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
  ['name', 'Tên câu lạc bộ', 100],
  ['tagline', 'Câu giới thiệu ngắn', 160],
  ['intro', 'Đoạn mở đầu', 800, 'textarea'],
  ['story', 'Câu chuyện / thông tin về câu lạc bộ', 5000, 'textarea'],
  ['mission', 'Định hướng trải nghiệm', 1000, 'textarea'],
  ['address', 'Địa chỉ', 400],
  ['phone', 'Điện thoại', 30, 'tel'],
  ['email', 'Email liên hệ', 254, 'email'],
  ['openingHours', 'Giờ tiếp nhận / hỗ trợ', 250],
  ['mapUrl', 'Link bản đồ HTTPS', 500, 'url'],
  ['socialUrl', 'Link mạng xã hội HTTPS', 500, 'url'],
  ['paymentInstructions', 'Hướng dẫn cọc, thanh toán và hoàn tiền', 2000, 'textarea']
];

const photoPresets = [
  { label: 'Sân ngoài trời Khu A', url: '/guest/zone-a-outdoor.webp' },
  { label: 'Sân trong nhà Khu B', url: '/guest/zone-b-indoor.webp' },
  { label: 'VIP Lounge Clubhouse', url: '/guest/zone-v-lounge.webp' },
  { label: 'Giải đấu / Sự kiện', url: '/guest/ways-banner.webp' },
  { label: 'Tập luyện / Đôi nam', url: '/guest/doubles.webp' }
];

const TOPIC_LABELS = {
  COURT: 'Cơ sở & Mặt sân',
  SERVICE: 'Trọng tài & HLV',
  FACILITY: 'Tiện ích & Phục vụ',
  WEBSITE: 'Website & Đặt sân',
  TOURNAMENT: 'Giải đấu & Sự kiện',
  OTHER: 'Góp ý khác'
};

export default function ContentAdminPage() {
  const { user, isAdmin, isStaff, notify } = useCourtly();
  const [data, setData] = useState(null);
  const [tab, setTab] = useState(isAdmin ? 'club' : 'feedback');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [editor, setEditor] = useState(null);
  const [review, setReview] = useState(null);
  const [filter, setFilter] = useState('ALL');

  // Compensation state in modal
  const [compensationTemplates, setCompensationTemplates] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState('APOLOGY_50K');
  // Voucher xin lỗi tuỳ chỉnh (chỉ Manager) — backend nhận templateCode 'CUSTOM'
  const CUSTOM_DEFAULT = { type: 'FIXED', value: 100000, minOrder: 0, maxDiscount: '', days: 30, reason: '' };
  const [customCompensation, setCustomCompensation] = useState(CUSTOM_DEFAULT);
  const setCustom = (k, v) => setCustomCompensation(prev => ({ ...prev, [k]: v }));
  const customSummary = c => {
    const val = Number(c.value || 0);
    const main = c.type === 'PERCENT'
      ? `Giảm ${val}%${c.maxDiscount ? ` tối đa ${Number(c.maxDiscount).toLocaleString('vi-VN')}₫` : ''}`
      : `Giảm ${val.toLocaleString('vi-VN')}₫`;
    const min = Number(c.minOrder || 0) > 0 ? ` cho đơn từ ${Number(c.minOrder).toLocaleString('vi-VN')}₫` : '';
    return `${main}${min}, hiệu lực ${Number(c.days || 0)} ngày`;
  };
  const [internalResolution, setInternalResolution] = useState('');
  const [rootCause, setRootCause] = useState('Mặt sân');

  const load = async () => {
    const [d, tpls] = await Promise.all([
      api('/content'),
      api('/content/feedback/compensation-templates').catch(() => [])
    ]);
    setData(d);
    if (Array.isArray(tpls)) {
      setCompensationTemplates(tpls);
      if (tpls.length > 0 && !selectedTemplate) {
        setSelectedTemplate(tpls[0].code);
      }
    }
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
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const handleAssign = async (feedbackId) => {
    try {
      const res = await api(`/content/feedback/${feedbackId}/assign`, 'POST');
      notify(`Đã nhận xử lý feedback.`);
      setReview(prev => ({ ...prev, assignedTo: res.assignedTo, handlingStatus: res.handlingStatus }));
      load();
    } catch (e) {
      notify('Lỗi nhận xử lý: ' + e.message);
    }
  };

  const handleCompensate = async (feedbackId) => {
    try {
      const templateCode = selectedTemplate || compensationTemplates[0]?.code || 'APOLOGY_50K';
      let payload = { templateCode };
      if (templateCode === 'CUSTOM') {
        const c = customCompensation;
        const value = Number(c.value);
        const days = Number(c.days);
        if (!(value > 0)) return notify('Nhập mức giảm lớn hơn 0.');
        if (c.type === 'PERCENT' && value > 100) return notify('Giảm theo % tối đa 100%.');
        if (c.type === 'PERCENT' && !(Number(c.maxDiscount) > 0)) return notify('Voucher giảm % cần nhập mức giảm tối đa (₫).');
        if (!(days >= 1 && days <= 365)) return notify('Hiệu lực từ 1 đến 365 ngày.');
        if ((c.reason || '').trim().length < 10) return notify('Lý do tặng voucher tuỳ chỉnh cần ít nhất 10 ký tự.');
        payload = {
          templateCode,
          type: c.type,
          value,
          minOrder: Number(c.minOrder || 0),
          ...(c.type === 'PERCENT' ? { maxDiscount: Number(c.maxDiscount) } : {}),
          days,
          reason: c.reason.trim()
        };
      }
      const res = await api(`/content/feedback/${feedbackId}/compensate`, 'POST', payload);
      notify(`Đã tặng voucher ${res.code} cho khách hàng (trạng thái: ${res.status})!`);
      setReview(prev => ({
        ...prev,
        compensationVoucherId: res.id,
        compensationVoucherCode: res.code
      }));
      load();
    } catch (e) {
      notify('Lỗi tặng voucher: ' + e.message);
    }
  };

  const handleResolve = async (feedbackId, status = 'RESOLVED') => {
    try {
      await api(`/content/feedback/${feedbackId}/resolve`, 'POST', {
        status,
        resolution: `[Nguyên nhân: ${rootCause}] ${internalResolution}`.trim(),
        reply: review.reply
      });
      notify(`Đã hoàn tất xử lý feedback.`);
      setReview(null);
      load();
    } catch (e) {
      notify('Lỗi xử lý feedback: ' + e.message);
    }
  };

  const change = (key, value) => setData(d => ({ ...d, club: { ...d.club, [key]: value } }));

  // Filter feedbacks
  const feedbackList = (data?.feedback || []).filter(f => {
    if (filter === 'ALL') return true;
    if (filter === 'LOW_RATING') return (f.rating <= 3 || f.lowRating) && f.handlingStatus !== 'RESOLVED' && f.handlingStatus !== 'NO_ACTION';
    if (filter === 'PENDING') return f.status === 'PENDING';
    if (filter === 'PUBLISHED') return f.status === 'PUBLISHED';
    if (filter === 'PRIVATE') return f.status === 'PRIVATE';
    return true;
  });

  const lowRatingCount = (data?.feedback || []).filter(f => (f.rating <= 3 || f.lowRating) && f.handlingStatus !== 'RESOLVED' && f.handlingStatus !== 'NO_ACTION').length;

  return (
    <>
      <Title
        subtitle="Quản lý thông tin câu lạc bộ, đăng bài viết tin tức và xử lý đánh giá của khách hàng."
        action={<a className="btn" href="/tin-tuc" target="_blank" rel="noreferrer">Xem trang tin tức</a>}
      >
        Nội dung & feedback
      </Title>

      <div className="time-filters" role="group" aria-label="Quản lý nội dung">
        {(isAdmin
          ? [
              ['club', 'Giới thiệu & liên hệ'],
              ['articles', 'Tin tức & thông báo'],
              ['feedback', 'Feedback & Đánh giá']
            ]
          : [['feedback', 'Feedback & Đánh giá']]
        ).map(([key, label]) => (
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
          {tab === 'club' && isAdmin && (
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
                          value={data.club[key] || ''}
                          onChange={e => change(key, e.target.value)}
                        />
                      ) : (
                        <input
                          id={'club-' + key}
                          type={type || 'text'}
                          maxLength={max}
                          value={data.club[key] || ''}
                          onChange={e => change(key, e.target.value)}
                        />
                      )}
                    </div>
                  ))}
                </div>
                <div style={{ marginTop: 20 }}>
                  <Button type="submit" disabled={busy}>Lưu thông tin</Button>
                </div>
              </form>
            </Panel>
          )}

          {tab === 'articles' && isAdmin && (
            <Panel
              title="Tin tức & thông báo"
              action={<Button onClick={() => setEditor({ ...articleEmpty })}>+ Viết bài mới</Button>}
            >
              <Table
                headings={['Tiêu đề', 'Danh mục', 'Trạng thái', 'Ngày đăng', '']}
                empty={data.articles.length === 0}
              >
                {data.articles.map(a => (
                  <tr key={a.id}>
                    <td><strong>{a.title}</strong></td>
                    <td>{a.category}</td>
                    <td>{a.status === 'PUBLISHED' ? 'Đã xuất bản' : 'Bản nháp'}</td>
                    <td>{a.publishedAt ? new Date(a.publishedAt).toLocaleDateString('vi-VN') : '—'}</td>
                    <td style={{ textAlign: 'right' }}>
                      <Button className="sm" onClick={() => setEditor({ ...a })}>Sửa</Button>
                    </td>
                  </tr>
                ))}
              </Table>
            </Panel>
          )}

          {tab === 'feedback' && (
            <Panel
              title="Hộp thư góp ý & Đánh giá dịch vụ"
              action={
                <select aria-label="Lọc phản hồi" value={filter} onChange={e => setFilter(e.target.value)}>
                  <option value="ALL">Tất cả ({data.feedback.length})</option>
                  <option value="LOW_RATING">⚠️ Đánh giá thấp cần xử lý ({lowRatingCount})</option>
                  <option value="PENDING">Đang chờ xử lý</option>
                  <option value="PUBLISHED">Đã công khai</option>
                  <option value="PRIVATE">Giữ riêng</option>
                </select>
              }
            >
              <Table
                headings={['Người gửi', 'Đánh giá & Buổi chơi', 'Nội dung', 'Trạng thái & Xử lý', '']}
                empty={feedbackList.length === 0}
              >
                {feedbackList.map(f => {
                  const isLow = f.rating <= 3 || f.lowRating;
                  const isOverdue = f.dueAt && new Date(f.dueAt) < new Date() && f.handlingStatus !== 'RESOLVED' && f.handlingStatus !== 'NO_ACTION';

                  return (
                    <tr key={f.id} style={{ background: isLow && f.handlingStatus !== 'RESOLVED' ? '#fffbeb' : undefined }}>
                      <td>
                        <strong>{f.displayName}</strong>
                        <small style={{ color: '#64748b', display: 'block', marginTop: 3 }}>
                          {new Date(f.createdAt).toLocaleString('vi-VN')}
                        </small>
                      </td>
                      <td>
                        <Stars rating={f.rating} />
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginTop: 3 }}>
                          {f.topic && (
                            <span style={{ fontSize: 11, background: '#f1f5f9', color: '#475569', padding: '1px 6px', borderRadius: 4, fontWeight: 600 }}>
                              {TOPIC_LABELS[f.topic] || f.topic}
                            </span>
                          )}
                          {f.courtNames && (
                            <span style={{ fontSize: 11, color: '#475569' }}>
                              📍 {f.courtNames} {f.visitDate ? `(${f.visitDate})` : ''}
                            </span>
                          )}
                        </div>
                      </td>
                      <td style={{ maxWidth: 320 }}>
                        <p className="feedback-excerpt" style={{ margin: 0 }}>{f.message}</p>
                        {f.compensationVoucherCode && (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: '#ecfdf5', color: '#065f46', padding: '2px 6px', borderRadius: 4, fontSize: 11, marginTop: 4 }}>
                            🎁 Đã bù: {f.compensationVoucherCode}
                          </span>
                        )}
                      </td>
                      <td>
                        {isLow ? (
                          <div>
                            <span style={{ 
                              display: 'inline-flex', alignItems: 'center', gap: 4, 
                              background: isOverdue ? '#fee2e2' : '#fef3c7', 
                              color: isOverdue ? '#991b1b' : '#92400e', 
                              padding: '2px 6px', borderRadius: 4, fontSize: 11, fontWeight: 700 
                            }}>
                              <AlertTriangle size={12} /> {isOverdue ? 'Quá hạn 24h' : 'Cần xử lý 24h'}
                            </span>
                            <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
                              {f.handlingStatus === 'RESOLVED' ? '✅ Đã giải quyết' : f.handlingStatus === 'IN_PROGRESS' ? `👤 ${f.assignedTo || 'Đang xử lý'}` : '⏳ Chờ nhận'}
                            </div>
                          </div>
                        ) : (
                          <span>{f.status === 'PUBLISHED' ? 'Công khai' : f.status === 'PRIVATE' ? 'Giữ riêng' : 'Đang chờ xử lý'}</span>
                        )}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <Button
                          className="sm"
                          onClick={() => {
                            setError('');
                            setReview({ ...f });
                            setInternalResolution(f.resolution || '');
                            setSelectedTemplate(compensationTemplates[0]?.code || 'APOLOGY_50K');
                            setCustomCompensation(CUSTOM_DEFAULT);
                          }}
                          style={isLow && f.handlingStatus !== 'RESOLVED' ? { background: '#d97706', color: '#fff' } : undefined}
                        >
                          {isLow && f.handlingStatus !== 'RESOLVED' ? 'Xử lý ngay' : 'Xem & trả lời'}
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </Table>
            </Panel>
          )}
        </>
      )}

      {/* Modal Review & Service Recovery */}
      {review && (
        <Modal
          title={review.rating <= 3 ? 'Quy trình Service Recovery – Xử lý đánh giá thấp' : 'Xem & phản hồi ý kiến khách hàng'}
          wide
          onClose={() => !busy && setReview(null)}
        >
          {review.rating <= 3 && (
            <div style={{ background: '#fef3c7', border: '1px solid #fde68a', borderRadius: 8, padding: '10px 14px', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ color: '#92400e', fontWeight: 700, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <AlertTriangle size={16} /> Ca đánh giá thấp ({review.rating} sao) – Hạn phản hồi: {review.dueAt ? new Date(review.dueAt).toLocaleString('vi-VN') : '24h'}
                </span>
                <span style={{ fontSize: 12, color: '#78350f' }}>
                  {review.assignedTo ? `Đã nhận bởi: ${review.assignedTo}` : 'Chưa có người nhận'}
                </span>
              </div>
            </div>
          )}

          {/* Context details */}
          <div style={{ background: '#f8fafc', padding: '12px 16px', borderRadius: 8, border: '1px solid #e2e8f0', marginBottom: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, fontSize: 13 }}>
              <div>
                <span style={{ color: '#64748b' }}>Khách hàng:</span> <b>{review.displayName}</b>
              </div>
              <div>
                <span style={{ color: '#64748b' }}>Đánh giá:</span> <Stars rating={review.rating} /> ({TOPIC_LABELS[review.topic] || review.topic || 'Dịch vụ'})
              </div>
              <div>
                <span style={{ color: '#64748b' }}>Đơn liên quan:</span> {review.orderId ? <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>CT-{review.orderId.slice(0, 8).toUpperCase()}</span> : 'Góp ý chung'}
              </div>
              <div>
                <span style={{ color: '#64748b' }}>Sân & ngày chơi:</span> {review.courtNames ? `${review.courtNames} (${review.visitDate || '—'})` : '—'}
              </div>
            </div>
            <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid #e2e8f0', fontSize: 14, color: '#0f172a' }}>
              <b>Nội dung khách viết:</b> <span style={{ fontStyle: 'italic' }}>"{review.message}"</span>
            </div>
          </div>

          {/* Service recovery actions */}
          {review.rating <= 3 && (
            <div style={{ border: '1px solid #cbd5e1', borderRadius: 8, padding: 16, marginBottom: 16, background: '#fafaf9' }}>
              <div style={{ fontWeight: 700, fontSize: 14, color: '#1e293b', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Sparkles size={18} color="#d97706" /> Bồi thường & Xử lý sự vụ (Service Recovery)
              </div>

              {/* Assign and Root Cause */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#334155', marginBottom: 4 }}>Người phụ trách</label>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <input
                      type="text"
                      readOnly
                      value={review.assignedTo || 'Chưa nhận'}
                      style={{ flex: 1, padding: '6px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 13, background: '#fff' }}
                    />
                    {!review.assignedTo && (
                      <Button onClick={() => handleAssign(review.id)} style={{ fontSize: 12, padding: '6px 12px' }}>
                        Nhận xử lý
                      </Button>
                    )}
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#334155', marginBottom: 4 }}>Phân loại nguyên nhân</label>
                  <select
                    value={rootCause}
                    onChange={e => setRootCause(e.target.value)}
                    style={{ width: '100%', padding: '6px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 13 }}
                  >
                    <option value="Mặt sân">Mặt sân</option>
                    <option value="Đèn">Đèn chiếu sáng</option>
                    <option value="Trọng tài">Trọng tài</option>
                    <option value="Lễ tân">Lễ tân & Phục vụ</option>
                    <option value="Thanh toán">Thanh toán & Cọc</option>
                    <option value="Website">Website / Đặt sân</option>
                    <option value="Khác">Khác</option>
                  </select>
                </div>
              </div>

              {/* Compensation Voucher Section */}
              <div style={{ marginTop: 12, background: '#fff', padding: 12, borderRadius: 6, border: '1px solid #e2e8f0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#0f172a' }}>Tặng voucher xin lỗi khách hàng:</span>
                  {(review.compensationVoucherCode || review.compensationVoucherId) ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ background: '#ecfdf5', color: '#065f46', padding: '3px 8px', borderRadius: 4, fontSize: 12, fontWeight: 700 }}>
                        Đã tặng {review.compensationVoucherCode || review.compensationVoucherId}
                      </span>
                      {isAdmin && (
                        <button
                          type="button"
                          onClick={async () => {
                            const reason = window.prompt('Nhập lý do thu hồi voucher bồi thường (tối thiểu 5 ký tự):');
                            if (!reason || reason.trim().length < 5) {
                              if (reason !== null) notify('Lý do thu hồi phải có ít nhất 5 ký tự');
                              return;
                            }
                            try {
                              await api(`/content/feedback/${review.id}/revoke-compensation`, 'POST', { reason: reason.trim() });
                              notify('Đã thu hồi voucher bồi thường thành công!');
                              setReview(prev => ({
                                ...prev,
                                compensationVoucherId: null,
                                compensationVoucherCode: null
                              }));
                              load();
                            } catch (e) {
                              notify('Lỗi thu hồi: ' + e.message);
                            }
                          }}
                          style={{
                            background: '#fee2e2',
                            color: '#991b1b',
                            border: '1px solid #f87171',
                            borderRadius: 4,
                            padding: '3px 8px',
                            fontSize: 11.5,
                            fontWeight: 700,
                            cursor: 'pointer'
                          }}
                        >
                          Thu hồi
                        </button>
                      )}
                    </div>
                  ) : null}
                </div>

                {!(review.compensationVoucherCode || review.compensationVoucherId) ? (
                  <div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
                      {compensationTemplates.map(t => {
                        const isSelected = (selectedTemplate || compensationTemplates[0]?.code) === (t.code || t.id);
                        return (
                          <button
                            key={t.code || t.id}
                            type="button"
                            onClick={() => setSelectedTemplate(t.code || t.id)}
                            style={{
                              padding: '6px 12px',
                              borderRadius: 6,
                              fontSize: 12,
                              fontWeight: 600,
                              border: '1px solid',
                              borderColor: isSelected ? '#059669' : '#cbd5e1',
                              background: isSelected ? '#ecfdf5' : '#fff',
                              color: isSelected ? '#065f46' : '#334155',
                              cursor: 'pointer'
                            }}
                          >
                            {t.title}
                          </button>
                        );
                      })}
                      {isAdmin && (
                        <button
                          type="button"
                          onClick={() => setSelectedTemplate('CUSTOM')}
                          style={{
                            padding: '6px 12px',
                            borderRadius: 6,
                            fontSize: 12,
                            fontWeight: 600,
                            border: '1px dashed',
                            borderColor: selectedTemplate === 'CUSTOM' ? '#059669' : '#94a3b8',
                            background: selectedTemplate === 'CUSTOM' ? '#ecfdf5' : '#fff',
                            color: selectedTemplate === 'CUSTOM' ? '#065f46' : '#334155',
                            cursor: 'pointer'
                          }}
                        >
                          ✏️ Tuỳ chỉnh (Manager)
                        </button>
                      )}
                    </div>
                    {selectedTemplate === 'CUSTOM' && isAdmin ? (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 8, marginBottom: 10, fontSize: 12 }}>
                        <label style={{ display: 'grid', gap: 3 }}>
                          Loại giảm
                          <select value={customCompensation.type} onChange={e => setCustom('type', e.target.value)} style={{ padding: '5px 8px', borderRadius: 6, border: '1px solid #cbd5e1' }}>
                            <option value="FIXED">Số tiền (₫)</option>
                            <option value="PERCENT">Phần trăm (%)</option>
                          </select>
                        </label>
                        <label style={{ display: 'grid', gap: 3 }}>
                          {customCompensation.type === 'PERCENT' ? 'Mức giảm (%)' : 'Mức giảm (₫)'}
                          <input type="number" min="1" max={customCompensation.type === 'PERCENT' ? 100 : undefined} value={customCompensation.value} onChange={e => setCustom('value', e.target.value)} style={{ padding: '5px 8px', borderRadius: 6, border: '1px solid #cbd5e1' }} />
                        </label>
                        {customCompensation.type === 'PERCENT' && (
                          <label style={{ display: 'grid', gap: 3 }}>
                            Giảm tối đa (₫)
                            <input type="number" min="1" value={customCompensation.maxDiscount} onChange={e => setCustom('maxDiscount', e.target.value)} style={{ padding: '5px 8px', borderRadius: 6, border: '1px solid #cbd5e1' }} />
                          </label>
                        )}
                        <label style={{ display: 'grid', gap: 3 }}>
                          Đơn tối thiểu (₫)
                          <input type="number" min="0" value={customCompensation.minOrder} onChange={e => setCustom('minOrder', e.target.value)} style={{ padding: '5px 8px', borderRadius: 6, border: '1px solid #cbd5e1' }} />
                        </label>
                        <label style={{ display: 'grid', gap: 3 }}>
                          Hiệu lực (ngày)
                          <input type="number" min="1" max="365" value={customCompensation.days} onChange={e => setCustom('days', e.target.value)} style={{ padding: '5px 8px', borderRadius: 6, border: '1px solid #cbd5e1' }} />
                        </label>
                        <label style={{ display: 'grid', gap: 3, gridColumn: '1 / -1' }}>
                          Lý do tặng (bắt buộc, ≥ 10 ký tự — ghi vào nhật ký)
                          <input type="text" value={customCompensation.reason} placeholder="VD: Đèn sân tắt giữa trận, khách phải dừng 20 phút" onChange={e => setCustom('reason', e.target.value)} style={{ padding: '5px 8px', borderRadius: 6, border: '1px solid #cbd5e1' }} />
                        </label>
                        <div style={{ gridColumn: '1 / -1', color: '#64748b' }}>Xem trước: {customSummary(customCompensation)}.</div>
                      </div>
                    ) : (
                      <div style={{ fontSize: 12, color: '#64748b', marginBottom: 10 }}>
                        Mô tả: {compensationTemplates.find(t => (t.code || t.id) === (selectedTemplate || compensationTemplates[0]?.code))?.description || compensationTemplates.find(t => (t.code || t.id) === (selectedTemplate || compensationTemplates[0]?.code))?.desc || ''}
                      </div>
                    )}
                    <Button
                      onClick={() => handleCompensate(review.id)}
                      style={{ background: '#059669', color: '#fff', fontSize: 12, padding: '6px 14px' }}
                    >
                      <Gift size={14} /> 🎁 Tặng voucher
                    </Button>
                  </div>
                ) : (
                  <div style={{ fontSize: 12, color: '#64748b' }}>
                    Khách hàng đã nhận được mã bồi thường qua Email/thông báo và mục "Ưu đãi của tôi".
                  </div>
                )}
              </div>

              {/* Internal resolution note */}
              <div style={{ marginTop: 12 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#334155', marginBottom: 4 }}>Ghi chú nội bộ / Biện pháp khắc phục</label>
                <input
                  type="text"
                  placeholder="VD: Đã cho thợ kỹ thuật kiểm tra lại giàn đèn sân B04..."
                  value={internalResolution}
                  onChange={e => setInternalResolution(e.target.value)}
                  style={{ width: '100%', padding: '6px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 13 }}
                />
              </div>
            </div>
          )}

          {/* Customer Reply form */}
          <form
            onSubmit={e => {
              e.preventDefault();
              if (review.rating <= 3) {
                handleResolve(review.id, 'RESOLVED');
              } else {
                save(
                  '/content/feedback/' + review.id,
                  'PATCH',
                  { status: review.status, reply: review.reply },
                  () => setReview(null)
                );
              }
            }}
          >
            {review.rating > 3 && isAdmin && (
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
            )}

            <div className="field">
              <label htmlFor="review-reply">Phản hồi gửi đến khách hàng (gửi qua Email/thông báo)</label>
              <textarea
                id="review-reply"
                rows={3}
                maxLength={2000}
                placeholder="Nhập nội dung xin lỗi và giải thích chân thành..."
                value={review.reply || ''}
                onChange={e => setReview(f => ({ ...f, reply: e.target.value }))}
              />
            </div>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 16 }}>
              <button
                type="button"
                className="btn secondary"
                disabled={busy}
                onClick={() => setReview(null)}
              >
                Đóng
              </button>

              {review.rating <= 3 && (
                <button
                  type="button"
                  className="btn secondary"
                  style={{ color: '#64748b' }}
                  onClick={() => handleResolve(review.id, 'NO_ACTION')}
                >
                  Đóng ca (Không bù)
                </button>
              )}

              <button className="btn primary" disabled={busy}>
                {review.rating <= 3 ? 'Hoàn tất & Đóng ca xử lý' : busy ? 'Đang lưu…' : 'Lưu phản hồi'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Editor Modal for Articles */}
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
                value={editor.title}
                onChange={e => setEditor(a => ({ ...a, title: e.target.value }))}
              />
            </div>
            <div className="field">
              <label htmlFor="article-excerpt">Đoạn tóm tắt ngắn</label>
              <textarea
                id="article-excerpt"
                rows={2}
                maxLength={400}
                value={editor.excerpt}
                onChange={e => setEditor(a => ({ ...a, excerpt: e.target.value }))}
              />
            </div>
            <div className="field">
              <label htmlFor="article-body">Nội dung chi tiết</label>
              <textarea
                id="article-body"
                rows={6}
                maxLength={12000}
                value={editor.body}
                onChange={e => setEditor(a => ({ ...a, body: e.target.value }))}
              />
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 16 }}>
              <button type="button" className="btn secondary" onClick={() => setEditor(null)}>Hủy</button>
              <button type="submit" className="btn primary" disabled={busy}>Lưu bài viết</button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
