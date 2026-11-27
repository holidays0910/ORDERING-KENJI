

// ============================================================================
// 🛡️ SECURITY RUNTIME (shared ng lahat ng page): policy, lockout, login history, oras/IP, idle timeout,
// maintenance mode, audit alerts, 4-eyes approval, error capture. Ang Admin UI ay nasa sec.js.
// Policy: system_settings/security_policy · Lockout (public read): login_policy/main · Maintenance: system_settings/maintenance
// ============================================================================
window.KERP_BUILD = '2026-11-18-c';
const SEC_DEFAULT = {
  lockout: { enabled: true, maxFails: 5, lockMin: 15 },
  idle: { admin: 0, commissary: 0, branch: 0, employee: 0 },
  hours: { enabled: false, roles: { commissary: { from: '05:00', to: '23:59' }, branch: { from: '05:00', to: '23:59' }, employee: { from: '05:00', to: '23:59' } } },
  fourEyes: { enabled: false, actions: ['db_restore', 'truncate', 'admin_role'] },
  alerts: { enabled: true, emails: '', discountPct: 30 },
  retention: { notifications: 60, login_history: 180, sec_errors: 60, sec_alerts: 180 }
};
const SEC = { pol: null, polAt: 0, act: Date.now(), errs: 0, mnt: null, ip: null };
function secMerge(base, over) { const o = Array.isArray(base) ? (over || base).slice() : Object.assign({}, base); if (over && typeof over === 'object' && !Array.isArray(base)) for (const k of Object.keys(over)) o[k] = (base[k] && typeof base[k] === 'object' && !Array.isArray(base[k]) && over[k] && typeof over[k] === 'object') ? secMerge(base[k], over[k]) : over[k]; return o; }
async function secPolicy(force) {
  if (!force && SEC.pol && Date.now() - SEC.polAt < 300000) return SEC.pol;
  let d = {}; try { const s = await db.collection('system_settings').doc('security_policy').get(); if (s.exists) d = s.data(); } catch (e) {}
  SEC.pol = secMerge(SEC_DEFAULT, d); SEC.polAt = Date.now(); return SEC.pol;
}
function secHm(s) { const m = /^(\d{1,2}):(\d{2})$/.exec(String(s || '')); return m ? (+m[1]) * 60 + (+m[2]) : null; }
function secTimeOk(pol, role, now) {
  if (!pol.hours || !pol.hours.enabled || role === 'admin') return true; const w = pol.hours.roles && pol.hours.roles[role]; if (!w) return true;
  const a = secHm(w.from), b = secHm(w.to); if (a == null || b == null) return true; now = now || new Date(); const m = now.getHours() * 60 + now.getMinutes();
  return a <= b ? (m >= a && m <= b) : (m >= a || m <= b);
}
function secIpMatch(ip, list) { return String(list || '').split(/[\s,;]+/).filter(Boolean).some(p => p.endsWith('*') ? ip.startsWith(p.slice(0, -1)) : ip === p); }
async function secGetIp() { return ''; } // tinanggal ang IP lookup (walang external na tawag)
function secIpOk() { return true; }

// ---- Pre-login lockout (public login_policy/main + login_attempts/{email}) ----
async function secLoginPolicy() { try { const s = await db.collection('login_policy').doc('main').get(); if (s.exists) return Object.assign({ enabled: true, maxFails: 5, lockMin: 15 }, s.data()); } catch (e) {} return { enabled: true, maxFails: 5, lockMin: 15 }; }
async function secLockCheck(email) {
  try { const lp = await secLoginPolicy(); if (!lp.enabled) return 0; const s = await db.collection('login_attempts').doc(String(email).toLowerCase()).get(); if (!s.exists) return 0; const l = +s.data().lockedUntil || 0; return l > Date.now() ? Math.ceil((l - Date.now()) / 60000) : 0; } catch (e) { return 0; }
}
async function secRecord(email, result, reason) {
  try { const ua = (navigator.userAgent || '').slice(0, 200); const ip = await secGetIp().catch(() => ''); await db.collection('login_history').add({ email: String(email).toLowerCase(), result, reason: String(reason || '').slice(0, 120), at: new Date().toISOString(), atMs: Date.now(), ua, ip: ip || '' }); } catch (e) {}
}
async function secFailed(email, reason) {
  const id = String(email).toLowerCase(); let locked = 0;
  try {
    const lp = await secLoginPolicy(); const ref = db.collection('login_attempts').doc(id); const s = await ref.get(); const d = s.exists ? s.data() : null; const expired = d && (+d.lockedUntil || 0) && (+d.lockedUntil) < Date.now();
    const fails = d && !expired ? (d.fails || 0) + 1 : 1; const lockedUntil = lp.enabled && fails >= lp.maxFails ? Date.now() + lp.lockMin * 60000 : 0;
    await ref.set({ email: id, fails, lockedUntil, lastAt: Date.now() }); if (lockedUntil) locked = lp.lockMin;
  } catch (e) {}
  await secRecord(id, 'fail', reason); return locked;
}
async function secSuccessReset(email) { try { await db.collection('login_attempts').doc(String(email).toLowerCase()).set({ email: String(email).toLowerCase(), fails: 0, lockedUntil: 0, lastAt: Date.now() }); } catch (e) {} }

// ---- Gate pagkatapos ng successful na login (index.html): maintenance, oras, IP ----
async function secGate(userData, role) {
  try {
    if (role === 'admin') return { ok: true };
    const pol = await secPolicy(true);
    try { const m = await db.collection('system_settings').doc('maintenance').get(); if (m.exists && m.data().on) return { ok: false, msg: `🛠️ <b>Maintenance Mode</b><br>${srchEsc(m.data().msg || 'Ginagawan ng maintenance ang system. Subukan ulit mamaya.')}` }; } catch (e) {}
    if (!secTimeOk(pol, role)) { const w = (pol.hours.roles || {})[role] || {}; return { ok: false, msg: `⏰ <b>Wala sa oras ng pag-login.</b><br>Ang ${srchEsc(role)} account ay puwede lang mag-login mula <b>${srchEsc(w.from || '')}</b> hanggang <b>${srchEsc(w.to || '')}</b>.` }; }
  } catch (e) {}
  return { ok: true };
}
// Pilitin ang bagong password (users.mustChangePw)
function secForcePw(email) {
  return new Promise(resolve => {
    const o = document.createElement('div'); o.style.cssText = 'position:fixed;inset:0;background:rgba(15,23,42,.8);z-index:99999;display:flex;align-items:center;justify-content:center;padding:1rem;';
    o.innerHTML = `<div style="background:#fff;border-radius:.7rem;padding:1.2rem;max-width:380px;width:100%;"><h3 style="margin-top:0;">🔑 Palitan ang Password</h3><p style="font-size:.85rem;color:#64748b;">Hiniling ng Admin na magpalit ka ng password bago magpatuloy.</p>
      <input type="password" id="fp-1" placeholder="Bagong password (min 8 characters)" style="width:100%;margin-bottom:.5rem;"><input type="password" id="fp-2" placeholder="Ulitin ang bagong password" style="width:100%;"><div id="fp-err" style="color:#dc2626;font-size:.8rem;min-height:1.2em;margin:.3rem 0;"></div>
      <button id="fp-ok" class="btn btn-success">💾 I-save</button> <button id="fp-no" class="btn btn-secondary">Kanselahin</button></div>`;
    document.body.appendChild(o); const q = id => o.querySelector('#' + id);
    q('fp-no').onclick = () => { o.remove(); resolve(false); };
    q('fp-ok').onclick = async () => { const a = q('fp-1').value, b = q('fp-2').value; if (a.length < 8) { q('fp-err').textContent = 'Kailangan ng hindi bababa sa 8 characters.'; return; } if (a !== b) { q('fp-err').textContent = 'Hindi magkapareho ang dalawang password.'; return; }
      try { await firebase.auth().currentUser.updatePassword(a); await db.collection('users').doc(String(email).toLowerCase()).update({ mustChangePw: false, hasPasswordSet: true, pwChangedAt: new Date().toISOString() }); o.remove(); resolve(true); } catch (e) { q('fp-err').textContent = 'Hindi napalitan: ' + (e.code === 'auth/requires-recent-login' ? 'mag-login ulit at subukan.' : e.message); } };
  });
}

// ---- Audit alerts ----
const SEC_SENSITIVE = ['DATA_TRUNCATED', 'DB_RESTORE', 'SYSTEM_ROLLBACK', 'SAP_ITEMS_RESTORED', 'SAP_ITEMS_REPLACED', 'USER_ROLE_UPDATED', 'ACCESS_ROLES_UPDATED', 'CUSTOM_ROLE_ASSIGNED', 'USER_OFFBOARDED', 'SEC_POLICY_CHANGED', 'MAINTENANCE_ON', 'MAINTENANCE_OFF', 'TEMP_ACCESS_GRANTED', 'FORCE_LOGOUT_ALL', 'APPROVAL_REQUESTED', 'DB_BACKUP_CONFIG', 'USER_REJECTED'];
async function secAlertRecipients(pol) {
  let list = String(pol.alerts.emails || '').split(/[\s,;]+/).filter(x => x.includes('@')).map(x => x.toLowerCase());
  if (!list.length) { try { const s = await db.collection('system_settings').doc('super_admins').get(); if (s.exists) list = (s.data().emails || []).map(x => String(x).toLowerCase()); } catch (e) {} }
  return [...new Set(list)];
}
async function secAlert(action, details) {
  try {
    const pol = await secPolicy(); if (!pol.alerts.enabled) return; const u = getCurrentUser() || {}; const by = String(u.email || '').toLowerCase();
    await db.collection('sec_alerts').add({ action, details: String(details || '').slice(0, 400), by, at: new Date().toISOString(), atMs: Date.now() });
    const to = (await secAlertRecipients(pol)).filter(e => e !== by); if (to.length && typeof notify === 'function') notify(to, `🚨 ${action}`, `${by || 'System'}: ${String(details || '').slice(0, 200)}`);
  } catch (e) {}
}
function secMaybeAlert(action, details) {
  if (!action || /^SEC_ALERT/.test(action)) return; let hit = SEC_SENSITIVE.includes(action);
  if (!hit && action === 'ORDER_DISCOUNT_SET') { const m = /:\s*([\d.]+)%/.exec(String(details || '')); const lim = (SEC.pol && SEC.pol.alerts && +SEC.pol.alerts.discountPct) || SEC_DEFAULT.alerts.discountPct; hit = !!(m && +m[1] >= lim); }
  if (hit) secAlert(action, details);
}

// ---- 4-eyes approval ----
async function secNeed4(action, label) {
  try {
    const pol = await secPolicy(true); if (!pol.fourEyes.enabled || !(pol.fourEyes.actions || []).includes(action)) return true;
    const me = String((getCurrentUser() || {}).email || '').toLowerCase(); const s = await db.collection('sec_approvals').where('requestedBy', '==', me).get(); let ok = null, pend = null;
    s.forEach(d => { const x = d.data(); if (x.action !== action || (x.expiresAt || 0) < Date.now()) return; if (x.status === 'approved' && !x.usedAt) ok = d; else if (x.status === 'pending') pend = d; });
    if (ok) { await ok.ref.update({ status: 'used', usedAt: Date.now() }); return true; }
    if (pend) { alert('⏳ Naghihintay pa ng approval ng ikalawang Admin para sa: ' + label + '.\nKapag na-approve, ulitin ang aksyon na ito.'); return false; }
    await db.collection('sec_approvals').add({ action, label, requestedBy: me, requestedAt: Date.now(), status: 'pending', expiresAt: Date.now() + 86400000 });
    secAlert('APPROVAL_REQUESTED', `${label} — hinihintay ang ikalawang Admin`); alert('🔐 Kailangan ng approval ng ikalawang Admin para sa: ' + label + '.\nNagpadala na ng request. Pagka-approve, ulitin ang aksyon.'); return false;
  } catch (e) { console.warn('secNeed4:', e.message); return true; }
}

// ---- Runtime guards: idle timeout, oras, maintenance, error capture ----
function secOverlay(html) { let o = document.getElementById('sec-overlay'); if (!html) { if (o) o.remove(); return; } if (!o) { o = document.createElement('div'); o.id = 'sec-overlay'; o.style.cssText = 'position:fixed;inset:0;background:rgba(15,23,42,.94);color:#fff;z-index:99998;display:flex;align-items:center;justify-content:center;text-align:center;padding:2rem;'; document.body.appendChild(o); } o.innerHTML = html; }
function secGuardStart() {
  if (window.__secOn) return; window.__secOn = true; const bump = () => { SEC.act = Date.now(); }; ['mousemove', 'keydown', 'click', 'touchstart', 'scroll'].forEach(e => document.addEventListener(e, bump, { passive: true }));
  const role = () => normalizeRole((getCurrentUser() || {}).role);
  try { db.collection('system_settings').doc('maintenance').onSnapshot(s => { SEC.mnt = s.exists ? s.data() : null; secMaintApply(); }, () => {}); } catch (e) {}
  setInterval(async () => {
    try { const r = role(), pol = await secPolicy(); const idle = +(pol.idle || {})[r] || 0;
      if (idle > 0 && Date.now() - SEC.act > idle * 60000) { try { localStorage.removeItem('kerp_login_at'); } catch (e) {} await uiAlert(`⏱️ Na-logout ka dahil ${idle} minuto kang walang aktibidad.`); logoutUser(); return; }
      if (!secTimeOk(pol, r)) { await uiAlert('⏰ Tapos na ang oras ng pag-login para sa account na ito. Magla-logout ka na.'); logoutUser(); }
    } catch (e) {} }, 30000);
  window.addEventListener('error', ev => secLogError(ev.message, ev.filename, ev.lineno)); window.addEventListener('unhandledrejection', ev => secLogError('Promise: ' + ((ev.reason && ev.reason.message) || ev.reason), '', 0));
}
function secMaintApply() {
  const m = SEC.mnt, on = !!(m && m.on), r = normalizeRole((getCurrentUser() || {}).role);
  if (on && r !== 'admin') secOverlay(`<div><div style="font-size:3rem;">🛠️</div><h2>Maintenance Mode</h2><p style="max-width:420px;">${srchEsc((m && m.msg) || 'Ginagawan ng maintenance ang system. Subukan ulit mamaya.')}</p><button class="btn btn-secondary" onclick="logoutUser()">🚪 Logout</button></div>`);
  else secOverlay('');
  let b = document.getElementById('sec-mnt-banner'); if (on && r === 'admin') { if (!b) { b = document.createElement('div'); b.id = 'sec-mnt-banner'; b.style.cssText = 'position:fixed;bottom:0;left:0;right:0;background:#b45309;color:#fff;text-align:center;padding:.3rem;z-index:99997;font-size:.85rem;'; document.body.appendChild(b); } b.textContent = '🛠️ MAINTENANCE MODE ang naka-ON — ikaw lang (Admin) ang nakakagamit ng system.'; } else if (b) b.remove();
}
async function secLogError(msg, file, line) {
  try { if (SEC.errs >= 5 || !db || !getCurrentUser()) return; const key = String(msg).slice(0, 80); SEC._seen = SEC._seen || {}; if (SEC._seen[key]) return; SEC._seen[key] = 1; SEC.errs++;
    await db.collection('sec_errors').add({ msg: String(msg).slice(0, 300), file: String(file || '').split('/').pop().slice(0, 80), line: line || 0, page: location.pathname.split('/').pop(), by: String((getCurrentUser() || {}).email || ''), at: new Date().toISOString(), atMs: Date.now() }); } catch (e) {}
}

// ===================== SMART INPUT (auto-format + validation) =====================
// Awtomatikong nakikilala ang TIN, SSS, PhilHealth, Pag-IBIG, RDO, cellphone/telepono at email sa LAHAT ng page.
// Gumagana ito sa pamamagitan ng id / name / label / placeholder ng field; puwede ring manual: data-fmt="tin|sss|phic|hdmf|rdo|phone|email|emails".
// Cellphone: ina-accept ang 09xx, 9xx, 63xx, +63xx pero laging 09XX-XXX-XXXX ang nasa field/naka-save. Gamitin ang smPhoneIntl() para sa +63 (SMS).
(function () {
  if (window.__smOn) return; window.__smOn = true;
  const GOV = { tin: { g: [3, 3, 3, 5], ok: [9, 12, 14], name: 'TIN', hint: 'TIN: 9 digits (000-000-000) o may branch code (000-000-000-000 / 000-000-000-00000).' },
    sss: { g: [2, 7, 1], ok: [10], name: 'SSS', hint: 'SSS No.: 10 digits (00-0000000-0).' },
    phic: { g: [2, 9, 1], ok: [12], name: 'PhilHealth', hint: 'PhilHealth PIN: 12 digits (00-000000000-0).' },
    hdmf: { g: [4, 4, 4], ok: [12], name: 'Pag-IBIG', hint: 'Pag-IBIG MID: 12 digits (0000-0000-0000).' },
    rdo: { g: [3], ok: [3], name: 'RDO', hint: 'RDO Code: 3 digits (hal. 044).' } };
  const EMPTYOK = /^(n\/?a|none|wala|-+)$/i;
  const SKIPTYPE = /^(number|date|datetime-local|time|month|week|password|file|checkbox|radio|hidden|range|color|button|submit|reset|image)$/i;
  const words = s => String(s || '').replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
  function labelOf(el) {
    try { if (el.labels && el.labels[0]) return el.labels[0].textContent; } catch (e) {}
    let p = el.previousElementSibling; if (p && /^(LABEL|SPAN|B|SMALL)$/.test(p.tagName)) return p.textContent;
    const par = el.parentElement; if (par) { const n = par.querySelectorAll('input,select,textarea').length; const l = par.querySelector('label'); if (l && n === 1) return l.textContent; }
    return '';
  }
  function kindOf(el) {
    if (!el || el.tagName !== 'INPUT') return null; if (el.dataset.smk !== undefined) return el.dataset.smk || null;
    let k = null; const type = (el.getAttribute('type') || 'text').toLowerCase();
    if (!SKIPTYPE.test(type) && !el.disabled && !el.readOnly) {
      const f = (el.dataset.fmt || '').toLowerCase(); const w = words((el.id || '') + ' ' + (el.name || '')); const lab = labelOf(el), ph = el.getAttribute('placeholder') || '';
      const has = (...a) => a.some(x => w.includes(x));
      if (/^(tin|sss|phic|hdmf|rdo|phone|email|emails)$/.test(f)) k = f;
      else if (/search|filter|find|hanap/.test(w.join(' ')) || /^\s*🔍/.test(ph) || type === 'search') k = null;
      else if (type === 'email' || has('email', 'emails', 'mail')) k = (has('emails') || /kuwit|comma|mga email/i.test(lab + ph)) ? 'emails' : 'email';
      else if (has('tin')) k = 'tin'; else if (has('sss')) k = 'sss'; else if (has('phic', 'philhealth')) k = 'phic'; else if (has('hdmf', 'pagibig')) k = 'hdmf'; else if (has('rdo')) k = 'rdo';
      else if (has('phone', 'mobile', 'cell', 'cellphone', 'tel', 'telepono', 'cp') || (has('contact') && !has('person', 'name', 'title', 'position', 'tin'))) k = 'phone';
      else if (/(^|[^a-z])tin(\s*(no|number|#)|[^a-z]|$)/i.test(lab) && !/tinanggap|tinatag/i.test(lab)) k = 'tin';
      else if (/(^|[^a-z])sss(\s|$|[^a-z])/i.test(lab)) k = 'sss'; else if (/philhealth|phic/i.test(lab)) k = 'phic'; else if (/pag-?ibig|hdmf/i.test(lab)) k = 'hdmf';
      else if (/(^|[^a-z])e-?mail/i.test(lab)) k = /kuwit|comma|mga email/i.test(lab) ? 'emails' : 'email';
      else if (/(contact|mobile|cell|phone|telepono)\s*(no|number|#|details)?/i.test(lab) && !/person|name|title/i.test(lab)) k = 'phone';
    }
    el.dataset.smk = k || ''; return k;
  }
  // ---- Cellphone / telepono ----
  const digits = s => String(s || '').replace(/\D/g, '');
  function normMobile(raw) { // gawing 09XXXXXXXXX ang +63 / 63 / 9 na pasimula
    let d = digits(raw); const plus = /^\s*\+/.test(String(raw));
    if (plus && d.startsWith('63')) d = '0' + d.slice(2); else if (d.startsWith('639') && d.length >= 12) d = '0' + d.slice(2); else if (d.startsWith('9') && d.length === 10) d = '0' + d;
    return d;
  }
  const fmtMobile = d => [d.slice(0, 4), d.slice(4, 7), d.slice(7)].filter(Boolean).join('-');
  function phoneTokens(v) { return String(v).split(/[\/,;]+/).map(x => x.trim()).filter(Boolean); }
  function chkPhoneToken(t) {
    const d = normMobile(t); if (!d) return 'Walang numero.';
    if (/[a-z]/i.test(t.replace(/\b(loc|local|ext)\b.*$/i, ''))) return 'Numero lang ang puwede.';
    if (d.startsWith('09')) { if (d.length > 11) return 'Sobra: 11 digits lang ang cellphone (09XX-XXX-XXXX). Ngayon: ' + d.length + '.'; if (d.length < 11) return 'Kulang: ' + d.length + '/11 digits ang cellphone (09XX-XXX-XXXX).'; return ''; }
    if (d.startsWith('0') && d.length === 10) return ''; // landline: area code + number
    if (/^[2-9]\d{6,7}$/.test(d)) return ''; // local landline
    if (d.startsWith('0') && d.length < 10) return 'Kulang ang landline (area code + numero, 10 digits).';
    if (d.startsWith('0') && d.length > 11) return 'Sobra ang digits.';
    return 'Hindi tamang numero. Gamitin ang 09XX-XXX-XXXX (cellphone) o area code + numero (landline).';
  }
  window.smPhoneIntl = function (v) { const d = normMobile(v); return /^09\d{9}$/.test(d) ? '+63' + d.slice(1) : ''; };
  // ---- Email ----
  const DOM_FIX = { 'gmial.com': 'gmail.com', 'gmai.com': 'gmail.com', 'gmail.con': 'gmail.com', 'gmail.co': 'gmail.com', 'gmaill.com': 'gmail.com', 'gamil.com': 'gmail.com', 'yaho.com': 'yahoo.com', 'yahoo.con': 'yahoo.com', 'yahooo.com': 'yahoo.com', 'hotmial.com': 'hotmail.com', 'hotmail.con': 'hotmail.com', 'outlok.com': 'outlook.com', 'outlook.con': 'outlook.com' };
  const EMAIL_RE = /^[A-Za-z0-9._%+'-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}$/;
  function chkEmail(e) {
    if (!e.includes('@')) { const m = /^(.+?)(gmail|yahoo|outlook|hotmail|icloud|proton(?:mail)?)\.(com|me)$/i.exec(e); return m && m[1] ? { msg: 'Walang “@”. Ang ibig mo bang sabihin:', fix: m[1] + '@' + m[2] + '.' + m[3] } : { msg: 'Kulang ang “@” (hal. juan@gmail.com).' }; }
    if (e.split('@').length > 2) return { msg: 'Isa lang dapat ang “@”.' };
    const [loc, dom] = e.split('@'); if (!loc) return { msg: 'Walang nasa unahan ng “@”.' }; if (!dom) return { msg: 'Walang nasa hulihan ng “@” (hal. gmail.com).' };
    if (!dom.includes('.')) return { msg: 'Kulang ang domain (hal. @gmail.com).' }; if (/\.\./.test(e) || /^\.|\.$/.test(loc) || /^\.|\.$|^-|-$/.test(dom)) return { msg: 'May maling tuldok sa email.' };
    const dl = dom.toLowerCase(); if (DOM_FIX[dl]) return { msg: 'Mali ba ang domain? Ang ibig mo bang sabihin:', fix: loc + '@' + DOM_FIX[dl] };
    if (!EMAIL_RE.test(e)) return { msg: 'Hindi tamang email (bawal ang espasyo/espesyal na simbolo).' }; return null;
  }
  // ---- Government numbers ----
  function fmtGov(k, raw) {
    const G = GOV[k]; const d = digits(raw); let i = 0; const parts = [];
    G.g.forEach((n, gi) => { if (i >= d.length) return; const last = gi === G.g.length - 1; const take = last ? d.slice(i) : d.slice(i, i + n); parts.push(take); i += take.length; });
    if (i < d.length) parts[parts.length - 1] += d.slice(i);
    return parts.join('-');
  }
  // ---- Format + check ----
  function process(el, live) {
    const k = kindOf(el); if (!k) return null; let v = el.value, res = '';
    if (!v.trim()) return { k, err: '' };
    if (k === 'email' || k === 'emails') {
      if (live && !el.dataset.smTouched) return { k, err: '' };
      if (!live) { const nv = (k === 'emails' ? v.split(/[,;\s]+/).filter(Boolean).join(', ') : v.trim()).replace(/[A-Z]/g, c => c.toLowerCase()); if (nv !== v) { el.value = nv; v = nv; } }
      const list = k === 'emails' ? v.split(/[,;\s]+/).filter(Boolean) : [v.trim()];
      for (const e of list) { const r = chkEmail(e.toLowerCase()); if (r) return { k, err: (list.length > 1 ? e + ': ' : '') + r.msg, fix: r.fix && (k === 'emails' ? v.replace(e, r.fix) : r.fix) }; }
      return { k, err: '' };
    }
    if (k === 'phone') {
      const simple = /^\s*\+?[\d\s\-().]+$/.test(v), toks = phoneTokens(v);
      if (simple && toks.length === 1) {
        const d = live ? digits(v) : normMobile(v);
        if (d.startsWith('09') && (!live || /^\s*0/.test(v))) { const f = fmtMobile(d); if (f !== v) el.value = f; const e = chkPhoneToken(f); return { k, err: live ? (d.length > 11 ? e : '') : e }; }
        if (live) return { k, err: '' };
      } else if (!live) { const nv = toks.map(t => { const d = normMobile(t); return /^09\d{9}$/.test(d) ? fmtMobile(d) : t; }).join(' / '); if (/[\/,;]/.test(v) && nv !== v) el.value = nv; }
      if (live) return { k, err: '' };
      for (const t of phoneTokens(el.value)) { const m = chkPhoneToken(t); if (m) return { k, err: toks.length > 1 ? t + ': ' + m : m }; } return { k, err: '' };
    }
    // government numbers
    if (/^[a-z]/i.test(v.trim())) { if (EMPTYOK.test(v.trim())) return { k, err: '' }; return { k, err: GOV[k].name + ': numero lang (puwedeng “N/A” kung wala).' }; }
    const f = fmtGov(k, v); if (f !== v) el.value = f; const n = digits(f).length; if (live) return { k, err: n > Math.max(...GOV[k].ok) ? 'Sobra ang digits (' + n + '). ' + GOV[k].hint : '' };
    if (!GOV[k].ok.includes(n)) return { k, err: (n > Math.max(...GOV[k].ok) ? 'Sobra ang digits (' + n + '). ' : (live ? '' : 'Kulang ang digits (' + n + '). ')) + GOV[k].hint };
    return { k, err: '' };
  }
  // ---- UI ----
  function msgEl(el) { let m = el.nextElementSibling; if (m && m.classList && m.classList.contains('sm-msg')) return m; m = document.createElement('div'); m.className = 'sm-msg'; el.insertAdjacentElement('afterend', m); return m; }
  function paint(el, r) {
    const bad = !!(r && r.err); el.classList.toggle('sm-bad', bad); el.classList.toggle('sm-good', !bad && !!el.value.trim() && !!(r && r.k));
    const nx = el.nextElementSibling; const has = nx && nx.classList && nx.classList.contains('sm-msg');
    if (bad) { const m = msgEl(el); m.innerHTML = '<span class="sm-dot"></span>' + String(r.err).replace(/[<>&]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c])); if (r.fix) { const b = document.createElement('a'); b.href = 'javascript:void(0)'; b.className = 'sm-fix'; b.textContent = r.fix; b.onclick = ev => { ev.preventDefault(); el.value = r.fix; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); paint(el, process(el, false)); }; m.appendChild(document.createTextNode(' ')); m.appendChild(b); m.appendChild(document.createTextNode('?')); } m.style.display = 'block'; el.setAttribute('aria-invalid', 'true'); }
    else { if (has) nx.style.display = 'none'; el.removeAttribute('aria-invalid'); }
  }
  function caretFix(el, before, oldVal, caret) { // panatilihin ang cursor sa tamang digit
    try { const nd = digits(oldVal.slice(0, caret)).length; let c = 0, n = 0; while (c < el.value.length && n < nd) { if (/\d/.test(el.value[c])) n++; c++; } el.setSelectionRange(c, c); } catch (e) {}
  }
  document.addEventListener('input', ev => {
    const el = ev.target; const k = kindOf(el); if (!k) return; const old = el.value, caret = el.selectionStart; const r = process(el, true);
    if (el.value !== old && ev.inputType !== 'insertFromPaste' && /^(tin|sss|phic|hdmf|rdo|phone)$/.test(k)) caretFix(el, 0, old, caret);
    paint(el, r);
  }, true);
  document.addEventListener('focusout', ev => { const el = ev.target; if (!kindOf(el)) return; el.dataset.smTouched = '1'; paint(el, process(el, false)); }, true);
  document.addEventListener('change', ev => { const el = ev.target; if (kindOf(el)) { paint(el, process(el, false)); } }, true);
  // ---- Harangin ang pag-save kapag may pulang field ----
  window.smValidate = function (root) {
    const scope = root || document; const bad = [];
    scope.querySelectorAll('input').forEach(el => { if (!kindOf(el) || el.offsetParent === null) return; const r = process(el, false); el.dataset.smTouched = '1'; paint(el, r); if (r && r.err) bad.push({ el, r }); });
    return bad;
  };
  const SAVE_RE = /sav|i-save|submit|post|create|gawa|update|ipasa|ipadala|send|add|idagdag|isumite|ilagay|apply|aprub|approve|tanggap|register|rehistro|login|log in|confirm|💾|✅|➕|📤/i, NOSAVE_RE = /cancel|kansel|isara|close|bumalik|back|print|download|export|delete|burahin|alisin|remove|search|hanap|filter|refresh|🔄|🖨|📥|✖|✕/i;
  function guard(ev, scopeEl) {
    const scope = scopeEl.closest('.modal-content,.modal-overlay,form,.card') || document; const bad = window.smValidate(scope);
    if (bad.length) { ev.preventDefault(); ev.stopImmediatePropagation(); try { bad[0].el.focus(); bad[0].el.scrollIntoView({ block: 'center', behavior: 'smooth' }); } catch (e) {} if (!window.__smAlerting) { window.__smAlerting = true; Promise.resolve(window.alert('🔴 Ayusin muna ang mga pulang field (' + bad.length + ') bago ma-save:\n\n• ' + bad.slice(0, 4).map(b => b.r.err).join('\n• '))).finally(() => { window.__smAlerting = false; }); setTimeout(() => { window.__smAlerting = false; }, 1500); } return true; }
    return false;
  }
  document.addEventListener('click', ev => {
    const b = ev.target.closest && ev.target.closest('button,input[type=submit],a.btn'); if (!b || b.disabled || b.hasAttribute('data-nosm')) return;
    const t = (b.textContent || b.value || '') + ' ' + (b.getAttribute('onclick') || ''); if (NOSAVE_RE.test(b.textContent || b.value || '') || !SAVE_RE.test(t)) return; guard(ev, b);
  }, true);
  document.addEventListener('submit', ev => { if (ev.target && ev.target.tagName === 'FORM') guard(ev, ev.target); }, true);
  const css = document.createElement('style'); css.textContent = 'input.sm-bad{border-color:#dc2626!important;box-shadow:0 0 0 2px rgba(220,38,38,.18)!important;background:#fff7f7!important}input.sm-good{border-color:#22c55e!important}.sm-msg{display:none;color:#dc2626;font-size:.76rem;line-height:1.25;margin:.2rem 0 .1rem;font-weight:500}.sm-dot{display:inline-block;width:.55rem;height:.55rem;border-radius:50%;background:#dc2626;margin-right:.35rem;vertical-align:baseline}.sm-fix{color:#2563eb;text-decoration:underline;cursor:pointer;font-weight:700}';
  (document.head || document.documentElement).appendChild(css);
})();

/* =====================================================================
   🧭 TASK TRAY + NAVIGATION LOADING
   - Lahat ng matagal na gawain (backup, restore, restore point, import, bulk save) ay may status na nakikita sa kanang-ibaba,
     kahit maisara ang modal. Hindi na "bulag" ang user.
   - Sa pagpindot ng side menu: loading screen na may percentage at server/internet responsiveness.
   ===================================================================== */
(function () {
  const tasks = []; let open = true, idc = 0;
  const $ = () => document.getElementById('k-tray');
  function el() { let t = $(); if (!t) { t = document.createElement('div'); t.id = 'k-tray'; t.style.cssText = 'position:fixed;right:.6rem;bottom:.6rem;z-index:100000;width:min(340px,calc(100vw - 1.2rem));font-family:inherit;'; document.body.appendChild(t); } return t; }
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  function render() {
    const t = el(), vis = tasks.filter(x => x.state === 'run' || Date.now() - x.end < 60000 || x.state === 'fail');
    if (!vis.length) { t.style.display = 'none'; return; } t.style.display = 'block';
    const run = vis.filter(x => x.state === 'run').length;
    t.innerHTML = `<div style="background:#0f172a;color:#fff;border-radius:.6rem .6rem 0 0;padding:.35rem .7rem;display:flex;justify-content:space-between;align-items:center;font-size:.85rem;cursor:pointer;" onclick="kTaskToggle()"><b>${run ? '⏳ ' + run + ' ang tumatakbo' : '✅ Mga gawain'}</b><span>${open ? '▾' : '▴'}</span></div>` + (open ? `<div style="background:#fff;border:1px solid #cbd5e1;border-top:0;border-radius:0 0 .6rem .6rem;max-height:40vh;overflow:auto;box-shadow:0 8px 24px rgba(0,0,0,.25);">${vis.slice().reverse().map(x => { const pct = x.total ? Math.min(100, Math.round(x.n / x.total * 100)) : null, col = x.state === 'fail' ? '#dc2626' : x.state === 'done' ? '#16a34a' : '#2563eb';
      return `<div style="padding:.4rem .7rem;border-bottom:1px solid #f1f5f9;font-size:.82rem;"><div style="display:flex;justify-content:space-between;gap:.4rem;"><b>${x.state === 'run' ? '⏳' : x.state === 'done' ? '✅' : '❌'} ${esc(x.label)}</b>${x.state !== 'run' ? `<span style="cursor:pointer;color:#94a3b8;" onclick="kTaskClose(${x.id})">✕</span>` : `<span style="color:#64748b;">${pct != null ? pct + '%' : Math.round((Date.now() - x.start) / 1000) + 's'}</span>`}</div><div style="color:#475569;">${esc(x.msg || '')}</div>${x.state === 'run' ? `<div style="height:6px;background:#e2e8f0;border-radius:3px;margin-top:.25rem;overflow:hidden;"><div style="height:100%;width:${pct != null ? pct : 100}%;background:${col};${pct == null ? 'animation:ktpulse 1.2s ease-in-out infinite;opacity:.6;' : ''}"></div></div>` : ''}</div>`; }).join('')}</div><style>@keyframes ktpulse{0%,100%{opacity:.25}50%{opacity:.8}}</style>` : '');
  }
  window.kTaskToggle = () => { open = !open; render(); }; window.kTaskClose = id => { const x = tasks.find(t => t.id === id); if (x) { x.end = 0; x.state = x.state === 'fail' ? 'closed' : x.state; } render(); };
  window.kTask = function (label, total) {
    const x = { id: ++idc, label, total: total || 0, n: 0, msg: 'Sinisimulan…', state: 'run', start: Date.now(), end: 0 }; tasks.push(x); render();
    const iv = setInterval(() => { if (x.state !== 'run') clearInterval(iv); else render(); }, 1000);
    return { set(n, tot) { x.n = n; if (tot) x.total = tot; render(); }, msg(m) { x.msg = m; render(); }, done(m) { x.state = 'done'; x.msg = m || 'Tapos na'; x.end = Date.now(); render(); setTimeout(render, 61000); }, fail(m) { x.state = 'fail'; x.msg = m || 'Hindi natapos'; x.end = Date.now(); render(); } };
  };
  window.kTasksRunning = () => tasks.filter(x => x.state === 'run').length;
  window.addEventListener('beforeunload', e => { if (kTasksRunning()) { e.preventDefault(); e.returnValue = 'May tumatakbong gawain (backup/restore/import). Sigurado ka bang aalis?'; } });
  // ---- hook: DB backup/restore ----
  const wrap = (name, label) => { const f = window[name]; if (typeof f !== 'function') return; window[name] = async function () { const tk = kTask(label); window._dbbTk = tk; try { const r = await f.apply(this, arguments); if (window._dbbTk === tk && !tk._fin) tk.done('Tapos'); return r; } catch (e) { tk.fail(e.message); throw e; } finally { if (window._dbbTk === tk) window._dbbTk = null; } }; };
  try { const say0 = window.dbbSay; window.dbbSay = function (m) { say0(m); const tk = window._dbbTk; if (!tk) return; if (/^❌/.test(m)) { tk._fin = 1; tk.fail(m); } else if (/^✅/.test(m)) { tk._fin = 1; tk.done(m); } else tk.msg(m); }; } catch (e) {}
  wrap('dbbManual', '💾 Database backup'); wrap('dbbRestoreRun', '♻️ Database restore'); wrap('dbbDownloadCloud', '⬇️ Pag-download ng restore point');
  // ---- loading ng side menu ----
  let inflight = 0, started = 0, finished = 0, listeners = [];
  const bump = d => { inflight += d; if (d > 0) started++; else finished++; };
  function patchFs() { try { const F = firebase.firestore; [F.Query.prototype, F.DocumentReference.prototype].forEach(P => { const g = P.get; if (!g || g.__k) return; P.get = function () { bump(1); const p = g.apply(this, arguments); const done = () => bump(-1); Promise.resolve(p).then(done, done); return p; }; P.get.__k = 1; }); } catch (e) {} }
  patchFs(); setTimeout(patchFs, 2500);
  let nav = null;
  function navHide() { if (nav) { clearInterval(nav.iv); nav.box.remove(); nav = null; } }
  window.kNavStart = function (name) {
    if (!document.body) return; navHide(); const box = document.createElement('div'); box.id = 'k-nav'; box.style.cssText = 'position:fixed;inset:0;z-index:99990;background:rgba(15,23,42,.35);display:flex;align-items:center;justify-content:center;';
    box.innerHTML = '<div style="background:#fff;border-radius:.8rem;padding:1.1rem 1.4rem;width:min(360px,88vw);box-shadow:0 10px 40px rgba(0,0,0,.35);text-align:center;"><div style="font-weight:700;margin-bottom:.5rem;" id="kn-t">Nilo-load…</div><div style="height:10px;background:#e2e8f0;border-radius:5px;overflow:hidden;"><div id="kn-b" style="height:100%;width:3%;background:linear-gradient(90deg,#2563eb,#38bdf8);transition:width .25s;"></div></div><div style="margin-top:.4rem;font-size:.85rem;color:#475569;"><b id="kn-p">0%</b> · <span id="kn-s">Kinukumusta ang server…</span></div></div>';
    document.body.appendChild(box); const t0 = Date.now(), s0 = started, f0 = finished; let lastBusy = Date.now(), rtt = null;
    try { const p0 = Date.now(); (firebase.firestore().collection('system_settings').doc('backup_config').get({ source: 'server' }) || Promise.resolve()).then(() => { rtt = Date.now() - p0; }, () => { rtt = -1; }); } catch (e) {}
    const label = String(name || '').replace(/[_-]/g, ' ');
    nav = { box, iv: setInterval(() => {
      const el = Date.now() - t0, req = started - s0, fin = finished - f0, busy = inflight > 0; if (busy) lastBusy = Date.now();
      let pct = req ? Math.round((fin / Math.max(req, 1)) * 70 + Math.min(25, el / 120)) : Math.min(60, Math.round(el / 12)); pct = Math.max(3, Math.min(95, pct));
      const quiet = !busy && Date.now() - lastBusy > 450 && el > 500, fin2 = quiet || el > 20000;
      const b = document.getElementById('kn-b'), p = document.getElementById('kn-p'), s = document.getElementById('kn-s'), tt = document.getElementById('kn-t'); if (!b) return;
      if (fin2) { b.style.width = '100%'; p.textContent = '100%'; setTimeout(navHide, 160); clearInterval(nav && nav.iv); return; }
      b.style.width = pct + '%'; p.textContent = pct + '%'; tt.textContent = 'Nilo-load ang ' + label + '…';
      s.textContent = rtt == null ? 'Kinukumusta ang server…' : rtt < 0 ? '⚠️ Walang tugon ang server — i-check ang internet' : (rtt < 1200 ? '✅ Responsive ang server (' + rtt + ' ms)' : '🐢 Mabagal ang koneksyon (' + rtt + ' ms)') + ' · ' + fin + '/' + req + ' data';
      if (el > 12000) s.textContent = '⏳ Matagal ang pag-load — mabagal ang internet o server. Hintayin lang…';
    }, 150) };
  };
  const sw0 = window.switchAdminView; if (typeof sw0 === 'function') window.switchAdminView = function (v) { const r = sw0.apply(this, arguments); if (v && v !== 'dashboard_noload') try { kNavStart(v); } catch (e) {} return r; };
})();


/* ===================== 🎟️ VOUCHERS (Admin side) =====================
   - Series-based: gumawa ng 100 pcs na ₱500 sa isang click (hal. KV-000001 … KV-000100).
   - Status: pending (hinihintay ang pirma/approval ng COO/President) → active (naaprubahan; Super Admin ang nagma-mark) → used / void.
   - Dito rin i-aassign kung kanino nirelease (holder). Sa POS, series number lang ang itatype sa pagbabayad. */
let vchAll = [], vchQ = '', vchSt = '', vchSel = {};
const vchIsAdmin = () => { try { return normalizeRole((getCurrentUser() || {}).role) === 'admin' || superAdminIsMe(); } catch (e) { return false; } };
const vchE = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const vchNorm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
function vchState(v) { if (v.status === 'used') return 'used'; if (v.status === 'void') return 'void'; if (v.status === 'pending') return 'pending'; if (v.expires && v.expires < new Date().toISOString().slice(0, 10)) return 'expired'; return v.holder ? 'active' : 'unassigned'; }
const VCH_ST = { pending: ['⏳ Hinihintay ang approval', '#b45309'], unassigned: ['✅ Approved — wala pang naka-assign', '#0369a1'], active: ['✅ Active', '#166534'], used: ['✔️ Nagamit na', '#475569'], expired: ['⌛ Expired', '#b45309'], void: ['⛔ Void', '#b91c1c'] };
async function loadVouchers() {
  const root = document.getElementById('vch-root'); if (!root) return;
  if (!vchIsAdmin()) { root.innerHTML = '<div class="card">🔒 Admin / Super Admin lang ang may access sa Vouchers.</div>'; return; }
  root.innerHTML = '<div class="card">Kinukuha ang mga voucher…</div>';
  try { const s = await db.collection('pos_vouchers').get(); vchAll = []; s.forEach(d => vchAll.push(Object.assign({ id: d.id }, d.data()))); vchRender(); } catch (e) { root.innerHTML = '<div class="card" style="color:#dc2626;">Error: ' + vchE(e.message) + '</div>'; }
}
function vchRender() {
  const root = document.getElementById('vch-root'); if (!root) return; const sup = superAdminIsMe();
  const words = vchNorm(vchQ).split(/\s+/).filter(Boolean), L = vchAll.filter(v => (!vchSt || vchState(v) === vchSt || (vchSt === 'active' && vchState(v) === 'unassigned')) && words.every(w => vchNorm([v.id, v.holder, v.company, v.note, v.usedSaleNo, v.batchId].join(' ')).includes(w))).sort((a, b) => String(a.id).localeCompare(String(b.id), undefined, { numeric: true }));
  const cnt = {}; vchAll.forEach(v => { const k = vchState(v); cnt[k] = (cnt[k] || 0) + 1; });
  const sel = Object.keys(vchSel).filter(k => vchSel[k]);
  root.innerHTML = `<div class="card"><h3 style="margin-top:0;">🎟️ Vouchers</h3><div style="font-size:.85rem;color:#64748b;margin-bottom:.6rem;">Gumawa ng series ng vouchers → ipa-sign sa COO/President → i-mark na <b>Approved</b> (Super Admin) → i-assign kung kanino nirelease. Sa POS, ang <b>series number</b> lang ang itatype. Isang beses lang magagamit; walang sukli; bawal sa order na may discount.</div>
  <div style="display:flex;gap:.4rem;flex-wrap:wrap;margin-bottom:.5rem;"><input type="search" id="vch-q" placeholder="🔎 Series, pangalan, company, tala" value="${vchE(vchQ)}" style="flex:1;min-width:180px;" oninput="vchQ=this.value;clearTimeout(window._vq);window._vq=setTimeout(vchRender,350)"><button class="btn btn-primary" onclick="vchBatchNew()">➕ Gumawa ng series</button><button class="btn btn-secondary" onclick="vchCsv()">⬇️ Export</button><button class="btn btn-secondary" onclick="loadVouchers()">🔄</button></div>
  <div style="display:flex;gap:.3rem;flex-wrap:wrap;margin-bottom:.5rem;">${[['', 'Lahat (' + vchAll.length + ')'], ['pending', '⏳ Pending (' + (cnt.pending || 0) + ')'], ['active', '✅ Approved (' + ((cnt.active || 0) + (cnt.unassigned || 0)) + ')'], ['used', '✔️ Nagamit (' + (cnt.used || 0) + ')'], ['void', '⛔ Void (' + (cnt.void || 0) + ')']].map(([k, l]) => `<button class="btn ${vchSt === k ? 'btn-primary' : 'btn-secondary'} btn-sm" onclick="vchSt='${k}';vchRender()">${l}</button>`).join('')}</div>
  <div style="border:1px dashed #93c5fd;background:#eff6ff;border-radius:.5rem;padding:.4rem .6rem;margin-bottom:.5rem;display:flex;gap:.4rem;flex-wrap:wrap;align-items:center;font-size:.85rem;"><b>${sel.length} napili</b><button class="btn btn-secondary btn-sm" onclick="vchSelAll(true)">☑️ Piliin lahat ng resulta (${L.length})</button><button class="btn btn-secondary btn-sm" onclick="vchSelAll(false)">✖ Clear</button><button class="btn btn-secondary btn-sm" onclick="vchAssign()">👤 I-assign / i-release sa…</button>${sup ? `<button class="btn btn-success btn-sm" onclick="vchApprove()">✅ I-approve (Super Admin)</button>` : '<small style="color:#92400e;">Super Admin lang ang makakapag-approve.</small>'}<button class="btn btn-danger btn-sm" onclick="vchVoidSel()">⛔ Void</button></div>
  <div style="overflow:auto;"><table class="table" style="font-size:.85rem;"><tr><th><input type="checkbox" onclick="vchSelAll(this.checked)"></th><th>Series</th><th>Company</th><th style="text-align:right;">Halaga</th><th>Naka-assign kay</th><th>Status</th><th>Approval</th><th>Paggamit</th></tr>${L.slice(0, 500).map(v => { const k = vchState(v); return `<tr><td><input type="checkbox" ${vchSel[v.id] ? 'checked' : ''} onchange="vchSel['${vchE(v.id)}']=this.checked;vchRender()"></td><td><b>${vchE(v.id)}</b></td><td>${vchE(v.company)}</td><td style="text-align:right;">₱${Number(v.value || 0).toLocaleString()}</td><td>${vchE(v.holder || '—')}${v.releasedAt ? '<br><small>nirelease ' + vchE(String(v.releasedAt).slice(0, 10)) + '</small>' : ''}${v.note ? '<br><small>' + vchE(v.note) + '</small>' : ''}</td><td style="color:${VCH_ST[k][1]};font-weight:700;">${VCH_ST[k][0]}</td><td>${v.approvedAt ? '<small>' + vchE(v.approverTitle || '') + ' ' + vchE(v.approvedByName || '') + '<br>' + vchE(String(v.approvedAt).slice(0, 10)) + (v.approvalRef ? ' · ' + vchE(v.approvalRef) : '') + '</small>' : ''}</td><td>${v.status === 'used' ? '<small>' + vchE(v.usedSaleNo || '') + '<br>' + vchE(String(v.usedAt || '').slice(0, 16).replace('T', ' ')) + ' · ' + vchE(v.usedByName || '') + '<br>nagamit ₱' + Number(v.usedAmount || 0).toLocaleString() + (+v.forfeited > 0 ? ' · sobra ₱' + Number(v.forfeited).toLocaleString() + ' (walang sukli)' : '') + '</small>' : v.status === 'void' ? '<small>' + vchE(v.voidWhy || '') + '</small>' : ''}</td></tr>`; }).join('') || '<tr><td colspan="8"><small>Walang voucher.</small></td></tr>'}</table></div></div>`;
}
function vchSelAll(on) { vchSel = {}; if (on) { const words = vchNorm(vchQ).split(/\s+/).filter(Boolean); vchAll.filter(v => (!vchSt || vchState(v) === vchSt || (vchSt === 'active' && vchState(v) === 'unassigned')) && words.every(w => vchNorm([v.id, v.holder, v.company, v.note, v.usedSaleNo, v.batchId].join(' ')).includes(w))).forEach(v => { vchSel[v.id] = true; }); } vchRender(); }
async function vchBatchNew() {
  let cos = []; try { (await db.collection('companies').get()).forEach(d => cos.push(d.data().name || d.id)); } catch (e) {} cos.sort();
  arModal(`<h3>➕ Gumawa ng series ng vouchers</h3><div style="font-size:.85rem;color:#64748b;margin-bottom:.5rem;">Hal. 100 pcs na ₱500: Prefix <b>KV</b>, Simula <b>1</b>, Dami <b>100</b> → KV-000001 hanggang KV-000100. Magiging <b>Pending</b> ang lahat hanggang maaprubahan.</div>
  <div class="form-group"><label>Company *</label><select id="vb-co">${cos.map(c => `<option>${vchE(c)}</option>`).join('')}</select></div>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:.5rem;"><div class="form-group"><label>Prefix (opsyonal)</label><input id="vb-pre" placeholder="hal. KV" style="text-transform:uppercase;"></div><div class="form-group"><label>Simulang series no. *</label><input id="vb-start" type="number" min="0" value="1"></div><div class="form-group"><label>Dami (pcs) *</label><input id="vb-n" type="number" min="1" max="2000" value="100"></div><div class="form-group"><label>Halaga bawat isa (₱) *</label><input id="vb-val" type="number" min="1" step="any" value="500"></div><div class="form-group"><label>Ilang digit (padding)</label><input id="vb-pad" type="number" min="1" max="10" value="6"></div><div class="form-group"><label>Expiry (opsyonal)</label><input id="vb-exp" type="date"></div></div>
  <div class="form-group"><label>Tala (opsyonal)</label><input id="vb-note" placeholder="hal. Anniversary promo 2026"></div><div id="vb-err" style="color:#dc2626;font-weight:700;"></div><button class="btn btn-success" onclick="vchBatchSave()">💾 Gumawa</button> <button class="btn btn-secondary" onclick="arCloseModal()">Kanselahin</button>`);
}
async function vchBatchSave() {
  const g = i => (document.getElementById(i) || {}).value || '', err = m => { const e = document.getElementById('vb-err'); if (e) e.textContent = m; };
  const co = g('vb-co'), pre = g('vb-pre').trim().toUpperCase().replace(/[^A-Z0-9]/g, ''), st = Math.floor(+g('vb-start')), n = Math.floor(+g('vb-n')), val = +g('vb-val'), pad = Math.max(1, Math.min(10, Math.floor(+g('vb-pad')) || 6));
  if (!co) return err('Pumili ng company.'); if (!(st >= 0)) return err('Maling simulang series.'); if (!(n >= 1 && n <= 2000)) return err('Dami: 1 hanggang 2000.'); if (!(val > 0)) return err('Ilagay ang halaga.');
  const ids = []; for (let i = 0; i < n; i++) ids.push((pre ? pre + '-' : '') + String(st + i).padStart(pad, '0'));
  const tk = kTask('🎟️ Paggawa ng ' + n + ' voucher', n); try {
    err('Sinusuri ang mga series…'); const exist = new Set(vchAll.map(v => v.id)); const dup = ids.filter(x => exist.has(x)); if (dup.length) { tk.fail('May ' + dup.length + ' series na existing'); return err('May ' + dup.length + ' series na existing na (hal. ' + dup[0] + '). Palitan ang simula/prefix.'); }
    const me = getCurrentUser() || {}, now = new Date().toISOString(), bid = 'B' + Date.now().toString(36), exp = g('vb-exp'), note = g('vb-note').trim(); let done = 0;
    for (let i = 0; i < ids.length; i += 400) { const b = db.batch(); ids.slice(i, i + 400).forEach((id, j) => b.set(db.collection('pos_vouchers').doc(id), { company: co, code: id, series: id, prefix: pre, num: st + i + j, value: val, status: 'pending', holder: '', expires: exp, note, batchId: bid, createdAt: now, createdBy: me.email || '', createdByName: me.name || '' })); await b.commit(); done += Math.min(400, ids.length - i); tk.set(done); }
    try { await logSystemAction('VOUCHER_BATCH', `${n} pcs ₱${val} ${ids[0]}–${ids[ids.length - 1]} (${co})`); } catch (e) {} tk.done('Nagawa: ' + ids[0] + ' – ' + ids[ids.length - 1]); arCloseModal(); loadVouchers();
  } catch (e) { tk.fail(e.message); err('Error: ' + e.message); }
}
async function vchApprove() {
  if (!superAdminIsMe()) { alert('Super Admin lang ang puwedeng mag-approve.'); return; }
  const ids = Object.keys(vchSel).filter(k => vchSel[k] && (vchAll.find(v => v.id === k) || {}).status === 'pending'); if (!ids.length) { alert('Pumili ng mga voucher na Pending.'); return; }
  arModal(`<h3>✅ I-approve ang ${ids.length} voucher</h3><div style="font-size:.85rem;color:#64748b;margin-bottom:.5rem;">Gawin lang ito kapag may pirma na ng COO/President. Magiging <b>Active</b> ang mga ito (kailangan pang i-assign kung kanino).</div><div class="form-group"><label>Sino ang nag-approve? *</label><select id="va-t"><option>COO</option><option>President</option><option>COO & President</option></select></div><div class="form-group"><label>Pangalan ng approver *</label><input id="va-n"></div><div class="form-group"><label>Reference ng approval (hal. memo no.)</label><input id="va-r"></div><div id="va-err" style="color:#dc2626;font-weight:700;"></div><button class="btn btn-success" onclick="vchApproveGo()">✅ I-approve</button> <button class="btn btn-secondary" onclick="arCloseModal()">Kanselahin</button>`);
}
async function vchApproveGo() {
  const g = i => (document.getElementById(i) || {}).value || '', nm = g('va-n').trim(); if (!nm) { document.getElementById('va-err').textContent = 'Ilagay ang pangalan ng approver.'; return; }
  const ids = Object.keys(vchSel).filter(k => vchSel[k] && (vchAll.find(v => v.id === k) || {}).status === 'pending'), me = getCurrentUser() || {}, now = new Date().toISOString(), tk = kTask('✅ Pag-approve ng ' + ids.length + ' voucher', ids.length);
  try { let d = 0; for (let i = 0; i < ids.length; i += 400) { const b = db.batch(); ids.slice(i, i + 400).forEach(id => b.update(db.collection('pos_vouchers').doc(id), { status: 'active', approvedAt: now, approvedBy: me.email || '', approvedByName: nm, approverTitle: g('va-t'), approvalRef: g('va-r').trim(), approvedMarkedBy: me.name || '' })); await b.commit(); d += Math.min(400, ids.length - i); tk.set(d); } try { await logSystemAction('VOUCHER_APPROVED', `${ids.length} pcs · ${g('va-t')} ${nm}`); } catch (e) {} tk.done('Na-approve: ' + ids.length); vchSel = {}; arCloseModal(); loadVouchers(); } catch (e) { tk.fail(e.message); alert('Error: ' + e.message); }
}
async function vchAssign() {
  const ids = Object.keys(vchSel).filter(k => vchSel[k]); if (!ids.length) { alert('Pumili muna ng voucher (i-check).'); return; }
  const bad = ids.filter(k => ['used', 'void'].includes((vchAll.find(v => v.id === k) || {}).status)); if (bad.length) { alert('May napili na nagamit/void na: ' + bad[0] + '. Alisin sa napili.'); return; }
  const cur = ids.length === 1 ? (vchAll.find(v => v.id === ids[0]) || {}) : {};
  arModal(`<h3>👤 I-assign ang ${ids.length} voucher</h3><div style="font-size:.85rem;color:#64748b;margin-bottom:.5rem;">Kung kanino ito nirelease (nakapangalan). Puwedeng baguhin anumang oras hangga't hindi pa nagagamit. Blangko = alisin ang naka-assign.</div><div class="form-group"><label>Nakapangalan kay</label><input id="vs-h" value="${vchE(cur.holder || '')}"></div><div class="form-group"><label>Expiry (opsyonal)</label><input id="vs-e" type="date" value="${vchE(cur.expires || '')}"></div><div class="form-group"><label>Tala</label><input id="vs-n" value="${vchE(cur.note || '')}"></div><button class="btn btn-success" onclick="vchAssignGo()">💾 I-save</button> <button class="btn btn-secondary" onclick="arCloseModal()">Kanselahin</button>`);
}
async function vchAssignGo() {
  const g = i => (document.getElementById(i) || {}).value || '', ids = Object.keys(vchSel).filter(k => vchSel[k]), me = getCurrentUser() || {}, now = new Date().toISOString(), h = g('vs-h').trim(), tk = kTask('👤 Pag-assign ng ' + ids.length + ' voucher', ids.length);
  try { let d = 0; for (let i = 0; i < ids.length; i += 400) { const b = db.batch(); ids.slice(i, i + 400).forEach(id => b.update(db.collection('pos_vouchers').doc(id), { holder: h, expires: g('vs-e'), note: g('vs-n').trim(), releasedAt: h ? now : '', releasedBy: h ? (me.email || '') : '' })); await b.commit(); d += Math.min(400, ids.length - i); tk.set(d); } try { await logSystemAction('VOUCHER_ASSIGN', `${ids.length} pcs → ${h || '(alisin)'}`); } catch (e) {} tk.done('Na-assign: ' + ids.length); vchSel = {}; arCloseModal(); loadVouchers(); } catch (e) { tk.fail(e.message); alert('Error: ' + e.message); }
}
async function vchVoidSel() {
  const ids = Object.keys(vchSel).filter(k => vchSel[k] && !['used', 'void'].includes((vchAll.find(v => v.id === k) || {}).status)); if (!ids.length) { alert('Pumili ng voucher na hindi pa nagagamit.'); return; }
  const why = await uiPrompt('⛔ I-void ang ' + ids.length + ' voucher. Dahilan:', ''); if (why === null) return; if (!String(why).trim()) { alert('Kailangan ng dahilan.'); return; }
  const tk = kTask('⛔ Pag-void ng ' + ids.length + ' voucher', ids.length), me = getCurrentUser() || {}; try { let d = 0; for (let i = 0; i < ids.length; i += 400) { const b = db.batch(); ids.slice(i, i + 400).forEach(id => b.update(db.collection('pos_vouchers').doc(id), { status: 'void', voidWhy: String(why).trim(), voidAt: new Date().toISOString(), voidBy: me.email || '' })); await b.commit(); d += Math.min(400, ids.length - i); tk.set(d); } try { await logSystemAction('VOUCHER_VOID', ids.length + ' pcs: ' + why); } catch (e) {} tk.done('Na-void: ' + ids.length); vchSel = {}; loadVouchers(); } catch (e) { tk.fail(e.message); alert('Error: ' + e.message); }
}
function vchCsv() {
  const rows = [['Series', 'Company', 'Halaga', 'Status', 'Naka-assign kay', 'Nirelease', 'Expiry', 'Approved ni', 'Approval ref', 'Nagamit sa', 'Petsa', 'Cashier', 'Nagamit na halaga', 'Sobra', 'Tala']].concat(vchAll.map(v => [v.id, v.company, v.value, vchState(v), v.holder || '', (v.releasedAt || '').slice(0, 10), v.expires || '', ((v.approverTitle || '') + ' ' + (v.approvedByName || '')).trim(), v.approvalRef || '', v.usedSaleNo || '', (v.usedAt || '').slice(0, 16), v.usedByName || '', v.usedAmount || '', v.forfeited || '', v.note || '']));
  const csv = rows.map(r => r.map(c => '"' + String(c == null ? '' : c).replace(/"/g, '""') + '"').join(',')).join('\r\n'), a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv' })); a.download = 'vouchers_' + new Date().toISOString().slice(0, 10) + '.csv'; a.click();
}


/* ===================== 📊 POS WEB DASHBOARD (Admin) ===================== */
let pdRows = [], pdRange = 'today', pdCo = '', pdSite = '', pdTimer = null;
const pdE = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const pdM = n => Number(n || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
function pdDates() { const d = new Date(), f = x => x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0'), t = f(d); if (pdRange === 'today') return [t, t]; if (pdRange === 'yday') { const y = new Date(d.getTime() - 864e5); return [f(y), f(y)]; } if (pdRange === '7d') return [f(new Date(d.getTime() - 6 * 864e5)), t]; if (pdRange === '30d') return [f(new Date(d.getTime() - 29 * 864e5)), t]; return [t.slice(0, 8) + '01', t]; }
async function loadPosDash(keep) {
  const root = document.getElementById('pdash-root'); if (!root) return; if (!keep) root.innerHTML = '<div class="card">Kinukuha ang benta…</div>'; clearTimeout(pdTimer);
  try { const [a, b] = pdDates(), s = await db.collection('pos_sales').where('date', '>=', a).where('date', '<=', b).get(); pdRows = []; s.forEach(d => pdRows.push(Object.assign({ id: d.id }, d.data()))); pdRender(); pdTimer = setTimeout(() => { if (document.getElementById('pdash-root') && document.getElementById('view-admin-posdash') && document.getElementById('view-admin-posdash').style.display !== 'none') loadPosDash(true); }, 60000); }
  catch (e) { root.innerHTML = '<div class="card" style="color:#dc2626;">Error: ' + pdE(e.message) + '</div>'; }
}
function pdAgg(L) {
  const R = { n: 0, vd: 0, total: 0, gross: 0, vat: 0, svc: 0, disc: 0, hour: Array(24).fill(0), day: {}, site: {}, pay: {}, chan: {}, item: {} };
  L.forEach(x => { if (x.status === 'void') { R.vd++; return; } R.n++; R.total += +x.total || 0; R.gross += +x.gross || 0; R.vat += +x.vatAmt || 0; R.svc += +x.svc || 0; R.disc += ((x.pc || {}).disc || 0) + ((x.pc || {}).sc || 0) + ((x.pc || {}).pwd || 0); const h = new Date(x.atMs || x.at || 0).getHours(); if (h >= 0) R.hour[h] += +x.total || 0; R.day[x.date] = (R.day[x.date] || 0) + (+x.total || 0); const sn = x.siteName || x.site || '—'; R.site[sn] = (R.site[sn] || 0) + (+x.total || 0); (x.pays || []).forEach(p => { const k = p.mode; R.pay[k] = (R.pay[k] || 0) + (+p.amount || 0); }); const cn = x.chName || 'Dine-in/Counter'; R.chan[cn] = (R.chan[cn] || 0) + (+x.total || 0); (x.items || []).forEach(i => { const o = R.item[i.name] = R.item[i.name] || { q: 0, a: 0 }; o.q += +i.qty || 0; o.a += (+i.qty || 0) * (+i.price || 0); }); });
  return R;
}
function pdBars(obj, fmt, max) { const e = Object.entries(obj).filter(x => x[1] > 0).sort((a, b) => b[1] - a[1]).slice(0, max || 10), m = Math.max(1, ...e.map(x => x[1])); return e.length ? e.map(([k, v]) => `<div style="display:flex;align-items:center;gap:.4rem;font-size:.82rem;margin:.15rem 0;"><span style="width:38%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${pdE(k)}">${pdE(k)}</span><div style="flex:1;background:#e2e8f0;border-radius:4px;height:14px;"><div style="width:${(v / m * 100).toFixed(1)}%;background:#2563eb;height:14px;border-radius:4px;"></div></div><b style="width:96px;text-align:right;">${fmt(v)}</b></div>`).join('') : '<small style="color:#64748b;">Walang data.</small>'; }
function pdRender() {
  const root = document.getElementById('pdash-root'); if (!root) return; const cos = [...new Set(pdRows.map(x => x.company).filter(Boolean))].sort(), sites = [...new Set(pdRows.filter(x => !pdCo || x.company === pdCo).map(x => x.siteName || x.site).filter(Boolean))].sort();
  const L = pdRows.filter(x => (!pdCo || x.company === pdCo) && (!pdSite || (x.siteName || x.site) === pdSite)), R = pdAgg(L), hmax = Math.max(1, ...R.hour), days = Object.keys(R.day).sort(), dmax = Math.max(1, ...days.map(d => R.day[d]));
  const tile = (l, v, c) => `<div style="flex:1;min-width:140px;border:1px solid #e2e8f0;border-radius:.6rem;padding:.6rem .8rem;background:#fff;"><div style="font-size:.75rem;color:#64748b;">${l}</div><div style="font-size:1.35rem;font-weight:800;color:${c || '#0f172a'};">${v}</div></div>`;
  const PL = { cash: '💵 Cash', gcash: 'GCash', maya: 'Maya', qrph: 'QR Ph', debit: 'Debit', credit: 'Credit', intl: 'Intl card', paypal: 'PayPal', bank: 'Bank', member: 'Member charge', org: 'Org charge', voucher: 'Voucher', giftcard: 'Gift card', points: 'Points' }, pay = {}; Object.keys(R.pay).forEach(k => { pay[PL[k] || k] = R.pay[k]; });
  const items = {}; Object.keys(R.item).forEach(k => { items[k + ' (' + R.item[k].q + 'x)'] = R.item[k].a; });
  root.innerHTML = `<div class="card"><div style="display:flex;gap:.4rem;flex-wrap:wrap;align-items:center;margin-bottom:.6rem;"><h3 style="margin:0;flex:1;">📊 POS Dashboard</h3>${[['today', 'Ngayon'], ['yday', 'Kahapon'], ['7d', '7 araw'], ['30d', '30 araw'], ['month', 'Buwan']].map(([k, l]) => `<button class="btn ${pdRange === k ? 'btn-primary' : 'btn-secondary'} btn-sm" onclick="pdRange='${k}';loadPosDash()">${l}</button>`).join('')}<select onchange="pdCo=this.value;pdSite='';pdRender()"><option value="">Lahat ng company</option>${cos.map(c => `<option ${c === pdCo ? 'selected' : ''}>${pdE(c)}</option>`).join('')}</select><select onchange="pdSite=this.value;pdRender()"><option value="">Lahat ng branch</option>${sites.map(c => `<option ${c === pdSite ? 'selected' : ''}>${pdE(c)}</option>`).join('')}</select><button class="btn btn-secondary btn-sm" onclick="loadPosDash()">🔄</button></div>
  <div style="display:flex;gap:.5rem;flex-wrap:wrap;margin-bottom:.8rem;">${tile('Benta (total)', '₱' + pdM(R.total), '#166534')}${tile('Transaksyon', R.n)}${tile('Average ticket', '₱' + pdM(R.n ? R.total / R.n : 0))}${tile('VAT', '₱' + pdM(R.vat))}${tile('Service charge', '₱' + pdM(R.svc))}${tile('Discounts', '₱' + pdM(R.disc), '#b45309')}${tile('Void', R.vd, R.vd ? '#b91c1c' : '')}</div>
  <h4 style="margin:.4rem 0;">Benta kada oras</h4><div style="display:flex;align-items:flex-end;gap:2px;height:110px;border-bottom:1px solid #cbd5e1;">${R.hour.map((v, h) => `<div title="${h}:00 — ₱${pdM(v)}" style="flex:1;background:#2563eb;height:${(v / hmax * 100).toFixed(1)}%;min-height:${v > 0 ? 2 : 0}px;border-radius:2px 2px 0 0;"></div>`).join('')}</div><div style="display:flex;gap:2px;font-size:.62rem;color:#64748b;">${R.hour.map((v, h) => `<div style="flex:1;text-align:center;">${h % 3 === 0 ? h : ''}</div>`).join('')}</div>
  ${days.length > 1 ? `<h4 style="margin:.8rem 0 .4rem;">Benta kada araw</h4><div style="display:flex;align-items:flex-end;gap:3px;height:100px;border-bottom:1px solid #cbd5e1;">${days.map(d => `<div title="${d} — ₱${pdM(R.day[d])}" style="flex:1;background:#16a34a;height:${(R.day[d] / dmax * 100).toFixed(1)}%;border-radius:2px 2px 0 0;"></div>`).join('')}</div><div style="font-size:.7rem;color:#64748b;display:flex;justify-content:space-between;"><span>${days[0]}</span><span>${days[days.length - 1]}</span></div>` : ''}
  <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:1rem;margin-top:.8rem;"><div><h4 style="margin:.2rem 0;">Top items</h4>${pdBars(items, v => '₱' + pdM(v), 10)}</div><div><h4 style="margin:.2rem 0;">Branch</h4>${pdBars(R.site, v => '₱' + pdM(v), 10)}<h4 style="margin:.8rem 0 .2rem;">Bayad</h4>${pdBars(pay, v => '₱' + pdM(v), 10)}<h4 style="margin:.8rem 0 .2rem;">Channel</h4>${pdBars(R.chan, v => '₱' + pdM(v), 10)}</div></div><small style="color:#64748b;display:block;margin-top:.6rem;">Awtomatikong nagre-refresh kada 1 minuto. Hindi kasama ang void sa total.</small></div>`;
}

/* ---- Messenger loader: siguradong lalabas ang 💬 (kahit stale ang cache o hindi na-load ang script) ---- */
(function () {
  const go = () => {
    if (document.getElementById('km-fab')) return;
    const s = document.createElement('script'); s.src = 'messenger.js?v=3&t=' + Date.now(); document.head.appendChild(s);
    setTimeout(() => {
      if (document.getElementById('km-fab')) return;
      const b = document.createElement('button'); b.id = 'km-fab'; b.textContent = '💬'; b.title = 'Messenger (hindi na-load)';
      b.style.cssText = 'position:fixed;right:14px;bottom:14px;z-index:9990;width:54px;height:54px;border-radius:50%;border:0;background:#dc2626;color:#fff;font-size:26px;cursor:pointer;box-shadow:0 4px 14px #0005';
      b.onclick = () => alert('Hindi ma-load ang messenger.js. Siguraduhing nasa parehong folder ng admin.html ang messenger.js (i-upload ito), tapos Ctrl+F5.');
      document.body.appendChild(b);
    }, 3500);
  };
  if (document.readyState === 'complete') setTimeout(go, 1500); else window.addEventListener('load', () => setTimeout(go, 1500));
})();

/* ---- XSS defense-in-depth: neutralize HTML tag characters in ALL text coming from Firestore ----
   Ang mga < at > sa data ay ginagawang ＜ ＞ (hindi na makakabuo ng tag/script). Plain-text lang ang data ng ERP kaya walang nasisira. */
(function () {
  try {
    const san = v => {
      if (typeof v === 'string') return (v.indexOf('<') < 0 && v.indexOf('>') < 0) ? v : v.replace(/</g, '＜').replace(/>/g, '＞');
      if (Array.isArray(v)) { for (let i = 0; i < v.length; i++) v[i] = san(v[i]); return v; }
      if (v && typeof v === 'object' && Object.getPrototypeOf(v) === Object.prototype) { for (const k in v) v[k] = san(v[k]); return v; }
      return v;
    };
    window.__kSan = san;
    const F = window.firebase && firebase.firestore; if (!F) return;
    [F.DocumentSnapshot, F.QueryDocumentSnapshot].forEach(C => { if (!C || !C.prototype || C.prototype.__kSan || typeof C.prototype.data !== 'function') return; const d0 = C.prototype.data; C.prototype.data = function () { return san(d0.apply(this, arguments)); }; C.prototype.__kSan = 1; });
  } catch (e) { console.warn('[san]', e); }
})();
