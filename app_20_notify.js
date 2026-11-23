


// ========================================================
// 🔔 NOTIFICATIONS (in-app bell + email sa pamamagitan ng Google Apps Script webhook)
// system_settings/email_config {url, secret}    system_settings/request_approvers {cooEmail,presidentEmail,supplyChainEmails,accountingEmails}
// notifications/{id} {to, subject, body, link, read, createdAt}
// ========================================================
let ntfCache = { at: 0, cfg: null };
async function ntfCfg() {
  if (ntfCache.cfg && Date.now() - ntfCache.at < 60000) return ntfCache.cfg;
  const cfg = { url: '', secret: '', coo: [], president: [], supply: [], accounting: [] }; const L = v => String(v || '').split(/[,;\s]+/).map(x => x.trim().toLowerCase()).filter(x => x.includes('@'));
  try { const e = await db.collection('system_settings').doc('email_config').get(); if (e.exists) { cfg.url = e.data().url || ''; cfg.secret = e.data().secret || ''; } } catch (e) {}
  try { const a = await db.collection('system_settings').doc('request_approvers').get(); if (a.exists) { const d = a.data(); cfg.coo = L(d.cooEmail); cfg.president = L(d.presidentEmail); cfg.supply = L(d.supplyChainEmails); cfg.accounting = L(d.accountingEmails); } } catch (e) {}
  ntfCache = { at: Date.now(), cfg }; return cfg;
}
// to: array ng email o pangalan ng role ('coo','president','supply','accounting')
async function notify(to, subject, body, opts) {
  try {
    if (!db) return; const cfg = await ntfCfg(); const me = String((getCurrentUser() || {}).email || '').toLowerCase(); let list = [];
    (to || []).forEach(t => { if (cfg[t]) list = list.concat(cfg[t]); else if (String(t).includes('@')) list.push(String(t).toLowerCase()); });
    list = [...new Set(list)].filter(x => (opts && opts.includeSelf) || x !== me); if (!list.length) return;
    const link = (opts && opts.link) || (location.href.split('#')[0]); const now = new Date().toISOString();
    for (const e of list) { try { await db.collection('notifications').add({ to: e, subject, body, link, read: false, createdAt: now }); } catch (er) {} }
    if (cfg.url) { try { db.collection('email_log').add({ day: new Date().toLocaleDateString('en-CA'), count: list.length, subject: String(subject || '').slice(0, 80), at: now, by: me }).catch(() => {}); fetch(cfg.url, { method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ secret: cfg.secret, to: list, subject, body: body + '\n\nBuksan: ' + link }) }); } catch (er) {} }
  } catch (e) {}
}
async function emailSetup() {
  const cfg = await ntfCfg(); let a = {}; try { const d = await db.collection('system_settings').doc('request_approvers').get(); a = d.exists ? d.data() : {}; } catch (e) {}
  arModal(`<h3>📧 Email Notifications</h3><p style="font-size:.85rem;color:#64748b;">Ang email ay ipinapadala gamit ang Google Apps Script (Gmail ninyo). Kapag blangko ang URL, in-app 🔔 lang.</p>
    <div class="form-group"><label>Apps Script Web App URL</label><input type="text" id="em-url" value="${srchEsc(cfg.url)}" style="width:100%;"></div><div class="form-group"><label>Secret (kapareho ng nasa script)</label><input type="text" id="em-secret" value="${srchEsc(cfg.secret)}"></div>
    <div class="form-group"><label>Supply Chain / Procurement (mga email, may kuwit)</label><input type="text" id="em-sc" value="${srchEsc(a.supplyChainEmails || '')}" style="width:100%;"></div>
    <div class="form-group"><label>Accounting (mga email, may kuwit)</label><input type="text" id="em-acc" value="${srchEsc(a.accountingEmails || '')}" style="width:100%;"></div>
    <small>Ang COO at President ay itinatakda sa Mga Request → ⚙️ Approvers.</small><br><button class="btn btn-success" onclick="emailSetupSave()">💾 I-save</button> <button class="btn btn-secondary" onclick="emailTest()">✉️ Test</button>`);
}
async function emailSetupSave() {
  const g = id => (document.getElementById(id) || {}).value || '';
  try { await db.collection('system_settings').doc('email_config').set({ url: g('em-url').trim(), secret: g('em-secret').trim() }); await db.collection('system_settings').doc('request_approvers').set({ supplyChainEmails: g('em-sc').trim(), procurementList: reqList(g('em-sc')), accountingEmails: g('em-acc').trim() }, { merge: true }); ntfCache.at = 0; arCloseModal(); alert('✅ Na-save.'); } catch (e) { alert('Error: ' + e.message); }
}
async function emailTest() { await emailSetupSave(); const me = (getCurrentUser() || {}).email; ntfCache.at = 0; const cfg = await ntfCfg(); if (!cfg.url) { alert('Walang URL.'); return; } fetch(cfg.url, { method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ secret: cfg.secret, to: [String(me).toLowerCase()], subject: 'Test — KusinaERP', body: 'Gumagana ang email notification.' }) }); alert('Naipadala ang test sa ' + me + '. Tingnan ang inbox (at spam) pagkaraan ng ilang saglit.'); }
async function initNotifBell() {
  if (typeof db === 'undefined' || !db) { if (!window.__ntfRetry) { window.__ntfRetry = 1; setTimeout(() => { window.__ntfRetry = 0; initNotifBell(); }, 2000); } return; }
  const host = document.getElementById('top-user-display'); if (!host || document.getElementById('ntf-bell')) return;
  const b = document.createElement('button'); b.id = 'ntf-bell'; b.type = 'button'; b.className = 'btn btn-secondary btn-sm'; b.style.cssText = 'position:relative;margin-right:.4rem;'; b.innerHTML = '🔔<span id="ntf-count" style="display:none;position:absolute;top:-6px;right:-6px;background:#dc2626;color:#fff;border-radius:999px;font-size:.65rem;padding:0 5px;"></span>'; b.onclick = openNotifs; host.parentNode.insertBefore(b, host);
  ntfRefresh(); setInterval(ntfRefresh, 60000);
  try { const pm = await memoPending(); if (pm.length && !sessionStorage.getItem('memoShown')) { sessionStorage.setItem('memoShown', '1'); openNotifs(); } } catch (e) {}
}
async function ntfMine() { const me = String((getCurrentUser() || {}).email || '').toLowerCase(); const s = await db.collection('notifications').where('to', '==', me).get(); const a = []; s.forEach(d => a.push({ id: d.id, ...d.data() })); return a.sort((x, y) => String(y.createdAt).localeCompare(String(x.createdAt))); }
async function ntfRefresh() { try { const a = await ntfMine(); let pm = []; try { pm = await memoPending(); } catch (e) {} const n = a.filter(x => !x.read).length + pm.length; const c = document.getElementById('ntf-count'); if (c) { c.style.display = n ? 'inline' : 'none'; c.innerText = n > 99 ? '99+' : n; } } catch (e) {} }
async function openNotifs() {
  const a = (await ntfMine()).slice(0, 40); let pm = []; try { pm = await memoPending(); } catch (e) {}
  try { memoMarkSeen(pm); } catch (e) {}
  const memoHtml = pm.map(m => `<div style="border:2px solid #dc2626;border-radius:.5rem;padding:.7rem;margin-bottom:.7rem;background:#fef2f2;"><b>📢 ${srchEsc(m.title)}</b><br><small style="color:#64748b;">${srchEsc(m.createdBy || '')} · ${srchEsc(String(m.createdAt).slice(0, 10))}</small><div style="white-space:pre-wrap;margin:.4rem 0;">${srchEsc(m.body)}</div>${m.image ? `<img src="${m.image}" style="max-width:100%;border-radius:.4rem;">` : ''}<label style="display:block;margin:.5rem 0;"><input type="checkbox" id="memo-ck-${m.id}"> Nabasa at naiintindihan ko ang memo na ito</label><button class="btn btn-danger btn-sm" onclick="memoAck('${m.id}')">✔ Acknowledge</button></div>`).join('');
  arModal(`<h3>🔔 Mga Abiso</h3>${pm.length ? `<p style="color:#dc2626;font-size:.85rem;">May ${pm.length} memo na kailangan mong i-acknowledge. Hindi mawawala ang pulang tuldok hangga't hindi mo ito nai-check.</p>` : ''}${memoHtml}<div style="max-height:60vh;overflow:auto;">${a.map(n => `<div style="border-bottom:1px solid #e2e8f0;padding:.5rem 0;${n.read ? 'opacity:.6;' : ''}"><b>${srchEsc(n.subject)}</b><br><small>${srchEsc(n.body)}</small><br><small style="color:#94a3b8;">${srchEsc(String(n.createdAt).slice(0, 16).replace('T', ' '))}</small></div>`).join('') || '<p style="color:#94a3b8;">Wala pang abiso.</p>'}</div><button class="btn btn-secondary btn-sm" onclick="ntfMarkAll()">✔ Markahan lahat na nabasa</button>`);
}
async function ntfMarkAll() { try { const a = (await ntfMine()).filter(x => !x.read); for (const n of a) await db.collection('notifications').doc(n.id).update({ read: true }); } catch (e) {} arCloseModal(); ntfRefresh(); }


// ========================================================
// 📢 HR MEMOS / ANNOUNCEMENTS — may acknowledgement (checkbox) bago mawala ang red dot
// memos/{id} {title, body, image, audience, recipients[], createdBy, createdByEmail, createdAt}
// memo_acks/{memoId}__{email} {memoId, email, name, at}
// ========================================================
let memoState = { list: [], acks: {}, users: [], sel: [] };
// ================= HR Documents Library =================
// Metadata sa hr_documents; ang file ay hinahati sa chunks sa hr_doc_files (walang Storage) — hanggang ~4MB. Puwede ring link (Google Drive etc.).
let hrdState = { list: [], q: '', cat: '' };
const HRD_CATS = ['Forms', 'Policy', 'Handbook', 'Memo Template', 'Benefits', 'Iba pa'];
function hrdCanManage() { const u = getCurrentUser() || {}; return normalizeRole(u.role) === 'admin' || (typeof canEditModule === 'function' && (canEditModule('memos') || canEditModule('hrdocs'))); }
function hrdRoot() { return document.getElementById('hrdocs-root'); }
async function loadHrDocs() {
  const root = hrdRoot(); if (!root || !db) return;
  try { const all = hrdCanManage(); const s = await (all ? db.collection('hr_documents').get() : db.collection('hr_documents').where('shared', '==', true).get()); hrdState.list = []; s.forEach(d => hrdState.list.push({ id: d.id, ...d.data() })); hrdState.list.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
    if (all) hrdMigrate(); } catch (e) { root.innerHTML = '<div class="card">Error: ' + srchEsc(e.message) + '</div>'; return; }
  hrdRender();
}
// Lumang dokumento na walang 'shared' ay itinuturing na shared sa lahat (gaya ng dati) — isang beses na minarkahan ng HR/Admin
async function hrdMigrate() {
  const old = hrdState.list.filter(d => d.shared === undefined); if (!old.length) return;
  for (const d of old) { try { await db.collection('hr_documents').doc(d.id).update({ shared: true }); d.shared = true; for (let i = 0; i < (d.chunks || 0); i++) await db.collection('hr_doc_files').doc(d.id + '_' + i).update({ shared: true }); } catch (e) {} }
  hrdRender();
}
async function hrdShare(id, v) {
  const d = hrdState.list.find(x => x.id === id); if (!d || !hrdCanManage()) return;
  if (!(await uiConfirm(v ? `Ibahagi ang "${d.title}" sa LAHAT ng empleyado/branch (makaka-download sila)?` : `Gawing HR/Admin lang ang "${d.title}"?`))) return;
  try { await db.collection('hr_documents').doc(id).update({ shared: !!v, sharedBy: (getCurrentUser() || {}).email || '', sharedAt: new Date().toISOString() }); for (let i = 0; i < (d.chunks || 0); i++) await db.collection('hr_doc_files').doc(id + '_' + i).update({ shared: !!v }); d.shared = !!v; hrdRender(); try { logSystemAction('HRDOC_SHARE', `${d.title}: ${v ? 'shared sa lahat' : 'HR/Admin lang'}`); } catch (e) {} } catch (e) { alert('Error: ' + e.message); }
}
function hrdRender() {
  const root = hrdRoot(); if (!root) return; const st = hrdState; const cats = [...new Set([...HRD_CATS, ...st.list.map(d => d.category).filter(Boolean)])];
  const list = st.list.filter(d => (!st.cat || d.category === st.cat) && (!st.q || smartMatch(st.q, d.title + ' ' + (d.description || ''), d.category || '')));
  root.innerHTML = `<div class="card" data-notools="1"><div class="card-title"><span>📚 HR Documents</span>${hrdCanManage() ? '<button class="btn btn-success btn-sm" onclick="hrdUploadOpen()">➕ Mag-upload</button>' : ''}</div>
    <div style="display:flex;gap:.5rem;flex-wrap:wrap;margin-bottom:.6rem;"><input type="search" id="hrd-q" placeholder="🔎 Hanapin..." value="${srchEsc(st.q)}" oninput="hrdState.q=this.value;hrdRender();document.getElementById('hrd-q').focus()" style="flex:1;min-width:160px;">
      <select onchange="hrdState.cat=this.value;hrdRender()"><option value="">Lahat ng kategorya</option>${cats.map(c => `<option ${c === st.cat ? 'selected' : ''}>${srchEsc(c)}</option>`).join('')}</select></div>
    <div class="table-responsive"><table><thead><tr><th>Dokumento</th><th>Kategorya</th><th>Petsa</th><th></th></tr></thead><tbody>${list.map(d => `<tr><td><b>${srchEsc(d.title)}</b>${d.description ? `<br><small style="color:#64748b;">${srchEsc(d.description)}</small>` : ''}${d.fileName ? `${hrdCanManage() ? `<br><span style="font-size:.72rem;color:${d.shared === false ? '#b45309' : '#16a34a'};">${d.shared === false ? '🔒 HR/Admin lang' : '🌐 Shared sa lahat'}</span>` : ''}<br><small style="color:#94a3b8;">📎 ${srchEsc(d.fileName)}${d.size ? ' · ' + Math.round(d.size / 1024) + ' KB' : ''}</small>` : ''}</td><td>${srchEsc(d.category || '')}</td><td style="font-size:.8rem;">${srchEsc(String(d.createdAt || '').slice(0, 10))}</td><td style="white-space:nowrap;"><button class="btn btn-primary btn-sm" onclick="hrdOpen('${srchEsc(d.id)}')">${d.kind === 'link' ? '🔗 Buksan' : '⬇️ I-download'}</button>${hrdCanManage() ? ` <button class="btn btn-secondary btn-sm" title="${d.shared === false ? 'Ibahagi sa lahat' : 'Gawing HR/Admin lang'}" onclick="hrdShare('${srchEsc(d.id)}', ${d.shared === false})">${d.shared === false ? '🌐 I-share' : '🔒 Ihinto'}</button> <button class="btn btn-secondary btn-sm" onclick="hrdDelete('${srchEsc(d.id)}')">🗑️</button>` : ''}</td></tr>`).join('') || '<tr><td colspan="4" style="text-align:center;color:#94a3b8;padding:1.2rem;">Wala pang dokumento.</td></tr>'}</tbody></table></div></div>`;
}
function hrdUploadOpen() {
  if (!hrdCanManage()) return;
  arModal(`<h3>➕ Mag-upload ng HR Document</h3><div class="form-group"><label>Pamagat</label><input id="hrd-title" type="text" style="width:100%;"></div>
    <div class="form-group"><label>Kategorya</label><input id="hrd-cat" list="hrd-cats" value="Forms" style="width:100%;"><datalist id="hrd-cats">${HRD_CATS.map(c => `<option>${c}</option>`).join('')}</datalist></div>
    <div class="form-group"><label>Paglalarawan (optional)</label><input id="hrd-desc" type="text" style="width:100%;"></div>
    <div class="form-group"><label>📎 File (PDF/Word/Excel/larawan, hanggang 4MB)</label><input id="hrd-file" type="file"></div>
    <div class="form-group"><label>— o — 🔗 Link (Google Drive, atbp.)</label><input id="hrd-link" type="url" placeholder="https://..." style="width:100%;"></div>
    <div class="form-group"><label><input type="checkbox" id="hrd-shared"> 🌐 Ibahagi sa LAHAT (puwedeng i-download ng lahat ng empleyado/branch). Kapag hindi naka-check, HR/Admin/Super Admin lang ang makakakita.</label></div>
    <button class="btn btn-success" onclick="hrdUpload()">💾 I-save</button>`);
}
function hrdReadFile(f) { return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = () => rej(new Error('Hindi mabasa ang file')); r.readAsDataURL(f); }); }
async function hrdUpload() {
  const title = (document.getElementById('hrd-title').value || '').trim(), category = (document.getElementById('hrd-cat').value || '').trim() || 'Iba pa', description = (document.getElementById('hrd-desc').value || '').trim(), link = (document.getElementById('hrd-link').value || '').trim();
  const f = (document.getElementById('hrd-file').files || [])[0]; if (!title) { alert('Ilagay ang pamagat.'); return; } if (!f && !link) { alert('Mag-attach ng file o maglagay ng link.'); return; } if (f && f.size > 4 * 1024 * 1024) { alert('Masyadong malaki (max 4MB). Gamitin ang link (Google Drive) para sa malaking file.'); return; }
  const shared = !!(document.getElementById('hrd-shared') || {}).checked; const me = getCurrentUser() || {}, id = 'HRD-' + Date.now().toString(36).toUpperCase(), now = new Date().toISOString();
  try {
    let meta = { shared, title, category, description, createdBy: me.name || me.email || '', createdAt: now };
    if (f) { const data = await hrdReadFile(f), CH = 700000, n = Math.ceil(data.length / CH); for (let i = 0; i < n; i++) await db.collection('hr_doc_files').doc(id + '_' + i).set({ docId: id, idx: i, shared, data: data.slice(i * CH, (i + 1) * CH) }); meta = { ...meta, kind: 'file', fileName: f.name, mime: f.type || 'application/octet-stream', size: f.size, chunks: n }; }
    else meta = { ...meta, kind: 'link', url: link };
    await db.collection('hr_documents').doc(id).set(meta); arCloseModal(); alert('✅ Na-upload.'); loadHrDocs();
  } catch (e) { alert('Error: ' + e.message); }
}
async function hrdOpen(id) {
  const d = hrdState.list.find(x => x.id === id); if (!d) return;
  if (d.kind === 'link') { window.open(d.url, '_blank', 'noopener'); return; }
  try { let data = ''; for (let i = 0; i < (d.chunks || 0); i++) { const c = await db.collection('hr_doc_files').doc(id + '_' + i).get(); data += (c.data() || {}).data || ''; }
    const a = document.createElement('a'); a.href = data; a.download = d.fileName || 'document'; document.body.appendChild(a); a.click(); a.remove(); } catch (e) { alert('Error: ' + e.message); }
}
async function hrdDelete(id) {
  const d = hrdState.list.find(x => x.id === id); if (!d || !await uiConfirm(`Burahin ang "${d.title}"?`)) return;
  try { for (let i = 0; i < (d.chunks || 0); i++) await db.collection('hr_doc_files').doc(id + '_' + i).delete(); await db.collection('hr_documents').doc(id).delete(); loadHrDocs(); } catch (e) { alert('Error: ' + e.message); }
}
// ================= System Health (admin lang) =================
// Walang sariling server ang app (Firebase + GitHub Pages), kaya sinusukat dito ang bilis ng koneksyon sa database at ng device — hindi ang CPU ng Google server.
let shTimer = null;
function shIsAdmin() { const u = getCurrentUser() || {}; return normalizeRole(u.role) === 'admin'; }
function shMedian(a) { const b = a.slice().sort((x, y) => x - y); return b.length ? b[Math.floor(b.length / 2)] : 0; }
async function shMeasure() {
  const r = { at: Date.now(), online: navigator.onLine !== false, read: null, write: null, err: '' };
  if (!r.online) return r;
  try {
    const rs = []; for (let i = 0; i < 3; i++) { const t0 = performance.now(); await db.collection('system_settings').limit(1).get({ source: 'server' }); rs.push(performance.now() - t0); } r.read = Math.round(shMedian(rs));
    const t1 = performance.now(); await db.collection('system_health').doc('ping').set({ t: Date.now(), by: (getCurrentUser() || {}).email || '' }); r.write = Math.round(performance.now() - t1);
  } catch (e) { r.err = e.message || String(e); }
  return r;
}
function shLevel(r) { if (!r.online) return ['🔴', 'Offline', '#dc2626']; if (r.err) return ['🔴', 'May error sa koneksyon', '#dc2626']; const m = Math.max(r.read || 0, (r.write || 0) / 1.5); if (m < 400) return ['🟢', 'Maayos', '#16a34a']; if (m < 1200) return ['🟡', 'Medyo mabagal', '#d97706']; return ['🔴', 'Mabagal', '#dc2626']; }
function shHist(r) { try { const k = 'sh_hist', h = JSON.parse(localStorage.getItem(k) || '[]'); if (r && r.read != null) { h.push({ t: r.at, r: r.read, w: r.write }); while (h.length > 40) h.shift(); localStorage.setItem(k, JSON.stringify(h)); } return h; } catch (e) { return []; } }
async function loadSysHealth() {
  const root = document.getElementById('syshealth-root'); if (!root) return;
  if (!shIsAdmin()) { root.innerHTML = '<div class="card">Para sa Admin lamang ang page na ito.</div>'; return; }
  root.innerHTML = '<div class="card">⏳ Sinusukat ang bilis...</div>';
  const r = await shMeasure(), hist = shHist(r), lv = shLevel(r), st = window.__fsStats || { calls: 0, docs: 0, errors: 0, ms: 0, slow: [] };
  let em = { n: 0, calls: 0, last: [] }; try { const es = await db.collection('email_log').where('day', '==', new Date().toLocaleDateString('en-CA')).get(); es.forEach(d => { const x = d.data(); em.n += +x.count || 0; em.calls++; em.last.push(x); }); em.last.sort((a, b) => String(b.at).localeCompare(String(a.at))); } catch (e) { em.err = e.message; }
  const nav = performance.getEntriesByType && performance.getEntriesByType('navigation')[0], conn = navigator.connection || {}, mem = performance.memory;
  const spark = (() => { if (hist.length < 2) return ''; const mx = Math.max(...hist.map(x => x.r), 500), w = 280, h = 50, pts = hist.map((x, i) => `${Math.round(i * w / (hist.length - 1))},${Math.round(h - x.r / mx * h)}`).join(' '); return `<svg width="${w}" height="${h + 4}" style="max-width:100%;"><polyline points="${pts}" fill="none" stroke="#2563eb" stroke-width="2"/></svg><div style="font-size:.7rem;color:#94a3b8;">Read latency, huling ${hist.length} sukat (max ${mx} ms)</div>`; })();
  const box = (t, v, sub) => `<div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:.5rem;padding:.7rem;"><div style="font-size:.75rem;color:#64748b;">${t}</div><div style="font-size:1.35rem;font-weight:800;color:#1e293b;">${v}</div>${sub ? `<div style="font-size:.7rem;color:#94a3b8;">${sub}</div>` : ''}</div>`;
  root.innerHTML = `<div class="card" data-notools="1"><div class="card-title"><span>🩺 System Health</span><button class="btn btn-secondary btn-sm" onclick="loadSysHealth()">🔄 Sukatin ulit</button></div>
    <div style="background:${lv[2]}15;border:1px solid ${lv[2]};color:${lv[2]};border-radius:.5rem;padding:.7rem 1rem;font-weight:800;font-size:1.1rem;margin-bottom:.8rem;">${lv[0]} ${lv[1]}${r.err ? `<div style="font-weight:500;font-size:.8rem;">${srchEsc(r.err)}</div>` : ''}</div>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:.6rem;margin-bottom:.8rem;">
      ${box('Database read', r.read != null ? r.read + ' ms' : '—', 'median ng 3 sukat · &lt;400 maayos')}${box('Database write', r.write != null ? r.write + ' ms' : '—', '&lt;600 maayos')}
      ${box('Koneksyon', srchEsc(conn.effectiveType || (r.online ? 'online' : 'offline')), conn.rtt != null ? `RTT ${conn.rtt} ms · ${conn.downlink} Mbps` : '')}
      ${box('Page load', nav ? Math.round(nav.loadEventEnd || nav.domContentLoadedEventEnd) + ' ms' : '—', 'unang bukas ng page')}
      ${box('Reads ngayong session', st.docs, `${st.calls} queries · avg ${st.calls ? Math.round(st.ms / st.calls) : 0} ms · ${st.errors} error`)}
      ${box('📧 Email ngayong araw', em.err ? 'n/a' : em.n, em.err ? srchEsc(em.err) : `${em.calls} send · Gmail libre ~100/araw, Workspace ~1,500/araw`)}
      ${box('Memory ng browser', mem ? Math.round(mem.usedJSHeapSize / 1048576) + ' MB' : 'n/a', mem ? 'limit ' + Math.round(mem.jsHeapSizeLimit / 1048576) + ' MB' : 'hindi suportado ng browser')}</div>
    ${spark ? `<div style="margin-bottom:.8rem;">${spark}</div>` : ''}
    ${em.last.length ? `<h4 style="margin:.4rem 0;">📧 Huling email ngayong araw</h4><div style="font-size:.8rem;margin-bottom:.8rem;">${em.last.slice(0, 6).map(x => `• ${srchEsc(String(x.at).slice(11, 16))} — ${x.count} tao — ${srchEsc(x.subject)}`).join('<br>')}<br><small style="color:#94a3b8;">Bilang ng ipinadala ng app; hindi nito nakukumpirma kung natanggap ng Gmail.</small></div>` : ''}
    <h4 style="margin:.4rem 0;">🐢 Pinakamabagal / pinakamabigat na queries (session na ito)</h4>
    <div class="table-responsive"><table><thead><tr><th>Collection</th><th>Oras</th><th>Docs</th></tr></thead><tbody>${st.slow.map(x => `<tr><td>${srchEsc(x.path || '?')}</td><td>${x.ms} ms</td><td>${x.docs}</td></tr>`).join('') || '<tr><td colspan="3" style="color:#94a3b8;text-align:center;">Wala pang mabagal na query 👍</td></tr>'}</tbody></table></div>
    <p style="font-size:.8rem;color:#64748b;margin-top:.8rem;">ℹ️ Ang app ay gumagamit ng Firebase (managed ng Google) at GitHub Pages, kaya walang CPU % na mababasa dito. Ang sinusukat ay ang bilis ng database mula sa device na ito. Para sa kabuuang usage (reads/writes kada araw, free-tier quota), tingnan ang Firebase Console → Firestore → Usage.</p></div>`;
  clearTimeout(shTimer); shTimer = setTimeout(() => { const v = document.getElementById('view-admin-syshealth'); if (v && v.style.display !== 'none') loadSysHealth(); }, 60000);
}
function shInitMenu() { const m = document.getElementById('menu-syshealth'); if (!m) return; if (shIsAdmin()) { m.style.display = ''; const m2 = document.getElementById('menu-sessions'); if (m2) m2.style.display = ''; } else if (!window.__shTry || window.__shTry < 20) { window.__shTry = (window.__shTry || 0) + 1; setTimeout(shInitMenu, 1000); } }
window.addEventListener('load', () => setTimeout(shInitMenu, 800));
// ================= Presence / Remote Logout / Online status =================
// presence/{email}: heartbeat tuwing 3 min habang bukas ang app. session_control/{email|_all}: {logoutAt} mula sa Admin — kapag mas bago kaysa login ng user, awtomatiko siyang ma-logout.
function presBeat() { try { const u = getCurrentUser(); if (!u || !u.email || typeof db === 'undefined' || !db || document.visibilityState === 'hidden') return; db.collection('presence').doc(String(u.email).toLowerCase()).set({ email: String(u.email).toLowerCase(), name: u.name || '', role: u.role || '', branch: u.branch || '', page: (location.pathname.split('/').pop() || ''), lastSeen: firebase.firestore.FieldValue.serverTimestamp() }, { merge: true }).catch(() => {}); } catch (e) {} }
function sessForceOut() {
  if (window.__sessOut) return; window.__sessOut = true;
  try { localStorage.removeItem('kerp_login_at'); } catch (e) {}
  try { uiAlert('🚪 Na-logout ka ng Admin. Mag-login ulit kung kailangan.'); } catch (e) {}
  setTimeout(() => logoutUser(), 1800); // hindi na naghihintay ng click sa OK — siguradong lalabas
}
function sessStart() {
  const u = getCurrentUser(); if (!u || !u.email || typeof db === 'undefined' || !db || window.__sessOn) return; window.__sessOn = true;
  try { if (!localStorage.getItem('kerp_login_at')) localStorage.setItem('kerp_login_at', String(Date.now())); } catch (e) {}
  presBeat(); setInterval(presBeat, 180000); document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') presBeat(); });
  // Per-tab at server-oras lang: ang "baseline" ay ang pinakahuling logout na umiiral na pagbukas ng tab na ito. Anumang MAS BAGONG logoutAt = i-logout ang tab na ito.
  // (Hindi na umaasa sa localStorage o sa oras ng PC, kaya gumagana kahit split-screen/maraming tab.)
  window.__sessDbg = { watching: [], hits: [] };
  const watch = id => {
    let base = null; const ref = db.collection('session_control').doc(id); const dbg = { id, base: null, last: null, via: '' }; window.__sessDbg.watching.push(dbg);
    const check = (snap, via) => {
      const t = snap && snap.exists ? snap.data().logoutAt : null, ms = t && t.toMillis ? t.toMillis() : 0; dbg.last = ms; dbg.via = via;
      if (base === null) { if (snap && snap.metadata && snap.metadata.fromCache && !snap.exists) return; base = ms; dbg.base = base; return; }
      if (ms && ms > base) { window.__sessDbg.hits.push({ id, ms, base }); sessForceOut(); }
    };
    if (typeof ref.onSnapshot === 'function') ref.onSnapshot(snap => check(snap, 'live'), e => { dbg.err = e.message; });
    setInterval(() => { ref.get().then(snap => check(snap, 'poll')).catch(e => { dbg.err = e.message; }); }, 20000); // pang-backup kung hindi gumana ang live listener
  };
  watch(String(u.email).toLowerCase()); watch('_all');
  try { secGuardStart(); } catch (e) { console.warn('secGuard:', e.message); }
}
window.addEventListener('load', () => { let n = 0; const t = setInterval(() => { n++; if (typeof db !== 'undefined' && db && getCurrentUser()) { clearInterval(t); sessStart(); compEnsure(); } else if (n > 20) clearInterval(t); }, 800); });
let sesState = { users: [], pres: {}, q: '', onlyOn: false }, sesTimer = null;
function sesIsOnline(p) { try { const ms = p && p.lastSeen && p.lastSeen.toMillis ? p.lastSeen.toMillis() : 0; return ms && Date.now() - ms < 300000; } catch (e) { return false; } }
function sesAgo(p) { const ms = p && p.lastSeen && p.lastSeen.toMillis ? p.lastSeen.toMillis() : 0; if (!ms) return 'wala pang login record'; const m = Math.round((Date.now() - ms) / 60000); return m < 1 ? 'ngayon lang' : m < 60 ? m + ' min ang nakalipas' : m < 1440 ? Math.round(m / 60) + ' oras ang nakalipas' : Math.round(m / 1440) + ' araw ang nakalipas'; }
async function loadSessions() {
  const root = document.getElementById('sessions-root'); if (!root) return; if (!shIsAdmin()) { root.innerHTML = '<div class="card">Para sa Admin lamang.</div>'; return; }
  try { const [us, ps] = await Promise.all([db.collection('users').get(), db.collection('presence').get()]); sesState.users = []; us.forEach(d => sesState.users.push({ id: d.id, ...d.data() })); sesState.pres = {}; ps.forEach(d => sesState.pres[d.id] = d.data()); } catch (e) { root.innerHTML = `<div class="card" style="color:#dc2626;">Error: ${srchEsc(e.message)}</div>`; return; }
  sesRender(); clearTimeout(sesTimer); sesTimer = setTimeout(() => { const v = document.getElementById('view-admin-sessions'); if (v && v.style.display !== 'none') loadSessions(); }, 30000);
}
function sesRender() {
  const root = document.getElementById('sessions-root'); if (!root) return; const S = sesState, me = String((getCurrentUser() || {}).email || '').toLowerCase();
  const rows = S.users.map(u => ({ u, p: S.pres[String(u.id).toLowerCase()] })).filter(x => (!S.onlyOn || sesIsOnline(x.p)) && (!S.q || smartMatch(S.q, `${x.u.name || ''} ${x.u.email || x.u.id} ${x.u.role || ''} ${x.u.branch || ''}`))).sort((a, b) => (sesIsOnline(b.p) ? 1 : 0) - (sesIsOnline(a.p) ? 1 : 0) || String(a.u.name || a.u.id).localeCompare(String(b.u.name || b.u.id)));
  const on = S.users.filter(u => sesIsOnline(S.pres[String(u.id).toLowerCase()])).length;
  root.innerHTML = `<div class="card" data-notools="1"><div class="card-title"><span>👥 Online / Sessions</span><div style="display:flex;gap:.4rem;"><button class="btn btn-secondary btn-sm" onclick="loadSessions()">🔄 Refresh</button><button class="btn btn-danger btn-sm" onclick="sesLogoutAll()">🚪 I-logout lahat</button></div></div>
    <div style="margin-bottom:.5rem;">🟢 <b>${on}</b> online · ⚪ ${S.users.length - on} offline <small style="color:#94a3b8;">(online = may aktibidad sa huling 5 min)</small></div>
    <div style="display:flex;gap:.5rem;flex-wrap:wrap;margin-bottom:.6rem;"><input type="search" id="ses-q" placeholder="🔎 Hanapin..." value="${srchEsc(S.q)}" oninput="sesState.q=this.value;sesRender();var e=document.getElementById('ses-q');e.focus();e.setSelectionRange(e.value.length,e.value.length)" style="flex:1;min-width:160px;"><label style="display:flex;gap:.3rem;align-items:center;"><input type="checkbox" ${S.onlyOn ? 'checked' : ''} onchange="sesState.onlyOn=this.checked;sesRender()" style="width:auto;"> Online lang</label></div>
    <div class="table-responsive"><table><thead><tr><th>User</th><th>Role / Branch</th><th>Status</th><th></th></tr></thead><tbody>${rows.map(x => { const o = sesIsOnline(x.p), em = String(x.u.email || x.u.id).toLowerCase(); return `<tr><td><b>${srchEsc(x.u.name || em)}</b><br><small style="color:#64748b;">${srchEsc(em)}</small></td><td>${srchEsc(x.u.role || '')}${x.u.branch ? '<br><small>' + srchEsc(x.u.branch) + '</small>' : ''}</td><td>${o ? '<span style="color:#16a34a;font-weight:700;">🟢 Online</span>' : '<span style="color:#64748b;">⚪ Offline</span>'}<br><small style="color:#94a3b8;">${srchEsc(sesAgo(x.p))}${x.p && x.p.page ? ' · ' + srchEsc(x.p.page) : ''}</small></td><td>${em === me ? '<small style="color:#94a3b8;">ikaw</small>' : `<button class="btn btn-sm btn-secondary" onclick="sesLogout('${srchEsc(em)}')">🚪 Logout</button>`}</td></tr>`; }).join('') || '<tr><td colspan="4" style="text-align:center;color:#94a3b8;">Walang user.</td></tr>'}</tbody></table></div>
    <p style="font-size:.78rem;color:#64748b;">ℹ️ Ang pag-logout ay tumatama sa lahat ng device ng user at agad na gumagana habang bukas ang app niya; kung naka-offline na siya, walang ipapadala kaya hindi siya ma-ki-kick pagbalik niya. Hindi nito binabago ang password.</p></div>`;
}
async function sesFreshPres(email) { try { const d = await db.collection('presence').doc(String(email).toLowerCase()).get(); return d.exists ? d.data() : null; } catch (e) { return sesState.pres[String(email).toLowerCase()] || null; } }
async function sesLogout(email) {
  email = String(email).toLowerCase(); const p = await sesFreshPres(email);
  if (!sesIsOnline(p)) { alert('ℹ️ Naka-offline na si ' + email + ' (' + sesAgo(p) + '), kaya walang logout na ipapadala. Hindi siya mako-kick pagbalik niya.'); return; }
  if (!await uiConfirm(`I-logout si ${email} sa lahat ng device?`)) return;
  try { await db.collection('session_control').doc(email).set({ logoutAt: firebase.firestore.FieldValue.serverTimestamp(), by: (getCurrentUser() || {}).email || '' }); alert('✅ Napadala ang logout.'); } catch (e) { alert('Error: ' + e.message); }
}
async function sesLogoutAll() {
  await loadSessions(); const me = String((getCurrentUser() || {}).email || '').toLowerCase();
  const targets = sesState.users.filter(u => { const em = String(u.email || u.id).toLowerCase(); return em !== me && sesIsOnline(sesState.pres[String(u.id).toLowerCase()]); });
  if (!targets.length) { alert('ℹ️ Walang ibang online na user na ila-logout (hindi kasama ang sarili mo).'); return; }
  if (!await uiConfirm(`I-logout ang ${targets.length} online na user (kasama ang ibang admin, hindi ikaw)? Ang mga naka-offline ay hindi ginagalaw.`)) return;
  try { for (const u of targets) await db.collection('session_control').doc(String(u.email || u.id).toLowerCase()).set({ logoutAt: firebase.firestore.FieldValue.serverTimestamp(), by: me }); alert('✅ Napadala ang logout sa ' + targets.length + ' user.'); } catch (e) { alert('Error: ' + e.message); }
}

// ================= Company header (resibo at reports) =================
async function compEnsure() {
  if (window.__compCache) return window.__compCache; const c = { companies: {}, branchCo: {} };
  try { (await db.collection('companies').get()).forEach(d => { const x = d.data(); c.companies[String(x.name || d.id)] = x; }); (await db.collection('inventory_branches').get()).forEach(d => { const x = d.data(); if (x.company) { if (x.branch) c.branchCo[hubKey(x.branch)] = x.company; if (x.code) c.branchCo[hubKey(x.code)] = x.company; } }); } catch (e) {}
  window.__compCache = c; return c;
}
function compFind(name) { const c = window.__compCache; if (!c || !name) return null; if (c.companies[name]) return c.companies[name]; const k = Object.keys(c.companies).find(x => x.toLowerCase() === String(name).toLowerCase()); return k ? c.companies[k] : null; }
function compForBranch(b) { const c = window.__compCache; return c && b ? (c.branchCo[hubKey(b)] || '') : ''; }
function compForUser() { const u = getCurrentUser() || {}; return u.company || compForBranch(u.branch) || ''; }
function compLines(name) { const co = compFind(name); const legal = (co && (co.legalName || co.name)) || name || ''; const l2 = co ? [co.address, [co.tin ? 'TIN: ' + co.tin : '', co.phone ? 'Tel: ' + co.phone : '', co.email || ''].filter(Boolean).join(' · ')].filter(Boolean) : []; return { legal, l2 }; }
function compHeaderHtml(name) { if (!name) return ''; const x = compLines(name); return `<div class="comp-hdr" style="text-align:center;margin-bottom:12px;border-bottom:2px solid #0f172a;padding-bottom:8px;"><div style="font-size:19px;font-weight:800;letter-spacing:.3px;">${srchEsc(x.legal)}</div>${x.l2.map(t => `<div style="font-size:11px;color:#334155;">${srchEsc(t)}</div>`).join('')}</div>`; }
function compReceiptHdr(o) { const u = getCurrentUser() || {}; const name = o.company || o.companyName || compForBranch(o.branchName || o.branch) || compForUser(); if (!name) return `<h2>${srchEsc((window.__brandName) || 'KUSINA ERP')}</h2>`; const x = compLines(name); return `<h2>${srchEsc(x.legal)}</h2>${x.l2.map(t => `<div class="c" style="font-size:10px;">${srchEsc(t)}</div>`).join('')}`; }

// ================= Order Board (Jira-style) =================
const ORD_COLS = [['Pending', '🕒 Pending', '#d97706'], ['Preparing', '🍳 Preparing', '#2563eb'], ['Dispatched', '🚚 Dispatched', '#7c3aed'], ['Completed', '✅ Completed', '#16a34a'], ['Cancelled', '🚫 Cancelled', '#94a3b8']];
let ordBoard = { list: [], q: '', showDone: false };
function ordStage(s) { s = String(s || ''); if (/cancel/i.test(s)) return 'Cancelled'; if (/dispatched|en route/i.test(s)) return 'Dispatched'; if (/completed|closed|received/i.test(s)) return 'Completed'; if (/preparing|packed|pahabol|stations/i.test(s)) return 'Preparing'; return 'Pending'; }
function ordCanMove() { const r = normalizeRole((getCurrentUser() || {}).role); return r === 'commissary' || r === 'admin'; }
async function loadOrderBoard() {
  const root = document.getElementById('ordboard-root'); if (!root || !db) return; root.innerHTML = '<div class="card">Kinukuha ang mga order...</div>';
  try { const u = getCurrentUser() || {}, role = normalizeRole(u.role); let snap;
    if (role === 'branch') snap = await db.collection('orders').where('branchName', '==', u.branch || u.name || '').limit(150).get(); else snap = await db.collection('orders').orderBy('createdAt', 'desc').limit(150).get();
    ordBoard.list = []; snap.forEach(d => ordBoard.list.push({ id: d.id, ...d.data() })); ordBoard.list.sort((a, b) => ((b.createdAt && b.createdAt.seconds) || 0) - ((a.createdAt && a.createdAt.seconds) || 0));
    if (role !== 'branch') { currentOrders = ordBoard.list; } await compEnsure(); ordBoardRender(); } catch (e) { root.innerHTML = `<div class="card" style="color:#dc2626;">Error: ${srchEsc(e.message)}</div>`; }
}
function ordBoardRender() {
  const root = document.getElementById('ordboard-root'); if (!root) return; const S = ordBoard, mv = ordCanMove();
  const list = S.list.filter(o => !S.q || smartMatch(S.q, `${o.orderId || o.id} ${o.branchName || ''} ${o.customerName || ''} ${o.status || ''} ${o.siNumber || ''}`));
  const cols = ORD_COLS.filter(c => S.showDone || c[0] !== 'Cancelled');
  const dt = o => { const t = o.createdAt && (o.createdAt.toDate ? o.createdAt.toDate() : o.createdAt.seconds ? new Date(o.createdAt.seconds * 1000) : null); return t ? t.toLocaleDateString('en-PH') : ''; };
  root.innerHTML = `<div class="card" data-notools="1"><div class="card-title"><span>📦 Order Board — status ng mga order</span><button class="btn btn-secondary btn-sm" onclick="loadOrderBoard()">🔄 Refresh</button></div>
    <div style="display:flex;gap:.5rem;flex-wrap:wrap;margin-bottom:.6rem;align-items:center;"><input type="search" id="ob-q" placeholder="🔎 Hanapin (PO, branch, SI)..." value="${srchEsc(S.q)}" oninput="ordBoard.q=this.value;ordBoardRender();var e=document.getElementById('ob-q');e.focus();e.setSelectionRange(e.value.length,e.value.length)" style="flex:1;min-width:160px;"><label style="display:flex;gap:.3rem;align-items:center;"><input type="checkbox" ${S.showDone ? 'checked' : ''} onchange="ordBoard.showDone=this.checked;ordBoardRender()" style="width:auto;"> Isama ang cancelled</label></div>
    ${mv ? '<div style="font-size:.78rem;color:#64748b;margin-bottom:.4rem;">💡 I-drag ang card: Pending → Preparing (tatanggapin ang order) at Preparing → Dispatched (bubukas ang details para sa SI/PO). Sa cellphone, gamitin ang mga button sa card.</div>' : ''}
    <div style="display:flex;gap:.6rem;overflow-x:auto;align-items:flex-start;padding-bottom:.5rem;">${cols.map(c => { const items = list.filter(o => ordStage(o.status) === c[0]); return `<div ondragover="event.preventDefault()" ondrop="ordDrop(event,'${c[0]}')" style="min-width:230px;max-width:250px;flex:1;background:#f1f5f9;border-radius:.5rem;padding:.5rem;border-top:3px solid ${c[2]};"><div style="font-weight:700;margin-bottom:.4rem;">${c[1]} <small>${items.length}</small></div>${items.map(o => `<div ${mv ? `draggable="true" ondragstart="event.dataTransfer.setData('text/plain','${srchEsc(o.id)}')"` : ''} style="background:#fff;border-radius:.4rem;padding:.55rem;margin-bottom:.45rem;box-shadow:0 1px 2px rgba(0,0,0,.12);${mv ? 'cursor:grab;' : ''}"><div onclick="ordBoardOpen('${srchEsc(o.id)}')" style="cursor:pointer;"><small style="color:#64748b;">${srchEsc(o.orderId || o.id)} · ${srchEsc(dt(o))}</small><div style="font-weight:700;margin:.15rem 0;">${srchEsc(o.branchName || o.customerName || '')}</div><div style="font-size:.8rem;color:#475569;">${(o.items || []).length} item · ${money(o.totalAmount || 0)}</div>${o.targetDeliveryDate ? `<div style="font-size:.75rem;color:#64748b;">🗓️ ${srchEsc(o.targetDeliveryDate)}</div>` : ''}<div style="font-size:.7rem;color:#94a3b8;margin-top:.2rem;">${srchEsc(o.status || '')}</div></div>${mv ? `<div style="display:flex;gap:.3rem;margin-top:.4rem;flex-wrap:wrap;">${c[0] === 'Pending' ? `<button class="btn btn-primary btn-sm" onclick="ordMoveTo('${srchEsc(o.id)}','Preparing')">▶️ Simulan</button>` : ''}${c[0] === 'Preparing' ? `<button class="btn btn-primary btn-sm" onclick="ordMoveTo('${srchEsc(o.id)}','Dispatched')">🚚 Dispatch</button>` : ''}<button class="btn btn-secondary btn-sm" onclick="ordMoveTo('${srchEsc(o.id)}','open')">👁️</button></div>` : ''}</div>`).join('') || '<small style="color:#94a3b8;">—</small>'}</div>`; }).join('')}</div></div>`;
}
function ordBoardOpen(id) {
  const o = ordBoard.list.find(x => x.id === id); if (!o) return; if (ordCanMove()) { ordMoveTo(id, 'open'); return; }
  arModal(`<h3>📦 ${srchEsc(o.orderId || o.id)}</h3><div style="font-size:.9rem;line-height:1.7;"><b>Status:</b> ${srchEsc(o.status || '')}<br><b>Delivery:</b> ${srchEsc(o.targetDeliveryDate || 'ASAP')}<br>${o.siNumber ? `<b>SI:</b> ${srchEsc(o.siNumber)}<br>` : ''}${o.poNumber ? `<b>PO:</b> ${srchEsc(o.poNumber)}<br>` : ''}<b>Items:</b> ${(o.items || []).length} · <b>Total:</b> ${money(o.totalAmount || 0)}<br><b>Bayad:</b> ${srchEsc(o.paymentStatus || 'Unpaid')}</div><div style="max-height:30vh;overflow:auto;margin-top:.5rem;"><table data-notools="1"><tbody>${(o.items || []).map(i => `<tr><td>${srchEsc(i.itemName || i.itemCode)}</td><td style="text-align:right;">${[i.wholeQty ? i.wholeQty + ' ' + srchEsc(i.wholeUOM || '') : '', i.looseQty ? i.looseQty + ' ' + srchEsc(i.looseUOM || '') : ''].filter(Boolean).join(' + ')}</td></tr>`).join('')}</tbody></table></div><div style="margin-top:.6rem;"><button class="btn btn-secondary" onclick="arCloseModal();ordReceiptPreview('${srchEsc(o.id)}')">🧾 Resibo</button></div>`);
}
async function ordMoveTo(id, to) {
  const o = ordBoard.list.find(x => x.id === id); if (!o || !ordCanMove()) return; if (!currentOrders.find(x => x.id === id)) currentOrders.push(o); const from = ordStage(o.status);
  if (to === 'open') { openCommissaryOrderModal(id); return; }
  if (from === 'Pending' && to === 'Preparing') { activeCommissaryOrderId = id; await commissaryTakeOrder(); await loadOrderBoard(); return; }
  if (from === 'Preparing' && to === 'Dispatched') { openCommissaryOrderModal(id); alert('Ilagay ang SI/PO number at pindutin ang Dispatch sa bubukas na window.'); return; }
  alert('Hindi puwedeng ilipat dito. Ang takbo: Pending → Preparing → Dispatched. Ang branch ang magko-complete sa pag-receive ng delivery.');
}
function ordDrop(ev, stage) { ev.preventDefault(); const id = ev.dataTransfer.getData('text/plain'); if (!id) return; const o = ordBoard.list.find(x => x.id === id); if (!o || ordStage(o.status) === stage) return; ordMoveTo(id, stage); }
function reqDrop(ev, to) { ev.preventDefault(); const id = ev.dataTransfer.getData('text/plain'); const r = id && reqRowById(id); if (!r || r.status === to) return; reqMove(id, to); }
async function loadMemos() {
  const root = document.getElementById('memo-root'); if (!root || !db) return;
  try {
    const m = await db.collection('memos').get(); memoState.list = []; m.forEach(d => memoState.list.push({ id: d.id, ...d.data() })); memoState.list.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
    const a = await db.collection('memo_acks').get(); memoState.acks = {}; a.forEach(d => { const x = d.data(); (memoState.acks[x.memoId] = memoState.acks[x.memoId] || {})[x.email] = x; });
    const u = await db.collection('users').get(); memoState.users = []; u.forEach(d => { const x = d.data(); if ((x.status || '') === 'active') memoState.users.push({ email: d.id, name: x.name || d.id, branch: x.branch || '' }); });
    memoState.views = {}; try { (await db.collection('memo_views').get()).forEach(d => { const x = d.data(); (memoState.views[x.memoId] = memoState.views[x.memoId] || {})[x.email] = x; }); } catch (e) {}
    memoState.pres = {}; try { (await db.collection('presence').get()).forEach(d => { memoState.pres[d.id] = d.data(); }); } catch (e) {}
    memoRender();
  } catch (e) { root.innerHTML = `<div class="card" style="color:#dc2626;">Error: ${srchEsc(e.message)}</div>`; }
}
function memoRender() {
  const root = document.getElementById('memo-root'), S = memoState; const branches = [...new Set(S.users.map(u => u.branch).filter(Boolean))].sort();
  root.innerHTML = `<div class="card"><div class="card-title"><span>📢 Memo / Announcement</span></div>
    <div style="border:1px solid #e2e8f0;border-radius:.5rem;padding:.8rem;margin-bottom:1rem;"><h4 style="margin-top:0;">✍️ Bagong memo</h4>
      <div class="form-group"><label>Pamagat</label><input type="text" id="memo-title" style="width:100%;"></div>
      <div class="form-group"><label>Nilalaman</label><textarea id="memo-body" rows="5" style="width:100%;"></textarea></div>
      <div class="form-group"><label>Para kanino</label><select id="memo-aud" onchange="memoAudChange()"><option value="all">Lahat ng active na user (${S.users.length})</option><option value="branch">Piling branch / hub</option><option value="emails">Piling tao (email)</option></select>
        <div id="memo-aud-branch" style="display:none;margin-top:.4rem;">${branches.map(b => `<label style="display:inline-block;margin-right:.8rem;"><input type="checkbox" class="memo-br" value="${srchEsc(b)}"> ${srchEsc(b)}</label>`).join('') || '<small>Walang branch sa users.</small>'}</div>
        <textarea id="memo-aud-emails" rows="2" style="display:none;width:100%;margin-top:.4rem;" placeholder="email1@..., email2@..."></textarea></div>
      <div class="form-group"><label>📷 Larawan / poster (optional)</label><input type="file" id="memo-img" accept="image/*"></div>
      <button class="btn btn-success" onclick="memoPost()">📢 I-post at i-notify</button></div>
    <h4>Mga na-post</h4><div class="table-responsive"><table data-notools="1"><thead><tr><th>Petsa</th><th>Pamagat</th><th>Para kanino</th><th>Acknowledged</th><th></th></tr></thead><tbody>${S.list.map(m => { const n = (m.recipients || []).length, k = Object.keys(S.acks[m.id] || {}).filter(e => (m.recipients || []).includes(e)).length; return `<tr><td>${srchEsc(String(m.createdAt).slice(0, 10))}</td><td><b>${srchEsc(m.title)}</b><br><small>${srchEsc(m.createdBy || '')}</small></td><td>${srchEsc(m.audienceLabel || '')}</td><td><b style="color:${k === n ? '#059669' : '#d97706'};">${k} / ${n}</b></td><td style="white-space:nowrap;"><button class="btn btn-sm btn-secondary" onclick="memoDetail('${m.id}')">👁️ Detalye</button></td></tr>`; }).join('') || '<tr><td colspan="5" style="color:#94a3b8;">Wala pang memo.</td></tr>'}</tbody></table></div></div>`;
}
function memoAudChange() { const v = document.getElementById('memo-aud').value; document.getElementById('memo-aud-branch').style.display = v === 'branch' ? 'block' : 'none'; document.getElementById('memo-aud-emails').style.display = v === 'emails' ? 'block' : 'none'; }
async function memoPost() {
  const me = getCurrentUser() || {}; const title = (document.getElementById('memo-title').value || '').trim(), body = (document.getElementById('memo-body').value || '').trim(); if (!title || !body) { alert('Ilagay ang pamagat at nilalaman.'); return; }
  const aud = document.getElementById('memo-aud').value; let rec = [], label = 'Lahat';
  if (aud === 'all') rec = memoState.users.map(u => u.email);
  else if (aud === 'branch') { const bs = [...document.querySelectorAll('.memo-br:checked')].map(x => x.value); if (!bs.length) { alert('Pumili ng kahit isang branch.'); return; } rec = memoState.users.filter(u => bs.includes(u.branch)).map(u => u.email); label = bs.join(', '); }
  else { rec = String(document.getElementById('memo-aud-emails').value || '').split(/[,;\s]+/).map(x => x.trim().toLowerCase()).filter(x => x.includes('@')); label = 'Piling tao'; }
  rec = [...new Set(rec.map(x => String(x).toLowerCase()))]; if (!rec.length) { alert('Walang makakatanggap.'); return; }
  if (!await uiConfirm(`I-post ang memo sa ${rec.length} tao?`)) return;
  try {
    const f = (document.getElementById('memo-img') || {}).files; const image = f && f[0] ? await compressImageFile(f[0], 1100, 0.7) : '';
    const id = 'MEMO-' + Date.now().toString(36).toUpperCase(); const now = new Date().toISOString();
    await db.collection('memos').doc(id).set({ title, body, image, audience: aud, audienceLabel: label, recipients: rec, createdBy: me.name || me.email, createdByEmail: String(me.email || '').toLowerCase(), createdAt: now });
    notify(rec, `📢 Memo: ${title}`, `${me.name || ''} ay nag-post ng memo. Buksan ang app at i-acknowledge (🔔).`);
    try { logSystemAction('MEMO_POSTED', `${id}: ${title} → ${rec.length}`); } catch (e) {}
    alert('✅ Na-post at na-notify ang ' + rec.length + ' tao.'); loadMemos();
  } catch (e) { alert('Error: ' + e.message); }
}
function memoDetail(id) {
  const m = memoState.list.find(x => x.id === id); if (!m) return; const ak = memoState.acks[id] || {}, vw = (memoState.views || {})[id] || {}, pr = memoState.pres || {}; const nameOf = e => (memoState.users.find(u => u.email === e) || {}).name || e; const rc = m.recipients || [];
  const lastSeen = e => { const p = pr[e]; if (!p || !p.lastSeen) return '<span style="color:#dc2626;">hindi pa nakaka-login</span>'; try { return 'huling online ' + (typeof sesAgo === 'function' ? sesAgo(p) : ''); } catch (x) { return ''; } };
  const done = rc.filter(e => ak[e]), seen = rc.filter(e => !ak[e] && vw[e]), none = rc.filter(e => !ak[e] && !vw[e]);
  const t = x => srchEsc(String(x || '').slice(0, 16).replace('T', ' '));
  arModal(`<h3>${srchEsc(m.title)}</h3><div style="white-space:pre-wrap;margin-bottom:.6rem;">${srchEsc(m.body)}</div>${m.image ? `<img src="${m.image}" style="max-width:100%;border-radius:.4rem;">` : ''}
    <div style="display:flex;gap:.6rem;flex-wrap:wrap;font-size:.85rem;margin:.6rem 0;"><span>👥 ${rc.length} tatanggap</span><span style="color:#16a34a;">✅ ${done.length} nag-acknowledge</span><span style="color:#d97706;">👁 ${seen.length} nabasa pero hindi pa nag-acknowledge</span><span style="color:#dc2626;">🚫 ${none.length} hindi pa nabubuksan</span></div>
    <h4>✅ Nag-acknowledge (${done.length})</h4><div style="max-height:130px;overflow:auto;font-size:.85rem;">${done.map(e => `${srchEsc(nameOf(e))} <small style="color:#64748b;">${t(ak[e].at)}</small>`).join('<br>') || '—'}</div>
    <h4>👁 Nabasa na, hindi pa nag-acknowledge (${seen.length})</h4><div style="max-height:130px;overflow:auto;font-size:.85rem;">${seen.map(e => `${srchEsc(nameOf(e))} <small style="color:#64748b;">binuksan ${t(vw[e].firstAt)}</small>`).join('<br>') || '—'}</div>
    <h4>🚫 Hindi pa nabubuksan (${none.length})</h4><div style="max-height:150px;overflow:auto;font-size:.85rem;">${none.map(e => `${srchEsc(nameOf(e))} <small style="color:#64748b;">${lastSeen(e)}</small>`).join('<br>') || '—'}</div>
    <div style="margin-top:.6rem;display:flex;gap:.4rem;flex-wrap:wrap;"><button class="btn btn-secondary btn-sm" onclick="memoRemind('${id}')">🔔 Paalalahanan ang lahat ng hindi pa nag-acknowledge</button><button class="btn btn-secondary btn-sm" onclick="memoRemind('${id}', 'unseen')">🔔 Hindi pa nabubuksan lang</button><button class="btn btn-secondary btn-sm" onclick="memoCSV('${id}')">📤 CSV</button></div>`);
}
// Itinatala kapag lumabas sa empleyado ang memo (unang beses lang)
async function memoMarkSeen(list) {
  const u = getCurrentUser() || {}, em = String(u.email || '').toLowerCase(); if (!em || !db) return;
  for (const m of (list || [])) { const key = m.id + '__' + em; try { if (sessionStorage.getItem('mv_' + key)) continue; sessionStorage.setItem('mv_' + key, '1'); const ref = db.collection('memo_views').doc(key), d = await ref.get(); if (!d.exists) await ref.set({ memoId: m.id, email: em, name: u.name || em, firstAt: new Date().toISOString() }); } catch (e) {} }
}
function memoRemind(id, only) { const m = memoState.list.find(x => x.id === id); const ak = memoState.acks[id] || {}, vw = (memoState.views || {})[id] || {}; const p = (m.recipients || []).filter(e => !ak[e] && (only !== 'unseen' || !vw[e])); if (!p.length) { alert(only === 'unseen' ? 'Lahat ay nabuksan na.' : 'Lahat ay na-acknowledge na.'); return; } notify(p, `⏰ Paalala: Memo — ${m.title}`, 'Pakibasa at i-acknowledge ang memo sa 🔔.'); alert('Naipadala ang paalala sa ' + p.length + ' tao.'); }
function memoCSV(id) { const m = memoState.list.find(x => x.id === id); const ak = memoState.acks[id] || {}; const vw = (memoState.views || {})[id] || {}; const L = ['Email,Name,Opened,Opened_At,Acknowledged,Acknowledged_At']; (m.recipients || []).forEach(e => L.push([e, (memoState.users.find(u => u.email === e) || {}).name || '', (vw[e] || ak[e]) ? 'Yes' : 'No', vw[e] ? vw[e].firstAt : '', ak[e] ? 'Yes' : 'No', ak[e] ? ak[e].at : ''].map(csvCell).join(','))); downloadCSVFile(L.join('\r\n'), `Memo_${id}_acks.csv`); }
// ---- ttatanggap: pending memos
async function memoPending() {
  const me = String((getCurrentUser() || {}).email || '').toLowerCase(); if (!me) return [];
  const m = await db.collection('memos').where('recipients', 'array-contains', me).get(); const a = await db.collection('memo_acks').where('email', '==', me).get(); const done = new Set(); a.forEach(d => done.add(d.data().memoId));
  const out = []; m.forEach(d => { if (!done.has(d.id)) out.push({ id: d.id, ...d.data() }); }); return out.sort((x, y) => String(y.createdAt).localeCompare(String(x.createdAt)));
}
async function memoAck(id) {
  const cb = document.getElementById('memo-ck-' + id); if (!cb || !cb.checked) { alert('I-check muna ang "Nabasa at naiintindihan ko".'); return; }
  const me = getCurrentUser() || {}; const em = String(me.email || '').toLowerCase();
  try { await db.collection('memo_acks').doc(id + '__' + em).set({ memoId: id, email: em, name: me.name || em, at: new Date().toISOString() }); await openNotifs(); ntfRefresh(); } catch (e) { alert('Error: ' + e.message); }
}

// ========================================================
// 📄 PAGE BOOTSTRAP (dating inline <script> ng bawat HTML — ngayon dito na lahat)
// Ang <body> ng bawat page ay may class: page-admin | page-branch | page-commissary
// ========================================================

// Admin: active menu highlight
function closeDotsMenus() { document.querySelectorAll('.dots-menu').forEach(m => m.style.display = 'none'); document.querySelectorAll('.menu-item.active').forEach(el => el.classList.remove('active')); }
function syncMenuCategories() {
  document.querySelectorAll('.sidebar-menu .menu-category').forEach(cat => { let el = cat.nextElementSibling, any = false; while (el && !el.classList.contains('menu-category')) { if (el.classList.contains('menu-item') && el.style.display !== 'none' && !el.classList.contains('perm-hide')) any = true; el = el.nextElementSibling; } cat.style.display = any ? '' : 'none'; });
}
function setActiveMenu(element) {
  document.querySelectorAll('.menu-item').forEach(el => el.classList.remove('active'));
  element.classList.add('active');
  if (window.innerWidth <= 1024) {
    const sb = document.getElementById('app-sidebar');
    if (sb) sb.classList.remove('open', 'mobile-open');
    document.body.classList.remove('menu-open');
  }
}

// Admin: preview ng napiling logo sa Branding Setup
function previewSelectedLogo(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(e) {
    const preview = document.getElementById('setting-brand-logo-preview');
    if (preview) {
      preview.src = e.target.result;
      preview.style.display = 'inline-block';
    }
    alert('📷 Napili na ang larawan: ' + file.name + '\nPindutin ang "💾 I-save ang Bagong Header" upang mai-upload ito sa system.');
  };
  reader.readAsDataURL(file);
}


// Ikumpara ang role sa localStorage laban sa TOTOONG users document sa Firestore.
// Kapag binago ng user ang role niya sa browser, itatama/ipapalabas siya dito.
function verifyRoleAgainstServer(allowedRoles) {
  if (typeof auth === 'undefined' || !auth || typeof db === 'undefined' || !db) return;
  const allowed = allowedRoles.map(normalizeRole);
  const unsub = auth.onAuthStateChanged(async fbUser => {
    unsub();
    if (!fbUser || !fbUser.email) return; // walang Firebase session: ang Firestore Rules na ang bahala
    try {
      const snap = await db.collection('users').doc(fbUser.email.toLowerCase()).get();
      if (!snap.exists) return;
      const d = snap.data();
      if (d.status !== 'active' || !allowed.includes(normalizeRole(d.role))) {
        alert('Access Denied: Hindi tugma ang iyong account sa pahinang ito.');
        localStorage.removeItem(KERP_AUTH_KEY);
        window.location.href = 'index.html';
        return;
      }
      const local = getCurrentUser();
      if (local && (local.role !== d.role || local.status !== d.status || (d.branch !== undefined && local.branch !== d.branch))) {
        const fixed = Object.assign({}, local, { role: d.role, status: d.status });
        if (d.branch !== undefined) fixed.branch = d.branch;
        setCurrentUser(fixed);
      }
    } catch (e) { console.warn('Role verification skipped:', e.message); }
  });
}

document.addEventListener('DOMContentLoaded', () => {
  const cls = document.body.classList;
  const isAdmin = cls.contains('page-admin');
  const isBranch = cls.contains('page-branch');
  const isComm = cls.contains('page-commissary');
  const isEmp = cls.contains('page-employee');
  if (!isAdmin && !isBranch && !isComm && !isEmp) return; // index.html / ibang page: walang gagawin

  // Toast container para sa lahat ng page (para pare-pareho ang notifications)
  if (!document.getElementById('toast-container')) {
    const tc = document.createElement('div');
    tc.id = 'toast-container';
    document.body.appendChild(tc);
  }

  const callIf = (name) => { if (typeof window[name] === 'function') window[name](); };
  const u = getCurrentUser();
  const setUserLabel = (text) => {
    const el = document.getElementById('user-display');
    if (el) el.innerText = text;
    const el2 = document.getElementById('top-user-display');
    if (el2) el2.innerText = text;
    try { initNotifBell(); } catch (e) {}
  };

  if (isAdmin) {
    // Admin Portal: bukas sa lahat ng role; ang permissions ang magpapasya kung ano ang makikita
    enforceRoleAccess(['admin', 'commissary', 'branch']);
    verifyRoleAgainstServer(['admin', 'commissary', 'branch']);
    const isRealAdmin = u && normalizeRole(u.role) === 'admin';
    if (u) setUserLabel(`${isRealAdmin ? 'Admin' : (normalizeRole(u.role) === 'commissary' ? 'Commissary' : 'Branch')}: ${u.name || u.email}`);
    applyAdminPermissions().then(ok => {
      if (!ok) return;
      const run = () => {
        callIf('loadSystemBranding');
        if (canViewModule('dashboard')) callIf('loadAdminAnalytics');
        callIf('syncUserProfileFromFirestore');
        if (isRealAdmin) setTimeout(() => { try { dbbAutoCheck(); } catch (e) {} }, 12000);
        if (isRealAdmin) setTimeout(() => { try { secAutoSweeps(); } catch (e) {} }, 25000);
      };
      if (document.readyState === 'complete') run(); else window.addEventListener('load', run);
    }).catch(err => {
      console.error('Permissions error:', err);
      document.body.classList.remove('perm-pending');
    });
  } else if (isBranch) {
    enforceRoleAccess(['branch', 'admin']);
    verifyRoleAgainstServer(['branch', 'admin']);
    if (u) setUserLabel(`Branch: ${u.name || u.email}`);
    window.addEventListener('load', () => {
      ['loadSystemBranding', 'loadBranchAnalytics', 'loadBranchDeliveries', 'loadBranchProducts', 'syncUserProfileFromFirestore'].forEach(callIf);
      injectModulesLink();
      applyFeaturePermissions().catch(e => console.warn('Feature permissions skipped:', e.message));
    });
  } else if (isEmp) {
    // Employee Portal: self-service lang (attendance, team attendance, OB/OT/Leave, Loan Ko, HR Docs)
    enforceRoleAccess(['employee']);
    verifyRoleAgainstServer(['employee']);
    if (u) setUserLabel(`${u.name || u.email}`);
    window.addEventListener('load', () => {
      ['loadSystemBranding', 'syncUserProfileFromFirestore'].forEach(callIf);
      try { if (typeof empInit === 'function') empInit(); } catch (e) { console.warn('empInit:', e.message); }
    });
  } else if (isComm) {
    enforceRoleAccess(['commissary', 'admin']);
    verifyRoleAgainstServer(['commissary', 'admin']);
    if (u) setUserLabel(`${u.branch || 'Commissary'}: ${u.name || u.email}`);
    window.addEventListener('load', () => {
      ['loadSystemBranding', 'loadCommissaryAnalytics', 'loadCommissaryInventory', 'loadIncomingOrders', 'syncUserProfileFromFirestore'].forEach(callIf);
      injectModulesLink();
      applyFeaturePermissions().catch(e => console.warn('Feature permissions skipped:', e.message));
    });
  }
});


// Searchable dropdown + Print/CSV buttons sa lahat ng page
document.addEventListener('DOMContentLoaded', () => { try { startSelectEnhancer(); startTableTools(); } catch (e) { console.warn('UI tools skipped:', e.message); } });

// Lagyan ng tooltip ang mga button/filter pagkatapos mag-render ng AR views
(function () { ['arRenderLedger', 'arRenderCustomers', 'arRenderMonthly'].forEach(n => { const f = window[n]; if (typeof f !== 'function') return; window[n] = function () { const r = f.apply(this, arguments); try { arAfterRender(); } catch (e) {} return r; }; }); })();

// ============================================================================
// 💾 FULL DATABASE BACKUP (Firestore) — download, cloud restore points, history, auto-backup schedule
// db_backups/{id} = history (metadata) · db_backup_chunks/{id}__{n} = compressed copy · system_settings/backup_config = schedule
// ============================================================================
const DBB_ALL = ['users','products','product_costs','storage_stations','uom_settings','product_photos','companies','price_history','inventory_snapshots','requests','request_photos','request_counter','sap_items','attendance_profiles','attendance_weeks','attendance_logs','hr_documents','hr_doc_files','memos','memo_views','memo_acks','attendance_photos','leave_balances','team_status','attendance_requests','ar_legacy','ar_accounts','ar_payment_photos','payment_submissions','price_lists','branch_stations','inventory_branches','inventory_items','inventory_counts','inventory_costs','inventory_markouts','inventory_bom','inventory_station_map','inventory_item_requests','commissary_hubs','commissary_team','customers','bom_recipes','product_logs','orders','disputes','stock_movements','spoilage_requests','inventory_lots','assets','vendors','vendor_pos','general_ledger','employees','payrolls','system_settings','acct_accounts','acct_journal','acct_bank_recs','acct_invoices','acct_memos','acct_budgets','acct_recurring','loans','pc_weeks','pc_setup','pc_rates','pc_ratesecure','pc_actual','lst_setup','lst_weeks','lst_bio','activity_logs', 'pos_setup', 'pos_menu', 'pos_floor', 'pos_members', 'pos_clubs', 'pos_stations', 'pos_roster', 'pos_86', 'pos_docs', 'pos_ideal', 'pos_events', 'pos_event_stock', 'pos_counters', 'pos_shifts', 'pos_sales', 'pos_tabs', 'pos_reservations', 'pos_vouchers', 'pos_restore', 'pos_print_agents', 'subscriptions', 'emp_directory', 'login_policy', 'sec_approvals'];
const DBB_PHOTOS = ['product_photos', 'request_photos', 'hr_doc_files', 'attendance_photos', 'ar_payment_photos'];
const dbbState = { busy: false, cfg: null, hist: [], msg: '' };

function dbbEnc(v) {
  if (v === null || v === undefined) return v;
  if (typeof v === 'object') {
    if (typeof v.toDate === 'function' && 'seconds' in v && 'nanoseconds' in v) return { __ts: [v.seconds, v.nanoseconds] };
    if (v instanceof Date) return { __date: v.toISOString() };
    if (Array.isArray(v)) return v.map(dbbEnc);
    if (typeof v.path === 'string' && typeof v.id === 'string' && v.firestore) return { __ref: v.path };
    const o = {}; for (const k of Object.keys(v)) o[k] = dbbEnc(v[k]); return o;
  }
  return v;
}
function dbbDec(v) {
  if (v === null || v === undefined || typeof v !== 'object') return v;
  if (Array.isArray(v)) return v.map(dbbDec);
  if (v.__ts) return new firebase.firestore.Timestamp(v.__ts[0], v.__ts[1]);
  if (v.__date) return new Date(v.__date);
  if (v.__ref) return db.doc(v.__ref);
  const o = {}; for (const k of Object.keys(v)) o[k] = dbbDec(v[k]); return o;
}
function dbbList(withPhotos) { return DBB_ALL.filter(c => withPhotos || !DBB_PHOTOS.includes(c)); }
function dbbSay(m) { dbbState.msg = m; const el = document.getElementById('dbb-status'); if (el) el.textContent = m; }
function dbbBytes(n) { return n > 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB'; }

// Basahin ang buong database -> object
async function dbbCollect(withPhotos, onlyCols) {
  const cols = onlyCols || dbbList(withPhotos); const out = { app: 'KusinaERP', version: 1, createdAt: new Date().toISOString(), photos: !!withPhotos, collections: {}, skipped: [] }; let docs = 0, i = 0;
  for (const c of cols) {
    i++; dbbSay(`Binabasa ang ${c} (${i}/${cols.length})...`);
    try { const s = await db.collection(c).get(); const arr = []; s.forEach(d => arr.push({ id: d.id, data: dbbEnc(d.data()) })); if (arr.length) { out.collections[c] = arr; docs += arr.length; } }
    catch (e) { out.skipped.push(c + ': ' + (e.message || e)); }
  }
  out.docs = docs; return out;
}
async function dbbGzip(str) {
  if (typeof CompressionStream === 'undefined') return { enc: 'raw', text: str };
  const cs = new Blob([str]).stream().pipeThrough(new CompressionStream('gzip')); const buf = new Uint8Array(await new Response(cs).arrayBuffer()); let bin = ''; for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000));
  return { enc: 'gzip64', text: btoa(bin) };
}
async function dbbGunzip(enc, text) {
  if (enc === 'raw') return text;
  const bin = atob(text); const buf = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  return await new Response(new Blob([buf]).stream().pipeThrough(new DecompressionStream('gzip'))).text();
}
function dbbDownloadText(str, name) { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([str], { type: 'application/json' })); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500); }
function dbbStamp(d) { d = d || new Date(); const p = n => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}`; }

// I-save ang compressed copy sa cloud (Firestore) bilang restore point + history
async function dbbSaveCloud(data, trigger, extra) {
  const u = getCurrentUser() || {}; const id = 'DB-' + Date.now(); const json = JSON.stringify(data); const z = await dbbGzip(json); const SZ = z.enc === 'raw' ? 250000 : 600000;
  const meta = { createdAt: new Date().toISOString(), by: u.name || u.email || '', trigger, docs: data.docs || 0, collections: Object.keys(data.collections).length, photos: !!data.photos, sizeBytes: z.text.length, rawBytes: json.length, enc: z.enc, hasCloud: false, skipped: (data.skipped || []).slice(0, 10) };
  Object.assign(meta, extra || {});
  if (z.text.length > 30 * 1024 * 1024) { meta.cloudNote = 'Masyadong malaki para sa cloud (>30MB) — download file lang.'; await db.collection('db_backups').doc(id).set(meta); return { id, meta }; }
  let batch = db.batch(), n = 0, k = 0;
  for (let p = 0; p < z.text.length; p += SZ) { batch.set(db.collection('db_backup_chunks').doc(id + '__' + k), { bk: id, n: k, data: z.text.slice(p, p + SZ) }); k++; if (++n % 10 === 0) { await batch.commit(); batch = db.batch(); } }
  meta.chunks = k; meta.hasCloud = true; batch.set(db.collection('db_backups').doc(id), meta); await batch.commit();
  return { id, meta };
}
async function dbbPrune(keep) {
  keep = Math.max(1, +keep || 4); const s = await db.collection('db_backups').where('hasCloud', '==', true).get(); const all = []; s.forEach(d => all.push({ id: d.id, ...d.data() })); all.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  for (const o of all.slice(keep)) await dbbDropCloud(o.id, true);
}
async function dbbDropCloud(id, silent) {
  const cs = await db.collection('db_backup_chunks').where('bk', '==', id).get(); let b = db.batch(), n = 0; cs.forEach(c => { b.delete(c.ref); if (++n % 400 === 0) { b.commit(); b = db.batch(); } }); await b.commit();
  await db.collection('db_backups').doc(id).set({ hasCloud: false, cloudDroppedAt: new Date().toISOString() }, { merge: true });
  if (!silent) { dbbRender(); }
}
async function dbbLoadCloud(id) {
  const m = await db.collection('db_backups').doc(id).get(); if (!m.exists) throw new Error('Wala na ang restore point.'); const o = m.data();
  const cs = await db.collection('db_backup_chunks').where('bk', '==', id).get(); const parts = []; cs.forEach(d => parts.push(d.data())); parts.sort((a, b) => a.n - b.n);
  if (parts.length !== o.chunks) throw new Error(`Kulang ang copy (${parts.length}/${o.chunks}).`);
  return JSON.parse(await dbbGunzip(o.enc, parts.map(p => p.data).join('')));
}

// ---- Manual backup (download + optional cloud) ----
async function dbbManual() {
  if (dbbState.busy) return; const withPhotos = !!(document.getElementById('dbb-photos') || {}).checked, toCloud = !!(document.getElementById('dbb-cloud') || {}).checked;
  dbbState.busy = true; dbbBtns(true);
  try {
    const data = await dbbCollect(withPhotos); dbbSay('Ginagawa ang file...');
    dbbDownloadText(JSON.stringify(data), `KusinaERP_DB_Backup_${dbbStamp()}.json`);
    if (toCloud) { dbbSay('Sine-save sa cloud...'); const r = await dbbSaveCloud(data, 'manual', { downloaded: true }); await dbbPrune((dbbState.cfg || {}).keep); } else { await db.collection('db_backups').doc('DB-' + Date.now()).set({ createdAt: new Date().toISOString(), by: (getCurrentUser() || {}).name || '', trigger: 'manual', docs: data.docs, collections: Object.keys(data.collections).length, photos: withPhotos, sizeBytes: 0, hasCloud: false, downloaded: true, skipped: data.skipped.slice(0, 10) }); }
    try { await logSystemAction('DB_BACKUP', `Manual: ${data.docs} docs${toCloud ? ' (cloud)' : ''}`); } catch (e) {}
    dbbSay(`✅ Tapos: ${data.docs} dokumento, ${Object.keys(data.collections).length} collection.` + (data.skipped.length ? ` ⚠️ ${data.skipped.length} ang hindi nabasa.` : ''));
  } catch (e) { dbbSay('❌ ' + e.message); alert('Hindi natapos ang backup: ' + e.message); }
  dbbState.busy = false; dbbBtns(false); dbbRender(true);
}
function dbbBtns(dis) { document.querySelectorAll('#dbb-root button').forEach(b => { if (!b.dataset.keep) b.disabled = dis; }); }

// ---- Restore ----
function dbbRestoreFile() {
  const f = document.createElement('input'); f.type = 'file'; f.accept = '.json,application/json';
  f.onchange = async () => { if (!f.files.length) return; try { const data = JSON.parse(await f.files[0].text()); if (data.app !== 'KusinaERP' || !data.collections) throw new Error('Hindi ito KusinaERP backup file.'); dbbRestorePick(data, f.files[0].name); } catch (e) { alert('Hindi mabasa ang file: ' + e.message); } }; f.click();
}
async function dbbRestoreCloud(id) {
  if (dbbState.busy) return; dbbState.busy = true; dbbBtns(true);
  try { dbbSay('Kinukuha ang restore point...'); const data = await dbbLoadCloud(id); dbbSay(''); dbbState.busy = false; dbbBtns(false); dbbRestorePick(data, id); }
  catch (e) { dbbState.busy = false; dbbBtns(false); alert('Error: ' + e.message); }
}
function dbbRestorePick(data, label) {
  window._dbbData = data; const cols = Object.keys(data.collections);
  const rows = cols.map(c => `<label style="display:inline-block;width:240px;font-size:.82rem;"><input type="checkbox" class="dbb-col" value="${srchEsc(c)}" ${c === 'users' ? '' : 'checked'}> ${srchEsc(c)} <small style="color:#64748b;">(${data.collections[c].length})</small></label>`).join('');
  arModal(`<h3>↩️ Restore — ${srchEsc(String(label))}</h3><p style="font-size:.85rem;color:#64748b;">Backup noong <b>${srchEsc(new Date(data.createdAt).toLocaleString())}</b> · ${data.docs} dokumento · ${cols.length} collection. Piliin kung ano ang ibabalik.</p>
    <div style="max-height:34vh;overflow:auto;border:1px solid #e2e8f0;border-radius:.4rem;padding:.4rem;">${rows}</div>
    <p style="font-size:.78rem;color:#b45309;">⚠️ Ang <b>users</b> ay naka-uncheck bilang default (para hindi magbago ang mga role/pag-login ngayon).</p>
    <div class="form-group"><label><input type="radio" name="dbb-mode" value="over" checked> <b>Ipatong lang</b> — ibalik/i-overwrite ang mga dokumento sa backup. Hindi binubura ang mga bagong dokumento.</label><br>
      <label><input type="radio" name="dbb-mode" value="full"> <b>Buong rollback</b> — burahin din ang mga dokumentong wala sa backup (sa mga napiling collection lang).</label></div>
    <div class="form-group"><label>I-type ang <b>RESTORE</b> para magpatuloy</label><input type="text" id="dbb-confirm" autocomplete="off"></div>
    <p style="font-size:.78rem;color:#64748b;">Awtomatikong gagawa muna ng bagong restore point ng kasalukuyang database bago mag-restore.</p>
    <button class="btn btn-danger" onclick="dbbRestoreRun(this)">↩️ Simulan ang Restore</button> <button class="btn btn-secondary" onclick="arCloseModal()">Kanselahin</button>`);
}
async function dbbRestoreRun(btn) {
  if (dbbState.busy) return; if ((document.getElementById('dbb-confirm') || {}).value !== 'RESTORE') { alert('I-type ang RESTORE (all caps) para magpatuloy.'); return; }
  const data = window._dbbData; const picks = [...document.querySelectorAll('.dbb-col:checked')].map(c => c.value); if (!picks.length) { alert('Pumili ng kahit isang collection.'); return; }
  if (!(await secNeed4('db_restore', 'Database Restore (' + picks.length + ' collection)'))) return;
  const full = (document.querySelector('input[name="dbb-mode"]:checked') || {}).value === 'full';
  dbbState.busy = true; if (btn) { btn.disabled = true; btn.textContent = '⏳ Nagre-restore...'; }
  try {
    dbbSay('Gumagawa ng safety backup ng kasalukuyan...'); const cur = await dbbCollect(true, picks); await dbbSaveCloud(cur, 'pre-restore', { note: 'Bago mag-restore ng ' + new Date(data.createdAt).toLocaleDateString() });
    let w = 0, del = 0, b = db.batch(), n = 0; const flush = async () => { await b.commit(); b = db.batch(); };
    for (const c of picks) {
      dbbSay(`Ibinabalik ang ${c}...`); const arr = data.collections[c] || []; const keep = new Set(arr.map(x => x.id));
      for (const x of arr) { b.set(db.collection(c).doc(x.id), dbbDec(x.data)); w++; if (++n % 400 === 0) await flush(); }
      if (full) { const ex = await db.collection(c).get(); for (const d of ex.docs || (() => { const a = []; ex.forEach(z => a.push(z)); return a; })()) { if (!keep.has(d.id)) { b.delete(d.ref); del++; if (++n % 400 === 0) await flush(); } } }
    }
    await b.commit(); try { await logSystemAction('DB_RESTORE', `${w} docs ibinalik, ${del} binura (${picks.length} collection, backup ${data.createdAt})`); } catch (e) {}
    arCloseModal(); dbbSay(`✅ Na-restore: ${w} dokumento${full ? `, ${del} ang binura` : ''}.`); alert(`✅ Tapos ang restore: ${w} dokumento ibinalik${full ? `, ${del} binura` : ''}. I-refresh ang page (Ctrl+F5).`);
  } catch (e) { dbbSay('❌ ' + e.message); alert('Hindi natapos ang restore: ' + e.message); }
  dbbState.busy = false; dbbRender(true);
}
async function dbbDownloadCloud(id) { try { dbbSay('Kinukuha...'); const d = await dbbLoadCloud(id); dbbDownloadText(JSON.stringify(d), `KusinaERP_DB_Backup_${dbbStamp(new Date(d.createdAt))}.json`); dbbSay('✅ Na-download.'); } catch (e) { alert('Error: ' + e.message); } }
async function dbbDropAsk(id) { if (await uiConfirm('Burahin ang cloud copy ng restore point na ito? (Mananatili ang history.)')) { try { await dbbDropCloud(id); } catch (e) { alert('Error: ' + e.message); } } }

// ---- Schedule / auto-backup ----
function dbbIso(d) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
// Ang pinakabagong scheduled na petsa na lampas na o ngayon (key)
function dbbDueKey(cfg, now) {
  now = now || new Date(); const t = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (cfg.freq === 'daily') return dbbIso(t);
  if (cfg.freq === 'monthly') { const dom = Math.min(28, Math.max(1, +cfg.dom || 1)); let d = new Date(t.getFullYear(), t.getMonth(), dom); if (d > t) d = new Date(t.getFullYear(), t.getMonth() - 1, dom); return dbbIso(d); }
  const dow = +cfg.dow >= 0 ? +cfg.dow : 0; const diff = (t.getDay() - dow + 7) % 7; return dbbIso(new Date(t.getFullYear(), t.getMonth(), t.getDate() - diff));
}
async function dbbLoadCfg() { const d = await db.collection('system_settings').doc('backup_config').get(); dbbState.cfg = Object.assign({ enabled: false, freq: 'weekly', dow: 0, dom: 1, keep: 4, includePhotos: false }, d.exists ? d.data() : {}); return dbbState.cfg; }
async function dbbSaveCfg() {
  const g = id => document.getElementById(id); const prev = dbbState.cfg || {};
  const cfg = { enabled: !!g('dbb-on').checked, freq: g('dbb-freq').value, dow: +g('dbb-dow').value, dom: Math.min(28, Math.max(1, +g('dbb-dom').value || 1)), keep: Math.min(30, Math.max(1, +g('dbb-keep').value || 4)), includePhotos: !!g('dbb-ph').checked };
  // Kapag kaka-on o binago ang iskedyul, huwag agad tumakbo para sa lumipas na petsa
  const changed = !prev.enabled || prev.freq !== cfg.freq || prev.dow !== cfg.dow || prev.dom !== cfg.dom; cfg.lastAutoKey = changed ? dbbDueKey(cfg) : (prev.lastAutoKey || dbbDueKey(cfg));
  try { await db.collection('system_settings').doc('backup_config').set(cfg, { merge: true }); dbbState.cfg = Object.assign({}, prev, cfg); try { await logSystemAction('DB_BACKUP_CONFIG', JSON.stringify({ enabled: cfg.enabled, freq: cfg.freq, dow: cfg.dow, dom: cfg.dom })); } catch (e) {} alert('✅ Na-save ang iskedyul ng auto-backup.'); dbbRender(true); } catch (e) { alert('Hindi na-save: ' + e.message); }
}
// Tinatawag pag-open ng admin page: kung due na, gagawa ng backup (isang admin lang ang makakakuha ng lock)
async function dbbAutoCheck() {
  try {
    const cfg = await dbbLoadCfg(); if (!cfg.enabled || dbbState.busy) return; const key = dbbDueKey(cfg); if ((cfg.lastAutoKey || '') >= key) return;
    const ref = db.collection('system_settings').doc('backup_config'); const me = (getCurrentUser() || {}).email || '';
    const got = await db.runTransaction(async tx => { const s = await tx.get(ref); const c = s.data() || {}; if (!c.enabled || (c.lastAutoKey || '') >= key || (c.lockUntil && c.lockUntil > Date.now())) return false; tx.set(ref, { lockUntil: Date.now() + 15 * 60000, lockBy: me }, { merge: true }); return true; });
    if (!got) return; dbbState.busy = true; if (typeof showToast === 'function') showToast('💾 Auto-backup ng database ang tumatakbo... (huwag isara ang page)');
    try {
      const data = await dbbCollect(!!cfg.includePhotos); await dbbSaveCloud(data, 'auto', { scheduled: key }); await dbbPrune(cfg.keep);
      await ref.set({ lastAutoKey: key, lastAutoAt: new Date().toISOString(), lockUntil: 0, lastAutoDocs: data.docs }, { merge: true }); try { await logSystemAction('DB_BACKUP', `Auto (${key}): ${data.docs} docs`); } catch (e) {}
      if (typeof showToast === 'function') showToast(`✅ Auto-backup tapos: ${data.docs} dokumento.`);
    } catch (e) { await ref.set({ lockUntil: 0, lastAutoError: e.message, lastAutoErrorAt: new Date().toISOString() }, { merge: true }); console.warn('auto-backup:', e.message); }
    dbbState.busy = false;
  } catch (e) { console.warn('dbbAutoCheck:', e.message); dbbState.busy = false; }
}

// ---- UI ----
async function dbbRender(force) {
  const view = document.getElementById('view-admin-backups'); if (!view) return;
  let root = document.getElementById('dbb-root'); if (!root) { root = document.createElement('div'); root.id = 'dbb-root'; view.insertBefore(root, view.firstChild); }
  const me = getCurrentUser() || {}; if (normalizeRole(me.role) !== 'admin') { root.innerHTML = ''; return; }
  try {
    const cfg = await dbbLoadCfg(); const hs = await db.collection('db_backups').get(); const hist = []; hs.forEach(d => hist.push({ id: d.id, ...d.data() })); hist.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))); dbbState.hist = hist;
    const last = hist[0], lastMan = hist.find(h => h.trigger === 'manual'), lastAuto = hist.find(h => h.trigger === 'auto');
    const fmt = iso => iso ? new Date(iso).toLocaleString('en-PH', { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '—';
    const days = ['Linggo', 'Lunes', 'Martes', 'Miyerkules', 'Huwebes', 'Biyernes', 'Sabado'];
    const trig = { manual: '🖱️ Manual', auto: '⏰ Auto', 'pre-restore': '🛟 Bago mag-restore' };
    const hrows = hist.slice(0, 40).map(h => `<tr><td>${srchEsc(fmt(h.createdAt))}</td><td>${trig[h.trigger] || h.trigger}</td><td>${h.docs || 0} doc · ${h.collections || 0} col${h.photos ? ' · 🖼️' : ''}</td><td>${h.hasCloud ? '☁️ ' + dbbBytes(h.sizeBytes || 0) : (h.downloaded ? '⬇️ file lang' : '—')}</td><td style="font-size:.78rem;color:#64748b;">${srchEsc(h.by || '')}${h.note ? '<br>' + srchEsc(h.note) : ''}${h.skipped && h.skipped.length ? '<br>⚠️ ' + h.skipped.length + ' hindi nabasa' : ''}</td>
      <td style="white-space:nowrap;">${h.hasCloud ? `<button class="btn btn-sm btn-secondary" onclick="dbbDownloadCloud('${h.id}')">⬇️</button> <button class="btn btn-sm btn-primary" onclick="dbbRestoreCloud('${h.id}')">↩️ Restore</button> <button class="btn btn-sm btn-danger" onclick="dbbDropAsk('${h.id}')" title="Burahin ang cloud copy">🗑️</button>` : ''}</td></tr>`).join('') || '<tr><td colspan="6" style="text-align:center;color:#94a3b8;padding:1rem;">Wala pang backup.</td></tr>';
    const opt = (v, t, s) => `<option value="${v}" ${String(s) === String(v) ? 'selected' : ''}>${t}</option>`;
    root.innerHTML = `<div class="card" style="margin-bottom:1rem;"><div class="card-title"><span>💾 Full Database Backup (Firestore)</span><button class="btn btn-secondary btn-sm" data-keep="1" onclick="dbbRender(true)">🔄</button></div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:.6rem;margin-bottom:.8rem;">
        <div style="background:#f8fafc;border-left:4px solid #16a34a;padding:.5rem .7rem;border-radius:.4rem;"><small>Huling backup</small><div style="font-weight:700;">${srchEsc(fmt(last && last.createdAt))}</div></div>
        <div style="background:#f8fafc;border-left:4px solid #2563eb;padding:.5rem .7rem;border-radius:.4rem;"><small>Huling manual</small><div style="font-weight:700;">${srchEsc(fmt(lastMan && lastMan.createdAt))}</div></div>
        <div style="background:#f8fafc;border-left:4px solid #7c3aed;padding:.5rem .7rem;border-radius:.4rem;"><small>Huling auto</small><div style="font-weight:700;">${srchEsc(fmt(lastAuto && lastAuto.createdAt))}</div></div></div>
      <div style="display:flex;gap:.5rem;flex-wrap:wrap;align-items:center;margin-bottom:.5rem;">
        <button class="btn btn-success" onclick="dbbManual()">⬇️ I-backup at i-download ngayon</button>
        <button class="btn btn-secondary" onclick="dbbRestoreFile()">⬆️ Mag-restore mula sa file</button>
        <label style="font-size:.85rem;"><input type="checkbox" id="dbb-cloud" checked> Mag-save din sa cloud (restore point)</label>
        <label style="font-size:.85rem;"><input type="checkbox" id="dbb-photos"> Isama ang larawan/files (malaki)</label></div>
      <div id="dbb-status" style="font-size:.85rem;color:#475569;min-height:1.2em;">${srchEsc(dbbState.msg)}</div>
      <div style="border:1px solid #e2e8f0;border-radius:.5rem;padding:.7rem;margin:.7rem 0;background:#f8fafc;">
        <b>⏰ Auto-Backup</b>
        <div style="display:flex;gap:.6rem;flex-wrap:wrap;align-items:end;margin-top:.4rem;">
          <label style="font-size:.9rem;"><input type="checkbox" id="dbb-on" ${cfg.enabled ? 'checked' : ''}> <b>I-ON</b></label>
          <div><small>Gaano kadalas</small><br><select id="dbb-freq" data-nosearch="1" onchange="dbbFreqUi()">${opt('daily', 'Araw-araw', cfg.freq)}${opt('weekly', 'Lingguhan', cfg.freq)}${opt('monthly', 'Buwanan', cfg.freq)}</select></div>
          <div id="dbb-dow-box"><small>Anong araw</small><br><select id="dbb-dow" data-nosearch="1">${days.map((d, i) => opt(i, d, cfg.dow)).join('')}</select></div>
          <div id="dbb-dom-box"><small>Petsa ng buwan (1-28)</small><br><input type="number" id="dbb-dom" min="1" max="28" value="${cfg.dom || 1}" style="width:80px;"></div>
          <div><small>Ilang cloud restore point itatago</small><br><input type="number" id="dbb-keep" min="1" max="30" value="${cfg.keep || 4}" style="width:80px;"></div>
          <label style="font-size:.85rem;"><input type="checkbox" id="dbb-ph" ${cfg.includePhotos ? 'checked' : ''}> Isama ang larawan</label>
          <button class="btn btn-primary" onclick="dbbSaveCfg()">💾 I-save</button></div>
        <p style="font-size:.78rem;color:#64748b;margin:.5rem 0 0;">Ang auto-backup ay tumatakbo <b>kapag may admin na nagbukas ng Admin page</b> sa o pagkatapos ng itinakdang araw (walang server ang system). Kung walang nagbukas sa araw na iyon, tatakbo ito sa susunod na pagbukas. ${cfg.lastAutoErrorAt ? `<br><span style="color:#dc2626;">⚠️ Huling error: ${srchEsc(cfg.lastAutoError || '')}</span>` : ''}</p></div>
      <div class="table-responsive"><table data-notools="1"><thead><tr><th>Petsa</th><th>Uri</th><th>Laman</th><th>Cloud</th><th>Detalye</th><th></th></tr></thead><tbody>${hrows}</tbody></table></div>
      <p style="font-size:.75rem;color:#94a3b8;margin-top:.5rem;">Hindi kasama ang Firebase login accounts (email/password) — tanging Firestore data lang. Bawat backup ay bumabasa ng lahat ng dokumento (may bilang ito sa Firestore free quota na 50,000 reads/araw). Hindi isinasama: presence, session, email log, notifications, at ang mga backup/restore point mismo.</p></div>`;
    dbbFreqUi();
  } catch (e) { root.innerHTML = `<div class="card" style="color:#dc2626;">Hindi ma-load ang backup panel: ${srchEsc(e.message)}</div>`; }
}
function dbbFreqUi() { const f = (document.getElementById('dbb-freq') || {}).value; const a = document.getElementById('dbb-dow-box'), b = document.getElementById('dbb-dom-box'); if (a) a.style.display = f === 'weekly' ? '' : 'none'; if (b) b.style.display = f === 'monthly' ? '' : 'none'; }