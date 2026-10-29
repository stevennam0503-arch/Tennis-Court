import React, { useState, useEffect } from 'react';
import { Eye, EyeOff, User, Lock, Mail, Phone, KeyRound } from 'lucide-react';
import { api } from '../services/api';
import { useGuest } from './context';

export default function GuestAuth({ onSuccess, initialMode = 'login', context = null }) {
  const { t } = useGuest();
  const [mode, setMode] = useState(initialMode || 'login');

  useEffect(() => {
    if (initialMode) setMode(initialMode);
  }, [initialMode]);
  const [values, setValues] = useState({
    email: '',
    password: '',
    name: '',
    phone: '',
    confirm: '',
    token: '',
    code: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
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

  const isBookingFlow = context?.from === 'booking';

  const titles = {
    login: isBookingFlow ? t('Đăng nhập để đặt sân') : t('Đăng nhập Courtly'),
    register: isBookingFlow ? t('Tạo tài khoản & Nhận quà') : t('Tạo tài khoản mới'),
    'activate-otp': t('Kích hoạt tài khoản'),
    activate: t('Đặt lại mật khẩu')
  };

  const subtitles = {
    login: isBookingFlow
      ? t('Đăng nhập để giữ chỗ sân theo thời gian thực và tự động áp dụng ưu đãi.')
      : t('Chào mừng trở lại! Đăng nhập để đặt sân và quản lý lịch thi đấu.'),
    register: isBookingFlow
      ? t('Đăng ký nhận ngay Voucher WELCOME 50.000₫ và giữ chỗ sân tức thì.')
      : t('Đăng ký nhanh chóng để giữ chỗ sân trực tuyến và nhận quà chào mừng 50k.'),
    'activate-otp': t(`Mã OTP 6 số đã gửi tới ${values.email || 'email của bạn'}.`),
    activate: t('Nhập mã kích hoạt một lần do quản trị viên cấp để thiết lập mật khẩu.')
  };

  return (
    <div className="gx-auth-card" style={{ maxWidth: 440, margin: '0 auto', width: '100%' }}>

      {/* Header section with icon & centered title */}
      <div style={{ textAlign: 'center', marginBottom: 20 }}>
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 48,
            height: 48,
            borderRadius: '50%',
            background: 'rgba(23, 60, 50, 0.08)',
            color: '#173c32',
            marginBottom: 10
          }}
        >
          {mode === 'login' ? (
            <Lock size={22} />
          ) : mode === 'register' ? (
            <User size={22} />
          ) : mode === 'activate-otp' ? (
            <Mail size={22} />
          ) : (
            <KeyRound size={22} />
          )}
        </div>
        <h2 style={{ fontSize: 22, fontWeight: 700, margin: '0 0 6px', color: '#173c32', letterSpacing: '-0.5px' }}>
          {titles[mode] || t('Tài khoản')}
        </h2>
        <p style={{ margin: 0, fontSize: 13, color: '#52655a', lineHeight: 1.5 }}>
          {subtitles[mode]}
        </p>
      </div>

      <form onSubmit={submit} className="gx-form" style={{ display: 'grid', gap: 14 }}>
        {mode === 'register' && (
          <div
            style={{
              background: '#f0fdf4',
              border: '1px solid #bbf7d0',
              borderRadius: 8,
              padding: '10px 14px',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              fontSize: 12.5,
              color: '#166534',
              lineHeight: 1.4
            }}
          >
            <span style={{ fontSize: 18 }}>🎁</span>
            <span>
              <strong>{t('Quà chào mừng:')}</strong> {t('Đăng ký ngay để nhận Voucher')} <b style={{ background: '#def46a', padding: '1px 5px', borderRadius: 4, color: '#173c32' }}>WELCOME</b> {t('giảm 50.000₫ cho lần đặt sân đầu tiên!')}
            </span>
          </div>
        )}
        {success && (
          <div
            className="gx-notice"
            role="status"
            style={{
              padding: '11px 14px',
              borderRadius: 8,
              background: '#ecfdf5',
              border: '1px solid #a7f3d0',
              color: '#065f46',
              fontSize: 13
            }}
          >
            {success}
          </div>
        )}

        {mode === 'register' && (
          <>
            <label style={{ display: 'grid', gap: 6, fontSize: 13, fontWeight: 500, color: '#173c32' }}>
              {t('Họ và tên')}
              <input
                required
                maxLength={100}
                autoComplete="name"
                placeholder="Ví dụ: Nguyễn Văn A"
                value={values.name}
                onChange={e => set('name', e.target.value)}
                style={{ borderRadius: 8, border: '1px solid #cbd5e1', padding: '10px 14px', fontSize: 14 }}
              />
            </label>
            <label style={{ display: 'grid', gap: 6, fontSize: 13, fontWeight: 500, color: '#173c32' }}>
              {t('Số điện thoại liên hệ')}
              <input
                type="tel"
                required
                maxLength={15}
                placeholder="0912345678 (10 chữ số)"
                value={values.phone}
                onChange={e => set('phone', e.target.value)}
                style={{ borderRadius: 8, border: '1px solid #cbd5e1', padding: '10px 14px', fontSize: 14 }}
              />
            </label>
          </>
        )}

        {mode === 'activate-otp' ? (
          <>
            <label style={{ display: 'grid', gap: 6, fontSize: 13, fontWeight: 500, color: '#173c32' }}>
              Email
              <input
                type="email"
                value={values.email}
                readOnly
                disabled
                style={{ background: '#f1f5f9', color: '#64748b', borderRadius: 8, border: '1px solid #cbd5e1', padding: '10px 14px' }}
              />
            </label>

            {devCode && (
              <div
                style={{
                  background: '#f0fdf4',
                  border: '1px dashed #86efac',
                  borderRadius: 8,
                  padding: '10px 14px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 10
                }}
              >
                <div>
                  <small style={{ display: 'block', color: '#166534', fontWeight: 600 }}>Thử nghiệm / Demo:</small>
                  <span style={{ fontSize: 13, color: '#14532d' }}>
                    Mã OTP: <strong style={{ letterSpacing: 2, fontSize: 15, fontFamily: 'monospace' }}>{devCode}</strong>
                  </span>
                </div>
                <button
                  type="button"
                  className="btn sm"
                  style={{
                    whiteSpace: 'nowrap',
                    background: '#166534',
                    color: '#fff',
                    border: 'none',
                    padding: '6px 12px',
                    borderRadius: 6,
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                  onClick={() => set('code', devCode)}
                >
                  {t('Điền nhanh')}
                </button>
              </div>
            )}

            <label style={{ display: 'grid', gap: 6, fontSize: 13, fontWeight: 500, color: '#173c32' }}>
              {t('Mã kích hoạt OTP 6 số')}
              <input
                required
                maxLength={12}
                placeholder="123456"
                value={values.code}
                onChange={e => set('code', e.target.value.trim())}
                style={{
                  fontSize: 22,
                  letterSpacing: '6px',
                  textAlign: 'center',
                  fontWeight: 'bold',
                  borderRadius: 8,
                  border: '2px solid #173c32',
                  padding: '10px 14px',
                  background: '#fdfdfb'
                }}
              />
            </label>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '2px 0 6px' }}>
              <small style={{ color: '#637269' }}>{t('Hiệu lực trong 15 phút.')}</small>
              <button
                type="button"
                disabled={busy}
                onClick={handleResend}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#173c32',
                  textDecoration: 'underline',
                  cursor: busy ? 'not-allowed' : 'pointer',
                  fontSize: 12.5,
                  fontWeight: 600,
                  padding: 0
                }}
              >
                {t('Gửi lại mã OTP')}
              </button>
            </div>
          </>
        ) : mode === 'activate' ? (
          <label style={{ display: 'grid', gap: 6, fontSize: 13, fontWeight: 500, color: '#173c32' }}>
            {t('Mã kích hoạt')}
            <input
              required
              placeholder="Dán mã kích hoạt tại đây"
              value={values.token}
              onChange={e => set('token', e.target.value)}
              style={{ borderRadius: 8, border: '1px solid #cbd5e1', padding: '10px 14px', fontSize: 14 }}
            />
          </label>
        ) : (
          <label style={{ display: 'grid', gap: 6, fontSize: 13, fontWeight: 500, color: '#173c32' }}>
            Email
            <input
              type="email"
              autoComplete="username"
              required
              maxLength={254}
              placeholder="tenban@gmail.com"
              value={values.email}
              onChange={e => set('email', e.target.value)}
              style={{ borderRadius: 8, border: '1px solid #cbd5e1', padding: '10px 14px', fontSize: 14 }}
            />
          </label>
        )}

        {mode !== 'activate-otp' && (
          <label style={{ display: 'grid', gap: 6, fontSize: 13, fontWeight: 500, color: '#173c32' }}>
            {t('Mật khẩu')}
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <input
                type={showPassword ? 'text' : 'password'}
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                required
                minLength={mode === 'login' ? undefined : 6}
                maxLength={128}
                placeholder="Nhập mật khẩu của bạn"
                value={values.password}
                onChange={e => set('password', e.target.value)}
                style={{
                  width: '100%',
                  borderRadius: 8,
                  border: '1px solid #cbd5e1',
                  padding: '10px 42px 10px 14px',
                  fontSize: 14
                }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(s => !s)}
                title={showPassword ? t('Ẩn mật khẩu') : t('Hiện mật khẩu')}
                style={{
                  position: 'absolute',
                  right: 10,
                  background: 'none',
                  border: 'none',
                  color: '#637269',
                  cursor: 'pointer',
                  padding: 4,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
                tabIndex={-1}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </label>
        )}

        {!['login', 'activate-otp'].includes(mode) && (
          <label style={{ display: 'grid', gap: 6, fontSize: 13, fontWeight: 500, color: '#173c32' }}>
            {t('Nhập lại mật khẩu')}
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <input
                type={showConfirm ? 'text' : 'password'}
                autoComplete="new-password"
                required
                placeholder="Nhập lại chính xác mật khẩu"
                value={values.confirm}
                onChange={e => set('confirm', e.target.value)}
                style={{
                  width: '100%',
                  borderRadius: 8,
                  border: '1px solid #cbd5e1',
                  padding: '10px 42px 10px 14px',
                  fontSize: 14
                }}
              />
              <button
                type="button"
                onClick={() => setShowConfirm(s => !s)}
                title={showConfirm ? t('Ẩn mật khẩu') : t('Hiện mật khẩu')}
                style={{
                  position: 'absolute',
                  right: 10,
                  background: 'none',
                  border: 'none',
                  color: '#637269',
                  cursor: 'pointer',
                  padding: 4,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
                tabIndex={-1}
              >
                {showConfirm ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </label>
        )}

        {error && (
          <div
            className="gx-error"
            role="alert"
            style={{
              padding: '11px 14px',
              borderRadius: 8,
              background: '#fef2f2',
              border: '1px solid #fecaca',
              color: '#991b1b',
              fontSize: 13
            }}
          >
            {t(error)}
          </div>
        )}

        {/* Centered Submit Button */}
        <button
          type="submit"
          disabled={busy}
          className="ct-primary gx-auth-submit-btn"
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            textAlign: 'center',
            padding: '13px 20px',
            borderRadius: 8,
            fontSize: 15,
            fontWeight: 700,
            minHeight: 48,
            cursor: busy ? 'not-allowed' : 'pointer',
            background: '#173c32',
            color: '#ffffff',
            border: 'none',
            boxShadow: '0 2px 10px rgba(23,60,50,0.18)',
            marginTop: 6
          }}
        >
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
        </button>
      </form>

      {/* Mode navigation footer */}
      <div
        style={{
          marginTop: 22,
          paddingTop: 18,
          borderTop: '1px solid #e2e8f0',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 10
        }}
      >
        {mode === 'login' ? (
          <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', fontSize: 13 }}>
            <button
              type="button"
              onClick={() => {
                setMode('register');
                setError('');
                setSuccess('');
              }}
              style={{
                background: 'none',
                border: 'none',
                color: '#173c32',
                fontWeight: 600,
                cursor: 'pointer',
                padding: '4px 0',
                textDecoration: 'underline'
              }}
            >
              {t('Chưa có tài khoản? Đăng ký')}
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('activate');
                setError('');
                setSuccess('');
              }}
              style={{
                background: 'none',
                border: 'none',
                color: '#64748b',
                cursor: 'pointer',
                padding: '4px 0',
                textDecoration: 'underline'
              }}
            >
              {t('Quên mật khẩu / Có mã?')}
            </button>
          </div>
        ) : mode === 'register' ? (
          <div style={{ textAlign: 'center', fontSize: 13 }}>
            <span style={{ color: '#64748b' }}>{t('Đã có tài khoản?')} </span>
            <button
              type="button"
              onClick={() => {
                setMode('login');
                setError('');
                setSuccess('');
              }}
              style={{
                background: 'none',
                border: 'none',
                color: '#173c32',
                fontWeight: 700,
                cursor: 'pointer',
                padding: '4px 6px',
                textDecoration: 'underline'
              }}
            >
              {t('Đăng nhập')}
            </button>
          </div>
        ) : mode === 'activate-otp' ? (
          <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', fontSize: 13 }}>
            <button
              type="button"
              onClick={() => {
                setMode('login');
                setError('');
                setSuccess('');
              }}
              style={{
                background: 'none',
                border: 'none',
                color: '#173c32',
                fontWeight: 600,
                cursor: 'pointer',
                textDecoration: 'underline'
              }}
            >
              {t('Đã kích hoạt? Đăng nhập')}
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('register');
                setError('');
                setSuccess('');
              }}
              style={{
                background: 'none',
                border: 'none',
                color: '#64748b',
                cursor: 'pointer',
                textDecoration: 'underline'
              }}
            >
              {t('Đăng ký lại')}
            </button>
          </div>
        ) : (
          <div style={{ textAlign: 'center', fontSize: 13 }}>
            <button
              type="button"
              onClick={() => {
                setMode('login');
                setError('');
                setSuccess('');
              }}
              style={{
                background: 'none',
                border: 'none',
                color: '#173c32',
                fontWeight: 600,
                cursor: 'pointer',
                textDecoration: 'underline'
              }}
            >
              ← {t('Quay lại Đăng nhập')}
            </button>
          </div>
        )}

        {mode === 'activate' && (
          <p style={{ margin: '8px 0 0', fontSize: 12, color: '#64748b', textAlign: 'center' }}>
            {t('Liên hệ quầy lễ tân để xác minh và nhận mã đặt lại mật khẩu trực tiếp.')}
          </p>
        )}
      </div>
    </div>
  );
}
