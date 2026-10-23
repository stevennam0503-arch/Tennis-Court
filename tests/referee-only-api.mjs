import assert from 'node:assert/strict';
assert.equal(process.env.COURTLY_TEST_WRITE,'1','Use a disposable database');
const base=process.env.COURTLY_API_URL||'http://127.0.0.1:8091/api';
let checks=0;function check(condition,label){assert.ok(condition,label);console.log('PASS',++checks,label)}
class Client{
 cookies=new Map();
 async call(path,method='GET',body,expected=200){
  let headers={'Content-Type':'application/json'};
  if(method!=='GET'){const csrf=await this.call('/csrf');headers[csrf.headerName]=csrf.token}
  headers.Cookie=[...this.cookies].map(([k,v])=>k+'='+v).join('; ');
  const r=await fetch(base+path,{method,headers,body:body===undefined?undefined:JSON.stringify(body)});
  for(const c of r.headers.getSetCookie()){const [k,...v]=c.split(';')[0].split('=');this.cookies.set(k,v.join('='))}
  const content=await r.text();let data;try{data=JSON.parse(content)}catch{data=content}
  assert.equal(r.status,expected,path+': '+content);return data;
 }
}
const a=new Client();await a.call('/auth/login','POST',{email:'admin@gmail.com',password:'12345'});
const date=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Ho_Chi_Minh',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(Date.now()+Number(process.env.COURTLY_TEST_DAY_OFFSET||43)*86400000));
let v=await a.call('/overview?date='+date);
check(v.products.length===0&&v.orders.every(o=>o.products.length===0),'fresh fixture has no product catalog or product charges');
const referee=v.staff.find(s=>s.type==='REFEREE');
await a.call('/catalog/staff-schedules','POST',{staff:referee.id,date,start:12,end:13.5});
const court=v.courts.find(c=>c.status==='ACTIVE');const slots=v.schedules.filter(s=>s.court===court.id&&s.hour>=12&&s.hour<13.5);
assert.equal(slots.length,3);
const assignments=slots.map(s=>({scheduleId:s.id,staffId:referee.id}));
const options=await a.call('/booking/options','POST',{scheduleIds:slots.map(s=>s.id)});
check(options.staffSlots.every(s=>s.staff.every(p=>v.staff.find(x=>x.id===p.id).type==='REFEREE')),'booking offers only referees');
const made=await a.call('/orders','POST',{name:'Referee regression',phone:'0900000001',scheduleIds:slots.map(s=>s.id),assignments,requestId:crypto.randomUUID()});
v=await a.call('/overview?date='+date);let o=v.orders.find(o=>o.id===made.id);
check(o.staff.length===3&&o.staff.reduce((n,s)=>n+s.hours,0)===1.5,'90-minute booking assigns three half-hour referee slots');
check(o.total===slots.reduce((n,s)=>n+s.price,0)+referee.rate*1.5,'total contains only court and actual referee time');
for(const path of ['/catalog/drinks','/catalog/rentals'])await a.call(path,'POST',{name:'Retired',price:10000,stock:5,status:'ACTIVE'},400);
for(const action of ['products','services'])await a.call(`/orders/${o.id}/${action}`,'POST',{requestId:crypto.randomUUID(),type:'DRINK',productId:crypto.randomUUID(),quantity:1,rentals:[]},400);
await a.call(`/orders/${o.id}/services`,'GET',undefined,405);
await a.call(`/orders/${o.id}/products/${crypto.randomUUID()}/return`,'POST',{},404);
check(true,'retired catalog, sales, rental and return endpoints reject writes');
await a.call(`/orders/${o.id}/staff`,'POST',{assignments:assignments.slice(0,1),requestId:crypto.randomUUID()});
v=await a.call('/overview?date='+date);o=v.orders.find(x=>x.id===o.id);
check(o.staff.length===1&&o.total===slots.reduce((n,s)=>n+s.price,0)+referee.rate*.5,'admin can change referee coverage without adding other services');
const coach=await a.call('/catalog/staff','POST',{name:'Non-billable test staff',type:'COACH',phone:'0900000099',rate:100000,status:'ACTIVE'});
await a.call('/catalog/staff-schedules','POST',{staff:coach.id,date,start:12,end:13.5});
await a.call(`/orders/${o.id}/staff`,'POST',{assignments:[{scheduleId:slots[0].id,staffId:coach.id}],requestId:crypto.randomUUID()},400);
v=await a.call('/overview?date='+date);o=v.orders.find(x=>x.id===o.id);
check(o.staff.length===1&&o.staff[0].staffId===referee.id,'non-referee assignment rejected and previous assignment retained atomically');
await a.call(`/orders/${o.id}/staff`,'POST',{assignments:[],requestId:crypto.randomUUID()});
v=await a.call('/overview?date='+date);o=v.orders.find(x=>x.id===o.id);
check(o.staff.length===0&&o.total===slots.reduce((n,s)=>n+s.price,0),'removing all referees releases their time and recalculates the order');
await a.call(`/orders/${o.id}/staff`,'POST',{assignments:assignments.slice(0,1),requestId:crypto.randomUUID()});
v=await a.call('/overview?date='+date);o=v.orders.find(x=>x.id===o.id);
const receipt=await a.call('/payments','POST',{orderId:o.id,method:'CASH',amount:o.total,transactionCode:'referee-'+crypto.randomUUID()});
await a.call(`/orders/${o.id}/check-in`,'POST',{reason:'Isolated regression test'});
await a.call(`/orders/${o.id}/check-out`,'POST',{});
await a.call(`/orders/${o.id}/invoice`,'POST',{});
v=await a.call('/overview?date='+date);o=v.orders.find(x=>x.id===o.id);
check(o.status==='COMPLETED'&&o.paid===o.total&&o.products.length===0&&o.invoice,'collect, check-in, check-out and invoice work with referee-only order');
await a.call(`/payments/${receipt.id}/refunds`,'POST',{amount:10000,reason:'Isolated refund test',requestId:crypto.randomUUID()});
v=await a.call('/overview?date='+date);o=v.orders.find(x=>x.id===o.id);
check(o.finance.due===10000,'refund still reconciles order balance');
console.log('Completed',checks,'referee-only checks');
