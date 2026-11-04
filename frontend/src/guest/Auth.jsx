import React, { useState, useEffect } from 'react';
import { Eye, EyeOff, User, Lock, Mail, Phone, KeyRound, CheckCircle2, ArrowRight } from 'lucide-react';
import { api } from '../services/api';
import { useGuest } from './context';
import { isValidPhone, formatPhoneDisplay, normalizePhone } from '../utils/phone';

export default function GuestAuth({ onSuccess, initialMode = 'login', context = null }) {
  const { t } = useGuest();
  const [mode, setMode] = useState(initialMode || 'login');

  useEffect(() => {
    if (initialMode) setMode(initialMode);
  }, [initialMode]);

  // Luồng đăng ký 3 bước bằng SĐT: 1 (phone) -> 2 (otp) -> 3 (profile)
  const [regStep, setRegStep] = useState(1);
  const [phoneToken, setPhoneToken] = useState('');
  const [countdown, setCountdown] = useState(0);

  // Đăng nhập: 'password' hoặc 'otp'
  const [loginMethod, setLoginMethod] = useState('password');

  const [values, setValues] = useState({
    emailOrPhone: '',
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

  // Đếm ngược 60 giây gửi lại mã OTP
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(c => c - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  // Gửi OTP qua SMS đăng ký
  const handleSendRegisterOtp = async () => {
    setError('');
    setSuccess('');
    if (!values.phone || !isValidPhone(values.phone)) {
      return setError(t('Vui lòng nhập số điện thoại Việt Nam hợp lệ (10 chữ số, ví dụ 0912 345 678).'));
    }
    setBusy(true);
    try {
      const res = await api('/auth/phone/send-otp', 'POST', {
        phone: values.phone.trim(),
        purpose: 'REGISTER'
      });
      setSuccess(res.message || t('Đã gửi mã xác thực OTP qua SMS.'));
      setCountdown(res.cooldownSeconds || 60);
      if (res.devCode) {
        setDevCode(res.devCode);
        set('code', res.devCode);
      }
      setRegStep(2);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  // Xác thực OTP đăng ký -> nhận phoneToken
  const handleVerifyRegisterOtp = async () => {
    setError('');
    setSuccess('');
    if (!values.code || values.code.trim().length < 6) {
      return setError(t('Vui lòng nhập đầy đủ mã OTP 6 số.'));
    }
    setBusy(true);
    try {
      const res = await api('/auth/phone/verify', 'POST', {
        phone: values.phone.trim(),
        code: values.code.trim(),
        purpose: 'REGISTER'
      });
      setPhoneToken(res.phoneToken);
      setSuccess(t('Xác thực số điện thoại thành công!'));
      setDevCode('');
      setRegStep(3);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  // Gửi lại OTP SMS
  const handleResendPhoneOtp = async (purpose = 'REGISTER') => {
    if (countdown > 0 || busy) return;
    setError('');
    setSuccess('');
    setBusy(true);
    try {
      const targetPhone = mode === 'register' ? values.phone : values.emailOrPhone;
      const res = await api('/auth/phone/send-otp', 'POST', {
        phone: targetPhone.trim(),
        purpose
      });
      setSuccess(t('Đã gửi lại mã OTP mới qua SMS.'));
      setCountdown(res.cooldownSeconds || 60);
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

  // Gửi OTP SMS để đăng nhập
  const handleSendLoginOtp = async () => {
    setError('');
    setSuccess('');
    if (!values.emailOrPhone || !isValidPhone(values.emailOrPhone)) {
      return setError(t('Vui lòng nhập số điện thoại Việt Nam hợp lệ (10 chữ số).'));
    }
    setBusy(true);
    try {
      const res = await api('/auth/phone/send-otp', 'POST', {
        phone: values.emailOrPhone.trim(),
        purpose: 'LOGIN'
      });
      setSuccess(res.message || t('Đã gửi mã đăng nhập OTP qua SMS.'));
      setCountdown(res.cooldownSeconds || 60);
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

    // Xử lý theo từng mode
    if (mode === 'register') {
      if (regStep === 1) {
        return handleSendRegisterOtp();
      }
      if (regStep === 2) {
        return handleVerifyRegisterOtp();
      }
      if (regStep === 3) {
        if (!values.name?.trim()) {
          return setError(t('Vui lòng nhập họ và tên.'));
        }
        if (!values.password || values.password.length < 6) {
          return setError(t('Mật khẩu cần tối thiểu 6 ký tự.'));
        }
        if (values.password !== values.confirm) {
          return setError(t('Hai mật khẩu chưa trùng nhau.'));
        }
        setBusy(true);
        try {
          const res = await api('/auth/register', 'POST', {
            phoneToken,
            name: values.name.trim(),
            password: values.password,
            email: values.email?.trim() || null
          });
          await onSuccess(res);
        } catch (err) {
          setError(err.message);
        } finally {
          setBusy(false);
        }
        return;
      }
    }

    if (mode === 'login') {
      setBusy(true);
      try {
        if (loginMethod === 'otp') {
          if (!values.code) {
            setBusy(false);
            return setError(t('Vui lòng nhập mã OTP để đăng nhập.'));
          }
          const res = await api('/auth/phone/login-otp', 'POST', {
            phone: values.emailOrPhone.trim(),
            code: values.code.trim()
          });
          await onSuccess(res);
          return;
        }

        // Đăng nhập bằng mật khẩu (nhận cả email hoặc số điện thoại)
        const res = await api('/auth/login', 'POST', {
          emailOrPhone: values.emailOrPhone?.trim(),
          email: values.emailOrPhone?.trim(),
          password: values.password
        });
        await onSuccess(res);
      } catch (err) {
        setError(err.message);
      } finally {
        setBusy(false);
      }
      return;
    }

    if (mode === 'forgot') {
      setBusy(true);
      try {
        const res = await api('/auth/forgot-password', 'POST', {
          emailOrPhone: values.emailOrPhone?.trim(),
          phone: values.emailOrPhone?.trim(),
          email: values.emailOrPhone?.trim()
        });
        setSuccess(res.message);
        if (res.devCode) {
          setDevCode(res.devCode);
          set('code', res.devCode);
        }
        setMode('reset-password');
      } catch (err) {
        setError(err.message);
      } finally {
        setBusy(false);
      }
      return;
    }

    if (mode === 'reset-password') {
      if (values.password !== values.confirm) {
        return setError(t('Hai mật khẩu chưa trùng nhau.'));
      }
      setBusy(true);
      try {
        const res = await api('/auth/reset-password', 'POST', {
          phone: values.emailOrPhone?.trim(),
          email: values.emailOrPhone?.trim(),
          code: values.code.trim(),
          password: values.password
        });
        setSuccess(t('Đổi mật khẩu thành công!'));
        await onSuccess(res);
      } catch (err) {
        setError(err.message);
      } finally {
        setBusy(false);
      }
      return;
    }
  };

  const isBookingFlow = context?.from === 'booking';

  const titles = {
    login: isBookingFlow ? t('Đăng nhập để đặt sân') : t('Đăng nhập Courtly'),
    register: isBookingFlow ? t('Đăng ký & Nhận quà') : t('Đăng ký tài khoản'),
    forgot: t('Quên mật khẩu'),
    'reset-password': t('Đặt lại mật khẩu mới')
  };

  const subtitles = {
    login: isBookingFlow
      ? t('Đăng nhập để giữ chỗ sân theo thời gian thực và tự động áp dụng ưu đãi.')
      : t('Chào mừng trở lại! Đăng nhập để đặt sân và quản lý lịch thi đấu.'),
    register: isBookingFlow
      ? t('Đăng ký bằng SĐT nhận ngay Voucher WELCOME 50.000₫ và giữ chỗ sân tức thì.')
      : t('Đăng ký bằng số điện thoại xác thực OTP nhanh chóng và tiện lợi.'),
    forgot: t('Nhập email hoặc số điện thoại đã đăng ký để nhận mã khôi phục.'),
    'reset-password': t('Nhập mã xác nhận OTP và thiết lập mật khẩu mới.')
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
            <Phone size={22} />
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

        {/* Thông báo thành công / lỗi */}
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

        {error && (
          <div
            className="gx-notice error"
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
            {error}
          </div>
        )}

        {/* Khung Test / Demo devCode */}
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
              <small style={{ display: 'block', color: '#166534', fontWeight: 600 }}>{t('Thử nghiệm / Demo SMS OTP:')}</small>
              <span style={{ fontSize: 13, color: '#14532d' }}>
                {t('Mã OTP:')} <strong style={{ letterSpacing: 2, fontSize: 15, fontFamily: 'monospace' }}>{devCode}</strong>
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

        {/* ===================== MODE LOGIN ===================== */}
        {mode === 'login' && (
          <>
            {/* Toggle phương thức đăng nhập */}
            <div style={{ display: 'flex', background: '#f1f5f9', borderRadius: 8, padding: 3, marginBottom: 4 }}>
              <button
                type="button"
                onClick={() => setLoginMethod('password')}
                style={{
                  flex: 1,
                  padding: '7px 0',
                  fontSize: 12.5,
                  fontWeight: loginMethod === 'password' ? 600 : 400,
                  background: loginMethod === 'password' ? '#fff' : 'transparent',
                  color: loginMethod === 'password' ? '#173c32' : '#64748b',
                  border: 'none',
                  borderRadius: 6,
                  cursor: 'pointer',
                  boxShadow: loginMethod === 'password' ? '0 1px 2px rgba(0,0,0,0.06)' : 'none'
                }}
              >
                {t('Mật khẩu')}
              </button>
              <button
                type="button"
                onClick={() => setLoginMethod('otp')}
                style={{
                  flex: 1,
                  padding: '7px 0',
                  fontSize: 12.5,
                  fontWeight: loginMethod === 'otp' ? 600 : 400,
                  background: loginMethod === 'otp' ? '#fff' : 'transparent',
                  color: loginMethod === 'otp' ? '#173c32' : '#64748b',
                  border: 'none',
                  borderRadius: 6,
                  cursor: 'pointer',
                  boxShadow: loginMethod === 'otp' ? '0 1px 2px rgba(0,0,0,0.06)' : 'none'
                }}
              >
                {t('Mã OTP SMS')}
              </button>
            </div>

            <label style={{ display: 'grid', gap: 6, fontSize: 13, fontWeight: 500, color: '#173c32' }}>
              {loginMethod === 'otp' ? t('Số điện thoại') : t('Email hoặc số điện thoại')}
              <input
                required
                autoComplete="username"
                placeholder={loginMethod === 'otp' ? '0912 345 678' : 'email@example.com hoặc 0912 345 678'}
                value={values.emailOrPhone}
                onChange={e => set('emailOrPhone', e.target.value)}
                style={{ borderRadius: 8, border: '1px solid #cbd5e1', padding: '10px 14px', fontSize: 14 }}
              />
            </label>

            {loginMethod === 'password' ? (
              <label style={{ display: 'grid', gap: 6, fontSize: 13, fontWeight: 500, color: '#173c32' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>{t('Mật khẩu')}</span>
                  <button
                    type="button"
                    onClick={() => setMode('forgot')}
                    style={{ background: 'none', border: 'none', color: '#173c32', fontSize: 12, cursor: 'pointer', textDecoration: 'underline' }}
                  >
                    {t('Quên mật khẩu?')}
                  </button>
                </div>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    autoComplete="current-password"
                    placeholder="••••••••"
                    value={values.password}
                    onChange={e => set('password', e.target.value)}
                    style={{ width: '100%', borderRadius: 8, border: '1px solid #cbd5e1', padding: '10px 40px 10px 14px', fontSize: 14, boxSizing: 'border-box' }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#64748b', cursor: 'pointer' }}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </label>
            ) : (
              <>
                <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
                  <label style={{ flex: 1, display: 'grid', gap: 6, fontSize: 13, fontWeight: 500, color: '#173c32' }}>
                    {t('Mã OTP 6 số')}
                    <input
                      required
                      maxLength={6}
                      placeholder="123456"
                      value={values.code}
                      onChange={e => set('code', e.target.value.trim())}
                      style={{ fontSize: 18, letterSpacing: '4px', textAlign: 'center', borderRadius: 8, border: '1px solid #cbd5e1', padding: '9px 12px' }}
                    />
                  </label>
                  <button
                    type="button"
                    disabled={busy || countdown > 0}
                    onClick={handleSendLoginOtp}
                    style={{
                      padding: '10px 14px',
                      background: countdown > 0 ? '#94a3b8' : '#173c32',
                      color: '#fff',
                      border: 'none',
                      borderRadius: 8,
                      fontSize: 12.5,
                      fontWeight: 600,
                      cursor: countdown > 0 ? 'not-allowed' : 'pointer',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    {countdown > 0 ? `${countdown}s` : t('Nhận mã OTP')}
                  </button>
                </div>
              </>
            )}

            <button
              type="submit"
              disabled={busy}
              style={{
                marginTop: 6,
                padding: '11px',
                borderRadius: 8,
                background: '#173c32',
                color: '#def46a',
                border: 'none',
                fontWeight: 700,
                fontSize: 14,
                cursor: busy ? 'not-allowed' : 'pointer'
              }}
            >
              {busy ? t('Đang xử lý...') : t('Đăng nhập')}
            </button>

            <div style={{ textAlign: 'center', fontSize: 13, color: '#64748b', marginTop: 10 }}>
              {t('Chưa có tài khoản?')} {' '}
              <button
                type="button"
                onClick={() => { setMode('register'); setRegStep(1); }}
                style={{ background: 'none', border: 'none', color: '#173c32', fontWeight: 600, cursor: 'pointer', textDecoration: 'underline' }}
              >
                {t('Đăng ký bằng SĐT')}
              </button>
            </div>
          </>
        )}

        {/* ===================== MODE REGISTER (3 BƯỚC) ===================== */}
        {mode === 'register' && (
          <>
            {/* Tiến trình 3 bước */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, padding: '0 10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 22, height: 22, borderRadius: '50%', background: regStep >= 1 ? '#173c32' : '#cbd5e1', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700 }}>1</span>
                <span style={{ fontSize: 12, fontWeight: regStep === 1 ? 600 : 400, color: regStep === 1 ? '#173c32' : '#64748b' }}>{t('Số điện thoại')}</span>
              </div>
              <span style={{ width: 20, height: 1, background: '#cbd5e1' }} />
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 22, height: 22, borderRadius: '50%', background: regStep >= 2 ? '#173c32' : '#cbd5e1', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700 }}>2</span>
                <span style={{ fontSize: 12, fontWeight: regStep === 2 ? 600 : 400, color: regStep === 2 ? '#173c32' : '#64748b' }}>{t('Xác thực OTP')}</span>
              </div>
              <span style={{ width: 20, height: 1, background: '#cbd5e1' }} />
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 22, height: 22, borderRadius: '50%', background: regStep >= 3 ? '#173c32' : '#cbd5e1', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700 }}>3</span>
                <span style={{ fontSize: 12, fontWeight: regStep === 3 ? 600 : 400, color: regStep === 3 ? '#173c32' : '#64748b' }}>{t('Tạo mật khẩu')}</span>
              </div>
            </div>

            {/* Bước 1: Nhập Số điện thoại */}
            {regStep === 1 && (
              <>
                <label style={{ display: 'grid', gap: 6, fontSize: 13, fontWeight: 500, color: '#173c32' }}>
                  {t('Số điện thoại của bạn')}
                  <input
                    type="tel"
                    required
                    maxLength={15}
                    placeholder="0912 345 678"
                    value={values.phone}
                    onChange={e => set('phone', e.target.value)}
                    style={{ borderRadius: 8, border: '1px solid #cbd5e1', padding: '10px 14px', fontSize: 15 }}
                  />
                  <small style={{ color: '#64748b' }}>{t('Mã OTP xác thực sẽ được gửi qua tin nhắn SMS tới số này.')}</small>
                </label>

                <button
                  type="submit"
                  disabled={busy}
                  style={{
                    marginTop: 6,
                    padding: '11px',
                    borderRadius: 8,
                    background: '#173c32',
                    color: '#def46a',
                    border: 'none',
                    fontWeight: 700,
                    fontSize: 14,
                    cursor: busy ? 'not-allowed' : 'pointer'
                  }}
                >
                  {busy ? t('Đang gửi...') : t('Tiếp tục / Nhận mã OTP')}
                </button>
              </>
            )}

            {/* Bước 2: Nhập mã OTP SMS */}
            {regStep === 2 && (
              <>
                <div style={{ fontSize: 13, color: '#334155', background: '#f8fafc', padding: 10, borderRadius: 8 }}>
                  {t('Đang xác thực cho số:')} <strong>{formatPhoneDisplay(values.phone)}</strong>
                  {' · '}
                  <button
                    type="button"
                    onClick={() => setRegStep(1)}
                    style={{ background: 'none', border: 'none', color: '#173c32', fontSize: 12, cursor: 'pointer', textDecoration: 'underline' }}
                  >
                    {t('Đổi số')}
                  </button>
                </div>

                <label style={{ display: 'grid', gap: 6, fontSize: 13, fontWeight: 500, color: '#173c32' }}>
                  {t('Mã OTP 6 số từ tin nhắn SMS')}
                  <input
                    required
                    maxLength={6}
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

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <small style={{ color: '#64748b' }}>{t('Mã hiệu lực trong 5 phút.')}</small>
                  <button
                    type="button"
                    disabled={countdown > 0 || busy}
                    onClick={() => handleResendPhoneOtp('REGISTER')}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: countdown > 0 ? '#94a3b8' : '#173c32',
                      textDecoration: countdown > 0 ? 'none' : 'underline',
                      cursor: countdown > 0 ? 'not-allowed' : 'pointer',
                      fontSize: 12.5,
                      fontWeight: 600,
                      padding: 0
                    }}
                  >
                    {countdown > 0 ? `${t('Gửi lại sau')} ${countdown}s` : t('Gửi lại mã OTP')}
                  </button>
                </div>

                <button
                  type="submit"
                  disabled={busy}
                  style={{
                    marginTop: 6,
                    padding: '11px',
                    borderRadius: 8,
                    background: '#173c32',
                    color: '#def46a',
                    border: 'none',
                    fontWeight: 700,
                    fontSize: 14,
                    cursor: busy ? 'not-allowed' : 'pointer'
                  }}
                >
                  {busy ? t('Đang xác thực...') : t('Xác nhận mã OTP')}
                </button>
              </>
            )}

            {/* Bước 3: Nhập thông tin & mật khẩu */}
            {regStep === 3 && (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#166534', background: '#f0fdf4', padding: '8px 12px', borderRadius: 6, fontSize: 12.5 }}>
                  <CheckCircle2 size={16} />
                  <span>{t('Đã xác minh số điện thoại:')} <strong>{formatPhoneDisplay(values.phone)}</strong></span>
                </div>

                <label style={{ display: 'grid', gap: 6, fontSize: 13, fontWeight: 500, color: '#173c32' }}>
                  {t('Họ và tên')}
                  <input
                    required
                    maxLength={100}
                    autoComplete="name"
                    placeholder={t("Ví dụ: Nguyễn Văn A")}
                    value={values.name}
                    onChange={e => set('name', e.target.value)}
                    style={{ borderRadius: 8, border: '1px solid #cbd5e1', padding: '10px 14px', fontSize: 14 }}
                  />
                </label>

                <label style={{ display: 'grid', gap: 6, fontSize: 13, fontWeight: 500, color: '#173c32' }}>
                  <span>{t('Email')} <small style={{ color: '#64748b', fontWeight: 400 }}>({t('tùy chọn, dùng nhận hóa đơn & thông báo')})</small></span>
                  <input
                    type="email"
                    autoComplete="email"
                    placeholder="email@example.com"
                    value={values.email}
                    onChange={e => set('email', e.target.value)}
                    style={{ borderRadius: 8, border: '1px solid #cbd5e1', padding: '10px 14px', fontSize: 14 }}
                  />
                </label>

                <label style={{ display: 'grid', gap: 6, fontSize: 13, fontWeight: 500, color: '#173c32' }}>
                  {t('Mật khẩu')}
                  <div style={{ position: 'relative' }}>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      minLength={6}
                      autoComplete="new-password"
                      placeholder="••••••••"
                      value={values.password}
                      onChange={e => set('password', e.target.value)}
                      style={{ width: '100%', borderRadius: 8, border: '1px solid #cbd5e1', padding: '10px 40px 10px 14px', fontSize: 14, boxSizing: 'border-box' }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#64748b', cursor: 'pointer' }}
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </label>

                <label style={{ display: 'grid', gap: 6, fontSize: 13, fontWeight: 500, color: '#173c32' }}>
                  {t('Nhập lại mật khẩu')}
                  <div style={{ position: 'relative' }}>
                    <input
                      type={showConfirm ? 'text' : 'password'}
                      required
                      minLength={6}
                      autoComplete="new-password"
                      placeholder="••••••••"
                      value={values.confirm}
                      onChange={e => set('confirm', e.target.value)}
                      style={{ width: '100%', borderRadius: 8, border: '1px solid #cbd5e1', padding: '10px 40px 10px 14px', fontSize: 14, boxSizing: 'border-box' }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirm(!showConfirm)}
                      style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#64748b', cursor: 'pointer' }}
                    >
                      {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </label>

                <button
                  type="submit"
                  disabled={busy}
                  style={{
                    marginTop: 6,
                    padding: '11px',
                    borderRadius: 8,
                    background: '#173c32',
                    color: '#def46a',
                    border: 'none',
                    fontWeight: 700,
                    fontSize: 14,
                    cursor: busy ? 'not-allowed' : 'pointer'
                  }}
                >
                  {busy ? t('Đang tạo tài khoản...') : t('Hoàn tất đăng ký & Nhận quà')}
                </button>
              </>
            )}

            <div style={{ textAlign: 'center', fontSize: 13, color: '#64748b', marginTop: 10 }}>
              {t('Đã có tài khoản?')} {' '}
              <button
                type="button"
                onClick={() => setMode('login')}
                style={{ background: 'none', border: 'none', color: '#173c32', fontWeight: 600, cursor: 'pointer', textDecoration: 'underline' }}
              >
                {t('Đăng nhập')}
              </button>
            </div>
          </>
        )}

        {/* ===================== MODE FORGOT PASSWORD ===================== */}
        {mode === 'forgot' && (
          <>
            <label style={{ display: 'grid', gap: 6, fontSize: 13, fontWeight: 500, color: '#173c32' }}>
              {t('Email hoặc số điện thoại')}
              <input
                required
                placeholder="0912 345 678 hoặc email@domain.com"
                value={values.emailOrPhone}
                onChange={e => set('emailOrPhone', e.target.value)}
                style={{ borderRadius: 8, border: '1px solid #cbd5e1', padding: '10px 14px', fontSize: 14 }}
              />
            </label>

            <button
              type="submit"
              disabled={busy}
              style={{
                marginTop: 6,
                padding: '11px',
                borderRadius: 8,
                background: '#173c32',
                color: '#def46a',
                border: 'none',
                fontWeight: 700,
                fontSize: 14,
                cursor: busy ? 'not-allowed' : 'pointer'
              }}
            >
              {busy ? t('Đang xử lý...') : t('Gửi mã xác nhận')}
            </button>

            <div style={{ textAlign: 'center', fontSize: 13, color: '#64748b', marginTop: 10 }}>
              <button
                type="button"
                onClick={() => setMode('login')}
                style={{ background: 'none', border: 'none', color: '#173c32', fontWeight: 600, cursor: 'pointer', textDecoration: 'underline' }}
              >
                ← {t('Quay lại đăng nhập')}
              </button>
            </div>
          </>
        )}

        {/* ===================== MODE RESET PASSWORD ===================== */}
        {mode === 'reset-password' && (
          <>
            <label style={{ display: 'grid', gap: 6, fontSize: 13, fontWeight: 500, color: '#173c32' }}>
              {t('Mã OTP xác nhận 6 số')}
              <input
                required
                maxLength={6}
                placeholder="123456"
                value={values.code}
                onChange={e => set('code', e.target.value.trim())}
                style={{ fontSize: 18, letterSpacing: '4px', textAlign: 'center', borderRadius: 8, border: '1px solid #cbd5e1', padding: '9px 12px' }}
              />
            </label>

            <label style={{ display: 'grid', gap: 6, fontSize: 13, fontWeight: 500, color: '#173c32' }}>
              {t('Mật khẩu mới')}
              <input
                type="password"
                required
                minLength={6}
                placeholder="••••••••"
                value={values.password}
                onChange={e => set('password', e.target.value)}
                style={{ borderRadius: 8, border: '1px solid #cbd5e1', padding: '10px 14px', fontSize: 14 }}
              />
            </label>

            <label style={{ display: 'grid', gap: 6, fontSize: 13, fontWeight: 500, color: '#173c32' }}>
              {t('Nhập lại mật khẩu mới')}
              <input
                type="password"
                required
                minLength={6}
                placeholder="••••••••"
                value={values.confirm}
                onChange={e => set('confirm', e.target.value)}
                style={{ borderRadius: 8, border: '1px solid #cbd5e1', padding: '10px 14px', fontSize: 14 }}
              />
            </label>

            <button
              type="submit"
              disabled={busy}
              style={{
                marginTop: 6,
                padding: '11px',
                borderRadius: 8,
                background: '#173c32',
                color: '#def46a',
                border: 'none',
                fontWeight: 700,
                fontSize: 14,
                cursor: busy ? 'not-allowed' : 'pointer'
              }}
            >
              {busy ? t('Đang cập nhật...') : t('Lưu mật khẩu mới')}
            </button>
          </>
        )}
      </form>
    </div>
  );
}
