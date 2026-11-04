/**
 * Chuẩn hóa số điện thoại Việt Nam về định dạng E.164 (+84xxxxxxxxx)
 */
export function normalizePhone(phone) {
  if (!phone) return '';
  const clean = String(phone).trim().replace(/[\s\-\.\(\)]+/g, '');
  if (clean.startsWith('+84') && /^\+84[0-9]{9}$/.test(clean)) {
    return clean;
  }
  if (clean.startsWith('84') && /^84[0-9]{9}$/.test(clean)) {
    return '+' + clean;
  }
  if (clean.startsWith('0') && /^0[0-9]{9}$/.test(clean)) {
    return '+84' + clean.slice(1);
  }
  return clean;
}

/**
 * Kiểm tra số điện thoại Việt Nam hợp lệ
 */
export function isValidPhone(phone) {
  if (!phone) return false;
  const clean = String(phone).trim().replace(/[\s\-\.\(\)]+/g, '');
  return /^(\+84|84|0)[0-9]{9}$/.test(clean);
}

/**
 * Hiển thị số điện thoại định dạng 09xx xxx xxx
 */
export function formatPhoneDisplay(phone) {
  if (!phone) return '';
  const clean = String(phone).trim().replace(/[\s\-\.\(\)]+/g, '');
  let local = clean;
  if (clean.startsWith('+84')) {
    local = '0' + clean.slice(3);
  } else if (clean.startsWith('84')) {
    local = '0' + clean.slice(2);
  }
  if (/^0[0-9]{9}$/.test(local)) {
    return `${local.slice(0, 4)} ${local.slice(4, 7)} ${local.slice(7)}`;
  }
  return phone;
}
