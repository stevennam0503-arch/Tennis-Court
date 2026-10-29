import React, { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { Panel } from './UI';
import { api } from '../services/api';

function PasswordField({ id, label, value, onChange, placeholder, required = true, minLength, maxLength = 128, autoComplete }) {
  const [show, setShow] = useState(false);
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <div className="password-input-wrapper">
        <input
          id={id}
          type={show ? 'text' : 'password'}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          required={required}
          minLength={minLength}
          maxLength={maxLength}
          autoComplete={autoComplete}
        />
        <button
          type="button"
          className="password-toggle-btn"
          onClick={() => setShow(s => !s)}
          title={show ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
          aria-label={show ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
          tabIndex={-1}
        >
          {show ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </div>
    </div>
  );
}

export default function PasswordForm() {
  const [values, setValues] = useState({ currentPassword: '', password: '', confirm: '' });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [busy, setBusy] = useState(false);

  return (
    <div style={{ marginTop: 24 }}>
      <Panel title="Đổi mật khẩu">
        <div className="notice" style={{ marginTop: 24 }}>
          Đổi mật khẩu sẽ thu hồi tất cả các phiên đăng nhập cũ trên các thiết bị khác. Mật khẩu mới cần từ 6 ký tự để đảm bảo an toàn.
        </div>
        <form
          className="panel-body auth-fields"
          onSubmit={async e => {
            e.preventDefault();
            if (busy) return;
            setError('');
            setSuccess('');
            if (values.password !== values.confirm) {
              return setError('Hai mật khẩu mới chưa trùng nhau.');
            }
            setBusy(true);
            try {
              await api('/auth/password', 'POST', values);
              setValues({ currentPassword: '', password: '', confirm: '' });
              setSuccess('Đã đổi mật khẩu thành công và đăng xuất các phiên đăng nhập khác.');
            } catch (e) {
              setError(e.message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <PasswordField
            id="password-currentPassword"
            label="Mật khẩu hiện tại"
            autoComplete="current-password"
            placeholder="Nhập mật khẩu hiện tại"
            value={values.currentPassword}
            onChange={e => setValues(v => ({ ...v, currentPassword: e.target.value }))}
          />
          <PasswordField
            id="password-password"
            label="Mật khẩu mới"
            minLength={6}
            autoComplete="new-password"
            placeholder="Tối thiểu 6 ký tự"
            value={values.password}
            onChange={e => setValues(v => ({ ...v, password: e.target.value }))}
          />
          <PasswordField
            id="password-confirm"
            label="Nhập lại mật khẩu mới"
            minLength={6}
            autoComplete="new-password"
            placeholder="Nhập lại chính xác mật khẩu mới"
            value={values.confirm}
            onChange={e => setValues(v => ({ ...v, confirm: e.target.value }))}
          />
          <small>Mật khẩu mới từ 6 ký tự, tối đa 72 byte UTF-8.</small>
          {error && <div className="error" role="alert">{error}</div>}
          {success && <div className="notice" role="status" style={{ background: '#e8f5e9', borderColor: '#a5d6a7', color: '#1b5e20' }}>{success}</div>}
          <button className="btn primary" disabled={busy}>
            {busy ? 'Đang lưu…' : 'Đổi mật khẩu'}
          </button>
        </form>
      </Panel>
    </div>
  );
}
