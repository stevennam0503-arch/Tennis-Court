import {test} from 'node:test';
import assert from 'node:assert/strict';
import {canEndAt, timePoints, rangeSlots, clock} from '../frontend/src/guest/bookingTime.mjs';
const rows=[['18:00','18:30','AVAILABLE'],['18:30','19:00','AVAILABLE'],['19:00','19:30','AVAILABLE'],['19:30','20:00','BOOKED'],['20:00','20:30','AVAILABLE'],['22:30','23:00','AVAILABLE']].map(([start,end,status])=>({start,end,status}));
const available=s=>s.status==='AVAILABLE';
test('first click has no completed range; second click uses its exact boundary',()=>{
 assert.equal(canEndAt(rows,null,1080,available),false);
 assert.equal(canEndAt(rows,1080,1080,available),false);
 assert.equal(canEndAt(rows,1080,1170,available),true);
 assert.equal(rangeSlots(rows,1080,1170).length,3);
});
test('30-minute minimum, reverse range rejected',()=>{
 assert.equal(canEndAt(rows,1080,1110,available),true);
 assert.equal(canEndAt(rows,1110,1080,available),false);
});
test('can end exactly when a booked slot begins, cannot cross it',()=>{
 assert.equal(canEndAt(rows,1080,1170,available),true);
 assert.equal(canEndAt(rows,1080,1200,available),false);
 assert.equal(canEndAt(rows,1080,1230,available),false);
});
test('missing schedule intervals cannot be bridged',()=>assert.equal(canEndAt(rows,1200,1380,available),false));
test('closing time is available as an end boundary',()=>{
 assert.equal(canEndAt(rows,1350,1380,available),true);
 assert.equal(timePoints(rows).at(-1),1380);
 assert.equal(clock(1380),'23:00');
});
test('existing hourly bookings retain their real boundaries',()=>{
 const legacy=[{start:'06:00:00',end:'07:00:00',status:'AVAILABLE'}];
 assert.equal(canEndAt(legacy,360,420,available),true);
 assert.equal(canEndAt(legacy,360,390,available),false);
 assert.deepEqual(timePoints(legacy),[360,420]);
});
test('a refreshed unavailable slot invalidates the previously selected range',()=>{
 const updated=rows.map(s=>s.start==='18:30'?{...s,status:'LOCKED'}:s);
 assert.equal(canEndAt(updated,1080,1170,available),false);
});
