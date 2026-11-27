


// ========================================================
// 💰 KENJI TEI STYLE SALARY SLIP ENGINE & NUMBER-TO-WORDS
// ========================================================

function numberToWordsPHP(num) {
  if (isNaN(num) || num === null || num === undefined) return 'Zero Pesos Only';
  const a = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  function inWords(n) {
    if (n === 0) return '';
    if (n < 20) return a[n] + ' ';
    if (n < 100) return b[Math.floor(n / 10)] + (n % 10 !== 0 ? '-' + a[n % 10] : '') + ' ';
    if (n < 1000) return a[Math.floor(n / 100)] + ' Hundred ' + inWords(n % 100);
    if (n < 1000000) return inWords(Math.floor(n / 1000)) + 'Thousand ' + inWords(n % 1000);
    if (n < 1000000000) return inWords(Math.floor(n / 1000000)) + 'Million ' + inWords(n % 1000000);
    return inWords(Math.floor(n / 1000000000)) + 'Billion ' + inWords(n % 1000000000);
  }

  const parts = Number(num).toFixed(2).split('.');
  let pesos = parseInt(parts[0], 10);
  let centavos = parseInt(parts[1], 10);

  let pesoWords = pesos === 0 ? 'Zero Pesos' : inWords(pesos).trim() + ' Pesos';
  let centavoWords = '';
  if (centavos > 0) {
    centavoWords = ' And ' + inWords(centavos).trim() + ' Centavos';
  }
  return (pesoWords + centavoWords + ' Only').replace(/\s+/g, ' ');
}

let activePayrollEmployeeObj = null;

function closePayrollModal() {
  const m = document.getElementById('hr-payroll-modal');
  if (m) m.style.display = 'none';
}


async function openPayrollModal() {
  if (typeof hrEmployees === 'undefined' || hrEmployees.length === 0) {
    if (typeof loadAdminEmployees === 'function') await loadAdminEmployees();
  }

  const sel = document.getElementById('pay-emp-select');
  if (sel) {
    sel.innerHTML = '<option value="">-- Pumili ng Empleyado --</option>';
    (hrEmployees || []).filter(e => e.status !== 'Resigned' && e.status !== 'Terminated').forEach(e => {
      const fullName = e.lname ? `${e.lname}, ${e.fname} ${e.mname || ''}`.trim() : (e.name || e.fname);
      sel.innerHTML += `<option value="${e.id || e.empId}">${fullName} (${e.role || 'Staff'})</option>`;
    });
  }

  logSystemAction('PAYROLL_FORM_OPENED', 'Binuksan ni Admin/HR ang Generate Salary Slip modal.');

  const modal = document.getElementById('hr-payroll-modal');
  if (modal) modal.style.display = 'flex';
}

function onPayrollEmpChange() {
  const empId = document.getElementById('pay-emp-select')?.value;
  activePayrollEmployeeObj = (hrEmployees || []).find(e => e.id === empId || e.empId === empId);
  if (!activePayrollEmployeeObj) return;

  const e = activePayrollEmployeeObj;
  
  if (document.getElementById('pay-company')) document.getElementById('pay-company').value = e.company || 'KTFGI';
  if (document.getElementById('pay-location')) document.getElementById('pay-location').value = e.dept || e.subdept || 'HO';
  
  const dailyRate = parseFloat(e.baseSalary || 0);
  if (document.getElementById('pay-daily-rate')) document.getElementById('pay-daily-rate').value = dailyRate;

  // Set default dates kung wala pa
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const d = now.getDate();
  
  let periodText = '';
  let sDate = '';
  let eDate = '';
  const monthName = now.toLocaleString('en-US', { month: 'short' }).toUpperCase();

  if (d <= 15) {
    periodText = `${monthName} 1-15, ${yyyy}`;
    sDate = `${yyyy}-${mm}-01`;
    eDate = `${yyyy}-${mm}-15`;
  } else {
    const lastDay = new Date(yyyy, now.getMonth() + 1, 0).getDate();
    periodText = `${monthName} 16-${lastDay}, ${yyyy}`;
    sDate = `${yyyy}-${mm}-16`;
    eDate = `${yyyy}-${mm}-${lastDay}`;
  }

  if (document.getElementById('pay-period-text')) document.getElementById('pay-period-text').value = periodText;
  if (document.getElementById('pay-start-date')) document.getElementById('pay-start-date').value = sDate;
  if (document.getElementById('pay-end-date')) document.getElementById('pay-end-date').value = eDate;

  // Auto-fill statutory defaults kung naka-save sa employee profile
  if (document.getElementById('pay-allowance-amt')) document.getElementById('pay-allowance-amt').value = parseFloat(e.allowance || 0);
  if (document.getElementById('pay-deminimis-amt')) document.getElementById('pay-deminimis-amt').value = parseFloat(e.deminimis || 0);
  
  // Calculate default basic
  const days = parseFloat(document.getElementById('pay-days-count')?.value || 13);
  if (document.getElementById('pay-basic-amt')) {
    document.getElementById('pay-basic-amt').value = (dailyRate * days).toFixed(2);
  }

  calculateSalarySlipLive();
}


function onNightDiffHoursChange() {
  const dailyRate = parseFloat(document.getElementById('pay-daily-rate')?.value || 0);
  const nightDiffHours = parseFloat(document.getElementById('pay-night-diff-hrs')?.value || 0);
  if (dailyRate > 0 && nightDiffHours >= 0) {
    const hourlyRate = dailyRate / 8;
    const computedND = parseFloat((hourlyRate * 0.10 * nightDiffHours).toFixed(2));
    const ndInput = document.getElementById('pay-night-diff');
    if (ndInput) ndInput.value = computedND;
  }
  calculateSalarySlipLive();
}

function calculateSalarySlipLive() {
  const dailyRate = parseFloat(document.getElementById('pay-daily-rate')?.value || 0);
  const days = parseFloat(document.getElementById('pay-days-count')?.value || 0);
  
  let basic = parseFloat(document.getElementById('pay-basic-amt')?.value || 0);
  const allowance = parseFloat(document.getElementById('pay-allowance-amt')?.value || 0);
  const deminimis = parseFloat(document.getElementById('pay-deminimis-amt')?.value || 0);
  const slRefund = parseFloat(document.getElementById('pay-sl-refund')?.value || 0);
  const leaveAmt = parseFloat(document.getElementById('pay-leave-amt')?.value || 0);
  const otherAllowance = parseFloat(document.getElementById('pay-other-allowance')?.value || 0);
  const adjBasic = parseFloat(document.getElementById('pay-adj-basic')?.value || 0);
  const otAdj = parseFloat(document.getElementById('pay-ot-adj')?.value || 0);
  const holAdj = parseFloat(document.getElementById('pay-holiday-adj')?.value || 0);

  // Overtime computation (Daily rate / 8 hrs * 1.25 OT multiplier)
  const otHours = parseFloat(document.getElementById('pay-ot-hrs')?.value || 0);
  let otAmt = parseFloat(document.getElementById('pay-ot-amt')?.value || 0);
  if (otHours > 0 && dailyRate > 0 && otAmt === 0) {
    const hourlyRate = dailyRate / 8;
    otAmt = parseFloat((hourlyRate * 1.25 * otHours).toFixed(2));
    if (document.getElementById('pay-ot-amt')) document.getElementById('pay-ot-amt').value = otAmt;
  }

  // Night Differential computation (10:00 PM to 6:00 AM - 10% premium ng hourly rate)
  const nightDiffHours = parseFloat(document.getElementById('pay-night-diff-hrs')?.value || 0);
  let nightDiff = parseFloat(document.getElementById('pay-night-diff')?.value || 0);
  if (nightDiffHours > 0 && dailyRate > 0 && nightDiff === 0) {
    const hourlyRate = dailyRate / 8;
    nightDiff = parseFloat((hourlyRate * 0.10 * nightDiffHours).toFixed(2));
    if (document.getElementById('pay-night-diff')) document.getElementById('pay-night-diff').value = nightDiff;
  }

  const specialHol = parseFloat(document.getElementById('pay-special-holiday')?.value || 0);
  const legalHol = parseFloat(document.getElementById('pay-legal-holiday')?.value || 0);

  const grossEarnings = basic + allowance + deminimis + slRefund + leaveAmt + otherAllowance + adjBasic + otAdj + holAdj + otAmt + specialHol + legalHol + nightDiff;

  // DEDUCTIONS
  const restdayWoPay = parseFloat(document.getElementById('pay-restday-wopay')?.value || 0);
  const absencesWoPay = parseFloat(document.getElementById('pay-absences-wopay')?.value || 0);
  
  // Late computation (Daily rate / 8 hrs / 60 mins)
  const lateMins = parseFloat(document.getElementById('pay-late-mins')?.value || 0);
  let lateAmt = parseFloat(document.getElementById('pay-late-amt')?.value || 0);
  if (lateMins > 0 && dailyRate > 0 && lateAmt === 0) {
    const minRate = (dailyRate / 8) / 60;
    lateAmt = parseFloat((minRate * lateMins).toFixed(2));
    if (document.getElementById('pay-late-amt')) document.getElementById('pay-late-amt').value = lateAmt;
  }

  const sssDec = parseFloat(document.getElementById('pay-sss-dec')?.value || 0);
  const sssAmt = parseFloat(document.getElementById('pay-sss-amt')?.value || 0);
  const sssLoan = parseFloat(document.getElementById('pay-sss-loan')?.value || 0);
  const hdmfAmt = parseFloat(document.getElementById('pay-hdmf-amt')?.value || 0);
  const hdmfLoan = parseFloat(document.getElementById('pay-hdmf-loan')?.value || 0);
  const phicAmt = parseFloat(document.getElementById('pay-phic-amt')?.value || 0);
  const taxAmt = parseFloat(document.getElementById('pay-tax-amt')?.value || 0);
  const caAmt = parseFloat(document.getElementById('pay-ca-amt')?.value || 0);
  const hmoAmt = parseFloat(document.getElementById('pay-hmo-amt')?.value || 0);

  const totalDeductions = restdayWoPay + absencesWoPay + lateAmt + sssDec + sssAmt + sssLoan + hdmfAmt + hdmfLoan + phicAmt + taxAmt + caAmt + hmoAmt;

  const netPay = Math.max(0, grossEarnings - totalDeductions);

  // Update Displays
  if (document.getElementById('pay-gross-display')) {
    document.getElementById('pay-gross-display').innerText = '₱' + grossEarnings.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  if (document.getElementById('pay-deduct-display')) {
    document.getElementById('pay-deduct-display').innerText = '₱' + totalDeductions.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  if (document.getElementById('pay-net-display')) {
    document.getElementById('pay-net-display').innerText = '₱' + netPay.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  if (document.getElementById('pay-net-words')) {
    document.getElementById('pay-net-words').innerText = numberToWordsPHP(netPay);
  }

  return {
    grossEarnings,
    totalDeductions,
    netPay,
    words: numberToWordsPHP(netPay)
  };
}

// 2-Step Save: Draft muna, walang bawas sa Cash on Hand
async function saveSalarySlipRecord(statusMode = 'Draft') {
  if (!activePayrollEmployeeObj) {
    alert('Mangyaring pumili muna ng empleyado.');
    return;
  }

  const calcs = calculateSalarySlipLive();
  const emp = activePayrollEmployeeObj;
  const fullName = emp.lname ? `${emp.lname}, ${emp.fname} ${emp.mname || ''}`.trim() : (emp.name || emp.fname);

  const payload = {
    empId: emp.empId || emp.id,
    empName: fullName,
    role: emp.role || 'Staff',
    company: document.getElementById('pay-company')?.value || 'KTFGI',
    location: document.getElementById('pay-location')?.value || 'HO',
    periodText: document.getElementById('pay-period-text')?.value || 'MAY 16-31, 2026',
    startDate: document.getElementById('pay-start-date')?.value || '',
    endDate: document.getElementById('pay-end-date')?.value || '',
    dailyRate: parseFloat(document.getElementById('pay-daily-rate')?.value || 0),
    daysWorked: parseFloat(document.getElementById('pay-days-count')?.value || 0),
    
    // Earnings Breakdown
    basic: parseFloat(document.getElementById('pay-basic-amt')?.value || 0),
    allowance: parseFloat(document.getElementById('pay-allowance-amt')?.value || 0),
    deminimis: parseFloat(document.getElementById('pay-deminimis-amt')?.value || 0),
    slRefund: parseFloat(document.getElementById('pay-sl-refund')?.value || 0),
    leaveDays: parseFloat(document.getElementById('pay-leave-days')?.value || 0),
    leaveAmt: parseFloat(document.getElementById('pay-leave-amt')?.value || 0),
    otherAllowance: parseFloat(document.getElementById('pay-other-allowance')?.value || 0),
    adjBasic: parseFloat(document.getElementById('pay-adj-basic')?.value || 0),
    otAdj: parseFloat(document.getElementById('pay-ot-adj')?.value || 0),
    holidayAdj: parseFloat(document.getElementById('pay-holiday-adj')?.value || 0),
    otHours: parseFloat(document.getElementById('pay-ot-hrs')?.value || 0),
    otAmt: parseFloat(document.getElementById('pay-ot-amt')?.value || 0),
    specialHoliday: parseFloat(document.getElementById('pay-special-holiday')?.value || 0),
    legalHoliday: parseFloat(document.getElementById('pay-legal-holiday')?.value || 0),
    nightDiffHours: parseFloat(document.getElementById('pay-night-diff-hrs')?.value || 0),
    nightDiff: parseFloat(document.getElementById('pay-night-diff')?.value || 0),
    grossEarnings: calcs.grossEarnings,

    // Deductions Breakdown
    restdayWoPay: parseFloat(document.getElementById('pay-restday-wopay')?.value || 0),
    absencesWoPay: parseFloat(document.getElementById('pay-absences-wopay')?.value || 0),
    lateMins: parseFloat(document.getElementById('pay-late-mins')?.value || 0),
    lateAmt: parseFloat(document.getElementById('pay-late-amt')?.value || 0),
    sssDec: parseFloat(document.getElementById('pay-sss-dec')?.value || 0),
    sssAmt: parseFloat(document.getElementById('pay-sss-amt')?.value || 0),
    sssLoan: parseFloat(document.getElementById('pay-sss-loan')?.value || 0),
    hdmfAmt: parseFloat(document.getElementById('pay-hdmf-amt')?.value || 0),
    hdmfLoan: parseFloat(document.getElementById('pay-hdmf-loan')?.value || 0),
    phicAmt: parseFloat(document.getElementById('pay-phic-amt')?.value || 0),
    taxAmt: parseFloat(document.getElementById('pay-tax-amt')?.value || 0),
    caAmt: parseFloat(document.getElementById('pay-ca-amt')?.value || 0),
    hmoAmt: parseFloat(document.getElementById('pay-hmo-amt')?.value || 0),
    totalDeductions: calcs.totalDeductions,

    // CA Summary
    caNoPay: document.getElementById('pay-ca-nopay')?.value || '',
    caSummaryAmt: parseFloat(document.getElementById('pay-ca-summary-amt')?.value || 0),
    caBalance: parseFloat(document.getElementById('pay-ca-balance')?.value || 0),

    // Net
    netPay: calcs.netPay,
    amountInWords: calcs.words,
    status: statusMode, // 'Draft' o 'Released / Paid'
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    createdBy: getCurrentUser()?.name || 'Admin'
  };

  try {
    const docRef = await db.collection('payrolls').add(payload);
    logSystemAction('PAYROLL_GENERATED', `Nag-generate ng payslip (${payload.periodText}) para kay ${payload.empName}. Gross: ₱${calcs.grossEarnings}, Net: ₱${calcs.netPay} (Status: ${statusMode})`);
    
    alert(`✅ Matagumpay na nai-save ang Payslip ni ${fullName} bilang ${statusMode}!
(Hindi pa nababawas sa Cash on Hand hangga't hindi ito nire-release.)`);
    closePayrollModal();
    loadAdminPayroll();
  } catch (err) {
    alert('Error sa pag-save ng payslip: ' + err.message);
  }
}

// Preview mula sa Form
function previewCurrentSalarySlipModal() {
  if (!activePayrollEmployeeObj) {
    alert('Pumili muna ng empleyado para ma-preview.');
    return;
  }
  const calcs = calculateSalarySlipLive();
  const emp = activePayrollEmployeeObj;
  const fullName = emp.lname ? `${emp.lname}, ${emp.fname} ${emp.mname || ''}`.trim() : (emp.name || emp.fname);

  const mockSlip = {
    empName: fullName,
    role: emp.role || 'Staff',
    company: document.getElementById('pay-company')?.value || 'KTFGI',
    location: document.getElementById('pay-location')?.value || 'HO',
    periodText: document.getElementById('pay-period-text')?.value || 'MAY 16-31, 2026',
    dailyRate: parseFloat(document.getElementById('pay-daily-rate')?.value || 0),
    daysWorked: parseFloat(document.getElementById('pay-days-count')?.value || 0),
    
    basic: parseFloat(document.getElementById('pay-basic-amt')?.value || 0),
    allowance: parseFloat(document.getElementById('pay-allowance-amt')?.value || 0),
    deminimis: parseFloat(document.getElementById('pay-deminimis-amt')?.value || 0),
    slRefund: parseFloat(document.getElementById('pay-sl-refund')?.value || 0),
    leaveDays: parseFloat(document.getElementById('pay-leave-days')?.value || 0),
    leaveAmt: parseFloat(document.getElementById('pay-leave-amt')?.value || 0),
    otherAllowance: parseFloat(document.getElementById('pay-other-allowance')?.value || 0),
    adjBasic: parseFloat(document.getElementById('pay-adj-basic')?.value || 0),
    otAdj: parseFloat(document.getElementById('pay-ot-adj')?.value || 0),
    holidayAdj: parseFloat(document.getElementById('pay-holiday-adj')?.value || 0),
    otHours: parseFloat(document.getElementById('pay-ot-hrs')?.value || 0),
    otAmt: parseFloat(document.getElementById('pay-ot-amt')?.value || 0),
    specialHoliday: parseFloat(document.getElementById('pay-special-holiday')?.value || 0),
    legalHoliday: parseFloat(document.getElementById('pay-legal-holiday')?.value || 0),
    nightDiffHours: parseFloat(document.getElementById('pay-night-diff-hrs')?.value || 0),
    nightDiff: parseFloat(document.getElementById('pay-night-diff')?.value || 0),
    grossEarnings: calcs.grossEarnings,

    restdayWoPay: parseFloat(document.getElementById('pay-restday-wopay')?.value || 0),
    absencesWoPay: parseFloat(document.getElementById('pay-absences-wopay')?.value || 0),
    lateMins: parseFloat(document.getElementById('pay-late-mins')?.value || 0),
    lateAmt: parseFloat(document.getElementById('pay-late-amt')?.value || 0),
    sssDec: parseFloat(document.getElementById('pay-sss-dec')?.value || 0),
    sssAmt: parseFloat(document.getElementById('pay-sss-amt')?.value || 0),
    sssLoan: parseFloat(document.getElementById('pay-sss-loan')?.value || 0),
    hdmfAmt: parseFloat(document.getElementById('pay-hdmf-amt')?.value || 0),
    hdmfLoan: parseFloat(document.getElementById('pay-hdmf-loan')?.value || 0),
    phicAmt: parseFloat(document.getElementById('pay-phic-amt')?.value || 0),
    taxAmt: parseFloat(document.getElementById('pay-tax-amt')?.value || 0),
    caAmt: parseFloat(document.getElementById('pay-ca-amt')?.value || 0),
    hmoAmt: parseFloat(document.getElementById('pay-hmo-amt')?.value || 0),
    totalDeductions: calcs.totalDeductions,

    caNoPay: document.getElementById('pay-ca-nopay')?.value || '',
    caSummaryAmt: parseFloat(document.getElementById('pay-ca-summary-amt')?.value || 0),
    caBalance: parseFloat(document.getElementById('pay-ca-balance')?.value || 0),

    netPay: calcs.netPay,
    amountInWords: calcs.words
  };

  printKenjiTeiSalarySlip(mockSlip);
}

// 🖨️ PRINT / DOWNLOAD SALARY SLIP (Exact Kenji Tei Format mula sa Photo)
function printKenjiTeiSalarySlip(slip) {
  const brandLogo = localStorage.getItem('kusina_brand_logo') || '';
  const logoHtml = brandLogo ? `<img src="${brandLogo}" style="max-height: 48px; object-fit: contain;">` : `<div style="font-size: 1.8rem; font-weight: 900; color: #b91c1c;">楽<br><small style="font-size: 8pt; color: #000;">KENJI TEI</small></div>`;

  const fmt = (n) => parseFloat(n || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const printWin = window.open('', '', 'width=950,height=900');
  printWin.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Salary Slip - ${slip.empName} (${slip.periodText})</title>
      <style>
        @page { size: A4 portrait; margin: 10mm; }
        body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 9pt; color: #000; margin: 0; padding: 10px; }
        .slip-box { border: 2.5px solid #000; width: 100%; max-width: 820px; margin: auto; background: #fff; }
        .header-table { width: 100%; border-collapse: collapse; }
        .header-table td { border-bottom: 2.5px solid #000; }
        .banner-ktf { background: #fca5a5; color: #fff; text-align: center; font-size: 1.4rem; font-weight: 800; padding: 8px; border-left: 2px solid #000; }
        .grid-info { width: 100%; border-collapse: collapse; border-bottom: 2.5px solid #000; font-size: 8.5pt; }
        .grid-info td { padding: 3px 6px; }
        .main-table { width: 100%; border-collapse: collapse; }
        .main-table th { background: #f87171; color: #000; font-weight: 700; border: 1.5px solid #000; padding: 4px; font-size: 8.5pt; text-align: left; }
        .main-table td { border: 1px solid #000; padding: 2.5px 5px; font-size: 8pt; }
        .val-col { text-align: right; width: 85px; }
        .qty-col { text-align: center; width: 55px; background: #fee2e2; }
        .total-row { background: #fee2e2; font-weight: 800; }
        .net-pay-banner { background: #fca5a5; color: #fff; font-size: 1.1rem; font-weight: 900; text-align: center; padding: 4px; }
        @media print {
          body { padding: 0; }
          .no-print { display: none; }
        }
      </style>
    </head>
    <body>
      <div class="no-print" style="max-width: 820px; margin: 0 auto 10px auto; text-align: right;">
        <button onclick="window.print()" style="padding: 6px 16px; font-weight: 700; background: #2563eb; color: #fff; border: none; border-radius: 4px; cursor: pointer;">🖨️ I-print / I-save bilang PDF</button>
      </div>

      <div class="slip-box">
        <!-- HEADER -->
        <table class="header-table">
          <tr>
            <td style="width: 25%; text-align: center; padding: 6px;">${logoHtml}</td>
            <td style="width: 45%; text-align: center; padding: 6px;">
              <h2 style="margin: 0; font-size: 18pt; letter-spacing: 1px; font-weight: 900;">SALARY SLIP</h2>
              <div style="font-size: 12pt; font-weight: 700; border-top: 1.5px solid #000; margin-top: 4px; padding-top: 2px;">
                ${slip.periodText || 'MAY 16-31, 2026'}
              </div>
            </td>
            <td class="banner-ktf" style="width: 30%;">
              ${slip.company || 'Kenji Tei Food'}<br><span style="font-size: 1rem;">Group Inc.</span>
            </td>
          </tr>
        </table>

        <!-- EMPLOYEE HEADER INFO -->
        <table class="grid-info">
          <tr>
            <td style="width: 15%;">Name</td>
            <td style="width: 35%;">: <b>${slip.empName}</b></td>
            <td style="width: 15%; border-left: 2px solid #000;">Position</td>
            <td style="width: 35%;">: <b>${slip.role}</b></td>
          </tr>
          <tr>
            <td>Company</td>
            <td>: ${slip.company || 'KTFGI'}</td>
            <td style="border-left: 2px solid #000;">Location</td>
            <td>: ${slip.location || 'HO'}</td>
          </tr>
          <tr>
            <td>Number of Days</td>
            <td>: ${slip.daysWorked || 0}</td>
            <td style="border-left: 2px solid #000;">Daily Rate</td>
            <td>: ${slip.dailyRate > 0 ? fmt(slip.dailyRate) : ''}</td>
          </tr>
        </table>

        <!-- EARNINGS & DEDUCTIONS MAIN TABLE -->
        <table class="main-table">
          <thead>
            <tr>
              <th style="width: 27%;">Earnings</th>
              <th style="width: 8%; text-align: center;">No. of days</th>
              <th style="width: 15%; text-align: right;">Amount</th>
              <th style="width: 27%; border-left: 2px solid #000;">Deduction</th>
              <th style="width: 8%; text-align: center;">No. of days</th>
              <th style="width: 15%; text-align: right;">Amount</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Basic</td>
              <td class="qty-col"></td>
              <td class="val-col">${fmt(slip.basic)}</td>
              <td style="border-left: 2px solid #000;">Restday (w/o Pay)</td>
              <td class="qty-col"></td>
              <td class="val-col">${fmt(slip.restdayWoPay)}</td>
            </tr>
            <tr>
              <td>Allowance</td>
              <td class="qty-col"></td>
              <td class="val-col">${fmt(slip.allowance)}</td>
              <td style="border-left: 2px solid #000;">Absences (w/o Pay)</td>
              <td class="qty-col"></td>
              <td class="val-col">${fmt(slip.absencesWoPay)}</td>
            </tr>
            <tr>
              <td>Deminimis</td>
              <td class="qty-col"></td>
              <td class="val-col">${fmt(slip.deminimis)}</td>
              <td style="border-left: 2px solid #000;">Tardiness/Undertime</td>
              <td class="qty-col" style="font-size: 7pt;">${slip.lateMins > 0 ? slip.lateMins + ' M' : ''}</td>
              <td class="val-col">${fmt(slip.lateAmt)}</td>
            </tr>
            <tr>
              <td>SL Refund</td>
              <td class="qty-col"></td>
              <td class="val-col">${fmt(slip.slRefund)}</td>
              <td style="border-left: 2px solid #000;">SSS Contri Dec.1-5</td>
              <td class="qty-col"></td>
              <td class="val-col">${fmt(slip.sssDec)}</td>
            </tr>
            <tr>
              <td>Leave (w/ Pay)</td>
              <td class="qty-col">${slip.leaveDays > 0 ? slip.leaveDays : ''}</td>
              <td class="val-col">${fmt(slip.leaveAmt)}</td>
              <td style="border-left: 2px solid #000;">SSS Contribution</td>
              <td class="qty-col"></td>
              <td class="val-col">${fmt(slip.sssAmt)}</td>
            </tr>
            <tr>
              <td>Other Allowances</td>
              <td class="qty-col"></td>
              <td class="val-col">${fmt(slip.otherAllowance)}</td>
              <td style="border-left: 2px solid #000;">SSS Loan</td>
              <td class="qty-col"></td>
              <td class="val-col">${fmt(slip.sssLoan)}</td>
            </tr>
            <tr>
              <td>ADJ: Basic, Allowance, Demir</td>
              <td class="qty-col"></td>
              <td class="val-col">${fmt(slip.adjBasic)}</td>
              <td style="border-left: 2px solid #000;">HDMF</td>
              <td class="qty-col"></td>
              <td class="val-col">${fmt(slip.hdmfAmt)}</td>
            </tr>
            <tr>
              <td>OT Adjustment</td>
              <td class="qty-col"></td>
              <td class="val-col">${fmt(slip.otAdj)}</td>
              <td style="border-left: 2px solid #000;">HDMF Loan</td>
              <td class="qty-col"></td>
              <td class="val-col">${fmt(slip.hdmfLoan)}</td>
            </tr>
            <tr>
              <td>Holiday Adjustment</td>
              <td class="qty-col"></td>
              <td class="val-col">${fmt(slip.holidayAdj)}</td>
              <td style="border-left: 2px solid #000;">PHIC</td>
              <td class="qty-col"></td>
              <td class="val-col">${fmt(slip.phicAmt)}</td>
            </tr>
            <tr>
              <td>Regular Overtime</td>
              <td class="qty-col">${slip.otHours > 0 ? slip.otHours + ' H' : ''}</td>
              <td class="val-col">${fmt(slip.otAmt)}</td>
              <td style="border-left: 2px solid #000;">Tax</td>
              <td class="qty-col"></td>
              <td class="val-col">${fmt(slip.taxAmt)}</td>
            </tr>
            <tr>
              <td>Special Holiday</td>
              <td class="qty-col"></td>
              <td class="val-col">${fmt(slip.specialHoliday)}</td>
              <td style="border-left: 2px solid #000;">Cash Advance</td>
              <td class="qty-col"></td>
              <td class="val-col">${fmt(slip.caAmt)}</td>
            </tr>
            <tr>
              <td>Legal Holiday</td>
              <td class="qty-col"></td>
              <td class="val-col">${fmt(slip.legalHoliday)}</td>
              <td style="border-left: 2px solid #000;">HMO (Intellicare)</td>
              <td class="qty-col"></td>
              <td class="val-col">${fmt(slip.hmoAmt)}</td>
            </tr>
            <tr>
              <td>Night Differential</td>
              <td class="qty-col">${slip.nightDiffHours > 0 ? slip.nightDiffHours + ' H' : ''}</td>
              <td class="val-col">${fmt(slip.nightDiff)}</td>
              <td style="border-left: 2px solid #000;">&nbsp;</td>
              <td class="qty-col"></td>
              <td class="val-col"></td>
            </tr>
            <tr class="total-row">
              <td colspan="2"><b>Gross Earnings</b></td>
              <td class="val-col"><b>${fmt(slip.grossEarnings)}</b></td>
              <td colspan="2" style="border-left: 2px solid #000;"><b>Total Deduction</b></td>
              <td class="val-col"><b>${fmt(slip.totalDeductions)}</b></td>
            </tr>
          </tbody>
        </table>

        <!-- FOOTER: CASH ADVANCE & NET PAY BANNER -->
        <table style="width: 100%; border-collapse: collapse; border-top: 2.5px solid #000;">
          <tr>
            <td style="width: 50%; padding: 4px; background: #fca5a5; color: #000; text-align: center; font-weight: 700; font-style: italic; border-right: 2px solid #000;">
              Summary of Cash Advance
            </td>
            <td class="net-pay-banner" style="width: 50%;">
              NET PAY
            </td>
          </tr>
          <tr>
            <td style="padding: 0; vertical-align: top; border-right: 2px solid #000;">
              <table style="width: 100%; border-collapse: collapse; font-size: 8pt; text-align: center;">
                <tr style="font-weight: 700; background: #fff;">
                  <td style="border-right: 1px solid #000; padding: 3px;">No. of Pay</td>
                  <td style="border-right: 1px solid #000; padding: 3px;">Amount</td>
                  <td style="padding: 3px;">Balance</td>
                </tr>
                <tr>
                  <td style="border-right: 1px solid #000; padding: 4px;">${slip.caNoPay || '&nbsp;'}</td>
                  <td style="border-right: 1px solid #000; padding: 4px;">${slip.caSummaryAmt > 0 ? fmt(slip.caSummaryAmt) : '&nbsp;'}</td>
                  <td style="padding: 4px;">${slip.caBalance > 0 ? fmt(slip.caBalance) : '&nbsp;'}</td>
                </tr>
              </table>
            </td>
            <td style="text-align: right; vertical-align: middle; padding: 4px 10px;">
              <b style="font-size: 15pt; color: #000;">${fmt(slip.netPay)}</b>
            </td>
          </tr>
          <tr>
            <td colspan="2" style="border-top: 1px solid #000; text-align: center; padding: 6px; font-weight: 700; font-size: 9.5pt;">
              ${slip.amountInWords || ''}
            </td>
          </tr>
        </table>
      </div>
    </body>
    </html>
  `);
  printWin.document.close();
  printWin.focus();
  setTimeout(() => { printWin.print(); }, 400);
}

// ========================================================
// PAYROLL DB TABLE & ACTIONS (PREVIEW, PRINT, RELEASE PAYOUT)
// ========================================================
let allPayrollsList = [];

async function loadAdminPayroll() {
  const tbody = document.getElementById('admin-payroll-tbody');
  if (!tbody || !db) return;
  try {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align: center;">Kinukuha ang payroll records...</td></tr>';
    const snap = await db.collection('payrolls').orderBy('createdAt', 'desc').limit(100).get();
    
    allPayrollsList = [];
    if (snap.empty) {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; color: #94a3b8; padding: 1.5rem;">Walang records ng pasweldo. Pindutin ang "+ Generate Payslip".</td></tr>';
      return;
    }

    snap.forEach(d => allPayrollsList.push({ id: d.id, ...d.data() }));

    let html = '';
    allPayrollsList.forEach(p => {
      const period = p.periodText || p.period || 'Cut-off';
      const gross = parseFloat(p.grossEarnings || p.gross || 0).toLocaleString('en-PH', { style: 'currency', currency: 'PHP' });
      const deduct = parseFloat(p.totalDeductions || p.deductions || 0).toLocaleString('en-PH', { style: 'currency', currency: 'PHP' });
      const net = parseFloat(p.netPay || p.net || 0).toLocaleString('en-PH', { style: 'currency', currency: 'PHP' });
      const isPaid = (p.status === 'Released / Paid');

      html += `<tr>
        <td><b>${period}</b><br><small style="color: #64748b;">${p.company || 'KTFGI'}</small></td>
        <td><b>${p.empName}</b><br><small style="color: #059669;">${p.role || ''}</small></td>
        <td>${gross}</td>
        <td style="color: #dc2626;">-${deduct}</td>
        <td><b style="color: #2563eb; font-size: 1.05rem;">${net}</b></td>
        <td>
          <span class="badge ${isPaid ? 'badge-branch' : 'badge-warning'}">${p.status || 'Draft'}</span>
        </td>
        <td>
          <div style="display: flex; gap: 0.35rem; flex-wrap: wrap;">
            <button class="btn btn-sm btn-secondary" onclick="printSavedSalarySlip('${p.id}')">🖨️ Slip / Download</button>
            ${!isPaid ? `<button class="btn btn-sm btn-success" style="font-weight: 700;" onclick="releasePayrollPayout('${p.id}')">💸 Release Payout</button>` : ''}
          </div>
        </td>
      </tr>`;
    });
    tbody.innerHTML = html;
  } catch (e) {
    console.error(e);
  }
}

function printSavedSalarySlip(payrollId) {
  const p = (allPayrollsList || []).find(x => x.id === payrollId);
  if (!p) {
    alert('Hindi nahanap ang payroll slip.');
    return;
  }
  logSystemAction('PAYSLIP_PRINTED', `Nag-print ng official salary slip (${p.periodText}) para kay ${p.empName}`);
  printKenjiTeiSalarySlip(p);
}

// RELEASE PAYOUT: Dito pa lamang magbabawas sa Cash on Hand sa General Ledger!
async function releasePayrollPayout(payrollId) {
  const p = (allPayrollsList || []).find(x => x.id === payrollId);
  if (!p) return;

  const netPay = parseFloat(p.netPay || p.net || 0);
  const conf = await uiConfirm(`⚠️ KUMPIRMASYON NG RELEASE PAYOUT:
I-release ang ₱${netPay.toLocaleString('en-PH', { minimumFractionDigits: 2 })} bilang pasweldo kay ${p.empName}?

DITO PA LAMANG ito opisyal na ibabawas sa Cash on Hand sa General Ledger.`);

  if (!conf) return;

  try {
    const payRef = db.collection('payrolls').doc(payrollId);
    const glRef = db.collection('general_ledger').doc('PAYROLL-' + payrollId); // nakatakdang ID: hindi puwedeng madoble

    await db.runTransaction(async tx => {
      const paySnap = await tx.get(payRef);
      if (!paySnap.exists) throw new Error('Hindi nahanap ang payslip.');
      const pay = paySnap.data();
      if (pay.status === 'Released / Paid') throw new Error('Nai-release na ang sahod na ito dati pa (naka-post na sa General Ledger).');
      const glSnap = await tx.get(glRef);
      const amount = parseFloat(pay.netPay || pay.net || 0);

      tx.update(payRef, {
        status: 'Released / Paid',
        releasedAt: firebase.firestore.FieldValue.serverTimestamp(),
        releasedBy: getCurrentUser()?.name || 'Accounting Head'
      });
      if (!glSnap.exists) {
        // Credit Cash sa General Ledger
        tx.set(glRef, {
          type: 'Payroll Payout (Salary Released)',
          ref: `Payslip [${pay.periodText || p.periodText || 'Cut-off'}]: ${pay.empName || p.empName}`,
          debit: 0,
          credit: amount, // Pera palabas sa kumpanya
          sourcePayroll: payrollId,
          timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });
      }
    });

    await logSystemAction('PAYROLL_PAYOUT_RELEASED', `Pormal na nai-release ang pasweldo ni ${p.empName} (₱${netPay}). Nabawas sa General Ledger.`);
    
    alert(`🎉 Tagumpay! Nai-release na ang sahod ni ${p.empName} at naitala na sa General Ledger ang bawas na ₱${netPay.toFixed(2)}.`);
    loadAdminPayroll();
    if (typeof loadAdminFinance === 'function') loadAdminFinance();
  } catch (err) {
    alert('Error sa release payout: ' + err.message);
    if (typeof loadAdminPayroll === 'function') loadAdminPayroll();
  }
}