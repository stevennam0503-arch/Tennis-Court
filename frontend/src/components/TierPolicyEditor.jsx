import React, { useEffect, useMemo, useState } from 'react';
import { api } from '../services/api';
import { money } from '../utils/format';

// Chính sách hạng thành viên: xem, chỉnh (chỉ admin) với ngày hiệu lực, hủy bản chờ, xem lịch sử.
const TIERS = [
  { code: 'ROOKIE', label: 'Rookie', icon: '🎾', color: '#64748b', bg: '#ffffff', gift: 'Voucher chào mừng 50k', perk: '—' },
  { code: 'CHALLENGER', label: 'Challenger', icon: '⭐', color: '#0284c7', bg: '#f0f9ff', gift: '200 điểm thưởng', perk: '—' },
  { code: 'MASTERS', label: 'Masters', icon: '🏆', color: '#7c3aed', bg: '#faf5ff', gift: '500 điểm thưởng', perk: 'Đăng ký giải sớm 3 ngày' },
  { code: 'GRAND_SLAM', label: 'Grand Slam', icon: '👑', color: '#b45309', bg: '#fefce8', gift: '1.000 điểm + Voucher 300.000₫ + Thẻ VIP Lounge', perk: 'Phòng chờ VIP Lounge · Hủy linh hoạt' }
];
const FIELDS = [
  { key: 'spend', label: 'Chi tiêu 12T', step: 100000, min: 0, show: v => money(v) },
  { key: 'discount', label: 'Giảm tiền sân', step: 0.5, min: 0, max: 15, show: v => (v > 0 ? `−${String(v).replace('.', ',')}%` : '0%') },
  { key: 'multiplier', label: 'Hệ số điểm', step: 0.1, min: 1, max: 5, show: v => `×${Number(v).toFixed(1).replace('.', ',')}` },
  { key: 'advanceDays', label: 'Đặt trước', step: 1, min: 1, max: 60, show: v => `${v} ngày` },
  { key: 'changes', label: 'Đổi lịch free/tháng', step: 1, min: 0, max: 10, show: v => (v > 0 ? `${v} lượt` : '0') },
  { key: 'birthday', label: 'Voucher sinh nhật', step: 10000, min: 0, max: 1000000, show: v => money(v) }
];

const cell = { padding: '10px 12px', borderBottom: '1px solid #f1f5f9', whiteSpace: 'nowrap' };
const head = { ...cell, background: '#f8fafc', color: '#475569', fontWeight: 600, borderBottom: '2px solid #e2e8f0' };
const byCode = list => Object.fromEntries((list || []).map(t => [t.tier, t]));
const vnDate = iso => (iso ? new Date(`${iso}T00:00:00+07:00`).toLocaleDateString('vi-VN') : '');
const firstOfNextMonth = () => {
  const d = new Date();
  const n = new Date(d.getFullYear(), d.getMonth() + 1, 1);
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-01`;
};

function PolicyTable({ tiers, compareTo }) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, textAlign: 'left' }}>
        <thead>
          <tr>
            <th style={head}>Hạng</th>
            {FIELDS.map(f => <th key={f.key} style={head}>{f.label}</th>)}
            <th style={head}>Quà khi lên hạng</th>
            <th style={head}>Đặc quyền khác</th>
          </tr>
        </thead>
        <tbody>
          {TIERS.map(t => (
            <tr key={t.code} style={{ background: t.bg }}>
              <td style={{ ...cell, fontWeight: 700, color: t.color }}>{t.icon} {t.label}</td>
              {FIELDS.map(f => {
                const v = tiers[t.code]?.[f.key];
                const old = compareTo?.[t.code]?.[f.key];
                const changed = compareTo && Number(old) !== Number(v);
                return (
                  <td key={f.key} style={{ ...cell, fontWeight: changed ? 800 : 500, color: changed ? '#b45309' : undefined }}>
                    {changed && <span style={{ color: '#94a3b8', textDecoration: 'line-through', fontWeight: 400, marginRight: 6 }}>{f.show(old)}</span>}
                    {f.show(v)}
                  </td>
                );
              })}
              <td style={{ ...cell, whiteSpace: 'normal', minWidth: 160 }}>{t.gift}</td>
              <td style={{ ...cell, whiteSpace: 'normal', minWidth: 140, color: t.perk === '—' ? '#94a3b8' : undefined }}>{t.perk}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function TierPolicyEditor({ isAdmin, notify }) {
  const [data, setData] = useState(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({});
  const [effectiveFrom, setEffectiveFrom] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [confirmCancel, setConfirmCancel] = useState(false);

  const load = async () => {
    try {
      setData(await api(isAdmin ? '/admin/loyalty/policy' : '/public/loyalty/policy'));
    } catch (e) {
      setError(e.message);
    }
  };
  useEffect(() => { load(); }, [isAdmin]);

  const current = useMemo(() => byCode(data?.tiers), [data]);
  const pending = data?.pending ? byCode(data.pending.tiers) : null;

  const startEdit = () => {
    const base = pending || current;
    setDraft(Object.fromEntries(TIERS.map(t => [t.code, { ...base[t.code] }])));
    const earliest = data?.earliestEffectiveFrom || '';
    const suggested = data?.pending?.effectiveFrom || firstOfNextMonth();
    setEffectiveFrom(suggested < earliest ? earliest : suggested);
    setError('');
    setEditing(true);
  };

  const setValue = (code, key, value) => setDraft(d => ({ ...d, [code]: { ...d[code], [key]: value } }));

  const changes = useMemo(() => {
    if (!editing) return [];
    const out = [];
    TIERS.forEach(t => FIELDS.forEach(f => {
      const a = Number(current[t.code]?.[f.key]);
      const b = Number(draft[t.code]?.[f.key]);
      if (draft[t.code] && a !== b) out.push(`${t.label} · ${f.label}: ${f.show(a)} → ${f.show(b)}`);
    }));
    return out;
  }, [editing, draft, current]);

  const save = async () => {
    setBusy(true);
    setError('');
    try {
      const tiers = Object.fromEntries(TIERS.map(t => [t.code, Object.fromEntries(FIELDS.map(f => [f.key, Number(draft[t.code][f.key])]))]));
      const res = await api('/admin/loyalty/policy', 'PUT', { effectiveFrom, tiers });
      setData(res);
      setEditing(false);
      notify?.(`Đã lên lịch chính sách hạng mới, hiệu lực từ ${vnDate(effectiveFrom)}. Khách đã được báo trước qua chuông thông báo.`);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const cancelPending = async () => {
    setBusy(true);
    try {
      setData(await api('/admin/loyalty/policy/pending', 'DELETE'));
      setConfirmCancel(false);
      notify?.('Đã hủy thay đổi chính sách hạng đang chờ hiệu lực');
    } catch (e) {
      notify?.(e.message);
    } finally {
      setBusy(false);
    }
  };

  if (!data) return <div style={{ padding: 20, color: error ? '#dc2626' : '#64748b' }}>{error || 'Đang tải chính sách hạng…'}</div>;

  return (
    <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', padding: 20, display: 'grid', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#0f172a' }}>Quy chế 4 hạng thành viên Courtly</h3>
          <p style={{ margin: '4px 0 0', fontSize: 12.5, color: '#64748b', maxWidth: 640 }}>
            Tên và số hạng cố định. Manager chỉnh được các con số; thay đổi có hiệu lực từ ngày chọn (sớm nhất là ngày mai), không áp dụng ngược.
            Khách đang giữ hạng được giữ tới kỳ xét hạng.
          </p>
        </div>
        {isAdmin && !editing && (
          <button type="button" onClick={startEdit}
            style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid #0f172a', background: '#0f172a', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
            ✏️ {pending ? 'Sửa thay đổi đang chờ' : 'Chỉnh chính sách'}
          </button>
        )}
      </div>

      {pending && !editing && (
        <div style={{ border: '1px solid #fcd34d', background: '#fffbeb', borderRadius: 10, padding: '12px 14px', display: 'grid', gap: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <b style={{ color: '#92400e', fontSize: 13.5 }}>🗓️ Đã lên lịch thay đổi, hiệu lực từ {vnDate(data.pending.effectiveFrom)}</b>
            {isAdmin && (confirmCancel ? (
              <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center', fontSize: 12.5 }}>
                Hủy thay đổi này?
                <button type="button" disabled={busy} onClick={cancelPending} style={{ padding: '5px 10px', borderRadius: 6, border: 'none', background: '#dc2626', color: '#fff', fontWeight: 700, cursor: 'pointer' }}>Hủy thay đổi</button>
                <button type="button" onClick={() => setConfirmCancel(false)} style={{ padding: '5px 10px', borderRadius: 6, border: '1px solid #cbd5e1', background: '#fff', cursor: 'pointer' }}>Không</button>
              </span>
            ) : (
              <button type="button" onClick={() => setConfirmCancel(true)} style={{ padding: '5px 10px', borderRadius: 6, border: '1px solid #fca5a5', background: '#fff', color: '#dc2626', fontWeight: 600, cursor: 'pointer', fontSize: 12.5 }}>Hủy thay đổi</button>
            ))}
          </div>
          <PolicyTable tiers={pending} compareTo={current} />
        </div>
      )}

      {editing ? (
        <div style={{ display: 'grid', gap: 12 }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, textAlign: 'left' }}>
              <thead>
                <tr>
                  <th style={head}>Hạng</th>
                  {FIELDS.map(f => <th key={f.key} style={head}>{f.label}</th>)}
                </tr>
              </thead>
              <tbody>
                {TIERS.map(t => (
                  <tr key={t.code} style={{ background: t.bg }}>
                    <td style={{ ...cell, fontWeight: 700, color: t.color }}>{t.icon} {t.label}</td>
                    {FIELDS.map(f => {
                      const locked = t.code === 'ROOKIE' && f.key === 'spend';
                      const changed = Number(current[t.code]?.[f.key]) !== Number(draft[t.code]?.[f.key]);
                      return (
                        <td key={f.key} style={cell}>
                          <input type="number" step={f.step} min={f.min} max={f.max} disabled={locked}
                            aria-label={`${t.label} – ${f.label}`}
                            value={draft[t.code]?.[f.key] ?? ''} onChange={e => setValue(t.code, f.key, e.target.value)}
                            style={{ width: f.key === 'spend' ? 120 : 80, padding: '6px 8px', borderRadius: 6, fontSize: 13,
                              border: `1px solid ${changed ? '#f59e0b' : '#cbd5e1'}`, background: locked ? '#f1f5f9' : '#fff' }} />
                          <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 3 }}>{f.show(Number(draft[t.code]?.[f.key] || 0))}</div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ display: 'flex', gap: 16, alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <label style={{ display: 'grid', gap: 4, fontSize: 13, fontWeight: 600 }}>
              Hiệu lực từ ngày
              <input type="date" min={data.earliestEffectiveFrom} value={effectiveFrom} onChange={e => setEffectiveFrom(e.target.value)}
                style={{ padding: '7px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 13 }} />
            </label>
            <p style={{ margin: 0, fontSize: 12, color: '#64748b', maxWidth: 520 }}>
              Gợi ý ngày đầu tháng sau để khách có thời gian biết trước. Khi lưu, mọi khách đang hoạt động nhận một thông báo trong ứng dụng.
            </p>
          </div>

          <div style={{ border: '1px dashed #cbd5e1', borderRadius: 10, padding: '10px 14px', fontSize: 12.5 }}>
            <b>Thay đổi so với hiện hành ({changes.length}):</b>
            {changes.length === 0 ? <span style={{ color: '#94a3b8' }}> chưa có</span> : (
              <ul style={{ margin: '6px 0 0', paddingLeft: 18, display: 'grid', gap: 2 }}>{changes.map(c => <li key={c}>{c}</li>)}</ul>
            )}
          </div>

          {error && <div role="alert" style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', borderRadius: 8, padding: '10px 12px', fontSize: 13 }}>{error}</div>}

          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button type="button" onClick={() => setEditing(false)} disabled={busy}
              style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid #cbd5e1', background: '#fff', cursor: 'pointer', fontSize: 13 }}>Bỏ</button>
            <button type="button" onClick={save} disabled={busy || changes.length === 0 || !effectiveFrom}
              style={{ padding: '8px 14px', borderRadius: 8, border: 'none', background: '#0f172a', color: '#fff', fontWeight: 700, cursor: 'pointer', fontSize: 13, opacity: changes.length === 0 ? 0.5 : 1 }}>
              {busy ? 'Đang lưu…' : `Lên lịch áp dụng từ ${vnDate(effectiveFrom)}`}
            </button>
          </div>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 6 }}>
          <b style={{ fontSize: 13, color: '#0f172a' }}>Đang áp dụng</b>
          <PolicyTable tiers={current} />
        </div>
      )}

      {isAdmin && (data.history || []).length > 0 && (
        <details style={{ fontSize: 12.5 }}>
          <summary style={{ cursor: 'pointer', fontWeight: 600, color: '#334155' }}>Lịch sử thay đổi ({data.history.length})</summary>
          <ul style={{ margin: '8px 0 0', paddingLeft: 18, display: 'grid', gap: 8 }}>
            {data.history.map(h => (
              <li key={h.at}>
                <b>{new Date(h.at).toLocaleString('vi-VN')}</b> · {h.by} · {h.action === 'CANCEL' ? 'Hủy thay đổi' : `Lên lịch, hiệu lực ${vnDate(h.effectiveFrom)}`}
                <ul style={{ margin: '2px 0 0', paddingLeft: 16, color: '#475569' }}>{(h.changes || []).map(c => <li key={c}>{c}</li>)}</ul>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
