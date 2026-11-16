import * as C from './js/core.js';
import { decimals } from './js/money.js';

const KEY = 'koshvia.db.v1';
const load = () => { try { return { ...C.emptyDb(), ...JSON.parse(localStorage.getItem(KEY) || '{}') }; } catch { return C.emptyDb(); } };
let db = load();
let env = localStorage.getItem('koshvia.env') || 'P';
let tab = 'home', q = '', cat = '', installEvt = null;
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(db)); } catch { toast('Could not save: storage is full or blocked'); } };
const buzz = (ms = 10) => navigator.vibrate?.(ms);
let toastT;
function toast(m) { const t = $('#toast'); t.textContent = m; t.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 2600); }
const reduced = matchMedia('(prefers-reduced-motion:reduce)').matches;
const accName = (id) => db.account.find(a => a.id === id)?.name ?? '?';
const opts = (arr, sel) => arr.map(([v, l]) => `<option value="${esc(v)}" ${v === sel ? 'selected' : ''}>${esc(l)}</option>`).join('');
const accOpts = () => opts(C.envAccounts(db, env).map(a => [a.id, `${a.name} (${a.currency})`]));
const empty = (t, s = '') => `<div class="empty"><div class="orbit"><i></i><i></i><i></i><b></b><b class="b2"></b></div><div style="font-weight:700;color:var(--fg)">${t}</div><div class="sub">${s}</div></div>`;

const ICON = {
  home: '<path d="M3 11l9-8 9 8v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
  activity: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
  plan: '<path d="M21 12A9 9 0 1 1 12 3v9z"/><path d="M15 3.5A9 9 0 0 1 20.5 9H15z"/>',
  insights: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  more: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>'
};
const TABS = [['home', 'Home'], ['activity', 'Activity'], ['plan', 'Plan'], ['insights', 'Insights'], ['more', 'More']];

function renderChrome() {
  document.body.classList.toggle('biz', env === 'B');
  $('#top').innerHTML = `<div class="brand"><svg width="26" height="26" viewBox="0 0 512 512" fill="none" stroke-width="72" stroke-linecap="round"><path d="M150 112V400" stroke="currentColor"/><path d="M150 256L346 112" stroke="#1AC7B3"/><path d="M150 256L346 400" stroke="#F5B347"/></svg>Koshvia</div>
    <div class="seg"><button class="${env === 'P' ? 'on' : ''}" data-act="env" data-v="P">Personal</button><button class="${env === 'B' ? 'on' : ''}" data-act="env" data-v="B">Business</button></div>`;
  $('#tabs').innerHTML = TABS.map(([k, l]) => `<button class="${tab === k ? 'on' : ''}" data-act="tab" data-v="${k}"><svg viewBox="0 0 24 24">${ICON[k]}</svg>${l}</button>`).join('');
}
function render() {
  renderChrome();
  $('#view').innerHTML = views[tab]();
  animateIn();
}
function animateIn() {
  document.querySelectorAll('[data-count]').forEach(el => {
    const v = +el.dataset.count, cur = el.dataset.cur;
    if (reduced) { el.textContent = C.fmt(v, cur); return; }
    const t0 = performance.now();
    const step = (t) => { const p = Math.min((t - t0) / 900, 1), e = 1 - Math.pow(1 - p, 3); el.textContent = C.fmt(Math.round(v * e), cur); if (p < 1) requestAnimationFrame(step); };
    requestAnimationFrame(step);
  });
  requestAnimationFrame(() => {
    document.querySelectorAll('[data-w]').forEach(el => el.style.width = el.dataset.w + '%');
    document.querySelectorAll('[data-p]').forEach(el => el.style.setProperty('--p', el.dataset.p));
  });
}

// ---------- views ----------
const txRow = (t) => {
  const cur = C.currencyOf(db, t.account), tr = t.type === 'transfer';
  return `<div class="row" data-act="txMenu" data-id="${t.id}" style="cursor:pointer"><div class="g"><div class="t">${esc(t.memo || t.category)}</div><div class="s">${t.date} · ${esc(t.category)} · ${esc(accName(t.account))}</div></div><div class="amt ${tr ? 'mute' : t.amount > 0 ? 'pos' : ''}">${C.fmt(t.amount, cur)}</div></div>`;
};
const views = {
  home() {
    const accts = C.envAccounts(db, env);
    let h = `<h2>${env === 'P' ? 'Personal' : 'Business'}</h2><div class="sub">Your Money. Your Vision. Your Control.</div>`;
    if (!accts.length) return h + empty('Start your financial map', 'Add an account to begin.') + `<button class="btn primary" data-act="addAccount">Add account</button>`;
    const nw = C.netWorthByCurrency(db, env);
    h += Object.entries(nw).map(([cur, v]) => `<div class="card hero" style="margin-top:14px"><div class="sub">Net worth · ${cur}</div><div class="big" data-count="${v}" data-cur="${cur}">${C.fmt(v, cur)}</div></div>`).join('');
    h += `<div class="chips"><button class="chip" style="--c:var(--red)" data-act="addTx" data-k="expense">↗ Expense</button><button class="chip" style="--c:var(--green)" data-act="addTx" data-k="income">↙ Income</button><button class="chip" data-act="addTx" data-k="transfer">⇄ Transfer</button></div>`;
    h += `<h3>ACCOUNTS</h3><div class="scroller">${accts.map(a => `<div class="card"><div class="t" style="font-weight:600">${esc(a.name)}</div><div class="amt" style="font-size:20px;margin-top:6px">${C.fmt(C.balance(db, a.id), a.currency)}</div><div class="sub">${a.currency}</div></div>`).join('')}<div class="card" data-act="addAccount" style="display:grid;place-items:center;cursor:pointer;color:var(--accent);font-weight:700">+ Add</div></div>`;
    const up = db.subscription.filter(s => s.env === env).map(s => ({ s, d: C.nextDue(s) })).filter(x => x.d).sort((a, b) => a.d.localeCompare(b.d)).slice(0, 3);
    if (up.length) h += `<h3>COMING UP</h3><div class="card">${up.map(({ s, d }) => { const n = C.daysUntil(d); return `<div class="row"><div class="g"><div class="t">${esc(s.name)}</div><div class="s" style="${n <= 2 ? 'color:#fb923c' : ''}">${n <= 0 ? 'Due today' : n === 1 ? 'Tomorrow' : 'In ' + n + ' days'}</div></div><div class="amt">${C.fmt(s.cost, s.currency)}</div></div>`; }).join('')}</div>`;
    const rec = C.visibleTxs(db, env).slice(0, 5);
    h += `<h3>RECENT</h3><div class="card">${rec.length ? rec.map(txRow).join('') : '<div class="sub">No transactions yet</div>'}</div>`;
    return h + `<div class="sub" style="text-align:center;margin-top:18px">Koshvia — A product by Vyuhika</div>`;
  },
  activity() {
    const cats = [...C.CATS, 'Transfer'];
    return `<h2>Activity</h2><div style="display:flex;gap:8px;margin:10px 0"><input id="q" type="search" placeholder="Search notes, categories, accounts" value="${esc(q)}"><select id="cat" style="width:auto;max-width:42%"><option value="">All</option>${opts(cats.map(c => [c, c]), cat)}</select></div><div class="card" id="txlist">${txList()}</div><button class="btn primary" data-act="addTx" data-k="expense" ${C.envAccounts(db, env).length ? '' : 'disabled'}>＋ New transaction</button>`;
  },
  plan() {
    const m = C.monthString();
    const goals = db.goal.filter(g => g.env === env && g.status === 'active');
    const budgets = C.activeBudgets(db, env), due = C.budgetsDue(db, env);
    const subs = db.subscription.filter(s => s.env === env);
    let h = `<h2>Plan</h2>`;
    h += `<h3>SAVINGS GOALS</h3><div class="card">${goals.length ? goals.map(g => { const p = C.goalProgress(db, g); return `<div class="row"><div class="ring" data-p="${Math.round(p.fraction * 100)}"><b>${Math.round(p.fraction * 100)}%</b></div><div class="g"><div class="t">${esc(g.name)}</div><div class="s">${C.fmt(p.saved, g.currency)} of ${C.fmt(g.target, g.currency)}</div>${p.monthly ? `<div class="s">Save ${C.fmt(p.monthly, g.currency)} / month by ${g.deadline}</div>` : p.fraction >= 1 ? '<div class="s pos">Goal reached</div>' : ''}</div><button class="chip" data-act="editGoal" data-id="${g.id}">Edit</button><button class="chip" data-act="archiveGoal" data-id="${g.id}">Archive</button></div>`; }).join('') : '<div class="sub">Link a goal to a savings account, then transfer money in to fill it.</div>'}<button class="chip" data-act="addGoal" style="margin-top:8px">+ Goal</button></div>`;
    h += (due.length ? `<div class="card"><button class="chip" data-act="renewBudgets">📅 New month: review ${due.length} budget${due.length === 1 ? '' : 's'}</button></div>` : '') + `<h3>BUDGETS (THIS MONTH)</h3><div class="card">${budgets.length ? budgets.map(b => { const s = C.budgetSpent(db, b, m), lim = C.budgetLimit(db, b), over = s > lim, carry = C.budgetCarry(db, b), pace = C.budgetPace(db, b); return `<div class="row" style="display:block" data-act="editBudget" data-id="${b.id}"><div style="display:flex;justify-content:space-between"><span class="t">${esc(b.name)}${b.category || carry ? `<div class="s">${[b.category, carry ? '+' + C.fmt(carry, b.currency) + ' carried over' : ''].filter(Boolean).join(' · ')}</div>` : ''}</span><span class="s">${C.fmt(s, b.currency)} / ${C.fmt(lim, b.currency)}</span></div><div class="bar ${over ? 'over' : ''}"><i style="width:0" data-w="${Math.min(Math.max(s, 0) / Math.max(lim, 1) * 100, 100)}"></i></div>${over ? `<div class="s" style="color:var(--red)">Over by ${C.fmt(s - lim, b.currency)}</div>` : pace && pace > lim ? `<div class="s" style="color:#F5B347">At this pace you'll reach ${C.fmt(pace, b.currency)} by month end</div>` : ''}</div>`; }).join('') : '<div class="sub">No budgets yet</div>'}<button class="chip" data-act="addBudget" style="margin-top:8px">+ Budget</button></div>`;
    const cs = [...new Set(subs.filter(s => s.status === 'running').map(s => s.currency))];
    h += `<h3>SUBSCRIPTIONS</h3><div class="card">${subs.length ? subs.map(s => `<div class="row"><div class="g"><div class="t">${esc(s.name)}</div><div class="s">${s.status === 'running' ? 'Next: ' + C.nextDue(s) : s.status}</div></div><div class="amt s">${C.fmt(s.cost, s.currency)} / ${s.cycle}</div>${s.status === 'running' ? `<button class="chip" data-act="editSub" data-id="${s.id}">Edit</button><button class="chip" data-act="paySub" data-id="${s.id}">Paid</button><button class="chip" style="--c:var(--red)" data-act="closeSub" data-id="${s.id}">Close</button>` : ''}</div>`).join('') : '<div class="sub">No subscriptions yet</div>'}${cs.length ? `<div class="sub" style="margin-top:8px">Monthly ≈ ${cs.map(c => C.fmt(subs.filter(s => s.currency === c).reduce((a, s) => a + C.monthlyCost(s), 0), c)).join(' · ')}</div>` : ''}<button class="chip" data-act="addSub" style="margin-top:8px">+ Subscription</button></div>`;
    return h;
  },
  insights() {
    const curs = [...new Set(C.envAccounts(db, env).map(a => a.currency))];
    if (!curs.length) return `<h2>Insights</h2>` + empty('No data yet', 'Add accounts and transactions to see insights.');
    const cur = curs.includes(insCur) ? insCur : curs[0], mo = C.lastMonths(6), all12 = C.lastMonths(12), now = all12.includes(insMonth) ? insMonth : all12.at(-1);
    const inc = C.monthTotal(db, env, cur, 'income', now), exp = C.monthTotal(db, env, cur, 'expense', now);
    const spend = C.categorySpend(db, env, cur, now), mx = Math.max(...spend.map(s => s[1]), 1);
    const hist = C.balanceHistory(db, env, cur, 6);
    return `<h2>Insights</h2>${curs.length > 1 ? `<select id="icur" style="margin:8px 0">${opts(curs.map(c => [c, c]), cur)}</select>` : ''}
    <h3 style="display:flex;justify-content:space-between;align-items:center">${now === all12.at(-1) ? 'THIS MONTH' : 'MONTH'}<select id="imon" style="width:auto">${opts(all12.slice().reverse().map(m => [m, m]), now)}</select></h3><div style="display:flex;gap:10px"><div class="card" style="flex:1"><div class="sub">Income</div><div class="amt" style="font-size:20px">${C.fmt(inc, cur)}</div></div><div class="card" style="flex:1"><div class="sub">Expenses</div><div class="amt" style="font-size:20px">${C.fmt(exp, cur)}</div></div></div>
    <h3>BALANCE, LAST 6 MONTHS</h3><div class="card">${lineChart(hist)}<div class="sub">Month-end totals of your ${cur} accounts. Transfers between them do not change the total.</div></div>
    <h3>SPENDING BY CATEGORY</h3><div class="card">${spend.length ? spend.map(([c, v]) => `<div style="margin:8px 0"><div style="display:flex;justify-content:space-between"><span>${esc(c)}</span><span class="amt">${C.fmt(v, cur)}</span></div><div class="bar"><i style="width:0" data-w="${v / mx * 100}"></i></div></div>`).join('') : '<div class="sub">No expenses this month</div>'}</div>
    <h3>INCOME VS EXPENSES</h3><div class="card">${barChart(mo, cur)}</div>
    <div class="sub">Transfers are never counted as income or expenses.</div>`;
  },
  more() {
    return `<h2>More</h2>
    <h3>BACKUP & MOVE DATA</h3><div class="card"><div class="sub" style="margin-bottom:10px">One JSON file with all records. It is the same format as the iPhone app, so you can move data between your phones. Restoring adds missing records and never overwrites.</div><div style="display:flex;gap:10px;flex-wrap:wrap"><button class="chip" data-act="export">Export backup</button><button class="chip" data-act="import">Restore from backup</button></div><input id="imp" type="file" accept=".json,application/json" hidden></div>
    <h3>EXPORT</h3><div class="card"><div class="sub">Transactions of this space as a spreadsheet file (CSV).</div><div style="margin-top:10px"><button class="chip" data-act="csv">Download CSV</button></div></div>
    <h3>INSTALL</h3><div class="card"><div class="sub">Install Koshvia on your home screen so it opens like an app and works offline.</div><div style="margin-top:10px"><button class="chip" data-act="install">Install app</button></div><div class="sub" style="margin-top:8px">If the button does nothing: Chrome menu ⋮ → "Install app" or "Add to Home screen".</div></div>
    <h3>DATA</h3><div class="card"><div class="sub">Everything is stored only on this device until you export it.</div><div style="margin-top:10px"><button class="chip btn danger" data-act="wipe" style="--c:var(--red)">Delete all data on this device</button></div></div>
    <div class="sub" style="text-align:center;margin-top:18px">Koshvia web · A product by Vyuhika</div>`;
  }
};
let insCur = '', insMonth = '';
function txList() {
  const qq = q.trim().toLowerCase();
  const rows = C.visibleTxs(db, env).filter(t => (!cat || t.category === cat) && (!qq || [t.memo, t.category, t.date, accName(t.account)].some(s => String(s).toLowerCase().includes(qq))));
  return rows.length ? rows.map(txRow).join('') : empty(C.visibleTxs(db, env).length ? 'No matches' : 'No transactions', C.visibleTxs(db, env).length ? 'Try a different search or filter.' : 'Tap a row later to edit or reverse it.');
}
function lineChart(h) {
  const w = 320, ht = 150, p = 16, vals = h.map(x => x.minor), mn = Math.min(...vals, 0), mx = Math.max(...vals, 1), r = (mx - mn) || 1;
  const pts = h.map((x, i) => [p + i * (w - 2 * p) / Math.max(h.length - 1, 1), ht - 22 - (x.minor - mn) / r * (ht - 44)]);
  const d = pts.map((q, i) => (i ? 'L' : 'M') + q[0].toFixed(1) + ' ' + q[1].toFixed(1)).join('');
  return `<svg class="chart" viewBox="0 0 ${w} ${ht}"><defs><linearGradient id="ag" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1AC7B3" stop-opacity=".45"/><stop offset="1" stop-color="#1AC7B3" stop-opacity="0"/></linearGradient></defs><path d="${d}L${pts.at(-1)[0]} ${ht - 22}L${pts[0][0]} ${ht - 22}Z" fill="url(#ag)"/><path d="${d}" fill="none" stroke="#1AC7B3" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>${pts.map(q => `<circle cx="${q[0]}" cy="${q[1]}" r="4" fill="#F5B347"/>`).join('')}${h.map((x, i) => `<text x="${pts[i][0]}" y="${ht - 4}" fill="currentColor" opacity=".6" font-size="10" text-anchor="middle">${x.month.slice(5)}</text>`).join('')}</svg>`;
}
function barChart(mo, cur) {
  const d = mo.map(m => [C.monthTotal(db, env, cur, 'income', m), C.monthTotal(db, env, cur, 'expense', m)]), mx = Math.max(...d.flat(), 1), w = 320, ht = 150, bw = 16, gap = (w - 6 * bw * 2) / 7;
  return `<svg class="chart" viewBox="0 0 ${w} ${ht}">${d.map(([i, e], k) => { const x = gap + k * (bw * 2 + gap), hi = i / mx * (ht - 34), he = e / mx * (ht - 34); return `<rect x="${x}" y="${ht - 20 - hi}" width="${bw}" height="${hi}" rx="4" fill="#4ADE80"/><rect x="${x + bw}" y="${ht - 20 - he}" width="${bw}" height="${he}" rx="4" fill="#F5B347"/><text x="${x + bw}" y="${ht - 5}" fill="currentColor" opacity=".6" font-size="10" text-anchor="middle">${mo[k].slice(5)}</text>`; }).join('')}</svg><div class="sub"><span style="color:#4ADE80">■</span> Income &nbsp; <span style="color:#F5B347">■</span> Expenses</div>`;
}

// ---------- sheets & forms ----------
function openSheet(html) { const s = $('#sheet'); s.innerHTML = `<div class="panel">${html}</div>`; s.hidden = false; }
function closeSheet() { $('#sheet').hidden = true; $('#sheet').innerHTML = ''; }
const field = (l, inner) => `<label>${l}</label>${inner}`;
const forms = {
  tx(kind = 'expense') {
    const accts = C.envAccounts(db, env);
    if (!accts.length) { toast('Add an account first'); return; }
    openSheet(`<h2>New transaction</h2><form data-form="tx"><input type="hidden" name="kind" value="${kind}">
      <div class="seg" style="display:flex;margin:0 0 6px">${['expense', 'income', 'transfer'].map(k => `<button type="button" class="${k === kind ? 'on' : ''}" data-act="kind" data-v="${k}" style="flex:1">${k[0].toUpperCase() + k.slice(1)}</button>`).join('')}</div>
      ${field('Account', `<select name="account">${accOpts()}</select>`)}
      <div id="g-to" ${kind === 'transfer' ? '' : 'hidden'}>${field('To', `<select name="to">${opts(accts.map(a => [a.id, `${a.name} (${a.currency})`]), accts.at(-1).id)}</select>`)}</div>
      <div id="g-cat" ${kind === 'transfer' ? 'hidden' : ''}>${field('Category', `<select name="category">${opts(C.CATS.map(c => [c, c]), kind === 'income' ? 'Salary' : 'Other')}</select>`)}</div>
      ${field(kind === 'transfer' ? 'Amount sent' : 'Amount', '<input name="amount" inputmode="decimal" placeholder="0.00" required>')}
      <div id="g-rec" hidden>${field('Amount received', '<input name="received" inputmode="decimal" placeholder="0.00">')}<div class="sub">Accounts use different currencies. Enter what actually arrived; both amounts are kept exactly.</div></div>
      ${field('Date', `<input type="date" name="date" value="${C.dayString()}" max="${C.dayString()}" required>`)}${field('Note', '<input name="memo" placeholder="Optional">')}<br><button class="btn primary">Save</button></form>`);
    syncTxForm();
  },
  account() { openSheet(`<h2>New account</h2><form data-form="account">${field('Name', '<input name="name" placeholder="e.g. HDFC Savings" required>')}${field('Currency', `<select name="currency">${opts(C.CURRENCIES.map(c => [c, c]), 'INR')}</select>`)}${field('Opening balance', '<input name="opening" inputmode="decimal" placeholder="0.00">')}<br><button class="btn primary">Save</button></form>`); },
  budget() {
    const cs = [...new Set(C.envAccounts(db, env).map(a => a.currency))]; if (!cs.length) return toast('Add an account first');
    openSheet(`<h2>New budget</h2><form data-form="budget">${field('Counts spending in', `<select name="category"><option value="">All expenses</option>${opts(C.CATS.filter(c => c !== 'Salary').map(c => [c, c]))}</select>`)}${field('Name (optional)', '<input name="name" placeholder="Defaults to the category">')}${field('Currency', `<select name="currency">${opts(cs.map(c => [c, c]))}</select>`)}${field('Monthly amount', '<input name="amount" inputmode="decimal" required>')}<label style="display:flex;gap:8px;align-items:center;margin-top:10px"><input type="checkbox" name="rollover" style="width:auto"> Carry over unused amount</label><div class="sub" style="margin-top:6px">Only expenses in the chosen category count. Each new month you are asked to continue or change it.</div><br><button class="btn primary">Save</button></form>`);
  },
  sub() { openSheet(`<h2>New subscription</h2><form data-form="sub">${field('Name', '<input name="name" placeholder="e.g. Netflix" required>')}${field('Currency', `<select name="currency">${opts(C.CURRENCIES.map(c => [c, c]), 'INR')}</select>`)}${field('Cost', '<input name="cost" inputmode="decimal" required>')}${field('Repeats', `<select name="cycle">${opts([['monthly', 'Monthly'], ['weekly', 'Weekly'], ['quarterly', 'Quarterly'], ['halfYearly', 'Half-yearly'], ['annually', 'Annually']])}</select>`)}${field('First / next payment date', `<input type="date" name="start" value="${C.dayString()}" required>`)}<br><button class="btn primary">Save</button></form>`); },
  goal() {
    if (!C.envAccounts(db, env).length) return toast('Add an account first');
    openSheet(`<h2>New savings goal</h2><form data-form="goal">${field('Goal', '<input name="name" placeholder="e.g. Emergency fund" required>')}${field('Savings account', `<select name="account">${accOpts()}</select>`)}${field('Target amount', '<input name="target" inputmode="decimal" required>')}${field('Target date (optional)', '<input type="date" name="deadline">')}<div class="sub" style="margin-top:8px">Progress is the live balance of the linked account.</div><br><button class="btn primary">Save</button></form>`);
  },
  budgetEdit(b) { const dec = decimals(b.currency); openSheet(`<h2>Edit budget</h2><form data-form="budgetEdit" data-id="${b.id}">${field('Counts spending in', `<select name="category"><option value="">All expenses</option>${opts(C.CATS.filter(c => c !== 'Salary').map(c => [c, c]), b.category)}</select>`)}${field('Name', `<input name="name" value="${esc(b.name)}">`)}${field(`Monthly amount (${b.currency})`, `<input name="amount" inputmode="decimal" value="${(b.amount / 10 ** dec).toFixed(dec)}" required>`)}<label style="display:flex;gap:8px;align-items:center;margin-top:10px"><input type="checkbox" name="rollover" style="width:auto" ${b.rollover === 1 ? 'checked' : ''}> Carry over unused amount</label><br><button class="btn primary">Save</button> <button type="button" class="chip" style="--c:var(--red);margin-top:10px" data-act="closeBudget" data-id="${b.id}">Close budget</button></form>`); },
  renew() { const due = C.budgetsDue(db, env); openSheet(`<h2>New month</h2><div class="sub">Keep last month's amounts or change them. Switch a budget off to close it.</div><form data-form="renew">${due.map(b => { const dec = decimals(b.currency); return `<div style="margin:12px 0"><label style="display:flex;gap:8px;align-items:center"><input type="checkbox" name="keep_${b.id}" checked style="width:auto"> ${esc(b.name)}</label><input name="amt_${b.id}" inputmode="decimal" value="${(b.amount / 10 ** dec).toFixed(dec)}"></div>`; }).join('')}<br><button class="btn primary">Confirm</button></form>`); },
  subEdit(s) { const dec = decimals(s.currency); openSheet(`<h2>Edit subscription</h2><form data-form="subEdit" data-id="${s.id}">${field('Name', `<input name="name" value="${esc(s.name)}" required>`)}${field(`Cost (${s.currency})`, `<input name="cost" inputmode="decimal" value="${(s.cost / 10 ** dec).toFixed(dec)}" required>`)}${field('Repeats', `<select name="cycle">${opts([['monthly', 'Monthly'], ['weekly', 'Weekly'], ['quarterly', 'Quarterly'], ['halfYearly', 'Half-yearly'], ['annually', 'Annually']], s.cycle)}</select>`)}${field('Bill date', `<input type="date" name="start" value="${s.anchor}" required>`)}<br><button class="btn primary">Save</button></form>`); },
  goalEdit(g) { const dec = decimals(g.currency); openSheet(`<h2>Edit goal</h2><form data-form="goalEdit" data-id="${g.id}">${field('Goal', `<input name="name" value="${esc(g.name)}" required>`)}${field(`Target (${g.currency})`, `<input name="target" inputmode="decimal" value="${(g.target / 10 ** dec).toFixed(dec)}" required>`)}${field('Target date (optional)', `<input type="date" name="deadline" value="${g.deadline || ''}">`)}<br><button class="btn primary">Save</button></form>`); },
  edit(t) { const dec = decimals(C.currencyOf(db, t.account)); openSheet(`<h2>Edit</h2><form data-form="edit" data-id="${t.id}">${field('Amount', `<input name="amount" inputmode="decimal" value="${(Math.abs(t.amount) / 10 ** dec).toFixed(dec)}" required>`)}${field('Date', `<input type="date" name="date" value="${t.date}" max="${C.dayString()}" required>`)}${field('Account', `<select name="account">${opts(C.envAccounts(db, env).map(a => [a.id, `${a.name} (${a.currency})`]), t.account)}</select>`)}${field('Note', `<input name="memo" value="${esc(t.memo)}">`)}${field('Category', `<select name="category">${opts(C.CATS.map(c => [c, c]), t.category)}</select>`)}<div class="sub" style="margin-top:8px">The original is reversed and a corrected entry is posted. Both stay in your history.</div><br><button class="btn primary">Save</button></form>`); }
};
function syncTxForm() {
  const f = document.querySelector('[data-form="tx"]'); if (!f) return;
  const kind = f.kind.value, from = db.account.find(a => a.id === f.account.value), to = db.account.find(a => a.id === f.to.value);
  $('#g-rec').hidden = !(kind === 'transfer' && from && to && from.currency !== to.currency);
}
const submit = {
  tx(f) {
    const k = f.kind.value, from = db.account.find(a => a.id === f.account.value), amt = C.parseAmt(f.amount.value, from.currency);
    if (k === 'transfer') { const to = db.account.find(a => a.id === f.to.value); C.addTransfer(db, { env, from: from.id, to: to.id, amount: amt, received: to.currency !== from.currency ? C.parseAmt(f.received.value || '0', to.currency) : amt, memo: f.memo.value, date: f.date.value }); }
    else C.addTx(db, { env, income: k === 'income', account: from.id, amount: amt, memo: f.memo.value, category: f.category.value, date: f.date.value });
  },
  account(f) { const cur = f.currency.value; db.account.push({ id: C.uid(), env, name: f.name.value.trim(), currency: cur, opening: f.opening.value ? C.parseAmt(f.opening.value, cur) : 0, updated: 0 }); },
  budget(f) { db.budget.push({ id: C.uid(), env, name: f.name.value.trim() || f.category.value || 'All expenses', category: f.category.value, currency: f.currency.value, amount: C.parseAmt(f.amount.value, f.currency.value), period: C.monthString(), rollover: f.rollover.checked ? 1 : 0, updated: 0 }); },
  sub(f) { db.subscription.push({ id: C.uid(), env, name: f.name.value.trim(), currency: f.currency.value, cost: C.parseAmt(f.cost.value, f.currency.value), cycle: f.cycle.value, anchor: f.start.value, status: 'running', updated: 0 }); },
  goal(f) { const a = db.account.find(x => x.id === f.account.value); db.goal.push({ id: C.uid(), env, name: f.name.value.trim(), currency: a.currency, target: C.parseAmt(f.target.value, a.currency), account: a.id, deadline: f.deadline.value || '', status: 'active', updated: 0 }); },
  edit(f) { const t = db.txn.find(x => x.id === f.dataset.id); C.editTx(db, t, { amount: C.parseAmt(f.amount.value, C.currencyOf(db, t.account)), memo: f.memo.value, category: f.category.value, date: f.date.value, account: f.account.value }); },
  budgetEdit(f) { const b = db.budget.find(x => x.id === f.dataset.id); b.name = f.name.value.trim() || b.name; b.category = f.category.value; b.amount = C.parseAmt(f.amount.value, b.currency); b.rollover = f.rollover.checked ? 1 : 0; b.updated = Date.now(); },
  renew(f) { for (const b of C.budgetsDue(db, env)) { if (f['keep_' + b.id].checked) { b.amount = C.parseAmt(f['amt_' + b.id].value || '0', b.currency); b.period = C.monthString(); } else b.period = 'closed'; b.updated = Date.now(); } },
  subEdit(f) { const s = db.subscription.find(x => x.id === f.dataset.id); s.name = f.name.value.trim(); s.cost = C.parseAmt(f.cost.value, s.currency); s.cycle = f.cycle.value; s.anchor = f.start.value; s.updated = Date.now(); },
  goalEdit(f) { const g = db.goal.find(x => x.id === f.dataset.id); g.name = f.name.value.trim(); g.target = C.parseAmt(f.target.value, g.currency); g.deadline = f.deadline.value || ''; g.updated = Date.now(); }
};

// ---------- actions ----------
const act = {
  tab: (d) => { tab = d.v; render(); scrollTo(0, 0); },
  env: (d) => { env = d.v; localStorage.setItem('koshvia.env', env); buzz(8); render(); },
  close: closeSheet,
  addTx: (d) => forms.tx(d.k), addAccount: () => forms.account(), addBudget: () => forms.budget(), addSub: () => forms.sub(), addGoal: () => forms.goal(),
  kind: (d) => { const f = document.querySelector('[data-form="tx"]'); f.kind.value = d.v; f.querySelectorAll('.seg button').forEach(b => b.classList.toggle('on', b.dataset.v === d.v)); $('#g-to').hidden = d.v !== 'transfer'; $('#g-cat').hidden = d.v === 'transfer'; f.amount.previousElementSibling.textContent = d.v === 'transfer' ? 'Amount sent' : 'Amount'; syncTxForm(); },
  txMenu: (d) => {
    const t = db.txn.find(x => x.id === d.id), cur = C.currencyOf(db, t.account);
    openSheet(`<h2>${esc(t.memo || t.category)}</h2><div class="sub">${t.date} · ${esc(t.category)} · ${esc(accName(t.account))}</div><div class="big" style="font-size:30px;margin:10px 0">${C.fmt(t.amount, cur)}</div><div style="display:flex;gap:10px">${t.type !== 'transfer' ? `<button class="chip" data-act="editTx" data-id="${t.id}">Edit</button>` : ''}<button class="chip btn danger" data-act="reverse" data-grp="${t.grp}" style="--c:var(--red)">Reverse</button><button class="chip" data-act="close">Close</button></div><div class="sub" style="margin-top:10px">Corrections keep an audit trail: nothing is deleted.</div>`);
  },
  editBudget: (d) => forms.budgetEdit(db.budget.find(x => x.id === d.id)), renewBudgets: () => forms.renew(), editSub: (d) => forms.subEdit(db.subscription.find(x => x.id === d.id)), editGoal: (d) => forms.goalEdit(db.goal.find(x => x.id === d.id)),
  closeBudget: (d) => { const b = db.budget.find(x => x.id === d.id); b.period = 'closed'; b.updated = Date.now(); save(); closeSheet(); render(); toast('Budget closed'); },
  csv: () => { const blob = new Blob([C.toCsv(db, env)], { type: 'text/csv' }), a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `Koshvia-transactions-${C.dayString()}.csv`; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); toast('CSV downloaded'); },
  editTx: (d) => forms.edit(db.txn.find(x => x.id === d.id)),
  reverse: (d) => { C.reverseGrp(db, d.grp); save(); closeSheet(); buzz([10, 40, 10]); render(); toast('Reversed'); },
  archiveGoal: (d) => { const g = db.goal.find(x => x.id === d.id); g.status = 'archived'; g.updated = Date.now(); save(); render(); },
  closeSub: (d) => { const s = db.subscription.find(x => x.id === d.id); s.status = 'closed'; s.updated = Date.now(); save(); render(); },
  paySub: (d) => { const s = db.subscription.find(x => x.id === d.id), a = C.envAccounts(db, env).find(x => x.currency === s.currency); if (!a) return toast(`Add a ${s.currency} account to record this`); C.addTx(db, { env, income: false, account: a.id, amount: s.cost, memo: s.name, category: 'Subscriptions' }); save(); buzz(); render(); toast('Payment recorded'); },
  export: () => {
    const blob = new Blob([JSON.stringify(C.exportBackup(db), null, 1)], { type: 'application/json' }), a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = `Koshvia-backup-${C.dayString()}.json`; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); toast('Backup downloaded');
  },
  import: () => $('#imp').click(),
  install: async () => { if (installEvt) { installEvt.prompt(); installEvt = null; } else toast('Use the Chrome menu ⋮ → Install app'); },
  wipe: () => { if (confirm('Delete ALL Koshvia data on this device? This cannot be undone. Export a backup first.')) { db = C.emptyDb(); save(); render(); toast('Deleted'); } }
};

document.addEventListener('click', (e) => {
  if (e.target.id === 'sheet') return closeSheet();
  const el = e.target.closest('[data-act]'); if (!el) return;
  e.preventDefault(); act[el.dataset.act]?.(el.dataset);
});
document.addEventListener('submit', (e) => {
  const f = e.target.closest('[data-form]'); if (!f) return; e.preventDefault();
  try { submit[f.dataset.form](f); save(); closeSheet(); buzz([10, 30, 10]); render(); toast('Saved'); } catch (err) { buzz(60); toast(err.message || 'Check the form'); }
});
document.addEventListener('input', (e) => {
  if (e.target.id === 'q') { q = e.target.value; $('#txlist').innerHTML = txList(); }
});
document.addEventListener('change', (e) => {
  if (e.target.id === 'cat') { cat = e.target.value; $('#txlist').innerHTML = txList(); }
  else if (e.target.id === 'icur') { insCur = e.target.value; render(); }
  else if (e.target.id === 'imon') { insMonth = e.target.value; render(); }
  else if (e.target.id === 'imp') {
    const file = e.target.files[0]; if (!file) return;
    file.text().then(t => { const n = C.mergeBackup(db, JSON.parse(t)); save(); render(); toast(`Restored ${n} new records`); }).catch(err => toast(err.message || 'Could not read that file')).finally(() => { e.target.value = ''; });
  } else if (e.target.closest('[data-form="tx"]')) syncTxForm();
});
window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); installEvt = e; });

// ---------- boot ----------
render();
navigator.storage?.persist?.();
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
const splash = $('#splash'), hide = () => splash.classList.add('hide');
splash.addEventListener('click', hide); setTimeout(hide, reduced ? 600 : 2800);
