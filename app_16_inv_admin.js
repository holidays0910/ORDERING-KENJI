

// ========================================================
// 🖥️ ADMIN: Branch Inventory (Setup, Mga Count, Lahat ng Branch, Variance, Requests)
// ========================================================
let invAdminItems = [], invPickedProd = null, invProdResults = [];
function invTab(name) {
  ['setup', 'counts', 'matrix', 'variance', 'requests'].forEach(t => {
    const el = document.getElementById('inv-tab-' + t); if (el) el.style.display = t === name ? 'block' : 'none';
    const b = document.getElementById('inv-tabbtn-' + t); if (b) b.className = 'btn btn-sm ' + (t === name ? 'btn-primary' : 'btn-secondary');
  });
  if (name === 'requests') invLoadRequests();
}
async function loadBranchInventoryAdmin() {
  const root = document.getElementById('inv-admin-root'); if (!root || !db) return;
  await invLoadMasters();
  if (!adminProductsList.length && typeof loadAdminProducts === 'function') await loadAdminProducts();
  if (!document.getElementById('inv-tab-setup')) {
    const to = new Date(); const from = new Date(Date.now() - 30 * 864e5);
    const iso = d => { const x = new Date(d); x.setMinutes(x.getMinutes() - x.getTimezoneOffset()); return x.toISOString().slice(0, 10); };
    root.innerHTML = `
    <div class="card" data-notools="1"><div class="card-title"><span>📋 Branch Inventory (Kitchen at Wares)</span>
      <div style="display:flex;gap:0.4rem;flex-wrap:wrap;">${[['setup', '⚙️ Setup'], ['counts', '🗂️ Mga Count'], ['matrix', '📊 Lahat ng Branch'], ['variance', '📉 Variance'], ['requests', '🆕 Request na Item']].map(([k, l]) => `<button id="inv-tabbtn-${k}" class="btn btn-sm btn-secondary" onclick="invTab('${k}')">${l}</button>`).join('')}</div></div>
      <p style="font-size:0.85rem;color:#64748b;margin:0;">Ang Inventory ID ay ang SAP/subcode ng item. Ang listahan ng items ay nakadepende sa <b>Company</b> ng branch (hal. KNGK, Tanoshi).</p></div>

    <div id="inv-tab-setup">
      <div class="card" data-notools="1"><div class="card-title"><span>🏪 Branch → Code at Company</span><button class="btn btn-secondary btn-sm" onclick="invLoadBranchSetup()">🔄 Refresh</button></div>
        <input type="search" placeholder="🔍 Hanapin ang branch..." oninput="crudFilter(this)" style="width:100%;margin-bottom:.5rem;"><div class="table-responsive"><table><thead><tr><th>Branch</th><th>Branch Code</th><th>Company</th><th>Aksyon</th></tr></thead><tbody id="inv-branches-tbody"></tbody></table></div>
        <small style="color:#64748b;">Kukunin ang listahan ng branch sa mga user na may role na Branch. Idagdag ang bagong Company sa ibaba (sa "Company" na dropdown, mag-type ng bago at i-click ang ➕ Idagdag).</small></div>
      <div class="card" data-notools="1"><div class="card-title"><span>📦 Listahan ng Inventory Items ng Company</span>
        <div style="display:flex;gap:0.4rem;flex-wrap:wrap;"><button class="btn btn-secondary btn-sm" onclick="switchAdminView('bom_mgmt')">🧪 BOM Management</button><button class="btn btn-secondary btn-sm" onclick="invSapPullOpen()">📒 Kunin mula SAP (Wares)</button><button class="btn btn-secondary btn-sm" onclick="downloadInvItemsTemplate()">📄 Template</button><button class="btn btn-secondary btn-sm" onclick="importInvItemsCSV()">⬆️ Import CSV</button><button class="btn btn-secondary btn-sm" onclick="exportInvItemsCSV()">⬇️ CSV</button><button class="btn btn-secondary btn-sm" onclick="printCardTable(this)">🖨️ Print</button></div></div>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:0.75rem;margin-bottom:0.75rem;align-items:end;">
          <div class="form-group" style="margin:0;"><label>🏢 Company</label><select id="inv-company-sel" onchange="invLoadCompanyItems()"><option value="">-- Company --</option></select></div>
          <div class="form-group" style="margin:0;"><label>🔎 Item (mula sa Product Master)</label><div class="srch-wrap"><input type="text" id="inv-prod-search" autocomplete="off" placeholder="Pangalan / code / barcode" oninput="kDeb(()=>invProdSearch(),'bq5')" onfocus="invProdSearch()"><div id="inv-prod-results" class="srch-results"></div></div></div>
          <div class="form-group" style="margin:0;"><label>Uri</label><select id="inv-setup-type" data-nosearch="1"><option value="kitchen">🍳 Kitchen</option><option value="wares">🥢 Wares</option></select></div>
          <div class="form-group" style="margin:0;"><label>📍 Station ng Branch</label><select id="inv-setup-station"><option value="">-- Station --</option></select></div>
          <button class="btn btn-success" onclick="invAddCompanyItem()">➕ Idagdag sa Listahan</button>
        </div>
        <div class="table-responsive"><table><thead><tr><th>Inventory ID</th><th>Item</th><th>Uri</th><th>Station</th><th>Count UOM</th><th>Aksyon</th></tr></thead><tbody id="inv-items-tbody"><tr><td colspan="6" style="text-align:center;color:#94a3b8;">Pumili ng Company.</td></tr></tbody></table></div></div>
    </div>

    <div id="inv-tab-counts" style="display:none;">
      <div class="card" data-notools="1"><div class="card-title"><span>🗂️ Mga Na-submit na Inventory (lahat ng branch)</span><div style="display:flex;gap:0.4rem;"><button class="btn btn-secondary btn-sm" onclick="printCardTable(this)">🖨️ Print</button><button class="btn btn-secondary btn-sm" onclick="exportCardTable(this)">⬇️ CSV</button></div></div>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:0.75rem;margin-bottom:0.75rem;align-items:end;">
          <div class="form-group" style="margin:0;"><label>Mula</label><input type="date" id="inv-rep-from" value="${iso(from)}"></div>
          <div class="form-group" style="margin:0;"><label>Hanggang</label><input type="date" id="inv-rep-to" value="${iso(to)}"></div>
          <div class="form-group" style="margin:0;"><label>Branch</label><select id="inv-rep-branch" data-searchable="1"><option value="">Lahat ng Branch</option></select></div>
          <button class="btn btn-primary" onclick="invLoadCounts()">🔎 I-load</button></div>
        <div class="table-responsive"><table><thead><tr><th>Petsa</th><th>Branch</th><th>Station</th><th>Binilang ni</th><th>Pumirma / Approved</th><th>Items</th><th>Status</th><th>Aksyon</th></tr></thead><tbody id="inv-counts-tbody"><tr><td colspan="8" style="text-align:center;color:#94a3b8;">I-click ang I-load.</td></tr></tbody></table></div></div>
    </div>

    <div id="inv-tab-matrix" style="display:none;">
      <div class="card" data-notools="1"><div class="card-title"><span>📊 Inventory ng Lahat ng Branch (pila-pila ayon sa Item Code)</span><div style="display:flex;gap:0.4rem;"><button class="btn btn-secondary btn-sm" onclick="printCardTable(this)">🖨️ Print</button><button class="btn btn-secondary btn-sm" onclick="exportCardTable(this)">⬇️ CSV</button></div></div>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:0.75rem;margin-bottom:0.75rem;align-items:end;">
          <div class="form-group" style="margin:0;"><label>🏢 Company</label><select id="inv-mx-company"><option value="">-- Company --</option></select></div>
          <div class="form-group" style="margin:0;"><label>Hanggang petsa (as of)</label><input type="date" id="inv-mx-date" value="${iso(to)}"></div>
          <div class="form-group" style="margin:0;"><label>Uri</label><select id="inv-mx-type" data-nosearch="1"><option value="">Lahat</option><option value="kitchen">🍳 Kitchen</option><option value="wares">🥢 Wares</option></select></div>
          <button class="btn btn-primary" onclick="invLoadMatrix()">🔎 I-load</button></div>
        <div class="table-responsive"><table id="inv-mx-table"><thead><tr><th>Inventory ID</th><th>Item</th></tr></thead><tbody><tr><td colspan="2" style="text-align:center;color:#94a3b8;">Pumili ng Company at i-load.</td></tr></tbody></table></div>
        <small style="color:#64748b;">Ipinapakita ang pinakahuling bilang ng bawat branch hanggang sa napiling petsa. Ang "—" ay ibig sabihing wala pang bilang.</small></div>
    </div>

    <div id="inv-tab-variance" style="display:none;">
      <div class="card" data-notools="1"><div class="card-title"><span>📉 Variance: Pagkakaiba ng Inventory sa Pagitan ng Dalawang Petsa</span><div style="display:flex;gap:0.4rem;"><button class="btn btn-secondary btn-sm" onclick="printCardTable(this)">🖨️ Print</button><button class="btn btn-secondary btn-sm" onclick="exportCardTable(this)">⬇️ CSV</button></div></div>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:0.75rem;margin-bottom:0.75rem;align-items:end;">
          <div class="form-group" style="margin:0;"><label>Branch</label><select id="inv-var-branch" data-searchable="1"><option value="">-- Branch --</option></select></div>
          <div class="form-group" style="margin:0;"><label>Petsa A (simula)</label><input type="date" id="inv-var-a" value="${iso(from)}"></div>
          <div class="form-group" style="margin:0;"><label>Petsa B (katapusan)</label><input type="date" id="inv-var-b" value="${iso(to)}"></div>
          <div class="form-group" style="margin:0;"><label>Station</label><select id="inv-var-station" data-searchable="1"><option value="">Lahat ng Station</option></select></div>
          <button class="btn btn-primary" onclick="invLoadVariance()">🔎 Kalkulahin</button></div>
        <div class="table-responsive"><table><thead><tr><th>Inventory ID</th><th>Item</th><th>UOM</th><th>Station</th><th>Bilang A</th><th>Bilang B</th><th>Pagbabago</th></tr></thead><tbody id="inv-var-tbody"><tr><td colspan="7" style="text-align:center;color:#94a3b8;">Pumili ng branch at dalawang petsa.</td></tr></tbody></table></div>
        <small style="color:#64748b;">Ito ang pagkakaiba ng mga bilang (B − A). Hindi pa kasama rito ang mga idineliver sa branch sa pagitan ng dalawang petsa, kaya ang negatibo ay maaaring nagamit, naubos, o nawala.</small></div>
    </div>

    <div id="inv-tab-requests" style="display:none;">
      <div class="card" data-notools="1"><div class="card-title"><span>🆕 Mga Item na Wala pang SAP Code (galing sa branch)</span><button class="btn btn-secondary btn-sm" onclick="invLoadRequests()">🔄 Refresh</button></div>
        <div class="table-responsive"><table><thead><tr><th>Temp Code</th><th>Item</th><th>UOM</th><th>Branch</th><th>Petsa</th><th>Status</th><th>Aksyon</th></tr></thead><tbody id="inv-req-tbody"></tbody></table></div></div>
    </div>`;
    invTab('setup');
  }
  invRefreshAdminSelects();
  invLoadBranchSetup();
}
function invRefreshAdminSelects() {
  invFill('inv-company-sel', invCompaniesList, '-- Company --', '🏢'); invFill('inv-mx-company', invCompaniesList, '-- Company --', '🏢');
  invFill('inv-setup-station', invStationsList, '-- Station --', '📍'); invFill('inv-var-station', invStationsList, 'Lahat ng Station', '📍');
  const brs = Object.values(invBranchMap).map(b => b.branch).filter(Boolean).sort();
  invFill('inv-rep-branch', brs, 'Lahat ng Branch', '🏪'); invFill('inv-var-branch', brs, '-- Branch --', '🏪');
}
async function invLoadBranchSetup() {
  const tb = document.getElementById('inv-branches-tbody'); if (!tb) return;
  const names = new Set(Object.values(invBranchMap).map(b => b.branch));
  try { (await db.collection('users').get()).forEach(d => { const x = d.data(); if (normalizeRole(x.role) === 'branch' && x.branch) names.add(x.branch); }); } catch (e) {}
  const opts = c => '<option value="">-- Company --</option>' + invCompaniesList.map(n => `<option value="${srchEsc(n)}" ${n === c ? 'selected' : ''}>${srchEsc(n)}</option>`).join('');
  const list = [...names].filter(Boolean).sort();
  tb.innerHTML = list.length ? list.map(n => { const k = invSlug(n), b = invBranchMap[k] || {}; return `<tr><td><b>${srchEsc(n)}</b></td><td><input type="text" id="invbr-code-${srchEsc(k)}" value="${srchEsc(b.code || '')}" placeholder="Hal: BR01" style="width:110px;"></td><td><select id="invbr-co-${srchEsc(k)}">${opts(b.company)}</select></td><td><button class="btn btn-sm btn-success" onclick="invSaveBranchRow('${srchEsc(k)}','${srchEsc(n).replace(/'/g, '&#39;')}')">💾</button></td></tr>`; }).join('') : '<tr><td colspan="4" style="text-align:center;color:#94a3b8;">Wala pang branch user.</td></tr>';
}
async function invSaveBranchRow(key, name) {
  const code = (document.getElementById('invbr-code-' + key) || {}).value.trim().toUpperCase();
  const company = (document.getElementById('invbr-co-' + key) || {}).value;
  if (!code || !company) { alert('Ilagay ang Branch Code at piliin ang Company.'); return; }
  try {
    await db.collection('inventory_branches').doc(key).set({ branch: name, code, company, updatedAt: firebase.firestore.FieldValue.serverTimestamp() });
    invBranchMap[key] = { branch: name, code, company }; invRefreshAdminSelects();
    alert(`✅ Na-save: ${name} → ${code} (${company})`);
  } catch (e) { alert('Error: ' + e.message); }
}
function invProdSearch() {
  const q = (document.getElementById('inv-prod-search') || {}).value || '';
  invPickedProd = null;
  invProdResults = (adminProductsList || []).filter(p => smartMatch(q, p.itemName, p.itemCode, p.sapCode, p.barcode, p.barcodeNumber, p.posCode)).slice(0, 30);
  srchRender('inv-prod-results', invProdResults, p => `<b>${srchEsc(p.itemName)}</b><br><small style="color:#64748b;">${srchEsc(p.sapCode || p.itemCode || p.id)}${p.barcode ? ' · ' + srchEsc(p.barcode) : ''}</small>`, 'invPickProd', 'Walang tugmang produkto.');
}
function invPickProd(i) { const p = invProdResults[i]; if (!p) return; invPickedProd = p; document.getElementById('inv-prod-search').value = p.itemName; document.getElementById('inv-prod-results').style.display = 'none'; }
async function invLoadCompanyItems() {
  const tb = document.getElementById('inv-items-tbody'); if (!tb) return;
  const company = (document.getElementById('inv-company-sel') || {}).value;
  if (!company) { tb.innerHTML = '<tr><td colspan="6" style="text-align:center;color:#94a3b8;">Pumili ng Company.</td></tr>'; return; }
  const snap = await db.collection('inventory_items').where('company', '==', company).get();
  invAdminItems = []; snap.forEach(d => invAdminItems.push({ id: d.id, ...d.data() }));
  invAdminItems.sort((a, b) => String(a.station).localeCompare(String(b.station)) || String(a.itemName).localeCompare(String(b.itemName)));
  const stOpts = cur => invStationsList.concat(invStationsList.includes(cur) ? [] : [cur]).filter(Boolean).map(s => `<option value="${srchEsc(s)}" ${s === cur ? 'selected' : ''}>${srchEsc(s)}</option>`).join('');
  tb.innerHTML = invAdminItems.length ? invAdminItems.map(i => `<tr><td>${srchEsc(i.itemCode)}</td><td>${srchEsc(i.itemName)}</td>
    <td><select onchange="invUpdateItem('${srchEsc(i.id)}','type',this.value)"><option value="kitchen" ${i.type === 'kitchen' ? 'selected' : ''}>🍳 Kitchen</option><option value="wares" ${i.type === 'wares' ? 'selected' : ''}>🥢 Wares</option></select></td>
    <td><select onchange="invUpdateItem('${srchEsc(i.id)}','station',this.value)">${stOpts(i.station)}</select></td>
    <td><input type="text" value="${srchEsc(i.countUOM || '')}" style="width:80px;" onchange="invUpdateItem('${srchEsc(i.id)}','countUOM',this.value)"></td>
    <td><button class="btn btn-sm btn-danger" onclick="invDeleteItem('${srchEsc(i.id)}')">🗑️</button></td></tr>`).join('') : '<tr><td colspan="6" style="text-align:center;color:#94a3b8;">Wala pang item ang company na ito.</td></tr>';
}
async function invAddCompanyItem() {
  const company = (document.getElementById('inv-company-sel') || {}).value;
  const station = (document.getElementById('inv-setup-station') || {}).value;
  const type = (document.getElementById('inv-setup-type') || {}).value || 'kitchen';
  if (!company) { alert('Pumili ng Company.'); return; }
  if (!invPickedProd) { alert('Pumili ng item mula sa listahan ng search.'); return; }
  if (!productForCompany(invPickedProd, company) && !await uiConfirm(`Ang produktong ito ay naka-tag lang sa: ${productCompanies(invPickedProd).join(', ')}. Idagdag pa rin sa ${company}?`)) return;
  if (!station) { alert('Pumili ng Station.'); return; }
  const p = invPickedProd, code = p.sapCode || p.itemCode || p.id;
  try {
    await db.collection('inventory_items').doc(`${company}__${code}`).set({ company, itemCode: code, itemName: p.itemName, type, station, countUOM: p.looseUOM || p.wholeUOM || 'Pcs', updatedAt: firebase.firestore.FieldValue.serverTimestamp() }, { merge: true });
    invPickedProd = null; document.getElementById('inv-prod-search').value = '';
    invLoadCompanyItems();
  } catch (e) { alert('Error: ' + e.message); }
}
async function invUpdateItem(id, field, val) { try { await db.collection('inventory_items').doc(id).update({ [field]: val }); } catch (e) { alert('Error: ' + e.message); } }
async function invDeleteItem(id) { if (!await uiConfirm('Alisin ang item na ito sa listahan ng company?')) return; await db.collection('inventory_items').doc(id).delete(); invLoadCompanyItems(); }
function downloadInvItemsTemplate() { downloadCSVFile('Company,Item_Code,Type,Station,UOM\r\nKNGK,SAP-001,kitchen,Cold Storage,kg\r\nKNGK,SAP-050,wares,Sushi Station,pcs\r\n', 'Inventory_Items_Template.csv'); }
function exportInvItemsCSV() {
  if (!invAdminItems.length) { alert('Walang item na i-e-export. Pumili muna ng Company.'); return; }
  downloadCSVFile(['Company,Item_Code,Type,Station,UOM'].concat(invAdminItems.map(i => [i.company, i.itemCode, i.type, i.station, i.countUOM || ''].map(csvCell).join(','))).join('\r\n'), 'Inventory_Items.csv');
}
async function importInvItemsCSV() {
  const text = await pickCSVFile(); if (!text) return;
  const rows = csvToObjects(text); if (!rows.length) { alert('Walang laman o mali ang CSV.'); return; }
  if (!adminProductsList.length) await loadAdminProducts();
  const byCode = {}; adminProductsList.forEach(p => { byCode[hubKey(p.sapCode)] = p; byCode[hubKey(p.itemCode || p.id)] = p; });
  let ok = 0; const bad = [];
  let batch = db.batch(), n = 0;
  const newCo = new Set(), newSt = new Set();
  for (const [i, r] of rows.entries()) {
    const p = byCode[hubKey(r.item_code)]; const company = (r.company || '').trim(); const station = (r.station || '').trim();
    if (!p || !company || !station) { bad.push(`Row ${i + 2}: ${!p ? 'walang produktong ' + r.item_code : 'kulang ang Company/Station'}`); continue; }
    const code = p.sapCode || p.itemCode || p.id;
    batch.set(db.collection('inventory_items').doc(`${company}__${code}`), { company, itemCode: code, itemName: p.itemName, type: /ware/i.test(r.type) ? 'wares' : 'kitchen', station, countUOM: r.uom || p.looseUOM || p.wholeUOM || 'Pcs', updatedAt: firebase.firestore.FieldValue.serverTimestamp() }, { merge: true });
    newCo.add(company); newSt.add(station); ok++;
    if (++n % 400 === 0) { await batch.commit(); batch = db.batch(); }
  }
  try {
    await batch.commit();
    for (const c of newCo) if (!invCompaniesList.includes(c)) await addMasterEntry('companies', c);
    for (const s of newSt) if (!invStationsList.includes(s)) await addMasterEntry('inv_stations', s);
    await logSystemAction('INV_ITEMS_IMPORTED', `Nag-import ng ${ok} inventory item`);
    alert(`✅ Na-import ang ${ok} item.` + (bad.length ? `\n\n⚠️ ${bad.length} row ang nilaktawan:\n` + bad.slice(0, 8).join('\n') : ''));
    await invLoadMasters(); invRefreshAdminSelects(); invLoadCompanyItems();
  } catch (e) { alert('Error: ' + e.message); }
}
async function invLoadCounts() {
  const tb = document.getElementById('inv-counts-tbody'); if (!tb) return;
  const from = document.getElementById('inv-rep-from').value, to = document.getElementById('inv-rep-to').value, br = document.getElementById('inv-rep-branch').value;
  tb.innerHTML = '<tr><td colspan="8" style="text-align:center;">Kinukuha...</td></tr>';
  try {
    const snap = await db.collection('inventory_counts').where('countDate', '>=', from).where('countDate', '<=', to).get();
    const list = []; snap.forEach(d => { const x = { id: d.id, ...d.data() }; invCountsCache[d.id] = x; if (!br || x.branch === br) list.push(x); });
    list.sort((a, b) => String(b.countDate).localeCompare(String(a.countDate)) || String(a.branch).localeCompare(String(b.branch)));
    tb.innerHTML = list.length ? list.map(c => invCountRowHtml(c, true)).join('') : '<tr><td colspan="8" style="text-align:center;color:#94a3b8;">Walang inventory sa napiling petsa.</td></tr>';
  } catch (e) { tb.innerHTML = `<tr><td colspan="8">Error: ${srchEsc(e.message)}</td></tr>`; }
}
async function approveInvCount(id) {
  const c = invCountsCache[id]; if (!c) return;
  if (!await uiConfirm(`I-approve at i-receive ang inventory ng ${c.branch} — ${c.station} (${c.countDate})? Pagkatapos nito, hindi na ito mababago ng branch.`)) return;
  try {
    const u = getCurrentUser() || {};
    await db.collection('inventory_counts').doc(id).update({ status: 'approved', approvedBy: u.name || u.email || 'Admin', approvedByEmail: u.email || '', approvedAt: firebase.firestore.FieldValue.serverTimestamp() });
    c.status = 'approved'; c.approvedBy = u.name || u.email; c.approvedAt = new Date().toISOString();
    try { await logSystemAction('INVENTORY_APPROVED', `${id} na-approve ni ${u.email}`); } catch (e) {}
    invLoadCounts();
  } catch (e) { alert('Error: ' + e.message); }
}
// pinakahuling bilang ng item sa branch hanggang sa isang petsa
function invLatestQty(sortedDesc, code, date, station) {
  for (const c of sortedDesc) { if (c.countDate > date) continue; if (station && c.station !== station) continue; const l = (c.lines || []).find(x => x.itemCode === code && x.qty != null); if (l) return { qty: l.qty, date: c.countDate }; }
  return null;
}
async function invLoadMatrix() {
  const company = document.getElementById('inv-mx-company').value, date = document.getElementById('inv-mx-date').value, type = document.getElementById('inv-mx-type').value;
  const tbl = document.getElementById('inv-mx-table');
  if (!company) { alert('Pumili ng Company.'); return; }
  const branches = Object.values(invBranchMap).filter(b => b.company === company).sort((a, b) => String(a.code).localeCompare(String(b.code)));
  if (!branches.length) { alert('Walang branch na naka-set sa company na ito (Setup → Branch → Code at Company).'); return; }
  const [iSnap, cSnap] = await Promise.all([db.collection('inventory_items').where('company', '==', company).get(), db.collection('inventory_counts').where('countDate', '<=', date).get()]);
  const items = []; iSnap.forEach(d => { const x = d.data(); if (!type || x.type === type) items.push(x); });
  items.sort((a, b) => String(a.station).localeCompare(String(b.station)) || String(a.itemName).localeCompare(String(b.itemName)));
  const byBr = {}; cSnap.forEach(d => { const x = d.data(); (byBr[x.branchCode] = byBr[x.branchCode] || []).push(x); });
  Object.values(byBr).forEach(a => a.sort((x, y) => String(y.countDate).localeCompare(String(x.countDate))));
  tbl.innerHTML = `<thead><tr><th>Inventory ID</th><th>Item</th><th>Uri</th><th>Station</th>${branches.map(b => `<th>${srchEsc(b.code)}<br><small>${srchEsc(b.branch)}</small></th>`).join('')}</tr></thead><tbody>${items.map(it => `<tr><td>${srchEsc(it.itemCode)}</td><td>${srchEsc(it.itemName)}</td><td>${INV_TYPES[it.type] || ''}</td><td>${srchEsc(it.station)}</td>${branches.map(b => { const r = invLatestQty(byBr[b.code] || [], it.itemCode, date); return `<td title="${r ? 'Bilang noong ' + srchEsc(r.date) : ''}">${r ? '<b>' + srchEsc(r.qty) + '</b>' : '—'}</td>`; }).join('')}</tr>`).join('') || `<tr><td colspan="${4 + branches.length}" style="text-align:center;color:#94a3b8;">Walang item.</td></tr>`}</tbody>`;
}
async function invLoadVariance() {
  const brName = document.getElementById('inv-var-branch').value, a = document.getElementById('inv-var-a').value, b = document.getElementById('inv-var-b').value, st = document.getElementById('inv-var-station').value;
  const tb = document.getElementById('inv-var-tbody');
  if (!brName || !a || !b) { alert('Pumili ng Branch at dalawang petsa.'); return; }
  if (a > b) { alert('Dapat mas maaga ang Petsa A kaysa Petsa B.'); return; }
  const br = Object.values(invBranchMap).find(x => x.branch === brName); if (!br) return;
  const snap = await db.collection('inventory_counts').where('branchCode', '==', br.code).get();
  const counts = []; snap.forEach(d => counts.push(d.data()));
  counts.sort((x, y) => String(y.countDate).localeCompare(String(x.countDate)));
  const meta = {};
  counts.forEach(c => (c.lines || []).forEach(l => { if (!meta[l.itemCode]) meta[l.itemCode] = { name: l.itemName, uom: l.uom, station: c.station }; }));
  const rows = Object.keys(meta).map(code => {
    const m = meta[code]; if (st && m.station !== st) return null;
    const A = invLatestQty(counts, code, a, st), B = invLatestQty(counts, code, b, st);
    return { code, ...m, A, B, diff: (A && B) ? B.qty - A.qty : null };
  }).filter(Boolean).sort((x, y) => (x.diff == null) - (y.diff == null) || (x.diff || 0) - (y.diff || 0));
  tb.innerHTML = rows.length ? rows.map(r => `<tr><td>${srchEsc(r.code)}</td><td>${srchEsc(r.name)}</td><td>${srchEsc(r.uom)}</td><td>${srchEsc(r.station)}</td><td>${r.A ? srchEsc(r.A.qty) + ` <small style="color:#94a3b8;">(${srchEsc(r.A.date)})</small>` : '—'}</td><td>${r.B ? srchEsc(r.B.qty) + ` <small style="color:#94a3b8;">(${srchEsc(r.B.date)})</small>` : '—'}</td><td style="font-weight:800;color:${r.diff == null ? '#94a3b8' : r.diff < 0 ? '#dc2626' : r.diff > 0 ? '#059669' : '#475569'};">${r.diff == null ? '—' : (r.diff > 0 ? '+' : '') + +r.diff.toFixed(4)}</td></tr>`).join('') : '<tr><td colspan="7" style="text-align:center;color:#94a3b8;">Walang bilang sa branch na ito.</td></tr>';
}
async function invLoadRequests() {
  const tb = document.getElementById('inv-req-tbody'); if (!tb) return;
  try {
    const snap = await db.collection('inventory_item_requests').get();
    const list = []; snap.forEach(d => list.push({ id: d.id, ...d.data() }));
    list.sort((a, b) => (a.status === 'pending' ? 0 : 1) - (b.status === 'pending' ? 0 : 1));
    tb.innerHTML = list.length ? list.map(r => `<tr><td>${srchEsc(r.tmpCode)}</td><td><b>${srchEsc(r.name)}</b></td><td>${srchEsc(r.uom)}</td><td>${srchEsc(r.branch)}<br><small>${srchEsc(r.branchCode)} · ${srchEsc(r.company)}</small></td><td>${srchEsc(r.firstSeenDate)}</td><td>${r.status === 'done' ? `<span class="badge badge-success">SAP: ${srchEsc(r.sapCode)}</span>` : '<span class="badge badge-warning">Pending</span>'}</td><td style="white-space:nowrap;">${r.status === 'done' ? '' : `<button class="btn btn-sm btn-primary" onclick="invRequestOpenProduct('${srchEsc(r.id)}')">➕ Gumawa ng Product</button> <button class="btn btn-sm btn-success" onclick="invRequestDone('${srchEsc(r.id)}')">✔ Tapos na (SAP code)</button>`}</td></tr>`).join('') : '<tr><td colspan="7" style="text-align:center;color:#94a3b8;">Walang request.</td></tr>';
    invLoadRequests.list = list;
  } catch (e) { tb.innerHTML = `<tr><td colspan="7">Error: ${srchEsc(e.message)}</td></tr>`; }
}
async function invRequestOpenProduct(id) {
  const r = (invLoadRequests.list || []).find(x => x.id === id); if (!r) return;
  await openAdminProductModal(); const n = document.getElementById('admin-item-name'); if (n) n.value = r.name;
}
async function invRequestDone(id) {
  const r = (invLoadRequests.list || []).find(x => x.id === id); if (!r) return;
  const code = (await uiPrompt(`SAP code na ibinigay para sa "${r.name}":`) || '').trim(); if (!code) return;
  try {
    await db.collection('inventory_item_requests').doc(id).update({ status: 'done', sapCode: code, doneAt: firebase.firestore.FieldValue.serverTimestamp() });
    await db.collection('inventory_items').doc(`${r.company}__${code}`).set({ company: r.company, itemCode: code, itemName: r.name, type: 'wares', station: invStationsList[0] || 'Unassigned', countUOM: r.uom || 'Pcs', updatedAt: firebase.firestore.FieldValue.serverTimestamp() }, { merge: true });
    alert('✅ Naka-link na. Naidagdag ito sa inventory list ng company (Wares, unang station). Baguhin sa Setup kung kailangan. Mananatili sa mga nakaraang count ang temp code.');
    invLoadRequests();
  } catch (e) { alert('Error: ' + e.message); }
}

// ---- Hook ng larawan sa product forms ----
(function invHookPhotoForms() {
  const wrap = (name, inputId, previewId, codeId) => {
    const orig = window[name]; if (typeof orig !== 'function') return;
    window[name] = async function (id) {
      const r = await orig.apply(this, arguments);
      const f = document.getElementById(inputId); if (f) f.value = '';
      const pv = document.getElementById(previewId); if (pv) { pv.style.display = 'none'; pv.removeAttribute('src'); }
      if (id) invLoadPhotoPreview(id, previewId);
      return r;
    };
  };
  wrap('openAdminProductModal', 'admin-item-photo', 'admin-item-photo-preview');
  wrap('openCommissaryProductModal', 'new-item-photo', 'new-item-photo-preview');
})();


// ========================================================
// 🏢 COMPANY MANAGEMENT (KNGK, Tanoshi, atbp.) at ang relasyon ng Company sa Produkto at Branch
// Ang produkto ay puwedeng i-tag sa isa o higit pang company. Walang tag = gamit ng LAHAT ng company.
// Ang branch ay nakatali sa Company (Admin → Branch Inventory → Setup). Ang catalog ng branch ay ayon sa company niya.
// ========================================================
let companyDocs = [];
function empCompanyList(e) {
  if (e && Array.isArray(e.companies) && e.companies.length) return e.companies.filter(Boolean);
  return String((e && e.company) || '').split(/[,\/]/).map(x => x.trim()).filter(Boolean);
}
function productCompanies(p) { return Array.isArray(p && p.companies) ? p.companies.filter(Boolean) : []; }
function productForCompany(p, company) {
  const t = productCompanies(p);
  return !company || !t.length || t.some(c => hubKey(c) === hubKey(company));
}
function companyChipsHtml(p) {
  const t = productCompanies(p);
  return t.length ? '<div style="margin-top:3px;">' + t.map(c => `<span class="co-chip">🏢 ${srchEsc(c)}</span>`).join('') + '</div>' : '<div style="margin-top:3px;"><span class="co-chip co-all">Lahat ng company</span></div>';
}
async function renderCompanyChecks(containerId, selected) {
  const el = document.getElementById(containerId); if (!el) return;
  let names = [];
  try { (await db.collection('companies').get()).forEach(d => names.push(d.data().name || d.id)); } catch (e) {}
  names = [...new Set(names.concat(selected || []))].sort((a, b) => a.localeCompare(b));
  if (!names.length) { el.innerHTML = '<small style="color:#94a3b8;">Wala pang Company. Idagdag sa Admin → Company Management.</small>'; return; }
  const sel = new Set((selected || []).map(hubKey));
  el.innerHTML = names.map(n => `<label class="co-check"><input type="checkbox" value="${srchEsc(n)}" ${sel.has(hubKey(n)) ? 'checked' : ''}> ${srchEsc(n)}</label>`).join('');
}
function readCompanyChecks(containerId) {
  const el = document.getElementById(containerId); if (!el) return undefined;
  return [...el.querySelectorAll('input[type=checkbox]:checked')].map(i => i.value);
}
(function hookCompanyChecks() {
  const wrap = (name, containerId, finder) => {
    const orig = window[name]; if (typeof orig !== 'function') return;
    window[name] = async function (id) {
      const r = await orig.apply(this, arguments);
      const p = id ? finder(id) : null;
      renderCompanyChecks(containerId, p ? productCompanies(p) : (name === 'openAdminProductModal' && apCompany && apCompany !== '__none' ? [apCompany] : []));
      return r;
    };
  };
  wrap('openAdminProductModal', 'admin-item-companies', id => (adminProductsList || []).find(p => p.id === id));
  wrap('openCommissaryProductModal', 'new-item-companies', id => (typeof currentInventory !== 'undefined' ? currentInventory : []).find(p => p.id === id));
})();

// ================= Company → Branch → Station → Empleyado (istruktura) =================
async function hrFillBranches(selected) {
  const sel = document.getElementById('hr-emp-branch'); if (!sel) return;
  try { if (!window.__hrBranches) { window.__hrBranches = []; (await db.collection('inventory_branches').get()).forEach(d => window.__hrBranches.push(d.data())); window.__hrBranches.sort((a, b) => String(a.company || '').localeCompare(String(b.company || '')) || String(a.branch).localeCompare(String(b.branch))); } } catch (e) {}
  sel.innerHTML = '<option value="">(Walang branch / Head Office)</option>' + (window.__hrBranches || []).map(b => `<option value="${srchEsc(b.code || b.branch)}" data-name="${srchEsc(b.branch || '')}" ${String(b.code || b.branch) === String(selected) ? 'selected' : ''}>${srchEsc(b.company || '?')} — ${srchEsc(b.code || '')} ${srchEsc(b.branch || '')}</option>`).join('');
}
async function companyTreeOpen() {
  arModal('<div style="padding:1rem;">⏳ Binubuo ang istruktura...</div>');
  try {
    const [cS, bS, mS, iS, eS] = await Promise.all([db.collection('companies').get(), db.collection('inventory_branches').get(), db.collection('inventory_station_map').get(), db.collection('inventory_items').get(), db.collection('employees').get()]);
    const cos = [], brs = [], maps = {}, items = [], emps = []; cS.forEach(d => cos.push({ id: d.id, ...d.data() })); bS.forEach(d => brs.push(d.data())); mS.forEach(d => maps[d.id] = d.data()); iS.forEach(d => items.push(d.data())); eS.forEach(d => emps.push({ id: d.id, ...d.data() }));
    cos.sort((a, b) => String(a.name).localeCompare(String(b.name)));
    const empName = e => e.name || [e.fname, e.lname].filter(Boolean).join(' ') || e.email || e.id;
    const empCos = e => (Array.isArray(e.companies) && e.companies.length ? e.companies : String(e.company || '').split(',')).map(x => String(x).trim()).filter(Boolean);
    const stationsOf = b => { const m = maps[invSlug(b.code || b.branch)]; if (m && m.stations) return Object.keys(m.stations).sort(invNatSort).map(k => [k, (m.stations[k] || []).length]); const cnt = {}; items.filter(i => hubKey(i.company) === hubKey(b.company) && i.station).forEach(i => cnt[i.station] = (cnt[i.station] || 0) + 1); return Object.keys(cnt).sort(invNatSort).map(k => [k, cnt[k]]); };
    const chip = (t, c) => `<span style="display:inline-block;background:${c || '#e2e8f0'};border-radius:999px;padding:1px 8px;margin:1px;font-size:.75rem;">${t}</span>`;
    const html = cos.map(c => {
      const ce = emps.filter(e => empCos(e).some(x => hubKey(x) === hubKey(c.name))); const cb = brs.filter(b => hubKey(b.company) === hubKey(c.name));
      const noBr = ce.filter(e => !e.branchCode);
      return `<div style="border:1px solid #cbd5e1;border-radius:.5rem;margin-bottom:.8rem;overflow:hidden;"><div style="background:#0f172a;color:#fff;padding:.5rem .8rem;font-weight:800;">🏢 ${srchEsc(c.name)}${c.legalName ? ` <small style="font-weight:400;">· ${srchEsc(c.legalName)}</small>` : ''} <small style="font-weight:400;float:right;">${cb.length} branch · ${ce.length} empleyado</small></div><div style="padding:.6rem .8rem;">
        ${cb.map(b => { const be = ce.filter(e => String(e.branchCode) === String(b.code || b.branch)), st = stationsOf(b); return `<div style="border-left:3px solid #2563eb;padding-left:.6rem;margin-bottom:.6rem;"><b>🏪 ${srchEsc(b.code || '')} ${srchEsc(b.branch || '')}</b> <small style="color:#64748b;">${be.length} empleyado · ${st.length} station</small><div style="margin:.2rem 0;">📍 ${st.map(x => chip(srchEsc(x[0]) + ' (' + x[1] + ')', '#dbeafe')).join('') || '<small style="color:#94a3b8;">Wala pang station</small>'}</div><div>👥 ${be.map(e => chip(srchEsc(empName(e)), '#dcfce7')).join('') || '<small style="color:#94a3b8;">Walang empleyadong naka-assign</small>'}</div></div>`; }).join('') || '<small style="color:#94a3b8;">Wala pang branch.</small>'}
        ${noBr.length ? `<div style="border-left:3px solid #94a3b8;padding-left:.6rem;"><b>🏛️ Head Office / Walang branch</b><div>👥 ${noBr.map(e => chip(srchEsc(empName(e)), '#f1f5f9')).join('')}</div></div>` : ''}</div></div>`;
    }).join('') || '<div>Wala pang company.</div>';
    const orphan = emps.filter(e => !empCos(e).length);
    window.__treeHtml = `<h1>Istruktura ng Company</h1><div class="meta">${printedByLine()}</div>` + html;
    arModal(`<h3>🌳 Company → Branch → Station</h3><p style="font-size:.82rem;color:#64748b;">Ang bawat company ay may sariling branch; ang bawat branch ay may sariling station at empleyado. Ang empleyado ay itinatalaga sa company (at branch) sa HR → Employee form.</p><div style="max-height:60vh;overflow:auto;">${html}${orphan.length ? `<div style="color:#b45309;font-size:.82rem;">⚠️ ${orphan.length} empleyado ang walang company: ${orphan.slice(0, 15).map(e => srchEsc(empName(e))).join(', ')}${orphan.length > 15 ? '…' : ''}</div>` : ''}</div><div style="margin-top:.6rem;"><button class="btn btn-secondary" onclick="printHtmlDoc('Istruktura ng Company', window.__treeHtml)">🖨️ Print</button></div>`);
  } catch (e) { arModal('<div style="padding:1rem;color:#dc2626;">Error: ' + srchEsc(e.message) + '</div>'); }
}
// ===== 🧪 BOM Management (per Company) =====
let bmS = { company: '', companies: [], sap: {}, prod: [], boms: {}, items: {}, q: '' }, bmDraft = null, bmQ = '', bmInactive = false;
function bmRoot() { return document.getElementById('bom-mgmt-root'); }
function bmRaw(x) { return String(x.invUom || x.purchUom || '').toUpperCase(); }
function bmCostPerUnit(x) { const per = x.invUom && String(x.invUom).toUpperCase() !== String(x.purchUom || '').toUpperCase() && +x.perPurchase > 1 ? +x.perPurchase : 1; return (+x.lastPrice || 0) / per; }
// laman ng 1 count-unit ng sangkap, sa g o ml (galing sa UOM o sa pangalan hal. "(25KG/PACK)")
function bmContent(x) {
  const u = bmRaw(x), T = { KG: ['w', 1000], KGS: ['w', 1000], G: ['w', 1], GM: ['w', 1], GRAM: ['w', 1], GRAMS: ['w', 1], L: ['v', 1000], LTR: ['v', 1000], LITER: ['v', 1000], LITERS: ['v', 1000], ML: ['v', 1] }; if (T[u]) return { k: T[u][0], n: T[u][1] };
  const m = /\((\d+(?:\.\d+)?)\s*(KGS?|GRAMS?|GMS?|G|LTR|LITERS?|L|ML)\s*\//i.exec(x.itemName || ''); if (!m) return null; const q = +m[1], k = m[2].toUpperCase(); if (/^KG/.test(k)) return { k: 'w', n: q * 1000 }; if (/^(G|GM|GRAM)/.test(k)) return { k: 'w', n: q }; if (/^(L|LTR|LITER)/.test(k)) return { k: 'v', n: q * 1000 }; return { k: 'v', n: q };
}
function bmFactor(x, q, unit) { const u = BOM_UNITS[String(unit || '').toLowerCase()]; if (!u) return { f: q }; const c = bmContent(x); if (!c || c.k !== u[0]) return { err: `Hindi ma-convert ang ${unit} papunta sa UOM ng "${x.itemName}" (${x.invUom || x.purchUom || '?'}). Piliin ang "pcs/iba" at ilagay ang dami sa UOM nito.` }; return { f: q * u[1] / c.n }; }
async function loadBomMgmt() {
  const root = bmRoot(); if (!root || !db) return;
  try { if (!bmS.companies.length) { const c = await db.collection('companies').get(); c.forEach(d => bmS.companies.push(d.data().name || d.id)); bmS.companies.sort(); } if (!bmS.company) bmS.company = bmS.companies[0] || '';
    bmS.sap = {}; bmS.prod = []; bmS.boms = {}; bmS.items = {};
    if (bmS.company) { const [sp, bm, it, pr, cs] = await Promise.all([db.collection('sap_items').where('company', '==', bmS.company).get(), db.collection('inventory_bom').doc('company_' + invSlug(bmS.company)).get(), db.collection('inventory_items').where('company', '==', bmS.company).get(), db.collection('products').get(), db.collection('inventory_costs').doc('company_' + invSlug(bmS.company)).get().catch(() => null)]);
      sp.forEach(d => { const x = d.data(); bmS.sap[x.itemCode] = x; }); if (bm.exists) bmS.boms = bm.data().boms || {}; it.forEach(d => { const x = d.data(); bmS.items[x.itemCode] = x; });
      // Ang pamimilian ng sangkap ay ang PRODUCT MASTER ng company (hindi ang SAP). Ang SAP ay panghanap lang ng presyo/UOM kapag magkapareho ang code.
      const costs = cs && cs.exists ? (cs.data().costs || {}) : {};
      pr.forEach(d => { const p = d.data(), code = String(p.sapCode || p.itemCode || d.id || '').trim(); if (!code || !productCompanies(p).some(c => hubKey(c) === hubKey(bmS.company))) return; const sp0 = bmS.sap[code] || {};
        const e = Object.assign({}, sp0, { itemCode: code, itemName: p.itemName || sp0.itemName || code, posCode: p.posCode || '', isProd: true, active: p.active !== false && sp0.active !== false });
        if (!e.invUom && !e.purchUom) { e.invUom = p.looseUOM || p.wholeUOM || ''; e.purchUom = e.invUom; } if (!(+e.lastPrice > 0) && +costs[code] > 0) { e.lastPrice = +costs[code]; e.perPurchase = 1; e.purchUom = e.invUom; }
        bmS.sap[code] = e; bmS.prod.push(e); });
      { const have = new Set(bmS.prod.map(x => x.itemCode)); Object.keys(bmS.sap).forEach(code => { if (have.has(code)) return; const x = bmS.sap[code]; if (!x || !x.itemName) return; x.fromSap = true; bmS.prod.push(x); }); }
      bmAddBomIngredients();
      bmS.prod.sort((a, b) => String(a.itemName).localeCompare(String(b.itemName))); }
    bmRender();
  } catch (e) { root.innerHTML = `<div class="card" style="color:#dc2626;">Error: ${srchEsc(e.message)}</div>`; }
}
// Ang bawat naka-save na BOM ay awtomatikong sangkap na rin (prep item) sa ibang BOM; ang halaga/gramo ay galing sa gastos ÷ nagagawa.
function bmUses(code, target, seen) { seen = seen || {}; if (seen[code]) return false; seen[code] = 1; const e = bmS.boms[code]; if (!e) return false; return invBomComps(e).some(b => b.raw === target || (b.raw && bmS.boms[b.raw] && bmUses(b.raw, target, seen))); }
function bmAddBomIngredients() {
  const codes = Object.keys(bmS.boms), cost = {};
  for (let pass = 0; pass < 3; pass++) codes.forEach(c => {
    const e = bmS.boms[c], T = invBomTotals(e), base = T.out ? T.out.base : (T.w || T.v), kind = T.out ? T.out.kind : (T.w ? 'w' : 'v'); let tot = 0; invBomComps(e).forEach(b => { tot += bmCompCost(b); });
    const x = { itemCode: c, itemName: (e.name || c) + ' (BOM)', isBom: true, isProd: true, active: true, posCode: 'BOM', bomCostBatch: tot };
    if (base > 0) { x.invUom = kind === 'v' ? 'ML' : 'G'; x.purchUom = x.invUom; x.lastPrice = tot / base; x.perPurchase = 1; } else { x.invUom = 'BATCH'; x.purchUom = 'BATCH'; x.lastPrice = tot; x.perPurchase = 1; }
    bmS.sap[c] = x; cost[c] = x; });
  codes.forEach(c => { const have = bmS.prod.findIndex(p => p.itemCode === c); if (have >= 0) bmS.prod.splice(have, 1); bmS.prod.push(cost[c]); });
}
function bmCustomCost(b) {
  if (!b.custom) return 0; const q = +b.qty || 0, pp = +b.price || 0, y = (+b.yield > 0 ? +b.yield : 100) / 100, pu = String(b.priceUnit || '').toLowerCase(), u = String(b.unit || '').toLowerCase();
  if (u === pu) return q * pp / y; const A = BOM_UNITS[u], B = BOM_UNITS[pu]; if (A && B && A[0] === B[0]) return q * A[1] / B[1] * pp / y; return 0;
}
function bmCompCost(b) { if (b.custom) return bmCustomCost(b); if (b.free || !b.raw) return 0; const x = bmS.sap[b.raw]; return x ? (+b.factor || 0) * bmCostPerUnit(x) / ((+b.yield > 0 ? +b.yield : 100) / 100) : 0; }
function bmTotals(e) { let cost = 0; invBomComps(e).forEach(b => { cost += bmCompCost(b); }); return cost; }
function bmRender() {
  const root = bmRoot(), S = bmS, q = bmQ.trim(); const codes = Object.keys(S.boms).filter(c => !q || smartMatch(q, S.boms[c].name || (S.items[c] || {}).itemName || c, c)).sort((a, b) => String(S.boms[a].name || a).localeCompare(String(S.boms[b].name || b)));
  const rows = codes.map(c => { const e = S.boms[c], cs = invBomComps(e), cost = bmTotals(e), T = invBomTotals(e), out = T.out ? T.out.base : (T.w || T.v); return `<tr data-crud-row><td><b>${bmSecret(e) ? '🔒 ' : ''}${srchEsc(e.name || (S.items[c] || {}).itemName || c)}</b><br><small style="color:#64748b;">${srchEsc(c)} · bilang sa ${srchEsc(e.uom || (S.items[c] || {}).countUOM || '—')}</small></td><td>${bmSecret(e) && !bmCanSee(c, e) ? '🔒 <b>Secret recipe</b><br><small style="color:#64748b;">nakatago ang mga sangkap</small>' : cs.length + ' sangkap<br><small>' + invBomSummary(e, cs) + '</small>'}</td><td style="text-align:right;">₱${invMoney(cost)}${out ? `<br><small style="color:#64748b;">₱${invMoney(cost / (out / 1000))}/kg o L</small>` : ''}</td><td style="white-space:nowrap;"><button class="btn btn-sm btn-secondary" onclick="bmView('${srchEsc(c)}')">👁</button> <button class="btn btn-sm btn-primary" onclick="bmForm('${srchEsc(c)}')">✏️</button> <button class="btn btn-sm btn-secondary" onclick="bmCopy('${srchEsc(c)}')" title="Kopyahin">📋</button> <button class="btn btn-sm btn-danger" onclick="bmDelete('${srchEsc(c)}')">🗑</button></td></tr>`; }).join('') || '<tr><td colspan="4" style="text-align:center;color:#94a3b8;">Wala pang BOM sa company na ito. I-click ang ➕ Bagong BOM.</td></tr>';
  root.innerHTML = `<div class="card"><div class="card-title"><span>🧪 BOM Management (per Company)</span></div>${S.companies.length ? '' : '<p style="color:#b45309;">Wala pang company. Gumawa muna sa 🏢 Company Management.</p>'}
  <div style="display:flex;gap:.4rem;flex-wrap:wrap;align-items:end;margin-bottom:.6rem;"><div><label style="font-weight:700;">Company</label><br><select onchange="bmS.company=this.value;bmQ='';loadBomMgmt()">${S.companies.map(c => `<option ${c === S.company ? 'selected' : ''}>${srchEsc(c)}</option>`).join('')}</select></div><input type="search" placeholder="🔍 Hanapin ang BOM..." value="${srchEsc(bmQ)}" oninput="bmQ=this.value;bmRender();var i=document.querySelector('#bom-mgmt-root input[type=search]');i.focus();i.setSelectionRange(i.value.length,i.value.length)" style="min-width:220px;"><button class="btn btn-success" onclick="bmForm('')">➕ Bagong BOM</button></div>
  <small style="color:#64748b;">Ang mga sangkap ay kinukuha sa 📒 SAP Item Master ng company (${Object.keys(S.sap).length} item, kasama ang may Last Purchase Price). Ang presyo ay galing sa Last Purchase Price. Sa Count Result, ang nabilang na prep item ay idinadagdag sa raw na bilang bilang “From BOM”.</small>
  <div class="table-responsive" style="margin-top:.6rem;"><table data-notools="1"><thead><tr><th>Prep / BOM</th><th>Sangkap · Kabuuan</th><th style="text-align:right;">Gastos / batch</th><th></th></tr></thead><tbody>${rows}</tbody></table></div></div>`;
}
function bmView(code) {
  const S = bmS, e = S.boms[code]; if (!e) return; const cs = invBomComps(e), pr = canSeeBomCost();
  if (!bmCanSee(code, e)) { arModal(`<h3>🔒 ${srchEsc(e.name || code)}</h3><p style="font-size:.9rem;color:#475569;">Secret recipe ito. Nakatago ang mga sangkap at dami. Ang gastos, at ang pagbabawas sa inventory kapag nabenta/ginawa, ay tuloy pa rin.</p>${pr ? `<div style="background:#f0f9ff;padding:.5rem .7rem;border-radius:8px;margin:.5rem 0;">💰 Gastos / batch: <b>₱${invMoney(bmTotals(e))}</b></div>` : ''}<button class="btn btn-primary" onclick="bmViewUnlock('${srchEsc(code)}')">🔓 Ilagay ang password</button>`); return; }
  arModal(`<h3>🧪 ${srchEsc(e.name || code)}</h3><p style="font-size:.85rem;color:#64748b;">${srchEsc(code)} · ${srchEsc(S.company)} · ${invBomMode(e) === 'add' ? '➕ Idinadagdag sa raw (From BOM)' : '➖ Ibinabawas sa raw'}</p><div style="background:#f0f9ff;padding:.5rem .7rem;border-radius:8px;margin-bottom:.5rem;">📏 ${invBomSummary(e, cs) || '—'}</div><table data-notools="1"><thead><tr><th>Sangkap</th><th style="text-align:right;">Dami</th>${pr ? '<th style="text-align:right;">Gastos</th>' : ''}</tr></thead><tbody>${cs.map(b => { const x = S.sap[b.raw]; const c = bmCompCost(b); return `<tr><td>${b.custom ? '🧪 ' + srchEsc(b.name) + ' <small style="color:#b45309;">(R&D)</small>' : b.free ? '💧 ' + srchEsc(b.name || 'Iba pa') : srchEsc(b.rawName || (x && x.itemName) || b.raw) + '<br><small style="color:#64748b;">' + srchEsc(b.raw) + '</small>'}</td><td style="text-align:right;">${srchEsc(b.qty || '')} ${srchEsc(b.unit || '')}${+b.yield > 0 && +b.yield < 100 ? '<br><small>yield ' + +b.yield + '%</small>' : ''}</td>${pr ? `<td style="text-align:right;">${b.free ? '—' : '₱' + invMoney(c)}</td>` : ''}</tr>`; }).join('')}</tbody></table>${pr ? `<p style="text-align:right;"><b>Kabuuang gastos / batch: ₱${invMoney(bmTotals(e))}</b></p>` : ''}<button class="btn btn-secondary" onclick="bmPrint('${srchEsc(code)}')">🖨️ Print</button>`);
}
// ===== 🔒 Secret recipe: nakatago ang mga sangkap; kita pa rin ang costing at tuloy ang inventory deduction =====
const bmUnlocked = {};
function bmMe() { return String((getCurrentUser() || {}).email || '').toLowerCase(); }
function bmSecret(e) { return !!(e && e.secret && e.secret.hash); }
function bmIsOwner(e) { return bmSecret(e) && String(e.secret.owner || '').toLowerCase() === bmMe(); }
function bmKey(code) { return String(bmS.company || (typeof invBomD !== 'undefined' && invBomD && invBomD.company) || '') + '|' + code; }
function bmCanSee(code, e) { e = e || bmS.boms[code]; return !bmSecret(e) || bmIsOwner(e) || !!bmUnlocked[bmKey(code)]; }
function bmSha256(str) { // pure-JS SHA-256 (fallback kapag walang crypto.subtle, hal. http/file)
  const m = new TextEncoder().encode(str), K = [], H = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19]; let pr = 2, n = 0;
  while (n < 64) { let ok = true; for (let i = 2; i * i <= pr; i++) if (pr % i === 0) { ok = false; break; } if (ok) { K[n++] = (Math.pow(pr, 1 / 3) * 4294967296) | 0; } pr++; }
  const L = m.length, nb = ((L + 9 + 63) >> 6) << 6, w = new Uint8Array(nb); w.set(m); w[L] = 0x80; const dv = new DataView(w.buffer); dv.setUint32(nb - 4, (L * 8) >>> 0); dv.setUint32(nb - 8, Math.floor(L * 8 / 4294967296));
  const rr = (x, k) => (x >>> k) | (x << (32 - k));
  for (let o = 0; o < nb; o += 64) { const W = new Array(64); for (let i = 0; i < 16; i++) W[i] = dv.getUint32(o + i * 4); for (let i = 16; i < 64; i++) { const s0 = rr(W[i - 15], 7) ^ rr(W[i - 15], 18) ^ (W[i - 15] >>> 3), s1 = rr(W[i - 2], 17) ^ rr(W[i - 2], 19) ^ (W[i - 2] >>> 10); W[i] = (W[i - 16] + s0 + W[i - 7] + s1) | 0; }
    let [a, b, c, d, e, f, g, h] = H; for (let i = 0; i < 64; i++) { const S1 = rr(e, 6) ^ rr(e, 11) ^ rr(e, 25), ch = (e & f) ^ (~e & g), t1 = (h + S1 + ch + K[i] + W[i]) | 0, S0 = rr(a, 2) ^ rr(a, 13) ^ rr(a, 22), mj = (a & b) ^ (a & c) ^ (b & c), t2 = (S0 + mj) | 0; h = g; g = f; f = e; e = (d + t1) | 0; d = c; c = b; b = a; a = (t1 + t2) | 0; }
    H[0] = (H[0] + a) | 0; H[1] = (H[1] + b) | 0; H[2] = (H[2] + c) | 0; H[3] = (H[3] + d) | 0; H[4] = (H[4] + e) | 0; H[5] = (H[5] + f) | 0; H[6] = (H[6] + g) | 0; H[7] = (H[7] + h) | 0; }
  return H.map(x => (x >>> 0).toString(16).padStart(8, '0')).join('');
}
async function bmHash(pw, salt) { const t = salt + '|' + pw; try { if (window.crypto && crypto.subtle) { const h = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(t)); return [...new Uint8Array(h)].map(x => x.toString(16).padStart(2, '0')).join(''); } } catch (e) {} return bmSha256(t); }
async function bmUnlock(code, e) { e = e || bmS.boms[code]; if (!bmSecret(e)) return true; if (bmCanSee(code, e)) return true; const pw = await uiPrompt('🔒 Secret recipe ang "' + (e.name || code) + '". Ilagay ang password:', ''); if (pw === null) return false; if (await bmHash(pw, e.secret.salt) !== e.secret.hash) { alert('Maling password.'); return false; } bmUnlocked[bmKey(code)] = true; return true; }
async function bmViewUnlock(code) { if (await bmUnlock(code)) { arCloseModal(); bmView(code); } }
function invBomHide(e, p) { return bmSecret(e) && !bmIsOwner(e) && !bmUnlocked[bmKey(p)]; }
async function invBomUnlock(p) { const e = (invBomD.own[p] || invBomD.inh[p]); if (await bmUnlock(p, e)) invBomRender(); }
function canSeeBomCost() { const u = getCurrentUser() || {}; return ['admin', 'commissary'].includes(normalizeRole(u.role)); }
function bmPrint(code) {
  const S = bmS, e = S.boms[code]; if (!e) return; if (!bmCanSee(code, e)) { alert('🔒 Secret recipe — ilagay muna ang password (👁 Tingnan).'); return; } const cs = invBomComps(e), pr = canSeeBomCost();
  printHtmlDoc('BOM ' + (e.name || code), `<div class="pg"><h1>🧪 BOM — ${srchEsc(e.name || code)}</h1><div class="meta">Company: <b>${srchEsc(S.company)}</b> · Code: ${srchEsc(code)}<br>${invBomSummary(e, cs)}<br>${printedByLine()}</div><table><thead><tr><th>Item Code</th><th>Sangkap</th><th class="num">Dami</th><th>Unit</th><th class="num">Yield %</th>${pr ? '<th class="num">Gastos</th>' : ''}</tr></thead><tbody>${cs.map(b => { const x = S.sap[b.raw]; const c = bmCompCost(b); return `<tr><td>${srchEsc(b.raw || '')}</td><td>${srchEsc(b.free ? b.name : (b.rawName || (x && x.itemName) || b.raw))}</td><td class="num">${srchEsc(b.qty)}</td><td>${srchEsc(b.unit || '')}</td><td class="num">${+b.yield || 100}</td>${pr ? `<td class="num">${b.free ? '' : invMoney(c)}</td>` : ''}</tr>`; }).join('')}</tbody></table>${pr ? `<p><b>Kabuuang gastos / batch: ₱${invMoney(bmTotals(e))}</b></p>` : ''}</div>`);
}
async function bomViewOpen() {
  const co = invState.company; arModal('<div style="padding:1rem;">Kinukuha...</div>');
  try { const d = await db.collection('inventory_bom').doc('company_' + invSlug(co)).get(); bmS.company = co; bmS.boms = d.exists ? (d.data().boms || {}) : {}; bmS.sap = {}; bmS.items = {};
    const list = Object.keys(bmS.boms).sort((a, b) => String(bmS.boms[a].name || a).localeCompare(String(bmS.boms[b].name || b)));
    arModal(`<h3>🧪 Prepared Items / BOM — ${srchEsc(co)}</h3><p style="font-size:.84rem;color:#64748b;">Ang BOM ay itinatakda ng Admin per company. Ang bilang ng prep item ay idinadagdag sa raw na bilang bilang “From BOM”.</p><input type="search" placeholder="🔍 Hanapin..." oninput="crudFilter(this)" style="width:100%;margin-bottom:.4rem;"><div style="max-height:55vh;overflow:auto;"><table data-notools="1"><tbody>${list.map(c => { const e = bmS.boms[c], cs = invBomComps(e); return `<tr data-crud-row><td><b>${srchEsc(e.name || c)}</b><br><small style="color:#64748b;">${srchEsc(c)} · ${invBomSummary(e, cs)}</small></td><td><button class="btn btn-sm btn-secondary" onclick="bmView('${srchEsc(c)}')">👁 Tingnan</button></td></tr>`; }).join('') || '<tr><td style="color:#94a3b8;text-align:center;">Wala pang BOM.</td></tr>'}</tbody></table></div>`);
  } catch (e) { alert('Error: ' + e.message); }
}
async function bmForm(code) {
  const e = code ? bmS.boms[code] : null; if (e && !(await bmUnlock(code, e))) return; bmDraft = { code: code || '', name: e ? (e.name || (bmS.items[code] || {}).itemName || code) : '', uom: e ? (e.uom || (bmS.items[code] || {}).countUOM || 'KG') : 'KG', mode: e ? invBomMode(e) : 'add', out: e && e.out ? JSON.parse(JSON.stringify(e.out)) : null, comps: e ? invBomComps(e).map(b => Object.assign({}, b)) : [], pick: '', secret: e && e.secret ? e.secret : null, pw: '', rmSecret: false }; bmFormRender();
}
function bmSecretBox(D) {
  const own = !D.secret || String(D.secret.owner || '').toLowerCase() === bmMe();
  if (!own) return `<div style="margin:.5rem 0;padding:.5rem .7rem;border:1px solid #fcd34d;background:#fffbeb;border-radius:8px;font-size:.85rem;">🔒 <b>Secret recipe</b> — ang gumawa lang (${srchEsc(D.secret.ownerName || D.secret.owner || '')}) ang puwedeng magpalit o mag-alis ng password.</div>`;
  return `<div style="margin:.5rem 0;padding:.5rem .7rem;border:1px solid #e2e8f0;border-radius:8px;"><b>🔒 Secret recipe</b><div style="font-size:.82rem;color:#64748b;margin:.2rem 0;">Lagyan ng password para itago ang mga sangkap sa ibang empleyado at admin. Kita pa rin ang gastos, tuloy ang inventory deduction, at puwede pa rin itong gamitin bilang sangkap sa ibang menu/BOM. Ikaw lang (ang gumawa) ang puwedeng magpalit ng password.</div>
  <input type="text" autocomplete="off" id="bm-pw" value="${srchEsc(D.pw || '')}" placeholder="${D.secret ? 'Bagong password (iwanang blangko kung hindi papalitan)' : 'Password (opsyonal — min. 4 na karakter)'}" oninput="bmDraft.pw=this.value" style="width:100%;">
  ${D.secret ? `<label style="cursor:pointer;font-size:.85rem;"><input type="checkbox" ${D.rmSecret ? 'checked' : ''} onchange="bmDraft.rmSecret=this.checked" style="width:auto;"> Alisin ang secret (ipakita na ulit ang mga sangkap)</label>` : ''}</div>`;
}
function bmNextCode() { const used = new Set([...Object.keys(bmS.boms), ...Object.keys(bmS.sap), ...Object.keys(bmS.items)]); let n = 101001; for (const k of used) { const m = /^WP(\d{6})$/.exec(k); if (m && +m[1] >= n) n = +m[1] + 1; } return 'WP' + n; }
function bmFormRender() {
  const D = bmDraft, e = { components: D.comps, mode: D.mode, out: D.out }, cost = bmTotals(e);
  const rows = D.comps.map((b, i) => { const x = bmS.sap[b.raw]; return `<tr><td>${b.custom ? '🧪 ' + srchEsc(b.name) + '<br><small style="color:#b45309;">R&D · ₱' + invMoney(b.price) + ' / ' + srchEsc(b.priceUnit || 'pc') + '</small>' : b.free ? '💧 ' + srchEsc(b.name) : srchEsc(b.rawName || (x && x.itemName) || b.raw) + '<br><small style="color:#64748b;">' + srchEsc(b.raw) + '</small>'}</td><td style="text-align:right;">${srchEsc(b.qty)} ${srchEsc(b.unit || '')}${+b.yield > 0 && +b.yield < 100 ? '<br><small>yield ' + +b.yield + '%</small>' : ''}</td><td style="text-align:right;">${(b.free && !b.custom) || (!b.custom && !x) ? '—' : '₱' + invMoney(bmCompCost(b))}</td><td><button class="btn btn-sm btn-secondary" onclick="bmDelComp(${i})">✖</button></td></tr>`; }).join('') || '<tr><td colspan="4" style="text-align:center;color:#94a3b8;">Wala pang sangkap.</td></tr>';
  arModal(`<h3>${bmS.boms[D.code] ? '✏️ I-edit' : '➕ Bagong'} BOM — ${srchEsc(bmS.company)}</h3>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:.4rem;"><div style="grid-column:1/3;"><label>Pangalan ng prep / BOM</label><input id="bm-name" value="${srchEsc(D.name)}" placeholder="Hal: PREP SIOMAI" style="width:100%;" oninput="bmDraft.name=this.value"></div><div><label>Code</label><input id="bm-code" value="${srchEsc(D.code)}" placeholder="auto: ${srchEsc(bmNextCode())}" ${bmS.boms[D.code] ? 'disabled' : ''} oninput="bmDraft.code=this.value.trim().toUpperCase()" style="width:100%;"></div><div><label>Bilang sa (UOM)</label><select onchange="bmDraft.uom=this.value" style="width:100%;">${['KG', 'G', 'L', 'ML', 'PCS', 'PACK', 'BATCH'].map(u => `<option ${u === D.uom ? 'selected' : ''}>${u}</option>`).join('')}</select></div></div>
  <div style="margin:.5rem 0;padding:.5rem;border:1px solid #e2e8f0;border-radius:8px;"><b>Sangkap</b><div style="position:relative;margin:.3rem 0;"><input type="search" id="bm-q" placeholder="🔍 Hanapin ang sangkap sa Product Master ng company..." oninput="bmSearchSoon()" onfocus="bmSearch()" style="width:100%;"><div id="bm-r" style="display:none;position:absolute;z-index:6;left:0;right:0;background:#fff;border:1px solid #e2e8f0;max-height:200px;overflow:auto;"></div></div><label style="font-size:.8rem;"><input type="checkbox" ${bmInactive ? 'checked' : ''} onchange="bmInactive=this.checked;bmSearch()"> Isama ang inactive</label>
  <div style="display:flex;gap:.4rem;flex-wrap:wrap;align-items:center;margin-top:.3rem;"><input type="number" id="bm-qty" placeholder="Dami" step="any" min="0" style="width:90px;"><select id="bm-u" data-nosearch="1" style="width:84px;"><option>g</option><option>kg</option><option>ml</option><option>L</option><option value="">pcs/iba</option></select><input type="number" id="bm-y" value="100" step="any" min="1" max="100" style="width:72px;" title="Yield %"><small>yield %</small><button class="btn btn-success btn-sm" onclick="bmAddComp()">➕ Idagdag</button><button class="btn btn-secondary btn-sm" onclick="bmAddFree()">💧 Tubig / iba pa</button></div>
  <details style="margin-top:.5rem;" ${bmDraft.rdOpen ? 'open' : ''} ontoggle="bmDraft.rdOpen=this.open"><summary style="cursor:pointer;font-weight:700;color:#b45309;">🧪 Bagong sangkap (R&amp;D / wala pa sa SAP)</summary><div style="background:#fffbeb;padding:.5rem;border-radius:8px;margin-top:.3rem;font-size:.85rem;"><div>Para sa binibili sa labas o sinusubukan pang menu. Ilagay ang pangalan at presyo; gagamitin ang <b>Dami / Unit / Yield</b> sa itaas.</div>
  <div style="display:flex;gap:.4rem;flex-wrap:wrap;align-items:center;margin-top:.3rem;"><input id="bm-cn" placeholder="Pangalan ng sangkap" style="min-width:170px;flex:1;"><span>₱</span><input type="number" id="bm-cp" placeholder="Presyo" step="any" min="0" style="width:90px;"><span>kada</span><select id="bm-cu" data-nosearch="1"><option value="g">gramo</option><option value="kg">kg</option><option value="ml">ml</option><option value="l">L</option><option value="">piraso/pc</option></select><button class="btn btn-sm" style="background:#d97706;color:#fff;" onclick="bmAddCustom()">➕ Idagdag (R&amp;D)</button></div></div></details></div>
  <div style="max-height:30vh;overflow:auto;"><table data-notools="1"><thead><tr><th>Sangkap</th><th style="text-align:right;">Dami</th><th style="text-align:right;">Gastos</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>
  <div style="margin:.5rem 0;background:#f0f9ff;padding:.5rem .7rem;border-radius:8px;font-size:.88rem;">📏 ${invBomSummary(e, D.comps) || '—'}<br>💰 Gastos / batch: <b>₱${invMoney(cost)}</b> <button class="btn btn-sm btn-secondary" onclick="bmOut()">✏️ Actual na nagagawa</button><br>Epekto sa raw: <select onchange="bmDraft.mode=this.value;bmFormRender()"><option value="add" ${D.mode === 'add' ? 'selected' : ''}>➕ Idagdag (From BOM)</option><option value="deduct" ${D.mode === 'deduct' ? 'selected' : ''}>➖ Ibawas</option></select><br><label style="cursor:pointer;"><input type="checkbox" ${D.asProduct !== false ? 'checked' : ''} onchange="bmDraft.asProduct=this.checked" style="width:auto;"> 🛒 Gawing Product din (para ma-order ng branch/customer — itatago hanggang may SRP)</label></div>
  ${bmSecretBox(D)}
  <button class="btn btn-success" onclick="bmSave()">💾 I-save</button> <button class="btn btn-secondary" onclick="arCloseModal();loadBomMgmt()">Kanselahin</button>`);
  const q = document.getElementById('bm-q'); if (q && D.pick) q.value = D.pickName || '';
}
window._kdt = window._kdt || {};
function kDeb(fn, key, ms) { clearTimeout(window._kdt[key]); window._kdt[key] = setTimeout(fn, ms || 450); } // search pagkatapos mag-type, hindi bawat letra
let _bmT = null;
function bmSearchSoon() { const q = document.getElementById('bm-q'); if (q && bmDraft) bmDraft.pick = ''; clearTimeout(_bmT); _bmT = setTimeout(bmSearch, 450); } // hintayin munang matapos mag-type
function bmSearch() {
  clearTimeout(_bmT);
  const q = (document.getElementById('bm-q').value || '').trim(), box = document.getElementById('bm-r'); bmDraft.pick = '';
  const list = bmS.prod.filter(x => (bmInactive || x.active !== false) && !(x.isBom && (x.itemCode === bmDraft.code || bmUses(x.itemCode, bmDraft.code || '\u0000'))) && (!q || smartMatch(q, x.itemName, x.itemCode + ' ' + (x.posCode || '')))).slice(0, q ? 25 : 40);
  const rd = []; const seen = new Set(); Object.keys(bmS.boms).filter(c => bmCanSee(c)).forEach(c => invBomComps(bmS.boms[c]).forEach(b => { if (b.custom && b.name && !seen.has(b.name.toLowerCase()) && (!q || smartMatch(q, b.name, ''))) { seen.add(b.name.toLowerCase()); rd.push(b); } }));
  box.innerHTML = rd.slice(0, 8).map(b => `<div style="padding:.4rem .6rem;border-bottom:1px solid #f1f5f9;cursor:pointer;background:#fffbeb;" onclick="bmPickRd('${srchEsc(b.name).replace(/'/g, '&#39;')}')"><b>🧪 ${srchEsc(b.name)}</b> <small style="color:#b45309;">R&D · ₱${invMoney(b.price)} / ${srchEsc(b.priceUnit || 'pc')}</small></div>`).join('') + list.map(x => `<div style="padding:.4rem .6rem;border-bottom:1px solid #f1f5f9;cursor:pointer;" onclick="bmPick('${srchEsc(x.itemCode)}')"><b>${srchEsc(x.itemName)}</b>${x.fromSap ? ' <small style="color:#2563eb;">SAP</small>' : ''}${x.active === false ? ' <small style="color:#b45309;">inactive</small>' : ''}<br><small style="color:#64748b;">${srchEsc(x.itemCode)}${x.posCode ? ' · POS ' + srchEsc(x.posCode) : ''} · ${srchEsc(x.invUom || x.purchUom || '')}${bmCostPerUnit(x) > 0 ? ' · ₱' + invMoney(bmCostPerUnit(x)) : ' · walang cost'}<br>🕒 ${bmDates(x)}</small></div>`).join('') || '<div style="padding:.5rem;color:#94a3b8;">Walang nahanap. Kung bago o wala pa sa SAP (R&D), gamitin ang "🧪 Bagong sangkap (R&D)" sa ibaba.</div>'; box.style.display = 'block';
}
function bmDates(x) { const p = []; if (x.updateDate) p.push('SAP updated ' + srchEsc(x.updateDate)); if (x.lastPurchaseDate) p.push('huling bili ' + srchEsc(x.lastPurchaseDate)); if (x.asOf) p.push('SAP as of ' + srchEsc(x.asOf)); if (x.importedAt) p.push('na-import ' + srchEsc(sapStamp(x.importedAt))); return p.join(' · ') || 'walang petsa (wala sa SAP)'; }
function bmPick(c) { const x = bmS.sap[c]; bmDraft.pick = c; bmDraft.pickName = x.itemName; document.getElementById('bm-q').value = x.itemName; document.getElementById('bm-r').style.display = 'none'; }
function bmAddComp() {
  const D = bmDraft, x = bmS.sap[D.pick], q = +document.getElementById('bm-qty').value, un = document.getElementById('bm-u').value, y = +document.getElementById('bm-y').value;
  if (!x) { alert('Pumili ng sangkap mula sa listahan.'); return; } if (!(q > 0)) { alert('Ilagay ang dami (higit sa 0).'); return; } if (!(y > 0 && y <= 100)) { alert('Ang yield ay dapat 1–100%.'); return; } const r = bmFactor(x, q, un); if (r.err) { alert(r.err); return; }
  const nc = { raw: x.itemCode, rawName: x.itemName, qty: q, unit: un, factor: Math.round(r.f * 1e8) / 1e8, yield: y }, ex = D.comps.findIndex(b => b.raw === x.itemCode); if (ex >= 0) D.comps[ex] = nc; else D.comps.push(nc); D.pick = ''; D.pickName = ''; bmFormRender();
}
function bmPickRd(name) {
  const D = bmDraft; let f = null; Object.keys(bmS.boms).filter(c => bmCanSee(c)).forEach(c => invBomComps(bmS.boms[c]).forEach(b => { if (!f && b.custom && String(b.name).toLowerCase() === String(name).toLowerCase()) f = b; })); if (!f) return;
  D.rdOpen = true; bmFormRender(); const set = (id, v) => { const el = document.getElementById(id); if (el) el.value = v; }; set('bm-cn', f.name); set('bm-cp', f.price); set('bm-cu', f.priceUnit || ''); const r = document.getElementById('bm-r'); if (r) r.style.display = 'none';
}
function bmAddCustom() {
  const g = id => (document.getElementById(id) || {}).value, name = String(g('bm-cn') || '').trim(), price = parseFloat(g('bm-cp')), pu = g('bm-cu') || '', q = +g('bm-qty'), un = g('bm-u') || '', y = +g('bm-y') || 100;
  if (!name) { alert('Ilagay ang pangalan ng sangkap.'); return; } if (!(price >= 0) || isNaN(price)) { alert('Ilagay ang presyo.'); return; } if (!(q > 0)) { alert('Ilagay ang dami na gagamitin (sa itaas).'); return; } if (!(y > 0 && y <= 100)) { alert('Ang yield ay dapat 1–100%.'); return; }
  const A = BOM_UNITS[un], B = BOM_UNITS[pu]; if (un !== pu && !(A && B && A[0] === B[0])) { alert(`Hindi tugma ang unit ng gamit (${un || 'pc'}) at ng presyo (${pu || 'pc'}). Halimbawa: presyo kada kg, gamit ay g; o presyo kada piraso, gamit ay pcs.`); return; }
  const nc = { raw: '', name, qty: q, unit: un, factor: 0, yield: y, free: true, custom: true, price, priceUnit: pu }, ex = bmDraft.comps.findIndex(b => b.custom && String(b.name).toLowerCase() === name.toLowerCase()); if (ex >= 0) bmDraft.comps[ex] = nc; else bmDraft.comps.push(nc); bmDraft.rdOpen = true; bmFormRender();
}
async function bmAddFree() {
  const q = +document.getElementById('bm-qty').value, un = document.getElementById('bm-u').value; if (!(q > 0)) { alert('Ilagay muna ang dami at unit sa itaas.'); return; } const nm = ((await uiPrompt('Pangalan ng sangkap na hindi ibinabawas sa inventory:', 'Tubig')) || '').trim(); if (!nm) return;
  bmDraft.comps.push({ raw: '', name: nm, qty: q, unit: un, factor: 0, yield: 100, free: true }); bmFormRender();
}
function bmDelComp(i) { bmDraft.comps.splice(i, 1); bmFormRender(); }
async function bmOut() {
  const T = invBomTotals({ components: bmDraft.comps }), cur = bmDraft.out ? bmDraft.out.qty + ' ' + bmDraft.out.unit : (T.w ? Math.round(T.w) + ' g' : ''), t = await uiPrompt('Actual na nagagawa ng 1 batch (hal. 1800 g, 2 kg). Iwanang blangko para gamitin ang kabuuan ng sangkap.', cur); if (t === null) return;
  const m = String(t).trim().match(/^([\d.]+)\s*(g|kg|ml|l)?$/i); if (!t.trim()) bmDraft.out = null; else if (m && +m[1] > 0) bmDraft.out = { qty: +m[1], unit: (m[2] || 'g') }; else { alert('Hindi maintindihan. Hal. 2 kg o 1800 g'); return; } bmFormRender();
}
async function bmSave() {
  const D = bmDraft, name = (D.name || '').trim(); if (!name) { alert('Ilagay ang pangalan ng BOM.'); return; } if (!D.comps.length) { alert('Maglagay ng kahit isang sangkap.'); return; }
  const isNew = !bmS.boms[D.code]; let code = D.code; if (isNew) { code = code || bmNextCode(); if (bmS.boms[code] || bmS.sap[code]) { alert(`Ang code na ${code} ay ginagamit na.`); return; } }
  if (Object.keys(bmS.boms).some(c => c !== code && String(bmS.boms[c].name || '').trim().toUpperCase() === name.toUpperCase())) { alert('May BOM na may ganitong pangalan.'); return; }
  try { const ref = db.collection('inventory_bom').doc('company_' + invSlug(bmS.company)); const cur = await ref.get(); const boms = cur.exists ? (cur.data().boms || {}) : {}; const ent = { name, uom: D.uom, mode: D.mode, components: D.comps, updatedBy: invWho(), updatedAt: new Date().toISOString() }; if (D.out) ent.out = D.out;
    const prev = boms[code] || {}, ownerOk = !prev.secret || String(prev.secret.owner || '').toLowerCase() === bmMe(); if (prev.secret) ent.secret = prev.secret;
    if (ownerOk && D.rmSecret) delete ent.secret;
    else if (ownerOk && D.pw && D.pw.trim()) { const pw = D.pw.trim(); if (pw.length < 4) { alert('Ang password ay dapat 4 na karakter pataas.'); return; } const salt = Math.random().toString(36).slice(2) + Date.now().toString(36); ent.secret = { salt, hash: await bmHash(pw, salt), owner: (prev.secret && prev.secret.owner) || bmMe(), ownerName: (prev.secret && prev.secret.ownerName) || invWho(), setAt: new Date().toISOString() }; delete bmUnlocked[bmKey(code)]; }
    boms[code] = ent;
    await ref.set({ scope: 'company', company: bmS.company, boms, updatedAt: new Date().toISOString() }, { merge: true });
    await db.collection('inventory_items').doc(`${bmS.company}__${code}`).set({ company: bmS.company, itemCode: code, itemName: name, type: 'kitchen', station: 'Unassigned', countUOM: D.uom, source: 'bom', updatedAt: new Date().toISOString() }, { merge: true });
    let pmsg = ''; if (D.asProduct !== false) { try { pmsg = await bmPublishProduct(code, name, D); } catch (pe) { pmsg = '\n⚠️ Hindi na-gawang product: ' + pe.message; } }
    try { await logSystemAction(isNew ? 'BOM_CREATED' : 'BOM_EDITED', `${bmS.company}: ${name} (${code})`); } catch (e) {} arCloseModal(); await loadBomMgmt(); alert('✅ Na-save ang BOM. Magagamit na rin ito bilang sangkap sa ibang BOM, at makikita ng mga branch sa listahan ng items para ilagay sa station.' + pmsg);
  } catch (e) { alert('Error: ' + e.message); }
}
// Ginagawang Product (Product Master) ang BOM para ma-order ng branch/customer. Hindi ina-overwrite ang existing na product; nananatiling nakatago (inactive) hanggang may SRP.
async function bmPublishProduct(code, name, D) {
  const ref = db.collection('products').doc(code), ex = await ref.get();
  if (ex.exists) { const p = ex.data(), cs = productCompanies(p); if (!cs.some(c => hubKey(c) === hubKey(bmS.company))) await ref.set({ companies: cs.concat(bmS.company) }, { merge: true }); return '\n🛒 Nasa Product Master na ang ' + code + '.'; }
  const u = String(D.uom || 'KG').toUpperCase(), g = u === 'KG' ? 1000 : (u === 'G' ? 1 : 0), bx = bmS.sap[code], cpg = bx && bx.invUom === 'G' ? +bx.lastPrice || 0 : 0;
  await ref.set({ itemName: name, itemCode: code, sapCode: code, companies: [bmS.company], source: 'bom', wholeUOM: D.uom || 'KG', looseUOM: D.uom || 'KG', conversionFactor: 1, wholePrice: 0, loosePrice: 0, stockWhole: 0, stockLoose: 0, bufferLimit: 5, active: false, wholeContent: g || 0, looseContent: g || 0, contentUnit: 'g', createdAt: firebase.firestore.FieldValue.serverTimestamp(), updatedAt: firebase.firestore.FieldValue.serverTimestamp() });
  if (g && cpg) await db.collection('product_costs').doc(code).set({ costWhole: +(cpg * g).toFixed(4), costLoose: +(cpg * g).toFixed(4), updatedAt: firebase.firestore.FieldValue.serverTimestamp() }, { merge: true });
  return '\n🛒 Nagawa na ring Product (' + code + ') — nakatago pa sa branch. Ilagay ang SRP sa Product Master at i-activate para makita/ma-order ng branch o customer.';
}
async function bmCopy(code) { const e = bmS.boms[code]; if (!e) return; if (bmSecret(e)) { alert('🔒 Hindi puwedeng i-copy ang secret recipe.'); return; } const D = { code: '', name: (e.name || code) + ' (kopya)', uom: e.uom || 'KG', mode: invBomMode(e), out: e.out ? Object.assign({}, e.out) : null, comps: invBomComps(e).map(b => Object.assign({}, b)), pick: '' }; bmDraft = D; bmFormRender(); }
async function bmDelete(code) {
  const e = bmS.boms[code]; if (!e) return; if (!(await bmUnlock(code, e))) return; if (!await uiConfirm(`Burahin ang BOM na "${e.name || code}"? Hindi na ito magagamit sa Count Result. (Mananatili ang mga lumang bilang.)`)) return;
  try { const ref = db.collection('inventory_bom').doc('company_' + invSlug(bmS.company)); const cur = await ref.get(); const boms = cur.exists ? (cur.data().boms || {}) : {}; delete boms[code]; await ref.set({ scope: 'company', company: bmS.company, boms, updatedAt: new Date().toISOString() });
    if ((bmS.items[code] || {}).source === 'bom') { try { await db.collection('inventory_items').doc(`${bmS.company}__${code}`).delete(); } catch (x) {} } try { await logSystemAction('BOM_DELETED', `${bmS.company}: ${e.name || code}`); } catch (x) {} await loadBomMgmt(); } catch (x) { alert('Error: ' + x.message); }
}
// ===== 🙈 Menu Visibility (Super Admin) — itinatago lang sa view, nasa code pa rin =====
const MV_NEVER = ['dashboard', 'users', 'menu_vis'];
const MV_SUGGEST = { admin: ['manufacturing', 'costing', 'finance', 'ap_invoices', 'assets', 'daily_prices', 'inv_totals', 'lot_tracing', 'auto_pr', 'reports', 'disputes', 'team', 'sessions', 'syshealth', 'truncate'], branch: [], commissary: [] };
let mvCfg = { admin: [], branch: [], commissary: [] }, mvDraft = null, mvQ = '';
function mvPage() { const c = document.body.classList; return c.contains('page-admin') ? 'admin' : c.contains('page-branch') ? 'branch' : c.contains('page-commissary') ? 'commissary' : ''; }
function mvCatalog() {
  const cat = { admin: [], branch: [], commissary: [] };
  ACCESS_MODULES.forEach(m => { if (!m.native) cat.admin.push({ key: m.key, label: m.label }); else if (m.view && m.sel) cat[m.native].push({ key: m.view, label: m.label.replace(/^(\S+)\s+Makita ang /, '$1 ') }); });
  cat.admin.push({ key: 'sessions', label: '👥 Online / Logout Users' }, { key: 'syshealth', label: '🩺 System Health' });
  return cat;
}
function mvSelector(page, key) { const fn = { admin: 'switchAdminView', branch: 'switchBranchView', commissary: 'switchCommissaryView' }[page]; return `.menu-item[onclick*="${fn}('${key}')"]`; }
function mvApplyDom(cfg, dim) {
  const page = mvPage(); if (!page) return;
  if (!document.getElementById('mv-style')) { const st = document.createElement('style'); st.id = 'mv-style'; st.textContent = '.mv-hidden{display:none !important}.mv-dim{opacity:.45;outline:1px dashed #94a3b8}'; document.head.appendChild(st); }
  document.querySelectorAll('.mv-hidden,.mv-dim').forEach(e => e.classList.remove('mv-hidden', 'mv-dim'));
  (cfg[page] || []).forEach(k => { if (MV_NEVER.includes(k)) return; document.querySelectorAll(mvSelector(page, k)).forEach(e => { e.classList.add(dim ? 'mv-dim' : 'mv-hidden'); if (dim) e.title = '🙈 Nakatago sa iba (ikaw lang ang nakakakita)'; }); });
  document.querySelectorAll('.menu-category').forEach(c => { let n = c.nextElementSibling, vis = 0, any = 0; while (n && !n.classList.contains('menu-category')) { if (n.classList.contains('menu-item')) { any++; if (!n.classList.contains('mv-hidden') && n.style.display !== 'none') vis++; } n = n.nextElementSibling; } c.classList.toggle('mv-hidden', any > 0 && vis === 0); });
}
async function mvInit(tries) {
  tries = tries || 0; const page = mvPage(); if (!page) return;
  if (typeof db === 'undefined' || !db || !getCurrentUser()) { if (tries < 20) setTimeout(() => mvInit(tries + 1), 800); return; }
  try {
    const [d] = await Promise.all([db.collection('system_settings').doc('menu_visibility').get(), superAdminLoad()]);
    mvCfg = Object.assign({ admin: [], branch: [], commissary: [] }, d.exists ? d.data() : {});
    const me = page === 'admin' && superAdminIsMe(); const m = document.getElementById('menu-menuvis'); if (m && me) m.style.display = '';
    mvApplyDom(mvCfg, me);
    if (page === 'admin') setTimeout(() => mvApplyDom(mvCfg, me), 2500); // pagkatapos ng access-control
  } catch (e) { console.warn('Menu visibility skipped:', e.message); }
}
document.addEventListener('DOMContentLoaded', () => { try { mvInit(); } catch (e) {} });
async function mvLoad() {
  const root = document.getElementById('menuvis-root'); if (!root) return;
  await superAdminLoad(); if (!superAdminIsMe()) { root.innerHTML = '<div class="card" style="color:#dc2626;">Para sa Super Admin lang ang page na ito.</div>'; return; }
  try { const d = await db.collection('system_settings').doc('menu_visibility').get(); mvCfg = Object.assign({ admin: [], branch: [], commissary: [] }, d.exists ? d.data() : {}); } catch (e) {}
  mvDraft = { admin: [...(mvCfg.admin || [])], branch: [...(mvCfg.branch || [])], commissary: [...(mvCfg.commissary || [])] }; mvRender();
}
function mvRender() {
  const root = document.getElementById('menuvis-root'), cat = mvCatalog(), q = mvQ.trim().toLowerCase(), T = { admin: '🛡️ Admin Page', branch: '🏪 Branch Page', commissary: '🚚 Commissary Page' };
  root.innerHTML = `<div class="card"><div class="card-title"><span>🙈 Menu Visibility (Super Admin)</span></div>
  <p style="color:#64748b;font-size:.88rem;">I-check ang gusto mong <b>itago sa menu</b> ng website. Hindi binubura ang code, at ibabalik mo lang sa pag-uncheck. Ikaw (Super Admin) ay nakakakita pa rin ng lahat sa Admin page (malabo ang mga nakatago).</p>
  <div style="display:flex;gap:.4rem;flex-wrap:wrap;margin-bottom:.6rem;"><input type="search" placeholder="🔍 Hanapin ang menu..." value="${srchEsc(mvQ)}" oninput="mvQ=this.value;mvRender();var i=document.querySelector('#menuvis-root input[type=search]');i.focus();i.setSelectionRange(i.value.length,i.value.length)" style="min-width:200px;"><button class="btn btn-secondary btn-sm" onclick="mvSuggest()">💡 Ilapat ang mungkahi</button><button class="btn btn-secondary btn-sm" onclick="mvShowAll()">👁 Ipakita lahat</button><button class="btn btn-success" onclick="mvSave()">💾 I-save</button></div>
  ${['admin', 'branch', 'commissary'].map(p => `<h4 style="margin:.8rem 0 .3rem;">${T[p]} <small style="color:#64748b;">(${mvDraft[p].length} nakatago)</small></h4><div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:.3rem;">${cat[p].filter(m => !q || m.label.toLowerCase().includes(q) || m.key.includes(q)).map(m => { const never = MV_NEVER.includes(m.key); return `<label style="display:flex;gap:.4rem;align-items:center;padding:.35rem .5rem;border:1px solid #e2e8f0;border-radius:6px;${mvDraft[p].includes(m.key) ? 'background:#fef2f2;' : ''}${never ? 'opacity:.6;' : ''}"><input type="checkbox" ${mvDraft[p].includes(m.key) ? 'checked' : ''} ${never ? 'disabled' : ''} onchange="mvToggle('${p}','${m.key}',this.checked)"> <span>${srchEsc(m.label)}</span></label>`; }).join('')}</div>`).join('')}</div>`;
}
function mvToggle(p, k, on) { const a = mvDraft[p].filter(x => x !== k); if (on) a.push(k); mvDraft[p] = a; mvRender(); }
function mvSuggest() { Object.keys(MV_SUGGEST).forEach(p => { mvDraft[p] = [...new Set(mvDraft[p].concat(MV_SUGGEST[p]))]; }); mvRender(); }
async function mvShowAll() { if (!await uiConfirm('Ipakita ulit ang lahat ng menu? (I-save pa rin para ma-apply)')) return; mvDraft = { admin: [], branch: [], commissary: [] }; mvRender(); }
async function mvSave() {
  const u = getCurrentUser() || {};
  try { await db.collection('system_settings').doc('menu_visibility').set({ admin: mvDraft.admin, branch: mvDraft.branch, commissary: mvDraft.commissary, updatedBy: u.email || '', updatedAt: new Date().toISOString() }); mvCfg = Object.assign({}, mvDraft); mvApplyDom(mvCfg, true); try { await logSystemAction('MENU_VISIBILITY', `Nakatago: admin ${mvDraft.admin.length}, branch ${mvDraft.branch.length}, commissary ${mvDraft.commissary.length}`); } catch (e) {} alert('✅ Na-save. Makikita ng ibang users ang pagbabago sa susunod nilang pag-refresh.'); mvRender(); } catch (e) { alert('Error: ' + e.message); }
}
// ===== Generic CRUD helpers (hanapin, add, edit, delete) =====
function crudFilter(inp) {
  const q = String(inp.value || '').trim().toLowerCase(), words = q.split(/\s+/).filter(Boolean); const root = inp.closest('.card, .modal-content, #ar-modal') || document;
  root.querySelectorAll('tbody tr, [data-crud-row]').forEach(r => { const t = r.innerText.toLowerCase(); r.style.display = !words.length || words.every(w => t.includes(w)) ? '' : 'none'; });
}
let cbCompany = '', cbList = [];
async function companyBranchesOpen(company) {
  cbCompany = company; arModal('<div style="padding:1rem;">Kinukuha...</div>');
  try { if (!invCompaniesList.length) await invLoadMasters(); } catch (e) {}
  try { cbList = []; const [b, m, u] = await Promise.all([db.collection('inventory_branches').get(), db.collection('inventory_station_map').get(), db.collection('users').get()]); const sm = {}; m.forEach(d => sm[d.id] = Object.keys(d.data().stations || {}).length); const uc = {}; u.forEach(d => { const x = d.data(); if (x.branch) uc[hubKey(x.branch)] = (uc[hubKey(x.branch)] || 0) + 1; });
    b.forEach(d => { const x = d.data(); if (hubKey(x.company) === hubKey(company)) cbList.push({ id: d.id, ...x, stn: sm[invSlug(x.code || '')] || 0, usr: uc[hubKey(x.branch)] || 0 }); }); cbList.sort((a, c) => String(a.branch).localeCompare(String(c.branch))); } catch (e) { arModal('<div style="color:#dc2626;padding:1rem;">Error: ' + srchEsc(e.message) + '</div>'); return; }
  cbRender();
}
function cbRender() {
  const rows = cbList.map((b, i) => `<tr data-crud-row><td><b>${srchEsc(b.branch)}</b><br><small style="color:#64748b;">Code: ${srchEsc(b.code || '—')} · ${b.stn} station · ${b.usr} user</small></td><td style="white-space:nowrap;text-align:right;"><button class="btn btn-sm btn-secondary" onclick="branchStationsOpen(${i})">📍 Stations</button> <button class="btn btn-sm btn-primary" onclick="branchForm(${i})">✏️</button> <button class="btn btn-sm btn-danger" onclick="branchDelete(${i})">🗑</button></td></tr>`).join('') || '<tr><td colspan="2" style="text-align:center;color:#94a3b8;">Wala pang branch. I-click ang ➕ Add Branch.</td></tr>';
  arModal(`<h3>🏪 Mga Branch — ${srchEsc(cbCompany)}</h3><div style="display:flex;gap:.4rem;margin-bottom:.5rem;"><input type="search" placeholder="🔍 Hanapin ang branch..." oninput="crudFilter(this)" style="flex:1;"><button class="btn btn-success" onclick="branchForm(-1)">➕ Add Branch</button></div><div style="max-height:55vh;overflow:auto;"><table data-notools="1"><tbody>${rows}</tbody></table></div><p style="font-size:.8rem;color:#64748b;margin-top:.5rem;">📍 Stations = ayusin ang station at produkto ng branch (puwede ring gawin ng branch manager). 🧪 BOM = prepared items ng branch.</p>`);
}
function branchForm(i) {
  const b = i >= 0 ? cbList[i] : {}; arModal(`<h3>${i >= 0 ? '✏️ I-edit ang Branch' : '➕ Bagong Branch'} — ${srchEsc(cbCompany)}</h3><div class="form-group"><label>Pangalan ng Branch</label><input id="bf-name" value="${srchEsc(b.branch || '')}" placeholder="Hal: Kenko Main"></div><div class="form-group"><label>Branch Code</label><input id="bf-code" value="${srchEsc(b.code || '')}" placeholder="Hal: KM01" style="text-transform:uppercase;"></div><div class="form-group"><label>Company</label><select id="bf-co">${(invCompaniesList.some(c => hubKey(c) === hubKey(cbCompany)) ? invCompaniesList : invCompaniesList.concat([cbCompany])).map(c => `<option ${hubKey(c) === hubKey(b.company || cbCompany) ? 'selected' : ''}>${srchEsc(c)}</option>`).join('')}</select></div><button class="btn btn-success" onclick="branchSave(${i})">💾 I-save</button> <button class="btn btn-secondary" onclick="cbRender()">← Balik</button>`);
}
async function branchSave(i) {
  const name = document.getElementById('bf-name').value.trim(), code = document.getElementById('bf-code').value.trim().toUpperCase(), company = document.getElementById('bf-co').value; if (!name || !code || !company) { alert('Ilagay ang pangalan, code at company.'); return; }
  const old = i >= 0 ? cbList[i] : null, id = invSlug(name);
  if (cbList.some((x, j) => j !== i && (invSlug(x.branch) === id || String(x.code).toUpperCase() === code))) { alert('May branch na may ganitong pangalan o code.'); return; }
  if (old && old.branch !== name && !await uiConfirm(`Papalitan ang pangalan ng branch mula "${old.branch}" → "${name}". Dapat ding palitan ang Branch sa mga user at order para magtugma. Ituloy?`)) return;
  try { await db.collection('inventory_branches').doc(id).set({ branch: name, code, company, updatedAt: firebase.firestore.FieldValue.serverTimestamp() }); if (old && old.id !== id) await db.collection('inventory_branches').doc(old.id).delete(); try { await logSystemAction(old ? 'BRANCH_EDITED' : 'BRANCH_CREATED', `${name} (${code}) — ${company}`); } catch (e) {} await invLoadMasters();
    if (hubKey(company) === hubKey(cbCompany)) await companyBranchesOpen(cbCompany); else { arCloseModal(); alert(`✅ Nailipat ang ${name} sa ${company}.`); } if (typeof loadCompanyManagement === 'function') loadCompanyManagement(); } catch (e) { alert('Error: ' + e.message); }
}
async function branchDelete(i) {
  const b = cbList[i]; if (!b) return; if (b.usr && !await uiConfirm(`May ${b.usr} user na naka-tag sa "${b.branch}". Mawawalan sila ng branch setup. Ituloy ang pagbura?`)) return;
  if (!await uiConfirm(`Burahin ang branch na "${b.branch}"? (Mananatili ang mga lumang bilang at order, pero aalisin ito sa listahan ng branch.)`)) return;
  try { await db.collection('inventory_branches').doc(b.id).delete(); try { await logSystemAction('BRANCH_DELETED', `${b.branch} (${b.code}) — ${b.company}`); } catch (e) {} await invLoadMasters(); await companyBranchesOpen(cbCompany); if (typeof loadCompanyManagement === 'function') loadCompanyManagement(); } catch (e) { alert('Error: ' + e.message); }
}
async function branchCtxLoad(b) {
  invState.branch = b.branch; invState.branchCode = b.code || invSlug(b.branch).toUpperCase(); invState.company = b.company; invState.ready = false;
  const [iSnap, pSnap] = await Promise.all([db.collection('inventory_items').where('company', '==', b.company).get(), db.collection('products').get()]);
  invState.items = []; iSnap.forEach(d => invState.items.push({ id: d.id, ...d.data() })); invState.products = {}; pSnap.forEach(d => { invState.products[d.id] = { id: d.id, ...d.data() }; }); invState.items.sort((a, c) => String(a.itemName).localeCompare(String(c.itemName)));
  let smDoc = null; try { const sm = await db.collection('inventory_station_map').doc(invSlug(invState.branchCode)).get(); if (sm.exists) smDoc = sm.data(); } catch (e) {} invState.stationItems = invBuildStationItems(smDoc); invState.station = '';
}
async function branchStationsOpen(i) { const b = cbList[i]; if (!b) return; try { await branchCtxLoad(b); invStationMapOpen(); } catch (e) { alert('Error: ' + e.message); } }
async function branchBomOpen(i) { const b = cbList[i]; if (!b) return; try { await invBomOpen('branch', { company: b.company, bc: b.code || invSlug(b.branch).toUpperCase(), bname: b.branch }); } catch (e) { alert('Error: ' + e.message); } }
async function loadCompanyManagement() {
  const root = document.getElementById('company-admin-root'); if (!root || !db) return;
  root.innerHTML = '<div class="card">Kinukuha ang mga company...</div>';
  try {
    const [cSnap, bSnap, pSnap] = await Promise.all([db.collection('companies').get(), db.collection('inventory_branches').get(), db.collection('products').get()]);
    companyDocs = []; cSnap.forEach(d => companyDocs.push({ id: d.id, ...d.data() }));
    companyDocs.sort((a, b) => String(a.name).localeCompare(String(b.name)));
    const branches = []; bSnap.forEach(d => branches.push(d.data()));
    const prods = []; pSnap.forEach(d => prods.push(d.data()));
    const untagged = prods.filter(p => !productCompanies(p).length).length;
    const rows = companyDocs.map(c => {
      const brs = branches.filter(b => hubKey(b.company) === hubKey(c.name));
      const tagged = prods.filter(p => productCompanies(p).some(x => hubKey(x) === hubKey(c.name))).length;
      return `<tr><td><b>${srchEsc(c.name)}</b>${c.legalName ? `<br><small style="color:#64748b;">${srchEsc(c.legalName)}</small>` : ''}${c.active === false ? '<br><span class="badge badge-warning">Inactive</span>' : ''}</td>
        <td>${srchEsc(c.address || '—')}</td>
        <td>${srchEsc(c.contactPerson || '—')}<br><small>${srchEsc(c.phone || '')} ${srchEsc(c.email || '')}</small></td>
        <td>TIN: ${srchEsc(c.tin || '—')}<br><small>BR: ${srchEsc(c.birReg || '—')}</small></td>
        <td>${srchEsc(c.dateStarted || '—')}</td>
        <td>${brs.length ? brs.map(b => `<span class="co-chip">🏪 ${srchEsc(b.code)} ${srchEsc(b.branch)}</span>`).join('') : '<small style="color:#94a3b8;">Wala pang branch</small>'}</td>
        <td>${tagged} product</td>
        <td style="white-space:nowrap;"><button class="btn btn-sm btn-secondary" onclick="printCompanyProfile('${srchEsc(c.id)}')">🖨️</button> <button class="btn btn-sm btn-success" onclick="companyBranchesOpen('${srchEsc(c.name)}')">🏪 Branches (${brs.length})</button> <button class="btn btn-sm btn-primary" onclick="openCompanyModal('${srchEsc(c.id)}')">✏️ Edit</button> <button class="btn btn-sm btn-danger" onclick="deleteCompany('${srchEsc(c.id)}')">🗑️</button></td></tr>`;
    }).join('') || '<tr><td colspan="8" style="text-align:center;color:#94a3b8;padding:1rem;">Wala pang company. I-click ang "➕ Add Company".</td></tr>';
    root.innerHTML = `<div class="card" data-notools="1"><div class="card-title"><span>🏢 Company Management</span>
      <div style="display:flex;gap:0.4rem;flex-wrap:wrap;"><button class="btn btn-success btn-sm" onclick="openCompanyModal()">➕ Add Company</button><button class="btn btn-primary btn-sm" onclick="companyTreeOpen()">🌳 Istruktura</button><button class="btn btn-secondary btn-sm" onclick="printCardTable(this)">🖨️ Print</button><button class="btn btn-secondary btn-sm" onclick="exportCardTable(this)">⬇️ CSV</button><button class="btn btn-secondary btn-sm" onclick="loadCompanyManagement()">🔄 Refresh</button></div></div>
      <p style="font-size:0.85rem;color:#64748b;margin-bottom:0.75rem;">Dito nakalista ang mga company (hal. KNGK, Tanoshi), ang impormasyon nila, ang mga branch nila, at kung ilang produkto ang naka-tag sa kanila. Sa <b>Product Master</b>, i-tick kung aling company ang gumagamit ng produkto. Ang produktong walang tick (<b>${untagged}</b> ngayon) ay gamit ng lahat ng company. Ang branch ay itinatakda sa company sa <b>Branch Inventory → Setup</b>.</p>
      <input type="search" placeholder="🔍 Hanapin ang company..." oninput="crudFilter(this)" style="width:100%;margin-bottom:.5rem;"><div class="table-responsive"><table><thead><tr><th>Company</th><th>Address</th><th>Contact</th><th>Rehistro (TIN / BR)</th><th>Date Started</th><th>Mga Branch</th><th>Produkto</th><th>Aksyon</th></tr></thead><tbody>${rows}</tbody></table></div></div>`;
  } catch (e) { root.innerHTML = `<div class="card">Error: ${srchEsc(e.message)}</div>`; }
}
function openCompanyModal(id) {
  const c = id ? (companyDocs.find(x => x.id === id) || {}) : {};
  let ov = document.getElementById('company-modal');
  if (!ov) { ov = document.createElement('div'); ov.id = 'company-modal'; ov.className = 'modal-overlay'; ov.style.display = 'none'; ov.innerHTML = '<div class="modal-content" style="max-width:720px;max-height:92vh;overflow-y:auto;"><div id="company-modal-body"></div></div>'; document.body.appendChild(ov); }
  const f = (k, label, ph, type) => `<div class="form-group" style="margin:0;"><label>${label}</label><input type="${type || 'text'}" id="co-${k}" value="${srchEsc(c[k] || '')}" placeholder="${ph || ''}"></div>`;
  document.getElementById('company-modal-body').innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #e2e8f0;padding-bottom:0.5rem;margin-bottom:0.75rem;"><h3 style="margin:0;">${id ? '✏️ I-edit ang Company' : '➕ Bagong Company'}</h3><button class="btn btn-secondary btn-sm" onclick="document.getElementById('company-modal').style.display='none'">✕</button></div>
    <input type="hidden" id="co-id" value="${srchEsc(id || '')}">
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.75rem;">
      ${id ? `<div class="form-group" style="margin:0;"><label>Company Code / Pangalan</label><input type="text" id="co-name" value="${srchEsc(c.name || '')}" disabled></div>` : f('name', 'Company Code / Pangalan', 'Hal: KNGK')}
      ${f('legalName', 'Buong Legal Name', 'Hal: KNGK Food Corp.')}
      ${f('address', 'Company Address', 'Buong address')}
      ${f('dateStarted', 'Date Started (simula ng operasyon)', '', 'date')}
      ${f('contactPerson', 'Contact Person', '')}
      ${f('phone', 'Contact Number', '')}
      ${f('email', 'Email', '', 'email')}
      ${f('website', 'Website / Social', '')}
      ${f('tin', 'TIN', '000-000-000-000')}
      ${f('birReg', 'BR / BIR Registration No.', '')}
    </div>
    <div class="form-group" style="margin-top:0.75rem;"><label>👥 Team / Mga Key Person (isang linya bawat tao: Pangalan — Posisyon — Contact)</label><textarea id="co-team" rows="4" placeholder="Juan Dela Cruz — Owner — 0917...&#10;Ana Reyes — Operations Manager">${srchEsc(c.team || '')}</textarea></div>
    <div class="form-group"><label>Notes</label><textarea id="co-notes" rows="2">${srchEsc(c.notes || '')}</textarea></div>
    <label style="display:flex;gap:0.4rem;align-items:center;font-weight:600;"><input type="checkbox" id="co-active" style="width:auto;" ${c.active === false ? '' : 'checked'}> Active</label>
    <button class="btn btn-success" style="width:100%;margin-top:1rem;font-weight:800;" onclick="saveCompany()">💾 I-save ang Company</button>`;
  ov.style.display = 'flex';
}
async function saveCompany() {
  const g = k => ((document.getElementById('co-' + k) || {}).value || '').trim();
  const id0 = g('id'); const name = g('name') || (companyDocs.find(x => x.id === id0) || {}).name;
  if (!name) { alert('Ilagay ang Company Code / Pangalan.'); return; }
  const id = id0 || name.replace(/[\/#?]/g, '-');
  if (!id0 && companyDocs.some(x => hubKey(x.name) === hubKey(name))) { alert('May company nang ganito ang pangalan.'); return; }
  const data = { name, legalName: g('legalName'), address: g('address'), dateStarted: g('dateStarted'), contactPerson: g('contactPerson'), phone: g('phone'), email: g('email'), website: g('website'), tin: g('tin'), birReg: g('birReg'), team: g('team'), notes: g('notes'), active: !!(document.getElementById('co-active') || {}).checked, updatedAt: firebase.firestore.FieldValue.serverTimestamp() };
  try {
    await db.collection('companies').doc(id).set(data, { merge: true });
    try { await logSystemAction(id0 ? 'COMPANY_EDITED' : 'COMPANY_CREATED', 'Company: ' + name); } catch (e) {}
    document.getElementById('company-modal').style.display = 'none';
    loadCompanyManagement();
  } catch (e) { alert('Error: ' + e.message); }
}
async function deleteCompany(id) {
  const c = companyDocs.find(x => x.id === id); if (!c) return;
  try {
    const b = await db.collection('inventory_branches').where('company', '==', c.name).get();
    if (!b.empty) { alert(`⚠️ Hindi mabubura ang ${c.name}: may ${b.size} branch pa na nakatali rito. Ilipat muna sila sa ibang company (Branch Inventory → Setup).`); return; }
  } catch (e) {}
  if (!await uiConfirm(`Burahin ang company na "${c.name}"? (Mananatili ang mga produkto, pero tatanggalin ang tag nito sa listahan ng pagpipilian.)`)) return;
  try { await db.collection('companies').doc(id).delete(); loadCompanyManagement(); } catch (e) { alert('Error: ' + e.message); }
}
function printCompanyProfile(id) {
  const c = companyDocs.find(x => x.id === id); if (!c) return;
  const row = (l, v) => `<tr><th style="width:30%;">${l}</th><td>${srchEsc(v || '—')}</td></tr>`;
  printHtmlDoc('Company ' + c.name, `<h1>🏢 ${srchEsc(c.name)}</h1><div class="meta">${printedByLine()}</div><table>${row('Legal Name', c.legalName)}${row('Address', c.address)}${row('Date Started', c.dateStarted)}${row('Contact Person', c.contactPerson)}${row('Contact Number', c.phone)}${row('Email', c.email)}${row('Website', c.website)}${row('TIN', c.tin)}${row('BR / BIR Registration', c.birReg)}${row('Status', c.active === false ? 'Inactive' : 'Active')}</table><h2>Team / Key Person</h2><div class="box">${srchEsc(c.team || '—')}</div>${c.notes ? `<h2>Notes</h2><div class="box">${srchEsc(c.notes)}</div>` : ''}`);
}
// Branch catalog: ang produkto ay ayon sa company ng branch
let branchCompanyCache = null;
async function getBranchCompany() {
  if (branchCompanyCache !== null) return branchCompanyCache;
  const u = getCurrentUser() || {}; branchCompanyCache = '';
  try { const d = await db.collection('inventory_branches').doc(invSlug(u.branch)).get(); if (d.exists) branchCompanyCache = d.data().company || ''; } catch (e) {}
  return branchCompanyCache;
}