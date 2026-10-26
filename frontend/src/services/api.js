const base = import.meta.env.VITE_API_URL || '/api';
let csrf = null;

async function csrfToken(force = false) {
  if (!csrf || force) {
    const r = await fetch(`${base}/csrf`, { credentials: 'same-origin' });
    if (!r.ok) throw new Error('Không thể khởi tạo phiên xác thực');
    csrf = await r.json();
  }
  return csrf;
}

export async function api(path, method = 'GET', body, isRetry = false) {
  const token = !['GET', 'HEAD', 'OPTIONS'].includes(method) ? await csrfToken(isRetry) : null;
  const response = await fetch(`${base}${path}`, {
    method,
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json', ...(token ? { [token.headerName]: token.token } : {}) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });

  const text = await response.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }

  // Auto-retry once on 403 CSRF/session desync for mutating requests
  if (response.status === 403 && !isRetry && !['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    csrf = null;
    return api(path, method, body, true);
  }

  if (response.status === 403) csrf = null;
  if (!response.ok) {
    const defaultMsg =
      response.status === 402
        ? 'Giao dịch yêu cầu thanh toán (Hạn mức dịch vụ hoặc tiền cọc chưa đủ).'
        : response.status === 403
        ? 'Bạn không có quyền thực hiện thao tác này hoặc phiên đăng nhập đã thay đổi.'
        : response.status === 405
        ? 'Phương thức gửi yêu cầu không được máy chủ hỗ trợ.'
        : `Không thể xử lý yêu cầu (${response.status}).`;

    const error = new Error(data?.message || defaultMsg);
    error.status = response.status;
    throw error;
  }
  if (path.startsWith('/auth/') && method === 'POST') csrf = null;
  return data;
}
