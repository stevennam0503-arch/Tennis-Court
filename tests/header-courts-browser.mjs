import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {chromium} from '../frontend/node_modules/playwright-core/index.mjs';
const base = process.env.COURTLY_WEB_URL || 'http://127.0.0.1:5175';
const output = process.env.COURTLY_SCREENSHOTS || '/tmp/courtly-header-courts';
await mkdir(output, {recursive:true});
const browser = await chromium.launch({executablePath:process.env.CHROMIUM_PATH || '/usr/bin/chromium',headless:true,args:['--no-sandbox']});
try {
  const page = await browser.newPage({viewport:{width:1880,height:1050}});
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(base+'/dat-san');
  await page.locator('.dg-court').first().waitFor();
  assert.equal(await page.locator('.dg-indoor .dg-court').count(), 4);
  assert.equal(await page.locator('.dg-vip .dg-court').count(), 2);
  const day = new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Ho_Chi_Minh',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(Date.now()+3*86400000));
  const loaded = page.waitForResponse(r => r.url().includes('/overview?date='+day) && r.ok());
  await page.getByLabel('Ngày chơi',{exact:true}).fill(day);
  await loaded;
  for (const code of ['B01','B02','B03','B04','V01','V02']) {
    await page.locator(`[data-court-id="${code}"]`).click();
    await page.locator('[data-time="18:00"]').click();
    await page.locator('[data-time="19:00"]').click();
    assert.equal(await page.locator('[data-range-end]').innerText(),'19:00');
    assert.equal(await page.locator('.gx-quote .ct-primary').isEnabled(),true,code+' has real selectable schedules');
  }
  await page.evaluate(() => window.scrollTo(0,0));
  await page.screenshot({path:output+'/courts-desktop.png'});
  const checkHeader = async state => {
    for (const lang of ['VI','EN']) {
      await page.getByRole('button',{name:lang,exact:true}).click();
      for (const width of [1880,1440,1180,1179,1024,768,390,320]) {
        await page.setViewportSize({width,height:1000});
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth>innerWidth),false,`${state} ${lang} overflow ${width}`);
        const logo=await page.locator('header .ct-logo').boundingBox();
        const tools=await page.locator('.cl-header-tools').boundingBox();
        assert.ok(logo.x+logo.width<=tools.x, 'Logo and tools do not overlap');
        if (width>=1180) {
          const nav=await page.locator('#guest-primary-navigation').boundingBox();
          assert.ok(nav && nav.x>=logo.x+logo.width && nav.x+nav.width<=tools.x,'Three header regions do not overlap');
          assert.ok(await page.locator('#guest-primary-navigation button').first().evaluate(n => parseFloat(getComputedStyle(n).fontSize)>=16),'Readable desktop navigation');
          if (width===1880 && lang==='VI') {
            await page.evaluate(() => window.scrollTo(0,0));
            await page.screenshot({path:`${output}/header-${state}.png`,clip:{x:0,y:0,width,height:140}});
          }
        } else {
          const toggle=page.locator('.gx-menu');
          await toggle.click();
          assert.equal(await toggle.getAttribute('aria-expanded'),'true');
          assert.equal(await page.locator('#guest-primary-navigation button:visible').count(),5);
          assert.equal(await page.evaluate(() => document.documentElement.scrollWidth>innerWidth),false,'Open menu stays within screen');
          if (width===390 && lang==='VI') await page.screenshot({path:`${output}/menu-${state}-390.png`});
          await page.locator('#guest-primary-navigation button').nth(1).click();
          assert.equal(await toggle.getAttribute('aria-expanded'),'false','Navigation closes mobile menu');
        }
      }
    }
    await page.setViewportSize({width:1440,height:1000});
    await page.getByRole('button',{name:'VI',exact:true}).click();
  };
  await checkHeader('guest');
  // The migration-only fixture has no customer accounts; use the SQL demo for this part.
  if (process.env.COURTLY_SKIP_LOGIN !== '1') {
    await page.getByRole('button',{name:'Đăng nhập',exact:true}).click();
    await page.getByLabel('Email',{exact:true}).fill('minh.anh@example.com');
    await page.getByLabel('Mật khẩu',{exact:true}).fill('CourtlyDemo2026');
    await page.locator('.gx-dialog').getByRole('button',{name:'Đăng nhập',exact:true}).click();
    await page.locator('.gx-dialog').waitFor({state:'hidden'});
    await checkHeader('customer');
  }
  assert.deepEqual(errors,[]);
  console.log('PASS four indoor/two VIP courts with schedules; readable header, VI/EN, responsive menu and non-overlapping regions.');
} finally {await browser.close();}
