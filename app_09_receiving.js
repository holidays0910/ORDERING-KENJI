


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
  ['recv-po-grpo','recv-po-sap-ap'].forEach(i=>{const e=document.getElementById(i); if(e) e.value='';});

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

  if (!await uiConfirm('I-save ang Actual Received Quantities? Awtomatiko nitong ia-update ang INVENTORY STOCK at ipapasok sa Accounts Payable (AP).')) return;

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
      if (!poIsApproved(poSnap.data())) throw new Error('Hindi pa APPROVED ang PO na ito (kailangan ang pirma ng Head of Supply Chain at COO) kaya hindi pa puwedeng i-receive.');
      if (poSnap.data().receivedAt) throw new Error('Na-receive na ang PO na ito dati pa. Hindi na puwedeng i-receive ulit para hindi madoble ang stock.');

      const isNI = !!poSnap.data().nonInventory; // galing sa Mga Request (serbisyo/gamit) — walang stock na idadagdag
      const prodRefs = isNI ? [] : recvItems.map(it => db.collection('products').doc(it.productId || it.itemCode));
      const prodSnaps = isNI ? [] : await Promise.all(prodRefs.map(r => tx.get(r)));
      const missingNames = isNI ? [] : recvItems.filter((it, idx) => !prodSnaps[idx].exists).map(it => it.itemName || it.itemCode);
      if (missingNames.length) throw new Error('Walang product record para sa: ' + missingNames.join(', '));

      // 1. Update PO Status to AP
      tx.update(poRef, {
        status: 'Received / AP',
        actualItems: recvItems,
        actualTotalAmount: actualGrandTotal,
        vendorInvoiceNo: invNo,
        grpoNo: (document.getElementById('recv-po-grpo')?.value || '').trim(),
        sapApInvoiceNo: (document.getElementById('recv-po-sap-ap')?.value || '').trim(),
        receivedBy: userName,
        receivedAt: firebase.firestore.FieldValue.serverTimestamp()
      });

      // 2. Update Inventory Stock + movement log
      if (!isNI) recvItems.forEach((item, idx) => {
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
    if (activeReceivePOData.requestKey) reqSyncFromPO(activeReceivePOData.requestKey, 'Delivered', `PO ${activeReceivePOData.poNumber} natanggap (GRPO ${(document.getElementById('recv-po-grpo')?.value || '').trim() || '—'})`);
    notify(['accounting'], `PO natanggap — para sa A/P: ${activeReceivePOData.poNumber}`, `${userName} ay nag-receive ng PO ${activeReceivePOData.poNumber} (${activeReceivePOData.vendorName}). Invoice: ${invNo}. Halaga: ${money(actualGrandTotal)}. Pakilagay ang GRPO#/A/P Invoice#.`);
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
      <td><b>${ap.poNumber}</b><br><small style="color: #b91c1c;">INV: ${ap.vendorInvoiceNo || '--'}</small>${poSapRefsHtml(ap)}</td>
      <td><b>${ap.vendorName}</b></td>
      <td>${rcvDate}</td>
      <td style="color: #64748b;"><s>${expTotal}</s></td>
      <td><b style="color: #059669; font-size: 1.05rem;">${actTotal}</b></td>
      <td><span class="badge ${badgeClass}">${st}</span>${ap.dpAmount ? `<br><small style="color:#7c3aed;">DP ${money(ap.dpAmount)} • Balance ${money(Math.max(0,parseFloat(ap.actualTotalAmount||0)-parseFloat(ap.dpAmount||0)))}</small>` : ''}</td>
      <td>
        <button class="btn btn-sm btn-secondary" style="margin-bottom:4px;" onclick="poEditSapRefs('${ap.id}')">🏷️ SAP Refs</button>
        ${st === 'Paid & Closed' ? '' : `<button class="btn btn-sm btn-secondary" style="margin-bottom:4px;" onclick="poDownPayment('${ap.id}')">💵 Down Payment</button>`}<br>
        <select onchange="updateAPPOStatus('${ap.id}', this.value)" style="font-size: 0.8rem; padding: 0.3rem 0.5rem; border-radius: 4px; border: 1px solid #cbd5e1;">
          <option value="Received / AP" ${st === 'Received / AP' ? 'selected' : ''}>1. Received / A/P Invoice (For Checking)</option>
          <option value="For Check Preparation" ${st === 'For Check Preparation' ? 'selected' : ''}>2. For Payment – Check Preparation</option>
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
    let posted = false, reqKey = '';

    await db.runTransaction(async tx => {
      const poSnap = await tx.get(poRef);
      if (!poSnap.exists) throw new Error('Hindi nahanap ang PO.');
      const po = poSnap.data(); reqKey = po.requestKey || '';

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
            credit: Math.max(0, parseFloat(po.actualTotalAmount || 0) - parseFloat(po.dpAmount || 0)),
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

    if (reqKey) { if (newStatus === 'Paid & Closed') reqSyncFromPO(reqKey, 'Paid', `PO ${poId} Paid & Closed (cheque na)`, { poStatus: 'Paid & Closed' }); else if (/Check|Deposit|Release/i.test(newStatus)) reqSyncFromPO(reqKey, 'For Payment', `Accounting: ${newStatus}`, { poStatus: newStatus }); }
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
  
  const sf = (document.getElementById('admin-employee-status') || {}).value || 'all';
  const stOk = e => { const s = e.status || 'Active'; return sf === 'all' || (sf === 'inactive' ? (s === 'Resigned' || s === 'Terminated') : s === sf); };
  const cnt = document.getElementById('admin-employee-count');
  if (cnt) { const act = hrEmployees.filter(e => (e.status || 'Active') === 'Active').length, ina = hrEmployees.filter(e => ['Resigned', 'Terminated'].includes(e.status)).length; cnt.textContent = `Total ${hrEmployees.length} · Active ${act} · Inactive ${ina} · On-Leave ${hrEmployees.length - act - ina}`; }
  const filtered = hrEmployees.filter(e => stOk(e) && ((e.name||'').toLowerCase().includes(q) || (e.role||'').toLowerCase().includes(q) || empCompanyList(e).join(' ').toLowerCase().includes(q) || String(e.empId || '').toLowerCase().includes(q)));
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
      <td><b>${e.name}</b>${empCompanyList(e).length ? '<div style="margin-top:3px;">' + empCompanyList(e).map(c => `<span class="co-chip">🏢 ${srchEsc(c)}</span>`).join('') + '</div>' : ''}</td>
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

async function addOtherEmployeeDoc() {
  const label = (await uiPrompt('Anong dokumento ito? (hal. Diploma, Training Certificate)') || '').trim();
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
  if (!await uiConfirm(`Burahin ang "${d.label || docId}" (${d.fileName || ''})? Hindi na ito mababawi.`)) return;
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
      
      renderCompanyChecks('hr-emp-companies', empCompanyList(e)); hrFillBranches(e.branchCode || '');
      document.getElementById('hr-emp-dept').value = e.dept || '';
      document.getElementById('hr-emp-subdept').value = e.subdept || '';
      document.getElementById('hr-emp-role').value = e.role || '';
      document.getElementById('hr-emp-class').value = e.classification || 'Rank & File';
      document.getElementById('hr-emp-type').value = e.employmentType || 'Regular';
      document.getElementById('hr-emp-hiredate').value = e.hireDate || '';
      document.getElementById('hr-emp-directdate').value = e.directHireDate || '';
      document.getElementById('hr-emp-regulardate').value = e.regularizationDate || '';
      document.getElementById('hr-emp-reportingto').value = e.reportingTo || '';
      { const x = document.getElementById('hr-emp-reportingto-id'); if (x) x.value = e.reportingToId || ''; const y = document.getElementById('hr-emp-reportingto-email'); if (y) y.value = e.reportingToEmail || ''; }
      document.getElementById('hr-emp-status').value = e.status || 'Active';
      { const lf = document.getElementById('hr-emp-loanforce'); if (lf) lf.checked = !!e.loanForce; const li = document.getElementById('hr-emp-loanforce-info'); if (li) li.innerHTML = (typeof lnForceInfoHtml === 'function') ? lnForceInfoHtml(e) : ''; }
      
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
      if (typeof lvBalLoad === 'function') lvBalLoad(e.email);
      document.getElementById('hr-emp-sssloan').value = e.sssLoan || '';
      document.getElementById('hr-emp-hdmfloan').value = e.hdmfLoan || '';
      document.getElementById('hr-emp-emerperson').value = e.emergencyContactPerson || '';
      document.getElementById('hr-emp-emerno').value = e.emergencyContactNo || '';

      document.getElementById('hr-emp-title').innerText = '✏️ Edit Employee';
      renderEmployeeDocsSection(e.id); if (typeof posHistRender === 'function') posHistRender(e.id);
    }
  } else {
    // Clear all fields
    const inputs = document.querySelectorAll('#hr-employee-modal input');
    inputs.forEach(i => { if (i.type === 'number') i.value = '0'; else i.value = ''; });
    document.getElementById('hr-emp-status').value = 'Active';
    { const z = document.getElementById('hr-emp-sil'); if (z) z.value = ''; const z2 = document.getElementById('hr-emp-vl'); if (z2) z2.value = ''; lvBal = { orig: null, email: '' }; if (typeof lvBalLoad === 'function') lvBalLoad(''); }
    { const lf = document.getElementById('hr-emp-loanforce'); if (lf) lf.checked = false; const li = document.getElementById('hr-emp-loanforce-info'); if (li) li.innerHTML = ''; }
    document.getElementById('hr-emp-civil').value = 'Single';
    document.getElementById('hr-emp-class').value = 'Rank & File';
    document.getElementById('hr-emp-type').value = 'Regular';
    document.getElementById('hr-emp-paytype').value = 'Daily';

    document.getElementById('hr-emp-title').innerText = '➕ Add Employee';
    renderCompanyChecks('hr-emp-companies', []); hrFillBranches('');
    renderEmployeeDocsSection(''); if (typeof posHistRender === 'function') posHistRender('');
  }
  if (typeof posAttach === 'function') posAttach();
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
    email: document.getElementById('hr-emp-email').value.trim().toLowerCase(),
    address: document.getElementById('hr-emp-address').value.trim(),
    
    companies: readCompanyChecks('hr-emp-companies') || [],
    company: (readCompanyChecks('hr-emp-companies') || []).join(', '),
    branchCode: (document.getElementById('hr-emp-branch') || {}).value || '',
    branch: (() => { const sel = document.getElementById('hr-emp-branch'); const o = sel && sel.options[sel.selectedIndex]; return o && sel.value ? (o.dataset.name || '') : ''; })(),
    dept: document.getElementById('hr-emp-dept').value.trim(),
    subdept: document.getElementById('hr-emp-subdept').value.trim(),
    role: document.getElementById('hr-emp-role').value.trim(),
    classification: document.getElementById('hr-emp-class').value,
    employmentType: document.getElementById('hr-emp-type').value,
    hireDate: document.getElementById('hr-emp-hiredate').value,
    directHireDate: document.getElementById('hr-emp-directdate').value,
    regularizationDate: document.getElementById('hr-emp-regulardate').value,
    reportingTo: document.getElementById('hr-emp-reportingto').value.trim(),
    reportingToId: ((document.getElementById('hr-emp-reportingto-id') || {}).value || '') && document.getElementById('hr-emp-reportingto').value.trim() ? document.getElementById('hr-emp-reportingto-id').value : '',
    reportingToEmail: ((document.getElementById('hr-emp-reportingto-email') || {}).value || '') && document.getElementById('hr-emp-reportingto').value.trim() ? document.getElementById('hr-emp-reportingto-email').value : '',
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
      { const lf = document.getElementById('hr-emp-loanforce'); if (lf && typeof lnForceSave === 'function') { try { await lnForceSave(id, lf.checked, oldEmp); } catch (le) { console.warn('loanForce:', le.message); } } }
      actionStr = diffLog.length > 0 ? `In-edit ang employee ${oldEmp?.empId || id}. Binago: ` + diffLog.join(', ') : `In-edit ang employee ${oldEmp?.empId || id} (Walang binago).`;
    } else {
      payload.empId = 'EMP-' + Date.now().toString().slice(-5);
      payload.createdAt = firebase.firestore.FieldValue.serverTimestamp();
      const newRef = await db.collection('employees').add(payload);
      newEmpId = newRef.id;
      { const lf = document.getElementById('hr-emp-loanforce'); if (lf && lf.checked && typeof lnForceSave === 'function') { try { await lnForceSave(newRef.id, true, { id: newRef.id, name: fullName }); } catch (le) {} } }
    }
    if (typeof posOnEmpSave === 'function') { try { await posOnEmpSave({ id: id || newEmpId, name: payload.name || fullName, email: payload.email, role: payload.role }); } catch (pe) { console.warn('pos:', pe.message); } }
    try { await lvBalSave(payload.email, payload.name || fullName); } catch (le) { alert('Hindi na-save ang leave balance: ' + le.message); }
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