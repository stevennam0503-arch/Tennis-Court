// Run only against a disposable development database. This creates test records.
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
export async function runSmoke(base = 'http://localhost:8080/api') {
  let count=0;
  const call=async(path,body,method='POST',expected=200)=>{
    const response=await fetch(base+path,{method,headers:{'content-type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})});
    const text=await response.text();let result;try{result=text?JSON.parse(text):null;}catch{result=text;}
    assert.equal(response.status,expected,`${method} ${path}: ${JSON.stringify(result)}`);count++;return result;
  };
  const read=path=>call(path,undefined,'GET');
  const save=(collection,body)=>call(`/catalog/${collection}`,body);
  const date=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Ho_Chi_Minh',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  const unique=crypto.randomUUID().slice(0,8);
  await read('/health');
  const court=await save('courts',{name:`Test ${unique}`,type:'HARD',status:'ACTIVE',price:100000});
  await call('/schedules/generate',{date});
  let state=await read(`/overview?date=${date}`);
  const slot=hour=>state.schedules.find(x=>x.court===court.id&&x.hour===hour).id;
  const order=await call('/orders',{name:'API Test',phone:'0900000000',scheduleIds:[slot(9),slot(10)]});
  await call('/orders',{name:'Overlap',phone:'0900000000',scheduleIds:[slot(9)]},'POST',400);
  await call('/payments',{orderId:order.id,amount:200001,method:'CASH',transactionCode:crypto.randomUUID()},'POST',400);
  const first=await call('/payments',{orderId:order.id,amount:100000,method:'CASH',transactionCode:crypto.randomUUID()});
  state=await read(`/overview?date=${date}`);assert.equal(state.orders.find(o=>o.id===order.id).status,'CONFIRMED');
  const drink=await save('drinks',{name:`Water ${unique}`,price:10000,stock:5,status:'ACTIVE'});
  await call(`/orders/${order.id}/products`,{productId:drink.id,type:'DRINK',quantity:3,hours:1});
  await call(`/orders/${order.id}/products`,{productId:drink.id,type:'DRINK',quantity:3,hours:1},'POST',400);
  const rental=await save('rentals',{name:`Racket ${unique}`,price:15000,stock:2,status:'ACTIVE'});
  await call(`/orders/${order.id}/products`,{productId:rental.id,type:'RENTAL',quantity:2,hours:2});
  await call(`/orders/${order.id}/products`,{productId:rental.id,type:'RENTAL',quantity:1,hours:2},'POST',400);
  const person=await save('staff',{name:`Referee ${unique}`,phone:'0900000000',type:'REFEREE',rate:20000,status:'ACTIVE'});
  await save('staff-schedules',{staff:person.id,date,start:9,end:15});
  await call(`/orders/${order.id}/staff`,{staffId:person.id});
  await call(`/orders/${order.id}/check-in`);
  await call(`/orders/${order.id}/check-out`,undefined,'POST',400);
  state=await read(`/overview?date=${date}`);let o=state.orders.find(o=>o.id===order.id);assert.equal(o.total,330000);assert.equal(o.paid,100000);
  assert.equal(state.products.find(p=>p.id===drink.id).stock,2);
  await call('/payments',{orderId:order.id,amount:o.total-o.paid,method:'BANK_TRANSFER',transactionCode:crypto.randomUUID()});
  await call(`/orders/${order.id}/check-out`);
  await call(`/orders/${order.id}/invoice`);
  await call(`/payments/${first.id}/refunds`,{amount:100001,reason:'Too much'},'POST',400);
  await call(`/payments/${first.id}/refunds`,{amount:10000,reason:'Test refund'});
  state=await read(`/overview?date=${date}`);o=state.orders.find(o=>o.id===order.id);assert.equal(o.status,'COMPLETED');assert.equal(o.slots.length,2);assert.equal(o.paid,320000);
  const move=await call('/orders',{name:'Move',phone:'0900000000',scheduleIds:[slot(11)]});
  await call(`/orders/${move.id}/schedule`,{scheduleIds:[slot(12)]},'PATCH');
  state=await read(`/overview?date=${date}`);assert.equal(state.orders.find(o=>o.id===move.id).slots[0].hour,12);assert.equal(state.schedules.find(s=>s.id===slot(11)).status,'AVAILABLE');
  const tour=await save('tournaments',{name:`Open ${unique}`,format:'SINGLES',status:'OPEN',startDate:date,endDate:date,deadline:date,fee:30000,max:2,location:'Test club'});
  const regs=[];
  for(let i=0;i<2;i++){
    const account=await save('accounts',{name:`Player ${i}`,email:`${unique}-${i}@example.com`,phone:'0900000000',role:'CUSTOMER',status:'ACTIVE'});
    const reg=await call(`/tournaments/${tour.id}/registrations`,{accountId:account.id,name:`Player ${i}`,members:[]});regs.push(reg.id);
    await call('/payments',{registrationId:reg.id,amount:30000,method:'CASH',transactionCode:crypto.randomUUID()});
  }
  await call(`/tournaments/${tour.id}/draw`);
  state=await read(`/overview?date=${date}`);const match=state.matches.find(m=>m.tournamentId===tour.id);
  await call(`/matches/${match.id}/schedule`,{scheduleIds:[slot(12)]},'PUT',400);
  await call(`/matches/${match.id}/schedule`,{scheduleIds:[slot(13)],staffId:person.id},'PUT');
  await call('/orders',{name:'Blocked by match',phone:'0900000000',scheduleIds:[slot(13)]},'POST',400);
  await call(`/matches/${match.id}/result`,{winnerId:regs[0],score:'6-4, 6-3'});
  await call(`/orders/${move.id}/cancel`);
  state=await read(`/overview?date=${date}`);assert.equal(state.tournaments.find(t=>t.id===tour.id).status,'FINISHED');assert.equal(state.schedules.find(s=>s.id===slot(13)).status,'AVAILABLE');
  assert(state.payments.filter(p=>regs.includes(p.registrationId)).every(p=>!p.orderId));
  console.log(`PASS: ${count} API requests, bookings, money, stock, rental overlap, staff, move, invoices, refund, cancellation, tournament fees and matches.`);
  return {requests:count,date,state};
}
if(process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href) await runSmoke(process.env.COURTLY_API_URL||'http://localhost:8080/api');
