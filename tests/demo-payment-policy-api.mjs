import assert from 'node:assert/strict';
assert.equal(process.env.COURTLY_TEST_WRITE,'1','Use a disposable database with DEMO_MODE=true, PAYMENT_MODE=SANDBOX, SMTP unset');
const base=process.env.COURTLY_API_URL||'http://127.0.0.1:8094/api';
let checks=0;function check(value,label){assert.ok(value,label);console.log('PASS',++checks,label)}
class Client {
 cookies=new Map();
 async call(path,method='GET',body,expected=200){
  const headers={'Content-Type':'application/json'};
  if(method!=='GET'){const csrf=await this.call('/csrf');headers[csrf.headerName]=csrf.token;}
  headers.Cookie=[...this.cookies].map(([k,v])=>k+'='+v).join('; ');
  const r=await fetch(base+path,{signal:AbortSignal.timeout(30000),method,headers,body:body===undefined?undefined:JSON.stringify(body)});
  for(const c of r.headers.getSetCookie()){const [k,...v]=c.split(';')[0].split('=');this.cookies.set(k,v.join('='));}
  const content=await r.text();let data;try{data=JSON.parse(content)}catch{data=content;}
  assert.equal(r.status,expected,path+': '+content);return data;
 }
}

const a=new Client();await a.call('/auth/login','POST',{email:'admin@gmail.com',password:'12345'});
const v=await a.call('/overview?date='+new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Ho_Chi_Minh',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date()));check(v.demoResetEnabled===true,'explicit demo enables admin demo controls');
const anon=new Client();const forgot=await anon.call('/auth/forgot-password','POST',{email:'minh.anh@example.com'});
check(/^\d{6}$/.test(forgot.devCode),'explicit isolated demo still supports OTP testing');
const config=await a.call('/public/payment-config');check(config.onlineEnabled&&config.mode==='SANDBOX','explicit demo sandbox payments enabled');
const c=new Client();await c.call('/auth/login','POST',{email:'minh.anh@example.com',password:'CourtlyDemo2026'});
const targetDate=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Ho_Chi_Minh',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(Date.now()+4*86400000));
const snap=await a.call('/overview?date='+targetDate);const account=snap.accounts.find(x=>x.email==='minh.anh@example.com');
const slot=snap.schedules.find(s=>s.status==='AVAILABLE');
const made=await a.call('/orders','POST',{accountId:account.id,name:'Sandbox regression',phone:'0900000004',scheduleIds:[slot.id],assignments:[],requestId:crypto.randomUUID()});
const intent=await c.call('/transfers','POST',{type:'ORDER',targetId:made.id,purpose:'BALANCE'});
await c.call(`/transfers/${intent.id}/sandbox`,'POST',{scenario:'SUCCESS'});
const after=await a.call('/overview?date='+targetDate);const paid=after.orders.find(o=>o.id===made.id);
check(paid.status==='CONFIRMED'&&paid.total===paid.paid,'sandbox credits only isolated demo order through normal payment flow');
