import assert from 'node:assert/strict';
assert.equal(process.env.COURTLY_TEST_WRITE,'1','Use a disposable database with seeded courts/referees');
const base=process.env.COURTLY_API_URL||'http://127.0.0.1:8093/api';
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
const date=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Ho_Chi_Minh',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(Date.now()+Number(process.env.COURTLY_TEST_DAY_OFFSET||45)*86400000));
const view=()=>a.call('/overview?date='+date);let v=await view();
const courts=v.courts.filter(c=>c.status==='ACTIVE');const referee=v.staff.find(s=>s.type==='REFEREE'&&s.status==='ACTIVE');
await a.call('/catalog/staff-schedules','POST',{staff:referee.id,date,start:13,end:17});
const cases=[];
for(const withReferee of [false,true]){
 const court=courts[withReferee?1:0];
 const selected=(hour)=>v.schedules.filter(s=>s.court===court.id&&s.hour>=hour&&s.hour<hour+1);
 const ids=(hour)=>selected(hour).map(s=>s.id);
 const assignments=(hour)=>withReferee?ids(hour).map(scheduleId=>({scheduleId,staffId:referee.id})):[];
 const made=await a.call('/orders','POST',{name:'Same-day regression '+(withReferee?'referee':'court'),phone:'0900000085',scheduleIds:ids(13),assignments:assignments(13),recurringWeeks:2,requestId:crypto.randomUUID()});
 const read=async()=> (await view()).orders.find(o=>o.id===made.id);let o=await read();
 const originalTotal=o.total;
 await a.call('/payments','POST',{orderId:o.id,amount:o.total,method:'CASH',transactionCode:crypto.randomUUID()});
 await a.call(`/orders/${o.id}/check-in`,'POST',{reason:'Isolated regression'});await a.call(`/orders/${o.id}/check-out`,'POST',{});
 await a.call(`/orders/${o.id}/cancel`,'POST',{reason:'Isolated regression'});
 await a.call(`/orders/${o.id}/restore`,'POST',{scheduleIds:ids(14),assignments:[],reason:'Restore on same day',requestId:crypto.randomUUID()});o=await read();
 const playedSlots=o.slots.filter(s=>s.completed);const playedStaff=o.staff.filter(s=>s.completed);
 check(playedSlots.length===2&&o.total===originalTotal,'restore same day keeps completed court/referee charges: '+withReferee);
 const change={scheduleIds:ids(15),assignments:assignments(15),reason:'Move only remaining visit',requestId:crypto.randomUUID()};
 const preview=await a.call(`/orders/${o.id}/preview`,'POST',change);
 const addedStaff=withReferee?referee.rate:0;
 check(preview.next.total===originalTotal+addedStaff&&preview.difference===addedStaff,'preview includes played same-day charges: '+withReferee);
 check(preview.next.slots.filter(s=>s.completed).length===2&&preview.next.staff.filter(s=>s.completed).length===playedStaff.length,'preview retains completed court/referee rows: '+withReferee);
 await a.call(`/orders/${o.id}/schedule`,'POST',{...change,expectedTotal:preview.next.total});o=await read();
 check(o.total===preview.next.total&&o.deposit===preview.next.deposit&&o.slots.filter(s=>!s.completed).every(s=>ids(15).includes(s.id)),'confirmation agrees with preview and moves only unplayed slots: '+withReferee);
 check(JSON.stringify(o.slots.filter(s=>s.completed))===JSON.stringify(playedSlots)&&JSON.stringify(o.staff.filter(s=>s.completed))===JSON.stringify(playedStaff),'completed price snapshots and referee history remain unchanged: '+withReferee);
 await a.call('/booking/options','POST',{scheduleIds:ids(15),excludeId:o.id});
 await a.call(`/orders/${o.id}/staff`,'POST',{assignments:[],requestId:crypto.randomUUID()});o=await read();
 check(o.total===originalTotal&&o.staff.every(s=>s.completed),'editing remaining referee coverage preserves fees already used: '+withReferee);
 // Record the exact case for optional browser verification, without exposing any credentials.
 cases.push({id:o.id,date,courtName:court.name,withReferee,total:o.total});
}
if(process.env.COURTLY_CASE_OUTPUT){const fs=await import('node:fs/promises');await fs.writeFile(process.env.COURTLY_CASE_OUTPUT,JSON.stringify(cases));}
console.log('Completed',checks,'same-day restored visit checks');
