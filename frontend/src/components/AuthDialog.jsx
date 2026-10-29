import React, { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { Modal, Button } from './UI';
import { api } from '../services/api';

function PasswordField({ id, label, value, onChange, placeholder, required = true, minLength, maxLength = 128, autoComplete, hint }) {
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
      {hint && <small>{hint}</small>}
    </div>
  );
}

export default function AuthDialog({ onClose, onSuccess, ownerSetupAvailable = false, initialMode = 'login', initialToken = '' }) {
  const [mode, setMode] = useState(initialMode);
  const [values, setValues] = useState({ email: '', password: '', confirm: '', name: '', phone: '', token: initialToken, code: '' });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [devCode, setDevCode] = useState('');
  const [busy, setBusy] = useState(false);

  const titles = {
    login: 'Đăng nhập Courtly',
    register: 'Tạo tài khoản Courtly',
    forgot: 'Quên mật khẩu',
    reset: 'Đặt lại mật khẩu',
    activate: 'Kích hoạt / Đặt lại mật khẩu',
    'activate-otp': 'Kích hoạt tài khoản Courtly',
    'owner-activate': 'Thiết lập tài khoản của bạn'
  };

  const set = (name, value) => setValues(v => ({ ...v, [name]: value }));

  const switchMode = next => {
    setMode(next);
    setError('');
    setSuccess('');
    setDevCode('');
    setValues(v => ({ ...v, password: '', confirm: '' }));
  };

  const handleForgotPassword = async e => {
    e.preventDefault();
    if (busy) return;
    setError('');
    setSuccess('');
    if (!values.email.trim()) return setError('Vui lòng nhập địa chỉ email của bạn.');
    setBusy(true);
    try {
      const res = await api('/auth/forgot-password', 'POST', { email: values.email.trim() });
      setSuccess(res.message || 'Mã xác nhận đã được gửi về email của bạn.');
      if (res.code) {
        set('code', res.code);
        setDevCode(res.code);
      }
      setMode('reset');
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const handleResend = async () => {
    if (busy || !values.email.trim()) return;
    setError('');
    setSuccess('');
    setBusy(true);
    try {
      if (mode === 'activate-otp') {
        const res = await api('/auth/resend-activation', 'POST', { email: values.email.trim() });
        setSuccess('Đã gửi lại mã kích hoạt mới đến email của bạn.');
        if (res.devCode) {
          setDevCode(res.devCode);
          set('code', res.devCode);
        }
      } else {
        const res = await api('/auth/forgot-password', 'POST', { email: values.email.trim() });
        setSuccess('Đã gửi lại mã xác nhận mới đến email của bạn.');
        if (res.code) {
          setDevCode(res.code);
          set('code', res.code);
        }
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const submit = async e => {
    e.preventDefault();
    if (busy) return;
    setError('');
    if (mode === 'forgot') return handleForgotPassword(e);

    if (mode === 'register') {
      const p = values.phone.trim().replace(/\s+/g, '');
      if (!/^0[0-9]{9}$/.test(p)) {
        return setError('Số điện thoại không hợp lệ (cần đúng 10 chữ số, bắt đầu bằng số 0).');
      }
    }

    if (['register', 'reset', 'activate', 'owner-activate'].includes(mode) && values.password !== values.confirm) {
      return setError('Hai mật khẩu chưa trùng nhau.');
    }

    setBusy(true);
    try {
      if (mode === 'register') {
        const res = await api('/auth/register', 'POST', {
          ...values,
          phone: values.phone.trim().replace(/\s+/g, ''),
          requireActivation: true
        });
        if (res.requiresActivation) {
          setMode('activate-otp');
          setSuccess(res.message || 'Mã OTP 6 số đã được gửi về email.');
          if (res.devCode) {
            setDevCode(res.devCode);
            set('code', res.devCode);
          }
          return;
        }
        await onSuccess(res);
        return;
      }

      if (mode === 'activate-otp') {
        const session = await api('/auth/activate', 'POST', {
          code: values.code.trim(),
          email: values.email?.trim()
        });
        await onSuccess(session);
        return;
      }

      let endpoint = `/auth/${mode}`;
      let payload = values;
      if (mode === 'reset') {
        endpoint = '/auth/reset-password';
        payload = {
          code: (values.code || values.token || '').trim(),
          password: values.password,
          email: values.email?.trim()
        };
      }
      const res = await api(endpoint, 'POST', payload);
      if (res.requiresActivation) {
        setMode('activate-otp');
        if (res.email) set('email', res.email);
        setSuccess(res.message || 'Tài khoản chưa được kích hoạt. Vui lòng nhập mã OTP.');
        if (res.devCode) {
          setDevCode(res.devCode);
          set('code', res.devCode);
        }
        return;
      }
      await onSuccess(res);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title={titles[mode]} onClose={() => { if (!busy) onClose(); }}>
      <p className="subtitle" style={{ marginBottom: 20 }}>
        {mode === 'login'
          ? 'Dùng email và mật khẩu Courtly. Sau đăng nhập, bạn sẽ được đưa đến không gian phù hợp với tài khoản.'
          : mode === 'register'
          ? 'Tạo tài khoản để đặt sân, thuê trọng tài và tham gia các giải đấu CLB.'
          : mode === 'activate-otp'
          ? `Mã kích hoạt OTP 6 số đã được gửi đến ${values.email}. Vui lòng kiểm tra hộp thư và nhập mã bên dưới để hoàn tất đăng ký.`
          : mode === 'forgot'
          ? 'Nhập email đã đăng ký. Hệ thống sẽ gửi mã xác nhận 6 số để bạn đặt mật khẩu mới.'
          : mode === 'reset'
          ? `Mã xác nhận 6 số đã được gửi đến ${values.email}. Vui lòng kiểm tra hộp thư đến (hoặc hòm thư rác) và nhập mã bên dưới.`
          : mode === 'owner-activate'
          ? 'Đặt mật khẩu Courtly cho tài khoản chủ Site đã được xác thực.'
          : 'Nhập mã kích hoạt một lần do quản trị viên cung cấp để đặt mật khẩu.'}
      </p>

      {success && <div className="auth-hint-success" role="status">{success}</div>}

      <form onSubmit={submit} className="auth-fields">
        {mode === 'register' && (
          <>
            <div className="field">
              <label htmlFor="auth-name">Họ và tên</label>
              <input
                id="auth-name"
                autoComplete="name"
                required
                maxLength={100}
                placeholder="Ví dụ: Nguyễn Văn A"
                value={values.name}
                onChange={e => set('name', e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="auth-phone">Số điện thoại liên hệ (để xác nhận đặt sân)</label>
              <input
                id="auth-phone"
                type="tel"
                autoComplete="tel"
                required
                maxLength={15}
                placeholder="Ví dụ: 0912345678 (10 số, bắt đầu số 0)"
                value={values.phone}
                onChange={e => set('phone', e.target.value)}
              />
            </div>
          </>
        )}

        {['login', 'register', 'forgot'].includes(mode) && (
          <div className="field">
            <label htmlFor="auth-email">Email đăng nhập</label>
            <input
              id="auth-email"
              type="email"
              autoComplete="username"
              required
              maxLength={254}
              placeholder="tenban@gmail.com"
              value={values.email}
              onChange={e => set('email', e.target.value)}
            />
          </div>
        )}

        {mode === 'activate-otp' && (
          <>
            <div className="field">
              <label htmlFor="auth-activate-email">Email đăng ký</label>
              <input
                id="auth-activate-email"
                type="email"
                value={values.email}
                readOnly
                disabled
                style={{ background: '#f5f7f5', color: '#555' }}
              />
            </div>

            {devCode && (
              <div style={{ background: '#f0fdf4', border: '1px dashed #86efac', borderRadius: 8, padding: '10px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                <div>
                  <small style={{ display: 'block', color: '#166534', fontWeight: 600 }}>Thử nghiệm / Demo đồ án:</small>
                  <span style={{ fontSize: 13, color: '#14532d' }}>Mã kích hoạt OTP: <strong style={{ letterSpacing: 2, fontSize: 15, fontFamily: 'monospace' }}>{devCode}</strong></span>
                </div>
                <button type="button" className="btn sm" style={{ whiteSpace: 'nowrap' }} onClick={() => set('code', devCode)}>
                  Điền nhanh
                </button>
              </div>
            )}

            <div className="field">
              <label htmlFor="auth-otp-code">Mã kích hoạt OTP 6 số (gửi về email)</label>
              <input
                id="auth-otp-code"
                autoComplete="one-time-code"
                required
                maxLength={12}
                placeholder="Nhập mã 6 chữ số"
                value={values.code}
                onChange={e => set('code', e.target.value.trim())}
                style={{ fontSize: '20px', letterSpacing: '4px', fontWeight: 'bold', textAlign: 'center' }}
              />
              <div className="auth-resend">
                <small>Mã có hiệu lực trong 15 phút.</small>
                <button type="button" className="btn sm" disabled={busy} onClick={handleResend}>
                  Gửi lại mã OTP
                </button>
              </div>
            </div>
          </>
        )}

        {mode === 'reset' && (
          <>
            <div className="field">
              <label htmlFor="auth-reset-email">Email</label>
              <input
                id="auth-reset-email"
                type="email"
                value={values.email}
                readOnly
                disabled
                style={{ background: '#f5f7f5', color: '#555' }}
              />
            </div>

            {devCode && (
              <div style={{ background: '#f0fdf4', border: '1px dashed #86efac', borderRadius: 8, padding: '10px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                <div>
                  <small style={{ display: 'block', color: '#166534', fontWeight: 600 }}>Thử nghiệm / Demo đồ án:</small>
                  <span style={{ fontSize: 13, color: '#14532d' }}>Mã xác nhận: <strong style={{ letterSpacing: 2, fontSize: 15, fontFamily: 'monospace' }}>{devCode}</strong></span>
                </div>
                <button type="button" className="btn sm" style={{ whiteSpace: 'nowrap' }} onClick={() => set('code', devCode)}>
                  Điền nhanh
                </button>
              </div>
            )}

            <div className="field">
              <label htmlFor="auth-code">Mã xác nhận 6 số (gửi về email)</label>
              <input
                id="auth-code"
                autoComplete="one-time-code"
                required
                maxLength={64}
                placeholder="Nhập mã 6 chữ số trong email"
                value={values.code}
                onChange={e => set('code', e.target.value.trim())}
                style={{ fontSize: '18px', letterSpacing: '2px', fontWeight: 'bold' }}
              />
              <div className="auth-resend">
                <small>Mã có hiệu lực trong 15 phút.</small>
                <button type="button" className="btn sm" disabled={busy} onClick={handleResend}>
                  Gửi lại mã
                </button>
              </div>
            </div>
          </>
        )}

        {mode === 'activate' && (
          <div className="field">
            <label htmlFor="auth-token">Mã kích hoạt</label>
            <input
              id="auth-token"
              autoComplete="off"
              required
              placeholder="Dán mã kích hoạt tại đây"
              value={values.token}
              onChange={e => set('token', e.target.value.trim())}
            />
          </div>
        )}

        {!['forgot', 'activate-otp'].includes(mode) && (
          <PasswordField
            id="auth-password"
            label={mode === 'login' ? 'Mật khẩu' : 'Mật khẩu mới'}
            required
            minLength={mode === 'login' ? undefined : 6}
            maxLength={128}
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            placeholder="Nhập mật khẩu của bạn"
            value={values.password}
            onChange={e => set('password', e.target.value)}
            hint={mode !== 'login' ? 'Từ 6 ký tự, tối đa 72 byte UTF-8.' : undefined}
          />
        )}

        {['register', 'reset', 'activate', 'owner-activate'].includes(mode) && (
          <PasswordField
            id="auth-confirm"
            label="Nhập lại mật khẩu"
            required
            minLength={6}
            maxLength={128}
            autoComplete="new-password"
            placeholder="Nhập lại chính xác mật khẩu trên"
            value={values.confirm}
            onChange={e => set('confirm', e.target.value)}
          />
        )}

        {error && <div className="error" role="alert">{error}</div>}

        <button
          className="btn primary auth-submit"
          disabled={busy}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            textAlign: 'center',
            width: '100%',
            minHeight: 46,
            fontSize: 14,
            fontWeight: 700
          }}
        >
          {busy
            ? 'Đang xử lý…'
            : mode === 'login'
            ? 'Đăng nhập'
            : mode === 'register'
            ? 'Tạo tài khoản'
            : mode === 'activate-otp'
            ? 'Xác nhận kích hoạt & Đăng nhập'
            : mode === 'forgot'
            ? 'Gửi mã về email'
            : mode === 'reset'
            ? 'Lưu mật khẩu & Đăng nhập'
            : 'Lưu mật khẩu & tiếp tục'}
        </button>
      </form>

      <div className="auth-links">
        {mode === 'login' ? (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', gap: '10px' }}>
              <Button disabled={busy} onClick={() => switchMode('register')}>
                Chưa có tài khoản? Đăng ký
              </Button>
              <Button disabled={busy} onClick={() => switchMode('forgot')}>
                Quên mật khẩu?
              </Button>
            </div>
            <Button className="sm" disabled={busy} onClick={() => switchMode('activate')}>
              Có mã kích hoạt / vé quầy cấp?
            </Button>
            {ownerSetupAvailable && (
              <Button disabled={busy} onClick={() => switchMode('owner-activate')}>
                Thiết lập tài khoản của bạn
              </Button>
            )}
          </>
        ) : mode === 'activate-otp' ? (
          <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', gap: '10px' }}>
            <Button disabled={busy} onClick={() => switchMode('login')}>
              Đã kích hoạt? Đăng nhập
            </Button>
            <Button disabled={busy} onClick={() => switchMode('register')}>
              Đổi email / Đăng ký lại
            </Button>
          </div>
        ) : (
          <Button disabled={busy} onClick={() => switchMode('login')}>
            Đã có tài khoản? Đăng nhập
          </Button>
        )}
      </div>

      {mode === 'activate' && (
        <p className="auth-hint">
          Nếu chưa có mã, hãy bấm <b>"Quên mật khẩu"</b> để nhận mã tự động qua email hoặc liên hệ quầy lễ tân để được cấp mã trực tiếp.
        </p>
      )}
    </Modal>
  );
}
