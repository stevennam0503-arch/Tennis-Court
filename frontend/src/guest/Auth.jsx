import React, { useState, useEffect } from 'react';
import { Eye, EyeOff, Lock, UserPlus, KeyRound, MailCheck } from 'lucide-react';
import { api } from '../services/api';
import { useGuest } from './context';
import { isValidPhone } from '../utils/phone';

// Đăng nhập / đăng ký của khách. Không còn SMS: xác minh tài khoản và khôi phục mật khẩu đều qua email.
const field = { display: 'grid', gap: 6, fontSize: 13, fontWeight: 500, color: '#173c32' };
const input = { borderRadius: 8, border: '1px solid #cbd5e1', padding: '10px 14px', fontSize: 14, width: '100%', boxSizing: 'border-box' };
const codeInput = { ...input, fontSize: 20, letterSpacing: '6px', textAlign: 'center', fontFamily: 'monospace' };
const primary = busy => ({ marginTop: 4, padding: 12, borderRadius: 8, background: '#173c32', color: '#def46a', border: 'none', fontWeight: 700, fontSize: 14, cursor: busy ? 'not-allowed' : 'pointer' });
const link = { background: 'none', border: 'none', color: '#173c32', fontWeight: 600, cursor: 'pointer', textDecoration: 'underline', fontSize: 13, padding: 0 };

function PasswordInput({ value, onChange, autoComplete, placeholder = '••••••••', minLength }) {
  const [show, setShow] = useState(false);
  return (
    <div style={{ position: 'relative' }}>
      <input type={show ? 'text' : 'password'} required minLength={minLength} maxLength={72} autoComplete={autoComplete} placeholder={placeholder}
        value={value} onChange={e => onChange(e.target.value)} style={{ ...input, paddingRight: 40 }} />
      <button type="button" aria-label={show ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'} onClick={() => setShow(!show)}
        style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#64748b', cursor: 'pointer' }}>
        {show ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>
    </div>
  );
}

export default function GuestAuth({ onSuccess, initialMode = 'login', context = null }) {
  const { t } = useGuest();
  const normalizeMode = m => (m === 'activate-otp' ? 'activate' : (m || 'login'));
  const [mode, setMode] = useState(normalizeMode(initialMode));
  useEffect(() => { setMode(normalizeMode(initialMode)); }, [initialMode]);

  const [values, setValues] = useState({ emailOrPhone: '', email: '', name: '', phone: '', password: '', confirm: '', code: '' });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [devCode, setDevCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const set = (k, v) => setValues(x => ({ ...x, [k]: v }));

  useEffect(() => {
    if (cooldown <= 0) return undefined;
    const timer = setTimeout(() => setCooldown(c => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const go = next => { setError(''); setSuccess(''); setDevCode(''); setMode(next); };

  const toActivate = (res, email) => {
    set('email', res.email || email);
    set('code', '');
    if (res.devCode) setDevCode(res.devCode);
    setSuccess(res.message || t('Mã kích hoạt 6 số đã được gửi tới email của bạn.'));
    setCooldown(60);
    setMode('activate');
  };

  const run = async fn => {
    setError(''); setSuccess(''); setBusy(true);
    try { await fn(); } catch (err) { setError(err.message); } finally { setBusy(false); }
  };

  const submit = e => {
    e.preventDefault();
    if (busy) return;

    if (mode === 'login') return run(async () => {
      const id = values.emailOrPhone.trim();
      const res = await api('/auth/login', 'POST', { emailOrPhone: id, email: id, password: values.password });
      if (res.requiresActivation) return toActivate(res, id);
      await onSuccess(res);
    });

    if (mode === 'register') {
      if (!values.name.trim()) return setError(t('Vui lòng nhập họ và tên.'));
      if (!isValidPhone(values.phone)) return setError(t('Số điện thoại chưa đúng định dạng.'));
      if (values.password.length < 6) return setError(t('Mật khẩu cần tối thiểu 6 ký tự.'));
      if (values.password !== values.confirm) return setError(t('Hai mật khẩu chưa trùng nhau.'));
      return run(async () => {
        const res = await api('/auth/register', 'POST', {
          name: values.name.trim(), email: values.email.trim(), phone: values.phone.trim(),
          password: values.password, requireActivation: true
        });
        if (res.requiresActivation) return toActivate(res, values.email.trim());
        await onSuccess(res);
      });
    }

    if (mode === 'activate') {
      if (values.code.trim().length !== 6) return setError(t('Vui lòng nhập đủ mã 6 số.'));
      return run(async () => {
        const res = await api('/auth/activate', 'POST', { email: values.email.trim(), code: values.code.trim() });
        await onSuccess(res);
      });
    }

    if (mode === 'forgot') return run(async () => {
      const id = values.emailOrPhone.trim();
      const res = await api('/auth/forgot-password', 'POST', { emailOrPhone: id, email: id, phone: id });
      if (res.devCode) { setDevCode(res.devCode); set('code', res.devCode); }
      setMode('reset-password');
      setSuccess(res.message || t('Nếu tài khoản tồn tại, mã đặt lại đã được gửi tới email.'));
    });

    if (mode === 'reset-password') {
      if (values.password !== values.confirm) return setError(t('Hai mật khẩu chưa trùng nhau.'));
      return run(async () => {
        const id = values.emailOrPhone.trim();
        const res = await api('/auth/reset-password', 'POST', { email: id, phone: id, code: values.code.trim(), password: values.password });
        await onSuccess(res);
      });
    }
    return undefined;
  };

  const resendActivation = () => run(async () => {
    const res = await api('/auth/resend-activation', 'POST', { email: values.email.trim() });
    if (res.devCode) setDevCode(res.devCode);
    setSuccess(res.message || t('Đã gửi lại mã kích hoạt.'));
    setCooldown(60);
  });

  const isBookingFlow = context?.from === 'booking';
  const head = {
    login: { icon: <Lock size={22} />, title: isBookingFlow ? t('Đăng nhập để đặt sân') : t('Đăng nhập Courtly'),
      sub: isBookingFlow ? t('Đăng nhập để giữ chỗ sân theo thời gian thực và tự động áp dụng ưu đãi.') : t('Chào mừng trở lại! Đăng nhập để đặt sân và quản lý lịch thi đấu.') },
    register: { icon: <UserPlus size={22} />, title: isBookingFlow ? t('Đăng ký & Nhận quà') : t('Đăng ký tài khoản'),
      sub: t('Tạo tài khoản bằng email. Chúng tôi sẽ gửi mã kích hoạt 6 số tới email của bạn.') },
    activate: { icon: <MailCheck size={22} />, title: t('Kích hoạt tài khoản'),
      sub: values.email ? `${t('Nhập mã 6 số đã gửi tới')} ${values.email}` : t('Nhập email và mã kích hoạt 6 số đã gửi cho bạn.') },
    forgot: { icon: <KeyRound size={22} />, title: t('Quên mật khẩu'), sub: t('Nhập email hoặc số điện thoại đã đăng ký. Mã khôi phục sẽ được gửi về email của tài khoản.') },
    'reset-password': { icon: <KeyRound size={22} />, title: t('Đặt lại mật khẩu mới'), sub: t('Nhập mã 6 số trong email và đặt mật khẩu mới.') }
  }[mode] || { icon: <Lock size={22} />, title: t('Tài khoản'), sub: '' };

  return (
    <div className="gx-auth-card" style={{ maxWidth: 440, margin: '0 auto', width: '100%' }}>
      <div style={{ textAlign: 'center', marginBottom: 20 }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 48, height: 48, borderRadius: '50%', background: 'rgba(23, 60, 50, 0.08)', color: '#173c32', marginBottom: 10 }}>
          {head.icon}
        </div>
        <h2 style={{ fontSize: 22, fontWeight: 700, margin: '0 0 6px', color: '#173c32', letterSpacing: '-0.5px' }}>{head.title}</h2>
        <p style={{ margin: 0, fontSize: 13, color: '#52655a', lineHeight: 1.5 }}>{head.sub}</p>
      </div>

      <form onSubmit={submit} className="gx-form" style={{ display: 'grid', gap: 14 }} noValidate={mode === 'activate'}>
        {mode === 'register' && (
          <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10, fontSize: 12.5, color: '#166534', lineHeight: 1.4 }}>
            <span style={{ fontSize: 18 }}>🎁</span>
            <span><strong>{t('Quà chào mừng:')}</strong> {t('voucher giảm 50.000₫ cho lần đặt sân đầu tiên, tự áp dụng sau khi kích hoạt tài khoản.')}</span>
          </div>
        )}

        {success && <div className="gx-notice" role="status" style={{ padding: '11px 14px', borderRadius: 8, background: '#ecfdf5', border: '1px solid #a7f3d0', color: '#065f46', fontSize: 13, margin: 0 }}>{success}</div>}
        {error && <div className="gx-notice error" role="alert" style={{ padding: '11px 14px', borderRadius: 8, background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', fontSize: 13, margin: 0 }}>{error}</div>}

        {devCode && (
          <div style={{ background: '#f0fdf4', border: '1px dashed #86efac', borderRadius: 8, padding: '10px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
            <div>
              <small style={{ display: 'block', color: '#166534', fontWeight: 600 }}>{t('Chế độ demo (không gửi email thật):')}</small>
              <span style={{ fontSize: 13, color: '#14532d' }}>{t('Mã:')} <strong style={{ letterSpacing: 2, fontSize: 15, fontFamily: 'monospace' }}>{devCode}</strong></span>
            </div>
            <button type="button" onClick={() => set('code', devCode)} style={{ whiteSpace: 'nowrap', background: '#166534', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
              {t('Điền nhanh')}
            </button>
          </div>
        )}

        {mode === 'login' && (
          <>
            <label style={field}>
              {t('Email hoặc số điện thoại')}
              <input required autoComplete="username" placeholder="email@example.com / 0912 345 678" value={values.emailOrPhone} onChange={e => set('emailOrPhone', e.target.value)} style={input} />
            </label>
            <label style={field}>
              <span style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>{t('Mật khẩu')}</span>
                <button type="button" onClick={() => go('forgot')} style={{ ...link, fontWeight: 400, fontSize: 12 }}>{t('Quên mật khẩu?')}</button>
              </span>
              <PasswordInput value={values.password} onChange={v => set('password', v)} autoComplete="current-password" />
            </label>
            <button type="submit" disabled={busy} style={primary(busy)}>{busy ? t('Đang xử lý...') : t('Đăng nhập')}</button>
            <p style={{ textAlign: 'center', fontSize: 13, color: '#64748b', margin: '6px 0 0' }}>
              {t('Chưa có tài khoản?')} <button type="button" onClick={() => go('register')} style={link}>{t('Đăng ký ngay')}</button>
            </p>
          </>
        )}

        {mode === 'register' && (
          <>
            <label style={field}>
              {t('Họ và tên')}
              <input required maxLength={100} autoComplete="name" placeholder="Nguyễn Văn A" value={values.name} onChange={e => set('name', e.target.value)} style={input} />
            </label>
            <label style={field}>
              {t('Email')}
              <input type="email" required autoComplete="email" placeholder="email@example.com" value={values.email} onChange={e => set('email', e.target.value)} style={input} />
              <small style={{ color: '#64748b', fontWeight: 400 }}>{t('Mã kích hoạt và hóa đơn sẽ được gửi về email này.')}</small>
            </label>
            <label style={field}>
              {t('Số điện thoại liên hệ')}
              <input type="tel" required maxLength={15} autoComplete="tel" placeholder="0912 345 678" value={values.phone} onChange={e => set('phone', e.target.value)} style={input} />
              <small style={{ color: '#64748b', fontWeight: 400 }}>{t('Dùng để quầy tra cứu khi check-in.')}</small>
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
              <label style={field}>
                {t('Mật khẩu')}
                <PasswordInput value={values.password} onChange={v => set('password', v)} autoComplete="new-password" minLength={6} placeholder={t('Tối thiểu 6 ký tự')} />
              </label>
              <label style={field}>
                {t('Nhập lại mật khẩu')}
                <PasswordInput value={values.confirm} onChange={v => set('confirm', v)} autoComplete="new-password" minLength={6} />
              </label>
            </div>
            <button type="submit" disabled={busy} style={primary(busy)}>{busy ? t('Đang tạo tài khoản...') : t('Tạo tài khoản')}</button>
            <p style={{ textAlign: 'center', fontSize: 13, color: '#64748b', margin: '6px 0 0' }}>
              {t('Đã có tài khoản?')} <button type="button" onClick={() => go('login')} style={link}>{t('Đăng nhập')}</button>
            </p>
          </>
        )}

        {mode === 'activate' && (
          <>
            {!values.email && (
              <label style={field}>
                {t('Email đã đăng ký')}
                <input type="email" required value={values.email} onChange={e => set('email', e.target.value)} style={input} />
              </label>
            )}
            <label style={field}>
              {t('Mã kích hoạt 6 số')}
              <input required inputMode="numeric" maxLength={6} placeholder="••••••" value={values.code} onChange={e => set('code', e.target.value.replace(/\D/g, ''))} style={codeInput} autoFocus />
            </label>
            <button type="submit" disabled={busy} style={primary(busy)}>{busy ? t('Đang kích hoạt...') : t('Kích hoạt & đăng nhập')}</button>
            <p style={{ textAlign: 'center', fontSize: 13, color: '#64748b', margin: '6px 0 0' }}>
              {t('Chưa nhận được email?')}{' '}
              <button type="button" disabled={busy || cooldown > 0 || !values.email} onClick={resendActivation} style={link}>
                {cooldown > 0 ? `${t('Gửi lại sau')} ${cooldown}s` : t('Gửi lại mã')}
              </button>
            </p>
          </>
        )}

        {mode === 'forgot' && (
          <>
            <label style={field}>
              {t('Email hoặc số điện thoại')}
              <input required autoComplete="username" placeholder="email@example.com / 0912 345 678" value={values.emailOrPhone} onChange={e => set('emailOrPhone', e.target.value)} style={input} />
            </label>
            <button type="submit" disabled={busy} style={primary(busy)}>{busy ? t('Đang gửi...') : t('Gửi mã về email')}</button>
            <p style={{ textAlign: 'center', margin: '6px 0 0' }}>
              <button type="button" onClick={() => go('login')} style={{ ...link, fontWeight: 400 }}>← {t('Quay lại đăng nhập')}</button>
            </p>
          </>
        )}

        {mode === 'reset-password' && (
          <>
            {!values.emailOrPhone && (
              <label style={field}>
                {t('Email hoặc số điện thoại')}
                <input required value={values.emailOrPhone} onChange={e => set('emailOrPhone', e.target.value)} style={input} />
              </label>
            )}
            <label style={field}>
              {t('Mã xác nhận 6 số')}
              <input required inputMode="numeric" maxLength={6} placeholder="••••••" value={values.code} onChange={e => set('code', e.target.value.replace(/\D/g, ''))} style={codeInput} />
            </label>
            <label style={field}>
              {t('Mật khẩu mới')}
              <PasswordInput value={values.password} onChange={v => set('password', v)} autoComplete="new-password" minLength={6} />
            </label>
            <label style={field}>
              {t('Nhập lại mật khẩu mới')}
              <PasswordInput value={values.confirm} onChange={v => set('confirm', v)} autoComplete="new-password" minLength={6} />
            </label>
            <button type="submit" disabled={busy} style={primary(busy)}>{busy ? t('Đang cập nhật...') : t('Lưu mật khẩu mới')}</button>
          </>
        )}
      </form>
    </div>
  );
}
