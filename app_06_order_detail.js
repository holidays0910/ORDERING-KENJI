


// ========================================================
// ORDER INVESTIGATION & ADMIN CANCELLATION APPROVAL ENGINE
// ========================================================
function viewOrderInvestigationDetails(orderId) {
  const order = (typeof currentOrders !== 'undefined' ? currentOrders : []).find(o => o.id === orderId) ||
                (typeof branchPastOrdersList !== 'undefined' ? branchPastOrdersList : []).find(o => o.id === orderId);
  
  if (!order) {
    if (typeof db !== 'undefined' && db) {
      db.collection('orders').doc(orderId).get().then(doc => {
        if (doc.exists) {
          renderInvestigationModal({ id: doc.id, ...doc.data() });
        } else {
          alert('Hindi nahanap ang detalye ng order.');
        }
      }).catch(err => alert('Error: ' + err.message));
    } else {
      alert('Hindi nahanap ang detalye ng order.');
    }
    return;
  }

  renderInvestigationModal(order);
}

function renderInvestigationModal(order) {
  const u = getCurrentUser();
  const isAdmin = u && (u.role === 'admin' || (u.role && u.role.toLowerCase().includes('admin')));

  let itemsHtml = (order.items || []).map(i => {
    const whole = i.wholeQty > 0 ? `${i.wholeQty} ${i.wholeUOM || 'Box'}` : '';
    const loose = i.looseQty > 0 ? `${i.looseQty} ${i.looseUOM || 'Pcs'}` : '';
    const qtyStr = [whole, loose].filter(Boolean).join(' + ') || '0 unit';
    const subtotal = parseFloat(i.subtotal || 0).toLocaleString('en-PH', { style: 'currency', currency: 'PHP' });
    return `<li style="margin-bottom: 4px;"><b>${i.itemName || 'Item'}</b>: ${qtyStr} &mdash; <span style="color: #2563eb; font-weight: 700;">${subtotal}</span></li>`;
  }).join('');

  const reason = order.cancellationReason || order.disputeNotes || order.cancelReason || 'Walang nakasaad na espesyal na dahilan.';
  const totalAmount = parseFloat(order.totalAmount || 0).toLocaleString('en-PH', { style: 'currency', currency: 'PHP' });

    let showLateReturnBtn = '';
  if (!isAdmin && order.status.includes('Completed') && order.receivedAt) {
    const rcvDate = order.receivedAt.toDate ? order.receivedAt.toDate() : new Date(order.receivedAt);
    const now = new Date();
    const diffTime = Math.abs(now - rcvDate);
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays <= 7) {
      const daysLeft = 7 - diffDays;
      showLateReturnBtn = `<button type="button" class="btn btn-warning btn-sm" style="font-weight: 700;" onclick="openLateReturnModal('${order.id}')">🔄 Late Return (${daysLeft} days left)</button>`;
    } else {
      showLateReturnBtn = `<button type="button" class="btn btn-secondary btn-sm" disabled title="Lumampas na sa 7-day limit">🚫 Return Expired</button>`;
    }
  }
  
  let modal = document.getElementById('investigation-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'investigation-modal';
    modal.className = 'modal-overlay';
    document.body.appendChild(modal);
  }

  modal.innerHTML = `
    <div class="modal-content" style="max-width: 550px;">
      <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #e2e8f0; padding-bottom: 0.5rem; margin-bottom: 1rem;">
        <h3 style="margin: 0; color: #1e293b;">🔍 Order Investigation & Audit Details</h3>
        <button type="button" class="btn btn-secondary btn-sm" onclick="document.getElementById('investigation-modal').style.display='none'">✕</button>
      </div>
      <div style="font-size: 0.9rem; line-height: 1.6; color: #334155;">
        <p><b>Order Reference:</b> <span style="color: #2563eb; font-weight: 800;">${order.orderId || order.id}</span></p>
        <p><b>Branch Destination:</b> ${order.branchName || 'Branch'}</p>
        <p><b>Delivery Address:</b> ${order.branchAddress || '--'}</p>
        <p><b>Target Delivery Date:</b> ${order.targetDeliveryDate || 'ASAP'}</p>
        <p><b>Current Status:</b> <span class="badge badge-warning">${order.status || 'Pending'}</span></p>
        <div style="background: #fef2f2; border-left: 4px solid #ef4444; padding: 0.6rem 0.8rem; margin: 0.75rem 0; border-radius: 4px;">
          <b style="color: #991b1b;">Dahilan ng Pag-cancel / Reklamo (Dispute Notes):</b><br>
          <span style="color: #7f1d1d;">${reason}</span>
        </div>
        <b>Talaan ng mga Produkto sa Order:</b>
        <ul style="padding-left: 1.25rem; margin: 0.5rem 0 1rem 0;">
          ${itemsHtml || '<li>Walang items.</li>'}
        </ul>
        <div style="text-align: right; font-size: 1.1rem; font-weight: 800; border-top: 1px solid #e2e8f0; padding-top: 0.5rem;">
          Kabuuang Halaga: <span style="color: #2563eb;">${totalAmount}</span>
        </div>
      </div>
      <div style="margin-top: 1.25rem; display: flex; justify-content: flex-end; gap: 0.5rem; border-top: 1px solid #e2e8f0; padding-top: 0.75rem;">
        <button type="button" class="btn btn-secondary btn-sm" onclick="document.getElementById('investigation-modal').style.display='none'">Isara</button>
        ${isAdmin ? `<button type="button" class="btn btn-danger btn-sm" style="font-weight: 700;" onclick="confirmAdminCancellation('${order.id}')">Approve Cancellation (Admin)</button>` : ''}
        ${showLateReturnBtn}
      </div>
    </div>
  `;
  modal.style.display = 'flex';
}

async function confirmAdminCancellation(orderId) {
  if (!await uiConfirm("Kumpirmahin: Aprubahan ang cancellation ng order na ito bilang Admin?")) return;
  if (typeof db === 'undefined' || !db) return;

  try {
    const res = await applyOrderStock(orderId, 'restock', {
      status: 'Cancelled & Approved by Admin',
      approvedCancellationBy: getCurrentUser() ? getCurrentUser().email : 'Admin'
    });
    logSystemAction('ORDER_CANCELLED_ADMIN', `Sapilitang kinansela ni Admin ang PO: ${orderId}. ${res.applied ? 'Naibalik ang stock.' : 'Walang naibawas na stock.'}`);
    alert("✅ Matagumpay na na-approve ang cancellation ng order.");
    const m = document.getElementById('investigation-modal');
    if (m) m.style.display = 'none';
    if (typeof loadIncomingOrders === 'function') loadIncomingOrders();
    if (typeof loadBranchDeliveries === 'function') loadBranchDeliveries();
  } catch (err) {
    alert("Error sa pag-approve: " + err.message);
  }
}


// ========================================================
// DISPUTE / DAMAGE RESOLUTION & OPEN PO DECISION ENGINE
// ========================================================
function openDisputePOModal(orderId) {
  const order = (typeof currentOrders !== 'undefined' ? currentOrders : []).find(o => o.id === orderId) ||
                (typeof branchPastOrdersList !== 'undefined' ? branchPastOrdersList : []).find(o => o.id === orderId);

  if (!order) {
    if (typeof db !== 'undefined' && db) {
      db.collection('orders').doc(orderId).get().then(doc => {
        if (doc.exists) {
          renderDisputePOModal({ id: doc.id, ...doc.data() });
        } else {
          alert('Hindi nahanap ang PO record.');
        }
      }).catch(err => alert('Error: ' + err.message));
    } else {
      alert('Hindi nahanap ang PO record.');
    }
    return;
  }

  renderDisputePOModal(order);
}

function renderDisputePOModal(order) {
  const u = getCurrentUser();
  const isAdmin = u && (u.role === 'admin' || (u.role && u.role.toLowerCase().includes('admin')));

  let rowsHtml = '';
  (order.items || []).forEach((item, idx) => {
    const whole = item.wholeQty > 0 ? `${item.wholeQty} ${item.wholeUOM || 'Box'}` : '';
    const loose = item.looseQty > 0 ? `${item.looseQty} ${item.looseUOM || 'Pcs'}` : '';
    const expectedQty = [whole, loose].filter(Boolean).join(' + ') || '0 unit';
    const subtotal = parseFloat(item.subtotal || 0).toLocaleString('en-PH', { style: 'currency', currency: 'PHP' });

    rowsHtml += `
      <tr>
        <td><b>${item.itemName || 'Item'}</b><br><small style="color: #64748b;">${item.itemCode || item.id || ''}</small></td>
        <td>${item.storageStation || 'General'}</td>
        <td><b>${expectedQty}</b></td>
        <td><span style="color: #059669; font-weight: 700;">${subtotal}</span></td>
      </tr>
    `;
  });

  const notes = order.disputeNotes || order.cancellationReason || order.cancelReason || 'Walang nakatalang detalye.';
  const totalAmount = parseFloat(order.totalAmount || 0).toLocaleString('en-PH', { style: 'currency', currency: 'PHP' });

  let modal = document.getElementById('dispute-decision-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'dispute-decision-modal';
    modal.className = 'modal-overlay';
    document.body.appendChild(modal);
  }

  modal.innerHTML = `
    <div class="modal-content" style="max-width: 680px; width: 95%; max-height: 90vh; overflow-y: auto;">
      <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #e2e8f0; padding-bottom: 0.5rem; margin-bottom: 1rem;">
        <div>
          <h3 style="margin: 0; color: #1e293b;">📋 Open PO & Discrepancy Investigation</h3>
          <small style="color: #64748b;">PO Reference: <b style="color: #2563eb;">${order.orderId || order.id}</b></small>
        </div>
        <button type="button" class="btn btn-secondary btn-sm" onclick="document.getElementById('dispute-decision-modal').style.display='none'">✕</button>
      </div>

      <div style="font-size: 0.9rem; line-height: 1.5; color: #334155; margin-bottom: 1rem;">
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem; background: #f8fafc; padding: 0.75rem; border-radius: 0.375rem; margin-bottom: 0.75rem;">
          <div><b>Branch:</b> ${order.branchName || 'Branch'}</div>
          <div><b>Target Date:</b> ${order.targetDeliveryDate || 'ASAP'}</div>
          <div><b>Status:</b> <span class="badge badge-warning">${order.status || 'Disputed'}</span></div>
          <div><b>Driver / Transporter:</b> ${order.driverName || '--'}</div>
        </div>

        <div style="background: #fef2f2; border-left: 4px solid #ef4444; padding: 0.6rem 0.8rem; margin-bottom: 0.75rem; border-radius: 4px;">
          <b style="color: #991b1b;">⚠️ Damage / Discrepancy Report mula sa Branch:</b><br>
          <span style="color: #7f1d1d;">${notes}</span>
        </div>

        <b style="display: block; margin-bottom: 0.35rem;">Talaan ng mga Produkto sa PO:</b>
        <div class="table-responsive" style="max-height: 200px; overflow-y: auto; border: 1px solid #e2e8f0; border-radius: 4px; margin-bottom: 0.5rem;">
          <table>
            <thead>
              <tr>
                <th>Produkto</th>
                <th>Station</th>
                <th>Inaasahang Qty</th>
                <th>Subtotal</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml || '<tr><td colspan="4" style="text-align: center; color: #94a3b8;">Walang items.</td></tr>'}
            </tbody>
          </table>
        </div>

        <div style="text-align: right; font-size: 1.1rem; font-weight: 800; padding-top: 0.5rem;">
          Kabuuang Halaga ng PO: <span style="color: #2563eb;">${totalAmount}</span>
        </div>
      </div>

      <div style="border-top: 2px solid #e2e8f0; padding-top: 0.75rem;">
        <b style="display: block; margin-bottom: 0.5rem; font-size: 0.85rem; text-transform: uppercase; color: #475569;">
          ${isAdmin ? '⚖️ Mga Desisyon ni Admin (Operations & Accounting):' : '🔒 View Only (Si Admin lamang ang may desisyon):'}
        </b>
        <div style="display: flex; gap: 0.5rem; flex-wrap: wrap; justify-content: flex-end;">
          <button type="button" class="btn btn-secondary btn-sm" onclick="document.getElementById('dispute-decision-modal').style.display='none'">Isara</button>
          ${isAdmin ? `
            <button type="button" class="btn btn-warning btn-sm" style="font-weight: 700;" onclick="adminResolveDispute('${order.id}', 'DECLARE_LOSS')">
              🗑️ I-deklara bilang Loss (Bawas sa Singil)
            </button>
            <button type="button" class="btn btn-primary btn-sm" style="font-weight: 700;" onclick="adminResolveDispute('${order.id}', 'REOPEN_PO')">
              🔄 Re-open PO (Ipadala Ulit / Replacement)
            </button>
            <button type="button" class="btn btn-danger btn-sm" style="font-weight: 700;" onclick="adminResolveDispute('${order.id}', 'CANCEL_PO')">
              ❌ Kanselahin ang Buong PO
            </button>
          ` : ''}
        </div>
      </div>
    </div>
  `;
  modal.style.display = 'flex';
}

async function adminResolveDispute(orderId, actionType) {
  if (typeof db === 'undefined' || !db) {
    alert('Walang koneksyon sa database.');
    return;
  }

  const u = getCurrentUser();
  const adminEmail = u ? (u.email || u.name) : 'Admin';

  if (actionType === 'DECLARE_LOSS') {
    if (!await uiConfirm('Kumpirmahin: I-deklara ang sira bilang Inventory Loss at hindi sisingilin sa Branch?')) return;
    try {
      await db.collection('orders').doc(orderId).update({
        status: 'Closed - Declared as Inventory Loss & Deducted from Bill',
        adminResolution: 'Inventory Loss / Shrinkage',
        resolvedBy: adminEmail,
        resolvedAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      logSystemAction('DISPUTE_RESOLVED', `Idineklara ni Admin na Loss ang issue sa PO: ${orderId}`);
      alert('✅ Naitala ang Inventory Loss. Hindi ito sisingilin sa branch.');
      closeDisputeDecisionModal();
    } catch (e) { alert('Error: ' + e.message); }
  } else if (actionType === 'REOPEN_PO') {
    if (!await uiConfirm('Kumpirmahin: I-reopen ang PO upang maihanda muli ng Commissary ang replacement?')) return;
    try {
      await db.collection('orders').doc(orderId).update({
        status: 'Pending Preparation (For Replacement / Re-dispatch)',
        adminResolution: 'Reopened for Replacement',
        resolvedBy: adminEmail,
        resolvedAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      logSystemAction('DISPUTE_RESOLVED', `Ini-reopen ni Admin ang PO para sa replacement: ${orderId}`);
      alert('🔄 Na-reopen ang PO! Makikita na ito muli sa picking queue ng Commissary.');
      closeDisputeDecisionModal();
    } catch (e) { alert('Error: ' + e.message); }
  } else if (actionType === 'CANCEL_PO') {
    if (!await uiConfirm('Kumpirmahin: Kanselahin nang tuluyan ang buong PO?')) return;
    try {
      await db.collection('orders').doc(orderId).update({
        status: 'Cancelled by Admin',
        adminResolution: 'Full PO Cancelled',
        resolvedBy: adminEmail,
        resolvedAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      logSystemAction('DISPUTE_RESOLVED', `Kinansela ni Admin ang buong disputed PO: ${orderId}`);
      alert('❌ Na-kansela na ang buong PO.');
      closeDisputeDecisionModal();
    } catch (e) { alert('Error: ' + e.message); }
  }
}

function closeDisputeDecisionModal() {
  const m = document.getElementById('dispute-decision-modal');
  if (m) m.style.display = 'none';
  if (typeof loadAdminDisputes === 'function') loadAdminDisputes();
  if (typeof loadIncomingOrders === 'function') loadIncomingOrders();
  if (typeof loadBranchDeliveries === 'function') loadBranchDeliveries();
}



// ========================================================
// DATABASE TESTING & TRUNCATE TOOL (ADMIN ONLY)
// ========================================================
async function truncateCollection(collectionName) {
  const u = getCurrentUser();
  if (!u || normalizeRole(u.role) !== 'admin') {
    alert('Access Denied: Si Head Office Admin lamang ang may karapatang mag-truncate ng data.');
    return;
  }
  if (!(await secNeed4('truncate', 'Burahin ang collection: ' + collectionName))) return;
  if (collectionName === 'users') {
    alert('Hindi puwedeng i-truncate ang Users dito para hindi mawala ang mga login.');
    return;
  }

  const conf = await uiPrompt(`⚠️ BABALA SA PAG-TRUNCATE:
Buburahin ang LAHAT ng laman ng "${collectionName}" collection. Hindi magagalaw ang Users at Logins.

Awtomatiko kang makakakuha ng backup file (JSON) bago ito burahin.
I-type ang eksaktong pangalan ng collection ("${collectionName}") upang kumpirmahin:`);
  if (conf !== collectionName) {
    alert('Hindi itinuloy ang pag-truncate.');
    return;
  }

  if (typeof db === 'undefined' || !db) {
    alert('Walang koneksyon sa database.');
    return;
  }

  try {
    const snap = await db.collection(collectionName).get();
    if (snap.empty) {
      alert(`Walang laman ang "${collectionName}". Walang kailangang burahin.`);
      return;
    }

    // 1. AWTOMATIKONG BACKUP (download) bago burahin
    const dump = {
      collection: collectionName,
      exportedAt: new Date().toISOString(),
      exportedBy: u.email || u.name || 'admin',
      count: snap.size,
      docs: snap.docs.map(d => ({ id: d.id, data: d.data() }))
    };
    const blob = new Blob([JSON.stringify(dump, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `BACKUP_${collectionName}_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);

    if (!await uiConfirm(`Na-download ang backup (${snap.size} dokumento).\n\nSigurado ka pa rin bang buburahin ang "${collectionName}"? Hindi na ito mababawi maliban sa backup file.`)) {
      alert('Hindi itinuloy ang pag-truncate. Ligtas pa ang data.');
      return;
    }

    // 2. BURAHIN nang paunti-unti (limit ng Firestore: 500 kada batch)
    const docs = snap.docs;
    for (let i = 0; i < docs.length; i += 400) {
      const batch = db.batch();
      docs.slice(i, i + 400).forEach(d => batch.delete(d.ref));
      await batch.commit();
    }

    logSystemAction('DATA_TRUNCATED', `BINURA ni Admin ang buong collection na: ${collectionName} (${snap.size} docs, may backup file)`);
    uiAlert(`✅ Tagumpay! Na-truncate na ang "${collectionName}" (${snap.size} dokumento ang nabura). Itabi ang backup file.`).then(() => location.reload());
  } catch (err) {
    console.error('Truncate error:', err);
    alert('Error sa pag-truncate: ' + err.message);
  }
}


// ==========================================================================
// PWA SERVICE WORKER & APP UPDATE RESTART ENGINE
// ==========================================================================
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').then(reg => {
      console.log('KusinaERP Service Worker Registered:', reg.scope);

      // Tingnan kung may bagong update habang bukas ang app
      reg.addEventListener('updatefound', () => {
        const newWorker = reg.installing;
        if (newWorker) {
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              notifyUserOfUpdate();
            }
          });
        }
      });
    }).catch(err => {
      console.warn('Service Worker registration failed:', err);
    });
  });
}

async function notifyUserOfUpdate() {
  const confirmUpdate = await uiConfirm('🚀 May bagong update ang KusinaERP!\n\nPindutin ang "OK" upang i-restart at i-apply ang pinakabagong update.');
  if (confirmUpdate) {
    forceAppUpdateAndRestart();
  }
}

// Function na tatawagin kapag pinindot ang "🔄 I-update ang App" button
async function checkAndTriggerAppUpdate() {
  const confirmRestart = await uiConfirm('🔄 I-UPDATE AT I-RESTART ANG APP?\n\nKukunin ng system ang pinakabagong bersyon mula sa server at magre-reload ang app upang ma-apply ang lahat ng pagbabago (Branding, Logo, Code).\n\nNais mo bang magpatuloy?');
  if (!confirmRestart) return;

  await forceAppUpdateAndRestart();
}

async function forceAppUpdateAndRestart() {
  // 1. Burahin ang lahat ng lumang cache
  if ('caches' in window) {
    try {
      const keys = await caches.keys();
      await Promise.all(keys.map(k => caches.delete(k)));
      console.log('Lahat ng cache ay nalinis.');
    } catch (e) {
      console.warn('Error clearing caches:', e);
    }
  }

  // 2. I-update ang Service Worker
  if ('serviceWorker' in navigator) {
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      if (reg) {
        await reg.update();
        if (reg.waiting) {
          reg.waiting.postMessage({ action: 'skipWaiting' });
        }
      }
    } catch (e) {
      console.warn('Error updating service worker:', e);
    }
  }

  // 3. I-reload ang app nang sapilitan (Hard Reload)
  setTimeout(() => {
    window.location.reload(true);
  }, 400);
}



function updateDynamicManifest(brandName, logoBase64) {
  try {
    const appName = brandName || localStorage.getItem('kusina_brand_name') || 'KusinaERP';
    const appIcon = logoBase64 || localStorage.getItem('kusina_brand_logo') || 'https://cdn-icons-png.flaticon.com/512/1046/1046784.png';

    const dynamicManifestObj = {
      name: appName,
      short_name: appName.length > 12 ? appName.substring(0, 12) : appName,
      start_url: './index.html',
      display: 'standalone',
      background_color: '#0f172a',
      theme_color: '#2563eb',
      icons: [
        {
          src: appIcon,
          sizes: '192x192',
          type: 'image/png'
        },
        {
          src: appIcon,
          sizes: '512x512',
          type: 'image/png'
        }
      ]
    };

    const stringManifest = JSON.stringify(dynamicManifestObj);
    const blob = new Blob([stringManifest], { type: 'application/json' });
    const manifestURL = URL.createObjectURL(blob);

    let manifestTag = document.getElementById('dynamic-manifest') || document.querySelector('link[rel="manifest"]');
    if (!manifestTag) {
      manifestTag = document.createElement('link');
      manifestTag.rel = 'manifest';
      manifestTag.id = 'dynamic-manifest';
      document.head.appendChild(manifestTag);
    }
    manifestTag.setAttribute('href', manifestURL);

    // Dynamic Apple Touch Icon
    let appleIcon = document.querySelector('link[rel="apple-touch-icon"]');
    if (!appleIcon) {
      appleIcon = document.createElement('link');
      appleIcon.rel = 'apple-touch-icon';
      document.head.appendChild(appleIcon);
    }
    if (appIcon) {
      appleIcon.href = appIcon;
    }
  } catch (err) {
    console.warn('Error updating dynamic manifest:', err);
  }
}



// ==========================================================================
// PROFILE PHOTO COMPRESSOR & AUTO-SYNC ENGINE
// ==========================================================================
async function previewProfilePhoto(event, previewId, fallbackId) {
  const file = event.target.files && event.target.files[0];
  if (!file) return;

  try {
    // I-compress pababa sa 200x200 max resolution para 25KB-40KB lang ang laki (hindi haharangin ng database)
    const compressedBase64 = await compressProfileImage(file, 200, 200);

    const previewEl = document.getElementById(previewId);
    const fallbackEl = document.getElementById(fallbackId);
    if (previewEl) {
      previewEl.src = compressedBase64;
      previewEl.style.display = 'inline-block';
    }
    if (fallbackEl) fallbackEl.style.display = 'none';

    window.tempSelectedProfilePhoto = compressedBase64;
  } catch (err) {
    alert('⚠️ Error sa pagbasa ng larawan: ' + err.message);
  }
}

function compressProfileImage(file, maxWidth = 200, maxHeight = 200) {
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

        // JPEG 0.82 quality para mababa sa 50KB ang output
        resolve(canvas.toDataURL('image/jpeg', 0.82));
      };
      img.onerror = reject;
    };
    reader.onerror = reject;
  });
}

async function syncUserProfileFromFirestore() {
  const u = getCurrentUser();
  if (!u || !u.email || typeof db === 'undefined' || !db) return;

  try {
    const doc = await db.collection('users').doc(u.email.toLowerCase()).get();
    if (doc.exists) {
      const data = doc.data();
      let updated = false;

      if (data.photoUrl && data.photoUrl !== u.photoUrl) {
        u.photoUrl = data.photoUrl;
        updated = true;
      }
      if (data.address && data.address !== u.address) {
        u.address = data.address;
        updated = true;
      }
      if (data.name && data.name !== u.name) {
        u.name = data.name;
        updated = true;
      }

      if (JSON.stringify(data.branches || []) !== JSON.stringify(u.branches || [])) { u.branches = data.branches || []; updated = true; }
      if (updated) setCurrentUser(u);

      if (!sessionStorage.getItem('session_logged')) {
         sessionStorage.setItem('session_logged', 'true');
         logSystemAction('LOGIN', 'User logged in / Session started');
      }


      // Ipakita ang profile photo sa navbar
      if (u.photoUrl) {
        document.querySelectorAll('.user-avatar-img').forEach(img => {
          img.src = u.photoUrl;
          img.style.display = 'inline-block';
        });
        document.querySelectorAll('.user-avatar-initials').forEach(el => {
          el.style.display = 'none';
        });
      }
    }
  } catch (err) {
    console.warn('Profile sync error:', err);
  }
}

function checkRequiredAddressSetup() {
  // Maghintay ng 1.5 segundo upang makumpleto muna ang syncUserProfileFromFirestore()
  setTimeout(() => {
    // Kunin ang pinakabagong data mula sa local storage pagkatapos mag-sync
    const u = getCurrentUser(); 
    if (!u || u.role === 'admin') return;

    // Bubuksan lang ang modal KUNG walang address O walang profile picture
    if (!u.address || u.address.trim() === '' || !u.photoUrl) {
      if (u.role === 'branch' && typeof openBranchProfileModal === 'function') {
        openBranchProfileModal();
      } else if (u.role === 'commissary' && typeof openCommissaryProfileModal === 'function') {
        openCommissaryProfileModal();
      }
    }
  }, 1500);
}

function applyNavbarAvatar() {
  const u = getCurrentUser();
  if (u && u.photoUrl) {
    document.querySelectorAll('.user-avatar-img').forEach(img => {
      img.src = u.photoUrl;
      img.style.display = 'inline-block';
    });
    document.querySelectorAll('.user-avatar-initials').forEach(el => {
      el.style.display = 'none';
    });
  }
}
window.addEventListener('load', applyNavbarAvatar);