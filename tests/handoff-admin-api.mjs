import assert from 'node:assert/strict';
const base=process.env.COURTLY_API_URL||'http://127.0.0.1:8083/api';
if(!process.env.COURTLY_TEST_WRITE)throw Error('Set COURTLY_TEST_WRITE=1; run only against a disposable test database.');
let checks=0;const check=(x,msg)=>{assert.ok(x,msg);console.log('PASS',++checks,msg)};
class Client{cookies=new Map();async raw(path,method='GET',body,headers={}){const res=await fetch(base+path,{method,headers:{Cookie:[...this.cookies].map(([k,v])=>k+'='+v).join('; '),'Content-Type':'application/json',...headers},body:body===undefined?undefined:JSON.stringify(body)});for(const c of res.headers.getSetCookie()){const [k,...v]=c.split(';')[0].split('=');this.cookies.set(k,v.join('='))}let data;try{data=await res.json()}catch{data=null}return {status:res.status,data}}
async call(path,method='GET',body){let headers={};if(method!=='GET'){const c=await this.raw('/csrf');headers[c.data.headerName]=c.data.token}const r=await this.raw(path,method,body,headers);if(r.status>=400)throw Object.assign(Error(path+': '+JSON.stringify(r)),r);return r.data}
async fails(path,method,body,status){let failed=false;try{await this.call(path,method,body)}catch(e){failed=true;if(status)assert.equal(e.status,status)}check(failed,'reject '+path)}
async login(email){return this.call('/auth/login','POST',{email,password:email==='admin@gmail.com'?'12345':'CourtlyDemo2026'})}}

const admin=new Client();await admin.login('admin@gmail.com');
const date=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Ho_Chi_Minh',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(Date.now()+31*86400000));
let view=await admin.call('/overview?date='+date);const person=view.staff.find(s=>s.type==='REFEREE');
const result=await admin.call('/catalog/staff-schedules','POST',{staff:person.id,date,start:8.5,end:10.5});
view=await admin.call('/overview?date='+date);const shifts=view.staffSchedules.filter(s=>s.staff===person.id&&s.date===date);
check(shifts.length===4&&shifts.some(s=>s.start===8.5&&s.end===9),'admin creates four half-hour shifts with accurate times');
const first=shifts.find(s=>s.start===8.5);await admin.call('/catalog/staff-schedules/'+first.id,'PUT',{staff:person.id,date,start:8.5,end:9});check(true,'admin edits existing half-hour shift');
await admin.fails('/catalog/staff-schedules','POST',{staff:person.id,date,start:8.25,end:9});
check(view.schedules.length===340,'admin generates future half-hour court calendar');
console.log('Completed',checks,'admin half-hour API checks');
