
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
    auth.signOut().catch(() => {});
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
    let rowsHtml = '';
    snap.forEach(doc => {
      const prod = { id: doc.id, ...doc.data() };
      adminProductsList.push(prod);

      // KUNIN ANG TAMANG FIELD PARA SA BAWAT KOLUM (HINDI NAGKAKAPALIT)
      const posCode = prod.posCode || prod.pos_code || '--';
      const sapCode = prod.sapCode || prod.itemCode || doc.id || '--';
      const barcode = prod.barcode || prod.barcodeNumber || '--';
      const name = prod.itemName || 'Walang Pangalan';
      const hub = prod.commissarySource || 'Central Hub';
      const station = prod.storageStation || 'Unassigned';
      const wholeUOM = prod.wholeUOM || 'Whole';
      const looseUOM = prod.looseUOM || 'Loose';
      const wholePrice = parseFloat(prod.wholePrice || 0);
      const loosePrice = parseFloat(prod.loosePrice || 0);
      const packGuide = prod.packagingInstructions ? `<small style="color: #475569;">${prod.packagingInstructions}</small>` : '<small style="color: #94a3b8;">--</small>';

      // WASTONG PAGKAKAHANAY NG CELLS:
      // Kolum 1: POS Code
      // Kolum 2: SAP / Sub Code
      // Kolum 3: Barcode
      // Kolum 4: Pangalan ng Produkto
      // Kolum 5: Commissary Hub
      // Kolum 6: Storage Station
      // Kolum 7: Whole Rate & UOM
      // Kolum 8: Loose Rate & UOM
      // Kolum 9: Packaging Guide
      // Kolum 10: Aksyon (Edit / Delete)
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
              <button class="btn btn-sm btn-primary" onclick="openAdminProductModal('${doc.id}')">✏️ Edit</button>
              <button class="btn btn-sm btn-danger" onclick="deleteAdminProduct('${doc.id}')">🗑️</button>
            </div>
          </td>
        </tr>
      `;
    });

    tbody.innerHTML = rowsHtml;
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
  const codeInput = document.getElementById('admin-item-code');
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

    if (titleEl) titleEl.innerText = `✏️ I-edit ang Produkto (${prod.itemCode || prod.id})`;
    if (modeEl) modeEl.value = 'edit';
    if (codeInput) {
      codeInput.value = prod.itemCode || prod.id;
      codeInput.disabled = true; // Cannot alter document key
    }
    if (nameInput) nameInput.value = prod.itemName || '';
    if (hubInput) hubInput.value = prod.commissarySource || 'Commissary Hub';
    if (stationSelect) stationSelect.value = prod.storageStation || '';
    if (wholeSelect) wholeSelect.value = prod.wholeUOM || '';
    if (looseSelect) looseSelect.value = prod.looseUOM || '';
    if (wholePriceInput) wholePriceInput.value = prod.wholePrice || 0;
    if (loosePriceInput) loosePriceInput.value = prod.loosePrice || 0;
    if (convInput) convInput.value = prod.conversionFactor || 1;
    if (bufferInput) bufferInput.value = prod.bufferLimit || 5;
    if (packInput) packInput.value = prod.packagingInstructions || '';
  } else {
    // ADD MODE
    if (titleEl) titleEl.innerText = '➕ Mag-add ng Bagong Produkto';
    if (modeEl) modeEl.value = 'add';
    if (codeInput) {
      codeInput.value = '';
      codeInput.disabled = false;
    }
    if (nameInput) nameInput.value = '';
    if (hubInput) hubInput.value = 'Commissary Central';
    if (stationSelect) stationSelect.value = '';
    if (wholeSelect) wholeSelect.value = '';
    if (looseSelect) looseSelect.value = '';
    if (wholePriceInput) wholePriceInput.value = 0;
    if (loosePriceInput) loosePriceInput.value = 0;
    if (convInput) convInput.value = 1;
    if (bufferInput) bufferInput.value = 5;
    if (packInput) packInput.value = '';
  }

  modal.style.display = 'flex';
}

function closeAdminProductModal() {
  const modal = document.getElementById('admin-product-modal');
  if (modal) modal.style.display = 'none';
}

async function saveAdminProduct() {
  const posCode = document.getElementById('admin-item-pos-code') ? document.getElementById('admin-item-pos-code').value.trim() : '';
  const code = document.getElementById('admin-item-code').value.trim();
  const name = document.getElementById('admin-item-name').value.trim();
  const hub = document.getElementById('admin-item-hub').value.trim() || 'Commissary Hub';
  const station = document.getElementById('admin-item-station').value;
  const wholeUOM = document.getElementById('admin-item-whole-uom').value || 'Box';
  const looseUOM = document.getElementById('admin-item-loose-uom').value || 'Pcs';
  const wholePrice = parseFloat(document.getElementById('admin-item-whole-price').value || 0);
  const loosePrice = parseFloat(document.getElementById('admin-item-loose-price').value || 0);
  const conv = parseInt(document.getElementById('admin-item-conversion').value || 1);
  const buffer = parseInt(document.getElementById('admin-item-buffer').value || 5);
  const packInst = document.getElementById('admin-item-packaging').value.trim();

  if (!code || !name) {
    alert('Mangyaring punan ang SAP Code at Pangalan ng Produkto.');
    return;
  }

  // Mahigpit na pagsusuri kung Unique ang POS Code at SAP Code
  const isEditMode = document.getElementById('admin-edit-mode') && document.getElementById('admin-edit-mode').value === 'edit';
  const excludeAdminId = isEditMode ? code : null;
  const adminUniqueness = await validateProductCodesUnique(posCode, code, excludeAdminId);
  if (!adminUniqueness.isUnique) {
    alert(`⚠️ BAWAL ANG DUPLICATE CODE!\n\nAng ${adminUniqueness.conflictType} na "${adminUniqueness.conflictingCode}" ay ginagamit na ng produktong: "${adminUniqueness.existingItemName}".\n\nMangyaring gumamit ng natatanging (unique) code.`);
    return;
  }

  if (!db) {
    alert('Walang koneksyon sa database.');
    return;
  }

  try {
    await db.collection('products').doc(code).set({
      posCode: posCode,
      sapCode: code,
      posCode: posCode,
      sapCode: code,
      itemCode: code,
      itemName: name,
      commissarySource: hub,
      storageStation: station || 'Unassigned',
      wholeUOM: wholeUOM,
      looseUOM: looseUOM,
      wholePrice: wholePrice,
      loosePrice: loosePrice,
      conversionFactor: conv,
      bufferLimit: buffer,
      packagingInstructions: packInst,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

    alert(`Matagumpay na nai-save ang produktong "${name}" ni Admin!`);
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
  const posCode = document.getElementById('new-item-pos-code') ? document.getElementById('new-item-pos-code').value.trim() : '';
  const code = document.getElementById('new-item-code').value.trim();
  const name = document.getElementById('new-item-name').value.trim();
  const station = document.getElementById('new-storage-station').value;
  const wholeUOM = document.getElementById('new-whole-uom').value || 'Box';
  const looseUOM = document.getElementById('new-loose-uom').value || 'Pcs';
  const wholePrice = parseFloat(document.getElementById('new-whole-price').value || 0);
  const loosePrice = parseFloat(document.getElementById('new-loose-price').value || 0);
  const whole = parseInt(document.getElementById('new-stock-whole').value || 0);
  const loose = parseInt(document.getElementById('new-stock-loose').value || 0);
  const conv = parseInt(document.getElementById('new-conversion-factor').value || 1);
  const buffer = parseInt(document.getElementById('new-buffer-limit').value || 5);
  const packInstEl = document.getElementById('new-packaging-instructions');
  const packagingInstructions = packInstEl ? packInstEl.value.trim() : '';

  if (!code || !name) {
    alert('Mangyaring ilagay ang Item Code at Pangalan ng Produkto.');
    return;
  }

  // Mahigpit na pagsusuri kung Unique ang POS Code at SAP Code
  const isEditing = document.getElementById('new-item-code') && document.getElementById('new-item-code').disabled;
  const excludeId = isEditing ? code : null;
  const uniquenessCheck = await validateProductCodesUnique(posCode, code, excludeId);
  if (!uniquenessCheck.isUnique) {
    alert(`⚠️ BAWAL ANG DUPLICATE CODE!\n\nAng ${uniquenessCheck.conflictType} na "${uniquenessCheck.conflictingCode}" ay ginagamit na ng produktong: "${uniquenessCheck.existingItemName}".\n\nMangyaring gumamit ng natatanging (unique) code para sa bawat supplier o variant.`);
    return;
  }

  if (!station) {
    alert('Mangyaring pumili ng Storage Station.');
    return;
  }

  const u = getCurrentUser();
  const userHub = (u && u.branch) ? u.branch : 'Commissary Hub';

  if (!db) {
    alert('Walang database connection.');
    return;
  }

  try {
    await db.collection('products').doc(code).set({
      posCode: posCode,
      sapCode: code,
      posCode: posCode,
      sapCode: code,
      itemCode: code,
      itemName: name,
      storageStation: station,
      wholeUOM: wholeUOM,
      looseUOM: looseUOM,
      wholePrice: wholePrice,
      loosePrice: loosePrice,
      conversionFactor: conv,
      packagingInstructions: packagingInstructions,
      commissarySource: userHub,
      stockWhole: whole,
      stockLoose: loose,
      bufferLimit: buffer,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    alert(`Matagumpay na naitala ang ${name}!
Station: ${station}
Whole Price: ₱${wholePrice.toFixed(2)} / ${wholeUOM}
Loose Price: ₱${loosePrice.toFixed(2)} / ${looseUOM}`);
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
    loadCommissaryInventory();
  } catch (e) {
    console.warn(e);
  }
}

// ========================================================
// ORDERS QUEUE & STATION-BY-STATION PICKING SLIP GENERATOR
// ========================================================
async function loadIncomingOrders() {
  const tbody = document.getElementById('incoming-orders-tbody');
  if (!tbody || typeof db === 'undefined' || !db) return;

  try {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: #64748b; padding: 1rem;">Kinukuha ang mga orders mula sa mga branch...</td></tr>';
    const snap = await db.collection('orders').orderBy('createdAt', 'desc').limit(50).get();

    if (snap.empty) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: #94a3b8; padding: 1.5rem;">Walang nakabinbing order mula sa mga branch.</td></tr>';
      return;
    }

    currentOrders = [];
    let rowsHtml = '';
    snap.forEach(doc => {
      const ord = { id: doc.id, ...doc.data() };
      currentOrders.push(ord);

      const dateStr = ord.createdAt ? new Date(ord.createdAt.toDate ? ord.createdAt.toDate() : ord.createdAt).toLocaleString() : 'Just now';
      const itemCount = (ord.items || []).length;
      const totalAmount = parseFloat(ord.totalAmount || 0).toLocaleString('en-PH', { style: 'currency', currency: 'PHP' });
      const status = ord.status || 'Pending Preparation';

      let statusBadge = '<span class="badge badge-warning">⏳ ' + status + '</span>';
      if (status.includes('Prepared') || status.includes('Ready') || status.includes('Packed')) {
        statusBadge = '<span class="badge badge-commissary">📦 ' + status + '</span>';
      } else if (status.includes('Dispatched') || status.includes('Completed')) {
        statusBadge = '<span class="badge badge-branch">🚚 ' + status + '</span>';
      }

      rowsHtml += `
        <tr>
          <td><b>${ord.orderId || doc.id}</b><br><small style="color: #64748b;">${dateStr}</small></td>
          <td><b>${ord.branchName || 'Branch'}</b></td>
          <td>${itemCount} item(s)</td>
          <td><b style="color: #2563eb;">${totalAmount}</b></td>
          <td>${statusBadge}</td>
          <td>
            <div style="display: flex; gap: 0.35rem; flex-wrap: wrap;">
              <button class="btn btn-sm btn-primary" onclick="printPickingGuide('${doc.id}', '3col')">🖨️ Slip</button>
              <button class="btn btn-sm btn-success" title="I-download bilang 5-Column CSV" onclick="downloadBranchOrderCSV('${doc.id}')">📥 CSV</button>
              <button class="btn btn-sm btn-secondary" title="Kopyahin para sa Excel/Google Sheets" onclick="copyBranchOrderToClipboard('${doc.id}')">📋 Copy</button>
              <select onchange="updateOrderStatus('${doc.id}', this.value)" style="width: auto; font-size: 0.75rem; padding: 0.2rem 0.4rem;">
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
  } catch (err) {
    console.error('Error loading incoming orders:', err);
    tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: #ef4444;">Error sa pagkuha ng orders: ${err.message}</td></tr>`;
  }
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
function printPickingGuide(orderId, layout = '3col') {
  const order = currentOrders.find(o => o.id === orderId);
  if (!order) {
    alert('Hindi nahanap ang order details.');
    return;
  }

  // Group items by storageStation
  const stationGroups = {};
  (order.items || []).forEach(item => {
    const station = item.storageStation || 'Station Unassigned (General Storage)';
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

  // Generate Station Cards HTML
  let cardsHtml = '';
  for (const [stationName, items] of Object.entries(stationGroups)) {
    let itemsHtml = '';
    items.forEach(item => {
      const wholePart = item.wholeQty > 0 ? `<b>${item.wholeQty}</b> ${item.wholeUOM || 'Whole'}` : '';
      const loosePart = item.looseQty > 0 ? `<b>${item.looseQty}</b> ${item.looseUOM || 'Loose'}` : '';
      const qtyStr = [wholePart, loosePart].filter(Boolean).join(' + ') || '1 unit';
      const subtotalStr = parseFloat(item.subtotal || 0).toLocaleString('en-PH', { style: 'currency', currency: 'PHP' });

      const packGuideHtml = item.packagingInstructions ? `
        <div style="font-size: 8pt; color: #1e293b; background: #f1f5f9; border-left: 3px solid #2563eb; padding: 2px 6px; margin: 3px 0 5px 18px; border-radius: 2px;">
          <b>📦 Tagubilin sa Pag-impake:</b> ${item.packagingInstructions}
        </div>
      ` : '';

      itemsHtml += `
        <div class="slip-item-row">
          <div>
            <span class="slip-checkbox"></span>
            <b>${item.itemName}</b>
            ${item.itemCode ? `<small style="color: #555;"> (${item.itemCode})</small>` : ''}
          </div>
          <div style="text-align: right;">
            <span>${qtyStr}</span>
            <small style="color: #666; display: block;">${subtotalStr}</small>
          </div>
        </div>
        ${packGuideHtml}
      `;
    });

    cardsHtml += `
      <div class="station-picking-card">
        <div class="station-card-header">
          📍 ${stationName}
        </div>
        <div>
          ${itemsHtml}
        </div>
      </div>
    `;
  }

  const columnsClass = layout === '3col' ? 'slip-columns-3' : 'slip-columns-1';

  printContainer.innerHTML = `
    <div style="border-bottom: 2px solid #000; padding-bottom: 8px; margin-bottom: 12px; display: flex; justify-content: space-between; align-items: flex-start;">
      <div>
        <h2 style="margin: 0; font-size: 16pt; text-transform: uppercase; font-weight: 900;">🍳 KUSINA ERP - DISPATCH & PICKING GUIDE</h2>
        <div style="font-size: 10pt; color: #333; margin-top: 3px;">
          <b>ORDER NO:</b> ${order.orderId || order.id} &nbsp;|&nbsp; 
          <b>BRANCH DESTINATION:</b> <span style="font-size: 11pt; font-weight: 800; text-decoration: underline;">${order.branchName || 'Branch'}</span>
        </div>
        <div style="font-size: 9pt; color: #555;">
          <b>DATE PLACED:</b> ${orderDate} &nbsp;|&nbsp; 
          <b style="color: #b91c1c;">📅 TARGET DELIVERY DATE:</b> <span style="font-size: 10pt; font-weight: 800; background: #fee2e2; padding: 1px 4px;">${order.targetDeliveryDate || 'ASAP'}</span>
        </div>
      </div>
      <div style="text-align: right; border: 1.5px solid #000; padding: 6px 12px; border-radius: 4px;">
        <div style="font-size: 8pt; text-transform: uppercase; font-weight: 700;">TOTAL ORDER BILLING</div>
        <div style="font-size: 14pt; font-weight: 900; color: #000;">${totalAmountStr}</div>
      </div>
    </div>

    <div style="background: #f4f4f4; border: 1px solid #ccc; padding: 5px 8px; font-size: 8.5pt; margin-bottom: 12px;">
      <b>📋 COMMISSARY PACKER'S INSTRUCTION:</b>
      Puntahan ang bawat istasyon (Station 1, Station 2, Station 3). Lagyan ng checkmark [✓] kapag nakuha na ang bawat item. Pagkatapos, i-repack at i-seal sa box o plastic pouch bago ibigay sa driver.
    </div>

    <!-- Stations Grid: 3-Columns or 1-Column on Bond Paper -->
    <div class="${columnsClass}">
      ${cardsHtml}
    </div>

    <!-- Repack / Packing & Quality Assurance Sign-off -->
    <div style="margin-top: 15px; border-top: 2px solid #000; padding-top: 10px; display: flex; justify-content: space-between; font-size: 9pt;">
      <div style="width: 30%;">
        <b>[ ] REPACKING COMPLETE:</b><br>
        Bilang ng Kahon / Plastic: ________ Box(es)<br>
        Temp Verified: [ ] Chilled &nbsp; [ ] Frozen
      </div>
      <div style="width: 32%; text-align: center;">
        <br>
        __________________________________<br>
        <b>PICKED & PACKED BY (COMMISSARY)</b>
      </div>
      <div style="width: 32%; text-align: center;">
        <br>
        __________________________________<br>
        <b>DISPATCHED / DRIVER RECEIVED</b>
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
  document.getElementById('fillup-item-name').innerText = prod.itemName || prod.id;
  document.getElementById('fillup-station-name').innerText = prod.storageStation || 'Unassigned';

  const wholeUOM = prod.wholeUOM || 'Whole';
  const looseUOM = prod.looseUOM || 'Loose';
  const wholePrice = parseFloat(prod.wholePrice || 0);
  const loosePrice = parseFloat(prod.loosePrice || 0);

  document.getElementById('fillup-whole-rate').innerText = `₱${wholePrice.toFixed(2)} / ${wholeUOM}`;
  document.getElementById('fillup-loose-rate').innerText = `₱${loosePrice.toFixed(2)} / ${looseUOM}`;

  const packTipEl = document.getElementById('fillup-packaging-tip');
  if (packTipEl) {
    if (prod.packagingInstructions) {
      packTipEl.parentElement.style.display = 'block';
      packTipEl.innerText = prod.packagingInstructions;
    } else {
      packTipEl.parentElement.style.display = 'none';
    }
  }
  document.getElementById('fillup-whole-label').innerText = `Whole Units (${wholeUOM}) - ₱${wholePrice.toFixed(2)}`;
  document.getElementById('fillup-loose-label').innerText = `Loose Units (${looseUOM}) - ₱${loosePrice.toFixed(2)}`;

  document.getElementById('fillup-whole-qty').value = 0;
  document.getElementById('fillup-loose-qty').value = 0;
  calculateFillupSubtotal();

  // Smooth scroll to fillup box
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
      branchEmail: u ? u.email : '',
      targetDeliveryDate: selectedDeliveryDate,
      items: orderCart,
      totalAmount: grandTotal,
      status: 'Pending Preparation',
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });

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
  const posInput = document.getElementById('new-item-pos-code');
  const sapInput = document.getElementById('new-item-code');
  const nameInput = document.getElementById('new-item-name');
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
    if (posInput) posInput.value = prod.posCode || prod.pos_code || '';
    if (sapInput) { sapInput.value = prod.sapCode || prod.itemCode || prod.id; sapInput.disabled = true; }
    if (nameInput) nameInput.value = prod.itemName || '';
    if (wholePriceInput) wholePriceInput.value = prod.wholePrice || 0;
    if (loosePriceInput) loosePriceInput.value = prod.loosePrice || 0;
    if (convInput) convInput.value = prod.conversionFactor || 1;
    if (bufInput) bufInput.value = prod.bufferLimit || 5;
    if (statusInput) statusInput.value = prod.status || 'active';
    if (suppInput) suppInput.value = prod.supplier || '';
    if (packInput) packInput.value = prod.packagingInstructions || '';
  } else {
    if (titleEl) titleEl.innerText = '➕ Mag-tag ng Produkto';
    if (posInput) posInput.value = '';
    if (sapInput) { sapInput.value = ''; sapInput.disabled = false; }
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

// 6. Delete Commissary Product with Audit Trail Logging
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
  const passEl = document.getElementById('prof-new-pass');

  if (emailEl) emailEl.value = u.email || '';
  if (nameEl) nameEl.value = u.name || '';
  if (hubEl) hubEl.value = u.branch || 'Commissary Hub';
  if (passEl) passEl.value = '';

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
  const newPass = document.getElementById('prof-new-pass')?.value || '';

  if (!newName) {
    alert('Mangyaring ilagay ang iyong pangalan.');
    return;
  }

  try {
    await db.collection('users').doc(u.email.toLowerCase()).update({
      name: newName,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    if (newPass && newPass.length >= 6 && auth.currentUser) {
      await auth.currentUser.updatePassword(newPass);
    }

    u.name = newName;
    setCurrentUser(u);

    const userDisp = document.getElementById('user-display');
    if (userDisp) userDisp.innerText = `${u.branch || 'Commissary Hub'}: ${newName}`;
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

        const reorderBtn = `<button class="btn btn-sm btn-secondary" style="font-size: 0.75rem;" title="Kopyahin bilang bagong order" onclick="copyPastOrderToCart('${doc.id}', true)">📋 Kopyahin</button>`;
        const actionBtn = isDispatched
          ? `<div style="display: flex; gap: 0.35rem; justify-content: center; flex-wrap: wrap;">
               <button class="btn btn-sm btn-success" style="font-weight: 700;" onclick="openBranchReceivingModal('${doc.id}')">📦 I-receive</button>
               ${reorderBtn}
             </div>`
          : `<div style="display: flex; gap: 0.35rem; justify-content: center; align-items: center; flex-wrap: wrap;">
               <span class="badge ${status.includes('Completed') ? 'badge-branch' : 'badge-warning'}">${status}</span>
               ${reorderBtn}
             </div>`;

        rowsHtml += `
          <tr>
            <td><b>${ord.orderId || doc.id}</b><br><small style="color: #64748b;">Target: ${ord.targetDeliveryDate || 'ASAP'}</small></td>
            <td>${(ord.items || []).length} item(s)</td>
            <td><b>₱${parseFloat(ord.totalAmount || 0).toFixed(2)}</b></td>
            <td><span class="badge ${isDispatched ? 'badge-warning' : 'badge-branch'}">${status}</span></td>
            <td style="text-align: center;">${actionBtn}</td>
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

    initSwipeSlider('swipe-track-branch-receive', 'swipe-btn-branch-receive', () => {
      document.getElementById('br-stage-arrival').style.display = 'none';
      document.getElementById('br-stage-checklist').style.display = 'block';
      document.getElementById('br-stage-sign').style.display = 'block';
      renderBranchReceivingChecklist();
      initBranchRecvCanvas();
    });
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
        status: 'Pending Resolution / Credit Memo',
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      alert('⚠️ Naitala ang Delivery na may Damage Dispute! Awtomatikong na-notify ang Head Office Admin at Commissary.');
    } else {
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
  const passEl = document.getElementById('br-prof-new-pass');

  if (emailEl) emailEl.value = u.email || '';
  if (nameEl) nameEl.value = u.name || '';
  if (branchEl) branchEl.value = u.branch || 'Branch Operations';
  if (passEl) passEl.value = '';

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
  const newPass = document.getElementById('br-prof-new-pass')?.value || '';

  if (!newName) {
    alert('Mangyaring ilagay ang iyong pangalan.');
    return;
  }

  try {
    await db.collection('users').doc(u.email.toLowerCase()).update({
      name: newName,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    if (newPass && newPass.length >= 6 && auth.currentUser) {
      await auth.currentUser.updatePassword(newPass);
    }

    u.name = newName;
    setCurrentUser(u);

    const userDisp = document.getElementById('user-display');
    if (userDisp) userDisp.innerText = `Branch: ${newName}`;
    alert('✅ Matagumpay na na-update ang Profile ng Branch Manager!');
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
  } else if (viewName === 'reports') {
    const el = document.getElementById('view-admin-reports');
    if (el) el.style.display = 'block';
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
          <td><span class="badge badge-warning">${d.status || 'Pending Credit'}</span></td>
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
    await db.collection('users').doc(u.email.toLowerCase()).update({
      name: newName,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    if (newPass && newPass.length >= 6 && auth.currentUser) {
      await auth.currentUser.updatePassword(newPass);
    }

    u.name = newName;
    setCurrentUser(u);

    const userDisp = document.getElementById('user-display');
    if (userDisp) userDisp.innerText = `Admin: ${newName}`;
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
      alert('⚠️ Kailangan ng HTTPS connection (SSL) para gumana ang camera sa cellphone.\n\nSiguraduhing naka-HTTPS ang address o naka-host sa GitHub Pages (https://holidays0910.github.io).');
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
      alert('⚠️ CAMERA PERMISSION DENIED!\n\nNaka-block o hindi pinahintulutan ang camera sa browser ng cellphone.\n\nPAANO AYUSIN:\n1. Pindutin ang lock / setting icon sa tabi ng website URL sa itaas ng browser.\n2. Piliin ang "Site Settings" o "Permissions".\n3. I-set ang Camera sa "Allow" o "Payagan".\n4. I-refresh ang pahina.');
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

  if (activeScannerContext === 'commissary') {
    const searchInput = document.getElementById('comm-product-search');
    if (searchInput) {
      searchInput.value = cleanCode;
      filterCommissaryInventoryTable();
    }
    alert(`📷 Na-scan ang Barcode: ${cleanCode}\nInilagay na sa search filter.`);
  } else if (activeScannerContext === 'branch_receiving' || activeScannerContext === 'branch') {
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
      branchReceivingChecklist[matchedIdx].condition = 'good';
      renderBranchReceivingChecklist();
      alert(`✅ Na-verify via Barcode (${cleanCode}):\n"${branchReceivingChecklist[matchedIdx].itemName}" ay Tanggap / Good!`);
    } else {
      alert(`⚠️ Hindi tumutugma ang Barcode (${cleanCode}) sa mga inaasahang produkto sa delivery na ito.`);
    }
  } else if (activeScannerContext === 'branch_catalog') {
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
      alert(`✅ Na-select ang: ${matchedProd.itemName || matchedProd.id} (${cleanCode})`);
    } else {
      alert(`🔎 Hinanap ang Barcode: ${cleanCode}`);
    }
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
// SYSTEM BRANDING ENGINE WITH INSTANT LOCAL CACHING & FIRESTORE SYNC
// ==========================================================================
async function loadSystemBranding() {
  const localName = localStorage.getItem('kusina_brand_name') || 'KusinaERP';
  const localSub = localStorage.getItem('kusina_brand_subtitle') || '';

  applyBrandingToUI(localName, localSub);

  if (typeof db === 'undefined' || !db) return;

  try {
    const doc = await db.collection('system_settings').doc('branding').get();
    if (doc.exists) {
      const data = doc.data();
      const bName = data.brandName || localName;
      const bSub = data.brandSubtitle || localSub;
      localStorage.setItem('kusina_brand_name', bName);
      localStorage.setItem('kusina_brand_subtitle', bSub);
      applyBrandingToUI(bName, bSub);
    }
  } catch (err) {
    console.warn('Branding sync warning:', err);
  }
}

function applyBrandingToUI(brandName, brandSubtitle) {
  document.querySelectorAll('#brand-header-title').forEach(el => { el.innerText = brandName; });
  document.querySelectorAll('#brand-header-subtitle').forEach(el => { el.innerText = brandSubtitle; });

  const inputName = document.getElementById('setting-brand-name');
  const inputSub = document.getElementById('setting-brand-subtitle');
  if (inputName && !inputName.value) inputName.value = brandName;
  if (inputSub && !inputSub.value) inputSub.value = brandSubtitle;

  if (brandName) {
    document.title = `${brandName} - Management System`;
  }
}

async function saveSystemBranding() {
  const inputName = document.getElementById('setting-brand-name');
  const inputSub = document.getElementById('setting-brand-subtitle');

  const brandName = (inputName ? inputName.value.trim() : '') || 'KusinaERP';
  const brandSubtitle = inputSub ? inputSub.value.trim() : '';

  localStorage.setItem('kusina_brand_name', brandName);
  localStorage.setItem('kusina_brand_subtitle', brandSubtitle);
  applyBrandingToUI(brandName, brandSubtitle);

  if (typeof db === 'undefined' || !db) {
    alert(`✅ Matagumpay na na-update ang System Branding bilang "${brandName}"!`);
    return;
  }

  try {
    await db.collection('system_settings').doc('branding').set({
      brandName: brandName,
      brandSubtitle: brandSubtitle,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

    alert(`🎉 Matagumpay na na-update at na-save sa database ang System Branding bilang "${brandName}"!`);
  } catch (err) {
    console.warn('Firestore write warning:', err);
    alert(`✅ Matagumpay na na-update ang Header bilang "${brandName}"! (Naka-save sa browser).`);
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
    const snap = await db.collection('products').get();
    if (snap.empty) { alert('Walang produktong ma-e-export.'); return; }

    const headers = "POS_Code,SAP_Item_Code,Barcode,Item_Description,Commissary_Hub,Storage_Station,Whole_UOM,Loose_UOM,Whole_Price,Loose_Price,Conversion_Factor,Buffer_Limit,Packaging_Instructions\n";
    let rows = '';

    snap.forEach(doc => {
      const p = doc.data();
      const pos = p.posCode || p.pos_code || '';
      const sap = p.sapCode || p.itemCode || doc.id || '';
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
    a.download = `KusinaERP_Product_Masterlist_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  } catch (err) {
    alert('Error sa pag-export: ' + err.message);
  }
}

function printDeliveryReceiptA4() {
  window.print();
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
    alert("✅ Matagumpay na na-approve ang cancellation ng order.");
    const m = document.getElementById('investigation-modal');
    if (m) m.style.display = 'none';
    if (typeof loadIncomingOrders === 'function') loadIncomingOrders();
    if (typeof loadBranchDeliveries === 'function') loadBranchDeliveries();
  } catch (err) {
    alert("Error sa pag-approve: " + err.message);
  }
}
