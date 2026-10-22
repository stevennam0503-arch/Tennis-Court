import {test} from 'node:test';
import assert from 'node:assert/strict';
import {tariffRows} from '../frontend/src/guest/pricing.mjs';
const court={id:'vip',price:500000};
test('weekday and weekend tariffs align across half-hour boundaries and base-price gaps',()=>{
 const rows=tariffRows(court,[{court:'vip',dayType:'WEEKDAY',start:17.5,end:21,price:600000},{court:'vip',dayType:'WEEKEND',start:6,end:23,price:700000},{court:'other',dayType:'WEEKDAY',start:8,end:10,price:1}]);
 assert.deepEqual(rows,[{start:'06:00',end:'17:30',weekday:500000,weekend:700000},{start:'17:30',end:'21:00',weekday:600000,weekend:700000},{start:'21:00',end:'23:00',weekday:500000,weekend:700000}]);
});
test('a court without special tariffs shows its actual base price on both calendars',()=>{
 assert.deepEqual(tariffRows(court,[]),[{start:'06:00',end:'23:00',weekday:500000,weekend:500000}]);
});
