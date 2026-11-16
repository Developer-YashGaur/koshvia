// Koshvia web core: pure functions over a plain-JSON database whose tables match the iOS backup format.
import { parse, decimals } from './money.js';

export const CATS = ['Groceries', 'Rent', 'Utilities', 'Transport', 'Food', 'Shopping', 'Health', 'Entertainment', 'Travel', 'Subscriptions', 'Salary', 'Other'];
export const SYMBOL = { INR: '₹', USD: '$', EUR: '€', GBP: '£', JPY: '¥', KWD: 'KD ' };
export const CURRENCIES = Object.keys(SYMBOL);
export const TABLES = ['account', 'txn', 'budget', 'subscription', 'project', 'goal', 'recurring'];

export const emptyDb = () => Object.fromEntries(TABLES.map(t => [t, []]));
export const uid = () => (globalThis.crypto?.randomUUID?.() ?? 'id-' + Math.random().toString(36).slice(2) + Date.now().toString(36));
export const pad = (n) => String(n).padStart(2, '0');
export const dayString = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const monthString = (d = new Date()) => dayString(d).slice(0, 7);

export function fmt(minor, cur) {
  const d = decimals(cur), n = Math.abs(minor) / 10 ** d;
  const s = n.toLocaleString(cur === 'INR' ? 'en-IN' : 'en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
  return (minor < 0 ? '-' : '') + SYMBOL[cur] + s;
}
/** "1,234.50" -> minor units (Number). Throws on bad input. */
export const parseAmt = (str, cur) => Number(parse(String(str).trim().replace(/,/g, ''), cur));

const acc = (db, id) => db.account.find(a => a.id === id);
export const currencyOf = (db, accountId) => acc(db, accountId)?.currency ?? 'INR';
export const envAccounts = (db, env) => db.account.filter(a => a.env === env);
export const balance = (db, id) => (acc(db, id)?.opening ?? 0) + db.txn.filter(t => t.account === id).reduce((s, t) => s + t.amount, 0);
export function netWorthByCurrency(db, env) {
  const out = {};
  for (const a of envAccounts(db, env)) out[a.currency] = (out[a.currency] ?? 0) + balance(db, a.id);
  return out;
}

// ---- transactions (append-only; corrections are reversals) ----
export function visibleTxs(db, env) {
  const rev = new Set(db.txn.filter(t => t.reverses).map(t => t.reverses));
  return db.txn.filter(t => t.env === env && !t.reverses && !rev.has(t.grp)).sort((a, b) => b.date.localeCompare(a.date));
}
const row = (o) => ({ id: uid(), project: '', reverses: '', updated: 0, ...o });
export function addTx(db, { env, income, account, amount, memo = '', category = 'Other', project = '', date = dayString() }) {
  if (!(amount > 0)) throw new Error('Amount must be positive');
  const id = uid();
  db.txn.push(row({ id, env, type: income ? 'income' : 'expense', date, memo, account, amount: income ? amount : -amount, category, grp: id, project }));
}
/** received is required (minor units of the destination currency) when currencies differ. */
export function addTransfer(db, { env, from, to, amount, received, memo = '', date = dayString() }) {
  if (from === to) throw new Error('Choose two different accounts');
  if (!(amount > 0)) throw new Error('Amount must be positive');
  const cross = currencyOf(db, from) !== currencyOf(db, to);
  const b = cross ? received : amount;
  if (!(b > 0)) throw new Error('Enter the amount received');
  const grp = uid();
  db.txn.push(row({ env, type: 'transfer', date, memo, account: from, amount: -amount, category: 'Transfer', grp }));
  db.txn.push(row({ env, type: 'transfer', date, memo, account: to, amount: b, category: 'Transfer', grp }));
}
export function reverseGrp(db, grp) {
  const rows = db.txn.filter(t => t.grp === grp && !t.reverses);
  if (!rows.length || db.txn.some(t => t.reverses === grp)) return false;
  const g = uid();
  for (const r of rows) db.txn.push({ ...r, id: uid(), memo: 'Reversal: ' + r.memo, amount: -r.amount, grp: g, reverses: grp });
  return true;
}
export function editTx(db, t, { amount, memo, category }) {
  if (!(amount > 0)) throw new Error('Amount must be positive');
  reverseGrp(db, t.grp);
  const id = uid();
  db.txn.push({ ...t, id, grp: id, memo, category, amount: t.amount < 0 ? -amount : amount, reverses: '' });
}

// ---- insights ----
export function monthTotal(db, env, cur, type, month) {
  return Math.abs(db.txn.filter(t => t.env === env && t.type === type && currencyOf(db, t.account) === cur && t.date.startsWith(month)).reduce((s, t) => s + t.amount, 0));
}
export function categorySpend(db, env, cur, month) {
  const m = {};
  for (const t of db.txn) if (t.env === env && t.type === 'expense' && currencyOf(db, t.account) === cur && t.date.startsWith(month)) m[t.category] = (m[t.category] ?? 0) - t.amount;
  return Object.entries(m).filter(([, v]) => v !== 0).sort((a, b) => b[1] - a[1]);
}
export function lastMonths(n, now = new Date()) {
  return Array.from({ length: n }, (_, i) => { const d = new Date(now.getFullYear(), now.getMonth() - (n - 1 - i), 1); return monthString(d); });
}
export function balanceHistory(db, env, cur, n, now = new Date()) {
  const ids = new Set(envAccounts(db, env).filter(a => a.currency === cur).map(a => a.id));
  const opening = envAccounts(db, env).filter(a => a.currency === cur).reduce((s, a) => s + a.opening, 0);
  const rows = db.txn.filter(t => ids.has(t.account));
  return lastMonths(n, now).map(m => ({ month: m, minor: opening + rows.filter(t => t.date <= m + '-31').reduce((s, t) => s + t.amount, 0) }));
}

// ---- budgets & goals ----
export const budgetSpent = (db, b, month = monthString()) => -db.txn.filter(t => t.env === b.env && t.type === 'expense' && currencyOf(db, t.account) === b.currency && t.date.startsWith(month)).reduce((s, t) => s + t.amount, 0);
export function goalProgress(db, g, now = new Date()) {
  const saved = Math.max(balance(db, g.account), 0), fraction = Math.min(saved / Math.max(g.target, 1), 1);
  let monthly = null;
  if (g.deadline && saved < g.target) {
    const [y, m, d] = g.deadline.split('-').map(Number);
    const months = Math.max((y - now.getFullYear()) * 12 + (m - 1 - now.getMonth()) - (d < now.getDate() ? 1 : 0), 1);
    monthly = Math.ceil((g.target - saved) / months);
  }
  return { saved, fraction, monthly };
}

// ---- subscriptions / recurrence (calendar dates as YYYY-MM-DD, month-end clamping) ----
const daysIn = (y, m) => new Date(y, m, 0).getDate();
export function addMonths(ymd, k) {
  const [y, m, d] = ymd.split('-').map(Number), t = (y * 12 + (m - 1)) + k, ny = Math.floor(t / 12), nm = (t % 12) + 1;
  return `${ny}-${pad(nm)}-${pad(Math.min(d, daysIn(ny, nm)))}`;
}
export function addDays(ymd, k) { const [y, m, d] = ymd.split('-').map(Number); return dayString(new Date(y, m - 1, d + k)); }
const STEP = { monthly: 1, quarterly: 3, halfYearly: 6, annually: 12 };
export function nextDue(sub, from = dayString()) {
  if (sub.status !== 'running') return null;
  for (let k = 0; k < 5000; k++) {
    const d = sub.cycle === 'weekly' ? addDays(sub.anchor, 7 * k) : addMonths(sub.anchor, (STEP[sub.cycle] ?? 1) * k);
    if (d >= from) return d;
  }
  return null;
}
export function daysUntil(ymd, now = new Date()) {
  const [y, m, d] = ymd.split('-').map(Number);
  return Math.round((new Date(y, m - 1, d) - new Date(now.getFullYear(), now.getMonth(), now.getDate())) / 86400000);
}
const halfEven = (n, d) => { const q = Math.floor(n / d), r = n - q * d; return r * 2 > d ? q + 1 : r * 2 < d ? q : (q % 2 === 0 ? q : q + 1); };
export function monthlyCost(s) {
  if (s.status !== 'running') return 0;
  return ({ weekly: halfEven(s.cost * 52, 12), quarterly: halfEven(s.cost, 3), halfYearly: halfEven(s.cost, 6), annually: halfEven(s.cost, 12) })[s.cycle] ?? s.cost;
}

// ---- backup (same JSON as the iOS app) ----
export const exportBackup = (db) => ({ app: 'Koshvia', version: 1, exportedAt: new Date().toISOString(), tables: Object.fromEntries(TABLES.map(t => [t, db[t]])) });
/** Adds rows whose id is not present. Never overwrites. Returns number added. */
export function mergeBackup(db, backup) {
  if (backup?.app !== 'Koshvia' || typeof backup.tables !== 'object') throw new Error('That file is not a Koshvia backup.');
  let added = 0;
  for (const t of TABLES) {
    const have = new Set(db[t].map(r => r.id));
    for (const r of backup.tables[t] ?? []) if (r && r.id && !have.has(r.id)) { db[t].push(r); have.add(r.id); added++; }
  }
  return added;
}
