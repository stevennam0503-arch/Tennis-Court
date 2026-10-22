import assert from 'node:assert/strict';
import {chromium} from '../frontend/node_modules/playwright-core/index.mjs';
import {mkdir} from 'node:fs/promises';
const output=process.env.COURTLY_SCREENSHOTS||'/tmp/courtly-handoff-screens';await mkdir(output,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
try {
 const page=await browser.newPage({viewport:{width:1440,height:1000}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(process.env.COURTLY_WEB_URL||'http://127.0.0.1:5175');
 await page.getByRole('button',{name:'Đăng nhập',exact:true}).click();
 await page.getByLabel('Email',{exact:true}).fill('admin@gmail.com');await page.getByLabel('Mật khẩu',{exact:true}).fill('12345');
 await page.locator('.gx-dialog').getByRole('button',{name:'Đăng nhập',exact:true}).click();
 await page.locator('.sidebar').waitFor();await page.locator('.main h1').waitFor();
 assert.equal(await page.locator('#courtly-balanced-amenities').count(),0,'Guest layout does not wrap admin');
 const buttons=page.locator('.sidebar nav button');const count=await buttons.count();
 for(let i=0;i<count;i++){const label=await buttons.nth(i).innerText();await buttons.nth(i).click();await page.locator('.main h1').waitFor();assert.equal(await page.locator('.main .error').count(),0,label);console.log('PASS admin page',label)}
 await page.locator('.sidebar nav').getByRole('button',{name:'Lịch sân',exact:true}).click();await page.locator('.main h1').waitFor();
 assert.ok((await page.locator('.main').innerText()).includes('06:30'),'Half-hour calendar labels');
 await page.screenshot({path:output+'/admin-calendar.png'});
 assert.deepEqual(errors,[]);console.log('PASS admin layout, navigation and 30-minute calendar');
}finally{await browser.close()}
