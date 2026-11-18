/* =====================================================================
   🛒 KUSINA POS  (cashier + menu + event + membership/club + docs + roster + ideal vs actual)
   HINDI ito BIR-accredited na resibo: "ORDER SLIP / BILLING STATEMENT" ang tawag sa printout; may linya para sa Opisyal na Resibo No. na kakabit.
   Firestore: pos_setup/{company} · pos_menu/{id} · pos_events/{id} · pos_event_stock/{eventId} · pos_sales/{id} · pos_counters/{site}__{yyyymmdd}
              pos_members/{company}__{id} · pos_clubs/{company}__{slug} · pos_shifts/{id} · pos_docs/{site} · pos_roster/{site} · pos_ideal/{key} · emp_directory/{id}
   Presyo = VAT-inclusive. Menu ≠ BOM: ang Menu ay may sariling sangkap (gramo, cook/uncook); ang BOM ay pang-inventory lang at hindi ginagalaw ng POS.
   ===================================================================== */
const PX = { ready: false, sites: [], site: '', tab: 'pos', cfg: null, menu: [], events: [], event: '', cart: [], cat: '', q: '', members: [], clubs: [], shift: null, role: '', mine: [], sales: [], disc: { type: 'none', elig: '', pct: '', id: '', name: '' }, pays: [], member: null, sig: '', last: null };
const PX_DEF = { sc: { on: true, pct: 10, show: false, base: 'after' }, vat: { on: true, pct: 12 }, header: '', footer: 'Salamat po!', paper: '80', members: true, sigMode: 'member', mgrPin: '', modes: ['cash', 'gcash'], seniorPct: 20 };
const PX_MODES = { cash: '💵 Cash', gcash: '📱 GCash', member: '🪪 Membership Charge', org: '🏢 Charge to Organizer' };
const PX_STAFF = /staff|crew|cashier|assistant|employee|waiter|server/i;
const pxE = s => typeof srchEsc === 'function' ? srchEsc(s == null ? '' : String(s)) : String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pxR2 = n => Math.round((+n || 0) * 100) / 100;
const pxM = n => (+n || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const pxSlug = s => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const pxISO = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
const pxToday = () => pxISO(new Date());
const pxId = p => p + '-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
const pxNum = v => { const n = parseFloat(String(v == null ? '' : v).replace(/,/g, '')); return isFinite(n) ? n : 0; };
const pxMe = () => getCurrentUser() || {};
const pxAdmin = () => PX.role === 'admin' || (typeof canEditModule === 'function' && canEditModule('pos'));
const pxSite = () => PX.sites.find(s => s.key === PX.site) || {};
const pxMgr = () => pxAdmin() || (PX.role === 'branch' && PX.mine.includes(PX.site) && !PX_STAFF.test(String(pxMe().role || '') + ' ' + String(pxMe().position || pxMe().title || '')));
const pxCan = () => pxAdmin() || (PX.role === 'branch' && PX.mine.includes(PX.site));
const pxCo = () => pxSite().company || '';
const pxEv = () => PX.events.find(e => e.id === PX.event) || null;
const pxEventLive = e => { const t = pxToday(); return e && e.status !== 'closed' && (!e.from || t >= e.from) && (!e.to || t <= e.to); };

async function loadPOS() {
  const root = document.getElementById('pos-root'); if (!root || !db) return; root.innerHTML = '<div class="card">Kinukuha...</div>';
  try {
    const u = pxMe(); PX.role = normalizeRole(u.role); PX.sites = [];
    (await db.collection('inventory_branches').get()).forEach(d => { const x = d.data(); PX.sites.push({ key: pxSlug(x.code || x.branch), name: x.branch || x.code, code: x.code || '', company: x.company || '' }); });
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
  const [cf, mn, ev, mb, cl, sh] = await Promise.all([
    db.collection('pos_setup').doc(cs).get(), db.collection('pos_menu').where('company', '==', co).get(), db.collection('pos_events').where('company', '==', co).get(),
    db.collection('pos_members').where('company', '==', co).get().catch(() => ({ forEach() {} })), db.collection('pos_clubs').where('company', '==', co).get().catch(() => ({ forEach() {} })),
    db.collection('pos_shifts').where('site', '==', PX.site).where('status', '==', 'open').get().catch(() => ({ empty: true, docs: [] }))]);
  const d = cf.exists ? cf.data() : {}; PX.cfg = Object.assign({}, PX_DEF, d, { sc: Object.assign({}, PX_DEF.sc, d.sc || {}), vat: Object.assign({}, PX_DEF.vat, d.vat || {}) });
  PX.menu = []; mn.forEach(x => PX.menu.push(Object.assign({ id: x.id }, x.data()))); PX.menu.sort((a, b) => String(a.category || '').localeCompare(String(b.category || '')) || String(a.name).localeCompare(String(b.name)));
  PX.events = []; ev.forEach(x => PX.events.push(Object.assign({ id: x.id }, x.data()))); PX.events.sort((a, b) => String(b.from || '').localeCompare(String(a.from || '')));
  PX.members = []; mb.forEach(x => PX.members.push(Object.assign({ id: x.id }, x.data()))); PX.clubs = []; cl.forEach(x => PX.clubs.push(Object.assign({ id: x.id }, x.data())));
  PX.shift = sh.empty ? null : Object.assign({ id: sh.docs[0].id }, sh.docs[0].data());
  if (PX.event && !pxEv()) PX.event = ''; PX.cart = []; pxResetPay();
}
function pxResetPay() { PX.disc = { type: 'none', elig: '', pct: '', id: '', name: '' }; PX.pays = []; PX.member = null; PX.sig = ''; }
async function pxSiteChange(k) { PX.site = k; PX.event = ''; PX.cat = ''; await pxLoadSite(); pxRender(); }

/* ---------- Mga item ng menu na ipinapakita ---------- */
function pxMenuItems() { // regular menu + (kung may aktibong event) event items; pwedeng mag-override ng presyo ang event
  const ev = pxEv(); const reg = PX.menu.filter(m => !m.eventId && m.active !== false);
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
  else if (t === 'manual') { const p = Math.min(100, Math.max(0, pxNum(disc.pct))); R.disc = pxR2(gross * p / 100); const after = pxR2(gross - R.disc); R.vatable = vatOn ? pxR2(after / vr) : after; R.vat = vatOn ? pxR2(after - R.vatable) : 0; R.due = after; R.label = 'Discount ' + p + '%'; }
  else { R.vatable = vatOn ? pxR2(gross / vr) : gross; R.vat = vatOn ? pxR2(gross - R.vatable) : 0; R.due = gross; }
  if (cfg.sc.on && R.due > 0) R.sc$ = pxR2(R.due * (+cfg.sc.pct || 10) / 100); R.svc = R.sc$ || 0; delete R.sc$;
  R.total = pxR2(R.due + R.svc); return R;
}
/* ---------- Ubos ng sangkap (gamit para sa Ideal vs Actual) ---------- */
function pxUseOf(item, qty) { // -> { code: {name, qty (inventory unit), unit} }
  const o = {}; (item.ings || []).forEach(g => { if (!g.code) return; const served = (+g.qty || 0) * qty, raw = g.state === 'cooked' && +g.yield > 0 ? served / +g.yield : served, inv = raw / (+g.toInv > 0 ? +g.toInv : 1); const u = o[g.code] = o[g.code] || { name: g.name || g.code, qty: 0, unit: g.invUnit || g.unit || '' }; u.qty = +(u.qty + inv).toFixed(6); });
  return o;
}

/* ================= RENDER: shell ================= */
function pxTabs() {
  const t = [['pos', '🛒 POS']]; if (pxAdmin()) t.push(['menu', '📋 Menu']); if (pxMgr()) t.push(['events', '🎪 Events']); t.push(['sales', '🧾 Benta / Shift']);
  if (PX.cfg.members !== false) t.push(['members', '🪪 Members']); if (pxAdmin() && PX.cfg.members !== false) t.push(['clubs', '🏢 Club Statement']);
  if (pxMgr()) t.push(['ideal', '📦 Ideal vs Actual'], ['docs', '📁 Branch Docs'], ['roster', '👥 Roster']); if (pxAdmin()) t.push(['setup', '⚙️ Setup']); return t;
}
function pxRender() {
  const root = document.getElementById('pos-root'); if (!root) return; if (!pxTabs().find(x => x[0] === PX.tab)) PX.tab = 'pos'; const ev = pxEv();
  root.innerHTML = `<div class="card"><div class="card-title"><span>🛒 Kusina POS</span><span id="px-msg" style="font-size:.8rem;color:#166534;"></span></div>
  <div style="display:flex;gap:.4rem;flex-wrap:wrap;align-items:end;margin-bottom:.5rem;"><div><label style="font-weight:700;">Branch</label><br><select onchange="pxSiteChange(this.value)">${PX.sites.map(s => `<option value="${pxE(s.key)}" ${s.key === PX.site ? 'selected' : ''}>${pxE((s.company ? s.company + ' — ' : '') + s.name)}</option>`).join('')}</select></div>
  <div><label style="font-weight:700;">Event</label><br><select onchange="PX.event=this.value;PX.cart=[];pxResetPay();pxRender()"><option value="">— Regular na benta —</option>${PX.events.filter(pxEventLive).map(e => `<option value="${pxE(e.id)}" ${e.id === PX.event ? 'selected' : ''}>🎪 ${pxE(e.name)} (${pxE(e.from)} → ${pxE(e.to)})</option>`).join('')}</select></div>
  <span style="margin-left:auto;font-size:.82rem;">${PX.shift ? '🟢 Bukas ang shift: <b>' + pxE(PX.shift.cashier) + '</b>' : '🔴 Walang bukas na shift'}${ev ? ' · <b style="color:#7c3aed;">Event mode</b>' : ''}</span></div>
  <div style="display:flex;gap:.3rem;flex-wrap:wrap;margin-bottom:.6rem;">${pxTabs().map(([k, l]) => `<button class="btn ${k === PX.tab ? 'btn-primary' : 'btn-secondary'} btn-sm" onclick="pxTab('${k}')">${l}</button>`).join('')}</div>
  <div id="px-body"></div></div>`; pxBody();
}
function pxTab(t) { PX.tab = t; pxRender(); }
function pxToast(m) { const el = document.getElementById('px-msg'); if (el) { el.textContent = m; setTimeout(() => { if (el.textContent === m) el.textContent = ''; }, 4000); } }
async function pxBody() {
  const b = document.getElementById('px-body'); if (!b) return; const f = { pos: pxPosView, menu: pxMenuView, events: pxEventsView, sales: pxSalesView, members: pxMembersView, clubs: pxClubsView, ideal: pxIdealView, docs: pxDocsView, roster: pxRosterView, setup: pxSetupView }[PX.tab];
  try { const h = await f(); if (typeof h === 'string') b.innerHTML = h; } catch (e) { b.innerHTML = '<div style="color:#dc2626;">Error: ' + pxE(e.message) + '</div>'; }
}
function pxModal(html, wide) { let m = document.getElementById('px-modal'); if (!m) { m = document.createElement('div'); m.id = 'px-modal'; m.className = 'modal-overlay'; m.style.cssText = 'position:fixed;inset:0;background:rgba(15,23,42,.6);z-index:10050;display:none;align-items:center;justify-content:center;padding:1rem;'; document.body.appendChild(m); } m.style.display = 'flex'; m.innerHTML = `<div style="background:#fff;border-radius:.7rem;padding:1rem;max-width:${wide || 640}px;width:100%;max-height:92vh;overflow:auto;">${html}<div style="text-align:right;margin-top:.6rem;"><button class="btn btn-secondary btn-sm" onclick="pxClose()">Isara</button></div></div>`; }
function pxClose() { const m = document.getElementById('px-modal'); if (m) m.style.display = 'none'; }

/* ================= SETUP ================= */
async function pxSetupView() {
  const c = PX.cfg;
  return `<p style="font-size:.85rem;color:#64748b;">Setup para sa <b>${pxE(pxCo())}</b> (lahat ng branch ng company).</p>
  <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:.8rem;">
  <div class="card"><b>Service Charge</b><br><label><input type="checkbox" id="su-sc" ${c.sc.on ? 'checked' : ''}> Gamitin</label> <input type="number" id="su-scp" value="${c.sc.pct}" style="width:70px;">%<br><label><input type="checkbox" id="su-scs" ${c.sc.show ? 'checked' : ''}> Ipakita sa resibo</label><br><small style="color:#64748b;">Kapag naka-hide, kasama pa rin sa total at naka-log nang hiwalay sa ulat.</small></div>
  <div class="card"><b>VAT</b><br><label><input type="checkbox" id="su-vat" ${c.vat.on ? 'checked' : ''}> VAT-registered (presyo ay VAT-inclusive)</label> <input type="number" id="su-vatp" value="${c.vat.pct}" style="width:70px;">%<br><b>Senior/PWD %</b> <input type="number" id="su-sen" value="${c.seniorPct}" style="width:70px;"></div>
  <div class="card"><b>Resibo / Slip</b><br><label>Papel</label> <select id="su-pap"><option value="80" ${c.paper === '80' ? 'selected' : ''}>80mm</option><option value="58" ${c.paper === '58' ? 'selected' : ''}>58mm</option></select><br><textarea id="su-head" rows="3" placeholder="Header (pangalan, address, TIN...)" style="width:100%;">${pxE(c.header)}</textarea><input id="su-foot" value="${pxE(c.footer)}" placeholder="Footer" style="width:100%;"></div>
  <div class="card"><b>Membership</b><br><label><input type="checkbox" id="su-mem" ${c.members !== false ? 'checked' : ''}> May membership ang company na ito</label><br><b>Pirma ng customer sa screen</b> <select id="su-sig"><option value="member" ${c.sigMode === 'member' ? 'selected' : ''}>Member charge lang</option><option value="always" ${c.sigMode === 'always' ? 'selected' : ''}>Lahat ng benta</option><option value="never" ${c.sigMode === 'never' ? 'selected' : ''}>Wala (sa papel lang)</option></select><br><b>Manager PIN</b> (para sa void/manual discount) <input id="su-pin" value="${pxE(c.mgrPin)}" style="width:90px;"></div></div>
  <button class="btn btn-success" style="margin-top:.6rem;" onclick="pxSetupSave()">💾 I-save ang Setup</button>`;
}
async function pxSetupSave() {
  const v = id => document.getElementById(id), c = { sc: { on: v('su-sc').checked, pct: pxNum(v('su-scp').value), show: v('su-scs').checked, base: 'after' }, vat: { on: v('su-vat').checked, pct: pxNum(v('su-vatp').value) || 12 }, seniorPct: pxNum(v('su-sen').value) || 20, paper: v('su-pap').value, header: v('su-head').value, footer: v('su-foot').value, members: v('su-mem').checked, sigMode: v('su-sig').value, mgrPin: v('su-pin').value.trim() };
  try { await db.collection('pos_setup').doc(pxSlug(pxCo())).set(Object.assign({ company: pxCo() }, c), { merge: true }); PX.cfg = Object.assign({}, PX_DEF, c); pxToast('✅ Na-save'); pxRender(); } catch (e) { alert('Error: ' + e.message); }
}

/* ================= MENU (admin) ================= */
let PX_SAP = null;
async function pxSap() { if (PX_SAP && PX_SAP.co === pxCo()) return PX_SAP.list; let l = []; try { const s = await db.collection('sap_items').where('company', '==', pxCo()).get(); s.forEach(d => { const x = d.data(); if (x.active !== false) l.push({ code: x.itemCode, name: x.itemName, invUnit: x.invUom || x.purchUom || 'kg' }); }); } catch (e) {} l.sort((a, b) => a.name.localeCompare(b.name)); PX_SAP = { co: pxCo(), list: l }; return l; }
async function pxMenuView() {
  const rows = PX.menu.filter(m => !m.eventId);
  return `<div style="display:flex;gap:.4rem;margin-bottom:.5rem;"><button class="btn btn-primary btn-sm" onclick="pxMenuEdit('')">➕ Bagong item</button><small style="color:#64748b;align-self:center;">Ang Menu ay hiwalay sa BOM. Ang "Sangkap" lang ang ibabawas sa inventory.</small></div>
  <div style="overflow:auto;"><table class="table" style="font-size:.85rem;"><tr><th>Item</th><th>Kategorya</th><th style="text-align:right;">Presyo</th><th>Sangkap</th><th></th></tr>${rows.length ? rows.map(m => `<tr><td>${pxE(m.name)}</td><td>${pxE(m.category)}</td><td style="text-align:right;">${pxM(m.price)}</td><td>${(m.ings || []).length}${(m.ings || []).length ? '' : ' <b style="color:#dc2626;">⚠ wala</b>'}</td><td><button class="btn btn-secondary btn-sm" onclick="pxMenuEdit('${m.id}')">✏️</button> <button class="btn btn-danger btn-sm" onclick="pxMenuDel('${m.id}')">🗑️</button> ${m.active === false ? '<span class="badge badge-secondary">off</span>' : ''}</td></tr>`).join('') : '<tr><td colspan="5"><small>Wala pang item.</small></td></tr>'}</table></div>`;
}
let PX_ME = null;
async function pxMenuEdit(id, eventId) {
  const m = id ? PX.menu.find(x => x.id === id) : null; PX_ME = JSON.parse(JSON.stringify(m || { name: '', category: '', price: 0, active: true, ings: [], eventId: eventId || '' })); PX_ME.id = id || ''; await pxSap(); pxMenuForm();
}
function pxMenuForm() {
  const m = PX_ME, sap = (PX_SAP || {}).list || [];
  pxModal(`<h3 style="margin-top:0;">${m.id ? 'I-edit' : 'Bagong'} Menu Item ${m.eventId ? '(Event only)' : ''}</h3>
  <div style="display:grid;grid-template-columns:2fr 1fr 1fr;gap:.4rem;"><input id="pm-name" placeholder="Pangalan" value="${pxE(m.name)}"><input id="pm-cat" placeholder="Kategorya" value="${pxE(m.category)}"><input id="pm-price" type="number" step="0.01" placeholder="Presyo" value="${pxE(m.price)}"></div>
  <label style="display:block;margin:.3rem 0;"><input type="checkbox" id="pm-act" ${m.active !== false ? 'checked' : ''}> Aktibo</label>
  <b>Sangkap (ibababawas sa inventory)</b><div style="font-size:.75rem;color:#64748b;">Dami na inihahain, at kung luto o hilaw. Para sa luto (hal. kanin): ilagay ang Yield (luto ÷ hilaw, hal. 2.4) para hilaw na bigas ang bawasan. "Per inv unit" = ilang g/ml/pc ang 1 unit ng inventory (hal. 1000 g bawat kg).</div>
  <datalist id="pm-sap">${sap.map(s => `<option value="${pxE(s.code)} — ${pxE(s.name)}">`).join('')}</datalist>
  <div style="overflow:auto;"><table class="table" style="font-size:.78rem;"><tr><th>Item (SAP)</th><th>Dami</th><th>Unit</th><th>Estado</th><th>Yield</th><th>Per inv unit</th><th></th></tr>${m.ings.map((g, i) => `<tr><td><input list="pm-sap" value="${pxE(g.code ? g.code + ' — ' + g.name : '')}" onchange="pxIngPick(${i},this.value)" style="width:170px;"></td><td><input type="number" step="any" value="${g.qty || ''}" onchange="PX_ME.ings[${i}].qty=pxNum(this.value)" style="width:70px;"></td><td><select onchange="PX_ME.ings[${i}].unit=this.value"><option ${g.unit === 'g' ? 'selected' : ''}>g</option><option ${g.unit === 'ml' ? 'selected' : ''}>ml</option><option ${g.unit === 'pc' ? 'selected' : ''}>pc</option></select></td><td><select onchange="PX_ME.ings[${i}].state=this.value"><option value="raw" ${g.state !== 'cooked' ? 'selected' : ''}>Hilaw</option><option value="cooked" ${g.state === 'cooked' ? 'selected' : ''}>Luto</option></select></td><td><input type="number" step="any" value="${g.yield || ''}" placeholder="2.4" onchange="PX_ME.ings[${i}].yield=pxNum(this.value)" style="width:60px;"></td><td><input type="number" step="any" value="${g.toInv || 1000}" onchange="PX_ME.ings[${i}].toInv=pxNum(this.value)||1" style="width:70px;"></td><td><button class="btn btn-danger btn-sm" onclick="PX_ME.ings.splice(${i},1);pxMenuKeep()">✖</button></td></tr>`).join('')}</table></div>
  <button class="btn btn-secondary btn-sm" onclick="pxMenuKeep();PX_ME.ings.push({code:'',name:'',qty:0,unit:'g',state:'raw',yield:0,toInv:1000,invUnit:'kg'});pxMenuForm()">➕ Sangkap</button>
  <button class="btn btn-success" style="margin-left:.5rem;" onclick="pxMenuSave()">💾 I-save</button>`, 820);
}
function pxMenuKeep() { const v = id => document.getElementById(id); if (!v('pm-name')) return; PX_ME.name = v('pm-name').value; PX_ME.category = v('pm-cat').value; PX_ME.price = pxNum(v('pm-price').value); PX_ME.active = v('pm-act').checked; }
function pxIngPick(i, val) { const code = String(val).split(' — ')[0].trim(), s = ((PX_SAP || {}).list || []).find(x => x.code === code); if (s) { Object.assign(PX_ME.ings[i], { code: s.code, name: s.name, invUnit: s.invUnit }); } pxMenuKeep(); pxMenuForm(); }
async function pxMenuSave() {
  pxMenuKeep(); const m = PX_ME; if (!m.name.trim()) { alert('Lagyan ng pangalan.'); return; } if (!(m.price > 0)) { alert('Lagyan ng presyo.'); return; }
  const ings = m.ings.filter(g => g.code && g.qty > 0); if (m.ings.some(g => g.state === 'cooked' && !(g.yield > 0))) { alert('May sangkap na "Luto" na walang Yield (hal. 2.4).'); return; }
  const id = m.id || pxId('MN'); const d = { company: pxCo(), name: m.name.trim(), category: (m.category || 'Iba pa').trim(), price: m.price, active: m.active, ings, eventId: m.eventId || '', updatedBy: String(pxMe().email || ''), updatedAt: new Date().toISOString() };
  try { await db.collection('pos_menu').doc(id).set(d); const i = PX.menu.findIndex(x => x.id === id); if (i >= 0) PX.menu[i] = Object.assign({ id }, d); else PX.menu.push(Object.assign({ id }, d)); pxClose(); pxRender(); } catch (e) { alert('Error: ' + e.message); }
}
async function pxMenuDel(id) { if (!await uiConfirm('Burahin ang item na ito sa menu?')) return; try { await db.collection('pos_menu').doc(id).delete(); PX.menu = PX.menu.filter(m => m.id !== id); pxRender(); } catch (e) { alert('Error: ' + e.message); } }

/* ================= EVENTS ================= */
async function pxEventsView() {
  return `<div style="display:flex;gap:.4rem;margin-bottom:.5rem;"><button class="btn btn-primary btn-sm" onclick="pxEventEdit('')">➕ Bagong Event</button><small style="color:#64748b;align-self:center;">Aktibo lang ang event sa pagitan ng petsa nito. Ang event-only na item ay hindi napupunta sa regular na menu.</small></div>
  <table class="table" style="font-size:.85rem;"><tr><th>Event</th><th>Lugar</th><th>Petsa</th><th>Menu</th><th>Benta</th><th></th></tr>${PX.events.map(e => `<tr><td><b>${pxE(e.name)}</b></td><td>${pxE(e.venue)}</td><td>${pxE(e.from)} → ${pxE(e.to)} ${pxEventLive(e) ? '<span class="badge badge-success">live</span>' : e.status === 'closed' ? '<span class="badge badge-secondary">closed</span>' : ''}</td><td>${PX.menu.filter(m => m.eventId === e.id).length} event-only</td><td><button class="btn btn-secondary btn-sm" onclick="pxEventReport('${e.id}')">📊</button></td><td><button class="btn btn-secondary btn-sm" onclick="pxEventEdit('${e.id}')">✏️</button> <button class="btn btn-secondary btn-sm" onclick="pxEventStock('${e.id}')">📦 Stock</button></td></tr>`).join('') || '<tr><td colspan="6"><small>Wala pang event.</small></td></tr>'}</table>`;
}
let PX_EV = null;
function pxEventEdit(id) {
  const e = id ? PX.events.find(x => x.id === id) : null; PX_EV = JSON.parse(JSON.stringify(e || { name: '', venue: '', from: pxToday(), to: pxToday(), status: 'open', regularIds: [], prices: {} })); PX_EV.id = id || '';
  const reg = PX.menu.filter(m => !m.eventId);
  pxModal(`<h3 style="margin-top:0;">${id ? 'I-edit' : 'Bagong'} Event</h3><div style="display:grid;grid-template-columns:1fr 1fr;gap:.4rem;"><input id="pe-name" placeholder="Pangalan ng event" value="${pxE(PX_EV.name)}"><input id="pe-venue" placeholder="Lugar (ballroom, soccer field...)" value="${pxE(PX_EV.venue)}"><div><small>Mula</small><br><input type="date" id="pe-from" value="${pxE(PX_EV.from)}"></div><div><small>Hanggang</small><br><input type="date" id="pe-to" value="${pxE(PX_EV.to)}"></div></div>
  <label><input type="checkbox" id="pe-closed" ${PX_EV.status === 'closed' ? 'checked' : ''}> Closed na</label>
  <h4 style="margin:.6rem 0 .2rem;">Mula sa regular na menu (lagyan ng ✔ at puwedeng palitan ang presyo)</h4><div style="max-height:240px;overflow:auto;border:1px solid #e2e8f0;border-radius:.4rem;padding:.3rem;">${reg.map(m => { const on = !(PX_EV.regularIds || []).length || PX_EV.regularIds.includes(m.id); return `<div style="display:flex;gap:.4rem;align-items:center;font-size:.82rem;"><input type="checkbox" class="pe-reg" value="${m.id}" ${on ? 'checked' : ''}><span style="flex:1;">${pxE(m.name)} <small>(${pxM(m.price)})</small></span><input type="number" step="0.01" placeholder="presyo" value="${(PX_EV.prices || {})[m.id] != null ? PX_EV.prices[m.id] : ''}" class="pe-pr" data-id="${m.id}" style="width:90px;"></div>`; }).join('') || '<small>Walang regular na menu.</small>'}</div>
  <div style="margin-top:.5rem;display:flex;gap:.4rem;"><button class="btn btn-success" onclick="pxEventSave()">💾 I-save</button>${id ? `<button class="btn btn-primary btn-sm" onclick="pxClose();pxMenuEdit('','${id}')">➕ Event-only na item</button>` : '<small style="color:#64748b;">I-save muna para makagawa ng event-only na item.</small>'}</div>
  ${id ? '<h4 style="margin:.6rem 0 .2rem;">Event-only na item</h4>' + (PX.menu.filter(m => m.eventId === id).map(m => `<div style="font-size:.82rem;">${pxE(m.name)} — ${pxM(m.price)} <button class="btn btn-secondary btn-sm" onclick="pxMenuEdit('${m.id}')">✏️</button></div>`).join('') || '<small>Wala pa.</small>') : ''}`, 700);
}
async function pxEventSave() {
  const v = id => document.getElementById(id), e = PX_EV; e.name = v('pe-name').value.trim(); e.venue = v('pe-venue').value.trim(); e.from = v('pe-from').value; e.to = v('pe-to').value; e.status = v('pe-closed').checked ? 'closed' : 'open';
  if (!e.name || !e.from || !e.to || e.to < e.from) { alert('Kumpletuhin ang pangalan at tamang petsa.'); return; }
  const all = [...document.querySelectorAll('.pe-reg')], ch = all.filter(x => x.checked).map(x => x.value); e.regularIds = ch.length === all.length ? [] : ch; e.prices = {}; document.querySelectorAll('.pe-pr').forEach(x => { if (x.value !== '') e.prices[x.dataset.id] = pxNum(x.value); });
  const id = e.id || pxId('EV'); const d = { company: pxCo(), name: e.name, venue: e.venue, from: e.from, to: e.to, status: e.status, regularIds: e.regularIds, prices: e.prices, siteKeys: [PX.site], updatedBy: String(pxMe().email || '') };
  try { await db.collection('pos_events').doc(id).set(d, { merge: true }); const i = PX.events.findIndex(x => x.id === id); if (i >= 0) PX.events[i] = Object.assign({ id }, PX.events[i], d); else PX.events.unshift(Object.assign({ id }, d)); pxClose(); pxRender(); } catch (er) { alert('Error: ' + er.message); }
}
async function pxEventStock(id) {
  const e = PX.events.find(x => x.id === id), s = await db.collection('pos_event_stock').doc(id).get(), d = s.exists ? s.data() : { out: [], back: [] }; PX_ST = { id, out: d.out || [], back: d.back || [] }; await pxSap(); pxStockForm();
}
let PX_ST = null;
function pxStockForm() {
  const sap = (PX_SAP || {}).list || [], t = (k, l) => `<h4 style="margin:.5rem 0 .2rem;">${l}</h4><table class="table" style="font-size:.8rem;">${PX_ST[k].map((r, i) => `<tr><td><input list="ps-sap" value="${pxE(r.code ? r.code + ' — ' + r.name : '')}" onchange="pxStPick('${k}',${i},this.value)" style="width:230px;"></td><td><input type="number" step="any" value="${r.qty || ''}" onchange="PX_ST['${k}'][${i}].qty=pxNum(this.value)" style="width:80px;"> ${pxE(r.unit || '')}</td><td><button class="btn btn-danger btn-sm" onclick="PX_ST['${k}'].splice(${i},1);pxStockForm()">✖</button></td></tr>`).join('')}</table><button class="btn btn-secondary btn-sm" onclick="PX_ST['${k}'].push({code:'',name:'',qty:0,unit:''});pxStockForm()">➕</button>`;
  pxModal(`<h3 style="margin-top:0;">📦 Stock ng Event</h3><datalist id="ps-sap">${sap.map(s => `<option value="${pxE(s.code)} — ${pxE(s.name)}">`).join('')}</datalist>${t('out', 'Inilabas / dinala')}${t('back', 'Naibalik pagkatapos')}<div style="margin-top:.5rem;"><button class="btn btn-success" onclick="pxStockSave()">💾 I-save</button> <small>Nagamit = inilabas − naibalik (kasama sa Ideal vs Actual ng event).</small></div>`, 720);
}
function pxStPick(k, i, val) { const code = String(val).split(' — ')[0].trim(), s = ((PX_SAP || {}).list || []).find(x => x.code === code); if (s) Object.assign(PX_ST[k][i], { code: s.code, name: s.name, unit: s.invUnit }); pxStockForm(); }
async function pxStockSave() { try { await db.collection('pos_event_stock').doc(PX_ST.id).set({ company: pxCo(), out: PX_ST.out.filter(r => r.code), back: PX_ST.back.filter(r => r.code), updatedBy: String(pxMe().email || ''), updatedAt: new Date().toISOString() }); pxClose(); pxToast('✅ Na-save ang stock'); } catch (e) { alert('Error: ' + e.message); } }

/* ================= POS (cashier) ================= */
async function pxRosterNames() { try { const d = await db.collection('pos_roster').doc(PX.site).get(); return d.exists ? (d.data().list || []) : []; } catch (e) { return []; } }
async function pxPosView() {
  if (!pxCan()) return '<p>Walang access sa POS ang account na ito.</p>';
  if (!PX.shift) { const ro = await pxRosterNames(); return `<div class="card" style="max-width:440px;"><h3 style="margin-top:0;">🔴 Buksan ang Shift</h3><label>Cashier</label><br><input list="px-ro" id="px-cashier" value="${pxE(pxMe().name || '')}" style="width:100%;"><datalist id="px-ro">${ro.map(r => `<option value="${pxE(r.name)}">`).join('')}</datalist><br><label>Panimulang cash sa drawer</label><br><input type="number" id="px-open" value="0" style="width:100%;"><br><button class="btn btn-success" style="margin-top:.5rem;" onclick="pxShiftOpen()">🟢 Buksan</button></div>`; }
  const items = pxMenuItems(), cats = [...new Set(items.map(m => m.category || 'Iba pa'))], q = PX.q.toLowerCase(); const list = items.filter(m => (!PX.cat || (m.category || 'Iba pa') === PX.cat) && (!q || m.name.toLowerCase().includes(q)));
  const C = pxCalc(PX.cart, PX.disc), paid = PX.pays.reduce((s, p) => s + p.amount, 0), bal = pxR2(C.total - paid);
  return `<div style="display:grid;grid-template-columns:minmax(0,3fr) minmax(300px,2fr);gap:.8rem;align-items:start;">
  <div><div style="display:flex;gap:.3rem;flex-wrap:wrap;margin-bottom:.4rem;"><input type="search" placeholder="🔎 Hanapin" value="${pxE(PX.q)}" oninput="PX.q=this.value;pxGrid()" style="flex:1;min-width:120px;"><button class="btn ${PX.cat ? 'btn-secondary' : 'btn-primary'} btn-sm" onclick="PX.cat='';pxBody()">Lahat</button>${cats.map(c => `<button class="btn ${PX.cat === c ? 'btn-primary' : 'btn-secondary'} btn-sm" onclick="PX.cat=this.dataset.c;pxBody()" data-c="${pxE(c)}">${pxE(c)}</button>`).join('')}</div>
  <div id="px-grid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:.4rem;">${pxGridHtml(list)}</div></div>
  <div class="card" style="position:sticky;top:.5rem;"><b>🧾 Order</b>${PX.cart.length ? '' : '<div style="color:#94a3b8;padding:.6rem;">Pumili ng item sa kaliwa.</div>'}
  ${PX.cart.map((l, i) => `<div style="display:flex;gap:.3rem;align-items:center;border-bottom:1px solid #f1f5f9;padding:.2rem 0;font-size:.85rem;"><span style="flex:1;">${pxE(l.name)}<br><small>${pxM(l.price)}</small></span><button class="btn btn-secondary btn-sm" onclick="pxQty(${i},-1)">−</button><b>${l.qty}</b><button class="btn btn-secondary btn-sm" onclick="pxQty(${i},1)">+</button><span style="width:64px;text-align:right;">${pxM(l.price * l.qty)}</span></div>`).join('')}
  <div style="margin-top:.4rem;"><select id="px-dt" onchange="pxDisc(this.value)" style="width:100%;"><option value="none">Walang discount</option><option value="senior" ${PX.disc.type === 'senior' ? 'selected' : ''}>👴 Senior Citizen 20%</option><option value="pwd" ${PX.disc.type === 'pwd' ? 'selected' : ''}>♿ PWD 20%</option><option value="taxex" ${PX.disc.type === 'taxex' ? 'selected' : ''}>🛂 Tax-Exempt Card</option><option value="comp" ${PX.disc.type === 'comp' ? 'selected' : ''}>🎁 Complimentary</option><option value="manual" ${PX.disc.type === 'manual' ? 'selected' : ''}>✂️ Manual %</option></select>
  ${['senior', 'pwd', 'taxex'].includes(PX.disc.type) ? `<input placeholder="ID No." value="${pxE(PX.disc.id)}" onchange="PX.disc.id=this.value" style="width:49%;"> <input placeholder="Pangalan" value="${pxE(PX.disc.name)}" onchange="PX.disc.name=this.value" style="width:49%;">${PX.disc.type !== 'taxex' ? `<input type="number" placeholder="Halaga na sakop ng discount (blangko = lahat)" value="${pxE(PX.disc.elig)}" onchange="PX.disc.elig=this.value;pxBody()" style="width:100%;">` : ''}` : ''}
  ${PX.disc.type === 'manual' ? `<input type="number" placeholder="% discount" value="${pxE(PX.disc.pct)}" onchange="PX.disc.pct=this.value;pxBody()" style="width:48%;"> <input placeholder="Dahilan" value="${pxE(PX.disc.name)}" onchange="PX.disc.name=this.value" style="width:48%;">` : ''}${PX.disc.type === 'comp' ? `<input placeholder="Dahilan / sino ang nag-approve" value="${pxE(PX.disc.name)}" onchange="PX.disc.name=this.value" style="width:100%;">` : ''}</div>
  <table style="width:100%;font-size:.85rem;margin-top:.4rem;"><tr><td>Subtotal</td><td style="text-align:right;">${pxM(C.gross)}</td></tr>${C.sc ? `<tr><td>Senior 20%</td><td style="text-align:right;">−${pxM(C.sc)}</td></tr>` : ''}${C.pwd ? `<tr><td>PWD 20%</td><td style="text-align:right;">−${pxM(C.pwd)}</td></tr>` : ''}${C.disc ? `<tr><td>Discount</td><td style="text-align:right;">−${pxM(C.disc)}</td></tr>` : ''}${C.comp ? `<tr><td>Complimentary</td><td style="text-align:right;">−${pxM(C.comp)}</td></tr>` : ''}${C.vat !== undefined && PX.disc.type === 'taxex' ? '<tr><td>VAT removed</td><td style="text-align:right;">✔</td></tr>' : ''}${C.svc ? `<tr><td>Service Charge ${PX.cfg.sc.pct}%${PX.cfg.sc.show ? '' : ' <small>(hidden)</small>'}</td><td style="text-align:right;">${pxM(C.svc)}</td></tr>` : ''}<tr style="font-size:1.15rem;font-weight:700;"><td>TOTAL</td><td style="text-align:right;">₱${pxM(C.total)}</td></tr></table>
  ${PX.pays.map((p, i) => `<div style="font-size:.82rem;display:flex;justify-content:space-between;">${PX_MODES[p.mode]}${p.ref ? ' <small>' + pxE(p.ref) + '</small>' : ''}<span>${pxM(p.amount)} <a href="javascript:void(0)" onclick="PX.pays.splice(${i},1);pxBody()">✖</a></span></div>`).join('')}
  ${PX.member ? `<div style="font-size:.8rem;background:#f1f5f9;padding:.3rem;border-radius:.3rem;margin-top:.2rem;">🪪 ${pxE(PX.member.name)} · ${pxE(PX.member.mid)} · ${pxE(PX.member.club)}</div>` : ''}
  <div style="display:flex;gap:.3rem;margin-top:.4rem;flex-wrap:wrap;"><select id="px-pm" style="flex:1;"><option value="cash">💵 Cash</option><option value="gcash">📱 GCash</option>${PX.cfg.members !== false ? '<option value="member">🪪 Member Charge</option>' : ''}${PX.event ? '<option value="org">🏢 Charge to Organizer</option>' : ''}</select><input type="number" id="px-pa" placeholder="${pxM(bal > 0 ? bal : 0)}" style="width:100px;"><button class="btn btn-primary btn-sm" onclick="pxAddPay()">➕ Bayad</button></div>
  <div style="font-size:.85rem;margin-top:.2rem;">${bal > 0 ? 'Kulang: <b style="color:#dc2626;">' + pxM(bal) + '</b>' : 'Sukli: <b style="color:#16a34a;">' + pxM(pxChange(C)) + '</b>'}</div>
  <div style="display:flex;gap:.3rem;margin-top:.5rem;"><button class="btn btn-success" style="flex:1;" onclick="pxCheckout()" ${PX.cart.length ? '' : 'disabled'}>✅ I-charge / I-print</button><button class="btn btn-secondary" onclick="if(PX.cart.length&&!confirm('I-clear ang order?'))return;PX.cart=[];pxResetPay();pxBody()">Clear</button></div></div></div>`;
}
function pxGridHtml(list) { return list.map(m => `<button class="btn btn-secondary" style="text-align:left;white-space:normal;padding:.5rem;line-height:1.2;" onclick="pxAdd('${m.id}')"><b style="font-size:.85rem;">${pxE(m.name)}</b><br><span style="color:#16a34a;">₱${pxM(m._price)}</span></button>`).join('') || '<div style="color:#94a3b8;">Walang item. (Admin: Menu tab → Bagong item)</div>'; }
function pxGrid() { const g = document.getElementById('px-grid'); if (!g) return; const q = PX.q.toLowerCase(); g.innerHTML = pxGridHtml(pxMenuItems().filter(m => (!PX.cat || (m.category || 'Iba pa') === PX.cat) && (!q || m.name.toLowerCase().includes(q)))); }
function pxAdd(id) { const m = pxMenuItems().find(x => x.id === id); if (!m) return; const l = PX.cart.find(x => x.id === id); if (l) l.qty++; else PX.cart.push({ id, name: m.name, price: m._price, qty: 1, ings: m.ings || [] }); PX.pays = []; pxBody(); }
function pxQty(i, d) { PX.cart[i].qty += d; if (PX.cart[i].qty <= 0) PX.cart.splice(i, 1); PX.pays = []; pxBody(); }
function pxDisc(t) { if (t === 'manual' && !pxMgr()) { const p = prompt('Manager PIN:'); if (p === null || String(p) !== String(PX.cfg.mgrPin || '')) { alert('Mali ang PIN.'); document.getElementById('px-dt').value = PX.disc.type; return; } } PX.disc = { type: t, elig: '', pct: '', id: '', name: '' }; PX.pays = []; pxBody(); }
function pxChange(C) { const cash = PX.pays.filter(p => p.mode === 'cash').reduce((s, p) => s + p.amount, 0), other = PX.pays.filter(p => p.mode !== 'cash').reduce((s, p) => s + p.amount, 0); return Math.max(0, pxR2(cash - Math.max(0, C.total - other))); }
async function pxAddPay() {
  const C = pxCalc(PX.cart, PX.disc), mode = document.getElementById('px-pm').value, paid = PX.pays.reduce((s, p) => s + p.amount, 0), bal = pxR2(C.total - paid); let amt = pxNum(document.getElementById('px-pa').value) || (bal > 0 ? bal : 0);
  if (!PX.cart.length) return; if (!(amt > 0)) { alert('Ilagay ang halaga.'); return; } let ref = '';
  if (mode === 'member') { if (!PX.member) { pxMemberPick(amt); return; } amt = Math.min(amt, bal > 0 ? bal : amt); }
  if (mode === 'gcash') ref = prompt('GCash reference no. (optional):') || ''; if (mode === 'org') { ref = prompt('Pangalan ng organizer / kliyente na sisingilin:') || ''; if (!ref) { alert('Kailangan ang pangalan ng organizer.'); return; } amt = Math.min(amt, bal > 0 ? bal : amt); }
  PX.pays.push({ mode, amount: pxR2(amt), ref }); pxBody();
}
/* ---------- Member picker ---------- */
function pxMemberPick(amt) {
  PX_MP = amt; pxModal(`<h3 style="margin-top:0;">🪪 Member</h3><input id="mp-q" placeholder="I-type ang ID number o pangalan..." oninput="pxMpList()" style="width:100%;" autofocus><div id="mp-list" style="margin-top:.4rem;"></div><div id="mp-new" style="margin-top:.5rem;"></div>`, 520); pxMpList();
}
let PX_MP = 0;
function pxMpList() {
  const raw = String((document.getElementById('mp-q') || {}).value || '').trim(), q = raw.toLowerCase(), box = document.getElementById('mp-list'); if (!box) return;
  const r = q ? PX.members.filter(m => String(m.mid).toLowerCase().includes(q) || String(m.name).toLowerCase().includes(q)).slice(0, 8) : [];
  box.innerHTML = r.map(m => `<div onclick="pxMpSel('${m.id}')" style="padding:.45rem;border:1px solid #e2e8f0;border-radius:.4rem;margin-bottom:.2rem;cursor:pointer;"><b>${pxE(m.name)}</b> · ${pxE(m.mid)} <small>${pxE(m.club)}</small></div>`).join('') || (q ? '<small style="color:#94a3b8;">Walang tugma.</small>' : '');
  const exact = PX.members.some(m => String(m.mid).toLowerCase() === q);
  document.getElementById('mp-new').innerHTML = q && !exact ? `<div style="border-top:1px solid #e2e8f0;padding-top:.5rem;"><b>➕ Bagong member</b><div style="display:grid;grid-template-columns:1fr 1fr;gap:.3rem;margin-top:.2rem;"><input id="mn-id" placeholder="ID No." value="${pxE(raw)}"><input id="mn-name" placeholder="Pangalan"><select id="mn-club" style="grid-column:1/3;"><option value="">— Club —</option>${PX.clubs.map(c => `<option value="${pxE(c.name)}">${pxE(c.name)}</option>`).join('')}<option value="__new">➕ Bagong club...</option></select></div><button class="btn btn-success btn-sm" style="margin-top:.3rem;" onclick="pxMemberNew()">I-save at gamitin</button></div>` : '';
}
function pxMpSel(id) { const m = PX.members.find(x => x.id === id); PX.member = { id: m.id, mid: m.mid, name: m.name, club: m.club || '', clubId: m.clubId || '' }; pxClose(); const mode = 'member', C = pxCalc(PX.cart, PX.disc), bal = pxR2(C.total - PX.pays.reduce((s, p) => s + p.amount, 0)); PX.pays.push({ mode, amount: pxR2(Math.min(PX_MP || bal, bal > 0 ? bal : PX_MP)), ref: '' }); pxBody(); }
async function pxMemberNew() {
  const v = id => document.getElementById(id), mid = v('mn-id').value.trim(), name = v('mn-name').value.trim(); let club = v('mn-club').value;
  if (!mid || !name) { alert('Ilagay ang ID at pangalan.'); return; } if (PX.members.some(m => String(m.mid).toLowerCase() === mid.toLowerCase())) { alert('May member na gumagamit ng ID na iyan.'); return; }
  if (club === '__new') { club = (prompt('Pangalan ng bagong club:') || '').trim(); if (!club) return; await pxClubEnsure(club); }
  const cl = PX.clubs.find(c => c.name === club) || {}, id = pxSlug(pxCo()) + '__' + pxSlug(mid); const d = { company: pxCo(), mid, name, club, clubId: cl.id || '', regDate: pxToday(), addedBy: String(pxMe().email || ''), addedAt: new Date().toISOString() };
  try { await db.collection('pos_members').doc(id).set(d); PX.members.push(Object.assign({ id }, d)); pxMpSel(id); } catch (e) { alert('Error: ' + e.message); }
}
async function pxClubEnsure(name) { const id = pxSlug(pxCo()) + '__' + pxSlug(name); if (PX.clubs.find(c => c.id === id)) return; const d = { company: pxCo(), name, pct: 0 }; await db.collection('pos_clubs').doc(id).set(d); PX.clubs.push(Object.assign({ id }, d)); }
/* ---------- Pirma sa screen ---------- */
function pxSignPad() {
  return new Promise(res => {
    pxModal(`<h3 style="margin-top:0;">✍️ Pirma ng Customer</h3><canvas id="sg-c" width="520" height="190" style="border:2px dashed #94a3b8;border-radius:.5rem;width:100%;touch-action:none;background:#fff;"></canvas><div style="margin-top:.4rem;"><button class="btn btn-secondary btn-sm" id="sg-clr">Burahin</button> <button class="btn btn-success" id="sg-ok">✅ Tapos na</button></div>`, 600);
    const c = document.getElementById('sg-c'), g = c.getContext('2d'); g.lineWidth = 2.4; g.lineCap = 'round'; g.strokeStyle = '#0f172a'; let on = false, any = false;
    const pt = e => { const r = c.getBoundingClientRect(); return [(e.clientX - r.left) * c.width / r.width, (e.clientY - r.top) * c.height / r.height]; };
    c.onpointerdown = e => { on = true; any = true; const [x, y] = pt(e); g.beginPath(); g.moveTo(x, y); c.setPointerCapture(e.pointerId); }; c.onpointermove = e => { if (!on) return; const [x, y] = pt(e); g.lineTo(x, y); g.stroke(); }; c.onpointerup = () => { on = false; };
    document.getElementById('sg-clr').onclick = () => { g.clearRect(0, 0, c.width, c.height); any = false; }; document.getElementById('sg-ok').onclick = () => { if (!any) { alert('Pumirma muna.'); return; } const o = document.createElement('canvas'); o.width = 360; o.height = 130; const og = o.getContext('2d'); og.fillStyle = '#fff'; og.fillRect(0, 0, 360, 130); og.drawImage(c, 0, 0, 360, 130); const url = o.toDataURL('image/jpeg', 0.6); pxClose(); res(url); };
  });
}
/* ---------- Checkout ---------- */
async function pxCheckout() {
  if (!PX.shift) { alert('Buksan muna ang shift.'); return; } const C = pxCalc(PX.cart, PX.disc), D = PX.disc; if (!PX.cart.length) return;
  if (['senior', 'pwd', 'taxex'].includes(D.type) && (!D.id.trim() || !D.name.trim())) { alert('Ilagay ang ID No. at pangalan para sa discount.'); return; }
  if (D.type === 'comp' && !D.name.trim()) { alert('Ilagay ang dahilan ng complimentary.'); return; } if (D.type === 'manual' && !(pxNum(D.pct) > 0)) { alert('Ilagay ang % ng discount.'); return; }
  const paid = pxR2(PX.pays.reduce((s, p) => s + p.amount, 0)); if (C.total > 0 && paid < C.total - 0.001) { alert('Kulang pa ang bayad.'); return; }
  const memPay = PX.pays.some(p => p.mode === 'member'); if (memPay && !PX.member) { alert('Pumili ng member.'); return; }
  const need = PX.cfg.sigMode === 'always' || (PX.cfg.sigMode !== 'never' && (memPay || PX.pays.some(p => p.mode === 'org'))); let sig = ''; if (need) { sig = await pxSignPad(); }
  const now = new Date(), date = pxISO(now), ev = pxEv(), s = pxSite(), use = {}; PX.cart.forEach(l => { const u = pxUseOf(l, l.qty); Object.keys(u).forEach(k => { use[k] = use[k] ? Object.assign(use[k], { qty: +(use[k].qty + u[k].qty).toFixed(6) }) : u[k]; }); });
  let no = ''; try { const cr = db.collection('pos_counters').doc(PX.site + '__' + date.replace(/-/g, '')); const n = await db.runTransaction(async tx => { const d = await tx.get(cr), v = (d.exists ? d.data().n : 0) + 1; tx.set(cr, { n: v }); return v; }); no = (s.code || PX.site).toUpperCase() + '-' + date.replace(/-/g, '') + '-' + String(n).padStart(4, '0'); } catch (e) { no = (s.code || PX.site).toUpperCase() + '-' + Date.now().toString(36).toUpperCase(); }
  const chg = pxChange(C), memAmt = PX.pays.filter(p => p.mode === 'member').reduce((x, p) => x + p.amount, 0);
  const sale = { no, company: pxCo(), site: PX.site, siteName: s.name || '', branch: String(pxMe().branch || s.name || ''), eventId: PX.event || '', eventName: ev ? ev.name : '', date, at: now.toISOString(), atMs: now.getTime(), cashier: PX.shift.cashier, cashierEmail: String(pxMe().email || ''), shiftId: PX.shift.id, status: 'paid',
    items: PX.cart.map(l => ({ id: l.id, name: l.name, price: l.price, qty: l.qty })), use, gross: C.gross, due: C.due, svc: C.svc, svcShown: !!PX.cfg.sc.show, total: C.total, pc: { vat: C.vatable, exm: C.exempt, sc: C.sc, pwd: C.pwd, disc: C.disc, comp: C.comp, svc: C.svc }, vatAmt: C.vat,
    disc: { type: D.type, label: C.label, id: D.id || '', name: D.name || '', pct: pxNum(D.pct) }, pays: PX.pays.slice(), change: chg, memberKey: PX.member ? PX.member.id : '', member: PX.member || null, clubId: PX.member ? PX.member.clubId : '', memberCharge: pxR2(memAmt), chargeStatus: memAmt > 0 ? 'billed' : '', sig, orNo: '' };
  try { const ref = await db.collection('pos_sales').add(sale); sale.id = ref.id; PX.last = sale; PX.cart = []; pxResetPay(); pxToast('✅ ' + no); pxPrint(pxReceiptHtml(sale)); pxBody(); } catch (e) { alert('Hindi na-save ang benta: ' + e.message); }
}
/* ---------- Resibo / Order Slip ---------- */
function pxReceiptHtml(s, reprint) {
  const c = PX.cfg || PX_DEF, w = c.paper === '58' ? '54mm' : '76mm', row = (a, b, bold) => `<tr style="${bold ? 'font-weight:700;' : ''}"><td>${a}</td><td style="text-align:right;">${b}</td></tr>`;
  const modes = (s.pays || []).map(p => row(pxE((PX_MODES[p.mode] || p.mode).replace(/^\S+\s/, '')) + (p.ref ? ' (' + pxE(p.ref) + ')' : ''), pxM(p.amount))).join('');
  return `<html><head><meta charset="utf-8"><title>${pxE(s.no)}</title><style>@page{margin:2mm}body{font-family:monospace;font-size:12px;width:${w};margin:0 auto;color:#000}table{width:100%;border-collapse:collapse}td{padding:1px 0;vertical-align:top}hr{border:0;border-top:1px dashed #000;margin:4px 0}.c{text-align:center}.sg{border-bottom:1px solid #000;height:46px;margin-top:6px}</style></head><body>
  <div class="c"><b>${pxE((c.header || '').split('\n')[0] || s.siteName)}</b><br>${pxE((c.header || '').split('\n').slice(1).join(' · '))}<br>${pxE(s.siteName)}<hr><b>ORDER SLIP / BILLING STATEMENT</b><br><small>(Hindi opisyal na resibo)</small></div><hr>
  No: ${pxE(s.no)}${reprint ? ' (REPRINT)' : ''}<br>Petsa: ${pxE(new Date(s.atMs || Date.now()).toLocaleString('en-PH'))}<br>Cashier: ${pxE(s.cashier)}${s.eventName ? '<br>Event: ' + pxE(s.eventName) : ''}<hr>
  <table>${(s.items || []).map(l => `<tr><td colspan="2">${pxE(l.name)}</td></tr>` + row('&nbsp;&nbsp;' + l.qty + ' x ' + pxM(l.price), pxM(l.qty * l.price))).join('')}</table><hr>
  <table>${row('Subtotal', pxM(s.gross))}${s.pc && s.pc.sc ? row('Senior 20%', '-' + pxM(s.pc.sc)) : ''}${s.pc && s.pc.pwd ? row('PWD 20%', '-' + pxM(s.pc.pwd)) : ''}${s.pc && s.pc.disc ? row(pxE(s.disc.label), '-' + pxM(s.pc.disc)) : ''}${s.pc && s.pc.comp ? row('Complimentary', '-' + pxM(s.pc.comp)) : ''}${s.disc && s.disc.type === 'taxex' ? row('Tax-Exempt (walang VAT)', '') : ''}${s.svc && s.svcShown ? row('Service Charge', pxM(s.svc)) : ''}${row('TOTAL', 'P' + pxM(s.total), true)}</table><hr>
  <table>${modes}${s.change ? row('Sukli', pxM(s.change)) : ''}</table>
  ${s.disc && ['senior', 'pwd', 'taxex'].includes(s.disc.type) ? `<hr>${pxE(s.disc.label)}<br>ID: ${pxE(s.disc.id)}<br>Pangalan: ${pxE(s.disc.name)}` : ''}
  ${s.member ? `<hr>Member: ${pxE(s.member.name)}<br>ID: ${pxE(s.member.mid)}<br>Club: ${pxE(s.member.club)}` : ''}<hr>
  Pirma ng Customer:<div class="sg">${s.sig ? `<img src="${s.sig}" style="height:44px;">` : ''}</div><br>Kalakip sa Opisyal na Resibo No.: ${pxE(s.orNo || '______________')}<hr><div class="c">${pxE(c.footer || '')}</div></body></html>`;
}
function pxPrint(html) { let f = document.getElementById('px-frame'); if (f) f.remove(); f = document.createElement('iframe'); f.id = 'px-frame'; f.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;'; document.body.appendChild(f); const d = f.contentWindow.document; d.open(); d.write(html); d.close(); setTimeout(() => { try { f.contentWindow.focus(); f.contentWindow.print(); } catch (e) { alert('Hindi ma-print: ' + e.message); } }, 350); }

/* ================= SHIFT / BENTA ================= */
async function pxShiftOpen() { const c = document.getElementById('px-cashier').value.trim(); if (!c) { alert('Ilagay ang cashier.'); return; } const d = { site: PX.site, company: pxCo(), cashier: c, openedBy: String(pxMe().email || ''), openAt: new Date().toISOString(), date: pxToday(), openCash: pxNum(document.getElementById('px-open').value), status: 'open' }; try { const r = await db.collection('pos_shifts').add(d); PX.shift = Object.assign({ id: r.id }, d); pxRender(); } catch (e) { alert('Error: ' + e.message); } }
async function pxLoadSales(date) { const s = await db.collection('pos_sales').where('site', '==', PX.site).where('date', '==', date).get(); const a = []; s.forEach(d => a.push(Object.assign({ id: d.id }, d.data()))); a.sort((x, y) => (x.atMs || 0) - (y.atMs || 0)); return a; }
function pxSum(list) { const t = { n: 0, gross: 0, total: 0, svc: 0, sc: 0, pwd: 0, disc: 0, comp: 0, vat: 0, exm: 0, void: 0, modes: {} }; list.forEach(s => { if (s.status === 'void') { t.void++; return; } t.n++; t.gross += s.gross || 0; t.total += s.total || 0; t.svc += s.svc || 0; const p = s.pc || {}; t.sc += p.sc || 0; t.pwd += p.pwd || 0; t.disc += p.disc || 0; t.comp += p.comp || 0; t.vat += p.vat || 0; t.exm += p.exm || 0; (s.pays || []).forEach(x => { const a = x.mode === 'cash' ? x.amount - (s.change || 0) : x.amount; t.modes[x.mode] = (t.modes[x.mode] || 0) + a; }); }); return t; }
async function pxSalesView() {
  const date = PX.sdate || (PX.sdate = pxToday()), L = await pxLoadSales(date), T = pxSum(L); PX.sl = L;
  return `<div style="display:flex;gap:.4rem;align-items:end;flex-wrap:wrap;margin-bottom:.5rem;"><div><small>Petsa</small><br><input type="date" value="${date}" onchange="PX.sdate=this.value;pxBody()"></div>${PX.shift ? '<button class="btn btn-warning btn-sm" onclick="pxShiftClose()">🔒 Isara ang Shift (Z-read)</button>' : ''}${PX.shift ? '<button class="btn btn-secondary btn-sm" onclick="pxXRead()">📄 X-read</button>' : ''}</div>
  <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:.4rem;margin-bottom:.5rem;">${[['Transaksyon', T.n], ['Gross', pxM(T.gross)], ['Total (may SC)', pxM(T.total)], ['Service Charge', pxM(T.svc)], ['Senior/PWD', pxM(T.sc + T.pwd)], ['Discount/Comp', pxM(T.disc + T.comp)], ['Void', T.void]].concat(Object.keys(T.modes).map(k => [(PX_MODES[k] || k).replace(/^\S+\s/, ''), pxM(T.modes[k])])).map(([k, v]) => `<div style="border:1px solid #e2e8f0;border-radius:.4rem;padding:.4rem;background:#f8fafc;"><small style="color:#64748b;">${k}</small><div style="font-weight:700;">${v}</div></div>`).join('')}</div>
  <div style="overflow:auto;"><table class="table" style="font-size:.82rem;"><tr><th>No</th><th>Oras</th><th>Cashier</th><th>Items</th><th style="text-align:right;">Total</th><th>Bayad</th><th>OR No. (kalakip)</th><th></th></tr>${L.map((s, i) => `<tr style="${s.status === 'void' ? 'opacity:.5;text-decoration:line-through;' : ''}"><td>${pxE(s.no)}${s.eventName ? ' 🎪' : ''}</td><td>${new Date(s.atMs).toLocaleTimeString('en-PH')}</td><td>${pxE(s.cashier)}</td><td>${(s.items || []).map(l => l.qty + '× ' + pxE(l.name)).join(', ')}</td><td style="text-align:right;">${pxM(s.total)}</td><td>${(s.pays || []).map(p => pxE((PX_MODES[p.mode] || '').replace(/^\S+\s/, ''))).join('+')}</td><td><input value="${pxE(s.orNo || '')}" onchange="pxSetOr('${s.id}',this.value)" style="width:110px;"></td><td><button class="btn btn-secondary btn-sm" onclick="pxReprint(${i})">🖨️</button> ${s.status !== 'void' ? `<button class="btn btn-danger btn-sm" onclick="pxVoid(${i})">Void</button>` : '<b>VOID</b>'}</td></tr>`).join('') || '<tr><td colspan="8"><small>Walang benta sa petsang ito.</small></td></tr>'}</table></div>`;
}
function pxReprint(i) { pxPrint(pxReceiptHtml(PX.sl[i], true)); }
async function pxSetOr(id, v) { try { await db.collection('pos_sales').doc(id).update({ orNo: v.trim() }); } catch (e) { alert('Error: ' + e.message); } }
async function pxVoid(i) {
  const s = PX.sl[i]; if (!pxMgr()) { const p = prompt('Manager PIN para sa void:'); if (p === null || !PX.cfg.mgrPin || String(p) !== String(PX.cfg.mgrPin)) { alert('Mali ang PIN o walang PIN na naka-set.'); return; } }
  const why = prompt('Dahilan ng void:'); if (!why) return; try { await db.collection('pos_sales').doc(s.id).update({ status: 'void', void: { by: String(pxMe().email || ''), reason: why, at: new Date().toISOString() } }); try { await logSystemAction('POS_VOID', `${s.no}: ${why}`); } catch (e) {} pxBody(); } catch (e) { alert('Error: ' + e.message); }
}
async function pxShiftSales() { const s = await db.collection('pos_sales').where('shiftId', '==', PX.shift.id).get(); const a = []; s.forEach(d => a.push(d.data())); return a; }
async function pxXRead() { const T = pxSum(await pxShiftSales()), cashIn = (T.modes.cash || 0) + (PX.shift.openCash || 0); pxModal(`<h3 style="margin-top:0;">📄 X-read — ${pxE(PX.shift.cashier)}</h3>${pxReadHtml(T)}<b>Dapat na cash sa drawer: ${pxM(cashIn)}</b>`); }
function pxReadHtml(T) { return `<table class="table" style="font-size:.85rem;"><tr><td>Transaksyon</td><td style="text-align:right;">${T.n} (void: ${T.void})</td></tr><tr><td>Gross</td><td style="text-align:right;">${pxM(T.gross)}</td></tr><tr><td>Senior / PWD</td><td style="text-align:right;">${pxM(T.sc)} / ${pxM(T.pwd)}</td></tr><tr><td>Discount / Comp</td><td style="text-align:right;">${pxM(T.disc)} / ${pxM(T.comp)}</td></tr><tr><td>Service Charge</td><td style="text-align:right;">${pxM(T.svc)}</td></tr><tr><td><b>Total</b></td><td style="text-align:right;"><b>${pxM(T.total)}</b></td></tr>${Object.keys(T.modes).map(k => `<tr><td>${pxE(PX_MODES[k] || k)}</td><td style="text-align:right;">${pxM(T.modes[k])}</td></tr>`).join('')}</table>`; }
async function pxShiftClose() {
  const T = pxSum(await pxShiftSales()), exp = (T.modes.cash || 0) + (PX.shift.openCash || 0), cnt = prompt(`Z-read\nDapat na cash sa drawer: ${pxM(exp)}\nIlagay ang aktwal na bilang ng cash:`); if (cnt === null) return; const c = pxNum(cnt);
  try { await db.collection('pos_shifts').doc(PX.shift.id).update({ status: 'closed', closeAt: new Date().toISOString(), closeCash: c, expectedCash: pxR2(exp), over: pxR2(c - exp), summary: { n: T.n, gross: pxR2(T.gross), total: pxR2(T.total), svc: pxR2(T.svc), modes: T.modes } }); pxModal(`<h3 style="margin-top:0;">🔒 Z-read — ${pxE(PX.shift.cashier)}</h3>${pxReadHtml(T)}<b>Cash: dapat ${pxM(exp)} · bilang ${pxM(c)} · ${c - exp >= 0 ? 'sobra' : 'kulang'} ${pxM(Math.abs(c - exp))}</b>`); PX.shift = null; pxRender(); } catch (e) { alert('Error: ' + e.message); }
}
async function pxEventReport(id) { const e = PX.events.find(x => x.id === id), s = await db.collection('pos_sales').where('eventId', '==', id).get(), L = []; s.forEach(d => L.push(d.data())); const T = pxSum(L); pxModal(`<h3 style="margin-top:0;">📊 ${pxE(e.name)}</h3>${pxReadHtml(T)}`); }

/* ================= MEMBERS ================= */
async function pxMembersView() {
  const q = String(PX.mq || '').toLowerCase(), L = PX.members.filter(m => !q || String(m.mid).toLowerCase().includes(q) || String(m.name).toLowerCase().includes(q) || String(m.club).toLowerCase().includes(q)).sort((a, b) => String(a.name).localeCompare(String(b.name)));
  return `<div style="display:flex;gap:.4rem;margin-bottom:.5rem;flex-wrap:wrap;"><input type="search" placeholder="🔎 ID, pangalan, club" value="${pxE(PX.mq || '')}" oninput="PX.mq=this.value;pxMemFilter()" style="flex:1;min-width:160px;"><button class="btn btn-primary btn-sm" onclick="pxMemEdit('')">➕ Bagong member</button></div>
  <div style="overflow:auto;"><table class="table" style="font-size:.85rem;" id="px-mt"><tr><th>ID No.</th><th>Pangalan</th><th>Club</th><th>Nairehistro</th><th>Ni</th><th></th></tr>${L.slice(0, 400).map(m => `<tr><td>${pxE(m.mid)}</td><td>${pxE(m.name)}</td><td>${pxE(m.club)}</td><td>${pxE(m.regDate)}</td><td><small>${pxE(m.addedBy)}</small></td><td><button class="btn btn-secondary btn-sm" onclick="pxMemHist('${m.id}')">🧾</button> ${pxAdmin() ? `<button class="btn btn-secondary btn-sm" onclick="pxMemEdit('${m.id}')">✏️</button>` : ''}</td></tr>`).join('') || '<tr><td colspan="6"><small>Wala pang member.</small></td></tr>'}</table></div>`;
}
function pxMemFilter() { clearTimeout(PX._mt); PX._mt = setTimeout(pxBody, 250); }
function pxMemEdit(id) {
  const m = id ? PX.members.find(x => x.id === id) : { mid: '', name: '', club: '' }; PX_MM = id;
  pxModal(`<h3 style="margin-top:0;">🪪 Member</h3><div style="display:grid;gap:.3rem;"><input id="mm-id" placeholder="ID No." value="${pxE(m.mid)}" ${id ? 'readonly' : ''}><input id="mm-name" placeholder="Pangalan" value="${pxE(m.name)}"><select id="mm-club"><option value="">— Club —</option>${PX.clubs.map(c => `<option ${c.name === m.club ? 'selected' : ''}>${pxE(c.name)}</option>`).join('')}</select></div><button class="btn btn-success" style="margin-top:.4rem;" onclick="pxMemSave()">💾 I-save</button>`, 460);
}
let PX_MM = '';
async function pxMemSave() {
  const mid = document.getElementById('mm-id').value.trim(), name = document.getElementById('mm-name').value.trim(), club = document.getElementById('mm-club').value; if (!mid || !name) { alert('Ilagay ang ID at pangalan.'); return; }
  const id = PX_MM || pxSlug(pxCo()) + '__' + pxSlug(mid); if (!PX_MM && PX.members.some(m => String(m.mid).toLowerCase() === mid.toLowerCase())) { alert('May member na gumagamit ng ID na iyan.'); return; }
  const cl = PX.clubs.find(c => c.name === club) || {}; const d = { company: pxCo(), mid, name, club, clubId: cl.id || '' }; if (!PX_MM) { d.regDate = pxToday(); d.addedBy = String(pxMe().email || ''); d.addedAt = new Date().toISOString(); }
  try { await db.collection('pos_members').doc(id).set(d, { merge: true }); const i = PX.members.findIndex(m => m.id === id); if (i >= 0) Object.assign(PX.members[i], d); else PX.members.push(Object.assign({ id }, d)); pxClose(); pxBody(); } catch (e) { alert('Error: ' + e.message); }
}
async function pxMemHist(id) { const m = PX.members.find(x => x.id === id), s = await db.collection('pos_sales').where('memberKey', '==', id).get(), L = []; s.forEach(d => L.push(Object.assign({ id: d.id }, d.data()))); L.sort((a, b) => b.atMs - a.atMs); pxModal(`<h3 style="margin-top:0;">🧾 ${pxE(m.name)} (${pxE(m.mid)})</h3><table class="table" style="font-size:.8rem;"><tr><th>Petsa</th><th>Branch</th><th>No</th><th style="text-align:right;">Charge</th><th>Status</th></tr>${L.map(x => `<tr><td>${pxE(x.date)}</td><td>${pxE(x.siteName)}</td><td>${pxE(x.no)}</td><td style="text-align:right;">${pxM(x.memberCharge)}</td><td>${pxE(x.status === 'void' ? 'void' : x.chargeStatus)}</td></tr>`).join('') || '<tr><td colspan="5">Wala.</td></tr>'}</table>`, 680); }

/* ================= CLUBS / STATEMENT ================= */
async function pxClubsView() {
  const clubs = PX.clubs, cid = PX.clubSel || (clubs[0] || {}).id || '', mon = PX.clubMon || pxToday().slice(0, 7), cl = clubs.find(c => c.id === cid);
  let body = '<p style="color:#64748b;">Gumawa muna ng club.</p>';
  if (cl) {
    const s = await db.collection('pos_sales').where('clubId', '==', cid).get(), L = []; s.forEach(d => { const x = d.data(); if (x.status !== 'void' && x.memberCharge > 0 && String(x.date).slice(0, 7) === mon) L.push(Object.assign({ id: d.id }, x)); }); L.sort((a, b) => a.atMs - b.atMs); PX.stl = L;
    const net = x => { const f = x.total ? x.memberCharge / x.total : 0; return ((x.pc && x.pc.vat) || 0) * f + ((x.pc && x.pc.exm) || 0) * f; }; // net ng VAT at SC (SC hindi kasama)
    const gross = L.reduce((a, x) => a + x.memberCharge, 0), disp = L.filter(x => x.chargeStatus === 'disputed'), dsum = disp.reduce((a, x) => a + x.memberCharge, 0), ok = L.filter(x => x.chargeStatus !== 'disputed'), okS = ok.reduce((a, x) => a + x.memberCharge, 0), okNet = ok.reduce((a, x) => a + net(x), 0), pct = +cl.pct || 0, share = pxR2(okNet * pct / 100), due = pxR2(okS - share), paidS = L.filter(x => x.chargeStatus === 'paid').reduce((a, x) => a + x.memberCharge, 0);
    body = `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:.4rem;margin:.5rem 0;">${[['Kabuuang charge', pxM(gross)], ['Disputed', pxM(dsum)], ['Hindi disputed', pxM(okS)], ['Share ng club ' + pct + '% (net ng VAT)', '−' + pxM(share)], ['Dapat bayaran sa atin', pxM(due)], ['Nabayaran na', pxM(paidS)], ['Balanse', pxM(due - paidS)]].map(([k, v]) => `<div style="border:1px solid #e2e8f0;border-radius:.4rem;padding:.4rem;background:#f8fafc;"><small style="color:#64748b;">${k}</small><div style="font-weight:700;">${v}</div></div>`).join('')}</div>
    <button class="btn btn-secondary btn-sm" onclick="pxClubCsv()">⬇️ CSV</button> <button class="btn btn-secondary btn-sm" onclick="pxClubPct('${cid}')">% ng club: ${pct}</button>
    <div style="overflow:auto;margin-top:.4rem;"><table class="table" style="font-size:.8rem;"><tr><th>Petsa</th><th>Branch</th><th>No</th><th>Member</th><th style="text-align:right;">Charge</th><th>Status</th><th>Pirma</th><th></th></tr>${L.map((x, i) => `<tr style="${x.chargeStatus === 'disputed' ? 'background:#fef2f2;' : ''}"><td>${pxE(x.date)}</td><td>${pxE(x.siteName)}</td><td>${pxE(x.no)}</td><td>${pxE(x.member ? x.member.name : '')}<br><small>${pxE(x.member ? x.member.mid : '')}</small></td><td style="text-align:right;">${pxM(x.memberCharge)}</td><td>${pxE(x.chargeStatus)}</td><td>${x.sig ? `<img src="${x.sig}" style="height:28px;" data-zoom>` : '—'}</td><td><select onchange="pxChStatus(${i},this.value)"><option value="">Status…</option><option value="billed">Billed</option><option value="disputed">Disputed</option><option value="paid">Paid</option></select> <button class="btn btn-secondary btn-sm" onclick="pxReprintSt(${i})">🖨️</button></td></tr>`).join('') || '<tr><td colspan="8"><small>Walang charge sa buwan na ito.</small></td></tr>'}</table></div>`;
  }
  return `<div style="display:flex;gap:.4rem;flex-wrap:wrap;align-items:end;"><div><small>Club</small><br><select onchange="PX.clubSel=this.value;pxBody()">${clubs.map(c => `<option value="${c.id}" ${c.id === cid ? 'selected' : ''}>${pxE(c.name)}</option>`).join('')}</select></div><div><small>Buwan</small><br><input type="month" value="${mon}" onchange="PX.clubMon=this.value;pxBody()"></div><button class="btn btn-primary btn-sm" onclick="pxClubNew()">➕ Bagong club</button></div>${body}`;
}
async function pxClubNew() { const n = (prompt('Pangalan ng club:') || '').trim(); if (!n) return; const p = pxNum(prompt('Porsyento ng club sa sales (hal. 10):') || '0'); const id = pxSlug(pxCo()) + '__' + pxSlug(n); try { await db.collection('pos_clubs').doc(id).set({ company: pxCo(), name: n, pct: p }); PX.clubs = PX.clubs.filter(c => c.id !== id).concat([{ id, company: pxCo(), name: n, pct: p }]); PX.clubSel = id; pxBody(); } catch (e) { alert('Error: ' + e.message); } }
async function pxClubPct(id) { const p = prompt('Porsyento ng club (hal. 10):'); if (p === null) return; const v = pxNum(p); try { await db.collection('pos_clubs').doc(id).update({ pct: v }); PX.clubs.find(c => c.id === id).pct = v; pxBody(); } catch (e) { alert('Error: ' + e.message); } }
async function pxChStatus(i, v) { if (!v) return; const x = PX.stl[i]; if (v === 'disputed' && !confirm('Markahan na disputed ang charge na ito?')) return; try { await db.collection('pos_sales').doc(x.id).update({ chargeStatus: v }); try { await logSystemAction('POS_CHARGE_' + v.toUpperCase(), x.no); } catch (e) {} pxBody(); } catch (e) { alert('Error: ' + e.message); } }
function pxReprintSt(i) { pxPrint(pxReceiptHtml(PX.stl[i], true)); }
function pxClubCsv() { const rows = [['Petsa', 'Branch', 'No', 'Member ID', 'Member', 'Charge', 'Status']].concat((PX.stl || []).map(x => [x.date, x.siteName, x.no, x.member ? x.member.mid : '', x.member ? x.member.name : '', x.memberCharge, x.chargeStatus])); const csv = rows.map(r => r.map(c => '"' + String(c == null ? '' : c).replace(/"/g, '""') + '"').join(',')).join('\n'), a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); a.download = 'club-statement.csv'; a.click(); }

/* ================= IDEAL vs ACTUAL ================= */
async function pxIdealView() {
  const to = PX.ito || pxToday(), from = PX.ifrom || (() => { const d = new Date(); d.setDate(d.getDate() - 6); return pxISO(d); })(), key = PX.site + '__' + from + '__' + to;
  let ideal = {}, nSales = 0; const days = []; for (let d = new Date(from + 'T00:00:00'), i = 0; pxISO(d) <= to && i < 45; d.setDate(d.getDate() + 1), i++) days.push(pxISO(d));
  for (const dt of days) (await pxLoadSales(dt)).forEach(s => { if (s.status === 'void') return; nSales++; Object.keys(s.use || {}).forEach(k => { const u = s.use[k]; ideal[k] = ideal[k] || { name: u.name, unit: u.unit, qty: 0 }; ideal[k].qty += u.qty; }); });
  const cnt = async dt => { const o = {}; try { const sn = await db.collection('inventory_counts').where('branchCode', '==', pxSite().code).where('countDate', '==', dt).get(); sn.forEach(d => (d.data().lines || []).forEach(l => { o[l.itemCode] = o[l.itemCode] || { name: l.itemName, unit: l.uom, qty: 0 }; o[l.itemCode].qty += +l.qty || 0; })); } catch (e) {} return o; };
  const beg = await cnt(from), end = await cnt(to); let inn = {}; try { const d = await db.collection('pos_ideal').doc(key).get(); inn = d.exists ? (d.data().in || {}) : {}; } catch (e) {} PX.iKey = key; PX.iIn = inn;
  const codes = [...new Set([...Object.keys(ideal), ...Object.keys(beg).filter(k => ideal[k])])].sort((a, b) => ((ideal[a] || beg[a]).name || '').localeCompare((ideal[b] || beg[b]).name || ''));
  const rows = codes.map(k => { const b = (beg[k] || {}).qty || 0, e = (end[k] || {}).qty || 0, i = +inn[k] || 0, act = b + i - e, id = (ideal[k] || {}).qty || 0, v = act - id; return { k, name: (ideal[k] || beg[k]).name, unit: (ideal[k] || {}).unit || (beg[k] || {}).unit, b, i, e, act, id, v, pct: id ? v / id * 100 : 0 }; });
  return `<div style="display:flex;gap:.4rem;flex-wrap:wrap;align-items:end;margin-bottom:.4rem;"><div><small>Mula</small><br><input type="date" value="${from}" onchange="PX.ifrom=this.value;pxBody()"></div><div><small>Hanggang</small><br><input type="date" value="${to}" onchange="PX.ito=this.value;pxBody()"></div><button class="btn btn-success btn-sm" onclick="pxIdealSave()">💾 I-save ang "Delivery/Dagdag"</button><small style="color:#64748b;">${nSales} benta · Beg = bilang noong ${from}, End = bilang noong ${to} (inventory count ng branch)</small></div>
  <div style="overflow:auto;"><table class="table" style="font-size:.8rem;"><tr><th>Item</th><th>Unit</th><th style="text-align:right;">Beg</th><th style="text-align:right;">+ Delivery</th><th style="text-align:right;">End</th><th style="text-align:right;">Actual gamit</th><th style="text-align:right;">Ideal (benta)</th><th style="text-align:right;">Variance</th><th style="text-align:right;">%</th></tr>${rows.map(r => `<tr style="${Math.abs(r.pct) > 5 ? 'background:#fef2f2;' : ''}"><td>${pxE(r.name)}<br><small>${pxE(r.k)}</small></td><td>${pxE(r.unit)}</td><td style="text-align:right;">${r.b.toFixed(2)}</td><td style="text-align:right;"><input type="number" step="any" value="${r.i || ''}" data-k="${pxE(r.k)}" class="ix-in" style="width:70px;"></td><td style="text-align:right;">${r.e.toFixed(2)}</td><td style="text-align:right;">${r.act.toFixed(2)}</td><td style="text-align:right;">${r.id.toFixed(2)}</td><td style="text-align:right;color:${r.v > 0 ? '#dc2626' : '#16a34a'};">${r.v.toFixed(2)}</td><td style="text-align:right;">${r.pct.toFixed(1)}%</td></tr>`).join('') || '<tr><td colspan="9"><small>Walang datos. Kailangan ng benta na may sangkap ang menu at inventory count sa dalawang petsa.</small></td></tr>'}</table></div><small style="color:#64748b;">Positibong variance = mas marami ang nagamit kaysa dapat (sobra/nawala). Pula = lampas 5%.</small>`;
}
async function pxIdealSave() { const o = {}; document.querySelectorAll('.ix-in').forEach(x => { if (x.value !== '') o[x.dataset.k] = pxNum(x.value); }); try { await db.collection('pos_ideal').doc(PX.iKey).set({ site: PX.site, in: o, by: String(pxMe().email || ''), at: new Date().toISOString() }); pxToast('✅ Na-save'); pxBody(); } catch (e) { alert('Error: ' + e.message); } }

/* ================= BRANCH DOCS ================= */
const PX_DOCT = ['BIR Certificate of Registration (2303)', 'Business / Mayor\'s Permit', 'Municipal Permit', 'Sanitary Permit', 'Fire Safety Certificate', 'DTI / SEC', 'Lease Contract', 'Iba pa'];
async function pxDocsView() {
  const d = await db.collection('pos_docs').doc(PX.site).get(), L = d.exists ? (d.data().list || []) : []; PX.dl = L; const t = pxToday(), soon = pxISO(new Date(Date.now() + 30 * 864e5));
  return `<div style="display:flex;gap:.4rem;flex-wrap:wrap;align-items:end;margin-bottom:.5rem;"><select id="pd-t">${PX_DOCT.map(x => `<option>${pxE(x)}</option>`).join('')}</select><div><small>Expiry (kung meron)</small><br><input type="date" id="pd-x"></div><input type="file" id="pd-f" accept="image/*,application/pdf"><button class="btn btn-primary btn-sm" onclick="pxDocAdd()">⬆️ I-upload</button></div>
  <table class="table" style="font-size:.85rem;"><tr><th>Dokumento</th><th>Expiry</th><th>Na-upload</th><th></th></tr>${L.map((x, i) => `<tr><td>${pxE(x.type)}<br><small>${pxE(x.name)}</small></td><td>${x.expiry ? pxE(x.expiry) + (x.expiry < t ? ' <b style="color:#dc2626;">EXPIRED</b>' : x.expiry <= soon ? ' <b style="color:#d97706;">malapit na</b>' : '') : '—'}</td><td><small>${pxE(x.by)} ${pxE(String(x.at || '').slice(0, 10))}</small></td><td><button class="btn btn-secondary btn-sm" onclick="pxDocOpen(${i})">👁️</button> <button class="btn btn-danger btn-sm" onclick="pxDocDel(${i})">🗑️</button></td></tr>`).join('') || '<tr><td colspan="4"><small>Wala pang naka-upload.</small></td></tr>'}</table>`;
}
async function pxDocAdd() { const f = (document.getElementById('pd-f').files || [])[0]; if (!f) { alert('Pumili ng larawan o PDF.'); return; } try { const r = await reqSaveFile(f, 'posdoc:' + PX.site, 'pos-doc'); const L = (PX.dl || []).concat([{ id: r.id, name: r.name || f.name, type: document.getElementById('pd-t').value, expiry: document.getElementById('pd-x').value, by: String(pxMe().email || ''), at: new Date().toISOString() }]); await db.collection('pos_docs').doc(PX.site).set({ site: PX.site, list: L }); pxBody(); } catch (e) { alert('Error: ' + e.message); } }
async function pxDocOpen(i) { try { const f = await reqLoadFile(PX.dl[i].id); if (!f) { alert('Wala nang file.'); return; } imgOpen(f.dataUrl); } catch (e) { alert('Error: ' + e.message); } }
async function pxDocDel(i) { if (!await uiConfirm('Burahin ang dokumentong ito?')) return; const L = PX.dl.slice(); L.splice(i, 1); try { await db.collection('pos_docs').doc(PX.site).set({ site: PX.site, list: L }); pxBody(); } catch (e) { alert('Error: ' + e.message); } }

/* ================= ROSTER ================= */
async function pxRosterView() {
  const L = await pxRosterNames(); PX.rl = L; let dir = []; try { const s = await db.collection('emp_directory').get(); s.forEach(d => dir.push(Object.assign({ id: d.id }, d.data()))); } catch (e) {} PX.dir = dir; const site = pxSite(), mine = dir.filter(e => e.status !== 'Resigned' && e.status !== 'Terminated' && !L.some(r => r.id === e.id));
  return `<p style="font-size:.85rem;color:#64748b;">Mga empleyado ng branch (mula sa HR). Sila ang mapipiling cashier sa POS.</p>
  <div style="display:flex;gap:.4rem;flex-wrap:wrap;"><input list="pr-dl" id="pr-q" placeholder="Hanapin ang empleyado mula sa HR..." style="min-width:260px;"><datalist id="pr-dl">${mine.map(e => `<option value="${pxE(e.name)} — ${pxE(e.id)}">`).join('')}</datalist><button class="btn btn-primary btn-sm" onclick="pxRosterAdd()">➕ Idagdag</button>${PX.role === 'admin' || (typeof canEditModule === 'function' && canEditModule('employees')) ? '<button class="btn btn-secondary btn-sm" onclick="pxDirSync()" title="Kopyahin ang pangalan/posisyon/branch lang (walang sahod o pribadong detalye)">🔄 I-sync ang Directory mula sa HR</button>' : ''}</div>
  <table class="table" style="margin-top:.5rem;font-size:.85rem;"><tr><th>Pangalan</th><th>Posisyon</th><th></th></tr>${L.map((r, i) => `<tr><td>${pxE(r.name)}</td><td>${pxE(r.position)}</td><td><button class="btn btn-danger btn-sm" onclick="pxRosterDel(${i})">✖</button></td></tr>`).join('') || '<tr><td colspan="3"><small>Wala pa.</small></td></tr>'}</table><small>${dir.length ? dir.length + ' empleyado sa directory' : 'Wala pang directory — ipa-sync muna sa HR/Admin.'}</small>`;
}
async function pxRosterAdd() { const v = document.getElementById('pr-q').value, id = String(v).split(' — ').pop().trim(), e = (PX.dir || []).find(x => x.id === id); if (!e) { alert('Pumili sa listahan ng HR employees.'); return; } const L = (PX.rl || []).concat([{ id: e.id, name: e.name, position: e.position || '' }]); try { await db.collection('pos_roster').doc(PX.site).set({ site: PX.site, list: L, by: String(pxMe().email || ''), at: new Date().toISOString() }); pxBody(); } catch (er) { alert('Error: ' + er.message); } }
async function pxRosterDel(i) { const L = (PX.rl || []).slice(); L.splice(i, 1); try { await db.collection('pos_roster').doc(PX.site).set({ site: PX.site, list: L }); pxBody(); } catch (e) { alert('Error: ' + e.message); } }
async function pxDirSync() { try { const s = await db.collection('employees').get(); let n = 0, b = db.batch(); s.forEach(d => { const x = d.data(); b.set(db.collection('emp_directory').doc(d.id), { name: x.name || ((x.firstName || '') + ' ' + (x.lastName || '')).trim() || d.id, position: x.role || '', branch: x.branch || '', branchCode: x.branchCode || '', company: x.company || '', status: x.status || '' }); n++; }); await b.commit(); alert('✅ Na-sync ang ' + n + ' empleyado.'); pxBody(); } catch (e) { alert('Error: ' + e.message); } }
