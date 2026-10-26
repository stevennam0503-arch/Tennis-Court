import React, { useState } from 'react';
import { useCourtly } from '../context';
import { api } from '../services/api';
import { Title, Panel, Table, Chip, Button, Modal } from '../components/UI';

export default function AccountsPage() {
  const { data, show, notify, mutate } = useCourtly();
  const [ticket, setTicket] = useState(null);
  const [issuing, setIssuing] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

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
      `Bạn có chắc chắn muốn xóa tài khoản "${a.name}" (${a.email})?\n\nSau khi xóa, tài khoản sẽ được giải phóng hoàn toàn và bạn có thể dùng email này để kiểm tra đăng ký tài khoản mới (các đơn hàng trước đó vẫn được lưu giữ an toàn).`
    );
    if (!confirmed) return;

    setDeletingId(a.id);
    try {
      await mutate(`/catalog/accounts/${a.id}`, {}, 'DELETE');
      notify(`Đã xóa vĩnh viễn tài khoản "${a.name}"`);
    } catch (e) {
      notify(e.message);
    } finally {
      setDeletingId(null);
    }
  };

  const [query, setQuery] = useState('');
  const list = data.accounts.filter(a =>
    `${a.name} ${a.email} ${a.phone}`.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <>
      <Title
        subtitle="Cấp quyền khách hàng/admin và kiểm soát tài khoản đăng nhập."
        action={
          <Button className="primary" onClick={() => show({ type: 'entity', collection: 'accounts' })}>
            Thêm tài khoản
          </Button>
        }
      >
        Tài khoản & phân quyền
      </Title>

      <Panel
        title="Danh sách tài khoản"
        action={
          <div className="tools">
            <input
              className="search"
              placeholder="Tìm tên, email, số điện thoại"
              value={query}
              onChange={e => setQuery(e.target.value)}
            />
          </div>
        }
      >
        <Table headings={['Họ tên', 'Liên hệ', 'Vai trò', 'Trạng thái', '']} empty={!list.length}>
          {list.map(a => (
            <tr key={a.id}>
              <td className="name">
                {a.name}
                {a.isOwner && <small>Chủ Site</small>}
                <span className="login-linked">
                  {a.loginLinked ? 'Đã liên kết đăng nhập' : 'Chưa đăng nhập'}
                </span>
              </td>
              <td>
                {a.email}
                <small>{a.phone}</small>
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
                      {a.loginLinked ? 'Đặt lại mật khẩu' : 'Kích hoạt'}
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
      </Panel>

      <div className="notice warn" style={{ marginTop: 20 }}>
        Khách chỉ xem và thao tác dữ liệu của mình. Admin được quản lý toàn bộ vận hành và tài khoản. Nút "Xóa" cho phép giải phóng email để kiểm tra đăng ký lại (đơn đặt sân và chứng từ cũ vẫn được bảo lưu). Khóa tài khoản (LOCKED) dùng khi muốn chặn đăng nhập nhưng giữ nguyên liên kết hồ sơ.
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
