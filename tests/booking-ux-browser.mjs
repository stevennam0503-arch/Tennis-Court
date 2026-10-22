import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {chromium} from '../frontend/node_modules/playwright-core/index.mjs';

// Reads the demo fixtures only; never creates bookings or payments.
const output = process.env.COURTLY_SCREENSHOTS || '/tmp/courtly-booking-ux';
await mkdir(output, {recursive:true});
const base = process.env.COURTLY_WEB_URL || 'http://127.0.0.1:5175';
const browser = await chromium.launch({executablePath:process.env.CHROMIUM_PATH || '/usr/bin/chromium', headless:true, args:['--no-sandbox']});
try {
  const page = await browser.newPage({viewport:{width:1440,height:1000}});
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(base + '/dat-san');
  await page.locator('[data-court-id="A01"]').waitFor();
  const day = offset => new Intl.DateTimeFormat('en-CA', {timeZone:'Asia/Ho_Chi_Minh',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(Date.now()+offset*86400000));
  const changeDate = async value => {
    const loaded = page.waitForResponse(r => r.url().includes('/overview?date='+value) && r.ok());
    await page.getByLabel('Ngày chơi', {exact:true}).fill(value);
    await loaded;
    await page.locator('[data-time="09:00"]').waitFor();
  };
  const point = value => page.locator(`[data-time="${value}"]`);
  const empty = '— — : — —';
  await changeDate(day(4));
  await page.locator('[data-court-id="A01"]').click();
  assert.equal(await point('10:00').isDisabled(), true, 'Fixture has a booked 10:00–11:00 interval');
  await point('09:00').focus();
  await page.keyboard.press('Enter');
  assert.equal(await page.locator('[data-range-start]').innerText(), '09:00');
  assert.equal(await page.locator('[data-range-end]').innerText(), empty);
  assert.equal(await page.locator('.gx-quote .ct-primary').isDisabled(), true);
  assert.equal(await point('10:00').isEnabled(), true, 'Can finish where another booking starts');
  assert.equal(await point('10:30').isDisabled(), true, 'Cannot cross a booked interval');
  await point('10:00').click();
  assert.equal(await page.locator('[data-range-end]').innerText(), '10:00');
  assert.match(await page.locator('.gx-quote-range').innerText(), /60 phút/);
  await point('22:30').click();
  assert.equal(await page.locator('[data-range-end]').innerText(), empty, 'Third click starts a new range');
  await point('23:00').click();
  assert.match(await page.locator('.gx-quote-range').innerText(), /30 phút/);
  await page.locator('[data-court-id="B01"]').click();
  assert.equal(await page.locator('[data-range-start]').innerText(), empty, 'Changing court clears range');
  await point('18:00').click();
  await point('19:30').click();
  await changeDate(day(5));
  assert.equal(await page.locator('[data-range-end]').innerText(), empty, 'Changing date clears range');
  await point('18:00').click();
  await point('19:30').click();
  await page.getByRole('button', {name:'Đăng nhập',exact:true}).click();
  await page.getByLabel('Email', {exact:true}).fill('minh.anh@example.com');
  await page.getByLabel('Mật khẩu', {exact:true}).fill('CourtlyDemo2026');
  await page.locator('.gx-dialog').getByRole('button', {name:'Đăng nhập',exact:true}).click();
  await page.locator('.gx-dialog').waitFor({state:'hidden'});
  await page.locator('.gx-quote .ct-primary:not(:disabled)').waitFor();
  await page.locator('.gx-referee-toggle input').check();
  await page.locator('.gx-referee-panel select').first().waitFor();
  await page.getByLabel('Đến giờ', {exact:true}).selectOption('18:30');
  await page.getByLabel('Từ giờ', {exact:true}).selectOption('19:00');
  assert.equal(await page.getByLabel('Đến giờ', {exact:true}).inputValue(), '19:30', 'Referee end stays after new start');
  await page.locator('.gx-referee-toggle input').uncheck();

  for (const width of [1440,1024,768,650,390,320]) {
    await page.setViewportSize({width,height:1000});
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, 'Booking overflow '+width);
    const cells = await page.locator('.dg-art').evaluateAll(nodes => nodes.map(n => n.getBoundingClientRect().width));
    assert.ok(cells.every(w => w >= 65), 'Court illustrations remain visible at '+width);
    await page.evaluate(() => window.scrollTo(0,0));
    if ([1440,390].includes(width)) await page.screenshot({path:`${output}/booking-${width}.png`,fullPage:true});
  }
  await page.goto(base);
  await page.locator('.haus-hero').waitFor();
  for (const width of [1440,1024,768,390,320]) {
    await page.setViewportSize({width,height:1000});
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, 'Overview overflow '+width);
    if ([1440,390].includes(width)) await page.screenshot({path:`${output}/overview-${width}.png`,fullPage:true});
  }
  assert.deepEqual(errors, []);
  console.log('PASS booking UX: keyboard, exact end boundary, blocked ranges, closing time, court/date reset, referee hours, responsive booking and overview. No bookings created.');
} finally {
  await browser.close();
}
