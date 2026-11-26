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
      let done = false; const inp = o.querySelector('.ui-dlg-in'); if (inp && /e-?mail/i.test(msg)) inp.dataset.fmt = /kuwit|mga email|emails/i.test(msg) ? 'emails' : 'email';
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
    // FLIP: mag-iiba agad ang layout (isang beses lang), tapos transform ang nag-a-animate — mas makinis kaysa sa pag-animate ng margin.
    const hiding = !sidebar.classList.contains('hidden');
    sidebar.style.transition = 'none';
    sidebar.classList.toggle('hidden');
    sidebar.style.transform = hiding ? 'translateX(260px)' : 'translateX(-260px)';
    void sidebar.offsetWidth;
    sidebar.style.transition = 'transform 0.22s cubic-bezier(0.4, 0, 0.2, 1)';
    sidebar.style.transform = 'translateX(0)';
    setTimeout(() => { sidebar.style.transition = 'none'; sidebar.style.transform = ''; }, 260);
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
const KERP_AUTH_KEY = 'kusina_current_user';
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

function idleExempt() {
  try {
    const u = JSON.parse(localStorage.getItem(KERP_AUTH_KEY) || 'null'); if (!u) return false;
    const r = String(u.role || '').toLowerCase().replace(/[\s_-]+/g, '');
    if (r === 'admin' || r === 'superadmin') return true;
    return typeof superAdminIsMe === 'function' && !!superAdminIsMe();
  } catch (e) { return false; }
}
function resetInactivityTimers() {
  clearTimeout(inactivityTimer);
  clearTimeout(warningTimer);
  clearInterval(warningCountdownInterval);
  // Admin / Super Admin: walang idle auto-logout (sila ang nagpapatakbo ng notifications, subscription alerts, reservations at auto-backup na tumatakbo sa nakabukas na browser)
  if (idleExempt()) { const wm = document.getElementById('inactivity-modal'); if (wm) wm.style.display = 'none'; return; }
  
  const warnModal = document.getElementById('inactivity-modal');
  if (warnModal) warnModal.style.display = 'none';

  warningTimer = setTimeout(showInactivityWarning, WARNING_LIMIT_MS);
  inactivityTimer = setTimeout(forceAutoLogout, INACTIVITY_LIMIT_MS);
}

function showInactivityWarning() {
  if (idleExempt()) return;
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
  if (idleExempt()) return;
  alert('Nag-auto logout ang system dahil sa 10 minutong kawalan ng aktibidad.');
  logoutUser();
}

['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll'].forEach(evt => {
  window.addEventListener(evt, resetInactivityTimers, { passive: true });
});
resetInactivityTimers();

window.getCurrentUser = function() {
  const data = localStorage.getItem(KERP_AUTH_KEY);
  return data ? JSON.parse(data) : null;
};
function getCurrentUser() {
  const data = localStorage.getItem(KERP_AUTH_KEY);
  return data ? JSON.parse(data) : null;
}

window.setCurrentUser = function(user) {
  localStorage.setItem(KERP_AUTH_KEY, JSON.stringify(user));
};
function setCurrentUser(user) {
  localStorage.setItem(KERP_AUTH_KEY, JSON.stringify(user));
}

function logoutUser() {
  try { localStorage.removeItem('kerp_login_at'); } catch (e) {}
  if (typeof auth !== 'undefined' && auth && auth.signOut) {
    logSystemAction('LOGOUT', 'User securely logged out.'); auth.signOut().catch(() => {});
  }
  localStorage.removeItem(KERP_AUTH_KEY);
  window.location.href = 'index.html';
}

function normalizeRole(role) {
  if (!role) return '';
  const r = String(role).toLowerCase().trim();
  if (r.includes('admin') || r.includes('accounting') || r.includes('head')) return 'admin';
  if (r.includes('commi') || r.includes('kitchen') || r.includes('plant')) return 'commissary';
  if (r.includes('branch') || r.includes('store') || r.includes('outlet')) return 'branch';
  if (r.includes('employee') || r.includes('staff')) return 'employee';
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
  else if (cleanRole === 'employee') window.location.href = 'employee.html';
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
  } else if (cleanRole === 'employee') {
    window.location.href = 'employee.html';
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
        <tr id="user-row-${email.replace(/[@.]/g, '_')}" data-status="${status}" data-role="${role}" style="cursor:pointer;" title="I-click para i-edit ang user" onclick="usrRowClick(event,'${email}')">
          <td>
            <b>${name}</b><br>
            <small style="color: #64748b;">${email}</small>
          </td>
          <td>
            <input type="text" id="station-${email.replace(/[@.]/g, '_')}" value="${branch}" placeholder="Hal: Commissary Meat / Branch ATC" style="font-size: 0.85rem; padding: 0.35rem 0.5rem;">
          </td>
          <td>
            <select id="role-${email.replace(/[@.]/g, '_')}" ${lockRow ? 'disabled' : ''} style="font-size: 0.85rem; padding: 0.35rem 0.5rem;">
              <option value="employee" ${role === 'employee' ? 'selected' : ''}>Employee (Self-service)</option>
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
            ${lockRow ? '<small>🔒 Super Admin lang</small>' : `<button class="btn btn-sm btn-primary" onclick="saveUserRole('${email}')">💾 I-save</button>
            <div style="display:flex;gap:.25rem;flex-wrap:wrap;margin-top:.3rem;"><button class="btn btn-sm btn-secondary" title="Palitan ang pangalan" onclick="usrRename('${email}')">✏️</button><button class="btn btn-sm btn-secondary" title="Padalhan ng password reset email" onclick="usrResetPw('${email}')">🔑 Reset</button><button class="btn btn-sm btn-secondary" title="Pilitin magpalit ng password sa susunod na login" onclick="usrForcePw('${email}')">🔒 Force</button><button class="btn btn-sm btn-danger" title="Burahin ang user" onclick="usrDelete('${email}')">🗑️</button></div>${data.mustChangePw ? '<small style="color:#b45309;">⏳ Papalitan ang password sa next login</small>' : ''}`}
          </td>
        </tr>
      `;
    });

    tbody.innerHTML = rowsHtml;
    try { await usrRenderLanding(snapshot); } catch (e) { console.warn('landing:', e.message); }
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
// ---- User Management landing: mga bagong registrant (Pending) + pag-assign ng role ----
let usrCustomRoles = {};
function usrSid(email) { return String(email).replace(/[@.]/g, '_'); }
function usrRoleOptionsHtml(sel) {
  const base = [['employee', '🧑‍💼 Employee (Self-service: attendance, OB/OT/Leave)'], ['branch', '🏪 Branch Operations'], ['commissary', '🏭 Commissary Hub']];
  let h = base.map(([v, l]) => `<option value="${v}" ${sel === v ? 'selected' : ''}>${l}</option>`).join('');
  const ids = Object.keys(usrCustomRoles || {});
  if (ids.length) h += '<optgroup label="Custom Roles">' + ids.map(id => `<option value="c:${srchEsc(id)}">🧩 ${srchEsc(usrCustomRoles[id].name)}</option>`).join('') + '</optgroup>';
  return h;
}
async function usrRenderLanding(snapshot) {
  const tbody = document.getElementById('user-approval-table'); if (!tbody) return;
  const host = tbody.closest('.table-responsive') || tbody.closest('table'); if (!host) return;
  try { usrCustomRoles = await loadCustomRoles(); } catch (e) { usrCustomRoles = {}; }
  ['usr-landing', 'usr-filter-bar'].forEach(id => { const o = document.getElementById(id); if (o) o.remove(); });
  const pend = []; let cA = 0, cP = 0, cD = 0; const byRole = {};
  snapshot.forEach(d => {
    const x = d.data(); const st = String(x.status || 'pending').toLowerCase(); const ro = String(x.role || 'pending').toLowerCase();
    if (st === 'active') cA++; else if (st === 'disabled') cD++; else cP++;
    if (st === 'active') { const k = x.customRoleName || normalizeRole(ro) || 'pending'; byRole[k] = (byRole[k] || 0) + 1; }
    if (st !== 'active' && st !== 'disabled') pend.push({ email: d.id, name: x.name || d.id.split('@')[0], station: x.branch && x.branch !== 'Unassigned' ? x.branch : (x.requestedStation || ''), at: x.createdAt || '' });
  });
  const rows = pend.length ? pend.map(u => { const sid = usrSid(u.email); return `<tr><td><b>${srchEsc(u.name)}</b><br><small style="color:#64748b;">${srchEsc(u.email)}</small></td>
      <td><input type="text" id="lnd-st-${sid}" value="${srchEsc(u.station)}" placeholder="Branch / Department" style="font-size:.85rem;padding:.35rem .5rem;"></td>
      <td><select id="lnd-role-${sid}" data-nosearch="1" style="font-size:.85rem;padding:.35rem .5rem;"><option value="">— Pumili ng role —</option>${usrRoleOptionsHtml('')}</select></td>
      <td style="white-space:nowrap;"><button class="btn btn-sm btn-success" onclick="usrApprove('${u.email}')">✅ Approve</button> <button class="btn btn-sm btn-danger" onclick="usrReject('${u.email}')">⛔ Tanggihan</button></td></tr>`; }).join('')
    : '<tr><td colspan="4" style="text-align:center;color:#94a3b8;padding:1rem;">Walang naghihintay na bagong registrant. 🎉</td></tr>';
  const chips = Object.keys(byRole).map(k => `<span style="background:#f1f5f9;border-radius:999px;padding:.15rem .6rem;font-size:.75rem;">${srchEsc(k)}: <b>${byRole[k]}</b></span>`).join(' ');
  host.insertAdjacentHTML('beforebegin', `<div id="usr-landing" data-notools="1" style="border:2px solid ${pend.length ? '#f59e0b' : '#e2e8f0'};border-radius:.6rem;padding:.8rem;margin-bottom:1rem;background:${pend.length ? '#fffbeb' : '#f8fafc'};">
      <div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:.4rem;align-items:center;"><b>🆕 Mga Bagong Registrant — Pending (${pend.length})</b><span style="font-size:.78rem;color:#64748b;">Active: <b>${cA}</b> · Pending: <b>${cP}</b> · Disabled: <b>${cD}</b></span></div>
      <p style="font-size:.8rem;color:#64748b;margin:.3rem 0 .6rem;">Lahat ng nag-register ay <b>Pending</b> muna. Piliin ang role at i-approve. Gusto ng bagong klase ng role? Gumawa ng <b>Custom Role</b> sa Access Control — lalabas din ito dito.</p>
      <div class="table-responsive"><table data-notools="1"><thead><tr><th>Pangalan / Email</th><th>Branch / Department</th><th>I-assign na Role</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>
      <div style="margin-top:.5rem;display:flex;gap:.3rem;flex-wrap:wrap;">${chips}</div></div>
    <div id="usr-filter-bar" style="display:flex;gap:.5rem;align-items:center;margin-bottom:.6rem;"><label style="font-size:.8rem;">Ipakita:</label>
      <select id="usr-status-filter" data-nosearch="1" onchange="filterAdminUsersTable()" style="max-width:200px;"><option value="">Lahat</option><option value="active">Active lang</option><option value="pending">Pending lang</option><option value="disabled">Disabled lang</option></select>
      <select id="usr-role-filter" data-nosearch="1" onchange="filterAdminUsersTable()" style="max-width:200px;"><option value="">Lahat ng role</option><option value="employee">Employee</option><option value="branch">Branch</option><option value="commissary">Commissary</option><option value="admin">Admin</option></select></div>`);
}
function filterAdminUsersTable() {
  const q = String((document.getElementById('admin-user-search') || {}).value || '').toLowerCase().trim();
  const st = (document.getElementById('usr-status-filter') || {}).value || '', ro = (document.getElementById('usr-role-filter') || {}).value || '';
  document.querySelectorAll('#user-approval-table tr').forEach(tr => {
    const text = (tr.innerText + ' ' + [...tr.querySelectorAll('input')].map(i => i.value).join(' ')).toLowerCase();
    const okq = !q || q.split(/\s+/).every(w => text.includes(w));
    const oks = !st || (st === 'pending' ? (tr.dataset.status !== 'active' && tr.dataset.status !== 'disabled') : tr.dataset.status === st);
    const okr = !ro || normalizeRole(tr.dataset.role) === ro;
    tr.style.display = okq && oks && okr ? '' : 'none';
  });
}
async function usrApprove(email) {
  const sid = usrSid(email); const roleEl = document.getElementById('lnd-role-' + sid), stEl = document.getElementById('lnd-st-' + sid);
  const pick = roleEl ? roleEl.value : ''; if (!pick) { alert('Pumili muna ng role para sa user na ito.'); return; }
  const station = (stEl ? stEl.value.trim() : '') || 'Unassigned';
  const upd = { status: 'active', branch: station }; let label = pick;
  if (pick.startsWith('c:')) { const cr = usrCustomRoles[pick.slice(2)]; if (!cr) { alert('Hindi nahanap ang custom role.'); return; } Object.assign(upd, { role: cr.base, customRole: pick.slice(2), customRoleName: cr.name, permissions: cr.perms || {} }); label = cr.name; }
  else upd.role = pick;
  if (!(await uiConfirm(`I-approve si ${email} bilang "${label}" sa "${station}"?`))) return;
  try {
    await db.collection('users').doc(email.toLowerCase()).update(upd);
    try { await logSystemAction('USER_APPROVED', `${email} → ${label} (${station})`); } catch (e) {}
    try { notify([email], 'Na-approve na ang account mo', `Puwede ka nang mag-login sa KusinaERP bilang ${label}.`); } catch (e) {}
    alert('✅ Na-approve na.'); loadFirestoreUsers();
  } catch (e) { alert('Hindi na-approve: ' + e.message); }
}
async function usrReject(email) {
  if (!(await uiConfirm(`Tanggihan (i-disable) ang registration ni ${email}?`))) return;
  try { await db.collection('users').doc(email.toLowerCase()).update({ status: 'disabled' }); try { await logSystemAction('USER_REJECTED', email); } catch (e) {} loadFirestoreUsers(); } catch (e) { alert('Error: ' + e.message); }
}
// ---- Admin tools sa User: palitan ang pangalan, reset password, pilitin ang bagong password, burahin ----
function usrCanManage(email, data) {
  const t = String(email || '').toLowerCase(), me = String((getCurrentUser() || {}).email || '').toLowerCase();
  if (t === me) return 'Hindi puwede sa sarili mong account ang aksyong ito.';
  if (superAdminState.emails.includes(t)) return 'Super Admin ang account na ito; hindi puwedeng galawin.';
  if (/(admin|accounting|head)/.test(String((data || {}).role || '').toLowerCase()) && !superAdminIsMe()) return 'Super Admin lang ang puwedeng gumalaw ng admin account.';
  return '';
}
function usrRowClick(ev, email) { if (ev.target.closest('button,input,select,a,textarea,label')) return; usrOpen(email); }
async function usrOpen(email) {
  try {
    const em = String(email).toLowerCase(), d = await usrGet(em); if (!d) { alert('Wala ang user.'); return; }
    const why = usrCanManage(em, d), SUP = superAdminIsMe(), role = String(d.role || 'pending').toLowerCase(), st = String(d.status || 'pending').toLowerCase();
    const opt = (v, l, cur, dis) => `<option value="${v}" ${cur === v ? 'selected' : ''} ${dis ? 'disabled' : ''}>${l}</option>`;
    const mine = em === String((getCurrentUser() || {}).email || '').toLowerCase();
    arModal(`<h3>👤 ${srchEsc(d.name || em)}</h3><div style="font-size:.85rem;color:#64748b;margin-bottom:.6rem;">${srchEsc(em)}${d.mustChangePw ? ' · ⏳ Papalitan ang password' : ''}</div>
    ${why && !mine ? `<div style="background:#fef3c7;color:#92400e;padding:.4rem .6rem;border-radius:.4rem;font-size:.82rem;margin-bottom:.5rem;">🔒 ${srchEsc(why)}</div>` : ''}
    <div class="form-group"><label>Pangalan</label><input type="text" id="uo-name" value="${srchEsc(d.name || '')}"></div>
    <div class="form-group"><label>Branch / Station</label><input type="text" id="uo-branch" value="${srchEsc(d.branch || d.requestedStation || '')}"></div>
    <div class="form-group"><label>Role</label><select id="uo-role">${opt('employee', 'Employee (Self-service)', role)}${opt('branch', 'Branch Operations', role)}${opt('commissary', 'Commissary Hub', role)}${opt('admin', 'Head Office Admin', role, !SUP)}${opt('pending', 'Pending (No Access)', role)}</select></div>
    <div class="form-group"><label>Status</label><select id="uo-status">${opt('active', 'Active (Papasok)', st)}${opt('pending', 'Pending (Bawal)', st)}${opt('disabled', 'Disabled (Blocked)', st)}</select></div>
    <div style="display:flex;gap:.4rem;flex-wrap:wrap;margin-top:.6rem;">
      <button class="btn btn-primary" onclick="usrOpenSave('${em}')">💾 I-save</button>
      <button class="btn btn-secondary" onclick="arCloseModal();switchAdminView('security');setTimeout(()=>{const u=(acUsersList||[]).find(x=>x.email==='${em}');if(u&&typeof acPickUser==='function')acPickUser(u);},1500)">🛠️ Special access</button>
      <button class="btn btn-secondary" onclick="arCloseModal();usrResetPw('${em}')">🔑 Reset password</button>
      <button class="btn btn-secondary" onclick="arCloseModal();usrForcePw('${em}')">🔒 Force new password</button>
      <button class="btn btn-danger" onclick="arCloseModal();usrDelete('${em}')">🗑️ Delete</button></div>`);
  } catch (e) { alert('Error: ' + e.message); }
}
async function usrOpenSave(email) {
  try {
    const em = String(email).toLowerCase(), d = await usrGet(em); if (!d) return;
    const why = usrCanManage(em, d); if (why) { alert(why); return; }
    const g = id => (document.getElementById(id) || {}).value, nm = String(g('uo-name') || '').trim(), role = g('uo-role'), status = g('uo-status'), branch = String(g('uo-branch') || '').trim() || 'Branch';
    if (!nm) { alert('Walang laman ang pangalan.'); return; }
    if (/admin|accounting|head/i.test(role) && !/admin|accounting|head/i.test(String(d.role || '')) && !(await secNeed4('admin_role', 'Gawing ' + role + ' si ' + em))) return;
    await db.collection('users').doc(em).update({ name: nm, role, status, branch });
    try { await logSystemAction('USER_EDITED', `${em}: ${nm} · ${role} · ${status} · ${branch}`); } catch (e) {}
    arCloseModal(); loadFirestoreUsers();
  } catch (e) { alert('Hindi na-save: ' + e.message); }
}
async function usrGet(email) { const d = await db.collection('users').doc(String(email).toLowerCase()).get(); return d.exists ? d.data() : null; }
async function usrRename(email) {
  try {
    const d = await usrGet(email); if (!d) { alert('Wala ang user.'); return; }
    const why = usrCanManage(email, d); if (why && String(email).toLowerCase() !== String((getCurrentUser() || {}).email || '').toLowerCase()) { alert(why); return; }
    const n = await uiPrompt('Pangalan ng user (' + email + '):', d.name || ''); if (n === null) return; const nm = String(n).trim(); if (!nm) { alert('Walang laman ang pangalan.'); return; }
    await db.collection('users').doc(String(email).toLowerCase()).update({ name: nm });
    try { await logSystemAction('USER_RENAMED', `${email}: ${d.name || ''} → ${nm}`); } catch (e) {}
    loadFirestoreUsers();
  } catch (e) { alert('Error: ' + e.message); }
}
async function usrResetPw(email) {
  try {
    const d = await usrGet(email); if (!d) { alert('Wala ang user.'); return; }
    const why = usrCanManage(email, d); if (why) { alert(why); return; }
    if (!(await uiConfirm(`Padalhan ng password reset email si ${email}? Makakatanggap siya ng link para mag-set ng bagong password.`))) return;
    await auth.sendPasswordResetEmail(String(email).toLowerCase());
    try { await logSystemAction('USER_PW_RESET_SENT', email); } catch (e) {}
    alert('✅ Naipadala ang reset link sa ' + email + '.');
  } catch (e) { alert('Hindi naipadala: ' + e.message); }
}
async function usrForcePw(email) {
  try {
    const d = await usrGet(email); if (!d) { alert('Wala ang user.'); return; }
    const why = usrCanManage(email, d); if (why) { alert(why); return; }
    if (!(await uiConfirm(`Pilitin si ${email} na magpalit ng bagong password sa susunod niyang login (email/password)?`))) return;
    await db.collection('users').doc(String(email).toLowerCase()).update({ mustChangePw: true });
    try { await logSystemAction('USER_FORCE_PW', email); } catch (e) {}
    alert('✅ Tatanungin na siya ng bagong password sa susunod na login.'); loadFirestoreUsers();
  } catch (e) { alert('Error: ' + e.message); }
}
async function usrDelete(email) {
  try {
    const d = await usrGet(email); if (!d) { alert('Wala ang user.'); return; }
    const why = usrCanManage(email, d); if (why) { alert(why); return; }
    if (!(await uiConfirm(`BURAHIN si ${d.name || email} (${email})? Hindi na siya makakapasok sa ERP at mawawala ang role/permissions niya. Hindi ito mababawi.`))) return;
    await db.collection('users').doc(String(email).toLowerCase()).delete();
    try { await logSystemAction('USER_DELETED', `${email} (${d.name || ''}, role ${d.role || ''}, ${d.branch || ''})`); } catch (e) {}
    alert('🗑️ Nabura na ang user.'); loadFirestoreUsers();
  } catch (e) { alert('Hindi nabura: ' + e.message); }
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

  if (/admin|accounting|head/i.test(newRole) && !(await secNeed4('admin_role', 'Gawing ' + newRole + ' si ' + email))) return;
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
        if (apCompany && apCompany !== '__none') { const prev = existing.exists ? productCompanies(existing.data()) : []; if (!prev.some(x => hubKey(x) === hubKey(apCompany))) data.companies = prev.concat(apCompany); }
        await ref.set(data, { merge: true });
        existing.exists ? updated++ : added++;
        const cw = parseFloat(pick(r, 'cost_whole')), cl = parseFloat(pick(r, 'cost_loose')), spw = parseFloat(pick(r, 'supplier_price')), spl = parseFloat(pick(r, 'supplier_price_loose'));
        const ctw = parseFloat(pick(r, 'content_whole')), ctl = parseFloat(pick(r, 'content_loose')), ctu = String(pick(r, 'content_unit') || '').toLowerCase();
        if (!isNaN(ctw) || !isNaN(ctl)) { const cd = {}; if (!isNaN(ctw)) cd.wholeContent = ctw; if (!isNaN(ctl)) cd.looseContent = ctl; if (ctu === 'g' || ctu === 'ml') cd.contentUnit = ctu; await ref.set(cd, { merge: true }); }
        if (!isNaN(cw) || !isNaN(cl) || !isNaN(spw) || !isNaN(spl)) {
          const c = {}; if (!isNaN(cw)) c.costWhole = cw; if (!isNaN(cl)) c.costLoose = cl; if (!isNaN(spw)) c.supplierPrice = spw; if (!isNaN(spl)) c.supplierPriceLoose = spl; else if (!isNaN(spw)) { const cv = parseFloat(data.conversionFactor) || parseFloat((existing.exists && existing.data().conversionFactor)) || 1; c.supplierPriceLoose = +(spw / cv).toFixed(4); } c.updatedAt = firebase.firestore.FieldValue.serverTimestamp();
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