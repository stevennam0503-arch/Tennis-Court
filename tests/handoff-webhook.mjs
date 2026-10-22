import assert from 'node:assert/strict';
const base=process.env.COURTLY_API_URL||'http://127.0.0.1:8084/api';
assert.equal(process.env.COURTLY_TEST_WRITE,'1','Disposable test DB only');
const key=process.env.COURTLY_TEST_WEBHOOK_KEY;assert.ok(key,'Set local test webhook key');
let checks=0;const check=(x,msg)=>{assert.ok(x,msg);console.log('PASS',++checks,msg)};
class Client{cookies=new Map();async raw(path,method='GET',body,headers={}){const res=await fetch(base+path,{method,headers:{Cookie:[...this.cookies].map(([k,v])=>k+'='+v).join('; '),'Content-Type':'application/json',...headers},body:body===undefined?undefined:JSON.stringify(body)});for(const c of res.headers.getSetCookie()){const [k,...v]=c.split(';')[0].split('=');this.cookies.set(k,v.join('='))}let data;try{data=await res.json()}catch{data=null}return {status:res.status,data}}
async call(path,method='GET',body){let headers={};if(method!=='GET'){const c=await this.raw('/csrf');headers[c.data.headerName]=c.data.token}const r=await this.raw(path,method,body,headers);if(r.status>=400)throw Object.assign(Error(path+': '+JSON.stringify(r)),r);return r.data}
async fails(path,method,body,status){let failed=false;try{await this.call(path,method,body)}catch(e){failed=true;if(status)assert.equal(e.status,status)}check(failed,'reject '+path)}
async login(email){return this.call('/auth/login','POST',{email,password:email==='admin@gmail.com'?'12345':'CourtlyDemo2026'})}}

const user=new Client();await user.login('player3@courtly.example');
const date=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Ho_Chi_Minh',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(Date.now()+4*86400000));
const view=await user.call('/overview?date='+date);const slot=view.schedules.find(s=>s.court===view.courts.find(c=>c.name==='B04').id&&s.start==='21:00:00');
const order=await user.call('/orders','POST',{scheduleIds:[slot.id],assignments:[],requestId:crypto.randomUUID()});
const intent=await user.call('/transfers','POST',{type:'ORDER',targetId:order.id});
check(intent.mode==='LIVE'&&intent.qrPayload.startsWith('000201010212'),'local VietQR EMV payload');
let crc=0xffff;for(const v of new TextEncoder().encode(intent.qrPayload.slice(0,-4))){crc^=v<<8;for(let i=0;i<8;i++)crc=(crc&0x8000)?(crc<<1)^0x1021:crc<<1;crc&=0xffff}
check(crc.toString(16).toUpperCase().padStart(4,'0')===intent.qrPayload.slice(-4),'QR CRC16 checksum');
await user.fails('/transfers/'+intent.id+'/sandbox','POST',{scenario:'SUCCESS'},404);
const bank=new Client();const notification={id:800001,accountNumber:'999999999999',transferType:'in',content:'PAY '+intent.reference,transferAmount:intent.amount};
check((await bank.raw('/webhooks/sepay','POST',notification)).status===401,'webhook requires API key');
const send=b=>bank.raw('/webhooks/sepay','POST',b,{Authorization:'Apikey '+key});
check((await send({...notification,id:null})).status>=400,'reject absent bank event ID');
check((await send({...notification,accountNumber:'00000'})).status>=400,'reject incorrect receiving account');
check((await send(notification)).status===200,'verified incoming transfer accepted');
check((await send(notification)).status===200,'duplicate event acknowledged');
let current=(await user.call('/overview?date='+date)).orders.find(o=>o.id===order.id);
check(current.paid===intent.amount&&current.status==='CONFIRMED','callback credited once, order confirmed');
check((await send({...notification,transferAmount:intent.amount+1})).status>=400,'reject changed contents for same event ID');
await send({...notification,id:800002,transferAmount:intent.amount*10});
const reviewed=(await user.call('/transfers')).find(x=>x.id===intent.id);
check(reviewed.status==='REVIEW'&&reviewed.reviewAmount===intent.amount*10,'overpayment routed to reconciliation');
current=(await user.call('/overview?date='+date)).orders.find(o=>o.id===order.id);check(current.paid===intent.amount,'overpayment does not alter verified order balance');
console.log('Completed',checks,'local webhook contract checks; no real bank contacted.');
