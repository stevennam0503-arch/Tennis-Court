import React, { useState, useEffect, useMemo } from 'react';
import { Title, Panel, Button } from '../components/UI';
import { api } from '../services/api';
import { useCourtly } from '../context';
import { 
  Bell, Mail, MessageSquare, RefreshCw, 
  Search, Filter, CheckCircle2, AlertCircle, Clock, XCircle, ArrowUpRight 
} from 'lucide-react';

export default function SentNotificationsAdminPage() {
  const { notify } = useCourtly();
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [channel, setChannel] = useState('');
  const [status, setStatus] = useState('');
  const [type, setType] = useState('');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null);
  const [retryingId, setRetryingId] = useState(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const q = new URLSearchParams();
      if (channel) q.set('channel', channel);
      if (status) q.set('status', status);
      if (type) q.set('type', type);
      const res = await api('/admin/notifications?' + q.toString());
      setList(res || []);
    } catch (e) {
      notify('Lỗi tải danh sách thông báo: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [channel, status, type]);

  const handleRetry = async (n) => {
    setRetryingId(n.id);
    try {
      await api(`/admin/notifications/${n.id}/retry`, 'POST');
      notify('Đã đưa thông báo vào hàng đợi gửi lại.');
      loadData();
    } catch (e) {
      notify('Lỗi gửi lại thông báo: ' + e.message);
    } finally {
      setRetryingId(null);
    }
  };

  const filtered = useMemo(() => {
    if (!search.trim()) return list;
    const s = search.toLowerCase();
    return list.filter(n => 
      (n.recipient && n.recipient.toLowerCase().includes(s)) ||
      (n.subject && n.subject.toLowerCase().includes(s)) ||
      (n.body && n.body.toLowerCase().includes(s)) ||
      (n.dedupeKey && n.dedupeKey.toLowerCase().includes(s))
    );
  }, [list, search]);

  const renderStatusPill = (st) => {
    const s = st?.toLowerCase() || '';
    if (s.includes('sent')) {
      return (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: '#ecfdf5', color: '#065f46', padding: '3px 8px', borderRadius: 6, fontSize: 12, fontWeight: 600 }}>
          <CheckCircle2 size={13} /> {st}
        </span>
      );
    }
    if (s.includes('queued')) {
      return (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: '#eff6ff', color: '#1e40af', padding: '3px 8px', borderRadius: 6, fontSize: 12, fontWeight: 600 }}>
          <Clock size={13} /> Chờ gửi
        </span>
      );
    }
    if (s.includes('failed')) {
      return (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: '#fef2f2', color: '#991b1b', padding: '3px 8px', borderRadius: 6, fontSize: 12, fontWeight: 600 }}>
          <AlertCircle size={13} /> Thất bại
        </span>
      );
    }
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: '#f1f5f9', color: '#64748b', padding: '3px 8px', borderRadius: 6, fontSize: 12, fontWeight: 600 }}>
        <XCircle size={13} /> Bỏ qua
      </span>
    );
  };

  const renderChannelIcon = (ch) => {
    if (ch === 'EMAIL') return <Mail size={16} color="#0284c7" title="Email" />;
    return <Bell size={16} color="#d97706" title="In-App" />;
  };

  return (
    <div className="admin-page-container" style={{ padding: '24px 32px', maxWidth: 1200, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <Title>Thông báo đã gửi</Title>
          <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: 14 }}>
            Theo dõi nhật ký thông báo tự động (Nhắc lịch, Nhắc nợ, Xác nhận đặt sân) qua Email và thông báo trong ứng dụng.
          </p>
        </div>
        <Button onClick={loadData} disabled={loading} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <RefreshCw size={15} className={loading ? 'spin' : ''} /> Làm mới
        </Button>
      </div>

      {/* Bộ lọc */}
      <Panel style={{ padding: 16, marginBottom: 20, display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 240, background: '#f8fafc', padding: '6px 12px', borderRadius: 8, border: '1px solid #e2e8f0' }}>
          <Search size={16} color="#94a3b8" />
          <input
            placeholder="Tìm theo số điện thoại, email, nội dung..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ border: 'none', background: 'transparent', outline: 'none', width: '100%', fontSize: 13 }}
          />
        </div>

        <select
          value={channel}
          onChange={e => setChannel(e.target.value)}
          style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 13, background: '#fff' }}
        >
          <option value="">Tất cả kênh</option>
          <option value="EMAIL">Email</option>
          <option value="IN_APP">In-App Chuông</option>
        </select>

        <select
          value={status}
          onChange={e => setStatus(e.target.value)}
          style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 13, background: '#fff' }}
        >
          <option value="">Tất cả trạng thái</option>
          <option value="SENT">Thành công (SENT)</option>
          <option value="QUEUED">Hàng đợi (QUEUED)</option>
          <option value="FAILED">Thất bại (FAILED)</option>
          <option value="SKIPPED">Bỏ qua (SKIPPED)</option>
        </select>

        <select
          value={type}
          onChange={e => setType(e.target.value)}
          style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 13, background: '#fff' }}
        >
          <option value="">Tất cả loại thông báo</option>
          <option value="BOOKING_REMINDER_24H">Nhắc lịch 24h</option>
          <option value="BOOKING_REMINDER_2H">Nhắc lịch 2h</option>
          <option value="BOOKING_REMINDER_IMMEDIATE">Nhắc ngay tại quầy</option>
          <option value="BOOKING_CONFIRMED">Xác nhận cọc</option>
          <option value="HOLD_EXPIRING">Sắp hết giờ giữ chỗ</option>
          <option value="OVERDUE_DEBT">Nhắc nợ quá hạn</option>
          <option value="REFUND_DONE">Hoàn tiền</option>
        </select>
      </Panel>

      {/* Bảng danh sách */}
      <Panel style={{ overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
          <thead>
            <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569' }}>
              <th style={{ padding: '12px 16px' }}>Kênh</th>
              <th style={{ padding: '12px 16px' }}>Loại thông báo</th>
              <th style={{ padding: '12px 16px' }}>Người nhận</th>
              <th style={{ padding: '12px 16px' }}>Nội dung / Tiêu đề</th>
              <th style={{ padding: '12px 16px' }}>Trạng thái</th>
              <th style={{ padding: '12px 16px' }}>Thời gian</th>
              <th style={{ padding: '12px 16px', textAlign: 'right' }}>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>
                  Không tìm thấy thông báo nào phù hợp.
                </td>
              </tr>
            ) : (
              filtered.map(n => (
                <tr key={n.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      {renderChannelIcon(n.channel)}
                      <span style={{ fontWeight: 600 }}>{n.channel}</span>
                    </div>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{ fontFamily: 'monospace', fontSize: 12, background: '#f1f5f9', padding: '2px 6px', borderRadius: 4 }}>
                      {n.type}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px', fontWeight: 500 }}>
                    {n.recipient || '—'}
                  </td>
                  <td style={{ padding: '12px 16px', maxWidth: 320 }}>
                    <div style={{ fontWeight: 600, color: '#1e293b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {n.subject || n.body?.slice(0, 45)}
                    </div>
                    <div style={{ color: '#64748b', fontSize: 12, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {n.body}
                    </div>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    {renderStatusPill(n.status)}
                    {n.lastError && (
                      <div style={{ color: '#ef4444', fontSize: 11, marginTop: 2 }} title={n.lastError}>
                        Lỗi: {n.lastError.slice(0, 25)}...
                      </div>
                    )}
                  </td>
                  <td style={{ padding: '12px 16px', color: '#64748b', whiteSpace: 'nowrap' }}>
                    {new Date(n.createdAt).toLocaleString('vi-VN')}
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <button
                      type="button"
                      onClick={() => setSelected(n)}
                      style={{ padding: '5px 10px', fontSize: 12, background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: 6, cursor: 'pointer', marginRight: 6 }}
                    >
                      Xem chi tiết
                    </button>
                    {n.status === 'FAILED' && (
                      <button
                        type="button"
                        disabled={retryingId === n.id}
                        onClick={() => handleRetry(n)}
                        style={{ padding: '5px 10px', fontSize: 12, background: '#173c32', color: '#def46a', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 600 }}
                      >
                        {retryingId === n.id ? 'Đang gửi...' : 'Gửi lại'}
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </Panel>

      {/* Modal xem chi tiết */}
      {selected && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }}>
          <div style={{ background: '#fff', borderRadius: 12, maxWidth: 560, width: '100%', maxHeight: '90vh', overflow: 'auto', padding: 24, boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, borderBottom: '1px solid #e2e8f0', paddingBottom: 12 }}>
              <h3 style={{ margin: 0, fontSize: 18, color: '#173c32' }}>Chi tiết thông báo</h3>
              <button type="button" onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#64748b' }}>✕</button>
            </div>

            <div style={{ display: 'grid', gap: 12, fontSize: 13.5 }}>
              <div><strong>Kênh:</strong> {selected.channel} · <strong>Loại:</strong> <code>{selected.type}</code></div>
              <div><strong>Người nhận:</strong> {selected.recipient || 'In-App'}</div>
              <div><strong>Trạng thái:</strong> {selected.status} (Số lần thử: {selected.attempts})</div>
              {selected.lastError && (
                <div style={{ background: '#fef2f2', color: '#991b1b', padding: 10, borderRadius: 6 }}>
                  <strong>Lỗi:</strong> {selected.lastError}
                </div>
              )}
              {selected.subject && <div><strong>Tiêu đề:</strong> {selected.subject}</div>}
              <div>
                <strong>Nội dung:</strong>
                <div style={{ background: '#f8fafc', padding: 12, borderRadius: 8, border: '1px solid #e2e8f0', marginTop: 6, whiteSpace: 'pre-wrap', lineHeight: 1.5, maxHeight: 220, overflow: 'auto' }}>
                  {selected.body}
                </div>
              </div>
              <div style={{ color: '#64748b', fontSize: 12 }}>
                <div>Khóa chống trùng (dedupe_key): <code>{selected.dedupeKey}</code></div>
                <div>Tạo lúc: {new Date(selected.createdAt).toLocaleString('vi-VN')}</div>
                {selected.sentAt && <div>Gửi lúc: {new Date(selected.sentAt).toLocaleString('vi-VN')}</div>}
              </div>
            </div>

            <div style={{ marginTop: 20, textAlign: 'right' }}>
              <button
                type="button"
                onClick={() => setSelected(null)}
                style={{ padding: '8px 16px', background: '#e2e8f0', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer' }}
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
