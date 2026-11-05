
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

window.addEventListener('popstate', function () {
  history.pushState(null, document.title, location.href);
  const confirmExit = confirm("Gusto mo bang mag-logout ngayon? Lahat ng hindi na-save na data ay mawawala.");
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
    alert('Kailangan munang mag-login.');
    window.location.href = 'index.html';
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
            <select id="role-${email.replace(/[@.]/g, '_')}" style="font-size: 0.85rem; padding: 0.35rem 0.5rem;">
              <option value="branch" ${role === 'branch' ? 'selected' : ''}>Branch Operations</option>
              <option value="commissary" ${role === 'commissary' ? 'selected' : ''}>Commissary Hub</option>
              <option value="admin" ${role === 'admin' ? 'selected' : ''}>Head Office Admin</option>
              <option value="pending" ${role === 'pending' ? 'selected' : ''}>Pending (No Access)</option>
            </select>
          </td>
          <td>
            <select id="status-${email.replace(/[@.]/g, '_')}" style="font-size: 0.85rem; padding: 0.35rem 0.5rem;">
              <option value="active" ${status === 'active' ? 'selected' : ''}>Active (Papasok)</option>
              <option value="pending" ${status === 'pending' ? 'selected' : ''}>Pending (Bawal)</option>
              <option value="disabled" ${status === 'disabled' ? 'selected' : ''}>Disabled (Blocked)</option>
            </select>
          </td>
          <td>
            <button class="btn btn-sm btn-primary" onclick="saveUserRole('${email}')">💾 I-save</button>
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
  if (!confirm('Tanggalin ang station na ito?')) return;
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
  if (!confirm('Tanggalin ang UOM na ito?')) return;
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
  const headers = "SAP_Item_Code,Item_Description,Commissary_Hub,Storage_Station,Whole_UOM,Loose_UOM,Whole_Price,Loose_Price,Conversion_Factor,Buffer_Limit,Packaging_Instructions\n";
  const sample1 = "SAP-001,Beef Tapa Marinated,Commissary Meat,Station 1 - Cold Storage,Box,Sheets,500,12,50,15,I-vacuum pack bago i-freeze\n";
  const sample2 = "SAP-002,Cooking Oil 18L,Commissary Wares,Station 2 - Dry Warehouse,Tin,Liters,1200,75,18,5,I-tape ang takip at i-seal\n";
  const blob = new Blob([headers + sample1 + sample2], { type: 'text/csv' });
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
    // 🛡️ Awtomatikong kumuha ng snapshot backup bago simulan ang pag-update
    await backupCurrentProducts("Pre-Upload Auto-Backup (CSV Bulk Upload)");
    const lines = e.target.result.split('\n');
    let addedCount = 0;
    
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      const cols = line.split(',');
      if (cols.length >= 6) {
        const itemCode = cols[0].trim();
        const itemName = cols[1].trim();
        const hub = cols[2].trim();
        const storageStation = cols[3].trim();
        const wholeUOM = cols[4].trim() || 'Box';
        const looseUOM = cols[5].trim() || 'Pcs';
        const wholePrice = parseFloat(cols[6] || 0);
        const loosePrice = parseFloat(cols[7] || 0);
        const conversion = parseInt(cols[8] || 1);
        const bufferLimit = parseInt(cols[9] || 5);

        if (db && itemCode) {
          try {
            await db.collection('products').doc(itemCode).set({
              itemCode: itemCode,
              itemName: itemName,
              commissarySource: hub,
              storageStation: storageStation,
              wholeUOM: wholeUOM,
              looseUOM: looseUOM,
              wholePrice: wholePrice,
              loosePrice: loosePrice,
              conversionFactor: conversion,
              bufferLimit: bufferLimit,
              stockWhole: 0,
              stockLoose: 0,
              updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
            addedCount++;
          } catch (err) {
            console.error('Error adding product:', err);
          }
        }
      }
    }

    logSystemAction('BULK_UPLOAD', `Nag-upload ng CSV masterlist. Added/Updated: ${addedCount} items.`);
    alert(`Matagumpay na nai-upload ang mga produkto sa Firestore! (${addedCount} items)`);
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
        <td><b>${name}</b></td>
        <td>${hub}</td>
        <td><span class="badge badge-admin">📍 ${station}</span></td>
        <td><b style="color: #2563eb;">₱${wholePrice.toFixed(2)}</b> / ${wholeUOM}</td>
        <td><b style="color: #059669;">₱${loosePrice.toFixed(2)}</b> / ${looseUOM}</td>
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
  if (!confirm(`Sigurado ka bang nais mong burahin ang produktong "${productId}" mula sa database?`)) return;
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
    snap.forEach(doc => {
      const data = doc.data();
      branchProducts.push({ id: doc.id, ...data });
    });
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
            <span>🥢 ${loosePrice} / ${looseUOM}</span>
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
    await db.collection('orders').doc(orderId).set({
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
  if (!confirm(`Sigurado ka bang nais mong burahin ang produktong "${productId}"?`)) return;
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

        rowsHtml += `
          <tr>
            <td><b>${ord.orderId || doc.id}</b><br><small style="color: #64748b;">Target: ${ord.targetDeliveryDate || 'ASAP'}</small></td>
            <td>${(ord.items || []).length} item(s)</td>
            <td><b>₱${parseFloat(ord.totalAmount || 0).toFixed(2)}</b></td>
            <td>${statusBadge}</td>
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
  if (window.KUSINA_PERMS && !canViewModule(viewName)) {
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
  if (!confirm(`BABALA: Iba-rollback ang buong Product Masterlist sa bersyon ng backup (${backupDocId}). Sigurado ka ba?`)) return;
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

    const headers = "POS_Code,SAP_Item_Code,Barcode,Item_Description,Commissary_Hub,Storage_Station,Whole_UOM,Loose_UOM,Whole_Price,Loose_Price,Conversion_Factor,Buffer_Limit,Packaging_Instructions\n";
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

      rows += `"${pos}","${sap}","${bar}","${name}","${hub}","${st}","${wu}","${lu}",${wp},${lp},${conv},${buf},"${pack}"\n`;
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
  if (!confirm("Kumpirmahin: Aprubahan ang cancellation ng order na ito bilang Admin?")) return;
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
    if (!confirm('Kumpirmahin: I-deklara ang sira bilang Inventory Loss at hindi sisingilin sa Branch?')) return;
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
    if (!confirm('Kumpirmahin: I-reopen ang PO upang maihanda muli ng Commissary ang replacement?')) return;
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
    if (!confirm('Kumpirmahin: Kanselahin nang tuluyan ang buong PO?')) return;
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

  const conf = prompt(`⚠️ BABALA SA PAG-TRUNCATE:
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

    if (!confirm(`Na-download ang backup (${snap.size} dokumento).\n\nSigurado ka pa rin bang buburahin ang "${collectionName}"? Hindi na ito mababawi maliban sa backup file.`)) {
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
    alert(`✅ Tagumpay! Na-truncate na ang "${collectionName}" (${snap.size} dokumento ang nabura). Itabi ang backup file.`);
    location.reload();
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

function notifyUserOfUpdate() {
  const confirmUpdate = confirm('🚀 May bagong update ang KusinaERP!\n\nPindutin ang "OK" upang i-restart at i-apply ang pinakabagong update.');
  if (confirmUpdate) {
    forceAppUpdateAndRestart();
  }
}

// Function na tatawagin kapag pinindot ang "🔄 I-update ang App" button
async function checkAndTriggerAppUpdate() {
  const confirmRestart = confirm('🔄 I-UPDATE AT I-RESTART ANG APP?\n\nKukunin ng system ang pinakabagong bersyon mula sa server at magre-reload ang app upang ma-apply ang lahat ng pagbabago (Branding, Logo, Code).\n\nNais mo bang magpatuloy?');
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
  if (!confirm("Siguradong burahin ang tauhan na ito?")) return;
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

  const reason = prompt("Ano ang dahilan ng pag-cancel ng order na ito mula sa planta?");
  if (!reason) return;

  if (!confirm(`Sigurado ka bang gusto mong i-cancel ang PO-${order.orderId || order.id}?
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

  if (!confirm(`Tatanggapin ba ang Cancellation Request ng Branch para sa PO-${order.orderId || order.id}?`)) return;

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
  
  if (!confirm('Tanggihan ang cancellation at ituloy ang pag-prepare ng order?')) return;

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

  if (!confirm('Idagdag (i-merge) ang pahabol item sa orihinal na order basket at ibawas sa inventory?')) return;

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
  if (!confirm('Tanggihan ang pahabol request?')) return;

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
      if (short.length && !confirm(`⚠️ KULANG ANG STOCK SA:\n${formatShortages(short)}\n\nITULOY pa rin ang pag-accept? (Magiging negative ang stock ng mga item na ito.)`)) return;
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

  if (!confirm(`I-dispatch na ang order na ito gamit ang: ${drvName}?`)) return;

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
  if (!confirm(`Kumpirmahin: I-approve at I-DEDUCT ang ${wQty}W / ${lQty}L ng ${itemName} sa inventory ng planta?`)) return;
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
  if (!confirm('I-reject ang spoilage report na ito?')) return;
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
    const statBadge = po.status === 'Draft' ? '<span class="badge badge-secondary">Draft</span>' : 
                     (po.status === 'Sent to Vendor' ? '<span class="badge badge-warning">Sent to Vendor</span>' :
                     '<span class="badge badge-success">Received / AP</span>');
                     
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
          ${po.status === 'Sent to Vendor' ? `<button class="btn btn-sm btn-success" style="font-weight:bold;" onclick="openReceivePOModal('${po.id}')">📦 Receive</button>` : ''}
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
  
  if (!confirm('I-save ang Purchase Order na ito?')) return;
  
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
      status: 'Sent to Vendor',
      createdBy: userName,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    
    await logSystemAction('VENDOR_PO_CREATED', `Gumawa ng PO (${poNum}) para sa vendor na ${vName}. Total: ₱${gTotal}`);
    alert(`✅ Matagumpay na na-save ang ${poNum}!`);
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
    vSel.value = po.vendorName;
    vSel.disabled = true;
  }
  
  const dInp = document.getElementById('po-order-date');
  dInp.value = po.orderDate;
  dInp.disabled = true;
  
  poCartItems = po.items || [];
  renderPOCart();
  
  const auditBox = document.getElementById('po-audit-trail-box');
  auditBox.style.display = 'block';
  document.getElementById('po-audit-creator').innerText = po.createdBy || 'Unknown';
  document.getElementById('po-audit-time').innerText = po.createdAt ? new Date(po.createdAt.toDate ? po.createdAt.toDate() : po.createdAt).toLocaleString() : 'N/A';
  
  document.getElementById('vendor-po-modal').style.display = 'flex';
}

function closeVendorPOModal() {
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

  if (!confirm('I-save ang Actual Received Quantities? Awtomatiko nitong ia-update ang INVENTORY STOCK at ipapasok sa Accounts Payable (AP).')) return;

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
      if (poSnap.data().receivedAt) throw new Error('Na-receive na ang PO na ito dati pa. Hindi na puwedeng i-receive ulit para hindi madoble ang stock.');

      const prodRefs = recvItems.map(it => db.collection('products').doc(it.productId || it.itemCode));
      const prodSnaps = await Promise.all(prodRefs.map(r => tx.get(r)));
      const missingNames = recvItems.filter((it, idx) => !prodSnaps[idx].exists).map(it => it.itemName || it.itemCode);
      if (missingNames.length) throw new Error('Walang product record para sa: ' + missingNames.join(', '));

      // 1. Update PO Status to AP
      tx.update(poRef, {
        status: 'Received / AP',
        actualItems: recvItems,
        actualTotalAmount: actualGrandTotal,
        vendorInvoiceNo: invNo,
        receivedBy: userName,
        receivedAt: firebase.firestore.FieldValue.serverTimestamp()
      });

      // 2. Update Inventory Stock + movement log
      recvItems.forEach((item, idx) => {
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
      <td><b>${ap.poNumber}</b><br><small style="color: #b91c1c;">INV: ${ap.vendorInvoiceNo || '--'}</small></td>
      <td><b>${ap.vendorName}</b></td>
      <td>${rcvDate}</td>
      <td style="color: #64748b;"><s>${expTotal}</s></td>
      <td><b style="color: #059669; font-size: 1.05rem;">${actTotal}</b></td>
      <td><span class="badge ${badgeClass}">${st}</span></td>
      <td>
        <select onchange="updateAPPOStatus('${ap.id}', this.value)" style="font-size: 0.8rem; padding: 0.3rem 0.5rem; border-radius: 4px; border: 1px solid #cbd5e1;">
          <option value="Received / AP" ${st === 'Received / AP' ? 'selected' : ''}>1. Received / AP Pending</option>
          <option value="For Check Preparation" ${st === 'For Check Preparation' ? 'selected' : ''}>2. For Check Preparation</option>
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
    let posted = false;

    await db.runTransaction(async tx => {
      const poSnap = await tx.get(poRef);
      if (!poSnap.exists) throw new Error('Hindi nahanap ang PO.');
      const po = poSnap.data();

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
            credit: parseFloat(po.actualTotalAmount || 0),
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
  
  const filtered = hrEmployees.filter(e => (e.name||'').toLowerCase().includes(q) || (e.role||'').toLowerCase().includes(q));
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
      <td><b>${e.name}</b></td>
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

function addOtherEmployeeDoc() {
  const label = (prompt('Anong dokumento ito? (hal. Diploma, Training Certificate)') || '').trim();
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
  if (!confirm(`Burahin ang "${d.label || docId}" (${d.fileName || ''})? Hindi na ito mababawi.`)) return;
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
      
      document.getElementById('hr-emp-company').value = e.company || '';
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
    
    company: document.getElementById('hr-emp-company').value.trim(),
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
  const conf = confirm(`⚠️ KUMPIRMASYON NG RELEASE PAYOUT:
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
    apSnap.forEach(d => totalAP += parseFloat(d.data().actualTotalAmount || 0));
    
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
  if(!confirm('Burahin ang vendor na ito?')) return;
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
    filterAdminCustomers();
  } catch(e) { console.error(e); }
}

function filterAdminCustomers() {
  const tbody = document.getElementById('admin-customers-tbody');
  const q = document.getElementById('admin-customer-search')?.value.toLowerCase() || '';
  if(!tbody) return;
  const filtered = allCustomers.filter(c => (c.name||'').toLowerCase().includes(q));
  if(filtered.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align: center;">Walang customer na nahanap.</td></tr>';
    return;
  }
  let html = '';
  filtered.forEach(c => {
    html += `<tr>
      <td><b>${c.name}</b></td>
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
      document.getElementById('customer-address').value = c.address || '';
      document.getElementById('customer-contact').value = c.contact || '';
      document.getElementById('customer-bank').value = c.bank || '';
      document.getElementById('customer-type').value = c.type || 'Retail';
      document.getElementById('customer-modal-title').innerText = '✏️ Edit Customer';
    }
  } else {
    document.getElementById('customer-id').value = '';
    document.getElementById('customer-name').value = '';
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
  if(!confirm('Burahin ang customer na ito?')) return;
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

  if (!confirm(`Tatanggapin ang ${qty} ${uomType==='whole'?prod.wholeUOM:prod.looseUOM} ng ${prod.itemName} mula kay ${vName}?

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
  const c = prompt("Ilagay ang Beginning Balance para sa CASH ON HAND (₱):", "0");
  if (c === null) return;
  const b = prompt("Ilagay ang Beginning Balance para sa BANK ACCOUNT (₱):", "0");
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
  const pin = prompt("🚨 ADMIN Z-READING RESET 🚨\n\nBurahin lahat ng transaction sa General Ledger at i-reset sa ZERO ang AP Invoices?\nI-type ang 'RESET' para mag-confirm:");
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
          <div style="border-bottom: 1px solid #0f172a; margin-bottom: 5px; font-weight: 700; min-height: 18px;">${poCheckerName || '&nbsp;'}</div>
          <b>VERIFIED & CHECKED BY</b><br>
          <small style="color: #64748b;">${poCheckerTitle || 'Commissary / Supply Chain Head'}</small>
        </div>
        <div>
          <div style="border-bottom: 1px solid #0f172a; margin-bottom: 5px; font-weight: 700; min-height: 18px;">${poApproverName || '&nbsp;'}</div>
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
  if(!confirm('Burahin ang BOM na ito?')) return;
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
    if (!confirm('Execute Work Order? Ito ay agad na magbabawas sa iyong Raw Materials.' + warn)) return;

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
  { key: 'comm_receiving',native: 'commissary', group: 'Commissary Page — Mga Aksyon', label: '📥 Direct Receiving mula sa vendor', fns: ['openDirectReceivingModal', 'submitDirectReceiving'] },
  { key: 'comm_spoilage', native: 'commissary', group: 'Commissary Page — Mga Aksyon', label: '🗑️ Mag-report ng Spoilage', fns: ['openCommissarySpoilageModal', 'submitSpoilageReport'] },
  // ---- Branch page: mga pahina ----
  { key: 'bv_dashboard',  native: 'branch', group: 'Branch Page — Mga Menu', label: '📊 Makita ang Dashboard', sel: ["[onclick*=\"switchBranchView('dashboard')\"]"], view: 'dashboard' },
  { key: 'bv_order',      native: 'branch', group: 'Branch Page — Mga Menu', label: '🛒 Makita ang Place Order', sel: ["[onclick*=\"switchBranchView('order')\"]"], view: 'order' },
  { key: 'bv_deliveries', native: 'branch', group: 'Branch Page — Mga Menu', label: '🚚 Makita ang My Deliveries', sel: ["[onclick*=\"switchBranchView('deliveries')\"]"], view: 'deliveries' },
  // ---- Branch page: mga aksyon ----
  { key: 'br_order',      native: 'branch', group: 'Branch Page — Mga Aksyon', label: '🛍️ Mag-place ng order', fns: ['openOrderModal', 'submitBranchOrder', 'submitBranchOrderFromModal'] },
  { key: 'br_receive',    native: 'branch', group: 'Branch Page — Mga Aksyon', label: '📝 Tumanggap / pumirma ng delivery (e-POD)', fns: ['submitFinalReceivingProof'] },
  { key: 'br_cancel',     native: 'branch', group: 'Branch Page — Mga Aksyon', label: '❌ Mag-request ng cancel', fns: ['openBranchCancelModal', 'submitBranchCancelRequest'] },
  { key: 'br_pahabol',    native: 'branch', group: 'Branch Page — Mga Aksyon', label: '➕ Mag-request ng Pahabol', fns: ['openBranchPahabolModal', 'submitBranchPahabol'] },
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
  document.querySelectorAll('.sidebar-menu .menu-item[data-module]').forEach(a => {
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
  if (!acPickedEmail || !confirm('Alisin lahat ng exception ng user na ito? Susundin na niya ang role niya.')) return;
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
  if (!confirm('Tanggalin ang hub na ito sa listahan? (Hindi nito binubura ang mga produkto.)')) return;
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
  'admin-item-hub': 'hubs', 'bom-hub': 'hubs'
};
const FORCE_SEARCH_IDS = ['mfg-hub-filter', 'admin-item-supplier', 'new-item-supplier', 'lot-product-select', 'pay-emp-select', 'po-uom-select', 'bom-rm-uom'];

async function addMasterEntry(kind, name) {
  if (!db) throw new Error('Walang database.');
  const safe = name.replace(/[\/#?]/g, '-');
  if (kind === 'stations') await db.collection('storage_stations').doc(safe).set({ name: name, createdAt: firebase.firestore.FieldValue.serverTimestamp() });
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
      o.textContent = (kind === 'stations' ? '📍 ' : kind === 'hubs' ? '🏢 ' : kind === 'uom_whole' ? '📦 ' : '🥢 ') + it.name;
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
  d.write(`<!doctype html><html><head><meta charset="utf-8"><title>${srchEsc(title)}</title><style>${PRINT_CSS}</style></head><body>${bodyHtml}</body></html>`);
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
  const price = p ? (i.uom === 'Whole' ? p.wholePrice : p.loosePrice) : i.unitPrice;
  return { unit: parseFloat(price || 0), uom: bomUomName(i) };
}
function bomReportData(bom, mult) {
  const m = mult > 0 ? mult : 1;
  const lines = (bom.ingredients || []).map(i => { const c = bomLineCost(i); const qty = i.qty * m; return { name: i.itemName, code: i.itemCode, qty: qty, uom: c.uom, unit: c.unit, cost: qty * c.unit }; });
  const total = lines.reduce((s, l) => s + l.cost, 0);
  const out = (bom.yieldQty || 1) * m;
  return { lines, total, out, perUnit: out > 0 ? total / out : 0, m };
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
    <tr class="total"><td colspan="6" class="num">Gastos bawat unit (${r.out} units)</td><td class="num">${fmt(r.perUnit)}</td></tr></tbody></table>
    ${bom.notes ? `<h2>Paraan ng Paggawa / Notes</h2><div class="box">${srchEsc(bom.notes)}</div>` : ''}
    <div class="sign"><div>Inihanda ni</div><div>Sinuri ni</div></div></div>`;
}
function viewBomReport(bomId) {
  const bom = bomRecipes.find(b => b.id === bomId);
  if (!bom) { alert('Hindi nahanap ang recipe. I-refresh muna ang listahan.'); return; }
  bomReportCtx = { id: bomId, mult: 1 };
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
      <tr style="font-weight:800;background:#ecfdf5;"><td colspan="4" style="text-align:right;">Gastos bawat unit</td><td>${fmt(r.perUnit)}</td></tr></tbody>
    </table></div>
    ${bom.notes ? `<div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:0.6rem;margin-top:0.75rem;white-space:pre-wrap;font-size:0.85rem;"><b>Paraan ng Paggawa:</b>\n${srchEsc(bom.notes)}</div>` : ''}
    <div style="display:flex;gap:0.5rem;margin-top:1rem;flex-wrap:wrap;">
      <button class="btn btn-primary" onclick="printBomReport()">🖨️ Print</button>
      <button class="btn btn-secondary" onclick="exportBomReportCSV()">⬇️ CSV</button>
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
  if (!confirm(`I-import ang ${list.length} recipe? (Kapag may kaparehong FG_Code na, papalitan ang sangkap nito.)` + (problems.length ? `\n\n⚠️ ${problems.length} row ang lalaktawan:\n` + problems.slice(0, 8).join('\n') : ''))) return;
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
    header: 'Customer_Name,Address,Contact,Bank_Details,Customer_Type\r\nJuan Store,Manila,09181234567,BDO 1234,Retail\r\n',
    map: r => ({ name: r.customer_name || r.name, address: r.address || '', contact: r.contact || '', bank: r.bank_details || r.bank || '', type: r.customer_type || r.type || 'Retail' }),
    reload: () => typeof loadAdminCustomers === 'function' && loadAdminCustomers() }
};
function downloadImportTemplate(kind) { const k = IMPORT_KINDS[kind]; if (k) downloadCSVFile(k.header, k.file); }
async function importCSVFor(kind) {
  const k = IMPORT_KINDS[kind]; if (!k) return;
  const text = await pickCSVFile(); if (!text) return;
  const rows = csvToObjects(text).map(k.map).filter(x => x.name);
  if (!rows.length) { alert('Walang valid na row. Gamitin ang Template para sa tamang column.'); return; }
  if (!confirm(`I-import ang ${rows.length} ${k.label}? (Ia-update ang may kaparehong pangalan, dadagdagan ang bago.)`)) return;
  try {
    const snap = await db.collection(k.col).get();
    const existing = {}; snap.forEach(d => { existing[hubKey(d.data().name)] = d.id; });
    let batch = db.batch(), n = 0, added = 0, updated = 0;
    for (const r of rows) {
      const id = existing[hubKey(r.name)];
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
  const r = customRolesState[id]; if (!r || !confirm(`Burahin ang role "${r.name}"? Mananatili sa mga user ang kasalukuyang permissions nila pero wala na silang role label.`)) return;
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
// 📄 PAGE BOOTSTRAP (dating inline <script> ng bawat HTML — ngayon dito na lahat)
// Ang <body> ng bawat page ay may class: page-admin | page-branch | page-commissary
// ========================================================

// Admin: active menu highlight
function setActiveMenu(element) {
  document.querySelectorAll('.menu-item').forEach(el => el.classList.remove('active'));
  element.classList.add('active');
  if (window.innerWidth <= 1024) {
    const sb = document.getElementById('app-sidebar');
    if (sb) sb.classList.remove('open');
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
