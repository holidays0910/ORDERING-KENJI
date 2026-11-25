

// ========================================================
// ADMIN THREE-DOT QUICK NAVIGATION & PROFILE ENGINE
// ========================================================
function toggleAdminMenu() {
  const menu = document.getElementById('admin-dropdown-menu');
  if (menu) menu.style.display = menu.style.display === 'block' ? 'none' : 'block';
}

function switchAdminView(viewName) {
  if (window.KUSINA_PERMS && !['sessions', 'syshealth', 'menu_vis', 'help'].includes(viewName) && !canViewModule(viewName)) {
    alert('⚠️ Walang access ang account mo sa module na ito. Makipag-ugnayan kay Admin.');
    return;
  }
  setTimeout(() => applyReadonlyMode(viewName), 0);
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
    renderAccessControlManager();
  } else if (viewName === 'employees') {
    const el = document.getElementById('view-admin-employees');
    if (el) el.style.display = 'block';
    if(typeof loadAdminEmployees === 'function') loadAdminEmployees();
  } else if (viewName === 'payroll') {
    const el = document.getElementById('view-admin-payroll');
    if (el) el.style.display = 'block';
    if(typeof loadAdminPayroll === 'function') loadAdminPayroll();
  } else if (viewName === 'finance') {
    const el = document.getElementById('view-admin-finance');
    if (el) el.style.display = 'block';
    if(typeof loadAdminFinance === 'function') loadAdminFinance();
  } else if (viewName === 'vendors') {
    const el = document.getElementById('view-admin-vendors');
    if (el) el.style.display = 'block';
    if(typeof loadAdminVendors === 'function') loadAdminVendors();
  } else if (viewName === 'customers') {
    const el = document.getElementById('view-admin-customers');
    if (el) el.style.display = 'block';
    if(typeof loadAdminCustomers === 'function') loadAdminCustomers();
  } else if (viewName === 'manufacturing') {
    const el = document.getElementById('view-admin-manufacturing');
    if (el) el.style.display = 'block';
    loadManufacturing();
  } else if (viewName === 'costing') {
    const el = document.getElementById('view-admin-costing');
    if (el) el.style.display = 'block';
    if (typeof loadCosting === 'function') loadCosting();
  } else if (viewName === 'lot_tracing') {
    const el = document.getElementById('view-admin-lot_tracing');
    if (el) el.style.display = 'block';
    if (typeof loadLotTracing === 'function') loadLotTracing();
  } else if (viewName === 'vouchers') {
    const el = document.getElementById('view-admin-vouchers');
    if (el) el.style.display = 'block';
    if (typeof loadVouchers === 'function') loadVouchers();
  } else if (viewName === 'help') {
    const el = document.getElementById('view-admin-help');
    if (el) el.style.display = 'block';
    if (window.kHelp) { const u = getCurrentUser() || {}; kHelp.mount(document.getElementById('help-root'), { ctx: 'erp', user: { email: u.email, name: u.name }, admin: normalizeRole(u.role) === 'admin' || superAdminIsMe() }); }
  } else if (viewName === 'posdash') {
    const el = document.getElementById('view-admin-posdash');
    if (el) el.style.display = 'block';
    if (typeof loadPosDash === 'function') loadPosDash();
  } else if (viewName === 'subscriptions') {
    const el = document.getElementById('view-admin-subscriptions');
    if (el) el.style.display = 'block';
    if (typeof loadSubs === 'function') loadSubs();
  } else if (viewName === 'assets') {
    const el = document.getElementById('view-admin-assets');
    if (el) el.style.display = 'block';
    if (typeof loadAssets === 'function') loadAssets();
  } else if (viewName === 'auto_pr') {
    const el = document.getElementById('view-admin-auto_pr');
    if (el) el.style.display = 'block';
    if (typeof loadAutoPR === 'function') loadAutoPR();
  } else if (viewName === 'products') {
    const el = document.getElementById('view-admin-products');
    if (el) el.style.display = 'block';
    loadAdminProducts();
  } else if (viewName === 'stations') {
    const el = document.getElementById('view-admin-stations');
    if (el) el.style.display = 'block';
    loadStorageStations();
    loadUOMs();
    loadHubsManager();
  } else if (viewName === 'attendance') {
    const el = document.getElementById('view-admin-attendance');
    if (el) el.style.display = 'block';
    loadAttendance();
  } else if (viewName === 'requests') {
    const el = document.getElementById('view-admin-requests');
    if (el) el.style.display = 'block';
    loadRequests();
  } else if (viewName === 'hrdocs') {
    const el = document.getElementById('view-admin-hrdocs'); if (el) el.style.display = 'block'; loadHrDocs();
  } else if (viewName === 'pos') {
    const el = document.getElementById('view-admin-kpos'); if (el) el.style.display = 'block'; if (typeof loadPOS === 'function') loadPOS();
  } else if (viewName === 'prime') {
    const el = document.getElementById('view-admin-prime'); if (el) el.style.display = 'block'; if (typeof loadPrime === 'function') loadPrime();
  } else if (viewName === 'security') {
    const el = document.getElementById('view-admin-security'); if (el) el.style.display = 'block'; if (typeof loadSecurity === 'function') loadSecurity();
  } else if (viewName === 'acct') {
    const el = document.getElementById('view-admin-acct'); if (el) el.style.display = 'block'; if (typeof loadAcct === 'function') loadAcct();
  } else if (viewName === 'loans') {
    const el = document.getElementById('view-admin-loans'); if (el) el.style.display = 'block'; if (typeof loadLoans === 'function') loadLoans();
  } else if (viewName === 'lst') {
    const el = document.getElementById('view-admin-lst'); if (el) el.style.display = 'block'; if (typeof loadLST === 'function') loadLST();
  } else if (viewName === 'menu_vis') {
    const el = document.getElementById('view-admin-menu_vis'); if (el) el.style.display = 'block'; mvLoad();
  } else if (viewName === 'sessions') {
    const el = document.getElementById('view-admin-sessions'); if (el) el.style.display = 'block'; loadSessions();
  } else if (viewName === 'syshealth') {
    const el = document.getElementById('view-admin-syshealth'); if (el) el.style.display = 'block'; loadSysHealth();
  } else if (viewName === 'memos') {
    const el = document.getElementById('view-admin-memos');
    if (el) el.style.display = 'block';
    loadMemos();
  } else if (viewName === 'bom_mgmt') {
    const el = document.getElementById('view-admin-bom_mgmt'); if (el) el.style.display = 'block'; loadBomMgmt();
  } else if (viewName === 'sap_items') {
    const el = document.getElementById('view-admin-sap_items');
    if (el) el.style.display = 'block';
    loadSapItems();
  } else if (viewName === 'inv_totals') {
    const el = document.getElementById('view-admin-inv_totals');
    if (el) el.style.display = 'block';
    loadInvTotals();
  } else if (viewName === 'daily_prices') {
    const el = document.getElementById('view-admin-daily_prices');
    if (el) el.style.display = 'block';
    loadDailyPrices();
  } else if (viewName === 'ar_ledger') {
    const el = document.getElementById('view-admin-ar_ledger');
    if (el) el.style.display = 'block';
    loadArLedger();
  } else if (viewName === 'price_lists') {
    const el = document.getElementById('view-admin-price_lists');
    if (el) el.style.display = 'block';
    loadPriceLists();
  } else if (viewName === 'company_mgmt') {
    const el = document.getElementById('view-admin-company_mgmt');
    if (el) el.style.display = 'block';
    loadCompanyManagement();
  } else if (viewName === 'branch_inv') {
    const el = document.getElementById('view-admin-branch_inv');
    if (el) el.style.display = 'block';
    loadBranchInventoryAdmin();
  } else if (viewName === 'backups') {
    const el = document.getElementById('view-admin-backups');
    if (el) el.style.display = 'block';
    loadProductBackupLogs();
    try { dbbRender(); } catch (e) { console.warn(e); }
  } else if (viewName === 'disputes') {
    const el = document.getElementById('view-admin-disputes');
    if (el) el.style.display = 'block';
    loadAdminDisputes();
  } else if (viewName === 'spoilage') {
    const el = document.getElementById('view-admin-spoilage');
    if (el) el.style.display = 'block';
    if(typeof loadAdminSpoilageRequests === 'function') loadAdminSpoilageRequests();
  } else if (viewName === 'logs') {
    const el = document.getElementById('view-admin-logs');
    if (el) el.style.display = 'block';
    if(typeof loadSystemAuditLogs === 'function') loadSystemAuditLogs();
  } else if (viewName === 'purchase_orders') {
    const el = document.getElementById('view-admin-purchase-orders');
    if (el) el.style.display = 'block';
    if(typeof loadAdminVendorPOs === 'function') loadAdminVendorPOs();
  } else if (viewName === 'ap_invoices') {
    const el = document.getElementById('view-admin-ap-invoices');
    if (el) el.style.display = 'block';
    loadAdminAPInvoices();
  } else if (viewName === 'reports') {
    const el = document.getElementById('view-admin-reports');
    if (el) el.style.display = 'block';
  } else if (viewName === 'truncate') {
    const el = document.getElementById('view-admin-truncate');
    if (el) el.style.display = 'block';
  } else if (viewName === 'team') {
    const el = document.getElementById('view-admin-team');
    if (el) el.style.display = 'block';
    if(typeof loadCommissaryTeam === 'function') loadCommissaryTeam();
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
          <td>
            <div style="display: flex; gap: 0.35rem; align-items: center; flex-wrap: wrap;">
              <span class="badge badge-warning">${d.status || 'Pending Decision'}</span>
              <button class="btn btn-sm btn-primary" onclick="openDisputePOModal('${d.orderId || doc.id}')">🔍 Open PO</button>
            </div>
          </td>
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

  // Load Profile Photo into Preview
  const previewEl = document.getElementById('admin-prof-pic-preview');
  const fallbackEl = document.getElementById('admin-prof-pic-fallback');
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
    const updatePayload = {
      name: newName,
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
    if (userDisp) userDisp.innerText = `Admin: ${newName}`;
    logSystemAction('PROFILE_UPDATED', `In-update ni Admin ang profile/photo: ${newName}`);
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
      alert('⚠️ KAILANGAN NG SECURE (HTTPS) CONNECTION:\n\nHindi bubukas ang camera sa mobile browser kung hindi naka-HTTPS.\nSiguraduhing naka-host sa GitHub Pages (https://holidays0910.github.io).');
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
      alert('⚠️ CAMERA ACCESS BLOCKED / DENIED!\n\nHindi pinahintulutan ang paggamit ng camera sa browser settings.\n\nPAANO ITO PAYAGAN SA CELLPHONE:\n1. Pindutin ang lock / setting icon (🔒) sa tabi ng URL sa itaas ng browser.\n2. Piliin ang "Permissions" o "Site Settings".\n3. I-set ang Camera sa "Allow" o "Payagan".\n4. I-refresh ang pahina.');
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

  // Branch Inventory: scan ng item
  if (activeScannerContext === 'inv_count') { invHandleScan(scannedCode); return; }

  // Recipe Builder: scan ng sangkap
  if (activeScannerContext === 'bom_rm') { bomHandleScan(scannedCode); return; }

  // 0. Kapag galing sa Admin PO List Search Bar (Auto-paste & Auto-search)
  if (activeScannerContext === 'admin_po_list') {
    const searchInput = document.getElementById('admin-po-search');
    if (searchInput) {
      searchInput.value = cleanCode;
      filterAdminVendorPOs();
    }
    return;
  }

  // 1. Kapag galing sa Admin Product Search Bar (Auto-paste & Auto-search)
  if (activeScannerContext === 'admin_receive_po') {
    if (!activeReceivePOData || !activeReceivePOData.items) return;
    const matchIdx = activeReceivePOData.items.findIndex(i => {
      return (i.itemCode || '').toUpperCase() === cleanCode || (i.barcode || '').toUpperCase() === cleanCode;
    });
    if (matchIdx !== -1) {
      // Highlight row and focus input
      const row = document.getElementById(`recv-row-${matchIdx}`);
      if (row) {
        row.style.backgroundColor = '#fefce8';
        setTimeout(() => row.style.backgroundColor = '', 2000);
        const inputs = row.querySelectorAll('input[type="number"]');
        for (let inp of inputs) {
           if (!inp.disabled) {
             inp.focus();
             inp.select();
             break;
           }
        }
      }
    } else {
      alert(`⚠️ HINDI TUGMA: Ang Barcode (${cleanCode}) ay wala sa orihinal na PO na ito.`);
      setTimeout(() => openCameraBarcodeScanner('admin_receive_po'), 500);
    }
    return;
  }
  
  if (activeScannerContext === 'admin') {
    const searchInput = document.getElementById('admin-product-search');
    if (searchInput) {
      searchInput.value = cleanCode;
      filterAdminProductsTable();
    }
    return;
  }

  // 2. Kapag galing sa Admin Product Add / Edit Modal (Auto-paste)
  if (activeScannerContext === 'admin_edit_modal') {
    const barInput = document.getElementById('admin-item-barcode');
    if (barInput) {
      barInput.value = cleanCode;
      barInput.focus();
      barInput.dispatchEvent(new Event('input', { bubbles: true }));
    }
    return;
  }

  // 3. Kapag galing sa Commissary Inventory Search Bar (Auto-paste & Auto-search)
  if (activeScannerContext === 'commissary') {
    const searchInput = document.getElementById('comm-product-search');
    if (searchInput) {
      searchInput.value = cleanCode;
      filterCommissaryInventoryTable();
    }
    return;
  }

  // 4. Kapag galing sa Commissary Product Tagging / Edit Modal (Auto-paste)
  if (activeScannerContext === 'comm_edit_modal') {
    const barInput = document.getElementById('new-item-barcode');
    if (barInput) {
      barInput.value = cleanCode;
      barInput.focus();
      barInput.dispatchEvent(new Event('input', { bubbles: true }));
    }
    return;
  }

  // 5. Kapag galing sa Branch Receiving Counter-Check
  if (activeScannerContext === 'branch_receiving' || activeScannerContext === 'branch') {
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
      window.lastScannedItemIdx = matchedIdx;
      const item = branchReceivingChecklist[matchedIdx];
      const expectedWhole = item.wholeQty > 0 ? `${item.wholeQty} ${item.wholeUOM || 'W'}` : '';
      const expectedLoose = item.looseQty > 0 ? `${item.looseQty} ${item.looseUOM || 'L'}` : '';
      const expectedStr = [expectedWhole, expectedLoose].filter(Boolean).join(' + ') || '0';
      
      const detailsEl = document.getElementById('scan-confirm-details');
      if (detailsEl) {
         detailsEl.innerHTML = `
            <b style="font-size: 1.15rem; color: #1e293b; display: block; margin-bottom: 0.25rem;">${item.itemName}</b>
            <span style="font-size: 0.75rem; color: #64748b; background: #e2e8f0; padding: 2px 6px; border-radius: 4px;">Scanned Code: ${cleanCode}</span><br><br>
            <div style="font-size: 0.85rem; color: #475569;">Inaasahang Dami (Order Details):</div>
            <div style="font-size: 1.3rem; font-weight: 800; color: #059669;">${expectedStr}</div>
         `;
      }
      const modal = document.getElementById('branch-scan-confirm-modal');
      if (modal) modal.style.display = 'flex';
    } else {
      alert(`⚠️ HINDI TUGMA: Ang Barcode (${cleanCode}) ay wala sa listahan ng delivery na ito.\n\nPakisuri kung tamang item ang nai-baba ng truck.`);
      setTimeout(() => {
          openCameraBarcodeScanner('branch');
      }, 400);
    }
    return;
  }

  // 6. Kapag galing sa Branch Catalog Search
  if (activeScannerContext === 'comm_spoilage') {
    const searchIn = document.getElementById('comm-spoilage-search');
    if (searchIn) { searchIn.value = cleanCode; filterSpoilageProducts(); }
    const matchedProd = currentInventory.find(p => {
       const pos = (p.posCode || '').toUpperCase().trim();
       const sap = (p.sapCode || p.itemCode || p.id || '').toUpperCase().trim();
       const bar = (p.barcode || p.barcodeNumber || '').toUpperCase().trim();
       return pos === cleanCode || sap === cleanCode || bar === cleanCode;
    });
    if (matchedProd) onSpoilageProductSelect(matchedProd.id);
    return;
  }
  
  if (activeScannerContext === 'branch_pahabol') {
    const searchIn = document.getElementById('branch-pahabol-search');
    if (searchIn) {
      searchIn.value = cleanCode;
      filterPahabolProducts();
    }
    const matchedProd = branchProducts.find(p => {
      const pos = (p.posCode || '').toUpperCase().trim();
      const sap = (p.sapCode || p.itemCode || p.id || '').toUpperCase().trim();
      const bar = (p.barcode || p.barcodeNumber || '').toUpperCase().trim();
      return pos === cleanCode || sap === cleanCode || bar === cleanCode;
    });
    if (matchedProd) {
      onBranchPahabolProductSelect(matchedProd.id);
    }
    return;
  }
  
  if (activeScannerContext === 'branch_catalog') {
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
    }
    return;
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