



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
    try { secMaybeAlert(actionName, details); } catch (e) {}
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