// ===== KusinaERP — 🛡️ Security & Access Center (Admin) =====
// Ang runtime (lockout, gate, alerts, 4-eyes, idle) ay nasa app.js. Ito ang Admin screen.
const SECUI = { tab: 'health', users: [], busy: false };
const SEC_TABS = [['health', '🩺 Health'], ['logins', '🔐 Login History'], ['lock', '🚫 Lockout'], ['access', '⏰ Oras / Idle'], ['groups', '👥 Groups'], ['temp', '⏳ Temp Access'], ['review', '📋 Access Review'], ['off', '🚪 Offboarding'], ['appr', '✅ 4-Eyes'], ['alerts', '🚨 Alerts'], ['ret', '🧹 Retention'], ['mnt', '🛠️ Maintenance']];
const secE = v => srchEsc(v == null ? '' : String(v));
const secRoot = () => document.getElementById('security-root');
const secFmt = ms => ms ? new Date(ms).toLocaleString('en-PH') : '—';
const secDays = n => Date.now() - n * 86400000;

async function loadSecurity() {
  const r = secRoot(); if (!r) return;
  r.innerHTML = '<div class="card">⏳ Naglo-load...</div>';
  try { await superAdminLoad(); await secPolicy(true); const s = await db.collection('users').get(); SECUI.users = s.docs.map(d => Object.assign({ id: d.id }, d.data())); } catch (e) { r.innerHTML = '<div class="card" style="color:#dc2626;">Error: ' + secE(e.message) + '</div>'; return; }
  secPaint();
}
function secPaint() {
  const r = secRoot(); if (!r) return;
  r.innerHTML = `<div class="card"><div class="card-title"><span>🛡️ Security & Access Center</span></div>
    ${superAdminIsMe() ? '' : '<div style="background:#fef3c7;padding:.5rem;border-radius:.4rem;font-size:.85rem;margin-bottom:.5rem;">Super Admin lang ang makakapag-save ng Policy at Maintenance. Puwede mo itong tingnan.</div>'}
    <div style="display:flex;flex-wrap:wrap;gap:.3rem;margin-bottom:.8rem;">${SEC_TABS.map(t => `<button class="btn ${t[0] === SECUI.tab ? 'btn-primary' : 'btn-secondary'} btn-sm" onclick="secTab('${t[0]}')">${t[1]}</button>`).join('')}</div>
    <div id="sec-body">⏳</div></div>`;
  secBody();
}
function secTab(t) { SECUI.tab = t; secPaint(); }
async function secBody() {
  const b = document.getElementById('sec-body'); if (!b) return;
  const fn = { health: secHealth, logins: secLogins, lock: secLock, access: secAccess, groups: secGroups, temp: secTemp, review: secReview, off: secOff, appr: secAppr, alerts: secAlerts, ret: secRet, mnt: secMnt }[SECUI.tab];
  const HT = { health: 'Buod ng kalagayan ng seguridad: ilan ang naka-lock, may alert, at kung gaano na katagal ang huling backup/sweep.', logins: 'Talaan ng mga login (sino, kailan, device, tagumpay o bigo). Gamitin para tingnan kung may kahina-hinalang pag-login.', lock: 'Ilang maling password bago ma-lock ang account at gaano katagal. I-unlock dito ang naka-lock na user.', access: 'Oras ng pag-login at idle timeout. Ang idle timeout ay awtomatikong nagla-log out kapag walang galaw ang user.', groups: 'Gumawa ng grupo (hal. Cashier, Accounting) na may nakatakdang access, para hindi isa-isahin ang bawat user.', temp: 'Pansamantalang access na kusang mawawala sa petsang itinakda. Piliin ang user, module, at hanggang kailan.', review: 'Pana-panahong pagsusuri kung sino ang may anong access. Alisin ang hindi na kailangan.', off: 'Checklist kapag aalis ang empleyado: i-disable ang account at tanggalin ang access.', appr: 'Ang mahahalagang pagbabago ay kailangang aprubahan ng ikalawang tao (4-eyes) bago tumuloy.', alerts: 'Mga babala ng sistema (sunod-sunod na bigong login, bagong device, atbp.). I-mark na nabasa kapag naasikaso na.', ret: 'Gaano katagal itatago ang mga log bago kusang burahin, para hindi lumaki ang database.', mnt: 'Maintenance mode: pansamantalang isara ang sistema sa lahat maliban sa Super Admin habang may update.' };
  try { b.innerHTML = '<div style="font-size:.78rem;color:#475569;background:#f1f5f9;border-left:3px solid #38bdf8;padding:.3rem .5rem;margin-bottom:.6rem;border-radius:.25rem;">📖 ' + secE(HT[SECUI.tab] || '') + '</div>' + await fn(); } catch (e) { b.innerHTML = '<div style="color:#dc2626;">Error: ' + secE(e.message) + '</div>'; }
}
async function secSavePolicy(patch, label) {
  if (!superAdminIsMe()) { alert('Super Admin lang ang makakapag-save nito.'); return false; }
  try { await db.collection('system_settings').doc('security_policy').set(patch, { merge: true }); await secPolicy(true); try { await logSystemAction('SEC_POLICY_CHANGED', label); } catch (e) {} return true; } catch (e) { alert('Error: ' + e.message); return false; }
}
const secRoleOf = u => normalizeRole(u.role);
const secActive = () => SECUI.users.filter(u => String(u.status || '').toLowerCase() === 'active');

// ---------- 10. Health ----------
async function secHealth() {
  const t0 = Date.now(); let lat = 0; try { await db.collection('system_settings').doc('security_policy').get(); lat = Date.now() - t0; } catch (e) { lat = -1; }
  const U = SECUI.users, st = {}; U.forEach(u => { const s = String(u.status || 'pending').toLowerCase(); st[s] = (st[s] || 0) + 1; });
  const cnt = async (c, f, v) => { try { const s = await db.collection(c).where(f, '>', v).get(); return s.size; } catch (e) { return '?'; } };
  const fails = await cnt('login_history', 'atMs', secDays(1)).then(async () => { try { const s = await db.collection('login_history').where('atMs', '>', secDays(1)).get(); return s.docs.filter(d => d.data().result === 'fail').length; } catch (e) { return '?'; } });
  const errs = await cnt('sec_errors', 'atMs', secDays(1)), alerts = await cnt('sec_alerts', 'atMs', secDays(7));
  let lastBk = '—'; try { const s = await db.collection('db_backups').orderBy('createdAt', 'desc').limit(1).get(); if (!s.empty) { const d = s.docs[0].data(); lastBk = new Date(d.createdAt).toLocaleString('en-PH'); } } catch (e) {}
  let online = '?'; try { const s = await db.collection('presence').get(); online = s.docs.filter(d => { const x = d.data(); const t = x.lastSeen && x.lastSeen.toMillis ? x.lastSeen.toMillis() : 0; return Date.now() - t < 600000; }).length; } catch (e) {}
  const tile = (k, v, w) => `<div style="border:1px solid ${w ? '#fca5a5' : '#e2e8f0'};border-radius:.5rem;padding:.6rem;background:${w ? '#fef2f2' : '#f8fafc'};"><div style="font-size:.75rem;color:#64748b;">${k}</div><div style="font-size:1.3rem;font-weight:700;">${v}</div></div>`;
  const pend = st.pending || 0;
  return `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:.6rem;">
    ${tile('Database response', lat < 0 ? 'Error' : lat + ' ms', lat < 0 || lat > 2500)}${tile('Active accounts', st.active || 0)}${tile('Pending approval', pend, pend > 0)}${tile('Disabled', st.disabled || 0)}
    ${tile('Online (huling 10 min)', online)}${tile('Failed logins (24h)', fails, fails > 10)}${tile('Browser errors (24h)', errs, errs > 5)}${tile('Security alerts (7d)', alerts, alerts > 0)}
    ${tile('Huling cloud backup', lastBk, lastBk === '—')}</div>
    <p style="font-size:.8rem;color:#64748b;margin-top:.6rem;">Ang mga numero ay kinukuha sa oras na binuksan ang tab. Walang server, kaya walang 24/7 na pagsubaybay.</p>
    <div style="margin-top:.5rem;"><b>Pinakahuling errors</b><div id="sec-errs">${await secErrList()}</div></div>`;
}
async function secErrList() {
  try { const s = await db.collection('sec_errors').orderBy('atMs', 'desc').limit(10).get(); if (s.empty) return '<small>Walang naitalang error. 👍</small>'; return '<table class="table" style="font-size:.8rem;"><tr><th>Kailan</th><th>User</th><th>Page</th><th>Mensahe</th></tr>' + s.docs.map(d => { const x = d.data(); return `<tr><td>${secFmt(x.atMs)}</td><td>${secE(x.by)}</td><td>${secE(x.page)}</td><td>${secE(x.msg)} <small>${secE(x.file)}:${x.line || 0}</small></td></tr>`; }).join('') + '</table>'; } catch (e) { return '<small>Hindi mabasa.</small>'; }
}

// ---------- 6. Login history ----------
async function secLogins() {
  const s = await db.collection('login_history').orderBy('atMs', 'desc').limit(200).get(); const L = s.docs.map(d => d.data());
  const f = (document.getElementById('sec-lf') || {}).value || '';
  return `<div style="display:flex;gap:.4rem;margin-bottom:.5rem;"><input id="sec-lf" placeholder="Hanapin email..." value="${secE(f)}" oninput="secLoginFilter()" style="flex:1;"><button class="btn btn-secondary btn-sm" onclick="secBody()">🔄</button></div>
  <div style="max-height:480px;overflow:auto;"><table class="table" id="sec-lt" style="font-size:.82rem;"><tr><th>Kailan</th><th>Email</th><th>Resulta</th><th>Dahilan</th><th>Device</th></tr>
  ${L.map(x => `<tr data-e="${secE(x.email)}"><td>${secFmt(x.atMs)}</td><td>${secE(x.email)}</td><td>${x.result === 'ok' ? '✅ OK' : '❌ Fail'}</td><td>${secE(x.reason)}</td><td><small>${secE((x.ua || '').slice(0, 60))}</small></td></tr>`).join('')}</table></div>
  <small style="color:#64748b;">Huling 200 na login. Naka-log lang ang mga login na dumaan sa login page.</small>`;
}
function secLoginFilter() { const q = document.getElementById('sec-lf').value.toLowerCase(); document.querySelectorAll('#sec-lt tr[data-e]').forEach(r => { r.style.display = r.dataset.e.includes(q) ? '' : 'none'; }); }

// ---------- 5. Lockout + forced password ----------
async function secLock() {
  const lp = await secLoginPolicy(); const s = await db.collection('login_attempts').where('lockedUntil', '>', Date.now()).get(); const locked = s.docs.map(d => d.data());
  const must = SECUI.users.filter(u => u.mustChangePw);
  return `<div class="form-group"><label><input type="checkbox" id="sl-en" ${lp.enabled ? 'checked' : ''}> I-lock ang account kapag sunod-sunod ang maling password</label></div>
  <div style="display:flex;gap:.6rem;flex-wrap:wrap;"><div class="form-group"><label>Ilang beses mali</label><input type="number" id="sl-max" min="3" max="20" value="${lp.maxFails}" style="width:90px;"></div><div class="form-group"><label>Minuto ng lock</label><input type="number" id="sl-min" min="1" max="1440" value="${lp.lockMin}" style="width:90px;"></div></div>
  <button class="btn btn-success btn-sm" onclick="secLockSave()">💾 I-save</button>
  <h4 style="margin-top:1rem;">Naka-lock ngayon</h4>${locked.length ? '<table class="table"><tr><th>Email</th><th>Hanggang</th><th></th></tr>' + locked.map(x => `<tr><td>${secE(x.email)}</td><td>${secFmt(x.lockedUntil)}</td><td><button class="btn btn-secondary btn-sm" onclick="secUnlock('${secE(x.email)}')">🔓 I-unlock</button></td></tr>`).join('') + '</table>' : '<small>Wala. 👍</small>'}
  <h4 style="margin-top:1rem;">Pilitin magpalit ng password</h4>
  <div style="display:flex;gap:.4rem;flex-wrap:wrap;"><select id="sl-user" style="min-width:220px;">${secActive().map(u => `<option value="${secE(u.id)}">${secE(u.name || u.id)} — ${secE(u.id)}</option>`).join('')}</select><button class="btn btn-warning btn-sm" onclick="secMustPw(false)">🔑 Sa napiling user</button><button class="btn btn-danger btn-sm" onclick="secMustPw(true)">🔑 Sa LAHAT (maliban Admin)</button></div>
  <small style="color:#64748b;">Sa susunod na login ay hihingan sila ng bagong password. Naghihintay ngayon: <b>${must.length}</b></small>
  <p style="font-size:.78rem;color:#64748b;">Paalala: ang lock ay nasa browser/login page. Hindi nito napipigilan ang taong direktang gumagamit ng Firebase API.</p>`;
}
async function secLockSave() { const ok = await db.collection('login_policy').doc('main').set({ enabled: document.getElementById('sl-en').checked, maxFails: Math.max(3, +document.getElementById('sl-max').value || 5), lockMin: Math.max(1, +document.getElementById('sl-min').value || 15) }).then(() => true).catch(e => { alert('Error: ' + e.message); return false; }); if (ok) { try { await logSystemAction('SEC_POLICY_CHANGED', 'Lockout policy'); } catch (e) {} alert('✅ Na-save.'); } }
async function secUnlock(e) { await secSuccessReset(e); try { await logSystemAction('SEC_POLICY_CHANGED', 'Unlock ' + e); } catch (x) {} secBody(); }
async function secMustPw(all) {
  const t = all ? SECUI.users.filter(u => String(u.status).toLowerCase() === 'active' && secRoleOf(u) !== 'admin') : [SECUI.users.find(u => u.id === document.getElementById('sl-user').value)].filter(Boolean);
  if (!t.length) return; if (!await uiConfirm(`Pipilitin magpalit ng password ang ${t.length} user sa susunod nilang login. Ituloy?`)) return;
  try { for (const u of t) await db.collection('users').doc(u.id).update({ mustChangePw: true }); t.forEach(u => u.mustChangePw = true); try { await logSystemAction('SEC_POLICY_CHANGED', 'Forced password change: ' + t.length + ' user'); } catch (e) {} alert('✅ Tapos.'); secBody(); } catch (e) { alert('Error: ' + e.message); }
}

// ---------- 7, 8. Oras / IP / Idle ----------
async function secAccess() {
  const p = SEC.pol, R = ['commissary', 'branch', 'employee'];
  return `<h4>⏰ Allowed login hours</h4><label><input type="checkbox" id="sa-h" ${p.hours.enabled ? 'checked' : ''}> Gamitin</label>
  <table class="table" style="max-width:520px;"><tr><th>Role</th><th>Mula</th><th>Hanggang</th></tr>${R.map(r => { const w = p.hours.roles[r] || {}; return `<tr><td>${r}</td><td><input type="time" id="sa-f-${r}" value="${secE(w.from || '05:00')}"></td><td><input type="time" id="sa-t-${r}" value="${secE(w.to || '23:59')}"></td></tr>`; }).join('')}</table>
  <small>Ang Admin ay hindi sakop. Kapag lampas na sa oras habang naka-login, ila-logout sila.</small>
  <h4 style="margin-top:1rem;">⏱️ Idle timeout (minuto; 0 = wala)</h4>
  <div style="display:flex;gap:.6rem;flex-wrap:wrap;">${['admin', 'commissary', 'branch', 'employee'].map(r => `<div class="form-group"><label>${r}</label><input type="number" min="0" max="1440" id="sa-i-${r}" value="${+p.idle[r] || 0}" style="width:90px;"></div>`).join('')}</div>
  <button class="btn btn-success" onclick="secAccessSave()">💾 I-save</button>
  <p style="font-size:.78rem;color:#64748b;">Lahat ng ito ay ipinapatupad ng browser/app (walang server), kaya panangga ito sa karaniwang gumagamit, hindi sa taong marunong mag-bypass.</p>`;
}
async function secAccessSave() {
  const R = ['commissary', 'branch', 'employee'], hours = { enabled: document.getElementById('sa-h').checked, roles: {} };
  R.forEach(r => { hours.roles[r] = { from: document.getElementById('sa-f-' + r).value || '05:00', to: document.getElementById('sa-t-' + r).value || '23:59' }; });
  const idle = {}; ['admin', 'commissary', 'branch', 'employee'].forEach(r => { idle[r] = Math.max(0, +document.getElementById('sa-i-' + r).value || 0); });
  if (await secSavePolicy({ hours, idle, ip: { enabled: false } }, 'Oras/Idle')) alert('✅ Na-save.');
}

// ---------- 1. Groups / OU ----------
async function secGroupsLoad() { const s = await db.collection('system_settings').doc('sec_groups').get(); return s.exists ? (s.data().list || []) : []; }
async function secGroups() {
  const G = await secGroupsLoad(); SECUI.groups = G;
  return `<p style="font-size:.85rem;color:#64748b;">Ang Group ay pangkat ng mga user na may parehong access (hal. "Accounting Team"). Gumawa ng group, ilagay ang mga miyembro, at i-apply ang access nang isahan.</p>
  <button class="btn btn-primary btn-sm" onclick="secGroupEdit(-1)">➕ Bagong Group</button>
  <table class="table" style="margin-top:.5rem;"><tr><th>Group</th><th>Miyembro</th><th>Access</th><th></th></tr>${G.length ? G.map((g, i) => `<tr><td><b>${secE(g.name)}</b><br><small>${secE(g.desc || '')}</small></td><td>${(g.members || []).length}</td><td>${Object.keys(g.perms || {}).length} module</td><td><button class="btn btn-secondary btn-sm" onclick="secGroupEdit(${i})">✏️</button> <button class="btn btn-success btn-sm" onclick="secGroupApply(${i})">⚡ I-apply</button> <button class="btn btn-danger btn-sm" onclick="secGroupDel(${i})">🗑️</button></td></tr>`).join('') : '<tr><td colspan="4"><small>Wala pang group.</small></td></tr>'}</table>`;
}
function secModChecks(sel, pfx) {
  return `<div style="max-height:220px;overflow:auto;border:1px solid #e2e8f0;padding:.4rem;border-radius:.4rem;">${ACCESS_MODULES.map(m => `<div style="display:flex;gap:.4rem;align-items:center;margin-bottom:.15rem;"><span style="flex:1;font-size:.82rem;">${secE(m.label)}</span><select id="${pfx}-${m.key}" style="font-size:.8rem;"><option value="">—</option><option value="view" ${sel[m.key] === 'view' ? 'selected' : ''}>view</option><option value="edit" ${sel[m.key] === 'edit' ? 'selected' : ''}>edit</option></select></div>`).join('')}</div>`;
}
function secModRead(pfx) { const o = {}; ACCESS_MODULES.forEach(m => { const v = document.getElementById(pfx + '-' + m.key).value; if (v) o[m.key] = v; }); return o; }
function secGroupEdit(i) {
  const g = i >= 0 ? SECUI.groups[i] : { name: '', desc: '', members: [], perms: {} }; SECUI.gi = i;
  const o = document.createElement('div'); o.id = 'sec-gm'; o.style.cssText = 'position:fixed;inset:0;background:rgba(15,23,42,.6);z-index:9999;display:flex;align-items:center;justify-content:center;padding:1rem;';
  o.innerHTML = `<div style="background:#fff;border-radius:.7rem;padding:1rem;max-width:560px;width:100%;max-height:90vh;overflow:auto;"><h3 style="margin-top:0;">${i >= 0 ? 'I-edit' : 'Bagong'} Group</h3>
  <input id="sg-name" placeholder="Pangalan ng group" value="${secE(g.name)}" style="width:100%;margin-bottom:.4rem;"><input id="sg-desc" placeholder="Paglalarawan" value="${secE(g.desc || '')}" style="width:100%;margin-bottom:.4rem;">
  <b>Miyembro</b><div style="max-height:150px;overflow:auto;border:1px solid #e2e8f0;padding:.4rem;border-radius:.4rem;margin-bottom:.4rem;">${secActive().filter(u => secRoleOf(u) !== 'admin').map(u => `<label style="display:block;font-size:.82rem;"><input type="checkbox" class="sg-mem" value="${secE(u.id)}" ${(g.members || []).includes(u.id) ? 'checked' : ''}> ${secE(u.name || u.id)} <small>(${secE(u.id)})</small></label>`).join('')}</div>
  <b>Access ng group</b>${secModChecks(g.perms || {}, 'sgp')}
  <div style="margin-top:.6rem;"><button class="btn btn-success" onclick="secGroupSave()">💾 I-save</button> <button class="btn btn-secondary" onclick="document.getElementById('sec-gm').remove()">Isara</button></div></div>`;
  document.body.appendChild(o);
}
async function secGroupSave() {
  const name = document.getElementById('sg-name').value.trim(); if (!name) { alert('Lagyan ng pangalan.'); return; }
  const G = await secGroupsLoad(); const g = { name, desc: document.getElementById('sg-desc').value.trim(), members: [...document.querySelectorAll('.sg-mem:checked')].map(x => x.value), perms: secModRead('sgp') };
  if (SECUI.gi >= 0) G[SECUI.gi] = g; else G.push(g);
  try { await db.collection('system_settings').doc('sec_groups').set({ list: G, updatedAt: new Date().toISOString() }); try { await logSystemAction('SEC_POLICY_CHANGED', 'Group saved: ' + name); } catch (e) {} document.getElementById('sec-gm').remove(); secBody(); } catch (e) { alert('Error: ' + e.message); }
}
async function secGroupDel(i) { const G = await secGroupsLoad(); if (!await uiConfirm(`Burahin ang group na "${G[i].name}"? (Hindi nito binabawi ang access na na-apply na.)`)) return; G.splice(i, 1); await db.collection('system_settings').doc('sec_groups').set({ list: G }); secBody(); }
async function secGroupApply(i) {
  const G = await secGroupsLoad(), g = G[i]; if (!g.members.length) { alert('Walang miyembro.'); return; }
  if (!await uiConfirm(`I-apply ang access ng "${g.name}" sa ${g.members.length} miyembro? Papalitan nito ang kanilang per-user permissions sa mga module ng group (ang ibang module ay mananatili).`)) return;
  try { for (const e of g.members) { const u = SECUI.users.find(x => x.id === e) || {}; const perms = Object.assign({}, u.permissions || {}, g.perms); await db.collection('users').doc(e).update({ permissions: perms }); u.permissions = perms; } try { await logSystemAction('ACCESS_ROLES_UPDATED', `Group "${g.name}" na-apply sa ${g.members.length} user`); } catch (x) {} alert('✅ Na-apply.'); } catch (e) { alert('Error: ' + e.message); }
}

// ---------- 3. Temporary access ----------
async function secTemp() {
  const now = Date.now(), T = SECUI.users.filter(u => u.tempUntil && u.tempPerms);
  return `<p style="font-size:.85rem;color:#64748b;">Magbigay ng access na awtomatikong mawawala sa itinakdang oras (hal. kapalit habang naka-leave).</p>
  <div class="form-group"><label>User</label><select id="st-user" style="min-width:240px;">${secActive().filter(u => secRoleOf(u) !== 'admin').map(u => `<option value="${secE(u.id)}">${secE(u.name || u.id)} — ${secE(u.id)}</option>`).join('')}</select></div>
  <div class="form-group"><label>Hanggang kailan</label><input type="datetime-local" id="st-until"></div>
  ${secModChecks({}, 'stp')}
  <button class="btn btn-success btn-sm" style="margin-top:.5rem;" onclick="secTempGrant()">⏳ Ibigay</button>
  <h4 style="margin-top:1rem;">Mga temporary access</h4>${T.length ? '<table class="table"><tr><th>User</th><th>Access</th><th>Hanggang</th><th></th></tr>' + T.map(u => `<tr><td>${secE(u.id)}</td><td><small>${Object.entries(u.tempPerms).map(([k, v]) => secE(k) + ':' + secE(v)).join(', ')}</small></td><td>${secFmt(u.tempUntil)} ${u.tempUntil < now ? '<b style="color:#dc2626;">(tapos na)</b>' : ''}</td><td><button class="btn btn-danger btn-sm" onclick="secTempRevoke('${secE(u.id)}')">Bawiin</button></td></tr>`).join('') + '</table>' : '<small>Wala.</small>'}`;
}
async function secTempGrant() {
  const e = document.getElementById('st-user').value, until = new Date(document.getElementById('st-until').value).getTime(), p = secModRead('stp');
  if (!e || isNaN(until) || until <= Date.now()) { alert('Pumili ng user at petsa/oras sa hinaharap.'); return; } if (!Object.keys(p).length) { alert('Pumili ng kahit isang module.'); return; }
  try { await db.collection('users').doc(e).update({ tempPerms: p, tempUntil: until, tempBy: String((getCurrentUser() || {}).email || '') }); const u = SECUI.users.find(x => x.id === e); u.tempPerms = p; u.tempUntil = until; try { await logSystemAction('TEMP_ACCESS_GRANTED', `${e} hanggang ${new Date(until).toLocaleString('en-PH')}: ${Object.keys(p).join(', ')}`); } catch (x) {} alert('✅ Naibigay. Kailangan lang mag-refresh/mag-login ulit ng user.'); secBody(); } catch (er) { alert('Error: ' + er.message); }
}
async function secTempRevoke(e) { try { const FV = firebase.firestore.FieldValue; await db.collection('users').doc(e).update({ tempPerms: FV.delete(), tempUntil: FV.delete(), tempBy: FV.delete() }); const u = SECUI.users.find(x => x.id === e); delete u.tempPerms; delete u.tempUntil; try { await logSystemAction('TEMP_ACCESS_GRANTED', 'Binawi: ' + e); } catch (x) {} secBody(); } catch (er) { alert('Error: ' + er.message); } }

// ---------- 2. Access review ----------
async function secReviewDoc() { const s = await db.collection('system_settings').doc('access_reviews').get(); return s.exists ? s.data() : {}; }
async function secReview() {
  const D = await secReviewDoc(), ym = new Date().toISOString().slice(0, 7); let last = {}; try { const s = await db.collection('login_history').where('atMs', '>', secDays(60)).get(); s.forEach(d => { const x = d.data(); if (x.result === 'ok' && (!last[x.email] || x.atMs > last[x.email])) last[x.email] = x.atMs; }); } catch (e) {}
  const act = secActive().filter(u => secRoleOf(u) !== 'admin'); const done = D.month === ym;
  return `<div style="background:${done ? '#ecfdf5' : '#fef3c7'};padding:.5rem;border-radius:.4rem;margin-bottom:.6rem;">${done ? '✅ Tapos na ang review ngayong buwan (' + secE(D.at ? new Date(D.at).toLocaleDateString('en-PH') : '') + ' ni ' + secE(D.by) + ').' : '📋 Hindi pa nare-review ang access ngayong buwan (' + ym + ').'}</div>
  <table class="table" style="font-size:.82rem;"><tr><th>User</th><th>Role</th><th>Per-user access</th><th>Huling login (60 araw)</th><th>Aksyon</th></tr>${act.map(u => { const l = last[u.id]; const days = l ? Math.floor((Date.now() - l) / 86400000) : null; return `<tr><td>${secE(u.name || u.id)}<br><small>${secE(u.id)}</small></td><td>${secE(u.customRoleName || secRoleOf(u))}</td><td>${Object.keys(u.permissions || {}).length} module</td><td>${l ? secFmt(l) + ' <small>(' + days + ' araw na)</small>' : '<b style="color:#dc2626;">Walang login</b>'}</td><td><button class="btn btn-danger btn-sm" onclick="secRevokeAll('${secE(u.id)}')">Alisin ang per-user access</button></td></tr>`; }).join('')}</table>
  <button class="btn btn-success" style="margin-top:.5rem;" onclick="secReviewDone()">✅ Markahan na tapos ang review</button>`;
}
async function secRevokeAll(e) { if (!await uiConfirm('Aalisin ang lahat ng per-user permissions ni ' + e + '? (Role defaults na lang ang matitira.)')) return; try { await db.collection('users').doc(e).update({ permissions: {} }); const u = SECUI.users.find(x => x.id === e); u.permissions = {}; try { await logSystemAction('ACCESS_ROLES_UPDATED', 'Access review: inalis ang per-user access ni ' + e); } catch (x) {} secBody(); } catch (er) { alert('Error: ' + er.message); } }
async function secReviewDone() { try { await db.collection('system_settings').doc('access_reviews').set({ month: new Date().toISOString().slice(0, 7), at: Date.now(), by: String((getCurrentUser() || {}).email || '') }); alert('✅ Naitala.'); secBody(); } catch (e) { alert('Error: ' + e.message); } }

// ---------- 4. Offboarding ----------
async function secOff() {
  const gone = SECUI.users.filter(u => u.offboardedAt);
  return `<p style="font-size:.85rem;color:#64748b;">Para sa umaalis na empleyado. Isang pindot: i-disable ang account, i-logout kahit saan, alisin ang access at temp access, at alisin sa mga group.</p>
  <div style="display:flex;gap:.4rem;flex-wrap:wrap;"><select id="so-user" style="min-width:240px;">${secActive().filter(u => secRoleOf(u) !== 'admin').map(u => `<option value="${secE(u.id)}">${secE(u.name || u.id)} — ${secE(u.id)}</option>`).join('')}</select></div>
  <div style="margin:.5rem 0;line-height:1.7;"><label><input type="checkbox" class="so-c" checked> I-disable ang account (hindi na makaka-login)</label><br><label><input type="checkbox" class="so-c" checked> I-logout sa lahat ng device</label><br><label><input type="checkbox" class="so-c" checked> Alisin ang per-user at temporary access</label><br><label><input type="checkbox" class="so-c" checked> Alisin sa lahat ng Group</label></div>
  <button class="btn btn-danger" onclick="secOffRun()">🚪 I-offboard</button>
  <div style="background:#f1f5f9;padding:.5rem;border-radius:.4rem;margin-top:.6rem;font-size:.82rem;"><b>Manual pa rin (hindi kaya ng app):</b> ibalik ang uniform/susi/gamit • i-clear ang loan balance • i-update ang HR status (Resigned/Terminated) sa Employees • kung kailangan, burahin ang login sa Firebase Console → Authentication.</div>
  <h4 style="margin-top:1rem;">Na-offboard na</h4>${gone.length ? '<table class="table"><tr><th>User</th><th>Kailan</th><th>Ni</th></tr>' + gone.map(u => `<tr><td>${secE(u.id)}</td><td>${secE(u.offboardedAt)}</td><td>${secE(u.offboardedBy)}</td></tr>`).join('') + '</table>' : '<small>Wala pa.</small>'}`;
}
async function secOffRun() {
  const e = document.getElementById('so-user').value; if (!e) return; const c = [...document.querySelectorAll('.so-c')].map(x => x.checked);
  if (!await uiConfirm('I-offboard si ' + e + '? Hindi na siya makakapasok sa system.')) return;
  if (!await secNeed4('admin_role', 'Offboard ' + e)) return;
  const me = String((getCurrentUser() || {}).email || ''); const FV = firebase.firestore.FieldValue;
  try {
    const upd = { offboardedAt: new Date().toISOString(), offboardedBy: me }; if (c[0]) upd.status = 'disabled'; if (c[2]) { upd.permissions = {}; upd.tempPerms = FV.delete(); upd.tempUntil = FV.delete(); }
    await db.collection('users').doc(e).update(upd);
    if (c[1]) await db.collection('session_control').doc(e).set({ logoutAt: FV.serverTimestamp(), by: me });
    if (c[3]) { const G = await secGroupsLoad(); G.forEach(g => { g.members = (g.members || []).filter(m => m !== e); }); await db.collection('system_settings').doc('sec_groups').set({ list: G }); }
    try { await logSystemAction('USER_OFFBOARDED', e); } catch (x) {}
    const u = SECUI.users.find(x => x.id === e); if (u) { Object.assign(u, { offboardedAt: upd.offboardedAt, offboardedBy: me }); if (c[0]) u.status = 'disabled'; }
    alert('✅ Na-offboard.'); secBody();
  } catch (er) { alert('Error: ' + er.message); }
}

// ---------- 11. 4-eyes ----------
const SEC_4E = [['db_restore', 'Database restore'], ['truncate', 'Truncate (burahin ang data)'], ['admin_role', 'Pagbabago ng role / offboarding']];
async function secAppr() {
  const p = SEC.pol, me = String((getCurrentUser() || {}).email || '').toLowerCase(); const s = await db.collection('sec_approvals').orderBy('requestedAt', 'desc').limit(30).get(); const A = s.docs.map(d => Object.assign({ id: d.id }, d.data()));
  return `<p style="font-size:.85rem;color:#64748b;">Kapag naka-ON, ang mapanganib na aksyon ay kailangan ng approval ng <b>ikalawang Admin</b> bago maituloy. Kailangan may hindi bababa sa dalawang Admin account.</p>
  <label><input type="checkbox" id="s4-en" ${p.fourEyes.enabled ? 'checked' : ''}> I-on ang 4-eyes</label><div style="margin:.4rem 0;">${SEC_4E.map(a => `<label style="display:block;"><input type="checkbox" class="s4-a" value="${a[0]}" ${(p.fourEyes.actions || []).includes(a[0]) ? 'checked' : ''}> ${a[1]}</label>`).join('')}</div>
  <button class="btn btn-success btn-sm" onclick="secAppr4Save()">💾 I-save</button>
  <h4 style="margin-top:1rem;">Mga request</h4>${A.length ? '<table class="table" style="font-size:.82rem;"><tr><th>Aksyon</th><th>Humiling</th><th>Kailan</th><th>Status</th><th></th></tr>' + A.map(x => { const exp = (x.expiresAt || 0) < Date.now(); return `<tr><td>${secE(x.label || x.action)}</td><td>${secE(x.requestedBy)}</td><td>${secFmt(x.requestedAt)}</td><td>${secE(x.status)}${exp && x.status === 'pending' ? ' (expired)' : ''}</td><td>${x.status === 'pending' && !exp && x.requestedBy !== me ? `<button class="btn btn-success btn-sm" onclick="secApprove('${x.id}',true)">✅ Approve</button> <button class="btn btn-danger btn-sm" onclick="secApprove('${x.id}',false)">✖</button>` : ''}</td></tr>`; }).join('') + '</table>' : '<small>Wala pang request.</small>'}`;
}
async function secAppr4Save() {
  const adm = SECUI.users.filter(u => secRoleOf(u) === 'admin' && String(u.status).toLowerCase() === 'active').length, en = document.getElementById('s4-en').checked;
  if (en && adm < 2) { alert('Kailangan ng hindi bababa sa 2 aktibong Admin account bago i-on ito, kung hindi ay walang makakapag-approve.'); return; }
  if (await secSavePolicy({ fourEyes: { enabled: en, actions: [...document.querySelectorAll('.s4-a:checked')].map(x => x.value) } }, '4-eyes approval')) alert('✅ Na-save.');
}
async function secApprove(id, yes) { try { await db.collection('sec_approvals').doc(id).update({ status: yes ? 'approved' : 'rejected', approvedBy: String((getCurrentUser() || {}).email || '').toLowerCase(), approvedAt: Date.now() }); try { await logSystemAction('APPROVAL_REQUESTED', (yes ? 'Na-approve' : 'Tinanggihan') + ' ang request ' + id); } catch (e) {} secBody(); } catch (e) { alert('Error: ' + e.message); } }

// ---------- 9. Audit alerts ----------
async function secAlerts() {
  const p = SEC.pol; const s = await db.collection('sec_alerts').orderBy('atMs', 'desc').limit(50).get();
  return `<label><input type="checkbox" id="sal-en" ${p.alerts.enabled ? 'checked' : ''}> I-on ang alerts sa sensitibong aksyon (restore, truncate, role change, malaking discount, atbp.)</label>
  <div class="form-group"><label>Email ng tatanggap (kuwit; blangko = mga Super Admin)</label><input id="sal-em" value="${secE(p.alerts.emails)}" style="width:100%;"></div>
  <div class="form-group"><label>Alerto kapag discount ay umabot ng (%)</label><input type="number" id="sal-d" value="${+p.alerts.discountPct || 30}" style="width:90px;"></div>
  <button class="btn btn-success btn-sm" onclick="secAlertSave()">💾 I-save</button>
  <h4 style="margin-top:1rem;">Mga alert</h4>${s.empty ? '<small>Wala.</small>' : '<table class="table" style="font-size:.82rem;"><tr><th>Kailan</th><th>Aksyon</th><th>Detalye</th><th>Ni</th></tr>' + s.docs.map(d => { const x = d.data(); return `<tr><td>${secFmt(x.atMs)}</td><td><b>${secE(x.action)}</b></td><td>${secE(x.details)}</td><td>${secE(x.by)}</td></tr>`; }).join('') + '</table>'}`;
}
async function secAlertSave() { if (await secSavePolicy({ alerts: { enabled: document.getElementById('sal-en').checked, emails: document.getElementById('sal-em').value.trim(), discountPct: +document.getElementById('sal-d').value || 30 } }, 'Audit alerts')) alert('✅ Na-save.'); }

// ---------- 12. Retention ----------
const SEC_RET = [['notifications', 'Notifications', 'createdAt'], ['login_history', 'Login history', 'atMs'], ['sec_errors', 'Browser errors', 'atMs'], ['sec_alerts', 'Security alerts', 'atMs']];
async function secRet() {
  const p = SEC.pol;
  return `<p style="font-size:.85rem;color:#64748b;">Burahin ang lumang basura para hindi lumaki ang database. Ang <b>Audit Logs ay hindi kailanman binubura</b> (immutable).</p>
  <table class="table" style="max-width:520px;"><tr><th>Data</th><th>Itago ng (araw)</th></tr>${SEC_RET.map(r => `<tr><td>${r[1]}</td><td><input type="number" min="7" max="3650" id="sr-${r[0]}" value="${+p.retention[r[0]] || 60}" style="width:90px;"></td></tr>`).join('')}</table>
  <button class="btn btn-success btn-sm" onclick="secRetSave()">💾 I-save</button> <button class="btn btn-danger btn-sm" onclick="secRetRun(true)">🧹 Linisin ngayon</button>
  <div id="sr-out" style="margin-top:.5rem;font-size:.85rem;"></div><small style="color:#64748b;">Awtomatiko ring tumatakbo isang beses kada araw kapag binuksan ng Admin ang admin page.</small>`;
}
async function secRetSave() { const r = {}; SEC_RET.forEach(x => { r[x[0]] = Math.max(7, +document.getElementById('sr-' + x[0]).value || 60); }); if (await secSavePolicy({ retention: r }, 'Retention')) alert('✅ Na-save.'); }
async function secRetRun(manual) {
  const pol = await secPolicy(true), out = {}; if (manual && !await uiConfirm('Burahin ang mga data na lampas sa itinakdang araw? Hindi na ito maibabalik.')) return;
  for (const r of SEC_RET) {
    const days = +pol.retention[r[0]] || 60; const cut = r[2] === 'createdAt' ? new Date(secDays(days)) : secDays(days); let n = 0;
    try { for (let k = 0; k < 6; k++) { const s = await db.collection(r[0]).where(r[2], '<', cut).limit(400).get(); if (s.empty) break; const b = db.batch(); s.docs.forEach(d => b.delete(d.ref)); await b.commit(); n += s.size; if (s.size < 400) break; } } catch (e) { out[r[1]] = 'error: ' + e.message; continue; }
    out[r[1]] = n;
  }
  try { await db.collection('system_settings').doc('security_policy').set({ retentionLastRun: Date.now() }, { merge: true }); } catch (e) {}
  const el = document.getElementById('sr-out'); if (el) el.innerHTML = 'Nabura: ' + Object.entries(out).map(([k, v]) => `${secE(k)} <b>${secE(v)}</b>`).join(' • ');
  return out;
}

// ---------- 13. Maintenance ----------
async function secMnt() {
  const s = await db.collection('system_settings').doc('maintenance').get(), m = s.exists ? s.data() : {};
  return `<p style="font-size:.85rem;color:#64748b;">Kapag naka-ON, ang lahat maliban sa Admin ay hindi makakagamit (lalabas ang mensahe). Gamitin kapag nag-uupload ng bagong bersyon, nagre-restore, o nag-aayos ng data.</p>
  <div style="font-size:1.1rem;margin-bottom:.5rem;">Kasalukuyan: ${m.on ? '<b style="color:#dc2626;">🛠️ NAKA-ON</b>' : '<b style="color:#16a34a;">✅ NORMAL</b>'}</div>
  <div class="form-group"><label>Mensahe sa mga user</label><input id="sm-msg" value="${secE(m.msg || 'Ginagawan ng maintenance ang system. Subukan ulit mamaya.')}" style="width:100%;"></div>
  <button class="btn ${m.on ? 'btn-success' : 'btn-danger'}" onclick="secMntSet(${m.on ? 'false' : 'true'})">${m.on ? '✅ I-OFF ang Maintenance' : '🛠️ I-ON ang Maintenance'}</button>`;
}
async function secMntSet(on) {
  if (!superAdminIsMe()) { alert('Super Admin lang.'); return; } if (on && !await uiConfirm('I-ON ang Maintenance? Lahat ng user maliban sa Admin ay mawawalan ng access agad.')) return;
  try { await db.collection('system_settings').doc('maintenance').set({ on, msg: document.getElementById('sm-msg').value.trim(), by: String((getCurrentUser() || {}).email || ''), at: new Date().toISOString() }); try { await logSystemAction(on ? 'MAINTENANCE_ON' : 'MAINTENANCE_OFF', 'Maintenance Mode'); } catch (e) {} secBody(); } catch (e) { alert('Error: ' + e.message); }
}

// ---------- Auto sweeps (kapag binuksan ng Admin ang admin page) ----------
async function secAutoSweeps() {
  try {
    const pol = await secPolicy(true); const day = 86400000;
    if (!pol.retentionLastRun || Date.now() - pol.retentionLastRun > day) await secRetRun(false);
    const now = Date.now(), FV = firebase.firestore.FieldValue; const s = await db.collection('users').where('tempUntil', '<', now).get();
    for (const d of s.docs) { await d.ref.update({ tempPerms: FV.delete(), tempUntil: FV.delete(), tempBy: FV.delete() }); }
    const D = await secReviewDoc(); if (D.month !== new Date().toISOString().slice(0, 7) && !sessionStorage.getItem('sec_rev_note')) { sessionStorage.setItem('sec_rev_note', '1'); console.info('📋 Monthly Access Review ay hindi pa nagagawa — Security & Access Center → Access Review.'); }
  } catch (e) { console.warn('secAutoSweeps:', e.message); }
}
