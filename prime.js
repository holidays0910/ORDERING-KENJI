/* =====================================================================
   💰 PRIME COST MANAGEMENT  (galing sa Excel na KT_SO3_PrimeCost — weekly, kada branch)
   Mga bahagi: Prime Cost (worksheet) · Sales · Purchases & Petty Cash · Labor · Inventory (beg/end + tugma sa ERP)
   · Forecast · P&L (estimated vs actual ng Accounting) · Mga Linggo / Lahat ng Branch · Setup (rent, fixed, labor rate)
   Firestore: pc_weeks/{site}__{monday} · pc_setup/{site} · pc_rates/{site} (hourly lang) · pc_ratesecure/{site} (breakdown ng sahod, HR/Admin lang)
              pc_actual/{site}__{monday} (actual P&L ng Accounting)
   Sino ang puwedeng mag-edit ng linggo: ang manager ng branch na iyon (at Admin). Setup/rates/actual: Admin lang.
   ===================================================================== */
const PC_DAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];
const PC_SALES = [['vat', 'Sales (Vatable) — net'], ['exm', 'Sales (Vat-Exempt) — net'], ['sc', 'Senior Citizens Discount', 1], ['pwd', 'PWD Discount', 1], ['disc', 'Sales Discount', 1], ['comp', 'Complimentary', 1]];
// kategorya ng Petty Cash Form (gastos) -> linya sa P&L
const PC_PETTY = [['adv', 'ADVERTISING', 'mkt_adv'], ['meals', 'MEALS EXPENSE', 'dop_meals'], ['clean', 'CLEANING SUPPLIES', 'dop_clean'], ['kitchen', 'KITCHEN UTENSILS AND SUPPLIES', 'dop_kitchen'], ['office', 'OFFICE PRINTING AND SUPPLIES', 'ga_office'], ['bldg', 'BLDG - REPAIRS AND MAINTENANCE', 'rm_bldg'], ['eqp', "EQP'T - REPAIRS AND MAINTENANCE", 'rm_eqp'], ['med', 'MEDICAL EXPENSES', 'dop_med'], ['outs', 'OUTSIDE SERVICE CONTRACTUAL', 'lab_outs'], ['pest', 'PEST CONTROL & OTHER TESTS', 'dop_pest'], ['unif', 'UNIFORM', 'dop_unif'], ['travel', 'TRAVEL & TRANSPO', 'ga_travel'], ['tel', 'TELEPHONE & COMMUNICATION', 'ga_tel'], ['tables', 'TABLES & SERVICE WARES', 'dop_tables'], ['menus', 'MENUS & DRINK LISTS', 'dop_menus'], ['gas', 'GAS', 'util_gas'], ['decor', 'DECORATION', 'dop_decor'], ['postage', 'POSTAGE/NOTARIAL/DELIVERY', 'ga_postage'], ['repr', 'REPRESENTATION', 'mkt_repr'], ['tables2', 'TABLES & SERVICE WARES (2)', 'dop_tables'], ['affil', 'ADVANCES TO AFFILIATE', 'x_affil']];
// kategorya ng "Other expenses form"
const PC_OTHER = [['adv', 'ADVERTISING', 'mkt_adv'], ['menus', 'MENUS & DRINKS', 'dop_menus'], ['travel', 'TRAVEL & TRANSPO', 'ga_travel'], ['bldg', 'BLDG REP & MAINTENANCE', 'rm_bldg'], ['train', 'TRAINING PROGRAMS & MATERIALS', 'ga_train'], ['decor', 'DECORATIONS', 'dop_decor'], ['pest', 'PEST CONTROL & OTHER TEST', 'dop_pest'], ['rnd', 'R & D', 'mkt_rnd'], ['kitchen', 'KITCHEN UTENSILS & SUPPLIES', 'dop_kitchen'], ['office', 'OFFICE PRINTING & SUPPLIES', 'ga_office'], ['repr', 'REPRESENTATION', 'mkt_repr'], ['keq', 'KITCHEN EQUIPMENT (capex)', 'x_capex'], ['oeq', 'OFFICE EQUIPMENT (capex)', 'x_capex'], ['tables', 'TABLES & SERVICEWARES', 'dop_tables'], ['postage', 'POSTAGE/NOTARIAL/DELIVERY', 'ga_postage'], ['unif', 'UNIFORM', 'dop_unif'], ['rm', 'REPAIRS & MAINTENANCE', 'rm_eqp']];
// kategorya ng pagkain na binili sa petty cash (PCF Food)
const PC_FOOD = [['meat', 'MEAT'], ['seafood', 'FOOD COST (SEAFOOD) 51110020'], ['poultry', 'FOOD COST (POULTRY) 51110030'], ['produce', 'FOOD COST (PRODUCE) 5110040'], ['dairy', 'FOOD COST (DAIRY) 5110060'], ['grocery', 'FOOD COST (GROCERY & DRY GOODS) 5110070'], ['japanese', 'FOOD COST (JAPANESE) 5110090'], ['beer', 'COST OF SALES BEER (51130010)'], ['softbev', 'COST OF SALES SOFT BEVERAGE (51120010)'], ['misc', 'MISCELLANEOUS MATERIALS COSTS']];
// P&L structure (galing sa Weekly PnL Report)
const PC_GROUPS = { dop: 'Direct Operating Expenses', ga: 'General & Administrative', mkt: 'Marketing', util: 'Utilities', rm: 'Repairs & Maintenance', occ: 'Occupancy', dep: 'Depreciation', oh: 'Corporate Overhead' };
const PC_FIXED_DEF = [['util_elec', 'Electricity', 'util'], ['util_gas', 'Gas', 'util'], ['util_water', 'Water & Sewer', 'util'], ['util_trash', 'Trash Removal', 'util'], ['util_ac', 'Aircon Charges', 'util'], ['ga_tel', 'Telephone & Communications', 'ga'], ['ga_ins', 'Insurance', 'ga'], ['ga_tax', 'Taxes, Licenses & Permits', 'ga'], ['occ_cam', 'Common Area Charges', 'occ'], ['dep_kit', "Dep'n — Kitchen Equipment", 'dep'], ['dep_furn', "Dep'n — Furniture, Office & Equipment", 'dep'], ['dop_pest', 'Pest Control (estimate)', 'dop']];
const PC_CH_DEF = [['Grab', 18, 'delivery'], ['Food Panda', 23.5, 'delivery'], ['Pickaroo', 15, 'delivery'], ['BDO Credit Card', 2.37, 'bank'], ['BDO Debit Card', 2, 'bank'], ['Gcash', 2, 'delivery']];
const PC_ACT_LINES = [['sales', 'Total Sales (gross)'], ['net', 'Sales after Discounts'], ['cogs', 'Cost of Sales'], ['labor', 'Labor'], ['dop', 'Direct Operating Expenses'], ['ga', 'General & Administrative'], ['mkt', 'Marketing'], ['util', 'Utilities'], ['rm', 'R&M'], ['occ', 'Occupancy'], ['dep', 'Depn'], ['oh', 'Overhead'], ['som', 'Store Operating Margin']];
let PC = { sites: [], site: '', week: '', tab: 'prime', setup: null, W: null, rates: null, secure: null, actual: null, prev: null, dirty: false, me: null, allBr: [], weeks: [], hr: [], erp: {}, ready: false };

/* ---------- gamit ---------- */
function pcEsc(s) { return typeof srchEsc === 'function' ? srchEsc(s) : String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function pcISO(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
function pcDate(s) { const [y, m, d] = String(s).slice(0, 10).split('-').map(Number); return new Date(y, m - 1, d); }
function pcMonday(s) { const d = s ? pcDate(s) : new Date(); const k = (d.getDay() + 6) % 7; d.setDate(d.getDate() - k); return pcISO(d); }
function pcAdd(s, n) { const d = pcDate(s); d.setDate(d.getDate() + n); return pcISO(d); }
function pcR2(n) { return Math.round((+n || 0) * 100) / 100; }
function pcM(n) { n = +n || 0; return (n < 0 ? '(' : '') + Math.abs(n).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + (n < 0 ? ')' : ''); }
function pcP(n) { return ((+n || 0) * 100).toFixed(1) + '%'; }
function pcSlug(s) { return typeof invSlug === 'function' ? invSlug(s) : String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); }
function pcSum(a) { return (a || []).reduce((x, y) => x + (+y || 0), 0); }
function pcN(v) { // numero o simpleng formula tulad ng =(100+50)/1.12
  if (typeof v === 'number') return v; let s = String(v == null ? '' : v).trim().replace(/,/g, '').replace(/^=/, ''); if (!s) return 0;
  if (/^[0-9+\-*/(). ]+$/.test(s)) { try { const r = Function('"use strict";return (' + s + ')')(); return isFinite(r) ? r : 0; } catch (e) { return 0; } }
  const f = parseFloat(s); return isFinite(f) ? f : 0;
}
function pcWeekKey(w) { return PC.site + '__' + (w || PC.week); }
function pcCan() { // puwede bang mag-edit ng linggo?
  const u = PC.me || {}; if (PC.role === 'admin') return true;
  if (PC.W && PC.W.locked) return false; const s = PC.sites.find(x => x.key === PC.site); if (!s) return false;
  return PC.role === 'branch' && PC.mine.includes(s.key) && !/staff|crew|cashier|assistant|employee|waiter|server/i.test(String(u.role || '') + ' ' + String(u.position || u.title || ''));
}
function pcIsAdmin() { return PC.role === 'admin'; }
function pcSite() { return PC.sites.find(x => x.key === PC.site) || {}; }

/* ---------- default na dokumento ---------- */
function pcNewWeek(w) { const s = pcSite(); const z = () => Array(7).fill(0); const sales = {}; PC_SALES.forEach(([k]) => sales[k] = z()); return { site: PC.site, branch: s.name || '', branchCode: s.code || '', company: s.company || '', week: w, sales, covers: z(), ch: {}, inv: [], petty: [], food: [], other: [], labor: { rows: [], legal: Array(7).fill(false), special: Array(7).fill(false) }, plan: { rows: [] }, fc: { sales: z() }, invc: { beg: {}, end: {}, ppBeg: 0, ppEnd: 0 }, locked: false }; }
function pcSetupFill(d) {
  const s = Object.assign({ mgmtPct: 12, taxPct: 0, foodTarget: 30, laborTarget: 25, commKw: 'KENKO', rent: { sqm: 0, basic: 0, min: 0, pct: 10 }, channels: PC_CH_DEF.map(([n, p, k]) => ({ name: n, pct: p, kind: k })), fixed: PC_FIXED_DEF.map(([id, label, grp]) => ({ id, label, grp, amt: 0, per: 'month' })) }, d || {});
  s.rent = Object.assign({ sqm: 0, basic: 0, min: 0, pct: 10 }, s.rent || {}); return s;
}
function pcFixedWeekly(f) { const a = +f.amt || 0; return f.per === 'year' ? a / 365 * 7 : f.per === 'week' ? a : a * 12 / 52; }

/* ---------- COMPUTE (porma ng Excel) ---------- */
function pcLaborRate(RT, name) { return ((RT && RT.emps) || []).find(e => e.name === name) || null; }
function pcCalc(S, W, RT) {
  const a = (arr, i) => +((arr || [])[i]) || 0, R = { days: PC_DAYS.length }, sl = W.sales || {};
  R.gross = PC_DAYS.map((_, i) => PC_SALES.reduce((t, [k]) => t + a(sl[k], i), 0));
  R.grossT = pcSum(R.gross); R.netT = pcSum(sl.vat) + pcSum(sl.exm); R.discT = R.grossT - R.netT;
  R.pct = {}; PC_SALES.forEach(([k]) => R.pct[k] = R.grossT > 0 ? pcSum(sl[k]) / R.grossT : 0);
  // purchases (Daily Invoice Log): food net = gross − vat − supplies − cleaning − meals
  R.inv = (W.inv || []).map(r => { const g = +r.gross || 0, v = +r.vat || 0, sp = +r.sp || 0, cl = +r.cl || 0, ml = +r.ml || 0; return { gross: g, vat: v, sp, cl, ml, net: g - v - sp - cl - ml }; });
  R.invGross = pcSum(R.inv.map(x => x.gross)); R.invVat = pcSum(R.inv.map(x => x.vat)); R.invFood = pcSum(R.inv.map(x => x.net));
  R.invSp = pcSum(R.inv.map(x => x.sp)); R.invCl = pcSum(R.inv.map(x => x.cl)); R.invMl = pcSum(R.inv.map(x => x.ml)); R.invOpex = R.invSp + R.invCl + R.invMl;
  R.pcfFood = pcSum((W.food || []).map(r => (+r.gross || 0) - (+r.vat || 0))); R.foodByCat = {}; (W.food || []).forEach(r => { R.foodByCat[r.cat || 'misc'] = (R.foodByCat[r.cat || 'misc'] || 0) + (+r.gross || 0) - (+r.vat || 0); });
  R.purchases = R.invFood + R.pcfFood;
  const ic = W.invc || {}; R.beg = +((ic.beg || {}).value) || 0; R.end = +((ic.end || {}).value) || 0;
  R.foodCost = R.purchases + R.beg - R.end; R.foodPct = R.grossT > 0 ? R.foodCost / R.grossT : 0;
  // labor
  const lr = (W.labor || {}), legal = lr.legal || [], spec = lr.special || [];
  const calcL = rows => { const d = Array(7).fill(0), per = []; (rows || []).forEach(r => { const e = pcLaborRate(RT, r.name); const hr = e ? +e.hourly || 0 : 0, lg = e ? +e.legal || 0 : 0, sp = e ? +e.special || 0 : 0; let tot = 0, th = 0; for (let i = 0; i < 7; i++) { const h = a(r.hrs, i); const c = h * hr + (legal[i] ? lg * h : 0) + (spec[i] ? sp * h : 0); d[i] += c; tot += c; th += h; } per.push({ rate: hr, hours: th, cost: tot, missing: !e && th > 0 }); }); return { d, per, total: pcSum(d) }; };
  R.lab = calcL(lr.rows); R.hourly = R.lab.total; R.mgmt = R.grossT * ((+S.mgmtPct || 0) / 100); R.tax = (R.mgmt + R.hourly) * ((+S.taxPct || 0) / 100);
  R.laborT = R.mgmt + R.hourly + R.tax; R.cogsT = R.foodCost; R.prime = R.laborT + R.foodCost; R.gm = R.grossT - R.prime;
  R.planLab = calcL(((W.plan || {}).rows) || []); R.fcSalesT = pcSum((W.fc || {}).sales);
  // delivery / bank fees
  R.fees = (S.channels || []).map(c => { const tot = pcSum((W.ch || {})[c.name]); return { name: c.name, kind: c.kind, tot, fee: tot * ((+c.pct || 0) / 100) }; });
  R.feeDel = pcSum(R.fees.filter(f => f.kind !== 'bank').map(f => f.fee)); R.feeBank = pcSum(R.fees.filter(f => f.kind === 'bank').map(f => f.fee)); R.feeT = R.feeDel + R.feeBank;
  // petty at other
  R.pettyBy = {}; (W.petty || []).forEach(r => { const n = (+r.gross || 0) - (+r.vat || 0); R.pettyBy[r.cat] = (R.pettyBy[r.cat] || 0) + n; });
  R.otherBy = {}; (W.other || []).forEach(r => { const n = (+r.gross || 0) - (+r.vat || 0); R.otherBy[r.cat] = (R.otherBy[r.cat] || 0) + n; });
  R.pettyT = pcSum(Object.values(R.pettyBy)); R.otherT = pcSum(Object.values(R.otherBy));
  R.opexT = R.invOpex + R.pettyT + R.feeT; R.covers = pcSum(W.covers); R.checkAvg = R.covers > 0 ? R.grossT / R.covers : 0;
  R.pnl = pcPnl(S, W, R); return R;
}
function pcRent(S, netSales) { const r = S.rent || {}, sq = +r.sqm || 0; const basic = sq * (+r.basic || 0) / 4, pctAmt = netSales * ((+r.pct || 0) / 100), tot = basic + pctAmt, min = sq * (+r.min || 0) * 12 / 52; return { basic, pctAmt, tot, min, rent: tot < min ? min : tot }; }
function pcPnl(S, W, R) {
  const P = {}, g = {}; const L = (k, label, amt) => ({ k, label, amt: pcR2(amt) });
  const pb = k => R.pettyBy[k] || 0, ob = k => R.otherBy[k] || 0;
  const fixedBy = grp => (S.fixed || []).filter(f => f.grp === grp);
  const fixedLines = grp => fixedBy(grp).map(f => L('f_' + f.id, f.label + ' (est.)', -pcFixedWeekly(f)));
  const sc = pcSum((W.sales || {}).sc), pwd = pcSum((W.sales || {}).pwd), dsc = pcSum((W.sales || {}).disc), cmp = pcSum((W.sales || {}).comp);
  P.sales = R.grossT; P.discounts = [L('d1', 'Sales Discount (PWD + Discount)', -(pwd + dsc)), L('d2', 'Senior Citizens Discount', -sc), L('d3', 'Complimentary', -cmp)];
  P.net = R.netT; P.cogs = -R.foodCost; P.gp = P.net + P.cogs;
  P.labLines = [L('l1', 'Hourly Personnel', -R.hourly), L('l2', 'Outside Services Contractual (on-call)', -pb('outs'))]; P.labor = -(R.hourly + pb('outs')); P.cm = P.gp + P.labor;
  const sumL = a => a.reduce((t, x) => t + x.amt, 0);
  const dopFx = fixedLines('dop');
  g.dop = [L('x1', 'Paper & Packaging', -(R.invSp + (+((W.invc || {}).ppBeg) || 0) - (+((W.invc || {}).ppEnd) || 0))), L('x2', 'Cleaning Supplies', -(R.invCl + pb('clean'))), L('x3', 'Meals Expense', -(pb('meals') + R.invMl)), L('x4', 'Kitchen Utensils & Supplies', -(pb('kitchen') + ob('kitchen'))), L('x5', 'Menus & Drink Lists', -(pb('menus') + ob('menus'))), L('x6', 'Decorations', -(pb('decor') + ob('decor'))), L('x7', 'Uniforms', -(pb('unif') + ob('unif'))), L('x8', 'Pest Control & Other Tests', -(pb('pest') + ob('pest'))), L('x9', 'Medical Expenses', -pb('med')), L('x10', 'Table & Service Wares', -(pb('tables') + pb('tables2') + ob('tables')))].concat(dopFx);
  g.ga = [L('a1', 'Travel & Transportation', -(pb('travel') + ob('travel'))), L('a2', 'Postage / Notarial / Delivery', -(pb('postage') + ob('postage'))), L('a3', 'Office Printing & Supplies', -(pb('office') + ob('office'))), L('a4', 'Bank Charges (card fees)', -R.feeBank), L('a5', 'Training Programs & Materials', -ob('train')), L('a6', 'Telephone (petty cash)', -pb('tel'))].concat(fixedLines('ga'));
  g.mkt = [L('m1', 'Advertising', -(pb('adv') + ob('adv'))), L('m2', 'Research & Development', -ob('rnd')), L('m3', 'Representation', -(pb('repr') + ob('repr')))].concat(fixedLines('mkt'));
  g.util = [L('u1', 'Gas (petty cash)', -pb('gas'))].concat(fixedLines('util'));
  g.rm = [L('r1', 'Building Repairs & Maintenance', -(pb('bldg') + ob('bldg'))), L('r2', 'Equipment Repairs & Maintenance', -(pb('eqp') + ob('rm')))].concat(fixedLines('rm'));
  P.rent = pcRent(S, R.netT); g.occ = [L('o1', 'Rent Expense (basic + % of sales, o minimum)', -P.rent.rent)].concat(fixedLines('occ'));
  g.dep = fixedLines('dep'); g.oh = [L('h1', 'Service Fee (delivery partner fees)', -R.feeDel)].concat(fixedLines('oh'));
  P.g = g; P.tot = {}; Object.keys(g).forEach(k => P.tot[k] = sumL(g[k]));
  P.controllable = P.labor + P.tot.dop + P.tot.ga + P.tot.mkt + P.tot.util + P.tot.rm; P.noncontrol = P.tot.occ + P.tot.dep; P.opCosts = P.controllable + P.noncontrol + P.tot.oh; P.som = P.gp + P.opCosts;
  P.unmapped = pb('affil') + ob('keq') + ob('oeq'); return P;
}

/* ---------- DATA ---------- */
async function pcLoadSites() {
  if (PC.ready) return; const u = PC.me = getCurrentUser() || {}; PC.role = normalizeRole(u.role); PC.sites = [];
  try { (await db.collection('inventory_branches').get()).forEach(d => { const x = d.data(); PC.sites.push({ key: pcSlug(x.code || x.branch), name: x.branch || x.code, code: x.code || '', company: x.company || '' }); }); } catch (e) {}
  PC.sites.sort((a, b) => (a.company + a.name).localeCompare(b.company + b.name));
  const me = String(u.branch || '').trim().toLowerCase(), extra = (u.branches || []).map(x => String(x).toLowerCase());
  PC.mine = PC.sites.filter(s => [s.name, s.code].some(v => v && String(v).toLowerCase() === me)).map(s => s.key);
  if (PC.role !== 'admin') {
    const vis = PC.sites.filter(s => PC.mine.includes(s.key) || extra.includes(String(s.name).toLowerCase()) || extra.includes(String(s.code).toLowerCase()));
    if (!vis.length && me) { const s = { key: pcSlug(u.branch), name: u.branch, code: '', company: u.company || '' }; PC.sites = [s]; PC.mine = [s.key]; } else PC.sites = vis;
  }
  if (!PC.site || !PC.sites.find(s => s.key === PC.site)) PC.site = (PC.sites[0] || {}).key || ''; if (!PC.week) PC.week = pcMonday(); PC.ready = true;
}
async function pcLoadSite() {
  const k = PC.site; if (!k) return; const [sd, rd, scd] = await Promise.all([db.collection('pc_setup').doc(k).get(), db.collection('pc_rates').doc(k).get(), pcIsAdmin() ? db.collection('pc_ratesecure').doc(k).get().catch(() => null) : Promise.resolve(null)]);
  PC.setup = pcSetupFill(sd.exists ? sd.data() : null); PC.rates = rd.exists ? rd.data() : { emps: [] }; PC.secure = scd && scd.exists ? scd.data() : { emps: [] };
}
async function pcLoadWeek() {
  const w = PC.week, [wd, ad, pd] = await Promise.all([db.collection('pc_weeks').doc(pcWeekKey(w)).get(), db.collection('pc_actual').doc(pcWeekKey(w)).get().catch(() => null), db.collection('pc_weeks').doc(pcWeekKey(pcAdd(w, -7))).get()]);
  const base = pcNewWeek(w); PC.W = wd.exists ? Object.assign(base, wd.data()) : base; PC.W.sales = Object.assign(base.sales, PC.W.sales || {}); PC.W.invc = Object.assign({ beg: {}, end: {}, ppBeg: 0, ppEnd: 0 }, PC.W.invc || {}); PC.W.labor = Object.assign(base.labor, PC.W.labor || {}); PC.W.fc = Object.assign(base.fc, PC.W.fc || {});
  PC.actual = ad && ad.exists ? ad.data() : { lines: {} }; PC.prev = pd.exists ? pd.data() : null; PC.dirty = false; PC.erp = {}; PC.isNew = !wd.exists;
  if (PC.isNew && PC.prev) { const pe = ((PC.prev.invc || {}).end || {}); if (pe.value) { PC.W.invc.beg = { value: +pe.value, src: 'prev-week', date: pcAdd(w, -1) }; PC.W.invc.ppBeg = +((PC.prev.invc || {}).ppEnd) || 0; } }
}
async function loadPrime() {
  const root = document.getElementById('pc-root'); if (!root || !db) return;
  try { root.innerHTML = '<div class="card">Kinukuha...</div>'; await pcLoadSites(); if (!PC.site) { root.innerHTML = '<div class="card">Wala pang naka-set na Branch para sa account na ito. Makipag-ugnayan kay Admin.</div>'; return; } await pcLoadSite(); await pcLoadWeek(); pcRender(); } catch (e) { root.innerHTML = '<div class="card">Error: ' + pcEsc(e.message) + '</div>'; }
}
async function pcSave(quiet) {
  if (!pcCan()) { alert('Ang manager ng branch (o Admin) lang ang puwedeng mag-edit. Naka-lock din ang linggong approved na.'); return; }
  const u = PC.me || {}; const s = pcSite(); const R = pcCalc(PC.setup, PC.W, PC.rates);
  try { await db.collection('pc_weeks').doc(pcWeekKey()).set(Object.assign({}, PC.W, { site: PC.site, branch: s.name || '', branchCode: s.code || '', company: s.company || '', week: PC.week, locked: !!PC.W.locked, sum: { gross: pcR2(R.grossT), net: pcR2(R.netT), food: pcR2(R.foodCost), labor: pcR2(R.laborT), prime: pcR2(R.prime), som: pcR2(R.pnl.som) }, updatedBy: u.email || '', updatedAt: new Date().toISOString() })); PC.dirty = false; PC.isNew = false; pcMark(); if (!quiet) pcToast('✅ Na-save.'); try { await logSystemAction('PRIMECOST_SAVED', `${s.name} ${PC.week}`); } catch (e) {} } catch (e) { alert('Error sa pag-save: ' + e.message); }
}
function pcToast(m) { const el = document.getElementById('pc-msg'); if (el) { el.textContent = m; setTimeout(() => { if (el.textContent === m) el.textContent = ''; }, 4000); } }
function pcMark() { const b = document.getElementById('pc-save'); if (b) b.style.outline = PC.dirty ? '3px solid #f59e0b' : ''; }
function pcDirty() { PC.dirty = true; pcMark(); pcLive(); }

/* ---------- RENDER: shell ---------- */
const PC_TABS = [['prime', '📊 Prime Cost'], ['sales', '💰 Sales'], ['purch', '🧾 Purchases'], ['petty', '👛 Petty Cash / Other'], ['labor', '👥 Labor'], ['inv', '📦 Inventory'], ['fc', '📈 Forecast'], ['pnl', '🧮 P&L'], ['weeks', '🗂️ Mga Linggo'], ['all', '🏢 Lahat ng Branch'], ['setup', '⚙️ Setup']];
function pcTabs() { return PC_TABS.filter(([k]) => k === 'setup' ? pcIsAdmin() : k === 'all' ? pcIsAdmin() && PC.sites.length > 1 : true); }
function pcRender() {
  const root = document.getElementById('pc-root'); if (!root) return; const s = pcSite(), W = PC.W, can = pcCan();
  const stat = W.locked ? '<span class="badge badge-success">🔒 Approved / Locked</span>' : can ? '<span class="badge badge-warning">✏️ Puwedeng i-edit</span>' : '<span class="badge badge-secondary">👁️ View lang</span>';
  root.innerHTML = `<div class="card"><div class="card-title"><span>💰 Prime Cost Management</span><span id="pc-msg" style="font-size:.8rem;color:#166534;"></span></div>
  <div style="display:flex;gap:.4rem;flex-wrap:wrap;align-items:end;margin-bottom:.4rem;">
  <div><label style="font-weight:700;">Branch</label><br><select onchange="pcSiteChange(this.value)" style="min-width:200px;">${PC.sites.map(x => `<option value="${pcEsc(x.key)}" ${x.key === PC.site ? 'selected' : ''}>${pcEsc((x.company ? x.company + ' — ' : '') + x.name)}</option>`).join('')}</select></div>
  <div><label style="font-weight:700;">Linggo (Lunes)</label><br><input type="date" value="${PC.week}" onchange="pcWeekChange(this.value)"></div>
  <button class="btn btn-secondary btn-sm" onclick="pcWeekShift(-7)">◀</button><button class="btn btn-secondary btn-sm" onclick="pcWeekShift(7)">▶</button>
  <button class="btn btn-success btn-sm" id="pc-save" onclick="pcSave()" ${can ? '' : 'disabled'}>💾 I-save</button>
  <button class="btn btn-secondary btn-sm" onclick="pcPrint()">🖨️ Print</button><button class="btn btn-secondary btn-sm" onclick="pcExport()">⬇️ Excel</button>
  ${can ? '<button class="btn btn-secondary btn-sm" onclick="pcImportOpen()" title="Kunin ang laman ng lumang Prime Cost Excel">📥 I-import ang Excel</button>' : ''}
  ${pcIsAdmin() ? `<button class="btn btn-sm ${W.locked ? 'btn-warning' : 'btn-primary'}" onclick="pcToggleLock()">${W.locked ? '🔓 I-unlock' : '🔒 I-approve / Lock'}</button>` : ''}
  <span style="margin-left:auto;">${stat} <small style="color:#64748b;">${pcEsc(s.company || '')}${PC.isNew ? ' · bagong linggo (wala pang naka-save)' : ''}</small></span></div>
  <div id="pc-live"></div>
  <div style="display:flex;gap:.3rem;flex-wrap:wrap;margin:.5rem 0;">${pcTabs().map(([k, l]) => `<button class="btn btn-sm ${PC.tab === k ? 'btn-primary' : 'btn-secondary'}" onclick="PC.tab='${k}';pcRender()">${l}</button>`).join('')}</div>
  <div id="pc-body" style="overflow-x:auto;">${({ prime: pcHtmlPrime, sales: pcHtmlSales, purch: pcHtmlPurch, petty: pcHtmlPetty, labor: pcHtmlLabor, inv: pcHtmlInv, fc: pcHtmlFc, pnl: pcHtmlPnl, weeks: pcHtmlWeeks, all: pcHtmlAll, setup: pcHtmlSetup }[PC.tab] || pcHtmlPrime)()}</div></div>`;
  pcLive(); pcMark(); if (PC.tab === 'weeks') pcLoadWeeks(); if (PC.tab === 'all') pcLoadAll();
}
function pcLive() {
  const el = document.getElementById('pc-live'); if (!el) return; const R = pcCalc(PC.setup, PC.W, PC.rates), S = PC.setup;
  const chip = (t, v, p, tgt) => `<div style="flex:1;min-width:120px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:.5rem;padding:.3rem .5rem;"><div style="font-size:.7rem;color:#64748b;">${t}</div><b>${v}</b>${p != null ? ` <small style="color:${tgt != null && p > tgt ? '#b91c1c' : '#166534'};">${pcP(p)}</small>` : ''}</div>`;
  el.innerHTML = `<div style="display:flex;gap:.4rem;flex-wrap:wrap;">${chip('Total Sales', '₱' + pcM(R.grossT))}${chip('Food Cost', '₱' + pcM(R.foodCost), R.foodPct, (S.foodTarget || 0) / 100)}${chip('Labor', '₱' + pcM(R.laborT), R.grossT ? R.laborT / R.grossT : 0, (S.laborTarget || 0) / 100)}${chip('PRIME COST', '₱' + pcM(R.prime), R.grossT ? R.prime / R.grossT : 0, ((S.foodTarget || 0) + (S.laborTarget || 0)) / 100)}${chip('Gross Margin', '₱' + pcM(R.gm), R.grossT ? R.gm / R.grossT : 0)}</div>`;
  document.querySelectorAll('[data-pc]').forEach(n => { const v = pcLiveVal(R, n.getAttribute('data-pc')); if (v != null) n.textContent = v; });
}
function pcLiveVal(R, k) {
  const p = k.split(':'); if (p[0] === 'gross') return pcM(R.gross[+p[1]]); if (p[0] === 'grossT') return pcM(R.grossT);
  if (p[0] === 'inv') return pcM((R.inv[+p[1]] || {}).net); if (p[0] === 'labc') return pcM((R.lab.per[+p[1]] || {}).cost); if (p[0] === 'labh') return String(pcR2((R.lab.per[+p[1]] || {}).hours));
  if (p[0] === 'labd') return pcM(R.lab.d[+p[1]]); if (p[0] === 'plc') return pcM((R.planLab.per[+p[1]] || {}).cost); if (p[0] === 'pld') return pcM(R.planLab.d[+p[1]]);
  if (p[0] === 'petty') { const r = PC.W.petty[+p[1]] || {}; return pcM((+r.gross || 0) - (+r.vat || 0)); } if (p[0] === 'other') { const r = PC.W.other[+p[1]] || {}; return pcM((+r.gross || 0) - (+r.vat || 0)); } if (p[0] === 'food') { const r = PC.W.food[+p[1]] || {}; return pcM((+r.gross || 0) - (+r.vat || 0)); }
  if (p[0] === 'fee') return pcM((R.fees[+p[1]] || {}).fee); if (p[0] === 'invT') return pcM(R.invFood); return null;
}
async function pcSiteChange(k) { if (PC.dirty && !await uiConfirm('May hindi pa na-save. Lumipat pa rin?')) { pcRender(); return; } PC.site = k; await loadPrime(); }
async function pcWeekChange(v) { if (!v) return; if (PC.dirty && !await uiConfirm('May hindi pa na-save. Lumipat pa rin?')) { pcRender(); return; } PC.week = pcMonday(v); await pcLoadWeek(); pcRender(); }
function pcWeekShift(n) { pcWeekChange(pcAdd(PC.week, n)); }
async function pcToggleLock() { PC.W.locked = !PC.W.locked; try { await db.collection('pc_weeks').doc(pcWeekKey()).set({ locked: PC.W.locked, site: PC.site, week: PC.week, branch: pcSite().name || '', branchCode: pcSite().code || '', company: pcSite().company || '' }, { merge: true }); } catch (e) { alert('Error: ' + e.message); PC.W.locked = !PC.W.locked; } pcRender(); }

/* ---------- input helpers ---------- */
function pcInp(val, cb, dis, w) { return `<input type="text" inputmode="decimal" value="${val ? pcEsc(String(+val ? pcR2(val) : val)) : ''}" ${dis ? 'disabled' : ''} onchange="${cb}" style="width:${w || 82}px;text-align:right;padding:.25rem;">`; }
function pcSetArr(path, i, el) { const o = pcPath(path); o[i] = pcN(el.value); pcDirty(); }
function pcPath(p) { const o = PC.W; const k = p.split('.'); let c = o; k.forEach(x => { if (c[x] == null) c[x] = x === 'hrs' ? [] : {}; c = c[x]; }); return c; }
function pcSetCh(ci, i, el) { const name = PC.setup.channels[ci].name; PC.W.ch = PC.W.ch || {}; PC.W.ch[name] = PC.W.ch[name] || Array(7).fill(0); PC.W.ch[name][i] = pcN(el.value); pcDirty(); }
function pcSetRow(list, i, f, el, num) { PC.W[list][i][f] = num ? pcN(el.value) : el.value; pcDirty(); }
function pcRowAdd(list, tpl) { PC.W[list] = PC.W[list] || []; PC.W[list].push(tpl); PC.dirty = true; pcRender(); }
async function pcRowDel(list, i) { if (!await uiConfirm('Burahin ang row na ito?')) return; PC.W[list].splice(i, 1); PC.dirty = true; pcRender(); }
function pcDayHead(extra) { const d0 = PC.week; return PC_DAYS.map((d, i) => `<th>${d}<br><small>${pcAdd(d0, i).slice(5)}</small></th>`).join('') + (extra || ''); }
function pcTbl(head, body, foot) { return `<table style="font-size:.85rem;min-width:100%;"><thead><tr>${head}</tr></thead><tbody>${body}</tbody>${foot ? `<tfoot>${foot}</tfoot>` : ''}</table>`; }

/* ---------- TAB: Prime Cost worksheet ---------- */
function pcHtmlPrime() {
  const R = pcCalc(PC.setup, PC.W, PC.rates), S = PC.setup, W = PC.W, G = R.grossT; const sl = W.sales;
  const pc = v => G > 0 ? pcP(v / G) : '—'; const row = (lab, arr, tot, bold, cls) => `<tr style="${bold ? 'font-weight:700;background:#f8fafc;' : ''}${cls || ''}"><td style="white-space:nowrap;">${lab}</td>${arr ? arr.map(v => `<td style="text-align:right;">${v ? pcM(v) : ''}</td>`).join('') : '<td colspan="7"></td>'}<td style="text-align:right;">${tot != null ? pcM(tot) : ''}</td><td style="text-align:right;">${tot != null ? pc(tot) : ''}</td></tr>`;
  const sec = t => `<tr><td colspan="10" style="background:#e2e8f0;font-weight:800;">${t}</td></tr>`;
  const tgtF = (S.foodTarget || 0) / 100, tgtL = (S.laborTarget || 0) / 100;
  const flag = (v, t) => t && G > 0 ? (v / G > t ? ' ⚠️ lampas sa target ' + pcP(t) : ' ✅ pasok sa target ' + pcP(t)) : '';
  let h = `<table style="font-size:.85rem;min-width:100%;"><thead><tr><th>Linya</th>${pcDayHead('<th>TOTAL</th><th>%</th>')}</tr></thead><tbody>${sec('SALES')}`;
  PC_SALES.forEach(([k, l]) => { h += row(l, sl[k], pcSum(sl[k])); });
  h += row('TOTAL SALES', R.gross, R.grossT, 1) + sec('COST OF SALES') + `<tr><td>Purchases (invoices + petty food)</td><td colspan="7"></td><td style="text-align:right;">${pcM(R.purchases)}</td><td></td></tr><tr><td>+ Beginning Inventory</td><td colspan="7"></td><td style="text-align:right;">${pcM(R.beg)}</td><td></td></tr><tr><td>− Ending Inventory</td><td colspan="7"></td><td style="text-align:right;">${pcM(R.end)}</td><td></td></tr>` + row('FOOD COST' + flag(R.foodCost, tgtF), null, R.foodCost, 1) + sec('LABOR') + row(`Management (${S.mgmtPct}% ng sales)`, null, R.mgmt) + row('Hourly Personnel', R.lab.d, R.hourly) + row(`Payroll Taxes & Benefits (${S.taxPct}%)`, null, R.tax) + row('TOTAL LABOR' + flag(R.laborT, tgtL), null, R.laborT, 1);
  h += `<tr style="font-weight:800;background:#fef3c7;"><td>PRIME COST${flag(R.prime, tgtF + tgtL)}</td><td colspan="7"></td><td style="text-align:right;">${pcM(R.prime)}</td><td style="text-align:right;">${pc(R.prime)}</td></tr>` + row('GROSS MARGIN', null, R.gm, 1);
  h += `<tr><td>Covers</td>${PC_DAYS.map((_, i) => `<td style="text-align:right;">${pcInp((W.covers || [])[i], `pcSetArr('covers',${i},this)`, !pcCan(), 60)}</td>`).join('')}<td style="text-align:right;">${R.covers || ''}</td><td></td></tr><tr><td>Check Average</td><td colspan="7"></td><td style="text-align:right;">${R.covers ? pcM(R.checkAvg) : ''}</td><td></td></tr>`;
  h += sec('* Hindi kasama sa prime cost') + `<tr><td>Supplies / Cleaning / Meals (invoices)</td><td colspan="7"></td><td style="text-align:right;">${pcM(R.invOpex)}</td><td>${pc(R.invOpex)}</td></tr><tr><td>Petty Cash expenses (non-food)</td><td colspan="7"></td><td style="text-align:right;">${pcM(R.pettyT)}</td><td>${pc(R.pettyT)}</td></tr><tr><td>Other purchases</td><td colspan="7"></td><td style="text-align:right;">${pcM(R.otherT)}</td><td>${pc(R.otherT)}</td></tr><tr><td>Delivery partner & card fees</td><td colspan="7"></td><td style="text-align:right;">${pcM(R.feeT)}</td><td>${pc(R.feeT)}</td></tr>`;
  const miss = R.lab.per.filter(x => x.missing).length; if (miss) h += `<tr><td colspan="10" style="color:#b91c1c;">⚠️ ${miss} empleyado sa Labor ang walang hourly rate (tingnan ang ⚙️ Setup › Labor Rates). Hindi pa sila nabibilang sa gastos.</td></tr>`;
  return h + '</tbody></table>';
}

/* ---------- TAB: Sales ---------- */
function pcHtmlSales() {
  const dis = !pcCan(), W = PC.W, R = pcCalc(PC.setup, W, PC.rates);
  let b = PC_SALES.map(([k, l, d]) => `<tr><td style="white-space:nowrap;">${l}</td>${PC_DAYS.map((_, i) => `<td>${pcInp(W.sales[k][i], `pcSetArr('sales.${k}',${i},this)`, dis)}</td>`).join('')}<td style="text-align:right;"><b>${pcM(pcSum(W.sales[k]))}</b></td></tr>`).join('');
  b += `<tr style="font-weight:700;background:#f8fafc;"><td>TOTAL SALES</td>${PC_DAYS.map((_, i) => `<td style="text-align:right;" data-pc="gross:${i}">${pcM(R.gross[i])}</td>`).join('')}<td style="text-align:right;" data-pc="grossT">${pcM(R.grossT)}</td></tr>`;
  const ch = (PC.setup.channels || []).map((c, ci) => `<tr><td style="white-space:nowrap;">${pcEsc(c.name)} <small style="color:#64748b;">${c.pct}% ${c.kind === 'bank' ? 'bank' : 'delivery'}</small></td>${PC_DAYS.map((_, i) => `<td>${pcInp(((W.ch || {})[c.name] || [])[i], `pcSetCh(${ci},${i},this)`, dis)}</td>`).join('')}<td style="text-align:right;"><b>${pcM(pcSum((W.ch || {})[c.name]))}</b><br><small>fee <span data-pc="fee:${ci}">${pcM(R.fees[ci].fee)}</span></small></td></tr>`).join('');
  return `<p style="font-size:.8rem;color:#64748b;margin:.2rem 0;">Ilagay ang <b>sales of the day</b> (net ng discount, gaya ng POS). Ang Total Sales ay net + mga discount (gaya ng Excel). Puwede kang mag-type ng formula, hal: <code>=211.61+456</code>.</p>` + pcTbl(`<th>Sales</th>${pcDayHead('<th>TOTAL</th>')}`, b) +
    `<h4 style="margin:.8rem 0 .2rem;">🛵 Sales ayon sa Payment / Delivery Channel (para sa fees)</h4>` + pcTbl(`<th>Channel</th>${pcDayHead('<th>TOTAL / Fee</th>')}`, ch) + `<p style="font-size:.78rem;color:#64748b;">Ang % ng fee ng bawat channel ay itinatakda ni Admin sa ⚙️ Setup.</p>`;
}

/* ---------- TAB: Purchases (Daily Invoice Log) ---------- */
function pcHtmlPurch() {
  const dis = !pcCan(), W = PC.W, R = pcCalc(PC.setup, W, PC.rates);
  const rows = (W.inv || []).map((r, i) => `<tr><td><input value="${pcEsc(r.sup || '')}" ${dis ? 'disabled' : ''} list="pc-sup" onchange="pcSetRow('inv',${i},'sup',this)" style="width:150px;"></td><td><input type="date" value="${pcEsc(r.date || '')}" ${dis ? 'disabled' : ''} onchange="pcSetRow('inv',${i},'date',this)"></td><td>${pcInp(r.gross, `pcSetRow('inv',${i},'gross',this,1)`, dis)}</td><td>${pcInp(r.vat, `pcSetRow('inv',${i},'vat',this,1)`, dis, 70)}</td><td>${pcInp(r.sp, `pcSetRow('inv',${i},'sp',this,1)`, dis, 70)}</td><td>${pcInp(r.cl, `pcSetRow('inv',${i},'cl',this,1)`, dis, 70)}</td><td>${pcInp(r.ml, `pcSetRow('inv',${i},'ml',this,1)`, dis, 70)}</td><td style="text-align:right;"><b data-pc="inv:${i}">${pcM((R.inv[i] || {}).net)}</b></td><td>${dis ? '' : `<button class="btn btn-sm btn-danger" onclick="pcRowDel('inv',${i})">🗑️</button>`}</td></tr>`).join('');
  const sups = [...new Set((PC.weeks.flatMap(w => (w.inv || []).map(x => x.sup)).concat((W.inv || []).map(x => x.sup))).filter(Boolean))];
  const tot = `<tr style="font-weight:700;background:#f8fafc;"><td colspan="2">TOTALS</td><td style="text-align:right;">${pcM(R.invGross)}</td><td style="text-align:right;">${pcM(R.invVat)}</td><td style="text-align:right;">${pcM(R.invSp)}</td><td style="text-align:right;">${pcM(R.invCl)}</td><td style="text-align:right;">${pcM(R.invMl)}</td><td style="text-align:right;" data-pc="invT">${pcM(R.invFood)}</td><td></td></tr>`;
  return `<p style="font-size:.8rem;color:#64748b;margin:.2rem 0;">📒 <b>Daily Invoice Log</b> — lahat ng invoice (SAP/commissary o direct supplier). Ilagay ang <b>Gross</b> (buong invoice) at <b>Input VAT</b>. Kung may kasamang supplies/panlinis/meals, ilagay ang net-of-VAT nila sa kolum nila; ang natitira ay <b>Food net</b>. Tip: puwedeng <code>=(756+172.1)/1.12</code>.</p>` +
    `<datalist id="pc-sup">${sups.map(s => `<option value="${pcEsc(s)}">`).join('')}</datalist>` + pcTbl('<th>Supplier / Invoice #</th><th>Petsa</th><th>Gross</th><th>Input VAT</th><th>Supplies (PP/TS/GS)</th><th>Cleaning</th><th>Meals</th><th>Food net</th><th></th>', rows || '<tr><td colspan="9" style="color:#94a3b8;">Wala pang invoice.</td></tr>', tot) +
    (dis ? '' : `<button class="btn btn-success btn-sm" style="margin-top:.4rem;" onclick="pcRowAdd('inv',{sup:'',date:'${PC.week}',gross:0,vat:0,sp:0,cl:0,ml:0})">➕ Dagdag na Invoice</button>`) +
    `<h4 style="margin:1rem 0 .2rem;">🥬 Pagkain na binili sa Petty Cash (PCF Food)</h4>` + pcCatTable('food', PC_FOOD, dis, R);
}
function pcCatTable(list, cats, dis, R) {
  const W = PC.W; const rows = (W[list] || []).map((r, i) => `<tr><td><input type="date" value="${pcEsc(r.date || '')}" ${dis ? 'disabled' : ''} onchange="pcSetRow('${list}',${i},'date',this)"></td><td><input value="${pcEsc(r.part || '')}" ${dis ? 'disabled' : ''} onchange="pcSetRow('${list}',${i},'part',this)" style="width:150px;" placeholder="Particulars"></td><td><input value="${pcEsc(r.sup || '')}" ${dis ? 'disabled' : ''} onchange="pcSetRow('${list}',${i},'sup',this)" style="width:130px;" placeholder="Supplier"></td><td><input value="${pcEsc(r.ref || '')}" ${dis ? 'disabled' : ''} onchange="pcSetRow('${list}',${i},'ref',this)" style="width:80px;" placeholder="SI/OR #"></td><td>${pcInp(r.gross, `pcSetRow('${list}',${i},'gross',this,1)`, dis, 78)}</td><td>${pcInp(r.vat, `pcSetRow('${list}',${i},'vat',this,1)`, dis, 66)}</td><td><select ${dis ? 'disabled' : ''} onchange="pcSetRow('${list}',${i},'cat',this)" style="max-width:170px;">${cats.map(c => `<option value="${c[0]}" ${r.cat === c[0] ? 'selected' : ''}>${pcEsc(c[1])}</option>`).join('')}</select></td><td style="text-align:right;"><b data-pc="${list}:${i}">${pcM((+r.gross || 0) - (+r.vat || 0))}</b></td><td>${dis ? '' : `<button class="btn btn-sm btn-danger" onclick="pcRowDel('${list}',${i})">🗑️</button>`}</td></tr>`).join('');
  return pcTbl('<th>Petsa</th><th>Particulars</th><th>Supplier</th><th>SI/OR #</th><th>Gross</th><th>Input VAT</th><th>Kategorya</th><th>Net</th><th></th>', rows || '<tr><td colspan="9" style="color:#94a3b8;">Wala pa.</td></tr>') + (dis ? '' : `<button class="btn btn-success btn-sm" style="margin-top:.4rem;" onclick="pcRowAdd('${list}',{date:'${PC.week}',part:'',sup:'',ref:'',gross:0,vat:0,cat:'${cats[0][0]}'})">➕ Dagdag</button>`);
}

/* ---------- TAB: Petty cash / other expenses ---------- */
function pcHtmlPetty() {
  const dis = !pcCan(), R = pcCalc(PC.setup, PC.W, PC.rates);
  const sum = (by, cats) => cats.filter(c => by[c[0]]).map(c => `<tr><td>${pcEsc(c[1])}</td><td style="text-align:right;">${pcM(by[c[0]])}</td></tr>`).join('') || '<tr><td colspan="2" style="color:#94a3b8;">—</td></tr>';
  return `<h4 style="margin:.2rem 0;">👛 Petty Cash Fund Replenishment (gastos na hindi pagkain)</h4><p style="font-size:.8rem;color:#64748b;margin:.2rem 0;">Net = Gross − Input VAT. Piliin ang kategorya; doon ito mapupunta sa P&L.</p>` + pcCatTable('petty', PC_PETTY, dis, R) +
    `<div style="max-width:420px;margin-top:.5rem;">${pcTbl('<th>Buod ng Petty Cash</th><th>Net</th>', sum(R.pettyBy, PC_PETTY), `<tr style="font-weight:700;"><td>TOTAL</td><td style="text-align:right;">${pcM(R.pettyT)}</td></tr>`)}</div>` +
    `<h4 style="margin:1.2rem 0 .2rem;">🧰 Other Purchases (direct supplier — equipment, repairs, advertising, etc.)</h4>` + pcCatTable('other', PC_OTHER, dis, R) +
    `<div style="max-width:420px;margin-top:.5rem;">${pcTbl('<th>Buod ng Other Purchases</th><th>Net</th>', sum(R.otherBy, PC_OTHER), `<tr style="font-weight:700;"><td>TOTAL</td><td style="text-align:right;">${pcM(R.otherT)}</td></tr>`)}</div>` +
    (R.pnl.unmapped ? `<p style="color:#92400e;font-size:.8rem;">ℹ️ ${pcM(R.pnl.unmapped)} (Advances to Affiliate / Kitchen & Office Equipment) ay hindi kasama sa P&L (capex/advance).</p>` : '');
}

/* ---------- TAB: Labor ---------- */
function pcEmpOptions() { return ((PC.rates || {}).emps || []).map(e => e.name); }
function pcHtmlLabor() {
  const dis = !pcCan(), W = PC.W, R = pcCalc(PC.setup, W, PC.rates), names = pcEmpOptions();
  const flags = (k, l) => `<tr><td style="white-space:nowrap;"><b>${l}</b></td>${PC_DAYS.map((_, i) => `<td style="text-align:center;"><input type="checkbox" ${(W.labor[k] || [])[i] ? 'checked' : ''} ${dis ? 'disabled' : ''} onchange="PC.W.labor.${k}[${i}]=this.checked;pcDirty();"></td>`).join('')}<td></td><td></td><td></td></tr>`;
  const rowHtml = (list, i, r, per, pre) => `<tr><td style="white-space:nowrap;"><input list="pc-emps" value="${pcEsc(r.name || '')}" ${dis ? 'disabled' : ''} onchange="${pre}[${i}].name=this.value;pcDirty();pcRender();" style="width:180px;" placeholder="Pangalan"></td><td style="text-align:right;font-size:.75rem;color:${per.missing ? '#b91c1c' : '#64748b'};">${per.rate ? pcM(per.rate) : (per.missing ? 'walang rate' : '')}</td>${PC_DAYS.map((_, d) => `<td>${pcInp((r.hrs || [])[d], `{const a=${pre}[${i}];a.hrs=a.hrs||[];a.hrs[${d}]=pcN(this.value);pcDirty();}`, dis, 44)}</td>`).join('')}<td style="text-align:right;"><b data-pc="${list === 'rows' ? 'labh' : 'plh'}:${i}">${pcR2(per.hours)}</b></td><td style="text-align:right;" data-pc="${list === 'rows' ? 'labc' : 'plc'}:${i}">${pcM(per.cost)}</td><td>${dis ? '' : `<button class="btn btn-sm btn-danger" onclick="pcLabDel('${list}',${i})">🗑️</button>`}</td></tr>`;
  const head = `<th>Empleyado</th><th>Hourly rate</th>${pcDayHead('<th>Oras</th><th>Gastos</th><th></th>')}`;
  const act = (W.labor.rows || []).map((r, i) => rowHtml('rows', i, r, R.lab.per[i] || {}, 'PC.W.labor.rows')).join('');
  const tot = `<tr style="font-weight:700;background:#f8fafc;"><td colspan="2">HOURLY LABOR COST</td>${PC_DAYS.map((_, i) => `<td style="text-align:right;font-size:.75rem;" data-pc="labd:${i}">${pcM(R.lab.d[i])}</td>`).join('')}<td></td><td style="text-align:right;">${pcM(R.hourly)}</td><td></td></tr><tr><td colspan="2">Labor % ng sales</td>${PC_DAYS.map((_, i) => `<td style="text-align:right;font-size:.75rem;">${R.gross[i] ? pcP(R.lab.d[i] / R.gross[i]) : ''}</td>`).join('')}<td></td><td style="text-align:right;">${R.grossT ? pcP(R.hourly / R.grossT) : ''}</td><td></td></tr>`;
  const planRows = ((W.plan || {}).rows || []).map((r, i) => rowHtml('prow', i, r, R.planLab.per[i] || {}, 'PC.W.plan.rows')).join('');
  return `<datalist id="pc-emps">${names.map(n => `<option value="${pcEsc(n)}">`).join('')}</datalist><p style="font-size:.8rem;color:#64748b;margin:.2rem 0;">⏱️ Ilagay ang <b>oras na pinasok</b> bawat empleyado bawat araw. Ang gastos = oras × hourly rate (kasama ang 13th month, SSS/PhilHealth/HDMF/HMO share ayon sa rate na itinakda ni Admin). I-check ang Legal/Special Holiday para madagdagan ang holiday pay.</p>` +
    pcTbl(head, flags('legal', 'Legal Holiday') + flags('special', 'Special Holiday') + act, tot) + (dis ? '' : `<button class="btn btn-success btn-sm" style="margin-top:.4rem;" onclick="pcLabAdd('rows')">➕ Dagdag na Empleyado</button> <button class="btn btn-secondary btn-sm" style="margin-top:.4rem;" onclick="pcLabFromLst()" title="Kunin ang oras mula sa LST Weekly Plan">🗓️ Kunin sa LST</button> <button class="btn btn-secondary btn-sm" style="margin-top:.4rem;" onclick="pcLabCopyPlan()">📋 Kopyahin sa Planned</button>`) +
    `<h4 style="margin:1rem 0 .2rem;">🗒️ Planned (forecast) labor hours</h4>` + pcTbl(head, planRows || '<tr><td colspan="13" style="color:#94a3b8;">Wala pang planned hours.</td></tr>', `<tr style="font-weight:700;background:#f8fafc;"><td colspan="2">PLANNED LABOR COST</td>${PC_DAYS.map((_, i) => `<td style="text-align:right;font-size:.75rem;" data-pc="pld:${i}">${pcM(R.planLab.d[i])}</td>`).join('')}<td></td><td style="text-align:right;">${pcM(R.planLab.total)}</td><td></td></tr>`) + (dis ? '' : `<button class="btn btn-success btn-sm" style="margin-top:.4rem;" onclick="pcLabAdd('prow')">➕ Dagdag sa Planned</button>`);
}
function pcLabAdd(l) { if (l === 'rows') { PC.W.labor.rows.push({ name: '', hrs: Array(7).fill(0) }); } else { PC.W.plan = PC.W.plan || { rows: [] }; PC.W.plan.rows.push({ name: '', hrs: Array(7).fill(0) }); } PC.dirty = true; pcRender(); }
async function pcLabDel(l, i) { if (!await uiConfirm('Burahin ang empleyado sa listahan?')) return; (l === 'rows' ? PC.W.labor.rows : PC.W.plan.rows).splice(i, 1); PC.dirty = true; pcRender(); }
function pcLabCopyPlan() { PC.W.plan = { rows: (PC.W.labor.rows || []).map(r => ({ name: r.name, hrs: (r.hrs || []).slice() })) }; PC.dirty = true; pcRender(); }
async function pcLabFromLst() {
  try {
    const d = await db.collection('lst_weeks').doc(PC.site + '__' + PC.week).get(); if (!d.exists) { alert('Walang LST plan para sa linggong ito.'); return; }
    if (typeof lstSched !== 'function') { alert('Hindi naka-load ang LST sa pahinang ito. Buksan sa Admin › LST Management.'); return; }
    const sd = await db.collection('lst_setup').doc(PC.site).get(); const S = typeof lstSetupFill === 'function' ? lstSetupFill(sd.exists ? sd.data() : null) : (sd.data() || {}); const plan = d.data(); const rows = [];
    (typeof lstPlanEmps === 'function' ? lstPlanEmps(S, plan) : []).forEach(e => { const sc = lstSched(S, plan, e.key); const hrs = sc.map(s => lstSchedHours(s).hrs); if (hrs.some(h => h)) rows.push({ name: e.name, hrs }); });
    if (!rows.length) { alert('Walang oras na nakuha.'); return; } PC.W.plan = { rows }; PC.dirty = true; pcRender(); alert('✅ Nakuha ang planned hours sa LST (' + rows.length + ' empleyado). Ang pangalan ay dapat tumugma sa Labor Rates para magkaroon ng gastos.');
  } catch (e) { alert('Error: ' + e.message); }
}

/* ---------- TAB: Inventory ---------- */
function pcBegDate() { return pcAdd(PC.week, -1); } function pcEndDate() { return pcAdd(PC.week, 6); }
async function pcErpValue(date) {
  const s = pcSite(); const costs = {}; try { const c = await db.collection('inventory_costs').doc('company_' + pcSlug(s.company)).get(); Object.assign(costs, c.exists ? (c.data().costs || {}) : {}); } catch (e) {}
  const snap = await db.collection('inventory_counts').where('branchCode', '==', s.code || s.name).get(); const by = {}, sts = new Set(); let n = 0;
  snap.forEach(d => { const x = d.data(); if (x.countDate !== date) return; if (String(x.station || '').indexOf('🧪') === 0) return; sts.add(x.station); (x.lines || []).forEach(l => { by[l.itemCode] = (by[l.itemCode] || 0) + (+l.qty || 0); n++; }); });
  let val = 0, noCost = 0; Object.keys(by).forEach(c => { const uc = +costs[c]; if (uc > 0) val += by[c] * uc; else noCost++; });
  return { date, value: pcR2(val), items: Object.keys(by).length, noCost, stations: [...sts], found: sts.size > 0 };
}
async function pcErpPull(which) {
  const date = which === 'beg' ? pcBegDate() : pcEndDate(); try { const r = await pcErpValue(date); PC.erp[which] = r; if (!r.found) { alert(`Walang inventory count ng ${pcSite().name} sa petsang ${date} sa ERP.`); pcRender(); return; } const slot = PC.W.invc[which] = PC.W.invc[which] || {}; slot.value = r.value; slot.src = 'erp'; slot.date = date; PC.dirty = true; pcRender(); pcToast(`✅ Kinuha ang ${which === 'beg' ? 'Beginning' : 'Ending'} (${r.items} item, ${r.stations.length} station).`); } catch (e) { alert('Error: ' + e.message); }
}
async function pcErpCheck() { try { PC.erp.beg = await pcErpValue(pcBegDate()); PC.erp.end = await pcErpValue(pcEndDate()); const s = pcSite(), snap = await db.collection('orders').where('branchName', '==', s.name).get(); let tot = 0, n = 0; snap.forEach(d => { const o = d.data(); const dt = String(o.targetDeliveryDate || '').slice(0, 10); if (dt >= PC.week && dt <= pcAdd(PC.week, 6) && !/cancel/i.test(o.status || '')) { tot += +o.totalAmount || 0; n++; } }); PC.erp.orders = { total: pcR2(tot), n }; } catch (e) { alert('Error: ' + e.message); } pcRender(); }
function pcHtmlInv() {
  const dis = !pcCan(), W = PC.W, R = pcCalc(PC.setup, W, PC.rates), ic = W.invc, E = PC.erp || {};
  const prevEnd = PC.prev ? +((PC.prev.invc || {}).end || {}).value || 0 : null;
  const kw = String(PC.setup.commKw || '').toLowerCase(); const comm = kw ? pcR2(pcSum((W.inv || []).filter(x => String(x.sup || '').toLowerCase().includes(kw)).map(x => +x.gross || 0))) : 0;
  const slot = (k, lab, date) => { const s = ic[k] || {}; return `<div style="flex:1;min-width:250px;border:1px solid #e2e8f0;border-radius:.5rem;padding:.6rem;"><b>${lab}</b> <small style="color:#64748b;">(count noong ${date})</small><div style="margin:.4rem 0;">Halaga ng inventory: ₱ ${pcInp(s.value, `PC.W.invc.${k}={...PC.W.invc.${k},value:pcN(this.value),src:'manual'};pcDirty();pcRender();`, dis, 120)}</div><small style="color:#64748b;">Pinagmulan: ${s.src === 'erp' ? '📦 ERP count' : s.src === 'prev-week' ? '↩ Ending ng nakaraang linggo' : s.src === 'excel' ? '📥 Excel' : s.src === 'manual' ? '✍️ manual' : '—'}</small>${dis ? '' : `<div style="margin-top:.4rem;"><button class="btn btn-secondary btn-sm" onclick="pcErpPull('${k}')">📦 Kunin sa ERP Inventory Count</button></div>`}</div>`; };
  const cmp = (lab, a, b, note) => { const d = a - b; return `<tr><td>${lab}</td><td style="text-align:right;">${pcM(a)}</td><td style="text-align:right;">${pcM(b)}</td><td style="text-align:right;color:${Math.abs(d) < 1 ? '#166534' : '#b91c1c'};"><b>${pcM(d)}</b></td><td style="font-size:.75rem;color:#64748b;">${note}</td></tr>`; };
  let c = ''; if (E.beg) c += cmp('Beginning — Prime Cost vs ERP count', R.beg, E.beg.value, E.beg.found ? `${E.beg.items} item${E.beg.noCost ? ', ' + E.beg.noCost + ' walang unit cost' : ''}` : 'walang count sa ERP'); if (E.end) c += cmp('Ending — Prime Cost vs ERP count', R.end, E.end.value, E.end.found ? `${E.end.items} item${E.end.noCost ? ', ' + E.end.noCost + ' walang unit cost' : ''}` : 'walang count sa ERP');
  if (prevEnd != null) c += cmp('Beginning vs Ending ng nakaraang linggo', R.beg, prevEnd, 'dapat magkapareho'); if (E.orders) c += cmp(`Invoice ng "${pcEsc(PC.setup.commKw)}" vs Commissary orders sa system (${E.orders.n} order)`, comm, E.orders.total, 'Gross invoice vs total ng orders na naka-deliver sa linggong ito');
  return `<p style="font-size:.8rem;color:#64748b;margin:.2rem 0;">Food cost = Purchases + Beginning − Ending. Ang inventory ay binibilang tuwing <b>Linggo</b>: Beginning = Linggo bago ang linggong ito (${pcBegDate()}), Ending = Linggo ng linggong ito (${pcEndDate()}).</p><div style="display:flex;gap:.6rem;flex-wrap:wrap;">${slot('beg', 'Beginning Inventory', pcBegDate())}${slot('end', 'Ending Inventory', pcEndDate())}</div>
    <div style="margin-top:.6rem;"><b>Paper & Packaging (hiwalay na inventory)</b> — Beg ₱ ${pcInp(ic.ppBeg, `PC.W.invc.ppBeg=pcN(this.value);pcDirty();pcRender();`, dis, 100)} End ₱ ${pcInp(ic.ppEnd, `PC.W.invc.ppEnd=pcN(this.value);pcDirty();pcRender();`, dis, 100)} <small style="color:#64748b;">(opsyonal; kasama sa Paper & Packaging line ng P&L)</small></div>
    <div style="margin-top:.8rem;"><b>Food cost:</b> ${pcM(R.purchases)} + ${pcM(R.beg)} − ${pcM(R.end)} = <b>₱${pcM(R.foodCost)}</b> (${pcP(R.foodPct)} ng sales)</div>
    <h4 style="margin:1rem 0 .3rem;">🔎 Tugma ba sa ERP?</h4><button class="btn btn-primary btn-sm" onclick="pcErpCheck()">🔄 I-check sa ERP (inventory count at commissary orders)</button>
    ${c ? pcTbl('<th>Paghahambing</th><th>Prime Cost</th><th>ERP</th><th>Pagkakaiba</th><th></th>', c) : '<p style="font-size:.8rem;color:#94a3b8;">Pindutin ang button para ihambing sa actual inventory count at sa orders sa commissary.</p>'}`;
}

/* ---------- TAB: Forecast ---------- */
function pcHtmlFc() {
  const dis = !pcCan(), W = PC.W, S = PC.setup, R = pcCalc(S, W, PC.rates); const fs = W.fc.sales; const fT = pcSum(fs); const lab = R.planLab.total, mg = fT * (S.mgmtPct || 0) / 100;
  const fFood = fT * ((S.foodTarget || 0) / 100), fPrime = fFood + lab + mg;
  const cmp = (l, f, a) => `<tr><td>${l}</td><td style="text-align:right;">${pcM(f)}</td><td style="text-align:right;">${pcM(a)}</td><td style="text-align:right;color:${a - f >= 0 ? '#166534' : '#b91c1c'};">${pcM(a - f)}</td></tr>`;
  return `<p style="font-size:.8rem;color:#64748b;margin:.2rem 0;">📈 Ilagay ang <b>forecast sales</b> bawat araw. Ang forecast ng labor ay galing sa <b>Planned hours</b> (tab na Labor); ang food cost ay target % ni Admin (${S.foodTarget}%).</p>` +
    pcTbl(`<th></th>${pcDayHead('<th>TOTAL</th>')}`, `<tr><td>Forecast Sales</td>${PC_DAYS.map((_, i) => `<td>${pcInp(fs[i], `pcSetArr('fc.sales',${i},this)`, dis)}</td>`).join('')}<td style="text-align:right;"><b>${pcM(fT)}</b></td></tr><tr><td>Actual Sales</td>${R.gross.map(v => `<td style="text-align:right;">${pcM(v)}</td>`).join('')}<td style="text-align:right;"><b>${pcM(R.grossT)}</b></td></tr><tr><td>Variance (Actual − Forecast)</td>${R.gross.map((v, i) => `<td style="text-align:right;color:${v - (+fs[i] || 0) >= 0 ? '#166534' : '#b91c1c'};">${pcM(v - (+fs[i] || 0))}</td>`).join('')}<td style="text-align:right;"><b>${pcM(R.grossT - fT)}</b></td></tr><tr><td>Planned labor cost</td>${R.planLab.d.map(v => `<td style="text-align:right;">${pcM(v)}</td>`).join('')}<td style="text-align:right;">${pcM(lab)}</td></tr><tr><td>Planned labor %</td>${R.planLab.d.map((v, i) => `<td style="text-align:right;">${+fs[i] ? pcP(v / fs[i]) : ''}</td>`).join('')}<td style="text-align:right;">${fT ? pcP(lab / fT) : ''}</td></tr><tr><td>Actual labor %</td>${R.lab.d.map((v, i) => `<td style="text-align:right;">${R.gross[i] ? pcP(v / R.gross[i]) : ''}</td>`).join('')}<td style="text-align:right;">${R.grossT ? pcP(R.hourly / R.grossT) : ''}</td></tr>`) +
    (dis ? '' : `<div style="margin:.4rem 0;"><button class="btn btn-secondary btn-sm" onclick="pcFcFromLst()">🗓️ Kunin ang Forecast Sales sa LST</button> <button class="btn btn-secondary btn-sm" onclick="pcFcFromPrev()">↩ Kopyahin ang actual sales ng nakaraang linggo</button></div>`) +
    `<h4 style="margin:.8rem 0 .2rem;">Forecast vs Actual (buong linggo)</h4>` + pcTbl('<th></th><th>Forecast</th><th>Actual</th><th>Variance</th>', cmp('Sales', fT, R.grossT) + cmp('Food cost (target %)', fFood, R.foodCost) + cmp('Labor (hourly + mgmt)', lab + mg, R.laborT) + cmp('Prime cost', fPrime, R.prime));
}
async function pcFcFromLst() { try { const d = await db.collection('lst_weeks').doc(PC.site + '__' + PC.week).get(); if (!d.exists) { alert('Walang LST forecast para sa linggong ito.'); return; } const fc = ((d.data().fc || {}).sales) || {}; const LD = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN']; PC.W.fc.sales = LD.map(k => pcR2(pcSum(fc[k]))); PC.dirty = true; pcRender(); } catch (e) { alert('Error: ' + e.message); } }
function pcFcFromPrev() { if (!PC.prev) { alert('Walang naka-save na nakaraang linggo.'); return; } const ps = PC.prev.sales || {}; PC.W.fc.sales = PC_DAYS.map((_, i) => pcR2(PC_SALES.reduce((t, [k]) => t + (+((ps[k] || [])[i]) || 0), 0))); PC.dirty = true; pcRender(); }

/* ---------- TAB: P&L ---------- */
function pcHtmlPnl() {
  const R = pcCalc(PC.setup, PC.W, PC.rates), P = R.pnl, A = (PC.actual || {}).lines || {}, G = R.grossT; const pp = v => G > 0 ? pcP(v / G) : '';
  const act = pcIsAdmin();
  const aIn = k => act ? `<input type="text" inputmode="decimal" value="${A[k] != null && A[k] !== '' ? A[k] : ''}" onchange="pcSetAct('${k}',this)" style="width:100px;text-align:right;padding:.2rem;">` : (A[k] != null && A[k] !== '' ? pcM(A[k]) : '—');
  const vr = (k, v) => A[k] != null && A[k] !== '' ? `<span style="color:${v - A[k] >= 0 ? '#166534' : '#b91c1c'};">${pcM(v - A[k])}</span>` : '';
  const line = (l, v, k, bold) => `<tr style="${bold ? 'font-weight:700;background:#f8fafc;' : ''}"><td>${l}</td><td style="text-align:right;">${pcM(v)}</td><td style="text-align:right;">${pp(v)}</td><td style="text-align:right;">${k ? aIn(k) : ''}</td><td style="text-align:right;">${k ? vr(k, v) : ''}</td></tr>`;
  const sub = (l, arr) => arr.filter(x => x.amt).map(x => `<tr style="color:#475569;"><td style="padding-left:1.2rem;">${pcEsc(x.label)}</td><td style="text-align:right;">${pcM(x.amt)}</td><td></td><td></td><td></td></tr>`).join('');
  const grp = (k, key) => line(PC_GROUPS[k], P.tot[k], key, 1) + sub(k, P.g[k]);
  let b = line('Total Sales (gross)', P.sales, 'sales', 1) + sub('', P.discounts) + line('Sales after Discounts', P.net, 'net', 1) + line('Cost of Sales (food cost)', P.cogs, 'cogs') + line('GROSS PROFIT', P.gp, null, 1) + line('Labor & Employee Benefits', P.labor, 'labor') + sub('', P.labLines) + line('CONTRIBUTION MARGIN', P.cm, null, 1) + grp('dop', 'dop') + grp('ga', 'ga') + grp('mkt', 'mkt') + grp('util', 'util') + grp('rm', 'rm') + line('TOTAL CONTROLLABLE OPEX (incl. labor)', P.controllable, null, 1) + grp('occ', 'occ') + `<tr style="color:#475569;"><td style="padding-left:1.2rem;font-size:.75rem;">Rent: basic ${pcM(P.rent.basic)} + % ng sales ${pcM(P.rent.pctAmt)} = ${pcM(P.rent.tot)}; minimum ${pcM(P.rent.min)}</td><td colspan="4"></td></tr>` + grp('dep', 'dep') + grp('oh', 'oh') + line('TOTAL OPERATING COSTS', P.opCosts, null, 1) + line('STORE OPERATING MARGIN', P.som, 'som', 1);
  return `<p style="font-size:.8rem;color:#64748b;margin:.2rem 0;">🧮 <b>Weekly P&L (estimated)</b> ayon sa mga naka-input sa linggong ito + fixed costs na itinakda ni Admin. Ang <b>Actual</b> ay inilalagay ng Accounting galing sa posted P&L ng SAP (Variance = Estimated − Actual).</p>` + pcTbl('<th>Linya</th><th>Estimated</th><th>% Sales</th><th>Actual (Accounting)</th><th>Var</th>', b) + (act ? '<button class="btn btn-success btn-sm" style="margin-top:.4rem;" onclick="pcSaveActual()">💾 I-save ang Actual</button>' : '');
}
function pcSetAct(k, el) { PC.actual.lines = PC.actual.lines || {}; PC.actual.lines[k] = el.value === '' ? '' : pcN(el.value); PC.actDirty = true; }
async function pcSaveActual() { const s = pcSite(); try { await db.collection('pc_actual').doc(pcWeekKey()).set({ lines: PC.actual.lines || {}, site: PC.site, branch: s.name, branchCode: s.code || '', company: s.company || '', week: PC.week, updatedBy: (PC.me || {}).email || '', updatedAt: new Date().toISOString() }); pcToast('✅ Na-save ang Actual.'); pcRender(); } catch (e) { alert('Error: ' + e.message); } }

/* ---------- TAB: Mga Linggo (trend) ---------- */
async function pcLoadWeeks() {
  PC.weeks = []; try { const ids = Array.from({ length: 12 }, (_, i) => pcAdd(PC.week, -7 * i)); const ds = await Promise.all(ids.map(w => db.collection('pc_weeks').doc(PC.site + '__' + w).get().catch(() => null))); ds.forEach(d => { if (d && d.exists) PC.weeks.push(d.data()); }); PC.weeks.sort((a, b) => String(b.week).localeCompare(a.week)); } catch (e) { PC.weeks = []; }
  const el = document.getElementById('pc-body'); if (el && PC.tab === 'weeks') el.innerHTML = pcHtmlWeeks(1);
}
function pcHtmlWeeks(loaded) {
  if (!loaded) return '<div class="card">Kinukuha ang mga linggo...</div>'; const S = PC.setup;
  const rows = PC.weeks.map(w => { const R = pcCalc(S, w, PC.rates), G = R.grossT; return `<tr><td><a href="javascript:void(0)" onclick="pcWeekChange('${w.week}');PC.tab='prime'">${w.week}</a>${w.locked ? ' 🔒' : ''}</td><td style="text-align:right;">${pcM(G)}</td><td style="text-align:right;">${pcM(R.foodCost)}<br><small>${pcP(R.foodPct)}</small></td><td style="text-align:right;">${pcM(R.laborT)}<br><small>${G ? pcP(R.laborT / G) : ''}</small></td><td style="text-align:right;"><b>${pcM(R.prime)}</b><br><small>${G ? pcP(R.prime / G) : ''}</small></td><td style="text-align:right;">${pcM(R.pnl.som)}<br><small>${G ? pcP(R.pnl.som / G) : ''}</small></td><td>${pcEsc(w.updatedBy || '')}</td></tr>`; }).join('');
  return pcTbl('<th>Linggo</th><th>Sales</th><th>Food cost</th><th>Labor</th><th>Prime cost</th><th>Store Op. Margin</th><th>Huling nag-edit</th>', rows || '<tr><td colspan="7" style="color:#94a3b8;">Wala pang naka-save na linggo.</td></tr>');
}

/* ---------- TAB: Lahat ng Branch ---------- */
async function pcLoadAll() {
  try { const [w, st, rt] = await Promise.all([db.collection('pc_weeks').where('week', '==', PC.week).get(), db.collection('pc_setup').get(), db.collection('pc_rates').get()]); const sm = {}, rm = {}; st.forEach(d => sm[d.id] = d.data()); rt.forEach(d => rm[d.id] = d.data()); PC.allBr = []; w.forEach(d => PC.allBr.push({ doc: d.data(), setup: pcSetupFill(sm[d.data().site]), rates: rm[d.data().site] || { emps: [] } })); } catch (e) { PC.allBr = []; }
  const el = document.getElementById('pc-body'); if (el && PC.tab === 'all') el.innerHTML = pcHtmlAll(1);
}
function pcHtmlAll(loaded) {
  if (!loaded) return '<div class="card">Kinukuha...</div>'; const have = {}; PC.allBr.forEach(x => have[x.doc.site] = x); let tS = 0, tF = 0, tL = 0, tP = 0;
  const rows = PC.sites.map(s => { const x = have[s.key]; if (!x) return `<tr><td>${pcEsc(s.company)}<br><b>${pcEsc(s.name)}</b></td><td colspan="5" style="color:#b91c1c;">Wala pang input ngayong linggo</td></tr>`; const R = pcCalc(x.setup, x.doc, x.rates), G = R.grossT; tS += G; tF += R.foodCost; tL += R.laborT; tP += R.prime; const over = G && (R.prime / G) > ((x.setup.foodTarget || 0) + (x.setup.laborTarget || 0)) / 100; return `<tr><td>${pcEsc(s.company)}<br><b>${pcEsc(s.name)}</b></td><td style="text-align:right;">${pcM(G)}</td><td style="text-align:right;">${pcM(R.foodCost)}<br><small>${pcP(R.foodPct)}</small></td><td style="text-align:right;">${pcM(R.laborT)}<br><small>${G ? pcP(R.laborT / G) : ''}</small></td><td style="text-align:right;${over ? 'color:#b91c1c;' : ''}"><b>${pcM(R.prime)}</b><br><small>${G ? pcP(R.prime / G) : ''}${over ? ' ⚠️' : ''}</small></td><td>${x.doc.locked ? '🔒 Approved' : 'Naka-save'}</td></tr>`; }).join('');
  return `<p style="font-size:.8rem;color:#64748b;margin:.2rem 0;">Buod ng lahat ng branch para sa linggong ${PC.week}.</p>` + pcTbl('<th>Branch</th><th>Sales</th><th>Food cost</th><th>Labor</th><th>Prime cost</th><th>Status</th>', rows, `<tr style="font-weight:700;background:#f8fafc;"><td>KABUUAN</td><td style="text-align:right;">${pcM(tS)}</td><td style="text-align:right;">${pcM(tF)}<br><small>${tS ? pcP(tF / tS) : ''}</small></td><td style="text-align:right;">${pcM(tL)}<br><small>${tS ? pcP(tL / tS) : ''}</small></td><td style="text-align:right;">${pcM(tP)}<br><small>${tS ? pcP(tP / tS) : ''}</small></td><td></td></tr>`);
}

/* ---------- TAB: Setup (Admin) ---------- */
function pcHtmlSetup() {
  const S = PC.setup, r = S.rent, inp = (lab, val, cb, w) => `<div><label style="font-size:.75rem;">${lab}</label><br><input type="text" inputmode="decimal" value="${val}" onchange="${cb}" style="width:${w || 110}px;"></div>`;
  const ch = S.channels.map((c, i) => `<tr><td><input value="${pcEsc(c.name)}" onchange="pcCh(${i},'name',this.value)" style="width:140px;"></td><td><input value="${c.pct}" onchange="pcCh(${i},'pct',pcN(this.value))" style="width:60px;">%</td><td><select onchange="pcCh(${i},'kind',this.value)"><option value="delivery" ${c.kind !== 'bank' ? 'selected' : ''}>Delivery / Service fee</option><option value="bank" ${c.kind === 'bank' ? 'selected' : ''}>Bank charge</option></select></td><td><button class="btn btn-sm btn-danger" onclick="pcChDel(${i})">🗑️</button></td></tr>`).join('');
  const fx = S.fixed.map((f, i) => `<tr><td><input value="${pcEsc(f.label)}" onchange="pcFx(${i},'label',this.value)" style="width:190px;"></td><td><select onchange="pcFx(${i},'grp',this.value)">${Object.keys(PC_GROUPS).map(g => `<option value="${g}" ${f.grp === g ? 'selected' : ''}>${PC_GROUPS[g]}</option>`).join('')}</select></td><td><input value="${f.amt}" onchange="pcFx(${i},'amt',pcN(this.value))" style="width:100px;text-align:right;"></td><td><select onchange="pcFx(${i},'per',this.value)"><option value="month" ${f.per === 'month' ? 'selected' : ''}>bawat buwan (×12/52)</option><option value="year" ${f.per === 'year' ? 'selected' : ''}>bawat taon (÷365×7)</option><option value="week" ${f.per === 'week' ? 'selected' : ''}>bawat linggo</option></select></td><td style="text-align:right;">${pcM(pcFixedWeekly(f))}</td><td><button class="btn btn-sm btn-danger" onclick="pcFxDel(${i})">🗑️</button></td></tr>`).join('');
  return `<p style="font-size:.8rem;color:#64748b;margin:.2rem 0;">⚙️ Para sa branch na ito (<b>${pcEsc(pcSite().name)}</b>) — Admin lang ang makakapag-edit. Hindi ito mababago ng manager.</p>
  <div style="display:flex;gap:.6rem;flex-wrap:wrap;margin-bottom:.6rem;">${inp('Management labor % ng sales', S.mgmtPct, 'pcSu("mgmtPct",pcN(this.value))')}${inp('Payroll taxes & benefits %', S.taxPct, 'pcSu("taxPct",pcN(this.value))')}${inp('Target Food Cost %', S.foodTarget, 'pcSu("foodTarget",pcN(this.value))')}${inp('Target Labor %', S.laborTarget, 'pcSu("laborTarget",pcN(this.value))')}${inp('Supplier keyword ng Commissary', pcEsc(S.commKw), 'pcSu("commKw",this.value)')}</div>
  <h4 style="margin:.6rem 0 .2rem;">🏬 Occupancy / Rent</h4><div style="display:flex;gap:.6rem;flex-wrap:wrap;">${inp('sqm', r.sqm, 'pcRentSet("sqm",pcN(this.value))', 80)}${inp('Basic rent ₱/sqm (buwan)', r.basic, 'pcRentSet("basic",pcN(this.value))')}${inp('Minimum ₱/sqm (buwan)', r.min, 'pcRentSet("min",pcN(this.value))')}${inp('% ng net sales', r.pct, 'pcRentSet("pct",pcN(this.value))', 80)}</div><p style="font-size:.75rem;color:#64748b;">Weekly rent = basic (sqm × basic ÷ 4) + % ng net sales; kung mas mababa sa minimum (sqm × min × 12 ÷ 52), minimum ang singil. (Gaya ng Excel.)</p>
  <h4 style="margin:.6rem 0 .2rem;">🛵 Delivery / Payment channels</h4>${pcTbl('<th>Pangalan</th><th>Fee %</th><th>Uri</th><th></th>', ch)}<button class="btn btn-secondary btn-sm" onclick="PC.setup.channels.push({name:'',pct:0,kind:'delivery'});pcRender()">➕ Dagdag na channel</button>
  <h4 style="margin:.8rem 0 .2rem;">📅 Fixed / Estimated na gastos (utilities, CAM, depreciation, insurance, permits...)</h4>${pcTbl('<th>Gastos</th><th>Grupo sa P&L</th><th>Halaga</th><th>Per</th><th>Weekly</th><th></th>', fx)}<button class="btn btn-secondary btn-sm" onclick="PC.setup.fixed.push({id:'c'+Date.now(),label:'',grp:'ga',amt:0,per:'month'});pcRender()">➕ Dagdag na gastos</button>
  <div style="margin-top:.6rem;"><button class="btn btn-success" onclick="pcSaveSetup()">💾 I-save ang Setup</button></div>
  <h4 style="margin:1.2rem 0 .2rem;">👤 Labor Rates (hourly cost ng empleyado) 🔒</h4>${pcHtmlRates()}`;
}
function pcSu(k, v) { PC.setup[k] = v; } function pcRentSet(k, v) { PC.setup.rent[k] = v; } function pcCh(i, k, v) { PC.setup.channels[i][k] = v; } function pcFx(i, k, v) { PC.setup.fixed[i][k] = v; if (k === 'amt' || k === 'per') pcRender(); }
async function pcChDel(i) { if (!await uiConfirm('Burahin ang channel?')) return; PC.setup.channels.splice(i, 1); pcRender(); } async function pcFxDel(i) { if (!await uiConfirm('Burahin ang gastos?')) return; PC.setup.fixed.splice(i, 1); pcRender(); }
async function pcSaveSetup() { const s = pcSite(); try { await db.collection('pc_setup').doc(PC.site).set(Object.assign({}, PC.setup, { site: PC.site, branch: s.name, branchCode: s.code || '', company: s.company || '', updatedBy: (PC.me || {}).email || '', updatedAt: new Date().toISOString() })); alert('✅ Na-save ang Setup.'); pcRender(); } catch (e) { alert('Error: ' + e.message); } }

/* ---------- Labor rates (sahod → hourly) ---------- */
const PC_RATE_F = [['basic', 'Basic'], ['allow', 'Allowance'], ['demin', 'De minimis'], ['sss', 'SSS (employer)'], ['phil', 'PhilHealth'], ['hdmf', 'HDMF'], ['hmo', 'HMO'], ['m13', '13th month']];
function pcRateCalc(e, days, hrs) { days = +days || 313; hrs = +hrs || 8; const f = k => (+e[k] || 0) * 24 / days / hrs; const t = PC_RATE_F.reduce((s, [k]) => s + f(k), 0); const lg = f('basic') + f('allow') + f('demin') + f('m13'); return { hourly: t, legal: lg, special: lg * 0.3 }; }
function pcHtmlRates() {
  const sec = PC.secure || { emps: [] }; PC.secure = sec; sec.days = sec.days || 313; sec.hrs = sec.hrs || 8;
  const rows = sec.emps.map((e, i) => { const c = pcRateCalc(e, sec.days, sec.hrs); return `<tr><td><input list="pc-hr" value="${pcEsc(e.name || '')}" onchange="PC.secure.emps[${i}].name=this.value" style="width:170px;"></td>${PC_RATE_F.map(([k]) => `<td><input value="${e[k] || ''}" onchange="pcRateIn(${i},'${k}',this.value)" style="width:70px;text-align:right;"></td>`).join('')}<td style="text-align:right;"><b>${pcM(c.hourly)}</b><br><small>L ${pcM(c.legal)} · S ${pcM(c.special)}</small></td><td><button class="btn btn-sm btn-danger" onclick="PC.secure.emps.splice(${i},1);pcRender()">🗑️</button></td></tr>`; }).join('');
  return `<p style="font-size:.78rem;color:#64748b;">Ilagay ang halaga <b>kada kalahating buwan</b> (half-month), gaya ng "Labor Rate" sheet. Hourly = halaga × 24 ÷ ${sec.days} araw ÷ ${sec.hrs} oras. Ang makikita lang ng manager ay ang <b>kabuuang hourly rate</b>, hindi ang breakdown ng sahod.</p>
  <datalist id="pc-hr">${(PC.hr || []).map(n => `<option value="${pcEsc(n)}">`).join('')}</datalist><div style="display:flex;gap:.6rem;margin-bottom:.4rem;"><div><label style="font-size:.75rem;">Araw / taon</label><br><input value="${sec.days}" onchange="PC.secure.days=pcN(this.value);pcRender()" style="width:70px;"></div><div><label style="font-size:.75rem;">Oras / araw</label><br><input value="${sec.hrs}" onchange="PC.secure.hrs=pcN(this.value);pcRender()" style="width:70px;"></div></div>
  ${pcTbl('<th>Pangalan</th>' + PC_RATE_F.map(x => `<th>${x[1]}</th>`).join('') + '<th>Hourly</th><th></th>', rows || '<tr><td colspan="11" style="color:#94a3b8;">Wala pang rate.</td></tr>')}
  <button class="btn btn-secondary btn-sm" style="margin-top:.4rem;" onclick="pcRateAdd()">➕ Dagdag</button> <button class="btn btn-secondary btn-sm" style="margin-top:.4rem;" onclick="pcRateFromHR()">👥 Kunin ang mga empleyado ng branch sa HR</button> <button class="btn btn-success btn-sm" style="margin-top:.4rem;" onclick="pcSaveRates()">💾 I-save ang Labor Rates</button>`;
}
function pcRateIn(i, k, v) { const e = PC.secure.emps[i]; e[k] = pcN(v); if (k === 'basic') { if (!e.phil_set) e.phil = pcR2(e.basic * 0.025); if (!e.m13_set) e.m13 = pcR2(e.basic / 12); } if (k === 'phil') e.phil_set = 1; if (k === 'm13') e.m13_set = 1; pcRender(); }
function pcRateAdd() { PC.secure.emps.push({ name: '', basic: 0, allow: 0, demin: 0, sss: 0, phil: 0, hdmf: 100, hmo: 0, m13: 0 }); pcRender(); }
async function pcRateFromHR() { try { const sn = await db.collection('employees').get(); const s = pcSite(), nm = String(s.name || '').toLowerCase(), cd = String(s.code || '').toLowerCase(); let n = 0; const have = new Set(PC.secure.emps.map(e => e.name)); PC.hr = []; sn.forEach(d => { const e = d.data(); if (/resign|terminat/i.test(e.status || '')) return; const full = e.lname ? `${e.lname}, ${e.fname || ''} ${e.mname || ''}`.trim() : (e.name || e.fname || d.id); PC.hr.push(full); if (![e.dept, e.branch, e.location].some(v => v && [nm, cd].includes(String(v).toLowerCase()))) return; if (have.has(full)) return; PC.secure.emps.push({ name: full, basic: 0, allow: 0, demin: 0, sss: 0, phil: 0, hdmf: 100, hmo: 0, m13: 0 }); n++; }); alert(`✅ ${n} empleyado ang naidagdag. Ilagay ang sahod nila (kalahating buwan).`); pcRender(); } catch (e) { alert('Error: ' + e.message); } }
function pcPubFromSecure(sec) { return { emps: sec.emps.filter(e => e.name).map(e => { const c = pcRateCalc(e, sec.days, sec.hrs); return { name: e.name, hourly: c.hourly, legal: c.legal, special: c.special }; }) }; }
async function pcSaveRates() {
  const sec = PC.secure, s = pcSite(); const names = sec.emps.map(e => e.name).filter(Boolean); if (new Set(names).size !== names.length && !await uiConfirm('May magkakaparehong pangalan (hal. "Staff - FOH"). Ang una lang ang gagamitin sa Labor tab. Ituloy?')) return;
  const pub = { emps: sec.emps.filter(e => e.name).map(e => { const c = pcRateCalc(e, sec.days, sec.hrs); return { name: e.name, hourly: pcR2(c.hourly * 1e4) / 1e4, legal: pcR2(c.legal * 1e4) / 1e4, special: pcR2(c.special * 1e4) / 1e4 }; }), site: PC.site, branch: s.name, branchCode: s.code || '', company: s.company || '', updatedAt: new Date().toISOString() };
  try { await db.collection('pc_ratesecure').doc(PC.site).set(Object.assign({}, sec, { site: PC.site, branch: s.name, branchCode: s.code || '', updatedBy: (PC.me || {}).email || '', updatedAt: new Date().toISOString() })); await db.collection('pc_rates').doc(PC.site).set(pub); PC.rates = pub; alert('✅ Na-save ang Labor Rates (' + pub.emps.length + ').'); pcRender(); } catch (e) { alert('Error: ' + e.message); }
}

/* ---------- PRINT / EXPORT ---------- */
function pcPrint() {
  const R = pcCalc(PC.setup, PC.W, PC.rates), s = pcSite(); const w = window.open('', '_blank'); if (!w) { alert('Payagan ang pop-up para makapag-print.'); return; }
  const body = PC.tab === 'pnl' ? pcHtmlPnl().replace(/<input[^>]*value="([^"]*)"[^>]*>/g, '$1') : pcHtmlPrime().replace(/<input[^>]*value="([^"]*)"[^>]*>/g, '$1');
  w.document.write(`<html><head><title>Prime Cost ${pcEsc(s.name)} ${PC.week}</title><style>body{font-family:Arial,sans-serif;font-size:12px;padding:12px}table{border-collapse:collapse;width:100%}th,td{border:1px solid #cbd5e1;padding:3px 5px}th{background:#f1f5f9}</style></head><body><h2>${pcEsc(s.company)} — ${pcEsc(s.name)}</h2><h3>${PC.tab === 'pnl' ? 'Weekly P&L' : 'Prime Cost Worksheet'} · ${PC.week} – ${pcAdd(PC.week, 6)}</h3>${body}<p style="margin-top:20px;">Prepared by: ______________ &nbsp; Approved by: ______________</p></body></html>`); w.document.close(); setTimeout(() => w.print(), 400);
}
async function pcExport() {
  try { if (typeof sapXlsxLib === 'function') await sapXlsxLib(); } catch (e) { alert(e.message); return; }
  const R = pcCalc(PC.setup, PC.W, PC.rates), W = PC.W, s = pcSite(), P = R.pnl; const wb = XLSX.utils.book_new();
  const A = [[`${s.company} — ${s.name}`, '', 'Week', PC.week], [], ['PRIME COST WORKSHEET', ...PC_DAYS, 'TOTAL', '%']];
  const pcn = v => R.grossT > 0 ? v / R.grossT : 0; PC_SALES.forEach(([k, l]) => A.push([l, ...W.sales[k], pcSum(W.sales[k]), pcn(pcSum(W.sales[k]))])); A.push(['TOTAL SALES', ...R.gross, R.grossT, 1], ['Purchases', '', '', '', '', '', '', '', R.purchases, pcn(R.purchases)], ['Beginning Inventory', '', '', '', '', '', '', '', R.beg], ['Ending Inventory', '', '', '', '', '', '', '', R.end], ['FOOD COST', '', '', '', '', '', '', '', R.foodCost, R.foodPct], ['Management', '', '', '', '', '', '', '', R.mgmt, pcn(R.mgmt)], ['Hourly Personnel', ...R.lab.d, R.hourly, pcn(R.hourly)], ['Payroll Taxes & Benefits', '', '', '', '', '', '', '', R.tax], ['TOTAL LABOR', '', '', '', '', '', '', '', R.laborT, pcn(R.laborT)], ['PRIME COST', '', '', '', '', '', '', '', R.prime, pcn(R.prime)], ['GROSS MARGIN', '', '', '', '', '', '', '', R.gm, pcn(R.gm)]);
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(A), 'Prime Cost');
  const B = [['P&L', 'Estimated', '% Sales', 'Actual']]; const act = (PC.actual || {}).lines || {}; const ad = (l, v, k) => B.push([l, v, pcn(v), k && act[k] != null ? act[k] : '']); ad('Total Sales', P.sales, 'sales'); P.discounts.forEach(x => ad(x.label, x.amt)); ad('Sales after Discounts', P.net, 'net'); ad('Cost of Sales', P.cogs, 'cogs'); ad('GROSS PROFIT', P.gp); ad('Labor', P.labor, 'labor'); ad('CONTRIBUTION MARGIN', P.cm); Object.keys(PC_GROUPS).forEach(g => { ad(PC_GROUPS[g], P.tot[g], g); P.g[g].forEach(x => ad('   ' + x.label, x.amt)); }); ad('TOTAL OPERATING COSTS', P.opCosts); ad('STORE OPERATING MARGIN', P.som, 'som');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(B), 'P&L');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['Supplier', 'Date', 'Gross', 'VAT', 'Supplies', 'Cleaning', 'Meals', 'Food net']].concat((W.inv || []).map((r, i) => [r.sup, r.date, r.gross, r.vat, r.sp, r.cl, r.ml, R.inv[i].net]))), 'Purchases');
  const pt = (list, cats) => [['Date', 'Particulars', 'Supplier', 'Ref', 'Gross', 'VAT', 'Category', 'Net']].concat((W[list] || []).map(r => [r.date, r.part, r.sup, r.ref, r.gross, r.vat, (cats.find(c => c[0] === r.cat) || [])[1] || r.cat, (+r.gross || 0) - (+r.vat || 0)])); XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(pt('food', PC_FOOD)), 'PCF Food'); XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(pt('petty', PC_PETTY)), 'Petty Cash'); XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(pt('other', PC_OTHER)), 'Other');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['Employee', 'Rate', ...PC_DAYS, 'Hours', 'Cost']].concat((W.labor.rows || []).map((r, i) => [r.name, R.lab.per[i].rate, ...PC_DAYS.map((_, d) => (r.hrs || [])[d] || 0), R.lab.per[i].hours, R.lab.per[i].cost]))), 'Labor');
  XLSX.writeFile(wb, `PrimeCost_${pcSlug(s.name)}_${PC.week}.xlsx`);
}

/* ---------- IMPORT mula sa lumang Prime Cost Excel ---------- */
function pcImportOpen() { arModal(`<h3>📥 I-import ang Prime Cost Excel</h3><p style="font-size:.85rem;">Piliin ang weekly Prime Cost workbook (hal. <i>KT_SO3_PrimeCost_...xlsx</i>). Kukunin ang: sales, channels, purchases, petty cash, PCF Food, other expenses, labor hours (at planned), inventory beg/end at ang petsa ng linggo.${pcIsAdmin() ? ' Bilang Admin, kukunin din ang <b>Setup</b> (rent, fixed na gastos, fee %) at <b>Labor Rates</b>.' : ''}<br><b>Papalitan</b> nito ang laman ng linggong ito.</p><input type="file" id="pc-file" accept=".xlsx,.xls"><br><label style="display:block;margin:.4rem 0;"><input type="checkbox" id="pc-imp-setup" ${pcIsAdmin() ? 'checked' : 'disabled'}> Isama ang Setup at Labor Rates (Admin lang)</label><button class="btn btn-success" onclick="pcImportGo()">📥 I-import</button> <button class="btn btn-secondary" onclick="arCloseModal()">Kanselahin</button>`); }
async function pcImportGo() {
  const f = document.getElementById('pc-file').files; if (!f[0]) { alert('Pumili ng file.'); return; }
  try { if (typeof sapXlsxLib === 'function') await sapXlsxLib(); const wb = XLSX.read(await f[0].arrayBuffer(), { type: 'array' }); const wantSetup = pcIsAdmin() && document.getElementById('pc-imp-setup').checked; const r = pcImportWb(wb, wantSetup); arCloseModal(); PC.dirty = true; await pcLoadWeekAfterImport(r); pcRender(); alert(r.msg); } catch (e) { alert('Error: ' + e.message); }
}
async function pcLoadWeekAfterImport(r) { if (r.week && r.week !== PC.week) { PC.week = r.week; const keep = PC.W; await pcLoadWeek(); Object.assign(PC.W, keep, { week: PC.week }); PC.dirty = true; } }
function pcSheetRows(wb, name) { const ws = wb.Sheets[name]; return ws ? XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null }) : null; }
function pcXDate(v) { if (v == null || v === '') return ''; if (v instanceof Date) return pcISO(v); if (typeof v === 'number') return new Date(Math.round(v * 86400000) + Date.UTC(1899, 11, 30)).toISOString().slice(0, 10); const s = String(v).trim(); let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/); if (m) return m[0]; m = s.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})/); if (m) { const y = m[3].length === 2 ? '20' + m[3] : m[3]; return `${y}-${String(m[1]).padStart(2, '0')}-${String(m[2]).padStart(2, '0')}`; } return ''; }
function pcNum(v) { return typeof v === 'number' ? v : (parseFloat(String(v == null ? '' : v).replace(/,/g, '')) || 0); }
function pcImportWb(wb, wantSetup) {
  const out = [], W = pcNewWeek(PC.week); const P = pcSheetRows(wb, 'Purchases'); if (!P) throw new Error('Walang "Purchases" sheet. Hindi ito mukhang Prime Cost workbook.');
  let week = pcXDate((P[2] || [])[1]); if (week) { week = pcMonday(week); W.week = week; }
  const base = week || PC.week;
  // Purchases (Daily Invoice Log): A supplier, B date, C amount, E vat, G supplies, H cleaning, I meals
  for (let i = 6; i < Math.min(P.length, 100); i++) { const r = P[i] || []; if (!r[0] && !r[2]) continue; if (typeof r[0] === 'string' && /^TOTALS/i.test(r[0])) break; const g = pcNum(r[2]); if (!g && !r[0]) continue; W.inv.push({ sup: String(r[0] || ''), date: pcXDate(r[1]), gross: g, vat: pcNum(r[4]), sp: pcNum(r[6]), cl: pcNum(r[7]), ml: pcNum(r[8]) }); } out.push(W.inv.length + ' invoice');
  // Prime Cost Worksheet: sales F9:L14, channels E33:L38, covers row 28
  const PW = pcSheetRows(wb, 'Prime Cost Worksheet'); if (PW) { const keys = ['vat', 'exm', 'sc', 'pwd', 'disc', 'comp']; keys.forEach((k, j) => { const r = PW[8 + j] || []; W.sales[k] = [5, 6, 7, 8, 9, 10, 11].map(c => pcNum(r[c])); }); W.covers = [5, 6, 7, 8, 9, 10, 11].map(c => pcNum((PW[27] || [])[c])); const chn = []; for (let i = 32; i <= 37; i++) { const r = PW[i] || []; const nm = String(r[4] || '').trim(); if (!nm) continue; W.ch[nm] = [5, 6, 7, 8, 9, 10, 11].map(c => pcNum(r[c])); const m = String(r[15] != null ? r[15] : ''); chn.push(nm); } out.push('sales at ' + chn.length + ' channel'); }
  const sheetCat = (name, headRow, first, catCols, cats, cols) => { const R = pcSheetRows(wb, name); if (!R) return 0; let n = 0; for (let i = first; i < R.length; i++) { const r = R[i] || []; const d = pcXDate(r[0]); if (!d && !r[1]) { if (i > first + 5 && !r[6]) continue; continue; } let cat = null, best = 0; catCols.forEach((c, j) => { const v = pcNum(r[c]); if (Math.abs(v) > Math.abs(best)) { best = v; cat = cats[j]; } }); const gross = pcNum(r[cols.gross]), vat = pcNum(r[cols.vat]); if (!gross && !best) continue; n++; (name === 'PCF Food' ? W.food : W.petty).push({ date: d, part: String(r[1] || ''), sup: String(r[2] || ''), ref: String(r[cols.ref] || ''), gross: gross || best + vat, vat, cat: cat || (name === 'PCF Food' ? 'misc' : 'meals') }); } return n; };
  const pettyCols = PC_PETTY.map((_, j) => 17 + j); const nP = sheetCat('Petty Cash Form', 6, 9, pettyCols, PC_PETTY.map(c => c[0]), { gross: 6, vat: 7, ref: 5 }); const foodCols = PC_FOOD.map((_, j) => 17 + j); const nF = sheetCat('PCF Food', 4, 8, foodCols, PC_FOOD.map(c => c[0]), { gross: 6, vat: 7, ref: 4 }); out.push(nP + ' petty cash', nF + ' petty food');
  // Other expenses form: A supplier, B date (text), C amount, E vat, G..W categories
  const OX = pcSheetRows(wb, 'Other expenses form'); if (OX) { let n = 0; for (let i = 8; i < Math.min(OX.length, 90); i++) { const r = OX[i] || []; if (!r[0] && !pcNum(r[2])) continue; let cat = null, best = 0; PC_OTHER.forEach((c, j) => { const v = pcNum(r[6 + j]); if (Math.abs(v) > Math.abs(best)) { best = v; cat = c[0]; } }); const gross = pcNum(r[2]); if (!gross && !best) continue; n++; W.other.push({ sup: String(r[0] || ''), part: '', date: pcXDate(r[1]) || base, gross, vat: pcNum(r[4]), ref: '', cat: cat || 'rm' }); } out.push(n + ' other'); }
  // Labor hours (actual & planned) + holiday flags
  const LH = pcSheetRows(wb, 'Labor Hours'); if (LH) { for (let i = 5; i < LH.length; i++) { const r = LH[i] || []; const nm = String(r[1] || '').trim(); if (!nm) continue; const h = [2, 3, 4, 5, 6, 7, 8].map(c => pcNum(r[c])); W.labor.rows.push({ name: nm, hrs: h }); } out.push(W.labor.rows.length + ' empleyado (labor)'); }
  const LC = pcSheetRows(wb, 'Labor Cost'); if (LC) { W.labor.legal = [3, 4, 5, 6, 7, 8, 9].map(c => /^yes$/i.test(String((LC[2] || [])[c] || ''))); W.labor.special = [3, 4, 5, 6, 7, 8, 9].map(c => /^yes$/i.test(String((LC[3] || [])[c] || ''))); }
  const PL = pcSheetRows(wb, 'P_Labor Hours'); if (PL) { W.plan = { rows: [] }; for (let i = 5; i < PL.length; i++) { const r = PL[i] || []; const nm = String(r[1] || '').trim(); if (!nm) continue; W.plan.rows.push({ name: nm, hrs: [2, 3, 4, 5, 6, 7, 8].map(c => pcNum(r[c])) }); } const PP = pcSheetRows(wb, 'P_Prime Cost Worksheet'); if (PP) W.fc.sales = [5, 6, 7, 8, 9, 10, 11].map(c => pcNum((PP[8] || [])[c])); out.push('planned/forecast'); }
  // Inventory totals (Total Food Cost F3/H3); PP sheet
  const TF = pcSheetRows(wb, 'Total Food Cost'); if (TF) { W.invc.beg = { value: pcNum((TF[2] || [])[5]), src: 'excel', date: pcAdd(base, -1) }; W.invc.end = { value: pcNum((TF[2] || [])[7]), src: 'excel', date: pcAdd(base, 6) }; out.push('inventory beg/end'); } const TP = pcSheetRows(wb, 'Total Food Cost PP'); if (TP) { W.invc.ppBeg = pcNum((TP[2] || [])[5]); W.invc.ppEnd = pcNum((TP[2] || [])[7]); }
  let setupMsg = ''; if (wantSetup) { try { setupMsg = pcImportSetup(wb); } catch (e) { setupMsg = ' (Setup: ' + e.message + ')'; } }
  PC.W = Object.assign(PC.W || {}, W, { site: PC.site, locked: false });
  return { week, msg: '✅ Na-import: ' + out.join(', ') + '.' + setupMsg + '\nSuriin ang bawat tab, tapos pindutin ang 💾 I-save.' };
}
function pcImportSetup(wb) {
  const S = PC.setup, M = wb.Sheets['Weekly PnL Mapping'], LR = pcSheetRows(wb, 'Labor Rate'); let msg = '';
  if (M) { const rows = XLSX.utils.sheet_to_json(M, { header: 1, raw: true, defval: null }); const fOf = r => { const c = M['F' + (r + 1)]; return c && c.f ? String(c.f) : ''; }; const find = code => { for (let i = 0; i < rows.length; i++) if (String((rows[i] || [])[4] || '').indexOf(code) === 0) return i; return -1; };
    const num = (f, re) => { const m = f.match(re); return m ? parseFloat(m[1]) : 0; }; const set = (id, label, grp, amt, per) => { if (!amt) return; let x = S.fixed.find(f => f.id === id); if (!x) { x = { id, label, grp, amt: 0, per }; S.fixed.push(x); } x.amt = amt; x.per = per; }; let n = 0;
    [['util_elec', '61510010'], ['util_gas', '61510020'], ['util_water', '61510030'], ['util_trash', '61510040'], ['util_ac', '61510050'], ['ga_tel', '61630040'], ['occ_cam', '62110060'], ['dep_kit', '51180080'], ['dep_furn', '62210030']].forEach(([id, code]) => { const r = find(code); if (r < 0) return; const a = num(fOf(r), /(\d+(?:\.\d+)?)\*12\/52/); if (a) { set(id, (S.fixed.find(f => f.id === id) || {}).label || id, 'ga', a, 'month'); n++; } });
    let r = find('61620020'); if (r >= 0) { const a = num(fOf(r), /\(?(\d+(?:\.\d+)?)\)?\/365\*7/); if (a) { set('ga_ins', 'Insurance', 'ga', a, 'year'); n++; } } r = find('61620030'); if (r >= 0) { const m = fOf(r).match(/\(\((\d+(?:\.\d+)?)\)\+\((\d+(?:\.\d+)?)\*12\)\)\/365\*7/); if (m) { set('ga_tax', 'Taxes, Licenses & Permits', 'ga', parseFloat(m[1]) + parseFloat(m[2]) * 12, 'year'); n++; } } r = find('61310070'); if (r >= 0) { const a = num(fOf(r), /\(-(\d+(?:\.\d+)?)\*12\/52\)/); if (a) { set('dop_pest', 'Pest Control (estimate)', 'dop', a, 'month'); n++; } }
    const cell = (a) => { const c = M[a]; return c ? c.v : null; }; const sq = cell('L17'), bs = cell('L18'), mn = cell('L20'); if (sq) { S.rent.sqm = +sq; S.rent.basic = +bs || 0; S.rent.min = +mn || 0; const pf = M['R16'] && M['R16'].f ? M['R16'].f.match(/\*(\d*\.?\d+)/) : null; if (pf) S.rent.pct = +pf[1] * 100; n++; } msg += ` Setup: ${n} linya.`; }
  if (LR) { const sec = PC.secure = PC.secure || { emps: [] }; let n = 0; for (let i = 2; i < LR.length; i++) { const r = LR[i] || []; const nm = String(r[0] || '').trim(); if (!nm) continue; const e = { name: nm, basic: pcNum(r[1]), allow: pcNum(r[2]), demin: pcNum(r[3]), sss: pcNum(r[4]), phil: pcNum(r[5]), hdmf: pcNum(r[6]), hmo: pcNum(r[7]), m13: pcNum(r[8]) }; const old = sec.emps.findIndex(x => x.name === nm); if (old >= 0) sec.emps[old] = e; else sec.emps.push(e); n++; } msg += ` Labor Rates: ${n} (pindutin ang 💾 sa Setup para ma-save).`; sec.days = sec.days || 313; sec.hrs = sec.hrs || 8; PC.rates = pcPubFromSecure(sec); }
  return msg;
}
