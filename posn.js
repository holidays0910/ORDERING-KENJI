/* =====================================================================
   👔 POSITION MANAGEMENT · AREA MANAGER · EMPLOYEE HISTORY
   system_settings/positions {list:[...]}  -> mga pagpipilian sa "Job Title / Position" ng Employee profile (puwede pa ring mag-type ng iba)
   users/{email}.branches[] + areaManager:true -> Area Manager: nakikita/na-e-edit niya ang Prime Cost at LST ng mga branch na iyon (Admin lang ang nagtatakda)
   employees/{id}/history/{hid} {type,date,effective,position,salary,notes,fileId,fileName,applied,by,at}  -> promotion/contract/evaluation, may litrato/PDF
   ===================================================================== */
const POS_TYPES = ['Promotion', 'Contract (bago/renewal)', 'Evaluation', 'Transfer', 'Salary adjustment', 'Memo / Disciplinary', 'Iba pa'];
let POS = { items: [], list: [], loaded: false, hist: [], histEmp: '' };
function posEsc(s) { return typeof srchEsc === 'function' ? srchEsc(s) : String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function posCan() { const u = getCurrentUser() || {}; return normalizeRole(u.role) === 'admin' || (typeof canEditModule === 'function' && canEditModule('employees')); }
function posAdmin() { const u = getCurrentUser() || {}; return normalizeRole(u.role) === 'admin'; }
function posParse(t) { return [...new Set(String(t || '').split(/\n+/).map(x => x.trim()).filter(Boolean))]; }
async function posAttach() {
  await posLoad(); let dl = document.getElementById('hr-positions-dl'); if (!dl) { dl = document.createElement('datalist'); dl.id = 'hr-positions-dl'; document.body.appendChild(dl); }
  dl.innerHTML = POS.list.map(p => `<option value="${posEsc(p)}">`).join('');
  const r = document.getElementById('hr-emp-role'); if (r) { r.removeAttribute('list'); r.readOnly = true; r.placeholder = '🔎 Pindutin para maghanap / pumili'; r.style.cursor = 'pointer'; r.onclick = () => posPickRole(); }
  const t = document.getElementById('hr-emp-reportingto'); if (t) { t.readOnly = true; t.placeholder = '🔎 Pindutin para maghanap ng empleyado'; t.style.cursor = 'pointer'; t.onclick = () => posPickBoss(); }
}
/* ---------- Searchable picker (Job Title / Reporting To) ---------- */
function posPickOpen(title, items, onPick, extra) {
  POS.pk = { items, onPick, extra }; arModal(`<h3>${posEsc(title)}</h3><input type="search" id="pk-q" placeholder="🔎 Hanapin…" oninput="posPickList()" style="width:100%;margin-bottom:.5rem;" autocomplete="off"><div id="pk-list" style="max-height:50vh;overflow:auto;"></div>`);
  const m = document.getElementById('ar-modal'); if (m) m.style.zIndex = '10002'; posPickList(); const q = document.getElementById('pk-q'); if (q && q.focus) q.focus();
}
function posPickList() {
  const q = String((document.getElementById('pk-q') || {}).value || '').trim().toLowerCase(), pk = POS.pk, box = document.getElementById('pk-list'); if (!pk || !box) return;
  const rows = pk.items.map((it, i) => ({ it, i })).filter(x => !q || (x.it.label + ' ' + (x.it.sub || '')).toLowerCase().includes(q));
  let h = rows.slice(0, 200).map(x => `<div onclick="posPickSel(${x.i})" style="padding:.5rem;border-bottom:1px solid #f1f5f9;cursor:pointer;"><b>${posEsc(x.it.label)}</b>${x.it.sub ? `<br><small style="color:#64748b;">${posEsc(x.it.sub)}</small>` : ''}</div>`).join('');
  if (pk.extra) { const raw = String((document.getElementById('pk-q') || {}).value || '').trim(); if (raw && !pk.items.some(it => it.label.toLowerCase() === raw.toLowerCase())) h = `<div onclick="posPickNew()" style="padding:.5rem;border-bottom:1px solid #f1f5f9;cursor:pointer;color:#16a34a;"><b>➕ Gamitin bilang bagong position: "${posEsc(raw)}"</b></div>` + h; }
  if (pk.clear) h += ''; box.innerHTML = h || '<p style="color:#94a3b8;">Walang tugma.</p>';
}
function posPickSel(i) { const pk = POS.pk; if (!pk) return; const it = pk.items[i]; arCloseModal(); pk.onPick(it); }
function posPickNew() { const pk = POS.pk, raw = String((document.getElementById('pk-q') || {}).value || '').trim(); if (!pk || !raw) return; arCloseModal(); pk.onPick({ label: raw, isNew: true }); }
async function posPickRole() {
  await posLoad(); const cur = (document.getElementById('hr-emp-role') || {}).value || '';
  await posLoad(); const items = POS.items.map(p => ({ label: p.name, sub: p.type === 'unique' ? (p.holders[0] ? 'Isang tao lang — ' + p.holders[0].name : 'Isang tao lang — wala pang naka-set') : p.type === 'branches' ? 'May hawak na branch' : '' })); posPickOpen('👔 Job Title / Position', items, it => { document.getElementById('hr-emp-role').value = it.label; }, true);
}
async function posBossItems(noExclude) {
  let emps = typeof hrEmployees !== 'undefined' ? hrEmployees : []; if (!emps.length && db) { try { emps = (await db.collection('employees').get()).docs.map(d => Object.assign({ id: d.id }, d.data())); } catch (e) {} }
  const me = noExclude ? '' : ((document.getElementById('hr-emp-id') || {}).value || '');
  return emps.filter(e => e.id !== me && (e.status || 'Active') === 'Active').sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''))).map(e => ({ label: e.name || '', sub: [e.role, e.branch, e.empId].filter(Boolean).join(' · '), id: e.id, email: String(e.email || '').toLowerCase() }));
}
async function posPickBoss() {
  const items = await posBossItems(); items.unshift({ label: '— Blangko (walang reporting officer) —', clear: true }); items.unshift({ label: 'N/A — Owner / walang nire-report-an', sub: 'Para sa President/Owner na walang reporting officer', na: true });
  posPickOpen('👤 Reporting Officer / Head', items, it => { const t = document.getElementById('hr-emp-reportingto'), a = document.getElementById('hr-emp-reportingto-id'), b = document.getElementById('hr-emp-reportingto-email'); if (it.clear || it.na) { t.value = it.na ? 'N/A' : ''; if (a) a.value = ''; if (b) b.value = ''; return; } t.value = it.label; if (a) a.value = it.id || ''; if (b) b.value = it.email || ''; });
}
/* ---------- POSITION MANAGEMENT (listahan, add/edit/delete, may-hawak) ---------- */
// system_settings/positions {items:[{id,name,type:'general'|'unique'|'branches',approver:''|'coo'|'president'|'supply'|'accounting',access:bool,holders:[{empId,name,email,branches:[]}]}], list:[mga pangalan]}
// general = karaniwang job title (Cook, Cashier…) · unique = isang tao lang (President, COO, Accounting Manager…) · branches = may hawak na branch (Area Manager, Branch Manager…; access = nabibigyan ng access sa mga branch na iyon)
const POS_APPR = { '': 'Walang email link', coo: 'COO', president: 'President', supply: 'Head of Supply Chain', accounting: 'Accounting Manager' };
const POS_TYPE = { general: 'Karaniwan (maraming tao)', unique: 'Isang tao lang', branches: 'May hawak na branch' };
function posId(n) { return String(n || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || ('p' + Date.now()); }
function posClone(o) { return JSON.parse(JSON.stringify(o)); }
function posFind(name) { return POS.items.find(x => x.name.toLowerCase() === String(name || '').trim().toLowerCase()); }
async function posLoad(force) {
  if ((POS.loaded && !force) || !db) return; POS.items = [];
  try { const d = await db.collection('system_settings').doc('positions').get(); if (d.exists) { const x = d.data(); POS.items = (x.items || (x.list || []).map(n => ({ id: posId(n), name: n, type: 'general', approver: '', access: false, holders: [] }))).map(i => Object.assign({ type: 'general', approver: '', access: false, holders: [] }, i)); } } catch (e) {}
  POS.items.sort((a, b) => a.name.localeCompare(b.name)); POS.list = POS.items.map(i => i.name); POS.loaded = true;
}
async function posPersist() {
  POS.items.sort((a, b) => a.name.localeCompare(b.name)); POS.list = POS.items.map(i => i.name);
  await db.collection('system_settings').doc('positions').set({ items: POS.items, list: POS.list, updatedBy: (getCurrentUser() || {}).email || '', updatedAt: new Date().toISOString() });
  posAttach();
}
// Approver email link — Admin lang ang makakasulat sa mga setting na ito
async function posApproverSync(approver, email) {
  if (!approver) return true; email = String(email || '').toLowerCase(); const S = db.collection('system_settings');
  try {
    if (approver === 'coo') { await S.doc('request_approvers').set({ cooEmail: email }, { merge: true }); await S.doc('po_signatories').set({ cooEmail: email }, { merge: true }); }
    else if (approver === 'president') await S.doc('request_approvers').set({ presidentEmail: email }, { merge: true });
    else if (approver === 'supply') await S.doc('po_signatories').set({ supplyChainEmail: email }, { merge: true });
    else if (approver === 'accounting') await S.doc('request_approvers').set({ accountingEmails: email }, { merge: true });
    try { if (typeof ntfCache !== 'undefined') ntfCache = null; } catch (e) {} return true;
  } catch (e) { return false; }
}
// Access sa branch (Area Manager): users/{email}.branches
async function posUserAccess(email, branches) {
  email = String(email || '').toLowerCase(); if (!email) return; const D = firebase.firestore.FieldValue.delete();
  try { const ref = db.collection('users').doc(email), d = await ref.get(); if (!d.exists) return false; if (branches && branches.length) await ref.update({ branches, areaManager: true }); else await ref.update({ branches: D, areaManager: D }); return true; } catch (e) { return false; }
}
async function posOpen() {
  if (!posCan()) { alert('HR/Admin lang.'); return; } await posLoad(true);
  const rows = POS.items.map(p => { const hs = p.holders || []; const holder = p.type === 'general' ? '<span style="color:#94a3b8;">—</span>' : hs.length ? hs.map(h => `${posEsc(h.name)}${p.type === 'branches' ? ` <small style="color:#64748b;">(${(h.branches || []).map(posEsc).join(', ') || 'walang branch'})</small>` : ''}`).join('<br>') : '<span style="color:#dc2626;">wala pang naka-set</span>'; return `<tr><td><b>${posEsc(p.name)}</b></td><td>${posEsc(POS_TYPE[p.type])}${p.approver ? `<br><small style="color:#2563eb;">📧 ${posEsc(POS_APPR[p.approver])}</small>` : ''}</td><td style="font-size:.82rem;">${holder}</td><td style="white-space:nowrap;"><button class="btn btn-secondary btn-sm" onclick="posEdit('${posEsc(p.id)}')">✏️</button> <button class="btn btn-secondary btn-sm" onclick="posDelete('${posEsc(p.id)}')">🗑️</button></td></tr>`; }).join('');
  arModal(`<h3>👔 Position Management</h3><p style="font-size:.82rem;color:#64748b;">Dito ang lahat ng position. Ang may <b>Isang tao lang</b> (President, COO, Accounting Manager…) ay may isang naka-set na tao; ang <b>May hawak na branch</b> (Area Manager, Branch Manager) ay may mga branch kada tao. Naka-link ito sa Employee Management at sa email ng mga approver.</p>
  <button class="btn btn-success" onclick="posEdit('')">➕ Magdagdag ng Position</button>
  <div style="overflow:auto;margin-top:.6rem;max-height:55vh;"><table class="data-table" style="width:100%;font-size:.85rem;"><thead><tr><th>Position</th><th>Uri</th><th>May hawak</th><th></th></tr></thead><tbody>${rows || '<tr><td colspan="4" style="color:#94a3b8;">Wala pang position.</td></tr>'}</tbody></table></div>`);
  const m = document.getElementById('ar-modal'); if (m) m.style.zIndex = '10002';
}
async function posBranches() { if (POS.brs) return POS.brs; let b = []; try { b = (await db.collection('inventory_branches').get()).docs.map(d => d.data().branch || d.data().code).filter(Boolean); } catch (e) {} POS.brs = [...new Set(b)].sort(); return POS.brs; }
async function posEdit(id) {
  await posBranches(); const p = id ? POS.items.find(x => x.id === id) : null; POS.ed = p ? posClone(p) : { id: '', name: '', type: 'general', approver: '', access: false, holders: [] }; POS.edOrig = p ? posClone(p) : null; posEdShow();
}
function posEdSync() { const g = i => (document.getElementById(i) || {}).value; const e = POS.ed; if (!e || g('pe-name') === undefined) return; e.name = String(g('pe-name') || '').trim(); e.type = g('pe-type') || e.type; e.approver = e.type === 'unique' ? (g('pe-appr') || '') : ''; e.access = e.type === 'branches' && !!(document.getElementById('pe-access') || {}).checked; document.querySelectorAll('.pe-br').forEach(c => { const h = e.holders[+c.dataset.h]; if (!h) return; h.branches = h.branches || []; const i = h.branches.indexOf(c.value); if (c.checked && i < 0) h.branches.push(c.value); if (!c.checked && i >= 0) h.branches.splice(i, 1); }); if (e.type === 'general') e.holders = []; if (e.type === 'unique') e.holders = e.holders.slice(0, 1); }
function posEdShow() {
  const e = POS.ed, adm = posAdmin(); let hold = '';
  if (e.type === 'unique') hold = `<div class="form-group"><label>Sino ang may hawak (isang tao lang)</label>${e.holders[0] ? `<div style="padding:.4rem;border:1px solid #e2e8f0;border-radius:.4rem;">👤 <b>${posEsc(e.holders[0].name)}</b> <small>${posEsc(e.holders[0].email || 'walang email')}</small> <button type="button" class="btn btn-secondary btn-sm" onclick="posEdHolder(0)">Palitan</button> <button type="button" class="btn btn-secondary btn-sm" onclick="posEdSync();POS.ed.holders=[];posEdShow()">✖</button></div>` : `<button type="button" class="btn btn-secondary" onclick="posEdHolder(-1)">🔎 Pumili ng empleyado</button>`}</div>`;
  if (e.type === 'branches') hold = `<div class="form-group"><label>Mga may hawak at ang kanilang branch</label>${e.holders.map((h, i) => `<div style="border:1px solid #e2e8f0;border-radius:.4rem;padding:.4rem;margin-bottom:.4rem;"><b>${posEsc(h.name)}</b> <small>${posEsc(h.email || 'walang email')}</small> <button type="button" class="btn btn-secondary btn-sm" onclick="posEdSync();POS.ed.holders.splice(${i},1);posEdShow()">✖ Alisin</button><div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:.15rem;margin-top:.3rem;">${(POS.brs || []).map(b => `<label style="font-size:.8rem;"><input type="checkbox" class="pe-br" data-h="${i}" value="${posEsc(b)}" ${(h.branches || []).includes(b) ? 'checked' : ''}> ${posEsc(b)}</label>`).join('') || '<small>Walang branch na nakalista.</small>'}</div></div>`).join('')}<button type="button" class="btn btn-secondary" onclick="posEdHolder(-1)">➕ Magdagdag ng tao</button></div><label style="font-size:.85rem;"><input type="checkbox" id="pe-access" ${e.access ? 'checked' : ''} onchange="posEdSync()"> Bigyan ng access ang may hawak sa Prime Cost/LST ng mga branch na ito (Area Manager)</label>`;
  arModal(`<h3>${POS.edOrig ? '✏️ I-edit' : '➕ Bagong'} Position</h3>
  <div class="form-group"><label>Pangalan ng position</label><input type="text" id="pe-name" value="${posEsc(e.name)}" style="width:100%;" placeholder="Hal.: President, COO, Area Manager, Cook"></div>
  <div class="form-group"><label>Uri</label><select id="pe-type" onchange="posEdSync();posEdShow()">${Object.keys(POS_TYPE).map(k => `<option value="${k}" ${e.type === k ? 'selected' : ''}>${POS_TYPE[k]}</option>`).join('')}</select></div>
  ${e.type === 'unique' ? `<div class="form-group"><label>I-link sa email ng approver ${adm ? '' : '<small style="color:#b45309;">(Admin lang ang makaka-set nito)</small>'}</label><select id="pe-appr" ${adm ? '' : 'disabled'}>${Object.keys(POS_APPR).map(k => `<option value="${k}" ${e.approver === k ? 'selected' : ''}>${POS_APPR[k]}</option>`).join('')}</select><small style="color:#64748b;">Kapag pumili ng tao, awtomatikong magiging email ng approver na ito (Requests/PO/Loan) — hindi na kailangang i-set nang hiwalay.</small></div>` : ''}
  ${hold}
  <button type="button" class="btn btn-success" onclick="posEditSave()">💾 I-save</button> <button type="button" class="btn btn-secondary" onclick="posOpen()">← Bumalik</button>`);
  const m = document.getElementById('ar-modal'); if (m) m.style.zIndex = '10002';
}
async function posEdHolder(i) {
  posEdSync(); const items = await posBossItems(true); const used = new Set(POS.ed.holders.map(h => h.empId));
  posPickOpen('👤 Pumili ng empleyado', items.filter(x => x.id && !used.has(x.id) || (i >= 0 && POS.ed.holders[i] && POS.ed.holders[i].empId === x.id)), it => { const h = { empId: it.id, name: it.label, email: it.email || '', branches: [] }; if (i >= 0 && POS.ed.holders[i]) h.branches = POS.ed.holders[i].branches || [], POS.ed.holders[i] = h; else POS.ed.holders.push(h); posEdShow(); });
}
async function posEditSave() {
  posEdSync(); const e = POS.ed, o = POS.edOrig; if (!e.name) { alert('Ilagay ang pangalan ng position.'); return; }
  const dup = POS.items.find(x => x.name.toLowerCase() === e.name.toLowerCase() && x.id !== (o ? o.id : '')); if (dup) { alert('May position nang ganyan ang pangalan.'); return; }
  if (!o) e.id = posId(e.name) + '-' + Date.now().toString(36).slice(-3); else e.id = o.id;
  if (e.type === 'branches' && e.access && e.holders.some(h => !(h.branches || []).length)) { alert('Lagyan ng kahit isang branch ang bawat may hawak (o i-uncheck ang access).'); return; }
  const notes = [];
  try {
    if (o) POS.items = POS.items.map(x => x.id === o.id ? e : x); else POS.items.push(e); await posPersist();
    // link sa Employee Management: ang job title ng may hawak ay ang position
    for (const h of e.holders) { if (!h.empId) continue; try { await db.collection('employees').doc(h.empId).update({ role: e.name }); if (typeof hrEmployees !== 'undefined') { const x = hrEmployees.find(z => z.id === h.empId); if (x) x.role = e.name; } } catch (x) { notes.push('Hindi na-update ang Job Title ni ' + h.name); } }
    // email ng approver
    if (e.type === 'unique' && e.approver) { const em = (e.holders[0] || {}).email || ''; if (e.holders[0] && !em) notes.push('Walang email si ' + e.holders[0].name + ' sa Employee profile — hindi nai-set ang approver email.'); else if (!posAdmin()) notes.push('Admin lang ang makaka-set ng approver email — ipa-save ito sa Admin.'); else if (!(await posApproverSync(e.approver, em))) notes.push('Hindi na-set ang approver email (walang pahintulot).'); }
    if (o && o.approver && o.approver !== e.approver && posAdmin() && !(o.holders[0] && e.holders[0] && o.approver === e.approver)) { /* inalis ang link — iniwan ang dating email */ }
    // access sa branch
    const had = o && o.access ? (o.holders || []) : [], now = e.access ? e.holders : [];
    if (posAdmin()) { for (const h of now) if (!(await posUserAccess(h.email, h.branches))) notes.push(h.name + ': walang user account na tugma sa email — hindi nabigyan ng access.'); for (const h of had) if (!now.some(n => n.email && n.email === h.email)) await posUserAccess(h.email, null); } else if (e.access || had.length) notes.push('Admin lang ang makakapagbigay ng access sa branch — ipa-save ito sa Admin.');
    try { await logSystemAction('POSITION', `${o ? 'Binago' : 'Dinagdag'}: ${e.name} (${POS_TYPE[e.type]})${e.holders.length ? ' — ' + e.holders.map(h => h.name).join(', ') : ''}`); } catch (x) {}
  } catch (er) { alert('Hindi na-save: ' + er.message); return; }
  if (notes.length) alert('✅ Na-save ang position.\n\n⚠️ ' + notes.join('\n⚠️ ')); await posOpen();
}
async function posDelete(id) {
  const p = POS.items.find(x => x.id === id); if (!p) return; const used = (typeof hrEmployees !== 'undefined' ? hrEmployees : []).filter(e => String(e.role || '').toLowerCase() === p.name.toLowerCase()).length;
  if (!(await uiConfirm(`Burahin ang position na "${p.name}"?${used ? `\n\n${used} empleyado ang may ganitong Job Title (hindi mababago ang profile nila).` : ''}`))) return;
  try { if (p.access && posAdmin()) for (const h of p.holders || []) await posUserAccess(h.email, null); POS.items = POS.items.filter(x => x.id !== id); await posPersist(); try { await logSystemAction('POSITION', 'Binura: ' + p.name); } catch (x) {} await posOpen(); } catch (e) { alert(e.message); }
}
// Kapag nag-save ng empleyado sa Employee Management: idagdag ang bagong Job Title; kung "Isang tao lang" ang position, siya na ang may hawak
async function posOnEmpSave(emp) {
  const role = String((emp && emp.role) || '').trim(); if (!role) return; await posLoad(true); let p = posFind(role), changed = false;
  if (!p) { p = { id: posId(role) + '-' + Date.now().toString(36).slice(-3), name: role, type: 'general', approver: '', access: false, holders: [] }; POS.items.push(p); changed = true; }
  else if (p.type === 'unique') {
    const cur = (p.holders || [])[0];
    if (!cur || cur.empId !== emp.id) {
      if (cur && !(await uiConfirm(`Ang ${p.name} ngayon ay si ${cur.name}. Palitan ng ${emp.name}?`))) { return; }
      p.holders = [{ empId: emp.id, name: emp.name, email: String(emp.email || '').toLowerCase(), branches: [] }]; changed = true;
      if (p.approver && posAdmin() && p.holders[0].email) await posApproverSync(p.approver, p.holders[0].email);
    } else if (cur.email !== String(emp.email || '').toLowerCase()) { cur.email = String(emp.email || '').toLowerCase(); cur.name = emp.name; changed = true; if (p.approver && posAdmin() && cur.email) await posApproverSync(p.approver, cur.email); }
  } else if (p.type === 'branches') { if (!(p.holders || []).some(h => h.empId === emp.id)) { p.holders = (p.holders || []).concat([{ empId: emp.id, name: emp.name, email: String(emp.email || '').toLowerCase(), branches: [] }]); changed = true; alert(`Naidagdag si ${emp.name} bilang ${p.name}. Pumunta sa Position Management para itakda ang mga branch na hawak niya.`); } }
  if (changed) await posPersist();
}

/* ---------- Employee History (sa loob ng Employee modal) ---------- */
async function posHistRender(empId) {
  const root = document.getElementById('hr-emp-hist-root'); if (!root) return; POS.histEmp = empId || '';
  if (!empId) { root.innerHTML = '<div class="emp-doc-note">💡 I-save muna ang empleyado para makapagdagdag ng history (promotion, contract, evaluation).</div>'; return; }
  root.innerHTML = '<div class="emp-doc-note">Kinukuha ang history…</div>';
  try { POS.hist = (await db.collection('employees').doc(empId).collection('history').get()).docs.map(d => Object.assign({ id: d.id }, d.data())).sort((a, b) => String(b.effective || b.date || '').localeCompare(String(a.effective || a.date || ''))); } catch (e) { root.innerHTML = '<div class="emp-doc-note">Hindi ma-load: ' + posEsc(e.message) + '</div>'; return; }
  root.innerHTML = `<div style="border:1px solid #e2e8f0;border-radius:.5rem;padding:.6rem;"><div style="display:flex;justify-content:space-between;align-items:center;"><b>📜 Employee History</b>${posCan() ? `<button type="button" class="btn btn-success btn-sm" onclick="posHistNew()">➕ Magdagdag</button>` : ''}</div>
  ${POS.hist.length ? POS.hist.map(h => `<div style="border-top:1px solid #f1f5f9;padding:.4rem 0;font-size:.84rem;"><b>${posEsc(h.type)}</b> · ${posEsc(h.effective || h.date || '')}${h.position ? ` · 👔 ${posEsc(h.position)}` : ''}${h.salary ? ` · ₱${Number(h.salary).toLocaleString('en-PH')}` : ''}${h.applied ? ' <span style="color:#16a34a;">(na-apply sa profile)</span>' : ''}<br>${posEsc(h.notes || '')}<br><small style="color:#94a3b8;">${posEsc(h.by || '')} · ${posEsc(String(h.at || '').slice(0, 10))}</small>${h.fileId ? ` <button type="button" class="btn btn-secondary btn-sm" onclick="posHistFile('${posEsc(h.fileId)}')">👁 ${posEsc(h.fileName || 'File')}</button>` : ''}</div>`).join('') : '<p style="color:#94a3b8;font-size:.85rem;">Wala pang history.</p>'}</div>`;
}
function posHistNew() {
  const id = POS.histEmp; if (!id || !posCan()) return; const e = (typeof hrEmployees !== 'undefined' ? hrEmployees : []).find(x => x.id === id) || {};
  arModal(`<h3>➕ History: ${posEsc(e.name || '')}</h3>
  <div class="form-group"><label>Uri</label><select id="ph-type">${POS_TYPES.map(t => `<option>${posEsc(t)}</option>`).join('')}</select></div>
  <div class="form-group"><label>Petsa ng bisa (effective)</label><input type="date" id="ph-eff" value="${new Date().toISOString().slice(0, 10)}"></div>
  <div class="form-group"><label>Bagong Position (kung may pagbabago)</label><input type="text" id="ph-pos" list="hr-positions-dl" placeholder="${posEsc(e.role || '')}" style="width:100%;"></div>
  <div class="form-group"><label>Bagong Base Salary (kung may pagbabago)</label><input type="number" id="ph-sal" min="0" step="0.01" placeholder="${posEsc(e.baseSalary || '')}"></div>
  <div class="form-group"><label><input type="checkbox" id="ph-apply" checked> I-apply ang bagong position/sahod sa Employee profile</label></div>
  <div class="form-group"><label>Notes / dahilan / resulta</label><textarea id="ph-notes" rows="3" style="width:100%;"></textarea></div>
  <div class="form-group"><label>📎 Litrato o PDF (pirmadong contract / evaluation form)</label><input type="file" id="ph-file" accept="image/*,application/pdf"></div>
  <button type="button" class="btn btn-success" onclick="posHistSave()">💾 I-save</button>`); const m = document.getElementById('ar-modal'); if (m) m.style.zIndex = '10002';
}
async function posHistSave() {
  const empId = POS.histEmp, g = id => (document.getElementById(id) || {}).value || '', me = getCurrentUser() || {}; if (!empId || !posCan()) return;
  const e = (typeof hrEmployees !== 'undefined' ? hrEmployees : []).find(x => x.id === empId) || {}; const pos = g('ph-pos').trim(), sal = parseFloat(g('ph-sal')) || 0, apply = !!(document.getElementById('ph-apply') || {}).checked, f = (document.getElementById('ph-file') || {}).files && document.getElementById('ph-file').files[0];
  if (!g('ph-eff')) { alert('Ilagay ang petsa.'); return; } if (!pos && !sal && !g('ph-notes').trim() && !f) { alert('Maglagay ng kahit anong detalye (position, sahod, notes o file).'); return; }
  const rec = { type: g('ph-type'), date: new Date().toISOString().slice(0, 10), effective: g('ph-eff'), position: pos, salary: sal || 0, notes: g('ph-notes').trim(), prevPosition: e.role || '', prevSalary: parseFloat(e.baseSalary) || 0, applied: false, by: me.name || me.email || '', byEmail: me.email || '', at: new Date().toISOString() };
  try {
    if (f) { const r = await reqSaveFile(f, 'emphist:' + empId, 'emp-history'); rec.fileId = r.id; rec.fileName = r.name || f.name; }
    const patch = {}; if (apply && pos) patch.role = pos; if (apply && sal) patch.baseSalary = sal; if (Object.keys(patch).length) { await db.collection('employees').doc(empId).update(patch); Object.assign(e, patch); rec.applied = true; const ri = document.getElementById('hr-emp-role'); if (ri && patch.role) ri.value = patch.role; const si = document.getElementById('hr-emp-salary'); if (si && patch.baseSalary) si.value = patch.baseSalary; }
    await db.collection('employees').doc(empId).collection('history').add(rec);
    try { await logSystemAction('EMP_HISTORY', `${e.name || empId}: ${rec.type}${pos ? ' → ' + pos : ''}${sal ? ' ₱' + sal : ''}`); } catch (x) {}
    arCloseModal(); posHistRender(empId);
  } catch (er) { alert('Hindi na-save: ' + er.message); }
}
async function posHistFile(id) { try { const f = await reqLoadFile(id); if (!f) { alert('Wala na ang file.'); return; } imgOpen(f.dataUrl); } catch (e) { alert(e.message); } }
