

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
  const localChecker = localStorage.getItem('kusina_po_checker') || '';
  const localCheckerTitle = localStorage.getItem('kusina_po_checker_title') || '';
  const localApprover = localStorage.getItem('kusina_po_approver') || '';
  const localApproverTitle = localStorage.getItem('kusina_po_approver_title') || '';

  applyBrandingToUI(localName, localSub, localLogo, localTin, localAddr, localContact, localChecker, localCheckerTitle, localApprover, localApproverTitle);

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
      const bChecker = data.poChecker || localChecker;
      const bCheckerTitle = data.poCheckerTitle || localCheckerTitle;
      const bApprover = data.poApprover || localApprover;
      const bApproverTitle = data.poApproverTitle || localApproverTitle;
      
      localStorage.setItem('kusina_brand_name', bName);
      localStorage.setItem('kusina_brand_subtitle', bSub);
      if (bLogo) localStorage.setItem('kusina_brand_logo', bLogo);
      localStorage.setItem('kusina_brand_tin', bTin);
      localStorage.setItem('kusina_brand_address', bAddr);
      localStorage.setItem('kusina_brand_contact', bContact);
      localStorage.setItem('kusina_po_checker', bChecker);
      localStorage.setItem('kusina_po_checker_title', bCheckerTitle);
      localStorage.setItem('kusina_po_approver', bApprover);
      localStorage.setItem('kusina_po_approver_title', bApproverTitle);
      
      applyBrandingToUI(bName, bSub, bLogo, bTin, bAddr, bContact, bChecker, bCheckerTitle, bApprover, bApproverTitle);
    }
  } catch (err) {
    console.warn('Branding sync warning:', err);
  }
}

function applyBrandingToUI(brandName, brandSubtitle, brandLogo = null, brandTin = '', brandAddress = '', brandContact = '', poChecker = '', poCheckerTitle = '', poApprover = '', poApproverTitle = '') {
  const currentLogo = brandLogo !== null ? brandLogo : (localStorage.getItem('kusina_brand_logo') || '');
  const currentName = brandName || localStorage.getItem('kusina_brand_name') || 'KusinaERP';
  const currentSub = brandSubtitle || localStorage.getItem('kusina_brand_subtitle') || 'Secured Enterprise Portal (Firebase Auth & Firestore)';
  const currentTin = brandTin || localStorage.getItem('kusina_brand_tin') || '';
  const currentAddr = brandAddress || localStorage.getItem('kusina_brand_address') || '';
  const currentContact = brandContact || localStorage.getItem('kusina_brand_contact') || '';
  const currentChecker = poChecker || localStorage.getItem('kusina_po_checker') || '';
  const currentCheckerTitle = poCheckerTitle || localStorage.getItem('kusina_po_checker_title') || '';
  const currentApprover = poApprover || localStorage.getItem('kusina_po_approver') || '';
  const currentApproverTitle = poApproverTitle || localStorage.getItem('kusina_po_approver_title') || '';

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

  const inputChecker = document.getElementById('setting-brand-po-checker');
  const inputCheckerTitle = document.getElementById('setting-brand-po-checker-title');
  const inputApprover = document.getElementById('setting-brand-po-approver');
  const inputApproverTitle = document.getElementById('setting-brand-po-approver-title');

  if (inputChecker && !inputChecker.value) inputChecker.value = currentChecker;
  if (inputCheckerTitle && !inputCheckerTitle.value) inputCheckerTitle.value = currentCheckerTitle;
  if (inputApprover && !inputApprover.value) inputApprover.value = currentApprover;
  if (inputApproverTitle && !inputApproverTitle.value) inputApproverTitle.value = currentApproverTitle;
  
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
  const inputChecker = document.getElementById('setting-brand-po-checker');
  const inputCheckerTitle = document.getElementById('setting-brand-po-checker-title');
  const inputApprover = document.getElementById('setting-brand-po-approver');
  const inputApproverTitle = document.getElementById('setting-brand-po-approver-title');
  const fileInput = document.getElementById('setting-brand-logo');
  const saveBtn = document.querySelector('button[onclick="saveSystemBranding()"]');

  const brandName = (inputName ? inputName.value.trim() : '') || 'KusinaERP';
  const brandSubtitle = (inputSub ? inputSub.value.trim() : '') || 'Secured Enterprise Portal (Firebase Auth & Firestore)';
  const brandTin = inputTin ? inputTin.value.trim() : '';
  const brandAddr = inputAddr ? inputAddr.value.trim() : '';
  const brandContact = inputContact ? inputContact.value.trim() : '';
  const poChecker = inputChecker ? inputChecker.value.trim() : '';
  const poCheckerTitle = inputCheckerTitle ? inputCheckerTitle.value.trim() : '';
  const poApprover = inputApprover ? inputApprover.value.trim() : '';
  const poApproverTitle = inputApproverTitle ? inputApproverTitle.value.trim() : '';
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
      localStorage.setItem('kusina_po_checker', poChecker);
      localStorage.setItem('kusina_po_checker_title', poCheckerTitle);
      localStorage.setItem('kusina_po_approver', poApprover);
      localStorage.setItem('kusina_po_approver_title', poApproverTitle);
      if (finalLogo) {
        localStorage.setItem('kusina_brand_logo', finalLogo);
      }

      applyBrandingToUI(brandName, brandSubtitle, finalLogo, brandTin, brandAddr, brandContact, poChecker, poCheckerTitle, poApprover, poApproverTitle);

      if (typeof db !== 'undefined' && db) {
        await db.collection('system_settings').doc('branding').set({
          brandName: brandName,
          brandSubtitle: brandSubtitle,
          brandTin: brandTin,
          brandAddress: brandAddr,
          brandContact: brandContact,
          poChecker: poChecker,
          poCheckerTitle: poCheckerTitle,
          poApprover: poApprover,
          poApproverTitle: poApproverTitle,
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
  if (!await uiConfirm(`BABALA: Iba-rollback ang buong Product Masterlist sa bersyon ng backup (${backupDocId}). Sigurado ka ba?`)) return;
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
    await loadProductCosts();

    const headers = "POS_Code,SAP_Item_Code,Barcode,Item_Description,Commissary_Hub,Storage_Station,Whole_UOM,Loose_UOM,Whole_Price,Loose_Price,Conversion_Factor,Buffer_Limit,Packaging_Instructions,Cost_Whole,Cost_Loose\n";
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

      const _pc = productCosts[doc.id] || {};
      rows += `"${pos}","${sap}","${bar}","${name}","${hub}","${st}","${wu}","${lu}",${wp},${lp},${conv},${buf},"${pack}",${_pc.costWhole || 0},${_pc.costLoose || 0}\n`;
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
      // Mungkahi lang ito. HINDI na sine-save pagbukas ng modal; ang SI ay itatala lang kapag tinanggap ang order.
      getNextSINumber().then(nextSi => {
        siInput.value = nextSi;
        siInput.title = 'Mungkahing SI number. Mase-save lang kapag tinanggap ang order.';
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
      
      if (isEditable) {
        html += `<tr id="edit-row-${i.itemCode || i.id}">
          <td><b>${pos}</b><br><small>${sap}</small></td>
          <td><b>${i.itemName}</b><br><span class="badge badge-admin">📍 ${i.storageStation || 'Unassigned'}</span></td>
          <td><input type="number" id="edit-wqty-${i.itemCode || i.id}" value="${wQty}" step="0.5" style="width:60px;" onchange="recalcCommOrder('${i.itemCode || i.id}')"> ${i.wholeUOM || 'Whole'}</td>
          <td><input type="number" id="edit-lqty-${i.itemCode || i.id}" value="${lQty}" step="0.5" style="width:60px;" onchange="recalcCommOrder('${i.itemCode || i.id}')"> ${i.looseUOM || 'Loose'}</td>
          <td><input type="number" id="edit-wpx-${i.itemCode || i.id}" value="${wPrice}" step="0.01" style="width:70px;" onchange="recalcCommOrder('${i.itemCode || i.id}')">/W<br><input type="number" id="edit-lpx-${i.itemCode || i.id}" value="${lPrice}" step="0.01" style="width:70px;" onchange="recalcCommOrder('${i.itemCode || i.id}')">/L</td>
          <td><b id="edit-sub-${i.itemCode || i.id}">₱${sub.toFixed(2)}</b></td>
        </tr>`;
      } else {
        html += `<tr>
          <td><b>${pos}</b><br><small>${sap}</small></td>
          <td><b>${i.itemName}</b><br><span class="badge badge-admin">📍 ${i.storageStation || 'Unassigned'}</span></td>
          <td>${wQty} ${i.wholeUOM || 'Whole'}</td>
          <td>${lQty} ${i.looseUOM || 'Loose'}</td>
          <td>₱${wPrice}/W | ₱${lPrice}/L</td>
          <td><b>₱${sub.toFixed(2)}</b></td>
        </tr>`;
      }
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
  if (!siInput || !poInput || siInput.disabled) return;

  try {
    const siVal = siInput.value.trim();
    const poVal = poInput.value.trim();
    const orderRef = db.collection('orders').doc(activeCommissaryOrderId);
    const seqRef = db.collection('system_settings').doc('invoice_sequence');

    // Iwasan ang dobleng SI number
    if (siVal) {
      const dup = await db.collection('orders').where('siNumber', '==', siVal).get();
      if (dup.docs.some(d => d.id !== activeCommissaryOrderId)) {
        alert(`⚠️ Ginamit na ang SI number na ${siVal} sa ibang order. Pumili ng ibang numero.`);
        return;
      }
    }

    await db.runTransaction(async tx => {
      const num = /^SI-\d+$/i.test(siVal) ? parseInt(siVal.slice(3), 10) : NaN;
      const seqSnap = !isNaN(num) ? await tx.get(seqRef) : null;
      tx.update(orderRef, { siNumber: siVal, manualPoNumber: poVal, poNumber: poVal });
      // Ang sequence ay tumataas lang, hindi bumababa (para walang umuulit na numero)
      if (seqSnap && num > (seqSnap.exists ? (parseInt(seqSnap.data().lastSI, 10) || 0) : 0)) {
        tx.set(seqRef, { lastSI: num }, { merge: true });
      }
    });

    const order = currentOrders.find(o => o.id === activeCommissaryOrderId);
    if (order) {
      order.siNumber = siVal;
      order.manualPoNumber = poVal;
      order.poNumber = poVal;
    }
    logSystemAction('SI_PO_UPDATED', `Binago ang SI/PO details ng order: ${activeCommissaryOrderId}`);
    if (ind) {
      ind.style.display = 'flex';
      setTimeout(() => ind.style.display = 'none', 2000);
    }
  } catch (e) {
    console.warn("Failed saving SI/PO", e);
    alert('Error sa pag-save ng SI/PO: ' + e.message);
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