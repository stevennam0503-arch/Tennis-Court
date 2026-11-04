import React, { useState, useEffect, useMemo } from 'react';
import { Title, Panel, Button } from '../components/UI';
import { api } from '../services/api';
import { useCourtly } from '../context';
import { 
  Ticket, Plus, Search, Filter, CheckCircle2, PauseCircle, 
  StopCircle, Check, Copy, Users, Clock, Sparkles, X, 
  ChevronRight, AlertCircle, ShieldAlert, CheckCheck, RefreshCw 
} from 'lucide-react';

const WEEKDAYS = [
  { id: '1', label: 'T2' },
  { id: '2', label: 'T3' },
  { id: '3', label: 'T4' },
  { id: '4', label: 'T5' },
  { id: '5', label: 'T6' },
  { id: '6', label: 'T7' },
  { id: '7', label: 'CN' }
];

export default function VouchersPage() {
  const { notify, isAdmin } = useCourtly();
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  
  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [selectedVoucherForRedemptions, setSelectedVoucherForRedemptions] = useState(null);
  const [redemptions, setRedemptions] = useState([]);
  const [loadingRedemptions, setLoadingRedemptions] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    code: '',
    type: 'PERCENT',
    value: 10,
    minOrder: 0,
    maxDiscount: '',
    startsAt: new Date().toISOString().slice(0, 16),
    expiresAt: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 16),
    usageLimit: 50,
    perUserLimit: 1,
    newUserOnly: false,
    zone: '',
    validFromTime: '',
    validToTime: '',
    validWeekdays: '',
    minTier: '',
    description: ''
  });

  // Batch form
  const [batchPrefix, setBatchPrefix] = useState('TRIAN');
  const [batchQuantity, setBatchQuantity] = useState(10);
  const [batchResult, setBatchResult] = useState(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const q = statusFilter ? `?status=${statusFilter}` : '';
      const res = await api('/admin/vouchers' + q);
      setList(res || []);
    } catch (e) {
      notify('Lỗi tải danh sách voucher: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [statusFilter]);

  const liveDescription = useMemo(() => {
    let parts = [];
    if (formData.type === 'PERCENT') {
      parts.push(`Giảm ${formData.value || 0}%`);
      if (formData.maxDiscount) {
        parts.push(`tối đa ${Number(formData.maxDiscount).toLocaleString('vi-VN')}₫`);
      }
    } else {
      parts.push(`Giảm ${Number(formData.value || 0).toLocaleString('vi-VN')}₫`);
    }

    if (formData.minOrder > 0) {
      parts.push(`cho đơn từ ${Number(formData.minOrder).toLocaleString('vi-VN')}₫`);
    }

    if (formData.validFromTime && formData.validToTime) {
      parts.push(`khung giờ vàng ${formData.validFromTime}–${formData.validToTime}`);
    }

    if (formData.validWeekdays) {
      parts.push(`các ngày ${formData.validWeekdays}`);
    }

    if (formData.zone) {
      parts.push(`khu ${formData.zone}`);
    }

    if (formData.minTier) {
      parts.push(`từ hạng ${formData.minTier}`);
    }

    if (formData.newUserOnly) {
      parts.push(`chỉ khách mới`);
    }

    return parts.join(' ') + '.';
  }, [formData]);

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        ...formData,
        code: formData.code.trim().toUpperCase(),
        value: Number(formData.value),
        minOrder: Number(formData.minOrder || 0),
        maxDiscount: formData.maxDiscount ? Number(formData.maxDiscount) : null,
        usageLimit: formData.usageLimit ? Number(formData.usageLimit) : null,
        perUserLimit: Number(formData.perUserLimit || 1),
        startsAt: new Date(formData.startsAt).toISOString(),
        expiresAt: new Date(formData.expiresAt).toISOString(),
        description: formData.description?.trim() || liveDescription
      };

      const res = await api('/admin/vouchers', 'POST', payload);
      notify(`Đã tạo voucher ${res.code} (trạng thái: ${res.status})`);
      setShowCreateModal(false);
      loadData();
    } catch (e) {
      notify('Lỗi tạo voucher: ' + e.message);
    }
  };

  const handleAction = async (id, action) => {
    try {
      await api(`/admin/vouchers/${id}/${action}`, 'POST');
      notify(`Thao tác ${action} voucher thành công`);
      loadData();
    } catch (e) {
      notify(`Lỗi thao tác ${action}: ` + e.message);
    }
  };

  const handleBatchSubmit = async (e) => {
    e.preventDefault();
    try {
      const template = {
        type: formData.type,
        value: Number(formData.value),
        minOrder: Number(formData.minOrder || 0),
        maxDiscount: formData.maxDiscount ? Number(formData.maxDiscount) : null,
        startsAt: new Date(formData.startsAt).toISOString(),
        expiresAt: new Date(formData.expiresAt).toISOString(),
        description: formData.description?.trim() || liveDescription
      };

      const res = await api('/admin/vouchers/batch-generate', 'POST', {
        prefix: batchPrefix,
        quantity: Number(batchQuantity),
        template
      });

      setBatchResult(res || []);
      notify(`Đã sinh thành công ${res?.length || 0} mã cá nhân!`);
      loadData();
    } catch (e) {
      notify('Lỗi sinh mã hàng loạt: ' + e.message);
    }
  };

  const openRedemptions = async (v) => {
    setSelectedVoucherForRedemptions(v);
    setLoadingRedemptions(true);
    try {
      const res = await api(`/admin/vouchers/${v.id}/redemptions`);
      setRedemptions(res || []);
    } catch (e) {
      notify('Lỗi tải lịch sử dùng: ' + e.message);
    } finally {
      setLoadingRedemptions(false);
    }
  };

  const filtered = useMemo(() => {
    return list.filter(v => {
      if (!search.trim()) return true;
      const s = search.toLowerCase();
      return (v.code && v.code.toLowerCase().includes(s)) ||
             (v.description && v.description.toLowerCase().includes(s));
    });
  }, [list, search]);

  const pendingCount = useMemo(() => list.filter(v => v.status === 'PENDING_APPROVAL').length, [list]);

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '20px 16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16, marginBottom: 20 }}>
        <div>
          <Title level={2} style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
            <Ticket size={28} color="#059669" /> Quản lý Khuyến mãi & Voucher
          </Title>
          <div style={{ color: '#64748b', fontSize: 14, marginTop: 4 }}>
            Quản trị mã giảm giá, kiểm soát hạn mức phân quyền, duyệt voucher và sinh mã tri ân
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <Button onClick={() => { setBatchResult(null); setShowBatchModal(true); }} style={{ background: '#f8fafc', color: '#1e293b', border: '1px solid #cbd5e1' }}>
            <Sparkles size={16} /> Sinh mã hàng loạt
          </Button>
          <Button onClick={() => setShowCreateModal(true)} style={{ background: '#059669', color: '#fff' }}>
            <Plus size={16} /> Tạo voucher mới
          </Button>
        </div>
      </div>

      {pendingCount > 0 && isAdmin && (
        <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, padding: '12px 16px', marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#92400e', fontWeight: 600 }}>
            <ShieldAlert size={20} /> Có {pendingCount} voucher chờ Quản trị viên phê duyệt
          </div>
          <Button onClick={() => setStatusFilter('PENDING_APPROVAL')} style={{ fontSize: 13, background: '#d97706', color: '#fff', padding: '4px 12px' }}>
            Xem voucher chờ duyệt
          </Button>
        </div>
      )}

      {/* Filter and search bar */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {[
            { id: '', label: 'Tất cả' },
            { id: 'ACTIVE', label: 'Đang hoạt động' },
            { id: 'PENDING_APPROVAL', label: `Chờ duyệt (${pendingCount})` },
            { id: 'PAUSED', label: 'Tạm dừng' },
            { id: 'ENDED', label: 'Đã kết thúc' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setStatusFilter(tab.id)}
              style={{
                padding: '6px 14px',
                borderRadius: 20,
                fontSize: 13,
                fontWeight: 600,
                border: '1px solid',
                borderColor: statusFilter === tab.id ? '#059669' : '#e2e8f0',
                background: statusFilter === tab.id ? '#ecfdf5' : '#fff',
                color: statusFilter === tab.id ? '#065f46' : '#64748b',
                cursor: 'pointer'
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ position: 'relative' }}>
            <Search size={16} style={{ position: 'absolute', left: 10, top: 10, color: '#94a3b8' }} />
            <input
              type="text"
              placeholder="Tìm mã hoặc mô tả..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ padding: '7px 12px 7px 32px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 13, width: 220 }}
            />
          </div>
          <Button onClick={loadData} style={{ padding: '7px 12px' }}>
            <RefreshCw size={14} className={loading ? 'spin' : ''} />
          </Button>
        </div>
      </div>

      {/* Vouchers list */}
      <Panel>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', textAlign: 'left' }}>
                <th style={{ padding: '10px 12px' }}>Mã Voucher</th>
                <th style={{ padding: '10px 12px' }}>Mức giảm</th>
                <th style={{ padding: '10px 12px' }}>Mô tả & Điều kiện</th>
                <th style={{ padding: '10px 12px' }}>Đã dùng / Giới hạn</th>
                <th style={{ padding: '10px 12px' }}>Thời hạn</th>
                <th style={{ padding: '10px 12px' }}>Trạng thái</th>
                <th style={{ padding: '10px 12px', textAlign: 'right' }}>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '30px 0', color: '#94a3b8' }}>
                    {loading ? 'Đang tải voucher...' : 'Không có voucher nào phù hợp.'}
                  </td>
                </tr>
              ) : (
                filtered.map(v => {
                  const isPending = v.status === 'PENDING_APPROVAL';
                  const isActive = v.status === 'ACTIVE' || (v.enabled && !v.status);
                  const isPaused = v.status === 'PAUSED';
                  const isEnded = v.status === 'ENDED';

                  return (
                    <tr key={v.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '10px 12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 14, color: '#0f172a', background: '#f1f5f9', padding: '2px 6px', borderRadius: 4 }}>
                            {v.code}
                          </span>
                        </div>
                        {v.source && v.source !== 'GENERAL' && (
                          <div style={{ fontSize: 11, color: '#6366f1', marginTop: 2 }}>
                            Nguồn: {v.source}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: '10px 12px', fontWeight: 600, color: '#059669' }}>
                        {v.type === 'PERCENT' ? (
                          <>
                            {v.value}%
                            {v.maxDiscount && <div style={{ fontSize: 11, color: '#64748b', fontWeight: 400 }}>Tối đa {Number(v.maxDiscount).toLocaleString()}₫</div>}
                          </>
                        ) : (
                          `${Number(v.value).toLocaleString()}₫`
                        )}
                      </td>
                      <td style={{ padding: '10px 12px', maxWidth: 300 }}>
                        <div style={{ color: '#1e293b' }}>{v.description || '—'}</div>
                        <div style={{ fontSize: 11, color: '#64748b', marginTop: 2, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                          {v.minOrder > 0 && <span>Đơn từ {Number(v.minOrder).toLocaleString()}₫</span>}
                          {v.validFromTime && <span>Khung {v.validFromTime}–{v.validToTime}</span>}
                          {v.zone && <span>Khu: {v.zone}</span>}
                          {v.minTier && <span style={{ color: '#d97706', fontWeight: 600 }}>Hạng: {v.minTier}</span>}
                          {v.newUserOnly && <span style={{ color: '#2563eb' }}>Khách mới</span>}
                        </div>
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        <button
                          onClick={() => openRedemptions(v)}
                          style={{
                            background: 'none',
                            border: 'none',
                            padding: 0,
                            color: '#2563eb',
                            textDecoration: 'underline',
                            cursor: 'pointer',
                            fontWeight: 600
                          }}
                        >
                          {v.usedCount || 0} / {v.usageLimit ? v.usageLimit : '∞'}
                        </button>
                      </td>
                      <td style={{ padding: '10px 12px', fontSize: 12, color: '#64748b' }}>
                        <div>Đến: {v.expiresAt ? new Date(v.expiresAt).toLocaleDateString('vi-VN') : 'Vô thời hạn'}</div>
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        {isPending ? (
                          <span style={{ background: '#fef3c7', color: '#b45309', padding: '3px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700 }}>
                            Chờ duyệt
                          </span>
                        ) : isActive ? (
                          <span style={{ background: '#ecfdf5', color: '#065f46', padding: '3px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700 }}>
                            Hoạt động
                          </span>
                        ) : isPaused ? (
                          <span style={{ background: '#f1f5f9', color: '#475569', padding: '3px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700 }}>
                            Tạm dừng
                          </span>
                        ) : (
                          <span style={{ background: '#fee2e2', color: '#991b1b', padding: '3px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700 }}>
                            Đã kết thúc
                          </span>
                        )}
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: 6 }}>
                          {isPending && isAdmin && (
                            <button
                              onClick={() => handleAction(v.id, 'approve')}
                              title="Phê duyệt voucher"
                              style={{ background: '#059669', color: '#fff', border: 'none', borderRadius: 4, padding: '4px 8px', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
                            >
                              <CheckCheck size={13} /> Duyệt
                            </button>
                          )}
                          {isActive && (
                            <button
                              onClick={() => handleAction(v.id, 'pause')}
                              title="Tạm dừng"
                              style={{ background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: 4, padding: '4px 8px', fontSize: 12, cursor: 'pointer' }}
                            >
                              Tạm dừng
                            </button>
                          )}
                          {isPaused && (
                            <button
                              onClick={() => handleAction(v.id, 'resume')}
                              title="Kích hoạt lại"
                              style={{ background: '#ecfdf5', color: '#065f46', border: '1px solid #a7f3d0', borderRadius: 4, padding: '4px 8px', fontSize: 12, cursor: 'pointer' }}
                            >
                              Mở lại
                            </button>
                          )}
                          {!isEnded && (
                            <button
                              onClick={() => handleAction(v.id, 'end')}
                              title="Kết thúc voucher"
                              style={{ background: '#fff1f2', color: '#be123c', border: '1px solid #fecdd3', borderRadius: 4, padding: '4px 8px', fontSize: 12, cursor: 'pointer' }}
                            >
                              Đóng
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
      </Panel>

      {/* Modal Tạo Voucher */}
      {showCreateModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }}>
          <div style={{ background: '#fff', borderRadius: 12, width: '100%', maxWidth: 640, maxHeight: '90vh', overflowY: 'auto', padding: 24, boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <Title level={3} style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Ticket color="#059669" size={22} /> Tạo voucher mới
              </Title>
              <button onClick={() => setShowCreateModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={20} /></button>
            </div>

            {!isAdmin && (
              <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 6, padding: '8px 12px', fontSize: 12, color: '#166534', marginBottom: 16 }}>
                💡 <b>Hạn mức Staff:</b> Tối đa giảm 20% (hoặc 100.000₫), số lượng ≤ 50, hạn ≤ 30 ngày. Vượt hạn mức sẽ chuyển sang Chờ Admin duyệt.
              </div>
            )}

            <form onSubmit={handleCreateSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#334155', marginBottom: 4 }}>Mã voucher *</label>
                  <input
                    type="text"
                    required
                    placeholder="VD: HE2026, TRIAN20"
                    value={formData.code}
                    onChange={e => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #cbd5e1', fontWeight: 600 }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#334155', marginBottom: 4 }}>Loại giảm giá</label>
                  <select
                    value={formData.type}
                    onChange={e => setFormData({ ...formData, type: e.target.value })}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #cbd5e1' }}
                  >
                    <option value="PERCENT">Phần trăm (%)</option>
                    <option value="FIXED">Số tiền cố định (₫)</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#334155', marginBottom: 4 }}>
                    {formData.type === 'PERCENT' ? 'Tỷ lệ giảm (%) *' : 'Số tiền giảm (₫) *'}
                  </label>
                  <input
                    type="number"
                    required
                    min={1}
                    max={formData.type === 'PERCENT' ? 100 : 5000000}
                    value={formData.value}
                    onChange={e => setFormData({ ...formData, value: e.target.value })}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #cbd5e1' }}
                  />
                </div>
                {formData.type === 'PERCENT' && (
                  <div>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#334155', marginBottom: 4 }}>Giảm tối đa (₫)</label>
                    <input
                      type="number"
                      placeholder="VD: 100000"
                      value={formData.maxDiscount}
                      onChange={e => setFormData({ ...formData, maxDiscount: e.target.value })}
                      style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #cbd5e1' }}
                    />
                  </div>
                )}
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#334155', marginBottom: 4 }}>Đơn tối thiểu (₫)</label>
                  <input
                    type="number"
                    placeholder="VD: 200000"
                    value={formData.minOrder}
                    onChange={e => setFormData({ ...formData, minOrder: e.target.value })}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #cbd5e1' }}
                  />
                </div>
              </div>

              {/* Time and rules */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#334155', marginBottom: 4 }}>Hiệu lực từ</label>
                  <input
                    type="datetime-local"
                    value={formData.startsAt}
                    onChange={e => setFormData({ ...formData, startsAt: e.target.value })}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #cbd5e1' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#334155', marginBottom: 4 }}>Đến ngày</label>
                  <input
                    type="datetime-local"
                    value={formData.expiresAt}
                    onChange={e => setFormData({ ...formData, expiresAt: e.target.value })}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #cbd5e1' }}
                  />
                </div>
              </div>

              {/* Advanced filters: Golden hour, zone, minTier */}
              <div style={{ background: '#f8fafc', padding: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 8 }}>Điều kiện nâng cao (tùy chọn)</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 11, color: '#64748b', marginBottom: 3 }}>Khung giờ (từ - đến)</label>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <input
                        type="time"
                        value={formData.validFromTime}
                        onChange={e => setFormData({ ...formData, validFromTime: e.target.value })}
                        style={{ width: '50%', padding: '4px 6px', borderRadius: 4, border: '1px solid #cbd5e1', fontSize: 11 }}
                      />
                      <input
                        type="time"
                        value={formData.validToTime}
                        onChange={e => setFormData({ ...formData, validToTime: e.target.value })}
                        style={{ width: '50%', padding: '4px 6px', borderRadius: 4, border: '1px solid #cbd5e1', fontSize: 11 }}
                      />
                    </div>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 11, color: '#64748b', marginBottom: 3 }}>Áp dụng khu sân</label>
                    <select
                      value={formData.zone}
                      onChange={e => setFormData({ ...formData, zone: e.target.value })}
                      style={{ width: '100%', padding: '5px 8px', borderRadius: 4, border: '1px solid #cbd5e1', fontSize: 11 }}
                    >
                      <option value="">Tất cả các khu</option>
                      <option value="OUTDOOR">Ngoài trời</option>
                      <option value="INDOOR">Trong nhà</option>
                      <option value="VIP">Khu VIP</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 11, color: '#64748b', marginBottom: 3 }}>Yêu cầu hạng</label>
                    <select
                      value={formData.minTier}
                      onChange={e => setFormData({ ...formData, minTier: e.target.value })}
                      style={{ width: '100%', padding: '5px 8px', borderRadius: 4, border: '1px solid #cbd5e1', fontSize: 11 }}
                    >
                      <option value="">Tất cả khách</option>
                      <option value="CHALLENGER">Từ Challenger (≥3tr)</option>
                      <option value="MASTERS">Từ Masters (≥8tr)</option>
                      <option value="GRAND_SLAM">Grand Slam (≥20tr)</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Limits and description preview */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#334155', marginBottom: 4 }}>Tổng lượt sử dụng</label>
                  <input
                    type="number"
                    min={1}
                    value={formData.usageLimit}
                    onChange={e => setFormData({ ...formData, usageLimit: e.target.value })}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #cbd5e1' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#334155', marginBottom: 4 }}>Lượt dùng / khách</label>
                  <input
                    type="number"
                    min={1}
                    value={formData.perUserLimit}
                    onChange={e => setFormData({ ...formData, perUserLimit: e.target.value })}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #cbd5e1' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#334155', marginBottom: 4 }}>
                  Xem trước mô tả hiển thị cho khách:
                </label>
                <div style={{ background: '#f1f5f9', padding: '10px 12px', borderRadius: 6, fontSize: 13, color: '#0f172a', fontStyle: 'italic', border: '1px dashed #cbd5e1' }}>
                  {liveDescription}
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
                <Button type="button" onClick={() => setShowCreateModal(false)} style={{ background: '#f1f5f9', color: '#475569' }}>
                  Hủy
                </Button>
                <Button type="submit" style={{ background: '#059669', color: '#fff' }}>
                  Xác nhận tạo voucher
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Sinh Mã Hàng Loạt */}
      {showBatchModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }}>
          <div style={{ background: '#fff', borderRadius: 12, width: '100%', maxWidth: 520, maxHeight: '90vh', overflowY: 'auto', padding: 24, boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <Title level={3} style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Sparkles color="#d97706" size={22} /> Sinh mã cá nhân hàng loạt
              </Title>
              <button onClick={() => setShowBatchModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={20} /></button>
            </div>

            {batchResult ? (
              <div>
                <div style={{ color: '#065f46', fontWeight: 600, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <CheckCircle2 size={18} /> Đã sinh {batchResult.length} mã cá nhân (mỗi mã dùng 1 lần):
                </div>
                <div style={{ background: '#f8fafc', padding: 12, borderRadius: 8, maxHeight: 200, overflowY: 'auto', fontFamily: 'monospace', fontSize: 13, lineHeight: 1.8 }}>
                  {batchResult.map(c => <div key={c}>{c}</div>)}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 16 }}>
                  <Button
                    onClick={() => {
                      navigator.clipboard.writeText(batchResult.join('\n'));
                      notify('Đã sao chép toàn bộ mã vào clipboard!');
                    }}
                    style={{ background: '#2563eb', color: '#fff' }}
                  >
                    <Copy size={14} /> Sao chép toàn bộ
                  </Button>
                  <Button onClick={() => setShowBatchModal(false)} style={{ background: '#f1f5f9', color: '#334155' }}>
                    Đóng
                  </Button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleBatchSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#334155', marginBottom: 4 }}>Tiền tố mã *</label>
                    <input
                      type="text"
                      required
                      value={batchPrefix}
                      onChange={e => setBatchPrefix(e.target.value.toUpperCase())}
                      style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #cbd5e1' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#334155', marginBottom: 4 }}>Số lượng mã (1-100)</label>
                    <input
                      type="number"
                      required
                      min={1}
                      max={100}
                      value={batchQuantity}
                      onChange={e => setBatchQuantity(e.target.value)}
                      style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #cbd5e1' }}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#334155', marginBottom: 4 }}>Mức giảm</label>
                    <input
                      type="number"
                      value={formData.value}
                      onChange={e => setFormData({ ...formData, value: e.target.value })}
                      style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #cbd5e1' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#334155', marginBottom: 4 }}>Loại giảm</label>
                    <select
                      value={formData.type}
                      onChange={e => setFormData({ ...formData, type: e.target.value })}
                      style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #cbd5e1' }}
                    >
                      <option value="PERCENT">% phần trăm</option>
                      <option value="FIXED">₫ cố định</option>
                    </select>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
                  <Button type="button" onClick={() => setShowBatchModal(false)} style={{ background: '#f1f5f9', color: '#475569' }}>
                    Hủy
                  </Button>
                  <Button type="submit" style={{ background: '#d97706', color: '#fff' }}>
                    Sinh mã ngay
                  </Button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Modal Redemptions (Lịch sử sử dụng) */}
      {selectedVoucherForRedemptions && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }}>
          <div style={{ background: '#fff', borderRadius: 12, width: '100%', maxWidth: 640, maxHeight: '80vh', overflowY: 'auto', padding: 24, boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <Title level={3} style={{ margin: 0 }}>
                Lịch sử sử dụng mã: <span style={{ fontFamily: 'monospace', color: '#059669' }}>{selectedVoucherForRedemptions.code}</span>
              </Title>
              <button onClick={() => setSelectedVoucherForRedemptions(null)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={20} /></button>
            </div>

            {loadingRedemptions ? (
              <div style={{ textAlign: 'center', padding: 20 }}>Đang tải lịch sử...</div>
            ) : redemptions.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '30px 0', color: '#94a3b8' }}>Chưa có lượt sử dụng nào cho mã này.</div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left' }}>
                    <th style={{ padding: '8px 10px' }}>Khách hàng</th>
                    <th style={{ padding: '8px 10px' }}>Giảm giá</th>
                    <th style={{ padding: '8px 10px' }}>Thời gian dùng</th>
                  </tr>
                </thead>
                <tbody>
                  {redemptions.map(r => (
                    <tr key={r.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '8px 10px', fontWeight: 600 }}>{r.customerName}</td>
                      <td style={{ padding: '8px 10px', color: '#059669', fontWeight: 600 }}>
                        -{Number(r.discountAmount).toLocaleString()}₫
                      </td>
                      <td style={{ padding: '8px 10px', color: '#64748b', fontSize: 12 }}>
                        {r.redeemedAt ? new Date(r.redeemedAt).toLocaleString('vi-VN') : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
