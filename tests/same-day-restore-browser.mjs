import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {chromium} from '../frontend/node_modules/playwright-core/index.mjs';
assert.equal(process.env.COURTLY_TEST_WRITE,'1','Use a disposable database');
assert.ok(process.env.COURTLY_CASE_OUTPUT,'Use case output from same-day-restore-api.mjs');
const cases=JSON.parse(await fs.readFile(process.env.COURTLY_CASE_OUTPUT,'utf8'));
const root=process.env.COURTLY_WEB_URL||'http://127.0.0.1:5180';
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
try {
 const context=await browser.newContext({viewport:{width:1440,height:1000}});
 const csrf=await(await context.request.get(root+'/api/csrf')).json();
 const login=await context.request.post(root+'/api/auth/login',{headers:{[csrf.headerName]:csrf.token,Origin:root},data:{email:'admin@gmail.com',password:'12345'}});
 assert.equal(login.status(),200);const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(root+'/app#calendar');await page.waitForLoadState('networkidle');
 for(const c of cases){
  const before=await(await context.request.get(root+'/api/overview?date='+c.date)).json();
  const pending=before.orders.find(o=>o.id===c.id).slots.filter(s=>!s.completed);
  const start=Math.min(...pending.map(s=>s.hour)),nextHour=start+1;
  if(await page.getByLabel('Ngày xem lịch').inputValue()!==c.date)
   await Promise.all([page.waitForResponse(r=>r.url().includes('/api/overview?date='+c.date)&&r.status()===200),page.getByLabel('Ngày xem lịch').fill(c.date)]);
  await page.getByRole('button',{name:c.courtName+' '+start+' giờ',exact:true}).click();
  await page.getByRole('button',{name:/Đổi lịch sân/}).click();
  assert.equal(await page.getByLabel('Giờ bắt đầu').inputValue(),String(start));
  assert.equal(await page.getByLabel('Số giờ liên tục').inputValue(),'1');
  console.log('PASS move form defaults to unplayed hour',c.withReferee);
  await page.getByLabel('Giờ bắt đầu').fill(String(nextHour));
  await page.getByLabel('Lý do thực hiện').fill('Disposable same-day browser regression');
  const optionsResponse=page.waitForResponse(r=>r.url().endsWith('/booking/options')&&r.request().method()==='POST');
  await page.getByRole('button',{name:'Kiểm tra sân và trọng tài',exact:true}).click();
  const opts=await(await optionsResponse).json();assert.equal(opts.slots.length,2);
  assert.ok(opts.slots.every(s=>s.hour>=nextHour&&s.hour<nextHour+1));
  const previewResponse=page.waitForResponse(r=>r.url().endsWith(`/orders/${c.id}/preview`));
  await page.getByRole('button',{name:'Xem lịch mới & chênh lệch tiền',exact:true}).click();
  const preview=await(await previewResponse).json();assert.equal(preview.next.total,c.total);
  assert.equal(preview.next.slots.filter(s=>s.completed).length,2);
  const moveResponse=page.waitForResponse(r=>r.url().endsWith(`/orders/${c.id}/schedule`)&&r.request().method()==='PATCH');
  await page.getByRole('button',{name:'Xác nhận đổi lịch',exact:true}).click();
  assert.equal((await moveResponse).status(),200);
  await page.getByRole('button',{name:'Chọn trọng tài',exact:true}).first().click();
  const staffOptionsResponse=page.waitForResponse(r=>r.url().endsWith('/booking/options')&&r.request().method()==='POST');
  await page.getByRole('button',{name:'Kiểm tra sân và trọng tài',exact:true}).click();
  const staffOptions=await(await staffOptionsResponse).json();assert.equal(staffOptions.slots.length,2);
  assert.ok(staffOptions.slots.every(s=>s.hour>=nextHour&&s.hour<nextHour+1));
  const saveStaff=page.waitForResponse(r=>r.url().endsWith(`/orders/${c.id}/staff`)&&r.request().method()==='POST');
  await page.getByRole('button',{name:'Xác nhận phân công',exact:true}).click();assert.equal((await saveStaff).status(),200);
  const data=await(await context.request.get(root+'/api/overview?date='+c.date)).json();const order=data.orders.find(o=>o.id===c.id);
  assert.equal(order.total,c.total);assert.equal(order.slots.filter(s=>s.completed).length,2);
  assert.equal(order.staff.filter(s=>s.completed).length,c.withReferee?2:0);
  assert.ok(order.slots.filter(s=>!s.completed).every(s=>s.hour>=nextHour&&s.hour<nextHour+1));
  console.log('PASS move and referee editor preserve completed charges',c.withReferee);
  const details=page.getByRole('dialog',{name:/Chi tiết đơn đặt sân/});
  await details.waitFor({state:'visible'});
  await details.getByRole('button',{name:'Đóng',exact:true}).first().click();
  await details.waitFor({state:'hidden'});
 }
 assert.deepEqual(errors,[]);console.log('PASS no JavaScript errors');
} finally {await browser.close();}
