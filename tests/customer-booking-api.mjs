import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {execFileSync} from 'node:child_process';

assert.equal(process.env.COURTLY_TEST_WRITE,'1','Run only against a disposable database');
const base=process.env.COURTLY_API_URL||'http://127.0.0.1:8084/api';
const key=process.env.COURTLY_TEST_WEBHOOK_KEY;
assert.ok(key,'A local webhook test key is required');
const db=process.env.COURTLY_TEST_DB||'courtly_booking_test';
assert.match(db,/^courtly_booking_test(?:_[a-z0-9_]+)?$/);
let checks=0;
const check=(condition,label)=>{assert.ok(condition,label);console.log('PASS',++checks,label)};
class Client{
 cookies=new Map();
 async raw(path,method='GET',body,headers={}){
  if(method!=='GET'&&!path.startsWith('/webhooks/')){
   const csrf=await this.raw('/csrf');headers={...headers,[csrf.data.headerName]:csrf.data.token};
  }
  const r=await fetch(base+path,{method,headers:{'content-type':'application/json',cookie:[...this.cookies].map(([k,v])=>k+'='+v).join('; '),...headers},body:body===undefined?undefined:JSON.stringify(body)});
  for(const c of r.headers.getSetCookie()){const pair=c.split(';')[0],i=pair.indexOf('=');this.cookies.set(pair.slice(0,i),pair.slice(i+1))}
  const text=await r.text();return {status:r.status,data:text?JSON.parse(text):null};
 }
 async call(path,method='GET',body){const r=await this.raw(path,method,body);assert.ok(r.status<400,`${method} ${path}: ${r.status} ${JSON.stringify(r.data)}`);return r.data}
}
const anon=new Client(),admin=new Client(),a=new Client(),b=new Client();
await admin.call('/auth/login','POST',{email:process.env.ADMIN_EMAIL||'admin@gmail.com',password:process.env.ADMIN_PASSWORD||'12345'});
for(const [c,name] of [[a,'Alice'],[b,'Bob']])await c.call('/auth/register','POST',{name,email:`booking-${randomUUID()}@example.com`,password:'CustomerBooking!2026'});
const date=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Ho_Chi_Minh',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(Date.now()+4*86400000));
const view=await anon.call('/public/overview?date='+date);
check(view.settings.holdMinutes===5&&view.settings.policies.cancelCutoffMinutes===1440,'five-minute hold and 24-hour default cancellation policy');
check(view.refereeRates.length>0&&!JSON.stringify(view.refereeRates).includes('phone'),'public referee prices without private staff fields');
const court=zone=>view.courts.find(c=>c.name.startsWith(zone)&&c.status==='ACTIVE');
const slot=(zone,hour)=>view.schedules.find(s=>s.court===court(zone).id&&s.hour===hour);
const orderBody=slots=>({scheduleIds:slots.map(s=>s.id),assignments:[],requestId:randomUUID()});
check((await anon.raw('/orders','POST',orderBody([slot('A',6)]))).status===401,'anonymous users cannot create an order');
const raced=await Promise.all([a.raw('/orders','POST',orderBody([slot('A',6)])),b.raw('/orders','POST',orderBody([slot('A',6)]))]);
check(raced.filter(r=>r.status===200).length===1&&raced.filter(r=>r.status===400).length===1,'concurrent customers: exactly one hold succeeds');
const winner=raced[0].status===200?a:b,loser=winner===a?b:a,held=raced.find(r=>r.status===200).data;
let heldView=(await winner.call('/overview?date='+date)).orders.find(o=>o.id===held.id);
check(heldView.status==='HOLDING'&&Date.parse(heldView.holdUntil)-Date.now()>285000,'pending order reserves a slot immediately for five minutes');
check((await loser.raw(`/orders/${held.id}/cancel`,'POST',{requestId:randomUUID()})).status===403,'another customer cannot cancel a hold');
const intent=await winner.call('/transfers','POST',{type:'ORDER',targetId:held.id});
await winner.call(`/transfers/${intent.id}/declared`,'POST',{});
check((await winner.call('/overview?date='+date)).orders.find(o=>o.id===held.id).paid===0,'declaring a transfer does not credit money');
check((await winner.raw(`/transfers/${intent.id}/confirm`,'POST',{})).status===403,'customer self-confirmation is rejected');
check((await winner.raw(`/transfers/${intent.id}/sandbox`,'POST',{scenario:'SUCCESS'})).status===403,'customer cannot simulate a payment');
check((await admin.raw(`/transfers/${intent.id}/sandbox`,'POST',{scenario:'SUCCESS'})).status===403,'sandbox cannot run in LIVE mode, including for admin');
check((await admin.raw(`/admin/transfers/${intent.id}/confirm`,'POST',{})).status===403,'manual online confirmation cannot bypass bank verification');
check((await winner.raw('/payments','POST',{orderId:held.id,amount:intent.amount,method:'CASH',transactionCode:randomUUID()})).status===403,'customer cannot create a cash receipt');
check((await admin.raw('/payments','POST',{orderId:held.id,amount:intent.amount,method:'BANK_TRANSFER',transactionCode:randomUUID()})).status===400,'online receipts require a bank callback');
const bank=new Client();let eventId=Date.now();
const notification=(i,amount=i.amount)=>({id:++eventId,accountNumber:'999999999999',transferType:'in',content:'PAY '+i.reference,transferAmount:amount});
const send=body=>bank.raw('/webhooks/sepay','POST',body,{Authorization:'Apikey '+key});
let event=notification(intent);
check((await bank.raw('/webhooks/sepay','POST',event)).status===401,'unauthenticated webhook rejected');
check((await send({...event,accountNumber:'00000'})).status===400,'wrong receiving bank account rejected');
const callbacks=await Promise.all([send(event),send(event)]);
check(callbacks.every(r=>r.status===200),'simultaneous duplicate callbacks acknowledged');
heldView=(await winner.call('/overview?date='+date)).orders.find(o=>o.id===held.id);
check(heldView.paid===intent.amount&&heldView.status==='CONFIRMED','bank callback credits the deposit exactly once and confirms booking');
check((await send({...event,transferAmount:event.transferAmount+1})).status===400,'same event ID cannot carry changed payment data');
// Enforce the configured deadline for both preview and the final mutation.
const settings=(await admin.call('/overview?date='+date)).settings;
await admin.call('/settings','PUT',{...settings,policies:{...settings.policies,cancelCutoffMinutes:10080,changeCutoffMinutes:10080}});
check((await winner.raw(`/orders/${held.id}/cancellation-preview`)).status===400,'cancellation preview enforces deadline');
check((await winner.raw(`/orders/${held.id}/cancel`,'POST',{requestId:randomUUID()})).status===400,'cancellation commit enforces deadline');
check((await winner.raw(`/orders/${held.id}/schedule`,'PATCH',{...orderBody([slot('A',7)]),reason:'test'})).status===400,'reschedule commit enforces deadline');
await admin.call('/settings','PUT',settings);
const quote=await winner.call(`/orders/${held.id}/cancellation-preview`);
check(quote.refundAmount===heldView.paid&&quote.retainedAmount===0,'eligible cancellation quotes the refundable amount');
const cancelBody={requestId:randomUUID()};await winner.call(`/orders/${held.id}/cancel`,'POST',cancelBody);await winner.call(`/orders/${held.id}/cancel`,'POST',cancelBody);
heldView=(await winner.call('/overview?date='+date)).orders.find(o=>o.id===held.id);
check(heldView.status==='CANCELLED'&&heldView.finance.refundPending===intent.amount&&heldView.paid===intent.amount,'cancel paid booking: release slot, queue refund, preserve collected balance');
check(heldView.history.filter(h=>h.type==='CANCEL').length===1&&heldView.history.at(-1).previous.status==='CONFIRMED','cancellation history is idempotent and preserves prior booking');
await loser.call('/orders','POST',orderBody([slot('A',6)]));
check(true,'released slot can be reserved by another customer');
// Expire only a test-owned hold, then book directly without an overview refresh.
const expired=await a.call('/orders','POST',orderBody([slot('A',8)]));
const lateIntent=await a.call('/transfers','POST',{type:'ORDER',targetId:expired.id});
assert.match(expired.id,/^[a-f0-9-]{36}$/);
execFileSync('docker',['compose','-p','courtly-cloud','exec','-T','postgres','psql','-U','courtly','-d',db,'-v','ON_ERROR_STOP=1','-c',`UPDATE orders SET hold_expires_at=NOW()-INTERVAL '1 second' WHERE id='${expired.id}'`],{cwd:new URL('..',import.meta.url),stdio:'pipe'});
await b.call('/orders','POST',orderBody([slot('A',8)]));
check((await a.call('/overview?date='+date)).orders.find(o=>o.id===expired.id).status==='EXPIRED','expired hold is released before the next booking command');
check((await send(notification(lateIntent))).status===200,'late money event is acknowledged');
check((await a.call('/transfers')).find(i=>i.id===lateIntent.id).status==='REVIEW','late payment enters reconciliation instead of reclaiming another booking');
// A fully paid VIP booking may move to a cheaper available court; report credit and history.
const vip=await a.call('/orders','POST',orderBody([slot('V',10),slot('V',10.5)]));
let vipView=(await a.call('/overview?date='+date)).orders.find(o=>o.id===vip.id);
await admin.call('/payments','POST',{orderId:vip.id,amount:vipView.total,method:'CASH',transactionCode:randomUUID()});
const move={...orderBody([slot('A',10),slot('A',10.5)]),reason:'Change to outdoor'};
const preview=await a.call(`/orders/${vip.id}/preview`,'POST',move);
check(preview.difference<0&&preview.reviewAmount>0,'reschedule preview reports cheaper price and amount pending refund');
await a.call(`/orders/${vip.id}/schedule`,'PATCH',move);
vipView=(await a.call('/overview?date='+date)).orders.find(o=>o.id===vip.id);
check(vipView.status==='CONFIRMED'&&vipView.total===preview.next.total&&vipView.finance.refundPending===preview.reviewAmount,'paid reschedule updates booking and queues the excess for refund');
check(vipView.history.some(h=>h.type==='SCHEDULE'&&h.previous.total>h.total),'reschedule records previous booking and amount');
const other=await b.call('/orders','POST',orderBody([slot('A',11)]));
check((await a.raw(`/orders/${vip.id}/schedule`,'PATCH',{...orderBody([slot('A',11)]),reason:'conflict'})).status===400,'reschedule cannot steal another active hold');
check((await a.call('/overview?date='+date)).orders.find(o=>o.id===vip.id).slots[0].id===vipView.slots[0].id,'failed reschedule rolls back and preserves the old booking');
// A STAFF account can collect cash, but cannot access management or refunds.
const staffEmail=`cashier-${randomUUID()}@example.com`;
const staffAccount=await admin.call('/catalog/accounts','POST',{name:'Test Cashier',email:staffEmail,phone:'0900000009',role:'STAFF',status:'ACTIVE'});
const ticket=await admin.call('/auth/ticket','POST',{accountId:staffAccount.id});
const staff=new Client();await staff.call('/auth/activate','POST',{token:ticket.token,password:'CashierBooking!2026'});
const cashDesk=await staff.call('/payments/cash-desk');
check(cashDesk.some(o=>o.id===other.id),'STAFF can view unpaid bookings at the cash desk');
check((await a.raw('/payments/cash-desk')).status===403,'customers cannot access cash desk bookings');
const otherView=(await b.call('/overview?date='+date)).orders.find(o=>o.id===other.id);
const cashBody={orderId:other.id,amount:otherView.deposit,method:'CASH',transactionCode:randomUUID()};
const receipt=await staff.call('/payments','POST',cashBody);const repeated=await staff.call('/payments','POST',cashBody);
check(receipt.id===repeated.id&&(await b.call('/overview?date='+date)).orders.find(o=>o.id===other.id).paid===otherView.deposit,'STAFF confirms actual cash once with an idempotent receipt');
check((await staff.raw('/catalog/accounts','POST',{name:'Forbidden'})).status===403,'STAFF cannot create privileged accounts');
check((await staff.raw(`/payments/${receipt.id}/refunds`,'POST',{requestId:randomUUID(),amount:1,reason:'Forbidden'})).status===403,'cashier role does not grant refund approval');
check((await staff.raw(`/transfers/${intent.id}/confirm`,'POST',{})).status===403,'STAFF cannot self-confirm online payments');
await admin.call('/settings','PUT',{...settings,cancelRefundPercent:50});
const partialQuote=await b.call(`/orders/${other.id}/cancellation-preview`);
check(partialQuote.refundAmount===Math.round(otherView.deposit/2)&&partialQuote.retainedAmount===otherView.deposit-partialQuote.refundAmount,'configured partial refund separates refundable and retained funds');
await b.call(`/orders/${other.id}/cancel`,'POST',{requestId:randomUUID()});
await admin.call(`/payments/${receipt.id}/refunds`,'POST',{requestId:randomUUID(),amount:partialQuote.refundAmount,reason:'Local test: refund actually processed'});
const settled=(await b.call('/overview?date='+date)).orders.find(o=>o.id===other.id);
check(settled.finance.refundPending===0&&settled.paid===partialQuote.retainedAmount&&!settled.finance.review,'recorded refund clears pending review and preserves the policy retention');
await admin.call('/settings','PUT',settings);
console.log(`Completed ${checks} customer booking and payment checks against a disposable database.`);
