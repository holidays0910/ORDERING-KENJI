

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
        <td><b>${ord.branchName || 'Branch'}</b>${ord.orderedBy ? `<br><small style="color:#64748b;">🧑‍💼 ${srchEsc(ord.orderedBy)}</small>` : ''}${ord.takenBy ? `<br><small style="color:#0369a1;">✋ ${srchEsc(ord.takenBy)}</small>` : ''}</td>
        <td>${itemCount} item(s)</td>
        <td><b style="color: #2563eb;">${totalAmount}</b></td>
        <td>${statusBadge}</td>
        <td>
          <div style="display: flex; gap: 0.35rem; flex-wrap: wrap;">
            <button class="btn btn-sm btn-primary" style="font-weight: 700;" onclick="openCommissaryOrderModal('${ord.id}')">🔍 Buksan / Ihanda</button>
            <button class="btn btn-sm btn-warning" title="Discount / VAT (Commissary lang)" onclick="ordPriceOpen('${ord.id}')">💸 Discount/VAT</button>
            ${ord.takenBy ? '' : `<button class="btn btn-sm btn-secondary" onclick="ordTake('${ord.id}')">✋ I-take</button>`}
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

// ---- Commissary / Supply Chain lang: discount, VAT, at sino ang kumuha ng order ----
async function ordTake(id) {
  const u = getCurrentUser() || {};
  try { await db.collection('orders').doc(id).update({ takenBy: u.name || u.email, takenByEmail: String(u.email || '').toLowerCase(), takenAt: new Date().toISOString() }); loadIncomingOrders(); } catch (e) { alert('Hindi nai-take: ' + e.message); }
}
function ordCalc(items, discPct, vatOpt, vatRate) {
  const sub = (items || []).reduce((n, i) => n + (parseFloat(i.subtotal) || 0), 0);
  const disc = sub * (Math.min(100, Math.max(0, parseFloat(discPct) || 0)) / 100); const after = sub - disc; let vat = 0, total = after;
  if (vatOpt === 'exclusive') { vat = after * vatRate / 100; total = after + vat; } else if (vatOpt === 'inclusive') { vat = after - after / (1 + vatRate / 100); }
  return { subtotal: sub, discountAmt: disc, vatAmount: vat, finalTotal: total };
}
function ordPriceOpen(id) {
  const o = currentOrders.find(x => x.id === id); if (!o) return;
  const dr = String(o.discountRate || '0'), vt = o.vatType || 'inclusive';
  arModal(`<h3>💸 Discount / VAT — ${srchEsc(o.orderId || id)}</h3><p style="font-size:.85rem;color:#64748b;">Commissary / Supply Chain lang ang puwedeng magbago nito. Branch: <b>${srchEsc(o.branchName || '')}</b></p>
    <div class="form-group"><label>Discount (%)</label><input type="number" id="op-disc" min="0" max="100" step="0.5" value="${srchEsc(dr)}"></div>
    <div class="form-group"><label>VAT</label><select id="op-vat" data-nosearch="1"><option value="inclusive" ${vt === 'inclusive' ? 'selected' : ''}>VAT Inclusive</option><option value="exclusive" ${vt === 'exclusive' ? 'selected' : ''}>VAT Exclusive</option><option value="exempt" ${vt === 'exempt' ? 'selected' : ''}>VAT Exempt</option></select></div>
    <div class="form-group"><label>Dahilan (kung may discount)</label><input type="text" id="op-note" value="${srchEsc(o.discountNote || '')}"></div>
    <button class="btn btn-success" onclick="ordPriceSave('${id}')">💾 I-save</button> <button class="btn btn-secondary" onclick="arCloseModal()">Kanselahin</button>`);
}
async function ordPriceSave(id) {
  const o = currentOrders.find(x => x.id === id); if (!o) return; const u = getCurrentUser() || {};
  const d = parseFloat(document.getElementById('op-disc').value) || 0, v = document.getElementById('op-vat').value, note = document.getElementById('op-note').value.trim();
  if (d < 0 || d > 100) { alert('0 hanggang 100 lang ang discount.'); return; }
  if (d >= 50 && !note) { alert('Maglagay ng dahilan para sa discount na 50% pataas.'); return; }
  const t = ordCalc(o.items, d, v, window.systemVatRate || 12);
  try {
    await db.collection('orders').doc(id).update({ discountRate: String(d), discountAmount: t.discountAmt, vatType: v, vatAmount: t.vatAmount, subtotalAmount: t.subtotal, totalAmount: t.finalTotal, discountNote: note, priceSetBy: u.name || u.email, priceSetAt: new Date().toISOString() });
    try { await logSystemAction('ORDER_DISCOUNT_SET', `${o.orderId || id}: ${d}% · ${v} · total ${t.finalTotal.toFixed(2)} (${u.email})`); } catch (e) {}
    arCloseModal(); loadIncomingOrders();
  } catch (e) { alert('Hindi na-save: ' + e.message); }
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
  try { ordApplyLock(); } catch (e) {}

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

// Branch account = mismong ordering ng buong branch. Walang agent/customer, discount, o VAT na pinipili ng branch — Commissary/Supply Chain lang.
function ordLocked() { const r = normalizeRole((getCurrentUser() || {}).role); return r === 'branch'; }
function ordApplyLock() {
  if (!ordLocked()) return;
  ['order-customer', 'order-discount', 'order-vat'].forEach(id => { const el = document.getElementById(id); if (!el) return; const g = el.closest('.form-group'); if (g) g.style.display = 'none'; });
  const d = document.getElementById('order-discount'); if (d) d.value = '0'; const v = document.getElementById('order-vat'); if (v) v.value = 'inclusive'; const c = document.getElementById('order-customer'); if (c) c.value = '';
  const u = getCurrentUser() || {}; const host = document.getElementById('order-target-date'); const grid = host && host.closest('div[style*="grid"]');
  if (grid && !document.getElementById('order-by-box')) grid.insertAdjacentHTML('afterbegin', `<div class="form-group" id="order-by-box" style="margin:0;grid-column:1/-1;background:#ecfdf5;border:1px solid #6ee7b7;border-radius:.4rem;padding:.5rem .7rem;">🧑‍💼 Nag-o-order: <b>${srchEsc(u.name || u.email || '')}</b> · ${srchEsc(u.branch || '')}<br><small style="color:#64748b;">Discount at VAT ay itinatakda ng Commissary / Supply Chain.</small></div>`);
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
  
  const LOCK = ordLocked();
  const customerId = LOCK ? '' : (document.getElementById('order-customer')?.value || '');
  const customerName = LOCK ? '' : (document.getElementById('order-customer')?.options[document.getElementById('order-customer')?.selectedIndex]?.text || '');
  const discountRate = LOCK ? '0' : (document.getElementById('order-discount')?.value || '0');
  const vatOpt = LOCK ? 'inclusive' : (document.getElementById('order-vat')?.value || 'inclusive');

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
      orderedBy: (u && (u.name || u.email)) || '',
      orderedByEmail: u ? String(u.email || '').toLowerCase() : '',
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