import { useContext } from 'react';
import { GuestContext } from '../guest/context';

// Dùng chung cho các trang vừa nằm trong cổng khách (có chọn ngôn ngữ) vừa nằm trong app nhân viên (chỉ tiếng Việt).
export function useI18n() {
  const guest = useContext(GuestContext);
  return { t: guest?.t || (s => s), isEn: guest?.lang === 'en' };
}
