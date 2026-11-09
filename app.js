// ===== Modal na dialogs (kapalit ng alert / confirm / prompt ng browser) =====
const _nativeAlert = window.alert.bind(window);
(function () {
  const NAT = () => navigator.webdriver; let q = Promise.resolve();
  const esc = t => String(t == null ? '' : t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  function kind(m) { m = String(m || ''); if (/^\s*(✅|🎉|👍)/.test(m) || /\b(na-save|naidagdag|natapos|success)\b/i.test(m)) return ['#16a34a', '✅', 'Tagumpay']; if (/^\s*(⛔|❌)|\b(error|hindi|walang|mali|failed|bawal|kulang)\b/i.test(m)) return ['#dc2626', '⚠️', 'Paalala']; return ['#2563eb', 'ℹ️', 'Mensahe']; }
  function show(opts) {
    return new Promise(res => {
      const k = opts.kind || kind(opts.msg), o = document.createElement('div'); o.className = 'ui-dlg-ov'; o.style.cssText = 'position:fixed;inset:0;background:rgba(15,23,42,.55);z-index:100000;display:flex;align-items:center;justify-content:center;padding:16px;';
      const msg = String(opts.msg == null ? '' : opts.msg).replace(/^\s*(✅|⛔|❌|⚠️|ℹ️|🎉)\s*/, '');
      o.innerHTML = `<div role="dialog" aria-modal="true" style="background:#fff;color:#0f172a;border-radius:14px;width:100%;max-width:420px;max-height:88vh;overflow:auto;box-shadow:0 20px 50px rgba(0,0,0,.35);border-top:5px solid ${k[0]};"><div style="padding:18px 20px 6px;display:flex;gap:10px;align-items:center;"><span style="font-size:1.5rem;">${opts.icon || k[1]}</span><b style="font-size:1.05rem;">${esc(opts.title || k[2])}</b></div><div style="padding:6px 20px 14px;white-space:pre-wrap;word-break:break-word;font-size:.95rem;line-height:1.5;">${esc(msg)}</div>${opts.input ? `<div style="padding:0 20px 14px;"><input class="ui-dlg-in" style="width:100%;padding:.55rem .7rem;border:1px solid #cbd5e1;border-radius:8px;font-size:1rem;box-sizing:border-box;" value="${esc(opts.def || '')}"></div>` : ''}<div style="padding:10px 20px 18px;display:flex;gap:8px;justify-content:flex-end;">${opts.cancel ? '<button class="ui-dlg-c" style="padding:.55rem 1rem;border:1px solid #cbd5e1;background:#f8fafc;border-radius:8px;font-size:.95rem;cursor:pointer;">Kanselahin</button>' : ''}<button class="ui-dlg-ok" style="padding:.55rem 1.2rem;border:0;background:${k[0]};color:#fff;border-radius:8px;font-size:.95rem;font-weight:600;cursor:pointer;">${esc(opts.ok || 'OK')}</button></div></div>`;
      let done = false; const inp = o.querySelector('.ui-dlg-in');
      const fin = v => { if (done) return; done = true; document.removeEventListener('keydown', kd, true); o.remove(); res(v); };
      const kd = e => { if (e.key === 'Escape') { e.stopPropagation(); fin(opts.input ? null : (opts.cancel ? false : undefined)); } else if (e.key === 'Enter' && (opts.input || document.activeElement === document.body || document.activeElement.className === 'ui-dlg-ok')) { e.preventDefault(); e.stopPropagation(); fin(opts.input ? inp.value : (opts.cancel ? true : undefined)); } };
      o.querySelector('.ui-dlg-ok').onclick = () => fin(opts.input ? inp.value : (opts.cancel ? true : undefined));
      const c = o.querySelector('.ui-dlg-c'); if (c) c.onclick = () => fin(opts.input ? null : false);
      document.addEventListener('keydown', kd, true); document.body.appendChild(o); (inp || o.querySelector('.ui-dlg-ok')).focus(); if (inp) inp.select();
    });
  }
  window.alert = function (m) { if (NAT()) return _nativeAlert(m); q = q.then(() => show({ msg: m })); };
  window.uiAlert = function (m) { if (NAT()) { window.alert(m); return Promise.resolve(); } return (q = q.then(() => show({ msg: m }))); };
  window.uiConfirm = function (m, o) { if (NAT()) return Promise.resolve(window.confirm(m)); return (q = q.then(() => show(Object.assign({ msg: m, cancel: true, kind: ['#d97706', '❓', 'Kumpirmasyon'], ok: 'Oo, ituloy' }, o || {})))); };
  window.uiPrompt = function (m, d) { if (NAT()) return Promise.resolve(window.prompt(m, d)); return (q = q.then(() => show({ msg: m, input: true, def: d, cancel: true, kind: ['#2563eb', '✏️', 'Ilagay'] }))); };
})();
// Sinusukat ang bilis ng bawat Firestore read (para sa System Health ng admin)
(function installFsProbe() {
  try {
    if (window.__fsStats || typeof firebase === 'undefined' || !firebase.firestore) return;
    const st = window.__fsStats = { calls: 0, docs: 0, errors: 0, ms: 0, slow: [], start: Date.now() };
    const wrap = proto => { const orig = proto && proto.get; if (!orig) return; proto.get = function (...a) { const t0 = performance.now(); let path = ''; try { const q = this._delegate && (this._delegate._query || this._delegate._key); path = (q && q.path && q.path.canonicalString && q.path.canonicalString()) || this.path || ''; } catch (e) {}
      return orig.apply(this, a).then(r => { const ms = performance.now() - t0, n = r && typeof r.size === 'number' ? r.size : 1; st.calls++; st.ms += ms; st.docs += n; if (ms > 800 || n > 300) { st.slow.push({ path, ms: Math.round(ms), docs: n, at: Date.now() }); st.slow.sort((x, y) => y.ms - x.ms); st.slow = st.slow.slice(0, 10); } return r; }, e => { st.errors++; throw e; }); }; };
    wrap(firebase.firestore.Query.prototype); wrap(firebase.firestore.DocumentReference.prototype);
  } catch (e) {}
})();

// ==========================================================================
// STRICT PRODUCT CODE UNIQUENESS VALIDATION ENGINE
// Tinitiyak na walang kaparehong POS Code o SAP Code sa buong products collection.
// Pinapayagan ang magkaparehong Item Description (itemName) para sa multi-supplier variants.
// ==========================================================================
async function validateProductCodesUnique(posCode, sapCode, excludeDocId = null) {
  if (typeof db === 'undefined' || !db) return { isUnique: true };

  const cleanPos = (posCode || '').toUpperCase().trim();
  const cleanSap = (sapCode || '').toUpperCase().trim();

  try {
    const snap = await db.collection('products').get();
    for (const doc of snap.docs) {
      if (excludeDocId && doc.id === excludeDocId) continue;
      const data = doc.data();
      const existingPos = (data.posCode || data.pos_code || '').toUpperCase().trim();
      const existingSap = (data.sapCode || data.itemCode || doc.id).toUpperCase().trim();

      if (cleanSap && existingSap === cleanSap) {
        return {
          isUnique: false,
          conflictType: 'SAP / Sub Code',
          conflictingCode: cleanSap,
          existingItemName: data.itemName || 'Ibang Produkto'
        };
      }

      if (cleanPos && existingPos === cleanPos) {
        return {
          isUnique: false,
          conflictType: 'POS Code',
          conflictingCode: cleanPos,
          existingItemName: data.itemName || 'Ibang Produkto'
        };
      }
    }
    return { isUnique: true };
  } catch (err) {
    console.error('Error sa pag-validate ng code uniqueness:', err);
    return { isUnique: true };
  }
}


// ========================================================
// MODERN TOAST NOTIFICATIONS (Replaces ugly alerts)
// ========================================================
window.showToast = function(title, message, type = 'success') {
  const container = document.getElementById('toast-container');
  if (!container) {
    alert(title + "\n" + message); // Fallback
    return;
  }
  
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  
  let icon = '✅';
  if (type === 'error') icon = '❌';
  if (type === 'warning') icon = '⚠️';
  
  toast.innerHTML = `
    <div class="toast-icon">${icon}</div>
    <div class="toast-content">
      <div class="toast-title">${title}</div>
      <div class="toast-message">${message}</div>
    </div>
  `;
  
  container.appendChild(toast);
  
  // Trigger animation
  setTimeout(() => toast.classList.add('show'), 10);
  
  // Auto remove
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 4000);
};

// Override default alert function globally to use modern toast if possible
window.originalAlert = window.alert;
window.alert = function(msg) {
  if (document.getElementById('toast-container')) {
    if (msg.includes('Error') || msg.includes('❌') || msg.includes('BABALA')) {
      showToast('System Notice', msg, 'error');
    } else if (msg.includes('⚠️')) {
      showToast('Attention Required', msg, 'warning');
    } else {
      showToast('KusinaERP', msg, 'success');
    }
  } else {
    window.originalAlert(msg);
  }
};

// KusinaERP Central Universal Script (app.js)
// Centralized Auth, Admin, Commissary, Branch, and Station-by-Station Picking Guide System.


// ========================================================
// RESPONSIVE SIDEBAR TOGGLE ENGINE
// ========================================================
window.toggleSidebar = function() {
  const sidebar = document.getElementById('app-sidebar');
  const mainWrapper = document.querySelector('.main-wrapper');
  if (!sidebar) return;
  
  if (window.innerWidth > 768) {
    sidebar.classList.toggle('hidden');
  } else {
    sidebar.classList.toggle('mobile-open');
    if (mainWrapper) {
      mainWrapper.classList.toggle('mobile-open');
      // Fix for body scrolling issue on some mobile browsers when sidebar is open
      if (sidebar.classList.contains('mobile-open')) {
          document.body.classList.add('menu-open');
      } else {
          document.body.classList.remove('menu-open');
      }
    }
  }
};

// Auto close sidebar on mobile when a menu item is clicked or background is tapped
document.addEventListener('DOMContentLoaded', () => {
    const closeSidebarMobile = () => {
        if (window.innerWidth <= 768) {
            const sidebar = document.getElementById('app-sidebar');
            const mainWrapper = document.querySelector('.main-wrapper');
            if (sidebar) sidebar.classList.remove('mobile-open');
            if (mainWrapper) mainWrapper.classList.remove('mobile-open');
            document.body.classList.remove('menu-open');
        }
    };

    const menuItems = document.querySelectorAll('.menu-item');
    menuItems.forEach(item => {
        item.addEventListener('click', closeSidebarMobile);
    });

    // Tap outside to close (overlay / main content). Huwag isara kapag ang pinindot ay ang sidebar mismo
    // o ang hamburger button (dating bug: nagbubukas tapos agad ding sumasara dahil sa bubbling).
    document.addEventListener('click', (e) => {
        if (window.innerWidth <= 768 && document.body.classList.contains('menu-open')) {
            if (e.target.closest && (e.target.closest('.sidebar') || e.target.closest('.hamburger-btn'))) return;
            closeSidebarMobile();
        }
    });
    window.addEventListener('resize', () => {
        if (window.innerWidth > 768) {
            document.body.classList.remove('menu-open');
            const sb = document.getElementById('app-sidebar');
            const mw = document.querySelector('.main-wrapper');
            if (sb) sb.classList.remove('mobile-open');
            if (mw) mw.classList.remove('mobile-open');
        }
    });
});


// ==========================================
// 1. AUTHENTICATION & ACCESS CONTROL (auth)
// ==========================================
const AUTH_KEY = 'kusina_current_user';
const INACTIVITY_LIMIT_MS = 10 * 60 * 1000; // 10 minutes
const WARNING_LIMIT_MS = 9 * 60 * 1000;    // 9 minutes

let inactivityTimer = null;
let warningTimer = null;
let warningCountdownInterval = null;

// Accidental Back-Button Exit Trap
window.addEventListener('load', () => {
  if (typeof history !== 'undefined' && history.pushState) {
    history.pushState(null, document.title, location.href);
  }
  checkGooglePasswordRequirement();
});

window.addEventListener('popstate', async function () {
  history.pushState(null, document.title, location.href);
  const confirmExit = await uiConfirm("Gusto mo bang mag-logout ngayon? Lahat ng hindi na-save na data ay mawawala.");
  if (confirmExit) {
    logoutUser();
  }
});

function resetInactivityTimers() {
  clearTimeout(inactivityTimer);
  clearTimeout(warningTimer);
  clearInterval(warningCountdownInterval);
  
  const warnModal = document.getElementById('inactivity-modal');
  if (warnModal) warnModal.style.display = 'none';

  warningTimer = setTimeout(showInactivityWarning, WARNING_LIMIT_MS);
  inactivityTimer = setTimeout(forceAutoLogout, INACTIVITY_LIMIT_MS);
}

function showInactivityWarning() {
  let modal = document.getElementById('inactivity-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'inactivity-modal';
    modal.className = 'modal-overlay';
    modal.innerHTML = `
      <div class="modal-content" style="max-width: 400px; text-align: center;">
        <h3 style="color: #ef4444; margin-bottom: 0.5rem;">⚠️ Inactivity Warning</h3>
        <p style="font-size: 0.9rem; margin-bottom: 1rem; color: #475569;">
          Walang aktibidad sa screen. Awtomatikong magla-logout ang system sa loob ng 
          <b id="inactivity-seconds">60</b> segundo para sa seguridad.
        </p>
        <button type="button" class="btn btn-primary" onclick="resetInactivityTimers()">Manatiling Naka-login</button>
      </div>
    `;
    document.body.appendChild(modal);
  }
  modal.style.display = 'flex';
  
  let remaining = 60;
  const secEl = document.getElementById('inactivity-seconds');
  warningCountdownInterval = setInterval(() => {
    remaining--;
    if (secEl) secEl.textContent = remaining;
    if (remaining <= 0) clearInterval(warningCountdownInterval);
  }, 1000);
}

function forceAutoLogout() {
  alert('Nag-auto logout ang system dahil sa 10 minutong kawalan ng aktibidad.');
  logoutUser();
}

['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll'].forEach(evt => {
  window.addEventListener(evt, resetInactivityTimers, { passive: true });
});
resetInactivityTimers();

window.getCurrentUser = function() {
  const data = localStorage.getItem(AUTH_KEY);
  return data ? JSON.parse(data) : null;
};
function getCurrentUser() {
  const data = localStorage.getItem(AUTH_KEY);
  return data ? JSON.parse(data) : null;
}

window.setCurrentUser = function(user) {
  localStorage.setItem(AUTH_KEY, JSON.stringify(user));
};
function setCurrentUser(user) {
  localStorage.setItem(AUTH_KEY, JSON.stringify(user));
}

function logoutUser() {
  try { localStorage.removeItem('kerp_login_at'); } catch (e) {}
  if (typeof auth !== 'undefined' && auth && auth.signOut) {
    logSystemAction('LOGOUT', 'User securely logged out.'); auth.signOut().catch(() => {});
  }
  localStorage.removeItem(AUTH_KEY);
  window.location.href = 'index.html';
}

function normalizeRole(role) {
  if (!role) return '';
  const r = String(role).toLowerCase().trim();
  if (r.includes('admin') || r.includes('accounting') || r.includes('head')) return 'admin';
  if (r.includes('commi') || r.includes('kitchen') || r.includes('plant')) return 'commissary';
  if (r.includes('branch') || r.includes('store') || r.includes('outlet')) return 'branch';
  return r;
}

function enforceRoleAccess(allowedRoles) {
  const user = getCurrentUser();
  if (!user) {
    uiAlert('Kailangan munang mag-login.').then(() => { window.location.href = 'index.html'; });
    return;
  }
  if (user.status !== 'active') {
    alert('Naka-pending o disabled pa ang iyong account. Makipag-ugnayan sa Head Office Admin.');
    logoutUser();
    return;
  }

  const userRole = normalizeRole(user.role);
  const normalizedAllowed = allowedRoles.map(r => normalizeRole(r));

  if (!normalizedAllowed.includes(userRole)) {
    alert('Access Denied: Wala kang pahintulot na buksan ang pahinang ito.');
    redirectToRoleDashboard(user.role);
  }
}

window.redirectToRoleDashboard = function(role) {
  const cleanRole = normalizeRole(role);
  if (cleanRole === 'admin') window.location.href = 'admin.html';
  else if (cleanRole === 'commissary') window.location.href = 'commissary.html';
  else window.location.href = 'branch.html';
};
function redirectToRoleDashboard(role) {
  const cleanRole = normalizeRole(role);
  if (cleanRole === 'admin') {
    window.location.href = 'admin.html';
  } else if (cleanRole === 'commissary') {
    window.location.href = 'commissary.html';
  } else if (cleanRole === 'branch') {
    window.location.href = 'branch.html';
  } else {
    alert(`Naka-set ang role mo bilang "${role}", ngunit hindi pa ito na-a-assign sa Admin, Commissary, o Branch portal.`);
    logoutUser();
  }
}

function checkGooglePasswordRequirement() {
  const user = getCurrentUser();
  if (!user) return;
  if (user.requiresPasswordSetup) {
    renderPasswordSetupModal();
  }
}

function renderPasswordSetupModal() {
  let modal = document.getElementById('password-setup-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'password-setup-modal';
    modal.className = 'modal-overlay';
    modal.innerHTML = `
      <div class="modal-content">
        <h3 style="color: #1e293b; margin-bottom: 0.5rem;">🔒 Create Local Password</h3>
        <p style="font-size: 0.85rem; color: #64748b; margin-bottom: 1rem;">
          Nag-sign in ka gamit ang Google Account. Para ma-secure ang account at magkaroon ka ng backup login gamit ang email/password, mag-set up ng iyong sariling password (Minimum 6 characters).
        </p>
        <div class="form-group">
          <label>New Password</label>
          <input type="password" id="new-setup-pass" placeholder="••••••••" required>
        </div>
        <div class="form-group">
          <label>Confirm Password</label>
          <input type="password" id="confirm-setup-pass" placeholder="••••••••" required>
        </div>
        <button type="button" class="btn btn-primary" style="width: 100%; margin-top: 0.5rem;" onclick="submitPasswordSetup()">Save Password & Secure Account</button>
      </div>
    `;
    document.body.appendChild(modal);
  }
  modal.style.display = 'flex';
}

async function submitPasswordSetup() {
  const p1 = document.getElementById('new-setup-pass').value;
  const p2 = document.getElementById('confirm-setup-pass').value;

  if (!p1 || p1.length < 6) {
    alert('Dapat ay hindi bababa sa 6 characters ang password.');
    return;
  }
  if (p1 !== p2) {
    alert('Hindi magkatugma ang dalawang password.');
    return;
  }

  if (typeof auth !== 'undefined' && auth && auth.currentUser) {
    try {
      await auth.currentUser.updatePassword(p1);
    } catch (e) {
      console.warn('Firebase password update:', e);
    }
  }

  const user = getCurrentUser();
  if (user) {
    user.requiresPasswordSetup = false;
    setCurrentUser(user);

    if (typeof db !== 'undefined' && db && user.email) {
      db.collection('users').doc(user.email.toLowerCase()).update({
        hasPasswordSet: true
      }).catch(err => console.warn(err));
    }
  }

  alert('Matagumpay na nai-set ang iyong password!');
  const modal = document.getElementById('password-setup-modal');
  if (modal) modal.style.display = 'none';
}


// ==========================================
// 2. ADMIN PORTAL LOGIC
// ==========================================
async function loadFirestoreUsers() {
  const tbody = document.getElementById('user-approval-table');
  if (!tbody) return;
  await superAdminLoad(); const SUP = superAdminIsMe(); try { const tb = tbody.closest('table'); const o = document.getElementById('super-admin-bar'); if (o) o.remove(); if (tb) tb.insertAdjacentHTML('beforebegin', `<div id="super-admin-bar" style="margin-bottom:.5rem;padding:.5rem .8rem;background:#fefce8;border:1px solid #fde68a;border-radius:8px;font-size:.85rem;">👑 <b>Super Admin:</b> ${superAdminState.emails.map(e => srchEsc(e)).join(', ')} ${SUP ? '<button class="btn btn-sm btn-secondary" onclick="superAdminSet()">✏️ I-set</button>' : '<br><small style="color:#64748b;">Super Admin lang ang puwedeng gumawa, mag-edit o magbura ng Admin account.</small>'}</div>`); } catch (e) {}

  if (typeof db === 'undefined' || !db) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: #ef4444;">Hindi ma-access ang Firestore database. Pakisuri ang firebase-config.js.</td></tr>';
    return;
  }

  try {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: #64748b;">Kinukuha ang mga users mula sa Firestore...</td></tr>';
    const snapshot = await db.collection('users').get();

    if (snapshot.empty) {
      tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: #64748b;">Walang nakitang users sa database.</td></tr>';
      return;
    }

    let rowsHtml = '';
    snapshot.forEach(doc => {
      const data = doc.data();
      const email = doc.id;
      const name = data.name || email.split('@')[0];
      const role = (data.role || 'pending').toLowerCase().trim();
      const status = (data.status || 'pending').toLowerCase().trim();
      const branch = data.branch || data.requestedStation || '';

      const lockRow = !SUP && /(admin|accounting|head)/.test(role);
      rowsHtml += `
        <tr id="user-row-${email.replace(/[@.]/g, '_')}">
          <td>
            <b>${name}</b><br>
            <small style="color: #64748b;">${email}</small>
          </td>
          <td>
            <input type="text" id="station-${email.replace(/[@.]/g, '_')}" value="${branch}" placeholder="Hal: Commissary Meat / Branch ATC" style="font-size: 0.85rem; padding: 0.35rem 0.5rem;">
          </td>
          <td>
            <select id="role-${email.replace(/[@.]/g, '_')}" ${lockRow ? 'disabled' : ''} style="font-size: 0.85rem; padding: 0.35rem 0.5rem;">
              <option value="branch" ${role === 'branch' ? 'selected' : ''}>Branch Operations</option>
              <option value="commissary" ${role === 'commissary' ? 'selected' : ''}>Commissary Hub</option>
              <option value="admin" ${role === 'admin' ? 'selected' : ''} ${SUP ? '' : 'disabled'}>Head Office Admin${SUP ? '' : ' 🔒'}</option>
              <option value="pending" ${role === 'pending' ? 'selected' : ''}>Pending (No Access)</option>
            </select>
          </td>
          <td>
            <select id="status-${email.replace(/[@.]/g, '_')}" ${lockRow ? 'disabled' : ''} style="font-size: 0.85rem; padding: 0.35rem 0.5rem;">
              <option value="active" ${status === 'active' ? 'selected' : ''}>Active (Papasok)</option>
              <option value="pending" ${status === 'pending' ? 'selected' : ''}>Pending (Bawal)</option>
              <option value="disabled" ${status === 'disabled' ? 'selected' : ''}>Disabled (Blocked)</option>
            </select>
          </td>
          <td>
            ${lockRow ? '<small>🔒 Super Admin lang</small>' : `<button class="btn btn-sm btn-primary" onclick="saveUserRole('${email}')">💾 I-save</button>`}
          </td>
        </tr>
      `;
    });

    tbody.innerHTML = rowsHtml;
  } catch (err) {
    console.error('Error loading users:', err);
    tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: #ef4444;">Error sa pag-load: ${err.message}</td></tr>`;
  }
}

const SUPER_ADMIN_DEFAULT = 'sona101097@gmail.com';
let superAdminState = { emails: [SUPER_ADMIN_DEFAULT], set: false };
async function superAdminLoad() { try { const d = await db.collection('system_settings').doc('super_admins').get(); superAdminState = d.exists ? { emails: (d.data().emails || []).map(e => String(e).toLowerCase()), set: true } : { emails: [SUPER_ADMIN_DEFAULT], set: false }; } catch (e) { superAdminState = { emails: [SUPER_ADMIN_DEFAULT], set: false }; } return superAdminState; }
function superAdminIsMe() { const u = getCurrentUser() || {}; return superAdminState.emails.includes(String(u.email || '').toLowerCase()); }
async function superAdminSet() {
  const u = getCurrentUser() || {}, me = String(u.email || '').toLowerCase(); const cur = superAdminState.emails.length ? superAdminState.emails.join(', ') : me;
  const t = await uiPrompt('Email ng mga Super Admin (paghiwalayin ng kuwit). Dapat kasama ang sarili mo:', cur); if (t === null) return;
  const list = [...new Set(t.split(/[,\s;]+/).map(x => x.trim().toLowerCase()).filter(x => /@/.test(x)))]; if (!list.length) { alert('Maglagay ng kahit isang email.'); return; } if (!list.includes(me)) { alert('Dapat kasama ang sarili mong email para hindi ka ma-lock out.'); return; }
  try { await db.collection('system_settings').doc('super_admins').set({ emails: list, updatedBy: me, updatedAt: new Date().toISOString() }); try { await logSystemAction('SUPER_ADMIN_SET', 'Super Admin: ' + list.join(', ')); } catch (e) {} alert('✅ Na-save ang Super Admin.'); loadFirestoreUsers(); } catch (e) { alert('Error: ' + e.message); }
}
async function saveUserRole(email) {
  const safeId = email.replace(/[@.]/g, '_');
  const roleEl = document.getElementById(`role-${safeId}`);
  const statusEl = document.getElementById(`status-${safeId}`);
  const stationEl = document.getElementById(`station-${safeId}`);

  if (!roleEl || !statusEl || !stationEl) return;

  const newRole = roleEl.value;
  const newStatus = statusEl.value;
  const newStation = stationEl.value.trim() || 'Branch';

  if (!db) {
    alert('Walang koneksyon sa database.');
    return;
  }

  try {
    await logSystemAction('USER_ROLE_UPDATED', `Binago ang role ni ${email} papuntang ${newRole.toUpperCase()} (Status: ${newStatus.toUpperCase()})`);
    await db.collection('users').doc(email.toLowerCase()).update({
      role: newRole,
      status: newStatus,
      branch: newStation
    });

    alert(`Matagumpay na na-update ang user ${email}!
Role: ${newRole.toUpperCase()} | Status: ${newStatus.toUpperCase()}`);
  } catch (err) {
    alert('Nabigo ang pag-save ng role: ' + err.message);
  }
}

async function loadStorageStations() {
  const tbody = document.getElementById('stations-list-tbody');
  if (!tbody || typeof db === 'undefined' || !db) return;

  try {
    const snap = await db.collection('storage_stations').orderBy('createdAt', 'desc').get();
    if (snap.empty) {
      tbody.innerHTML = '<tr><td colspan="2" style="text-align: center; color: #94a3b8; padding: 1rem;">Wala pang nalikhang stations.</td></tr>';
      return;
    }

    let html = '';
    snap.forEach(doc => {
      const data = doc.data();
      const name = data.name || doc.id;
      html += `
        <tr>
          <td><b>📍 ${name}</b></td>
          <td>
            <button class="btn btn-sm btn-danger" onclick="deleteStorageStation('${doc.id}')">🗑️</button>
          </td>
        </tr>
      `;
    });
    tbody.innerHTML = html;
  } catch (err) {
    console.error('Error loading stations:', err);
  }
}

async function addNewStorageStation() {
  const input = document.getElementById('new-station-label');
  const name = input ? input.value.trim() : '';

  if (!name) {
    alert('Mangyaring ilagay ang pangalan ng station (hal. Station 1 - Cold Storage).');
    return;
  }

  if (!db) return;

  try {
    const safeDocId = name.replace(/[/\#?]/g, '-');
    await db.collection('storage_stations').doc(safeDocId).set({
      name: name,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    logSystemAction('STATION_ADDED', `Nagdagdag ng storage station: ${name}`);
    alert(`Naidagdag ang "${name}" bilang Storage Station!`);
    input.value = '';
    loadStorageStations();
  } catch (err) {
    alert('Error sa pagdagdag ng station: ' + err.message);
  }
}

async function deleteStorageStation(docId) {
  if (!await uiConfirm('Tanggalin ang station na ito?')) return;
  if (!db) return;

  try {
    await db.collection('storage_stations').doc(docId).delete();
    logSystemAction('STATION_DELETED', `Binura ang storage station: ${docId}`);
    loadStorageStations();
  } catch (err) {
    alert('Error: ' + err.message);
  }
}

async function loadUOMs() {
  const tbody = document.getElementById('uom-list-tbody');
  if (!tbody || typeof db === 'undefined' || !db) return;

  try {
    const snap = await db.collection('uom_settings').orderBy('createdAt', 'desc').get();
    if (snap.empty) {
      tbody.innerHTML = '<tr><td colspan="3" style="text-align: center; color: #94a3b8; padding: 1rem;">Wala pang na-set up na UOM. Mag-type sa itaas at mag-add.</td></tr>';
      return;
    }

    let html = '';
    snap.forEach(doc => {
      const data = doc.data();
      const type = data.type || 'whole';
      const name = data.name || doc.id;
      const typeBadge = type === 'whole' 
        ? '<span class="badge badge-admin">📦 Whole Unit</span>'
        : '<span class="badge badge-branch">🥢 Loose Unit</span>';

      html += `
        <tr>
          <td>${typeBadge}</td>
          <td><b>${name}</b></td>
          <td>
            <button class="btn btn-sm btn-danger" onclick="deleteUOM('${doc.id}')">🗑️</button>
          </td>
        </tr>
      `;
    });
    tbody.innerHTML = html;
  } catch (err) {
    console.error('Error loading UOMs:', err);
  }
}

async function addNewUOM() {
  const type = document.getElementById('new-uom-type').value;
  const input = document.getElementById('new-uom-name');
  const name = input ? input.value.trim() : '';

  if (!name) {
    alert('Mangyaring ilagay ang pangalan ng Unit of Measure (hal. Box, Tin, Kg, Pack).');
    return;
  }

  if (!db) return;

  try {
    const safeDocId = `${type}_${name.replace(/[/\#?]/g, '-').toLowerCase()}`;
    await db.collection('uom_settings').doc(safeDocId).set({
      type: type,
      name: name,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    logSystemAction('UOM_ADDED', `Nagdagdag ng UOM: ${name} (${type})`);
    alert(`Matagumpay na naidagdag ang "${name}" bilang ${type.toUpperCase()} UOM!`);
    input.value = '';
    loadUOMs();
  } catch (err) {
    alert('Error sa pagdagdag ng UOM: ' + err.message);
  }
}

async function deleteUOM(docId) {
  if (!await uiConfirm('Tanggalin ang UOM na ito?')) return;
  if (!db) return;

  try {
    await db.collection('uom_settings').doc(docId).delete();
    logSystemAction('UOM_DELETED', `Binura ang UOM: ${docId}`);
    loadUOMs();
  } catch (err) {
    alert('Error: ' + err.message);
  }
}

function downloadCSVTemplate() {
  const headers = "POS_Code,SAP_Item_Code,Barcode,Item_Description,Commissary_Hub,Storage_Station,Whole_UOM,Loose_UOM,Whole_Price,Loose_Price,Conversion_Factor,Buffer_Limit,Packaging_Instructions,Cost_Whole,Cost_Loose\n";
  const sample1 = "P001,SAP-001,4800001,Beef Tapa Marinated,Commissary Meat,Station 1 - Cold Storage,Box,Sheets,500,12,50,15,I-vacuum pack bago i-freeze,350,7\n";
  const sample2 = "P002,SAP-002,4800002,Cooking Oil 18L,Commissary Wares,Station 2 - Dry Warehouse,Tin,Liters,1200,75,18,5,I-tape ang takip at i-seal,900,50\n";
  const blob = new Blob(["\uFEFF" + headers + sample1 + sample2], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = "ERP_Product_Master_With_UOM.csv";
  a.click();
}

function processCSVUpload() {
  const input = document.getElementById('csv-file-input');
  if (!input || !input.files.length) {
    alert('Mangyaring pumili muna ng .CSV file.');
    return;
  }
  const file = input.files[0];
  const reader = new FileReader();
  reader.onload = async function(e) {
    // Binabasa batay sa PANGALAN ng column (hindi posisyon), kaya gumagana ang file mula sa Export o sa Template.
    const rows = csvToObjects(e.target.result);
    const pick = (r, ...keys) => { for (const k of keys) { if (r[k] !== undefined && r[k] !== '') return r[k]; } return ''; };
    const valid = rows.filter(r => pick(r, 'sap_item_code', 'item_code', 'sap_code'));
    if (!valid.length) { alert('Walang valid na row. Kailangan ang column na SAP_Item_Code.'); return; }
    // 🛡️ Awtomatikong kumuha ng snapshot backup bago simulan ang pag-update
    await backupCurrentProducts("Pre-Upload Auto-Backup (CSV Bulk Upload)");
    let added = 0, updated = 0, failed = 0, costs = 0;

    for (const r of valid) {
      const code = pick(r, 'sap_item_code', 'item_code', 'sap_code');
      if (!db || !code) continue;
      try {
        const ref = db.collection('products').doc(code);
        const existing = await ref.get();
        const data = { itemCode: code, sapCode: code, updatedAt: firebase.firestore.FieldValue.serverTimestamp() };
        const setTxt = (k, v) => { if (v !== '') data[k] = v; };
        const setNum = (k, v) => { const n = parseFloat(v); if (v !== '' && !isNaN(n)) data[k] = n; };
        setTxt('itemName', pick(r, 'item_description', 'item_name'));
        setTxt('commissarySource', pick(r, 'commissary_hub', 'hub'));
        setTxt('storageStation', pick(r, 'storage_station', 'station'));
        setTxt('wholeUOM', pick(r, 'whole_uom')); setTxt('looseUOM', pick(r, 'loose_uom'));
        setNum('wholePrice', pick(r, 'whole_price')); setNum('loosePrice', pick(r, 'loose_price'));
        setNum('conversionFactor', pick(r, 'conversion_factor')); setNum('bufferLimit', pick(r, 'buffer_limit'));
        setTxt('posCode', pick(r, 'pos_code')); setTxt('barcode', pick(r, 'barcode'));
        setTxt('packagingInstructions', pick(r, 'packaging_instructions'));
        if (!existing.exists) {
          // Bagong produkto lang ang may stock na 0 at default na UOM. Hindi na nire-reset ang stock ng kasalukuyang produkto.
          data.stockWhole = 0; data.stockLoose = 0;
          if (!data.wholeUOM) data.wholeUOM = 'Box'; if (!data.looseUOM) data.looseUOM = 'Pcs';
          if (data.conversionFactor == null) data.conversionFactor = 1; if (data.bufferLimit == null) data.bufferLimit = 5;
        }
        await ref.set(data, { merge: true });
        existing.exists ? updated++ : added++;
        const cw = parseFloat(pick(r, 'cost_whole')), cl = parseFloat(pick(r, 'cost_loose'));
        if (!isNaN(cw) || !isNaN(cl)) {
          const c = {}; if (!isNaN(cw)) c.costWhole = cw; if (!isNaN(cl)) c.costLoose = cl; c.updatedAt = firebase.firestore.FieldValue.serverTimestamp();
          await db.collection('product_costs').doc(code).set(c, { merge: true }); costs++;
        }
      } catch (err) { failed++; console.error('Error adding product:', err); }
    }

    logSystemAction('BULK_UPLOAD', `Nag-upload ng CSV masterlist. Bago: ${added}, Na-update: ${updated}, Puhunan: ${costs}, Pumalya: ${failed}.`);
    alert(`Tapos ang upload!\nBago: ${added}\nNa-update: ${updated}\nMay puhunan: ${costs}` + (failed ? `\nPumalya: ${failed}` : ''));
    if (typeof loadAdminProducts === 'function') loadAdminProducts();
  };
  reader.readAsText(file);
}

function copyTableToGoogleSheets() {
  const table = document.getElementById('variance-table');
  if (!table) return;
  let tsv = '';
  for (let row of table.rows) {
    let rowData = [];
    for (let cell of row.cells) {
      rowData.push(cell.innerText.replace(/\t|\n/g, ' '));
    }
    tsv += rowData.join('\t') + '\n';
  }
  navigator.clipboard.writeText(tsv).then(() => {
    alert('Na-kopya na ang buong report! Pwede mo na itong i-Paste (Ctrl+V) diretso sa Google Sheets.');
  });
}



// ==========================================
// 2.1 EXECUTIVE ANALYTICS & CHART.JS ENGINE
// ==========================================
let chartBranchSpendInstance = null;
let chartTopProductsInstance = null;
let chartStationDemandInstance = null;

async function loadAdminAnalytics() {
  const kpiTotalOrders = document.getElementById('kpi-total-orders');
  const kpiTotalSpend = document.getElementById('kpi-total-spend');
  const kpiActiveBranches = document.getElementById('kpi-active-branches');
  const kpiTopStation = document.getElementById('kpi-top-station');
  const noDataBox = document.getElementById('analytics-no-data');
  const chartsGrid = document.getElementById('analytics-charts-grid');

  if (!kpiTotalOrders || typeof db === 'undefined' || !db) return;

  try {
    const snap = await db.collection('orders').get();

    if (snap.empty) {
      if (noDataBox) noDataBox.style.display = 'block';
      if (chartsGrid) chartsGrid.style.display = 'none';
      if (kpiTotalOrders) kpiTotalOrders.innerText = '0';
      if (kpiTotalSpend) kpiTotalSpend.innerText = '₱0.00';
      if (kpiActiveBranches) kpiActiveBranches.innerText = '0';
      if (kpiTopStation) kpiTopStation.innerText = 'Walang Data';
      return;
    }

    if (noDataBox) noDataBox.style.display = 'none';
    if (chartsGrid) chartsGrid.style.display = 'grid';

    let totalOrdersCount = 0;
    let totalSpendAmount = 0;
    const branchSpendMap = {}; // { 'Branch ATC': 15000, ... }
    const productCountMap = {}; // { 'Beef Tapa': 45, ... }
    const stationDemandMap = {}; // { 'Station 1 - Cold Storage': 30, ... }

    snap.forEach(doc => {
      const ord = doc.data();
      totalOrdersCount++;

      const branch = ord.branchName || 'Unknown Branch';
      const orderTotal = parseFloat(ord.totalAmount || 0);
      totalSpendAmount += orderTotal;

      branchSpendMap[branch] = (branchSpendMap[branch] || 0) + orderTotal;

      (ord.items || []).forEach(item => {
        const prodName = item.itemName || 'Unnamed Item';
        const wholeQty = parseFloat(item.wholeQty || 0);
        const looseQty = parseFloat(item.looseQty || 0);
        const totalUnits = wholeQty + looseQty;
        productCountMap[prodName] = (productCountMap[prodName] || 0) + totalUnits;

        const station = item.storageStation || 'Unassigned Station';
        stationDemandMap[station] = (stationDemandMap[station] || 0) + totalUnits;
      });
    });

    // Update KPIs
    if (kpiTotalOrders) kpiTotalOrders.innerText = totalOrdersCount.toLocaleString();
    if (kpiTotalSpend) kpiTotalSpend.innerText = '₱' + totalSpendAmount.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    if (kpiActiveBranches) kpiActiveBranches.innerText = Object.keys(branchSpendMap).length.toString();

    // Find top station
    let topStationName = '--';
    let topStationMax = -1;
    for (const [st, val] of Object.entries(stationDemandMap)) {
      if (val > topStationMax) {
        topStationMax = val;
        topStationName = st;
      }
    }
    if (kpiTopStation) kpiTopStation.innerText = topStationName;

    // Check if Chart.js is loaded
    if (typeof Chart === 'undefined') {
      console.warn('Chart.js library is not loaded.');
      return;
    }

    // 1. Chart: Top Branches by Spend (Bar Graph)
    const branchLabels = Object.keys(branchSpendMap);
    const branchValues = Object.values(branchSpendMap);
    const ctxBranch = document.getElementById('chart-branch-spend');
    if (ctxBranch) {
      if (chartBranchSpendInstance) chartBranchSpendInstance.destroy();
      chartBranchSpendInstance = new Chart(ctxBranch, {
        type: 'bar',
        data: {
          labels: branchLabels,
          datasets: [{
            label: 'Total Spend (₱)',
            data: branchValues,
            backgroundColor: '#2563eb',
            borderRadius: 4
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: function(context) {
                  return '₱' + Number(context.raw).toLocaleString('en-PH', { minimumFractionDigits: 2 });
                }
              }
            }
          },
          scales: {
            y: {
              beginAtZero: true,
              ticks: {
                callback: function(val) { return '₱' + Number(val).toLocaleString(); }
              }
            }
          }
        }
      });
    }

    // 2. Chart: Top 5 Most Ordered Products (Horizontal Bar Graph)
    const sortedProducts = Object.entries(productCountMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
    const prodLabels = sortedProducts.map(p => p[0]);
    const prodValues = sortedProducts.map(p => p[1]);

    const ctxProd = document.getElementById('chart-top-products');
    if (ctxProd) {
      if (chartTopProductsInstance) chartTopProductsInstance.destroy();
      chartTopProductsInstance = new Chart(ctxProd, {
        type: 'bar',
        data: {
          labels: prodLabels,
          datasets: [{
            label: 'Total Units Ordered',
            data: prodValues,
            backgroundColor: '#10b981',
            borderRadius: 4
          }]
        },
        options: {
          indexAxis: 'y',
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false }
          },
          scales: {
            x: {
              beginAtZero: true,
              ticks: { precision: 0 }
            }
          }
        }
      });
    }

    // 3. Chart: Storage Station Demand Distribution (Doughnut Chart)
    const stationLabels = Object.keys(stationDemandMap);
    const stationValues = Object.values(stationDemandMap);
    const stationColors = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4'];

    const ctxStation = document.getElementById('chart-station-demand');
    if (ctxStation) {
      if (chartStationDemandInstance) chartStationDemandInstance.destroy();
      chartStationDemandInstance = new Chart(ctxStation, {
        type: 'doughnut',
        data: {
          labels: stationLabels,
          datasets: [{
            data: stationValues,
            backgroundColor: stationColors.slice(0, stationLabels.length),
            borderWidth: 2
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: 'bottom',
              labels: { boxWidth: 12, font: { size: 11 } }
            }
          }
        }
      });
    }

  } catch (err) {
    console.error('Error loading admin analytics:', err);
  }
}



// ==========================================
// 2.2 ADMIN PRODUCT MASTER & LIVE EDITOR
// ==========================================
let adminProductsList = [];

async function loadAdminDropdownOptions() {
  if (typeof db === 'undefined' || !db) return;

  try {
    // 1. Stations
    const stationSnap = await db.collection('storage_stations').get();
    const stationSelect = document.getElementById('admin-item-station');
    if (stationSelect) {
      stationSelect.innerHTML = '<option value="">-- Pumili ng Station --</option>';
      stationSnap.forEach(doc => {
        const name = doc.data().name || doc.id;
        stationSelect.innerHTML += `<option value="${name}">📍 ${name}</option>`;
      });
    }

    // 2. UOMs
    const uomSnap = await db.collection('uom_settings').get();
    
    // 3. Vendors (For both Admin and Commissary Modals)
    const vSnap = await db.collection('vendors').get();
    const suppSelectAdmin = document.getElementById('admin-item-supplier');
    const suppSelectComm = document.getElementById('new-item-supplier');
    
    if (suppSelectAdmin) {
      suppSelectAdmin.innerHTML = '<option value="">-- In-House / No Vendor --</option>';
      vSnap.forEach(doc => {
        suppSelectAdmin.innerHTML += `<option value="${doc.data().name}">${doc.data().name}</option>`;
      });
    }
    
    if (suppSelectComm) {
      suppSelectComm.innerHTML = '<option value="">-- In-House / No Vendor --</option>';
      vSnap.forEach(doc => {
        suppSelectComm.innerHTML += `<option value="${doc.data().name}">${doc.data().name}</option>`;
      });
    }

    const wholeSelect = document.getElementById('admin-item-whole-uom');
    const looseSelect = document.getElementById('admin-item-loose-uom');

    if (wholeSelect && looseSelect) {
      wholeSelect.innerHTML = '<option value="">-- Pumili ng Whole UOM --</option>';
      looseSelect.innerHTML = '<option value="">-- Pumili ng Loose UOM --</option>';

      uomSnap.forEach(doc => {
        const data = doc.data();
        const type = data.type || 'whole';
        const name = data.name || doc.id;
        if (type === 'whole') {
          wholeSelect.innerHTML += `<option value="${name}">📦 ${name}</option>`;
        } else {
          looseSelect.innerHTML += `<option value="${name}">🥢 ${name}</option>`;
        }
      });
    }
  } catch (err) {
    console.error('Error loading admin dropdowns:', err);
  }
}


function renderAdminProductsTable(items) {
  const tbody = document.getElementById('admin-products-tbody');
  if (!tbody) return;

  if (!items || items.length === 0) {
    tbody.innerHTML = '<tr><td colspan="10" style="text-align: center; color: #94a3b8; padding: 1.5rem;">Walang produktong tumugma sa paghahanap.</td></tr>';
    return;
  }

  let rowsHtml = '';
  items.forEach(prod => {
    const posCode = prod.posCode || prod.pos_code || '--';
    const sapCode = prod.sapCode || prod.itemCode || prod.id || '--';
    const barcode = prod.barcode || prod.barcodeNumber || '--';
    const name = prod.itemName || 'Walang Pangalan';
    const hub = prod.commissarySource || 'Central Hub';
    const station = prod.storageStation || 'Unassigned';
    const wholeUOM = prod.wholeUOM || 'Whole';
    const looseUOM = prod.looseUOM || 'Loose';
    const wholePrice = parseFloat(prod.wholePrice || 0);
    const loosePrice = parseFloat(prod.loosePrice || 0);
    const packGuide = prod.packagingInstructions ? `<small style="color: #475569;">${prod.packagingInstructions}</small>` : '<small style="color: #94a3b8;">--</small>';
    const expiryHtml = prod.expiryDate ? `<b style="color: #dc2626;">${prod.expiryDate}</b>` : '<small style="color: #94a3b8;">--</small>';

    rowsHtml += `
      <tr>
        <td><b style="color: #0f172a;">${posCode}</b></td>
        <td><b style="color: #2563eb;">${sapCode}</b></td>
        <td><span style="font-family: monospace; font-size: 0.8rem; background: #f1f5f9; padding: 2px 6px; border-radius: 4px;">${barcode}</span></td>
        <td><b>${name}</b>${companyChipsHtml(prod)}</td>
        <td>${hub}</td>
        <td><span class="badge badge-admin">📍 ${station}</span></td>
        ${productPriceCellsHtml(prod, wholeUOM, looseUOM)}
        <td>${expiryHtml}</td>
        <td>${packGuide}</td>
        <td style="text-align: center;">
          <div style="display: flex; gap: 0.35rem; justify-content: center;">
            <button class="btn btn-sm btn-primary" onclick="openAdminProductModal('${prod.id}')">✏️ Edit</button>
            <button class="btn btn-sm btn-danger" onclick="deleteAdminProduct('${prod.id}')">🗑️</button>
          </div>
        </td>
      </tr>
    `;
  });

  tbody.innerHTML = rowsHtml;
}

function filterAdminProductsTable() {
  const searchInput = document.getElementById('admin-product-search');
  const query = (searchInput ? searchInput.value : '').toLowerCase().trim();

  if (!query) {
    renderAdminProductsTable(adminProductsList);
    return;
  }

  const filtered = adminProductsList.filter(prod => {
    const pos = (prod.posCode || prod.pos_code || '').toLowerCase();
    const sap = (prod.sapCode || prod.itemCode || prod.id || '').toLowerCase();
    const bar = (prod.barcode || prod.barcodeNumber || '').toLowerCase();
    const name = (prod.itemName || '').toLowerCase();
    const station = (prod.storageStation || '').toLowerCase();
    return pos.includes(query) || sap.includes(query) || bar.includes(query) || name.includes(query) || station.includes(query);
  });

  renderAdminProductsTable(filtered);
}

async function loadAdminProducts() {
  const tbody = document.getElementById('admin-products-tbody');
  if (!tbody) return;

  if (typeof db === 'undefined' || !db) {
    tbody.innerHTML = '<tr><td colspan="10" style="text-align: center; color: #ef4444; padding: 1rem;">Hindi ma-access ang Firestore database. Pakisuri ang koneksyon.</td></tr>';
    return;
  }

  try {
    tbody.innerHTML = '<tr><td colspan="10" style="text-align: center; color: #64748b; padding: 1rem;">Kinukuha ang Product Master mula sa Firestore...</td></tr>';
    const snap = await db.collection('products').get();

    if (snap.empty) {
      tbody.innerHTML = '<tr><td colspan="10" style="text-align: center; color: #94a3b8; padding: 1.5rem;">Walang nakatalang produkto sa database. I-click ang "➕ Mag-add ng Produkto" o mag-upload ng CSV.</td></tr>';
      return;
    }

    adminProductsList = [];
    snap.forEach(doc => {
      const prod = { id: doc.id, ...doc.data() };
      adminProductsList.push(prod);
    });

    await loadProductCosts();
    renderAdminProductsTable(adminProductsList);
  } catch (err) {
    console.error('Error loading admin products:', err);
    tbody.innerHTML = `<tr><td colspan="10" style="text-align: center; color: #ef4444;">Error sa pag-load: ${err.message}</td></tr>`;
  }
}


async function openAdminProductModal(productId = null) {
  const modal = document.getElementById('admin-product-modal');
  if (!modal) return;

  await loadAdminDropdownOptions();

  const titleEl = document.getElementById('admin-modal-title');
  const modeEl = document.getElementById('admin-edit-mode');
  const origIdEl = document.getElementById('admin-original-doc-id');
  const posInput = document.getElementById('admin-item-pos-code');
  const codeInput = document.getElementById('admin-item-code');
  const barInput = document.getElementById('admin-item-barcode');
  const nameInput = document.getElementById('admin-item-name');
  const hubInput = document.getElementById('admin-item-hub');
  loadHubOptions();
  const stationSelect = document.getElementById('admin-item-station');
  const wholeSelect = document.getElementById('admin-item-whole-uom');
  const looseSelect = document.getElementById('admin-item-loose-uom');
  const wholePriceInput = document.getElementById('admin-item-whole-price');
  const loosePriceInput = document.getElementById('admin-item-loose-price');
  const convInput = document.getElementById('admin-item-conversion');
  const bufferInput = document.getElementById('admin-item-buffer');
  const packInput = document.getElementById('admin-item-packaging');
  const expiryInput = document.getElementById('admin-item-expiry');

  if (productId) {
    // EDIT MODE
    const prod = adminProductsList.find(p => p.id === productId);
    if (!prod) return;

    if (titleEl) titleEl.innerText = `✏️ I-edit ang Produkto (${prod.sapCode || prod.itemCode || prod.id})`;
    if (modeEl) modeEl.value = 'edit';
    if (origIdEl) origIdEl.value = prod.id;
    if (posInput) posInput.value = prod.posCode || prod.pos_code || '';
    if (codeInput) {
      codeInput.value = prod.sapCode || prod.itemCode || prod.id;
      codeInput.disabled = false; // EDITABLE NA ANG SAP CODE
    }
    if (barInput) barInput.value = prod.barcode || prod.barcodeNumber || '';
    if (nameInput) nameInput.value = prod.itemName || '';
    if (hubInput) setSelValue(hubInput, prod.commissarySource || '');
    { const scopeEl = document.getElementById('admin-item-scope'); if (scopeEl) scopeEl.value = prod.scope === 'shared' ? 'shared' : 'private'; }
    if (stationSelect) stationSelect.value = prod.storageStation || '';
    if (wholeSelect) wholeSelect.value = prod.wholeUOM || '';
    if (looseSelect) looseSelect.value = prod.looseUOM || '';
    if (wholePriceInput) wholePriceInput.value = prod.wholePrice || 0;
    if (loosePriceInput) loosePriceInput.value = prod.loosePrice || 0;
    if (convInput) convInput.value = prod.conversionFactor || 1;
    if (bufferInput) bufferInput.value = prod.bufferLimit || 5;
    if (packInput) packInput.value = prod.packagingInstructions || '';
    if (expiryInput) expiryInput.value = prod.expiryDate || '';
    const suppInput = document.getElementById('admin-item-supplier');
    if (suppInput) suppInput.value = prod.supplier || '';
  } else {
    // ADD MODE
    if (titleEl) titleEl.innerText = '➕ Mag-add ng Bagong Produkto';
    if (modeEl) modeEl.value = 'add';
    if (origIdEl) origIdEl.value = '';
    if (posInput) posInput.value = '';
    if (codeInput) {
      codeInput.value = '';
      codeInput.disabled = false;
    }
    if (barInput) barInput.value = '';
    if (nameInput) nameInput.value = '';
    if (hubInput) setSelValue(hubInput, '');
    { const scopeEl = document.getElementById('admin-item-scope'); if (scopeEl) scopeEl.value = 'private'; }
    if (stationSelect) stationSelect.value = '';
    if (wholeSelect) wholeSelect.value = '';
    if (looseSelect) looseSelect.value = '';
    if (wholePriceInput) wholePriceInput.value = 0;
    if (loosePriceInput) loosePriceInput.value = 0;
    if (convInput) convInput.value = 1;
    if (bufferInput) bufferInput.value = 5;
    if (packInput) packInput.value = '';
    if (expiryInput) expiryInput.value = '';
    const suppInput = document.getElementById('admin-item-supplier');
    if (suppInput) suppInput.value = '';
  }

  modal.style.display = 'flex';
}

function closeAdminProductModal() {
  const modal = document.getElementById('admin-product-modal');
  if (modal) modal.style.display = 'none';
}

async function saveAdminProduct() {
  const origDocId = document.getElementById('admin-original-doc-id')?.value || null;
  const posCode = document.getElementById('admin-item-pos-code') ? document.getElementById('admin-item-pos-code').value.trim() : '';
  const code = document.getElementById('admin-item-code') ? document.getElementById('admin-item-code').value.trim() : '';
  const barcode = document.getElementById('admin-item-barcode') ? document.getElementById('admin-item-barcode').value.trim() : '';
  const name = document.getElementById('admin-item-name') ? document.getElementById('admin-item-name').value.trim() : '';
  const hub = document.getElementById('admin-item-hub') ? document.getElementById('admin-item-hub').value.trim() : 'Commissary Hub';
  const station = document.getElementById('admin-item-station') ? document.getElementById('admin-item-station').value : 'Unassigned';
  const wholeUOM = document.getElementById('admin-item-whole-uom') ? document.getElementById('admin-item-whole-uom').value : 'Box';
  const looseUOM = document.getElementById('admin-item-loose-uom') ? document.getElementById('admin-item-loose-uom').value : 'Pcs';
  const wholePrice = parseFloat(document.getElementById('admin-item-whole-price')?.value || 0);
  const loosePrice = parseFloat(document.getElementById('admin-item-loose-price')?.value || 0);
  const conv = parseInt(document.getElementById('admin-item-conversion')?.value || 1);
  const buffer = parseInt(document.getElementById('admin-item-buffer')?.value || 5);
  const packInst = document.getElementById('admin-item-packaging') ? document.getElementById('admin-item-packaging').value.trim() : '';
  const expiryDate = document.getElementById('admin-item-expiry') ? document.getElementById('admin-item-expiry').value : '';

  if (!code || !name) {
    alert('Mangyaring punan ang SAP Code at Pangalan ng Produkto.');
    return;
  }

  // Mahigpit na pagsusuri kung Unique ang POS Code at SAP Code (hindi haharangin ang sariling record)
  const isEditMode = document.getElementById('admin-edit-mode') && document.getElementById('admin-edit-mode').value === 'edit';
  const excludeAdminId = isEditMode ? (origDocId || code) : null;
  const adminUniqueness = await validateProductCodesUnique(posCode, code, excludeAdminId);
  if (!adminUniqueness.isUnique) {
    alert(`⚠️ BAWAL ANG DUPLICATE CODE!\n\nAng ${adminUniqueness.conflictType} na "${adminUniqueness.conflictingCode}" ay ginagamit na ng produktong: "${adminUniqueness.existingItemName}".\n\nMangyaring gumamit ng natatanging (unique) code.`);
    return;
  }

  if (typeof db === 'undefined' || !db) {
    alert('Walang koneksyon sa database.');
    return;
  }

  try {
    const payload = {
      posCode: posCode,
      sapCode: code,
      barcode: barcode,
      itemCode: code,
      itemName: name,
      commissarySource: hub,
      scope: ((document.getElementById('admin-item-scope') || {}).value === 'shared') ? 'shared' : 'private',
      companies: readCompanyChecks('admin-item-companies') || [],
      storageStation: station || 'Unassigned',
      wholeUOM: wholeUOM || 'Box',
      looseUOM: looseUOM || 'Pcs',
      wholePrice: wholePrice,
      loosePrice: loosePrice,
      conversionFactor: conv,
      bufferLimit: buffer,
      packagingInstructions: packInst,
      expiryDate: expiryDate,
      supplier: document.getElementById('admin-item-supplier') ? document.getElementById('admin-item-supplier').value : '',
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    // Smart Audit Logging para sa Admin
    let diffLog = [];
    if (isEditMode && origDocId) {
      const oldProd = adminProductsList.find(p => p.id === origDocId);
      if (oldProd) {
        if ((oldProd.itemName || '') !== name) diffLog.push(`Name ('${oldProd.itemName || ''}' ➔ '${name}')`);
        if ((oldProd.sapCode || oldProd.itemCode || oldProd.id) !== code) diffLog.push(`SAP ('${oldProd.sapCode || oldProd.itemCode || oldProd.id}' ➔ '${code}')`);
        if ((oldProd.posCode || '') !== posCode) diffLog.push(`POS ('${oldProd.posCode || ''}' ➔ '${posCode}')`);
        if (parseFloat(oldProd.wholePrice || 0) !== wholePrice) diffLog.push(`W.Price (₱${oldProd.wholePrice || 0} ➔ ₱${wholePrice})`);
        if (parseFloat(oldProd.loosePrice || 0) !== loosePrice) diffLog.push(`L.Price (₱${oldProd.loosePrice || 0} ➔ ₱${loosePrice})`);
        if ((oldProd.storageStation || '') !== station) diffLog.push(`Station ('${oldProd.storageStation || ''}' ➔ '${station}')`);
        if ((oldProd.expiryDate || '') !== expiryDate) diffLog.push(`Expiry ('${oldProd.expiryDate || ''}' ➔ '${expiryDate}')`);
      }
    }

    // Kung binago ang SAP Code sa Edit Mode, burahin ang lumang document key
    if (origDocId && origDocId !== code) {
      await db.collection('products').doc(origDocId).delete();
    }

    await db.collection('products').doc(code).set(payload, { merge: true });
    await invSaveFormPhoto(code, 'admin-item-photo');
    await saveProductCost(code);
    
    let actionStr = `Nag-create ng bagong produkto: ${code} (${name})`;
    if (isEditMode) {
      actionStr = diffLog.length > 0 ? `In-edit ang produkto ${code}. Binago: ` + diffLog.join(', ') : `In-edit ang produkto ${code} (Walang binago).`;
    }
    await logSystemAction(isEditMode ? 'PRODUCT_EDITED' : 'PRODUCT_CREATED', actionStr);

    alert(`✅ Matagumpay na nai-save ang produktong "${name}" ni Admin!\n\nPOS: ${posCode || '--'}\nSAP: ${code}\nBarcode: ${barcode || '--'}`);
    closeAdminProductModal();
    loadAdminProducts();
  } catch (err) {
    console.error('Error saving product by admin:', err);
    alert('Error sa pag-save: ' + err.message);
  }
}

async function deleteAdminProduct(productId) {
  if (!await uiConfirm(`Sigurado ka bang nais mong burahin ang produktong "${productId}" mula sa database?`)) return;
  if (!db) return;

  try {
    await db.collection('products').doc(productId).delete();
    await logSystemAction('PRODUCT_DELETED', `Binura ang produkto: ${productId}`);
    alert(`Matagumpay na nabura ang produkto.`);
    loadAdminProducts();
  } catch (err) {
    alert('Error sa pagbura: ' + err.message);
  }
}


// ==========================================
// 3. COMMISSARY PORTAL LOGIC & ORDERS QUEUE
// ==========================================
let currentInventory = [];
let availableStations = [];
let availableWholeUOMs = [];
let availableLooseUOMs = [];
let currentOrders = [];

async function loadDropdownOptions() {
  if (typeof db === 'undefined' || !db) return;

  try {
    const stationSnap = await db.collection('storage_stations').get();
    availableStations = [];
    stationSnap.forEach(doc => {
      const data = doc.data();
      availableStations.push(data.name || doc.id);
    });

    const modalStation = document.getElementById('new-storage-station');
    if (modalStation) {
      modalStation.innerHTML = '<option value="">-- Pumili ng Nalikhang Station --</option>';
      availableStations.forEach(st => {
        modalStation.innerHTML += `<option value="${st}">📍 ${st}</option>`;
      });
    }

    const filterSelect = document.getElementById('station-filter');
    if (filterSelect) {
      filterSelect.innerHTML = '<option value="all">Lahat ng Storage Stations</option>';
      availableStations.forEach(st => {
        filterSelect.innerHTML += `<option value="${st}">📍 ${st}</option>`;
      });
    }

    const uomSnap = await db.collection('uom_settings').get();
    availableWholeUOMs = [];
    availableLooseUOMs = [];

    uomSnap.forEach(doc => {
      const data = doc.data();
      const type = data.type || 'whole';
      const name = data.name || doc.id;
      if (type === 'whole') availableWholeUOMs.push(name);
      else availableLooseUOMs.push(name);
    });

    const wholeSelect = document.getElementById('new-whole-uom');
    if (wholeSelect) {
      wholeSelect.innerHTML = '<option value="">-- Pumili ng Whole UOM --</option>';
      availableWholeUOMs.forEach(uom => {
        wholeSelect.innerHTML += `<option value="${uom}">📦 ${uom}</option>`;
      });
    }

    const looseSelect = document.getElementById('new-loose-uom');
    if (looseSelect) {
      looseSelect.innerHTML = '<option value="">-- Pumili ng Loose UOM --</option>';
      availableLooseUOMs.forEach(uom => {
        looseSelect.innerHTML += `<option value="${uom}">🥢 ${uom}</option>`;
      });
    }

  } catch (err) {
    console.error('Error loading dropdown options:', err);
  }
}

async function addStationFromCommissary() {
  const input = document.getElementById('commissary-new-station');
  const name = input ? input.value.trim() : '';

  if (!name) {
    alert('Mangyaring ilagay ang pangalan ng station (hal: Cold Storage 1).');
    return;
  }

  if (!db) return;

  try {
    const safeDocId = name.replace(/[/\#?]/g, '-');
    await db.collection('storage_stations').doc(safeDocId).set({
      name: name,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    alert(`Naidagdag ang "${name}" bilang Station!`);
    input.value = '';
    loadDropdownOptions();
  } catch (err) {
    alert('Error: ' + err.message);
  }
}

async function addUOMFromCommissary() {
  const typeEl = document.getElementById('commissary-uom-type');
  const type = typeEl ? typeEl.value : 'whole';
  const input = document.getElementById('commissary-new-uom');
  const name = input ? input.value.trim() : '';

  if (!name) {
    alert('Mangyaring ilagay ang pangalan ng UOM (hal: Box, Sack, Kg, Sheets).');
    return;
  }

  if (!db) return;

  try {
    const safeDocId = `${type}_${name.replace(/[/\#?]/g, '-').toLowerCase()}`;
    await db.collection('uom_settings').doc(safeDocId).set({
      type: type,
      name: name,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    alert(`Naidagdag ang "${name}" bilang ${type.toUpperCase()} UOM!`);
    input.value = '';
    loadDropdownOptions();
  } catch (err) {
    alert('Error: ' + err.message);
  }
}

async function loadCommissaryInventory() {
  const tbody = document.getElementById('inventory-tbody');
  if (!tbody) return;

  if (typeof db === 'undefined' || !db) {
    tbody.innerHTML = '<tr><td colspan="11" style="text-align: center; color: #ef4444;">Hindi ma-access ang Firestore database. Pakisuri ang firebase-config.js.</td></tr>';
    return;
  }

  const u = getCurrentUser();
  const userHub = (u && u.branch) ? u.branch.toLowerCase().trim() : '';

  try {
    tbody.innerHTML = '<tr><td colspan="11" style="text-align: center; color: #64748b;">Kinukuha ang inventory mula sa Firestore...</td></tr>';
    
    const snapshot = await db.collection('products').get();
    if (snapshot.empty) {
      tbody.innerHTML = '<tr><td colspan="11" style="text-align: center; color: #94a3b8; padding: 1.5rem;">Walang nakatalang produkto sa database. I-click ang "➕ Mag-add ng Bagong Produkto" para mag-simula.</td></tr>';
      return;
    }

    currentInventory = [];
    snapshot.forEach(doc => {
      const data = doc.data();
      const prodHub = (data.commissarySource || '').toLowerCase().trim();

      if (normalizeRole(u.role) === 'admin' || productVisibleToHub(data, userHub)) {
        currentInventory.push({ id: doc.id, ...data });
      }
    });

    renderInventoryTable(currentInventory);

  } catch (err) {
    console.error('Error loading inventory:', err);
    tbody.innerHTML = `<tr><td colspan="11" style="text-align: center; color: #ef4444;">Error sa pagkuha ng inventory: ${err.message}</td></tr>`;
  }
}

function renderInventoryTable(items) {
  const tbody = document.getElementById('inventory-tbody');
  if (!tbody) return;

  if (items.length === 0) {
    tbody.innerHTML = '<tr><td colspan="11" style="text-align: center; color: #94a3b8; padding: 1.5rem;">Walang produkto para sa napiling Storage Station filter.</td></tr>';
    return;
  }

  let html = '';
  items.forEach(item => {
    const code = item.itemCode || item.id;
    const name = item.itemName || 'Walang Pangalan';
    const station = item.storageStation || 'Unassigned Station';
    const wholeUOM = item.wholeUOM || 'Whole';
    const looseUOM = item.looseUOM || 'Loose';
    const buffer = item.bufferLimit || 5;
    const wholePrice = parseFloat(item.wholePrice || 0);
    const loosePrice = parseFloat(item.loosePrice || 0);
    const whole = item.stockWhole || 0;
    const loose = item.stockLoose || 0;

    const isLow = whole < buffer;
    const statusHtml = isLow
      ? '<span class="badge badge-warning">⚠️ Low Stock (Buffer Alert)</span>'
      : '<span class="badge badge-branch">Normal / Safe</span>';

    html += `
      <tr>
        <td><b>${code}</b></td>
        <td><b>${name}</b></td>
        <td><span class="badge badge-admin">📍 ${station}</span></td>
        <td><span class="badge badge-secondary">📦 ${wholeUOM}</span></td>
        <td><span class="badge badge-secondary">🥢 ${looseUOM}</span></td>
        <td><b style="color: #2563eb;">₱${wholePrice.toFixed(2)}</b></td>
        <td><b style="color: #059669;">₱${loosePrice.toFixed(2)}</b></td>
        <td><b>${whole}</b> ${wholeUOM} & <b>${loose}</b> ${looseUOM}</td>
        <td>${buffer} ${wholeUOM}</td>
        <td>${statusHtml}</td>
        <td>
          <button class="btn btn-sm btn-secondary" onclick="updateStock('${item.id}', 5)">+5 Restock</button>
        </td>
      </tr>
    `;
  });

  tbody.innerHTML = html;
}

function filterInventoryByStation() {
  const filterEl = document.getElementById('station-filter');
  if (!filterEl) return;
  const sel = filterEl.value;
  if (sel === 'all') {
    renderInventoryTable(currentInventory);
  } else {
    const filtered = currentInventory.filter(item => {
      const st = item.storageStation || '';
      return st === sel;
    });
    renderInventoryTable(filtered);
  }
}

function showAddProductModal() {
  loadDropdownOptions();
  const modal = document.getElementById('add-product-modal');
  if (modal) modal.style.display = 'flex';
}

function closeAddProductModal() {
  const modal = document.getElementById('add-product-modal');
  if (modal) modal.style.display = 'none';
}

async function saveProductWithStationAndUOM() {
  const origDocId = document.getElementById('comm-original-doc-id')?.value || null;
  const posCode = document.getElementById('new-item-pos-code') ? document.getElementById('new-item-pos-code').value.trim() : '';
  const code = document.getElementById('new-item-code') ? document.getElementById('new-item-code').value.trim() : '';
  const barcode = document.getElementById('new-item-barcode') ? document.getElementById('new-item-barcode').value.trim() : '';
  const name = document.getElementById('new-item-name') ? document.getElementById('new-item-name').value.trim() : '';
  const station = document.getElementById('new-storage-station') ? document.getElementById('new-storage-station').value : '';
  const wholeUOM = document.getElementById('new-whole-uom') ? document.getElementById('new-whole-uom').value : 'Box';
  const looseUOM = document.getElementById('new-loose-uom') ? document.getElementById('new-loose-uom').value : 'Pcs';
  const wholePrice = parseFloat(document.getElementById('new-whole-price')?.value || 0);
  const loosePrice = parseFloat(document.getElementById('new-loose-price')?.value || 0);
  const whole = parseInt(document.getElementById('new-stock-whole')?.value || 0);
  const loose = parseInt(document.getElementById('new-stock-loose')?.value || 0);
  const conv = parseInt(document.getElementById('new-conversion-factor')?.value || 1);
  const buffer = parseInt(document.getElementById('new-buffer-limit')?.value || 5);
  const packInstEl = document.getElementById('new-packaging-instructions');
  const packagingInstructions = packInstEl ? packInstEl.value.trim() : '';

  if (!code || !name) {
    alert('Mangyaring ilagay ang Item Code at Pangalan ng Produkto.');
    return;
  }

  // Mahigpit na pagsusuri kung Unique ang POS Code at SAP Code
  const excludeId = origDocId || null;
  const uniquenessCheck = await validateProductCodesUnique(posCode, code, excludeId);
  if (!uniquenessCheck.isUnique) {
    alert(`⚠️ BAWAL ANG DUPLICATE CODE!\n\nAng ${uniquenessCheck.conflictType} na "${uniquenessCheck.conflictingCode}" ay ginagamit na ng produktong: "${uniquenessCheck.existingItemName}".\n\nMangyaring gumamit ng natatanging (unique) code.`);
    return;
  }

  if (!station) {
    alert('Mangyaring pumili ng Storage Station.');
    return;
  }

  const u = getCurrentUser();
  const userHub = (u && u.branch) ? u.branch : 'Commissary Hub';

  if (typeof db === 'undefined' || !db) {
    alert('Walang database connection.');
    return;
  }

  try {
    const payload = {
      posCode: posCode,
      sapCode: code,
      barcode: barcode,
      itemCode: code,
      itemName: name,
      storageStation: station,
      wholeUOM: wholeUOM || 'Box',
      looseUOM: looseUOM || 'Pcs',
      wholePrice: wholePrice,
      loosePrice: loosePrice,
      conversionFactor: conv,
      packagingInstructions: packagingInstructions,
      commissarySource: userHub,
      stockWhole: whole,
      stockLoose: loose,
      bufferLimit: buffer,
      supplier: document.getElementById('new-item-supplier') ? document.getElementById('new-item-supplier').value : '',
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    { const _cc = readCompanyChecks('new-item-companies'); if (_cc) payload.companies = _cc; }
    if (!origDocId) { const _h = myHubName(); if (_h) { payload.commissarySource = _h; payload.scope = 'private'; } }

    // Smart Audit Logging para sa Commissary
    let diffLog = [];
    if (origDocId) {
      const oldProd = currentInventory.find(p => p.id === origDocId);
      if (oldProd) {
        if ((oldProd.itemName || '') !== name) diffLog.push(`Name ('${oldProd.itemName || ''}' ➔ '${name}')`);
        if ((oldProd.sapCode || oldProd.itemCode || oldProd.id) !== code) diffLog.push(`SAP ('${oldProd.sapCode || oldProd.itemCode || oldProd.id}' ➔ '${code}')`);
        if (parseFloat(oldProd.stockWhole || 0) !== whole) diffLog.push(`W.Qty (${oldProd.stockWhole || 0} ➔ ${whole})`);
        if (parseFloat(oldProd.stockLoose || 0) !== loose) diffLog.push(`L.Qty (${oldProd.stockLoose || 0} ➔ ${loose})`);
      }
    }

    if (origDocId && origDocId !== code) {
      await db.collection('products').doc(origDocId).delete();
    }

    await db.collection('products').doc(code).set(payload, { merge: true });
    await invSaveFormPhoto(code, 'new-item-photo');
    
    let actionStr = `Nag-create ng bagong produkto mula planta: ${code} (${name})`;
    if (origDocId) {
      actionStr = diffLog.length > 0 ? `In-edit ang produkto ${code} sa planta. Binago: ` + diffLog.join(', ') : `In-edit ang produkto ${code} (Walang binago).`;
    }
    await logSystemAction(origDocId ? 'PRODUCT_EDITED' : 'PRODUCT_CREATED', actionStr);

    alert(`✅ Matagumpay na naitala ang ${name}!\n\nPOS: ${posCode || '--'}\nSAP: ${code}\nBarcode: ${barcode || '--'}`);
    closeAddProductModal();
    loadCommissaryInventory();
  } catch (err) {
    alert('Hindi nai-save: ' + err.message);
  }
}

async function updateStock(docId, addQty) {
  if (!db) return;
  try {
    const batch = db.batch();
    batch.update(db.collection('products').doc(docId), {
      stockWhole: firebase.firestore.FieldValue.increment(addQty)
    });
    addStockMovementToBatch(batch, docId, '', 'MANUAL_ADJUST', '', addQty, 0, 'Manual stock adjustment');
    await batch.commit();
    logSystemAction('STOCK_ADJUSTED', `Nagdagdag ng +${addQty} stock sa produkto: ${docId}`);
    loadCommissaryInventory();
  } catch (e) {
    console.warn(e);
  }
}

// ========================================================
// 📦 STOCK & MONEY INTEGRITY ENGINE
// - Lahat ng galaw ng stock ay nasa stock_movements (sino, ano, kailan, saang order)
// - Order stock: ibabawas LAMANG kapag tinanggap ng commissary (isang beses, naka-flag), ibabalik LAMANG kung nabawas na (isang beses)
// - GL posting: may nakatakdang ID kaya hindi puwedeng madoble
// ========================================================
function stockActorName() {
  const u = getCurrentUser();
  return (u && (u.name || u.email)) || 'system';
}
function stockMovementDoc(productId, itemName, type, refId, whole, loose, note) {
  return {
    productId: productId,
    itemName: itemName || '',
    type: type,
    refId: refId || '',
    wholeQty: whole || 0,
    looseQty: loose || 0,
    note: note || '',
    by: stockActorName(),
    at: firebase.firestore.FieldValue.serverTimestamp()
  };
}
function addStockMovementToBatch(batch, productId, itemName, type, refId, whole, loose, note) {
  batch.set(db.collection('stock_movements').doc(), stockMovementDoc(productId, itemName, type, refId, whole, loose, note));
}

// Babala bago ibawas: aling items ang kulang sa stock (hindi hinaharang; si commissary ang magdedesisyon)
async function getOrderStockShortages(order) {
  const items = (order.items || []).filter(i => i.itemCode || i.id);
  const snaps = await Promise.all(items.map(i => db.collection('products').doc(i.itemCode || i.id).get()));
  const out = [];
  items.forEach((i, idx) => {
    const s = snaps[idx];
    if (!s.exists) { out.push({ itemName: i.itemName || (i.itemCode || i.id), missing: true }); return; }
    const d = s.data();
    const needW = parseFloat(i.wholeQty || 0), needL = parseFloat(i.looseQty || 0);
    const haveW = parseFloat(d.stockWhole || 0), haveL = parseFloat(d.stockLoose || 0);
    if (haveW < needW || haveL < needL) out.push({ itemName: i.itemName || d.itemName, haveW, haveL, needW, needL });
  });
  return out;
}
function formatShortages(list) {
  return list.map(x => x.missing
    ? `• ${x.itemName}: WALA sa Product Master`
    : `• ${x.itemName}: meron ${x.haveW}W/${x.haveL}L, kailangan ${x.needW}W/${x.needL}L`).join('\n');
}

// mode: 'deduct' | 'restock'. Isang transaction: stock + movement log + order flags + (opsyonal) SI number.
async function applyOrderStock(orderId, mode, orderUpdate, opts) {
  orderUpdate = orderUpdate || {};
  opts = opts || {};
  const orderRef = db.collection('orders').doc(orderId);
  const seqRef = db.collection('system_settings').doc('invoice_sequence');
  return db.runTransaction(async tx => {
    const oSnap = await tx.get(orderRef);
    if (!oSnap.exists) throw new Error('Hindi nahanap ang order.');
    const o = oSnap.data();
    if (mode === 'deduct' && String(o.status || '').includes('Cancel')) throw new Error('Nakansela na ang order na ito.');

    const apply = mode === 'deduct' ? !o.stockDeducted : (!!o.stockDeducted && !o.stockRestocked);
    const items = apply ? (o.items || []).filter(i => i.itemCode || i.id) : [];
    const needSI = !!opts.allocateSI && !o.siNumber;

    // --- lahat ng READS muna ---
    const seqSnap = needSI ? await tx.get(seqRef) : null;
    const prodRefs = items.map(i => db.collection('products').doc(i.itemCode || i.id));
    const prodSnaps = await Promise.all(prodRefs.map(r => tx.get(r)));

    // --- tapos WRITES ---
    const upd = Object.assign({}, orderUpdate, { updatedAt: firebase.firestore.FieldValue.serverTimestamp() });

    if (needSI) {
      const typed = (opts.typedSI || '').trim();
      const last = seqSnap.exists ? (parseInt(seqSnap.data().lastSI, 10) || 0) : 0;
      let si;
      if (/^SI-\d+$/i.test(typed)) {
        si = typed.toUpperCase();
        const n = parseInt(si.slice(3), 10);
        if (n > last) tx.set(seqRef, { lastSI: n }, { merge: true });
      } else if (typed) {
        si = typed;
      } else {
        const n = last + 1;
        si = 'SI-' + String(n).padStart(5, '0');
        tx.set(seqRef, { lastSI: n }, { merge: true });
      }
      upd.siNumber = si;
    }
    if (opts.poVal) { upd.manualPoNumber = opts.poVal; upd.poNumber = opts.poVal; }

    let missing = 0;
    if (apply) {
      const sign = mode === 'deduct' ? -1 : 1;
      items.forEach((i, idx) => {
        if (!prodSnaps[idx].exists) { missing++; return; }
        const w = parseFloat(i.wholeQty || 0), l = parseFloat(i.looseQty || 0);
        if (!w && !l) return;
        tx.update(prodRefs[idx], {
          stockWhole: firebase.firestore.FieldValue.increment(sign * w),
          stockLoose: firebase.firestore.FieldValue.increment(sign * l)
        });
        tx.set(db.collection('stock_movements').doc(),
          stockMovementDoc(prodRefs[idx].id, i.itemName, mode === 'deduct' ? 'ORDER_DEDUCT' : 'ORDER_RESTOCK', orderId, sign * w, sign * l));
      });
      if (mode === 'deduct') { upd.stockDeducted = true; upd.stockDeductedAt = firebase.firestore.FieldValue.serverTimestamp(); }
      else { upd.stockRestocked = true; upd.stockRestockedAt = firebase.firestore.FieldValue.serverTimestamp(); }
    }
    tx.update(orderRef, upd);
    return { applied: apply, missing: missing, siNumber: upd.siNumber || o.siNumber || '' };
  });
}

// ========================================================
// ORDERS QUEUE & STATION-BY-STATION PICKING SLIP GENERATOR
// ========================================================

async function getNextSINumber() {
  if (typeof db === 'undefined' || !db) return '';
  try {
    const doc = await db.collection('system_settings').doc('invoice_sequence').get();
    let currentSeq = 0;
    if (doc.exists) {
      currentSeq = doc.data().lastSI || 0;
    }
    const nextSeq = currentSeq + 1;
    return 'SI-' + String(nextSeq).padStart(5, '0');
  } catch (err) {
    console.error('Error getting next SI:', err);
    return '';
  }
}

async function loadIncomingOrders() {
  const tbody = document.getElementById('incoming-orders-tbody');
  if (!tbody || typeof db === 'undefined' || !db) return;

  try {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: #64748b; padding: 1rem;">Kinukuha ang mga orders mula sa mga branch...</td></tr>';
    const snap = await db.collection('orders').orderBy('createdAt', 'desc').limit(150).get();

    currentOrders = [];
    if (!snap.empty) {
      snap.forEach(doc => {
        currentOrders.push({ id: doc.id, ...doc.data() });
      });
    }

    filterCommissaryOrdersTable(); // Render table using the smart logic
  } catch (err) {
    console.error('Error loading incoming orders:', err);
    tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: #ef4444;">Error sa pagkuha ng orders: ${err.message}</td></tr>`;
  }
}

function filterCommissaryOrdersTable() {
  const tbody = document.getElementById('incoming-orders-tbody');
  if (!tbody) return;
  
  if (currentOrders.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: #94a3b8; padding: 1.5rem;">Walang nakabinbing order mula sa mga branch.</td></tr>';
    return;
  }

  const query = document.getElementById('comm-orders-search')?.value.toLowerCase().trim() || '';
  const statusFilter = document.getElementById('comm-orders-status-filter')?.value || 'view_all';

  let filtered = currentOrders.filter(ord => {
    const id = (ord.orderId || ord.id || '').toLowerCase();
    const branch = (ord.branchName || '').toLowerCase();
    const st = ord.status || 'Pending Preparation';
    
    // Search match
    const matchSearch = id.includes(query) || branch.includes(query) || st.toLowerCase().includes(query);
    
    // Dropdown Status match
    let matchStatus = true;
    if (statusFilter !== 'view_all') {
      if (statusFilter === 'Pending Preparation') matchStatus = st === 'Pending Preparation';
      else if (statusFilter === 'Preparing') matchStatus = st.includes('Preparing') || st.includes('Packed');
      else if (statusFilter === 'Dispatched') matchStatus = st.includes('Dispatched');
      else if (statusFilter === 'Cancelled') matchStatus = st.includes('Cancelled') || st.includes('Completed') || st.includes('Closed');
    }

    return matchSearch && matchStatus;
  });

  // SMART SORTING if view_all
  if (statusFilter === 'view_all') {
    filtered.sort((a, b) => {
      const getPrio = (st) => {
        if (st === 'Pending Preparation') return 1;
        if (st.includes('Dispatched')) return 2;
        if (st.includes('Preparing') || st.includes('Packed')) return 3;
        return 4; // Cancelled, Completed, Closed, etc.
      };
      
      const prioA = getPrio(a.status || 'Pending Preparation');
      const prioB = getPrio(b.status || 'Pending Preparation');
      
      if (prioA !== prioB) return prioA - prioB;
      
      // Secondary sort: Newest first within same priority
      const timeA = a.createdAt?.seconds || 0;
      const timeB = b.createdAt?.seconds || 0;
      return timeB - timeA;
    });
  }

  if (filtered.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: #94a3b8; padding: 1.5rem;">Walang order na tumugma sa filter.</td></tr>';
    return;
  }

  let rowsHtml = '';
  filtered.forEach(ord => {
    const dateStr = ord.createdAt ? new Date(ord.createdAt.toDate ? ord.createdAt.toDate() : ord.createdAt).toLocaleString() : 'Just now';
    const itemCount = (ord.items || []).length;
    const totalAmount = parseFloat(ord.totalAmount || 0).toLocaleString('en-PH', { style: 'currency', currency: 'PHP' });
    const status = ord.status || 'Pending Preparation';

    let statusBadge = '<span class="badge badge-warning">⏳ ' + status + '</span>';
    if (status.includes('Prepared') || status.includes('Ready') || status.includes('Packed') || status.includes('Preparing')) {
      statusBadge = '<span class="badge badge-commissary">📦 ' + status + '</span>';
    } else if (status.includes('Dispatched') || status.includes('Completed')) {
      statusBadge = '<span class="badge badge-branch">🚚 ' + status + '</span>';
    } else if (status.includes('Cancel') || status.includes('Closed')) {
      statusBadge = '<span class="badge badge-danger">❌ ' + status + '</span>';
    }

    const highlightStyle = (statusFilter === 'view_all' && status === 'Pending Preparation') ? 'background-color: #fefce8;' : '';

    rowsHtml += `
      <tr style="${highlightStyle}">
        <td><b>${ord.orderId || ord.id}</b><br><small style="color: #64748b;">${dateStr}</small></td>
        <td><b>${ord.branchName || 'Branch'}</b></td>
        <td>${itemCount} item(s)</td>
        <td><b style="color: #2563eb;">${totalAmount}</b></td>
        <td>${statusBadge}</td>
        <td>
          <div style="display: flex; gap: 0.35rem; flex-wrap: wrap;">
            <button class="btn btn-sm btn-primary" style="font-weight: 700;" onclick="openCommissaryOrderModal('${ord.id}')">🔍 Buksan / Ihanda</button>
            <button class="btn btn-sm btn-secondary" onclick="printPickingGuide('${ord.id}', '3col')">🖨️ Slip</button>
            <button class="btn btn-sm btn-success" title="I-download bilang 5-Column CSV" onclick="downloadBranchOrderCSV('${ord.id}')">📥 CSV</button>
            <select onchange="updateOrderStatus('${ord.id}', this.value)" style="width: auto; font-size: 0.75rem; padding: 0.2rem 0.4rem; border: 1px solid #cbd5e1; border-radius: 4px;">
              <option value="Pending Preparation" ${status === 'Pending Preparation' ? 'selected' : ''}>Pending</option>
              <option value="Preparing at Stations" ${status === 'Preparing at Stations' ? 'selected' : ''}>Preparing</option>
              <option value="Packed in Boxes/Bags" ${status === 'Packed in Boxes/Bags' ? 'selected' : ''}>Packed</option>
              <option value="Dispatched / En Route" ${status === 'Dispatched / En Route' ? 'selected' : ''}>Dispatched</option>
            </select>
          </div>
        </td>
      </tr>
    `;
  });

  tbody.innerHTML = rowsHtml;
}

async function updateOrderStatus(orderId, newStatus) {
  if (!db) return;
  try {
    await db.collection('orders').doc(orderId).update({
      status: newStatus,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    loadIncomingOrders();
  } catch (err) {
    alert('Error updating status: ' + err.message);
  }
}

// Function to print the Station-by-Station picking guide on A4 bond paper (1-column or 3-columns)
function printPickingGuide(orderId) {
  const order = currentOrders.find(o => o.id === orderId);
  if (!order) {
    alert('Hindi nahanap ang order details.');
    return;
  }

  // Group items by storageStation
  const stationGroups = {};
  (order.items || []).forEach(item => {
    const station = item.storageStation || 'General Storage';
    if (!stationGroups[station]) {
      stationGroups[station] = [];
    }
    stationGroups[station].push(item);
  });

  const orderDate = order.createdAt ? new Date(order.createdAt.toDate ? order.createdAt.toDate() : order.createdAt).toLocaleString() : new Date().toLocaleString();
  const totalAmountStr = parseFloat(order.totalAmount || 0).toLocaleString('en-PH', { style: 'currency', currency: 'PHP' });

  let printContainer = document.getElementById('printable-picking-slip');
  if (!printContainer) {
    printContainer = document.createElement('div');
    printContainer.id = 'printable-picking-slip';
    printContainer.className = 'print-guide-container'; // nakatago sa screen; lumalabas lang kapag magpi-print
    document.body.appendChild(printContainer);
  }

  // Generate Table Rows
  let tableRowsHtml = '';
  for (const [stationName, items] of Object.entries(stationGroups)) {
    // Station Header
    tableRowsHtml += `
      <tr>
        <td colspan="5" style="background-color: #f1f5f9; font-weight: 800; border: 1px solid #cbd5e1; padding: 6px; font-size: 10pt; color: #334155;">
          📍 STAGING AREA: ${stationName.toUpperCase()}
        </td>
      </tr>
    `;
    
    items.forEach(item => {
      const wholePart = item.wholeQty > 0 ? `${item.wholeQty} ${item.wholeUOM || 'W'}` : '';
      const loosePart = item.looseQty > 0 ? `${item.looseQty} ${item.looseUOM || 'L'}` : '';
      const qtyStr = [wholePart, loosePart].filter(Boolean).join(' + ') || '0';
      
      const subtotalStr = parseFloat(item.subtotal || 0).toLocaleString('en-PH', { style: 'currency', currency: 'PHP' });
      // Determine unit cost for display (using whole price as primary, fallback to loose if whole is 0)
      let unitCost = parseFloat(item.wholePrice || 0);
      if (unitCost === 0) unitCost = parseFloat(item.loosePrice || 0);
      const unitCostStr = unitCost.toLocaleString('en-PH', { style: 'currency', currency: 'PHP' });

      const itemCodeStr = item.itemCode || item.sapCode || item.posCode || '--';

      const packGuideHtml = item.packagingInstructions ? `<br><small style="color: #64748b;"><i>* Note: ${item.packagingInstructions}</i></small>` : '';

      tableRowsHtml += `
        <tr>
          <td style="border: 1px solid #cbd5e1; padding: 6px; font-family: monospace; font-size: 9.5pt;">${itemCodeStr}</td>
          <td style="border: 1px solid #cbd5e1; padding: 6px; font-size: 9.5pt; font-weight: 600;">${item.itemName}${packGuideHtml}</td>
          <td style="border: 1px solid #cbd5e1; padding: 6px; text-align: center; font-size: 9.5pt;">${qtyStr}</td>
          <td style="border: 1px solid #cbd5e1; padding: 6px; text-align: right; font-size: 9.5pt;">${unitCostStr}</td>
          <td style="border: 1px solid #cbd5e1; padding: 6px; text-align: right; font-size: 9.5pt; font-weight: 700; color: #1e293b;">${subtotalStr}</td>
        </tr>
      `;
    });
  }

  const brandName = (localStorage.getItem('kusina_brand_name') || 'KusinaERP').toUpperCase();
  const brandLogo = localStorage.getItem('kusina_brand_logo') || '';
  const brandSubtitle = localStorage.getItem('kusina_brand_subtitle') || 'Central Commissary & Food Logistics Hub';
  const brandTin = localStorage.getItem('kusina_brand_tin') || '000-000-000-000 VAT';
  const brandAddress = localStorage.getItem('kusina_brand_address') || 'Metro Manila, Philippines';
  const brandContact = localStorage.getItem('kusina_brand_contact') || '(02) 8000-0000 / 0917-000-0000';

  const drNo = order.drNumber || ('DR-' + (order.orderId || order.id).replace(/[^0-9]/g, ''));
  const siNo = order.siNumber || ('SI-' + (order.orderId || order.id).replace(/[^0-9]/g, ''));
  const poNo = order.manualPoNumber || order.poNumber || order.orderId || order.id;
  const branchAddress = order.branchAddress || order.deliveryAddress || 'As per registered store outlet address';

  const logoHtml = brandLogo 
    ? `<img src="${brandLogo}" style="max-height: 60px; object-fit: contain; margin-bottom: 5px;" alt="Logo"><br>` 
    : '';

  printContainer.innerHTML = `
    <div style="font-family: Arial, sans-serif; background: #fff; width: 100%; max-width: 1000px; margin: auto; padding: 10px;">
      
      <!-- HEADER -->
      <div style="text-align: center; margin-bottom: 20px;">
        ${logoHtml}
        <h2 style="margin: 0; font-size: 18pt; font-weight: 900; letter-spacing: 0.5px;">${brandName}</h2>
        <div style="font-size: 9pt; color: #333; margin-top: 4px;">${brandAddress}</div>
        <div style="font-size: 9pt; color: #333; margin-top: 2px;">TIN: ${brandTin} | Contact: ${brandContact}</div>
        <h3 style="margin: 15px 0 5px 0; font-size: 14pt; color: #1e3a8a; text-transform: uppercase; font-weight: 800;">PURCHASE / DELIVERY RECEIPT</h3>
      </div>
      
      <!-- DETAILS -->
      <div style="display: flex; justify-content: space-between; margin-bottom: 15px; font-size: 10pt; line-height: 1.4;">
        <div>
          <b>Delivered To:</b> ${order.branchName || 'Branch'}<br>
          <b>Address:</b> ${branchAddress}
        </div>
        <div style="text-align: right;">
          <b>PO #:</b> ${poNo}<br>
          <b>DR / SI #:</b> ${drNo} / ${siNo}<br>
          <b>PO Date:</b> ${orderDate}<br>
          <b>Target Delivery:</b> ${order.targetDeliveryDate || 'ASAP'}<br>
          <b>Status:</b> ${order.status || 'Pending'}
        </div>
      </div>
      
      <!-- TABLE -->
      <table style="width: 100%; border-collapse: collapse; font-size: 10pt; border: 1px solid #cbd5e1;">
        <thead>
          <tr style="background-color: #dbeafe; border: 1px solid #cbd5e1;">
            <th style="padding: 8px; border: 1px solid #cbd5e1; text-align: left; width: 15%;">PRODUCT</th>
            <th style="padding: 8px; border: 1px solid #cbd5e1; text-align: left; width: 40%;">DESCRIPTION</th>
            <th style="padding: 8px; border: 1px solid #cbd5e1; text-align: center; width: 15%;">QTY</th>
            <th style="padding: 8px; border: 1px solid #cbd5e1; text-align: right; width: 15%;">ITEM COST</th>
            <th style="padding: 8px; border: 1px solid #cbd5e1; text-align: right; width: 15%;">TOTAL</th>
          </tr>
        </thead>
        <tbody>
          ${tableRowsHtml}
        </tbody>
      </table>
      
      <!-- TOTAL AMOUNT -->
      <div style="text-align: right; margin-top: 15px; font-size: 12pt; font-weight: bold;">
        GRAND TOTAL: <span style="color: #b91c1c;">${totalAmountStr}</span>
      </div>
      
      <!-- SIGN OFFS -->
      <div style="margin-top: 50px; display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; text-align: center; font-size: 9pt;">
        <div>_______________________<br><b>Prepared By</b></div>
        <div>_______________________<br><b>Checked By</b></div>
        <div>_______________________<br><b>Delivered By</b></div>
        <div>_______________________<br><b>Received By</b></div>
      </div>
    </div>
  `;

  document.body.classList.add('printing-guide');
  window.print();

  setTimeout(() => {
    document.body.classList.remove('printing-guide');
    clearPrintSlip();
  }, 1000);
}

// Linisin ang picking slip / PO na naiwan sa ilalim ng page
function clearPrintSlip() {
  document.body.classList.remove('printing-guide');
  const slip = document.getElementById('printable-picking-slip');
  if (slip) { slip.innerHTML = ''; slip.classList.add('print-guide-container'); }
}


// ==========================================
// 4. BRANCH PORTAL LOGIC & INTERACTIVE ORDERING
// ==========================================
let branchProducts = [];
let orderCart = [];
let selectedDeliveryDate = "";
let activeFillupProduct = null;

async function loadBranchProducts() {
  if (typeof db === 'undefined' || !db) return;

  try {
    const snap = await db.collection('products').get();
    branchProducts = [];
    const _co = await getBranchCompany();
    snap.forEach(doc => {
      const data = doc.data();
      if (productForCompany(data, _co)) branchProducts.push({ id: doc.id, ...data });
    });
    await applyCompanyPriceList(branchProducts, _co);
    // Populate catalog list if modal is open
    filterCatalogProducts();
  } catch (err) {
    console.error('Error loading branch products:', err);
  }
}

// Modal View Controls
function openOrderModal(keepExistingDate = false) {
  loadBranchDropdowns(); // Load customers and set VAT defaults

  const modal = document.getElementById('make-order-modal');
  if (!modal) return;
  modal.style.display = 'flex';

  if (!keepExistingDate || !selectedDeliveryDate) {
    // Set default target date to tomorrow
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dateInput = document.getElementById('order-target-date');
    if (dateInput) {
      const yyyy = tomorrow.getFullYear();
      const mm = String(tomorrow.getMonth() + 1).padStart(2, '0');
      const dd = String(tomorrow.getDate()).padStart(2, '0');
      dateInput.min = `${yyyy}-${mm}-${dd}`;
      if (!selectedDeliveryDate) {
        dateInput.value = `${yyyy}-${mm}-${dd}`;
      }
    }
  }

  if (selectedDeliveryDate) {
    proceedToCatalog();
  } else {
    onDeliveryDateSelected();
  }

  loadBranchProducts();
  renderCartBoxes();
}

function closeOrderModal() {
  const modal = document.getElementById('make-order-modal');
  if (modal) modal.style.display = 'none';
}

function onDeliveryDateSelected() {
  const dateInput = document.getElementById('order-target-date');
  const btnProceed = document.getElementById('btn-proceed-catalog');
  if (!dateInput || !btnProceed) return;

  if (dateInput.value) {
    btnProceed.disabled = false;
  } else {
    btnProceed.disabled = true;
  }
}

function proceedToCatalog() {
  const dateInput = document.getElementById('order-target-date');
  if (!dateInput || !dateInput.value) {
    alert('Mangyaring pumili muna ng petsa kung kailan dapat dumating ang delivery.');
    return;
  }

  selectedDeliveryDate = dateInput.value;
  const dateBadge = document.getElementById('date-selected-badge');
  if (dateBadge) {
    dateBadge.style.display = 'inline-block';
    dateBadge.innerText = `Target Delivery: ${selectedDeliveryDate}`;
  }

  const catalogSection = document.getElementById('step-catalog-section');
  if (catalogSection) {
    catalogSection.style.display = 'block';
  }

  filterCatalogProducts();
}

function filterCatalogProducts() {
  const searchInput = document.getElementById('catalog-search-input');
  const query = searchInput ? searchInput.value.toLowerCase().trim() : '';
  const container = document.getElementById('catalog-products-list');
  if (!container) return;

  if (branchProducts.length === 0) {
    container.innerHTML = '<div style="padding: 1.5rem; text-align: center; color: #94a3b8;">Walang nakitang produkto sa database ng Commissary.</div>';
    return;
  }

  const filtered = branchProducts.filter(p => {
    const name = (p.itemName || '').toLowerCase();
    const code = (p.itemCode || '').toLowerCase();
    const station = (p.storageStation || '').toLowerCase();
    return name.includes(query) || code.includes(query) || station.includes(query);
  });

  if (filtered.length === 0) {
    container.innerHTML = `<div style="padding: 1.5rem; text-align: center; color: #94a3b8;">Walang produktong tumugma sa "${query}".</div>`;
    return;
  }

  let html = '';
  filtered.forEach(p => {
    const wholePrice = parseFloat(p.wholePrice || 0).toLocaleString('en-PH', { style: 'currency', currency: 'PHP' });
    const loosePrice = parseFloat(p.loosePrice || 0).toLocaleString('en-PH', { style: 'currency', currency: 'PHP' });
    const wholeUOM = p.wholeUOM || 'Whole';
    const looseUOM = p.looseUOM || 'Loose';
    const station = p.storageStation || 'Station Unassigned';

    html += `
      <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.75rem 1rem; border-bottom: 1px solid #f1f5f9; transition: background 0.2s;" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='#fff'">
        <div>
          <b style="color: #1e293b; font-size: 0.95rem;">${p.itemName || p.id}</b>
          <div style="font-size: 0.8rem; color: #64748b; margin-top: 2px;">
            <span class="badge badge-admin" style="font-size: 0.7rem;">📍 ${station}</span> &nbsp;|&nbsp;
            <span>📦 ${wholePrice} / ${wholeUOM}</span> &nbsp;|&nbsp;
            <span>🥢 ${loosePrice} / ${looseUOM}</span> &nbsp;|&nbsp; ${ordStockBadge(p)}
          </div>
        </div>
        <div>
          <button type="button" class="btn btn-primary btn-sm" onclick="selectProductForFillup('${p.id}')">
            Piliin Ito ➔
          </button>
        </div>
      </div>
    `;
  });

  container.innerHTML = html;
}

function selectProductForFillup(productId) {
  const prod = branchProducts.find(p => p.id === productId);
  if (!prod) return;

  activeFillupProduct = prod;

  const fillupBox = document.getElementById('selected-product-fillup');
  if (!fillupBox) return;

  fillupBox.style.display = 'block';

  // 1. Pangalan at Storage Station
  const nameEl = document.getElementById('fillup-item-name');
  if (nameEl) nameEl.innerText = prod.itemName || prod.id;

  const stationEl = document.getElementById('fillup-station-name');
  if (stationEl) stationEl.innerText = `📍 ${prod.storageStation || 'Unassigned'}`;

  // 2. Dynamic Codes (SAP, POS, Barcode) - walang maiiwang dash dash kung may data
  const posCode = prod.posCode || prod.pos_code || '--';
  const sapCode = prod.sapCode || prod.itemCode || prod.id || '--';
  const barcode = prod.barcode || prod.barcodeNumber || '--';
  const codesEl = document.getElementById('fillup-item-codes');
  if (codesEl) {
    codesEl.innerText = `SAP: ${sapCode} | POS: ${posCode} | Barcode: ${barcode}`;
  }

  // 3. Dynamic UOMs, Rates, at Conversion Factor mula sa mismong produkto
  const wholeUOM = prod.wholeUOM || 'Whole';
  const looseUOM = prod.looseUOM || 'Loose';
  const wholePrice = parseFloat(prod.wholePrice || 0);
  const loosePrice = parseFloat(prod.loosePrice || 0);
  const convFactor = parseInt(prod.conversionFactor || 1);

  // UOM Guide Elements
  const gWholeUom = document.getElementById('guide-whole-uom');
  if (gWholeUom) gWholeUom.innerText = wholeUOM;

  const gWholeRate = document.getElementById('guide-whole-rate');
  if (gWholeRate) gWholeRate.innerText = `₱${wholePrice.toFixed(2)}`;

  const gLooseUom = document.getElementById('guide-loose-uom');
  if (gLooseUom) gLooseUom.innerText = looseUOM;

  const gLooseRate = document.getElementById('guide-loose-rate');
  if (gLooseRate) gLooseRate.innerText = `₱${loosePrice.toFixed(2)}`;

  const gConv = document.getElementById('guide-conversion-text');
  if (gConv) gConv.innerText = `1 ${wholeUOM} = ${convFactor} ${looseUOM}`;

  // Rate Display sa Labels
  const wholeLabel = document.getElementById('fillup-whole-label');
  if (wholeLabel) wholeLabel.innerText = `Dami ng Whole (${wholeUOM}) - ₱${wholePrice.toFixed(2)}`;

  const looseLabel = document.getElementById('fillup-loose-label');
  if (looseLabel) looseLabel.innerText = `Dami ng Loose (${looseUOM}) - ₱${loosePrice.toFixed(2)}`;

  // Packaging tips
  const packTipEl = document.getElementById('fillup-packaging-tip');
  if (packTipEl) {
    if (prod.packagingInstructions) {
      packTipEl.parentElement.style.display = 'block';
      packTipEl.innerText = prod.packagingInstructions;
    } else {
      packTipEl.parentElement.style.display = 'none';
    }
  }

  // I-reset ang quantity inputs sa 0
  const wholeQtyInput = document.getElementById('fillup-whole-qty');
  if (wholeQtyInput) wholeQtyInput.value = 0;

  const looseQtyInput = document.getElementById('fillup-loose-qty');
  if (looseQtyInput) looseQtyInput.value = 0;

  calculateFillupSubtotal();

  // Smooth scroll papunta sa fillup box
  fillupBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function calculateFillupSubtotal() {
  if (!activeFillupProduct) return;
  const wholeQty = parseFloat(document.getElementById('fillup-whole-qty').value || 0) || 0;
  const looseQty = parseFloat(document.getElementById('fillup-loose-qty').value || 0) || 0;

  const wholePrice = parseFloat(activeFillupProduct.wholePrice || 0);
  const loosePrice = parseFloat(activeFillupProduct.loosePrice || 0);

  const subtotal = (wholeQty * wholePrice) + (looseQty * loosePrice);
  const subtotalEl = document.getElementById('fillup-subtotal-text');
  if (subtotalEl) {
    subtotalEl.innerText = `₱${subtotal.toFixed(2)}`;
  }
}

function confirmAddSelectedToCart() {
  if (!activeFillupProduct) {
    alert('Mangyaring pumili muna ng produkto.');
    return;
  }

  const wholeQty = parseFloat(document.getElementById('fillup-whole-qty').value || 0) || 0;
  const looseQty = parseFloat(document.getElementById('fillup-loose-qty').value || 0) || 0;

  if (wholeQty <= 0 && looseQty <= 0) {
    alert('Mangyaring maglagay ng bilang para sa Whole o Loose quantity bago i-add to cart.');
    return;
  }

  const wholePrice = parseFloat(activeFillupProduct.wholePrice || 0);
  const loosePrice = parseFloat(activeFillupProduct.loosePrice || 0);
  const wholeUOM = activeFillupProduct.wholeUOM || 'Whole';
  const looseUOM = activeFillupProduct.looseUOM || 'Loose';
  const subtotal = (wholeQty * wholePrice) + (looseQty * loosePrice);

  { // availability check — hindi puwedeng lumagpas sa available na stock
    const code0 = activeFillupProduct.itemCode || activeFillupProduct.id;
    const ex = orderCart.find(i => i.itemCode === code0);
    const chk = ordCheckStock(activeFillupProduct, wholeQty + (ex ? ex.wholeQty : 0), looseQty + (ex ? ex.looseQty : 0));
    if (!chk.ok) { alert(`⚠️ ${activeFillupProduct.itemName || code0}: ${chk.msg}`); return; }
  }
  // Check if item already exists in cart, then increment or add
  const existingIdx = orderCart.findIndex(item => item.itemCode === (activeFillupProduct.itemCode || activeFillupProduct.id));
  if (existingIdx >= 0) {
    orderCart[existingIdx].wholeQty += wholeQty;
    orderCart[existingIdx].looseQty += looseQty;
    orderCart[existingIdx].subtotal += subtotal;
  } else {
    orderCart.push({
      itemCode: activeFillupProduct.itemCode || activeFillupProduct.id,
      itemName: activeFillupProduct.itemName || activeFillupProduct.id,
      storageStation: activeFillupProduct.storageStation || 'Station 1 - Cold Storage',
      packagingInstructions: activeFillupProduct.packagingInstructions || '',
      wholeQty: wholeQty,
      wholeUOM: wholeUOM,
      wholePrice: wholePrice,
      looseQty: looseQty,
      looseUOM: looseUOM,
      loosePrice: loosePrice,
      subtotal: subtotal
    });
  }

  // Reset fillup box
  document.getElementById('fillup-whole-qty').value = 0;
  document.getElementById('fillup-loose-qty').value = 0;
  document.getElementById('selected-product-fillup').style.display = 'none';
  activeFillupProduct = null;

  renderCartBoxes();
}

function removeItemFromCart(index) {
  orderCart.splice(index, 1);
  renderCartBoxes();
}

function renderCartBoxes() {
  // 1. Render Modal Cart Box
  const modalCartBox = document.getElementById('modal-cart-box');
  const modalTbody = document.getElementById('modal-cart-tbody');
  const modalCountBadge = document.getElementById('modal-cart-count-badge');
  const modalTotalText = document.getElementById('modal-cart-total-text');

  // 2. Render Page Summary Box (sa main branch page na humahaba)
  const pageSummaryBox = document.getElementById('branch-order-summary-box');
  const pageTbody = document.getElementById('cart-summary-tbody');
  const pageCountSpan = document.getElementById('cart-item-count');
  const pageGrandTotal = document.getElementById('cart-summary-grand-total');
  const pageDateBadge = document.getElementById('summary-delivery-date-badge');

  let grandTotal = 0;
  orderCart.forEach(item => grandTotal += item.subtotal);

  // New logic for VAT and Discount
  const totals = (typeof calculateBranchCartTotals === 'function') ? calculateBranchCartTotals() : { finalTotal: grandTotal };
  const totalStr = totals.isComplimentary ? '₱0.00 (COMPLIMENTARY)' : '₱' + totals.finalTotal.toFixed(2);
  
  const summaryDetails = document.getElementById('cart-summary-details');
  if (summaryDetails && typeof calculateBranchCartTotals === 'function') {
    summaryDetails.innerHTML = `Subtotal: ₱${totals.subtotal.toFixed(2)} | Discount: -₱${totals.discountAmt.toFixed(2)} | VAT: ₱${totals.vatAmount.toFixed(2)}`;
  }


  if (orderCart.length === 0) {
    if (modalCartBox) modalCartBox.style.display = 'none';
    if (pageSummaryBox) pageSummaryBox.style.display = 'none';
    if (modalTbody) modalTbody.innerHTML = '';
    if (pageTbody) pageTbody.innerHTML = '';
    return;
  }

  if (modalCartBox) modalCartBox.style.display = 'block';
  if (pageSummaryBox) pageSummaryBox.style.display = 'block';

  let rowsHtml = '';
  orderCart.forEach((item, idx) => {
    const wholePart = item.wholeQty > 0 ? `${item.wholeQty} ${item.wholeUOM}` : '';
    const loosePart = item.looseQty > 0 ? `${item.looseQty} ${item.looseUOM}` : '';
    const qtyText = [wholePart, loosePart].filter(Boolean).join(' + ');

    rowsHtml += `
      <tr>
        <td><b>${item.itemName}</b></td>
        <td><span class="badge badge-admin">📍 ${item.storageStation}</span></td>
        <td><b>${qtyText}</b></td>
        <td style="color: #2563eb; font-weight: 700;">₱${item.subtotal.toFixed(2)}</td>
        <td>
          <button type="button" class="btn btn-sm btn-danger" onclick="removeItemFromCart(${idx})">✕</button>
        </td>
      </tr>
    `;
  });

  if (modalTbody) modalTbody.innerHTML = rowsHtml;
  if (pageTbody) pageTbody.innerHTML = rowsHtml;

  if (modalCountBadge) modalCountBadge.innerText = `${orderCart.length} item(s)`;
  if (pageCountSpan) pageCountSpan.innerText = orderCart.length;

  if (modalTotalText) modalTotalText.innerText = totalStr;
  if (pageGrandTotal) pageGrandTotal.innerText = totalStr;

  if (pageDateBadge && selectedDeliveryDate) {
    pageDateBadge.innerText = `📅 Target Delivery: ${selectedDeliveryDate}`;
  }
}

async function submitBranchOrderFromModal() {
  closeOrderModal();
  await submitBranchOrder();
}

async function submitBranchOrder() {
  if (orderCart.length === 0) {
    alert('Walang laman ang iyong order basket. Pindutin ang "Make an Order" para magdagdag ng mga produkto.');
    return;
  }

  if (!selectedDeliveryDate) {
    alert('Mangyaring itakda muna ang Target Delivery Date bago i-place ang order.');
    openOrderModal();
    return;
  }

  const u = getCurrentUser();
  const branchName = (u && u.branch) ? u.branch : (u ? u.name : 'Branch ATC');
  const branchAddress = (u && u.address) ? u.address : 'As per registered store outlet address';
  const orderId = 'PO-' + Date.now().toString().slice(-6);

  const totals = (typeof calculateBranchCartTotals === 'function') ? calculateBranchCartTotals() : { finalTotal: 0, subtotal: 0, discountAmt: 0, vatAmount: 0 };
  let grandTotal = totals.finalTotal;
  
  const customerId = document.getElementById('order-customer')?.value || '';
  const customerName = document.getElementById('order-customer')?.options[document.getElementById('order-customer')?.selectedIndex]?.text || '';
  const discountRate = document.getElementById('order-discount')?.value || '0';
  const vatOpt = document.getElementById('order-vat')?.value || 'inclusive';

  if (!db) {
    alert('Walang koneksyon sa database.');
    return;
  }

  try {
    const bad = await ordFreshStockCheck(orderCart);
    if (bad.length) { alert('⚠️ Hindi na sapat ang stock:\n\n' + bad.join('\n') + '\n\nBaguhin ang quantity sa basket.'); openOrderModal(); return; }
  } catch (e) { console.warn('stock check', e); }
  try {
    await db.collection('orders').doc(orderId).set({
      isAgentOrder: !!customerId,
      agentName: customerId ? ((u && (u.name || u.email)) || '') : '',
      paymentStatus: 'Unpaid',
      amountPaid: 0,
      orderId: orderId,
      branchName: branchName,
      branchAddress: branchAddress,
      branchEmail: u ? u.email : '',
      targetDeliveryDate: selectedDeliveryDate,
      items: orderCart,
      totalAmount: grandTotal,
      subtotalAmount: totals.subtotal,
      discountAmount: totals.discountAmt,
      discountRate: discountRate,
      vatAmount: totals.vatAmount,
      vatType: vatOpt,
      customerId: customerId,
      customerName: customerName === '-- Piliin ang Customer (Agent Mode) --' ? '' : customerName,
      status: 'Pending Preparation',
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    logSystemAction('ORDER_PLACED', `Nag-place ng order ang branch. PO: ${orderId}, Total: ₱${grandTotal.toFixed(2)}`);
    alert(`🎉 Matagumpay na na-Place ang Order (${orderId})!\n\nTarget Delivery Date: ${selectedDeliveryDate}\nKabuuang Items: ${orderCart.length}\nKabuuang Halaga: ₱${grandTotal.toFixed(2)}

Makikita na ito agad sa Commissary Portal na may Station-by-Station picking guide!`);

    orderCart = [];
    selectedDeliveryDate = "";
    activeFillupProduct = null;
    renderCartBoxes();
    closeOrderModal();
  } catch (err) {
    console.error('Error submitting order:', err);
    alert('Error sa pagpapadala ng order: ' + err.message);
  }
}

// Touch Signature Pad (Branch)
const sigCanvas = document.getElementById('sig-canvas');
let sigCtx = null;
let isSigDrawing = false;

if (sigCanvas) {
  sigCtx = sigCanvas.getContext('2d');
  function resizeSigCanvas() {
    sigCanvas.width = sigCanvas.parentElement.clientWidth;
    sigCanvas.height = sigCanvas.parentElement.clientHeight;
    sigCtx.lineWidth = 2;
    sigCtx.lineCap = 'round';
    sigCtx.strokeStyle = '#0f172a';
  }
  window.addEventListener('resize', resizeSigCanvas);
  resizeSigCanvas();

  function getSigCoords(e) {
    const rect = sigCanvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return { x: clientX - rect.left, y: clientY - rect.top };
  }

  function startSigDraw(e) {
    isSigDrawing = true;
    const pos = getSigCoords(e);
    sigCtx.beginPath();
    sigCtx.moveTo(pos.x, pos.y);
  }

  function doSigDraw(e) {
    if (!isSigDrawing) return;
    const pos = getSigCoords(e);
    sigCtx.lineTo(pos.x, pos.y);
    sigCtx.stroke();
  }

  function stopSigDraw() { isSigDrawing = false; }

  sigCanvas.addEventListener('mousedown', startSigDraw);
  sigCanvas.addEventListener('mousemove', doSigDraw);
  sigCanvas.addEventListener('mouseup', stopSigDraw);
  sigCanvas.addEventListener('mouseleave', stopSigDraw);

  sigCanvas.addEventListener('touchstart', (e) => { e.preventDefault(); startSigDraw(e); }, { passive: false });
  sigCanvas.addEventListener('touchmove', (e) => { e.preventDefault(); doSigDraw(e); }, { passive: false });
  sigCanvas.addEventListener('touchend', stopSigDraw);
}

function clearSignature() {
  if (sigCtx && sigCanvas) {
    sigCtx.clearRect(0, 0, sigCanvas.width, sigCanvas.height);
  }
}

function saveReceivingProof() {
  const ts = new Date().toLocaleString();
  alert(`Naitala ang e-POD at pirma sa system! Oras: ${ts}`);
}

function submitReturnManifest() {
  const item = document.getElementById('return-item-name').value.trim();
  if (!item) {
    alert('Mangyaring ilagay ang item na ibabalik.');
    return;
  }
  alert('Naitala ang return manifest. Hihintayin ang cross-check inspection sa Commissary.');
  document.getElementById('return-item-name').value = '';
}


// ========================================================
// AUTO-COMPUTE LOOSE PRICE & 5-COLUMN ORDER EXTRACTION
// ========================================================

function autoComputeAdminLoosePrice() {
  const wholePrice = parseFloat(document.getElementById('admin-item-whole-price').value || 0);
  const conversion = parseFloat(document.getElementById('admin-item-conversion').value || 1);
  const looseInput = document.getElementById('admin-item-loose-price');
  if (conversion > 0 && wholePrice > 0) {
    if (looseInput) looseInput.value = (wholePrice / conversion).toFixed(2);
  }
}

function autoComputeCommissaryLoosePrice() {
  const wholePrice = parseFloat(document.getElementById('new-whole-price').value || 0);
  const conversion = parseFloat(document.getElementById('new-conversion-factor').value || 1);
  const looseInput = document.getElementById('new-loose-price');
  if (conversion > 0 && wholePrice > 0) {
    if (looseInput) looseInput.value = (wholePrice / conversion).toFixed(2);
  }
}

function downloadBranchOrderCSV(orderId) {
  const order = currentOrders.find(o => o.id === orderId);
  if (!order || !order.items || order.items.length === 0) {
    alert('Walang laman o hindi nahanap ang order details.');
    return;
  }

  const headers = ['POS_Code', 'SAP_Code', 'Item_Description', 'Quantity', 'Pricing'];
  const rows = [headers.join(',')];

  order.items.forEach(item => {
    const posCode = item.posCode || item.pos_code || '--';
    const sapCode = item.sapCode || item.itemCode || item.id || '--';
    const desc = (item.itemName || '').replace(/"/g, '""');
    
    const wholePart = item.wholeQty > 0 ? `${item.wholeQty} ${item.wholeUOM || 'Whole'}` : '';
    const loosePart = item.looseQty > 0 ? `${item.looseQty} ${item.looseUOM || 'Loose'}` : '';
    const qtyText = [wholePart, loosePart].filter(Boolean).join(' + ') || '1';
    const pricing = parseFloat(item.subtotal || 0).toFixed(2);

    rows.push(`"${posCode}","${sapCode}","${desc}","${qtyText}",${pricing}`);
  });

  const csvContent = "\uFEFF" + rows.join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const safeBranch = (order.branchName || 'Branch').replace(/\s+/g, '_');
  
  link.href = url;
  link.download = `Order_${order.orderId || order.id}_${safeBranch}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function copyBranchOrderToClipboard(orderId) {
  const order = currentOrders.find(o => o.id === orderId);
  if (!order || !order.items || order.items.length === 0) {
    alert('Walang laman ang order details.');
    return;
  }

  const headers = ['POS Code', 'SAP Code', 'Item Description', 'Quantity', 'Pricing'];
  let tsvContent = headers.join('\t') + '\n';

  order.items.forEach(item => {
    const posCode = item.posCode || item.pos_code || '--';
    const sapCode = item.sapCode || item.itemCode || item.id || '--';
    const desc = item.itemName || '';
    
    const wholePart = item.wholeQty > 0 ? `${item.wholeQty} ${item.wholeUOM || 'Whole'}` : '';
    const loosePart = item.looseQty > 0 ? `${item.looseQty} ${item.looseUOM || 'Loose'}` : '';
    const qtyText = [wholePart, loosePart].filter(Boolean).join(' + ') || '1';
    const pricing = parseFloat(item.subtotal || 0).toFixed(2);

    tsvContent += `${posCode}\t${sapCode}\t${desc}\t${qtyText}\t${pricing}\n`;
  });

  navigator.clipboard.writeText(tsvContent).then(() => {
    alert(`📋 Nakopya na ang Order (${order.orderId || order.id})!\n\nPwede mo na itong i-Paste (Ctrl + V) diretso sa Excel o Google Sheets nang may 5 kolum:\n[POS Code] [SAP Code] [Item Description] [Quantity] [Pricing]`);
  }).catch(err => {
    alert('Hindi nakopya: ' + err.message);
  });
}


// ==========================================================================
// COMMISSARY DASHBOARD, THREE-DOT NAVIGATION, SEARCH & PROFILE ENGINE
// Author: Programmed by Renz Aldrin Gomez, 2026
// ==========================================================================

let commOrdersChartInstance = null;
let commStationsChartInstance = null;

// 1. Three-Dot Quick Navigation Menu Controller
function toggleCommissaryMenu() {
  const menu = document.getElementById('commissary-dropdown-menu');
  if (menu) menu.style.display = menu.style.display === 'block' ? 'none' : 'block';
}

window.addEventListener('click', function(e) {
  const menu = document.getElementById('commissary-dropdown-menu');
  const btn = document.getElementById('btn-three-dots');
  if (menu && btn && !btn.contains(e.target) && !menu.contains(e.target)) {
    menu.style.display = 'none';
  }
});

function switchCommissaryView(viewName) {
  const _fv = ACCESS_FEATURES.find(f => f.native === 'commissary' && f.view === viewName);
  if (_fv && !featureAllowed(_fv.key)) { featureDeniedMsg(_fv); return; }
  clearPrintSlip();
  document.querySelectorAll('.comm-view-section').forEach(sec => sec.style.display = 'none');
  const menu = document.getElementById('commissary-dropdown-menu');
  if (menu) menu.style.display = 'none';

  if (viewName === 'dashboard') {
    const dash = document.getElementById('view-commissary-dashboard');
    if (dash) dash.style.display = 'block';
    loadCommissaryAnalytics();
  } else if (viewName === 'orders') {
    const ords = document.getElementById('view-commissary-orders');
    if (ords) ords.style.display = 'block';
    loadIncomingOrders();
  } else if (viewName === 'inventory') {
    const inv = document.getElementById('view-commissary-inventory');
    if (inv) inv.style.display = 'block';
    loadCommissaryInventory();
  } else if (viewName === 'returns') {
    const ret = document.getElementById('view-commissary-returns');
    if (ret) ret.style.display = 'block';
  } else if (viewName === 'ordboard') {
    const el = document.getElementById('view-commissary-ordboard'); if (el) el.style.display = 'block'; loadOrderBoard();
  } else if (viewName === 'hrdocs') {
    const el = document.getElementById('view-commissary-hrdocs'); if (el) el.style.display = 'block'; loadHrDocs();
  } else if (viewName === 'attendance') {
    const el = document.getElementById('view-commissary-attendance');
    if (el) el.style.display = 'block';
    loadAttendance();
  } else if (viewName === 'requests') {
    const el = document.getElementById('view-commissary-requests');
    if (el) el.style.display = 'block';
    loadRequests();
  } else if (viewName === 'prices') {
    const el = document.getElementById('view-commissary-prices');
    if (el) el.style.display = 'block';
    loadDailyPrices();
  } else if (viewName === 'ar') {
    const el = document.getElementById('view-commissary-ar');
    if (el) el.style.display = 'block';
    loadArLedger();
  }
}

// 2. Executive Analytics Engine para sa Commissary Landing Page
async function loadCommissaryAnalytics() {
  if (typeof db === 'undefined' || !db) return;
  const u = getCurrentUser();
  const userHub = (u && u.branch) ? u.branch.toLowerCase().trim() : '';

  try {
    const ordersSnap = await db.collection('orders').get();
    let totalOrders = 0;
    let totalSpend = 0;
    const branchVolume = {};
    const stationDemand = {};

    ordersSnap.forEach(doc => {
      const ord = doc.data();
      totalOrders++;
      const val = parseFloat(ord.totalAmount || 0);
      totalSpend += val;
      const bName = ord.branchName || 'Branch';
      branchVolume[bName] = (branchVolume[bName] || 0) + 1;
      (ord.items || []).forEach(item => {
        const st = item.storageStation || 'General';
        stationDemand[st] = (stationDemand[st] || 0) + (parseFloat(item.wholeQty || 0) + parseFloat(item.looseQty || 0));
      });
    });

    // Check buffer limits
    const prodSnap = await db.collection('products').get();
    let belowBufferCount = 0;
    prodSnap.forEach(doc => {
      const p = doc.data();
      const pHub = (p.commissarySource || '').toLowerCase().trim();
      if (!pHub || pHub.includes(userHub) || userHub.includes(pHub)) {
        if ((p.stockWhole || 0) < (p.bufferLimit || 5)) belowBufferCount++;
      }
    });

    // Update KPI Displays
    const kpiOrders = document.getElementById('comm-kpi-orders');
    const kpiVal = document.getElementById('comm-kpi-value');
    const kpiBuf = document.getElementById('comm-kpi-buffer');
    const kpiStn = document.getElementById('comm-kpi-stations');

    if (kpiOrders) kpiOrders.innerText = totalOrders;
    if (kpiVal) kpiVal.innerText = '₱' + totalSpend.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    if (kpiBuf) kpiBuf.innerText = belowBufferCount;
    if (kpiStn) kpiStn.innerText = Object.keys(stationDemand).length;

    // Render Charts
    if (typeof Chart !== 'undefined') {
      const ctxOrders = document.getElementById('chart-comm-orders');
      if (ctxOrders) {
        if (commOrdersChartInstance) commOrdersChartInstance.destroy();
        commOrdersChartInstance = new Chart(ctxOrders, {
          type: 'bar',
          data: {
            labels: Object.keys(branchVolume).length > 0 ? Object.keys(branchVolume) : ['Walang Order'],
            datasets: [{ label: 'Orders Count', data: Object.values(branchVolume).length > 0 ? Object.values(branchVolume) : [0], backgroundColor: '#2563eb', borderRadius: 4 }]
          },
          options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
        });
      }

      const ctxStations = document.getElementById('chart-comm-stations');
      if (ctxStations) {
        if (commStationsChartInstance) commStationsChartInstance.destroy();
        commStationsChartInstance = new Chart(ctxStations, {
          type: 'doughnut',
          data: {
            labels: Object.keys(stationDemand).length > 0 ? Object.keys(stationDemand) : ['Stations'],
            datasets: [{ data: Object.values(stationDemand).length > 0 ? Object.values(stationDemand) : [1], backgroundColor: ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899'] }]
          },
          options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } }
        });
      }
    }
  } catch (err) {
    console.error('Error loading commissary analytics:', err);
  }
}

// 3. Search & Station Filter para sa Inventory Table
function filterCommissaryInventoryTable() {
  const query = (document.getElementById('comm-product-search')?.value || '').toLowerCase().trim();
  const stationSel = document.getElementById('station-filter')?.value || 'all';

  const filtered = currentInventory.filter(item => {
    const matchName = (item.itemName || '').toLowerCase().includes(query);
    const matchPOS = (item.posCode || '').toLowerCase().includes(query);
    const matchSAP = (item.sapCode || item.itemCode || item.id || '').toLowerCase().includes(query);
    const matchStation = (stationSel === 'all') || (item.storageStation === stationSel);
    return (matchName || matchPOS || matchSAP) && matchStation;
  });

  renderInventoryTable(filtered);
}

// 4. Enhanced renderInventoryTable na may [✏️ Edit] at [🗑️ Delete]
function renderInventoryTable(items) {
  const tbody = document.getElementById('inventory-tbody');
  if (!tbody) return;

  if (items.length === 0) {
    tbody.innerHTML = '<tr><td colspan="10" style="text-align: center; color: #94a3b8; padding: 1.5rem;">Walang produktong tumugma sa filter.</td></tr>';
    return;
  }

  let html = '';
  items.forEach(item => {
    const pos = item.posCode || item.pos_code || '--';
    const sap = item.sapCode || item.itemCode || item.id;
    const name = item.itemName || 'Walang Pangalan';
    const station = item.storageStation || 'Unassigned';
    const wholePrice = parseFloat(item.wholePrice || 0).toFixed(2);
    const loosePrice = parseFloat(item.loosePrice || 0).toFixed(2);
    const whole = item.stockWhole || 0;
    const loose = item.stockLoose || 0;
    const buffer = item.bufferLimit || 5;
    const status = item.status || 'active';

    const statusBadge = status === 'active' 
      ? '<span class="badge badge-branch">Active</span>' 
      : '<span class="badge badge-warning">Inactive</span>';

    html += `
      <tr>
        <td><b>${pos}</b></td>
        <td><b>${sap}</b></td>
        <td><b>${name}</b></td>
        <td><span class="badge badge-admin">📍 ${station}</span></td>
        <td>₱${wholePrice} / ${item.wholeUOM || 'Box'}</td>
        <td>₱${loosePrice} / ${item.looseUOM || 'Loose'}</td>
        <td><b>${whole}</b> ${item.wholeUOM || 'Box'} & <b>${loose}</b> ${item.looseUOM || 'Loose'}</td>
        <td>${buffer}</td>
        <td>${statusBadge}</td>
        <td style="text-align: center;">
          <div style="display: flex; gap: 0.35rem; justify-content: center; align-items: center;">
            <button class="btn btn-sm btn-primary" onclick="openCommissaryProductModal('${item.id}')">✏️ Edit</button>
            <button class="btn btn-sm btn-danger" onclick="deleteCommissaryProduct('${item.id}')">🗑️</button>
            <button class="btn btn-sm btn-secondary" onclick="updateStock('${item.id}', 5)">+5</button>
          </div>
        </td>
      </tr>
    `;
  });

  tbody.innerHTML = html;
}

// 5. Open Product Modal (Add & Edit Support sa Commissary)
function openCommissaryProductModal(productId = null) {
  loadDropdownOptions();
  const modal = document.getElementById('add-product-modal');
  if (!modal) return;

  const titleEl = document.getElementById('comm-product-modal-title');
  const origIdEl = document.getElementById('comm-original-doc-id');
  const posInput = document.getElementById('new-item-pos-code');
  const sapInput = document.getElementById('new-item-code');
  const barInput = document.getElementById('new-item-barcode');
  const nameInput = document.getElementById('new-item-name');
  const stationSelect = document.getElementById('new-storage-station');
  const wholeSelect = document.getElementById('new-whole-uom');
  const looseSelect = document.getElementById('new-loose-uom');
  const wholePriceInput = document.getElementById('new-whole-price');
  const loosePriceInput = document.getElementById('new-loose-price');
  const convInput = document.getElementById('new-conversion-factor');
  const bufInput = document.getElementById('new-buffer-limit');
  const statusInput = document.getElementById('new-item-status');
  const suppInput = document.getElementById('new-item-supplier');
  const packInput = document.getElementById('new-packaging-instructions');

  if (productId) {
    const prod = currentInventory.find(p => p.id === productId);
    if (!prod) return;
    if (titleEl) titleEl.innerText = `✏️ I-edit ang Produkto (${prod.sapCode || prod.itemCode || prod.id})`;
    if (origIdEl) origIdEl.value = prod.id;
    if (posInput) posInput.value = prod.posCode || prod.pos_code || '';
    if (sapInput) { sapInput.value = prod.sapCode || prod.itemCode || prod.id; sapInput.disabled = false; }
    if (barInput) barInput.value = prod.barcode || prod.barcodeNumber || '';
    if (nameInput) nameInput.value = prod.itemName || '';
    if (stationSelect) stationSelect.value = prod.storageStation || '';
    if (wholeSelect) wholeSelect.value = prod.wholeUOM || '';
    if (looseSelect) looseSelect.value = prod.looseUOM || '';
    if (wholePriceInput) wholePriceInput.value = prod.wholePrice || 0;
    if (loosePriceInput) loosePriceInput.value = prod.loosePrice || 0;
    if (convInput) convInput.value = prod.conversionFactor || 1;
    if (bufInput) bufInput.value = prod.bufferLimit || 5;
    if (statusInput) statusInput.value = prod.status || 'active';
    if (suppInput) suppInput.value = prod.supplier || '';
    if (packInput) packInput.value = prod.packagingInstructions || '';
  } else {
    if (titleEl) titleEl.innerText = '➕ Mag-tag ng Produkto';
    if (origIdEl) origIdEl.value = '';
    if (posInput) posInput.value = '';
    if (sapInput) { sapInput.value = ''; sapInput.disabled = false; }
    if (barInput) barInput.value = '';
    if (nameInput) nameInput.value = '';
    if (wholePriceInput) wholePriceInput.value = 0;
    if (loosePriceInput) loosePriceInput.value = 0;
    if (convInput) convInput.value = 1;
    if (bufInput) bufInput.value = 5;
    if (statusInput) statusInput.value = 'active';
    if (suppInput) suppInput.value = '';
    if (packInput) packInput.value = '';
  }

  modal.style.display = 'flex';
}

async function deleteCommissaryProduct(productId) {
  if (!await uiConfirm(`Sigurado ka bang nais mong burahin ang produktong "${productId}"?`)) return;
  if (!db) return;

  const u = getCurrentUser();
  const userEmail = u ? (u.email || u.name) : 'Commissary Head';

  try {
    const docRef = db.collection('products').doc(productId);
    const snap = await docRef.get();
    if (snap.exists) {
      await db.collection('product_logs').add({
        action: 'DELETED_BY_COMMISSARY',
        itemCode: productId,
        snapshot: snap.data(),
        deletedBy: userEmail,
        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
        dateStr: new Date().toLocaleString()
      });
    }

    await docRef.delete();
    await logSystemAction('PRODUCT_DELETED', `Binura ng planta ang produkto: ${productId}`);
    alert(`Matagumpay na nabura ang produkto at naitala sa audit logs.`);
    loadCommissaryInventory();
  } catch (err) {
    alert('Error sa pagbura: ' + err.message);
  }
}

// 7. User Profile Editor Logic para sa Commissary
function openCommissaryProfileModal() {
  const u = getCurrentUser();
  if (!u) return;

  const emailEl = document.getElementById('prof-email');
  const nameEl = document.getElementById('prof-name');
  const hubEl = document.getElementById('prof-hub');
  const addressEl = document.getElementById('prof-address');
  const passEl = document.getElementById('prof-new-pass');

  if (emailEl) emailEl.value = u.email || '';
  if (nameEl) nameEl.value = u.name || '';
  if (hubEl) hubEl.value = u.branch || 'Commissary Hub';
  if (addressEl) addressEl.value = u.address || '';
  if (passEl) passEl.value = '';

  // Load Profile Photo into Preview
  const previewEl = document.getElementById('comm-prof-pic-preview');
  const fallbackEl = document.getElementById('comm-prof-pic-fallback');
  if (u.photoUrl && previewEl) {
    previewEl.src = u.photoUrl;
    previewEl.style.display = 'inline-block';
    if (fallbackEl) fallbackEl.style.display = 'none';
  } else {
    if (previewEl) previewEl.style.display = 'none';
    if (fallbackEl) fallbackEl.style.display = 'flex';
  }
  
  // Reset temp photo
  window.tempSelectedProfilePhoto = null;

  const modal = document.getElementById('commissary-profile-modal');
  if (modal) modal.style.display = 'flex';
  const menu = document.getElementById('commissary-dropdown-menu');
  if (menu) menu.style.display = 'none';
}

function closeCommissaryProfileModal() {
  const modal = document.getElementById('commissary-profile-modal');
  if (modal) modal.style.display = 'none';
}

async function saveCommissaryProfile() {
  const u = getCurrentUser();
  if (!u || !db) return;

  const newName = (document.getElementById('prof-name')?.value || '').toUpperCase().trim();
  const newAddress = (document.getElementById('prof-address')?.value || '').trim();
  const newPass = document.getElementById('prof-new-pass')?.value || '';

  if (!newName) {
    alert('Mangyaring ilagay ang iyong pangalan.');
    return;
  }

  try {
    const updatePayload = {
      name: newName,
      address: newAddress,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    if (window.tempSelectedProfilePhoto) {
      updatePayload.photoUrl = window.tempSelectedProfilePhoto;
    }

    await db.collection('users').doc(u.email.toLowerCase()).update(updatePayload);

    if (newPass && newPass.length >= 6 && auth.currentUser) {
      await auth.currentUser.updatePassword(newPass);
    }

    u.name = newName;
    u.address = newAddress;
    if (window.tempSelectedProfilePhoto) {
      u.photoUrl = window.tempSelectedProfilePhoto;
    }
    setCurrentUser(u);

    if (u.photoUrl) {
      document.querySelectorAll('.user-avatar-img').forEach(img => {
        img.src = u.photoUrl;
        img.style.display = 'inline-block';
      });
      document.querySelectorAll('.user-avatar-initials').forEach(el => {
        el.style.display = 'none';
      });
    }

    const userDisp = document.getElementById('user-display');
    if (userDisp) userDisp.innerText = `${u.branch || 'Commissary Hub'}: ${newName}`;
    logSystemAction('PROFILE_UPDATED', `In-update ang Commissary profile/photo: ${newName}`);
    alert('✅ Matagumpay na na-update ang iyong Profile!');
    closeCommissaryProfileModal();
  } catch (err) {
    alert('Error sa pag-update ng profile: ' + err.message);
  }
}


// ========================================================
// UNIVERSAL SWIPE-TO-ACTION SLIDER ENGINE (TOUCH & MOUSE)
// ========================================================
function initSwipeSlider(trackId, btnId, onComplete) {
  const track = document.getElementById(trackId);
  const btn = document.getElementById(btnId);
  if (!track || !btn) return;

  let isDragging = false;
  let startX = 0;
  let maxDrag = track.clientWidth - btn.clientWidth - 6;

  function onStart(e) {
    isDragging = true;
    startX = (e.touches ? e.touches[0].clientX : e.clientX) - btn.offsetLeft;
    maxDrag = track.clientWidth - btn.clientWidth - 6;
  }

  function onMove(e) {
    if (!isDragging) return;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    let newLeft = clientX - startX;
    if (newLeft < 3) newLeft = 3;
    if (newLeft > maxDrag) newLeft = maxDrag;
    btn.style.left = newLeft + 'px';

    if (newLeft >= maxDrag - 5) {
      isDragging = false;
      btn.style.left = maxDrag + 'px';
      track.classList.add('completed');
      btn.classList.add('success');
      btn.innerText = '✓';
      if (typeof onComplete === 'function') onComplete();
    }
  }

  function onEnd() {
    if (!isDragging) return;
    isDragging = false;
    btn.style.transition = 'left 0.2s';
    btn.style.left = '3px';
    setTimeout(() => { btn.style.transition = ''; }, 200);
  }

  btn.addEventListener('mousedown', onStart);
  window.addEventListener('mousemove', onMove);
  window.addEventListener('mouseup', onEnd);

  btn.addEventListener('touchstart', onStart, { passive: true });
  window.addEventListener('touchmove', onMove, { passive: true });
  window.addEventListener('touchend', onEnd);
}

// ========================================================
// BRANCH SINGLE-PAGE NAVIGATION & e-POD CHECKLIST ENGINE
// ========================================================
let activeBranchReceivingOrder = null;
let branchReceivingChecklist = [];
let branchDeliveryChartInstance = null;
let branchTopItemsChartInstance = null;
let brSigCanvas = null;
let brSigCtx = null;
let isBrSigDrawing = false;

function toggleBranchMenu() {
  const menu = document.getElementById('branch-dropdown-menu');
  if (menu) menu.style.display = menu.style.display === 'block' ? 'none' : 'block';
}

window.addEventListener('click', function(e) {
  const bMenu = document.getElementById('branch-dropdown-menu');
  const bBtn = document.getElementById('btn-branch-dots');
  if (bMenu && bBtn && !bBtn.contains(e.target) && !bMenu.contains(e.target)) {
    bMenu.style.display = 'none';
  }

  const aMenu = document.getElementById('admin-dropdown-menu');
  const aBtn = document.getElementById('btn-admin-dots');
  if (aMenu && aBtn && !aBtn.contains(e.target) && !aMenu.contains(e.target)) {
    aMenu.style.display = 'none';
  }
});

function switchBranchView(viewName) {
  const _fv = ACCESS_FEATURES.find(f => f.native === 'branch' && f.view === viewName);
  if (_fv && !featureAllowed(_fv.key)) { featureDeniedMsg(_fv); return; }
  clearPrintSlip();
  document.querySelectorAll('.branch-view-section').forEach(sec => sec.style.display = 'none');
  const menu = document.getElementById('branch-dropdown-menu');
  if (menu) menu.style.display = 'none';

  if (viewName === 'dashboard') {
    const el = document.getElementById('view-branch-dashboard');
    if (el) el.style.display = 'block';
    loadBranchAnalytics();
  } else if (viewName === 'order') {
    const el = document.getElementById('view-branch-order');
    if (el) el.style.display = 'block';
    loadBranchProducts();
  } else if (viewName === 'deliveries') {
    const el = document.getElementById('view-branch-deliveries');
    if (el) el.style.display = 'block';
    loadBranchDeliveries();
  } else if (viewName === 'ordboard') {
    const el = document.getElementById('view-branch-ordboard'); if (el) el.style.display = 'block'; loadOrderBoard();
  } else if (viewName === 'hrdocs') {
    const el = document.getElementById('view-branch-hrdocs'); if (el) el.style.display = 'block'; loadHrDocs();
  } else if (viewName === 'attendance') {
    const el = document.getElementById('view-branch-attendance');
    if (el) el.style.display = 'block';
    loadAttendance();
  } else if (viewName === 'requests') {
    const el = document.getElementById('view-branch-requests');
    if (el) el.style.display = 'block';
    loadRequests();
  } else if (viewName === 'inventory') {
    const el = document.getElementById('view-branch-inventory');
    if (el) el.style.display = 'block';
    loadBranchInventory();
  } else if (viewName === 'returns') {
    const el = document.getElementById('view-branch-returns');
    if (el) el.style.display = 'block';
  }
}

async function loadBranchAnalytics() {
  if (typeof db === 'undefined' || !db) return;
  const u = getCurrentUser();
  const branchName = (u && u.branch) ? u.branch.toLowerCase().trim() : '';

  try {
    const snap = await db.collection('orders').get();
    let totalOrders = 0;
    let successfulDeliveries = 0;
    let disputedDeliveries = 0;
    let totalSpend = 0;
    const itemDemand = {};

    snap.forEach(doc => {
      const ord = doc.data();
      const ordBranch = (ord.branchName || '').toLowerCase().trim();

      if (u.role === 'admin' || ordBranch.includes(branchName) || branchName.includes(ordBranch)) {
        totalOrders++;
        const amt = parseFloat(ord.totalAmount || 0);
        totalSpend += amt;

        const st = (ord.status || '').toLowerCase();
        if (st.includes('completed') || st.includes('received & completed')) {
          successfulDeliveries++;
        } else if (st.includes('dispute') || st.includes('damage')) {
          disputedDeliveries++;
        }

        (ord.items || []).forEach(item => {
          const name = item.itemName || 'Item';
          const qty = (parseFloat(item.wholeQty || 0) + parseFloat(item.looseQty || 0));
          itemDemand[name] = (itemDemand[name] || 0) + qty;
        });
      }
    });

    const elTotal = document.getElementById('br-kpi-total-orders');
    const elSucc = document.getElementById('br-kpi-success-orders');
    const elDisp = document.getElementById('br-kpi-dispute-orders');
    const elSpend = document.getElementById('br-kpi-total-spend');

    if (elTotal) elTotal.innerText = totalOrders;
    if (elSucc) elSucc.innerText = successfulDeliveries;
    if (elDisp) elDisp.innerText = disputedDeliveries;
    if (elSpend) elSpend.innerText = '₱' + totalSpend.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    if (typeof Chart !== 'undefined') {
      const ctxRatio = document.getElementById('chart-branch-delivery-ratio');
      if (ctxRatio) {
        if (branchDeliveryChartInstance) branchDeliveryChartInstance.destroy();
        branchDeliveryChartInstance = new Chart(ctxRatio, {
          type: 'doughnut',
          data: {
            labels: ['Successful Deliveries', 'With Disputes/Damage', 'In Transit / Pending'],
            datasets: [{
              data: [successfulDeliveries, disputedDeliveries, Math.max(0, totalOrders - successfulDeliveries - disputedDeliveries)],
              backgroundColor: ['#10b981', '#ef4444', '#f59e0b']
            }]
          },
          options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } }
        });
      }

      const ctxItems = document.getElementById('chart-branch-top-items');
      if (ctxItems) {
        if (branchTopItemsChartInstance) branchTopItemsChartInstance.destroy();
        const sortedItems = Object.entries(itemDemand).sort((a,b) => b[1] - a[1]).slice(0, 5);
        branchTopItemsChartInstance = new Chart(ctxItems, {
          type: 'bar',
          data: {
            labels: sortedItems.map(i => i[0]),
            datasets: [{ label: 'Units Ordered', data: sortedItems.map(i => i[1]), backgroundColor: '#2563eb', borderRadius: 4 }]
          },
          options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
        });
      }
    }
  } catch (err) {
    console.error('Error loading branch analytics:', err);
  }
}

async function loadBranchDeliveries() {
  const tbody = document.getElementById('branch-deliveries-tbody');
  if (!tbody || typeof db === 'undefined' || !db) return;

  const u = getCurrentUser();
  const branchName = (u && u.branch) ? u.branch.toLowerCase().trim() : '';

  try {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: #64748b; padding: 1rem;">Kinukuha ang deliveries mula sa Firestore...</td></tr>';
    const snap = await db.collection('orders').orderBy('createdAt', 'desc').limit(25).get();

    if (snap.empty) {
      tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: #94a3b8; padding: 1.5rem;">Walang aktibong delivery record.</td></tr>';
      return;
    }

    await ordLoadMySubs();
    let rowsHtml = '';
    snap.forEach(doc => {
      const ord = { id: doc.id, ...doc.data() };
      const ordBranch = (ord.branchName || '').toLowerCase().trim();

      if (u.role === 'admin' || ordBranch.includes(branchName) || branchName.includes(ordBranch)) {
        const status = ord.status || 'Pending Preparation';
        const isDispatched = status.includes('Dispatched');
        const isPending = status === 'Pending Preparation';
        const isPreparing = status.includes('Preparing');
        const hasCancelReq = ord.cancellationRequested === true;
        const hasPahabol = !!ord.pahabol;

        let statusBadge = `<span class="badge ${isDispatched ? 'badge-warning' : (status.includes('Completed') ? 'badge-branch' : 'badge-warning')}">${status}</span>`;
        if (hasCancelReq && !status.includes('Cancelled')) {
          statusBadge = `<span class="badge badge-danger">⏳ Cancel Req Pending</span>`;
        } else if (hasPahabol && isPending) {
          statusBadge = `<span class="badge badge-warning">⚠️ With Pahabol</span>`;
        }

        let actionButtonsHtml = '';

        if (isDispatched) {
          actionButtonsHtml = `
            <div style="display: flex; gap: 0.35rem; justify-content: center; flex-wrap: wrap;">
              <button class="btn btn-sm btn-primary" onclick="viewOrderInvestigationDetails('${doc.id}')">🔍 Buksan</button>
              <button class="btn btn-sm btn-success" style="font-weight: 700;" onclick="openBranchReceivingModal('${doc.id}')">📦 I-receive</button>
            </div>
          `;
        } else if (status.includes('Completed') || status.includes('Cancelled')) {
          actionButtonsHtml = `
            <div style="display: flex; gap: 0.35rem; justify-content: center; flex-wrap: wrap;">
              <button class="btn btn-sm btn-secondary" onclick="viewOrderInvestigationDetails('${doc.id}')">🔍 Buksan</button>
            </div>
          `;
        } else {
          actionButtonsHtml = `
            <div style="display: flex; gap: 0.35rem; justify-content: center; flex-wrap: wrap;">
              <button class="btn btn-sm btn-secondary" onclick="viewOrderInvestigationDetails('${doc.id}')" title="Tingnan ang detalye ng order">🔍 Buksan</button>
              <button class="btn btn-sm btn-danger" style="font-weight: 700;" onclick="openBranchCancelModal('${doc.id}')" title="Kanselahin ang order habang hindi pa na-dispatch">❌ I-cancel</button>
              <button class="btn btn-sm btn-primary" style="font-weight: 700;" onclick="openBranchPahabolModal('${doc.id}')" title="Magdagdag ng karagdagang order (Pahabol)">➕ Pahabol</button>
            </div>
          `;
        }

        window.__ordCache = window.__ordCache || {}; window.__ordCache[doc.id] = ord;
        actionButtonsHtml = actionButtonsHtml.replace(/<\/div>\s*$/, ordExtraButtons(ord) + '</div>');
        rowsHtml += `
          <tr>
            <td><b>${ord.orderId || doc.id}</b>${ord.customerName ? `<br><small>👤 ${srchEsc(ord.customerName)}</small>` : ''}<br><small style="color: #64748b;">Target: ${ord.targetDeliveryDate || 'ASAP'}</small></td>
            <td>${(ord.items || []).length} item(s)</td>
            <td><b>₱${parseFloat(ord.totalAmount || 0).toFixed(2)}</b></td>
            <td>${statusBadge}<br>${ordPayBadge(ord)}</td>
            <td style="text-align: center;">${actionButtonsHtml}</td>
          </tr>
        `;
      }
    });

    tbody.innerHTML = rowsHtml || '<tr><td colspan="5" style="text-align: center; color: #94a3b8; padding: 1.5rem;">Walang aktibong delivery para sa iyong branch.</td></tr>';
  } catch (err) {
    console.error('Error loading branch deliveries:', err);
  }
}

function openBranchReceivingModal(orderId) {
  if (!db) return;
  db.collection('orders').doc(orderId).get().then(doc => {
    activeBranchReceivingOrder = { id: doc.id, ...doc.data() };
    document.getElementById('br-recv-order-id').innerText = activeBranchReceivingOrder.orderId || doc.id;

    branchReceivingChecklist = (activeBranchReceivingOrder.items || []).map(item => ({
      ...item,
      condition: 'good',
      damageQty: 0,
      damageReason: ''
    }));

    document.getElementById('br-stage-arrival').style.display = 'block';
    document.getElementById('br-stage-checklist').style.display = 'none';
    document.getElementById('br-stage-sign').style.display = 'none';
    document.getElementById('branch-receiving-modal').style.display = 'flex';

    // Swipe slider removed, relying on branchTruckArrived() button click
  });
}

function closeBranchReceivingModal() {
  document.getElementById('branch-receiving-modal').style.display = 'none';
}

function renderBranchReceivingChecklist() {
  const container = document.getElementById('branch-receiving-items-container');
  if (!container) return;

  let hasDispute = false;
  let html = '';

  branchReceivingChecklist.forEach((item, idx) => {
    const isGood = item.condition === 'good';
    if (!isGood) hasDispute = true;

    html += `
      <div class="receiving-item-card ${isGood ? 'item-accepted' : 'item-discrepancy'}" style="margin-bottom: 0.75rem; padding: 0.85rem 1rem; border-radius: 0.5rem; border: 1.5px solid ${isGood ? '#86efac' : '#fca5a5'}; background: ${isGood ? '#f0fdf4' : '#fef2f2'};">
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.5rem;">
          <div>
            <b style="font-size: 1rem; color: #1e293b;">${item.itemName}</b>
            <div style="font-size: 0.8rem; color: #64748b;">Inaasahan: <b>${item.wholeQty || 0} ${item.wholeUOM || 'Whole'} + ${item.looseQty || 0} ${item.looseUOM || 'Loose'}</b></div>
          </div>
          <div style="display: flex; gap: 0.35rem;">
            <button type="button" class="btn btn-sm ${isGood ? 'btn-success' : 'btn-secondary'}" onclick="setReceivingCondition(${idx}, 'good')">✓ Tanggap (OK)</button>
            <button type="button" class="btn btn-sm ${!isGood ? 'btn-danger' : 'btn-secondary'}" onclick="setReceivingCondition(${idx}, 'damage')">⚠️ Butas / Damage / Return</button>
          </div>
        </div>
        ${!isGood ? `
          <div style="margin-top: 0.5rem; padding-top: 0.5rem; border-top: 1px dashed #fca5a5; display: flex; gap: 0.5rem; flex-wrap: wrap;">
            <input type="number" placeholder="Ilang bawas/sira?" style="width: 130px; font-size: 0.85rem; padding: 0.3rem 0.5rem;" oninput="branchReceivingChecklist[${idx}].damageQty = this.value">
            <input type="text" placeholder="Dahilan (Hal: May butas ang lata, nalanta, etc.)" style="flex: 1; font-size: 0.85rem; padding: 0.3rem 0.5rem;" oninput="branchReceivingChecklist[${idx}].damageReason = this.value">
          </div>
        ` : ''}
      </div>
    `;
  });

  container.innerHTML = html;
  document.getElementById('branch-dispute-alert-box').style.display = hasDispute ? 'block' : 'none';
}

function setReceivingCondition(idx, condition) {
  branchReceivingChecklist[idx].condition = condition;
  renderBranchReceivingChecklist();
}

function initBranchRecvCanvas() {
  brSigCanvas = document.getElementById('br-recv-sig-canvas');
  if (!brSigCanvas) return;
  brSigCtx = brSigCanvas.getContext('2d');
  brSigCanvas.width = brSigCanvas.parentElement.clientWidth;
  brSigCanvas.height = brSigCanvas.parentElement.clientHeight;
  brSigCtx.lineWidth = 2;
  brSigCtx.lineCap = 'round';
  brSigCtx.strokeStyle = '#0f172a';

  function getCoords(e) {
    const rect = brSigCanvas.getBoundingClientRect();
    return {
      x: (e.touches ? e.touches[0].clientX : e.clientX) - rect.left,
      y: (e.touches ? e.touches[0].clientY : e.clientY) - rect.top
    };
  }

  function start(e) { isBrSigDrawing = true; const p = getCoords(e); brSigCtx.beginPath(); brSigCtx.moveTo(p.x, p.y); }
  function move(e) { if (!isBrSigDrawing) return; const p = getCoords(e); brSigCtx.lineTo(p.x, p.y); brSigCtx.stroke(); }
  function end() { isBrSigDrawing = false; }

  brSigCanvas.addEventListener('mousedown', start);
  brSigCanvas.addEventListener('mousemove', move);
  brSigCanvas.addEventListener('mouseup', end);
  brSigCanvas.addEventListener('touchstart', (e) => { e.preventDefault(); start(e); }, { passive: false });
  brSigCanvas.addEventListener('touchmove', (e) => { e.preventDefault(); move(e); }, { passive: false });
  brSigCanvas.addEventListener('touchend', end);
}

function clearBranchRecvSig() {
  if (brSigCtx && brSigCanvas) {
    brSigCtx.clearRect(0, 0, brSigCanvas.width, brSigCanvas.height);
  }
}

async function submitFinalReceivingProof() {
  const driverName = (document.getElementById('br-recv-driver-name')?.value || '').toUpperCase().trim();
  const receiverName = (document.getElementById('br-recv-receiver-name')?.value || '').toUpperCase().trim();
  const disputeNotes = document.getElementById('branch-incident-notes')?.value.trim() || '';

  if (!driverName || !receiverName) {
    alert('Mangyaring ilagay ang pangalan ni Driver at ng Branch Receiver bago i-save.');
    return;
  }

  const disputes = branchReceivingChecklist.filter(i => i.condition !== 'good');
  const finalStatus = disputes.length > 0 ? 'Received with Disputes / Damage' : 'Received & Completed';

  try {
    await db.collection('orders').doc(activeBranchReceivingOrder.id).update({
      status: finalStatus,
      driverName: driverName,
      receiverName: receiverName,
      receivingChecklist: branchReceivingChecklist,
      disputeNotes: disputeNotes,
      receivedAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    if (disputes.length > 0) {
      await db.collection('disputes').add({
        orderId: activeBranchReceivingOrder.orderId || activeBranchReceivingOrder.id,
        branchName: activeBranchReceivingOrder.branchName,
        driverName: driverName,
        receiverName: receiverName,
        itemsAffected: disputes,
        notes: disputeNotes,
        photoProof: window.tempDamagePhoto || null,
        status: 'Pending Resolution / Credit Memo',
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      window.tempDamagePhoto = null;
      logSystemAction('ORDER_RECEIVED_WITH_DISPUTE', `Na-receive ang PO: ${activeBranchReceivingOrder.orderId || activeBranchReceivingOrder.id} na may damage/dispute.`);
      alert('⚠️ Naitala ang Delivery na may Damage Dispute! Awtomatikong na-notify ang Head Office Admin at Commissary.');
    } else {
      logSystemAction('ORDER_RECEIVED_COMPLETE', `Na-receive nang buo at kumpleto ang PO: ${activeBranchReceivingOrder.orderId || activeBranchReceivingOrder.id}`);
      alert('✅ Matagumpay na natanggap at kumpleto ang lahat ng items!');
    }

    closeBranchReceivingModal();
    loadBranchDeliveries();
  } catch (err) {
    alert('Error sa pag-save: ' + err.message);
  }
}

function openBranchProfileModal() {
  const u = getCurrentUser();
  if (!u) return;

  const emailEl = document.getElementById('br-prof-email');
  const nameEl = document.getElementById('br-prof-name');
  const branchEl = document.getElementById('br-prof-branch');
  const addressEl = document.getElementById('br-prof-address');
  const passEl = document.getElementById('br-prof-new-pass');

  if (emailEl) emailEl.value = u.email || '';
  if (nameEl) nameEl.value = u.name || '';
  if (branchEl) branchEl.value = u.branch || 'Branch Operations';
  if (addressEl) addressEl.value = u.address || '';
  if (passEl) passEl.value = '';

  // Load Profile Photo into Preview
  const previewEl = document.getElementById('br-prof-pic-preview');
  const fallbackEl = document.getElementById('br-prof-pic-fallback');
  if (u.photoUrl && previewEl) {
    previewEl.src = u.photoUrl;
    previewEl.style.display = 'inline-block';
    if (fallbackEl) fallbackEl.style.display = 'none';
  } else {
    if (previewEl) previewEl.style.display = 'none';
    if (fallbackEl) fallbackEl.style.display = 'flex';
  }

  // Reset temp photo
  window.tempSelectedProfilePhoto = null;

  const modal = document.getElementById('branch-profile-modal');
  if (modal) modal.style.display = 'flex';
  const menu = document.getElementById('branch-dropdown-menu');
  if (menu) menu.style.display = 'none';
}

function closeBranchProfileModal() {
  document.getElementById('branch-profile-modal').style.display = 'none';
}

async function saveBranchProfile() {
  const u = getCurrentUser();
  if (!u || !db) return;

  const newName = (document.getElementById('br-prof-name')?.value || '').toUpperCase().trim();
  const newAddress = (document.getElementById('br-prof-address')?.value || '').trim();
  const newPass = document.getElementById('br-prof-new-pass')?.value || '';

  if (!newName) {
    alert('Mangyaring ilagay ang iyong pangalan.');
    return;
  }

  try {
    const updatePayload = {
      name: newName,
      address: newAddress,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    if (window.tempSelectedProfilePhoto) {
      updatePayload.photoUrl = window.tempSelectedProfilePhoto;
    }

    await db.collection('users').doc(u.email.toLowerCase()).update(updatePayload);

    if (newPass && newPass.length >= 6 && auth.currentUser) {
      await auth.currentUser.updatePassword(newPass);
    }

    u.name = newName;
    u.address = newAddress;
    if (window.tempSelectedProfilePhoto) {
      u.photoUrl = window.tempSelectedProfilePhoto;
    }
    setCurrentUser(u);

    // Update avatar UI
    if (u.photoUrl) {
      document.querySelectorAll('.user-avatar-img').forEach(img => {
        img.src = u.photoUrl;
        img.style.display = 'inline-block';
      });
      document.querySelectorAll('.user-avatar-initials').forEach(el => {
        el.style.display = 'none';
      });
    }

    const userDisp = document.getElementById('user-display');
    if (userDisp) userDisp.innerText = `Branch: ${newName}`;

    logSystemAction('PROFILE_UPDATED', `In-update ang Branch profile/photo: ${newName}`);
    alert('✅ Matagumpay na na-update ang Profile at Address ng Branch Manager!');
    closeBranchProfileModal();
  } catch (err) {
    alert('Error sa pag-update: ' + err.message);
  }
}

// ========================================================
// ADMIN THREE-DOT QUICK NAVIGATION & PROFILE ENGINE
// ========================================================
function toggleAdminMenu() {
  const menu = document.getElementById('admin-dropdown-menu');
  if (menu) menu.style.display = menu.style.display === 'block' ? 'none' : 'block';
}

function switchAdminView(viewName) {
  if (window.KUSINA_PERMS && !['sessions', 'syshealth'].includes(viewName) && !canViewModule(viewName)) {
    alert('⚠️ Walang access ang account mo sa module na ito. Makipag-ugnayan kay Admin.');
    return;
  }
  setTimeout(() => applyReadonlyMode(viewName), 0);
  document.querySelectorAll('.admin-view-section').forEach(sec => sec.style.display = 'none');
  const menu = document.getElementById('admin-dropdown-menu');
  if (menu) menu.style.display = 'none';

  if (viewName === 'dashboard') {
    const el = document.getElementById('view-admin-dashboard');
    if (el) el.style.display = 'block';
    loadAdminAnalytics();
  } else if (viewName === 'branding') {
    const el = document.getElementById('view-admin-branding');
    if (el) el.style.display = 'block';
    loadSystemBranding();
  } else if (viewName === 'users') {
    const el = document.getElementById('view-admin-users');
    if (el) el.style.display = 'block';
    loadFirestoreUsers();
    renderAccessControlManager();
  } else if (viewName === 'employees') {
    const el = document.getElementById('view-admin-employees');
    if (el) el.style.display = 'block';
    if(typeof loadAdminEmployees === 'function') loadAdminEmployees();
  } else if (viewName === 'payroll') {
    const el = document.getElementById('view-admin-payroll');
    if (el) el.style.display = 'block';
    if(typeof loadAdminPayroll === 'function') loadAdminPayroll();
  } else if (viewName === 'finance') {
    const el = document.getElementById('view-admin-finance');
    if (el) el.style.display = 'block';
    if(typeof loadAdminFinance === 'function') loadAdminFinance();
  } else if (viewName === 'vendors') {
    const el = document.getElementById('view-admin-vendors');
    if (el) el.style.display = 'block';
    if(typeof loadAdminVendors === 'function') loadAdminVendors();
  } else if (viewName === 'customers') {
    const el = document.getElementById('view-admin-customers');
    if (el) el.style.display = 'block';
    if(typeof loadAdminCustomers === 'function') loadAdminCustomers();
  } else if (viewName === 'manufacturing') {
    const el = document.getElementById('view-admin-manufacturing');
    if (el) el.style.display = 'block';
    loadManufacturing();
  } else if (viewName === 'costing') {
    const el = document.getElementById('view-admin-costing');
    if (el) el.style.display = 'block';
    if (typeof loadCosting === 'function') loadCosting();
  } else if (viewName === 'lot_tracing') {
    const el = document.getElementById('view-admin-lot_tracing');
    if (el) el.style.display = 'block';
    if (typeof loadLotTracing === 'function') loadLotTracing();
  } else if (viewName === 'assets') {
    const el = document.getElementById('view-admin-assets');
    if (el) el.style.display = 'block';
    if (typeof loadAssets === 'function') loadAssets();
  } else if (viewName === 'auto_pr') {
    const el = document.getElementById('view-admin-auto_pr');
    if (el) el.style.display = 'block';
    if (typeof loadAutoPR === 'function') loadAutoPR();
  } else if (viewName === 'products') {
    const el = document.getElementById('view-admin-products');
    if (el) el.style.display = 'block';
    loadAdminProducts();
  } else if (viewName === 'stations') {
    const el = document.getElementById('view-admin-stations');
    if (el) el.style.display = 'block';
    loadStorageStations();
    loadUOMs();
    loadHubsManager();
  } else if (viewName === 'attendance') {
    const el = document.getElementById('view-admin-attendance');
    if (el) el.style.display = 'block';
    loadAttendance();
  } else if (viewName === 'requests') {
    const el = document.getElementById('view-admin-requests');
    if (el) el.style.display = 'block';
    loadRequests();
  } else if (viewName === 'hrdocs') {
    const el = document.getElementById('view-admin-hrdocs'); if (el) el.style.display = 'block'; loadHrDocs();
  } else if (viewName === 'sessions') {
    const el = document.getElementById('view-admin-sessions'); if (el) el.style.display = 'block'; loadSessions();
  } else if (viewName === 'syshealth') {
    const el = document.getElementById('view-admin-syshealth'); if (el) el.style.display = 'block'; loadSysHealth();
  } else if (viewName === 'memos') {
    const el = document.getElementById('view-admin-memos');
    if (el) el.style.display = 'block';
    loadMemos();
  } else if (viewName === 'sap_items') {
    const el = document.getElementById('view-admin-sap_items');
    if (el) el.style.display = 'block';
    loadSapItems();
  } else if (viewName === 'inv_totals') {
    const el = document.getElementById('view-admin-inv_totals');
    if (el) el.style.display = 'block';
    loadInvTotals();
  } else if (viewName === 'daily_prices') {
    const el = document.getElementById('view-admin-daily_prices');
    if (el) el.style.display = 'block';
    loadDailyPrices();
  } else if (viewName === 'ar_ledger') {
    const el = document.getElementById('view-admin-ar_ledger');
    if (el) el.style.display = 'block';
    loadArLedger();
  } else if (viewName === 'price_lists') {
    const el = document.getElementById('view-admin-price_lists');
    if (el) el.style.display = 'block';
    loadPriceLists();
  } else if (viewName === 'company_mgmt') {
    const el = document.getElementById('view-admin-company_mgmt');
    if (el) el.style.display = 'block';
    loadCompanyManagement();
  } else if (viewName === 'branch_inv') {
    const el = document.getElementById('view-admin-branch_inv');
    if (el) el.style.display = 'block';
    loadBranchInventoryAdmin();
  } else if (viewName === 'backups') {
    const el = document.getElementById('view-admin-backups');
    if (el) el.style.display = 'block';
    loadProductBackupLogs();
  } else if (viewName === 'disputes') {
    const el = document.getElementById('view-admin-disputes');
    if (el) el.style.display = 'block';
    loadAdminDisputes();
  } else if (viewName === 'spoilage') {
    const el = document.getElementById('view-admin-spoilage');
    if (el) el.style.display = 'block';
    if(typeof loadAdminSpoilageRequests === 'function') loadAdminSpoilageRequests();
  } else if (viewName === 'logs') {
    const el = document.getElementById('view-admin-logs');
    if (el) el.style.display = 'block';
    if(typeof loadSystemAuditLogs === 'function') loadSystemAuditLogs();
  } else if (viewName === 'purchase_orders') {
    const el = document.getElementById('view-admin-purchase-orders');
    if (el) el.style.display = 'block';
    if(typeof loadAdminVendorPOs === 'function') loadAdminVendorPOs();
  } else if (viewName === 'ap_invoices') {
    const el = document.getElementById('view-admin-ap-invoices');
    if (el) el.style.display = 'block';
    loadAdminAPInvoices();
  } else if (viewName === 'reports') {
    const el = document.getElementById('view-admin-reports');
    if (el) el.style.display = 'block';
  } else if (viewName === 'truncate') {
    const el = document.getElementById('view-admin-truncate');
    if (el) el.style.display = 'block';
  } else if (viewName === 'team') {
    const el = document.getElementById('view-admin-team');
    if (el) el.style.display = 'block';
    if(typeof loadCommissaryTeam === 'function') loadCommissaryTeam();
  }
}

async function loadAdminDisputes() {
  const tbody = document.getElementById('admin-disputes-tbody');
  if (!tbody || typeof db === 'undefined' || !db) return;

  try {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: #64748b; padding: 1rem;">Kinukuha ang incident reports mula sa Firestore...</td></tr>';
    const snap = await db.collection('disputes').orderBy('createdAt', 'desc').limit(25).get();

    if (snap.empty) {
      tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: #94a3b8; padding: 1.5rem;">Walang aktibong reklamo o damage dispute mula sa mga branch.</td></tr>';
      return;
    }

    let rowsHtml = '';
    snap.forEach(doc => {
      const d = doc.data();
      const itemsList = (d.itemsAffected || []).map(i => `<b>${i.itemName}</b> (${i.damageQty || 0} unit(s) - ${i.damageReason || 'Damage'})`).join('<br>');
      rowsHtml += `
        <tr>
          <td><b>${d.orderId || doc.id}</b></td>
          <td><b>${d.branchName || 'Branch'}</b></td>
          <td>${itemsList}<br><small style="color: #b91c1c;">${d.notes || ''}</small></td>
          <td>${d.driverName || 'Driver'}</td>
          <td>
            <div style="display: flex; gap: 0.35rem; align-items: center; flex-wrap: wrap;">
              <span class="badge badge-warning">${d.status || 'Pending Decision'}</span>
              <button class="btn btn-sm btn-primary" onclick="openDisputePOModal('${d.orderId || doc.id}')">🔍 Open PO</button>
            </div>
          </td>
        </tr>
      `;
    });
    tbody.innerHTML = rowsHtml;
  } catch (err) {
    console.error('Error loading admin disputes:', err);
  }
}

function openAdminProfileModal() {
  const u = getCurrentUser();
  if (!u) return;

  const emailEl = document.getElementById('admin-prof-email');
  const nameEl = document.getElementById('admin-prof-name');
  const passEl = document.getElementById('admin-prof-new-pass');

  if (emailEl) emailEl.value = u.email || '';
  if (nameEl) nameEl.value = u.name || '';
  if (passEl) passEl.value = '';

  // Load Profile Photo into Preview
  const previewEl = document.getElementById('admin-prof-pic-preview');
  const fallbackEl = document.getElementById('admin-prof-pic-fallback');
  if (u.photoUrl && previewEl) {
    previewEl.src = u.photoUrl;
    previewEl.style.display = 'inline-block';
    if (fallbackEl) fallbackEl.style.display = 'none';
  } else {
    if (previewEl) previewEl.style.display = 'none';
    if (fallbackEl) fallbackEl.style.display = 'flex';
  }
  
  // Reset temp photo
  window.tempSelectedProfilePhoto = null;

  const modal = document.getElementById('admin-profile-modal');
  if (modal) modal.style.display = 'flex';
  const menu = document.getElementById('admin-dropdown-menu');
  if (menu) menu.style.display = 'none';
}

function closeAdminProfileModal() {
  document.getElementById('admin-profile-modal').style.display = 'none';
}

async function saveAdminProfile() {
  const u = getCurrentUser();
  if (!u || !db) return;

  const newName = (document.getElementById('admin-prof-name')?.value || '').toUpperCase().trim();
  const newPass = document.getElementById('admin-prof-new-pass')?.value || '';

  if (!newName) {
    alert('Mangyaring ilagay ang iyong pangalan.');
    return;
  }

  try {
    const updatePayload = {
      name: newName,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    if (window.tempSelectedProfilePhoto) {
      updatePayload.photoUrl = window.tempSelectedProfilePhoto;
    }

    await db.collection('users').doc(u.email.toLowerCase()).update(updatePayload);

    if (newPass && newPass.length >= 6 && auth.currentUser) {
      await auth.currentUser.updatePassword(newPass);
    }

    u.name = newName;
    if (window.tempSelectedProfilePhoto) {
      u.photoUrl = window.tempSelectedProfilePhoto;
    }
    setCurrentUser(u);

    if (u.photoUrl) {
      document.querySelectorAll('.user-avatar-img').forEach(img => {
        img.src = u.photoUrl;
        img.style.display = 'inline-block';
      });
      document.querySelectorAll('.user-avatar-initials').forEach(el => {
        el.style.display = 'none';
      });
    }

    const userDisp = document.getElementById('user-display');
    if (userDisp) userDisp.innerText = `Admin: ${newName}`;
    logSystemAction('PROFILE_UPDATED', `In-update ni Admin ang profile/photo: ${newName}`);
    alert('✅ Matagumpay na na-update ang Profile ni Admin!');
    closeAdminProfileModal();
  } catch (err) {
    alert('Error sa pag-update: ' + err.message);
  }
}


// ========================================================
// BRANCH ORDER TEMPLATE & COPY PREVIOUS ORDER ENGINE
// Author: Programmed by Renz Aldrin Gomez, 2026
// ========================================================
let branchPastOrdersList = [];

async function populatePreviousOrdersDropdown() {
  const select = document.getElementById('previous-order-template-select');
  if (!select || typeof db === 'undefined' || !db) return;

  const u = getCurrentUser();
  const branchName = (u && u.branch) ? u.branch.toLowerCase().trim() : '';

  try {
    const snap = await db.collection('orders').orderBy('createdAt', 'desc').limit(20).get();
    branchPastOrdersList = [];
    select.innerHTML = '<option value="">-- Pumili ng Dating Order na Kokopyahin --</option>';

    snap.forEach(doc => {
      const ord = { id: doc.id, ...doc.data() };
      const ordBranch = (ord.branchName || '').toLowerCase().trim();
      if (u.role === 'admin' || ordBranch.includes(branchName) || branchName.includes(ordBranch)) {
        branchPastOrdersList.push(ord);
        const dateStr = ord.targetDeliveryDate || (ord.createdAt ? new Date(ord.createdAt.toDate ? ord.createdAt.toDate() : ord.createdAt).toLocaleDateString() : 'Previous');
        const itemCount = (ord.items || []).length;
        const total = parseFloat(ord.totalAmount || 0).toLocaleString('en-PH', { style: 'currency', currency: 'PHP' });
        select.innerHTML += `<option value="${ord.id}">📦 ${ord.orderId || ord.id} (${dateStr}) - ${itemCount} item(s) [${total}]</option>`;
      }
    });
  } catch (err) {
    console.error('Error populating previous orders dropdown:', err);
  }
}

function onOrderModeChanged() {
  const mode = document.getElementById('order-creation-mode')?.value;
  const container = document.getElementById('previous-orders-dropdown-container');
  const helper = document.getElementById('template-helper-text');

  if (mode === 'template') {
    if (container) container.style.display = 'block';
    if (helper) helper.style.display = 'block';
    populatePreviousOrdersDropdown();
  } else {
    if (container) container.style.display = 'none';
    if (helper) helper.style.display = 'none';
    orderCart = [];
    renderCartBoxes();
  }
}

function onTemplateSelected() {
  const select = document.getElementById('previous-order-template-select');
  const orderId = select?.value;
  if (!orderId) return;

  copyPastOrderToCart(orderId, false);
}

function copyPastOrderToCart(orderId, openDirectly = true) {
  const order = branchPastOrdersList.find(o => o.id === orderId);
  if (!order) {
    // If not found in memory, query Firestore
    if (db) {
      db.collection('orders').doc(orderId).get().then(doc => {
        if (doc.exists) {
          applyOrderItemsToCart(doc.data(), openDirectly);
        } else {
          alert('Hindi nahanap ang order details.');
        }
      }).catch(err => alert('Error: ' + err.message));
    }
    return;
  }

  applyOrderItemsToCart(order, openDirectly);
}

function applyOrderItemsToCart(order, openDirectly = true) {
  if (!order || !order.items || order.items.length === 0) {
    alert('Walang mga produkto ang napiling order.');
    return;
  }

  // Deep clone items into cart
  orderCart = order.items.map(i => ({
    itemCode: i.itemCode || i.id,
    itemName: i.itemName || 'Item',
    storageStation: i.storageStation || 'Unassigned',
    packagingInstructions: i.packagingInstructions || '',
    wholeQty: parseFloat(i.wholeQty || 0),
    wholeUOM: i.wholeUOM || 'Whole',
    wholePrice: parseFloat(i.wholePrice || 0),
    looseQty: parseFloat(i.looseQty || 0),
    looseUOM: i.looseUOM || 'Loose',
    loosePrice: parseFloat(i.loosePrice || 0),
    subtotal: parseFloat(i.subtotal || 0)
  }));

  // Preserve packaging notes if available
  const notesEl = document.getElementById('order-packaging-notes');
  if (notesEl && order.packagingInstructions) {
    notesEl.value = order.packagingInstructions;
  }

  renderCartBoxes();

  if (openDirectly) {
    openOrderModal(false);
    // Switch mode to template
    const modeEl = document.getElementById('order-creation-mode');
    if (modeEl) modeEl.value = 'template';
    const container = document.getElementById('previous-orders-dropdown-container');
    if (container) container.style.display = 'block';
    const helper = document.getElementById('template-helper-text');
    if (helper) helper.style.display = 'block';

    alert(`📋 Nakopya na ang ${orderCart.length} produkto mula sa order ${order.orderId || order.id}!\n\nPumili na lamang ng bagong Target Delivery Date sa Step 1 at baguhin ang dami (quantity) kung kinakailangan bago i-submit.`);
  } else {
    alert(`📋 Na-load ang ${orderCart.length} item(s) sa cart. Pumili ng Delivery Date sa Step 1 upang magpatuloy.`);
  }
}


// ========================================================
// BARCODE SCANNER WITH EXPLICIT PERMISSION & BEEP AUDIO
// Author: Programmed by Renz Aldrin Gomez, 2026
// ========================================================
let html5QrScanner = null;
let activeScannerContext = 'commissary';

function playBarcodeBeep() {
  try {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, audioCtx.currentTime);
    gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.12);
  } catch (e) {
    console.log('AudioContext beep error:', e);
  }
}

async function checkAndRequestCameraPermission() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    if (location.protocol !== 'https:' && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') {
      alert('⚠️ KAILANGAN NG SECURE (HTTPS) CONNECTION:\n\nHindi bubukas ang camera sa mobile browser kung hindi naka-HTTPS.\nSiguraduhing naka-host sa GitHub Pages (https://holidays0910.github.io).');
    } else {
      alert('⚠️ Hindi sinusuportahan ng iyong browser ang pag-access sa camera.');
    }
    return false;
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: "environment" } }
    });
    stream.getTracks().forEach(track => track.stop());
    return true;
  } catch (err) {
    console.warn('Camera permission request error:', err);
    if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
      alert('⚠️ CAMERA ACCESS BLOCKED / DENIED!\n\nHindi pinahintulutan ang paggamit ng camera sa browser settings.\n\nPAANO ITO PAYAGAN SA CELLPHONE:\n1. Pindutin ang lock / setting icon (🔒) sa tabi ng URL sa itaas ng browser.\n2. Piliin ang "Permissions" o "Site Settings".\n3. I-set ang Camera sa "Allow" o "Payagan".\n4. I-refresh ang pahina.');
    } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
      alert('⚠️ Walang nakitang camera sa device na ito.');
    } else {
      alert('⚠️ Hindi mabuksan ang camera: ' + (err.message || err.name));
    }
    return false;
  }
}

async function openCameraBarcodeScanner(context = 'commissary') {
  activeScannerContext = context;
  const modal = document.getElementById('barcode-scanner-modal');
  if (!modal) {
    alert('Hindi nakita ang scanner modal sa page.');
    return;
  }

  const hasPerm = await checkAndRequestCameraPermission();
  if (!hasPerm) return;

  modal.style.display = 'flex';

  if (typeof Html5Qrcode === 'undefined') {
    alert('Kasalukuyang naglo-load pa ang barcode library. Pakisubukang muli sa ilang sandali.');
    return;
  }

  try {
    if (html5QrScanner) {
      try { await html5QrScanner.stop(); } catch(e){}
      html5QrScanner.clear();
      html5QrScanner = null;
    }

    html5QrScanner = new Html5Qrcode("barcode-reader-box");
    const config = {
      fps: 15,
      qrbox: { width: 280, height: 160 },
      aspectRatio: 1.777778
    };

    await html5QrScanner.start(
      { facingMode: "environment" },
      config,
      (decodedText) => {
        playBarcodeBeep();
        handleBarcodeScanned(decodedText.trim());
      },
      (error) => {}
    );
  } catch (err) {
    console.error('Html5Qrcode start error:', err);
    alert('Error sa pagsisimula ng barcode scanner: ' + err);
    closeCameraBarcodeScanner();
  }
}

function closeCameraBarcodeScanner() {
  if (html5QrScanner) {
    html5QrScanner.stop().then(() => {
      html5QrScanner.clear();
      html5QrScanner = null;
    }).catch(() => {
      html5QrScanner = null;
    });
  }
  const modal = document.getElementById('barcode-scanner-modal');
  if (modal) modal.style.display = 'none';
}

function handleBarcodeScanned(scannedCode) {
  closeCameraBarcodeScanner();
  const cleanCode = (scannedCode || '').toUpperCase().trim();

  // Branch Inventory: scan ng item
  if (activeScannerContext === 'inv_count') { invHandleScan(scannedCode); return; }

  // Recipe Builder: scan ng sangkap
  if (activeScannerContext === 'bom_rm') { bomHandleScan(scannedCode); return; }

  // 0. Kapag galing sa Admin PO List Search Bar (Auto-paste & Auto-search)
  if (activeScannerContext === 'admin_po_list') {
    const searchInput = document.getElementById('admin-po-search');
    if (searchInput) {
      searchInput.value = cleanCode;
      filterAdminVendorPOs();
    }
    return;
  }

  // 1. Kapag galing sa Admin Product Search Bar (Auto-paste & Auto-search)
  if (activeScannerContext === 'admin_receive_po') {
    if (!activeReceivePOData || !activeReceivePOData.items) return;
    const matchIdx = activeReceivePOData.items.findIndex(i => {
      return (i.itemCode || '').toUpperCase() === cleanCode || (i.barcode || '').toUpperCase() === cleanCode;
    });
    if (matchIdx !== -1) {
      // Highlight row and focus input
      const row = document.getElementById(`recv-row-${matchIdx}`);
      if (row) {
        row.style.backgroundColor = '#fefce8';
        setTimeout(() => row.style.backgroundColor = '', 2000);
        const inputs = row.querySelectorAll('input[type="number"]');
        for (let inp of inputs) {
           if (!inp.disabled) {
             inp.focus();
             inp.select();
             break;
           }
        }
      }
    } else {
      alert(`⚠️ HINDI TUGMA: Ang Barcode (${cleanCode}) ay wala sa orihinal na PO na ito.`);
      setTimeout(() => openCameraBarcodeScanner('admin_receive_po'), 500);
    }
    return;
  }
  
  if (activeScannerContext === 'admin') {
    const searchInput = document.getElementById('admin-product-search');
    if (searchInput) {
      searchInput.value = cleanCode;
      filterAdminProductsTable();
    }
    return;
  }

  // 2. Kapag galing sa Admin Product Add / Edit Modal (Auto-paste)
  if (activeScannerContext === 'admin_edit_modal') {
    const barInput = document.getElementById('admin-item-barcode');
    if (barInput) {
      barInput.value = cleanCode;
      barInput.focus();
      barInput.dispatchEvent(new Event('input', { bubbles: true }));
    }
    return;
  }

  // 3. Kapag galing sa Commissary Inventory Search Bar (Auto-paste & Auto-search)
  if (activeScannerContext === 'commissary') {
    const searchInput = document.getElementById('comm-product-search');
    if (searchInput) {
      searchInput.value = cleanCode;
      filterCommissaryInventoryTable();
    }
    return;
  }

  // 4. Kapag galing sa Commissary Product Tagging / Edit Modal (Auto-paste)
  if (activeScannerContext === 'comm_edit_modal') {
    const barInput = document.getElementById('new-item-barcode');
    if (barInput) {
      barInput.value = cleanCode;
      barInput.focus();
      barInput.dispatchEvent(new Event('input', { bubbles: true }));
    }
    return;
  }

  // 5. Kapag galing sa Branch Receiving Counter-Check
  if (activeScannerContext === 'branch_receiving' || activeScannerContext === 'branch') {
    if (!branchReceivingChecklist || branchReceivingChecklist.length === 0) {
      alert(`Na-scan: ${cleanCode}, ngunit walang bukas na receiving checklist.`);
      return;
    }

    let matchedIdx = branchReceivingChecklist.findIndex(item => {
      const pos = (item.posCode || '').toUpperCase().trim();
      const sap = (item.sapCode || item.itemCode || item.id || '').toUpperCase().trim();
      const bar = (item.barcode || item.barcodeNumber || '').toUpperCase().trim();
      return pos === cleanCode || sap === cleanCode || bar === cleanCode;
    });

    if (matchedIdx !== -1) {
      window.lastScannedItemIdx = matchedIdx;
      const item = branchReceivingChecklist[matchedIdx];
      const expectedWhole = item.wholeQty > 0 ? `${item.wholeQty} ${item.wholeUOM || 'W'}` : '';
      const expectedLoose = item.looseQty > 0 ? `${item.looseQty} ${item.looseUOM || 'L'}` : '';
      const expectedStr = [expectedWhole, expectedLoose].filter(Boolean).join(' + ') || '0';
      
      const detailsEl = document.getElementById('scan-confirm-details');
      if (detailsEl) {
         detailsEl.innerHTML = `
            <b style="font-size: 1.15rem; color: #1e293b; display: block; margin-bottom: 0.25rem;">${item.itemName}</b>
            <span style="font-size: 0.75rem; color: #64748b; background: #e2e8f0; padding: 2px 6px; border-radius: 4px;">Scanned Code: ${cleanCode}</span><br><br>
            <div style="font-size: 0.85rem; color: #475569;">Inaasahang Dami (Order Details):</div>
            <div style="font-size: 1.3rem; font-weight: 800; color: #059669;">${expectedStr}</div>
         `;
      }
      const modal = document.getElementById('branch-scan-confirm-modal');
      if (modal) modal.style.display = 'flex';
    } else {
      alert(`⚠️ HINDI TUGMA: Ang Barcode (${cleanCode}) ay wala sa listahan ng delivery na ito.\n\nPakisuri kung tamang item ang nai-baba ng truck.`);
      setTimeout(() => {
          openCameraBarcodeScanner('branch');
      }, 400);
    }
    return;
  }

  // 6. Kapag galing sa Branch Catalog Search
  if (activeScannerContext === 'comm_spoilage') {
    const searchIn = document.getElementById('comm-spoilage-search');
    if (searchIn) { searchIn.value = cleanCode; filterSpoilageProducts(); }
    const matchedProd = currentInventory.find(p => {
       const pos = (p.posCode || '').toUpperCase().trim();
       const sap = (p.sapCode || p.itemCode || p.id || '').toUpperCase().trim();
       const bar = (p.barcode || p.barcodeNumber || '').toUpperCase().trim();
       return pos === cleanCode || sap === cleanCode || bar === cleanCode;
    });
    if (matchedProd) onSpoilageProductSelect(matchedProd.id);
    return;
  }
  
  if (activeScannerContext === 'branch_pahabol') {
    const searchIn = document.getElementById('branch-pahabol-search');
    if (searchIn) {
      searchIn.value = cleanCode;
      filterPahabolProducts();
    }
    const matchedProd = branchProducts.find(p => {
      const pos = (p.posCode || '').toUpperCase().trim();
      const sap = (p.sapCode || p.itemCode || p.id || '').toUpperCase().trim();
      const bar = (p.barcode || p.barcodeNumber || '').toUpperCase().trim();
      return pos === cleanCode || sap === cleanCode || bar === cleanCode;
    });
    if (matchedProd) {
      onBranchPahabolProductSelect(matchedProd.id);
    }
    return;
  }
  
  if (activeScannerContext === 'branch_catalog') {
    const catalogSearch = document.getElementById('catalog-search-input');
    if (catalogSearch) {
      catalogSearch.value = cleanCode;
      filterCatalogProducts();
    }
    const matchedProd = branchProducts.find(p => {
      const pos = (p.posCode || '').toUpperCase().trim();
      const sap = (p.sapCode || p.itemCode || p.id || '').toUpperCase().trim();
      const bar = (p.barcode || p.barcodeNumber || '').toUpperCase().trim();
      return pos === cleanCode || sap === cleanCode || bar === cleanCode;
    });
    if (matchedProd) {
      selectProductForFillup(matchedProd.id);
    }
    return;
  }
}

function showProductBarcodeLabel(productId) {
  const prod = currentInventory.find(p => p.id === productId);
  if (!prod) return;

  const codeToEncode = prod.barcode || prod.sapCode || prod.itemCode || prod.posCode || prod.id;
  const nameEl = document.getElementById('sticker-item-name');
  const codesEl = document.getElementById('sticker-item-codes');
  const priceEl = document.getElementById('sticker-item-price');

  if (nameEl) nameEl.innerText = (prod.itemName || 'PRODUCT').toUpperCase();
  if (codesEl) codesEl.innerText = `SAP: ${prod.sapCode || prod.itemCode || '--'} | POS: ${prod.posCode || '--'} | BAR: ${prod.barcode || '--'}`;
  if (priceEl) priceEl.innerText = `₱${parseFloat(prod.wholePrice || 0).toFixed(2)} / ${prod.wholeUOM || 'BOX'}`;

  if (typeof JsBarcode !== 'undefined') {
    JsBarcode("#barcode-svg", codeToEncode, {
      format: "CODE128",
      lineColor: "#000",
      width: 2,
      height: 60,
      displayValue: true
    });
  }

  const modal = document.getElementById('barcode-label-modal');
  if (modal) modal.style.display = 'flex';
}

function closeBarcodeLabelModal() {
  const modal = document.getElementById('barcode-label-modal');
  if (modal) modal.style.display = 'none';
}

function printBarcodeSticker() {
  const printContent = document.getElementById('printable-sticker-area').innerHTML;
  const win = window.open('', '', 'width=450,height=450');
  win.document.write(`
    <html>
      <head>
        <title>Print Label</title>
        <style>
          body { font-family: sans-serif; text-align: center; margin: 10px; }
          svg { max-width: 100%; height: auto; }
        </style>
      </head>
      <body>${printContent}</body>
    </html>
  `);
  win.document.close();
  win.focus();
  win.print();
  win.close();
}

// ==========================================================================
// SYSTEM BRANDING ENGINE WITH AUTO-COMPRESS, INSTANT LOCAL CACHING & FIRESTORE SYNC
// ==========================================================================
async function loadSystemBranding() {
  const localName = localStorage.getItem('kusina_brand_name') || 'KusinaERP';
  const localSub = localStorage.getItem('kusina_brand_subtitle') || 'Secured Enterprise Portal (Firebase Auth & Firestore)';
  const localLogo = localStorage.getItem('kusina_brand_logo') || '';
  const localTin = localStorage.getItem('kusina_brand_tin') || '';
  const localAddr = localStorage.getItem('kusina_brand_address') || '';
  const localContact = localStorage.getItem('kusina_brand_contact') || '';
  const localChecker = localStorage.getItem('kusina_po_checker') || '';
  const localCheckerTitle = localStorage.getItem('kusina_po_checker_title') || '';
  const localApprover = localStorage.getItem('kusina_po_approver') || '';
  const localApproverTitle = localStorage.getItem('kusina_po_approver_title') || '';

  applyBrandingToUI(localName, localSub, localLogo, localTin, localAddr, localContact, localChecker, localCheckerTitle, localApprover, localApproverTitle);

  if (typeof db === 'undefined' || !db) return;

  try {
    const doc = await db.collection('system_settings').doc('branding').get();
    if (doc.exists) {
      const data = doc.data();
      const bName = data.brandName || localName;
      const bSub = data.brandSubtitle || localSub;
      const bLogo = data.brandLogo !== undefined ? data.brandLogo : localLogo;
      const bTin = data.brandTin || localTin;
      const bAddr = data.brandAddress || localAddr;
      const bContact = data.brandContact || localContact;
      const bChecker = data.poChecker || localChecker;
      const bCheckerTitle = data.poCheckerTitle || localCheckerTitle;
      const bApprover = data.poApprover || localApprover;
      const bApproverTitle = data.poApproverTitle || localApproverTitle;
      
      localStorage.setItem('kusina_brand_name', bName);
      localStorage.setItem('kusina_brand_subtitle', bSub);
      if (bLogo) localStorage.setItem('kusina_brand_logo', bLogo);
      localStorage.setItem('kusina_brand_tin', bTin);
      localStorage.setItem('kusina_brand_address', bAddr);
      localStorage.setItem('kusina_brand_contact', bContact);
      localStorage.setItem('kusina_po_checker', bChecker);
      localStorage.setItem('kusina_po_checker_title', bCheckerTitle);
      localStorage.setItem('kusina_po_approver', bApprover);
      localStorage.setItem('kusina_po_approver_title', bApproverTitle);
      
      applyBrandingToUI(bName, bSub, bLogo, bTin, bAddr, bContact, bChecker, bCheckerTitle, bApprover, bApproverTitle);
    }
  } catch (err) {
    console.warn('Branding sync warning:', err);
  }
}

function applyBrandingToUI(brandName, brandSubtitle, brandLogo = null, brandTin = '', brandAddress = '', brandContact = '', poChecker = '', poCheckerTitle = '', poApprover = '', poApproverTitle = '') {
  const currentLogo = brandLogo !== null ? brandLogo : (localStorage.getItem('kusina_brand_logo') || '');
  const currentName = brandName || localStorage.getItem('kusina_brand_name') || 'KusinaERP';
  const currentSub = brandSubtitle || localStorage.getItem('kusina_brand_subtitle') || 'Secured Enterprise Portal (Firebase Auth & Firestore)';
  const currentTin = brandTin || localStorage.getItem('kusina_brand_tin') || '';
  const currentAddr = brandAddress || localStorage.getItem('kusina_brand_address') || '';
  const currentContact = brandContact || localStorage.getItem('kusina_brand_contact') || '';
  const currentChecker = poChecker || localStorage.getItem('kusina_po_checker') || '';
  const currentCheckerTitle = poCheckerTitle || localStorage.getItem('kusina_po_checker_title') || '';
  const currentApprover = poApprover || localStorage.getItem('kusina_po_approver') || '';
  const currentApproverTitle = poApproverTitle || localStorage.getItem('kusina_po_approver_title') || '';

  // Dynamic Manifest Update para sa PWA Name at Logo sa Cellphone
  updateDynamicManifest(currentName, currentLogo);

  // 1. I-update ang Company Name / Header sa lahat ng bahagi
  document.querySelectorAll('#brand-header-title, .brand-header-title').forEach(el => {
    el.innerText = currentName;
  });
  document.querySelectorAll('#brand-header-subtitle, .brand-header-subtitle').forEach(el => {
    el.innerText = currentSub;
  });

  // 2. I-update ang Logo sa Login Screen, Dashboard Navbars, at Resibo
  document.querySelectorAll('.brand-logo-img, .receipt-logo, .report-logo, .company-logo').forEach(img => {
    if (currentLogo) {
      img.src = currentLogo;
      img.style.display = 'inline-block';
    } else {
      img.style.display = 'none';
    }
  });

  // Itago ang default emoji (🍳) kapag may na-upload nang logo
  document.querySelectorAll('#default-brand-icon, .default-brand-icon').forEach(icon => {
    if (currentLogo) {
      icon.style.display = 'none';
    } else {
      icon.style.display = 'inline-block';
    }
  });

  // 3. I-populate ang admin settings inputs kung bukas ang Branding tab
  const inputName = document.getElementById('setting-brand-name');
  const inputSub = document.getElementById('setting-brand-subtitle');
  const inputTin = document.getElementById('setting-brand-tin');
  const inputAddr = document.getElementById('setting-brand-address');
  const inputContact = document.getElementById('setting-brand-contact');
  const previewImg = document.getElementById('setting-brand-logo-preview');

  if (inputName && !inputName.value) inputName.value = currentName;
  if (inputSub && !inputSub.value) inputSub.value = currentSub;
  if (inputTin && !inputTin.value) inputTin.value = currentTin;
  if (inputAddr && !inputAddr.value) inputAddr.value = currentAddr;
  if (inputContact && !inputContact.value) inputContact.value = currentContact;

  const inputChecker = document.getElementById('setting-brand-po-checker');
  const inputCheckerTitle = document.getElementById('setting-brand-po-checker-title');
  const inputApprover = document.getElementById('setting-brand-po-approver');
  const inputApproverTitle = document.getElementById('setting-brand-po-approver-title');

  if (inputChecker && !inputChecker.value) inputChecker.value = currentChecker;
  if (inputCheckerTitle && !inputCheckerTitle.value) inputCheckerTitle.value = currentCheckerTitle;
  if (inputApprover && !inputApprover.value) inputApprover.value = currentApprover;
  if (inputApproverTitle && !inputApproverTitle.value) inputApproverTitle.value = currentApproverTitle;
  
  if (previewImg && currentLogo) {
    previewImg.src = currentLogo;
    previewImg.style.display = 'inline-block';
  }

  // 4. I-update ang Browser Title Tab
  if (currentName) {
    document.title = `${currentName} - Management System`;
  }
}

// Helper function para i-compress at i-resize ang logo gamit ang HTML5 Canvas bago i-save
function compressImage(file, maxWidth = 320, maxHeight = 160) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > maxWidth || height > maxHeight) {
          if (width / height > maxWidth / maxHeight) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          } else {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        // Export as PNG kung transparent, or JPEG 0.85
        const isPng = file.type === 'image/png';
        const compressedBase64 = isPng ? canvas.toDataURL('image/png') : canvas.toDataURL('image/jpeg', 0.85);
        resolve(compressedBase64);
      };
      img.onerror = (err) => reject(err);
    };
    reader.onerror = (err) => reject(err);
  });
}

async function saveSystemBranding() {
  const inputName = document.getElementById('setting-brand-name');
  const inputSub = document.getElementById('setting-brand-subtitle');
  const inputTin = document.getElementById('setting-brand-tin');
  const inputAddr = document.getElementById('setting-brand-address');
  const inputContact = document.getElementById('setting-brand-contact');
  const inputChecker = document.getElementById('setting-brand-po-checker');
  const inputCheckerTitle = document.getElementById('setting-brand-po-checker-title');
  const inputApprover = document.getElementById('setting-brand-po-approver');
  const inputApproverTitle = document.getElementById('setting-brand-po-approver-title');
  const fileInput = document.getElementById('setting-brand-logo');
  const saveBtn = document.querySelector('button[onclick="saveSystemBranding()"]');

  const brandName = (inputName ? inputName.value.trim() : '') || 'KusinaERP';
  const brandSubtitle = (inputSub ? inputSub.value.trim() : '') || 'Secured Enterprise Portal (Firebase Auth & Firestore)';
  const brandTin = inputTin ? inputTin.value.trim() : '';
  const brandAddr = inputAddr ? inputAddr.value.trim() : '';
  const brandContact = inputContact ? inputContact.value.trim() : '';
  const poChecker = inputChecker ? inputChecker.value.trim() : '';
  const poCheckerTitle = inputCheckerTitle ? inputCheckerTitle.value.trim() : '';
  const poApprover = inputApprover ? inputApprover.value.trim() : '';
  const poApproverTitle = inputApproverTitle ? inputApproverTitle.value.trim() : '';
  let brandLogo = localStorage.getItem('kusina_brand_logo') || '';

  const origBtnText = saveBtn ? saveBtn.innerHTML : '';
  if (saveBtn) {
    saveBtn.disabled = true;
    saveBtn.innerHTML = '⏳ Nag-a-upload at nagse-save...';
  }

  const processAndSave = async (finalLogo) => {
    try {
      localStorage.setItem('kusina_brand_name', brandName);
      localStorage.setItem('kusina_brand_subtitle', brandSubtitle);
      localStorage.setItem('kusina_brand_tin', brandTin);
      localStorage.setItem('kusina_brand_address', brandAddr);
      localStorage.setItem('kusina_brand_contact', brandContact);
      localStorage.setItem('kusina_po_checker', poChecker);
      localStorage.setItem('kusina_po_checker_title', poCheckerTitle);
      localStorage.setItem('kusina_po_approver', poApprover);
      localStorage.setItem('kusina_po_approver_title', poApproverTitle);
      if (finalLogo) {
        localStorage.setItem('kusina_brand_logo', finalLogo);
      }

      applyBrandingToUI(brandName, brandSubtitle, finalLogo, brandTin, brandAddr, brandContact, poChecker, poCheckerTitle, poApprover, poApproverTitle);

      if (typeof db !== 'undefined' && db) {
        await db.collection('system_settings').doc('branding').set({
          brandName: brandName,
          brandSubtitle: brandSubtitle,
          brandTin: brandTin,
          brandAddress: brandAddr,
          brandContact: brandContact,
          poChecker: poChecker,
          poCheckerTitle: poCheckerTitle,
          poApprover: poApprover,
          poApproverTitle: poApproverTitle,
          brandLogo: finalLogo,
          updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });

        logSystemAction('BRANDING_UPDATED', `Binago ang system branding/logo. Bagong pangalan: ${brandName}`);
        alert(`✅ Matagumpay na nai-upload at nai-save ang Logo at Branding ng Kumpanya!`);
      } else {
        alert(`✅ Nai-save ang Branding sa Local Storage!`);
      }
    } catch (err) {
      console.error('Error saving branding:', err);
      alert('❌ Error sa pag-save: ' + err.message);
    } finally {
      if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.innerHTML = origBtnText || '💾 I-save ang Bagong Header';
      }
    }
  };

  if (fileInput && fileInput.files && fileInput.files[0]) {
    try {
      const file = fileInput.files[0];
      const compressedData = await compressImage(file, 350, 150);
      await processAndSave(compressedData);
    } catch (e) {
      alert('❌ Nabigo ang pagbasa o pag-compress ng larawan: ' + e.message);
      if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.innerHTML = origBtnText;
      }
    }
  } else {
    await processAndSave(brandLogo);
  }
}

// ==========================================================================
// PRODUCT MASTER AUTO-BACKUP & ROLLBACK ENGINE
// ==========================================================================
async function backupCurrentProducts(triggerReason = "Manual Admin Backup") {
  if (typeof db === 'undefined' || !db) return;
  try {
    const snap = await db.collection('products').get();
    if (snap.empty) return;

    const productsData = [];
    snap.forEach(doc => {
      productsData.push({ id: doc.id, ...doc.data() });
    });

    const u = getCurrentUser();
    const adminEmail = u ? (u.email || u.name) : 'Admin';
    const backupId = 'BK-' + Date.now();

    await db.collection('product_backups').doc(backupId).set({
      backupId: backupId,
      triggerReason: triggerReason,
      createdBy: adminEmail,
      itemCount: productsData.length,
      snapshot: productsData,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      dateStr: new Date().toLocaleString()
    });

    console.log(`Auto-backup ${backupId} created with ${productsData.length} items.`);
  } catch (err) {
    console.warn('Backup error:', err);
  }
}

async function loadProductBackupLogs() {
  const tbody = document.getElementById('product-backups-tbody');
  if (!tbody || typeof db === 'undefined' || !db) return;

  try {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: #64748b; padding: 1rem;">Kinukuha ang backup logs mula sa Firestore...</td></tr>';
    const snap = await db.collection('product_backups').orderBy('createdAt', 'desc').limit(20).get();

    if (snap.empty) {
      tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: #94a3b8; padding: 1.5rem;">Wala pang naitalang backup history. Awtomatikong gagawa kapag nag-upload ng CSV.</td></tr>';
      return;
    }

    let html = '';
    snap.forEach(doc => {
      const b = doc.data();
      const dateStr = b.dateStr || (b.createdAt ? new Date(b.createdAt.toDate ? b.createdAt.toDate() : b.createdAt).toLocaleString() : doc.id);
      html += `
        <tr>
          <td><b>${dateStr}</b></td>
          <td><span class="badge badge-admin">${b.triggerReason || 'Auto-Backup'}</span></td>
          <td>${b.createdBy || 'Admin'}</td>
          <td><b>${b.itemCount || (b.snapshot || []).length}</b> items</td>
          <td style="text-align: center;">
            <div style="display: flex; gap: 0.35rem; justify-content: center;">
              <button class="btn btn-sm btn-secondary" onclick="downloadSpecificBackupCSV('${doc.id}')">📥 CSV</button>
              <button class="btn btn-sm btn-danger" onclick="restoreSpecificBackup('${doc.id}')">⏮️ Restore</button>
            </div>
          </td>
        </tr>
      `;
    });
    tbody.innerHTML = html;
  } catch (err) {
    console.error('Error loading backup logs:', err);
    tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: #ef4444;">Error: ${err.message}</td></tr>`;
  }
}

async function downloadSpecificBackupCSV(backupDocId) {
  if (!db) return;
  try {
    const doc = await db.collection('product_backups').doc(backupDocId).get();
    if (!doc.exists) { alert('Hindi nahanap ang backup file.'); return; }

    const data = doc.data();
    const items = data.snapshot || [];
    const headers = "POS_Code,SAP_Item_Code,Barcode,Item_Description,Commissary_Hub,Storage_Station,Whole_UOM,Loose_UOM,Whole_Price,Loose_Price,Conversion_Factor,Buffer_Limit,Packaging_Instructions\n";
    let rows = '';

    items.forEach(p => {
      const pos = p.posCode || p.pos_code || '';
      const sap = p.sapCode || p.itemCode || p.id || '';
      const bar = p.barcode || p.barcodeNumber || '';
      const name = (p.itemName || '').replace(/"/g, '""');
      const hub = p.commissarySource || 'Central Hub';
      const st = p.storageStation || 'Unassigned';
      const wu = p.wholeUOM || 'Box';
      const lu = p.looseUOM || 'Pcs';
      const wp = p.wholePrice || 0;
      const lp = p.loosePrice || 0;
      const conv = p.conversionFactor || 1;
      const buf = p.bufferLimit || 5;
      const pack = (p.packagingInstructions || '').replace(/"/g, '""');

      rows += `"${pos}","${sap}","${bar}","${name}","${hub}","${st}","${wu}","${lu}",${wp},${lp},${conv},${buf},"${pack}"\n`;
    });

    const blob = new Blob([headers + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ProductMaster_Backup_${backupDocId}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  } catch (err) {
    alert('Error sa pag-download: ' + err.message);
  }
}

async function restoreSpecificBackup(backupDocId) {
  if (!await uiConfirm(`BABALA: Iba-rollback ang buong Product Masterlist sa bersyon ng backup (${backupDocId}). Sigurado ka ba?`)) return;
  if (!db) return;

  try {
    const doc = await db.collection('product_backups').doc(backupDocId).get();
    if (!doc.exists) { alert('Hindi nahanap ang backup.'); return; }

    const data = doc.data();
    const items = data.snapshot || [];

    await backupCurrentProducts(`Pre-Restore Safety Backup (bago ibalik ang ${backupDocId})`);

    const batch = db.batch();
    items.forEach(p => {
      const ref = db.collection('products').doc(p.sapCode || p.itemCode || p.id);
      batch.set(ref, {
        ...p,
        restoredAt: firebase.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
    });

    await batch.commit();
    await logSystemAction('SYSTEM_ROLLBACK', `Ini-rollback ang database sa backup version: ${backupDocId}`);
    alert(`🎉 Matagumpay na naibalik (Restored) ang ${items.length} produkto mula sa backup ${backupDocId}!`);
    loadAdminProducts();
    loadProductBackupLogs();
  } catch (err) {
    alert('Error sa rollback: ' + err.message);
  }
}

// ==========================================================================
// COMMISSARY EXPORT, DISPATCH DR, & MODAL ACTION CONTROLLERS
// ==========================================================================
async function exportCommissaryProductsCSV() {
  if (typeof db === 'undefined' || !db) return;
  try {
    const stationFilterEl = document.getElementById('station-filter') || document.getElementById('admin-station-filter');
    const selectedStation = stationFilterEl ? stationFilterEl.value : 'all';

    const snap = await db.collection('products').get();
    if (snap.empty) { alert('Walang produktong ma-e-export.'); return; }
    await loadProductCosts();

    const headers = "POS_Code,SAP_Item_Code,Barcode,Item_Description,Commissary_Hub,Storage_Station,Whole_UOM,Loose_UOM,Whole_Price,Loose_Price,Conversion_Factor,Buffer_Limit,Packaging_Instructions,Cost_Whole,Cost_Loose\n";
    let rows = '';
    let exportedCount = 0;

    snap.forEach(doc => {
      const p = doc.data();
      const st = p.storageStation || 'Unassigned';

      // Salain batay sa napiling Storage Station sa dropdown
      if (selectedStation !== 'all' && st.toLowerCase().trim() !== selectedStation.toLowerCase().trim()) {
        return;
      }

      const pos = p.posCode || p.pos_code || '';
      const sap = p.sapCode || p.itemCode || doc.id || '';
      const bar = p.barcode || p.barcodeNumber || '';
      const name = (p.itemName || '').replace(/"/g, '""');
      const hub = p.commissarySource || 'Central Hub';
      const wu = p.wholeUOM || 'Box';
      const lu = p.looseUOM || 'Pcs';
      const wp = p.wholePrice || 0;
      const lp = p.loosePrice || 0;
      const conv = p.conversionFactor || 1;
      const buf = p.bufferLimit || 5;
      const pack = (p.packagingInstructions || '').replace(/"/g, '""');

      const _pc = productCosts[doc.id] || {};
      rows += `"${pos}","${sap}","${bar}","${name}","${hub}","${st}","${wu}","${lu}",${wp},${lp},${conv},${buf},"${pack}",${_pc.costWhole || 0},${_pc.costLoose || 0}\n`;
      exportedCount++;
    });

    if (exportedCount === 0) {
      alert(`Walang nahanap na produkto para sa istasyong: "${selectedStation}".`);
      return;
    }

    const blob = new Blob(["\uFEFF" + headers + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    
    const safeStationLabel = selectedStation === 'all' ? 'All_Stations' : selectedStation.replace(/[^a-zA-Z0-9]/g, '_');
    const todayStr = new Date().toISOString().slice(0,10);
    a.download = `KusinaERP_Products_${safeStationLabel}_${todayStr}.csv`;
    
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    alert(`✅ Matagumpay na na-download ang ${exportedCount} produkto para sa: ${selectedStation === 'all' ? 'Lahat ng Stations' : selectedStation}!`);
  } catch (err) {
    alert('Error sa pag-export: ' + err.message);
  }
}


function printDeliveryReceiptA4() {
  window.print();
}


// ========================================================
// COMMISSARY ORDER MODAL LOGIC (OPEN, EDIT SI/PO)
// ========================================================
function openCommissaryOrderModal(orderId) {
  const order = currentOrders.find(o => o.id === orderId);
  if (!order) {
    alert('Hindi nahanap ang order.');
    return;
  }
  
  activeCommissaryOrderId = orderId;
  
  const idEl = document.getElementById('com-modal-order-id');
  const badgeEl = document.getElementById('com-modal-status-badge');
  const branchEl = document.getElementById('com-modal-branch-name');
  const dateEl = document.getElementById('com-modal-delivery-date');
  const siInput = document.getElementById('com-modal-si-number');
  const poInput = document.getElementById('com-modal-po-number');
  
  if (idEl) idEl.innerText = order.orderId || order.id;
  if (branchEl) branchEl.innerText = order.branchName || 'Branch';
  if (dateEl) dateEl.innerText = order.targetDeliveryDate || 'ASAP';
  
  const status = order.status || 'Pending Preparation';
  const isEditable = !(status.includes('Dispatched') || status.includes('Completed') || status.includes('Cancel') || status.includes('Closed'));

  if (poInput) {
    poInput.value = order.manualPoNumber || order.poNumber || order.orderId || order.id || '';
    poInput.disabled = !isEditable;
    poInput.style.backgroundColor = isEditable ? '#fff' : '#f1f5f9';
  }
  
  if (siInput) {
    siInput.disabled = !isEditable;
    siInput.style.backgroundColor = isEditable ? '#fff' : '#f1f5f9';
    
    if (order.siNumber) {
      siInput.value = order.siNumber;
    } else if (isEditable) {
      siInput.placeholder = "Kinukuha...";
      // Mungkahi lang ito. HINDI na sine-save pagbukas ng modal; ang SI ay itatala lang kapag tinanggap ang order.
      getNextSINumber().then(nextSi => {
        siInput.value = nextSi;
        siInput.title = 'Mungkahing SI number. Mase-save lang kapag tinanggap ang order.';
      });
    } else {
      siInput.value = '';
    }
  }
  
  if (badgeEl) {
    badgeEl.innerText = status;
    badgeEl.className = 'badge ' + (status.includes('Completed') ? 'badge-branch' : (status.includes('Pending') ? 'badge-warning' : 'badge-commissary'));
  }
  
  // Alert Banners logic
  const cancelBanner = document.getElementById('com-cancel-request-banner');
  const cancelReasonText = document.getElementById('com-cancel-reason-text');
  const pahabolBanner = document.getElementById('com-pahabol-alert-banner');
  const pahabolItemsBox = document.getElementById('com-pahabol-items-box');

  if (cancelBanner) {
    if (order.cancellationRequested) {
      cancelBanner.style.display = 'block';
      if (cancelReasonText) cancelReasonText.innerText = order.cancellationReason || 'Custom na dahilan';
    } else {
      cancelBanner.style.display = 'none';
    }
  }

  if (pahabolBanner) {
    if (order.pahabol) {
      pahabolBanner.style.display = 'block';
      if (pahabolItemsBox) {
        pahabolItemsBox.innerHTML = `<b>${order.pahabol.itemName}</b> - Gustong idagdag: ${order.pahabol.requestedWholeQty} ${order.pahabol.wholeUOM || 'Box'} at ${order.pahabol.requestedLooseQty} ${order.pahabol.looseUOM || 'Pcs'}`;
      }
    } else {
      pahabolBanner.style.display = 'none';
    }
  }

  // Stages logic
  const sAccept = document.getElementById('com-stage-accept');
  const sEdit = document.getElementById('com-stage-edit');
  const sVerify = document.getElementById('com-stage-verify');
  
  if (status === 'Pending Preparation' || status === 'Pending') {
    if (sAccept) sAccept.style.display = 'block';
    if (sEdit) sEdit.style.display = 'none';
    if (sVerify) sVerify.style.display = 'none';
  } else if (status.includes('Preparing') || status.includes('Stations') || status.includes('Packed') || status.includes('Pahabol')) {
    if (sAccept) sAccept.style.display = 'none';
    if (sEdit) sEdit.style.display = 'block';
    if (sVerify) sVerify.style.display = 'block'; // Dito lang lalabas ang Dispatch form
  } else {
    // Dispatched, Completed, Cancelled, Closed
    if (sAccept) sAccept.style.display = 'none';
    if (sEdit) sEdit.style.display = 'block'; // Ipakita pa rin ang items
    if (sVerify) sVerify.style.display = 'none'; // Itago ang Dispatch button at courier form
  }

  // Populate items
  const tbody = document.getElementById('com-modal-items-tbody');
  const tTotal = document.getElementById('com-modal-adjusted-total');
  
  if (tbody) {
    let html = '';
    let total = 0;
    (order.items || []).forEach(i => {
      const pos = i.posCode || '--';
      const sap = i.sapCode || i.itemCode || i.id || '--';
      const wPrice = parseFloat(i.wholePrice || 0);
      const lPrice = parseFloat(i.loosePrice || 0);
      const wQty = parseFloat(i.wholeQty || 0);
      const lQty = parseFloat(i.looseQty || 0);
      const sub = parseFloat(i.subtotal || 0);
      total += sub;
      
      if (isEditable) {
        html += `<tr id="edit-row-${i.itemCode || i.id}">
          <td><b>${pos}</b><br><small>${sap}</small></td>
          <td><b>${i.itemName}</b><br><span class="badge badge-admin">📍 ${i.storageStation || 'Unassigned'}</span></td>
          <td><input type="number" id="edit-wqty-${i.itemCode || i.id}" value="${wQty}" step="0.5" style="width:60px;" onchange="recalcCommOrder('${i.itemCode || i.id}')"> ${i.wholeUOM || 'Whole'}</td>
          <td><input type="number" id="edit-lqty-${i.itemCode || i.id}" value="${lQty}" step="0.5" style="width:60px;" onchange="recalcCommOrder('${i.itemCode || i.id}')"> ${i.looseUOM || 'Loose'}</td>
          <td><input type="number" id="edit-wpx-${i.itemCode || i.id}" value="${wPrice}" step="0.01" style="width:70px;" onchange="recalcCommOrder('${i.itemCode || i.id}')">/W<br><input type="number" id="edit-lpx-${i.itemCode || i.id}" value="${lPrice}" step="0.01" style="width:70px;" onchange="recalcCommOrder('${i.itemCode || i.id}')">/L</td>
          <td><b id="edit-sub-${i.itemCode || i.id}">₱${sub.toFixed(2)}</b></td>
        </tr>`;
      } else {
        html += `<tr>
          <td><b>${pos}</b><br><small>${sap}</small></td>
          <td><b>${i.itemName}</b><br><span class="badge badge-admin">📍 ${i.storageStation || 'Unassigned'}</span></td>
          <td>${wQty} ${i.wholeUOM || 'Whole'}</td>
          <td>${lQty} ${i.looseUOM || 'Loose'}</td>
          <td>₱${wPrice}/W | ₱${lPrice}/L</td>
          <td><b>₱${sub.toFixed(2)}</b></td>
        </tr>`;
      }
    });
    tbody.innerHTML = html;
    if (tTotal) tTotal.innerText = `₱${total.toFixed(2)}`;
  }
  
  // Populate dropdowns from team memory (assuming db query happened or memory loaded)
  if (typeof db !== 'undefined') {
    db.collection('commissary_team').get().then(snap => {
      let stockmanOpts = '';
      let driverOpts = '';
      let stockHeadName = 'Admin / Head Checker';
      
      snap.forEach(doc => {
        const t = doc.data();
        if (t.role === 'stockman') {
          stockmanOpts += `<option value="${t.name}" ${t.isDefault ? 'selected' : ''}>${t.name}</option>`;
        } else if (t.role === 'driver') {
          driverOpts += `<option value="${t.name} (${t.note || 'In-House'})" ${t.isDefault ? 'selected' : ''}>${t.name} - ${t.note || 'Company'}</option>`;
        } else if (t.role === 'checker' && t.isDefault) {
          stockHeadName = t.name;
        }
      });
      
      const sSel = document.getElementById('com-verify-stockman');
      const dSel = document.getElementById('com-inhouse-driver');
      const hInput = document.getElementById('com-verify-stockhead');
      
      if (sSel) sSel.innerHTML = stockmanOpts || '<option value="Stockman">Wala pang nakasave</option>';
      if (dSel) dSel.innerHTML = driverOpts || '<option value="Driver">Wala pang nakasave</option>';
      if (hInput) hInput.value = stockHeadName;
    }).catch(console.error);
  }

  // Show modal
  const m = document.getElementById('commissary-order-modal');
  if (m) m.style.display = 'flex';
}

async function saveModalSIAndPO() {
  if (!activeCommissaryOrderId || !db) return;
  
  const siInput = document.getElementById('com-modal-si-number');
  const poInput = document.getElementById('com-modal-po-number');
  const ind = document.getElementById('com-modal-save-indicator');
  if (!siInput || !poInput || siInput.disabled) return;

  try {
    const siVal = siInput.value.trim();
    const poVal = poInput.value.trim();
    const orderRef = db.collection('orders').doc(activeCommissaryOrderId);
    const seqRef = db.collection('system_settings').doc('invoice_sequence');

    // Iwasan ang dobleng SI number
    if (siVal) {
      const dup = await db.collection('orders').where('siNumber', '==', siVal).get();
      if (dup.docs.some(d => d.id !== activeCommissaryOrderId)) {
        alert(`⚠️ Ginamit na ang SI number na ${siVal} sa ibang order. Pumili ng ibang numero.`);
        return;
      }
    }

    await db.runTransaction(async tx => {
      const num = /^SI-\d+$/i.test(siVal) ? parseInt(siVal.slice(3), 10) : NaN;
      const seqSnap = !isNaN(num) ? await tx.get(seqRef) : null;
      tx.update(orderRef, { siNumber: siVal, manualPoNumber: poVal, poNumber: poVal });
      // Ang sequence ay tumataas lang, hindi bumababa (para walang umuulit na numero)
      if (seqSnap && num > (seqSnap.exists ? (parseInt(seqSnap.data().lastSI, 10) || 0) : 0)) {
        tx.set(seqRef, { lastSI: num }, { merge: true });
      }
    });

    const order = currentOrders.find(o => o.id === activeCommissaryOrderId);
    if (order) {
      order.siNumber = siVal;
      order.manualPoNumber = poVal;
      order.poNumber = poVal;
    }
    logSystemAction('SI_PO_UPDATED', `Binago ang SI/PO details ng order: ${activeCommissaryOrderId}`);
    if (ind) {
      ind.style.display = 'flex';
      setTimeout(() => ind.style.display = 'none', 2000);
    }
  } catch (e) {
    console.warn("Failed saving SI/PO", e);
    alert('Error sa pag-save ng SI/PO: ' + e.message);
  }
}
function closeCommissaryOrderModal() {
  const modal = document.getElementById('commissary-order-modal');
  if (modal) modal.style.display = 'none';
}

function triggerModalPrintSlip() {
  if (activeCommissaryOrderId) {
    printPickingGuide(activeCommissaryOrderId, '3col');
  } else {
    window.print();
  }
}

function triggerModalDownloadCSV() {
  if (activeCommissaryOrderId) {
    downloadBranchOrderCSV(activeCommissaryOrderId);
  } else {
    alert('Pumili muna ng aktibong order.');
  }
}

function triggerModalCopyTSV() {
  if (activeCommissaryOrderId) {
    copyBranchOrderToClipboard(activeCommissaryOrderId);
  } else {
    alert('Pumili muna ng aktibong order.');
  }
}
let activeCommissaryOrderId = null;


// ========================================================
// ORDER INVESTIGATION & ADMIN CANCELLATION APPROVAL ENGINE
// ========================================================
function viewOrderInvestigationDetails(orderId) {
  const order = (typeof currentOrders !== 'undefined' ? currentOrders : []).find(o => o.id === orderId) ||
                (typeof branchPastOrdersList !== 'undefined' ? branchPastOrdersList : []).find(o => o.id === orderId);
  
  if (!order) {
    if (typeof db !== 'undefined' && db) {
      db.collection('orders').doc(orderId).get().then(doc => {
        if (doc.exists) {
          renderInvestigationModal({ id: doc.id, ...doc.data() });
        } else {
          alert('Hindi nahanap ang detalye ng order.');
        }
      }).catch(err => alert('Error: ' + err.message));
    } else {
      alert('Hindi nahanap ang detalye ng order.');
    }
    return;
  }

  renderInvestigationModal(order);
}

function renderInvestigationModal(order) {
  const u = getCurrentUser();
  const isAdmin = u && (u.role === 'admin' || (u.role && u.role.toLowerCase().includes('admin')));

  let itemsHtml = (order.items || []).map(i => {
    const whole = i.wholeQty > 0 ? `${i.wholeQty} ${i.wholeUOM || 'Box'}` : '';
    const loose = i.looseQty > 0 ? `${i.looseQty} ${i.looseUOM || 'Pcs'}` : '';
    const qtyStr = [whole, loose].filter(Boolean).join(' + ') || '0 unit';
    const subtotal = parseFloat(i.subtotal || 0).toLocaleString('en-PH', { style: 'currency', currency: 'PHP' });
    return `<li style="margin-bottom: 4px;"><b>${i.itemName || 'Item'}</b>: ${qtyStr} &mdash; <span style="color: #2563eb; font-weight: 700;">${subtotal}</span></li>`;
  }).join('');

  const reason = order.cancellationReason || order.disputeNotes || order.cancelReason || 'Walang nakasaad na espesyal na dahilan.';
  const totalAmount = parseFloat(order.totalAmount || 0).toLocaleString('en-PH', { style: 'currency', currency: 'PHP' });

    let showLateReturnBtn = '';
  if (!isAdmin && order.status.includes('Completed') && order.receivedAt) {
    const rcvDate = order.receivedAt.toDate ? order.receivedAt.toDate() : new Date(order.receivedAt);
    const now = new Date();
    const diffTime = Math.abs(now - rcvDate);
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays <= 7) {
      const daysLeft = 7 - diffDays;
      showLateReturnBtn = `<button type="button" class="btn btn-warning btn-sm" style="font-weight: 700;" onclick="openLateReturnModal('${order.id}')">🔄 Late Return (${daysLeft} days left)</button>`;
    } else {
      showLateReturnBtn = `<button type="button" class="btn btn-secondary btn-sm" disabled title="Lumampas na sa 7-day limit">🚫 Return Expired</button>`;
    }
  }
  
  let modal = document.getElementById('investigation-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'investigation-modal';
    modal.className = 'modal-overlay';
    document.body.appendChild(modal);
  }

  modal.innerHTML = `
    <div class="modal-content" style="max-width: 550px;">
      <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #e2e8f0; padding-bottom: 0.5rem; margin-bottom: 1rem;">
        <h3 style="margin: 0; color: #1e293b;">🔍 Order Investigation & Audit Details</h3>
        <button type="button" class="btn btn-secondary btn-sm" onclick="document.getElementById('investigation-modal').style.display='none'">✕</button>
      </div>
      <div style="font-size: 0.9rem; line-height: 1.6; color: #334155;">
        <p><b>Order Reference:</b> <span style="color: #2563eb; font-weight: 800;">${order.orderId || order.id}</span></p>
        <p><b>Branch Destination:</b> ${order.branchName || 'Branch'}</p>
        <p><b>Delivery Address:</b> ${order.branchAddress || '--'}</p>
        <p><b>Target Delivery Date:</b> ${order.targetDeliveryDate || 'ASAP'}</p>
        <p><b>Current Status:</b> <span class="badge badge-warning">${order.status || 'Pending'}</span></p>
        <div style="background: #fef2f2; border-left: 4px solid #ef4444; padding: 0.6rem 0.8rem; margin: 0.75rem 0; border-radius: 4px;">
          <b style="color: #991b1b;">Dahilan ng Pag-cancel / Reklamo (Dispute Notes):</b><br>
          <span style="color: #7f1d1d;">${reason}</span>
        </div>
        <b>Talaan ng mga Produkto sa Order:</b>
        <ul style="padding-left: 1.25rem; margin: 0.5rem 0 1rem 0;">
          ${itemsHtml || '<li>Walang items.</li>'}
        </ul>
        <div style="text-align: right; font-size: 1.1rem; font-weight: 800; border-top: 1px solid #e2e8f0; padding-top: 0.5rem;">
          Kabuuang Halaga: <span style="color: #2563eb;">${totalAmount}</span>
        </div>
      </div>
      <div style="margin-top: 1.25rem; display: flex; justify-content: flex-end; gap: 0.5rem; border-top: 1px solid #e2e8f0; padding-top: 0.75rem;">
        <button type="button" class="btn btn-secondary btn-sm" onclick="document.getElementById('investigation-modal').style.display='none'">Isara</button>
        ${isAdmin ? `<button type="button" class="btn btn-danger btn-sm" style="font-weight: 700;" onclick="confirmAdminCancellation('${order.id}')">Approve Cancellation (Admin)</button>` : ''}
        ${showLateReturnBtn}
      </div>
    </div>
  `;
  modal.style.display = 'flex';
}

async function confirmAdminCancellation(orderId) {
  if (!await uiConfirm("Kumpirmahin: Aprubahan ang cancellation ng order na ito bilang Admin?")) return;
  if (typeof db === 'undefined' || !db) return;

  try {
    const res = await applyOrderStock(orderId, 'restock', {
      status: 'Cancelled & Approved by Admin',
      approvedCancellationBy: getCurrentUser() ? getCurrentUser().email : 'Admin'
    });
    logSystemAction('ORDER_CANCELLED_ADMIN', `Sapilitang kinansela ni Admin ang PO: ${orderId}. ${res.applied ? 'Naibalik ang stock.' : 'Walang naibawas na stock.'}`);
    alert("✅ Matagumpay na na-approve ang cancellation ng order.");
    const m = document.getElementById('investigation-modal');
    if (m) m.style.display = 'none';
    if (typeof loadIncomingOrders === 'function') loadIncomingOrders();
    if (typeof loadBranchDeliveries === 'function') loadBranchDeliveries();
  } catch (err) {
    alert("Error sa pag-approve: " + err.message);
  }
}


// ========================================================
// DISPUTE / DAMAGE RESOLUTION & OPEN PO DECISION ENGINE
// ========================================================
function openDisputePOModal(orderId) {
  const order = (typeof currentOrders !== 'undefined' ? currentOrders : []).find(o => o.id === orderId) ||
                (typeof branchPastOrdersList !== 'undefined' ? branchPastOrdersList : []).find(o => o.id === orderId);

  if (!order) {
    if (typeof db !== 'undefined' && db) {
      db.collection('orders').doc(orderId).get().then(doc => {
        if (doc.exists) {
          renderDisputePOModal({ id: doc.id, ...doc.data() });
        } else {
          alert('Hindi nahanap ang PO record.');
        }
      }).catch(err => alert('Error: ' + err.message));
    } else {
      alert('Hindi nahanap ang PO record.');
    }
    return;
  }

  renderDisputePOModal(order);
}

function renderDisputePOModal(order) {
  const u = getCurrentUser();
  const isAdmin = u && (u.role === 'admin' || (u.role && u.role.toLowerCase().includes('admin')));

  let rowsHtml = '';
  (order.items || []).forEach((item, idx) => {
    const whole = item.wholeQty > 0 ? `${item.wholeQty} ${item.wholeUOM || 'Box'}` : '';
    const loose = item.looseQty > 0 ? `${item.looseQty} ${item.looseUOM || 'Pcs'}` : '';
    const expectedQty = [whole, loose].filter(Boolean).join(' + ') || '0 unit';
    const subtotal = parseFloat(item.subtotal || 0).toLocaleString('en-PH', { style: 'currency', currency: 'PHP' });

    rowsHtml += `
      <tr>
        <td><b>${item.itemName || 'Item'}</b><br><small style="color: #64748b;">${item.itemCode || item.id || ''}</small></td>
        <td>${item.storageStation || 'General'}</td>
        <td><b>${expectedQty}</b></td>
        <td><span style="color: #059669; font-weight: 700;">${subtotal}</span></td>
      </tr>
    `;
  });

  const notes = order.disputeNotes || order.cancellationReason || order.cancelReason || 'Walang nakatalang detalye.';
  const totalAmount = parseFloat(order.totalAmount || 0).toLocaleString('en-PH', { style: 'currency', currency: 'PHP' });

  let modal = document.getElementById('dispute-decision-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'dispute-decision-modal';
    modal.className = 'modal-overlay';
    document.body.appendChild(modal);
  }

  modal.innerHTML = `
    <div class="modal-content" style="max-width: 680px; width: 95%; max-height: 90vh; overflow-y: auto;">
      <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #e2e8f0; padding-bottom: 0.5rem; margin-bottom: 1rem;">
        <div>
          <h3 style="margin: 0; color: #1e293b;">📋 Open PO & Discrepancy Investigation</h3>
          <small style="color: #64748b;">PO Reference: <b style="color: #2563eb;">${order.orderId || order.id}</b></small>
        </div>
        <button type="button" class="btn btn-secondary btn-sm" onclick="document.getElementById('dispute-decision-modal').style.display='none'">✕</button>
      </div>

      <div style="font-size: 0.9rem; line-height: 1.5; color: #334155; margin-bottom: 1rem;">
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem; background: #f8fafc; padding: 0.75rem; border-radius: 0.375rem; margin-bottom: 0.75rem;">
          <div><b>Branch:</b> ${order.branchName || 'Branch'}</div>
          <div><b>Target Date:</b> ${order.targetDeliveryDate || 'ASAP'}</div>
          <div><b>Status:</b> <span class="badge badge-warning">${order.status || 'Disputed'}</span></div>
          <div><b>Driver / Transporter:</b> ${order.driverName || '--'}</div>
        </div>

        <div style="background: #fef2f2; border-left: 4px solid #ef4444; padding: 0.6rem 0.8rem; margin-bottom: 0.75rem; border-radius: 4px;">
          <b style="color: #991b1b;">⚠️ Damage / Discrepancy Report mula sa Branch:</b><br>
          <span style="color: #7f1d1d;">${notes}</span>
        </div>

        <b style="display: block; margin-bottom: 0.35rem;">Talaan ng mga Produkto sa PO:</b>
        <div class="table-responsive" style="max-height: 200px; overflow-y: auto; border: 1px solid #e2e8f0; border-radius: 4px; margin-bottom: 0.5rem;">
          <table>
            <thead>
              <tr>
                <th>Produkto</th>
                <th>Station</th>
                <th>Inaasahang Qty</th>
                <th>Subtotal</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml || '<tr><td colspan="4" style="text-align: center; color: #94a3b8;">Walang items.</td></tr>'}
            </tbody>
          </table>
        </div>

        <div style="text-align: right; font-size: 1.1rem; font-weight: 800; padding-top: 0.5rem;">
          Kabuuang Halaga ng PO: <span style="color: #2563eb;">${totalAmount}</span>
        </div>
      </div>

      <div style="border-top: 2px solid #e2e8f0; padding-top: 0.75rem;">
        <b style="display: block; margin-bottom: 0.5rem; font-size: 0.85rem; text-transform: uppercase; color: #475569;">
          ${isAdmin ? '⚖️ Mga Desisyon ni Admin (Operations & Accounting):' : '🔒 View Only (Si Admin lamang ang may desisyon):'}
        </b>
        <div style="display: flex; gap: 0.5rem; flex-wrap: wrap; justify-content: flex-end;">
          <button type="button" class="btn btn-secondary btn-sm" onclick="document.getElementById('dispute-decision-modal').style.display='none'">Isara</button>
          ${isAdmin ? `
            <button type="button" class="btn btn-warning btn-sm" style="font-weight: 700;" onclick="adminResolveDispute('${order.id}', 'DECLARE_LOSS')">
              🗑️ I-deklara bilang Loss (Bawas sa Singil)
            </button>
            <button type="button" class="btn btn-primary btn-sm" style="font-weight: 700;" onclick="adminResolveDispute('${order.id}', 'REOPEN_PO')">
              🔄 Re-open PO (Ipadala Ulit / Replacement)
            </button>
            <button type="button" class="btn btn-danger btn-sm" style="font-weight: 700;" onclick="adminResolveDispute('${order.id}', 'CANCEL_PO')">
              ❌ Kanselahin ang Buong PO
            </button>
          ` : ''}
        </div>
      </div>
    </div>
  `;
  modal.style.display = 'flex';
}

async function adminResolveDispute(orderId, actionType) {
  if (typeof db === 'undefined' || !db) {
    alert('Walang koneksyon sa database.');
    return;
  }

  const u = getCurrentUser();
  const adminEmail = u ? (u.email || u.name) : 'Admin';

  if (actionType === 'DECLARE_LOSS') {
    if (!await uiConfirm('Kumpirmahin: I-deklara ang sira bilang Inventory Loss at hindi sisingilin sa Branch?')) return;
    try {
      await db.collection('orders').doc(orderId).update({
        status: 'Closed - Declared as Inventory Loss & Deducted from Bill',
        adminResolution: 'Inventory Loss / Shrinkage',
        resolvedBy: adminEmail,
        resolvedAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      logSystemAction('DISPUTE_RESOLVED', `Idineklara ni Admin na Loss ang issue sa PO: ${orderId}`);
      alert('✅ Naitala ang Inventory Loss. Hindi ito sisingilin sa branch.');
      closeDisputeDecisionModal();
    } catch (e) { alert('Error: ' + e.message); }
  } else if (actionType === 'REOPEN_PO') {
    if (!await uiConfirm('Kumpirmahin: I-reopen ang PO upang maihanda muli ng Commissary ang replacement?')) return;
    try {
      await db.collection('orders').doc(orderId).update({
        status: 'Pending Preparation (For Replacement / Re-dispatch)',
        adminResolution: 'Reopened for Replacement',
        resolvedBy: adminEmail,
        resolvedAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      logSystemAction('DISPUTE_RESOLVED', `Ini-reopen ni Admin ang PO para sa replacement: ${orderId}`);
      alert('🔄 Na-reopen ang PO! Makikita na ito muli sa picking queue ng Commissary.');
      closeDisputeDecisionModal();
    } catch (e) { alert('Error: ' + e.message); }
  } else if (actionType === 'CANCEL_PO') {
    if (!await uiConfirm('Kumpirmahin: Kanselahin nang tuluyan ang buong PO?')) return;
    try {
      await db.collection('orders').doc(orderId).update({
        status: 'Cancelled by Admin',
        adminResolution: 'Full PO Cancelled',
        resolvedBy: adminEmail,
        resolvedAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      logSystemAction('DISPUTE_RESOLVED', `Kinansela ni Admin ang buong disputed PO: ${orderId}`);
      alert('❌ Na-kansela na ang buong PO.');
      closeDisputeDecisionModal();
    } catch (e) { alert('Error: ' + e.message); }
  }
}

function closeDisputeDecisionModal() {
  const m = document.getElementById('dispute-decision-modal');
  if (m) m.style.display = 'none';
  if (typeof loadAdminDisputes === 'function') loadAdminDisputes();
  if (typeof loadIncomingOrders === 'function') loadIncomingOrders();
  if (typeof loadBranchDeliveries === 'function') loadBranchDeliveries();
}



// ========================================================
// DATABASE TESTING & TRUNCATE TOOL (ADMIN ONLY)
// ========================================================
async function truncateCollection(collectionName) {
  const u = getCurrentUser();
  if (!u || normalizeRole(u.role) !== 'admin') {
    alert('Access Denied: Si Head Office Admin lamang ang may karapatang mag-truncate ng data.');
    return;
  }
  if (collectionName === 'users') {
    alert('Hindi puwedeng i-truncate ang Users dito para hindi mawala ang mga login.');
    return;
  }

  const conf = await uiPrompt(`⚠️ BABALA SA PAG-TRUNCATE:
Buburahin ang LAHAT ng laman ng "${collectionName}" collection. Hindi magagalaw ang Users at Logins.

Awtomatiko kang makakakuha ng backup file (JSON) bago ito burahin.
I-type ang eksaktong pangalan ng collection ("${collectionName}") upang kumpirmahin:`);
  if (conf !== collectionName) {
    alert('Hindi itinuloy ang pag-truncate.');
    return;
  }

  if (typeof db === 'undefined' || !db) {
    alert('Walang koneksyon sa database.');
    return;
  }

  try {
    const snap = await db.collection(collectionName).get();
    if (snap.empty) {
      alert(`Walang laman ang "${collectionName}". Walang kailangang burahin.`);
      return;
    }

    // 1. AWTOMATIKONG BACKUP (download) bago burahin
    const dump = {
      collection: collectionName,
      exportedAt: new Date().toISOString(),
      exportedBy: u.email || u.name || 'admin',
      count: snap.size,
      docs: snap.docs.map(d => ({ id: d.id, data: d.data() }))
    };
    const blob = new Blob([JSON.stringify(dump, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `BACKUP_${collectionName}_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);

    if (!await uiConfirm(`Na-download ang backup (${snap.size} dokumento).\n\nSigurado ka pa rin bang buburahin ang "${collectionName}"? Hindi na ito mababawi maliban sa backup file.`)) {
      alert('Hindi itinuloy ang pag-truncate. Ligtas pa ang data.');
      return;
    }

    // 2. BURAHIN nang paunti-unti (limit ng Firestore: 500 kada batch)
    const docs = snap.docs;
    for (let i = 0; i < docs.length; i += 400) {
      const batch = db.batch();
      docs.slice(i, i + 400).forEach(d => batch.delete(d.ref));
      await batch.commit();
    }

    logSystemAction('DATA_TRUNCATED', `BINURA ni Admin ang buong collection na: ${collectionName} (${snap.size} docs, may backup file)`);
    uiAlert(`✅ Tagumpay! Na-truncate na ang "${collectionName}" (${snap.size} dokumento ang nabura). Itabi ang backup file.`).then(() => location.reload());
  } catch (err) {
    console.error('Truncate error:', err);
    alert('Error sa pag-truncate: ' + err.message);
  }
}


// ==========================================================================
// PWA SERVICE WORKER & APP UPDATE RESTART ENGINE
// ==========================================================================
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').then(reg => {
      console.log('KusinaERP Service Worker Registered:', reg.scope);

      // Tingnan kung may bagong update habang bukas ang app
      reg.addEventListener('updatefound', () => {
        const newWorker = reg.installing;
        if (newWorker) {
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              notifyUserOfUpdate();
            }
          });
        }
      });
    }).catch(err => {
      console.warn('Service Worker registration failed:', err);
    });
  });
}

async function notifyUserOfUpdate() {
  const confirmUpdate = await uiConfirm('🚀 May bagong update ang KusinaERP!\n\nPindutin ang "OK" upang i-restart at i-apply ang pinakabagong update.');
  if (confirmUpdate) {
    forceAppUpdateAndRestart();
  }
}

// Function na tatawagin kapag pinindot ang "🔄 I-update ang App" button
async function checkAndTriggerAppUpdate() {
  const confirmRestart = await uiConfirm('🔄 I-UPDATE AT I-RESTART ANG APP?\n\nKukunin ng system ang pinakabagong bersyon mula sa server at magre-reload ang app upang ma-apply ang lahat ng pagbabago (Branding, Logo, Code).\n\nNais mo bang magpatuloy?');
  if (!confirmRestart) return;

  await forceAppUpdateAndRestart();
}

async function forceAppUpdateAndRestart() {
  // 1. Burahin ang lahat ng lumang cache
  if ('caches' in window) {
    try {
      const keys = await caches.keys();
      await Promise.all(keys.map(k => caches.delete(k)));
      console.log('Lahat ng cache ay nalinis.');
    } catch (e) {
      console.warn('Error clearing caches:', e);
    }
  }

  // 2. I-update ang Service Worker
  if ('serviceWorker' in navigator) {
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      if (reg) {
        await reg.update();
        if (reg.waiting) {
          reg.waiting.postMessage({ action: 'skipWaiting' });
        }
      }
    } catch (e) {
      console.warn('Error updating service worker:', e);
    }
  }

  // 3. I-reload ang app nang sapilitan (Hard Reload)
  setTimeout(() => {
    window.location.reload(true);
  }, 400);
}



function updateDynamicManifest(brandName, logoBase64) {
  try {
    const appName = brandName || localStorage.getItem('kusina_brand_name') || 'KusinaERP';
    const appIcon = logoBase64 || localStorage.getItem('kusina_brand_logo') || 'https://cdn-icons-png.flaticon.com/512/1046/1046784.png';

    const dynamicManifestObj = {
      name: appName,
      short_name: appName.length > 12 ? appName.substring(0, 12) : appName,
      start_url: './index.html',
      display: 'standalone',
      background_color: '#0f172a',
      theme_color: '#2563eb',
      icons: [
        {
          src: appIcon,
          sizes: '192x192',
          type: 'image/png'
        },
        {
          src: appIcon,
          sizes: '512x512',
          type: 'image/png'
        }
      ]
    };

    const stringManifest = JSON.stringify(dynamicManifestObj);
    const blob = new Blob([stringManifest], { type: 'application/json' });
    const manifestURL = URL.createObjectURL(blob);

    let manifestTag = document.getElementById('dynamic-manifest') || document.querySelector('link[rel="manifest"]');
    if (!manifestTag) {
      manifestTag = document.createElement('link');
      manifestTag.rel = 'manifest';
      manifestTag.id = 'dynamic-manifest';
      document.head.appendChild(manifestTag);
    }
    manifestTag.setAttribute('href', manifestURL);

    // Dynamic Apple Touch Icon
    let appleIcon = document.querySelector('link[rel="apple-touch-icon"]');
    if (!appleIcon) {
      appleIcon = document.createElement('link');
      appleIcon.rel = 'apple-touch-icon';
      document.head.appendChild(appleIcon);
    }
    if (appIcon) {
      appleIcon.href = appIcon;
    }
  } catch (err) {
    console.warn('Error updating dynamic manifest:', err);
  }
}



// ==========================================================================
// PROFILE PHOTO COMPRESSOR & AUTO-SYNC ENGINE
// ==========================================================================
async function previewProfilePhoto(event, previewId, fallbackId) {
  const file = event.target.files && event.target.files[0];
  if (!file) return;

  try {
    // I-compress pababa sa 200x200 max resolution para 25KB-40KB lang ang laki (hindi haharangin ng database)
    const compressedBase64 = await compressProfileImage(file, 200, 200);

    const previewEl = document.getElementById(previewId);
    const fallbackEl = document.getElementById(fallbackId);
    if (previewEl) {
      previewEl.src = compressedBase64;
      previewEl.style.display = 'inline-block';
    }
    if (fallbackEl) fallbackEl.style.display = 'none';

    window.tempSelectedProfilePhoto = compressedBase64;
  } catch (err) {
    alert('⚠️ Error sa pagbasa ng larawan: ' + err.message);
  }
}

function compressProfileImage(file, maxWidth = 200, maxHeight = 200) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (e) => {
      const img = new Image();
      img.src = e.target.result;
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        // JPEG 0.82 quality para mababa sa 50KB ang output
        resolve(canvas.toDataURL('image/jpeg', 0.82));
      };
      img.onerror = reject;
    };
    reader.onerror = reject;
  });
}

async function syncUserProfileFromFirestore() {
  const u = getCurrentUser();
  if (!u || !u.email || typeof db === 'undefined' || !db) return;

  try {
    const doc = await db.collection('users').doc(u.email.toLowerCase()).get();
    if (doc.exists) {
      const data = doc.data();
      let updated = false;

      if (data.photoUrl && data.photoUrl !== u.photoUrl) {
        u.photoUrl = data.photoUrl;
        updated = true;
      }
      if (data.address && data.address !== u.address) {
        u.address = data.address;
        updated = true;
      }
      if (data.name && data.name !== u.name) {
        u.name = data.name;
        updated = true;
      }

      if (updated) setCurrentUser(u);

      if (!sessionStorage.getItem('session_logged')) {
         sessionStorage.setItem('session_logged', 'true');
         logSystemAction('LOGIN', 'User logged in / Session started');
      }


      // Ipakita ang profile photo sa navbar
      if (u.photoUrl) {
        document.querySelectorAll('.user-avatar-img').forEach(img => {
          img.src = u.photoUrl;
          img.style.display = 'inline-block';
        });
        document.querySelectorAll('.user-avatar-initials').forEach(el => {
          el.style.display = 'none';
        });
      }
    }
  } catch (err) {
    console.warn('Profile sync error:', err);
  }
}

function checkRequiredAddressSetup() {
  // Maghintay ng 1.5 segundo upang makumpleto muna ang syncUserProfileFromFirestore()
  setTimeout(() => {
    // Kunin ang pinakabagong data mula sa local storage pagkatapos mag-sync
    const u = getCurrentUser(); 
    if (!u || u.role === 'admin') return;

    // Bubuksan lang ang modal KUNG walang address O walang profile picture
    if (!u.address || u.address.trim() === '' || !u.photoUrl) {
      if (u.role === 'branch' && typeof openBranchProfileModal === 'function') {
        openBranchProfileModal();
      } else if (u.role === 'commissary' && typeof openCommissaryProfileModal === 'function') {
        openCommissaryProfileModal();
      }
    }
  }, 1500);
}

function applyNavbarAvatar() {
  const u = getCurrentUser();
  if (u && u.photoUrl) {
    document.querySelectorAll('.user-avatar-img').forEach(img => {
      img.src = u.photoUrl;
      img.style.display = 'inline-block';
    });
    document.querySelectorAll('.user-avatar-initials').forEach(el => {
      el.style.display = 'none';
    });
  }
}
window.addEventListener('load', applyNavbarAvatar);



// ========================================================
// BRANCH ORDER CANCELLATION & PAHABOL ENGINE
// ========================================================
let activeCancelOrderId = null;
let activePahabolOrderId = null;

function openBranchCancelModal(orderId) {
  activeCancelOrderId = orderId;
  const targetEl = document.getElementById('branch-cancel-target-id');
  if (targetEl) targetEl.innerText = orderId;

  const selectEl = document.getElementById('branch-cancel-reason-select');
  if (selectEl) selectEl.value = 'Accidental na na-place order / Baguhang staff';

  const notesEl = document.getElementById('branch-cancel-custom-notes');
  if (notesEl) notesEl.value = '';

  const othersBox = document.getElementById('branch-cancel-others-box');
  if (othersBox) othersBox.style.display = 'none';

  const modal = document.getElementById('branch-cancel-order-modal');
  if (modal) modal.style.display = 'flex';
}

function closeBranchCancelModal() {
  const modal = document.getElementById('branch-cancel-order-modal');
  if (modal) modal.style.display = 'none';
  activeCancelOrderId = null;
}

function onBranchCancelReasonChange() {
  const selectEl = document.getElementById('branch-cancel-reason-select');
  const othersBox = document.getElementById('branch-cancel-others-box');
  if (selectEl && othersBox) {
    othersBox.style.display = selectEl.value === 'Others' ? 'block' : 'none';
  }
}

async function submitBranchCancelRequest() {
  if (!activeCancelOrderId || !db) return;

  const selectEl = document.getElementById('branch-cancel-reason-select');
  const notesEl = document.getElementById('branch-cancel-custom-notes');
  const reasonVal = selectEl ? selectEl.value : 'Cancelled by Branch';
  const customNotes = notesEl ? notesEl.value.trim() : '';

  const finalReason = reasonVal === 'Others' && customNotes ? customNotes : reasonVal;

  try {
    const docRef = db.collection('orders').doc(activeCancelOrderId);
    const snap = await docRef.get();
    if (!snap.exists) {
      alert('Hindi nahanap ang order.');
      return;
    }

    const currentStatus = snap.data().status || 'Pending Preparation';

    if (currentStatus === 'Pending Preparation') {
      await docRef.update({
        status: 'Cancelled by Branch',
        cancellationReason: finalReason,
        cancelledAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      logSystemAction('ORDER_CANCELLED_BRANCH', `Kinansela ng branch on-the-spot ang PO: ${activeCancelOrderId}`);
      alert('✅ Matagumpay na nakansela ang iyong order on-the-spot.');
    } else {
      await docRef.update({
        cancellationRequested: true,
        cancellationReason: finalReason,
        status: 'Cancellation Requested by Branch',
        cancellationRequestedAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      logSystemAction('ORDER_CANCEL_REQUESTED', `Nag-request ng cancellation ang branch para sa PO: ${activeCancelOrderId}`);
      alert('⚠️ Naipadala na ang Cancellation Request kay Commissary Head. Hihintayin ang kanilang kumpirmasyon.');
    }

    closeBranchCancelModal();
    loadBranchDeliveries();
  } catch (err) {
    alert('Error sa pag-cancel: ' + err.message);
  }
}

// PAHABOL FUNCTIONS
async function openBranchPahabolModal(orderId) {
  activePahabolOrderId = orderId;
  const parentIdEl = document.getElementById('branch-pahabol-parent-id');
  if (parentIdEl) parentIdEl.innerText = orderId;

  // I-reset at i-load ang lahat ng products sa list
  document.getElementById('branch-pahabol-search').value = '';
  document.getElementById('branch-pahabol-fillup-box').style.display = 'none';
  document.getElementById('pahabol-selected-id').value = '';
  document.getElementById('btn-submit-pahabol').disabled = true;
  document.getElementById('branch-pahabol-subtotal').innerText = '₱0.00';

  const listContainer = document.getElementById('branch-pahabol-products-list');
  if (listContainer) {
    if (!branchProducts || branchProducts.length === 0) {
      listContainer.innerHTML = '<div style="padding: 1rem; text-align: center; color: #64748b;">Kinukuha ang catalog...</div>';
      await loadBranchProducts(); // make sure it's loaded
    }
    filterPahabolProducts();
  }

  const modal = document.getElementById('branch-pahabol-modal');
  if (modal) modal.style.display = 'flex';
}

function closeBranchPahabolModal() {
  const modal = document.getElementById('branch-pahabol-modal');
  if (modal) modal.style.display = 'none';
  activePahabolOrderId = null;
}

function filterPahabolProducts() {
  const query = document.getElementById('branch-pahabol-search')?.value.toLowerCase().trim() || '';
  const container = document.getElementById('branch-pahabol-products-list');
  if (!container) return;

  if (branchProducts.length === 0) {
    container.innerHTML = '<div style="padding: 1rem; text-align: center; color: #94a3b8;">Walang nakitang produkto sa database.</div>';
    return;
  }

  const filtered = branchProducts.filter(p => {
    const name = (p.itemName || '').toLowerCase();
    const code = (p.itemCode || '').toLowerCase();
    const pos = (p.posCode || '').toLowerCase();
    const bar = (p.barcode || '').toLowerCase();
    return name.includes(query) || code.includes(query) || pos.includes(query) || bar.includes(query);
  });

  if (filtered.length === 0) {
    container.innerHTML = `<div style="padding: 1rem; text-align: center; color: #94a3b8;">Walang produktong tumugma sa "${query}".</div>`;
    return;
  }

  let html = '';
  filtered.forEach(p => {
    const wPrice = parseFloat(p.wholePrice || 0).toLocaleString('en-PH', { style: 'currency', currency: 'PHP' });
    const lPrice = parseFloat(p.loosePrice || 0).toLocaleString('en-PH', { style: 'currency', currency: 'PHP' });
    const sap = p.sapCode || p.itemCode || '--';
    
    html += `
      <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.6rem 0.85rem; border-bottom: 1px solid #f1f5f9; cursor: pointer;" onclick="onBranchPahabolProductSelect('${p.id}')">
        <div>
          <b style="color: #1e293b; font-size: 0.9rem;">${p.itemName || p.id}</b>
          <div style="font-size: 0.75rem; color: #64748b; margin-top: 2px;">
            <span style="font-weight: 600;">${sap}</span> | ${wPrice}/${p.wholeUOM || 'W'}
          </div>
        </div>
        <div>
          <button type="button" class="btn btn-primary btn-sm" style="padding: 0.25rem 0.5rem; font-size: 0.75rem;">Piliin ➔</button>
        </div>
      </div>
    `;
  });

  container.innerHTML = html;
}

function onBranchPahabolProductSelect(pId) {
  const prod = branchProducts.find(p => p.id === pId);
  if (!prod) return;

  const fillupBox = document.getElementById('branch-pahabol-fillup-box');
  fillupBox.style.display = 'block';
  document.getElementById('pahabol-selected-id').value = prod.id;
  document.getElementById('btn-submit-pahabol').disabled = false;

  document.getElementById('pahabol-selected-name').innerText = prod.itemName || prod.id;
  document.getElementById('pahabol-selected-station').innerText = `📍 ${prod.storageStation || 'General'}`;

  const guideEl = document.getElementById('branch-pahabol-uom-guide');
  if (guideEl) {
    const wholePrice = parseFloat(prod.wholePrice || 0).toFixed(2);
    const loosePrice = parseFloat(prod.loosePrice || 0).toFixed(2);
    guideEl.style.display = 'block';
    guideEl.innerHTML = `<b>Rates:</b> 1 ${prod.wholeUOM || 'Whole'} (₱${wholePrice}) &nbsp;|&nbsp; 1 ${prod.looseUOM || 'Loose'} (₱${loosePrice})`;

    document.getElementById('pahabol-whole-label').innerText = `Whole (${prod.wholeUOM || 'Whole'}):`;
    document.getElementById('pahabol-loose-label').innerText = `Loose (${prod.looseUOM || 'Loose'}):`;
  }

  document.getElementById('branch-pahabol-whole-qty').value = 0;
  document.getElementById('branch-pahabol-loose-qty').value = 0;
  calcPahabolSubtotal();
}

function calcPahabolSubtotal() {
  const pId = document.getElementById('pahabol-selected-id')?.value;
  const prod = branchProducts.find(p => p.id === pId);

  const wQty = parseFloat(document.getElementById('branch-pahabol-whole-qty')?.value || 0) || 0;
  const lQty = parseFloat(document.getElementById('branch-pahabol-loose-qty')?.value || 0) || 0;

  let total = 0;
  if (prod) {
    total = (wQty * parseFloat(prod.wholePrice || 0)) + (lQty * parseFloat(prod.loosePrice || 0));
  }
  const subtotalEl = document.getElementById('branch-pahabol-subtotal');
  if (subtotalEl) subtotalEl.innerText = `₱${total.toFixed(2)}`;
}

async function submitBranchPahabol() {
  if (!activePahabolOrderId || !db) return;

  const pId = document.getElementById('pahabol-selected-id')?.value;
  const prod = branchProducts.find(p => p.id === pId);

  const wQty = parseFloat(document.getElementById('branch-pahabol-whole-qty')?.value || 0) || 0;
  const lQty = parseFloat(document.getElementById('branch-pahabol-loose-qty')?.value || 0) || 0;
  const note = document.getElementById('branch-pahabol-note')?.value.trim() || '';

  if (!prod) {
    alert('Mangyaring pumili ng produktong ihahabol mula sa listahan.');
    return;
  }
  if (wQty <= 0 && lQty <= 0) {
    alert('Maglagay ng dami (quantity) para sa whole o loose bago isubmit.');
    return;
  }

  const subtotal = (wQty * parseFloat(prod.wholePrice || 0)) + (lQty * parseFloat(prod.loosePrice || 0));

  try {
    const pahabolItem = {
      productId: prod.id,
      itemCode: prod.itemCode || prod.sapCode || prod.id,
      itemName: prod.itemName || prod.id,
      storageStation: prod.storageStation || 'General',
      wholeUOM: prod.wholeUOM || 'Whole',
      looseUOM: prod.looseUOM || 'Loose',
      wholePrice: parseFloat(prod.wholePrice || 0),
      loosePrice: parseFloat(prod.loosePrice || 0),
      requestedWholeQty: wQty,
      requestedLooseQty: lQty,
      allocatedWholeQty: wQty,
      allocatedLooseQty: lQty,
      subtotal: subtotal,
      reasonNote: note
    };

    await db.collection('orders').doc(activePahabolOrderId).update({
      pahabol: pahabolItem,
      status: 'With Pending Add-on / Pahabol',
      pahabolRequestedAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    logSystemAction('PAHABOL_REQUESTED', `Nag-request ng pahabol sa PO: ${activePahabolOrderId}. Item: ${prod.itemName}`);
    alert(`🚀 Matagumpay na naisumite ang Pahabol para sa Order ${activePahabolOrderId}!`);
    closeBranchPahabolModal();
    loadBranchDeliveries();
  } catch (err) {
    alert('Error sa pagsusumite ng pahabol: ' + err.message);
  }
}


async function loadCommissaryTeam() {
  const tbody = document.getElementById('team-directory-tbody');
  if (!tbody || typeof db === 'undefined') return;

  try {
    const snap = await db.collection('commissary_team').orderBy('role').get();
    commissaryTeamList = [];
    
    if (snap.empty) {
      tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: #94a3b8; padding: 1.5rem;">Wala pang naka-save na tauhan.</td></tr>';
      return;
    }

    let html = '';
    snap.forEach(doc => {
      const d = doc.data();
      commissaryTeamList.push({ id: doc.id, ...d });
      
      const roleText = d.role === 'stockman' ? '📦 Stockman / Packer' : (d.role === 'checker' ? '🔍 QA Checker' : '🚚 Driver');
      const defBadge = d.isDefault ? `<span class="badge badge-warning">⭐ Default #1</span>` : `<span style="color: #cbd5e1;">--</span>`;
      
      html += `<tr>
        <td><b>${d.name}</b></td>
        <td>${roleText}</td>
        <td>${d.note || '--'}</td>
        <td style="text-align: center;">${defBadge}</td>
        <td style="text-align: center;">
          <div style="display: flex; gap: 0.35rem; justify-content: center;">
            <button class="btn btn-sm btn-danger" onclick="deleteTeamMember('${doc.id}')">🗑️ Burahin</button>
          </div>
        </td>
      </tr>`;
    });
    tbody.innerHTML = html;
  } catch (err) {
    console.error("Error loading team:", err);
  }
}

async function saveTeamMember() {
  const name = document.getElementById('team-name')?.value.trim();
  const role = document.getElementById('team-role')?.value;
  const note = document.getElementById('team-note')?.value.trim() || '';
  const isDef = document.getElementById('team-default')?.checked || false;

  if (!name) {
    alert("I-type ang pangalan ng tauhan.");
    return;
  }

  try {
    // Kung default, bawiin ang pagiging default ng iba sa same role
    if (isDef) {
      const snap = await db.collection('commissary_team').where('role', '==', role).where('isDefault', '==', true).get();
      const batch = db.batch();
      snap.forEach(doc => {
        batch.update(doc.ref, { isDefault: false });
      });
      await batch.commit();
    }

    await db.collection('commissary_team').add({
      name: name,
      role: role,
      note: note,
      isDefault: isDef,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    logSystemAction('TEAM_MEMBER_ADDED', `Nagdagdag ng tauhan sa directory: ${name} (${role})`);
    alert("✅ Na-save ang bagong tauhan!");
    if(document.getElementById('team-name')) document.getElementById('team-name').value = '';
    if(document.getElementById('team-note')) document.getElementById('team-note').value = '';
    loadCommissaryTeam();
  } catch (e) {
    alert("Error: " + e.message);
  }
}

async function deleteTeamMember(id) {
  if (!await uiConfirm("Siguradong burahin ang tauhan na ito?")) return;
  try {
    await db.collection('commissary_team').doc(id).delete();
    loadCommissaryTeam();
  } catch(e) {
    alert("Error: " + e.message);
  }
}

function toggleLogisticsFields() {
  const method = document.querySelector('input[name="delivery_method"]:checked')?.value;
  const inhouseBox = document.getElementById('logistics-inhouse-box');
  const tplBox = document.getElementById('logistics-3pl-box');
  
  if (method === '3pl') {
    if (inhouseBox) inhouseBox.style.display = 'none';
    if (tplBox) tplBox.style.display = 'block';
  } else {
    if (inhouseBox) inhouseBox.style.display = 'block';
    if (tplBox) tplBox.style.display = 'none';
  }
}

function calc3PLTotal() {
  const fee = parseFloat(document.getElementById('tpl-fee')?.value || 0);
  const toll = parseFloat(document.getElementById('tpl-toll')?.value || 0);
  const tip = parseFloat(document.getElementById('tpl-tip')?.value || 0);
  const tot = fee + toll + tip;
  
  const el = document.getElementById('tpl-total-cost');
  if (el) el.innerText = `₱${tot.toFixed(2)}`;
}



// ========================================================
// COMMISSARY CANCELLATION LOGIC (RESTORE INVENTORY)
// ========================================================
async function cancelOrderFromCommissary() {
  if (!activeCommissaryOrderId || !db) return;
  
  const order = currentOrders.find(o => o.id === activeCommissaryOrderId);
  if (!order) return;

  if (order.status.includes('Cancelled') || order.status.includes('Completed')) {
    alert('Hindi na maaaring i-cancel ang order na ito dahil nasa status na itong: ' + order.status);
    return;
  }

  const reason = await uiPrompt("Ano ang dahilan ng pag-cancel ng order na ito mula sa planta?");
  if (!reason) return;

  if (!await uiConfirm(`Sigurado ka bang gusto mong i-cancel ang PO-${order.orderId || order.id}?
Ibabalik sa inventory ang stock kung nabawas na ito.`)) return;

  try {
    const res = await applyOrderStock(activeCommissaryOrderId, 'restock', {
      status: 'Cancelled by Commissary',
      cancellationReason: reason,
      cancelledByRole: 'Commissary Head'
    });
    logSystemAction('ORDER_CANCELLED_COMMISSARY', `Kinansela mula sa planta ang PO: ${activeCommissaryOrderId}. Dahilan: ${reason}. ${res.applied ? 'Naibalik ang stock.' : 'Walang naibawas na stock.'}`);
    alert(res.applied ? '✅ Nakansela na ang order. Naibalik na sa inventory ang mga stocks.' : '✅ Nakansela na ang order. (Wala pang naibawas na stock kaya walang ibinalik.)');
    closeCommissaryOrderModal();
    loadIncomingOrders();
    if (typeof loadCommissaryInventory === 'function') loadCommissaryInventory();
  } catch (err) {
    alert("Error sa pag-cancel: " + err.message);
  }
}

async function commissaryAcceptCancel() {
  if (!activeCommissaryOrderId || !db) return;
  const order = currentOrders.find(o => o.id === activeCommissaryOrderId);
  if (!order) return;

  if (!await uiConfirm(`Tatanggapin ba ang Cancellation Request ng Branch para sa PO-${order.orderId || order.id}?`)) return;

  try {
    const res = await applyOrderStock(activeCommissaryOrderId, 'restock', {
      status: 'Cancelled & Approved by Commissary',
      cancellationRequested: false
    });
    logSystemAction('CANCEL_REQUEST_APPROVED', `In-approve ng commissary ang cancel request para sa PO: ${activeCommissaryOrderId}. ${res.applied ? 'Naibalik ang stock.' : 'Walang naibawas na stock.'}`);
    alert(res.applied ? '✅ Na-approve ang pag-cancel ng branch. Naibalik na sa inventory ang mga naibawas.' : '✅ Na-approve ang pag-cancel ng branch. (Wala pang naibawas na stock.)');
    closeCommissaryOrderModal();
    loadIncomingOrders();
    if (typeof loadCommissaryInventory === 'function') loadCommissaryInventory();
  } catch (err) {
    alert("Error sa pag-approve ng cancel: " + err.message);
  }
}

async function commissaryRejectCancel() {
  if (!activeCommissaryOrderId || !db) return;
  
  if (!await uiConfirm('Tanggihan ang cancellation at ituloy ang pag-prepare ng order?')) return;

  try {
    await db.collection('orders').doc(activeCommissaryOrderId).update({
      cancellationRequested: false, // dismiss the request
      cancellationReason: 'Rejected by Commissary: Itutuloy ang delivery',
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    logSystemAction('CANCEL_REQUEST_REJECTED', `Ni-reject ng commissary ang cancel request ng PO: ${activeCommissaryOrderId}`);
    alert('Na-reject ang cancel request. Ituloy ang paghahanda ng order.');
    closeCommissaryOrderModal();
    loadIncomingOrders();
  } catch (err) {
    alert("Error: " + err.message);
  }
}

async function commissaryAcceptPahabol() {
  // Logic to merge pahabol items into main items
  if (!activeCommissaryOrderId || !db) return;
  const order = currentOrders.find(o => o.id === activeCommissaryOrderId);
  if (!order || !order.pahabol) return;

  if (!await uiConfirm('Idagdag (i-merge) ang pahabol item sa orihinal na order basket at ibawas sa inventory?')) return;

  try {
    const pahabol = order.pahabol;
    let newItems = [...(order.items || [])];
    
    // Check if pahabol item already exists in cart, if yes, increment
    const existingIdx = newItems.findIndex(i => i.itemCode === pahabol.itemCode);
    if (existingIdx !== -1) {
      newItems[existingIdx].wholeQty = parseFloat(newItems[existingIdx].wholeQty || 0) + parseFloat(pahabol.requestedWholeQty || 0);
      newItems[existingIdx].looseQty = parseFloat(newItems[existingIdx].looseQty || 0) + parseFloat(pahabol.requestedLooseQty || 0);
      newItems[existingIdx].subtotal = parseFloat(newItems[existingIdx].subtotal || 0) + parseFloat(pahabol.subtotal || 0);
    } else {
      newItems.push({
        itemCode: pahabol.itemCode,
        itemName: pahabol.itemName,
        storageStation: pahabol.storageStation || 'General',
        wholeQty: parseFloat(pahabol.requestedWholeQty || 0),
        wholeUOM: pahabol.wholeUOM || 'Whole',
        wholePrice: parseFloat(pahabol.wholePrice || 0),
        looseQty: parseFloat(pahabol.requestedLooseQty || 0),
        looseUOM: pahabol.looseUOM || 'Loose',
        loosePrice: parseFloat(pahabol.loosePrice || 0),
        subtotal: parseFloat(pahabol.subtotal || 0)
      });
    }

    const newTotal = parseFloat(order.totalAmount || 0) + parseFloat(pahabol.subtotal || 0);

    const batch = db.batch();
    const orderRef = db.collection('orders').doc(activeCommissaryOrderId);
    
    // Ibawas sa inventory LAMANG kung nabawas na ang order mismo (para pare-pareho sa cancel/restock)
    if (order.stockDeducted) {
      const prodRef = db.collection('products').doc(pahabol.itemCode);
      const pw = parseFloat(pahabol.requestedWholeQty || 0), pl = parseFloat(pahabol.requestedLooseQty || 0);
      batch.update(prodRef, {
        stockWhole: firebase.firestore.FieldValue.increment(-pw),
        stockLoose: firebase.firestore.FieldValue.increment(-pl)
      });
      addStockMovementToBatch(batch, pahabol.itemCode, pahabol.itemName, 'PAHABOL_DEDUCT', activeCommissaryOrderId, -pw, -pl);
    }

    batch.update(orderRef, {
      items: newItems,
      totalAmount: newTotal,
      pahabol: firebase.firestore.FieldValue.delete(),
      status: order.status.replace('With Pending Add-on / Pahabol', '').trim() || 'Preparing at Stations',
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    await batch.commit();
    logSystemAction('PAHABOL_APPROVED', `In-approve ng commissary ang pahabol sa PO: ${activeCommissaryOrderId}`);
    alert('✅ Na-merge na ang pahabol sa order!');
    closeCommissaryOrderModal();
    loadIncomingOrders();
    loadCommissaryInventory();
  } catch(e) {
    alert("Error: " + e.message);
  }
}

async function commissaryRejectPahabol() {
  if (!activeCommissaryOrderId || !db) return;
  if (!await uiConfirm('Tanggihan ang pahabol request?')) return;

  try {
    await db.collection('orders').doc(activeCommissaryOrderId).update({
      pahabol: firebase.firestore.FieldValue.delete(),
      status: 'Preparing at Stations',
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    logSystemAction('PAHABOL_REJECTED', `Ni-reject ng commissary ang pahabol sa PO: ${activeCommissaryOrderId}`);
    alert('Tinanggihan ang pahabol.');
    closeCommissaryOrderModal();
    loadIncomingOrders();
  } catch(e) { alert("Error: " + e.message); }
}


// ========================================================
// SOLID BUTTON ACTIONS (REPLACING SWIPE SLIDERS)
// ========================================================
async function commissaryTakeOrder() {
  if (!activeCommissaryOrderId || !db) return;
  try {
    const order = currentOrders.find(o => o.id === activeCommissaryOrderId);

    // Babala kung kulang ang stock (si commissary ang magdedesisyon kung itutuloy)
    if (order && !order.stockDeducted) {
      const short = await getOrderStockShortages(order);
      if (short.length && !await uiConfirm(`⚠️ KULANG ANG STOCK SA:\n${formatShortages(short)}\n\nITULOY pa rin ang pag-accept? (Magiging negative ang stock ng mga item na ito.)`)) return;
    }

    const siInput = document.getElementById('com-modal-si-number');
    const poInput = document.getElementById('com-modal-po-number');
    const typedSI = (siInput && !siInput.disabled) ? siInput.value.trim() : '';
    const poVal = (poInput && !poInput.disabled) ? poInput.value.trim() : '';

    // Iwasan ang dobleng SI number
    if (typedSI && !(order && order.siNumber)) {
      const dup = await db.collection('orders').where('siNumber', '==', typedSI).get();
      if (dup.docs.some(d => d.id !== activeCommissaryOrderId)) {
        alert(`⚠️ Ginamit na ang SI number na ${typedSI} sa ibang order. Burahin ang laman para awtomatikong bigyan ng susunod na SI.`);
        return;
      }
    }

    const res = await applyOrderStock(activeCommissaryOrderId, 'deduct',
      { status: 'Preparing at Stations' },
      { allocateSI: true, typedSI: typedSI, poVal: poVal });

    logSystemAction('ORDER_ACCEPTED', `Tinanggap at inihahanda na sa planta ang PO: ${activeCommissaryOrderId}${res.siNumber ? ' | ' + res.siNumber : ''}. ${res.applied ? 'Nabawas na ang stock.' : 'Naibawas na dati ang stock.'}`);
    alert('✅ Tinanggap na ang order para ihanda!' + (res.applied ? ' Nabawas na sa inventory.' : '') + (res.missing ? `\n⚠️ ${res.missing} item ang walang product record kaya hindi nabawasan.` : ''));
    closeCommissaryOrderModal();
    loadIncomingOrders();
    if (typeof loadCommissaryInventory === 'function') loadCommissaryInventory();
  } catch (err) {
    alert('Error: ' + err.message);
  }
}

async function commissaryDispatchOrder() {
  if (!activeCommissaryOrderId || !db) return;
  
  const order = currentOrders.find(o => o.id === activeCommissaryOrderId);
  if (order && (order.status.includes('Dispatched') || order.status.includes('Completed') || order.status.includes('Cancel') || order.status.includes('Closed'))) {
    alert('Hindi na maaaring i-dispatch ang order na ito dahil ang status nito ay: ' + order.status);
    return;
  }
  
  const is3PL = document.querySelector('input[name="delivery_method"]:checked')?.value === '3pl';
  let drvName = '';
  
  if (is3PL) {
    const plat = document.getElementById('tpl-provider')?.value || '';
    const rn = document.getElementById('tpl-rider-name')?.value || '';
    const pl = document.getElementById('tpl-plate')?.value || '';
    if (!rn || !pl) {
      alert('Mangyaring ilagay ang pangalan ng rider at plaka.');
      return;
    }
    drvName = `[3PL - ${plat}] ${rn} (${pl})`;
  } else {
    drvName = document.getElementById('com-inhouse-driver')?.value || 'Company Driver';
  }

  const stman = document.getElementById('com-verify-stockman')?.value || 'Stockman';
  const sthead = document.getElementById('com-verify-stockhead')?.value || 'Stock Head';

  if (!await uiConfirm(`I-dispatch na ang order na ito gamit ang: ${drvName}?`)) return;

  try {
    await db.collection('orders').doc(activeCommissaryOrderId).update({
      status: 'Dispatched / En Route',
      driverName: drvName,
      stockmanName: stman,
      stockheadName: sthead,
      dispatchedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    logSystemAction('ORDER_DISPATCHED', `Na-dispatch ang PO: ${activeCommissaryOrderId} gamit ang: ${drvName}`);
    alert('🚚 Matagumpay na na-dispatch ang order!');
    closeCommissaryOrderModal();
    loadIncomingOrders();
  } catch (err) {
    alert('Error: ' + err.message);
  }
}

function branchTruckArrived() {
  document.getElementById('br-stage-arrival').style.display = 'none';
  document.getElementById('br-stage-checklist').style.display = 'block';
  document.getElementById('br-stage-sign').style.display = 'block';
  renderBranchReceivingChecklist();
  initBranchRecvCanvas();
}



function compressEvidencePhoto(file, maxWidth = 1024, maxHeight = 1024) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (e) => {
      const img = new Image();
      img.src = e.target.result;
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        // JPEG 0.85 quality para mas malinaw ang ebidensya pero mababa pa rin ang file size (~100-200kb)
        resolve(canvas.toDataURL('image/jpeg', 0.85));
      };
      img.onerror = reject;
    };
    reader.onerror = reject;
  });
}

function previewDamagePhoto(event) {
  const file = event.target.files && event.target.files[0];
  if (!file) return;
  compressEvidencePhoto(file).then(base64 => {
    window.tempDamagePhoto = base64;
    const imgEl = document.getElementById('damage-photo-preview');
    const box = document.getElementById('damage-photo-preview-container');
    if (imgEl && box) {
      imgEl.src = base64;
      box.style.display = 'block';
    }
  });
}

function previewLateReturnPhoto(event) {
  const file = event.target.files && event.target.files[0];
  if (!file) return;
  compressEvidencePhoto(file).then(base64 => {
    window.tempLateReturnPhoto = base64;
    const imgEl = document.getElementById('late-return-photo-preview');
    const box = document.getElementById('late-return-photo-container');
    if (imgEl && box) {
      imgEl.src = base64;
      box.style.display = 'block';
    }
  });
}



// ========================================================
// SPOILAGE REPORTING & ADMIN APPROVAL ENGINE
// ========================================================
function openCommissarySpoilageModal() {
  document.getElementById('comm-spoilage-search').value = '';
  document.getElementById('comm-spoilage-fillup-box').style.display = 'none';
  document.getElementById('spoilage-selected-id').value = '';
  document.getElementById('btn-submit-spoilage').disabled = true;

  const listContainer = document.getElementById('comm-spoilage-products-list');
  if (listContainer) {
    filterSpoilageProducts();
  }
  
  const modal = document.getElementById('commissary-spoilage-modal');
  if (modal) modal.style.display = 'flex';
}

function closeSpoilageModal() {
  const modal = document.getElementById('commissary-spoilage-modal');
  if (modal) modal.style.display = 'none';
}

function filterSpoilageProducts() {
  const query = document.getElementById('comm-spoilage-search')?.value.toLowerCase().trim() || '';
  const container = document.getElementById('comm-spoilage-products-list');
  if (!container) return;

  if (currentInventory.length === 0) {
    container.innerHTML = '<div style="padding: 1rem; text-align: center; color: #94a3b8;">Walang produkto sa inventory.</div>';
    return;
  }

  const filtered = currentInventory.filter(p => {
    const name = (p.itemName || '').toLowerCase();
    const code = (p.itemCode || '').toLowerCase();
    const pos = (p.posCode || '').toLowerCase();
    const bar = (p.barcode || '').toLowerCase();
    return name.includes(query) || code.includes(query) || pos.includes(query) || bar.includes(query);
  });

  if (filtered.length === 0) {
    container.innerHTML = `<div style="padding: 1rem; text-align: center; color: #94a3b8;">Walang produktong tumugma sa "${query}".</div>`;
    return;
  }

  let html = '';
  filtered.forEach(p => {
    const sap = p.sapCode || p.itemCode || '--';
    html += `
      <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.6rem 0.85rem; border-bottom: 1px solid #f1f5f9; cursor: pointer;" onclick="onSpoilageProductSelect('${p.id}')">
        <div>
          <b style="color: #1e293b; font-size: 0.9rem;">${p.itemName || p.id}</b>
          <div style="font-size: 0.75rem; color: #64748b; margin-top: 2px;">
            <span style="font-weight: 600;">${sap}</span> | Stock: ${p.stockWhole || 0}${p.wholeUOM || 'W'}, ${p.stockLoose || 0}${p.looseUOM || 'L'}
          </div>
        </div>
        <div>
          <button type="button" class="btn btn-danger btn-sm" style="padding: 0.25rem 0.5rem; font-size: 0.75rem;">Report Sira ➔</button>
        </div>
      </div>
    `;
  });
  container.innerHTML = html;
}

function onSpoilageProductSelect(pId) {
  const prod = currentInventory.find(p => p.id === pId);
  if (!prod) return;

  const fillupBox = document.getElementById('comm-spoilage-fillup-box');
  fillupBox.style.display = 'block';
  document.getElementById('spoilage-selected-id').value = prod.id;
  document.getElementById('btn-submit-spoilage').disabled = false;

  document.getElementById('spoilage-selected-name').innerText = prod.itemName || prod.id;
  document.getElementById('spoilage-selected-station').innerText = `📍 ${prod.storageStation || 'General'}`;

  document.getElementById('spoilage-whole-label').innerText = `Whole (${prod.wholeUOM || 'W'}):`;
  document.getElementById('spoilage-loose-label').innerText = `Loose (${prod.looseUOM || 'L'}):`;
  
  document.getElementById('spoilage-whole-qty').value = 0;
  document.getElementById('spoilage-loose-qty').value = 0;
  
  window.tempSpoilagePhoto = null;
  const imgEl = document.getElementById('spoilage-photo-preview');
  if(imgEl) { imgEl.src = ''; document.getElementById('spoilage-photo-preview-container').style.display = 'none'; }
}

function previewSpoilagePhoto(event) {
  const file = event.target.files && event.target.files[0];
  if (!file) return;
  compressEvidencePhoto(file).then(base64 => {
    window.tempSpoilagePhoto = base64;
    const imgEl = document.getElementById('spoilage-photo-preview');
    const box = document.getElementById('spoilage-photo-preview-container');
    if (imgEl && box) {
      imgEl.src = base64;
      box.style.display = 'block';
    }
  });
}

async function submitSpoilageReport() {
  if (!db) return;
  const pId = document.getElementById('spoilage-selected-id')?.value;
  const prod = currentInventory.find(p => p.id === pId);
  if (!prod) return;

  const wQty = parseFloat(document.getElementById('spoilage-whole-qty')?.value || 0);
  const lQty = parseFloat(document.getElementById('spoilage-loose-qty')?.value || 0);
  const reason = document.getElementById('spoilage-reason')?.value;
  const notes = document.getElementById('spoilage-notes')?.value.trim();
  
  if (wQty <= 0 && lQty <= 0) {
    alert('Maglagay ng bilang ng nasira.');
    return;
  }
  if (!window.tempSpoilagePhoto) {
    alert('⚠️ Kinakailangan ang Photo Evidence bago maipadala kay Admin ang Spoilage Report.');
    return;
  }

  const user = getCurrentUser();
  
  try {
    await db.collection('spoilage_requests').add({
      productId: prod.id,
      itemCode: prod.itemCode || prod.sapCode || prod.id,
      itemName: prod.itemName,
      wholeQty: wQty,
      wholeUOM: prod.wholeUOM || 'W',
      looseQty: lQty,
      looseUOM: prod.looseUOM || 'L',
      reason: reason,
      notes: notes,
      photoProof: window.tempSpoilagePhoto,
      reportedBy: user ? (user.name || user.email) : 'Commissary',
      status: 'Pending Admin Approval',
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    
    // Log
    await logSystemAction('SPOILAGE_REPORTED', `Nag-file ng report para sa ${wQty} ${prod.wholeUOM}, ${lQty} ${prod.looseUOM} ng ${prod.itemName}. Dahilan: ${reason}`);

    alert('✅ Naipadala na ang Spoilage Report kay Admin! Hindi muna mababawasan ang inventory hangga\'t hindi nila ina-approve.');
    closeSpoilageModal();
  } catch (err) {
    alert('Error: ' + err.message);
  }
}

// ADMIN SIDE SPOILAGE
async function loadAdminSpoilageRequests() {
  const tbody = document.getElementById('admin-spoilage-tbody');
  if (!tbody || !db) return;

  try {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align: center;">Kinukuha ang reports...</td></tr>';
    const snap = await db.collection('spoilage_requests').orderBy('createdAt', 'desc').limit(30).get();

    if (snap.empty) {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; color: #94a3b8; padding: 1.5rem;">Walang pending na Spoilage Request.</td></tr>';
      return;
    }

    let html = '';
    snap.forEach(doc => {
      const d = doc.data();
      const dateStr = d.createdAt ? new Date(d.createdAt.toDate ? d.createdAt.toDate() : d.createdAt).toLocaleString() : 'N/A';
      const qtyStr = `${d.wholeQty > 0 ? d.wholeQty + ' ' + d.wholeUOM : ''} ${d.looseQty > 0 ? d.looseQty + ' ' + d.looseUOM : ''}`;
      
      const photoHtml = d.photoProof ? `<img src="${d.photoProof}" style="width:50px; height:50px; object-fit:cover; border-radius:4px; cursor:zoom-in;" onclick="this.classList.toggle('zoomed-img')">` : 'Walang Litrato';
      
      let actions = '';
      if (d.status === 'Pending Admin Approval') {
        actions = `
          <div style="display:flex; gap:0.25rem;">
            <button class="btn btn-sm btn-success" style="font-weight:700;" onclick="approveSpoilageRequest('${doc.id}', '${d.productId}', ${d.wholeQty}, ${d.looseQty}, '${d.itemName}')">✅ Approve & Deduct</button>
            <button class="btn btn-sm btn-danger" onclick="rejectSpoilageRequest('${doc.id}')">❌ Reject</button>
          </div>
        `;
      } else {
        actions = `<span class="badge badge-secondary">Resolved</span>`;
      }

      html += `<tr>
        <td><b>${dateStr}</b><br><small>${d.reportedBy}</small></td>
        <td><b>${d.itemName}</b><br><small>${d.itemCode}</small></td>
        <td><b style="color:#ef4444;">${qtyStr}</b></td>
        <td><b>${d.reason}</b><br><small>${d.notes}</small></td>
        <td style="text-align:center;">${photoHtml}</td>
        <td><span class="badge ${d.status.includes('Pending') ? 'badge-warning' : (d.status.includes('Approve') ? 'badge-danger' : 'badge-secondary')}">${d.status}</span></td>
        <td>${actions}</td>
      </tr>`;
    });
    tbody.innerHTML = html;
  } catch (err) {
    console.error(err);
  }
}

async function approveSpoilageRequest(reqId, productId, wQty, lQty, itemName) {
  if (!await uiConfirm(`Kumpirmahin: I-approve at I-DEDUCT ang ${wQty}W / ${lQty}L ng ${itemName} sa inventory ng planta?`)) return;
  if (!db) return;
  
  try {
    const reqRef = db.collection('spoilage_requests').doc(reqId);
    const prodRef = db.collection('products').doc(productId);
    await db.runTransaction(async tx => {
      const reqSnap = await tx.get(reqRef);
      if (!reqSnap.exists) throw new Error('Hindi nahanap ang spoilage report.');
      if (reqSnap.data().status !== 'Pending Admin Approval') throw new Error('Na-resolve na ang report na ito dati pa (hindi na puwedeng ibawas ulit).');
      const prodSnap = await tx.get(prodRef);
      if (!prodSnap.exists) throw new Error('Walang product record para sa item na ito.');
      tx.update(reqRef, {
        status: 'Approved & Deducted by Admin',
        resolvedAt: firebase.firestore.FieldValue.serverTimestamp(),
        resolvedBy: getCurrentUser()?.name || 'Admin'
      });
      tx.update(prodRef, {
        stockWhole: firebase.firestore.FieldValue.increment(-wQty),
        stockLoose: firebase.firestore.FieldValue.increment(-lQty)
      });
      tx.set(db.collection('stock_movements').doc(), stockMovementDoc(productId, itemName, 'SPOILAGE', reqId, -wQty, -lQty));
    });
    await logSystemAction('SPOILAGE_APPROVED', `In-approve ni Admin ang spoilage deduction para sa ${wQty}W, ${lQty}L ng ${itemName}`);
    
    alert('✅ Na-approve at naibawas na sa inventory!');
    loadAdminSpoilageRequests();
  } catch(e) { alert("Error: " + e.message); }
}

async function rejectSpoilageRequest(reqId) {
  if (!await uiConfirm('I-reject ang spoilage report na ito?')) return;
  if (!db) return;
  
  try {
    await db.collection('spoilage_requests').doc(reqId).update({
      status: 'Rejected by Admin',
      resolvedAt: firebase.firestore.FieldValue.serverTimestamp(),
      resolvedBy: getCurrentUser()?.name || 'Admin'
    });
    await logSystemAction('SPOILAGE_REJECTED', `Ni-reject ni Admin ang spoilage report id: ${reqId}`);
    alert('❌ Na-reject ang report.');
    loadAdminSpoilageRequests();
  } catch(e) { alert("Error: " + e.message); }
}

// ========================================================
// UNIVERSAL SYSTEM AUDIT LOGS
// ========================================================
let allSystemLogs = [];

async function logSystemAction(actionName, details) {
  if (typeof db === 'undefined' || !db) return;
  const u = getCurrentUser();
  const userStr = u ? (`${u.role.toUpperCase()} - ${u.name || u.email}`) : 'System';
  try {
    await db.collection('activity_logs').add({
      action: actionName,
      details: details,
      user: userStr,
      timestamp: firebase.firestore.FieldValue.serverTimestamp()
    });
  } catch (err) {
    console.warn("Audit Log Failed:", err);
  }
}

async function loadSystemAuditLogs() {
  const tbody = document.getElementById('admin-logs-tbody');
  if (!tbody || !db) return;

  try {
    tbody.innerHTML = '<tr><td colspan="4" style="text-align: center;">Kinukuha ang logs...</td></tr>';
    const snap = await db.collection('activity_logs').orderBy('timestamp', 'desc').limit(100).get();
    
    allSystemLogs = [];
    snap.forEach(doc => { allSystemLogs.push({ id: doc.id, ...doc.data() }); });
    
    filterSystemAuditLogs();
  } catch (e) {
    console.error(e);
  }
}

function filterSystemAuditLogs() {
  const tbody = document.getElementById('admin-logs-tbody');
  const q = document.getElementById('admin-logs-search')?.value.toLowerCase().trim() || '';
  
  if (!tbody) return;
  if (allSystemLogs.length === 0) {
    tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; color: #94a3b8;">Walang nakitang logs.</td></tr>';
    return;
  }
  
  const filtered = allSystemLogs.filter(log => {
    return (log.action || '').toLowerCase().includes(q) || 
           (log.details || '').toLowerCase().includes(q) || 
           (log.user || '').toLowerCase().includes(q);
  });
  
  let html = '';
  filtered.forEach(log => {
    const time = log.timestamp ? new Date(log.timestamp.toDate ? log.timestamp.toDate() : log.timestamp).toLocaleString() : 'N/A';
    html += `<tr>
      <td><small style="color: #64748b;">${time}</small></td>
      <td><span class="badge badge-admin">${log.action}</span></td>
      <td><b>${log.user}</b></td>
      <td>${log.details}</td>
    </tr>`;
  });
  
  tbody.innerHTML = html || '<tr><td colspan="4" style="text-align: center;">Walang tugma.</td></tr>';
}

// ========================================================
// PRINT MONTHLY AUDIT SHEET
// ========================================================
function printMonthlyAuditSheet() {
  if (typeof currentInventory === 'undefined' || currentInventory.length === 0) {
    alert('Walang inventory na mai-print. Paki-refresh muna ang listahan.');
    return;
  }
  
  let rows = '';
  currentInventory.forEach(p => {
     rows += `<tr>
        <td style="border: 1px solid #000; padding: 6px;"><b>${p.itemCode || p.sapCode || p.id}</b></td>
        <td style="border: 1px solid #000; padding: 6px;">${p.itemName}</td>
        <td style="border: 1px solid #000; padding: 6px;">${p.storageStation || ''}</td>
        <td style="border: 1px solid #000; padding: 6px; text-align: center;">${p.stockWhole || 0} ${p.wholeUOM || 'W'}</td>
        <td style="border: 1px solid #000; padding: 6px; text-align: center;">${p.stockLoose || 0} ${p.looseUOM || 'L'}</td>
        <td style="border: 1px solid #000; padding: 6px;"></td>
        <td style="border: 1px solid #000; padding: 6px;"></td>
     </tr>`;
  });
  
  const brandName = localStorage.getItem('kusina_brand_name') || 'KUSINA ERP';
  const monthStr = new Date().toLocaleString('default', { month: 'long', year: 'numeric' });
  
  const printWin = window.open('', '', 'width=900,height=900');
  printWin.document.write(`
    <html><head><title>Monthly Audit Sheet</title>
    <style>body{font-family: Arial, sans-serif;} table{width:100%; border-collapse: collapse; font-size: 10pt;}</style>
    </head><body>
    <div style="text-align:center; margin-bottom: 20px;">
      <h2 style="margin: 0; text-transform: uppercase;">${brandName}</h2>
      <h3 style="margin: 5px 0;">MONTHLY INVENTORY PHYSICAL COUNT SHEET</h3>
      <div>Audit Period: <b>${monthStr}</b></div>
    </div>
    <table>
      <thead>
        <tr style="background: #f1f5f9;">
          <th style="border: 1px solid #000; padding: 6px;">Code</th>
          <th style="border: 1px solid #000; padding: 6px;">Item Description</th>
          <th style="border: 1px solid #000; padding: 6px;">Station</th>
          <th style="border: 1px solid #000; padding: 6px;">System Whole</th>
          <th style="border: 1px solid #000; padding: 6px;">System Loose</th>
          <th style="border: 1px solid #000; padding: 6px; width:15%;">ACTUAL WHOLE</th>
          <th style="border: 1px solid #000; padding: 6px; width:15%;">ACTUAL LOOSE</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
    <div style="margin-top: 30px; display: flex; justify-content: space-between;">
       <div>Audited By: ___________________</div>
       <div>Verified By: ___________________</div>
       <div>Date Completed: ________________</div>
    </div>
    </body></html>
  `);
  printWin.document.close();
  printWin.focus();
  setTimeout(() => { printWin.print(); printWin.close(); }, 500);
}


// ========================================================
// LATE RETURN (7-DAY DISPUTE) LOGIC
// ========================================================
let activeLateReturnOrder = null;

function openLateReturnModal(orderId) {
  if (typeof db === 'undefined' || !db) return;
  db.collection('orders').doc(orderId).get().then(doc => {
    if (!doc.exists) return;
    activeLateReturnOrder = { id: doc.id, ...doc.data() };
    
    const invModal = document.getElementById('investigation-modal');
    if (invModal) invModal.style.display = 'none';
    
    document.getElementById('late-return-order-id').innerText = activeLateReturnOrder.orderId || doc.id;
    
    let rcvDate = new Date();
    if (activeLateReturnOrder.receivedAt) {
      rcvDate = activeLateReturnOrder.receivedAt.toDate ? activeLateReturnOrder.receivedAt.toDate() : new Date(activeLateReturnOrder.receivedAt);
    }
    const now = new Date();
    const diffDays = Math.floor(Math.abs(now - rcvDate) / (1000 * 60 * 60 * 24));
    document.getElementById('late-return-timer').innerText = `Valid ang late return (Day ${diffDays + 1} of 7)`;
    
    const sel = document.getElementById('late-return-item-select');
    if (sel) {
      sel.innerHTML = '<option value="">-- Pumili ng Item --</option>';
      (activeLateReturnOrder.items || []).forEach((it, idx) => {
        sel.innerHTML += `<option value="${idx}">${it.itemName} (Total: ${it.wholeQty} ${it.wholeUOM}, ${it.looseQty} ${it.looseUOM})</option>`;
      });
    }

    const uomSel = document.getElementById('late-return-uom');
    if (uomSel) uomSel.innerHTML = '<option value="whole">Whole Unit</option><option value="loose">Loose Unit</option>';

    window.tempLateReturnPhoto = null;
    const imgEl = document.getElementById('late-return-photo-preview');
    if(imgEl) { imgEl.src = ''; document.getElementById('late-return-photo-container').style.display = 'none'; }
    if(document.getElementById('late-return-qty')) document.getElementById('late-return-qty').value = 0;
    if(document.getElementById('late-return-notes')) document.getElementById('late-return-notes').value = '';

    const modal = document.getElementById('branch-late-return-modal');
    if(modal) modal.style.display = 'flex';
  }).catch(err => {
    console.error("Error fetching order for late return:", err);
  });
}

function closeLateReturnModal() {
  const modal = document.getElementById('branch-late-return-modal');
  if (modal) modal.style.display = 'none';
  activeLateReturnOrder = null;
}

async function submitLateReturn() {
  if (!activeLateReturnOrder || !db) return;
  
  const idx = document.getElementById('late-return-item-select')?.value;
  const qty = parseFloat(document.getElementById('late-return-qty')?.value || 0);
  const uomType = document.getElementById('late-return-uom')?.value;
  const notes = document.getElementById('late-return-notes')?.value.trim();
  
  if (idx === '' || qty <= 0 || !notes) {
    alert("Kumpletuhin ang item, quantity, at salaysay ng pagbabalik.");
    return;
  }
  
  if (!window.tempLateReturnPhoto) {
    alert("⚠️ Kinakailangan ang malinaw na litrato ng ebidensya para sa mga LATE return.");
    return;
  }

  const selectedItem = activeLateReturnOrder.items[idx];
  const uomName = uomType === 'whole' ? selectedItem.wholeUOM : selectedItem.looseUOM;
  
  const returnObj = {
    itemName: selectedItem.itemName,
    itemCode: selectedItem.itemCode || selectedItem.id,
    damageQty: qty,
    damageReason: notes
  };

  try {
    // I-log diretso sa disputes list ni Admin
    await db.collection('disputes').add({
      orderId: activeLateReturnOrder.orderId || activeLateReturnOrder.id,
      branchName: activeLateReturnOrder.branchName,
      driverName: 'LATE RETURN (After Delivery)',
      receiverName: getCurrentUser()?.name || 'Branch Manager',
      itemsAffected: [returnObj],
      notes: 'LATE RETURN (Under 7-Days): ' + notes,
      photoProof: window.tempLateReturnPhoto,
      status: 'Pending Resolution / Credit Memo',
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    // Update order status para alam ni admin na nagka-issue ito after mabayaran/mareceive
    await db.collection('orders').doc(activeLateReturnOrder.id).update({
      hasLateReturn: true,
      status: 'Completed with Late Dispute',
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    logSystemAction('LATE_RETURN_FILED', `Nag-file ng late return sa PO: ${activeLateReturnOrder.orderId || activeLateReturnOrder.id}. Item: ${returnObj.itemName}`);
    alert("🚀 Naipadala na ang iyong Late Return Request kasama ang ebidensya. Hintayin ang resolusyon ni Admin/Commissary.");
    closeLateReturnModal();
    if(typeof loadBranchDeliveries === 'function') loadBranchDeliveries();
  } catch (err) {
    alert("Error: " + err.message);
  }
}


function confirmScannedItemAndNext() {
  if (window.lastScannedItemIdx !== undefined && window.lastScannedItemIdx !== -1) {
    branchReceivingChecklist[window.lastScannedItemIdx].condition = 'good';
    renderBranchReceivingChecklist();
  }
  const modal = document.getElementById('branch-scan-confirm-modal');
  if (modal) modal.style.display = 'none';
  
  // Auto-reopen the scanner for the next item
  setTimeout(() => {
    openCameraBarcodeScanner('branch');
  }, 400);
}


// ========================================================
// VENDOR PURCHASE ORDER (PO) ENGINE
// ========================================================
let adminVendorList = [];
let allVendorPOs = [];
let poCartItems = [];
let poFilteredProducts = [];

async function loadAdminVendorPOs() {
  const tbody = document.getElementById('admin-vendor-po-tbody');
  if (!tbody || !db) return;

  try {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align: center;">Kinukuha ang records...</td></tr>';
    
    // Kunin din ang vendors list para sa dropdown
    const vSnap = await db.collection('vendors').get();
    adminVendorList = [];
    vSnap.forEach(d => { adminVendorList.push({ id: d.id, ...d.data() }) });

    const snap = await db.collection('vendor_pos').orderBy('createdAt', 'desc').limit(100).get();
    allVendorPOs = [];
    snap.forEach(doc => { allVendorPOs.push({ id: doc.id, ...doc.data() }); });
    
    filterAdminVendorPOs();
  } catch (err) {
    console.error(err);
    tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: red;">Error: ${err.message}</td></tr>`;
  }
}

function filterAdminVendorPOs() {
  const tbody = document.getElementById('admin-vendor-po-tbody');
  if (!tbody) return;
  const q = document.getElementById('admin-po-search')?.value.toLowerCase().trim() || '';

  if (allVendorPOs.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; color: #94a3b8;">Walang nakitang PO. Gumawa ng bago.</td></tr>';
    return;
  }

  const filtered = allVendorPOs.filter(po => {
    return (po.poNumber || '').toLowerCase().includes(q) ||
           (po.vendorName || '').toLowerCase().includes(q) ||
           (po.createdBy || '').toLowerCase().includes(q);
  });

  if (filtered.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; color: #94a3b8;">Walang tugma.</td></tr>';
    return;
  }

  let html = '';
  filtered.forEach(po => {
    const total = parseFloat(po.totalAmount || 0).toLocaleString('en-PH', { style: 'currency', currency: 'PHP' });
    const count = (po.items || []).length;
    const statBadge = poStatusBadge(po);
                     
    html += `<tr>
      <td><b style="color: #059669;">${po.poNumber}</b><br><small>${po.orderDate}</small></td>
      <td><b>${po.vendorName}</b></td>
      <td>${count} item(s)</td>
      <td><b style="color: #b91c1c;">${total}</b></td>
      <td>${statBadge}</td>
      <td><small>${po.createdBy}</small></td>
      <td>
        <div style="display: flex; gap: 0.25rem; flex-wrap: wrap;">
          <button class="btn btn-sm btn-primary" onclick="viewVendorPO('${po.id}')">🔍 View</button>
          <button class="btn btn-sm btn-secondary" onclick="printDirectVendorPO('${po.id}')">🖨️ Print</button>
          ${poActionButtons(po)}
        </div>
      </td>
    </tr>`;
  });
  tbody.innerHTML = html;
}

function openCreatePOModal() {
  window.activeViewingPOId = null;
  const printBtn = document.getElementById('btn-print-active-po');
  if (printBtn) printBtn.style.display = 'none';
  document.getElementById('po-view-mode').value = 'create';
  document.getElementById('vendor-po-modal-title').innerText = '📝 Create Purchase Order';
  document.getElementById('vendor-po-modal-subtitle').innerText = 'PO Number: Gagawa pagkatapos i-save';
  document.getElementById('po-add-product-section').style.display = 'block';
  document.getElementById('btn-save-vendor-po').style.display = 'block';
  document.getElementById('po-table-action-header').style.display = 'table-cell';
  document.getElementById('po-audit-trail-box').style.display = 'none';
  
  // Set date to today
  const today = new Date().toISOString().slice(0, 10);
  document.getElementById('po-order-date').value = today;
  document.getElementById('po-order-date').disabled = false;
  
  // Populate vendors (Datalist for Searchability)
  const vSel = document.getElementById('po-vendor-select');
  const vList = document.getElementById('po-vendor-datalist');
  if (vSel) {
    vSel.disabled = false;
    vSel.value = '';
  }
  poVendorReset();

  poCartItems = [];
  renderPOCart();
  
  document.getElementById('vendor-po-modal').style.display = 'flex';
}

let poVendorResults = [];
let poProductResults = [];
let poActiveVendorName = '';

function poVendorReset() {
  poActiveVendorName = '';
  poFilteredProducts = [];
  const pInp = document.getElementById('po-product-search');
  const pHid = document.getElementById('po-product-select');
  const uSel = document.getElementById('po-uom-select');
  const cInp = document.getElementById('po-unit-cost');
  const vName = document.getElementById('po-active-vendor-name');
  if (pInp) { pInp.value = ''; pInp.disabled = true; pInp.placeholder = '-- Pumili Muna ng Vendor --'; }
  if (pHid) pHid.value = '';
  if (uSel) uSel.disabled = true;
  if (cInp) cInp.disabled = true;
  if (vName) vName.innerText = '--';
}

function poVendorSearch() {
  const inp = document.getElementById('po-vendor-select');
  if (!inp || inp.disabled) return;
  // Kapag binago ang tinype matapos mamili ng vendor, i-reset ang produkto
  if (poActiveVendorName && inp.value !== poActiveVendorName) poVendorReset();
  poVendorResults = (adminVendorList || [])
    .filter(v => smartMatch(inp.value, v.name, v.contactPerson, v.id))
    .sort((a, b) => String(a.name).localeCompare(String(b.name)))
    .slice(0, 40);
  srchRender('po-vendor-results', poVendorResults,
    v => `<b>${srchEsc(v.name)}</b>${v.terms ? `<br><small style="color:#64748b;">${srchEsc(v.terms)}</small>` : ''}`,
    'poVendorPick', 'Walang tugmang vendor.');
}
function poVendorPick(i) {
  const v = poVendorResults[i];
  if (!v) return;
  document.getElementById('po-vendor-select').value = v.name;
  document.getElementById('po-vendor-results').style.display = 'none';
  onPOVendorChange();
}
function poVendorCommit() {
  const inp = document.getElementById('po-vendor-select');
  if (!inp || inp.disabled || inp.value === poActiveVendorName) return;
  const exact = (adminVendorList || []).find(v => String(v.name).toLowerCase() === inp.value.trim().toLowerCase());
  if (exact) { inp.value = exact.name; onPOVendorChange(); }
}

async function onPOVendorChange() {
  const vName = document.getElementById('po-vendor-select').value;
  poVendorReset();
  if (!vName) return;
  poActiveVendorName = vName;
  document.getElementById('po-active-vendor-name').innerText = vName;

  const pInp = document.getElementById('po-product-search');
  pInp.placeholder = 'Kinukuha ang produkto...';

  // Query products tied to this vendor
  try {
    const snap = await db.collection('products').where('supplier', '==', vName).get();
    poFilteredProducts = [];
    snap.forEach(d => { poFilteredProducts.push({ id: d.id, ...d.data() }); });
    poFilteredProducts.sort((a, b) => String(a.itemName).localeCompare(String(b.itemName)));

    if (poFilteredProducts.length === 0) {
      pInp.placeholder = 'Walang naka-tag na produkto kay ' + vName;
      return;
    }
    pInp.disabled = false;
    pInp.placeholder = `🔎 Mag-type ng pangalan o code ng item (${poFilteredProducts.length} items)`;
    pInp.focus();
  } catch (err) {
    console.error(err);
    pInp.placeholder = 'Error sa pagkuha.';
  }
}

function poProductSearch() {
  const inp = document.getElementById('po-product-search');
  if (!inp || inp.disabled) return;
  const hid = document.getElementById('po-product-select');
  const cur = poFilteredProducts.find(x => x.id === hid.value);
  if (cur && inp.value !== cur.itemName) { hid.value = ''; onPOProductChange(); }
  poProductResults = poFilteredProducts
    .filter(p => smartMatch(inp.value, p.itemName, p.sapCode, p.itemCode, p.posCode, p.barcode, p.id))
    .slice(0, 40);
  srchRender('po-product-results', poProductResults,
    p => `<b>${srchEsc(p.itemName)}</b><br><small style="color:#64748b;">${srchEsc(p.sapCode || p.id)} · ${srchEsc(p.wholeUOM || 'Whole')} ₱${(parseFloat(p.wholePrice) || 0).toFixed(2)} / ${srchEsc(p.looseUOM || 'Loose')} ₱${(parseFloat(p.loosePrice) || 0).toFixed(2)}</small>`,
    'poProductPick', 'Walang tugmang produkto kay ' + srchEsc(poActiveVendorName) + '.');
}
function poProductPick(i) {
  const p = poProductResults[i];
  if (!p) return;
  document.getElementById('po-product-select').value = p.id;
  document.getElementById('po-product-search').value = p.itemName;
  document.getElementById('po-product-results').style.display = 'none';
  onPOProductChange();
  const q = document.getElementById('po-qty');
  if (q) { q.focus(); q.select(); }
}

function onPOProductChange() {
  const pId = document.getElementById('po-product-select').value;
  const p = poFilteredProducts.find(x => x.id === pId);
  
  const uSel = document.getElementById('po-uom-select');
  const cInp = document.getElementById('po-unit-cost');
  
  if (!p) {
    uSel.disabled = true; cInp.disabled = true;
    return;
  }
  
  uSel.disabled = false;
  uSel.innerHTML = `
    <option value="whole|${p.wholePrice}">${p.wholeUOM || 'Whole'}</option>
    <option value="loose|${p.loosePrice}">${p.looseUOM || 'Loose'}</option>
  `;
  cInp.disabled = false;
  cInp.value = p.wholePrice || 0;
  
  uSel.onchange = function() {
     const price = parseFloat(this.value.split('|')[1] || 0);
     cInp.value = price;
  };
}

function addPOItemToCart() {
  const pId = document.getElementById('po-product-select').value;
  const p = poFilteredProducts.find(x => x.id === pId);
  const qty = parseFloat(document.getElementById('po-qty').value || 1);
  const cost = parseFloat(document.getElementById('po-unit-cost').value || 0);
  
  if (!p) { alert('Pumili ng produkto.'); return; }
  if (qty <= 0) { alert('Dapat higit sa 0 ang quantity.'); return; }
  
  const uSel = document.getElementById('po-uom-select');
  const uText = uSel.options[uSel.selectedIndex].text;
  const uType = uSel.value.split('|')[0];
  
  const subtotal = qty * cost;
  
  // Check if exists
  const existIdx = poCartItems.findIndex(i => i.productId === p.id && i.uomType === uType);
  if (existIdx >= 0) {
    poCartItems[existIdx].qty += qty;
    poCartItems[existIdx].subtotal += subtotal;
  } else {
    poCartItems.push({
      productId: p.id,
      itemCode: p.sapCode || p.id,
      itemName: p.itemName,
      uomText: uText,
      uomType: uType,
      qty: qty,
      unitCost: cost,
      subtotal: subtotal
    });
  }
  
  // Reset
  document.getElementById('po-product-select').value = '';
  const pSrch = document.getElementById('po-product-search');
  if (pSrch) { pSrch.value = ''; pSrch.focus(); }
  document.getElementById('po-uom-select').disabled = true;
  document.getElementById('po-unit-cost').disabled = true;
  document.getElementById('po-qty').value = 1;
  
  renderPOCart();
}

function removePOItem(idx) {
  poCartItems.splice(idx, 1);
  renderPOCart();
}

function renderPOCart() {
  const tbody = document.getElementById('po-cart-tbody');
  const mode = document.getElementById('po-view-mode').value;
  const isView = mode === 'view';
  
  if (poCartItems.length === 0) {
    tbody.innerHTML = `<tr><td colspan="${isView ? 5 : 6}" style="text-align: center; color: #94a3b8; padding: 1rem;">Walang item sa PO basket.</td></tr>`;
    document.getElementById('po-grand-total').innerText = '₱0.00';
    return;
  }
  
  let html = '';
  let gTotal = 0;
  poCartItems.forEach((i, idx) => {
    gTotal += i.subtotal;
    const costStr = parseFloat(i.unitCost).toLocaleString('en-PH', { style: 'currency', currency: 'PHP' });
    const subStr = parseFloat(i.subtotal).toLocaleString('en-PH', { style: 'currency', currency: 'PHP' });
    
    html += `<tr>
      <td><span style="font-family: monospace;">${i.itemCode}</span></td>
      <td><b>${i.itemName}</b></td>
      <td>${i.qty} ${i.uomText}</td>
      <td>${costStr}</td>
      <td><b style="color: #0f172a;">${subStr}</b></td>
      ${!isView ? `<td style="text-align:center;"><button type="button" class="btn btn-sm btn-danger" onclick="removePOItem(${idx})">✕</button></td>` : ''}
    </tr>`;
  });
  
  tbody.innerHTML = html;
  document.getElementById('po-grand-total').innerText = gTotal.toLocaleString('en-PH', { style: 'currency', currency: 'PHP' });
}

async function submitVendorPO() {
  if (poCartItems.length === 0) { alert('Magdagdag muna ng item.'); return; }
  const vName = document.getElementById('po-vendor-select').value;
  const oDate = document.getElementById('po-order-date').value;
  if (!vName) { alert('Pumili ng vendor.'); return; }
  if (!oDate) { alert('Maglagay ng PO Date.'); return; }
  
  if (!await uiConfirm('I-save ang Purchase Order na ito?')) return;
  
  const u = getCurrentUser();
  const userName = u ? (u.name || u.email) : 'Admin';
  const poNum = 'VPO-' + Date.now().toString().slice(-6);
  
  let gTotal = 0;
  poCartItems.forEach(i => gTotal += i.subtotal);
  
  try {
    await db.collection('vendor_pos').doc(poNum).set({
      poNumber: poNum,
      vendorName: vName,
      orderDate: oDate,
      items: poCartItems,
      totalAmount: gTotal,
      status: 'For Approval',
      approvals: {},
      createdBy: userName,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    
    await logSystemAction('VENDOR_PO_CREATED', `Gumawa ng PO (${poNum}) para sa vendor na ${vName}. Total: ₱${gTotal}`);
    alert(`✅ Na-save ang ${poNum} bilang FOR APPROVAL.\n\nI-print muna ang PO at ipapirma sa Head of Supply Chain at COO. Pagkatapos pumirma, i-click ang ✍️ sign-off buttons sa PO list.`);
    closeVendorPOModal();
    loadAdminVendorPOs();
  } catch (e) {
    alert('Error: ' + e.message);
  }
}

function viewVendorPO(poId) {
  const po = allVendorPOs.find(p => p.id === poId);
  if (!po) return;
  window.activeViewingPOId = poId;
  const printBtn = document.getElementById('btn-print-active-po');
  if (printBtn) printBtn.style.display = 'inline-block';
  
  document.getElementById('po-view-mode').value = 'view';
  document.getElementById('vendor-po-modal-title').innerText = '🔍 Tingnan ang Purchase Order';
  document.getElementById('vendor-po-modal-subtitle').innerText = 'PO Number: ' + po.poNumber;
  document.getElementById('po-add-product-section').style.display = 'none';
  document.getElementById('btn-save-vendor-po').style.display = 'none';
  document.getElementById('po-table-action-header').style.display = 'none';
  
  const vSel = document.getElementById('po-vendor-select');
  if (vSel) {
    if (po.vendorName && vSel.tagName === 'SELECT' && !Array.from(vSel.options).some(o => o.value === po.vendorName)) vSel.add(new Option(po.vendorName, po.vendorName));
    vSel.value = po.vendorName;
    vSel.disabled = true;
  }
  
  const dInp = document.getElementById('po-order-date');
  dInp.value = po.orderDate || (po.createdAt ? new Date(po.createdAt.toDate ? po.createdAt.toDate() : po.createdAt).toISOString().slice(0, 10) : '');
  dInp.disabled = true;
  
  poCartItems = po.items || [];
  renderPOCart();
  
  const auditBox = document.getElementById('po-audit-trail-box');
  auditBox.style.display = 'block';
  document.getElementById('po-audit-creator').innerText = po.createdBy || 'Unknown';
  document.getElementById('po-audit-time').innerText = po.createdAt ? new Date(po.createdAt.toDate ? po.createdAt.toDate() : po.createdAt).toLocaleString() : 'N/A';
  
  document.getElementById('vendor-po-modal').style.display = 'flex';
  poFullInfo(po);
}
async function poFullInfo(po) {
  const ab = document.getElementById('po-audit-trail-box'); if (!ab) return; const old = document.getElementById('po-full-info'); if (old) old.remove();
  const box = document.createElement('div'); box.id = 'po-full-info'; box.style.cssText = 'margin-top:.8rem;border:1px solid #e2e8f0;border-radius:8px;padding:.8rem;background:#fff;font-size:.88rem;'; box.innerHTML = 'Kinukuha ang buong detalye...'; ab.insertAdjacentElement('afterend', box);
  const ts = v => { try { return v ? new Date(v.toDate ? v.toDate() : v).toLocaleString() : ''; } catch (e) { return ''; } }, E = x => srchEsc(x == null ? '' : String(x));
  const ap = po.approvals || {}, apl = Object.keys(ap).filter(k => ap[k] && ap[k].by).map(k => `${E(k)}: <b>${E(ap[k].by)}</b> <small style="color:#64748b;">${E(ts(ap[k].at))}</small>`).join('<br>');
  let h = `<h4 style="margin:0 0 .4rem;">📋 Buong detalye ng PO</h4><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:.4rem;"><div><small>PO No.</small><br><b>${E(po.poNumber)}</b></div><div><small>Status</small><br>${typeof poStatusBadge === 'function' ? poStatusBadge(po) : E(po.status)}</div><div><small>Supplier</small><br><b>${E(po.vendorName)}</b></div><div><small>Kabuuan</small><br><b>${money(po.totalAmount || 0)}</b></div><div><small>Company</small><br>${E(po.company || '—')}</div><div><small>Branch</small><br>${E(po.branch || '—')}</div>${po.requestKey ? `<div><small>Request No.</small><br><b>${E(po.requestKey)}</b></div>` : ''}<div><small>Ginawa ni</small><br>${E(po.createdBy || '—')}</div></div>${po.notes ? `<div style="margin-top:.4rem;white-space:pre-wrap;background:#f8fafc;padding:.5rem;border-radius:6px;"><small>Notes / Description</small><br>${E(po.notes)}</div>` : ''}${apl ? `<div style="margin-top:.4rem;"><small>Approvals</small><br>${apl}</div>` : ''}`;
  if (po.requestKey) {
    try {
      const rs = await db.collection('requests').doc(po.requestKey).get();
      if (rs.exists) {
        const r = rs.data(), selQ = r.selectedQuote, photos = await reqPhotoHtml(r.photos), poThumbs = await reqPhotoHtml(r.poFiles || []);
        const qrows = []; for (const [i, q] of (r.quotes || []).entries()) { const th = q.photoId ? await reqPhotoHtml([q.photoId]) : ''; qrows.push(`<tr style="${selQ === i ? 'background:#ecfdf5;' : ''}"><td>${E(q.supplier)}${selQ === i ? ' <b style="color:#059669;">✅ Napili</b>' : ''}</td><td style="text-align:right;">${money(q.amount)}</td><td>${E(q.notes || '')}<br><small style="color:#94a3b8;">${E(q.by || '')} · ${E(ts(q.at))}</small></td><td>${th}</td></tr>`); }
        h += `<h4 style="margin:.8rem 0 .3rem;">📝 Request: ${E(r.title)}</h4><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:.4rem;"><div><small>Reporter (nag-request)</small><br><b>${E(r.requester || '—')}</b></div><div><small>Assignee (bumili)</small><br><b>${E(r.assignee || '—')}</b></div><div><small>Priority / Uri</small><br>${E(r.priority || '')} · ${E(r.type || '')}</div><div><small>Kailangan bago</small><br>${E(r.neededBy || '—')}</div></div>${r.description ? `<div style="white-space:pre-wrap;background:#f8fafc;padding:.5rem;border-radius:6px;margin-top:.4rem;">${E(r.description)}</div>` : ''}${photos ? `<div style="display:flex;gap:.4rem;flex-wrap:wrap;margin:.5rem 0;">${photos}</div>` : ''}${r.approval ? `<div style="margin:.4rem 0;padding:.4rem .6rem;border-radius:6px;background:#ecfdf5;">✅ Approved ni <b>${E(r.approval.by)}</b> (${E(r.approval.role || '')}) · ${E(ts(r.approval.at))} ${r.approval.note ? '— ' + E(r.approval.note) : ''}</div>` : ''}<h4 style="margin:.8rem 0 .3rem;">🧾 Canvass / Quotations</h4><table data-notools="1" style="width:100%;"><thead><tr><th>Supplier</th><th style="text-align:right;">Halaga</th><th>Notes</th><th>Attachment</th></tr></thead><tbody>${qrows.join('') || '<tr><td colspan="4" style="color:#94a3b8;">Walang quotation.</td></tr>'}</tbody></table><h4 style="margin:.8rem 0 .3rem;">📄 PO attachment</h4>${poThumbs ? `<div style="display:flex;gap:.4rem;flex-wrap:wrap;">${poThumbs}</div>` : '<small style="color:#94a3b8;">Wala pang na-upload na PO file.</small>'}<h4 style="margin:.8rem 0 .3rem;">🕘 Activity</h4>${(r.history || []).slice().reverse().map(x => `<div style="font-size:.8rem;border-left:3px solid #cbd5e1;padding-left:.5rem;margin:.2rem 0;"><b>${E(x.by)}</b> — ${x.from ? E(x.from) + ' → ' : ''}${E(x.to)} ${x.note ? '· ' + E(x.note) : ''}<br><small style="color:#94a3b8;">${E(typeof reqTs === 'function' ? reqTs(x.at) : x.at)}</small></div>`).join('')}`;
      } else h += '<p style="color:#94a3b8;">Wala na ang kaugnay na request.</p>';
    } catch (e) { h += '<p style="color:#dc2626;">Hindi makuha ang request: ' + E(e.message) + '</p>'; }
  }
  box.innerHTML = h;
}

function closeVendorPOModal() {
  const fi = document.getElementById('po-full-info'); if (fi) fi.remove();
  document.getElementById('vendor-po-modal').style.display = 'none';
}


// ========================================================
// RECEIVE VENDOR PO (AP INTEGRATION & INVENTORY SYNC)
// ========================================================
let activeReceivePOData = null;

function openReceivePOModal(poId) {
  const po = allVendorPOs.find(p => p.id === poId);
  if (!po) return;

  activeReceivePOData = JSON.parse(JSON.stringify(po)); // Deep copy to edit actuals

  document.getElementById('recv-po-id').value = po.id;
  document.getElementById('recv-po-number').innerText = po.poNumber;
  document.getElementById('recv-po-vendor').innerText = po.vendorName;
  document.getElementById('recv-po-invoice-no').value = '';
  ['recv-po-grpo','recv-po-sap-ap'].forEach(i=>{const e=document.getElementById(i); if(e) e.value='';});

  // Initialize actuals if not set
  activeReceivePOData.items.forEach(i => {
    i.actualWholeQty = i.actualWholeQty !== undefined ? i.actualWholeQty : (i.uomType === 'whole' ? i.qty : 0);
    i.actualLooseQty = i.actualLooseQty !== undefined ? i.actualLooseQty : (i.uomType === 'loose' ? i.qty : 0);
    i.actualSubtotal = i.actualSubtotal !== undefined ? i.actualSubtotal : i.subtotal;
  });

  renderReceivePOTable();
  document.getElementById('admin-receive-po-modal').style.display = 'flex';
}

function renderReceivePOTable() {
  const tbody = document.getElementById('recv-po-tbody');
  if (!tbody || !activeReceivePOData) return;

  let html = '';
  let gTotal = 0;

  activeReceivePOData.items.forEach((i, idx) => {
    const expected = `${i.qty} ${i.uomText}`;
    const cost = parseFloat(i.unitCost || 0);
    const wQty = parseFloat(i.actualWholeQty !== undefined ? i.actualWholeQty : (i.uomType === 'whole' ? i.qty : 0));
    const lQty = parseFloat(i.actualLooseQty !== undefined ? i.actualLooseQty : (i.uomType === 'loose' ? i.qty : 0));

    let actualSub = (i.uomType === 'whole') ? (wQty * cost) : (lQty * cost);
    i.actualSubtotal = actualSub;
    gTotal += actualSub;

    const subStr = actualSub.toLocaleString('en-PH', { style: 'currency', currency: 'PHP' });
    const costStr = cost.toLocaleString('en-PH', { style: 'currency', currency: 'PHP' });

    html += `<tr id="recv-row-${idx}">
      <td><b style="font-size: 0.95rem;">${i.itemName}</b><br><small style="font-family: monospace; color: #64748b;">${i.itemCode}</small></td>
      <td><b style="color: #059669;">${expected}</b></td>
      <td>
        <input type="number" id="recv-wqty-${idx}" value="${wQty}" min="0" step="0.5" 
               style="width: 100%; text-align: center; padding: 0.25rem;" 
               oninput="updateReceiveQtyLive(${idx}, 'whole')" ${i.uomType !== 'whole' ? 'disabled' : ''}>
      </td>
      <td>
        <input type="number" id="recv-lqty-${idx}" value="${lQty}" min="0" step="0.5" 
               style="width: 100%; text-align: center; padding: 0.25rem;" 
               oninput="updateReceiveQtyLive(${idx}, 'loose')" ${i.uomType !== 'loose' ? 'disabled' : ''}>
      </td>
      <td>${costStr} / ${i.uomText}</td>
      <td style="text-align: right;"><b id="recv-subtotal-${idx}" style="color: #0f172a;">${subStr}</b></td>
    </tr>`;
  });

  tbody.innerHTML = html;
  document.getElementById('recv-po-grand-total').innerText = gTotal.toLocaleString('en-PH', { style: 'currency', currency: 'PHP' });
}

function updateReceiveQtyLive(idx, type) {
  if (!activeReceivePOData || !activeReceivePOData.items[idx]) return;
  const item = activeReceivePOData.items[idx];
  const cost = parseFloat(item.unitCost || 0);

  const wInput = document.getElementById(`recv-wqty-${idx}`);
  const lInput = document.getElementById(`recv-lqty-${idx}`);

  const wVal = parseFloat(wInput ? wInput.value : 0) || 0;
  const lVal = parseFloat(lInput ? lInput.value : 0) || 0;

  item.actualWholeQty = wVal;
  item.actualLooseQty = lVal;

  let actualSub = (item.uomType === 'whole') ? (wVal * cost) : (lVal * cost);
  item.actualSubtotal = actualSub;

  const subEl = document.getElementById(`recv-subtotal-${idx}`);
  if (subEl) {
    subEl.innerText = actualSub.toLocaleString('en-PH', { style: 'currency', currency: 'PHP' });
  }

  let newGrandTotal = 0;
  activeReceivePOData.items.forEach(it => newGrandTotal += (it.actualSubtotal || 0));
  const gEl = document.getElementById('recv-po-grand-total');
  if (gEl) {
    gEl.innerText = newGrandTotal.toLocaleString('en-PH', { style: 'currency', currency: 'PHP' });
  }
}

async function submitReceivePO() {
  if (!activeReceivePOData || !db) return;
  
  const invNo = document.getElementById('recv-po-invoice-no').value.trim();
  if (!invNo) {
    alert('⚠️ Kailangang ilagay ang Vendor Invoice Number bilang reference sa Accounts Payable.');
    return;
  }

  if (!await uiConfirm('I-save ang Actual Received Quantities? Awtomatiko nitong ia-update ang INVENTORY STOCK at ipapasok sa Accounts Payable (AP).')) return;

  const u = getCurrentUser();
  const userName = u ? (u.name || u.email) : 'Admin';
  
  // Compute final grand total
  let actualGrandTotal = 0;
  activeReceivePOData.items.forEach(i => actualGrandTotal += i.actualSubtotal);

  try {
    const poRef = db.collection('vendor_pos').doc(activeReceivePOData.id);
    const recvItems = activeReceivePOData.items;

    await db.runTransaction(async tx => {
      const poSnap = await tx.get(poRef);
      if (!poSnap.exists) throw new Error('Hindi nahanap ang PO.');
      if (!poIsApproved(poSnap.data())) throw new Error('Hindi pa APPROVED ang PO na ito (kailangan ang pirma ng Head of Supply Chain at COO) kaya hindi pa puwedeng i-receive.');
      if (poSnap.data().receivedAt) throw new Error('Na-receive na ang PO na ito dati pa. Hindi na puwedeng i-receive ulit para hindi madoble ang stock.');

      const isNI = !!poSnap.data().nonInventory; // galing sa Mga Request (serbisyo/gamit) — walang stock na idadagdag
      const prodRefs = isNI ? [] : recvItems.map(it => db.collection('products').doc(it.productId || it.itemCode));
      const prodSnaps = isNI ? [] : await Promise.all(prodRefs.map(r => tx.get(r)));
      const missingNames = isNI ? [] : recvItems.filter((it, idx) => !prodSnaps[idx].exists).map(it => it.itemName || it.itemCode);
      if (missingNames.length) throw new Error('Walang product record para sa: ' + missingNames.join(', '));

      // 1. Update PO Status to AP
      tx.update(poRef, {
        status: 'Received / AP',
        actualItems: recvItems,
        actualTotalAmount: actualGrandTotal,
        vendorInvoiceNo: invNo,
        grpoNo: (document.getElementById('recv-po-grpo')?.value || '').trim(),
        sapApInvoiceNo: (document.getElementById('recv-po-sap-ap')?.value || '').trim(),
        receivedBy: userName,
        receivedAt: firebase.firestore.FieldValue.serverTimestamp()
      });

      // 2. Update Inventory Stock + movement log
      if (!isNI) recvItems.forEach((item, idx) => {
        const incWhole = parseFloat(item.actualWholeQty || 0);
        const incLoose = parseFloat(item.actualLooseQty || 0);
        tx.update(prodRefs[idx], {
          stockWhole: firebase.firestore.FieldValue.increment(incWhole),
          stockLoose: firebase.firestore.FieldValue.increment(incLoose)
        });
        tx.set(db.collection('stock_movements').doc(),
          stockMovementDoc(prodRefs[idx].id, item.itemName, 'PO_RECEIVED', activeReceivePOData.poNumber || activeReceivePOData.id, incWhole, incLoose, 'Invoice: ' + invNo));
      });
    });
    if (activeReceivePOData.requestKey) reqSyncFromPO(activeReceivePOData.requestKey, 'Delivered', `PO ${activeReceivePOData.poNumber} natanggap (GRPO ${(document.getElementById('recv-po-grpo')?.value || '').trim() || '—'})`);
    notify(['accounting'], `PO natanggap — para sa A/P: ${activeReceivePOData.poNumber}`, `${userName} ay nag-receive ng PO ${activeReceivePOData.poNumber} (${activeReceivePOData.vendorName}). Invoice: ${invNo}. Halaga: ${money(actualGrandTotal)}. Pakilagay ang GRPO#/A/P Invoice#.`);
    await logSystemAction('VENDOR_PO_RECEIVED', `Na-receive ang PO ${activeReceivePOData.poNumber}. Invoice: ${invNo}. Billed Total: ₱${actualGrandTotal}`);
    
    alert(`🎉 Tagumpay! Na-receive na ang items.

Naidagdag na ang mga ito sa Live Inventory at nai-forward ang ₱${actualGrandTotal} bill sa Accounts Payable!`);
    document.getElementById('admin-receive-po-modal').style.display = 'none';
    loadAdminVendorPOs();
    loadAdminAPInvoices();
  } catch (err) {
    alert('Error sa pag-save: ' + err.message);
  }
}

async function loadAdminAPInvoices() {
  const tbody = document.getElementById('admin-ap-invoice-tbody');
  if (!tbody || !db) return;

  try {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align: center;">Kinukuha ang AP records...</td></tr>';
    
    const snap = await db.collection('vendor_pos').limit(200).get();
      
    window.allAPInvoices = [];
    snap.forEach(doc => {
      const d = doc.data();
      const st = d.status || '';
      if (st.includes('Received') || st.includes('AP') || st.includes('Check') || st.includes('Paid')) {
        window.allAPInvoices.push({ id: doc.id, ...d });
      }
    });

    window.allAPInvoices.sort((a, b) => {
      const tA = a.receivedAt?.seconds || a.createdAt?.seconds || 0;
      const tB = b.receivedAt?.seconds || b.createdAt?.seconds || 0;
      return tB - tA;
    });
    
    filterAdminAPInvoices();
  } catch (err) {
    console.error('Error loading AP Invoices:', err);
    tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: red;">Error: ${err.message}</td></tr>`;
  }
}

function filterAdminAPInvoices() {
  const tbody = document.getElementById('admin-ap-invoice-tbody');
  const q = document.getElementById('admin-ap-search')?.value.toLowerCase().trim() || '';
  if (!tbody) return;
  
  if (!window.allAPInvoices || window.allAPInvoices.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; color: #94a3b8; padding: 1.5rem;">Walang nakabinbing AP Invoices.</td></tr>';
    return;
  }
  
  const filtered = window.allAPInvoices.filter(ap => {
    return (ap.poNumber || '').toLowerCase().includes(q) || 
           (ap.vendorName || '').toLowerCase().includes(q) || 
           (ap.vendorInvoiceNo || '').toLowerCase().includes(q) ||
           (ap.status || '').toLowerCase().includes(q);
  });
  
  if (filtered.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; color: #94a3b8; padding: 1.5rem;">Walang tugma sa paghahanap.</td></tr>';
    return;
  }
  
  let html = '';
  filtered.forEach(ap => {
    const rcvDate = ap.receivedAt ? new Date(ap.receivedAt.toDate ? ap.receivedAt.toDate() : ap.receivedAt).toLocaleDateString() : 'N/A';
    const expTotal = parseFloat(ap.totalAmount || 0).toLocaleString('en-PH', { style: 'currency', currency: 'PHP' });
    const actTotal = parseFloat(ap.actualTotalAmount || ap.totalAmount || 0).toLocaleString('en-PH', { style: 'currency', currency: 'PHP' });
    const st = ap.status || 'Received / AP';

    let badgeClass = 'badge-warning';
    if (st.includes('Signing')) badgeClass = 'badge-commissary';
    if (st.includes('Deposit')) badgeClass = 'badge-admin';
    if (st.includes('Paid')) badgeClass = 'badge-branch';

    html += `<tr>
      <td><b>${ap.poNumber}</b><br><small style="color: #b91c1c;">INV: ${ap.vendorInvoiceNo || '--'}</small>${poSapRefsHtml(ap)}</td>
      <td><b>${ap.vendorName}</b></td>
      <td>${rcvDate}</td>
      <td style="color: #64748b;"><s>${expTotal}</s></td>
      <td><b style="color: #059669; font-size: 1.05rem;">${actTotal}</b></td>
      <td><span class="badge ${badgeClass}">${st}</span>${ap.dpAmount ? `<br><small style="color:#7c3aed;">DP ${money(ap.dpAmount)} • Balance ${money(Math.max(0,parseFloat(ap.actualTotalAmount||0)-parseFloat(ap.dpAmount||0)))}</small>` : ''}</td>
      <td>
        <button class="btn btn-sm btn-secondary" style="margin-bottom:4px;" onclick="poEditSapRefs('${ap.id}')">🏷️ SAP Refs</button>
        ${st === 'Paid & Closed' ? '' : `<button class="btn btn-sm btn-secondary" style="margin-bottom:4px;" onclick="poDownPayment('${ap.id}')">💵 Down Payment</button>`}<br>
        <select onchange="updateAPPOStatus('${ap.id}', this.value)" style="font-size: 0.8rem; padding: 0.3rem 0.5rem; border-radius: 4px; border: 1px solid #cbd5e1;">
          <option value="Received / AP" ${st === 'Received / AP' ? 'selected' : ''}>1. Received / A/P Invoice (For Checking)</option>
          <option value="For Check Preparation" ${st === 'For Check Preparation' ? 'selected' : ''}>2. For Payment – Check Preparation</option>
          <option value="For Check Signing" ${st === 'For Check Signing' ? 'selected' : ''}>3. For Check Signing (COO)</option>
          <option value="For Deposit / Release" ${st === 'For Deposit / Release' ? 'selected' : ''}>4. For Deposit / Release</option>
          <option value="Paid & Closed" ${st === 'Paid & Closed' ? 'selected' : ''}>5. Paid & Closed</option>
        </select>
      </td>
    </tr>`;
  });
  tbody.innerHTML = html;
}

async function updateAPPOStatus(poId, newStatus) {
  if (!db) return;
  try {
    const poRef = db.collection('vendor_pos').doc(poId);
    const glRef = db.collection('general_ledger').doc('PAY-' + poId); // nakatakdang ID: hindi puwedeng madoble
    let posted = false, reqKey = '';

    await db.runTransaction(async tx => {
      const poSnap = await tx.get(poRef);
      if (!poSnap.exists) throw new Error('Hindi nahanap ang PO.');
      const po = poSnap.data(); reqKey = po.requestKey || '';

      if (po.status === 'Paid & Closed' && newStatus !== 'Paid & Closed') {
        throw new Error('Paid & Closed na ang PO na ito at naka-post na sa General Ledger. Hindi na puwedeng baguhin ang status (gumawa ng adjustment entry sa GL kung may mali).');
      }

      const upd = {
        status: newStatus,
        statusUpdatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        statusUpdatedBy: getCurrentUser()?.name || 'Accounting'
      };

      if (newStatus === 'Paid & Closed') {
        const glSnap = await tx.get(glRef);
        if (!po.glPaymentPosted && !glSnap.exists) {
          tx.set(glRef, {
            type: 'Supplier Payment (PO)',
            ref: `Paid PO ${po.poNumber || poId} - ${po.vendorName || ''}`,
            credit: Math.max(0, parseFloat(po.actualTotalAmount || 0) - parseFloat(po.dpAmount || 0)),
            debit: 0,
            sourcePO: poId,
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
          });
          posted = true;
        }
        upd.glPaymentPosted = true;
      }
      tx.update(poRef, upd);
    });

    if (reqKey) { if (newStatus === 'Paid & Closed') reqSyncFromPO(reqKey, 'Paid', `PO ${poId} Paid & Closed (cheque na)`, { poStatus: 'Paid & Closed' }); else if (/Check|Deposit|Release/i.test(newStatus)) reqSyncFromPO(reqKey, 'For Payment', `Accounting: ${newStatus}`, { poStatus: newStatus }); }
    logSystemAction('AP_STATUS_UPDATED', `In-update ang status ng PO ${poId} papuntang: ${newStatus}${posted ? ' (na-post sa GL)' : ''}`);
    loadAdminAPInvoices();
  } catch (err) {
    alert('Error updating status: ' + err.message);
    loadAdminAPInvoices();
  }
}





// ==========================================
// HRM, PAYROLL & FINANCE MODULES
// ==========================================

let hrEmployees = [];

async function loadAdminEmployees() {
  const tbody = document.getElementById('admin-employees-tbody');
  if (!tbody || !db) return;
  try {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align: center;">Loading...</td></tr>';
    const snap = await db.collection('employees').get();
    hrEmployees = [];
    snap.forEach(d => hrEmployees.push({id: d.id, ...d.data()}));
    filterAdminEmployees();
  } catch(e) { console.error(e); }
}

function filterAdminEmployees() {
  const tbody = document.getElementById('admin-employees-tbody');
  const q = document.getElementById('admin-employee-search')?.value.toLowerCase() || '';
  if(!tbody) return;
  
  const filtered = hrEmployees.filter(e => (e.name||'').toLowerCase().includes(q) || (e.role||'').toLowerCase().includes(q) || empCompanyList(e).join(' ').toLowerCase().includes(q));
  if(filtered.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align: center;">Walang empleyado.</td></tr>';
    return;
  }
  
  let html = '';
  filtered.forEach(e => {
    const reqHave = EMP_DOC_REQUIRED.filter(k => (e.docKeys || []).includes(k)).length;
    const reqBadge = `<span class="badge badge-${reqHave === EMP_DOC_REQUIRED.length ? 'branch' : (reqHave === 0 ? 'danger' : 'warning')}" title="NBI, Police, Barangay, PSA, Medical, ID, 2x2">📎 ${reqHave}/${EMP_DOC_REQUIRED.length}</span>`;
    html += `<tr>
      <td><span style="font-family: monospace;">${e.empId || e.id}</span></td>
      <td><b>${e.name}</b>${empCompanyList(e).length ? '<div style="margin-top:3px;">' + empCompanyList(e).map(c => `<span class="co-chip">🏢 ${srchEsc(c)}</span>`).join('') + '</div>' : ''}</td>
      <td>${e.role} / ${e.dept}</td>
      <td>₱${parseFloat(e.baseSalary||0).toFixed(2)}</td>
      <td><span class="badge badge-${e.status==='Active'?'branch':'secondary'}">${e.status}</span></td>
      <td>${reqBadge}</td>
      <td><button class="btn btn-sm btn-primary" onclick="openEmployeeModal('${e.id}')">Edit / Docs</button></td>
    </tr>`;
  });
  tbody.innerHTML = html;
}

// ========================================================
// 📎 EMPLOYEE DOCUMENTS (NBI, Police, Barangay, atbp. requirements)
// Nakaimbak sa employees/{id}/documents/{docId}: litrato (naka-compress) o PDF bilang data URL.
// Limitasyon ng Firestore: ~1MB kada dokumento, kaya awtomatikong kinukumpress ang larawan at
// ang PDF ay hanggang ~600KB lang. (Kung kailangan ng mas malalaking file, gagamit ng Firebase Storage.)
// ========================================================
const EMP_DOC_TYPES = [
  { key: 'nbi',       label: '🪪 NBI Clearance',                required: true, validity: true },
  { key: 'police',    label: '👮 Police Clearance',             required: true, validity: true },
  { key: 'barangay',  label: '🏘️ Barangay Clearance',           required: true, validity: true },
  { key: 'psa_birth', label: '📜 PSA Birth Certificate',        required: true },
  { key: 'medical',   label: '🩺 Medical / Health Certificate', required: true, validity: true },
  { key: 'valid_id',  label: '🆔 Valid Government ID',          required: true },
  { key: 'photo_2x2', label: '🖼️ 2x2 ID Photo',                 required: true },
  { key: 'sss_doc',   label: 'SSS (E-1 / ID)' },
  { key: 'phic_doc',  label: 'PhilHealth (MDR)' },
  { key: 'hdmf_doc',  label: 'Pag-IBIG (MDF)' },
  { key: 'tin_doc',   label: 'TIN ID / BIR 1902' },
  { key: 'contract',  label: '📝 Employment Contract' },
  { key: 'resume',    label: '📄 Resume / Application Form' }
];
const EMP_DOC_REQUIRED = EMP_DOC_TYPES.filter(t => t.required).map(t => t.key);
const EMP_DOC_MAX_CHARS = 900000;   // limit ng data URL (Firestore doc ≤ 1,048,576 bytes)
const EMP_DOC_MAX_PDF_BYTES = 600 * 1024;
let empDocsCache = {};
let empDocsEmpId = '';
let empDocPendingOtherLabel = '';
let empDocPreviewUrl = null;

function empDocsCanEdit() { return typeof canEditModule !== 'function' || canEditModule('employees'); }

function empDocValidityBadge(d) {
  if (!d.validUntil) return '';
  const days = Math.ceil((new Date(d.validUntil + 'T00:00:00') - new Date()) / 86400000);
  if (isNaN(days)) return '';
  if (days < 0) return `<span class="badge badge-danger">Expired (${-days} araw na)</span>`;
  if (days <= 30) return `<span class="badge badge-warning">Mag-eexpire sa ${days} araw</span>`;
  return `<span class="badge badge-branch">Valid hanggang ${d.validUntil}</span>`;
}

async function renderEmployeeDocsSection(empId) {
  const root = document.getElementById('hr-emp-docs-root');
  if (!root) return;
  empDocsEmpId = empId || '';
  if (!empId) {
    root.innerHTML = '<div class="emp-doc-note">💡 I-save muna ang empleyado (Save Employee Details). Pagkatapos ay babalik ang form na ito at puwede ka nang mag-upload ng NBI, Police, Barangay at iba pang dokumento.</div>';
    return;
  }
  root.innerHTML = '<div class="emp-doc-note">Kinukuha ang mga dokumento...</div>';
  empDocsCache = {};
  try {
    const snap = await db.collection('employees').doc(empId).collection('documents').get();
    snap.forEach(d => { empDocsCache[d.id] = d.data(); });
  } catch (e) {
    root.innerHTML = `<div class="emp-doc-note" style="color:#ef4444;">Hindi makuha ang mga dokumento: ${srchEsc(e.message)}</div>`;
    return;
  }
  const editable = empDocsCanEdit();
  const have = EMP_DOC_REQUIRED.filter(k => empDocsCache[k]).length;

  const card = (docId, label, d, validity) => {
    const isImg = d && (d.mime || '').startsWith('image/');
    const thumb = d ? (isImg ? `<img class="emp-doc-thumb" src="${d.dataUrl}" alt="" onclick="viewEmployeeDoc('${docId}')">` : `<div class="emp-doc-thumb emp-doc-pdf" onclick="viewEmployeeDoc('${docId}')">📄 PDF</div>`) : `<div class="emp-doc-thumb emp-doc-empty">Wala pa</div>`;
    const when = d && d.uploadedAt && d.uploadedAt.toDate ? d.uploadedAt.toDate().toLocaleDateString() : '';
    const meta = d ? `<small>${srchEsc(d.fileName || '')} · ${Math.round((d.size || 0) / 1024)} KB${when ? ' · ' + when : ''}${d.uploadedBy ? ' · ' + srchEsc(d.uploadedBy) : ''}</small>` : '<small style="color:#94a3b8;">Wala pang na-upload</small>';
    const valid = d && validity ? `<div style="margin-top:4px;">${empDocValidityBadge(d)}${editable ? ` <label class="emp-doc-valid">Valid hanggang: <input type="date" value="${d.validUntil || ''}" onchange="updateEmployeeDocValidity('${docId}', this.value)"></label>` : ''}</div>` : '';
    const actions = d
      ? `<button type="button" class="btn btn-secondary btn-sm" onclick="viewEmployeeDoc('${docId}')">👁️ View</button>` +
        (editable ? `<button type="button" class="btn btn-primary btn-sm" onclick="document.getElementById('emp-doc-file-${docId}').click()">🔄 Palitan</button>
                     <button type="button" class="btn btn-danger btn-sm" onclick="deleteEmployeeDoc('${docId}')">🗑️ Delete</button>` : '')
      : (editable ? `<button type="button" class="btn btn-success btn-sm" onclick="document.getElementById('emp-doc-file-${docId}').click()">⬆️ Upload</button>` : '');
    return `<div class="emp-doc-card ${d ? 'has-file' : ''}">
      ${thumb}
      <div class="emp-doc-info">
        <b>${label}</b>${d ? '' : ''}
        <div>${meta}</div>${valid}
        <div class="emp-doc-actions">${actions}</div>
        <input type="file" id="emp-doc-file-${docId}" accept="image/*,application/pdf" style="display:none" onchange="uploadEmployeeDoc('${docId}', this)">
      </div>
    </div>`;
  };

  let html = `<div class="emp-doc-summary">Requirements: <b>${have}/${EMP_DOC_REQUIRED.length}</b> kumpleto ${have === EMP_DOC_REQUIRED.length ? '✅' : '⚠️'}</div><div class="emp-doc-grid">`;
  EMP_DOC_TYPES.forEach(t => { html += card(t.key, t.label, empDocsCache[t.key], !!t.validity); });
  Object.keys(empDocsCache).filter(k => k.startsWith('other_')).forEach(k => {
    html += card(k, '📎 ' + srchEsc(empDocsCache[k].label || 'Iba pang dokumento'), empDocsCache[k], false);
  });
  html += '</div>';
  if (editable) {
    html += `<div style="margin-top:0.75rem;">
      <button type="button" class="btn btn-secondary btn-sm" onclick="addOtherEmployeeDoc()">➕ Magdagdag ng ibang dokumento</button>
      <input type="file" id="emp-doc-file-other" accept="image/*,application/pdf" style="display:none" onchange="uploadEmployeeDoc('other_new', this)">
    </div>`;
  }
  html += '<small style="display:block; margin-top:0.5rem; color:#64748b;">Ang larawan ay awtomatikong kinukumpress. PDF: hanggang 600KB.</small>';
  root.innerHTML = html;
}

async function addOtherEmployeeDoc() {
  const label = (await uiPrompt('Anong dokumento ito? (hal. Diploma, Training Certificate)') || '').trim();
  if (!label) return;
  empDocPendingOtherLabel = label;
  document.getElementById('emp-doc-file-other').click();
}

function empReadAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}
// Paliitin ang larawan hanggang magkasya sa limit ng Firestore
async function empCompressImageToLimit(file) {
  const src = await empReadAsDataUrl(file);
  const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });
  for (const dim of [1600, 1280, 1024, 800, 640]) {
    const scale = Math.min(1, dim / Math.max(img.width, img.height));
    const cv = document.createElement('canvas');
    cv.width = Math.round(img.width * scale);
    cv.height = Math.round(img.height * scale);
    cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
    for (const q of [0.85, 0.7, 0.55]) {
      const out = cv.toDataURL('image/jpeg', q);
      if (out.length <= EMP_DOC_MAX_CHARS) return out;
    }
  }
  throw new Error('Masyadong malaki ang larawan kahit na-compress. Subukan ang mas maliit na larawan.');
}

async function uploadEmployeeDoc(docKey, input) {
  const file = input.files && input.files[0];
  input.value = '';
  if (!file || !empDocsEmpId || !db) return;
  if (!empDocsCanEdit()) { alert('⚠️ Walang karapatan ang account mo na mag-edit ng Employee records.'); return; }

  const isImg = file.type.startsWith('image/');
  const isPdf = file.type === 'application/pdf';
  if (!isImg && !isPdf) { alert('⚠️ Larawan (JPG/PNG) o PDF lang ang puwede.'); return; }
  if (isPdf && file.size > EMP_DOC_MAX_PDF_BYTES) {
    alert(`⚠️ Masyadong malaki ang PDF (${Math.round(file.size / 1024)} KB). Hanggang ${Math.round(EMP_DOC_MAX_PDF_BYTES / 1024)} KB lang. Paliitin muna o kunan ng litrato.`);
    return;
  }

  let docId = docKey, label, validity = false;
  if (docKey === 'other_new') {
    docId = 'other_' + Date.now();
    label = empDocPendingOtherLabel || 'Iba pang dokumento';
  } else {
    const t = EMP_DOC_TYPES.find(x => x.key === docKey);
    label = t ? t.label : (empDocsCache[docKey] && empDocsCache[docKey].label) || docKey;
    validity = !!(t && t.validity);
  }

  try {
    const dataUrl = isImg ? await empCompressImageToLimit(file) : await empReadAsDataUrl(file);
    if (dataUrl.length > EMP_DOC_MAX_CHARS) throw new Error('Masyadong malaki ang file.');
    const old = empDocsCache[docId] || {};
    const u = getCurrentUser();
    const empRef = db.collection('employees').doc(empDocsEmpId);
    const batch = db.batch();
    batch.set(empRef.collection('documents').doc(docId), {
      type: docKey === 'other_new' ? 'other' : docKey,
      label: label.replace(/<[^>]*>/g, ''),
      fileName: file.name,
      mime: isImg ? 'image/jpeg' : 'application/pdf',
      size: Math.round(dataUrl.length * 0.75),
      dataUrl: dataUrl,
      validUntil: old.validUntil || '',
      uploadedBy: (u && (u.name || u.email)) || 'HR',
      uploadedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    batch.update(empRef, { docKeys: firebase.firestore.FieldValue.arrayUnion(docId) });
    await batch.commit();
    await logSystemAction(old.dataUrl ? 'EMP_DOC_REPLACED' : 'EMP_DOC_UPLOADED', `${old.dataUrl ? 'Pinalitan' : 'Nag-upload ng'} dokumento (${label}) para sa employee ${empDocsEmpId}`);
    const e = hrEmployees.find(x => x.id === empDocsEmpId);
    if (e) { e.docKeys = Array.from(new Set([...(e.docKeys || []), docId])); filterAdminEmployees(); }
    alert('✅ Na-upload ang dokumento.');
    renderEmployeeDocsSection(empDocsEmpId);
  } catch (err) {
    alert('Error sa pag-upload: ' + err.message);
  }
}

async function updateEmployeeDocValidity(docId, value) {
  if (!empDocsEmpId || !db || !empDocsCanEdit()) return;
  try {
    await db.collection('employees').doc(empDocsEmpId).collection('documents').doc(docId).update({ validUntil: value || '' });
    if (empDocsCache[docId]) empDocsCache[docId].validUntil = value || '';
    renderEmployeeDocsSection(empDocsEmpId);
  } catch (err) { alert('Error: ' + err.message); }
}

async function deleteEmployeeDoc(docId) {
  const d = empDocsCache[docId];
  if (!d || !empDocsEmpId || !db) return;
  if (!empDocsCanEdit()) { alert('⚠️ Walang karapatan ang account mo na mag-edit ng Employee records.'); return; }
  if (!await uiConfirm(`Burahin ang "${d.label || docId}" (${d.fileName || ''})? Hindi na ito mababawi.`)) return;
  try {
    const empRef = db.collection('employees').doc(empDocsEmpId);
    const batch = db.batch();
    batch.delete(empRef.collection('documents').doc(docId));
    batch.update(empRef, { docKeys: firebase.firestore.FieldValue.arrayRemove(docId) });
    await batch.commit();
    await logSystemAction('EMP_DOC_DELETED', `Binura ang dokumento (${d.label || docId}) ng employee ${empDocsEmpId}`);
    const e = hrEmployees.find(x => x.id === empDocsEmpId);
    if (e) { e.docKeys = (e.docKeys || []).filter(k => k !== docId); filterAdminEmployees(); }
    alert('🗑️ Nabura ang dokumento.');
    renderEmployeeDocsSection(empDocsEmpId);
  } catch (err) { alert('Error: ' + err.message); }
}

async function viewEmployeeDoc(docId) {
  const d = empDocsCache[docId];
  if (!d) return;
  closeEmployeeDocPreview();
  let content;
  if ((d.mime || '').startsWith('image/')) {
    content = `<img src="${d.dataUrl}" style="max-width:100%; max-height:75vh; display:block; margin:0 auto;" alt="">`;
  } else {
    const blob = await (await fetch(d.dataUrl)).blob();
    empDocPreviewUrl = URL.createObjectURL(blob);
    content = `<iframe src="${empDocPreviewUrl}" style="width:100%; height:75vh; border:1px solid #e2e8f0; border-radius:6px;"></iframe>`;
  }
  const m = document.createElement('div');
  m.id = 'emp-doc-preview-modal';
  m.className = 'modal-overlay';
  m.style.zIndex = '10001';
  m.innerHTML = `<div class="modal-content" style="max-width: 900px; width: 95%;">
    <div style="display:flex; justify-content:space-between; align-items:center; gap:0.5rem; margin-bottom:0.75rem;">
      <b>${srchEsc(d.label || docId)}</b>
      <span style="display:flex; gap:0.4rem;">
        <a class="btn btn-secondary btn-sm" href="${d.dataUrl}" download="${srchEsc(d.fileName || docId)}">⬇️ Download</a>
        <button type="button" class="btn btn-secondary btn-sm" onclick="closeEmployeeDocPreview()">✕ Isara</button>
      </span>
    </div>${content}</div>`;
  m.addEventListener('click', e => { if (e.target === m) closeEmployeeDocPreview(); });
  document.body.appendChild(m);
}
function closeEmployeeDocPreview() {
  const m = document.getElementById('emp-doc-preview-modal');
  if (m) m.remove();
  if (empDocPreviewUrl) { URL.revokeObjectURL(empDocPreviewUrl); empDocPreviewUrl = null; }
}

function openEmployeeModal(id = null) {
  if (id) {
    const e = hrEmployees.find(x => x.id === id);
    if(e) {
      document.getElementById('hr-emp-id').value = e.id || '';
      document.getElementById('hr-emp-fname').value = e.fname || e.name || ''; // Fallback to name if old data
      document.getElementById('hr-emp-lname').value = e.lname || '';
      document.getElementById('hr-emp-mname').value = e.mname || '';
      document.getElementById('hr-emp-nickname').value = e.nickname || '';
      document.getElementById('hr-emp-dob').value = e.dob || '';
      document.getElementById('hr-emp-civil').value = e.civilStatus || 'Single';
      document.getElementById('hr-emp-contact').value = e.contact || '';
      document.getElementById('hr-emp-email').value = e.email || '';
      document.getElementById('hr-emp-address').value = e.address || '';
      
      renderCompanyChecks('hr-emp-companies', empCompanyList(e)); hrFillBranches(e.branchCode || '');
      document.getElementById('hr-emp-dept').value = e.dept || '';
      document.getElementById('hr-emp-subdept').value = e.subdept || '';
      document.getElementById('hr-emp-role').value = e.role || '';
      document.getElementById('hr-emp-class').value = e.classification || 'Rank & File';
      document.getElementById('hr-emp-type').value = e.employmentType || 'Regular';
      document.getElementById('hr-emp-hiredate').value = e.hireDate || '';
      document.getElementById('hr-emp-directdate').value = e.directHireDate || '';
      document.getElementById('hr-emp-regulardate').value = e.regularizationDate || '';
      document.getElementById('hr-emp-reportingto').value = e.reportingTo || '';
      document.getElementById('hr-emp-status').value = e.status || 'Active';
      
      document.getElementById('hr-emp-sss').value = e.sss || '';
      document.getElementById('hr-emp-phic').value = e.phic || '';
      document.getElementById('hr-emp-hdmf').value = e.hdmf || '';
      document.getElementById('hr-emp-tin').value = e.tin || '';
      document.getElementById('hr-emp-rdo').value = e.rdo || '';
      
      document.getElementById('hr-emp-paytype').value = e.payrollType || 'Daily';
      document.getElementById('hr-emp-bdo').value = e.bdoAccount || '';
      document.getElementById('hr-emp-salary').value = e.baseSalary || 0;
      document.getElementById('hr-emp-allowance').value = e.allowance || 0;
      document.getElementById('hr-emp-deminimis').value = e.deminimis || 0;
      document.getElementById('hr-emp-leaves').value = e.leaveEntitlement || 0;
      document.getElementById('hr-emp-sssloan').value = e.sssLoan || '';
      document.getElementById('hr-emp-hdmfloan').value = e.hdmfLoan || '';
      document.getElementById('hr-emp-emerperson').value = e.emergencyContactPerson || '';
      document.getElementById('hr-emp-emerno').value = e.emergencyContactNo || '';

      document.getElementById('hr-emp-title').innerText = '✏️ Edit Employee';
      renderEmployeeDocsSection(e.id);
    }
  } else {
    // Clear all fields
    const inputs = document.querySelectorAll('#hr-employee-modal input');
    inputs.forEach(i => { if (i.type === 'number') i.value = '0'; else i.value = ''; });
    document.getElementById('hr-emp-status').value = 'Active';
    document.getElementById('hr-emp-civil').value = 'Single';
    document.getElementById('hr-emp-class').value = 'Rank & File';
    document.getElementById('hr-emp-type').value = 'Regular';
    document.getElementById('hr-emp-paytype').value = 'Daily';

    document.getElementById('hr-emp-title').innerText = '➕ Add Employee';
    renderCompanyChecks('hr-emp-companies', []); hrFillBranches('');
    renderEmployeeDocsSection('');
  }
  document.getElementById('hr-employee-modal').style.display = 'flex';
}

async function saveEmployee() {
  const id = document.getElementById('hr-emp-id').value;
  const fname = document.getElementById('hr-emp-fname').value.trim();
  const lname = document.getElementById('hr-emp-lname').value.trim();
  
  if(!fname) { alert("Ang First Name ay kailangan."); return; }
  
  const fullName = lname ? `${fname} ${lname}` : fname;
  
  const payload = {
    fname: fname,
    lname: lname,
    mname: document.getElementById('hr-emp-mname').value.trim(),
    nickname: document.getElementById('hr-emp-nickname').value.trim(),
    name: fullName, // Fallback combined name
    dob: document.getElementById('hr-emp-dob').value,
    civilStatus: document.getElementById('hr-emp-civil').value,
    contact: document.getElementById('hr-emp-contact').value.trim(),
    email: document.getElementById('hr-emp-email').value.trim(),
    address: document.getElementById('hr-emp-address').value.trim(),
    
    companies: readCompanyChecks('hr-emp-companies') || [],
    company: (readCompanyChecks('hr-emp-companies') || []).join(', '),
    branchCode: (document.getElementById('hr-emp-branch') || {}).value || '',
    branch: (() => { const sel = document.getElementById('hr-emp-branch'); const o = sel && sel.options[sel.selectedIndex]; return o && sel.value ? (o.dataset.name || '') : ''; })(),
    dept: document.getElementById('hr-emp-dept').value.trim(),
    subdept: document.getElementById('hr-emp-subdept').value.trim(),
    role: document.getElementById('hr-emp-role').value.trim(),
    classification: document.getElementById('hr-emp-class').value,
    employmentType: document.getElementById('hr-emp-type').value,
    hireDate: document.getElementById('hr-emp-hiredate').value,
    directHireDate: document.getElementById('hr-emp-directdate').value,
    regularizationDate: document.getElementById('hr-emp-regulardate').value,
    reportingTo: document.getElementById('hr-emp-reportingto').value.trim(),
    status: document.getElementById('hr-emp-status').value,
    
    sss: document.getElementById('hr-emp-sss').value.trim(),
    phic: document.getElementById('hr-emp-phic').value.trim(),
    hdmf: document.getElementById('hr-emp-hdmf').value.trim(),
    tin: document.getElementById('hr-emp-tin').value.trim(),
    rdo: document.getElementById('hr-emp-rdo').value.trim(),
    
    payrollType: document.getElementById('hr-emp-paytype').value,
    bdoAccount: document.getElementById('hr-emp-bdo').value.trim(),
    baseSalary: parseFloat(document.getElementById('hr-emp-salary').value || 0),
    allowance: parseFloat(document.getElementById('hr-emp-allowance').value || 0),
    deminimis: parseFloat(document.getElementById('hr-emp-deminimis').value || 0),
    leaveEntitlement: parseFloat(document.getElementById('hr-emp-leaves').value || 0),
    sssLoan: document.getElementById('hr-emp-sssloan').value.trim(),
    hdmfLoan: document.getElementById('hr-emp-hdmfloan').value.trim(),
    emergencyContactPerson: document.getElementById('hr-emp-emerperson').value.trim(),
    emergencyContactNo: document.getElementById('hr-emp-emerno').value.trim(),
    
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  };
  
  let newEmpId = null;
  try {
    let actionStr = `Nag-add ng bagong employee: ${fullName}`;
    if (id) {
      const oldEmp = hrEmployees.find(e => e.id === id);
      let diffLog = [];
      if (oldEmp) {
        if ((oldEmp.name || '') !== fullName) diffLog.push(`Name ('${oldEmp.name}' ➔ '${fullName}')`);
        if ((oldEmp.role || '') !== payload.role) diffLog.push(`Role ('${oldEmp.role}' ➔ '${payload.role}')`);
        if ((oldEmp.status || '') !== payload.status) diffLog.push(`Status ('${oldEmp.status}' ➔ '${payload.status}')`);
        if (parseFloat(oldEmp.baseSalary || 0) !== payload.baseSalary) diffLog.push(`Base Salary (₱${oldEmp.baseSalary || 0} ➔ ₱${payload.baseSalary})`);
      }
      
      await db.collection('employees').doc(id).update(payload);
      actionStr = diffLog.length > 0 ? `In-edit ang employee ${oldEmp?.empId || id}. Binago: ` + diffLog.join(', ') : `In-edit ang employee ${oldEmp?.empId || id} (Walang binago).`;
    } else {
      payload.empId = 'EMP-' + Date.now().toString().slice(-5);
      payload.createdAt = firebase.firestore.FieldValue.serverTimestamp();
      const newRef = await db.collection('employees').add(payload);
      newEmpId = newRef.id;
    }
    await logSystemAction(id ? 'EMPLOYEE_EDITED' : 'EMPLOYEE_ADDED', actionStr);
    alert('✅ Na-save ang empleyado!');
    if (newEmpId) {
      // Bagong empleyado: buksan ulit sa edit mode para makapag-upload na ng NBI, Police, Barangay, atbp.
      await loadAdminEmployees();
      openEmployeeModal(newEmpId);
      alert('📎 Puwede ka nang mag-upload ng NBI, Police, Barangay at iba pang dokumento sa ibaba ng form.');
      return;
    }
    document.getElementById('hr-employee-modal').style.display = 'none';
    loadAdminEmployees();
  } catch(e) { alert(e.message); }
}


// ========================================================
// 💰 KENJI TEI STYLE SALARY SLIP ENGINE & NUMBER-TO-WORDS
// ========================================================

function numberToWordsPHP(num) {
  if (isNaN(num) || num === null || num === undefined) return 'Zero Pesos Only';
  const a = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  function inWords(n) {
    if (n === 0) return '';
    if (n < 20) return a[n] + ' ';
    if (n < 100) return b[Math.floor(n / 10)] + (n % 10 !== 0 ? '-' + a[n % 10] : '') + ' ';
    if (n < 1000) return a[Math.floor(n / 100)] + ' Hundred ' + inWords(n % 100);
    if (n < 1000000) return inWords(Math.floor(n / 1000)) + 'Thousand ' + inWords(n % 1000);
    if (n < 1000000000) return inWords(Math.floor(n / 1000000)) + 'Million ' + inWords(n % 1000000);
    return inWords(Math.floor(n / 1000000000)) + 'Billion ' + inWords(n % 1000000000);
  }

  const parts = Number(num).toFixed(2).split('.');
  let pesos = parseInt(parts[0], 10);
  let centavos = parseInt(parts[1], 10);

  let pesoWords = pesos === 0 ? 'Zero Pesos' : inWords(pesos).trim() + ' Pesos';
  let centavoWords = '';
  if (centavos > 0) {
    centavoWords = ' And ' + inWords(centavos).trim() + ' Centavos';
  }
  return (pesoWords + centavoWords + ' Only').replace(/\s+/g, ' ');
}

let activePayrollEmployeeObj = null;

function closePayrollModal() {
  const m = document.getElementById('hr-payroll-modal');
  if (m) m.style.display = 'none';
}


async function openPayrollModal() {
  if (typeof hrEmployees === 'undefined' || hrEmployees.length === 0) {
    if (typeof loadAdminEmployees === 'function') await loadAdminEmployees();
  }

  const sel = document.getElementById('pay-emp-select');
  if (sel) {
    sel.innerHTML = '<option value="">-- Pumili ng Empleyado --</option>';
    (hrEmployees || []).filter(e => e.status !== 'Resigned' && e.status !== 'Terminated').forEach(e => {
      const fullName = e.lname ? `${e.lname}, ${e.fname} ${e.mname || ''}`.trim() : (e.name || e.fname);
      sel.innerHTML += `<option value="${e.id || e.empId}">${fullName} (${e.role || 'Staff'})</option>`;
    });
  }

  logSystemAction('PAYROLL_FORM_OPENED', 'Binuksan ni Admin/HR ang Generate Salary Slip modal.');

  const modal = document.getElementById('hr-payroll-modal');
  if (modal) modal.style.display = 'flex';
}

function onPayrollEmpChange() {
  const empId = document.getElementById('pay-emp-select')?.value;
  activePayrollEmployeeObj = (hrEmployees || []).find(e => e.id === empId || e.empId === empId);
  if (!activePayrollEmployeeObj) return;

  const e = activePayrollEmployeeObj;
  
  if (document.getElementById('pay-company')) document.getElementById('pay-company').value = e.company || 'KTFGI';
  if (document.getElementById('pay-location')) document.getElementById('pay-location').value = e.dept || e.subdept || 'HO';
  
  const dailyRate = parseFloat(e.baseSalary || 0);
  if (document.getElementById('pay-daily-rate')) document.getElementById('pay-daily-rate').value = dailyRate;

  // Set default dates kung wala pa
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const d = now.getDate();
  
  let periodText = '';
  let sDate = '';
  let eDate = '';
  const monthName = now.toLocaleString('en-US', { month: 'short' }).toUpperCase();

  if (d <= 15) {
    periodText = `${monthName} 1-15, ${yyyy}`;
    sDate = `${yyyy}-${mm}-01`;
    eDate = `${yyyy}-${mm}-15`;
  } else {
    const lastDay = new Date(yyyy, now.getMonth() + 1, 0).getDate();
    periodText = `${monthName} 16-${lastDay}, ${yyyy}`;
    sDate = `${yyyy}-${mm}-16`;
    eDate = `${yyyy}-${mm}-${lastDay}`;
  }

  if (document.getElementById('pay-period-text')) document.getElementById('pay-period-text').value = periodText;
  if (document.getElementById('pay-start-date')) document.getElementById('pay-start-date').value = sDate;
  if (document.getElementById('pay-end-date')) document.getElementById('pay-end-date').value = eDate;

  // Auto-fill statutory defaults kung naka-save sa employee profile
  if (document.getElementById('pay-allowance-amt')) document.getElementById('pay-allowance-amt').value = parseFloat(e.allowance || 0);
  if (document.getElementById('pay-deminimis-amt')) document.getElementById('pay-deminimis-amt').value = parseFloat(e.deminimis || 0);
  
  // Calculate default basic
  const days = parseFloat(document.getElementById('pay-days-count')?.value || 13);
  if (document.getElementById('pay-basic-amt')) {
    document.getElementById('pay-basic-amt').value = (dailyRate * days).toFixed(2);
  }

  calculateSalarySlipLive();
}


function onNightDiffHoursChange() {
  const dailyRate = parseFloat(document.getElementById('pay-daily-rate')?.value || 0);
  const nightDiffHours = parseFloat(document.getElementById('pay-night-diff-hrs')?.value || 0);
  if (dailyRate > 0 && nightDiffHours >= 0) {
    const hourlyRate = dailyRate / 8;
    const computedND = parseFloat((hourlyRate * 0.10 * nightDiffHours).toFixed(2));
    const ndInput = document.getElementById('pay-night-diff');
    if (ndInput) ndInput.value = computedND;
  }
  calculateSalarySlipLive();
}

function calculateSalarySlipLive() {
  const dailyRate = parseFloat(document.getElementById('pay-daily-rate')?.value || 0);
  const days = parseFloat(document.getElementById('pay-days-count')?.value || 0);
  
  let basic = parseFloat(document.getElementById('pay-basic-amt')?.value || 0);
  const allowance = parseFloat(document.getElementById('pay-allowance-amt')?.value || 0);
  const deminimis = parseFloat(document.getElementById('pay-deminimis-amt')?.value || 0);
  const slRefund = parseFloat(document.getElementById('pay-sl-refund')?.value || 0);
  const leaveAmt = parseFloat(document.getElementById('pay-leave-amt')?.value || 0);
  const otherAllowance = parseFloat(document.getElementById('pay-other-allowance')?.value || 0);
  const adjBasic = parseFloat(document.getElementById('pay-adj-basic')?.value || 0);
  const otAdj = parseFloat(document.getElementById('pay-ot-adj')?.value || 0);
  const holAdj = parseFloat(document.getElementById('pay-holiday-adj')?.value || 0);

  // Overtime computation (Daily rate / 8 hrs * 1.25 OT multiplier)
  const otHours = parseFloat(document.getElementById('pay-ot-hrs')?.value || 0);
  let otAmt = parseFloat(document.getElementById('pay-ot-amt')?.value || 0);
  if (otHours > 0 && dailyRate > 0 && otAmt === 0) {
    const hourlyRate = dailyRate / 8;
    otAmt = parseFloat((hourlyRate * 1.25 * otHours).toFixed(2));
    if (document.getElementById('pay-ot-amt')) document.getElementById('pay-ot-amt').value = otAmt;
  }

  // Night Differential computation (10:00 PM to 6:00 AM - 10% premium ng hourly rate)
  const nightDiffHours = parseFloat(document.getElementById('pay-night-diff-hrs')?.value || 0);
  let nightDiff = parseFloat(document.getElementById('pay-night-diff')?.value || 0);
  if (nightDiffHours > 0 && dailyRate > 0 && nightDiff === 0) {
    const hourlyRate = dailyRate / 8;
    nightDiff = parseFloat((hourlyRate * 0.10 * nightDiffHours).toFixed(2));
    if (document.getElementById('pay-night-diff')) document.getElementById('pay-night-diff').value = nightDiff;
  }

  const specialHol = parseFloat(document.getElementById('pay-special-holiday')?.value || 0);
  const legalHol = parseFloat(document.getElementById('pay-legal-holiday')?.value || 0);

  const grossEarnings = basic + allowance + deminimis + slRefund + leaveAmt + otherAllowance + adjBasic + otAdj + holAdj + otAmt + specialHol + legalHol + nightDiff;

  // DEDUCTIONS
  const restdayWoPay = parseFloat(document.getElementById('pay-restday-wopay')?.value || 0);
  const absencesWoPay = parseFloat(document.getElementById('pay-absences-wopay')?.value || 0);
  
  // Late computation (Daily rate / 8 hrs / 60 mins)
  const lateMins = parseFloat(document.getElementById('pay-late-mins')?.value || 0);
  let lateAmt = parseFloat(document.getElementById('pay-late-amt')?.value || 0);
  if (lateMins > 0 && dailyRate > 0 && lateAmt === 0) {
    const minRate = (dailyRate / 8) / 60;
    lateAmt = parseFloat((minRate * lateMins).toFixed(2));
    if (document.getElementById('pay-late-amt')) document.getElementById('pay-late-amt').value = lateAmt;
  }

  const sssDec = parseFloat(document.getElementById('pay-sss-dec')?.value || 0);
  const sssAmt = parseFloat(document.getElementById('pay-sss-amt')?.value || 0);
  const sssLoan = parseFloat(document.getElementById('pay-sss-loan')?.value || 0);
  const hdmfAmt = parseFloat(document.getElementById('pay-hdmf-amt')?.value || 0);
  const hdmfLoan = parseFloat(document.getElementById('pay-hdmf-loan')?.value || 0);
  const phicAmt = parseFloat(document.getElementById('pay-phic-amt')?.value || 0);
  const taxAmt = parseFloat(document.getElementById('pay-tax-amt')?.value || 0);
  const caAmt = parseFloat(document.getElementById('pay-ca-amt')?.value || 0);
  const hmoAmt = parseFloat(document.getElementById('pay-hmo-amt')?.value || 0);

  const totalDeductions = restdayWoPay + absencesWoPay + lateAmt + sssDec + sssAmt + sssLoan + hdmfAmt + hdmfLoan + phicAmt + taxAmt + caAmt + hmoAmt;

  const netPay = Math.max(0, grossEarnings - totalDeductions);

  // Update Displays
  if (document.getElementById('pay-gross-display')) {
    document.getElementById('pay-gross-display').innerText = '₱' + grossEarnings.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  if (document.getElementById('pay-deduct-display')) {
    document.getElementById('pay-deduct-display').innerText = '₱' + totalDeductions.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  if (document.getElementById('pay-net-display')) {
    document.getElementById('pay-net-display').innerText = '₱' + netPay.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  if (document.getElementById('pay-net-words')) {
    document.getElementById('pay-net-words').innerText = numberToWordsPHP(netPay);
  }

  return {
    grossEarnings,
    totalDeductions,
    netPay,
    words: numberToWordsPHP(netPay)
  };
}

// 2-Step Save: Draft muna, walang bawas sa Cash on Hand
async function saveSalarySlipRecord(statusMode = 'Draft') {
  if (!activePayrollEmployeeObj) {
    alert('Mangyaring pumili muna ng empleyado.');
    return;
  }

  const calcs = calculateSalarySlipLive();
  const emp = activePayrollEmployeeObj;
  const fullName = emp.lname ? `${emp.lname}, ${emp.fname} ${emp.mname || ''}`.trim() : (emp.name || emp.fname);

  const payload = {
    empId: emp.empId || emp.id,
    empName: fullName,
    role: emp.role || 'Staff',
    company: document.getElementById('pay-company')?.value || 'KTFGI',
    location: document.getElementById('pay-location')?.value || 'HO',
    periodText: document.getElementById('pay-period-text')?.value || 'MAY 16-31, 2026',
    startDate: document.getElementById('pay-start-date')?.value || '',
    endDate: document.getElementById('pay-end-date')?.value || '',
    dailyRate: parseFloat(document.getElementById('pay-daily-rate')?.value || 0),
    daysWorked: parseFloat(document.getElementById('pay-days-count')?.value || 0),
    
    // Earnings Breakdown
    basic: parseFloat(document.getElementById('pay-basic-amt')?.value || 0),
    allowance: parseFloat(document.getElementById('pay-allowance-amt')?.value || 0),
    deminimis: parseFloat(document.getElementById('pay-deminimis-amt')?.value || 0),
    slRefund: parseFloat(document.getElementById('pay-sl-refund')?.value || 0),
    leaveDays: parseFloat(document.getElementById('pay-leave-days')?.value || 0),
    leaveAmt: parseFloat(document.getElementById('pay-leave-amt')?.value || 0),
    otherAllowance: parseFloat(document.getElementById('pay-other-allowance')?.value || 0),
    adjBasic: parseFloat(document.getElementById('pay-adj-basic')?.value || 0),
    otAdj: parseFloat(document.getElementById('pay-ot-adj')?.value || 0),
    holidayAdj: parseFloat(document.getElementById('pay-holiday-adj')?.value || 0),
    otHours: parseFloat(document.getElementById('pay-ot-hrs')?.value || 0),
    otAmt: parseFloat(document.getElementById('pay-ot-amt')?.value || 0),
    specialHoliday: parseFloat(document.getElementById('pay-special-holiday')?.value || 0),
    legalHoliday: parseFloat(document.getElementById('pay-legal-holiday')?.value || 0),
    nightDiffHours: parseFloat(document.getElementById('pay-night-diff-hrs')?.value || 0),
    nightDiff: parseFloat(document.getElementById('pay-night-diff')?.value || 0),
    grossEarnings: calcs.grossEarnings,

    // Deductions Breakdown
    restdayWoPay: parseFloat(document.getElementById('pay-restday-wopay')?.value || 0),
    absencesWoPay: parseFloat(document.getElementById('pay-absences-wopay')?.value || 0),
    lateMins: parseFloat(document.getElementById('pay-late-mins')?.value || 0),
    lateAmt: parseFloat(document.getElementById('pay-late-amt')?.value || 0),
    sssDec: parseFloat(document.getElementById('pay-sss-dec')?.value || 0),
    sssAmt: parseFloat(document.getElementById('pay-sss-amt')?.value || 0),
    sssLoan: parseFloat(document.getElementById('pay-sss-loan')?.value || 0),
    hdmfAmt: parseFloat(document.getElementById('pay-hdmf-amt')?.value || 0),
    hdmfLoan: parseFloat(document.getElementById('pay-hdmf-loan')?.value || 0),
    phicAmt: parseFloat(document.getElementById('pay-phic-amt')?.value || 0),
    taxAmt: parseFloat(document.getElementById('pay-tax-amt')?.value || 0),
    caAmt: parseFloat(document.getElementById('pay-ca-amt')?.value || 0),
    hmoAmt: parseFloat(document.getElementById('pay-hmo-amt')?.value || 0),
    totalDeductions: calcs.totalDeductions,

    // CA Summary
    caNoPay: document.getElementById('pay-ca-nopay')?.value || '',
    caSummaryAmt: parseFloat(document.getElementById('pay-ca-summary-amt')?.value || 0),
    caBalance: parseFloat(document.getElementById('pay-ca-balance')?.value || 0),

    // Net
    netPay: calcs.netPay,
    amountInWords: calcs.words,
    status: statusMode, // 'Draft' o 'Released / Paid'
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    createdBy: getCurrentUser()?.name || 'Admin'
  };

  try {
    const docRef = await db.collection('payrolls').add(payload);
    logSystemAction('PAYROLL_GENERATED', `Nag-generate ng payslip (${payload.periodText}) para kay ${payload.empName}. Gross: ₱${calcs.grossEarnings}, Net: ₱${calcs.netPay} (Status: ${statusMode})`);
    
    alert(`✅ Matagumpay na nai-save ang Payslip ni ${fullName} bilang ${statusMode}!
(Hindi pa nababawas sa Cash on Hand hangga't hindi ito nire-release.)`);
    closePayrollModal();
    loadAdminPayroll();
  } catch (err) {
    alert('Error sa pag-save ng payslip: ' + err.message);
  }
}

// Preview mula sa Form
function previewCurrentSalarySlipModal() {
  if (!activePayrollEmployeeObj) {
    alert('Pumili muna ng empleyado para ma-preview.');
    return;
  }
  const calcs = calculateSalarySlipLive();
  const emp = activePayrollEmployeeObj;
  const fullName = emp.lname ? `${emp.lname}, ${emp.fname} ${emp.mname || ''}`.trim() : (emp.name || emp.fname);

  const mockSlip = {
    empName: fullName,
    role: emp.role || 'Staff',
    company: document.getElementById('pay-company')?.value || 'KTFGI',
    location: document.getElementById('pay-location')?.value || 'HO',
    periodText: document.getElementById('pay-period-text')?.value || 'MAY 16-31, 2026',
    dailyRate: parseFloat(document.getElementById('pay-daily-rate')?.value || 0),
    daysWorked: parseFloat(document.getElementById('pay-days-count')?.value || 0),
    
    basic: parseFloat(document.getElementById('pay-basic-amt')?.value || 0),
    allowance: parseFloat(document.getElementById('pay-allowance-amt')?.value || 0),
    deminimis: parseFloat(document.getElementById('pay-deminimis-amt')?.value || 0),
    slRefund: parseFloat(document.getElementById('pay-sl-refund')?.value || 0),
    leaveDays: parseFloat(document.getElementById('pay-leave-days')?.value || 0),
    leaveAmt: parseFloat(document.getElementById('pay-leave-amt')?.value || 0),
    otherAllowance: parseFloat(document.getElementById('pay-other-allowance')?.value || 0),
    adjBasic: parseFloat(document.getElementById('pay-adj-basic')?.value || 0),
    otAdj: parseFloat(document.getElementById('pay-ot-adj')?.value || 0),
    holidayAdj: parseFloat(document.getElementById('pay-holiday-adj')?.value || 0),
    otHours: parseFloat(document.getElementById('pay-ot-hrs')?.value || 0),
    otAmt: parseFloat(document.getElementById('pay-ot-amt')?.value || 0),
    specialHoliday: parseFloat(document.getElementById('pay-special-holiday')?.value || 0),
    legalHoliday: parseFloat(document.getElementById('pay-legal-holiday')?.value || 0),
    nightDiffHours: parseFloat(document.getElementById('pay-night-diff-hrs')?.value || 0),
    nightDiff: parseFloat(document.getElementById('pay-night-diff')?.value || 0),
    grossEarnings: calcs.grossEarnings,

    restdayWoPay: parseFloat(document.getElementById('pay-restday-wopay')?.value || 0),
    absencesWoPay: parseFloat(document.getElementById('pay-absences-wopay')?.value || 0),
    lateMins: parseFloat(document.getElementById('pay-late-mins')?.value || 0),
    lateAmt: parseFloat(document.getElementById('pay-late-amt')?.value || 0),
    sssDec: parseFloat(document.getElementById('pay-sss-dec')?.value || 0),
    sssAmt: parseFloat(document.getElementById('pay-sss-amt')?.value || 0),
    sssLoan: parseFloat(document.getElementById('pay-sss-loan')?.value || 0),
    hdmfAmt: parseFloat(document.getElementById('pay-hdmf-amt')?.value || 0),
    hdmfLoan: parseFloat(document.getElementById('pay-hdmf-loan')?.value || 0),
    phicAmt: parseFloat(document.getElementById('pay-phic-amt')?.value || 0),
    taxAmt: parseFloat(document.getElementById('pay-tax-amt')?.value || 0),
    caAmt: parseFloat(document.getElementById('pay-ca-amt')?.value || 0),
    hmoAmt: parseFloat(document.getElementById('pay-hmo-amt')?.value || 0),
    totalDeductions: calcs.totalDeductions,

    caNoPay: document.getElementById('pay-ca-nopay')?.value || '',
    caSummaryAmt: parseFloat(document.getElementById('pay-ca-summary-amt')?.value || 0),
    caBalance: parseFloat(document.getElementById('pay-ca-balance')?.value || 0),

    netPay: calcs.netPay,
    amountInWords: calcs.words
  };

  printKenjiTeiSalarySlip(mockSlip);
}

// 🖨️ PRINT / DOWNLOAD SALARY SLIP (Exact Kenji Tei Format mula sa Photo)
function printKenjiTeiSalarySlip(slip) {
  const brandLogo = localStorage.getItem('kusina_brand_logo') || '';
  const logoHtml = brandLogo ? `<img src="${brandLogo}" style="max-height: 48px; object-fit: contain;">` : `<div style="font-size: 1.8rem; font-weight: 900; color: #b91c1c;">楽<br><small style="font-size: 8pt; color: #000;">KENJI TEI</small></div>`;

  const fmt = (n) => parseFloat(n || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const printWin = window.open('', '', 'width=950,height=900');
  printWin.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Salary Slip - ${slip.empName} (${slip.periodText})</title>
      <style>
        @page { size: A4 portrait; margin: 10mm; }
        body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 9pt; color: #000; margin: 0; padding: 10px; }
        .slip-box { border: 2.5px solid #000; width: 100%; max-width: 820px; margin: auto; background: #fff; }
        .header-table { width: 100%; border-collapse: collapse; }
        .header-table td { border-bottom: 2.5px solid #000; }
        .banner-ktf { background: #fca5a5; color: #fff; text-align: center; font-size: 1.4rem; font-weight: 800; padding: 8px; border-left: 2px solid #000; }
        .grid-info { width: 100%; border-collapse: collapse; border-bottom: 2.5px solid #000; font-size: 8.5pt; }
        .grid-info td { padding: 3px 6px; }
        .main-table { width: 100%; border-collapse: collapse; }
        .main-table th { background: #f87171; color: #000; font-weight: 700; border: 1.5px solid #000; padding: 4px; font-size: 8.5pt; text-align: left; }
        .main-table td { border: 1px solid #000; padding: 2.5px 5px; font-size: 8pt; }
        .val-col { text-align: right; width: 85px; }
        .qty-col { text-align: center; width: 55px; background: #fee2e2; }
        .total-row { background: #fee2e2; font-weight: 800; }
        .net-pay-banner { background: #fca5a5; color: #fff; font-size: 1.1rem; font-weight: 900; text-align: center; padding: 4px; }
        @media print {
          body { padding: 0; }
          .no-print { display: none; }
        }
      </style>
    </head>
    <body>
      <div class="no-print" style="max-width: 820px; margin: 0 auto 10px auto; text-align: right;">
        <button onclick="window.print()" style="padding: 6px 16px; font-weight: 700; background: #2563eb; color: #fff; border: none; border-radius: 4px; cursor: pointer;">🖨️ I-print / I-save bilang PDF</button>
      </div>

      <div class="slip-box">
        <!-- HEADER -->
        <table class="header-table">
          <tr>
            <td style="width: 25%; text-align: center; padding: 6px;">${logoHtml}</td>
            <td style="width: 45%; text-align: center; padding: 6px;">
              <h2 style="margin: 0; font-size: 18pt; letter-spacing: 1px; font-weight: 900;">SALARY SLIP</h2>
              <div style="font-size: 12pt; font-weight: 700; border-top: 1.5px solid #000; margin-top: 4px; padding-top: 2px;">
                ${slip.periodText || 'MAY 16-31, 2026'}
              </div>
            </td>
            <td class="banner-ktf" style="width: 30%;">
              ${slip.company || 'Kenji Tei Food'}<br><span style="font-size: 1rem;">Group Inc.</span>
            </td>
          </tr>
        </table>

        <!-- EMPLOYEE HEADER INFO -->
        <table class="grid-info">
          <tr>
            <td style="width: 15%;">Name</td>
            <td style="width: 35%;">: <b>${slip.empName}</b></td>
            <td style="width: 15%; border-left: 2px solid #000;">Position</td>
            <td style="width: 35%;">: <b>${slip.role}</b></td>
          </tr>
          <tr>
            <td>Company</td>
            <td>: ${slip.company || 'KTFGI'}</td>
            <td style="border-left: 2px solid #000;">Location</td>
            <td>: ${slip.location || 'HO'}</td>
          </tr>
          <tr>
            <td>Number of Days</td>
            <td>: ${slip.daysWorked || 0}</td>
            <td style="border-left: 2px solid #000;">Daily Rate</td>
            <td>: ${slip.dailyRate > 0 ? fmt(slip.dailyRate) : ''}</td>
          </tr>
        </table>

        <!-- EARNINGS & DEDUCTIONS MAIN TABLE -->
        <table class="main-table">
          <thead>
            <tr>
              <th style="width: 27%;">Earnings</th>
              <th style="width: 8%; text-align: center;">No. of days</th>
              <th style="width: 15%; text-align: right;">Amount</th>
              <th style="width: 27%; border-left: 2px solid #000;">Deduction</th>
              <th style="width: 8%; text-align: center;">No. of days</th>
              <th style="width: 15%; text-align: right;">Amount</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Basic</td>
              <td class="qty-col"></td>
              <td class="val-col">${fmt(slip.basic)}</td>
              <td style="border-left: 2px solid #000;">Restday (w/o Pay)</td>
              <td class="qty-col"></td>
              <td class="val-col">${fmt(slip.restdayWoPay)}</td>
            </tr>
            <tr>
              <td>Allowance</td>
              <td class="qty-col"></td>
              <td class="val-col">${fmt(slip.allowance)}</td>
              <td style="border-left: 2px solid #000;">Absences (w/o Pay)</td>
              <td class="qty-col"></td>
              <td class="val-col">${fmt(slip.absencesWoPay)}</td>
            </tr>
            <tr>
              <td>Deminimis</td>
              <td class="qty-col"></td>
              <td class="val-col">${fmt(slip.deminimis)}</td>
              <td style="border-left: 2px solid #000;">Tardiness/Undertime</td>
              <td class="qty-col" style="font-size: 7pt;">${slip.lateMins > 0 ? slip.lateMins + ' M' : ''}</td>
              <td class="val-col">${fmt(slip.lateAmt)}</td>
            </tr>
            <tr>
              <td>SL Refund</td>
              <td class="qty-col"></td>
              <td class="val-col">${fmt(slip.slRefund)}</td>
              <td style="border-left: 2px solid #000;">SSS Contri Dec.1-5</td>
              <td class="qty-col"></td>
              <td class="val-col">${fmt(slip.sssDec)}</td>
            </tr>
            <tr>
              <td>Leave (w/ Pay)</td>
              <td class="qty-col">${slip.leaveDays > 0 ? slip.leaveDays : ''}</td>
              <td class="val-col">${fmt(slip.leaveAmt)}</td>
              <td style="border-left: 2px solid #000;">SSS Contribution</td>
              <td class="qty-col"></td>
              <td class="val-col">${fmt(slip.sssAmt)}</td>
            </tr>
            <tr>
              <td>Other Allowances</td>
              <td class="qty-col"></td>
              <td class="val-col">${fmt(slip.otherAllowance)}</td>
              <td style="border-left: 2px solid #000;">SSS Loan</td>
              <td class="qty-col"></td>
              <td class="val-col">${fmt(slip.sssLoan)}</td>
            </tr>
            <tr>
              <td>ADJ: Basic, Allowance, Demir</td>
              <td class="qty-col"></td>
              <td class="val-col">${fmt(slip.adjBasic)}</td>
              <td style="border-left: 2px solid #000;">HDMF</td>
              <td class="qty-col"></td>
              <td class="val-col">${fmt(slip.hdmfAmt)}</td>
            </tr>
            <tr>
              <td>OT Adjustment</td>
              <td class="qty-col"></td>
              <td class="val-col">${fmt(slip.otAdj)}</td>
              <td style="border-left: 2px solid #000;">HDMF Loan</td>
              <td class="qty-col"></td>
              <td class="val-col">${fmt(slip.hdmfLoan)}</td>
            </tr>
            <tr>
              <td>Holiday Adjustment</td>
              <td class="qty-col"></td>
              <td class="val-col">${fmt(slip.holidayAdj)}</td>
              <td style="border-left: 2px solid #000;">PHIC</td>
              <td class="qty-col"></td>
              <td class="val-col">${fmt(slip.phicAmt)}</td>
            </tr>
            <tr>
              <td>Regular Overtime</td>
              <td class="qty-col">${slip.otHours > 0 ? slip.otHours + ' H' : ''}</td>
              <td class="val-col">${fmt(slip.otAmt)}</td>
              <td style="border-left: 2px solid #000;">Tax</td>
              <td class="qty-col"></td>
              <td class="val-col">${fmt(slip.taxAmt)}</td>
            </tr>
            <tr>
              <td>Special Holiday</td>
              <td class="qty-col"></td>
              <td class="val-col">${fmt(slip.specialHoliday)}</td>
              <td style="border-left: 2px solid #000;">Cash Advance</td>
              <td class="qty-col"></td>
              <td class="val-col">${fmt(slip.caAmt)}</td>
            </tr>
            <tr>
              <td>Legal Holiday</td>
              <td class="qty-col"></td>
              <td class="val-col">${fmt(slip.legalHoliday)}</td>
              <td style="border-left: 2px solid #000;">HMO (Intellicare)</td>
              <td class="qty-col"></td>
              <td class="val-col">${fmt(slip.hmoAmt)}</td>
            </tr>
            <tr>
              <td>Night Differential</td>
              <td class="qty-col">${slip.nightDiffHours > 0 ? slip.nightDiffHours + ' H' : ''}</td>
              <td class="val-col">${fmt(slip.nightDiff)}</td>
              <td style="border-left: 2px solid #000;">&nbsp;</td>
              <td class="qty-col"></td>
              <td class="val-col"></td>
            </tr>
            <tr class="total-row">
              <td colspan="2"><b>Gross Earnings</b></td>
              <td class="val-col"><b>${fmt(slip.grossEarnings)}</b></td>
              <td colspan="2" style="border-left: 2px solid #000;"><b>Total Deduction</b></td>
              <td class="val-col"><b>${fmt(slip.totalDeductions)}</b></td>
            </tr>
          </tbody>
        </table>

        <!-- FOOTER: CASH ADVANCE & NET PAY BANNER -->
        <table style="width: 100%; border-collapse: collapse; border-top: 2.5px solid #000;">
          <tr>
            <td style="width: 50%; padding: 4px; background: #fca5a5; color: #000; text-align: center; font-weight: 700; font-style: italic; border-right: 2px solid #000;">
              Summary of Cash Advance
            </td>
            <td class="net-pay-banner" style="width: 50%;">
              NET PAY
            </td>
          </tr>
          <tr>
            <td style="padding: 0; vertical-align: top; border-right: 2px solid #000;">
              <table style="width: 100%; border-collapse: collapse; font-size: 8pt; text-align: center;">
                <tr style="font-weight: 700; background: #fff;">
                  <td style="border-right: 1px solid #000; padding: 3px;">No. of Pay</td>
                  <td style="border-right: 1px solid #000; padding: 3px;">Amount</td>
                  <td style="padding: 3px;">Balance</td>
                </tr>
                <tr>
                  <td style="border-right: 1px solid #000; padding: 4px;">${slip.caNoPay || '&nbsp;'}</td>
                  <td style="border-right: 1px solid #000; padding: 4px;">${slip.caSummaryAmt > 0 ? fmt(slip.caSummaryAmt) : '&nbsp;'}</td>
                  <td style="padding: 4px;">${slip.caBalance > 0 ? fmt(slip.caBalance) : '&nbsp;'}</td>
                </tr>
              </table>
            </td>
            <td style="text-align: right; vertical-align: middle; padding: 4px 10px;">
              <b style="font-size: 15pt; color: #000;">${fmt(slip.netPay)}</b>
            </td>
          </tr>
          <tr>
            <td colspan="2" style="border-top: 1px solid #000; text-align: center; padding: 6px; font-weight: 700; font-size: 9.5pt;">
              ${slip.amountInWords || ''}
            </td>
          </tr>
        </table>
      </div>
    </body>
    </html>
  `);
  printWin.document.close();
  printWin.focus();
  setTimeout(() => { printWin.print(); }, 400);
}

// ========================================================
// PAYROLL DB TABLE & ACTIONS (PREVIEW, PRINT, RELEASE PAYOUT)
// ========================================================
let allPayrollsList = [];

async function loadAdminPayroll() {
  const tbody = document.getElementById('admin-payroll-tbody');
  if (!tbody || !db) return;
  try {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align: center;">Kinukuha ang payroll records...</td></tr>';
    const snap = await db.collection('payrolls').orderBy('createdAt', 'desc').limit(100).get();
    
    allPayrollsList = [];
    if (snap.empty) {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; color: #94a3b8; padding: 1.5rem;">Walang records ng pasweldo. Pindutin ang "+ Generate Payslip".</td></tr>';
      return;
    }

    snap.forEach(d => allPayrollsList.push({ id: d.id, ...d.data() }));

    let html = '';
    allPayrollsList.forEach(p => {
      const period = p.periodText || p.period || 'Cut-off';
      const gross = parseFloat(p.grossEarnings || p.gross || 0).toLocaleString('en-PH', { style: 'currency', currency: 'PHP' });
      const deduct = parseFloat(p.totalDeductions || p.deductions || 0).toLocaleString('en-PH', { style: 'currency', currency: 'PHP' });
      const net = parseFloat(p.netPay || p.net || 0).toLocaleString('en-PH', { style: 'currency', currency: 'PHP' });
      const isPaid = (p.status === 'Released / Paid');

      html += `<tr>
        <td><b>${period}</b><br><small style="color: #64748b;">${p.company || 'KTFGI'}</small></td>
        <td><b>${p.empName}</b><br><small style="color: #059669;">${p.role || ''}</small></td>
        <td>${gross}</td>
        <td style="color: #dc2626;">-${deduct}</td>
        <td><b style="color: #2563eb; font-size: 1.05rem;">${net}</b></td>
        <td>
          <span class="badge ${isPaid ? 'badge-branch' : 'badge-warning'}">${p.status || 'Draft'}</span>
        </td>
        <td>
          <div style="display: flex; gap: 0.35rem; flex-wrap: wrap;">
            <button class="btn btn-sm btn-secondary" onclick="printSavedSalarySlip('${p.id}')">🖨️ Slip / Download</button>
            ${!isPaid ? `<button class="btn btn-sm btn-success" style="font-weight: 700;" onclick="releasePayrollPayout('${p.id}')">💸 Release Payout</button>` : ''}
          </div>
        </td>
      </tr>`;
    });
    tbody.innerHTML = html;
  } catch (e) {
    console.error(e);
  }
}

function printSavedSalarySlip(payrollId) {
  const p = (allPayrollsList || []).find(x => x.id === payrollId);
  if (!p) {
    alert('Hindi nahanap ang payroll slip.');
    return;
  }
  logSystemAction('PAYSLIP_PRINTED', `Nag-print ng official salary slip (${p.periodText}) para kay ${p.empName}`);
  printKenjiTeiSalarySlip(p);
}

// RELEASE PAYOUT: Dito pa lamang magbabawas sa Cash on Hand sa General Ledger!
async function releasePayrollPayout(payrollId) {
  const p = (allPayrollsList || []).find(x => x.id === payrollId);
  if (!p) return;

  const netPay = parseFloat(p.netPay || p.net || 0);
  const conf = await uiConfirm(`⚠️ KUMPIRMASYON NG RELEASE PAYOUT:
I-release ang ₱${netPay.toLocaleString('en-PH', { minimumFractionDigits: 2 })} bilang pasweldo kay ${p.empName}?

DITO PA LAMANG ito opisyal na ibabawas sa Cash on Hand sa General Ledger.`);

  if (!conf) return;

  try {
    const payRef = db.collection('payrolls').doc(payrollId);
    const glRef = db.collection('general_ledger').doc('PAYROLL-' + payrollId); // nakatakdang ID: hindi puwedeng madoble

    await db.runTransaction(async tx => {
      const paySnap = await tx.get(payRef);
      if (!paySnap.exists) throw new Error('Hindi nahanap ang payslip.');
      const pay = paySnap.data();
      if (pay.status === 'Released / Paid') throw new Error('Nai-release na ang sahod na ito dati pa (naka-post na sa General Ledger).');
      const glSnap = await tx.get(glRef);
      const amount = parseFloat(pay.netPay || pay.net || 0);

      tx.update(payRef, {
        status: 'Released / Paid',
        releasedAt: firebase.firestore.FieldValue.serverTimestamp(),
        releasedBy: getCurrentUser()?.name || 'Accounting Head'
      });
      if (!glSnap.exists) {
        // Credit Cash sa General Ledger
        tx.set(glRef, {
          type: 'Payroll Payout (Salary Released)',
          ref: `Payslip [${pay.periodText || p.periodText || 'Cut-off'}]: ${pay.empName || p.empName}`,
          debit: 0,
          credit: amount, // Pera palabas sa kumpanya
          sourcePayroll: payrollId,
          timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });
      }
    });

    await logSystemAction('PAYROLL_PAYOUT_RELEASED', `Pormal na nai-release ang pasweldo ni ${p.empName} (₱${netPay}). Nabawas sa General Ledger.`);
    
    alert(`🎉 Tagumpay! Nai-release na ang sahod ni ${p.empName} at naitala na sa General Ledger ang bawas na ₱${netPay.toFixed(2)}.`);
    loadAdminPayroll();
    if (typeof loadAdminFinance === 'function') loadAdminFinance();
  } catch (err) {
    alert('Error sa release payout: ' + err.message);
    if (typeof loadAdminPayroll === 'function') loadAdminPayroll();
  }
}

// ======================== FINANCE & GL ========================
async function loadAdminFinance() {
  if(!db) return;
  
  try {
    let totalCash = 0;
    let totalBank = 0;
    let totalAP = 0;
    let totalAR = 0;
    
    // Kunin ang Beginning Balances ni Admin (kung may sinet)
    const setSnap = await db.collection('system_settings').doc('finance_balances').get();
    if (setSnap.exists) {
       totalCash = parseFloat(setSnap.data().beginningCash || 0);
       totalBank = parseFloat(setSnap.data().beginningBank || 0);
    }
    
    // 1. Calculate GL Impact on Cash
    const glSnap = await db.collection('general_ledger').orderBy('timestamp', 'desc').get();
    let glHtml = '';
    glSnap.forEach(d => {
       const t = d.data();
       totalCash += parseFloat(t.debit || 0); // Pumasok
       totalCash -= parseFloat(t.credit || 0); // Lumabas
       
       const dateStr = t.timestamp ? new Date(t.timestamp.toDate()).toLocaleString() : 'N/A';
       glHtml += `<tr>
         <td><small>${dateStr}</small></td>
         <td><b>${t.type}</b></td>
         <td>${t.ref}</td>
         <td style="color:green;">${t.debit > 0 ? '₱'+t.debit.toFixed(2) : '--'}</td>
         <td style="color:red;">${t.credit > 0 ? '₱'+t.credit.toFixed(2) : '--'}</td>
       </tr>`;
    });
    
    document.getElementById('gl-transactions-tbody').innerHTML = glHtml || '<tr><td colspan="5" style="text-align:center;">Walang transactions.</td></tr>';
    
    // 2. Calculate AP (Unpaid Vendors)
    const apSnap = await db.collection('vendor_pos').where('status', '==', 'Received / AP').get();
    apSnap.forEach(d => totalAP += Math.max(0, parseFloat(d.data().actualTotalAmount || 0) - parseFloat(d.data().dpAmount || 0)));
    
    // 3. Calculate AR (Unpaid Branches/Customers) -> placeholder assuming 'Completed' but unpaid
    
    document.getElementById('gl-cash-balance').innerText = `₱${totalCash.toFixed(2)}`;
    document.getElementById('gl-bank-balance').innerText = `₱${totalBank.toFixed(2)}`;
    document.getElementById('gl-total-ap').innerText = `₱${totalAP.toFixed(2)}`;
    document.getElementById('gl-total-ar').innerText = `₱${totalAR.toFixed(2)}`;
    
  } catch(e) { console.error("Finance Error:", e); }
}




// ==========================================
// VENDOR MANAGEMENT
// ==========================================
let allVendors = [];
async function loadAdminVendors() {
  const tbody = document.getElementById('admin-vendors-tbody');
  if(!tbody || !db) return;
  try {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align: center;">Loading vendors...</td></tr>';
    const snap = await db.collection('vendors').orderBy('name').get();
    allVendors = [];
    snap.forEach(d => allVendors.push({id: d.id, ...d.data()}));
    filterAdminVendors();
  } catch(e) { console.error(e); }
}

function filterAdminVendors() {
  const tbody = document.getElementById('admin-vendors-tbody');
  const q = document.getElementById('admin-vendor-search')?.value.toLowerCase() || '';
  if(!tbody) return;
  const filtered = allVendors.filter(v => (v.name||'').toLowerCase().includes(q));
  if(filtered.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align: center;">Walang vendor na nahanap.</td></tr>';
    return;
  }
  let html = '';
  filtered.forEach(v => {
    html += `<tr>
      <td><b>${v.name}</b></td>
      <td>${v.contactPerson || '--'}</td>
      <td>${v.contactDetails || '--'}</td>
      <td>${v.address || '--'}</td>
      <td><span class="badge badge-warning">${v.terms || 'COD'}</span></td>
      <td>
        <button class="btn btn-sm btn-primary" onclick="openVendorModal('${v.id}')">Edit</button>
        <button class="btn btn-sm btn-danger" onclick="deleteVendor('${v.id}')">Del</button>
      </td>
    </tr>`;
  });
  tbody.innerHTML = html;
}

function openVendorModal(id = null) {
  if (id) {
    const v = allVendors.find(x => x.id === id);
    if(v) {
      document.getElementById('vendor-id').value = v.id;
      document.getElementById('vendor-name').value = v.name || '';
      document.getElementById('vendor-contact-person').value = v.contactPerson || '';
      document.getElementById('vendor-contact-details').value = v.contactDetails || '';
      document.getElementById('vendor-address').value = v.address || '';
      document.getElementById('vendor-terms').value = v.terms || '';
      document.getElementById('vendor-modal-title').innerText = '✏️ Edit Vendor';
    }
  } else {
    document.getElementById('vendor-id').value = '';
    document.getElementById('vendor-name').value = '';
    document.getElementById('vendor-contact-person').value = '';
    document.getElementById('vendor-contact-details').value = '';
    document.getElementById('vendor-address').value = '';
    document.getElementById('vendor-terms').value = '';
    document.getElementById('vendor-modal-title').innerText = '➕ Add Vendor';
  }
  document.getElementById('admin-vendor-modal').style.display = 'flex';
}

async function saveVendor() {
  const id = document.getElementById('vendor-id').value;
  const name = document.getElementById('vendor-name').value.trim();
  if(!name) { alert('Kailangan ang Vendor Name.'); return; }
  const payload = {
    name: name,
    contactPerson: document.getElementById('vendor-contact-person').value.trim(),
    contactDetails: document.getElementById('vendor-contact-details').value.trim(),
    address: document.getElementById('vendor-address').value.trim(),
    terms: document.getElementById('vendor-terms').value.trim(),
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  };
  try {
    if(id) { await db.collection('vendors').doc(id).update(payload); }
    else { 
      payload.createdAt = firebase.firestore.FieldValue.serverTimestamp();
      await db.collection('vendors').add(payload); 
    }
    alert('✅ Na-save ang Vendor!');
    document.getElementById('admin-vendor-modal').style.display = 'none';
    loadAdminVendors();
  } catch(e) { alert(e.message); }
}

async function deleteVendor(id) {
  if(!await uiConfirm('Burahin ang vendor na ito?')) return;
  await db.collection('vendors').doc(id).delete();
  loadAdminVendors();
}


// ==========================================
// CUSTOMER MANAGEMENT
// ==========================================
let allCustomers = [];
async function loadAdminCustomers() {
  const tbody = document.getElementById('admin-customers-tbody');
  if(!tbody || !db) return;
  try {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align: center;">Loading customers...</td></tr>';
    const snap = await db.collection('customers').orderBy('name').get();
    allCustomers = [];
    snap.forEach(d => allCustomers.push({id: d.id, ...d.data()}));
    // bigyan ng code ang mga lumang customer na walang code (admin lang)
    try {
      const nu = allCustomers.filter(c => !c.code);
      if (nu.length && normalizeRole((getCurrentUser() || {}).role) === 'admin') {
        const codes = nextCustomerCodes(allCustomers, nu.length); const b = db.batch();
        nu.forEach((c, i) => { c.code = codes[i]; b.update(db.collection('customers').doc(c.id), { code: c.code }); });
        await b.commit();
      }
    } catch (e) { console.warn('customer codes', e); }
    filterAdminCustomers();
  } catch(e) { console.error(e); }
}

function filterAdminCustomers() {
  const tbody = document.getElementById('admin-customers-tbody');
  const q = document.getElementById('admin-customer-search')?.value.toLowerCase() || '';
  if(!tbody) return;
  const filtered = allCustomers.filter(c => ((c.name||'') + ' ' + (c.code||'')).toLowerCase().includes(q));
  if(filtered.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align: center;">Walang customer na nahanap.</td></tr>';
    return;
  }
  let html = '';
  filtered.forEach(c => {
    html += `<tr>
      <td><b>${c.name}</b><br><small style="color:#64748b;font-family:monospace;">${c.code || ''}</small></td>
      <td>${c.address || '--'}</td>
      <td>${c.contact || '--'}</td>
      <td>${c.bank || '--'}</td>
      <td><span class="badge badge-branch">${c.type || 'Retail'}</span></td>
      <td>
        <button class="btn btn-sm btn-primary" onclick="openCustomerModal('${c.id}')">Edit</button>
        <button class="btn btn-sm btn-danger" onclick="deleteCustomer('${c.id}')">Del</button>
      </td>
    </tr>`;
  });
  tbody.innerHTML = html;
}

function openCustomerModal(id = null) {
  if (id) {
    const c = allCustomers.find(x => x.id === id);
    if(c) {
      document.getElementById('customer-id').value = c.id;
      document.getElementById('customer-name').value = c.name || '';
      if (document.getElementById('customer-code')) document.getElementById('customer-code').value = c.code || '';
      document.getElementById('customer-address').value = c.address || '';
      document.getElementById('customer-contact').value = c.contact || '';
      document.getElementById('customer-bank').value = c.bank || '';
      document.getElementById('customer-type').value = c.type || 'Retail';
      document.getElementById('customer-modal-title').innerText = '✏️ Edit Customer';
    }
  } else {
    document.getElementById('customer-id').value = '';
    document.getElementById('customer-name').value = '';
    if (document.getElementById('customer-code')) document.getElementById('customer-code').value = '';
    document.getElementById('customer-address').value = '';
    document.getElementById('customer-contact').value = '';
    document.getElementById('customer-bank').value = '';
    document.getElementById('customer-type').value = 'Retail';
    document.getElementById('customer-modal-title').innerText = '➕ Add Customer';
  }
  document.getElementById('admin-customer-modal').style.display = 'flex';
}

async function saveCustomer() {
  const id = document.getElementById('customer-id').value;
  const name = document.getElementById('customer-name').value.trim();
  if(!name) { alert('Kailangan ang Customer Name.'); return; }
  const payload = {
    name: name,
    code: ((document.getElementById('customer-code') || {}).value || '').trim() || (id ? ((allCustomers.find(x => x.id === id) || {}).code || nextCustomerCodes(allCustomers, 1)[0]) : nextCustomerCodes(allCustomers, 1)[0]),
    address: document.getElementById('customer-address').value.trim(),
    contact: document.getElementById('customer-contact').value.trim(),
    bank: document.getElementById('customer-bank').value.trim(),
    type: document.getElementById('customer-type').value,
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  };
  try {
    if(id) { await db.collection('customers').doc(id).update(payload); }
    else { 
      payload.createdAt = firebase.firestore.FieldValue.serverTimestamp();
      await db.collection('customers').add(payload); 
    }
    alert('✅ Na-save ang Customer!');
    document.getElementById('admin-customer-modal').style.display = 'none';
    loadAdminCustomers();
  } catch(e) { alert(e.message); }
}

async function deleteCustomer(id) {
  if(!await uiConfirm('Burahin ang customer na ito?')) return;
  await db.collection('customers').doc(id).delete();
  loadAdminCustomers();
}


async function loadBranchDropdowns() {
  if (!db) return;
  try {
    const snap = await db.collection('customers').orderBy('name').get();
    const custSel = document.getElementById('order-customer');
    if (custSel) {
      custSel.innerHTML = '<option value="">-- Piliin ang Customer (Agent Mode) --</option>';
      snap.forEach(doc => {
        custSel.innerHTML += `<option value="${doc.id}">${doc.data().name}</option>`;
      });
    }
    
    const sysSnap = await db.collection('system_settings').doc('branding').get();
    if (sysSnap.exists && sysSnap.data().vatRate) {
      window.systemVatRate = parseFloat(sysSnap.data().vatRate);
    } else {
      window.systemVatRate = 12; // Default PH VAT
    }
  } catch(e) { console.error("Error loading branch dropdowns:", e); }
}

function calculateBranchCartTotals() {
  let subtotal = 0;
  orderCart.forEach(item => subtotal += item.subtotal);
  
  const discountStr = document.getElementById('order-discount')?.value || '0';
  const vatOpt = document.getElementById('order-vat')?.value || 'inclusive';
  const vatRate = window.systemVatRate || 12;
  
  let discountAmt = 0;
  if (discountStr === '100') discountAmt = subtotal; // Complimentary
  else discountAmt = subtotal * (parseFloat(discountStr) / 100);
  
  let amountAfterDiscount = subtotal - discountAmt;
  let finalTotal = amountAfterDiscount;
  let vatAmount = 0;
  
  if (vatOpt === 'exclusive') {
    vatAmount = amountAfterDiscount * (vatRate / 100);
    finalTotal = amountAfterDiscount + vatAmount;
  } else if (vatOpt === 'inclusive') {
    let vatableSales = amountAfterDiscount / (1 + (vatRate / 100));
    vatAmount = amountAfterDiscount - vatableSales;
    finalTotal = amountAfterDiscount; // Doesn't increase
  } else {
    vatAmount = 0; // Exempt
    finalTotal = amountAfterDiscount;
  }
  
  return { subtotal, discountAmt, vatAmount, finalTotal, isComplimentary: discountStr === '100' };
}


function recalcCommOrder(itemId) {
  const wq = parseFloat(document.getElementById(`edit-wqty-${itemId}`).value || 0);
  const lq = parseFloat(document.getElementById(`edit-lqty-${itemId}`).value || 0);
  const wp = parseFloat(document.getElementById(`edit-wpx-${itemId}`).value || 0);
  const lp = parseFloat(document.getElementById(`edit-lpx-${itemId}`).value || 0);
  const sub = (wq * wp) + (lq * lp);
  document.getElementById(`edit-sub-${itemId}`).innerText = '₱' + sub.toFixed(2);
  
  // Update in memory
  const order = currentOrders.find(o => o.id === activeCommissaryOrderId);
  if (order) {
    const item = order.items.find(i => (i.itemCode || i.id) === itemId);
    if (item) {
      item.wholeQty = wq;
      item.looseQty = lq;
      item.wholePrice = wp;
      item.loosePrice = lp;
      item.subtotal = sub;
    }
    
    // Recalc total
    let gTotal = 0;
    order.items.forEach(i => gTotal += i.subtotal);
    order.totalAmount = gTotal;
    const tTotal = document.getElementById('com-modal-adjusted-total');
    if (tTotal) tTotal.innerText = `₱${gTotal.toFixed(2)}`;
    
    // Auto-save to firestore
    if (db) {
      db.collection('orders').doc(activeCommissaryOrderId).update({
        items: order.items,
        totalAmount: gTotal,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      }).catch(console.error);
    }
  }
}


// ==========================================
// DIRECT SUPPLIER RECEIVING (COMMISSARY)
// ==========================================
async function openDirectReceivingModal() {
  // Load vendors
  const vSnap = await db.collection('vendors').orderBy('name').get();
  const vSel = document.getElementById('direct-recv-vendor');
  if (vSel) {
    vSel.innerHTML = '<option value="">-- Piliin ang Supplier/Vendor --</option>';
    vSnap.forEach(d => vSel.innerHTML += `<option value="${d.id}">${d.data().name}</option>`);
  }
  document.getElementById('direct-recv-modal').style.display = 'flex';
}

function closeDirectReceivingModal() {
  document.getElementById('direct-recv-modal').style.display = 'none';
}

async function onDirectRecvVendorChange() {
  const vName = document.getElementById('direct-recv-vendor').options[document.getElementById('direct-recv-vendor').selectedIndex].text;
  const pSel = document.getElementById('direct-recv-item');
  if(!vName || vName.includes('--')) {
    pSel.innerHTML = '<option value="">-- Pumili muna ng Vendor --</option>';
    return;
  }
  pSel.innerHTML = '<option value="">Naglo-load...</option>';
  try {
    const snap = await db.collection('products').where('supplier', '==', vName).get();
    if (snap.empty) {
      pSel.innerHTML = '<option value="">Walang naka-link na item.</option>';
      return;
    }
    pSel.innerHTML = '<option value="">-- Piliin ang Item --</option>';
    window.directRecvProds = [];
    snap.forEach(d => {
      window.directRecvProds.push({id: d.id, ...d.data()});
      pSel.innerHTML += `<option value="${d.id}">${d.data().itemName}</option>`;
    });
  } catch(e) { console.error(e); }
}

function onDirectRecvItemChange() {
  const pId = document.getElementById('direct-recv-item').value;
  const prod = window.directRecvProds.find(p => p.id === pId);
  const uSel = document.getElementById('direct-recv-uom');
  if (prod) {
    uSel.innerHTML = `<option value="whole|${prod.wholePrice}">${prod.wholeUOM} (₱${prod.wholePrice})</option>
                      <option value="loose|${prod.loosePrice}">${prod.looseUOM} (₱${prod.loosePrice})</option>`;
  }
}

async function submitDirectReceiving() {
  const vSel = document.getElementById('direct-recv-vendor');
  const vName = vSel.options[vSel.selectedIndex]?.text;
  const invNo = document.getElementById('direct-recv-invoice').value.trim();
  const pId = document.getElementById('direct-recv-item').value;
  const prod = window.directRecvProds?.find(p => p.id === pId);
  const uomVal = document.getElementById('direct-recv-uom').value;
  const qty = parseFloat(document.getElementById('direct-recv-qty').value || 0);

  if (!vName || vName.includes('--') || !invNo || !prod || qty <= 0) {
    alert("Kumpletuhin ang lahat ng fields!");
    return;
  }

  const uomType = uomVal.split('|')[0];
  const unitCost = parseFloat(uomVal.split('|')[1]);
  const subtotal = qty * unitCost;

  if (!await uiConfirm(`Tatanggapin ang ${qty} ${uomType==='whole'?prod.wholeUOM:prod.looseUOM} ng ${prod.itemName} mula kay ${vName}?

Mapupunta sa Accounts Payable (AP): ₱${subtotal.toFixed(2)}`)) return;

  try {
    const batch = db.batch();
    
    // Add to Live Inventory
    const prodRef = db.collection('products').doc(prod.id);
    batch.update(prodRef, {
      stockWhole: firebase.firestore.FieldValue.increment(uomType==='whole'?qty:0),
      stockLoose: firebase.firestore.FieldValue.increment(uomType==='loose'?qty:0)
    });
    addStockMovementToBatch(batch, prod.id, prod.itemName, 'DIRECT_RECEIVING', 'Inv ' + invNo, uomType==='whole'?qty:0, uomType==='loose'?qty:0, 'Vendor: ' + vName);

    // Create an AP / Received PO record directly
    const poNum = 'DPO-' + Date.now().toString().slice(-6);
    const apRef = db.collection('vendor_pos').doc(poNum);
    batch.set(apRef, {
      poNumber: poNum,
      vendorName: vName,
      vendorInvoiceNo: invNo,
      status: 'Received / AP',
      totalAmount: subtotal,
      actualTotalAmount: subtotal,
      receivedBy: getCurrentUser()?.name || 'Commissary',
      receivedAt: firebase.firestore.FieldValue.serverTimestamp(),
      items: [{
        productId: prod.id,
        itemCode: prod.sapCode || prod.id,
        itemName: prod.itemName,
        uomType: uomType,
        uomText: uomType==='whole'?prod.wholeUOM:prod.looseUOM,
        qty: qty,
        actualWholeQty: uomType==='whole'?qty:0,
        actualLooseQty: uomType==='loose'?qty:0,
        unitCost: unitCost,
        subtotal: subtotal,
        actualSubtotal: subtotal
      }]
    });

    await batch.commit();
    await logSystemAction('DIRECT_RECEIVING', `On-the-spot received: ${qty} ng ${prod.itemName} mula kay ${vName}. AP: ₱${subtotal}`);
    alert("✅ Tagumpay! Naidagdag sa Inventory at naipasok sa AP Invoices!");
    closeDirectReceivingModal();
    loadCommissaryInventory();
  } catch(e) { alert(e.message); }
}


async function setBeginningBalances() {
  const c = await uiPrompt("Ilagay ang Beginning Balance para sa CASH ON HAND (₱):", "0");
  if (c === null) return;
  const b = await uiPrompt("Ilagay ang Beginning Balance para sa BANK ACCOUNT (₱):", "0");
  if (b === null) return;
  
  if (!db) return;
  try {
    await db.collection('system_settings').doc('finance_balances').set({
      beginningCash: parseFloat(c) || 0,
      beginningBank: parseFloat(b) || 0,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      updatedBy: getCurrentUser()?.name || 'Admin'
    }, { merge: true });
    
    logSystemAction('FINANCE_BALANCE_SET', `Sinet ang beginning bal: Cash(₱${c}), Bank(₱${b})`);
    alert("✅ Na-update na ang Beginning Balances!");
    loadAdminFinance();
  } catch(e) { alert(e.message); }
}

async function resetLedgerZReading() {
  const pin = await uiPrompt("🚨 ADMIN Z-READING RESET 🚨\n\nBurahin lahat ng transaction sa General Ledger at i-reset sa ZERO ang AP Invoices?\nI-type ang 'RESET' para mag-confirm:");
  if (pin !== 'RESET') { alert("Kinansela."); return; }
  
  if (!db) return;
  try {
    const batch = db.batch();
    
    // 1. Delete all GL transactions
    const glSnap = await db.collection('general_ledger').get();
    glSnap.forEach(d => batch.delete(d.ref));
    
    // 2. Clear beginning balances
    const balRef = db.collection('system_settings').doc('finance_balances');
    batch.set(balRef, { beginningCash: 0, beginningBank: 0 }, { merge: true });
    
    // 3. (Optional) Archive AP Invoices - For now we just reset them as "Paid / Z-Cleared"
    const apSnap = await db.collection('vendor_pos').where('status', '==', 'Received / AP').get();
    apSnap.forEach(d => {
       batch.update(d.ref, { status: 'Cleared via Z-Reading' });
    });
    
    await batch.commit();
    logSystemAction('Z_READING_EXECUTED', 'Admin executed Monthly Z-Reading. Zeroed out balances.');
    alert("✅ Z-Reading Successful! Naka-zero na ang Ledger at Cash.");
    loadAdminFinance();
  } catch(e) { alert(e.message); }
}


// ========================================================
// 🖨️ PRINTABLE VENDOR PO SLIP (WITH 3 SIGNATORIES)
// 1. Prepared By (Sino gumawa ng PO)
// 2. Verified By (Commissary / Supply Chain Head)
// 3. Approved By (COO / President)
// ========================================================
function printDirectVendorPO(poId) {
  const po = allVendorPOs.find(p => p.id === poId);
  if (!po) {
    alert('Hindi nahanap ang PO details.');
    return;
  }
  generateAndPrintPOSlip(po);
}

function printActiveVendorPOSlip() {
  if (!window.activeViewingPOId) return;
  printDirectVendorPO(window.activeViewingPOId);
}

function generateAndPrintPOSlip(po) {
  const brandName = (localStorage.getItem('kusina_brand_name') || 'KUSINA ERP').toUpperCase();
  const brandAddress = localStorage.getItem('kusina_brand_address') || 'Metro Manila, Philippines';
  const brandTin = localStorage.getItem('kusina_brand_tin') || '000-000-000-000 VAT';
  const brandContact = localStorage.getItem('kusina_brand_contact') || '(02) 8000-0000';
  const brandLogo = localStorage.getItem('kusina_brand_logo') || '';
  const poCheckerName = localStorage.getItem('kusina_po_checker') || '';
  const poCheckerTitle = localStorage.getItem('kusina_po_checker_title') || '';
  const poApproverName = localStorage.getItem('kusina_po_approver') || '';
  const poApproverTitle = localStorage.getItem('kusina_po_approver_title') || '';
  const _ap = po.approvals || {};
  const scSigned = _ap.supplyChain ? `${_ap.supplyChain.by} <small>(${poFmtDate(_ap.supplyChain.at)})</small>` : (poCheckerName || '&nbsp;');
  const cooSigned = _ap.coo ? `${_ap.coo.by} <small>(${poFmtDate(_ap.coo.at)})</small>` : (poApproverName || '&nbsp;');
  
  const creator = po.createdBy || 'Purchasing Staff';
  const poDate = po.orderDate || new Date().toISOString().slice(0, 10);
  const totalStr = parseFloat(po.totalAmount || 0).toLocaleString('en-PH', { style: 'currency', currency: 'PHP' });

  let itemsHtml = '';
  (po.items || []).forEach(i => {
    const costStr = parseFloat(i.unitCost || 0).toLocaleString('en-PH', { style: 'currency', currency: 'PHP' });
    const subStr = parseFloat(i.subtotal || 0).toLocaleString('en-PH', { style: 'currency', currency: 'PHP' });
    itemsHtml += `<tr>
      <td style="border: 1px solid #cbd5e1; padding: 6px; font-family: monospace;">${i.itemCode || '--'}</td>
      <td style="border: 1px solid #cbd5e1; padding: 6px;"><b>${i.itemName}</b></td>
      <td style="border: 1px solid #cbd5e1; padding: 6px; text-align: center;">${i.qty} ${i.uomText || ''}</td>
      <td style="border: 1px solid #cbd5e1; padding: 6px; text-align: right;">${costStr}</td>
      <td style="border: 1px solid #cbd5e1; padding: 6px; text-align: right; font-weight: 700;">${subStr}</td>
    </tr>`;
  });

  const logoImg = brandLogo ? `<img src="${brandLogo}" style="max-height: 55px; margin-bottom: 5px;"><br>` : '';

  // Generate Barcode SVG/DataURL dynamically using hidden canvas
  let poBarcodeHtml = '';
  if (typeof JsBarcode !== 'undefined' && po.poNumber) {
    const canvas = document.getElementById('temp-po-barcode');
    if (canvas) {
      try {
        JsBarcode(canvas, po.poNumber, { format: "CODE128", displayValue: false, height: 40, width: 1.5, margin: 0 });
        const barcodeDataUrl = canvas.toDataURL("image/png");
        poBarcodeHtml = `<img src="${barcodeDataUrl}" style="height: 40px; margin-bottom: 5px; display: block; margin-left: auto;" alt="PO Barcode"><br>`;
      } catch (e) {
        console.warn("Barcode generation error: ", e);
      }
    }
  }

  const printWin = window.open('', '', 'width=950,height=900');
  printWin.document.write(`
    <html>
    <head>
      <title>Purchase Order - ${po.poNumber}</title>
      <style>
        @page { size: A4 portrait; margin: 15mm; }
        body { font-family: Arial, sans-serif; color: #0f172a; margin: 0; padding: 10px; font-size: 10pt; }
        table { width: 100%; border-collapse: collapse; margin-top: 12px; }
        th { background: #f1f5f9; border: 1px solid #cbd5e1; padding: 8px; font-size: 9.5pt; text-align: left; }
        td { border: 1px solid #cbd5e1; padding: 7px; font-size: 9.5pt; }
      </style>
    </head>
    <body>
      <div style="text-align: center; margin-bottom: 15px; border-bottom: 2px solid #0f172a; padding-bottom: 10px;">
        ${logoImg}
        <h2 style="margin: 0; font-size: 18pt; letter-spacing: 0.5px;">${brandName}</h2>
        <div style="font-size: 9pt; color: #475569; margin-top: 3px;">${brandAddress}</div>
        <div style="font-size: 8.5pt; color: #475569;">TIN: ${brandTin} | Contact: ${brandContact}</div>
        <h3 style="margin: 10px 0 0 0; color: #059669; text-transform: uppercase; font-size: 14pt;">PURCHASE ORDER (PO)</h3>
      </div>

      <div style="display: flex; justify-content: space-between; margin-bottom: 15px; line-height: 1.5;">
        <div>
          <b>VENDOR / SUPPLIER:</b><br>
          <span style="font-size: 11pt; font-weight: 800; color: #1e293b;">${po.vendorName}</span><br>
          Status: <b>${po.status || 'Sent to Vendor'}</b>
        </div>
        <div style="text-align: right;">
          ${poBarcodeHtml}
          <div><b>PO Number:</b> <span style="font-size: 11pt; font-weight: 800; color: #b91c1c;">${po.poNumber}</span></div>
          <b>PO Order Date:</b> ${poDate}<br>
          <b>Prepared By:</b> ${creator}
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th style="width: 15%;">Item Code</th>
            <th style="width: 45%;">Description</th>
            <th style="width: 15%; text-align: center;">Qty</th>
            <th style="width: 12%; text-align: right;">Unit Cost</th>
            <th style="width: 13%; text-align: right;">Subtotal</th>
          </tr>
        </thead>
        <tbody>
          ${itemsHtml}
        </tbody>
      </table>

      <div style="text-align: right; margin-top: 15px; font-size: 12pt; font-weight: 800;">
        TOTAL PO AMOUNT: <span style="color: #b91c1c;">${totalStr}</span>
      </div>

      <!-- 3 OFFICIAL SIGNATORIES -->
      <div style="margin-top: 60px; display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; text-align: center; font-size: 9pt;">
        <div>
          <div style="border-bottom: 1px solid #0f172a; margin-bottom: 5px; font-weight: 700; min-height: 18px;">${creator}</div>
          <b>PREPARED BY</b><br>
          <small style="color: #64748b;">Purchasing Officer / Staff</small>
        </div>
        <div>
          <div style="border-bottom: 1px solid #0f172a; margin-bottom: 5px; font-weight: 700; min-height: 18px;">${scSigned}</div>
          <b>VERIFIED & CHECKED BY</b><br>
          <small style="color: #64748b;">${poCheckerTitle || 'Commissary / Supply Chain Head'}</small>
        </div>
        <div>
          <div style="border-bottom: 1px solid #0f172a; margin-bottom: 5px; font-weight: 700; min-height: 18px;">${cooSigned}</div>
          <b>APPROVED BY</b><br>
          <small style="color: #64748b;">${poApproverTitle || 'Chief Operating Officer (COO) / President'}</small>
        </div>
      </div>

      <div style="margin-top: 35px; text-align: center; font-size: 8pt; color: #94a3b8; border-top: 1px dashed #cbd5e1; padding-top: 8px;">
        * Note: Official system-generated Purchase Order. Pagkatapos maaprubahan, saka lamang magpoproseso ng bayad ang Accounting Department.
      </div>
    </body>
    </html>
  `);
  printWin.document.close();
  printWin.focus();
  setTimeout(() => { printWin.print(); }, 400);
}

// ========================================================
// 📥 CSV EXPORTS FOR VENDOR POS, EMPLOYEES, VENDORS, CUSTOMERS
// ========================================================
function exportVendorPOsCSV() {
  if (!allVendorPOs || allVendorPOs.length === 0) {
    alert('Walang PO records na ma-i-export.');
    return;
  }
  const headers = ['PO_Number', 'Order_Date', 'Vendor_Name', 'Items_Count', 'Total_Amount', 'Status', 'Created_By'];
  let rows = [headers.join(',')];
  allVendorPOs.forEach(po => {
    rows.push([
      `"${po.poNumber}"`,
      `"${po.orderDate}"`,
      `"${(po.vendorName||'').replace(/"/g, '""')}"`,
      (po.items||[]).length,
      (po.totalAmount||0).toFixed(2),
      `"${po.status||''}"`,
      `"${po.createdBy||''}"`
    ].join(','));
  });
  downloadCSVFile(rows.join('\r\n'), 'Vendor_POs_Masterlist.csv');
}

function exportEmployeesCSV() {
  if (!hrEmployees || hrEmployees.length === 0) {
    alert('Walang employee records.');
    return;
  }
  const headers = ['Employee_ID', 'First_Name', 'Last_Name', 'Middle_Name', 'Nickname', 'Position', 'Department', 'Sub_Dept', 'Classification', 'Employment_Type', 'Base_Salary', 'Status', 'Contact', 'Email', 'Address', 'SSS', 'PhilHealth', 'PagIBIG', 'TIN', 'BDO_Account'];
  let rows = [headers.join(',')];
  hrEmployees.forEach(e => {
    rows.push([
      `"${e.empId||e.id}"`,
      `"${(e.fname||'').replace(/"/g, '""')}"`,
      `"${(e.lname||'').replace(/"/g, '""')}"`,
      `"${(e.mname||'').replace(/"/g, '""')}"`,
      `"${(e.nickname||'').replace(/"/g, '""')}"`,
      `"${(e.role||'').replace(/"/g, '""')}"`,
      `"${(e.dept||'').replace(/"/g, '""')}"`,
      `"${(e.subdept||'').replace(/"/g, '""')}"`,
      `"${(e.classification||'').replace(/"/g, '""')}"`,
      `"${(e.employmentType||'').replace(/"/g, '""')}"`,
      (e.baseSalary||0).toFixed(2),
      `"${e.status||'Active'}"`,
      `"${(e.contact||'').replace(/"/g, '""')}"`,
      `"${(e.email||'').replace(/"/g, '""')}"`,
      `"${(e.address||'').replace(/"/g, '""')}"`,
      `"${e.sss||''}"`,
      `"${e.phic||''}"`,
      `"${e.hdmf||''}"`,
      `"${e.tin||''}"`,
      `"${e.bdoAccount||''}"`
    ].join(','));
  });
  downloadCSVFile(rows.join('\r\n'), 'Employees_HR_Masterlist.csv');
}

function exportVendorsCSV() {
  if (!allVendors || allVendors.length === 0) {
    alert('Walang vendor records.');
    return;
  }
  const headers = ['Vendor_Name', 'Contact_Person', 'Contact_Details', 'Address', 'Terms'];
  let rows = [headers.join(',')];
  allVendors.forEach(v => {
    rows.push([
      `"${(v.name||'').replace(/"/g, '""')}"`,
      `"${(v.contactPerson||'').replace(/"/g, '""')}"`,
      `"${(v.contactDetails||'').replace(/"/g, '""')}"`,
      `"${(v.address||'').replace(/"/g, '""')}"`,
      `"${(v.terms||'').replace(/"/g, '""')}"`
    ].join(','));
  });
  downloadCSVFile(rows.join('\r\n'), 'Vendors_Directory.csv');
}

function exportCustomersCSV() {
  if (!allCustomers || allCustomers.length === 0) {
    alert('Walang customer records.');
    return;
  }
  const headers = ['Customer_Name', 'Address', 'Contact', 'Bank_Details', 'Customer_Type'];
  let rows = [headers.join(',')];
  allCustomers.forEach(c => {
    rows.push([
      `"${(c.name||'').replace(/"/g, '""')}"`,
      `"${(c.address||'').replace(/"/g, '""')}"`,
      `"${(c.contact||'').replace(/"/g, '""')}"`,
      `"${(c.bank||'').replace(/"/g, '""')}"`,
      `"${(c.type||'Retail').replace(/"/g, '""')}"`
    ].join(','));
  });
  downloadCSVFile(rows.join('\r\n'), 'Customers_Directory.csv');
}

function downloadCSVFile(csvContent, filename) {
  const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ========================================================
// 🖨️ PRINT LISTS (EMPLOYEES, VENDORS, CUSTOMERS)
// ========================================================
function printEmployeesReport() {
  if (!hrEmployees || hrEmployees.length === 0) { alert('Walang employee records.'); return; }
  let trs = '';
  hrEmployees.forEach(e => {
    const fullName = e.lname ? `${e.lname}, ${e.fname} ${e.mname||''}` : (e.name || '--');
    trs += `<tr>
      <td>${e.empId||e.id}</td>
      <td><b>${fullName}</b> (${e.nickname||'--'})</td>
      <td>${e.role||'--'} / ${e.dept||'--'}</td>
      <td>${e.classification||'Rank & File'}</td>
      <td>₱${parseFloat(e.baseSalary||0).toFixed(2)}</td>
      <td>${e.contact||'--'}</td>
      <td>${e.status||'Active'}</td>
    </tr>`;
  });
  openPrintableTableReport('EMPLOYEE MASTERLIST REPORT', ['Emp ID', 'Name & Nickname', 'Position & Dept', 'Class', 'Base Rate', 'Contact', 'Status'], trs);
}

function printVendorsReport() {
  if (!allVendors || allVendors.length === 0) { alert('Walang vendor records.'); return; }
  let trs = '';
  allVendors.forEach(v => {
    trs += `<tr>
      <td><b>${v.name}</b></td>
      <td>${v.contactPerson||'--'}</td>
      <td>${v.contactDetails||'--'}</td>
      <td>${v.address||'--'}</td>
      <td>${v.terms||'COD'}</td>
    </tr>`;
  });
  openPrintableTableReport('OFFICIAL VENDOR / SUPPLIER DIRECTORY', ['Vendor Name', 'Contact Person', 'Contact Details', 'Address', 'Terms'], trs);
}

function printCustomersReport() {
  if (!allCustomers || allCustomers.length === 0) { alert('Walang customer records.'); return; }
  let trs = '';
  allCustomers.forEach(c => {
    trs += `<tr>
      <td><b>${c.name}</b></td>
      <td>${c.address||'--'}</td>
      <td>${c.contact||'--'}</td>
      <td>${c.bank||'--'}</td>
      <td>${c.type||'Retail'}</td>
    </tr>`;
  });
  openPrintableTableReport('REGISTERED CUSTOMERS DIRECTORY (AGENTS / OUTLETS)', ['Customer Name', 'Address', 'Contact No.', 'Bank Account', 'Type'], trs);
}

function openPrintableTableReport(title, headers, rowsHtml) {
  const brandName = (localStorage.getItem('kusina_brand_name') || 'KUSINA ERP').toUpperCase();
  const dateStr = new Date().toLocaleString();
  const ths = headers.map(h => `<th style="border: 1px solid #000; padding: 6px; background: #f1f5f9; text-align: left; font-size: 9pt;">${h}</th>`).join('');
  
  const printWin = window.open('', '', 'width=950,height=900');
  printWin.document.write(`
    <html>
    <head><title>${title}</title>
    <style>
      @page { size: A4 landscape; margin: 10mm; }
      body { font-family: Arial, sans-serif; font-size: 9.5pt; color: #000; margin: 0; padding: 10px; }
      table { width: 100%; border-collapse: collapse; margin-top: 10px; }
      td { border: 1px solid #333; padding: 6px; font-size: 9pt; }
    </style>
    </head>
    <body>
      <div style="text-align: center; margin-bottom: 15px;">
        <h2 style="margin: 0; text-transform: uppercase;">${brandName}</h2>
        <h3 style="margin: 4px 0;">${title}</h3>
        <small style="color: #64748b;">Generated on: ${dateStr}</small>
      </div>
      <table>
        <thead><tr>${ths}</tr></thead>
        <tbody>${rowsHtml}</tbody>
      </table>
    </body>
    </html>
  `);
  printWin.document.close();
  printWin.focus();
  setTimeout(() => { printWin.print(); }, 400);
}


// ========================================================
// 🎂 ANIMATED BIRTHDAY CELEBRANTS POPUP ENGINE (PER-ACCOUNT)
// - Per-account tracking: Lilitaw sa unang login ng bawat account ngayong araw
// - Kahit iisang computer lang, kung nag-switch account, lilitaw pa rin sa bago
// - Strict date comparison: Kung kailan mismo ang kaarawan, doon lang lilitaw
// ========================================================

function parseMonthAndDay(dateVal) {
  if (!dateVal) return null;
  
  // Kung Firestore Timestamp
  if (dateVal.toDate && typeof dateVal.toDate === 'function') {
    const d = dateVal.toDate();
    return {
      month: String(d.getMonth() + 1).padStart(2, '0'),
      day: String(d.getDate()).padStart(2, '0'),
      year: d.getFullYear()
    };
  }

  const str = String(dateVal).trim();
  
  // Format: YYYY-MM-DD o YYYY/MM/DD
  if (/^\d{4}[-/]\d{1,2}[-/]\d{1,2}/.test(str)) {
    const p = str.split(/[-/]/);
    return {
      year: parseInt(p[0], 10),
      month: String(parseInt(p[1], 10)).padStart(2, '0'),
      day: String(parseInt(p[2], 10)).padStart(2, '0')
    };
  }

  // Format: MM/DD/YYYY o M/D/YYYY
  if (/^\d{1,2}[-/]\d{1,2}[-/]\d{4}/.test(str)) {
    const p = str.split(/[-/]/);
    return {
      month: String(parseInt(p[0], 10)).padStart(2, '0'),
      day: String(parseInt(p[1], 10)).padStart(2, '0'),
      year: parseInt(p[2], 10)
    };
  }

  // Fallback gamit ang Date parser
  const d = new Date(str);
  if (!isNaN(d.getTime())) {
    return {
      month: String(d.getMonth() + 1).padStart(2, '0'),
      day: String(d.getDate()).padStart(2, '0'),
      year: d.getFullYear()
    };
  }

  return null;
}

function calculateAgeFromDOB(dobVal) {
  const parsed = parseMonthAndDay(dobVal);
  if (!parsed || !parsed.year) return '-- taong gulang';
  const now = new Date();
  let age = now.getFullYear() - parsed.year;
  const m = (now.getMonth() + 1) - parseInt(parsed.month, 10);
  if (m < 0 || (m === 0 && now.getDate() < parseInt(parsed.day, 10))) {
    age--;
  }
  return `${age} taong gulang`;
}

function calculateTenure(hireDateVal) {
  const parsed = parseMonthAndDay(hireDateVal);
  if (!parsed || !parsed.year) return 'Bagong Kapamilya';
  try {
    const hireDate = new Date(parsed.year, parseInt(parsed.month, 10) - 1, parseInt(parsed.day, 10));
    const now = new Date();
    
    let years = now.getFullYear() - hireDate.getFullYear();
    let months = now.getMonth() - hireDate.getMonth();
    let days = now.getDate() - hireDate.getDate();

    if (days < 0) months--;
    if (months < 0) {
      years--;
      months += 12;
    }

    if (years <= 0 && months <= 0) {
      return 'Bago sa Kumpanya (< 1 buwan)';
    } else if (years <= 0) {
      return `${months} buwan sa kumpanya`;
    } else if (months === 0) {
      return `${years} taon sa kumpanya`;
    } else {
      return `${years} taon at ${months} buwan sa kumpanya`;
    }
  } catch (e) {
    return 'Kapamilya';
  }
}

async function checkTodayBirthdayCelebrants() {
  if (typeof db === 'undefined' || !db) return;

  const u = getCurrentUser();
  if (!u) return; // Walang naka-login

  // TUKOY SA ACCOUNT: Ihiwalay ang tracking bawat email account
  const userAccountKey = (u.email || u.id || u.name || 'guest').toLowerCase().replace(/[^a-z0-9]/g, '_');

  const today = new Date();
  const currentMonth = String(today.getMonth() + 1).padStart(2, '0');
  const currentDay = String(today.getDate()).padStart(2, '0');
  const todayKey = `${today.getFullYear()}-${currentMonth}-${currentDay}`;

  // Unique key bawat user account para sa araw na ito
  const accountStorageKey = `kusina_bday_seen_${userAccountKey}_${todayKey}`;

  if (localStorage.getItem(accountStorageKey) === 'true') {
    return; // Napanood na ng account na ito ngayong araw
  }

  try {
    const snap = await db.collection('employees').get();
    if (snap.empty) return;

    const celebrants = [];

    snap.forEach(doc => {
      const e = doc.data();
      const status = (e.status || 'Active').toLowerCase();
      if (status !== 'resigned' && status !== 'terminated') {
        const bdayParsed = parseMonthAndDay(e.dob || e.dateOfBirth || e.birthdate);
        
        // EKSATONG ARAW LANG: Kung bukas pa, bukas lang lalabas
        if (bdayParsed && bdayParsed.month === currentMonth && bdayParsed.day === currentDay) {
          const fullName = e.lname ? `${e.fname || ''} ${e.lname}`.trim() : (e.name || e.fname || 'Empleyado');
          const nickname = e.nickname ? `"${e.nickname}"` : '';
          const role = e.role || e.jobTitle || 'Team Member';
          const dept = e.dept || e.department || '';
          const ageText = calculateAgeFromDOB(e.dob || e.dateOfBirth || e.birthdate);
          const tenureText = calculateTenure(e.hireDate || e.directHireDate);
          const photoUrl = e.photoUrl || e.profilePic || e.image || '';

          celebrants.push({
            fullName: fullName,
            nickname: nickname,
            role: role,
            dept: dept,
            ageText: ageText,
            tenureText: tenureText,
            photoUrl: photoUrl,
            initial: (fullName || 'E').charAt(0).toUpperCase()
          });
        }
      }
    });

    if (celebrants.length > 0) {
      const cardsContainer = document.getElementById('birthday-celebrants-cards');
      if (cardsContainer) {
        let cardsHtml = '';
        celebrants.forEach(c => {
          const avatarHtml = c.photoUrl
            ? `<img src="${c.photoUrl}" class="celebrant-avatar" alt="${c.fullName}">`
            : `<div class="celebrant-avatar-placeholder">${c.initial}</div>`;

          cardsHtml += `
            <div class="celebrant-card">
              ${avatarHtml}
              <div style="flex: 1;">
                <h3 class="celebrant-name">${c.fullName} ${c.nickname ? `<span style="font-size: 1rem; color: #b45309; font-weight: 700;">${c.nickname}</span>` : ''}</h3>
                <div class="celebrant-role">💼 ${c.role} ${c.dept ? `(${c.dept})` : ''}</div>
                <div class="celebrant-badge-box">
                  <span class="celebrant-badge">🎂 ${c.ageText}</span>
                  <span class="celebrant-badge">⭐ ${c.tenureText}</span>
                </div>
              </div>
            </div>
          `;
        });
        cardsContainer.innerHTML = cardsHtml;
      }

      const modal = document.getElementById('birthday-greeting-modal');
      if (modal) {
        modal.style.display = 'flex';
      }

      // Itago para sa account na ito ngayong araw
      localStorage.setItem(accountStorageKey, 'true');
    }
  } catch (err) {
    console.warn('Birthday check warning:', err);
  }
}

function closeBirthdayModal() {
  const modal = document.getElementById('birthday-greeting-modal');
  if (modal) modal.style.display = 'none';
}

// Auto-trigger sa pagsisimula ng pahina
window.addEventListener('load', () => {
  setTimeout(() => {
    checkTodayBirthdayCelebrants();
  }, 1200);
});


// ========================================================
// 🛡️ ENHANCED AUDIT TRAIL LOGGING WRAPPERS
// Bawat print, export, download, at transactions ay may logs
// ========================================================

if (typeof printDirectVendorPO === 'function') {
  const origPrintDirectVendorPO = printDirectVendorPO;
  printDirectVendorPO = function(poId) {
    const po = (allVendorPOs || []).find(p => p.id === poId);
    if (po) {
      logSystemAction('VENDOR_PO_PRINTED', `Nag-print ng kopya ng Vendor PO: ${po.poNumber} (Supplier: ${po.vendorName}, Halaga: ₱${parseFloat(po.totalAmount||0).toFixed(2)})`);
    }
    origPrintDirectVendorPO(poId);
  };
}

if (typeof printPickingGuide === 'function') {
  const origPrintPickingGuide = printPickingGuide;
  printPickingGuide = function(orderId, format) {
    const ord = (currentOrders || []).find(o => o.id === orderId);
    if (ord) {
      logSystemAction('PICKING_SLIP_PRINTED', `Nag-print ng Staging/Picking Slip para sa Order: ${ord.orderId || ord.id} (${ord.branchName})`);
    }
    origPrintPickingGuide(orderId, format);
  };
}

if (typeof downloadBranchOrderCSV === 'function') {
  const origDownloadBranchOrderCSV = downloadBranchOrderCSV;
  downloadBranchOrderCSV = function(orderId) {
    const ord = (currentOrders || []).find(o => o.id === orderId);
    if (ord) {
      logSystemAction('ORDER_CSV_DOWNLOADED', `Nag-export ng 5-column order CSV: ${ord.orderId || ord.id} (${ord.branchName})`);
    }
    origDownloadBranchOrderCSV(orderId);
  };
}

if (typeof copyBranchOrderToClipboard === 'function') {
  const origCopyBranchOrderToClipboard = copyBranchOrderToClipboard;
  copyBranchOrderToClipboard = function(orderId) {
    const ord = (currentOrders || []).find(o => o.id === orderId);
    if (ord) {
      logSystemAction('ORDER_COPIED_TO_CLIPBOARD', `Kinopya sa clipboard ang detalye ng order: ${ord.orderId || ord.id}`);
    }
    origCopyBranchOrderToClipboard(orderId);
  };
}

if (typeof exportVendorPOsCSV === 'function') {
  const origExportVendorPOsCSV = exportVendorPOsCSV;
  exportVendorPOsCSV = function() {
    logSystemAction('VENDOR_PO_EXPORTED', `Nag-download ng buong Vendor Purchase Orders Masterlist sa CSV.`);
    origExportVendorPOsCSV();
  };
}

if (typeof exportEmployeesCSV === 'function') {
  const origExportEmployeesCSV = exportEmployeesCSV;
  exportEmployeesCSV = function() {
    logSystemAction('EMPLOYEES_EXPORTED', `Nag-export ng buong Employee HR Masterlist sa CSV.`);
    origExportEmployeesCSV();
  };
}

if (typeof printEmployeesReport === 'function') {
  const origPrintEmployeesReport = printEmployeesReport;
  printEmployeesReport = function() {
    logSystemAction('EMPLOYEES_PRINTED', `Nag-print ng physical report ng Employee Masterlist.`);
    origPrintEmployeesReport();
  };
}

if (typeof exportVendorsCSV === 'function') {
  const origExportVendorsCSV = exportVendorsCSV;
  exportVendorsCSV = function() {
    logSystemAction('VENDORS_EXPORTED', `Nag-export ng listahan ng Vendors/Suppliers sa CSV.`);
    origExportVendorsCSV();
  };
}

if (typeof printVendorsReport === 'function') {
  const origPrintVendorsReport = printVendorsReport;
  printVendorsReport = function() {
    logSystemAction('VENDORS_PRINTED', `Nag-print ng opisyal na listahan ng mga Vendors/Suppliers.`);
    origPrintVendorsReport();
  };
}

if (typeof exportCustomersCSV === 'function') {
  const origExportCustomersCSV = exportCustomersCSV;
  exportCustomersCSV = function() {
    logSystemAction('CUSTOMERS_EXPORTED', `Nag-export ng Customer Directory sa CSV.`);
    origExportCustomersCSV();
  };
}

if (typeof printCustomersReport === 'function') {
  const origPrintCustomersReport = printCustomersReport;
  printCustomersReport = function() {
    logSystemAction('CUSTOMERS_PRINTED', `Nag-print ng talaan ng mga Customers at Outlets.`);
    origPrintCustomersReport();
  };
}

if (typeof exportCommissaryProductsCSV === 'function') {
  const origExportCommissaryProductsCSV = exportCommissaryProductsCSV;
  exportCommissaryProductsCSV = async function() {
    logSystemAction('PRODUCTS_EXPORTED', `Nag-export ng Product Masterlist sa CSV.`);
    await origExportCommissaryProductsCSV();
  };
}

// ========================================================
// 🏭 MANUFACTURING (BOM) & WORK ORDERS ENGINE
// ========================================================
let bomRecipes = [];
let activeIngredients = [];
let editingBomId = null; // null = bagong recipe, may value = ine-edit na recipe

async function loadManufacturing() {
  const tbody = document.getElementById('admin-mfg-tbody');
  if (!tbody || !db) return;
  try {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align: center;">Kinukuha ang BOMs...</td></tr>';
    const snap = await db.collection('bom_recipes').get();
    bomRecipes = [];
    if (snap.empty) {
      tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: #94a3b8;">Wala pang naka-set na Recipe/BOM.</td></tr>';
      return;
    }
    snap.forEach(d => bomRecipes.push({id: d.id, ...d.data()}));
    loadHubOptions();
    { const hf = document.getElementById('mfg-hub-filter'); const meU = getCurrentUser() || {}; if (hf && normalizeRole(meU.role) !== 'admin') (hf.parentElement.classList.contains('ss-wrap') ? hf.parentElement : hf).style.display = 'none'; }
    
    let html = '';
    visibleBoms().forEach(b => {
      const rmList = (b.ingredients || []).map(i => `${i.qty} ${bomUomName(i)} ${i.itemName}`).join(', ');
      const rev = b.revision ? `<br><small style="color:#64748b;">Rev ${b.revision}${b.lastEditedBy ? ' · ' + b.lastEditedBy : ''}</small>` : '';
      html += `<tr>
        <td><b style="color:#0284c7;">${b.finishedGoodName}</b><br><small>${b.finishedGoodCode}</small>${b.hub ? `<br><small style="color:#7c3aed;">🏢 ${srchEsc(b.hub)}</small>` : ''}${rev}</td>
        <td style="font-size: 0.85rem;">${rmList}</td>
        <td><b>${b.yieldQty}</b> batches</td>
        <td><span class="badge badge-success">Active</span></td>
        <td style="white-space:nowrap;">
          <button class="btn btn-sm btn-secondary" onclick="viewBomReport('${b.id}')">📄 Report</button>
          <button class="btn btn-sm btn-primary" onclick="openRecipeBuilderModal('${b.id}')">✏️ Edit</button>
          <button class="btn btn-sm btn-danger" onclick="deleteBOM('${b.id}')">Del</button>
        </td>
      </tr>`;
    });
    tbody.innerHTML = html || '<tr><td colspan="5" style="text-align: center; color: #94a3b8;">Walang recipe para sa hub na ito.</td></tr>';
  } catch(e) { console.error(e); }
}

function bomHubProducts() {
  const hv = (document.getElementById('bom-hub') || {}).value || '';
  return (adminProductsList || []).filter(p => productVisibleToHub(p, hv));
}
async function bomHubChanged() {
  const fgList = document.getElementById('bom-fg-list');
  if (fgList) { fgList.innerHTML = ''; bomHubProducts().forEach(p => { fgList.innerHTML += `<option value="${p.itemName} (${p.itemCode || p.id})"></option>`; }); }
  if (typeof bomSearchRM === 'function') bomSearchRM();
}

async function openRecipeBuilderModal(bomId) {
  if (adminProductsList.length === 0) await loadAdminProducts();
  editingBomId = (typeof bomId === 'string' && bomId) ? bomId : null;
  const editBom = editingBomId ? bomRecipes.find(b => b.id === editingBomId) : null;
  if (editingBomId && !editBom) { alert('Hindi nahanap ang recipe. I-refresh muna ang listahan.'); editingBomId = null; return; }
  
  const fgInput = document.getElementById('bom-finished-good');
  const rmInput = document.getElementById('bom-rm-select');
  const fgList = document.getElementById('bom-fg-list');
  const rmList = document.getElementById('bom-rm-list');
  
  if (fgInput) fgInput.value = '';
  if (rmInput) rmInput.value = '';

  await loadHubOptions();
  { const hs = document.getElementById('bom-hub'); const meU = getCurrentUser() || {};
    if (hs) { setSelValue(hs, editBom ? (editBom.hub || '') : activeHubFilter()); hs.disabled = normalizeRole(meU.role) !== 'admin'; } }
  if (fgList) {
    fgList.innerHTML = '';
    bomHubProducts().forEach(p => {
      fgList.innerHTML += `<option value="${p.itemName} (${p.itemCode || p.id})"></option>`;
    });
  }
  activeIngredients = [];
  bomResetRMPicker();
  const autoScanEl = document.getElementById('bom-auto-scan');
  if (autoScanEl) autoScanEl.checked = (navigator.maxTouchPoints || 0) > 0;
  const titleEl = document.getElementById('bom-modal-title');
  const saveBtn = document.getElementById('bom-save-btn');
  const yieldEl = document.getElementById('bom-yield-qty');
  if (editBom) {
    // EDIT MODE: ikarga ang kasalukuyang recipe (pangalan, yield, sangkap)
    if (fgInput) fgInput.value = editBom.finishedGoodName;
    if (yieldEl) yieldEl.value = editBom.yieldQty;
    { const nEl = document.getElementById('bom-notes'); if (nEl) nEl.value = editBom.notes || ''; }
    activeIngredients = (editBom.ingredients || []).map(i => ({...i}));
    if (titleEl) titleEl.innerText = '✏️ I-edit ang Recipe: ' + editBom.finishedGoodName;
    if (saveBtn) saveBtn.innerText = '💾 I-save ang Pagbabago';
  } else {
    if (yieldEl) yieldEl.value = 1;
    { const nEl = document.getElementById('bom-notes'); if (nEl) nEl.value = ''; }
    if (titleEl) titleEl.innerText = '🍳 Recipe Builder (Bill of Materials)';
    if (saveBtn) saveBtn.innerText = '💾 I-save ang Recipe (BOM)';
  }
  renderIngredientsTable();
  document.getElementById('recipe-builder-modal').style.display = 'flex';
}

// Inline edit ng qty / UOM ng sangkap (kahit kailan)
function updateIngredientQty(idx, val) {
  const q = parseFloat(val);
  if (!(q > 0)) { alert('Dapat mas mataas sa 0 ang quantity.'); renderIngredientsTable(); return; }
  activeIngredients[idx].qty = q;
}
function bomUomLabelFor(ing, which) {
  const p = (adminProductsList || []).find(x => x.id === ing.itemCode);
  if (p) return which === 'Whole' ? (p.wholeUOM || 'Whole') : (p.looseUOM || 'Loose');
  return which;
}
function updateIngredientUOM(idx, uom) {
  const ing = activeIngredients[idx];
  ing.uom = uom;
  ing.uomName = bomUomLabelFor(ing, uom);
  const prod = adminProductsList.find(p => p.id === ing.itemCode);
  if (prod) ing.unitPrice = uom === 'Whole' ? (prod.wholePrice || 0) : (prod.loosePrice || 0);
}

// ---------- Shared searchable-picker helpers ----------
function srchEsc(v) {
  return String(v == null ? '' : v).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function smartMatch(query, ...fields) {
  const q = (query || '').toLowerCase().trim();
  if (!q) return true;
  const hay = fields.map(f => String(f == null ? '' : f).toLowerCase()).join(' ');
  return q.split(/\s+/).every(t => hay.includes(t));
}
function srchRender(boxId, arr, rowFn, pickFn, emptyMsg) {
  const box = document.getElementById(boxId);
  if (!box) return;
  if (!arr.length) box.innerHTML = `<div class="srch-empty">${emptyMsg}</div>`;
  else box.innerHTML = arr.map((x, i) => `<div class="srch-item" onmousedown="event.preventDefault(); ${pickFn}(${i})">${rowFn(x)}</div>`).join('');
  box.style.display = 'block';
}
function srchKey(e, boxId, onPick) {
  const box = document.getElementById(boxId);
  if (!box) return;
  const items = Array.from(box.querySelectorAll('.srch-item'));
  let cur = items.findIndex(x => x.classList.contains('active'));
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    e.preventDefault();
    if (!items.length) return;
    if (box.style.display === 'none') box.style.display = 'block';
    items.forEach(x => x.classList.remove('active'));
    cur = e.key === 'ArrowDown' ? Math.min(cur + 1, items.length - 1) : Math.max(cur - 1, 0);
    items[cur].classList.add('active');
    items[cur].scrollIntoView({ block: 'nearest' });
  } else if (e.key === 'Enter') {
    e.preventDefault();
    onPick(cur >= 0 ? cur : 0);
  } else if (e.key === 'Escape') {
    box.style.display = 'none';
  }
}
document.addEventListener('click', e => {
  if (e.target.closest && e.target.closest('.srch-wrap')) return;
  document.querySelectorAll('.srch-results').forEach(d => { d.style.display = 'none'; });
});

// ---------- Recipe Builder: searchable + scannable ingredient picker ----------
let bomSelectedRM = null;
let bomRMResults = [];

function bomProdCodes(p) {
  return [p.itemName, p.sapCode, p.itemCode, p.posCode, p.pos_code, p.barcode, p.barcodeNumber, p.id];
}
function bomFindByCode(code) {
  const c = String(code || '').toUpperCase().trim();
  if (!c) return null;
  return (adminProductsList || []).find(p =>
    [p.barcode, p.barcodeNumber, p.posCode, p.pos_code, p.sapCode, p.itemCode, p.id].some(v => v && String(v).toUpperCase() === c)
  ) || null;
}
function bomUomName(ing) {
  const p = (adminProductsList || []).find(x => x.id === ing.itemCode);
  if (p) return ing.uom === 'Whole' ? (p.wholeUOM || 'Whole') : (p.looseUOM || 'Loose');
  return ing.uomName || ing.uom;
}
function bomResetRMPicker() {
  bomSelectedRM = null;
  const inp = document.getElementById('bom-rm-select');
  const qty = document.getElementById('bom-rm-qty');
  if (inp) inp.value = '';
  if (qty) qty.value = '';
  bomRenderGuide();
}
function bomRenderGuide() {
  const g = document.getElementById('bom-rm-guide');
  const unitEl = document.getElementById('bom-qty-unit');
  const uSel = document.getElementById('bom-rm-uom');
  const p = bomSelectedRM;
  if (!p) {
    if (g) g.innerHTML = '📏 Pumili o mag-scan ng sangkap para makita ang <b>Unit of Measure (UOM)</b> nito.';
    if (unitEl) unitEl.innerText = '--';
    if (uSel) uSel.innerHTML = '<option value="Whole">Whole</option><option value="Loose">Loose</option>';
    return;
  }
  const w = p.wholeUOM || 'Whole', l = p.looseUOM || 'Loose';
  const cf = parseFloat(p.conversionFactor) || 1;
  if (g) g.innerHTML = `📏 <b>${srchEsc(p.itemName)}</b><br>` +
    `Whole = <b>${srchEsc(w)}</b> &nbsp;|&nbsp; Loose = <b>${srchEsc(l)}</b>` +
    (cf > 1 ? `<br>🔁 1 ${srchEsc(w)} = <b>${cf} ${srchEsc(l)}</b>` : '');
  if (uSel) {
    const prev = uSel.value;
    uSel.innerHTML = `<option value="Whole">${srchEsc(w)} (Whole)</option><option value="Loose">${srchEsc(l)} (Loose)</option>`;
    uSel.value = cf > 1 ? 'Loose' : 'Whole';
  }
  bomUomChanged();
}
function bomUomChanged() {
  const p = bomSelectedRM;
  const unitEl = document.getElementById('bom-qty-unit');
  const uSel = document.getElementById('bom-rm-uom');
  if (!unitEl || !uSel) return;
  if (!p) { unitEl.innerText = '--'; return; }
  unitEl.innerText = uSel.value === 'Whole' ? (p.wholeUOM || 'Whole') : (p.looseUOM || 'Loose');
}
function bomSearchRM() {
  const inp = document.getElementById('bom-rm-select');
  if (!inp) return;
  // Kapag nag-type ulit, balewala na ang naunang napili
  if (bomSelectedRM && inp.value !== bomSelectedRM.itemName) { bomSelectedRM = null; bomRenderGuide(); }
  bomRMResults = bomHubProducts()
    .filter(p => smartMatch(inp.value, ...bomProdCodes(p)))
    .sort((a, b) => String(a.itemName).localeCompare(String(b.itemName)))
    .slice(0, 40);
  srchRender('bom-rm-results', bomRMResults, p =>
    `<b>${srchEsc(p.itemName)}</b><br><small style="color:#64748b;">${srchEsc(p.sapCode || p.itemCode || p.id)}${(p.barcode || p.barcodeNumber) ? ' · ' + srchEsc(p.barcode || p.barcodeNumber) : ''} · ${srchEsc(p.wholeUOM || 'Whole')} / ${srchEsc(p.looseUOM || 'Loose')}</small>`,
    'bomPickRM', 'Walang tugmang produkto.');
}
function bomPickRM(i) {
  if (bomRMResults[i]) bomSetSelectedRM(bomRMResults[i]);
}
function bomRMKey(e) {
  if (e.key === 'Enter') {
    const inp = document.getElementById('bom-rm-select');
    const exact = bomFindByCode(inp.value); // para sa USB/keyboard barcode scanner
    if (exact) { e.preventDefault(); bomSetSelectedRM(exact); return; }
  }
  srchKey(e, 'bom-rm-results', bomPickRM);
}
function bomSetSelectedRM(p) {
  bomSelectedRM = p;
  const inp = document.getElementById('bom-rm-select');
  if (inp) inp.value = p.itemName;
  const box = document.getElementById('bom-rm-results');
  if (box) box.style.display = 'none';
  bomRenderGuide();
  const qty = document.getElementById('bom-rm-qty');
  if (qty) { qty.focus(); qty.select(); }
}
function bomHandleScan(code) {
  closeCameraBarcodeScanner();
  const p = bomFindByCode(code);
  if (!p) {
    alert(`⚠️ Walang produktong may barcode/code na "${code}" sa Product Master. Lagyan muna ng barcode ang produkto o hanapin sa search box.`);
    return;
  }
  bomSetSelectedRM(p);
}

function addIngredientToBOM() {
  let prod = bomSelectedRM;
  if (!prod) {
    const inp = document.getElementById('bom-rm-select');
    prod = bomFindByCode(inp ? inp.value : '');
  }
  const qty = parseFloat(document.getElementById('bom-rm-qty').value || 0);
  const uom = document.getElementById('bom-rm-uom').value;

  if (!prod) { alert('Pumili muna ng sangkap mula sa search list o mag-scan ng barcode.'); return; }
  if (!(qty > 0)) { alert('Ilagay ang quantity (dapat mas mataas sa 0).'); return; }

  const uomName = uom === 'Whole' ? (prod.wholeUOM || 'Whole') : (prod.looseUOM || 'Loose');
  const exist = activeIngredients.find(i => i.itemCode === prod.id && i.uom === uom);
  if (exist) {
    exist.qty = Math.round((exist.qty + qty) * 10000) / 10000;
    alert(`ℹ️ Nasa recipe na ang ${prod.itemName}. Idinagdag ang ${qty} ${uomName} sa dati.`);
  } else {
    activeIngredients.push({
      itemCode: prod.id,
      itemName: prod.itemName,
      qty: qty,
      uom: uom,
      uomName: uomName,
      unitPrice: uom === 'Whole' ? (prod.wholePrice||0) : (prod.loosePrice||0)
    });
  }

  bomResetRMPicker();
  renderIngredientsTable();
  const auto = document.getElementById('bom-auto-scan');
  if (auto && auto.checked) openCameraBarcodeScanner('bom_rm');
  else { const inp = document.getElementById('bom-rm-select'); if (inp) inp.focus(); }
}

function removeIngredientFromBOM(idx) {
  activeIngredients.splice(idx, 1);
  renderIngredientsTable();
}

function renderIngredientsTable() {
  const tbody = document.getElementById('bom-ingredients-tbody');
  if (activeIngredients.length === 0) {
    tbody.innerHTML = '<tr><td colspan="3" style="text-align:center; color:#94a3b8;">Walang sangkap.</td></tr>';
    return;
  }
  let html = '';
  activeIngredients.forEach((i, idx) => {
    html += `<tr>
      <td>${i.itemName} <small>(${i.itemCode})</small></td>
      <td style="white-space:nowrap;">
        <input type="number" value="${i.qty}" min="0.01" step="0.01" style="width:90px; padding:0.3rem;" onchange="updateIngredientQty(${idx}, this.value)">
        <select style="padding:0.3rem; width:auto;" onchange="updateIngredientUOM(${idx}, this.value)">
          <option value="Whole" ${i.uom === 'Whole' ? 'selected' : ''}>${srchEsc(bomUomLabelFor(i, 'Whole'))} (Whole)</option>
          <option value="Loose" ${i.uom === 'Loose' ? 'selected' : ''}>${srchEsc(bomUomLabelFor(i, 'Loose'))} (Loose)</option>
        </select>
      </td>
      <td><button class="btn btn-sm btn-danger" onclick="removeIngredientFromBOM(${idx})">✕</button></td>
    </tr>`;
  });
  tbody.innerHTML = html;
}

async function saveRecipeBOM() {
  const fgVal = document.getElementById('bom-finished-good').value.trim();
  const yieldQty = parseFloat(document.getElementById('bom-yield-qty').value || 1);
  const hubVal = (document.getElementById('bom-hub') || {}).value || '';
  const notesVal = ((document.getElementById('bom-notes') || {}).value || '').trim();
  const scopeVal = hubVal ? 'private' : 'shared';
  
  activeIngredients.forEach(i => { i.uomName = bomUomName(i); });
  if (!fgVal) { alert('Mangyaring ilagay ang pangalan ng Finished Good / Recipe.'); return; }
  if (activeIngredients.length === 0) { alert('Magdagdag ng kahit isang raw material na sangkap.'); return; }
  
  // ---------- EDIT MODE: existing recipe, puwedeng palitan ang pangalan, yield at sangkap ----------
  if (editingBomId) {
    const old = bomRecipes.find(b => b.id === editingBomId);
    if (!old) { alert('Hindi nahanap ang recipe.'); return; }
    const newName = fgVal.trim();
    if (!(yieldQty > 0)) { alert('Dapat mas mataas sa 0 ang yield.'); return; }
    try {
      const me = (typeof getCurrentUser === 'function' && getCurrentUser()) || {};
      const who = me.name || me.username || me.email || 'admin';
      const batch = db.batch();
      batch.update(db.collection('bom_recipes').doc(editingBomId), {
        finishedGoodName: newName,
        yieldQty: yieldQty,
        ingredients: activeIngredients,
        hub: hubVal, scope: scopeVal, notes: notesVal,
        revision: (old.revision || 1) + 1,
        lastEditedBy: who,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      // Isang recipe = isang produktong nabebenta, kaya sabay ding napapalitan ang pangalan sa Product Master
      if (newName !== old.finishedGoodName) {
        batch.update(db.collection('products').doc(old.finishedGoodCode), { itemName: newName });
      }
      await batch.commit();
      const changes = [];
      if (newName !== old.finishedGoodName) changes.push(`pangalan: "${old.finishedGoodName}" → "${newName}"`);
      if (yieldQty !== old.yieldQty) changes.push(`yield: ${old.yieldQty} → ${yieldQty}`);
      changes.push('sangkap: ' + old.ingredients.map(i => `${i.qty} ${i.uom} ${i.itemName}`).join(', ') + ' → ' + activeIngredients.map(i => `${i.qty} ${i.uom} ${i.itemName}`).join(', '));
      await logSystemAction('BOM_EDITED', `Na-edit ang recipe ${editingBomId}: ${changes.join(' | ')}`);
      alert(`✅ Na-update ang recipe: ${newName}.\n(Gagamitin na ang bagong timpla sa susunod na production. Hindi nababago ang mga nagawa na.)`);
      document.getElementById('recipe-builder-modal').style.display = 'none';
      const _savedId = editingBomId;
      editingBomId = null;
      if (typeof loadAdminProducts === 'function') loadAdminProducts();
      if (typeof loadCommissaryInventory === 'function') loadCommissaryInventory();
      await loadManufacturing();
      viewBomReport(_savedId);
    } catch(e) { alert('Error: ' + e.message); }
    return;
  }

  const match = fgVal.match(/\(([^)]+)\)$/);
  let fgId = match ? match[1] : null;
  let fgName = fgVal;
  
  let fgProd = null;
  
  if (fgId) {
    // Gumamit ng existing product
    fgProd = adminProductsList.find(p => (p.itemCode || p.id) === fgId);
    if (fgProd) fgName = fgProd.itemName;
  }
  
  try {
    // Kung walang nahanap o bagong type lang ng pangalan (ex: "Gyoza Wrapper"), Awtomatikong i-create as NEW PRODUCT!
    if (!fgProd) {
      fgId = 'FG-' + Date.now().toString().slice(-6);
      fgName = fgVal.replace(/\([^)]+\)$/, '').trim(); // Remove any fake parentheses if typed manually
      
      await db.collection('products').doc(fgId).set({
        itemCode: fgId,
        sapCode: fgId,
        itemName: fgName,
        commissarySource: hubVal || 'Commissary Hub',
        scope: scopeVal,
        storageStation: 'Finished Goods (Production)',
        wholeUOM: 'Batches',
        looseUOM: 'Pcs',
        wholePrice: 0, // Admin can edit price later
        loosePrice: 0,
        stockWhole: 0,
        stockLoose: 0,
        bufferLimit: 5,
        conversionFactor: yieldQty, // Set as default conversion
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      
      // Mag-log na may na-create na bagong produkto
      await logSystemAction('PRODUCT_CREATED_VIA_BOM', `Awtomatikong gumawa ng bagong Finished Good product: ${fgName} (${fgId})`);
    }
    
    const bomId = `BOM-${fgId}`;
    
    await db.collection('bom_recipes').doc(bomId).set({
      finishedGoodCode: fgId,
      finishedGoodName: fgName,
      yieldQty: yieldQty,
      ingredients: activeIngredients,
      hub: hubVal, scope: scopeVal, notes: notesVal,
      revision: 1,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    
    alert(`✅ Recipe Saved!\n\nNaitala na ang BOM para sa: ${fgName}.\n(Kung ito ay bagong pangalan, awtomatiko na rin itong naidagdag sa Product Masterlist para ma-order ng mga branch at mamonitor sa inventory!)`);
    document.getElementById('recipe-builder-modal').style.display = 'none';
    
    // Refresh tables
    if (typeof loadAdminProducts === 'function') loadAdminProducts();
    if (typeof loadCommissaryInventory === 'function') loadCommissaryInventory();
    await loadManufacturing();
    viewBomReport(bomId);
  } catch(e) { 
    alert('Error: ' + e.message); 
  }
}

async function deleteBOM(id) {
  if(!await uiConfirm('Burahin ang BOM na ito?')) return;
  await db.collection('bom_recipes').doc(id).delete();
  loadManufacturing();
}

// Work Order Execution
async function openWorkOrderModal() {
  if (bomRecipes.length === 0) await loadManufacturing();
  const input = document.getElementById('wo-bom-select');
  const list = document.getElementById('wo-bom-list');
  if (input) input.value = '';
  if (list) {
    list.innerHTML = '';
    visibleBoms().forEach(b => {
      list.innerHTML += `<option value="${b.finishedGoodName} (${b.id})"></option>`;
    });
  }
  document.getElementById('wo-multiplier').value = 1;
  previewWorkOrder();
  document.getElementById('work-order-modal').style.display = 'flex';
}

function previewWorkOrder() {
  const bomVal = document.getElementById('wo-bom-select')?.value;
  const match = bomVal ? bomVal.match(/\(([^)]+)\)$/) : null;
  const bomId = match ? match[1] : null;
  const multi = parseFloat(document.getElementById('wo-multiplier')?.value || 1);
  const outEl = document.getElementById('wo-projected-yield');
  const rmEl = document.getElementById('wo-projected-rm');
  
  if (!bomId || !bomRecipes) {
    outEl.innerText = '--';
    rmEl.innerHTML = '<li>--</li>';
    return;
  }
  
  const bom = bomRecipes.find(b => b.id === bomId);
  if (!bom) return;
  
  outEl.innerText = `+${bom.yieldQty * multi} units ng ${bom.finishedGoodName}`;
  let rms = '';
  bom.ingredients.forEach(i => {
    rms += `<li><b style="color:#ef4444;">-${i.qty * multi}</b> ${bomUomName(i)} of ${i.itemName}</li>`;
  });
  rmEl.innerHTML = rms;
}

async function executeWorkOrder() {
  const bomVal = document.getElementById('wo-bom-select')?.value;
  const match = bomVal ? bomVal.match(/\(([^)]+)\)$/) : null;
  const bomId = match ? match[1] : null;
  const multi = parseFloat(document.getElementById('wo-multiplier').value || 1);
  if (!bomId || multi <= 0) { alert('Invalid work order config.'); return; }

  const bom = bomRecipes.find(b => b.id === bomId);
  if (!bom) { alert('Hindi nahanap ang recipe.'); return; }

  try {
    // Tingnan muna kung sapat ang Raw Materials
    const ings = bom.ingredients || [];
    const snaps = await Promise.all(ings.map(i => db.collection('products').doc(i.itemCode).get()));
    const short = [];
    ings.forEach((i, idx) => {
      const need = i.qty * multi;
      const d = snaps[idx].exists ? snaps[idx].data() : null;
      const have = d ? parseFloat(i.uom === 'Whole' ? (d.stockWhole || 0) : (d.stockLoose || 0)) : 0;
      if (!d || have < need) short.push(`• ${i.itemName}: meron ${have} ${bomUomName(i)}, kailangan ${need}`);
    });
    const warn = short.length ? `\n\n⚠️ KULANG ANG RAW MATERIALS:\n${short.join('\n')}\n(Magiging negative ang stock nito kapag itinuloy.)` : '';
    if (!await uiConfirm('Execute Work Order? Ito ay agad na magbabawas sa iyong Raw Materials.' + warn)) return;

    const batch = db.batch();
    const woRef = 'WO-' + Date.now().toString().slice(-8);
    const outQty = bom.yieldQty * multi;

    // 1. Add FG
    const fgRef = db.collection('products').doc(bom.finishedGoodCode);
    batch.update(fgRef, { stockWhole: firebase.firestore.FieldValue.increment(outQty) });
    addStockMovementToBatch(batch, bom.finishedGoodCode, bom.finishedGoodName, 'PRODUCTION_OUTPUT', woRef, outQty, 0, 'Recipe ' + bomId + ' x' + multi);

    // 2. Deduct RM
    ings.forEach(i => {
      const rmRef = db.collection('products').doc(i.itemCode);
      const dec = -(i.qty * multi);
      if (i.uom === 'Whole') {
        batch.update(rmRef, { stockWhole: firebase.firestore.FieldValue.increment(dec) });
        addStockMovementToBatch(batch, i.itemCode, i.itemName, 'PRODUCTION_INPUT', woRef, dec, 0, 'Recipe ' + bomId + ' x' + multi);
      } else {
        batch.update(rmRef, { stockLoose: firebase.firestore.FieldValue.increment(dec) });
        addStockMovementToBatch(batch, i.itemCode, i.itemName, 'PRODUCTION_INPUT', woRef, 0, dec, 'Recipe ' + bomId + ' x' + multi);
      }
    });
    
    await batch.commit();
    await logSystemAction('WORK_ORDER_EXECUTED', `${woRef}: Ginawa ang ${outQty} units ng ${bom.finishedGoodName}. Nabawas ang RM.`);
    alert('✅ Work Order Completed! Inventory Updated.');
    document.getElementById('work-order-modal').style.display = 'none';
  } catch(e) { alert('Error: ' + e.message); }
}

// ========================================================
// 📊 RECIPE COSTING (COGS) ENGINE
// ========================================================
async function loadCosting() {
  const tbody = document.getElementById('admin-costing-tbody');
  if (!tbody || !db) return;
  
  if (adminProductsList.length === 0) await loadAdminProducts();
  if (bomRecipes.length === 0) await loadManufacturing();
  
  if (bomRecipes.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: #94a3b8;">Gumawa muna ng BOM / Recipe.</td></tr>';
    return;
  }
  
  let html = '';
  bomRecipes.forEach(bom => {
    const fg = adminProductsList.find(p => p.id === bom.finishedGoodCode);
    const sellPrice = fg ? (parseFloat(fg.wholePrice||0)) : 0;
    
    let cogs = 0;
    bom.ingredients.forEach(ing => {
      // Find latest price in products master
      const rm = adminProductsList.find(p => p.id === ing.itemCode);
      if (rm) {
        const cost = ing.uom === 'Whole' ? parseFloat(rm.wholePrice||0) : parseFloat(rm.loosePrice||0);
        cogs += (cost * ing.qty);
      } else {
        cogs += (ing.unitPrice * ing.qty); // fallback
      }
    });
    
    const cogsPerYield = cogs / (bom.yieldQty || 1);
    const margin = sellPrice > 0 ? ((sellPrice - cogsPerYield) / sellPrice) * 100 : 0;
    
    const badge = margin > 40 ? 'badge-success' : (margin > 20 ? 'badge-warning' : 'badge-danger');
    const msg = margin > 40 ? 'Healthy Margin' : (margin > 20 ? 'Warning: Low Margin' : 'Critical / Lugi');
    
    html += `<tr>
      <td><b>${bom.finishedGoodName}</b><br><small>Yield: ${bom.yieldQty}</small></td>
      <td>₱${sellPrice.toFixed(2)}</td>
      <td><b style="color:#b91c1c;">₱${cogsPerYield.toFixed(2)}</b> / batch</td>
      <td><b style="color:#0f172a;">${margin.toFixed(2)}%</b></td>
      <td><span class="badge ${badge}">${msg}</span></td>
    </tr>`;
  });
  
  tbody.innerHTML = html;
}

// ========================================================
// 📅 LOT TRACING (FEFO) ENGINE
// ========================================================
async function loadLotTracing() {
  const tbody = document.getElementById('admin-lot-tbody');
  if (!tbody || !db) return;
  try {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align: center;">Kinukuha ang Lots...</td></tr>';
    const snap = await db.collection('inventory_lots').orderBy('expiryDate', 'asc').get();
    if (snap.empty) {
      tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: #94a3b8;">Walang naka-tag na Lots.</td></tr>';
      return;
    }
    let html = '';
    const now = new Date();
    snap.forEach(doc => {
      const d = doc.data();
      const exp = new Date(d.expiryDate);
      const diffDays = Math.ceil((exp - now) / (1000 * 60 * 60 * 24));
      
      let badge = 'badge-success';
      let msg = 'Good / Fresh';
      if (diffDays <= 0) { badge = 'badge-danger'; msg = 'EXPIRED!'; }
      else if (diffDays <= 7) { badge = 'badge-danger'; msg = '⚠️ Expires in ' + diffDays + ' days'; }
      else if (diffDays <= 30) { badge = 'badge-warning'; msg = 'Expires in ' + diffDays + ' days'; }
      
      html += `<tr>
        <td><b>${d.lotNumber}</b></td>
        <td>${d.itemName}</td>
        <td>${d.qty}</td>
        <td><b>${d.expiryDate}</b></td>
        <td><span class="badge ${badge}">${msg}</span></td>
      </tr>`;
    });
    tbody.innerHTML = html;
  } catch(e) { console.error(e); }
}

async function openLotModal() {
  if (adminProductsList.length === 0) await loadAdminProducts();
  const sel = document.getElementById('lot-product-select');
  if (sel) {
    sel.innerHTML = '<option value="">-- Piliin ang Item --</option>';
    adminProductsList.forEach(p => {
      sel.innerHTML += `<option value="${p.id}|${p.itemName}">${p.itemName} (${p.itemCode})</option>`;
    });
  }
  document.getElementById('lot-modal').style.display = 'flex';
}

async function saveLotRecord() {
  const pVal = document.getElementById('lot-product-select').value;
  const lotNo = document.getElementById('lot-number').value.trim();
  const qty = document.getElementById('lot-qty').value;
  const exp = document.getElementById('lot-expiry').value;
  
  if (!pVal || !lotNo || !exp) { alert('Kumpletuhin ang detalye ng lot.'); return; }
  
  const [pId, pName] = pVal.split('|');
  
  try {
    await db.collection('inventory_lots').doc(lotNo).set({
      lotNumber: lotNo,
      productId: pId,
      itemName: pName,
      qty: parseFloat(qty),
      expiryDate: exp,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    alert('✅ Lot / Expiry Tag Saved!');
    document.getElementById('lot-modal').style.display = 'none';
    loadLotTracing();
  } catch(e) { alert(e.message); }
}

// ========================================================
// ⚙️ ASSET MAINTENANCE ENGINE
// ========================================================
async function loadAssets() {
  const tbody = document.getElementById('admin-assets-tbody');
  if (!tbody || !db) return;
  try {
    const snap = await db.collection('assets').get();
    if (snap.empty) {
      tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: #94a3b8;">Walang assets.</td></tr>';
      return;
    }
    let html = '';
    const now = new Date();
    snap.forEach(doc => {
      const d = doc.data();
      const mDue = new Date(d.maintenanceDue);
      const diff = Math.ceil((mDue - now) / (1000 * 60 * 60 * 24));
      
      let stat = d.status || 'Operational';
      let statBadge = stat === 'Operational' ? 'badge-success' : 'badge-danger';
      
      let mBadge = diff <= 7 ? `<b style="color:red;">${d.maintenanceDue} (DUE)</b>` : d.maintenanceDue;
      
      html += `<tr>
        <td><b>${d.assetCode}</b></td>
        <td>${d.assetName}</td>
        <td>${d.location}</td>
        <td>${mBadge}</td>
        <td><span class="badge ${statBadge}">${stat}</span></td>
      </tr>`;
    });
    tbody.innerHTML = html;
  } catch(e) { console.error(e); }
}

function openAssetModal() {
  document.getElementById('asset-modal').style.display = 'flex';
}

async function saveAsset() {
  const code = document.getElementById('asset-code').value.trim();
  const name = document.getElementById('asset-name').value.trim();
  const loc = document.getElementById('asset-location').value.trim();
  const due = document.getElementById('asset-maintenance').value;
  const stat = document.getElementById('asset-status').value;
  
  if (!code || !name) { alert('Kumpletuhin ang detalye ng asset.'); return; }
  
  try {
    await db.collection('assets').doc(code).set({
      assetCode: code,
      assetName: name,
      location: loc,
      maintenanceDue: due,
      status: stat
    });
    alert('✅ Asset Saved!');
    document.getElementById('asset-modal').style.display = 'none';
    loadAssets();
  } catch(e) { alert(e.message); }
}

// ========================================================
// 📉 AUTOMATED PURCHASE REQUESTS (AUTO-PR) ENGINE
// ========================================================
async function loadAutoPR() {
  const tbody = document.getElementById('admin-auto-pr-tbody');
  if (!tbody || !db) return;
  if (adminProductsList.length === 0) await loadAdminProducts();
  
  let html = '';
  let counter = 0;
  
  adminProductsList.forEach(p => {
    const stock = parseFloat(p.stockWhole || 0);
    const limit = parseFloat(p.bufferLimit || 5);
    
    if (stock <= limit) {
      counter++;
      const recommended = (limit - stock) + 10; // Auto suggestion: Punuin ang buffer + 10 extra
      html += `<tr>
        <td><b>${p.itemCode}</b></td>
        <td>${p.itemName}</td>
        <td style="color:#ef4444; font-weight:bold;">${stock} ${p.wholeUOM}</td>
        <td>${limit} ${p.wholeUOM}</td>
        <td><b style="color:#059669;">Order: ${recommended}</b></td>
        <td><button class="btn btn-sm btn-primary" onclick="alert('Sent to PO Drafts!')">Generate PR</button></td>
      </tr>`;
    }
  });
  
  if (counter === 0) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: #10b981; padding: 1.5rem;">✅ All items are above buffer limit.</td></tr>';
  } else {
    tbody.innerHTML = html;
  }
}

// ========================================================
// 🔐 ACCESS CONTROL (PERMISSIONS) — kontrolado ni Admin, per ROLE at per USER
// Antas ng access bawat module: 'none' (walang access) | 'view' (tingin lang) | 'edit' (tingin at gamit)
// Pagkakasunod ng desisyon:  [override ng user]  ->  [setting ng role]  ->  'none'
// Ang Admin role ay laging buo ang access. Ang "users" at "truncate" ay para sa Admin lang (hindi ipinagkakaloob).
// Nakaimbak sa: system_settings/access_control (roles) at users/{email}.permissions (per user)
// ========================================================
const ACCESS_MODULES = [
  { key: 'dashboard',       label: '📊 Dashboard',               group: 'Overview' },
  { key: 'products',        label: '📦 Products Master',         group: 'Operations' },
  { key: 'manufacturing',   label: '🏭 Manufacturing (BOM)',     group: 'Operations' },
  { key: 'costing',         label: '📈 Recipe Costing',          group: 'Operations' },
  { key: 'lot_tracing',     label: '🏷️ Lot & Expiry Tracing',    group: 'Operations' },
  { key: 'spoilage',        label: '🗑️ Spoilage Approvals',      group: 'Operations' },
  { key: 'auto_pr',         label: '🤖 Auto-PR (Low Stock)',     group: 'Operations' },
  { key: 'purchase_orders', label: '📝 Purchase Orders',         group: 'Procurement & AP' },
  { key: 'ap_invoices',     label: '🧾 A/P Invoices',            group: 'Procurement & AP' },
  { key: 'vendors',         label: '🏢 Vendors',                 group: 'Procurement & AP' },
  { key: 'disputes',        label: '🚨 Branch Disputes',         group: 'Logistics & Branches' },
  { key: 'reports',         label: '📑 Variance & 3PL Reports',  group: 'Logistics & Branches' },
  { key: 'customers',       label: '👥 Customers',               group: 'Logistics & Branches' },
  { key: 'stations',        label: '🏷️ Storage Stations & UOM',  group: 'Logistics & Branches' },
  { key: 'company_mgmt',    label: '🏢 Company Management',     group: 'Logistics & Branches' },
  { key: 'price_lists',     label: '💲 Price Lists (per Company)', group: 'Logistics & Branches' },
  { key: 'daily_prices',    label: '💱 Daily Price Sheet',         group: 'Logistics & Branches' },
  { key: 'requests',        label: '🛠️ Mga Request (Repair/Purchase)', group: 'Procurement & AP' },
  { key: 'sap_items',       label: '📒 SAP Item Master (kada Company)', group: 'Logistics & Branches' },
  { key: 'inv_totals',      label: '📦 Inventory Totals (Beg/End)', group: 'Logistics & Branches' },
  { key: 'ar_ledger',       label: '📒 AR Ledger (Customer Payments)', group: 'Finance & System' },
  { key: 'branch_inv',      label: '📋 Branch Inventory (Kitchen/Wares)', group: 'Logistics & Branches' },
  { key: 'memos',           label: '📢 HR Memo / Announcement', group: 'Human Resources' },
  { key: 'hrdocs',          label: '📚 HR Documents (Forms/Policy)', group: 'Human Resources' },
  { key: 'attendance',      label: '🕒 Attendance & Schedule (HR)', group: 'Human Resources' },
  { key: 'employees',       label: '🧑‍💼 Employee DB (HR)',        group: 'Human Resources' },
  { key: 'payroll',         label: '💸 Payroll / Payslip (HR)',  group: 'Human Resources' },
  { key: 'team',            label: '🚚 Logistics Team',          group: 'Human Resources' },
  { key: 'finance',         label: '🏦 General Ledger',          group: 'Finance & System' },
  { key: 'assets',          label: '🏗️ Assets',                  group: 'Finance & System' },
  { key: 'branding',        label: '🏢 Branding Setup',          group: 'Finance & System' },
  { key: 'logs',            label: '🕵️ Audit Logs',              group: 'Finance & System' },
  { key: 'backups',         label: '💾 Data Backups',            group: 'Finance & System' },
  { key: 'users',           label: '🛡️ User Access',             group: 'Admin Lang', adminOnly: true },
  { key: 'truncate',        label: '🧹 Truncate (Danger Zone)',  group: 'Admin Lang', adminOnly: true }
];
// ---- MGA FEATURE SA LOOB NG COMMISSARY AT BRANCH PAGE ----
// Default: PAYAG (para walang masira). Si Admin ang puwedeng magbawal per role o per user.
// native = aling role ang tinatamaan ng bawal. fns = mga function na hinaharang. sel = mga button/link na itinatago.
const ACCESS_FEATURES = [
  // ---- Commissary page: mga pahina ----
  { key: 'cv_dashboard', native: 'commissary', group: 'Commissary Page — Mga Menu', label: '📊 Makita ang Dashboard', sel: ["[onclick*=\"switchCommissaryView('dashboard')\"]"], view: 'dashboard' },
  { key: 'cv_prices',    native: 'commissary', group: 'Commissary Page — Mga Menu', label: '💱 Daily Price Sheet (mag-presyo)', sel: ["[onclick*=\"switchCommissaryView('prices')\"]"], view: 'prices' },
  { key: 'cv_ar',        native: 'commissary', group: 'Commissary Page — Mga Menu', label: '📒 AR Ledger (bayad ng customers)', sel: ["[onclick*=\"switchCommissaryView('ar')\"]"], view: 'ar' },
  { key: 'cv_orders',    native: 'commissary', group: 'Commissary Page — Mga Menu', label: '📋 Makita ang Orders Queue', sel: ["[onclick*=\"switchCommissaryView('orders')\"]"], view: 'orders' },
  { key: 'cv_inventory', native: 'commissary', group: 'Commissary Page — Mga Menu', label: '📦 Makita ang Inventory', sel: ["[onclick*=\"switchCommissaryView('inventory')\"]"], view: 'inventory' },
  // ---- Commissary page: mga aksyon ----
  { key: 'comm_accept',   native: 'commissary', group: 'Commissary Page — Mga Aksyon', label: '✅ Tanggapin ang order para ihanda', fns: ['commissaryTakeOrder'] },
  { key: 'comm_dispatch', native: 'commissary', group: 'Commissary Page — Mga Aksyon', label: '🚚 I-dispatch ang order', fns: ['commissaryDispatchOrder'] },
  { key: 'comm_cancel',   native: 'commissary', group: 'Commissary Page — Mga Aksyon', label: '❌ Mag-cancel / tumanggap o tumanggi sa cancel request', fns: ['cancelOrderFromCommissary', 'commissaryAcceptCancel', 'commissaryRejectCancel'] },
  { key: 'comm_pahabol',  native: 'commissary', group: 'Commissary Page — Mga Aksyon', label: '➕ Aprubahan / tanggihan ang Pahabol', fns: ['commissaryAcceptPahabol', 'commissaryRejectPahabol'] },
  { key: 'comm_si_po',    native: 'commissary', group: 'Commissary Page — Mga Aksyon', label: '🧾 Mag-edit ng SI / PO number', fns: ['saveModalSIAndPO'] },
  { key: 'comm_print',    native: 'commissary', group: 'Commissary Page — Mga Aksyon', label: '🖨️ Mag-print ng picking slip / mag-download ng CSV', fns: ['printPickingGuide', 'triggerModalPrintSlip', 'triggerModalDownloadCSV', 'downloadBranchOrderCSV', 'copyBranchOrderToClipboard'] },
  { key: 'comm_stock',    native: 'commissary', group: 'Commissary Page — Mga Aksyon', label: '📦 Mag-add ng produkto / mag-adjust ng stock', fns: ['showAddProductModal', 'saveProductWithStationAndUOM', 'updateStock'] },
  { key: 'comm_ar_pay',   native: 'commissary', group: 'Commissary Page — Mga Aksyon', label: '💵 Mag-record ng bayad ng customer', fns: ['arOpenPay', 'arSubmitPay'] },
  { key: 'comm_ar_void',  native: 'commissary', group: 'Commissary Page — Mga Aksyon', label: '🚫 Mag-void ng bayad', fns: ['arVoidPayment'] },
  { key: 'comm_receiving',native: 'commissary', group: 'Commissary Page — Mga Aksyon', label: '📥 Direct Receiving mula sa vendor', fns: ['openDirectReceivingModal', 'submitDirectReceiving'] },
  { key: 'comm_spoilage', native: 'commissary', group: 'Commissary Page — Mga Aksyon', label: '🗑️ Mag-report ng Spoilage', fns: ['openCommissarySpoilageModal', 'submitSpoilageReport'] },
  // ---- Branch page: mga pahina ----
  { key: 'bv_dashboard',  native: 'branch', group: 'Branch Page — Mga Menu', label: '📊 Makita ang Dashboard', sel: ["[onclick*=\"switchBranchView('dashboard')\"]"], view: 'dashboard' },
  { key: 'bv_order',      native: 'branch', group: 'Branch Page — Mga Menu', label: '🛒 Makita ang Place Order', sel: ["[onclick*=\"switchBranchView('order')\"]"], view: 'order' },
  { key: 'bv_deliveries', native: 'branch', group: 'Branch Page — Mga Menu', label: '🚚 Makita ang My Deliveries', sel: ["[onclick*=\"switchBranchView('deliveries')\"]"], view: 'deliveries' },
  { key: 'br_ordboard', native: 'branch', group: 'Branch Page — Mga Menu', label: '📦 Order Board', sel: ["[onclick*=\"switchBranchView('ordboard')\"]"], view: 'ordboard' },
  { key: 'br_hrdocs', native: 'branch', group: 'Branch Page — Mga Menu', label: '📚 HR Documents', sel: ["[onclick*=\"switchBranchView('hrdocs')\"]"], view: 'hrdocs' },
  { key: 'br_attendance', native: 'branch', group: 'Branch Page — Mga Menu', label: '🕒 Attendance', sel: ["[onclick*=\"switchBranchView('attendance')\"]"], view: 'attendance' },
  { key: 'cv_ordboard', native: 'commissary', group: 'Commissary Page — Mga Menu', label: '📦 Order Board', sel: ["[onclick*=\"switchCommissaryView('ordboard')\"]"], view: 'ordboard' },
  { key: 'cv_hrdocs', native: 'commissary', group: 'Commissary Page — Mga Menu', label: '📚 HR Documents', sel: ["[onclick*=\"switchCommissaryView('hrdocs')\"]"], view: 'hrdocs' },
  { key: 'cv_attendance', native: 'commissary', group: 'Commissary Page — Mga Menu', label: '🕒 Attendance', sel: ["[onclick*=\"switchCommissaryView('attendance')\"]"], view: 'attendance' },
  { key: 'br_requests',   native: 'branch', group: 'Branch Page — Mga Menu', label: '🛠️ Mga Request (Repair/Bilhin)', sel: ["[onclick*=\"switchBranchView('requests')\"]"], view: 'requests' },
  { key: 'cv_requests',   native: 'commissary', group: 'Commissary Page — Mga Menu', label: '🛠️ Mga Request (Procurement)', sel: ["[onclick*=\"switchCommissaryView('requests')\"]"], view: 'requests' },
  { key: 'bv_inventory',  native: 'branch', group: 'Branch Page — Mga Menu', label: '📋 Makita ang Inventory Count', sel: ["[onclick*=\"switchBranchView('inventory')\"]"], view: 'inventory' },
  // ---- Branch page: mga aksyon ----
  { key: 'br_order',      native: 'branch', group: 'Branch Page — Mga Aksyon', label: '🛍️ Mag-place ng order', fns: ['openOrderModal', 'submitBranchOrder', 'submitBranchOrderFromModal'] },
  { key: 'br_receive',    native: 'branch', group: 'Branch Page — Mga Aksyon', label: '📝 Tumanggap / pumirma ng delivery (e-POD)', fns: ['submitFinalReceivingProof'] },
  { key: 'br_cancel',     native: 'branch', group: 'Branch Page — Mga Aksyon', label: '❌ Mag-request ng cancel', fns: ['openBranchCancelModal', 'submitBranchCancelRequest'] },
  { key: 'br_pahabol',    native: 'branch', group: 'Branch Page — Mga Aksyon', label: '➕ Mag-request ng Pahabol', fns: ['openBranchPahabolModal', 'submitBranchPahabol'] },
  { key: 'br_inventory', native: 'branch', group: 'Branch Page — Mga Aksyon', label: '💾 Mag-save ng Inventory Count', fns: ['submitInventoryCount'] },
  { key: 'br_late_return',native: 'branch', group: 'Branch Page — Mga Aksyon', label: '↩️ Late Return', fns: ['openLateReturnModal', 'submitLateReturn'] }
];
const PERM_CACHE_KEY = 'kusina_perms';
window.KUSINA_PERMS = null;

function allModulesAt(level) {
  const o = {};
  ACCESS_MODULES.forEach(m => { o[m.key] = level; });
  return o;
}
function validLevel(v) { return v === 'none' || v === 'view' || v === 'edit'; }

function computeFeaturePerms(role, userPerms, rolePerms) {
  const feats = {};
  ACCESS_FEATURES.forEach(f => {
    if (role === 'admin' || f.native !== role) { feats[f.key] = true; return; } // ang bawal ay para lang sa sariling role ng page
    const uv = userPerms && userPerms[f.key];
    const rv = rolePerms && rolePerms[f.key];
    const lvl = validLevel(uv) ? uv : (validLevel(rv) ? rv : 'edit'); // default: PAYAG
    feats[f.key] = lvl !== 'none';
  });
  return feats;
}

function computeEffectivePerms(role, userPerms, rolePerms) {
  if (role === 'admin') return { isAdmin: true, role: role, levels: allModulesAt('edit'), features: computeFeaturePerms('admin') };
  const levels = {};
  ACCESS_MODULES.forEach(m => {
    if (m.adminOnly) { levels[m.key] = 'none'; return; }
    const uv = userPerms && userPerms[m.key];
    const rv = rolePerms && rolePerms[m.key];
    levels[m.key] = validLevel(uv) ? uv : (validLevel(rv) ? rv : 'none');
  });
  return { isAdmin: false, role: role, levels: levels, features: computeFeaturePerms(role, userPerms, rolePerms) };
}

let _permsPromise = null;
function getPermsOnce() { return _permsPromise || (_permsPromise = fetchEffectivePerms()); }

async function fetchEffectivePerms() {
  const u = getCurrentUser();
  const role = normalizeRole(u && u.role);
  if (role === 'admin') return computeEffectivePerms('admin');
  const email = ((u && u.email) || '').toLowerCase();
  if (!email || typeof db === 'undefined' || !db) return computeEffectivePerms(role);

  // hintayin muna ang Firebase session (hanggang 4 na segundo)
  await new Promise(res => {
    if (typeof auth === 'undefined' || !auth) return res();
    const t = setTimeout(res, 4000);
    const un = auth.onAuthStateChanged(() => { clearTimeout(t); un(); res(); });
  });

  try {
    const [uSnap, aSnap] = await Promise.all([
      db.collection('users').doc(email).get(),
      db.collection('system_settings').doc('access_control').get()
    ]);
    const userPerms = uSnap.exists ? (uSnap.data().permissions || {}) : {};
    const rolePerms = aSnap.exists ? (((aSnap.data().roles || {})[role]) || {}) : {};
    const eff = computeEffectivePerms(role, userPerms, rolePerms);
    try { localStorage.setItem(PERM_CACHE_KEY, JSON.stringify({ email: email, levels: eff.levels, features: eff.features, at: Date.now() })); } catch (e) {}
    return eff;
  } catch (e) {
    console.warn('Hindi makuha ang permissions, gagamitin ang naka-cache:', e.message);
    try {
      const cached = JSON.parse(localStorage.getItem(PERM_CACHE_KEY) || 'null');
      if (cached && cached.email === email) return { isAdmin: false, role: role, levels: cached.levels, features: cached.features || computeFeaturePerms(role) };
    } catch (e2) {}
    return computeEffectivePerms(role);
  }
}

function permLevel(key) {
  const p = window.KUSINA_PERMS;
  if (!p) return 'edit'; // wala pang permissions na nakarga: huwag harangan (admin page lang ang gumagamit nito)
  return p.levels[key] || 'none';
}
function canViewModule(key) { return permLevel(key) !== 'none'; }
function canEditModule(key) { return permLevel(key) === 'edit'; }

// ---- View-only mode: itago ang mga button na nagbabago ng data ----
const RO_SAFE_ONCLICK = /^\s*(load|refresh|filter|export|print|view|show|download|toggle|switch|search|apply|clear|close|reset)/i;
let roObserver = null;
function markReadonlyButtons() {
  document.querySelectorAll('button, a.btn').forEach(b => {
    if (b.closest('.sidebar, .top-header')) return;
    const mutating = /btn-(primary|success|danger|warning)/.test(b.className) && !RO_SAFE_ONCLICK.test(b.getAttribute('onclick') || '');
    if (mutating) b.classList.add('ro-hide');
  });
}
function applyReadonlyMode(viewName) {
  const p = window.KUSINA_PERMS;
  const on = !!p && !p.isAdmin && p.levels[viewName] === 'view';
  document.body.classList.toggle('ro-mode', on);
  if (on) {
    markReadonlyButtons();
    if (!roObserver) {
      roObserver = new MutationObserver(() => { if (document.body.classList.contains('ro-mode')) markReadonlyButtons(); });
      roObserver.observe(document.body, { childList: true, subtree: true });
    }
  } else {
    document.querySelectorAll('.ro-hide').forEach(b => b.classList.remove('ro-hide'));
  }
}

// ---- Admin page: ilapat ang permissions sa menu at sa mga view ----
async function applyAdminPermissions() {
  const u = getCurrentUser();
  const perms = await getPermsOnce();
  window.KUSINA_PERMS = perms;

  const allowed = ACCESS_MODULES.filter(m => perms.levels[m.key] !== 'none').map(m => m.key);
  if (!allowed.length) {
    document.body.classList.remove('perm-pending');
    alert('Access Denied: Wala pang module na ibinigay sa account mo. Makipag-ugnayan kay Admin.');
    if (u) redirectToRoleDashboard(u.role);
    return false;
  }

  // Menu: itago ang walang access, pati ang category na walang natira
  document.querySelectorAll('.sidebar-menu .menu-item[data-module], .dots-menu .dots-item[data-module]').forEach(a => {
    a.style.display = perms.levels[a.dataset.module] === 'none' ? 'none' : '';
  });
  document.querySelectorAll('.sidebar-menu .menu-category').forEach(cat => {
    let el = cat.nextElementSibling, any = false;
    while (el && !el.classList.contains('menu-category')) {
      if (el.classList.contains('menu-item') && el.style.display !== 'none') any = true;
      el = el.nextElementSibling;
    }
    cat.style.display = any ? '' : 'none';
  });

  // Non-admin: label, "Bumalik" link, at tamang unang view
  if (!perms.isAdmin) {
    const nav = document.querySelector('.sidebar-menu');
    const home = perms.role === 'commissary' ? 'commissary.html' : 'branch.html';
    const homeLabel = perms.role === 'commissary' ? 'Commissary Portal' : 'Branch Portal';
    if (nav && !document.getElementById('back-to-portal')) {
      const a = document.createElement('a');
      a.id = 'back-to-portal';
      a.href = home;
      a.className = 'menu-item';
      a.innerHTML = `<i>🏠</i> Bumalik sa ${homeLabel}`;
      nav.insertBefore(a, nav.firstChild);
    }
    const first = allowed.includes('dashboard') ? 'dashboard' : allowed[0];
    switchAdminView(first);
    const link = document.querySelector(`.menu-item[data-module="${first}"]`);
    if (link && typeof setActiveMenu === 'function') setActiveMenu(link);
  }
  document.body.classList.remove('perm-pending');
  return true;
}


// ---- Branch / Commissary page: ilapat ang mga feature permission ----
function featureAllowed(key) {
  const p = window.KUSINA_PERMS;
  return !p || !p.features || p.features[key] !== false;
}
function featureDeniedMsg(f) {
  alert('⚠️ Walang pahintulot ang account mo para sa: ' + f.label.replace(/^[^\w]+/, '') + '. Makipag-ugnayan kay Admin.');
}
function installActionGates() {
  ACCESS_FEATURES.forEach(f => {
    (f.fns || []).forEach(fn => {
      const orig = window[fn];
      if (typeof orig !== 'function' || orig.__gated) return;
      const wrapped = function () {
        if (!featureAllowed(f.key)) { featureDeniedMsg(f); return; }
        return orig.apply(this, arguments);
      };
      wrapped.__gated = true;
      window[fn] = wrapped;
    });
  });
}
function applyFeatureHiding() {
  const p = window.KUSINA_PERMS;
  if (!p || !p.features) return;
  ACCESS_FEATURES.forEach(f => {
    if (p.features[f.key] !== false) return;
    (f.fns || []).forEach(fn => {
      document.querySelectorAll(`[onclick*="${fn}("]`).forEach(el => el.classList.add('perm-hide'));
    });
    (f.sel || []).forEach(sel => {
      document.querySelectorAll(sel).forEach(el => el.classList.add('perm-hide'));
    });
  });
  if (typeof syncMenuCategories === 'function') syncMenuCategories();
}
async function applyFeaturePermissions() {
  const perms = await getPermsOnce();
  window.KUSINA_PERMS = perms;
  if (perms.isAdmin) return;
  installActionGates();
  applyFeatureHiding();
  let raf = null;
  new MutationObserver(() => {
    if (raf) return;
    raf = requestAnimationFrame(() => { raf = null; applyFeatureHiding(); });
  }).observe(document.body, { childList: true, subtree: true });

  // Kung bawal ang unang view (dashboard), ilipat sa unang pinapayagan
  const views = ACCESS_FEATURES.filter(f => f.view && f.native === perms.role);
  const firstOk = views.find(f => perms.features[f.key] !== false);
  const dash = views.find(f => f.view === 'dashboard');
  if (dash && perms.features[dash.key] === false && firstOk) {
    if (perms.role === 'commissary') switchCommissaryView(firstOk.view);
    else if (perms.role === 'branch') switchBranchView(firstOk.view);
  }
}

// ---- Branch / Commissary page: magdagdag ng link papunta sa mga module na pinayagan ----
async function injectModulesLink() {
  const menu = document.getElementById('branch-dropdown-menu') || document.getElementById('commissary-dropdown-menu');
  if (!menu || document.getElementById('modules-portal-link')) return;
  const perms = await getPermsOnce();
  if (!ACCESS_MODULES.some(m => perms.levels[m.key] !== 'none')) return;
  const a = document.createElement('a');
  a.id = 'modules-portal-link';
  a.href = 'admin.html';
  a.style.cssText = 'display: block; padding: 0.75rem 1rem; border-bottom: 1px solid #f1f5f9; color: #2563eb; font-weight: 600;';
  a.innerHTML = '🧰 Mga Module (Admin Portal)';
  menu.insertBefore(a, menu.lastElementChild);
}

// ========================================================
// 🛠️ ACCESS CONTROL MANAGER (nasa User Access page, Admin lang)
// ========================================================
let acRoleState = { commissary: {}, branch: {} };
let acUsersList = [];
let acPickedEmail = '';

const AC_LEVEL_OPTS = [['none', '🚫 Walang access'], ['view', '👁️ View lang'], ['edit', '✏️ View at Edit']];

function acSelectAllow(id, value, withInherit) {
  let opts = withInherit ? `<option value="" ${value === '' ? 'selected' : ''}>↩ Sundin ang role</option>` : '';
  [['edit', '✅ Puwede'], ['none', '🚫 Bawal']].forEach(([v, t]) => { opts += `<option value="${v}" ${value === v ? 'selected' : ''}>${t}</option>`; });
  return `<select id="${id}" style="font-size: 0.8rem; padding: 0.3rem 0.4rem;">${opts}</select>`;
}

function acSelect(id, value, withInherit) {
  let opts = withInherit ? `<option value="" ${value === '' ? 'selected' : ''}>↩ Sundin ang role</option>` : '';
  AC_LEVEL_OPTS.forEach(([v, t]) => { opts += `<option value="${v}" ${value === v ? 'selected' : ''}>${t}</option>`; });
  return `<select id="${id}" style="font-size: 0.8rem; padding: 0.3rem 0.4rem;">${opts}</select>`;
}

async function renderAccessControlManagerBase() {
  const root = document.getElementById('access-control-root');
  if (!root || !db) return;
  const me = getCurrentUser();
  if (!me || normalizeRole(me.role) !== 'admin') { root.innerHTML = ''; return; }

  try {
    const aSnap = await db.collection('system_settings').doc('access_control').get();
    const roles = aSnap.exists ? (aSnap.data().roles || {}) : {};
    acRoleState = { commissary: roles.commissary || {}, branch: roles.branch || {} };
  } catch (e) { acRoleState = { commissary: {}, branch: {} }; }

  const grantable = ACCESS_MODULES.filter(m => !m.adminOnly);
  let rows = '', lastGroup = '';
  grantable.forEach(m => {
    if (m.group !== lastGroup) {
      rows += `<tr><td colspan="4" style="background:#f1f5f9; font-weight:800; font-size:0.75rem; text-transform:uppercase; color:#64748b;">${m.group}</td></tr>`;
      lastGroup = m.group;
    }
    rows += `<tr>
      <td><b>${m.label}</b></td>
      <td style="text-align:center;"><span class="badge badge-admin">Buo</span></td>
      <td>${acSelect('ac-role-commissary-' + m.key, acRoleState.commissary[m.key] || 'none', false)}</td>
      <td>${acSelect('ac-role-branch-' + m.key, acRoleState.branch[m.key] || 'none', false)}</td>
    </tr>`;
  });

  // Mga feature sa loob ng Commissary at Branch page
  let featRows = '', lastFG = '';
  ACCESS_FEATURES.forEach(f => {
    if (f.group !== lastFG) {
      featRows += `<tr><td colspan="4" style="background:#f1f5f9; font-weight:800; font-size:0.75rem; text-transform:uppercase; color:#64748b;">${f.group}</td></tr>`;
      lastFG = f.group;
    }
    const cell = r => f.native === r ? acSelectAllow(`ac-role-${r}-${f.key}`, acRoleState[r][f.key] === 'none' ? 'none' : 'edit', false) : '<span style="color:#cbd5e1;">—</span>';
    featRows += `<tr><td><b>${f.label}</b></td><td style="text-align:center;"><span class="badge badge-admin">Buo</span></td><td>${cell('commissary')}</td><td>${cell('branch')}</td></tr>`;
  });

  root.innerHTML = `
    <div class="card">
      <div class="card-title"><span>🔐 Role Permissions (Ano ang magagamit ng bawat Role)</span>
        <button class="btn btn-success btn-sm" onclick="saveRolePermissions()">💾 I-save ang Role Permissions</button>
      </div>
      <p style="font-size: 0.85rem; color: #64748b; margin-bottom: 1rem;">
        Piliin kung anong module ang makikita at magagamit ng bawat role. Ang module na may access ay lalabas sa menu ng Admin Portal ng role na iyon
        (may link sa dropdown menu nila). <b>View lang</b> = makikita pero hindi makakapag-edit. Ang Admin ay laging buo ang access;
        ang User Access at Truncate ay para sa Admin lang.
      </p>
      <div class="table-responsive"><table>
        <thead><tr><th>Module</th><th style="text-align:center;">Admin</th><th>Commissary Hub</th><th>Branch Operations</th></tr></thead>
        <tbody>${rows}</tbody>
      </table></div>
      <h4 style="margin: 1.25rem 0 0.25rem;">🧩 Mga Feature sa loob ng Commissary at Branch Page</h4>
      <p style="font-size: 0.85rem; color: #64748b; margin-bottom: 0.75rem;">Default ay <b>✅ Puwede</b> ang lahat. Piliin ang <b>🚫 Bawal</b> para itago ang button o menu at harangan ang aksyon para sa role na iyon.</p>
      <div class="table-responsive"><table>
        <thead><tr><th>Feature</th><th style="text-align:center;">Admin</th><th>Commissary Hub</th><th>Branch Operations</th></tr></thead>
        <tbody>${featRows}</tbody>
      </table></div>
    </div>

    <div class="card">
      <div class="card-title"><span>👤 Per-User Permissions (Exception para sa isang tao)</span></div>
      <p style="font-size: 0.85rem; color: #64748b; margin-bottom: 1rem;">
        Mas nangingibabaw ito kaysa sa Role Permissions. Piliin ang "↩ Sundin ang role" kung walang exception.
      </p>
      <div class="srch-wrap" style="max-width: 460px; margin-bottom: 1rem;">
        <input type="text" id="ac-user-search" autocomplete="off" placeholder="🔎 Hanapin ang user (pangalan, email, branch)..." oninput="acSearchUsers()" onfocus="acSearchUsers()" onkeydown="srchKey(event, 'ac-user-results', acPickUser)">
        <div id="ac-user-results" class="srch-results"></div>
      </div>
      <div id="ac-user-editor"></div>
    </div>`;

  try {
    const snap = await db.collection('users').get();
    acUsersList = [];
    snap.forEach(d => {
      const x = d.data();
      if (normalizeRole(x.role) !== 'admin') acUsersList.push({ email: d.id, name: x.name || d.id.split('@')[0], role: normalizeRole(x.role) || 'pending', branch: x.branch || '', permissions: x.permissions || {} });
    });
  } catch (e) { acUsersList = []; }
}

async function saveRolePermissions() {
  if (!db) return;
  const roles = { commissary: {}, branch: {} };
  ACCESS_MODULES.filter(m => !m.adminOnly).forEach(m => {
    ['commissary', 'branch'].forEach(r => {
      const el = document.getElementById(`ac-role-${r}-${m.key}`);
      if (el && validLevel(el.value) && el.value !== 'none') roles[r][m.key] = el.value;
    });
  });
  ACCESS_FEATURES.forEach(f => {
    const el = document.getElementById(`ac-role-${f.native}-${f.key}`);
    if (el && el.value === 'none') roles[f.native][f.key] = 'none';
  });
  try {
    await db.collection('system_settings').doc('access_control').set({
      roles: roles,
      updatedBy: (getCurrentUser() && getCurrentUser().email) || 'admin',
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    await logSystemAction('ACCESS_ROLES_UPDATED', `In-update ang Role Permissions. Commissary: ${Object.keys(roles.commissary).length} module, Branch: ${Object.keys(roles.branch).length} module.`);
    alert('✅ Na-save ang Role Permissions. Mag-aapply ito sa susunod na pag-load ng page ng bawat user.');
  } catch (e) { alert('Error: ' + e.message); }
}

function acSearchUsers() {
  const inp = document.getElementById('ac-user-search');
  if (!inp) return;
  const list = acUsersList.filter(u => smartMatch(inp.value, u.name, u.email, u.branch, u.role)).slice(0, 30);
  acUsersList._shown = list;
  srchRender('ac-user-results', list,
    u => `<b>${srchEsc(u.name)}</b> <small style="color:#64748b;">(${srchEsc(u.role)}${u.branch ? ' · ' + srchEsc(u.branch) : ''})</small><br><small style="color:#64748b;">${srchEsc(u.email)}</small>`,
    'acPickUserIdx', 'Walang nakitang user.');
}
function acPickUserIdx(i) { const u = (acUsersList._shown || [])[i]; if (u) acPickUser(u); }
function acPickUser(u) {
  if (typeof u === 'number') { acPickUserIdx(u); return; }
  acPickedEmail = u.email;
  const inp = document.getElementById('ac-user-search');
  if (inp) inp.value = `${u.name} (${u.email})`;
  const box = document.getElementById('ac-user-results');
  if (box) box.style.display = 'none';

  const grantable = ACCESS_MODULES.filter(m => !m.adminOnly);
  const lbl = { none: 'Walang access', view: 'View lang', edit: 'View at Edit' };
  let rows = '', lastGroup = '';
  grantable.forEach(m => {
    if (m.group !== lastGroup) {
      rows += `<tr><td colspan="3" style="background:#f1f5f9; font-weight:800; font-size:0.75rem; text-transform:uppercase; color:#64748b;">${m.group}</td></tr>`;
      lastGroup = m.group;
    }
    const roleLevel = (acRoleState[u.role] && acRoleState[u.role][m.key]) || 'none';
    rows += `<tr><td><b>${m.label}</b></td><td><small style="color:#64748b;">${lbl[roleLevel]}</small></td><td>${acSelect('ac-user-' + m.key, validLevel(u.permissions[m.key]) ? u.permissions[m.key] : '', true)}</td></tr>`;
  });
  let uFeat = '', lastUG = '';
  ACCESS_FEATURES.filter(f => f.native === u.role).forEach(f => {
    if (f.group !== lastUG) {
      uFeat += `<tr><td colspan="3" style="background:#f1f5f9; font-weight:800; font-size:0.75rem; text-transform:uppercase; color:#64748b;">${f.group}</td></tr>`;
      lastUG = f.group;
    }
    const rl = (acRoleState[u.role] && acRoleState[u.role][f.key] === 'none') ? 'Bawal' : 'Puwede';
    uFeat += `<tr><td><b>${f.label}</b></td><td><small style="color:#64748b;">${rl}</small></td><td>${acSelectAllow('ac-user-' + f.key, validLevel(u.permissions[f.key]) ? u.permissions[f.key] : '', true)}</td></tr>`;
  });
  document.getElementById('ac-user-editor').innerHTML = `
    <div style="margin-bottom: 0.75rem;"><b>${srchEsc(u.name)}</b> <span class="badge badge-secondary">${srchEsc(u.role)}</span> <small style="color:#64748b;">${srchEsc(u.email)}</small></div>
    ${acCustomRoleSelectHtml(u)}
    <div class="table-responsive"><table>
      <thead><tr><th>Module</th><th>Ayon sa role niya</th><th>Exception para sa user na ito</th></tr></thead>
      <tbody>${rows}${uFeat}</tbody>
    </table></div>
    <div style="display:flex; gap:0.5rem; margin-top:1rem;">
      <button class="btn btn-success" onclick="saveUserPermissions()">💾 I-save ang Permissions ng User</button>
      <button class="btn btn-secondary" onclick="clearUserPermissions()">↩ Alisin lahat ng exception</button>
    </div>`;
}
async function saveUserPermissions() {
  if (!db || !acPickedEmail) return;
  const perms = {};
  ACCESS_MODULES.filter(m => !m.adminOnly).forEach(m => {
    const el = document.getElementById('ac-user-' + m.key);
    if (el && validLevel(el.value)) perms[m.key] = el.value;
  });
  ACCESS_FEATURES.forEach(f => {
    const el = document.getElementById('ac-user-' + f.key);
    if (el && validLevel(el.value)) perms[f.key] = el.value;
  });
  try {
    await db.collection('users').doc(acPickedEmail).update({
      permissions: Object.keys(perms).length ? perms : firebase.firestore.FieldValue.delete()
    });
    const u = acUsersList.find(x => x.email === acPickedEmail);
    if (u) u.permissions = perms;
    await logSystemAction('ACCESS_USER_UPDATED', `In-update ang permissions ni ${acPickedEmail}: ${Object.keys(perms).length} exception.`);
    alert('✅ Na-save ang permissions ng user. Mag-aapply ito sa susunod niyang pag-load ng page.');
  } catch (e) { alert('Error: ' + e.message); }
}
async function clearUserPermissions() {
  if (!acPickedEmail || !await uiConfirm('Alisin lahat ng exception ng user na ito? Susundin na niya ang role niya.')) return;
  document.querySelectorAll('[id^="ac-user-"]').forEach(el => { if (el.tagName === 'SELECT') el.value = ''; });
  await saveUserPermissions();
}


// ========================================================
// 🏢 COMMISSARY HUB SCOPING (kanya-kanyang produkto at recipe ng bawat commissary)
// Lohika: scope 'shared' = lahat ng hub ay nakakakita. Kung hindi shared, ang hub lang na may-ari (commissarySource) ang makakakita.
// Ang lumang produkto/BOM na walang nakatakdang hub ay nananatiling nakikita (walang masisira).
// ========================================================
function hubKey(s) { return String(s || '').trim().toLowerCase(); }
function myHubName() { const u = getCurrentUser() || {}; return u.hub || u.branch || ''; }
function activeHubFilter() {
  const u = getCurrentUser() || {};
  if (normalizeRole(u.role) === 'admin') { const el = document.getElementById('mfg-hub-filter'); return el ? el.value : ''; }
  return myHubName();
}
function productVisibleToHub(p, hub) {
  if (!hub || !p) return true;
  if (p.scope === 'shared') return true;
  const ph = hubKey(p.commissarySource), h = hubKey(hub);
  return !ph || ph.includes(h) || h.includes(ph);
}
function bomVisibleToHub(b, hub) {
  if (!hub || !b) return true;
  if (!b.hub || b.scope === 'shared') return true;
  const bh = hubKey(b.hub), h = hubKey(hub);
  return bh.includes(h) || h.includes(bh);
}
function setSelValue(sel, val) {
  if (!sel) return;
  if (val && ![...sel.options].some(o => o.value === val)) {
    const o = document.createElement('option'); o.value = val; o.textContent = val; sel.appendChild(o);
  }
  sel.value = val || '';
}
async function loadHubOptions() {
  if (!db) return;
  const names = new Set();
  try { (await db.collection('commissary_hubs').get()).forEach(d => names.add(d.data().name || d.id)); } catch (e) {}
  (adminProductsList || []).forEach(p => { if (p.commissarySource) names.add(p.commissarySource); });
  const list = [...names].filter(Boolean).sort((a, b) => a.localeCompare(b));
  const fill = (id, first) => {
    const el = document.getElementById(id); if (!el) return;
    const cur = el.value;
    el.innerHTML = `<option value="">${first}</option>` + list.map(n => `<option value="${srchEsc(n)}">🏢 ${srchEsc(n)}</option>`).join('');
    setSelValue(el, cur);
  };
  fill('admin-item-hub', '-- Pumili ng Commissary Hub --');
  fill('mfg-hub-filter', '🏢 Lahat ng Hub');
  fill('bom-hub', '🌐 Lahat ng Hub (Shared)');
  fill('comm-bom-hub', '🌐 Lahat ng Hub (Shared)');
  return list;
}
async function loadHubsManager() {
  const tbody = document.getElementById('hubs-list-tbody');
  if (!tbody || !db) return;
  try {
    const snap = await db.collection('commissary_hubs').get();
    if (snap.empty) { tbody.innerHTML = '<tr><td colspan="2" style="text-align:center;color:#94a3b8;padding:1rem;">Wala pang hub. Mag-add sa itaas.</td></tr>'; return; }
    let h = ''; snap.forEach(d => { h += `<tr><td><b>🏢 ${srchEsc(d.data().name || d.id)}</b></td><td><button class="btn btn-sm btn-danger" onclick="deleteHub('${srchEsc(d.id)}')">🗑️</button></td></tr>`; });
    tbody.innerHTML = h;
  } catch (e) { console.error(e); }
}
async function addNewHub() {
  const input = document.getElementById('new-hub-label');
  const name = input ? input.value.trim() : '';
  if (!name) { alert('Ilagay ang pangalan ng Commissary Hub.'); return; }
  try {
    await db.collection('commissary_hubs').doc(name.replace(/[\/#?]/g, '-')).set({ name: name, createdAt: firebase.firestore.FieldValue.serverTimestamp() });
    logSystemAction('HUB_ADDED', 'Nagdagdag ng Commissary Hub: ' + name);
    input.value = ''; loadHubsManager(); loadHubOptions();
  } catch (e) { alert('Error: ' + e.message); }
}
async function deleteHub(id) {
  if (!await uiConfirm('Tanggalin ang hub na ito sa listahan? (Hindi nito binubura ang mga produkto.)')) return;
  try { await db.collection('commissary_hubs').doc(id).delete(); loadHubsManager(); loadHubOptions(); } catch (e) { alert('Error: ' + e.message); }
}

// ========================================================
// 🔎 UNIVERSAL SEARCHABLE DROPDOWN (lahat ng <select> na marami ang laman ay nagiging searchable)
// May "➕ Idagdag" para sa Stations, UOM at Hub kapag wala pa sa listahan.
// ========================================================
const MASTER_BY_ID = {
  'admin-item-station': 'stations', 'new-storage-station': 'stations',
  'admin-item-whole-uom': 'uom_whole', 'new-whole-uom': 'uom_whole',
  'admin-item-loose-uom': 'uom_loose', 'new-loose-uom': 'uom_loose',
  'admin-item-hub': 'hubs', 'bom-hub': 'hubs', 'inv-setup-station': 'inv_stations', 'inv-company-sel': 'companies'
};
const FORCE_SEARCH_IDS = ['mfg-hub-filter', 'admin-item-supplier', 'new-item-supplier', 'lot-product-select', 'pay-emp-select', 'po-uom-select', 'bom-rm-uom'];

async function addMasterEntry(kind, name) {
  if (!db) throw new Error('Walang database.');
  const safe = name.replace(/[\/#?]/g, '-');
  if (kind === 'stations') await db.collection('storage_stations').doc(safe).set({ name: name, createdAt: firebase.firestore.FieldValue.serverTimestamp() });
  else if (kind === 'inv_stations') await db.collection('branch_stations').doc(safe).set({ name: name, createdAt: firebase.firestore.FieldValue.serverTimestamp() });
  else if (kind === 'companies') await db.collection('companies').doc(safe).set({ name: name, createdAt: firebase.firestore.FieldValue.serverTimestamp() });
  else if (kind === 'hubs') await db.collection('commissary_hubs').doc(safe).set({ name: name, createdAt: firebase.firestore.FieldValue.serverTimestamp() });
  else if (kind === 'uom_whole' || kind === 'uom_loose') {
    const type = kind === 'uom_whole' ? 'whole' : 'loose';
    await db.collection('uom_settings').doc(`${type}_${safe.toLowerCase()}`).set({ type: type, name: name, createdAt: firebase.firestore.FieldValue.serverTimestamp() });
  }
  logSystemAction('MASTER_DATA_ADDED', `Nagdagdag ng ${kind}: ${name}`);
}

function enhanceSelect(sel) {
  if (sel.__enh) return;
  sel.__enh = true;
  const kind = MASTER_BY_ID[sel.id] || '';
  const wrap = document.createElement('div');
  wrap.className = 'srch-wrap ss-wrap';
  const inp = document.createElement('input');
  inp.type = 'text'; inp.className = 'ss-input'; inp.autocomplete = 'off';
  inp.placeholder = '🔎 Mag-search...';
  const box = document.createElement('div');
  box.className = 'srch-results';
  sel.parentNode.insertBefore(wrap, sel);
  wrap.appendChild(inp); wrap.appendChild(box); wrap.appendChild(sel);
  sel.style.display = 'none';
  let items = [], active = -1;

  const optLabel = o => (o.textContent || '').trim();
  const refresh = () => {
    inp.disabled = sel.disabled;
    if (document.activeElement !== inp) {
      const o = sel.options[sel.selectedIndex];
      inp.value = (o && o.value !== '') ? optLabel(o) : '';
      inp.placeholder = (sel.options[0] && sel.options[0].value === '') ? optLabel(sel.options[0]) : '🔎 Mag-search...';
    }
  };
  const close = () => { box.style.display = 'none'; active = -1; };
  const pick = (value) => {
    sel.value = value;
    sel.dispatchEvent(new Event('change', { bubbles: true }));
    refresh(); close();
    inp.blur();
  };
  const render = (q) => {
    const opts = [...sel.options];
    items = opts.filter(o => o.value !== '' && smartMatch(q, optLabel(o), o.value)).map(o => ({ type: 'opt', o }));
    const hasBlank = opts.some(o => o.value === '');
    if (hasBlank && !q) items.unshift({ type: 'clear' });
    const exact = opts.some(o => hubKey(o.value) === hubKey(q) || hubKey(optLabel(o).replace(/^[^\w]+/, '')) === hubKey(q));
    if (kind && q.trim() && !exact) items.push({ type: 'add', name: q.trim() });
    if (!items.length) { box.innerHTML = '<div class="srch-empty">Walang tugma.</div>'; box.style.display = 'block'; return; }
    box.innerHTML = items.map((it, i) => {
      const cls = 'srch-item' + (i === active ? ' active' : '');
      if (it.type === 'clear') return `<div class="${cls}" data-i="${i}" style="color:#64748b;">↩ ${srchEsc(optLabel(sel.options[0]) || 'Alisin ang pinili')}</div>`;
      if (it.type === 'add') return `<div class="${cls}" data-i="${i}" style="color:#059669;font-weight:700;">➕ Idagdag: "${srchEsc(it.name)}"</div>`;
      return `<div class="${cls}" data-i="${i}">${srchEsc(optLabel(it.o))}</div>`;
    }).join('');
    box.style.display = 'block';
  };
  const choose = async (i) => {
    const it = items[i]; if (!it) return;
    if (it.type === 'clear') return pick('');
    if (it.type === 'opt') return pick(it.o.value);
    try {
      await addMasterEntry(kind, it.name);
      const o = document.createElement('option'); o.value = it.name;
      o.textContent = (kind === 'stations' || kind === 'inv_stations' ? '📍 ' : kind === 'hubs' || kind === 'companies' ? '🏢 ' : kind === 'uom_whole' ? '📦 ' : '🥢 ') + it.name;
      sel.appendChild(o);
      pick(it.name);
    } catch (e) { alert('Hindi maidagdag: ' + e.message); }
  };
  box.addEventListener('mousedown', e => { const el = e.target.closest('.srch-item'); if (el) { e.preventDefault(); choose(parseInt(el.dataset.i)); } });
  inp.addEventListener('focus', () => { inp.select(); active = -1; render(''); });
  inp.addEventListener('input', () => { active = -1; render(inp.value); });
  inp.addEventListener('blur', () => { setTimeout(() => { close(); refresh(); }, 120); });
  inp.addEventListener('keydown', e => {
    if (e.key === 'ArrowDown') { e.preventDefault(); active = Math.min(items.length - 1, active + 1); render(inp.value === sel.options[sel.selectedIndex]?.textContent?.trim() ? '' : inp.value); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); active = Math.max(0, active - 1); render(inp.value === sel.options[sel.selectedIndex]?.textContent?.trim() ? '' : inp.value); }
    else if (e.key === 'Enter') { e.preventDefault(); choose(active >= 0 ? active : 0); }
    else if (e.key === 'Escape') { close(); inp.blur(); }
  });
  // Para gumana ang sel.value = '...' galing sa code
  const desc = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value');
  Object.defineProperty(sel, 'value', { configurable: true, get() { return desc.get.call(this); }, set(v) { desc.set.call(this, v); refresh(); } });
  new MutationObserver(refresh).observe(sel, { childList: true, subtree: true, attributes: true, attributeFilter: ['disabled'] });
  refresh();
}

function enhanceSelects(root) {
  (root || document).querySelectorAll('select').forEach(sel => {
    if (sel.__enh || sel.hasAttribute('data-nosearch') || sel.closest('table')) return;
    const force = !!MASTER_BY_ID[sel.id] || FORCE_SEARCH_IDS.includes(sel.id) || sel.hasAttribute('data-searchable');
    if (force || sel.options.length >= 7) enhanceSelect(sel);
  });
}
function startSelectEnhancer() {
  enhanceSelects(document);
  let t = null;
  new MutationObserver(() => { clearTimeout(t); t = setTimeout(() => enhanceSelects(document), 250); }).observe(document.body, { childList: true, subtree: true });
}

// ========================================================
// 🧰 CSV / PRINT UTILITIES (gamit ng lahat ng report, export at import)
// ========================================================
function csvCell(v) { return `"${String(v == null ? '' : v).replace(/"/g, '""')}"`; }
function parseCSV(text) {
  const rows = []; let row = [], cur = '', q = false;
  text = String(text || '').replace(/^﻿/, '');
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; }
      else cur += c;
    } else if (c === '"') q = true;
    else if (c === ',') { row.push(cur); cur = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(cur); cur = ''; if (row.some(x => x.trim() !== '')) rows.push(row); row = []; }
    else cur += c;
  }
  row.push(cur); if (row.some(x => x.trim() !== '')) rows.push(row);
  return rows;
}
function csvToObjects(text) {
  const rows = parseCSV(text); if (rows.length < 2) return [];
  const heads = rows[0].map(h => h.trim().toLowerCase().replace(/[\s\-]+/g, '_'));
  return rows.slice(1).map(r => { const o = {}; heads.forEach((h, i) => { o[h] = (r[i] || '').trim(); }); return o; });
}
function pickCSVFile() {
  return new Promise(resolve => {
    const f = document.createElement('input'); f.type = 'file'; f.accept = '.csv,text/csv';
    f.onchange = () => { if (!f.files.length) return resolve(null); const r = new FileReader(); r.onload = e => resolve(e.target.result); r.readAsText(f.files[0]); };
    f.click();
  });
}
const PRINT_CSS = `body{font-family:Inter,Arial,sans-serif;color:#0f172a;margin:24px;font-size:12px}
h1{font-size:20px;margin:0 0 2px}h2{font-size:15px;margin:14px 0 6px}.meta{color:#475569;font-size:11px;margin-bottom:10px}
table{width:100%;border-collapse:collapse;margin-top:6px}th,td{border:1px solid #94a3b8;padding:5px 7px;text-align:left;vertical-align:top}
th{background:#e2e8f0}td.num,th.num{text-align:right}.total td{font-weight:700;background:#f1f5f9}
.box{border:1px solid #94a3b8;padding:8px;border-radius:4px;margin-top:8px;white-space:pre-wrap}
.pg{page-break-after:always}.pg:last-child{page-break-after:auto}.sign{display:flex;gap:40px;margin-top:36px}.sign div{flex:1;border-top:1px solid #0f172a;padding-top:4px;text-align:center;font-size:11px}`;
function printHtmlDoc(title, bodyHtml) {
  const f = document.createElement('iframe');
  f.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;';
  document.body.appendChild(f);
  const d = f.contentWindow.document;
  d.open();
  d.write(`<!doctype html><html><head><meta charset="utf-8"><title>${srchEsc(title)}</title><style>${PRINT_CSS}</style></head><body>${(/class="rc"|comp-hdr/.test(bodyHtml)) ? '' : compHeaderHtml(compForUser())}${bodyHtml}</body></html>`);
  d.close();
  setTimeout(() => { try { f.contentWindow.focus(); f.contentWindow.print(); } catch (e) { alert('Hindi mabuksan ang print: ' + e.message); } setTimeout(() => f.remove(), 2000); }, 350);
}
function printedByLine() { const u = getCurrentUser() || {}; return `Printed ${new Date().toLocaleString('en-PH')} · ${srchEsc(u.name || u.email || '')}`; }

// ---- Awtomatikong "🖨️ Print" at "⬇️ CSV" sa bawat card na may table (kung wala pang sariling print/export) ----
function tableToMatrix(table) {
  const heads = [...table.querySelectorAll('thead th')];
  const skip = new Set();
  heads.forEach((th, i) => { if (/^(aksyon|action|actions|options|edit|print|view)?$/i.test(th.innerText.trim())) skip.add(i); });
  const cellText = td => {
    const s = td.querySelector('select'); if (s && s.selectedIndex >= 0) return s.options[s.selectedIndex].text.trim();
    const i = td.querySelector('input:not([type=hidden])'); if (i && !td.innerText.trim()) return i.value;
    return td.innerText.replace(/\s+/g, ' ').trim();
  };
  const out = [heads.map((th, i) => skip.has(i) ? null : th.innerText.replace(/\s+/g, ' ').trim()).filter(x => x !== null)];
  table.querySelectorAll('tbody tr').forEach(tr => {
    const tds = [...tr.children];
    if (tds.length === 1 && tds[0].colSpan > 1) return; // "Walang laman" na row
    if (tr.style.display === 'none') return;
    out.push(tds.map((td, i) => skip.has(i) ? null : cellText(td)).filter(x => x !== null));
  });
  return out;
}
function cardTableOf(btn) { const card = btn.closest('.card'); return card ? card.querySelector('table') : null; }
function cardTitleText(btn) { const c = btn.closest('.card'); const t = c && c.querySelector('.card-title span'); return (t ? t.innerText : document.title).replace(/[^\w\s&()\-]/g, '').trim() || 'Report'; }
function printCardTable(btn) {
  const t = cardTableOf(btn); if (!t) return;
  const m = tableToMatrix(t); if (m.length < 2) { alert('Walang laman na ipi-print.'); return; }
  const title = cardTitleText(btn);
  const html = `<h1>${srchEsc(title)}</h1><div class="meta">${printedByLine()}</div><table><thead><tr>${m[0].map(h => `<th>${srchEsc(h)}</th>`).join('')}</tr></thead><tbody>${m.slice(1).map(r => `<tr>${r.map(c => `<td>${srchEsc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
  printHtmlDoc(title, html);
}
function exportCardTable(btn) {
  const t = cardTableOf(btn); if (!t) return;
  const m = tableToMatrix(t); if (m.length < 2) { alert('Walang laman na i-e-export.'); return; }
  downloadCSVFile(m.map(r => r.map(csvCell).join(',')).join('\r\n'), cardTitleText(btn).replace(/\s+/g, '_') + '.csv');
}
function injectTableTools() {
  document.querySelectorAll('.card').forEach(card => {
    if (card.dataset.tools) return;
    const title = card.querySelector(':scope > .card-title');
    const table = card.querySelector('table');
    if (!title || !table || card.hasAttribute('data-notools') || table.closest('.modal-content')) return;
    card.dataset.tools = '1';
    if (title.querySelector('[onclick*="print"],[onclick*="Print"],[onclick*="export"],[onclick*="Export"]')) return; // may sarili na
    let bar = title.querySelector(':scope > div');
    if (!bar) { bar = document.createElement('div'); bar.style.cssText = 'display:flex;gap:0.5rem;flex-wrap:wrap;'; title.appendChild(bar); }
    bar.insertAdjacentHTML('beforeend', '<button type="button" class="btn btn-secondary btn-sm" onclick="printCardTable(this)">🖨️ Print</button><button type="button" class="btn btn-secondary btn-sm" onclick="exportCardTable(this)">⬇️ CSV</button>');
  });
}
function startTableTools() {
  injectTableTools();
  let t = null;
  new MutationObserver(() => { clearTimeout(t); t = setTimeout(injectTableTools, 500); }).observe(document.body, { childList: true, subtree: true });
}

// ========================================================
// 📄 BOM / RECIPE REPORT (lalabas pagka-save, may Print at CSV)
// ========================================================
let bomReportCtx = null;
function bomLineCost(i) {
  const p = (adminProductsList || []).find(x => x.id === i.itemCode);
  let price = p ? costOf(p, i.uom) : 0, fallback = false;
  if (!(price > 0)) { price = p ? (i.uom === 'Whole' ? p.wholePrice : p.loosePrice) : i.unitPrice; fallback = true; }
  return { unit: parseFloat(price || 0), uom: bomUomName(i), fallback };
}
function bomReportData(bom, mult) {
  const m = mult > 0 ? mult : 1;
  const lines = (bom.ingredients || []).map(i => { const c = bomLineCost(i); const qty = i.qty * m; return { name: i.itemName, code: i.itemCode, qty: qty, uom: c.uom, unit: c.unit, cost: qty * c.unit, fallback: c.fallback }; });
  const total = lines.reduce((s, l) => s + l.cost, 0);
  const out = (bom.yieldQty || 1) * m;
  const perUnit = out > 0 ? total / out : 0;
  return { lines, total, out, perUnit, m, noCost: lines.filter(l => l.fallback).length, minPrice: minPriceFor(perUnit), suggested: suggestedPriceFor(perUnit) };
}
function bomReportHtml(bom, mult) {
  const r = bomReportData(bom, mult);
  const fmt = n => '₱' + (n || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `<div class="pg">
    <h1>🍳 Recipe Card: ${srchEsc(bom.finishedGoodName)}</h1>
    <div class="meta">Code: ${srchEsc(bom.finishedGoodCode)} · Hub: ${srchEsc(bom.hub || 'Lahat ng Hub')} · Rev ${bom.revision || 1}${bom.lastEditedBy ? ' · ' + srchEsc(bom.lastEditedBy) : ''}<br>${printedByLine()}</div>
    <b>Batch: ×${r.m} &nbsp;|&nbsp; Output: ${r.out} units ng ${srchEsc(bom.finishedGoodName)}</b>
    <table><thead><tr><th>#</th><th>Sangkap</th><th>Code</th><th class="num">Dami</th><th>Unit</th><th class="num">Presyo/Unit</th><th class="num">Gastos</th></tr></thead><tbody>
    ${r.lines.map((l, i) => `<tr><td>${i + 1}</td><td>${srchEsc(l.name)}</td><td>${srchEsc(l.code)}</td><td class="num">${+l.qty.toFixed(4)}</td><td>${srchEsc(l.uom)}</td><td class="num">${fmt(l.unit)}</td><td class="num">${fmt(l.cost)}</td></tr>`).join('')}
    <tr class="total"><td colspan="6" class="num">Kabuuang gastos ng sangkap</td><td class="num">${fmt(r.total)}</td></tr>
    <tr class="total"><td colspan="6" class="num">Puhunan bawat unit (${r.out} units)</td><td class="num">${fmt(r.perUnit)}</td></tr>
    <tr class="total"><td colspan="6" class="num">Suggested presyong paninda bawat unit (overhead ${pricingRules.overheadPct}% + markup ${pricingRules.markupPct}%)</td><td class="num">${fmt(r.suggested)}</td></tr></tbody></table>
    ${r.noCost ? `<div class="meta">* ${r.noCost} sangkap ay walang nakatalang puhunan; ginamit ang presyong paninda nila.</div>` : ''}
    ${bom.notes ? `<h2>Paraan ng Paggawa / Notes</h2><div class="box">${srchEsc(bom.notes)}</div>` : ''}
    <div class="sign"><div>Inihanda ni</div><div>Sinuri ni</div></div></div>`;
}
function viewBomReport(bomId) {
  const bom = bomRecipes.find(b => b.id === bomId);
  if (!bom) { alert('Hindi nahanap ang recipe. I-refresh muna ang listahan.'); return; }
  bomReportCtx = { id: bomId, mult: 1 };
  loadProductCosts().then(() => { if (bomReportCtx && bomReportCtx.id === bomId) renderBomReport(); });
  let ov = document.getElementById('bom-report-modal');
  if (!ov) {
    ov = document.createElement('div'); ov.id = 'bom-report-modal'; ov.className = 'modal-overlay'; ov.style.display = 'none';
    ov.innerHTML = '<div class="modal-content" style="max-width:760px;"><div id="bom-report-body"></div></div>';
    document.body.appendChild(ov);
  }
  renderBomReport();
  ov.style.display = 'flex';
}
function renderBomReport() {
  const bom = bomRecipes.find(b => b.id === bomReportCtx.id); if (!bom) return;
  const r = bomReportData(bom, bomReportCtx.mult);
  const fmt = n => '₱' + (n || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  document.getElementById('bom-report-body').innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #e2e8f0;padding-bottom:0.5rem;margin-bottom:0.75rem;">
      <h3 style="margin:0;color:#0f172a;">📄 Recipe Report: ${srchEsc(bom.finishedGoodName)}</h3>
      <button type="button" class="btn btn-secondary btn-sm" onclick="closeBomReport()">✕</button>
    </div>
    <div style="font-size:0.85rem;color:#475569;margin-bottom:0.75rem;">Code: <b>${srchEsc(bom.finishedGoodCode)}</b> · Hub: <b>${srchEsc(bom.hub || 'Lahat')}</b> · Rev ${bom.revision || 1}${bom.lastEditedBy ? ' · ' + srchEsc(bom.lastEditedBy) : ''}</div>
    <div style="display:flex;gap:0.75rem;align-items:center;flex-wrap:wrap;margin-bottom:0.75rem;">
      <label style="margin:0;font-weight:600;">Ilang batch (×):</label>
      <input type="number" min="0.1" step="0.1" value="${r.m}" style="width:90px;" onchange="bomReportCtx.mult=parseFloat(this.value)||1;renderBomReport()">
      <b style="color:#059669;">Output: ${r.out} units</b>
    </div>
    <div class="table-responsive"><table>
      <thead><tr><th>Sangkap</th><th>Dami</th><th>Unit</th><th>Presyo</th><th>Gastos</th></tr></thead>
      <tbody>${r.lines.map(l => `<tr><td>${srchEsc(l.name)}<br><small style="color:#64748b;">${srchEsc(l.code)}</small></td><td><b>${+l.qty.toFixed(4)}</b></td><td>${srchEsc(l.uom)}</td><td>${fmt(l.unit)}</td><td>${fmt(l.cost)}</td></tr>`).join('')}
      <tr style="font-weight:800;background:#f1f5f9;"><td colspan="4" style="text-align:right;">Kabuuang gastos</td><td>${fmt(r.total)}</td></tr>
      <tr style="font-weight:800;background:#ecfdf5;"><td colspan="4" style="text-align:right;">Puhunan bawat unit</td><td>${fmt(r.perUnit)}</td></tr>
      <tr style="font-weight:800;background:#eff6ff;"><td colspan="4" style="text-align:right;">Suggested presyong paninda bawat unit<br><small style="font-weight:500;color:#64748b;">overhead ${pricingRules.overheadPct}% + markup ${pricingRules.markupPct}%</small></td><td>${fmt(r.suggested)}</td></tr></tbody>
    </table></div>
    ${r.noCost ? `<div style="color:#b45309;font-size:0.8rem;margin-top:0.5rem;">⚠️ ${r.noCost} sangkap ang walang puhunan; ginamit ang presyong paninda nila. Ilagay ang puhunan sa Product Master.</div>` : ''}
    ${bom.notes ? `<div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:0.6rem;margin-top:0.75rem;white-space:pre-wrap;font-size:0.85rem;"><b>Paraan ng Paggawa:</b>\n${srchEsc(bom.notes)}</div>` : ''}
    <div style="display:flex;gap:0.5rem;margin-top:1rem;flex-wrap:wrap;">
      <button class="btn btn-primary" onclick="printBomReport()">🖨️ Print</button>
      <button class="btn btn-secondary" onclick="exportBomReportCSV()">⬇️ CSV</button>
      <button class="btn btn-success" onclick="applyBomPricing('${srchEsc(bom.id)}')">💰 I-apply ang Presyo sa Produkto</button>
      <button class="btn btn-secondary" onclick="closeBomReport()">Isara</button>
    </div>`;
}
function closeBomReport() { const ov = document.getElementById('bom-report-modal'); if (ov) ov.style.display = 'none'; }
function printBomReport() {
  const bom = bomRecipes.find(b => b.id === bomReportCtx.id); if (!bom) return;
  printHtmlDoc('Recipe ' + bom.finishedGoodName, bomReportHtml(bom, bomReportCtx.mult));
}
function exportBomReportCSV() {
  const bom = bomRecipes.find(b => b.id === bomReportCtx.id); if (!bom) return;
  const r = bomReportData(bom, bomReportCtx.mult);
  const rows = [['Recipe', bom.finishedGoodName], ['Code', bom.finishedGoodCode], ['Hub', bom.hub || ''], ['Batch x', r.m], ['Output', r.out], [], ['Sangkap', 'Code', 'Dami', 'Unit', 'Presyo', 'Gastos']];
  r.lines.forEach(l => rows.push([l.name, l.code, +l.qty.toFixed(4), l.uom, l.unit, l.cost]));
  rows.push([], ['Kabuuang gastos', '', '', '', '', r.total], ['Gastos bawat unit', '', '', '', '', r.perUnit]);
  downloadCSVFile(rows.map(x => x.map(csvCell).join(',')).join('\r\n'), 'Recipe_' + bom.finishedGoodCode + '.csv');
}
function visibleBoms() { const h = activeHubFilter(); return bomRecipes.filter(b => bomVisibleToHub(b, h)); }
function printAllBOMs() {
  const list = visibleBoms(); if (!list.length) { alert('Walang recipe na ipi-print.'); return; }
  printHtmlDoc('Lahat ng Recipe', list.map(b => bomReportHtml(b, 1)).join(''));
}
function exportAllBOMsCSV() {
  const list = visibleBoms(); if (!list.length) { alert('Walang recipe.'); return; }
  const rows = [['FG_Code', 'FG_Name', 'Yield', 'Hub', 'RM_Code', 'RM_Name', 'Qty', 'UOM', 'Notes']];
  list.forEach(b => (b.ingredients || []).forEach(i => rows.push([b.finishedGoodCode, b.finishedGoodName, b.yieldQty, b.hub || '', i.itemCode, i.itemName, i.qty, i.uom, b.notes || ''])));
  downloadCSVFile(rows.map(r => r.map(csvCell).join(',')).join('\r\n'), 'BOM_Recipes.csv');
}
function downloadBOMTemplate() {
  downloadCSVFile('FG_Code,FG_Name,Yield,Hub,RM_Code,RM_Name,Qty,UOM,Notes\r\nFG-RAMEN,Ramen Noodles,50,Commissary Meat,SAP-001,Harina,2,Whole,I-mix ng 10 minuto\r\nFG-RAMEN,Ramen Noodles,50,Commissary Meat,SAP-002,Tubig,5,Loose,\r\n', 'BOM_Import_Template.csv');
}
async function importBOMsCSV() {
  const text = await pickCSVFile(); if (!text) return;
  const rows = csvToObjects(text); if (!rows.length) { alert('Walang laman o mali ang format ng CSV.'); return; }
  if (!adminProductsList.length) await loadAdminProducts();
  const byCode = {}; adminProductsList.forEach(p => { byCode[hubKey(p.itemCode || p.id)] = p; byCode[hubKey(p.sapCode)] = p; });
  const groups = {};
  const problems = [];
  rows.forEach((r, n) => {
    const fg = r.fg_code; if (!fg) { problems.push(`Row ${n + 2}: walang FG_Code`); return; }
    (groups[fg] = groups[fg] || { code: fg, name: r.fg_name || fg, yieldQty: parseFloat(r.yield) || 1, hub: r.hub || '', notes: r.notes || '', lines: [] });
    if (r.notes && !groups[fg].notes) groups[fg].notes = r.notes;
    const rm = byCode[hubKey(r.rm_code)];
    const qty = parseFloat(r.qty);
    if (!rm) { problems.push(`Row ${n + 2}: walang produktong "${r.rm_code}" sa Product Master`); return; }
    if (!(qty > 0)) { problems.push(`Row ${n + 2}: mali ang Qty`); return; }
    const isWhole = /^whole$/i.test(r.uom) || hubKey(r.uom) === hubKey(rm.wholeUOM);
    groups[fg].lines.push({ itemCode: rm.id, itemName: rm.itemName, qty: qty, uom: isWhole ? 'Whole' : 'Loose', uomName: isWhole ? (rm.wholeUOM || 'Whole') : (rm.looseUOM || 'Loose'), unitPrice: parseFloat(isWhole ? rm.wholePrice : rm.loosePrice) || 0 });
  });
  const list = Object.values(groups).filter(g => g.lines.length);
  if (!list.length) { alert('Walang valid na recipe sa file.\n\n' + problems.slice(0, 10).join('\n')); return; }
  if (!await uiConfirm(`I-import ang ${list.length} recipe? (Kapag may kaparehong FG_Code na, papalitan ang sangkap nito.)` + (problems.length ? `\n\n⚠️ ${problems.length} row ang lalaktawan:\n` + problems.slice(0, 8).join('\n') : ''))) return;
  try {
    const me = getCurrentUser() || {};
    for (const g of list) {
      const bomId = 'BOM-' + g.code;
      const ex = bomRecipes.find(b => b.id === bomId);
      const fgRef = db.collection('products').doc(g.code);
      if (!(await fgRef.get()).exists) {
        await fgRef.set({ itemCode: g.code, sapCode: g.code, itemName: g.name, commissarySource: g.hub || 'Commissary Hub', scope: g.hub ? 'private' : 'shared', storageStation: 'Finished Goods (Production)', wholeUOM: 'Batches', looseUOM: 'Pcs', wholePrice: 0, loosePrice: 0, stockWhole: 0, stockLoose: 0, bufferLimit: 5, conversionFactor: g.yieldQty, createdAt: firebase.firestore.FieldValue.serverTimestamp() });
      }
      await db.collection('bom_recipes').doc(bomId).set({ finishedGoodCode: g.code, finishedGoodName: g.name, yieldQty: g.yieldQty, hub: g.hub, scope: g.hub ? 'private' : 'shared', notes: g.notes, ingredients: g.lines, revision: ex ? (ex.revision || 1) + 1 : 1, lastEditedBy: me.name || me.email || 'import', updatedAt: firebase.firestore.FieldValue.serverTimestamp() });
    }
    await logSystemAction('BOM_IMPORTED', `Nag-import ng ${list.length} recipe mula sa CSV`);
    alert(`✅ Na-import ang ${list.length} recipe.`);
    loadAdminProducts(); loadManufacturing();
  } catch (e) { alert('Error sa import: ' + e.message); }
}

// ---- Bulk import para sa Vendors at Customers ----
const IMPORT_KINDS = {
  vendors: { col: 'vendors', label: 'Vendor', file: 'Vendors_Import_Template.csv',
    header: 'Vendor_Name,Contact_Person,Contact_Details,Address,Terms\r\nABC Meat Supply,Juan Dela Cruz,09171234567,Quezon City,30 days\r\n',
    map: r => ({ name: r.vendor_name || r.name, contactPerson: r.contact_person || '', contactDetails: r.contact_details || '', address: r.address || '', terms: r.terms || '' }),
    reload: () => typeof loadAdminVendors === 'function' && loadAdminVendors() },
  customers: { col: 'customers', label: 'Customer', file: 'Customers_Import_Template.csv',
    header: '#GABAY: Customer_Code = ID ng customer (iwanang blangko kung bago; awtomatikong bibigyan ng code). Customer_Name = pangalan ng customer (dito rin magtutugma ang AR). Customer_Type = Retail / Wholesale / Corporate / Branch. Burahin ang mga linyang nagsisimula sa #.\r\n#C-0001 ay halimbawa ng code.\r\nCustomer_Code,Customer_Name,Address,Contact,Bank_Details,Customer_Type\r\n,Juan Store,Manila,09181234567,BDO 1234,Retail\r\n',
    map: r => ({ code: (r.customer_code || r.customer_id || r.code || '').trim(), name: r.customer_name || r.name, address: r.address || '', contact: r.contact || '', bank: r.bank_details || r.bank || '', type: r.customer_type || r.type || 'Retail' }),
    reload: () => typeof loadAdminCustomers === 'function' && loadAdminCustomers() }
};
function nextCustomerCodes(list, n) {
  let max = 0; (list || []).forEach(c => { const m = /^C-(\d+)$/.exec((c && c.code) || ''); if (m) max = Math.max(max, +m[1]); });
  return Array.from({ length: n }, (_, i) => 'C-' + String(max + i + 1).padStart(4, '0'));
}
function downloadImportTemplate(kind) { const k = IMPORT_KINDS[kind]; if (k) downloadCSVFile(k.header, k.file); }
async function importCSVFor(kind) {
  const k = IMPORT_KINDS[kind]; if (!k) return;
  const text0 = await pickCSVFile(); if (!text0) return;
  const text = text0.split(/\r?\n/).filter(l => !/^\s*"?#/.test(l)).join('\n');
  const rows = csvToObjects(text).map(k.map).filter(x => x.name);
  if (!rows.length) { alert('Walang valid na row. Gamitin ang Template para sa tamang column.'); return; }
  if (!await uiConfirm(`I-import ang ${rows.length} ${k.label}? (Ia-update ang may kaparehong pangalan, dadagdagan ang bago.)`)) return;
  try {
    const snap = await db.collection(k.col).get();
    const existing = {}, byCode = {}, oldCust = []; snap.forEach(d => { const x = d.data(); existing[hubKey(x.name)] = d.id; if (x.code) { byCode[String(x.code).toLowerCase()] = d.id; } oldCust.push(x); });
    const newCodes = k.col === 'customers' ? nextCustomerCodes(oldCust, rows.length) : [];
    let batch = db.batch(), n = 0, added = 0, updated = 0, ci = 0;
    for (const r of rows) {
      const id = (r.code && byCode[String(r.code).toLowerCase()]) || existing[hubKey(r.name)];
      if (k.col === 'customers' && !r.code) { if (id) delete r.code; else r.code = newCodes[ci++]; }
      r.updatedAt = firebase.firestore.FieldValue.serverTimestamp();
      if (id) { batch.update(db.collection(k.col).doc(id), r); updated++; }
      else { r.createdAt = firebase.firestore.FieldValue.serverTimestamp(); batch.set(db.collection(k.col).doc(), r); added++; existing[hubKey(r.name)] = 'x'; }
      if (++n % 400 === 0) { await batch.commit(); batch = db.batch(); }
    }
    await batch.commit();
    await logSystemAction('BULK_IMPORT', `Nag-import ng ${k.label}: ${added} bago, ${updated} na-update`);
    alert(`✅ Tapos: ${added} bago, ${updated} na-update.`);
    k.reload();
  } catch (e) { alert('Error sa import: ' + e.message); }
}

// ========================================================
// 🧩 CUSTOM ROLES (hal. "HR Officer", "Warehouse Checker") — gawa ni Admin
// Ang custom role ay pinangalanang "template" ng permissions na naka-base sa Commissary o Branch.
// Pagka-assign sa user, kinokopya ang permissions sa user mismo, kaya nasusunod din ng Firestore Rules.
// ========================================================
let customRolesState = {};
let crEditingId = null;

async function loadCustomRoles() {
  try {
    const s = await db.collection('system_settings').doc('custom_roles').get();
    customRolesState = s.exists ? (s.data().roles || {}) : {};
  } catch (e) { customRolesState = {}; }
  return customRolesState;
}
async function renderAccessControlManager() {
  await renderAccessControlManagerBase();
  const root = document.getElementById('access-control-root');
  if (!root || !root.innerHTML) return;
  await loadCustomRoles();
  if (!document.getElementById('custom-roles-root')) root.insertAdjacentHTML('beforeend', '<div id="custom-roles-root"></div>');
  renderCustomRolesCard();
  await acRefreshUserCustomRole();
}
function renderCustomRolesCard() {
  const el = document.getElementById('custom-roles-root'); if (!el) return;
  const ids = Object.keys(customRolesState);
  const rows = ids.length ? ids.map(id => {
    const r = customRolesState[id];
    const mods = Object.values(r.perms || {}).filter(v => v === 'view' || v === 'edit').length;
    return `<tr><td><b>${srchEsc(r.name)}</b></td><td>${r.base === 'branch' ? '🏪 Branch' : '🏭 Commissary'}</td><td>${mods} module</td>
      <td style="white-space:nowrap;"><button class="btn btn-sm btn-primary" onclick="crEdit('${id}')">✏️ Edit</button> <button class="btn btn-sm btn-danger" onclick="crDelete('${id}')">🗑️</button></td></tr>`;
  }).join('') : '<tr><td colspan="4" style="text-align:center;color:#94a3b8;padding:1rem;">Wala pang custom role.</td></tr>';
  el.innerHTML = `<div class="card" data-notools="1">
    <div class="card-title"><span>🧩 Custom Roles (Special na Role)</span><button class="btn btn-success btn-sm" onclick="crNew()">➕ Bagong Custom Role</button></div>
    <p style="font-size:0.85rem;color:#64748b;margin-bottom:0.75rem;">Gumawa ng sariling role (hal. <b>HR Officer</b>, <b>Warehouse Checker</b>). Piliin kung Commissary o Branch ang base na page niya, at kung anong module at feature ang pinapayagan. I-assign ito sa user sa <b>Per-User Permissions</b> sa ibaba. Kapag in-edit mo ang role, awtomatikong maa-update ang lahat ng user na may ganitong role.</p>
    <div class="table-responsive"><table><thead><tr><th>Pangalan</th><th>Base Page</th><th>Access</th><th>Aksyon</th></tr></thead><tbody>${rows}</tbody></table></div>
    <div id="cr-editor"></div></div>`;
}
function crNew() { crEditingId = '__new__'; renderCustomRoleEditor({ name: '', base: 'commissary', perms: {} }); }
function crEdit(id) { crEditingId = id; renderCustomRoleEditor(customRolesState[id]); }
function crBaseChanged() { const cur = crCollect(); renderCustomRoleEditor(cur); }
function crCollect() {
  const name = (document.getElementById('cr-name') || {}).value || '';
  const base = (document.getElementById('cr-base') || {}).value || 'commissary';
  const perms = {};
  ACCESS_MODULES.filter(m => !m.adminOnly).forEach(m => { const el = document.getElementById('cr-m-' + m.key); if (el) perms[m.key] = el.value; });
  ACCESS_FEATURES.forEach(f => { const el = document.getElementById('cr-f-' + f.key); if (el) perms[f.key] = el.value; });
  return { name: name.trim(), base: base, perms: perms };
}
function renderCustomRoleEditor(r) {
  const el = document.getElementById('cr-editor'); if (!el) return;
  let mrows = '', lg = '';
  ACCESS_MODULES.filter(m => !m.adminOnly).forEach(m => {
    if (m.group !== lg) { mrows += `<tr><td colspan="2" style="background:#f1f5f9;font-weight:800;font-size:0.75rem;text-transform:uppercase;color:#64748b;">${m.group}</td></tr>`; lg = m.group; }
    mrows += `<tr><td><b>${m.label}</b></td><td>${acSelect('cr-m-' + m.key, (r.perms && r.perms[m.key]) || 'none', false)}</td></tr>`;
  });
  let frows = '', lf = '';
  ACCESS_FEATURES.filter(f => f.native === r.base).forEach(f => {
    if (f.group !== lf) { frows += `<tr><td colspan="2" style="background:#f1f5f9;font-weight:800;font-size:0.75rem;text-transform:uppercase;color:#64748b;">${f.group}</td></tr>`; lf = f.group; }
    frows += `<tr><td><b>${f.label}</b></td><td>${acSelectAllow('cr-f-' + f.key, (r.perms && r.perms[f.key]) === 'none' ? 'none' : 'edit', false)}</td></tr>`;
  });
  el.innerHTML = `<div style="border-top:2px solid #e2e8f0;margin-top:1rem;padding-top:1rem;">
    <h4 style="margin:0 0 0.5rem;">${crEditingId === '__new__' ? '➕ Bagong Custom Role' : '✏️ I-edit ang Custom Role'}</h4>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.75rem;">
      <div class="form-group"><label>Pangalan ng Role</label><input type="text" id="cr-name" value="${srchEsc(r.name)}" placeholder="Hal: HR Officer"></div>
      <div class="form-group"><label>Base Page (saan siya papasok)</label><select id="cr-base" data-nosearch="1" onchange="crBaseChanged()"><option value="commissary" ${r.base === 'commissary' ? 'selected' : ''}>🏭 Commissary Hub</option><option value="branch" ${r.base === 'branch' ? 'selected' : ''}>🏪 Branch Operations</option></select></div>
    </div>
    <div class="table-responsive"><table><thead><tr><th>Admin Module</th><th>Access</th></tr></thead><tbody>${mrows}</tbody></table></div>
    <h5 style="margin:1rem 0 0.25rem;">Mga Feature sa ${r.base === 'branch' ? 'Branch' : 'Commissary'} Page</h5>
    <div class="table-responsive"><table><thead><tr><th>Feature</th><th>Puwede?</th></tr></thead><tbody>${frows}</tbody></table></div>
    <div style="display:flex;gap:0.5rem;margin-top:1rem;"><button class="btn btn-success" onclick="crSave()">💾 I-save ang Role</button><button class="btn btn-secondary" onclick="document.getElementById('cr-editor').innerHTML='';crEditingId=null;">Kanselahin</button></div></div>`;
}
async function crSave() {
  const r = crCollect();
  if (!r.name) { alert('Ilagay ang pangalan ng role.'); return; }
  if (r.base !== 'commissary' && r.base !== 'branch') { alert('Commissary o Branch lang ang base.'); return; }
  const id = crEditingId && crEditingId !== '__new__' ? crEditingId : r.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || ('role-' + Date.now());
  customRolesState[id] = r;
  try {
    await db.collection('system_settings').doc('custom_roles').set({ roles: customRolesState, updatedAt: firebase.firestore.FieldValue.serverTimestamp() });
    // I-sync ang mga user na may ganitong role
    const us = await db.collection('users').where('customRole', '==', id).get();
    let n = 0, batch = db.batch();
    us.forEach(d => { batch.update(d.ref, { role: r.base, customRoleName: r.name, permissions: r.perms }); n++; });
    if (n) await batch.commit();
    await logSystemAction('CUSTOM_ROLE_SAVED', `Custom role "${r.name}" (${r.base}). Na-sync ang ${n} user.`);
    alert(`✅ Na-save ang role "${r.name}". ${n ? n + ' user ang na-update.' : ''}`);
    crEditingId = null; renderCustomRolesCard(); acRefreshUserCustomRole();
  } catch (e) { alert('Error: ' + e.message); }
}
async function crDelete(id) {
  const r = customRolesState[id]; if (!r || !await uiConfirm(`Burahin ang role "${r.name}"? Mananatili sa mga user ang kasalukuyang permissions nila pero wala na silang role label.`)) return;
  try {
    delete customRolesState[id];
    await db.collection('system_settings').doc('custom_roles').set({ roles: customRolesState, updatedAt: firebase.firestore.FieldValue.serverTimestamp() });
    const us = await db.collection('users').where('customRole', '==', id).get();
    const batch = db.batch(); us.forEach(d => batch.update(d.ref, { customRole: firebase.firestore.FieldValue.delete(), customRoleName: firebase.firestore.FieldValue.delete() }));
    await batch.commit();
    renderCustomRolesCard();
  } catch (e) { alert('Error: ' + e.message); }
}
// Pagpili ng custom role sa per-user editor
async function acRefreshUserCustomRole() {
  try {
    const snap = await db.collection('users').get();
    snap.forEach(d => { const u = acUsersList.find(x => x.email === d.id); if (u) { u.customRole = d.data().customRole || ''; } });
  } catch (e) {}
}
function acCustomRoleSelectHtml(u) {
  const ids = Object.keys(customRolesState);
  if (!ids.length) return '';
  const opts = '<option value="">— Walang custom role —</option>' + ids.map(id => `<option value="${id}" ${u.customRole === id ? 'selected' : ''}>🧩 ${srchEsc(customRolesState[id].name)} (${customRolesState[id].base})</option>`).join('');
  return `<div style="background:#faf5ff;border:1px solid #e9d5ff;border-radius:6px;padding:0.6rem;margin-bottom:0.75rem;">
    <label style="font-weight:700;margin-bottom:0.25rem;">🧩 Custom Role ng user</label>
    <div style="display:flex;gap:0.5rem;"><select id="ac-user-customrole" data-nosearch="1" style="flex:1;">${opts}</select><button class="btn btn-primary btn-sm" onclick="acApplyCustomRole()">I-apply</button></div>
    <small style="color:#64748b;">Ang pag-apply ay papalit sa lahat ng permission ng user ayon sa role. Puwede ka pa ring maglagay ng exception pagkatapos.</small></div>`;
}
async function acApplyCustomRole() {
  const u = acUsersList.find(x => x.email === acPickedEmail); if (!u) return;
  const id = document.getElementById('ac-user-customrole').value;
  try {
    if (!id) {
      await db.collection('users').doc(u.email).update({ customRole: firebase.firestore.FieldValue.delete(), customRoleName: firebase.firestore.FieldValue.delete() });
      u.customRole = '';
    } else {
      const r = customRolesState[id]; if (!r) return;
      await db.collection('users').doc(u.email).update({ role: r.base, customRole: id, customRoleName: r.name, permissions: r.perms });
      u.customRole = id; u.role = r.base; u.permissions = { ...r.perms };
    }
    await logSystemAction('CUSTOM_ROLE_ASSIGNED', `${u.email} → ${id ? customRolesState[id].name : 'walang custom role'}`);
    alert('✅ Na-apply. Tatalab sa susunod na load ng page ng user.');
    acPickUser(u);
  } catch (e) { alert('Error: ' + e.message); }
}


// ========================================================
// 📋 BRANCH INVENTORY (Kitchen at Wares) — bilang kada station, may scan, larawan, print, CSV, pirma at variance report
// ID ng bawat item = SAP/subcode ng product. Ang listahan ng items ay per COMPANY (hal. KNGK, Tanoshi).
// Collections: companies, branch_stations, inventory_branches, inventory_items, inventory_counts, inventory_item_requests, product_photos
// ========================================================
const INV_TYPES = { kitchen: '🍳 Kitchen', wares: '🥢 Wares' };
let invCompaniesList = [], invStationsList = [], invBranchMap = {};
const invPhotoCache = {};
const invCountsCache = {};
function invSlug(s) { return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); }
function invToday() { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 10); }
// Fixed ang petsa ng inventory: tuwing Linggo (weekly) at huling araw ng buwan (month-end). Isa lang kapag Linggo ang month-end.
function invCountDates(extra) {
  const out = [], t0 = new Date(invToday() + 'T00:00:00'), pad = n => String(n).padStart(2, '0');
  for (let i = 0; i < 120; i++) { const d = new Date(t0); d.setDate(d.getDate() - i); const ds = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; if (d.getDay() === 0 || new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate() === d.getDate()) out.push(ds); }
  if (extra && !out.includes(extra)) { out.push(extra); out.sort().reverse(); } return out;
}
function invDateOptions() { const sel = invState.date; return invCountDates(sel).map(d => { const k = invKind(d); return `<option value="${d}" ${d === sel ? 'selected' : ''}>${d} — ${k ? k.replace(/ \(.*\)/, '') : 'iba pang petsa'}</option>`; }).join(''); }
function invWho() { const u = getCurrentUser() || {}; return u.name || u.email || ''; }
function invNum(v) { const n = parseFloat(v); return isNaN(n) ? null : n; }

// ---- Larawan ng item (naka-compress, hiwalay na collection para hindi bumigat ang product list) ----
function compressImageFile(file, maxDim, quality) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = e => {
      const img = new Image();
      img.onload = () => {
        const k = Math.min(1, maxDim / Math.max(img.width, img.height));
        const c = document.createElement('canvas');
        c.width = Math.max(1, Math.round(img.width * k)); c.height = Math.max(1, Math.round(img.height * k));
        const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(img, 0, 0, c.width, c.height);
        resolve(c.toDataURL('image/jpeg', quality));
      };
      img.onerror = () => reject(new Error('Hindi mabasa ang larawan.'));
      img.src = e.target.result;
    };
    r.onerror = () => reject(new Error('Hindi mabasa ang file.'));
    r.readAsDataURL(file);
  });
}
async function invGetPhoto(code) {
  if (!code) return '';
  if (code in invPhotoCache) return invPhotoCache[code];
  try { const d = await db.collection('product_photos').doc(code).get(); const x = d.exists ? d.data() : {}; invPhotoCache[code] = x.dataUrl || invDriveThumb(x.link) || ''; } catch (e) { invPhotoCache[code] = ''; }
  return invPhotoCache[code];
}
async function invSaveFormPhoto(code, inputId) {
  const f = document.getElementById(inputId);
  if (!f || !f.files || !f.files[0] || !code) return;
  try {
    const url = await compressImageFile(f.files[0], 360, 0.72);
    const u = getCurrentUser() || {};
    await db.collection('product_photos').doc(code).set({ dataUrl: url, updatedBy: u.email || '', updatedAt: firebase.firestore.FieldValue.serverTimestamp() });
    await db.collection('products').doc(code).set({ hasPhoto: true }, { merge: true });
    invPhotoCache[code] = url; f.value = '';
  } catch (e) { alert('⚠️ Na-save ang produkto pero hindi ang larawan: ' + e.message); }
}
function invPhotoChosen(input, previewId) {
  const pv = document.getElementById(previewId);
  if (!pv || !input.files || !input.files[0]) return;
  compressImageFile(input.files[0], 360, 0.72).then(u => { pv.src = u; pv.style.display = 'inline-block'; }).catch(e => alert(e.message));
}
async function invLoadPhotoPreview(code, previewId) {
  const pv = document.getElementById(previewId); if (!pv) return;
  pv.style.display = 'none'; pv.removeAttribute('src');
  const u = await invGetPhoto(code);
  if (u) { pv.src = u; pv.style.display = 'inline-block'; }
}
async function invHydratePhotos(root) {
  const imgs = [...root.querySelectorAll('img[data-photo]')];
  for (let i = 0; i < imgs.length; i += 6) {
    await Promise.all(imgs.slice(i, i + 6).map(async im => { const u = await invGetPhoto(im.dataset.photo); if (u) { im.src = u; im.style.visibility = 'visible'; } }));
  }
}

// ---- Master data ----
async function invLoadMasters() {
  invCompaniesList = []; invStationsList = []; invBranchMap = {};
  try { (await db.collection('companies').get()).forEach(d => invCompaniesList.push(d.data().name || d.id)); } catch (e) {}
  try { (await db.collection('branch_stations').get()).forEach(d => invStationsList.push(d.data().name || d.id)); } catch (e) {}
  try { (await db.collection('inventory_branches').get()).forEach(d => { invBranchMap[d.id] = d.data(); }); } catch (e) {}
  invCompaniesList.sort((a, b) => a.localeCompare(b)); invStationsList.sort((a, b) => a.localeCompare(b));
}
function invFill(id, list, first, icon) {
  const el = document.getElementById(id); if (!el) return;
  const cur = el.value;
  el.innerHTML = `<option value="">${first}</option>` + list.map(n => `<option value="${srchEsc(n)}">${icon} ${srchEsc(n)}</option>`).join('');
  setSelValue(el, cur);
}

// ---- Pangkalahatang sheet HTML (print) ----
function invSheetHtml(o) {
  const rows = o.rows.map((r, i) => `<tr><td>${i + 1}</td>${o.photos ? `<td style="width:62px;">${r.photo ? `<img src="${r.photo}" style="width:56px;height:56px;object-fit:cover;border:1px solid #cbd5e1;">` : ''}</td>` : ''}<td>${srchEsc(r.code)}</td><td>${srchEsc(r.name)}</td><td>${srchEsc(r.conv > 1 ? (r.wuom || 'Whole') + ' / ' + r.uom : r.uom)}</td>${o.split ? (r.conv > 1 ? `<td class="num" style="min-width:60px;height:${o.photos ? 44 : 26}px;">${r.w == null || r.w === '' ? '' : srchEsc(r.w)}</td><td class="num" style="min-width:60px;">${r.l == null || r.l === '' ? '' : srchEsc(r.l)}</td>` : `<td class="num" style="background:#e5e7eb;"></td><td class="num" style="min-width:60px;height:${o.photos ? 44 : 26}px;">${r.qty == null || r.qty === '' ? '' : srchEsc(r.qty)}</td>`) : `<td class="num" style="min-width:90px;height:${o.photos ? 44 : 26}px;">${r.qty == null || r.qty === '' ? '' : srchEsc(r.qty)}</td>`}</tr>`).join('');
  return `<div class="pg"><h1>📋 Inventory Count Sheet — ${srchEsc(o.station)}</h1>
    <div class="meta">Branch: <b>${srchEsc(o.branch)}</b> (${srchEsc(o.branchCode)}) · Company: <b>${srchEsc(o.company)}</b> · Petsa: <b>${srchEsc(o.date)}</b>${o.type ? ' · ' + srchEsc(o.type) : ''}<br>${printedByLine()}</div>
    <table><thead><tr><th>#</th>${o.photos ? '<th>Larawan</th>' : ''}<th>Inventory ID</th><th>Item Description</th><th>UOM</th>${o.split ? '<th class="num">Whole</th><th class="num">Loose</th>' : '<th class="num">Bilang</th>'}</tr></thead><tbody>${rows}</tbody></table>
    <div class="sign"><div>Binilang ni (Checked by)<br><b>${srchEsc(o.checkedBy || '')}</b></div><div>Tinanggap / Inaprubahan ni (Received / Approved by)<br><b>${srchEsc(o.receivedBy || '')}</b></div></div>
    ${o.remarks ? `<div class="box">Remarks: ${srchEsc(o.remarks)}</div>` : ''}</div>`;
}

// ========================================================
// 🏪 BRANCH PAGE: Inventory Count
// ========================================================
let invState = { branch: '', branchCode: '', company: '', station: '', type: '', date: '', items: [], products: {}, entries: {}, temps: [], ready: false, error: '' };
let invHistory = [];

async function loadBranchInventory() {
  const root = document.getElementById('branch-inventory-root'); if (!root || !db) return;
  const u = getCurrentUser() || {};
  root.innerHTML = '<div class="card">Kinukuha ang inventory list ng branch...</div>';
  try {
    await invLoadMasters();
    const key = invSlug(u.branch);
    const br = invBranchMap[key];
    if (!u.branch || !br || !br.company) {
      invState.ready = false;
      root.innerHTML = `<div class="card"><div class="card-title">📋 Inventory Count</div><p style="color:#b45309;">⚠️ Hindi pa naka-setup ang branch mo (${srchEsc(u.branch || 'walang branch')}). Hilingin kay Admin na lagyan ng <b>Branch Code</b> at <b>Company</b> sa Admin → Branch Inventory → Setup.</p></div>`;
      return;
    }
    invState.branch = u.branch; invState.branchCode = br.code || key.toUpperCase(); invState.company = br.company;
    const [iSnap, pSnap] = await Promise.all([db.collection('inventory_items').where('company', '==', br.company).get(), db.collection('products').get()]);
    invState.items = []; iSnap.forEach(d => invState.items.push({ id: d.id, ...d.data() }));
    invState.products = {}; pSnap.forEach(d => { invState.products[d.id] = { id: d.id, ...d.data() }; });
    invState.items.sort((a, b) => String(a.itemName).localeCompare(String(b.itemName)));
    // Kada branch ay may sariling station setup (malaya silang maglipat ng item sa ibang station)
    let smDoc = null; try { const sm = await db.collection('inventory_station_map').doc(invSlug(invState.branchCode)).get(); if (sm.exists) smDoc = sm.data(); } catch (e) {}
    invState.stationItems = invBuildStationItems(smDoc);
    invState.bom = await invLoadBom(br.company, invState.branchCode);
    if (!invState.date) invState.date = invCountDates()[0];
    const stations = invStationNames();
    if (!invState.station || !stations.includes(invState.station)) invState.station = stations[0] || '';
    invState.ready = true;
    invLoadDraft();
    invRenderMain();
    invLoadHistory();
  } catch (e) { root.innerHTML = `<div class="card">Error: ${srchEsc(e.message)}</div>`; }
}

// ---- Station setup ng branch: bawat branch ang nagtatakda kung saang station nakalagay ang item
let invStnDraft = null, invStnSel = '';
function invStationMapOpen() { invStnDraft = JSON.parse(JSON.stringify(invState.stationItems || {})); invStnSel = invState.station || invStationNames()[0] || ''; invStnRender(); }
function invStnRender() {
  const D = invStnDraft, names = Object.keys(D).sort(invNatSort); const by = {}; invState.items.forEach(i => by[i.itemCode] = i);
  if (!D[invStnSel]) invStnSel = names[0] || '';
  const list = (D[invStnSel] || []).map(c => by[c]).filter(Boolean).sort((a, b) => String(invItemName(a)).localeCompare(String(invItemName(b))));
  const also = i => Object.keys(D).filter(k => k !== invStnSel && D[k].includes(i.itemCode));
  arModal(`<h3>📍 Station Setup — ${srchEsc(invState.branch)}</h3><p style="font-size:.85rem;color:#64748b;">Ikaw ang bahala sa mga station ng branch mo: magdagdag, palitan ang pangalan, at maglagay ng produkto. Puwedeng nasa higit sa isang station ang parehong item (pagsasamahin sa Count Result).</p>
    <div style="display:flex;gap:.4rem;flex-wrap:wrap;align-items:center;margin-bottom:.5rem;"><select id="stn-pick" onchange="invStnSel=this.value;invStnRender()">${names.map(n => `<option ${n === invStnSel ? 'selected' : ''}>${srchEsc(n)}</option>`).join('') || '<option value="">(walang station)</option>'}</select>
      <button class="btn btn-secondary btn-sm" onclick="invStnNew()">➕ Bagong station</button><button class="btn btn-secondary btn-sm" onclick="invStnRename()">✏️ Pangalan</button><button class="btn btn-secondary btn-sm" onclick="invStnDelete()">🗑️ Burahin</button></div>
    <div style="position:relative;margin-bottom:.5rem;"><input type="search" id="stn-add-q" placeholder="🔎 Mag-add ng produkto sa ${srchEsc(invStnSel || 'station')} (code / pangalan)" oninput="invStnSearch()" style="width:100%;"><div id="stn-add-res" style="position:absolute;z-index:5;left:0;right:0;background:#fff;border:1px solid #e2e8f0;border-radius:.4rem;max-height:200px;overflow:auto;display:none;"></div></div>
    <div style="max-height:45vh;overflow:auto;"><table data-notools="1"><thead><tr><th>Code</th><th>Item (${list.length})</th><th>Uri</th><th></th></tr></thead><tbody>${list.map(i => `<tr><td style="font-size:.75rem;color:#64748b;"><img data-photo="${srchEsc(i.itemCode)}" style="width:42px;height:42px;object-fit:cover;border-radius:6px;visibility:hidden;display:block;margin-bottom:2px;">${srchEsc(i.itemCode)}</td><td>${srchEsc(invItemName(i))}${also(i).length ? `<br><small style="color:#7c3aed;">din sa: ${srchEsc(also(i).join(', '))}</small>` : ''}</td><td>${srchEsc(INV_TYPES[i.type] || '')}</td><td style="white-space:nowrap;"><button class="btn btn-sm btn-secondary" title="Mag-upload / palitan ang larawan" onclick="invStnPhoto('${srchEsc(i.itemCode)}')">📷</button> <button class="btn btn-sm btn-secondary" onclick="invStnRemove('${srchEsc(i.itemCode)}')">✖</button></td></tr>`).join('') || '<tr><td colspan="4" style="color:#94a3b8;text-align:center;">Walang laman ang station. Mag-search sa itaas para magdagdag.</td></tr>'}</tbody></table></div>
    <div style="margin-top:.6rem;display:flex;gap:.4rem;"><button class="btn btn-success" onclick="invStationMapSave()">💾 I-save</button><button class="btn btn-secondary" onclick="invStationMapReset()">↺ Ibalik sa default ng company</button></div>`);
  const _m = document.getElementById('ar-modal') || document.body; invHydratePhotos(_m);
}
async function invStnNew() { const n = (await uiPrompt('Pangalan ng bagong station (hal. Station 9, Walk-in Chiller):') || '').trim(); if (!n) return; if (invStnDraft[n]) { alert('Mayroon nang station na ganyan.'); return; } invStnDraft[n] = []; invStnSel = n; invStnRender(); }
async function invStnRename() { if (!invStnSel) return; const n = (await uiPrompt('Bagong pangalan:', invStnSel) || '').trim(); if (!n || n === invStnSel) return; if (invStnDraft[n]) { alert('Mayroon nang station na ganyan.'); return; } invStnDraft[n] = invStnDraft[invStnSel]; delete invStnDraft[invStnSel]; invStnSel = n; invStnRender(); }
async function invStnDelete() { if (!invStnSel) return; if (!await uiConfirm(`Burahin ang "${invStnSel}"? (Hindi buburahin ang mga produkto, matatanggal lang sa station.)`)) return; delete invStnDraft[invStnSel]; invStnSel = ''; invStnRender(); }
function invStnRemove(code) { invStnDraft[invStnSel] = (invStnDraft[invStnSel] || []).filter(c => c !== code); invStnRender(); }
function invStnSearch() {
  const q = (document.getElementById('stn-add-q').value || '').trim(), box = document.getElementById('stn-add-res'); if (!q || !invStnSel) { box.style.display = 'none'; return; }
  const have = new Set(invStnDraft[invStnSel] || []); const res = invState.items.filter(i => !have.has(i.itemCode) && smartMatch(q, invItemName(i), i.itemCode)).slice(0, 12);
  const inItems = new Set(invState.items.map(i => i.itemCode)); const np = Object.keys(invState.products).filter(c => !inItems.has(c) && smartMatch(q, invState.products[c].itemName || c, c)).slice(0, 8);
  box.innerHTML = res.map(i => `<div style="padding:.4rem .6rem;border-bottom:1px solid #f1f5f9;cursor:pointer;" onclick="invStnAdd('${srchEsc(i.itemCode)}')">➕ <b>${srchEsc(invItemName(i))}</b> <small style="color:#64748b;">${srchEsc(i.itemCode)} · ${srchEsc(INV_TYPES[i.type] || '')}</small></div>`).join('') + np.map(c => `<div style="padding:.4rem .6rem;border-bottom:1px solid #f1f5f9;cursor:pointer;background:#fffbeb;" onclick="invStnAddNew('${srchEsc(c)}')">🆕 <b>${srchEsc(invState.products[c].itemName || c)}</b> <small style="color:#64748b;">${srchEsc(c)} · idagdag sa inventory ng company</small></div>`).join('') || (res.length ? '' : '<div style="padding:.5rem;color:#94a3b8;">Walang nahanap sa produkto.</div>'); box.style.display = 'block';
}
async function invStnAddNew(code) {
  const p = invState.products[code]; if (!p || !invStnSel) { alert('Gumawa muna ng station.'); return; }
  const t = (await uiPrompt(`Uri ng "${p.itemName || code}": 1 = Kitchen, 2 = Wares`, /ware/i.test(p.itemGroup || p.category || '') ? '2' : '1') || '').trim(); if (!t) return;
  const type = t === '2' ? 'wares' : 'kitchen', rec = { company: invState.company, itemCode: code, itemName: p.itemName || code, type, station: invStnSel, countUOM: p.looseUOM || p.wholeUOM || 'Pcs', addedBy: invWho(), updatedAt: new Date().toISOString() };
  try { await db.collection('inventory_items').doc(`${invState.company}__${code}`).set(rec, { merge: true }); invState.items.push({ id: `${invState.company}__${code}`, ...rec }); invStnAdd(code); } catch (e) { alert('Error: ' + e.message); }
}
function invStnPhoto(code) {
  const f = document.createElement('input'); f.type = 'file'; f.accept = 'image/*'; f.setAttribute('capture', 'environment');
  f.onchange = async () => { if (!f.files || !f.files[0]) return; try { const url = await compressImageFile(f.files[0], 360, 0.72); await db.collection('product_photos').doc(code).set({ dataUrl: url, updatedBy: invWho(), updatedAt: new Date().toISOString() }); invPhotoCache[code] = url; invStnRender(); } catch (e) { alert('⚠️ Hindi na-save ang larawan: ' + e.message); } };
  f.click();
}
function invStnAdd(code) { if (!invStnSel) { alert('Gumawa muna ng station.'); return; } if (!invStnDraft[invStnSel].includes(code)) invStnDraft[invStnSel].push(code); invStnRender(); setTimeout(() => { const q = document.getElementById('stn-add-q'); if (q) q.focus(); }, 50); }
async function invStationMapSave() {
  try { await db.collection('inventory_station_map').doc(invSlug(invState.branchCode)).set({ branchCode: invState.branchCode, branch: invState.branch, stations: invStnDraft, updatedBy: invWho(), updatedAt: new Date().toISOString() }); arCloseModal(); alert(`✅ Na-save ang ${Object.keys(invStnDraft).length} station.`); loadBranchInventory(); } catch (e) { alert('Error: ' + e.message); }
}
async function invStationMapReset() { if (!await uiConfirm('Ibalik ang mga station sa default ng company? Mawawala ang mga station na ginawa mo.')) return; try { await db.collection('inventory_station_map').doc(invSlug(invState.branchCode)).delete(); arCloseModal(); loadBranchInventory(); } catch (e) { alert('Error: ' + e.message); } }
// ---- Prepared items / BOM: ang prepared item (hal. TOMATO SLICE) ay naka-link sa raw item (TOMATO kg). Admin = default ng company, Branch = sariling override.
function invBomComps(b) { return !b ? [] : (b.components && b.components.length ? b.components : (b.raw ? [{ raw: b.raw, factor: b.factor, yield: b.yield }] : [])); }
async function invLoadBom(company, branchCode) {
  const m = {}; const rd = async id => { try { const d = await db.collection('inventory_bom').doc(id).get(); return d.exists ? (d.data().boms || {}) : {}; } catch (e) { return {}; } };
  const c = await rd('company_' + invSlug(company)), b = await rd('branch_' + invSlug(branchCode));
  Object.keys(c).forEach(k => m[k] = { ...c[k], src: 'company' }); Object.keys(b).forEach(k => m[k] = { ...b[k], src: 'branch' }); return m;
}
let invBomD = null;
async function invBomOpen(scope, ov) {
  let company, bc, bname, items = [], prods = {};
  if (scope === 'branch' && ov) { company = ov.company; bc = ov.bc; bname = ov.bname; const [iS, pS] = await Promise.all([db.collection('inventory_items').where('company', '==', company).get(), db.collection('products').get()]); iS.forEach(d => items.push(d.data())); pS.forEach(d => prods[d.id] = d.data()); }
  else if (scope === 'branch') { company = invState.company; bc = invState.branchCode; bname = invState.branch; items = invState.items; prods = invState.products; }
  else { const sel = document.getElementById('inv-company-sel'); company = sel && sel.value; if (!company) { alert('Pumili muna ng Company sa dropdown.'); return; }
    const [iS, pS] = await Promise.all([db.collection('inventory_items').where('company', '==', company).get(), db.collection('products').get()]); iS.forEach(d => items.push(d.data())); pS.forEach(d => prods[d.id] = d.data()); }
  const id = scope === 'branch' ? 'branch_' + invSlug(bc) : 'company_' + invSlug(company); let own = {}, inh = {};
  try { const d = await db.collection('inventory_bom').doc(id).get(); if (d.exists) own = d.data().boms || {}; if (scope === 'branch') inh = await (async () => { try { const c = await db.collection('inventory_bom').doc('company_' + invSlug(company)).get(); return c.exists ? (c.data().boms || {}) : {}; } catch (e) { return {}; } })(); } catch (e) {}
  const nm = {}, um = {}; Object.keys(prods).forEach(k => { nm[k] = prods[k].itemName || k; um[k] = prods[k].looseUOM || prods[k].wholeUOM || ''; }); items.forEach(i => { nm[i.itemCode] = nm[i.itemCode] || i.itemName || i.itemCode; if (i.countUOM) um[i.itemCode] = i.countUOM; });
  if (scope !== 'branch') { try { const ss = await db.collection('sap_items').where('company', '==', company).get(); ss.forEach(d => { const x = d.data(); if (x.itemCode && !nm[x.itemCode]) { nm[x.itemCode] = x.itemName || x.itemCode; um[x.itemCode] = x.invUom || x.purchUom || ''; } }); } catch (e) {} }
  invBomD = { scope, id, company, bc, bname, um, own: JSON.parse(JSON.stringify(own)), inh, nm, itemCodes: [...new Set(items.map(i => i.itemCode))], allCodes: Object.keys(nm), pick: { prep: '', raw: '' } }; invBomRender();
}
async function invBomBranchPick() {
  const sel = document.getElementById('inv-company-sel'), company = sel && sel.value; if (!company) { alert('Pumili muna ng Company sa dropdown.'); return; }
  let brs = [], have = new Set(); try { const [b, m] = await Promise.all([db.collection('inventory_branches').where('company', '==', company).get(), db.collection('inventory_bom').get()]); b.forEach(d => brs.push(d.data())); m.forEach(d => { if (/^branch_/.test(d.id)) have.add(d.id); }); } catch (e) { alert('Error: ' + e.message); return; }
  brs.sort((a, b) => String(a.branch).localeCompare(String(b.branch)));
  window._bomBrs = brs; arModal(`<h3>🏪 BOM ng Branch — ${srchEsc(company)}</h3><p style="font-size:.85rem;color:#64748b;">Pumili ng branch na ie-edit ang BOM. Ang branch BOM ay mas mananaig sa default ng company.</p>${brs.map((b, i) => `<button class="btn btn-secondary" style="display:block;width:100%;text-align:left;margin:.25rem 0;" onclick="invBomOpen('branch', { company: ${JSON.stringify(company).replace(/"/g, '&quot;')}, bc: window._bomBrs[${i}].code, bname: window._bomBrs[${i}].branch })">🏪 ${srchEsc(b.branch)} <small style="color:#64748b;">${srchEsc(b.code || '')}${have.has('branch_' + invSlug(b.code)) ? ' · ✅ may sariling BOM' : ''}</small></button>`).join('') || '<small style="color:#94a3b8;">Walang branch sa company na ito.</small>'}`);
}
const BOM_UNITS = { g: ['w', 1], kg: ['w', 1000], mg: ['w', 0.001], ml: ['v', 1], l: ['v', 1000] };
function invBomFactor(q, unit, rawUom) { const u = BOM_UNITS[String(unit || '').toLowerCase()], r = BOM_UNITS[String(rawUom || '').toLowerCase()]; return u && r && u[0] === r[0] ? q * u[1] / r[1] : q; }
function invBomTotals(e) {
  let w = 0, v = 0, other = 0; invBomComps(e).forEach(b => { const u = BOM_UNITS[String(b.unit || '').toLowerCase()], q = +b.qty; if (!q) return; if (!u) { other++; return; } const base = q * u[1]; if (u[0] === 'w') w += base; else if (b.free && /tubig|water|yelo|ice/i.test(b.name || '')) w += base; else v += base; });
  const o = e && e.out && +e.out.qty > 0 ? e.out : null, ou = o ? BOM_UNITS[String(o.unit || '').toLowerCase()] : null;
  return { w, v, other, out: o && ou ? { base: +o.qty * ou[1], kind: ou[0] } : null };
}
function invBomFmt(g, kind) { g = Math.round(g * 100) / 100; if (kind === 'v') return g >= 1000 ? (Math.round(g) / 1000) + ' L' : g + ' ml'; return g >= 1000 ? (Math.round(g) / 1000) + ' kg' : g + ' g'; }
function invBomSummary(e, comps) {
  const T = invBomTotals(e), parts = []; if (T.w) parts.push('Timbang: <b>' + invBomFmt(T.w, 'w') + '</b>'); if (T.v) parts.push('Volume: <b>' + invBomFmt(T.v, 'v') + '</b>'); if (T.other) parts.push(T.other + ' sangkap ay hindi g/ml');
  let h = parts.join(' · '); if (T.out) h += (h ? ' · ' : '') + 'Nagagawa (actual): <b>' + invBomFmt(T.out.base, T.out.kind) + '</b>'; else if (T.w || T.v) h += ' <small>(= kabuuang nagagawa ng 1 prep item)</small>'; return h;
}
function invBomMode(b) { return b && b.mode === 'add' ? 'add' : 'deduct'; }
function invBomRender() {
  const D = invBomD, n = c => srchEsc((D.nm[c] || c));
  const grp = (p, e, ro) => { const cs = invBomComps(e), md = invBomMode(e); return `<tr style="background:#f8fafc;"><td colspan="3"><b>🧪 ${n(p)}</b> <small style="color:#64748b;">${srchEsc(p)}</small></td><td style="text-align:right;white-space:nowrap;">${ro ? '<small style="color:#7c3aed;">company</small>' : `<button class="btn btn-sm btn-secondary" onclick="invBomToggle('${srchEsc(p)}')">${md === 'add' ? '➕ Idagdag sa raw' : '➖ Ibawas sa raw'}</button>`}</td></tr><tr><td colspan="4" style="font-size:.8rem;background:#f0f9ff;padding:.3rem .6rem;">📏 ${invBomSummary(e, cs) || '<small>Maglagay ng dami para makita ang kabuuan.</small>'}${ro ? '' : ` <button class="btn btn-sm btn-secondary" onclick="invBomOut('${srchEsc(p)}')">✏️ Actual na nagagawa</button>`}</td></tr>` + cs.map((b, i) => `<tr><td style="padding-left:1.2rem;">${b.free ? '💧 ' + srchEsc(b.name || 'Iba pa') + '<br><small style="color:#64748b;">hindi ibinabawas sa inventory</small>' : n(b.raw) + '<br><small style="color:#64748b;">' + srchEsc(b.raw) + '</small>'}</td><td style="text-align:right;">${b.qty ? srchEsc(b.qty + ' ' + (b.unit || '')) : '× ' + +b.factor}</td><td style="text-align:right;"><small>${b.free ? '—' : '= ' + Math.round(b.factor * 10000) / 10000 + ' ' + srchEsc(D.um[b.raw] || '')}${+b.yield > 0 && +b.yield < 100 ? '<br>yield ' + +b.yield + '%' : ''}</small></td><td>${ro ? '' : `<button class="btn btn-sm btn-secondary" onclick="invBomDel('${srchEsc(p)}',${i})">✖</button>`}</td></tr>`).join(''); };
  const mine = Object.keys(D.own).map(p => grp(p, D.own[p], false)).join(''), inh = Object.keys(D.inh).filter(p => !D.own[p]).map(p => grp(p, D.inh[p], true)).join('');
  arModal(`<h3>🧪 Prepared Items / BOM — ${srchEsc(D.scope === 'branch' ? D.bname : D.company + ' (default ng lahat ng branch)')}</h3>
  <p style="font-size:.84rem;color:#64748b;">Hakbang: <b>1)</b> Piliin ang prep item. <b>2)</b> Piliin ang sangkap (master product${D.scope === 'branch' ? '' : ' o galing SAP'}), ilagay ang dami at unit na ginagamit sa <b>1</b> prep item (hal. Pork Belly 200 g). Sa Count Result, kapag nabilang ang prep item, ang <b>sangkap na iyon ay ibabawas</b> sa main item niya (kg) — o idadagdag kung pipiliin mo (button sa tabi ng prep).${D.scope === 'branch' ? ' Para sa branch mo lang ito at mas mananaig sa default ng company.' : ''}</p>
  <div style="display:grid;gap:.4rem;margin-bottom:.6rem;">
    <div style="position:relative;"><input type="search" id="bom-q-prep" placeholder="1) Prep item (hal. GYOZA - PREPARED)" oninput="invBomSearch('prep')" style="width:100%;"><div id="bom-r-prep" style="position:absolute;z-index:6;left:0;right:0;background:#fff;border:1px solid #e2e8f0;max-height:180px;overflow:auto;display:none;"></div></div>
    <div style="position:relative;"><input type="search" id="bom-q-raw" placeholder="2) Sangkap / main item (hal. PORK BELLY kg)" oninput="invBomSearch('raw')" style="width:100%;"><div id="bom-r-raw" style="position:absolute;z-index:5;left:0;right:0;background:#fff;border:1px solid #e2e8f0;max-height:180px;overflow:auto;display:none;"></div></div>
    <div style="display:flex;gap:.4rem;flex-wrap:wrap;align-items:center;"><input type="number" id="bom-f" value="" placeholder="Dami" step="any" min="0" style="width:90px;"><select id="bom-u" data-nosearch="1" style="width:80px;"><option>g</option><option>kg</option><option>ml</option><option>L</option><option value="">pcs/iba</option></select><input type="number" id="bom-y" value="100" step="any" min="1" max="100" style="width:80px;" title="Yield %"><small style="color:#64748b;">Yield % (karaniwang 100)</small><button class="btn btn-success" onclick="invBomAdd()">➕ Idagdag</button><button class="btn btn-secondary" onclick="invBomAddFree()" title="Tubig o sangkap na wala sa inventory">💧 Tubig / iba pa</button></div></div>
  <div style="max-height:40vh;overflow:auto;"><table data-notools="1"><thead><tr><th>Sangkap</th><th style="text-align:right;">Dami</th><th style="text-align:right;">Sa UOM ng raw</th><th></th></tr></thead><tbody>${mine}${inh || ''}${!mine && !inh ? '<tr><td colspan="4" style="color:#94a3b8;text-align:center;">Wala pang recipe.</td></tr>' : ''}</tbody></table></div>
  <div style="margin-top:.6rem;"><button class="btn btn-success" onclick="invBomSave()">💾 I-save</button></div>`);
  ['prep', 'raw'].forEach(w => { const el = document.getElementById('bom-q-' + w); if (el && D.pick[w]) el.value = (D.nm[D.pick[w]] || D.pick[w]); });
}
function invBomToggle(p) { const e = invBomD.own[p]; if (!e) return; e.mode = invBomMode(e) === 'add' ? 'deduct' : 'add'; invBomRender(); }
function invBomSearch(w) {
  const D = invBomD, q = (document.getElementById('bom-q-' + w).value || '').trim(), box = document.getElementById('bom-r-' + w); D.pick[w] = ''; if (!q) { box.style.display = 'none'; return; }
  const pool = w === 'prep' ? D.itemCodes : D.allCodes; const res = pool.filter(c => smartMatch(q, D.nm[c] || c, c)).slice(0, 12);
  box.innerHTML = res.map(c => `<div style="padding:.4rem .6rem;border-bottom:1px solid #f1f5f9;cursor:pointer;" onclick="invBomPick('${w}','${srchEsc(c)}')"><b>${srchEsc(D.nm[c] || c)}</b> <small style="color:#64748b;">${srchEsc(c)}</small></div>`).join('') || '<div style="padding:.5rem;color:#94a3b8;">Walang nahanap.</div>'; box.style.display = 'block';
}
function invBomPick(w, c) { invBomD.pick[w] = c; document.getElementById('bom-q-' + w).value = invBomD.nm[c] || c; document.getElementById('bom-r-' + w).style.display = 'none'; }
function invBomAdd() {
  const D = invBomD, p = D.pick.prep, r = D.pick.raw, q = +document.getElementById('bom-f').value, un = document.getElementById('bom-u').value, y = +document.getElementById('bom-y').value; if (!p || !r) { alert('Pumili ng prep item at sangkap mula sa listahan.'); return; } if (p === r) { alert('Magkaiba dapat ang prep item at sangkap.'); return; } if (!(q > 0)) { alert('Ilagay ang dami (higit sa 0).'); return; } if (!(y > 0 && y <= 100)) { alert('Ang yield ay dapat 1–100%.'); return; }
  if (!D.own[p]) D.own[p] = { components: JSON.parse(JSON.stringify(invBomComps(D.inh[p]))), mode: invBomMode(D.inh[p]), ...(D.inh[p] && D.inh[p].out ? { out: D.inh[p].out } : {}) };
  const cs = D.own[p].components = invBomComps(D.own[p]).slice(); const ex = cs.findIndex(x => x.raw === r); const nc = { raw: r, qty: q, unit: un, factor: invBomFactor(q, un, D.um[r]), yield: y }; if (ex >= 0) cs[ex] = nc; else cs.push(nc); D.pick = { prep: '', raw: '' }; invBomRender();
}
async function invBomAddFree() {
  const D = invBomD, p = D.pick.prep, q = +document.getElementById('bom-f').value, un = document.getElementById('bom-u').value; if (!p) { alert('Pumili muna ng prep item (1).'); return; } if (!(q > 0)) { alert('Ilagay ang dami at unit sa itaas.'); return; }
  const nm = (await uiPrompt('Pangalan ng sangkap na hindi ibinabawas sa inventory:', 'Tubig') || '').trim(); if (!nm) return;
  if (!D.own[p]) D.own[p] = { components: JSON.parse(JSON.stringify(invBomComps(D.inh[p]))), mode: invBomMode(D.inh[p]) };
  D.own[p].components = invBomComps(D.own[p]).concat([{ raw: '', name: nm, qty: q, unit: un, factor: 0, yield: 100, free: true }]); D.pick = { prep: '', raw: '' }; invBomRender();
}
async function invBomOut(p) {
  const e = invBomD.own[p]; if (!e) return; const T = invBomTotals(e), cur = e.out ? e.out.qty + ' ' + e.out.unit : (T.w ? Math.round(T.w) + ' g' : ''), t = await uiPrompt('Actual na nagagawa ng 1 prep item matapos lutuin/gawin (hal. 1800 g, 2 kg). Iwanang blangko para gamitin ang kabuuan ng sangkap.', cur); if (t === null) return;
  const m = String(t).trim().match(/^([\d.]+)\s*(g|kg|ml|l)?$/i); if (!t.trim()) delete e.out; else if (m && +m[1] > 0) e.out = { qty: +m[1], unit: (m[2] || 'g').replace(/^L$/, 'L') }; else { alert('Hindi maintindihan. Hal. 2 kg o 1800 g'); return; } invBomRender();
}
function invBomDel(p, i) { const e = invBomD.own[p], cs = invBomComps(e).slice(); cs.splice(i, 1); if (cs.length) invBomD.own[p] = { components: cs, mode: invBomMode(e), ...(e.out ? { out: e.out } : {}) }; else delete invBomD.own[p]; invBomRender(); }
async function invBomSave() {
  const D = invBomD; try { await db.collection('inventory_bom').doc(D.id).set({ scope: D.scope, company: D.company, branchCode: D.bc || '', boms: D.own, updatedBy: invWho(), updatedAt: new Date().toISOString() }); arCloseModal(); alert(`✅ Na-save ang ${Object.keys(D.own).length} prepared link.`); if (D.scope === 'branch') invState.bom = await invLoadBom(D.company, D.bc); } catch (e) { alert('Error: ' + e.message); }
}
// Count Result: pinagsama ang bilang ng lahat ng station sa petsa (parang "Count Result" sheet) — Whole + Loose
let invResultRows = [];
async function invCountResult() {
  const S = invState; invResultDocs = {}; arModal('<div style="padding:1rem;">Kinukuha...</div>');
  try {
    const snap = await db.collection('inventory_counts').where('branchCode', '==', S.branchCode).get(); const by = {}, stns = new Set();
    snap.forEach(d => { const c = d.data(); if (c.countDate !== invRD()) return; stns.add(c.station); invResultDocs[c.station] = c; (c.lines || []).forEach(l => { const k = l.itemCode; const o = by[k] = by[k] || { code: k, name: l.itemName, uom: l.uom, wholeUom: l.wholeUom || '', conv: l.conv || 1, total: 0, st: {} }; o.total += +l.qty || 0; o.st[c.station] = (o.st[c.station] || 0) + (+l.qty || 0); if (l.conv) { o.conv = l.conv; o.wholeUom = l.wholeUom; } }); });
    // Prepared items (BOM): ang bilang ng prepared item ay idinadagdag sa raw item (hal. Tomato Slice → Tomato kg)
    try {
      const bom = await invLoadBom(S.company, S.branchCode); invState.bom = bom; const nm = c => (invState.products[c] && invState.products[c].itemName) || (invState.items.find(i => i.itemCode === c) || {}).itemName || c;
      Object.keys(by).forEach(pc => { const comps = invBomComps(bom[pc]); const p = by[pc]; if (!comps.length) return; const outs = [];
        comps.forEach(b => { if (!b.raw || !(+b.factor > 0)) return; const add = (invBomMode(bom[pc]) === 'add' ? 1 : -1) * p.total * (+b.factor) / ((+b.yield > 0 ? +b.yield : 100) / 100); if (!add) return;
          let r = by[b.raw]; if (!r) { const it = invState.items.find(i => i.itemCode === b.raw) || { itemCode: b.raw }; const cv = invConv(it); r = by[b.raw] = { code: b.raw, name: nm(b.raw), uom: invUom(it), wholeUom: cv > 1 ? invWholeUom(it) : '', conv: cv, total: 0, st: {}, fromPrep: true }; }
          r.total += add; r.st['🧪 ' + p.name] = (r.st['🧪 ' + p.name] || 0) + add; outs.push(nm(b.raw)); });
        if (outs.length) p.name = p.name + ' ➜ ' + outs.join(' + '); });
    } catch (e) {}
    invResultRows = Object.values(by).sort((a, b) => String(a.name).localeCompare(String(b.name)));
    invResultStns=[...stns]; invResultSort='name'; invResultCosts=await invLoadCosts(S.company); let mo=0; try{const ms=await db.collection('inventory_markouts').where('branchCode','==',S.branchCode).get(); ms.forEach(d=>{const m=d.data(); if(m.date===S.date) mo+=+m.total||0;});}catch(e){} invResultMO=mo; invCountResultRender();
  } catch (e) { arModal('<div style="color:#dc2626;padding:1rem;">Error: ' + srchEsc(e.message) + '</div>'); }
}
let invCRDate = '', invResultDocs = {};
function invRD() { return invCRDate || invState.date; }
async function invCountResultDate(v) { if (!v) return; invCRDate = v; await invCountResult(); }
let invResultStns = [], invResultSort = 'name', invResultCosts = {}, invResultMO = 0;
const invMoney = n => (Math.round((+n || 0) * 100) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
async function invLoadCosts(company) { try { const d = await db.collection('inventory_costs').doc('company_' + invSlug(company || '')).get(); invState.costs = d.exists ? (d.data().costs || {}) : {}; } catch (e) { invState.costs = {}; } return invState.costs; }
function invUnitCost(code, conv) { const c = (invState.costs || {})[code]; if (c !== undefined && c !== '' && !isNaN(+c)) return +c; const p = invState.products[code] || {}; if (+p.loosePrice > 0) return +p.loosePrice; if (+p.wholePrice > 0) return +p.wholePrice / (conv > 1 ? conv : (+p.conversionFactor || 1)); return 0; }
function invValRows() {
  const rows = invResultRows.map(r => { const uc = invUnitCost(r.code, r.conv), st = {}, sv = {}; let bomQ = 0; Object.keys(r.st).forEach(k => { if (k.indexOf('🧪') === 0) bomQ += r.st[k]; else st[k] = r.st[k]; }); Object.keys(st).forEach(k => sv[k] = st[k] * uc); return { r, uc, tv: r.total * uc, st, sv, bomQ, bomV: bomQ * uc }; });
  if (invResultSort === 'value') rows.sort((a, b) => b.tv - a.tv); return rows;
}
function invCountResultSort(m) { invResultSort = m; invCountResultRender(); }
function invCountResultRender() {
  const S = invState, rows = invValRows(), tot = rows.reduce((a, x) => a + x.tv, 0), noCost = rows.filter(x => !x.uc).length;
  const body = rows.map(x => { const r = x.r; return `<tr><td style="font-size:.75rem;color:#64748b;">${srchEsc(r.code)}</td><td>${srchEsc(r.name)}</td><td style="text-align:right;"><b>${r.conv > 1 ? srchEsc(invTotalFmt(r.total, r.conv, r.wholeUom || 'Whole', r.uom)) : (Math.round(r.total * 1000) / 1000) + ' ' + srchEsc(r.uom)}</b>${r.conv > 1 ? `<br><small style="color:#64748b;">= ${Math.round(r.total * 1000) / 1000} ${srchEsc(r.uom)}</small>` : ''}</td><td style="text-align:right;">${x.uc ? invMoney(x.uc) : '<span style="color:#dc2626;">—</span>'}<br><small style="color:#64748b;">/${srchEsc(r.uom)}</small></td><td style="text-align:right;"><b>${invMoney(x.tv)}</b></td><td><small>${Object.keys(r.st).map(k => srchEsc(k) + ': ' + (Math.round(r.st[k] * 1000) / 1000)).join(' · ')}</small></td></tr>`; }).join('') || '<tr><td colspan="6" style="text-align:center;color:#94a3b8;">Wala pang na-save na bilang sa petsang ito.</td></tr>';
  arModal(`<h3>📊 Count Result — ${srchEsc(S.branch)} · ${srchEsc(invRD())}</h3><div style="display:flex;gap:.4rem;align-items:center;flex-wrap:wrap;margin-bottom:.4rem;"><label style="font-size:.85rem;">📅 Petsa ng bilang:</label><input type="date" value="${srchEsc(invRD())}" onchange="invCountResultDate(this.value)"></div>
  <div style="margin-bottom:.5rem;"><small style="color:#64748b;">I-print ang laman (may larawan) ng:</small><br>${Object.keys(invResultDocs).sort(invNatSort).map(n => `<button class="btn btn-secondary btn-sm" style="margin:.15rem;" onclick="invPrintStationResult(this.dataset.s)" data-s="${srchEsc(n)}">🖨️ ${srchEsc(n)}</button>`).join('')}${Object.keys(invResultDocs).length > 1 ? ' <button class="btn btn-primary btn-sm" onclick="invPrintStationResult(\'*\')">🖨️ Lahat ng station</button>' : ''}</div>
  <p style="font-size:.85rem;color:#64748b;">${invResultStns.length} station ang nabilang: ${srchEsc(invResultStns.join(', ') || '—')}. Pinagsama ang bawat item sa lahat ng station.</p>
  <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:.5rem .8rem;margin-bottom:.5rem;"><b>💰 Kabuuang Halaga: ₱${invMoney(tot)}</b>${invResultMO ? `<br><small>Mark Out ngayong petsa: ₱${invMoney(invResultMO)}</small>` : ''}${noCost ? `<br><small style="color:#dc2626;">${noCost} item ang walang Unit Cost — i-set sa "💲 Unit Cost".</small>` : ''}</div>
  <div style="margin-bottom:.4rem;"><button class="btn btn-sm ${invResultSort === 'name' ? 'btn-primary' : 'btn-secondary'}" onclick="invCountResultSort('name')">A-Z</button> <button class="btn btn-sm ${invResultSort === 'value' ? 'btn-primary' : 'btn-secondary'}" onclick="invCountResultSort('value')">Sorted by Value</button></div>
  <div style="max-height:55vh;overflow:auto;"><table data-notools="1"><thead><tr><th>Code</th><th>Item</th><th style="text-align:right;">Kabuuan</th><th style="text-align:right;">Unit Cost</th><th style="text-align:right;">Total Value</th><th>Bawat station</th></tr></thead><tbody>${body}</tbody></table></div><button class="btn btn-secondary btn-sm" style="margin-top:.5rem;" onclick="invCountResultCSV()">📤 CSV</button> <button class="btn btn-secondary btn-sm" style="margin-top:.5rem;" onclick="invCountResultPrint()">🖨️ Print</button>`);
}
function invValMatrix() {
  const rows = invValRows(), cols = [...new Set(rows.flatMap(x => Object.keys(x.st)))].sort(invNatSort), hasBom = rows.some(x => x.bomQ);
  const colV = {}; cols.forEach(c => colV[c] = rows.reduce((a, x) => a + (x.sv[c] || 0), 0)); const bomT = rows.reduce((a, x) => a + x.bomV, 0), tot = rows.reduce((a, x) => a + x.tv, 0);
  return { rows, cols, hasBom, colV, bomT, tot };
}
function invCountResultPrint() {
  const M = invValMatrix(), n = v => (Math.round(v * 1000) / 1000) || 0;
  const th = (M.hasBom ? '<th class="num">From BOM</th>' : '') + M.cols.map(c => `<th class="num">${srchEsc(c)}</th>`).join('');
  const hv = (M.hasBom ? `<td class="num"><b>${invMoney(M.bomT)}</b></td>` : '') + M.cols.map(c => `<td class="num"><b>${invMoney(M.colV[c])}</b></td>`).join('');
  const rows = M.rows.map(x => `<tr><td>${srchEsc(x.r.code)}</td><td>${srchEsc(x.r.name)}</td><td class="num">${n(x.r.total)}</td><td>${srchEsc(x.r.uom)}</td><td class="num">${invMoney(x.uc)}</td><td class="num"><b>${invMoney(x.tv)}</b></td>${M.hasBom ? `<td class="num">${x.bomV ? invMoney(x.bomV) : ''}</td>` : ''}${M.cols.map(c => `<td class="num">${x.sv[c] ? invMoney(x.sv[c]) : ''}</td>`).join('')}${M.hasBom ? `<td class="num">${x.bomQ ? n(x.bomQ) : ''}</td>` : ''}${M.cols.map(c => `<td class="num">${x.st[c] ? n(x.st[c]) : ''}</td>`).join('')}</tr>`).join('');
  printHtmlDoc('Count Result Value ' + invRD(), `<div class="pg"><h1>📊 ${srchEsc(invState.company)} — Count Result Value Count ${srchEsc(invRD())}${invResultSort === 'value' ? ' (Sorted by Value)' : ''}</h1><div class="meta">Branch: <b>${srchEsc(invState.branch)}</b> (${srchEsc(invState.branchCode)}) · Kabuuang Halaga: <b>₱${invMoney(M.tot)}</b>${invResultMO ? ` · Mark Out: ₱${invMoney(invResultMO)}` : ''}<br>${printedByLine()}</div><table style="font-size:.7rem;"><thead><tr><th colspan="6"></th><th colspan="${M.cols.length + (M.hasBom ? 1 : 0)}" style="text-align:center;">VALUE</th><th colspan="${M.cols.length + (M.hasBom ? 1 : 0)}" style="text-align:center;">QTY</th></tr><tr><td colspan="5"><b>TOTAL</b></td><td class="num"><b>${invMoney(M.tot)}</b></td>${hv}<td colspan="${M.cols.length + (M.hasBom ? 1 : 0)}"></td></tr><tr><th>Item Code</th><th>Item Description</th><th class="num">Count Result</th><th>UOM</th><th class="num">Unit Cost</th><th class="num">Total Value</th>${th}${th}</tr></thead><tbody>${rows}</tbody></table><div class="sign"><div>Binilang ni (Checked by)<br><b>&nbsp;</b></div><div>Tinanggap / Inaprubahan ni<br><b>&nbsp;</b></div></div></div>`);
}
function invCountResultCSV() {
  const M = invValMatrix(), n = v => Math.round(v * 1000) / 1000, hd = (M.hasBom ? ['From BOM'] : []).concat(M.cols);
  const L = [['Item Code', 'Item Description', 'Inventory Count Result', 'UOM', 'Unit Cost', 'Total Value'].concat(hd.map(h => 'Value ' + h), hd.map(h => 'Qty ' + h)).map(csvCell).join(',')];
  L.push((['TOTAL', '', '', '', '', Math.round(M.tot * 100) / 100].concat(M.hasBom ? [Math.round(M.bomT * 100) / 100] : [], M.cols.map(c => Math.round(M.colV[c] * 100) / 100))).map(csvCell).join(','));
  M.rows.forEach(x => L.push([x.r.code, x.r.name, n(x.r.total), x.r.uom, Math.round(x.uc * 100) / 100, Math.round(x.tv * 100) / 100].concat(M.hasBom ? [Math.round(x.bomV * 100) / 100] : [], M.cols.map(c => Math.round((x.sv[c] || 0) * 100) / 100), M.hasBom ? [n(x.bomQ)] : [], M.cols.map(c => n(x.st[c] || 0))).map(csvCell).join(',')));
  downloadCSVFile(L.join('\r\n'), `Count_Result_Value_${invState.branchCode}_${invRD()}${invResultSort === 'value' ? '_by_value' : ''}.csv`);
}
async function invPrintStationResult(st) {
  const names = st === '*' ? Object.keys(invResultDocs).sort(invNatSort) : [st]; let html = '';
  for (const n of names) { const c = invResultDocs[n]; if (!c) continue;
    const rows = await invRowsWithPhotos((c.lines || []).map(l => ({ code: l.itemCode, name: l.itemName, uom: l.uom, qty: l.qty, conv: l.conv || 1, wuom: l.wholeUom || '', w: l.whole, l: l.loose })));
    rows.sort((a, b) => String(a.name).localeCompare(String(b.name)));
    html += invSheetHtml({ station: n, branch: invState.branch, branchCode: invState.branchCode, company: invState.company, date: invRD(), rows, photos: true, split: rows.some(r => r.conv > 1), checkedBy: c.checkedBy || '', receivedBy: c.receivedBy || '', remarks: c.remarks || '' }); }
  if (!html) { alert('Walang naka-save na bilang para sa station na ito.'); return; } printHtmlDoc('Inventory ' + invRD(), html);
}
// ---- Weekly (Linggo) / Month-end schedule at Compare ng mga petsa ----
function invKind(d) { const t = new Date(d + 'T00:00:00'); if (isNaN(t)) return ''; const me = new Date(t.getFullYear(), t.getMonth() + 1, 0).getDate() === t.getDate(), sun = t.getDay() === 0; return me ? (sun ? 'Month-end (Linggo — isa lang ito)' : 'Month-end') : sun ? 'Weekly (Linggo)' : ''; }
function invKindBadge(d) { const k = invKind(d); return k ? `<small style="display:block;margin-top:.2rem;color:#047857;font-weight:600;">✅ ${k}</small>` : `<small style="display:block;margin-top:.2rem;color:#b45309;">⚠️ Hindi Linggo o month-end — para sa weekly, Linggo ang petsa.</small>`; }
let invCmpData = null;
async function invCompareOpen() {
  const S = invState; arModal('<div style="padding:1rem;">Kinukuha...</div>');
  try {
    await invLoadCosts(S.company); const snap = await db.collection('inventory_counts').where('branchCode', '==', S.branchCode).get(); const by = {}, dates = new Set();
    snap.forEach(d => { const c = d.data(), dt = c.countDate; if (!dt) return; dates.add(dt); (c.lines || []).forEach(l => { const o = by[l.itemCode] = by[l.itemCode] || { code: l.itemCode, name: l.itemName, uom: l.uom, q: {} }; o.q[dt] = (o.q[dt] || 0) + (+l.qty || 0); }); });
    const all = [...dates].sort(); invCmpData = { by, all, sel: new Set(all.slice(-5)), diffOnly: false }; invCompareRender();
  } catch (e) { arModal('<div style="color:#dc2626;padding:1rem;">Error: ' + srchEsc(e.message) + '</div>'); }
}
function invCmpToggle(d) { const s = invCmpData.sel; s.has(d) ? s.delete(d) : s.add(d); invCompareRender(); }
function invCmpRows() {
  const D = invCmpData, ds = [...D.sel].sort(); const rows = Object.values(D.by).map(o => { const uc = invUnitCost(o.code, 1); const cells = ds.map((d, i) => { const q = o.q[d] || 0, pq = i ? (o.q[ds[i - 1]] || 0) : null; return { d, q, v: q * uc, diff: pq === null ? null : q - pq }; }); return { o, uc, cells, chg: cells.some(c => c.diff) }; }).filter(r => r.cells.some(c => c.q) && (!D.diffOnly || r.chg));
  rows.sort((a, b) => String(a.o.name).localeCompare(String(b.o.name))); return { ds, rows };
}
function invCompareRender() {
  const D = invCmpData, S = invState, { ds, rows } = invCmpRows(), n = v => Math.round(v * 1000) / 1000;
  const chips = D.all.map(d => `<label style="display:inline-block;margin:.15rem;padding:.2rem .5rem;border:1px solid #e2e8f0;border-radius:6px;font-size:.78rem;background:${D.sel.has(d) ? '#dbeafe' : '#fff'};"><input type="checkbox" ${D.sel.has(d) ? 'checked' : ''} onchange="invCmpToggle('${d}')"> ${d}${invKind(d) ? '<br><small style="color:#64748b;">' + invKind(d).split(' (')[0] + '</small>' : ''}</label>`).join('') || '<small>Wala pang naka-save na bilang.</small>';
  const tv = ds.map((d, i) => rows.reduce((a, r) => a + r.cells[i].v, 0));
  const head = ds.map(d => `<th style="text-align:right;">${d.slice(5)}</th>`).join(''), body = rows.map(r => `<tr><td>${srchEsc(r.o.name)}<br><small style="color:#64748b;">${srchEsc(r.o.code)} · ${srchEsc(r.o.uom || '')}</small></td>${r.cells.map(c => `<td style="text-align:right;">${n(c.q)}${c.diff ? `<br><small style="color:${c.diff < 0 ? '#dc2626' : '#16a34a'};">${c.diff > 0 ? '+' : ''}${n(c.diff)}</small>` : ''}</td>`).join('')}</tr>`).join('') || `<tr><td colspan="${ds.length + 1}" style="text-align:center;color:#94a3b8;">Pumili ng petsa.</td></tr>`;
  arModal(`<h3>📈 Compare — ${srchEsc(S.branch)}</h3><p style="font-size:.82rem;color:#64748b;">Pumili ng mga petsa ng bilang (Weekly tuwing Linggo, at Month-end). Kapag Linggo ang month-end, isa lang ang bilang. Ang <span style="color:#dc2626;">pula</span> = nabawasan (nabasag/nagamit), <span style="color:#16a34a;">berde</span> = nadagdag, kumpara sa nakaraang petsa.</p><div>${chips}</div><label style="font-size:.82rem;"><input type="checkbox" ${D.diffOnly ? 'checked' : ''} onchange="invCmpData.diffOnly=this.checked;invCompareRender()"> Ipakita lang ang may pagbabago</label>
  <div style="margin:.4rem 0;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:.4rem .7rem;font-size:.82rem;"><b>Halaga:</b> ${ds.map((d, i) => d.slice(5) + ' ₱' + invMoney(tv[i])).join(' · ') || '—'}</div>
  <div style="max-height:45vh;overflow:auto;"><table data-notools="1"><thead><tr><th>Item</th>${head}</tr></thead><tbody>${body}</tbody></table></div><button class="btn btn-secondary btn-sm" style="margin-top:.5rem;" onclick="invCompareCSV()">📤 CSV</button> <button class="btn btn-secondary btn-sm" style="margin-top:.5rem;" onclick="invComparePrint()">🖨️ Print</button>`);
}
function invCompareCSV() {
  const { ds, rows } = invCmpRows(), L = [['Item Code', 'Item', 'UOM', 'Unit Cost'].concat(ds.map(d => d + ' Qty'), ds.map(d => d + ' Diff'), ds.map(d => d + ' Value')).map(csvCell).join(',')];
  L.push(['TOTAL', '', '', ''].concat(ds.map(() => ''), ds.map(() => ''), ds.map((d, i) => Math.round(rows.reduce((a, r) => a + r.cells[i].v, 0) * 100) / 100)).map(csvCell).join(','));
  rows.forEach(r => L.push([r.o.code, r.o.name, r.o.uom, r.uc].concat(r.cells.map(c => Math.round(c.q * 1000) / 1000), r.cells.map(c => c.diff === null ? '' : Math.round(c.diff * 1000) / 1000), r.cells.map(c => Math.round(c.v * 100) / 100)).map(csvCell).join(',')));
  downloadCSVFile(L.join('\r\n'), `Inventory_Compare_${invState.branchCode}.csv`);
}
function invComparePrint() {
  const { ds, rows } = invCmpRows(), n = v => Math.round(v * 1000) / 1000, th = ds.map(d => `<th class="num">${d}</th>`).join('');
  const body = rows.map(r => `<tr><td>${srchEsc(r.o.code)}</td><td>${srchEsc(r.o.name)}</td><td>${srchEsc(r.o.uom || '')}</td>${r.cells.map(c => `<td class="num">${n(c.q)}${c.diff ? ` <small style="color:${c.diff < 0 ? '#dc2626' : '#16a34a'};">(${c.diff > 0 ? '+' : ''}${n(c.diff)})</small>` : ''}</td>`).join('')}</tr>`).join('');
  const tot = ds.map((d, i) => `<td class="num"><b>${invMoney(rows.reduce((a, r) => a + r.cells[i].v, 0))}</b></td>`).join('');
  printHtmlDoc('Inventory Compare', `<div class="pg"><h1>📈 Inventory Compare — ${srchEsc(invState.branch)}</h1><div class="meta">Company: <b>${srchEsc(invState.company)}</b><br>${printedByLine()}</div><table style="font-size:.72rem;"><thead><tr><th>Code</th><th>Item</th><th>UOM</th>${th}</tr><tr><td colspan="3"><b>Halaga (₱)</b></td>${tot}</tr></thead><tbody>${body}</tbody></table></div>`);
}
// ---- Wares / items mula sa SAP Item Master + larawan mula sa Google Drive link ----
function invDriveId(u) { u = String(u || '').trim(); let m = u.match(/\/d\/([\w-]{10,})/) || u.match(/[?&]id=([\w-]{10,})/); return m ? m[1] : ''; }
function invDriveThumb(u) { u = String(u || '').trim(); if (!u) return ''; const id = invDriveId(u); return id ? `https://drive.google.com/thumbnail?id=${id}&sz=w400` : (/^https?:/i.test(u) ? u : ''); }
async function invPhotoLinksImport() {
  const t = await pickCSVFile(); if (!t) return; const rows = csvToObjects(t); let ok = 0, bad = 0, batch = db.batch(), n = 0;
  for (const r of rows) { const c = (r.item_code || r.itemcode || r.code || '').trim(), l = (r.photo_link || r.link || r.photo || r.picture || '').trim(); if (!c || !invDriveThumb(l)) { bad++; continue; } batch.set(db.collection('product_photos').doc(c), { link: l, updatedBy: invWho(), updatedAt: new Date().toISOString() }, { merge: true }); delete invPhotoCache[c]; ok++; if (++n % 400 === 0) { await batch.commit(); batch = db.batch(); } }
  try { await batch.commit(); alert(`✅ ${ok} larawan ang na-link.${bad ? ' ' + bad + ' row ang nilaktawan (walang code o link).' : ''}\\nTandaan: ang file sa Drive ay dapat "Anyone with the link" para lumabas.`); } catch (e) { alert('Error: ' + e.message); }
}
let sapPull = { items: [], exist: {} };
async function invSapPullOpen() {
  const cos = (typeof invCompaniesList !== 'undefined' ? invCompaniesList : []), sts = (typeof invStationsList !== 'undefined' ? invStationsList : []);
  arModal(`<h3>📒 Kunin mula SAP Item Master</h3><p style="font-size:.82rem;color:#64748b;">Piliin ang company at ang Item Group (hal. wares) para idagdag sa inventory list. Hindi papalitan ang mga item na nasa inventory na.</p>
  <div class="form-group"><label>Company</label><select id="sp-co" onchange="invSapPullLoad()"><option value="">— pumili —</option>${cos.map(c => `<option>${srchEsc(c)}</option>`).join('')}</select></div><div id="sp-groups"></div>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:.4rem;"><div class="form-group"><label>Uri</label><select id="sp-type"><option value="wares">🥢 Wares</option><option value="kitchen">🍳 Kitchen</option></select></div><div class="form-group"><label>Station</label><select id="sp-st">${sts.map(c => `<option>${srchEsc(c)}</option>`).join('') || '<option>Unassigned</option>'}</select></div></div>
  <button class="btn btn-success" onclick="invSapPullGo()">⬇️ Idagdag sa inventory</button>`);
}
async function invSapPullLoad() {
  const co = document.getElementById('sp-co').value, box = document.getElementById('sp-groups'); sapPull = { items: [], exist: {} }; if (!co) { box.innerHTML = ''; return; }
  box.innerHTML = 'Kinukuha...';
  try { const sn = await db.collection('sap_items').where('company', '==', co).get(); sn.forEach(d => sapPull.items.push(d.data())); const ex = await db.collection('inventory_items').where('company', '==', co).get(); ex.forEach(d => sapPull.exist[d.data().itemCode] = 1); } catch (e) { box.innerHTML = 'Error: ' + srchEsc(e.message); return; }
  const g = {}; sapPull.items.forEach(i => { if (i.itemGroup) g[i.itemGroup] = (g[i.itemGroup] || 0) + 1; });
  box.innerHTML = Object.keys(g).sort().map(k => `<label style="display:block;font-size:.85rem;"><input type="checkbox" class="sp-g" value="${srchEsc(k)}"> ${srchEsc(k)} <small style="color:#64748b;">(${g[k]})</small></label>`).join('') || '<small style="color:#dc2626;">Walang SAP item para sa company na ito. I-import muna sa 📒 SAP Item Master.</small>';
}
async function invSapPullGo() {
  const co = document.getElementById('sp-co').value, gs = [...document.querySelectorAll('.sp-g:checked')].map(x => x.value), type = document.getElementById('sp-type').value, st = document.getElementById('sp-st').value;
  if (!co || !gs.length) { alert('Pumili ng company at kahit isang Item Group.'); return; }
  const list = sapPull.items.filter(i => gs.includes(i.itemGroup) && i.active !== false && !sapPull.exist[i.itemCode]); if (!list.length) { alert('Walang bagong item na idaragdag (nasa inventory na lahat o inactive).'); return; }
  if (!await uiConfirm(`Idagdag ang ${list.length} item sa ${co} bilang ${type}, station "${st}"?`)) return;
  try { let batch = db.batch(), n = 0; for (const i of list) { batch.set(db.collection('inventory_items').doc(`${co}__${i.itemCode}`), { company: co, itemCode: i.itemCode, itemName: i.itemName, type, station: st, countUOM: i.invUom || i.purchUom || 'Pcs', source: 'sap', updatedAt: new Date().toISOString() }, { merge: true }); if (++n % 400 === 0) { await batch.commit(); batch = db.batch(); } } await batch.commit(); arCloseModal(); alert(`✅ ${list.length} item ang naidagdag. Palitan ang station ng bawat item sa Setup kung kailangan.`); } catch (e) { alert('Error: ' + e.message); }
}
// ---- Unit Cost (bawat item, bawat company) ----
let invCostDraft = {};
function invCostOpen() { invCostDraft = JSON.parse(JSON.stringify(invState.costs || {})); invCostRender(''); }
function invCostRender(q) {
  const its = invState.items.filter(i => !q || smartMatch(q, invItemName(i), i.itemCode)).slice(0, 60);
  const rows = its.map(i => `<tr><td style="font-size:.75rem;color:#64748b;">${srchEsc(i.itemCode)}</td><td>${srchEsc(invItemName(i))}<br><small style="color:#64748b;">/${srchEsc(invUom(i))}</small></td><td><input type="number" step="0.01" min="0" style="width:100px;" value="${invCostDraft[i.itemCode] !== undefined ? invCostDraft[i.itemCode] : ''}" placeholder="${invUnitCost(i.itemCode, invConv(i)) || ''}" onchange="invCostSet('${srchEsc(i.itemCode)}',this.value)"></td></tr>`).join('');
  arModal(`<h3>💲 Unit Cost — ${srchEsc(invState.company)}</h3><p style="font-size:.82rem;color:#64748b;">Halaga bawat <b>loose UOM</b> (hal. bawat KG / PACK). Kapag blangko, gagamitin ang presyo ng produkto. ${Object.keys(invCostDraft).length} ang may cost.</p><input id="cost-q" placeholder="🔍 Hanapin ang item..." value="${srchEsc(q)}" oninput="invCostRender(this.value)" style="width:100%;margin-bottom:.4rem;"><div style="max-height:45vh;overflow:auto;"><table data-notools="1"><thead><tr><th>Code</th><th>Item</th><th>Unit Cost</th></tr></thead><tbody>${rows}</tbody></table></div><div style="margin-top:.5rem;"><button class="btn btn-success" onclick="invCostSave()">💾 I-save</button> <button class="btn btn-secondary" onclick="invCostImport()">📥 Import CSV (item_code, unit_cost)</button></div>`);
  const el = document.getElementById('cost-q'); if (el && q) { el.focus(); el.setSelectionRange(q.length, q.length); }
}
function invCostSet(c, v) { if (v === '' || isNaN(+v)) delete invCostDraft[c]; else invCostDraft[c] = +v; }
async function invCostImport() { const t = await pickCSVFile(); if (!t) return; let n = 0; csvToObjects(t).forEach(o => { const c = o.item_code || o.itemcode || o.code, v = parseFloat(String(o.unit_cost || o.cost || '').replace(/,/g, '')); if (c && !isNaN(v)) { invCostDraft[c] = v; n++; } }); alert(`Na-load ang ${n} cost. I-click ang I-save.`); invCostRender(''); }
async function invCostSave() { try { await db.collection('inventory_costs').doc('company_' + invSlug(invState.company || '')).set({ company: invState.company, costs: invCostDraft, updatedBy: invWho(), updatedAt: new Date().toISOString() }); invState.costs = invCostDraft; arCloseModal(); alert('✅ Na-save ang Unit Cost.'); } catch (e) { alert('Error: ' + e.message); } }
// ---- Mark Out log (Transfer / Spoilage / RnD / Mark Out) ----
const MO_REASONS = { Transfer: 'Nilipat sa ibang store/location — ilagay sa remarks ang pinagpadalhan.', Spoilage: 'Good items na hindi na magamit (bulok/damage) — ilagay ang pinagmulang station.', RnD: 'Ginamit sa testing/development — ilagay ang activity.', 'Mark Out': 'Ginamit/nilabas para sa ibang gamit — ilagay ang paggamit.' };
let moRows = [], moPick = '', moFrom = '', moTo = '';
async function invMarkOutOpen() {
  const S = invState; if (!moFrom) moFrom = S.date.slice(0, 8) + '01'; if (!moTo) moTo = S.date; await invLoadCosts(S.company);
  arModal('<div style="padding:1rem;">Kinukuha...</div>');
  try { const snap = await db.collection('inventory_markouts').where('branchCode', '==', S.branchCode).get(); moRows = []; snap.forEach(d => moRows.push({ id: d.id, ...d.data() })); } catch (e) { moRows = []; }
  moPick = ''; invMarkOutRender();
}
function invMarkOutSearch() { const q = (document.getElementById('mo-q').value || '').trim(), box = document.getElementById('mo-r'); moPick = ''; if (!q) { box.style.display = 'none'; return; } box.innerHTML = invState.items.filter(i => smartMatch(q, invItemName(i), i.itemCode)).slice(0, 10).map(i => `<div style="padding:.4rem .6rem;border-bottom:1px solid #f1f5f9;cursor:pointer;" onclick="invMarkOutPick('${srchEsc(i.itemCode)}')"><b>${srchEsc(invItemName(i))}</b> <small style="color:#64748b;">${srchEsc(i.itemCode)} · ${srchEsc(invUom(i))}</small></div>`).join('') || '<div style="padding:.5rem;color:#94a3b8;">Walang nahanap.</div>'; box.style.display = 'block'; }
function invMarkOutPick(c) { const it = invState.items.find(i => i.itemCode === c); moPick = c; document.getElementById('mo-q').value = invItemName(it); document.getElementById('mo-r').style.display = 'none'; document.getElementById('mo-u').textContent = invUom(it) + ' @ ' + invMoney(invUnitCost(c, invConv(it))); }
function invMoFiltered() { return moRows.filter(m => m.date >= moFrom && m.date <= moTo).sort((a, b) => (a.date + (a.at || '')).localeCompare(b.date + (b.at || ''))); }
function invMarkOutRender() {
  const S = invState, list = invMoFiltered(), tot = list.reduce((a, m) => a + (+m.total || 0), 0), by = {}; list.forEach(m => by[m.reason] = (by[m.reason] || 0) + (+m.total || 0));
  const rows = list.map(m => `<tr><td>${srchEsc(m.date)}</td><td>${srchEsc(m.itemName)}<br><small style="color:#64748b;">${srchEsc(m.itemCode)}</small></td><td style="text-align:right;">${m.qty} ${srchEsc(m.uom)}</td><td style="text-align:right;">${invMoney(m.total)}</td><td>${srchEsc(m.reason)}<br><small>${srchEsc(m.remarks || '')}</small></td><td><small>${srchEsc(m.by || '')}</small></td><td><button class="btn btn-sm btn-danger" onclick="invMarkOutDel('${srchEsc(m.id)}')">🗑</button></td></tr>`).join('') || '<tr><td colspan="7" style="text-align:center;color:#94a3b8;">Wala pang Mark Out sa saklaw na petsa.</td></tr>';
  arModal(`<h3>📤 Mark Out — ${srchEsc(S.branch)}</h3><details open style="margin-bottom:.5rem;"><summary style="cursor:pointer;color:#64748b;font-size:.82rem;">Ano ang ibig sabihin ng bawat reason</summary>${Object.keys(MO_REASONS).map(k => `<div style="font-size:.8rem;"><b>${k}</b> — ${MO_REASONS[k]}</div>`).join('')}</details>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:.4rem;margin-bottom:.5rem;"><div style="grid-column:1/3;position:relative;"><input id="mo-q" placeholder="🔍 Item..." oninput="invMarkOutSearch()" style="width:100%;"><div id="mo-r" style="display:none;position:absolute;left:0;right:0;background:#fff;border:1px solid #e2e8f0;max-height:180px;overflow:auto;z-index:5;"></div></div>
  <input id="mo-d" type="date" value="${srchEsc(S.date)}"><input id="mo-n" type="number" step="any" min="0" placeholder="Qty"><small id="mo-u" style="grid-column:1/3;color:#64748b;"></small><select id="mo-s">${Object.keys(MO_REASONS).map(k => `<option>${k}</option>`).join('')}</select><input id="mo-m" placeholder="Remarks"><button class="btn btn-success" style="grid-column:1/3;" onclick="invMarkOutAdd()">➕ Idagdag</button></div>
  <div style="display:flex;gap:.4rem;align-items:center;margin-bottom:.4rem;"><input type="date" id="mo-f" value="${moFrom}" onchange="moFrom=this.value;invMarkOutRender()"> – <input type="date" id="mo-t" value="${moTo}" onchange="moTo=this.value;invMarkOutRender()"></div>
  <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:.4rem .7rem;margin-bottom:.4rem;"><b>Kabuuang Mark Out: ₱${invMoney(tot)}</b><br><small>${Object.keys(by).map(k => srchEsc(k) + ' ₱' + invMoney(by[k])).join(' · ') || '—'}</small></div>
  <div style="max-height:35vh;overflow:auto;"><table data-notools="1"><thead><tr><th>Petsa</th><th>Item</th><th style="text-align:right;">Qty</th><th style="text-align:right;">Cost</th><th>Reason</th><th>By</th><th></th></tr></thead><tbody>${rows}</tbody></table></div><button class="btn btn-secondary btn-sm" style="margin-top:.5rem;" onclick="invMarkOutCSV()">📤 CSV</button> <button class="btn btn-secondary btn-sm" style="margin-top:.5rem;" onclick="invMarkOutPrint()">🖨️ Print</button>`);
}
async function invMarkOutAdd() {
  const S = invState, it = S.items.find(i => i.itemCode === moPick), q = +document.getElementById('mo-n').value, d = document.getElementById('mo-d').value, rs = document.getElementById('mo-s').value, rm = document.getElementById('mo-m').value.trim();
  if (!it) { alert('Pumili ng item mula sa listahan.'); return; } if (!(q > 0)) { alert('Ilagay ang Qty.'); return; } if (!d) { alert('Ilagay ang petsa.'); return; } if (rs !== 'Mark Out' && !rm) { alert('Ilagay ang remarks (' + MO_REASONS[rs] + ')'); return; }
  const uc = invUnitCost(it.itemCode, invConv(it)), rec = { branchCode: S.branchCode, branch: S.branch, company: S.company, date: d, itemCode: it.itemCode, itemName: invItemName(it), qty: q, uom: invUom(it), unitCost: uc, total: Math.round(q * uc * 100) / 100, reason: rs, remarks: rm, by: invWho(), at: new Date().toISOString() };
  try { const r = await db.collection('inventory_markouts').add(rec); moRows.push({ id: (r && r.id) || ('m' + Date.now()), ...rec }); if (d > moTo) moTo = d; if (d < moFrom) moFrom = d; moPick = ''; invMarkOutRender(); } catch (e) { alert('Error: ' + e.message); }
}
async function invMarkOutDel(id) { if (!await uiConfirm('Burahin ang Mark Out na ito?')) return; try { await db.collection('inventory_markouts').doc(id).delete(); moRows = moRows.filter(m => m.id !== id); invMarkOutRender(); } catch (e) { alert('Error: ' + e.message); } }
function invMarkOutCSV() { const L = [['Store', 'Date', 'Item Code', 'Item Description', 'Qty', 'UOM', 'Unit Cost', 'Total Cost', 'Reason', 'Remarks', 'Declared By'].map(csvCell).join(',')]; invMoFiltered().forEach(m => L.push([m.branch, m.date, m.itemCode, m.itemName, m.qty, m.uom, m.unitCost, m.total, m.reason, m.remarks, m.by].map(csvCell).join(','))); downloadCSVFile(L.join('\r\n'), `Mark_Out_${invState.branchCode}_${moFrom}_${moTo}.csv`); }
function invMarkOutPrint() {
  const list = invMoFiltered(), tot = list.reduce((a, m) => a + (+m.total || 0), 0), rows = list.map(m => `<tr><td>${srchEsc(m.date)}</td><td>${srchEsc(m.itemCode)}</td><td>${srchEsc(m.itemName)}</td><td class="num">${m.qty}</td><td>${srchEsc(m.uom)}</td><td class="num">${invMoney(m.unitCost)}</td><td class="num">${invMoney(m.total)}</td><td>${srchEsc(m.reason)}</td><td>${srchEsc(m.remarks || '')}</td><td>${srchEsc(m.by || '')}</td></tr>`).join('');
  printHtmlDoc('Mark Out ' + moFrom + ' - ' + moTo, `<div class="pg"><h1>📤 Mark Out — ${srchEsc(invState.branch)}</h1><div class="meta">Company: <b>${srchEsc(invState.company)}</b> · ${srchEsc(moFrom)} hanggang ${srchEsc(moTo)} · Kabuuan: <b>₱${invMoney(tot)}</b><br>${printedByLine()}</div><table style="font-size:.75rem;"><thead><tr><th>Date</th><th>Code</th><th>Item Description</th><th class="num">Qty</th><th>UOM</th><th class="num">Unit Cost</th><th class="num">Total Cost</th><th>Reason</th><th>Remarks</th><th>Declared By</th></tr></thead><tbody>${rows}</tbody></table><div class="sign"><div>Declared by<br><b>&nbsp;</b></div><div>Approved by<br><b>&nbsp;</b></div></div></div>`);
}
function invDraftKey() { return `kusina_inv_${invState.branchCode}_${invState.date}_${invSlug(invState.station)}`; }
function invLoadDraft() {
  invState.entries = {}; invState.temps = []; invState.parts = {};
  try { const d = JSON.parse(localStorage.getItem(invDraftKey()) || 'null'); if (d) { invState.entries = d.entries || {}; invState.parts = d.parts || {}; invState.temps = d.temps || []; invState.checkedBy = d.checkedBy; invState.receivedBy = d.receivedBy; invState.remarks = d.remarks; } } catch (e) {}
}
function invSaveDraft() {
  try { localStorage.setItem(invDraftKey(), JSON.stringify({ entries: invState.entries, parts: invState.parts || {}, temps: invState.temps, checkedBy: invState.checkedBy, receivedBy: invState.receivedBy, remarks: invState.remarks })); } catch (e) {}
}
function invNatSort(a, b) { return String(a).localeCompare(String(b), undefined, { numeric: true }); }
function invStationNames() { return Object.keys(invState.stationItems || {}).sort(invNatSort); }
// Membership ng station: kada branch ang may sariling station at laman nito (puwedeng nasa higit sa isang station ang item)
function invBuildStationItems(doc) {
  if (doc && doc.stations) { const o = {}; Object.keys(doc.stations).forEach(k => { o[k] = (doc.stations[k] || []).slice(); }); return o; }
  const o = {}; invState.items.forEach(i => { const st = (doc && doc.map && doc.map[i.itemCode]) || i.station; if (st) (o[st] = o[st] || []).push(i.itemCode); }); return o;
}
function invStationOf(code, prefer) { const m = invState.stationItems || {}; if (prefer && (m[prefer] || []).includes(code)) return prefer; return invStationNames().find(k => (m[k] || []).includes(code)) || ''; }
function invStationItems() {
  const by = {}; invState.items.forEach(i => by[i.itemCode] = i); const codes = (invState.stationItems || {})[invState.station] || [];
  return codes.map(c => by[c]).filter(i => i && (!invState.type || i.type === invState.type)).sort((a, b) => String(invItemName(a)).localeCompare(String(invItemName(b))));
}
// Whole + Loose: kung may Whole:Loose na conversion ang produkto (hal. 1 CSE = 24 PC), dalawa ang input at ang total ay nasa loose unit
function invConv(it) { const p = invState.products[it.itemCode] || {}; const c = +p.conversionFactor || 1; if (c <= 1) return 1; if (it.countUOM && p.looseUOM && String(it.countUOM).toUpperCase() !== String(p.looseUOM).toUpperCase()) return 1; return c; }
function invWholeUom(it) { const p = invState.products[it.itemCode] || {}; return p.wholeUOM || 'Whole'; }
function invTotalFmt(q, conv, wu, lu) { q = +q || 0; const w = Math.floor(q / conv + 1e-9), l = Math.round((q - w * conv) * 100) / 100; return `${w} ${wu}${l ? ' + ' + l + ' ' + lu : ''}`; }
function invUom(it) { const p = invState.products[it.itemCode] || {}; return it.countUOM || p.looseUOM || p.wholeUOM || 'Pcs'; }
function invItemName(it) { const p = invState.products[it.itemCode]; return (p && p.itemName) || it.itemName || it.itemCode; }
function invRenderMain() {
  const root = document.getElementById('branch-inventory-root'); if (!root || !invState.ready) return;
  const stations = invStationNames();
  const items = invStationItems();
  const counted = items.filter(i => invNum(invState.entries[i.itemCode]) !== null).length;
  const rows = items.map(it => {
    const code = it.itemCode, v = invState.entries[code];
    return `<tr id="invrow-${srchEsc(invSlug(code))}" class="${invNum(v) !== null ? 'inv-done' : ''}">
      <td style="width:64px;"><img data-photo="${srchEsc(code)}" class="inv-thumb" style="visibility:hidden;" alt=""></td>
      <td><b>${srchEsc(invItemName(it))}</b><br><small style="color:#64748b;">ID: ${srchEsc(code)} · ${INV_TYPES[it.type] || ''}</small></td>
      <td>${srchEsc(invUom(it))}</td>
      ${invConv(it) > 1 ? (() => { const pt = (invState.parts || {})[code] || {}; return `<td style="width:210px;"><div style="display:flex;gap:.3rem;align-items:center;"><input type="number" inputmode="decimal" min="0" step="any" data-invw="${srchEsc(code)}" value="${pt.w == null ? '' : srchEsc(pt.w)}" placeholder="${srchEsc(invWholeUom(it))}" style="width:70px;font-weight:700;"><span style="font-size:.7rem;">${srchEsc(invWholeUom(it))}</span><input type="number" inputmode="decimal" min="0" step="any" data-invl="${srchEsc(code)}" value="${pt.l == null ? '' : srchEsc(pt.l)}" placeholder="${srchEsc(invUom(it))}" style="width:70px;font-weight:700;"><span style="font-size:.7rem;">${srchEsc(invUom(it))}</span></div><small id="invtot-${srchEsc(invSlug(code))}" style="color:#059669;">${v == null || v === '' ? '' : '= ' + srchEsc(v) + ' ' + srchEsc(invUom(it)) + ' (1 ' + srchEsc(invWholeUom(it)) + ' = ' + invConv(it) + ')'}</small></td></tr>`; })() : `<td style="width:120px;"><input type="number" inputmode="decimal" min="0" step="any" data-invq="${srchEsc(code)}" value="${v == null ? '' : srchEsc(v)}" placeholder="Bilang" style="width:100%;font-weight:700;"></td></tr>`}`;
  }).join('') || '<tr><td colspan="4" style="text-align:center;color:#94a3b8;padding:1rem;">Walang item sa station na ito.</td></tr>';
  const tmpRows = invState.temps.map((t, i) => `<tr class="inv-done" style="background:#fffbeb;"><td>🆕</td><td><b>${srchEsc(t.name)}</b><br><small style="color:#b45309;">Wala pang SAP code · ${srchEsc(t.code)}</small></td><td>${srchEsc(t.uom)}</td><td><b>${srchEsc(t.qty)}</b> <button class="btn btn-sm btn-danger" onclick="invRemoveTemp(${i})">✕</button></td></tr>`).join('');
  root.innerHTML = `
  <div class="card" data-notools="1">
    <div class="card-title"><span>📋 Inventory Count — ${srchEsc(invState.branch)} <small style="color:#64748b;">(${srchEsc(invState.branchCode)} · ${srchEsc(invState.company)})</small></span></div>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:0.75rem;margin-bottom:0.75rem;">
      <div class="form-group" style="margin:0;"><label>📅 Petsa ng Inventory</label><select id="inv-date" data-nosearch="1">${invDateOptions()}</select>${invKindBadge(invState.date)}</div>
      <div class="form-group" style="margin:0;"><label>📍 Station</label><select id="inv-station" data-searchable="1">${stations.map(s => `<option value="${srchEsc(s)}" ${s === invState.station ? 'selected' : ''}>📍 ${srchEsc(s)}</option>`).join('')}</select></div>
      <div class="form-group" style="margin:0;"><label>Uri</label><select id="inv-type" data-nosearch="1"><option value="">Lahat</option><option value="kitchen" ${invState.type === 'kitchen' ? 'selected' : ''}>🍳 Kitchen</option><option value="wares" ${invState.type === 'wares' ? 'selected' : ''}>🥢 Wares</option></select></div>
    </div>
    <div style="display:flex;gap:0.5rem;margin-bottom:0.5rem;">
      <div class="srch-wrap" style="flex:1;"><input type="text" id="inv-search" autocomplete="off" placeholder="🔎 Mag-search ng item / i-scan ang barcode (USB scanner: Enter)..."><div id="inv-results" class="srch-results"></div></div>
      <button type="button" class="btn btn-primary" onclick="openCameraBarcodeScanner('inv_count')">📷 Scan</button>
    </div>
    <label style="font-size:0.8rem;display:flex;gap:0.4rem;align-items:center;font-weight:500;margin-bottom:0.75rem;"><input type="checkbox" id="inv-auto-scan" style="width:auto;" ${(navigator.maxTouchPoints || 0) > 0 ? 'checked' : ''}> 🔁 Tuloy-tuloy na scan (pagka-Enter sa bilang, bubukas ulit ang camera)</label>
    <div style="font-size:0.85rem;color:#475569;margin-bottom:0.5rem;">Na-bilang: <b>${counted}</b> / ${items.length} sa station na ito</div>
    <div class="table-responsive"><table><thead><tr><th>Larawan</th><th>Item</th><th>UOM</th><th>Bilang</th></tr></thead><tbody>${rows}${tmpRows}</tbody></table></div>
    <div style="display:flex;gap:0.5rem;flex-wrap:wrap;margin:0.75rem 0;">
      <button class="btn btn-secondary btn-sm" onclick="invAddTempItem()">➕ Item na wala sa listahan</button>
      <button class="btn btn-secondary btn-sm" onclick="invBomOpen('branch')">🧪 Prepared / BOM</button>
      <button class="btn btn-secondary btn-sm" onclick="invStationMapOpen()">📍 I-set ang station ng mga item</button>
      <button class="btn btn-secondary btn-sm" onclick="invCountResult()">📊 Count Result (lahat ng station)</button>
      <button class="btn btn-secondary btn-sm" onclick="invCompareOpen()">📈 Weekly / Month-end Compare</button>
      <button class="btn btn-secondary btn-sm" onclick="invCostOpen()">💲 Unit Cost</button>
      <button class="btn btn-secondary btn-sm" onclick="invMarkOutOpen()">📤 Mark Out</button>
      <button class="btn btn-secondary btn-sm" onclick="invZeroBlanks()">0️⃣ Gawing 0 ang mga blanko</button>
      <button class="btn btn-secondary btn-sm" onclick="printInvSheet(false)">🖨️ Blank Sheet</button>
      <button class="btn btn-secondary btn-sm" onclick="printAllStationsBlank()">🖨️ Blank — lahat ng station</button>
      <button class="btn btn-secondary btn-sm" onclick="printInvSheet(true)">🖨️ May Bilang</button>
      <button class="btn btn-secondary btn-sm" onclick="exportInvCurrentCSV()">⬇️ CSV</button>
    </div>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:0.75rem;">
      <div class="form-group" style="margin:0;"><label>✍️ Binilang ni (Checked by)</label><input type="text" id="inv-checked" value="${srchEsc(invState.checkedBy != null ? invState.checkedBy : invWho())}"></div>
      <div class="form-group" style="margin:0;"><label>✍️ Tinanggap / Inaprubahan ni</label><input type="text" id="inv-received" value="${srchEsc(invState.receivedBy || '')}" placeholder="Pangalan ng manager / pumirma"></div>
      <div class="form-group" style="margin:0;"><label>Remarks</label><input type="text" id="inv-remarks" value="${srchEsc(invState.remarks || '')}"></div>
    </div>
    <button class="btn btn-success" style="width:100%;margin-top:1rem;font-weight:800;" onclick="submitInventoryCount()">💾 I-SAVE ANG INVENTORY NG STATION NA ITO</button>
  </div>
  <div class="card" data-notools="1"><div class="card-title"><span>🗂️ Mga Nakaraang Inventory ng Branch</span><button class="btn btn-secondary btn-sm" onclick="invLoadHistory()">🔄 Refresh</button></div>
    <div class="table-responsive"><table><thead><tr><th>Petsa</th><th>Station</th><th>Binilang ni</th><th>Pumirma</th><th>Items</th><th>Status</th><th>Aksyon</th></tr></thead><tbody id="inv-history-tbody"><tr><td colspan="7" style="text-align:center;color:#94a3b8;">Kinukuha...</td></tr></tbody></table></div></div>`;
  invHydratePhotos(root);
  invRenderHistory();
}
function invGrabFields() {
  const g = id => (document.getElementById(id) || {}).value;
  invState.checkedBy = g('inv-checked'); invState.receivedBy = g('inv-received'); invState.remarks = g('inv-remarks');
}
(function invBindBranchEvents() {
  document.addEventListener('input', e => {
    const t = e.target;
    if (t.dataset && t.dataset.invq !== undefined) {
      const code = t.dataset.invq; invState.entries[code] = t.value; invGrabFields(); invSaveDraft();
      const tr = t.closest('tr'); if (tr) tr.classList.toggle('inv-done', invNum(t.value) !== null);
    } else if (t.dataset && (t.dataset.invw !== undefined || t.dataset.invl !== undefined)) {
      const code = t.dataset.invw !== undefined ? t.dataset.invw : t.dataset.invl; const it = invState.items.find(i => i.itemCode === code); const tr = t.closest('tr');
      const w = tr.querySelector('[data-invw]').value, l = tr.querySelector('[data-invl]').value; invState.parts = invState.parts || {}; invState.parts[code] = { w, l };
      const conv = invConv(it); const has = invNum(w) !== null || invNum(l) !== null; const tot = has ? Math.round(((invNum(w) || 0) * conv + (invNum(l) || 0)) * 1000) / 1000 : '';
      invState.entries[code] = has ? String(tot) : ''; invGrabFields(); invSaveDraft(); tr.classList.toggle('inv-done', has);
      const lab = document.getElementById('invtot-' + invSlug(code)); if (lab) lab.textContent = has ? `= ${tot} ${invUom(it)} (1 ${invWholeUom(it)} = ${conv})` : '';
    } else if (t.id === 'inv-search') invSearch();
    else if (t.id === 'inv-checked' || t.id === 'inv-received' || t.id === 'inv-remarks') { invGrabFields(); invSaveDraft(); }
  });
  document.addEventListener('keydown', e => {
    const t = e.target;
    if (t.dataset && (t.dataset.invq !== undefined || t.dataset.invl !== undefined) && e.key === 'Enter') {
      e.preventDefault();
      const auto = document.getElementById('inv-auto-scan');
      if (auto && auto.checked) openCameraBarcodeScanner('inv_count');
      else { const s = document.getElementById('inv-search'); if (s) { s.value = ''; s.focus(); } }
    } else if (t.id === 'inv-search' && e.key === 'Enter') {
      e.preventDefault(); const it = invFindItem(t.value);
      if (it) { t.value = ''; invFocusItem(it.itemCode); } else if (invSearchResults[0]) invPickItem(0);
    }
  });
  document.addEventListener('change', e => {
    const t = e.target;
    if (t.id === 'inv-date' || t.id === 'inv-station' || t.id === 'inv-type') {
      invGrabFields();
      invSaveDraft();
      if (t.id === 'inv-date') invState.date = t.value || invToday();
      if (t.id === 'inv-station') invState.station = t.value;
      if (t.id === 'inv-type') invState.type = t.value;
      invLoadDraft(); invRenderMain();
    }
  });
  document.addEventListener('click', e => { if (!e.target.closest('.srch-wrap')) { const b = document.getElementById('inv-results'); if (b) b.style.display = 'none'; } });
})();
let invSearchResults = [];
function invSearch() {
  const q = (document.getElementById('inv-search') || {}).value || '';
  invSearchResults = invState.items.filter(i => { const p = invState.products[i.itemCode] || {}; return smartMatch(q, invItemName(i), i.itemCode, p.barcode, p.barcodeNumber, p.posCode, i.station); }).slice(0, 30);
  srchRender('inv-results', invSearchResults, i => `<b>${srchEsc(invItemName(i))}</b><br><small style="color:#64748b;">${srchEsc(i.itemCode)} · 📍 ${srchEsc(i.station)} · ${INV_TYPES[i.type] || ''}</small>`, 'invPickItem', 'Walang tugma. Puwedeng gamitin ang "➕ Item na wala sa listahan".');
}
function invPickItem(i) { const it = invSearchResults[i]; if (!it) return; const s = document.getElementById('inv-search'); if (s) s.value = ''; const b = document.getElementById('inv-results'); if (b) b.style.display = 'none'; invFocusItem(it.itemCode); }
function invFindItem(c) {
  const k = hubKey(c); if (!k) return null;
  return invState.items.find(i => { const p = invState.products[i.itemCode] || {}; return [i.itemCode, p.sapCode, p.barcode, p.barcodeNumber, p.posCode].some(x => x && hubKey(x) === k); }) || null;
}
function invFocusItem(code) {
  const it = invState.items.find(i => i.itemCode === code); if (!it) return;
  const _in = ((invState.stationItems || {})[invState.station] || []).includes(code);
  if (!_in || (invState.type && it.type !== invState.type)) { const st = invStationOf(code, invState.station); if (!st) { alert('Wala pa sa kahit anong station ang item na ito. Idagdag muna sa 📍 Station setup.'); return; } invGrabFields(); invSaveDraft(); invState.station = st; invState.type = ''; invLoadDraft(); invRenderMain(); }
  setTimeout(() => {
    const inp = document.querySelector(`input[data-invq="${CSS.escape(code)}"]`) || document.querySelector(`input[data-invw="${CSS.escape(code)}"]`);
    if (inp) { inp.scrollIntoView({ block: 'center', behavior: 'smooth' }); inp.focus(); inp.select(); const tr = inp.closest('tr'); if (tr) { tr.classList.add('inv-flash'); setTimeout(() => tr.classList.remove('inv-flash'), 1500); } }
  }, 60);
}
function invHandleScan(raw) {
  const it = invFindItem(raw);
  if (!it) { alert('⚠️ Walang item na may code/barcode na "' + String(raw).trim() + '" sa inventory list ng branch mo. Kung bago ito, gamitin ang "➕ Item na wala sa listahan".'); return; }
  invFocusItem(it.itemCode);
}
function invZeroBlanks() {
  invState.parts = invState.parts || {}; invStationItems().forEach(i => { if (invNum(invState.entries[i.itemCode]) === null) { invState.entries[i.itemCode] = '0'; if (invConv(i) > 1) invState.parts[i.itemCode] = { w: '0', l: '0' }; } });
  invSaveDraft(); invGrabFields(); invRenderMain();
}
async function invAddTempItem() {
  const name = (await uiPrompt('Pangalan ng item na wala sa listahan (hal. Bagong lalagyan, outside purchase):') || '').trim(); if (!name) return;
  const uom = (await uiPrompt('UOM (hal. pcs, kg, box):', 'pcs') || 'pcs').trim();
  const qty = invNum(await uiPrompt('Bilang:')); if (qty === null) { alert('Maglagay ng tamang bilang.'); return; }
  const code = 'TMP-' + invState.branchCode + '-' + (invSlug(name).toUpperCase().slice(0, 14) || Date.now());
  invState.temps.push({ code, name, uom, qty });
  invGrabFields(); invSaveDraft(); invRenderMain();
}
function invRemoveTemp(i) { invState.temps.splice(i, 1); invSaveDraft(); invRenderMain(); }

async function invRowsWithPhotos(rows) { await Promise.all(rows.map(async r => { r.photo = await invGetPhoto(r.code); })); return rows; }
function invCurrentRows() {
  return invStationItems().map(i => { const cv = invConv(i), pt = (invState.parts || {})[i.itemCode] || {}; return { code: i.itemCode, name: invItemName(i), uom: invUom(i), qty: invState.entries[i.itemCode], conv: cv, wuom: cv > 1 ? invWholeUom(i) : '', w: pt.w, l: pt.l }; });
}
async function printAllStationsBlank() {
  invGrabFields(); const keep = invState.station, keepType = invState.type; let html = '';
  try { invState.type = ''; for (const st of invStationNames()) { invState.station = st; let rows = invCurrentRows().map(r => ({ ...r, qty: '', w: '', l: '' })); if (!rows.length) continue; html += invSheetHtml({ station: st, branch: invState.branch, branchCode: invState.branchCode, company: invState.company, date: invState.date, rows, photos: false, split: rows.some(r => r.conv > 1), checkedBy: '', receivedBy: '', remarks: '' }); } } finally { invState.station = keep; invState.type = keepType; }
  if (!html) { alert('Walang laman ang mga station.'); return; } printHtmlDoc('Inventory — lahat ng station', html);
}
async function printInvSheet(withQty) {
  invGrabFields();
  let rows = invCurrentRows().map(r => ({ ...r, qty: withQty ? r.qty : '' }));
  if (withQty) invState.temps.forEach(t => rows.push({ code: t.code, name: t.name + ' (wala pang SAP)', uom: t.uom, qty: t.qty }));
  if (!rows.length) { alert('Walang item na ipi-print.'); return; }
  rows = await invRowsWithPhotos(rows);
  printHtmlDoc('Inventory ' + invState.station, invSheetHtml({ station: invState.station, branch: invState.branch, branchCode: invState.branchCode, company: invState.company, date: invState.date, type: invState.type ? INV_TYPES[invState.type] : '', rows, photos: true, split: rows.some(r => r.conv > 1), checkedBy: withQty ? invState.checkedBy : '', receivedBy: withQty ? invState.receivedBy : '', remarks: withQty ? invState.remarks : '' }));
}
function invCountCSV(c) {
  const rows = [['Inventory_ID', 'Item_Description', 'UOM', 'Qty', 'Branch_Code', 'Branch', 'Company', 'Station', 'Date', 'Checked_By', 'Received_Approved_By', 'Status']];
  (c.lines || []).forEach(l => rows.push([l.itemCode, l.itemName, l.uom, l.qty, c.branchCode, c.branch, c.company, c.station, c.countDate, c.checkedBy, c.approvedBy || c.receivedBy || '', c.status || '']));
  return rows.map(r => r.map(csvCell).join(',')).join('\r\n');
}
function exportInvCurrentCSV() {
  invGrabFields();
  const lines = invCurrentRows().filter(r => invNum(r.qty) !== null).map(r => ({ itemCode: r.code, itemName: r.name, uom: r.uom, qty: invNum(r.qty) }));
  invState.temps.forEach(t => lines.push({ itemCode: t.code, itemName: t.name, uom: t.uom, qty: t.qty }));
  if (!lines.length) { alert('Wala pang naka-encode na bilang.'); return; }
  downloadCSVFile(invCountCSV({ lines, branchCode: invState.branchCode, branch: invState.branch, company: invState.company, station: invState.station, countDate: invState.date, checkedBy: invState.checkedBy, receivedBy: invState.receivedBy, status: 'draft' }), `Inventory_${invState.branchCode}_${invState.date}_${invSlug(invState.station)}.csv`);
}
async function submitInventoryCount() {
  invGrabFields();
  const lines = [];
  invStationItems().forEach(i => { const q = invNum(invState.entries[i.itemCode]); if (q !== null) { const ln = { itemCode: i.itemCode, itemName: invItemName(i), uom: invUom(i), qty: q, type: i.type || '' }; const cv = invConv(i); if (cv > 1) { const pt = (invState.parts || {})[i.itemCode] || {}; ln.conv = cv; ln.wholeUom = invWholeUom(i); ln.whole = invNum(pt.w) || 0; ln.loose = invNum(pt.l) || 0; } lines.push(ln); } });
  invState.temps.forEach(t => lines.push({ itemCode: t.code, itemName: t.name, uom: t.uom, qty: invNum(t.qty), type: '', tmp: true }));
  if (!lines.length) { alert('Wala pang naka-encode na bilang.'); return; }
  if (!(invState.checkedBy || '').trim()) { alert('Ilagay kung sino ang nag-bilang (Checked by).'); return; }
  const uncounted = invStationItems().length - lines.filter(l => !l.tmp).length;
  if (uncounted > 0 && !await uiConfirm(`May ${uncounted} item sa station na ito na wala pang bilang. I-save pa rin? (Hindi sila isasama sa report.)`)) return;
  const id = `${invState.branchCode}-${invState.date.replace(/-/g, '')}-${invSlug(invState.station)}`;
  try {
    const ref = db.collection('inventory_counts').doc(id);
    const ex = await ref.get();
    if (ex.exists) {
      if ((ex.data().status || '') === 'approved') { alert('⚠️ Naka-approve na ang inventory ng station na ito sa petsang iyon. Makipag-ugnayan kay Admin para mabago.'); return; }
      if (!await uiConfirm('May na-save nang inventory para sa station at petsang ito. Papalitan ba?')) return;
    }
    const u = getCurrentUser() || {};
    await ref.set({ countId: id, branch: invState.branch, branchCode: invState.branchCode, company: invState.company, station: invState.station, countDate: invState.date, checkedBy: invState.checkedBy.trim(), checkedByEmail: u.email || '', receivedBy: (invState.receivedBy || '').trim(), remarks: invState.remarks || '', status: 'submitted', lines, uncounted, createdAt: firebase.firestore.FieldValue.serverTimestamp() });
    for (const t of invState.temps) {
      const rr = db.collection('inventory_item_requests').doc(t.code);
      if (!(await rr.get()).exists) await rr.set({ tmpCode: t.code, name: t.name, uom: t.uom, branch: invState.branch, branchCode: invState.branchCode, company: invState.company, status: 'pending', requestedBy: invWho(), firstSeenDate: invState.date, createdAt: firebase.firestore.FieldValue.serverTimestamp() });
    }
    try { await logSystemAction('INVENTORY_COUNT_SAVED', `${id}: ${lines.length} item, binilang ni ${invState.checkedBy}`); } catch (e) {}
    try { localStorage.removeItem(invDraftKey()); } catch (e) {}
    alert(`✅ Na-save ang inventory ng ${invState.station} (${invState.date}). ${lines.length} item.`);
    invState.entries = {}; invState.parts = {}; invState.temps = []; invState.receivedBy = ''; invState.remarks = '';
    invRenderMain(); invLoadHistory();
  } catch (e) { alert('Error sa pag-save: ' + e.message); }
}
async function invLoadHistory() {
  try {
    const snap = await db.collection('inventory_counts').where('branchCode', '==', invState.branchCode).get();
    invHistory = []; snap.forEach(d => { const x = { id: d.id, ...d.data() }; invHistory.push(x); invCountsCache[d.id] = x; });
    invHistory.sort((a, b) => String(b.countDate).localeCompare(String(a.countDate)));
    invRenderHistory();
  } catch (e) { console.warn(e); }
}
function invRenderHistory() {
  const tb = document.getElementById('inv-history-tbody'); if (!tb) return;
  tb.innerHTML = invHistory.length ? invHistory.map(c => invCountRowHtml(c, false)).join('') : '<tr><td colspan="7" style="text-align:center;color:#94a3b8;">Wala pang na-save na inventory.</td></tr>';
}
function invStatusBadge(c) { return c.status === 'approved' ? '<span class="badge badge-success">✔ Approved</span>' : '<span class="badge badge-warning">Submitted</span>'; }
function invCountRowHtml(c, admin) {
  const id = srchEsc(c.id);
  return `<tr><td>${srchEsc(c.countDate)}</td>${admin ? `<td><b>${srchEsc(c.branch)}</b><br><small>${srchEsc(c.branchCode)} · ${srchEsc(c.company)}</small></td>` : ''}<td>${srchEsc(c.station)}</td><td>${srchEsc(c.checkedBy)}</td><td>${srchEsc(c.approvedBy || c.receivedBy || '—')}</td><td>${(c.lines || []).length}</td><td>${invStatusBadge(c)}</td>
    <td style="white-space:nowrap;"><button class="btn btn-sm btn-secondary" onclick="viewInvCount('${id}')">👁️</button> <button class="btn btn-sm btn-secondary" onclick="printInvCount('${id}')">🖨️</button> <button class="btn btn-sm btn-secondary" onclick="exportInvCount('${id}')">⬇️</button>${admin && c.status !== 'approved' ? ` <button class="btn btn-sm btn-success" onclick="approveInvCount('${id}')">✔ Approve</button>` : ''}</td></tr>`;
}
function viewInvCount(id) {
  const c = invCountsCache[id]; if (!c) return;
  let ov = document.getElementById('inv-view-modal');
  if (!ov) { ov = document.createElement('div'); ov.id = 'inv-view-modal'; ov.className = 'modal-overlay'; ov.style.display = 'none'; ov.innerHTML = '<div class="modal-content" style="max-width:760px;max-height:90vh;overflow-y:auto;"><div id="inv-view-body"></div></div>'; document.body.appendChild(ov); }
  document.getElementById('inv-view-body').innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #e2e8f0;padding-bottom:0.5rem;margin-bottom:0.75rem;"><h3 style="margin:0;">📋 ${srchEsc(c.station)} — ${srchEsc(c.countDate)}</h3><button class="btn btn-secondary btn-sm" onclick="document.getElementById('inv-view-modal').style.display='none'">✕</button></div>
    <div style="font-size:0.85rem;color:#475569;margin-bottom:0.75rem;">Branch: <b>${srchEsc(c.branch)}</b> (${srchEsc(c.branchCode)}) · ${srchEsc(c.company)}<br>Binilang ni: <b>${srchEsc(c.checkedBy)}</b> · Tinanggap/Inaprubahan ni: <b>${srchEsc(c.approvedBy || c.receivedBy || '—')}</b>${c.approvedAt ? ' · ' + srchEsc(new Date(c.approvedAt.seconds ? c.approvedAt.seconds * 1000 : c.approvedAt).toLocaleString('en-PH')) : ''}<br>${invStatusBadge(c)} ${c.remarks ? '· ' + srchEsc(c.remarks) : ''}</div>
    <div class="table-responsive"><table><thead><tr><th>Inventory ID</th><th>Item</th><th>UOM</th><th>Bilang</th></tr></thead><tbody>${(c.lines || []).map(l => `<tr><td>${srchEsc(l.itemCode)}</td><td>${srchEsc(l.itemName)}${l.tmp ? ' <span class="badge badge-warning">Wala pang SAP</span>' : ''}</td><td>${srchEsc(l.uom)}</td><td><b>${srchEsc(l.qty)}</b></td></tr>`).join('')}</tbody></table></div>
    <div style="display:flex;gap:0.5rem;margin-top:1rem;"><button class="btn btn-primary" onclick="printInvCount('${srchEsc(id)}')">🖨️ Print</button><button class="btn btn-secondary" onclick="exportInvCount('${srchEsc(id)}')">⬇️ CSV</button></div>`;
  ov.style.display = 'flex';
}
async function printInvCount(id) {
  const c = invCountsCache[id]; if (!c) return;
  const rows = await invRowsWithPhotos((c.lines || []).map(l => ({ code: l.itemCode, name: l.itemName + (l.tmp ? ' (wala pang SAP)' : ''), uom: l.uom, qty: l.qty })));
  printHtmlDoc('Inventory ' + c.station, invSheetHtml({ station: c.station, branch: c.branch, branchCode: c.branchCode, company: c.company, date: c.countDate, rows, photos: true, checkedBy: c.checkedBy, receivedBy: c.approvedBy || c.receivedBy, remarks: c.remarks }));
}
function exportInvCount(id) { const c = invCountsCache[id]; if (c) downloadCSVFile(invCountCSV(c), `Inventory_${c.branchCode}_${c.countDate}_${invSlug(c.station)}.csv`); }

// ========================================================
// 🖥️ ADMIN: Branch Inventory (Setup, Mga Count, Lahat ng Branch, Variance, Requests)
// ========================================================
let invAdminItems = [], invPickedProd = null, invProdResults = [];
function invTab(name) {
  ['setup', 'counts', 'matrix', 'variance', 'requests'].forEach(t => {
    const el = document.getElementById('inv-tab-' + t); if (el) el.style.display = t === name ? 'block' : 'none';
    const b = document.getElementById('inv-tabbtn-' + t); if (b) b.className = 'btn btn-sm ' + (t === name ? 'btn-primary' : 'btn-secondary');
  });
  if (name === 'requests') invLoadRequests();
}
async function loadBranchInventoryAdmin() {
  const root = document.getElementById('inv-admin-root'); if (!root || !db) return;
  await invLoadMasters();
  if (!adminProductsList.length && typeof loadAdminProducts === 'function') await loadAdminProducts();
  if (!document.getElementById('inv-tab-setup')) {
    const to = new Date(); const from = new Date(Date.now() - 30 * 864e5);
    const iso = d => { const x = new Date(d); x.setMinutes(x.getMinutes() - x.getTimezoneOffset()); return x.toISOString().slice(0, 10); };
    root.innerHTML = `
    <div class="card" data-notools="1"><div class="card-title"><span>📋 Branch Inventory (Kitchen at Wares)</span>
      <div style="display:flex;gap:0.4rem;flex-wrap:wrap;">${[['setup', '⚙️ Setup'], ['counts', '🗂️ Mga Count'], ['matrix', '📊 Lahat ng Branch'], ['variance', '📉 Variance'], ['requests', '🆕 Request na Item']].map(([k, l]) => `<button id="inv-tabbtn-${k}" class="btn btn-sm btn-secondary" onclick="invTab('${k}')">${l}</button>`).join('')}</div></div>
      <p style="font-size:0.85rem;color:#64748b;margin:0;">Ang Inventory ID ay ang SAP/subcode ng item. Ang listahan ng items ay nakadepende sa <b>Company</b> ng branch (hal. KNGK, Tanoshi).</p></div>

    <div id="inv-tab-setup">
      <div class="card" data-notools="1"><div class="card-title"><span>🏪 Branch → Code at Company</span><button class="btn btn-secondary btn-sm" onclick="invLoadBranchSetup()">🔄 Refresh</button></div>
        <input type="search" placeholder="🔍 Hanapin ang branch..." oninput="crudFilter(this)" style="width:100%;margin-bottom:.5rem;"><div class="table-responsive"><table><thead><tr><th>Branch</th><th>Branch Code</th><th>Company</th><th>Aksyon</th></tr></thead><tbody id="inv-branches-tbody"></tbody></table></div>
        <small style="color:#64748b;">Kukunin ang listahan ng branch sa mga user na may role na Branch. Idagdag ang bagong Company sa ibaba (sa "Company" na dropdown, mag-type ng bago at i-click ang ➕ Idagdag).</small></div>
      <div class="card" data-notools="1"><div class="card-title"><span>📦 Listahan ng Inventory Items ng Company</span>
        <div style="display:flex;gap:0.4rem;flex-wrap:wrap;"><button class="btn btn-secondary btn-sm" onclick="invBomOpen('company')">🧪 Prepared / BOM</button><button class="btn btn-secondary btn-sm" onclick="invBomBranchPick()">🏪 BOM ng Branch</button><button class="btn btn-secondary btn-sm" onclick="invSapPullOpen()">📒 Kunin mula SAP (Wares)</button><button class="btn btn-secondary btn-sm" onclick="downloadInvItemsTemplate()">📄 Template</button><button class="btn btn-secondary btn-sm" onclick="importInvItemsCSV()">⬆️ Import CSV</button><button class="btn btn-secondary btn-sm" onclick="exportInvItemsCSV()">⬇️ CSV</button><button class="btn btn-secondary btn-sm" onclick="printCardTable(this)">🖨️ Print</button></div></div>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:0.75rem;margin-bottom:0.75rem;align-items:end;">
          <div class="form-group" style="margin:0;"><label>🏢 Company</label><select id="inv-company-sel" onchange="invLoadCompanyItems()"><option value="">-- Company --</option></select></div>
          <div class="form-group" style="margin:0;"><label>🔎 Item (mula sa Product Master)</label><div class="srch-wrap"><input type="text" id="inv-prod-search" autocomplete="off" placeholder="Pangalan / code / barcode" oninput="invProdSearch()" onfocus="invProdSearch()"><div id="inv-prod-results" class="srch-results"></div></div></div>
          <div class="form-group" style="margin:0;"><label>Uri</label><select id="inv-setup-type" data-nosearch="1"><option value="kitchen">🍳 Kitchen</option><option value="wares">🥢 Wares</option></select></div>
          <div class="form-group" style="margin:0;"><label>📍 Station ng Branch</label><select id="inv-setup-station"><option value="">-- Station --</option></select></div>
          <button class="btn btn-success" onclick="invAddCompanyItem()">➕ Idagdag sa Listahan</button>
        </div>
        <div class="table-responsive"><table><thead><tr><th>Inventory ID</th><th>Item</th><th>Uri</th><th>Station</th><th>Count UOM</th><th>Aksyon</th></tr></thead><tbody id="inv-items-tbody"><tr><td colspan="6" style="text-align:center;color:#94a3b8;">Pumili ng Company.</td></tr></tbody></table></div></div>
    </div>

    <div id="inv-tab-counts" style="display:none;">
      <div class="card" data-notools="1"><div class="card-title"><span>🗂️ Mga Na-submit na Inventory (lahat ng branch)</span><div style="display:flex;gap:0.4rem;"><button class="btn btn-secondary btn-sm" onclick="printCardTable(this)">🖨️ Print</button><button class="btn btn-secondary btn-sm" onclick="exportCardTable(this)">⬇️ CSV</button></div></div>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:0.75rem;margin-bottom:0.75rem;align-items:end;">
          <div class="form-group" style="margin:0;"><label>Mula</label><input type="date" id="inv-rep-from" value="${iso(from)}"></div>
          <div class="form-group" style="margin:0;"><label>Hanggang</label><input type="date" id="inv-rep-to" value="${iso(to)}"></div>
          <div class="form-group" style="margin:0;"><label>Branch</label><select id="inv-rep-branch" data-searchable="1"><option value="">Lahat ng Branch</option></select></div>
          <button class="btn btn-primary" onclick="invLoadCounts()">🔎 I-load</button></div>
        <div class="table-responsive"><table><thead><tr><th>Petsa</th><th>Branch</th><th>Station</th><th>Binilang ni</th><th>Pumirma / Approved</th><th>Items</th><th>Status</th><th>Aksyon</th></tr></thead><tbody id="inv-counts-tbody"><tr><td colspan="8" style="text-align:center;color:#94a3b8;">I-click ang I-load.</td></tr></tbody></table></div></div>
    </div>

    <div id="inv-tab-matrix" style="display:none;">
      <div class="card" data-notools="1"><div class="card-title"><span>📊 Inventory ng Lahat ng Branch (pila-pila ayon sa Item Code)</span><div style="display:flex;gap:0.4rem;"><button class="btn btn-secondary btn-sm" onclick="printCardTable(this)">🖨️ Print</button><button class="btn btn-secondary btn-sm" onclick="exportCardTable(this)">⬇️ CSV</button></div></div>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:0.75rem;margin-bottom:0.75rem;align-items:end;">
          <div class="form-group" style="margin:0;"><label>🏢 Company</label><select id="inv-mx-company"><option value="">-- Company --</option></select></div>
          <div class="form-group" style="margin:0;"><label>Hanggang petsa (as of)</label><input type="date" id="inv-mx-date" value="${iso(to)}"></div>
          <div class="form-group" style="margin:0;"><label>Uri</label><select id="inv-mx-type" data-nosearch="1"><option value="">Lahat</option><option value="kitchen">🍳 Kitchen</option><option value="wares">🥢 Wares</option></select></div>
          <button class="btn btn-primary" onclick="invLoadMatrix()">🔎 I-load</button></div>
        <div class="table-responsive"><table id="inv-mx-table"><thead><tr><th>Inventory ID</th><th>Item</th></tr></thead><tbody><tr><td colspan="2" style="text-align:center;color:#94a3b8;">Pumili ng Company at i-load.</td></tr></tbody></table></div>
        <small style="color:#64748b;">Ipinapakita ang pinakahuling bilang ng bawat branch hanggang sa napiling petsa. Ang "—" ay ibig sabihing wala pang bilang.</small></div>
    </div>

    <div id="inv-tab-variance" style="display:none;">
      <div class="card" data-notools="1"><div class="card-title"><span>📉 Variance: Pagkakaiba ng Inventory sa Pagitan ng Dalawang Petsa</span><div style="display:flex;gap:0.4rem;"><button class="btn btn-secondary btn-sm" onclick="printCardTable(this)">🖨️ Print</button><button class="btn btn-secondary btn-sm" onclick="exportCardTable(this)">⬇️ CSV</button></div></div>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:0.75rem;margin-bottom:0.75rem;align-items:end;">
          <div class="form-group" style="margin:0;"><label>Branch</label><select id="inv-var-branch" data-searchable="1"><option value="">-- Branch --</option></select></div>
          <div class="form-group" style="margin:0;"><label>Petsa A (simula)</label><input type="date" id="inv-var-a" value="${iso(from)}"></div>
          <div class="form-group" style="margin:0;"><label>Petsa B (katapusan)</label><input type="date" id="inv-var-b" value="${iso(to)}"></div>
          <div class="form-group" style="margin:0;"><label>Station</label><select id="inv-var-station" data-searchable="1"><option value="">Lahat ng Station</option></select></div>
          <button class="btn btn-primary" onclick="invLoadVariance()">🔎 Kalkulahin</button></div>
        <div class="table-responsive"><table><thead><tr><th>Inventory ID</th><th>Item</th><th>UOM</th><th>Station</th><th>Bilang A</th><th>Bilang B</th><th>Pagbabago</th></tr></thead><tbody id="inv-var-tbody"><tr><td colspan="7" style="text-align:center;color:#94a3b8;">Pumili ng branch at dalawang petsa.</td></tr></tbody></table></div>
        <small style="color:#64748b;">Ito ang pagkakaiba ng mga bilang (B − A). Hindi pa kasama rito ang mga idineliver sa branch sa pagitan ng dalawang petsa, kaya ang negatibo ay maaaring nagamit, naubos, o nawala.</small></div>
    </div>

    <div id="inv-tab-requests" style="display:none;">
      <div class="card" data-notools="1"><div class="card-title"><span>🆕 Mga Item na Wala pang SAP Code (galing sa branch)</span><button class="btn btn-secondary btn-sm" onclick="invLoadRequests()">🔄 Refresh</button></div>
        <div class="table-responsive"><table><thead><tr><th>Temp Code</th><th>Item</th><th>UOM</th><th>Branch</th><th>Petsa</th><th>Status</th><th>Aksyon</th></tr></thead><tbody id="inv-req-tbody"></tbody></table></div></div>
    </div>`;
    invTab('setup');
  }
  invRefreshAdminSelects();
  invLoadBranchSetup();
}
function invRefreshAdminSelects() {
  invFill('inv-company-sel', invCompaniesList, '-- Company --', '🏢'); invFill('inv-mx-company', invCompaniesList, '-- Company --', '🏢');
  invFill('inv-setup-station', invStationsList, '-- Station --', '📍'); invFill('inv-var-station', invStationsList, 'Lahat ng Station', '📍');
  const brs = Object.values(invBranchMap).map(b => b.branch).filter(Boolean).sort();
  invFill('inv-rep-branch', brs, 'Lahat ng Branch', '🏪'); invFill('inv-var-branch', brs, '-- Branch --', '🏪');
}
async function invLoadBranchSetup() {
  const tb = document.getElementById('inv-branches-tbody'); if (!tb) return;
  const names = new Set(Object.values(invBranchMap).map(b => b.branch));
  try { (await db.collection('users').get()).forEach(d => { const x = d.data(); if (normalizeRole(x.role) === 'branch' && x.branch) names.add(x.branch); }); } catch (e) {}
  const opts = c => '<option value="">-- Company --</option>' + invCompaniesList.map(n => `<option value="${srchEsc(n)}" ${n === c ? 'selected' : ''}>${srchEsc(n)}</option>`).join('');
  const list = [...names].filter(Boolean).sort();
  tb.innerHTML = list.length ? list.map(n => { const k = invSlug(n), b = invBranchMap[k] || {}; return `<tr><td><b>${srchEsc(n)}</b></td><td><input type="text" id="invbr-code-${srchEsc(k)}" value="${srchEsc(b.code || '')}" placeholder="Hal: BR01" style="width:110px;"></td><td><select id="invbr-co-${srchEsc(k)}">${opts(b.company)}</select></td><td><button class="btn btn-sm btn-success" onclick="invSaveBranchRow('${srchEsc(k)}','${srchEsc(n).replace(/'/g, '&#39;')}')">💾</button></td></tr>`; }).join('') : '<tr><td colspan="4" style="text-align:center;color:#94a3b8;">Wala pang branch user.</td></tr>';
}
async function invSaveBranchRow(key, name) {
  const code = (document.getElementById('invbr-code-' + key) || {}).value.trim().toUpperCase();
  const company = (document.getElementById('invbr-co-' + key) || {}).value;
  if (!code || !company) { alert('Ilagay ang Branch Code at piliin ang Company.'); return; }
  try {
    await db.collection('inventory_branches').doc(key).set({ branch: name, code, company, updatedAt: firebase.firestore.FieldValue.serverTimestamp() });
    invBranchMap[key] = { branch: name, code, company }; invRefreshAdminSelects();
    alert(`✅ Na-save: ${name} → ${code} (${company})`);
  } catch (e) { alert('Error: ' + e.message); }
}
function invProdSearch() {
  const q = (document.getElementById('inv-prod-search') || {}).value || '';
  invPickedProd = null;
  invProdResults = (adminProductsList || []).filter(p => smartMatch(q, p.itemName, p.itemCode, p.sapCode, p.barcode, p.barcodeNumber, p.posCode)).slice(0, 30);
  srchRender('inv-prod-results', invProdResults, p => `<b>${srchEsc(p.itemName)}</b><br><small style="color:#64748b;">${srchEsc(p.sapCode || p.itemCode || p.id)}${p.barcode ? ' · ' + srchEsc(p.barcode) : ''}</small>`, 'invPickProd', 'Walang tugmang produkto.');
}
function invPickProd(i) { const p = invProdResults[i]; if (!p) return; invPickedProd = p; document.getElementById('inv-prod-search').value = p.itemName; document.getElementById('inv-prod-results').style.display = 'none'; }
async function invLoadCompanyItems() {
  const tb = document.getElementById('inv-items-tbody'); if (!tb) return;
  const company = (document.getElementById('inv-company-sel') || {}).value;
  if (!company) { tb.innerHTML = '<tr><td colspan="6" style="text-align:center;color:#94a3b8;">Pumili ng Company.</td></tr>'; return; }
  const snap = await db.collection('inventory_items').where('company', '==', company).get();
  invAdminItems = []; snap.forEach(d => invAdminItems.push({ id: d.id, ...d.data() }));
  invAdminItems.sort((a, b) => String(a.station).localeCompare(String(b.station)) || String(a.itemName).localeCompare(String(b.itemName)));
  const stOpts = cur => invStationsList.concat(invStationsList.includes(cur) ? [] : [cur]).filter(Boolean).map(s => `<option value="${srchEsc(s)}" ${s === cur ? 'selected' : ''}>${srchEsc(s)}</option>`).join('');
  tb.innerHTML = invAdminItems.length ? invAdminItems.map(i => `<tr><td>${srchEsc(i.itemCode)}</td><td>${srchEsc(i.itemName)}</td>
    <td><select onchange="invUpdateItem('${srchEsc(i.id)}','type',this.value)"><option value="kitchen" ${i.type === 'kitchen' ? 'selected' : ''}>🍳 Kitchen</option><option value="wares" ${i.type === 'wares' ? 'selected' : ''}>🥢 Wares</option></select></td>
    <td><select onchange="invUpdateItem('${srchEsc(i.id)}','station',this.value)">${stOpts(i.station)}</select></td>
    <td><input type="text" value="${srchEsc(i.countUOM || '')}" style="width:80px;" onchange="invUpdateItem('${srchEsc(i.id)}','countUOM',this.value)"></td>
    <td><button class="btn btn-sm btn-danger" onclick="invDeleteItem('${srchEsc(i.id)}')">🗑️</button></td></tr>`).join('') : '<tr><td colspan="6" style="text-align:center;color:#94a3b8;">Wala pang item ang company na ito.</td></tr>';
}
async function invAddCompanyItem() {
  const company = (document.getElementById('inv-company-sel') || {}).value;
  const station = (document.getElementById('inv-setup-station') || {}).value;
  const type = (document.getElementById('inv-setup-type') || {}).value || 'kitchen';
  if (!company) { alert('Pumili ng Company.'); return; }
  if (!invPickedProd) { alert('Pumili ng item mula sa listahan ng search.'); return; }
  if (!productForCompany(invPickedProd, company) && !await uiConfirm(`Ang produktong ito ay naka-tag lang sa: ${productCompanies(invPickedProd).join(', ')}. Idagdag pa rin sa ${company}?`)) return;
  if (!station) { alert('Pumili ng Station.'); return; }
  const p = invPickedProd, code = p.sapCode || p.itemCode || p.id;
  try {
    await db.collection('inventory_items').doc(`${company}__${code}`).set({ company, itemCode: code, itemName: p.itemName, type, station, countUOM: p.looseUOM || p.wholeUOM || 'Pcs', updatedAt: firebase.firestore.FieldValue.serverTimestamp() }, { merge: true });
    invPickedProd = null; document.getElementById('inv-prod-search').value = '';
    invLoadCompanyItems();
  } catch (e) { alert('Error: ' + e.message); }
}
async function invUpdateItem(id, field, val) { try { await db.collection('inventory_items').doc(id).update({ [field]: val }); } catch (e) { alert('Error: ' + e.message); } }
async function invDeleteItem(id) { if (!await uiConfirm('Alisin ang item na ito sa listahan ng company?')) return; await db.collection('inventory_items').doc(id).delete(); invLoadCompanyItems(); }
function downloadInvItemsTemplate() { downloadCSVFile('Company,Item_Code,Type,Station,UOM\r\nKNGK,SAP-001,kitchen,Cold Storage,kg\r\nKNGK,SAP-050,wares,Sushi Station,pcs\r\n', 'Inventory_Items_Template.csv'); }
function exportInvItemsCSV() {
  if (!invAdminItems.length) { alert('Walang item na i-e-export. Pumili muna ng Company.'); return; }
  downloadCSVFile(['Company,Item_Code,Type,Station,UOM'].concat(invAdminItems.map(i => [i.company, i.itemCode, i.type, i.station, i.countUOM || ''].map(csvCell).join(','))).join('\r\n'), 'Inventory_Items.csv');
}
async function importInvItemsCSV() {
  const text = await pickCSVFile(); if (!text) return;
  const rows = csvToObjects(text); if (!rows.length) { alert('Walang laman o mali ang CSV.'); return; }
  if (!adminProductsList.length) await loadAdminProducts();
  const byCode = {}; adminProductsList.forEach(p => { byCode[hubKey(p.sapCode)] = p; byCode[hubKey(p.itemCode || p.id)] = p; });
  let ok = 0; const bad = [];
  let batch = db.batch(), n = 0;
  const newCo = new Set(), newSt = new Set();
  for (const [i, r] of rows.entries()) {
    const p = byCode[hubKey(r.item_code)]; const company = (r.company || '').trim(); const station = (r.station || '').trim();
    if (!p || !company || !station) { bad.push(`Row ${i + 2}: ${!p ? 'walang produktong ' + r.item_code : 'kulang ang Company/Station'}`); continue; }
    const code = p.sapCode || p.itemCode || p.id;
    batch.set(db.collection('inventory_items').doc(`${company}__${code}`), { company, itemCode: code, itemName: p.itemName, type: /ware/i.test(r.type) ? 'wares' : 'kitchen', station, countUOM: r.uom || p.looseUOM || p.wholeUOM || 'Pcs', updatedAt: firebase.firestore.FieldValue.serverTimestamp() }, { merge: true });
    newCo.add(company); newSt.add(station); ok++;
    if (++n % 400 === 0) { await batch.commit(); batch = db.batch(); }
  }
  try {
    await batch.commit();
    for (const c of newCo) if (!invCompaniesList.includes(c)) await addMasterEntry('companies', c);
    for (const s of newSt) if (!invStationsList.includes(s)) await addMasterEntry('inv_stations', s);
    await logSystemAction('INV_ITEMS_IMPORTED', `Nag-import ng ${ok} inventory item`);
    alert(`✅ Na-import ang ${ok} item.` + (bad.length ? `\n\n⚠️ ${bad.length} row ang nilaktawan:\n` + bad.slice(0, 8).join('\n') : ''));
    await invLoadMasters(); invRefreshAdminSelects(); invLoadCompanyItems();
  } catch (e) { alert('Error: ' + e.message); }
}
async function invLoadCounts() {
  const tb = document.getElementById('inv-counts-tbody'); if (!tb) return;
  const from = document.getElementById('inv-rep-from').value, to = document.getElementById('inv-rep-to').value, br = document.getElementById('inv-rep-branch').value;
  tb.innerHTML = '<tr><td colspan="8" style="text-align:center;">Kinukuha...</td></tr>';
  try {
    const snap = await db.collection('inventory_counts').where('countDate', '>=', from).where('countDate', '<=', to).get();
    const list = []; snap.forEach(d => { const x = { id: d.id, ...d.data() }; invCountsCache[d.id] = x; if (!br || x.branch === br) list.push(x); });
    list.sort((a, b) => String(b.countDate).localeCompare(String(a.countDate)) || String(a.branch).localeCompare(String(b.branch)));
    tb.innerHTML = list.length ? list.map(c => invCountRowHtml(c, true)).join('') : '<tr><td colspan="8" style="text-align:center;color:#94a3b8;">Walang inventory sa napiling petsa.</td></tr>';
  } catch (e) { tb.innerHTML = `<tr><td colspan="8">Error: ${srchEsc(e.message)}</td></tr>`; }
}
async function approveInvCount(id) {
  const c = invCountsCache[id]; if (!c) return;
  if (!await uiConfirm(`I-approve at i-receive ang inventory ng ${c.branch} — ${c.station} (${c.countDate})? Pagkatapos nito, hindi na ito mababago ng branch.`)) return;
  try {
    const u = getCurrentUser() || {};
    await db.collection('inventory_counts').doc(id).update({ status: 'approved', approvedBy: u.name || u.email || 'Admin', approvedByEmail: u.email || '', approvedAt: firebase.firestore.FieldValue.serverTimestamp() });
    c.status = 'approved'; c.approvedBy = u.name || u.email; c.approvedAt = new Date().toISOString();
    try { await logSystemAction('INVENTORY_APPROVED', `${id} na-approve ni ${u.email}`); } catch (e) {}
    invLoadCounts();
  } catch (e) { alert('Error: ' + e.message); }
}
// pinakahuling bilang ng item sa branch hanggang sa isang petsa
function invLatestQty(sortedDesc, code, date, station) {
  for (const c of sortedDesc) { if (c.countDate > date) continue; if (station && c.station !== station) continue; const l = (c.lines || []).find(x => x.itemCode === code && x.qty != null); if (l) return { qty: l.qty, date: c.countDate }; }
  return null;
}
async function invLoadMatrix() {
  const company = document.getElementById('inv-mx-company').value, date = document.getElementById('inv-mx-date').value, type = document.getElementById('inv-mx-type').value;
  const tbl = document.getElementById('inv-mx-table');
  if (!company) { alert('Pumili ng Company.'); return; }
  const branches = Object.values(invBranchMap).filter(b => b.company === company).sort((a, b) => String(a.code).localeCompare(String(b.code)));
  if (!branches.length) { alert('Walang branch na naka-set sa company na ito (Setup → Branch → Code at Company).'); return; }
  const [iSnap, cSnap] = await Promise.all([db.collection('inventory_items').where('company', '==', company).get(), db.collection('inventory_counts').where('countDate', '<=', date).get()]);
  const items = []; iSnap.forEach(d => { const x = d.data(); if (!type || x.type === type) items.push(x); });
  items.sort((a, b) => String(a.station).localeCompare(String(b.station)) || String(a.itemName).localeCompare(String(b.itemName)));
  const byBr = {}; cSnap.forEach(d => { const x = d.data(); (byBr[x.branchCode] = byBr[x.branchCode] || []).push(x); });
  Object.values(byBr).forEach(a => a.sort((x, y) => String(y.countDate).localeCompare(String(x.countDate))));
  tbl.innerHTML = `<thead><tr><th>Inventory ID</th><th>Item</th><th>Uri</th><th>Station</th>${branches.map(b => `<th>${srchEsc(b.code)}<br><small>${srchEsc(b.branch)}</small></th>`).join('')}</tr></thead><tbody>${items.map(it => `<tr><td>${srchEsc(it.itemCode)}</td><td>${srchEsc(it.itemName)}</td><td>${INV_TYPES[it.type] || ''}</td><td>${srchEsc(it.station)}</td>${branches.map(b => { const r = invLatestQty(byBr[b.code] || [], it.itemCode, date); return `<td title="${r ? 'Bilang noong ' + srchEsc(r.date) : ''}">${r ? '<b>' + srchEsc(r.qty) + '</b>' : '—'}</td>`; }).join('')}</tr>`).join('') || `<tr><td colspan="${4 + branches.length}" style="text-align:center;color:#94a3b8;">Walang item.</td></tr>`}</tbody>`;
}
async function invLoadVariance() {
  const brName = document.getElementById('inv-var-branch').value, a = document.getElementById('inv-var-a').value, b = document.getElementById('inv-var-b').value, st = document.getElementById('inv-var-station').value;
  const tb = document.getElementById('inv-var-tbody');
  if (!brName || !a || !b) { alert('Pumili ng Branch at dalawang petsa.'); return; }
  if (a > b) { alert('Dapat mas maaga ang Petsa A kaysa Petsa B.'); return; }
  const br = Object.values(invBranchMap).find(x => x.branch === brName); if (!br) return;
  const snap = await db.collection('inventory_counts').where('branchCode', '==', br.code).get();
  const counts = []; snap.forEach(d => counts.push(d.data()));
  counts.sort((x, y) => String(y.countDate).localeCompare(String(x.countDate)));
  const meta = {};
  counts.forEach(c => (c.lines || []).forEach(l => { if (!meta[l.itemCode]) meta[l.itemCode] = { name: l.itemName, uom: l.uom, station: c.station }; }));
  const rows = Object.keys(meta).map(code => {
    const m = meta[code]; if (st && m.station !== st) return null;
    const A = invLatestQty(counts, code, a, st), B = invLatestQty(counts, code, b, st);
    return { code, ...m, A, B, diff: (A && B) ? B.qty - A.qty : null };
  }).filter(Boolean).sort((x, y) => (x.diff == null) - (y.diff == null) || (x.diff || 0) - (y.diff || 0));
  tb.innerHTML = rows.length ? rows.map(r => `<tr><td>${srchEsc(r.code)}</td><td>${srchEsc(r.name)}</td><td>${srchEsc(r.uom)}</td><td>${srchEsc(r.station)}</td><td>${r.A ? srchEsc(r.A.qty) + ` <small style="color:#94a3b8;">(${srchEsc(r.A.date)})</small>` : '—'}</td><td>${r.B ? srchEsc(r.B.qty) + ` <small style="color:#94a3b8;">(${srchEsc(r.B.date)})</small>` : '—'}</td><td style="font-weight:800;color:${r.diff == null ? '#94a3b8' : r.diff < 0 ? '#dc2626' : r.diff > 0 ? '#059669' : '#475569'};">${r.diff == null ? '—' : (r.diff > 0 ? '+' : '') + +r.diff.toFixed(4)}</td></tr>`).join('') : '<tr><td colspan="7" style="text-align:center;color:#94a3b8;">Walang bilang sa branch na ito.</td></tr>';
}
async function invLoadRequests() {
  const tb = document.getElementById('inv-req-tbody'); if (!tb) return;
  try {
    const snap = await db.collection('inventory_item_requests').get();
    const list = []; snap.forEach(d => list.push({ id: d.id, ...d.data() }));
    list.sort((a, b) => (a.status === 'pending' ? 0 : 1) - (b.status === 'pending' ? 0 : 1));
    tb.innerHTML = list.length ? list.map(r => `<tr><td>${srchEsc(r.tmpCode)}</td><td><b>${srchEsc(r.name)}</b></td><td>${srchEsc(r.uom)}</td><td>${srchEsc(r.branch)}<br><small>${srchEsc(r.branchCode)} · ${srchEsc(r.company)}</small></td><td>${srchEsc(r.firstSeenDate)}</td><td>${r.status === 'done' ? `<span class="badge badge-success">SAP: ${srchEsc(r.sapCode)}</span>` : '<span class="badge badge-warning">Pending</span>'}</td><td style="white-space:nowrap;">${r.status === 'done' ? '' : `<button class="btn btn-sm btn-primary" onclick="invRequestOpenProduct('${srchEsc(r.id)}')">➕ Gumawa ng Product</button> <button class="btn btn-sm btn-success" onclick="invRequestDone('${srchEsc(r.id)}')">✔ Tapos na (SAP code)</button>`}</td></tr>`).join('') : '<tr><td colspan="7" style="text-align:center;color:#94a3b8;">Walang request.</td></tr>';
    invLoadRequests.list = list;
  } catch (e) { tb.innerHTML = `<tr><td colspan="7">Error: ${srchEsc(e.message)}</td></tr>`; }
}
async function invRequestOpenProduct(id) {
  const r = (invLoadRequests.list || []).find(x => x.id === id); if (!r) return;
  await openAdminProductModal(); const n = document.getElementById('admin-item-name'); if (n) n.value = r.name;
}
async function invRequestDone(id) {
  const r = (invLoadRequests.list || []).find(x => x.id === id); if (!r) return;
  const code = (await uiPrompt(`SAP code na ibinigay para sa "${r.name}":`) || '').trim(); if (!code) return;
  try {
    await db.collection('inventory_item_requests').doc(id).update({ status: 'done', sapCode: code, doneAt: firebase.firestore.FieldValue.serverTimestamp() });
    await db.collection('inventory_items').doc(`${r.company}__${code}`).set({ company: r.company, itemCode: code, itemName: r.name, type: 'wares', station: invStationsList[0] || 'Unassigned', countUOM: r.uom || 'Pcs', updatedAt: firebase.firestore.FieldValue.serverTimestamp() }, { merge: true });
    alert('✅ Naka-link na. Naidagdag ito sa inventory list ng company (Wares, unang station). Baguhin sa Setup kung kailangan. Mananatili sa mga nakaraang count ang temp code.');
    invLoadRequests();
  } catch (e) { alert('Error: ' + e.message); }
}

// ---- Hook ng larawan sa product forms ----
(function invHookPhotoForms() {
  const wrap = (name, inputId, previewId, codeId) => {
    const orig = window[name]; if (typeof orig !== 'function') return;
    window[name] = async function (id) {
      const r = await orig.apply(this, arguments);
      const f = document.getElementById(inputId); if (f) f.value = '';
      const pv = document.getElementById(previewId); if (pv) { pv.style.display = 'none'; pv.removeAttribute('src'); }
      if (id) invLoadPhotoPreview(id, previewId);
      return r;
    };
  };
  wrap('openAdminProductModal', 'admin-item-photo', 'admin-item-photo-preview');
  wrap('openCommissaryProductModal', 'new-item-photo', 'new-item-photo-preview');
})();


// ========================================================
// 🏢 COMPANY MANAGEMENT (KNGK, Tanoshi, atbp.) at ang relasyon ng Company sa Produkto at Branch
// Ang produkto ay puwedeng i-tag sa isa o higit pang company. Walang tag = gamit ng LAHAT ng company.
// Ang branch ay nakatali sa Company (Admin → Branch Inventory → Setup). Ang catalog ng branch ay ayon sa company niya.
// ========================================================
let companyDocs = [];
function empCompanyList(e) {
  if (e && Array.isArray(e.companies) && e.companies.length) return e.companies.filter(Boolean);
  return String((e && e.company) || '').split(/[,\/]/).map(x => x.trim()).filter(Boolean);
}
function productCompanies(p) { return Array.isArray(p && p.companies) ? p.companies.filter(Boolean) : []; }
function productForCompany(p, company) {
  const t = productCompanies(p);
  return !company || !t.length || t.some(c => hubKey(c) === hubKey(company));
}
function companyChipsHtml(p) {
  const t = productCompanies(p);
  return t.length ? '<div style="margin-top:3px;">' + t.map(c => `<span class="co-chip">🏢 ${srchEsc(c)}</span>`).join('') + '</div>' : '<div style="margin-top:3px;"><span class="co-chip co-all">Lahat ng company</span></div>';
}
async function renderCompanyChecks(containerId, selected) {
  const el = document.getElementById(containerId); if (!el) return;
  let names = [];
  try { (await db.collection('companies').get()).forEach(d => names.push(d.data().name || d.id)); } catch (e) {}
  names = [...new Set(names.concat(selected || []))].sort((a, b) => a.localeCompare(b));
  if (!names.length) { el.innerHTML = '<small style="color:#94a3b8;">Wala pang Company. Idagdag sa Admin → Company Management.</small>'; return; }
  const sel = new Set((selected || []).map(hubKey));
  el.innerHTML = names.map(n => `<label class="co-check"><input type="checkbox" value="${srchEsc(n)}" ${sel.has(hubKey(n)) ? 'checked' : ''}> ${srchEsc(n)}</label>`).join('');
}
function readCompanyChecks(containerId) {
  const el = document.getElementById(containerId); if (!el) return undefined;
  return [...el.querySelectorAll('input[type=checkbox]:checked')].map(i => i.value);
}
(function hookCompanyChecks() {
  const wrap = (name, containerId, finder) => {
    const orig = window[name]; if (typeof orig !== 'function') return;
    window[name] = async function (id) {
      const r = await orig.apply(this, arguments);
      const p = id ? finder(id) : null;
      renderCompanyChecks(containerId, p ? productCompanies(p) : []);
      return r;
    };
  };
  wrap('openAdminProductModal', 'admin-item-companies', id => (adminProductsList || []).find(p => p.id === id));
  wrap('openCommissaryProductModal', 'new-item-companies', id => (typeof currentInventory !== 'undefined' ? currentInventory : []).find(p => p.id === id));
})();

// ================= Company → Branch → Station → Empleyado (istruktura) =================
async function hrFillBranches(selected) {
  const sel = document.getElementById('hr-emp-branch'); if (!sel) return;
  try { if (!window.__hrBranches) { window.__hrBranches = []; (await db.collection('inventory_branches').get()).forEach(d => window.__hrBranches.push(d.data())); window.__hrBranches.sort((a, b) => String(a.company || '').localeCompare(String(b.company || '')) || String(a.branch).localeCompare(String(b.branch))); } } catch (e) {}
  sel.innerHTML = '<option value="">(Walang branch / Head Office)</option>' + (window.__hrBranches || []).map(b => `<option value="${srchEsc(b.code || b.branch)}" data-name="${srchEsc(b.branch || '')}" ${String(b.code || b.branch) === String(selected) ? 'selected' : ''}>${srchEsc(b.company || '?')} — ${srchEsc(b.code || '')} ${srchEsc(b.branch || '')}</option>`).join('');
}
async function companyTreeOpen() {
  arModal('<div style="padding:1rem;">⏳ Binubuo ang istruktura...</div>');
  try {
    const [cS, bS, mS, iS, eS] = await Promise.all([db.collection('companies').get(), db.collection('inventory_branches').get(), db.collection('inventory_station_map').get(), db.collection('inventory_items').get(), db.collection('employees').get()]);
    const cos = [], brs = [], maps = {}, items = [], emps = []; cS.forEach(d => cos.push({ id: d.id, ...d.data() })); bS.forEach(d => brs.push(d.data())); mS.forEach(d => maps[d.id] = d.data()); iS.forEach(d => items.push(d.data())); eS.forEach(d => emps.push({ id: d.id, ...d.data() }));
    cos.sort((a, b) => String(a.name).localeCompare(String(b.name)));
    const empName = e => e.name || [e.fname, e.lname].filter(Boolean).join(' ') || e.email || e.id;
    const empCos = e => (Array.isArray(e.companies) && e.companies.length ? e.companies : String(e.company || '').split(',')).map(x => String(x).trim()).filter(Boolean);
    const stationsOf = b => { const m = maps[invSlug(b.code || b.branch)]; if (m && m.stations) return Object.keys(m.stations).sort(invNatSort).map(k => [k, (m.stations[k] || []).length]); const cnt = {}; items.filter(i => hubKey(i.company) === hubKey(b.company) && i.station).forEach(i => cnt[i.station] = (cnt[i.station] || 0) + 1); return Object.keys(cnt).sort(invNatSort).map(k => [k, cnt[k]]); };
    const chip = (t, c) => `<span style="display:inline-block;background:${c || '#e2e8f0'};border-radius:999px;padding:1px 8px;margin:1px;font-size:.75rem;">${t}</span>`;
    const html = cos.map(c => {
      const ce = emps.filter(e => empCos(e).some(x => hubKey(x) === hubKey(c.name))); const cb = brs.filter(b => hubKey(b.company) === hubKey(c.name));
      const noBr = ce.filter(e => !e.branchCode);
      return `<div style="border:1px solid #cbd5e1;border-radius:.5rem;margin-bottom:.8rem;overflow:hidden;"><div style="background:#0f172a;color:#fff;padding:.5rem .8rem;font-weight:800;">🏢 ${srchEsc(c.name)}${c.legalName ? ` <small style="font-weight:400;">· ${srchEsc(c.legalName)}</small>` : ''} <small style="font-weight:400;float:right;">${cb.length} branch · ${ce.length} empleyado</small></div><div style="padding:.6rem .8rem;">
        ${cb.map(b => { const be = ce.filter(e => String(e.branchCode) === String(b.code || b.branch)), st = stationsOf(b); return `<div style="border-left:3px solid #2563eb;padding-left:.6rem;margin-bottom:.6rem;"><b>🏪 ${srchEsc(b.code || '')} ${srchEsc(b.branch || '')}</b> <small style="color:#64748b;">${be.length} empleyado · ${st.length} station</small><div style="margin:.2rem 0;">📍 ${st.map(x => chip(srchEsc(x[0]) + ' (' + x[1] + ')', '#dbeafe')).join('') || '<small style="color:#94a3b8;">Wala pang station</small>'}</div><div>👥 ${be.map(e => chip(srchEsc(empName(e)), '#dcfce7')).join('') || '<small style="color:#94a3b8;">Walang empleyadong naka-assign</small>'}</div></div>`; }).join('') || '<small style="color:#94a3b8;">Wala pang branch.</small>'}
        ${noBr.length ? `<div style="border-left:3px solid #94a3b8;padding-left:.6rem;"><b>🏛️ Head Office / Walang branch</b><div>👥 ${noBr.map(e => chip(srchEsc(empName(e)), '#f1f5f9')).join('')}</div></div>` : ''}</div></div>`;
    }).join('') || '<div>Wala pang company.</div>';
    const orphan = emps.filter(e => !empCos(e).length);
    window.__treeHtml = `<h1>Istruktura ng Company</h1><div class="meta">${printedByLine()}</div>` + html;
    arModal(`<h3>🌳 Company → Branch → Station</h3><p style="font-size:.82rem;color:#64748b;">Ang bawat company ay may sariling branch; ang bawat branch ay may sariling station at empleyado. Ang empleyado ay itinatalaga sa company (at branch) sa HR → Employee form.</p><div style="max-height:60vh;overflow:auto;">${html}${orphan.length ? `<div style="color:#b45309;font-size:.82rem;">⚠️ ${orphan.length} empleyado ang walang company: ${orphan.slice(0, 15).map(e => srchEsc(empName(e))).join(', ')}${orphan.length > 15 ? '…' : ''}</div>` : ''}</div><div style="margin-top:.6rem;"><button class="btn btn-secondary" onclick="printHtmlDoc('Istruktura ng Company', window.__treeHtml)">🖨️ Print</button></div>`);
  } catch (e) { arModal('<div style="padding:1rem;color:#dc2626;">Error: ' + srchEsc(e.message) + '</div>'); }
}
// ===== Generic CRUD helpers (hanapin, add, edit, delete) =====
function crudFilter(inp) {
  const q = String(inp.value || '').trim().toLowerCase(), words = q.split(/\s+/).filter(Boolean); const root = inp.closest('.card, .modal-content, #ar-modal') || document;
  root.querySelectorAll('tbody tr, [data-crud-row]').forEach(r => { const t = r.innerText.toLowerCase(); r.style.display = !words.length || words.every(w => t.includes(w)) ? '' : 'none'; });
}
let cbCompany = '', cbList = [];
async function companyBranchesOpen(company) {
  cbCompany = company; arModal('<div style="padding:1rem;">Kinukuha...</div>');
  try { if (!invCompaniesList.length) await invLoadMasters(); } catch (e) {}
  try { cbList = []; const [b, m, u] = await Promise.all([db.collection('inventory_branches').get(), db.collection('inventory_station_map').get(), db.collection('users').get()]); const sm = {}; m.forEach(d => sm[d.id] = Object.keys(d.data().stations || {}).length); const uc = {}; u.forEach(d => { const x = d.data(); if (x.branch) uc[hubKey(x.branch)] = (uc[hubKey(x.branch)] || 0) + 1; });
    b.forEach(d => { const x = d.data(); if (hubKey(x.company) === hubKey(company)) cbList.push({ id: d.id, ...x, stn: sm[invSlug(x.code || '')] || 0, usr: uc[hubKey(x.branch)] || 0 }); }); cbList.sort((a, c) => String(a.branch).localeCompare(String(c.branch))); } catch (e) { arModal('<div style="color:#dc2626;padding:1rem;">Error: ' + srchEsc(e.message) + '</div>'); return; }
  cbRender();
}
function cbRender() {
  const rows = cbList.map((b, i) => `<tr data-crud-row><td><b>${srchEsc(b.branch)}</b><br><small style="color:#64748b;">Code: ${srchEsc(b.code || '—')} · ${b.stn} station · ${b.usr} user</small></td><td style="white-space:nowrap;text-align:right;"><button class="btn btn-sm btn-secondary" onclick="branchStationsOpen(${i})">📍 Stations</button> <button class="btn btn-sm btn-secondary" onclick="branchBomOpen(${i})">🧪 BOM</button> <button class="btn btn-sm btn-primary" onclick="branchForm(${i})">✏️</button> <button class="btn btn-sm btn-danger" onclick="branchDelete(${i})">🗑</button></td></tr>`).join('') || '<tr><td colspan="2" style="text-align:center;color:#94a3b8;">Wala pang branch. I-click ang ➕ Add Branch.</td></tr>';
  arModal(`<h3>🏪 Mga Branch — ${srchEsc(cbCompany)}</h3><div style="display:flex;gap:.4rem;margin-bottom:.5rem;"><input type="search" placeholder="🔍 Hanapin ang branch..." oninput="crudFilter(this)" style="flex:1;"><button class="btn btn-success" onclick="branchForm(-1)">➕ Add Branch</button></div><div style="max-height:55vh;overflow:auto;"><table data-notools="1"><tbody>${rows}</tbody></table></div><p style="font-size:.8rem;color:#64748b;margin-top:.5rem;">📍 Stations = ayusin ang station at produkto ng branch (puwede ring gawin ng branch manager). 🧪 BOM = prepared items ng branch.</p>`);
}
function branchForm(i) {
  const b = i >= 0 ? cbList[i] : {}; arModal(`<h3>${i >= 0 ? '✏️ I-edit ang Branch' : '➕ Bagong Branch'} — ${srchEsc(cbCompany)}</h3><div class="form-group"><label>Pangalan ng Branch</label><input id="bf-name" value="${srchEsc(b.branch || '')}" placeholder="Hal: Kenko Main"></div><div class="form-group"><label>Branch Code</label><input id="bf-code" value="${srchEsc(b.code || '')}" placeholder="Hal: KM01" style="text-transform:uppercase;"></div><div class="form-group"><label>Company</label><select id="bf-co">${(invCompaniesList.some(c => hubKey(c) === hubKey(cbCompany)) ? invCompaniesList : invCompaniesList.concat([cbCompany])).map(c => `<option ${hubKey(c) === hubKey(b.company || cbCompany) ? 'selected' : ''}>${srchEsc(c)}</option>`).join('')}</select></div><button class="btn btn-success" onclick="branchSave(${i})">💾 I-save</button> <button class="btn btn-secondary" onclick="cbRender()">← Balik</button>`);
}
async function branchSave(i) {
  const name = document.getElementById('bf-name').value.trim(), code = document.getElementById('bf-code').value.trim().toUpperCase(), company = document.getElementById('bf-co').value; if (!name || !code || !company) { alert('Ilagay ang pangalan, code at company.'); return; }
  const old = i >= 0 ? cbList[i] : null, id = invSlug(name);
  if (cbList.some((x, j) => j !== i && (invSlug(x.branch) === id || String(x.code).toUpperCase() === code))) { alert('May branch na may ganitong pangalan o code.'); return; }
  if (old && old.branch !== name && !await uiConfirm(`Papalitan ang pangalan ng branch mula "${old.branch}" → "${name}". Dapat ding palitan ang Branch sa mga user at order para magtugma. Ituloy?`)) return;
  try { await db.collection('inventory_branches').doc(id).set({ branch: name, code, company, updatedAt: firebase.firestore.FieldValue.serverTimestamp() }); if (old && old.id !== id) await db.collection('inventory_branches').doc(old.id).delete(); try { await logSystemAction(old ? 'BRANCH_EDITED' : 'BRANCH_CREATED', `${name} (${code}) — ${company}`); } catch (e) {} await invLoadMasters();
    if (hubKey(company) === hubKey(cbCompany)) await companyBranchesOpen(cbCompany); else { arCloseModal(); alert(`✅ Nailipat ang ${name} sa ${company}.`); } if (typeof loadCompanyManagement === 'function') loadCompanyManagement(); } catch (e) { alert('Error: ' + e.message); }
}
async function branchDelete(i) {
  const b = cbList[i]; if (!b) return; if (b.usr && !await uiConfirm(`May ${b.usr} user na naka-tag sa "${b.branch}". Mawawalan sila ng branch setup. Ituloy ang pagbura?`)) return;
  if (!await uiConfirm(`Burahin ang branch na "${b.branch}"? (Mananatili ang mga lumang bilang at order, pero aalisin ito sa listahan ng branch.)`)) return;
  try { await db.collection('inventory_branches').doc(b.id).delete(); try { await logSystemAction('BRANCH_DELETED', `${b.branch} (${b.code}) — ${b.company}`); } catch (e) {} await invLoadMasters(); await companyBranchesOpen(cbCompany); if (typeof loadCompanyManagement === 'function') loadCompanyManagement(); } catch (e) { alert('Error: ' + e.message); }
}
async function branchCtxLoad(b) {
  invState.branch = b.branch; invState.branchCode = b.code || invSlug(b.branch).toUpperCase(); invState.company = b.company; invState.ready = false;
  const [iSnap, pSnap] = await Promise.all([db.collection('inventory_items').where('company', '==', b.company).get(), db.collection('products').get()]);
  invState.items = []; iSnap.forEach(d => invState.items.push({ id: d.id, ...d.data() })); invState.products = {}; pSnap.forEach(d => { invState.products[d.id] = { id: d.id, ...d.data() }; }); invState.items.sort((a, c) => String(a.itemName).localeCompare(String(c.itemName)));
  let smDoc = null; try { const sm = await db.collection('inventory_station_map').doc(invSlug(invState.branchCode)).get(); if (sm.exists) smDoc = sm.data(); } catch (e) {} invState.stationItems = invBuildStationItems(smDoc); invState.station = '';
}
async function branchStationsOpen(i) { const b = cbList[i]; if (!b) return; try { await branchCtxLoad(b); invStationMapOpen(); } catch (e) { alert('Error: ' + e.message); } }
async function branchBomOpen(i) { const b = cbList[i]; if (!b) return; try { await invBomOpen('branch', { company: b.company, bc: b.code || invSlug(b.branch).toUpperCase(), bname: b.branch }); } catch (e) { alert('Error: ' + e.message); } }
async function loadCompanyManagement() {
  const root = document.getElementById('company-admin-root'); if (!root || !db) return;
  root.innerHTML = '<div class="card">Kinukuha ang mga company...</div>';
  try {
    const [cSnap, bSnap, pSnap] = await Promise.all([db.collection('companies').get(), db.collection('inventory_branches').get(), db.collection('products').get()]);
    companyDocs = []; cSnap.forEach(d => companyDocs.push({ id: d.id, ...d.data() }));
    companyDocs.sort((a, b) => String(a.name).localeCompare(String(b.name)));
    const branches = []; bSnap.forEach(d => branches.push(d.data()));
    const prods = []; pSnap.forEach(d => prods.push(d.data()));
    const untagged = prods.filter(p => !productCompanies(p).length).length;
    const rows = companyDocs.map(c => {
      const brs = branches.filter(b => hubKey(b.company) === hubKey(c.name));
      const tagged = prods.filter(p => productCompanies(p).some(x => hubKey(x) === hubKey(c.name))).length;
      return `<tr><td><b>${srchEsc(c.name)}</b>${c.legalName ? `<br><small style="color:#64748b;">${srchEsc(c.legalName)}</small>` : ''}${c.active === false ? '<br><span class="badge badge-warning">Inactive</span>' : ''}</td>
        <td>${srchEsc(c.address || '—')}</td>
        <td>${srchEsc(c.contactPerson || '—')}<br><small>${srchEsc(c.phone || '')} ${srchEsc(c.email || '')}</small></td>
        <td>TIN: ${srchEsc(c.tin || '—')}<br><small>BR: ${srchEsc(c.birReg || '—')}</small></td>
        <td>${srchEsc(c.dateStarted || '—')}</td>
        <td>${brs.length ? brs.map(b => `<span class="co-chip">🏪 ${srchEsc(b.code)} ${srchEsc(b.branch)}</span>`).join('') : '<small style="color:#94a3b8;">Wala pang branch</small>'}</td>
        <td>${tagged} product</td>
        <td style="white-space:nowrap;"><button class="btn btn-sm btn-secondary" onclick="printCompanyProfile('${srchEsc(c.id)}')">🖨️</button> <button class="btn btn-sm btn-success" onclick="companyBranchesOpen('${srchEsc(c.name)}')">🏪 Branches (${brs.length})</button> <button class="btn btn-sm btn-primary" onclick="openCompanyModal('${srchEsc(c.id)}')">✏️ Edit</button> <button class="btn btn-sm btn-danger" onclick="deleteCompany('${srchEsc(c.id)}')">🗑️</button></td></tr>`;
    }).join('') || '<tr><td colspan="8" style="text-align:center;color:#94a3b8;padding:1rem;">Wala pang company. I-click ang "➕ Add Company".</td></tr>';
    root.innerHTML = `<div class="card" data-notools="1"><div class="card-title"><span>🏢 Company Management</span>
      <div style="display:flex;gap:0.4rem;flex-wrap:wrap;"><button class="btn btn-success btn-sm" onclick="openCompanyModal()">➕ Add Company</button><button class="btn btn-primary btn-sm" onclick="companyTreeOpen()">🌳 Istruktura</button><button class="btn btn-secondary btn-sm" onclick="printCardTable(this)">🖨️ Print</button><button class="btn btn-secondary btn-sm" onclick="exportCardTable(this)">⬇️ CSV</button><button class="btn btn-secondary btn-sm" onclick="loadCompanyManagement()">🔄 Refresh</button></div></div>
      <p style="font-size:0.85rem;color:#64748b;margin-bottom:0.75rem;">Dito nakalista ang mga company (hal. KNGK, Tanoshi), ang impormasyon nila, ang mga branch nila, at kung ilang produkto ang naka-tag sa kanila. Sa <b>Product Master</b>, i-tick kung aling company ang gumagamit ng produkto. Ang produktong walang tick (<b>${untagged}</b> ngayon) ay gamit ng lahat ng company. Ang branch ay itinatakda sa company sa <b>Branch Inventory → Setup</b>.</p>
      <input type="search" placeholder="🔍 Hanapin ang company..." oninput="crudFilter(this)" style="width:100%;margin-bottom:.5rem;"><div class="table-responsive"><table><thead><tr><th>Company</th><th>Address</th><th>Contact</th><th>Rehistro (TIN / BR)</th><th>Date Started</th><th>Mga Branch</th><th>Produkto</th><th>Aksyon</th></tr></thead><tbody>${rows}</tbody></table></div></div>`;
  } catch (e) { root.innerHTML = `<div class="card">Error: ${srchEsc(e.message)}</div>`; }
}
function openCompanyModal(id) {
  const c = id ? (companyDocs.find(x => x.id === id) || {}) : {};
  let ov = document.getElementById('company-modal');
  if (!ov) { ov = document.createElement('div'); ov.id = 'company-modal'; ov.className = 'modal-overlay'; ov.style.display = 'none'; ov.innerHTML = '<div class="modal-content" style="max-width:720px;max-height:92vh;overflow-y:auto;"><div id="company-modal-body"></div></div>'; document.body.appendChild(ov); }
  const f = (k, label, ph, type) => `<div class="form-group" style="margin:0;"><label>${label}</label><input type="${type || 'text'}" id="co-${k}" value="${srchEsc(c[k] || '')}" placeholder="${ph || ''}"></div>`;
  document.getElementById('company-modal-body').innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #e2e8f0;padding-bottom:0.5rem;margin-bottom:0.75rem;"><h3 style="margin:0;">${id ? '✏️ I-edit ang Company' : '➕ Bagong Company'}</h3><button class="btn btn-secondary btn-sm" onclick="document.getElementById('company-modal').style.display='none'">✕</button></div>
    <input type="hidden" id="co-id" value="${srchEsc(id || '')}">
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.75rem;">
      ${id ? `<div class="form-group" style="margin:0;"><label>Company Code / Pangalan</label><input type="text" id="co-name" value="${srchEsc(c.name || '')}" disabled></div>` : f('name', 'Company Code / Pangalan', 'Hal: KNGK')}
      ${f('legalName', 'Buong Legal Name', 'Hal: KNGK Food Corp.')}
      ${f('address', 'Company Address', 'Buong address')}
      ${f('dateStarted', 'Date Started (simula ng operasyon)', '', 'date')}
      ${f('contactPerson', 'Contact Person', '')}
      ${f('phone', 'Contact Number', '')}
      ${f('email', 'Email', '', 'email')}
      ${f('website', 'Website / Social', '')}
      ${f('tin', 'TIN', '000-000-000-000')}
      ${f('birReg', 'BR / BIR Registration No.', '')}
    </div>
    <div class="form-group" style="margin-top:0.75rem;"><label>👥 Team / Mga Key Person (isang linya bawat tao: Pangalan — Posisyon — Contact)</label><textarea id="co-team" rows="4" placeholder="Juan Dela Cruz — Owner — 0917...&#10;Ana Reyes — Operations Manager">${srchEsc(c.team || '')}</textarea></div>
    <div class="form-group"><label>Notes</label><textarea id="co-notes" rows="2">${srchEsc(c.notes || '')}</textarea></div>
    <label style="display:flex;gap:0.4rem;align-items:center;font-weight:600;"><input type="checkbox" id="co-active" style="width:auto;" ${c.active === false ? '' : 'checked'}> Active</label>
    <button class="btn btn-success" style="width:100%;margin-top:1rem;font-weight:800;" onclick="saveCompany()">💾 I-save ang Company</button>`;
  ov.style.display = 'flex';
}
async function saveCompany() {
  const g = k => ((document.getElementById('co-' + k) || {}).value || '').trim();
  const id0 = g('id'); const name = g('name') || (companyDocs.find(x => x.id === id0) || {}).name;
  if (!name) { alert('Ilagay ang Company Code / Pangalan.'); return; }
  const id = id0 || name.replace(/[\/#?]/g, '-');
  if (!id0 && companyDocs.some(x => hubKey(x.name) === hubKey(name))) { alert('May company nang ganito ang pangalan.'); return; }
  const data = { name, legalName: g('legalName'), address: g('address'), dateStarted: g('dateStarted'), contactPerson: g('contactPerson'), phone: g('phone'), email: g('email'), website: g('website'), tin: g('tin'), birReg: g('birReg'), team: g('team'), notes: g('notes'), active: !!(document.getElementById('co-active') || {}).checked, updatedAt: firebase.firestore.FieldValue.serverTimestamp() };
  try {
    await db.collection('companies').doc(id).set(data, { merge: true });
    try { await logSystemAction(id0 ? 'COMPANY_EDITED' : 'COMPANY_CREATED', 'Company: ' + name); } catch (e) {}
    document.getElementById('company-modal').style.display = 'none';
    loadCompanyManagement();
  } catch (e) { alert('Error: ' + e.message); }
}
async function deleteCompany(id) {
  const c = companyDocs.find(x => x.id === id); if (!c) return;
  try {
    const b = await db.collection('inventory_branches').where('company', '==', c.name).get();
    if (!b.empty) { alert(`⚠️ Hindi mabubura ang ${c.name}: may ${b.size} branch pa na nakatali rito. Ilipat muna sila sa ibang company (Branch Inventory → Setup).`); return; }
  } catch (e) {}
  if (!await uiConfirm(`Burahin ang company na "${c.name}"? (Mananatili ang mga produkto, pero tatanggalin ang tag nito sa listahan ng pagpipilian.)`)) return;
  try { await db.collection('companies').doc(id).delete(); loadCompanyManagement(); } catch (e) { alert('Error: ' + e.message); }
}
function printCompanyProfile(id) {
  const c = companyDocs.find(x => x.id === id); if (!c) return;
  const row = (l, v) => `<tr><th style="width:30%;">${l}</th><td>${srchEsc(v || '—')}</td></tr>`;
  printHtmlDoc('Company ' + c.name, `<h1>🏢 ${srchEsc(c.name)}</h1><div class="meta">${printedByLine()}</div><table>${row('Legal Name', c.legalName)}${row('Address', c.address)}${row('Date Started', c.dateStarted)}${row('Contact Person', c.contactPerson)}${row('Contact Number', c.phone)}${row('Email', c.email)}${row('Website', c.website)}${row('TIN', c.tin)}${row('BR / BIR Registration', c.birReg)}${row('Status', c.active === false ? 'Inactive' : 'Active')}</table><h2>Team / Key Person</h2><div class="box">${srchEsc(c.team || '—')}</div>${c.notes ? `<h2>Notes</h2><div class="box">${srchEsc(c.notes)}</div>` : ''}`);
}
// Branch catalog: ang produkto ay ayon sa company ng branch
let branchCompanyCache = null;
async function getBranchCompany() {
  if (branchCompanyCache !== null) return branchCompanyCache;
  const u = getCurrentUser() || {}; branchCompanyCache = '';
  try { const d = await db.collection('inventory_branches').doc(invSlug(u.branch)).get(); if (d.exists) branchCompanyCache = d.data().company || ''; } catch (e) {}
  return branchCompanyCache;
}


// ========================================================
// 💰 PUHUNAN (COST) vs PRESYONG PANINDA (SELLING PRICE) at MARGIN
// Ang wholePrice/loosePrice ng produkto = PRESYONG PANINDA sa branch/customer.
// Ang puhunan ay nasa HIWALAY na collection (product_costs) para hindi makita ng branch (staff lang).
// Pricing rules (product_costs/_rules): overheadPct = gastos sa truck, maintenance, gasolina, labor; markupPct = tubo.
// ========================================================
let productCosts = {};
let pricingRules = { overheadPct: 0, markupPct: 0 };
async function loadProductCosts() {
  productCosts = {};
  try {
    const snap = await db.collection('product_costs').get();
    snap.forEach(d => { if (d.id === '_rules') pricingRules = { overheadPct: parseFloat(d.data().overheadPct) || 0, markupPct: parseFloat(d.data().markupPct) || 0 }; else productCosts[d.id] = d.data(); });
  } catch (e) { /* walang pahintulot (hal. branch) o walang data */ }
  return productCosts;
}
function costOf(p, uom) {
  const c = productCosts[p && p.id] || {};
  const v = parseFloat(uom === 'Whole' ? c.costWhole : c.costLoose) || 0;
  return v;
}
function marginInfo(cost, price) {
  cost = parseFloat(cost) || 0; price = parseFloat(price) || 0;
  if (!(price > 0)) return { margin: null, markup: null, profit: price - cost };
  return { margin: cost > 0 ? ((price - cost) / price) * 100 : null, markup: cost > 0 ? ((price - cost) / cost) * 100 : null, profit: price - cost };
}
function minPriceFor(cost) { return (parseFloat(cost) || 0) * (1 + pricingRules.overheadPct / 100); }
function suggestedPriceFor(cost) { return minPriceFor(cost) * (1 + pricingRules.markupPct / 100); }
function money(n) { return '₱' + (parseFloat(n) || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
async function editPricingRules() {
  const o = await uiPrompt('Overhead % (gastos sa truck, maintenance, gasolina, labor na dapat mabawi sa bawat produkto):', pricingRules.overheadPct);
  if (o === null) return;
  const m = await uiPrompt('Tubo / Markup % (idadagdag pagkatapos ng overhead):', pricingRules.markupPct);
  if (m === null) return;
  const ov = parseFloat(o), mk = parseFloat(m);
  if (isNaN(ov) || isNaN(mk) || ov < 0 || mk < 0) { alert('Maglagay ng tamang numero (0 o higit pa).'); return; }
  try {
    await db.collection('product_costs').doc('_rules').set({ overheadPct: ov, markupPct: mk, updatedAt: firebase.firestore.FieldValue.serverTimestamp() });
    pricingRules = { overheadPct: ov, markupPct: mk };
    try { await logSystemAction('PRICING_RULES', `Overhead ${ov}%, Markup ${mk}%`); } catch (e) {}
    alert(`✅ Na-save: Overhead ${ov}% · Markup ${mk}%. Halimbawa: puhunan ₱100 → pinakamababang presyo ${money(minPriceFor(100))} → suggested ${money(suggestedPriceFor(100))}.`);
    if (typeof renderAdminProductsTable === 'function' && adminProductsList.length) renderAdminProductsTable(adminProductsList);
  } catch (e) { alert('Error: ' + e.message); }
}
function updateAdminMarginBox() {
  const box = document.getElementById('admin-item-margin-box'); if (!box) return;
  const g = id => parseFloat((document.getElementById(id) || {}).value) || 0;
  const cw = g('admin-item-cost-whole'), pw = g('admin-item-whole-price'), cl = g('admin-item-cost-loose'), pl = g('admin-item-loose-price');
  const line = (label, c, p) => {
    if (!(c > 0)) return `<div>${label}: <span style="color:#94a3b8;">ilagay ang puhunan</span></div>`;
    const m = marginInfo(c, p), min = minPriceFor(c), low = p < min;
    return `<div>${label}: Puhunan <b>${money(c)}</b> → Paninda <b>${money(p)}</b> · Tubo <b style="color:${m.profit < 0 ? '#dc2626' : '#059669'}">${money(m.profit)}</b> (${m.margin == null ? '—' : m.margin.toFixed(1) + '% margin'} · ${m.markup == null ? '—' : m.markup.toFixed(1) + '% markup'})${low ? ` <b style="color:#dc2626;">⚠️ Mas mababa sa ${money(min)} (kulang pambawi sa overhead ${pricingRules.overheadPct}%)</b>` : ''}<br><small style="color:#64748b;">Suggested na presyo: ${money(suggestedPriceFor(c))}</small></div>`;
  };
  box.innerHTML = line('Whole', cw, pw) + line('Loose', cl, pl);
}
function autoComputeAdminLooseCost() {
  const cw = parseFloat((document.getElementById('admin-item-cost-whole') || {}).value) || 0;
  const conv = parseFloat((document.getElementById('admin-item-conversion') || {}).value) || 1;
  const cl = document.getElementById('admin-item-cost-loose');
  if (cl && cw > 0 && conv > 0) cl.value = (cw / conv).toFixed(4);
}
document.addEventListener('input', e => {
  const id = e.target && e.target.id;
  if (id === 'admin-item-cost-whole' || id === 'admin-item-conversion') autoComputeAdminLooseCost();
  if (['admin-item-cost-whole', 'admin-item-cost-loose', 'admin-item-whole-price', 'admin-item-loose-price', 'admin-item-conversion'].includes(id)) updateAdminMarginBox();
});
(function hookCostForm() {
  const orig = window.openAdminProductModal; if (typeof orig !== 'function') return;
  window.openAdminProductModal = async function (id) {
    const r = await orig.apply(this, arguments);
    if (!Object.keys(productCosts).length) await loadProductCosts();
    const c = id ? (productCosts[id] || {}) : {};
    const set = (k, v) => { const el = document.getElementById(k); if (el) el.value = v || 0; };
    set('admin-item-cost-whole', c.costWhole); set('admin-item-cost-loose', c.costLoose);
    updateAdminMarginBox();
    return r;
  };
})();
async function saveProductCost(code) {
  const g = id => parseFloat((document.getElementById(id) || {}).value) || 0;
  const u = getCurrentUser() || {};
  await db.collection('product_costs').doc(code).set({ costWhole: g('admin-item-cost-whole'), costLoose: g('admin-item-cost-loose'), updatedBy: u.email || '', updatedAt: firebase.firestore.FieldValue.serverTimestamp() }, { merge: true });
  productCosts[code] = { costWhole: g('admin-item-cost-whole'), costLoose: g('admin-item-cost-loose') };
}
function productPriceCellsHtml(prod, wholeUOM, looseUOM) {
  const p = { id: prod.id };
  const cw = costOf(p, 'Whole'), cl = costOf(p, 'Loose');
  const note = (cost, price) => {
    if (!(cost > 0)) return '<br><small style="color:#94a3b8;">walang puhunan</small>';
    const m = marginInfo(cost, price), low = price < minPriceFor(cost);
    return `<br><small style="color:${low ? '#dc2626' : '#64748b'};">Puhunan ${money(cost)} · ${m.margin == null ? '' : m.margin.toFixed(0) + '% margin'}${low ? ' ⚠️' : ''}</small>`;
  };
  return `<td><b style="color: #2563eb;">${money(prod.wholePrice)}</b> / ${wholeUOM}${note(cw, parseFloat(prod.wholePrice) || 0)}</td>
        <td><b style="color: #059669;">${money(prod.loosePrice)}</b> / ${looseUOM}${note(cl, parseFloat(prod.loosePrice) || 0)}</td>`;
}
// ---- BOM: ang cost ng recipe ay PUHUNAN ng sangkap (hindi ang presyong paninda) ----
async function applyBomPricing(bomId) {
  const bom = bomRecipes.find(b => b.id === bomId); if (!bom) return;
  const r = bomReportData(bom, 1);
  if (r.noCost > 0 && !await uiConfirm(`⚠️ May ${r.noCost} sangkap na walang puhunan (ginamit ang presyong paninda nila). Hindi tumpak ang cost. Ituloy pa rin?`)) return;
  const perUnit = r.perUnit, sugg = suggestedPriceFor(perUnit), batchSugg = suggestedPriceFor(r.total);
  if (!await uiConfirm(`I-apply sa produkto na "${bom.finishedGoodName}"?\n\nPuhunan bawat unit: ${money(perUnit)}\nPuhunan bawat batch: ${money(r.total)}\nBagong presyong paninda bawat unit: ${money(sugg)}\nBagong presyong paninda bawat batch: ${money(batchSugg)}\n(Overhead ${pricingRules.overheadPct}% + Markup ${pricingRules.markupPct}%)`)) return;
  try {
    const code = bom.finishedGoodCode;
    await db.collection('product_costs').doc(code).set({ costWhole: +r.total.toFixed(4), costLoose: +perUnit.toFixed(4), updatedBy: (getCurrentUser() || {}).email || '', updatedAt: firebase.firestore.FieldValue.serverTimestamp() }, { merge: true });
    await db.collection('products').doc(code).set({ wholePrice: +batchSugg.toFixed(2), loosePrice: +sugg.toFixed(2) }, { merge: true });
    productCosts[code] = { costWhole: r.total, costLoose: perUnit };
    try { await logSystemAction('BOM_PRICING_APPLIED', `${code}: puhunan ${perUnit.toFixed(2)}/unit, paninda ${sugg.toFixed(2)}/unit`); } catch (e) {}
    alert('✅ Na-update ang puhunan at presyong paninda ng produkto.');
    if (typeof loadAdminProducts === 'function') loadAdminProducts();
  } catch (e) { alert('Error: ' + e.message); }
}


// ========================================================
// 📝 PO STATUS FLOW (SAP B1 style)
// Draft → For Approval → Approved → Received (GRPO / A/P Invoice) → For Payment → Paid & Closed
// ========================================================
function poFmtDate(t){ try{ const d=t&&t.toDate?t.toDate():(t&&t.seconds?new Date(t.seconds*1000):new Date(t)); return isNaN(d)?'':d.toLocaleDateString('en-PH'); }catch(e){return '';} }
function poIsApproved(po){
  if (!po) return false;
  if (po.status === 'Sent to Vendor' || po.status === 'Approved') return true; // legacy PO = approved na
  return false;
}
function poStatusBadge(po){
  const st = po.status || '';
  const ap = po.approvals || {};
  const sc = ap.supplyChain ? '✅' : '⬜', co = ap.coo ? '✅' : '⬜';
  if (st === 'Draft') return '<span class="badge badge-secondary">Draft</span>';
  if (st === 'For Approval') return `<span class="badge badge-warning">For Approval</span><br><small>${sc} SC Head &nbsp; ${co} COO</small>`;
  if (st === 'Approved' || st === 'Sent to Vendor') return `<span class="badge badge-commissary">Approved${st==='Sent to Vendor'?' (legacy)':''}</span>${po.dpAmount?`<br><small style="color:#7c3aed;">DP ${money(po.dpAmount)}</small>`:''}`;
  return `<span class="badge badge-success">${st}</span>`;
}
function poSapRefsHtml(po){
  const r=[]; if(po.sapPoNo) r.push('SAP PO: '+srchEsc(po.sapPoNo)); if(po.grpoNo) r.push('GRPO: '+srchEsc(po.grpoNo)); if(po.sapApInvoiceNo) r.push('A/P Inv: '+srchEsc(po.sapApInvoiceNo)); if(po.requestKey) r.push('📎 '+srchEsc(po.requestKey)+(po.company?' · '+srchEsc(po.company):'')+(po.branch?' · '+srchEsc(po.branch):''));
  return r.length?`<br><small style="color:#0369a1;">${r.join(' • ')}</small>`:'';
}
function poActionButtons(po){
  const st = po.status || '', ap = po.approvals || {};
  let h = '';
  if (st === 'Draft') h += `<button class="btn btn-sm btn-warning" onclick="poSubmitForApproval('${po.id}')">📤 Submit for Approval</button>`;
  if (st === 'For Approval') {
    if (!ap.supplyChain) h += `<button class="btn btn-sm btn-success" onclick="poSignOff('${po.id}','supplyChain')">✍️ Head of SC</button>`;
    if (!ap.coo) h += `<button class="btn btn-sm btn-success" onclick="poSignOff('${po.id}','coo')">✍️ COO</button>`;
    h += `<button class="btn btn-sm btn-danger" onclick="poReturnToDraft('${po.id}')">↩ Return</button>`;
  }
  if (poIsApproved(po)) {
    h += `<button class="btn btn-sm btn-success" style="font-weight:bold;" onclick="openReceivePOModal('${po.id}')">📦 Receive</button>`;
    h += `<button class="btn btn-sm btn-secondary" onclick="poDownPayment('${po.id}')">💵 DP</button>`;
    h += `<button class="btn btn-sm btn-secondary" onclick="poEditSapRefs('${po.id}')">🏷️ SAP</button>`;
  }
  return h;
}
function poLog(poId, text){ try{ logSystemAction('PO_FLOW', `${poId}: ${text}`); }catch(e){} }
async function poSubmitForApproval(poId){
  if (!await uiConfirm('I-submit ang PO for approval? (I-print at ipapirma sa Head of Supply Chain at COO.)')) return;
  await db.collection('vendor_pos').doc(poId).update({ status:'For Approval', approvals:{} });
  notify(['coo', 'supply'], `PO para sa pirma: ${poId}`, `${(getCurrentUser() || {}).name || ''} ay nag-submit ng PO ${poId} for approval (Head of SC at COO).`);
  poLog(poId,'Submitted for approval'); loadAdminVendorPOs();
}
async function poReturnToDraft(poId){
  if (!await uiConfirm('Ibalik sa Draft ang PO? Mabubura ang mga pirma.')) return;
  await db.collection('vendor_pos').doc(poId).update({ status:'Draft', approvals:{} });
  poLog(poId,'Returned to draft'); loadAdminVendorPOs();
}
async function poSignOff(poId, who){
  const label = who === 'coo' ? 'COO' : 'Head of Supply Chain';
  const u = getCurrentUser(); const name = (u && (u.name||u.email)) || 'Admin';
  const po = (allVendorPOs||[]).find(p=>p.id===poId); if(!po) return;
  try {
    const cfg = await poGetSignatories(); const need = (who === 'coo' ? cfg.cooEmail : cfg.supplyChainEmail) || '';
    if (need && need.toLowerCase() !== String((u && u.email) || '').toLowerCase()) { alert(`⚠️ Si ${need} lang ang puwedeng mag-sign-off bilang ${label}.`); return; }
  } catch (e) {}
  if (!await uiConfirm(`Ikinukumpirma mo na pumirma na ang ${label} sa printed PO ${po.poNumber}?\n\nIre-record ito bilang naka-sign-off (${name}).`)) return;
  const ref = db.collection('vendor_pos').doc(poId);
  try {
    await db.runTransaction(async tx=>{
      const snap = await tx.get(ref); if(!snap.exists) throw new Error('Hindi nahanap ang PO.');
      const d = snap.data();
      if (d.status !== 'For Approval') throw new Error('Hindi na For Approval ang PO.');
      const approvals = Object.assign({}, d.approvals||{});
      approvals[who] = { by: label + ' – ' + name, at: new Date().toISOString() };
      const upd = { approvals };
      if (approvals.supplyChain && approvals.coo) { upd.status = 'Approved'; upd.approvedAt = firebase.firestore.FieldValue.serverTimestamp(); }
      tx.update(ref, upd);
    });
    poLog(poId, `${label} signed off`); loadAdminVendorPOs();
  } catch(e){ alert('Error: '+e.message); }
}
async function poGetSignatories(){ const d = await db.collection('system_settings').doc('po_signatories').get(); return d.exists ? d.data() : {}; }
async function poSetSignatories(){
  const cfg = await poGetSignatories();
  const sc = await uiPrompt('Email ng HEAD OF SUPPLY CHAIN (siya lang ang makaka-sign-off). Blangko = kahit sinong admin:', cfg.supplyChainEmail || ''); if (sc === null) return;
  const coo = await uiPrompt('Email ng COO (siya lang ang makaka-sign-off). Blangko = kahit sinong admin:', cfg.cooEmail || ''); if (coo === null) return;
  await db.collection('system_settings').doc('po_signatories').set({ supplyChainEmail: sc.trim().toLowerCase(), cooEmail: coo.trim().toLowerCase() });
  alert('✅ Na-save ang mga signatory.');
}
async function poEditSapRefs(poId){
  const ref = db.collection('vendor_pos').doc(poId);
  const snap = await ref.get(); if(!snap.exists) return; const d = snap.data();
  const sapPo = await uiPrompt('SAP PO No. (Purchase Order sa SAP B1):', d.sapPoNo||''); if (sapPo===null) return;
  const grpo = await uiPrompt('GRPO No. (Goods Receipt PO sa SAP):', d.grpoNo||''); if (grpo===null) return;
  const apInv = await uiPrompt('SAP A/P Invoice No.:', d.sapApInvoiceNo||''); if (apInv===null) return;
  await ref.update({ sapPoNo: sapPo.trim(), grpoNo: grpo.trim(), sapApInvoiceNo: apInv.trim() });
  poLog(poId,'SAP refs updated');
  loadAdminVendorPOs(); if (typeof loadAdminAPInvoices==='function') loadAdminAPInvoices();
}
async function poDownPayment(poId){
  const ref = db.collection('vendor_pos').doc(poId);
  const glRef = db.collection('general_ledger').doc('DP-' + poId);
  const amtStr = await uiPrompt('Down payment amount (₱):'); if (amtStr===null) return;
  const amt = parseFloat(amtStr);
  if (!(amt>0)) { alert('Maglagay ng tamang halaga.'); return; }
  try {
    await db.runTransaction(async tx=>{
      const snap = await tx.get(ref); if(!snap.exists) throw new Error('Hindi nahanap ang PO.');
      const d = snap.data();
      if (d.dpAmount) throw new Error('May naka-record nang down payment (' + money(d.dpAmount) + ').');
      if (d.status === 'Paid & Closed') throw new Error('Paid & Closed na ang PO.');
      const total = parseFloat(d.actualTotalAmount || d.totalAmount || 0);
      if (amt > total) throw new Error('Mas malaki ang down payment kaysa sa total ng PO.');
      const g = await tx.get(glRef);
      if (!g.exists) tx.set(glRef, { type:'Supplier Down Payment (PO)', ref:`DP PO ${d.poNumber||poId} - ${d.vendorName||''}`, credit:amt, debit:0, sourcePO:poId, timestamp:firebase.firestore.FieldValue.serverTimestamp() });
      tx.update(ref, { dpAmount: amt, dpAt: firebase.firestore.FieldValue.serverTimestamp(), dpBy: (getCurrentUser()?.name||'Accounting') });
    });
    poLog(poId, 'Down payment ' + amt);
    alert('✅ Na-record ang down payment. Ibabawas ito sa final payment.');
    loadAdminVendorPOs(); if (typeof loadAdminAPInvoices==='function') loadAdminAPInvoices();
  } catch(e){ alert('Error: '+e.message); }
}


// ========================================================
// 💲 PRICE LIST PER COMPANY / CUSTOMER
// price_lists/{companySlug} = { company, transportPct, prices:{ code:{whole,loose} } }
// Walang entry = default presyong paninda ng produkto. Hindi kasama ang puhunan dito (nababasa ng branch).
// ========================================================
let plState = { company: '', rows: [], transportPct: 0, lists: {} };
async function applyCompanyPriceList(products, company) {
  if (!company || !db) return products;
  try {
    const d = await db.collection('price_lists').doc(invSlug(company)).get();
    if (!d.exists) return products;
    const pr = (d.data() || {}).prices || {};
    products.forEach(p => {
      const o = pr[p.id] || pr[p.sapCode];
      if (!o) return;
      if (o.whole != null && o.whole !== '') { p.defaultWholePrice = p.wholePrice; p.wholePrice = parseFloat(o.whole) || 0; }
      if (o.loose != null && o.loose !== '') { p.defaultLoosePrice = p.loosePrice; p.loosePrice = parseFloat(o.loose) || 0; }
      p.priceListApplied = company;
    });
  } catch (e) { console.warn('price list', e); }
  return products;
}
async function loadPriceLists() {
  const root = document.getElementById('pricelist-admin-root'); if (!root || !db) return;
  root.innerHTML = '<div class="card">Kinukuha ang mga price list...</div>';
  try {
    const [cSnap, lSnap, pSnap] = await Promise.all([db.collection('companies').get(), db.collection('price_lists').get(), db.collection('products').get(), loadProductCosts()]);
    plState.companies = []; cSnap.forEach(d => plState.companies.push(d.data().name || d.id));
    plState.lists = {}; lSnap.forEach(d => plState.lists[d.id] = d.data());
    plState.products = []; pSnap.forEach(d => plState.products.push({ id: d.id, ...d.data() }));
    plState.products.sort((a, b) => (a.itemName || '').localeCompare(b.itemName || ''));
    if (!plState.company || !plState.companies.includes(plState.company)) plState.company = plState.companies[0] || '';
    plRender();
  } catch (e) { root.innerHTML = `<div class="card" style="color:#dc2626;">Error: ${srchEsc(e.message)}</div>`; }
}
function plPickCompany(v) { plState.company = v; plRender(); }
function plCurrentList() { return plState.lists[invSlug(plState.company)] || { prices: {}, transportPct: 0 }; }
function plRender() {
  const root = document.getElementById('pricelist-admin-root'); if (!root) return;
  if (!plState.companies.length) { root.innerHTML = '<div class="card">Wala pang company. Gumawa muna sa 🏢 Company Management (isama ang external customers tulad ng ibang company na umo-order ng ramen/gyoza wrapper).</div>'; return; }
  const list = plCurrentList(), pr = list.prices || {};
  const q = (document.getElementById('pl-search') || {}).value || '';
  const prods = plState.products.filter(p => productForCompany(p, plState.company) && (!q || smartMatch(q, (p.itemName || '') + ' ' + (p.sapCode || p.id))));
  plState.rows = prods;
  const opts = plState.companies.map(c => `<option ${c === plState.company ? 'selected' : ''}>${srchEsc(c)}</option>`).join('');
  const tp = list.transportPct != null ? list.transportPct : 0;
  let rows = '';
  prods.forEach((p, i) => {
    const o = pr[p.id] || {}; const cw = costOf(p, 'Whole'), cl = costOf(p, 'Loose');
    const chk = (cost, val, def) => { const price = (val !== '' && val != null) ? parseFloat(val) : parseFloat(def) || 0; if (!(cost > 0)) return '<small style="color:#94a3b8;">walang puhunan</small>'; const m = marginInfo(cost, price); const low = price < minPriceFor(cost); return `<small style="color:${low ? '#dc2626' : '#059669'};">${m.margin == null ? '' : m.margin.toFixed(0) + '%'} ${low ? '⚠️ mababa sa min ' + money(minPriceFor(cost)) : ''}</small>`; };
    rows += `<tr data-i="${i}"><td><b>${srchEsc(p.itemName || '')}</b><br><small style="font-family:monospace;color:#64748b;">${srchEsc(p.sapCode || p.id)}</small></td>
      <td>${cw > 0 ? money(cw) : '—'}<br>${cl > 0 ? money(cl) : '—'}</td>
      <td>${money(p.wholePrice)}<br>${money(p.loosePrice)}<br><small style="color:#64748b;">/${srchEsc(p.wholeUOM || '')} · /${srchEsc(p.looseUOM || '')}</small></td>
      <td><input type="number" step="0.01" min="0" id="pl-w-${i}" value="${o.whole != null ? o.whole : ''}" placeholder="${p.wholePrice || 0}" style="width:100px;" oninput="plRowMargin(${i})"><br><span id="pl-wm-${i}">${chk(cw, o.whole, p.wholePrice)}</span></td>
      <td><input type="number" step="0.01" min="0" id="pl-l-${i}" value="${o.loose != null ? o.loose : ''}" placeholder="${p.loosePrice || 0}" style="width:100px;" oninput="plRowMargin(${i})"><br><span id="pl-lm-${i}">${chk(cl, o.loose, p.loosePrice)}</span></td></tr>`;
  });
  root.innerHTML = `<div class="card"><div class="card-title"><span>💲 Price List per Company</span></div>
    <p style="font-size:.85rem;color:#64748b;">Iba-iba ang presyong paninda bawat company. Walang laman = gagamitin ang default na presyo ng produkto. Ang branch na nasa company na ito ang makakakita ng presyong ito. Nakikita lang ng admin/staff ang puhunan.</p>
    <div style="display:flex;gap:.5rem;flex-wrap:wrap;align-items:end;margin-bottom:.75rem;">
      <div><label style="font-weight:700;">Company / Customer</label><br><select id="pl-company" onchange="plPickCompany(this.value)">${opts}</select></div>
      <div><label style="font-weight:700;">Transport / delivery % (truck)</label><br><input type="number" id="pl-transport" step="0.1" min="0" value="${tp}" style="width:110px;"></div>
      <button class="btn btn-secondary btn-sm" onclick="plAutoFill(false)">⚡ Auto-fill (blanks) mula sa puhunan</button>
      <button class="btn btn-secondary btn-sm" onclick="plAutoFill(true)">⚡ Auto-fill lahat</button>
      <button class="btn btn-secondary btn-sm" onclick="plClear()">🧹 Clear</button>
      <button class="btn btn-secondary btn-sm" onclick="plPrint()">🖨️ Print</button>
      <button class="btn btn-secondary btn-sm" onclick="plExportCSV()">📤 CSV</button>
      <button class="btn btn-secondary btn-sm" onclick="plImportCSV()">📥 Import</button>
      <button class="btn btn-success" onclick="plSave()">💾 I-save</button></div>
    <small style="color:#64748b;">Auto-fill formula: puhunan × (1 + overhead ${pricingRules.overheadPct}%) × (1 + tubo ${pricingRules.markupPct}%) × (1 + transport %).</small>
    <input type="text" id="pl-search" placeholder="🔎 Hanapin ang produkto..." oninput="plRender()" value="${srchEsc(q)}" style="margin:.6rem 0;width:100%;">
    <div class="table-responsive"><table data-notools="1"><thead><tr><th>Produkto</th><th>Puhunan<br><small>Whole / Loose</small></th><th>Default na presyo</th><th>Presyo ng company (Whole)</th><th>Presyo ng company (Loose)</th></tr></thead><tbody>${rows || '<tr><td colspan="5">Walang produkto para sa company na ito.</td></tr>'}</tbody></table></div></div>`;
}
function plRowMargin(i) {
  const p = plState.rows[i]; if (!p) return;
  const set = (id, cost, inputId, def) => { const v = (document.getElementById(inputId) || {}).value; const price = v !== '' ? parseFloat(v) : parseFloat(def) || 0; const el = document.getElementById(id); if (!el) return; if (!(cost > 0)) { el.innerHTML = '<small style="color:#94a3b8;">walang puhunan</small>'; return; } const m = marginInfo(cost, price), low = price < minPriceFor(cost); el.innerHTML = `<small style="color:${low ? '#dc2626' : '#059669'};">${m.margin == null ? '' : m.margin.toFixed(0) + '%'} ${low ? '⚠️ mababa sa min ' + money(minPriceFor(cost)) : ''}</small>`; };
  set('pl-wm-' + i, costOf(p, 'Whole'), 'pl-w-' + i, p.wholePrice); set('pl-lm-' + i, costOf(p, 'Loose'), 'pl-l-' + i, p.loosePrice);
}
function plAutoFill(all) {
  const t = parseFloat((document.getElementById('pl-transport') || {}).value) || 0;
  plState.rows.forEach((p, i) => {
    [['Whole', 'pl-w-' + i], ['Loose', 'pl-l-' + i]].forEach(([u, id]) => {
      const el = document.getElementById(id); const c = costOf(p, u);
      if (!el || !(c > 0)) return;
      if (all || el.value === '') el.value = (suggestedPriceFor(c) * (1 + t / 100)).toFixed(2);
    });
    plRowMargin(i);
  });
}
async function plClear() { if (!await uiConfirm('Burahin ang lahat ng custom price sa screen na ito? (Hindi pa ma-save hanggang i-click ang I-save)')) return; plState.rows.forEach((p, i) => { ['pl-w-', 'pl-l-'].forEach(x => { const e = document.getElementById(x + i); if (e) e.value = ''; }); plRowMargin(i); }); }
function plCollect() {
  const prices = Object.assign({}, plCurrentList().prices || {});
  plState.rows.forEach((p, i) => {
    const w = (document.getElementById('pl-w-' + i) || {}).value, l = (document.getElementById('pl-l-' + i) || {}).value;
    const e = {}; if (w !== '' && w != null) e.whole = parseFloat(w) || 0; if (l !== '' && l != null) e.loose = parseFloat(l) || 0;
    if (Object.keys(e).length) prices[p.id] = e; else delete prices[p.id];
  });
  return prices;
}
async function plSave() {
  const prices = plCollect(); const t = parseFloat((document.getElementById('pl-transport') || {}).value) || 0;
  let low = 0; plState.rows.forEach(p => { const o = prices[p.id]; if (!o) return; if (o.whole != null && costOf(p, 'Whole') > 0 && o.whole < minPriceFor(costOf(p, 'Whole'))) low++; if (o.loose != null && costOf(p, 'Loose') > 0 && o.loose < minPriceFor(costOf(p, 'Loose'))) low++; });
  if (low && !await uiConfirm(`⚠️ May ${low} presyo na mas mababa sa minimum (puhunan + overhead). Hindi mababawi ang gastos sa truck. Ituloy pa rin?`)) return;
  const u = getCurrentUser() || {};
  try {
    const data = { company: plState.company, transportPct: t, prices, updatedBy: u.email || '', updatedAt: firebase.firestore.FieldValue.serverTimestamp() };
    await db.collection('price_lists').doc(invSlug(plState.company)).set(data);
    plState.lists[invSlug(plState.company)] = data;
    try { await logSystemAction('PRICE_LIST_SAVED', `${plState.company}: ${Object.keys(prices).length} custom price(s)`); } catch (e) {}
    alert(`✅ Na-save ang price list ng ${plState.company} (${Object.keys(prices).length} custom na presyo).`);
    plRender();
  } catch (e) { alert('Error: ' + e.message); }
}
function plPrint() {
  const pr = plCollect();
  const rows = plState.rows.map(p => { const o = pr[p.id] || {}; const w = o.whole != null ? o.whole : p.wholePrice, l = o.loose != null ? o.loose : p.loosePrice; return `<tr><td>${srchEsc(p.sapCode || p.id)}</td><td>${srchEsc(p.itemName || '')}</td><td class="num">${money(w)} / ${srchEsc(p.wholeUOM || '')}</td><td class="num">${money(l)} / ${srchEsc(p.looseUOM || '')}</td></tr>`; }).join('');
  printHtmlDoc('Price List - ' + plState.company, `<h1>Price List — ${srchEsc(plState.company)}</h1><div class="meta">${printedByLine ? printedByLine() : ''}</div><table><thead><tr><th>Code</th><th>Produkto</th><th class="num">Whole</th><th class="num">Loose</th></tr></thead><tbody>${rows}</tbody></table>`);
}
function plExportCSV() {
  const pr = plCollect();
  const lines = [['Code', 'Item', 'Whole_Price', 'Loose_Price'].join(',')];
  plState.rows.forEach(p => { const o = pr[p.id] || {}; lines.push([csvCell(p.sapCode || p.id), csvCell(p.itemName), o.whole != null ? o.whole : p.wholePrice, o.loose != null ? o.loose : p.loosePrice].join(',')); });
  downloadCSVFile(lines.join('\r\n'), 'PriceList_' + invSlug(plState.company) + '.csv');
}
async function plImportCSV() {
  const txt = await pickCSVFile(); if (!txt) return;
  const objs = csvToObjects(txt); let n = 0;
  objs.forEach(o => {
    const code = o.code || o.sap_code || o.item_code; const p = plState.rows.find(x => (x.sapCode || x.id) === code || x.id === code); if (!p) return;
    const i = plState.rows.indexOf(p);
    const w = document.getElementById('pl-w-' + i), l = document.getElementById('pl-l-' + i);
    if (w && o.whole_price !== undefined && o.whole_price !== '') { w.value = parseFloat(o.whole_price) || 0; n++; }
    if (l && o.loose_price !== undefined && o.loose_price !== '') { l.value = parseFloat(o.loose_price) || 0; }
    plRowMargin(i);
  });
  alert(`Na-load ang ${n} presyo. I-click ang 💾 I-save para ma-save.`);
}


// ========================================================
// 💱 DAILY PRICE SHEET  (SRP ng araw — commissary head/officer ang nagpe-presyo)
// - Hindi binabago ang SRP kung hindi ini-edit ("susundin ang luma").
// - Ang order ay naka-lock sa presyong nakita nang i-place (nasa order.items).
// - price_history ang tala ng bawat pagbabago ng puhunan at SRP.
// ========================================================
let dpState = { hub: '', rows: [], orig: {} };
function dpRoot() { return document.getElementById('dp-root'); }
async function loadDailyPrices() {
  const root = dpRoot(); if (!root || !db) return;
  root.innerHTML = '<div class="card">Kinukuha ang mga produkto...</div>';
  try {
    const [pSnap] = await Promise.all([db.collection('products').get(), loadProductCosts()]);
    dpState.all = []; pSnap.forEach(d => dpState.all.push({ id: d.id, ...d.data() }));
    dpState.all.sort((a, b) => (a.itemName || '').localeCompare(b.itemName || ''));
    const u = getCurrentUser() || {};
    dpState.isAdmin = normalizeRole(u.role) === 'admin';
    if (!dpState.isAdmin) dpState.hub = myHubName();
    dpRender();
  } catch (e) { root.innerHTML = `<div class="card" style="color:#dc2626;">Error: ${srchEsc(e.message)}</div>`; }
}
function dpHubs() { const set = new Set(); (dpState.all || []).forEach(p => { if (p.commissarySource) set.add(p.commissarySource); }); return [...set]; }
function dpDaysOld(p) { const t = p.priceUpdatedAt; if (!t) return null; const d = t.toDate ? t.toDate() : (t.seconds ? new Date(t.seconds * 1000) : new Date(t)); return Math.floor((Date.now() - d.getTime()) / 86400000); }
function dpRender() {
  const root = dpRoot(); if (!root) return;
  const q = (document.getElementById('dp-search') || {}).value || '';
  const rows = (dpState.all || []).filter(p => productVisibleToHub(p, dpState.hub) && (!q || smartMatch(q, (p.itemName || '') + ' ' + (p.sapCode || p.id))));
  dpState.rows = rows; dpState.orig = {};
  const hubSel = dpState.isAdmin ? `<div><label style="font-weight:700;">Commissary / Hub</label><br><select id="dp-hub" onchange="dpState.hub=this.value;dpRender()"><option value="">(Lahat)</option>${dpHubs().map(h => `<option ${h === dpState.hub ? 'selected' : ''}>${srchEsc(h)}</option>`).join('')}</select></div>` : `<div><b>🏭 ${srchEsc(dpState.hub || 'Commissary')}</b></div>`;
  let body = '';
  rows.forEach((p, i) => {
    const c = productCosts[p.id] || {};
    dpState.orig[p.id] = { cw: parseFloat(c.costWhole) || 0, cl: parseFloat(c.costLoose) || 0, pw: parseFloat(p.wholePrice) || 0, pl: parseFloat(p.loosePrice) || 0 };
    const age = dpDaysOld(p);
    const ageTxt = age == null ? '<small style="color:#94a3b8;">hindi pa napepresyuhan</small>' : `<small style="color:${age >= 3 ? '#dc2626' : '#64748b'};">${age === 0 ? 'ngayon' : age + ' araw na'}${age >= 3 ? ' ⚠️' : ''}</small>`;
    body += `<tr><td><b>${srchEsc(p.itemName || '')}</b><br><small style="font-family:monospace;color:#64748b;">${srchEsc(p.sapCode || p.id)}</small></td>
      <td>${ageTxt}</td>
      <td><input type="number" step="0.01" min="0" id="dp-cw-${i}" value="${dpState.orig[p.id].cw || ''}" style="width:90px" oninput="dpCostInput(${i})"> <small>/${srchEsc(p.wholeUOM || 'Whole')}</small><br>
          <input type="number" step="0.0001" min="0" id="dp-cl-${i}" value="${dpState.orig[p.id].cl || ''}" style="width:90px" oninput="dpMargin(${i})"> <small>/${srchEsc(p.looseUOM || 'Loose')}</small></td>
      <td><input type="number" step="0.01" min="0" id="dp-pw-${i}" value="${dpState.orig[p.id].pw}" style="width:90px" oninput="dpMargin(${i})"><br>
          <input type="number" step="0.01" min="0" id="dp-pl-${i}" value="${dpState.orig[p.id].pl}" style="width:90px" oninput="dpMargin(${i})"></td>
      <td id="dp-m-${i}"></td><td><button class="btn btn-sm btn-secondary" onclick="dpHistory('${p.id}')">🕘</button></td></tr>`;
  });
  root.innerHTML = `<div class="card"><div class="card-title"><span>💱 Daily Price Sheet — Presyo ng Araw</span></div>
    <p style="font-size:.85rem;color:#64748b;">I-update ang <b>puhunan</b> (galing supplier/Baguio) at ang <b>SRP</b> (presyong ibebenta). Kapag hindi mo binago ang SRP, susundin pa rin ang dating SRP. Ang mga order na na-place na ay hindi magbabago ng presyo. Ang puhunan ay hindi nakikita ng branch/customer.</p>
    <div style="display:flex;gap:.5rem;flex-wrap:wrap;align-items:end;margin-bottom:.6rem;">${hubSel}
      <div><label style="font-weight:700;">Dagdag para sa gas / biyahe %</label><br><input type="number" id="dp-extra" value="0" step="0.1" min="0" style="width:100px;"></div>
      <button class="btn btn-secondary btn-sm" onclick="dpAuto()">⚡ I-compute ang SRP mula sa puhunan (kung binago ang puhunan)</button>
      <button class="btn btn-secondary btn-sm" onclick="dpPrintList()">🖨️ Print Presyo Ngayon</button>
      <button class="btn btn-success" onclick="dpSave()">💾 I-save ang presyo ngayon</button></div>
    <small style="color:#64748b;">Formula: puhunan × (1 + overhead ${pricingRules.overheadPct}%) × (1 + tubo ${pricingRules.markupPct}%) × (1 + dagdag %).</small>
    <input type="text" id="dp-search" placeholder="🔎 Hanapin ang produkto..." oninput="dpRender()" value="${srchEsc(q)}" style="margin:.6rem 0;width:100%;">
    <div class="table-responsive"><table data-notools="1"><thead><tr><th>Produkto</th><th>Huling presyo</th><th>Puhunan ngayon<br><small>Whole / Loose</small></th><th>SRP<br><small>Whole / Loose</small></th><th>Tubo</th><th></th></tr></thead><tbody>${body || '<tr><td colspan="6">Walang produkto sa hub na ito.</td></tr>'}</tbody></table></div></div>`;
  rows.forEach((p, i) => dpMargin(i));
}
function dpV(id) { const e = document.getElementById(id); return e && e.value !== '' ? parseFloat(e.value) || 0 : 0; }
function dpCostInput(i) {
  const p = dpState.rows[i]; const conv = parseFloat(p.conversionFactor) || 1; const cl = document.getElementById('dp-cl-' + i);
  const cw = dpV('dp-cw-' + i); if (cl && conv > 1 && cw > 0) cl.value = (cw / conv).toFixed(4);
  dpMargin(i);
}
function dpMargin(i) {
  const el = document.getElementById('dp-m-' + i); if (!el) return;
  const cw = dpV('dp-cw-' + i), pw = dpV('dp-pw-' + i);
  if (!(cw > 0)) { el.innerHTML = '<small style="color:#94a3b8;">walang puhunan</small>'; return; }
  const m = marginInfo(cw, pw), low = pw < minPriceFor(cw);
  el.innerHTML = `<b style="color:${m.profit < 0 ? '#dc2626' : '#059669'}">${money(m.profit)}</b><br><small style="color:${low ? '#dc2626' : '#64748b'}">${m.margin == null ? '' : m.margin.toFixed(0) + '%'}${low ? ' ⚠️ mababa sa min ' + money(minPriceFor(cw)) : ''}</small>`;
}
function dpAuto() {
  const ex = parseFloat((document.getElementById('dp-extra') || {}).value) || 0;
  dpState.rows.forEach((p, i) => {
    const o = dpState.orig[p.id], cw = dpV('dp-cw-' + i), cl = dpV('dp-cl-' + i);
    if (cw > 0 && cw !== o.cw) document.getElementById('dp-pw-' + i).value = (suggestedPriceFor(cw) * (1 + ex / 100)).toFixed(2);
    if (cl > 0 && cl !== o.cl) document.getElementById('dp-pl-' + i).value = (suggestedPriceFor(cl) * (1 + ex / 100)).toFixed(2);
    dpMargin(i);
  });
}
async function dpSave() {
  const changes = [];
  dpState.rows.forEach((p, i) => {
    const o = dpState.orig[p.id], n = { cw: dpV('dp-cw-' + i), cl: dpV('dp-cl-' + i), pw: dpV('dp-pw-' + i), pl: dpV('dp-pl-' + i) };
    if (n.cw !== o.cw || n.cl !== o.cl || n.pw !== o.pw || n.pl !== o.pl) changes.push({ p, o, n });
  });
  if (!changes.length) { alert('Walang binago.'); return; }
  const low = changes.filter(c => c.n.cw > 0 && c.n.pw < minPriceFor(c.n.cw)).length;
  if (!await uiConfirm(`I-save ang ${changes.length} binagong presyo?${low ? `\n\n⚠️ ${low} ang mas mababa sa puhunan + overhead.` : ''}\n\nMagagamit na ito sa mga susunod na order. Hindi magbabago ang mga order na na-place na.`)) return;
  const u = getCurrentUser() || {}; const by = u.name || u.email || ''; const day = new Date().toISOString().slice(0, 10);
  try {
    const batch = db.batch(); const ts = firebase.firestore.FieldValue.serverTimestamp();
    changes.forEach(({ p, o, n }) => {
      batch.update(db.collection('products').doc(p.id), { wholePrice: n.pw, loosePrice: n.pl, priceUpdatedAt: ts, priceUpdatedBy: by });
      batch.set(db.collection('product_costs').doc(p.id), { costWhole: n.cw, costLoose: n.cl, updatedBy: u.email || '', updatedAt: ts }, { merge: true });
      batch.set(db.collection('price_history').doc(), { code: p.id, itemName: p.itemName || '', hub: p.commissarySource || dpState.hub || '', date: day, costWhole: n.cw, costLoose: n.cl, wholePrice: n.pw, loosePrice: n.pl, prevWholePrice: o.pw, prevLoosePrice: o.pl, prevCostWhole: o.cw, by, at: ts });
    });
    await batch.commit();
    changes.forEach(({ p, n }) => { p.wholePrice = n.pw; p.loosePrice = n.pl; p.priceUpdatedAt = { seconds: Math.floor(Date.now() / 1000) }; productCosts[p.id] = Object.assign({}, productCosts[p.id], { costWhole: n.cw, costLoose: n.cl }); });
    try { await logSystemAction('DAILY_PRICE_UPDATE', `${changes.length} presyo ang binago (${dpState.hub || 'lahat'})`); } catch (e) {}
    alert(`✅ Na-save ang ${changes.length} presyo para sa ${day}.`);
    dpRender();
  } catch (e) { alert('Error: ' + e.message); }
}
async function dpHistory(code) {
  const snap = await db.collection('price_history').where('code', '==', code).get();
  const rows = []; snap.forEach(d => rows.push(d.data()));
  rows.sort((a, b) => ((b.at && b.at.seconds) || 0) - ((a.at && a.at.seconds) || 0));
  const html = rows.slice(0, 30).map(r => `<tr><td>${srchEsc(r.date || '')}</td><td>${money(r.costWhole)}</td><td>${money(r.prevWholePrice)} → <b>${money(r.wholePrice)}</b></td><td>${money(r.loosePrice)}</td><td>${srchEsc(r.by || '')}</td></tr>`).join('') || '<tr><td colspan="5">Wala pang history.</td></tr>';
  arModal(`<h3>🕘 Price History — ${srchEsc((rows[0] && rows[0].itemName) || code)}</h3><div class="table-responsive"><table data-notools="1"><thead><tr><th>Petsa</th><th>Puhunan (W)</th><th>SRP Whole</th><th>SRP Loose</th><th>Nag-update</th></tr></thead><tbody>${html}</tbody></table></div>`);
}
function dpPrintList() {
  const rows = dpState.rows.map((p, i) => `<tr><td>${srchEsc(p.sapCode || p.id)}</td><td>${srchEsc(p.itemName || '')}</td><td class="num">${money(dpV('dp-pw-' + i))} / ${srchEsc(p.wholeUOM || '')}</td><td class="num">${money(dpV('dp-pl-' + i))} / ${srchEsc(p.looseUOM || '')}</td></tr>`).join('');
  printHtmlDoc('Presyo ngayon', `<h1>Presyo ng Araw — ${srchEsc(dpState.hub || 'Commissary')}</h1><div class="meta">${new Date().toLocaleDateString('en-PH')} · ${printedByLine()}</div><table><thead><tr><th>Code</th><th>Produkto</th><th class="num">Whole</th><th class="num">Loose</th></tr></thead><tbody>${rows}</tbody></table>`);
}

// ========================================================
// 📒 AR LEDGER — bayad ng customers/branches (Unpaid / Partial / Paid)
// ar_accounts/{orderId}: { orderId, total, paid, status, payments:[{id,date,amount,mode,ref,notes,by,at,photoId,voided}] }
// ar_payment_photos/{photoId}: { dataUrl }
// ========================================================
const AR_MODES = ['Cash', 'GCash', 'Maya', 'Bank Transfer', 'Check', 'Inter-company Transfer', 'Others'];
let arState = { orders: [], accts: {}, tab: 'all', q: '', from: '', to: '', customer: '' };
function arModal(html) {
  let m = document.getElementById('ar-modal');
  if (!m) { m = document.createElement('div'); m.id = 'ar-modal'; m.className = 'modal-overlay'; document.body.appendChild(m); }
  m.style.display = 'flex';
  m.innerHTML = `<div class="modal-content" style="max-width:760px;width:96%;max-height:90vh;overflow:auto;padding:1.2rem;background:#fff;border-radius:.6rem;">${html}<div style="text-align:right;margin-top:.8rem;"><button class="btn btn-secondary" onclick="arCloseModal()">Isara</button></div></div>`;
}
function arCloseModal() { const m = document.getElementById('ar-modal'); if (m) m.style.display = 'none'; }
function arRoot() { return document.getElementById('ar-root'); }
function arCustomer(o) { return o.customerName || o.branchName || '—'; }
function arOrderTotal(o) { return parseFloat(o.totalAmount) || 0; }
function arPaid(a) { return ((a && a.payments) || []).reduce((s, p) => s + (p.voided ? 0 : (parseFloat(p.amount) || 0)), 0); }
function arStatusOf(total, paid) { return paid >= total - 0.005 && total > 0 ? 'Paid' : (paid > 0.005 ? 'Partial' : 'Unpaid'); }
function arIncluded(o) { const st = o.status || ''; if (o.isAgentOrder && !/^Cancel|Rejected|Cancellation Requested/.test(st)) return true; return !/^Cancel|Rejected|Pending Admin|^Pending Preparation$|Cancellation Requested/.test(st); }
async function loadArLedger() {
  const root = arRoot(); if (!root || !db) return;
  root.innerHTML = '<div class="card">Kinukuha ang ledger...</div>';
  try {
    const [oSnap, aSnap, pSnap, lSnap, cSnap] = await Promise.all([db.collection('orders').orderBy('createdAt', 'desc').limit(500).get(), db.collection('ar_accounts').get(), db.collection('products').get(), db.collection('ar_legacy').get(), db.collection('customers').get()]);
    arState.customers = []; cSnap.forEach(d => arState.customers.push({ id: d.id, ...d.data() }));
    arState.subs = []; try { (await db.collection('payment_submissions').get()).forEach(d => arState.subs.push({ id: d.id, ...d.data() })); } catch (e) {}
    const hubOf = {}; pSnap.forEach(d => { hubOf[d.id] = d.data().commissarySource || ''; });
    const u = getCurrentUser() || {}; const admin = normalizeRole(u.role) === 'admin'; const myHub = admin ? '' : myHubName();
    arState.orders = []; oSnap.forEach(d => {
      const o = { id: d.id, ...d.data() }; if (!arIncluded(o)) return;
      const hubs = new Set((o.items || []).map(i => hubOf[i.itemCode] || '').filter(Boolean));
      if (myHub && hubs.size && ![...hubs].some(h => hubKey(h) === hubKey(myHub))) return;
      o._hubs = [...hubs]; arState.orders.push(o);
    });
    lSnap.forEach(d => {
      const l = d.data(); if (myHub && l.hub && hubKey(l.hub) !== hubKey(myHub)) return;
      arState.orders.push({ id: d.id, orderId: d.id, siNumber: l.invoiceNo, customerName: l.customerName, customerId: l.customerId || '', totalAmount: l.total, targetDeliveryDate: l.date, dueDate: l.dueDate || '', status: 'Legacy', branchName: '', _legacy: true, _hubs: [] });
    });
    arState.accts = {}; aSnap.forEach(d => arState.accts[d.id] = d.data());
    arRender();
  } catch (e) { root.innerHTML = `<div class="card" style="color:#dc2626;">Error: ${srchEsc(e.message)}</div>`; }
}
function arRowsFiltered() {
  const S = arState;
  return S.orders.map(o => { const a = S.accts[o.id]; const total = arOrderTotal(o), paid = arPaid(a); return { o, a, total, paid, bal: Math.max(0, total - paid), st: arStatusOf(total, paid) }; })
    .filter(r => (S.tab === 'all' || (S.tab === 'pending' ? arPendingFor(r.o.id).length > 0 : r.st.toLowerCase() === S.tab)) && (!S.customer || arCustomer(r.o) === S.customer)
      && (!S.q || smartMatch(S.q, arCustomer(r.o) + ' ' + (r.o.siNumber || '') + ' ' + r.o.id))
      && (!S.from || arDate(r.o) >= S.from) && (!S.to || arDate(r.o) <= S.to));
}
function arDate(o) { if (o.targetDeliveryDate) return o.targetDeliveryDate; const t = o.createdAt; const d = t && (t.toDate ? t.toDate() : t.seconds ? new Date(t.seconds * 1000) : new Date(t)); return d ? d.toISOString().slice(0, 10) : ''; }
function arAge(o) { const d = arDate(o); return d ? Math.max(0, Math.floor((Date.now() - new Date(d).getTime()) / 86400000)) : 0; }
function arRender() { const v = arState.view || 'ledger'; if (v === 'customers') return arRenderCustomers(); if (v === 'monthly') return arRenderMonthly(); return arRenderLedger(); }
function arViewTabs() { const v = arState.view || 'ledger'; return `<div style="display:flex;gap:.4rem;flex-wrap:wrap;margin-bottom:.7rem;">${[['ledger', '📒 Ledger'], ['customers', '👥 Per Customer (Balance)'], ['monthly', '🗓️ Buwanang Report']].map(([k, l]) => `<button class="btn btn-sm ${v === k ? 'btn-primary' : 'btn-secondary'}" onclick="arState.view='${k}';arRender()">${l}</button>`).join('')}</div>`; }
function arRenderLedger() {
  const root = arRoot(); if (!root) return; const S = arState;
  const rows = arRowsFiltered();
  const tot = rows.reduce((a, r) => ({ t: a.t + r.total, p: a.p + r.paid, b: a.b + r.bal }), { t: 0, p: 0, b: 0 });
  const customers = [...new Set(S.orders.map(arCustomer))].sort();
  const tabs = ['all', 'unpaid', 'partial', 'paid', 'pending'].map(t => `<button class="btn btn-sm ${S.tab === t ? 'btn-primary' : 'btn-secondary'}" onclick="arState.tab='${t}';arRender()">${{ all: 'Lahat', unpaid: '❌ Unpaid', partial: '🟡 Partial', paid: '✅ Paid', pending: `🔔 Para i-confirm (${(S.subs || []).filter(x => x.status === 'pending').length})` }[t]}</button>`).join(' ');
  const badge = st => `<span class="badge ${st === 'Paid' ? 'badge-branch' : st === 'Partial' ? 'badge-warning' : 'badge-admin'}">${st}</span>`;
  const body = rows.map(r => `<tr><td>${srchEsc(arDate(r.o))}</td><td><b>${srchEsc(r.o.siNumber || '—')}</b><br><small>${srchEsc(r.o.id)}</small></td><td>${srchEsc(arCustomer(r.o))}${r.o.customerName && r.o.branchName ? `<br><small style="color:#64748b;">${srchEsc(r.o.branchName)}</small>` : ''}</td>
    <td class="num">${money(r.total)}</td><td class="num">${money(r.paid)}</td><td class="num"><b style="color:${r.bal > 0 ? '#b91c1c' : '#059669'}">${money(r.bal)}</b>${r.bal > 0 ? `<br><small style="color:#64748b;">${arAge(r.o)} araw</small>` : ''}</td><td>${badge(r.st)}</td>
    <td>${arPendingFor(r.o.id).length ? `<button class="btn btn-sm btn-warning" onclick="arReviewSub('${r.o.id}')">🔔 I-confirm</button> ` : ''}${r.o._legacy ? '' : `<button class="btn btn-sm btn-secondary" onclick="ordReceiptPreview('${r.o.id}')">🧾</button> `}${r.bal > 0 ? `<button class="btn btn-sm btn-success" onclick="arOpenPay('${r.o.id}')">💵 Bayad</button> ` : ''}<button class="btn btn-sm btn-secondary" onclick="arViewPayments('${r.o.id}')">🔍</button></td></tr>`).join('') || '<tr><td colspan="8" style="text-align:center;color:#94a3b8;">Walang tugma.</td></tr>';
  root.innerHTML = `<div class="card"><div class="card-title"><span>📒 AR Ledger — Benta at Bayad ng Customers</span><button class="btn btn-secondary btn-sm" onclick="loadArLedger()">🔄 Refresh</button></div>
    ${arViewTabs()}
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:.5rem;margin-bottom:.7rem;">
      <div style="background:#eff6ff;padding:.6rem;border-radius:.4rem;"><small>Total Benta</small><br><b>${money(tot.t)}</b></div>
      <div style="background:#ecfdf5;padding:.6rem;border-radius:.4rem;"><small>Nakolekta</small><br><b>${money(tot.p)}</b></div>
      <div style="background:#fef2f2;padding:.6rem;border-radius:.4rem;"><small>Utang / Unpaid</small><br><b style="color:#b91c1c;">${money(tot.b)}</b></div></div>
    <div style="display:flex;gap:.4rem;flex-wrap:wrap;align-items:end;margin-bottom:.6rem;">${tabs}
      <select onchange="arState.customer=this.value;arRender()"><option value="">Lahat ng customer</option>${customers.map(c => `<option ${c === S.customer ? 'selected' : ''}>${srchEsc(c)}</option>`).join('')}</select>
      <input type="date" value="${S.from}" onchange="arState.from=this.value;arRender()" title="Mula"><input type="date" value="${S.to}" onchange="arState.to=this.value;arRender()" title="Hanggang">
      <input type="text" id="ar-search" value="${srchEsc(S.q)}" placeholder="🔎 Customer / SI / PO..." oninput="arState.q=this.value;arRenderKeepFocus()" style="min-width:180px;">
      <button class="btn btn-secondary btn-sm" onclick="arPrintStatement()">🖨️ Statement</button>
      <button class="btn btn-secondary btn-sm" onclick="arExportSalesCSV()">📤 Sales CSV</button>
      <button class="btn btn-secondary btn-sm" onclick="arExportPaymentsCSV()">📤 Payments CSV</button>
      <button class="btn btn-secondary btn-sm" onclick="arDownloadLegacyTemplate()">📄 Template (lumang AR)</button>
      <button class="btn btn-secondary btn-sm" onclick="arImportLegacy()">📥 Import lumang AR</button></div>
    <div class="table-responsive"><table data-notools="1"><thead><tr><th>Petsa</th><th>SI / PO</th><th>Customer</th><th class="num">Total</th><th class="num">Bayad</th><th class="num">Balance</th><th>Status</th><th></th></tr></thead><tbody>${body}</tbody></table></div></div>`;
}
function arRenderKeepFocus() { arRender(); const e = document.getElementById('ar-search'); if (e) { e.focus(); e.setSelectionRange(e.value.length, e.value.length); } }
function arOpenPay(orderId) {
  const o = arState.orders.find(x => x.id === orderId); if (!o) return;
  const total = arOrderTotal(o), paid = arPaid(arState.accts[orderId]), bal = Math.max(0, total - paid);
  arModal(`<h3>💵 Mag-record ng Bayad</h3><p><b>${srchEsc(arCustomer(o))}</b> · SI ${srchEsc(o.siNumber || o.id)}<br>Total ${money(total)} · Bayad na ${money(paid)} · <b style="color:#b91c1c;">Balance ${money(bal)}</b></p>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:.6rem;">
      <div><label>Halaga (₱)</label><input type="number" id="ar-amt" step="0.01" min="0" value="${bal.toFixed(2)}"></div>
      <div><label>Petsa ng bayad</label><input type="date" id="ar-date" value="${new Date().toISOString().slice(0, 10)}"></div>
      <div><label>Mode of payment</label><select id="ar-mode">${AR_MODES.map(m => `<option>${m}</option>`).join('')}</select></div>
      <div><label>Reference / OR / Check No.</label><input type="text" id="ar-ref"></div></div>
    <div style="margin-top:.6rem;"><label>📷 Larawan ng bayad (kailangan)</label><input type="file" id="ar-photo" accept="image/*" capture="environment"></div>
    <div style="margin-top:.6rem;"><label>Notes</label><input type="text" id="ar-notes"></div>
    <div style="margin-top:.8rem;"><button class="btn btn-success" onclick="arSubmitPay('${orderId}')">💾 I-save ang bayad</button></div>`);
}
async function arSubmitPay(orderId) {
  const o = arState.orders.find(x => x.id === orderId); if (!o) return;
  const amount = parseFloat((document.getElementById('ar-amt') || {}).value) || 0;
  const file = (document.getElementById('ar-photo') || {}).files && document.getElementById('ar-photo').files[0];
  const mode = (document.getElementById('ar-mode') || {}).value, ref = ((document.getElementById('ar-ref') || {}).value || '').trim();
  const date = (document.getElementById('ar-date') || {}).value, notes = ((document.getElementById('ar-notes') || {}).value || '').trim();
  if (!(amount > 0)) { alert('Maglagay ng halaga.'); return; }
  if (!date) { alert('Maglagay ng petsa ng bayad.'); return; }
  if (!file) { alert('Kailangan ng larawan ng bayad (resibo / screenshot / deposit slip).'); return; }
  let dataUrl; try { dataUrl = await compressImageFile(file, 1100, 0.7); } catch (e) { alert(e.message); return; }
  const u = getCurrentUser() || {}; const by = u.name || u.email || '';
  const pid = 'PAY-' + Date.now().toString().slice(-8) + Math.floor(Math.random() * 90 + 10);
  const ref0 = db.collection('ar_accounts').doc(orderId);
  try {
    await db.runTransaction(async tx => {
      const snap = await tx.get(ref0); const a = snap.exists ? snap.data() : { orderId, payments: [] };
      const total = arOrderTotal(o), paid = arPaid(a);
      if (amount > total - paid + 0.005) throw new Error(`Sobra ang halaga. Balance lang ay ${money(total - paid)}.`);
      const payments = (a.payments || []).concat([{ id: pid, date, amount, mode, ref, notes, by, at: new Date().toISOString(), photoId: pid }]);
      const np = paid + amount;
      tx.set(db.collection('ar_payment_photos').doc(pid), { dataUrl, orderId, createdAt: firebase.firestore.FieldValue.serverTimestamp() });
      tx.set(ref0, { orderId, siNumber: o.siNumber || '', customer: arCustomer(o), total, paid: np, status: arStatusOf(total, np), payments, updatedAt: firebase.firestore.FieldValue.serverTimestamp() });
    });
    try { await logSystemAction('AR_PAYMENT', `${arCustomer(o)} · ${o.siNumber || o.id} · ${money(amount)} · ${mode}`); } catch (e) {}
    await arSyncOrder(orderId);
    arCloseModal(); await loadArLedger();
  } catch (e) { alert('Error: ' + e.message); }
}
function arViewPayments(orderId) {
  const o = arState.orders.find(x => x.id === orderId); if (!o) return; const a = arState.accts[orderId] || { payments: [] };
  const rows = (a.payments || []).map(p => `<tr style="${p.voided ? 'opacity:.5;text-decoration:line-through;' : ''}"><td>${srchEsc(p.date)}</td><td>${money(p.amount)}</td><td>${srchEsc(p.mode)}</td><td>${srchEsc(p.ref || '')}</td><td>${srchEsc(p.by || '')}</td>
    <td><button class="btn btn-sm btn-secondary" onclick="arShowPhoto('${p.photoId}')">📷</button>${p.voided ? ` <small>VOID: ${srchEsc(p.voidReason || '')}</small>` : ` <button class="btn btn-sm btn-danger" onclick="arVoidPayment('${orderId}','${p.id}')">🚫</button>`}</td></tr>`).join('') || '<tr><td colspan="6">Wala pang bayad.</td></tr>';
  const total = arOrderTotal(o), paid = arPaid(a);
  arModal(`<h3>🔍 ${srchEsc(arCustomer(o))} · SI ${srchEsc(o.siNumber || o.id)}</h3><p>Total ${money(total)} · Bayad ${money(paid)} · Balance <b>${money(Math.max(0, total - paid))}</b> · ${arStatusOf(total, paid)}</p><div class="table-responsive"><table data-notools="1"><thead><tr><th>Petsa</th><th>Halaga</th><th>Mode</th><th>Ref</th><th>Tumanggap</th><th></th></tr></thead><tbody>${rows}</tbody></table></div><div id="ar-photo-box" style="margin-top:.6rem;"></div>`);
}
async function arShowPhoto(pid) {
  const box = document.getElementById('ar-photo-box'); if (!box) return;
  if (!pid) { box.textContent = 'Walang larawan (galing sa import ng lumang AR).'; return; }
  try { const d = await db.collection('ar_payment_photos').doc(pid).get(); box.innerHTML = d.exists ? `<img src="${d.data().dataUrl}" style="max-width:100%;border:1px solid #cbd5e1;border-radius:.4rem;">` : 'Walang larawan.'; } catch (e) { box.textContent = e.message; }
}
async function arVoidPayment(orderId, pid) {
  const reason = await uiPrompt('Dahilan ng pag-void ng bayad na ito:'); if (!reason) return;
  const ref0 = db.collection('ar_accounts').doc(orderId); const o = arState.orders.find(x => x.id === orderId);
  try {
    await db.runTransaction(async tx => {
      const snap = await tx.get(ref0); if (!snap.exists) throw new Error('Walang record.');
      const a = snap.data(); const u = getCurrentUser() || {};
      const payments = (a.payments || []).map(p => p.id === pid ? Object.assign({}, p, { voided: true, voidReason: reason, voidedBy: u.name || u.email || '' }) : p);
      const total = o ? arOrderTotal(o) : (a.total || 0), np = payments.reduce((s, p) => s + (p.voided ? 0 : p.amount), 0);
      tx.update(ref0, { payments, paid: np, status: arStatusOf(total, np) });
    });
    try { await logSystemAction('AR_PAYMENT_VOID', `${orderId} ${pid}: ${reason}`); } catch (e) {}
    await arSyncOrder(orderId);
    arCloseModal(); await loadArLedger();
  } catch (e) { alert('Error: ' + e.message); }
}
function arPrintStatement() {
  const rows = arRowsFiltered(); const cust = arState.customer || 'Lahat ng customer';
  const body = rows.map(r => `<tr><td>${srchEsc(arDate(r.o))}</td><td>${srchEsc(r.o.siNumber || r.o.id)}</td><td>${srchEsc(arCustomer(r.o))}</td><td class="num">${money(r.total)}</td><td class="num">${money(r.paid)}</td><td class="num">${money(r.bal)}</td><td>${r.st}</td></tr>`).join('');
  const t = rows.reduce((a, r) => ({ t: a.t + r.total, p: a.p + r.paid, b: a.b + r.bal }), { t: 0, p: 0, b: 0 });
  printHtmlDoc('Statement of Account', `<h1>Statement of Account</h1><div class="meta">${srchEsc(cust)} · ${printedByLine()}</div><table><thead><tr><th>Petsa</th><th>SI/PO</th><th>Customer</th><th class="num">Total</th><th class="num">Bayad</th><th class="num">Balance</th><th>Status</th></tr></thead><tbody>${body}<tr class="total"><td colspan="3">KABUUAN</td><td class="num">${money(t.t)}</td><td class="num">${money(t.p)}</td><td class="num">${money(t.b)}</td><td></td></tr></tbody></table>`);
}
function arExportSalesCSV() {
  const L = [['Date', 'Invoice_No', 'PO_No', 'Customer', 'Branch', 'Subtotal', 'Discount', 'VAT', 'Total', 'Paid', 'Balance', 'Status'].join(',')];
  arRowsFiltered().forEach(r => L.push([arDate(r.o), csvCell(r.o.siNumber || ''), csvCell(r.o.id), csvCell(arCustomer(r.o)), csvCell(r.o.branchName || ''), (+r.o.subtotalAmount || 0).toFixed(2), (+r.o.discountAmount || 0).toFixed(2), (+r.o.vatAmount || 0).toFixed(2), r.total.toFixed(2), r.paid.toFixed(2), r.bal.toFixed(2), r.st].join(',')));
  downloadCSVFile(L.join('\r\n'), 'AR_Sales.csv');
}
function arExportPaymentsCSV() {
  const L = [['Payment_Date', 'Customer', 'Invoice_No', 'PO_No', 'Amount', 'Mode', 'Reference', 'Received_By', 'Voided'].join(',')];
  arRowsFiltered().forEach(r => ((r.a && r.a.payments) || []).forEach(p => L.push([p.date, csvCell(arCustomer(r.o)), csvCell(r.o.siNumber || ''), csvCell(r.o.id), (+p.amount || 0).toFixed(2), csvCell(p.mode), csvCell(p.ref || ''), csvCell(p.by || ''), p.voided ? 'YES' : ''].join(','))));
  downloadCSVFile(L.join('\r\n'), 'AR_Payments.csv');
}


// ========================================================
// 📥 IMPORT NG LUMANG AR (galing Google Sheet) + REPORTS PER CUSTOMER / BUWAN
// ========================================================
function arParseDate(s) {
  s = String(s || '').trim(); if (!s) return '';
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(s); if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
  m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s); if (m) return `${m[3]}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}`; // MM/DD/YYYY
  const d = new Date(s); return isNaN(d) ? '' : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function arNum(s) { const n = parseFloat(String(s == null ? '' : s).replace(/[₱,\s]/g, '')); return isNaN(n) ? 0 : n; }
function arDownloadLegacyTemplate() {
  const t = [
    '#GABAY SA PAG-IMPORT NG LUMANG AR (Utang ng customers). Burahin ang lahat ng linyang nagsisimula sa #.',
    '#Customer_Code = ID ng customer sa Customers list (hal. C-0001). Puwedeng iwanang blangko kung Customer_Name na lang ang gagamitin.',
    '#Customer_Name = Pangalan ng customer. Itutugma ito sa Customers list (code muna, tapos pangalan). Kung walang tugma, puwedeng gumawa ng bagong customer.',
    '#Invoice_No = SI / Invoice / OR number ng benta. Kailangan at hindi puwedeng doble.',
    '#Invoice_Date = petsa ng benta (YYYY-MM-DD o MM/DD/YYYY).   Due_Date = (optional) petsa ng due.',
    '#Invoice_Amount = kabuuang halaga ng invoice.   Amount_Paid = kabuuang nabayad na hanggang ngayon (0 kung wala pa).',
    '#Last_Payment_Date / Last_Payment_Mode (Cash, GCash, Maya, Bank Transfer, Check, Inter-company Transfer, Others) / Reference = para sa huling bayad.',
    '#Commissary_Hub = (optional) kung saang commissary ang benta.   Notes = (optional).',
    '#Halimbawa:,C-0001,Juan Store,SI-1001,2026-10-05,2026-10-20,5000,2000,2026-10-12,GCash,GC12345,,Hulugan',
    'Customer_Code,Customer_Name,Invoice_No,Invoice_Date,Due_Date,Invoice_Amount,Amount_Paid,Last_Payment_Date,Last_Payment_Mode,Reference,Commissary_Hub,Notes'
  ];
  downloadCSVFile(t.join('\r\n') + '\r\n', 'AR_Opening_Import_Template.csv');
}
let arImpPlan = null;
async function arImportLegacy() {
  const text0 = await pickCSVFile(); if (!text0) return;
  const text = text0.split(/\r?\n/).filter(l => !/^\s*"?#/.test(l)).join('\n');
  const objs = csvToObjects(text); if (!objs.length) { alert('Walang row. Gamitin ang Template.'); return; }
  const cSnap = await db.collection('customers').get(); const custs = []; cSnap.forEach(d => custs.push({ id: d.id, ...d.data() }));
  const byCode = {}, byName = {}; custs.forEach(c => { if (c.code) byCode[String(c.code).toLowerCase()] = c; byName[hubKey(c.name)] = c; });
  const existing = new Set((arState.orders || []).filter(o => o._legacy).map(o => o.id));
  const u = getCurrentUser() || {}; const myHub = normalizeRole(u.role) === 'admin' ? '' : myHubName();
  const plan = { rows: [], errors: [], unmatched: {}, dup: 0, custs };
  const seen = new Set();
  objs.forEach((r, i) => {
    const line = i + 1, inv = (r.invoice_no || '').trim(), name = (r.customer_name || '').trim(), code = (r.customer_code || r.customer_id || '').trim();
    if (!inv && !name && !arNum(r.invoice_amount)) return;
    const total = arNum(r.invoice_amount), paid = arNum(r.amount_paid), date = arParseDate(r.invoice_date);
    if (!inv) { plan.errors.push(`Row ${line}: walang Invoice_No`); return; }
    if (!(total > 0)) { plan.errors.push(`Row ${line} (${inv}): mali ang Invoice_Amount`); return; }
    if (paid < 0 || paid > total + 0.005) { plan.errors.push(`Row ${line} (${inv}): ang Amount_Paid ay mali o mas malaki sa invoice`); return; }
    if (!date) { plan.errors.push(`Row ${line} (${inv}): mali o walang Invoice_Date`); return; }
    let cust = (code && byCode[code.toLowerCase()]) || (name && byName[hubKey(name)]) || null;
    if (!cust && !name) { plan.errors.push(`Row ${line} (${inv}): walang Customer_Code o Customer_Name`); return; }
    const custName = cust ? cust.name : name;
    const id = 'LEG-' + invSlug(inv + '-' + (cust ? cust.id : custName)).slice(0, 80);
    if (existing.has(id) || seen.has(id)) { plan.dup++; return; }
    seen.add(id);
    if (!cust) plan.unmatched[hubKey(name)] = name;
    plan.rows.push({ id, inv, cust, custName, date, due: arParseDate(r.due_date), total, paid, lastDate: arParseDate(r.last_payment_date) || date, mode: (r.last_payment_mode || 'Others').trim() || 'Others', ref: (r.reference || '').trim(), hub: (r.commissary_hub || myHub || '').trim(), notes: (r.notes || '').trim() });
  });
  arImpPlan = plan;
  const un = Object.values(plan.unmatched);
  const sum = plan.rows.reduce((a, r) => ({ t: a.t + r.total, p: a.p + r.paid }), { t: 0, p: 0 });
  arModal(`<h3>📥 Preview — Import ng Lumang AR</h3>
    <p>✅ Handa: <b>${plan.rows.length}</b> invoice · Total ${money(sum.t)} · Nabayad na ${money(sum.p)} · <b style="color:#b91c1c;">Utang ${money(sum.t - sum.p)}</b><br>
    ⏭️ Nilaktawan (doble): ${plan.dup} · ❌ May mali: ${plan.errors.length}</p>
    ${un.length ? `<div style="background:#fffbeb;border:1px solid #fcd34d;padding:.6rem;border-radius:.4rem;margin:.5rem 0;"><b>⚠️ ${un.length} customer ang walang tugma sa Customers list:</b><br><small>${un.map(srchEsc).join(', ')}</small><br><label style="margin-top:.4rem;display:block;"><input type="checkbox" id="ar-imp-newcust" checked> Gumawa ng bagong customer (may awtomatikong code) para sa mga ito</label><small>Kung hindi lagyan ng tsek, hindi isasama ang mga invoice nila.</small></div>` : ''}
    ${plan.errors.length ? `<div style="background:#fef2f2;border:1px solid #fca5a5;padding:.6rem;border-radius:.4rem;max-height:140px;overflow:auto;"><b>Hindi isasama:</b><br><small>${plan.errors.slice(0, 40).map(srchEsc).join('<br>')}</small></div>` : ''}
    <div style="margin-top:.8rem;"><button class="btn btn-success" onclick="arImportConfirm()" ${plan.rows.length ? '' : 'disabled'}>✅ Ituloy ang Import</button></div>`);
}
async function arImportConfirm() {
  const plan = arImpPlan; if (!plan) return; const u = getCurrentUser() || {}; const by = u.name || u.email || '';
  const mk = (document.getElementById('ar-imp-newcust') || {}).checked;
  try {
    const ts = firebase.firestore.FieldValue.serverTimestamp(); let batch = db.batch(), n = 0, imported = 0, skipped = 0, newC = 0;
    const flush = async () => { await batch.commit(); batch = db.batch(); };
    const newMap = {}; const names = Object.values(plan.unmatched);
    if (names.length && mk) {
      const codes = nextCustomerCodes(plan.custs, names.length);
      for (let i = 0; i < names.length; i++) { const ref = db.collection('customers').doc(); newMap[hubKey(names[i])] = { id: ref.id, name: names[i], code: codes[i] }; batch.set(ref, { name: names[i], code: codes[i], address: '', contact: '', bank: '', type: 'Retail', createdAt: ts, updatedAt: ts, source: 'ar-import' }); newC++; if (++n % 400 === 0) await flush(); }
    }
    for (const r of plan.rows) {
      const cust = r.cust || newMap[hubKey(r.custName)];
      if (!cust) { skipped++; continue; }
      const payments = r.paid > 0 ? [{ id: 'OPEN-' + r.id, date: r.lastDate, amount: r.paid, mode: r.mode, ref: r.ref, notes: 'Opening balance import (kabuuang nabayad na)', by, at: new Date().toISOString(), photoId: '' }] : [];
      batch.set(db.collection('ar_legacy').doc(r.id), { invoiceNo: r.inv, customerId: cust.id, customerCode: cust.code || '', customerName: cust.name, date: r.date, dueDate: r.due, total: r.total, hub: r.hub, notes: r.notes, source: 'import', importedBy: by, importedAt: ts });
      batch.set(db.collection('ar_accounts').doc(r.id), { orderId: r.id, siNumber: r.inv, customer: cust.name, total: r.total, paid: r.paid, status: arStatusOf(r.total, r.paid), payments, updatedAt: ts });
      imported++; n += 2; if (n >= 400) { await flush(); n = 0; }
    }
    await batch.commit();
    try { await logSystemAction('AR_LEGACY_IMPORT', `${imported} invoice, ${newC} bagong customer`); } catch (e) {}
    arCloseModal(); alert(`✅ Na-import ang ${imported} invoice${newC ? ` at ${newC} bagong customer` : ''}${skipped ? ` (${skipped} nilaktawan: walang customer)` : ''}.`);
    arImpPlan = null; await loadArLedger();
  } catch (e) { alert('Error sa import: ' + e.message); }
}

// ---- helpers ng reports ----
function arAllRows() { return arState.orders.map(o => { const a = arState.accts[o.id], total = arOrderTotal(o), paid = arPaid(a); return { o, a, total, paid, bal: Math.max(0, total - paid), st: arStatusOf(total, paid) }; }); }
function arCustKey(o) { return o.customerId ? 'id:' + o.customerId : 'n:' + hubKey(arCustomer(o)); }
function arCustCode(o) { const c = (arState.customers || []).find(x => (o.customerId && x.id === o.customerId) || hubKey(x.name) === hubKey(arCustomer(o))); return c ? (c.code || '') : ''; }
function arLastPay(rows) { let best = null; rows.forEach(r => ((r.a && r.a.payments) || []).forEach(p => { if (!p.voided && (!best || p.date > best.date)) best = p; })); return best; }
function arCustomerSummary() {
  const g = {}; arAllRows().forEach(r => { const k = arCustKey(r.o); (g[k] = g[k] || { name: arCustomer(r.o), code: arCustCode(r.o), rows: [] }).rows.push(r); });
  return Object.values(g).map(c => {
    const billed = c.rows.reduce((s, r) => s + r.total, 0), paid = c.rows.reduce((s, r) => s + r.paid, 0), bal = c.rows.reduce((s, r) => s + r.bal, 0);
    const lp = arLastPay(c.rows); const ag = [0, 0, 0, 0];
    c.rows.forEach(r => { if (r.bal > 0) { const d = arAge(r.o); ag[d <= 30 ? 0 : d <= 60 ? 1 : d <= 90 ? 2 : 3] += r.bal; } });
    return { name: c.name, code: c.code, billed, paid, bal, lastDate: lp ? lp.date : '', lastAmt: lp ? lp.amount : 0, lastMode: lp ? lp.mode : '', ag, n: c.rows.length };
  }).sort((a, b) => b.bal - a.bal);
}
function arRenderCustomers() {
  const root = arRoot(); if (!root) return; const only = arState.onlyBal !== false;
  let list = arCustomerSummary(); if (only) list = list.filter(c => c.bal > 0.005);
  const q = arState.q || ''; if (q) list = list.filter(c => smartMatch(q, c.name + ' ' + c.code));
  const T = list.reduce((a, c) => ({ b: a.b + c.billed, p: a.p + c.paid, l: a.l + c.bal, g: a.g.map((x, i) => x + c.ag[i]) }), { b: 0, p: 0, l: 0, g: [0, 0, 0, 0] });
  const rows = list.map(c => `<tr><td><b>${srchEsc(c.name)}</b><br><small style="font-family:monospace;color:#64748b;">${srchEsc(c.code)}</small></td><td class="num">${money(c.billed)}</td><td class="num">${money(c.paid)}</td><td class="num"><b style="color:#b91c1c;">${money(c.bal)}</b></td><td>${c.lastDate ? `${srchEsc(c.lastDate)}<br><small>${money(c.lastAmt)} · ${srchEsc(c.lastMode)}</small>` : '<small style="color:#94a3b8;">wala pa</small>'}</td>${c.ag.map(x => `<td class="num">${x ? money(x) : '—'}</td>`).join('')}<td><button class="btn btn-sm btn-secondary" onclick="arState.customer='${srchEsc(c.name).replace(/'/g, '&#39;')}';arState.view='ledger';arState.tab='all';arRender()">🔍</button></td></tr>`).join('') || '<tr><td colspan="10" style="text-align:center;color:#94a3b8;">Walang customer na may utang.</td></tr>';
  root.innerHTML = `<div class="card"><div class="card-title"><span>📒 AR — Balance Per Customer</span><button class="btn btn-secondary btn-sm" onclick="loadArLedger()">🔄 Refresh</button></div>${arViewTabs()}
    <div style="display:flex;gap:.4rem;flex-wrap:wrap;align-items:center;margin-bottom:.6rem;"><label><input type="checkbox" ${only ? 'checked' : ''} onchange="arState.onlyBal=this.checked;arRender()"> May utang lang</label>
      <input type="text" id="ar-search" value="${srchEsc(q)}" placeholder="🔎 Customer / code" oninput="arState.q=this.value;arRenderCustomers();var e=document.getElementById('ar-search');e.focus();e.setSelectionRange(e.value.length,e.value.length)">
      <button class="btn btn-secondary btn-sm" onclick="arPrintCustomers()">🖨️ Print</button><button class="btn btn-secondary btn-sm" onclick="arExportCustomersCSV()">📤 CSV</button></div>
    <div class="table-responsive"><table data-notools="1"><thead><tr><th>Customer</th><th class="num">Total Benta</th><th class="num">Nabayad</th><th class="num">Balance</th><th>Huling Bayad</th><th class="num">0–30</th><th class="num">31–60</th><th class="num">61–90</th><th class="num">90+</th><th></th></tr></thead>
    <tbody>${rows}<tr class="total"><td><b>KABUUAN</b></td><td class="num">${money(T.b)}</td><td class="num">${money(T.p)}</td><td class="num"><b>${money(T.l)}</b></td><td></td>${T.g.map(x => `<td class="num">${money(x)}</td>`).join('')}<td></td></tr></tbody></table></div></div>`;
}
function arCustomersTableHtml() {
  const list = arCustomerSummary().filter(c => c.bal > 0.005);
  return `<table><thead><tr><th>Customer</th><th class="num">Benta</th><th class="num">Nabayad</th><th class="num">Balance</th><th>Huling Bayad</th><th class="num">0–30</th><th class="num">31–60</th><th class="num">61–90</th><th class="num">90+</th></tr></thead><tbody>${list.map(c => `<tr><td>${srchEsc(c.name)} ${srchEsc(c.code)}</td><td class="num">${money(c.billed)}</td><td class="num">${money(c.paid)}</td><td class="num">${money(c.bal)}</td><td>${srchEsc(c.lastDate)} ${c.lastDate ? money(c.lastAmt) : ''}</td>${c.ag.map(x => `<td class="num">${money(x)}</td>`).join('')}</tr>`).join('')}<tr class="total"><td>KABUUAN</td><td class="num">${money(list.reduce((s, c) => s + c.billed, 0))}</td><td class="num">${money(list.reduce((s, c) => s + c.paid, 0))}</td><td class="num">${money(list.reduce((s, c) => s + c.bal, 0))}</td><td></td><td></td><td></td><td></td><td></td></tr></tbody></table>`;
}
function arPrintCustomers() { printHtmlDoc('AR per Customer', `<h1>AR — Balance per Customer</h1><div class="meta">As of ${new Date().toLocaleDateString('en-PH')} · ${printedByLine()}</div>${arCustomersTableHtml()}`); }
function arExportCustomersCSV() {
  const L = [['Customer_Code', 'Customer_Name', 'Total_Billed', 'Total_Paid', 'Balance', 'Last_Payment_Date', 'Last_Payment_Amount', 'Last_Payment_Mode', 'Aging_0_30', 'Aging_31_60', 'Aging_61_90', 'Aging_90_plus'].join(',')];
  arCustomerSummary().forEach(c => L.push([csvCell(c.code), csvCell(c.name), c.billed.toFixed(2), c.paid.toFixed(2), c.bal.toFixed(2), c.lastDate, c.lastAmt ? c.lastAmt.toFixed(2) : '', csvCell(c.lastMode), ...c.ag.map(x => x.toFixed(2))].join(',')));
  downloadCSVFile(L.join('\r\n'), 'AR_Per_Customer.csv');
}
// ---- Buwanang report ----
function arMonthData(ym) {
  const rows = arAllRows(); const inv = rows.filter(r => arDate(r.o).slice(0, 7) === ym);
  const pays = []; rows.forEach(r => ((r.a && r.a.payments) || []).forEach(p => { if (!p.voided && String(p.date).slice(0, 7) === ym) pays.push({ r, p }); }));
  const byMode = {}; pays.forEach(x => { byMode[x.p.mode] = (byMode[x.p.mode] || 0) + (+x.p.amount || 0); });
  const cust = {}; inv.forEach(r => { if (r.bal > 0.005) { const k = arCustKey(r.o); (cust[k] = cust[k] || { name: arCustomer(r.o), n: 0, billed: 0, paid: 0, bal: 0 }); cust[k].n++; cust[k].billed += r.total; cust[k].paid += r.paid; cust[k].bal += r.bal; } });
  return { billed: inv.reduce((s, r) => s + r.total, 0), paidToDate: inv.reduce((s, r) => s + r.paid, 0), outstanding: inv.reduce((s, r) => s + r.bal, 0), nInv: inv.length, collected: pays.reduce((s, x) => s + (+x.p.amount || 0), 0), nPay: pays.length, byMode, cust: Object.values(cust).sort((a, b) => b.bal - a.bal), inv, pays };
}
function arMonthsList() { const set = new Set(); arAllRows().forEach(r => { const m = arDate(r.o).slice(0, 7); if (m) set.add(m); ((r.a && r.a.payments) || []).forEach(p => { if (p.date) set.add(String(p.date).slice(0, 7)); }); }); return [...set].sort().reverse(); }
function arRenderMonthly() {
  const root = arRoot(); if (!root) return; if (!arState.month) arState.month = new Date().toISOString().slice(0, 7);
  const d = arMonthData(arState.month);
  const trend = arMonthsList().slice(0, 12).map(m => { const x = arMonthData(m); return `<tr><td><a href="javascript:void(0)" onclick="arState.month='${m}';arRender()">${m}</a></td><td class="num">${money(x.billed)}</td><td class="num">${money(x.collected)}</td><td class="num"><b style="color:#b91c1c;">${money(x.outstanding)}</b></td></tr>`; }).join('');
  root.innerHTML = `<div class="card"><div class="card-title"><span>🗓️ AR — Buwanang Report</span><button class="btn btn-secondary btn-sm" onclick="loadArLedger()">🔄 Refresh</button></div>${arViewTabs()}
    <div style="display:flex;gap:.5rem;flex-wrap:wrap;align-items:end;margin-bottom:.7rem;"><div><label style="font-weight:700;">Buwan</label><br><input type="month" value="${arState.month}" onchange="arState.month=this.value;arRender()"></div>
      <button class="btn btn-secondary btn-sm" onclick="arPrintMonthly()">🖨️ Print</button><button class="btn btn-secondary btn-sm" onclick="arExportMonthlyCSV()">📤 CSV</button></div>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:.5rem;margin-bottom:.8rem;">
      <div style="background:#eff6ff;padding:.6rem;border-radius:.4rem;"><small>Benta ngayong buwan (${d.nInv} invoice)</small><br><b>${money(d.billed)}</b></div>
      <div style="background:#ecfdf5;padding:.6rem;border-radius:.4rem;"><small>Nakolektang bayad ngayong buwan (${d.nPay})</small><br><b>${money(d.collected)}</b></div>
      <div style="background:#fef2f2;padding:.6rem;border-radius:.4rem;"><small>Utang pa mula sa benta ng buwan</small><br><b style="color:#b91c1c;">${money(d.outstanding)}</b></div></div>
    <b>Bayad ngayong buwan ayon sa mode:</b> ${Object.keys(d.byMode).map(m => `${srchEsc(m)}: <b>${money(d.byMode[m])}</b>`).join(' · ') || '—'}
    <h4 style="margin:.9rem 0 .3rem;">Mga may utang mula sa benta ng ${arState.month}</h4>
    <div class="table-responsive"><table data-notools="1"><thead><tr><th>Customer</th><th>Invoices</th><th class="num">Benta</th><th class="num">Nabayad</th><th class="num">Balance</th></tr></thead><tbody>${d.cust.map(c => `<tr><td>${srchEsc(c.name)}</td><td>${c.n}</td><td class="num">${money(c.billed)}</td><td class="num">${money(c.paid)}</td><td class="num"><b style="color:#b91c1c;">${money(c.bal)}</b></td></tr>`).join('') || '<tr><td colspan="5" style="text-align:center;color:#059669;">Walang utang mula sa buwang ito 🎉</td></tr>'}</tbody></table></div>
    <h4 style="margin:.9rem 0 .3rem;">Nakaraang buwan</h4>
    <div class="table-responsive"><table data-notools="1"><thead><tr><th>Buwan</th><th class="num">Benta</th><th class="num">Nakolekta</th><th class="num">Utang pa (ng benta ng buwan)</th></tr></thead><tbody>${trend}</tbody></table></div></div>`;
}
function arMonthlyHtml() {
  const d = arMonthData(arState.month);
  return `<h1>AR — Buwanang Report (${arState.month})</h1><div class="meta">${printedByLine()}</div><table><tbody><tr><td>Benta ng buwan (${d.nInv} invoice)</td><td class="num">${money(d.billed)}</td></tr><tr><td>Nakolektang bayad ngayong buwan (${d.nPay})</td><td class="num">${money(d.collected)}</td></tr><tr class="total"><td>Utang pa mula sa benta ng buwan</td><td class="num">${money(d.outstanding)}</td></tr></tbody></table>
  <h2>Bayad ayon sa mode</h2><table><tbody>${Object.keys(d.byMode).map(m => `<tr><td>${srchEsc(m)}</td><td class="num">${money(d.byMode[m])}</td></tr>`).join('') || '<tr><td>—</td><td></td></tr>'}</tbody></table>
  <h2>Mga may utang</h2><table><thead><tr><th>Customer</th><th>Invoices</th><th class="num">Benta</th><th class="num">Nabayad</th><th class="num">Balance</th></tr></thead><tbody>${d.cust.map(c => `<tr><td>${srchEsc(c.name)}</td><td>${c.n}</td><td class="num">${money(c.billed)}</td><td class="num">${money(c.paid)}</td><td class="num">${money(c.bal)}</td></tr>`).join('')}</tbody></table>`;
}
function arPrintMonthly() { printHtmlDoc('AR Monthly ' + arState.month, arMonthlyHtml()); }
function arExportMonthlyCSV() {
  const d = arMonthData(arState.month); const L = [['Type', 'Date', 'Invoice_No', 'Customer', 'Amount', 'Paid_To_Date', 'Balance', 'Mode', 'Reference'].join(',')];
  d.inv.forEach(r => L.push(['INVOICE', arDate(r.o), csvCell(r.o.siNumber || ''), csvCell(arCustomer(r.o)), r.total.toFixed(2), r.paid.toFixed(2), r.bal.toFixed(2), '', ''].join(',')));
  d.pays.forEach(x => L.push(['PAYMENT', x.p.date, csvCell(x.r.o.siNumber || ''), csvCell(arCustomer(x.r.o)), (+x.p.amount || 0).toFixed(2), '', '', csvCell(x.p.mode), csvCell(x.p.ref || '')].join(',')));
  downloadCSVFile(L.join('\r\n'), 'AR_Monthly_' + arState.month + '.csv');
}

// ---- Customers export ----
async function exportCustomersCSV() {
  const snap = await db.collection('customers').orderBy('name').get(); const list = []; snap.forEach(d => list.push({ id: d.id, ...d.data() }));
  const L = [['Customer_Code', 'Customer_Name', 'Address', 'Contact', 'Bank_Details', 'Customer_Type'].join(',')];
  list.forEach(c => L.push([csvCell(c.code || ''), csvCell(c.name), csvCell(c.address), csvCell(c.contact), csvCell(c.bank), csvCell(c.type || 'Retail')].join(',')));
  downloadCSVFile(L.join('\r\n'), 'Customers.csv');
}

// ========================================================
// 📦 INVENTORY TOTALS (Beginning vs Ending, per branch) — para sa accounting
// Beginning = huling count sa o bago ang Petsa A; Ending = huling count sa o bago ang Petsa B.
// Halaga = qty × presyo ng item sa branch (presyong paninda/price list ng company nila). Puhunan ng commissary ay hindi ginagamit.
// ========================================================
let itState = { rows: null };
async function loadInvTotals() {
  const root = document.getElementById('invtotals-root'); if (!root || !db) return;
  root.innerHTML = '<div class="card">Kinukuha...</div>';
  const bSnap = await db.collection('inventory_branches').get(); const brs = []; bSnap.forEach(d => brs.push(d.data()));
  brs.sort((a, b) => String(a.branch).localeCompare(String(b.branch))); itState.branches = brs;
  const iso = d => { const x = new Date(d); x.setMinutes(x.getMinutes() - x.getTimezoneOffset()); return x.toISOString().slice(0, 10); };
  root.innerHTML = `<div class="card"><div class="card-title"><span>📦 Inventory Totals — Beginning at Ending</span></div>
    <p style="font-size:.85rem;color:#64748b;">Total ng halaga ng inventory sa simula at katapusan ng period, para makita ng accounting ang variance nang hindi iisa-isahin ang bawat produkto. Ang "Implied usage" = Beginning + Mga natanggap − Ending.</p>
    <div style="display:flex;gap:.5rem;flex-wrap:wrap;align-items:end;margin-bottom:.7rem;">
      <div><label style="font-weight:700;">Branch</label><br><select id="it-branch">${brs.map(b => `<option>${srchEsc(b.branch)}</option>`).join('')}</select></div>
      <div><label style="font-weight:700;">Beginning (petsa A)</label><br><input type="date" id="it-a" value="${iso(new Date(Date.now() - 30 * 864e5))}"></div>
      <div><label style="font-weight:700;">Ending (petsa B)</label><br><input type="date" id="it-b" value="${iso(new Date())}"></div>
      <button class="btn btn-primary" onclick="invTotalsRun()">📊 I-compute</button>
      <button class="btn btn-secondary btn-sm" onclick="invTotalsPrint()">🖨️ Print</button><button class="btn btn-secondary btn-sm" onclick="invTotalsCSV()">📤 CSV</button></div>
    <div id="it-result"></div></div>`;
}
async function invTotalsRun() {
  const name = document.getElementById('it-branch').value, a = document.getElementById('it-a').value, b = document.getElementById('it-b').value;
  if (!name || !a || !b) { alert('Pumili ng branch at dalawang petsa.'); return; }
  if (a > b) { alert('Dapat mas maaga ang Petsa A kaysa Petsa B.'); return; }
  const br = itState.branches.find(x => x.branch === name); const out = document.getElementById('it-result'); out.innerHTML = 'Kinukuha...';
  try {
    const [cSnap, pSnap, oSnap] = await Promise.all([db.collection('inventory_counts').where('branchCode', '==', br.code).get(), db.collection('products').get(), db.collection('orders').get()]);
    const counts = []; cSnap.forEach(d => counts.push(d.data())); counts.sort((x, y) => String(y.countDate).localeCompare(String(x.countDate)));
    const prods = []; pSnap.forEach(d => prods.push({ id: d.id, ...d.data() })); await applyCompanyPriceList(prods, br.company || '');
    const P = {}; prods.forEach(p => { P[p.id] = p; if (p.sapCode) P[p.sapCode] = p; });
    const priceOf = (code, uom) => { const p = P[code]; if (!p) return null; const w = +p.wholePrice || 0, l = +p.loosePrice || 0; if (uom && uom === p.looseUOM) return l || null; if (uom && uom === p.wholeUOM) return w || null; return l || w || null; };
    const meta = {}; counts.forEach(c => (c.lines || []).forEach(l => { const k = c.station + '||' + l.itemCode; if (!meta[k]) meta[k] = { station: c.station, code: l.itemCode, name: l.itemName, uom: l.uom }; }));
    const items = Object.values(meta).map(m => { const A = invLatestQty(counts, m.code, a, m.station), B = invLatestQty(counts, m.code, b, m.station), pr = priceOf(m.code, m.uom); return { ...m, qa: A ? A.qty : 0, qb: B ? B.qty : 0, hasA: !!A, hasB: !!B, price: pr, va: (A ? A.qty : 0) * (pr || 0), vb: (B ? B.qty : 0) * (pr || 0) }; });
    const st = {}; items.forEach(i => { const s = (st[i.station] = st[i.station] || { station: i.station, va: 0, vb: 0, n: 0, noPrice: 0 }); s.va += i.va; s.vb += i.vb; s.n++; if (!i.price) s.noPrice++; });
    let purchases = 0, nOrd = 0;
    oSnap.forEach(d => { const o = d.data(); if (o.branchName !== name) return; if (!arIncluded(o) || o.status === 'Dispatched / En Route') return; const dt = o.targetDeliveryDate || ''; if (dt > a && dt <= b) { purchases += (o.items || []).reduce((s, i) => s + (+i.subtotal || 0), 0) || (+o.totalAmount || 0); nOrd++; } });
    const beg = items.reduce((s, i) => s + i.va, 0), end = items.reduce((s, i) => s + i.vb, 0);
    itState.rows = { name, a, b, items, stations: Object.values(st), beg, end, purchases, nOrd, noPrice: items.filter(i => !i.price).length, missA: !items.some(i => i.hasA), company: br.company || '' };
    invTotalsRender();
  } catch (e) { out.innerHTML = `<span style="color:#dc2626;">Error: ${srchEsc(e.message)}</span>`; }
}
function invTotalsHtml() {
  const R = itState.rows; const usage = R.beg + R.purchases - R.end;
  return `${R.missA ? `<div style="background:#fffbeb;border:1px solid #fcd34d;padding:.5rem;border-radius:.4rem;margin-bottom:.5rem;">⚠️ Walang count sa o bago ang ${srchEsc(R.a)}, kaya ₱0 ang Beginning. Pumili ng petsang may count.</div>` : ''}
  ${R.noPrice ? `<div style="background:#fffbeb;border:1px solid #fcd34d;padding:.5rem;border-radius:.4rem;margin-bottom:.5rem;">⚠️ ${R.noPrice} item ang walang presyo sa Product Master (hindi nabilang sa halaga).</div>` : ''}
  <table><tbody><tr><td><b>Beginning Inventory</b> (${srchEsc(R.a)})</td><td class="num"><b>${money(R.beg)}</b></td></tr>
  <tr><td>+ Mga natanggap na delivery (${R.nOrd} order, ${srchEsc(R.a)} hanggang ${srchEsc(R.b)})</td><td class="num">${money(R.purchases)}</td></tr>
  <tr><td><b>Ending Inventory</b> (${srchEsc(R.b)})</td><td class="num"><b>${money(R.end)}</b></td></tr>
  <tr class="total"><td>Implied usage / konsumo = Beginning + Natanggap − Ending</td><td class="num">${money(usage)}</td></tr>
  <tr><td>Pagbabago ng stock (Ending − Beginning)</td><td class="num">${money(R.end - R.beg)}</td></tr></tbody></table>
  <h4 style="margin:.8rem 0 .3rem;">Per Station</h4>
  <table><thead><tr><th>Station</th><th>Items</th><th class="num">Beginning</th><th class="num">Ending</th><th class="num">Pagbabago</th></tr></thead><tbody>${R.stations.map(s => `<tr><td>${srchEsc(s.station)}</td><td>${s.n}</td><td class="num">${money(s.va)}</td><td class="num">${money(s.vb)}</td><td class="num">${money(s.vb - s.va)}</td></tr>`).join('')}<tr class="total"><td>KABUUAN</td><td></td><td class="num">${money(R.beg)}</td><td class="num">${money(R.end)}</td><td class="num">${money(R.end - R.beg)}</td></tr></tbody></table>`;
}
function invTotalsRender() { const o = document.getElementById('it-result'); if (o && itState.rows) o.innerHTML = invTotalsHtml(); }
function invTotalsPrint() { if (!itState.rows) { alert('I-compute muna.'); return; } const R = itState.rows; printHtmlDoc('Inventory Totals', `<h1>Inventory Totals — ${srchEsc(R.name)}</h1><div class="meta">${srchEsc(R.company)} · ${printedByLine()}</div>${invTotalsHtml()}<div class="sign"><div>Binilang / Inihanda ni</div><div>Sinuri ni (Accounting)</div></div>`); }
function invTotalsCSV() {
  if (!itState.rows) { alert('I-compute muna.'); return; } const R = itState.rows;
  const L = [['Branch', 'Station', 'Item_Code', 'Item', 'UOM', 'Price', 'Beginning_Qty', 'Beginning_Value', 'Ending_Qty', 'Ending_Value', 'Difference_Value'].join(',')];
  R.items.forEach(i => L.push([csvCell(R.name), csvCell(i.station), csvCell(i.code), csvCell(i.name), csvCell(i.uom), i.price == null ? '' : i.price, i.qa, i.va.toFixed(2), i.qb, i.vb.toFixed(2), (i.vb - i.va).toFixed(2)].join(',')));
  L.push(['TOTAL', '', '', '', '', '', '', R.beg.toFixed(2), '', R.end.toFixed(2), (R.end - R.beg).toFixed(2)].join(','));
  downloadCSVFile(L.join('\r\n'), 'Inventory_Totals_' + invSlug(R.name) + '.csv');
}


// ========================================================
// 💰 INVENTORY VALUE CARD (Plant/Commissary) — qty, puhunan value, SRP value, alerts at SAP check
// inventory_snapshots/{hub}__{date}: { hub,date,items,costValue,srpValue,sapValue,sapBy }
// ========================================================
let ivState = { hub: null, data: null };
async function invValueData(hub) {
  const [pSnap] = await Promise.all([db.collection('products').get(), loadProductCosts()]);
  const rows = []; const alerts = [];
  pSnap.forEach(d => {
    const p = { id: d.id, ...d.data() }; if (hub && !productVisibleToHub(p, hub)) return;
    const sw = parseFloat(p.stockWhole) || 0, sl = parseFloat(p.stockLoose) || 0, c = productCosts[p.id] || {};
    const cw = parseFloat(c.costWhole) || 0, cl = parseFloat(c.costLoose) || 0, pw = parseFloat(p.wholePrice) || 0, pl = parseFloat(p.loosePrice) || 0;
    const conv = parseFloat(p.conversionFactor) || 1, name = p.itemName || p.id;
    const r = { id: p.id, name, station: p.storageStation || 'Unassigned', sw, sl, cost: sw * cw + sl * cl, srp: sw * pw + sl * pl };
    rows.push(r);
    if (sw < 0 || sl < 0) alerts.push({ lvl: 'high', text: `Negatibo ang stock: ${name} (${sw} whole / ${sl} loose)` });
    if ((sw > 0 || sl > 0) && !(cw > 0 || cl > 0)) alerts.push({ lvl: 'mid', text: `May stock pero walang puhunan: ${name} — hindi nabibilang sa value` });
    if ((sw > 0 || sl > 0) && !(pw > 0 || pl > 0)) alerts.push({ lvl: 'mid', text: `May stock pero walang presyong paninda: ${name}` });
    if (conv > 1 && sl >= conv) alerts.push({ lvl: 'low', text: `Malaki ang loose (${sl}) kaysa isang whole (${conv}): ${name} — baka mali ang bilang o hindi na-repack` });
  });
  const st = {}; rows.forEach(r => { const x = (st[r.station] = st[r.station] || { station: r.station, n: 0, sw: 0, sl: 0, cost: 0, srp: 0 }); x.n++; x.sw += r.sw; x.sl += r.sl; x.cost += r.cost; x.srp += r.srp; });
  const tot = rows.reduce((a, r) => ({ cost: a.cost + r.cost, srp: a.srp + r.srp, sw: a.sw + r.sw, sl: a.sl + r.sl, n: a.n + (r.sw || r.sl ? 1 : 0) }), { cost: 0, srp: 0, sw: 0, sl: 0, n: 0 });
  return { rows, alerts, stations: Object.values(st).sort((a, b) => b.cost - a.cost), tot };
}
function ivSnapId(hub, date) { return (invSlug(hub || 'all') || 'all') + '__' + date; }
async function renderInvValueCard(containerId) {
  const box = document.getElementById(containerId); if (!box || typeof db === 'undefined' || !db) return;
  const u = getCurrentUser() || {}; const admin = normalizeRole(u.role) === 'admin';
  if (ivState.hub === null) ivState.hub = admin ? '' : myHubName();
  const hub = ivState.hub; box.innerHTML = '<div class="card">Kinukuha ang inventory value...</div>';
  try {
    const d = await invValueData(hub); ivState.data = d;
    const today = new Date().toISOString().slice(0, 10);
    const snapSnap = await db.collection('inventory_snapshots').get(); const snaps = [];
    snapSnap.forEach(x => { const v = x.data(); if ((v.hub || '') === (hub || '')) snaps.push(v); });
    snaps.sort((a, b) => String(b.date).localeCompare(String(a.date)));
    let todaySnap = snaps.find(x => x.date === today);
    if (!todaySnap) { // awtomatikong snapshot isang beses bawat araw
      todaySnap = { hub: hub || '', date: today, items: d.tot.n, costValue: d.tot.cost, srpValue: d.tot.srp, createdAt: firebase.firestore.FieldValue.serverTimestamp() };
      try { await db.collection('inventory_snapshots').doc(ivSnapId(hub, today)).set(todaySnap); snaps.unshift(todaySnap); } catch (e) { console.warn('snapshot', e); }
    }
    const prev = snaps.find(x => x.date < today);
    if (prev && prev.costValue > 0) { const ch = (d.tot.cost - prev.costValue) / prev.costValue; if (ch <= -0.1) d.alerts.unshift({ lvl: 'high', text: `Bumaba ng ${(Math.abs(ch) * 100).toFixed(0)}% ang inventory value mula ${prev.date} (${money(prev.costValue)} → ${money(d.tot.cost)}). Tingnan kung may nawawala.` }); }
    const sapV = todaySnap && todaySnap.sapValue != null ? +todaySnap.sapValue : null;
    let sapHtml = '';
    if (sapV != null) { const diff = d.tot.cost - sapV, pct = sapV ? Math.abs(diff) / sapV * 100 : 0, bad = pct > 1; sapHtml = `<div style="padding:.5rem;border-radius:.4rem;background:${bad ? '#fef2f2' : '#ecfdf5'};border:1px solid ${bad ? '#fca5a5' : '#86efac'};margin-top:.4rem;">${bad ? '🚨' : '✅'} SAP: <b>${money(sapV)}</b> · Website: <b>${money(d.tot.cost)}</b> · Pagkakaiba: <b style="color:${bad ? '#b91c1c' : '#059669'};">${money(diff)} (${pct.toFixed(1)}%)</b> ${bad ? '— mag-imbestiga bago ang audit!' : ''}</div>`; if (bad) d.alerts.unshift({ lvl: 'high', text: `Hindi tugma sa SAP: ${money(Math.abs(diff))} ang pagkakaiba (${pct.toFixed(1)}%)` }); }
    const hubs = admin ? [...new Set([...(await db.collection('products').get().then(s => { const a = []; s.forEach(x => a.push(x.data().commissarySource || '')); return a; }))].filter(Boolean))] : [];
    const al = d.alerts.slice(0, 12).map(a => `<div style="padding:.3rem .5rem;margin:.2rem 0;border-left:4px solid ${a.lvl === 'high' ? '#dc2626' : a.lvl === 'mid' ? '#f59e0b' : '#94a3b8'};background:#f8fafc;">${srchEsc(a.text)}</div>`).join('') || '<div style="color:#059669;">✅ Walang nakitang problema sa inventory ngayon.</div>';
    const hist = snaps.slice(0, 7).map(x => `<tr><td>${srchEsc(x.date)}</td><td class="num">${money(x.costValue)}</td><td class="num">${money(x.srpValue)}</td><td class="num">${x.sapValue != null ? money(x.sapValue) : '—'}</td><td class="num">${x.sapValue != null ? money(x.costValue - x.sapValue) : '—'}</td></tr>`).join('');
    box.innerHTML = `<div class="card"><div class="card-title"><span>💰 Inventory Value — ${srchEsc(hub || 'Lahat ng Hub')}</span><div style="display:flex;gap:.4rem;align-items:center;">${admin ? `<select onchange="ivState.hub=this.value;renderInvValueCard('${containerId}')"><option value="">(Lahat)</option>${hubs.map(h => `<option ${h === hub ? 'selected' : ''}>${srchEsc(h)}</option>`).join('')}</select>` : ''}<button class="btn btn-secondary btn-sm" onclick="renderInvValueCard('${containerId}')">🔄</button><button class="btn btn-secondary btn-sm" onclick="ivPrint()">🖨️</button></div></div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:.5rem;margin-bottom:.7rem;">
        <div style="background:#eff6ff;padding:.6rem;border-radius:.4rem;"><small>📦 Items na may stock</small><br><b>${d.tot.n}</b><br><small>${d.tot.sw.toLocaleString()} whole · ${d.tot.sl.toLocaleString()} loose</small></div>
        <div style="background:#fef3c7;padding:.6rem;border-radius:.4rem;"><small>💵 Halaga sa PUHUNAN</small><br><b style="font-size:1.2rem;">${money(d.tot.cost)}</b></div>
        <div style="background:#ecfdf5;padding:.6rem;border-radius:.4rem;"><small>🏷️ Halaga sa PRESYONG PANINDA</small><br><b style="font-size:1.2rem;">${money(d.tot.srp)}</b></div>
        <div style="background:#f5f3ff;padding:.6rem;border-radius:.4rem;"><small>📈 Potential na tubo</small><br><b>${money(d.tot.srp - d.tot.cost)}</b></div></div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:.8rem;">
        <div><b>🚨 Alerts</b>${al}</div>
        <div><b>🧮 I-tsek sa SAP</b><div style="display:flex;gap:.4rem;margin-top:.3rem;"><input type="number" id="iv-sap" step="0.01" placeholder="Total inventory value sa SAP (puhunan)" value="${sapV != null ? sapV : ''}" style="flex:1;"><button class="btn btn-primary btn-sm" onclick="ivSaveSap()">I-compare</button></div>${sapHtml}</div></div>
      <div class="table-responsive" style="margin-top:.7rem;"><table data-notools="1"><thead><tr><th>Station</th><th>Items</th><th class="num">Whole</th><th class="num">Loose</th><th class="num">Puhunan</th><th class="num">Paninda</th></tr></thead><tbody>${d.stations.map(x => `<tr><td>${srchEsc(x.station)}</td><td>${x.n}</td><td class="num">${x.sw.toLocaleString()}</td><td class="num">${x.sl.toLocaleString()}</td><td class="num">${money(x.cost)}</td><td class="num">${money(x.srp)}</td></tr>`).join('')}<tr class="total"><td>KABUUAN</td><td>${d.rows.length}</td><td class="num">${d.tot.sw.toLocaleString()}</td><td class="num">${d.tot.sl.toLocaleString()}</td><td class="num">${money(d.tot.cost)}</td><td class="num">${money(d.tot.srp)}</td></tr></tbody></table></div>
      <details style="margin-top:.5rem;"><summary><b>Nakaraang araw</b></summary><div class="table-responsive"><table data-notools="1"><thead><tr><th>Petsa</th><th class="num">Puhunan</th><th class="num">Paninda</th><th class="num">SAP</th><th class="num">Pagkakaiba</th></tr></thead><tbody>${hist}</tbody></table></div></details></div>`;
  } catch (e) { box.innerHTML = `<div class="card" style="color:#dc2626;">Error: ${srchEsc(e.message)}</div>`; }
}
async function ivSaveSap() {
  const v = parseFloat((document.getElementById('iv-sap') || {}).value); if (isNaN(v) || v < 0) { alert('Ilagay ang total inventory value sa SAP.'); return; }
  const u = getCurrentUser() || {}; const today = new Date().toISOString().slice(0, 10); const hub = ivState.hub || '';
  await db.collection('inventory_snapshots').doc(ivSnapId(hub, today)).set({ hub, date: today, sapValue: v, sapBy: u.name || u.email || '', sapAt: new Date().toISOString() }, { merge: true });
  const box = document.querySelector('[id^="iv-card"]'); renderInvValueCard(box ? box.id : 'iv-card-comm');
}
function ivPrint() {
  const d = ivState.data; if (!d) return;
  printHtmlDoc('Inventory Value', `<h1>Inventory Value — ${srchEsc(ivState.hub || 'Lahat ng Hub')}</h1><div class="meta">${new Date().toLocaleDateString('en-PH')} · ${printedByLine()}</div><table><tbody><tr><td>Halaga sa puhunan</td><td class="num">${money(d.tot.cost)}</td></tr><tr><td>Halaga sa presyong paninda</td><td class="num">${money(d.tot.srp)}</td></tr></tbody></table><h2>Per Station</h2><table><thead><tr><th>Station</th><th class="num">Puhunan</th><th class="num">Paninda</th></tr></thead><tbody>${d.stations.map(x => `<tr><td>${srchEsc(x.station)}</td><td class="num">${money(x.cost)}</td><td class="num">${money(x.srp)}</td></tr>`).join('')}</tbody></table><h2>Alerts</h2>${d.alerts.map(a => `<div>• ${srchEsc(a.text)}</div>`).join('') || 'Wala'}`);
}
// ilagay ang card sa Commissary dashboard at Admin Inventory Totals
(function hookIvCards() {
  const orig = window.loadCommissaryAnalytics;
  if (typeof orig === 'function') window.loadCommissaryAnalytics = async function () {
    const dash = document.getElementById('view-commissary-dashboard');
    if (dash && !document.getElementById('iv-card-comm')) { const d = document.createElement('div'); d.id = 'iv-card-comm'; dash.insertBefore(d, dash.firstChild); }
    renderInvValueCard('iv-card-comm');
    return orig.apply(this, arguments);
  };
  const o2 = window.loadInvTotals;
  if (typeof o2 === 'function') window.loadInvTotals = async function () {
    const r = await o2.apply(this, arguments);
    const root = document.getElementById('invtotals-root');
    if (root && !document.getElementById('iv-card-admin')) { const d = document.createElement('div'); d.id = 'iv-card-admin'; root.insertBefore(d, root.firstChild); }
    renderInvValueCard('iv-card-admin'); return r;
  };
})();


// ========================================================
// 🧑‍💼 AGENT ORDERS: stock availability, bayad ni agent (para i-confirm ng accounting), at resibo (print preview)
// payment_submissions/{id}: { orderId, amount, mode, ref, photoId, by, byEmail, status:'pending'|'confirmed'|'rejected', ... }
// Pag nag-confirm ang accounting → pumapasok sa ar_accounts at nag-a-update ang order.paymentStatus (Paid/Partial) na lumalabas sa resibo.
// ========================================================
function ordAvail(p) {
  const tracked = (p.stockWhole !== undefined || p.stockLoose !== undefined) && p.allowBackorder !== true;
  const sw = parseFloat(p.stockWhole) || 0, sl = parseFloat(p.stockLoose) || 0, conv = parseFloat(p.conversionFactor) || 1;
  return { tracked, sw, sl, conv, loose: Math.max(0, sw) * conv + Math.max(0, sl) };
}
function ordStockBadge(p) {
  const a = ordAvail(p); if (!a.tracked) return '<span style="color:#64748b;">♾️ made-to-order</span>';
  if (a.loose <= 0) return '<span class="badge badge-danger" style="font-size:.7rem;">❌ Ubos</span>';
  return `<span style="color:#059669;font-weight:700;">✅ ${a.sw} ${srchEsc(p.wholeUOM || 'whole')} · ${a.sl} ${srchEsc(p.looseUOM || 'loose')}</span>`;
}
function ordCheckStock(p, wq, lq) {
  const a = ordAvail(p); if (!a.tracked) return { ok: true };
  const need = wq * a.conv + lq;
  if (need <= a.loose + 1e-9) return { ok: true };
  return { ok: false, msg: a.loose <= 0 ? 'Ubos na ang stock.' : `Ilan lang ang available: ${a.sw} ${p.wholeUOM || 'whole'} at ${a.sl} ${p.looseUOM || 'loose'}${a.conv > 1 ? ` (1 ${p.wholeUOM || 'whole'} = ${a.conv} ${p.looseUOM || 'loose'})` : ''}.` };
}
async function ordFreshStockCheck(cart) {
  const bad = [];
  for (const it of cart) {
    const d = await db.collection('products').doc(it.itemCode).get(); if (!d.exists) continue;
    const c = ordCheckStock(d.data(), it.wholeQty || 0, it.looseQty || 0);
    if (!c.ok) bad.push(`• ${it.itemName || it.itemCode}: ${c.msg}`);
  }
  return bad;
}
let ordMySubs = {};
async function ordLoadMySubs() {
  ordMySubs = {}; const u = getCurrentUser() || {}; if (!u.email) return;
  try { const s = await db.collection('payment_submissions').where('byEmail', '==', String(u.email).toLowerCase()).get(); s.forEach(d => { const v = { id: d.id, ...d.data() }; (ordMySubs[v.orderId] = ordMySubs[v.orderId] || []).push(v); }); } catch (e) { console.warn('subs', e); }
}
function ordPayBadge(o) {
  const subs = ordMySubs[o.id] || [], pend = subs.some(x => x.status === 'pending'), rej = subs.filter(x => x.status === 'rejected').slice(-1)[0];
  if (o.paymentStatus === 'Paid') return '<span class="badge badge-branch">✅ PAID</span>';
  if (pend) return `<span class="badge badge-warning">⏳ Hinihintay ang confirmation</span>${o.paymentStatus === 'Partial' ? `<br><small>Bayad na ${money(o.amountPaid)}</small>` : ''}`;
  if (o.paymentStatus === 'Partial') return `<span class="badge badge-warning">🟡 Partial · ${money(o.amountPaid)}</span>`;
  return `<span class="badge badge-danger">Unpaid</span>${rej ? `<br><small style="color:#b91c1c;">❌ Na-reject: ${srchEsc(rej.rejectReason || '')}</small>` : ''}`;
}
function ordExtraButtons(o) {
  const bal = Math.max(0, (parseFloat(o.totalAmount) || 0) - (parseFloat(o.amountPaid) || 0)); const pend = (ordMySubs[o.id] || []).some(x => x.status === 'pending');
  return `<button class="btn btn-sm btn-secondary" onclick="ordReceiptPreview('${o.id}')">🧾 Resibo</button>${(!/Cancel/.test(o.status || '') && bal > 0.005 && !pend) ? `<button class="btn btn-sm btn-success" onclick="agentOpenPay('${o.id}')">💵 Bayad</button>` : ''}`;
}
function agentOpenPay(orderId) {
  const o = (window.__ordCache || {})[orderId]; if (!o) return;
  const bal = Math.max(0, (parseFloat(o.totalAmount) || 0) - (parseFloat(o.amountPaid) || 0));
  arModal(`<h3>💵 Mag-submit ng Bayad</h3><p><b>${srchEsc(o.customerName || o.branchName || '')}</b> · ${srchEsc(o.orderId || o.id)}<br>Balance: <b style="color:#b91c1c;">${money(bal)}</b></p>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:.6rem;"><div><label>Halagang binayad (₱)</label><input type="number" id="ag-amt" step="0.01" min="0" value="${bal.toFixed(2)}"></div>
    <div><label>Paraan ng bayad</label><select id="ag-mode">${['GCash', 'Maya', 'Bank Transfer', 'Cash', 'Check', 'Others'].map(m => `<option>${m}</option>`).join('')}</select></div></div>
    <div style="margin-top:.5rem;"><label>Reference No.</label><input type="text" id="ag-ref"></div>
    <div style="margin-top:.5rem;"><label>📷 Screenshot / larawan ng bayad (kailangan)</label><input type="file" id="ag-photo" accept="image/*"></div>
    <p style="font-size:.8rem;color:#64748b;">Pagkatapos ma-submit, titingnan ng accounting ng commissary sa bank statement. Kapag nakumpirma, mamarkahan itong PAID sa resibo.</p>
    <button class="btn btn-success" onclick="agentSubmitPay('${orderId}')">📤 I-submit</button>`);
}
async function agentSubmitPay(orderId) {
  const o = (window.__ordCache || {})[orderId]; if (!o) return;
  const amount = parseFloat((document.getElementById('ag-amt') || {}).value) || 0, file = (document.getElementById('ag-photo') || {}).files && document.getElementById('ag-photo').files[0];
  const bal = Math.max(0, (parseFloat(o.totalAmount) || 0) - (parseFloat(o.amountPaid) || 0));
  if (!(amount > 0)) { alert('Maglagay ng halaga.'); return; } if (amount > bal + 0.005) { alert(`Sobra ang halaga. Balance lang ay ${money(bal)}.`); return; }
  if (!file) { alert('Kailangan ng screenshot o larawan ng bayad.'); return; }
  let dataUrl; try { dataUrl = await compressImageFile(file, 1100, 0.7); } catch (e) { alert(e.message); return; }
  const u = getCurrentUser() || {}; const pid = 'SUB-' + Date.now().toString().slice(-8) + Math.floor(Math.random() * 90 + 10);
  try {
    await db.collection('ar_payment_photos').doc(pid).set({ dataUrl, orderId, createdAt: firebase.firestore.FieldValue.serverTimestamp() });
    await db.collection('payment_submissions').doc(pid).set({ orderId, orderNo: o.orderId || orderId, customer: o.customerName || o.branchName || '', amount, mode: document.getElementById('ag-mode').value, ref: ((document.getElementById('ag-ref') || {}).value || '').trim(), photoId: pid, by: u.name || u.email || '', byEmail: String(u.email || '').toLowerCase(), status: 'pending', at: new Date().toISOString() });
    try { logSystemAction('AGENT_PAYMENT_SUBMITTED', `${o.orderId || orderId} · ${money(amount)}`); } catch (e) {}
    arCloseModal(); alert('✅ Na-submit ang bayad. Hintayin ang confirmation ng accounting.'); loadBranchDeliveries();
  } catch (e) { alert('Error: ' + e.message); }
}
// ---- staff side ----
function arPendingFor(orderId) { return (arState.subs || []).filter(x => x.orderId === orderId && x.status === 'pending'); }
async function arSyncOrder(orderId) {
  const o = arState.orders.find(x => x.id === orderId); if (!o || o._legacy) return;
  try {
    const a = (await db.collection('ar_accounts').doc(orderId).get()).data() || {}; const total = arOrderTotal(o), paid = arPaid(a);
    await db.collection('orders').doc(orderId).update({ paymentStatus: arStatusOf(total, paid), amountPaid: paid, lastPaymentAt: new Date().toISOString() });
  } catch (e) { console.warn('sync order', e); }
}
async function arReviewSub(orderId) {
  const subs = arPendingFor(orderId); if (!subs.length) return; const sub = subs[0]; const o = arState.orders.find(x => x.id === orderId);
  let img = ''; try { const d = await db.collection('ar_payment_photos').doc(sub.photoId).get(); if (d.exists) img = `<img src="${d.data().dataUrl}" style="max-width:100%;max-height:340px;border:1px solid #cbd5e1;border-radius:.4rem;">`; } catch (e) {}
  arModal(`<h3>🔔 I-confirm ang Bayad ni Agent</h3><p><b>${srchEsc(sub.customer)}</b> · ${srchEsc(sub.orderNo)}<br>Agent: ${srchEsc(sub.by)} · ${srchEsc((sub.at || '').slice(0, 16).replace('T', ' '))}<br>Halaga: <b>${money(sub.amount)}</b> · ${srchEsc(sub.mode)} · Ref: ${srchEsc(sub.ref || '—')}<br>Balance ng order: ${o ? money(Math.max(0, arOrderTotal(o) - arPaid(arState.accts[orderId]))) : ''}</p>${img}
    <p style="font-size:.85rem;color:#64748b;">Tingnan muna sa bank statement / transaction bago i-confirm.</p>
    <div style="display:flex;gap:.5rem;"><button class="btn btn-success" onclick="arConfirmSub('${sub.id}')">✅ Nakita sa bank — I-confirm</button><button class="btn btn-danger" onclick="arRejectSub('${sub.id}')">❌ I-reject</button></div>`);
}
async function arConfirmSub(subId) {
  const sub = (arState.subs || []).find(x => x.id === subId); if (!sub) return; const o = arState.orders.find(x => x.id === sub.orderId); if (!o) return;
  const u = getCurrentUser() || {}; const by = u.name || u.email || ''; const ref0 = db.collection('ar_accounts').doc(sub.orderId);
  try {
    await db.runTransaction(async tx => {
      const snap = await tx.get(ref0); const a = snap.exists ? snap.data() : { orderId: sub.orderId, payments: [] }; const total = arOrderTotal(o), paid = arPaid(a);
      if (sub.amount > total - paid + 0.005) throw new Error(`Sobra ang halaga. Balance lang ay ${money(total - paid)}.`);
      const payments = (a.payments || []).concat([{ id: subId, date: new Date().toISOString().slice(0, 10), amount: sub.amount, mode: sub.mode, ref: sub.ref || '', notes: `Galing kay agent ${sub.by} · kinumpirma ni ${by}`, by, at: new Date().toISOString(), photoId: sub.photoId }]);
      const np = paid + sub.amount;
      tx.set(ref0, { orderId: sub.orderId, siNumber: o.siNumber || '', customer: arCustomer(o), total, paid: np, status: arStatusOf(total, np), payments, updatedAt: firebase.firestore.FieldValue.serverTimestamp() });
      tx.update(db.collection('payment_submissions').doc(subId), { status: 'confirmed', confirmedBy: by, confirmedAt: new Date().toISOString() });
    });
    await arSyncOrder(sub.orderId);
    try { await logSystemAction('AGENT_PAYMENT_CONFIRMED', `${sub.orderNo} · ${money(sub.amount)}`); } catch (e) {}
    arCloseModal(); await loadArLedger();
  } catch (e) { alert('Error: ' + e.message); }
}
async function arRejectSub(subId) {
  const reason = await uiPrompt('Dahilan ng pag-reject (makikita ni agent):'); if (!reason) return; const u = getCurrentUser() || {};
  await db.collection('payment_submissions').doc(subId).update({ status: 'rejected', rejectReason: reason, rejectedBy: u.name || u.email || '', rejectedAt: new Date().toISOString() });
  arCloseModal(); await loadArLedger();
}
// ---- Resibo (grocery-style) + print preview ----
function ordReceiptHtml(o, preview) {
  const items = o.items || []; const total = parseFloat(o.totalAmount) || 0, paid = parseFloat(o.amountPaid) || 0, bal = Math.max(0, total - paid);
  const pend = (ordMySubs[o.id] || []).some(x => x.status === 'pending') || (typeof arState !== 'undefined' && (arState.subs || []).some(x => x.orderId === o.id && x.status === 'pending'));
  const lines = items.map(i => { const parts = []; if (i.wholeQty) parts.push(`${i.wholeQty} ${srchEsc(i.wholeUOM || 'whole')} x ${money(i.wholePrice)}`); if (i.looseQty) parts.push(`${i.looseQty} ${srchEsc(i.looseUOM || 'loose')} x ${money(i.loosePrice)}`); return `<div class="rc-item"><div>${srchEsc(i.itemName || i.itemCode)}</div><div class="rc-row"><span>${parts.join(' + ')}</span><span>${money(i.subtotal)}</span></div></div>`; }).join('');
  const stamp = o.paymentStatus === 'Paid' ? '<div class="rc-stamp" style="color:#059669;border-color:#059669;">PAID</div>' : pend ? '<div class="rc-stamp" style="color:#d97706;border-color:#d97706;">FOR CONFIRMATION</div>' : (o.paymentStatus === 'Partial' ? '<div class="rc-stamp" style="color:#d97706;border-color:#d97706;">PARTIAL</div>' : '<div class="rc-stamp" style="color:#b91c1c;border-color:#b91c1c;">UNPAID</div>');
  const created = o.createdAt && (o.createdAt.toDate ? o.createdAt.toDate() : o.createdAt.seconds ? new Date(o.createdAt.seconds * 1000) : null);
  return `<style>.rc{width:300px;margin:0 auto;font-family:'Courier New',monospace;font-size:12px;color:#000;}.rc h2{text-align:center;margin:0;font-size:15px;}.rc .c{text-align:center;}.rc hr{border:0;border-top:1px dashed #000;margin:6px 0;}.rc-row{display:flex;justify-content:space-between;gap:6px;}.rc-item{margin:3px 0;}.rc-stamp{border:3px solid;text-align:center;font-weight:800;font-size:18px;padding:3px;margin:8px 0;transform:rotate(-3deg);}.rc-sign{margin-top:22px;border-top:1px solid #000;text-align:center;font-size:10px;}</style>
  <div class="rc">${compReceiptHdr(o)}<div class="c">${preview ? '*** PREVIEW — hindi pa na-place ***' : 'SALES ORDER RECEIPT'}</div><hr>
  <div class="rc-row"><span>Order:</span><span>${srchEsc(o.orderId || o.id || '(bago)')}</span></div>
  <div class="rc-row"><span>Petsa:</span><span>${(created || new Date()).toLocaleString('en-PH')}</span></div>
  <div class="rc-row"><span>Delivery:</span><span>${srchEsc(o.targetDeliveryDate || 'ASAP')}</span></div>
  <div class="rc-row"><span>Customer:</span><span>${srchEsc(o.customerName || o.branchName || '—')}</span></div>
  ${o.agentName ? `<div class="rc-row"><span>Agent:</span><span>${srchEsc(o.agentName)}</span></div>` : ''}<hr>${lines || '<div class="c">Walang item</div>'}<hr>
  <div class="rc-row"><span>Subtotal</span><span>${money(o.subtotalAmount != null ? o.subtotalAmount : total)}</span></div>
  ${parseFloat(o.discountAmount) ? `<div class="rc-row"><span>Discount</span><span>-${money(o.discountAmount)}</span></div>` : ''}${parseFloat(o.vatAmount) ? `<div class="rc-row"><span>VAT (${srchEsc(o.vatType || '')})</span><span>${money(o.vatAmount)}</span></div>` : ''}
  <div class="rc-row" style="font-weight:800;font-size:14px;"><span>TOTAL</span><span>${money(total)}</span></div>
  <div class="rc-row"><span>Nabayad</span><span>${money(paid)}</span></div><div class="rc-row"><span>Balance</span><span>${money(bal)}</span></div>${preview ? '' : stamp}<hr>
  <div class="rc-sign">Tumanggap / Customer</div><div class="c" style="margin-top:8px;font-size:10px;">Salamat po!</div></div>`;
}
async function ordReceiptPreview(orderId) {
  await compEnsure(); let o;
  if (orderId === 'draft') {
    const t = (typeof calculateBranchCartTotals === 'function') ? calculateBranchCartTotals() : { finalTotal: 0, subtotal: 0, discountAmt: 0, vatAmount: 0 };
    if (!orderCart.length) { alert('Walang laman ang basket.'); return; }
    const sel = document.getElementById('order-customer'); const cn = sel && sel.value ? sel.options[sel.selectedIndex].text : ''; const u = getCurrentUser() || {};
    o = { orderId: '', items: orderCart, totalAmount: t.finalTotal, subtotalAmount: t.subtotal, discountAmount: t.discountAmt, vatAmount: t.vatAmount, vatType: (document.getElementById('order-vat') || {}).value || '', customerName: cn, agentName: cn ? (u.name || u.email || '') : '', targetDeliveryDate: selectedDeliveryDate || '', paymentStatus: 'Unpaid', amountPaid: 0 };
  } else {
    o = (window.__ordCache || {})[orderId] || (typeof arState !== 'undefined' && arState.orders.find(x => x.id === orderId));
    if (!o || !o.items) { const d = await db.collection('orders').doc(orderId).get(); if (!d.exists) return; o = { id: d.id, ...d.data() }; }
  }
  window.__rcCurrent = { o, preview: orderId === 'draft' };
  arModal(`<h3>🧾 Print Preview — Resibo</h3><div style="background:#f1f5f9;padding:.8rem;border-radius:.4rem;overflow:auto;"><div style="background:#fff;padding:10px;width:320px;margin:0 auto;box-shadow:0 1px 6px rgba(0,0,0,.2);">${ordReceiptHtml(o, orderId === 'draft')}</div></div><div style="margin-top:.6rem;"><button class="btn btn-primary" onclick="ordReceiptPrint()">🖨️ I-print</button></div>`);
}
function ordReceiptPrint() { const c = window.__rcCurrent; if (!c) return; printHtmlDoc('Resibo', `<style>@page{size:80mm auto;margin:3mm}body{margin:0!important;padding:0!important}</style>${ordReceiptHtml(c.o, c.preview)}`); }


// ========================================================
// 🛠️ MGA REQUEST (parang Jira) — Branch → Procurement/Canvass → Approval (COO/President) → PO/Bayad → Delivery
// requests/{REQ-0001}: { key,title,description,type,priority,branch,requester,requesterEmail,neededBy,photos:[ids],status,assignee,
//   quotes:[{id,supplier,amount,notes,photoId,by,at}], selectedQuote, approval:{by,role,at,note}, poNumber, paymentRef, comments:[], history:[] }
// request_photos/{id}: { dataUrl }     request_counter/main: { n }
// ========================================================
const REQ_STATUSES = ['Open', 'For Quotation', 'For Approval', 'Approved', 'PO Created', 'For Payment', 'Paid', 'For Delivery', 'Delivered', 'Completed', 'On Hold', 'Rejected', 'Cancelled'];
const REQ_COLORS = { 'Open': '#64748b', 'For Quotation': '#0284c7', 'For Approval': '#d97706', 'Approved': '#16a34a', 'PO Created': '#7c3aed', 'For Payment': '#db2777', 'Paid': '#0d9488', 'For Delivery': '#2563eb', 'Delivered': '#059669', 'Completed': '#15803d', 'On Hold': '#a16207', 'Rejected': '#dc2626', 'Cancelled': '#94a3b8' };
const REQ_TYPES = ['Repair / Maintenance', 'Equipment / IT', 'Supplies / Materials', 'Service / Contractor', 'Other'];
const REQ_PRIOS = ['Low', 'Medium', 'High', 'Urgent'];
let reqState = { list: [], view: 'list', status: '', prio: '', q: '', cfg: {}, showDone: false };
function reqRoot() { return document.getElementById('req-root'); }
function reqUser() { const u = getCurrentUser() || {}; return { u, role: normalizeRole(u.role), email: String(u.email || '').toLowerCase(), name: u.name || u.email || '' }; }
function reqIsAdmin() { return reqUser().role === 'admin'; }
function reqList(v) { return String(v || '').split(/[,;\s]+/).map(x => x.trim().toLowerCase()).filter(x => x.includes('@')); }
// Procurement (bibili / PO / canvass): kapag may nakatakdang Procurement emails, sila LANG ang may kontrol. Kung wala pa, dating patakaran (admin/commissary).
function reqProcList() { return reqList((reqState.cfg || {}).supplyChainEmails); }
function reqIsProc() { const me = reqUser(), l = reqProcList(); return l.length ? l.includes(me.email) : (me.role === 'admin' || me.role === 'commissary'); }
function reqIsTeam() { const me = reqUser(); return me.role === 'admin' || reqIsProc() || reqIsApprover(); }
function reqIsApprover() { const c = reqState.cfg || {}, me = reqUser(); const list = (c.cooEmail ? [c.cooEmail] : [c.presidentEmail]).filter(Boolean).map(x => x.toLowerCase()); return list.length ? list.includes(me.email) : me.role === 'admin'; }
function reqBadge(st) { return `<span style="background:${REQ_COLORS[st] || '#64748b'};color:#fff;padding:2px 8px;border-radius:999px;font-size:.72rem;font-weight:700;white-space:nowrap;">${srchEsc(st)}</span>`; }
function reqPrioBadge(p) { const c = { Low: '#64748b', Medium: '#0284c7', High: '#d97706', Urgent: '#dc2626' }[p] || '#64748b'; return `<span style="color:${c};font-weight:700;font-size:.78rem;">${p === 'Urgent' ? '🔥 ' : p === 'High' ? '⬆ ' : ''}${srchEsc(p || '')}</span>`; }
function reqTs(t) { try { const d = t && t.toDate ? t.toDate() : new Date(t && t.seconds ? t.seconds * 1000 : t); return isNaN(d) ? '' : d.toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' }); } catch (e) { return ''; } }
async function loadRequests() {
  const root = reqRoot(); if (!root || !db) return;
  root.innerHTML = '<div class="card">Kinukuha ang mga request...</div>';
  try {
    const me = reqUser();
    try { const c = await db.collection('system_settings').doc('request_approvers').get(); reqState.cfg = c.exists ? c.data() : {}; } catch (e) { reqState.cfg = {}; }
    reqState.list = []; const seen = new Set(), add = sn => sn.forEach(d => { if (!seen.has(d.id)) { seen.add(d.id); reqState.list.push({ id: d.id, ...d.data() }); } });
    if (me.role !== 'branch' && reqIsTeam()) add(await db.collection('requests').get());
    else { add(await db.collection('requests').where('requesterEmail', '==', me.email).get()); if (me.role !== 'branch') { try { add(await db.collection('requests').where('assigneeEmail', '==', me.email).get()); } catch (e) {} } }
    reqState.list.sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
    reqRender();
  } catch (e) { root.innerHTML = `<div class="card" style="color:#dc2626;">Error: ${srchEsc(e.message)}</div>`; }
}
function reqFiltered() {
  const S = reqState; return S.list.filter(r => (!S.status || r.status === S.status) && (!S.prio || r.priority === S.prio) && (!S.q || smartMatch(S.q, `${r.key} ${r.title} ${r.branch} ${r.requester} ${r.description || ''}`)) && (S.showDone || S.status || !['Completed', 'Cancelled', 'Rejected'].includes(r.status)));
}
function reqRender() {
  const root = reqRoot(); if (!root) return; const S = reqState; const me = reqUser(); const list = reqFiltered();
  const counts = {}; S.list.forEach(r => counts[r.status] = (counts[r.status] || 0) + 1);
  const mineApprove = S.list.filter(r => r.status === 'For Approval').length;
  const chips = REQ_STATUSES.filter(s => counts[s]).map(s => `<span onclick="reqState.status='${s}';reqRender()" style="cursor:pointer;">${reqBadge(s)} <b>${counts[s]}</b></span>`).join(' &nbsp; ');
  let body;
  if (S.view === 'board') {
    const cols = REQ_STATUSES.filter(s => S.showDone || !['Completed', 'Cancelled', 'Rejected'].includes(s));
    body = `<div style="display:flex;gap:.6rem;overflow-x:auto;align-items:flex-start;padding-bottom:.5rem;">${cols.map(c => { const items = list.filter(r => r.status === c); return `<div ondragover="event.preventDefault()" ondrop="reqDrop(event,'${c}')" style="min-width:210px;max-width:230px;background:#f1f5f9;border-radius:.5rem;padding:.5rem;"><div style="font-weight:700;margin-bottom:.4rem;">${reqBadge(c)} <small>${items.length}</small></div>${items.map(r => `<div ${reqTransitions(r).length ? `draggable="true" ondragstart="event.dataTransfer.setData('text/plain','${r.id}')"` : ''} onclick="reqOpen('${r.id}')" style="background:#fff;border-radius:.4rem;padding:.5rem;margin-bottom:.4rem;box-shadow:0 1px 2px rgba(0,0,0,.1);cursor:pointer;"><small style="color:#64748b;">${srchEsc(r.key)} · ${srchEsc(r.branch || '')}</small><div style="font-weight:600;margin:.15rem 0;">${srchEsc(r.title)}</div>${reqPrioBadge(r.priority)}${(r.photos || []).length ? ' 📷' + r.photos.length : ''}<div style="font-size:.72rem;color:#64748b;margin-top:.25rem;">📝 ${srchEsc(r.requester || '?')}<br>🛠️ ${srchEsc(r.assignee || 'Unassigned')}</div></div>`).join('') || '<small style="color:#94a3b8;">—</small>'}</div>`; }).join('')}</div>`;
  } else {
    body = `<div class="table-responsive"><table data-notools="1"><thead><tr><th>Key</th><th>Request</th><th>Branch / Reporter</th><th>Priority</th><th>Status</th><th>Assignee</th><th>Huling update</th></tr></thead><tbody>${list.map(r => `<tr style="cursor:pointer;" onclick="reqOpen('${r.id}')"><td><b>${srchEsc(r.key)}</b></td><td><b>${srchEsc(r.title)}</b><br><small style="color:#64748b;">${srchEsc(r.type || '')}${(r.photos || []).length ? ' · 📷 ' + r.photos.length : ''}</small></td><td>${srchEsc(r.branch || '')}<br><small>${srchEsc(r.requester || '')}</small></td><td>${reqPrioBadge(r.priority)}</td><td>${reqBadge(r.status)}</td><td>${srchEsc(r.assignee || '— (wala pa)')}</td><td><small>${srchEsc(reqTs(r.updatedAt))}</small></td></tr>`).join('') || '<tr><td colspan="7" style="text-align:center;color:#94a3b8;">Walang request.</td></tr>'}</tbody></table></div>`;
  }
  root.innerHTML = `<div class="card"><div class="card-title"><span>🛠️ Mga Request — Repair, Maintenance at Pagbili</span><div style="display:flex;gap:.4rem;flex-wrap:wrap;"><button class="btn btn-success btn-sm" onclick="reqOpenNew()">➕ Gumawa ng Request</button>${me.role === 'admin' ? '<button class="btn btn-secondary btn-sm" onclick="reqSetApprovers()">⚙️ Approvers</button>' : ''}<button class="btn btn-secondary btn-sm" onclick="loadRequests()">🔄</button></div></div>
    ${mineApprove && reqIsApprover() && me.role !== 'branch' ? `<div style="background:#fffbeb;border:1px solid #fcd34d;padding:.5rem;border-radius:.4rem;margin-bottom:.5rem;">🔔 ${mineApprove} request ang naghihintay ng approval mo.</div>` : ''}
    <div style="margin-bottom:.5rem;">${chips || '<small style="color:#94a3b8;">Wala pang request.</small>'}</div>
    <div style="display:flex;gap:.4rem;flex-wrap:wrap;align-items:center;margin-bottom:.6rem;">
      <button class="btn btn-sm ${S.view === 'list' ? 'btn-primary' : 'btn-secondary'}" onclick="reqState.view='list';reqRender()">📋 List</button><button class="btn btn-sm ${S.view === 'board' ? 'btn-primary' : 'btn-secondary'}" onclick="reqState.view='board';reqRender()">🗂️ Board</button>
      <select onchange="reqState.status=this.value;reqRender()"><option value="">Lahat ng status</option>${REQ_STATUSES.map(s => `<option ${S.status === s ? 'selected' : ''}>${s}</option>`).join('')}</select>
      <select onchange="reqState.prio=this.value;reqRender()"><option value="">Lahat ng priority</option>${REQ_PRIOS.map(s => `<option ${S.prio === s ? 'selected' : ''}>${s}</option>`).join('')}</select>
      <input type="text" id="req-search" value="${srchEsc(S.q)}" placeholder="🔎 Hanapin..." oninput="reqState.q=this.value;reqRender();var e=document.getElementById('req-search');e.focus();e.setSelectionRange(e.value.length,e.value.length)">
      <label><input type="checkbox" ${S.showDone ? 'checked' : ''} onchange="reqState.showDone=this.checked;reqRender()"> Isama ang tapos/kanselado</label></div>${body}</div>`;
}
function reqOpenNew() {
  const me = reqUser();
  arModal(`<h3>➕ Gumawa ng Request</h3>
    <div class="form-group"><label>Buod (maikling pamagat)</label><input type="text" id="rq-title" placeholder="Hal: Palit ng sirang monitor ng CCTV"></div>
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:.6rem;"><div><label>Uri</label><select id="rq-type">${REQ_TYPES.map(t => `<option>${t}</option>`).join('')}</select></div><div><label>Priority</label><select id="rq-prio">${REQ_PRIOS.map(t => `<option ${t === 'Medium' ? 'selected' : ''}>${t}</option>`).join('')}</select></div><div><label>Kailangan bago ang</label><input type="date" id="rq-need"></div></div>
    <div class="form-group" style="margin-top:.5rem;"><label>Branch / Lokasyon</label><input type="text" id="rq-branch" value="${srchEsc((me.u && me.u.branch) || '')}"></div>
    <div class="form-group"><label>Detalye (ano ang sira / ano ang kailangan, ilan, saan)</label><textarea id="rq-desc" rows="4" style="width:100%;" placeholder="Hal: 1 pc monitor para sa CCTV, nawalan ng display."></textarea></div>
    <div class="form-group"><label>📷 Larawan (hanggang 5)</label><input type="file" id="rq-photos" accept="image/*" multiple></div>
    <button class="btn btn-success" onclick="reqCreate()">📤 I-submit ang Request</button>`);
}
async function reqCreate() {
  const title = (document.getElementById('rq-title') || {}).value.trim(), desc = (document.getElementById('rq-desc') || {}).value.trim();
  if (!title) { alert('Maglagay ng buod/pamagat.'); return; } if (!desc) { alert('Maglagay ng detalye.'); return; }
  const me = reqUser(); const files = [...((document.getElementById('rq-photos') || {}).files || [])].slice(0, 5);
  const photoIds = [], photoDocs = [];
  try {
    for (const f of files) { const id = 'RP-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); photoDocs.push({ id, dataUrl: await compressImageFile(f, 1000, 0.7) }); photoIds.push(id); }
    const cref = db.collection('request_counter').doc('main'); let key = '';
    await db.runTransaction(async tx => { const c = await tx.get(cref); const n = (c.exists ? (c.data().n || 0) : 0) + 1; tx.set(cref, { n }); key = 'REQ-' + String(n).padStart(4, '0'); });
    const now = new Date().toISOString();
    const doc = { key, title, description: desc, type: document.getElementById('rq-type').value, priority: document.getElementById('rq-prio').value, neededBy: document.getElementById('rq-need').value || '', branch: document.getElementById('rq-branch').value.trim(), company: await reqCompanyFor(document.getElementById('rq-branch').value.trim()), requester: me.name, requesterEmail: me.email, photos: photoIds, status: 'Open', assignee: '', quotes: [], selectedQuote: null, approval: null, poNumber: '', paymentRef: '', comments: [], history: [{ at: now, by: me.name, from: '', to: 'Open', note: 'Ginawa ang request' }], createdAt: now, updatedAt: now };
    for (const p of photoDocs) await db.collection('request_photos').doc(p.id).set({ dataUrl: p.dataUrl, requestKey: key, createdAt: now });
    await db.collection('requests').doc(key).set(doc);
    try { logSystemAction('REQUEST_CREATED', `${key}: ${title}`); } catch (e) {}
    notify(['supply'], `Bagong request ${key}: ${title}`, `${me.name} (${doc.branch || '—'}) — ${doc.type}, priority ${doc.priority}. ${desc}`);
    arCloseModal(); alert(`✅ Na-submit ang ${key}. Makikita na ito ng Supply Chain para ma-canvass.`); loadRequests();
  } catch (e) { alert('Error: ' + e.message); }
}
function reqRowById(id) { return reqState.list.find(x => x.id === id); }
function reqTransitions(r) {
  const me = reqUser(), own = r.requesterEmail === me.email, proc = reqIsProc(), adm = reqIsAdmin(), t = [];
  const st = r.status;
  if (st === 'Open') { if (proc) t.push(['For Quotation', '🔎 Simulan ang Canvass (kunin)', 'primary']); if (own || adm) t.push(['Cancelled', '❌ I-cancel', 'danger']); }
  if (st === 'For Quotation') { if (proc) { t.push(['For Approval', '📨 I-submit for Approval', 'success']); t.push(['On Hold', '⏸️ Hold', 'secondary']); t.push(['Cancelled', '❌ I-cancel', 'danger']); } }
  if (st === 'For Approval') { if (reqIsApprover() && me.role !== 'branch') { t.push(['Approved', '✅ Approve', 'success']); t.push(['Rejected', '⛔ Reject', 'danger']); t.push(['For Quotation', '↩ Ibalik sa canvass', 'secondary']); } }
  if (st === 'Approved') { if (proc) t.push(['PO Created', '📝 Na-gawan na ng PO', 'primary']); }
  if (st === 'PO Created' && !r.poId) { if (adm) t.push(['For Payment', '💳 For Payment (Accounting)', 'primary']); }
  if (st === 'For Payment' && !r.poId) { if (adm) t.push(['Paid', '✅ Bayad na', 'success']); }
  if (st === 'Paid' && !(r.poId && r.status === 'Delivered')) { if (proc) t.push(['For Delivery', '🚚 Hintay ng Delivery', 'primary']); }
  if (st === 'For Delivery') { if (proc) t.push(['Delivered', '📦 Dumating na', 'success']); if (own) t.push(['Completed', '✅ Natanggap / Ayos na', 'success']); }
  if (st === 'Delivered') { if (own || adm) t.push(['Completed', '✅ Natanggap / Ayos na', 'success']); }
  if (st === 'On Hold') { if (proc) t.push(['For Quotation', '▶️ Ituloy ang canvass', 'primary']); }
  return t;
}
async function reqPhotoHtml(ids) {
  const out = []; for (const id of (ids || [])) { try { const d = await db.collection('request_photos').doc(id).get(); if (d.exists && /^data:application\/pdf/.test(d.data().dataUrl || '')) out.push(`<button class="btn btn-secondary" style="height:110px;width:110px;" onclick="reqShowPhoto('${id}')">📄 PDF<br><small>I-click para buksan</small></button>`); else if (d.exists) out.push(`<img src="${d.data().dataUrl}" style="width:110px;height:110px;object-fit:cover;border-radius:.4rem;border:1px solid #cbd5e1;cursor:zoom-in;" onclick="imgOpen(this.src)">`); } catch (e) {} }
  return out.join(' ');
}
async function reqOpen(id) {
  const r = reqRowById(id); if (!r) return; const me = reqUser(); const tr = reqTransitions(r);
  const photos = await reqPhotoHtml(r.photos);
  const sel = r.selectedQuote;
  const canQuote = reqIsProc() && ['For Quotation', 'Open', 'On Hold'].includes(r.status);
  const quotes = (r.quotes || []).map((q, i) => `<tr style="${sel === i ? 'background:#ecfdf5;' : ''}"><td>${srchEsc(q.supplier)}</td><td class="num">${money(q.amount)}</td><td>${srchEsc(q.notes || '')}</td><td>${q.photoId ? `<button class="btn btn-sm btn-secondary" onclick="reqShowPhoto('${q.photoId}')">📎</button>` : ''}</td><td>${sel === i ? '<b style="color:#059669;">✅ Napili</b>' : (canQuote ? `<button class="btn btn-sm btn-success" onclick="reqSelectQuote('${r.id}',${i})">Piliin</button>` : '')} ${canQuote ? `<button class="btn btn-sm btn-danger" onclick="reqDelQuote('${r.id}',${i})">🗑</button>` : ''}</td></tr>`).join('');
  const poIds = r.poFiles || [], poThumbs = await reqPhotoHtml(poIds), poOk = r.poNumber || ['Approved', 'PO Created', 'For Payment', 'Paid', 'For Delivery', 'Delivered', 'Completed'].includes(r.status);
  const poBox = poOk ? `<h4 style="margin:.8rem 0 .3rem;">📄 Purchase Order (attachment)${r.poNumber ? ' — ' + srchEsc(r.poNumber) : ''}</h4>${poThumbs ? `<div style="display:flex;gap:.4rem;flex-wrap:wrap;margin-bottom:.3rem;">${poThumbs}</div>` : '<small style="color:#94a3b8;">Wala pang na-upload na PO.</small>'}${reqIsTeam() ? `<div style="margin-top:.3rem;"><input type="file" id="po-file" accept="image/*,application/pdf" multiple> <button class="btn btn-sm btn-primary" onclick="reqPoAttach('${r.id}')">📎 I-upload ang PO</button></div>` : ''}` : '';
  const hist = (r.history || []).slice().reverse().map(h => `<div style="font-size:.82rem;border-left:3px solid #cbd5e1;padding-left:.5rem;margin:.25rem 0;"><b>${srchEsc(h.by)}</b> — ${h.from ? srchEsc(h.from) + ' → ' : ''}${reqBadge(h.to)} ${h.note ? '· ' + srchEsc(h.note) : ''}<br><small style="color:#94a3b8;">${srchEsc(reqTs(h.at))}</small></div>`).join('');
  const comments = (r.comments || []).map(c => `<div style="background:#f8fafc;border-radius:.4rem;padding:.4rem .6rem;margin:.3rem 0;"><b>${srchEsc(c.by)}</b> <small style="color:#94a3b8;">${srchEsc(reqTs(c.at))}</small><br>${srchEsc(c.text)}</div>`).join('');
  arModal(`<div style="display:flex;justify-content:space-between;gap:.5rem;flex-wrap:wrap;"><h3 style="margin:0;">${srchEsc(r.key)} — ${srchEsc(r.title)}</h3>${reqBadge(r.status)}</div>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:.4rem;margin:.6rem 0;font-size:.85rem;"><div><small>Company</small><br>${srchEsc(r.company || '—')}</div><div><small>📝 Reporter (nag-request)</small><br><b>${srchEsc(r.requester || '—')}</b></div><div><small>🛠️ Assignee (bibili / hahawak)</small><br><b>${srchEsc(r.assignee || 'Unassigned')}</b>${reqIsProc() && !['Completed', 'Cancelled', 'Rejected'].includes(r.status) ? ` <button class="btn btn-sm btn-secondary" onclick="reqAssign('${r.id}')">👤 I-assign</button>` : ''}</div>${r.poNumber ? `<div><small>PO / Accounting</small><br>${srchEsc(r.poNumber)} · ${srchEsc(r.poStatus || 'Approved')}</div>` : ''}<div><small>Uri</small><br>${srchEsc(r.type)}</div><div><small>Priority</small><br>${reqPrioBadge(r.priority)}</div><div><small>Branch</small><br>${srchEsc(r.branch || '')}</div><div><small>Humiling</small><br>${srchEsc(r.requester)}</div><div><small>Kailangan bago ang</small><br>${srchEsc(r.neededBy || '—')}</div><div><small>Naka-assign</small><br>${srchEsc(r.assignee || '—')}</div><div><small>PO No.</small><br>${srchEsc(r.poNumber || '—')}</div><div><small>Payment Ref</small><br>${srchEsc(r.paymentRef || '—')}</div></div>
    <div style="white-space:pre-wrap;background:#f8fafc;padding:.6rem;border-radius:.4rem;">${srchEsc(r.description)}</div>
    ${photos ? `<div style="margin:.6rem 0;display:flex;gap:.4rem;flex-wrap:wrap;">${photos}</div>` : ''}
    ${r.approval ? `<div style="margin:.5rem 0;padding:.5rem;border-radius:.4rem;background:${r.status === 'Rejected' ? '#fef2f2' : '#ecfdf5'};">${r.status === 'Rejected' ? '⛔ Rejected' : '✅ Approved'} ni <b>${srchEsc(r.approval.by)}</b> (${srchEsc(r.approval.role || '')}) · ${srchEsc(reqTs(r.approval.at))} ${r.approval.note ? '— ' + srchEsc(r.approval.note) : ''}</div>` : ''}
    <h4 style="margin:.8rem 0 .3rem;">🧾 Canvass / Quotations</h4>
    <div class="table-responsive"><table data-notools="1"><thead><tr><th>Supplier</th><th class="num">Halaga</th><th>Notes</th><th></th><th></th></tr></thead><tbody>${quotes || '<tr><td colspan="5" style="color:#94a3b8;">Wala pang quotation.</td></tr>'}</tbody></table></div>
    ${canQuote ? `<div style="display:grid;grid-template-columns:2fr 1fr 2fr;gap:.4rem;margin-top:.4rem;"><input id="qt-sup" placeholder="Supplier"><input id="qt-amt" type="number" step="0.01" placeholder="Halaga ₱"><input id="qt-note" placeholder="Notes (lead time, warranty)"></div><div style="margin-top:.3rem;"><input type="file" id="qt-file" accept="image/*,application/pdf"> <button class="btn btn-sm btn-primary" onclick="reqAddQuote('${r.id}')">➕ Idagdag ang quotation</button></div>` : ''}
    ${poBox}
    <div style="margin:.8rem 0;display:flex;gap:.4rem;flex-wrap:wrap;">${tr.map(([to, label, cls]) => `<button class="btn btn-${cls}" onclick="reqMove('${r.id}','${to}')">${label}</button>`).join('')}<button class="btn btn-secondary" onclick="reqPrint('${r.id}')">🖨️ Print</button></div>
    <h4 style="margin:.6rem 0 .3rem;">💬 Mga Komento</h4>${comments || '<small style="color:#94a3b8;">Wala pa.</small>'}
    <div style="display:flex;gap:.4rem;margin-top:.4rem;"><input id="rq-comment" placeholder="Magdagdag ng komento..." style="flex:1;"><button class="btn btn-primary btn-sm" onclick="reqComment('${r.id}')">Ipadala</button></div>
    <h4 style="margin:.8rem 0 .3rem;">🕘 Activity</h4>${hist}`);
}
async function reqFileToData(f) {
  if (/^image\//.test(f.type)) return compressImageFile(f, 1100, 0.7);
  if (f.type === 'application/pdf') { if (f.size > 700 * 1024) throw new Error('Masyadong malaki ang PDF (max ~700KB). Kunan na lang ng larawan o paliitin ang PDF.'); return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = () => rej(new Error('Hindi mabasa ang file.')); r.readAsDataURL(f); }); }
  throw new Error('Larawan o PDF lang ang tinatanggap.');
}
async function reqPoAttach(id) {
  const fs = [...((document.getElementById('po-file') || {}).files || [])]; if (!fs.length) { alert('Pumili ng larawan o PDF ng PO.'); return; } const me = reqUser();
  try { const ids = []; for (const f of fs.slice(0, 5)) { const pid = 'RP-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); await db.collection('request_photos').doc(pid).set({ dataUrl: await reqFileToData(f), requestKey: id, kind: 'po', createdAt: new Date().toISOString() }); ids.push(pid); }
    await reqUpdate(id, d => ({ poFiles: (d.poFiles || []).concat(ids) }), { by: me.name, from: '', to: (reqRowById(id) || {}).status || 'PO Created', note: `Nag-upload ng PO attachment (${ids.length})` }); reqOpen(id); } catch (e) { alert('Error: ' + e.message); }
}
// ---- Lightbox: i-click ang anumang larawan para lumaki (zoom, save, close) ----
function imgOpen(src) {
  if (!src) return; let o = document.getElementById('img-lightbox'); if (o) o.remove();
  o = document.createElement('div'); o.id = 'img-lightbox'; o.style.cssText = 'position:fixed;inset:0;background:rgba(15,23,42,.92);z-index:99999;display:flex;flex-direction:column;';
  const pdf = /^data:application\/pdf/.test(src); let url = src; if (pdf) { try { const b = atob(src.split(',')[1]), u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); url = URL.createObjectURL(new Blob([u], { type: 'application/pdf' })); } catch (e) {} }
  o.innerHTML = `<div style="display:flex;gap:.5rem;justify-content:flex-end;padding:.5rem;">${pdf ? '' : '<button class="btn btn-secondary btn-sm" data-z="-1">➖</button><button class="btn btn-secondary btn-sm" data-z="1">➕</button>'}<a class="btn btn-secondary btn-sm" href="${url}" download="${pdf ? 'file.pdf' : 'larawan.jpg'}" style="text-decoration:none;">⬇️ I-save</a><button class="btn btn-danger btn-sm" data-close="1">✕ Isara</button></div><div id="lb-stage" style="flex:1;overflow:auto;text-align:center;touch-action:pan-x pan-y pinch-zoom;">${pdf ? `<iframe src="${url}" style="width:100%;height:100%;border:0;background:#fff;"></iframe>` : `<img id="lb-img" src="${src}" style="max-width:96vw;max-height:88vh;margin:auto;display:block;">`}</div>`;
  let w = 0; o.onclick = e => { const t = e.target; if (t.dataset && t.dataset.close || t === o || t.id === 'lb-stage') { o.remove(); return; } if (t.dataset && t.dataset.z) { const im = document.getElementById('lb-img'); w = Math.max(0, Math.min(5, w + (+t.dataset.z))); im.style.maxWidth = w ? (96 + w * 80) + 'vw' : '96vw'; im.style.maxHeight = w ? 'none' : '88vh'; im.style.width = w ? (96 + w * 80) + 'vw' : ''; } };
  document.body.appendChild(o);
}
document.addEventListener('click', e => {
  const t = e.target; if (!t || t.tagName !== 'IMG' || !t.src || t.closest('#img-lightbox') || t.dataset.nozoom !== undefined) return;
  if (t.closest('button, a, nav, aside, header, .sidebar, [class*="avatar"], [class*="logo"]')) return;
  if (!(/^data:image/.test(t.src) || t.closest('#ar-modal, .table-responsive, table, [data-zoom]'))) return; imgOpen(t.src);
});
document.addEventListener('keydown', e => { if (e.key === 'Escape') { const o = document.getElementById('img-lightbox'); if (o) o.remove(); } });
async function reqShowPhoto(id) { try { const d = await db.collection('request_photos').doc(id).get(); if (d.exists) imgOpen(d.data().dataUrl); else alert('Wala nang larawan/file na ito.'); } catch (e) { alert('Error: ' + e.message); } }
async function reqUpdate(id, fn, histEntry) {
  const ref = db.collection('requests').doc(id);
  await db.runTransaction(async tx => {
    const snap = await tx.get(ref); if (!snap.exists) throw new Error('Wala na ang request.');
    const d = snap.data(); const patch = fn(d) || {}; const now = new Date().toISOString();
    if (histEntry) patch.history = (d.history || []).concat([Object.assign({ at: now }, histEntry)]);
    patch.updatedAt = now; tx.update(ref, patch);
  });
  await loadRequests(); reqOpen(id);
}
async function reqComment(id) {
  const text = ((document.getElementById('rq-comment') || {}).value || '').trim(); if (!text) return; const me = reqUser();
  try { await reqUpdate(id, d => ({ comments: (d.comments || []).concat([{ by: me.name, at: new Date().toISOString(), text }]) })); } catch (e) { alert('Error: ' + e.message); }
}
async function reqAddQuote(id) {
  const sup = (document.getElementById('qt-sup') || {}).value.trim(), amt = parseFloat((document.getElementById('qt-amt') || {}).value), note = (document.getElementById('qt-note') || {}).value.trim();
  if (!sup || !(amt > 0)) { alert('Ilagay ang supplier at halaga.'); return; } const me = reqUser(); const f = (document.getElementById('qt-file') || {}).files[0];
  try {
    let pid = ''; if (f) { pid = 'RP-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); await db.collection('request_photos').doc(pid).set({ dataUrl: await reqFileToData(f), requestKey: id, createdAt: new Date().toISOString() }); }
    await reqUpdate(id, d => ({ quotes: (d.quotes || []).concat([{ id: 'Q' + Date.now().toString(36), supplier: sup, amount: amt, notes: note, photoId: pid, by: me.name, at: new Date().toISOString() }]), status: d.status === 'Open' ? 'For Quotation' : d.status, assignee: d.assignee || me.name }), { by: me.name, from: '', to: 'For Quotation', note: `Quotation: ${sup} ${money(amt)}` });
  } catch (e) { alert('Error: ' + e.message); }
}
async function reqSelectQuote(id, i) { const me = reqUser(); try { await reqUpdate(id, d => ({ selectedQuote: i }), { by: me.name, from: '', to: 'For Quotation', note: 'Napili ang quotation #' + (i + 1) }); } catch (e) { alert(e.message); } }
async function reqDelQuote(id, i) { if (!await uiConfirm('Burahin ang quotation na ito?')) return; try { await reqUpdate(id, d => { const q = (d.quotes || []).slice(); q.splice(i, 1); return { quotes: q, selectedQuote: null }; }); } catch (e) { alert(e.message); } }
async function reqMove(id, to) {
  const r = reqRowById(id); if (!r) return; const me = reqUser(); const allowed = reqTransitions(r).some(t => t[0] === to); if (!allowed) { alert('Hindi mo puwedeng gawin ito.'); return; }
  let note = ''; const extra = {};
  if (to === 'For Approval') { if (r.selectedQuote == null || !(r.quotes || [])[r.selectedQuote]) { alert('Pumili muna ng quotation (Piliin) bago i-submit for approval.'); return; } if ((r.quotes || []).length < 2 && !await uiConfirm('Isang quotation pa lang. Ituloy pa rin for approval?')) return; }
  if (to === 'Rejected') { note = await uiPrompt('Dahilan ng pag-reject:'); if (!note) return; extra.approval = { by: me.name, role: 'Approver', at: new Date().toISOString(), note }; }
  if (to === 'Approved') { note = await uiPrompt('Komento sa approval (optional):') || ''; const c = reqState.cfg || {}; const role = (c.presidentEmail && me.email === c.presidentEmail.toLowerCase()) ? 'President' : (c.cooEmail && me.email === c.cooEmail.toLowerCase()) ? 'COO' : 'Approver'; extra.approval = { by: me.name, role, at: new Date().toISOString(), note }; }
  if (to === 'PO Created') { const made = await reqMakePO(r, me); if (!made) return; extra.poNumber = made.poNumber; extra.poId = made.poId; extra.company = made.company; }
  if (to === 'Paid') { const ref = await uiPrompt('Payment reference (check no. / transfer ref):', r.paymentRef || ''); if (ref === null) return; extra.paymentRef = ref.trim(); }
  if (to === 'Cancelled') { note = await uiPrompt('Dahilan ng pag-cancel:') || ''; }
  if (to === 'On Hold') { note = await uiPrompt('Dahilan ng hold:') || ''; }
  if (to === 'For Quotation' && r.status === 'Open') { extra.assignee = me.name; extra.assigneeEmail = me.email; }
  if (to === 'For Quotation' && r.status === 'For Approval') { note = await uiPrompt('Bakit ibinalik sa canvass?') || ''; extra.approval = null; extra.selectedQuote = null; }
  try { await reqUpdate(id, d => Object.assign({ status: to }, extra, (to === 'For Quotation' && !d.assignee && !extra.assignee) ? { assignee: me.name } : {}), { by: me.name, from: r.status, to, note }); try { logSystemAction('REQUEST_STATUS', `${r.key}: ${r.status} → ${to}`); } catch (e) {}
    const sub = `${r.key} — ${r.title}`; const who = [r.requesterEmail, r.assigneeEmail].filter(Boolean);
    if (to === 'For Approval') notify(['coo', 'president'], `Para sa approval: ${sub}`, `${me.name} ay nag-submit ng canvass para sa approval. Napiling quotation: ${((r.quotes || [])[r.selectedQuote] || {}).supplier || ''} — ${money(((r.quotes || [])[r.selectedQuote] || {}).amount || 0)}.`);
    else if (to === 'Approved' || to === 'Rejected') notify(who, `${to === 'Approved' ? 'APPROVED' : 'REJECTED'}: ${sub}`, `${me.name} ay ${to === 'Approved' ? 'nag-approve' : 'nag-reject'}.${note ? ' ' + note : ''}`);
    else if (to === 'PO Created') notify(['accounting', ...who], `PO para sa bayad: ${sub}`, `Na-gawan na ng PO (${extra.poNumber}) — ${r.company || extra.company || ''} ${r.branch || ''}. Nasa PO list/AP na ito para sa pagproseso.`);
    else if (to === 'For Quotation' && r.status === 'Open') notify([r.requesterEmail], `Sinimulan na ang canvass: ${sub}`, `${me.name} ang humahawak ng request mo.`);
    else if (['Delivered', 'Completed', 'Cancelled', 'On Hold'].includes(to)) notify(who, `${to}: ${sub}`, `${me.name}${note ? ': ' + note : ''}`); } catch (e) { alert('Error: ' + e.message); }
}

async function reqCompanyFor(branchText) {
  try { const b = String(branchText || '').trim(); if (!b) return ''; const snap = await db.collection('inventory_branches').get(); let c = '';
    snap.forEach(d => { const x = d.data(); if (!c && (hubKey(x.branch) === hubKey(b) || hubKey(x.code) === hubKey(b))) c = x.company || ''; }); return c; } catch (e) { return ''; }
}
// Pag-approve → gagawa ng totoong Vendor PO (Approved na) na lalabas sa PO list + AP ng accounting, naka-tag sa company ng branch
async function reqMakePO(r, me) {
  const q = (r.quotes || [])[r.selectedQuote]; if (!q) { alert('Walang napiling quotation.'); return null; }
  let company = r.company || await reqCompanyFor(r.branch);
  if (!company) { let list = []; try { (await db.collection('companies').get()).forEach(d => list.push(d.data().name || d.id)); } catch (e) {} company = (await uiPrompt('Anong COMPANY ang magbabayad nito?' + (list.length ? '\n(' + list.join(', ') + ')' : ''), list[0] || '') || '').trim(); if (!company) return null; }
  const poNumber = 'RPO-' + String(r.key).replace(/\D/g, ''); const poId = poNumber; const amt = +q.amount || 0; const now = new Date().toISOString();
  const ref = db.collection('vendor_pos').doc(poId); const ex = await ref.get(); if (ex.exists) return { poNumber, poId, company };
  await ref.set({ poNumber, vendorName: q.supplier, vendorId: '', status: 'Approved', approvals: { supplyChain: { by: me.name, at: now }, coo: r.approval ? { by: r.approval.by, at: r.approval.at } : {} }, items: [{ itemCode: r.key, itemName: r.title, qty: 1, uomType: 'whole', uomText: 'lot', unitCost: amt, subtotal: amt }], totalAmount: amt, nonInventory: true, requestKey: r.key, branch: r.branch || '', company, notes: r.description || '', createdBy: me.name, createdAt: now });
  return { poNumber, poId, company };
}
async function reqSyncFromPO(key, to, note, patchExtra) {
  try {
    const ref = db.collection('requests').doc(key); const snap = await ref.get(); if (!snap.exists) return; const d = snap.data(); notify([d.requesterEmail, d.assigneeEmail].filter(Boolean), `${key}: ${to === 'Paid' ? 'Bayad na (cheque)' : to}`, `${d.title} — ${note || ''}`);
    const order = ['PO Created', 'For Payment', 'Paid', 'For Delivery', 'Delivered', 'Completed']; const a = order.indexOf(d.status), b = order.indexOf(to);
    const now = new Date().toISOString();
    if (a < 0 || b <= a) { if (patchExtra && a >= 0) await ref.update(Object.assign({ updatedAt: now, history: (d.history || []).concat([{ at: now, by: 'System (PO)', from: d.status, to: d.status, note: note || '' }]) }, patchExtra)); return; } // hindi paatras ang status
    await ref.update(Object.assign({ status: to, updatedAt: now, history: (d.history || []).concat([{ at: now, by: 'System (PO)', from: d.status, to, note: note || '' }]) }, patchExtra || {}));
  } catch (e) {}
}
async function reqAssign(id) {
  const r = reqRowById(id); if (!r || !reqIsProc()) return; const l = reqProcList(); if (!l.length) { alert('Itakda muna ang Procurement emails (⚙️ Approvers / Email Notifications).'); return; }
  arModal(`<h3>👤 I-assign ang ${srchEsc(r.key)}</h3><div class="form-group"><label>Assignee (taga-bili / hahawak)</label><select id="rq-asg">${l.map(e => `<option value="${srchEsc(e)}" ${e === (r.assigneeEmail || '') ? 'selected' : ''}>${srchEsc(e)}</option>`).join('')}</select></div><button class="btn btn-success" onclick="reqAssignSave('${srchEsc(id)}')">💾 I-save</button>`);
}
async function reqAssignSave(id) {
  const r = reqRowById(id), e = (document.getElementById('rq-asg') || {}).value; if (!r || !e) return; const me = reqUser();
  try { arCloseModal(); await reqUpdate(id, d => ({ assignee: e.split('@')[0], assigneeEmail: e }), { by: me.name, from: r.status, to: r.status, note: 'Na-assign kay ' + e }); notify([e, r.requesterEmail].filter(Boolean), `Na-assign: ${r.key} — ${r.title}`, `${me.name} ay nag-assign ng request kay ${e}.`); } catch (er) { alert('Error: ' + er.message); }
}
async function reqSetApprovers() {
  const c = reqState.cfg || {}; const coo = await uiPrompt('Email ng COO (puwedeng mag-approve ng request):', c.cooEmail || ''); if (coo === null) return;
  const pres = await uiPrompt('Email ng President (backup lang; ginagamit lang kung walang COO):', c.presidentEmail || ''); if (pres === null) return;
  const sc = await uiPrompt('Procurement / Taga-bili / Taga-PO (mga email, may kuwit). Sila LANG ang makakakita at makaka-drag ng request:', c.supplyChainEmails || ''); if (sc === null) return;
  const list = reqList(sc);
  await db.collection('system_settings').doc('request_approvers').set({ cooEmail: coo.trim().toLowerCase(), presidentEmail: pres.trim().toLowerCase(), supplyChainEmails: list.join(', '), procurementList: list }, { merge: true }); ntfCache.at = 0; alert('✅ Na-save. Ang COO ang laging mag-approve.'); loadRequests();
}
async function reqPrint(id) {
  const r = reqRowById(id); if (!r) return; const photos = await reqPhotoHtml(r.photos);
  const q = (r.quotes || []).map((x, i) => `<tr><td>${r.selectedQuote === i ? '✔' : ''}</td><td>${srchEsc(x.supplier)}</td><td class="num">${money(x.amount)}</td><td>${srchEsc(x.notes || '')}</td></tr>`).join('');
  printHtmlDoc('Request ' + r.key, `<h1>Request Form — ${srchEsc(r.key)}</h1><div class="meta">${srchEsc(r.branch || '')} · ${srchEsc(r.requester)} · ${srchEsc(reqTs(r.createdAt))} · ${printedByLine()}</div>
    <table><tbody><tr><td><b>Request</b></td><td>${srchEsc(r.title)}</td></tr><tr><td><b>Uri / Priority</b></td><td>${srchEsc(r.type)} / ${srchEsc(r.priority)}</td></tr><tr><td><b>Kailangan bago ang</b></td><td>${srchEsc(r.neededBy || '—')}</td></tr><tr><td><b>Detalye</b></td><td style="white-space:pre-wrap;">${srchEsc(r.description)}</td></tr><tr><td><b>Status</b></td><td>${srchEsc(r.status)} ${r.poNumber ? '· PO ' + srchEsc(r.poNumber) : ''}</td></tr></tbody></table>
    <h2>Canvass</h2><table><thead><tr><th></th><th>Supplier</th><th class="num">Halaga</th><th>Notes</th></tr></thead><tbody>${q || '<tr><td colspan="4">Wala</td></tr>'}</tbody></table>
    ${photos ? `<h2>Larawan</h2><div>${photos}</div>` : ''}
    <div class="sign"><div>Humiling: ${srchEsc(r.requester)}</div><div>Supply Chain: ${srchEsc(r.assignee || '')}</div><div>Approved: ${srchEsc(r.approval ? r.approval.by + ' (' + (r.approval.role || '') + ')' : '')}</div></div>`);
}


// ========================================================
// 🕒 ATTENDANCE & SCHEDULE  (parang Sprout)
// attendance_profiles/{email}: {email,name,branch,managerEmail,defaultWeek[7],graceMin}
// attendance_weeks/{email}__{monday}: {email,week[7]}        (null = gamitin ang default)
// attendance_logs/{email}__{date}: {email,date,month,managerEmail,punches:[{type,at,src}]}
// attendance_requests/{id}: {type:OB|OT|SchedAdj, email,date,from,to,segs,reason,status}
// Day = {off:true} | {segs:[{in:'10:00',out:'12:00'},{in:'15:00',out:'19:00'}]}
// ========================================================
const ATT_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
let attState = { tab: 'me', month: '', week: '', prof: null, logs: {}, weeks: {}, reqs: [], team: [], teamLogs: [], teamReqs: [], teamWeeks: {}, isMgr: false };
function attNow() { return new Date(); }
function attRoot() { return document.getElementById('att-root'); }
function attMe() { const u = getCurrentUser() || {}; return { email: String(u.email || '').toLowerCase(), name: u.name || u.email || '', role: normalizeRole(u.role), branch: u.branch || '' }; }
function attPad(n) { return String(n).padStart(2, '0'); }
function attISO(d) { return `${d.getFullYear()}-${attPad(d.getMonth() + 1)}-${attPad(d.getDate())}`; }
function attDate(iso) { const [y, m, d] = iso.split('-').map(Number); return new Date(y, m - 1, d); }
function attDow(iso) { return (attDate(iso).getDay() + 6) % 7; }
function attMonday(iso) { const d = attDate(iso); d.setDate(d.getDate() - attDow(iso)); return attISO(d); }
function attMin(t) { const m = /^(\d{1,2})(?::(\d{2}))?$/.exec(String(t || '').trim()); return m ? (+m[1]) * 60 + (+(m[2] || 0)) : null; }
function attHM(min) { return `${attPad(Math.floor(min / 60) % 24)}:${attPad(min % 60)}`; }
function attPunchMin(iso) { const d = new Date(iso); return d.getHours() * 60 + d.getMinutes(); }
let attPresets = {}; // name(lowercase) -> text
function attParseDay(txt, depth) {
  const t = String(txt || '').trim(); if (!t) return null; if (/^(off|rd|rest)/i.test(t)) return { off: true };
  if (!depth && attPresets[t.toLowerCase()]) return attParseDay(attPresets[t.toLowerCase()], 1);
  const segs = [];
  for (const part of t.split('/')) {
    const m = /^\s*([\d:]+)\s*-\s*([\d:]+)\s*(?:@\s*([\d:]+)\s*-\s*([\d:]+))?\s*$/.exec(part); if (!m) return null;
    const a = attMin(m[1]), b = attMin(m[2]); if (a == null || b == null || b <= a) return null;
    if (m[3]) { const c = attMin(m[3]), d = attMin(m[4]); if (c == null || d == null || !(a < c && c < d && d < b)) return null; segs.push({ in: attHM(a), out: attHM(c) }, { in: attHM(d), out: attHM(b) }); }
    else segs.push({ in: attHM(a), out: attHM(b) });
  }
  return segs.length ? { segs } : null;
}
function attDayTxt(d) { if (!d) return ''; if (d.off) return 'OFF'; const g = d.segs || []; if (g.length === 2) return `${g[0].in}-${g[1].out}@${g[0].out}-${g[1].in}`; return g.map(s => `${s.in}-${s.out}`).join('/'); }
function attDayMin(d) { return d && d.segs ? d.segs.reduce((n, s) => n + (attMin(s.out) - attMin(s.in)), 0) : 0; }
function attHrs(m) { return m ? (Math.round(m / 6) / 10) + 'h' : '—'; }
function attDayDesc(d) { if (!d) return 'Walang schedule'; if (d.off) return 'OFF (day off)'; const g = d.segs || []; if (!g.length) return 'Walang schedule'; return `${g[0].in} – ${g[g.length - 1].out}${g.length === 2 ? ` · break ${g[0].out}–${g[1].in}` : g.length > 2 ? ' · ' + g.map(x => x.in + '-' + x.out).join(' / ') : ''} · ${attHrs(attDayMin(d))}`; }
function attSegsFor(date) {
  const S = attState; const adj = S.reqs.concat(S.teamReqs || []).find(r => r.type === 'SchedAdj' && r.status === 'Approved' && r.date === date && r.email === S._cur);
  if (adj && adj.segs) return { segs: adj.segs, src: 'Adjusted' };
  const wk = (S.weeks[S._cur + '__' + attMonday(date)] || {}).week; const dow = attDow(date);
  const day = (wk && wk[dow]) || ((S.profCur && S.profCur.defaultWeek) || [])[dow];
  if (!day) return { segs: [], src: 'none' }; if (day.off) return { segs: [], off: true, src: 'off' };
  return { segs: day.segs || [], src: wk && wk[dow] ? 'week' : 'default' };
}
// kalkulahin ang isang araw
function attCompute(date, log, reqs, sched, grace) {
  const today = attISO(attNow()); const out = { date, segs: sched.segs, off: !!sched.off, ints: [], late: 0, under: 0, absent: false, otEarly: 0, otLate: 0, otPaid: 0, nsd: 0, worked: 0, ob: false, open: false, status: '' };
  const ob = reqs.find(r => r.type === 'OB' && r.status === 'Approved' && r.date === date);
  const punches = ((log && log.punches) || []).slice().sort((a, b) => String(a.at).localeCompare(String(b.at)));
  let cur = null;
  punches.forEach(p => { const m = attPunchMin(p.at); if (p.type === 'in') { if (cur == null) cur = m; } else if (cur != null) { if (m > cur) out.ints.push([cur, m]); cur = null; } });
  if (cur != null) { out.open = true; if (date === today) { const nm = attNow().getHours() * 60 + attNow().getMinutes(); if (nm > cur) out.ints.push([cur, nm]); } }
  if (ob) { const a = attMin(ob.from), b = attMin(ob.to); if (a != null && b != null && b > a) { out.ints.push([a, b]); out.ob = true; } }
  const ov = (a, b, c, d) => Math.max(0, Math.min(b, d) - Math.max(a, c));
  const segs = sched.segs.map(s => [attMin(s.in), attMin(s.out)]);
  segs.forEach(([a, b], k) => {
    const hit = out.ints.filter(([x, y]) => ov(x, y, a, b) > 0);
    if (!hit.length) { out.under += (date < today || (date === today && attNow().getHours() * 60 + attNow().getMinutes() >= b)) ? (b - a) : 0; return; }
    const first = Math.min(...hit.map(h => Math.max(h[0], a))), last = Math.max(...hit.map(h => Math.min(h[1], b)));
    out.late += Math.max(0, first - a - (k === 0 ? grace : 0)); if (!(date === today && out.open)) out.under += Math.max(0, b - last);
    out.worked += hit.reduce((s, h) => s + ov(h[0], h[1], a, b), 0);
  });
  if (segs.length) {
    const s0 = segs[0][0], sN = segs[segs.length - 1][1];
    out.ints.forEach(([x, y]) => { out.otEarly += ov(x, y, 0, s0); out.otLate += ov(x, y, sN, 24 * 60); });
  } else out.ints.forEach(([x, y]) => { out.otLate += (y - x); });
  const otr = reqs.filter(r => r.type === 'OT' && r.status === 'Approved' && r.date === date);
  otr.forEach(r => { const a = attMin(r.from), b = attMin(r.to); if (a == null || b == null) return; out.ints.forEach(([x, y]) => { out.otPaid += ov(x, y, a, b); }); });
  out.ints.forEach(([x, y]) => { out.nsd += ov(x, y, 22 * 60, 24 * 60) + ov(x, y, 0, 6 * 60); });
  const has = out.ints.length > 0;
  if (segs.length && !has && date < today) out.absent = true;
  out.status = out.off ? (has ? 'Off (pumasok)' : 'Off') : !segs.length ? (has ? 'Walang schedule' : '—') : out.absent ? 'Absent' : date > today ? '' : has ? (out.ob ? 'OB' : out.late ? 'Late' : 'Present') : 'Naghihintay';
  if (out.open && date < today) out.status += ' ⚠️ walang time-out';
  out.sugg = Math.max(0, out.otEarly + out.otLate - out.otPaid);
  return out;
}
async function loadAttendance() {
  const root = attRoot(); if (!root || !db) return; const me = attMe(); const S = attState;
  root.innerHTML = '<div class="card">Kinukuha ang attendance...</div>';
  if (!S.month) S.month = attISO(attNow()).slice(0, 7); if (!S.week) S.week = attMonday(attISO(attNow()));
  try {
    try { const pz = await db.collection('system_settings').doc('attendance_presets').get(); attPresets = {}; ((pz.exists && pz.data().text) || '').split(/\r?\n/).forEach(l => { const m = /^\s*([^=]+?)\s*=\s*(.+?)\s*$/.exec(l); if (m) attPresets[m[1].toLowerCase()] = m[2]; }); } catch (e) {}
    const pd = await db.collection('attendance_profiles').doc(me.email).get(); S.prof = pd.exists ? pd.data() : null; S._cur = me.email; S.profCur = S.prof;
    const [lg, rq, wk] = await Promise.all([db.collection('attendance_logs').where('email', '==', me.email).get(), db.collection('attendance_requests').where('email', '==', me.email).get(), db.collection('attendance_weeks').where('email', '==', me.email).get()]);
    S.logs = {}; lg.forEach(d => { S.logs[d.data().date] = d.data(); }); S.reqs = []; rq.forEach(d => S.reqs.push({ id: d.id, ...d.data() })); S.weeks = {}; wk.forEach(d => S.weeks[d.id] = d.data());
    S.reqs.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
    const tq = me.role === 'admin' ? await db.collection('attendance_profiles').get() : await db.collection('attendance_profiles').where('managerEmail', '==', me.email).get();
    S.team = []; tq.forEach(d => S.team.push(d.data())); S.team = S.team.filter(p => p.email !== me.email || me.role === 'admin');
    S.isMgr = me.role === 'admin' || S.team.length > 0; if (!S.isMgr && (S.tab === 'team' || S.tab === 'sched')) S.tab = 'me';
    if (S.isMgr) { await attLoadTeamData(); }
    attRender();
  } catch (e) { root.innerHTML = `<div class="card" style="color:#dc2626;">Error: ${srchEsc(e.message)}</div>`; }
}
async function attLoadTeamData() {
  const me = attMe(), S = attState; const base = (c) => me.role === 'admin' ? db.collection(c).get() : db.collection(c).where('managerEmail', '==', me.email).get();
  const [lg, rq, wk] = await Promise.all([base('attendance_logs'), base('attendance_requests'), base('attendance_weeks')]);
  S.teamLogs = []; lg.forEach(d => S.teamLogs.push(d.data())); S.teamReqs = []; rq.forEach(d => S.teamReqs.push({ id: d.id, ...d.data() })); S.teamWeeks = {}; wk.forEach(d => S.teamWeeks[d.id] = d.data());
}
function attTabs() { const S = attState; const t = [['me', '👤 Attendance Ko']]; if (S.isMgr) t.push(['team', '👥 Team & Approvals'], ['sched', '📅 Schedule']); return `<div style="display:flex;gap:.4rem;flex-wrap:wrap;margin-bottom:.7rem;">${t.map(([k, l]) => `<button class="btn btn-sm ${S.tab === k ? 'btn-primary' : 'btn-secondary'}" onclick="attState.tab='${k}';attRender()">${l}${k === 'team' ? attPendingBadge() : ''}</button>`).join('')}</div>`; }
function attPendingBadge() { const n = attState.teamReqs.filter(r => r.status === 'Pending').length; return n ? ` <span style="background:#dc2626;color:#fff;border-radius:999px;padding:0 6px;font-size:.7rem;">${n}</span>` : ''; }
function attRender() { const S = attState; if (S.tab === 'team') return attRenderTeam(); if (S.tab === 'sched') return attRenderSched(); return attRenderMe(); }
function attMins(m) { if (!m) return '—'; const h = Math.floor(m / 60), r = m % 60; return h ? `${h}h ${r}m` : `${r}m`; }
function attDaysOfMonth(ym) { const [y, m] = ym.split('-').map(Number); const n = new Date(y, m, 0).getDate(); return Array.from({ length: n }, (_, i) => `${ym}-${attPad(i + 1)}`); }
function attMonthRows(email, prof, logs, reqs, weeks, ym) {
  const grace = (prof && +prof.graceMin) || 0; const cur = attState._cur, cp = attState.profCur;
  attState._cur = email; attState.profCur = prof; const prevW = attState.weeks, prevR = attState.reqs; attState.weeks = weeks; attState.reqs = reqs;
  const rows = attDaysOfMonth(ym).map(d => attCompute(d, logs[d], reqs.filter(r => r.date === d), attSegsFor(d), grace));
  attState._cur = cur; attState.profCur = cp; attState.weeks = prevW; attState.reqs = prevR; return rows;
}
function attSummary(rows) { const t = { present: 0, absent: 0, lateDays: 0, late: 0, under: 0, otPaid: 0, sugg: 0, nsd: 0, worked: 0 }; rows.forEach(r => { if (['Present', 'Late', 'OB'].includes(r.status.split(' ')[0]) || /^(Present|Late|OB)/.test(r.status)) t.present++; if (r.absent) t.absent++; if (r.late) { t.lateDays++; t.late += r.late; } t.under += r.under; t.otPaid += r.otPaid; t.sugg += r.sugg; t.nsd += r.nsd; t.worked += r.worked; }); return t; }
function attRenderMe() {
  const root = attRoot(), S = attState, me = attMe(); const today = attISO(attNow()); const log = S.logs[today];
  const sched = attSegsFor(today); const rows = attMonthRows(me.email, S.prof, S.logs, S.reqs, S.weeks, S.month); const T = attSummary(rows);
  const labs = sched.segs.length === 2 ? ['Time In', 'Break Out', 'Break In', 'Time Out'] : ['Time In', 'Time Out', 'Time In', 'Time Out'];
  const pun = ((log && log.punches) || []).map((p, i) => `${p.type === 'in' ? '🟢' : '🔴'} ${labs[i] || (p.type === 'in' ? 'In' : 'Out')} ${attHM(attPunchMin(p.at))}${p.src && p.src !== 'device' ? ' (' + p.src + ')' : ''}`).join(' · ') || 'Wala pang tap ngayon';
  const last = log && log.punches && log.punches.slice(-1)[0]; const nextType = last && last.type === 'in' ? 'out' : 'in';
  const field = S.prof && S.prof.fieldStaff;
  const body = rows.filter(r => r.date <= today || r.segs.length).map(r => `<tr><td>${r.date.slice(5)} <small>${ATT_DAYS[attDow(r.date)]}</small></td><td><small>${r.off ? 'OFF' : attDayDesc({ segs: r.segs }).replace(/ · [\d.]+h$/, '') || '—'}</small></td><td>${attHrs(r.segs.reduce((n, s) => n + attMin(s.out) - attMin(s.in), 0))}</td><td><small>${r.ints.map(([a, b]) => attHM(a) + '-' + attHM(b)).join(' / ') || '—'}</small></td><td>${r.late ? `<span style="color:#dc2626;">${r.late}m</span>` : '—'}</td><td>${r.under ? `<span style="color:#d97706;">${r.under}m</span>` : '—'}</td><td>${r.otPaid ? `<b style="color:#059669;">${r.otPaid}m</b>` : (r.sugg >= 15 ? `<span style="color:#7c3aed;" title="Smart suggestion">💡 ${r.sugg}m</span>` : '—')}</td><td>${srchEsc(r.status)}</td><td style="white-space:nowrap;"><button class="btn btn-sm btn-secondary" onclick="attOpenReq('OB','${r.date}')">OB</button> <button class="btn btn-sm btn-secondary" onclick="attOpenReq('OT','${r.date}',${r.sugg || 0})">OT</button> <button class="btn btn-sm btn-secondary" onclick="attOpenReq('SchedAdj','${r.date}')">Adj</button></td></tr>`).join('');
  const myReqs = S.reqs.slice(0, 15).map(r => `<tr><td>${srchEsc(r.type)}</td><td>${srchEsc(r.date)}</td><td>${srchEsc(r.type === 'SchedAdj' ? attDayTxt({ segs: r.segs }) : (r.from || '') + '-' + (r.to || ''))}</td><td>${srchEsc(r.reason || '')}${(r.photoIds || []).length ? ' 📷' : ''}</td><td>${r.status === 'Approved' ? '✅' : r.status === 'Rejected' ? '⛔' : r.status === 'Returned' ? '↩' : '⏳'} ${r.status}${r.note ? ' — ' + srchEsc(r.note) : ''}${r.status === 'Returned' ? ` <button class="btn btn-sm btn-primary" onclick="attOpenReq('${r.type}','${r.date}',0,'${r.id}')">✏️ I-edit at ipasa ulit</button>` : ''}</td></tr>`).join('') || '<tr><td colspan="5" style="color:#94a3b8;">Wala pang request.</td></tr>';
  root.innerHTML = `<div class="card"><div class="card-title"><span>🕒 Attendance Ko</span><button class="btn btn-secondary btn-sm" onclick="loadAttendance()">🔄</button></div>${attTabs()}
    ${S.prof ? '' : '<div style="background:#fffbeb;border:1px solid #fcd34d;padding:.5rem;border-radius:.4rem;margin-bottom:.6rem;">⚠️ Wala ka pang schedule. Makipag-ugnayan sa manager o HR.</div>'}
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:.8rem;margin-bottom:.8rem;">
      <div style="background:#f8fafc;border-radius:.5rem;padding:1rem;"><small>Ngayon · ${today} ${ATT_DAYS[attDow(today)]}</small>
        <div style="margin:.3rem 0;">Schedule: <b>${sched.off ? 'OFF (day off)' : attDayDesc({ segs: sched.segs })}</b>${sched.src === 'Adjusted' ? ' <small>(inayos)</small>' : ''}</div><div style="margin-bottom:.6rem;font-size:.85rem;">${pun}</div>
        ${field ? `<div style="font-size:.8rem;color:#0369a1;margin-bottom:.4rem;">📱 Field/Buyer — puwedeng mag-tap sa app</div><button class="btn ${nextType === 'in' ? 'btn-success' : 'btn-danger'}" style="width:100%;font-size:1.1rem;padding:.9rem;" onclick="attPunch()">${nextType === 'in' ? '🟢 TIME IN' : '🔴 TIME OUT'}</button>` : '<div style="font-size:.8rem;color:#64748b;">🪪 Mag-tap ng RFID card, tapos fingerprint sa terminal ng branch. Wala nang button dito. Kung wala ka sa branch, mag-file ng <b>OB</b> sa ibaba.</div>'}</div>
      <div style="background:#f8fafc;border-radius:.5rem;padding:1rem;"><div style="display:flex;justify-content:space-between;align-items:center;"><b>Buod ng buwan</b><input type="month" value="${S.month}" onchange="attState.month=this.value;attRender()"></div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:.3rem;margin-top:.5rem;font-size:.9rem;"><div>✅ Present: <b>${T.present}</b></div><div>❌ Absent: <b>${T.absent}</b></div><div>⏰ Late: <b>${T.lateDays}</b> (${attMins(T.late)})</div><div>↘ Undertime: <b>${attMins(T.under)}</b></div><div>➕ OT (approved): <b>${attMins(T.otPaid)}</b></div><div>🌙 Night diff: <b>${attMins(T.nsd)}</b></div></div></div></div>
    ${T.sugg >= 15 ? `<div style="background:#f5f3ff;border:1px solid #c4b5fd;padding:.5rem;border-radius:.4rem;margin-bottom:.6rem;">💡 <b>Smart suggestion:</b> may ${attMins(T.sugg)} kang tap na labas sa schedule ngayong buwan na wala pang approved OT. I-click ang <b>OT</b> sa araw na iyon para i-file (si manager ang magpapasya; hindi bayad ang pagbibihis/prep).</div>` : ''}
    <div class="table-responsive"><table data-notools="1"><thead><tr><th>Petsa</th><th>Schedule</th><th>Oras</th><th>Actual</th><th>Late</th><th>UT</th><th>OT</th><th>Status</th><th>I-file</th></tr></thead><tbody>${body}</tbody></table></div>
    <h4 style="margin:1rem 0 .3rem;">Mga na-file ko</h4><div class="table-responsive"><table data-notools="1"><thead><tr><th>Uri</th><th>Petsa</th><th>Oras</th><th>Dahilan</th><th>Status</th></tr></thead><tbody>${myReqs}</tbody></table></div></div>`;
}
async function attPunch() {
  const me = attMe(), S = attState; const now = attNow(); const date = attISO(now); const id = me.email + '__' + date; const ref = db.collection('attendance_logs').doc(id);
  try {
    let type = ''; let geo = null;
    if (S.prof && S.prof.fieldStaff && navigator.geolocation) { geo = await new Promise(res => { const t = setTimeout(() => res(null), 4000); navigator.geolocation.getCurrentPosition(p => { clearTimeout(t); res({ lat: +p.coords.latitude.toFixed(5), lng: +p.coords.longitude.toFixed(5) }); }, () => { clearTimeout(t); res(null); }, { timeout: 3500 }); }); }
    await db.runTransaction(async tx => {
      const snap = await tx.get(ref); const d = snap.exists ? snap.data() : { email: me.email, name: me.name, date, month: date.slice(0, 7), managerEmail: (S.prof && S.prof.managerEmail) || '', punches: [] };
      const last = d.punches[d.punches.length - 1];
      if (last && now - new Date(last.at) < 10000) throw new Error('Kaka-punch mo lang. Maghintay ng ilang segundo.');
      type = last && last.type === 'in' ? 'out' : 'in'; const pn = { type, at: now.toISOString(), src: S.prof && S.prof.fieldStaff ? 'app' : 'web' }; if (geo) pn.geo = geo; d.punches.push(pn); tx.set(ref, d);
    });
    try { logSystemAction('ATT_PUNCH', `${me.email} time-${type}`); } catch (e) {}
    await loadAttendance();
  } catch (e) { alert(e.message); }
}
function attOpenReq(type, date, sugg, editId) {
  const lab = { OB: 'Official Business (OB)', OT: 'Overtime (OT)', SchedAdj: 'Schedule Adjustment' }[type]; const sc = attSegsFor(date); const log = attState.logs[date]; const ed = editId ? attState.reqs.find(r => r.id === editId) : null;
  let a = ed ? (ed.from || '') : '', b = ed ? (ed.to || '') : '';
  if (!ed && type === 'OT' && log && log.punches.length) { const c = attCompute(date, log, attState.reqs.filter(r => r.date === date), sc, 0); if (c.otEarly >= c.otLate && c.ints.length) { a = attHM(c.ints[0][0]); b = sc.segs[0] ? sc.segs[0].in : ''; } else if (c.ints.length) { a = sc.segs.length ? sc.segs[sc.segs.length - 1].out : ''; b = attHM(c.ints[c.ints.length - 1][1]); } }
  const form = type === 'SchedAdj' ? `<div class="form-group"><label>Bagong schedule (hal. 11:00-20:00@15:00-16:00 = pasok-labas@simula ng break-balik)</label><input type="text" id="ar-segs" value="${srchEsc(ed ? attDayTxt({ segs: ed.segs }) : attDayTxt({ segs: sc.segs }))}"></div>` : `<div style="display:grid;grid-template-columns:1fr 1fr;gap:.6rem;"><div><label>Mula</label><input type="time" id="ar-from" value="${a}"></div><div><label>Hanggang</label><input type="time" id="ar-to" value="${b}"></div></div>${type === 'OT' ? `<div class="form-group"><label>Uri ng OT</label><select id="ar-ottype"><option ${ed && ed.otType === 'Normal OT' ? 'selected' : ''}>Normal OT</option><option ${ed && ed.otType === 'Early OT' ? 'selected' : ''}>Early OT</option></select></div>` : ''}${type === 'OB' ? '<small style="color:#64748b;">Isulat ang buong oras ng OB (hal. 06:00–11:00). Kapag na-approve, papasok ito sa actual time mo at mawawala ang late.</small>' : ''}`;
  arModal(`<h3>📝 ${lab} — ${date}</h3>${ed && ed.note ? `<div style="background:#fff7ed;border:1px solid #fdba74;padding:.4rem;border-radius:.4rem;margin-bottom:.5rem;">↩ Ibinalik ni manager: ${srchEsc(ed.note)}</div>` : ''}${form}<div class="form-group"><label>Dahilan / Destinasyon</label><textarea id="ar-reason" rows="3" style="width:100%;" placeholder="Hal: Pinabili ni manager / meeting sa supplier">${srchEsc(ed ? ed.reason : '')}</textarea></div><div class="form-group"><label>📷 Larawan (optional — hal. OB form na may pirma, hanggang 3)</label><input type="file" id="ar-photo" accept="image/*" multiple></div><button class="btn btn-success" onclick="attSubmitReq('${type}','${date}','${editId || ''}')">📤 ${ed ? 'Ipasa ulit' : 'I-submit'} kay manager</button>`);
}
async function attSubmitReq(type, date, editId) {
  const me = attMe(), S = attState; const reason = (document.getElementById('ar-reason') || {}).value.trim(); if (!reason) { alert('Ilagay ang dahilan.'); return; }
  const doc = { reason, status: 'Pending', note: '' };
  if (type === 'SchedAdj') { const d = attParseDay((document.getElementById('ar-segs') || {}).value); if (!d || !d.segs) { alert('Mali ang format. Hal: 11:00-20:00@15:00-16:00'); return; } doc.segs = d.segs; }
  else { doc.from = (document.getElementById('ar-from') || {}).value; doc.to = (document.getElementById('ar-to') || {}).value; if (!doc.from || !doc.to || attMin(doc.to) <= attMin(doc.from)) { alert('Ilagay ang tamang oras (Hanggang ay dapat mas huli).'); return; } if (type === 'OT') doc.otType = (document.getElementById('ar-ottype') || {}).value; }
  try {
    const files = [...(((document.getElementById('ar-photo') || {}).files) || [])].slice(0, 3); const ids = [];
    for (const f of files) { const id = 'AP-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); await db.collection('attendance_photos').doc(id).set({ dataUrl: await compressImageFile(f, 1000, 0.7), email: me.email, createdAt: new Date().toISOString() }); ids.push(id); }
    if (editId) { const old = S.reqs.find(r => r.id === editId) || {}; if (ids.length || (old.photoIds || []).length) doc.photoIds = (old.photoIds || []).concat(ids); doc.resubmittedAt = new Date().toISOString(); await db.collection('attendance_requests').doc(editId).update(doc); }
    else { if (!(S.prof && S.prof.managerEmail) && !await uiConfirm('Wala kang naka-set na manager. Ipapadala ito sa HR/admin. Ituloy?')) return; await db.collection('attendance_requests').add(Object.assign({ type, date, email: me.email, name: me.name, branch: me.branch, managerEmail: (S.prof && S.prof.managerEmail) || '', createdAt: new Date().toISOString(), photoIds: ids }, doc)); }
    notify([(S.prof && S.prof.managerEmail) || ''].filter(Boolean), `${editId ? 'Ipinasa ulit' : 'Bagong'} ${type} request — ${me.name}`, `${me.name} ay nag-file ng ${type} para sa ${date}. Dahilan: ${reason}`);
    arCloseModal(); alert('✅ Na-submit. Hintayin ang approval.'); loadAttendance();
  } catch (e) { alert('Error: ' + e.message); }
}
async function attPhotoHtml(ids) { const o = []; for (const id of (ids || [])) { try { const d = await db.collection('attendance_photos').doc(id).get(); if (d.exists) o.push(`<img src="${d.data().dataUrl}" style="max-width:100%;margin:.3rem 0;border-radius:.4rem;">`); } catch (e) {} } return o.join(''); }
async function attViewPhotos(id) { const r = attState.teamReqs.find(x => x.id === id) || attState.reqs.find(x => x.id === id); if (!r) return; arModal(`<h3>📷 ${srchEsc(r.type)} — ${srchEsc(r.name || '')} ${srchEsc(r.date)}</h3>` + (await attPhotoHtml(r.photoIds) || 'Walang larawan.')); }
function attRenderTeam() {
  const root = attRoot(), S = attState; const me = attMe(); const pend = S.teamReqs.filter(r => r.status === 'Pending').sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));
  const pr = pend.map(r => `<tr><td>${srchEsc(r.name)}</td><td><b>${srchEsc(r.type)}</b>${r.otType ? ' · ' + srchEsc(r.otType) : ''}</td><td>${srchEsc(r.date)}</td><td>${srchEsc(r.type === 'SchedAdj' ? attDayTxt({ segs: r.segs }) : r.from + '-' + r.to)}</td><td>${srchEsc(r.reason)}</td><td style="white-space:nowrap;">${(r.photoIds || []).length ? `<button class="btn btn-sm btn-secondary" onclick="attViewPhotos('${r.id}')">📷</button> ` : ''}<button class="btn btn-sm btn-success" title="Approve" onclick="attDecide('${r.id}',true)">✅</button> <button class="btn btn-sm btn-warning" title="Ibalik kay employee para ayusin" onclick="attReturn('${r.id}')">↩</button> <button class="btn btn-sm btn-danger" title="Reject" onclick="attDecide('${r.id}',false)">⛔</button></td></tr>`).join('') || '<tr><td colspan="6" style="color:#94a3b8;">Walang naghihintay.</td></tr>';
  const sum = S.team.map(p => { const logs = {}; S.teamLogs.filter(l => l.email === p.email).forEach(l => logs[l.date] = l); const wk = {}; Object.keys(S.teamWeeks).forEach(k => { if (k.startsWith(p.email + '__')) wk[k] = S.teamWeeks[k]; }); const reqs = S.teamReqs.filter(r => r.email === p.email); const rows = attMonthRows(p.email, p, logs, reqs, wk, S.month); return { p, T: attSummary(rows) }; });
  const body = sum.map(({ p, T }) => `<tr><td><b>${srchEsc(p.name || p.email)}</b><br><small>${srchEsc(p.email)}</small></td><td>${T.present}</td><td>${T.absent}</td><td>${T.lateDays} <small>(${attMins(T.late)})</small></td><td>${attMins(T.under)}</td><td>${attMins(T.otPaid)}</td><td>${attMins(T.nsd)}</td></tr>`).join('') || '<tr><td colspan="7" style="color:#94a3b8;">Wala pang team. Itakda ang manager sa 📅 Schedule.</td></tr>';
  root.innerHTML = `<div class="card"><div class="card-title"><span>👥 Team & Approvals</span><button class="btn btn-secondary btn-sm" onclick="loadAttendance()">🔄</button></div>${attTabs()}
    <h4>⏳ Naghihintay ng approval (${pend.length})</h4><div class="table-responsive"><table data-notools="1"><thead><tr><th>Empleyado</th><th>Uri</th><th>Petsa</th><th>Oras</th><th>Dahilan</th><th></th></tr></thead><tbody>${pr}</tbody></table></div>
    <div style="display:flex;gap:.5rem;align-items:center;margin:1rem 0 .4rem;"><h4 style="margin:0;">Buod ng team</h4><input type="month" value="${S.month}" onchange="attState.month=this.value;attRender()"><button class="btn btn-secondary btn-sm" onclick="attExportTeamCSV()">📤 CSV (payroll)</button></div>
    <div class="table-responsive"><table data-notools="1"><thead><tr><th>Empleyado</th><th>Present</th><th>Absent</th><th>Late</th><th>Undertime</th><th>OT (approved)</th><th>Night Diff</th></tr></thead><tbody>${body}</tbody></table></div></div>`;
}
async function attReturn(id) {
  const r = attState.teamReqs.find(x => x.id === id); if (!r) return; const me = attMe();
  if (me.role !== 'admin' && r.managerEmail !== me.email) { alert('Hindi mo ito empleyado/team.'); return; }
  const note = await uiPrompt('Ano ang dapat ayusin? (hal. mali ang oras / mali ang petsa)'); if (!note) return;
  try { await db.collection('attendance_requests').doc(id).update({ status: 'Returned', decidedBy: me.name, decidedAt: new Date().toISOString(), note }); notify([r.email], `Ibinalik ang ${r.type} request mo (${r.date})`, `${me.name}: ${note}. Buksan ang Attendance para i-edit at ipasa ulit.`); await loadAttendance(); attState.tab = 'team'; attRender(); } catch (e) { alert('Error: ' + e.message); }
}
async function attDecide(id, ok) {
  const r = attState.teamReqs.find(x => x.id === id); if (!r) return; const me = attMe();
  if (me.role !== 'admin' && r.managerEmail !== me.email) { alert('Hindi mo ito empleyado/team.'); return; }
  let note = ''; if (!ok) { note = await uiPrompt('Dahilan ng pag-reject:'); if (!note) return; } else note = await uiPrompt('Komento (optional):') || '';
  try { await db.collection('attendance_requests').doc(id).update({ status: ok ? 'Approved' : 'Rejected', decidedBy: me.name, decidedAt: new Date().toISOString(), note }); notify([r.email], `${r.type} request mo (${r.date}): ${ok ? 'APPROVED' : 'REJECTED'}`, `${me.name} ay ${ok ? 'nag-approve' : 'nag-reject'} ng ${r.type} request mo para sa ${r.date}.${note ? ' Komento: ' + note : ''}`); try { logSystemAction('ATT_REQ_DECISION', `${r.email} ${r.type} ${r.date}: ${ok ? 'approved' : 'rejected'}`); } catch (e) {} await loadAttendance(); attState.tab = 'team'; attRender(); } catch (e) { alert('Error: ' + e.message); }
}
function attTeamSummaryRows() {
  const S = attState; return S.team.map(p => { const logs = {}; S.teamLogs.filter(l => l.email === p.email).forEach(l => logs[l.date] = l); const wk = {}; Object.keys(S.teamWeeks).forEach(k => { if (k.startsWith(p.email + '__')) wk[k] = S.teamWeeks[k]; }); const rows = attMonthRows(p.email, p, logs, S.teamReqs.filter(r => r.email === p.email), wk, S.month); return { p, T: attSummary(rows), rows }; });
}
function attExportTeamCSV() {
  const L = [['Email', 'Name', 'Month', 'Days_Present', 'Days_Absent', 'Late_Days', 'Late_Minutes', 'Undertime_Minutes', 'OT_Approved_Minutes', 'Night_Diff_Minutes'].join(',')];
  attTeamSummaryRows().forEach(({ p, T }) => L.push([csvCell(p.email), csvCell(p.name), attState.month, T.present, T.absent, T.lateDays, T.late, T.under, T.otPaid, T.nsd].join(',')));
  downloadCSVFile(L.join('\r\n'), 'Attendance_' + attState.month + '.csv');
}
// ---- Schedule editor (weekly) + bulk upload ----
function attRenderSched() {
  const root = attRoot(), S = attState, me = attMe(); const isDef = S.week === 'default';
  const rows = S.team.map((p, i) => { const wk = (S.teamWeeks[p.email + '__' + S.week] || {}).week || []; const def = p.defaultWeek || []; const days = isDef ? def : ATT_DAYS.map((d, k) => wk[k] || def[k]); const tot = days.reduce((n, d) => n + attDayMin(d), 0);
    return `<tr><td style="min-width:170px;"><b>${srchEsc(p.name || p.email)}</b><br><small>${srchEsc(p.email)}</small><br><input type="text" id="as-eid-${i}" value="${srchEsc(p.employeeId || '')}" placeholder="Employee ID" style="width:90px;font-size:.75rem;"> <input type="text" id="as-card-${i}" value="${srchEsc(p.cardNo || '')}" placeholder="RFID card #" style="width:90px;font-size:.75rem;">
      <br><label style="font-size:.72rem;" title="Buyer / field staff: puwedeng mag-tap sa app (walang biometrics)"><input type="checkbox" id="as-field-${i}" ${p.fieldStaff ? 'checked' : ''}> 📱 Field/Buyer</label>${me.role === 'admin' ? `<br><input type="email" id="as-mgr-${i}" value="${srchEsc(p.managerEmail || '')}" placeholder="manager email" style="width:170px;font-size:.75rem;">` : ''}</td>${ATT_DAYS.map((d, k) => `<td><input type="text" list="att-presets" id="as-${i}-${k}" value="${srchEsc(attDayTxt(isDef ? def[k] : wk[k]))}" placeholder="${srchEsc(isDef ? '' : attDayTxt(def[k]) || '—')}" style="width:150px;font-size:.78rem;"><div style="font-size:.7rem;color:#64748b;">${attDayDesc(isDef ? def[k] : (wk[k] || def[k])).split(' · ').slice(1).join(' · ')}</div></td>`).join('')}<td style="text-align:right;"><b>${attHrs(tot)}</b><br><small>/ linggo</small></td></tr>`; }).join('') || '<tr><td colspan="9" style="color:#94a3b8;">Wala pang empleyado sa team mo.</td></tr>';
  const presetOpts = Object.keys(attPresets).map(k => `<option value="${srchEsc(k)}">`).join('');
  root.innerHTML = `<div class="card"><div class="card-title"><span>📅 Schedule ng Team</span></div>${attTabs()}
    <p style="font-size:.85rem;color:#64748b;">Format ng bawat araw: <b>08:00-17:00@12:00-13:00</b> (pasok-labas@simula ng break-balik) · <b>10:00-12:00/15:00-19:00</b> (split shift) · <b>OFF</b> · o pangalan ng <b>Shift Preset</b>. Blangko = default. Ipinapakita sa gilid ang break at oras na bibilangin.</p>
    <datalist id="att-presets">${presetOpts}</datalist>
    <div style="display:flex;gap:.4rem;flex-wrap:wrap;align-items:end;margin-bottom:.6rem;"><div><label style="font-weight:700;">Linggo (Lunes)</label><br><input type="date" value="${isDef ? '' : S.week}" onchange="attState.week=attMonday(this.value);attRender()"></div>
      <button class="btn btn-sm ${isDef ? 'btn-primary' : 'btn-secondary'}" onclick="attState.week='${isDef ? attMonday(attISO(attNow())) : 'default'}';attRender()">${isDef ? '◀ Weekly' : '⚙️ Default na schedule'}</button>
      <button class="btn btn-secondary btn-sm" onclick="attSchedTemplate()">📄 Template</button><button class="btn btn-secondary btn-sm" onclick="attSchedImport()">📥 Bulk upload schedule</button>
      ${me.role === 'admin' ? '<button class="btn btn-secondary btn-sm" onclick="attPresetEdit()">⏱️ Shift Presets</button><button class="btn btn-secondary btn-sm" onclick="attImportPunches()">🪪 I-import ang punch logs (device)</button><button class="btn btn-secondary btn-sm" onclick="attSyncEmployees()">🔄 Kunin ang mga empleyado (HR)</button>' : ''}<button class="btn btn-success" onclick="attSchedSave()">💾 I-save</button></div>
    <div class="table-responsive"><table data-notools="1"><thead><tr><th>Empleyado</th>${ATT_DAYS.map(d => `<th>${d}</th>`).join('')}<th>Oras</th></tr></thead><tbody>${rows}</tbody></table></div><small style="color:#64748b;">${isDef ? 'Default na schedule (Lunes–Linggo) na susundin kung walang weekly na schedule.' : 'Weekly schedule para sa linggong nagsisimula ' + S.week}</small></div>`;
}
async function attSchedSave() {
  const S = attState, me = attMe(); const isDef = S.week === 'default'; const batch = db.batch(); const now = new Date().toISOString(); const badCells = [];
  S.team.forEach((p, i) => {
    const week = ATT_DAYS.map((d, k) => { const v = (document.getElementById(`as-${i}-${k}`) || {}).value; const x = attParseDay(v); if (v && v.trim() && !x) badCells.push(`${p.name || p.email} ${d}: "${v}"`); return x; });
    const mg = document.getElementById('as-mgr-' + i); const mgr = mg ? mg.value.trim().toLowerCase() : (p.managerEmail || '');
    const fcb = document.getElementById('as-field-' + i); const field = fcb ? !!fcb.checked : !!p.fieldStaff;
    const eid = ((document.getElementById('as-eid-' + i) || {}).value || '').trim(), card = ((document.getElementById('as-card-' + i) || {}).value || '').trim();
    if (isDef || mgr !== (p.managerEmail || '') || field !== !!p.fieldStaff || eid !== (p.employeeId || '') || card !== (p.cardNo || '')) batch.set(db.collection('attendance_profiles').doc(p.email), Object.assign({}, p, { managerEmail: mgr, fieldStaff: field, employeeId: eid, cardNo: card, defaultWeek: isDef ? week : (p.defaultWeek || []), updatedBy: me.email }), { merge: true });
    if (!isDef && week.some(x => x)) batch.set(db.collection('attendance_weeks').doc(p.email + '__' + S.week), { email: p.email, week, weekStart: S.week, managerEmail: mgr, setBy: me.email, updatedAt: now });
    else if (!isDef) batch.delete(db.collection('attendance_weeks').doc(p.email + '__' + S.week));
  });
  if (badCells.length) { alert('May mali sa format, hindi pa na-save:\n' + badCells.slice(0, 8).join('\n')); return; }
  try { await batch.commit(); alert('✅ Na-save ang schedule.'); await loadAttendance(); attState.tab = 'sched'; attRender(); } catch (e) { alert('Error: ' + e.message); }
}
async function attPresetEdit() {
  const cur = Object.keys(attPresets).map(k => `${k} = ${attPresets[k]}`).join('\n');
  arModal(`<h3>⏱️ Shift Presets</h3><p style="font-size:.85rem;color:#64748b;">Isang linya bawat shift: <b>pangalan = pasok-labas@simula ng break-balik</b>. Hal:<br>HO 8-5 = 08:00-17:00@12:00-13:00<br>Branch Split = 10:00-12:00/15:00-19:00<br>Maaari mo itong gamitin sa grid at bulk upload sa halip na isulat ang oras.</p><textarea id="att-pre-ta" rows="8" style="width:100%;">${srchEsc(cur)}</textarea><button class="btn btn-success" onclick="attPresetSave()">💾 I-save</button>`);
}
async function attPresetSave() {
  const text = (document.getElementById('att-pre-ta') || {}).value || ''; const bad = text.split(/\r?\n/).filter(l => l.trim()).filter(l => { const m = /^\s*([^=]+?)\s*=\s*(.+?)\s*$/.exec(l); return !m || !attParseDay(m[2], 1); });
  if (bad.length) { alert('Mali ang format ng:\n' + bad.slice(0, 5).join('\n')); return; }
  try { await db.collection('system_settings').doc('attendance_presets').set({ text }); arCloseModal(); await loadAttendance(); attState.tab = 'sched'; attRender(); } catch (e) { alert('Error: ' + e.message); }
}
function attSchedTemplate() {
  const t = ['#GABAY: isang row bawat empleyado. Employee_ID (o Email) ang pagkakakilanlan. Time_In, Break_Start, Break_End, Time_Out = shift na ilalapat sa lahat ng araw MALIBAN sa Rest_Day (hal. Sun o Sat,Sun). Kung walang break, iwanang blangko ang Break.', '#Opsyonal: Mon..Sun = oras ng partikular na araw (OFF / 08:00-17:00@12:00-13:00 / pangalan ng preset) na papalit sa shift ng row. Week_Start = Lunes ng linggo (YYYY-MM-DD); blangko = ang napiling linggo sa screen. Burahin ang mga linyang nagsisimula sa #.', 'Employee_ID,Email,Week_Start,Time_In,Break_Start,Break_End,Time_Out,Rest_Day,Mon,Tue,Wed,Thu,Fri,Sat,Sun'];
  attState.team.forEach(p => t.push([csvCell(p.employeeId || ''), csvCell(p.email), attState.week === 'default' ? '' : attState.week, '08:00', '12:00', '13:00', '17:00', 'Sun', '', '', '', '', '', '', ''].join(',')));
  downloadCSVFile(t.join('\r\n') + '\r\n', 'Schedule_Template.csv');
}
function attRowWeek(r) {
  const DK = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']; let base = null;
  if (r.time_in && r.time_out) base = attParseDay(`${r.time_in}-${r.time_out}${r.break_start && r.break_end ? '@' + r.break_start + '-' + r.break_end : ''}`);
  const rest = String(r.rest_day || '').toLowerCase().split(/[,/ ]+/).filter(Boolean).map(x => x.slice(0, 3));
  return DK.map(k => { const v = String(r[k] || '').trim(); if (v) { const x = attParseDay(v); return x || undefined; } if (rest.includes(k)) return { off: true }; return base; });
}
async function attSchedImport() {
  const text0 = await pickCSVFile(); if (!text0) return; const text = text0.split(/\r?\n/).filter(l => !/^\s*"?#/.test(l)).join('\n'); const objs = csvToObjects(text); const S = attState, me = attMe();
  const byEmail = {}, byEid = {}; S.team.forEach(p => { byEmail[p.email] = p; if (p.employeeId) byEid[String(p.employeeId).toLowerCase()] = p; });
  let n = 0; const bad = []; const batch = db.batch();
  objs.forEach((r, i) => {
    const p = byEid[String(r.employee_id || '').trim().toLowerCase()] || byEmail[String(r.email || '').trim().toLowerCase()]; if (!p) { bad.push(`Row ${i + 1}: ${r.employee_id || r.email || '(walang ID)'} — hindi mo team / walang profile`); return; }
    const week = attRowWeek(r); if (week.includes(undefined)) { bad.push(`Row ${i + 1}: ${p.email} — mali ang oras sa isang araw`); return; } if (!week.some(x => x)) { bad.push(`Row ${i + 1}: ${p.email} — walang schedule`); return; }
    const ws = r.week_start ? attMonday(String(r.week_start).trim()) : (S.week === 'default' ? 'default' : S.week);
    if (ws === 'default') batch.set(db.collection('attendance_profiles').doc(p.email), Object.assign({}, p, { defaultWeek: week }), { merge: true });
    else batch.set(db.collection('attendance_weeks').doc(p.email + '__' + ws), { email: p.email, week, weekStart: ws, managerEmail: p.managerEmail || '', setBy: me.email, updatedAt: new Date().toISOString() });
    n++;
  });
  try { await batch.commit(); alert(`✅ Na-upload ang ${n} schedule.${bad.length ? '\n\nHindi isinama:\n' + bad.slice(0, 15).join('\n') : ''}`); await loadAttendance(); attState.tab = 'sched'; attRender(); } catch (e) { alert('Error: ' + e.message); }
}
// Punch logs mula sa terminal (RFID + fingerprint): CSV na may Employee_ID (o Card_No / Email) at DateTime
async function attImportPunches() {
  const text0 = await pickCSVFile(); if (!text0) return; const objs = csvToObjects(text0.split(/\r?\n/).filter(l => !/^\s*"?#/.test(l)).join('\n')); const S = attState;
  const by = {}; S.team.forEach(p => { [p.employeeId, p.cardNo, p.email].forEach(k => { if (k) by[String(k).toLowerCase()] = p; }); });
  const groups = {}, bad = [];
  objs.forEach((r, i) => { const key = String(r.employee_id || r.card_no || r.user_id || r.email || '').trim().toLowerCase(); const p = by[key]; const dt = new Date(String(r.datetime || r.date_time || r.timestamp || '').replace(/(\d{4}-\d\d-\d\d)\s+/, '$1T')); if (!p || isNaN(dt)) { bad.push(`Row ${i + 2}: ${key || '?'}`); return; } const iso = attISO(dt); (groups[p.email + '__' + iso] = groups[p.email + '__' + iso] || { p, iso, at: [] }).at.push(dt); });
  let n = 0; const batch = db.batch();
  for (const id of Object.keys(groups)) { const g = groups[id]; const ex = await db.collection('attendance_logs').doc(id).get(); const old = ex.exists ? ex.data().punches || [] : []; const all = old.map(p => ({ at: p.at, src: p.src || 'device' })).concat(g.at.map(d => ({ at: d.toISOString(), src: 'device' })));
    const seen = new Set(); const uniq = all.sort((a, b) => String(a.at).localeCompare(String(b.at))).filter(p => { const k = String(p.at).slice(0, 16); if (seen.has(k)) return false; seen.add(k); return true; }).map((p, i) => Object.assign(p, { type: i % 2 ? 'out' : 'in' }));
    batch.set(db.collection('attendance_logs').doc(id), { email: g.p.email, name: g.p.name || g.p.email, date: g.iso, month: g.iso.slice(0, 7), managerEmail: g.p.managerEmail || '', punches: uniq }, { merge: true }); n++; }
  try { await batch.commit(); alert(`✅ ${n} araw ng punch ang na-import.${bad.length ? '\n\nHindi nahanap:\n' + bad.slice(0, 12).join('\n') : ''}`); await loadAttendance(); } catch (e) { alert('Error: ' + e.message); }
}
async function attSyncEmployees() {
  const snap = await db.collection('employees').get(); const batch = db.batch(); let n = 0;
  snap.forEach(d => { const e = d.data(); const em = String(e.email || '').trim().toLowerCase(); if (!em || (e.status && e.status !== 'Active')) return; const old = attState.team.find(p => p.email === em) || {}; batch.set(db.collection('attendance_profiles').doc(em), { email: em, name: e.name || em, branch: e.dept || '', employeeId: old.employeeId || e.empId || d.id, managerEmail: old.managerEmail || '', graceMin: 0 }, { merge: true }); n++; });
  await batch.commit(); alert(`✅ ${n} empleyado ang nai-sync (may email lang). Itakda ang manager at RFID card # sa bawat row.`); await loadAttendance(); attState.tab = 'sched'; attRender();
}

// ---- SAP B1 Item Master parser (galing sa PDF/text o CSV) ----
const SAP_HEADERS = ['Item No.', 'Item Description', 'In Stock', 'Purchasing UoM', 'Item Group', 'Active', 'No. of Items per Purchase Unit', 'No. of Items per Sales Unit', 'Last Purchase Price', 'Last Purchase Date', 'Inventory UoM', 'Date of Update'];
function sapNum(s) { const n = parseFloat(String(s == null ? '' : s).replace(/,/g, '')); return isNaN(n) ? 0 : n; }
function sapIsDate(t) { return /^\d{1,2}[./]\d{1,2}[./]\d{2,4}$/.test(t || ''); }
function sapDateISO(t) {
  const m = /^(\d{1,2})[./](\d{1,2})[./](\d{2,4})$/.exec(String(t || '').trim()); if (!m) return '';
  let y = +m[3]; if (y < 100) y += 2000; if (y < 1990) return ''; // 12/30/1899 = blangko ng SAP
  return `${y}-${String(m[1]).padStart(2, '0')}-${String(m[2]).padStart(2, '0')}`;
}
function sapFixGroup(g) { g = String(g || '').trim().replace(/\s+/g, ' '); return g === 'S-CLEANING SUPPLIE' ? 'S-CLEANING SUPPLIES' : g; }
// Whole:Loose — "No. of Items per Purchase Unit" ang laman ng 1 whole (hal. 1 CSE = 24 pcs). Kung 1:1 sa SAP pero may (24/CSE) sa pangalan, mungkahi lang ito.
function sapEnrich(r) {
  const same = (a, b) => a && b && String(a).trim().toUpperCase()[0] === String(b).trim().toUpperCase()[0];
  r.conv = r.perPurchase > 1 ? r.perPurchase : 1; r.convSrc = r.perPurchase > 1 ? 'SAP' : 'default'; r.convSuggest = 0;
  if (r.perPurchase <= 1 && !/^(PC|PCS|PIECE|PIECES)$/i.test(r.purchUom || '')) {
    const m = /\((\d{1,3})\s*(?:PCS?|PIECES?)?\s*\/\s*(CASE|CSE|BOX|BX|CTN|CARTON|TRAY|PACK|PCK|SACK|SK|BAG|BTL|DOZEN)\b/i.exec(r.itemName || '');
    if (m && +m[1] > 1 && same(m[2], r.purchUom)) { r.convSuggest = +m[1]; r.conv = +m[1]; r.convSrc = 'description'; }
  }
  r.wholeUOM = r.purchUom || r.invUom || 'PC';
  r.looseUOM = r.conv > 1 ? ((r.invUom && r.invUom.toUpperCase() !== String(r.purchUom).toUpperCase()) ? r.invUom : 'PC') : (r.invUom || r.purchUom || 'PC');
  return r;
}
function sapParseText(raw) {
  let t = String(raw || '').replace(/\r/g, ' ').replace(/\n/g, ' ');
  t = t.replace(/Item No\.\s*Item Description\s*In Stock\s*Purchasing UoM\s*Item Group\s*Active\s*No\. of Items per Purchase Unit\s*No\. of Items per Sales Unit\s*Last Purchase Price\s*Last Purchase Date\s*Inventory UoM\s*Date of Update/gi, ' ').replace(/\b12\/30\/1899\b/g, ' ').replace(/\s+/g, ' ');
  const starts = []; const re = /(?:^|\s)([A-Z]{2}\d{6})(?=\s)/g; let m;
  while ((m = re.exec(t))) starts.push({ code: m[1], at: m.index + m[0].length - m[1].length });
  const rows = [], bad = [], seen = {};
  starts.forEach((s, i) => {
    const seg = t.slice(s.at, i + 1 < starts.length ? starts[i + 1].at : t.length).trim();
    const body = seg.slice(s.code.length).trim();
    const a = /^(.*?)\s*(Yes|No)\s+([\d.]+)\s+([\d.]+)\s+(-?[\d,]*\.?\d+)(.*)$/.exec(body);
    if (!a) { bad.push(seg.slice(0, 80)); return; }
    const pre = a[1], tail = a[6].trim().split(/\s+/).filter(Boolean);
    const b = /^(.*?)(?:\s|(?<=[)\w]))(-?[\d,]*\.?\d+)(?:\s+(\S+))?\s+((?:[A-Z]\s?-\s?[A-Za-z0-9\/&. ]*?|Items)\s*)$/.exec(pre + ' ');
    if (!b) { bad.push(seg.slice(0, 80)); return; }
    let purchDate = '', upd = '', invUom = '';
    if (tail.length && sapIsDate(tail[0])) purchDate = tail.shift();
    if (tail.length && sapIsDate(tail[tail.length - 1])) upd = tail.pop();
    invUom = tail.join(' '); if (/^manual$/i.test(invUom)) invUom = '';
    const r = { itemCode: s.code, itemName: b[1].trim(), inStock: sapNum(b[2]), purchUom: b[3] || '', itemGroup: sapFixGroup(b[4]), active: a[2] === 'Yes', perPurchase: sapNum(a[3]), perSales: sapNum(a[4]), lastPrice: sapNum(a[5]), lastPurchaseDate: sapDateISO(purchDate), invUom, updateDate: sapDateISO(upd) };
    const stamp = x => (x.lastPurchaseDate > x.updateDate ? x.lastPurchaseDate : x.updateDate) || '';
    if (seen[s.code] != null) { const old = rows[seen[s.code]]; if (stamp(r) >= stamp(old)) rows[seen[s.code]] = r; return; } // pinakabagong petsa ang panalo
    seen[s.code] = rows.length; rows.push(r);
  });
  rows.forEach(sapEnrich);
  return { rows, bad };
}

// ---- SAP Item Master (kada company): import PDF/TXT/CSV, export sa SAP format ----
// sap_items/{companySlug}__{ItemNo}
let sapState = { company: '', companies: [], items: [], q: '', group: '', preview: null };
function sapRoot() { return document.getElementById('sap-root'); }
async function loadSapItems() {
  const root = sapRoot(); if (!root || !db) return;
  try {
    if (!sapState.companies.length) { const c = await db.collection('companies').get(); c.forEach(d => sapState.companies.push(d.data().name || d.id)); sapState.companies.sort(); }
    if (!sapState.company) sapState.company = sapState.companies[0] || '';
    sapState.items = [];
    if (sapState.company) { const s = await db.collection('sap_items').where('company', '==', sapState.company).get(); s.forEach(d => sapState.items.push({ id: d.id, ...d.data() })); sapState.items.sort((a, b) => String(a.itemCode).localeCompare(String(b.itemCode))); }
    sapRender();
  } catch (e) { root.innerHTML = `<div class="card" style="color:#dc2626;">Error: ${srchEsc(e.message)}</div>`; }
}
function sapFiltered() { const S = sapState; return S.items.filter(i => (!S.group || i.itemGroup === S.group) && (!S.q || smartMatch(S.q, i.itemName, i.itemCode, i.itemGroup))); }
function sapRender() {
  const S = sapState, root = sapRoot(); const list = sapFiltered(); const groups = [...new Set(S.items.map(i => i.itemGroup).filter(Boolean))].sort();
  const val = S.items.reduce((s, i) => s + (i.inStock || 0) * (i.lastPrice || 0) / (i.perPurchase || 1), 0);
  root.innerHTML = `<div class="card"><div class="card-title"><span>📒 SAP Item Master (kada Company)</span></div>
    ${S.companies.length ? '' : '<p style="color:#b45309;">Wala pang company. Gumawa muna sa 🏢 Company Management.</p>'}
    <div style="display:flex;gap:.4rem;flex-wrap:wrap;align-items:end;margin-bottom:.6rem;">
      <div><label style="font-weight:700;">Company</label><br><select onchange="sapState.company=this.value;sapState.q='';sapState.group='';loadSapItems()">${S.companies.map(c => `<option ${c === S.company ? 'selected' : ''}>${srchEsc(c)}</option>`).join('')}</select></div>
      <button class="btn btn-success" onclick="sapPickFile()">📥 Import SAP (PDF / TXT / CSV)</button>
      <button class="btn btn-secondary" onclick="sapExportCSV()">📤 Export (SAP format)</button>
      <button class="btn btn-secondary" onclick="sapTemplate()">📄 Template</button>
      <button class="btn btn-secondary" onclick="sapCopyToCompany()">📋 Kopyahin sa ibang company</button>
      <button class="btn btn-primary" onclick="sapSyncProducts()">🔄 I-sync sa Products (UOM + Whole:Loose)</button></div>
    <small style="color:#64748b;">Mga column (parehong ayos ng SAP B1): ${SAP_HEADERS.join(' · ')}. Kapag may kaparehong Item No. sa company, ina-update; hindi nade-delete ang wala sa file.</small>
    <div style="display:flex;gap:.4rem;flex-wrap:wrap;margin:.6rem 0;"><input type="search" placeholder="🔍 Hanapin (code / pangalan)" value="${srchEsc(S.q)}" oninput="sapState.q=this.value;sapRenderTable()" style="min-width:220px;">
      <select onchange="sapState.group=this.value;sapRenderTable()"><option value="">Lahat ng Item Group</option>${groups.map(g => `<option ${g === S.group ? 'selected' : ''}>${srchEsc(g)}</option>`).join('')}</select></div>
    <div id="sap-sum" style="margin-bottom:.4rem;font-size:.9rem;"></div><div class="table-responsive" id="sap-tbl"></div></div>`;
  sapRenderTable(val);
}
function sapRenderTable(val) {
  const S = sapState; const list = sapFiltered(); const sum = document.getElementById('sap-sum'); if (!sum) return;
  if (val == null) val = S.items.reduce((s, i) => s + (i.inStock || 0) * (i.lastPrice || 0) / (i.perPurchase || 1), 0);
  sum.innerHTML = `<b>${list.length}</b> / ${S.items.length} item · Active: ${S.items.filter(i => i.active).length} · Tantiyang halaga (In Stock × Last Price): <b>${money(val)}</b>${S.items[0] && S.items[0].asOf ? ' · SAP as of ' + srchEsc(S.items[0].asOf) : ''}`;
  document.getElementById('sap-tbl').innerHTML = `<table data-notools="1"><thead><tr><th>Item No.</th><th>Item Description</th><th>In Stock</th><th>Purch. UoM</th><th>Item Group</th><th>Active</th><th>Whole:Loose</th><th>Last Price</th><th>Last Purch. Date</th><th>Inv. UoM</th><th>Updated</th></tr></thead><tbody>${list.slice(0, 400).map(i => `<tr><td>${srchEsc(i.itemCode)}</td><td>${srchEsc(i.itemName)}</td><td style="text-align:right;">${(+i.inStock || 0).toLocaleString()}</td><td>${srchEsc(i.purchUom)}</td><td>${srchEsc(i.itemGroup)}</td><td>${i.active ? 'Yes' : '<span style="color:#dc2626;">No</span>'}</td><td>1:${i.conv || 1}${i.convSrc === 'description' ? ' <span title="Hinango sa pangalan, hindi sa SAP — i-check" style="color:#7c3aed;">💡</span>' : ''}</td><td style="text-align:right;">${money(i.lastPrice)}</td><td>${srchEsc(i.lastPurchaseDate || '')}</td><td>${srchEsc(i.invUom)}</td><td>${srchEsc(i.updateDate || '')}</td></tr>`).join('') || '<tr><td colspan="11" style="text-align:center;color:#94a3b8;">Wala pang item. I-import ang SAP extract.</td></tr>'}</tbody></table>${list.length > 400 ? `<small>Ipinapakita ang unang 400. Gamitin ang search o i-export para sa lahat.</small>` : ''}`;
}
function sapCsvRows(rows) {
  const L = [SAP_HEADERS.join(',')];
  rows.forEach(i => L.push([i.itemCode, i.itemName, i.inStock, i.purchUom, i.itemGroup, i.active ? 'Yes' : 'No', i.perPurchase, i.perSales, i.lastPrice, sapDateOut(i.lastPurchaseDate), i.invUom, sapDateOut(i.updateDate)].map(csvCell).join(',')));
  return L.join('\r\n');
}
function sapDateOut(iso) { const m = /^(\d{4})-(\d\d)-(\d\d)$/.exec(iso || ''); return m ? `${m[2]}.${m[3]}.${m[1]}` : ''; }
function sapExportCSV() { if (!sapState.items.length) { alert('Walang item na i-e-export.'); return; } downloadCSVFile(sapCsvRows(sapFiltered()), `SAP_Items_${invSlug(sapState.company)}.csv`); }
function sapTemplate() { downloadCSVFile(SAP_HEADERS.join(',') + '\r\nPC131007,YAKINIKUDON SAUCE,248,PACK,R-PRODUCTION,Yes,1,1,892.86,06.25.2026,PACK,07.04.2021\r\n', 'SAP_Items_Template.csv'); }
function sapParseCSVText(text) {
  const norm = h => String(h || '').toLowerCase().replace(/[^a-z]/g, '');
  const objs = csvToObjects(text.split(/\r?\n/).filter(l => !/^\s*"?#/.test(l)).join('\n')); // csvToObjects ginagawang lowercase/underscore ang header
  const key = o => { const m = {}; Object.keys(o).forEach(k => m[norm(k)] = o[k]); return m; };
  const rows = [], bad = [];
  objs.forEach((o, i) => { const m = key(o); const code = String(m.itemno || '').trim(); if (!code) { bad.push('Row ' + (i + 2) + ': walang Item No.'); return; }
    rows.push({ company: String(m.company || '').trim(), itemCode: code, itemName: String(m.itemdescription || '').trim(), inStock: sapNum(m.instock), purchUom: m.purchasinguom || '', itemGroup: sapFixGroup(m.itemgroup), active: !/^(no|n|false|0)$/i.test(String(m.active || 'Yes').trim()), perPurchase: sapNum(m.noofitemsperpurchaseunit) || 1, perSales: sapNum(m.noofitemspersalesunit) || 1, lastPrice: sapNum(m.lastpurchaseprice), lastPurchaseDate: sapDateISO(m.lastpurchasedate), invUom: m.inventoryuom || '', updateDate: sapDateISO(m.dateofupdate) }); });
  rows.forEach(sapEnrich);
  return { rows, bad };
}
async function sapPdfToText(file) {
  if (!window.pdfjsLib) await new Promise((res, rej) => { const s = document.createElement('script'); s.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js'; s.onload = res; s.onerror = () => rej(new Error('Hindi ma-load ang PDF reader (kailangan ng internet).')); document.head.appendChild(s); });
  pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  const pdf = await pdfjsLib.getDocument({ data: await file.arrayBuffer() }).promise; let out = '';
  for (let p = 1; p <= pdf.numPages; p++) { const c = await (await pdf.getPage(p)).getTextContent(); let line = '', y = null; c.items.forEach(it => { const yy = Math.round(it.transform[5]); if (y !== null && Math.abs(yy - y) > 2) { out += line.trim() + '\n'; line = ''; } y = yy; line += it.str + ' '; }); out += line.trim() + '\n'; }
  return out;
}
function sapPickFile() {
  if (!sapState.company) { alert('Pumili muna ng Company.'); return; }
  const f = document.createElement('input'); f.type = 'file'; f.accept = '.pdf,.txt,.csv,text/plain,text/csv,application/pdf';
  f.onchange = async () => { if (!f.files.length) return; await sapHandleFile(f.files[0]); }; f.click();
}
async function sapHandleFile(file) {
  try {
    let parsed;
    if (/\.pdf$/i.test(file.name)) parsed = sapParseText(await sapPdfToText(file));
    else { const txt = await file.text(); parsed = /^\s*"?(Company"?\s*,\s*"?)?Item No\.?"?\s*,/i.test(txt.split(/\r?\n/).find(l => l.trim() && !l.trim().startsWith('#')) || '') ? sapParseCSVText(txt) : sapParseText(txt); }
    if (!parsed.rows.length) { alert('Walang nabasang item. Siguraduhing SAP Item Master ang file (Item No., Item Description, In Stock...).'); return; }
    const have = new Set(sapState.items.map(i => i.itemCode)); const nw = parsed.rows.filter(r => !have.has(r.itemCode)).length;
    sapState.preview = { rows: parsed.rows, bad: parsed.bad, file: file.name };
    arModal(`<h3>📥 Preview — ${srchEsc(sapState.company)}</h3><p><b>${parsed.rows.length}</b> item ang nabasa mula sa <i>${srchEsc(file.name)}</i><br>🆕 Bago: <b>${nw}</b> · ♻️ Ia-update: <b>${parsed.rows.length - nw}</b> · ⚠️ Hindi nabasa: <b>${parsed.bad.length}</b> (ibang layout)<br>📦 May Whole:Loose (galing SAP): <b>${parsed.rows.filter(r => r.convSrc === 'SAP').length}</b> · 💡 Mungkahi mula sa pangalan: <b>${parsed.rows.filter(r => r.convSrc === 'description').length}</b></p>
      <div style="max-height:180px;overflow:auto;font-size:.8rem;border:1px solid #e2e8f0;border-radius:.4rem;padding:.4rem;">${parsed.rows.slice(0, 8).map(r => `${srchEsc(r.itemCode)} · ${srchEsc(r.itemName)} · ${r.inStock} ${srchEsc(r.purchUom)} · ${srchEsc(r.itemGroup)} · ${money(r.lastPrice)}`).join('<br>')}</div>
      <div class="form-group" style="margin-top:.6rem;"><label>SAP as of (petsa ng extract)</label><input type="date" id="sap-asof" value="${attISO(new Date())}"></div>
      <button class="btn btn-success" onclick="sapConfirmImport()">✅ I-import sa ${srchEsc(sapState.company)}</button>`);
  } catch (e) { alert('Error: ' + e.message); }
}
async function sapSyncProducts() {
  const S = sapState; if (!S.items.length) { alert('Mag-import muna ng SAP items.'); return; }
  try {
    const ps = await db.collection('products').get(); const by = {}; ps.forEach(d => { const p = d.data(); [d.id, p.sapCode, p.itemCode].forEach(k => { if (k) by[hubKey(k)] = { id: d.id, ...p }; }); });
    const act = S.items.filter(i => i.active); const ex = act.filter(i => by[hubKey(i.itemCode)]), nw = act.filter(i => !by[hubKey(i.itemCode)]);
    const chg = ex.filter(i => { const p = by[hubKey(i.itemCode)]; return String(p.wholeUOM || '') !== i.wholeUOM || String(p.looseUOM || '') !== i.looseUOM || (+p.conversionFactor || 1) !== (i.conv || 1); });
    if (!await uiConfirm(`I-sync ang ${S.company}?\n\n• May produkto na: ${ex.length} (${chg.length} ang magbabago ng UOM / Whole:Loose)\n• Bagong produkto: ${nw.length} (presyo 0, walang station — i-set mo pagkatapos)\n\nHindi ginagalaw ang presyo, stock, at station ng existing. Ia-add lang ang company tag.`)) return;
    let batch = db.batch(), n = 0; const co = S.company;
    for (const i of ex) { const p = by[hubKey(i.itemCode)]; const cos = Array.isArray(p.companies) && p.companies.length ? p.companies : []; batch.set(db.collection('products').doc(p.id), Object.assign({ wholeUOM: i.wholeUOM, looseUOM: i.looseUOM, conversionFactor: i.conv || 1 }, cos.length && !cos.includes(co) ? { companies: cos.concat(co) } : {}), { merge: true }); if (++n % 400 === 0) { await batch.commit(); batch = db.batch(); } }
    for (const i of nw) { batch.set(db.collection('products').doc(i.itemCode), { itemCode: i.itemCode, sapCode: i.itemCode, itemName: i.itemName, storageStation: 'Unassigned', wholeUOM: i.wholeUOM, looseUOM: i.looseUOM, conversionFactor: i.conv || 1, wholePrice: 0, loosePrice: 0, stockWhole: 0, stockLoose: 0, bufferLimit: 5, packagingInstructions: '', companies: [co], fromSap: true, updatedAt: new Date().toISOString() }, { merge: true }); if (++n % 400 === 0) { await batch.commit(); batch = db.batch(); } }
    await batch.commit(); try { await logSystemAction('SAP_PRODUCTS_SYNC', `${co}: ${ex.length} update, ${nw.length} bago`); } catch (e) {}
    alert(`✅ Tapos: ${chg.length} UOM ang inayos, ${nw.length} bagong produkto.`);
  } catch (e) { alert('Error: ' + e.message); }
}
async function sapConfirmImport() {
  const P = sapState.preview; if (!P) return; const asOf = (document.getElementById('sap-asof') || {}).value || '';
  try {
    let batch = db.batch(), n = 0; const cos = new Set();
    for (const r of P.rows) { const company = r.company || sapState.company; cos.add(company); const slug = invSlug(company); const d = Object.assign({}, r, { company, asOf, importedAt: new Date().toISOString() }); batch.set(db.collection('sap_items').doc(`${slug}__${r.itemCode}`), d, { merge: true }); if (++n % 400 === 0) { await batch.commit(); batch = db.batch(); } }
    await batch.commit();
    for (const c of cos) { try { if (!sapState.companies.includes(c)) { await db.collection('companies').doc(c).set({ name: c }, { merge: true }); sapState.companies.push(c); } } catch (e) {} }
    try { await logSystemAction('SAP_ITEMS_IMPORTED', `${[...cos].join(', ')}: ${P.rows.length} item`); } catch (e) {}
    arCloseModal(); alert(`✅ Na-import ang ${P.rows.length} item sa ${[...cos].join(', ')}.`); sapState.preview = null; sapState.company = sapState.company || [...cos][0]; loadSapItems();
  } catch (e) { alert('Error: ' + e.message); }
}
async function sapCopyToCompany() {
  const S = sapState; if (!S.items.length) { alert('Walang item na kokopyahin.'); return; }
  const others = S.companies.filter(c => c !== S.company); if (!others.length) { alert('Gumawa muna ng isa pang company (Company Management).'); return; }
  arModal(`<h3>📋 Kopyahin ang ${S.items.length} item ng ${srchEsc(S.company)}</h3><p style="font-size:.85rem;">Para sa mga company na pareho ang code at pangalan (hal. Tokiya at Tanoshi). Ina-update ang kaparehong Item No.; walang binubura.</p><div class="form-group"><label>Kopyahin sa</label><select id="sap-copy-to">${others.map(c => `<option>${srchEsc(c)}</option>`).join('')}</select></div><button class="btn btn-success" onclick="sapDoCopy()">📋 Kopyahin</button>`);
}
async function sapDoCopy() {
  const S = sapState, to = (document.getElementById('sap-copy-to') || {}).value; if (!to) return; const slug = invSlug(to);
  try { let batch = db.batch(), n = 0; for (const i of S.items) { const d = Object.assign({}, i, { company: to }); delete d.id; batch.set(db.collection('sap_items').doc(`${slug}__${i.itemCode}`), d, { merge: true }); if (++n % 400 === 0) { await batch.commit(); batch = db.batch(); } } await batch.commit(); arCloseModal(); alert(`✅ Nakopya ang ${n} item sa ${to}.`); S.company = to; loadSapItems(); } catch (e) { alert('Error: ' + e.message); }
}


// ---- GRPO / A-P Invoice reconciliation (GRNI: Goods Receipts Not Invoiced) ----
let grniRows = [];
function grniTs(v) { try { return v && v.toDate ? v.toDate() : (v && v.seconds ? new Date(v.seconds * 1000) : (v ? new Date(v) : null)); } catch (e) { return null; } }
async function openGrni() {
  arModal('<div style="padding:1rem;">Kinukuha ang listahan...</div>');
  try {
    const snap = await db.collection('vendor_pos').get(); const now = Date.now(); grniRows = [];
    snap.forEach(d => { const p = { id: d.id, ...d.data() }; if (!p.receivedAt) return; if (/^Cancel/i.test(p.status || '')) return;
      const grpo = String(p.grpoNo || '').trim(), ap = String(p.sapApInvoiceNo || '').trim(); if (ap) return;
      const rd = grniTs(p.receivedAt); grniRows.push({ id: p.id, po: p.poNumber || p.id, vendor: p.vendorName || '', si: p.vendorInvoiceNo || '', grpo, amount: +p.actualTotalAmount || +p.totalAmount || 0, rec: rd ? rd.toISOString().slice(0, 10) : '', days: rd ? Math.floor((now - rd.getTime()) / 86400000) : 0, status: p.status || '' }); });
    grniRows.sort((a, b) => b.days - a.days);
    const noG = grniRows.filter(r => !r.grpo), withG = grniRows.filter(r => r.grpo); const tot = r => r.reduce((s, x) => s + x.amount, 0);
    const tbl = rows => rows.map(r => `<tr><td>${srchEsc(r.po)}</td><td>${srchEsc(r.vendor)}</td><td>${srchEsc(r.si)}</td><td>${srchEsc(r.grpo) || '<span style="color:#dc2626;">—</span>'}</td><td>${srchEsc(r.rec)}</td><td style="text-align:right;">${r.days}d</td><td style="text-align:right;">${money(r.amount)}</td><td><button class="btn btn-sm btn-secondary" onclick="arCloseModal();poEditSapRefs('${srchEsc(r.id)}')">✏️ SAP #</button></td></tr>`).join('') || '<tr><td colspan="8" style="text-align:center;color:#94a3b8;">Wala. ✅</td></tr>';
    const head = '<thead><tr><th>PO</th><th>Vendor</th><th>Vendor SI#</th><th>GRPO#</th><th>Natanggap</th><th>Edad</th><th>Halaga</th><th></th></tr></thead>';
    arModal(`<h3>📑 GRPO na wala pang A/P Invoice</h3><p style="font-size:.85rem;color:#64748b;">Natanggap na sa app (may GRPO sa SAP) pero wala pang A/P Invoice#. Ito ang "Goods Receipts Not Invoiced". Kapag na-invoice na sa SAP, ilagay ang A/P Invoice# (✏️).</p>
      <div style="margin-bottom:.5rem;"><b>May GRPO, hindi pa na-invoice:</b> ${withG.length} PO · <b>${money(tot(withG))}</b> &nbsp; | &nbsp; <b style="color:#dc2626;">Walang GRPO#:</b> ${noG.length} PO · ${money(tot(noG))}</div>
      <div style="max-height:55vh;overflow:auto;"><h4>⏳ May GRPO, wala pang A/P Invoice</h4><table data-notools="1">${head}<tbody>${tbl(withG)}</tbody></table><h4 style="margin-top:1rem;">⚠️ Natanggap pero walang GRPO#</h4><table data-notools="1">${head}<tbody>${tbl(noG)}</tbody></table></div>
      <div style="margin-top:.6rem;"><button class="btn btn-secondary btn-sm" onclick="grniCSV()">📤 CSV</button></div>`);
  } catch (e) { arModal('<div style="color:#dc2626;padding:1rem;">Error: ' + srchEsc(e.message) + '</div>'); }
}
function grniCSV() {
  const L = ['PO,Vendor,Vendor_SI,GRPO_No,Received,Days_Outstanding,Amount,Has_GRPO'];
  grniRows.forEach(r => L.push([r.po, r.vendor, r.si, r.grpo, r.rec, r.days, r.amount.toFixed(2), r.grpo ? 'Yes' : 'No'].map(csvCell).join(',')));
  downloadCSVFile(L.join('\r\n'), 'GRPO_Not_Invoiced.csv');
}


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
    list = [...new Set(list)].filter(x => x !== me); if (!list.length) return;
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
  try { const s = await db.collection('hr_documents').get(); hrdState.list = []; s.forEach(d => hrdState.list.push({ id: d.id, ...d.data() })); hrdState.list.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))); } catch (e) { root.innerHTML = '<div class="card">Error: ' + srchEsc(e.message) + '</div>'; return; }
  hrdRender();
}
function hrdRender() {
  const root = hrdRoot(); if (!root) return; const st = hrdState; const cats = [...new Set([...HRD_CATS, ...st.list.map(d => d.category).filter(Boolean)])];
  const list = st.list.filter(d => (!st.cat || d.category === st.cat) && (!st.q || smartMatch(st.q, d.title + ' ' + (d.description || ''), d.category || '')));
  root.innerHTML = `<div class="card" data-notools="1"><div class="card-title"><span>📚 HR Documents</span>${hrdCanManage() ? '<button class="btn btn-success btn-sm" onclick="hrdUploadOpen()">➕ Mag-upload</button>' : ''}</div>
    <div style="display:flex;gap:.5rem;flex-wrap:wrap;margin-bottom:.6rem;"><input type="search" id="hrd-q" placeholder="🔎 Hanapin..." value="${srchEsc(st.q)}" oninput="hrdState.q=this.value;hrdRender();document.getElementById('hrd-q').focus()" style="flex:1;min-width:160px;">
      <select onchange="hrdState.cat=this.value;hrdRender()"><option value="">Lahat ng kategorya</option>${cats.map(c => `<option ${c === st.cat ? 'selected' : ''}>${srchEsc(c)}</option>`).join('')}</select></div>
    <div class="table-responsive"><table><thead><tr><th>Dokumento</th><th>Kategorya</th><th>Petsa</th><th></th></tr></thead><tbody>${list.map(d => `<tr><td><b>${srchEsc(d.title)}</b>${d.description ? `<br><small style="color:#64748b;">${srchEsc(d.description)}</small>` : ''}${d.fileName ? `<br><small style="color:#94a3b8;">📎 ${srchEsc(d.fileName)}${d.size ? ' · ' + Math.round(d.size / 1024) + ' KB' : ''}</small>` : ''}</td><td>${srchEsc(d.category || '')}</td><td style="font-size:.8rem;">${srchEsc(String(d.createdAt || '').slice(0, 10))}</td><td style="white-space:nowrap;"><button class="btn btn-primary btn-sm" onclick="hrdOpen('${srchEsc(d.id)}')">${d.kind === 'link' ? '🔗 Buksan' : '⬇️ I-download'}</button>${hrdCanManage() ? ` <button class="btn btn-secondary btn-sm" onclick="hrdDelete('${srchEsc(d.id)}')">🗑️</button>` : ''}</td></tr>`).join('') || '<tr><td colspan="4" style="text-align:center;color:#94a3b8;padding:1.2rem;">Wala pang dokumento.</td></tr>'}</tbody></table></div></div>`;
}
function hrdUploadOpen() {
  if (!hrdCanManage()) return;
  arModal(`<h3>➕ Mag-upload ng HR Document</h3><div class="form-group"><label>Pamagat</label><input id="hrd-title" type="text" style="width:100%;"></div>
    <div class="form-group"><label>Kategorya</label><input id="hrd-cat" list="hrd-cats" value="Forms" style="width:100%;"><datalist id="hrd-cats">${HRD_CATS.map(c => `<option>${c}</option>`).join('')}</datalist></div>
    <div class="form-group"><label>Paglalarawan (optional)</label><input id="hrd-desc" type="text" style="width:100%;"></div>
    <div class="form-group"><label>📎 File (PDF/Word/Excel/larawan, hanggang 4MB)</label><input id="hrd-file" type="file"></div>
    <div class="form-group"><label>— o — 🔗 Link (Google Drive, atbp.)</label><input id="hrd-link" type="url" placeholder="https://..." style="width:100%;"></div>
    <button class="btn btn-success" onclick="hrdUpload()">💾 I-save</button>`);
}
function hrdReadFile(f) { return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = () => rej(new Error('Hindi mabasa ang file')); r.readAsDataURL(f); }); }
async function hrdUpload() {
  const title = (document.getElementById('hrd-title').value || '').trim(), category = (document.getElementById('hrd-cat').value || '').trim() || 'Iba pa', description = (document.getElementById('hrd-desc').value || '').trim(), link = (document.getElementById('hrd-link').value || '').trim();
  const f = (document.getElementById('hrd-file').files || [])[0]; if (!title) { alert('Ilagay ang pamagat.'); return; } if (!f && !link) { alert('Mag-attach ng file o maglagay ng link.'); return; } if (f && f.size > 4 * 1024 * 1024) { alert('Masyadong malaki (max 4MB). Gamitin ang link (Google Drive) para sa malaking file.'); return; }
  const me = getCurrentUser() || {}, id = 'HRD-' + Date.now().toString(36).toUpperCase(), now = new Date().toISOString();
  try {
    let meta = { title, category, description, createdBy: me.name || me.email || '', createdAt: now };
    if (f) { const data = await hrdReadFile(f), CH = 700000, n = Math.ceil(data.length / CH); for (let i = 0; i < n; i++) await db.collection('hr_doc_files').doc(id + '_' + i).set({ docId: id, idx: i, data: data.slice(i * CH, (i + 1) * CH) }); meta = { ...meta, kind: 'file', fileName: f.name, mime: f.type || 'application/octet-stream', size: f.size, chunks: n }; }
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
function sessForceOut() { try { localStorage.removeItem('kerp_login_at'); } catch (e) {} uiAlert('🚪 Na-logout ka ng Admin. Mag-login ulit kung kailangan.').then(() => logoutUser()); }
function sessStart() {
  const u = getCurrentUser(); if (!u || !u.email || typeof db === 'undefined' || !db || window.__sessOn) return; window.__sessOn = true;
  try { if (!localStorage.getItem('kerp_login_at')) localStorage.setItem('kerp_login_at', String(Date.now())); } catch (e) {}
  presBeat(); setInterval(presBeat, 180000); document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') presBeat(); });
  const watch = id => { let first = true; const ref = db.collection('session_control').doc(id); if (typeof ref.onSnapshot !== 'function') return; ref.onSnapshot(snap => { const f = first; first = false; if (!snap.exists) return; const t = snap.data().logoutAt, ms = t && t.toMillis ? t.toMillis() : 0; if (!ms) return;
      let seen = 0, li = 0; try { seen = +localStorage.getItem('kerp_logout_seen') || 0; li = +localStorage.getItem('kerp_login_at') || 0; } catch (e) {}
      if (ms <= seen) return; try { localStorage.setItem('kerp_logout_seen', String(ms)); } catch (e) {} if (f && ms <= li) return; sessForceOut(); }, () => {}); };
  watch(String(u.email).toLowerCase()); if (normalizeRole(u.role) !== 'admin') watch('_all');
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
    <p style="font-size:.78rem;color:#64748b;">ℹ️ Ang pag-logout ay tumatama sa lahat ng device ng user at agad na gumagana habang bukas ang app niya; kung sarado ang app, mala-logout siya pagbukas niya. Hindi nito binabago ang password.</p></div>`;
}
async function sesLogout(email) { if (!await uiConfirm(`I-logout si ${email} sa lahat ng device?`)) return; try { await db.collection('session_control').doc(String(email).toLowerCase()).set({ logoutAt: firebase.firestore.FieldValue.serverTimestamp(), by: (getCurrentUser() || {}).email || '' }); alert('✅ Napadala ang logout.'); } catch (e) { alert('Error: ' + e.message); } }
async function sesLogoutAll() { if (!await uiConfirm('I-logout LAHAT ng users (maliban sa mga admin)?')) return; try { await db.collection('session_control').doc('_all').set({ logoutAt: firebase.firestore.FieldValue.serverTimestamp(), by: (getCurrentUser() || {}).email || '' }); alert('✅ Napadala ang logout sa lahat.'); } catch (e) { alert('Error: ' + e.message); } }

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
  const m = memoState.list.find(x => x.id === id); if (!m) return; const ak = memoState.acks[id] || {}; const nameOf = e => (memoState.users.find(u => u.email === e) || {}).name || e;
  const done = (m.recipients || []).filter(e => ak[e]), pend = (m.recipients || []).filter(e => !ak[e]);
  arModal(`<h3>${srchEsc(m.title)}</h3><div style="white-space:pre-wrap;margin-bottom:.6rem;">${srchEsc(m.body)}</div>${m.image ? `<img src="${m.image}" style="max-width:100%;border-radius:.4rem;">` : ''}
    <h4>✅ Na-acknowledge (${done.length})</h4><div style="max-height:130px;overflow:auto;font-size:.85rem;">${done.map(e => `${srchEsc(nameOf(e))} <small style="color:#64748b;">${srchEsc(String(ak[e].at).slice(0, 16).replace('T', ' '))}</small>`).join('<br>') || '—'}</div>
    <h4>⏳ Hindi pa (${pend.length})</h4><div style="max-height:130px;overflow:auto;font-size:.85rem;">${pend.map(e => srchEsc(nameOf(e))).join('<br>') || '—'}</div>
    <div style="margin-top:.6rem;"><button class="btn btn-secondary btn-sm" onclick="memoRemind('${id}')">🔔 Paalalahanan ang hindi pa</button> <button class="btn btn-secondary btn-sm" onclick="memoCSV('${id}')">📤 CSV</button></div>`);
}
function memoRemind(id) { const m = memoState.list.find(x => x.id === id); const ak = memoState.acks[id] || {}; const p = (m.recipients || []).filter(e => !ak[e]); if (!p.length) { alert('Lahat ay na-acknowledge na.'); return; } notify(p, `⏰ Paalala: Memo — ${m.title}`, 'Pakibasa at i-acknowledge ang memo sa 🔔.'); alert('Naipadala ang paalala sa ' + p.length + ' tao.'); }
function memoCSV(id) { const m = memoState.list.find(x => x.id === id); const ak = memoState.acks[id] || {}; const L = ['Email,Name,Acknowledged,Acknowledged_At']; (m.recipients || []).forEach(e => L.push([e, (memoState.users.find(u => u.email === e) || {}).name || '', ak[e] ? 'Yes' : 'No', ak[e] ? ak[e].at : ''].map(csvCell).join(','))); downloadCSVFile(L.join('\r\n'), `Memo_${id}_acks.csv`); }
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
        localStorage.removeItem(AUTH_KEY);
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
  if (!isAdmin && !isBranch && !isComm) return; // index.html / ibang page: walang gagawin

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
