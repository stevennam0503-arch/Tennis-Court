const base = import.meta.env.VITE_API_URL || '/api';
let csrf = null;
async function csrfToken(){if(!csrf){const r=await fetch(`${base}/csrf`,{credentials:'same-origin'});if(!r.ok)throw new Error('Không thể khởi tạo phiên xác thực');csrf=await r.json();}return csrf;}
export async function api(path, method = 'GET', body) {
  const token=!['GET','HEAD','OPTIONS'].includes(method)?await csrfToken():null;
  const response = await fetch(`${base}${path}`, {
    method,
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json', ...(token?{[token.headerName]:token.token}:{}) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const text = await response.text();
  let data;
  try { data = text ? JSON.parse(text) : null; } catch { data = null; }
  if(response.status===403)csrf=null;
  if (!response.ok) { const error=new Error(data?.message || `Không thể xử lý yêu cầu (${response.status}).`); error.status=response.status; throw error; }
  if(path.startsWith('/auth/')&&method==='POST')csrf=null;
  return data;
}
