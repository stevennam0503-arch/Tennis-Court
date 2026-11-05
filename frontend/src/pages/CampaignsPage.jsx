import React, { useState, useEffect, useMemo } from 'react';

import { 

  Megaphone, Plus, Clock, CheckCircle2, AlertCircle, Play, Pause, 

  Square, BarChart2, ShieldCheck, Mail, MessageSquare, Image, Sparkles

} from 'lucide-react';

import { useCourtly } from '../context';

import { api } from '../services/api';

import { Title, Button, Modal, Chip } from '../components/UI';

import { money } from '../utils/format';



const STATUS_META = {

  DRAFT: { label: 'Bản nháp', bg: '#f1f5f9', color: '#475569' },

  PENDING_APPROVAL: { label: 'Chờ duyệt', bg: '#fef3c7', color: '#b45309' },

  SCHEDULED: { label: 'Đã lên lịch', bg: '#e0f2fe', color: '#0369a1' },

  RUNNING: { label: 'Đang chạy', bg: '#dcfce7', color: '#15803d' },

  PAUSED: { label: 'Tạm dừng', bg: '#fef3c7', color: '#b45309' },

  ENDED: { label: 'Đã kết thúc', bg: '#f1f5f9', color: '#64748b' },

  CANCELLED: { label: 'Đã hủy', bg: '#fee2e2', color: '#991b1b' }

};



export default function CampaignsPage() {

  const { user, isAdmin, isStaff, notify } = useCourtly();

  const [campaigns, setCampaigns] = useState([]);

  const [loading, setLoading] = useState(true);

  const [statusFilter, setStatusFilter] = useState('ALL');



  // Modal states

  const [showCreateModal, setShowCreateModal] = useState(false);

  const [selectedStatsCampaign, setSelectedStatsCampaign] = useState(null);

  const [statsData, setStatsData] = useState(null);

  const [statsLoading, setStatsLoading] = useState(false);



  // Form state

  const emptyForm = () => ({
    name: '',
    description: '',
    audience: 'ALL',
    channels: 'EMAIL,BANNER',
    messageTitle: '',
    messageBody: '',
    bannerText: '',
    budgetLimit: 5000000,
    startsAt: '',
    endsAt: '',
    voucherId: '',
    news: { enabled: true, title: '', excerpt: '', body: '' }
  });
  const [formData, setFormData] = useState(emptyForm);
  const [newsTouched, setNewsTouched] = useState(false);
  const [templates, setTemplates] = useState([]);
  const [showTemplates, setShowTemplates] = useState(false);

  // Tin tức đăng kèm: tự lấy từ tiêu đề/nội dung thông báo cho tới khi người dùng tự sửa
  const setField = (key, value) => setFormData(prev => {
    const next = { ...prev, [key]: value };
    if (!newsTouched && ['messageTitle', 'messageBody', 'bannerText'].includes(key)) {
      next.news = { ...prev.news, title: next.messageTitle, excerpt: next.bannerText || next.messageTitle, body: next.messageBody };
    }
    return next;
  });
  const setNews = (key, value) => { setNewsTouched(true); setFormData(prev => ({ ...prev, news: { ...prev.news, [key]: value } })); };
  const newsRequired = formData.audience === 'ALL';

  const openTemplates = async () => {
    setShowTemplates(true);
    if (templates.length === 0) {
      try { setTemplates(await api('/admin/campaigns/templates')); } catch (err) { notify(err.message); }
    }
  };
  const applyTemplate = tpl => {
    const voucher = voucherOptions.find(v => v.code === tpl.suggestedVoucher);
    setFormData({
      ...emptyForm(),
      name: tpl.name, description: tpl.description, audience: tpl.audience, audienceFilter: tpl.audienceFilter || '',
      channels: tpl.channels, messageTitle: tpl.messageTitle, messageBody: tpl.messageBody, bannerText: tpl.bannerText,
      startsAt: tpl.startsAt, endsAt: tpl.endsAt, voucherId: voucher ? voucher.id : '',
      news: { ...tpl.news }
    });
    setNewsTouched(true);
    setShowTemplates(false);
    setShowCreateModal(true);
  };
  const openBlank = () => { setFormData(emptyForm()); setNewsTouched(false); setShowCreateModal(true); };

  const [submitting, setSubmitting] = useState(false);

  const [voucherOptions, setVoucherOptions] = useState([]);



  const fetchCampaigns = async () => {

    try {

      setLoading(true);

      const data = await api('/admin/campaigns');

      if (data) setCampaigns(data);

      api('/admin/vouchers').then(v => {
        if (Array.isArray(v)) {
          const now = new Date();
          const filtered = v.filter(x => 
            x.status === 'ACTIVE' &&
            !x.assignedAccountId &&
            !x.assignedAccount &&
            (x.usageLimit == null || (x.usageLimit - (x.usedCount || 0)) > 0) &&
            (!x.expiresAt || new Date(x.expiresAt) > now)
          );
          setVoucherOptions(filtered);
        }
      }).catch(() => {});

    } catch (err) {

      console.error('Lỗi tải danh sách chiến dịch:', err);

    } finally {

      setLoading(false);

    }

  };



  useEffect(() => {

    fetchCampaigns();

  }, []);



  const handleCreateSubmit = async (e, directRun = false) => {

    e.preventDefault();

    if (!formData.name.trim()) {

      alert('Vui lòng nhập tên chiến dịch');

      return;

    }
    if (formData.audience === 'TIER' && (!formData.audienceFilter || !formData.audienceFilter.trim())) {
      alert('Vui lòng chọn ít nhất một hạng thành viên áp dụng');
      return;
    }
    if (formData.startsAt && formData.endsAt && formData.endsAt <= formData.startsAt) {
      notify('Thời gian kết thúc phải sau thời gian bắt đầu');
      return;
    }
    const news = formData.news || {};
    const newsOn = newsRequired || news.enabled;
    if (newsOn && (!news.title?.trim() || !news.excerpt?.trim() || !news.body?.trim())) {
      notify('Chiến dịch cho tất cả khách cần tin tức đăng kèm: điền đủ tiêu đề, tóm tắt và nội dung tin');
      return;
    }



    try {

      setSubmitting(true);

      const payload = {
        ...formData,
        news: { ...news, enabled: newsOn },
        status: directRun && isAdmin ? 'RUNNING' : 'DRAFT'
      };

      await api('/admin/campaigns', 'POST', payload);

      notify(`Đã tạo chiến dịch "${formData.name}" thành công`);

      setShowCreateModal(false);
      setFormData(emptyForm());
      setNewsTouched(false);

      fetchCampaigns();

    } catch (err) {

      notify(err.message);

    } finally {

      setSubmitting(false);

    }

  };



  const handleSubmitForApproval = async (id) => {

    try {

      await api(`/admin/campaigns/${id}/submit`, 'POST');

      notify('Đã gửi chiến dịch cho Manager duyệt');

      fetchCampaigns();

    } catch (err) {

      notify(err.message);

    }

  };



  const handleApproveAndRun = async (id) => {

    try {

      await api(`/admin/campaigns/${id}/approve`, 'POST');

      notify('Đã phê duyệt và khởi chạy chiến dịch!');

      fetchCampaigns();

    } catch (err) {

      notify(err.message);

    }

  };



  const handlePause = async (id) => {

    try {

      await api(`/admin/campaigns/${id}/pause`, 'POST');

      notify('Đã tạm dừng chiến dịch');

      fetchCampaigns();

    } catch (err) {

      notify(err.message);

    }

  };



  const handleEnd = async (id) => {

    if (!confirm('Bạn có chắc muốn kết thúc chiến dịch này? Các voucher liên quan sẽ tự động ngừng áp dụng.')) {

      return;

    }

    try {

      await api(`/admin/campaigns/${id}/end`, 'POST');

      notify('Đã kết thúc chiến dịch');

      fetchCampaigns();

    } catch (err) {

      notify(err.message);

    }

  };



  const openStatsModal = async (campaign) => {

    setSelectedStatsCampaign(campaign);

    setStatsData(null);

    setStatsLoading(true);

    try {

      const data = await api(`/admin/campaigns/${campaign.id}/stats`);

      if (data) setStatsData(data);

    } catch (err) {

      console.error('Lỗi tải thống kê chiến dịch:', err);

    } finally {

      setStatsLoading(false);

    }

  };



  const filteredCampaigns = useMemo(() => {

    return campaigns.filter(c => {

      if (statusFilter !== 'ALL' && c.status !== statusFilter) return false;

      return true;

    });

  }, [campaigns, statusFilter]);



  return (

    <div className="page campaigns-page" style={{ padding: '24px 28px', maxWidth: 1240, margin: '0 auto' }}>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>

        <div>

          <Title>Chiến dịch Khuyến mãi</Title>

          <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: 13.5 }}>

            Truyền thông quảng bá đa kênh (Email, Banner), giới hạn ngân sách và đo lường hiệu quả chuyển đổi

          </p>

        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Button onClick={openTemplates}>🗓️ Tạo từ mẫu theo mùa</Button>
          <Button className="primary" onClick={openBlank}>
            <Plus size={16} style={{ display: 'inline', marginRight: 6 }} /> Tạo chiến dịch mới
          </Button>
        </div>

      </div>



      {/* COMPLIANCE NOTE */}

      <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10, padding: '12px 16px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 10, color: '#166534', fontSize: 13 }}>

        <ShieldCheck size={20} style={{ flexShrink: 0 }} />

        <div>

          <b>Tuân thủ Nghị định 13/2023 & Nghị định 91/2020:</b> Hệ thống tự động chỉ gửi tin cho khách hàng đã đồng ý (marketing consent) và mỗi tin luôn đính kèm liên kết hủy nhận tin. Chiến dịch có ngày bắt đầu trong tương lai sẽ được lên lịch và tự chạy đúng giờ; hết hạn thì tự kết thúc và gỡ tin tức kèm theo.

        </div>

      </div>



      {/* STATUS TABS */}

      <div style={{ display: 'flex', gap: 8, borderBottom: '1px solid #e2e8f0', marginBottom: 20, overflowX: 'auto' }}>

        {['ALL', 'RUNNING', 'SCHEDULED', 'PENDING_APPROVAL', 'DRAFT', 'ENDED'].map(st => {

          const count = st === 'ALL' ? campaigns.length : campaigns.filter(c => c.status === st).length;

          const labels = {

            ALL: 'Tất cả',

            RUNNING: 'Đang chạy',
            SCHEDULED: 'Đã lên lịch',
            PENDING_APPROVAL: 'Chờ duyệt',

            DRAFT: 'Bản nháp',

            ENDED: 'Đã kết thúc'

          };

          return (

            <button

              key={st}

              type="button"

              onClick={() => setStatusFilter(st)}

              style={{

                padding: '9px 16px',

                fontSize: 13.5,

                fontWeight: statusFilter === st ? 700 : 500,

                color: statusFilter === st ? '#0f172a' : '#64748b',

                borderBottom: statusFilter === st ? '2.5px solid #0f172a' : '2.5px solid transparent',

                background: 'none',

                border: 'none',

                cursor: 'pointer',

                whiteSpace: 'nowrap'

              }}

            >

              {labels[st]} ({count})

            </button>

          );

        })}

      </div>



      {/* CAMPAIGNS TABLE */}

      <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', overflow: 'hidden' }}>

        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5, textAlign: 'left' }}>

          <thead>

            <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#64748b', fontSize: 12, textTransform: 'uppercase' }}>

              <th style={{ padding: '12px 16px' }}>Chiến dịch</th>

              <th style={{ padding: '12px 16px' }}>Kênh truyền thông</th>

              <th style={{ padding: '12px 16px' }}>Nhóm khách nhận</th>

              <th style={{ padding: '12px 16px' }}>Ngân sách trần</th>

              <th style={{ padding: '12px 16px' }}>Trạng thái</th>

              <th style={{ padding: '12px 16px', textAlign: 'right' }}>Thao tác</th>

            </tr>

          </thead>

          <tbody>

            {filteredCampaigns.length === 0 ? (

              <tr>

                <td colSpan={6} style={{ padding: 36, textAlign: 'center', color: '#94a3b8' }}>

                  Chưa có chiến dịch nào trong mục này.

                </td>

              </tr>

            ) : (

              filteredCampaigns.map(c => {

                const meta = STATUS_META[c.status] || STATUS_META.DRAFT;

                return (

                  <tr key={c.id} style={{ borderBottom: '1px solid #f1f5f9' }}>

                    <td style={{ padding: '12px 16px' }}>

                      <div style={{ fontWeight: 700, color: '#1e293b', fontSize: 14 }}>{c.name}</div>

                      {c.description && <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>{c.description}</div>}

                    </td>

                    <td style={{ padding: '12px 16px' }}>

                      <div style={{ display: 'flex', gap: 6 }}>

                        {(c.channels || 'EMAIL,BANNER').split(',').map(ch => (

                          <span key={ch} style={{ fontSize: 11, background: '#f1f5f9', color: '#475569', padding: '2px 6px', borderRadius: 4, fontWeight: 600 }}>

                            {ch}

                          </span>

                        ))}

                      </div>

                    </td>

                    <td style={{ padding: '12px 16px', color: '#334155', fontWeight: 500 }}>

                      {c.audience === 'ALL' ? 'Tất cả khách hàng' : c.audience === 'NEW_CUSTOMERS' ? 'Khách mới (0 đơn)' : c.audience === 'INACTIVE_30D' ? 'Khách chưa chơi 30 ngày' : c.audience === 'NEAR_NEXT_TIER' ? 'Sắp lên hạng (≤ 20%)' : c.audience === 'TIER' ? `Hạng: ${(c.audienceFilter || '').split(',').filter(Boolean).map(x => ({ ROOKIE: 'Rookie', CHALLENGER: 'Challenger', MASTERS: 'Masters', GRAND_SLAM: 'Grand Slam' })[x.trim()] || x.trim()).join(', ') || 'Tất cả'}` : c.audience === 'CUSTOM_LIST' ? `Tự chọn (${c.audienceFilter ? c.audienceFilter.split(',').length : 0} người)` : c.audience}

                    </td>

                    <td style={{ padding: '12px 16px', fontWeight: 600, color: '#0f172a' }}>

                      {c.budgetLimit ? money(c.budgetLimit) : 'Không giới hạn'}

                    </td>

                    <td style={{ padding: '12px 16px' }}>

                      <span style={{ 

                        padding: '3px 8px', 

                        borderRadius: 12, 

                        fontSize: 11.5, 

                        fontWeight: 700, 

                        background: meta.bg, 

                        color: meta.color 

                      }}>

                        {meta.label}
                      </span>
                      {(c.startsAt || c.endsAt) && (
                        <div style={{ fontSize: 11.5, color: '#64748b', marginTop: 4, minWidth: 150 }}>
                          {c.status === 'SCHEDULED' ? 'Chạy lúc ' : ''}{c.startsAt ? new Date(c.startsAt).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' }) : '…'}
                          {' → '}{c.endsAt ? new Date(c.endsAt).toLocaleDateString('vi-VN') : 'không giới hạn'}
                        </div>
                      )}
                      {c.news && (
                        <div style={{ fontSize: 11.5, marginTop: 3, color: c.news.status === 'PUBLISHED' ? '#15803d' : '#64748b' }}>
                          📰 {c.news.status === 'PUBLISHED' ? 'Tin tức đang hiển thị' : 'Tin tức đăng khi chiến dịch chạy'}
                        </div>
                      )}
                    </td>

                    <td style={{ padding: '12px 16px', textAlign: 'right' }}>

                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6 }}>

                        <button

                          type="button"

                          onClick={() => openStatsModal(c)}

                          title="Xem thống kê hiệu quả"

                          style={{

                            padding: '4px 8px',

                            borderRadius: 6,

                            border: '1px solid #cbd5e1',

                            background: '#fff',

                            color: '#0f172a',

                            fontSize: 12,

                            fontWeight: 600,

                            cursor: 'pointer',

                            display: 'inline-flex',

                            alignItems: 'center',

                            gap: 4

                          }}

                        >

                          <BarChart2 size={13} /> Hiệu quả

                        </button>



                        {/* STAFF ACTIONS */}

                        {c.status === 'DRAFT' && isStaff && (

                          <button

                            type="button"

                            onClick={() => handleSubmitForApproval(c.id)}

                            style={{

                              padding: '4px 8px',

                              borderRadius: 6,

                              border: '1px solid #f59e0b',

                              background: '#fef3c7',

                              color: '#b45309',

                              fontSize: 12,

                              fontWeight: 700,

                              cursor: 'pointer'

                            }}

                          >

                            Gửi duyệt

                          </button>

                        )}



                        {/* ADMIN ACTIONS */}

                        {isAdmin && (c.status === 'PENDING_APPROVAL' || c.status === 'DRAFT' || c.status === 'PAUSED') && (

                          <button

                            type="button"

                            onClick={() => handleApproveAndRun(c.id)}

                            style={{

                              padding: '4px 8px',

                              borderRadius: 6,

                              border: '1px solid #22c55e',

                              background: '#f0fdf4',

                              color: '#16a34a',

                              fontSize: 12,

                              fontWeight: 700,

                              cursor: 'pointer',

                              display: 'inline-flex',

                              alignItems: 'center',

                              gap: 4

                            }}

                          >

                            <Play size={12} fill="#16a34a" /> {c.status === 'PAUSED' ? 'Tiếp tục' : 'Duyệt & Chạy'}

                          </button>

                        )}



                        {isAdmin && c.status === 'RUNNING' && (

                          <button

                            type="button"

                            onClick={() => handlePause(c.id)}

                            style={{

                              padding: '4px 8px',

                              borderRadius: 6,

                              border: '1px solid #f59e0b',

                              background: '#fff',

                              color: '#b45309',

                              fontSize: 12,

                              fontWeight: 600,

                              cursor: 'pointer',

                              display: 'inline-flex',

                              alignItems: 'center',

                              gap: 4

                            }}

                          >

                            <Pause size={12} /> Tạm dừng

                          </button>

                        )}



                        {isAdmin && (c.status === 'RUNNING' || c.status === 'PAUSED') && (

                          <button

                            type="button"

                            onClick={() => handleEnd(c.id)}

                            style={{

                              padding: '4px 8px',

                              borderRadius: 6,

                              border: '1px solid #ef4444',

                              background: '#fff',

                              color: '#dc2626',

                              fontSize: 12,

                              fontWeight: 600,

                              cursor: 'pointer'

                            }}

                          >

                            Kết thúc

                          </button>

                        )}

                      </div>

                    </td>

                  </tr>

                );

              })

            )}

          </tbody>

        </table>

      </div>



      {/* CREATE CAMPAIGN MODAL */}

      {showTemplates && (
        <Modal onClose={() => setShowTemplates(false)}>
          <div style={{ minWidth: 460, maxWidth: 620, padding: 8 }}>
            <h3 style={{ margin: '0 0 6px', fontSize: 17, fontWeight: 800 }}>Mẫu chiến dịch theo mùa</h3>
            <p style={{ margin: '0 0 14px', fontSize: 13, color: '#64748b' }}>
              Ngày được tính sẵn cho lần diễn ra tiếp theo. Chọn mẫu để mở form đã điền sẵn nội dung, voucher gợi ý và tin tức; kiểm tra lại rồi lưu và gửi duyệt.
            </p>
            {templates.length === 0 ? <p style={{ fontSize: 13 }}>Đang tải mẫu…</p> : (
              <div style={{ display: 'grid', gap: 10 }}>
                {templates.map(tpl => (
                  <button key={tpl.key} type="button" onClick={() => applyTemplate(tpl)}
                    style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: 12, alignItems: 'center', textAlign: 'left', padding: '12px 14px', borderRadius: 10, border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer' }}>
                    <span style={{ fontSize: 26 }}>{tpl.icon}</span>
                    <span style={{ display: 'grid', gap: 2, minWidth: 0 }}>
                      <b style={{ fontSize: 14, color: '#0f172a' }}>{tpl.name}</b>
                      <span style={{ fontSize: 12, color: '#64748b' }}>
                        {new Date(tpl.startsAt).toLocaleDateString('vi-VN')} → {new Date(tpl.endsAt).toLocaleDateString('vi-VN')}
                        {' · '}{tpl.audience === 'ALL' ? 'Tất cả khách' : 'Hạng Masters & Grand Slam'}
                        {tpl.suggestedVoucher ? ` · gợi ý mã ${tpl.suggestedVoucher}` : ''}
                        {tpl.news?.enabled ? ' · có tin tức' : ''}
                      </span>
                    </span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: '#0369a1' }}>Dùng mẫu →</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </Modal>
      )}
      {showCreateModal && (

        <Modal onClose={() => setShowCreateModal(false)}>

          <form onSubmit={e => handleCreateSubmit(e, false)} style={{ minWidth: 460, maxWidth: 540, padding: 8 }}>

            <h3 style={{ margin: '0 0 16px', fontSize: 17, fontWeight: 800 }}>{formData.description?.startsWith('Tạo từ mẫu') ? 'Chiến dịch từ mẫu: kiểm tra rồi lưu' : 'Tạo chiến dịch truyền thông mới'}</h3>



            <div style={{ marginBottom: 12 }}>

              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Tên chiến dịch <span style={{ color: '#dc2626' }}>*</span>:</label>

              <input

                type="text"

                required

                placeholder="VD: Tri ân mùa hè rực rỡ, Khởi động giải Tennis mở rộng..."

                value={formData.name}

                onChange={e => setFormData({ ...formData, name: e.target.value })}

                style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 13.5 }}

              />

            </div>



            <div style={{ marginBottom: 12 }}>

              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Mục tiêu & Mô tả:</label>

              <textarea

                rows={2}

                placeholder="Mục đích chiến dịch, KPI mong muốn..."

                value={formData.description}

                onChange={e => setFormData({ ...formData, description: e.target.value })}

                style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 13 }}

              />

            </div>



            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>

              <div>

                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Nhóm đối tượng nhận:</label>

                <select

                  value={formData.audience}

                  onChange={e => setFormData({ ...formData, audience: e.target.value })}

                  style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 13 }}

                >

                  <option value="ALL">Tất cả khách hàng (đã đồng ý nhận tin)</option>

                  <option value="NEAR_NEXT_TIER">Sắp lên hạng (thiếu ≤ 20% chi tiêu)</option>

                  <option value="CUSTOM_LIST">Danh sách tự chọn (SĐT / Email)</option>

                  <option value="NEW_CUSTOMERS">Khách hàng mới (chưa có đơn)</option>

                  <option value="INACTIVE_30D">Khách không hoạt động 30 ngày</option>

                  <option value="TIER">Theo hạng thành viên</option>

                </select>

              </div>



              <div>

                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Ngân sách trần (VNĐ):</label>

                <input

                  type="number"

                  step={500000}

                  value={formData.budgetLimit}

                  onChange={e => setFormData({ ...formData, budgetLimit: e.target.value })}

                  style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 13 }}

                />

              </div>

            </div>



                        {formData.audience === 'TIER' && (
              <div style={{ marginBottom: 12 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 4 }}>
                  Chọn các hạng thành viên áp dụng <span style={{ color: '#dc2626' }}>*</span>:
                </label>
                <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', padding: '6px 0' }}>
                  {[
                    { id: 'ROOKIE', label: 'Rookie' },
                    { id: 'CHALLENGER', label: 'Challenger' },
                    { id: 'MASTERS', label: 'Masters' },
                    { id: 'GRAND_SLAM', label: 'Grand Slam' }
                  ].map(t => {
                    const selectedTiers = (formData.audienceFilter || '').split(',').map(s => s.trim()).filter(Boolean);
                    const checked = selectedTiers.includes(t.id);
                    return (
                      <label key={t.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => {
                            let next = checked ? selectedTiers.filter(x => x !== t.id) : [...selectedTiers, t.id];
                            setFormData({ ...formData, audienceFilter: next.join(',') });
                          }}
                        />
                        {t.label}
                      </label>
                    );
                  })}
                </div>
              </div>
            )}

            {formData.audience === 'CUSTOM_LIST' && (

              <div style={{ marginBottom: 12 }}>

                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 4 }}>

                  Danh sách SĐT / Email (cách nhau bởi dấu phẩy hoặc xuống dòng) <span style={{ color: '#dc2626' }}>*</span>:

                </label>

                <textarea

                  rows={3}

                  required

                  placeholder="0911000002, 0988666555, customer@gmail.com..."

                  value={formData.audienceFilter || ''}

                  onChange={e => setFormData({ ...formData, audienceFilter: e.target.value })}

                  style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 13 }}

                />

              </div>

            )}



            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
              <label style={{ display: 'grid', gap: 4, fontSize: 13, fontWeight: 600 }}>
                Bắt đầu
                <input type="datetime-local" value={formData.startsAt || ''} onChange={e => setFormData({ ...formData, startsAt: e.target.value })}
                  style={{ padding: '7px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 13 }} />
              </label>
              <label style={{ display: 'grid', gap: 4, fontSize: 13, fontWeight: 600 }}>
                Kết thúc
                <input type="datetime-local" value={formData.endsAt || ''} onChange={e => setFormData({ ...formData, endsAt: e.target.value })}
                  style={{ padding: '7px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 13 }} />
              </label>
              <small style={{ gridColumn: '1 / -1', color: '#64748b', fontSize: 12 }}>
                Để trống "Bắt đầu" thì chạy ngay khi duyệt. Ngày bắt đầu trong tương lai: duyệt xong chiến dịch được lên lịch và tự chạy đúng giờ.
              </small>
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Voucher đính kèm chiến dịch (tùy chọn):</label>

              <select

                value={formData.voucherId || ''}

                onChange={e => setFormData({ ...formData, voucherId: e.target.value })}

                style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 13 }}

              >

                <option value="">-- Không đính kèm voucher --</option>

                {voucherOptions.map(v => (

                  <option key={v.id} value={v.id}>

                    {v.code} · {v.type === 'PERCENT' ? `${v.value}%` : `${Number(v.value).toLocaleString('vi-VN')}₫`} (Còn {v.usageLimit ? v.usageLimit - (v.usedCount || 0) : '∞'} lượt)

                  </option>

                ))}

              </select>

            </div>



            <div style={{ marginBottom: 12 }}>

              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Kênh truyền thông:</label>

              <div style={{ display: 'flex', gap: 14 }}>

                {['EMAIL', 'BANNER'].map(ch => {

                  const checked = formData.channels.includes(ch);

                  return (

                    <label key={ch} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer' }}>

                      <input

                        type="checkbox"

                        checked={checked}

                        onChange={() => {

                          let arr = formData.channels.split(',').filter(Boolean);

                          if (checked) arr = arr.filter(x => x !== ch);

                          else arr.push(ch);

                          setFormData({ ...formData, channels: arr.join(',') });

                        }}

                      />

                      {ch}

                    </label>

                  );

                })}

              </div>

            </div>



            <div style={{ marginBottom: 12 }}>

              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Tiêu đề thông báo / Email:</label>

              <input

                type="text"

                placeholder="VD: [Courtly] Tặng bạn mã giảm 20% đặt sân cuối tuần này!"

                value={formData.messageTitle}

                onChange={e => setField('messageTitle', e.target.value)}

                style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 13 }}

              />

            </div>



            <div style={{ marginBottom: 12 }}>

              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Nội dung thông báo (Email):</label>

              <textarea

                rows={3}

                placeholder="Nội dung gửi tới khách hàng. Link hủy nhận tin sẽ được hệ thống tự động chèn ở cuối."

                value={formData.messageBody}

                onChange={e => setField('messageBody', e.target.value)}

                style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 13 }}

              />

            </div>



            <div style={{ marginBottom: 16 }}>

              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Nội dung Banner (hiện trên trang khách):</label>

              <input

                type="text"

                placeholder="VD: 🔥 Ưu đãi giờ vàng: Giảm ngay 25% các sân khu ngoài trời hôm nay!"

                value={formData.bannerText}

                onChange={e => setField('bannerText', e.target.value)}

                style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 13 }}

              />

            </div>



            <fieldset style={{ border: '1px solid #cfe3d6', background: '#f6fbf7', borderRadius: 10, padding: '12px 14px', margin: '0 0 16px' }}>
              <legend style={{ fontSize: 13, fontWeight: 700, padding: '0 6px', color: '#14532d' }}>📰 Tin tức đăng kèm trên trang Tin tức</legend>
              {newsRequired ? (
                <p style={{ margin: '0 0 10px', fontSize: 12.5, color: '#166534' }}>
                  Bắt buộc với chiến dịch gửi tới tất cả khách. Tin tự đăng khi chiến dịch bắt đầu chạy và tự gỡ khi kết thúc.
                </p>
              ) : (
                <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 12.5, marginBottom: 10, cursor: 'pointer' }}>
                  <input type="checkbox" checked={Boolean(formData.news?.enabled)} onChange={e => setNews('enabled', e.target.checked)} />
                  Đăng tin công khai (ưu đãi riêng cho một nhóm khách thường không cần đăng)
                </label>
              )}
              {(newsRequired || formData.news?.enabled) && (
                <div style={{ display: 'grid', gap: 8 }}>
                  <input type="text" maxLength={160} placeholder="Tiêu đề tin" value={formData.news?.title || ''} onChange={e => setNews('title', e.target.value)}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 13 }} />
                  <input type="text" maxLength={400} placeholder="Tóm tắt (hiện trên thẻ tin)" value={formData.news?.excerpt || ''} onChange={e => setNews('excerpt', e.target.value)}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 13 }} />
                  <textarea rows={4} maxLength={12000} placeholder="Nội dung bài tin: ưu đãi, thời gian, cách dùng mã…" value={formData.news?.body || ''} onChange={e => setNews('body', e.target.value)}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 13 }} />
                  {!newsTouched && <small style={{ color: '#64748b', fontSize: 11.5 }}>Đang tự điền từ tiêu đề, banner và nội dung thông báo. Sửa ở đây để viết riêng cho trang tin.</small>}
                </div>
              )}
            </fieldset>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <Button type="button" onClick={() => setShowCreateModal(false)} disabled={submitting}>

                Hủy

              </Button>

              <Button type="submit" disabled={submitting}>

                {submitting ? 'Đang lưu…' : 'Lưu bản nháp'}

              </Button>

              {isAdmin && (

                <Button type="button" className="primary" onClick={e => handleCreateSubmit(e, true)} disabled={submitting}>

                  Lưu & Chạy ngay

                </Button>

              )}

            </div>

          </form>

        </Modal>

      )}



      {/* STATS MODAL */}

      {selectedStatsCampaign && (

        <Modal onClose={() => setSelectedStatsCampaign(null)}>

          <div style={{ minWidth: 440, padding: 8 }}>

            <h3 style={{ margin: '0 0 6px', fontSize: 17, fontWeight: 800 }}>

              Hiệu quả: {selectedStatsCampaign.name}

            </h3>

            <p style={{ margin: '0 0 16px', fontSize: 12.5, color: '#64748b' }}>

              Báo cáo chuyển đổi đo lường từ outbox và các đơn đặt sân áp dụng voucher của chiến dịch

            </p>



            {statsLoading ? (

              <div style={{ padding: 30, textAlign: 'center', color: '#64748b' }}>Đang tính toán số liệu…</div>

            ) : statsData ? (

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>

                <div style={{ background: '#f8fafc', padding: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}>

                  <span style={{ fontSize: 12, color: '#64748b' }}>Tin đã gửi</span>

                  <div style={{ fontSize: 20, fontWeight: 800, color: '#0f172a', marginTop: 2 }}>

                    {statsData.totalSent} <span style={{ fontSize: 12, fontWeight: 500, color: '#16a34a' }}>({statsData.successSent} thành công)</span>

                  </div>

                </div>



                <div style={{ background: '#f8fafc', padding: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}>

                  <span style={{ fontSize: 12, color: '#64748b' }}>Lượt dùng voucher</span>

                  <div style={{ fontSize: 20, fontWeight: 800, color: '#2563eb', marginTop: 2 }}>

                    {statsData.redemptionsCount} <span style={{ fontSize: 12, fontWeight: 500, color: '#64748b' }}>lượt</span>

                  </div>

                </div>



                <div style={{ background: '#f8fafc', padding: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}>

                  <span style={{ fontSize: 12, color: '#64748b' }}>Tổng tiền giảm</span>

                  <div style={{ fontSize: 20, fontWeight: 800, color: '#dc2626', marginTop: 2 }}>

                    {money(statsData.totalDiscount || 0)}

                  </div>

                </div>



                <div style={{ background: '#f8fafc', padding: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}>

                  <span style={{ fontSize: 12, color: '#64748b' }}>Doanh thu thực thu</span>

                  <div style={{ fontSize: 20, fontWeight: 800, color: '#16a34a', marginTop: 2 }}>

                    {money(statsData.totalRevenue || 0)}

                  </div>

                </div>



                <div style={{ gridColumn: '1 / -1', background: '#f8fafc', padding: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}>

                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5 }}>

                    <span style={{ color: '#64748b' }}>Ngân sách trần:</span>

                    <b>{money(statsData.budgetLimit || 0)}</b>

                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, marginTop: 4 }}>

                    <span style={{ color: '#64748b' }}>Ngân sách còn lại:</span>

                    <b style={{ color: '#16a34a' }}>{money(statsData.budgetRemaining || 0)}</b>

                  </div>

                </div>

              </div>

            ) : null}



            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>

              <Button onClick={() => setSelectedStatsCampaign(null)}>Đóng</Button>

            </div>

          </div>

        </Modal>

      )}

    </div>

  );

}

