


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
  } else if (viewName === 'myloan') {
    const el = document.getElementById('view-branch-myloan'); if (el) el.style.display = 'block'; if (typeof loadMyLoans === 'function') loadMyLoans();
  } else if (viewName === 'pos') {
    const el = document.getElementById('view-branch-kpos'); if (el) el.style.display = 'block'; if (typeof loadPOS === 'function') loadPOS();
  } else if (viewName === 'prime') {
    const el = document.getElementById('view-branch-prime'); if (el) el.style.display = 'block'; if (typeof loadPrime === 'function') loadPrime();
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