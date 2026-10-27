import assert from 'node:assert/strict';
assert.equal(process.env.COURTLY_TEST_WRITE,'1','Use a disposable database with DEMO_MODE=false and SMTP unset');
const base=process.env.COURTLY_API_URL||'http://127.0.0.1:8093/api';
let checks=0;function check(value,label){assert.ok(value,label);console.log('PASS',++checks,label)}
class Client {
 cookies=new Map();
 async call(path,method='GET',body,expected=200){
  const headers={'Content-Type':'application/json'};
  if(method!=='GET'){const csrf=await this.call('/csrf');headers[csrf.headerName]=csrf.token;}
  headers.Cookie=[...this.cookies].map(([k,v])=>k+'='+v).join('; ');
  const r=await fetch(base+path,{method,headers,body:body===undefined?undefined:JSON.stringify(body)});
  for(const c of r.headers.getSetCookie()){const [k,...v]=c.split(';')[0].split('=');this.cookies.set(k,v.join('='));}
  const content=await r.text();let data;try{data=JSON.parse(content)}catch{data=content;}
  assert.equal(r.status,expected,path+': '+content);return data;
 }
}
const a=new Client();await a.call('/auth/login','POST',{email:'admin@gmail.com',password:'12345'});
const date=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Ho_Chi_Minh',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(Date.now()+Number(process.env.COURTLY_TEST_DAY_OFFSET||60)*86400000));
const overview=(d=date)=>a.call('/overview?date='+d);
let v=await overview();
check(v.courts.filter(c=>c.type==='INDOOR').length===4&&v.courts.filter(c=>c.type==='VIP').length===2,'four indoor and two VIP courts migrated');
check(v.demoResetEnabled===false,'demo reset hidden outside demo');
await a.call('/catalog/demo-reset','POST',{},403);
check((await overview()).orders.length===v.orders.length,'reset rejected without deleting orders');
const anonymous=new Client();
const forgot=await anonymous.call('/auth/forgot-password','POST',{email:'admin@gmail.com'},503);
check(!forgot.code&&!forgot.devCode,'missing SMTP does not expose OTP outside demo');
await a.call(`/transfers/${crypto.randomUUID()}/sandbox`,'POST',{},403);
check(true,'sandbox rejected outside explicit demo');
const court=v.courts.find(c=>c.status==='ACTIVE');
const payload=Object.fromEntries(['name','type','price','status','description','address','amenities','imageUrl','imageIsIllustration'].map(k=>[k,court[k]]));
await a.call('/catalog/courts/'+court.id,'PUT',payload);
check(true,'migrated court can be edited');
const baseSlots=v.schedules.filter(s=>s.court===court.id&&s.hour>=13&&s.hour<14);
assert.equal(baseSlots.length,2);assert.ok(baseSlots.every(s=>s.status==='AVAILABLE'));
const referee=v.staff.find(s=>s.type==='REFEREE'&&s.status==='ACTIVE');
await a.call('/catalog/staff-schedules','POST',{staff:referee.id,date,start:13,end:14});
const assignments=baseSlots.map(s=>({scheduleId:s.id,staffId:referee.id}));
const made=await a.call('/orders','POST',{name:'Recurring lifecycle regression',phone:'0900000000',scheduleIds:baseSlots.map(s=>s.id),assignments,recurringWeeks:4,requestId:crypto.randomUUID()});
const getOrder=async()=> (await overview()).orders.find(x=>x.id===made.id);
let o=await getOrder();const originalTotal=o.total;let dates=[...new Set(o.slots.map(s=>s.date))].sort();
assert.equal(dates.length,4);
await a.call('/payments','POST',{orderId:o.id,amount:o.total,method:'CASH',transactionCode:'recurring-'+crypto.randomUUID()});
const finish=async()=>{await a.call(`/orders/${o.id}/check-in`,'POST',{reason:'Disposable database regression'});await a.call(`/orders/${o.id}/check-out`,'POST',{});o=await getOrder();};
await finish();
let next=await overview(dates[1]);const nextIds=o.slots.filter(s=>s.date===dates[1]).map(s=>s.id);
check(o.status==='CONFIRMED'&&next.schedules.filter(s=>nextIds.includes(s.id)).every(s=>s.status==='BOOKED'),'checkout releases only first visit; later dates stay booked');
check(o.visits.filter(s=>s.status==='COMPLETED').length===1&&o.total===originalTotal&&o.slots.length===8,'completed visit and full financial totals are preserved');
const settlement=await a.call(`/orders/${o.id}/cancellation-preview`);
check(settlement.refundAmount===baseSlots.reduce((n,s)=>n+s.price,0)*3,'cancellation excludes the value of the completed visit');
// Move the second visit, preserving the completed visit and weeks 3/4.
const newSlots=next.schedules.filter(s=>s.court===court.id&&s.hour>=14&&s.hour<15);
const move={scheduleIds:newSlots.map(s=>s.id),assignments:[],reason:'Move one visit regression',requestId:crypto.randomUUID()};
const preview=await a.call(`/orders/${o.id}/preview`,'POST',move);
await a.call(`/orders/${o.id}/schedule`,'POST',{...move,expectedTotal:preview.next.total});o=await getOrder();
check(o.slots.length===8&&o.total===originalTotal&&o.slots.filter(s=>s.completed).length===2,'move keeps completed charges and the other future visits');
next=await overview(dates[1]);const ext=next.schedules.find(s=>s.court===court.id&&s.hour===15);
await a.call(`/orders/${o.id}/extend`,'POST',{scheduleIds:[ext.id],requestId:crypto.randomUUID()});o=await getOrder();
check(o.total===originalTotal+ext.price&&o.slots.length===9,'extension includes all visits in the order total');
await a.call(`/orders/${o.id}/staff`,'POST',{assignments:[],requestId:crypto.randomUUID()});o=await getOrder();
check(o.total===originalTotal+ext.price&&o.staff.length===2&&o.staff.every(s=>s.completed),'referee edits preserve completed court and referee charges');
await finish();await finish();await finish();
check(o.status==='COMPLETED'&&o.visits.every(s=>s.status==='COMPLETED')&&o.slots.length===9,'order completes only after all four visits finish');
// Cancel/restore must still work for a normal booking.
v=await overview();const restoreSlots=v.schedules.filter(s=>s.court===court.id&&s.hour>=16&&s.hour<17);
const one=await a.call('/orders','POST',{name:'Restore regression',phone:'0900000002',scheduleIds:restoreSlots.map(s=>s.id),assignments:[],requestId:crypto.randomUUID()});
await a.call(`/orders/${one.id}/cancel`,'POST',{reason:'Test restore'});
const restore={scheduleIds:restoreSlots.map(s=>s.id),assignments:[],reason:'Restore regression'};
await a.call(`/orders/${one.id}/preview`,'POST',restore);
await a.call(`/orders/${one.id}/restore`,'POST',restore);
const restored=(await overview()).orders.find(x=>x.id===one.id);
check(restored.status==='HOLDING'&&restored.slots.length===2,'cancelled single booking can still preview and restore');
// Cancelling the remaining visits must retain played history and refundable balance.
v=await overview();const partialSlots=v.schedules.filter(s=>s.court===court.id&&s.hour>=18&&s.hour<19);
const partial=await a.call('/orders','POST',{name:'Partial cancellation regression',phone:'0900000003',scheduleIds:partialSlots.map(s=>s.id),assignments:[],recurringWeeks:2,requestId:crypto.randomUUID()});
let p=(await overview()).orders.find(x=>x.id===partial.id);const full=p.total;
await a.call('/payments','POST',{orderId:p.id,amount:p.total,method:'CASH',transactionCode:'partial-'+crypto.randomUUID()});
await a.call(`/orders/${p.id}/check-in`,'POST',{reason:'Disposable database regression'});
await a.call(`/orders/${p.id}/check-out`,'POST',{});
await a.call(`/orders/${p.id}/cancel`,'POST',{reason:'Cancel unplayed week only'});
p=(await overview()).orders.find(x=>x.id===p.id);
check(p.status==='CANCELLED'&&p.slots.filter(s=>s.completed).length===2&&p.visits.length===2,'partial cancellation keeps completed visit history');
check(p.cancellationSettlement.refundAmount===full/2,'partial cancellation settlement excludes the consumed half');
const replacement=v.schedules.filter(s=>s.court===court.id&&s.hour>=19&&s.hour<20);
const restorePartial={scheduleIds:replacement.map(s=>s.id),assignments:[],reason:'Restore remaining visit'};
const partialPreview=await a.call(`/orders/${p.id}/preview`,'POST',restorePartial);
await a.call(`/orders/${p.id}/restore`,'POST',restorePartial);
p=(await overview()).orders.find(x=>x.id===p.id);
check(p.slots.filter(s=>s.completed).length===2&&p.total===partialPreview.next.total,'restoring a partially played order retains consumed charges');
check(!p.cancellationSettlement&&p.refundPending===Math.max(0,p.paid-p.total),'restoration replaces obsolete cancellation refund with current excess');
console.log('Completed',checks,'recurring and security regression checks');
