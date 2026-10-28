import assert from 'node:assert/strict';
assert.equal(process.env.COURTLY_TEST_WRITE,'1','Use a disposable database with tests/fixtures/voucher-lifecycle.sql loaded');
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
const date=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Ho_Chi_Minh',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(Date.now()+Number(process.env.COURTLY_TEST_DAY_OFFSET||48)*86400000));
const view=(day=date)=>a.call('/overview?date='+day);let v=await view();
const courts=v.courts.filter(c=>c.status==='ACTIVE');
const select=(court,start,hours=1)=>v.schedules.filter(s=>s.court===court.id&&s.hour>=start&&s.hour<start+hours).map(s=>s.id);
const read=async(id)=>(await view()).orders.find(o=>o.id===id);
const available=async(code)=>(await a.call('/public/vouchers?amount=1000000')).find(v=>v.code===code).applicable;
const create=async(code,ids,weeks=1)=>a.call('/orders','POST',{name:'Voucher lifecycle '+code,phone:'0900000091',scheduleIds:ids,assignments:[],recurringWeeks:weeks,voucherCode:code,requestId:crypto.randomUUID()});
const moveRequest=(ids)=>({scheduleIds:ids,assignments:[],reason:'Disposable regression',requestId:crypto.randomUUID()});
const action=(id,op,body={})=>a.call(`/orders/${id}/${op}`,'POST',{reason:'Disposable regression',...body,requestId:crypto.randomUUID()});

const first=await create('REG-PLAYED',select(courts[0],13),2);let o=await read(first.id);
check(!await available('REG-PLAYED'),'creating discounted order consumes the only use');
const proposal=moveRequest(select(courts[0],14));
const preview=await a.call(`/orders/${o.id}/preview`,'POST',proposal);
await a.call(`/orders/${o.id}/schedule`,'POST',{...proposal,expectedTotal:preview.next.total});o=await read(o.id);
check(o.total===preview.next.total&&o.deposit===preview.next.deposit&&preview.difference===0,'same-price voucher move agrees on total, deposit and difference');
await a.call('/payments','POST',{orderId:o.id,amount:o.total,method:'CASH',transactionCode:crypto.randomUUID()});
const later=o.visits[1].date;
await action(o.id,'check-in',{visitDate:later});o=await read(o.id);
check(o.visits.find(v=>v.date===later).status==='CHECKED_IN'&&o.visits.find(v=>v.date===date).status==='CONFIRMED','explicit later visit check-in leaves first visit reserved');
await action(o.id,'check-out');await action(o.id,'cancel');
check(!await available('REG-PLAYED'),'partial cancellation keeps voucher use because a visit was played');
const restore=moveRequest(select(courts[0],14));const restoredPreview=await a.call(`/orders/${o.id}/preview`,'POST',restore);
await action(o.id,'restore',{...restore,expectedTotal:restoredPreview.next.total});o=await read(o.id);
check(o.total===restoredPreview.next.total&&o.voucherBenefit.discount===50000&&!await available('REG-PLAYED'),'partial restore keeps original benefit without consuming another use');

const unused=await create('REG-RETURNED',select(courts[1],13));await action(unused.id,'cancel');
check(await available('REG-RETURNED'),'cancel before play returns the voucher use');
const tooSmall=moveRequest(select(courts[1],13,.5));
await a.call(`/orders/${unused.id}/preview`,'POST',tooSmall,400);
await a.call(`/orders/${unused.id}/restore`,'POST',tooSmall,400);
check((await read(unused.id)).status==='CANCELLED'&&await available('REG-RETURNED'),'restore below minimum rejected without allocating voucher');
const competitor=await create('REG-RETURNED',select(courts[1],16));
const returnRequest=moveRequest(select(courts[1],13));
await a.call(`/orders/${unused.id}/preview`,'POST',returnRequest,400);
await a.call(`/orders/${unused.id}/restore`,'POST',returnRequest,400);
check((await read(unused.id)).status==='CANCELLED','restore cannot bypass a global quota consumed by another order');
await action(competitor.id,'cancel');
const rp=await a.call(`/orders/${unused.id}/preview`,'POST',returnRequest);
await a.call(`/orders/${unused.id}/restore`,'POST',{...returnRequest,expectedTotal:rp.next.total+1},400);
check(await available('REG-RETURNED')&&(await read(unused.id)).status==='CANCELLED','stale expected total rolls back restored allocation and voucher use');
const restoreBody={...returnRequest,expectedTotal:rp.next.total,requestId:crypto.randomUUID()};
await a.call(`/orders/${unused.id}/restore`,'POST',restoreBody);
check(!await available('REG-RETURNED')&&(await read(unused.id)).total===rp.next.total,'successful restore acquires exactly one voucher use');
await a.call(`/orders/${unused.id}/restore`,'POST',restoreBody);
await a.call(`/orders/${unused.id}/restore`,'POST',{...returnRequest,requestId:crypto.randomUUID()},400);
await action(unused.id,'cancel');
check(await available('REG-RETURNED'),'second restore attempt does not double-count usage');

const percent=await create('REG-PERCENT',select(courts[2],13));const initial=await read(percent.id);
const half=moveRequest(select(courts[2],14,.5));const hp=await a.call(`/orders/${percent.id}/preview`,'POST',half);
await a.call(`/orders/${percent.id}/schedule`,'POST',{...half,expectedTotal:hp.next.total});let reduced=await read(percent.id);
check(reduced.total===hp.next.total&&reduced.voucherBenefit.discount===initial.voucherBenefit.discount,'active percentage voucher uses the same agreed discount in preview and save');
await action(percent.id,'cancel');const pp=await a.call(`/orders/${percent.id}/preview`,'POST',half);
await action(percent.id,'restore',{...half,expectedTotal:pp.next.total});reduced=await read(percent.id);
check(reduced.total===pp.next.total&&reduced.voucherBenefit.discount===pp.next.voucherBenefit.discount&&reduced.voucherBenefit.discount<initial.voucherBenefit.discount,'returned percentage voucher is re-evaluated on the restored amount');

// The guest flow uses a different deposit policy; verify its preview as well.
const customer=new Client();await customer.call('/auth/login','POST',{email:'minh.anh@example.com',password:'CourtlyDemo2026'});
const guestDate=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Ho_Chi_Minh',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(Date.now()+3*86400000));
const guestView=await view(guestDate);let pairs=[];
for(const court of guestView.courts.filter(c=>c.status==='ACTIVE')){
 const free=guestView.schedules.filter(s=>s.court===court.id&&s.status==='AVAILABLE').sort((a,b)=>a.hour-b.hour);
 for(let i=0;i<free.length-1;i++)if(free[i+1].hour===free[i].hour+.5){pairs.push([free[i].id,free[i+1].id]);i++;}
 if(pairs.length>=2)break;pairs=[];
}
assert.ok(pairs.length>=2,'fixture needs two free pairs within customer booking window');
const guest=await customer.call('/orders','POST',{name:'Guest voucher preview',phone:'0900000092',scheduleIds:pairs[0],assignments:[],voucherCode:'REG-RETURNED',requestId:crypto.randomUUID()});
const gp=await customer.call(`/orders/${guest.id}/preview`,'POST',moveRequest(pairs[1]));
await customer.call(`/orders/${guest.id}/schedule`,'POST',{...moveRequest(pairs[1]),expectedTotal:gp.next.total});
const guestAfter=(await view(guestDate)).orders.find(o=>o.id===guest.id);
check(guestAfter.total===gp.next.total&&guestAfter.deposit===gp.next.deposit,'guest voucher preview agrees with actual total and customer deposit');
check(guestAfter.total===Math.max(0,guestAfter.slots.reduce((n,s)=>n+s.price,0)-(guestAfter.membershipBenefit?.discount||0)-50000),'guest total combines membership benefit and voucher once');
await action(guest.id,'cancel');
console.log('Completed',checks,'voucher lifecycle checks');
