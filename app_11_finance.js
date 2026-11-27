

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
    apSnap.forEach(d => totalAP += Math.max(0, parseFloat(d.data().actualTotalAmount || 0) - parseFloat(d.data().dpAmount || 0)));
    
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
let vendorCo = '', vendorCoNames = [];
// Vendors ay per-company: v.companies = ['Company A', ...]. Walang companies = "Shared" (luma / para sa lahat).
function vnCos(v) { return Array.isArray(v && v.companies) ? v.companies.filter(Boolean) : []; }
function vnIsAdmin() { try { return normalizeRole((getCurrentUser() || {}).role) === 'admin' || superAdminIsMe(); } catch (e) { return false; } }
function vnCanEdit() { return vnIsAdmin() || (typeof canEditModule === 'function' && canEditModule('vendors')); }
function vnApplyPerms() {
  const adm = vnIsAdmin(), ed = vnCanEdit();
  [['vn-btn-imp', adm], ['vn-btn-exp', adm], ['vn-btn-tpl', adm], ['vn-btn-add', ed]].forEach(([id, ok]) => { const el = document.getElementById(id); if (el) el.style.display = ok ? '' : 'none'; });
  const n = document.getElementById('vn-note'); if (n) n.textContent = adm ? '' : '🔒 Admin / Super Admin lang ang puwedeng mag-import at mag-export ng vendors.';
}
async function vnFillCompanies() {
  const sel = document.getElementById('admin-vendor-company'); if (!sel) return;
  let names = []; try { (await db.collection('companies').get()).forEach(d => names.push(d.data().name || d.id)); } catch (e) {}
  allVendors.forEach(v => vnCos(v).forEach(c => names.push(c)));
  const seen = new Set(); names = names.filter(n => { const k = hubKey(n); if (!k || seen.has(k)) return false; seen.add(k); return true; }).sort((a, b) => a.localeCompare(b));
  vendorCoNames = names;
  const cnt = n => allVendors.filter(v => vnCos(v).some(c => hubKey(c) === hubKey(n))).length, shared = allVendors.filter(v => !vnCos(v).length).length;
  sel.innerHTML = `<option value="">🌐 Lahat ng company (${allVendors.length})</option>` + names.map(n => `<option value="${srchEsc(n)}">🏢 ${srchEsc(n)} (${cnt(n)})</option>`).join('') + `<option value="__none">⚪ Walang company / Shared (${shared})</option>`;
  if (vendorCo && ![...sel.options].some(o => o.value === vendorCo)) vendorCo = '';
  sel.value = vendorCo;
}
function vnCompanyChange() { const sel = document.getElementById('admin-vendor-company'); vendorCo = sel ? sel.value : ''; filterAdminVendors(); }
function vnVisible() {
  const q = (document.getElementById('admin-vendor-search') || {}).value || '';
  return allVendors.filter(v => {
    if (!(v.name || '').toLowerCase().includes(q.toLowerCase())) return false;
    if (!vendorCo) return true;
    if (vendorCo === '__none') return !vnCos(v).length;
    return vnCos(v).some(c => hubKey(c) === hubKey(vendorCo));
  });
}
async function loadAdminVendors() {
  const tbody = document.getElementById('admin-vendors-tbody');
  if(!tbody || !db) return;
  try {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align: center;">Loading vendors...</td></tr>';
    try { await superAdminLoad(); } catch (e) {}
    const snap = await db.collection('vendors').orderBy('name').get();
    allVendors = [];
    snap.forEach(d => allVendors.push({id: d.id, ...d.data()}));
    await vnFillCompanies(); vnApplyPerms();
    filterAdminVendors();
  } catch(e) { console.error(e); }
}

function filterAdminVendors() {
  const tbody = document.getElementById('admin-vendors-tbody');
  if(!tbody) return;
  const filtered = vnVisible(), ed = vnCanEdit();
  if(filtered.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align: center;">Walang vendor na nahanap.</td></tr>';
    return;
  }
  let html = '';
  filtered.forEach(v => {
    const cos = vnCos(v);
    html += `<tr>
      <td><b>${srchEsc(v.name)}</b></td>
      <td>${cos.length ? cos.map(c => `<span class="badge badge-success" style="margin-right:.2rem;">${srchEsc(c)}</span>`).join('') : '<span class="badge" style="background:#e2e8f0;color:#475569;">Shared</span>'}</td>
      <td>${srchEsc(v.contactPerson || '--')}</td>
      <td>${srchEsc(v.contactDetails || '--')}</td>
      <td>${srchEsc(v.address || '--')}</td>
      <td><span class="badge badge-warning">${srchEsc(v.terms || 'COD')}</span></td>
      <td>${ed ? `<button class="btn btn-sm btn-primary" onclick="openVendorModal('${v.id}')">Edit</button>
        <button class="btn btn-sm btn-danger" onclick="deleteVendor('${v.id}')">Del</button>` : '<small>👁️ View lang</small>'}</td>
    </tr>`;
  });
  tbody.innerHTML = html;
}

function vnCoChecks(sel) {
  const box = document.getElementById('vendor-companies'); if (!box) return;
  const names = vendorCoNames.slice(); sel.forEach(c => { if (!names.some(n => hubKey(n) === hubKey(c))) names.push(c); });
  box.innerHTML = names.length ? names.map(n => `<label style="display:inline-flex;gap:.3rem;align-items:center;margin:0 .8rem .3rem 0;font-weight:400;"><input type="checkbox" class="vn-co" value="${srchEsc(n)}" ${sel.some(c => hubKey(c) === hubKey(n)) ? 'checked' : ''}> ${srchEsc(n)}</label>`).join('') : '<small>Wala pang company. Magdagdag muna sa Company Management.</small>';
}
function openVendorModal(id = null) {
  if (!vnCanEdit()) { alert('Walang permiso na mag-edit ng vendors.'); return; }
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
      vnCoChecks(vnCos(v));
    }
  } else {
    document.getElementById('vendor-id').value = '';
    document.getElementById('vendor-name').value = '';
    document.getElementById('vendor-contact-person').value = '';
    document.getElementById('vendor-contact-details').value = '';
    document.getElementById('vendor-address').value = '';
    document.getElementById('vendor-terms').value = '';
    document.getElementById('vendor-modal-title').innerText = '➕ Add Vendor';
    vnCoChecks(vendorCo && vendorCo !== '__none' ? [vendorCo] : []);
  }
  document.getElementById('admin-vendor-modal').style.display = 'flex';
}

async function saveVendor() {
  if (!vnCanEdit()) { alert('Walang permiso na mag-edit ng vendors.'); return; }
  const id = document.getElementById('vendor-id').value;
  const name = document.getElementById('vendor-name').value.trim();
  if(!name) { alert('Kailangan ang Vendor Name.'); return; }
  const companies = [...document.querySelectorAll('#vendor-companies .vn-co:checked')].map(x => x.value);
  const payload = {
    name: name,
    companies: companies,
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
    try { await logSystemAction(id ? 'VENDOR_UPDATED' : 'VENDOR_ADDED', `${name} → ${companies.join(', ') || 'Shared'}`); } catch (e) {}
    alert('✅ Na-save ang Vendor!');
    document.getElementById('admin-vendor-modal').style.display = 'none';
    loadAdminVendors();
  } catch(e) { alert(e.message); }
}

async function deleteVendor(id) {
  if (!vnCanEdit()) { alert('Walang permiso na magbura ng vendor.'); return; }
  const v = allVendors.find(x => x.id === id) || {};
  if(!await uiConfirm(`Burahin ang vendor na "${v.name || id}"?`)) return;
  try { await db.collection('vendors').doc(id).delete(); try { await logSystemAction('VENDOR_DELETED', `${v.name || id} (${vnCos(v).join(', ') || 'Shared'})`); } catch (e) {} } catch (e) { alert(e.message); return; }
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
    // bigyan ng code ang mga lumang customer na walang code (admin lang)
    try {
      const nu = allCustomers.filter(c => !c.code);
      if (nu.length && normalizeRole((getCurrentUser() || {}).role) === 'admin') {
        const codes = nextCustomerCodes(allCustomers, nu.length); const b = db.batch();
        nu.forEach((c, i) => { c.code = codes[i]; b.update(db.collection('customers').doc(c.id), { code: c.code }); });
        await b.commit();
      }
    } catch (e) { console.warn('customer codes', e); }
    filterAdminCustomers();
  } catch(e) { console.error(e); }
}

function filterAdminCustomers() {
  const tbody = document.getElementById('admin-customers-tbody');
  const q = document.getElementById('admin-customer-search')?.value.toLowerCase() || '';
  if(!tbody) return;
  const filtered = allCustomers.filter(c => ((c.name||'') + ' ' + (c.code||'')).toLowerCase().includes(q));
  if(filtered.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align: center;">Walang customer na nahanap.</td></tr>';
    return;
  }
  let html = '';
  filtered.forEach(c => {
    html += `<tr>
      <td><b>${c.name}</b><br><small style="color:#64748b;font-family:monospace;">${c.code || ''}</small></td>
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
      if (document.getElementById('customer-code')) document.getElementById('customer-code').value = c.code || '';
      document.getElementById('customer-address').value = c.address || '';
      document.getElementById('customer-contact').value = c.contact || '';
      document.getElementById('customer-bank').value = c.bank || '';
      document.getElementById('customer-type').value = c.type || 'Retail';
      document.getElementById('customer-modal-title').innerText = '✏️ Edit Customer';
    }
  } else {
    document.getElementById('customer-id').value = '';
    document.getElementById('customer-name').value = '';
    if (document.getElementById('customer-code')) document.getElementById('customer-code').value = '';
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
    code: ((document.getElementById('customer-code') || {}).value || '').trim() || (id ? ((allCustomers.find(x => x.id === id) || {}).code || nextCustomerCodes(allCustomers, 1)[0]) : nextCustomerCodes(allCustomers, 1)[0]),
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
  if(!await uiConfirm('Burahin ang customer na ito?')) return;
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
  
  const _lk = ordLocked();
  const discountStr = _lk ? '0' : (document.getElementById('order-discount')?.value || '0');
  const vatOpt = _lk ? 'inclusive' : (document.getElementById('order-vat')?.value || 'inclusive');
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

  if (!await uiConfirm(`Tatanggapin ang ${qty} ${uomType==='whole'?prod.wholeUOM:prod.looseUOM} ng ${prod.itemName} mula kay ${vName}?

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
  const c = await uiPrompt("Ilagay ang Beginning Balance para sa CASH ON HAND (₱):", "0");
  if (c === null) return;
  const b = await uiPrompt("Ilagay ang Beginning Balance para sa BANK ACCOUNT (₱):", "0");
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
  const pin = await uiPrompt("🚨 ADMIN Z-READING RESET 🚨\n\nBurahin lahat ng transaction sa General Ledger at i-reset sa ZERO ang AP Invoices?\nI-type ang 'RESET' para mag-confirm:");
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
  const _ap = po.approvals || {};
  const scSigned = _ap.supplyChain ? `${_ap.supplyChain.by} <small>(${poFmtDate(_ap.supplyChain.at)})</small>` : (poCheckerName || '&nbsp;');
  const cooSigned = _ap.coo ? `${_ap.coo.by} <small>(${poFmtDate(_ap.coo.at)})</small>` : (poApproverName || '&nbsp;');
  
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
          <div style="border-bottom: 1px solid #0f172a; margin-bottom: 5px; font-weight: 700; min-height: 18px;">${scSigned}</div>
          <b>VERIFIED & CHECKED BY</b><br>
          <small style="color: #64748b;">${poCheckerTitle || 'Commissary / Supply Chain Head'}</small>
        </div>
        <div>
          <div style="border-bottom: 1px solid #0f172a; margin-bottom: 5px; font-weight: 700; min-height: 18px;">${cooSigned}</div>
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