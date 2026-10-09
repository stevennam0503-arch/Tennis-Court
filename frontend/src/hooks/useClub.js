import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../services/api';
export function useClub(date) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const serial = useRef(0);
  const refresh = useCallback(async () => {
    const request = ++serial.current;
    try {
      await api('/schedules/generate', 'POST', { date });
      const value = await api(`/overview?date=${date}`);
      if (request === serial.current) { setData(value); setError(''); }
      return value;
    } catch (e) { if (request === serial.current) setError(e.message); throw e; }
    finally { if (request === serial.current) setLoading(false); }
  }, [date]);
  useEffect(() => { setLoading(true); refresh().catch(() => {}); const timer = setInterval(() => refresh().catch(() => {}), 30000); return () => { clearInterval(timer); serial.current++; }; }, [refresh]);
  const mutate = useCallback(async (path, body, method = 'POST') => {
    const result = await api(path, method, body);
    await refresh();
    return result;
  }, [refresh]);
  return { data, error, loading, refresh, mutate };
}
