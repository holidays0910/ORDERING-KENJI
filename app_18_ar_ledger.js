


// ========================================================
// 📥 IMPORT NG LUMANG AR (galing Google Sheet) + REPORTS PER CUSTOMER / BUWAN
// ========================================================
function arParseDate(s) {
  s = String(s || '').trim(); if (!s) return '';
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(s); if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
  m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s); if (m) return `${m[3]}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}`; // MM/DD/YYYY
  const d = new Date(s); return isNaN(d) ? '' : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function arNum(s) { const n = parseFloat(String(s == null ? '' : s).replace(/[₱,\s]/g, '')); return isNaN(n) ? 0 : n; }
function arDownloadLegacyTemplate() {
  const t = [
    '#GABAY SA PAG-IMPORT NG LUMANG AR (Utang ng customers). Burahin ang lahat ng linyang nagsisimula sa #.',
    '#Customer_Code = ID ng customer sa Customers list (hal. C-0001). Puwedeng iwanang blangko kung Customer_Name na lang ang gagamitin.',
    '#Customer_Name = Pangalan ng customer. Itutugma ito sa Customers list (code muna, tapos pangalan). Kung walang tugma, puwedeng gumawa ng bagong customer.',
    '#Invoice_No = SI / Invoice / OR number ng benta. Kailangan at hindi puwedeng doble.',
    '#Invoice_Date = petsa ng benta (YYYY-MM-DD o MM/DD/YYYY).   Due_Date = (optional) petsa ng due.',
    '#Invoice_Amount = kabuuang halaga ng invoice.   Amount_Paid = kabuuang nabayad na hanggang ngayon (0 kung wala pa).',
    '#Last_Payment_Date / Last_Payment_Mode (Cash, GCash, Maya, Bank Transfer, Check, Inter-company Transfer, Others) / Reference = para sa huling bayad.',
    '#Commissary_Hub = (optional) kung saang commissary ang benta.   Notes = (optional).',
    '#Halimbawa:,C-0001,Juan Store,SI-1001,2026-10-05,2026-10-20,5000,2000,2026-10-12,GCash,GC12345,,Hulugan',
    'Customer_Code,Customer_Name,Invoice_No,Invoice_Date,Due_Date,Invoice_Amount,Amount_Paid,Last_Payment_Date,Last_Payment_Mode,Reference,Commissary_Hub,Notes'
  ];
  downloadCSVFile(t.join('\r\n') + '\r\n', 'AR_Opening_Import_Template.csv');
}
let arImpPlan = null;
async function arImportLegacy() {
  const text0 = await pickCSVFile(); if (!text0) return;
  const text = text0.split(/\r?\n/).filter(l => !/^\s*"?#/.test(l)).join('\n');
  const objs = csvToObjects(text); if (!objs.length) { alert('Walang row. Gamitin ang Template.'); return; }
  const cSnap = await db.collection('customers').get(); const custs = []; cSnap.forEach(d => custs.push({ id: d.id, ...d.data() }));
  const byCode = {}, byName = {}; custs.forEach(c => { if (c.code) byCode[String(c.code).toLowerCase()] = c; byName[hubKey(c.name)] = c; });
  const existing = new Set((arState.orders || []).filter(o => o._legacy).map(o => o.id));
  const u = getCurrentUser() || {}; const myHub = normalizeRole(u.role) === 'admin' ? '' : myHubName();
  const plan = { rows: [], errors: [], unmatched: {}, dup: 0, custs };
  const seen = new Set();
  objs.forEach((r, i) => {
    const line = i + 1, inv = (r.invoice_no || '').trim(), name = (r.customer_name || '').trim(), code = (r.customer_code || r.customer_id || '').trim();
    if (!inv && !name && !arNum(r.invoice_amount)) return;
    const total = arNum(r.invoice_amount), paid = arNum(r.amount_paid), date = arParseDate(r.invoice_date);
    if (!inv) { plan.errors.push(`Row ${line}: walang Invoice_No`); return; }
    if (!(total > 0)) { plan.errors.push(`Row ${line} (${inv}): mali ang Invoice_Amount`); return; }
    if (paid < 0 || paid > total + 0.005) { plan.errors.push(`Row ${line} (${inv}): ang Amount_Paid ay mali o mas malaki sa invoice`); return; }
    if (!date) { plan.errors.push(`Row ${line} (${inv}): mali o walang Invoice_Date`); return; }
    let cust = (code && byCode[code.toLowerCase()]) || (name && byName[hubKey(name)]) || null;
    if (!cust && !name) { plan.errors.push(`Row ${line} (${inv}): walang Customer_Code o Customer_Name`); return; }
    const custName = cust ? cust.name : name;
    const id = 'LEG-' + invSlug(inv + '-' + (cust ? cust.id : custName)).slice(0, 80);
    if (existing.has(id) || seen.has(id)) { plan.dup++; return; }
    seen.add(id);
    if (!cust) plan.unmatched[hubKey(name)] = name;
    plan.rows.push({ id, inv, cust, custName, date, due: arParseDate(r.due_date), total, paid, lastDate: arParseDate(r.last_payment_date) || date, mode: (r.last_payment_mode || 'Others').trim() || 'Others', ref: (r.reference || '').trim(), hub: (r.commissary_hub || myHub || '').trim(), notes: (r.notes || '').trim() });
  });
  arImpPlan = plan;
  const un = Object.values(plan.unmatched);
  const sum = plan.rows.reduce((a, r) => ({ t: a.t + r.total, p: a.p + r.paid }), { t: 0, p: 0 });
  arModal(`<h3>📥 Preview — Import ng Lumang AR</h3>
    <p>✅ Handa: <b>${plan.rows.length}</b> invoice · Total ${money(sum.t)} · Nabayad na ${money(sum.p)} · <b style="color:#b91c1c;">Utang ${money(sum.t - sum.p)}</b><br>
    ⏭️ Nilaktawan (doble): ${plan.dup} · ❌ May mali: ${plan.errors.length}</p>
    ${un.length ? `<div style="background:#fffbeb;border:1px solid #fcd34d;padding:.6rem;border-radius:.4rem;margin:.5rem 0;"><b>⚠️ ${un.length} customer ang walang tugma sa Customers list:</b><br><small>${un.map(srchEsc).join(', ')}</small><br><label style="margin-top:.4rem;display:block;"><input type="checkbox" id="ar-imp-newcust" checked> Gumawa ng bagong customer (may awtomatikong code) para sa mga ito</label><small>Kung hindi lagyan ng tsek, hindi isasama ang mga invoice nila.</small></div>` : ''}
    ${plan.errors.length ? `<div style="background:#fef2f2;border:1px solid #fca5a5;padding:.6rem;border-radius:.4rem;max-height:140px;overflow:auto;"><b>Hindi isasama:</b><br><small>${plan.errors.slice(0, 40).map(srchEsc).join('<br>')}</small></div>` : ''}
    <div style="margin-top:.8rem;"><button class="btn btn-success" onclick="arImportConfirm()" ${plan.rows.length ? '' : 'disabled'}>✅ Ituloy ang Import</button></div>`);
}
async function arImportConfirm() {
  const plan = arImpPlan; if (!plan) return; const u = getCurrentUser() || {}; const by = u.name || u.email || '';
  const mk = (document.getElementById('ar-imp-newcust') || {}).checked;
  try {
    const ts = firebase.firestore.FieldValue.serverTimestamp(); let batch = db.batch(), n = 0, imported = 0, skipped = 0, newC = 0;
    const flush = async () => { await batch.commit(); batch = db.batch(); };
    const newMap = {}; const names = Object.values(plan.unmatched);
    if (names.length && mk) {
      const codes = nextCustomerCodes(plan.custs, names.length);
      for (let i = 0; i < names.length; i++) { const ref = db.collection('customers').doc(); newMap[hubKey(names[i])] = { id: ref.id, name: names[i], code: codes[i] }; batch.set(ref, { name: names[i], code: codes[i], address: '', contact: '', bank: '', type: 'Retail', createdAt: ts, updatedAt: ts, source: 'ar-import' }); newC++; if (++n % 400 === 0) await flush(); }
    }
    for (const r of plan.rows) {
      const cust = r.cust || newMap[hubKey(r.custName)];
      if (!cust) { skipped++; continue; }
      const payments = r.paid > 0 ? [{ id: 'OPEN-' + r.id, date: r.lastDate, amount: r.paid, mode: r.mode, ref: r.ref, notes: 'Opening balance import (kabuuang nabayad na)', by, at: new Date().toISOString(), photoId: '' }] : [];
      batch.set(db.collection('ar_legacy').doc(r.id), { invoiceNo: r.inv, customerId: cust.id, customerCode: cust.code || '', customerName: cust.name, date: r.date, dueDate: r.due, total: r.total, hub: r.hub, notes: r.notes, source: 'import', importedBy: by, importedAt: ts });
      batch.set(db.collection('ar_accounts').doc(r.id), { orderId: r.id, siNumber: r.inv, customer: cust.name, total: r.total, paid: r.paid, status: arStatusOf(r.total, r.paid), payments, updatedAt: ts });
      imported++; n += 2; if (n >= 400) { await flush(); n = 0; }
    }
    await batch.commit();
    try { await logSystemAction('AR_LEGACY_IMPORT', `${imported} invoice, ${newC} bagong customer`); } catch (e) {}
    arCloseModal(); alert(`✅ Na-import ang ${imported} invoice${newC ? ` at ${newC} bagong customer` : ''}${skipped ? ` (${skipped} nilaktawan: walang customer)` : ''}.`);
    arImpPlan = null; await loadArLedger();
  } catch (e) { alert('Error sa import: ' + e.message); }
}

// ---- helpers ng reports ----
function arAllRows() { return arState.orders.filter(arCoOk).map(o => { const a = arState.accts[o.id], total = arOrderTotal(o), paid = arPaid(a); return { o, a, total, paid, bal: Math.max(0, total - paid), st: arStatusOf(total, paid) }; }); }
function arCustKey(o) { return o.customerId ? 'id:' + o.customerId : 'n:' + hubKey(arCustomer(o)); }
function arCustCode(o) { const c = (arState.customers || []).find(x => (o.customerId && x.id === o.customerId) || hubKey(x.name) === hubKey(arCustomer(o))); return c ? (c.code || '') : ''; }
function arLastPay(rows) { let best = null; rows.forEach(r => ((r.a && r.a.payments) || []).forEach(p => { if (!p.voided && (!best || p.date > best.date)) best = p; })); return best; }
function arCustomerSummary() {
  const g = {}; arAllRows().forEach(r => { const k = arCustKey(r.o); (g[k] = g[k] || { name: arCustomer(r.o), code: arCustCode(r.o), rows: [] }).rows.push(r); });
  return Object.values(g).map(c => {
    const billed = c.rows.reduce((s, r) => s + r.total, 0), paid = c.rows.reduce((s, r) => s + r.paid, 0), bal = c.rows.reduce((s, r) => s + r.bal, 0);
    const lp = arLastPay(c.rows); const ag = [0, 0, 0, 0];
    c.rows.forEach(r => { if (r.bal > 0) { const d = arAge(r.o); ag[d <= 30 ? 0 : d <= 60 ? 1 : d <= 90 ? 2 : 3] += r.bal; } });
    return { name: c.name, code: c.code, billed, paid, bal, lastDate: lp ? lp.date : '', lastAmt: lp ? lp.amount : 0, lastMode: lp ? lp.mode : '', ag, n: c.rows.length };
  }).sort((a, b) => b.bal - a.bal);
}
function arRenderCustomers() {
  const root = arRoot(); if (!root) return; const only = arState.onlyBal !== false;
  let list = arCustomerSummary(); if (only) list = list.filter(c => c.bal > 0.005);
  const q = arState.q || ''; if (q) list = list.filter(c => smartMatch(q, c.name + ' ' + c.code));
  const T = list.reduce((a, c) => ({ b: a.b + c.billed, p: a.p + c.paid, l: a.l + c.bal, g: a.g.map((x, i) => x + c.ag[i]) }), { b: 0, p: 0, l: 0, g: [0, 0, 0, 0] });
  const rows = list.map(c => `<tr><td><b>${srchEsc(c.name)}</b><br><small style="font-family:monospace;color:#64748b;">${srchEsc(c.code)}</small></td><td class="num">${money(c.billed)}</td><td class="num">${money(c.paid)}</td><td class="num"><b style="color:#b91c1c;">${money(c.bal)}</b></td><td>${c.lastDate ? `${srchEsc(c.lastDate)}<br><small>${money(c.lastAmt)} · ${srchEsc(c.lastMode)}</small>` : '<small style="color:#94a3b8;">wala pa</small>'}</td>${c.ag.map(x => `<td class="num">${x ? money(x) : '—'}</td>`).join('')}<td><button class="btn btn-sm btn-secondary" onclick="arState.customer='${srchEsc(c.name).replace(/'/g, '&#39;')}';arState.view='ledger';arState.tab='all';arRender()">🔍</button></td></tr>`).join('') || '<tr><td colspan="10" style="text-align:center;color:#94a3b8;">Walang customer na may utang.</td></tr>';
  root.innerHTML = `<div class="card"><div class="card-title"><span>📒 AR — Balance Per Customer</span><button class="btn btn-secondary btn-sm" onclick="loadArLedger()">🔄 Refresh</button></div>${arViewTabs()}
    <div style="display:flex;gap:.4rem;flex-wrap:wrap;align-items:center;margin-bottom:.6rem;"><label><input type="checkbox" ${only ? 'checked' : ''} onchange="arState.onlyBal=this.checked;arRender()"> May utang lang</label>
      <input type="text" id="ar-search" value="${srchEsc(q)}" placeholder="🔎 Customer / code" oninput="arState.q=this.value;arRenderCustomers();var e=document.getElementById('ar-search');e.focus();e.setSelectionRange(e.value.length,e.value.length)">
      <button class="btn btn-secondary btn-sm" onclick="arPrintCustomers()">🖨️ Print</button><button class="btn btn-secondary btn-sm" onclick="arExportCustomersCSV()">📤 CSV</button></div>
    <div class="table-responsive"><table data-notools="1"><thead><tr><th>Customer</th><th class="num">Total Benta</th><th class="num">Nabayad</th><th class="num">Balance</th><th>Huling Bayad</th><th class="num">0–30</th><th class="num">31–60</th><th class="num">61–90</th><th class="num">90+</th><th></th></tr></thead>
    <tbody>${rows}<tr class="total"><td><b>KABUUAN</b></td><td class="num">${money(T.b)}</td><td class="num">${money(T.p)}</td><td class="num"><b>${money(T.l)}</b></td><td></td>${T.g.map(x => `<td class="num">${money(x)}</td>`).join('')}<td></td></tr></tbody></table></div></div>`;
}
function arCustomersTableHtml() {
  const list = arCustomerSummary().filter(c => c.bal > 0.005);
  return `<table><thead><tr><th>Customer</th><th class="num">Benta</th><th class="num">Nabayad</th><th class="num">Balance</th><th>Huling Bayad</th><th class="num">0–30</th><th class="num">31–60</th><th class="num">61–90</th><th class="num">90+</th></tr></thead><tbody>${list.map(c => `<tr><td>${srchEsc(c.name)} ${srchEsc(c.code)}</td><td class="num">${money(c.billed)}</td><td class="num">${money(c.paid)}</td><td class="num">${money(c.bal)}</td><td>${srchEsc(c.lastDate)} ${c.lastDate ? money(c.lastAmt) : ''}</td>${c.ag.map(x => `<td class="num">${money(x)}</td>`).join('')}</tr>`).join('')}<tr class="total"><td>KABUUAN</td><td class="num">${money(list.reduce((s, c) => s + c.billed, 0))}</td><td class="num">${money(list.reduce((s, c) => s + c.paid, 0))}</td><td class="num">${money(list.reduce((s, c) => s + c.bal, 0))}</td><td></td><td></td><td></td><td></td><td></td></tr></tbody></table>`;
}
function arPrintCustomers() { printHtmlDoc('AR per Customer', `<h1>AR — Balance per Customer</h1><div class="meta">As of ${new Date().toLocaleDateString('en-PH')} · ${printedByLine()}</div>${arCustomersTableHtml()}`); }
function arExportCustomersCSV() {
  const L = [['Customer_Code', 'Customer_Name', 'Total_Billed', 'Total_Paid', 'Balance', 'Last_Payment_Date', 'Last_Payment_Amount', 'Last_Payment_Mode', 'Aging_0_30', 'Aging_31_60', 'Aging_61_90', 'Aging_90_plus'].join(',')];
  arCustomerSummary().forEach(c => L.push([csvCell(c.code), csvCell(c.name), c.billed.toFixed(2), c.paid.toFixed(2), c.bal.toFixed(2), c.lastDate, c.lastAmt ? c.lastAmt.toFixed(2) : '', csvCell(c.lastMode), ...c.ag.map(x => x.toFixed(2))].join(',')));
  downloadCSVFile(L.join('\r\n'), 'AR_Per_Customer.csv');
}
// ---- Buwanang report ----
function arMonthData(ym) {
  const rows = arAllRows(); const inv = rows.filter(r => arDate(r.o).slice(0, 7) === ym);
  const pays = []; rows.forEach(r => ((r.a && r.a.payments) || []).forEach(p => { if (!p.voided && String(p.date).slice(0, 7) === ym) pays.push({ r, p }); }));
  const byMode = {}; pays.forEach(x => { byMode[x.p.mode] = (byMode[x.p.mode] || 0) + (+x.p.amount || 0); });
  const cust = {}; inv.forEach(r => { if (r.bal > 0.005) { const k = arCustKey(r.o); (cust[k] = cust[k] || { name: arCustomer(r.o), n: 0, billed: 0, paid: 0, bal: 0 }); cust[k].n++; cust[k].billed += r.total; cust[k].paid += r.paid; cust[k].bal += r.bal; } });
  return { billed: inv.reduce((s, r) => s + r.total, 0), paidToDate: inv.reduce((s, r) => s + r.paid, 0), outstanding: inv.reduce((s, r) => s + r.bal, 0), nInv: inv.length, collected: pays.reduce((s, x) => s + (+x.p.amount || 0), 0), nPay: pays.length, byMode, cust: Object.values(cust).sort((a, b) => b.bal - a.bal), inv, pays };
}
function arMonthsList() { const set = new Set(); arAllRows().forEach(r => { const m = arDate(r.o).slice(0, 7); if (m) set.add(m); ((r.a && r.a.payments) || []).forEach(p => { if (p.date) set.add(String(p.date).slice(0, 7)); }); }); return [...set].sort().reverse(); }
function arRenderMonthly() {
  const root = arRoot(); if (!root) return; if (!arState.month) arState.month = new Date().toISOString().slice(0, 7);
  const d = arMonthData(arState.month);
  const trend = arMonthsList().slice(0, 12).map(m => { const x = arMonthData(m); return `<tr><td><a href="javascript:void(0)" onclick="arState.month='${m}';arRender()">${m}</a></td><td class="num">${money(x.billed)}</td><td class="num">${money(x.collected)}</td><td class="num"><b style="color:#b91c1c;">${money(x.outstanding)}</b></td></tr>`; }).join('');
  root.innerHTML = `<div class="card"><div class="card-title"><span>🗓️ AR — Buwanang Report</span><button class="btn btn-secondary btn-sm" onclick="loadArLedger()">🔄 Refresh</button></div>${arViewTabs()}
    <div style="display:flex;gap:.5rem;flex-wrap:wrap;align-items:end;margin-bottom:.7rem;"><div><label style="font-weight:700;">Buwan</label><br><input type="month" value="${arState.month}" onchange="arState.month=this.value;arRender()"></div>
      <button class="btn btn-secondary btn-sm" onclick="arPrintMonthly()">🖨️ Print</button><button class="btn btn-secondary btn-sm" onclick="arExportMonthlyCSV()">📤 CSV</button></div>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:.5rem;margin-bottom:.8rem;">
      <div style="background:#eff6ff;padding:.6rem;border-radius:.4rem;"><small>Benta ngayong buwan (${d.nInv} invoice)</small><br><b>${money(d.billed)}</b></div>
      <div style="background:#ecfdf5;padding:.6rem;border-radius:.4rem;"><small>Nakolektang bayad ngayong buwan (${d.nPay})</small><br><b>${money(d.collected)}</b></div>
      <div style="background:#fef2f2;padding:.6rem;border-radius:.4rem;"><small>Utang pa mula sa benta ng buwan</small><br><b style="color:#b91c1c;">${money(d.outstanding)}</b></div></div>
    <b>Bayad ngayong buwan ayon sa mode:</b> ${Object.keys(d.byMode).map(m => `${srchEsc(m)}: <b>${money(d.byMode[m])}</b>`).join(' · ') || '—'}
    <h4 style="margin:.9rem 0 .3rem;">Mga may utang mula sa benta ng ${arState.month}</h4>
    <div class="table-responsive"><table data-notools="1"><thead><tr><th>Customer</th><th>Invoices</th><th class="num">Benta</th><th class="num">Nabayad</th><th class="num">Balance</th></tr></thead><tbody>${d.cust.map(c => `<tr><td>${srchEsc(c.name)}</td><td>${c.n}</td><td class="num">${money(c.billed)}</td><td class="num">${money(c.paid)}</td><td class="num"><b style="color:#b91c1c;">${money(c.bal)}</b></td></tr>`).join('') || '<tr><td colspan="5" style="text-align:center;color:#059669;">Walang utang mula sa buwang ito 🎉</td></tr>'}</tbody></table></div>
    <h4 style="margin:.9rem 0 .3rem;">Nakaraang buwan</h4>
    <div class="table-responsive"><table data-notools="1"><thead><tr><th>Buwan</th><th class="num">Benta</th><th class="num">Nakolekta</th><th class="num">Utang pa (ng benta ng buwan)</th></tr></thead><tbody>${trend}</tbody></table></div></div>`;
}
function arMonthlyHtml() {
  const d = arMonthData(arState.month);
  return `<h1>AR — Buwanang Report (${arState.month})</h1><div class="meta">${printedByLine()}</div><table><tbody><tr><td>Benta ng buwan (${d.nInv} invoice)</td><td class="num">${money(d.billed)}</td></tr><tr><td>Nakolektang bayad ngayong buwan (${d.nPay})</td><td class="num">${money(d.collected)}</td></tr><tr class="total"><td>Utang pa mula sa benta ng buwan</td><td class="num">${money(d.outstanding)}</td></tr></tbody></table>
  <h2>Bayad ayon sa mode</h2><table><tbody>${Object.keys(d.byMode).map(m => `<tr><td>${srchEsc(m)}</td><td class="num">${money(d.byMode[m])}</td></tr>`).join('') || '<tr><td>—</td><td></td></tr>'}</tbody></table>
  <h2>Mga may utang</h2><table><thead><tr><th>Customer</th><th>Invoices</th><th class="num">Benta</th><th class="num">Nabayad</th><th class="num">Balance</th></tr></thead><tbody>${d.cust.map(c => `<tr><td>${srchEsc(c.name)}</td><td>${c.n}</td><td class="num">${money(c.billed)}</td><td class="num">${money(c.paid)}</td><td class="num">${money(c.bal)}</td></tr>`).join('')}</tbody></table>`;
}
function arPrintMonthly() { printHtmlDoc('AR Monthly ' + arState.month, arMonthlyHtml()); }
function arExportMonthlyCSV() {
  const d = arMonthData(arState.month); const L = [['Type', 'Date', 'Invoice_No', 'Customer', 'Amount', 'Paid_To_Date', 'Balance', 'Mode', 'Reference'].join(',')];
  d.inv.forEach(r => L.push(['INVOICE', arDate(r.o), csvCell(r.o.siNumber || ''), csvCell(arCustomer(r.o)), r.total.toFixed(2), r.paid.toFixed(2), r.bal.toFixed(2), '', ''].join(',')));
  d.pays.forEach(x => L.push(['PAYMENT', x.p.date, csvCell(x.r.o.siNumber || ''), csvCell(arCustomer(x.r.o)), (+x.p.amount || 0).toFixed(2), '', '', csvCell(x.p.mode), csvCell(x.p.ref || '')].join(',')));
  downloadCSVFile(L.join('\r\n'), 'AR_Monthly_' + arState.month + '.csv');
}

// ---- Customers export ----
async function exportCustomersCSV() {
  const snap = await db.collection('customers').orderBy('name').get(); const list = []; snap.forEach(d => list.push({ id: d.id, ...d.data() }));
  const L = [['Customer_Code', 'Customer_Name', 'Address', 'Contact', 'Bank_Details', 'Customer_Type'].join(',')];
  list.forEach(c => L.push([csvCell(c.code || ''), csvCell(c.name), csvCell(c.address), csvCell(c.contact), csvCell(c.bank), csvCell(c.type || 'Retail')].join(',')));
  downloadCSVFile(L.join('\r\n'), 'Customers.csv');
}

// ========================================================
// 📦 INVENTORY TOTALS (Beginning vs Ending, per branch) — para sa accounting
// Beginning = huling count sa o bago ang Petsa A; Ending = huling count sa o bago ang Petsa B.
// Halaga = qty × presyo ng item sa branch (presyong paninda/price list ng company nila). Puhunan ng commissary ay hindi ginagamit.
// ========================================================
let itState = { rows: null };
async function loadInvTotals() {
  const root = document.getElementById('invtotals-root'); if (!root || !db) return;
  root.innerHTML = '<div class="card">Kinukuha...</div>';
  const bSnap = await db.collection('inventory_branches').get(); const brs = []; bSnap.forEach(d => brs.push(d.data()));
  brs.sort((a, b) => String(a.branch).localeCompare(String(b.branch))); itState.branches = brs;
  const iso = d => { const x = new Date(d); x.setMinutes(x.getMinutes() - x.getTimezoneOffset()); return x.toISOString().slice(0, 10); };
  root.innerHTML = `<div class="card"><div class="card-title"><span>📦 Inventory Totals — Beginning at Ending</span></div>
    <p style="font-size:.85rem;color:#64748b;">Total ng halaga ng inventory sa simula at katapusan ng period, para makita ng accounting ang variance nang hindi iisa-isahin ang bawat produkto. Ang "Implied usage" = Beginning + Mga natanggap − Ending.</p>
    <div style="display:flex;gap:.5rem;flex-wrap:wrap;align-items:end;margin-bottom:.7rem;">
      <div><label style="font-weight:700;">Branch</label><br><select id="it-branch">${brs.map(b => `<option>${srchEsc(b.branch)}</option>`).join('')}</select></div>
      <div><label style="font-weight:700;">Beginning (petsa A)</label><br><input type="date" id="it-a" value="${iso(new Date(Date.now() - 30 * 864e5))}"></div>
      <div><label style="font-weight:700;">Ending (petsa B)</label><br><input type="date" id="it-b" value="${iso(new Date())}"></div>
      <button class="btn btn-primary" onclick="invTotalsRun()">📊 I-compute</button>
      <button class="btn btn-secondary btn-sm" onclick="invTotalsPrint()">🖨️ Print</button><button class="btn btn-secondary btn-sm" onclick="invTotalsCSV()">📤 CSV</button></div>
    <div id="it-result"></div></div>`;
}
async function invTotalsRun() {
  const name = document.getElementById('it-branch').value, a = document.getElementById('it-a').value, b = document.getElementById('it-b').value;
  if (!name || !a || !b) { alert('Pumili ng branch at dalawang petsa.'); return; }
  if (a > b) { alert('Dapat mas maaga ang Petsa A kaysa Petsa B.'); return; }
  const br = itState.branches.find(x => x.branch === name); const out = document.getElementById('it-result'); out.innerHTML = 'Kinukuha...';
  try {
    const [cSnap, pSnap, oSnap] = await Promise.all([db.collection('inventory_counts').where('branchCode', '==', br.code).get(), db.collection('products').get(), db.collection('orders').get()]);
    const counts = []; cSnap.forEach(d => counts.push(d.data())); counts.sort((x, y) => String(y.countDate).localeCompare(String(x.countDate)));
    const prods = []; pSnap.forEach(d => prods.push({ id: d.id, ...d.data() })); await applyCompanyPriceList(prods, br.company || '');
    const P = {}; prods.forEach(p => { P[p.id] = p; if (p.sapCode) P[p.sapCode] = p; });
    const priceOf = (code, uom) => { const p = P[code]; if (!p) return null; const w = +p.wholePrice || 0, l = +p.loosePrice || 0; if (uom && uom === p.looseUOM) return l || null; if (uom && uom === p.wholeUOM) return w || null; return l || w || null; };
    const meta = {}; counts.forEach(c => (c.lines || []).forEach(l => { const k = c.station + '||' + l.itemCode; if (!meta[k]) meta[k] = { station: c.station, code: l.itemCode, name: l.itemName, uom: l.uom }; }));
    const items = Object.values(meta).map(m => { const A = invLatestQty(counts, m.code, a, m.station), B = invLatestQty(counts, m.code, b, m.station), pr = priceOf(m.code, m.uom); return { ...m, qa: A ? A.qty : 0, qb: B ? B.qty : 0, hasA: !!A, hasB: !!B, price: pr, va: (A ? A.qty : 0) * (pr || 0), vb: (B ? B.qty : 0) * (pr || 0) }; });
    const st = {}; items.forEach(i => { const s = (st[i.station] = st[i.station] || { station: i.station, va: 0, vb: 0, n: 0, noPrice: 0 }); s.va += i.va; s.vb += i.vb; s.n++; if (!i.price) s.noPrice++; });
    let purchases = 0, nOrd = 0;
    oSnap.forEach(d => { const o = d.data(); if (o.branchName !== name) return; if (!arIncluded(o) || o.status === 'Dispatched / En Route') return; const dt = o.targetDeliveryDate || ''; if (dt > a && dt <= b) { purchases += (o.items || []).reduce((s, i) => s + (+i.subtotal || 0), 0) || (+o.totalAmount || 0); nOrd++; } });
    const beg = items.reduce((s, i) => s + i.va, 0), end = items.reduce((s, i) => s + i.vb, 0);
    itState.rows = { name, a, b, items, stations: Object.values(st), beg, end, purchases, nOrd, noPrice: items.filter(i => !i.price).length, missA: !items.some(i => i.hasA), company: br.company || '' };
    invTotalsRender();
  } catch (e) { out.innerHTML = `<span style="color:#dc2626;">Error: ${srchEsc(e.message)}</span>`; }
}
function invTotalsHtml() {
  const R = itState.rows; const usage = R.beg + R.purchases - R.end;
  return `${R.missA ? `<div style="background:#fffbeb;border:1px solid #fcd34d;padding:.5rem;border-radius:.4rem;margin-bottom:.5rem;">⚠️ Walang count sa o bago ang ${srchEsc(R.a)}, kaya ₱0 ang Beginning. Pumili ng petsang may count.</div>` : ''}
  ${R.noPrice ? `<div style="background:#fffbeb;border:1px solid #fcd34d;padding:.5rem;border-radius:.4rem;margin-bottom:.5rem;">⚠️ ${R.noPrice} item ang walang presyo sa Product Master (hindi nabilang sa halaga).</div>` : ''}
  <table><tbody><tr><td><b>Beginning Inventory</b> (${srchEsc(R.a)})</td><td class="num"><b>${money(R.beg)}</b></td></tr>
  <tr><td>+ Mga natanggap na delivery (${R.nOrd} order, ${srchEsc(R.a)} hanggang ${srchEsc(R.b)})</td><td class="num">${money(R.purchases)}</td></tr>
  <tr><td><b>Ending Inventory</b> (${srchEsc(R.b)})</td><td class="num"><b>${money(R.end)}</b></td></tr>
  <tr class="total"><td>Implied usage / konsumo = Beginning + Natanggap − Ending</td><td class="num">${money(usage)}</td></tr>
  <tr><td>Pagbabago ng stock (Ending − Beginning)</td><td class="num">${money(R.end - R.beg)}</td></tr></tbody></table>
  <h4 style="margin:.8rem 0 .3rem;">Per Station</h4>
  <table><thead><tr><th>Station</th><th>Items</th><th class="num">Beginning</th><th class="num">Ending</th><th class="num">Pagbabago</th></tr></thead><tbody>${R.stations.map(s => `<tr><td>${srchEsc(s.station)}</td><td>${s.n}</td><td class="num">${money(s.va)}</td><td class="num">${money(s.vb)}</td><td class="num">${money(s.vb - s.va)}</td></tr>`).join('')}<tr class="total"><td>KABUUAN</td><td></td><td class="num">${money(R.beg)}</td><td class="num">${money(R.end)}</td><td class="num">${money(R.end - R.beg)}</td></tr></tbody></table>`;
}
function invTotalsRender() { const o = document.getElementById('it-result'); if (o && itState.rows) o.innerHTML = invTotalsHtml(); }
function invTotalsPrint() { if (!itState.rows) { alert('I-compute muna.'); return; } const R = itState.rows; printHtmlDoc('Inventory Totals', `<h1>Inventory Totals — ${srchEsc(R.name)}</h1><div class="meta">${srchEsc(R.company)} · ${printedByLine()}</div>${invTotalsHtml()}<div class="sign"><div>Binilang / Inihanda ni</div><div>Sinuri ni (Accounting)</div></div>`); }
function invTotalsCSV() {
  if (!itState.rows) { alert('I-compute muna.'); return; } const R = itState.rows;
  const L = [['Branch', 'Station', 'Item_Code', 'Item', 'UOM', 'Price', 'Beginning_Qty', 'Beginning_Value', 'Ending_Qty', 'Ending_Value', 'Difference_Value'].join(',')];
  R.items.forEach(i => L.push([csvCell(R.name), csvCell(i.station), csvCell(i.code), csvCell(i.name), csvCell(i.uom), i.price == null ? '' : i.price, i.qa, i.va.toFixed(2), i.qb, i.vb.toFixed(2), (i.vb - i.va).toFixed(2)].join(',')));
  L.push(['TOTAL', '', '', '', '', '', '', R.beg.toFixed(2), '', R.end.toFixed(2), (R.end - R.beg).toFixed(2)].join(','));
  downloadCSVFile(L.join('\r\n'), 'Inventory_Totals_' + invSlug(R.name) + '.csv');
}


// ========================================================
// 💰 INVENTORY VALUE CARD (Plant/Commissary) — qty, puhunan value, SRP value, alerts at SAP check
// inventory_snapshots/{hub}__{date}: { hub,date,items,costValue,srpValue,sapValue,sapBy }
// ========================================================
let ivState = { hub: null, data: null };
async function invValueData(hub) {
  const [pSnap] = await Promise.all([db.collection('products').get(), loadProductCosts()]);
  const rows = []; const alerts = [];
  pSnap.forEach(d => {
    const p = { id: d.id, ...d.data() }; if (hub && !productVisibleToHub(p, hub)) return;
    const sw = parseFloat(p.stockWhole) || 0, sl = parseFloat(p.stockLoose) || 0, c = productCosts[p.id] || {};
    const cw = parseFloat(c.costWhole) || 0, cl = parseFloat(c.costLoose) || 0, pw = parseFloat(p.wholePrice) || 0, pl = parseFloat(p.loosePrice) || 0;
    const conv = parseFloat(p.conversionFactor) || 1, name = p.itemName || p.id;
    const r = { id: p.id, name, station: p.storageStation || 'Unassigned', sw, sl, cost: sw * cw + sl * cl, srp: sw * pw + sl * pl };
    rows.push(r);
    if (sw < 0 || sl < 0) alerts.push({ lvl: 'high', text: `Negatibo ang stock: ${name} (${sw} whole / ${sl} loose)` });
    if ((sw > 0 || sl > 0) && !(cw > 0 || cl > 0)) alerts.push({ lvl: 'mid', text: `May stock pero walang puhunan: ${name} — hindi nabibilang sa value` });
    if ((sw > 0 || sl > 0) && !(pw > 0 || pl > 0)) alerts.push({ lvl: 'mid', text: `May stock pero walang presyong paninda: ${name}` });
    if (conv > 1 && sl >= conv) alerts.push({ lvl: 'low', text: `Malaki ang loose (${sl}) kaysa isang whole (${conv}): ${name} — baka mali ang bilang o hindi na-repack` });
  });
  const st = {}; rows.forEach(r => { const x = (st[r.station] = st[r.station] || { station: r.station, n: 0, sw: 0, sl: 0, cost: 0, srp: 0 }); x.n++; x.sw += r.sw; x.sl += r.sl; x.cost += r.cost; x.srp += r.srp; });
  const tot = rows.reduce((a, r) => ({ cost: a.cost + r.cost, srp: a.srp + r.srp, sw: a.sw + r.sw, sl: a.sl + r.sl, n: a.n + (r.sw || r.sl ? 1 : 0) }), { cost: 0, srp: 0, sw: 0, sl: 0, n: 0 });
  return { rows, alerts, stations: Object.values(st).sort((a, b) => b.cost - a.cost), tot };
}
function ivSnapId(hub, date) { return (invSlug(hub || 'all') || 'all') + '__' + date; }
async function renderInvValueCard(containerId) {
  const box = document.getElementById(containerId); if (!box || typeof db === 'undefined' || !db) return;
  const u = getCurrentUser() || {}; const admin = normalizeRole(u.role) === 'admin';
  if (ivState.hub === null) ivState.hub = admin ? '' : myHubName();
  const hub = ivState.hub; box.innerHTML = '<div class="card">Kinukuha ang inventory value...</div>';
  try {
    const d = await invValueData(hub); ivState.data = d;
    const today = new Date().toISOString().slice(0, 10);
    const snapSnap = await db.collection('inventory_snapshots').get(); const snaps = [];
    snapSnap.forEach(x => { const v = x.data(); if ((v.hub || '') === (hub || '')) snaps.push(v); });
    snaps.sort((a, b) => String(b.date).localeCompare(String(a.date)));
    let todaySnap = snaps.find(x => x.date === today);
    if (!todaySnap) { // awtomatikong snapshot isang beses bawat araw
      todaySnap = { hub: hub || '', date: today, items: d.tot.n, costValue: d.tot.cost, srpValue: d.tot.srp, createdAt: firebase.firestore.FieldValue.serverTimestamp() };
      try { await db.collection('inventory_snapshots').doc(ivSnapId(hub, today)).set(todaySnap); snaps.unshift(todaySnap); } catch (e) { console.warn('snapshot', e); }
    }
    const prev = snaps.find(x => x.date < today);
    if (prev && prev.costValue > 0) { const ch = (d.tot.cost - prev.costValue) / prev.costValue; if (ch <= -0.1) d.alerts.unshift({ lvl: 'high', text: `Bumaba ng ${(Math.abs(ch) * 100).toFixed(0)}% ang inventory value mula ${prev.date} (${money(prev.costValue)} → ${money(d.tot.cost)}). Tingnan kung may nawawala.` }); }
    const sapV = todaySnap && todaySnap.sapValue != null ? +todaySnap.sapValue : null;
    let sapHtml = '';
    if (sapV != null) { const diff = d.tot.cost - sapV, pct = sapV ? Math.abs(diff) / sapV * 100 : 0, bad = pct > 1; sapHtml = `<div style="padding:.5rem;border-radius:.4rem;background:${bad ? '#fef2f2' : '#ecfdf5'};border:1px solid ${bad ? '#fca5a5' : '#86efac'};margin-top:.4rem;">${bad ? '🚨' : '✅'} SAP: <b>${money(sapV)}</b> · Website: <b>${money(d.tot.cost)}</b> · Pagkakaiba: <b style="color:${bad ? '#b91c1c' : '#059669'};">${money(diff)} (${pct.toFixed(1)}%)</b> ${bad ? '— mag-imbestiga bago ang audit!' : ''}</div>`; if (bad) d.alerts.unshift({ lvl: 'high', text: `Hindi tugma sa SAP: ${money(Math.abs(diff))} ang pagkakaiba (${pct.toFixed(1)}%)` }); }
    const hubs = admin ? [...new Set([...(await db.collection('products').get().then(s => { const a = []; s.forEach(x => a.push(x.data().commissarySource || '')); return a; }))].filter(Boolean))] : [];
    const al = d.alerts.slice(0, 12).map(a => `<div style="padding:.3rem .5rem;margin:.2rem 0;border-left:4px solid ${a.lvl === 'high' ? '#dc2626' : a.lvl === 'mid' ? '#f59e0b' : '#94a3b8'};background:#f8fafc;">${srchEsc(a.text)}</div>`).join('') || '<div style="color:#059669;">✅ Walang nakitang problema sa inventory ngayon.</div>';
    const hist = snaps.slice(0, 7).map(x => `<tr><td>${srchEsc(x.date)}</td><td class="num">${money(x.costValue)}</td><td class="num">${money(x.srpValue)}</td><td class="num">${x.sapValue != null ? money(x.sapValue) : '—'}</td><td class="num">${x.sapValue != null ? money(x.costValue - x.sapValue) : '—'}</td></tr>`).join('');
    box.innerHTML = `<div class="card"><div class="card-title"><span>💰 Inventory Value — ${srchEsc(hub || 'Lahat ng Hub')}</span><div style="display:flex;gap:.4rem;align-items:center;">${admin ? `<select onchange="ivState.hub=this.value;renderInvValueCard('${containerId}')"><option value="">(Lahat)</option>${hubs.map(h => `<option ${h === hub ? 'selected' : ''}>${srchEsc(h)}</option>`).join('')}</select>` : ''}<button class="btn btn-secondary btn-sm" onclick="renderInvValueCard('${containerId}')">🔄</button><button class="btn btn-secondary btn-sm" onclick="ivPrint()">🖨️</button></div></div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:.5rem;margin-bottom:.7rem;">
        <div style="background:#eff6ff;padding:.6rem;border-radius:.4rem;"><small>📦 Items na may stock</small><br><b>${d.tot.n}</b><br><small>${d.tot.sw.toLocaleString()} whole · ${d.tot.sl.toLocaleString()} loose</small></div>
        <div style="background:#fef3c7;padding:.6rem;border-radius:.4rem;"><small>💵 Halaga sa PUHUNAN</small><br><b style="font-size:1.2rem;">${money(d.tot.cost)}</b></div>
        <div style="background:#ecfdf5;padding:.6rem;border-radius:.4rem;"><small>🏷️ Halaga sa PRESYONG PANINDA</small><br><b style="font-size:1.2rem;">${money(d.tot.srp)}</b></div>
        <div style="background:#f5f3ff;padding:.6rem;border-radius:.4rem;"><small>📈 Potential na tubo</small><br><b>${money(d.tot.srp - d.tot.cost)}</b></div></div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:.8rem;">
        <div><b>🚨 Alerts</b>${al}</div>
        <div><b>🧮 I-tsek sa SAP</b><div style="display:flex;gap:.4rem;margin-top:.3rem;"><input type="number" id="iv-sap" step="0.01" placeholder="Total inventory value sa SAP (puhunan)" value="${sapV != null ? sapV : ''}" style="flex:1;"><button class="btn btn-primary btn-sm" onclick="ivSaveSap()">I-compare</button></div>${sapHtml}</div></div>
      <div class="table-responsive" style="margin-top:.7rem;"><table data-notools="1"><thead><tr><th>Station</th><th>Items</th><th class="num">Whole</th><th class="num">Loose</th><th class="num">Puhunan</th><th class="num">Paninda</th></tr></thead><tbody>${d.stations.map(x => `<tr><td>${srchEsc(x.station)}</td><td>${x.n}</td><td class="num">${x.sw.toLocaleString()}</td><td class="num">${x.sl.toLocaleString()}</td><td class="num">${money(x.cost)}</td><td class="num">${money(x.srp)}</td></tr>`).join('')}<tr class="total"><td>KABUUAN</td><td>${d.rows.length}</td><td class="num">${d.tot.sw.toLocaleString()}</td><td class="num">${d.tot.sl.toLocaleString()}</td><td class="num">${money(d.tot.cost)}</td><td class="num">${money(d.tot.srp)}</td></tr></tbody></table></div>
      <details style="margin-top:.5rem;"><summary><b>Nakaraang araw</b></summary><div class="table-responsive"><table data-notools="1"><thead><tr><th>Petsa</th><th class="num">Puhunan</th><th class="num">Paninda</th><th class="num">SAP</th><th class="num">Pagkakaiba</th></tr></thead><tbody>${hist}</tbody></table></div></details></div>`;
  } catch (e) { box.innerHTML = `<div class="card" style="color:#dc2626;">Error: ${srchEsc(e.message)}</div>`; }
}
async function ivSaveSap() {
  const v = parseFloat((document.getElementById('iv-sap') || {}).value); if (isNaN(v) || v < 0) { alert('Ilagay ang total inventory value sa SAP.'); return; }
  const u = getCurrentUser() || {}; const today = new Date().toISOString().slice(0, 10); const hub = ivState.hub || '';
  await db.collection('inventory_snapshots').doc(ivSnapId(hub, today)).set({ hub, date: today, sapValue: v, sapBy: u.name || u.email || '', sapAt: new Date().toISOString() }, { merge: true });
  const box = document.querySelector('[id^="iv-card"]'); renderInvValueCard(box ? box.id : 'iv-card-comm');
}
function ivPrint() {
  const d = ivState.data; if (!d) return;
  printHtmlDoc('Inventory Value', `<h1>Inventory Value — ${srchEsc(ivState.hub || 'Lahat ng Hub')}</h1><div class="meta">${new Date().toLocaleDateString('en-PH')} · ${printedByLine()}</div><table><tbody><tr><td>Halaga sa puhunan</td><td class="num">${money(d.tot.cost)}</td></tr><tr><td>Halaga sa presyong paninda</td><td class="num">${money(d.tot.srp)}</td></tr></tbody></table><h2>Per Station</h2><table><thead><tr><th>Station</th><th class="num">Puhunan</th><th class="num">Paninda</th></tr></thead><tbody>${d.stations.map(x => `<tr><td>${srchEsc(x.station)}</td><td class="num">${money(x.cost)}</td><td class="num">${money(x.srp)}</td></tr>`).join('')}</tbody></table><h2>Alerts</h2>${d.alerts.map(a => `<div>• ${srchEsc(a.text)}</div>`).join('') || 'Wala'}`);
}
// ilagay ang card sa Commissary dashboard at Admin Inventory Totals
(function hookIvCards() {
  const orig = window.loadCommissaryAnalytics;
  if (typeof orig === 'function') window.loadCommissaryAnalytics = async function () {
    const dash = document.getElementById('view-commissary-dashboard');
    if (dash && !document.getElementById('iv-card-comm')) { const d = document.createElement('div'); d.id = 'iv-card-comm'; dash.insertBefore(d, dash.firstChild); }
    renderInvValueCard('iv-card-comm');
    return orig.apply(this, arguments);
  };
  const o2 = window.loadInvTotals;
  if (typeof o2 === 'function') window.loadInvTotals = async function () {
    const r = await o2.apply(this, arguments);
    const root = document.getElementById('invtotals-root');
    if (root && !document.getElementById('iv-card-admin')) { const d = document.createElement('div'); d.id = 'iv-card-admin'; root.insertBefore(d, root.firstChild); }
    renderInvValueCard('iv-card-admin'); return r;
  };
})();


// ========================================================
// 🧑‍💼 AGENT ORDERS: stock availability, bayad ni agent (para i-confirm ng accounting), at resibo (print preview)
// payment_submissions/{id}: { orderId, amount, mode, ref, photoId, by, byEmail, status:'pending'|'confirmed'|'rejected', ... }
// Pag nag-confirm ang accounting → pumapasok sa ar_accounts at nag-a-update ang order.paymentStatus (Paid/Partial) na lumalabas sa resibo.
// ========================================================
function ordAvail(p) {
  const tracked = (p.stockWhole !== undefined || p.stockLoose !== undefined) && p.allowBackorder !== true;
  const sw = parseFloat(p.stockWhole) || 0, sl = parseFloat(p.stockLoose) || 0, conv = parseFloat(p.conversionFactor) || 1;
  return { tracked, sw, sl, conv, loose: Math.max(0, sw) * conv + Math.max(0, sl) };
}
function ordStockBadge(p) {
  const a = ordAvail(p); if (!a.tracked) return '<span style="color:#64748b;">♾️ made-to-order</span>';
  if (a.loose <= 0) return '<span class="badge badge-danger" style="font-size:.7rem;">❌ Ubos</span>';
  return `<span style="color:#059669;font-weight:700;">✅ ${a.sw} ${srchEsc(p.wholeUOM || 'whole')} · ${a.sl} ${srchEsc(p.looseUOM || 'loose')}</span>`;
}
function ordCheckStock(p, wq, lq) {
  const a = ordAvail(p); if (!a.tracked) return { ok: true };
  const need = wq * a.conv + lq;
  if (need <= a.loose + 1e-9) return { ok: true };
  return { ok: false, msg: a.loose <= 0 ? 'Ubos na ang stock.' : `Ilan lang ang available: ${a.sw} ${p.wholeUOM || 'whole'} at ${a.sl} ${p.looseUOM || 'loose'}${a.conv > 1 ? ` (1 ${p.wholeUOM || 'whole'} = ${a.conv} ${p.looseUOM || 'loose'})` : ''}.` };
}
async function ordFreshStockCheck(cart) {
  const bad = [];
  for (const it of cart) {
    const d = await db.collection('products').doc(it.itemCode).get(); if (!d.exists) continue;
    const c = ordCheckStock(d.data(), it.wholeQty || 0, it.looseQty || 0);
    if (!c.ok) bad.push(`• ${it.itemName || it.itemCode}: ${c.msg}`);
  }
  return bad;
}
let ordMySubs = {};
async function ordLoadMySubs() {
  ordMySubs = {}; const u = getCurrentUser() || {}; if (!u.email) return;
  try { const s = await db.collection('payment_submissions').where('byEmail', '==', String(u.email).toLowerCase()).get(); s.forEach(d => { const v = { id: d.id, ...d.data() }; (ordMySubs[v.orderId] = ordMySubs[v.orderId] || []).push(v); }); } catch (e) { console.warn('subs', e); }
}
function ordPayBadge(o) {
  const subs = ordMySubs[o.id] || [], pend = subs.some(x => x.status === 'pending'), rej = subs.filter(x => x.status === 'rejected').slice(-1)[0];
  if (o.paymentStatus === 'Paid') return '<span class="badge badge-branch">✅ PAID</span>';
  if (pend) return `<span class="badge badge-warning">⏳ Hinihintay ang confirmation</span>${o.paymentStatus === 'Partial' ? `<br><small>Bayad na ${money(o.amountPaid)}</small>` : ''}`;
  if (o.paymentStatus === 'Partial') return `<span class="badge badge-warning">🟡 Partial · ${money(o.amountPaid)}</span>`;
  return `<span class="badge badge-danger">Unpaid</span>${rej ? `<br><small style="color:#b91c1c;">❌ Na-reject: ${srchEsc(rej.rejectReason || '')}</small>` : ''}`;
}
function ordExtraButtons(o) {
  const bal = Math.max(0, (parseFloat(o.totalAmount) || 0) - (parseFloat(o.amountPaid) || 0)); const pend = (ordMySubs[o.id] || []).some(x => x.status === 'pending');
  return `<button class="btn btn-sm btn-secondary" onclick="ordReceiptPreview('${o.id}')">🧾 Resibo</button>${(!/Cancel/.test(o.status || '') && bal > 0.005 && !pend) ? `<button class="btn btn-sm btn-success" onclick="agentOpenPay('${o.id}')">💵 Bayad</button>` : ''}`;
}
function agentOpenPay(orderId) {
  const o = (window.__ordCache || {})[orderId]; if (!o) return;
  const bal = Math.max(0, (parseFloat(o.totalAmount) || 0) - (parseFloat(o.amountPaid) || 0));
  arModal(`<h3>💵 Mag-submit ng Bayad</h3><p><b>${srchEsc(o.customerName || o.branchName || '')}</b> · ${srchEsc(o.orderId || o.id)}<br>Balance: <b style="color:#b91c1c;">${money(bal)}</b></p>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:.6rem;"><div><label>Halagang binayad (₱)</label><input type="number" id="ag-amt" step="0.01" min="0" value="${bal.toFixed(2)}"></div>
    <div><label>Paraan ng bayad</label><select id="ag-mode">${['GCash', 'Maya', 'Bank Transfer', 'Cash', 'Check', 'Others'].map(m => `<option>${m}</option>`).join('')}</select></div></div>
    <div style="margin-top:.5rem;"><label>Reference No.</label><input type="text" id="ag-ref"></div>
    <div style="margin-top:.5rem;"><label>📷 Screenshot / larawan ng bayad (kailangan)</label><input type="file" id="ag-photo" accept="image/*"></div>
    <p style="font-size:.8rem;color:#64748b;">Pagkatapos ma-submit, titingnan ng accounting ng commissary sa bank statement. Kapag nakumpirma, mamarkahan itong PAID sa resibo.</p>
    <button class="btn btn-success" onclick="agentSubmitPay('${orderId}')">📤 I-submit</button>`);
}
async function agentSubmitPay(orderId) {
  const o = (window.__ordCache || {})[orderId]; if (!o) return;
  const amount = parseFloat((document.getElementById('ag-amt') || {}).value) || 0, file = (document.getElementById('ag-photo') || {}).files && document.getElementById('ag-photo').files[0];
  const bal = Math.max(0, (parseFloat(o.totalAmount) || 0) - (parseFloat(o.amountPaid) || 0));
  if (!(amount > 0)) { alert('Maglagay ng halaga.'); return; } if (amount > bal + 0.005) { alert(`Sobra ang halaga. Balance lang ay ${money(bal)}.`); return; }
  if (!file) { alert('Kailangan ng screenshot o larawan ng bayad.'); return; }
  let dataUrl; try { dataUrl = await compressImageFile(file, 1100, 0.7); } catch (e) { alert(e.message); return; }
  const u = getCurrentUser() || {}; const pid = 'SUB-' + Date.now().toString().slice(-8) + Math.floor(Math.random() * 90 + 10);
  try {
    await db.collection('ar_payment_photos').doc(pid).set({ dataUrl, orderId, createdAt: firebase.firestore.FieldValue.serverTimestamp() });
    await db.collection('payment_submissions').doc(pid).set({ orderId, orderNo: o.orderId || orderId, customer: o.customerName || o.branchName || '', amount, mode: document.getElementById('ag-mode').value, ref: ((document.getElementById('ag-ref') || {}).value || '').trim(), photoId: pid, by: u.name || u.email || '', byEmail: String(u.email || '').toLowerCase(), status: 'pending', at: new Date().toISOString() });
    try { logSystemAction('AGENT_PAYMENT_SUBMITTED', `${o.orderId || orderId} · ${money(amount)}`); } catch (e) {}
    arCloseModal(); alert('✅ Na-submit ang bayad. Hintayin ang confirmation ng accounting.'); loadBranchDeliveries();
  } catch (e) { alert('Error: ' + e.message); }
}
// ---- staff side ----
function arPendingFor(orderId) { return (arState.subs || []).filter(x => x.orderId === orderId && x.status === 'pending'); }
async function arSyncOrder(orderId) {
  const o = arState.orders.find(x => x.id === orderId); if (!o || o._legacy) return;
  try {
    const a = (await db.collection('ar_accounts').doc(orderId).get()).data() || {}; const total = arOrderTotal(o), paid = arPaid(a);
    await db.collection('orders').doc(orderId).update({ paymentStatus: arStatusOf(total, paid), amountPaid: paid, lastPaymentAt: new Date().toISOString() });
  } catch (e) { console.warn('sync order', e); }
}
async function arReviewSub(orderId) {
  const subs = arPendingFor(orderId); if (!subs.length) return; const sub = subs[0]; const o = arState.orders.find(x => x.id === orderId);
  let img = ''; try { const d = await db.collection('ar_payment_photos').doc(sub.photoId).get(); if (d.exists) img = `<img src="${d.data().dataUrl}" style="max-width:100%;max-height:340px;border:1px solid #cbd5e1;border-radius:.4rem;">`; } catch (e) {}
  arModal(`<h3>🔔 I-confirm ang Bayad ni Agent</h3><p><b>${srchEsc(sub.customer)}</b> · ${srchEsc(sub.orderNo)}<br>Agent: ${srchEsc(sub.by)} · ${srchEsc((sub.at || '').slice(0, 16).replace('T', ' '))}<br>Halaga: <b>${money(sub.amount)}</b> · ${srchEsc(sub.mode)} · Ref: ${srchEsc(sub.ref || '—')}<br>Balance ng order: ${o ? money(Math.max(0, arOrderTotal(o) - arPaid(arState.accts[orderId]))) : ''}</p>${img}
    <p style="font-size:.85rem;color:#64748b;">Tingnan muna sa bank statement / transaction bago i-confirm.</p>
    <div style="display:flex;gap:.5rem;"><button class="btn btn-success" onclick="arConfirmSub('${sub.id}')">✅ Nakita sa bank — I-confirm</button><button class="btn btn-danger" onclick="arRejectSub('${sub.id}')">❌ I-reject</button></div>`);
}
async function arConfirmSub(subId) {
  const sub = (arState.subs || []).find(x => x.id === subId); if (!sub) return; const o = arState.orders.find(x => x.id === sub.orderId); if (!o) return;
  const u = getCurrentUser() || {}; const by = u.name || u.email || ''; const ref0 = db.collection('ar_accounts').doc(sub.orderId);
  try {
    await db.runTransaction(async tx => {
      const snap = await tx.get(ref0); const a = snap.exists ? snap.data() : { orderId: sub.orderId, payments: [] }; const total = arOrderTotal(o), paid = arPaid(a);
      if (sub.amount > total - paid + 0.005) throw new Error(`Sobra ang halaga. Balance lang ay ${money(total - paid)}.`);
      const payments = (a.payments || []).concat([{ id: subId, date: new Date().toISOString().slice(0, 10), amount: sub.amount, mode: sub.mode, ref: sub.ref || '', notes: `Galing kay agent ${sub.by} · kinumpirma ni ${by}`, by, at: new Date().toISOString(), photoId: sub.photoId }]);
      const np = paid + sub.amount;
      tx.set(ref0, { orderId: sub.orderId, siNumber: o.siNumber || '', customer: arCustomer(o), total, paid: np, status: arStatusOf(total, np), payments, updatedAt: firebase.firestore.FieldValue.serverTimestamp() });
      tx.update(db.collection('payment_submissions').doc(subId), { status: 'confirmed', confirmedBy: by, confirmedAt: new Date().toISOString() });
    });
    await arSyncOrder(sub.orderId);
    try { await logSystemAction('AGENT_PAYMENT_CONFIRMED', `${sub.orderNo} · ${money(sub.amount)}`); } catch (e) {}
    arCloseModal(); await loadArLedger();
  } catch (e) { alert('Error: ' + e.message); }
}
async function arRejectSub(subId) {
  const reason = await uiPrompt('Dahilan ng pag-reject (makikita ni agent):'); if (!reason) return; const u = getCurrentUser() || {};
  await db.collection('payment_submissions').doc(subId).update({ status: 'rejected', rejectReason: reason, rejectedBy: u.name || u.email || '', rejectedAt: new Date().toISOString() });
  arCloseModal(); await loadArLedger();
}
// ---- Resibo (grocery-style) + print preview ----
function ordReceiptHtml(o, preview) {
  const items = o.items || []; const total = parseFloat(o.totalAmount) || 0, paid = parseFloat(o.amountPaid) || 0, bal = Math.max(0, total - paid);
  const pend = (ordMySubs[o.id] || []).some(x => x.status === 'pending') || (typeof arState !== 'undefined' && (arState.subs || []).some(x => x.orderId === o.id && x.status === 'pending'));
  const lines = items.map(i => { const parts = []; if (i.wholeQty) parts.push(`${i.wholeQty} ${srchEsc(i.wholeUOM || 'whole')} x ${money(i.wholePrice)}`); if (i.looseQty) parts.push(`${i.looseQty} ${srchEsc(i.looseUOM || 'loose')} x ${money(i.loosePrice)}`); return `<div class="rc-item"><div>${srchEsc(i.itemName || i.itemCode)}</div><div class="rc-row"><span>${parts.join(' + ')}</span><span>${money(i.subtotal)}</span></div></div>`; }).join('');
  const stamp = o.paymentStatus === 'Paid' ? '<div class="rc-stamp" style="color:#059669;border-color:#059669;">PAID</div>' : pend ? '<div class="rc-stamp" style="color:#d97706;border-color:#d97706;">FOR CONFIRMATION</div>' : (o.paymentStatus === 'Partial' ? '<div class="rc-stamp" style="color:#d97706;border-color:#d97706;">PARTIAL</div>' : '<div class="rc-stamp" style="color:#b91c1c;border-color:#b91c1c;">UNPAID</div>');
  const created = o.createdAt && (o.createdAt.toDate ? o.createdAt.toDate() : o.createdAt.seconds ? new Date(o.createdAt.seconds * 1000) : null);
  return `<style>.rc{width:300px;margin:0 auto;font-family:'Courier New',monospace;font-size:12px;color:#000;}.rc h2{text-align:center;margin:0;font-size:15px;}.rc .c{text-align:center;}.rc hr{border:0;border-top:1px dashed #000;margin:6px 0;}.rc-row{display:flex;justify-content:space-between;gap:6px;}.rc-item{margin:3px 0;}.rc-stamp{border:3px solid;text-align:center;font-weight:800;font-size:18px;padding:3px;margin:8px 0;transform:rotate(-3deg);}.rc-sign{margin-top:22px;border-top:1px solid #000;text-align:center;font-size:10px;}</style>
  <div class="rc">${compReceiptHdr(o)}<div class="c">${preview ? '*** PREVIEW — hindi pa na-place ***' : 'SALES ORDER RECEIPT'}</div><hr>
  <div class="rc-row"><span>Order:</span><span>${srchEsc(o.orderId || o.id || '(bago)')}</span></div>
  <div class="rc-row"><span>Petsa:</span><span>${(created || new Date()).toLocaleString('en-PH')}</span></div>
  <div class="rc-row"><span>Delivery:</span><span>${srchEsc(o.targetDeliveryDate || 'ASAP')}</span></div>
  <div class="rc-row"><span>Customer:</span><span>${srchEsc(o.customerName || o.branchName || '—')}</span></div>
  ${o.agentName ? `<div class="rc-row"><span>Agent:</span><span>${srchEsc(o.agentName)}</span></div>` : ''}<hr>${lines || '<div class="c">Walang item</div>'}<hr>
  <div class="rc-row"><span>Subtotal</span><span>${money(o.subtotalAmount != null ? o.subtotalAmount : total)}</span></div>
  ${parseFloat(o.discountAmount) ? `<div class="rc-row"><span>Discount</span><span>-${money(o.discountAmount)}</span></div>` : ''}${parseFloat(o.vatAmount) ? `<div class="rc-row"><span>VAT (${srchEsc(o.vatType || '')})</span><span>${money(o.vatAmount)}</span></div>` : ''}
  <div class="rc-row" style="font-weight:800;font-size:14px;"><span>TOTAL</span><span>${money(total)}</span></div>
  <div class="rc-row"><span>Nabayad</span><span>${money(paid)}</span></div><div class="rc-row"><span>Balance</span><span>${money(bal)}</span></div>${preview ? '' : stamp}<hr>
  <div class="rc-sign">Tumanggap / Customer</div><div class="c" style="margin-top:8px;font-size:10px;">Salamat po!</div></div>`;
}
async function ordReceiptPreview(orderId) {
  await compEnsure(); let o;
  if (orderId === 'draft') {
    const t = (typeof calculateBranchCartTotals === 'function') ? calculateBranchCartTotals() : { finalTotal: 0, subtotal: 0, discountAmt: 0, vatAmount: 0 };
    if (!orderCart.length) { alert('Walang laman ang basket.'); return; }
    const sel = document.getElementById('order-customer'); const cn = sel && sel.value ? sel.options[sel.selectedIndex].text : ''; const u = getCurrentUser() || {};
    o = { orderId: '', items: orderCart, totalAmount: t.finalTotal, subtotalAmount: t.subtotal, discountAmount: t.discountAmt, vatAmount: t.vatAmount, vatType: (document.getElementById('order-vat') || {}).value || '', customerName: cn, agentName: cn ? (u.name || u.email || '') : '', targetDeliveryDate: selectedDeliveryDate || '', paymentStatus: 'Unpaid', amountPaid: 0 };
  } else {
    o = (window.__ordCache || {})[orderId] || (typeof arState !== 'undefined' && arState.orders.find(x => x.id === orderId));
    if (!o || !o.items) { const d = await db.collection('orders').doc(orderId).get(); if (!d.exists) return; o = { id: d.id, ...d.data() }; }
  }
  window.__rcCurrent = { o, preview: orderId === 'draft' };
  arModal(`<h3>🧾 Print Preview — Resibo</h3><div style="background:#f1f5f9;padding:.8rem;border-radius:.4rem;overflow:auto;"><div style="background:#fff;padding:10px;width:320px;margin:0 auto;box-shadow:0 1px 6px rgba(0,0,0,.2);">${ordReceiptHtml(o, orderId === 'draft')}</div></div><div style="margin-top:.6rem;"><button class="btn btn-primary" onclick="ordReceiptPrint()">🖨️ I-print</button></div>`);
}
function ordReceiptPrint() { const c = window.__rcCurrent; if (!c) return; printHtmlDoc('Resibo', `<style>@page{size:80mm auto;margin:3mm}body{margin:0!important;padding:0!important}</style>${ordReceiptHtml(c.o, c.preview)}`); }


// ========================================================
// 🛠️ MGA REQUEST (parang Jira) — Branch → Procurement/Canvass → Approval (COO/President) → PO/Bayad → Delivery
// requests/{REQ-0001}: { key,title,description,type,priority,branch,requester,requesterEmail,neededBy,photos:[ids],status,assignee,
//   quotes:[{id,supplier,amount,notes,photoId,by,at}], selectedQuote, approval:{by,role,at,note}, poNumber, paymentRef, comments:[], history:[] }
// request_photos/{id}: { dataUrl }     request_counter/main: { n }
// ========================================================
const REQ_STATUSES = ['Open', 'For Quotation', 'For Head Review', 'For Approval', 'Approved', 'PO Created', 'For Payment', 'Paid', 'For Delivery', 'Delivered', 'Completed', 'On Hold', 'Rejected', 'Cancelled'];
const REQ_COLORS = { 'Open': '#64748b', 'For Quotation': '#0284c7', 'For Head Review': '#ca8a04', 'For Approval': '#d97706', 'Approved': '#16a34a', 'PO Created': '#7c3aed', 'For Payment': '#db2777', 'Paid': '#0d9488', 'For Delivery': '#2563eb', 'Delivered': '#059669', 'Completed': '#15803d', 'On Hold': '#a16207', 'Rejected': '#dc2626', 'Cancelled': '#94a3b8' };
const REQ_TYPES = ['Repair / Maintenance', 'Equipment / IT', 'Supplies / Materials', 'Service / Contractor', 'Other'];
const REQ_PRIOS = ['Low', 'Medium', 'High', 'Urgent'];
let reqState = { list: [], view: 'list', status: '', prio: '', q: '', cfg: {}, showDone: false };
function reqRoot() { return document.getElementById('req-root'); }
function reqUser() { const u = getCurrentUser() || {}; return { u, role: normalizeRole(u.role), email: String(u.email || '').toLowerCase(), name: u.name || u.email || '' }; }
function reqIsAdmin() { return reqUser().role === 'admin'; }
function reqList(v) { return String(v || '').split(/[,;\s]+/).map(x => x.trim().toLowerCase()).filter(x => x.includes('@')); }
// Procurement (bibili / PO / canvass): kapag may nakatakdang Procurement emails, sila LANG ang may kontrol. Kung wala pa, dating patakaran (admin/commissary).
function reqProcList() { return reqList((reqState.cfg || {}).supplyChainEmails); }
function reqIsProc() { const me = reqUser(), l = reqProcList(); return l.length ? l.includes(me.email) : (me.role === 'admin' || me.role === 'commissary'); }
function reqIsTeam() { const me = reqUser(); return me.role === 'admin' || reqIsProc() || reqIsApprover(); }
// Dalawang approver: COO (isa para sa lahat ng company) at Head of Supply Chain (galing sa nakasave na PO signatories)
function reqApprRole() { const c = reqState.cfg || {}, me = reqUser(); if (c.cooEmail && me.email === String(c.cooEmail).toLowerCase()) return 'coo'; if (c.scHeadEmail && me.email === c.scHeadEmail) return 'sc'; if (!c.cooEmail && c.presidentEmail && me.email === String(c.presidentEmail).toLowerCase()) return 'coo'; if (!c.cooEmail && me.role === 'admin') return 'coo'; return ''; }
// Takbo: Assignee (canvass, maraming quotation) → Head of Supply Chain (review/baguhin ang presyo, discount) → COO (pipili ng quotation at final approver)
function reqHasHead() { return !!(reqState.cfg || {}).scHeadEmail; }
function reqApprReq() { return ['coo']; }
function reqApprLabel(k) { return k === 'coo' ? 'COO' : 'Head of Supply Chain'; }
function reqIsApprover() { return !!reqApprRole(); }
function reqBadge(st) { return `<span style="background:${REQ_COLORS[st] || '#64748b'};color:#fff;padding:2px 8px;border-radius:999px;font-size:.72rem;font-weight:700;white-space:nowrap;">${srchEsc(st)}</span>`; }
function reqPrioBadge(p) { const c = { Low: '#64748b', Medium: '#0284c7', High: '#d97706', Urgent: '#dc2626' }[p] || '#64748b'; return `<span style="color:${c};font-weight:700;font-size:.78rem;">${p === 'Urgent' ? '🔥 ' : p === 'High' ? '⬆ ' : ''}${srchEsc(p || '')}</span>`; }
function reqTs(t) { try { const d = t && t.toDate ? t.toDate() : new Date(t && t.seconds ? t.seconds * 1000 : t); return isNaN(d) ? '' : d.toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' }); } catch (e) { return ''; } }
async function loadRequests() {
  const root = reqRoot(); if (!root || !db) return;
  root.innerHTML = '<div class="card">Kinukuha ang mga request...</div>';
  try {
    const me = reqUser();
    try { const [c, g] = await Promise.all([db.collection('system_settings').doc('request_approvers').get(), db.collection('system_settings').doc('po_signatories').get().catch(() => null)]); const a = c.exists ? c.data() : {}, sg = g && g.exists ? g.data() : {};
      // Ang COO at Head of Supply Chain ay galing sa nakasave na PO signatories (iisang setting para sa PO at Request)
      reqState.cfg = Object.assign({}, a, { cooEmail: String(sg.cooEmail || a.cooEmail || '').toLowerCase(), scHeadEmail: String(sg.supplyChainEmail || '').toLowerCase(), supplyChainEmails: [a.supplyChainEmails, sg.supplyChainEmail].filter(Boolean).join(', ') }); } catch (e) { reqState.cfg = {}; }
    reqState.list = []; const seen = new Set(), add = sn => sn.forEach(d => { if (!seen.has(d.id)) { seen.add(d.id); reqState.list.push({ id: d.id, ...d.data() }); } });
    if (me.role !== 'branch' && reqIsTeam()) add(await db.collection('requests').get());
    else { add(await db.collection('requests').where('requesterEmail', '==', me.email).get()); if (me.role !== 'branch') { try { add(await db.collection('requests').where('assigneeEmail', '==', me.email).get()); } catch (e) {} } }
    reqState.list.sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
    reqRender();
  } catch (e) { root.innerHTML = `<div class="card" style="color:#dc2626;">Error: ${srchEsc(e.message)}</div>`; }
}
function reqFiltered() {
  const S = reqState; return S.list.filter(r => (!S.status || r.status === S.status) && (!S.prio || r.priority === S.prio) && (!S.q || smartMatch(S.q, `${r.key} ${r.title} ${r.branch} ${r.requester} ${r.description || ''}`)) && (S.showDone || S.status || !['Completed', 'Cancelled', 'Rejected'].includes(r.status)));
}
function reqRender() {
  const root = reqRoot(); if (!root) return; const S = reqState; const me = reqUser(); const list = reqFiltered();
  const counts = {}; S.list.forEach(r => counts[r.status] = (counts[r.status] || 0) + 1);
  const mineApprove = S.list.filter(r => r.status === 'For Approval').length;
  const chips = REQ_STATUSES.filter(s => counts[s]).map(s => `<span onclick="reqState.status='${s}';reqRender()" style="cursor:pointer;">${reqBadge(s)} <b>${counts[s]}</b></span>`).join(' &nbsp; ');
  let body;
  if (S.view === 'board') {
    const cols = REQ_STATUSES.filter(s => S.showDone || !['Completed', 'Cancelled', 'Rejected'].includes(s));
    body = `<div style="display:flex;gap:.6rem;overflow-x:auto;align-items:flex-start;padding-bottom:.5rem;">${cols.map(c => { const items = list.filter(r => r.status === c); return `<div ondragover="event.preventDefault()" ondrop="reqDrop(event,'${c}')" style="min-width:210px;max-width:230px;background:#f1f5f9;border-radius:.5rem;padding:.5rem;"><div style="font-weight:700;margin-bottom:.4rem;">${reqBadge(c)} <small>${items.length}</small></div>${items.map(r => `<div ${reqTransitions(r).length ? `draggable="true" ondragstart="event.dataTransfer.setData('text/plain','${r.id}')"` : ''} onclick="reqOpen('${r.id}')" style="background:#fff;border-radius:.4rem;padding:.5rem;margin-bottom:.4rem;box-shadow:0 1px 2px rgba(0,0,0,.1);cursor:pointer;"><small style="color:#64748b;">${srchEsc(r.key)} · ${srchEsc(r.branch || '')}</small><div style="font-weight:600;margin:.15rem 0;">${srchEsc(r.title)}</div>${reqPrioBadge(r.priority)}${(r.photos || []).length ? ' 📷' + r.photos.length : ''}<div style="font-size:.72rem;color:#64748b;margin-top:.25rem;">📝 ${srchEsc(r.requester || '?')}<br>🛠️ ${srchEsc(r.assignee || 'Unassigned')}</div></div>`).join('') || '<small style="color:#94a3b8;">—</small>'}</div>`; }).join('')}</div>`;
  } else {
    body = `<div class="table-responsive"><table data-notools="1"><thead><tr><th>Key</th><th>Request</th><th>Branch / Reporter</th><th>Priority</th><th>Status</th><th>Assignee</th><th>Huling update</th></tr></thead><tbody>${list.map(r => `<tr style="cursor:pointer;" onclick="reqOpen('${r.id}')"><td><b>${srchEsc(r.key)}</b></td><td><b>${srchEsc(r.title)}</b><br><small style="color:#64748b;">${srchEsc(r.type || '')}${(r.photos || []).length ? ' · 📷 ' + r.photos.length : ''}</small></td><td>${srchEsc(r.branch || '')}<br><small>${srchEsc(r.requester || '')}</small></td><td>${reqPrioBadge(r.priority)}</td><td>${reqBadge(r.status)}</td><td>${srchEsc(r.assignee || '— (wala pa)')}</td><td><small>${srchEsc(reqTs(r.updatedAt))}</small></td></tr>`).join('') || '<tr><td colspan="7" style="text-align:center;color:#94a3b8;">Walang request.</td></tr>'}</tbody></table></div>`;
  }
  root.innerHTML = `<div class="card"><div class="card-title"><span>🛠️ Mga Request — Repair, Maintenance at Pagbili</span><div style="display:flex;gap:.4rem;flex-wrap:wrap;"><button class="btn btn-success btn-sm" onclick="reqOpenNew()">➕ Gumawa ng Request</button>${me.role === 'admin' ? '<button class="btn btn-secondary btn-sm" onclick="reqSetApprovers()">⚙️ Approvers</button>' : ''}<button class="btn btn-secondary btn-sm" onclick="loadRequests()">🔄</button></div></div>
    ${mineApprove && reqIsApprover() && me.role !== 'branch' ? `<div style="background:#fffbeb;border:1px solid #fcd34d;padding:.5rem;border-radius:.4rem;margin-bottom:.5rem;">🔔 ${mineApprove} request ang naghihintay ng approval mo.</div>` : ''}
    <div style="margin-bottom:.5rem;">${chips || '<small style="color:#94a3b8;">Wala pang request.</small>'}</div>
    <div style="display:flex;gap:.4rem;flex-wrap:wrap;align-items:center;margin-bottom:.6rem;">
      <button class="btn btn-sm ${S.view === 'list' ? 'btn-primary' : 'btn-secondary'}" onclick="reqState.view='list';reqRender()">📋 List</button><button class="btn btn-sm ${S.view === 'board' ? 'btn-primary' : 'btn-secondary'}" onclick="reqState.view='board';reqRender()">🗂️ Board</button>
      <select onchange="reqState.status=this.value;reqRender()"><option value="">Lahat ng status</option>${REQ_STATUSES.map(s => `<option ${S.status === s ? 'selected' : ''}>${s}</option>`).join('')}</select>
      <select onchange="reqState.prio=this.value;reqRender()"><option value="">Lahat ng priority</option>${REQ_PRIOS.map(s => `<option ${S.prio === s ? 'selected' : ''}>${s}</option>`).join('')}</select>
      <input type="text" id="req-search" value="${srchEsc(S.q)}" placeholder="🔎 Hanapin..." oninput="reqState.q=this.value;reqRender();var e=document.getElementById('req-search');e.focus();e.setSelectionRange(e.value.length,e.value.length)">
      <label><input type="checkbox" ${S.showDone ? 'checked' : ''} onchange="reqState.showDone=this.checked;reqRender()"> Isama ang tapos/kanselado</label></div>${body}</div>`;
}
function reqOpenNew() {
  const me = reqUser(); if (!window.__reqCompanies) { window.__reqCompanies = []; db.collection('companies').get().then(sn => { sn.forEach(d => window.__reqCompanies.push(d.data().name || d.id)); window.__reqCompanies.sort(); const sel = document.getElementById('rq-company'); if (sel) window.__reqCompanies.forEach(c => { const o = document.createElement('option'); o.textContent = c; sel.appendChild(o); }); }).catch(() => {}); }
  arModal(`<h3>➕ Gumawa ng Request</h3>
    <div class="form-group"><label>Buod (maikling pamagat)</label><input type="text" id="rq-title" placeholder="Hal: Palit ng sirang monitor ng CCTV"></div>
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:.6rem;"><div><label>Uri</label><select id="rq-type">${REQ_TYPES.map(t => `<option>${t}</option>`).join('')}</select></div><div><label>Priority</label><select id="rq-prio">${REQ_PRIOS.map(t => `<option ${t === 'Medium' ? 'selected' : ''}>${t}</option>`).join('')}</select></div><div><label>Kailangan bago ang</label><input type="date" id="rq-need"></div></div>
    <div class="form-group" style="margin-top:.5rem;"><label>Branch / Lokasyon</label><input type="text" id="rq-branch" value="${srchEsc((me.u && me.u.branch) || '')}"></div>
    ${me.role === 'branch' ? '' : `<div class="form-group"><label>🏢 Company na magbabayad</label><select id="rq-company"><option value="">(auto — galing sa branch)</option>${(window.__reqCompanies || []).map(c => `<option>${srchEsc(c)}</option>`).join('')}</select></div>`}
    <div class="form-group"><label>🧾 Mga item na kailangan (pangalan, dami, larawan)</label><div id="rq-items"></div><button type="button" class="btn btn-secondary btn-sm" onclick="reqItemAdd()">➕ Dagdag na item</button></div>
    <div class="form-group"><label>Detalye (ano ang sira / ano ang kailangan, ilan, saan)</label><textarea id="rq-desc" rows="4" style="width:100%;" placeholder="Hal: 1 pc monitor para sa CCTV, nawalan ng display."></textarea></div>
    <div class="form-group"><label>📷 Larawan (hanggang 5)</label><input type="file" id="rq-photos" accept="image/*" multiple></div>
    <button class="btn btn-success" onclick="reqCreate()">📤 I-submit ang Request</button>`);
  reqItemAdd();
}
function reqItemAdd() { const box = document.getElementById('rq-items'); if (!box) return; const d = document.createElement('div'); d.className = 'rq-item'; d.style.cssText = 'display:grid;grid-template-columns:2fr 70px 80px;gap:.3rem;margin-bottom:.4rem;padding:.4rem;border:1px solid #e2e8f0;border-radius:6px;';
  d.innerHTML = '<input class="ri-name" placeholder="Pangalan ng item"><input class="ri-qty" type="number" min="0" step="any" placeholder="Dami"><input class="ri-uom" placeholder="pcs" value="pcs"><input class="ri-photo" type="file" accept="image/*" style="grid-column:1/3;"><button type="button" class="btn btn-sm btn-secondary" onclick="this.parentNode.remove()">🗑</button>'; box.appendChild(d); }
function reqItemsHtml(r) { const it = r.items || []; if (!it.length) return ''; return `<h4 style="margin:.8rem 0 .3rem;">🧾 Mga Item</h4><div class="table-responsive"><table data-notools="1"><thead><tr><th>#</th><th>Item</th><th class="num">Dami</th><th>UOM</th><th></th></tr></thead><tbody>${it.map((x, i) => `<tr><td>${i + 1}</td><td>${srchEsc(x.name)}</td><td class="num">${srchEsc(x.qty)}</td><td>${srchEsc(x.uom || '')}</td><td>${x.photoId ? `<button class="btn btn-sm btn-secondary" onclick="reqShowPhoto('${x.photoId}')">📷</button>` : ''}</td></tr>`).join('')}</tbody></table></div>`; }
async function reqCreate() {
  const rows = [...document.querySelectorAll('#rq-items .rq-item')].map(d => ({ name: d.querySelector('.ri-name').value.trim(), qty: +d.querySelector('.ri-qty').value || 0, uom: d.querySelector('.ri-uom').value.trim(), file: (d.querySelector('.ri-photo').files || [])[0] })).filter(x => x.name);
  let title = (document.getElementById('rq-title') || {}).value.trim(); const desc = (document.getElementById('rq-desc') || {}).value.trim();
  if (!title && rows.length) title = rows[0].name + (rows.length > 1 ? ` +${rows.length - 1} pa` : '');
  if (!title) { alert('Maglagay ng buod/pamagat o kahit isang item.'); return; } if (!desc && !rows.length) { alert('Maglagay ng detalye o listahan ng item.'); return; }
  if (rows.some(x => !(x.qty > 0))) { alert('Lagyan ng dami (higit sa 0) ang bawat item.'); return; }
  const me = reqUser(); const files = [...((document.getElementById('rq-photos') || {}).files || [])].slice(0, 5);
  const photoIds = [], photoDocs = [];
  try {
    for (const f of files) { const id = 'RP-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); photoDocs.push({ id, dataUrl: await compressImageFile(f, 1000, 0.7) }); photoIds.push(id); }
    const items = []; for (const x of rows) { let pid = ''; if (x.file) { pid = 'RP-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); photoDocs.push({ id: pid, dataUrl: await compressImageFile(x.file, 1000, 0.7) }); } items.push({ name: x.name, qty: x.qty, uom: x.uom || 'pcs', photoId: pid }); }
    const cref = db.collection('request_counter').doc('main'); let key = '';
    await db.runTransaction(async tx => { const c = await tx.get(cref); const n = (c.exists ? (c.data().n || 0) : 0) + 1; tx.set(cref, { n }); key = 'REQ-' + String(n).padStart(4, '0'); });
    const now = new Date().toISOString();
    const doc = { key, title, description: desc, type: document.getElementById('rq-type').value, priority: document.getElementById('rq-prio').value, neededBy: document.getElementById('rq-need').value || '', branch: document.getElementById('rq-branch').value.trim(), company: (me.role !== 'branch' && (document.getElementById('rq-company') || {}).value) || await reqCompanyFor(document.getElementById('rq-branch').value.trim()) || compForUser(), items, requester: me.name, requesterEmail: me.email, photos: photoIds, status: 'Open', assignee: '', quotes: [], selectedQuote: null, approval: null, poNumber: '', paymentRef: '', comments: [], history: [{ at: now, by: me.name, from: '', to: 'Open', note: 'Ginawa ang request' }], createdAt: now, updatedAt: now };
    for (const p of photoDocs) await db.collection('request_photos').doc(p.id).set({ dataUrl: p.dataUrl, requestKey: key, createdAt: now });
    await db.collection('requests').doc(key).set(doc);
    try { logSystemAction('REQUEST_CREATED', `${key}: ${title}`); } catch (e) {}
    notify(['supply'], `Bagong request ${key}: ${title}`, `${me.name} (${doc.branch || '—'}) — ${doc.type}, priority ${doc.priority}. ${desc}`);
    arCloseModal(); alert(`✅ Na-submit ang ${key}. Makikita na ito ng Supply Chain para ma-canvass.`); loadRequests();
  } catch (e) { alert('Error: ' + e.message); }
}
function reqRowById(id) { return reqState.list.find(x => x.id === id); }
function reqTransitions(r) {
  const me = reqUser(), own = r.requesterEmail === me.email, proc = reqIsProc(), adm = reqIsAdmin(), t = [];
  const st = r.status;
  if (st === 'Open') { if (proc) t.push(['For Quotation', '🔎 Simulan ang Canvass (kunin)', 'primary']); if (own || adm) t.push(['Cancelled', '❌ I-cancel', 'danger']); }
  if (st === 'For Quotation') { if (proc) { t.push([reqHasHead() ? 'For Head Review' : 'For Approval', reqHasHead() ? '📨 I-submit sa Head of Supply Chain (review)' : '📨 I-submit for Approval (COO)', 'success']); t.push(['On Hold', '⏸️ Hold', 'secondary']); t.push(['Cancelled', '❌ I-cancel', 'danger']); } }
  if (st === 'For Head Review') { if (reqApprRole() === 'sc' || adm) { t.push(['For Approval', '✅ Aprubahan → ipasa sa COO', 'success']); t.push(['For Quotation', '↩ Ibalik sa canvass', 'secondary']); t.push(['Rejected', '⛔ Reject', 'danger']); } }
  if (st === 'For Approval') { if (reqApprRole() === 'coo' && me.role !== 'branch') { t.push(['Approved', '✅ Approve (COO)', 'success']); t.push(['Rejected', '⛔ Reject', 'danger']); t.push(['For Quotation', '↩ Ibalik sa canvass', 'secondary']); } }
  if (st === 'Approved') { if (proc) t.push(['PO Created', '🚀 Go — Gumawa ng PO', 'primary']); }
  if (st === 'PO Created' && !r.poId) { if (adm) t.push(['For Payment', '💳 For Payment (Accounting)', 'primary']); }
  if (st === 'For Payment' && !r.poId) { if (adm) t.push(['Paid', '✅ Bayad na', 'success']); }
  if (st === 'Paid' && !(r.poId && r.status === 'Delivered')) { if (proc) t.push(['For Delivery', '🚚 Hintay ng Delivery', 'primary']); }
  if (st === 'For Delivery') { if (proc) t.push(['Delivered', '📦 Dumating na', 'success']); if (own) t.push(['Completed', '✅ Natanggap / Ayos na', 'success']); }
  if (st === 'Delivered') { if (own || adm) t.push(['Completed', '✅ Natanggap / Ayos na', 'success']); }
  if (st === 'On Hold') { if (proc) t.push(['For Quotation', '▶️ Ituloy ang canvass', 'primary']); }
  return t;
}
async function reqPhotoHtml(ids) {
  const out = []; for (const id of (ids || [])) { try { const d = await db.collection('request_photos').doc(id).get(); if (d.exists && (d.data().chunks || /^data:application\/pdf/.test(d.data().dataUrl || ''))) out.push(`<button class="btn btn-secondary" style="height:110px;width:110px;" onclick="reqShowPhoto('${id}')">📄 PDF<br><small>I-click para buksan</small></button>`); else if (d.exists) out.push(`<img src="${d.data().dataUrl}" style="width:110px;height:110px;object-fit:cover;border-radius:.4rem;border:1px solid #cbd5e1;cursor:zoom-in;" onclick="imgOpen(this.src)">`); } catch (e) {} }
  return out.join(' ');
}
async function reqOpen(id) {
  const r = reqRowById(id); if (!r) return; const me = reqUser(); const tr = reqTransitions(r);
  const photos = await reqPhotoHtml(r.photos);
  const sel = r.selectedQuote;
  const canQuote = reqIsProc() && ['For Quotation', 'Open', 'On Hold'].includes(r.status), canPrice = canQuote || (r.status === 'For Head Review' && (reqApprRole() === 'sc' || reqIsAdmin())), canPick = canQuote || (r.status === 'For Approval' && reqApprRole() === 'coo');
  const quotes = (r.quotes || []).map((q, i) => `<tr style="${sel === i ? 'background:#ecfdf5;' : ''}"><td>${srchEsc(q.supplier)}</td><td class="num">${money(q.amount)}${q.origAmount && q.origAmount !== q.amount ? `<br><small style="color:#64748b;"><s>${money(q.origAmount)}</s> · -${srchEsc(q.discountPct)}%</small>` : ''}</td><td>${srchEsc(q.notes || '')}</td><td>${reqFilesBtns(q) || '<small style="color:#94a3b8;">walang file</small>'}</td><td>${sel === i ? '<b style="color:#059669;">✅ Napili</b>' : (canPick ? `<button class="btn btn-sm btn-success" onclick="reqSelectQuote('${r.id}',${i})">Piliin</button>` : '')} ${canPrice ? `<button class="btn btn-sm btn-secondary" onclick="reqQuotePrice('${r.id}',${i})">💲 Presyo / Discount</button>` : ''} ${canQuote ? `<button class="btn btn-sm btn-danger" onclick="reqDelQuote('${r.id}',${i})">🗑</button>` : ''}</td></tr>`).join('');
  const poIds = r.poFiles || [], poThumbs = await reqPhotoHtml(poIds), poOk = r.poNumber || ['Approved', 'PO Created', 'For Payment', 'Paid', 'For Delivery', 'Delivered', 'Completed'].includes(r.status);
  const poBox = poOk ? `<h4 style="margin:.8rem 0 .3rem;">📄 Purchase Order (attachment)${r.poNumber ? ' — ' + srchEsc(r.poNumber) : ''}</h4>${poThumbs ? `<div style="display:flex;gap:.4rem;flex-wrap:wrap;margin-bottom:.3rem;">${poThumbs}</div>` : '<small style="color:#94a3b8;">Wala pang na-upload na PO.</small>'}${reqIsTeam() ? `<div style="margin-top:.3rem;"><input type="file" id="po-file" accept="image/*,application/pdf" multiple> <button class="btn btn-sm btn-primary" onclick="reqPoAttach('${r.id}')">📎 I-upload ang PO</button></div>` : ''}` : '';
  const hist = (r.history || []).slice().reverse().map(h => `<div style="font-size:.82rem;border-left:3px solid #cbd5e1;padding-left:.5rem;margin:.25rem 0;"><b>${srchEsc(h.by)}</b> — ${h.from ? srchEsc(h.from) + ' → ' : ''}${reqBadge(h.to)} ${h.note ? '· ' + srchEsc(h.note) : ''}<br><small style="color:#94a3b8;">${srchEsc(reqTs(h.at))}</small></div>`).join('');
  const comments = (r.comments || []).map(c => `<div style="background:#f8fafc;border-radius:.4rem;padding:.4rem .6rem;margin:.3rem 0;"><b>${srchEsc(c.by)}</b> <small style="color:#94a3b8;">${srchEsc(reqTs(c.at))}</small><br>${srchEsc(c.text)}</div>`).join('');
  arModal(`<div style="display:flex;justify-content:space-between;gap:.5rem;flex-wrap:wrap;"><h3 style="margin:0;">${srchEsc(r.key)} — ${srchEsc(r.title)}</h3>${reqBadge(r.status)}</div>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:.4rem;margin:.6rem 0;font-size:.85rem;"><div><small>🏢 Company (magbabayad)</small><br><b>${srchEsc(r.company || '—')}</b>${reqIsProc() && !['Completed', 'Cancelled', 'Rejected'].includes(r.status) ? ` <button class="btn btn-sm btn-secondary" onclick="reqCompanyChange('${r.id}')">✏️ Palitan</button>` : ''}</div><div><small>📝 Reporter (nag-request)</small><br><b>${srchEsc(r.requester || '—')}</b></div><div><small>🛠️ Assignee (bibili / hahawak)</small><br><b>${srchEsc(r.assignee || 'Unassigned')}</b>${reqIsProc() && !['Completed', 'Cancelled', 'Rejected'].includes(r.status) ? ` <button class="btn btn-sm btn-secondary" onclick="reqAssign('${r.id}')">👤 I-assign</button>` : ''}</div>${r.poNumber ? `<div><small>PO / Accounting</small><br>${srchEsc(r.poNumber)} · ${srchEsc(r.poStatus || 'Approved')}</div>` : ''}<div><small>Uri</small><br>${srchEsc(r.type)}</div><div><small>Priority</small><br>${reqPrioBadge(r.priority)}</div><div><small>Branch</small><br>${srchEsc(r.branch || '')}</div><div><small>Humiling</small><br>${srchEsc(r.requester)}</div><div><small>Kailangan bago ang</small><br>${srchEsc(r.neededBy || '—')}</div><div><small>Naka-assign</small><br>${srchEsc(r.assignee || '—')}</div><div><small>PO No.</small><br>${srchEsc(r.poNumber || '—')}</div><div><small>Payment Ref</small><br>${srchEsc(r.paymentRef || '—')}</div></div>
    <div style="white-space:pre-wrap;background:#f8fafc;padding:.6rem;border-radius:.4rem;">${srchEsc(r.description)}</div>
    ${reqItemsHtml(r)}
    ${photos ? `<div style="margin:.6rem 0;display:flex;gap:.4rem;flex-wrap:wrap;">${photos}</div>` : ''}
    ${r.approvals ? `<div style="margin:.5rem 0;padding:.5rem;border-radius:.4rem;background:#f0f9ff;">🖊️ Approvals: ${['sc', 'coo'].filter(k => k !== 'sc' || reqHasHead() || r.approvals.sc).map(k => r.approvals[k] ? `✅ ${reqApprLabel(k)} — <b>${srchEsc(r.approvals[k].by)}</b> (${srchEsc(reqTs(r.approvals[k].at))})` : `⏳ ${reqApprLabel(k)}`).join(' &nbsp;·&nbsp; ')}</div>` : ''}
    ${r.approval && !r.approvals ? `<div style="margin:.5rem 0;padding:.5rem;border-radius:.4rem;background:${r.status === 'Rejected' ? '#fef2f2' : '#ecfdf5'};">${r.status === 'Rejected' ? '⛔ Rejected' : '✅ Approved'} ni <b>${srchEsc(r.approval.by)}</b> (${srchEsc(r.approval.role || '')}) · ${srchEsc(reqTs(r.approval.at))} ${r.approval.note ? '— ' + srchEsc(r.approval.note) : ''}</div>` : ''}
    <h4 style="margin:.8rem 0 .3rem;">🧾 Canvass / Quotations</h4>
    <div class="table-responsive"><table data-notools="1"><thead><tr><th>Supplier</th><th class="num">Halaga</th><th>Notes</th><th>Quotation file (preview / download)</th><th></th></tr></thead><tbody>${quotes || '<tr><td colspan="5" style="color:#94a3b8;">Wala pang quotation.</td></tr>'}</tbody></table></div>
    ${canQuote ? `<div style="display:grid;grid-template-columns:2fr 1fr 2fr;gap:.4rem;margin-top:.4rem;"><input id="qt-sup" placeholder="Supplier"><input id="qt-amt" type="number" step="0.01" placeholder="Halaga ₱"><input id="qt-note" placeholder="Notes (lead time, warranty)"></div><div style="margin-top:.3rem;"><input type="file" id="qt-file" accept="image/*,application/pdf" multiple> <button class="btn btn-sm btn-primary" onclick="reqAddQuote('${r.id}')">➕ Idagdag ang quotation</button></div>` : ''}
    ${poBox}
    <div style="margin:.8rem 0;display:flex;gap:.4rem;flex-wrap:wrap;">${tr.map(([to, label, cls]) => `<button class="btn btn-${cls}" onclick="reqMove('${r.id}','${to}')">${label}</button>`).join('')}<button class="btn btn-secondary" onclick="reqPrint('${r.id}')">🖨️ Print</button>${(r.quotes || []).length ? `<button class="btn btn-primary" onclick="reqPrintPO('${r.id}')">🖨️ Print PO (A4)</button>` : ''}</div>
    <h4 style="margin:.6rem 0 .3rem;">💬 Mga Komento</h4>${comments || '<small style="color:#94a3b8;">Wala pa.</small>'}
    <div style="display:flex;gap:.4rem;margin-top:.4rem;"><input id="rq-comment" placeholder="Magdagdag ng komento..." style="flex:1;"><button class="btn btn-primary btn-sm" onclick="reqComment('${r.id}')">Ipadala</button></div>
    <h4 style="margin:.8rem 0 .3rem;">🕘 Activity</h4>${hist}`);
}
async function reqFileToData(f) {
  if (/^image\//.test(f.type)) return compressImageFile(f, 1100, 0.7);
  if (f.type === 'application/pdf') { if (f.size > 700 * 1024) throw new Error('Masyadong malaki ang PDF (max ~700KB). Kunan na lang ng larawan o paliitin ang PDF.'); return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = () => rej(new Error('Hindi mabasa ang file.')); r.readAsDataURL(f); }); }
  throw new Error('Larawan o PDF lang ang tinatanggap.');
}
// Imbakan ng file (larawan/PDF): ≤~700KB = 1 doc; mas malaki = hinahati sa chunks (hanggang ~4MB)
async function reqSaveFile(f, requestKey, kind) {
  const id = 'RP-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), now = new Date().toISOString(), meta = { requestKey, kind: kind || '', name: f.name || '', createdAt: now };
  if (f.type === 'application/pdf') {
    if (f.size > 4 * 1024 * 1024) throw new Error('Masyadong malaki ang PDF (max 4MB). Paliitin muna o hatiin.');
    const url = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = () => rej(new Error('Hindi mabasa ang file.')); r.readAsDataURL(f); });
    if (url.length <= 700000) { await db.collection('request_photos').doc(id).set(Object.assign({ dataUrl: url, mime: 'application/pdf' }, meta)); return { id, name: meta.name }; }
    const CH = 600000, n = Math.ceil(url.length / CH); for (let i = 0; i < n; i++) await db.collection('request_photos').doc(id + '_' + i).set({ data: url.slice(i * CH, (i + 1) * CH), part: i, requestKey, createdAt: now });
    await db.collection('request_photos').doc(id).set(Object.assign({ chunks: n, mime: 'application/pdf' }, meta)); return { id, name: meta.name };
  }
  if (!/^image\//.test(f.type)) throw new Error('Larawan o PDF lang ang tinatanggap.');
  await db.collection('request_photos').doc(id).set(Object.assign({ dataUrl: await compressImageFile(f, 1100, 0.7), mime: 'image/jpeg' }, meta)); return { id, name: meta.name };
}
async function reqLoadFile(id) {
  const d = await db.collection('request_photos').doc(id).get(); if (!d.exists) return null; const x = d.data(); if (!x.chunks) return { dataUrl: x.dataUrl || '', name: x.name || '', mime: x.mime || (/^data:application\/pdf/.test(x.dataUrl || '') ? 'application/pdf' : 'image/jpeg') };
  let url = ''; for (let i = 0; i < x.chunks; i++) { const c = await db.collection('request_photos').doc(id + '_' + i).get(); url += c.exists ? c.data().data : ''; } return { dataUrl: url, name: x.name || '', mime: x.mime || 'application/pdf' };
}
async function reqDownload(id) { try { const f = await reqLoadFile(id); if (!f) { alert('Wala nang file na ito.'); return; } const a = document.createElement('a'); let url = f.dataUrl; if (/^data:application\/pdf/.test(url)) { const b = atob(url.split(',')[1]), u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); url = URL.createObjectURL(new Blob([u], { type: 'application/pdf' })); } a.href = url; a.download = f.name || (f.mime === 'application/pdf' ? 'quotation.pdf' : 'larawan.jpg'); document.body.appendChild(a); a.click(); a.remove(); } catch (e) { alert('Error: ' + e.message); } }
function reqFilesBtns(q) { const fl = (q.files && q.files.length) ? q.files : (q.photoId ? [{ id: q.photoId, name: '' }] : []); return fl.map((f, i) => `<div style="white-space:nowrap;margin:2px 0;"><button class="btn btn-sm btn-secondary" onclick="reqShowPhoto('${f.id}')" title="Preview">👁️ ${srchEsc((f.name || 'File ' + (i + 1)).slice(0, 18))}</button> <button class="btn btn-sm btn-secondary" onclick="reqDownload('${f.id}')" title="I-download">⬇️</button></div>`).join(''); }
async function reqPoAttach(id) {
  const fs = [...((document.getElementById('po-file') || {}).files || [])]; if (!fs.length) { alert('Pumili ng larawan o PDF ng PO.'); return; } const me = reqUser();
  try { const ids = []; for (const f of fs.slice(0, 5)) { const sv = await reqSaveFile(f, id, 'po'); ids.push(sv.id); }
    await reqUpdate(id, d => ({ poFiles: (d.poFiles || []).concat(ids) }), { by: me.name, from: '', to: (reqRowById(id) || {}).status || 'PO Created', note: `Nag-upload ng PO attachment (${ids.length})` }); reqOpen(id); } catch (e) { alert('Error: ' + e.message); }
}
// ---- Lightbox: i-click ang anumang larawan para lumaki (zoom, save, close) ----
function imgOpen(src) {
  if (!src) return; let o = document.getElementById('img-lightbox'); if (o) o.remove();
  o = document.createElement('div'); o.id = 'img-lightbox'; o.style.cssText = 'position:fixed;inset:0;background:rgba(15,23,42,.92);z-index:99999;display:flex;flex-direction:column;';
  const pdf = /^data:application\/pdf/.test(src); let url = src; if (pdf) { try { const b = atob(src.split(',')[1]), u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); url = URL.createObjectURL(new Blob([u], { type: 'application/pdf' })); } catch (e) {} }
  o.innerHTML = `<div style="display:flex;gap:.5rem;justify-content:flex-end;padding:.5rem;">${pdf ? '' : '<button class="btn btn-secondary btn-sm" data-z="-1">➖</button><button class="btn btn-secondary btn-sm" data-z="1">➕</button>'}<a class="btn btn-secondary btn-sm" href="${url}" download="${srchEsc(window.__imgName || (pdf ? 'file.pdf' : 'larawan.jpg'))}" style="text-decoration:none;">⬇️ I-save</a><button class="btn btn-danger btn-sm" data-close="1">✕ Isara</button></div><div id="lb-stage" style="flex:1;overflow:auto;text-align:center;touch-action:pan-x pan-y pinch-zoom;">${pdf ? `<iframe src="${url}" style="width:100%;height:100%;border:0;background:#fff;"></iframe>` : `<img id="lb-img" src="${src}" style="max-width:96vw;max-height:88vh;margin:auto;display:block;">`}</div>`;
  let w = 0; o.onclick = e => { const t = e.target; if (t.dataset && t.dataset.close || t === o || t.id === 'lb-stage') { o.remove(); return; } if (t.dataset && t.dataset.z) { const im = document.getElementById('lb-img'); w = Math.max(0, Math.min(5, w + (+t.dataset.z))); im.style.maxWidth = w ? (96 + w * 80) + 'vw' : '96vw'; im.style.maxHeight = w ? 'none' : '88vh'; im.style.width = w ? (96 + w * 80) + 'vw' : ''; } };
  document.body.appendChild(o);
}
document.addEventListener('click', e => {
  const t = e.target; if (!t || t.tagName !== 'IMG' || !t.src || t.closest('#img-lightbox') || t.dataset.nozoom !== undefined) return;
  if (t.closest('button, a, nav, aside, header, .sidebar, [class*="avatar"], [class*="logo"]')) return;
  if (!(/^data:image/.test(t.src) || t.closest('#ar-modal, .table-responsive, table, [data-zoom]'))) return; imgOpen(t.src);
});
document.addEventListener('keydown', e => { if (e.key === 'Escape') { const o = document.getElementById('img-lightbox'); if (o) o.remove(); } });
async function reqShowPhoto(id) { try { const f = await reqLoadFile(id); if (f && f.dataUrl) { window.__imgName = f.name || ''; imgOpen(f.dataUrl); } else alert('Wala nang larawan/file na ito.'); } catch (e) { alert('Error: ' + e.message); } }
async function reqUpdate(id, fn, histEntry) {
  const ref = db.collection('requests').doc(id);
  await db.runTransaction(async tx => {
    const snap = await tx.get(ref); if (!snap.exists) throw new Error('Wala na ang request.');
    const d = snap.data(); const patch = fn(d) || {}; const now = new Date().toISOString();
    if (histEntry) patch.history = (d.history || []).concat([Object.assign({ at: now }, histEntry)]);
    patch.updatedAt = now; tx.update(ref, patch);
  });
  await loadRequests(); reqOpen(id);
}
async function reqComment(id) {
  const text = ((document.getElementById('rq-comment') || {}).value || '').trim(); if (!text) return; const me = reqUser();
  try { await reqUpdate(id, d => ({ comments: (d.comments || []).concat([{ by: me.name, at: new Date().toISOString(), text }]) })); } catch (e) { alert('Error: ' + e.message); }
}
async function reqAddQuote(id) {
  const sup = (document.getElementById('qt-sup') || {}).value.trim(), amt = parseFloat((document.getElementById('qt-amt') || {}).value), note = (document.getElementById('qt-note') || {}).value.trim();
  if (!sup || !(amt > 0)) { alert('Ilagay ang supplier at halaga.'); return; } const me = reqUser(); const fs = [...((document.getElementById('qt-file') || {}).files || [])].slice(0, 5);
  try {
    const files = []; for (const f of fs) files.push(await reqSaveFile(f, id, 'quote'));
    await reqUpdate(id, d => ({ quotes: (d.quotes || []).concat([{ id: 'Q' + Date.now().toString(36), supplier: sup, amount: amt, notes: note, photoId: files[0] ? files[0].id : '', files, by: me.name, at: new Date().toISOString() }]), status: d.status === 'Open' ? 'For Quotation' : d.status, assignee: d.assignee || me.name }), { by: me.name, from: '', to: 'For Quotation', note: `Quotation: ${sup} ${money(amt)}${files.length ? ' (' + files.length + ' file)' : ''}` });
  } catch (e) { alert('Error: ' + e.message); }
}
async function reqQuotePrice(id, i) {
  const r = reqRowById(id), me = reqUser(); const q = r && (r.quotes || [])[i]; if (!q) return; const orig = +q.origAmount || +q.amount;
  const t = await uiPrompt(`Presyo ni ${q.supplier} (orihinal ₱${money(orig)}).\nI-type ang FINAL na presyo (hal. 4500) o ang DISCOUNT % (hal. 5%):`, ''); if (t === null || !String(t).trim()) return;
  const m = String(t).trim().replace(/[₱,\s]/g, ''); let amt = 0, pct = 0; if (/%$/.test(m)) { pct = parseFloat(m); amt = orig * (1 - pct / 100); } else { amt = parseFloat(m); pct = orig > 0 ? (1 - amt / orig) * 100 : 0; }
  if (!(amt > 0) || pct >= 100) { alert('Hindi tama ang presyo/discount.'); return; } amt = Math.round(amt * 100) / 100;
  try { await reqUpdate(id, d => { const qs = (d.quotes || []).map(x => Object.assign({}, x)); const x = qs[i]; x.origAmount = +x.origAmount || +x.amount; x.amount = amt; x.discountPct = Math.round(pct * 100) / 100; x.priceBy = me.name; x.priceAt = new Date().toISOString(); return { quotes: qs }; }, { by: me.name, from: r.status, to: r.status, note: `Presyo ni ${q.supplier}: ₱${money(orig)} → ₱${money(amt)} (${Math.round(pct * 100) / 100}% discount)` }); } catch (e) { alert(e.message); }
}
async function reqSelectQuote(id, i) { const me = reqUser(); try { await reqUpdate(id, d => ({ selectedQuote: i }), { by: me.name, from: '', to: 'For Quotation', note: 'Napili ang quotation #' + (i + 1) }); } catch (e) { alert(e.message); } }
async function reqDelQuote(id, i) { if (!await uiConfirm('Burahin ang quotation na ito?')) return; try { await reqUpdate(id, d => { const q = (d.quotes || []).slice(); q.splice(i, 1); return { quotes: q, selectedQuote: null }; }); } catch (e) { alert(e.message); } }
async function reqMove(id, to) {
  const r = reqRowById(id); if (!r) return; const me = reqUser(); const allowed = reqTransitions(r).some(t => t[0] === to); if (!allowed) { alert('Hindi mo puwedeng gawin ito.'); return; }
  let note = ''; const extra = {};
  if (to === 'For Approval') { if (r.selectedQuote == null || !(r.quotes || [])[r.selectedQuote]) { alert('Pumili muna ng quotation (Piliin) bago i-submit for approval.'); return; } if ((r.quotes || []).length < 2 && !await uiConfirm('Isang quotation pa lang. Ituloy pa rin for approval?')) return; }
  if (to === 'Rejected') { note = await uiPrompt('Dahilan ng pag-reject:'); if (!note) return; extra.approval = { by: me.name, role: reqApprLabel(reqApprRole()), at: new Date().toISOString(), note }; extra.approvals = null; }
  if (to === 'For Head Review' || (to === 'For Approval' && r.status === 'For Quotation')) { if (r.selectedQuote == null || !(r.quotes || [])[r.selectedQuote]) { alert('Pumili muna ng quotation (Piliin) bilang rekomendasyon.'); return; } }
  if (to === 'For Approval' && r.status === 'For Head Review') { note = await uiPrompt('Komento ng Head (optional):') || ''; const ap = Object.assign({}, r.approvals || {}); ap.sc = { by: me.name, at: new Date().toISOString(), note }; extra.approvals = ap; }
  if (to === 'Approved') { note = await uiPrompt('Komento sa approval (optional):') || ''; const at = new Date().toISOString(), ap = Object.assign({}, r.approvals || {}); ap.coo = { by: me.name, at, note }; extra.approvals = ap; extra.approval = { by: me.name, role: 'COO', at, note }; const fq = (r.quotes || [])[r.selectedQuote]; if (!fq) { alert('Pumili muna ng quotation (Piliin) bago mag-approve.'); return; } extra.finalQuote = { supplier: fq.supplier, amount: fq.amount }; }
  if (to === 'PO Created') { const made = await reqMakePO(r, me); if (!made) return; extra.poNumber = made.poNumber; extra.poId = made.poId; extra.company = made.company; }
  if (to === 'Paid') { const ref = await uiPrompt('Payment reference (check no. / transfer ref):', r.paymentRef || ''); if (ref === null) return; extra.paymentRef = ref.trim(); }
  if (to === 'Cancelled') { note = await uiPrompt('Dahilan ng pag-cancel:') || ''; }
  if (to === 'On Hold') { note = await uiPrompt('Dahilan ng hold:') || ''; }
  if (to === 'For Quotation' && r.status === 'Open') { extra.assignee = me.name; extra.assigneeEmail = me.email; }
  if (to === 'For Quotation' && r.status === 'For Approval') { note = await uiPrompt('Bakit ibinalik sa canvass?') || ''; extra.approval = null; extra.approvals = null; extra.selectedQuote = null; }
  try { await reqUpdate(id, d => Object.assign({ status: to }, extra, (to === 'For Quotation' && !d.assignee && !extra.assignee) ? { assignee: me.name } : {}), { by: me.name, from: r.status, to, note }); try { logSystemAction('REQUEST_STATUS', `${r.key}: ${r.status} → ${to}`); } catch (e) {}
    const sub = `${r.key} — ${r.title}`; const who = [r.requesterEmail, r.assigneeEmail].filter(Boolean);
    if (to === 'For Head Review') notify([(reqState.cfg || {}).scHeadEmail].filter(Boolean), `Para sa review mo (presyo/discount): ${sub}`, `${me.name} ay nag-submit ng canvass. Puwede mong baguhin ang presyo o i-apply ang discount bago ipasa sa COO.`);
    else if (to === 'For Approval') notify(['coo', 'president'], `Para sa approval: ${sub}`, `${me.name} ay nag-submit ng canvass para sa approval. Napiling quotation: ${((r.quotes || [])[r.selectedQuote] || {}).supplier || ''} — ${money(((r.quotes || [])[r.selectedQuote] || {}).amount || 0)}.`);
    else if (to === 'Approved') { const fq = extra.finalQuote || {}; notify(who, `✅ APPROVED ni COO: ${sub}`, `Inaprubahan ni ${me.name} (COO) ang quotation ng ${fq.supplier || ''} — ${money(fq.amount || 0)}. Puwede mo nang i-go ang PO.${note ? ' ' + note : ''}`, { email: true }); }
    else if (to === 'Rejected') notify(who, `REJECTED: ${sub}`, `${me.name} ay nag-reject.${note ? ' ' + note : ''}`);
    else if (to === 'PO Created') notify(['accounting', ...who], `PO para sa bayad: ${sub}`, `Na-gawan na ng PO (${extra.poNumber}) — ${r.company || extra.company || ''} ${r.branch || ''}. Nasa PO list/AP na ito para sa pagproseso.`);
    else if (to === 'For Quotation' && r.status === 'Open') notify([r.requesterEmail], `Sinimulan na ang canvass: ${sub}`, `${me.name} ang humahawak ng request mo.`);
    else if (['Delivered', 'Completed', 'Cancelled', 'On Hold'].includes(to)) notify(who, `${to}: ${sub}`, `${me.name}${note ? ': ' + note : ''}`); } catch (e) { alert('Error: ' + e.message); }
}

async function reqCompanyFor(branchText) {
  try { const b = String(branchText || '').trim(); if (!b) return ''; const snap = await db.collection('inventory_branches').get(); let c = '';
    snap.forEach(d => { const x = d.data(); if (!c && (hubKey(x.branch) === hubKey(b) || hubKey(x.code) === hubKey(b))) c = x.company || ''; }); return c; } catch (e) { return ''; }
}
// Pag-approve → gagawa ng totoong Vendor PO (Approved na) na lalabas sa PO list + AP ng accounting, naka-tag sa company ng branch
async function reqMakePO(r, me) {
  const q = (r.quotes || [])[r.selectedQuote]; if (!q) { alert('Walang napiling quotation.'); return null; }
  let company = r.company || await reqCompanyFor(r.branch);
  if (!company) { let list = []; try { (await db.collection('companies').get()).forEach(d => list.push(d.data().name || d.id)); } catch (e) {} company = (await uiPrompt('Anong COMPANY ang magbabayad nito?' + (list.length ? '\n(' + list.join(', ') + ')' : ''), list[0] || '') || '').trim(); if (!company) return null; }
  const poNumber = 'RPO-' + String(r.key).replace(/\D/g, ''); const poId = poNumber; const amt = +q.amount || 0; const now = new Date().toISOString();
  const ref = db.collection('vendor_pos').doc(poId); const ex = await ref.get(); if (ex.exists) return { poNumber, poId, company };
  await ref.set({ poNumber, vendorName: q.supplier, vendorId: '', status: 'Approved', approvals: { supplyChain: (r.approvals && r.approvals.sc) ? { by: r.approvals.sc.by, at: r.approvals.sc.at } : { by: me.name, at: now }, coo: (r.approvals && r.approvals.coo) ? { by: r.approvals.coo.by, at: r.approvals.coo.at } : (r.approval ? { by: r.approval.by, at: r.approval.at } : {}) }, items: [{ itemCode: r.key, itemName: r.title, qty: 1, uomType: 'whole', uomText: 'lot', unitCost: amt, subtotal: amt }], totalAmount: amt, nonInventory: true, requestKey: r.key, branch: r.branch || '', company, notes: r.description || '', createdBy: me.name, createdAt: now });
  return { poNumber, poId, company };
}
async function reqSyncFromPO(key, to, note, patchExtra) {
  try {
    const ref = db.collection('requests').doc(key); const snap = await ref.get(); if (!snap.exists) return; const d = snap.data(); notify([d.requesterEmail, d.assigneeEmail].filter(Boolean), `${key}: ${to === 'Paid' ? 'Bayad na (cheque)' : to}`, `${d.title} — ${note || ''}`);
    const order = ['PO Created', 'For Payment', 'Paid', 'For Delivery', 'Delivered', 'Completed']; const a = order.indexOf(d.status), b = order.indexOf(to);
    const now = new Date().toISOString();
    if (a < 0 || b <= a) { if (patchExtra && a >= 0) await ref.update(Object.assign({ updatedAt: now, history: (d.history || []).concat([{ at: now, by: 'System (PO)', from: d.status, to: d.status, note: note || '' }]) }, patchExtra)); return; } // hindi paatras ang status
    await ref.update(Object.assign({ status: to, updatedAt: now, history: (d.history || []).concat([{ at: now, by: 'System (PO)', from: d.status, to, note: note || '' }]) }, patchExtra || {}));
  } catch (e) {}
}
async function reqAssign(id) {
  const r = reqRowById(id); if (!r || !reqIsProc()) return; const l = reqProcList(); if (!l.length) { alert('Itakda muna ang Procurement emails (⚙️ Approvers / Email Notifications).'); return; }
  arModal(`<h3>👤 I-assign ang ${srchEsc(r.key)}</h3><div class="form-group"><label>Assignee (taga-bili / hahawak)</label><select id="rq-asg">${l.map(e => `<option value="${srchEsc(e)}" ${e === (r.assigneeEmail || '') ? 'selected' : ''}>${srchEsc(e)}</option>`).join('')}</select></div><button class="btn btn-success" onclick="reqAssignSave('${srchEsc(id)}')">💾 I-save</button>`);
}
async function reqAssignSave(id) {
  const r = reqRowById(id), e = (document.getElementById('rq-asg') || {}).value; if (!r || !e) return; const me = reqUser();
  try { arCloseModal(); await reqUpdate(id, d => ({ assignee: e.split('@')[0], assigneeEmail: e }), { by: me.name, from: r.status, to: r.status, note: 'Na-assign kay ' + e }); notify([e, r.requesterEmail].filter(Boolean), `Na-assign: ${r.key} — ${r.title}`, `${me.name} ay nag-assign ng request kay ${e}.`); } catch (er) { alert('Error: ' + er.message); }
}
async function reqSetApprovers() {
  const c = reqState.cfg || {}; const coo = await uiPrompt('Email ng COO (puwedeng mag-approve ng request):', c.cooEmail || ''); if (coo === null) return;
  const pres = await uiPrompt('Email ng President (backup lang; ginagamit lang kung walang COO):', c.presidentEmail || ''); if (pres === null) return;
  const sc = await uiPrompt('Procurement / Taga-bili / Taga-PO (mga email, may kuwit). Sila LANG ang makakakita at makaka-drag ng request:', c.supplyChainEmails || ''); if (sc === null) return;
  const list = reqList(sc);
  await db.collection('system_settings').doc('request_approvers').set({ cooEmail: coo.trim().toLowerCase(), presidentEmail: pres.trim().toLowerCase(), supplyChainEmails: list.join(', '), procurementList: list }, { merge: true }); ntfCache.at = 0; alert('✅ Na-save. Ang COO ang laging mag-approve.'); loadRequests();
}
async function reqCompanyChange(id) {
  const r = reqRowById(id); if (!r || !reqIsProc()) return; let list = []; try { (await db.collection('companies').get()).forEach(d => list.push(d.data().name || d.id)); } catch (e) {} list.sort();
  arModal(`<h3>🏢 Palitan ang Company — ${srchEsc(r.key)}</h3><p style="font-size:.85rem;">Ito ang lalabas sa header ng PO at ito ang magbabayad. Nakaayon sa branch ang default: <b>${srchEsc(r.branch || '—')}</b>.</p><div class="form-group"><select id="rq-co-sel">${list.map(c => `<option ${hubKey(c) === hubKey(r.company) ? 'selected' : ''}>${srchEsc(c)}</option>`).join('')}</select></div><button class="btn btn-success" onclick="reqCompanySave('${srchEsc(id)}')">💾 I-save</button>`);
}
async function reqCompanySave(id) {
  const r = reqRowById(id), c = (document.getElementById('rq-co-sel') || {}).value; if (!r || !c) return; const me = reqUser();
  try { arCloseModal(); await reqUpdate(id, () => ({ company: c }), { by: me.name, from: r.status, to: r.status, note: `Company: ${r.company || '—'} → ${c}` }); if (r.poId) { try { await db.collection('vendor_pos').doc(r.poId).update({ company: c }); } catch (e) {} } } catch (e) { alert('Error: ' + e.message); }
}
async function reqPrintPO(id) {
  const r = reqRowById(id); if (!r) return; await compEnsure(); const co = r.company || compForBranch(r.branch) || '';
  const q = (r.quotes || [])[r.selectedQuote] || (r.quotes || [])[0] || null, ap = r.approvals || {}, num = r.poNumber || 'RPO-' + String(r.key).replace(/\D/g, '');
  const items = (r.items && r.items.length ? r.items : [{ name: r.title, qty: 1, uom: 'lot' }]);
  const sig = (k, lbl) => `<div>${ap[k] ? '<b>' + srchEsc(ap[k].by) + '</b><br><small>' + srchEsc(reqTs(ap[k].at)) + '</small><br>' : '<br><br>'}${lbl}</div>`;
  const body = `<style>@page{size:A4;margin:12mm}body{margin:0}</style>${compHeaderHtml(co)}
    <h1 style="text-align:center;letter-spacing:2px;">PURCHASE ORDER</h1>
    <table><tbody><tr><td><b>PO No.</b></td><td>${srchEsc(num)}${r.poNumber ? '' : ' <small>(draft)</small>'}</td><td><b>Petsa</b></td><td>${srchEsc(new Date().toLocaleDateString('en-PH'))}</td></tr>
    <tr><td><b>Company (magbabayad)</b></td><td>${srchEsc(co || '—')}</td><td><b>Request Ref.</b></td><td>${srchEsc(r.key)}</td></tr>
    <tr><td><b>Branch / Lokasyon</b></td><td>${srchEsc(r.branch || '—')}</td><td><b>Kailangan bago ang</b></td><td>${srchEsc(r.neededBy || '—')}</td></tr>
    <tr><td><b>Humiling</b></td><td>${srchEsc(r.requester || '')}</td><td><b>Taga-bili (Assignee)</b></td><td>${srchEsc(r.assignee || '')}</td></tr>
    <tr><td><b>Supplier</b></td><td colspan="3">${q ? srchEsc(q.supplier) : '—'}</td></tr></tbody></table>
    <h2>Mga Item</h2><table><thead><tr><th style="width:30px;">#</th><th>Description</th><th class="num" style="width:70px;">Dami</th><th style="width:70px;">UOM</th></tr></thead><tbody>${items.map((x, i) => `<tr><td>${i + 1}</td><td>${srchEsc(x.name)}</td><td class="num">${srchEsc(x.qty)}</td><td>${srchEsc(x.uom || '')}</td></tr>`).join('')}</tbody>
    <tfoot><tr class="total"><td colspan="2" style="text-align:right;">KABUUANG HALAGA (ayon sa napiling quotation)</td><td class="num" colspan="2">₱ ${q ? money(q.amount) : '—'}</td></tr></tfoot></table>
    ${r.description ? `<div class="box"><b>Notes:</b> ${srchEsc(r.description)}</div>` : ''}${q && q.notes ? `<div class="box"><b>Quotation notes:</b> ${srchEsc(q.notes)}</div>` : ''}
    <div class="sign"><div><br><br>${srchEsc(r.assignee || '')}<br>Inihanda ni (Assignee)</div>${sig('sc', 'Head of Supply Chain')}${sig('coo', 'COO')}</div>
    <div class="meta" style="margin-top:14px;">${printedByLine()}</div>`;
  printHtmlDoc('PO ' + num, body);
}
async function reqPrint(id) {
  const r = reqRowById(id); if (!r) return; const photos = await reqPhotoHtml(r.photos);
  const q = (r.quotes || []).map((x, i) => `<tr><td>${r.selectedQuote === i ? '✔' : ''}</td><td>${srchEsc(x.supplier)}</td><td class="num">${money(x.amount)}</td><td>${srchEsc(x.notes || '')}</td></tr>`).join('');
  printHtmlDoc('Request ' + r.key, `<h1>Request Form — ${srchEsc(r.key)}</h1><div class="meta">${srchEsc(r.branch || '')} · ${srchEsc(r.requester)} · ${srchEsc(reqTs(r.createdAt))} · ${printedByLine()}</div>
    <table><tbody><tr><td><b>Request</b></td><td>${srchEsc(r.title)}</td></tr><tr><td><b>Uri / Priority</b></td><td>${srchEsc(r.type)} / ${srchEsc(r.priority)}</td></tr><tr><td><b>Kailangan bago ang</b></td><td>${srchEsc(r.neededBy || '—')}</td></tr><tr><td><b>Detalye</b></td><td style="white-space:pre-wrap;">${srchEsc(r.description)}</td></tr><tr><td><b>Status</b></td><td>${srchEsc(r.status)} ${r.poNumber ? '· PO ' + srchEsc(r.poNumber) : ''}</td></tr></tbody></table>
    <h2>Canvass</h2><table><thead><tr><th></th><th>Supplier</th><th class="num">Halaga</th><th>Notes</th></tr></thead><tbody>${q || '<tr><td colspan="4">Wala</td></tr>'}</tbody></table>
    ${photos ? `<h2>Larawan</h2><div>${photos}</div>` : ''}
    <div class="sign"><div>Humiling: ${srchEsc(r.requester)}</div><div>Supply Chain: ${srchEsc(r.assignee || '')}</div><div>Approved: ${srchEsc(r.approval ? r.approval.by + ' (' + (r.approval.role || '') + ')' : '')}</div></div>`);
}

/* (inilipat dito mula sa naunang bahagi: kailangang nakabalot sa pinakahuling bersyon ng function) */
if (typeof exportCustomersCSV === 'function') {
  const origExportCustomersCSV = exportCustomersCSV;
  exportCustomersCSV = function() {
    logSystemAction('CUSTOMERS_EXPORTED', `Nag-export ng Customer Directory sa CSV.`);
    origExportCustomersCSV();
  };
}
