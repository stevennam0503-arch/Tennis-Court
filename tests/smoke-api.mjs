import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
export async function runSmoke(base=process.env.COURTLY_API_URL||'http://localhost:8080/api'){
 let requests=0;const results=[];
 class Client {
  cookies=new Map();csrf=null;
  async call(path,method='GET',body,expected=200){
   if(!['GET','HEAD'].includes(method)&&!this.csrf){const r=await this.call('/csrf');this.csrf=r;}
   const r=await fetch(base+path,{method,headers:{'content-type':'application/json',origin:new URL(base).origin,cookie:[...this.cookies].map(([k,v])=>k+'='+v).join('; '),...(this.csrf?{[this.csrf.headerName]:this.csrf.token}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})});requests++;
   for(const raw of r.headers.getSetCookie()){const pair=raw.split(';')[0],index=pair.indexOf('=');this.cookies.set(pair.slice(0,index),pair.slice(index+1));}
   const text=await r.text();let data;try{data=text?JSON.parse(text):{};}catch{data={raw:text.slice(0,300)};}
   if(expected!==null)assert.equal(r.status,expected,`${method} ${path}: ${r.status} ${JSON.stringify(data)}`);
   return expected===null?{status:r.status,body:data}:data;
  }
 }
 const anon=new Client(),admin=new Client(),alice=new Client(),bob=new Client();
 const date=new Date(Date.now()+3*86400000).toISOString().slice(0,10),suffix=randomUUID().slice(0,8),password='CourtlyCustomer!2026';
 const emailA=`alice-${suffix}@example.com`,emailB=`bob-${suffix}@example.com`;
 assert.equal((await anon.call('/auth/session')).authenticated,false);
 const pub=await anon.call('/public/overview?date='+date);assert.equal(pub.accounts.length,0);assert.equal(pub.orders.length,0);assert(pub.courts.length>=2);results.push('Public overview does not expose private records');
 await anon.call('/overview?date='+date,'GET',undefined,401);
 await admin.call('/auth/login','POST',{email:process.env.ADMIN_EMAIL||'admin@courtly.local',password:process.env.ADMIN_PASSWORD||'CourtlyLocal!2026'});
 const sa=await alice.call('/auth/register','POST',{name:'Alice Test',email:emailA,password});const sb=await bob.call('/auth/register','POST',{name:'Bob Test',email:emailB,password});assert.equal(sa.user.role,'CUSTOMER');
 await alice.call('/catalog/courts','POST',{name:'Unauthorized'},403);results.push('Registration, cookie sessions, role enforcement');
 const raw=await admin.call('/overview?date='+date);assert(raw.viewer.role==='ADMIN');const c1=raw.courts.find(c=>c.status==='ACTIVE'),c2=raw.courts.find(c=>c.status==='ACTIVE'&&c.id!==c1.id),ref=raw.staff.find(s=>s.type==='REFEREE');
 if(!raw.staffSchedules?.some(s=>s.staff===ref.id)) await admin.call('/catalog/staff-schedules','POST',{staff:ref.id,date,start:6,end:23});
 const slot=(c,h)=>raw.schedules.find(s=>s.court===c.id&&s.hour===h).id;
 const selected=[slot(c1,18),slot(c1,18.5)],assignment={scheduleId:selected[1],staffId:ref.id};
 const opt=await alice.call('/booking/options','POST',{scheduleIds:selected});assert(opt.staffSlots[1].staff.find(s=>s.id===ref.id).available);
 const payload={requestId:randomUUID(),scheduleIds:selected,assignments:[assignment]};const order=await alice.call('/orders','POST',payload);assert.equal((await alice.call('/orders','POST',payload)).id,order.id);assert.equal((await alice.call('/orders','POST',{assignments:payload.assignments,scheduleIds:payload.scheduleIds,requestId:payload.requestId})).id,order.id);
 await alice.call('/orders','POST',{...payload,scheduleIds:[slot(c1,20)]},400);
 let snapshot=await alice.call('/overview?date='+date),o=snapshot.orders.find(o=>o.id===order.id);assert.equal(o.staff.length,1);assert.equal(o.staff[0].scheduleId,selected[1]);assert.equal(o.staff[0].hours,0.5);assert.equal(snapshot.accounts.length,1);assert.equal(snapshot.staff.length,0);assert.equal(o.total,o.slots.reduce((n,s)=>n+s.price,0)+ref.rate/2);
 await bob.call(`/orders/${order.id}/cancel`,'POST',{},403);await alice.call(`/orders/${order.id}/services`,'POST',{},403);
 const conflict=await bob.call('/orders','POST',{requestId:randomUUID(),scheduleIds:selected,assignments:[]},null);assert([400,409].includes(conflict.status));results.push('Continuous multi-slot booking, exact referee slot, idempotency, ownership, conflict');
 const receipt=await admin.call('/payments','POST',{orderId:order.id,amount:o.total,method:'CASH',transactionCode:'full-'+suffix});
 o=(await alice.call('/overview?date='+date)).orders.find(o=>o.id===order.id);assert.equal(o.status,'CONFIRMED');assert.equal(o.finance.paymentStatus,'PAID');
 await admin.call(`/orders/${order.id}/invoice`,'POST',{});
 const move={requestId:randomUUID(),scheduleIds:[slot(c1,15)],assignments:[]};const preview=await alice.call(`/orders/${order.id}/preview`,'POST',move);assert(preview.reviewAmount>0);await alice.call(`/orders/${order.id}/schedule`,'PATCH',move);
 o=(await alice.call('/overview?date='+date)).orders.find(o=>o.id===order.id);assert.equal(o.staff.length,0);assert(o.invoiceSnapshot);assert.equal(o.paid,o.invoiceSnapshot.total);assert(o.history.some(x=>x.type==='SCHEDULE'));
 const excess=o.paid-o.total;const refund={requestId:randomUUID(),amount:excess,reason:'Actual cash refund in test'};const refunded=await admin.call(`/payments/${receipt.id}/refunds`,'POST',refund);assert.equal((await admin.call(`/payments/${receipt.id}/refunds`,'POST',refund)).id,refunded.id);results.push('Verified receipts, cheaper atomic reschedule, preserved invoice, idempotent refund');
 await admin.call(`/orders/${order.id}/check-in`,'POST',{reason:'Test authorized early check-in'});await alice.call(`/orders/${order.id}/cancel`,'POST',{},400);await admin.call(`/orders/${order.id}/check-out`,'POST',{});
 const bo=await bob.call('/orders','POST',{requestId:randomUUID(),scheduleIds:[slot(c2,18),slot(c2,18.5),slot(c2,19),slot(c2,19.5)],assignments:[]});await admin.call(`/orders/${bo.id}/services`,'POST',{requestId:randomUUID(),rentals:[]},400);
 await admin.call(`/orders/${bo.id}/products`,'POST',{productId:randomUUID(),type:'DRINK',quantity:1},400);
 assert.equal((await bob.call('/overview?date='+date)).orders.find(o=>o.id===bo.id).products.length,0);results.push('Retired product and rental endpoints reject new services');
 const fb=await alice.call('/feedback','POST',{requestId:randomUUID(),rating:5,topic:'WEBSITE',message:'This is a private test feedback message.',publishConsent:false});await admin.call('/content/feedback/'+fb.id,'PATCH',{status:'PUBLISHED',reply:'Thanks'},400);
 const publicFb=await bob.call('/feedback','POST',{requestId:randomUUID(),rating:4,topic:'COURT',message:'This is a publishable test feedback message.',publishConsent:true});await admin.call('/content/feedback/'+publicFb.id,'PATCH',{status:'PUBLISHED',reply:'Thanks'});
 const publicContent=await anon.call('/public/content');assert(publicContent.feedback.some(f=>f.id===publicFb.id));assert(!publicContent.feedback.some(f=>f.id===fb.id));assert(!JSON.stringify(publicContent.feedback).includes(sa.user.accountId));
 const article=await admin.call('/content/articles','POST',{title:'Test news',excerpt:'Test excerpt',body:'Plain text article',category:'NEWS',status:'PUBLISHED',tournamentId:''});assert((await anon.call('/public/content')).articles.some(a=>a.id===article.id));results.push('Content publishing, own feedback, consent and private-data isolation');
 const draft=await admin.call('/content/articles','POST',{title:'Draft test',excerpt:'Draft excerpt',body:'Draft body',category:'NEWS',status:'DRAFT',tournamentId:''});await admin.call('/content/articles/'+draft.id,'PUT',{title:'Published draft',excerpt:'Published excerpt',body:'Published body',category:'NEWS',status:'PUBLISHED',tournamentId:''});assert((await anon.call('/public/content')).articles.find(a=>a.id===draft.id).publishedAt);
 const csrfDenied=await fetch(base+'/profile',{method:'PATCH',headers:{'content-type':'application/json',origin:new URL(base).origin,cookie:[...alice.cookies].map(([k,v])=>k+'='+v).join('; ')},body:JSON.stringify({name:'Forged',phone:''})});requests++;assert.equal(csrfDenied.status,403);
 const memberships=await alice.call('/overview?date='+date);assert(memberships.membershipPlans.length>=2);const plan=memberships.membershipPlans.find(p=>p.id==='club');
 const application=await alice.call('/membership/requests','POST',{requestId:randomUUID(),planId:plan.id});await alice.call(`/membership/requests/${application.id}/activate`,'POST',{requestId:randomUUID(),amount:plan.price,method:'CASH',transactionCode:'forged',collected:true},403);
 await admin.call(`/membership/requests/${application.id}/activate`,'POST',{requestId:randomUUID(),amount:plan.price,method:'CASH',transactionCode:'unverified-'+suffix,collected:false},400);
 const activation={requestId:randomUUID(),amount:plan.price,method:'CASH',transactionCode:'membership-'+suffix,collected:true};await admin.call(`/membership/requests/${application.id}/activate`,'POST',activation);await admin.call(`/membership/requests/${application.id}/activate`,'POST',activation);
 const memberView=await alice.call('/overview?date='+date);assert(memberView.memberships.some(m=>m.id===application.id&&m.status==='ACTIVE'));assert.equal(memberView.membershipPayments.length,1);assert.equal((await bob.call('/overview?date='+date)).memberships.length,0);
 const memberSlots=[slot(c1,20)];const memberQuote=await alice.call('/booking/options','POST',{scheduleIds:memberSlots});assert(memberQuote.courtQuote.discount>0);const mo=await alice.call('/orders','POST',{requestId:randomUUID(),scheduleIds:memberSlots,assignments:[]});const discounted=(await alice.call('/overview?date='+date)).orders.find(o=>o.id===mo.id);assert.equal(discounted.total,memberQuote.courtQuote.net);assert.equal(discounted.membershipBenefit.discount,memberQuote.courtQuote.discount);
 results.push('Membership registration, verified activation, exact-once receipt, private data and server discount');
 const tournament=await admin.call('/catalog/tournaments','POST',{name:'Test Singles '+suffix,format:'SINGLES',status:'OPEN',startDate:date,endDate:date,deadline:date,location:'Test Club',fee:0,max:2});
 await alice.call(`/tournaments/${tournament.id}/registrations`,'POST',{accountId:sb.user.accountId,name:'Forged',members:[]},403);
 const regA=await alice.call(`/guest/tournaments/${tournament.id}/register`,'POST',{name:'Alice',phone:'0900000001',adult:true,rules:true,requestId:randomUUID()});await bob.call(`/guest/tournaments/${tournament.id}/register`,'POST',{name:'Bob',phone:'0900000002',adult:true,rules:true,requestId:randomUUID()});await alice.call(`/tournaments/${tournament.id}/draw`,'POST',{},403);await admin.call(`/tournaments/${tournament.id}/draw`,'POST',{});
 const tourView=await admin.call('/overview?date='+date);const match=tourView.matches.find(m=>m.tournamentId===tournament.id);await admin.call(`/matches/${match.id}/schedule`,'PUT',{scheduleIds:[slot(c2,12)],staffId:ref.id});await admin.call(`/matches/${match.id}/result`,'POST',{winnerId:regA.id,score:'6-4, 6-3'});assert.equal((await admin.call('/overview?date='+date)).tournaments.find(t=>t.id===tournament.id).status,'FINISHED');results.push('Tournament registration ownership, bracket, court/referee allocation and result progression');
 const contenders=await Promise.all([alice,bob].map(client=>client.call('/orders','POST',{requestId:randomUUID(),scheduleIds:[slot(c2,21)],assignments:[]},null)));assert.deepEqual(contenders.map(r=>r.status).sort(),[200,400]);results.push('Concurrent bookings commit exactly one allocation');
 await alice.call('/profile','PATCH',{name:'Alice Updated',phone:'0900000000'});assert.equal((await alice.call('/auth/session')).user.name,'Alice Updated');await alice.call('/profile','PATCH',{name:'Alice',phone:'',role:'ADMIN'},400);
 const ticket=await admin.call('/auth/ticket','POST',{accountId:sa.user.accountId});const activated=new Client();await activated.call('/auth/activate','POST',{token:ticket.token,password:'NewCustomerPass!2026'});await new Client().call('/auth/activate','POST',{token:ticket.token,password:'AnotherPass!2026'},400);await alice.call('/overview?date='+date,'GET',undefined,401);results.push('Profile field allowlist, single-use reset ticket and old-session revocation');
 const state=await admin.call('/overview?date='+date);console.log('PASS',results.length,'groups,',requests,'HTTP requests');return {passed:true,requests,groups:results,state};
}
if(import.meta.url===new URL(process.argv[1]||'', 'file:').href)await runSmoke();
