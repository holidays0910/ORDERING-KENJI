

// ========================================================
// 📉 AUTOMATED PURCHASE REQUESTS (AUTO-PR) ENGINE
// ========================================================
async function loadAutoPR() {
  const tbody = document.getElementById('admin-auto-pr-tbody');
  if (!tbody || !db) return;
  if (adminProductsList.length === 0) await loadAdminProducts();
  
  let html = '';
  let counter = 0;
  
  adminProductsList.forEach(p => {
    const stock = parseFloat(p.stockWhole || 0);
    const limit = parseFloat(p.bufferLimit || 5);
    
    if (stock <= limit) {
      counter++;
      const recommended = (limit - stock) + 10; // Auto suggestion: Punuin ang buffer + 10 extra
      html += `<tr>
        <td><b>${p.itemCode}</b></td>
        <td>${p.itemName}</td>
        <td style="color:#ef4444; font-weight:bold;">${stock} ${p.wholeUOM}</td>
        <td>${limit} ${p.wholeUOM}</td>
        <td><b style="color:#059669;">Order: ${recommended}</b></td>
        <td><button class="btn btn-sm btn-primary" onclick="alert('Sent to PO Drafts!')">Generate PR</button></td>
      </tr>`;
    }
  });
  
  if (counter === 0) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: #10b981; padding: 1.5rem;">✅ All items are above buffer limit.</td></tr>';
  } else {
    tbody.innerHTML = html;
  }
}

// ========================================================
// 🔐 ACCESS CONTROL (PERMISSIONS) — kontrolado ni Admin, per ROLE at per USER
// Antas ng access bawat module: 'none' (walang access) | 'view' (tingin lang) | 'edit' (tingin at gamit)
// Pagkakasunod ng desisyon:  [override ng user]  ->  [setting ng role]  ->  'none'
// Ang Admin role ay laging buo ang access. Ang "users" at "truncate" ay para sa Admin lang (hindi ipinagkakaloob).
// Nakaimbak sa: system_settings/access_control (roles) at users/{email}.permissions (per user)
// ========================================================
const ACCESS_MODULES = [
  { key: 'dashboard',       label: '📊 Dashboard',               group: 'Overview' },
  { key: 'products',        label: '📦 Products Master',         group: 'Supply Food Chain' },
  { key: 'manufacturing',   label: '🏭 Manufacturing (BOM)',     group: 'Supply Food Chain' },
  { key: 'costing',         label: '📈 Recipe Costing',          group: 'Supply Food Chain' },
  { key: 'lot_tracing',     label: '🏷️ Lot & Expiry Tracing',    group: 'Supply Food Chain' },
  { key: 'spoilage',        label: '🗑️ Spoilage Approvals',      group: 'Supply Food Chain' },
  { key: 'auto_pr',         label: '🤖 Auto-PR (Low Stock)',     group: 'Supply Food Chain' },
  { key: 'purchase_orders', label: '📝 Purchase Orders',         group: 'Procurement' },
  { key: 'ap_invoices',     label: '🧾 A/P Invoices',            group: 'Finance & Accounting' },
  { key: 'vendors',         label: '🏢 Vendors',                 group: 'Procurement' },
  { key: 'disputes',        label: '🚨 Branch Disputes',         group: 'Logistics & Branches' },
  { key: 'reports',         label: '📑 Variance & 3PL Reports',  group: 'Logistics & Branches' },
  { key: 'customers',       label: '👥 Customers',               group: 'Logistics & Branches' },
  { key: 'stations',        label: '🏷️ Storage Stations & UOM',  group: 'Logistics & Branches' },
  { key: 'company_mgmt',    label: '🏢 Company Management',     group: 'Logistics & Branches' },
  { key: 'price_lists',     label: '💲 Price Lists (per Company)', group: 'Logistics & Branches' },
  { key: 'daily_prices',    label: '💱 Daily Price Sheet',         group: 'Logistics & Branches' },
  { key: 'requests',        label: '🛠️ Mga Request (Repair/Purchase)', group: 'Procurement' },
  { key: 'sap_items',       label: '📒 SAP Item Master (kada Company)', group: 'Logistics & Branches' },
  { key: 'bom_mgmt',       label: '🧪 BOM Management (per Company)', group: 'Logistics & Branches' },
  { key: 'inv_totals',      label: '📦 Inventory Totals (Beg/End)', group: 'Logistics & Branches' },
  { key: 'ar_ledger',       label: '📒 AR Ledger (Customer Payments)', group: 'Finance & Accounting' },
  { key: 'branch_inv',      label: '📋 Branch Inventory (Kitchen/Wares)', group: 'Logistics & Branches' },
  { key: 'memos',           label: '📢 HR Memo / Announcement', group: 'Human Resources' },
  { key: 'hrdocs',          label: '📚 HR Documents (Forms/Policy)', group: 'Human Resources' },
  { key: 'attendance',      label: '🕒 Attendance & Schedule (HR)', group: 'Human Resources' },
  { key: 'employees',       label: '🧑‍💼 Employee DB (HR)',        group: 'Human Resources' },
  { key: 'prime',          label: '💰 Prime Cost Management', group: 'Branch Operations' },
  { key: 'pos',            label: '🛒 POS (Cashier, Menu, Events, Members)', group: 'Branch Operations' },
  { key: 'lst',            label: '🗓️ LST Management (Schedule/Manning)', group: 'Branch Operations' },
  { key: 'loans',          label: '🏦 Loan Management (Employee Loans)', group: 'Human Resources' },
  { key: 'hrexam',         label: '📝 Recruitment Exam / Survey (HR)', group: 'Human Resources' },
  { key: 'tickets',        label: '🎫 Tickets / Workflow (Kanban)', group: 'Overview' },
  { key: 'payroll',         label: '💸 Payroll / Payslip (HR)',  group: 'Human Resources' },
  { key: 'team',            label: '🚚 Logistics Team',          group: 'Supply Food Chain' },
  { key: 'finance',         label: '🏦 General Ledger',          group: 'Finance & Accounting' },
  { key: 'acct',            label: '📚 Accounting (Books)',      group: 'Finance & Accounting' },
  { key: 'security',        label: '🛡️ Security & Access Center', group: 'Admin Lang' },
  { key: 'assets',          label: '🏗️ Assets',                  group: 'Finance & Accounting' },
  { key: 'branding',        label: '🏢 Branding Setup',          group: 'Admin Lang' },
  { key: 'logs',            label: '🕵️ Audit Logs',              group: 'Admin Lang' },
  { key: 'backups',         label: '💾 Data Backups',            group: 'Admin Lang' },
  { key: 'users',           label: '🛡️ User Access',             group: 'Admin Lang', adminOnly: true },
  { key: 'subscriptions',   label: '🔁 Subscriptions (Software/Hosting)', group: 'Admin Lang', adminOnly: true },
  { key: 'vouchers',        label: '🎟️ Vouchers', group: 'Admin Lang', adminOnly: true },
  { key: 'posdash',         label: '📊 POS Dashboard', group: 'Admin Lang', adminOnly: true },
  { key: 'truncate',        label: '🧹 Truncate (Danger Zone)',  group: 'Admin Lang', adminOnly: true }
];
// ---- MGA FEATURE SA LOOB NG COMMISSARY AT BRANCH PAGE ----
// Default: PAYAG (para walang masira). Si Admin ang puwedeng magbawal per role o per user.
// native = aling role ang tinatamaan ng bawal. fns = mga function na hinaharang. sel = mga button/link na itinatago.
const ACCESS_FEATURES = [
  // ---- Commissary page: mga pahina ----
  { key: 'cv_dashboard', native: 'commissary', group: 'Commissary Page — Mga Menu', label: '📊 Makita ang Dashboard', sel: ["[onclick*=\"switchCommissaryView('dashboard')\"]"], view: 'dashboard' },
  { key: 'cv_prices',    native: 'commissary', group: 'Commissary Page — Mga Menu', label: '💱 Daily Price Sheet (mag-presyo)', sel: ["[onclick*=\"switchCommissaryView('prices')\"]"], view: 'prices' },
  { key: 'cv_ar',        native: 'commissary', group: 'Commissary Page — Mga Menu', label: '📒 AR Ledger (bayad ng customers)', sel: ["[onclick*=\"switchCommissaryView('ar')\"]"], view: 'ar' },
  { key: 'cv_orders',    native: 'commissary', group: 'Commissary Page — Mga Menu', label: '📋 Makita ang Orders Queue', sel: ["[onclick*=\"switchCommissaryView('orders')\"]"], view: 'orders' },
  { key: 'cv_inventory', native: 'commissary', group: 'Commissary Page — Mga Menu', label: '📦 Makita ang Inventory', sel: ["[onclick*=\"switchCommissaryView('inventory')\"]"], view: 'inventory' },
  // ---- Commissary page: mga aksyon ----
  { key: 'comm_accept',   native: 'commissary', group: 'Commissary Page — Mga Aksyon', label: '✅ Tanggapin ang order para ihanda', fns: ['commissaryTakeOrder'] },
  { key: 'comm_dispatch', native: 'commissary', group: 'Commissary Page — Mga Aksyon', label: '🚚 I-dispatch ang order', fns: ['commissaryDispatchOrder'] },
  { key: 'comm_cancel',   native: 'commissary', group: 'Commissary Page — Mga Aksyon', label: '❌ Mag-cancel / tumanggap o tumanggi sa cancel request', fns: ['cancelOrderFromCommissary', 'commissaryAcceptCancel', 'commissaryRejectCancel'] },
  { key: 'comm_pahabol',  native: 'commissary', group: 'Commissary Page — Mga Aksyon', label: '➕ Aprubahan / tanggihan ang Pahabol', fns: ['commissaryAcceptPahabol', 'commissaryRejectPahabol'] },
  { key: 'comm_si_po',    native: 'commissary', group: 'Commissary Page — Mga Aksyon', label: '🧾 Mag-edit ng SI / PO number', fns: ['saveModalSIAndPO'] },
  { key: 'comm_print',    native: 'commissary', group: 'Commissary Page — Mga Aksyon', label: '🖨️ Mag-print ng picking slip / mag-download ng CSV', fns: ['printPickingGuide', 'triggerModalPrintSlip', 'triggerModalDownloadCSV', 'downloadBranchOrderCSV', 'copyBranchOrderToClipboard'] },
  { key: 'comm_stock',    native: 'commissary', group: 'Commissary Page — Mga Aksyon', label: '📦 Mag-add ng produkto / mag-adjust ng stock', fns: ['showAddProductModal', 'saveProductWithStationAndUOM', 'updateStock'] },
  { key: 'comm_ar_pay',   native: 'commissary', group: 'Commissary Page — Mga Aksyon', label: '💵 Mag-record ng bayad ng customer', fns: ['arOpenPay', 'arSubmitPay'] },
  { key: 'comm_ar_void',  native: 'commissary', group: 'Commissary Page — Mga Aksyon', label: '🚫 Mag-void ng bayad', fns: ['arVoidPayment'] },
  { key: 'comm_receiving',native: 'commissary', group: 'Commissary Page — Mga Aksyon', label: '📥 Direct Receiving mula sa vendor', fns: ['openDirectReceivingModal', 'submitDirectReceiving'] },
  { key: 'comm_spoilage', native: 'commissary', group: 'Commissary Page — Mga Aksyon', label: '🗑️ Mag-report ng Spoilage', fns: ['openCommissarySpoilageModal', 'submitSpoilageReport'] },
  // ---- Branch page: mga pahina ----
  { key: 'bv_dashboard',  native: 'branch', group: 'Branch Page — Mga Menu', label: '📊 Makita ang Dashboard', sel: ["[onclick*=\"switchBranchView('dashboard')\"]"], view: 'dashboard' },
  { key: 'bv_order',      native: 'branch', group: 'Branch Page — Mga Menu', label: '🛒 Makita ang Place Order', sel: ["[onclick*=\"switchBranchView('order')\"]"], view: 'order' },
  { key: 'bv_deliveries', native: 'branch', group: 'Branch Page — Mga Menu', label: '🚚 Makita ang My Deliveries', sel: ["[onclick*=\"switchBranchView('deliveries')\"]"], view: 'deliveries' },
  { key: 'br_ordboard', native: 'branch', group: 'Branch Page — Mga Menu', label: '📦 Order Board', sel: ["[onclick*=\"switchBranchView('ordboard')\"]"], view: 'ordboard' },
  { key: 'br_hrdocs', native: 'branch', group: 'Branch Page — Mga Menu', label: '📚 HR Documents', sel: ["[onclick*=\"switchBranchView('hrdocs')\"]"], view: 'hrdocs' },
  { key: 'br_attendance', native: 'branch', group: 'Branch Page — Mga Menu', label: '🕒 Attendance', sel: ["[onclick*=\"switchBranchView('attendance')\"]"], view: 'attendance' },
  { key: 'cv_ordboard', native: 'commissary', group: 'Commissary Page — Mga Menu', label: '📦 Order Board', sel: ["[onclick*=\"switchCommissaryView('ordboard')\"]"], view: 'ordboard' },
  { key: 'cv_hrdocs', native: 'commissary', group: 'Commissary Page — Mga Menu', label: '📚 HR Documents', sel: ["[onclick*=\"switchCommissaryView('hrdocs')\"]"], view: 'hrdocs' },
  { key: 'cv_attendance', native: 'commissary', group: 'Commissary Page — Mga Menu', label: '🕒 Attendance', sel: ["[onclick*=\"switchCommissaryView('attendance')\"]"], view: 'attendance' },
  { key: 'br_requests',   native: 'branch', group: 'Branch Page — Mga Menu', label: '🛠️ Mga Request (Repair/Bilhin)', sel: ["[onclick*=\"switchBranchView('requests')\"]"], view: 'requests' },
  { key: 'cv_requests',   native: 'commissary', group: 'Commissary Page — Mga Menu', label: '🛠️ Mga Request (Procurement)', sel: ["[onclick*=\"switchCommissaryView('requests')\"]"], view: 'requests' },
  { key: 'bv_inventory',  native: 'branch', group: 'Branch Page — Mga Menu', label: '📋 Makita ang Inventory Count', sel: ["[onclick*=\"switchBranchView('inventory')\"]"], view: 'inventory' },
  // ---- Branch page: mga aksyon ----
  { key: 'br_order',      native: 'branch', group: 'Branch Page — Mga Aksyon', label: '🛍️ Mag-place ng order', fns: ['openOrderModal', 'submitBranchOrder', 'submitBranchOrderFromModal'] },
  { key: 'br_receive',    native: 'branch', group: 'Branch Page — Mga Aksyon', label: '📝 Tumanggap / pumirma ng delivery (e-POD)', fns: ['submitFinalReceivingProof'] },
  { key: 'br_cancel',     native: 'branch', group: 'Branch Page — Mga Aksyon', label: '❌ Mag-request ng cancel', fns: ['openBranchCancelModal', 'submitBranchCancelRequest'] },
  { key: 'br_pahabol',    native: 'branch', group: 'Branch Page — Mga Aksyon', label: '➕ Mag-request ng Pahabol', fns: ['openBranchPahabolModal', 'submitBranchPahabol'] },
  { key: 'br_inventory', native: 'branch', group: 'Branch Page — Mga Aksyon', label: '💾 Mag-save ng Inventory Count', fns: ['submitInventoryCount'] },
  { key: 'br_late_return',native: 'branch', group: 'Branch Page — Mga Aksyon', label: '↩️ Late Return', fns: ['openLateReturnModal', 'submitLateReturn'] }
];
const PERM_CACHE_KEY = 'kusina_perms';
window.KUSINA_PERMS = null;

function allModulesAt(level) {
  const o = {};
  ACCESS_MODULES.forEach(m => { o[m.key] = level; });
  return o;
}
function validLevel(v) { return v === 'none' || v === 'view' || v === 'edit'; }

function computeFeaturePerms(role, userPerms, rolePerms) {
  const feats = {};
  ACCESS_FEATURES.forEach(f => {
    if (role === 'admin' || f.native !== role) { feats[f.key] = true; return; } // ang bawal ay para lang sa sariling role ng page
    const uv = userPerms && userPerms[f.key];
    const rv = rolePerms && rolePerms[f.key];
    const lvl = validLevel(uv) ? uv : (validLevel(rv) ? rv : 'edit'); // default: PAYAG
    feats[f.key] = lvl !== 'none';
  });
  return feats;
}

function computeEffectivePerms(role, userPerms, rolePerms) {
  if (role === 'admin') return { isAdmin: true, role: role, levels: allModulesAt('edit'), features: computeFeaturePerms('admin') };
  const levels = {};
  ACCESS_MODULES.forEach(m => {
    if (m.adminOnly) { levels[m.key] = 'none'; return; }
    const uv = userPerms && userPerms[m.key];
    const rv = rolePerms && rolePerms[m.key];
    levels[m.key] = validLevel(uv) ? uv : (validLevel(rv) ? rv : 'none');
  });
  return { isAdmin: false, role: role, levels: levels, features: computeFeaturePerms(role, userPerms, rolePerms) };
}

let _permsPromise = null;
function getPermsOnce() { return _permsPromise || (_permsPromise = fetchEffectivePerms()); }

async function fetchEffectivePerms() {
  const u = getCurrentUser();
  const role = normalizeRole(u && u.role);
  if (role === 'admin') return computeEffectivePerms('admin');
  const email = ((u && u.email) || '').toLowerCase();
  if (!email || typeof db === 'undefined' || !db) return computeEffectivePerms(role);

  // hintayin muna ang Firebase session (hanggang 4 na segundo)
  await new Promise(res => {
    if (typeof auth === 'undefined' || !auth) return res();
    const t = setTimeout(res, 4000);
    const un = auth.onAuthStateChanged(() => { clearTimeout(t); un(); res(); });
  });

  try {
    const [uSnap, aSnap] = await Promise.all([
      db.collection('users').doc(email).get(),
      db.collection('system_settings').doc('access_control').get()
    ]);
    const userPerms = uSnap.exists ? Object.assign({}, uSnap.data().permissions || {}, (uSnap.data().tempUntil > Date.now() && uSnap.data().tempPerms) ? uSnap.data().tempPerms : {}) : {};
    const rolePerms = aSnap.exists ? (((aSnap.data().roles || {})[role]) || {}) : {};
    const eff = computeEffectivePerms(role, userPerms, rolePerms);
    try { localStorage.setItem(PERM_CACHE_KEY, JSON.stringify({ email: email, levels: eff.levels, features: eff.features, at: Date.now() })); } catch (e) {}
    return eff;
  } catch (e) {
    console.warn('Hindi makuha ang permissions, gagamitin ang naka-cache:', e.message);
    try {
      const cached = JSON.parse(localStorage.getItem(PERM_CACHE_KEY) || 'null');
      if (cached && cached.email === email) return { isAdmin: false, role: role, levels: cached.levels, features: cached.features || computeFeaturePerms(role) };
    } catch (e2) {}
    return computeEffectivePerms(role);
  }
}

function permLevel(key) {
  const p = window.KUSINA_PERMS;
  if (!p) return 'edit'; // wala pang permissions na nakarga: huwag harangan (admin page lang ang gumagamit nito)
  return p.levels[key] || 'none';
}
function canViewModule(key) { return permLevel(key) !== 'none'; }
function canEditModule(key) { return permLevel(key) === 'edit'; }

// ---- View-only mode: itago ang mga button na nagbabago ng data ----
const RO_SAFE_ONCLICK = /^\s*(load|refresh|filter|export|print|view|show|download|toggle|switch|search|apply|clear|close|reset)/i;
let roObserver = null;
function markReadonlyButtons() {
  document.querySelectorAll('button, a.btn').forEach(b => {
    if (b.closest('.sidebar, .top-header')) return;
    const mutating = /btn-(primary|success|danger|warning)/.test(b.className) && !RO_SAFE_ONCLICK.test(b.getAttribute('onclick') || '');
    if (mutating) b.classList.add('ro-hide');
  });
}
function applyReadonlyMode(viewName) {
  const p = window.KUSINA_PERMS;
  const on = !!p && !p.isAdmin && p.levels[viewName] === 'view';
  document.body.classList.toggle('ro-mode', on);
  if (on) {
    markReadonlyButtons();
    if (!roObserver) {
      roObserver = new MutationObserver(() => { if (document.body.classList.contains('ro-mode')) markReadonlyButtons(); });
      roObserver.observe(document.body, { childList: true, subtree: true });
    }
  } else {
    document.querySelectorAll('.ro-hide').forEach(b => b.classList.remove('ro-hide'));
  }
}

// ---- Admin page: ilapat ang permissions sa menu at sa mga view ----
async function applyAdminPermissions() {
  const u = getCurrentUser();
  const perms = await getPermsOnce();
  window.KUSINA_PERMS = perms;

  const allowed = ACCESS_MODULES.filter(m => perms.levels[m.key] !== 'none').map(m => m.key);
  if (!allowed.length) {
    document.body.classList.remove('perm-pending');
    alert('Access Denied: Wala pang module na ibinigay sa account mo. Makipag-ugnayan kay Admin.');
    if (u) redirectToRoleDashboard(u.role);
    return false;
  }

  // Menu: itago ang walang access, pati ang category na walang natira
  document.querySelectorAll('.sidebar-menu .menu-item[data-module], .dots-menu .dots-item[data-module]').forEach(a => {
    a.style.display = perms.levels[a.dataset.module] === 'none' ? 'none' : '';
  });
  document.querySelectorAll('.sidebar-menu .menu-category').forEach(cat => {
    let el = cat.nextElementSibling, any = false;
    while (el && !el.classList.contains('menu-category')) {
      if (el.classList.contains('menu-item') && el.style.display !== 'none') any = true;
      el = el.nextElementSibling;
    }
    cat.style.display = any ? '' : 'none';
  });

  // Non-admin: label, "Bumalik" link, at tamang unang view
  if (!perms.isAdmin) {
    const nav = document.querySelector('.sidebar-menu');
    const home = perms.role === 'commissary' ? 'commissary.html' : 'branch.html';
    const homeLabel = perms.role === 'commissary' ? 'Commissary Portal' : 'Branch Portal';
    if (nav && !document.getElementById('back-to-portal')) {
      const a = document.createElement('a');
      a.id = 'back-to-portal';
      a.href = home;
      a.className = 'menu-item';
      a.innerHTML = `<i>🏠</i> Bumalik sa ${homeLabel}`;
      nav.insertBefore(a, nav.firstChild);
    }
    const first = allowed.includes('dashboard') ? 'dashboard' : allowed[0];
    switchAdminView(first);
    const link = document.querySelector(`.menu-item[data-module="${first}"]`);
    if (link && typeof setActiveMenu === 'function') setActiveMenu(link);
  }
  document.body.classList.remove('perm-pending');
  return true;
}


// ---- Branch / Commissary page: ilapat ang mga feature permission ----
function featureAllowed(key) {
  const p = window.KUSINA_PERMS;
  return !p || !p.features || p.features[key] !== false;
}
function featureDeniedMsg(f) {
  alert('⚠️ Walang pahintulot ang account mo para sa: ' + f.label.replace(/^[^\w]+/, '') + '. Makipag-ugnayan kay Admin.');
}
function installActionGates() {
  ACCESS_FEATURES.forEach(f => {
    (f.fns || []).forEach(fn => {
      const orig = window[fn];
      if (typeof orig !== 'function' || orig.__gated) return;
      const wrapped = function () {
        if (!featureAllowed(f.key)) { featureDeniedMsg(f); return; }
        return orig.apply(this, arguments);
      };
      wrapped.__gated = true;
      window[fn] = wrapped;
    });
  });
}
function applyFeatureHiding() {
  const p = window.KUSINA_PERMS;
  if (!p || !p.features) return;
  ACCESS_FEATURES.forEach(f => {
    if (p.features[f.key] !== false) return;
    (f.fns || []).forEach(fn => {
      document.querySelectorAll(`[onclick*="${fn}("]`).forEach(el => el.classList.add('perm-hide'));
    });
    (f.sel || []).forEach(sel => {
      document.querySelectorAll(sel).forEach(el => el.classList.add('perm-hide'));
    });
  });
  if (typeof syncMenuCategories === 'function') syncMenuCategories();
}
async function applyFeaturePermissions() {
  const perms = await getPermsOnce();
  window.KUSINA_PERMS = perms;
  if (perms.isAdmin) return;
  installActionGates();
  applyFeatureHiding();
  let raf = null;
  new MutationObserver(() => {
    if (raf) return;
    raf = requestAnimationFrame(() => { raf = null; applyFeatureHiding(); });
  }).observe(document.body, { childList: true, subtree: true });

  // Kung bawal ang unang view (dashboard), ilipat sa unang pinapayagan
  const views = ACCESS_FEATURES.filter(f => f.view && f.native === perms.role);
  const firstOk = views.find(f => perms.features[f.key] !== false);
  const dash = views.find(f => f.view === 'dashboard');
  if (dash && perms.features[dash.key] === false && firstOk) {
    if (perms.role === 'commissary') switchCommissaryView(firstOk.view);
    else if (perms.role === 'branch') switchBranchView(firstOk.view);
  }
}

// ---- Branch / Commissary page: magdagdag ng link papunta sa mga module na pinayagan ----
async function injectModulesLink() {
  const menu = document.getElementById('branch-dropdown-menu') || document.getElementById('commissary-dropdown-menu');
  if (!menu || document.getElementById('modules-portal-link')) return;
  const perms = await getPermsOnce();
  if (!ACCESS_MODULES.some(m => perms.levels[m.key] !== 'none')) return;
  const a = document.createElement('a');
  a.id = 'modules-portal-link';
  a.href = 'admin.html';
  a.style.cssText = 'display: block; padding: 0.75rem 1rem; border-bottom: 1px solid #f1f5f9; color: #2563eb; font-weight: 600;';
  a.innerHTML = '🧰 Mga Module (Admin Portal)';
  menu.insertBefore(a, menu.lastElementChild);
}

// ========================================================
// 🛠️ ACCESS CONTROL MANAGER (nasa User Access page, Admin lang)
// ========================================================
let acRoleState = { commissary: {}, branch: {} };
let acUsersList = [];
let acPickedEmail = '';

const AC_LEVEL_OPTS = [['none', '🚫 Walang access'], ['view', '👁️ View lang'], ['edit', '✏️ View at Edit']];

function acSelectAllow(id, value, withInherit) {
  let opts = withInherit ? `<option value="" ${value === '' ? 'selected' : ''}>↩ Sundin ang role</option>` : '';
  [['edit', '✅ Puwede'], ['none', '🚫 Bawal']].forEach(([v, t]) => { opts += `<option value="${v}" ${value === v ? 'selected' : ''}>${t}</option>`; });
  return `<select id="${id}" style="font-size: 0.8rem; padding: 0.3rem 0.4rem;">${opts}</select>`;
}

function acSelect(id, value, withInherit) {
  let opts = withInherit ? `<option value="" ${value === '' ? 'selected' : ''}>↩ Sundin ang role</option>` : '';
  AC_LEVEL_OPTS.forEach(([v, t]) => { opts += `<option value="${v}" ${value === v ? 'selected' : ''}>${t}</option>`; });
  return `<select id="${id}" style="font-size: 0.8rem; padding: 0.3rem 0.4rem;">${opts}</select>`;
}

async function renderAccessControlManagerBase() {
  const root = document.getElementById('access-control-root');
  if (!root || !db) return;
  const me = getCurrentUser();
  if (!me || normalizeRole(me.role) !== 'admin') { root.innerHTML = ''; return; }

  try {
    const aSnap = await db.collection('system_settings').doc('access_control').get();
    const roles = aSnap.exists ? (aSnap.data().roles || {}) : {};
    acRoleState = { commissary: roles.commissary || {}, branch: roles.branch || {} };
  } catch (e) { acRoleState = { commissary: {}, branch: {} }; }

  const grantable = ACCESS_MODULES.filter(m => !m.adminOnly);
  let rows = '', lastGroup = '';
  grantable.forEach(m => {
    if (m.group !== lastGroup) {
      rows += `<tr><td colspan="4" style="background:#f1f5f9; font-weight:800; font-size:0.75rem; text-transform:uppercase; color:#64748b;">${m.group}</td></tr>`;
      lastGroup = m.group;
    }
    rows += `<tr>
      <td><b>${m.label}</b></td>
      <td style="text-align:center;"><span class="badge badge-admin">Buo</span></td>
      <td>${acSelect('ac-role-commissary-' + m.key, acRoleState.commissary[m.key] || 'none', false)}</td>
      <td>${acSelect('ac-role-branch-' + m.key, acRoleState.branch[m.key] || 'none', false)}</td>
    </tr>`;
  });

  // Mga feature sa loob ng Commissary at Branch page
  let featRows = '', lastFG = '';
  ACCESS_FEATURES.forEach(f => {
    if (f.group !== lastFG) {
      featRows += `<tr><td colspan="4" style="background:#f1f5f9; font-weight:800; font-size:0.75rem; text-transform:uppercase; color:#64748b;">${f.group}</td></tr>`;
      lastFG = f.group;
    }
    const cell = r => f.native === r ? acSelectAllow(`ac-role-${r}-${f.key}`, acRoleState[r][f.key] === 'none' ? 'none' : 'edit', false) : '<span style="color:#cbd5e1;">—</span>';
    featRows += `<tr><td><b>${f.label}</b></td><td style="text-align:center;"><span class="badge badge-admin">Buo</span></td><td>${cell('commissary')}</td><td>${cell('branch')}</td></tr>`;
  });

  root.innerHTML = `
    <div class="card">
      <div class="card-title"><span>🔐 Role Permissions (Ano ang magagamit ng bawat Role)</span>
        <button class="btn btn-success btn-sm" onclick="saveRolePermissions()">💾 I-save ang Role Permissions</button>
      </div>
      <p style="font-size: 0.85rem; color: #64748b; margin-bottom: 1rem;">
        Piliin kung anong module ang makikita at magagamit ng bawat role. Ang module na may access ay lalabas sa menu ng Admin Portal ng role na iyon
        (may link sa dropdown menu nila). <b>View lang</b> = makikita pero hindi makakapag-edit. Ang Admin ay laging buo ang access;
        ang User Access at Truncate ay para sa Admin lang.
      </p>
      <div class="table-responsive"><table>
        <thead><tr><th>Module</th><th style="text-align:center;">Admin</th><th>Commissary Hub</th><th>Branch Operations</th></tr></thead>
        <tbody>${rows}</tbody>
      </table></div>
      <h4 style="margin: 1.25rem 0 0.25rem;">🧩 Mga Feature sa loob ng Commissary at Branch Page</h4>
      <p style="font-size: 0.85rem; color: #64748b; margin-bottom: 0.75rem;">Default ay <b>✅ Puwede</b> ang lahat. Piliin ang <b>🚫 Bawal</b> para itago ang button o menu at harangan ang aksyon para sa role na iyon.</p>
      <div class="table-responsive"><table>
        <thead><tr><th>Feature</th><th style="text-align:center;">Admin</th><th>Commissary Hub</th><th>Branch Operations</th></tr></thead>
        <tbody>${featRows}</tbody>
      </table></div>
    </div>

    <div class="card">
      <div class="card-title"><span>👤 Per-User Permissions (Exception para sa isang tao)</span></div>
      <p style="font-size: 0.85rem; color: #64748b; margin-bottom: 1rem;">
        Mas nangingibabaw ito kaysa sa Role Permissions. Piliin ang "↩ Sundin ang role" kung walang exception.
      </p>
      <div class="srch-wrap" style="max-width: 460px; margin-bottom: 1rem;">
        <input type="text" id="ac-user-search" autocomplete="off" placeholder="🔎 Hanapin ang user (pangalan, email, branch)..." oninput="acSearchUsers()" onfocus="acSearchUsers()" onkeydown="srchKey(event, 'ac-user-results', acPickUser)">
        <div id="ac-user-results" class="srch-results"></div>
      </div>
      <div id="ac-user-editor"></div>
    </div>`;

  try {
    const snap = await db.collection('users').get();
    acUsersList = [];
    snap.forEach(d => {
      const x = d.data();
      if (normalizeRole(x.role) !== 'admin') acUsersList.push({ email: d.id, name: x.name || d.id.split('@')[0], role: normalizeRole(x.role) || 'pending', branch: x.branch || '', permissions: x.permissions || {} });
    });
  } catch (e) { acUsersList = []; }
}

async function saveRolePermissions() {
  if (!db) return;
  const roles = { commissary: {}, branch: {} };
  ACCESS_MODULES.filter(m => !m.adminOnly).forEach(m => {
    ['commissary', 'branch'].forEach(r => {
      const el = document.getElementById(`ac-role-${r}-${m.key}`);
      if (el && validLevel(el.value) && el.value !== 'none') roles[r][m.key] = el.value;
    });
  });
  ACCESS_FEATURES.forEach(f => {
    const el = document.getElementById(`ac-role-${f.native}-${f.key}`);
    if (el && el.value === 'none') roles[f.native][f.key] = 'none';
  });
  try {
    await db.collection('system_settings').doc('access_control').set({
      roles: roles,
      updatedBy: (getCurrentUser() && getCurrentUser().email) || 'admin',
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    await logSystemAction('ACCESS_ROLES_UPDATED', `In-update ang Role Permissions. Commissary: ${Object.keys(roles.commissary).length} module, Branch: ${Object.keys(roles.branch).length} module.`);
    alert('✅ Na-save ang Role Permissions. Mag-aapply ito sa susunod na pag-load ng page ng bawat user.');
  } catch (e) { alert('Error: ' + e.message); }
}

function acSearchUsers() {
  const inp = document.getElementById('ac-user-search');
  if (!inp) return;
  const list = acUsersList.filter(u => smartMatch(inp.value, u.name, u.email, u.branch, u.role)).slice(0, 30);
  acUsersList._shown = list;
  srchRender('ac-user-results', list,
    u => `<b>${srchEsc(u.name)}</b> <small style="color:#64748b;">(${srchEsc(u.role)}${u.branch ? ' · ' + srchEsc(u.branch) : ''})</small><br><small style="color:#64748b;">${srchEsc(u.email)}</small>`,
    'acPickUserIdx', 'Walang nakitang user.');
}
function acPickUserIdx(i) { const u = (acUsersList._shown || [])[i]; if (u) acPickUser(u); }
function acPickUser(u) {
  if (typeof u === 'number') { acPickUserIdx(u); return; }
  acPickedEmail = u.email;
  const inp = document.getElementById('ac-user-search');
  if (inp) inp.value = `${u.name} (${u.email})`;
  const box = document.getElementById('ac-user-results');
  if (box) box.style.display = 'none';

  const grantable = ACCESS_MODULES.filter(m => !m.adminOnly);
  const lbl = { none: 'Walang access', view: 'View lang', edit: 'View at Edit' };
  let rows = '', lastGroup = '';
  grantable.forEach(m => {
    if (m.group !== lastGroup) {
      rows += `<tr><td colspan="3" style="background:#f1f5f9; font-weight:800; font-size:0.75rem; text-transform:uppercase; color:#64748b;">${m.group}</td></tr>`;
      lastGroup = m.group;
    }
    const roleLevel = (acRoleState[u.role] && acRoleState[u.role][m.key]) || 'none';
    rows += `<tr><td><b>${m.label}</b></td><td><small style="color:#64748b;">${lbl[roleLevel]}</small></td><td>${acSelect('ac-user-' + m.key, validLevel(u.permissions[m.key]) ? u.permissions[m.key] : '', true)}</td></tr>`;
  });
  let uFeat = '', lastUG = '';
  ACCESS_FEATURES.filter(f => f.native === u.role).forEach(f => {
    if (f.group !== lastUG) {
      uFeat += `<tr><td colspan="3" style="background:#f1f5f9; font-weight:800; font-size:0.75rem; text-transform:uppercase; color:#64748b;">${f.group}</td></tr>`;
      lastUG = f.group;
    }
    const rl = (acRoleState[u.role] && acRoleState[u.role][f.key] === 'none') ? 'Bawal' : 'Puwede';
    uFeat += `<tr><td><b>${f.label}</b></td><td><small style="color:#64748b;">${rl}</small></td><td>${acSelectAllow('ac-user-' + f.key, validLevel(u.permissions[f.key]) ? u.permissions[f.key] : '', true)}</td></tr>`;
  });
  document.getElementById('ac-user-editor').innerHTML = `
    <div style="margin-bottom: 0.75rem;"><b>${srchEsc(u.name)}</b> <span class="badge badge-secondary">${srchEsc(u.role)}</span> <small style="color:#64748b;">${srchEsc(u.email)}</small></div>
    ${acCustomRoleSelectHtml(u)}
    <div class="table-responsive"><table>
      <thead><tr><th>Module</th><th>Ayon sa role niya</th><th>Exception para sa user na ito</th></tr></thead>
      <tbody>${rows}${uFeat}</tbody>
    </table></div>
    <div style="display:flex; gap:0.5rem; margin-top:1rem;">
      <button class="btn btn-success" onclick="saveUserPermissions()">💾 I-save ang Permissions ng User</button>
      <button class="btn btn-secondary" onclick="clearUserPermissions()">↩ Alisin lahat ng exception</button>
    </div>`;
}
async function saveUserPermissions() {
  if (!db || !acPickedEmail) return;
  const perms = {};
  ACCESS_MODULES.filter(m => !m.adminOnly).forEach(m => {
    const el = document.getElementById('ac-user-' + m.key);
    if (el && validLevel(el.value)) perms[m.key] = el.value;
  });
  ACCESS_FEATURES.forEach(f => {
    const el = document.getElementById('ac-user-' + f.key);
    if (el && validLevel(el.value)) perms[f.key] = el.value;
  });
  try {
    await db.collection('users').doc(acPickedEmail).update({
      permissions: Object.keys(perms).length ? perms : firebase.firestore.FieldValue.delete()
    });
    const u = acUsersList.find(x => x.email === acPickedEmail);
    if (u) u.permissions = perms;
    await logSystemAction('ACCESS_USER_UPDATED', `In-update ang permissions ni ${acPickedEmail}: ${Object.keys(perms).length} exception.`);
    alert('✅ Na-save ang permissions ng user. Mag-aapply ito sa susunod niyang pag-load ng page.');
  } catch (e) { alert('Error: ' + e.message); }
}
async function clearUserPermissions() {
  if (!acPickedEmail || !await uiConfirm('Alisin lahat ng exception ng user na ito? Susundin na niya ang role niya.')) return;
  document.querySelectorAll('[id^="ac-user-"]').forEach(el => { if (el.tagName === 'SELECT') el.value = ''; });
  await saveUserPermissions();
}


// ========================================================
// 🏢 COMMISSARY HUB SCOPING (kanya-kanyang produkto at recipe ng bawat commissary)
// Lohika: scope 'shared' = lahat ng hub ay nakakakita. Kung hindi shared, ang hub lang na may-ari (commissarySource) ang makakakita.
// Ang lumang produkto/BOM na walang nakatakdang hub ay nananatiling nakikita (walang masisira).
// ========================================================
function hubKey(s) { return String(s || '').trim().toLowerCase(); }
function myHubName() { const u = getCurrentUser() || {}; return u.hub || u.branch || ''; }
function activeHubFilter() {
  const u = getCurrentUser() || {};
  if (normalizeRole(u.role) === 'admin') { const el = document.getElementById('mfg-hub-filter'); return el ? el.value : ''; }
  return myHubName();
}
function productVisibleToHub(p, hub) {
  if (!hub || !p) return true;
  if (p.scope === 'shared') return true;
  const ph = hubKey(p.commissarySource), h = hubKey(hub);
  return !ph || ph.includes(h) || h.includes(ph);
}
function bomVisibleToHub(b, hub) {
  if (!hub || !b) return true;
  if (!b.hub || b.scope === 'shared') return true;
  const bh = hubKey(b.hub), h = hubKey(hub);
  return bh.includes(h) || h.includes(bh);
}
function setSelValue(sel, val) {
  if (!sel) return;
  if (val && ![...sel.options].some(o => o.value === val)) {
    const o = document.createElement('option'); o.value = val; o.textContent = val; sel.appendChild(o);
  }
  sel.value = val || '';
}
async function loadHubOptions() {
  if (!db) return;
  const names = new Set();
  try { (await db.collection('commissary_hubs').get()).forEach(d => names.add(d.data().name || d.id)); } catch (e) {}
  (adminProductsList || []).forEach(p => { if (p.commissarySource) names.add(p.commissarySource); });
  const list = [...names].filter(Boolean).sort((a, b) => a.localeCompare(b));
  const fill = (id, first) => {
    const el = document.getElementById(id); if (!el) return;
    const cur = el.value;
    el.innerHTML = `<option value="">${first}</option>` + list.map(n => `<option value="${srchEsc(n)}">🏢 ${srchEsc(n)}</option>`).join('');
    setSelValue(el, cur);
  };
  fill('admin-item-hub', '-- Pumili ng Commissary Hub --');
  fill('mfg-hub-filter', '🏢 Lahat ng Hub');
  fill('bom-hub', '🌐 Lahat ng Hub (Shared)');
  fill('comm-bom-hub', '🌐 Lahat ng Hub (Shared)');
  return list;
}
async function loadHubsManager() {
  const tbody = document.getElementById('hubs-list-tbody');
  if (!tbody || !db) return;
  try {
    const snap = await db.collection('commissary_hubs').get();
    if (snap.empty) { tbody.innerHTML = '<tr><td colspan="2" style="text-align:center;color:#94a3b8;padding:1rem;">Wala pang hub. Mag-add sa itaas.</td></tr>'; return; }
    let h = ''; snap.forEach(d => { h += `<tr><td><b>🏢 ${srchEsc(d.data().name || d.id)}</b></td><td><button class="btn btn-sm btn-danger" onclick="deleteHub('${srchEsc(d.id)}')">🗑️</button></td></tr>`; });
    tbody.innerHTML = h;
  } catch (e) { console.error(e); }
}
async function addNewHub() {
  const input = document.getElementById('new-hub-label');
  const name = input ? input.value.trim() : '';
  if (!name) { alert('Ilagay ang pangalan ng Commissary Hub.'); return; }
  try {
    await db.collection('commissary_hubs').doc(name.replace(/[\/#?]/g, '-')).set({ name: name, createdAt: firebase.firestore.FieldValue.serverTimestamp() });
    logSystemAction('HUB_ADDED', 'Nagdagdag ng Commissary Hub: ' + name);
    input.value = ''; loadHubsManager(); loadHubOptions();
  } catch (e) { alert('Error: ' + e.message); }
}
async function deleteHub(id) {
  if (!await uiConfirm('Tanggalin ang hub na ito sa listahan? (Hindi nito binubura ang mga produkto.)')) return;
  try { await db.collection('commissary_hubs').doc(id).delete(); loadHubsManager(); loadHubOptions(); } catch (e) { alert('Error: ' + e.message); }
}

// ========================================================
// 🔎 UNIVERSAL SEARCHABLE DROPDOWN (lahat ng <select> na marami ang laman ay nagiging searchable)
// May "➕ Idagdag" para sa Stations, UOM at Hub kapag wala pa sa listahan.
// ========================================================
const MASTER_BY_ID = {
  'admin-item-station': 'stations', 'new-storage-station': 'stations',
  'admin-item-whole-uom': 'uom_whole', 'new-whole-uom': 'uom_whole',
  'admin-item-loose-uom': 'uom_loose', 'new-loose-uom': 'uom_loose',
  'admin-item-hub': 'hubs', 'bom-hub': 'hubs', 'inv-setup-station': 'inv_stations', 'inv-company-sel': 'companies'
};
const FORCE_SEARCH_IDS = ['mfg-hub-filter', 'admin-item-supplier', 'new-item-supplier', 'lot-product-select', 'pay-emp-select', 'po-uom-select', 'bom-rm-uom'];

async function addMasterEntry(kind, name) {
  if (!db) throw new Error('Walang database.');
  const safe = name.replace(/[\/#?]/g, '-');
  if (kind === 'stations') await db.collection('storage_stations').doc(safe).set({ name: name, createdAt: firebase.firestore.FieldValue.serverTimestamp() });
  else if (kind === 'inv_stations') await db.collection('branch_stations').doc(safe).set({ name: name, createdAt: firebase.firestore.FieldValue.serverTimestamp() });
  else if (kind === 'companies') await db.collection('companies').doc(safe).set({ name: name, createdAt: firebase.firestore.FieldValue.serverTimestamp() });
  else if (kind === 'hubs') await db.collection('commissary_hubs').doc(safe).set({ name: name, createdAt: firebase.firestore.FieldValue.serverTimestamp() });
  else if (kind === 'uom_whole' || kind === 'uom_loose') {
    const type = kind === 'uom_whole' ? 'whole' : 'loose';
    await db.collection('uom_settings').doc(`${type}_${safe.toLowerCase()}`).set({ type: type, name: name, createdAt: firebase.firestore.FieldValue.serverTimestamp() });
  }
  logSystemAction('MASTER_DATA_ADDED', `Nagdagdag ng ${kind}: ${name}`);
}

function enhanceSelect(sel) {
  if (sel.__enh) return;
  sel.__enh = true;
  const kind = MASTER_BY_ID[sel.id] || '';
  const wrap = document.createElement('div');
  wrap.className = 'srch-wrap ss-wrap';
  const inp = document.createElement('input');
  inp.type = 'text'; inp.className = 'ss-input'; inp.autocomplete = 'off';
  inp.placeholder = '🔎 Mag-search...';
  const box = document.createElement('div');
  box.className = 'srch-results';
  // panatilihin ang lapad/layout ng orihinal na dropdown
  const cs = sel.style; ['width', 'minWidth', 'maxWidth', 'flex', 'margin', 'marginBottom', 'marginTop'].forEach(k => { if (cs[k]) wrap.style[k] = cs[k]; });
  if (sel.style.width || sel.style.maxWidth || sel.style.minWidth) wrap.style.display = 'inline-block';
  if (sel.style.fontSize) inp.style.fontSize = sel.style.fontSize; if (sel.style.padding) inp.style.padding = sel.style.padding;
  inp.title = sel.title || '';
  sel.parentNode.insertBefore(wrap, sel);
  wrap.appendChild(inp); wrap.appendChild(box); wrap.appendChild(sel);
  sel.style.display = 'none';
  let items = [], active = -1;

  const optLabel = o => (o.textContent || '').trim();
  const refresh = () => {
    inp.disabled = sel.disabled;
    if (document.activeElement !== inp) {
      const o = sel.options[sel.selectedIndex];
      inp.value = (o && o.value !== '') ? optLabel(o) : '';
      inp.placeholder = (sel.options[0] && sel.options[0].value === '') ? optLabel(sel.options[0]) : '🔎 Mag-search...';
    }
  };
  const close = () => { box.style.display = 'none'; active = -1; };
  const pick = (value) => {
    sel.value = value;
    sel.dispatchEvent(new Event('change', { bubbles: true }));
    refresh(); close();
    inp.blur();
  };
  const render = (q) => {
    const opts = [...sel.options];
    items = opts.filter(o => o.value !== '' && smartMatch(q, optLabel(o), o.value)).map(o => ({ type: 'opt', o }));
    const hasBlank = opts.some(o => o.value === '');
    if (hasBlank && !q) items.unshift({ type: 'clear' });
    const exact = opts.some(o => hubKey(o.value) === hubKey(q) || hubKey(optLabel(o).replace(/^[^\w]+/, '')) === hubKey(q));
    if (kind && q.trim() && !exact) items.push({ type: 'add', name: q.trim() });
    if (!items.length) { box.innerHTML = '<div class="srch-empty">Walang tugma.</div>'; box.style.display = 'block'; return; }
    box.innerHTML = items.map((it, i) => {
      const cls = 'srch-item' + (i === active ? ' active' : '');
      if (it.type === 'clear') return `<div class="${cls}" data-i="${i}" style="color:#64748b;">↩ ${srchEsc(optLabel(sel.options[0]) || 'Alisin ang pinili')}</div>`;
      if (it.type === 'add') return `<div class="${cls}" data-i="${i}" style="color:#059669;font-weight:700;">➕ Idagdag: "${srchEsc(it.name)}"</div>`;
      return `<div class="${cls}" data-i="${i}">${srchEsc(optLabel(it.o))}</div>`;
    }).join('');
    box.style.display = 'block';
  };
  const choose = async (i) => {
    const it = items[i]; if (!it) return;
    if (it.type === 'clear') return pick('');
    if (it.type === 'opt') return pick(it.o.value);
    try {
      await addMasterEntry(kind, it.name);
      const o = document.createElement('option'); o.value = it.name;
      o.textContent = (kind === 'stations' || kind === 'inv_stations' ? '📍 ' : kind === 'hubs' || kind === 'companies' ? '🏢 ' : kind === 'uom_whole' ? '📦 ' : '🥢 ') + it.name;
      sel.appendChild(o);
      pick(it.name);
    } catch (e) { alert('Hindi maidagdag: ' + e.message); }
  };
  box.addEventListener('mousedown', e => { const el = e.target.closest('.srch-item'); if (el) { e.preventDefault(); choose(parseInt(el.dataset.i)); } });
  inp.addEventListener('focus', () => { inp.select(); active = -1; render(''); });
  inp.addEventListener('input', () => { active = -1; render(inp.value); });
  inp.addEventListener('blur', () => { setTimeout(() => { close(); refresh(); }, 120); });
  inp.addEventListener('keydown', e => {
    if (e.key === 'ArrowDown') { e.preventDefault(); active = Math.min(items.length - 1, active + 1); render(inp.value === sel.options[sel.selectedIndex]?.textContent?.trim() ? '' : inp.value); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); active = Math.max(0, active - 1); render(inp.value === sel.options[sel.selectedIndex]?.textContent?.trim() ? '' : inp.value); }
    else if (e.key === 'Enter') { e.preventDefault(); choose(active >= 0 ? active : 0); }
    else if (e.key === 'Escape') { close(); inp.blur(); }
  });
  // Para gumana ang sel.value = '...' galing sa code
  const desc = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value');
  Object.defineProperty(sel, 'value', { configurable: true, get() { return desc.get.call(this); }, set(v) { desc.set.call(this, v); refresh(); } });
  new MutationObserver(refresh).observe(sel, { childList: true, subtree: true, attributes: true, attributeFilter: ['disabled'] });
  refresh();
}

function enhanceSelects(root) {
  (root || document).querySelectorAll('select').forEach(sel => {
    if (sel.__enh || sel.hasAttribute('data-native') || sel.multiple || sel.size > 1 || sel.closest('.ss-wrap')) return;
    // Lahat ng dropdown na may 3+ na pagpipilian ay searchable na (company, station, UOM, supplier, atbp.)
    const force = !!MASTER_BY_ID[sel.id] || FORCE_SEARCH_IDS.includes(sel.id) || sel.hasAttribute('data-searchable');
    if (force || sel.options.length >= 3) enhanceSelect(sel);
  });
}
function startSelectEnhancer() {
  enhanceSelects(document);
  let t = null;
  new MutationObserver(() => { clearTimeout(t); t = setTimeout(() => enhanceSelects(document), 250); }).observe(document.body, { childList: true, subtree: true });
}