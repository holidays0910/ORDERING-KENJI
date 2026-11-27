



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
        <td><b>${name}</b>${companyChipsHtml(prod)}${prod.supplier ? `<br><small style="color:#7c3aed;">🚚 ${srchEsc(prod.supplier)}</small>` : ''}</td>
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
  const base = apFiltered();

  if (!query) {
    renderAdminProductsTable(base);
    return;
  }

  const filtered = base.filter(prod => {
    const pos = (prod.posCode || prod.pos_code || '').toLowerCase();
    const sap = (prod.sapCode || prod.itemCode || prod.id || '').toLowerCase();
    const bar = (prod.barcode || prod.barcodeNumber || '').toLowerCase();
    const name = (prod.itemName || '').toLowerCase();
    const station = (prod.storageStation || '').toLowerCase();
    const sup = (prod.supplier || '').toLowerCase();
    return pos.includes(query) || sap.includes(query) || bar.includes(query) || name.includes(query) || station.includes(query) || sup.includes(query);
  });

  renderAdminProductsTable(filtered);
}

// ===== Product Management per Company =====
let apCompany = '', apSupplier = '';
function apSuppOf(p) { return String(p.supplier || '').trim(); }
function apByCompany() {
  const c = apCompany, list = adminProductsList || [];
  if (!c) return list;
  if (c === '__none') return list.filter(p => !productCompanies(p).length);
  return list.filter(p => productCompanies(p).some(x => hubKey(x) === hubKey(c)));
}
function apFiltered() {
  const base = apByCompany(), s = apSupplier; if (!s) return base;
  if (s === '__none') return base.filter(p => !apSuppOf(p));
  return base.filter(p => apSuppOf(p).toLowerCase() === s.toLowerCase());
}
// Supplier filter: ang listahan ay mula sa mga produktong nasa napiling company
function apFillSuppliers() {
  const sel = document.getElementById('admin-product-supplier'); if (!sel) return; const base = apByCompany(), cnt = {};
  base.forEach(p => { const s = apSuppOf(p); if (s) { const k = s.toLowerCase(); (cnt[k] = cnt[k] || { name: s, n: 0 }).n++; } });
  const list = Object.values(cnt).sort((a, b) => a.name.localeCompare(b.name)), none = base.filter(p => !apSuppOf(p)).length;
  if (apSupplier && apSupplier !== '__none' && !cnt[apSupplier.toLowerCase()]) apSupplier = '';
  sel.innerHTML = `<option value="">🚚 Lahat ng supplier (${base.length})</option>` + list.map(s => `<option value="${srchEsc(s.name)}" ${s.name.toLowerCase() === apSupplier.toLowerCase() && apSupplier ? 'selected' : ''}>🚚 ${srchEsc(s.name)} (${s.n})</option>`).join('') + (none ? `<option value="__none" ${apSupplier === '__none' ? 'selected' : ''}>— Walang supplier (${none})</option>` : '');
  if (!apSupplier) sel.value = '';
}
function apSupplierChange() { const sel = document.getElementById('admin-product-supplier'); apSupplier = sel ? sel.value : ''; filterAdminProductsTable(); }
async function apFillCompanies() {
  const sel = document.getElementById('admin-product-company'); if (!sel) return;
  let names = []; try { (await db.collection('companies').get()).forEach(d => names.push(d.data().name || d.id)); } catch (e) {}
  (adminProductsList || []).forEach(p => productCompanies(p).forEach(c => names.push(c)));
  const seen = new Set(); names = names.filter(n => { const k = hubKey(n); if (seen.has(k)) return false; seen.add(k); return true; }).sort((a, b) => a.localeCompare(b));
  const none = (adminProductsList || []).filter(p => !productCompanies(p).length).length;
  sel.innerHTML = `<option value="">🌐 Lahat ng company (${(adminProductsList || []).length})</option>` + names.map(n => `<option value="${srchEsc(n)}" ${hubKey(n) === hubKey(apCompany) ? 'selected' : ''}>🏢 ${srchEsc(n)} (${(adminProductsList || []).filter(p => productCompanies(p).some(x => hubKey(x) === hubKey(n))).length})</option>`).join('') + `<option value="__none" ${apCompany === '__none' ? 'selected' : ''}>⚠️ Walang company pa (${none})</option>`;
  if (!apCompany) sel.value = '';
}
function apCompanyChange() {
  const sel = document.getElementById('admin-product-company'); apCompany = sel ? sel.value : '';
  apFillSuppliers();
  const info = document.getElementById('admin-product-company-info'); if (info) info.textContent = apCompany === '__none' ? 'Mga produktong wala pang company. I-edit at lagyan ng tag.' : apCompany ? 'Ang bagong produkto at CSV upload ay mata-tag sa company na ito.' : '';
  filterAdminProductsTable();
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
    await apFillCompanies(); apFillSuppliers();
    filterAdminProductsTable();
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
      wholeContent: apNum('admin-item-content-whole'), looseContent: apNum('admin-item-content-loose'), contentUnit: (document.getElementById('admin-item-content-unit') || {}).value || 'g',
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