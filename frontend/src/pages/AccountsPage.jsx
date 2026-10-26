import React, { useState, useMemo } from 'react';
import { Users, UserCheck, Shield, Lock, Search, ChevronLeft, ChevronRight, UserPlus } from 'lucide-react';
import { useCourtly } from '../context';
import { api } from '../services/api';
import { Title, Stat, Panel, Table, Chip, Button, Modal, Tabs } from '../components/UI';

export default function AccountsPage() {
  const { data, show, notify, mutate } = useCourtly();
  const [ticket, setTicket] = useState(null);
  const [issuing, setIssuing] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 15;

  const issue = async accountId => {
    if (issuing) return;
    setIssuing(true);
    try {
      setTicket(await api('/auth/ticket', 'POST', { accountId }));
    } catch (e) {
      notify(e.message);
    } finally {
      setIssuing(false);
    }
  };

  const handleDelete = async a => {
    if (a.id === data.viewer.accountId || a.isOwner || deletingId) return;
    const confirmed = window.confirm(
      `Bạn có chắc chắn muốn xóa tài khoản "${a.name}" (${a.email})?\n\nSau khi xóa, tài khoản sẽ được giải phóng hoàn toàn và bạn có thể dùng email này để kiểm tra đăng ký tài khoản mới (các đơn hàng trước đó vẫn được bảo lưu an toàn trên hệ thống).`
    );
    if (!confirmed) return;

    setDeletingId(a.id);
    try {
      await mutate(`/catalog/accounts/${a.id}`, {}, 'DELETE');
      notify(`Đã xóa vĩnh viễn tài khoản "${a.name}" và giải phóng email.`);
    } catch (e) {
      notify(e.message);
    } finally {
      setDeletingId(null);
    }
  };

  // Role & status counts
  const counts = useMemo(() => {
    const res = { all: data.accounts.length, CUSTOMER: 0, STAFF: 0, ADMIN: 0, LOCKED: 0 };
    for (const a of data.accounts) {
      if (a.status === 'LOCKED') res.LOCKED++;
      if (res[a.role] !== undefined) res[a.role]++;
    }
    return res;
  }, [data.accounts]);

  // Filter accounts
  const filtered = useMemo(() => {
    return data.accounts.filter(a => {
      if (roleFilter === 'LOCKED' && a.status !== 'LOCKED') return false;
      if (roleFilter !== 'ALL' && roleFilter !== 'LOCKED' && a.role !== roleFilter) return false;
      if (query.trim()) {
        const q = query.toLowerCase();
        const match = `${a.name} ${a.email} ${a.phone}`.toLowerCase().includes(q);
        if (!match) return false;
      }
      return true;
    });
  }, [data.accounts, roleFilter, query]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paginatedList = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, currentPage, pageSize]);

  const handleFilterChange = r => {
    setRoleFilter(r);
    setPage(1);
  };

  return (
    <>
      <Title
        subtitle="Quản lý tài khoản đăng nhập, cấp quyền và giải phóng email kiểm thử."
        action={
          <Button className="primary" onClick={() => show({ type: 'entity', collection: 'accounts' })}>
            <UserPlus size={16} style={{ marginRight: 6 }} /> Thêm tài khoản
          </Button>
        }
      >
        Tài khoản & phân quyền
      </Title>

      {/* Quick Summary Stats */}
      <div className="stats">
        <Stat title="Tổng tài khoản" value={counts.all} note="Toàn bộ hệ thống" icon={Users} />
        <Stat title="Khách hàng" value={counts.CUSTOMER} note="Khách đặt sân & hội viên" icon={UserCheck} />
        <Stat title="Nhân sự / Staff" value={counts.STAFF} note="Thu ngân & điều hành sân" icon={Shield} />
        <Stat title="Quản trị viên" value={counts.ADMIN} note="Chủ sân & Admin quản trị" icon={Lock} />
      </div>

      {/* Role Navigation Tabs */}
      <div className="tabs" style={{ marginBottom: 16 }}>
        {[
          ['ALL', `Tất cả (${counts.all})`],
          ['CUSTOMER', `Khách hàng (${counts.CUSTOMER})`],
          ['STAFF', `Nhân sự Staff (${counts.STAFF})`],
          ['ADMIN', `Quản trị Admin (${counts.ADMIN})`],
          ['LOCKED', `Đang khóa (${counts.LOCKED})`]
        ].map(([r, label]) => (
          <button
            key={r}
            className={roleFilter === r ? 'on' : ''}
            onClick={() => handleFilterChange(r)}
          >
            {label}
          </button>
        ))}
      </div>

      <Panel
        title={`Danh sách tài khoản (${filtered.length})`}
        action={
          <div className="tools">
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <Search size={16} style={{ position: 'absolute', left: 10, color: '#94a3b8' }} />
              <input
                className="search"
                style={{ paddingLeft: 32, width: 240 }}
                placeholder="Tìm tên, email, SĐT..."
                value={query}
                onChange={e => {
                  setQuery(e.target.value);
                  setPage(1);
                }}
              />
            </div>
          </div>
        }
      >
        <Table headings={['Họ tên', 'Liên hệ', 'Vai trò', 'Trạng thái', 'Thao tác']} empty={!paginatedList.length}>
          {paginatedList.map(a => (
            <tr key={a.id}>
              <td className="name">
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: '50%',
                      background: a.role === 'ADMIN' ? '#dcfce7' : a.role === 'STAFF' ? '#ffedd5' : '#f1f5f9',
                      color: a.role === 'ADMIN' ? '#166534' : a.role === 'STAFF' ? '#9a3412' : '#475569',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 700,
                      fontSize: 12,
                      flexShrink: 0
                    }}
                  >
                    {a.name.slice(0, 1).toUpperCase()}
                  </div>
                  <div>
                    <b>{a.name}</b>
                    {a.isOwner && <small style={{ color: '#047857', fontWeight: 700, marginLeft: 4 }}>• Chủ Site</small>}
                    <span className="login-linked" style={{ display: 'block', fontSize: 11 }}>
                      {a.loginLinked ? '✓ Đã liên kết đăng nhập' : '○ Chưa đăng nhập'}
                    </span>
                  </div>
                </div>
              </td>
              <td>
                <div style={{ fontSize: 13, fontWeight: 500 }}>{a.email}</div>
                <small style={{ color: '#64748b' }}>{a.phone || 'Chưa cập nhật SĐT'}</small>
              </td>
              <td>
                <Chip status={a.role} />
              </td>
              <td>
                <Chip status={a.status} />
              </td>
              <td>
                <div className="row-actions">
                  <Button className="sm" onClick={() => show({ type: 'entity', collection: 'accounts', row: a })}>
                    Sửa
                  </Button>
                  <Button className="sm" onClick={() => show({ type: 'customer-history', id: a.id })}>
                    Lịch sử
                  </Button>
                  {a.id !== data.viewer.accountId && (!a.isOwner || data.viewer.isOwner) && (
                    <Button className="sm" disabled={issuing} onClick={() => issue(a.id)}>
                      {a.loginLinked ? 'Đổi MK' : 'Kích hoạt'}
                    </Button>
                  )}
                  {a.id !== data.viewer.accountId && !a.isOwner && (
                    <Button
                      className="sm"
                      disabled={deletingId === a.id}
                      style={{ color: '#b91c1c', borderColor: '#fca5a5', background: '#fff' }}
                      title="Xóa tài khoản để giải phóng email (cho phép kiểm tra đăng ký lại)"
                      onClick={() => handleDelete(a)}
                    >
                      {deletingId === a.id ? 'Đang xóa…' : 'Xóa'}
                    </Button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </Table>

        {/* Clean Pagination Bar */}
        {totalPages > 1 && (
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '14px 20px',
              borderTop: '1px solid #e2e8f0',
              background: '#f8fafc',
              fontSize: 13,
              color: '#64748b'
            }}
          >
            <span>
              Hiển thị <b>{(currentPage - 1) * pageSize + 1}</b> – <b>{Math.min(currentPage * pageSize, filtered.length)}</b> trong số <b>{filtered.length}</b> tài khoản
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Button
                className="sm"
                disabled={currentPage <= 1}
                onClick={() => setPage(p => Math.max(1, p - 1))}
              >
                <ChevronLeft size={14} style={{ marginRight: 2 }} /> Trước
              </Button>
              <span style={{ fontWeight: 600, color: '#1e293b', padding: '0 8px' }}>
                Trang {currentPage} / {totalPages}
              </span>
              <Button
                className="sm"
                disabled={currentPage >= totalPages}
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              >
                Sau <ChevronRight size={14} style={{ marginLeft: 2 }} />
              </Button>
            </div>
          </div>
        )}
      </Panel>

      <div className="notice warn" style={{ marginTop: 20 }}>
        Admin có thể xóa tài khoản để giải phóng email đăng ký lại khi kiểm thử (các đơn hàng trước đó vẫn được lưu giữ an toàn trên chứng từ và doanh thu). Khóa tài khoản (LOCKED) dùng khi muốn chặn đăng nhập nhưng giữ nguyên liên kết hồ sơ.
      </div>

      {ticket && (
        <Modal
          title="Mã kích hoạt một lần"
          onClose={() => setTicket(null)}
          footer={<Button onClick={() => setTicket(null)}>Đóng</Button>}
        >
          <p>
            Giao mã này riêng cho đúng chủ tài khoản sau khi xác minh. Mã dùng một lần, hết hạn sau 24 giờ.
          </p>
          <label htmlFor="activation-code" style={{ marginTop: 20 }}>
            Mã kích hoạt
          </label>
          <input id="activation-code" readOnly value={ticket.token} onFocus={e => e.target.select()} />
          <p className="subtitle" style={{ marginTop: 12 }}>
            Người nhận chọn Đăng nhập → Quên mật khẩu / Có mã kích hoạt để đặt mật khẩu.
          </p>
        </Modal>
      )}
    </>
  );
}
