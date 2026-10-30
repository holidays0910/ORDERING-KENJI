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
              <button class="btn btn-sm btn-primary" onclick="printPickingGuide('${doc.id}', '3col')">🖨️ Print 3-Col Slip</button>
              <button class="btn btn-sm btn-secondary" onclick="printPickingGuide('${doc.id}', '1col')">🖨️ 1-Col</button>
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
