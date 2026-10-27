import {test} from 'node:test';
import assert from 'node:assert/strict';
import {orderInPeriod, consumedOrder} from '../frontend/src/utils/report-period.mjs';
const order={date:'2026-11-05', status:'CONFIRMED',total:500,paid:500,
 slots:[{date:'2026-10-29',price:200,completed:true},{date:'2026-11-05',price:200}],
 staff:[{date:'2026-10-29',rate:100,hours:1,completed:true}],products:[]};
test('recurring visits are counted by slot date, preserving whole-order cash figures',()=>{
 const oct=orderInPeriod(order,'2026-10-01','2026-10-31');
 const nov=orderInPeriod(order,'2026-11-01','2026-11-30');
 assert.equal(oct.slots.length,1);assert.equal(oct.periodValue,300);
 assert.equal(nov.slots.length,1);assert.equal(nov.periodValue,200);
 assert.equal(oct.total,500);assert.equal(oct.paid,500);
 assert.equal(orderInPeriod(order,'2026-12-01','2026-12-31'),null);
});
test('cancelled remainder does not erase already completed service revenue',()=>{
 const cancelled={...order,status:'CANCELLED'};
 assert.equal(consumedOrder(orderInPeriod(cancelled,'2026-10-01','2026-10-31')).periodValue,300);
 assert.equal(consumedOrder(orderInPeriod(cancelled,'2026-11-01','2026-11-30')).periodValue,0);
});
