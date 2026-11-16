import test from 'node:test';
import assert from 'node:assert/strict';
import * as c from '../js/core.js';

const mk = () => { const db = c.emptyDb(); db.account.push({ id: 'a', env: 'P', name: 'Bank', currency: 'INR', opening: 100000 }, { id: 'b', env: 'P', name: 'USD acct', currency: 'USD', opening: 0 }, { id: 's', env: 'P', name: 'Savings', currency: 'INR', opening: 0 }); return db; };

test('parse and format', () => { assert.equal(c.parseAmt('1,234.50', 'INR'), 123450); assert.equal(c.fmt(123450, 'INR'), '₹1,234.50'); assert.equal(c.fmt(-500, 'USD'), '-$5.00'); assert.throws(() => c.parseAmt('1.234', 'INR')); });
test('expense then reverse nets to zero and hides both', () => {
  const db = mk(); c.addTx(db, { env: 'P', income: false, account: 'a', amount: 25000, category: 'Food' });
  assert.equal(c.balance(db, 'a'), 75000);
  c.reverseGrp(db, db.txn[0].grp);
  assert.equal(c.balance(db, 'a'), 100000); assert.equal(c.visibleTxs(db, 'P').length, 0);
  assert.equal(c.reverseGrp(db, db.txn[0].grp), false);
  assert.equal(c.monthTotal(db, 'P', 'INR', 'expense', c.monthString()), 0);
});
test('edit = reverse + repost', () => {
  const db = mk(); c.addTx(db, { env: 'P', income: false, account: 'a', amount: 1000, memo: 'x' });
  c.editTx(db, db.txn[0], { amount: 2500, memo: 'y', category: 'Food' });
  assert.equal(c.balance(db, 'a'), 97500); const v = c.visibleTxs(db, 'P'); assert.equal(v.length, 1); assert.equal(v[0].memo, 'y'); assert.equal(db.txn.length, 3);
});
test('cross-currency transfer keeps both amounts, excluded from income/expense', () => {
  const db = mk(); c.addTransfer(db, { env: 'P', from: 'a', to: 'b', amount: 83000, received: 1000 });
  assert.equal(c.balance(db, 'a'), 17000); assert.equal(c.balance(db, 'b'), 1000);
  assert.equal(c.monthTotal(db, 'P', 'INR', 'expense', c.monthString()), 0);
  assert.throws(() => c.addTransfer(db, { env: 'P', from: 'a', to: 'b', amount: 100 }));
  assert.throws(() => c.addTransfer(db, { env: 'P', from: 'a', to: 'a', amount: 100 }));
});
test('month-end clamping and next due', () => {
  assert.equal(c.addMonths('2026-01-31', 1), '2026-02-28'); assert.equal(c.addMonths('2024-01-31', 1), '2024-02-29'); assert.equal(c.addMonths('2026-11-30', 3), '2027-02-28');
  const s = { status: 'running', cycle: 'monthly', anchor: '2026-01-31' };
  assert.equal(c.nextDue(s, '2026-02-01'), '2026-02-28'); assert.equal(c.nextDue(s, '2026-03-01'), '2026-03-31');
  assert.equal(c.nextDue({ ...s, status: 'paused' }), null); assert.equal(c.nextDue({ status: 'running', cycle: 'weekly', anchor: '2026-11-01' }, '2026-11-09'), '2026-11-15');
});
test('monthly cost normalises and excludes closed', () => { assert.equal(c.monthlyCost({ status: 'running', cycle: 'annually', cost: 120000 }), 10000); assert.equal(c.monthlyCost({ status: 'closed', cycle: 'monthly', cost: 500 }), 0); assert.equal(c.monthlyCost({ status: 'running', cycle: 'weekly', cost: 100 }), 433); });
test('goal progress', () => {
  const db = mk(); db.txn.push({ id: 't', env: 'P', type: 'income', date: '2026-11-01', memo: '', account: 's', amount: 50000, category: 'x', grp: 't', project: '', reverses: '', updated: 0 });
  const p = c.goalProgress(db, { account: 's', target: 100000, deadline: '2027-05-15' }, new Date(2026, 10, 16)); assert.equal(p.saved, 50000); assert.equal(p.fraction, 0.5); assert.equal(p.monthly, Math.ceil(50000 / 5));
});
test('backup merge is idempotent and never overwrites', () => {
  const a = mk(), b = c.emptyDb(); c.addTx(a, { env: 'P', income: true, account: 'a', amount: 500 });
  const bk = c.exportBackup(a); assert.equal(c.mergeBackup(b, bk), 4); assert.equal(c.mergeBackup(b, bk), 0);
  b.txn[0].memo = 'local'; c.mergeBackup(b, bk); assert.equal(b.txn[0].memo, 'local'); assert.throws(() => c.mergeBackup(b, { app: 'x' }));
});
test('balance history', () => { const db = mk(); const h = c.balanceHistory(db, 'P', 'INR', 3, new Date(2026, 10, 16)); assert.deepEqual(h.map(x => x.month), ['2026-09', '2026-10', '2026-11']); assert.equal(h[2].minor, 100000); });
