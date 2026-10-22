import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {chromium} from '../frontend/node_modules/playwright-core/index.mjs';
const base=process.env.COURTLY_WEB_URL||'http://localhost:5173';
const output=process.env.COURTLY_SCREENSHOTS||'/tmp/courtly-customer-changes';
await mkdir(output,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 let created=0;page.on('request',r=>{if(r.method()==='POST'&&new URL(r.url()).pathname==='/api/orders')created++});
 await page.goto(base+'/bang-gia');await page.getByRole('heading',{name:'Bảng giá sân & dịch vụ'}).waitFor();await page.locator('.gx-pricing table').first().waitFor();
 for(const name of ['Bảng giá','Giải đấu','Hội viên'])assert.equal(await page.locator('#guest-primary-navigation').getByRole('button',{name,exact:true}).count(),1);
 assert.equal(await page.locator('.gx-pricing table').count(),3);
 assert.ok(await page.locator('.gx-pricing').innerText().then(s=>s.includes('Thứ 2–6')&&s.includes('Thứ 7–CN')&&s.includes('Giá thuê trọng tài')));
 for(const width of [1880,1440,1180,1179,768,390,320]){
  await page.setViewportSize({width,height:1000});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`no horizontal overflow at ${width}`);
  const logo=await page.locator('header .ct-logo').boundingBox(),tools=await page.locator('.cl-header-tools').boundingBox();
  assert.ok(logo.x+logo.width<=tools.x,`header logo/tools fit at ${width}`);
 }
 await page.setViewportSize({width:1440,height:1000});await page.screenshot({path:output+'/pricing-desktop.png',fullPage:true});
 await page.getByRole('button',{name:'Đặt sân ngay · VIP'}).click();
 assert.equal(new URL(page.url()).pathname,'/dat-san');
 assert.equal(await page.getByLabel('Loại sân',{exact:true}).inputValue(),'V');
 assert.equal(await page.locator('.dg-court').count(),2);
 assert.equal(await page.locator('.dg-outdoor').count(),0);
 const day=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Ho_Chi_Minh',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(Date.now()+3*86400000));
 const loaded=page.waitForResponse(r=>r.url().includes('/overview?date='+day)&&r.ok());await page.getByLabel('Ngày chơi',{exact:true}).fill(day);await loaded;
 await page.locator('[data-time="14:00"]').click();await page.locator('[data-time="15:00"]').click();
 await page.getByRole('button',{name:'Đăng nhập để đặt sân',exact:true}).click();
 await page.getByRole('dialog').waitFor();assert.equal(created,0,'anonymous click only opens authentication');
 await page.getByRole('button',{name:'Đăng ký',exact:true}).click();
 await page.getByLabel('Họ và tên',{exact:true}).fill('Browser Booking');await page.getByLabel('Email',{exact:true}).fill('browser-'+crypto.randomUUID()+'@example.com');
 await page.getByLabel('Mật khẩu',{exact:true}).fill('BrowserBooking!2026');await page.getByLabel('Nhập lại mật khẩu',{exact:true}).fill('BrowserBooking!2026');
 await page.getByRole('button',{name:'Tạo tài khoản',exact:true}).click();await page.getByRole('dialog').waitFor({state:'hidden'});
 await page.getByRole('button',{name:'Tiếp tục thanh toán',exact:true}).click();
 await page.getByRole('heading',{name:'Chọn phương thức thanh toán'}).waitFor();assert.equal(created,1,'signed-in customer creates one account-linked hold');
 await page.getByRole('button',{name:'Tiền mặt tại quầy',exact:true}).click();
 await page.getByRole('heading',{name:'Đơn của tôi',exact:true}).waitFor();
 assert.ok(await page.locator('[role="timer"]').innerText().then(s=>s.includes('Còn giữ chỗ')));
 assert.equal(await page.getByRole('button',{name:/Duyệt ngay|Xác nhận đã thanh toán/}).count(),0);
 await page.getByRole('button',{name:'Hủy đơn',exact:true}).first().click();await page.getByText('Dự kiến hoàn:').waitFor();
 await page.getByRole('button',{name:'Xác nhận hủy',exact:true}).click();await page.getByRole('dialog').waitFor({state:'hidden'});
 assert.ok(await page.locator('.gx-records').innerText().then(s=>s.includes('Đã hủy')));
 await page.setViewportSize({width:390,height:1000});await page.goto(base+'/bang-gia');await page.getByRole('heading',{name:'Bảng giá sân & dịch vụ'}).waitFor();await page.locator('.gx-pricing table').first().waitFor();await page.screenshot({path:output+'/pricing-mobile.png',fullPage:true});
 // Exercise the cashier UI with a separate STAFF login and a local test booking.
 const call=async(context,path,method='GET',body)=>{
  const headers={};if(method!=='GET'){const c=await context.request.get(base+'/api/csrf');const token=await c.json();headers[token.headerName]=token.token}
  const r=await context.request.fetch(base+'/api'+path,{method,headers,data:body});assert.ok(r.ok(),path+': '+await r.text());return r.status()===204?null:r.json();
 };
 const customer=page.context();
 const overview=await call(customer,'/overview?date='+day);
 const vip=overview.courts.find(c=>c.name==='V02');
 const available=overview.schedules.filter(s=>s.court===vip.id&&s.status==='AVAILABLE').sort((a,b)=>a.start.localeCompare(b.start));
 const first=available.findIndex((s,i)=>available[i+1]?.start===s.end);assert.ok(first>=0);
 const ids=available.slice(first,first+2).map(s=>s.id);
 const held=await call(customer,'/orders','POST',{scheduleIds:ids,assignments:[],requestId:crypto.randomUUID()});
 const admin=await browser.newContext();
 await call(admin,'/auth/login','POST',{email:process.env.ADMIN_EMAIL||'admin@gmail.com',password:process.env.ADMIN_PASSWORD||'12345'});
 const account=await call(admin,'/catalog/accounts','POST',{name:'Browser Cashier',email:'cashier-'+crypto.randomUUID()+'@example.com',phone:'0900000008',role:'STAFF',status:'ACTIVE'});
 const ticket=await call(admin,'/auth/ticket','POST',{accountId:account.id});
 const staff=await browser.newContext();await call(staff,'/auth/activate','POST',{token:ticket.token,password:'BrowserCashier!2026'});
 const desk=await staff.newPage();desk.on('pageerror',e=>errors.push(e.message));await desk.goto(base+'/quay-thu');
 await desk.getByRole('heading',{name:'Thu tiền mặt tại quầy',exact:true}).waitFor();
 await desk.getByLabel('Chọn đơn',{exact:true}).selectOption(held.id);
 await desk.getByRole('checkbox').check();await desk.getByRole('button',{name:'Xác nhận tiền mặt đã thu',exact:true}).click();
 await desk.getByText('Đã ghi nhận phiếu thu:',{exact:false}).waitFor({timeout:10000}).catch(async error=>{await desk.screenshot({path:output+'/cashier-failure.png'});throw new Error(error.message+'\n'+await desk.locator('main').innerText())});
 assert.equal((await call(customer,'/overview?date='+day)).orders.find(o=>o.id===held.id).status,'CONFIRMED');
 await call(customer,`/orders/${held.id}/cancel`,'POST',{requestId:crypto.randomUUID()});
 await staff.close();await admin.close();
 assert.deepEqual(errors,[]);console.log('PASS browser: navigation, responsive pricing, VIP filter, login gate, account-linked hold, cash choice, countdown, cancellation and STAFF cash collection; no page errors.');
}finally{await browser.close()}
