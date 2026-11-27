

// ========================================================
// 📥 CSV EXPORTS FOR VENDOR POS, EMPLOYEES, VENDORS, CUSTOMERS
// ========================================================
function exportVendorPOsCSV() {
  if (!allVendorPOs || allVendorPOs.length === 0) {
    alert('Walang PO records na ma-i-export.');
    return;
  }
  const headers = ['PO_Number', 'Order_Date', 'Vendor_Name', 'Items_Count', 'Total_Amount', 'Status', 'Created_By'];
  let rows = [headers.join(',')];
  allVendorPOs.forEach(po => {
    rows.push([
      `"${po.poNumber}"`,
      `"${po.orderDate}"`,
      `"${(po.vendorName||'').replace(/"/g, '""')}"`,
      (po.items||[]).length,
      (po.totalAmount||0).toFixed(2),
      `"${po.status||''}"`,
      `"${po.createdBy||''}"`
    ].join(','));
  });
  downloadCSVFile(rows.join('\r\n'), 'Vendor_POs_Masterlist.csv');
}

// ===== Employee CSV Export / Import (naka-link sa Employee_ID kaya hindi naaapektuhan ang mga litrato at dokumento) =====
const EMP_CSV = [['Employee_ID', 'empId'], ['First_Name', 'fname'], ['Last_Name', 'lname'], ['Middle_Name', 'mname'], ['Nickname', 'nickname'], ['Position', 'role'], ['Department', 'dept'], ['Sub_Dept', 'subdept'], ['Classification', 'classification'], ['Employment_Type', 'employmentType'], ['Base_Salary', 'baseSalary', 'n'], ['Allowance', 'allowance', 'n'], ['DeMinimis', 'deminimis', 'n'], ['Status', 'status'], ['Contact', 'contact'], ['Email', 'email'], ['Address', 'address'], ['Birthdate', 'dob', 'd'], ['Civil_Status', 'civilStatus'], ['Hire_Date', 'hireDate', 'd'], ['Direct_Hire_Date', 'directHireDate', 'd'], ['Regularization_Date', 'regularizationDate', 'd'], ['Reporting_To', 'reportingTo'], ['Branch_Code', 'branchCode'], ['Companies', 'companies', 'l'], ['Payroll_Type', 'payrollType'], ['SSS', 'sss'], ['PhilHealth', 'phic'], ['PagIBIG', 'hdmf'], ['TIN', 'tin'], ['RDO', 'rdo'], ['BDO_Account', 'bdoAccount'], ['SSS_Loan', 'sssLoan'], ['HDMF_Loan', 'hdmfLoan'], ['Emergency_Person', 'emergencyContactPerson'], ['Emergency_No', 'emergencyContactNo']];
function empCsvCell(v) { return '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"'; }
function empCsvRow(e) { return EMP_CSV.map(([, f, t]) => { let v = f === 'empId' ? (e.empId || e.id) : e[f]; if (t === 'l') v = Array.isArray(v) ? v.join('; ') : (v || ''); if (t === 'n') v = (parseFloat(v) || 0).toFixed(2); return empCsvCell(v); }).join(','); }
function exportEmployeesCSV() {
  const sf = (document.getElementById('admin-employee-status') || {}).value || 'all';
  const list = (hrEmployees || []).filter(e => { const s = e.status || 'Active'; return sf === 'all' || (sf === 'inactive' ? (s === 'Resigned' || s === 'Terminated') : s === sf); });
  if (!list.length) { alert('Walang employee records (ayon sa kasalukuyang filter).'); return; }
  downloadCSVFile([EMP_CSV.map(c => c[0]).join(',')].concat(list.map(empCsvRow)).join('\r\n'), 'Employees_HR_Masterlist.csv');
}
function empCsvTemplate() { downloadCSVFile(EMP_CSV.map(c => c[0]).join(',') + '\r\n' + empCsvRow({ empId: '', fname: 'Juan', lname: 'Dela Cruz', role: 'Cashier', dept: 'Operations', classification: 'Rank & File', employmentType: 'Regular', baseSalary: 600, status: 'Active', email: 'juan@example.com', hireDate: '2026-01-15', companies: ['KNGK'] }), 'Employees_Import_Template.csv'); }
function empNormDate(s) { s = String(s || '').trim(); if (!s) return ''; if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s; let m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/); if (m) return `${m[3]}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}`; const d = new Date(s); return isNaN(d) ? null : d.toISOString().slice(0, 10); }
// Pure: gawing update-objects ang CSV rows laban sa kasalukuyang employees. Blangkong cell = hindi ginagalaw (hindi binubura ang data).
function empImportPlan(rows, emps) {
  const plan = { upd: [], add: [], errors: [] }, byKey = {}; emps.forEach(e => { if (e.empId) byKey[String(e.empId).toLowerCase()] = e; byKey[String(e.id).toLowerCase()] = e; });
  const STAT = { active: 'Active', 'on-leave': 'On-Leave', onleave: 'On-Leave', resigned: 'Resigned', terminated: 'Terminated', inactive: 'Resigned' };
  rows.forEach((r, i) => {
    const line = i + 2, id = String(r.employee_id || '').trim(), ex = id ? byKey[id.toLowerCase()] : null, d = {};
    for (const [h, f, t] of EMP_CSV) { if (f === 'empId') continue; const v = String(r[h.toLowerCase()] == null ? '' : r[h.toLowerCase()]).trim(); if (v === '') continue;
      if (t === 'n') { const n = parseFloat(v.replace(/,/g, '')); if (isNaN(n)) { plan.errors.push(`Row ${line}: hindi numero ang ${h} ("${v}")`); continue; } d[f] = n; }
      else if (t === 'd') { const dt = empNormDate(v); if (dt === null) { plan.errors.push(`Row ${line}: mali ang petsa sa ${h} ("${v}")`); continue; } d[f] = dt; }
      else if (t === 'l') { d[f] = v.split(/[;|]/).map(x => x.trim()).filter(Boolean); }
      else if (f === 'status') { const s = STAT[v.toLowerCase()]; if (!s) { plan.errors.push(`Row ${line}: hindi kilala ang Status "${v}" (Active, On-Leave, Resigned, Terminated)`); continue; } d[f] = s; }
      else if (f === 'email') d[f] = v.toLowerCase(); else d[f] = v; }
    if (d.companies) d.company = d.companies.join(', ');
    if (d.fname || d.lname) { const fn = d.fname || (ex && ex.fname) || '', ln = d.lname != null ? d.lname : ((ex && ex.lname) || ''); d.name = ln ? `${fn} ${ln}`.trim() : fn; }
    if (ex) { if (Object.keys(d).length) plan.upd.push({ id: ex.id, empId: ex.empId, name: d.name || ex.name, data: d }); }
    else if (!d.fname) plan.errors.push(`Row ${line}: walang First_Name para sa bagong empleyado`); else plan.add.push({ empId: id, name: d.name, data: d });
  });
  return plan;
}
async function empImportOpen() {
  const txt = await pickCSVFile(); if (!txt) return; const rows = csvToObjects(txt);
  if (!rows.length) { alert('Walang laman ang CSV.'); return; }
  const plan = empImportPlan(rows, hrEmployees || []);
  let msg = `📤 Import preview\n\n• Ia-update: ${plan.upd.length} empleyado (ayon sa Employee_ID — hindi maaapektuhan ang litrato at dokumento)\n• Idadagdag: ${plan.add.length} bago\n• May problema: ${plan.errors.length}\n\nBlangkong cell = hindi ginagalaw ang kasalukuyang data.`;
  if (plan.errors.length) msg += '\n\nMga problema (laktaw ang row/cell):\n' + plan.errors.slice(0, 8).join('\n') + (plan.errors.length > 8 ? `\n…at ${plan.errors.length - 8} pa` : '');
  if (!plan.upd.length && !plan.add.length) { alert(msg + '\n\nWalang ma-import.'); return; }
  if (!await uiConfirm(msg + '\n\nTuloy?')) return;
  let ok = 0, fail = 0;
  for (const u of plan.upd) { try { await db.collection('employees').doc(u.id).set({ ...u.data, updatedAt: firebase.firestore.FieldValue.serverTimestamp() }, { merge: true }); ok++; } catch (e) { fail++; console.error(e); } }
  let n = 0;
  for (const x of plan.add) { try { const d = { ...x.data, empId: x.empId || ('EMP-' + (Date.now() + (n++)).toString().slice(-6)), status: x.data.status || 'Active', createdAt: firebase.firestore.FieldValue.serverTimestamp(), updatedAt: firebase.firestore.FieldValue.serverTimestamp() }; await db.collection('employees').add(d); ok++; } catch (e) { fail++; console.error(e); } }
  await logSystemAction('EMPLOYEE_IMPORT', `Nag-import ng employees CSV. Updated: ${plan.upd.length}, Bago: ${plan.add.length}, Pumalya: ${fail}.`);
  alert(`✅ Tapos ang import. Na-save: ${ok}` + (fail ? `\nPumalya: ${fail}` : '')); loadAdminEmployees();
}

function exportVendorsCSV() {
  if (!vnIsAdmin()) { alert('Admin / Super Admin lang ang puwedeng mag-export ng vendors.'); return; }
  const list = (typeof vnVisible === 'function') ? vnVisible() : allVendors;
  if (!list || list.length === 0) {
    alert('Walang vendor records.');
    return;
  }
  const headers = ['Vendor_Name', 'Companies', 'Contact_Person', 'Contact_Details', 'Address', 'Terms'];
  let rows = [headers.join(',')];
  list.forEach(v => {
    rows.push([
      `"${(v.name||'').replace(/"/g, '""')}"`,
      `"${vnCos(v).join('; ').replace(/"/g, '""')}"`,
      `"${(v.contactPerson||'').replace(/"/g, '""')}"`,
      `"${(v.contactDetails||'').replace(/"/g, '""')}"`,
      `"${(v.address||'').replace(/"/g, '""')}"`,
      `"${(v.terms||'').replace(/"/g, '""')}"`
    ].join(','));
  });
  downloadCSVFile(rows.join('\r\n'), 'Vendors_Directory.csv');
}

function exportCustomersCSV() {
  if (!allCustomers || allCustomers.length === 0) {
    alert('Walang customer records.');
    return;
  }
  const headers = ['Customer_Name', 'Address', 'Contact', 'Bank_Details', 'Customer_Type'];
  let rows = [headers.join(',')];
  allCustomers.forEach(c => {
    rows.push([
      `"${(c.name||'').replace(/"/g, '""')}"`,
      `"${(c.address||'').replace(/"/g, '""')}"`,
      `"${(c.contact||'').replace(/"/g, '""')}"`,
      `"${(c.bank||'').replace(/"/g, '""')}"`,
      `"${(c.type||'Retail').replace(/"/g, '""')}"`
    ].join(','));
  });
  downloadCSVFile(rows.join('\r\n'), 'Customers_Directory.csv');
}

function downloadCSVFile(csvContent, filename) {
  const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ========================================================
// 🖨️ PRINT LISTS (EMPLOYEES, VENDORS, CUSTOMERS)
// ========================================================
function printEmployeesReport() {
  if (!hrEmployees || hrEmployees.length === 0) { alert('Walang employee records.'); return; }
  let trs = '';
  hrEmployees.forEach(e => {
    const fullName = e.lname ? `${e.lname}, ${e.fname} ${e.mname||''}` : (e.name || '--');
    trs += `<tr>
      <td>${e.empId||e.id}</td>
      <td><b>${fullName}</b> (${e.nickname||'--'})</td>
      <td>${e.role||'--'} / ${e.dept||'--'}</td>
      <td>${e.classification||'Rank & File'}</td>
      <td>₱${parseFloat(e.baseSalary||0).toFixed(2)}</td>
      <td>${e.contact||'--'}</td>
      <td>${e.status||'Active'}</td>
    </tr>`;
  });
  openPrintableTableReport('EMPLOYEE MASTERLIST REPORT', ['Emp ID', 'Name & Nickname', 'Position & Dept', 'Class', 'Base Rate', 'Contact', 'Status'], trs);
}

function printVendorsReport() {
  if (!allVendors || allVendors.length === 0) { alert('Walang vendor records.'); return; }
  let trs = '';
  allVendors.forEach(v => {
    trs += `<tr>
      <td><b>${v.name}</b></td>
      <td>${v.contactPerson||'--'}</td>
      <td>${v.contactDetails||'--'}</td>
      <td>${v.address||'--'}</td>
      <td>${v.terms||'COD'}</td>
    </tr>`;
  });
  openPrintableTableReport('OFFICIAL VENDOR / SUPPLIER DIRECTORY', ['Vendor Name', 'Contact Person', 'Contact Details', 'Address', 'Terms'], trs);
}

function printCustomersReport() {
  if (!allCustomers || allCustomers.length === 0) { alert('Walang customer records.'); return; }
  let trs = '';
  allCustomers.forEach(c => {
    trs += `<tr>
      <td><b>${c.name}</b></td>
      <td>${c.address||'--'}</td>
      <td>${c.contact||'--'}</td>
      <td>${c.bank||'--'}</td>
      <td>${c.type||'Retail'}</td>
    </tr>`;
  });
  openPrintableTableReport('REGISTERED CUSTOMERS DIRECTORY (AGENTS / OUTLETS)', ['Customer Name', 'Address', 'Contact No.', 'Bank Account', 'Type'], trs);
}

function openPrintableTableReport(title, headers, rowsHtml) {
  const brandName = (localStorage.getItem('kusina_brand_name') || 'KUSINA ERP').toUpperCase();
  const dateStr = new Date().toLocaleString();
  const ths = headers.map(h => `<th style="border: 1px solid #000; padding: 6px; background: #f1f5f9; text-align: left; font-size: 9pt;">${h}</th>`).join('');
  
  const printWin = window.open('', '', 'width=950,height=900');
  printWin.document.write(`
    <html>
    <head><title>${title}</title>
    <style>
      @page { size: A4 landscape; margin: 10mm; }
      body { font-family: Arial, sans-serif; font-size: 9.5pt; color: #000; margin: 0; padding: 10px; }
      table { width: 100%; border-collapse: collapse; margin-top: 10px; }
      td { border: 1px solid #333; padding: 6px; font-size: 9pt; }
    </style>
    </head>
    <body>
      <div style="text-align: center; margin-bottom: 15px;">
        <h2 style="margin: 0; text-transform: uppercase;">${brandName}</h2>
        <h3 style="margin: 4px 0;">${title}</h3>
        <small style="color: #64748b;">Generated on: ${dateStr}</small>
      </div>
      <table>
        <thead><tr>${ths}</tr></thead>
        <tbody>${rowsHtml}</tbody>
      </table>
    </body>
    </html>
  `);
  printWin.document.close();
  printWin.focus();
  setTimeout(() => { printWin.print(); }, 400);
}


// ========================================================
// 🎂 ANIMATED BIRTHDAY CELEBRANTS POPUP ENGINE (PER-ACCOUNT)
// - Per-account tracking: Lilitaw sa unang login ng bawat account ngayong araw
// - Kahit iisang computer lang, kung nag-switch account, lilitaw pa rin sa bago
// - Strict date comparison: Kung kailan mismo ang kaarawan, doon lang lilitaw
// ========================================================

function parseMonthAndDay(dateVal) {
  if (!dateVal) return null;
  
  // Kung Firestore Timestamp
  if (dateVal.toDate && typeof dateVal.toDate === 'function') {
    const d = dateVal.toDate();
    return {
      month: String(d.getMonth() + 1).padStart(2, '0'),
      day: String(d.getDate()).padStart(2, '0'),
      year: d.getFullYear()
    };
  }

  const str = String(dateVal).trim();
  
  // Format: YYYY-MM-DD o YYYY/MM/DD
  if (/^\d{4}[-/]\d{1,2}[-/]\d{1,2}/.test(str)) {
    const p = str.split(/[-/]/);
    return {
      year: parseInt(p[0], 10),
      month: String(parseInt(p[1], 10)).padStart(2, '0'),
      day: String(parseInt(p[2], 10)).padStart(2, '0')
    };
  }

  // Format: MM/DD/YYYY o M/D/YYYY
  if (/^\d{1,2}[-/]\d{1,2}[-/]\d{4}/.test(str)) {
    const p = str.split(/[-/]/);
    return {
      month: String(parseInt(p[0], 10)).padStart(2, '0'),
      day: String(parseInt(p[1], 10)).padStart(2, '0'),
      year: parseInt(p[2], 10)
    };
  }

  // Fallback gamit ang Date parser
  const d = new Date(str);
  if (!isNaN(d.getTime())) {
    return {
      month: String(d.getMonth() + 1).padStart(2, '0'),
      day: String(d.getDate()).padStart(2, '0'),
      year: d.getFullYear()
    };
  }

  return null;
}

function calculateAgeFromDOB(dobVal) {
  const parsed = parseMonthAndDay(dobVal);
  if (!parsed || !parsed.year) return '-- taong gulang';
  const now = new Date();
  let age = now.getFullYear() - parsed.year;
  const m = (now.getMonth() + 1) - parseInt(parsed.month, 10);
  if (m < 0 || (m === 0 && now.getDate() < parseInt(parsed.day, 10))) {
    age--;
  }
  return `${age} taong gulang`;
}

function calculateTenure(hireDateVal) {
  const parsed = parseMonthAndDay(hireDateVal);
  if (!parsed || !parsed.year) return 'Bagong Kapamilya';
  try {
    const hireDate = new Date(parsed.year, parseInt(parsed.month, 10) - 1, parseInt(parsed.day, 10));
    const now = new Date();
    
    let years = now.getFullYear() - hireDate.getFullYear();
    let months = now.getMonth() - hireDate.getMonth();
    let days = now.getDate() - hireDate.getDate();

    if (days < 0) months--;
    if (months < 0) {
      years--;
      months += 12;
    }

    if (years <= 0 && months <= 0) {
      return 'Bago sa Kumpanya (< 1 buwan)';
    } else if (years <= 0) {
      return `${months} buwan sa kumpanya`;
    } else if (months === 0) {
      return `${years} taon sa kumpanya`;
    } else {
      return `${years} taon at ${months} buwan sa kumpanya`;
    }
  } catch (e) {
    return 'Kapamilya';
  }
}

async function checkTodayBirthdayCelebrants() {
  if (typeof db === 'undefined' || !db) return;

  const u = getCurrentUser();
  if (!u) return; // Walang naka-login

  // TUKOY SA ACCOUNT: Ihiwalay ang tracking bawat email account
  const userAccountKey = (u.email || u.id || u.name || 'guest').toLowerCase().replace(/[^a-z0-9]/g, '_');

  const today = new Date();
  const currentMonth = String(today.getMonth() + 1).padStart(2, '0');
  const currentDay = String(today.getDate()).padStart(2, '0');
  const todayKey = `${today.getFullYear()}-${currentMonth}-${currentDay}`;

  // Unique key bawat user account para sa araw na ito
  const accountStorageKey = `kusina_bday_seen_${userAccountKey}_${todayKey}`;

  if (localStorage.getItem(accountStorageKey) === 'true') {
    return; // Napanood na ng account na ito ngayong araw
  }

  try {
    const snap = await db.collection('employees').get();
    if (snap.empty) return;

    const celebrants = [];

    snap.forEach(doc => {
      const e = doc.data();
      const status = (e.status || 'Active').toLowerCase();
      if (status !== 'resigned' && status !== 'terminated') {
        const bdayParsed = parseMonthAndDay(e.dob || e.dateOfBirth || e.birthdate);
        
        // EKSATONG ARAW LANG: Kung bukas pa, bukas lang lalabas
        if (bdayParsed && bdayParsed.month === currentMonth && bdayParsed.day === currentDay) {
          const fullName = e.lname ? `${e.fname || ''} ${e.lname}`.trim() : (e.name || e.fname || 'Empleyado');
          const nickname = e.nickname ? `"${e.nickname}"` : '';
          const role = e.role || e.jobTitle || 'Team Member';
          const dept = e.dept || e.department || '';
          const ageText = calculateAgeFromDOB(e.dob || e.dateOfBirth || e.birthdate);
          const tenureText = calculateTenure(e.hireDate || e.directHireDate);
          const photoUrl = e.photoUrl || e.profilePic || e.image || '';

          celebrants.push({
            fullName: fullName,
            nickname: nickname,
            role: role,
            dept: dept,
            ageText: ageText,
            tenureText: tenureText,
            photoUrl: photoUrl,
            initial: (fullName || 'E').charAt(0).toUpperCase()
          });
        }
      }
    });

    if (celebrants.length > 0) {
      const cardsContainer = document.getElementById('birthday-celebrants-cards');
      if (cardsContainer) {
        let cardsHtml = '';
        celebrants.forEach(c => {
          const avatarHtml = c.photoUrl
            ? `<img src="${c.photoUrl}" class="celebrant-avatar" alt="${c.fullName}">`
            : `<div class="celebrant-avatar-placeholder">${c.initial}</div>`;

          cardsHtml += `
            <div class="celebrant-card">
              ${avatarHtml}
              <div style="flex: 1;">
                <h3 class="celebrant-name">${c.fullName} ${c.nickname ? `<span style="font-size: 1rem; color: #b45309; font-weight: 700;">${c.nickname}</span>` : ''}</h3>
                <div class="celebrant-role">💼 ${c.role} ${c.dept ? `(${c.dept})` : ''}</div>
                <div class="celebrant-badge-box">
                  <span class="celebrant-badge">🎂 ${c.ageText}</span>
                  <span class="celebrant-badge">⭐ ${c.tenureText}</span>
                </div>
              </div>
            </div>
          `;
        });
        cardsContainer.innerHTML = cardsHtml;
      }

      const modal = document.getElementById('birthday-greeting-modal');
      if (modal) {
        modal.style.display = 'flex';
      }

      // Itago para sa account na ito ngayong araw
      localStorage.setItem(accountStorageKey, 'true');
    }
  } catch (err) {
    console.warn('Birthday check warning:', err);
  }
}

function closeBirthdayModal() {
  const modal = document.getElementById('birthday-greeting-modal');
  if (modal) modal.style.display = 'none';
}

// Auto-trigger sa pagsisimula ng pahina
window.addEventListener('load', () => {
  setTimeout(() => {
    checkTodayBirthdayCelebrants();
  }, 1200);
});


// ========================================================
// 🛡️ ENHANCED AUDIT TRAIL LOGGING WRAPPERS
// Bawat print, export, download, at transactions ay may logs
// ========================================================

if (typeof printDirectVendorPO === 'function') {
  const origPrintDirectVendorPO = printDirectVendorPO;
  printDirectVendorPO = function(poId) {
    const po = (allVendorPOs || []).find(p => p.id === poId);
    if (po) {
      logSystemAction('VENDOR_PO_PRINTED', `Nag-print ng kopya ng Vendor PO: ${po.poNumber} (Supplier: ${po.vendorName}, Halaga: ₱${parseFloat(po.totalAmount||0).toFixed(2)})`);
    }
    origPrintDirectVendorPO(poId);
  };
}

if (typeof printPickingGuide === 'function') {
  const origPrintPickingGuide = printPickingGuide;
  printPickingGuide = function(orderId, format) {
    const ord = (currentOrders || []).find(o => o.id === orderId);
    if (ord) {
      logSystemAction('PICKING_SLIP_PRINTED', `Nag-print ng Staging/Picking Slip para sa Order: ${ord.orderId || ord.id} (${ord.branchName})`);
    }
    origPrintPickingGuide(orderId, format);
  };
}

if (typeof downloadBranchOrderCSV === 'function') {
  const origDownloadBranchOrderCSV = downloadBranchOrderCSV;
  downloadBranchOrderCSV = function(orderId) {
    const ord = (currentOrders || []).find(o => o.id === orderId);
    if (ord) {
      logSystemAction('ORDER_CSV_DOWNLOADED', `Nag-export ng 5-column order CSV: ${ord.orderId || ord.id} (${ord.branchName})`);
    }
    origDownloadBranchOrderCSV(orderId);
  };
}

if (typeof copyBranchOrderToClipboard === 'function') {
  const origCopyBranchOrderToClipboard = copyBranchOrderToClipboard;
  copyBranchOrderToClipboard = function(orderId) {
    const ord = (currentOrders || []).find(o => o.id === orderId);
    if (ord) {
      logSystemAction('ORDER_COPIED_TO_CLIPBOARD', `Kinopya sa clipboard ang detalye ng order: ${ord.orderId || ord.id}`);
    }
    origCopyBranchOrderToClipboard(orderId);
  };
}

if (typeof exportVendorPOsCSV === 'function') {
  const origExportVendorPOsCSV = exportVendorPOsCSV;
  exportVendorPOsCSV = function() {
    logSystemAction('VENDOR_PO_EXPORTED', `Nag-download ng buong Vendor Purchase Orders Masterlist sa CSV.`);
    origExportVendorPOsCSV();
  };
}

if (typeof exportEmployeesCSV === 'function') {
  const origExportEmployeesCSV = exportEmployeesCSV;
  exportEmployeesCSV = function() {
    logSystemAction('EMPLOYEES_EXPORTED', `Nag-export ng buong Employee HR Masterlist sa CSV.`);
    origExportEmployeesCSV();
  };
}

if (typeof printEmployeesReport === 'function') {
  const origPrintEmployeesReport = printEmployeesReport;
  printEmployeesReport = function() {
    logSystemAction('EMPLOYEES_PRINTED', `Nag-print ng physical report ng Employee Masterlist.`);
    origPrintEmployeesReport();
  };
}

if (typeof exportVendorsCSV === 'function') {
  const origExportVendorsCSV = exportVendorsCSV;
  exportVendorsCSV = function() {
    logSystemAction('VENDORS_EXPORTED', `Nag-export ng listahan ng Vendors/Suppliers sa CSV.`);
    origExportVendorsCSV();
  };
}

if (typeof printVendorsReport === 'function') {
  const origPrintVendorsReport = printVendorsReport;
  printVendorsReport = function() {
    logSystemAction('VENDORS_PRINTED', `Nag-print ng opisyal na listahan ng mga Vendors/Suppliers.`);
    origPrintVendorsReport();
  };
}

if (typeof printCustomersReport === 'function') {
  const origPrintCustomersReport = printCustomersReport;
  printCustomersReport = function() {
    logSystemAction('CUSTOMERS_PRINTED', `Nag-print ng talaan ng mga Customers at Outlets.`);
    origPrintCustomersReport();
  };
}

if (typeof exportCommissaryProductsCSV === 'function') {
  const origExportCommissaryProductsCSV = exportCommissaryProductsCSV;
  exportCommissaryProductsCSV = async function() {
    logSystemAction('PRODUCTS_EXPORTED', `Nag-export ng Product Masterlist sa CSV.`);
    await origExportCommissaryProductsCSV();
  };
}

// ========================================================
// 🏭 MANUFACTURING (BOM) & WORK ORDERS ENGINE
// ========================================================
let bomRecipes = [];
let activeIngredients = [];
let editingBomId = null; // null = bagong recipe, may value = ine-edit na recipe

async function loadManufacturing() {
  const tbody = document.getElementById('admin-mfg-tbody');
  if (!tbody || !db) return;
  try {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align: center;">Kinukuha ang BOMs...</td></tr>';
    const snap = await db.collection('bom_recipes').get();
    bomRecipes = [];
    if (snap.empty) {
      tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: #94a3b8;">Wala pang naka-set na Recipe/BOM.</td></tr>';
      return;
    }
    snap.forEach(d => bomRecipes.push({id: d.id, ...d.data()}));
    loadHubOptions();
    { const hf = document.getElementById('mfg-hub-filter'); const meU = getCurrentUser() || {}; if (hf && normalizeRole(meU.role) !== 'admin') (hf.parentElement.classList.contains('ss-wrap') ? hf.parentElement : hf).style.display = 'none'; }
    
    let html = '';
    visibleBoms().forEach(b => {
      const rmList = (b.ingredients || []).map(i => `${i.qty} ${bomUomName(i)} ${i.itemName}`).join(', ');
      const rev = b.revision ? `<br><small style="color:#64748b;">Rev ${b.revision}${b.lastEditedBy ? ' · ' + b.lastEditedBy : ''}</small>` : '';
      html += `<tr>
        <td><b style="color:#0284c7;">${b.finishedGoodName}</b><br><small>${b.finishedGoodCode}</small>${b.hub ? `<br><small style="color:#7c3aed;">🏢 ${srchEsc(b.hub)}</small>` : ''}${rev}</td>
        <td style="font-size: 0.85rem;">${rmList}</td>
        <td><b>${b.yieldQty}</b> batches</td>
        <td><span class="badge badge-success">Active</span></td>
        <td style="white-space:nowrap;">
          <button class="btn btn-sm btn-secondary" onclick="viewBomReport('${b.id}')">📄 Report</button>
          <button class="btn btn-sm btn-primary" onclick="openRecipeBuilderModal('${b.id}')">✏️ Edit</button>
          <button class="btn btn-sm btn-danger" onclick="deleteBOM('${b.id}')">Del</button>
        </td>
      </tr>`;
    });
    tbody.innerHTML = html || '<tr><td colspan="5" style="text-align: center; color: #94a3b8;">Walang recipe para sa hub na ito.</td></tr>';
  } catch(e) { console.error(e); }
}

function bomHubProducts() {
  const hv = (document.getElementById('bom-hub') || {}).value || '';
  return (adminProductsList || []).filter(p => productVisibleToHub(p, hv));
}
async function bomHubChanged() {
  const fgList = document.getElementById('bom-fg-list');
  if (fgList) { fgList.innerHTML = ''; bomHubProducts().forEach(p => { fgList.innerHTML += `<option value="${p.itemName} (${p.itemCode || p.id})"></option>`; }); }
  if (typeof bomSearchRM === 'function') bomSearchRM();
}

async function openRecipeBuilderModal(bomId) {
  if (adminProductsList.length === 0) await loadAdminProducts();
  editingBomId = (typeof bomId === 'string' && bomId) ? bomId : null;
  const editBom = editingBomId ? bomRecipes.find(b => b.id === editingBomId) : null;
  if (editingBomId && !editBom) { alert('Hindi nahanap ang recipe. I-refresh muna ang listahan.'); editingBomId = null; return; }
  
  const fgInput = document.getElementById('bom-finished-good');
  const rmInput = document.getElementById('bom-rm-select');
  const fgList = document.getElementById('bom-fg-list');
  const rmList = document.getElementById('bom-rm-list');
  
  if (fgInput) fgInput.value = '';
  if (rmInput) rmInput.value = '';

  await loadHubOptions();
  { const hs = document.getElementById('bom-hub'); const meU = getCurrentUser() || {};
    if (hs) { setSelValue(hs, editBom ? (editBom.hub || '') : activeHubFilter()); hs.disabled = normalizeRole(meU.role) !== 'admin'; } }
  if (fgList) {
    fgList.innerHTML = '';
    bomHubProducts().forEach(p => {
      fgList.innerHTML += `<option value="${p.itemName} (${p.itemCode || p.id})"></option>`;
    });
  }
  activeIngredients = [];
  bomResetRMPicker();
  const autoScanEl = document.getElementById('bom-auto-scan');
  if (autoScanEl) autoScanEl.checked = (navigator.maxTouchPoints || 0) > 0;
  const titleEl = document.getElementById('bom-modal-title');
  const saveBtn = document.getElementById('bom-save-btn');
  const yieldEl = document.getElementById('bom-yield-qty');
  if (editBom) {
    // EDIT MODE: ikarga ang kasalukuyang recipe (pangalan, yield, sangkap)
    if (fgInput) fgInput.value = editBom.finishedGoodName;
    if (yieldEl) yieldEl.value = editBom.yieldQty;
    { const nEl = document.getElementById('bom-notes'); if (nEl) nEl.value = editBom.notes || ''; }
    activeIngredients = (editBom.ingredients || []).map(i => ({...i}));
    if (titleEl) titleEl.innerText = '✏️ I-edit ang Recipe: ' + editBom.finishedGoodName;
    if (saveBtn) saveBtn.innerText = '💾 I-save ang Pagbabago';
  } else {
    if (yieldEl) yieldEl.value = 1;
    { const nEl = document.getElementById('bom-notes'); if (nEl) nEl.value = ''; }
    if (titleEl) titleEl.innerText = '🍳 Recipe Builder (Bill of Materials)';
    if (saveBtn) saveBtn.innerText = '💾 I-save ang Recipe (BOM)';
  }
  renderIngredientsTable();
  document.getElementById('recipe-builder-modal').style.display = 'flex';
}

// Inline edit ng qty / UOM ng sangkap (kahit kailan)
function updateIngredientQty(idx, val) {
  const q = parseFloat(val);
  if (!(q > 0)) { alert('Dapat mas mataas sa 0 ang quantity.'); renderIngredientsTable(); return; }
  activeIngredients[idx].qty = q;
}
function bomUomLabelFor(ing, which) {
  const p = (adminProductsList || []).find(x => x.id === ing.itemCode);
  if (p) return which === 'Whole' ? (p.wholeUOM || 'Whole') : (p.looseUOM || 'Loose');
  return which;
}
function updateIngredientUOM(idx, uom) {
  const ing = activeIngredients[idx];
  ing.uom = uom;
  ing.uomName = bomUomLabelFor(ing, uom);
  const prod = adminProductsList.find(p => p.id === ing.itemCode);
  if (prod) ing.unitPrice = uom === 'Whole' ? (prod.wholePrice || 0) : (prod.loosePrice || 0);
}

// ---------- Shared searchable-picker helpers ----------
function srchEsc(v) {
  return String(v == null ? '' : v).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function smartMatch(query, ...fields) {
  const q = (query || '').toLowerCase().trim();
  if (!q) return true;
  const hay = fields.map(f => String(f == null ? '' : f).toLowerCase()).join(' ');
  return q.split(/\s+/).every(t => hay.includes(t));
}
function srchRender(boxId, arr, rowFn, pickFn, emptyMsg) {
  const box = document.getElementById(boxId);
  if (!box) return;
  if (!arr.length) box.innerHTML = `<div class="srch-empty">${emptyMsg}</div>`;
  else box.innerHTML = arr.map((x, i) => `<div class="srch-item" onmousedown="event.preventDefault(); ${pickFn}(${i})">${rowFn(x)}</div>`).join('');
  box.style.display = 'block';
}
function srchKey(e, boxId, onPick) {
  const box = document.getElementById(boxId);
  if (!box) return;
  const items = Array.from(box.querySelectorAll('.srch-item'));
  let cur = items.findIndex(x => x.classList.contains('active'));
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    e.preventDefault();
    if (!items.length) return;
    if (box.style.display === 'none') box.style.display = 'block';
    items.forEach(x => x.classList.remove('active'));
    cur = e.key === 'ArrowDown' ? Math.min(cur + 1, items.length - 1) : Math.max(cur - 1, 0);
    items[cur].classList.add('active');
    items[cur].scrollIntoView({ block: 'nearest' });
  } else if (e.key === 'Enter') {
    e.preventDefault();
    onPick(cur >= 0 ? cur : 0);
  } else if (e.key === 'Escape') {
    box.style.display = 'none';
  }
}
document.addEventListener('click', e => {
  if (e.target.closest && e.target.closest('.srch-wrap')) return;
  document.querySelectorAll('.srch-results').forEach(d => { d.style.display = 'none'; });
});