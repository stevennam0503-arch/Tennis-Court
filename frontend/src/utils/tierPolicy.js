import { useEffect, useState } from 'react';
import { api } from '../services/api';

// Chính sách hạng thành viên: một nguồn duy nhất là API /public/loyalty/policy (admin chỉnh được).
// DEFAULT_TIERS chỉ dùng khi chưa tải xong hoặc mất kết nối.
export const TIER_ORDER = ['ROOKIE', 'CHALLENGER', 'MASTERS', 'GRAND_SLAM'];
export const TIER_NAMES = { ROOKIE: 'Rookie', CHALLENGER: 'Challenger', MASTERS: 'Masters', GRAND_SLAM: 'Grand Slam' };
export const DEFAULT_TIERS = {
  ROOKIE: { spend: 0, discount: 0, multiplier: 1.0, advanceDays: 7, changes: 0, birthday: 30000 },
  CHALLENGER: { spend: 3000000, discount: 3, multiplier: 1.2, advanceDays: 10, changes: 1, birthday: 60000 },
  MASTERS: { spend: 8000000, discount: 5, multiplier: 1.5, advanceDays: 14, changes: 2, birthday: 120000 },
  GRAND_SLAM: { spend: 20000000, discount: 8, multiplier: 2.0, advanceDays: 21, changes: 4, birthday: 250000 }
};

const toMap = list => Object.fromEntries((list || []).map(t => [t.tier, t]));
let cache = null;
let inflight = null;

export function loadTierPolicy(force = false) {
  if (cache && !force) return Promise.resolve(cache);
  if (!inflight || force) {
    inflight = api('/public/loyalty/policy')
      .then(res => {
        cache = {
          tiers: { ...DEFAULT_TIERS, ...toMap(res?.tiers) },
          pending: res?.pending ? { effectiveFrom: res.pending.effectiveFrom, tiers: toMap(res.pending.tiers) } : null
        };
        return cache;
      })
      .catch(() => ({ tiers: DEFAULT_TIERS, pending: null }))
      .finally(() => { inflight = null; });
  }
  return inflight;
}

export function useTierPolicy() {
  const [policy, setPolicy] = useState(cache || { tiers: DEFAULT_TIERS, pending: null });
  useEffect(() => {
    let alive = true;
    loadTierPolicy().then(p => { if (alive) setPolicy(p); });
    return () => { alive = false; };
  }, []);
  return policy;
}

export const nextTierOf = code => TIER_ORDER[TIER_ORDER.indexOf(code) + 1] || null;
export const fmtDiscount = v => (Number(v) > 0 ? `−${String(v).replace('.', ',')}%` : '0%');
export const fmtMultiplier = v => `×${Number(v).toFixed(1).replace('.', ',')}`;
export const fmtMoney = v => `${Number(v || 0).toLocaleString('vi-VN')}₫`;
export const fmtDate = iso => (iso ? new Date(`${iso}T00:00:00+07:00`).toLocaleDateString('vi-VN') : '');
