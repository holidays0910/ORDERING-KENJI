



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