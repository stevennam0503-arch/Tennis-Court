import React, { useState } from 'react';
import { Plus, Trash2, Edit3, ShieldCheck, Crown } from 'lucide-react';
import { useCourtly } from '../context';
import { Title, Panel, Table, Button, Chip, Modal, FormDialog } from '../components/UI';
import { money, labels } from '../utils/format';

const time = v => (v ? new Date(v).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }) : 'Chưa kích hoạt');

export default function MembershipAdminPage() {
  const { data, mutate, notify } = useCourtly();
  const [edit, setEdit] = useState(null);
  const [newPlan, setNewPlan] = useState(false);
  const [deletingPlanId, setDeletingPlanId] = useState(null);
  const [confirmDeletePlanId, setConfirmDeletePlanId] = useState(null);
  const [collect, setCollect] = useState(null);
  const [method, setMethod] = useState('CASH');
  const [code, setCode] = useState('');
  const [verified, setVerified] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('PENDING');
  const [request, setRequest] = useState('');

  const members = (data.memberships || []).filter(m => !filter || m.status === filter);

  const start = m => {
    setCollect(m);
    setMethod('CASH');
    setCode('');
    setVerified(false);
    setError('');
    setRequest(crypto.randomUUID());
  };

  const submit = async e => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      await mutate(`/membership/requests/${collect.id}/activate`, {
        amount: collect.price,
        method,
        transactionCode: code.trim(),
        collected: verified,
        requestId: request
      });
      notify(`Đã kích hoạt hội viên cho ${collect.name}`);
      setCollect(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const handleDeletePlan = async p => {
    if (deletingPlanId) return;
    setDeletingPlanId(p.id);
    try {
      await mutate(`/membership/plans/${p.id}`, {}, 'DELETE');
      notify(`Đã xóa thành công gói hội viên "${p.name}".`);
      setConfirmDeletePlanId(null);
    } catch (e) {
      notify(e.message || 'Không thể xóa gói hội viên.');
    } finally {
      setDeletingPlanId(null);
    }
  };

  return (
    <>
      <Title
        subtitle="Quản lý gói hội viên, duyệt đăng ký và xác minh phí trước khi kích hoạt."
        action={
          <Button className="primary" onClick={() => setNewPlan(true)}>
            <Plus size={16} style={{ marginRight: 4 }} /> Thêm gói hội viên
          </Button>
        }
      >
        Membership & hội viên
      </Title>

      <div className="grid-cards membership-admin-plans">
        {(data.membershipPlans || []).map(p => (
          <section className="panel" key={p.id} style={{ display: 'flex', flexDirection: 'column' }}>
            <div className="panel-body" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <Chip status={p.enabled ? 'ACTIVE' : 'INACTIVE'} />
                <span style={{ fontSize: 11.5, fontWeight: 700, color: '#475569', background: '#f1f5f9', padding: '2px 8px', borderRadius: 6 }}>
                  {p.days} ngày
                </span>
              </div>
              <h2 style={{ margin: '4px 0 8px' }}>{p.name}</h2>
              <div style={{ fontSize: 18, fontWeight: 800, color: '#173c32', marginBottom: 8 }}>
                {money(p.price)}
              </div>
              <div style={{ fontSize: 12.5, color: '#334155', lineHeight: 1.5, marginBottom: 12, flex: 1 }}>
                <div>• Giảm <b>{p.discountPercent}%</b> sân thường</div>
                <div>• Giảm <b>{p.vipDiscountPercent || 5}%</b> sân VIP</div>
                <div>• Đặt trước tối đa <b>{p.advanceDays || 14}</b> ngày</div>
                <div>• <b>{p.freeChanges || 1}</b> lượt đổi lịch miễn phí</div>
                {p.description && (
                  <p style={{ marginTop: 8, fontSize: 12, color: '#64748b', fontStyle: 'italic' }}>
                    {p.description}
                  </p>
                )}
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 'auto', paddingTop: 10, borderTop: '1px solid #f1f5f9' }}>
                <Button className="sm" onClick={() => setEdit(p)}>
                  Sửa gói
                </Button>
                {confirmDeletePlanId === p.id ? (
                  <div style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}>
                    <button
                      type="button"
                      className="btn sm"
                      disabled={deletingPlanId === p.id}
                      onClick={() => handleDeletePlan(p)}
                      style={{
                        background: '#e11d48',
                        color: '#ffffff',
                        border: '1px solid #be123c',
                        cursor: 'pointer',
                        padding: '4px 8px',
                        borderRadius: 6,
                        fontSize: 11,
                        fontWeight: 700
                      }}
                    >
                      {deletingPlanId === p.id ? 'Đang xóa…' : 'Xác nhận xóa'}
                    </button>
                    <button
                      type="button"
                      className="btn sm"
                      onClick={() => setConfirmDeletePlanId(null)}
                      style={{
                        background: '#f1f5f9',
                        color: '#475569',
                        border: '1px solid #cbd5e1',
                        cursor: 'pointer',
                        padding: '4px 6px',
                        borderRadius: 6,
                        fontSize: 11
                      }}
                    >
                      Hủy
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    className="btn sm"
                    onClick={() => setConfirmDeletePlanId(p.id)}
                    style={{
                      background: '#fff1f2',
                      color: '#e11d48',
                      border: '1px solid #fecdd3',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                      cursor: 'pointer',
                      padding: '4px 9px',
                      borderRadius: 6,
                      fontSize: 11.5,
                      fontWeight: 600
                    }}
                    title={`Xóa gói ${p.name}`}
                  >
                    <Trash2 size={12} />
                    <span>Xóa gói</span>
                  </button>
                )}
              </div>
            </div>
          </section>
        ))}
      </div>

      <Panel
        title="Danh sách hội viên"
        action={
          <label>
            Lọc trạng thái
            <select value={filter} onChange={e => setFilter(e.target.value)}>
              <option value="">Tất cả</option>
              {['PENDING', 'ACTIVE', 'EXPIRED', 'CANCELLED'].map(s => (
                <option key={s} value={s}>
                  {labels[s]}
                </option>
              ))}
            </select>
          </label>
        }
      >
        <Table headings={['Khách hàng / mã đăng ký', 'Gói & phí', 'Hiệu lực', 'Trạng thái', 'Thao tác']} empty={!members.length}>
          {members.map(m => (
            <tr key={m.id}>
              <td>
                {data.accounts.find(a => a.id === m.accountId)?.name || m.name}
                <small>{m.id}</small>
              </td>
              <td>
                {m.planName}
                <small>
                  {money(m.price)} / {m.days} ngày · {m.discountPercent}%
                </small>
              </td>
              <td>
                {time(m.startsAt)}
                {m.endsAt && <small>Đến trước {time(m.endsAt)}</small>}
              </td>
              <td>
                <Chip status={m.status} />
              </td>
              <td>
                {m.status === 'PENDING' ? (
                  <Button className="primary sm" onClick={() => start(m)}>
                    Thu phí & kích hoạt
                  </Button>
                ) : (
                  '—'
                )}
              </td>
            </tr>
          ))}
        </Table>
      </Panel>

      <Panel title="Phiếu thu phí membership">
        <Table headings={['Thời điểm', 'Khách hàng / gói', 'Mã phiếu thu', 'Phương thức', 'Số tiền']} empty={!data.membershipPayments?.length}>
          {(data.membershipPayments || []).map(p => (
            <tr key={p.id}>
              <td>{time(p.createdAt)}</td>
              <td>
                {data.accounts.find(a => a.id === p.accountId)?.name}
                <small>{p.planName}</small>
              </td>
              <td>{p.transactionCode}</td>
              <td>{labels[p.method]}</td>
              <td className="money-cell">{money(p.amount)}</td>
            </tr>
          ))}
        </Table>
      </Panel>

      {newPlan && (
        <FormDialog
          title="Thêm gói hội viên mới"
          initial={{
            name: '',
            price: 299000,
            days: 30,
            discountPercent: 10,
            vipDiscountPercent: 5,
            advanceDays: 14,
            freeChanges: 1,
            description: 'Quyền lợi hội viên CLB Courtly.',
            enabled: true
          }}
          onClose={() => setNewPlan(false)}
          submitText="Tạo gói hội viên"
          fields={[
            { name: 'name', label: 'Tên gói hội viên', maxLength: 60 },
            { name: 'price', label: 'Phí gói (₫)', type: 'number', min: 1, max: 100000000 },
            { name: 'days', label: 'Thời hạn (ngày)', type: 'number', min: 1, max: 366 },
            { name: 'discountPercent', label: 'Giảm tiền sân thường (%)', type: 'number', min: 0, max: 50 },
            { name: 'vipDiscountPercent', label: 'Giảm tiền sân VIP (%)', type: 'number', min: 0, max: 50 },
            { name: 'advanceDays', label: 'Đặt trước tối đa (ngày)', type: 'number', min: 1, max: 90 },
            { name: 'freeChanges', label: 'Lượt đổi lịch miễn phí', type: 'number', min: 0, max: 20 },
            { name: 'description', label: 'Mô tả đặc quyền', maxLength: 300, full: true },
            {
              name: 'enabled',
              label: 'Trạng thái mở đăng ký',
              options: [
                { value: true, label: 'Mở đăng ký công khai' },
                { value: false, label: 'Tạm dừng đăng ký' }
              ]
            }
          ]}
          onSubmit={async v => {
            await mutate('/membership/plans', {
              ...v,
              price: Number(v.price),
              days: Number(v.days),
              discountPercent: Number(v.discountPercent),
              vipDiscountPercent: Number(v.vipDiscountPercent || 5),
              advanceDays: Number(v.advanceDays || 14),
              freeChanges: Number(v.freeChanges || 1),
              enabled: v.enabled === true || v.enabled === 'true'
            }, 'POST');
            notify(`Đã thêm gói hội viên "${v.name}".`);
            setNewPlan(false);
          }}
        >
          <p className="notice">Gói hội viên mới sẽ xuất hiện trên trang giới thiệu hội viên và cho phép khách hàng đăng ký.</p>
        </FormDialog>
      )}

      {edit && (
        <FormDialog
          title={'Sửa gói ' + edit.name}
          initial={edit}
          onClose={() => setEdit(null)}
          onDelete={() => {
            const p = edit;
            setEdit(null);
            handleDeletePlan(p);
          }}
          deleteText="Xóa gói này"
          fields={[
            { name: 'name', label: 'Tên gói', maxLength: 60 },
            { name: 'price', label: 'Phí gói (₫)', type: 'number', min: 1, max: 100000000 },
            { name: 'days', label: 'Hiệu lực (ngày)', type: 'number', min: 1, max: 366 },
            { name: 'discountPercent', label: 'Giảm tiền sân thường (%)', type: 'number', min: 0, max: 50 },
            { name: 'vipDiscountPercent', label: 'Giảm tiền sân VIP (%)', type: 'number', min: 0, max: 50 },
            { name: 'advanceDays', label: 'Đặt trước tối đa (ngày)', type: 'number', min: 1, max: 90 },
            { name: 'freeChanges', label: 'Lượt đổi lịch miễn phí', type: 'number', min: 0, max: 20 },
            { name: 'description', label: 'Mô tả ngắn', maxLength: 300, full: true },
            {
              name: 'enabled',
              label: 'Mở đăng ký',
              options: [
                { value: true, label: 'Mở đăng ký' },
                { value: false, label: 'Tạm dừng' }
              ]
            }
          ]}
          onSubmit={async v => {
            await mutate('/membership/plans', {
              ...v,
              price: Number(v.price),
              days: Number(v.days),
              discountPercent: Number(v.discountPercent),
              vipDiscountPercent: Number(v.vipDiscountPercent || 5),
              advanceDays: Number(v.advanceDays || 14),
              freeChanges: Number(v.freeChanges || 1),
              enabled: v.enabled === true || v.enabled === 'true'
            }, 'PUT');
            notify(`Đã cập nhật gói hội viên "${v.name}".`);
            setEdit(null);
          }}
        >
          <p className="notice">Giá và quyền lợi mới chỉ áp dụng cho đăng ký tạo sau khi sửa. Gói đã đăng ký giữ nguyên giá và điều kiện.</p>
        </FormDialog>
      )}

      {collect && (
        <Modal
          title={'Xác minh phí · ' + collect.planName}
          onClose={() => !busy && setCollect(null)}
          footer={
            <>
              <Button disabled={busy} onClick={() => setCollect(null)}>
                Quay lại
              </Button>
              <button type="submit" form="membership-collect" className="btn primary" disabled={busy || !verified}>
                {busy ? 'Đang ghi nhận…' : 'Ghi nhận thu & kích hoạt'}
              </button>
            </>
          }
        >
          <p>
            {collect.name} · Phí cần xác minh: <b>{money(collect.price)}</b>
          </p>
          <p className="notice" style={{ margin: '16px 0' }}>
            Thao tác này ghi nhận tiền thực nhận và bắt đầu {collect.days} ngày hội viên. Chỉ xác nhận khi đã kiểm tra tiền mặt hoặc sao kê.
          </p>
          <form id="membership-collect" onSubmit={submit}>
            <div className="form-grid">
              <label>
                Phương thức
                <select value={method} onChange={e => { setMethod(e.target.value); setRequest(crypto.randomUUID()); }}>
                  <option value="CASH">Tiền mặt</option>
                  <option value="BANK_TRANSFER">Chuyển khoản</option>
                </select>
              </label>
              <label>
                Mã phiếu thu / giao dịch *
                <input required maxLength={100} value={code} onChange={e => { setCode(e.target.value); setRequest(crypto.randomUUID()); }} />
              </label>
            </div>
            <label className="consent-check">
              <input type="checkbox" checked={verified} onChange={e => setVerified(e.target.checked)} />
              Tôi đã xác minh nhận đủ {money(collect.price)}.
            </label>
          </form>
          {error && <p className="error" role="alert">{error}</p>}
        </Modal>
      )}
    </>
  );
}
