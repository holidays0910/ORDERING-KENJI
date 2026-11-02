
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

// KusinaERP Central Universal Script (app.js)
// Centralized Auth, Admin, Commissary, Branch, and Station-by-Station Picking Guide System.

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
  const stationSelect = document.getElementById('admin-item-station');
  const wholeSelect = document.getElementById('admin-item-whole-uom');
  const looseSelect = document.getElementById('admin-item-loose-uom');
  const wholePriceInput = document.getElementById('admin-item-whole-price');
  const loosePriceInput = document.getElementById('admin-item-loose-price');
  const convInput = document.getElementById('admin-item-conversion');
  const bufferInput = document.getElementById('admin-item-buffer');
  const packInput = document.getElementById('admin-item-packaging');

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
    if (hubInput) hubInput.value = prod.commissarySource || 'Central Hub';
    if (stationSelect) stationSelect.value = prod.storageStation || '';
    if (wholeSelect) wholeSelect.value = prod.wholeUOM || '';
    if (looseSelect) looseSelect.value = prod.looseUOM || '';
    if (wholePriceInput) wholePriceInput.value = prod.wholePrice || 0;
    if (loosePriceInput) loosePriceInput.value = prod.loosePrice || 0;
    if (convInput) convInput.value = prod.conversionFactor || 1;
    if (bufferInput) bufferInput.value = prod.bufferLimit || 5;
    if (packInput) packInput.value = prod.packagingInstructions || '';
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
    if (hubInput) hubInput.value = 'Central Hub';
    if (stationSelect) stationSelect.value = '';
    if (wholeSelect) wholeSelect.value = '';
    if (looseSelect) looseSelect.value = '';
    if (wholePriceInput) wholePriceInput.value = 0;
    if (loosePriceInput) loosePriceInput.value = 0;
    if (convInput) convInput.value = 1;
    if (bufferInput) bufferInput.value = 5;
    if (packInput) packInput.value = '';
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
      storageStation: station || 'Unassigned',
      wholeUOM: wholeUOM || 'Box',
      looseUOM: looseUOM || 'Pcs',
      wholePrice: wholePrice,
      loosePrice: loosePrice,
      conversionFactor: conv,
      bufferLimit: buffer,
      packagingInstructions: packInst,
      supplier: document.getElementById('admin-item-supplier') ? document.getElementById('admin-item-supplier').value : '',
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    // Kung binago ang SAP Code sa Edit Mode, burahin ang lumang document key
    if (origDocId && origDocId !== code) {
      await db.collection('products').doc(origDocId).delete();
    }

    await db.collection('products').doc(code).set(payload, { merge: true });
    await logSystemAction('PRODUCT_UPDATED', `Nag-save/edit ng produkto: ${code} (${name})`);

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

      if (u.role === 'admin' || !prodHub || prodHub.includes(userHub) || userHub.includes(prodHub)) {
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

    if (origDocId && origDocId !== code) {
      await db.collection('products').doc(origDocId).delete();
    }

    await db.collection('products').doc(code).set(payload, { merge: true });
    await logSystemAction('PRODUCT_UPDATED', `Nag-save/edit ng produkto mula planta: ${code} (${name})`);

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
    await db.collection('products').doc(docId).update({
      stockWhole: firebase.firestore.FieldValue.increment(addQty)
    });
    logSystemAction('STOCK_ADJUSTED', `Nagdagdag ng +${addQty} stock sa produkto: ${docId}`);
    loadCommissaryInventory();
  } catch (e) {
    console.warn(e);
  }
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
  }, 1000);
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
  orderCart.forEach(item => {
    grandTotal += item.subtotal;
  });

  const totalStr = '₱' + grandTotal.toFixed(2);

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

  let grandTotal = 0;
  orderCart.forEach(item => {
    grandTotal += item.subtotal;
  });

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
  } else if (viewName === 'products') {
    const el = document.getElementById('view-admin-products');
    if (el) el.style.display = 'block';
    loadAdminProducts();
  } else if (viewName === 'stations') {
    const el = document.getElementById('view-admin-stations');
    if (el) el.style.display = 'block';
    loadStorageStations();
    loadUOMs();
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

  applyBrandingToUI(localName, localSub, localLogo, localTin, localAddr, localContact);

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
      
      localStorage.setItem('kusina_brand_name', bName);
      localStorage.setItem('kusina_brand_subtitle', bSub);
      if (bLogo) localStorage.setItem('kusina_brand_logo', bLogo);
      localStorage.setItem('kusina_brand_tin', bTin);
      localStorage.setItem('kusina_brand_address', bAddr);
      localStorage.setItem('kusina_brand_contact', bContact);
      
      applyBrandingToUI(bName, bSub, bLogo, bTin, bAddr, bContact);
    }
  } catch (err) {
    console.warn('Branding sync warning:', err);
  }
}

function applyBrandingToUI(brandName, brandSubtitle, brandLogo = null, brandTin = '', brandAddress = '', brandContact = '') {
  const currentLogo = brandLogo !== null ? brandLogo : (localStorage.getItem('kusina_brand_logo') || '');
  const currentName = brandName || localStorage.getItem('kusina_brand_name') || 'KusinaERP';
  const currentSub = brandSubtitle || localStorage.getItem('kusina_brand_subtitle') || 'Secured Enterprise Portal (Firebase Auth & Firestore)';
  const currentTin = brandTin || localStorage.getItem('kusina_brand_tin') || '';
  const currentAddr = brandAddress || localStorage.getItem('kusina_brand_address') || '';
  const currentContact = brandContact || localStorage.getItem('kusina_brand_contact') || '';

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
  const fileInput = document.getElementById('setting-brand-logo');
  const saveBtn = document.querySelector('button[onclick="saveSystemBranding()"]');

  const brandName = (inputName ? inputName.value.trim() : '') || 'KusinaERP';
  const brandSubtitle = (inputSub ? inputSub.value.trim() : '') || 'Secured Enterprise Portal (Firebase Auth & Firestore)';
  const brandTin = inputTin ? inputTin.value.trim() : '';
  const brandAddr = inputAddr ? inputAddr.value.trim() : '';
  const brandContact = inputContact ? inputContact.value.trim() : '';
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
      if (finalLogo) {
        localStorage.setItem('kusina_brand_logo', finalLogo);
      }

      applyBrandingToUI(brandName, brandSubtitle, finalLogo, brandTin, brandAddr, brandContact);

      if (typeof db !== 'undefined' && db) {
        await db.collection('system_settings').doc('branding').set({
          brandName: brandName,
          brandSubtitle: brandSubtitle,
          brandTin: brandTin,
          brandAddress: brandAddr,
          brandContact: brandContact,
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
      getNextSINumber().then(nextSi => {
        siInput.value = nextSi;
        saveModalSIAndPO(); 
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
      
      html += `<tr>
        <td><b>${pos}</b><br><small>${sap}</small></td>
        <td><b>${i.itemName}</b><br><span class="badge badge-admin">📍 ${i.storageStation || 'Unassigned'}</span></td>
        <td>${wQty} ${i.wholeUOM || 'Whole'}</td>
        <td>${lQty} ${i.looseUOM || 'Loose'}</td>
        <td>₱${wPrice}/W | ₱${lPrice}/L</td>
        <td><b>₱${sub.toFixed(2)}</b></td>
      </tr>`;
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
  
  if (siInput && poInput) {
    try {
      const siVal = siInput.value.trim();
      const poVal = poInput.value.trim();
      
      await db.collection('orders').doc(activeCommissaryOrderId).update({
        siNumber: siVal,
        manualPoNumber: poVal,
        poNumber: poVal // for print
      });
      
      // I-update ang SI Sequence kung nagsisimula sa "SI-"
      if (siVal.startsWith('SI-')) {
        const numPart = parseInt(siVal.replace('SI-', ''), 10);
        if (!isNaN(numPart)) {
           await db.collection('system_settings').doc('invoice_sequence').set({
             lastSI: numPart
           }, { merge: true });
        }
      }
      
      // Update local memory
      const order = currentOrders.find(o => o.id === activeCommissaryOrderId);
      if (order) {
        order.siNumber = siVal;
        order.manualPoNumber = poVal;
        order.poNumber = poVal;
      }
      
      if (ind) {
        logSystemAction('SI_PO_UPDATED', `Binago ang SI/PO details ng order: ${activeCommissaryOrderId}`);
        ind.style.display = 'flex';
        setTimeout(() => ind.style.display = 'none', 2000);
      }
    } catch (e) {
      console.warn("Failed saving SI/PO", e);
    }
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
    await db.collection('orders').doc(orderId).update({
      status: 'Cancelled & Approved by Admin',
      approvedCancellationBy: getCurrentUser() ? getCurrentUser().email : 'Admin',
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    logSystemAction('ORDER_CANCELLED_ADMIN', `Sapilitang kinansela ni Admin ang PO: ${orderId}`);
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
  if (!u || u.role !== 'admin') {
    alert('Access Denied: Si Head Office Admin lamang ang may karapatang mag-truncate ng data.');
    return;
  }

  const promptMsg = `⚠️ BABALA SA PAG-TRUNCATE:
Nais mo bang linisin (i-truncate) ang buong "${collectionName.toUpperCase()}" collection?

Mabubura ang lahat ng test records nito. Hindi magagalaw ang Users at Logins.
I-type ang "DELETE" upang kumpirmahin:`;

  const conf = prompt(promptMsg);
  if (conf !== 'DELETE') {
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

    const batch = db.batch();
    snap.forEach(doc => {
      batch.delete(doc.ref);
    });
    await batch.commit();

    logSystemAction('DATA_TRUNCATED', `BINURA ni Admin ang buong collection na: ${collectionName}`);
    alert(`✅ Tagumpay! Na-truncate na ang "${collectionName}" (${snap.size} dokumento ang nabura).`);
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
Babalik sa inventory ang mga naibawas na stock (kung mayroon man).`)) return;

  try {
    const batch = db.batch();
    const orderRef = db.collection('orders').doc(activeCommissaryOrderId);

    // Ibalik ang imbentaryo DAHIL naka-prepare na (kung nag-bawas na ang system noong ni-swipe to preparing)
    // TANDAAN: Depende sa logic mo, baka binabawas lang sa inventory kapag DISPATCHED o PREPARING. 
    // Para sigurado, ibabalik natin ang item qty.
    if (order.status !== 'Pending Preparation') {
      (order.items || []).forEach(item => {
        const prodRef = db.collection('products').doc(item.itemCode || item.id);
        batch.update(prodRef, {
          stockWhole: firebase.firestore.FieldValue.increment(parseFloat(item.wholeQty || 0)),
          stockLoose: firebase.firestore.FieldValue.increment(parseFloat(item.looseQty || 0))
        });
      });
    }

    batch.update(orderRef, {
      status: 'Cancelled by Commissary',
      cancellationReason: reason,
      cancelledByRole: 'Commissary Head',
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    await batch.commit();
    logSystemAction('ORDER_CANCELLED_COMMISSARY', `Kinansela mula sa planta ang PO: ${activeCommissaryOrderId}. Dahilan: ${reason}`);
    alert(`✅ Nakansela na ang order. Naibalik na sa inventory ang mga stocks.`);
    
    closeCommissaryOrderModal();
    loadIncomingOrders();
    loadCommissaryInventory();
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
    const batch = db.batch();
    const orderRef = db.collection('orders').doc(activeCommissaryOrderId);

    if (order.status !== 'Pending Preparation') {
      (order.items || []).forEach(item => {
        const prodRef = db.collection('products').doc(item.itemCode || item.id);
        batch.update(prodRef, {
          stockWhole: firebase.firestore.FieldValue.increment(parseFloat(item.wholeQty || 0)),
          stockLoose: firebase.firestore.FieldValue.increment(parseFloat(item.looseQty || 0))
        });
      });
    }

    batch.update(orderRef, {
      status: 'Cancelled & Approved by Commissary',
      cancellationRequested: false, // cleared
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    await batch.commit();
    logSystemAction('CANCEL_REQUEST_APPROVED', `In-approve ng commissary ang cancel request para sa PO: ${activeCommissaryOrderId}`);
    alert(`✅ Na-approve ang pag-cancel ng branch. Naibalik na sa inventory ang mga naibawas.`);
    
    closeCommissaryOrderModal();
    loadIncomingOrders();
    loadCommissaryInventory();
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
    
    // deduct from inventory if we are already preparing
    if (order.status !== 'Pending Preparation') {
      const prodRef = db.collection('products').doc(pahabol.itemCode);
      batch.update(prodRef, {
        stockWhole: firebase.firestore.FieldValue.increment(-parseFloat(pahabol.requestedWholeQty || 0)),
        stockLoose: firebase.firestore.FieldValue.increment(-parseFloat(pahabol.requestedLooseQty || 0))
      });
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
    await db.collection('orders').doc(activeCommissaryOrderId).update({
      status: 'Preparing at Stations',
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    logSystemAction('ORDER_ACCEPTED', `Tinanggap at inihahanda na sa planta ang PO: ${activeCommissaryOrderId}`);
    alert('✅ Tinanggap na ang order para ihanda!');
    closeCommissaryOrderModal();
    loadIncomingOrders();
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
    const batch = db.batch();
    const reqRef = db.collection('spoilage_requests').doc(reqId);
    const prodRef = db.collection('products').doc(productId);
    
    batch.update(reqRef, {
      status: 'Approved & Deducted by Admin',
      resolvedAt: firebase.firestore.FieldValue.serverTimestamp(),
      resolvedBy: getCurrentUser()?.name || 'Admin'
    });
    
    batch.update(prodRef, {
      stockWhole: firebase.firestore.FieldValue.increment(-wQty),
      stockLoose: firebase.firestore.FieldValue.increment(-lQty)
    });
    
    await batch.commit();
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
        <div style="display: flex; gap: 0.25rem;">
          <button class="btn btn-sm btn-primary" onclick="viewVendorPO('${po.id}')">🔍 View</button>
          ${po.status === 'Sent to Vendor' ? `<button class="btn btn-sm btn-success" style="font-weight:bold;" onclick="openReceivePOModal('${po.id}')">📦 Receive</button>` : ''}
        </div>
      </td>
    </tr>`;
  });
  tbody.innerHTML = html;
}

function openCreatePOModal() {
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
  
  // Populate vendors
  const vSel = document.getElementById('po-vendor-select');
  vSel.disabled = false;
  vSel.innerHTML = '<option value="">-- Pumili ng Vendor --</option>';
  adminVendorList.forEach(v => {
    vSel.innerHTML += `<option value="${v.name}">${v.name}</option>`;
  });

  poCartItems = [];
  renderPOCart();
  
  document.getElementById('vendor-po-modal').style.display = 'flex';
}

async function onPOVendorChange() {
  const vName = document.getElementById('po-vendor-select').value;
  document.getElementById('po-active-vendor-name').innerText = vName || '--';
  
  const pSel = document.getElementById('po-product-select');
  const uSel = document.getElementById('po-uom-select');
  const cInp = document.getElementById('po-unit-cost');
  
  if (!vName) {
    pSel.disabled = true; pSel.innerHTML = '<option value="">-- Pumili Muna ng Vendor --</option>';
    uSel.disabled = true; cInp.disabled = true;
    return;
  }

  pSel.disabled = false;
  pSel.innerHTML = '<option value="">Kinukuha ang produkto...</option>';
  
  // Query products tied to this vendor
  try {
    const snap = await db.collection('products').where('supplier', '==', vName).get();
    poFilteredProducts = [];
    snap.forEach(d => { poFilteredProducts.push({ id: d.id, ...d.data() }); });
    
    if (poFilteredProducts.length === 0) {
      pSel.innerHTML = '<option value="">Walang naka-tag na produkto kay ' + vName + '</option>';
      uSel.disabled = true; cInp.disabled = true;
      return;
    }
    
    pSel.innerHTML = '<option value="">-- Pumili ng Item --</option>';
    poFilteredProducts.forEach(p => {
      pSel.innerHTML += `<option value="${p.id}">${p.itemName} (${p.sapCode || p.id})</option>`;
    });
    
  } catch (err) {
    console.error(err);
    pSel.innerHTML = '<option value="">Error sa pagkuha.</option>';
  }
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
  
  document.getElementById('po-view-mode').value = 'view';
  document.getElementById('vendor-po-modal-title').innerText = '🔍 Tingnan ang Purchase Order';
  document.getElementById('vendor-po-modal-subtitle').innerText = 'PO Number: ' + po.poNumber;
  document.getElementById('po-add-product-section').style.display = 'none';
  document.getElementById('btn-save-vendor-po').style.display = 'none';
  document.getElementById('po-table-action-header').style.display = 'none';
  
  const vSel = document.getElementById('po-vendor-select');
  vSel.innerHTML = `<option>${po.vendorName}</option>`;
  vSel.disabled = true;
  
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
    
    // Compute subtotal on the fly for display
    const wQty = parseFloat(i.actualWholeQty || 0);
    const lQty = parseFloat(i.actualLooseQty || 0);
    // Note: Cost is based on what was ordered. If they ordered whole, unit cost is whole cost. 
    // If we mix whole/loose in actuals, we need the raw product data, but for simplicity, we assume actual qty corresponds to the unit cost, 
    // OR we just use the selected UOM cost. Let's strictly calculate based on original UOM type.
    
    // Simplification for the actual subtotal:
    // If they change actual qty, we just multiply by unitCost. We assume they input the quantity in the SAME UOM they ordered.
    // To match user prompt: "Input mo kung ilan yung dumating... Icompute niya uli yung total nun."
    let actualSub = 0;
    if (i.uomType === 'whole') {
        actualSub = wQty * cost;
        i.actualLooseQty = 0; // Lock loose if ordered whole
    } else {
        actualSub = lQty * cost;
        i.actualWholeQty = 0;
    }
    i.actualSubtotal = actualSub;
    gTotal += actualSub;

    const subStr = actualSub.toLocaleString('en-PH', { style: 'currency', currency: 'PHP' });
    const costStr = cost.toLocaleString('en-PH', { style: 'currency', currency: 'PHP' });

    html += `<tr id="recv-row-${idx}">
      <td><b style="font-size: 0.95rem;">${i.itemName}</b><br><small style="font-family: monospace; color: #64748b;">${i.itemCode}</small></td>
      <td><b style="color: #059669;">${expected}</b></td>
      <td><input type="number" value="${i.actualWholeQty}" min="0" step="0.5" style="width: 100%; text-align: center; padding: 0.25rem;" oninput="updateReceiveQty(${idx}, 'whole', this.value)" ${i.uomType !== 'whole' ? 'disabled' : ''}></td>
      <td><input type="number" value="${i.actualLooseQty}" min="0" step="0.5" style="width: 100%; text-align: center; padding: 0.25rem;" oninput="updateReceiveQty(${idx}, 'loose', this.value)" ${i.uomType !== 'loose' ? 'disabled' : ''}></td>
      <td>${costStr} / ${i.uomText}</td>
      <td style="text-align: right;"><b style="color: #0f172a;">${subStr}</b></td>
    </tr>`;
  });

  tbody.innerHTML = html;
  document.getElementById('recv-po-grand-total').innerText = gTotal.toLocaleString('en-PH', { style: 'currency', currency: 'PHP' });
}

function updateReceiveQty(idx, type, val) {
  if (!activeReceivePOData) return;
  const num = parseFloat(val) || 0;
  if (type === 'whole') activeReceivePOData.items[idx].actualWholeQty = num;
  if (type === 'loose') activeReceivePOData.items[idx].actualLooseQty = num;
  renderReceivePOTable();
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
    const batch = db.batch();
    const poRef = db.collection('vendor_pos').doc(activeReceivePOData.id);
    
    // 1. Update PO Status to AP
    batch.update(poRef, {
      status: 'Received / AP',
      actualItems: activeReceivePOData.items,
      actualTotalAmount: actualGrandTotal,
      vendorInvoiceNo: invNo,
      receivedBy: userName,
      receivedAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    // 2. Update Inventory Stock for each item
    activeReceivePOData.items.forEach(item => {
      // Find the product in products collection based on itemCode
      const prodRef = db.collection('products').doc(item.itemCode);
      const incWhole = parseFloat(item.actualWholeQty || 0);
      const incLoose = parseFloat(item.actualLooseQty || 0);
      
      batch.update(prodRef, {
        stockWhole: firebase.firestore.FieldValue.increment(incWhole),
        stockLoose: firebase.firestore.FieldValue.increment(incLoose)
      });
    });

    await batch.commit();
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
    
    const snap = await db.collection('vendor_pos')
      .where('status', '==', 'Received / AP')
      .orderBy('receivedAt', 'desc')
      .limit(100)
      .get();
      
    if (snap.empty) {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; color: #94a3b8;">Walang nakabinbing AP Invoices.</td></tr>';
      return;
    }

    let html = '';
    snap.forEach(doc => {
      const ap = doc.data();
      const rcvDate = ap.receivedAt ? new Date(ap.receivedAt.toDate ? ap.receivedAt.toDate() : ap.receivedAt).toLocaleDateString() : 'N/A';
      const expTotal = parseFloat(ap.totalAmount || 0).toLocaleString('en-PH', { style: 'currency', currency: 'PHP' });
      const actTotal = parseFloat(ap.actualTotalAmount || 0).toLocaleString('en-PH', { style: 'currency', currency: 'PHP' });
      
      html += `<tr>
        <td><b>${ap.poNumber}</b><br><small style="color: #b91c1c;">INV: ${ap.vendorInvoiceNo || '--'}</small></td>
        <td><b>${ap.vendorName}</b></td>
        <td>${rcvDate}</td>
        <td style="color: #64748b;"><s>${expTotal}</s></td>
        <td><b style="color: #059669; font-size: 1.05rem;">${actTotal}</b></td>
        <td><span class="badge badge-warning">Unpaid Payable</span></td>
        <td>
          <button class="btn btn-sm btn-primary">Bayaran (Record Payment)</button>
        </td>
      </tr>`;
    });
    tbody.innerHTML = html;
  } catch (err) {
    console.error('Error loading AP Invoices:', err);
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
    tbody.innerHTML = '<tr><td colspan="6" style="text-align: center;">Loading...</td></tr>';
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
    tbody.innerHTML = '<tr><td colspan="6" style="text-align: center;">Walang empleyado.</td></tr>';
    return;
  }
  
  let html = '';
  filtered.forEach(e => {
    html += `<tr>
      <td><span style="font-family: monospace;">${e.empId || e.id}</span></td>
      <td><b>${e.name}</b></td>
      <td>${e.role} / ${e.dept}</td>
      <td>₱${parseFloat(e.baseSalary||0).toFixed(2)}</td>
      <td><span class="badge badge-${e.status==='Active'?'branch':'secondary'}">${e.status}</span></td>
      <td><button class="btn btn-sm btn-primary" onclick="openEmployeeModal('${e.id}')">Edit</button></td>
    </tr>`;
  });
  tbody.innerHTML = html;
}

function openEmployeeModal(id = null) {
  if (id) {
    const e = hrEmployees.find(x => x.id === id);
    if(e) {
      document.getElementById('hr-emp-id').value = e.id;
      document.getElementById('hr-emp-name').value = e.name;
      document.getElementById('hr-emp-role').value = e.role;
      document.getElementById('hr-emp-dept').value = e.dept;
      document.getElementById('hr-emp-salary').value = e.baseSalary;
      document.getElementById('hr-emp-status').value = e.status || 'Active';
      document.getElementById('hr-emp-title').innerText = '✏️ Edit Employee';
    }
  } else {
    document.getElementById('hr-emp-id').value = '';
    document.getElementById('hr-emp-name').value = '';
    document.getElementById('hr-emp-role').value = '';
    document.getElementById('hr-emp-dept').value = '';
    document.getElementById('hr-emp-salary').value = '0';
    document.getElementById('hr-emp-status').value = 'Active';
    document.getElementById('hr-emp-title').innerText = '➕ Add Employee';
  }
  document.getElementById('hr-employee-modal').style.display = 'flex';
}

async function saveEmployee() {
  const id = document.getElementById('hr-emp-id').value;
  const name = document.getElementById('hr-emp-name').value.trim();
  const role = document.getElementById('hr-emp-role').value.trim();
  const dept = document.getElementById('hr-emp-dept').value.trim();
  const sal = parseFloat(document.getElementById('hr-emp-salary').value || 0);
  const status = document.getElementById('hr-emp-status').value;
  
  if(!name) { alert("Pangalan ay kailangan."); return; }
  
  const payload = { name, role, dept, baseSalary: sal, status, updatedAt: firebase.firestore.FieldValue.serverTimestamp() };
  
  try {
    if (id) {
      await db.collection('employees').doc(id).update(payload);
    } else {
      payload.empId = 'EMP-' + Date.now().toString().slice(-5);
      payload.createdAt = firebase.firestore.FieldValue.serverTimestamp();
      await db.collection('employees').add(payload);
    }
    alert('✅ Na-save ang empleyado!');
    document.getElementById('hr-employee-modal').style.display = 'none';
    loadAdminEmployees();
  } catch(e) { alert(e.message); }
}

// ======================== PAYROLL ========================
let activePayrollEmp = null;

async function loadAdminPayroll() {
  const tbody = document.getElementById('admin-payroll-tbody');
  if(!tbody || !db) return;
  try {
    const snap = await db.collection('payrolls').orderBy('createdAt', 'desc').limit(50).get();
    if(snap.empty) { tbody.innerHTML = '<tr><td colspan="7" style="text-align: center;">Walang records.</td></tr>'; return; }
    let html = '';
    snap.forEach(d => {
      const p = d.data();
      html += `<tr>
        <td><small>${p.period || new Date(p.createdAt?.toDate()).toLocaleDateString()}</small></td>
        <td><b>${p.empName}</b></td>
        <td>₱${(p.gross||0).toFixed(2)}</td>
        <td style="color:red;">-₱${(p.deductions||0).toFixed(2)}</td>
        <td><b style="color:blue;">₱${(p.net||0).toFixed(2)}</b></td>
        <td><span class="badge badge-success">Paid</span></td>
        <td><button class="btn btn-sm btn-secondary">Slip</button></td>
      </tr>`;
    });
    tbody.innerHTML = html;
  } catch(e) {}
}

async function openPayrollModal() {
  if (hrEmployees.length === 0) await loadAdminEmployees();
  const sel = document.getElementById('pay-emp-select');
  sel.innerHTML = '<option value="">-- Piliin --</option>';
  hrEmployees.filter(e => e.status === 'Active').forEach(e => {
    sel.innerHTML += `<option value="${e.id}">${e.name} - ${e.role}</option>`;
  });
  document.getElementById('hr-payroll-modal').style.display = 'flex';
}

function onPayrollEmpChange() {
  const id = document.getElementById('pay-emp-select').value;
  activePayrollEmp = hrEmployees.find(x => x.id === id);
  if(activePayrollEmp) {
    document.getElementById('pay-base-rate').innerText = `₱${parseFloat(activePayrollEmp.baseSalary||0).toFixed(2)} / day`;
    calculatePayslip();
  }
}

function calculatePayslip() {
  if(!activePayrollEmp) return;
  const rate = parseFloat(activePayrollEmp.baseSalary || 0);
  const days = parseFloat(document.getElementById('pay-days-worked').value || 0);
  const bonus = parseFloat(document.getElementById('pay-bonus').value || 0);
  const vale = parseFloat(document.getElementById('pay-vale').value || 0);
  const govt = parseFloat(document.getElementById('pay-govt').value || 0);
  
  const gross = (rate * days) + bonus;
  const deduct = vale + govt;
  const net = gross - deduct;
  
  document.getElementById('pay-net-total').innerText = `₱${net.toFixed(2)}`;
  return { gross, deduct, net };
}

async function submitPayslip() {
  if(!activePayrollEmp) return;
  const calcs = calculatePayslip();
  if(!confirm(`I-release ang ₱${calcs.net.toFixed(2)} bilang pasweldo kay ${activePayrollEmp.name}? Ibabawas ito sa Cash on Hand sa Ledger.`)) return;
  
  try {
    const batch = db.batch();
    const payRef = db.collection('payrolls').doc();
    batch.set(payRef, {
      empId: activePayrollEmp.id,
      empName: activePayrollEmp.name,
      gross: calcs.gross,
      deductions: calcs.deduct,
      net: calcs.net,
      period: new Date().toLocaleDateString(),
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    
    // Log to General Ledger (Credit Cash)
    const glRef = db.collection('general_ledger').doc();
    batch.set(glRef, {
      type: 'Payroll Payout',
      ref: `Payslip: ${activePayrollEmp.name}`,
      debit: 0,
      credit: calcs.net, // Pera palabas
      timestamp: firebase.firestore.FieldValue.serverTimestamp()
    });
    
    await batch.commit();
    alert('✅ Tagumpay ang Pasweldo!');
    document.getElementById('hr-payroll-modal').style.display = 'none';
    loadAdminPayroll();
    if(typeof loadAdminFinance === 'function') loadAdminFinance();
  } catch(e) { alert(e.message); }
}

// ======================== FINANCE & GL ========================
async function loadAdminFinance() {
  if(!db) return;
  
  try {
    let totalCash = 100000; // Starting Dummy Cash
    let totalBank = 500000; // Starting Dummy Bank
    let totalAP = 0;
    let totalAR = 0;
    
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
