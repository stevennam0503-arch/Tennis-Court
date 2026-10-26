import React, { useState } from 'react';
import { api } from '../services/api';
import { useGuest, Action } from './context';

export default function GuestAuth({ onSuccess }) {
  const { t } = useGuest();
  const [mode, setMode] = useState('login');
  const [values, setValues] = useState({ email: '', password: '', name: '', phone: '', confirm: '', token: '', code: '' });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [devCode, setDevCode] = useState('');
  const [busy, setBusy] = useState(false);

  const set = (k, v) => setValues(x => ({ ...x, [k]: v }));

  const handleResend = async () => {
    if (busy || !values.email.trim()) return;
    setError('');
    setSuccess('');
    setBusy(true);
    try {
      const res = await api('/auth/resend-activation', 'POST', { email: values.email.trim() });
      setSuccess(t('Đã gửi lại mã kích hoạt mới đến email của bạn.'));
      if (res.devCode) {
        setDevCode(res.devCode);
        set('code', res.devCode);
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const submit = async e => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (mode === 'register') {
      const p = values.phone.trim().replace(/\s+/g, '');
      if (!/^0[0-9]{9}$/.test(p)) {
        return setError(t('Số điện thoại không hợp lệ (cần 10 chữ số, bắt đầu bằng 0).'));
      }
    }

    if (!['login', 'activate-otp'].includes(mode) && values.password !== values.confirm) {
      return setError(t('Hai mật khẩu chưa trùng nhau.'));
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
          if (res.email) set('email', res.email);
          setSuccess(res.message || t('Mã kích hoạt OTP 6 số đã được gửi tới email.'));
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

      const res = await api('/auth/' + mode, 'POST', values);
      if (res.requiresActivation) {
        setMode('activate-otp');
        if (res.email) set('email', res.email);
        setSuccess(res.message || t('Tài khoản chưa kích hoạt. Vui lòng nhập mã OTP.'));
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
    <form onSubmit={submit} className="gx-form">
      <h2>
        {t(
          mode === 'login'
            ? 'Đăng nhập'
            : mode === 'register'
            ? 'Tạo tài khoản'
            : mode === 'activate-otp'
            ? 'Kích hoạt tài khoản'
            : 'Đặt lại mật khẩu'
        )}
      </h2>

      {success && <div className="gx-notice" role="status" style={{ marginBottom: 12 }}>{success}</div>}

      {mode === 'register' && (
        <>
          <label>
            {t('Họ và tên')}
            <input required maxLength={100} autoComplete="name" value={values.name} onChange={e => set('name', e.target.value)} />
          </label>
          <label>
            {t('Số điện thoại liên hệ')}
            <input
              type="tel"
              required
              maxLength={15}
              placeholder="0912345678"
              value={values.phone}
              onChange={e => set('phone', e.target.value)}
            />
          </label>
        </>
      )}

      {mode === 'activate-otp' ? (
        <>
          <label>
            Email
            <input type="email" value={values.email} readOnly disabled style={{ background: '#f5f7f5', color: '#555' }} />
          </label>

          {devCode && (
            <div style={{ background: '#f0fdf4', border: '1px dashed #86efac', borderRadius: 8, padding: '10px 14px', margin: '8px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
              <div>
                <small style={{ display: 'block', color: '#166534', fontWeight: 600 }}>Thử nghiệm / Demo:</small>
                <span style={{ fontSize: 13, color: '#14532d' }}>Mã OTP: <strong style={{ letterSpacing: 2, fontSize: 15, fontFamily: 'monospace' }}>{devCode}</strong></span>
              </div>
              <button type="button" className="btn sm" style={{ whiteSpace: 'nowrap' }} onClick={() => set('code', devCode)}>
                {t('Điền nhanh')}
              </button>
            </div>
          )}

          <label>
            {t('Mã kích hoạt OTP 6 số (gửi về email)')}
            <input
              required
              maxLength={12}
              placeholder="123456"
              value={values.code}
              onChange={e => set('code', e.target.value.trim())}
              style={{ fontSize: '20px', letterSpacing: '4px', textAlign: 'center', fontWeight: 'bold' }}
            />
          </label>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '4px 0 12px' }}>
            <small style={{ color: '#637269' }}>{t('Hiệu lực trong 15 phút.')}</small>
            <button type="button" className="btn sm" disabled={busy} onClick={handleResend} style={{ background: 'none', border: 'none', color: '#173c32', textDecoration: 'underline', cursor: 'pointer', fontSize: 12 }}>
              {t('Gửi lại mã OTP')}
            </button>
          </div>
        </>
      ) : mode === 'activate' ? (
        <label>
          {t('Mã kích hoạt')}
          <input required value={values.token} onChange={e => set('token', e.target.value)} />
        </label>
      ) : (
        <label>
          Email
          <input type="email" autoComplete="username" required maxLength={254} value={values.email} onChange={e => set('email', e.target.value)} />
        </label>
      )}

      {mode !== 'activate-otp' && (
        <label>
          {t('Mật khẩu')}
          <input
            type="password"
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            required
            minLength={mode === 'login' ? undefined : 8}
            maxLength={128}
            value={values.password}
            onChange={e => set('password', e.target.value)}
          />
        </label>
      )}

      {!['login', 'activate-otp'].includes(mode) && (
        <label>
          {t('Nhập lại mật khẩu')}
          <input type="password" autoComplete="new-password" required value={values.confirm} onChange={e => set('confirm', e.target.value)} />
        </label>
      )}

      {error && <div className="gx-error" role="alert">{t(error)}</div>}

      <Action type="submit" disabled={busy}>
        {t(
          busy
            ? 'Đang xử lý…'
            : mode === 'login'
            ? 'Đăng nhập'
            : mode === 'register'
            ? 'Tạo tài khoản'
            : mode === 'activate-otp'
            ? 'Xác nhận kích hoạt'
            : 'Lưu mật khẩu & tiếp tục'
        )}
      </Action>

      <div className="gx-actions">
        {mode === 'activate-otp' ? (
          <>
            <button type="button" onClick={() => { setMode('login'); setError(''); setSuccess(''); }}>
              {t('Đã kích hoạt? Đăng nhập')}
            </button>
            <button type="button" onClick={() => { setMode('register'); setError(''); setSuccess(''); }}>
              {t('Đăng ký lại')}
            </button>
          </>
        ) : (
          ['login', 'register', 'activate']
            .filter(m => m !== mode)
            .map(m => (
              <button
                type="button"
                key={m}
                onClick={() => {
                  setMode(m);
                  setError('');
                  setSuccess('');
                }}
              >
                {t(m === 'login' ? 'Đăng nhập' : m === 'register' ? 'Đăng ký' : 'Quên mật khẩu / Có mã kích hoạt')}
              </button>
            ))
        )}
      </div>

      {mode === 'activate' && <p>{t('Liên hệ quầy để xác minh và nhận mã đặt lại mật khẩu.')}</p>}
    </form>
  );
}
