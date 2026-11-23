/* =====================================================================
   🛒 KUSINA POS  (cashier + menu + event + membership/club + docs + roster + ideal vs actual)
   HINDI ito BIR-accredited na resibo: "ORDER SLIP / BILLING STATEMENT" ang tawag sa printout; may linya para sa Opisyal na Resibo No. na kakabit.
   Firestore: pos_setup/{company} · pos_menu/{id} · pos_events/{id} · pos_event_stock/{eventId} · pos_sales/{id} · pos_counters/{site}__{yyyymmdd}
              pos_members/{company}__{id} · pos_clubs/{company}__{slug} · pos_shifts/{id} · pos_docs/{site} · pos_roster/{site} · pos_ideal/{key} · emp_directory/{id}
   Presyo = VAT-inclusive. Menu ≠ BOM: ang Menu ay may sariling sangkap (gramo, cook/uncook); ang BOM ay pang-inventory lang at hindi ginagalaw ng POS.
   ===================================================================== */
const PX = { ready: false, sites: [], site: '', tab: 'pos', cfg: null, menu: [], events: [], event: '', cart: [], cat: '', q: '', members: [], clubs: [], shift: null, ctx: null, off: {}, tabs: [], floor: null, fedit: false, role: '', mine: [], sales: [], disc: { type: 'none', elig: '', pct: '', id: '', name: '' }, pays: [], member: null, sig: '', last: null, chan: 'dine', chanRef: '' };
const PX_CH = { dine: { n: 'Dine-in', i: '🍽️' }, take: { n: 'Take-out', i: '🥡' }, fp: { n: 'Foodpanda', i: '🐼', app: true }, grab: { n: 'GrabFood', i: '🟢', app: true } };
const pxChan = () => PX.ctx ? ((PX.ctx.chan && PX_CH[PX.ctx.chan]) ? PX.ctx.chan : 'dine') : (PX_CH[PX.chan] ? PX.chan : 'dine'), pxApp = () => !!PX_CH[pxChan()].app;
const PX_DEF = { sc: { on: true, pct: 10, show: false, base: 'after' }, vat: { on: true, pct: 12 }, header: '', footer: 'Salamat po!', paper: '80', members: true, sigMode: 'member', tableMember: false, printBillFirst: true, dayCutoff: 5, kcut: { on: true, time: '21:00' }, stations: [], defaultStation: '', kitchenCounter: true, chComm: { fp: '', grab: '' }, mgrPin: '', modes: ['cash', 'gcash'], seniorPct: 20, siPrefix: 'SI', siPad: 6, devName: '', devContact: '', devTag: '', sites: {} };
const PX_MODES = { cash: '💵 Cash', gcash: '📱 GCash', maya: '📱 Maya', qrph: '🔳 QR Ph', debit: '💳 Debit Card', credit: '💳 Credit Card', intl: '🌐 International Card', paypal: '🅿️ PayPal', bank: '🏦 Bank Transfer', member: '🪪 Membership Charge', org: '🏢 Charge to Organizer', fp: '🐼 Foodpanda (receivable)', grab: '🟢 GrabFood (receivable)' };
const PX_STAFF = /staff|crew|cashier|assistant|employee|waiter|server/i;
const pxE = s => typeof srchEsc === 'function' ? srchEsc(s == null ? '' : String(s)) : String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pxR2 = n => Math.round((+n || 0) * 100) / 100;
const pxM = n => (+n || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const pxSlug = s => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const pxISO = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
const pxToday = () => pxISO(new Date());
/* Business date: may cut-off (default 5:00 AM) para ang benta pagkatapos ng hatinggabi ay kasama pa rin sa araw na iyon */
const pxBiz = ms => pxISO(new Date((ms || Date.now()) - (((typeof PX !== 'undefined' && PX.cfg && PX.cfg.dayCutoff != null) ? +PX.cfg.dayCutoff : 5) * 36e5)));
const pxShiftStale = () => !!(PX.shift && PX.shift.date && PX.shift.date < pxBiz());
const pxId = p => p + '-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
const pxNum = v => { const n = parseFloat(String(v == null ? '' : v).replace(/,/g, '')); return isFinite(n) ? n : 0; };
// naka-pin ang account na nag-open ng POS sa tab na ito (iisang browser = iisang login storage, kaya hindi puwedeng umasa sa getCurrentUser() palagi)
const pxMe = () => (typeof PX !== 'undefined' && PX && PX._me) || getCurrentUser() || {};
const pxAdmin = () => PX.role === 'admin' || (typeof canEditModule === 'function' && canEditModule('pos'));
const pxSite = () => PX.sites.find(s => s.key === PX.site) || {};
let pxMgr = () => pxAdmin() || (PX.role === 'branch' && PX.mine.includes(PX.site) && !PX_STAFF.test(String(pxMe().role || '') + ' ' + String(pxMe().position || pxMe().title || '')));
const pxCan = () => pxAdmin() || (PX.role === 'branch' && PX.mine.includes(PX.site));
const pxCo = () => pxSite().company || '';
const pxEv = () => PX.events.find(e => e.id === PX.event) || null;
const pxAuto = () => { const c = PX.co || {}, s = pxSite(); return { legal: c.legalName || c.name || pxCo(), trade: s.name || '', address: s.address || c.address || '', tin: c.tin || '', vstat: PX.cfg && PX.cfg.vat && PX.cfg.vat.on === false ? 'NON-VAT' : 'VAT', contact: s.phone || c.phone || '' }; };
const pxInfo = () => { const sv = ((PX.cfg || {}).sites || {})[PX.site] || {}, a = pxAuto(), o = {}; ['legal', 'trade', 'address', 'tin', 'vstat', 'contact'].forEach(k => { o[k] = sv[k] != null && String(sv[k]).trim() !== '' ? sv[k] : a[k]; }); o.siNext = sv.siNext || 0; return o; };
const pxEventLive = e => { const t = pxToday(); return e && e.status !== 'closed' && (!e.from || t >= e.from) && (!e.to || t <= e.to); };

async function loadPOS() {
  const root = document.getElementById('pos-root'); if (!root || !db) return; root.innerHTML = '<div class="card">Kinukuha...</div>';
  try {
    PX._me = Object.assign({}, getCurrentUser() || {}); const u = pxMe(); PX.role = normalizeRole(u.role); PX.sites = [];
    (await db.collection('inventory_branches').get()).forEach(d => { const x = d.data(); PX.sites.push({ key: pxSlug(x.code || x.branch), name: x.branch || x.code, code: x.code || '', company: x.company || '', address: x.address || '', phone: x.phone || x.contact || '' }); });
    PX.sites.sort((a, b) => (a.company + a.name).localeCompare(b.company + b.name));
    const me = String(u.branch || '').trim().toLowerCase(), extra = (u.branches || []).map(x => String(x).toLowerCase());
    PX.mine = PX.sites.filter(s => [s.name, s.code].some(v => v && String(v).toLowerCase() === me)).map(s => s.key);
    if (PX.role !== 'admin' && !pxAdmin()) { const vis = PX.sites.filter(s => PX.mine.includes(s.key) || extra.includes(String(s.name).toLowerCase()) || extra.includes(String(s.code).toLowerCase())); PX.sites = vis; }
    if (!PX.site || !PX.sites.find(s => s.key === PX.site)) PX.site = (PX.sites[0] || {}).key || '';
    if (!PX.site) { root.innerHTML = '<div class="card">Wala pang naka-set na Branch para sa account na ito. Makipag-ugnayan kay Admin.</div>'; return; }
    PX.ready = true; await pxLoadSite(); pxRender();
  } catch (e) { root.innerHTML = '<div class="card" style="color:#dc2626;">Error: ' + pxE(e.message) + '</div>'; }
}
async function pxLoadSite() {
  const co = pxCo(), cs = pxSlug(co);
  const [cf, mn, ev, mb, cl, sh, cm, dv, of] = await Promise.all([
    db.collection('pos_setup').doc(cs).get(), db.collection('pos_menu').where('company', '==', co).get(), db.collection('pos_events').where('company', '==', co).get(),
    db.collection('pos_members').where('company', '==', co).get().catch(() => ({ forEach() {} })), db.collection('pos_clubs').where('company', '==', co).get().catch(() => ({ forEach() {} })),
    db.collection('pos_shifts').where('site', '==', PX.site).where('status', '==', 'open').get().catch(() => ({ empty: true, docs: [] })),
    db.collection('companies').where('name', '==', co).get().catch(() => ({ empty: true, docs: [] })), db.collection('system_settings').doc('developer').get().catch(() => ({ exists: false })), db.collection('pos_86').doc(PX.site).get().catch(() => ({ exists: false }))]);
  PX.off = of.exists ? (of.data().items || {}) : {};
  PX.co = cm.empty ? {} : cm.docs[0].data(); const dd = dv.exists ? dv.data() : {}; PX.dev = { name: dd.name != null ? dd.name : 'Renz Aldrin Gomez', contact: dd.contact || '', tag: dd.tag || '' };
  const d = cf.exists ? cf.data() : {}; PX.cfg = Object.assign({}, PX_DEF, d, { sites: d.sites || {}, sc: Object.assign({}, PX_DEF.sc, d.sc || {}), vat: Object.assign({}, PX_DEF.vat, d.vat || {}), devName: PX.dev.name, devContact: PX.dev.contact, devTag: PX.dev.tag });
  PX.menu = []; mn.forEach(x => PX.menu.push(Object.assign({ id: x.id }, x.data()))); PX.menu.sort((a, b) => String(a.category || '').localeCompare(String(b.category || '')) || String(a.name).localeCompare(String(b.name)));
  PX.events = []; ev.forEach(x => PX.events.push(Object.assign({ id: x.id }, x.data()))); PX.events.sort((a, b) => String(b.from || '').localeCompare(String(a.from || '')));
  PX.members = []; mb.forEach(x => PX.members.push(Object.assign({ id: x.id }, x.data()))); PX.clubs = []; cl.forEach(x => PX.clubs.push(Object.assign({ id: x.id }, x.data())));
  PX.shift = sh.empty ? null : Object.assign({ id: sh.docs[0].id }, sh.docs[0].data());
  if (PX.event && !pxEv()) PX.event = ''; await pxStnReload(); PX.cart = []; pxResetPay();
}
function pxResetPay() { PX.chanRef = ''; PX.disc = { type: 'none', elig: '', pct: '', id: '', name: '' }; PX.pays = []; PX.member = null; PX.sig = ''; PX.billSig = ''; }
async function pxSiteChange(k) {
  const tk = (PX._lt = (PX._lt || 0) + 1), root = document.getElementById('pos-root'), st = (PX.sites || []).find(s => s.key === k) || {};
  PX.site = k; PX.event = ''; PX.cat = ''; PX.loading = true; PX.ctx = null; PX.cart = []; PX.tabs = []; PX.shift = null;
  // loading screen: walang button habang nilo-load ang company/branch na pinili (iwas pindot sa lumang data)
  if (root) root.innerHTML = `<div class="card" style="text-align:center;padding:2.5rem 1rem;"><div style="width:46px;height:46px;margin:0 auto 1rem;border:5px solid #e2e8f0;border-top-color:#2563eb;border-radius:50%;animation:pxspin 0.9s linear infinite;"></div><style>@keyframes pxspin{to{transform:rotate(360deg)}}</style><b style="font-size:1.1rem;">Nilo-load ang ${pxE(st.company || '')} — ${pxE(st.name || '')}…</b><div style="color:#64748b;margin-top:.4rem;">Sandali lang. Huwag munang pindutin ang kahit ano.</div></div>`;
  try { await pxLoadSite(); } catch (e) { if (tk === PX._lt && root) { PX.loading = false; root.innerHTML = '<div class="card" style="color:#dc2626;">Hindi ma-load: ' + pxE(e.message) + ' <button class="btn btn-primary btn-sm" onclick="pxSiteChange(\'' + pxE(k) + '\')">Subukan ulit</button></div>'; } return; }
  if (tk !== PX._lt) return; // may mas bagong pinili
  PX.loading = false; pxRender();
}

/* ---------- Mga item ng menu na ipinapakita ---------- */
function pxMenuItems() { // may channel (Dine-in/Take-out/Foodpanda/Grab): iba ang presyo, at puwedeng hindi ibenta sa isang channel
  const ch = pxChan(), L = pxMenuItems0(); if (ch === 'dine') return L;
  const app = !!(PX_CH[ch] && PX_CH[ch].app); // Foodpanda/Grab: tanging may nilagay na presyo sa channel ang lalabas
  return L.filter(m => !(m.chOff && m.chOff[ch]) && (!app || +((m.chPrice || {})[ch]) > 0)).map(m => { const p = +((m.chPrice || {})[ch]); return p > 0 ? Object.assign({}, m, { _price: p }) : m; });
}
function pxMenuItems0() { // regular menu + (kung may aktibong event) event items; pwedeng mag-override ng presyo ang event
  const ev = pxEv(); const reg = PX.menu.filter(m => !m.eventId && !m.batch && m.active !== false);
  if (!ev) return reg.map(m => Object.assign({}, m, { _price: +m.price || 0 }));
  const ov = ev.prices || {}, inc = ev.regularIds, out = [];
  reg.forEach(m => { if (inc && inc.length && !inc.includes(m.id)) return; out.push(Object.assign({}, m, { _price: ov[m.id] != null ? +ov[m.id] : (+m.price || 0) })); });
  PX.menu.filter(m => m.eventId === ev.id && m.active !== false).forEach(m => out.push(Object.assign({}, m, { _price: +m.price || 0 })));
  return out;
}
/* ---------- Kuwenta (VAT-inclusive na presyo) ---------- */
function pxCalc(cart, disc, cfg) {
  cfg = cfg || PX.cfg || PX_DEF; const vatOn = cfg.vat.on !== false, vr = 1 + (+cfg.vat.pct || 12) / 100;
  const gross = pxR2(cart.reduce((s, l) => s + (+l.price || 0) * (+l.qty || 0), 0)); const t = disc.type || 'none';
  let elig = gross; if (t === 'senior' || t === 'pwd') { const e = pxNum(disc.elig); if (e > 0) elig = Math.min(e, gross); }
  const R = { gross, vatable: 0, vat: 0, exempt: 0, sc: 0, pwd: 0, disc: 0, comp: 0, due: 0, total: 0, label: '' };
  if (!gross) return R;
  if (t === 'comp') { R.comp = gross; R.due = 0; R.label = 'Complimentary'; }
  else if (t === 'senior' || t === 'pwd') {
    const netE = vatOn ? elig / vr : elig, d20 = pxR2(netE * ((+cfg.seniorPct || 20) / 100)); const rest = pxR2(gross - elig);
    R.exempt = pxR2(netE - d20); if (t === 'senior') R.sc = d20; else R.pwd = d20;
    R.vatable = vatOn ? pxR2(rest / vr) : rest; R.vat = vatOn ? pxR2(rest - R.vatable) : 0; R.due = pxR2(R.exempt + rest); R.label = t === 'senior' ? 'Senior Citizen ' + (cfg.seniorPct || 20) + '%' : 'PWD ' + (cfg.seniorPct || 20) + '%';
  } else if (t === 'taxex') { R.exempt = vatOn ? pxR2(gross / vr) : gross; R.due = R.exempt; R.label = 'Tax-Exempt'; }
  else if (t === 'manual') { const p = Math.min(100, Math.max(0, pxNum(disc.pct))), am = Math.max(0, pxNum(disc.amt)); R.disc = Math.min(gross, pxR2(gross * p / 100 + am)); const after = pxR2(gross - R.disc); R.vatable = vatOn ? pxR2(after / vr) : after; R.vat = vatOn ? pxR2(after - R.vatable) : 0; R.due = after; R.label = 'Discount' + (p ? ' ' + p + '%' : '') + (am ? ' ₱' + pxM(am) : ''); }
  else { R.vatable = vatOn ? pxR2(gross / vr) : gross; R.vat = vatOn ? pxR2(gross - R.vatable) : 0; R.due = gross; }
  const hasCh = cart.some(l => l.ch), dineG = hasCh ? pxR2(cart.reduce((s, l) => s + (l.ch === 'dine' || l.ch === '' || l.ch === undefined ? (+l.price || 0) * (+l.qty || 0) : 0), 0)) : gross;
  if (cfg.sc.on && R.due > 0 && (hasCh ? dineG > 0 : pxChan() === 'dine')) R.sc$ = pxR2(R.due * (hasCh && gross ? dineG / gross : 1) * (+cfg.sc.pct || 10) / 100); R.svc = R.sc$ || 0; delete R.sc$;
  // Non-VAT na item (hal. itinakda sa Menu na walang VAT): hindi kasama sa VATable/VAT
  const nvG = pxR2(cart.reduce((s, l) => { const m = l.nv != null ? { vat: l.nv ? false : true } : ((PX.menu || []).find(x => x.id === l.id) || {}); return s + (m.vat === false ? (+l.price || 0) * (+l.qty || 0) : 0); }, 0)); R.nvat = 0;
  if (nvG > 0 && vatOn && R.gross > 0 && t !== 'comp') { const k = Math.min(1, nvG / R.gross), v0 = R.vatable + R.vat; R.vatable = pxR2(R.vatable * (1 - k)); R.vat = pxR2(R.vat * (1 - k)); R.nvat = pxR2(v0 - R.vatable - R.vat); }
  R.total = pxR2(R.due + R.svc); return R;
}
/* ---------- Ubos ng sangkap (gamit para sa Ideal vs Actual) ---------- */
function pxIngInv(g, n) { // dami sa inventory unit para sa n serving
  const q = (+g.qty || 0) * (+n || 0); if (!q) return 0; const st = g.state || 'raw';
  if (st === 'juice') return +g.yield > 0 ? q / +g.yield : 0; // yield = ml na nakukuha bawat 1 inv unit ng hilaw
  const amt = g.unit === 'pc' && +g.pcG > 0 ? q * +g.pcG : q; // buo -> gramo kung may bigat ng 1 buo
  const raw = st === 'cooked' && +g.yield > 0 ? amt / +g.yield : amt;
  return raw / (+g.toInv > 0 ? +g.toInv : 1);
}
function pxUseOf(item, qty) { // -> { code: {name, qty (inventory unit), unit} }
  const o = {}, add = (ings, q, d) => (ings || []).forEach(g => { if (g.batch) { const b = (PX.menu || []).find(x => x.id === g.batch); if (b && (d || 0) < 3 && +b.yieldQty > 0) add(b.ings, q * (+g.qty || 0) / +b.yieldQty, (d || 0) + 1); return; } if (!g.code) return; const u = o[g.code] = o[g.code] || { name: g.name || g.code, qty: 0, unit: g.invUnit || g.unit || '' }; u.qty = +(u.qty + pxIngInv(g, q)).toFixed(6); });
  add(item.ings, qty); const mm = item.id ? (PX.menu || []).find(x => x.id === item.id) : null; if (mm && (mm.subs || []).length) mm.subs.forEach(s => { const sm = PX.menu.find(x => x.id === s.id); if (sm) add(sm.ings, qty * (+s.qty || 1)); }); // combo: kasama ang sangkap ng mga sub-item
  return o;
}

/* ================= RENDER: shell ================= */
function pxTabs() {
  const t = [['pos', '🛒 POS (Counter)']]; t.push(['help', '❓ Tulong']); if (pxCan()) t.push(['tables', '🍽️ Tables'], ['waiter', '📱 Waiter'], ['check', '🔎 Receipt Check'], ['rsv', '📅 Reservations']); if (pxMgr()) t.push(['hist', '📜 Table History']); if (pxAdmin()) t.push(['menu', '📋 Menu'], ['batch', '🥣 Batch Prep']); if (pxMgr()) t.push(['events', '🎪 Events'], ['gc', '🎁 Gift Card / Points']); t.push(['sales', '🧾 Benta / Shift']);
  if (PX.cfg.members !== false) t.push(['members', '🪪 Members']); if (pxAdmin() && PX.cfg.members !== false) t.push(['clubs', '🏢 Club Statement']);
  if (pxMgr()) t.push(['ideal', '📦 Ideal vs Actual'], ['docs', '📁 Branch Docs'], ['roster', '👥 Roster']); if (pxMgr()) t.push(['printers', '🖨️ Printers']); if (pxCan()) t.push(['setup', '⚙️ Setup']); return t;
}
function pxRender() {
  if (PX.loading) return; // naglo-load ng company/branch: huwag ipakita ang lumang screen
  const root = document.getElementById('pos-root'); if (!root) return; if (!pxTabs().find(x => x[0] === PX.tab)) PX.tab = 'pos'; const ev = pxEv();
  root.innerHTML = `<div class="card"><div class="card-title"><span>🛒 Kusina POS</span><span id="px-msg" style="font-size:.8rem;color:#166534;"></span></div>
  <div style="display:flex;gap:.4rem;flex-wrap:wrap;align-items:end;margin-bottom:.5rem;"><div><label style="font-weight:700;">Branch</label><br><select onchange="pxSiteChange(this.value)">${PX.sites.map(s => `<option value="${pxE(s.key)}" ${s.key === PX.site ? 'selected' : ''}>${pxE((s.company ? s.company + ' — ' : '') + s.name)}</option>`).join('')}</select></div>
  <div><label style="font-weight:700;">Event</label><br><select onchange="PX.event=this.value;PX.cart=[];pxResetPay();pxRender()"><option value="">— Regular na benta —</option>${PX.events.filter(pxEventLive).map(e => `<option value="${pxE(e.id)}" ${e.id === PX.event ? 'selected' : ''}>🎪 ${pxE(e.name)} (${pxE(e.from)} → ${pxE(e.to)})</option>`).join('')}</select></div>
  <span style="margin-left:auto;font-size:.82rem;">${PX.shift ? (pxShiftStale() ? '<b style="color:#dc2626;">⛔ Hindi pa na-Z-read: ' + pxE(PX.shift.date) + '</b>' : '🟢 Bukas ang shift: <b>' + pxE(PX.shift.cashier) + '</b> · ' + pxE(PX.shift.date || '')) : '🔴 Walang bukas na shift'}${ev ? ' · <b style="color:#7c3aed;">Event mode</b>' : ''}</span></div>
  <div style="display:flex;gap:.3rem;flex-wrap:wrap;margin-bottom:.6rem;">${pxTabs().map(([k, l]) => `<button class="btn ${k === PX.tab ? 'btn-primary' : 'btn-secondary'} btn-sm" onclick="pxTab('${k}')">${l}</button>`).join('')}</div>
  <div id="px-prn-banner">${pxPrnBanner()}</div><div id="px-body"></div></div>`; pxBody(); pxPrnStart();
}
async function pxTab(t) { if (PX.ctx && PX.cart.length && PX.ctx.mode === 'order' && !await pxConfirm('May hindi pa naipapadalang item sa order. Iwan ito?', { ok: 'Oo, iwan', danger: true })) return; PX.ctx = null; if (t === 'pos' || t === 'tables') { PX.cart = []; pxResetPay(); } PX.fedit = false; PX.tab = t; pxRender(); }
function pxToast(m) { const el = document.getElementById('px-msg'); if (el) { el.textContent = m; setTimeout(() => { if (el.textContent === m) el.textContent = ''; }, 4000); } }
async function pxBody() {
  const b = document.getElementById('px-body'); if (!b) return; const f = { pos: pxPosView, tables: pxFloorView, waiter: pxWaiterView, check: pxCheckView, help: pxHelpView, gc: pxGcView, rsv: pxRsvView, hist: pxHistView, menu: pxMenuView, batch: pxBatchView, events: pxEventsView, sales: pxSalesView, members: pxMembersView, clubs: pxClubsView, ideal: pxIdealView, docs: pxDocsView, roster: pxRosterView, printers: pxPrintersView, setup: pxSetupView }[PX.tab];
  try { const h = await f(); if (typeof h === 'string') b.innerHTML = h; } catch (e) { b.innerHTML = '<div style="color:#dc2626;">Error: ' + pxE(e.message) + '</div>'; }
}
function pxModal(html, wide) { let m = document.getElementById('px-modal'); if (!m) { m = document.createElement('div'); m.id = 'px-modal'; m.className = 'modal-overlay'; m.style.cssText = 'position:fixed;inset:0;background:rgba(15,23,42,.6);z-index:10050;display:none;align-items:center;justify-content:center;padding:1rem;'; document.body.appendChild(m); } m.style.display = 'flex'; m.innerHTML = `<div style="background:#fff;border-radius:.7rem;padding:1rem;max-width:${wide || 640}px;width:100%;max-height:92vh;max-height:92dvh;overflow:auto;padding-bottom:2rem;">${html}<div style="text-align:right;margin-top:.6rem;"><button class="btn btn-secondary btn-sm" onclick="pxClose()">Isara</button></div></div>`; }
function pxClose() { const m = document.getElementById('px-modal'); if (m) m.style.display = 'none'; }

/* ================= SETUP ================= */
async function pxSetupView() {
  const c = PX.cfg, adm = pxAdmin();
  setTimeout(pxPrev, 50);
  return `<p style="font-size:.85rem;color:#64748b;">Setup para sa <b>${pxE(pxCo())}</b> (lahat ng branch ng company).${adm ? '' : ' <b>Header ng resibo ng branch mo lang ang puwede mong baguhin dito.</b>'}</p>
  <div style="display:grid;grid-template-columns:minmax(0,3fr) minmax(280px,2fr);gap:1rem;align-items:start;"><div oninput="clearTimeout(PX._pt);PX._pt=setTimeout(pxPrev,200)" onchange="pxPrev()"><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:.8rem;">
  ${adm ? `<div class="card"><b>Service Charge</b><br><label><input type="checkbox" id="su-sc" ${c.sc.on ? 'checked' : ''}> Gamitin</label> <input type="number" id="su-scp" value="${c.sc.pct}" style="width:70px;">%<br><label><input type="checkbox" id="su-scs" ${c.sc.show ? 'checked' : ''}> Ipakita sa resibo</label><br><div style="${PX_HINT}">📖 <b>Gamitin</b> = idadagdag ang Service Charge sa bill; ang kahon sa tabi ay ang % (karaniwan 10). <b>Ipakita sa resibo</b> = kung walang ✔, hindi ito lalabas sa slip pero kasama pa rin sa total at naka-log nang hiwalay sa ulat.</div></div>` : ''}
  ${adm ? `<div class="card"><b>VAT</b><br><label><input type="checkbox" id="su-vat" ${c.vat.on ? 'checked' : ''}> VAT-registered (presyo ay VAT-inclusive)</label> <input type="number" id="su-vatp" value="${c.vat.pct}" style="width:70px;">%<br><b>Senior/PWD %</b> <input type="number" id="su-sen" value="${c.seniorPct}" style="width:70px;"><div style="${PX_HINT}">📖 <b>VAT-registered</b>: ✔ kung may VAT ang company; ang presyo sa menu ay <b>kasama na</b> ang VAT (12%). <b>Senior/PWD %</b>: discount (20% sa batas), kinukuwenta sa presyong <b>wala nang VAT</b>.</div></div>` : ''}
  ${adm ? `<div class="card"><b>Resibo / Slip</b><br><label>Papel</label> <select id="su-pap"><option value="80" ${c.paper === '80' ? 'selected' : ''}>80mm</option><option value="58" ${c.paper === '58' ? 'selected' : ''}>58mm</option></select><div style="${PX_HINT}">📖 <b>Papel</b>: lapad ng printer (80mm = karaniwan). <b>Header</b>: dagdag na linya sa itaas ng slip (hal. "Thank you for dining with us"). <b>Footer</b>: linya sa ibaba (hal. "Salamat po!"). Tingnan ang <b>Preview</b> sa kanan.</div><textarea id="su-head" rows="3" placeholder="Karagdagang linya sa header (opsyonal)" style="width:100%;">${pxE(c.header)}</textarea><input id="su-foot" value="${pxE(c.footer)}" placeholder="Footer" style="width:100%;"></div>` : ''}
  <div class="card" style="grid-column:1/-1;"><b>🏬 Impormasyon ng branch na ito sa resibo — ${pxE(pxSite().name)}</b><div style="${PX_HINT}">📖 Ito ang lalabas sa <b>itaas ng slip</b>. <b>Awtomatiko na</b> itong kinukuha sa Company profile ng ERP (legal name, address, TIN, telepono) at sa pangalan ng branch — hindi mo na kailangang i-type. Baguhin lang ang gusto mong ibahin; ang hindi mo ginalaw ay mananatiling auto (susunod kapag may binago sa Company). Ang <b>SI series</b> ay tuloy-tuloy na numero ng slip.<br><button type="button" class="btn btn-secondary btn-sm" style="margin-top:.2rem;" onclick="pxInfoAuto()">↩ Ibalik sa auto</button></div><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:.4rem;margin-top:.3rem;"><input id="su-legal" placeholder="Pangalan ng company (legal name)" value="${pxE(pxInfo().legal || '')}"><input id="su-trade" placeholder="Trade name / Branch" value="${pxE(pxInfo().trade || '')}"><input id="su-addr" placeholder="Address" value="${pxE(pxInfo().address || '')}"><input id="su-tin" placeholder="TIN (000-000-000-00000)" value="${pxE(pxInfo().tin || '')}"><select id="su-vstat"><option value="VAT" ${pxInfo().vstat !== 'NON-VAT' ? 'selected' : ''}>VAT Registered</option><option value="NON-VAT" ${pxInfo().vstat === 'NON-VAT' ? 'selected' : ''}>NON-VAT Registered</option></select><input id="su-contact" placeholder="Telepono / contact ng branch" value="${pxE(pxInfo().contact || '')}">${adm ? `<input id="su-sipre" placeholder="SI series prefix (hal. SI)" value="${pxE(c.siPrefix || 'SI')}">` : `<input id="su-sipre" type="hidden" value="${pxE(c.siPrefix || 'SI')}">`}<input type="number" id="su-sinext" placeholder="Susunod na SI number" value="${pxE(pxInfo().siNext || '')}" title="Gamitin lang kung gusto mong magsimula sa partikular na numero"></div><small style="color:#64748b;">Tuloy-tuloy ang SI series ng branch (hindi nire-reset kada araw). Ang "Susunod na SI number" ay ginagamit lang kapag wala pang naitalang benta ng branch.</small></div>
  ${pxDevCard()}
  ${adm ? `<div class="card"><b>🐼 Foodpanda / 🟢 GrabFood</b>${pxHint('📖 Ilagay ang <b>commission %</b> na kinukuha ng app sa bawat order. Ito ang gagamitin para tantiyahin ang net payout sa <b>Benta → Delivery receivables</b> (maaayos mo pa kapag dumating ang aktwal na statement). Ang Dine-in ay may Service Charge; ang Take-out at delivery ay wala.')}<label>Foodpanda %</label> <input type="number" step="0.01" id="su-cfp" value="${pxE((c.chComm || {}).fp || '')}" style="width:80px;"> <label>GrabFood %</label> <input type="number" step="0.01" id="su-cgr" value="${pxE((c.chComm || {}).grab || '')}" style="width:80px;"></div>` : ''}
  ${adm ? `<div class="card"><b>Membership</b><br><label><input type="checkbox" id="su-mem" ${c.members !== false ? 'checked' : ''}> May membership ang company na ito</label><br><b>Pirma ng customer sa screen</b> <select id="su-sig"><option value="member" ${c.sigMode === 'member' ? 'selected' : ''}>Member charge lang</option><option value="always" ${c.sigMode === 'always' ? 'selected' : ''}>Lahat ng benta</option><option value="never" ${c.sigMode === 'never' ? 'selected' : ''}>Wala (sa papel lang)</option></select><br><label><input type="checkbox" id="su-tm" ${c.tableMember ? 'checked' : ''}> <b>Kailangan ng ACTIVE na membership para magbukas ng table</b></label><br><label><input type="checkbox" id="su-pbf" ${c.printBillFirst !== false ? 'checked' : ''}> <b>Kailangang i-print muna ang Bill</b> bago mag-settle kapag may discount o binagong presyo</label><br><b>Cut-off ng araw</b> <input id="su-cut" type="number" min="0" max="12" step="1" value="${c.dayCutoff != null ? c.dayCutoff : 5}" style="width:60px;"> AM <small style="color:#64748b;">· Ang benta bago ang oras na ito (hal. 1 AM) ay kasama pa sa nakaraang araw. Dapat na-Z-read ang araw bago magbukas ng bago.</small><br><br><b>🌙 Cut-off ng kusina</b> <label><input type="checkbox" id="su-kc" ${(c.kcut || { on: true }).on !== false ? 'checked' : ''}> Naka-on</label> <input id="su-kct" type="time" value="${(c.kcut || {}).time || '21:00'}"> <small style="color:#64748b;">· Pagkatapos ng oras na ito ay hindi na tatanggap ng order maliban kung Admin/Super Admin ang gagalaw o may Manager PIN/code.</small><br><label style="display:inline-flex;align-items:center;gap:.3rem;"><input type="checkbox" id="su-mm" ${c.maskMem ? 'checked' : ''}> <b>🔒 I-hide ang membership info sa resibo/bill</b></label> <small style="color:#64748b;">· Kapag naka-on, ang pangalan ay ipapakita lang ang unang at huling letra ng bawat salita (hal. J**n D**a C**z), at ang member code ay ipapakita ang bawat ika-4 na karakter (hal. A***-1***). Ganoon din ang asawa/dependent. Nakikita pa rin ng accounting ng club para i-validate ang pirma, pero hindi makokopya ang buo kung maitapon ang resibo.</small><br><b>📅 Reservation alarm</b> Tawagan/i-confirm ang guest <input id="su-rc" type="number" min="5" max="240" style="width:70px;" value="${c.rsvCall || 30}"> minuto bago ang oras <small style="color:#64748b;">· Magpapakita ng alarm sa receptionist/dining; at paalala din kapag may table na occupied na malapit nang kailanganin.</small><br><b>Manager PIN</b> (para sa void/manual discount) <input id="su-pin" type="password" autocomplete="off" value="" placeholder="${c.mgrPinHash || c.mgrPin ? 'naka-set (i-type para palitan)' : 'itakda'}" style="width:190px;"> <button type="button" class="btn btn-secondary btn-sm" onclick="pxEye('su-pin',this)" title="Ipakita / itago ang PIN">👁️</button><div style="${PX_HINT}">📖 <b>Membership</b>: ✔ kung may member card/charge. <b>Pirma sa screen</b>: kailan hihingin ang pirma ng customer (ginagamit sa dispute kapag itinatanggi ang singil). <b>Table</b>: kung may ✔, hindi makakapagbukas ng table ang walang ACTIVE na member (para sa Tanoshi/Tokiya). <b>Manager PIN</b>: code na kailangan ng cashier para sa void at manual discount. Admin lang ang nakakakita at nakakapag-edit; pindutin ang 👁️ para ipakita/itago.</div></div>` : ''}</div>
  <button class="btn btn-success" style="margin-top:.6rem;" onclick="pxSetupSave()">💾 I-save ang Setup</button></div><div style="position:sticky;top:.5rem;"><b>👁️ Preview ng resibo</b><div style="font-size:.75rem;color:#64748b;margin-bottom:.2rem;">Itaas: impormasyon ng branch · Ilalim: developer / ads mo. Nagbabago habang nagta-type.</div><iframe id="su-prev" style="width:100%;height:640px;border:1px solid #cbd5e1;border-radius:.5rem;background:#fff;"></iframe></div></div>`;
}
function pxEye(id, b) { const i = document.getElementById(id); if (!i) return; const h = i.type === 'password'; i.type = h ? 'text' : 'password'; b.textContent = h ? '🙈' : '👁️'; }
function pxDevCard() {
  const d = PX.dev || {}, sup = typeof superAdminIsMe === 'function' && superAdminIsMe();
  const ro = `<div style="font-size:.82rem;">${d.name || d.contact || d.tag ? '<b>' + pxE(d.name) + '</b> · ' + pxE(d.contact) + '<br><i>' + pxE(d.tag) + '</i>' : '<i>Wala pang nakalagay.</i>'}</div><input id="su-devn" type="hidden" value="${pxE(d.name)}"><input id="su-devc" type="hidden" value="${pxE(d.contact)}"><input id="su-devt" type="hidden" value="${pxE(d.tag)}">`;
  return `<div class="card" style="grid-column:1/-1;"><b>📣 Developer / Ads sa ilalim ng resibo</b><div style="${PX_HINT}">📖 Ito ay para sa <b>buong ERP</b> (iisa para sa lahat ng company at branch) at awtomatikong lalabas sa pinakailalim ng slip. ${sup ? 'Ikaw lang (Super Admin) ang puwedeng mag-edit nito.' : 'Super Admin lang ang puwedeng mag-edit nito.'} Blangko = hindi ipapakita.</div>${sup ? `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:.4rem;margin-top:.3rem;"><input id="su-devn" placeholder="Pangalan ng developer / POS" value="${pxE(d.name)}"><input id="su-devc" placeholder="Contact (telepono, email, FB...)" value="${pxE(d.contact)}"><input id="su-devt" placeholder="Tagline (hal. Kailangan ng sariling POS/ERP?)" value="${pxE(d.tag)}"></div><button type="button" class="btn btn-success btn-sm" style="margin-top:.4rem;" onclick="pxDevSave()">💾 I-save ang Developer</button>` : ro}</div>`;
}
async function pxDevSave() {
  const v = id => document.getElementById(id).value.trim(), d = { name: v('su-devn'), contact: v('su-devc'), tag: v('su-devt') };
  try { await db.collection('system_settings').doc('developer').set(Object.assign({}, d, { updatedBy: String(pxMe().email || ''), updatedAt: new Date().toISOString() })); PX.dev = d; PX.cfg = Object.assign({}, PX.cfg, { devName: d.name, devContact: d.contact, devTag: d.tag }); pxToast('✅ Na-save ang Developer'); pxPrev(); } catch (e) { pxAlert('Error: ' + e.message); }
}
function pxInfoAuto() { const a = pxAuto(), set = (id, x) => { const e = document.getElementById(id); if (e) e.value = x || ''; }; set('su-legal', a.legal); set('su-trade', a.trade); set('su-addr', a.address); set('su-tin', a.tin); set('su-vstat', a.vstat); set('su-contact', a.contact); pxPrev(); }
async function pxSetupSave() {
  const v = id => document.getElementById(id), adm = pxAdmin(), a = pxAuto();
  const val = { legal: v('su-legal').value.trim(), trade: v('su-trade').value.trim(), address: v('su-addr').value.trim(), tin: v('su-tin').value.trim(), vstat: v('su-vstat').value, contact: v('su-contact').value.trim() }, info = {};
  Object.keys(val).forEach(k => { info[k] = val[k] === String(a[k] || '').trim() ? '' : val[k]; }); info.siNext = pxNum(v('su-sinext').value) || 0; // auto ang hindi binago
  const sites = Object.assign({}, PX.cfg.sites || {}); sites[PX.site] = info;
  const pk = adm ? await pxPinPack(v('su-pin').value.trim()) : {};
  const c = adm ? { sc: { on: v('su-sc').checked, pct: pxNum(v('su-scp').value), show: v('su-scs').checked, base: 'after' }, vat: { on: v('su-vat').checked, pct: pxNum(v('su-vatp').value) || 12 }, seniorPct: pxNum(v('su-sen').value) || 20, paper: v('su-pap').value, header: v('su-head').value, footer: v('su-foot').value, siPrefix: (v('su-sipre').value.trim() || 'SI').toUpperCase(), members: v('su-mem').checked, tableMember: v('su-tm').checked, printBillFirst: v('su-pbf').checked, dayCutoff: v('su-cut').value === '' ? 5 : Math.max(0, Math.min(12, pxNum(v('su-cut').value))), chComm: { fp: pxNum(v('su-cfp').value) || '', grab: pxNum(v('su-cgr').value) || '' }, sigMode: v('su-sig').value, ...pk, kcut: { on: v('su-kc').checked, time: v('su-kct').value || '21:00' }, maskMem: !!(document.getElementById('su-mm') || {}).checked, rsvCall: Math.max(5, Math.min(240, pxNum(v('su-rc').value) || 30)) } : {};
  try { await db.collection('pos_setup').doc(pxSlug(pxCo())).set(Object.assign({ company: pxCo() }, c, { sites }), { merge: true }); PX.cfg = Object.assign({}, PX.cfg, c, { sites }); pxToast('✅ Na-save'); pxRender(); } catch (e) { pxAlert('Error: ' + e.message); }
}

/* ================= PAMPALAWAK NA TOOLS: searchable picker, filter, hint ================= */
const PX_HINT = 'font-size:.75rem;color:#475569;background:#f1f5f9;border-left:3px solid #38bdf8;padding:.25rem .45rem;margin:.2rem 0 .4rem;border-radius:.25rem;line-height:1.35;';
const pxHint = t => `<div style="${PX_HINT}">${t}</div>`;
const pxLbl = (t, h) => `<label style="display:block;font-weight:700;font-size:.78rem;margin-bottom:.1rem;">${t}</label>${h ? `<div style="font-size:.7rem;color:#64748b;margin-bottom:.15rem;">${h}</div>` : ''}`;
let PX_PKT = null;
function pxPkBox() { let b = document.getElementById('px-pk'); if (!b) { b = document.createElement('div'); b.id = 'px-pk'; b.style.cssText = 'position:fixed;z-index:100000;background:#fff;border:1px solid #94a3b8;border-radius:.4rem;box-shadow:0 8px 24px rgba(0,0,0,.25);max-height:260px;overflow:auto;display:none;font-size:.85rem;'; document.body.appendChild(b); } return b; }
function pxPkInput(cb, args, keep, ph) { return `<input class="px-pkin" autocomplete="off" placeholder="${pxE(ph || '🔎 Mag-type ng code o pangalan (hal. apple)')}" value="${pxE(keep || '')}" data-cb="${cb}" data-a="${pxE(args)}" data-keep="${pxE(keep || '')}" oninput="pxPk(this)" onfocus="pxPk(this,1)" onblur="pxPkOff(this)" onkeydown="pxPkKey(event,this)" style="width:100%;box-sizing:border-box;">`; }
function pxPkFind(q, list, lim) {
  const t = String(q || '').toLowerCase().split(/\s+/).filter(Boolean); if (!t.length) return list.slice(0, lim || 40);
  const hit = list.filter(s => { const h = (s.code + ' ' + s.name).toLowerCase(); return t.every(x => h.includes(x)); });
  hit.sort((a, b) => { const A = a.name.toLowerCase().startsWith(t[0]) ? 0 : 1, B = b.name.toLowerCase().startsWith(t[0]) ? 0 : 1; return A - B || a.name.localeCompare(b.name); }); return hit.slice(0, lim || 40);
}
function pxPk(el, focus) {
  const sap = (PX_SAP || {}).list || [], keep = el.dataset.keep || ''; if (focus && keep && el.select) { try { el.select(); } catch (e) {} }
  const res = pxPkFind(el.value === keep ? '' : el.value, sap), b = pxPkBox(), r = el.getBoundingClientRect(); PX_PKT = { el, res };
  b.innerHTML = res.length ? res.map((s, i) => `<div onclick="pxPkSel(${i})" style="padding:.4rem .6rem;border-bottom:1px solid #f1f5f9;cursor:pointer;"><b>${pxE(s.name)}</b> <small style="color:#64748b;">${pxE(s.code)} · ${pxE(s.invUnit)}</small></div>`).join('') + (res.length >= 40 ? '<div style="padding:.3rem .6rem;color:#64748b;font-size:.75rem;">…marami pa. Dagdagan ang tina-type para paliitin.</div>' : '') : `<div style="padding:.5rem .6rem;color:#b45309;">${sap.length ? 'Walang nahanap. Subukan ang ibang salita.' : 'Walang SAP item para sa company na ito. Idagdag muna sa SAP Items.'}</div>`;
  b.style.display = 'block'; b.style.left = Math.max(4, r.left) + 'px'; b.style.width = Math.max(r.width, 300) + 'px';
  if (innerHeight - r.bottom < 220 && r.top > 240) { b.style.top = ''; b.style.bottom = (innerHeight - r.top + 2) + 'px'; } else { b.style.bottom = ''; b.style.top = (r.bottom + 2) + 'px'; }
}
function pxPkSel(i) {
  const p = PX_PKT; if (!p || !p.res[i]) return; const s = p.res[i], el = p.el; pxPkBox().style.display = 'none';
  el.dataset.keep = s.code + ' — ' + s.name; el.value = el.dataset.keep; const f = window[el.dataset.cb]; if (typeof f === 'function') f(el.dataset.a, s);
}
function pxPkOff(el) { setTimeout(() => { const b = pxPkBox(); if (PX_PKT && PX_PKT.el === el) b.style.display = 'none'; if (el.isConnected) el.value = el.dataset.keep || ''; }, 250); }
function pxPkKey(ev, el) { if (ev.key === 'Enter') { ev.preventDefault(); if (PX_PKT && PX_PKT.el === el && PX_PKT.res.length) pxPkSel(0); } else if (ev.key === 'Escape') pxPkBox().style.display = 'none'; }
function pxFlt(inp, sel) { const t = String(inp.value || '').toLowerCase().split(/\s+/).filter(Boolean); document.querySelectorAll(sel).forEach(el => { const h = String(el.dataset.s || el.textContent).toLowerCase(); el.style.display = t.every(x => h.includes(x)) ? '' : 'none'; }); }
const pxSearchBox = (sel, ph) => `<input type="search" placeholder="${pxE(ph || '🔎 Maghanap...')}" oninput="pxFlt(this,'${sel}')" style="width:100%;box-sizing:border-box;margin:.2rem 0;">`;

/* ================= MENU (admin) ================= */
let PX_SAP = null;
async function pxSap() { if (PX_SAP && PX_SAP.co === pxCo()) return PX_SAP.list; let l = []; try { const s = await db.collection('sap_items').where('company', '==', pxCo()).get(); s.forEach(d => { const x = d.data(); if (x.active !== false) l.push({ code: String(x.itemCode || ''), name: String(x.itemName || ''), invUnit: x.invUom || x.purchUom || 'kg', cost: (+x.lastPrice || 0) / (+x.perPurchase || 1) }); }); } catch (e) {} l.sort((a, b) => a.name.localeCompare(b.name)); PX_SAP = { co: pxCo(), list: l }; return l; }
async function pxMenuView() {
  await pxSap();
  const all = PX.menu.filter(m => !m.eventId && !m.batch), f = PX.mfil || 'all', cats = [...new Set(all.map(m => m.category || 'Iba pa'))].sort(), mc = PX.mcat || '', isAct = m => m.active !== false;
  const rows = all.filter(m => (f === 'all' || (f === 'active') === isAct(m)) && (!mc || (m.category || 'Iba pa') === mc));
  return `<div style="display:flex;gap:.4rem;margin-bottom:.3rem;flex-wrap:wrap;align-items:center;"><button class="btn btn-primary btn-sm" onclick="pxMenuEdit('')">➕ Bagong item</button>${[['all', 'Lahat', all.length], ['active', '🟢 Active', all.filter(isAct).length], ['inactive', '⚪ Inactive', all.filter(m => !isAct(m)).length]].map(([k, l, n]) => `<button class="btn ${f === k ? 'btn-primary' : 'btn-secondary'} btn-sm" onclick="PX.mfil='${k}';pxBody()">${l} (${n})</button>`).join('')}<select onchange="PX.mcat=this.value;pxBody()" style="max-width:180px;"><option value="">Lahat ng kategorya</option>${cats.map(c => `<option value="${pxE(c)}" ${c === mc ? 'selected' : ''}>${pxE(c)}</option>`).join('')}</select></div>
  ${pxHint('📖 <b>Menu ≠ BOM.</b> Dito mo ilalagay kung ano ang <b>ibebenta</b> (pangalan + presyo) at kung anong <b>sangkap</b> ang mababawas sa inventory kada benta. Ang BOM ay pang-inventory/costing lang at hindi ginagalaw ng POS. Ang ⚠ na "walang sangkap" ay hindi makakabawas sa inventory.')}
  ${pxSearchBox('#pm-tb tr.pm-r', '🔎 Hanapin ang menu item (pangalan, kategorya, o sangkap — hal. "apple")')}
  <div style="overflow:auto;"><table class="table" id="pm-tb" style="font-size:.85rem;"><tr><th>Item</th><th>Kategorya</th><th style="text-align:right;">Presyo</th><th>Sangkap</th><th></th></tr>${rows.length ? rows.map(m => `<tr class="pm-r" style="${isAct(m) ? '' : 'opacity:.55;'}" data-s="${pxE([m.name, m.category].concat((m.ings || []).map(g => g.name + ' ' + g.code)).join(' '))}"><td>${pxE(m.name)}${isAct(m) ? '' : ' <small style="background:#e2e8f0;border-radius:.6rem;padding:0 .4rem;">⚪ Inactive</small>'}${m.vat === false ? ' <small style="background:#fee2e2;border-radius:.6rem;padding:0 .4rem;">Non-VAT</small>' : ''}${m.subOnly ? ' <small style="background:#ede9fe;border-radius:.6rem;padding:0 .4rem;">🧩 Sub-item</small>' : ''}${(m.subs || []).length ? ' <small style="background:#fef3c7;border-radius:.6rem;padding:0 .4rem;">🍱 Combo</small>' : ''}${(m.stations || []).length ? '<br><small style="color:#0369a1;">🖨️ ' + (m.stations || []).map(k => pxE((pxStns().find(x => x.key === k) || { name: k }).name)).join(', ') + '</small>' : ''}</td><td>${pxE(m.category)}</td><td style="text-align:right;">${pxM(m.price)}${pxCostTag(m)}</td><td>${(m.subs || []).length ? '🍱 ' + (m.subs || []).length + ' sub-item <small style="color:#64748b;">' + pxE((m.subs || []).map(s => ((PX.menu.find(x => x.id === s.id) || {}).name || '?') + (s.qty > 1 ? ' ×' + s.qty : '')).join(', ')) + '</small>' : (m.ings || []).length + ((m.ings || []).length ? ' <small style="color:#64748b;">' + pxE((m.ings || []).slice(0, 3).map(g => g.name).join(', ')) + '</small>' : ' <b style="color:#dc2626;">⚠ wala</b>')}</td><td><button class="btn btn-secondary btn-sm" onclick="pxMenuEdit('${m.id}')">✏️</button> <button class="btn btn-danger btn-sm" onclick="pxMenuDel('${m.id}')">🗑️</button> ${m.active === false ? '<span class="badge badge-secondary">off</span>' : ''}</td></tr>`).join('') : '<tr><td colspan="5"><small>Wala pang item.</small></td></tr>'}</table></div>`;
}
let PX_ME = null;
async function pxMenuEdit(id, eventId, batch) {
  const m = id ? PX.menu.find(x => x.id === id) : null; PX_ME = JSON.parse(JSON.stringify(m || (batch ? { name: '', category: '', price: 0, active: true, ings: [], eventId: '', batch: true, yieldQty: 0, yieldUnit: 'g' } : { name: '', category: '', price: 0, active: true, ings: [], eventId: eventId || '' }))); PX_ME.id = id || ''; await pxSap(); pxMenuForm();
}
/* ---- Sukat ng sangkap: Buo/hati (pc) · Gramo (g) · ml · Luto (yield) · Piniga (ml bawat 1 inv unit) ---- */
function pxKind(u) { u = String(u || '').toLowerCase().trim(); if (/^(kg|kgs|kilo|kilos|g|gm|gms|gram|grams|lb|lbs|oz)$/.test(u)) return 'w'; if (/^(l|lt|ltr|liter|litre|ml|gal|gallon)$/.test(u)) return 'v'; return 'c'; }
function pxInvG(u) { u = String(u || '').toLowerCase().trim(); if (/^(kg|kgs|kilo|kilos|l|lt|ltr|liter|litre)$/.test(u)) return 1000; if (/^(lb|lbs)$/.test(u)) return 453.592; if (u === 'oz') return 28.3495; if (/^(gal|gallon)$/.test(u)) return 3785.41; return 1; }
function pxIngDef(g) { const k = pxKind(g.invUnit); g.unit = k === 'w' ? 'g' : k === 'v' ? 'ml' : 'pc'; g.state = 'raw'; g.yield = 0; g.pcG = 0; g.toInv = pxInvG(g.invUnit); if (!(g.qty > 0)) g.qty = 0; return g; }
function pxIngAdd(a, s) { pxMenuKeep(); PX_ME.ings.push(pxIngDef({ code: s.code, name: s.name, invUnit: s.invUnit, qty: 0 })); pxMenuForm(); }
function pxIngSet(i, f, val, re) {
  pxMenuKeep(); const g = PX_ME.ings[i]; if (!g) return; const k = pxKind(g.invUnit);
  if (['qty', 'yield', 'pcG', 'toInv'].includes(f)) g[f] = pxNum(val); else g[f] = val;
  if (f === 'unit') { if (val === 'pc') g.toInv = k === 'c' ? 1 : pxInvG(g.invUnit); else if (val === 'g' && k === 'w') g.toInv = pxInvG(g.invUnit); else if (val === 'ml' && k === 'v') g.toInv = pxInvG(g.invUnit); if (val !== 'ml' && g.state === 'juice') g.state = 'raw'; }
  if (f === 'state' && val === 'juice') g.unit = 'ml';
  if (re) pxMenuForm(); else pxIngPv(i);
}
function pxIngWarn(g) {
  if (g.batch) return '';
  const k = pxKind(g.invUnit), st = g.state || 'raw';
  if (st === 'juice' && !(+g.yield > 0)) return 'Lagyan ng "ml na nakukuha" bawat 1 ' + (g.invUnit || 'unit') + '.';
  if (st === 'cooked' && !(+g.yield > 0)) return 'Lagyan ng Yield (luto ÷ hilaw, hal. 2.4).';
  if (g.unit === 'pc' && k !== 'c' && !(+g.pcG > 0)) return 'Lagyan ng bigat ng 1 buo (g) para ma-convert sa ' + (g.invUnit || 'inventory unit') + '.';
  if (st !== 'juice' && !(+g.toInv > 0)) return 'Lagyan ng conversion sa inventory unit.'; return '';
}
function pxIngPv(i) {
  const g = PX_ME.ings[i], el = document.getElementById('pm-pv' + i); if (!el) return; if (g.batch) { pxBatchPv(g, el); pxCostBox(); return; } const w = pxIngWarn(g), per = pxIngInv(g, 1);
  el.innerHTML = !(g.qty > 0) ? '⌛ Ilagay ang dami para makita ang ibabawas sa inventory.' : w ? '<span style="color:#b45309;">⚠ ' + pxE(w) + '</span>' : '➡ Kada 1 benta: ibabawas <b>' + +per.toFixed(5) + ' ' + pxE(g.invUnit || '') + '</b> ng ' + pxE(g.name) + ' <small>(10 benta = ' + +(per * 10).toFixed(4) + ')</small>';
}
function pxIngCard(g, i) {
  if (g.batch) return pxBatchIngCard(g, i);
  const iu = g.invUnit || 'unit', un = g.unit || 'g', st = g.state || 'raw', mu = un === 'pc' && +g.pcG > 0 ? 'g' : un, sel = (v, c) => (v === c ? 'selected' : '');
  const inp = (f, v, w, ph) => `<input type="number" step="any" min="0" value="${v || ''}" placeholder="${ph || ''}" onchange="pxIngSet(${i},'${f}',this.value)" oninput="pxIngSet(${i},'${f}',this.value)" style="width:${w || 80}px;">`;
  return `<div style="border:1px solid #cbd5e1;border-radius:.5rem;padding:.45rem .55rem;margin:.35rem 0;background:#fff;">
  <div style="display:flex;justify-content:space-between;gap:.4rem;"><div><b>${pxE(g.name)}</b> <small style="color:#64748b;">${pxE(g.code)} · inventory unit: <b>${pxE(iu)}</b></small></div><button class="btn btn-danger btn-sm" onclick="pxMenuKeep();PX_ME.ings.splice(${i},1);pxMenuForm()">✖</button></div>
  <div style="display:flex;flex-wrap:wrap;gap:.5rem;align-items:end;margin-top:.3rem;">
   <div>${pxLbl(PX_ME && PX_ME.batch ? 'Dami na ginamit sa 1 BATCH' : 'Dami bawat 1 serving')}${inp('qty', g.qty, 80, 'hal. 0.5')}</div>
   <div>${pxLbl('Paano sinusukat')}<select onchange="pxIngSet(${i},'unit',this.value,1)"><option value="pc" ${sel(un, 'pc')}>🍎 Buo / hati (piraso)</option><option value="g" ${sel(un, 'g')}>⚖️ Gramo (loose / hiwa)</option><option value="ml" ${sel(un, 'ml')}>🧃 ml (likido / piniga)</option></select></div>
   <div>${pxLbl('Estado')}<select onchange="pxIngSet(${i},'state',this.value,1)"><option value="raw" ${sel(st, 'raw')}>Hilaw / as is</option><option value="cooked" ${sel(st, 'cooked')}>Luto</option>${un === 'ml' ? `<option value="juice" ${sel(st, 'juice')}>Piniga / juice</option>` : ''}</select></div>
  </div>
  <div style="display:flex;flex-wrap:wrap;gap:.5rem;align-items:end;margin-top:.3rem;">
   ${un === 'pc' ? `<div>${pxLbl('Bigat ng 1 buo (g)', 'hal. 1 apple ≈ 180 g. Kung "pc" din ang inventory unit, iwanang blangko.')}${inp('pcG', g.pcG, 90, 'hal. 180')}</div>` : ''}
   ${st === 'cooked' ? `<div>${pxLbl('Yield (luto ÷ hilaw)', 'hal. kanin: 1 kg hilaw → 2.4 kg luto = 2.4')}${inp('yield', g.yield, 90, '2.4')}</div>` : ''}
   ${st === 'juice' ? `<div>${pxLbl('ml na nakukuha bawat 1 ' + pxE(iu) + ' ng hilaw', 'hal. 1 kg apple → 500 ml juice = 500')}${inp('yield', g.yield, 110, '500')}</div>` : `<div>${pxLbl('Conversion: 1 ' + pxE(iu) + ' = ? ' + pxE(mu), 'hal. 1 kg = 1000 g. Awtomatiko na sa kg/g/L/ml/pc.')}${inp('toInv', g.toInv, 90, '1000')}</div>`}
  </div>
  <div id="pm-pv${i}" style="margin-top:.3rem;font-size:.8rem;background:#f0fdf4;border-radius:.3rem;padding:.25rem .4rem;"></div></div>`;
}
function pxMenuForm() {
  const m = PX_ME;
  pxModal(`<h3 style="margin-top:0;">${m.id ? 'I-edit' : 'Bagong'} ${m.batch ? '🥣 Batch Prep' : 'Menu Item'} ${m.eventId ? '(Event only)' : ''}</h3>${m.batch ? pxHint('📖 <b>Batch Prep</b> = sangkap na <b>niluto/kinatay/hinanda nang maramihan</b> mula sa SAP raw items, na gagamitin ng mga menu item. Hal. nagsaing ng <b>1 kg bigas</b> → lumabas ang <b>2,500 g</b> na sinaing: ilagay sa ibaba ang <b>bigas 1 kg (raw)</b>, at ang <b>Yield = 2500 g</b>. Sa menu item, kukuha ka lang ng hal. <b>800 g</b> sa batch na iyon — ang ibabawas sa inventory ay proporsyon ng raw (800/2500 = 32% → 320 g bigas), at makukuwenta rin ang halaga.') : ''}
  ${m.batch ? `<div style="display:grid;grid-template-columns:2fr 1fr 1fr;gap:.4rem;"><div>${pxLbl('Pangalan ng Batch Prep', 'hal. Sinaing, Teriyaki Sauce, Hiniwang Salmon')}<input id="pm-name" value="${pxE(m.name)}" style="width:100%;box-sizing:border-box;"></div><div>${pxLbl('Yield (ilan ang nagawa)', 'Kabuuang nagawa ng 1 batch: hal. 1 kg bigas → 2500 g sinaing = 2500')}<input id="pm-yq" type="number" step="any" value="${pxE(m.yieldQty || '')}" placeholder="2500" oninput="pxMenuKeep();pxCostBox()" style="width:100%;box-sizing:border-box;"></div><div>${pxLbl('Unit ng yield')}<select id="pm-yu" onchange="pxMenuKeep();pxMenuForm()" style="width:100%;">${[['g', 'gramo (g)'], ['ml', 'ml'], ['pc', 'piraso / portion']].map(([k, l]) => `<option value="${k}" ${m.yieldUnit === k ? 'selected' : ''}>${l}</option>`).join('')}</select></div></div>` : `<div style="display:grid;grid-template-columns:2fr 1fr 1fr;gap:.4rem;"><div>${pxLbl('Pangalan', 'Lalabas sa POS at sa slip.')}<input id="pm-name" placeholder="hal. Apple Juice" value="${pxE(m.name)}" style="width:100%;box-sizing:border-box;"></div><div>${pxLbl('Kategorya', 'Pang-grupo sa POS (Mains, Drinks...).')}<input id="pm-cat" placeholder="hal. Drinks" value="${pxE(m.category)}" style="width:100%;box-sizing:border-box;"></div><div>${pxLbl('Presyo (may VAT)', 'Halagang sisingilin sa customer.')}<input id="pm-price" type="number" step="0.01" placeholder="hal. 120" value="${pxE(m.price)}" style="width:100%;box-sizing:border-box;"></div></div>`}
  <label style="display:block;margin:.3rem 0;"><input type="checkbox" id="pm-vat" ${m.vat !== false ? 'checked' : ''}> <b>May VAT (VATable)</b> <small style="color:#64748b;">(alisin ang ✔ kung <b>Non-VAT</b> ang item na ito — hindi isasama sa VATable Sales / VAT Amount ng resibo; lalabas sa "Non-VAT Sales". Hal. ang ibang alak/inumin, at mga item na walang VAT.)</small></label>
  <label style="display:block;margin:.3rem 0;"><input type="checkbox" id="pm-act" ${m.active !== false ? 'checked' : ''}> Aktibo <small style="color:#64748b;">(alisin ang ✔ para itago sa POS nang hindi binubura)</small></label>
  ${m.batch ? '' : `
  <div style="border:1px solid #e2e8f0;border-radius:.4rem;padding:.4rem .5rem;margin:.3rem 0;"><b>🍱 Sub-item / Combo (set meal)</b> ${pxHint('📖 <b>Sub-item master:</b> lagyan ng ✔ ang "Sub-item lang" para sa mga item na hindi ibinebenta mag-isa (hal. Gyoza side, Miso Soup, Rice) — nasa master pa rin, pero wala sa POS grid. <b>Combo:</b> isingit sa ibaba ang mga sub-item (o kahit anong ibang menu item) na bumubuo sa set. Ang presyo ay ang presyo ng combo; kapag na-order, <b>lalabas ang bawat sub-item sa sarili nitong kitchen station</b>, at <b>ibababawas ang sangkap ng bawat sub-item</b> sa inventory. Kapag sold out ang isang sub-item, sold out din ang combo.')}
   <label style="display:block;"><input type="checkbox" id="pm-so" ${m.subOnly ? 'checked' : ''} ${(m.subs || []).length ? 'disabled' : ''}> 🧩 Sub-item lang (hindi ibinebenta mag-isa)</label>
   ${m.subOnly ? '' : `${(m.subs || []).map((s, i) => { const sm = PX.menu.find(x => x.id === s.id); return `<div style="display:flex;gap:.3rem;align-items:center;margin:.15rem 0;"><span style="flex:1;">${sm ? pxE(sm.name) + (sm.subOnly ? ' 🧩' : '') : '<b style="color:#dc2626;">(nabura na)</b>'}</span><input type="number" min="1" step="1" value="${+s.qty || 1}" onchange="pxSubSet(${i},this.value)" style="width:60px;"><button type="button" class="btn btn-secondary btn-sm" onclick="pxSubDel(${i})">✖</button></div>`; }).join('')}
   <div style="display:flex;gap:.3rem;margin-top:.2rem;"><select id="pm-sub-new" style="flex:1;min-width:0;"><option value="">➕ Isingit na sub-item…</option>${PX.menu.filter(x => !x.eventId && x.id !== m.id && !x.batch && !(x.subs || []).length && !(m.subs || []).some(s => s.id === x.id)).sort((a, b) => (b.subOnly ? 1 : 0) - (a.subOnly ? 1 : 0) || a.name.localeCompare(b.name)).map(x => `<option value="${pxE(x.id)}">${x.subOnly ? '🧩 ' : ''}${pxE(x.name)}</option>`).join('')}</select><button type="button" class="btn btn-primary btn-sm" onclick="pxSubAdd()">Idagdag</button></div>`}</div>
  <div style="border:1px solid #e2e8f0;border-radius:.4rem;padding:.4rem .5rem;margin:.3rem 0;"><b>🥡 Presyo bawat channel</b> ${pxHint('📖 Ang <b>Presyo</b> sa itaas ay para sa <b>Dine-in</b>. Dito ilagay ang ibang presyo para sa Take-out, Foodpanda at GrabFood. <b>Blangko = kapareho ng Dine-in</b> (para sa Take-out). <b>Para sa Foodpanda at GrabFood, ang item na may nilagay na presyo lang ang lalabas</b> sa POS ng channel na iyon. Lagyan ng ✔ ang "Hindi ibinebenta" kung hindi dapat lumabas ang item sa channel na iyon.')}
   <div style="display:flex;gap:.5rem;flex-wrap:wrap;">${['take', 'fp', 'grab'].map(k => `<div style="min-width:130px;"><small>${PX_CH[k].i} ${PX_CH[k].n}</small><br><input type="number" step="0.01" class="pm-cp" data-k="${k}" value="${pxE((m.chPrice || {})[k] || '')}" placeholder="= Dine-in" style="width:100%;box-sizing:border-box;"><label style="font-size:.75rem;"><input type="checkbox" class="pm-co" data-k="${k}" ${(m.chOff || {})[k] ? 'checked' : ''}> Hindi ibinebenta</label></div>`).join('')}</div></div>
  <div style="border:1px solid #e2e8f0;border-radius:.4rem;padding:.4rem .5rem;margin:.3rem 0;"><b>🍽️ Course</b> <select id="pm-crs">${[[1, '1 — Agad (default / appetizer)'], [2, '2 — Main (hold hanggang i-fire)'], [3, '3 — Dessert (hold hanggang i-fire)']].map(([k, l]) => `<option value="${k}" ${(+m.course || 1) === k ? 'selected' : ''}>${l}</option>`).join('')}</select> ${pxHint('📖 Ang Course 2 at 3 ay <b>hindi agad napi-print sa kusina</b>; naka-hold hanggang pindutin ang <b>🔥 Fire</b> sa table (hal. kapag tapos na ang appetizer).')}</div>
  <div style="border:1px solid #e2e8f0;border-radius:.4rem;padding:.4rem .5rem;margin:.3rem 0;"><b>🖨️ Kitchen station</b> ${pxHint('📖 Piliin kung <b>saang station</b> lalabas ang ticket ng item na ito kapag na-punch (puwedeng higit sa isa). Hal. Ramen → <b>Ramen</b>; Tempura Moriawase → <b>Tempura</b> + <b>Cold Kitchen</b>. Ang mga station ay dinadagdag sa <b>🖨️ Printers</b> tab. Kung walang piliin, mapupunta sa <b>default station</b> (kung meron).')}
   <div id="pm-stn" style="display:flex;flex-wrap:wrap;gap:.3rem;margin:.2rem 0;">${pxStns().length ? pxStns().map(s => `<label style="border:1px solid #cbd5e1;border-radius:1rem;padding:.15rem .6rem;cursor:pointer;font-size:.82rem;"><input type="checkbox" class="pm-sk" value="${pxE(s.key)}" ${(m.stations || []).includes(s.key) ? 'checked' : ''}> ${pxE(s.name)} <span style="font-size:.72rem;color:#64748b;">🕒</span><input type="time" class="pm-tf" data-k="${pxE(s.key)}" value="${pxE(((m.stWin || {})[s.key] || [])[0] || '')}" style="width:84px;font-size:.75rem;" title="Mula (blangko = buong araw)">–<input type="time" class="pm-tt" data-k="${pxE(s.key)}" value="${pxE(((m.stWin || {})[s.key] || [])[1] || '')}" style="width:84px;font-size:.75rem;" title="Hanggang"></label>`).join('') : '<small style="color:#b45309;">Wala pang station. Idagdag sa 🖨️ Printers tab.</small>'}</div>
   <div>${pxLbl('Pangalan sa kusina (optional)', 'Pang-print sa ticket ng kusina. Gamitin ang romaji/English (hal. "Tonkotsu Ramen") dahil karamihan ng printer ay hindi nakakapag-print ng Japanese. Kung blangko, gagamitin ang pangalan ng item.')}<input id="pm-kn" value="${pxE(m.kname || '')}" placeholder="hal. Tonkotsu Ramen" style="width:100%;box-sizing:border-box;"></div></div>
`}
  <b>${m.batch ? 'Sangkap (RAW mula SAP) na ginamit para sa 1 batch' : 'Sangkap na ibababawas sa inventory'}</b>
  ${pxHint('1️⃣ Hanapin sa box sa ibaba ang sangkap (galing sa SAP/inventory) — mag-type lang, hal. <b>apple</b>.<br>2️⃣ Ilagay ang <b>dami bawat 1 serving</b> at piliin kung paano sinusukat: <b>Buo/hati</b> (1 = isang buo, 0.5 = kalahati), <b>Gramo</b> (loose/hiwa), o <b>ml</b>.<br>3️⃣ Luto (hal. kanin)? piliin ang <b>Luto</b> at ilagay ang Yield. Piniga (juice)? piliin ang ml → <b>Piniga</b> at ilagay kung ilang ml ang nakukuha sa 1 kg/unit ng hilaw.<br>✅ Sa ilalim ng bawat sangkap makikita agad kung <b>gaano ang mababawas sa inventory</b>.')}
  ${pxPkInput('pxIngAdd', '', '', '🔎 Maghanap ng sangkap sa SAP — mag-type ng pangalan o code…')}
  ${pxBatchPicker()}
  <div id="pm-cost" style="margin:.4rem 0;"></div>
  <div id="pm-ings">${m.ings.length ? m.ings.map(pxIngCard).join('') : '<div style="margin:.4rem 0;color:#b45309;font-size:.82rem;">Wala pang sangkap. Gamitin ang search box sa itaas.</div>'}</div>
  <button class="btn btn-success" style="margin-top:.4rem;" onclick="pxMenuSave()">💾 I-save</button>`, 820);
  m.ings.forEach((g, i) => pxIngPv(i)); pxCostBox();
}
function pxMenuKeep() { const v = id => document.getElementById(id); if (!v('pm-name')) return; PX_ME.name = v('pm-name').value; if (v('pm-cat')) PX_ME.category = v('pm-cat').value; if (v('pm-price')) PX_ME.price = pxNum(v('pm-price').value); if (v('pm-yq')) { PX_ME.yieldQty = pxNum(v('pm-yq').value); PX_ME.yieldUnit = v('pm-yu').value; } PX_ME.active = v('pm-act').checked; PX_ME.stations = [...document.querySelectorAll('.pm-sk:checked')].map(x => x.value); PX_ME.stWin = {}; document.querySelectorAll('.pm-tf').forEach(x => { const to = (document.querySelector('.pm-tt[data-k="' + x.dataset.k + '"]') || {}).value || ''; if (x.value || to) PX_ME.stWin[x.dataset.k] = [x.value, to]; }); PX_ME.course = v('pm-crs') ? +v('pm-crs').value : (PX_ME.course || 1); PX_ME.kname = v('pm-kn') ? v('pm-kn').value.trim() : ''; if (v('pm-so')) PX_ME.subOnly = v('pm-so').checked; if (v('pm-vat')) PX_ME.vat = v('pm-vat').checked; PX_ME.chPrice = {}; PX_ME.chOff = {}; document.querySelectorAll('.pm-cp').forEach(x => { const n = pxNum(x.value); if (n > 0) PX_ME.chPrice[x.dataset.k] = n; }); document.querySelectorAll('.pm-co').forEach(x => { if (x.checked) PX_ME.chOff[x.dataset.k] = true; }); }
function pxSubAdd() { pxMenuKeep(); const e = document.getElementById('pm-sub-new'); if (!e || !e.value) return; PX_ME.subs = (PX_ME.subs || []).concat([{ id: e.value, qty: 1 }]); PX_ME.subOnly = false; pxMenuForm(); }
function pxSubDel(i) { pxMenuKeep(); PX_ME.subs.splice(i, 1); pxMenuForm(); }
function pxSubSet(i, v) { PX_ME.subs[i].qty = Math.max(1, Math.round(+v || 1)); }
async function pxMenuSave() {
  pxMenuKeep(); const m = PX_ME; if (!m.name.trim()) { pxAlert('Lagyan ng pangalan.'); return; } if (m.batch) { if (!(m.yieldQty > 0)) { pxAlert('Ilagay ang Yield — ilan ang nagawa ng 1 batch (hal. 2500 g).'); return; } } else if (!(m.price > 0)) { pxAlert('Lagyan ng presyo.'); return; }
  const ings = m.ings.filter(g => (g.code || g.batch) && g.qty > 0); if (m.batch && !ings.length) { pxAlert('Maglagay ng kahit isang raw na sangkap.'); return; } const bad = ings.filter(g => !g.batch).map(g => ({ g, w: pxIngWarn(g) })).find(x => x.w); if (bad) { pxAlert(bad.g.name + ': ' + bad.w); return; }
  const id = m.id || pxId('MN'); const d = { company: pxCo(), name: m.name.trim(), category: m.batch ? 'Batch Prep' : (m.category || 'Iba pa').trim(), price: m.batch ? 0 : m.price, vat: m.vat !== false, batch: !!m.batch, yieldQty: m.batch ? +m.yieldQty : 0, yieldUnit: m.batch ? (m.yieldUnit || 'g') : '', active: m.active, stations: m.stations || [], stWin: m.stWin || {}, course: +m.course || 1, kname: m.kname || '', chPrice: m.chPrice || {}, chOff: m.chOff || {}, subOnly: !!m.subOnly && !(m.subs || []).length, subs: m.subOnly ? [] : (m.subs || []).filter(s => s.id && +s.qty > 0).map(s => ({ id: s.id, qty: +s.qty })), ings, eventId: m.eventId || '', updatedBy: String(pxMe().email || ''), updatedAt: new Date().toISOString() };
  try { await db.collection('pos_menu').doc(id).set(d); const i = PX.menu.findIndex(x => x.id === id); if (i >= 0) PX.menu[i] = Object.assign({ id }, d); else PX.menu.push(Object.assign({ id }, d)); pxClose(); pxRender(); } catch (e) { pxAlert('Error: ' + e.message); }
}
async function pxMenuDel(id) { const used = PX.menu.filter(x => (x.ings || []).some(g => g.batch === id)); if (used.length) { await pxAlert('Ginagamit pa ang Batch Prep na ito ng: ' + used.map(x => x.name).join(', ') + '. Alisin muna sa mga menu item, o gawing Inactive.'); return; } if (!await pxConfirm('Burahin ang item na ito sa menu?')) return; try { await db.collection('pos_menu').doc(id).delete(); PX.menu = PX.menu.filter(m => m.id !== id); pxRender(); } catch (e) { pxAlert('Error: ' + e.message); } }

/* ================= EVENTS ================= */
async function pxEventsView() {
  return `<div style="display:flex;gap:.4rem;margin-bottom:.5rem;"><button class="btn btn-primary btn-sm" onclick="pxEventEdit('')">➕ Bagong Event</button><small style="color:#64748b;align-self:center;">Aktibo lang ang event sa pagitan ng petsa nito. Ang event-only na item ay hindi napupunta sa regular na menu.</small></div>
  <table class="table" style="font-size:.85rem;"><tr><th>Event</th><th>Lugar</th><th>Petsa</th><th>Menu</th><th>Benta</th><th></th></tr>${PX.events.map(e => `<tr><td><b>${pxE(e.name)}</b></td><td>${pxE(e.venue)}</td><td>${pxE(e.from)} → ${pxE(e.to)} ${pxEventLive(e) ? '<span class="badge badge-success">live</span>' : e.status === 'closed' ? '<span class="badge badge-secondary">closed</span>' : ''}</td><td>${PX.menu.filter(m => m.eventId === e.id).length} event-only</td><td><button class="btn btn-secondary btn-sm" onclick="pxEventReport('${e.id}')">📊</button></td><td><button class="btn btn-secondary btn-sm" onclick="pxEventEdit('${e.id}')">✏️</button> <button class="btn btn-secondary btn-sm" onclick="pxEventStock('${e.id}')">📦 Stock</button></td></tr>`).join('') || '<tr><td colspan="6"><small>Wala pang event.</small></td></tr>'}</table>`;
}
let PX_EV = null;
function pxEvAll(on) { document.querySelectorAll('.pe-row').forEach(r => { if (r.style.display !== 'none') { const c = r.querySelector('.pe-reg'); if (c) c.checked = on; } }); }
function pxEventEdit(id) {
  const e = id ? PX.events.find(x => x.id === id) : null; PX_EV = JSON.parse(JSON.stringify(e || { name: '', venue: '', from: pxToday(), to: pxToday(), status: 'open', regularIds: [], prices: {} })); PX_EV.id = id || '';
  const reg = PX.menu.filter(m => !m.eventId && !m.batch);
  pxModal(`<h3 style="margin-top:0;">${id ? 'I-edit' : 'Bagong'} Event</h3>
  ${pxHint('📖 Ang event ay may <b>pangalan, lugar, at petsa</b>. Sa pagitan lang ng mga petsang ito lalabas ang event sa POS ("Event mode"). Pagkatapos i-save, puwede kang gumawa ng <b>event-only na item</b> (sariling presyo, hindi napupunta sa regular na menu) at i-set ang <b>📦 Stock</b> (inilabas/naibalik).')}
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:.4rem;"><div>${pxLbl('Pangalan ng event', 'hal. Tanoshi Anniversary Dinner')}<input id="pe-name" value="${pxE(PX_EV.name)}" style="width:100%;box-sizing:border-box;"></div><div>${pxLbl('Lugar', 'hal. Ballroom, Soccer Field')}<input id="pe-venue" value="${pxE(PX_EV.venue)}" style="width:100%;box-sizing:border-box;"></div><div>${pxLbl('Mula (petsa)')}<input type="date" id="pe-from" value="${pxE(PX_EV.from)}"></div><div>${pxLbl('Hanggang (petsa)', 'Kapareho ng "Mula" kung isang araw lang.')}<input type="date" id="pe-to" value="${pxE(PX_EV.to)}"></div></div>
  <label><input type="checkbox" id="pe-closed" ${PX_EV.status === 'closed' ? 'checked' : ''}> Closed na <small style="color:#64748b;">(hindi na lalabas sa POS kahit nasa loob pa ng petsa)</small></label>
  <h4 style="margin:.6rem 0 .1rem;">Mula sa regular na menu</h4>
  ${pxHint('<b>✔ = ibebenta sa event.</b> Alisan ng ✔ ang hindi ibebenta. Kung lahat ay may ✔, buong regular na menu ang gagamitin. Sa kanan, kung maglalagay ka ng <b>presyo</b>, iyon ang sisingilin sa event; kung blangko, regular na presyo.')}
  <div style="display:flex;gap:.3rem;align-items:center;">${pxSearchBox('.pe-row', '🔎 Hanapin ang menu item…')}<button class="btn btn-secondary btn-sm" onclick="pxEvAll(true)" title="✔ lahat ng nakikita">✔ lahat</button><button class="btn btn-secondary btn-sm" onclick="pxEvAll(false)" title="Alisin ang ✔ sa nakikita">✖ wala</button></div>
  <div style="max-height:240px;overflow:auto;border:1px solid #e2e8f0;border-radius:.4rem;padding:.3rem;">${reg.map(m => { const on = !(PX_EV.regularIds || []).length || PX_EV.regularIds.includes(m.id); return `<div class="pe-row" data-s="${pxE(m.name + ' ' + (m.category || ''))}" style="display:flex;gap:.4rem;align-items:center;font-size:.82rem;"><input type="checkbox" class="pe-reg" value="${m.id}" ${on ? 'checked' : ''}><span style="flex:1;">${pxE(m.name)} <small>(${pxM(m.price)})</small></span><input type="number" step="0.01" placeholder="presyo sa event" value="${(PX_EV.prices || {})[m.id] != null ? PX_EV.prices[m.id] : ''}" class="pe-pr" data-id="${m.id}" style="width:120px;"></div>`; }).join('') || '<small>Walang regular na menu.</small>'}</div>
  <div style="margin-top:.5rem;display:flex;gap:.4rem;"><button class="btn btn-success" onclick="pxEventSave()">💾 I-save</button>${id ? `<button class="btn btn-primary btn-sm" onclick="pxClose();pxMenuEdit('','${id}')">➕ Event-only na item</button>` : '<small style="color:#64748b;">I-save muna para makagawa ng event-only na item.</small>'}</div>
  ${id ? '<h4 style="margin:.6rem 0 .2rem;">Event-only na item</h4>' + pxHint('Ito ay para lang sa event na ito. Hindi sila lalabas sa regular na menu.') + (PX.menu.filter(m => m.eventId === id).map(m => `<div style="font-size:.82rem;">${pxE(m.name)} — ${pxM(m.price)} <button class="btn btn-secondary btn-sm" onclick="pxMenuEdit('${m.id}')">✏️</button></div>`).join('') || '<small>Wala pa.</small>') : ''}`, 700);
}
async function pxEventSave() {
  const v = id => document.getElementById(id), e = PX_EV; e.name = v('pe-name').value.trim(); e.venue = v('pe-venue').value.trim(); e.from = v('pe-from').value; e.to = v('pe-to').value; e.status = v('pe-closed').checked ? 'closed' : 'open';
  if (!e.name || !e.from || !e.to || e.to < e.from) { pxAlert('Kumpletuhin ang pangalan at tamang petsa.'); return; }
  const all = [...document.querySelectorAll('.pe-reg')], ch = all.filter(x => x.checked).map(x => x.value); e.regularIds = ch.length === all.length ? [] : (ch.length ? ch : ['_none']); e.prices = {}; document.querySelectorAll('.pe-pr').forEach(x => { if (x.value !== '') e.prices[x.dataset.id] = pxNum(x.value); });
  const id = e.id || pxId('EV'); const d = { company: pxCo(), name: e.name, venue: e.venue, from: e.from, to: e.to, status: e.status, regularIds: e.regularIds, prices: e.prices, siteKeys: [PX.site], updatedBy: String(pxMe().email || '') };
  try { await db.collection('pos_events').doc(id).set(d, { merge: true }); const i = PX.events.findIndex(x => x.id === id); if (i >= 0) PX.events[i] = Object.assign({ id }, PX.events[i], d); else PX.events.unshift(Object.assign({ id }, d)); pxClose(); pxRender(); } catch (er) { pxAlert('Error: ' + er.message); }
}
let PX_ST = null;
async function pxEventStock(id) {
  const s = await db.collection('pos_event_stock').doc(id).get(), d = s.exists ? s.data() : { out: [], back: [] }, ideal = {};
  try { (await db.collection('pos_sales').where('eventId', '==', id).get()).forEach(x => { const q = x.data(); if (q.status === 'void') return; Object.keys(q.use || {}).forEach(k => { const u = q.use[k]; const o = ideal[k] = ideal[k] || { name: u.name || k, unit: u.unit || '', qty: 0 }; o.qty += +u.qty || 0; }); }); } catch (e) {}
  PX_ST = { id, out: d.out || [], back: d.back || [], ideal }; await pxSap(); pxStockForm();
}
function pxStAdd(k, s) { PX_ST[k].push({ code: s.code, name: s.name, qty: 0, unit: s.invUnit, d: pxToday(), note: '' }); pxStockForm(); }
function pxStSet(k, i, f, v) { const r = PX_ST[k][i]; if (!r) return; r[f] = f === 'qty' ? pxNum(v) : v; pxStSum(); }
function pxStSum() {
  const el = document.getElementById('ps-sum'); if (!el) return; const M = {};
  const put = (k, r) => { if (!r.code) return; const o = M[r.code] = M[r.code] || { name: r.name, unit: r.unit, out: 0, back: 0 }; o[k] += +r.qty || 0; };
  PX_ST.out.forEach(r => put('out', r)); PX_ST.back.forEach(r => put('back', r)); const I = PX_ST.ideal || {}, codes = Object.keys(M).sort((a, b) => M[a].name.localeCompare(M[b].name));
  Object.keys(I).forEach(c => { if (!M[c]) { M[c] = { name: I[c].name, unit: I[c].unit, out: 0, back: 0 }; codes.push(c); } });
  const f = n => +(+n).toFixed(4);
  el.innerHTML = codes.length ? codes.map(c => { const o = M[c], used = o.out - o.back, ideal = I[c] ? I[c].qty : null, diff = ideal == null ? null : used - ideal, warn = o.back > o.out; return `<tr class="ps-sm" data-s="${pxE(c + ' ' + o.name)}"><td>${pxE(o.name)} <small style="color:#64748b;">${pxE(c)}</small></td><td style="text-align:right;">${f(o.out)}</td><td style="text-align:right;">${f(o.back)}${warn ? ' <b style="color:#dc2626;" title="Mas marami ang naibalik kaysa inilabas">⚠</b>' : ''}</td><td style="text-align:right;"><b>${f(used)}</b> ${pxE(o.unit)}</td><td style="text-align:right;">${ideal == null ? '—' : f(ideal)}</td><td style="text-align:right;color:${diff == null ? '#64748b' : Math.abs(diff) < 0.01 ? '#166534' : '#b45309'};">${diff == null ? '—' : (diff > 0 ? '+' : '') + f(diff)}</td></tr>`; }).join('') : '<tr><td colspan="6"><small>Wala pang naitala.</small></td></tr>';
}
function pxStockForm() {
  const br = pxSite().name || 'branch', ev = PX.events.find(x => x.id === PX_ST.id) || {};
  const sec = (k, color, title, sub) => `<div style="border:2px solid ${color};border-radius:.5rem;padding:.5rem;margin:.6rem 0;"><b style="font-size:.95rem;">${title}</b>${pxHint(sub)}
    ${pxPkInput('pxStAdd', k, '', '➕ Maghanap ng item na idadagdag (code o pangalan)…')}
    ${PX_ST[k].length ? pxSearchBox('.ps-' + k, '🔎 Hanapin sa listahang ito…') + `<div style="overflow:auto;"><table class="table" style="font-size:.8rem;"><tr><th>Item</th><th>Petsa</th><th>Dami</th><th>Tala</th><th></th></tr>${PX_ST[k].map((r, i) => `<tr class="ps-${k}" data-s="${pxE(r.code + ' ' + r.name + ' ' + (r.note || ''))}"><td>${pxE(r.name)}<br><small style="color:#64748b;">${pxE(r.code)}</small></td><td><input type="date" value="${pxE(r.d || '')}" onchange="pxStSet('${k}',${i},'d',this.value)"></td><td style="white-space:nowrap;"><input type="number" step="any" min="0" value="${r.qty || ''}" oninput="pxStSet('${k}',${i},'qty',this.value)" style="width:90px;"> <b>${pxE(r.unit || '')}</b></td><td><input value="${pxE(r.note || '')}" placeholder="opsyonal" onchange="pxStSet('${k}',${i},'note',this.value)" style="width:130px;"></td><td><button class="btn btn-danger btn-sm" onclick="PX_ST['${k}'].splice(${i},1);pxStockForm()">✖</button></td></tr>`).join('')}</table></div>` : '<div style="font-size:.8rem;color:#64748b;">Wala pang naitala. Gamitin ang search sa itaas.</div>'}</div>`;
  pxModal(`<h3 style="margin-top:0;">📦 Stock ng Event — ${pxE(ev.name || '')}</h3>
  ${pxHint('📖 <b>Paano:</b> (1) I-record sa <b>📤 Inilabas</b> ang kinuha sa stock ng branch papunta sa event. (2) Pagkatapos ng event, i-record sa <b>📥 Naibalik</b> ang sobrang ibinalik sa branch. (3) Awtomatikong lalabas sa <b>🧮 Nagamit</b> ang <b>Inilabas − Naibalik</b>, katabi ng <b>dapat nagamit</b> base sa benta ng event para makita kung may diperensya.')}
  ${sec('out', '#2563eb', '📤 INILABAS — mula sa ' + pxE(br) + ' papunta sa event', 'Mga item at dami na <b>kinuha sa stock/store ng branch</b> at dinala sa event. Puwedeng maraming beses sa iba\'t ibang petsa (hal. dagdag na dala sa Day 2).')}
  ${sec('back', '#16a34a', '📥 NAIBALIK — mula sa event pabalik sa ' + pxE(br), 'Mga item at dami na <b>sobra at ibinalik</b> sa stock ng branch pagkatapos ng event. Hindi dapat mas marami sa inilabas.')}
  <div style="border:2px solid #7c3aed;border-radius:.5rem;padding:.5rem;margin:.6rem 0;"><b style="font-size:.95rem;">🧮 NAGAMIT — Inilabas − Naibalik</b>${pxHint('<b>Dapat nagamit</b> = kabuuang sangkap ng mga naibentang menu sa event (base sa Sangkap ng menu). <b>Diperensya</b> = Nagamit − Dapat. Positibo = mas marami ang nagamit kaysa sa benta (posibleng sayang/nawala); negatibo = kulang ang naitalang nagamit.')}${pxSearchBox('.ps-sm', '🔎 Hanapin ang item…')}<div style="overflow:auto;"><table class="table" style="font-size:.8rem;"><tr><th>Item</th><th style="text-align:right;">Inilabas</th><th style="text-align:right;">Naibalik</th><th style="text-align:right;">Nagamit</th><th style="text-align:right;">Dapat (benta)</th><th style="text-align:right;">Diperensya</th></tr><tbody id="ps-sum"></tbody></table></div></div>
  <button class="btn btn-success" onclick="pxStockSave()">💾 I-save ang stock</button>`, 860);
  pxStSum();
}
async function pxStockSave() { const cl = a => a.filter(r => r.code && +r.qty > 0).map(r => ({ code: r.code, name: r.name, qty: +r.qty, unit: r.unit || '', d: r.d || '', note: r.note || '' })); try { await db.collection('pos_event_stock').doc(PX_ST.id).set({ company: pxCo(), out: cl(PX_ST.out), back: cl(PX_ST.back), updatedBy: String(pxMe().email || ''), updatedAt: new Date().toISOString() }); pxClose(); pxToast('✅ Na-save ang stock'); } catch (e) { pxAlert('Error: ' + e.message); } }

function pxPrev() {
  const f = document.getElementById('su-prev'), cf = PX.cfg || PX_DEF; if (!f) return;
  const g = (id, fb) => { const e = document.getElementById(id); return e ? e.value : fb; }, ck = (id, fb) => { const e = document.getElementById(id); return e ? e.checked : fb; }, ai = pxInfo();
  const ov = Object.assign({}, cf, { _pv: true, header: g('su-head', cf.header) || '', footer: g('su-foot', cf.footer), paper: g('su-pap', cf.paper) || cf.paper, siPrefix: (g('su-sipre', cf.siPrefix || 'SI') || 'SI').toUpperCase(), devName: g('su-devn', cf.devName) || '', devContact: g('su-devc', cf.devContact) || '', devTag: g('su-devt', cf.devTag) || '', sc: { on: !!ck('su-sc', cf.sc.on), pct: pxNum(g('su-scp', cf.sc.pct)) || 10, show: !!ck('su-scs', cf.sc.show) } });
  const info = { legal: String(g('su-legal', ai.legal) || '').trim(), trade: String(g('su-trade', ai.trade) || '').trim(), address: String(g('su-addr', ai.address) || '').trim(), tin: String(g('su-tin', ai.tin) || '').trim(), vstat: g('su-vstat', ai.vstat) || 'VAT', contact: String(g('su-contact', ai.contact) || '').trim() };
  const items = [{ name: 'Salmon Don', price: 224, qty: 1 }, { name: 'Iced Tea', price: 80, qty: 2 }], gross = 384, due = gross, svc = ov.sc.on ? Math.round(due * ov.sc.pct) / 100 : 0;
  const s = { no: ov.siPrefix + '-' + String(+g('su-sinext', 1) || 1).padStart(+cf.siPad || 6, '0'), siteName: (pxSite().name || ''), atMs: Date.now(), cashier: 'Ana', items, gross, svc, svcShown: !!ov.sc.show, total: due + svc, pc: {}, disc: { type: 'none' }, pays: [{ mode: 'cash', amount: 500 }], change: Math.round((500 - due - svc) * 100) / 100, orNo: '', info };
  f.srcdoc = pxReceiptHtml(s, false, ov);
}

/* ================= BATCH PREP (sinaing, sauce, hiniwang isda…) + COSTING ================= */
const pxCostMap = () => { const o = {}; ((typeof PX_SAP !== 'undefined' && PX_SAP && PX_SAP.list) || []).forEach(x => { o[x.code] = x.cost || 0; }); return o; };
function pxIngCost(g, q, d) { q = q == null ? 1 : q; d = d || 0; if (g.batch) { const b = PX.menu.find(x => x.id === g.batch); if (!b || d > 4) return 0; return pxBatchUnitCost(b, d + 1) * (+g.qty || 0) * q; } return (pxCostMap()[g.code] || 0) * pxIngInv(g, q); }
const pxBatchCost = (b, d) => (b.ings || []).reduce((s, g) => s + pxIngCost(g, 1, (d || 0) + 1), 0);
const pxBatchUnitCost = (b, d) => +b.yieldQty > 0 ? pxBatchCost(b, d) / b.yieldQty : 0;
function pxBatchHas(b, id, seen) { seen = seen || {}; if (!b || seen[b.id]) return false; seen[b.id] = 1; return (b.ings || []).some(g => g.batch && (g.batch === id || pxBatchHas(PX.menu.find(x => x.id === g.batch), id, seen))); } // may bahagi ba ang b na batch id (iwas paikot)
function pxMenuCost(m) { return (m.ings || []).reduce((s, g) => s + pxIngCost(g, 1), 0) + (m.subs || []).reduce((s, x) => { const sm = PX.menu.find(y => y.id === x.id); return s + (sm ? pxMenuCost(Object.assign({}, sm, { subs: [] })) * (+x.qty || 1) : 0); }, 0); }
function pxNetPrice(p) { const v = PX.cfg && PX.cfg.vat; return v && v.on !== false ? p / (1 + (+v.pct || 12) / 100) : p; }
function pxCostTag(m) { const c = pxMenuCost(m); if (!(c > 0) || !(m.price > 0)) return ''; const fc = c / pxNetPrice(m.price) * 100; return '<br><small style="color:' + (fc > 40 ? '#b91c1c' : '#64748b') + ';">cost ₱' + pxM(c) + ' · FC ' + fc.toFixed(0) + '%</small>'; }
function pxMissingCost(list, out, d) { (list || []).forEach(g => { if (g.batch) { const b = PX.menu.find(x => x.id === g.batch); if (b && (d || 0) < 5) pxMissingCost(b.ings, out, (d || 0) + 1); } else if (g.code && g.qty > 0 && !(pxCostMap()[g.code] > 0)) out.push(g.name || g.code); }); return out; }
function pxCostBox() {
  const el = document.getElementById('pm-cost'), m = PX_ME; if (!el || !m) return; const miss = [...new Set(pxMissingCost(m.ings, []))], warn = miss.length ? '<br><small style="color:#b45309;">⚠ Walang presyo (Last Price) sa SAP: ' + pxE(miss.join(', ')) + ' — kulang ang kuwenta.</small>' : '';
  if (m.batch) { const c = pxBatchCost(m), u = +m.yieldQty > 0 ? c / m.yieldQty : 0; el.innerHTML = c > 0 ? `<div style="background:#eff6ff;border-radius:.4rem;padding:.35rem .5rem;font-size:.85rem;">💰 <b>Halaga ng 1 batch: ₱${pxM(c)}</b>${+m.yieldQty > 0 ? ` · ₱${+u.toFixed(4)} bawat ${pxE(m.yieldUnit || 'g')}${m.yieldUnit === 'g' || m.yieldUnit === 'ml' ? ' (₱' + pxM(u * 100) + ' bawat 100 ' + pxE(m.yieldUnit) + ')' : ''}` : ' · ilagay ang Yield para makuwenta ang bawat unit'}${warn}</div>` : '<small style="color:#64748b;">Ilagay ang mga sangkap at dami para makita ang halaga ng batch.</small>'; return; }
  const c = pxMenuCost(m); el.innerHTML = c > 0 ? `<div style="background:#eff6ff;border-radius:.4rem;padding:.35rem .5rem;font-size:.85rem;">💰 <b>Cost bawat serving: ₱${pxM(c)}</b>${m.price > 0 ? ` · Food cost <b>${(c / pxNetPrice(m.price) * 100).toFixed(1)}%</b> ng presyo (bago VAT) · Kita bawat serving ₱${pxM(pxNetPrice(m.price) - c)}` : ''}${warn}</div>` : '';
}
function pxBatchPicker() {
  const me = PX_ME || {}, L = PX.menu.filter(b => b.batch && b.active !== false && b.id !== me.id && !(me.batch && pxBatchHas(b, me.id))).sort((a, b) => a.name.localeCompare(b.name));
  return `<div style="display:flex;gap:.3rem;margin:.3rem 0;align-items:center;"><select id="pm-bsel" style="flex:1;min-width:0;"><option value="">${me.batch ? '🥣 Magsingit ng ibang Batch Prep bilang sangkap' : '🥣 Magsingit ng Batch Prep (sinaing, sauce, hiniwang isda…)'}</option>${L.map(b => `<option value="${pxE(b.id)}">${pxE(b.name)} — yield ${+b.yieldQty} ${pxE(b.yieldUnit || 'g')}</option>`).join('')}</select><button type="button" class="btn btn-primary btn-sm" onclick="pxBatchIngAdd()">Idagdag</button></div>${L.length ? '' : '<small style="color:#64748b;">Wala pang ibang Batch Prep na puwedeng isingit. Gumawa sa 🥣 Batch Prep tab.</small>'}`;
}
function pxBatchIngAdd() { pxMenuKeep(); const e = document.getElementById('pm-bsel'); if (!e || !e.value) return; const b = PX.menu.find(x => x.id === e.value); if (!b) return; PX_ME.ings.push({ batch: b.id, name: b.name, unit: b.yieldUnit || 'g', qty: 0 }); pxMenuForm(); }
function pxBatchIngCard(g, i) {
  const b = PX.menu.find(x => x.id === g.batch);
  return `<div style="border:1px solid #fcd34d;background:#fffbeb;border-radius:.5rem;padding:.45rem .55rem;margin:.35rem 0;"><div style="display:flex;justify-content:space-between;gap:.4rem;"><div>🥣 <b>${pxE(g.name)}</b> <small style="color:#92400e;">Batch Prep${b ? ' · yield ' + +b.yieldQty + ' ' + pxE(b.yieldUnit || 'g') : ' · <b style="color:#dc2626;">nabura na</b>'}</small></div><button class="btn btn-danger btn-sm" onclick="pxMenuKeep();PX_ME.ings.splice(${i},1);pxMenuForm()">✖</button></div>
  <div style="margin-top:.3rem;">${pxLbl(PX_ME && PX_ME.batch ? 'Dami na ginamit sa 1 BATCH' : 'Kukunin sa batch (bawat 1 serving)', PX_ME && PX_ME.batch ? 'hal. 500 g ng Sinaing sa 1 batch ng Sushi Rice' : 'hal. 800 g ng sinaing bawat order')}<input type="number" step="any" min="0" value="${g.qty || ''}" placeholder="hal. 800" onchange="pxIngSet(${i},'qty',this.value)" oninput="pxIngSet(${i},'qty',this.value)" style="width:100px;"> <b>${pxE((b && b.yieldUnit) || g.unit || 'g')}</b></div>
  <div id="pm-pv${i}" style="margin-top:.3rem;font-size:.8rem;background:#fef3c7;border-radius:.3rem;padding:.25rem .4rem;"></div></div>`;
}
function pxBatchPv(g, el) {
  const b = PX.menu.find(x => x.id === g.batch); if (!b) { el.innerHTML = '⚠ Wala na ang Batch Prep na ito.'; return; } if (!(g.qty > 0)) { el.innerHTML = '⌛ Ilagay ang dami na kukunin sa batch.'; return; } if (!(+b.yieldQty > 0)) { el.innerHTML = '⚠ Walang Yield ang batch.'; return; }
  const f = g.qty / b.yieldQty, lines = (b.ings || []).filter(x => x.code || x.batch).map(x => { if (x.batch) return '🥣 ' + pxE(x.name) + ' ' + +((+x.qty || 0) * f).toFixed(3) + ' ' + pxE(x.unit || ''); const q = pxIngInv(x, f); return +q.toFixed(5) + ' ' + pxE(x.invUnit || '') + ' ' + pxE(x.name); }), c = pxBatchUnitCost(b) * g.qty;
  el.innerHTML = '➡ Kada 1 benta: <b>' + (f * 100).toFixed(1) + '%</b> ng 1 batch → ibabawas: ' + lines.join(', ') + (c > 0 ? ' · 💰 ₱' + pxM(c) : '');
}
async function pxBatchView() {
  await pxSap(); const all = PX.menu.filter(m => m.batch), f = PX.bfil || 'all', isAct = m => m.active !== false, rows = all.filter(m => f === 'all' || (f === 'active') === isAct(m));
  return `<div style="display:flex;gap:.4rem;margin-bottom:.3rem;flex-wrap:wrap;align-items:center;"><button class="btn btn-primary btn-sm" onclick="pxMenuEdit('','',true)">➕ Bagong Batch Prep</button>${[['all', 'Lahat', all.length], ['active', '🟢 Active', all.filter(isAct).length], ['inactive', '⚪ Inactive', all.filter(m => !isAct(m)).length]].map(([k, l, n]) => `<button class="btn ${f === k ? 'btn-primary' : 'btn-secondary'} btn-sm" onclick="PX.bfil='${k}';pxBody()">${l} (${n})</button>`).join('')}</div>
  ${pxHint('📖 <b>Batch Prep master</b> ng company: mga sangkap na hinanda nang maramihan galing sa <b>SAP raw items</b> (hal. <b>Sinaing</b>: 1 kg bigas → 2,500 g; <b>Teriyaki Sauce</b>; <b>Hiniwang Salmon</b>). Puwede ring buuin ng <b>iba pang Batch Prep</b> (hal. <b>Sushi Rice</b> = Sinaing + Suka mix). Hindi ito ibinebenta mag-isa; isisingit ito bilang sangkap sa <b>📋 Menu</b> (hal. 800 g sinaing bawat order). Makukuwenta ang halaga ng batch, ang halaga bawat gramo/ml, at ang food cost ng menu item mula sa Last Price sa SAP.')}
  ${pxSearchBox('#pb-tb tr.pb-r', '🔎 Hanapin ang batch prep o sangkap')}
  <div style="overflow:auto;"><table class="table" id="pb-tb" style="font-size:.85rem;"><tr><th>Batch Prep</th><th style="text-align:right;">Yield</th><th>Raw na sangkap</th><th style="text-align:right;">Halaga / batch</th><th style="text-align:right;">Halaga bawat unit</th><th>Gamit sa menu</th><th></th></tr>${rows.map(m => { const c = pxBatchCost(m), used = PX.menu.filter(x => (x.ings || []).some(g => g.batch === m.id)); return `<tr class="pb-r" style="${isAct(m) ? '' : 'opacity:.55;'}" data-s="${pxE([m.name].concat((m.ings || []).map(g => g.name)).join(' '))}"><td><b>${pxE(m.name)}</b>${isAct(m) ? '' : ' <small style="background:#e2e8f0;border-radius:.6rem;padding:0 .4rem;">⚪ Inactive</small>'}${m.vat === false ? ' <small style="background:#fee2e2;border-radius:.6rem;padding:0 .4rem;">Non-VAT</small>' : ''}</td><td style="text-align:right;">${+m.yieldQty} ${pxE(m.yieldUnit || 'g')}</td><td><small>${pxE((m.ings || []).map(g => g.name + ' ' + g.qty + (g.unit || '')).join(', '))}</small></td><td style="text-align:right;">${c > 0 ? '₱' + pxM(c) : '<small style="color:#b45309;">walang presyo</small>'}</td><td style="text-align:right;">${c > 0 && m.yieldQty > 0 ? '₱' + +(c / m.yieldQty).toFixed(4) + '/' + pxE(m.yieldUnit || 'g') : ''}</td><td><small>${used.length ? pxE(used.map(x => x.name).join(', ')) : '—'}</small></td><td><button class="btn btn-secondary btn-sm" onclick="pxMenuEdit('${m.id}')">✏️</button> <button class="btn btn-danger btn-sm" onclick="pxMenuDel('${m.id}')">🗑️</button></td></tr>`; }).join('') || '<tr><td colspan="7"><small>Wala pang Batch Prep. Pindutin ang ➕ Bagong Batch Prep.</small></td></tr>'}</table></div>`;
}

/* ================= POS (cashier) ================= */
async function pxRosterNames() { try { const d = await db.collection('pos_roster').doc(PX.site).get(); return d.exists ? (d.data().list || []) : []; } catch (e) { return []; } }
async function pxPosView() {
  if (!pxCan()) return '<p>Walang access sa POS ang account na ito.</p>';
  if (pxShiftStale()) return `<div class="card" style="max-width:480px;border:2px solid #dc2626;"><h3 style="margin-top:0;">⛔ Hindi pa na-Z-read ang ${pxE(PX.shift.date)}</h3>${pxHint('📖 Bawat araw ay may sariling <b>Z-read</b> para hindi magpatong ang benta (ito ang ire-report sa mall). I-<b>Z-read</b> muna ang shift ni <b>' + pxE(PX.shift.cashier) + '</b> noong <b>' + pxE(PX.shift.date) + '</b> (kasama ang pag-settle ng lahat ng bukas na table) bago magbukas ng bagong araw.')}<button class="btn btn-warning" onclick="pxShiftClose()">🔒 I-Z-read ang ${pxE(PX.shift.date)}</button></div>`;
  if (!PX.shift && !(PX.ctx && PX.ctx.mode === 'order')) { const ro = await pxRosterNames(); return `<div class="card" style="max-width:440px;"><h3 style="margin-top:0;">🔴 Buksan ang araw — ${pxE(pxBiz())}</h3>${pxHint('📖 Bawat araw, kailangang <b>buksan</b> ang POS at ilagay ang <b>panimulang cash</b> sa drawer, at <b>i-Z-read</b> sa pagsara (hindi makakapagbukas ng bago kung hindi pa na-Z-read ang nakaraan). Ang <b>shift</b> ay isang duty ng cashier. <b>Cashier</b>: pangalan na lalabas sa slip (piliin sa roster o mag-type). <b>Panimulang cash</b>: perang nasa drawer bago magbenta, para ma-compute ang tamang kulang/sobra pagsara.')}<label>Cashier</label><br><input list="px-ro" id="px-cashier" value="${pxE(pxMe().name || '')}" style="width:100%;"><datalist id="px-ro">${ro.map(r => `<option value="${pxE(r.name)}">`).join('')}</datalist><br><label>Panimulang cash sa drawer</label><br><input type="number" id="px-open" value="" min="0" placeholder="hal. 2000 (ilagay ang 0 kung wala)" style="width:100%;"><br><button class="btn btn-success" style="margin-top:.5rem;" onclick="pxShiftOpen()">🟢 Buksan ang araw</button></div>`; }
  const items = pxMenuItems().filter(m => !m.subOnly), cats = [...new Set(items.map(m => m.category || 'Iba pa'))], q = PX.q.toLowerCase(); const list = items.filter(m => (!PX.cat || (m.category || 'Iba pa') === PX.cat) && (!q || m.name.toLowerCase().includes(q)));
  const C = pxCalc(PX.cart, PX.disc), paid = PX.pays.reduce((s, p) => s + p.amount, 0), bal = pxR2(C.total - paid);
  const cx = PX.ctx, bill = !!(cx && cx.mode === 'bill'), ord = !!(cx && cx.mode === 'order');
  let H = `<div style="display:grid;grid-template-columns:minmax(0,3fr) minmax(300px,2fr);gap:.8rem;align-items:start;">
  <div><div style="display:flex;gap:.3rem;flex-wrap:wrap;margin-bottom:.4rem;"><input type="search" placeholder="🔎 Hanapin" value="${pxE(PX.q)}" oninput="PX.q=this.value;pxGrid()" style="flex:1;min-width:120px;">${pxMgr() ? '<button class="btn btn-warning btn-sm" onclick="pxAvail()">🚫 Sold out / Availability</button>' : ''}<button class="btn ${PX.cat ? 'btn-secondary' : 'btn-primary'} btn-sm" onclick="PX.cat='';pxBody()">Lahat</button>${cats.map(c => `<button class="btn ${PX.cat === c ? 'btn-primary' : 'btn-secondary'} btn-sm" onclick="PX.cat=this.dataset.c;pxBody()" data-c="${pxE(c)}">${pxE(c)}</button>`).join('')}</div>
  <div id="px-grid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:.4rem;">${pxGridHtml(list)}</div></div>
  <div class="card" style="position:sticky;top:.5rem;"><b>🧾 Order</b>${PX.cart.length ? '' : '<div style="color:#94a3b8;padding:.6rem;">Pumili ng item sa kaliwa.</div>'}
  ${PX.cart.map((l, i) => `<div style="display:flex;gap:.3rem;align-items:center;border-bottom:1px solid #f1f5f9;padding:.2rem 0;font-size:.85rem;"><span style="flex:1;">${pxE(l.name)}<br><small>${pxM(l.price)}${l.ovr ? ' <b style="color:#b45309;">(binago · dati ' + pxM(l.orig) + ')</b>' : ''}</small> <a href="javascript:void(0)" title="Baguhin ang presyo" onclick="pxLineEdit(${i})">✏️</a> <a href="javascript:void(0)" title="Discount sa item" onclick="pxLineDisc(${i})">🏷️</a></span>${bill ? '<b>×' + (+(+l.qty).toFixed(3)) + '</b>' : `<button class="btn btn-secondary btn-sm" onclick="pxQty(${i},-1)">−</button><b>${l.qty}</b><button class="btn btn-secondary btn-sm" onclick="pxQty(${i},1)">+</button>`}<span style="width:64px;text-align:right;">${pxM(l.price * l.qty)}</span></div>`).join('')}
  <div style="margin-top:.4rem;"><div style="display:flex;gap:.3rem;flex-wrap:wrap;">${[['none', 'Walang discount'], ['senior', '👴 Senior 20%'], ['pwd', '♿ PWD 20%'], ['taxex', '🛂 Tax-Exempt'], ['comp', '🎁 Complimentary'], ['manual', '✂️ Manual %']].map(([k, l]) => `<button class="btn ${PX.disc.type === k ? 'btn-primary' : 'btn-secondary'} btn-sm" onclick="pxDisc('${k}')">${l}</button>`).join('')}</div>
  ${['senior', 'pwd', 'taxex'].includes(PX.disc.type) ? `<input placeholder="ID No." value="${pxE(PX.disc.id)}" onchange="PX.disc.id=this.value" style="width:49%;"> <input placeholder="Pangalan" value="${pxE(PX.disc.name)}" onchange="PX.disc.name=this.value" style="width:49%;">${PX.disc.type !== 'taxex' ? `<input type="number" placeholder="Halaga na sakop ng discount (blangko = lahat)" value="${pxE(PX.disc.elig)}" onchange="PX.disc.elig=this.value;pxBody()" style="width:100%;">` : ''}` : ''}
  ${PX.disc.type === 'manual' ? `<input type="number" placeholder="% discount" value="${pxE(PX.disc.pct)}" onchange="PX.disc.pct=this.value;pxBody()" style="width:30%;"> <input type="number" placeholder="₱ discount" value="${pxE(PX.disc.amt || '')}" onchange="PX.disc.amt=this.value;pxBody()" style="width:30%;"> <input placeholder="Dahilan" value="${pxE(PX.disc.name)}" onchange="PX.disc.name=this.value" style="width:48%;">` : ''}${PX.disc.type === 'comp' ? `<input placeholder="Dahilan / sino ang nag-approve" value="${pxE(PX.disc.name)}" onchange="PX.disc.name=this.value" style="width:100%;">` : ''}${PX.disc.type !== 'none' ? pxHint({ senior: '<b>Senior/PWD</b>: ilagay ang ID No. at pangalan. Kung hindi lahat ng order ay sa kanya, ilagay sa ibaba ang <b>halagang sakop</b> ng discount; blangko = buong bill.', pwd: '<b>Senior/PWD</b>: ilagay ang ID No. at pangalan. Kung hindi lahat ng order ay sa kanya, ilagay sa ibaba ang <b>halagang sakop</b>; blangko = buong bill.', taxex: '<b>Tax-Exempt</b>: tinatanggal ang VAT. Ilagay ang ID No. at pangalan ng card holder.', comp: '<b>Complimentary</b>: libre ang order. Isulat ang dahilan at kung sino ang nag-approve.', manual: '<b>Manual %</b>: ilagay ang % at dahilan. Kailangan ng Manager PIN.' }[PX.disc.type] || '') : ''}</div>
  <table style="width:100%;font-size:.85rem;margin-top:.4rem;"><tr><td>Subtotal</td><td style="text-align:right;">${pxM(C.gross)}</td></tr>${C.sc ? `<tr><td>Senior 20%</td><td style="text-align:right;">−${pxM(C.sc)}</td></tr>` : ''}${C.pwd ? `<tr><td>PWD 20%</td><td style="text-align:right;">−${pxM(C.pwd)}</td></tr>` : ''}${C.disc ? `<tr><td>Discount</td><td style="text-align:right;">−${pxM(C.disc)}</td></tr>` : ''}${C.comp ? `<tr><td>Complimentary</td><td style="text-align:right;">−${pxM(C.comp)}</td></tr>` : ''}${C.vat !== undefined && PX.disc.type === 'taxex' ? '<tr><td>VAT removed</td><td style="text-align:right;">✔</td></tr>' : ''}${C.svc ? `<tr><td>Service Charge ${PX.cfg.sc.pct}%${PX.cfg.sc.show ? '' : ' <small>(hidden)</small>'}</td><td style="text-align:right;">${pxM(C.svc)}</td></tr>` : ''}<tr style="font-size:1.15rem;font-weight:700;"><td>TOTAL</td><td style="text-align:right;">₱${pxM(C.total)}</td></tr></table>
  ${PX.pays.map((p, i) => `<div style="font-size:.82rem;display:flex;justify-content:space-between;"><span>${PX_MODES[p.mode].slice(0, 2)} ${pxPayLabel(p)}${p.ref ? ' <small>#' + pxE(p.ref) + '</small>' : ''}${p.payer ? '<br><small>👤 ' + pxE(p.payer) + '</small>' : ''}</span><span>${pxM(p.amount)} <a href="javascript:void(0)" onclick="PX.pays.splice(${i},1);pxBody()">✖</a></span></div>`).join('')}
  ${PX.member ? `<div style="font-size:.8rem;background:#f1f5f9;padding:.3rem;border-radius:.3rem;margin-top:.2rem;">🪪 ${pxE(PX.member.name)} · ${pxE(PX.member.mid)} · ${pxE(PX.member.club)} ${pxMemBadge(PX.members.find(x => x.id === PX.member.id) || PX.member)}${PX.member.parentMid ? '<br><small>👥 ' + pxE(PX.member.rel || 'Dependent') + ' ni <b>' + pxE(PX.member.parentName) + '</b> — sa principal ang singil</small>' : ''}${!pxMemActive(PX.members.find(x => x.id === PX.member.id) || PX.member) ? '<br><b style="color:#b91c1c;">⛔ ' + pxE(pxMemWhy(PX.members.find(x => x.id === PX.member.id) || PX.member) || 'INACTIVE') + ' — hindi makakapag-settle ng Member Charge.</b>' : ''}</div>` : ''}
  <div style="display:flex;gap:.3rem;margin-top:.4rem;flex-wrap:wrap;"><button class="btn btn-secondary" style="padding:.7rem;" onclick="pxBillPrintNow()" ${PX.cart.length ? '' : 'disabled'}>🖨️ Print Bill${PX.billSig && PX.billSig === pxBillSig() ? ' ✔' : ''}</button><button class="btn btn-primary" style="flex:1;padding:.7rem;" onclick="pxPayStart()" ${PX.cart.length ? '' : 'disabled'}>💳 Magbayad</button><button class="btn btn-secondary" onclick="pxMemCheck()">🪪 Check Membership</button></div>${pxHint('📖 Pindutin muna ang <b>🖨️ Print Bill</b> para makita ng customer ang total. Kung may <b>discount</b> (Senior/PWD/manual) o <b>binagong presyo</b> (✏️), <b>kailangang i-print muli ang bill bago mag-settle</b>. Pagkatapos, pindutin ang <b>💳 Magbayad</b> at piliin ang paraan: Cash, GCash, Maya, QR Ph, Debit/Credit/International card, PayPal, Bank transfer, o Membership/Organizer charge. Para sa card at e-wallet, ilalagay ang <b>reference number</b> (at pangalan kung gusto). Puwedeng hati-hati ang bayad. Pindutin ang <b>🪪 Check Membership</b> para makita kung ACTIVE ang member.')}
  <div style="font-size:.85rem;margin-top:.2rem;">${bal > 0 ? 'Kulang: <b style="color:#dc2626;">' + pxM(bal) + '</b>' : 'Sukli: <b style="color:#16a34a;">' + pxM(pxChange(C)) + '</b>'}</div>
  <div style="display:flex;gap:.3rem;margin-top:.5rem;"><button class="btn btn-success" style="flex:1;" onclick="pxCheckout()" ${PX.cart.length ? '' : 'disabled'}>✅ I-charge / I-print</button>${bill ? '' : '<button class="btn btn-secondary" onclick="pxClearCart()">Clear</button>'}</div></div></div>`;
  H = H.replace('<b>🧾 Order</b>', '<b>🧾 Order</b> ' + pxMgrBtn());
  if (!bill && !ord) H = H.replace('<b>🧾 Order</b>', '<b>🧾 Order</b>' + pxChanBar());
  if (bill) H = H.replace(/^<div style="display:grid[^>]*>\s*<div>[\s\S]*?(<div class="card" style="position:sticky;top:\.5rem;"><b>🧾 Order<\/b>)/, m => '<div style="display:grid;grid-template-columns:minmax(0,3fr) minmax(300px,2fr);gap:.8rem;align-items:start;">' + pxBillPane() + '<div class="card" style="position:sticky;top:.5rem;"><b>🧾 Bill</b>');
  if (ord) H = H.replace(/<div class="card" style="position:sticky;top:\.5rem;"><b>🧾 Order<\/b>[\s\S]*$/, pxOrderPane() + '</div>');
  return H;
}
function pxChanBar() {
  const ch = pxChan(), c = PX_CH[ch], comm = +((PX.cfg.chComm || {})[ch]) || 0;
  return `<div style="margin:.3rem 0;"><div style="display:flex;gap:.25rem;flex-wrap:wrap;">${Object.keys(PX_CH).map(k => `<button class="btn ${k === ch ? 'btn-primary' : 'btn-secondary'} btn-sm" onclick="pxSetChan('${k}')">${PX_CH[k].i} ${PX_CH[k].n}</button>`).join('')}</div>
  ${pxHint('📖 <b>Dine-in</b> = kakain dito (may Service Charge). <b>Take-out</b> = bibitbitin. <b>Foodpanda / GrabFood</b> = order mula sa app: ginagamit ang presyo ng channel na iyon, walang Service Charge, at ang bayad ay <b>receivable</b> mula sa app (ima-mark mong bayad sa Benta → 🐼 Delivery receivables kapag pumasok na ang payout). Para sa mga table, gamitin ang 🍽️ Tables tab.')}
  ${c.app ? `<input placeholder="Order No. ng ${c.n} (kailangan)" value="${pxE(PX.chanRef)}" onchange="PX.chanRef=this.value.trim()" style="width:100%;box-sizing:border-box;margin-top:.2rem;">${comm ? '<small style="color:#64748b;">Commission ' + comm + '% (tinatayang ibabawas ng ' + c.n + ')</small>' : '<small style="color:#b45309;">Wala pang commission % — ilagay sa Setup.</small>'}` : ''}</div>`;
}
function pxSetChan(k) {
  if (PX.ctx || !PX_CH[k] || k === PX.chan) return; PX.chan = k; PX.pays = []; PX.chanRef = ''; const gone = [], L = pxMenuItems();
  PX.cart = PX.cart.filter(l => { const m = L.find(x => x.id === l.id); if (!m) { gone.push(l.name); return false; } l.price = m._price; return true; });
  pxBody(); if (gone.length) pxAlert('Hindi ibinebenta sa ' + PX_CH[k].n + ' kaya inalis sa order: ' + gone.join(', ') + '.', 'ℹ️ Inalis ang item');
}
async function pxClearCart() { if (PX.cart.length && !await pxConfirm('I-clear ang order?', { danger: true, ok: 'I-clear' })) return; PX.cart = []; pxResetPay(); pxBody(); }
function pxGridHtml(list) { return list.map(m => pxIsOff(m.id) ? `<button class="btn btn-secondary" style="text-align:left;white-space:normal;padding:.5rem;line-height:1.2;opacity:.55;background:#fee2e2;" onclick="pxAdd('${m.id}')"><b style="font-size:.85rem;text-decoration:line-through;">${pxE(m.name)}</b><br><span style="color:#b91c1c;font-weight:700;">🚫 SOLD OUT</span></button>` : `<button class="btn btn-secondary" style="text-align:left;white-space:normal;padding:.5rem;line-height:1.2;" onclick="pxAdd('${m.id}')"><b style="font-size:.85rem;">${pxE(m.name)}</b><br><span style="color:#16a34a;">₱${pxM(m._price)}</span></button>`).join('') || '<div style="color:#94a3b8;">Walang item. (Admin: Menu tab → Bagong item)</div>'; }
function pxGrid() { const g = document.getElementById('px-grid'); if (!g) return; const q = PX.q.toLowerCase(); g.innerHTML = pxGridHtml(pxMenuItems().filter(m => !m.subOnly && (!PX.cat || (m.category || 'Iba pa') === PX.cat) && (!q || m.name.toLowerCase().includes(q)))); }
function pxAdd(id) { const m = pxMenuItems().find(x => x.id === id); if (!m) return; if (pxIsOff(id)) { pxAlert(m.name + ' ay SOLD OUT / hindi na magagawa ng kusina ngayon.', '🚫 Hindi available'); return; } const l = PX.cart.find(x => x.id === id); if (l) l.qty++; else PX.cart.push({ id, name: m.name, price: m._price, qty: 1, ings: m.ings || [], course: +m.course || 1 }); PX.pays = []; pxBody(); }
async function pxLineEdit(i) { // baguhin ang presyo on the spot (kailangan ng Manager PIN)
  const l = PX.cart[i]; if (!l) return; if (!await pxPin('Kailangan ng PIN para baguhin ang presyo ng item.')) return;
  const v = await pxPrompt('✏️ Bagong presyo — ' + l.name, { type: 'number', label: 'Presyo bawat isa (may VAT)', hint: 'Dating presyo: ₱' + pxM(l.ovr ? l.orig : l.price) + '. Ang binagong presyo ay makikita sa resibo at sa record ng benta.', ok: 'I-apply' }); if (v === null) return; const p = pxNum(v); if (!(p >= 0) || v === '') { await pxAlert('Maglagay ng tamang presyo.'); return; }
  if (!l.ovr) l.orig = l.price; l.price = p; l.ovr = p !== l.orig; if (!l.ovr) delete l.orig; PX.pays = []; pxBody();
}
function pxQty(i, d) { PX.cart[i].qty += d; if (PX.cart[i].qty <= 0) PX.cart.splice(i, 1); PX.pays = []; pxBody(); }
async function pxDisc(t) { if (t !== 'none' && PX.disc.type !== t && !await pxPin('Kailangan ng code ng Manager para sa discount.')) return; PX.disc = { type: t, elig: '', pct: '', amt: '', id: '', name: '' }; PX.pays = []; pxBody(); }
function pxChange(C) { const cash = PX.pays.filter(p => p.mode === 'cash').reduce((s, p) => s + p.amount, 0), other = PX.pays.filter(p => p.mode !== 'cash').reduce((s, p) => s + p.amount, 0); return Math.max(0, pxR2(cash - Math.max(0, C.total - other))); }
async function pxAddPay() { return pxPayStart(); }
/* ---------- Member picker ---------- */
function pxMemberPick(amt) {
  PX_MP = amt; pxModal(`<h3 style="margin-top:0;">🪪 Member</h3>${pxHint('📖 I-type ang <b>ID number o pangalan</b> ng member. Kung walang lumabas, puwede siyang idagdag sa ibaba (➕ Bagong member).')}<input id="mp-q" placeholder="I-type ang ID number o pangalan..." oninput="pxMpList()" style="width:100%;" autofocus><div id="mp-list" style="margin-top:.4rem;"></div><div id="mp-new" style="margin-top:.5rem;"></div>`, 520); pxMpList();
}
let PX_MP = 0;
function pxMpList() {
  const raw = String((document.getElementById('mp-q') || {}).value || '').trim(), q = raw.toLowerCase(), box = document.getElementById('mp-list'); if (!box) return;
  const r = q ? PX.members.filter(m => String(m.mid).toLowerCase().includes(q) || String(m.name).toLowerCase().includes(q)).slice(0, 8) : [];
  box.innerHTML = r.map(m => `<div onclick="pxMpSel('${m.id}')" style="padding:.45rem;border:1px solid #e2e8f0;border-radius:.4rem;margin-bottom:.2rem;cursor:pointer;"><b>${pxE(m.name)}</b> · ${pxE(m.mid)} <small>${pxE(m.club)}</small> ${pxMemBadge(m)}</div>`).join('') || (q ? '<small style="color:#94a3b8;">Walang tugma.</small>' : '');
  const exact = PX.members.some(m => String(m.mid).toLowerCase() === q);
  document.getElementById('mp-new').innerHTML = q && !exact ? `<div style="border-top:1px solid #e2e8f0;padding-top:.5rem;"><b>➕ Bagong member</b>${pxHint('<b>ID No.</b> = nasa membership card. <b>Club</b> = kung saang club siya miyembro (doon sisingilin ang buwanang charge). Hindi puwedeng magkapareho ang ID sa iisang company.')}<div style="display:grid;grid-template-columns:1fr 1fr;gap:.3rem;margin-top:.2rem;"><input id="mn-id" placeholder="ID No." value="${pxE(raw)}"><input id="mn-name" placeholder="Pangalan"><select id="mn-club" style="grid-column:1/3;"><option value="">— Club —</option>${PX.clubs.map(c => `<option value="${pxE(c.name)}">${pxE(c.name)}</option>`).join('')}<option value="__new">➕ Bagong club...</option></select></div><button class="btn btn-success btn-sm" style="margin-top:.3rem;" onclick="pxMemberNew()">I-save at gamitin</button></div>` : '';
}
async function pxMpSel(id) { const m = PX.members.find(x => x.id === id); PX.member = pxMemSnap(m); pxClose(); if (!pxMemActive(m)) { pxBody(); await pxAlert(pxMemWhy(m) + ' (' + m.mid + ').\n\nHindi makakapag-settle ng Member Charge. Pumili ng ibang member o ibang paraan ng bayad.', '⛔ Inactive ang membership'); return; } const C = pxCalc(PX.cart, PX.disc), bal = pxR2(C.total - PX.pays.reduce((s, p) => s + p.amount, 0)); PX.pays.push({ mode: 'member', amount: pxR2(Math.min(PX_MP || bal, bal > 0 ? bal : PX_MP)), ref: '' }); pxBody(); }
async function pxMemberNew() {
  const v = id => document.getElementById(id), mid = v('mn-id').value.trim(), name = v('mn-name').value.trim(); let club = v('mn-club').value;
  if (!mid || !name) { pxAlert('Ilagay ang ID at pangalan.'); return; } if (PX.members.some(m => String(m.mid).toLowerCase() === mid.toLowerCase())) { pxAlert('May member na gumagamit ng ID na iyan.'); return; }
  if (club === '__new') { club = String(await pxPrompt('Pangalan ng bagong club', { hint: 'Ang club ang magsisingil sa mga member at kukuha ng % ng benta.', ph: 'hal. Alabang Sports Club', ok: 'Idagdag' }) || '').trim(); if (!club) return; await pxClubEnsure(club); }
  const cl = PX.clubs.find(c => c.name === club) || {}, id = pxSlug(pxCo()) + '__' + pxSlug(mid); const d = { company: pxCo(), mid, name, club, clubId: cl.id || '', regDate: pxToday(), addedBy: String(pxMe().email || ''), addedAt: new Date().toISOString() };
  try { await db.collection('pos_members').doc(id).set(d); PX.members.push(Object.assign({ id }, d)); pxMpSel(id); } catch (e) { pxAlert('Error: ' + e.message); }
}
async function pxClubEnsure(name) { const id = pxSlug(pxCo()) + '__' + pxSlug(name); if (PX.clubs.find(c => c.id === id)) return; const d = { company: pxCo(), name, pct: 0 }; await db.collection('pos_clubs').doc(id).set(d); PX.clubs.push(Object.assign({ id }, d)); }
/* ---------- Pirma sa screen ---------- */
function pxSignPad() {
  return new Promise(res => {
    pxModal(`<h3 style="margin-top:0;">✍️ Pirma ng Customer</h3><canvas id="sg-c" width="520" height="190" style="border:2px dashed #94a3b8;border-radius:.5rem;width:100%;touch-action:none;background:#fff;"></canvas><div style="margin-top:.4rem;"><button class="btn btn-secondary btn-sm" id="sg-clr">Burahin</button> <button class="btn btn-success" id="sg-ok">✅ Tapos na</button></div>`, 600);
    const c = document.getElementById('sg-c'), g = c.getContext('2d'); g.lineWidth = 2.4; g.lineCap = 'round'; g.strokeStyle = '#0f172a'; let on = false, any = false;
    const pt = e => { const r = c.getBoundingClientRect(); return [(e.clientX - r.left) * c.width / r.width, (e.clientY - r.top) * c.height / r.height]; };
    c.onpointerdown = e => { on = true; any = true; const [x, y] = pt(e); g.beginPath(); g.moveTo(x, y); c.setPointerCapture(e.pointerId); }; c.onpointermove = e => { if (!on) return; const [x, y] = pt(e); g.lineTo(x, y); g.stroke(); }; c.onpointerup = () => { on = false; };
    document.getElementById('sg-clr').onclick = () => { g.clearRect(0, 0, c.width, c.height); any = false; }; document.getElementById('sg-ok').onclick = () => { if (!any) { pxAlert('Pumirma muna.'); return; } const o = document.createElement('canvas'); o.width = 360; o.height = 130; const og = o.getContext('2d'); og.fillStyle = '#fff'; og.fillRect(0, 0, 360, 130); og.drawImage(c, 0, 0, 360, 130); const url = o.toDataURL('image/jpeg', 0.6); pxClose(); res(url); };
  });
}
/* ---------- Checkout ---------- */
async function pxCheckout() {
  if (PX.cart.length && pxNeedBill()) { await pxAlert('Hindi pa naipi-print ang bill, o may binago pagkatapos ma-print. Pindutin ang 🖨️ Print Bill bago mag-settle.', '🖨️ Print Bill muna'); return; }
  if (!(PX.ctx && PX.ctx.mode === 'bill') && !await pxCutGuard('counter sale')) return;
  if (!PX.shift) { pxAlert('Buksan muna ang shift.'); return; } if (pxShiftStale()) { pxAlert('Hindi pa na-Z-read ang ' + PX.shift.date + '. I-Z-read muna bago magbenta.'); return; } const C = pxCalc(PX.cart, PX.disc), D = PX.disc; if (!PX.cart.length) return;
  if (['senior', 'pwd', 'taxex'].includes(D.type) && (!D.id.trim() || !D.name.trim())) { pxAlert('Ilagay ang ID No. at pangalan para sa discount.'); return; }
  if (D.type === 'comp' && !D.name.trim()) { pxAlert('Ilagay ang dahilan ng complimentary.'); return; } if (D.type === 'manual' && !(pxNum(D.pct) > 0 || pxNum(D.amt) > 0)) { pxAlert('Ilagay ang % ng discount.'); return; }
  const paid = pxR2(PX.pays.reduce((s, p) => s + p.amount, 0)); if (C.total > 0 && paid < C.total - 0.001) { pxAlert('Kulang pa ang bayad.'); return; }
  if (pxApp() && !PX.chanRef) { await pxAlert('Ilagay ang Order No. ng ' + PX_CH[pxChan()].n + ' sa itaas ng order.'); return; } const memPay = PX.pays.some(p => p.mode === 'member'); if (memPay && !PX.member) { pxAlert('Pumili ng member.'); return; } if (memPay && PX.member && !pxMemActive(PX.members.find(x => x.id === PX.member.id) || PX.member)) { await pxAlert((pxMemWhy(PX.members.find(x => x.id === PX.member.id) || PX.member) || PX.member.name + ' ay INACTIVE ang membership') + ' — hindi makakapag-settle ng Member Charge. Alisin ang member charge at gumamit ng ibang bayad.', '⛔ Inactive ang membership'); return; }
  const need = PX.cfg.sigMode === 'always' || (PX.cfg.sigMode !== 'never' && (memPay || PX.pays.some(p => p.mode === 'org'))); let sig = ''; if (need) { sig = await pxSignPad(); }
  const now = new Date(), date = pxBiz(now.getTime()), ev = pxEv(), s = pxSite(), use = {}; PX.cart.forEach(l => { const u = pxUseOf(l, l.qty); Object.keys(u).forEach(k => { use[k] = use[k] ? Object.assign(use[k], { qty: +(use[k].qty + u[k].qty).toFixed(6) }) : u[k]; }); });
  const pre = (PX.cfg.siPrefix || 'SI').toUpperCase(), pad = +PX.cfg.siPad || 6, inf = pxInfo(); let no = '', siN = 0; try { const cr = db.collection('pos_counters').doc(PX.site + '__SI'); siN = await db.runTransaction(async tx => { const d = await tx.get(cr), v = (d.exists ? +d.data().n : Math.max(0, (+inf.siNext || 1) - 1)) + 1; tx.set(cr, { n: v, site: PX.site }); return v; }); no = pre + '-' + String(siN).padStart(pad, '0'); } catch (e) { no = pre + '-T' + Date.now().toString(36).toUpperCase(); }
  const chg = pxChange(C), memAmt = PX.pays.filter(p => p.mode === 'member').reduce((x, p) => x + p.amount, 0);
  const vps = PX.pays.filter(p => p.mode === 'voucher'); if (vps.length) { if (D.type !== 'none') { pxAlert('Hindi puwede ang voucher sa order na may discount.'); return; } if (!await pxVchConsume(vps, no, C.total)) return; }
  const gps = PX.pays.filter(p => p.mode === 'giftcard' || p.mode === 'points'); if (gps.length) { if (!await pxGcConsume(gps, no)) { if (vps.length) { try { await pxVchRelease({ no, pays: vps }); } catch (x) {} } return; } }
  const sale = { no, siNo: siN, info: { legal: inf.legal || '', trade: inf.trade || s.name || '', address: inf.address || '', tin: inf.tin || '', vstat: inf.vstat || 'VAT', contact: inf.contact || '' }, company: pxCo(), site: PX.site, siteName: s.name || '', branch: String(pxMe().branch || s.name || ''), eventId: PX.event || '', eventName: ev ? ev.name : '', date, at: now.toISOString(), atMs: now.getTime(), cashier: PX.shift.cashier, cashierEmail: String(pxMe().email || ''), shiftId: PX.shift.id, status: 'paid',
    items: PX.cart.map(l => Object.assign({ id: l.id, name: l.name, price: l.price, qty: l.qty }, l.ch ? { ch: l.ch } : {}, l.ovr ? { ovr: true, orig: l.orig } : {})), use, gross: C.gross, due: C.due, svc: C.svc, svcShown: !!PX.cfg.sc.show, total: C.total, pc: { nvat: C.nvat || 0, vat: C.vatable, exm: C.exempt, sc: C.sc, pwd: C.pwd, disc: C.disc, comp: C.comp, svc: C.svc }, vatAmt: C.vat,
    disc: { type: D.type, label: C.label, id: D.id || '', name: D.name || '', pct: pxNum(D.pct) }, pays: PX.pays.slice(), change: chg, memberKey: PX.member ? PX.member.id : '', billKey: PX.member ? (PX.member.parentId || PX.member.id) : '', member: PX.member || null, clubId: PX.member ? PX.member.clubId : '', memberCharge: pxR2(memAmt), chargeStatus: memAmt > 0 ? 'billed' : '', sig, orNo: '' };
  { const ch = pxChan(), cm = PX_CH[ch].app ? +((PX.cfg.chComm || {})[ch]) || 0 : 0; Object.assign(sale, { channel: ch, chName: PX_CH[ch].n, platRef: PX_CH[ch].app ? PX.chanRef : '' }); if (PX_CH[ch].app) Object.assign(sale, { commPct: cm, commAmt: pxR2(C.total * cm / 100), platStatus: 'receivable' }); }
  if (PX.ctx && PX.ctx.mode === 'bill') { const tb = pxCtxTab() || {}; Object.assign(sale, { tabId: tb.id || '', tableName: tb.tableName || '', zone: tb.zone || '', pax: tb.pax || 0, billNo: PX.ctx.billNo, billCount: PX.ctx.billCount, tableMember: tb.member || null }); }
  try { let ref; try { ref = await db.collection('pos_sales').add(sale); } catch (e) { if (vps.length) { try { await pxVchRelease(sale); } catch (x) {} } if (gps.length) { try { await pxGcRelease(sale); } catch (x) {} } throw e; }
    try { await pxLoyEarn(sale); } catch (x) {} sale.id = ref.id; PX.last = sale; PX.cart = []; pxResetPay(); pxToast('✅ ' + no); pxPrintReceipt(sale); if (!PX.ctx && PX.cfg.kitchenCounter !== false) pxKitchenSend({ type: 'counter', ref: sale.platRef || no, chan: sale.chName, items: sale.items }).then(r => { if (r.lost && r.lost.length) pxPrint(pxJobsHtml([{ stationName: 'KITCHEN', ticket: { type: 'counter', chan: sale.chName, ref: sale.platRef || no, at: new Date().toISOString(), items: r.lost.map(l => ({ qty: l.qty, name: l.name, note: l.note || '' })) } }])); }); if (PX.ctx && PX.ctx.mode === 'bill') await pxBillDone(sale); else pxBody(); } catch (e) { pxAlert('Hindi na-save ang benta: ' + e.message); }
}
/* ---------- Resibo / Order Slip ---------- */
function pxReceiptHtml(s, reprint, ov) {
  s = pxPrivSale(s);
  const c = ov || PX.cfg || PX_DEF, pv = !!(ov && ov._pv), inf0 = s.info || pxInfo(), inf = pv ? { legal: inf0.legal || '(Pangalan ng company)', trade: inf0.trade || '(Branch)', address: inf0.address || '(Address ng branch)', tin: inf0.tin || '000-000-000-00000', vstat: inf0.vstat || 'VAT', contact: inf0.contact || '(Contact ng branch)' } : inf0, w = c.paper === '58' ? '54mm' : '76mm', row = (a, b, bold) => `<tr style="${bold ? 'font-weight:700;' : ''}"><td>${a}</td><td style="text-align:right;">${b}</td></tr>`;
  const nonV = inf.vstat === 'NON-VAT' || (c.vat && c.vat.on === false), pcx = s.pc || {}, vp = (c.vat && +c.vat.pct) || 12;
  const vatBlock = `<hr><table style="font-size:11px;">${row('VATable Sales', nonV ? '0.00' : pxM(pcx.vat || 0))}${row('Non-VAT Sales', pxM(pcx.nvat || 0))}${row('VAT-Exempt Sales', pxM(pcx.exm || 0))}${row('Zero-Rated Sales', '0.00')}${row('VAT Amount (' + vp + '%)', nonV ? '0.00' : pxM(s.vatAmt || 0))}</table>`;
  const modes = (s.pays || []).map(p => row(pxPayLabel(p), pxM(p.amount)) + (p.ref ? `<tr><td colspan="2" style="font-size:11px;">&nbsp;&nbsp;Ref: ${pxE(p.ref)}${p.payer ? ' · ' + pxE(p.payer) : ''}</td></tr>` : p.payer ? `<tr><td colspan="2" style="font-size:11px;">&nbsp;&nbsp;${pxE(p.payer)}</td></tr>` : '')).join('');
  return `<html><head><meta charset="utf-8"><title>${pxE(s.no)}</title><style>@page{margin:2mm}body{font-family:monospace;font-size:12px;width:${w};margin:0 auto;color:#000}table{width:100%;border-collapse:collapse}td{padding:1px 0;vertical-align:top}hr{border:0;border-top:1px dashed #000;margin:4px 0}.c{text-align:center}.sg{border-bottom:1px solid #000;height:46px;margin-top:6px}</style></head><body>
  <div class="c"><b>${pxE(inf.legal || (c.header || '').split('\n')[0] || s.siteName)}</b><br>${inf.trade && inf.trade !== inf.legal ? pxE(inf.trade) + '<br>' : ''}${pxE(inf.address || '')}${inf.address ? '<br>' : ''}${inf.tin ? pxE((inf.vstat === 'NON-VAT' ? 'NON-VAT Reg. TIN: ' : 'VAT Reg. TIN: ') + inf.tin) + '<br>' : ''}${inf.contact ? pxE(inf.contact) + '<br>' : ''}${pxE((c.header || '').split('\n').filter(Boolean).join(' · '))}<hr><b>${s.stmt ? 'BILLING STATEMENT' : 'ORDER SLIP / BILLING STATEMENT'}</b><br><small>(Hindi opisyal na resibo)</small></div><hr>
  Slip No: ${pxE(s.no)}${reprint ? ' (REPRINT)' : ''}<br>Petsa: ${pxE(new Date(s.atMs || Date.now()).toLocaleString('en-PH'))}<br>Cashier: ${pxE(s.cashier)}${s.tableName ? '<br>Table: ' + pxE(s.tableName) + (s.pax ? ' · ' + s.pax + ' pax' : '') + (s.billCount > 1 ? ' · Bill ' + s.billNo + '/' + s.billCount : '') : ''}${s.channel && s.channel !== 'dine' ? '<br>Channel: ' + pxE(s.chName) + (s.platRef ? ' #' + pxE(s.platRef) : '') : ''}${s.eventName ? '<br>Event: ' + pxE(s.eventName) : ''}<hr>
  <table>${pxChItems(s.items).map(l => l._h ? `<tr><td colspan="2"><b>— ${pxE(l._h)} —</b></td></tr>` : `<tr><td colspan="2">${pxE(l.name)}</td></tr>` + row('&nbsp;&nbsp;' + (+(+l.qty).toFixed(3)) + ' x ' + pxM(l.price), pxM(l.qty * l.price))).join('')}</table><hr>
  <table>${row('Subtotal', pxM(s.gross))}${s.pc && s.pc.sc ? row('Senior 20%', '-' + pxM(s.pc.sc)) : ''}${s.pc && s.pc.pwd ? row('PWD 20%', '-' + pxM(s.pc.pwd)) : ''}${s.pc && s.pc.disc ? row(pxE(s.disc.label), '-' + pxM(s.pc.disc)) : ''}${s.pc && s.pc.comp ? row('Complimentary', '-' + pxM(s.pc.comp)) : ''}${s.disc && s.disc.type === 'taxex' ? row('Tax-Exempt (walang VAT)', '') : ''}${s.svc && s.svcShown ? row('Service Charge', pxM(s.svc)) : ''}${row('TOTAL', 'P' + pxM(s.total), true)}</table>${vatBlock}<hr>
  <table>${modes}${s.change ? row('Sukli', pxM(s.change)) : ''}</table>
  ${s.disc && ['senior', 'pwd', 'taxex'].includes(s.disc.type) ? `<hr>${pxE(s.disc.label)}<br>${s.disc.id ? 'ID: ' + pxE(s.disc.id) + '<br>' : ''}${s.disc.name ? 'Pangalan: ' + pxE(s.disc.name) : ''}` : ''}
  ${s.member ? `<hr>Member: ${pxE(s.member.name)}<br>ID: ${pxE(s.member.mid)}<br>Club: ${pxE(s.member.club)}${s.member.parentMid || s.member.parentName ? '<br>' + pxE(s.member.rel || 'Dependent') + ' ni ' + pxE(s.member.parentName || '') + (s.member.parentMid ? ' (' + pxE(s.member.parentMid) + ')' : '') : ''}` : ''}<hr>
  ${s.stmt ? '<div class="c"><b>*** HINDI PA BAYAD ***</b><br>Ipakita ang Senior/PWD ID bago magbayad kung may discount.</div>' : `Pirma ng Customer:<div class="sg">${s.sig ? `<img src="${s.sig}" style="height:44px;">` : ''}</div><br>Kalakip sa Opisyal na Resibo No.: ${pxE(s.orNo || '______________')}`}<hr><div class="c">${pxE(c.footer || '')}</div>${c.devName || c.devContact || c.devTag || pv ? `<hr><div class="c" style="font-size:10px;">${(c.devTag || pv) ? pxE(c.devTag || '(Tagline / ads mo)') + '<br>' : ''}POS System${(c.devName || pv) ? ' by <b>' + pxE(c.devName || '(Pangalan ng developer)') + '</b>' : ''}${(c.devContact || pv) ? '<br>' + pxE(c.devContact || '(Contact mo: telepono / email / FB)') : ''}</div>` : ''}</body></html>`;
}
function pxPrint(html) { let f = document.getElementById('px-frame'); if (f) f.remove(); f = document.createElement('iframe'); f.id = 'px-frame'; f.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;'; document.body.appendChild(f); const d = f.contentWindow.document; d.open(); d.write(html); d.close(); setTimeout(() => { try { f.contentWindow.focus(); f.contentWindow.print(); } catch (e) { pxAlert('Hindi ma-print: ' + e.message); } }, 350); }

/* ================= SHIFT / BENTA ================= */
async function pxShiftOpen() { const c = document.getElementById('px-cashier').value.trim(); if (!c) { pxAlert('Ilagay ang cashier.'); return; } const oc = document.getElementById('px-open').value.trim(); if (oc === '' || isNaN(+oc) || +oc < 0) { pxAlert('Ilagay ang panimulang cash sa drawer (0 kung wala).'); return; }
  try { const ex = await db.collection('pos_shifts').where('site', '==', PX.site).where('status', '==', 'open').get(); if (!ex.empty) { const x = ex.docs[0]; PX.shift = Object.assign({ id: x.id }, x.data()); await pxAlert('May bukas nang shift ni ' + PX.shift.cashier + ' (' + PX.shift.date + ') sa branch na ito. ' + (pxShiftStale() ? 'I-Z-read muna ito.' : '')); pxRender(); return; } } catch (e) {}
  if (!await pxConfirm('Buksan ang POS para sa ' + pxBiz() + '?\nCashier: ' + c + '\nPanimulang cash sa drawer: ₱' + pxM(pxNum(oc)), { ok: 'Oo, buksan' })) return; const d = { site: PX.site, company: pxCo(), cashier: c, openedBy: String(pxMe().email || ''), openAt: new Date().toISOString(), date: pxBiz(), openCash: pxNum(document.getElementById('px-open').value), status: 'open' }; try { const r = await db.collection('pos_shifts').add(d); PX.shift = Object.assign({ id: r.id }, d); pxRender(); } catch (e) { pxAlert('Error: ' + e.message); } }
async function pxLoadSales(date) { const s = await db.collection('pos_sales').where('site', '==', PX.site).where('date', '==', date).get(); const a = []; s.forEach(d => a.push(Object.assign({ id: d.id }, d.data()))); a.sort((x, y) => (x.atMs || 0) - (y.atMs || 0)); return a; }
function pxSum(list) { const t = { n: 0, gross: 0, total: 0, svc: 0, sc: 0, pwd: 0, disc: 0, comp: 0, vat: 0, exm: 0, void: 0, modes: {} }; list.forEach(s => { if (s.status === 'void') { t.void++; return; } t.n++; t.gross += s.gross || 0; t.total += s.total || 0; t.svc += s.svc || 0; const p = s.pc || {}; t.sc += p.sc || 0; t.pwd += p.pwd || 0; t.disc += p.disc || 0; t.comp += p.comp || 0; t.vat += p.vat || 0; t.exm += p.exm || 0; (s.pays || []).forEach(x => { const a = x.mode === 'cash' ? x.amount - (s.change || 0) : x.amount; t.modes[x.mode] = (t.modes[x.mode] || 0) + a; }); }); return t; }
async function pxSalesView() {
  const date = PX.sdate || (PX.sdate = pxBiz()), L = await pxLoadSales(date), T = pxSum(L); PX.sl = L;
  return pxHint('📖 Dito makikita ang lahat ng benta ng araw. <b>OR No. (kalakip)</b> = ilagay ang numero ng opisyal na resibo na kakabit ng slip. <b>X-read</b> = ulat habang bukas pa ang shift. <b>Z-read</b> = pagsara ng shift (bawal kapag may bukas pang table; i-settle muna lahat): bibilangin ang cash at ikukumpara sa dapat na laman ng drawer.') + `<div style="display:flex;gap:.4rem;align-items:end;flex-wrap:wrap;margin-bottom:.5rem;"><div><small>Petsa</small><br><input type="date" value="${date}" onchange="PX.sdate=this.value;pxBody()"></div>${PX.shift ? `<button class="btn btn-warning btn-sm" onclick="pxShiftClose()">🔒 Isara ang Shift (Z-read)${pxTabsOpen().length ? ' · ⚠ ' + pxTabsOpen().length + ' table bukas' : ''}</button>` : ''}${PX.shift ? '<button class="btn btn-secondary btn-sm" onclick="pxXRead()">📄 X-read</button>' : ''}${pxMgr() ? '<button class="btn btn-secondary btn-sm" onclick="pxDailyRpt()">🏬 Daily / Mall report</button>' : ''}${pxAdmin() ? '<button class="btn btn-secondary btn-sm" onclick="pxRecv()">🐼 Delivery receivables</button>' : ''}</div>
  <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:.4rem;margin-bottom:.5rem;">${[['Transaksyon', T.n], ['Gross', pxM(T.gross)], ['Total (may SC)', pxM(T.total)], ['Service Charge', pxM(T.svc)], ['Senior/PWD', pxM(T.sc + T.pwd)], ['Discount/Comp', pxM(T.disc + T.comp)], ['Void', T.void]].concat(Object.keys(PX_CH).map(k => { const x = L.filter(s => s.status !== 'void' && (s.channel || 'dine') === k); return x.length ? [PX_CH[k].i + ' ' + PX_CH[k].n + ' (' + x.length + ')', pxM(x.reduce((a, s) => a + (s.total || 0), 0))] : null; }).filter(Boolean)).concat(Object.keys(T.modes).map(k => [(PX_MODES[k] || k).replace(/^\S+\s/, ''), pxM(T.modes[k])])).map(([k, v]) => `<div style="border:1px solid #e2e8f0;border-radius:.4rem;padding:.4rem;background:#f8fafc;"><small style="color:#64748b;">${k}</small><div style="font-weight:700;">${v}</div></div>`).join('')}</div>
  <div style="overflow:auto;"><table class="table" style="font-size:.82rem;"><tr><th>No</th><th>Oras</th><th>Cashier</th><th>Items</th><th style="text-align:right;">Total</th><th>Bayad</th><th>OR No. (kalakip)</th><th></th></tr>${L.map((s, i) => `<tr style="${s.status === 'void' ? 'opacity:.5;text-decoration:line-through;' : ''}"><td>${pxE(s.no)}${s.eventName ? ' 🎪' : ''}${s.tableName ? '<br><small>🍽️ ' + pxE(s.tableName) + (s.billCount > 1 ? ' B' + s.billNo : '') + '</small>' : ''}${s.channel && s.channel !== 'dine' ? '<br><small>' + PX_CH[s.channel].i + ' ' + pxE(s.chName) + (s.platRef ? ' #' + pxE(s.platRef) : '') + (s.platStatus === 'paid' ? ' ✅' : s.platStatus === 'receivable' ? ' ⏳' : '') + '</small>' : ''}</td><td>${new Date(s.atMs).toLocaleTimeString('en-PH')}</td><td>${pxE(s.cashier)}</td><td>${(s.items || []).map(l => (+(+l.qty).toFixed(3)) + '× ' + pxE(l.name)).join(', ')}</td><td style="text-align:right;">${pxM(s.total)}</td><td>${(s.pays || []).map(p => pxE((PX_MODES[p.mode] || '').replace(/^\S+\s/, ''))).join('+')}</td><td><input value="${pxE(s.orNo || '')}" onchange="pxSetOr('${s.id}',this.value)" style="width:110px;"></td><td><button class="btn btn-secondary btn-sm" onclick="pxReprint(${i})">🖨️</button> ${s.status !== 'void' ? `<button class="btn btn-danger btn-sm" onclick="pxVoid(${i})">Void</button>${s.tabId ? ` <button class="btn btn-secondary btn-sm" onclick="pxReopen(${i})">↩️ Reopen</button>` : ''}` : '<b>VOID</b>'}</td></tr>`).join('') || '<tr><td colspan="8"><small>Walang benta sa petsang ito.</small></td></tr>'}</table></div>`;
}
function pxReprint(i) { pxPrintReceipt(PX.sl[i], true); }
async function pxSetOr(id, v) { try { await db.collection('pos_sales').doc(id).update({ orNo: v.trim() }); } catch (e) { pxAlert('Error: ' + e.message); } }
async function pxVoid(i) {
  const s = PX.sl[i]; if (!await pxPin('Kailangan ng PIN ng manager/admin para i-void ang transaksyon.')) return;
  const why = await pxVoidWhy('Bakit ibi-void ang ' + s.no + '?'); if (!why) return;
  try { await db.collection('pos_sales').doc(s.id).update({ status: 'void', void: { by: String(pxMe().email || ''), reason: why, at: new Date().toISOString() } }); try { await pxVchRelease(s); } catch (e) {} try { await pxGcRelease(s); await pxLoyReverse(s); } catch (e) {} try { await logSystemAction('POS_VOID', `${s.no}: ${why}`); } catch (e) {} pxBody(); } catch (e) { pxAlert('Error: ' + e.message); }
}
async function pxShiftSales() { const s = await db.collection('pos_sales').where('shiftId', '==', PX.shift.id).get(); const a = []; s.forEach(d => a.push(d.data())); return a; }
async function pxXRead() { const T = pxSum(await pxShiftSales()), cashIn = (T.modes.cash || 0) + (PX.shift.openCash || 0); pxModal(`<h3 style="margin-top:0;">📄 X-read — ${pxE(PX.shift.cashier)}</h3>${pxReadHtml(T)}<b>Dapat na cash sa drawer: ${pxM(cashIn)}</b>`); }
function pxReadHtml(T) { return `<table class="table" style="font-size:.85rem;"><tr><td>Transaksyon</td><td style="text-align:right;">${T.n} (void: ${T.void})</td></tr><tr><td>Gross</td><td style="text-align:right;">${pxM(T.gross)}</td></tr><tr><td>Senior / PWD</td><td style="text-align:right;">${pxM(T.sc)} / ${pxM(T.pwd)}</td></tr><tr><td>Discount / Comp</td><td style="text-align:right;">${pxM(T.disc)} / ${pxM(T.comp)}</td></tr><tr><td>Service Charge</td><td style="text-align:right;">${pxM(T.svc)}</td></tr><tr><td><b>Total</b></td><td style="text-align:right;"><b>${pxM(T.total)}</b></td></tr>${Object.keys(T.modes).map(k => `<tr><td>${pxE(PX_MODES[k] || k)}</td><td style="text-align:right;">${pxM(T.modes[k])}</td></tr>`).join('')}</table>`; }
/* Bawal ang Z-read / end of day kapag may bukas pang table (hindi pa na-settle). Sariwang query mula sa server, hindi lang sa local. */
async function pxOpenTabsFresh() { const L = []; try { const q = await db.collection('pos_tabs').where('site', '==', PX.site).where('status', '==', 'open').get(); q.forEach(x => L.push(Object.assign({ id: x.id }, x.data()))); } catch (e) { return (PX.tabs || []).filter(t => t.status === 'open' && t.site === PX.site); } return L; }
async function pxEodBlock() { // true = may bukas na table, naharang
  const L = await pxOpenTabsFresh(); if (!L.length) return false;
  const lines = L.slice(0, 12).map(t => '• ' + (t.tableName || '?') + (t.zone ? ' (' + t.zone + ')' : '') + ' — ' + ((t.orders || []).some(o => o.status !== 'void' && (o.items || []).length) ? '₱' + pxM(pxTabSub(t)) + ', hindi pa settle' : 'walang order (i-cancel ang table)'));
  await pxAlert('Hindi puwedeng mag-Z-read / mag-end of day hangga\'t may bukas na table. May ' + L.length + ' table pa:\n\n' + lines.join('\n') + (L.length > 12 ? '\n… at ' + (L.length - 12) + ' pa' : '') + '\n\nI-settle ang bill (o i-cancel kung walang order) sa 🍽️ Tables, saka subukan ulit.', '⛔ May bukas pang table'); PX.tab = 'tables'; pxBody(); return true;
}
async function pxShiftClose() {
  if (await pxEodBlock()) return;
  const T = pxSum(await pxShiftSales()), exp = (T.modes.cash || 0) + (PX.shift.openCash || 0), cnt = await pxPrompt('🔒 Z-read — bilang ng cash', { hint: 'Dapat na cash sa drawer: <b>₱' + pxM(exp) + '</b>. Bilangin ang cash at ilagay ang aktwal na halaga.', type: 'number', ph: 'aktwal na cash', ok: 'Isara ang shift' }); if (cnt === null) return; const c = pxNum(cnt);
  try { await db.collection('pos_shifts').doc(PX.shift.id).update({ status: 'closed', closeAt: new Date().toISOString(), closeCash: c, expectedCash: pxR2(exp), over: pxR2(c - exp), summary: { n: T.n, gross: pxR2(T.gross), total: pxR2(T.total), svc: pxR2(T.svc), modes: T.modes } }); pxModal(`<h3 style="margin-top:0;">🔒 Z-read — ${pxE(PX.shift.cashier)}</h3>${pxReadHtml(T)}<b>Cash: dapat ${pxM(exp)} · bilang ${pxM(c)} · ${c - exp >= 0 ? 'sobra' : 'kulang'} ${pxM(Math.abs(c - exp))}</b>`); PX.shift = null; pxRender(); } catch (e) { pxAlert('Error: ' + e.message); }
}
async function pxEventReport(id) { const e = PX.events.find(x => x.id === id), s = await db.collection('pos_sales').where('eventId', '==', id).get(), L = []; s.forEach(d => L.push(d.data())); const T = pxSum(L); pxModal(`<h3 style="margin-top:0;">📊 ${pxE(e.name)}</h3>${pxReadHtml(T)}`); }

/* ---------- Delivery receivables (Foodpanda / GrabFood) ---------- */
let PX_RV = null;
async function pxRecv() {
  pxModal('<div style="padding:.5rem;">Kinukuha…</div>', 900); const L = [];
  try { (await db.collection('pos_sales').where('site', '==', PX.site).where('platStatus', '==', 'receivable').get()).forEach(x => { const s = Object.assign({ id: x.id }, x.data()); if (s.status !== 'void') L.push(s); }); } catch (e) { pxModal('<div style="color:#dc2626;">Error: ' + pxE(e.message) + '</div>'); return; }
  L.sort((a, b) => (a.atMs || 0) - (b.atMs || 0)); PX_RV = { L, sel: {}, comm: {}, f: 'all' }; L.forEach(s => { PX_RV.comm[s.id] = s.commAmt || 0; }); pxRvRender();
}
function pxRvRender() {
  const R = PX_RV, L = R.L.filter(s => R.f === 'all' || s.channel === R.f), S = L.filter(s => R.sel[s.id]), gross = pxR2(S.reduce((a, s) => a + s.total, 0)), comm = pxR2(S.reduce((a, s) => a + (+R.comm[s.id] || 0), 0)), tot = pxR2(R.L.reduce((a, s) => a + s.total, 0));
  pxModal(`<h3 style="margin-top:0;">🐼 Delivery receivables — ${pxE(pxSite().name || '')}</h3>${pxHint('📖 Mga benta mula Foodpanda/GrabFood na <b>hindi pa pumapasok ang bayad</b>. Kapag dumating ang payout: lagyan ng ✔ ang mga kasama roon, ayusin ang <b>commission</b> kung iba sa aktwal na statement ng app, ilagay ang <b>payout ref</b> at petsa, at pindutin ang <b>Mark as paid</b>. Si admin/accounting lang ang puwedeng mag-mark.')}
  <div style="display:flex;gap:.3rem;flex-wrap:wrap;align-items:center;margin-bottom:.3rem;">${[['all', 'Lahat'], ['fp', '🐼 Foodpanda'], ['grab', '🟢 GrabFood']].map(([k, l]) => `<button class="btn ${R.f === k ? 'btn-primary' : 'btn-secondary'} btn-sm" onclick="PX_RV.f='${k}';pxRvRender()">${l}</button>`).join('')}<button class="btn btn-secondary btn-sm" onclick="PX_RV.L.filter(s=>PX_RV.f==='all'||s.channel===PX_RV.f).forEach(s=>PX_RV.sel[s.id]=true);pxRvRender()">☑ Piliin lahat</button><b style="margin-left:auto;">Kabuuang receivable: ₱${pxM(tot)}</b></div>
  <div style="overflow:auto;max-height:45vh;"><table class="table" style="font-size:.82rem;"><tr><th></th><th>Petsa</th><th>Slip</th><th>Channel · Order #</th><th style="text-align:right;">Total</th><th>Commission ₱</th><th style="text-align:right;">Net</th></tr>${L.map(s => `<tr><td><input type="checkbox" ${R.sel[s.id] ? 'checked' : ''} onchange="PX_RV.sel['${s.id}']=this.checked;pxRvRender()"></td><td>${pxE(s.date)}</td><td>${pxE(s.no)}</td><td>${PX_CH[s.channel] ? PX_CH[s.channel].i : ''} ${pxE(s.chName)} · ${pxE(s.platRef)}</td><td style="text-align:right;">${pxM(s.total)}</td><td><input type="number" step="0.01" value="${R.comm[s.id]}" style="width:90px;" onchange="PX_RV.comm['${s.id}']=pxNum(this.value);pxRvRender()"></td><td style="text-align:right;">${pxM(pxR2(s.total - (+R.comm[s.id] || 0)))}</td></tr>`).join('') || '<tr><td colspan="7"><small>Walang receivable. 🎉</small></td></tr>'}</table></div>
  <div style="border-top:1px solid #e2e8f0;margin-top:.4rem;padding-top:.4rem;"><b>Napili: ${S.length}</b> · Gross ₱${pxM(gross)} − Commission ₱${pxM(comm)} = <b>Net payout ₱${pxM(pxR2(gross - comm))}</b>
  <div style="display:flex;gap:.4rem;flex-wrap:wrap;margin-top:.3rem;"><input id="rv-ref" placeholder="Payout ref / statement no." style="flex:1;min-width:160px;"><input id="rv-date" type="date" value="${pxToday()}"><button class="btn btn-success" onclick="pxRvPay()" ${S.length ? '' : 'disabled'}>✅ Mark as paid</button></div></div>`, 900);
}
async function pxRvPay() {
  const R = PX_RV, S = R.L.filter(s => R.sel[s.id]), ref = document.getElementById('rv-ref').value.trim(), dt = document.getElementById('rv-date').value || pxToday(); if (!S.length) return; if (!ref) { await pxAlert('Ilagay ang payout ref / statement no.'); return; }
  if (!await pxConfirm('I-mark na bayad ang ' + S.length + ' benta (Net ₱' + pxM(pxR2(S.reduce((a, s) => a + s.total - (+R.comm[s.id] || 0), 0))) + ')?', { ok: 'Mark as paid' })) return;
  try { await pxBatch(S.map(s => ({ t: 'set', col: 'pos_sales', id: s.id, merge: true, d: { platStatus: 'paid', commAmt: pxR2(+R.comm[s.id] || 0), netAmt: pxR2(s.total - (+R.comm[s.id] || 0)), payoutRef: ref, payoutDate: dt, payoutBy: String(pxMe().email || '') } }))); pxToast('✅ Na-mark na bayad: ' + S.length); await pxRecv(); pxBody(); } catch (e) { pxAlert('Error: ' + e.message); }
}

/* ================= MEMBERS ================= */
async function pxMembersView() {
  const q = String(PX.mq || '').toLowerCase(), L = (q ? pxMemSearch(q) : PX.members).filter(m => (!PX.mst || (PX.mst === 'inactive' ? m.active === false : m.active !== false)) && (!PX.mrel || (PX.mrel === 'dep' ? !!m.parentMid : !m.parentMid)) && true).sort((a, b) => q ? 0 : String(a.name).localeCompare(String(b.name)));
  return pxHint('📖 Listahan ng mga member ng company. Hanapin gamit ang ID, pangalan, o club. Ang <b>Club</b> ang magsisingil sa kanila at kukuha ng % ng benta buwan-buwan.') + `<div style="display:flex;gap:.4rem;margin-bottom:.5rem;flex-wrap:wrap;"><input type="search" placeholder="🔎 ID, pangalan, club" value="${pxE(PX.mq || '')}" oninput="PX.mq=this.value;pxMemFilter()" onkeydown="if(event.key==='Enter'){clearTimeout(PX._mt);PX.mq=this.value;pxBody()}" style="flex:1;min-width:160px;"><button class="btn btn-primary btn-sm" onclick="clearTimeout(PX._mt);pxBody()">🔎 Hanapin</button><button class="btn btn-primary btn-sm" onclick="pxMemEdit('')">➕ Bagong member</button><button class="btn btn-secondary btn-sm" onclick="pxMemCheck()">🪪 Check Membership</button>${pxAdmin() ? '<button class="btn btn-secondary btn-sm" onclick="pxMemExport()">⬇️ Export</button><button class="btn btn-secondary btn-sm" onclick="pxMemImport()">⬆️ Import</button><button class="btn btn-secondary btn-sm" onclick="pxRpView()">🕘 Restore Points</button>' : ''}</div><div style="display:flex;gap:.3rem;margin-bottom:.4rem;align-items:center;flex-wrap:wrap;">${[['', 'Lahat'], ['active', '✅ Active'], ['inactive', '⛔ Inactive']].map(([k, l]) => `<button class="btn ${(PX.mst || '') === k ? 'btn-primary' : 'btn-secondary'} btn-sm" onclick="PX.mst='${k}';pxBody()">${l}</button>`).join('')}<span style="border-left:1px solid #cbd5e1;height:1.2rem;"></span>${[['', 'Lahat'], ['pri', '👤 Principal'], ['dep', '👥 Dependent']].map(([k, l]) => `<button class="btn ${(PX.mrel || '') === k ? 'btn-primary' : 'btn-secondary'} btn-sm" onclick="PX.mrel='${k}';pxBody()">${l}</button>`).join('')}<small style="color:#64748b;">${L.length} member${L.length > 400 ? ' (unang 400 ang ipinapakita — gamitin ang search)' : ''}</small></div>
  ${pxMemBulkBar(L)}<div style="overflow:auto;"><table class="table" style="font-size:.85rem;" id="px-mt"><tr>${pxAdmin() ? `<th><input type="checkbox" title="Piliin lahat ng resulta" onclick="pxMselAll(this.checked)" ${L.length && L.every(m => PX.msel && PX.msel[m.id]) ? 'checked' : ''}></th>` : ''}<th>ID No.</th><th>Pangalan</th><th>Club</th><th>Relasyon</th><th>Status</th><th>Nairehistro</th><th>Ni</th><th></th></tr>${L.slice(0, 400).map(m => `<tr>${pxAdmin() ? `<td><input type="checkbox" ${PX.msel && PX.msel[m.id] ? 'checked' : ''} onchange="pxMsel('${m.id}',this.checked)"></td>` : ''}<td>${pxE(m.mid)}</td><td>${pxE(m.name)}</td><td>${pxE(m.club)}</td><td>${pxRelBadge(m)}${m.parentMid ? `<br><small>ni ${pxE((pxMemParent(m) || {}).name || m.parentMid)} <span style="color:#94a3b8;">(${pxE(m.parentMid)})</span></small>` : ''}</td><td>${pxMemBadge(m)}</td><td>${pxE(m.regDate)}</td><td><small>${pxE(m.addedBy)}</small></td><td><button class="btn btn-secondary btn-sm" onclick="pxMemHist('${m.id}')">🧾</button> ${pxAdmin() ? `<button class="btn btn-secondary btn-sm" onclick="pxMemEdit('${m.id}')">✏️</button>${m.parentMid ? '' : `<button class="btn btn-secondary btn-sm" title="Magdagdag ng asawa/anak" onclick="pxMemEdit('','${m.id}')">➕👥</button>`}` : ''}</td></tr>`).join('') || '<tr><td colspan="7"><small>Wala pang member.</small></td></tr>'}</table></div>`;
}
function pxMemFilter() { clearTimeout(PX._mt); PX._mt = setTimeout(pxBody, 250); }
function pxMemEdit(id, parentId) {
  const par0 = parentId ? PX.members.find(x => x.id === parentId) : null, m = id ? PX.members.find(x => x.id === id) : { mid: '', name: '', club: '', parentMid: par0 ? par0.mid : '', rel: par0 ? 'Dependent' : '' }; PX_MM = id; PX_MMP = m.parentMid || '';
  if (par0) m.mid = pxNextDepId(par0, 'Dependent'), m.club = par0.club;
  const isDep = !!m.parentMid, deps = id ? pxMemDeps(m) : [];
  pxModal(`<h3 style="margin-top:0;">🪪 Member${par0 ? ' — dagdag na dependent' : ''}</h3>${pxHint('<b>ID No.</b> = numero sa card ng member (hindi na mababago pagkatapos i-save). <b>Pangalan</b> = buong pangalan. <b>Club</b> = saan siya miyembro.<br>👥 <b>Asawa/anak</b>: lagyan ng <b>Principal ID</b> (ang pinakapunong code, hal. <i>PIN402</i> para sa <i>PIN402-S</i> o <i>PIN402-D1</i>). Ang bibilhin ng dependent ay <b>sa principal sisingilin</b>, kaya sa principal din ang club at status niya.')}<div style="display:grid;gap:.3rem;"><input id="mm-id" placeholder="ID No. (nasa card)" value="${pxE(m.mid)}" ${id ? 'readonly' : ''} oninput="pxMmAuto()"><input id="mm-name" placeholder="Pangalan" value="${pxE(m.name)}">
  <div style="border:1px dashed #c7d2fe;border-radius:.4rem;padding:.4rem;background:#f8faff;"><div style="font-weight:700;font-size:.8rem;">Principal ID <small style="font-weight:400;color:#64748b;">(blangko kung siya mismo ang principal)</small></div><input id="mm-par" placeholder="hal. PIN402" value="${pxE(m.parentMid || '')}" oninput="pxMmAuto(1)" style="width:100%;box-sizing:border-box;"><div id="mm-parinfo" style="font-size:.78rem;margin:.2rem 0;"></div><select id="mm-rel">${PX_RELS.map(r => `<option ${r === (m.rel || 'Dependent') ? 'selected' : ''}>${r}</option>`).join('')}</select>${deps.length ? `<div style="font-size:.78rem;margin-top:.3rem;"><b>Mga dependent (${deps.length}):</b> ${deps.slice(0, 12).map(d => pxE(d.mid)).join(', ')}${deps.length > 12 ? '…' : ''} <button type="button" class="btn btn-secondary btn-sm" onclick="pxMemEdit('','${m.id}')">➕ Dependent</button></div>` : ''}</div>
  <select id="mm-club"><option value="">— Club —</option>${PX.clubs.map(c => `<option ${c.name === m.club ? 'selected' : ''}>${pxE(c.name)}</option>`).join('')}</select><input type="hidden" id="mm-act" value="${m.active === false ? '0' : '1'}"><div style="font-weight:700;font-size:.8rem;">Status ng membership</div><div id="mm-st" style="display:flex;gap:.4rem;"></div>${pxHint('<b>Active</b> = puwedeng mag-order at mag-settle. <b>Inactive</b> = makikita pa rin sa listahan pero hindi makakapag-settle ng Member Charge at hindi makakapagbukas ng table. Kapag <b>Inactive ang principal</b>, hindi rin puwede ang lahat ng dependent niya.')}</div><button class="btn btn-success" style="margin-top:.4rem;" onclick="pxMemSave()">💾 I-save</button>`, 480); pxMmSt(); pxMmAuto(); }
/* auto-hula ng principal mula sa ID (-S, -D1) at pag-check kung existing */
function pxMmAuto(fromPar) {
  const g = i => document.getElementById(i), idv = g('mm-id').value.trim(), par = g('mm-par'), info = g('mm-parinfo'), club = g('mm-club'); if (!par) return;
  if (!fromPar && !PX_MM && !par.value.trim()) { const sp = pxIdSplit(idv); if (sp && pxMemIdx().by[pxSlug(sp.base)]) { par.value = pxMemIdx().by[pxSlug(sp.base)].mid; g('mm-rel').value = sp.rel; } }
  const pv = par.value.trim(), p = pv ? pxMemIdx().by[pxSlug(pv)] : null;
  info.innerHTML = !pv ? '' : p ? `✅ Principal: <b>${pxE(p.name)}</b> · ${pxE(p.club || 'walang club')}${p.parentMid ? ' <b style="color:#b91c1c;">⚠ dependent din siya — dapat principal ang ilagay</b>' : ''}${p.active === false ? ' <b style="color:#b91c1c;">(INACTIVE)</b>' : ''}` : '<span style="color:#b91c1c;">⚠ Walang member na may ID na iyan.</span>';
  if (p && club) { club.value = p.club || ''; club.disabled = true; } else if (club) club.disabled = false;
}
let PX_MM = '', PX_MMP = '';
function pxMmSt(v) { const h = document.getElementById('mm-act'), b = document.getElementById('mm-st'); if (!h || !b) return; if (v != null) h.value = v; const a = h.value !== '0'; b.innerHTML = `<button type="button" class="btn ${a ? 'btn-success' : 'btn-secondary'}" style="flex:1;" onclick="pxMmSt('1')">✅ Active</button><button type="button" class="btn ${!a ? 'btn-danger' : 'btn-secondary'}" style="flex:1;" onclick="pxMmSt('0')">⛔ Inactive</button>`; }
async function pxMemSave() {
  const g = i => document.getElementById(i), mid = g('mm-id').value.trim(), name = g('mm-name').value.trim(); let club = g('mm-club').value; if (!mid || !name) { pxAlert('Ilagay ang ID at pangalan.'); return; }
  const id = PX_MM || pxSlug(pxCo()) + '__' + pxSlug(mid); if (!PX_MM && PX.members.some(m => String(m.mid).toLowerCase() === mid.toLowerCase())) { pxAlert('May member na gumagamit ng ID na iyan.'); return; }
  const pv = g('mm-par').value.trim(), par = pv ? pxMemIdx().by[pxSlug(pv)] : null;
  if (pv && !par) { pxAlert('Walang member na may Principal ID na "' + pv + '". Idagdag muna ang principal.'); return; }
  if (par && pxSlug(par.mid) === pxSlug(mid)) { pxAlert('Hindi puwedeng siya ang sarili niyang principal.'); return; }
  if (par && par.parentMid) { pxAlert('Dependent din si ' + par.name + '. Ang ilagay ay ang pinakapunong (principal) na ID: ' + par.parentMid + '.'); return; }
  if (!pv && PX_MM && pxMemDeps(PX.members.find(x => x.id === PX_MM)).length === 0) { /* ok */ }
  const cur = PX_MM ? PX.members.find(x => x.id === PX_MM) : null; if (pv && cur && pxMemDeps(cur).length) { pxAlert('May ' + pxMemDeps(cur).length + ' dependent si ' + cur.name + ', kaya hindi siya puwedeng maging dependent ng iba.'); return; }
  if (par) club = par.club || '';
  const cl = PX.clubs.find(c => c.name === club) || {}; const d = { company: pxCo(), mid, name, club, clubId: par ? par.clubId || cl.id || '' : cl.id || '', active: g('mm-act').value !== '0', parentMid: par ? par.mid : '', rel: par ? g('mm-rel').value : '' }; if (!PX_MM) { d.regDate = pxToday(); d.addedBy = String(pxMe().email || ''); d.addedAt = new Date().toISOString(); }
  try { await db.collection('pos_members').doc(id).set(d, { merge: true }); PX._ms = null; const i = PX.members.findIndex(m => m.id === id); if (i >= 0) Object.assign(PX.members[i], d); else PX.members.push(Object.assign({ id }, d));
    if (!par && PX_MM) { const cm = PX.members.find(x => x.id === PX_MM); const dl = pxMemDeps(cm).filter(x => x.club !== club); if (dl.length) { await pxBatch(dl.map(x => ({ t: 'set', col: 'pos_members', id: x.id, d: { club, clubId: d.clubId }, merge: true }))); dl.forEach(x => { x.club = club; x.clubId = d.clubId; }); } } // sumusunod ang club ng mga dependent sa principal
    PX._mx = null; pxClose(); pxBody(); } catch (e) { pxAlert('Error: ' + e.message); }
}
async function pxMemHist(id) { const m = PX.members.find(x => x.id === id), L = [], seen = {}; for (const fld of ['memberKey', 'billKey']) { const s = await db.collection('pos_sales').where(fld, '==', id).get(); s.forEach(d => { if (!seen[d.id]) { seen[d.id] = 1; L.push(Object.assign({ id: d.id }, d.data())); } }); } L.sort((a, b) => b.atMs - a.atMs); pxModal(`<h3 style="margin-top:0;">🧾 ${pxE(m.name)} (${pxE(m.mid)})</h3><table class="table" style="font-size:.8rem;"><tr><th>Petsa</th><th>Branch</th><th>No</th><th style="text-align:right;">Charge</th><th>Status</th></tr>${L.map(x => `<tr><td>${pxE(x.date)}</td><td>${pxE(x.siteName)}</td><td>${pxE(x.no)}</td><td style="text-align:right;">${pxM(x.memberCharge)}</td><td>${pxE(x.status === 'void' ? 'void' : x.chargeStatus)}</td></tr>`).join('') || '<tr><td colspan="5">Wala.</td></tr>'}</table>`, 680); }

/* ================= CLUBS / STATEMENT ================= */
async function pxClubsView() {
  const clubs = PX.clubs, cid = PX.clubSel || (clubs[0] || {}).id || '', mon = PX.clubMon || pxToday().slice(0, 7), cl = clubs.find(c => c.id === cid);
  let body = '<p style="color:#64748b;">Gumawa muna ng club.</p>';
  if (cl) {
    const s = await db.collection('pos_sales').where('clubId', '==', cid).get(), L = []; s.forEach(d => { const x = d.data(); if (x.status !== 'void' && x.memberCharge > 0 && String(x.date).slice(0, 7) === mon) L.push(Object.assign({ id: d.id }, x)); }); L.sort((a, b) => a.atMs - b.atMs); PX.stl = L;
    const net = x => { const f = x.total ? x.memberCharge / x.total : 0; return ((x.pc && x.pc.vat) || 0) * f + ((x.pc && x.pc.exm) || 0) * f; }; // net ng VAT at SC (SC hindi kasama)
    const gross = L.reduce((a, x) => a + x.memberCharge, 0), disp = L.filter(x => x.chargeStatus === 'disputed'), dsum = disp.reduce((a, x) => a + x.memberCharge, 0), ok = L.filter(x => x.chargeStatus !== 'disputed'), okS = ok.reduce((a, x) => a + x.memberCharge, 0), okNet = ok.reduce((a, x) => a + net(x), 0), pct = +cl.pct || 0, share = pxR2(okNet * pct / 100), due = pxR2(okS - share), paidS = L.filter(x => x.chargeStatus === 'paid').reduce((a, x) => a + x.memberCharge, 0);
    body = `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:.4rem;margin:.5rem 0;">${[['Kabuuang charge', pxM(gross)], ['Disputed', pxM(dsum)], ['Hindi disputed', pxM(okS)], ['Share ng club ' + pct + '% (net ng VAT)', '−' + pxM(share)], ['Dapat bayaran sa atin', pxM(due)], ['Nabayaran na', pxM(paidS)], ['Balanse', pxM(due - paidS)]].map(([k, v]) => `<div style="border:1px solid #e2e8f0;border-radius:.4rem;padding:.4rem;background:#f8fafc;"><small style="color:#64748b;">${k}</small><div style="font-weight:700;">${v}</div></div>`).join('')}</div>
    <button class="btn btn-secondary btn-sm" onclick="pxClubCsv()">⬇️ CSV</button> <button class="btn btn-secondary btn-sm" onclick="pxClubPct('${cid}')">% ng club: ${pct}</button> <button class="btn btn-primary btn-sm" onclick="pxClubMembers('${cid}')">👥 Mga member ng club</button>
    <div style="overflow:auto;margin-top:.4rem;"><table class="table" style="font-size:.8rem;"><tr><th>Petsa</th><th>Branch</th><th>No</th><th>Member</th><th style="text-align:right;">Charge</th><th>Status</th><th>Pirma</th><th></th></tr>${L.map((x, i) => `<tr style="${x.chargeStatus === 'disputed' ? 'background:#fef2f2;' : ''}"><td>${pxE(x.date)}</td><td>${pxE(x.siteName)}</td><td>${pxE(x.no)}</td><td>${pxE(x.member ? x.member.name : '')}<br><small>${pxE(x.member ? x.member.mid : '')}${x.member && x.member.parentMid ? ' · ' + pxE(x.member.rel || 'Dep') + ' ni ' + pxE(x.member.parentName) + ' (' + pxE(x.member.parentMid) + ')' : ''}</small></td><td style="text-align:right;">${pxM(x.memberCharge)}</td><td>${pxE(x.chargeStatus)}</td><td>${x.sig ? `<img src="${x.sig}" style="height:28px;" data-zoom>` : '—'}</td><td><select onchange="pxChStatus(${i},this.value)"><option value="">Status…</option><option value="billed">Billed</option><option value="disputed">Disputed</option><option value="paid">Paid</option></select> <button class="btn btn-secondary btn-sm" onclick="pxReprintSt(${i})">🖨️</button></td></tr>`).join('') || '<tr><td colspan="8"><small>Walang charge sa buwan na ito.</small></td></tr>'}</table></div>`;
  }
  return pxHint('📖 Buwanang <b>statement ng club</b>: lahat ng member charge ng napiling club sa napiling buwan. <b>Status</b>: billed (sinisingil) → paid (bayad na) o disputed (itinatanggi ng customer). Kapag may dispute, tingnan ang <b>pirma</b> at ID na nakatala. Ang <b>% ng club</b> ay kinukuwenta sa benta na wala nang VAT.') + `<div style="display:flex;gap:.4rem;flex-wrap:wrap;align-items:end;"><div><small>Club</small><br><select onchange="PX.clubSel=this.value;pxBody()">${clubs.map(c => `<option value="${c.id}" ${c.id === cid ? 'selected' : ''}>${pxE(c.name)}</option>`).join('')}</select></div><div><small>Buwan</small><br><input type="month" value="${mon}" onchange="PX.clubMon=this.value;pxBody()"></div><button class="btn btn-primary btn-sm" onclick="pxClubNew()">➕ Bagong club</button></div>${body}`;
}
async function pxClubNew() { const n = String(await pxPrompt('🏢 Bagong Club', { hint: 'Pangalan ng club na magsisingil sa mga member nito.', ph: 'hal. Alabang Sports Club', ok: 'Susunod' }) || '').trim(); if (!n) return; const pr = await pxPrompt('% ng club sa sales', { hint: 'Porsyentong kukunin ng club sa benta (net ng VAT) bawat buwan. Hal. 10.', type: 'number', def: '10', ok: 'I-save' }); if (pr === null) return; const p = pxNum(pr); const id = pxSlug(pxCo()) + '__' + pxSlug(n); try { await db.collection('pos_clubs').doc(id).set({ company: pxCo(), name: n, pct: p }); PX.clubs = PX.clubs.filter(c => c.id !== id).concat([{ id, company: pxCo(), name: n, pct: p }]); PX.clubSel = id; pxBody(); } catch (e) { pxAlert('Error: ' + e.message); } }
async function pxClubPct(id) { const p = await pxPrompt('% ng club sa sales', { hint: 'Porsyentong kukunin ng club sa benta (net ng VAT) bawat buwan. Hal. 10.', type: 'number', def: String((PX.clubs.find(c => c.id === id) || {}).pct || ''), ok: 'I-save' }); if (p === null) return; const v = pxNum(p); try { await db.collection('pos_clubs').doc(id).update({ pct: v }); PX.clubs.find(c => c.id === id).pct = v; pxBody(); } catch (e) { pxAlert('Error: ' + e.message); } }
async function pxChStatus(i, v) { if (!v) return; const x = PX.stl[i]; if (v === 'disputed' && !await pxConfirm('Markahan na disputed ang charge na ito?', { ok: 'Oo, disputed' })) return; try { await db.collection('pos_sales').doc(x.id).update({ chargeStatus: v }); try { await logSystemAction('POS_CHARGE_' + v.toUpperCase(), x.no); } catch (e) {} pxBody(); } catch (e) { pxAlert('Error: ' + e.message); } }
function pxReprintSt(i) { pxPrintReceipt(PX.stl[i], true); }
function pxClubCsv() { const rows = [['Petsa', 'Branch', 'No', 'Member ID', 'Member', 'Relasyon', 'Principal ID', 'Principal', 'Charge', 'Status']].concat((PX.stl || []).map(x => [x.date, x.siteName, x.no, x.member ? x.member.mid : '', x.member ? x.member.name : '', x.member && x.member.parentMid ? x.member.rel || 'Dependent' : 'Principal', x.member ? x.member.parentMid || x.member.mid : '', x.member ? x.member.parentName || x.member.name : '', x.memberCharge, x.chargeStatus])); const csv = rows.map(r => r.map(c => '"' + String(c == null ? '' : c).replace(/"/g, '""') + '"').join(',')).join('\n'), a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); a.download = 'club-statement.csv'; a.click(); }

/* ================= IDEAL vs ACTUAL ================= */
async function pxIdealView() {
  const to = PX.ito || pxToday(), from = PX.ifrom || (() => { const d = new Date(); d.setDate(d.getDate() - 6); return pxISO(d); })(), key = PX.site + '__' + from + '__' + to;
  let ideal = {}, nSales = 0; const days = []; for (let d = new Date(from + 'T00:00:00'), i = 0; pxISO(d) <= to && i < 45; d.setDate(d.getDate() + 1), i++) days.push(pxISO(d));
  for (const dt of days) (await pxLoadSales(dt)).forEach(s => { if (s.status === 'void') return; nSales++; Object.keys(s.use || {}).forEach(k => { const u = s.use[k]; ideal[k] = ideal[k] || { name: u.name, unit: u.unit, qty: 0 }; ideal[k].qty += u.qty; }); });
  const cnt = async dt => { const o = {}; try { const sn = await db.collection('inventory_counts').where('branchCode', '==', pxSite().code).where('countDate', '==', dt).get(); sn.forEach(d => (d.data().lines || []).forEach(l => { o[l.itemCode] = o[l.itemCode] || { name: l.itemName, unit: l.uom, qty: 0 }; o[l.itemCode].qty += +l.qty || 0; })); } catch (e) {} return o; };
  const beg = await cnt(from), end = await cnt(to); let inn = {}; try { const d = await db.collection('pos_ideal').doc(key).get(); inn = d.exists ? (d.data().in || {}) : {}; } catch (e) {} PX.iKey = key; PX.iIn = inn;
  const codes = [...new Set([...Object.keys(ideal), ...Object.keys(beg).filter(k => ideal[k])])].sort((a, b) => ((ideal[a] || beg[a]).name || '').localeCompare((ideal[b] || beg[b]).name || ''));
  const rows = codes.map(k => { const b = (beg[k] || {}).qty || 0, e = (end[k] || {}).qty || 0, i = +inn[k] || 0, act = b + i - e, id = (ideal[k] || {}).qty || 0, v = act - id; return { k, name: (ideal[k] || beg[k]).name, unit: (ideal[k] || {}).unit || (beg[k] || {}).unit, b, i, e, act, id, v, pct: id ? v / id * 100 : 0 }; });
  return pxHint('📖 <b>Ideal vs Actual</b>: <b>Beg</b> = bilang sa simula, <b>+ Delivery</b> = dumating sa pagitan (ilagay mo dito), <b>End</b> = bilang sa dulo. <b>Actual gamit</b> = Beg + Delivery − End. <b>Ideal</b> = dapat nagamit base sa mga naibentang menu. <b>Variance</b> = Actual − Ideal; pula kapag lampas 5%. Kailangan ng inventory count ng branch sa dalawang petsa.') + `<div style="display:flex;gap:.4rem;flex-wrap:wrap;align-items:end;margin-bottom:.4rem;"><div><small>Mula</small><br><input type="date" value="${from}" onchange="PX.ifrom=this.value;pxBody()"></div><div><small>Hanggang</small><br><input type="date" value="${to}" onchange="PX.ito=this.value;pxBody()"></div><button class="btn btn-success btn-sm" onclick="pxIdealSave()">💾 I-save ang "Delivery/Dagdag"</button><small style="color:#64748b;">${nSales} benta · Beg = bilang noong ${from}, End = bilang noong ${to} (inventory count ng branch)</small></div>
  <div style="overflow:auto;"><table class="table" style="font-size:.8rem;"><tr><th>Item</th><th>Unit</th><th style="text-align:right;">Beg</th><th style="text-align:right;">+ Delivery</th><th style="text-align:right;">End</th><th style="text-align:right;">Actual gamit</th><th style="text-align:right;">Ideal (benta)</th><th style="text-align:right;">Variance</th><th style="text-align:right;">%</th></tr>${rows.map(r => `<tr style="${Math.abs(r.pct) > 5 ? 'background:#fef2f2;' : ''}"><td>${pxE(r.name)}<br><small>${pxE(r.k)}</small></td><td>${pxE(r.unit)}</td><td style="text-align:right;">${r.b.toFixed(2)}</td><td style="text-align:right;"><input type="number" step="any" value="${r.i || ''}" data-k="${pxE(r.k)}" class="ix-in" style="width:70px;"></td><td style="text-align:right;">${r.e.toFixed(2)}</td><td style="text-align:right;">${r.act.toFixed(2)}</td><td style="text-align:right;">${r.id.toFixed(2)}</td><td style="text-align:right;color:${r.v > 0 ? '#dc2626' : '#16a34a'};">${r.v.toFixed(2)}</td><td style="text-align:right;">${r.pct.toFixed(1)}%</td></tr>`).join('') || '<tr><td colspan="9"><small>Walang datos. Kailangan ng benta na may sangkap ang menu at inventory count sa dalawang petsa.</small></td></tr>'}</table></div><small style="color:#64748b;">Positibong variance = mas marami ang nagamit kaysa dapat (sobra/nawala). Pula = lampas 5%.</small>`;
}
async function pxIdealSave() { const o = {}; document.querySelectorAll('.ix-in').forEach(x => { if (x.value !== '') o[x.dataset.k] = pxNum(x.value); }); try { await db.collection('pos_ideal').doc(PX.iKey).set({ site: PX.site, in: o, by: String(pxMe().email || ''), at: new Date().toISOString() }); pxToast('✅ Na-save'); pxBody(); } catch (e) { pxAlert('Error: ' + e.message); } }

/* ================= BRANCH DOCS ================= */
const PX_DOCT = ['BIR Certificate of Registration (2303)', 'Business / Mayor\'s Permit', 'Municipal Permit', 'Sanitary Permit', 'Fire Safety Certificate', 'DTI / SEC', 'Lease Contract', 'Iba pa'];
async function pxDocsView() {
  const d = await db.collection('pos_docs').doc(PX.site).get(), L = d.exists ? (d.data().list || []) : []; PX.dl = L; const t = pxToday(), soon = pxISO(new Date(Date.now() + 30 * 864e5));
  return pxHint('📖 I-upload dito ang scan/litrato ng <b>BIR registration, permits, at lisensya</b> ng branch. Piliin ang uri, ilagay ang <b>expiry</b> kung meron (para makita kung malapit nang mag-expire), piliin ang file, at pindutin ang I-upload.') + `<div style="display:flex;gap:.4rem;flex-wrap:wrap;align-items:end;margin-bottom:.5rem;"><select id="pd-t">${PX_DOCT.map(x => `<option>${pxE(x)}</option>`).join('')}</select><div><small>Expiry (kung meron)</small><br><input type="date" id="pd-x"></div><input type="file" id="pd-f" accept="image/*,application/pdf"><button class="btn btn-primary btn-sm" onclick="pxDocAdd()">⬆️ I-upload</button></div>
  <table class="table" style="font-size:.85rem;"><tr><th>Dokumento</th><th>Expiry</th><th>Na-upload</th><th></th></tr>${L.map((x, i) => `<tr><td>${pxE(x.type)}<br><small>${pxE(x.name)}</small></td><td>${x.expiry ? pxE(x.expiry) + (x.expiry < t ? ' <b style="color:#dc2626;">EXPIRED</b>' : x.expiry <= soon ? ' <b style="color:#d97706;">malapit na</b>' : '') : '—'}</td><td><small>${pxE(x.by)} ${pxE(String(x.at || '').slice(0, 10))}</small></td><td><button class="btn btn-secondary btn-sm" onclick="pxDocOpen(${i})">👁️</button> <button class="btn btn-danger btn-sm" onclick="pxDocDel(${i})">🗑️</button></td></tr>`).join('') || '<tr><td colspan="4"><small>Wala pang naka-upload.</small></td></tr>'}</table>`;
}
async function pxDocAdd() { const f = (document.getElementById('pd-f').files || [])[0]; if (!f) { pxAlert('Pumili ng larawan o PDF.'); return; } try { const r = await reqSaveFile(f, 'posdoc:' + PX.site, 'pos-doc'); const L = (PX.dl || []).concat([{ id: r.id, name: r.name || f.name, type: document.getElementById('pd-t').value, expiry: document.getElementById('pd-x').value, by: String(pxMe().email || ''), at: new Date().toISOString() }]); await db.collection('pos_docs').doc(PX.site).set({ site: PX.site, list: L }); pxBody(); } catch (e) { pxAlert('Error: ' + e.message); } }
async function pxDocOpen(i) { try { const f = await reqLoadFile(PX.dl[i].id); if (!f) { pxAlert('Wala nang file.'); return; } imgOpen(f.dataUrl); } catch (e) { pxAlert('Error: ' + e.message); } }
async function pxDocDel(i) { if (!await pxConfirm('Burahin ang dokumentong ito?')) return; const L = PX.dl.slice(); L.splice(i, 1); try { await db.collection('pos_docs').doc(PX.site).set({ site: PX.site, list: L }); pxBody(); } catch (e) { pxAlert('Error: ' + e.message); } }

/* ================= ROSTER ================= */
async function pxRosterView() {
  const L = await pxRosterNames(); PX.rl = L; let dir = []; try { const s = await db.collection('emp_directory').get(); s.forEach(d => dir.push(Object.assign({ id: d.id }, d.data()))); } catch (e) {} PX.dir = dir; const site = pxSite(), mine = dir.filter(e => e.status !== 'Resigned' && e.status !== 'Terminated' && !L.some(r => r.id === e.id));
  return `<p style="font-size:.85rem;color:#64748b;">Mga empleyado ng branch (mula sa HR). Sila ang mapipiling cashier sa POS.</p>
  ${pxHint('📖 <b>Roster</b> = mga empleyado ng branch na puwedeng maging cashier. Mag-type ng pangalan mula sa HR at pindutin ➕ Idagdag. Ang <b>I-sync</b> ay kinokopya lang ang pangalan/posisyon/branch (walang sahod o pribadong detalye).')}<div style="display:flex;gap:.4rem;flex-wrap:wrap;"><input list="pr-dl" id="pr-q" placeholder="Hanapin ang empleyado mula sa HR..." style="min-width:260px;"><datalist id="pr-dl">${mine.map(e => `<option value="${pxE(e.name)} — ${pxE(e.id)}">`).join('')}</datalist><button class="btn btn-primary btn-sm" onclick="pxRosterAdd()">➕ Idagdag</button>${PX.role === 'admin' || (typeof canEditModule === 'function' && canEditModule('employees')) ? '<button class="btn btn-secondary btn-sm" onclick="pxDirSync()" title="Kopyahin ang pangalan/posisyon/branch lang (walang sahod o pribadong detalye)">🔄 I-sync ang Directory mula sa HR</button>' : ''}</div>
  <table class="table" style="margin-top:.5rem;font-size:.85rem;"><tr><th>Pangalan</th><th>Posisyon</th><th></th></tr>${L.map((r, i) => `<tr><td>${pxE(r.name)}</td><td>${pxE(r.position)}</td><td><button class="btn btn-danger btn-sm" onclick="pxRosterDel(${i})">✖</button></td></tr>`).join('') || '<tr><td colspan="3"><small>Wala pa.</small></td></tr>'}</table><small>${dir.length ? dir.length + ' empleyado sa directory' : 'Wala pang directory — ipa-sync muna sa HR/Admin.'}</small>`;
}
async function pxRosterAdd() { const v = document.getElementById('pr-q').value, id = String(v).split(' — ').pop().trim(), e = (PX.dir || []).find(x => x.id === id); if (!e) { pxAlert('Pumili sa listahan ng HR employees.'); return; } const L = (PX.rl || []).concat([{ id: e.id, name: e.name, position: e.position || '' }]); try { await db.collection('pos_roster').doc(PX.site).set({ site: PX.site, list: L, by: String(pxMe().email || ''), at: new Date().toISOString() }); pxBody(); } catch (er) { pxAlert('Error: ' + er.message); } }
async function pxRosterDel(i) { const L = (PX.rl || []).slice(); L.splice(i, 1); try { await db.collection('pos_roster').doc(PX.site).set({ site: PX.site, list: L }); pxBody(); } catch (e) { pxAlert('Error: ' + e.message); } }
async function pxDirSync() { try { const s = await db.collection('employees').get(); let n = 0, b = db.batch(); s.forEach(d => { const x = d.data(); b.set(db.collection('emp_directory').doc(d.id), { name: x.name || ((x.firstName || '') + ' ' + (x.lastName || '')).trim() || d.id, position: x.role || '', branch: x.branch || '', branchCode: x.branchCode || '', company: x.company || '', status: x.status || '' }); n++; }); await b.commit(); pxAlert('✅ Na-sync ang ' + n + ' empleyado.'); pxBody(); } catch (e) { pxAlert('Error: ' + e.message); } }

/* ===== Bulk assign ng club sa mga napiling member ===== */
function pxMemBulkBar(L) {
  if (!pxAdmin()) return ''; PX._mL = L.map(m => m.id); const n = Object.keys(PX.msel || {}).filter(k => PX.msel[k]).length;
  return `<div style="border:1px dashed #93c5fd;background:#eff6ff;border-radius:.5rem;padding:.4rem .6rem;margin-bottom:.5rem;display:flex;gap:.4rem;flex-wrap:wrap;align-items:center;"><b>🏢 I-set ang club nang sabay-sabay</b><span style="font-size:.82rem;color:#475569;">Hanapin (hal. "Kenneth") → ☑️ piliin lahat ng resulta → pumili ng club → I-assign. ${L.length} resulta · <b>${n} napili</b></span>
  <button class="btn btn-secondary btn-sm" onclick="pxMselAll(true)">☑️ Piliin lahat ng resulta (${L.length})</button><button class="btn btn-secondary btn-sm" onclick="pxMselAll(false,true)">✖ Clear</button>
  <select id="mb-club"><option value="">— Club —</option>${PX.clubs.map(c => `<option value="${pxE(c.id)}">${pxE(c.name)}</option>`).join('')}</select><button class="btn btn-success btn-sm" onclick="pxMemBulkClub()">💾 I-assign sa club</button></div>`;
}
function pxMsel(id, on) { (PX.msel = PX.msel || {})[id] = !!on; clearTimeout(PX._mt); PX._mt = setTimeout(pxBody, 150); }
function pxMselAll(on, clr) { PX.msel = clr ? {} : (PX.msel || {}); if (!clr) (PX._mL || []).forEach(id => { PX.msel[id] = !!on; }); pxBody(); }
async function pxMemBulkClub() {
  const cid = (document.getElementById('mb-club') || {}).value, cl = PX.clubs.find(c => c.id === cid), ids = Object.keys(PX.msel || {}).filter(k => PX.msel[k]);
  if (!cl) { await pxAlert('Pumili muna ng club.'); return; } if (!ids.length) { await pxAlert('Wala pang napiling member. Hanapin at i-check ang mga member.'); return; }
  const set = new Map(); ids.forEach(id => { const m = PX.members.find(x => x.id === id); if (!m) return; const p = pxMemParent(m) || m; set.set(p.id, p); pxMemDeps(p).forEach(x => set.set(x.id, x)); }); // sumusunod ang asawa/anak sa club ng principal
  if (!await pxConfirm(`I-set ang club na "${cl.name}" sa ${ids.length} napiling member${set.size > ids.length ? ' (+ ' + (set.size - ids.length) + ' asawa/anak nila, sumusunod sa principal)' : ''}?`, { ok: 'I-assign' })) return;
  const arr = [...set.values()]; let done = 0, fail = 0; const tk = (typeof kTask === 'function') ? kTask('Pag-assign ng club (' + cl.name + ')', arr.length) : null;
  for (let i = 0; i < arr.length; i += 20) { await Promise.all(arr.slice(i, i + 20).map(async m => { try { await db.collection('pos_members').doc(m.id).update({ club: cl.name, clubId: cl.id }); m.club = cl.name; m.clubId = cl.id; done++; } catch (e) { fail++; } })); if (tk) tk.set(done + fail); }
  PX._ms = null; PX.msel = {}; if (tk) tk.done(fail ? done + ' ok, ' + fail + ' pumalya' : 'Tapos na: ' + done + ' member'); try { await logSystemAction('POS_MEMBER_BULK_CLUB', cl.name + ': ' + done + ' member'); } catch (e) {}
  await pxAlert(`✅ Na-assign ang club na "${cl.name}" sa ${done} member${fail ? ' · ' + fail + ' ang pumalya' : ''}.`); pxBody();
}

/* ================= MEMBERS: EXPORT / IMPORT / RESTORE POINT ================= */
function pxCsvParse(text) {
  text = String(text || '').replace(/^﻿/, ''); const first = text.split(/\r?\n/)[0] || '', cnt = c => (first.match(new RegExp(c === '\t' ? '\\t' : '\\' + c, 'g')) || []).length;
  const d = [[',', cnt(',')], [';', cnt(';')], ['\t', cnt('\t')]].sort((a, b) => b[1] - a[1])[0][0], rows = []; let r = [], f = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) { if (ch === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += ch; }
    else if (ch === '"') q = true; else if (ch === d) { r.push(f); f = ''; } else if (ch === '\n' || ch === '\r') { if (ch === '\r' && text[i + 1] === '\n') i++; r.push(f); f = ''; rows.push(r); r = []; } else f += ch;
  }
  if (f !== '' || r.length) { r.push(f); rows.push(r); } return rows.filter(x => x.some(c => String(c).trim() !== ''));
}
const pxCsvCell = v => { v = String(v == null ? '' : v); return /[",\n\r;]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
function pxDownload(name, text) { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['﻿' + text], { type: 'text/csv;charset=utf-8' })); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500); }
function pxMemCsv(list) { return ['ID No.,Pangalan,Club,Petsa ng Rehistro,Status,Tala,Principal ID,Relasyon'].concat(list.map(m => [m.mid, m.name, m.club, m.regDate, m.active === false ? 'Inactive' : 'Active', m.note, m.parentMid || '', m.parentMid ? m.rel || 'Dependent' : ''].map(pxCsvCell).join(','))).join('\r\n'); }
function pxMemExport() { const L = PX.members.slice().sort((a, b) => String(a.name).localeCompare(String(b.name))); pxDownload('members_' + pxSlug(pxCo()) + '_' + pxToday() + '.csv', pxMemCsv(L)); pxToast('⬇️ Na-export ang ' + L.length + ' member'); }
function pxMemTemplate() { pxDownload('members_template.csv', 'ID No.,Pangalan,Club,Petsa ng Rehistro,Status,Tala,Principal ID,Relasyon\r\n0001,Juan Dela Cruz,Alabang Sports Club,2024-01-15,Active,,,\r\n0001-S,Maria Dela Cruz,Alabang Sports Club,2024-01-15,Active,,0001,Spouse\r\n0001-D1,Jose Dela Cruz,Alabang Sports Club,2024-01-15,Active,,0001,Dependent\r\n0002,Maria Santos,Alabang Sports Club,2024-02-03,Inactive,,,'); }
function pxDate(v) {
  v = String(v == null ? '' : v).trim(); if (!v) return ''; if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  if (/^\d{5}$/.test(v)) { const d = new Date(Date.UTC(1899, 11, 30) + (+v) * 864e5); return d.toISOString().slice(0, 10); }
  let m = v.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/); if (m) { let a = +m[1], b = +m[2], y = +m[3]; if (y < 100) y += 2000; const mo = a > 12 ? b : a, da = a > 12 ? a : b; if (mo >= 1 && mo <= 12 && da >= 1 && da <= 31) return y + '-' + String(mo).padStart(2, '0') + '-' + String(da).padStart(2, '0'); }
  m = v.match(/^(\d{4})[\/.](\d{1,2})[\/.](\d{1,2})$/); if (m) return m[1] + '-' + String(m[2]).padStart(2, '0') + '-' + String(m[3]).padStart(2, '0'); return null;
}
function pxMemPlan(rows, mode) {
  const P = { ok: false, err: [], add: [], upd: [], same: 0, del: [], newClubs: [], total: 0, mode };
  if (rows.length < 2) { P.err.push('Walang laman ang file (kailangan ng header at kahit isang row).'); return P; }
  const H = rows[0].map(h => String(h).toLowerCase().replace(/[^a-z0-9]/g, '')), find = re => H.findIndex(h => re.test(h));
  const ci = { id: find(/^(id|idno|idnumber|memberid|mid|cardno|cardnumber|membershipid|memberno)$/), name: find(/^(pangalan|name|membername|fullname|member)$/), club: find(/^(club|clubname)$/), reg: find(/^(petsangrehistro|registered|registereddate|regdate|date|datereg|petsa|dateregistered)$/), note: find(/^(tala|note|notes|remarks)$/), par: find(/^(principalid|principal|parentid|parent|parentmid|headid|mainid|mainmember)$/), rel: find(/^(relasyon|relationship|relation|rel|uri)$/), st: find(/^(status|active|kalagayan|membershipstatus)$/) };
  if (ci.id < 0 || ci.name < 0) { P.err.push('Walang column na "ID No." o "Pangalan" sa header. Gamitin ang template.'); return P; }
  const fileIds = {}, clubOfFile = {}; rows.slice(1).forEach(r => { const x = String(r[ci.id] || '').trim(); if (x) { fileIds[pxSlug(x)] = x; if (ci.club >= 0) clubOfFile[pxSlug(x)] = String(r[ci.club] || '').trim(); } });
  const co = pxSlug(pxCo()), have = {}, byId = {}; PX.members.forEach(m => { have[pxSlug(m.mid)] = m; byId[m.id] = m; }); const seen = {}, clubKnown = {}; PX.clubs.forEach(c => { clubKnown[String(c.name).toLowerCase()] = 1; }); const newClub = {};
  rows.slice(1).forEach((r, i) => {
    let ln = i + 2, mid = String(r[ci.id] || '').trim(), name = String(r[ci.name] || '').trim(), club = ci.club >= 0 ? String(r[ci.club] || '').trim() : '', note = ci.note >= 0 ? String(r[ci.note] || '').trim() : '', sraw = ci.st >= 0 ? String(r[ci.st] || '').trim() : '', act = sraw ? !/^(inactive|in-active|hindi|no|n|0|false|off|expired|suspended)/i.test(sraw) : null;
    P.total++; if (!mid || !name) { P.err.push('Row ' + ln + ': kulang ang ' + (!mid ? 'ID' : 'pangalan') + ' — nilaktawan.'); return; }
    let pmid = ci.par >= 0 ? String(r[ci.par] || '').trim() : '', rel = ci.rel >= 0 ? String(r[ci.rel] || '').trim() : ''; const sp = pxIdSplit(mid);
    if (!pmid && sp) { const bs = pxSlug(sp.base); if (fileIds[bs] || PX.members.some(x => pxSlug(x.mid) === bs)) { pmid = fileIds[bs] || sp.base; if (!rel) rel = sp.rel; } else if (ci.par < 0 || !pmid) P.err.push('Row ' + ln + ': ang ID "' + mid + '" ay mukhang dependent pero walang principal na "' + sp.base + '" — ituturing na principal siya.'); } // auto-hula mula sa ID
    if (pmid && pxSlug(pmid) === pxSlug(mid)) pmid = ''; if (pmid && !fileIds[pxSlug(pmid)] && !PX.members.some(x => pxSlug(x.mid) === pxSlug(pmid))) { P.err.push('Row ' + ln + ': walang principal na "' + pmid + '" para kay ' + mid + ' — ituturing na principal siya.'); pmid = ''; } if (!pmid) rel = ''; else { pmid = fileIds[pxSlug(pmid)] || (PX.members.find(x => pxSlug(x.mid) === pxSlug(pmid)) || {}).mid || pmid; if (!rel) rel = 'Dependent'; }
    const sl = pxSlug(mid); if (!sl) { P.err.push('Row ' + ln + ': di-wasto ang ID "' + mid + '" — nilaktawan.'); return; } if (seen[sl]) { P.err.push('Row ' + ln + ': doble ang ID "' + mid + '" (nasa row ' + seen[sl] + ') — nilaktawan.'); return; } seen[sl] = ln;
    let reg = ''; if (ci.reg >= 0 && String(r[ci.reg] || '').trim()) { reg = pxDate(r[ci.reg]); if (reg === null) { P.err.push('Row ' + ln + ': di mabasa ang petsa "' + r[ci.reg] + '" (gamitin ang yyyy-mm-dd) — blangko ang inilagay.'); reg = ''; } }
    if (club && !clubKnown[club.toLowerCase()] && !newClub[club.toLowerCase()]) { newClub[club.toLowerCase()] = club; P.newClubs.push(club); }
    if (pmid && !club) club = clubOfFile[pxSlug(pmid)] || ((PX.members.find(x => pxSlug(x.mid) === pxSlug(pmid)) || {}).club || ''); // sumusunod sa club ng principal
    if (club && !clubKnown[club.toLowerCase()] && !newClub[club.toLowerCase()]) { newClub[club.toLowerCase()] = club; P.newClubs.push(club); }
    const ex = have[sl] || byId[co + '__' + sl];
    if (!ex) P.add.push({ id: co + '__' + sl, mid, name, club, regDate: reg || pxToday(), note, active: act !== false, parentMid: pmid, rel });
    else { const ch = {}; if (ex.name !== name) ch.name = name; if ((ex.club || '') !== club) ch.club = club; if (reg && (ex.regDate || '') !== reg) ch.regDate = reg; if ((ex.note || '') !== note && (note || ex.note)) ch.note = note; if (act !== null && (ex.active !== false) !== act) ch.active = act; if (ci.par >= 0 || pmid) { if ((ex.parentMid || '') !== pmid) ch.parentMid = pmid; if ((ex.rel || '') !== rel) ch.rel = rel; } if (Object.keys(ch).length) P.upd.push({ id: ex.id, mid: ex.mid, before: ex, ch }); else P.same++; }
  });
  if (mode === 'replace') { P.del = PX.members.filter(m => !seen[pxSlug(m.mid)]); }
  P.ok = P.add.length + P.upd.length + P.del.length > 0; return P;
}
let PX_IMP = null;
function pxMemImport() {
  PX_IMP = { mode: 'merge', rows: null, file: '' };
  pxModal(`<h3 style="margin-top:0;">⬆️ I-import ang mga Member</h3>
  ${pxHint('📖 <b>Hakbang:</b> (1) Pindutin ang <b>⬇️ Export</b> sa Members para makuha ang kasalukuyang listahan (o <b>Template</b> kung bago). (2) Buksan sa Excel, i-edit/dagdagan, at <b>Save As → CSV UTF-8</b>. (3) Piliin ang file dito — makikita mo muna ang <b>preview</b> ng mangyayari bago i-apply. (4) Bago mag-apply, <b>awtomatikong gagawa ng Restore Point</b> para maibalik mo kung nagkamali.<br>⚠️ Sa Excel, i-format muna ang ID column bilang <b>Text</b> para hindi mawala ang zero sa unahan (hal. 00123).')}
  <div style="display:flex;gap:.4rem;flex-wrap:wrap;align-items:center;"><input type="file" id="mi-f" accept=".csv,.txt,text/csv" onchange="pxMemImpFile(this)"><button class="btn btn-secondary btn-sm" onclick="pxMemTemplate()">📄 Template</button></div>
  <div id="mi-body" style="margin-top:.5rem;"></div>`, 760);
}
function pxMemImpFile(inp) { const f = inp.files && inp.files[0]; if (!f) return; PX_IMP.file = f.name; const r = new FileReader(); r.onload = () => { PX_IMP.rows = pxCsvParse(r.result); pxMemImpPrev(); }; r.readAsText(f, 'utf-8'); }
function pxMemImpMode(m) { PX_IMP.mode = m; pxMemImpPrev(); }
function pxMemImpPrev() {
  const el = document.getElementById('mi-body'); if (!el || !PX_IMP.rows) return; const P = PX_IMP.plan = pxMemPlan(PX_IMP.rows, PX_IMP.mode), cur = PX.members.length;
  const li = (a, f) => a.slice(0, 6).map(f).join('') + (a.length > 6 ? '<div style="color:#64748b;">…at ' + (a.length - 6) + ' pa</div>' : '');
  el.innerHTML = `<div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:.4rem;padding:.5rem;font-size:.85rem;"><b>${pxE(PX_IMP.file)}</b> — ${P.total} row sa file · kasalukuyan: <b>${cur}</b> member<br>
  ➕ Bago: <b style="color:#166534;">${P.add.length}</b> · ✏️ Mababago: <b style="color:#b45309;">${P.upd.length}</b> · ➖ Walang pagbabago: ${P.same}${PX_IMP.mode === 'replace' ? ' · 🗑️ Mabubura: <b style="color:#dc2626;">' + P.del.length + '</b>' : ''} · ⚠ Problema: <b style="color:${P.err.length ? '#dc2626' : '#166534'};">${P.err.length}</b><br>
  <b>Pagkatapos:</b> ${PX_IMP.mode === 'replace' ? P.total - P.err.filter(x => /nilaktawan/.test(x)).length : cur + P.add.length} member${P.newClubs.length ? '<br>🏢 Bagong club na gagawin: ' + pxE(P.newClubs.join(', ')) : ''}</div>
  <div style="margin:.5rem 0;font-size:.85rem;"><label style="display:block;"><input type="radio" name="mi-m" ${PX_IMP.mode === 'merge' ? 'checked' : ''} onchange="pxMemImpMode('merge')"> <b>Idagdag / i-update lang</b> — ang mga wala sa file ay mananatili.</label><label style="display:block;"><input type="radio" name="mi-m" ${PX_IMP.mode === 'replace' ? 'checked' : ''} onchange="pxMemImpMode('replace')"> <b>Palitan ang lahat</b> — ang listahan ay magiging kapareho ng file (mabubura ang wala sa file).</label></div>
  ${P.add.length ? '<details open><summary>➕ Bago (sample)</summary><div style="font-size:.8rem;">' + li(P.add, x => '<div>' + pxE(x.mid) + ' — ' + pxE(x.name) + ' <small>' + pxE(x.club) + '</small></div>') + '</div></details>' : ''}
  ${P.upd.length ? '<details><summary>✏️ Mababago (sample)</summary><div style="font-size:.8rem;">' + li(P.upd, x => '<div>' + pxE(x.mid) + ': ' + Object.keys(x.ch).map(k => pxE(k) + ' "' + pxE(k === 'active' ? (x.before.active === false ? 'Inactive' : 'Active') : (x.before[k] || '')) + '" → "' + pxE(k === 'active' ? (x.ch[k] ? 'Active' : 'Inactive') : x.ch[k]) + '"').join('; ') + '</div>') + '</div></details>' : ''}
  ${PX_IMP.mode === 'replace' && P.del.length ? '<details open><summary style="color:#dc2626;">🗑️ Mabubura (sample)</summary><div style="font-size:.8rem;">' + li(P.del, x => '<div>' + pxE(x.mid) + ' — ' + pxE(x.name) + '</div>') + '</div></details>' : ''}
  ${P.err.length ? '<details><summary style="color:#dc2626;">⚠ Mga problema</summary><div style="font-size:.8rem;">' + P.err.slice(0, 25).map(x => '<div>' + pxE(x) + '</div>').join('') + (P.err.length > 25 ? '<div>…at ' + (P.err.length - 25) + ' pa</div>' : '') + '</div></details>' : ''}
  <button class="btn btn-success" style="margin-top:.5rem;" ${P.ok ? '' : 'disabled'} onclick="pxMemImpApply()">✅ I-apply (may Restore Point muna)</button>`;
}
async function pxBatch(ops, step) {
  for (let i = 0; i < ops.length; i += 400) {
    const b = db.batch(); ops.slice(i, i + 400).forEach(o => { const r = db.collection(o.col).doc(o.id); if (o.t === 'del') b.delete(r); else if (o.merge) b.set(r, o.d, { merge: true }); else b.set(r, o.d); }); await b.commit(); if (step) step(Math.min(ops.length, i + 400), ops.length);
  }
}
async function pxMemReload() { const [mb, cl] = await Promise.all([db.collection('pos_members').where('company', '==', pxCo()).get(), db.collection('pos_clubs').where('company', '==', pxCo()).get()]); PX._mx = null; PX.members = []; mb.forEach(x => PX.members.push(Object.assign({ id: x.id }, x.data()))); PX.clubs = []; cl.forEach(x => PX.clubs.push(Object.assign({ id: x.id }, x.data()))); }
async function pxMemImpApply() {
  const P = PX_IMP.plan; if (!P || !P.ok) return; if (PX_IMP.mode === 'replace' && !await pxConfirm('Mabubura ang ' + P.del.length + ' member na wala sa file. May Restore Point para maibalik. Ituloy?')) return;
  const el = document.getElementById('mi-body'), say = t => { if (el) el.innerHTML = '<div style="padding:.6rem;">' + t + '</div>'; };
  try {
    say('📸 Gumagawa ng Restore Point…'); await pxRpMake('Bago mag-import: ' + PX_IMP.file + ' (' + (PX_IMP.mode === 'replace' ? 'palitan lahat' : 'idagdag/i-update') + ')');
    const co = pxCo(), me = String(pxMe().email || ''), now = new Date().toISOString(), ops = [];
    for (const nm of P.newClubs) { const id = pxSlug(co) + '__' + pxSlug(nm); ops.push({ t: 'set', col: 'pos_clubs', id, d: { company: co, name: nm, pct: 0 }, merge: true }); }
    const clubId = n => { const c = PX.clubs.find(x => String(x.name).toLowerCase() === String(n).toLowerCase()); return c ? c.id : n ? pxSlug(co) + '__' + pxSlug(n) : ''; };
    P.add.forEach(x => ops.push({ t: 'set', col: 'pos_members', id: x.id, d: { company: co, mid: x.mid, name: x.name, club: x.club, clubId: clubId(x.club), regDate: x.regDate, note: x.note || '', active: x.active !== false, parentMid: x.parentMid || '', rel: x.rel || '', addedBy: me, addedAt: now, importedAt: now } }));
    P.upd.forEach(x => { const d = Object.assign({}, x.ch, { updatedBy: me, importedAt: now }); if ('club' in x.ch) d.clubId = clubId(x.ch.club); ops.push({ t: 'set', col: 'pos_members', id: x.id, d, merge: true }); });
    if (PX_IMP.mode === 'replace') P.del.forEach(m => ops.push({ t: 'del', col: 'pos_members', id: m.id }));
    await pxBatch(ops, (a, b) => say('💾 Sine-save… ' + a + ' / ' + b)); await pxMemReload(); pxClose(); pxBody(); pxToast('✅ Na-import: +' + P.add.length + ' bago, ' + P.upd.length + ' na-update' + (P.del.length ? ', ' + P.del.length + ' nabura' : '') + ' (may Restore Point)');
  } catch (e) { say('<span style="color:#dc2626;">Error: ' + pxE(e.message) + '</span><br>Walang nasirang data bago ang Restore Point; puwede mong i-check sa 🕘 Restore Points.'); }
}
/* ---- Restore Points ---- */
async function pxRpMake(reason) {
  const co = pxCo(), snap = await db.collection('pos_members').where('company', '==', co).get(), rows = []; snap.forEach(x => { const d = x.data(); rows.push({ id: x.id, mid: d.mid || '', name: d.name || '', club: d.club || '', clubId: d.clubId || '', regDate: d.regDate || '', note: d.note || '', active: d.active !== false, parentMid: d.parentMid || '', rel: d.rel || '', addedBy: d.addedBy || '', addedAt: d.addedAt || '' }); });
  const cs = await db.collection('pos_clubs').where('company', '==', co).get(), clubs = []; cs.forEach(x => { const d = x.data(); clubs.push({ id: x.id, name: d.name || '', pct: d.pct || 0 }); });
  const id = 'RP-' + Date.now().toString(36), parts = Math.max(1, Math.ceil(rows.length / 1500)), ops = [];
  for (let i = 0; i < parts; i++) ops.push({ t: 'set', col: 'pos_restore', id: id + '__' + (i + 1), d: { company: co, kind: 'chunk', parent: id, rows: rows.slice(i * 1500, (i + 1) * 1500) } });
  ops.push({ t: 'set', col: 'pos_restore', id, d: { company: co, kind: 'members', at: new Date().toISOString(), atMs: Date.now(), by: String(pxMe().email || ''), count: rows.length, parts, reason: reason || 'Manual', clubs } });
  await pxBatch(ops); try { const L = await pxRpList(); for (const old of L.slice(20)) await pxRpDel(old.id, true); } catch (e) {} return id;
}
async function pxRpList() { const s = await db.collection('pos_restore').where('company', '==', pxCo()).get(), L = []; s.forEach(x => { const d = x.data(); if (d.kind === 'members') L.push(Object.assign({ id: x.id }, d)); }); L.sort((a, b) => (b.atMs || 0) - (a.atMs || 0)); return L; }
async function pxRpDel(id, quiet) { const m = (await db.collection('pos_restore').doc(id).get()).data() || {}, ops = []; for (let i = 1; i <= (m.parts || 1); i++) ops.push({ t: 'del', col: 'pos_restore', id: id + '__' + i }); ops.push({ t: 'del', col: 'pos_restore', id }); await pxBatch(ops); if (!quiet) pxRpView(); }
async function pxRpNow() { try { pxToast('📸 Gumagawa…'); await pxRpMake('Manual na restore point'); pxToast('✅ Nagawa ang Restore Point'); pxRpView(); } catch (e) { pxAlert('Error: ' + e.message); } }
async function pxRpView() {
  pxModal('<div style="padding:.5rem;">Kinukuha…</div>', 720); let L = []; try { L = await pxRpList(); } catch (e) { pxModal('<div style="color:#dc2626;">Error: ' + pxE(e.message) + '</div>'); return; }
  pxModal(`<h3 style="margin-top:0;">🕘 Restore Points ng Members</h3>${pxHint('📖 Ang <b>Restore Point</b> ay kopya ng buong listahan ng member (at club %) sa isang sandali. Awtomatiko itong ginagawa <b>bago ang bawat import</b> at bago ang bawat pag-restore. Pindutin ang <b>♻️ Ibalik</b> para maging eksaktong kapareho ng kopyang iyon ang listahan (ang mga naidagdag pagkatapos ay mabubura). Ang huling 20 lang ang itinatago.')}
  <button class="btn btn-primary btn-sm" onclick="pxRpNow()">📸 Gumawa ng Restore Point ngayon (${PX.members.length} member)</button>
  <table class="table" style="font-size:.82rem;margin-top:.5rem;"><tr><th>Petsa/Oras</th><th style="text-align:right;">Member</th><th>Dahilan</th><th>Ni</th><th></th></tr>${L.map(r => `<tr><td>${pxE(new Date(r.atMs || r.at).toLocaleString('en-PH'))}</td><td style="text-align:right;"><b>${r.count}</b></td><td>${pxE(r.reason)}</td><td><small>${pxE(r.by)}</small></td><td><button class="btn btn-warning btn-sm" onclick="pxRpRestore('${r.id}')">♻️ Ibalik</button> <button class="btn btn-secondary btn-sm" onclick="pxRpCsv('${r.id}')" title="I-download bilang CSV">⬇️</button> <button class="btn btn-danger btn-sm" onclick="pxRpDel('${r.id}')">🗑️</button></td></tr>`).join('') || '<tr><td colspan="5"><small>Wala pang restore point.</small></td></tr>'}</table>`, 720);
}
async function pxRpRows(id) { const m = (await db.collection('pos_restore').doc(id).get()).data(); if (!m) throw new Error('Wala na ang restore point.'); let rows = []; for (let i = 1; i <= (m.parts || 1); i++) { const c = (await db.collection('pos_restore').doc(id + '__' + i).get()).data(); rows = rows.concat((c || {}).rows || []); } return { meta: m, rows }; }
async function pxRpCsv(id) { try { const { rows } = await pxRpRows(id); pxDownload('members_restorepoint_' + id + '.csv', pxMemCsv(rows)); } catch (e) { pxAlert('Error: ' + e.message); } }
async function pxRpRestore(id) {
  try {
    const { meta, rows } = await pxRpRows(id); if (!await pxConfirm('Ibabalik ang listahan sa ' + meta.count + ' member (kopya noong ' + new Date(meta.atMs || meta.at).toLocaleString('en-PH') + '). Kasalukuyan: ' + PX.members.length + '. Gagawa muna ng bagong Restore Point. Ituloy?')) return;
    pxModal('<div style="padding:.6rem;">📸 Gumagawa ng safety Restore Point…</div>'); await pxRpMake('Bago i-restore sa ' + new Date(meta.atMs || meta.at).toLocaleString('en-PH'));
    const keep = {}; rows.forEach(r => { keep[r.id] = 1; }); const cur = await db.collection('pos_members').where('company', '==', pxCo()).get(), ops = [];
    cur.forEach(x => { if (!keep[x.id]) ops.push({ t: 'del', col: 'pos_members', id: x.id }); });
    (meta.clubs || []).forEach(c => ops.push({ t: 'set', col: 'pos_clubs', id: c.id, d: { company: pxCo(), name: c.name, pct: c.pct }, merge: true }));
    rows.forEach(r => { const d = Object.assign({ company: pxCo() }, r); delete d.id; ops.push({ t: 'set', col: 'pos_members', id: r.id, d }); });
    await pxBatch(ops, (a, b) => pxModal('<div style="padding:.6rem;">♻️ Ibinabalik… ' + a + ' / ' + b + '</div>')); await pxMemReload(); pxClose(); pxBody(); pxToast('✅ Naibalik: ' + rows.length + ' member');
  } catch (e) { pxAlert('Error: ' + e.message); pxClose(); }
}

/* ================= DIALOGS (modal lahat — walang native popup) ================= */
const PX_DLG = {};
let PX_LASTAL = '';
function pxOv(id, html, z, w) {
  let o = document.getElementById(id); if (!o) { o = document.createElement('div'); o.id = id; document.body.appendChild(o); }
  o.style.cssText = 'position:fixed;inset:0;background:rgba(15,23,42,.55);display:flex;align-items:center;justify-content:center;padding:1rem;z-index:' + (z || 10200) + ';';
  o.innerHTML = '<div style="background:#fff;border-radius:.8rem;max-width:' + (w || 460) + 'px;width:100%;max-height:92vh;max-height:92dvh;overflow:auto;padding-bottom:2rem;padding:1rem;box-shadow:0 20px 50px rgba(0,0,0,.35);">' + html + '</div>'; return o;
}
function pxOvHide(id) { const o = document.getElementById(id); if (o) o.style.display = 'none'; }
function pxDlg(k, v) { const f = PX_DLG[k]; PX_DLG[k] = null; pxOvHide('px-d' + k); if (f) f(v); }
function pxDlgOpen(k, html, z, w) { if (PX_DLG[k]) { const f = PX_DLG[k]; PX_DLG[k] = null; f(k === 'c' ? false : null); } return new Promise(res => { PX_DLG[k] = res; pxOv('px-d' + k, html, z, w); }); }
const pxBtn = (cls, label, js, st) => `<button class="btn ${cls}" style="${st || ''}" onclick="${js}">${label}</button>`;
function pxAlert(msg, title) { PX_LASTAL = String(msg); return pxDlgOpen('a', `<h3 style="margin-top:0;">${pxE(title || 'ℹ️ Paalala')}</h3><div style="white-space:pre-wrap;line-height:1.4;">${pxE(msg)}</div>${pxBtn('btn-primary', 'OK', "pxDlg('a',true)", 'width:100%;margin-top:.8rem;padding:.7rem;')}`, 10400); }
function pxConfirm(msg, o) { o = o || {}; return pxDlgOpen('c', `<h3 style="margin-top:0;">${pxE(o.title || '❓ Kumpirmahin')}</h3><div style="white-space:pre-wrap;line-height:1.4;">${pxE(msg)}</div><div style="display:flex;gap:.5rem;margin-top:.8rem;">${pxBtn('btn-secondary', pxE(o.cancel || 'Hindi'), "pxDlg('c',false)", 'flex:1;padding:.7rem;')}${pxBtn(o.danger ? 'btn-danger' : 'btn-success', pxE(o.ok || 'Oo'), "pxDlg('c',true)", 'flex:1;padding:.7rem;')}</div>`, 10380); }
function pxPrompt(title, o) {
  o = o || {}; setTimeout(() => { const i = document.getElementById('px-pri'); if (i) i.focus(); }, 60);
  return pxDlgOpen('p', `<h3 style="margin-top:0;">${pxE(title)}</h3>${o.hint ? pxHint(o.hint) : ''}${o.label ? '<label style="font-weight:700;font-size:.8rem;">' + pxE(o.label) + '</label>' : ''}<input id="px-pri" type="${o.type || 'text'}" ${o.type === 'number' ? 'step="any" inputmode="decimal"' : ''} autocomplete="off" placeholder="${pxE(o.ph || '')}" value="${pxE(o.def || '')}" onkeydown="if(event.key==='Enter')pxDlg('p',this.value)" style="width:100%;box-sizing:border-box;font-size:1.1rem;padding:.6rem;">
  <div style="display:flex;gap:.5rem;margin-top:.8rem;">${pxBtn('btn-secondary', 'Kanselahin', "pxDlg('p',null)", 'flex:1;padding:.7rem;')}${pxBtn('btn-success', pxE(o.ok || 'OK'), "pxDlg('p',document.getElementById('px-pri').value)", 'flex:1;padding:.7rem;')}</div>`, 10390);
}
let PX_CHO = [];
function pxChoice(title, opts, o) { // opts: [{k,label,sub}] o {hint, cols, cancel}
  o = o || {}; const CH = PX_CHO = opts.filter(x => !x.h);
  const body = opts.map(x => x.h ? `<div style="grid-column:1/-1;font-weight:700;font-size:.8rem;color:#475569;margin-top:.3rem;">${pxE(x.h)}</div>` : `<button class="btn ${x.cls || 'btn-secondary'}" style="padding:.7rem .5rem;text-align:left;white-space:normal;line-height:1.2;" onclick="pxDlg('h',${PX_CHO.indexOf(x)})">${x.label}${x.sub ? '<br><small style="font-weight:400;">' + x.sub + '</small>' : ''}</button>`).join('');
  return pxDlgOpen('h', `<h3 style="margin-top:0;">${pxE(title)}</h3>${o.hint ? pxHint(o.hint) : ''}<div style="display:grid;grid-template-columns:repeat(${o.cols || 2},minmax(0,1fr));gap:.4rem;">${body}</div>${o.cancel === false ? '' : pxBtn('btn-secondary', 'Kanselahin', "pxDlg('h',null)", 'width:100%;margin-top:.7rem;')}`, 10385, o.w || 520).then(i => i == null || !CH[i] ? null : CH[i].k);
}
async function pxPin(msg) { if (pxMgr() || PX.mgrOn) return true; const p = await pxPrompt('🔐 Manager PIN', { hint: msg || 'Kailangan ng PIN ng admin/manager para sa aksyon na ito.', type: 'password', ph: 'PIN', ok: 'Kumpirmahin' }); if (p === null) return false; if (!await pxPinOk(p)) { await pxAlert('Mali ang PIN, o wala pang PIN na naka-set (Setup → Manager PIN).', '🔒 Hindi pinayagan'); return false; } return true; }

/* ================= VOID REASON (button) ================= */
const PX_VOIDWHY = [['test', '🧪 Test order'], ['wrong', '❌ Maling order'], ['changed', '🙅 Nagbago ang isip ng customer'], ['dup', '🔁 Doble ang order'], ['price', '💲 Maling presyo'], ['stock', '📦 Walang stock / ubos'], ['wait', '🐢 Natagalan / reklamo'], ['crew', '👨‍🍳 Pagkakamali ng crew / kusina'], ['quality', '🍽️ Hindi nagustuhan / quality'], ['pay', '🧾 Maling bayad / payment'], ['other', '✏️ Iba pa (isulat)']];
async function pxVoidWhy(title) { const k = await pxChoice(title || 'Bakit ibi-void?', PX_VOIDWHY.map(x => ({ k: x[0], label: x[1] })), { hint: 'Piliin ang dahilan. Naitatala ito kasama ang pangalan ng gumawa para sa ulat at audit.', cols: 2 }); if (!k) return null; if (k === 'other') { const t = await pxPrompt('Isulat ang dahilan', { ph: 'dahilan ng void', ok: 'Isumite' }); return t && t.trim() ? 'Iba pa: ' + t.trim() : null; } return PX_VOIDWHY.find(x => x[0] === k)[1].replace(/^\S+\s/, ''); }

/* ================= PAYMENT METHODS ================= */
const PX_CARDNET = ['Visa', 'Mastercard', 'JCB', 'American Express', 'UnionPay', 'Diners Club', 'Discover', 'Maestro', 'Bancnet', 'Iba pa'];
const PX_BANKS = ["BDO Unibank (BDO)", "Bank of the Philippine Islands (BPI)", "Metrobank", "Land Bank of the Philippines (Landbank)", "Philippine National Bank (PNB)", "Security Bank", "UnionBank of the Philippines", "Rizal Commercial Banking Corp. (RCBC)", "China Bank", "EastWest Bank", "Philippine Savings Bank (PSBank)", "Development Bank of the Philippines (DBP)", "Asia United Bank (AUB)", "Bank of Commerce", "Philippine Bank of Communications (PBCom)", "Philippine Business Bank (PBB)", "Philtrust Bank", "Robinsons Bank", "Sterling Bank of Asia", "Maybank Philippines", "CTBC Bank (Philippines)", "Citibank", "HSBC", "Standard Chartered", "Deutsche Bank", "JPMorgan Chase", "Bank of America", "Bank of China", "ICBC", "Mizuho", "MUFG Bank", "SMBC (Sumitomo Mitsui)", "KEB Hana Bank", "Shinhan Bank", "Woori Bank", "ANZ", "BNP Paribas", "ING Bank", "Industrial Bank of Korea (IBK)", "First Commercial Bank", "Cathay United Bank", "Mega International Commercial Bank", "Chinabank Savings", "BDO Network Bank", "RCBC Savings Bank", "Producers Savings Bank", "Malayan Bank Savings and Mortgage", "Citystate Savings Bank", "Camalig Bank", "Wealth Development Bank", "Queen City Development Bank", "CARD Bank", "Rural Bank (iba)", "Cooperative Bank (iba)", "GoTyme Bank", "Maya Bank", "Tonik Digital Bank", "UNO Digital Bank", "UnionDigital Bank", "OFBank (Overseas Filipino Bank)", "CIMB Bank Philippines", "Netbank", "Seabank Philippines", "Komo (EastWest Rural Bank)", "GCash (GXI)", "Wells Fargo", "Capital One", "American Express (US)", "Barclays", "Lloyds", "Iba pang bangko (i-type ang pangalan)"];
const PX_PAYGROUPS = [['Cash', ['cash']], ['E-wallet / QR', ['gcash', 'maya', 'qrph']], ['Card', ['debit', 'credit', 'intl']], ['Online / Transfer', ['paypal', 'bank']], ['Charge', ['member', 'org']]];
const PX_REFREQ = ['gcash', 'maya', 'qrph', 'debit', 'credit', 'intl', 'paypal', 'bank'];
async function pxPayStart() {
  if (!PX.cart.length) return; if (pxNeedBill()) { if (await pxConfirm('I-print muna ang Bill (para ma-confirm ng customer na tama ang order) bago mag-settle. Kapag may binago pagkatapos (item, presyo, discount), i-print ulit.', { ok: '🖨️ Print Bill ngayon', title: '🖨️ Print Bill muna' })) await pxBillPrintNow(); return; } if (pxApp()) { const ch = pxChan(), C = pxCalc(PX.cart, PX.disc); if (!PX.chanRef) { await pxAlert('Ilagay muna ang Order No. ng ' + PX_CH[ch].n + ' sa itaas ng order.'); return; } PX.pays = [{ mode: ch, amount: C.total, ref: PX.chanRef }]; pxBody(); pxToast('🧾 Receivable mula sa ' + PX_CH[ch].n); return; } const opts = []; PX_PAYGROUPS.forEach(([h, ks]) => { const ok = ks.filter(k => (k !== 'member' || PX.cfg.members !== false) && (k !== 'org' || PX.event)); if (!ok.length) return; opts.push({ h }); ok.forEach(k => opts.push({ k, label: PX_MODES[k] })); });
  const k = await pxChoice('💳 Paraan ng bayad', opts, { cols: 3, hint: 'Piliin ang paraan. Para sa e-wallet/card/online, hihingin ang <b>reference number</b> na lalabas sa slip.', w: 560 }); if (!k) return; pxPayMode(k);
}
async function pxPayMode(k) {
  const C = pxCalc(PX.cart, PX.disc), paid = PX.pays.reduce((s, p) => s + p.amount, 0), bal = pxR2(C.total - paid);
  if (k === 'member') return pxChargeWho(bal); if (k === 'org') { const n = await pxPrompt('🏢 Charge to Organizer', { hint: 'Pangalan ng organizer / kliyente na sisingilin para sa event.', ph: 'pangalan ng organizer', ok: 'Idagdag' }); if (!n || !n.trim()) return; PX.pays.push({ mode: 'org', amount: pxR2(bal > 0 ? bal : 0), ref: n.trim() }); pxBody(); return; }
  PX_PD = { mode: k, bal, net: '' }; pxPayForm();
}
let PX_PD = null;
function pxPayForm(err) {
  const k = PX_PD.mode, card = ['debit', 'credit', 'intl'].includes(k), need = PX_REFREQ.includes(k), tm = PX.member && PX.member.name;
  pxOv('px-dpd', `<h3 style="margin-top:0;">${PX_MODES[k]}</h3>${k === 'intl' ? pxHint('Para sa mga card at account galing ibang bansa (hal. Visa/Mastercard/AmEx ng US/ibang bansa).') : ''}
  <label style="font-weight:700;font-size:.8rem;">Halaga</label><input id="pd-amt" type="number" step="any" inputmode="decimal" oninput="PX_CASHN={};this.dataset.t='1';pxCashShow()" value="${PX_PD.bal > 0 ? PX_PD.bal : ''}" style="width:100%;box-sizing:border-box;font-size:1.2rem;padding:.5rem;">
  ${k === 'cash' ? pxCashPad() : ''}
  ${card ? `<label style="font-weight:700;font-size:.8rem;">Card network</label><div id="pd-net" style="display:flex;gap:.3rem;flex-wrap:wrap;margin-bottom:.3rem;">${PX_CARDNET.map(n => `<button class="btn ${PX_PD.net === n ? 'btn-primary' : 'btn-secondary'} btn-sm" onclick="pxPayNet('${n}')">${n}</button>`).join('')}</div><label style="font-weight:700;font-size:.8rem;">Huling 4 na numero ng card (opsyonal)</label><input id="pd-l4" inputmode="numeric" maxlength="4" placeholder="1234" style="width:100%;box-sizing:border-box;">` : ''}
  ${card || k === 'bank' ? `<label style="font-weight:700;font-size:.8rem;">${k === 'bank' ? 'Bangko *' : 'Bangko / issuer (opsyonal)'}</label><input id="pd-bank" list="pd-bl" placeholder="${k === 'bank' ? 'Piliin o i-type ang bangko' : 'hal. BDO, Chase…'}" autocomplete="off" style="width:100%;box-sizing:border-box;"><datalist id="pd-bl">${PX_BANKS.map(b => `<option value="${b}">`).join('')}</datalist>${k === 'bank' ? pxHint('Simulan ang pag-type ng pangalan (hal. "BPI", "Metro") — lalabas ang listahan ng mga bangko sa Pilipinas. Puwede ring mag-type ng wala sa listahan.') : ''}` : ''}
  ${need ? `<label style="font-weight:700;font-size:.8rem;">Reference no. ${k === 'debit' || k === 'credit' || k === 'intl' ? '(approval / trace / RRN)' : '(transaction ref)'} *</label><input id="pd-ref" autocomplete="off" placeholder="hal. 1234567890" style="width:100%;box-sizing:border-box;font-size:1.05rem;padding:.5rem;">${pxHint('Lalabas ang reference number na ito sa slip para madaling i-trace ang bayad.')}` : ''}
  ${k !== 'cash' && (PX.member || (PX.ctx && PX.ctx.tableMember)) ? `<label style="font-weight:700;font-size:.8rem;">Pangalan ng nagbayad (opsyonal)</label><input id="pd-name" placeholder="${tm ? 'Kung blangko: ' + pxE(PX.member.name) : 'hal. Juan Dela Cruz'}" style="width:100%;box-sizing:border-box;">` : ''}
  <div id="pd-err" style="color:#dc2626;margin-top:.3rem;font-weight:700;">${err ? pxE(err) : ''}</div>
  <div style="display:flex;gap:.5rem;margin-top:.8rem;">${pxBtn('btn-secondary', 'Kanselahin', "pxOvHide('px-dpd')", 'flex:1;padding:.7rem;')}${pxBtn('btn-success', '➕ Idagdag ang bayad', 'pxPayOk()', 'flex:2;padding:.7rem;')}</div>`, 10300);
}
const PX_DEN = [[1000, 'b', '#2563eb', '#dbeafe'], [500, 'b', '#ca8a04', '#fef9c3'], [200, 'b', '#16a34a', '#dcfce7'], [100, 'b', '#7c3aed', '#ede9fe'], [50, 'b', '#dc2626', '#fee2e2'], [20, 'b', '#ea580c', '#ffedd5'], [20, 'c', '#a16207', '#fde68a'], [10, 'c', '#a16207', '#fde68a'], [5, 'c', '#78716c', '#e7e5e4'], [1, 'c', '#78716c', '#e7e5e4']];
let PX_CASHN = {};
function pxCashPad() {
  PX_CASHN = {};
  const tile = ([v, t, c, bg], i) => t === 'b' ? `<button type="button" onclick="pxCashAdd(${i})" style="position:relative;width:92px;height:50px;border-radius:6px;border:2px solid ${c};background:linear-gradient(135deg,${bg},#fff 60%,${bg});color:${c};font-weight:800;cursor:pointer;touch-action:manipulation;padding:0;"><span style="position:absolute;left:5px;top:2px;font-size:.7rem;">${v}</span><span style="font-size:1.15rem;">₱${v}</span><span id="dn-${i}" style="display:none;position:absolute;right:-6px;top:-8px;background:#0f172a;color:#fff;border-radius:999px;min-width:22px;height:22px;line-height:22px;font-size:.78rem;"></span></button>` : `<button type="button" onclick="pxCashAdd(${i})" style="position:relative;width:54px;height:54px;border-radius:50%;border:3px double ${c};background:radial-gradient(circle,#fff,${bg});color:${c};font-weight:800;cursor:pointer;touch-action:manipulation;padding:0;">₱${v}<span id="dn-${i}" style="display:none;position:absolute;right:-6px;top:-8px;background:#0f172a;color:#fff;border-radius:999px;min-width:22px;height:22px;line-height:22px;font-size:.78rem;"></span></button>`;
  return `<div style="margin:.4rem 0;"><div style="display:flex;gap:.4rem;flex-wrap:wrap;margin-bottom:.4rem;">${PX_DEN.map((d, i) => d[1] === 'b' ? tile(d, i) : '').join('')}</div><div style="display:flex;gap:.4rem;flex-wrap:wrap;align-items:center;">${PX_DEN.map((d, i) => d[1] === 'c' ? tile(d, i) : '').join('')}<button type="button" class="btn btn-secondary btn-sm" onclick="document.getElementById('pd-amt').value=${PX_PD.bal > 0 ? PX_PD.bal : 0};document.getElementById('pd-amt').dataset.t='1';PX_CASHN={};pxCashShow()">Eksakto</button><button type="button" class="btn btn-secondary btn-sm" onclick="pxCashClr()">↺ Clear</button></div><div id="pd-tally" style="margin-top:.4rem;font-weight:700;"></div></div>${pxHint('I-tap ang perang iniabot ng customer — bawat tap ay dagdag (hal. 2 tap sa ₱1,000 = ₱2,000). Awtomatikong makukuwenta ang sukli o kulang. Puwede ring i-type ang halaga.')}`;
}
function pxCashAdd(i) { const e = document.getElementById('pd-amt'); if (!e) return; if (!e.dataset.t) { e.dataset.t = '1'; e.value = ''; } e.value = pxR2((pxNum(e.value) || 0) + PX_DEN[i][0]); PX_CASHN[i] = (PX_CASHN[i] || 0) + 1; pxCashShow(); }
function pxCashClr() { const e = document.getElementById('pd-amt'); if (e) { e.value = ''; e.dataset.t = '1'; } PX_CASHN = {}; pxCashShow(); }
function pxCashShow() { PX_DEN.forEach((d, i) => { const b = document.getElementById('dn-' + i); if (b) { b.style.display = PX_CASHN[i] ? 'inline-block' : 'none'; b.textContent = '×' + (PX_CASHN[i] || 0); } }); const e = document.getElementById('pd-amt'), t = document.getElementById('pd-tally'); if (!e || !t || !PX_PD) return; const a = pxNum(e.value) || 0, bal = PX_PD.bal; t.innerHTML = !a ? '' : a >= bal ? `Tinanggap: ₱${pxM(a)} · <span style="color:#166534;">Sukli: ₱${pxM(a - bal)}</span>` : `Tinanggap: ₱${pxM(a)} · <span style="color:#dc2626;">Kulang pa: ₱${pxM(bal - a)}</span>`; }
function pxPayErr(m) { const e = document.getElementById('pd-err'); if (e) e.textContent = m; }
function pxPayNet(n) { PX_PD.net = n; const keep = ['pd-amt', 'pd-bank', 'pd-l4', 'pd-ref', 'pd-name'].map(i => (document.getElementById(i) || {}).value); pxPayForm(); ['pd-amt', 'pd-bank', 'pd-l4', 'pd-ref', 'pd-name'].forEach((i, x) => { const e = document.getElementById(i); if (e && keep[x] != null) e.value = keep[x]; }); }
function pxPayOk() {
  const k = PX_PD.mode, g = i => { const e = document.getElementById(i); return e ? e.value.trim() : ''; }; let amt = pxNum(g('pd-amt')); if (!(amt > 0)) { pxPayErr('Ilagay ang halaga.'); return; }
  const ref = g('pd-ref'); if (PX_REFREQ.includes(k) && !ref) { pxPayErr('Kailangan ang reference number.'); return; } if (['debit', 'credit', 'intl'].includes(k) && !PX_PD.net) { pxPayErr('Piliin ang card network.'); return; } if (k === 'bank' && !g('pd-bank')) { pxPayErr('Piliin o i-type ang bangko.'); return; }
  const C = pxCalc(PX.cart, PX.disc), paid = PX.pays.reduce((s, p) => s + p.amount, 0), bal = pxR2(C.total - paid); if (k !== 'cash' && bal > 0) amt = Math.min(amt, bal);
  const p = { mode: k, amount: pxR2(amt), ref }; if (g('pd-name')) p.payer = g('pd-name'); else if (k !== 'cash' && PX.member) p.payer = PX.member.name; if (PX_PD.net) p.net = PX_PD.net; if (g('pd-bank')) p.bank = g('pd-bank'); if (g('pd-l4')) p.last4 = g('pd-l4');
  PX.pays.push(p); pxOvHide('px-dpd'); pxBody();
}
function pxPayLabel(p) { return pxE((PX_MODES[p.mode] || p.mode).replace(/^\S+\s/, '')) + (p.net ? ' ' + pxE(p.net) : '') + (p.bank ? ' · ' + pxE(p.bank) : '') + (p.last4 ? ' ••' + pxE(p.last4) : ''); }
async function pxChargeWho(bal) { // kanino i-charge
  const tm = PX.ctx && PX.ctx.tableMember, opts = []; if (tm) opts.push({ k: 'table', label: '🪪 ' + pxE(tm.name), sub: 'Member ng table · ' + pxE(tm.mid) + ' · ' + pxE(tm.club || ''), cls: 'btn-primary' });
  opts.push({ k: 'other', label: '🔎 Ibang member', sub: 'Hanapin ang ID / pangalan' });
  const k = await pxChoice('🪪 Kanino i-charge?', opts, { cols: 1, hint: 'Piliin kung kaninong membership ang sisingilin. Para sa <b>card / e-wallet</b>, hindi na ito kailangan — nakatala na sa slip ang nagbayad.' }); if (!k) return;
  if (k === 'table') { const m = PX.members.find(x => x.id === tm.id) || tm; if (!pxMemActive(m)) { await pxAlert(pxMemWhy(m) + '. Hindi makakapag-settle ng Member Charge.', '⛔ Inactive ang membership'); return; } PX.member = pxMemSnap(m); pxMemCharge(bal); }
  else pxMemberPick(bal);
}
function pxMemCharge(bal) { const C = pxCalc(PX.cart, PX.disc), paid = PX.pays.reduce((s, p) => s + p.amount, 0), b = pxR2(C.total - paid); PX.pays.push({ mode: 'member', amount: pxR2(b > 0 ? b : (bal || 0)), ref: '' }); pxBody(); }

/* ================= CHECK MEMBERSHIP ================= */
/* ---------- Principal / Dependent (asawa, anak…) ---------- */
const PX_RELS = ['Spouse', 'Dependent', 'Parent Dependent', 'Iba pa'];
function pxMemIdx() { if (PX._mx && PX._mx.src === PX.members && PX._mx.n === PX.members.length) return PX._mx; const by = {}, dep = {}; PX.members.forEach(m => { by[pxSlug(m.mid)] = m; }); PX.members.forEach(m => { if (m.parentMid) { const k = pxSlug(m.parentMid); (dep[k] = dep[k] || []).push(m); } }); return (PX._mx = { src: PX.members, n: PX.members.length, by, dep }); }
const pxMemFull = m => (m && m.id && PX.members.find(x => x.id === m.id)) || m;
const pxMemParent = m => { m = pxMemFull(m); return m && m.parentMid ? pxMemIdx().by[pxSlug(m.parentMid)] || null : null; };
const pxMemDeps = m => (m && pxMemIdx().dep[pxSlug(m.mid)]) || [];
const pxMemOwn = m => !!m && m.active !== false;
const pxMemActive = m => { m = pxMemFull(m); if (!pxMemOwn(m)) return false; const p = pxMemParent(m); return !p || pxMemOwn(p); };
const pxMemWhy = m => { m = pxMemFull(m); if (!pxMemOwn(m)) return 'INACTIVE ang membership ni ' + m.name; const p = pxMemParent(m); return p && !pxMemOwn(p) ? 'INACTIVE ang principal na si ' + p.name + ' (' + p.mid + '), kaya hindi puwede ang dependent niyang si ' + m.name : ''; };
const pxRelOf = m => m && m.parentMid ? (m.rel || 'Dependent') : 'Principal';
function pxMemSnap(m) { const p = pxMemParent(m), b = p || m; return { id: m.id, mid: m.mid, name: m.name, club: b.club || '', clubId: b.clubId || '', active: pxMemActive(m), rel: pxRelOf(m), parentId: p ? p.id : '', parentMid: p ? p.mid : '', parentName: p ? p.name : '' }; }
/* hulaan ang principal mula sa ID: ABC123-S (asawa), ABC123-D1 (anak) */
function pxIdSplit(mid) { const m = String(mid || '').trim().match(/^(.+?)-(S\d*|D\d*)$/i); return m ? { base: m[1], rel: /^s/i.test(m[2]) ? 'Spouse' : 'Dependent' } : null; }
function pxNextDepId(p, rel) { const base = String(p.mid).trim(), ex = new Set(pxMemDeps(p).map(x => pxSlug(x.mid))); if (rel === 'Spouse') { let id = base + '-S', n = 1; while (ex.has(pxSlug(id)) || pxMemIdx().by[pxSlug(id)]) id = base + '-S' + (++n); return id; } let n = 1; while (pxMemIdx().by[pxSlug(base + '-D' + n)]) n++; return base + '-D' + n; }
const pxRelBadge = m => m.parentMid ? `<span style="background:#e0e7ff;color:#3730a3;border-radius:.6rem;padding:.05rem .45rem;font-size:.7rem;font-weight:700;">${pxE(m.rel || 'Dependent')}</span>` : (pxMemDeps(m).length ? `<span style="background:#fef3c7;color:#92400e;border-radius:.6rem;padding:.05rem .45rem;font-size:.7rem;font-weight:700;">Principal · 👥${pxMemDeps(m).length}</span>` : '');
const pxMemBadge = m => pxMemActive(m) ? '<span style="background:#dcfce7;color:#166534;border-radius:.6rem;padding:.05rem .45rem;font-size:.72rem;font-weight:700;">ACTIVE</span>' : '<span style="background:#fee2e2;color:#b91c1c;border-radius:.6rem;padding:.05rem .45rem;font-size:.72rem;font-weight:700;">INACTIVE</span>';
let PX_MC = null;
function pxMemCheck(cb, label) {
  PX_MC = { cb, sel: null, label };
  pxOv('px-dmc', `<h3 style="margin-top:0;">🪪 Check Membership</h3>${pxHint('📖 I-type ang <b>ID number o pangalan</b> ng member para makita kung <b>ACTIVE</b> ang membership at kung may problema ang account (hal. disputed na charge).')}<input id="mc-q" autocomplete="off" placeholder="ID No. o pangalan…" oninput="pxMcList()" style="width:100%;box-sizing:border-box;font-size:1.1rem;padding:.6rem;"><div id="mc-list" style="margin-top:.4rem;"></div><div id="mc-card"></div><button class="btn btn-secondary" style="width:100%;margin-top:.6rem;" onclick="pxOvHide('px-dmc')">Isara</button>`, 10250, 520);
  setTimeout(() => { const i = document.getElementById('mc-q'); if (i) i.focus(); }, 60);
}
function pxMcList() {
  const q = String((document.getElementById('mc-q') || {}).value || '').trim().toLowerCase(), box = document.getElementById('mc-list'); if (!box) return; const t = q.split(/\s+/).filter(Boolean);
  const r = t.length ? pxMemSearch(q).slice(0, 8) : []; PX_MC.res = r;
  box.innerHTML = r.map((m, i) => `<div onclick="pxMcSel(${i})" style="padding:.5rem;border:1px solid #e2e8f0;border-radius:.4rem;margin-bottom:.2rem;cursor:pointer;display:flex;justify-content:space-between;gap:.4rem;"><span><b>${pxE(m.name)}</b> · ${pxE(m.mid)} <small>${pxE(m.club)}</small> ${pxRelBadge(m)}</span>${pxMemBadge(m)}</div>`).join('') || (q ? '<small style="color:#94a3b8;">Walang tugma. Idagdag sa Members tab kung bago.</small>' : '');
}
async function pxMcSel(i) {
  const m = PX_MC.res[i]; if (!m) return; PX_MC.sel = m; const card = document.getElementById('mc-card'); if (!card) return; card.innerHTML = '<div style="padding:.5rem;">Sinusuri…</div>'; let dis = 0, mon = 0, n = 0; const ym = pxToday().slice(0, 7);
  try { (await db.collection('pos_sales').where('memberKey', '==', m.id).get()).forEach(x => { const s = x.data(); if (s.status === 'void') return; if (s.chargeStatus === 'disputed') dis++; if ((s.date || '').slice(0, 7) === ym && s.memberCharge > 0) { mon += +s.memberCharge || 0; n++; } }); } catch (e) {}
  const act = pxMemActive(m); card.innerHTML = `<div style="margin-top:.5rem;border:2px solid ${act ? '#16a34a' : '#dc2626'};border-radius:.6rem;padding:.6rem;"><div style="font-size:1.3rem;font-weight:800;color:${act ? '#166534' : '#b91c1c'};">${act ? '✅ ACTIVE' : '⛔ INACTIVE'}</div><b>${pxE(m.name)}</b> · ${pxE(m.mid)}<br>Club: ${pxE(m.club || '—')} · Nairehistro: ${pxE(m.regDate || '—')}<br>${m.parentMid ? 'Relasyon: <b>' + pxE(m.rel || 'Dependent') + '</b> ni <b>' + pxE((pxMemParent(m) || {}).name || m.parentMid) + '</b> (' + pxE(m.parentMid) + ') — <i>sa principal sisingilin ang charge</i><br>' : ''}${!m.parentMid && pxMemDeps(m).length ? 'Mga dependent (' + pxMemDeps(m).length + '): ' + pxMemDeps(m).slice(0, 8).map(d => pxE(d.name.split(',')[0] + ',' + (d.name.split(',')[1] || '').trim().split(' ')[0]) + ' <small>(' + pxE(d.rel || 'Dep') + ')</small>').join(', ') + (pxMemDeps(m).length > 8 ? '…' : '') + '<br>' : ''}${pxMemWhy(m) && pxMemOwn(m) ? '<b style="color:#b91c1c;">' + pxE(pxMemWhy(m)) + '</b><br>' : ''}Charges ngayong buwan: <b>₱${pxM(mon)}</b> (${n})${dis ? `<br><b style="color:#b45309;">⚠ May ${dis} na disputed na charge</b>` : ''}${act ? '' : '<br><b style="color:#b91c1c;">Hindi makakapag-settle ng Member Charge hangga\'t INACTIVE.</b>'}${PX_MC.cb ? `<button class="btn ${act ? 'btn-success' : 'btn-secondary'}" style="width:100%;margin-top:.5rem;padding:.6rem;" onclick="pxMcUse()">${pxE(PX_MC.label || '✔ Gamitin ang member na ito')}${act ? '' : ' (INACTIVE)'}</button>` : ''}</div>`;
}
function pxMcUse() { const m = PX_MC.sel, cb = PX_MC.cb; pxOvHide('px-dmc'); if (cb) cb(m); }

/* ---------- Manager PIN: naka-hash (PBKDF2), hindi plain text sa database ---------- */
const pxHex = b => Array.from(new Uint8Array(b)).map(x => x.toString(16).padStart(2, '0')).join('');
async function pxPinHash(pin, salt) { const k = await crypto.subtle.importKey('raw', new TextEncoder().encode(String(pin)), 'PBKDF2', false, ['deriveBits']); return pxHex(await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: new TextEncoder().encode(salt), iterations: 150000, hash: 'SHA-256' }, k, 256)); }
async function pxPinPack(pin) { if (!pin) return {}; const salt = pxHex(crypto.getRandomValues(new Uint8Array(16))); return { mgrPinHash: await pxPinHash(pin, salt), mgrPinSalt: salt, mgrPin: '' }; }
async function pxPinOk(p) { const c = PX.cfg || {}; if (c.mgrPinHash && c.mgrPinSalt) return (await pxPinHash(p, c.mgrPinSalt)) === c.mgrPinHash; return !!c.mgrPin && String(p) === String(c.mgrPin); }

/* ================= TABLES / FLOOR PLAN / ORDERS / SPLIT BILL / SETTLEMENT ================= */
const PX_FW = 1000, PX_FH = 560;
const PX_SHP = { sq: { w: 90, h: 90, n: '⬜ Square' }, rect: { w: 160, h: 90, n: '▭ Rectangle' }, round: { w: 100, h: 100, n: '⚪ Round' } };
const pxTabsOpen = () => (PX.tabs || []).filter(t => t.status === 'open');
const pxTabOf = tid => pxTabsOpen().find(t => t.tableId === tid);
const pxTabLines0 = t => { const M = {}; (t.orders || []).forEach(o => { if (o.status === 'void') return; (o.items || []).forEach(l => { const k = l.id + '|' + l.price + '|' + (o.chan || '') + '|' + ((o.owner || {}).name || ''); if (!M[k]) M[k] = { id: l.id, name: l.name, price: +l.price, qty: 0, ch: o.chan || '', ow: (o.owner || {}).name || '', om: (o.owner || {}).member || null }; M[k].qty += +l.qty; }); }); return Object.keys(M).map(k => M[k]); };
const pxLK = l => l.id + '|' + l.price + '|' + (l.ch || '') + '|' + (l.ow || '');
const pxTabFood = t => pxR2(pxTabLines0(t).reduce((s, l) => s + l.price * l.qty, 0));
const pxTabLines = t => { const L = pxTabLines0(t), r = typeof pxRoomInfo === 'function' ? pxRoomInfo(t) : null; if (r && !r.waived && r.fee > 0 && L.length) L.push({ id: '__room', name: 'Meeting room fee', price: r.fee, qty: 1 }); return L; };
const pxTabSub = t => pxR2(pxTabLines(t).reduce((s, l) => s + l.price * l.qty, 0));
async function pxFloorLoad() { try { const d = await db.collection('pos_floor').doc(PX.site).get(); PX.floor = d.exists ? d.data() : { tables: [] }; } catch (e) { PX.floor = PX.floor || { tables: [] }; } if (!PX.floor.tables) PX.floor.tables = []; }
/* ---------- Mga Layout (Main, Extension, Yakitori, Event…) ---------- */
function pxLays() { const F = PX.floor; if (!F.layouts || !F.layouts.length) F.layouts = [{ id: 'main', name: 'Main' }]; const ids = F.layouts.map(l => l.id); (F.tables || []).forEach(t => { if (!ids.includes(t.layout)) t.layout = F.layouts[0].id; }); return F.layouts; }
const pxLayCur = () => { const L = pxLays(); if (!L.some(l => l.id === PX._lay)) PX._lay = L[0].id; return PX._lay; };
const pxLayName = id => { const l = ((PX.floor && PX.floor.layouts) || []).find(x => x.id === id); return l ? l.name : ''; };
const pxZoneOf = t => t.zone || (((PX.floor && PX.floor.layouts) || []).length > 1 ? pxLayName(t.layout) : '');
function pxLaySel(id) { PX._lay = id; pxBody(); }
async function pxLayAdd() {
  if (!pxMgr()) return; const n = String(await pxPrompt('Pangalan ng bagong layout (hal. Extension, Yakitori, Event)') || '').trim(); if (!n) return; if (pxLays().some(l => l.name.toLowerCase() === n.toLowerCase())) { await pxAlert('Mayroon nang layout na "' + n + '".'); return; }
  const l = { id: pxId('LY'), name: n }; PX.floor.layouts.push(l); PX._lay = l.id; PX.fedit = true; pxToast('➕ Idagdag ang mga table, tapos 💾 I-save ang layout'); pxBody();
}
async function pxLayRen() { const id = pxLayCur(), l = PX.floor.layouts.find(x => x.id === id), n = String(await pxPrompt('Bagong pangalan ng layout', l.name) || '').trim(); if (!n) return; l.name = n; pxBody(); }
async function pxLayDel() {
  const L = pxLays(), id = pxLayCur(); if (L.length < 2) { await pxAlert('Kailangan may kahit isang layout.'); return; } const ts = PX.floor.tables.filter(t => t.layout === id), l = L.find(x => x.id === id);
  if (ts.some(t => pxTabOf(t.id))) { await pxAlert('May bukas na customer sa layout na ito. Isara o ilipat muna sila.'); return; }
  if (!await pxConfirm('Burahin ang layout na "' + l.name + '"' + (ts.length ? ' at ang ' + ts.length + ' table nito' : '') + '?', { danger: true, ok: 'Burahin' })) return; PX.floor.tables = PX.floor.tables.filter(t => t.layout !== id); PX.floor.layouts = L.filter(x => x.id !== id); PX._lay = ''; pxBody();
}
/* ---------- Real-time sync (hindi na kailangan mag-refresh) ---------- */
function pxIdleUi() { const m = document.getElementById('px-modal'); return !(m && m.style.display !== 'none' && m.innerHTML) && !document.querySelector('[id^="px-d"][style*="flex"]'); }
function pxLiveRepaint() { if (PX.tab === 'tables' && !PX.fedit && pxIdleUi()) { clearTimeout(PX._lr); PX._lr = setTimeout(() => { if (PX.tab === 'tables' && !PX.fedit && pxIdleUi()) pxBody(); }, 150); } }
function pxLiveStop() { if (PX._lv) { PX._lv.off.forEach(f => { try { f(); } catch (e) {} }); PX._lv = null; } PX._tlOk = false; }
function pxLiveStart() {
  if (PX._lv && PX._lv.site === PX.site) return; pxLiveStop(); const L = { site: PX.site, off: [] }; PX._lv = L;
  try { const q = db.collection('pos_tabs').where('site', '==', PX.site).where('status', '==', 'open');
    if (typeof q.onSnapshot === 'function') L.off.push(q.onSnapshot(sn => { if (PX._lv !== L) return; const a = []; sn.forEach(x => a.push(Object.assign({ id: x.id }, x.data()))); PX.tabs = a; PX._tlOk = true; pxLiveRepaint(); }, () => { PX._tlOk = false; }));
    const fr = db.collection('pos_floor').doc(PX.site);
    if (typeof fr.onSnapshot === 'function') L.off.push(fr.onSnapshot(d => { if (PX._lv !== L || PX.fedit) return; const data = d.exists ? d.data() : { tables: [] }; if (!data.tables) data.tables = []; data._site = PX.site; PX.floor = data; pxLiveRepaint(); }, () => {}));
  } catch (e) {}
}
async function pxTabsLoad() { try { const s = await db.collection('pos_tabs').where('site', '==', PX.site).where('status', '==', 'open').get(); PX.tabs = []; s.forEach(x => PX.tabs.push(Object.assign({ id: x.id }, x.data()))); } catch (e) { PX.tabs = PX.tabs || []; } }
async function pxTabMut(id, fn, h) { const r = db.collection('pos_tabs').doc(id), d = (await r.get()).data(); if (!d) throw new Error('Wala na ang table tab.'); const lo = pxLockOther(d); if (lo) throw new Error('Hawak na ni ' + lo.name + ' ang table na ito (na-takeover). Bumalik sa Tables at buksan ulit.'); fn(d); if (h) (d.hist = d.hist || []).push({ at: new Date().toISOString(), by: String(pxMe().email || ''), name: String(pxMe().name || ''), a: h.a, i: h.i || '' }); if (pxLockMine(d)) d.lock.ms = Date.now(); await r.set(d); const i = (PX.tabs || []).findIndex(t => t.id === id); const n = Object.assign({ id }, d); if (i >= 0) PX.tabs[i] = n; else (PX.tabs = PX.tabs || []).push(n); return n; }

/* ---------- Floor view ---------- */
async function pxFloorView() {
  if (!PX.floor || PX.floor._site !== PX.site) { await pxFloorLoad(); PX.floor._site = PX.site; } pxLiveStart(); if (!PX._tlOk) await pxTabsLoad(); try { await pxRsvLoad(); } catch (e) {} const ed = !!PX.fedit && pxMgr(), T = PX.floor.tables, lays = pxLays(), cur = pxLayCur(), TL = T.filter(t => t.layout === cur);
  clearInterval(PX._fi); PX._fi = setInterval(pxLiveRepaint, 20000); // pang-backup lang; real-time ang pangunahin
  const tile = t => {
    const tb = pxTabOf(t.id), sh = t.shape || 'sq', sz = PX_SHP[sh] || PX_SHP.sq, w = t.w || sz.w, h = t.h || sz.h, lo = tb && pxLockOther(tb), mine = tb && pxLockMine(tb) && pxLockFresh(tb), col = lo ? '#ddd6fe' : mine ? '#bfdbfe' : tb ? '#fed7aa' : (t.out ? '#cffafe' : '#bbf7d0'), bd = lo ? '#7c3aed' : mine ? '#2563eb' : tb ? '#ea580c' : (t.out ? '#0891b2' : '#16a34a');
    return `<div data-t="${t.id}" ${ed ? `onpointerdown="pxTblDown(event,'${t.id}')" style="touch-action:none;cursor:move;` : `onclick="pxTableTap('${t.id}')" style="cursor:pointer;`}position:absolute;left:${t.x / PX_FW * 100}%;top:${t.y / PX_FH * 100}%;width:${w / PX_FW * 100}%;height:${h / PX_FH * 100}%;background:${col};border:2px solid ${bd};border-radius:${sh === 'round' ? '50%' : '.5rem'};display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;font-size:.78rem;line-height:1.15;overflow:hidden;user-select:none;box-sizing:border-box;"><b style="font-size:.9rem;">${t.out ? (PX_CH[t.out] || { i: '🥡' }).i + ' ' : ''}${pxE(t.name)}</b>${lo ? `<span style="font-size:.68rem;color:#6d28d9;font-weight:700;">✋ ${pxE(String(lo.name || '').split(' ')[0])}</span>` : mine ? '<span style="font-size:.68rem;color:#1d4ed8;font-weight:700;">✋ ikaw</span>' : ''}<span>${t.room ? '🏛️ ' : ''}👥 ${tb ? tb.pax + '/' : ''}${t.seats || '-'}</span>${(() => { const rv = pxRsvNext(t.id); return rv ? `<span style="font-size:.68rem;color:${tb ? '#dc2626' : '#1d4ed8'};font-weight:700;">${tb ? '⏰ hanggang ' : '📅 '}${pxHM(rv.startMs)} ${pxE(String(rv.name).split(' ')[0])}${rv.confirmedAt ? ' ✅' : ''}</span>` : ''; })()}${tb ? `<span style="font-weight:700;">₱${pxM(pxTabSub(tb))}</span><span style="font-size:.68rem;">${tb.member ? '🪪 ' + pxE(String(tb.member.name).split(' ')[0]) : ''}</span>` : ''}</div>`;
  };
  return pxHint(ed ? '📖 <b>Edit mode:</b> pindutin ang <b>➕ table</b> para magdagdag, <b>i-drag</b> ang table sa gusto mong pwesto, at <b>i-tap</b> (hindi i-drag) para i-rename, itakda ang bilang ng <b>pax</b>, hugis, laki, area, at kung anong club lang ang puwede. Pindutin ang <b>💾 I-save</b> kapag tapos na.' : '📖 <b>Berde</b> = bakante · <b>Kahel</b> = may customer. I-tap ang bakanteng table para <b>buksan</b> (pax + membership). I-tap ang kahel para mag-add ng <b>order</b>, i-<b>settle</b>, o i-split ang bill. <b>Real-time</b>: lumalabas agad sa lahat ng device ang bagong order/status ng table — hindi na kailangan mag-refresh. Gamitin ang mga tab ng <b>layout</b> (Main, Extension, Yakitori…) para lumipat ng area.') + `
  <div style="display:flex;gap:.4rem;flex-wrap:wrap;margin-bottom:.4rem;align-items:center;"><button class="btn btn-secondary btn-sm" onclick="pxBody()">🔄 Refresh</button><button class="btn btn-secondary btn-sm" onclick="pxMemCheck()">🪪 Check Membership</button>${pxMgr() ? (ed ? `<button class="btn btn-primary btn-sm" onclick="pxTblAdd('sq')">➕ ⬜ Square</button><button class="btn btn-primary btn-sm" onclick="pxTblAdd('rect')">➕ ▭ Rectangle</button><button class="btn btn-primary btn-sm" onclick="pxTblAdd('round')">➕ ⚪ Round</button><button class="btn btn-success btn-sm" onclick="pxFloorSave()">💾 I-save ang layout</button><button class="btn btn-secondary btn-sm" onclick="PX.fedit=false;pxFloorReset()">✖ Kanselahin</button>` : '<button class="btn btn-secondary btn-sm" onclick="PX.fedit=true;pxBody()">✏️ I-edit ang layout</button>') : ''}<span style="margin-left:auto;font-size:.8rem;color:#475569;">${PX._tlOk ? '🟢 Live · ' : ''}Bukas: <b>${pxTabsOpen().length}</b> / ${T.length} table</span></div>
  <div style="display:flex;gap:.3rem;flex-wrap:wrap;margin-bottom:.4rem;align-items:center;">${lays.map(l => { const ts = T.filter(t => t.layout === l.id), o = ts.filter(t => pxTabOf(t.id)).length; return `<button class="btn ${l.id === cur ? 'btn-primary' : 'btn-secondary'} btn-sm" onclick="pxLaySel('${l.id}')" style="${l.id !== cur && o ? 'border-color:#ea580c;' : ''}">${pxE(l.name)} <small>(${o}/${ts.length})</small></button>`; }).join('')}${pxMgr() ? `<button class="btn btn-secondary btn-sm" onclick="pxLayAdd()">➕ Layout</button>` : ''}${ed ? `<button class="btn btn-secondary btn-sm" onclick="pxLayRen()" title="Palitan ang pangalan">✏️ Pangalan</button><button class="btn btn-danger btn-sm" onclick="pxLayDel()" title="Burahin ang layout">🗑️ Layout</button>` : ''}</div>
  <div style="position:relative;width:100%;padding-top:${PX_FH / PX_FW * 100}%;background:#f8fafc;border:2px dashed #cbd5e1;border-radius:.6rem;${ed ? 'background-image:linear-gradient(#e2e8f0 1px,transparent 1px),linear-gradient(90deg,#e2e8f0 1px,transparent 1px);background-size:5% 8.9%;' : ''}"><div id="px-canvas" style="position:absolute;inset:0;">${TL.length ? TL.map(tile).join('') : `<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:#94a3b8;text-align:center;padding:1rem;">Wala pang table sa layout na ito. ${pxMgr() ? 'Pindutin ang ✏️ I-edit ang layout para magdagdag.' : 'Magpagawa sa manager/admin.'}</div>`}</div></div>`;
}
async function pxFloorReset() { PX.floor = null; await pxBody(); }
function pxTblAdd(shape) { const s = PX_SHP[shape], n = PX.floor.tables.length + 1, cl = pxLayCur(); let x = 40, y = 40; while (PX.floor.tables.some(t => t.layout === cl && Math.abs(t.x - x) < 60 && Math.abs(t.y - y) < 60)) { x += 40; if (x > PX_FW - 200) { x = 40; y += 60; } } PX.floor.tables.push({ id: pxId('T'), name: 'T' + n, shape, x, y, w: s.w, h: s.h, seats: 4, zone: '', clubs: [], layout: cl }); pxBody(); }
function pxTblDown(ev, id) {
  const t = PX.floor.tables.find(x => x.id === id), cv = document.getElementById('px-canvas'), el = ev.currentTarget; if (!t || !cv) return; const r = cv.getBoundingClientRect(), sx = ev.clientX, sy = ev.clientY, ox = t.x, oy = t.y; let moved = false; el.setPointerCapture(ev.pointerId);
  const mv = e => { const dx = (e.clientX - sx) * PX_FW / r.width, dy = (e.clientY - sy) * PX_FH / r.height; if (Math.abs(e.clientX - sx) + Math.abs(e.clientY - sy) > 6) moved = true; if (!moved) return; t.x = Math.max(0, Math.min(PX_FW - (t.w || 90), Math.round((ox + dx) / 10) * 10)); t.y = Math.max(0, Math.min(PX_FH - (t.h || 90), Math.round((oy + dy) / 10) * 10)); el.style.left = t.x / PX_FW * 100 + '%'; el.style.top = t.y / PX_FH * 100 + '%'; };
  const up = () => { el.removeEventListener('pointermove', mv); el.removeEventListener('pointerup', up); el.removeEventListener('pointercancel', up); if (!moved) pxTblEdit(id); }; el.addEventListener('pointermove', mv); el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
}
let PX_TE = null;
function pxTblEdit(id) { const t = PX.floor.tables.find(x => x.id === id); if (!t) return; PX_TE = JSON.parse(JSON.stringify(t)); pxTeRender(); }
function pxTeSync() { const g = i => document.getElementById(i); if (g('te-name')) { PX_TE.name = g('te-name').value; PX_TE.zone = g('te-zone').value; const s = pxNum(g('te-seats').value); if (s > 0) PX_TE.seats = s; } }
function pxTeSet(k, v) { pxTeSync(); PX_TE[k] = v; if (k === 'shape' || k === 'size') { const sz = PX_SHP[PX_TE.shape || 'sq'], m = { S: 0.75, M: 1, L: 1.4 }[PX_TE.size || 'M']; PX_TE.w = Math.round(sz.w * m); PX_TE.h = Math.round(sz.h * m); } pxTeRender(); }
function pxTeClub(n) { pxTeSync(); const a = PX_TE.clubs = PX_TE.clubs || [], i = a.indexOf(n); if (i >= 0) a.splice(i, 1); else a.push(n); pxTeRender(); }
function pxTeRender() {
  const t = PX_TE, ch = (cur, v, lab, js) => `<button class="btn ${cur === v ? 'btn-primary' : 'btn-secondary'} btn-sm" onclick="${js}">${lab}</button>`, zones = [...new Set(PX.floor.tables.map(x => x.zone).filter(Boolean))];
  pxOv('px-dte', `<h3 style="margin-top:0;">✏️ Table — ${pxE(t.name)}</h3>
  ${pxLbl('Pangalan ng table', 'hal. T1, Table 5, VIP 1')}<input id="te-name" value="${pxE(t.name)}" style="width:100%;box-sizing:border-box;">
  ${pxLbl('Ilang pax ang kasya (kapasidad)', 'Itatanong ito kapag binuksan ang table; babalaan kung lampas.')}<div style="display:flex;gap:.3rem;flex-wrap:wrap;align-items:center;">${[2, 4, 6, 8, 10, 12].map(n => ch(t.seats, n, n, `pxTeSet('seats',${n})`)).join('')}<input id="te-seats" type="number" value="${t.seats || ''}" style="width:70px;"></div>
  ${pxLbl('Hugis')}<div style="display:flex;gap:.3rem;">${Object.keys(PX_SHP).map(k => ch(t.shape || 'sq', k, PX_SHP[k].n, `pxTeSet('shape','${k}')`)).join('')}</div>
  ${pxLbl('Laki')}<div style="display:flex;gap:.3rem;">${[['S', 'Maliit'], ['M', 'Katamtaman'], ['L', 'Malaki']].map(x => ch(t.size || 'M', x[0], x[1], `pxTeSet('size','${x[0]}')`)).join('')}</div>
  ${PX.floor.layouts.length > 1 ? pxLbl('Layout', 'Saang layout (Main, Extension…) nakalagay ang table.') + `<div style="display:flex;gap:.3rem;flex-wrap:wrap;">${PX.floor.layouts.map(l => ch(t.layout, l.id, pxE(l.name), `pxTeSet('layout','${l.id}')`)).join('')}</div>` : ''}
  ${pxLbl('Area / Zone (opsyonal)', 'hal. Ballroom, Soccer Field, VIP.')}<input id="te-zone" list="te-zl" value="${pxE(t.zone || '')}" style="width:100%;box-sizing:border-box;"><datalist id="te-zl">${zones.map(z => `<option value="${pxE(z)}">`).join('')}</datalist>
  ${pxLbl('Uri ng table', 'Ang Take-out lane ay para sa mga take-out / Foodpanda / GrabFood na order (maraming sabay-sabay, parang table).')}<div style="display:flex;gap:.3rem;flex-wrap:wrap;">${[['', '🍽️ Dine-in table'], ['take', '🥡 Take-out lane'], ['fp', '🐼 Foodpanda lane'], ['grab', '🟢 Grab lane']].map(x => ch(t.out || '', x[0], x[1], `pxTeSet('out','${x[0]}')`)).join('')}</div>
  ${pxLbl('🏛️ Meeting / Private room', 'Para sa exclusive/soundproof room na inuupahan. Kapag umabot sa minimum spend ang order, libre na ang room fee.')}<label><input type="checkbox" ${t.room ? 'checked' : ''} onchange="pxTeSet('room',this.checked)"> Ito ay meeting / private room</label>${t.room ? `<div style="display:flex;gap:.5rem;margin-top:.2rem;"><div>${pxLbl('Minimum spend ₱')}<input type="number" min="0" value="${t.minSpend || ''}" onchange="PX_TE.minSpend=+this.value" style="width:130px;"></div><div>${pxLbl('Room fee ₱ (kung kulang)')}<input type="number" min="0" value="${t.roomFee || ''}" onchange="PX_TE.roomFee=+this.value" style="width:130px;"></div></div>` : ''}
  ${pxLbl('Anong club lang ang puwede dito?', 'Piliin ang mga club na may karapatang mag-dine-in sa table/area na ito. Walang napili = lahat ng member.')}<div style="display:flex;gap:.3rem;flex-wrap:wrap;">${PX.clubs.length ? PX.clubs.map(c => ch((t.clubs || []).includes(c.name) ? c.name : null, c.name, pxE(c.name), `pxTeClub('${pxE(c.name).replace(/'/g, '')}')`)).join('') : '<small>Wala pang club (Clubs tab).</small>'}</div>
  <div style="display:flex;gap:.5rem;margin-top:.8rem;">${pxBtn('btn-danger', '🗑️', 'pxTeDel()', 'padding:.6rem;')}${pxBtn('btn-secondary', 'Kanselahin', "pxOvHide('px-dte')", 'flex:1;padding:.6rem;')}${pxBtn('btn-success', '✔ OK', 'pxTeOk()', 'flex:2;padding:.6rem;')}</div>`, 10200, 520);
}
function pxTeOk() { pxTeSync(); const i = PX.floor.tables.findIndex(x => x.id === PX_TE.id); if (i >= 0) { PX_TE.name = PX_TE.name.trim() || PX.floor.tables[i].name; PX.floor.tables[i] = PX_TE; } pxOvHide('px-dte'); pxBody(); }
async function pxTeDel() { if (pxTabOf(PX_TE.id)) { await pxAlert('May bukas na customer sa table na ito. Isara muna bago burahin.'); return; } if (!await pxConfirm('Burahin ang table na ' + PX_TE.name + '?', { danger: true, ok: 'Burahin' })) return; PX.floor.tables = PX.floor.tables.filter(x => x.id !== PX_TE.id); pxOvHide('px-dte'); pxBody(); }
async function pxFloorSave() { try { const tables = PX.floor.tables.map(t => ({ id: t.id, name: t.name, shape: t.shape || 'sq', x: t.x, y: t.y, w: t.w, h: t.h, seats: t.seats || 0, zone: t.zone || '', clubs: t.clubs || [], size: t.size || 'M', layout: t.layout || pxLays()[0].id, out: t.out || '', room: !!t.room, minSpend: +t.minSpend || 0, roomFee: +t.roomFee || 0 })), layouts = pxLays().map(l => ({ id: l.id, name: l.name })); await db.collection('pos_floor').doc(PX.site).set({ company: pxCo(), site: PX.site, tables, layouts, updatedBy: String(pxMe().email || ''), updatedAt: new Date().toISOString() }); PX.fedit = false; PX.floor = { tables, layouts, _site: PX.site }; pxToast('✅ Na-save ang layout'); pxBody(); } catch (e) { pxAlert('Error: ' + e.message); } }

/* ---------- Buksan ang table ---------- */
async function pxTableTap(id) { const tb = pxTabOf(id); if (tb) { if (!await pxLockEnsure(tb.id)) return; pxTabView(tb.id); } else { const T = pxRvTbl(id); if (T && T.out) pxLaneOpen(T); else pxOpenTable(id); } }
let PX_OT = null;
function pxOpenTable(id) { const t = PX.floor.tables.find(x => x.id === id); PX_OT = { t, pax: 0, member: null, err: '' }; pxOtRender(); }
function pxOtRender() {
  const o = PX_OT, t = o.t, need = !!PX.cfg.tableMember, m = o.member, mAct = pxMemActive(m), mx = Math.max(+t.seats || 4, 8);
  pxOv('px-dot', `<h3 style="margin-top:0;">🍽️ Buksan ang ${pxE(t.name)} ${t.zone ? '<small style="color:#64748b;">· ' + pxE(t.zone) + '</small>' : ''}</h3>
  ${pxHint('📖 <b>1.</b> Piliin kung <b>ilang pax</b>. <b>2.</b> ' + (need ? '<b>Kailangan ng ACTIVE na membership</b> para magamit ang table (naka-set sa Setup).' : 'Opsyonal ang membership; puwedeng walk-in.') + ' Pindutin ang <b>Check Membership</b>, hanapin ang ID/pangalan, at kung ACTIVE ay <b>Gamitin</b>. <b>3.</b> Pindutin ang <b>Buksan</b> — doon na magdadagdag ng mga order.')}
  ${pxLbl('Ilang pax?', 'Kapasidad ng table: ' + (t.seats || '—'))}<div style="display:flex;gap:.3rem;flex-wrap:wrap;">${Array.from({ length: mx }, (_, i) => i + 1).map(n => `<button class="btn ${o.pax === n ? 'btn-primary' : 'btn-secondary'}" style="min-width:2.6rem;padding:.55rem;" onclick="PX_OT.pax=${n};pxOtRender()">${n}</button>`).join('')}<input type="number" min="1" placeholder="iba" value="${o.pax > mx ? o.pax : ''}" onchange="PX_OT.pax=Math.max(0,parseInt(this.value)||0);pxOtRender()" style="width:64px;"></div>
  ${o.pax > (+t.seats || 999) ? `<div style="color:#b45309;font-size:.82rem;margin-top:.2rem;">⚠ Lampas sa kapasidad (${t.seats}).</div>` : ''}
  ${pxLbl('Membership' + (need ? ' *' : ''))}${m ? `<div style="border:2px solid ${mAct ? '#16a34a' : '#dc2626'};border-radius:.5rem;padding:.5rem;"><b>${pxE(m.name)}</b> · ${pxE(m.mid)} ${pxMemBadge(m)}<br><small>${pxE(m.club || '')}</small>${mAct ? '' : '<div style="color:#b91c1c;font-weight:700;">INACTIVE — hindi puwedeng gamitin sa table.</div>'}<button class="btn btn-secondary btn-sm" style="margin-top:.3rem;" onclick="PX_OT.member=null;pxOtRender()">✖ Alisin</button></div>` : ''}
  <button class="btn btn-primary" style="width:100%;margin-top:.3rem;padding:.6rem;" onclick="pxMemCheck(pxOtPick,'✔ Gamitin sa table na ito')">🪪 ${m ? 'Palitan' : 'Check Membership'}</button>
  ${o.err ? `<div style="color:#dc2626;margin-top:.4rem;font-weight:700;">${pxE(o.err)}</div>` : ''}
  <div style="display:flex;gap:.5rem;margin-top:.8rem;">${pxBtn('btn-secondary', 'Kanselahin', "pxOvHide('px-dot')", 'flex:1;padding:.7rem;')}${pxBtn('btn-success', '🟢 Buksan ang table', 'pxOtGo()', 'flex:2;padding:.7rem;')}</div>`, 10200, 520);
}
function pxOtPick(m) { PX_OT.member = m ? pxMemSnap(m) : null; PX_OT.err = ''; pxOtRender(); }
async function pxOtGo() {
  if (!PX.shift) { pxAlert('Buksan muna ang shift (araw) bago magbukas ng table.'); return; } if (pxShiftStale()) { pxAlert('Hindi pa na-Z-read ang ' + PX.shift.date + '. I-Z-read muna bago magbukas ng table.'); return; }
  const o = PX_OT, t = o.t, m = o.member; if (!(o.pax > 0)) { o.err = 'Piliin muna kung ilang pax.'; pxOtRender(); return; }
  if (PX.cfg.tableMember && !m) { o.err = 'Kailangan ng membership para sa table na ito.'; pxOtRender(); return; }
  if (m && !pxMemActive(m)) { o.err = (pxMemWhy(m) || 'INACTIVE ang membership ni ' + m.name) + ' — hindi makakapag-order/settle.'; pxOtRender(); return; }
  if (m && (t.clubs || []).length && !(t.clubs.includes(m.club))) { o.err = 'Hindi puwede ang club na "' + (m.club || 'walang club') + '" sa ' + t.name + (t.zone ? ' (' + t.zone + ')' : '') + '. Puwede lang: ' + t.clubs.join(', ') + '.'; pxOtRender(); return; }
  if (pxTabOf(t.id)) { pxOvHide('px-dot'); pxTabView(pxTabOf(t.id).id); return; }
  const id = pxId('TB'), tab = { company: pxCo(), site: PX.site, siteName: pxSite().name || '', tableId: t.id, tableName: t.name, zone: pxZoneOf(t), layout: t.layout || '', pax: o.pax, member: m, status: 'open', openedAt: new Date().toISOString(), openedMs: Date.now(), openedBy: String(pxMe().email || ''), openedByName: String(pxMe().name || ''), orders: [], bills: [], roomSnap: pxRoomSnap(t), bizDate: pxBiz(), lock: pxLockNew(), hist: [{ at: new Date().toISOString(), by: String(pxMe().email || ''), name: String(pxMe().name || ''), a: 'open', i: o.pax + ' pax' }] };
  try { if (!await pxRsvSeatWarn(t.id)) return; } catch (e) {}
  try { await db.collection('pos_tabs').doc(id).set(tab); (PX.tabs = PX.tabs || []).push(Object.assign({ id }, tab)); pxOvHide('px-dot'); pxToast('✅ Bukas na ang ' + t.name); pxTabOrder(id); } catch (e) { o.err = 'Error: ' + e.message; pxOtRender(); }
}

/* ---------- Table tab (mga order) ---------- */
function pxTabView(id) {
  const t = (PX.tabs || []).find(x => x.id === id); if (!t) return; const sub = pxTabSub(t), act = (t.orders || []).filter(o => o.status !== 'void').length;
  pxModal(`<h3 style="margin-top:0;">🍽️ ${pxE(t.tableName)} <small style="color:#64748b;">· 👥 ${t.pax} pax ${t.zone ? '· ' + pxE(t.zone) : ''}</small></h3>${typeof pxRsvTabNote === 'function' ? pxRsvTabNote(t) : ''}
  ${pxHint('📖 Ang isang table ay puwedeng magkaroon ng <b>maraming order</b> (Order 1, 2, 3…). Pindutin ang <b>➕ Bagong order</b> para magdagdag. Kapag tapos nang kumain, pindutin muna ang <b>🖨️ Print Bill</b> para makita ng customer ang total (puwede pang magbigay ng Senior/PWD ID — mababago ang discount at puwedeng i-print muli), tapos <b>💳 Bayaran / Split bill</b> para i-settle (puwedeng hatiin sa maraming bill na may kanya-kanyang discount at bayad).')}
  ${typeof pxRoomBanner === 'function' ? pxRoomBanner(t) : ''}${t.guest ? `<div style="font-size:.85rem;margin-bottom:.3rem;">📅 Reservation: <b>${pxE(t.guest)}</b>${t.guestNote ? ' · 📝 ' + pxE(t.guestNote) : ''}</div>` : ''}
  <div style="font-size:.88rem;margin-bottom:.4rem;">${t.member ? `🪪 <b>${pxE(t.member.name)}</b> · ${pxE(t.member.mid)} · ${pxE(t.member.club || '')} ${pxMemBadge((PX.members.find(m => m.id === t.member.id)) || t.member)}` : 'Walang membership (walk-in)'} · Binuksan: ${pxE(new Date(t.openedMs || t.openedAt).toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' }))} ni ${pxE(t.openedByName || t.openedBy)}</div>
  ${(t.orders || []).map((o, i) => `<div style="border:1px solid #e2e8f0;border-radius:.5rem;padding:.4rem .5rem;margin-bottom:.3rem;${o.status === 'void' ? 'opacity:.55;background:#fef2f2;' : ''}"><div style="display:flex;justify-content:space-between;gap:.3rem;flex-wrap:wrap;"><b>Order ${o.no}</b> ${o.chan ? `<span style="font-size:.75rem;border-radius:1rem;padding:0 .4rem;background:${o.chan === 'dine' ? '#dcfce7' : '#fef3c7'};">${o.chan === 'dine' ? '🍽️ Dine-in' : o.chan === 'take' ? '🥡 Take-out' : ((PX_CH[o.chan] || {}).i || '') + ' ' + pxE((PX_CH[o.chan] || {}).n || o.chan)}</span>` : ''} ${(o.owner || {}).name ? `<span style="font-size:.8rem;">👤 ${pxE(o.owner.name)}</span>` : ''}<small>${pxE(new Date(o.atMs || o.at).toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' }))} · ${pxE(o.byName || o.by)}</small>${o.status === 'void' ? '<b style="color:#dc2626;">VOID — ' + pxE(o.voidReason || '') + '</b>' : `<span><button class="btn btn-secondary btn-sm" onclick="pxTicket('${t.id}',${i})">🖨️ Ticket</button> <button class="btn btn-secondary btn-sm" title="I-print ulit sa station printer ng kusina" onclick="pxOrderReprint('${t.id}',${i})">🔁 Kusina</button> <button class="btn btn-danger btn-sm" onclick="pxOrderVoid('${t.id}',${i})">❌ Cancel</button></span>`}</div>${(o.items || []).map(l => `<div style="font-size:.85rem;display:flex;justify-content:space-between;"><span>${l.qty} × ${pxE(l.name)}${l.note ? ' <i style="color:#b45309;">(' + pxE(l.note) + ')</i>' : ''}</span><span>${pxM(l.qty * l.price)}</span></div>`).join('')}</div>`).join('') || '<div style="color:#94a3b8;padding:.5rem;">Wala pang order.</div>'}
  <div style="display:flex;justify-content:space-between;font-size:1.15rem;font-weight:800;margin:.4rem 0;"><span>Subtotal</span><span>₱${pxM(sub)}</span></div>
  <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:.4rem;">${pxBtn('btn-primary', '➕ Bagong order', `pxTabOrder('${t.id}')`, 'padding:.7rem;')}${pxBtn('btn-secondary', '🖨️ Print Bill' + (t.billPrintCount ? ' (' + t.billPrintCount + '×)' : ''), `pxPrintBillAll('${t.id}')`, 'padding:.7rem;')}${pxBtn('btn-success', '💳 Bayaran / Split bill', `pxSplit('${t.id}')`, 'padding:.7rem;')}${pxBtn('btn-secondary', '🔁 Ilipat ng table', `pxTabMove('${t.id}')`, 'padding:.6rem;')}${pxBtn('btn-secondary', '🪪 Check / palitan ang member', `pxTabMember('${t.id}')`, 'padding:.6rem;')}${!act ? pxBtn('btn-danger', '✖ I-cancel ang table', `pxTabCancel('${t.id}')`, 'padding:.6rem;grid-column:1/-1;') : ''}</div>`, 700);
}
async function pxTabMember(id) { pxMemCheck(async m => { try { await pxTabMut(id, d => { d.member = pxMemSnap(m); }, { a: 'member', i: m.name }); pxTabView(id); pxBody(); } catch (e) { pxAlert('Error: ' + e.message); } }, '✔ Gamitin sa table na ito'); }
async function pxTabMove(id) { const t = PX.tabs.find(x => x.id === id), free = PX.floor.tables.filter(x => !pxTabOf(x.id)); if (!free.length) { await pxAlert('Walang bakanteng table.'); return; } const k = await pxChoice('🔁 Ilipat sa anong table?', free.slice().sort((a, b) => (a.layout === t.layout ? 0 : 1) - (b.layout === t.layout ? 0 : 1)).map(x => ({ k: x.id, label: pxE(x.name), sub: '👥 ' + (x.seats || '-') + ' · ' + pxE(pxLayName(x.layout) || x.zone || '') })), { cols: 3, hint: 'Piliin ang bakanteng table (puwede sa ibang layout, hal. Main → Extension). Nasa kanya na ang lahat ng order at bill.' }); if (!k) return; const nt = free.find(x => x.id === k); if (t.member && (nt.clubs || []).length && !nt.clubs.includes(t.member.club)) { await pxAlert('Hindi puwede ang club ni ' + t.member.name + ' sa ' + nt.name + '.'); return; } try { await pxTabMut(id, d => { d.tableId = nt.id; d.tableName = nt.name; d.zone = pxZoneOf(nt); d.layout = nt.layout || ''; }, { a: 'move', i: '→ ' + nt.name }); PX._lay = nt.layout || PX._lay; pxTabView(id); pxBody(); } catch (e) { pxAlert('Error: ' + e.message); } }
async function pxTabCancel(id) { const why = await pxVoidWhy('Bakit ica-cancel ang table?'); if (!why) return; try { await pxTabMut(id, d => { d.status = 'cancelled'; d.cancelReason = why; d.closedAt = new Date().toISOString(); }, { a: 'cancel', i: why }); PX.tabs = PX.tabs.filter(x => x.id !== id); pxClose(); pxBody(); } catch (e) { pxAlert('Error: ' + e.message); } }
async function pxOrderVoid(id, i) { if (!await pxPin('Kailangan ng PIN para i-cancel ang order na naipadala na.')) return; const why = await pxVoidWhy('Bakit ica-cancel ang order?'); if (!why) return; try { await pxTabMut(id, d => { const o = d.orders[i]; o.status = 'void'; o.voidReason = why; o.voidBy = String(pxMe().email || ''); o.voidAt = new Date().toISOString(); d.bills = (d.bills || []).filter(b => b.status === 'paid'); }, { a: 'void', i: '#' + (i + 1) + ' ' + why }); try { await logSystemAction('POS_ORDER_VOID', id + ' #' + (i + 1) + ': ' + why); } catch (e) {} pxTabView(id); pxBody(); } catch (e) { pxAlert('Error: ' + e.message); } }
function pxTicketHtml(t, o) { return `<html><head><meta charset="utf-8"><style>@page{margin:2mm}body{font-family:monospace;font-size:14px;width:${PX.cfg.paper === '58' ? '54mm' : '76mm'};margin:0 auto}hr{border:0;border-top:1px dashed #000}</style></head><body><div style="text-align:center"><b style="font-size:18px;">${pxE(t.tableName)}</b><br>ORDER #${o.no} · ${t.pax} pax${t.zone ? '<br>' + pxE(t.zone) : ''}<br>${pxE(new Date(o.atMs || o.at).toLocaleString('en-PH'))}</div><hr>${(o.items || []).map(l => `<div style="font-size:16px;"><b>${l.qty} ×</b> ${pxE(l.name)}${l.note ? '<br>&nbsp;&nbsp;<i>** ' + pxE(l.note) + '</i>' : ''}</div>`).join('')}<hr>Kumuha ng order: ${pxE(o.byName || o.by)}</body></html>`; }
function pxTicket(id, i) { const t = PX.tabs.find(x => x.id === id); if (t && t.orders[i]) pxPrint(pxTicketHtml(t, t.orders[i])); }

/* ---------- Pagkuha ng order (Order 1, 2, ...) ---------- */
/* pxTabOrder: nasa pos_l.js */
function pxCtxTab() { return PX.ctx ? (PX.tabs || []).find(t => t.id === PX.ctx.tabId) : null; }
/* pxOrderPane: nasa pos_l.js */
async function pxLineNote(i) { const v = await pxPrompt('📝 Tala para sa kusina', { hint: 'Hal. "walang sibuyas", "less sugar", "hiwalay ang sauce".', def: PX.cart[i].note || '', ph: 'opsyonal', ok: 'I-save' }); if (v === null) return; PX.cart[i].note = v.trim(); pxBody(); }
async function pxCtxExit(askCart) { if (askCart && PX.cart.length && !await pxConfirm('May hindi pa naipapadalang item. Iwan ito at bumalik?', { ok: 'Oo, iwan', danger: true })) return; const id = PX.ctx && PX.ctx.tabId; PX.ctx = null; PX.cart = []; pxResetPay(); PX.tab = 'tables'; pxRender(); if (id) pxLockRel(id); }
/* pxOrderSend: nasa pos_l.js (background print queue) */

/* ---------- Split bill ---------- */
let PX_SP = null;
function pxSplit(id) {
  const t = PX.tabs.find(x => x.id === id); if (!t) return; if (!pxTabLines(t).length) { pxAlert('Wala pang order na babayaran.'); return; }
  const paid = (t.bills || []).filter(b => b.status === 'paid'), lines = pxTabLines(t);
  if (!(t.bills || []).length) PX_SP = { id, bills: pxSplitByOwner(lines) };
  else { PX_SP = { id, bills: JSON.parse(JSON.stringify(t.bills)) }; // idagdag ang bagong order na wala pa sa anumang bill
    const have = {}; PX_SP.bills.forEach(b => b.lines.forEach(l => { const k = pxLK(l); have[k] = (have[k] || 0) + l.qty; })); const open = PX_SP.bills.find(b => b.status === 'open') || (PX_SP.bills.push({ id: 'b' + (PX_SP.bills.length + 1), name: 'Bill ' + (PX_SP.bills.length + 1), status: 'open', lines: [] }), PX_SP.bills[PX_SP.bills.length - 1]);
    lines.forEach(l => { const k = pxLK(l), extra = +(l.qty - (have[k] || 0)).toFixed(6); if (extra > 1e-6) { const tg = (l.ow && PX_SP.bills.find(b => b.status === 'open' && b.name === l.ow)) || open, x = tg.lines.find(z => pxLK(z) === k); if (x) x.qty = +(x.qty + extra).toFixed(6); else tg.lines.push(Object.assign({}, l, { qty: extra })); } }); }
  pxSpRender();
}
function pxSpMove(fi, li, ti, all) { const f = PX_SP.bills[fi], t = PX_SP.bills[ti], l = f.lines[li]; if (!l || f.status !== 'open' || t.status !== 'open') return; const q = all ? l.qty : Math.min(1, l.qty), x = t.lines.find(z => pxLK(z) === pxLK(l)); if (x) x.qty = +(x.qty + q).toFixed(6); else t.lines.push(Object.assign({}, l, { qty: +q.toFixed(6) })); l.qty = +(l.qty - q).toFixed(6); if (l.qty <= 1e-6) f.lines.splice(li, 1); pxSpRender(); }
function pxSpAdd() { const n = PX_SP.bills.length + 1; PX_SP.bills.push({ id: 'b' + Date.now().toString(36), name: 'Bill ' + n, status: 'open', lines: [] }); pxSpRender(); }
function pxSpDel(i) { const b = PX_SP.bills[i]; if (b.lines.length || b.status !== 'open' || PX_SP.bills.length < 2) return; PX_SP.bills.splice(i, 1); pxSpRender(); }
function pxSpMerge() { const open = PX_SP.bills.filter(b => b.status === 'open'); if (open.length < 2) return; const f = open[0]; open.slice(1).forEach(b => { b.lines.forEach(l => { const x = f.lines.find(z => z.id === l.id && z.price === l.price); if (x) x.qty = +(x.qty + l.qty).toFixed(6); else f.lines.push(l); }); PX_SP.bills.splice(PX_SP.bills.indexOf(b), 1); }); pxSpRender(); }
async function pxSpSave() { try { await pxTabMut(PX_SP.id, d => { d.bills = PX_SP.bills; }); } catch (e) {} }
const pxQ = q => +(+q).toFixed(3);
const pxBillSub = b => pxR2(b.lines.reduce((s, l) => s + l.price * l.qty, 0));
function pxSpRender() {
  const B = PX_SP.bills, t = PX.tabs.find(x => x.id === PX_SP.id) || {}; pxSpSave();
  pxModal(`<h3 style="margin-top:0;">💳 Settlement — ${pxE(t.tableName)} ${t.member ? '<small>· 🪪 ' + pxE(t.member.name) + '</small>' : ''}</h3>
  ${pxHint('📖 <b>Split bill:</b> pindutin ang <b>→2</b> para ilipat ang <b>1 piraso</b> ng item sa Bill 2, o <b>⇉2</b> para ilipat ang <b>lahat</b> ng piraso. Magdagdag ng bill gamit ang <b>➕ Dagdag Bill</b>. Para sa <b>hati sa presyo</b> (hindi item-by-item), pindutin ang <b>➗ Hati sa presyo</b>: pantay-pantay o custom na halaga kada bill. Pindutin ang <b>💳 Bayaran</b> sa bill na gusto mong i-settle — doon mo itatakda ang <b>discount (Senior/PWD atbp.) ng bill na iyon lang</b> at ang paraan ng bayad.')}
  <div style="display:flex;gap:.4rem;flex-wrap:wrap;margin-bottom:.4rem;">${pxBtn('btn-secondary btn-sm', '➕ Dagdag Bill', 'pxSpAdd()')}${pxBtn('btn-primary btn-sm', '➗ Hati sa presyo', 'pxSpPrice()')}${pxBtn('btn-secondary btn-sm', '↺ Pagsamahin ang di pa bayad', 'pxSpMerge()')}</div>
  <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:.5rem;">${B.map((b, bi) => `<div style="border:2px solid ${b.status === 'paid' ? '#16a34a' : '#94a3b8'};border-radius:.6rem;padding:.5rem;${b.status === 'paid' ? 'background:#f0fdf4;' : ''}"><div style="display:flex;justify-content:space-between;"><b>${pxE(b.name)}</b>${b.status === 'paid' ? '<span style="color:#166534;font-weight:700;">✅ BAYAD</span>' : B.length > 1 && !b.lines.length ? `<button class="btn btn-secondary btn-sm" onclick="pxSpDel(${bi})">🗑️</button>` : ''}</div>${b.lines.map((l, li) => `<div style="font-size:.85rem;border-bottom:1px solid #f1f5f9;padding:.2rem 0;"><div style="display:flex;justify-content:space-between;"><span>${pxQ(l.qty)} × ${pxE(l.name)}</span><span>${pxM(l.qty * l.price)}</span></div>${b.status === 'open' ? `<div style="display:flex;gap:.2rem;flex-wrap:wrap;">${B.map((x, xi) => xi !== bi && x.status === 'open' ? `<button class="btn btn-secondary btn-sm" style="padding:.1rem .4rem;" onclick="pxSpMove(${bi},${li},${xi},0)">→${xi + 1}</button><button class="btn btn-secondary btn-sm" style="padding:.1rem .4rem;" onclick="pxSpMove(${bi},${li},${xi},1)">⇉${xi + 1}</button>` : '').join('')}</div>` : ''}</div>`).join('') || '<div style="color:#94a3b8;font-size:.82rem;">Walang item.</div>'}<div style="display:flex;justify-content:space-between;font-weight:800;margin-top:.3rem;"><span>Subtotal</span><span>₱${pxM(pxBillSub(b))}</span></div>${b.status === 'paid' ? `<small>${pxE(b.no || '')}</small>` : pxBtn('btn-secondary btn-sm', '🖨️ Print Bill' + (b.printCount ? ' (na-print ' + b.printCount + '×)' : ''), `pxPrintBill('${PX_SP.id}','${b.id}')`, 'width:100%;margin-top:.3rem;') + pxBtn('btn-success', '💳 Bayaran ' + pxE(b.name), `pxBillPay('${b.id}')`, 'width:100%;margin-top:.3rem;padding:.6rem;') .replace('<button', b.lines.length ? '<button' : '<button disabled')}</div>`).join('')}</div>
  <button class="btn btn-secondary" style="margin-top:.6rem;" onclick="pxTabView('${PX_SP.id}')">← Bumalik sa table</button>`, 900);
}
async function pxBillPay(bid) {
  await pxSpSave(); const t = PX.tabs.find(x => x.id === PX_SP.id), b = PX_SP.bills.find(x => x.id === bid); if (!t || !b || !b.lines.length) return; const idx = PX_SP.bills.indexOf(b);
  PX.ctx = { mode: 'bill', tabId: t.id, billId: bid, billNo: idx + 1, billCount: PX_SP.bills.length, tableMember: t.member || null };
  PX.cart = b.lines.map(l => { const m = PX.menu.find(x => x.id === l.id) || {}; return { id: l.id, name: l.name, price: l.price, qty: l.qty, ch: l.ch || '', ings: m.ings || [] }; }); pxResetPay(); PX.ctx.chan = t.lane ? t.chan : 'dine'; PX.chanRef = t.platRef || ''; if (b.disc && b.disc.type && b.disc.type !== 'none') PX.disc = JSON.parse(JSON.stringify(b.disc));
  PX.member = b.member ? Object.assign({}, b.member) : (t.member ? Object.assign({}, t.member) : null); PX.tab = 'pos'; pxClose(); pxRender();
}
function pxBillPane() { // kaliwang bahagi habang nagbabayad ng bill
  const t = pxCtxTab() || {}, c = PX.ctx;
  return `<div class="card"><b>🍽️ ${pxE(t.tableName)} — Bill ${c.billNo} / ${c.billCount}</b>${t.member ? `<div style="font-size:.85rem;margin-top:.2rem;">🪪 ${pxE(t.member.name)} · ${pxE(t.member.mid)} ${pxMemBadge(PX.members.find(m => m.id === t.member.id) || t.member)}</div>` : ''}
  ${pxHint('📖 <b>Settlement:</b> sa kanan, piliin ang <b>discount</b> ng bill na ito (kung Senior/PWD, ilagay ang ID at pangalan), tapos <b>Magbayad</b>. Puwedeng hati-hati ang paraan ng bayad. Gamitin ang <b>🖨️ Print Bill</b> para makita ng customer ang total; kung may maiaabot na Senior/PWD ID pagkatapos, piliin ang discount at i-print muli bago magbayad. Kapag bayad na, babalik sa Split bill para sa susunod na bill.')}
  ${PX.cart.map(l => `<div style="display:flex;justify-content:space-between;border-bottom:1px solid #f1f5f9;padding:.25rem 0;font-size:.9rem;"><span>${pxQ(l.qty)} × ${pxE(l.name)}</span><span>${pxM(l.qty * l.price)}</span></div>`).join('')}
  <div style="display:flex;gap:.4rem;flex-wrap:wrap;margin-top:.6rem;"><button class="btn btn-secondary" onclick="pxBillBack()">← Bumalik sa Split bill</button></div></div>`;
}
function pxBillBack() { const id = PX.ctx.tabId; PX.ctx = null; PX.cart = []; pxResetPay(); PX.tab = 'tables'; pxRender(); pxSplit(id); }
async function pxBillDone(sale) { // tinawag pagkatapos ma-save ang benta
  const c = PX.ctx; try { const n = await pxTabMut(c.tabId, d => { const b = (d.bills || []).find(x => x.id === c.billId); if (b) { b.status = 'paid'; b.saleId = sale.id; b.no = sale.no; b.total = sale.total; } if ((d.bills || []).length && d.bills.every(x => x.status === 'paid')) { d.status = 'closed'; d.closedAt = new Date().toISOString(); } }); PX.ctx = null; PX.cart = []; pxResetPay(); PX.tab = 'tables';
    if (n.status === 'closed') { PX.tabs = PX.tabs.filter(x => x.id !== n.id); pxToast('✅ Bayad na ang buong table'); pxRender(); } else { pxRender(); pxSplit(n.id); } } catch (e) { pxAlert('Na-save ang benta pero hindi ma-update ang table: ' + e.message); PX.ctx = null; pxBody(); }
}

/* ---------- Hati sa presyo (equal / custom na halaga) ---------- */
let PX_SPP = null;
function pxSpPrice() {
  const open = PX_SP.bills.filter(b => b.status === 'open'), S = pxR2(open.reduce((s, b) => s + pxBillSub(b), 0)), t = PX.tabs.find(x => x.id === PX_SP.id) || {};
  if (!(S > 0)) { pxAlert('Walang hindi pa bayad na item na hahatiin.'); return; } PX_SPP = { S, n: Math.min(10, Math.max(2, +t.pax || 2)), mode: 'eq', amts: [], err: '' }; pxSppRender();
}
function pxSppShares() { const P = PX_SPP, n = P.n; if (P.mode === 'eq') { const base = Math.floor(P.S * 100 / n) / 100, a = Array(n).fill(pxR2(base)); a[n - 1] = pxR2(P.S - base * (n - 1)); return a; } const a = []; let used = 0; for (let i = 0; i < n - 1; i++) { const v = pxR2(pxNum(P.amts[i])); a.push(v); used += v; } a.push(pxR2(P.S - used)); return a; }
function pxSppSet(k, v) { if (k === 'n') { PX_SPP.n = Math.max(2, Math.min(20, parseInt(v) || 2)); PX_SPP.amts = []; } else if (k === 'mode') { if (v === 'custom' && PX_SPP.mode !== 'custom') PX_SPP.amts = pxSppShares(); PX_SPP.mode = v; } PX_SPP.err = ''; pxSppRender(); }
function pxSppAmt(i, v) { PX_SPP.amts[i] = v; const sh = pxSppShares(), last = document.getElementById('spp-last'); if (last) { last.textContent = pxM(sh[sh.length - 1]); last.style.color = sh[sh.length - 1] > 0 ? '#0f172a' : '#dc2626'; } }
function pxSppRender() {
  const P = PX_SPP, sh = pxSppShares();
  pxOv('px-dspp', `<h3 style="margin-top:0;">➗ Hati sa presyo</h3>${pxHint('📖 Hahatiin ang <b>kabuuang halaga</b> ng hindi pa bayad (₱' + pxM(P.S) + ') — hindi item-by-item. Piliin kung <b>ilang bill</b>, at <b>Pantay-pantay</b> o <b>Custom na halaga</b> (ang huling bill ang kukuha ng matitira). Awtomatikong hahatiin din ang bawat item (at ang ibabawas sa inventory) ayon sa proporsyon ng halaga. Puwede pa ring lagyan ng sariling discount ang bawat bill.')}
  ${pxLbl('Ilang bill?')}<div style="display:flex;gap:.3rem;flex-wrap:wrap;">${[2, 3, 4, 5, 6, 8, 10].map(n => `<button class="btn ${P.n === n ? 'btn-primary' : 'btn-secondary'}" style="min-width:2.6rem;" onclick="pxSppSet('n',${n})">${n}</button>`).join('')}<input type="number" min="2" max="20" placeholder="iba" value="${[2, 3, 4, 5, 6, 8, 10].includes(P.n) ? '' : P.n}" onchange="pxSppSet('n',this.value)" style="width:64px;"></div>
  ${pxLbl('Paraan')}<div style="display:flex;gap:.3rem;"><button class="btn ${P.mode === 'eq' ? 'btn-primary' : 'btn-secondary'}" style="flex:1;" onclick="pxSppSet('mode','eq')">⚖️ Pantay-pantay</button><button class="btn ${P.mode === 'custom' ? 'btn-primary' : 'btn-secondary'}" style="flex:1;" onclick="pxSppSet('mode','custom')">✏️ Custom na halaga</button></div>
  <div style="margin-top:.5rem;">${sh.map((a, i) => `<div style="display:flex;align-items:center;gap:.4rem;margin-bottom:.25rem;"><b style="width:60px;">Bill ${i + 1}</b>${P.mode === 'custom' && i < sh.length - 1 ? `<input type="number" step="0.01" value="${a}" oninput="pxSppAmt(${i},this.value)" style="flex:1;font-size:1.05rem;">` : `<span ${i === sh.length - 1 ? 'id="spp-last"' : ''} style="flex:1;font-size:1.05rem;font-weight:700;${a <= 0 ? 'color:#dc2626;' : ''}">${pxM(a)}</span>`}${i === sh.length - 1 && P.mode === 'custom' ? '<small>(matitira)</small>' : ''}</div>`).join('')}</div>
  <div style="font-size:.82rem;color:#475569;">Kabuuan: <b>₱${pxM(P.S)}</b></div>${P.err ? `<div style="color:#dc2626;font-weight:700;margin-top:.3rem;">${pxE(P.err)}</div>` : ''}
  <div style="display:flex;gap:.5rem;margin-top:.8rem;">${pxBtn('btn-secondary', 'Kanselahin', "pxOvHide('px-dspp')", 'flex:1;padding:.7rem;')}${pxBtn('btn-success', '✅ Hatiin', 'pxSppApply()', 'flex:2;padding:.7rem;')}</div>`, 10200, 520);
}
function pxSppApply() {
  const P = PX_SPP, sh = pxSppShares(); if (sh.some(a => !(a > 0))) { P.err = 'May bill na wala o negatibo ang halaga. Ayusin ang mga halaga.'; pxSppRender(); return; }
  const open = PX_SP.bills.filter(b => b.status === 'open'), pool = {}; open.forEach(b => b.lines.forEach(l => { const k = l.id + '|' + l.price; if (!pool[k]) pool[k] = { id: l.id, name: l.name, price: l.price, qty: 0 }; pool[k].qty = +(pool[k].qty + l.qty).toFixed(6); }));
  const keys = Object.keys(pool), S = P.S, used = {}, nb = []; keys.forEach(k => { used[k] = 0; });
  sh.forEach((a, i) => { const lines = []; keys.forEach(k => { const L = pool[k]; let q = i === sh.length - 1 ? +(L.qty - used[k]).toFixed(6) : +(L.qty * a / S).toFixed(6); used[k] = +(used[k] + q).toFixed(6); if (q > 1e-6) lines.push({ id: L.id, name: L.name, price: L.price, qty: q }); }); nb.push({ id: 'b' + Date.now().toString(36) + i, name: 'Bill', status: 'open', byPrice: true, share: a, lines }); });
  PX_SP.bills = PX_SP.bills.filter(b => b.status === 'paid').concat(nb); PX_SP.bills.forEach((b, i) => { b.name = 'Bill ' + (i + 1); }); pxOvHide('px-dspp'); pxSpRender();
}

/* ---------- Sold out / Availability (86) — branch manager ---------- */
function pxIsOff0(id) { const o = (PX.off || {})[id]; if (!o) return false; return o.until === 'manual' || o.date === pxToday(); }
function pxIsOff(id) { if (pxIsOff0(id)) return true; const m = (PX.menu || []).find(x => x.id === id); return !!(m && (m.subs || []).some(s => pxIsOff0(s.id))); } // combo: sold out kapag sold out ang alinmang sub-item
async function pxOffLoad() { try { const d = await db.collection('pos_86').doc(PX.site).get(); PX.off = d.exists ? (d.data().items || {}) : {}; } catch (e) {} }
async function pxOffSave() { const items = {}; Object.keys(PX.off).forEach(k => { if (pxIsOff(k)) items[k] = PX.off[k]; }); PX.off = items; await db.collection('pos_86').doc(PX.site).set({ company: pxCo(), site: PX.site, items, updatedBy: String(pxMe().email || ''), updatedAt: new Date().toISOString() }); }
async function pxAvail() {
  await pxOffLoad(); const L = pxMenuItems().sort((a, b) => String(a.category || '').localeCompare(String(b.category || '')) || a.name.localeCompare(b.name)), nOff = L.filter(m => pxIsOff(m.id)).length;
  pxModal(`<h3 style="margin-top:0;">🚫 Sold out / Availability — ${pxE(pxSite().name || '')}</h3>${pxHint('📖 Kapag hindi na kayang gawin ng kusina ang isang menu, pindutin ang <b>🚫 Sold out</b>. Hindi na ito mapipili sa POS at sa pagkuha ng order ng branch na ito (makikita itong <b>pula at naka-strikethrough</b>). Piliin kung <b>hanggang ngayong araw lang</b> (kusang babalik bukas) o <b>hanggang i-on mo ulit</b>. Pindutin ang <b>✅ Available</b> para ibalik.')}
  <div style="display:flex;gap:.4rem;align-items:center;flex-wrap:wrap;">${pxSearchBox('.av-row', '🔎 Hanapin ang menu item…')}</div>
  <div style="font-size:.82rem;color:#475569;margin:.2rem 0;">Sold out ngayon: <b>${nOff}</b> ${nOff ? '<button class="btn btn-secondary btn-sm" onclick="pxAvailAll()">✅ Ibalik lahat</button>' : ''}</div>
  <div style="max-height:56vh;overflow:auto;">${L.map(m => { const o = pxIsOff(m.id) ? PX.off[m.id] : null; return `<div class="av-row" data-s="${pxE(m.name + ' ' + (m.category || ''))}" style="display:flex;align-items:center;gap:.4rem;border-bottom:1px solid #f1f5f9;padding:.35rem 0;${o ? 'background:#fef2f2;' : ''}"><span style="flex:1;${o ? 'text-decoration:line-through;color:#b91c1c;' : ''}">${pxE(m.name)} <small style="color:#64748b;">${pxE(m.category || '')}</small>${o ? '<br><small style="color:#b91c1c;">SOLD OUT · ' + (o.until === 'manual' ? 'hanggang i-on ulit' : 'ngayong araw lang') + (o.by ? ' · ' + pxE(o.by) : '') + '</small>' : ''}</span>${o ? `<button class="btn btn-success btn-sm" onclick="pxAvailOn('${m.id}')">✅ Available</button>` : `<button class="btn btn-danger btn-sm" onclick="pxAvailOff('${m.id}')">🚫 Sold out</button>`}</div>`; }).join('') || '<div style="color:#94a3b8;">Walang menu.</div>'}</div>`, 700);
}
async function pxAvailOff(id) {
  const m = PX.menu.find(x => x.id === id) || { name: id }, k = await pxChoice('🚫 ' + m.name + ' — Sold out', [{ k: 'day', label: '📅 Hanggang ngayong araw lang', sub: 'Kusang babalik bukas', cls: 'btn-primary' }, { k: 'manual', label: '🔒 Hanggang i-on ko ulit', sub: 'Mananatiling sold out hanggang ibalik mo' }], { cols: 1, hint: 'Hindi na ito mapipili o ma-punch sa POS ng branch na ito.' }); if (!k) return;
  try { PX.off[id] = { until: k, date: pxToday(), by: String(pxMe().name || pxMe().email || ''), at: new Date().toISOString() }; await pxOffSave(); try { await logSystemAction('POS_SOLDOUT', m.name + ' @ ' + (pxSite().name || '')); } catch (e) {} pxAvail(); pxBody(); } catch (e) { pxAlert('Error: ' + e.message); }
}
async function pxAvailOn(id) { try { delete PX.off[id]; await pxOffSave(); pxAvail(); pxBody(); } catch (e) { pxAlert('Error: ' + e.message); } }
async function pxAvailAll() { if (!await pxConfirm('Ibalik ang lahat ng sold out na item?', { ok: 'Ibalik lahat' })) return; try { PX.off = {}; await pxOffSave(); pxAvail(); pxBody(); } catch (e) { pxAlert('Error: ' + e.message); } }

/* ================= PRINTERS / KITCHEN STATIONS (print agent sa LAN) =================
   Ang browser ay hindi puwedeng direktang mag-print sa IP ng printer. Kaya: ang POS ay gumagawa ng "print job" sa Firestore (pos_print_jobs),
   at ang maliit na Print Agent (print-agent.js) sa isang computer/Raspberry Pi sa LAN ng branch ang kumukuha at nagpapadala sa printer (IP:9100). */
const PX_STN_SUG = ['Sushi', 'Hot Kitchen', 'Cold Kitchen', 'Ramen', 'Itame', 'Agemono', 'Tempura', 'Drinks', 'Yakitori', 'Dessert', 'Bar', 'Grill'];
/* Oras ng station: m.stWin = { stationKey: ['11:00','16:00'] } — blangko = buong araw; puwedeng tumawid ng hatinggabi */
function pxStnInWin(m, k, at) { const w = (m.stWin || {})[k]; if (!w || (!w[0] && !w[1])) return true; const d = at || new Date(), n = d.getHours() * 60 + d.getMinutes(), t = s => { const p = String(s || '').split(':'); return p.length > 1 ? (+p[0]) * 60 + (+p[1]) : null; }, a = t(w[0]), b = t(w[1]); if (a == null && b == null) return true; if (a == null) return n <= b; if (b == null) return n >= a; return a <= b ? (n >= a && n <= b) : (n >= a || n <= b); }
const pxStns = () => (PX.cfg && PX.cfg.stations) || [];
const pxIpOk = ip => /^\d{1,3}(\.\d{1,3}){3}$/.test(String(ip || '').trim()) && String(ip).trim().split('.').every(n => +n <= 255);
const pxStnReady = k => { const c = (PX.stn || {})[k]; return !!(c && c.enabled !== false && pxIpOk(c.ip)); };
const pxAgentOn = () => !!(PX.agent && (Date.now() - (PX.agent.ms || 0)) < 90000);
async function pxStnReload(onlyAgent) { try { const [sd, ad] = await Promise.all([db.collection('pos_stations').doc(PX.site).get(), db.collection('pos_print_agents').doc(PX.site).get()]); if (!onlyAgent) { const d = sd.exists ? sd.data() : {}; PX.stn = d.map || {}; PX.stnFb = d.fallback === undefined ? '_cashier' : d.fallback; PX.fmt = d.fmt || {}; PX._stnDirty = false; } PX.agent = ad.exists ? ad.data() : null; } catch (e) { PX.stn = PX.stn || {}; } }
const pxStnCfg = k => { const c = PX.stn[k] = PX.stn[k] || {}; if (c.port == null) c.port = 9100; if (!c.paper) c.paper = '80'; if (c.copies == null) c.copies = 1; if (c.enabled == null) c.enabled = true; if (c.ip == null) c.ip = ''; return c; };
async function pxPrintersView() {
  await pxStnReload(PX._stnDirty ? 'agent' : ''); const adm = pxAdmin(), S = pxStns(), on = pxAgentOn();
  return `${pxHint('📖 <b>Paano gumagana:</b> ang browser/iPad ay <b>hindi</b> puwedeng direktang mag-print sa IP ng printer. Kaya pagka-punch ng order, ang POS ay gagawa ng <b>print job</b> bawat <b>station</b> (Sushi, Hot Kitchen…) at ang <b>Print Agent</b> — maliit na program na tumatakbo sa isang computer/Raspberry Pi sa <b>LAN ng branch</b> — ang kukuha nito at magpapadala sa <b>IP ng printer</b> ng station (port 9100, ESC/POS). <b>Hakbang:</b> (1) Idagdag ang mga station. (2) Ilagay ang <b>local IP</b> ng printer ng bawat station (gawing <i>static / DHCP reservation</i> ang IP sa router). (3) Sa Menu, piliin kung anong station ang gumagawa ng bawat item. (4) I-run ang Print Agent (print-agent.js). (5) Pindutin ang <b>🖨️ Test print</b>.')}
  <div style="border:2px solid ${on ? '#16a34a' : '#dc2626'};border-radius:.5rem;padding:.4rem .6rem;margin-bottom:.5rem;font-size:.88rem;"><b>${on ? '🟢 Online ang Print Agent' : '🔴 Offline / wala pang Print Agent'}</b> ${PX.agent ? '<small style="color:#64748b;">· huling kita: ' + pxE(new Date(PX.agent.ms || 0).toLocaleTimeString('en-PH')) + (PX.agent.host ? ' · ' + pxE(PX.agent.host) : '') + '</small>' : ''}${on ? '' : '<br><small>Hangga\'t walang tumatakbong agent sa LAN ng branch na ito, ang mga ticket at resibo ay ipi-print sa <b>browser/printer ng device</b> (hindi ito maiipon sa pila).</small>'}<div style="margin-top:.3rem;display:flex;gap:.4rem;flex-wrap:wrap;"><button class="btn btn-secondary btn-sm" onclick="pxBody()">🔄 Refresh</button><button class="btn btn-secondary btn-sm" onclick="pxQueueView()">📋 Print queue</button></div></div>
  ${adm ? `<div style="border:1px solid #e2e8f0;border-radius:.5rem;padding:.5rem;margin-bottom:.5rem;"><b>➕ Idagdag ang station (para sa buong company)</b>${pxHint('Ang pangalan ng station ay pareho sa lahat ng branch ng company; ang <b>IP ng printer</b> ay sariling set ng bawat branch.')}<div style="display:flex;gap:.3rem;flex-wrap:wrap;margin-bottom:.3rem;">${PX_STN_SUG.filter(n => !S.some(s => s.key === pxSlug(n))).map(n => `<button class="btn btn-secondary btn-sm" onclick="pxStnAdd('${n}')">+ ${n}</button>`).join('') || '<small>Naidagdag mo na ang lahat ng suhestiyon.</small>'}</div><div style="display:flex;gap:.3rem;"><input id="st-new" placeholder="Ibang station (hal. Salad, Mochi)" style="flex:1;"><button class="btn btn-primary btn-sm" onclick="pxStnAdd(document.getElementById('st-new').value)">➕ Idagdag</button></div></div>` : ''}
  ${pxStnCard({ key: '_cashier', name: 'Cashier printer' }, true)}
  ${S.length ? S.map(s => pxStnCard(s, false)).join('') : '<div style="color:#94a3b8;padding:.5rem;">Wala pang station. ' + (adm ? 'Idagdag sa itaas.' : 'Magpadagdag sa admin.') + '</div>'}<button class="btn btn-success" style="margin-top:.3rem;" onclick="pxStnSave()">💾 I-save ang mga IP ng printer</button>
  ${pxFbCard()}
  ${pxFmtCard()}
  ${adm && S.length ? `<div style="border:1px solid #e2e8f0;border-radius:.5rem;padding:.5rem;margin-top:.6rem;"><b>Item na walang station</b>${pxHint('Kapag may item sa menu na walang station, saan ito ipi-print? Piliin ang default na station. Kapag walang napili, ipi-print ito sa browser (karaniwang printer ng device).')}<div style="display:flex;gap:.3rem;flex-wrap:wrap;"><button class="btn ${!PX.cfg.defaultStation ? 'btn-primary' : 'btn-secondary'} btn-sm" onclick="pxStnDefault('')">Browser print</button>${S.map(s => `<button class="btn ${PX.cfg.defaultStation === s.key ? 'btn-primary' : 'btn-secondary'} btn-sm" onclick="pxStnDefault('${s.key}')">${pxE(s.name)}</button>`).join('')}</div><label style="display:block;margin-top:.4rem;"><input type="checkbox" ${PX.cfg.kitchenCounter !== false ? 'checked' : ''} onchange="pxStnCounter(this.checked)"> Ipadala rin sa kusina ang orders ng <b>Counter POS</b> (take-out/walk-in)</label></div>` : ''}`;
}
function pxStnChk(k, el) { const e = document.getElementById('st-e-' + k), v = el.value.trim(); if (e) e.textContent = v && !pxIpOk(v) ? 'Di-wastong IP (hal. 192.168.1.50)' : ''; el.style.borderColor = v && !pxIpOk(v) ? '#dc2626' : ''; }
function pxStnSet(k, f, v) { pxStnCfg(k)[f] = v; PX._stnDirty = true; pxBody(); }
function pxStnFbSet(v) { PX.stnFb = v; PX._stnDirty = true; pxBody(); }
async function pxStnPersist(patch) { await db.collection('pos_setup').doc(pxSlug(pxCo())).set(Object.assign({ company: pxCo() }, patch), { merge: true }); PX.cfg = Object.assign({}, PX.cfg, patch); }
async function pxStnAdd(name) { name = String(name || '').trim(); if (!name) return; const key = pxSlug(name); if (!key) return; if (pxStns().some(s => s.key === key)) { pxAlert('Mayroon nang station na "' + name + '".'); return; } try { await pxStnPersist({ stations: pxStns().concat([{ key, name }]) }); pxBody(); } catch (e) { pxAlert('Error: ' + e.message); } }
async function pxStnDel(key) { const used = PX.menu.filter(m => (m.stations || []).includes(key)).length; if (!await pxConfirm('Burahin ang station na ito' + (used ? ' (ginagamit pa ng ' + used + ' menu item)' : '') + '? Ang mga item ay hindi mabubura, mawawala lang ang station nila.', { danger: true, ok: 'Burahin' })) return; try { await pxStnPersist({ stations: pxStns().filter(s => s.key !== key), defaultStation: PX.cfg.defaultStation === key ? '' : PX.cfg.defaultStation }); pxBody(); } catch (e) { pxAlert('Error: ' + e.message); } }
async function pxStnDefault(k) { try { await pxStnPersist({ defaultStation: k }); pxBody(); } catch (e) { pxAlert('Error: ' + e.message); } }
async function pxStnCounter(v) { try { await pxStnPersist({ kitchenCounter: !!v }); } catch (e) { pxAlert('Error: ' + e.message); } }
async function pxStnSave(quiet) {
  const bad = pxStnAll().filter(s => PX.stn[s.key] && PX.stn[s.key].ip && !pxIpOk(PX.stn[s.key].ip)); if (bad.length) { pxAlert('Di-wasto ang IP ng: ' + bad.map(s => s.name).join(', ') + '. Ayusin muna (hal. 192.168.1.50).'); return false; }
  try { const map = {}, names = {}; pxStnAll().forEach(s => { const c = pxStnCfg(s.key); names[s.key] = s.name; map[s.key] = { ip: String(c.ip || '').trim(), port: +c.port || 9100, paper: c.paper || '80', copies: +c.copies || 1, enabled: c.enabled !== false, backup: c.backup && c.backup !== s.key ? c.backup : '' }; if (s.key === '_cashier') map[s.key].receipts = c.receipts !== false; }); await db.collection('pos_stations').doc(PX.site).set({ company: pxCo(), site: PX.site, map, names, fallback: pxFb(), fmt: pxFmtW(), updatedBy: String(pxMe().email || ''), updatedAt: new Date().toISOString() }); PX.stn = map; PX._stnDirty = false; if (!quiet) pxToast('✅ Na-save ang printer settings'); return true; } catch (e) { pxAlert('Error: ' + e.message); return false; }
}
/* ---------- Gumawa ng print job ---------- */
function pxJobDoc(k, ticket) { const c = PX.stn[k] || {}, s = { name: pxStnName(k) }, now = Date.now(); return { company: pxCo(), site: PX.site, siteName: pxSite().name || '', station: k, stationName: s.name, via: [k], ip: String(c.ip || '').trim(), port: +c.port || 9100, paper: c.paper || '80', copies: +c.copies || 1, status: 'pending', tries: 0, createdAt: new Date(now).toISOString(), createdMs: now, by: String(pxMe().email || ''), ticket }; }
async function pxKitchenSend(o) { // o {type,tableName,zone,pax,orderNo,ref,chan,items:[{id,name,qty,note}]}
  const out = { n: 0, loose: [], lost: [], moved: [], agentOn: pxAgentOn() }; try {
    const groups = {}, why = {}, seen = {}; const asg = l => { const m = PX.menu.find(x => x.id === l.id) || {}; let ks = (m.stations || []).filter(k => pxStnAll().some(s => s.key === k) && pxStnInWin(m, k)); if (!ks.length && PX.cfg.defaultStation && pxStnAll().some(s => s.key === PX.cfg.defaultStation)) ks = [PX.cfg.defaultStation]; return { m, ks }; };
    const flat = []; (o.items || []).forEach(l => { const m0 = PX.menu.find(x => x.id === l.id) || {}; if (!(m0.subs || []).length) { flat.push(l); return; } m0.subs.forEach(sx => { const sm = PX.menu.find(x => x.id === sx.id); if (sm) flat.push({ id: sm.id, name: sm.name, qty: (+l.qty || 1) * (+sx.qty || 1), note: ((l.note || '') + ' [' + (m0.kname || l.name) + ']').trim() }); }); if ((m0.stations || []).length) flat.push(l); });
    flat.forEach((l, li) => { const { m, ks } = asg(l); if (!ks.length) { out.loose.push(l); return; }
      if (!out.agentOn) { out.loose.push(l); out.lost.push(l); return; }
      let lost = false; ks.forEach(k => { const d = pxPickDest(k); if (!d) { lost = true; return; } const key = d + '|' + li; if (seen[key]) return; seen[key] = 1; (groups[d] = groups[d] || []).push({ qty: +(+l.qty).toFixed(3), name: m.kname || l.name, note: l.note || '', also: ks.filter(x => x !== k).map(pxStnName) }); if (d !== k) { const w = pxStnName(k) + ' (' + (pxWhyDown(k) || 'hindi maabot') + ')'; (why[d] = why[d] || []); if (!why[d].includes(w)) why[d].push(w); if (!out.moved.includes(pxStnName(k) + ' → ' + pxStnName(d))) out.moved.push(pxStnName(k) + ' → ' + pxStnName(d)); } });
      if (lost) { out.loose.push(l); out.lost.push(l); } });
    const ops = Object.keys(groups).map(k => ({ t: 'set', col: 'pos_print_jobs', id: pxId('PJ'), d: pxJobDoc(k, pxWithLines(k, { type: o.type || 'table', table: o.tableName || '', zone: o.zone || '', pax: o.pax || 0, orderNo: o.orderNo || 0, ref: o.ref || '', chan: o.chan || '', at: new Date().toISOString(), by: String(pxMe().name || pxMe().email || ''), items: groups[k], reroute: why[k] || [] })) }));
    if (ops.length) await pxBatch(ops); out.n = ops.length; out.stations = Object.keys(groups).map(pxStnName); out.off = !out.agentOn && out.lost.length > 0;
  } catch (e) { out.n = 0; out.err = e.message; } return out;
}
async function pxStnTest(k) {
  if (!await pxStnSave(true)) return; if (!pxStnReady(k)) { await pxAlert('Ilagay muna ang tamang IP at i-on ang station.'); return; }
  try { await pxBatch([{ t: 'set', col: 'pos_print_jobs', id: pxId('PJ'), d: pxJobDoc(k, k === '_cashier' ? { type: 'receipt', lines: [{ t: 'CASHIER PRINTER', c: true, b: true, big: true }, { t: 'TEST PRINT', c: true, b: true }, '', 'Kung nababasa mo ito,', 'gumagana ang Cashier printer.', '', new Date().toLocaleString('en-PH')], at: new Date().toISOString(), items: [] } : { type: 'test', table: 'TEST', zone: '', pax: 0, orderNo: 0, ref: '', at: new Date().toISOString(), by: String(pxMe().name || pxMe().email || ''), items: [{ qty: 1, name: 'TEST PRINT', note: 'Kung nababasa mo ito, gumagana ang printer.' }] }) }]); pxToast('🖨️ Naipadala ang test print' + (pxAgentOn() ? '' : ' (⚠ offline ang agent)')); if (!pxAgentOn()) pxAlert('Naipadala ang test print sa pila, pero OFFLINE ang Print Agent. I-run ang print-agent.js sa computer/Raspberry Pi sa LAN ng branch para mag-print.', '⚠ Offline ang Print Agent'); } catch (e) { pxAlert('Error: ' + e.message); }
}
/* ---------- Print queue ---------- */
async function pxQueueView() {
  pxModal('<div style="padding:.5rem;">Kinukuha…</div>', 760); let L = []; try { (await db.collection('pos_print_jobs').where('site', '==', PX.site).get()).forEach(x => L.push(Object.assign({ id: x.id }, x.data()))); } catch (e) { pxModal('<div style="color:#dc2626;">Error: ' + pxE(e.message) + '</div>'); return; }
  L.sort((a, b) => (b.createdMs || 0) - (a.createdMs || 0)); L = L.slice(0, 40); const bd = { pending: ['#fef9c3', '#854d0e', '⏳ Naghihintay'], printing: ['#dbeafe', '#1e40af', '🖨️ Nagpi-print'], printed: ['#dcfce7', '#166534', '✅ Na-print'], failed: ['#fee2e2', '#b91c1c', '❌ Pumalya'], rerouted: ['#ffedd5', '#9a3412', '↪️ Nilipat'] };
  pxModal(`<h3 style="margin-top:0;">📋 Print queue — ${pxE(pxSite().name || '')}</h3>${pxHint('📖 Mga huling ticket na ipinadala sa kusina. <b>⏳ Naghihintay</b> nang matagal = walang Print Agent na kumukuha. <b>❌ Pumalya</b> = hindi maabot ang printer (check ang IP, kuryente, at network). Pindutin ang <b>🔁 Ulitin</b> para i-print muli.')}${pxSearchBox('.pq-row', '🔎 Station, table, item…')}
  <div style="overflow:auto;"><table class="table" style="font-size:.8rem;"><tr><th>Oras</th><th>Station</th><th>Ticket</th><th>Status</th><th></th></tr>${L.map(j => { const b = bd[j.status] || bd.pending, t = j.ticket || {}; return `<tr class="pq-row" data-s="${pxE(j.stationName + ' ' + (t.table || '') + ' ' + (t.items || []).map(i => i.name).join(' '))}"><td>${pxE(new Date(j.createdMs || 0).toLocaleTimeString('en-PH'))}</td><td><b>${pxE(j.stationName)}</b><br><small>${pxE(j.ip)}</small></td><td>${pxE(t.type === 'test' ? 'TEST' : t.table || t.ref || '')}${t.orderNo ? ' · Order ' + t.orderNo : ''}<br><small>${(t.items || []).map(i => i.qty + '× ' + pxE(i.name)).join(', ')}</small></td><td><span style="background:${b[0]};color:${b[1]};border-radius:.6rem;padding:.05rem .45rem;font-weight:700;">${b[2]}</span>${j.rerouteTo ? '<br><small>→ ' + pxE(j.rerouteTo) + '</small>' : ''}${j.via === 'browser' ? '<br><small>sa browser</small>' : ''}${j.error ? '<br><small style="color:#b91c1c;">' + pxE(j.error) + '</small>' : ''}</td><td><button class="btn btn-secondary btn-sm" onclick="pxJobRedo('${j.id}')">🔁 Ulitin</button>${j.status === 'failed' || j.status === 'pending' ? ` <button class="btn btn-warning btn-sm" onclick="pxJobBrowser('${j.id}')">🖨️ Browser</button>` : ''}${j.status === 'failed' && !j.ack ? ` <button class="btn btn-secondary btn-sm" onclick="pxJobAck('${j.id}')">✔ Ayos na</button>` : ''}</td></tr>`; }).join('') || '<tr><td colspan="5"><small>Wala pang job.</small></td></tr>'}</table></div>`, 760);
}
async function pxJobRedo(id) { try { const d = (await db.collection('pos_print_jobs').doc(id).get()).data(); if (!d) return; const n = Object.assign({}, d, { status: 'pending', tries: 0, error: '', createdMs: Date.now(), createdAt: new Date().toISOString(), printedAt: '' }); n.ticket = Object.assign({}, d.ticket, { reprint: true }); await db.collection('pos_print_jobs').doc(pxId('PJ')).set(n); pxToast('🔁 Naipadala muli'); pxQueueView(); } catch (e) { pxAlert('Error: ' + e.message); } }
function pxStnCard(s, cash) { const adm = pxAdmin(), c = pxStnCfg(s.key), bad = c.ip && !pxIpOk(c.ip), ready = pxStnReady(s.key), h = pxStnHealth(s.key), hb = !ready ? '' : h ? (h.ok === false ? `<span style="color:#b91c1c;font-weight:700;">🔴 ${pxE(h.why || 'Hindi maabot')}</span>` : `<span style="color:#166534;">🟢 Online${h.unverified ? ' (walang status reply)' : ''}</span>`) : '<span style="color:#64748b;">⚪ Hindi pa nasusuri</span>'; return `<div style="border:2px solid ${ready ? '#16a34a' : '#cbd5e1'};border-radius:.5rem;padding:.5rem;margin-bottom:.4rem;"><div style="display:flex;justify-content:space-between;gap:.3rem;flex-wrap:wrap;align-items:center;"><b style="font-size:1rem;">${cash ? '🧾' : '🍳'} ${pxE(s.name)}</b><span style="font-size:.78rem;">${ready ? '✅ Handa' : '⚠ Walang IP / naka-off'} ${hb}${adm && !cash ? `<button class="btn btn-danger btn-sm" onclick="pxStnDel('${s.key}')">🗑️</button>` : ''}</span></div>
  <div style="display:flex;gap:.5rem;flex-wrap:wrap;align-items:end;margin-top:.3rem;"><div>${pxLbl('Local IP ng printer', 'hal. 192.168.1.50')}<input value="${pxE(c.ip)}" placeholder="192.168.1.50" inputmode="decimal" oninput="PX._stnDirty=true;PX.stn['${s.key}'].ip=this.value.trim();pxStnChk('${s.key}',this)" style="width:150px;${bad ? 'border-color:#dc2626;' : ''}"><div id="st-e-${s.key}" style="color:#dc2626;font-size:.72rem;">${bad ? 'Di-wastong IP (hal. 192.168.1.50)' : ''}</div></div>
  <div>${pxLbl('Port', 'Karaniwan 9100')}<input type="number" value="${c.port}" oninput="PX._stnDirty=true;PX.stn['${s.key}'].port=+this.value||9100" style="width:80px;"></div>
  <div>${pxLbl('Papel')}<div style="display:flex;gap:.2rem;"><button class="btn ${c.paper === '80' ? 'btn-primary' : 'btn-secondary'} btn-sm" onclick="pxStnSet('${s.key}','paper','80')">80mm</button><button class="btn ${c.paper === '58' ? 'btn-primary' : 'btn-secondary'} btn-sm" onclick="pxStnSet('${s.key}','paper','58')">58mm</button></div></div>
  <div>${pxLbl('Kopya')}<div style="display:flex;gap:.2rem;">${[1, 2, 3].map(n => `<button class="btn ${c.copies === n ? 'btn-primary' : 'btn-secondary'} btn-sm" onclick="pxStnSet('${s.key}','copies',${n})">${n}</button>`).join('')}</div></div>
  <div>${pxLbl('Status')}<button class="btn ${c.enabled ? 'btn-success' : 'btn-secondary'} btn-sm" onclick="pxStnSet('${s.key}','enabled',${!c.enabled})">${c.enabled ? '✅ Naka-on' : '⏸️ Naka-off'}</button></div>
  <div>${pxLbl('Backup printer', 'Kapag hindi maabot / patay / naubos ang papel ng printer na ito, saan ililipat ang ticket?')}<select onchange="pxStnSet('${s.key}','backup',this.value)" style="max-width:190px;"><option value="">Default (${pxE(pxFb() ? pxStnName(pxFb()) : 'browser lang')})</option>${pxStnAll().filter(x => x.key !== s.key).map(x => `<option value="${x.key}" ${c.backup === x.key ? 'selected' : ''}>${pxE(x.name)}</option>`).join('')}</select></div>${cash ? `<label style="font-size:.82rem;align-self:center;"><input type="checkbox" ${c.receipts !== false ? 'checked' : ''} onchange="pxStnSet('_cashier','receipts',this.checked)"> Dito i-print ang <b>resibo / bill</b></label>` : ''}<button class="btn btn-secondary btn-sm" onclick="pxStnTest('${s.key}')">🖨️ Test print</button></div></div>`; }
function pxFbCard() {
  if (!pxAdmin() && !pxMgr()) return ''; return `<div style="border:1px solid #e2e8f0;border-radius:.5rem;padding:.5rem;margin-top:.6rem;"><b>🛟 Default na backup printer</b>${pxHint('📖 Kapag hindi maabot ang printer ng isang station (patay, nabunot ang kuryente/network, naagaw ang IP, naubos ang papel, nakabukas ang takip) at <b>wala itong sariling Backup</b>, dito ililipat ang ticket. May tatak sa ticket na <b>"NILIPAT DITO — galing: Drinks"</b>. Hindi ito maghihintay na mabuhay ang printer. Kung wala ring available, ipi-print sa <b>browser ng device</b> at may babala sa screen.')}<div style="display:flex;gap:.3rem;flex-wrap:wrap;"><button class="btn ${!pxFb() ? 'btn-primary' : 'btn-secondary'} btn-sm" onclick="pxStnFbSet('')">Browser lang</button>${pxStnAll().map(x => `<button class="btn ${pxFb() === x.key ? 'btn-primary' : 'btn-secondary'} btn-sm" onclick="pxStnFbSet('${x.key}')">${pxE(x.name)}</button>`).join('')}</div>
  <details style="margin-top:.5rem;"><summary style="cursor:pointer;font-weight:700;">📋 Ano ang mangyayari kapag…</summary><table class="table" style="font-size:.8rem;margin-top:.3rem;"><tr><th>Sitwasyon</th><th>Ano ang gagawin ng system</th></tr>
  <tr><td>Patay / nabasa / nabunot ang kuryente ng printer</td><td>Susubukan nang 2 beses (~3 seg), tapos ililipat sa Backup. Matatandaan na down ito, kaya ang susunod na order ay <b>diretso na</b> sa backup.</td></tr>
  <tr><td>Nabunot ang LAN cable / WiFi, o namatay ang switch</td><td>Pareho sa itaas. Kapag bumalik ang printer (sinusuri bawat 20 seg), babalik ito sa normal.</td></tr>
  <tr><td>Naagaw ng ibang device ang IP (kahit static)</td><td>Kapag walang sagot na galing sa printer o tinanggihan ang koneksyon → lipat sa backup. Kung ibang printer/device ang sumagot, makikita sa 🟢/⚪ na "walang status reply" — i-Test print para makumpirma.</td></tr>
  <tr><td>Naubusan ng papel / nakabukas ang takip</td><td>Natutukoy ito ng agent (kung sinusuportahan ng printer) → lipat sa backup bago pa mag-print.</td></tr>
  <tr><td>Walang IP / naka-off ang station</td><td>Diretso sa backup, may tatak kung sino ang pinanggalingan.</td></tr>
  <tr><td>Parehong sira ang station at backup</td><td>Susunod sa chain ng backup (hanggang walang maulit). Kung wala nang natira: ❌ "Pumalya" + babala sa screen + <b>🖨️ Browser</b> button sa Print queue.</td></tr>
  <tr><td>Patay ang Print Agent / PC / internet</td><td>Hindi na gagawa ng pila: ang ticket ay <b>ipi-print agad sa browser</b> ng device at may pulang babala. Ang mga nakabinbin na ay may <b>I-print sa browser</b> button.</td></tr>
  <tr><td>Walang internet pero gumagana ang LAN</td><td>Ang POS mismo ay nangangailangan ng internet (Firestore); gumamit ng backup na internet (hal. hotspot) o i-print sa browser.</td></tr>
  <tr><td>Jammed / blangko ang naka-print</td><td>Hindi ito matutukoy ng printer. Gamitin ang <b>🔁 Ulitin</b> sa Print queue.</td></tr></table></details></div>`;
}

function pxWithLines(k, tk) { try { tk.lines = pxKitchenLines(tk, pxStnName(k), (PX.stn[k] || {}).paper === '58' ? 32 : 48); } catch (e) {} return tk; }
/* ================= PRINTER FAILOVER • CASHIER PRINTER • PRINT BILL ================= */
const pxStnAll = () => pxStns().concat([{ key: '_cashier', name: 'Cashier' }]);
const pxStnName = k => k === '_cashier' ? 'Cashier' : ((pxStns().find(x => x.key === k) || {}).name || k);
const pxStnHealth = k => { const h = ((PX.agent || {}).printers || {})[k]; return h && (Date.now() - (h.ms || 0)) < 120000 ? h : null; };
const pxStnUp = k => (k === '_cashier' || pxStns().some(s => s.key === k)) && pxStnReady(k) && !(pxStnHealth(k) && pxStnHealth(k).ok === false);
const pxFb = () => PX.stnFb === undefined ? '_cashier' : PX.stnFb;
function pxWhyDown(k) { const c = (PX.stn || {})[k]; if (!c || !pxIpOk(c.ip)) return 'walang IP'; if (c.enabled === false) return 'naka-off'; const h = pxStnHealth(k); return h && h.ok === false ? (h.why || 'hindi maabot') : ''; }
function pxPickDest(k) { if (pxStnUp(k)) return k; const vis = [k]; let cur = k; for (let i = 0; i < 8; i++) { const nx = ((PX.stn || {})[cur] || {}).backup || pxFb(); if (!nx || vis.includes(nx)) break; vis.push(nx); if (pxStnUp(nx)) return nx; cur = nx; } return ''; }
const pxDestName = k => { const d = pxPickDest(k); return d ? pxStnName(d) : 'browser ng device (walang backup)'; };

/* ---------- Resibo / billing para sa Cashier printer ---------- */
function pxReceiptLines(s, reprint, cols) {
  s = pxPrivSale(s); if (pxFmt().bill.preset === 'octopus') return pxOctoLines(s, reprint, cols);
  const c = PX.cfg || PX_DEF, inf = s.info || pxInfo(), L = [], dash = '-'.repeat(cols), ctr = (t, b) => L.push({ t: String(t), c: true, b: !!b }), ln = t => L.push(String(t));
  const lr = (a, b) => { a = String(a); b = String(b); return a.length + b.length + 1 > cols ? a.slice(0, Math.max(1, cols - b.length - 1)) + ' ' + b : a + ' '.repeat(cols - a.length - b.length) + b; };
  const nonV = inf.vstat === 'NON-VAT' || (c.vat && c.vat.on === false), pcx = s.pc || {}, vp = (c.vat && +c.vat.pct) || 12;
  ctr(inf.legal || s.siteName || '', true); if (inf.trade && inf.trade !== inf.legal) ctr(inf.trade); if (inf.address) ctr(inf.address); if (inf.tin) ctr((inf.vstat === 'NON-VAT' ? 'NON-VAT Reg. TIN: ' : 'VAT Reg. TIN: ') + inf.tin); if (inf.contact) ctr(inf.contact); (c.header || '').split('\n').filter(Boolean).forEach(x => ctr(x));
  ln(dash); ctr(s.stmt ? 'BILLING STATEMENT' : 'ORDER SLIP / BILLING STATEMENT', true); ctr(s.stmt ? '*** HINDI PA BAYAD ***' : '(Hindi opisyal na resibo)'); ln(dash);
  ln('Slip No: ' + s.no + (reprint ? ' (REPRINT)' : '')); ln('Petsa: ' + new Date(s.atMs || Date.now()).toLocaleString('en-PH')); ln('Cashier: ' + (s.cashier || ''));
  if (s.tableName) ln('Table: ' + s.tableName + (s.pax ? ' - ' + s.pax + ' pax' : '') + (s.billCount > 1 ? ' - Bill ' + s.billNo + '/' + s.billCount : '')); if (s.channel && s.channel !== 'dine') ln('Channel: ' + s.chName + (s.platRef ? ' #' + s.platRef : '')); if (s.eventName) ln('Event: ' + s.eventName); ln(dash);
  pxChItems(s.items).forEach(l => { if (l._h) { ln('-- ' + l._h + ' --'); return; } ln(l.name); ln(lr('  ' + (+(+l.qty).toFixed(3)) + ' x ' + pxM(l.price), pxM(l.qty * l.price))); }); ln(dash);
  ln(lr('Subtotal', pxM(s.gross))); if (pcx.sc) ln(lr('Senior 20%', '-' + pxM(pcx.sc))); if (pcx.pwd) ln(lr('PWD 20%', '-' + pxM(pcx.pwd))); if (pcx.disc) ln(lr((s.disc || {}).label || 'Discount', '-' + pxM(pcx.disc))); if (pcx.comp) ln(lr('Complimentary', '-' + pxM(pcx.comp))); if (s.disc && s.disc.type === 'taxex') ln('Tax-Exempt (walang VAT)'); if (s.svc && s.svcShown) ln(lr('Service Charge', pxM(s.svc)));
  L.push({ t: lr('TOTAL', 'P' + pxM(s.total)), b: true }); ln(dash);
  ln(lr('VATable Sales', nonV ? '0.00' : pxM(pcx.vat || 0))); ln(lr('Non-VAT Sales', pxM(pcx.nvat || 0))); ln(lr('VAT-Exempt Sales', pxM(pcx.exm || 0))); ln(lr('Zero-Rated Sales', '0.00')); ln(lr('VAT Amount (' + vp + '%)', nonV ? '0.00' : pxM(s.vatAmt || 0)));
  if ((s.pays || []).length) { ln(dash); s.pays.forEach(p => { ln(lr(pxPayLabel(p).replace(/&amp;/g, '&'), pxM(p.amount))); if (p.ref || p.payer) ln('  ' + [p.ref ? 'Ref: ' + p.ref : '', p.payer || ''].filter(Boolean).join(' - ')); }); if (s.change) ln(lr('Sukli', pxM(s.change))); }
  if (s.disc && ['senior', 'pwd', 'taxex'].includes(s.disc.type)) { ln(dash); ln(s.disc.label || ''); if (s.disc.id) ln('ID: ' + s.disc.id); if (s.disc.name) ln('Pangalan: ' + s.disc.name); }
  if (s.member) { ln(dash); ln('Member: ' + s.member.name); ln('ID: ' + s.member.mid + '  Club: ' + (s.member.club || '')); if (s.member.parentMid || s.member.parentName) ln((s.member.rel || 'Dependent') + ' ni ' + (s.member.parentName || '') + (s.member.parentMid ? ' (' + s.member.parentMid + ')' : '')); }
  ln(dash); if (s.stmt) { ctr('HINDI PA BAYAD', true); ln('Ipakita ang Senior/PWD ID bago magbayad kung may discount.'); } else { ln('Pirma ng Customer:'); ln(''); ln('______________________________'); ln('Kalakip sa Opisyal na Resibo No.: ' + (s.orNo || '__________')); }
  if (c.footer) { ln(dash); String(c.footer).split('\n').forEach(x => ctr(x)); }
  if (c.devName || c.devContact || c.devTag) { ln(dash); if (c.devTag) ctr(c.devTag); ctr('POS System' + (c.devName ? ' by ' + c.devName : '')); if (c.devContact) ctr(c.devContact); }
  return L;
}
async function pxPrintReceipt(s, reprint) { // sa Cashier printer (IP) kung handa; kung hindi, sa browser
  try { const c = (PX.stn || {})._cashier; if (c && c.receipts !== false && pxStnUp('_cashier') && pxAgentOn()) { await pxBatch([{ t: 'set', col: 'pos_print_jobs', id: pxId('PJ'), d: pxJobDoc('_cashier', { type: 'receipt', lines: pxJobLines(pxReceiptLines(s, reprint, c.paper === '58' ? 32 : 48)), at: new Date().toISOString(), reprint: !!reprint, by: String(pxMe().name || pxMe().email || ''), items: [] }) }]); pxToast('🧾 Naipadala sa Cashier printer'); return true; } } catch (e) {}
  if (pxFmt().bill.preset === 'octopus') pxPrint(pxLinesHtml(pxReceiptLines(s, reprint, 48), 48, { print: true })); else pxPrint(pxReceiptHtml(s, reprint)); return false;
}

/* ---------- Print Bill (billing statement bago mag-settle; puwedeng palitan ang discount at i-print muli) ---------- */
function pxCalcDine(lines, D) { const sv = PX.chan; PX.chan = 'dine'; try { return pxCalc(lines, D); } finally { PX.chan = sv; } }
function pxStmtSale(lines, D, o) {
  const C = o.tab ? pxCalcDine(lines, D) : pxCalc(lines, D), inf = pxInfo(), s = pxSite(), t = o.tab || {};
  return { no: o.no, stmt: true, info: { legal: inf.legal || '', trade: inf.trade || s.name || '', address: inf.address || '', tin: inf.tin || '', vstat: inf.vstat || 'VAT', contact: inf.contact || '' }, siteName: s.name || '', atMs: Date.now(), cashier: (PX.shift && PX.shift.cashier) || String(pxMe().name || ''), items: lines.map(l => ({ name: l.name, price: l.price, qty: l.qty, ovr: !!l.ovr })), gross: C.gross, svc: C.svc, svcShown: !!PX.cfg.sc.show, total: C.total, pc: { nvat: C.nvat || 0, vat: C.vatable, exm: C.exempt, sc: C.sc, pwd: C.pwd, disc: C.disc, comp: C.comp, svc: C.svc }, vatAmt: C.vat, disc: { type: D.type, label: C.label, id: D.id || '', name: D.name || '', pct: pxNum(D.pct) }, pays: [], tableName: t.tableName || '', pax: t.pax || 0, billNo: o.billNo || 0, billCount: o.billCount || 0, member: null };
}
const pxNoDisc = () => ({ type: 'none', elig: '', pct: '', id: '', name: '' });
async function pxPrintBill(tabId, billId) { // mula sa Split/Settlement screen
  const t = PX.tabs.find(x => x.id === tabId); if (!t || !PX_SP) return; const b = PX_SP.bills.find(x => x.id === billId); if (!b || !b.lines.length) return; const idx = PX_SP.bills.indexOf(b);
  const sale = pxStmtSale(b.lines, b.disc || pxNoDisc(), { tab: t, no: 'BILL-' + t.tableName + (PX_SP.bills.length > 1 ? '-' + (idx + 1) : ''), billNo: idx + 1, billCount: PX_SP.bills.length });
  await pxPrintReceipt(sale); b.printedMs = Date.now(); b.printCount = (b.printCount || 0) + 1; pxSpRender();
}
async function pxPrintBillAll(tabId) { // mula sa table view (bago pa mag-split)
  const t = PX.tabs.find(x => x.id === tabId); if (!t) return; const lines = pxTabLines(t); if (!lines.length) { pxAlert('Wala pang order na ipi-print.'); return; }
  if ((t.bills || []).filter(b => b.status === 'open' && b.lines.length).length) { PX_SP = { id: tabId, bills: JSON.parse(JSON.stringify(t.bills)) }; for (const b of PX_SP.bills.filter(b => b.status === 'open' && b.lines.length)) await pxPrintBill(tabId, b.id); pxTabView(tabId); return; }
  await pxPrintReceipt(pxStmtSale(lines, pxNoDisc(), { tab: t, no: 'BILL-' + t.tableName })); try { await pxTabMut(tabId, d => { d.billPrintedMs = Date.now(); d.billPrintCount = (d.billPrintCount || 0) + 1; }, { a: 'billprint', i: '' }); } catch (e) {} pxTabView(tabId);
}
const pxBillSig = () => JSON.stringify([PX.cart.map(l => [l.id, l.price, l.qty]), [PX.disc.type, PX.disc.id, PX.disc.pct, PX.disc.elig, PX.disc.amt || '', PX.disc.name || ''], pxChan()]);
let pxNeedBill = () => PX.cfg.printBillFirst !== false && PX.cart.length && PX.billSig !== pxBillSig();
async function pxBillPrintNow() { // bago mag-settle: kasama ang kasalukuyang discount at presyo
  if (!PX.cart.length) return; const c = PX.ctx, bill = c && c.mode === 'bill', t = bill ? (pxCtxTab() || {}) : null;
  const ch = pxChan(), sale = pxStmtSale(PX.cart, PX.disc, bill ? { tab: t, no: 'BILL-' + t.tableName + (c.billCount > 1 ? '-' + c.billNo : ''), billNo: c.billNo, billCount: c.billCount } : { no: 'BILL-' + new Date().toTimeString().slice(0, 5).replace(':', '') });
  if (!bill && ch !== 'dine') { sale.channel = ch; sale.chName = PX_CH[ch].n; sale.platRef = PX_CH[ch].app ? PX.chanRef : ''; }
  await pxPrintReceipt(sale); PX.billSig = pxBillSig();
  if (bill) { try { await pxTabMut(c.tabId, d => { const b = (d.bills || []).find(x => x.id === c.billId); if (b) { b.disc = JSON.parse(JSON.stringify(PX.disc)); b.printedMs = Date.now(); b.printCount = (b.printCount || 0) + 1; } }); } catch (e) {} }
  pxToast('🖨️ Na-print ang bill — pindutin ang 💳 Magbayad kapag aprubado na'); pxBody();
}

/* ---------- Babala sa screen + pag-print sa browser kung walang makapag-print ---------- */
function pxJobsHtml(list) {
  const w = (PX.cfg && PX.cfg.paper === '58') ? '54mm' : '76mm';
  return `<html><head><meta charset="utf-8"><style>@page{margin:2mm}body{font-family:monospace;font-size:13px;width:${w};margin:0 auto}hr{border:0;border-top:1px dashed #000}.pg{page-break-after:always}pre{font-family:monospace;font-size:12px;margin:0;white-space:pre-wrap}</style></head><body>${list.map(j => { const t = j.ticket || {};
    if (t.type === 'receipt') return `<div class="pg"><pre>${(t.lines || []).map(l => pxE(typeof l === 'string' ? l : l.t)).join('\n')}</pre></div>`;
    return `<div class="pg"><div style="text-align:center"><b style="font-size:18px;">${pxE(j.stationName || 'KITCHEN')}</b>${t.reprint ? '<br><b>*** REPRINT ***</b>' : ''}${t.chan && t.type === 'counter' ? '<br><b style="font-size:16px;">' + pxE(String(t.chan).toUpperCase()) + '</b>' : ''}${(t.reroute || []).length ? '<br><b>&gt;&gt;&gt; NILIPAT DITO &lt;&lt;&lt;</b>' + t.reroute.map(r => '<br><small>galing: ' + pxE(r) + '</small>').join('') : ''}</div><hr>${t.table ? '<b style="font-size:18px;">TABLE ' + pxE(t.table) + '</b><br>' : ''}${pxE([t.zone, t.pax ? t.pax + ' pax' : '', t.orderNo ? 'Order #' + t.orderNo : '', t.type === 'counter' && t.ref ? 'Counter ' + t.ref : ''].filter(Boolean).join(' | '))}<br>${pxE(new Date(t.at || Date.now()).toLocaleString('en-PH'))}<hr>${(t.items || []).map(i => `<div style="font-size:15px;"><b>${i.qty} x</b> ${pxE(i.name)}${i.note ? '<br>&nbsp;&nbsp;<i>** ' + pxE(i.note) + '</i>' : ''}${(i.also || []).length ? '<br>&nbsp;&nbsp;<small>+ kasama sa: ' + pxE(i.also.join(', ')) + '</small>' : ''}</div>`).join('')}<hr></div>`; }).join('')}</body></html>`;
}
async function pxJobBrowser(id) { try { const r = db.collection('pos_print_jobs').doc(id), d = (await r.get()).data(); if (!d) return; pxPrint(pxJobsHtml([d])); await r.update({ status: 'printed', via: 'browser', ack: true, printedAt: new Date().toISOString() }); pxQueueView(); pxPrnPoll(true); } catch (e) { pxAlert('Error: ' + e.message); } }
async function pxJobAck(id) { try { await db.collection('pos_print_jobs').doc(id).update({ ack: true }); pxQueueView(); pxPrnPoll(true); } catch (e) { pxAlert('Error: ' + e.message); } }
async function pxPendBrowser() { try { const s = await db.collection('pos_print_jobs').where('site', '==', PX.site).where('status', '==', 'pending').get(), L = []; s.forEach(d => L.push(Object.assign({ id: d.id }, d.data()))); if (!L.length) { pxPrnPoll(true); return; } L.sort((a, b) => (a.createdMs || 0) - (b.createdMs || 0)); pxPrint(pxJobsHtml(L)); await pxBatch(L.map(j => ({ t: 'set', col: 'pos_print_jobs', id: j.id, merge: true, d: { status: 'printed', via: 'browser', printedAt: new Date().toISOString() } }))); pxToast('🖨️ Na-print sa browser: ' + L.length); pxPrnPoll(true); } catch (e) { pxAlert('Error: ' + e.message); } }
function pxPrnBanner() {
  if (!PX.stn || !pxStnAll().some(x => pxStnReady(x.key))) return ''; const on = pxAgentOn(), m = [], P = (PX.agent || {}).printers || {};
  if (!on) m.push('🔴 <b>Offline ang Print Agent</b> — ang mga ticket at resibo ay ipi-print sa <b>printer ng device na ito (browser)</b> hangga\'t hindi bumabalik ang agent.');
  else pxStnAll().filter(x => pxStnReady(x.key) && pxStnHealth(x.key) && P[x.key].ok === false).forEach(x => m.push('🟠 <b>' + pxE(x.name) + '</b> — ' + pxE(P[x.key].why || 'hindi maabot') + ' → ililipat sa <b>' + pxE(pxDestName(x.key)) + '</b>'));
  const f = (PX.prn || {}).failed, p = (PX.prn || {}).pending; if (f) m.push('❌ <b>' + f + ' ticket ang hindi na-print</b> <button class="btn btn-secondary btn-sm" onclick="pxQueueView()">📋 Buksan ang queue</button>'); if (p && !on) m.push('⏳ ' + p + ' ticket ang nakabinbin <button class="btn btn-secondary btn-sm" onclick="pxPendBrowser()">🖨️ I-print sa browser</button>');
  return m.length ? '<div style="background:#fff7ed;border:1px solid #fdba74;border-radius:.4rem;padding:.35rem .6rem;margin-bottom:.5rem;font-size:.84rem;">' + m.join('<br>') + '</div>' : '';
}
async function pxPrnPoll(force) {
  if (!document.getElementById('pos-root') || !PX.site || !PX.ready) return; if (!force && Date.now() - (PX._pp || 0) < 8000) return; PX._pp = Date.now();
  try { const ad = await db.collection('pos_print_agents').doc(PX.site).get(); PX.agent = ad.exists ? ad.data() : null; const any = pxStnAll().some(x => pxStnReady(x.key)); let f = 0, p = 0;
    if (any) { const since = Date.now() - 36e5; (await db.collection('pos_print_jobs').where('site', '==', PX.site).where('status', '==', 'failed').get()).forEach(d => { const x = d.data(); if (!x.ack && (x.createdMs || 0) > since) f++; }); (await db.collection('pos_print_jobs').where('site', '==', PX.site).where('status', '==', 'pending').get()).forEach(d => { if (Date.now() - ((d.data() || {}).createdMs || 0) > 30000) p++; }); } PX.prn = { failed: f, pending: p }; } catch (e) {}
  const el = document.getElementById('px-prn-banner'); if (el) el.innerHTML = pxPrnBanner();
}
function pxPrnStart() { if (!PX._pt2) PX._pt2 = setInterval(() => pxPrnPoll(), 20000); setTimeout(pxPrnPoll, 400); }
/* ================= FORMAT NG PRINTOUT (kitchen ticket + bill) + PRIVACY + LOGO =================
   Bawat branch ay may sariling format (naka-save sa pos_stations/{site}.fmt). Kitchen ticket at bill ay nabubuo bilang "lines"
   ({t, c:center, b:bold, w:lapad 1-3, h:taas 1-3} o {img}) na ipinapadala sa Print Agent o sa browser; pareho ang hitsura ng preview. */
const PX_SZ = { 1: { w: 1, h: 1, n: 'Maliit' }, 2: { w: 1, h: 2, n: 'Matangkad' }, 3: { w: 2, h: 2, n: 'Malaki' }, 4: { w: 3, h: 3, n: 'XL' } };
const PX_KPRE = {
  std: { layout: 'std', showStation: true, copyTag: false, showTable: true, showGuests: true, showFloor: true, showOrder: true, showTimeDue: false, showPrinted: true, showSlip: false, showPosId: false, showStaff: true, showSalesType: false, showNew: false },
  tokiya: { layout: 'rows', showStation: true, copyTag: true, showTable: true, showGuests: false, showFloor: false, showOrder: false, showTimeDue: true, showPrinted: true, showSlip: true, showPosId: true, showStaff: true, showSalesType: true, showNew: false },
  tanoshi: { layout: 'list', showStation: true, copyTag: false, showTable: true, showGuests: true, showFloor: true, showOrder: true, showTimeDue: false, showPrinted: false, showSlip: false, showPosId: false, showStaff: true, showSalesType: false, showNew: true }
};
const PX_FMT_DEF = {
  kitchen: Object.assign({ preset: 'std', brand: '', posId: '', sz: { head: 3, table: 3, meta: 2, item: 3, note: 2 } }, PX_KPRE.std),
  bill: { preset: 'std', showCustomer: true, showIssuedBy: true, logoTopOn: false, logoTop: null, logoBottomOn: false, logoBottom: null, logoW: 288, poweredBy: '', notOfficial: '' },
  priv: { bill: { customer: 'show', ids: 'show', member: 'show' }, receipt: { customer: 'show', ids: 'show', member: 'show' } }
};
function pxFmt() {
  const f = PX.fmt || {}, D = PX_FMT_DEF, fk = f.kitchen || {}, fp = f.priv || {};
  const k = Object.assign({}, D.kitchen, fk); k.sz = Object.assign({}, D.kitchen.sz, fk.sz || {});
  return { kitchen: k, bill: Object.assign({}, D.bill, f.bill || {}), priv: { bill: Object.assign({}, D.priv.bill, fp.bill || {}), receipt: Object.assign({}, D.priv.receipt, fp.receipt || {}) } };
}
const pxFmtW = () => (PX.fmt = pxFmt()); // kopya na puwedeng baguhin
const pxPad = (a, b, w) => { a = String(a); b = String(b); if (a.length + b.length + 1 > w) a = a.slice(0, Math.max(1, w - b.length - 1)); return a + ' '.repeat(Math.max(1, w - a.length - b.length)) + b; };
function pxWrapLn(s, w) { s = String(s); if (s.length <= w) return [s]; const out = []; s.split('\n').forEach(line => { let cur = ''; line.split(/\s+/).forEach(word => { while (word.length > w) { if (cur) { out.push(cur); cur = ''; } out.push(word.slice(0, w)); word = word.slice(w); } if (!cur) cur = word; else if ((cur + ' ' + word).length <= w) cur += ' ' + word; else { out.push(cur); cur = word; } }); out.push(cur); }); return out; }
const pxJobLines = L => L.map(l => { if (!l.src) return l; const c = Object.assign({}, l); delete c.src; return c; });

/* ---------- Kitchen ticket ---------- */
function pxKitchenLines(t, stName, cols, K) {
  K = K || pxFmt().kitchen; const L = [], Z = n => PX_SZ[n] || PX_SZ[1], sz = K.sz || {}, hz = n => ({ w: Z(n).w, h: Z(n).h }), W = n => Math.floor(cols / Z(n).w);
  const add = (tx, o) => L.push(Object.assign({ t: String(tx) }, o || {})), dash = () => add('-'.repeat(cols));
  const row = (a, b, n, bold) => add(pxPad(a, b, W(n)), Object.assign(hz(n), { b: !!bold }));
  const when = t.at ? new Date(t.at) : new Date(), now = new Date();
  const hm = d => d.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' }), dt = d => d.toLocaleDateString('en-PH') + ' ' + hm(d);
  const sales = String(t.chan || 'Dine-in').toUpperCase().replace(/[^A-Z]/g, ''), slip = String(t.orderNo || t.ref || '').padStart(8, '0');
  const lay = K.layout || 'std';
  if (t.reprint) add('*** REPRINT ***', { c: true, b: true });
  if (t.reroute && t.reroute.length) { add('>>> NILIPAT DITO <<<', { c: true, b: true }); t.reroute.forEach(r => pxWrapLn('galing: ' + r, cols).forEach(x => add(x))); }
  if (K.brand) add(K.brand, Object.assign({ c: true }, hz(sz.meta || 1)));
  if (K.showStation !== false) pxWrapLn((lay === 'list' ? '->' : '') + stName + (K.copyTag ? ' (Copy)' : ''), W(sz.head || 3)).forEach(x => add(x, Object.assign({ c: true, b: true }, hz(sz.head || 3))));
  if (t.type === 'test') add('TEST PRINT', { c: true, b: true });
  dash();
  const itemsRows = () => (t.items || []).forEach(it => {
    const n = sz.item || 3, q = String(+(+it.qty).toFixed(3));
    if (lay === 'rows') { const w = pxWrapLn(it.name, W(n) - q.length - 1); row(w[0], q, n, true); w.slice(1).forEach(x => add(x, Object.assign({ b: true }, hz(n)))); }
    else if (lay === 'list') { const w = pxWrapLn(it.name, W(n) - 4); add(q.padEnd(4) + w[0], Object.assign({ b: true }, hz(n))); w.slice(1).forEach(x => add('    ' + x, Object.assign({ b: true }, hz(n)))); }
    else { pxWrapLn(q + ' x ' + it.name, W(n)).forEach(x => add(x, Object.assign({ b: true }, hz(n)))); }
    if (it.also && it.also.length) pxWrapLn('   + kasama sa: ' + it.also.join(', '), cols).forEach(x => add(x));
    if (it.note) pxWrapLn('   ** ' + it.note, W(sz.note || 2)).forEach(x => add(x, Object.assign({ b: true }, hz(sz.note || 2))));
  });
  if (lay === 'rows') {
    if (K.showTable !== false && t.table) row('For the Table', t.table, sz.table || 3, true);
    if (K.showTimeDue) row('Time Due', dt(when), sz.meta || 1);
    if (K.showPrinted) row('Date Time Printed', dt(now), sz.meta || 1);
    if (K.showSlip && /[1-9]/.test(slip)) row('Slip:', slip, sz.meta || 1);
    if (K.showPosId && K.posId) row('POS ID', K.posId, sz.meta || 1);
    if (K.showStaff && t.by) row('Staff:', t.by, sz.meta || 1, true);
    if (K.showSalesType) row('Sales Type', sales, sz.meta || 1);
    dash(); row('ITEM DESC', 'Qty', 1); dash(); itemsRows();
  } else if (lay === 'list') {
    const m = sz.meta || 1;
    if (K.showTable !== false && t.table) pxWrapLn('Table: ' + t.table + (K.showGuests && t.pax ? '   Number of Guests: ' + t.pax : ''), W(m)).forEach(x => add(x, hz(m)));
    if (K.showFloor && t.zone) add('Floor: ' + t.zone, hz(m)); if (K.showOrder && t.orderNo) add('Order ' + slip, hz(m));
    if (K.showSalesType) add('Sales Type: ' + sales, hz(m)); if (K.showPosId && K.posId) add('POS ID: ' + K.posId, hz(m));
    if (K.showStaff && t.by || K.showTimeDue || K.showPrinted) add([K.showStaff ? t.by : '', K.showPrinted || K.showTimeDue ? dt(when) : ''].filter(Boolean).join('  '), hz(m));
    dash(); if (K.showNew) { add('NEW', Object.assign({ b: true }, hz(4))); add(hm(when), hz(m)); } itemsRows();
  } else {
    if (t.chan && t.type === 'counter') add(String(t.chan).toUpperCase(), Object.assign({ b: true }, hz(sz.table || 3)));
    if (K.showTable !== false && t.table) pxWrapLn('TABLE ' + t.table, W(sz.table || 3)).forEach(x => add(x, Object.assign({ b: true }, hz(sz.table || 3))));
    const m = sz.meta || 1, meta = [K.showFloor ? t.zone : '', K.showGuests && t.pax ? t.pax + ' pax' : '', K.showOrder && t.orderNo ? 'Order #' + t.orderNo : '', t.type === 'counter' && t.ref ? 'Counter ' + t.ref : '', K.showSalesType ? sales : ''].filter(Boolean).join('  |  ');
    if (meta) pxWrapLn(meta, W(m)).forEach(x => add(x, hz(m)));
    if (K.showPrinted || K.showStaff && t.by) pxWrapLn([K.showPrinted ? dt(when) : '', K.showStaff ? t.by || '' : ''].filter(Boolean).join('  '), W(m)).forEach(x => add(x, hz(m)));
    dash(); itemsRows();
  }
  dash(); if (t.type === 'test') add('Gumagana ang printer', { c: true }); else { let sn = ''; try { sn = pxSite().name || ''; } catch (e) {} if (sn) add(sn, { c: true }); }
  return L;
}
/* Browser fallback / preview ng "lines" */
function pxLinesHtml(L, cols, o) {
  o = o || {}; const cw = 7.2, esc = x => String(x).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const body = L.map(l => {
    if (typeof l === 'string') l = { t: l };
    if (l.img) return `<div style="text-align:center;margin:3px 0;">${l.src ? `<img src="${l.src}" style="width:${l.img.w * cw / 8 * 1.0}px;max-width:100%;image-rendering:pixelated;">` : ''}</div>`;
    const w = l.big ? 2 : l.w || 1, h = l.big ? 2 : l.h || 1, c = !!l.c;
    return pxWrapLn(l.t === '' ? ' ' : l.t, Math.floor(cols / w)).map(x => `<div style="width:${cols * cw}px;height:${14.4 * h}px;"><div style="font:${l.b ? 'bold ' : ''}${12 * h}px/${14.4 * h}px monospace;width:${cols * cw * h / w}px;transform:scaleX(${w / h});transform-origin:0 0;white-space:pre;text-align:${c ? 'center' : 'left'};">${esc(x === ' ' ? '' : x)}</div></div>`).join('');
  }).join('');
  if (o.print) return `<html><head><meta charset="utf-8"><style>@page{margin:2mm}body{margin:0;color:#000}</style></head><body><div style="width:${cols * cw}px;margin:0 auto;">${body}</div></body></html>`;
  return `<div style="display:inline-block;background:#fff;color:#000;padding:8px 10px;box-shadow:0 1px 6px #0003;"><div style="width:${cols * cw}px;">${body}</div></div>`;
}

/* ---------- Privacy sa printout ---------- */
// Ang naka-hide na membership info: pangalan = unang at huling letra ng bawat salita (J**n D**a C**z); code = bawat ika-4 na karakter ang nakikita.
// Ito ang pang-validate ng accounting ng club sa pirma sa billing, habang hindi nakokopya ang buong pangalan/code.
function pxMaskName(v) { return String(v || '').split(/\s+/).filter(Boolean).map(w => { const ch = [...w]; return ch.length <= 2 ? ch[0] + '*' : ch[0] + '*'.repeat(ch.length - 2) + ch[ch.length - 1]; }).join(' '); }
function pxMaskCode(v) { return [...String(v || '')].map((c, i) => (i % 4 === 0 || !/[A-Za-z0-9]/.test(c)) ? c : '*').join(''); }
function pxMaskMem(s) {
  if (!(PX.cfg && PX.cfg.maskMem) || !s || !s.member) return s; const c = JSON.parse(JSON.stringify(s)), m = c.member;
  m.name = pxMaskName(m.name); m.mid = pxMaskCode(m.mid); if (m.parentMid || m.parentName) { m.parentName = pxMaskName(m.parentName); m.parentMid = pxMaskCode(m.parentMid); } m.maskedMem = true;
  (c.pays || []).forEach(p => { if (p.mode === 'member') { if (p.payer) p.payer = pxMaskName(p.payer); if (p.ref) p.ref = pxMaskCode(p.ref); } });
  return c;
}
function pxPrivSale(s) {
  s = pxMaskMem(s);
  const P = pxFmt().priv[s.stmt ? 'bill' : 'receipt']; if (P.customer === 'show' && P.ids === 'show' && P.member === 'show') return s;
  const c = JSON.parse(JSON.stringify(s)), mk = (v, m) => m === 'hide' ? '' : m === 'initials' ? String(v || '').split(/\s+/).filter(Boolean).map(x => x[0].toUpperCase() + '.').join(' ') : m === 'last4' ? (String(v || '').length > 4 ? '****' + String(v).slice(-4) : String(v || '')) : String(v || '');
  if (c.disc) { c.disc.name = mk(c.disc.name, P.customer); c.disc.id = mk(c.disc.id, P.ids); }
  if (c.member) { if (P.member === 'hide') c.member = null; else { c.member.name = mk(c.member.name, P.customer); c.member.mid = mk(c.member.mid, P.ids); if (c.member.parentMid) { c.member.parentName = mk(c.member.parentName, P.customer); c.member.parentMid = mk(c.member.parentMid, P.ids); } } }
  (c.pays || []).forEach(p => { if (p.payer) p.payer = mk(p.payer, P.customer); });
  return c;
}

/* ---------- Bill na kamukha ng Octopos ---------- */
function pxOctoLines(s, reprint, cols) {
  const c = PX.cfg || PX_DEF, B = pxFmt().bill, inf = s.info || pxInfo(), L = [], pcx = s.pc || {}, dash = '-'.repeat(cols), vp = (c.vat && +c.vat.pct) || 12;
  const nonV = inf.vstat === 'NON-VAT' || (c.vat && c.vat.on === false), ctr = (t, o) => L.push(Object.assign({ t: String(t), c: true }, o || {})), ln = t => L.push({ t: String(t) });
  const lr = (a, b, o) => L.push(Object.assign({ t: pxPad(a, b, cols) }, o || {})), m = x => pxM(x);
  if (B.logoTopOn && B.logoTop) L.push({ img: { w: B.logoTop.w, h: B.logoTop.h, b64: B.logoTop.b64 }, src: B.logoTop.src, c: true });
  ctr(inf.legal || s.siteName || '', { b: true }); if (inf.trade && inf.trade !== inf.legal) ctr(inf.trade); if (inf.address) pxWrapLn(inf.address, cols).forEach(x => ctr(x)); if (inf.contact) ctr(inf.contact); if (inf.tin) ctr((inf.vstat === 'NON-VAT' ? 'NON-VAT Reg. TIN: ' : 'VAT Reg. TIN: ') + inf.tin);
  (c.header || '').split('\n').filter(Boolean).forEach(x => ctr(x)); ln(dash);
  ctr(s.stmt ? 'BILL' : 'ORDER SLIP' + (reprint ? ' (REPRINT)' : '')); ctr('Date:' + new Date(s.atMs || Date.now()).toLocaleString('en-PH'));
  if (s.tableName) ctr('Table:' + s.tableName, { w: 2, h: 2 }); else if (s.channel && s.channel !== 'dine') ctr(s.chName + (s.platRef ? ' #' + s.platRef : ''), { w: 2, h: 2 });
  const cust = (s.member && s.member.name) || (s.disc && s.disc.name) || ''; if (B.showCustomer && cust) ctr('Customer:' + cust); if (B.showIssuedBy) ctr('Issued By:' + (s.cashier || '')); ln('');
  const qw = 3, aw = 10, uw = 10, nw = Math.max(8, cols - qw - aw - uw - 3); 
  L.push({ t: ('Qty Item').padEnd(qw + 1 + nw) + 'Unit Price'.padStart(uw) + ' ' + 'Amount'.padStart(aw - 1) }); ln('');
  pxChItems(s.items).forEach(l => { if (l._h) { L.push({ t: '-- ' + l._h + ' --', b: true }); return; } const q = String(+(+l.qty).toFixed(3)), nm = pxWrapLn(l.name, nw); L.push({ t: q.padStart(qw) + ' ' + nm[0].padEnd(nw) + m(l.price).padStart(uw) + ' ' + m(l.qty * l.price).padStart(aw - 1) }); nm.slice(1).forEach(x => ln(' '.repeat(qw + 1) + x)); }); ln('');
  const sc = pcx.sc || 0, pw = pcx.pwd || 0, dc = pcx.disc || 0, cp = pcx.comp || 0, svc = pcx.svc || 0, due = pxR2((s.total || 0) - svc), ded = Math.max(0, pxR2((s.gross || 0) - sc - pw - dc - cp - due)), full = pxR2(nonV ? 0 : (s.vatAmt || 0) + ded);
  const ind = t => '  ' + t; lr(ind('Sub Total with VAT'), m(s.gross)); if (ded > 0) lr(ind('VAT Deduction'), '-' + m(ded)); lr(ind('Price Exclude VAT'), m(pxR2((s.gross || 0) - full)));
  if (sc) lr(ind('Less: Senior Discount'), '-' + m(sc)); if (pw) lr(ind('Less: PWD Discount'), '-' + m(pw)); if (dc) lr(ind('Less: ' + ((s.disc || {}).label || 'Discount')), '-' + m(dc)); if (cp) lr(ind('Complimentary'), '-' + m(cp));
  if (svc && s.svcShown) lr(ind('Service Charge'), m(svc)); lr(ind('Amount Due'), m(s.total), { b: true }); ln(dash);
  lr(ind('VATable Sales'), nonV ? '0.00' : m(pcx.vat || 0)); lr(ind('Non-VAT Sales'), m(pcx.nvat || 0)); lr(ind('VAT Amount'), nonV ? '0.00' : m(s.vatAmt || 0)); lr(ind('VAT Exempt Sales'), m(pcx.exm || 0)); lr(ind('Zero-Rated Sales'), '0.00'); ln(dash);
  if ((s.pays || []).length) { s.pays.forEach(p => { lr(pxPayLabel(p).replace(/&amp;/g, '&'), m(p.amount)); if (p.ref || p.payer) ln('  ' + [p.ref ? 'Ref: ' + p.ref : '', p.payer || ''].filter(Boolean).join(' - ')); }); if (s.change) lr('Sukli', m(s.change)); ln(dash); }
  if (s.disc && ['senior', 'pwd', 'taxex'].includes(s.disc.type)) { pxWrapLn('PWD/OSCA/SC/Diplomat ID : ' + [s.disc.name, s.disc.id].filter(Boolean).join(': ') + (s.disc.label ? ' (' + s.disc.label + ')' : ''), cols).forEach(x => ln(x)); ln(''); }
  if (s.member) { ln('Member: ' + s.member.name + (s.member.mid ? '  ID: ' + s.member.mid : '')); if (s.member.parentMid || s.member.parentName) ln('  ' + (s.member.rel || 'Dependent') + ' ni ' + (s.member.parentName || '') + (s.member.parentMid ? ' (' + s.member.parentMid + ')' : '') + ' - singil sa principal'); }
  ln(''); ln('Signature ' + '_'.repeat(Math.max(8, cols - 10))); ln(dash);
  pxWrapLn(B.notOfficial || (s.stmt ? '**Special Purpose Machine Not an Official Receipt **' : 'Kalakip sa Opisyal na Resibo No.: ' + (s.orNo || '__________') + ' (Hindi opisyal na resibo)'), cols).forEach(x => ln(x));
  if (c.footer) { ln(dash); String(c.footer).split('\n').forEach(x => ctr(x)); }
  if (B.logoBottomOn && B.logoBottom) { ln(''); L.push({ img: { w: B.logoBottom.w, h: B.logoBottom.h, b64: B.logoBottom.b64 }, src: B.logoBottom.src, c: true }); }
  const pw2 = B.poweredBy || (c.devName ? 'Powered By ' + c.devName : ''); if (pw2 || c.devContact) { ln(dash); if (pw2) ctr(pw2); if (c.devContact) ctr(c.devContact); }
  return L;
}

/* ---------- Logo → 1-bit bitmap (para sa thermal printer) ---------- */
function pxLogoBuild(orig, wd) {
  return new Promise(res => { const im = new Image(); im.onload = () => {
    try { const w = Math.max(8, Math.floor(wd / 8) * 8), h = Math.max(1, Math.min(220, Math.round(im.height * w / im.width))), cv = document.createElement('canvas'); cv.width = w; cv.height = h; const g = cv.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, w, h); g.drawImage(im, 0, 0, w, h);
      const d = g.getImageData(0, 0, w, h).data, bpr = w / 8, bytes = new Uint8Array(bpr * h); for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = (y * w + x) * 4, lum = d[i] * .3 + d[i + 1] * .59 + d[i + 2] * .11, blk = lum < 160; if (blk) bytes[y * bpr + (x >> 3)] |= 0x80 >> (x & 7); const v = blk ? 0 : 255; d[i] = d[i + 1] = d[i + 2] = v; d[i + 3] = 255; }
      g.putImageData(new ImageData(d, w, h), 0, 0); let bin = ''; for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
      res({ orig, w, h, b64: btoa(bin), src: cv.toDataURL('image/png') }); } catch (e) { res(null); } }; im.onerror = () => res(null); im.src = orig; });
}
function pxLogoPick(slot, inp) {
  const f = inp.files && inp.files[0]; if (!f) return; if (!/^image\//.test(f.type)) { pxAlert('Imahe lang (PNG/JPG).'); return; }
  const r = new FileReader(); r.onload = () => { const im = new Image(); im.onload = async () => { const mw = 384, k = Math.min(1, mw / im.width), cv = document.createElement('canvas'); cv.width = Math.round(im.width * k); cv.height = Math.round(im.height * k); const g = cv.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, cv.width, cv.height); g.drawImage(im, 0, 0, cv.width, cv.height);
    const orig = cv.toDataURL('image/jpeg', .75), F = pxFmtW(), b = await pxLogoBuild(orig, F.bill.logoW || 288); if (!b) { pxAlert('Hindi mabasa ang imahe.'); return; } F.bill[slot] = b; F.bill[slot + 'On'] = true; PX._stnDirty = true; pxBody(); }; im.src = r.result; }; r.readAsDataURL(f);
}
async function pxLogoSize(wd) { const F = pxFmtW(); F.bill.logoW = wd; for (const s of ['logoTop', 'logoBottom']) if (F.bill[s] && F.bill[s].orig) { const b = await pxLogoBuild(F.bill[s].orig, wd); if (b) F.bill[s] = b; } PX._stnDirty = true; pxBody(); }
function pxLogoDel(slot) { const F = pxFmtW(); F.bill[slot] = null; F.bill[slot + 'On'] = false; PX._stnDirty = true; pxBody(); }

/* ---------- Settings UI ---------- */
function pxFmtK(f, v) { pxFmtW().kitchen[f] = v; PX._stnDirty = true; pxBody(); }
function pxFmtSz(f, n) { pxFmtW().kitchen.sz[f] = n; PX._stnDirty = true; pxBody(); }
function pxFmtPre(p) { const F = pxFmtW(); Object.assign(F.kitchen, PX_KPRE[p], { preset: p }); PX._stnDirty = true; pxBody(); }
function pxFmtB(f, v) { pxFmtW().bill[f] = v; PX._stnDirty = true; pxBody(); }
function pxFmtP(d, f, v) { pxFmtW().priv[d][f] = v; PX._stnDirty = true; pxBody(); }
function pxFmtPaper(p) { PX._fp = p; pxBody(); }
async function pxFmtSave() { try { await db.collection('pos_stations').doc(PX.site).set({ company: pxCo(), site: PX.site, fmt: pxFmtW(), fmtBy: String(pxMe().email || ''), fmtAt: new Date().toISOString() }, { merge: true }); pxToast('✅ Na-save ang format ng printout'); } catch (e) { pxAlert('Error: ' + e.message); } }
const PX_SAMPLE_TK = () => ({ type: 'table', table: 'M14', zone: 'Tanoshi', pax: 2, orderNo: 18, at: new Date().toISOString(), by: 'Juan Dela Cruz', chan: 'Dine-in', items: [{ qty: 2, name: 'Tuna Sushi', note: 'walang wasabi' }, { qty: 1, name: 'Kani Salad', also: ['Cold Kitchen'] }, { qty: 3, name: 'Wakame Salad' }, { qty: 1, name: 'Shime Saba Salad' }] });
const PX_SAMPLE_BILL = () => ({ no: 'BILL-M10', stmt: true, info: { legal: 'Tanoshi Food Corp.', trade: '', address: 'Alabang Country Club, Acacia Ave., Muntinlupa City', tin: '000-000-000-00000', vstat: 'VAT', contact: 'TEL: 010-565-380' }, siteName: 'Tanoshi', atMs: Date.now(), cashier: 'admin', tableName: 'M10', pax: 2, items: [{ name: 'Yasai Itame', qty: 1, price: 340 }, { name: 'Mixed Sushi', qty: 1, price: 1050 }, { name: '5-Kinds Sashimi', qty: 1, price: 700 }, { name: 'Chawan Mushi', qty: 1, price: 180 }], gross: 2270, pc: { vat: 1013.39, exm: 1013.39, nvat: 0, sc: 0, pwd: 202.68, disc: 0, comp: 0, svc: 0 }, vatAmt: 121.61, total: 1945.71, disc: { type: 'pwd', label: 'PWD 20%', id: '30129', name: 'MRS. SOTELO' }, member: { name: 'Daisy Sotelo', mid: 'M-0012', club: '' }, pays: [] });
function pxFmtCard() {
  if (!pxAdmin() && !pxMgr()) return ''; const F = pxFmt(), K = F.kitchen, B = F.bill, fp = PX._fp || '80', cols = fp === '58' ? 32 : 48;
  const tog = (k, lb) => `<label style="display:inline-flex;align-items:center;gap:.25rem;margin:.1rem .7rem .1rem 0;font-size:.82rem;"><input type="checkbox" ${K[k] ? 'checked' : ''} onchange="pxFmtK('${k}',this.checked)">${lb}</label>`;
  const btog = (k, lb) => `<label style="display:inline-flex;align-items:center;gap:.25rem;margin:.1rem .7rem .1rem 0;font-size:.82rem;"><input type="checkbox" ${B[k] ? 'checked' : ''} onchange="pxFmtB('${k}',this.checked)">${lb}</label>`;
  const szs = (f, lb) => `<div>${pxLbl(lb)}<div style="display:flex;gap:.15rem;">${[1, 2, 3, 4].map(n => `<button class="btn ${K.sz[f] === n ? 'btn-primary' : 'btn-secondary'} btn-sm" onclick="pxFmtSz('${f}',${n})">${PX_SZ[n].n}</button>`).join('')}</div></div>`;
  const pre = (id, lb) => `<button class="btn ${K.preset === id ? 'btn-primary' : 'btn-secondary'} btn-sm" onclick="pxFmtPre('${id}')">${lb}</button>`;
  const sel = (d, f, opts) => `<select onchange="pxFmtP('${d}','${f}',this.value)">${opts.map(o => `<option value="${o[0]}" ${F.priv[d][f] === o[0] ? 'selected' : ''}>${o[1]}</option>`).join('')}</select>`;
  const tk = PX_SAMPLE_TK(), kl = pxKitchenLines(tk, 'Sushi Bar', cols, K), bl = (B.preset === 'octopus' ? pxOctoLines : pxReceiptLines)(pxPrivSale(PX_SAMPLE_BILL()), false, cols);
  const logo = (slot, lb) => `<div style="border:1px dashed #cbd5e1;border-radius:.4rem;padding:.3rem;"><label style="font-size:.82rem;"><input type="checkbox" ${B[slot + 'On'] ? 'checked' : ''} ${B[slot] ? '' : 'disabled'} onchange="pxFmtB('${slot}On',this.checked)"> <b>${lb}</b></label><div style="margin:.2rem 0;">${B[slot] ? `<img src="${B[slot].src}" style="max-width:150px;border:1px solid #e2e8f0;background:#fff;"><br><button class="btn btn-secondary btn-sm" onclick="pxLogoDel('${slot}')">🗑️ Alisin</button>` : '<small style="color:#94a3b8;">Wala pang logo</small>'}</div><input type="file" accept="image/*" onchange="pxLogoPick('${slot}',this)"></div>`;
  return `<div style="border:1px solid #e2e8f0;border-radius:.5rem;padding:.5rem;margin-top:.6rem;"><b>🎨 Format ng ticket at bill (per branch)</b>${pxHint('📖 Magkakaiba ang POS ng bawat branch (Tokiya, Tanoshi, Kenji…), kaya dito mo iaayos ang hitsura ng <b>kitchen ticket</b> at <b>bill</b> ng branch na ito. Piliin ang <b>preset</b> na pinakamalapit, tapos i-on/off ang mga detalye at <b>palakihin ang font</b>. Ang <b>Preview</b> ay kamukha ng lalabas sa printer. Pindutin ang <b>💾 I-save ang format</b> kapag ok na. <br>⚠️ Ang laki ng font ay gumagana sa ESC/POS (Epson/Star/atbp.): Maliit=normal, Matangkad=2× taas, Malaki=2×2, XL=3×3. Kung masyadong malaki, mas kaunti ang letra kada linya (kusang magwa-wrap ang pangalan).')}
  <div style="margin-bottom:.4rem;">${pxLbl('Papel ng preview')}<div style="display:flex;gap:.2rem;"><button class="btn ${fp === '80' ? 'btn-primary' : 'btn-secondary'} btn-sm" onclick="pxFmtPaper('80')">80mm (48 col)</button><button class="btn ${fp === '58' ? 'btn-primary' : 'btn-secondary'} btn-sm" onclick="pxFmtPaper('58')">58mm (32 col)</button></div></div>
  <div style="display:flex;gap:1rem;flex-wrap:wrap;align-items:flex-start;"><div style="flex:1;min-width:300px;"><b>🍳 Kitchen ticket</b><div style="display:flex;gap:.3rem;flex-wrap:wrap;margin:.3rem 0;">${pre('std', 'Standard')}${pre('tokiya', 'Tokiya-style')}${pre('tanoshi', 'Tanoshi-style')}</div>
    <div style="display:flex;gap:.5rem;flex-wrap:wrap;">${szs('head', 'Pangalan ng station')}${szs('table', 'Table')}${szs('item', 'Mga item (pinakamahalaga)')}${szs('note', 'Note ng item')}${szs('meta', 'Ibang detalye')}</div>
    <div style="margin-top:.3rem;">${tog('showStation', 'Pangalan ng station')}${tog('copyTag', '"(Copy)"')}${tog('showTable', 'Table')}${tog('showGuests', 'Bilang ng guest')}${tog('showFloor', 'Floor/Zone')}${tog('showOrder', 'Order no.')}${tog('showTimeDue', 'Time Due')}${tog('showPrinted', 'Petsa/oras')}${tog('showSlip', 'Slip no.')}${tog('showPosId', 'POS ID')}${tog('showStaff', 'Staff')}${tog('showSalesType', 'Sales Type')}${tog('showNew', '"NEW" + oras')}</div>
    <div style="display:flex;gap:.5rem;flex-wrap:wrap;margin-top:.3rem;"><div>${pxLbl('Pamagat sa taas (opsyonal)', 'hal. pangalan ng company/branch')}<input value="${pxE(K.brand)}" onchange="pxFmtK('brand',this.value)" style="width:210px;"></div><div>${pxLbl('POS ID')}<input value="${pxE(K.posId)}" onchange="pxFmtK('posId',this.value)" style="width:100px;"></div></div>
    <div style="margin-top:.4rem;">${pxLbl('Preview')}${pxLinesHtml(kl, cols)}</div></div>
  <div style="flex:1;min-width:300px;"><b>🧾 Bill / billing statement</b><div style="display:flex;gap:.3rem;flex-wrap:wrap;margin:.3rem 0;"><button class="btn ${B.preset !== 'octopus' ? 'btn-primary' : 'btn-secondary'} btn-sm" onclick="pxFmtB('preset','std')">Standard</button><button class="btn ${B.preset === 'octopus' ? 'btn-primary' : 'btn-secondary'} btn-sm" onclick="pxFmtB('preset','octopus')">Octopos-style</button></div>
    <div>${btog('showCustomer', 'Customer name')}${btog('showIssuedBy', 'Issued By')}</div>
    <div style="display:flex;gap:.5rem;flex-wrap:wrap;margin:.3rem 0;"><div>${pxLbl('Pamagat sa ibaba (Powered by)', 'blangko = developer line')}<input value="${pxE(B.poweredBy)}" onchange="pxFmtB('poweredBy',this.value)" style="width:200px;"></div><div>${pxLbl('Paalala (Not an Official Receipt)')}<input value="${pxE(B.notOfficial)}" onchange="pxFmtB('notOfficial',this.value)" style="width:230px;"></div></div>
    <div style="display:flex;gap:.5rem;flex-wrap:wrap;">${logo('logoTop', 'Logo sa taas (hal. ERP / system logo)')}${logo('logoBottom', 'Logo sa ibaba (logo ng company)')}</div>
    <div style="margin-top:.3rem;">${pxLbl('Lapad ng logo', 'Maglalagay ng imahe: itim-puti ang lalabas sa thermal printer. Mas malinaw ang simpleng logo na mataas ang contrast.')}<div style="display:flex;gap:.2rem;">${[[192, 'Maliit'], [288, 'Katamtaman'], [384, 'Malapad']].map(a => `<button class="btn ${(B.logoW || 288) === a[0] ? 'btn-primary' : 'btn-secondary'} btn-sm" onclick="pxLogoSize(${a[0]})">${a[1]}</button>`).join('')}</div></div>
    <div style="margin-top:.4rem;">${pxLbl('Preview')}${pxLinesHtml(bl, cols)}</div></div></div>
  <div style="margin-top:.6rem;"><b>🔒 Privacy ng customer sa printout</b>${pxHint('Ang kumpletong detalye ay nananatili sa sales record (para sa audit/BIR). Ang itatago ay <b>sa papel lang</b>. ⚠️ Sa <b>opisyal na resibo</b>, hinihingi ng BIR ang pangalan/ID ng Senior/PWD — ingat sa pag-hide doon.')}
    <table class="table" style="font-size:.82rem;"><tr><th></th><th>Pangalan ng customer / payer</th><th>ID no. (Senior/PWD/Member)</th><th>Member block</th></tr>
    ${[['bill', 'Bill / Billing statement'], ['receipt', 'Resibo (settled)']].map(d => `<tr><td><b>${d[1]}</b></td><td>${sel(d[0], 'customer', [['show', 'Ipakita'], ['initials', 'Initials lang (J. D.)'], ['hide', 'Itago']])}</td><td>${sel(d[0], 'ids', [['show', 'Ipakita'], ['last4', '****1234 (huling 4)'], ['hide', 'Itago']])}</td><td>${sel(d[0], 'member', [['show', 'Ipakita'], ['hide', 'Itago']])}</td></tr>`).join('')}</table></div>
  <button class="btn btn-success" style="margin-top:.4rem;" onclick="pxFmtSave()">💾 I-save ang format</button></div>`;
}

/* ================= DAILY / MALL SALES REPORT =================
   Bawat araw ay sariling ulat (hindi nagpapatong): ito ang ibinibigay sa mall (hal. "one POS") para sa singil na renta batay sa benta. */
let PX_DR = null;
const pxDrDays = (a, b) => { const o = [], d = new Date(a + 'T12:00:00'), e = new Date(b + 'T12:00:00'); while (d <= e && o.length < 62) { o.push(pxISO(d)); d.setDate(d.getDate() + 1); } return o; };
function pxDayRow(d, sales, shifts) {
  const ok = sales.filter(s => s.status !== 'void'), vd = sales.filter(s => s.status === 'void'), sm = a => ok.reduce((x, s) => x + (a(s) || 0), 0), pc = s => s.pc || {}, T = pxSum(sales);
  const r = { date: d, n: ok.length, nVoid: vd.length, voidAmt: pxR2(vd.reduce((x, s) => x + (s.total || 0), 0)), gross: pxR2(sm(s => s.gross)), disc: pxR2(sm(s => (pc(s).sc || 0) + (pc(s).pwd || 0) + (pc(s).disc || 0) + (pc(s).comp || 0))), svc: pxR2(sm(s => s.svc)), vatable: pxR2(sm(s => pc(s).vat)), exempt: pxR2(sm(s => pc(s).exm)), nvat: pxR2(sm(s => pc(s).nvat)), vat: pxR2(sm(s => s.vatAmt)), total: pxR2(sm(s => s.total)), modes: T.modes, first: ok.length ? ok[0].no : '', last: ok.length ? ok[ok.length - 1].no : '' };
  r.net = pxR2(r.vatable + r.exempt + r.nvat); r.shifts = shifts.length; r.open = shifts.filter(x => x.status !== 'closed').length; r.over = pxR2(shifts.reduce((x, y) => x + (+y.over || 0), 0));
  r.z = !shifts.length ? (ok.length ? 'WALANG SHIFT' : '—') : r.open ? 'HINDI PA Z-READ' : 'Z-read ✔' + (shifts.length > 1 ? ' (' + shifts.length + ' shift)' : ''); return r;
}
function pxDailyRpt() { PX_DR = { from: pxBiz().slice(0, 8) + '01', to: pxBiz(), pct: (PX.cfg && PX.cfg.mallPct) || '', rows: null }; pxDrRender(); }
function pxDrRender() {
  const R = PX_DR, rows = R.rows, pct = pxNum(R.pct), modes = rows ? [...new Set(rows.flatMap(r => Object.keys(r.modes)))] : [], tot = k => pxM((rows || []).reduce((x, r) => x + (r[k] || 0), 0));
  pxModal(`<h3 style="margin-top:0;">🏬 Daily / Mall Sales Report — ${pxE(pxSite().name || '')}</h3>${pxHint('📖 Isang hanay = isang araw ng benta (business date, ayon sa cut-off sa Setup). <b>Net Sales</b> = benta na walang VAT at service charge, pagkatapos ng discount at void — karaniwang batayan ng renta ng mall. Ilagay ang <b>% ng renta</b> para makuwenta. Tingnan ang <b>Z-read</b> column: ⚠ ang araw na hindi pa na-Z-read.')}
  <div style="display:flex;gap:.4rem;flex-wrap:wrap;align-items:end;"><div><small>Mula</small><br><input type="date" id="dr-f" value="${R.from}"></div><div><small>Hanggang</small><br><input type="date" id="dr-t" value="${R.to}"></div><div><small>% ng renta sa Net Sales</small><br><input type="number" id="dr-p" step="any" min="0" value="${pxE(R.pct)}" style="width:90px;" placeholder="hal. 10"></div><button class="btn btn-primary btn-sm" onclick="pxDrLoad()">🔎 Kunin</button>${rows ? '<button class="btn btn-secondary btn-sm" onclick="pxDrCsv()">⬇ CSV</button>' : ''}</div>
  ${rows ? `<div style="overflow:auto;margin-top:.5rem;"><table class="table" style="font-size:.78rem;white-space:nowrap;"><tr><th>Petsa</th><th>Trans</th><th style="text-align:right;">Gross</th><th style="text-align:right;">Discount</th><th style="text-align:right;">Net Sales</th><th style="text-align:right;">VAT</th><th style="text-align:right;">Svc Chg</th><th style="text-align:right;">Total</th>${modes.map(m => `<th style="text-align:right;">${pxE((PX_MODES[m] || m).replace(/^\S+\s/, ''))}</th>`).join('')}<th>Void</th><th>Z-read</th>${pct ? '<th style="text-align:right;">Renta ' + pct + '%</th>' : ''}</tr>
  ${rows.map(r => `<tr style="${r.n || r.shifts ? '' : 'opacity:.45;'}"><td>${r.date}</td><td>${r.n}</td><td style="text-align:right;">${pxM(r.gross)}</td><td style="text-align:right;">${pxM(r.disc)}</td><td style="text-align:right;"><b>${pxM(r.net)}</b></td><td style="text-align:right;">${pxM(r.vat)}</td><td style="text-align:right;">${pxM(r.svc)}</td><td style="text-align:right;">${pxM(r.total)}</td>${modes.map(m => `<td style="text-align:right;">${pxM(r.modes[m] || 0)}</td>`).join('')}<td>${r.nVoid || ''}</td><td style="color:${/HINDI|WALANG/.test(r.z) ? '#b91c1c' : '#166534'};font-weight:700;">${/HINDI|WALANG/.test(r.z) ? '⚠ ' : ''}${pxE(r.z)}</td>${pct ? `<td style="text-align:right;">${pxM(r.net * pct / 100)}</td>` : ''}</tr>`).join('')}
  <tr style="font-weight:700;background:#f1f5f9;"><td>TOTAL</td><td>${rows.reduce((x, r) => x + r.n, 0)}</td><td style="text-align:right;">${tot('gross')}</td><td style="text-align:right;">${tot('disc')}</td><td style="text-align:right;">${tot('net')}</td><td style="text-align:right;">${tot('vat')}</td><td style="text-align:right;">${tot('svc')}</td><td style="text-align:right;">${tot('total')}</td>${modes.map(m => `<td style="text-align:right;">${pxM(rows.reduce((x, r) => x + (r.modes[m] || 0), 0))}</td>`).join('')}<td></td><td></td>${pct ? `<td style="text-align:right;">${pxM(rows.reduce((x, r) => x + r.net, 0) * pct / 100)}</td>` : ''}</tr></table></div>` : ''}`, 1100);
}
async function pxDrLoad() {
  const R = PX_DR, g = i => document.getElementById(i); R.from = g('dr-f').value; R.to = g('dr-t').value; R.pct = g('dr-p').value; if (!R.from || !R.to || R.from > R.to) { pxAlert('Ayusin ang petsa.'); return; }
  const days = pxDrDays(R.from, R.to); try { const out = await Promise.all(days.map(async d => { const [L, sh] = await Promise.all([pxLoadSales(d), db.collection('pos_shifts').where('site', '==', PX.site).where('date', '==', d).get()]); const S = []; sh.forEach(x => S.push(x.data())); return pxDayRow(d, L, S); })); R.rows = out; pxDrRender(); } catch (e) { pxAlert('Error: ' + e.message); }
}
function pxDrCsv() {
  const R = PX_DR, rows = R.rows || [], pct = pxNum(R.pct), modes = [...new Set(rows.flatMap(r => Object.keys(r.modes)))], q = v => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
  const head = ['Date', 'Transactions', 'Void count', 'Void amount', 'Gross Sales (VAT-inc)', 'Discounts', 'Net Sales (excl VAT & SC)', 'VATable Sales', 'VAT-Exempt Sales', 'Non-VAT Sales', 'VAT Amount', 'Service Charge', 'Total Collected'].concat(modes.map(m => (PX_MODES[m] || m).replace(/^\S+\s/, ''))).concat(['First Slip', 'Last Slip', 'Z-read', 'Cash over/short']).concat(pct ? ['Rent ' + pct + '%'] : []);
  const body = rows.map(r => [r.date, r.n, r.nVoid, r.voidAmt, r.gross, r.disc, r.net, r.vatable, r.exempt, r.nvat, r.vat, r.svc, r.total].concat(modes.map(m => pxR2(r.modes[m] || 0))).concat([r.first, r.last, r.z, r.over]).concat(pct ? [pxR2(r.net * pct / 100)] : []));
  pxDownload('daily_sales_' + pxSlug(pxSite().name || PX.site) + '_' + R.from + '_' + R.to + '.csv', [head].concat(body).map(l => l.map(q).join(',')).join('\r\n'));
}
/* ====================== RESERVATIONS · MEETING ROOM · KITCHEN CUT-OFF ====================== */
// pos_reservations/{id}: {company,site,date,start,hours,startMs,endMs,tables:[{id,name}],name,phone,pax,notes,adv:[{id,name,price,qty,note}],deposit,occasion,status(booked|seated|cancelled|no_show),tabId,log:[]}
let PX_RSV = null;
const PX_RSTAT = { booked: ['📅 Naka-reserve', '#2563eb'], seated: ['🍽️ Na-seat', '#16a34a'], cancelled: ['❌ Kanselado', '#64748b'], no_show: ['🚫 No-show', '#dc2626'] };
const pxHM = ms => new Date(ms).toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit', hour12: true });
const pxRvMs = (d, t) => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d || ''), h = /^(\d{1,2}):(\d{2})$/.exec(t || ''); return m && h ? new Date(+m[1], +m[2] - 1, +m[3], +h[1], +h[2]).getTime() : NaN; };
const pxRvDate = ms => new Date(ms).toLocaleDateString('en-CA');
function pxRvTbl(id) { return ((PX.floor || {}).tables || []).find(t => t.id === id); }
function pxIsRoom(t) { return !!(t && t.room); }
/* ---------- Meeting / private room: minimum spend ---------- */
function pxRoomSnap(t) { return t && t.room ? { room: true, minSpend: +t.minSpend || 0, fee: +t.roomFee || 0 } : null; }
function pxRoomInfo(tab) { const r = tab && tab.roomSnap; if (!r || !r.room) return null; const food = pxR2(pxTabFood(tab)); const waived = !(r.fee > 0) || (r.minSpend > 0 && food >= r.minSpend); return { minSpend: r.minSpend, fee: r.fee, food, waived, left: Math.max(0, pxR2(r.minSpend - food)) }; }
function pxRoomBanner(tab) { const r = pxRoomInfo(tab); if (!r) return ''; return `<div style="border:1px solid #c4b5fd;background:#f5f3ff;border-radius:.5rem;padding:.4rem .6rem;margin-bottom:.4rem;font-size:.85rem;">🏛️ <b>Meeting / Private room</b> · Minimum spend ₱${pxM(r.minSpend)} · Order ngayon ₱${pxM(r.food)} · ${r.fee > 0 ? (r.waived ? '<b style="color:#16a34a;">✔ Libre ang room fee</b>' : `Kulang pa ₱${pxM(r.left)} para ma-waive ang <b>room fee ₱${pxM(r.fee)}</b>`) : 'Walang room fee'}</div>`; }
/* ---------- Kitchen cut-off ---------- */
function pxCutInfo() { const k = PX.cfg.kcut || { on: true, time: '21:00' }; const m = /^(\d{1,2}):(\d{2})$/.exec(k.time || '21:00'); return { on: k.on !== false, time: k.time || '21:00', min: m ? +m[1] * 60 + +m[2] : 1260 }; }
function pxAfterCut(ms) { const c = pxCutInfo(); if (!c.on) return false; const d = new Date(ms || Date.now()), mi = d.getHours() * 60 + d.getMinutes(), dc = (PX.cfg.dayCutoff != null ? +PX.cfg.dayCutoff : 5) * 60; return mi >= c.min || mi < dc; }
async function pxCutGuard(what) {
  if (!pxAfterCut()) return true; if (pxAdmin()) return true;
  const ok = await pxPin('🌙 Lampas na sa cut-off ng kusina (' + pxCutInfo().time + '). Hindi na tumatanggap ng order maliban kung may code ng manager.'); try { await logSystemAction(ok ? 'POS_AFTER_CUTOFF_OK' : 'POS_AFTER_CUTOFF_DENIED', (what || 'order') + ' · ' + (PX.site || '')); } catch (e) {} return ok;
}
/* ---------- Load / overlap ---------- */
async function pxRsvLoad(force) {
  if (!force && PX._rsvAt && Date.now() - PX._rsvAt < 45000 && PX._rsvSite === PX.site) return PX.rsvAct || [];
  try { const s = await db.collection('pos_reservations').where('site', '==', PX.site).where('status', 'in', ['booked', 'seated']).get(); PX.rsvAct = []; s.forEach(d => PX.rsvAct.push(Object.assign({ id: d.id }, d.data()))); PX._rsvAt = Date.now(); PX._rsvSite = PX.site; } catch (e) { PX.rsvAct = PX.rsvAct || []; }
  return PX.rsvAct;
}
const pxRvActive = r => r.status === 'booked' || r.status === 'seated';
function pxRvOverlap(tid, s, e, skipId) { return (PX.rsvAct || []).filter(r => r.id !== skipId && pxRvActive(r) && (r.tables || []).some(t => t.id === tid) && r.startMs < e && r.endMs > s); }
function pxRsvNext(tid) { const now = Date.now(); return (PX.rsvAct || []).filter(r => r.status === 'booked' && (r.tables || []).some(t => t.id === tid) && r.endMs > now && pxRvDate(r.startMs) === pxBiz()).sort((a, b) => a.startMs - b.startMs)[0] || null; }
function pxRsvSoon(tid, mins) { const now = Date.now(); return (PX.rsvAct || []).find(r => r.status === 'booked' && (r.tables || []).some(t => t.id === tid) && r.startMs - now < (mins || 90) * 60000 && r.endMs > now) || null; }
/* ---------- Main view ---------- */
async function pxRsvView() {
  if (!PX.floor || PX.floor._site !== PX.site) { await pxFloorLoad(); PX.floor._site = PX.site; }
  await pxRsvLoad(true); if (!PX.rsvDay) PX.rsvDay = pxBiz();
  const d = PX.rsvDay, mode = PX.rsvMode || 'day'; let list;
  if (mode === 'day') { try { const s = await db.collection('pos_reservations').where('site', '==', PX.site).where('date', '==', d).get(); list = []; s.forEach(x => list.push(Object.assign({ id: x.id }, x.data()))); } catch (e) { list = (PX.rsvAct || []).filter(r => r.date === d); } }
  else list = (PX.rsvAct || []).filter(r => r.date >= pxBiz() && r.status === 'booked');
  list.sort((a, b) => a.startMs - b.startMs);
  const shift = n => { const x = new Date(d + 'T00:00:00'); x.setDate(x.getDate() + n); return x.toLocaleDateString('en-CA'); };
  const dl = new Date(d + 'T00:00:00').toLocaleDateString('en-PH', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  const act = list.filter(pxRvActive), pax = act.reduce((s, r) => s + (+r.pax || 0), 0);
  const card = r => { const st = PX_RSTAT[r.status] || [r.status, '#64748b'], tn = (r.layoutId ? '🏢 <b>Buong ' + pxE(r.layoutName || '') + '</b> (' + (r.tables || []).length + ' table)' : (r.tables || []).map(t => { const T = pxRvTbl(t.id); return (pxIsRoom(T) ? '🏛️ ' : '🪑 ') + pxE(t.name); }).join(', ')), adv = (r.adv || []);
    const late = r.status === 'booked' && r.endMs < Date.now();
    return `<div style="border:1px solid #e2e8f0;border-left:5px solid ${st[1]};border-radius:.5rem;padding:.5rem .6rem;margin-bottom:.4rem;${r.status === 'cancelled' || r.status === 'no_show' ? 'opacity:.6;' : ''}">
    <div style="display:flex;justify-content:space-between;gap:.4rem;flex-wrap:wrap;"><b>🕒 ${pxHM(r.startMs)} – ${pxHM(r.endMs)} <small style="color:#64748b;">(${+r.hours} oras)</small>${mode !== 'day' ? ' · ' + pxE(r.date) : ''}</b><span style="color:${st[1]};font-weight:700;">${st[0]}${late ? ' · lampas na ang oras' : ''}</span></div>
    <div>${tn} · 👤 <b>${pxE(r.name)}</b> ${r.phone ? '· 📞 ' + pxE(r.phone) : ''} · 👥 ${+r.pax || 0} pax${r.occasion ? ' · 🎉 ' + pxE(r.occasion) : ''}</div>
    ${r.notes ? `<div style="font-size:.82rem;color:#b45309;">📝 ${pxE(r.notes)}</div>` : ''}
    ${adv.length ? `<div style="font-size:.82rem;color:#475569;">🧾 Advance order: ${adv.map(l => l.qty + '× ' + pxE(l.name)).join(', ')}</div>` : ''}
    ${+r.deposit > 0 ? `<div style="font-size:.82rem;color:#16a34a;">💵 Deposit ₱${pxM(r.deposit)}${r.depositNote ? ' (' + pxE(r.depositNote) + ')' : ''}</div>` : ''}
    ${r.cancelReason ? `<div style="font-size:.8rem;color:#dc2626;">Dahilan: ${pxE(r.cancelReason)}</div>` : ''}
    ${r.status === 'booked' ? `<div style="display:flex;gap:.3rem;flex-wrap:wrap;margin-top:.35rem;">${r.confirmedAt ? '<span style="font-size:.78rem;color:#166534;font-weight:700;align-self:center;">✅ Confirmed ' + pxE(pxHM(Date.parse(r.confirmedAt))) + '</span>' : pxBtn('btn-primary btn-sm', '📞 Na-confirm na darating', `pxRsvConfirm('${r.id}')`)}${pxBtn('btn-success btn-sm', '🪑 I-seat / Dumating na', `pxRsvSeat('${r.id}')`)}${pxBtn('btn-primary btn-sm', '✏️ Edit', `pxRsvEdit('${r.id}')`)}${pxBtn('btn-secondary btn-sm', '🔁 Palitan ang table', `pxRsvMove('${r.id}')`)}${pxBtn('btn-secondary btn-sm', '👤 Palitan ang guest', `pxRsvGuest('${r.id}')`)}${pxBtn('btn-secondary btn-sm', '🚫 No-show', `pxRsvStatus('${r.id}','no_show')`)}${pxBtn('btn-danger btn-sm', '❌ I-cancel', `pxRsvStatus('${r.id}','cancelled')`)}</div>` : ''}</div>`; };
  return pxHint('📖 <b>Reservation</b>: dito makikita ng receptionist kung sino ang naka-reserve sa araw na ito (o sa susunod na mga araw). Pindutin ang <b>➕ Bagong reservation</b> para mag-book; piliin ang petsa, oras, ilang oras, at table (o 🏛️ meeting room). Ang table na may kasalukuyang booking sa parehong oras ay hindi mapipili. Pag dumating na ang guest, <b>🪑 I-seat</b> — bubuksan ang table at ilo-load ang advance order. May <b>🔎 Check availability</b> para sa mga nag-iinquire.') + `
  <div style="display:flex;gap:.3rem;flex-wrap:wrap;align-items:center;margin-bottom:.5rem;">
   ${pxBtn('btn-primary btn-sm', '➕ Bagong reservation', 'pxRsvNew()')}${pxBtn('btn-secondary btn-sm', '🔎 Check availability', 'pxRsvAvail()')}${pxBtn('btn-secondary btn-sm', '🔄', 'pxBody()')}
   <span style="margin-left:auto;display:flex;gap:.3rem;flex-wrap:wrap;align-items:center;">${pxBtn('btn-secondary btn-sm', '◀', `pxRsvGo('${shift(-1)}')`)}<input type="date" value="${d}" onchange="pxRsvGo(this.value)">${pxBtn('btn-secondary btn-sm', '▶', `pxRsvGo('${shift(1)}')`)}${pxBtn('btn-secondary btn-sm', 'Ngayon', `pxRsvGo('${pxBiz()}')`)}${pxBtn('btn-secondary btn-sm', 'Bukas', `pxRsvGo('${(() => { const x = new Date(pxBiz() + 'T00:00:00'); x.setDate(x.getDate() + 1); return x.toLocaleDateString('en-CA'); })()}')`)}</span></div>
  <div style="display:flex;gap:.3rem;margin-bottom:.4rem;">${pxBtn(mode === 'day' ? 'btn-primary btn-sm' : 'btn-secondary btn-sm', '📆 Isang araw', "PX.rsvMode='day';pxBody()")}${pxBtn(mode === 'up' ? 'btn-primary btn-sm' : 'btn-secondary btn-sm', '🗓️ Lahat ng paparating', "PX.rsvMode='up';pxBody()")}</div>
  <div style="font-weight:700;margin-bottom:.3rem;">${mode === 'day' ? pxE(dl) + ' · ' + act.length + ' reservation · ' + pax + ' pax' : 'Paparating: ' + list.length + ' reservation'}</div>
  ${list.length ? list.map(card).join('') : '<div style="color:#94a3b8;padding:1rem;text-align:center;">Walang reservation.</div>'}`;
}
function pxRsvGo(d) { if (!d) return; PX.rsvDay = d; PX.rsvMode = 'day'; pxBody(); }
/* ---------- Availability inquiry ---------- */
function pxRsvAvail() {
  const now = new Date(), t = String(now.getHours() + 1).padStart(2, '0') + ':00';
  pxOv('px-rsvav', `<h3 style="margin-top:0;">🔎 Check availability</h3><div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:.4rem;"><div>${pxLbl('Petsa')}<input id="av-d" type="date" value="${PX.rsvDay || pxBiz()}" onchange="pxRsvAvRun()" style="width:100%;box-sizing:border-box;"></div><div>${pxLbl('Oras')}<input id="av-t" type="time" value="${t}" onchange="pxRsvAvRun()" style="width:100%;box-sizing:border-box;"></div><div>${pxLbl('Oras (hrs)')}<input id="av-h" type="number" min="0.5" step="0.5" value="2" onchange="pxRsvAvRun()" style="width:100%;box-sizing:border-box;"></div><div>${pxLbl('Pax')}<input id="av-p" type="number" min="1" value="4" onchange="pxRsvAvRun()" style="width:100%;box-sizing:border-box;"></div></div><div id="av-res" style="margin-top:.5rem;"></div><div style="margin-top:.6rem;">${pxBtn('btn-secondary', 'Isara', "pxOvHide('px-rsvav')", 'width:100%;')}</div>`, 10200, 560); pxRsvAvRun();
}
function pxRsvAvRun() {
  const g = i => (document.getElementById(i) || {}).value, s = pxRvMs(g('av-d'), g('av-t')), h = pxNum(g('av-h')) || 1, e = s + h * 3600000, pax = pxNum(g('av-p')) || 1, out = document.getElementById('av-res'); if (!out) return;
  if (isNaN(s)) { out.innerHTML = '<small>Ilagay ang petsa at oras.</small>'; return; }
  const T = (PX.floor.tables || []).slice().sort((a, b) => (a.layout || '').localeCompare(b.layout || '') || String(a.name).localeCompare(String(b.name), undefined, { numeric: true }));
  out.innerHTML = T.map(t => { const c = pxRvOverlap(t.id, s, e), small = (t.seats || 0) && t.seats < pax, busy = pxTabOf(t.id) && pxRvDate(s) === pxBiz() && s < Date.now() + 3600000; const free = !c.length && !busy;
    return `<div style="display:flex;justify-content:space-between;border-bottom:1px solid #f1f5f9;padding:.25rem 0;font-size:.88rem;${free && !small ? '' : 'opacity:.6;'}"><span>${pxIsRoom(t) ? '🏛️' : '🪑'} <b>${pxE(t.name)}</b> <small style="color:#64748b;">· 👥 ${t.seats || '-'} · ${pxE(pxLayName(t.layout) || '')}</small></span><span>${c.length ? '<span style="color:#dc2626;">Naka-book ' + c.map(r => pxHM(r.startMs) + '–' + pxHM(r.endMs) + ' ' + pxE(r.name)).join(', ') + '</span>' : busy ? '<span style="color:#ea580c;">May customer ngayon</span>' : small ? '<span style="color:#b45309;">Masikip (' + t.seats + ')</span>' : '<span style="color:#16a34a;">✔ Libre</span>'}${free && !small ? ` <button class="btn btn-sm btn-primary" onclick="pxOvHide('px-rsvav');pxRsvNew({date:'${g('av-d')}',start:'${g('av-t')}',hours:${h},pax:${pax},tables:['${t.id}']})">Book</button>` : ''}</span></div>`; }).join('') || '<small>Wala pang table sa layout.</small>';
}
/* ---------- Form ---------- */
function pxRsvNew(pre) { PX_RSV = Object.assign({ id: '', date: PX.rsvDay || pxBiz(), start: '18:00', hours: 2, tables: [], name: '', phone: '', pax: 2, notes: '', adv: [], deposit: 0, depositNote: '', occasion: '' }, pre || {}); if ((PX_RSV.tables || []).length && typeof PX_RSV.tables[0] === 'string') PX_RSV.tables = PX_RSV.tables.map(id => ({ id, name: (pxRvTbl(id) || {}).name || id })); pxRsvForm(); }
function pxRsvEdit(id) { const r = (PX.rsvAct || []).find(x => x.id === id); if (!r) return; PX_RSV = JSON.parse(JSON.stringify(r)); pxRsvForm(); }
function pxRvSync() { const g = i => document.getElementById(i); if (!g('rv-name')) return; PX_RSV.name = g('rv-name').value; PX_RSV.phone = g('rv-phone').value; PX_RSV.pax = pxNum(g('rv-pax').value); PX_RSV.date = g('rv-date').value; PX_RSV.start = g('rv-start').value; PX_RSV.hours = pxNum(g('rv-hrs').value); PX_RSV.notes = g('rv-notes').value; PX_RSV.occasion = g('rv-occ').value; PX_RSV.deposit = pxNum(g('rv-dep').value); PX_RSV.depositNote = g('rv-depn').value; }
function pxRvRe() { pxRvSync(); pxRsvForm(); }
function pxRvLay(l) { pxRvSync(); PX_RSV.lay = l; pxRsvForm(); }
function pxRvFull(l) { pxRvSync(); const r = PX_RSV, s = pxRvMs(r.date, r.start), e = s + (+r.hours || 0) * 3600000; if (r.fullLay === l) { r.tables = r.tables.filter(x => (pxRvTbl(x.id) || {}).layout !== l && !((pxRvTbl(x.id) || {}).layout == null && l === pxLays()[0].id)); r.fullLay = ''; return pxRsvForm(); } if (isNaN(s) || !(e > s)) { pxAlert('Ilagay muna ang petsa, oras at kung ilang oras.'); return; } const TL = (PX.floor.tables || []).filter(t => (t.layout || pxLays()[0].id) === l && !t.out); if (!TL.length) { pxAlert('Walang table sa layout na ito.'); return; } const bad = TL.filter(t => pxRvOverlap(t.id, s, e, r.id).length); if (bad.length) { pxAlert('Hindi puwede ang buong layout: may booking na sa ' + bad.map(t => t.name).join(', ') + ' sa oras na ito.'); return; } r.tables = r.tables.filter(x => !TL.some(t => t.id === x.id)).concat(TL.map(t => ({ id: t.id, name: t.name }))); r.fullLay = l; pxRsvForm(); }
function pxRvTog(id) { pxRvSync(); PX_RSV.fullLay = ''; const a = PX_RSV.tables, i = a.findIndex(t => t.id === id); if (i >= 0) a.splice(i, 1); else a.push({ id, name: (pxRvTbl(id) || {}).name || id }); pxRsvForm(); }
function pxRvMember() { pxRvSync(); pxMemCheck(m => { if (!m) return; pxRvSync(); PX_RSV.member = pxMemSnap(m); pxRsvForm(); }, '✔ Para sa reservation'); }
function pxRvMemClear() { pxRvSync(); if (PX.cfg.tableMember && PX_RSV.adv.length) { pxAlert('May advance order na — alisin muna ang order bago tanggalin ang member.'); return; } PX_RSV.member = null; pxRsvForm(); }
function pxRvAdvSearch(q) { const box = document.getElementById('rv-ar'); if (!box) return; q = String(q || '').toLowerCase().trim(); if (!q) { box.innerHTML = ''; return; } const L = pxMenuItems0().filter(m => q.split(/\s+/).every(w => (m.name + ' ' + (m.cat || '')).toLowerCase().includes(w))).slice(0, 30); box.innerHTML = L.length ? L.map(m => `<div onclick="pxRvAdvPick('${pxE(m.id)}')" style="display:flex;justify-content:space-between;padding:.3rem .4rem;border-bottom:1px solid #f1f5f9;cursor:pointer;font-size:.88rem;"><span>${pxE(m.name)}</span><b>₱${pxM(m._price)}</b></div>`).join('') : '<small style="color:#94a3b8;">Walang nahanap.</small>'; }
function pxRvAdvPick(id) { pxRvSync(); const m = pxMenuItems0().find(x => x.id === id); if (!m) return; const x = PX_RSV.adv.find(l => l.id === m.id); if (x) x.qty++; else PX_RSV.adv.push({ id: m.id, name: m.name, price: +m._price || 0, qty: 1, note: '' }); const q = (document.getElementById('rv-q') || {}).value || ''; pxRsvForm(); const i = document.getElementById('rv-q'); if (i) { i.value = q; pxRvAdvSearch(q); i.focus(); } }
function pxRvAdvAdd() { pxRvSync(); const sel = document.getElementById('rv-adv'); if (!sel || !sel.value) return; const m = pxMenuItems0().find(x => x.id === sel.value); if (!m) return; const x = PX_RSV.adv.find(l => l.id === m.id); if (x) x.qty++; else PX_RSV.adv.push({ id: m.id, name: m.name, price: +m._price || 0, qty: 1, note: '' }); pxRsvForm(); }
function pxRvAdvQty(i, d) { pxRvSync(); const l = PX_RSV.adv[i]; if (!l) return; l.qty += d; if (l.qty <= 0) PX_RSV.adv.splice(i, 1); pxRsvForm(); }
async function pxRvAdvNote(i) { pxRvSync(); const v = await pxPrompt('📝 Tala sa item', { def: PX_RSV.adv[i].note || '', ph: 'opsyonal', ok: 'I-save' }); if (v === null) return; PX_RSV.adv[i].note = v.trim(); pxRsvForm(); }
function pxRsvForm() {
  const r = PX_RSV, s = pxRvMs(r.date, r.start), e = s + (+r.hours || 0) * 3600000, ok = !isNaN(s), T = (PX.floor.tables || []).slice().sort((a, b) => (a.layout || '').localeCompare(b.layout || '') || String(a.name).localeCompare(String(b.name), undefined, { numeric: true }));
  const lays = pxLays(), lay = r.lay && lays.some(l => l.id === r.lay) ? r.lay : (r.tables.length ? ((pxRvTbl(r.tables[0].id) || {}).layout || lays[0].id) : pxLayCur()), TL = (PX.floor.tables || []).filter(t => (t.layout || lays[0].id) === lay && !t.out), nowBusy = id => pxTabOf(id) && pxRvDate(s) === pxBiz() && s < Date.now() + 3600000;
  const fullSel = !!r.fullLay && r.fullLay === lay;
  const mapTile = t => { const c = ok ? pxRvOverlap(t.id, s, e, r.id) : [], sel = r.tables.some(x => x.id === t.id), busy = !sel && nowBusy(t.id), sh = t.shape || 'sq', sz = PX_SHP[sh] || PX_SHP.sq, w = t.w || sz.w, h = t.h || sz.h, blocked = (c.length || busy) && !sel, col = sel ? '#bfdbfe' : c.length ? '#e2e8f0' : busy ? '#fed7aa' : '#bbf7d0', bd = sel ? '#2563eb' : c.length ? '#94a3b8' : busy ? '#ea580c' : '#16a34a';
    return `<div onclick="${blocked ? '' : `pxRvTog('${t.id}')`}" title="${c.length ? 'Naka-book: ' + c.map(x => pxE(x.name) + ' ' + pxHM(x.startMs) + '–' + pxHM(x.endMs)).join(', ') : ''}" style="position:absolute;left:${t.x / PX_FW * 100}%;top:${t.y / PX_FH * 100}%;width:${w / PX_FW * 100}%;height:${h / PX_FH * 100}%;background:${col};border:2px solid ${bd};border-radius:${sh === 'round' ? '50%' : '.5rem'};display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;font-size:.7rem;line-height:1.1;overflow:hidden;cursor:${blocked ? 'not-allowed' : 'pointer'};${blocked ? 'opacity:.7;' : ''}"><b>${t.room ? '🏛️ ' : ''}${pxE(t.name)}</b><span>👥 ${t.seats || '-'}</span>${sel ? '<span>✔</span>' : c.length ? '<span style="color:#b91c1c;">⛔ ' + pxHM(c[0].startMs) + '</span>' : busy ? '<span>may customer</span>' : ''}</div>`; };
  const memReq = !!PX.cfg.tableMember;
  const rooms = r.tables.map(x => pxRvTbl(x.id)).filter(pxIsRoom);
  pxOv('px-rsv', `<h3 style="margin-top:0;">${r.id ? '✏️ Edit' : '➕ Bagong'} Reservation</h3>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:.5rem;"><div>${pxLbl('Pangalan ng guest')}<input id="rv-name" value="${pxE(r.name)}" style="width:100%;box-sizing:border-box;"></div><div>${pxLbl('Contact no.')}<input id="rv-phone" value="${pxE(r.phone)}" style="width:100%;box-sizing:border-box;"></div></div>
  <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:.5rem;margin-top:.3rem;"><div>${pxLbl('Petsa')}<input id="rv-date" type="date" value="${pxE(r.date)}" onchange="pxRvRe()" style="width:100%;box-sizing:border-box;"></div><div>${pxLbl('Oras')}<input id="rv-start" type="time" value="${pxE(r.start)}" onchange="pxRvRe()" style="width:100%;box-sizing:border-box;"></div><div>${pxLbl('Ilang oras', 'hal. 2, 3, 4.5')}<input id="rv-hrs" type="number" min="0.5" step="0.5" value="${+r.hours || ''}" onchange="pxRvRe()" style="width:100%;box-sizing:border-box;"></div><div>${pxLbl('Pax')}<input id="rv-pax" type="number" min="1" value="${+r.pax || ''}" style="width:100%;box-sizing:border-box;"></div></div>
  <div style="font-size:.8rem;color:#475569;margin:.2rem 0;">${ok ? '🕒 ' + pxHM(s) + ' – ' + pxHM(e) : ''}</div>
  ${pxLbl('Table / Room — i-tap ang table sa mismong layout', 'Berde = libre, asul = napili, abo ⛔ = may booking na sa oras na ito, kahel = may customer ngayon. Puwede ring i-reserve ang buong layout.')}
  <div style="display:flex;gap:.3rem;flex-wrap:wrap;margin-bottom:.3rem;align-items:center;">${lays.map(l => `<button type="button" class="btn ${l.id === lay ? 'btn-primary' : 'btn-secondary'} btn-sm" onclick="pxRvLay('${l.id}')">${pxE(l.name)}</button>`).join('')}<button type="button" class="btn ${fullSel ? 'btn-success' : 'btn-secondary'} btn-sm" style="margin-left:auto;" onclick="pxRvFull('${lay}')">🏢 ${fullSel ? '✔ ' : ''}Buong layout: ${pxE(pxLayName(lay) || '')}</button></div>
  <div style="position:relative;width:100%;padding-top:${PX_FH / PX_FW * 100}%;background:#f8fafc;border:2px dashed #cbd5e1;border-radius:.6rem;"><div style="position:absolute;inset:0;">${TL.length ? TL.map(mapTile).join('') : '<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:#94a3b8;">Walang table sa layout na ito.</div>'}</div></div>
  <div style="font-size:.8rem;margin-top:.25rem;">Napili: ${r.tables.length ? r.tables.map(x => pxE(x.name)).join(', ') : '<i>wala pa</i>'}${r.fullLay ? ' · <b>🏢 buong ' + pxE(pxLayName(r.fullLay) || '') + '</b>' : ''}</div>
  ${rooms.map(t => `<div style="font-size:.8rem;color:#6d28d9;margin-top:.2rem;">🏛️ ${pxE(t.name)}: minimum spend ₱${pxM(t.minSpend || 0)}${+t.roomFee > 0 ? ', room fee ₱' + pxM(t.roomFee) + ' kung kulang ang order' : ''}.</div>`).join('')}
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:.5rem;margin-top:.4rem;"><div>${pxLbl('Okasyon (opsyonal)', 'Birthday, meeting, anniversary…')}<input id="rv-occ" value="${pxE(r.occasion || '')}" style="width:100%;box-sizing:border-box;"></div><div>${pxLbl('Deposit / Downpayment ₱ (opsyonal)')}<input id="rv-dep" type="number" min="0" step="0.01" value="${+r.deposit || ''}" style="width:100%;box-sizing:border-box;"></div></div>
  ${pxLbl('Tala sa deposit (hal. GCash ref)')}<input id="rv-depn" value="${pxE(r.depositNote || '')}" style="width:100%;box-sizing:border-box;">
  ${pxLbl('📝 Notes', 'Espesyal na hiling: allergy, cake, setup ng upuan, high chair…')}<textarea id="rv-notes" rows="2" style="width:100%;box-sizing:border-box;">${pxE(r.notes || '')}</textarea>
  ${pxLbl('🪪 Member (opsyonal)', memReq ? 'Required ang membership sa table, kaya kailangan ito bago mag-advance order.' : 'Kung member ang guest.')}<div style="display:flex;gap:.3rem;align-items:center;"><span style="flex:1;">${r.member ? '🪪 <b>' + pxE(r.member.name) + '</b> <small>' + pxE(r.member.mid || '') + '</small>' : '<small style="color:#94a3b8;">Walang member</small>'}</span>${pxBtn('btn-secondary btn-sm', '🪪 Pumili', 'pxRvMember()')}${r.member ? pxBtn('btn-secondary btn-sm', '✖', 'pxRvMemClear()') : ''}</div>
  ${pxLbl('🧾 Advance order (opsyonal)', 'Ilo-load ito sa order kapag na-seat na ang guest.')}
  ${(r.adv || []).map((l, i) => `<div style="display:flex;gap:.3rem;align-items:center;border-bottom:1px solid #f1f5f9;padding:.2rem 0;font-size:.86rem;"><span style="flex:1;">${pxE(l.name)}${l.note ? '<br><small style="color:#b45309;">📝 ' + pxE(l.note) + '</small>' : ''}</span><button class="btn btn-secondary btn-sm" onclick="pxRvAdvNote(${i})">📝</button><button class="btn btn-secondary btn-sm" onclick="pxRvAdvQty(${i},-1)">−</button><b>${l.qty}</b><button class="btn btn-secondary btn-sm" onclick="pxRvAdvQty(${i},1)">+</button></div>`).join('')}
  ${memReq && !r.member ? '<div style="color:#b45309;font-size:.82rem;">🪪 Kailangan muna ng membership bago makapag-advance order.</div>' : `<input id="rv-q" type="search" placeholder="🔎 Hanapin ang menu item…" oninput="pxRvAdvSearch(this.value)" autocomplete="off" style="width:100%;box-sizing:border-box;margin-top:.2rem;"><div id="rv-ar" style="max-height:170px;overflow:auto;"></div>`}
  <div style="display:flex;gap:.5rem;margin-top:.8rem;">${pxBtn('btn-secondary', 'Isara', "pxOvHide('px-rsv')", 'flex:1;padding:.6rem;')}${pxBtn('btn-success', '💾 I-save', 'pxRsvSave()', 'flex:2;padding:.6rem;')}</div><div id="rv-err" style="color:#dc2626;font-size:.85rem;margin-top:.3rem;"></div>`, 10200, 620);
}
async function pxRsvSave() {
  pxRvSync(); const r = PX_RSV, err = m => { const e = document.getElementById('rv-err'); if (e) e.textContent = m; };
  const s = pxRvMs(r.date, r.start), h = +r.hours; if (!r.name.trim()) return err('Ilagay ang pangalan ng guest.'); if (isNaN(s)) return err('Ilagay ang petsa at oras.'); if (!(h > 0)) return err('Ilagay kung ilang oras.'); if (!(r.pax > 0)) return err('Ilagay ang bilang ng pax.'); if (!r.tables.length) return err('Pumili ng table / room.'); if (PX.cfg.tableMember && (r.adv || []).length && !r.member) return err('Kailangan ng membership bago mag-advance order.');
  const e = s + h * 3600000; await pxRsvLoad(true);
  for (const t of r.tables) { const c = pxRvOverlap(t.id, s, e, r.id); if (c.length) return err(`${t.name} ay naka-book na (${pxHM(c[0].startMs)}–${pxHM(c[0].endMs)} ${c[0].name}).`); }
  if (!r.id && e < Date.now() - 3600000) return err('Lampas na ang oras ng reservation na ito.');
  const seats = r.tables.reduce((x, t) => x + ((pxRvTbl(t.id) || {}).seats || 0), 0); if (seats && r.pax > seats && !await pxConfirm(`${r.pax} pax pero ${seats} lang ang kasya sa napiling table. Ituloy?`, { ok: 'Ituloy' })) return;
  const now = new Date().toISOString(), me = String(pxMe().email || ''), doc = { company: pxCo(), site: PX.site, siteName: pxSite().name || '', date: r.date, start: r.start, hours: h, startMs: s, endMs: e, tables: r.tables.map(t => ({ id: t.id, name: t.name })), layoutId: r.fullLay || '', layoutName: r.fullLay ? (pxLayName(r.fullLay) || '') : '', member: r.member || null, name: r.name.trim(), phone: (r.phone || '').trim(), pax: +r.pax, notes: (r.notes || '').trim(), occasion: (r.occasion || '').trim(), adv: (r.adv || []).map(l => ({ id: l.id, name: l.name, price: +l.price || 0, qty: +l.qty || 1, note: l.note || '' })), deposit: +r.deposit || 0, depositNote: (r.depositNote || '').trim(), status: r.status || 'booked', updatedAt: now, updatedBy: me };
  try {
    if (r.id) { doc.log = (r.log || []).concat([{ at: now, by: me, a: 'edit' }]); await db.collection('pos_reservations').doc(r.id).update(doc); }
    else { doc.createdAt = now; doc.createdBy = me; doc.createdByName = String(pxMe().name || ''); doc.log = [{ at: now, by: me, a: 'created' }]; await db.collection('pos_reservations').add(doc); }
    try { await logSystemAction(r.id ? 'POS_RSV_EDIT' : 'POS_RSV_NEW', `${doc.name} ${doc.date} ${doc.start} ${doc.tables.map(t => t.name).join('/')}`); } catch (x) {}
    pxOvHide('px-rsv'); PX._rsvAt = 0; pxToast('✅ Na-save ang reservation'); pxBody();
  } catch (x) { err('Error: ' + x.message); }
}
async function pxRsvUpd(id, fn, a) { const ref = db.collection('pos_reservations').doc(id), d = (await ref.get()).data(); if (!d) throw new Error('Wala na ang reservation.'); const u = fn(d) || {}; u.updatedAt = new Date().toISOString(); u.log = (d.log || []).concat([{ at: u.updatedAt, by: String(pxMe().email || ''), a }]); await ref.update(u); PX._rsvAt = 0; }
async function pxRsvStatus(id, st) {
  const r = (PX.rsvAct || []).find(x => x.id === id); if (!r) return; let why = '';
  if (st === 'cancelled') { why = await pxPrompt('❌ I-cancel ang reservation ni ' + r.name, { hint: 'Ilagay ang dahilan (hal. nag-cancel ang guest, nagpalit ng petsa).', ph: 'dahilan', ok: 'I-cancel' }); if (why === null) return; why = why.trim(); if (!why) { pxAlert('Kailangan ng dahilan.'); return; } }
  else if (!await pxConfirm('I-mark na NO-SHOW si ' + r.name + '? Mabo-bakante ang table.', { ok: 'Oo', danger: true })) return;
  try { await pxRsvUpd(id, () => ({ status: st, cancelReason: why }), st); try { await logSystemAction('POS_RSV_' + st.toUpperCase(), r.name + ' ' + r.date + ' ' + r.start + (why ? ': ' + why : '')); } catch (e) {} pxBody(); } catch (e) { pxAlert('Error: ' + e.message); }
}
async function pxRsvGuest(id) {
  const r = (PX.rsvAct || []).find(x => x.id === id); if (!r) return; const n = await pxPrompt('👤 Bagong guest', { def: r.name, label: 'Pangalan', ok: 'Susunod' }); if (n === null || !n.trim()) return; const p = await pxPrompt('📞 Contact no.', { def: r.phone || '', ok: 'I-save' }); if (p === null) return;
  try { await pxRsvUpd(id, () => ({ name: n.trim(), phone: p.trim(), prevName: r.name }), 'guest:' + r.name + '→' + n.trim()); pxBody(); } catch (e) { pxAlert('Error: ' + e.message); }
}
async function pxRsvMove(id) {
  const r = (PX.rsvAct || []).find(x => x.id === id); if (!r) return; await pxRsvLoad(true);
  const free = (PX.floor.tables || []).filter(t => !r.tables.some(x => x.id === t.id) && !pxRvOverlap(t.id, r.startMs, r.endMs, id).length);
  if (!free.length) { await pxAlert('Walang ibang table na libre sa oras na ito.'); return; }
  const k = await pxChoice('🔁 Ilipat sa anong table?', free.map(t => ({ k: t.id, label: (pxIsRoom(t) ? '🏛️ ' : '') + pxE(t.name), sub: '👥 ' + (t.seats || '-') + ' · ' + pxE(pxLayName(t.layout) || '') })), { cols: 3, hint: 'Libre lang ang ipinapakita sa ' + pxHM(r.startMs) + '–' + pxHM(r.endMs) + '. Papalitan nito ang lahat ng table ng reservation.' }); if (!k) return; const t = pxRvTbl(k);
  try { await pxRsvUpd(id, () => ({ tables: [{ id: t.id, name: t.name }] }), 'table:' + r.tables.map(x => x.name).join('/') + '→' + t.name); pxBody(); } catch (e) { pxAlert('Error: ' + e.message); }
}
/* ---------- Seat: buksan ang table at i-load ang advance order ---------- */
async function pxRsvSeat(id) {
  const r = (PX.rsvAct || []).find(x => x.id === id); if (!r) return;
  if (!PX.shift) { pxAlert('Buksan muna ang shift (araw) bago mag-seat.'); return; } if (pxShiftStale()) { pxAlert('Hindi pa na-Z-read ang ' + PX.shift.date + '. I-Z-read muna.'); return; }
  const tb = r.tables[0], t = pxRvTbl(tb.id); if (!t) { pxAlert('Wala na ang table na ' + tb.name + ' sa layout. Palitan ang table.'); return; }
  if (pxTabOf(t.id)) { pxAlert(t.name + ' ay may customer pa. Hintayin o ilipat ang reservation sa ibang table.'); return; }
  if (PX.cfg.tableMember && !r.member) { pxAlert('Kailangan ng membership sa table. I-Edit ang reservation at pumili ng Member, o buksan ang table sa karaniwang paraan.'); return; }
  if (r.startMs - Date.now() > 60 * 60000 && !await pxConfirm('Maaga pa ng ' + Math.round((r.startMs - Date.now()) / 60000) + ' minuto ang reservation. I-seat na ngayon?', { ok: 'Oo' })) return;
  const tabId = pxId('TB'), tab = { company: pxCo(), site: PX.site, siteName: pxSite().name || '', tableId: t.id, tableName: t.name, zone: pxZoneOf(t), layout: t.layout || '', pax: r.pax, member: r.member || null, status: 'open', openedAt: new Date().toISOString(), openedMs: Date.now(), openedBy: String(pxMe().email || ''), openedByName: String(pxMe().name || ''), orders: [], bills: [], bizDate: pxBiz(), lock: pxLockNew(), hist: [{ at: new Date().toISOString(), by: String(pxMe().email || ''), name: String(pxMe().name || ''), a: 'open', i: 'reservation ' + r.name }], rsvId: id, guest: r.name, guestNote: r.notes || '', roomSnap: pxRoomSnap(t) };
  try {
    await db.collection('pos_tabs').doc(tabId).set(tab); (PX.tabs = PX.tabs || []).push(Object.assign({ id: tabId }, tab));
    await pxRsvUpd(id, () => ({ status: 'seated', tabId, seatedAt: new Date().toISOString() }), 'seated');
    try { await logSystemAction('POS_RSV_SEATED', r.name + ' → ' + t.name); } catch (e) {}
    const extra = [r.notes ? '📝 ' + r.notes : '', +r.deposit > 0 ? '💵 Deposit ₱' + pxM(r.deposit) + (r.depositNote ? ' (' + r.depositNote + ')' : '') + ' — ibawas manually sa bill' : '', r.tables.length > 1 ? 'Kasama ang table: ' + r.tables.slice(1).map(x => x.name).join(', ') : ''].filter(Boolean).join('\n');
    if (extra) await pxAlert(extra, '🪑 ' + r.name + ' · ' + t.name);
    if ((r.adv || []).length) { PX.ctx = { mode: 'order', tabId, chan: 'dine', owner: r.member ? { name: r.member.name, mid: r.member.mid, member: r.member } : { name: r.name } }; PX.cart = r.adv.map(l => ({ id: l.id, name: l.name, price: +l.price || 0, qty: +l.qty || 1, note: l.note || '' })); pxResetPay(); PX.tab = 'pos'; pxClose(); pxToast('🧾 Na-load ang advance order. Suriin at i-Ipadala sa kusina.'); pxRender(); }
    else { PX.tab = 'tables'; pxRender(); }
  } catch (e) { pxAlert('Error: ' + e.message); }
}

/* ====================== ANTI-ZOOM · TABLE LOCK · DINE-IN/TAKE-OUT · OWNER · LANES · HISTORY ====================== */
try { if (!document.getElementById('px-css')) { const st = document.createElement('style'); st.id = 'px-css'; st.textContent = '#pos-root,#pos-root *,[id^="px-"],[id^="px-"] *{touch-action:manipulation;-webkit-tap-highlight-color:transparent}#px-body,#px-body button{-webkit-user-select:none;user-select:none}[id^="px-"] input,[id^="px-"] textarea{-webkit-user-select:text;user-select:text}'; document.head.appendChild(st); } } catch (e) {}
const PX_CHL = { dine: '🍽️ DINE-IN', take: '🥡 TAKE-OUT', fp: '🐼 FOODPANDA', grab: '🟢 GRABFOOD' };
function pxChItems(items) { // maglagay ng heading kapag halo ang Dine-in at Take-out sa iisang resibo
  const L = (items || []).slice(); const set = [...new Set(L.map(l => l.ch).filter(Boolean))]; if (set.length < 2) return L;
  const ord = ['dine', 'take', 'fp', 'grab'], out = []; ord.concat(set.filter(x => !ord.includes(x))).forEach(c => { const g = L.filter(l => (l.ch || 'dine') === c); if (g.length) { out.push({ _h: (PX_CHL[c] || c).replace(/^\S+\s/, '') }); g.forEach(x => out.push(x)); } }); return out;
}
function pxSplitByOwner(lines) {
  const ows = [...new Set(lines.map(l => l.ow || ''))]; if (ows.length < 2 && !(ows[0])) return [{ id: 'b1', name: 'Bill 1', status: 'open', lines }];
  if (ows.length === 1) return [{ id: 'b1', name: ows[0], status: 'open', lines, member: (lines[0] || {}).om || null }];
  return ows.map((o, i) => { const g = lines.filter(l => (l.ow || '') === o); return { id: 'b' + (i + 1), name: o || 'Table', status: 'open', lines: g, member: (g.find(x => x.om) || {}).om || null }; });
}
/* ---------- Table lock ---------- */
const pxDev = () => { try { let d = sessionStorage.getItem('px_dev'); if (!d) { d = Math.random().toString(36).slice(2, 8); sessionStorage.setItem('px_dev', d); } return d; } catch (e) { return 'dev'; } };
const PX_LOCK_MS = 10 * 60000;
const pxLockNew = () => ({ by: String(pxMe().email || ''), name: String(pxMe().name || pxMe().email || ''), dev: pxDev(), ms: Date.now() });
const pxLockFresh = t => !!(t && t.lock && Date.now() - (t.lock.ms || 0) < PX_LOCK_MS);
const pxLockMine = t => !!(t && t.lock && t.lock.dev === pxDev() && t.lock.by === String(pxMe().email || ''));
const pxLockOther = t => (pxLockFresh(t) && !pxLockMine(t)) ? t.lock : null;
async function pxLockEnsure(id) { const t = (PX.tabs || []).find(x => x.id === id); if (t && pxLockMine(t) && pxLockFresh(t)) { PX._lk = id; return true; } return pxLockGet(id); }
async function pxLockGet(id) {
  try {
    const r = db.collection('pos_tabs').doc(id), d = (await r.get()).data(); if (!d) return false; const o = pxLockOther(d);
    if (o) { if (!await pxConfirm(`Hawak ni ${o.name} ang table na ito (${pxHM(o.ms)}). Para ma-takeover kailangan ng code ng manager. Ituloy?`, { ok: 'Takeover', title: '✋ May gumagamit', danger: true })) return false; if (!await pxPin('Takeover ng table mula kay ' + o.name + '.')) return false; }
    const hist = (d.hist || []).concat(o ? [{ at: new Date().toISOString(), by: String(pxMe().email || ''), name: String(pxMe().name || ''), a: 'takeover', i: 'mula kay ' + o.name }] : []), lk = pxLockNew();
    await r.update({ lock: lk, hist }); const i = (PX.tabs || []).findIndex(x => x.id === id); if (i >= 0) PX.tabs[i] = Object.assign({}, PX.tabs[i], { lock: lk, hist }); PX._lk = id; if (o) { try { await logSystemAction('POS_TABLE_TAKEOVER', (d.tableName || id) + ' mula kay ' + o.name); } catch (e) {} } return true;
  } catch (e) { pxAlert('Error: ' + e.message); return false; }
}
async function pxLockRel(id) {
  if (!id) return; if (PX._lk === id) PX._lk = null;
  try { const r = db.collection('pos_tabs').doc(id), d = (await r.get()).data(); if (d && pxLockMine(d)) { await r.update({ lock: null }); const i = (PX.tabs || []).findIndex(x => x.id === id); if (i >= 0) PX.tabs[i] = Object.assign({}, PX.tabs[i], { lock: null }); } } catch (e) {}
}
const _pxClose0 = pxClose; pxClose = function () { const id = PX._lk; _pxClose0(); if (id && !(PX.ctx && PX.ctx.tabId === id)) { pxLockRel(id); if (PX.tab === 'tables') { try { pxLiveRepaint && pxLiveRepaint(); } catch (e) {} } } };
setInterval(() => { try { if (PX._lk && db) { const t = (PX.tabs || []).find(x => x.id === PX._lk); if (t && pxLockMine(t)) { db.collection('pos_tabs').doc(PX._lk).update({ 'lock.ms': Date.now() }).catch(() => {}); t.lock.ms = Date.now(); } } } catch (e) {} }, 60000);
/* ---------- Bagong order: Dine-in / Take-out + para kanino ---------- */
async function pxOwnerPick(t) {
  const seen = {}; (t.orders || []).forEach(o => { if (o.owner && o.owner.name && o.status !== 'void') seen[o.owner.name] = o.owner; });
  const opts = [{ k: '__none', label: '👥 Buong table', sub: 'walang hiwalay na customer' }].concat(Object.keys(seen).map(n => ({ k: 'o:' + n, label: '👤 ' + pxE(n), sub: 'dagdag na order' })), [{ k: '__new', label: '➕ Bagong customer / upuan', sub: 'hal. Ana, Seat 2' }, { k: '__mem', label: '🪪 Member', sub: 'hanapin ang member' }]);
  const k = await pxChoice('👤 Para kanino ang order na ito?', opts, { cols: 2, hint: 'Para iwas split-bill: ang bawat customer ay may sariling order at sariling bill. Alam din ng crew kung kanino ang order.' }); if (k === null || k === undefined) return undefined;
  if (k === '__none') return null; if (String(k).startsWith('o:')) return seen[String(k).slice(2)] || null;
  if (k === '__new') { const n = await pxPrompt('Pangalan o upuan', { ph: 'hal. Ana / Seat 2', ok: 'OK' }); if (n === null || !n.trim()) return undefined; return { name: n.trim() }; }
  return await new Promise(res => { pxMemCheck(m => res(m ? { name: m.name, mid: m.mid, member: pxMemSnap(m) } : undefined), '✔ Para sa order na ito'); });
}
async function pxTabOrder(id) {
  const t = (PX.tabs || []).find(x => x.id === id); if (!t) return; if (!await pxLockEnsure(id)) return; let chan, owner = null;
  const ex = (t.orders || []).filter(o => o.status !== 'void');
  if (ex.length) { // may existing na order: puwedeng dagdagan (hindi bagong order/resibo) o gumawa ng bago
    const pick = await pxChoice('➕ Dagdag order — alin?', [{ k: 'new', label: '🆕 Bagong order', sub: 'Order ' + ((t.orders || []).length + 1) + ' (hiwalay na listahan, iisang resibo pa rin)' }].concat(ex.map(o => ({ k: 'o' + o.no, label: '📋 Order ' + o.no + ' — dagdagan', sub: (o.chan === 'take' ? '🥡 ' : o.chan === 'dine' ? '🍽️ ' : '') + ((o.owner || {}).name ? '👤 ' + o.owner.name + ' · ' : '') + (o.items || []).map(l => l.qty + '× ' + l.name).join(', ').slice(0, 70) }))), { cols: 1, hint: 'Pumili ng existing na order para dagdagan (hal. nagpadagdag ang customer pagkalipas ng 20 minuto). Mananatili ito sa iisang order number at iisang resibo.' }); if (!pick) return;
    if (pick !== 'new') { const o = ex.find(x => 'o' + x.no === pick); PX.ctx = { mode: 'order', tabId: id, chan: o.chan, owner: o.owner || null, addTo: o.no }; PX.cart = []; pxResetPay(); PX.tab = 'pos'; pxClose(); pxRender(); return; }
  }
  if (t.lane) chan = t.chan;
  else { chan = await pxChoice('➕ Bagong order — saan ito?', [{ k: 'dine', label: '🍽️ Dine-in', sub: 'kakain dito' }, { k: 'take', label: '🥡 Take-out', sub: 'bibitbitin' }], { cols: 2, hint: 'Puwedeng pagsamahin ang Dine-in at Take-out sa iisang table — isang resibo, isang bayad. Ihihiwalay lang ang listahan sa resibo.' }); if (!chan) return; owner = await pxOwnerPick(t); if (owner === undefined) return; }
  PX.ctx = { mode: 'order', tabId: id, chan, owner }; PX.cart = []; pxResetPay(); PX.tab = 'pos'; pxClose(); pxRender();
}
function pxOrdChan() { const c = PX.ctx; if (!c || c.mode !== 'order') return; const t = pxCtxTab() || {}; if (t.lane) return; c.chan = c.chan === 'dine' ? 'take' : 'dine'; const L = pxMenuItems(), drop = []; PX.cart = PX.cart.filter(l => { const m = L.find(x => x.id === l.id); if (!m) { drop.push(l.name); return false; } if (!l.ovr) l.price = m._price; return true; }); if (drop.length) pxAlert('Hindi ibinebenta sa ' + (c.chan === 'take' ? 'Take-out' : 'Dine-in') + ': ' + drop.join(', ') + '. Inalis sa cart.'); pxBody(); }
function pxOrderPane() {
  const t = pxCtxTab() || {}, n = (PX.ctx && PX.ctx.addTo) ? PX.ctx.addTo : (t.orders || []).length + 1, sub = pxR2(PX.cart.reduce((s, l) => s + l.price * l.qty, 0)), c = PX.ctx || {}, chl = c.chan === 'dine' ? '🍽️ Dine-in' : c.chan === 'take' ? '🥡 Take-out' : ((PX_CH[c.chan] || {}).i || '') + ' ' + ((PX_CH[c.chan] || {}).n || '');
  const prev = (t.orders || []).filter(o => o.status !== 'void').map(o => `<div style="font-size:.78rem;border-bottom:1px dashed #e2e8f0;padding:.15rem 0;color:#475569;"><b>Order ${o.no}</b> ${o.chan === 'take' ? '🥡' : o.chan === 'dine' ? '🍽️' : ''}${(o.owner || {}).name ? ' 👤 ' + pxE(o.owner.name) : ''} · ${(o.items || []).map(l => l.qty + '× ' + pxE(l.name)).join(', ')} <b>₱${pxM((o.items || []).reduce((s, l) => s + l.qty * l.price, 0))}</b></div>`).join('');
  return `<div class="card" style="position:sticky;top:.5rem;"><b>${t.lane ? ((PX_CH[t.chan] || {}).i || '🥡') : '🍽️'} ${pxE(t.tableName)} — Order ${n}${PX.ctx && PX.ctx.addTo ? ' <span style="background:#fef3c7;border-radius:1rem;padding:.05rem .5rem;font-size:.75rem;">➕ dagdag</span>' : ''}</b> <small style="color:#64748b;">${t.lane ? (t.platRef ? '#' + pxE(t.platRef) : '') : '👥 ' + (t.pax || '')}${t.member ? ' · 🪪 ' + pxE(t.member.name) : ''}</small>
  <div style="display:flex;gap:.3rem;flex-wrap:wrap;align-items:center;margin:.3rem 0;"><span style="border-radius:1rem;padding:.1rem .6rem;background:${c.chan === 'dine' ? '#dcfce7' : '#fef3c7'};font-weight:700;">${chl}</span>${(c.owner || {}).name ? `<span style="border-radius:1rem;padding:.1rem .6rem;background:#e0e7ff;font-weight:700;">👤 ${pxE(c.owner.name)}</span>` : ''}${t.lane ? '' : `<button class="btn btn-secondary btn-sm" onclick="pxOrdChan()">↔ ${c.chan === 'dine' ? 'Gawing Take-out' : 'Gawing Dine-in'}</button>`}</div>
  ${prev ? `<details style="margin-bottom:.3rem;"><summary style="cursor:pointer;font-size:.82rem;font-weight:700;">📋 Mga naunang order ng table (${(t.orders || []).filter(o => o.status !== 'void').length})</summary>${prev}</details>` : ''}
  ${pxHint('Pumili ng item sa kaliwa. Gamitin ang <b>📝</b> para sa espesyal na tagubilin. Pindutin ang <b>📤 Ipadala</b> — naka-background ang pag-print sa kusina, kaya puwede ka nang magpatuloy agad.')}
  ${PX.cart.length ? '' : '<div style="color:#94a3b8;padding:.6rem;">Wala pang napili.</div>'}${PX.cart.map((l, i) => `<div style="display:flex;gap:.3rem;align-items:center;border-bottom:1px solid #f1f5f9;padding:.25rem 0;font-size:.88rem;"><span style="flex:1;">${pxE(l.name)}${l.note ? '<br><small style="color:#b45309;">📝 ' + pxE(l.note) + '</small>' : ''}</span><button class="btn btn-secondary btn-sm" onclick="pxLineNote(${i})">📝</button><button class="btn ${(l.course || 1) > 1 ? 'btn-primary' : 'btn-secondary'} btn-sm" title="Course (i-click para palitan)" onclick="pxLineCourse(${i})">C${l.course || 1}</button><button class="btn btn-secondary btn-sm" onclick="pxQty(${i},-1)">−</button><b>${l.qty}</b><button class="btn btn-secondary btn-sm" onclick="pxQty(${i},1)">+</button><span style="width:62px;text-align:right;">${pxM(l.price * l.qty)}</span></div>`).join('')}
  <div style="display:flex;justify-content:space-between;font-weight:800;margin:.4rem 0;"><span>Order ${n}</span><span>₱${pxM(sub)}</span></div>
  <div style="display:flex;gap:.4rem;">${pxBtn('btn-secondary', '← Bumalik', 'pxCtxExit(true)', 'flex:1;padding:.7rem;')}${pxBtn('btn-success', '📤 Ipadala sa kusina', 'pxOrderSend()', 'flex:2;padding:.7rem;')}</div></div>`;
}
let PX_SENDING = false;
async function pxOrderSend() {
  if (PX_SENDING) return; if (pxShiftStale()) { pxAlert('Hindi pa na-Z-read ang ' + PX.shift.date + '. I-Z-read muna bago mag-order.'); return; }
  const t = pxCtxTab(); if (!t) return; if (!PX.cart.length) { await pxAlert('Wala pang napiling item.'); return; }
  if (!await pxCutGuard('table order')) return;
  await pxOffLoad(); const offs = PX.cart.filter(l => pxIsOff(l.id)); if (offs.length) { await pxAlert('Sold out na ang: ' + offs.map(l => l.name).join(', ') + '.\nAlisin sa order bago ipadala.', '🚫 Hindi available'); return; }
  PX_SENDING = true; const now = new Date(), me = pxMe(), c = PX.ctx || {}, chan = c.chan || 'dine', owner = c.owner || null;
  try {
    let no = 0; const addTo = c.addTo || 0, newItems = PX.cart.map(l => ({ id: l.id, name: l.name, price: l.price, qty: l.qty, note: l.note || '', course: l.course || 1, held: (l.course || 1) > 1 }));
    if (addTo) { // dagdag sa existing na order (iisang order number)
      let found = false; const n = await pxTabMut(t.id, d => { const o = (d.orders || []).find(x => x.no === addTo && x.status !== 'void'); if (!o) return; found = true; no = addTo; o.items = (o.items || []).slice(); newItems.forEach(li => { o.items.push(Object.assign({}, li, { addAt: now.toISOString(), addBy: String(me.email || '') })); }); o.adds = (o.adds || []).concat([{ at: now.toISOString(), by: String(me.email || ''), byName: String(me.name || ''), n: newItems.length }]); }, { a: 'order-add', i: 'Order ' + addTo + ' +' + newItems.length + ' item' });
      if (!found) { await pxAlert('Wala na ang Order ' + addTo + ' (na-void o nabayaran na). Gumawa ng bagong order.'); return; }
      const ord = n.orders.find(x => x.no === addTo); PX.ctx = null; PX.cart = []; PX.tab = 'tables'; pxLockRel(t.id); pxToast('📤 Dagdag sa Order ' + no + ' → kusina…'); pxRender(); pxKitchenBg(n, Object.assign({}, ord, { items: newItems }), no, false, true); return;
    }
    no = 0; const n = await pxTabMut(t.id, d => { no = (d.orders || []).length + 1; (d.orders = d.orders || []).push({ no, at: now.toISOString(), atMs: now.getTime(), by: String(me.email || ''), byName: String(me.name || ''), status: 'sent', chan, owner, items: PX.cart.map(l => ({ id: l.id, name: l.name, price: l.price, qty: l.qty, note: l.note || '', course: l.course || 1, held: (l.course || 1) > 1 })) }); }, { a: 'order', i: '#' + (((t.orders || []).length) + 1) + ' ' + chan });
    const ord = n.orders[no - 1]; PX.ctx = null; PX.cart = []; PX.tab = 'tables'; pxLockRel(t.id); pxToast('📤 Order ' + no + ' → kusina (background)…'); pxRender();
    pxKitchenBg(n, ord, no);
  } catch (e) { pxAlert('Error: ' + e.message); } finally { PX_SENDING = false; }
}
function pxOrdRef(n, ord) { return [ord.chan === 'take' ? 'TAKE-OUT' : ord.chan === 'fp' ? 'FOODPANDA' : ord.chan === 'grab' ? 'GRABFOOD' : '', (ord.owner || {}).name || '', n.lane && n.platRef ? '#' + n.platRef : ''].filter(Boolean).join(' · '); }
async function pxKitchenBg(n, ord, no, reprint, add) { // tumatakbo sa background; hindi hinaharangan ang cashier
  try {
    if ((ord.items || []).some(x => x.held)) { ord = Object.assign({}, ord, { items: ord.items.filter(x => !x.held) }); if (!ord.items.length) { pxToast('⏳ Order ' + no + ': naka-hold ang Course 2/3 — pindutin ang 🔥 Fire sa table'); return; } }
    const kr = await pxKitchenSend({ type: 'table', tableName: n.tableName || '', zone: n.zone || '', pax: n.pax || 0, orderNo: no, ref: (reprint ? 'REPRINT ' : add ? 'DAGDAG ' : '') + pxOrdRef(n, ord), items: ord.items });
    if (kr.n === 0 || kr.loose.length) { const li = kr.n ? kr.loose : ord.items; pxPrint(pxLinesHtml(pxKitchenLines({ type: 'table', table: n.tableName || '', zone: n.zone || '', pax: n.pax || 0, orderNo: no, ref: (add ? 'DAGDAG ' : '') + pxOrdRef(n, ord), reprint: !!reprint, at: new Date(ord.atMs || ord.at || Date.now()).toISOString(), by: String(ord.byName || ord.by || ''), items: (li || []).map(l => ({ qty: l.qty, name: l.name, note: l.note })) }, 'Kusina', PX.cfg.paper === '58' ? 32 : 48), PX.cfg.paper === '58' ? 32 : 48, { print: true })); }
    pxToast((reprint ? '🔁 ' : '✅ ') + 'Order ' + no + (kr.n ? ' → ' + kr.stations.join(', ') : '') + (kr.off ? ' (⚠ offline ang Print Agent — sa browser nai-print)' : ''));
    if (kr.err) pxAlert('Hindi naipadala sa station printer: ' + kr.err + '\nNaka-save ang order; i-print muli sa 🔁 Kusina.');
  } catch (e) { pxAlert('Hindi nai-print ang order ' + no + ': ' + e.message + '\nNaka-save ang order; pindutin ang 🔁 Kusina para i-print muli.'); }
}
async function pxOrderReprint(tabId, i) {
  const t = (PX.tabs || []).find(x => x.id === tabId), o = t && t.orders[i]; if (!o || o.status === 'void') return;
  if (!await pxConfirm('I-print ulit ang Order ' + o.no + ' sa kusina? (Para sa order na hindi pa lumalabas.) Makikita sa ticket ang *** REPRINT ***.', { ok: 'I-print' })) return;
  try { await pxTabMut(tabId, d => {}, { a: 'reprint', i: 'Order ' + o.no }); } catch (e) { pxAlert('Error: ' + e.message); return; } pxToast('🔁 Ipinapadala…'); pxKitchenBg(t, o, o.no, true);
}
async function pxLineDisc(i) {
  const l = PX.cart[i]; if (!l) return; if (!await pxPin('Kailangan ng code ng Manager para sa discount ng item.')) return;
  const v = await pxPrompt('🏷️ Discount sa item — ' + l.name, { label: '% o ₱ (hal. 20% o 15)', hint: '"20%" = 20% off sa presyo. "15" = ₱15 off kada piraso. Nagiging bagong presyo ito at makikita sa resibo. Para sa discount ng buong bill, gamitin ang Manual sa kanan.', ok: 'I-apply' }); if (v === null) return;
  const s = String(v).trim(), cur = +l.price; let np = /%\s*$/.test(s) ? cur * (1 - pxNum(s) / 100) : cur - pxNum(s); np = pxR2(Math.max(0, np)); if (!(pxNum(s) > 0)) return;
  if (!l.ovr) l.orig = l.price; l.price = np; l.ovr = np !== l.orig; if (!l.ovr) delete l.orig; PX.pays = []; pxBody();
}
/* ---------- Take-out / Foodpanda / Grab lane ---------- */
async function pxLaneOpen(T) {
  if (!PX.shift) { pxAlert('Buksan muna ang shift (araw).'); return; } if (pxShiftStale()) { pxAlert('Hindi pa na-Z-read ang ' + PX.shift.date + '. I-Z-read muna.'); return; }
  let ref = ''; const ch = PX_CH[T.out] || { n: 'Take-out' };
  if (ch.app) { const v = await pxPrompt('🧾 Order No. ng ' + ch.n, { ph: 'hal. GF-1234', ok: 'Buksan' }); if (v === null || !v.trim()) return; ref = v.trim(); }
  const id = pxId('TB'), me = pxMe(), tab = { company: pxCo(), site: PX.site, siteName: pxSite().name || '', tableId: T.id, tableName: T.name, zone: pxZoneOf(T), layout: T.layout || '', pax: 0, member: null, status: 'open', openedAt: new Date().toISOString(), openedMs: Date.now(), openedBy: String(me.email || ''), openedByName: String(me.name || ''), orders: [], bills: [], lane: true, chan: T.out, platRef: ref, bizDate: pxBiz(), lock: pxLockNew(), hist: [{ at: new Date().toISOString(), by: String(me.email || ''), name: String(me.name || ''), a: 'open', i: (ch.n || '') + (ref ? ' #' + ref : '') }] };
  try { await db.collection('pos_tabs').doc(id).set(tab); (PX.tabs = PX.tabs || []).push(Object.assign({ id }, tab)); PX._lk = id; PX.ctx = { mode: 'order', tabId: id, chan: T.out, owner: null }; PX.cart = []; pxResetPay(); PX.tab = 'pos'; pxRender(); } catch (e) { pxAlert('Error: ' + e.message); }
}
/* ---------- Table history (para sa manager/admin) ---------- */
const PX_HA = { open: '🟢 Binuksan', member: '🪪 Member', move: '🔁 Inilipat', cancel: '⛔ Na-cancel ang table', void: '❌ VOID order', billprint: '🖨️ Print Bill', takeover: '✋ TAKEOVER', reprint: '🔁 Reprint sa kusina', order: '' };
async function pxHistView() {
  if (!PX.hdate) PX.hdate = pxBiz(); const d = PX.hdate, tabs = [], sales = [];
  try { const s = await db.collection('pos_tabs').where('site', '==', PX.site).where('bizDate', '==', d).get(); s.forEach(x => tabs.push(Object.assign({ id: x.id }, x.data()))); } catch (e) {}
  try { const s = await db.collection('pos_sales').where('site', '==', PX.site).where('date', '==', d).get(); s.forEach(x => sales.push(Object.assign({ id: x.id }, x.data()))); } catch (e) {}
  const q = String(PX.hq || '').toLowerCase().trim(), exOnly = !!PX.hexc, ms = x => (typeof x === 'number' ? x : Date.parse(x || '')) || 0;
  const saleEv = s => { const ev = [], disc = s.disc && s.disc.type && s.disc.type !== 'none', ovr = (s.items || []).filter(i => i.ovr);
    ev.push({ ms: s.atMs || ms(s.at), ic: '💳', t: `Bayad ${pxE(s.no)} · ₱${pxM(s.total)} · cashier ${pxE(s.cashier || '')}${s.billNo && s.billCount > 1 ? ' · Bill ' + s.billNo + '/' + s.billCount : ''}`, ex: false });
    if (disc) ev.push({ ms: (s.atMs || ms(s.at)) + 1, ic: '🏷️', t: `DISCOUNT: ${pxE((s.disc || {}).label || s.disc.type)} ${s.disc.name ? '· ' + pxE(s.disc.name) : ''} ${s.disc.id ? '· ID ' + pxE(s.disc.id) : ''}`, ex: true });
    if (ovr.length) ev.push({ ms: (s.atMs || ms(s.at)) + 2, ic: '✏️', t: 'BINAGONG PRESYO: ' + ovr.map(i => pxE(i.name) + ' ' + pxM(i.orig) + '→' + pxM(i.price)).join(', '), ex: true });
    if (s.status === 'void') ev.push({ ms: ms((s.void || {}).at) || (s.atMs || 0) + 3, ic: '🚫', t: `VOID ${pxE(s.no)} ni ${pxE((s.void || {}).by || '')}: ${pxE((s.void || {}).reason || '')}`, ex: true }); return ev; };
  const tabEv = t => { const ev = []; (t.orders || []).forEach(o => { const lab = o.chan === 'take' ? '🥡 Take-out' : o.chan === 'dine' ? '🍽️ Dine-in' : o.chan ? ((PX_CH[o.chan] || {}).n || o.chan) : '';
      ev.push({ ms: o.atMs || ms(o.at), ic: '📤', t: `<b>Order ${o.no}</b> ${lab}${(o.owner || {}).name ? ' · 👤 ' + pxE(o.owner.name) : ''} — ni <b>${pxE(o.byName || o.by)}</b>: ${(o.items || []).map(l => l.qty + '× ' + pxE(l.name) + (l.note ? ' (' + pxE(l.note) + ')' : '')).join(', ')}`, ex: false });
      if (o.status === 'void') ev.push({ ms: ms(o.voidAt), ic: '❌', t: `VOID Order ${o.no} ni ${pxE(o.voidBy || '')}: ${pxE(o.voidReason || '')}`, ex: true }); });
    (t.hist || []).forEach(h => { if (h.a === 'order' || h.a === 'void') return; ev.push({ ms: ms(h.at), ic: '', t: `${PX_HA[h.a] || pxE(h.a)} — ${pxE(h.name || h.by)}${h.i ? ' · ' + pxE(h.i) : ''}`, ex: ['takeover', 'cancel', 'move'].includes(h.a) }); });
    sales.filter(s => s.tabId === t.id).forEach(s => saleEv(s).forEach(e => ev.push(e))); return ev.sort((a, b) => a.ms - b.ms); };
  let cards = tabs.sort((a, b) => (a.openedMs || 0) - (b.openedMs || 0)).map(t => ({ t, ev: tabEv(t) }));
  cards = cards.filter(c => { const hay = (c.t.tableName + ' ' + c.ev.map(e => e.t).join(' ')).toLowerCase().replace(/<[^>]+>/g, ''); return (!q || q.split(/\s+/).every(w => hay.includes(w))) && (!exOnly || c.ev.some(e => e.ex)); });
  const loose = sales.filter(s => !s.tabId).filter(s => { const ev = saleEv(s); const hay = (s.no + ' ' + (s.cashier || '') + ' ' + ev.map(e => e.t).join(' ')).toLowerCase(); return (!q || q.split(/\s+/).every(w => hay.includes(w))) && (!exOnly || ev.some(e => e.ex)); });
  const shift = n => { const x = new Date(d + 'T00:00:00'); x.setDate(x.getDate() + n); return x.toLocaleDateString('en-CA'); };
  return pxHint('📖 <b>Table History</b>: lahat ng ginawa sa mga table sa araw na pinili — sino ang nag-punch ng order, kailan, sino ang nag-void, nag-takeover, nag-discount, nagbago ng presyo, at nag-settle. Gamitin ang <b>⚠️ Exceptions lang</b> para makita agad ang mga kakaiba (void, discount, takeover, binagong presyo).') + `
  <div style="display:flex;gap:.3rem;flex-wrap:wrap;align-items:center;margin-bottom:.4rem;">${pxBtn('btn-secondary btn-sm', '◀', `PX.hdate='${shift(-1)}';pxBody()`)}<input type="date" value="${d}" onchange="PX.hdate=this.value;pxBody()">${pxBtn('btn-secondary btn-sm', '▶', `PX.hdate='${shift(1)}';pxBody()`)}${pxBtn('btn-secondary btn-sm', 'Ngayon', `PX.hdate='${pxBiz()}';pxBody()`)}<input type="search" placeholder="🔎 table, crew, order…" value="${pxE(PX.hq || '')}" onchange="PX.hq=this.value;pxBody()" style="flex:1;min-width:140px;"><label style="font-size:.82rem;"><input type="checkbox" ${exOnly ? 'checked' : ''} onchange="PX.hexc=this.checked;pxBody()"> ⚠️ Exceptions lang</label></div>
  <div style="font-weight:700;margin-bottom:.3rem;">${cards.length} table session · ${loose.length} counter sale</div>
  ${cards.map(c => `<div style="border:1px solid #e2e8f0;border-radius:.5rem;padding:.4rem .6rem;margin-bottom:.4rem;"><div style="display:flex;justify-content:space-between;flex-wrap:wrap;"><b>${c.t.lane ? ((PX_CH[c.t.chan] || {}).i || '🥡') : '🍽️'} ${pxE(c.t.tableName)} ${c.t.guest ? '· 📅 ' + pxE(c.t.guest) : ''}</b><small style="color:#64748b;">${pxE(c.t.status)} · ${pxHM(c.t.openedMs || 0)}${c.t.closedAt ? ' – ' + pxHM(ms(c.t.closedAt)) : ''}</small></div>${c.ev.map(e => `<div style="font-size:.82rem;padding:.12rem 0;${e.ex ? 'background:#fef2f2;border-radius:.25rem;padding-left:.3rem;color:#991b1b;' : ''}"><small style="color:#64748b;">${e.ms ? pxHM(e.ms) : ''}</small> ${e.ic} ${e.t}</div>`).join('')}</div>`).join('') || '<div style="color:#94a3b8;text-align:center;padding:1rem;">Walang table session.</div>'}
  ${loose.length ? `<div style="font-weight:700;margin:.5rem 0 .2rem;">🛒 Counter sales</div>` + loose.map(s => `<div style="border:1px solid #e2e8f0;border-radius:.5rem;padding:.3rem .6rem;margin-bottom:.3rem;">${saleEv(s).map(e => `<div style="font-size:.82rem;${e.ex ? 'background:#fef2f2;color:#991b1b;padding-left:.3rem;border-radius:.25rem;' : ''}"><small style="color:#64748b;">${e.ms ? pxHM(e.ms) : ''}</small> ${e.ic} ${e.t}</div>`).join('')}</div>`).join('') : ''}`;
}

// ===== Member search index: sorted tokens + binary search (prefix), parang search engine =====
function pxNorm(s) { return String(s == null ? '' : s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); }
function pxMsBuild() {
  const M = PX.members || [], A = [];
  M.forEach((m, i) => { new Set(pxNorm((m.mid || '') + ' ' + (m.name || '') + ' ' + (m.club || '')).split(/[^a-z0-9ñ]+/).filter(Boolean)).forEach(t => A.push([t, i])); });
  A.sort((a, b) => a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : a[1] - b[1]);
  PX._ms = { src: M, n: M.length, A };
  return PX._ms;
}
// pinakaunang posisyon na ang token >= p (binary search: hahatiin sa gitna hanggang matunton)
function pxMsLower(A, p) { let lo = 0, hi = A.length; while (lo < hi) { const mid = (lo + hi) >> 1; if (A[mid][0] < p) lo = mid + 1; else hi = mid; } return lo; }
function pxMemSearch(q) {
  const M = PX.members || [], words = pxNorm(q).split(/[^a-z0-9ñ]+/).filter(Boolean); if (!words.length) return M.slice();
  const X = PX._ms && PX._ms.src === M && PX._ms.n === M.length ? PX._ms : pxMsBuild(), A = X.A; let acc = null;
  for (const w of words) {
    const set = new Set(); let i = pxMsLower(A, w);
    for (; i < A.length && A[i][0].startsWith(w); i++) set.add(A[i][1]);
    if (!set.size) { for (let j = 0; j < A.length; j++) if (A[j][0].includes(w)) set.add(A[j][1]); } // hindi prefix: hanapin sa gitna ng salita
    acc = acc ? new Set([...acc].filter(x => set.has(x))) : set; if (!acc.size) break;
  }
  const first = words[0];
  return [...acc].map(i => M[i]).sort((a, b) => { const sa = (pxNorm(a.mid) === first ? 0 : pxNorm(a.name).startsWith(first) ? 1 : 2), sb = (pxNorm(b.mid) === first ? 0 : pxNorm(b.name).startsWith(first) ? 1 : 2); return sa - sb || String(a.name).localeCompare(String(b.name)); });
}

/* ================= VOUCHERS =================
   - Nirerehistro ng Admin / Super Admin (code, halaga, pangalan ng may-ari, expiry).
   - Isang beses lang magagamit. Walang sukli kapag mas malaki ang voucher sa bill (nawawala ang sobra).
   - Kapag kulang ang voucher, ang balanse ay babayaran ng cash/card/e-wallet.
   - Bawal gamitin kasama ng discount. */
PX_MODES.voucher = '🎟️ Voucher'; PX_PAYGROUPS.push(['Voucher', ['voucher']]);
function pxVAdmin() { return PX.role === 'admin' || (typeof superAdminIsMe === 'function' && superAdminIsMe()); }
let PX_VCH = { list: [], at: 0, q: '', st: '' };
const pxVKey = c => String(c || '').toUpperCase().replace(/[^A-Z0-9-]/g, '');
function pxVSt(v) { if (v.status === 'used') return 'used'; if (v.status === 'void') return 'void'; if (v.status === 'pending') return 'pending'; if (v.expires && v.expires < pxBiz()) return 'expired'; return 'active'; }
const PX_VST = { active: ['✅ Active', '#166534'], used: ['✔️ Nagamit na', '#475569'], void: ['⛔ Void', '#b91c1c'], expired: ['⌛ Expired', '#b45309'], pending: ['⏳ Pending', '#b45309'] };
async function pxVchLoad(force) { if (!force && Date.now() - PX_VCH.at < 15000) return; const s = await db.collection('pos_vouchers').where('company', '==', pxCo()).get(); PX_VCH.list = []; s.forEach(d => PX_VCH.list.push(Object.assign({ id: d.id }, d.data()))); PX_VCH.at = Date.now(); }
async function pxVchView() {
  if (!pxVAdmin()) return pxHint('Admin o Super Admin lang ang may access sa Vouchers.');
  try { await pxVchLoad(true); } catch (e) { return '<div style="color:#dc2626;">Error: ' + pxE(e.message) + '</div>'; }
  const q = pxNorm(PX_VCH.q).split(/\s+/).filter(Boolean), L = PX_VCH.list.filter(v => (!PX_VCH.st || pxVSt(v) === PX_VCH.st) && q.every(w => pxNorm(v.code + ' ' + v.holder + ' ' + (v.note || '') + ' ' + (v.usedSaleNo || '')).includes(w))).sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || ''))), cnt = {}; PX_VCH.list.forEach(v => { const s = pxVSt(v); cnt[s] = (cnt[s] || 0) + 1; });
  const tot = k => pxM(PX_VCH.list.filter(v => pxVSt(v) === k).reduce((s, v) => s + (+v.value || 0), 0));
  return pxHint('🎟️ <b>Vouchers</b> — Admin/Super Admin lang ang puwedeng magrehistro. Isang beses lang magagamit; <b>walang sukli</b> kung mas malaki ang voucher sa bill; hindi puwede sa order na may discount. Makikita dito kung nagamit na at kanino nakapangalan.') + `<div style="display:flex;gap:.4rem;margin-bottom:.5rem;flex-wrap:wrap;"><input type="search" placeholder="🔎 Code, pangalan, tala" value="${pxE(PX_VCH.q)}" oninput="PX_VCH.q=this.value;clearTimeout(PX._vt);PX._vt=setTimeout(pxBody,350)" style="flex:1;min-width:160px;"><button class="btn btn-primary btn-sm" onclick="pxVchForm()">➕ Mag-rehistro ng voucher</button><button class="btn btn-secondary btn-sm" onclick="pxVchCsv()">⬇️ Export</button></div>
  <div style="display:flex;gap:.3rem;margin-bottom:.4rem;flex-wrap:wrap;">${[['', 'Lahat (' + PX_VCH.list.length + ')'], ['active', '✅ Active (' + (cnt.active || 0) + ') ₱' + tot('active')], ['used', '✔️ Nagamit (' + (cnt.used || 0) + ')'], ['expired', '⌛ Expired (' + (cnt.expired || 0) + ')'], ['void', '⛔ Void (' + (cnt.void || 0) + ')']].map(([k, l]) => `<button class="btn ${PX_VCH.st === k ? 'btn-primary' : 'btn-secondary'} btn-sm" onclick="PX_VCH.st='${k}';pxBody()">${l}</button>`).join('')}</div>
  <div style="overflow:auto;"><table class="table" style="font-size:.85rem;"><tr><th>Code</th><th>Nakapangalan kay</th><th style="text-align:right;">Halaga</th><th>Status</th><th>Expiry</th><th>Paggamit</th><th></th></tr>${L.slice(0, 300).map(v => { const s = pxVSt(v), u = v.status === 'used' ? `${pxE(v.usedSaleNo || '')}<br><small>${pxE((v.usedAt || '').slice(0, 16).replace('T', ' '))} · ${pxE(v.usedByName || v.usedBy || '')}<br>Nagamit ₱${pxM(v.usedAmount || 0)}${+v.forfeited > 0 ? ' · sobra ₱' + pxM(v.forfeited) + ' (walang sukli)' : ''}</small>` : (v.status === 'void' ? `<small>${pxE(v.voidWhy || '')}</small>` : ''); return `<tr><td><b>${pxE(v.code)}</b></td><td>${pxE(v.holder)}${v.note ? '<br><small>' + pxE(v.note) + '</small>' : ''}</td><td style="text-align:right;">₱${pxM(v.value)}</td><td style="color:${PX_VST[s][1]};font-weight:700;">${PX_VST[s][0]}</td><td>${pxE(v.expires || '—')}</td><td>${u}</td><td>${s === 'active' ? `<button class="btn btn-secondary btn-sm" onclick="pxVchForm('${pxE(v.id)}')">✏️</button><button class="btn btn-danger btn-sm" onclick="pxVchVoid('${pxE(v.id)}')">⛔</button>` : ''}</td></tr>`; }).join('') || '<tr><td colspan="7"><small>Walang voucher.</small></td></tr>'}</table></div>`;
}
function pxVchGen() { const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; let c = ''; for (let i = 0; i < 8; i++) c += A[Math.floor(Math.random() * A.length)]; return c.slice(0, 4) + '-' + c.slice(4); }
function pxVchForm(id) {
  const v = id ? PX_VCH.list.find(x => x.id === id) : null;
  pxOv('px-dvc', `<h3 style="margin-top:0;">🎟️ ${v ? 'I-edit' : 'Mag-rehistro ng'} voucher</h3>
  <label style="font-weight:700;font-size:.8rem;">Code *</label><div style="display:flex;gap:.3rem;"><input id="vc-code" value="${pxE(v ? v.code : pxVchGen())}" ${v ? 'disabled' : ''} style="flex:1;box-sizing:border-box;font-size:1.1rem;letter-spacing:1px;text-transform:uppercase;">${v ? '' : '<button class="btn btn-secondary btn-sm" onclick="document.getElementById(\'vc-code\').value=pxVchGen()">🎲</button>'}</div>
  <label style="font-weight:700;font-size:.8rem;">Halaga (₱) *</label><input id="vc-val" type="number" step="any" inputmode="decimal" value="${v ? v.value : ''}" style="width:100%;box-sizing:border-box;font-size:1.1rem;">
  <label style="font-weight:700;font-size:.8rem;">Nakapangalan kay *</label><input id="vc-holder" value="${pxE(v ? v.holder : '')}" placeholder="pangalan ng may-ari" style="width:100%;box-sizing:border-box;">
  <label style="font-weight:700;font-size:.8rem;">Expiry (opsyonal)</label><input id="vc-exp" type="date" value="${pxE(v ? v.expires || '' : '')}" style="width:100%;box-sizing:border-box;">
  <label style="font-weight:700;font-size:.8rem;">Tala (opsyonal)</label><input id="vc-note" value="${pxE(v ? v.note || '' : '')}" placeholder="hal. regalo, promo" style="width:100%;box-sizing:border-box;">
  <div id="vc-err" style="color:#dc2626;font-weight:700;margin-top:.3rem;"></div>
  <div style="display:flex;gap:.5rem;margin-top:.8rem;">${pxBtn('btn-secondary', 'Kanselahin', "pxOvHide('px-dvc')", 'flex:1;padding:.7rem;')}${pxBtn('btn-success', '💾 I-save', "pxVchSave('" + pxE(id || '') + "')", 'flex:2;padding:.7rem;')}</div>`, 10300);
}
async function pxVchSave(id) {
  const g = i => (document.getElementById(i) || {}).value || '', err = m => { const e = document.getElementById('vc-err'); if (e) e.textContent = m; };
  if (!pxVAdmin()) { err('Admin/Super Admin lang.'); return; }
  const code = pxVKey(g('vc-code')), val = pxNum(g('vc-val')), holder = g('vc-holder').trim(), exp = g('vc-exp'), note = g('vc-note').trim();
  if (!code) { err('Ilagay ang code.'); return; } if (!(val > 0)) { err('Ilagay ang halaga.'); return; } if (!holder) { err('Ilagay kung kanino nakapangalan.'); return; }
  try {
    const ref = db.collection('pos_vouchers').doc(code), cur = await ref.get(), now = new Date().toISOString(), me = String(pxMe().email || '');
    if (id) { if (!cur.exists || cur.data().status !== 'active') { err('Hindi na ma-edit ang voucher na ito.'); return; } await ref.update({ value: pxR2(val), holder, expires: exp, note, updatedAt: now, updatedBy: me }); }
    else { if (cur.exists) { err('May voucher na na may ganitong code.'); return; } await ref.set({ company: pxCo(), code, value: pxR2(val), holder, expires: exp, note, status: 'active', createdAt: now, createdBy: me, createdByName: String(pxMe().name || '') }); }
    try { await logSystemAction(id ? 'POS_VOUCHER_EDIT' : 'POS_VOUCHER_NEW', `${code} ₱${pxM(val)} kay ${holder}`); } catch (e) {}
    pxOvHide('px-dvc'); PX_VCH.at = 0; pxBody();
  } catch (e) { err('Error: ' + e.message); }
}
async function pxVchVoid(id) {
  const v = PX_VCH.list.find(x => x.id === id); if (!v || !pxVAdmin()) return; const why = await pxPrompt('⛔ I-void ang voucher ' + v.code + ' (' + v.holder + ')', { ph: 'dahilan', ok: 'I-void', hint: 'Hindi na magagamit ang voucher na ito.' }); if (why === null) return; if (!why.trim()) { pxAlert('Kailangan ng dahilan.'); return; }
  try { await db.collection('pos_vouchers').doc(id).update({ status: 'void', voidWhy: why.trim(), voidAt: new Date().toISOString(), voidBy: String(pxMe().email || '') }); try { await logSystemAction('POS_VOUCHER_VOID', v.code + ': ' + why.trim()); } catch (e) {} PX_VCH.at = 0; pxBody(); } catch (e) { pxAlert('Error: ' + e.message); }
}
function pxVchCsv() { const rows = [['Code', 'Nakapangalan kay', 'Halaga', 'Status', 'Expiry', 'Nagamit sa', 'Petsa', 'Cashier', 'Nagamit na halaga', 'Sobra (walang sukli)', 'Tala']].concat(PX_VCH.list.map(v => [v.code, v.holder, v.value, pxVSt(v), v.expires || '', v.usedSaleNo || '', (v.usedAt || '').slice(0, 16), v.usedByName || v.usedBy || '', v.usedAmount || '', v.forfeited || '', v.note || ''])); pxDownload('vouchers_' + pxSlug(pxCo()) + '_' + pxBiz() + '.csv', rows.map(r => r.map(c => '"' + String(c == null ? '' : c).replace(/"/g, '""') + '"').join(',')).join('\r\n')); }
// ---- Pagbabayad gamit ang voucher ----
const _pxPayMode0 = pxPayMode;
pxPayMode = async function (k) { if (k === 'voucher') return pxVchPay(); return _pxPayMode0(k); };
async function pxVchPay() {
  const C = pxCalc(PX.cart, PX.disc), paid = PX.pays.reduce((s, p) => s + p.amount, 0), bal = pxR2(C.total - paid);
  if (PX.disc.type !== 'none') { await pxAlert('Hindi puwedeng gamitin ang voucher sa order na may discount. Alisin muna ang discount.', '🎟️ Voucher'); return; }
  if (bal <= 0.001) { await pxAlert('Bayad na ang order.'); return; }
  const raw = await pxPrompt('🎟️ Series number ng voucher', { ph: 'hal. KV-000123 o 123', ok: 'Suriin', hint: 'I-type ang series number ng voucher.' }); if (raw === null) return; const code = pxVKey(raw); if (!code) return;
  if (PX.pays.some(p => p.mode === 'voucher' && p.ref === code)) { await pxAlert('Nailagay na ang voucher na ito.'); return; }
  let v = null; try { const d = await db.collection('pos_vouchers').doc(code).get(); v = d.exists ? Object.assign({ id: d.id }, d.data()) : null;
    if ((!v || v.company !== pxCo()) && /^\d+$/.test(code)) { const q = await db.collection('pos_vouchers').where('company', '==', pxCo()).where('num', '==', +code).get(); const hits = []; q.forEach(x => hits.push(Object.assign({ id: x.id }, x.data()))); if (hits.length > 1) { await pxAlert('Maraming voucher na may numerong ' + code + ' (iba-ibang prefix). I-type ang buong series, hal. ' + hits[0].id + '.'); return; } v = hits[0] || null; } } catch (e) { await pxAlert('Hindi ma-check ang voucher: ' + e.message); return; }
  if (!v || v.company !== pxCo()) { await pxAlert('Walang voucher na may series na ' + code + '.', '❌ Hindi nahanap'); return; }
  if (v.status === 'pending') { await pxAlert('Hindi pa naaprubahan ang voucher na ito (hinihintay ang pirma ng COO/President).', '⏳ Hindi pa active'); return; }
  if (!v.holder) { await pxAlert('Wala pang naka-assign na may-ari ang voucher na ito. Ipa-assign muna sa Admin (ERP → Vouchers).', '⚠️ Hindi pa nirelease'); return; }
  if (PX.pays.some(p => p.mode === 'voucher' && p.ref === v.id)) { await pxAlert('Nailagay na ang voucher na ito.'); return; }
  const s = pxVSt(v); if (s !== 'active') { await pxAlert(s === 'used' ? 'Nagamit na ang voucher na ito' + (v.usedSaleNo ? ' sa ' + v.usedSaleNo : '') + (v.usedAt ? ' noong ' + v.usedAt.slice(0, 16).replace('T', ' ') : '') + '.' : s === 'expired' ? 'Expired na ang voucher (' + v.expires + ').' : 'Na-void ang voucher na ito.', '⛔ Hindi magagamit'); return; }
  const use = Math.min(+v.value, bal), over = pxR2(+v.value - use);
  if (!await pxConfirm(`Voucher ${v.id}\nNakapangalan kay: ${v.holder}\nHalaga: ₱${pxM(v.value)}\n\nIbabawas sa bill: ₱${pxM(use)}` + (over > 0 ? `\n⚠️ Sobra ₱${pxM(over)} — WALANG SUKLI, mawawala na.` : bal > use ? `\nKulang pa: ₱${pxM(bal - use)} — babayaran ng cash/card.` : '') + '\n\nIsang beses lang magagamit ang voucher.', { ok: 'Gamitin', title: '🎟️ Voucher' })) return;
  PX.pays.push({ mode: 'voucher', amount: pxR2(use), ref: v.id, payer: v.holder, vValue: +v.value, forfeit: over }); pxBody();
}
// Markahan na nagamit (rules ang tumitiyak na hindi magagamit nang dalawang beses)
async function pxVchConsume(pays, saleNo, total) {
  const done = [];
  for (const p of pays) {
    try { const ref = db.collection('pos_vouchers').doc(p.ref), d = await ref.get(), v = d.exists ? d.data() : null; if (!v || v.status !== 'active' || v.company !== pxCo()) throw new Error('Nagamit na o hindi na valid ang voucher ' + p.ref + '.'); if (v.expires && v.expires < pxBiz()) throw new Error('Expired na ang voucher ' + p.ref + '.');
      await ref.update({ status: 'used', usedAt: new Date().toISOString(), usedBy: String(pxMe().email || ''), usedByName: String(pxMe().name || ''), usedSaleNo: saleNo, usedAmount: p.amount, forfeited: p.forfeit || 0, billTotal: total }); done.push(p.ref); }
    catch (e) { for (const c of done) { try { await db.collection('pos_vouchers').doc(c).update({ status: 'active', usedAt: '', usedBy: '', usedByName: '', usedSaleNo: '', usedAmount: 0, forfeited: 0, billTotal: 0 }); } catch (x) {} } await pxAlert('Hindi magagamit ang voucher: ' + (e.message || e), '🎟️ Voucher'); return false; }
  }
  return true;
}
async function pxVchRelease(sale) { for (const p of (sale.pays || []).filter(x => x.mode === 'voucher')) { try { await db.collection('pos_vouchers').doc(p.ref).update({ status: 'active', usedAt: '', usedBy: '', usedByName: '', usedSaleNo: '', usedAmount: 0, forfeited: 0, billTotal: 0, releasedFor: sale.no }); try { await logSystemAction('POS_VOUCHER_RELEASED', p.ref + ' — na-void ang ' + sale.no); } catch (e) {} } catch (e) {} } }

/* ============ RESERVATION: babala sa pag-seat + alarm (tawagan/i-confirm) ============ */
const pxRsvCallMin = () => Math.max(5, +(PX.cfg && PX.cfg.rsvCall) || 30);
async function pxRsvConfirm(id) {
  const r = (PX.rsvAct || []).find(x => x.id === id); if (!r) return;
  try { await pxRsvUpd(id, () => ({ confirmedAt: new Date().toISOString(), confirmedBy: String(pxMe().email || '') }), 'confirmed'); try { await logSystemAction('POS_RSV_CONFIRMED', r.name + ' ' + r.date + ' ' + r.start); } catch (e) {} PX._rsvAt = 0; await pxRsvLoad(true); pxRsvAlarmCheck(); if (PX.tab === 'rsv') pxBody(); pxToast('✅ Na-confirm si ' + r.name); } catch (e) { pxAlert('Error: ' + e.message); }
}
// Pag magpapaupo ng walk-in: ipaalam na may naka-reserve, at hanggang anong oras lang ang table
async function pxRsvSeatWarn(tid) {
  await pxRsvLoad(true).catch(() => {}); const rs = pxRsvSoon(tid, 24 * 60); if (!rs) return true;
  const left = Math.max(0, Math.round((rs.startMs - Date.now()) / 60000)), lt = left >= 60 ? Math.floor(left / 60) + ' oras ' + (left % 60 ? (left % 60) + ' min' : '') : left + ' minuto';
  const k = await pxChoice('⚠️ May naka-reserve sa table na ito', [{ k: 'go', label: '✅ Ituloy — nasabihan ko ang customer', sub: 'Hanggang ' + pxHM(rs.startMs) + ' lang ang table (' + lt + ' na lang)' }, { k: 'cx', label: '❌ I-cancel ang reservation', sub: 'Hindi na darating ang guest' }, { k: 'no', label: '← Huwag ituloy' }], { cols: 1, hint: `Reservation: <b>${pxE(rs.name)}</b> · ${pxHM(rs.startMs)}–${pxHM(rs.endMs)} · 👥 ${rs.pax || ''}${(rs.layoutName ? ' · 🏢 ' + pxE(rs.layoutName) : '')}. Paalahanan ang customer na kailangan nilang umalis bago mag-${pxHM(rs.startMs)}.` });
  if (k === 'go') { try { await logSystemAction('POS_WALKIN_BEFORE_RSV', rs.name + ' ' + pxHM(rs.startMs)); } catch (e) {} return true; }
  if (k === 'cx') { await pxRsvStatus(rs.id, 'cancelled'); await pxRsvLoad(true).catch(() => {}); return !pxRsvSoon(tid, 24 * 60) || (PX.rsvAct || []).every(r => r.id !== rs.id || r.status !== 'booked'); }
  return false;
}
function pxRsvTabNote(t) {
  const rs = t && !t.lane ? pxRsvSoon(t.tableId, 24 * 60) : null; if (!rs) return '';
  const left = Math.round((rs.startMs - Date.now()) / 60000);
  return `<div style="margin:.3rem 0;padding:.35rem .6rem;border-radius:.5rem;background:${left <= pxRsvCallMin() ? '#fee2e2' : '#fef3c7'};font-size:.85rem;">⏰ <b>May reservation ng ${pxHM(rs.startMs)}</b> (${pxE(rs.name)}${rs.layoutName ? ', 🏢 ' + pxE(rs.layoutName) : ''}) — ${left > 0 ? left + ' min na lang' : 'oras na'}. Paalahanan ang customer na umalis bago ang oras na iyon.</div>`;
}
/* ---- Alarm banner ---- */
function pxRsvAlarmCheck() {
  try {
    const host = document.getElementById('px-root') || document.getElementById('px-body'); if (!host || !PX.site || !PX.rsvAct) return;
    let bar = document.getElementById('px-rsv-alarm'); const now = Date.now(), win = pxRsvCallMin() * 60000, snz = PX._rsvSnz || {};
    const calls = (PX.rsvAct || []).filter(r => r.status === 'booked' && !r.confirmedAt && r.startMs - now <= win && r.startMs - now > -15 * 60000 && (snz[r.id] || 0) < now);
    const tabs = (PX.tabs || []).filter(t => !t.lane && t.status === 'open').map(t => ({ t, r: pxRsvSoon(t.tableId, pxRsvCallMin()) })).filter(x => x.r && x.r.startMs - now > 0 && (snz['t' + x.t.id] || 0) < now);
    if (!calls.length && !tabs.length) { if (bar) bar.remove(); return; }
    if (!bar) { bar = document.createElement('div'); bar.id = 'px-rsv-alarm'; bar.style.cssText = 'position:fixed;left:.5rem;right:.5rem;top:.5rem;z-index:10050;max-width:620px;margin:0 auto;display:grid;gap:.4rem;'; document.body.appendChild(bar); }
    const html = calls.map(r => `<div style="background:#fff7ed;border:2px solid #f97316;border-radius:.6rem;padding:.5rem .7rem;box-shadow:0 4px 14px rgba(0,0,0,.2);"><b>📞 Tawagan si ${pxE(r.name)}</b> — reserved ${pxHM(r.startMs)} (${Math.max(0, Math.round((r.startMs - now) / 60000))} min) · 👥 ${r.pax || ''} · ${(r.tables || []).map(x => pxE(x.name)).join(', ').slice(0, 60)}${r.phone ? ' · ☎ ' + pxE(r.phone) : ''}<div style="font-size:.8rem;color:#7c2d12;">I-confirm kung darating para maihanda ang ${(r.adv || []).length ? 'advance order' : 'table'}. Kapag hindi darating, i-cancel agad.</div><div style="display:flex;gap:.3rem;flex-wrap:wrap;margin-top:.3rem;"><button class="btn btn-success btn-sm" onclick="pxRsvConfirm('${r.id}')">✅ Darating</button><button class="btn btn-danger btn-sm" onclick="pxRsvStatus('${r.id}','cancelled').then(()=>pxRsvLoad(true).then(pxRsvAlarmCheck))">❌ Hindi darating</button><button class="btn btn-secondary btn-sm" onclick="pxRsvSnooze('${r.id}')">⏰ Mamaya (5 min)</button></div></div>`).join('') + tabs.map(x => `<div style="background:#fef2f2;border:2px solid #ef4444;border-radius:.6rem;padding:.5rem .7rem;box-shadow:0 4px 14px rgba(0,0,0,.2);"><b>⏰ ${pxE(x.t.tableName)}</b> — may reservation ng ${pxHM(x.r.startMs)} (${Math.round((x.r.startMs - now) / 60000)} min na lang). Paalahanan ang customer na paalis na. <button class="btn btn-secondary btn-sm" onclick="pxRsvSnooze('t${x.t.id}')">OK</button></div>`).join('');
    if (bar.dataset.h !== html) { bar.innerHTML = html; bar.dataset.h = html; if (!bar.dataset.b) { bar.dataset.b = '1'; try { const a = new (window.AudioContext || window.webkitAudioContext)(), o = a.createOscillator(); o.frequency.value = 880; o.connect(a.destination); o.start(); setTimeout(() => o.stop(), 250); } catch (e) {} } }
  } catch (e) {}
}
function pxRsvSnooze(k) { (PX._rsvSnz = PX._rsvSnz || {})[k] = Date.now() + (String(k)[0] === 't' ? 10 : 5) * 60000; const b = document.getElementById('px-rsv-alarm'); if (b) { b.dataset.h = ''; b.dataset.b = ''; } pxRsvAlarmCheck(); }
setInterval(async () => { try { if (!PX || !PX.site || !PX.cfg || typeof pxCan !== 'function' || !document.getElementById('px-body')) { const b = document.getElementById('px-rsv-alarm'); if (b) b.remove(); return; } if (!pxCan()) return; await pxRsvLoad(); pxRsvAlarmCheck(); } catch (e) {} }, 30000);

/* ===== Task tray para sa POS: restore point at bulk save ===== */
(function () {
  if (typeof kTask !== 'function') return;
  const rp0 = pxRpMake; pxRpMake = async function (reason) { const tk = kTask('🕘 Restore point (members) — ' + (reason || 'Manual')); tk.msg('Kinukuha ang mga member at club…'); try { const id = await rp0(reason); tk.done('Na-save ang ' + id); return id; } catch (e) { tk.fail(e.message); throw e; } };
  const pb0 = pxBatch; pxBatch = async function (ops, cb) { const tk = kTask('💾 Pag-save sa database (' + (ops || []).length + ' operasyon)', (ops || []).length); try { const r = await pb0(ops, (a, b) => { tk.set(a, b); tk.msg(a + ' / ' + b); if (cb) cb(a, b); }); tk.done('Tapos: ' + (ops || []).length + ' operasyon'); return r; } catch (e) { tk.fail(e.message); throw e; } };
})();
/* ================= MAIN MENU BULK UPLOAD + EVENT SUB-MENU (kopya ng main menu) ================= */
const pxMnNorm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();
let PX_MI = { rows: [], plan: [] };
function pxMenuTemplate() { pxDownload('main_menu_template.csv', 'Item,Category,Price,VAT (Y/N),Active (Y/N),Stations (hal. Main@11:00-16:00;Yakitori@16:01-23:59),Sangkap (CODE:dami sa g/ml/pc;CODE:dami)\r\nSalmon Don,Rice Bowl,224,Y,Y,Main@11:00-16:00;Yakitori@16:01-23:59,RICE01:180;SAL01:120\r\nIced Tea,Drinks,80,Y,Y,Bar,\r\n'); }
function pxMenuExport() { const L = PX.menu.filter(m => !m.eventId && !m.batch).sort((a, b) => String(a.name).localeCompare(b.name)); const stn = m => (m.stations || []).map(k => { const w = (m.stWin || {})[k]; return pxStnName(k) + (w && (w[0] || w[1]) ? '@' + (w[0] || '') + '-' + (w[1] || '') : ''); }).join(';'); pxDownload('main_menu_' + pxSlug(pxCo()) + '_' + pxBiz() + '.csv', [['Item', 'Category', 'Price', 'VAT (Y/N)', 'Active (Y/N)', 'Stations', 'Sangkap']].concat(L.map(m => [m.name, m.category || '', m.price, m.vat === false ? 'N' : 'Y', m.active === false ? 'N' : 'Y', stn(m), (m.ings || []).filter(g => g.code && !g.batch).map(g => g.code + ':' + g.qty).join(';')])).map(r => r.map(c => '"' + String(c == null ? '' : c).replace(/"/g, '""') + '"').join(',')).join('\r\n')); }
function pxMenuImport() {
  PX_MI = { rows: [], plan: [] };
  pxModal(`<h3 style="margin-top:0;">⬆️ Bulk upload ng Main Menu</h3>${pxHint('📖 <b>Main Menu lang</b> ito (walang Grab/Panda/event na presyo). Kapag may kapangalan na item, <b>ina-update</b> ang presyo/kategorya/station; kapag wala, <b>bago</b>. Ang event menu ay ginagawa sa 🎪 Events (kopya ng main menu). <b>Stations</b>: pangalan ng station, at puwedeng may oras: <code>Main@11:00-16:00;Yakitori@16:01-23:59</code>. <b>Sangkap</b>: <code>CODE:dami</code> (g/ml/pc) — blangko = hindi gagalawin ang sangkap ng existing item.')}
  <div style="display:flex;gap:.4rem;flex-wrap:wrap;align-items:center;"><input type="file" id="mni-f" accept=".csv,.txt,text/csv" onchange="pxMenuImpFile(this)"><button class="btn btn-secondary btn-sm" onclick="pxMenuTemplate()">⬇️ Template</button><button class="btn btn-secondary btn-sm" onclick="pxMenuExport()">⬇️ I-export ang kasalukuyan</button></div><div id="mni-prev" style="margin-top:.5rem;"></div>`, 860);
}
function pxMenuImpFile(inp) { const f = inp.files && inp.files[0]; if (!f) return; const r = new FileReader(); r.onload = async () => { PX_MI.rows = pxCsvParse(r.result); await pxMenuImpPlan(); }; r.readAsText(f, 'utf-8'); }
async function pxMenuImpPlan() {
  const sap = await pxSap(), by = {}; sap.forEach(s => { by[String(s.code).toUpperCase()] = s; });
  const stByName = {}; (pxStnAll ? pxStnAll() : []).forEach(s => { stByName[pxMnNorm(s.name)] = s.key; stByName[pxMnNorm(s.key)] = s.key; });
  const ex = {}; PX.menu.filter(m => !m.eventId && !m.batch).forEach(m => { ex[pxMnNorm(m.name)] = m; });
  const rows = PX_MI.rows.slice(1).filter(r => r && r.some(c => String(c || '').trim())), plan = [], seen = {};
  rows.forEach((r, i) => {
    const name = String(r[0] || '').trim(), P = { n: i + 2, name, err: [], warn: [] }; if (!name) { P.err.push('walang pangalan'); plan.push(P); return; }
    if (seen[pxMnNorm(name)]) { P.err.push('doble sa file'); plan.push(P); return; } seen[pxMnNorm(name)] = 1;
    const price = pxNum(r[2]); const old = ex[pxMnNorm(name)]; if (!(price > 0) && !old) P.err.push('walang presyo'); P.price = price > 0 ? price : null; P.cat = String(r[1] || '').trim();
    const yn = (v, d) => { const s = String(v == null ? '' : v).trim().toLowerCase(); return !s ? d : !/^(n|no|0|false|hindi|inactive)$/.test(s); }; P.vat = yn(r[3], null); P.act = yn(r[4], null);
    const sc = String(r[5] || '').trim(); if (sc) { P.stations = []; P.stWin = {}; sc.split(/[;|]/).forEach(x => { const m = x.trim().match(/^(.*?)(?:@\s*(\d{1,2}:\d{2})?\s*-\s*(\d{1,2}:\d{2})?)?$/); if (!m || !m[1].trim()) return; const k = stByName[pxMnNorm(m[1])]; if (!k) { P.warn.push('walang station "' + m[1].trim() + '"'); return; } P.stations.push(k); if (m[2] || m[3]) P.stWin[k] = [(m[2] || '').padStart(5, '0'), (m[3] || '').padStart(5, '0')]; }); }
    const ic = String(r[6] || '').trim(); if (ic) { P.ings = []; ic.split(/[;|]/).forEach(x => { const [c, q] = x.split(':'), s = by[String(c || '').trim().toUpperCase()], n = pxNum(q); if (!s) { P.warn.push('walang item code "' + String(c || '').trim() + '"'); return; } if (!(n > 0)) { P.warn.push(s.code + ': walang dami'); return; } P.ings.push(pxIngDef({ code: s.code, name: s.name, invUnit: s.invUnit, qty: n })); }); }
    P.old = old || null; plan.push(P);
  });
  PX_MI.plan = plan; const ok = plan.filter(p => !p.err.length), nw = ok.filter(p => !p.old).length, up = ok.filter(p => p.old).length, el = document.getElementById('mni-prev'); if (!el) return;
  el.innerHTML = `<div style="margin:.3rem 0;"><b>${ok.length}</b> handang i-save · 🆕 ${nw} bago · ♻️ ${up} update · ❌ ${plan.length - ok.length} may mali</div><div style="max-height:260px;overflow:auto;"><table class="table" style="font-size:.78rem;"><tr><th>#</th><th>Item</th><th>Presyo</th><th>Aksyon</th><th>Tala</th></tr>${plan.slice(0, 400).map(p => `<tr style="${p.err.length ? 'background:#fee2e2;' : ''}"><td>${p.n}</td><td>${pxE(p.name)}</td><td>${p.price != null ? pxM(p.price) : '—'}</td><td>${p.err.length ? '❌' : p.old ? '♻️ update' : '🆕 bago'}</td><td>${pxE(p.err.concat(p.warn).join('; '))}</td></tr>`).join('')}</table></div>${ok.length ? `<button class="btn btn-success" style="margin-top:.4rem;" onclick="pxMenuImpGo()">💾 I-save ang ${ok.length}</button>` : ''}`;
}
async function pxMenuImpGo() {
  const ok = PX_MI.plan.filter(p => !p.err.length); if (!ok.length) return; if (!await pxConfirm('I-save ang ' + ok.length + ' menu item?', { ok: 'I-save' })) return;
  const me = String(pxMe().email || ''), now = new Date().toISOString(), tk = typeof kTask === 'function' ? kTask('📋 Menu upload', ok.length) : null, ops = [];
  ok.forEach(p => { const o = p.old, id = o ? o.id : pxId('MN'); const d = o ? Object.assign({}, o) : { company: pxCo(), name: p.name, category: 'Iba pa', price: 0, vat: true, batch: false, yieldQty: 0, yieldUnit: '', active: true, stations: [], stWin: {}, kname: '', chPrice: {}, chOff: {}, subOnly: false, subs: [], ings: [], eventId: '' };
    delete d.id; if (p.price != null) d.price = p.price; if (p.cat) d.category = p.cat; if (p.vat !== null) d.vat = p.vat; if (p.act !== null) d.active = p.act; if (p.stations) { d.stations = p.stations; d.stWin = p.stWin; } if (p.ings) d.ings = p.ings; d.updatedBy = me; d.updatedAt = now; ops.push({ t: 'set', col: 'pos_menu', id, d, _o: o }); });
  try { await pxBatch(ops, (a, b) => { if (tk) tk.set(a); }); ops.forEach(op => { const i = PX.menu.findIndex(x => x.id === op.id); const row = Object.assign({ id: op.id }, op.d); if (i >= 0) PX.menu[i] = row; else PX.menu.push(row); }); try { await logSystemAction('POS_MENU_IMPORT', ok.length + ' item'); } catch (e) {} if (tk) tk.done('Menu: ' + ok.length + ' na-save'); pxClose(); pxRender(); pxToast('✅ ' + ok.length + ' menu item ang na-save'); } catch (e) { if (tk) tk.fail(e.message); pxAlert('Error: ' + e.message); }
}
/* ---------- Event sub-menu: kopya ng main menu, may sariling presyo at grammage ---------- */
let PX_EC = null;
function pxEventCopy(eid) {
  const e = PX.events.find(x => x.id === eid); if (!e) return; const reg = PX.menu.filter(m => !m.eventId && !m.batch && !m.subOnly && m.active !== false), have = {}; PX.menu.filter(m => m.eventId === eid && m.copyOf).forEach(m => { have[m.copyOf] = m; });
  PX_EC = { eid };
  pxModal(`<h3 style="margin-top:0;">📋 Event Sub-menu — ${pxE(e.name)}</h3>${pxHint('📖 Pumili ng items mula sa <b>Main Menu</b> na gagawing kopya para sa event na ito. Puwede mong baguhin ang <b>presyo</b> dito (o i-%), at pagkatapos ay ✏️ i-edit ang kopya para sa <b>sukat (grammage) ng bawat sangkap/sub-item</b> — iyon ang gagamitin sa ideal usage ng event. Hindi nagagalaw ang Main Menu. Ang kinopya ay aalisin sa regular na lalabas sa event (para hindi doble).')}
  <div style="display:flex;gap:.3rem;flex-wrap:wrap;align-items:center;">${pxSearchBox('.ec-row', '🔎 Hanapin…')}<button class="btn btn-secondary btn-sm" onclick="document.querySelectorAll('.ec-row').forEach(r=>{if(r.style.display!=='none'){const c=r.querySelector('.ec-ck');if(c&&!c.disabled)c.checked=true}})">✔ lahat ng nakikita</button><button class="btn btn-secondary btn-sm" onclick="document.querySelectorAll('.ec-ck').forEach(c=>c.checked=false)">✖ wala</button><label style="font-size:.8rem;">Presyo: <select id="ec-mode"><option value="same">Kapareho ng main</option><option value="pct">Dagdag/bawas %</option></select> <input id="ec-pct" type="number" step="any" placeholder="hal. 15 o -10" style="width:90px;"></label></div>
  <div style="max-height:300px;overflow:auto;border:1px solid #e2e8f0;border-radius:.4rem;padding:.3rem;margin-top:.3rem;">${reg.map(m => `<div class="ec-row" data-s="${pxE(m.name + ' ' + (m.category || ''))}" style="display:flex;gap:.4rem;align-items:center;font-size:.82rem;"><input type="checkbox" class="ec-ck" value="${m.id}" ${have[m.id] ? 'disabled' : ''}><span style="flex:1;">${pxE(m.name)} <small>(${pxM(m.price)})</small>${(m.subs || []).length ? ' 🍱' : ''}</span>${have[m.id] ? '<small style="color:#16a34a;">✔ may kopya</small>' : ''}</div>`).join('')}</div>
  <button class="btn btn-success" style="margin-top:.4rem;" onclick="pxEventCopyGo()">📋 Gumawa ng kopya</button>`, 700);
}
async function pxEventCopyGo() {
  const eid = PX_EC.eid, e = PX.events.find(x => x.id === eid); if (!e) return; const ids = [...document.querySelectorAll('.ec-ck:checked')].map(x => x.value); if (!ids.length) { pxAlert('Pumili muna ng item.'); return; }
  const mode = (document.getElementById('ec-mode') || {}).value, pct = pxNum((document.getElementById('ec-pct') || {}).value), me = String(pxMe().email || ''), now = new Date().toISOString(), have = {}; PX.menu.filter(m => m.eventId === eid && m.copyOf).forEach(m => { have[m.copyOf] = m.id; });
  const ops = [], newRows = [], cp = (src, price) => { if (have[src.id]) return have[src.id]; const nid = pxId('MN'); have[src.id] = nid; const d = JSON.parse(JSON.stringify(src)); delete d.id; Object.assign(d, { eventId: eid, copyOf: src.id, price, subs: [], updatedBy: me, updatedAt: now }); (src.subs || []).forEach(s => { const sm = PX.menu.find(x => x.id === s.id); if (sm) d.subs.push({ id: cp(sm, +sm.price || 0), qty: s.qty }); }); ops.push({ t: 'set', col: 'pos_menu', id: nid, d }); newRows.push(Object.assign({ id: nid }, d)); return nid; };
  ids.forEach(id => { const src = PX.menu.find(x => x.id === id); if (!src) return; let pr = +src.price || 0; if (mode === 'pct' && pct) pr = Math.round(pr * (1 + pct / 100) * 100) / 100; cp(src, pr); });
  const inc = (e.regularIds && e.regularIds.length) ? e.regularIds.filter(x => !ids.includes(x)) : PX.menu.filter(m => !m.eventId && !m.batch && !ids.includes(m.id)).map(m => m.id);
  const regularIds = inc.length ? inc : ['_none'];
  try { await pxBatch(ops); await db.collection('pos_events').doc(eid).set({ regularIds }, { merge: true }); newRows.forEach(r => PX.menu.push(r)); e.regularIds = regularIds; pxClose(); pxToast('✅ ' + ids.length + ' item ang nakopya sa event'); pxEventEdit(eid); } catch (er) { pxAlert('Error: ' + er.message); }
}
// Mga button sa Menu / Event screens
const _pxMenuView0 = pxMenuView;
pxMenuView = async function () { let h = await _pxMenuView0(); return h.replace(`<button class="btn btn-primary btn-sm" onclick="pxMenuEdit('')">➕ Bagong item</button>`, `<button class="btn btn-primary btn-sm" onclick="pxMenuEdit('')">➕ Bagong item</button><button class="btn btn-secondary btn-sm" onclick="pxMenuImport()">⬆️ Bulk upload (CSV)</button><button class="btn btn-secondary btn-sm" onclick="pxMenuExport()">⬇️ Export</button>`); };
const _pxEventEdit0 = pxEventEdit;
pxEventEdit = function (id) { _pxEventEdit0(id); if (!id) return; const m = document.querySelector('#px-modal button[onclick^="pxClose();pxMenuEdit(\'\',"]'); if (m) m.insertAdjacentHTML('afterend', ` <button class="btn btn-primary btn-sm" onclick="pxEventCopy('${id}')">📋 Kopyahin mula sa Main Menu</button>`); };

/* ================= COURSE TIMING (hold / fire) ================= */
function pxLineCourse(i) { const l = PX.cart[i]; if (!l) return; l.course = ((l.course || 1) % 3) + 1; pxBody(); }
function pxHeldOf(t) { const out = []; (t.orders || []).forEach((o, oi) => { if (o.status === 'void') return; (o.items || []).forEach((it, ii) => { if (it.held) out.push({ oi, ii, no: o.no, course: it.course || 2, it }); }); }); return out; }
async function pxCourseFire(tabId, course) {
  const t = (PX.tabs || []).find(x => x.id === tabId); if (!t) return; const H = pxHeldOf(t).filter(h => h.course === course); if (!H.length) return;
  if (!await pxConfirm('🔥 I-fire ang Course ' + course + ' (' + H.reduce((s, h) => s + (+h.it.qty || 0), 0) + ' item) ng ' + t.tableName + ' sa kusina?', { ok: '🔥 Fire' })) return;
  let fired = []; try {
    const n = await pxTabMut(tabId, d => { (d.orders || []).forEach(o => { if (o.status === 'void') return; (o.items || []).forEach(it => { if (it.held && (it.course || 2) === course) { it.held = false; it.firedAt = new Date().toISOString(); fired.push({ no: o.no, it }); } }); }); }, { a: 'fire', i: 'Course ' + course });
    const by = {}; fired.forEach(f => { (by[f.no] = by[f.no] || []).push(f.it); });
    for (const no of Object.keys(by)) { const ord = n.orders.find(x => x.no === +no); if (ord) await pxKitchenBg(n, Object.assign({}, ord, { items: by[no].map(x => Object.assign({}, x, { held: false })) }), +no, false, false); }
    pxToast('🔥 Course ' + course + ' → kusina'); pxTabView(tabId); pxBody();
  } catch (e) { pxAlert('Error: ' + e.message); }
}
const _pxTabView0 = pxTabView;
pxTabView = function (id) { _pxTabView0(id); const t = (PX.tabs || []).find(x => x.id === id), m = document.getElementById('px-modal'); if (!t || !m) return; const H = pxHeldOf(t); if (!H.length) return; const cs = [...new Set(H.map(h => h.course))].sort(); const h3 = m.querySelector('h3'); if (h3) h3.insertAdjacentHTML('afterend', `<div style="border:2px solid #f59e0b;background:#fffbeb;border-radius:.5rem;padding:.4rem .6rem;margin:.3rem 0;"><b>⏳ Naka-hold sa kusina</b>${cs.map(c => `<div style="display:flex;gap:.4rem;align-items:center;margin-top:.25rem;font-size:.85rem;"><span style="flex:1;"><b>Course ${c}:</b> ${H.filter(h => h.course === c).map(h => h.it.qty + '× ' + pxE(h.it.name)).join(', ')}</span><button class="btn btn-primary btn-sm" onclick="pxCourseFire('${id}',${c})">🔥 Fire Course ${c}</button></div>`).join('')}</div>`); };

/* ================= WAITER HANDHELD (📱) — malalaking button para sa phone/tablet ================= */
async function pxWaiterView() {
  const me = String(pxMe().email || ''), L = (PX.tabs || []).filter(t => t.status !== 'cancelled' && t.status !== 'paid' && !t.lane).slice().sort((a, b) => ((b.openedBy === me) - (a.openedBy === me)) || String(a.tableName).localeCompare(String(b.tableName), undefined, { numeric: true }));
  const el = t => { const mins = Math.max(0, Math.round((Date.now() - (t.openedMs || Date.parse(t.openedAt) || Date.now())) / 60000)); return mins >= 60 ? Math.floor(mins / 60) + 'h ' + (mins % 60) + 'm' : mins + 'm'; };
  return pxHint('📱 <b>Waiter mode</b> — para sa phone/tablet. Pindutin ang <b>➕ Order</b> para kumuha ng order (diretso sa kusina), <b>🔔 Bill</b> kapag humingi ng bill ang customer (makikita ng cashier), at <b>🔥</b> para i-fire ang Course 2/3.') +
  `<div style="display:flex;gap:.4rem;margin-bottom:.5rem;"><button class="btn btn-primary" style="flex:1;padding:.8rem;font-size:1rem;" onclick="PX.tab='tables';pxBody()">🪑 Magbukas ng table</button><button class="btn btn-secondary" style="padding:.8rem;" onclick="pxBody()">🔄</button></div>
  <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:.5rem;">${L.map(t => { const held = pxHeldOf(t), mine = t.openedBy === me, orders = (t.orders || []).filter(o => o.status !== 'void'); return `<div style="border:2px solid ${t.billReq ? '#dc2626' : mine ? '#2563eb' : '#cbd5e1'};border-radius:.7rem;padding:.6rem;background:${t.billReq ? '#fef2f2' : '#fff'};">
  <div style="display:flex;justify-content:space-between;align-items:center;"><b style="font-size:1.25rem;">${pxE(t.tableName)}</b><span style="font-size:.8rem;color:#64748b;">👥 ${t.pax || '-'} · ⏱ ${el(t)}</span></div>
  <div style="font-size:.82rem;color:#475569;margin:.2rem 0;">${orders.length} order · <b>₱${pxM(pxTabSub(t))}</b>${t.member ? ' · 🪪 ' + pxE(t.member.name) : ''}${mine ? '' : ' · ' + pxE(t.openedByName || '')}</div>
  ${t.billReq ? `<div style="color:#b91c1c;font-weight:800;font-size:.85rem;">🔔 Humihingi ng bill (${pxE(t.billReq.byName || '')})</div>` : ''}${held.length ? `<div style="color:#b45309;font-size:.8rem;font-weight:700;">⏳ ${held.length} item naka-hold (Course ${[...new Set(held.map(h => h.course))].join(', ')})</div>` : ''}
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:.3rem;margin-top:.4rem;"><button class="btn btn-success" style="padding:.7rem;" onclick="pxTabOrder('${t.id}')">➕ Order</button><button class="btn btn-secondary" style="padding:.7rem;" onclick="pxTabView('${t.id}')">👁 Tingnan</button><button class="btn ${t.billReq ? 'btn-secondary' : 'btn-primary'}" style="padding:.7rem;" onclick="pxBillReq('${t.id}')">${t.billReq ? '✔ Na-bill na' : '🔔 Bill'}</button>${held.length ? `<button class="btn btn-primary" style="padding:.7rem;" onclick="pxCourseFire('${t.id}',${Math.min(...held.map(h => h.course))})">🔥 Fire C${Math.min(...held.map(h => h.course))}</button>` : '<span></span>'}</div></div>`; }).join('') || '<div style="padding:1rem;color:#64748b;">Walang bukas na table.</div>'}</div>`;
}
async function pxBillReq(id) { const t = (PX.tabs || []).find(x => x.id === id); if (!t) return; const me = pxMe(); try { await pxTabMut(id, d => { if (d.billReq) delete d.billReq; else d.billReq = { at: new Date().toISOString(), by: String(me.email || ''), byName: String(me.name || '') }; }, { a: 'billreq', i: t.billReq ? 'clear' : 'hiningi' }); pxToast(t.billReq ? '✔ Na-clear' : '🔔 Naabisuhan ang cashier'); pxBody(); } catch (e) { pxAlert('Error: ' + e.message); } }

/* ================= QR SELF-ORDERING ================= */
const pxQrKey = () => (pxCo() + '__' + PX.site).replace(/[\/\s]/g, '_');
const pxQrBase = () => location.href.replace(/[#?].*$/, '').replace(/[^\/]*$/, '') + 'order.html';
const pxQrUrl = tid => pxQrBase() + '?c=' + encodeURIComponent(pxCo()) + '&s=' + encodeURIComponent(PX.site) + '&t=' + encodeURIComponent(tid);
async function pxQrSync(open) {
  const tables = {}; ((PX.floor || {}).tables || []).forEach(t => { tables[t.id] = t.name || t.id; });
  const items = pxMenuItems0().filter(m => !m.batch && !m.subOnly && !pxIsOff(m.id) && (+m._price || 0) > 0).map(m => ({ id: m.id, name: m.name, price: +m._price, category: m.category || 'Iba pa' }));
  const cur = (await db.collection('pos_pubmenu').doc(pxQrKey()).get()).data() || {};
  await db.collection('pos_pubmenu').doc(pxQrKey()).set({ company: pxCo(), site: PX.site, siteName: pxSite().name || '', open: open == null ? cur.open !== false : !!open, tables, items, updatedAt: new Date().toISOString() });
  return items.length;
}
async function pxQrView() {
  let cur = {}; try { cur = (await db.collection('pos_pubmenu').doc(pxQrKey()).get()).data() || {}; } catch (e) {}
  const T = ((PX.floor || {}).tables || []);
  pxModal(`<h3 style="margin-top:0;">📲 QR Self-ordering</h3>${pxHint('📖 Ang customer ay mag-scan ng QR sa table → makikita ang menu → ipapadala ang order. <b>Hindi pa ito nagpa-print sa kusina</b> hanggang <b>tanggapin</b> ng staff sa inbox (para walang prank/mali). Kailangang may <b>bukas na table</b> (tab) ang table na iyon. I-<b>sync</b> ang menu kapag may nabago sa menu o presyo. Public ang menu page (pangalan at presyo lang; walang sangkap/costing).')}
  <div style="display:flex;gap:.4rem;flex-wrap:wrap;margin:.4rem 0;"><button class="btn btn-primary" onclick="pxQrDo('sync')">🔄 I-sync ang QR menu</button><button class="btn ${cur.open === false ? 'btn-secondary' : 'btn-success'}" onclick="pxQrDo('toggle')">${cur.open === false ? '⛔ SARADO — i-open' : '✅ BUKAS — i-close'}</button><button class="btn btn-secondary" onclick="pxQrSheet()">🖨️ I-print ang QR ng lahat ng table</button></div>
  <small style="color:#64748b;">${cur.updatedAt ? 'Huling sync: ' + pxE(String(cur.updatedAt).slice(0, 16).replace('T', ' ')) + ' · ' + (cur.items || []).length + ' item' : 'Hindi pa nasi-sync.'}</small>
  <div style="max-height:240px;overflow:auto;margin-top:.4rem;font-size:.8rem;">${T.map(t => `<div style="display:flex;gap:.3rem;border-bottom:1px solid #f1f5f9;padding:.2rem 0;"><b style="width:70px;">${pxE(t.name || t.id)}</b><input readonly value="${pxE(pxQrUrl(t.id))}" style="flex:1;font-size:.72rem;" onclick="this.select()"></div>`).join('') || 'Walang table sa floor plan.'}</div>`, 760);
}
async function pxQrDo(a) { try { if (a === 'sync') { const n = await pxQrSync(); pxToast('✅ Na-sync: ' + n + ' item'); } else { const c = (await db.collection('pos_pubmenu').doc(pxQrKey()).get()).data() || {}; await pxQrSync(c.open === false); } pxQrView(); } catch (e) { pxAlert('Error: ' + e.message); } }
function pxQrSheet() {
  const T = ((PX.floor || {}).tables || []), w = window.open('', '_blank'); if (!w) { pxAlert('Na-block ang popup.'); return; }
  w.document.write(`<html><head><meta charset="utf-8"><title>QR Tables</title><style>body{font-family:sans-serif}.c{display:inline-block;width:6cm;text-align:center;margin:.4cm;padding:.3cm;border:1px dashed #999;page-break-inside:avoid}.c b{font-size:20px;display:block}</style></head><body>${T.map((t, i) => `<div class="c"><b>${pxE(t.name || t.id)}</b><div id="q${i}"></div><small>I-scan para mag-order</small></div>`).join('')}<script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"><\/script><script>var U=${JSON.stringify(T.map(t => pxQrUrl(t.id)))};U.forEach(function(u,i){new QRCode(document.getElementById('q'+i),{text:u,width:180,height:180})});setTimeout(function(){window.print()},900)<\/script></body></html>`); w.document.close();
}
let PX_QR = { list: [], last: 0 };
async function pxQrPoll() {
  if (!PX.site || !PX.cfg || PX.cfg.qrOn === false) return; try { const s = await db.collection('pos_qr_orders').where('company', '==', pxCo()).where('site', '==', PX.site).where('status', '==', 'new').get(); const a = []; s.forEach(d => a.push(Object.assign({ id: d.id }, d.data()))); a.sort((x, y) => String(x.createdAt).localeCompare(String(y.createdAt))); const fresh = a.some(x => !PX_QR.list.find(y => y.id === x.id)); PX_QR.list = a;
    let bar = document.getElementById('px-qrb'); if (!a.length) { if (bar) bar.remove(); return; } if (!bar) { bar = document.createElement('div'); bar.id = 'px-qrb'; bar.style.cssText = 'position:fixed;top:.5rem;left:50%;transform:translateX(-50%);z-index:9999;background:#dc2626;color:#fff;padding:.6rem 1rem;border-radius:2rem;font-weight:800;cursor:pointer;box-shadow:0 4px 14px #0006;'; bar.onclick = pxQrInbox; document.body.appendChild(bar); } bar.textContent = '📲 ' + a.length + ' QR order — pindutin'; if (fresh) { try { new (window.AudioContext || window.webkitAudioContext)().resume(); const c = new (window.AudioContext || window.webkitAudioContext)(), o = c.createOscillator(); o.connect(c.destination); o.frequency.value = 880; o.start(); setTimeout(() => o.stop(), 250); } catch (e) {} } } catch (e) {}
}
setInterval(() => { try { pxQrPoll(); } catch (e) {} }, 15000);
function pxQrInbox() {
  const L = PX_QR.list; pxModal(`<h3 style="margin-top:0;">📲 QR orders</h3>${L.map(q => `<div style="border:1px solid #e2e8f0;border-radius:.5rem;padding:.5rem;margin:.3rem 0;"><b>${pxE(q.tableName)}</b> ${q.custName ? '· 👤 ' + pxE(q.custName) : ''} <small style="color:#64748b;">${pxE(String(q.createdAt).slice(11, 16))}</small><div style="font-size:.85rem;">${(q.items || []).map(i => i.qty + '× ' + pxE(i.name)).join(', ')}</div>${q.note ? `<div style="color:#b45309;font-size:.8rem;">📝 ${pxE(q.note)}</div>` : ''}${pxTabOf(q.tableId) ? '' : '<div style="color:#b91c1c;font-size:.8rem;">⚠ Walang bukas na table dito — buksan muna sa Tables.</div>'}<div style="display:flex;gap:.3rem;margin-top:.3rem;"><button class="btn btn-success btn-sm" onclick="pxQrAccept('${q.id}')">✅ Tanggapin → kusina</button><button class="btn btn-danger btn-sm" onclick="pxQrReject('${q.id}')">✖ Tanggihan</button></div></div>`).join('') || 'Wala.'}`, 640);
}
async function pxQrReject(id) { try { await db.collection('pos_qr_orders').doc(id).update({ status: 'rejected', by: String(pxMe().email || ''), at: new Date().toISOString() }); PX_QR.list = PX_QR.list.filter(x => x.id !== id); pxClose(); pxQrPoll(); } catch (e) { pxAlert('Error: ' + e.message); } }
async function pxQrAccept(id) {
  const q = PX_QR.list.find(x => x.id === id); if (!q) return; const t = pxTabOf(q.tableId); if (!t) { await pxAlert('Walang bukas na table para sa ' + q.tableName + '. Buksan muna ang table.'); return; }
  const M = pxMenuItems0(), items = [], skipped = []; (q.items || []).forEach(i => { const m = M.find(x => x.id === i.id); if (!m || pxIsOff(m.id)) { skipped.push(i.name); return; } items.push({ id: m.id, name: m.name, price: +m._price, qty: Math.max(1, Math.min(50, Math.floor(+i.qty) || 1)), note: '', course: +m.course || 1, held: (+m.course || 1) > 1 }); });
  if (!items.length) { await pxAlert('Walang available na item (sold out / wala na sa menu).'); return; } if (skipped.length && !await pxConfirm('Hindi available: ' + skipped.join(', ') + '. Ituloy ang iba?', { ok: 'Ituloy' })) return;
  try { const me = pxMe(), now = new Date(); let no = 0; const n = await pxTabMut(t.id, d => { no = (d.orders || []).length + 1; (d.orders = d.orders || []).push({ no, at: now.toISOString(), atMs: now.getTime(), by: String(me.email || ''), byName: String(me.name || ''), status: 'sent', chan: 'dine', owner: q.custName ? { name: q.custName } : { name: 'QR' }, qr: true, items }); }, { a: 'order', i: 'QR #' + ((t.orders || []).length + 1) });
    await db.collection('pos_qr_orders').doc(id).update({ status: 'accepted', by: String(me.email || ''), at: now.toISOString(), orderNo: no }); PX_QR.list = PX_QR.list.filter(x => x.id !== id); pxClose(); pxToast('✅ QR order → Order ' + no); pxKitchenBg(n, n.orders[no - 1], no); pxQrPoll(); } catch (e) { pxAlert('Error: ' + e.message); }
}
// Button sa Waiter tab
const _pxWaiterView0 = pxWaiterView;
pxWaiterView = async function () { const h = await _pxWaiterView0(); return h.replace('onclick="pxBody()">🔄</button>', 'onclick="pxBody()">🔄</button>' + (pxMgr() ? '<button class="btn btn-secondary" style="padding:.8rem;" onclick="pxQrView()">📲 QR</button>' : '') + '<button class="btn btn-secondary" style="padding:.8rem;" onclick="pxQrPoll().then(pxQrInbox)">📥 QR inbox</button>'); };

/* ================= GIFT CARD + LOYALTY POINTS ================= */
PX_MODES.giftcard = '🎁 Gift Card'; PX_MODES.points = '⭐ Points'; PX_PAYGROUPS.push(['Gift Card / Points', ['giftcard', 'points']]);
const pxLoy = () => Object.assign({ on: false, earn: 100, redeem: 1, min: 10 }, (PX.cfg || {}).loy || {});
const _pxPayMode1 = pxPayMode;
pxPayMode = async function (k) { if (k === 'giftcard') return pxGcPay(); if (k === 'points') return pxPtsPay(); return _pxPayMode1(k); };
const pxGcKey = c => String(c || '').toUpperCase().replace(/[^A-Z0-9-]/g, '');
async function pxGcPay() {
  const C = pxCalc(PX.cart, PX.disc), paid = PX.pays.reduce((s, p) => s + p.amount, 0), bal = pxR2(C.total - paid); if (bal <= 0.001) { await pxAlert('Bayad na ang order.'); return; }
  const raw = await pxPrompt('🎁 Series number ng gift card', { ph: 'hal. GC-000012', ok: 'Suriin', hint: 'I-type ang series number.' }); if (raw === null) return; const key = pxGcKey(raw); if (!key) return;
  let g = null; try { const d = await db.collection('pos_giftcards').doc(key).get(); g = d.exists ? Object.assign({ id: d.id }, d.data()) : null; } catch (e) { await pxAlert('Hindi ma-check: ' + e.message); return; }
  if (!g || g.company !== pxCo()) { await pxAlert('Walang gift card na ' + key + '.', '❌ Hindi nahanap'); return; } if (g.status === 'void') { await pxAlert('Void na ang gift card na ito.'); return; }
  const used = PX.pays.filter(p => p.mode === 'giftcard' && p.ref === g.id).reduce((s, p) => s + p.amount, 0), avail = pxR2((+g.balance || 0) - used); if (avail <= 0) { await pxAlert('Ubos na ang balanse ng gift card.'); return; }
  const max = Math.min(avail, bal), a = pxNum(await pxPrompt('Balanse ₱' + pxM(avail) + (g.holder ? ' · ' + g.holder : '') + '\nGaano ang ibabawas?', { def: String(max), type: 'number', ok: 'Gamitin' })); if (!(a > 0)) return; if (a > max + 0.001) { await pxAlert('Sobra. Maximum ₱' + pxM(max) + ' (walang sukli).'); return; }
  PX.pays.push({ mode: 'giftcard', amount: pxR2(a), ref: g.id, payer: g.holder || '' }); pxBody();
}
async function pxPtsPay() {
  const L = pxLoy(); if (!L.on) { await pxAlert('Hindi naka-on ang Loyalty Points (🎁 Gift Card / Points tab → Settings).'); return; } if (!PX.member) { await pxAlert('Pumili muna ng member.'); return; }
  const mm = PX.members.find(x => x.id === PX.member.id) || PX.member, pts = Math.floor(+mm.points || 0) - PX.pays.filter(p => p.mode === 'points').reduce((s, p) => s + p.pts, 0), C = pxCalc(PX.cart, PX.disc), bal = pxR2(C.total - PX.pays.reduce((s, p) => s + p.amount, 0));
  if (pts < L.min) { await pxAlert(mm.name + ' ay may ' + Math.max(0, pts) + ' pts lang (minimum ' + L.min + ').'); return; } if (bal <= 0.001) { await pxAlert('Bayad na ang order.'); return; }
  const maxPts = Math.min(pts, Math.floor(bal / L.redeem)), n = Math.floor(pxNum(await pxPrompt(mm.name + ' — ' + pts + ' pts (₱' + L.redeem + '/pt)\nIlang points ang gagamitin?', { def: String(maxPts), type: 'number', ok: 'Gamitin' }))); if (!(n > 0)) return; if (n > maxPts) { await pxAlert('Sobra. Maximum ' + maxPts + ' pts.'); return; }
  PX.pays.push({ mode: 'points', amount: pxR2(n * L.redeem), pts: n, ref: mm.mid || mm.id, payer: mm.name }); pxBody();
}
async function pxGcConsume(pays, saleNo) {
  const done = []; for (const p of pays) { try {
    if (p.mode === 'giftcard') await db.runTransaction(async tx => { const r = db.collection('pos_giftcards').doc(p.ref), d = await tx.get(r), g = d.exists ? d.data() : null; if (!g || g.status === 'void' || (+g.balance || 0) + 0.001 < p.amount) throw new Error('Kulang na ang balanse ng ' + p.ref + '.'); tx.update(r, { balance: pxR2(g.balance - p.amount), log: (g.log || []).concat([{ t: 'use', amt: p.amount, sale: saleNo, at: new Date().toISOString(), by: String(pxMe().email || '') }]) }); });
    else { const mm = PX.members.find(x => x.id === (PX.member || {}).id); if (!mm) throw new Error('Walang member.'); await db.runTransaction(async tx => { const r = db.collection('pos_members').doc(mm.id), d = await tx.get(r), cur = Math.floor(+((d.data() || {}).points) || 0); if (cur < p.pts) throw new Error('Kulang na ang points ni ' + mm.name + '.'); tx.update(r, { points: cur - p.pts }); }); mm.points = Math.floor(+mm.points || 0) - p.pts; p._mid = mm.id; }
    done.push(p); } catch (e) { for (const c of done) { try { await pxGcUndo(c, saleNo); } catch (x) {} } await pxAlert('Hindi magamit: ' + (e.message || e), '🎁 Gift Card / Points'); return false; } }
  return true;
}
async function pxGcUndo(p, saleNo) {
  if (p.mode === 'giftcard') await db.runTransaction(async tx => { const r = db.collection('pos_giftcards').doc(p.ref), d = await tx.get(r), g = d.data() || {}; tx.update(r, { balance: pxR2((+g.balance || 0) + p.amount), log: (g.log || []).concat([{ t: 'restore', amt: p.amount, sale: saleNo, at: new Date().toISOString() }]) }); });
  else { const id = p._mid || (PX.member || {}).id; if (!id) return; await db.runTransaction(async tx => { const r = db.collection('pos_members').doc(id), d = await tx.get(r); tx.update(r, { points: Math.floor(+((d.data() || {}).points) || 0) + p.pts }); }); const mm = PX.members.find(x => x.id === id); if (mm) mm.points = Math.floor(+mm.points || 0) + p.pts; }
}
async function pxGcRelease(sale) { for (const p of (sale.pays || []).filter(x => x.mode === 'giftcard' || x.mode === 'points')) { try { await pxGcUndo(p.mode === 'points' && !p._mid ? Object.assign({}, p, { _mid: (sale.member || {}).id }) : p, sale.no); } catch (e) {} } }
async function pxLoyEarn(sale) {
  const L = pxLoy(); if (!L.on || !sale.member || !(L.earn > 0)) return; const spent = sale.total - (sale.pays || []).filter(p => ['voucher', 'giftcard', 'points', 'member', 'org'].includes(p.mode)).reduce((s, p) => s + p.amount, 0) + 0; const pts = Math.floor(Math.max(0, spent) / L.earn); if (pts <= 0) return;
  const id = sale.member.id; await db.runTransaction(async tx => { const r = db.collection('pos_members').doc(id), d = await tx.get(r); tx.update(r, { points: Math.floor(+((d.data() || {}).points) || 0) + pts }); }); const mm = PX.members.find(x => x.id === id); if (mm) mm.points = Math.floor(+mm.points || 0) + pts; sale.pointsEarned = pts; try { await db.collection('pos_sales').doc(sale.id).update({ pointsEarned: pts }); } catch (e) {} pxToast('⭐ +' + pts + ' pts kay ' + sale.member.name);
}
async function pxLoyReverse(s) { if (!(+s.pointsEarned > 0) || !s.member) return; const id = s.member.id; await db.runTransaction(async tx => { const r = db.collection('pos_members').doc(id), d = await tx.get(r); tx.update(r, { points: Math.max(0, Math.floor(+((d.data() || {}).points) || 0) - s.pointsEarned) }); }); const mm = PX.members.find(x => x.id === id); if (mm) mm.points = Math.max(0, Math.floor(+mm.points || 0) - s.pointsEarned); }
// ---- Admin/Manager screen ----
let PX_GC = { list: [], q: '' };
async function pxGcLoad() { const s = await db.collection('pos_giftcards').where('company', '==', pxCo()).get(); PX_GC.list = []; s.forEach(d => PX_GC.list.push(Object.assign({ id: d.id }, d.data()))); }
async function pxGcView() {
  await pxGcLoad(); const q = pxNorm(PX_GC.q).split(/\s+/).filter(Boolean), L = PX_GC.list.filter(g => q.every(w => pxNorm(g.id + ' ' + (g.holder || '')).includes(w))).sort((a, b) => String(a.id).localeCompare(String(b.id), undefined, { numeric: true })), lo = pxLoy();
  return pxHint('📖 <b>Gift card</b>: may series number at balanse; puwedeng magamit nang paunti-unti (walang sukli sa sobra). <b>Loyalty Points</b>: kumikita ang member ng 1 pt bawat ₱' + lo.earn + ' na binayad (hindi kasama ang voucher/gift card/points/charge) at puwedeng gamiting bayad. Naka-' + (lo.on ? '<b>ON</b>' : '<b>OFF</b>') + '.') +
  `<div style="display:flex;gap:.4rem;flex-wrap:wrap;margin-bottom:.4rem;"><button class="btn btn-primary btn-sm" onclick="pxGcNew()">➕ Mag-issue</button><button class="btn btn-secondary btn-sm" onclick="pxLoySet()">⚙ Loyalty settings</button><input type="search" placeholder="🔎 Series o pangalan" value="${pxE(PX_GC.q)}" oninput="PX_GC.q=this.value;clearTimeout(window._gq);window._gq=setTimeout(pxBody,350)" style="flex:1;min-width:160px;"></div>
  <div style="overflow:auto;"><table class="table" style="font-size:.85rem;"><tr><th>Series</th><th>May-ari</th><th style="text-align:right;">Inisyal</th><th style="text-align:right;">Balanse</th><th>Status</th><th></th></tr>${L.slice(0, 300).map(g => `<tr><td><b>${pxE(g.id)}</b></td><td>${pxE(g.holder || '')}</td><td style="text-align:right;">₱${pxM(g.value)}</td><td style="text-align:right;font-weight:700;">₱${pxM(g.balance)}</td><td>${g.status === 'void' ? '⛔ Void' : (+g.balance > 0 ? '✅ Active' : '✔ Ubos')}</td><td>${g.status === 'void' ? '' : `<button class="btn btn-secondary btn-sm" onclick="pxGcLoadUp('${pxE(g.id)}')">➕ Load</button><button class="btn btn-danger btn-sm" onclick="pxGcVoid('${pxE(g.id)}')">⛔</button>`}</td></tr>`).join('') || '<tr><td colspan="6"><small>Wala pang gift card.</small></td></tr>'}</table></div>`;
}
async function pxGcNew() {
  const pre = String(await pxPrompt('Prefix ng series', { def: 'GC', ok: 'Susunod' }) || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, ''); if (pre === '' && pre !== 'GC') { /* blangko ay OK */ }
  const n = Math.floor(pxNum(await pxPrompt('Ilang card ang iisyu?', { def: '1', type: 'number', ok: 'Susunod' }))); if (!(n >= 1 && n <= 500)) return; const val = pxNum(await pxPrompt('Halaga bawat card (₱)', { def: '500', type: 'number', ok: 'Susunod' })); if (!(val > 0)) return; const holder = n === 1 ? String(await pxPrompt('Nakapangalan kay (opsyonal)', { ok: 'I-issue' }) || '').trim() : '';
  let mx = 0; PX_GC.list.forEach(g => { const m = String(g.id).match(/(\d+)$/); if (m) mx = Math.max(mx, +m[1]); }); const ops = [], now = new Date().toISOString(); for (let i = 1; i <= n; i++) { const id = (pre ? pre + '-' : '') + String(mx + i).padStart(6, '0'); ops.push({ t: 'set', col: 'pos_giftcards', id, d: { company: pxCo(), value: val, balance: val, holder, status: 'active', createdAt: now, createdBy: String(pxMe().email || ''), log: [{ t: 'issue', amt: val, at: now, by: String(pxMe().email || '') }] } }); }
  if (!await pxConfirm('Mag-issue ng ' + n + ' gift card × ₱' + pxM(val) + '?\n(Tandaan: i-record ang bayad ng customer sa cash register.)', { ok: 'I-issue' })) return; try { await pxBatch(ops); pxToast('✅ ' + n + ' gift card'); pxBody(); } catch (e) { pxAlert('Error: ' + e.message); }
}
async function pxGcLoadUp(id) { const a = pxNum(await pxPrompt('Dagdag na halaga (₱) para sa ' + id, { type: 'number', ok: 'I-load' })); if (!(a > 0)) return; try { await db.runTransaction(async tx => { const r = db.collection('pos_giftcards').doc(id), d = await tx.get(r), g = d.data() || {}; tx.update(r, { balance: pxR2((+g.balance || 0) + a), value: pxR2((+g.value || 0) + a), log: (g.log || []).concat([{ t: 'load', amt: a, at: new Date().toISOString(), by: String(pxMe().email || '') }]) }); }); pxBody(); } catch (e) { pxAlert('Error: ' + e.message); } }
async function pxGcVoid(id) { if (!await pxPin('Kailangan ng PIN para i-void ang gift card.')) return; if (!await pxConfirm('I-void ang ' + id + '? Mawawala ang balanse.', { ok: 'I-void' })) return; try { await db.collection('pos_giftcards').doc(id).update({ status: 'void', voidAt: new Date().toISOString(), voidBy: String(pxMe().email || '') }); pxBody(); } catch (e) { pxAlert('Error: ' + e.message); } }
async function pxLoySet() {
  const L = pxLoy(); pxModal(`<h3 style="margin-top:0;">⚙ Loyalty Points</h3><label><input type="checkbox" id="ly-on" ${L.on ? 'checked' : ''}> I-on ang loyalty points</label><div style="margin:.4rem 0;">Kumikita ng 1 pt bawat ₱ <input id="ly-earn" type="number" value="${L.earn}" style="width:90px;"> na binayad</div><div style="margin:.4rem 0;">1 pt = ₱ <input id="ly-red" type="number" step="any" value="${L.redeem}" style="width:90px;"> pagbabayad</div><div style="margin:.4rem 0;">Minimum na points para gamitin: <input id="ly-min" type="number" value="${L.min}" style="width:90px;"></div><button class="btn btn-success" onclick="pxLoySave()">💾 I-save</button>`, 480);
}
async function pxLoySave() { const v = id => document.getElementById(id), loy = { on: v('ly-on').checked, earn: Math.max(1, pxNum(v('ly-earn').value) || 100), redeem: Math.max(0.01, pxNum(v('ly-red').value) || 1), min: Math.max(1, Math.floor(pxNum(v('ly-min').value)) || 1) }; try { await db.collection('pos_setup').doc(pxSlug(pxCo())).set({ company: pxCo(), loy }, { merge: true }); PX.cfg = Object.assign({}, PX.cfg, { loy }); pxClose(); pxBody(); } catch (e) { pxAlert('Error: ' + e.message); } }

/* ================= Generic Google-like search (sorted token index + binary lower-bound) ================= */
function pxIdxBuild(list, textOf) { const A = []; list.forEach((x, i) => { new Set(pxNorm(textOf(x)).split(/[^a-z0-9ñ]+/).filter(Boolean)).forEach(t => A.push([t, i])); }); A.sort((a, b) => a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : a[1] - b[1]); return A; }
function pxIdxFind(list, A, q) { const words = pxNorm(q).split(/[^a-z0-9ñ]+/).filter(Boolean); if (!words.length) return list.slice(); let acc = null; for (const w of words) { const set = new Set(); for (let i = pxMsLower(A, w); i < A.length && A[i][0].startsWith(w); i++) set.add(A[i][1]); if (!set.size) for (let j = 0; j < A.length; j++) if (A[j][0].includes(w)) set.add(A[j][1]); acc = acc ? new Set([...acc].filter(x => set.has(x))) : set; if (!acc.size) break; } return [...acc].sort((a, b) => a - b).map(i => list[i]); }
/* ================= CLUB MEMBERS: idagdag / alisin, may Hanapin ================= */
let PX_CM = { cid: '', q: '', aq: '', sel: {} };
function pxClubMembers(cid) { PX_CM = { cid, q: '', aq: '', sel: {} }; pxCmDraw(); }
function pxCmDraw() {
  const cl = PX.clubs.find(c => c.id === PX_CM.cid); if (!cl) return; const all = PX.members || [], inClub = all.filter(m => m.clubId === cl.id), isP = m => !pxMemParent(m);
  const cur = pxIdxFind(inClub, pxIdxBuild(inClub, m => (m.mid || '') + ' ' + (m.name || '')), PX_CM.q), cand = all.filter(m => m.clubId !== cl.id && isP(m)), res = PX_CM.aq.trim() ? pxIdxFind(cand, pxIdxBuild(cand, m => (m.mid || '') + ' ' + (m.name || '') + ' ' + (m.club || '')), PX_CM.aq) : [];
  const nSel = Object.keys(PX_CM.sel).filter(k => PX_CM.sel[k]).length;
  pxModal(`<h3 style="margin-top:0;">👥 ${pxE(cl.name)} — mga member</h3>
  <div style="border:1px solid #bfdbfe;background:#eff6ff;border-radius:.5rem;padding:.5rem;margin-bottom:.5rem;"><b>➕ Magdagdag ng member</b>${pxHint('📖 I-type ang ID o pangalan (kahit gitna ng salita) tapos pindutin ang <b>Hanapin</b> o Enter. Sumusunod ang asawa/anak sa club ng principal.')}
  <div style="display:flex;gap:.3rem;"><input id="cm-aq" placeholder="🔎 ID o pangalan" value="${pxE(PX_CM.aq)}" style="flex:1;" onkeydown="if(event.key==='Enter')pxCmFind()"><button class="btn btn-primary btn-sm" onclick="pxCmFind()">Hanapin</button></div>
  ${PX_CM.aq.trim() ? `<div style="max-height:200px;overflow:auto;margin-top:.3rem;">${res.slice(0, 100).map(m => `<label style="display:flex;gap:.4rem;font-size:.85rem;padding:.15rem 0;"><input type="checkbox" ${PX_CM.sel[m.id] ? 'checked' : ''} onchange="PX_CM.sel['${m.id}']=this.checked"><span><b>${pxE(m.name)}</b> <small>${pxE(m.mid || '')}${m.club ? ' · ngayon: ' + pxE(m.club) : ''}</small></span></label>`).join('') || '<small>Walang nahanap (principal lang ang lumalabas).</small>'}</div><button class="btn btn-success btn-sm" style="margin-top:.3rem;" onclick="pxCmAdd()">✅ Idagdag ang napili</button> <button class="btn btn-secondary btn-sm" onclick="pxCmAll()">☑️ Piliin lahat ng resulta (${res.length})</button>` : ''}</div>
  <b>Kasalukuyang member (${inClub.length})</b><div style="display:flex;gap:.3rem;margin:.3rem 0;"><input id="cm-q" placeholder="🔎 Hanapin sa club" value="${pxE(PX_CM.q)}" style="flex:1;" onkeydown="if(event.key==='Enter')pxCmCur()"><button class="btn btn-secondary btn-sm" onclick="pxCmCur()">Hanapin</button></div>
  <div style="max-height:260px;overflow:auto;">${cur.slice(0, 200).map(m => `<div style="display:flex;justify-content:space-between;align-items:center;font-size:.85rem;border-bottom:1px solid #f1f5f9;padding:.2rem 0;"><span>${pxE(m.name)} <small>${pxE(m.mid || '')}${pxMemParent(m) ? ' · ' + pxE(m.rel || 'dependent') : ''}</small></span>${pxMemParent(m) ? '' : `<button class="btn btn-danger btn-sm" onclick="pxCmRemove('${m.id}')">Alisin</button>`}</div>`).join('') || '<small>Wala pang member.</small>'}</div>`, 700);
}
function pxCmFind() { PX_CM.aq = (document.getElementById('cm-aq') || {}).value || ''; PX_CM.sel = {}; pxCmDraw(); }
function pxCmCur() { PX_CM.q = (document.getElementById('cm-q') || {}).value || ''; pxCmDraw(); }
function pxCmAll() { const cl = PX.clubs.find(c => c.id === PX_CM.cid), cand = (PX.members || []).filter(m => m.clubId !== cl.id && !pxMemParent(m)), res = pxIdxFind(cand, pxIdxBuild(cand, m => (m.mid || '') + ' ' + (m.name || '') + ' ' + (m.club || '')), PX_CM.aq); PX_CM.sel = {}; res.forEach(m => { PX_CM.sel[m.id] = true; }); pxCmDraw(); }
async function pxCmSet(ids, cl) {
  const set = new Map(); ids.forEach(id => { const m = PX.members.find(x => x.id === id); if (!m) return; set.set(m.id, m); pxMemDeps(m).forEach(x => set.set(x.id, x)); }); const arr = [...set.values()]; let done = 0, fail = 0; const tk = typeof kTask === 'function' ? kTask((cl ? 'Pagdagdag sa ' + cl.name : 'Pag-alis sa club'), arr.length) : null;
  for (let i = 0; i < arr.length; i += 20) { await Promise.all(arr.slice(i, i + 20).map(async m => { try { const u = cl ? { club: cl.name, clubId: cl.id } : { club: '', clubId: '' }; await db.collection('pos_members').doc(m.id).update(u); Object.assign(m, u); done++; } catch (e) { fail++; } })); if (tk) tk.set(done + fail); }
  PX._ms = null; if (tk) tk.done(fail ? done + ' ok, ' + fail + ' pumalya' : done + ' member'); return { done, fail };
}
async function pxCmAdd() { const cl = PX.clubs.find(c => c.id === PX_CM.cid), ids = Object.keys(PX_CM.sel).filter(k => PX_CM.sel[k]); if (!ids.length) { await pxAlert('Wala pang napili.'); return; } if (!await pxConfirm('Idagdag ang ' + ids.length + ' member sa "' + cl.name + '"?', { ok: 'Idagdag' })) return; const r = await pxCmSet(ids, cl); try { await logSystemAction('POS_CLUB_ADD', cl.name + ': ' + r.done); } catch (e) {} PX_CM.sel = {}; PX_CM.aq = ''; pxCmDraw(); }
async function pxCmRemove(id) { const cl = PX.clubs.find(c => c.id === PX_CM.cid), m = PX.members.find(x => x.id === id); if (!m || !await pxConfirm('Alisin si ' + m.name + ' (at ang asawa/anak) sa "' + cl.name + '"?', { ok: 'Alisin' })) return; await pxCmSet([id], null); try { await logSystemAction('POS_CLUB_REMOVE', cl.name + ': ' + m.name); } catch (e) {} pxCmDraw(); }

/* ================= ❓ Tulong / FAQ (help.js) ================= */
async function pxHelpView() {
  setTimeout(() => { const r = document.getElementById('px-help-root'); if (r && window.kHelp) kHelp.mount(r, { ctx: 'pos', user: { email: String(pxMe().email || ''), name: String(pxMe().name || '') }, admin: pxAdmin() }); }, 30);
  return '<div id="px-help-root" style="padding:.3rem;"></div>';
}

/* ================= TAKEOVER GUARD: isara ang modal/order screen kapag inagaw na ang table ================= */
function pxLockWatch(force) {
  const ids = new Set(); if (PX._lk) ids.add(PX._lk); if (PX.ctx && PX.ctx.tabId) ids.add(PX.ctx.tabId); let hit = null;
  ids.forEach(id => { if (hit) return; const t = (PX.tabs || []).find(x => x.id === id); if (PX._tlOk === false && !force) return; if (!t) { if (PX._tlOk) hit = { id, why: 'gone' }; return; } const lo = pxLockOther(t); if (lo) hit = { id, name: lo.name || lo.by || 'ibang user', table: t.tableName }; });
  if (!hit) return false;
  const id = hit.id, m = document.getElementById('px-modal'); if (m && m.style.display !== 'none' && (PX._lk === id || !PX._lk)) m.style.display = 'none'; PX._lk = null;
  if (PX.ctx && PX.ctx.tabId === id) { PX.ctx = null; PX.cart = []; try { pxResetPay(); } catch (e) {} PX.tab = 'tables'; }
  pxToast(hit.why === 'gone' ? '⚠️ Wala na ang table tab (na-settle o na-cancel ng iba).' : '⚠️ Kinuha na ni ' + hit.name + ' ang ' + (hit.table || 'table') + '. Isinara ang screen mo.');
  try { pxRender(); } catch (e) {} return true;
}
const _pxLiveRepaint0 = pxLiveRepaint; pxLiveRepaint = function () { try { pxLockWatch(); } catch (e) {} return _pxLiveRepaint0.apply(this, arguments); };
const _pxOrderSend0 = pxOrderSend; pxOrderSend = async function () { const t = pxCtxTab(); if (t && pxLockOther(t)) { const n = pxLockOther(t).name || 'ibang user'; pxLockWatch(true); await pxAlert('Hindi maipapadala: kinuha na ni ' + n + ' ang table na ito. Walang naipadala sa kusina.', '🔒 Na-takeover'); return; } return _pxOrderSend0.apply(this, arguments); };

/* ================= MANAGER MODE • REOPEN • RECEIPT CHECK ================= */
function pxMgrBtn() { if (pxMgr()) return ''; return PX.mgrOn ? `<button class="btn btn-danger btn-sm" style="margin-left:.3rem;" onclick="pxMgrToggle()">🔓 Manager mode ON — i-off</button>` : `<button class="btn btn-secondary btn-sm" style="margin-left:.3rem;" onclick="pxMgrToggle()">🔐 Manager</button>`; }
async function pxMgrToggle() {
  if (PX.mgrOn) { PX.mgrOn = false; pxToast('Balik sa Cashier role'); pxBody(); return; }
  PX.mgrOn = false; const ok = await pxPin('Ilagay ang code ng Manager para sa void, discount at pagbabago ng presyo.'); if (!ok) return;
  PX.mgrOn = true; pxToast('🔓 Manager mode ON — puwede na ang void, discount, presyo'); pxBody();
}
const _pxRender0 = pxRender; pxRender = function () { if (PX.tab !== 'pos' && PX.tab !== 'tables') PX.mgrOn = false; return _pxRender0.apply(this, arguments); };
async function pxReopen(i) {
  const s = PX.sl[i]; if (!s || s.status === 'void' || !s.tabId) return; if (!await pxPin('Kailangan ng code ng Manager para i-reopen ang na-settle na order.')) return;
  const why = await pxVoidWhy('Bakit ire-reopen ang ' + s.no + '?'); if (!why) return;
  if ((PX.tabs || []).some(t => t.status === 'open' && t.id !== s.tabId && t.tableName === s.tableName)) { await pxAlert('May ibang bukas na order na sa table na ' + s.tableName + '. I-settle muna iyon bago i-reopen ito.'); return; }
  try {
    await pxTabMut(s.tabId, d => { d.status = 'open'; delete d.closedAt; d.bills = (d.bills || []).filter(b => b.saleId !== s.id && b.status === 'paid'); d.billPrintedMs = 0; d.reopened = (d.reopened || 0) + 1; }, { a: 'reopen', i: s.no + ' — ' + why });
    await db.collection('pos_sales').doc(s.id).update({ status: 'void', reopened: true, void: { by: String(pxMe().email || ''), reason: 'REOPEN: ' + why, at: new Date().toISOString() } });
    try { await pxVchRelease(s); } catch (e) {} try { await pxGcRelease(s); await pxLoyReverse(s); } catch (e) {} try { await logSystemAction('POS_REOPEN', s.no + ': ' + why); } catch (e) {}
    pxToast('↩️ Ibinalik sa ' + (s.tableName || 'table') + ' — nasa 🍽️ Tables na ulit; ayusin, i-print ang bill, saka i-settle'); PX.tab = 'tables'; pxRender();
  } catch (e) { pxAlert('Hindi na-reopen: ' + e.message); }
}
PX_HA.reopen = '↩️ Na-reopen mula sa settled';
async function pxCheckView() {
  const b = document.getElementById('px-body'); if (!b) return; const d = PX.cdate || (PX.cdate = pxBiz());
  b.innerHTML = `<div class="card"><b>🔎 Receipt Check</b>${pxHint('Hawak mo ang resibo/order slip? Ilagay ang <b>SI / OR / order number</b> o <b>pangalan ng table</b> para makita kung pumasok na sa system. Pang-tingin lang ito — hindi ka makakapagbago.')}
  <div style="display:flex;gap:.4rem;flex-wrap:wrap;"><input id="ck-q" placeholder="SI no. / order no. / table" style="flex:1;min-width:180px;" onkeydown="if(event.key==='Enter')pxCheckGo()"><input type="date" id="ck-d" value="${pxE(d)}"><button class="btn btn-primary" onclick="pxCheckGo()">🔎 Hanapin</button></div><div id="ck-r" style="margin-top:.5rem;"></div></div>`;
}
async function pxCheckGo() {
  const q = String(document.getElementById('ck-q').value || '').trim().toLowerCase(), d = document.getElementById('ck-d').value, out = document.getElementById('ck-r'); PX.cdate = d; if (!q) { out.innerHTML = '<small>Maglagay muna ng hahanapin.</small>'; return; }
  out.innerHTML = '<small>Hinahanap…</small>'; let L = [];
  try { L = await pxLoadSales(d); } catch (e) { out.innerHTML = 'Error: ' + pxE(e.message); return; }
  const has = (...v) => v.some(x => String(x == null ? '' : x).toLowerCase().includes(q));
  const hit = L.filter(s => has(s.no, s.siNo, s.orNo, s.tableName, s.platRef, s.billNo && 'bill ' + s.billNo));
  const tabs = (PX.tabs || []).filter(t => t.status === 'open' && t.site === PX.site && has(t.tableName, t.id));
  let H = hit.map(s => `<div style="border:2px solid ${s.status === 'void' ? '#dc2626' : '#16a34a'};border-radius:.5rem;padding:.5rem;margin-bottom:.4rem;"><b>${s.status === 'void' ? '⛔ VOID' : '✅ Nasa system — bayad na'}</b> · ${pxE(s.no)}${s.siNo ? ' · SI ' + pxE(s.siNo) : ''}${s.orNo ? ' · OR ' + pxE(s.orNo) : ''}<br><small>${new Date(s.atMs).toLocaleString('en-PH')} · ${s.tableName ? '🍽️ ' + pxE(s.tableName) + ' · ' : ''}Cashier: ${pxE(s.cashier)}</small><br>${(s.items || []).map(l => (+(+l.qty).toFixed(3)) + '× ' + pxE(l.name)).join(', ')}<br><b>Total ₱${pxM(s.total)}</b> · ${(s.pays || []).map(p => pxE((PX_MODES[p.mode] || '').replace(/^\S+\s/, ''))).join('+')}${s.status === 'void' && s.void ? '<br><small>Dahilan: ' + pxE(s.void.reason || '') + '</small>' : ''}</div>`).join('');
  H += tabs.map(t => `<div style="border:2px solid #f59e0b;border-radius:.5rem;padding:.5rem;margin-bottom:.4rem;"><b>🟡 Bukas pa ang table — hindi pa bayad</b> · 🍽️ ${pxE(t.tableName)}<br><small>${pxE(((t.orders || []).filter(o => o.status !== 'void').map(o => (o.items || []).length).reduce((a, b) => a + b, 0)) + ' item(s) na naka-order')}</small></div>`).join('');
  out.innerHTML = H || '<b style="color:#b91c1c;">Walang nahanap sa petsang ito.</b><br><small>Baka hindi pa pumasok sa system, mali ang numero, o ibang petsa. Subukan ang ibang petsa o ipa-check sa manager.</small>';
}

/* ================= NAIWANG BUKAS NA TABLE (kahapon pa) ================= */
const pxStale = t => t && t.status === 'open' && t.site === PX.site && (t.openedMs || 0) && pxBiz(t.openedMs) < pxBiz();
PX_HA.latesettle = '⏰ Late settle (aprub ng manager)';
async function pxStaleCancel(id) {
  if (!await pxPin('Kailangan ng code ng Manager para i-cancel ang naiwang order.')) return; const why = await pxVoidWhy('Bakit ica-cancel ang naiwang table?'); if (!why) return;
  try { await pxTabMut(id, d => { d.status = 'cancelled'; d.cancelReason = 'Naiwang bukas mula ' + pxBiz(d.openedMs) + ': ' + why; d.closedAt = new Date().toISOString(); d.staleCancel = true; }, { a: 'cancel', i: 'stale: ' + why }); try { await logSystemAction('POS_STALE_CANCEL', id + ': ' + why); } catch (e) {} PX.tabs = PX.tabs.filter(x => x.id !== id); pxRender(); } catch (e) { pxAlert('Error: ' + e.message); }
}
function pxStaleBanner() {
  const b = document.getElementById('px-body'); if (!b) return; const L = (PX.tabs || []).filter(pxStale); const old = document.getElementById('px-stale'); if (old) old.remove(); if (!L.length) return;
  const d = document.createElement('div'); d.id = 'px-stale'; d.className = 'card'; d.style.cssText = 'border:2px solid #dc2626;background:#fef2f2;';
  d.innerHTML = `<b style="color:#b91c1c;">⛔ May ${L.length} naiwang bukas na table mula sa nakaraang araw</b>${pxHint('Hindi puwedeng ihabol sa ibang petsa ang benta. Kung <b>test o walang nagbayad</b>: i-cancel (hindi ito bibilangin sa benta at walang bawas sa ideal inventory). Kung <b>totoong may bayad kahapon na nakalimutan</b>: manager lang ang puwedeng mag-settle; mala-late settle ito at nakatala.')}${L.map(t => `<div style="display:flex;gap:.4rem;align-items:center;margin-top:.3rem;"><span style="flex:1;">🍽️ <b>${pxE(t.tableName)}</b> · bukas noong ${pxE(pxBiz(t.openedMs))} · ₱${pxM(pxTabSub(t))}</span><button class="btn btn-danger btn-sm" onclick="pxStaleCancel('${t.id}')">⛔ I-cancel</button></div>`).join('')}`;
  b.prepend(d);
}
const _pxFloorView0 = pxFloorView; pxFloorView = async function () { const r = await _pxFloorView0.apply(this, arguments); try { pxStaleBanner(); } catch (e) {} return r; };
const _pxCheckout0 = pxCheckout; pxCheckout = async function () {
  const t = PX.ctx && pxCtxTab(); if (t && pxStale(t)) { if (!await pxPin('Naiwang order mula ' + pxBiz(t.openedMs) + '. Manager lang ang puwedeng mag-settle nito (late settle, nakatala), o i-cancel na lang kung test.')) return; try { await pxTabMut(t.id, d => { d.lateFrom = pxBiz(d.openedMs); }, { a: 'latesettle', i: 'mula ' + pxBiz(t.openedMs) }); } catch (e) {} }
  return _pxCheckout0.apply(this, arguments);
};

/* ================= BRANCH ISOLATION (opt-in, Admin) ================= */
async function pxIsoCard() {
  const b = document.getElementById('px-body'); if (!b || !pxAdmin() || document.getElementById('px-iso')) return; let on = false; try { const s = await db.collection('system_settings').doc('security_policy').get(); on = !!(s.exists && s.data().branchIsolation); } catch (e) {}
  const d = document.createElement('div'); d.id = 'px-iso'; d.className = 'card';
  d.innerHTML = `<b>🔒 Branch isolation (seguridad)</b>${pxHint('Kapag <b>ON</b>, ang branch user ay makakapagsulat lang ng <b>benta, table at shift ng sarili niyang branch</b> (hindi na puwedeng mangialam sa ibang branch). <b>Unahin ang 1️⃣ I-sync</b> para malagyan ang bawat branch user ng listahan ng branch niya, tapos 2️⃣ I-ON. Kapag may nag-error na cashier, i-OFF muna. Super Admin lang ang makakapag-ON/OFF.')}
  <div style="display:flex;gap:.4rem;flex-wrap:wrap;">${pxBtn('btn-secondary', '1️⃣ I-sync ang branch ng mga user', 'pxIsoSync()')}${pxBtn(on ? 'btn-danger' : 'btn-primary', on ? '🔓 I-OFF ang isolation' : '2️⃣ I-ON ang isolation', `pxIsoSet(${!on})`)}<span style="align-self:center;">Ngayon: <b>${on ? '🟢 ON' : '⚪ OFF'}</b></span></div><div id="px-iso-r" style="font-size:.85rem;margin-top:.4rem;"></div>`;
  b.appendChild(d);
}
async function pxIsoSync() {
  const r = document.getElementById('px-iso-r'); r.textContent = 'Sini-sync…'; let n = 0, skip = [], bad = [];
  try {
    const sites = []; (await db.collection('inventory_branches').get()).forEach(x => { const v = x.data(); sites.push({ key: pxSlug(v.code || v.branch), name: String(v.branch || '').toLowerCase(), code: String(v.code || '').toLowerCase() }); });
    const us = await db.collection('users').get();
    for (const u of us.docs) {
      const x = u.data(), role = String(x.role || '').toLowerCase(); if (/admin|accounting|head/.test(role)) continue; const want = [String(x.branch || ''), ...(x.branches || [])].map(v => String(v).trim().toLowerCase()).filter(Boolean); if (!want.length) { if (/branch|store|outlet/.test(role)) skip.push(u.id); continue; }
      const keys = [...new Set(sites.filter(s => want.includes(s.name) || want.includes(s.code)).map(s => s.key))];
      if (JSON.stringify(keys) === JSON.stringify(x.posSites || [])) continue;
      try { await db.collection('users').doc(u.id).update({ posSites: keys }); n++; } catch (e) { bad.push(u.id); }
    }
    r.innerHTML = `✅ Na-update: <b>${n}</b> user.${skip.length ? '<br>⚠️ Walang branch na naka-set (hindi makakapag-POS kapag ON): ' + pxE(skip.join(', ')) : ''}${bad.length ? '<br>⛔ Hindi na-update: ' + pxE(bad.join(', ')) : ''}`;
  } catch (e) { r.textContent = 'Error: ' + e.message; }
}
async function pxIsoSet(v) {
  if (v && !await pxConfirm('I-ON ang branch isolation? Siguraduhing na-sync na ang mga user. Kung may cashier na hindi makapag-save, i-OFF ito ulit.', { ok: 'I-ON' })) return;
  try { await db.collection('system_settings').doc('security_policy').set({ branchIsolation: !!v }, { merge: true }); pxToast(v ? '🔒 ON' : '🔓 OFF'); const o = document.getElementById('px-iso'); if (o) o.remove(); pxIsoCard(); } catch (e) { pxAlert('Hindi na-save (Super Admin lang): ' + e.message); }
}
const _pxSetupView0 = pxSetupView; pxSetupView = async function () { const r = await _pxSetupView0.apply(this, arguments); try { setTimeout(pxIsoCard, 50); } catch (e) {} return r; };

/* ================= USB CASHIER PRINTER (Windows) — silent print + test ================= */
function pxUsbCard() {
  const b = document.getElementById('px-body'); if (!b || document.getElementById('px-usb')) return;
  const d = document.createElement('div'); d.id = 'px-usb'; d.className = 'card';
  d.innerHTML = `<b>🖨️ USB cashier printer (Windows)</b>${pxHint('Para <b>derecho print</b> ang resibo/bill (walang lalabas na print window), gamitin ang Chrome sa <b>kiosk-printing mode</b>. Isang beses lang ang setup sa bawat cashier PC.')}
  <ol style="margin:.3rem 0 .5rem 1.1rem;font-size:.85rem;line-height:1.5;">
   <li>Ikabit ang USB printer at i-install ang <b>driver</b> nito (galing sa manufacturer o Windows Update). Dapat lumabas ito sa <i>Settings → Printers &amp; scanners</i>.</li>
   <li>I-set ito bilang <b>Default printer</b>. Sa Printing preferences, piliin ang tamang <b>paper size</b> (58mm o 80mm roll) at alisin ang margins.</li>
   <li>Pindutin ang <b>⬇️ I-download ang Chrome shortcut (.bat)</b> sa ibaba. Ilagay ang file sa Desktop. <b>Isara muna ang lahat ng Chrome window</b>, tapos ito na ang gamitin mong pambukas ng POS.</li>
   <li>Pindutin ang <b>🧪 Test print</b>. Kung kusa itong naglabas sa printer, tapos na.</li>
  </ol>
  <div style="display:flex;gap:.4rem;flex-wrap:wrap;">${pxBtn('btn-secondary', '⬇️ I-download ang Chrome shortcut (.bat)', 'pxUsbBat()')}${pxBtn('btn-primary', '🧪 Test print', 'pxUsbTest()')}</div>
  <small style="color:#64748b;">Kapag may lumabas na print window, hindi pa nakabukas sa kiosk mode ang Chrome (gamitin ang .bat). Ang pang-kusina na network printer (IP:9100) ay hiwalay na setup sa Stations.</small>`;
  b.appendChild(d);
}
function pxUsbBat() {
  const url = location.href.split('#')[0].split('?')[0].replace(/[^/]*$/, '') + 'branch.html';
  const txt = '@echo off\r\nrem KusinaERP POS — Chrome with silent (kiosk) printing\r\nstart "" chrome --kiosk-printing --app=' + url + '\r\n';
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([txt], { type: 'text/plain' })); a.download = 'KusinaERP-POS.bat'; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
}
function pxUsbTest() {
  const w = (String((PX.cfg || {}).paper || '80') === '58') ? '48mm' : '72mm';
  pxPrint(`<html><head><meta charset="utf-8"><style>@page{margin:0}body{font-family:monospace;font-size:12px;width:${w};margin:0 auto;padding:4mm 0}h3{text-align:center;margin:0 0 4px}hr{border:0;border-top:1px dashed #000}</style></head><body><h3>TEST PRINT</h3><div style="text-align:center">${pxE(pxSite().name || 'KusinaERP')}</div><hr>Printer OK ✔<br>Paper: ${pxE(String((PX.cfg || {}).paper || '80'))}mm<br>${new Date().toLocaleString('en-PH')}<hr><div style="text-align:center">Salamat po!</div><br><br></body></html>`);
}
const _pxSetupView1 = pxSetupView; pxSetupView = async function () { const r = await _pxSetupView1.apply(this, arguments); try { setTimeout(pxUsbCard, 60); } catch (e) {} return r; };
