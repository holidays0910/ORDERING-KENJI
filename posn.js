/* =====================================================================
   👔 POSITION MANAGEMENT · AREA MANAGER · EMPLOYEE HISTORY
   system_settings/positions {list:[...]}  -> mga pagpipilian sa "Job Title / Position" ng Employee profile (puwede pa ring mag-type ng iba)
   users/{email}.branches[] + areaManager:true -> Area Manager: nakikita/na-e-edit niya ang Prime Cost at LST ng mga branch na iyon (Admin lang ang nagtatakda)
   employees/{id}/history/{hid} {type,date,effective,position,salary,notes,fileId,fileName,applied,by,at}  -> promotion/contract/evaluation, may litrato/PDF
   ===================================================================== */
const POS_TYPES = ['Promotion', 'Contract (bago/renewal)', 'Evaluation', 'Transfer', 'Salary adjustment', 'Memo / Disciplinary', 'Iba pa'];
let POS = { list: [], loaded: false, hist: [], histEmp: '' };
function posEsc(s) { return typeof srchEsc === 'function' ? srchEsc(s) : String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function posCan() { const u = getCurrentUser() || {}; return normalizeRole(u.role) === 'admin' || (typeof canEditModule === 'function' && canEditModule('employees')); }
function posAdmin() { const u = getCurrentUser() || {}; return normalizeRole(u.role) === 'admin'; }
function posParse(t) { return [...new Set(String(t || '').split(/\n+/).map(x => x.trim()).filter(Boolean))]; }
async function posLoad() { if (POS.loaded || !db) return; try { const d = await db.collection('system_settings').doc('positions').get(); POS.list = d.exists ? (d.data().list || []) : []; } catch (e) {} POS.loaded = true; }
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
  const items = POS.list.map(p => ({ label: p })); posPickOpen('👔 Job Title / Position', items, it => { document.getElementById('hr-emp-role').value = it.label; }, true);
}
async function posBossItems() {
  let emps = typeof hrEmployees !== 'undefined' ? hrEmployees : []; if (!emps.length && db) { try { emps = (await db.collection('employees').get()).docs.map(d => Object.assign({ id: d.id }, d.data())); } catch (e) {} }
  const me = (document.getElementById('hr-emp-id') || {}).value || '';
  return emps.filter(e => e.id !== me && (e.status || 'Active') === 'Active').sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''))).map(e => ({ label: e.name || '', sub: [e.role, e.branch, e.empId].filter(Boolean).join(' · '), id: e.id, email: String(e.email || '').toLowerCase() }));
}
async function posPickBoss() {
  const items = await posBossItems(); items.unshift({ label: '— Walang reporting officer —', clear: true });
  posPickOpen('👤 Reporting Officer / Head', items, it => { const t = document.getElementById('hr-emp-reportingto'), a = document.getElementById('hr-emp-reportingto-id'), b = document.getElementById('hr-emp-reportingto-email'); if (it.clear) { t.value = ''; if (a) a.value = ''; if (b) b.value = ''; return; } t.value = it.label; if (a) a.value = it.id || ''; if (b) b.value = it.email || ''; });
}
// Kapag nag-save ng empleyado, idagdag sa listahan ng Position ang bagong title
async function posRemember(role) {
  role = String(role || '').trim(); if (!role) return; await posLoad(); if (POS.list.some(x => x.toLowerCase() === role.toLowerCase())) return;
  POS.list.push(role); POS.list.sort((a, b) => a.localeCompare(b)); await db.collection('system_settings').doc('positions').set({ list: POS.list, updatedBy: (getCurrentUser() || {}).email || '', updatedAt: new Date().toISOString() }, { merge: true });
}
/* ---------- Positions + Area Managers (modal) ---------- */
async function posOpen(tab) {
  if (!posAdmin() && !posCan()) { alert('HR/Admin lang.'); return; } await posLoad(); tab = tab || 'pos';
  const nav = `<div style="display:flex;gap:.4rem;margin-bottom:.6rem;"><button class="btn ${tab === 'pos' ? 'btn-primary' : 'btn-secondary'}" onclick="posOpen('pos')">👔 Mga Position</button><button class="btn ${tab === 'am' ? 'btn-primary' : 'btn-secondary'}" onclick="posOpen('am')">🗺️ Area Managers</button></div>`;
  if (tab === 'pos') return arModal(`<h3>👔 Position Management</h3>${nav}<p style="font-size:.82rem;color:#64748b;">Isang position bawat linya. Lalabas ang mga ito bilang pagpipilian sa Job Title ng empleyado.</p><textarea id="pos-text" rows="12" style="width:100%;">${posEsc(POS.list.join('\n'))}</textarea><br><button class="btn btn-success" onclick="posSave()">💾 I-save</button>`);
  if (!posAdmin()) return arModal(`<h3>🗺️ Area Managers</h3>${nav}<p>Admin lang ang makakapagtakda nito.</p>`);
  let users = [], brs = []; try { users = (await db.collection('users').get()).docs.map(d => Object.assign({ email: d.id }, d.data())).filter(u => (u.status || '') === 'active'); brs = (await db.collection('inventory_branches').get()).docs.map(d => d.data().branch || d.data().code).filter(Boolean); } catch (e) { alert(e.message); return; }
  brs = [...new Set(brs)].sort(); POS.users = users; POS.brs = brs; const ams = users.filter(u => u.areaManager);
  arModal(`<h3>🗺️ Area Managers</h3>${nav}<p style="font-size:.82rem;color:#64748b;">Ang Area Manager ay may hawak na ilang branch; ang Prime Cost at LST ng mga branch na iyon ang makikita at mae-edit niya, bukod sa sarili niyang branch. Kailangan niyang mag-login ulit para tumalab.</p>
  ${ams.map(u => `<div style="border:1px solid #e2e8f0;border-radius:.4rem;padding:.4rem;margin-bottom:.4rem;font-size:.85rem;"><b>${posEsc(u.name || u.email)}</b> <small>${posEsc(u.email)}</small><br>${(u.branches || []).map(posEsc).join(', ') || '—'}<br><button class="btn btn-secondary btn-sm" onclick="posAmEdit('${posEsc(u.email)}')">✏️ Baguhin</button> <button class="btn btn-secondary btn-sm" onclick="posAmRemove('${posEsc(u.email)}')">✖ Alisin</button></div>`).join('') || '<p style="color:#94a3b8;">Wala pang Area Manager.</p>'}
  <div class="form-group"><label>Magdagdag</label><select id="pos-am-user" onchange="posAmEdit(this.value)"><option value="">— pumili ng user —</option>${users.filter(u => !u.areaManager).map(u => `<option value="${posEsc(u.email)}">${posEsc(u.name || u.email)} (${posEsc(u.email)})</option>`).join('')}</select></div><div id="pos-am-form"></div>`);
}
function posAmEdit(email) {
  const u = (POS.users || []).find(x => x.email === email), box = document.getElementById('pos-am-form'); if (!u || !box) return; const cur = (u.branches || []).map(x => String(x).toLowerCase());
  box.innerHTML = `<div style="border:1px solid #93c5fd;border-radius:.4rem;padding:.5rem;"><b>${posEsc(u.name || u.email)}</b><div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:.2rem;margin:.4rem 0;">${POS.brs.map(b => `<label style="font-size:.82rem;"><input type="checkbox" class="pos-am-br" value="${posEsc(b)}" ${cur.includes(b.toLowerCase()) ? 'checked' : ''}> ${posEsc(b)}</label>`).join('')}</div><button class="btn btn-success" onclick="posAmSave('${posEsc(email)}')">💾 I-save</button></div>`; box.scrollIntoView({ block: 'nearest' });
}
async function posAmSave(email) {
  const br = [...document.querySelectorAll('.pos-am-br:checked')].map(i => i.value); if (!br.length) { alert('Pumili ng kahit isang branch.'); return; }
  try { await db.collection('users').doc(email).update({ branches: br, areaManager: true }); try { await logSystemAction('AREA_MANAGER', `${email}: ${br.join(', ')}`); } catch (e) {} alert('✅ Na-save. Mag-login ulit ang user para tumalab.'); posOpen('am'); } catch (e) { alert(e.message); }
}
async function posAmRemove(email) {
  if (!(await uiConfirm('Alisin ang pagiging Area Manager?'))) return; const D = firebase.firestore.FieldValue.delete();
  try { await db.collection('users').doc(email).update({ branches: D, areaManager: D }); try { await logSystemAction('AREA_MANAGER', `${email}: inalis`); } catch (e) {} posOpen('am'); } catch (e) { alert(e.message); }
}
async function posSave() {
  if (!posCan()) return; const l = posParse(document.getElementById('pos-text').value);
  try { await db.collection('system_settings').doc('positions').set({ list: l, updatedBy: (getCurrentUser() || {}).email || '', updatedAt: new Date().toISOString() }); POS.list = l; posAttach(); try { await logSystemAction('POSITIONS', `${l.length} position`); } catch (e) {} alert('✅ Na-save.'); arCloseModal(); } catch (e) { alert(e.message); }
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
