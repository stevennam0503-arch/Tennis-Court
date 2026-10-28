import {test} from 'node:test';
import assert from 'node:assert/strict';
import {orderOnDay,hasVisitInRange} from '../frontend/src/utils/order-visits.mjs';
const order={id:'o',date:'2026-12-04',status:'CONFIRMED',total:350000,paid:350000,
 slots:[{id:'first',date:'2026-12-04'},{id:'later',date:'2026-12-11'}],staff:[],
 visits:[{date:'2026-12-04',status:'CONFIRMED'},{date:'2026-12-11',status:'CONFIRMED'}]};
test('later recurring visit opens the same order with only that day slots',()=>{
 const later=orderOnDay(order,'2026-12-11');assert.equal(later.id,'o');
 assert.equal(later.visitDate,'2026-12-11');assert.deepEqual(later.slots.map(s=>s.id),['later']);
 assert.equal(later.total,350000);assert.equal(later.paid,350000);
 assert.equal(orderOnDay(order,'2026-12-12'),null);
 assert.equal(hasVisitInRange(order,'2026-12-11','2026-12-11'),true);
});
test('played visit is history and does not occupy a freed slot',()=>{
 const played={...order,slots:[{...order.slots[0],completed:true},order.slots[1]],
 visits:[{date:'2026-12-04',status:'COMPLETED'},order.visits[1]]};
 assert.equal(orderOnDay(played,'2026-12-04').status,'COMPLETED');
 assert.equal(hasVisitInRange(played,'2026-12-04','2026-12-04',true),false);
 assert.equal(hasVisitInRange(played,'2026-12-11',undefined,true),true);
});
