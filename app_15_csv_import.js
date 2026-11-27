

// ========================================================
// 🧰 CSV / PRINT UTILITIES (gamit ng lahat ng report, export at import)
// ========================================================
function csvCell(v) { return `"${String(v == null ? '' : v).replace(/"/g, '""')}"`; }
function parseCSV(text) {
  const rows = []; let row = [], cur = '', q = false;
  text = String(text || '').replace(/^﻿/, '');
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; }
      else cur += c;
    } else if (c === '"') q = true;
    else if (c === ',') { row.push(cur); cur = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(cur); cur = ''; if (row.some(x => x.trim() !== '')) rows.push(row); row = []; }
    else cur += c;
  }
  row.push(cur); if (row.some(x => x.trim() !== '')) rows.push(row);
  return rows;
}
function csvToObjects(text) {
  const rows = parseCSV(text); if (rows.length < 2) return [];
  const heads = rows[0].map(h => h.trim().toLowerCase().replace(/[\s\-]+/g, '_'));
  return rows.slice(1).map(r => { const o = {}; heads.forEach((h, i) => { o[h] = (r[i] || '').trim(); }); return o; });
}
function pickCSVFile() {
  return new Promise(resolve => {
    const f = document.createElement('input'); f.type = 'file'; f.accept = '.csv,text/csv';
    f.onchange = () => { if (!f.files.length) return resolve(null); const r = new FileReader(); r.onload = e => resolve(e.target.result); r.readAsText(f.files[0]); };
    f.click();
  });
}
const PRINT_CSS = `body{font-family:Inter,Arial,sans-serif;color:#0f172a;margin:24px;font-size:12px}
h1{font-size:20px;margin:0 0 2px}h2{font-size:15px;margin:14px 0 6px}.meta{color:#475569;font-size:11px;margin-bottom:10px}
table{width:100%;border-collapse:collapse;margin-top:6px}th,td{border:1px solid #94a3b8;padding:5px 7px;text-align:left;vertical-align:top}
th{background:#e2e8f0}td.num,th.num{text-align:right}.total td{font-weight:700;background:#f1f5f9}
.box{border:1px solid #94a3b8;padding:8px;border-radius:4px;margin-top:8px;white-space:pre-wrap}
.pg{page-break-after:always}.pg:last-child{page-break-after:auto}.sign{display:flex;gap:40px;margin-top:36px}.sign div{flex:1;border-top:1px solid #0f172a;padding-top:4px;text-align:center;font-size:11px}`;
function printHtmlDoc(title, bodyHtml) {
  const f = document.createElement('iframe');
  f.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;';
  document.body.appendChild(f);
  const d = f.contentWindow.document;
  d.open();
  d.write(`<!doctype html><html><head><meta charset="utf-8"><title>${srchEsc(title)}</title><style>${PRINT_CSS}</style></head><body>${(/class="rc"|comp-hdr/.test(bodyHtml)) ? '' : compHeaderHtml(compForUser())}${bodyHtml}</body></html>`);
  d.close();
  setTimeout(() => { try { f.contentWindow.focus(); f.contentWindow.print(); } catch (e) { alert('Hindi mabuksan ang print: ' + e.message); } setTimeout(() => f.remove(), 2000); }, 350);
}
function printedByLine() { const u = getCurrentUser() || {}; return `Printed ${new Date().toLocaleString('en-PH')} · ${srchEsc(u.name || u.email || '')}`; }

// ---- Awtomatikong "🖨️ Print" at "⬇️ CSV" sa bawat card na may table (kung wala pang sariling print/export) ----
function tableToMatrix(table) {
  const heads = [...table.querySelectorAll('thead th')];
  const skip = new Set();
  heads.forEach((th, i) => { if (/^(aksyon|action|actions|options|edit|print|view)?$/i.test(th.innerText.trim())) skip.add(i); });
  const cellText = td => {
    const s = td.querySelector('select'); if (s && s.selectedIndex >= 0) return s.options[s.selectedIndex].text.trim();
    const i = td.querySelector('input:not([type=hidden])'); if (i && !td.innerText.trim()) return i.value;
    return td.innerText.replace(/\s+/g, ' ').trim();
  };
  const out = [heads.map((th, i) => skip.has(i) ? null : th.innerText.replace(/\s+/g, ' ').trim()).filter(x => x !== null)];
  table.querySelectorAll('tbody tr').forEach(tr => {
    const tds = [...tr.children];
    if (tds.length === 1 && tds[0].colSpan > 1) return; // "Walang laman" na row
    if (tr.style.display === 'none') return;
    out.push(tds.map((td, i) => skip.has(i) ? null : cellText(td)).filter(x => x !== null));
  });
  return out;
}
function cardTableOf(btn) { const card = btn.closest('.card'); return card ? card.querySelector('table') : null; }
function cardTitleText(btn) { const c = btn.closest('.card'); const t = c && c.querySelector('.card-title span'); return (t ? t.innerText : document.title).replace(/[^\w\s&()\-]/g, '').trim() || 'Report'; }
function printCardTable(btn) {
  const t = cardTableOf(btn); if (!t) return;
  const m = tableToMatrix(t); if (m.length < 2) { alert('Walang laman na ipi-print.'); return; }
  const title = cardTitleText(btn);
  const html = `<h1>${srchEsc(title)}</h1><div class="meta">${printedByLine()}</div><table><thead><tr>${m[0].map(h => `<th>${srchEsc(h)}</th>`).join('')}</tr></thead><tbody>${m.slice(1).map(r => `<tr>${r.map(c => `<td>${srchEsc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
  printHtmlDoc(title, html);
}
function exportCardTable(btn) {
  const t = cardTableOf(btn); if (!t) return;
  const m = tableToMatrix(t); if (m.length < 2) { alert('Walang laman na i-e-export.'); return; }
  downloadCSVFile(m.map(r => r.map(csvCell).join(',')).join('\r\n'), cardTitleText(btn).replace(/\s+/g, '_') + '.csv');
}
function injectTableTools() {
  document.querySelectorAll('.card').forEach(card => {
    if (card.dataset.tools) return;
    const title = card.querySelector(':scope > .card-title');
    const table = card.querySelector('table');
    if (!title || !table || card.hasAttribute('data-notools') || table.closest('.modal-content')) return;
    card.dataset.tools = '1';
    if (title.querySelector('[onclick*="print"],[onclick*="Print"],[onclick*="export"],[onclick*="Export"]')) return; // may sarili na
    let bar = title.querySelector(':scope > div');
    if (!bar) { bar = document.createElement('div'); bar.style.cssText = 'display:flex;gap:0.5rem;flex-wrap:wrap;'; title.appendChild(bar); }
    bar.insertAdjacentHTML('beforeend', '<button type="button" class="btn btn-secondary btn-sm" onclick="printCardTable(this)">🖨️ Print</button><button type="button" class="btn btn-secondary btn-sm" onclick="exportCardTable(this)">⬇️ CSV</button>');
  });
}
function startTableTools() {
  injectTableTools();
  let t = null;
  new MutationObserver(() => { clearTimeout(t); t = setTimeout(injectTableTools, 500); }).observe(document.body, { childList: true, subtree: true });
}

// ========================================================
// 📄 BOM / RECIPE REPORT (lalabas pagka-save, may Print at CSV)
// ========================================================
let bomReportCtx = null;
function bomLineCost(i) {
  const p = (adminProductsList || []).find(x => x.id === i.itemCode);
  let price = p ? costOf(p, i.uom) : 0, fallback = false;
  if (!(price > 0)) { price = p ? (i.uom === 'Whole' ? p.wholePrice : p.loosePrice) : i.unitPrice; fallback = true; }
  return { unit: parseFloat(price || 0), uom: bomUomName(i), fallback };
}
function bomReportData(bom, mult) {
  const m = mult > 0 ? mult : 1;
  const lines = (bom.ingredients || []).map(i => { const c = bomLineCost(i); const qty = i.qty * m; return { name: i.itemName, code: i.itemCode, qty: qty, uom: c.uom, unit: c.unit, cost: qty * c.unit, fallback: c.fallback }; });
  const total = lines.reduce((s, l) => s + l.cost, 0);
  const out = (bom.yieldQty || 1) * m;
  const perUnit = out > 0 ? total / out : 0;
  return { lines, total, out, perUnit, m, noCost: lines.filter(l => l.fallback).length, minPrice: minPriceFor(perUnit), suggested: suggestedPriceFor(perUnit) };
}
function bomReportHtml(bom, mult) {
  const r = bomReportData(bom, mult);
  const fmt = n => '₱' + (n || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `<div class="pg">
    <h1>🍳 Recipe Card: ${srchEsc(bom.finishedGoodName)}</h1>
    <div class="meta">Code: ${srchEsc(bom.finishedGoodCode)} · Hub: ${srchEsc(bom.hub || 'Lahat ng Hub')} · Rev ${bom.revision || 1}${bom.lastEditedBy ? ' · ' + srchEsc(bom.lastEditedBy) : ''}<br>${printedByLine()}</div>
    <b>Batch: ×${r.m} &nbsp;|&nbsp; Output: ${r.out} units ng ${srchEsc(bom.finishedGoodName)}</b>
    <table><thead><tr><th>#</th><th>Sangkap</th><th>Code</th><th class="num">Dami</th><th>Unit</th><th class="num">Presyo/Unit</th><th class="num">Gastos</th></tr></thead><tbody>
    ${r.lines.map((l, i) => `<tr><td>${i + 1}</td><td>${srchEsc(l.name)}</td><td>${srchEsc(l.code)}</td><td class="num">${+l.qty.toFixed(4)}</td><td>${srchEsc(l.uom)}</td><td class="num">${fmt(l.unit)}</td><td class="num">${fmt(l.cost)}</td></tr>`).join('')}
    <tr class="total"><td colspan="6" class="num">Kabuuang gastos ng sangkap</td><td class="num">${fmt(r.total)}</td></tr>
    <tr class="total"><td colspan="6" class="num">Puhunan bawat unit (${r.out} units)</td><td class="num">${fmt(r.perUnit)}</td></tr>
    <tr class="total"><td colspan="6" class="num">Suggested presyong paninda bawat unit (overhead ${pricingRules.overheadPct}% + markup ${pricingRules.markupPct}%)</td><td class="num">${fmt(r.suggested)}</td></tr></tbody></table>
    ${r.noCost ? `<div class="meta">* ${r.noCost} sangkap ay walang nakatalang puhunan; ginamit ang presyong paninda nila.</div>` : ''}
    ${bom.notes ? `<h2>Paraan ng Paggawa / Notes</h2><div class="box">${srchEsc(bom.notes)}</div>` : ''}
    <div class="sign"><div>Inihanda ni</div><div>Sinuri ni</div></div></div>`;
}
function viewBomReport(bomId) {
  const bom = bomRecipes.find(b => b.id === bomId);
  if (!bom) { alert('Hindi nahanap ang recipe. I-refresh muna ang listahan.'); return; }
  bomReportCtx = { id: bomId, mult: 1 };
  loadProductCosts().then(() => { if (bomReportCtx && bomReportCtx.id === bomId) renderBomReport(); });
  let ov = document.getElementById('bom-report-modal');
  if (!ov) {
    ov = document.createElement('div'); ov.id = 'bom-report-modal'; ov.className = 'modal-overlay'; ov.style.display = 'none';
    ov.innerHTML = '<div class="modal-content" style="max-width:760px;"><div id="bom-report-body"></div></div>';
    document.body.appendChild(ov);
  }
  renderBomReport();
  ov.style.display = 'flex';
}
function renderBomReport() {
  const bom = bomRecipes.find(b => b.id === bomReportCtx.id); if (!bom) return;
  const r = bomReportData(bom, bomReportCtx.mult);
  const fmt = n => '₱' + (n || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  document.getElementById('bom-report-body').innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #e2e8f0;padding-bottom:0.5rem;margin-bottom:0.75rem;">
      <h3 style="margin:0;color:#0f172a;">📄 Recipe Report: ${srchEsc(bom.finishedGoodName)}</h3>
      <button type="button" class="btn btn-secondary btn-sm" onclick="closeBomReport()">✕</button>
    </div>
    <div style="font-size:0.85rem;color:#475569;margin-bottom:0.75rem;">Code: <b>${srchEsc(bom.finishedGoodCode)}</b> · Hub: <b>${srchEsc(bom.hub || 'Lahat')}</b> · Rev ${bom.revision || 1}${bom.lastEditedBy ? ' · ' + srchEsc(bom.lastEditedBy) : ''}</div>
    <div style="display:flex;gap:0.75rem;align-items:center;flex-wrap:wrap;margin-bottom:0.75rem;">
      <label style="margin:0;font-weight:600;">Ilang batch (×):</label>
      <input type="number" min="0.1" step="0.1" value="${r.m}" style="width:90px;" onchange="bomReportCtx.mult=parseFloat(this.value)||1;renderBomReport()">
      <b style="color:#059669;">Output: ${r.out} units</b>
    </div>
    <div class="table-responsive"><table>
      <thead><tr><th>Sangkap</th><th>Dami</th><th>Unit</th><th>Presyo</th><th>Gastos</th></tr></thead>
      <tbody>${r.lines.map(l => `<tr><td>${srchEsc(l.name)}<br><small style="color:#64748b;">${srchEsc(l.code)}</small></td><td><b>${+l.qty.toFixed(4)}</b></td><td>${srchEsc(l.uom)}</td><td>${fmt(l.unit)}</td><td>${fmt(l.cost)}</td></tr>`).join('')}
      <tr style="font-weight:800;background:#f1f5f9;"><td colspan="4" style="text-align:right;">Kabuuang gastos</td><td>${fmt(r.total)}</td></tr>
      <tr style="font-weight:800;background:#ecfdf5;"><td colspan="4" style="text-align:right;">Puhunan bawat unit</td><td>${fmt(r.perUnit)}</td></tr>
      <tr style="font-weight:800;background:#eff6ff;"><td colspan="4" style="text-align:right;">Suggested presyong paninda bawat unit<br><small style="font-weight:500;color:#64748b;">overhead ${pricingRules.overheadPct}% + markup ${pricingRules.markupPct}%</small></td><td>${fmt(r.suggested)}</td></tr></tbody>
    </table></div>
    ${r.noCost ? `<div style="color:#b45309;font-size:0.8rem;margin-top:0.5rem;">⚠️ ${r.noCost} sangkap ang walang puhunan; ginamit ang presyong paninda nila. Ilagay ang puhunan sa Product Master.</div>` : ''}
    ${bom.notes ? `<div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:0.6rem;margin-top:0.75rem;white-space:pre-wrap;font-size:0.85rem;"><b>Paraan ng Paggawa:</b>\n${srchEsc(bom.notes)}</div>` : ''}
    <div style="display:flex;gap:0.5rem;margin-top:1rem;flex-wrap:wrap;">
      <button class="btn btn-primary" onclick="printBomReport()">🖨️ Print</button>
      <button class="btn btn-secondary" onclick="exportBomReportCSV()">⬇️ CSV</button>
      <button class="btn btn-success" onclick="applyBomPricing('${srchEsc(bom.id)}')">💰 I-apply ang Presyo sa Produkto</button>
      <button class="btn btn-secondary" onclick="closeBomReport()">Isara</button>
    </div>`;
}
function closeBomReport() { const ov = document.getElementById('bom-report-modal'); if (ov) ov.style.display = 'none'; }
function printBomReport() {
  const bom = bomRecipes.find(b => b.id === bomReportCtx.id); if (!bom) return;
  printHtmlDoc('Recipe ' + bom.finishedGoodName, bomReportHtml(bom, bomReportCtx.mult));
}
function exportBomReportCSV() {
  const bom = bomRecipes.find(b => b.id === bomReportCtx.id); if (!bom) return;
  const r = bomReportData(bom, bomReportCtx.mult);
  const rows = [['Recipe', bom.finishedGoodName], ['Code', bom.finishedGoodCode], ['Hub', bom.hub || ''], ['Batch x', r.m], ['Output', r.out], [], ['Sangkap', 'Code', 'Dami', 'Unit', 'Presyo', 'Gastos']];
  r.lines.forEach(l => rows.push([l.name, l.code, +l.qty.toFixed(4), l.uom, l.unit, l.cost]));
  rows.push([], ['Kabuuang gastos', '', '', '', '', r.total], ['Gastos bawat unit', '', '', '', '', r.perUnit]);
  downloadCSVFile(rows.map(x => x.map(csvCell).join(',')).join('\r\n'), 'Recipe_' + bom.finishedGoodCode + '.csv');
}
function visibleBoms() { const h = activeHubFilter(); return bomRecipes.filter(b => bomVisibleToHub(b, h)); }
function printAllBOMs() {
  const list = visibleBoms(); if (!list.length) { alert('Walang recipe na ipi-print.'); return; }
  printHtmlDoc('Lahat ng Recipe', list.map(b => bomReportHtml(b, 1)).join(''));
}
function exportAllBOMsCSV() {
  const list = visibleBoms(); if (!list.length) { alert('Walang recipe.'); return; }
  const rows = [['FG_Code', 'FG_Name', 'Yield', 'Hub', 'RM_Code', 'RM_Name', 'Qty', 'UOM', 'Notes']];
  list.forEach(b => (b.ingredients || []).forEach(i => rows.push([b.finishedGoodCode, b.finishedGoodName, b.yieldQty, b.hub || '', i.itemCode, i.itemName, i.qty, i.uom, b.notes || ''])));
  downloadCSVFile(rows.map(r => r.map(csvCell).join(',')).join('\r\n'), 'BOM_Recipes.csv');
}
function downloadBOMTemplate() {
  downloadCSVFile('FG_Code,FG_Name,Yield,Hub,RM_Code,RM_Name,Qty,UOM,Notes\r\nFG-RAMEN,Ramen Noodles,50,Commissary Meat,SAP-001,Harina,2,Whole,I-mix ng 10 minuto\r\nFG-RAMEN,Ramen Noodles,50,Commissary Meat,SAP-002,Tubig,5,Loose,\r\n', 'BOM_Import_Template.csv');
}
async function importBOMsCSV() {
  const text = await pickCSVFile(); if (!text) return;
  const rows = csvToObjects(text); if (!rows.length) { alert('Walang laman o mali ang format ng CSV.'); return; }
  if (!adminProductsList.length) await loadAdminProducts();
  const byCode = {}; adminProductsList.forEach(p => { byCode[hubKey(p.itemCode || p.id)] = p; byCode[hubKey(p.sapCode)] = p; });
  const groups = {};
  const problems = [];
  rows.forEach((r, n) => {
    const fg = r.fg_code; if (!fg) { problems.push(`Row ${n + 2}: walang FG_Code`); return; }
    (groups[fg] = groups[fg] || { code: fg, name: r.fg_name || fg, yieldQty: parseFloat(r.yield) || 1, hub: r.hub || '', notes: r.notes || '', lines: [] });
    if (r.notes && !groups[fg].notes) groups[fg].notes = r.notes;
    const rm = byCode[hubKey(r.rm_code)];
    const qty = parseFloat(r.qty);
    if (!rm) { problems.push(`Row ${n + 2}: walang produktong "${r.rm_code}" sa Product Master`); return; }
    if (!(qty > 0)) { problems.push(`Row ${n + 2}: mali ang Qty`); return; }
    const isWhole = /^whole$/i.test(r.uom) || hubKey(r.uom) === hubKey(rm.wholeUOM);
    groups[fg].lines.push({ itemCode: rm.id, itemName: rm.itemName, qty: qty, uom: isWhole ? 'Whole' : 'Loose', uomName: isWhole ? (rm.wholeUOM || 'Whole') : (rm.looseUOM || 'Loose'), unitPrice: parseFloat(isWhole ? rm.wholePrice : rm.loosePrice) || 0 });
  });
  const list = Object.values(groups).filter(g => g.lines.length);
  if (!list.length) { alert('Walang valid na recipe sa file.\n\n' + problems.slice(0, 10).join('\n')); return; }
  if (!await uiConfirm(`I-import ang ${list.length} recipe? (Kapag may kaparehong FG_Code na, papalitan ang sangkap nito.)` + (problems.length ? `\n\n⚠️ ${problems.length} row ang lalaktawan:\n` + problems.slice(0, 8).join('\n') : ''))) return;
  try {
    const me = getCurrentUser() || {};
    for (const g of list) {
      const bomId = 'BOM-' + g.code;
      const ex = bomRecipes.find(b => b.id === bomId);
      const fgRef = db.collection('products').doc(g.code);
      if (!(await fgRef.get()).exists) {
        await fgRef.set({ itemCode: g.code, sapCode: g.code, itemName: g.name, commissarySource: g.hub || 'Commissary Hub', scope: g.hub ? 'private' : 'shared', storageStation: 'Finished Goods (Production)', wholeUOM: 'Batches', looseUOM: 'Pcs', wholePrice: 0, loosePrice: 0, stockWhole: 0, stockLoose: 0, bufferLimit: 5, conversionFactor: g.yieldQty, createdAt: firebase.firestore.FieldValue.serverTimestamp() });
      }
      await db.collection('bom_recipes').doc(bomId).set({ finishedGoodCode: g.code, finishedGoodName: g.name, yieldQty: g.yieldQty, hub: g.hub, scope: g.hub ? 'private' : 'shared', notes: g.notes, ingredients: g.lines, revision: ex ? (ex.revision || 1) + 1 : 1, lastEditedBy: me.name || me.email || 'import', updatedAt: firebase.firestore.FieldValue.serverTimestamp() });
    }
    await logSystemAction('BOM_IMPORTED', `Nag-import ng ${list.length} recipe mula sa CSV`);
    alert(`✅ Na-import ang ${list.length} recipe.`);
    loadAdminProducts(); loadManufacturing();
  } catch (e) { alert('Error sa import: ' + e.message); }
}

// ---- Bulk import para sa Vendors at Customers ----
const IMPORT_KINDS = {
  vendors: { col: 'vendors', label: 'Vendor', file: 'Vendors_Import_Template.csv',
    header: 'Vendor_Name,Companies,Contact_Person,Contact_Details,Address,Terms\r\nABC Meat Supply,Company A; Company B,Juan Dela Cruz,09171234567,Quezon City,30 days\r\n',
    map: r => ({ name: r.vendor_name || r.name, companies: String(r.companies || r.company || '').split(/[;|]/).map(x => x.trim()).filter(Boolean), contactPerson: r.contact_person || '', contactDetails: r.contact_details || '', address: r.address || '', terms: r.terms || '' }),
    reload: () => typeof loadAdminVendors === 'function' && loadAdminVendors() },
  customers: { col: 'customers', label: 'Customer', file: 'Customers_Import_Template.csv',
    header: '#GABAY: Customer_Code = ID ng customer (iwanang blangko kung bago; awtomatikong bibigyan ng code). Customer_Name = pangalan ng customer (dito rin magtutugma ang AR). Customer_Type = Retail / Wholesale / Corporate / Branch. Burahin ang mga linyang nagsisimula sa #.\r\n#C-0001 ay halimbawa ng code.\r\nCustomer_Code,Customer_Name,Address,Contact,Bank_Details,Customer_Type\r\n,Juan Store,Manila,09181234567,BDO 1234,Retail\r\n',
    map: r => ({ code: (r.customer_code || r.customer_id || r.code || '').trim(), name: r.customer_name || r.name, address: r.address || '', contact: r.contact || '', bank: r.bank_details || r.bank || '', type: r.customer_type || r.type || 'Retail' }),
    reload: () => typeof loadAdminCustomers === 'function' && loadAdminCustomers() }
};
function nextCustomerCodes(list, n) {
  let max = 0; (list || []).forEach(c => { const m = /^C-(\d+)$/.exec((c && c.code) || ''); if (m) max = Math.max(max, +m[1]); });
  return Array.from({ length: n }, (_, i) => 'C-' + String(max + i + 1).padStart(4, '0'));
}
function downloadImportTemplate(kind) { const k = IMPORT_KINDS[kind]; if (k) downloadCSVFile(k.header, k.file); }
async function importCSVFor(kind) {
  const k = IMPORT_KINDS[kind]; if (!k) return;
  if (kind === 'vendors' && !vnIsAdmin()) { alert('Admin / Super Admin lang ang puwedeng mag-import ng vendors.'); return; }
  const text0 = await pickCSVFile(); if (!text0) return;
  const text = text0.split(/\r?\n/).filter(l => !/^\s*"?#/.test(l)).join('\n');
  const rows = csvToObjects(text).map(k.map).filter(x => x.name);
  if (!rows.length) { alert('Walang valid na row. Gamitin ang Template para sa tamang column.'); return; }
  if (!await uiConfirm(`I-import ang ${rows.length} ${k.label}? (Ia-update ang may kaparehong pangalan, dadagdagan ang bago.)`)) return;
  try {
    const snap = await db.collection(k.col).get();
    const existing = {}, byCode = {}, oldCust = []; snap.forEach(d => { const x = d.data(); existing[hubKey(x.name)] = d.id; if (x.code) { byCode[String(x.code).toLowerCase()] = d.id; } oldCust.push(x); });
    const newCodes = k.col === 'customers' ? nextCustomerCodes(oldCust, rows.length) : [];
    let batch = db.batch(), n = 0, added = 0, updated = 0, ci = 0;
    for (const r of rows) {
      const id = (r.code && byCode[String(r.code).toLowerCase()]) || existing[hubKey(r.name)];
      if (k.col === 'customers' && !r.code) { if (id) delete r.code; else r.code = newCodes[ci++]; }
      if (k.col === 'vendors') { if (!r.companies.length && vendorCo && vendorCo !== '__none') r.companies = [vendorCo]; }
      r.updatedAt = firebase.firestore.FieldValue.serverTimestamp();
      if (id && k.col === 'vendors') { const u = Object.assign({}, r); if (r.companies.length) u.companies = firebase.firestore.FieldValue.arrayUnion(...r.companies); else delete u.companies; batch.update(db.collection(k.col).doc(id), u); updated++; }
      else if (id) { batch.update(db.collection(k.col).doc(id), r); updated++; }
      else { r.createdAt = firebase.firestore.FieldValue.serverTimestamp(); batch.set(db.collection(k.col).doc(), r); added++; existing[hubKey(r.name)] = 'x'; }
      if (++n % 400 === 0) { await batch.commit(); batch = db.batch(); }
    }
    await batch.commit();
    await logSystemAction('BULK_IMPORT', `Nag-import ng ${k.label}: ${added} bago, ${updated} na-update`);
    alert(`✅ Tapos: ${added} bago, ${updated} na-update.`);
    k.reload();
  } catch (e) { alert('Error sa import: ' + e.message); }
}

// ========================================================
// 🧩 CUSTOM ROLES (hal. "HR Officer", "Warehouse Checker") — gawa ni Admin
// Ang custom role ay pinangalanang "template" ng permissions na naka-base sa Commissary o Branch.
// Pagka-assign sa user, kinokopya ang permissions sa user mismo, kaya nasusunod din ng Firestore Rules.
// ========================================================
let customRolesState = {};
let crEditingId = null;

async function loadCustomRoles() {
  try {
    const s = await db.collection('system_settings').doc('custom_roles').get();
    customRolesState = s.exists ? (s.data().roles || {}) : {};
  } catch (e) { customRolesState = {}; }
  return customRolesState;
}
async function renderAccessControlManager() {
  await renderAccessControlManagerBase();
  const root = document.getElementById('access-control-root');
  if (!root || !root.innerHTML) return;
  await loadCustomRoles();
  if (!document.getElementById('custom-roles-root')) root.insertAdjacentHTML('beforeend', '<div id="custom-roles-root"></div>');
  renderCustomRolesCard();
  await acRefreshUserCustomRole();
}
function renderCustomRolesCard() {
  const el = document.getElementById('custom-roles-root'); if (!el) return;
  const ids = Object.keys(customRolesState);
  const rows = ids.length ? ids.map(id => {
    const r = customRolesState[id];
    const mods = Object.values(r.perms || {}).filter(v => v === 'view' || v === 'edit').length;
    return `<tr><td><b>${srchEsc(r.name)}</b></td><td>${r.base === 'branch' ? '🏪 Branch' : '🏭 Commissary'}</td><td>${mods} module</td>
      <td style="white-space:nowrap;"><button class="btn btn-sm btn-primary" onclick="crEdit('${id}')">✏️ Edit</button> <button class="btn btn-sm btn-danger" onclick="crDelete('${id}')">🗑️</button></td></tr>`;
  }).join('') : '<tr><td colspan="4" style="text-align:center;color:#94a3b8;padding:1rem;">Wala pang custom role.</td></tr>';
  el.innerHTML = `<div class="card" data-notools="1">
    <div class="card-title"><span>🧩 Custom Roles (Special na Role)</span><button class="btn btn-success btn-sm" onclick="crNew()">➕ Bagong Custom Role</button></div>
    <p style="font-size:0.85rem;color:#64748b;margin-bottom:0.75rem;">Gumawa ng sariling role (hal. <b>HR Officer</b>, <b>Warehouse Checker</b>). Piliin kung Commissary o Branch ang base na page niya, at kung anong module at feature ang pinapayagan. I-assign ito sa user sa <b>Per-User Permissions</b> sa ibaba. Kapag in-edit mo ang role, awtomatikong maa-update ang lahat ng user na may ganitong role.</p>
    <div class="table-responsive"><table><thead><tr><th>Pangalan</th><th>Base Page</th><th>Access</th><th>Aksyon</th></tr></thead><tbody>${rows}</tbody></table></div>
    <div id="cr-editor"></div></div>`;
}
function crNew() { crEditingId = '__new__'; renderCustomRoleEditor({ name: '', base: 'commissary', perms: {} }); }
function crEdit(id) { crEditingId = id; renderCustomRoleEditor(customRolesState[id]); }
function crBaseChanged() { const cur = crCollect(); renderCustomRoleEditor(cur); }
function crCollect() {
  const name = (document.getElementById('cr-name') || {}).value || '';
  const base = (document.getElementById('cr-base') || {}).value || 'commissary';
  const perms = {};
  ACCESS_MODULES.filter(m => !m.adminOnly).forEach(m => { const el = document.getElementById('cr-m-' + m.key); if (el) perms[m.key] = el.value; });
  ACCESS_FEATURES.forEach(f => { const el = document.getElementById('cr-f-' + f.key); if (el) perms[f.key] = el.value; });
  return { name: name.trim(), base: base, perms: perms };
}
function renderCustomRoleEditor(r) {
  const el = document.getElementById('cr-editor'); if (!el) return;
  let mrows = '', lg = '';
  ACCESS_MODULES.filter(m => !m.adminOnly).forEach(m => {
    if (m.group !== lg) { mrows += `<tr><td colspan="2" style="background:#f1f5f9;font-weight:800;font-size:0.75rem;text-transform:uppercase;color:#64748b;">${m.group}</td></tr>`; lg = m.group; }
    mrows += `<tr><td><b>${m.label}</b></td><td>${acSelect('cr-m-' + m.key, (r.perms && r.perms[m.key]) || 'none', false)}</td></tr>`;
  });
  let frows = '', lf = '';
  ACCESS_FEATURES.filter(f => f.native === r.base).forEach(f => {
    if (f.group !== lf) { frows += `<tr><td colspan="2" style="background:#f1f5f9;font-weight:800;font-size:0.75rem;text-transform:uppercase;color:#64748b;">${f.group}</td></tr>`; lf = f.group; }
    frows += `<tr><td><b>${f.label}</b></td><td>${acSelectAllow('cr-f-' + f.key, (r.perms && r.perms[f.key]) === 'none' ? 'none' : 'edit', false)}</td></tr>`;
  });
  el.innerHTML = `<div style="border-top:2px solid #e2e8f0;margin-top:1rem;padding-top:1rem;">
    <h4 style="margin:0 0 0.5rem;">${crEditingId === '__new__' ? '➕ Bagong Custom Role' : '✏️ I-edit ang Custom Role'}</h4>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.75rem;">
      <div class="form-group"><label>Pangalan ng Role</label><input type="text" id="cr-name" value="${srchEsc(r.name)}" placeholder="Hal: HR Officer"></div>
      <div class="form-group"><label>Base Page (saan siya papasok)</label><select id="cr-base" data-nosearch="1" onchange="crBaseChanged()"><option value="commissary" ${r.base === 'commissary' ? 'selected' : ''}>🏭 Commissary Hub</option><option value="branch" ${r.base === 'branch' ? 'selected' : ''}>🏪 Branch Operations</option></select></div>
    </div>
    <div class="table-responsive"><table><thead><tr><th>Admin Module</th><th>Access</th></tr></thead><tbody>${mrows}</tbody></table></div>
    <h5 style="margin:1rem 0 0.25rem;">Mga Feature sa ${r.base === 'branch' ? 'Branch' : 'Commissary'} Page</h5>
    <div class="table-responsive"><table><thead><tr><th>Feature</th><th>Puwede?</th></tr></thead><tbody>${frows}</tbody></table></div>
    <div style="display:flex;gap:0.5rem;margin-top:1rem;"><button class="btn btn-success" onclick="crSave()">💾 I-save ang Role</button><button class="btn btn-secondary" onclick="document.getElementById('cr-editor').innerHTML='';crEditingId=null;">Kanselahin</button></div></div>`;
}
async function crSave() {
  const r = crCollect();
  if (!r.name) { alert('Ilagay ang pangalan ng role.'); return; }
  if (r.base !== 'commissary' && r.base !== 'branch') { alert('Commissary o Branch lang ang base.'); return; }
  const id = crEditingId && crEditingId !== '__new__' ? crEditingId : r.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || ('role-' + Date.now());
  customRolesState[id] = r;
  try {
    await db.collection('system_settings').doc('custom_roles').set({ roles: customRolesState, updatedAt: firebase.firestore.FieldValue.serverTimestamp() });
    // I-sync ang mga user na may ganitong role
    const us = await db.collection('users').where('customRole', '==', id).get();
    let n = 0, batch = db.batch();
    us.forEach(d => { batch.update(d.ref, { role: r.base, customRoleName: r.name, permissions: r.perms }); n++; });
    if (n) await batch.commit();
    await logSystemAction('CUSTOM_ROLE_SAVED', `Custom role "${r.name}" (${r.base}). Na-sync ang ${n} user.`);
    alert(`✅ Na-save ang role "${r.name}". ${n ? n + ' user ang na-update.' : ''}`);
    crEditingId = null; renderCustomRolesCard(); acRefreshUserCustomRole();
  } catch (e) { alert('Error: ' + e.message); }
}
async function crDelete(id) {
  const r = customRolesState[id]; if (!r || !await uiConfirm(`Burahin ang role "${r.name}"? Mananatili sa mga user ang kasalukuyang permissions nila pero wala na silang role label.`)) return;
  try {
    delete customRolesState[id];
    await db.collection('system_settings').doc('custom_roles').set({ roles: customRolesState, updatedAt: firebase.firestore.FieldValue.serverTimestamp() });
    const us = await db.collection('users').where('customRole', '==', id).get();
    const batch = db.batch(); us.forEach(d => batch.update(d.ref, { customRole: firebase.firestore.FieldValue.delete(), customRoleName: firebase.firestore.FieldValue.delete() }));
    await batch.commit();
    renderCustomRolesCard();
  } catch (e) { alert('Error: ' + e.message); }
}
// Pagpili ng custom role sa per-user editor
async function acRefreshUserCustomRole() {
  try {
    const snap = await db.collection('users').get();
    snap.forEach(d => { const u = acUsersList.find(x => x.email === d.id); if (u) { u.customRole = d.data().customRole || ''; } });
  } catch (e) {}
}
function acCustomRoleSelectHtml(u) {
  const ids = Object.keys(customRolesState);
  if (!ids.length) return '';
  const opts = '<option value="">— Walang custom role —</option>' + ids.map(id => `<option value="${id}" ${u.customRole === id ? 'selected' : ''}>🧩 ${srchEsc(customRolesState[id].name)} (${customRolesState[id].base})</option>`).join('');
  return `<div style="background:#faf5ff;border:1px solid #e9d5ff;border-radius:6px;padding:0.6rem;margin-bottom:0.75rem;">
    <label style="font-weight:700;margin-bottom:0.25rem;">🧩 Custom Role ng user</label>
    <div style="display:flex;gap:0.5rem;"><select id="ac-user-customrole" data-nosearch="1" style="flex:1;">${opts}</select><button class="btn btn-primary btn-sm" onclick="acApplyCustomRole()">I-apply</button></div>
    <small style="color:#64748b;">Ang pag-apply ay papalit sa lahat ng permission ng user ayon sa role. Puwede ka pa ring maglagay ng exception pagkatapos.</small></div>`;
}
async function acApplyCustomRole() {
  const u = acUsersList.find(x => x.email === acPickedEmail); if (!u) return;
  const id = document.getElementById('ac-user-customrole').value;
  try {
    if (!id) {
      await db.collection('users').doc(u.email).update({ customRole: firebase.firestore.FieldValue.delete(), customRoleName: firebase.firestore.FieldValue.delete() });
      u.customRole = '';
    } else {
      const r = customRolesState[id]; if (!r) return;
      await db.collection('users').doc(u.email).update({ role: r.base, customRole: id, customRoleName: r.name, permissions: r.perms });
      u.customRole = id; u.role = r.base; u.permissions = { ...r.perms };
    }
    await logSystemAction('CUSTOM_ROLE_ASSIGNED', `${u.email} → ${id ? customRolesState[id].name : 'walang custom role'}`);
    alert('✅ Na-apply. Tatalab sa susunod na load ng page ng user.');
    acPickUser(u);
  } catch (e) { alert('Error: ' + e.message); }
}


// ========================================================
// 📋 BRANCH INVENTORY (Kitchen at Wares) — bilang kada station, may scan, larawan, print, CSV, pirma at variance report
// ID ng bawat item = SAP/subcode ng product. Ang listahan ng items ay per COMPANY (hal. KNGK, Tanoshi).
// Collections: companies, branch_stations, inventory_branches, inventory_items, inventory_counts, inventory_item_requests, product_photos
// ========================================================
const INV_TYPES = { kitchen: '🍳 Kitchen', wares: '🥢 Wares' };
let invCompaniesList = [], invStationsList = [], invBranchMap = {};
const invPhotoCache = {};
const invCountsCache = {};
function invSlug(s) { return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); }
function invToday() { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 10); }
// Fixed ang petsa ng inventory: tuwing Linggo (weekly) at huling araw ng buwan (month-end). Isa lang kapag Linggo ang month-end.
function invCountDates(extra) {
  const out = [], t0 = new Date(invToday() + 'T00:00:00'), pad = n => String(n).padStart(2, '0');
  for (let i = 0; i < 120; i++) { const d = new Date(t0); d.setDate(d.getDate() - i); const ds = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; if (d.getDay() === 0 || new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate() === d.getDate()) out.push(ds); }
  if (extra && !out.includes(extra)) { out.push(extra); out.sort().reverse(); } return out;
}
function invDateOptions() { const sel = invState.date; return invCountDates(sel).map(d => { const k = invKind(d); return `<option value="${d}" ${d === sel ? 'selected' : ''}>${d} — ${k ? k.replace(/ \(.*\)/, '') : 'iba pang petsa'}</option>`; }).join(''); }
function invWho() { const u = getCurrentUser() || {}; return u.name || u.email || ''; }
function invNum(v) { const n = parseFloat(v); return isNaN(n) ? null : n; }

// ---- Larawan ng item (naka-compress, hiwalay na collection para hindi bumigat ang product list) ----
function compressImageFile(file, maxDim, quality) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = e => {
      const img = new Image();
      img.onload = () => {
        const k = Math.min(1, maxDim / Math.max(img.width, img.height));
        const c = document.createElement('canvas');
        c.width = Math.max(1, Math.round(img.width * k)); c.height = Math.max(1, Math.round(img.height * k));
        const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(img, 0, 0, c.width, c.height);
        resolve(c.toDataURL('image/jpeg', quality));
      };
      img.onerror = () => reject(new Error('Hindi mabasa ang larawan.'));
      img.src = e.target.result;
    };
    r.onerror = () => reject(new Error('Hindi mabasa ang file.'));
    r.readAsDataURL(file);
  });
}
async function invGetPhoto(code) {
  if (!code) return '';
  if (code in invPhotoCache) return invPhotoCache[code];
  try { const d = await db.collection('product_photos').doc(code).get(); const x = d.exists ? d.data() : {}; invPhotoCache[code] = x.dataUrl || invDriveThumb(x.link) || ''; } catch (e) { invPhotoCache[code] = ''; }
  return invPhotoCache[code];
}
async function invSaveFormPhoto(code, inputId) {
  const f = document.getElementById(inputId);
  if (!f || !f.files || !f.files[0] || !code) return;
  try {
    const url = await compressImageFile(f.files[0], 360, 0.72);
    const u = getCurrentUser() || {};
    await db.collection('product_photos').doc(code).set({ dataUrl: url, updatedBy: u.email || '', updatedAt: firebase.firestore.FieldValue.serverTimestamp() });
    await db.collection('products').doc(code).set({ hasPhoto: true }, { merge: true });
    invPhotoCache[code] = url; f.value = '';
  } catch (e) { alert('⚠️ Na-save ang produkto pero hindi ang larawan: ' + e.message); }
}
function invPhotoChosen(input, previewId) {
  const pv = document.getElementById(previewId);
  if (!pv || !input.files || !input.files[0]) return;
  compressImageFile(input.files[0], 360, 0.72).then(u => { pv.src = u; pv.style.display = 'inline-block'; }).catch(e => alert(e.message));
}
async function invLoadPhotoPreview(code, previewId) {
  const pv = document.getElementById(previewId); if (!pv) return;
  pv.style.display = 'none'; pv.removeAttribute('src');
  const u = await invGetPhoto(code);
  if (u) { pv.src = u; pv.style.display = 'inline-block'; }
}
async function invHydratePhotos(root) {
  const imgs = [...root.querySelectorAll('img[data-photo]')];
  for (let i = 0; i < imgs.length; i += 6) {
    await Promise.all(imgs.slice(i, i + 6).map(async im => { const u = await invGetPhoto(im.dataset.photo); if (u) { im.src = u; im.style.visibility = 'visible'; } }));
  }
}

// ---- Master data ----
async function invLoadMasters() {
  invCompaniesList = []; invStationsList = []; invBranchMap = {};
  try { (await db.collection('companies').get()).forEach(d => invCompaniesList.push(d.data().name || d.id)); } catch (e) {}
  try { (await db.collection('branch_stations').get()).forEach(d => invStationsList.push(d.data().name || d.id)); } catch (e) {}
  try { (await db.collection('inventory_branches').get()).forEach(d => { invBranchMap[d.id] = d.data(); }); } catch (e) {}
  invCompaniesList.sort((a, b) => a.localeCompare(b)); invStationsList.sort((a, b) => a.localeCompare(b));
}
function invFill(id, list, first, icon) {
  const el = document.getElementById(id); if (!el) return;
  const cur = el.value;
  el.innerHTML = `<option value="">${first}</option>` + list.map(n => `<option value="${srchEsc(n)}">${icon} ${srchEsc(n)}</option>`).join('');
  setSelValue(el, cur);
}

// ---- Pangkalahatang sheet HTML (print) ----
function invSheetHtml(o) {
  const rows = o.rows.map((r, i) => `<tr><td>${i + 1}</td>${o.photos ? `<td style="width:62px;">${r.photo ? `<img src="${r.photo}" style="width:56px;height:56px;object-fit:cover;border:1px solid #cbd5e1;">` : ''}</td>` : ''}<td>${srchEsc(r.code)}</td><td>${srchEsc(r.name)}</td><td>${srchEsc(r.conv > 1 ? (r.wuom || 'Whole') + ' / ' + r.uom : r.uom)}</td>${o.split ? (r.conv > 1 ? `<td class="num" style="min-width:60px;height:${o.photos ? 44 : 26}px;">${r.w == null || r.w === '' ? '' : srchEsc(r.w)}</td><td class="num" style="min-width:60px;">${r.l == null || r.l === '' ? '' : srchEsc(r.l)}</td>` : `<td class="num" style="background:#e5e7eb;"></td><td class="num" style="min-width:60px;height:${o.photos ? 44 : 26}px;">${r.qty == null || r.qty === '' ? '' : srchEsc(r.qty)}</td>`) : `<td class="num" style="min-width:90px;height:${o.photos ? 44 : 26}px;">${r.qty == null || r.qty === '' ? '' : srchEsc(r.qty)}</td>`}</tr>`).join('');
  return `<div class="pg"><h1>📋 Inventory Count Sheet — ${srchEsc(o.station)}</h1>
    <div class="meta">Branch: <b>${srchEsc(o.branch)}</b> (${srchEsc(o.branchCode)}) · Company: <b>${srchEsc(o.company)}</b> · Petsa: <b>${srchEsc(o.date)}</b>${o.type ? ' · ' + srchEsc(o.type) : ''}<br>${printedByLine()}</div>
    <table><thead><tr><th>#</th>${o.photos ? '<th>Larawan</th>' : ''}<th>Inventory ID</th><th>Item Description</th><th>UOM</th>${o.split ? '<th class="num">Whole</th><th class="num">Loose</th>' : '<th class="num">Bilang</th>'}</tr></thead><tbody>${rows}</tbody></table>
    <div class="sign"><div>Binilang ni (Checked by)<br><b>${srchEsc(o.checkedBy || '')}</b></div><div>Tinanggap / Inaprubahan ni (Received / Approved by)<br><b>${srchEsc(o.receivedBy || '')}</b></div></div>
    ${o.remarks ? `<div class="box">Remarks: ${srchEsc(o.remarks)}</div>` : ''}</div>`;
}

// ========================================================
// 🏪 BRANCH PAGE: Inventory Count
// ========================================================
let invState = { branch: '', branchCode: '', company: '', station: '', type: '', date: '', items: [], products: {}, entries: {}, temps: [], ready: false, error: '' };
let invHistory = [];

async function loadBranchInventory() {
  const root = document.getElementById('branch-inventory-root'); if (!root || !db) return;
  const u = getCurrentUser() || {};
  root.innerHTML = '<div class="card">Kinukuha ang inventory list ng branch...</div>';
  try {
    await invLoadMasters();
    const key = invSlug(u.branch);
    const br = invBranchMap[key];
    if (!u.branch || !br || !br.company) {
      invState.ready = false;
      root.innerHTML = `<div class="card"><div class="card-title">📋 Inventory Count</div><p style="color:#b45309;">⚠️ Hindi pa naka-setup ang branch mo (${srchEsc(u.branch || 'walang branch')}). Hilingin kay Admin na lagyan ng <b>Branch Code</b> at <b>Company</b> sa Admin → Branch Inventory → Setup.</p></div>`;
      return;
    }
    invState.branch = u.branch; invState.branchCode = br.code || key.toUpperCase(); invState.company = br.company;
    const [iSnap, pSnap] = await Promise.all([db.collection('inventory_items').where('company', '==', br.company).get(), db.collection('products').get()]);
    invState.items = []; iSnap.forEach(d => invState.items.push({ id: d.id, ...d.data() }));
    invState.products = {}; pSnap.forEach(d => { invState.products[d.id] = { id: d.id, ...d.data() }; });
    invState.items.sort((a, b) => String(a.itemName).localeCompare(String(b.itemName)));
    // Kada branch ay may sariling station setup (malaya silang maglipat ng item sa ibang station)
    let smDoc = null; try { const sm = await db.collection('inventory_station_map').doc(invSlug(invState.branchCode)).get(); if (sm.exists) smDoc = sm.data(); } catch (e) {}
    invState.stationItems = invBuildStationItems(smDoc);
    invState.bom = await invLoadBom(br.company, invState.branchCode);
    if (!invState.date) invState.date = invCountDates()[0];
    const stations = invStationNames();
    if (!invState.station || !stations.includes(invState.station)) invState.station = stations[0] || '';
    invState.ready = true;
    invLoadDraft();
    invRenderMain();
    invLoadHistory();
  } catch (e) { root.innerHTML = `<div class="card">Error: ${srchEsc(e.message)}</div>`; }
}

// ---- Station setup ng branch: bawat branch ang nagtatakda kung saang station nakalagay ang item
let invStnDraft = null, invStnSel = '';
function invStationMapOpen() { invStnDraft = JSON.parse(JSON.stringify(invState.stationItems || {})); invStnSel = invState.station || invStationNames()[0] || ''; invStnRender(); }
function invStnRender() {
  const D = invStnDraft, names = Object.keys(D).sort(invNatSort); const by = {}; invState.items.forEach(i => by[i.itemCode] = i);
  if (!D[invStnSel]) invStnSel = names[0] || '';
  const list = (D[invStnSel] || []).map(c => by[c]).filter(Boolean).sort((a, b) => String(invItemName(a)).localeCompare(String(invItemName(b))));
  const also = i => Object.keys(D).filter(k => k !== invStnSel && D[k].includes(i.itemCode));
  arModal(`<h3>📍 Station Setup — ${srchEsc(invState.branch)}</h3><p style="font-size:.85rem;color:#64748b;">Ikaw ang bahala sa mga station ng branch mo: magdagdag, palitan ang pangalan, at maglagay ng produkto. Puwedeng nasa higit sa isang station ang parehong item (pagsasamahin sa Count Result).</p>
    <div style="display:flex;gap:.4rem;flex-wrap:wrap;align-items:center;margin-bottom:.5rem;"><select id="stn-pick" onchange="invStnSel=this.value;invStnRender()">${names.map(n => `<option ${n === invStnSel ? 'selected' : ''}>${srchEsc(n)}</option>`).join('') || '<option value="">(walang station)</option>'}</select>
      <button class="btn btn-secondary btn-sm" onclick="invStnNew()">➕ Bagong station</button><button class="btn btn-secondary btn-sm" onclick="invStnRename()">✏️ Pangalan</button><button class="btn btn-secondary btn-sm" onclick="invStnDelete()">🗑️ Burahin</button></div>
    <div style="position:relative;margin-bottom:.5rem;"><input type="search" id="stn-add-q" placeholder="🔎 Mag-add ng produkto sa ${srchEsc(invStnSel || 'station')} (code / pangalan)" oninput="kDeb(()=>invStnSearch(),'bq3')" style="width:100%;"><div id="stn-add-res" style="position:absolute;z-index:5;left:0;right:0;background:#fff;border:1px solid #e2e8f0;border-radius:.4rem;max-height:200px;overflow:auto;display:none;"></div></div>
    <div style="max-height:45vh;overflow:auto;"><table data-notools="1"><thead><tr><th>Code</th><th>Item (${list.length})</th><th>Uri</th><th></th></tr></thead><tbody>${list.map(i => `<tr><td style="font-size:.75rem;color:#64748b;"><img data-photo="${srchEsc(i.itemCode)}" style="width:42px;height:42px;object-fit:cover;border-radius:6px;visibility:hidden;display:block;margin-bottom:2px;">${srchEsc(i.itemCode)}</td><td>${srchEsc(invItemName(i))}${also(i).length ? `<br><small style="color:#7c3aed;">din sa: ${srchEsc(also(i).join(', '))}</small>` : ''}</td><td>${srchEsc(INV_TYPES[i.type] || '')}</td><td style="white-space:nowrap;"><button class="btn btn-sm btn-secondary" title="Mag-upload / palitan ang larawan" onclick="invStnPhoto('${srchEsc(i.itemCode)}')">📷</button> <button class="btn btn-sm btn-secondary" onclick="invStnRemove('${srchEsc(i.itemCode)}')">✖</button></td></tr>`).join('') || '<tr><td colspan="4" style="color:#94a3b8;text-align:center;">Walang laman ang station. Mag-search sa itaas para magdagdag.</td></tr>'}</tbody></table></div>
    <div style="margin-top:.6rem;display:flex;gap:.4rem;"><button class="btn btn-success" onclick="invStationMapSave()">💾 I-save</button><button class="btn btn-secondary" onclick="invStationMapReset()">↺ Ibalik sa default ng company</button></div>`);
  const _m = document.getElementById('ar-modal') || document.body; invHydratePhotos(_m);
}
async function invStnNew() { const n = (await uiPrompt('Pangalan ng bagong station (hal. Station 9, Walk-in Chiller):') || '').trim(); if (!n) return; if (invStnDraft[n]) { alert('Mayroon nang station na ganyan.'); return; } invStnDraft[n] = []; invStnSel = n; invStnRender(); }
async function invStnRename() { if (!invStnSel) return; const n = (await uiPrompt('Bagong pangalan:', invStnSel) || '').trim(); if (!n || n === invStnSel) return; if (invStnDraft[n]) { alert('Mayroon nang station na ganyan.'); return; } invStnDraft[n] = invStnDraft[invStnSel]; delete invStnDraft[invStnSel]; invStnSel = n; invStnRender(); }
async function invStnDelete() { if (!invStnSel) return; if (!await uiConfirm(`Burahin ang "${invStnSel}"? (Hindi buburahin ang mga produkto, matatanggal lang sa station.)`)) return; delete invStnDraft[invStnSel]; invStnSel = ''; invStnRender(); }
function invStnRemove(code) { invStnDraft[invStnSel] = (invStnDraft[invStnSel] || []).filter(c => c !== code); invStnRender(); }
function invStnSearch() {
  const q = (document.getElementById('stn-add-q').value || '').trim(), box = document.getElementById('stn-add-res'); if (!q || !invStnSel) { box.style.display = 'none'; return; }
  const have = new Set(invStnDraft[invStnSel] || []); const res = invState.items.filter(i => !have.has(i.itemCode) && smartMatch(q, invItemName(i), i.itemCode)).slice(0, 12);
  const inItems = new Set(invState.items.map(i => i.itemCode)); const np = Object.keys(invState.products).filter(c => !inItems.has(c) && smartMatch(q, invState.products[c].itemName || c, c)).slice(0, 8);
  box.innerHTML = res.map(i => `<div style="padding:.4rem .6rem;border-bottom:1px solid #f1f5f9;cursor:pointer;" onclick="invStnAdd('${srchEsc(i.itemCode)}')">➕ <b>${srchEsc(invItemName(i))}</b> <small style="color:#64748b;">${srchEsc(i.itemCode)} · ${srchEsc(INV_TYPES[i.type] || '')}</small></div>`).join('') + np.map(c => `<div style="padding:.4rem .6rem;border-bottom:1px solid #f1f5f9;cursor:pointer;background:#fffbeb;" onclick="invStnAddNew('${srchEsc(c)}')">🆕 <b>${srchEsc(invState.products[c].itemName || c)}</b> <small style="color:#64748b;">${srchEsc(c)} · idagdag sa inventory ng company</small></div>`).join('') || (res.length ? '' : '<div style="padding:.5rem;color:#94a3b8;">Walang nahanap sa produkto.</div>'); box.style.display = 'block';
}
async function invStnAddNew(code) {
  const p = invState.products[code]; if (!p || !invStnSel) { alert('Gumawa muna ng station.'); return; }
  const t = (await uiPrompt(`Uri ng "${p.itemName || code}": 1 = Kitchen, 2 = Wares`, /ware/i.test(p.itemGroup || p.category || '') ? '2' : '1') || '').trim(); if (!t) return;
  const type = t === '2' ? 'wares' : 'kitchen', rec = { company: invState.company, itemCode: code, itemName: p.itemName || code, type, station: invStnSel, countUOM: p.looseUOM || p.wholeUOM || 'Pcs', addedBy: invWho(), updatedAt: new Date().toISOString() };
  try { await db.collection('inventory_items').doc(`${invState.company}__${code}`).set(rec, { merge: true }); invState.items.push({ id: `${invState.company}__${code}`, ...rec }); invStnAdd(code); } catch (e) { alert('Error: ' + e.message); }
}
function invStnPhoto(code) {
  const f = document.createElement('input'); f.type = 'file'; f.accept = 'image/*'; f.setAttribute('capture', 'environment');
  f.onchange = async () => { if (!f.files || !f.files[0]) return; try { const url = await compressImageFile(f.files[0], 360, 0.72); await db.collection('product_photos').doc(code).set({ dataUrl: url, updatedBy: invWho(), updatedAt: new Date().toISOString() }); invPhotoCache[code] = url; invStnRender(); } catch (e) { alert('⚠️ Hindi na-save ang larawan: ' + e.message); } };
  f.click();
}
function invStnAdd(code) { if (!invStnSel) { alert('Gumawa muna ng station.'); return; } if (!invStnDraft[invStnSel].includes(code)) invStnDraft[invStnSel].push(code); invStnRender(); setTimeout(() => { const q = document.getElementById('stn-add-q'); if (q) q.focus(); }, 50); }
async function invStationMapSave() {
  try { await db.collection('inventory_station_map').doc(invSlug(invState.branchCode)).set({ branchCode: invState.branchCode, branch: invState.branch, stations: invStnDraft, updatedBy: invWho(), updatedAt: new Date().toISOString() }); arCloseModal(); alert(`✅ Na-save ang ${Object.keys(invStnDraft).length} station.`); loadBranchInventory(); } catch (e) { alert('Error: ' + e.message); }
}
async function invStationMapReset() { if (!await uiConfirm('Ibalik ang mga station sa default ng company? Mawawala ang mga station na ginawa mo.')) return; try { await db.collection('inventory_station_map').doc(invSlug(invState.branchCode)).delete(); arCloseModal(); loadBranchInventory(); } catch (e) { alert('Error: ' + e.message); } }
// ---- Prepared items / BOM: ang prepared item (hal. TOMATO SLICE) ay naka-link sa raw item (TOMATO kg). Admin = default ng company, Branch = sariling override.
function invBomComps(b) { return !b ? [] : (b.components && b.components.length ? b.components : (b.raw ? [{ raw: b.raw, factor: b.factor, yield: b.yield }] : [])); }
async function invLoadBom(company, branchCode) {
  const m = {}; const rd = async id => { try { const d = await db.collection('inventory_bom').doc(id).get(); return d.exists ? (d.data().boms || {}) : {}; } catch (e) { return {}; } };
  const c = await rd('company_' + invSlug(company)), b = await rd('branch_' + invSlug(branchCode));
  Object.keys(c).forEach(k => m[k] = { ...c[k], src: 'company' }); Object.keys(b).forEach(k => m[k] = { ...b[k], src: 'branch' }); return m;
}
let invBomD = null;
async function invBomOpen(scope, ov) {
  let company, bc, bname, items = [], prods = {};
  if (scope === 'branch' && ov) { company = ov.company; bc = ov.bc; bname = ov.bname; const [iS, pS] = await Promise.all([db.collection('inventory_items').where('company', '==', company).get(), db.collection('products').get()]); iS.forEach(d => items.push(d.data())); pS.forEach(d => prods[d.id] = d.data()); }
  else if (scope === 'branch') { company = invState.company; bc = invState.branchCode; bname = invState.branch; items = invState.items; prods = invState.products; }
  else { const sel = document.getElementById('inv-company-sel'); company = sel && sel.value; if (!company) { alert('Pumili muna ng Company sa dropdown.'); return; }
    const [iS, pS] = await Promise.all([db.collection('inventory_items').where('company', '==', company).get(), db.collection('products').get()]); iS.forEach(d => items.push(d.data())); pS.forEach(d => prods[d.id] = d.data()); }
  const id = scope === 'branch' ? 'branch_' + invSlug(bc) : 'company_' + invSlug(company); let own = {}, inh = {};
  try { const d = await db.collection('inventory_bom').doc(id).get(); if (d.exists) own = d.data().boms || {}; if (scope === 'branch') inh = await (async () => { try { const c = await db.collection('inventory_bom').doc('company_' + invSlug(company)).get(); return c.exists ? (c.data().boms || {}) : {}; } catch (e) { return {}; } })(); } catch (e) {}
  const nm = {}, um = {}; Object.keys(prods).forEach(k => { nm[k] = prods[k].itemName || k; um[k] = prods[k].looseUOM || prods[k].wholeUOM || ''; }); items.forEach(i => { nm[i.itemCode] = nm[i.itemCode] || i.itemName || i.itemCode; if (i.countUOM) um[i.itemCode] = i.countUOM; });
  if (scope !== 'branch') { try { const ss = await db.collection('sap_items').where('company', '==', company).get(); ss.forEach(d => { const x = d.data(); if (x.itemCode && !nm[x.itemCode]) { nm[x.itemCode] = x.itemName || x.itemCode; um[x.itemCode] = x.invUom || x.purchUom || ''; } }); } catch (e) {} }
  invBomD = { scope, id, company, bc, bname, um, own: JSON.parse(JSON.stringify(own)), inh, nm, itemCodes: [...new Set(items.map(i => i.itemCode))], allCodes: Object.keys(nm), pick: { prep: '', raw: '' } }; invBomRender();
}
async function invBomBranchPick() {
  const sel = document.getElementById('inv-company-sel'), company = sel && sel.value; if (!company) { alert('Pumili muna ng Company sa dropdown.'); return; }
  let brs = [], have = new Set(); try { const [b, m] = await Promise.all([db.collection('inventory_branches').where('company', '==', company).get(), db.collection('inventory_bom').get()]); b.forEach(d => brs.push(d.data())); m.forEach(d => { if (/^branch_/.test(d.id)) have.add(d.id); }); } catch (e) { alert('Error: ' + e.message); return; }
  brs.sort((a, b) => String(a.branch).localeCompare(String(b.branch)));
  window._bomBrs = brs; arModal(`<h3>🏪 BOM ng Branch — ${srchEsc(company)}</h3><p style="font-size:.85rem;color:#64748b;">Pumili ng branch na ie-edit ang BOM. Ang branch BOM ay mas mananaig sa default ng company.</p>${brs.map((b, i) => `<button class="btn btn-secondary" style="display:block;width:100%;text-align:left;margin:.25rem 0;" onclick="invBomOpen('branch', { company: ${JSON.stringify(company).replace(/"/g, '&quot;')}, bc: window._bomBrs[${i}].code, bname: window._bomBrs[${i}].branch })">🏪 ${srchEsc(b.branch)} <small style="color:#64748b;">${srchEsc(b.code || '')}${have.has('branch_' + invSlug(b.code)) ? ' · ✅ may sariling BOM' : ''}</small></button>`).join('') || '<small style="color:#94a3b8;">Walang branch sa company na ito.</small>'}`);
}
const BOM_UNITS = { g: ['w', 1], kg: ['w', 1000], mg: ['w', 0.001], ml: ['v', 1], l: ['v', 1000] };
function invBomFactor(q, unit, rawUom) { const u = BOM_UNITS[String(unit || '').toLowerCase()], r = BOM_UNITS[String(rawUom || '').toLowerCase()]; return u && r && u[0] === r[0] ? q * u[1] / r[1] : q; }
function invBomTotals(e) {
  let w = 0, v = 0, other = 0; invBomComps(e).forEach(b => { const u = BOM_UNITS[String(b.unit || '').toLowerCase()], q = +b.qty; if (!q) return; if (!u) { other++; return; } const base = q * u[1]; if (u[0] === 'w') w += base; else if (b.free && /tubig|water|yelo|ice/i.test(b.name || '')) w += base; else v += base; });
  const o = e && e.out && +e.out.qty > 0 ? e.out : null, ou = o ? BOM_UNITS[String(o.unit || '').toLowerCase()] : null;
  return { w, v, other, out: o && ou ? { base: +o.qty * ou[1], kind: ou[0] } : null };
}
function invBomFmt(g, kind) { g = Math.round(g * 100) / 100; if (kind === 'v') return g >= 1000 ? (Math.round(g) / 1000) + ' L' : g + ' ml'; return g >= 1000 ? (Math.round(g) / 1000) + ' kg' : g + ' g'; }
function invBomSummary(e, comps) {
  const T = invBomTotals(e), parts = []; if (T.w) parts.push('Timbang: <b>' + invBomFmt(T.w, 'w') + '</b>'); if (T.v) parts.push('Volume: <b>' + invBomFmt(T.v, 'v') + '</b>'); if (T.other) parts.push(T.other + ' sangkap ay hindi g/ml');
  let h = parts.join(' · '); if (T.out) h += (h ? ' · ' : '') + 'Nagagawa (actual): <b>' + invBomFmt(T.out.base, T.out.kind) + '</b>'; else if (T.w || T.v) h += ' <small>(= kabuuang nagagawa ng 1 prep item)</small>'; return h;
}
function invBomMode(b) { return b && b.mode === 'deduct' ? 'deduct' : 'add'; }
function invBomRender() {
  const D = invBomD, n = c => srchEsc((D.nm[c] || c));
  const grp = (p, e, ro) => { if (invBomHide(e, p)) return `<tr style="background:#f8fafc;"><td colspan="4"><b>🔒 ${n(p)}</b> <small style="color:#64748b;">Secret recipe — nakatago ang mga sangkap (tuloy ang gastos at inventory).</small> <button class="btn btn-sm btn-secondary" onclick="invBomUnlock('${srchEsc(p)}')">🔓 Password</button></td></tr>`; const cs = invBomComps(e), md = invBomMode(e); return `<tr style="background:#f8fafc;"><td colspan="3"><b>🧪 ${n(p)}</b> <small style="color:#64748b;">${srchEsc(p)}</small></td><td style="text-align:right;white-space:nowrap;">${ro ? '<small style="color:#7c3aed;">company</small>' : `<button class="btn btn-sm btn-secondary" onclick="invBomToggle('${srchEsc(p)}')">${md === 'add' ? '➕ Idinadagdag sa raw (From BOM)' : '➖ Ibinabawas sa raw'}</button>`}</td></tr><tr><td colspan="4" style="font-size:.8rem;background:#f0f9ff;padding:.3rem .6rem;">📏 ${invBomSummary(e, cs) || '<small>Maglagay ng dami para makita ang kabuuan.</small>'}${ro ? '' : ` <button class="btn btn-sm btn-secondary" onclick="invBomOut('${srchEsc(p)}')">✏️ Actual na nagagawa</button>`}</td></tr>` + cs.map((b, i) => `<tr><td style="padding-left:1.2rem;">${b.free ? '💧 ' + srchEsc(b.name || 'Iba pa') + '<br><small style="color:#64748b;">hindi ibinabawas sa inventory</small>' : n(b.raw) + '<br><small style="color:#64748b;">' + srchEsc(b.raw) + (x ? '<br>🕒 ' + bmDates(x) : '') + '</small>'}</td><td style="text-align:right;">${b.qty ? srchEsc(b.qty + ' ' + (b.unit || '')) : '× ' + +b.factor}</td><td style="text-align:right;"><small>${b.free ? '—' : '= ' + Math.round(b.factor * 10000) / 10000 + ' ' + srchEsc(D.um[b.raw] || '')}${+b.yield > 0 && +b.yield < 100 ? '<br>yield ' + +b.yield + '%' : ''}</small></td><td>${ro ? '' : `<button class="btn btn-sm btn-secondary" onclick="invBomDel('${srchEsc(p)}',${i})">✖</button>`}</td></tr>`).join(''); };
  const mine = Object.keys(D.own).map(p => grp(p, D.own[p], false)).join(''), inh = Object.keys(D.inh).filter(p => !D.own[p]).map(p => grp(p, D.inh[p], true)).join('');
  arModal(`<h3>🧪 Prepared Items / BOM — ${srchEsc(D.scope === 'branch' ? D.bname : D.company + ' (default ng lahat ng branch)')}</h3>
  <p style="font-size:.84rem;color:#64748b;">Hakbang: <b>1)</b> Piliin ang prep item. <b>2)</b> Piliin ang sangkap (master product${D.scope === 'branch' ? '' : ' o galing SAP'}), ilagay ang dami at unit na ginagamit sa <b>1</b> prep item (hal. Pork Belly 200 g). Sa Count Result, kapag nabilang ang prep item, ang katumbas na <b>sangkap ay idadagdag</b> sa bilang ng main item niya bilang <b>“From BOM”</b> (ayon sa Excel ninyo) — o ibawas kung pipiliin mo (button sa tabi ng prep).${D.scope === 'branch' ? ' Para sa branch mo lang ito at mas mananaig sa default ng company.' : ''}</p>
  <div style="display:grid;gap:.4rem;margin-bottom:.6rem;">
    <div style="position:relative;"><input type="search" id="bom-q-prep" placeholder="1) Prep item (hal. GYOZA - PREPARED)" oninput="kDeb(()=>invBomSearch('prep'),'bq1')" style="width:100%;"><div id="bom-r-prep" style="position:absolute;z-index:6;left:0;right:0;background:#fff;border:1px solid #e2e8f0;max-height:180px;overflow:auto;display:none;"></div></div>
    <div style="position:relative;"><input type="search" id="bom-q-raw" placeholder="2) Sangkap / main item (hal. PORK BELLY kg)" oninput="kDeb(()=>invBomSearch('raw'),'bq2')" style="width:100%;"><div id="bom-r-raw" style="position:absolute;z-index:5;left:0;right:0;background:#fff;border:1px solid #e2e8f0;max-height:180px;overflow:auto;display:none;"></div></div>
    <div style="display:flex;gap:.4rem;flex-wrap:wrap;align-items:center;"><input type="number" id="bom-f" value="" placeholder="Dami" step="any" min="0" style="width:90px;"><select id="bom-u" data-nosearch="1" style="width:80px;"><option>g</option><option>kg</option><option>ml</option><option>L</option><option value="">pcs/iba</option></select><input type="number" id="bom-y" value="100" step="any" min="1" max="100" style="width:80px;" title="Yield %"><small style="color:#64748b;">Yield % (karaniwang 100)</small><button class="btn btn-success" onclick="invBomAdd()">➕ Idagdag</button><button class="btn btn-secondary" onclick="invBomAddFree()" title="Tubig o sangkap na wala sa inventory">💧 Tubig / iba pa</button></div></div>
  <div style="max-height:40vh;overflow:auto;"><table data-notools="1"><thead><tr><th>Sangkap</th><th style="text-align:right;">Dami</th><th style="text-align:right;">Sa UOM ng raw</th><th></th></tr></thead><tbody>${mine}${inh || ''}${!mine && !inh ? '<tr><td colspan="4" style="color:#94a3b8;text-align:center;">Wala pang recipe.</td></tr>' : ''}</tbody></table></div>
  <div style="margin-top:.6rem;"><button class="btn btn-success" onclick="invBomSave()">💾 I-save</button></div>`);
  ['prep', 'raw'].forEach(w => { const el = document.getElementById('bom-q-' + w); if (el && D.pick[w]) el.value = (D.nm[D.pick[w]] || D.pick[w]); });
}
function invBomToggle(p) { const e = invBomD.own[p]; if (!e) return; e.mode = invBomMode(e) === 'add' ? 'deduct' : 'add'; invBomRender(); }
function invBomSearch(w) {
  const D = invBomD, q = (document.getElementById('bom-q-' + w).value || '').trim(), box = document.getElementById('bom-r-' + w); D.pick[w] = ''; if (!q) { box.style.display = 'none'; return; }
  const pool = w === 'prep' ? D.itemCodes : D.allCodes; const res = pool.filter(c => smartMatch(q, D.nm[c] || c, c)).slice(0, 12);
  box.innerHTML = res.map(c => `<div style="padding:.4rem .6rem;border-bottom:1px solid #f1f5f9;cursor:pointer;" onclick="invBomPick('${w}','${srchEsc(c)}')"><b>${srchEsc(D.nm[c] || c)}</b> <small style="color:#64748b;">${srchEsc(c)}</small></div>`).join('') || '<div style="padding:.5rem;color:#94a3b8;">Walang nahanap.</div>'; box.style.display = 'block';
}
function invBomPick(w, c) { invBomD.pick[w] = c; document.getElementById('bom-q-' + w).value = invBomD.nm[c] || c; document.getElementById('bom-r-' + w).style.display = 'none'; }
function invBomAdd() {
  const D = invBomD, p = D.pick.prep, r = D.pick.raw, q = +document.getElementById('bom-f').value, un = document.getElementById('bom-u').value, y = +document.getElementById('bom-y').value; if (!p || !r) { alert('Pumili ng prep item at sangkap mula sa listahan.'); return; } if (p === r) { alert('Magkaiba dapat ang prep item at sangkap.'); return; } if (!(q > 0)) { alert('Ilagay ang dami (higit sa 0).'); return; } if (!(y > 0 && y <= 100)) { alert('Ang yield ay dapat 1–100%.'); return; }
  if (!D.own[p]) D.own[p] = { components: JSON.parse(JSON.stringify(invBomComps(D.inh[p]))), mode: invBomMode(D.inh[p]), ...(D.inh[p] && D.inh[p].out ? { out: D.inh[p].out } : {}) };
  const cs = D.own[p].components = invBomComps(D.own[p]).slice(); const ex = cs.findIndex(x => x.raw === r); const nc = { raw: r, qty: q, unit: un, factor: invBomFactor(q, un, D.um[r]), yield: y }; if (ex >= 0) cs[ex] = nc; else cs.push(nc); D.pick = { prep: '', raw: '' }; invBomRender();
}
async function invBomAddFree() {
  const D = invBomD, p = D.pick.prep, q = +document.getElementById('bom-f').value, un = document.getElementById('bom-u').value; if (!p) { alert('Pumili muna ng prep item (1).'); return; } if (!(q > 0)) { alert('Ilagay ang dami at unit sa itaas.'); return; }
  const nm = (await uiPrompt('Pangalan ng sangkap na hindi ibinabawas sa inventory:', 'Tubig') || '').trim(); if (!nm) return;
  if (!D.own[p]) D.own[p] = { components: JSON.parse(JSON.stringify(invBomComps(D.inh[p]))), mode: invBomMode(D.inh[p]) };
  D.own[p].components = invBomComps(D.own[p]).concat([{ raw: '', name: nm, qty: q, unit: un, factor: 0, yield: 100, free: true }]); D.pick = { prep: '', raw: '' }; invBomRender();
}
async function invBomOut(p) {
  const e = invBomD.own[p]; if (!e) return; const T = invBomTotals(e), cur = e.out ? e.out.qty + ' ' + e.out.unit : (T.w ? Math.round(T.w) + ' g' : ''), t = await uiPrompt('Actual na nagagawa ng 1 prep item matapos lutuin/gawin (hal. 1800 g, 2 kg). Iwanang blangko para gamitin ang kabuuan ng sangkap.', cur); if (t === null) return;
  const m = String(t).trim().match(/^([\d.]+)\s*(g|kg|ml|l)?$/i); if (!t.trim()) delete e.out; else if (m && +m[1] > 0) e.out = { qty: +m[1], unit: (m[2] || 'g').replace(/^L$/, 'L') }; else { alert('Hindi maintindihan. Hal. 2 kg o 1800 g'); return; } invBomRender();
}
function invBomDel(p, i) { const e = invBomD.own[p], cs = invBomComps(e).slice(); cs.splice(i, 1); if (cs.length) invBomD.own[p] = { components: cs, mode: invBomMode(e), ...(e.out ? { out: e.out } : {}) }; else delete invBomD.own[p]; invBomRender(); }
async function invBomSave() {
  const D = invBomD; try { await db.collection('inventory_bom').doc(D.id).set({ scope: D.scope, company: D.company, branchCode: D.bc || '', boms: D.own, updatedBy: invWho(), updatedAt: new Date().toISOString() }); arCloseModal(); alert(`✅ Na-save ang ${Object.keys(D.own).length} prepared link.`); if (D.scope === 'branch') invState.bom = await invLoadBom(D.company, D.bc); } catch (e) { alert('Error: ' + e.message); }
}
// Count Result: pinagsama ang bilang ng lahat ng station sa petsa (parang "Count Result" sheet) — Whole + Loose
let invResultRows = [];
async function invCountResult() {
  const S = invState; invResultDocs = {}; arModal('<div style="padding:1rem;">Kinukuha...</div>');
  try {
    const snap = await db.collection('inventory_counts').where('branchCode', '==', S.branchCode).get(); const by = {}, stns = new Set();
    snap.forEach(d => { const c = d.data(); if (c.countDate !== invRD()) return; stns.add(c.station); invResultDocs[c.station] = c; (c.lines || []).forEach(l => { const k = l.itemCode; const o = by[k] = by[k] || { code: k, name: l.itemName, uom: l.uom, wholeUom: l.wholeUom || '', conv: l.conv || 1, total: 0, st: {} }; o.total += +l.qty || 0; o.st[c.station] = (o.st[c.station] || 0) + (+l.qty || 0); if (l.conv) { o.conv = l.conv; o.wholeUom = l.wholeUom; } }); });
    // Prepared items (BOM): ang bilang ng prepared item ay idinadagdag sa raw item (hal. Tomato Slice → Tomato kg)
    try {
      const bom = await invLoadBom(S.company, S.branchCode); invState.bom = bom; const bn = {}; Object.values(bom).forEach(e => invBomComps(e).forEach(b => { if (b.raw && b.rawName) bn[b.raw] = b.rawName; })); const nm = c => (invState.products[c] && invState.products[c].itemName) || (invState.items.find(i => i.itemCode === c) || {}).itemName || bn[c] || c;
      Object.keys(by).forEach(pc => { const comps = invBomComps(bom[pc]); const p = by[pc]; if (!comps.length) return; const outs = [];
        comps.forEach(b => { if (!b.raw || !(+b.factor > 0)) return; const add = (invBomMode(bom[pc]) === 'add' ? 1 : -1) * p.total * (+b.factor) / ((+b.yield > 0 ? +b.yield : 100) / 100); if (!add) return;
          let r = by[b.raw]; if (!r) { const it = invState.items.find(i => i.itemCode === b.raw) || { itemCode: b.raw }; const cv = invConv(it); r = by[b.raw] = { code: b.raw, name: nm(b.raw), uom: invUom(it), wholeUom: cv > 1 ? invWholeUom(it) : '', conv: cv, total: 0, st: {}, fromPrep: true }; }
          r.total += add; r.st['🧪 ' + p.name] = (r.st['🧪 ' + p.name] || 0) + add; outs.push(nm(b.raw)); });
        if (outs.length) p.name = p.name + ' ➜ ' + outs.join(' + '); });
    } catch (e) {}
    invResultRows = Object.values(by).sort((a, b) => String(a.name).localeCompare(String(b.name)));
    invResultStns=[...stns]; invResultSort='name'; invResultCosts=await invLoadCosts(S.company); let mo=0; try{const ms=await db.collection('inventory_markouts').where('branchCode','==',S.branchCode).get(); ms.forEach(d=>{const m=d.data(); if(m.date===S.date) mo+=+m.total||0;});}catch(e){} invResultMO=mo; invCountResultRender();
  } catch (e) { arModal('<div style="color:#dc2626;padding:1rem;">Error: ' + srchEsc(e.message) + '</div>'); }
}
let invCRDate = '', invResultDocs = {};
function invRD() { return invCRDate || invState.date; }
async function invCountResultDate(v) { if (!v) return; invCRDate = v; await invCountResult(); }
let invResultStns = [], invResultSort = 'name', invResultCosts = {}, invResultMO = 0;
const invMoney = n => (Math.round((+n || 0) * 100) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
async function invLoadCosts(company) { try { const d = await db.collection('inventory_costs').doc('company_' + invSlug(company || '')).get(); invState.costs = d.exists ? (d.data().costs || {}) : {}; } catch (e) { invState.costs = {}; } return invState.costs; }
function invUnitCost(code, conv) { const c = (invState.costs || {})[code]; if (c !== undefined && c !== '' && !isNaN(+c)) return +c; const p = invState.products[code] || {}; if (+p.loosePrice > 0) return +p.loosePrice; if (+p.wholePrice > 0) return +p.wholePrice / (conv > 1 ? conv : (+p.conversionFactor || 1)); return 0; }
function invValRows() {
  const rows = invResultRows.map(r => { const uc = invUnitCost(r.code, r.conv), st = {}, sv = {}; let bomQ = 0; Object.keys(r.st).forEach(k => { if (k.indexOf('🧪') === 0) bomQ += r.st[k]; else st[k] = r.st[k]; }); Object.keys(st).forEach(k => sv[k] = st[k] * uc); return { r, uc, tv: r.total * uc, st, sv, bomQ, bomV: bomQ * uc }; });
  if (invResultSort === 'value') rows.sort((a, b) => b.tv - a.tv); return rows;
}
function invCountResultSort(m) { invResultSort = m; invCountResultRender(); }
function invCountResultRender() {
  const S = invState, rows = invValRows(), tot = rows.reduce((a, x) => a + x.tv, 0), noCost = rows.filter(x => !x.uc).length;
  const body = rows.map(x => { const r = x.r; return `<tr><td style="font-size:.75rem;color:#64748b;">${srchEsc(r.code)}</td><td>${srchEsc(r.name)}</td><td style="text-align:right;"><b>${r.conv > 1 ? srchEsc(invTotalFmt(r.total, r.conv, r.wholeUom || 'Whole', r.uom)) : (Math.round(r.total * 1000) / 1000) + ' ' + srchEsc(r.uom)}</b>${r.conv > 1 ? `<br><small style="color:#64748b;">= ${Math.round(r.total * 1000) / 1000} ${srchEsc(r.uom)}</small>` : ''}</td><td style="text-align:right;">${x.uc ? invMoney(x.uc) : '<span style="color:#dc2626;">—</span>'}<br><small style="color:#64748b;">/${srchEsc(r.uom)}</small></td><td style="text-align:right;"><b>${invMoney(x.tv)}</b></td><td><small>${Object.keys(r.st).map(k => srchEsc(k) + ': ' + (Math.round(r.st[k] * 1000) / 1000)).join(' · ')}</small></td></tr>`; }).join('') || '<tr><td colspan="6" style="text-align:center;color:#94a3b8;">Wala pang na-save na bilang sa petsang ito.</td></tr>';
  arModal(`<h3>📊 Count Result — ${srchEsc(S.branch)} · ${srchEsc(invRD())}</h3><div style="display:flex;gap:.4rem;align-items:center;flex-wrap:wrap;margin-bottom:.4rem;"><label style="font-size:.85rem;">📅 Petsa ng bilang:</label><input type="date" value="${srchEsc(invRD())}" onchange="invCountResultDate(this.value)"></div>
  <div style="margin-bottom:.5rem;"><small style="color:#64748b;">I-print ang laman (may larawan) ng:</small><br>${Object.keys(invResultDocs).sort(invNatSort).map(n => `<button class="btn btn-secondary btn-sm" style="margin:.15rem;" onclick="invPrintStationResult(this.dataset.s)" data-s="${srchEsc(n)}">🖨️ ${srchEsc(n)}</button>`).join('')}${Object.keys(invResultDocs).length > 1 ? ' <button class="btn btn-primary btn-sm" onclick="invPrintStationResult(\'*\')">🖨️ Lahat ng station</button>' : ''}</div>
  <p style="font-size:.85rem;color:#64748b;">${invResultStns.length} station ang nabilang: ${srchEsc(invResultStns.join(', ') || '—')}. Pinagsama ang bawat item sa lahat ng station.</p>
  <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:.5rem .8rem;margin-bottom:.5rem;"><b>💰 Kabuuang Halaga: ₱${invMoney(tot)}</b>${invResultMO ? `<br><small>Mark Out ngayong petsa: ₱${invMoney(invResultMO)}</small>` : ''}${noCost ? `<br><small style="color:#dc2626;">${noCost} item ang walang Unit Cost — i-set sa "💲 Unit Cost".</small>` : ''}</div>
  <div style="margin-bottom:.4rem;"><button class="btn btn-sm ${invResultSort === 'name' ? 'btn-primary' : 'btn-secondary'}" onclick="invCountResultSort('name')">A-Z</button> <button class="btn btn-sm ${invResultSort === 'value' ? 'btn-primary' : 'btn-secondary'}" onclick="invCountResultSort('value')">Sorted by Value</button></div>
  <div style="max-height:55vh;overflow:auto;"><table data-notools="1"><thead><tr><th>Code</th><th>Item</th><th style="text-align:right;">Kabuuan</th><th style="text-align:right;">Unit Cost</th><th style="text-align:right;">Total Value</th><th>Bawat station</th></tr></thead><tbody>${body}</tbody></table></div><button class="btn btn-secondary btn-sm" style="margin-top:.5rem;" onclick="invCountResultCSV()">📤 CSV</button> <button class="btn btn-secondary btn-sm" style="margin-top:.5rem;" onclick="invCountResultPrint()">🖨️ Print</button>`);
}
function invValMatrix() {
  const rows = invValRows(), cols = [...new Set(rows.flatMap(x => Object.keys(x.st)))].sort(invNatSort), hasBom = rows.some(x => x.bomQ);
  const colV = {}; cols.forEach(c => colV[c] = rows.reduce((a, x) => a + (x.sv[c] || 0), 0)); const bomT = rows.reduce((a, x) => a + x.bomV, 0), tot = rows.reduce((a, x) => a + x.tv, 0);
  return { rows, cols, hasBom, colV, bomT, tot };
}
function invCountResultPrint() {
  const M = invValMatrix(), n = v => (Math.round(v * 1000) / 1000) || 0;
  const th = (M.hasBom ? '<th class="num">From BOM</th>' : '') + M.cols.map(c => `<th class="num">${srchEsc(c)}</th>`).join('');
  const hv = (M.hasBom ? `<td class="num"><b>${invMoney(M.bomT)}</b></td>` : '') + M.cols.map(c => `<td class="num"><b>${invMoney(M.colV[c])}</b></td>`).join('');
  const rows = M.rows.map(x => `<tr><td>${srchEsc(x.r.code)}</td><td>${srchEsc(x.r.name)}</td><td class="num">${n(x.r.total)}</td><td>${srchEsc(x.r.uom)}</td><td class="num">${invMoney(x.uc)}</td><td class="num"><b>${invMoney(x.tv)}</b></td>${M.hasBom ? `<td class="num">${x.bomV ? invMoney(x.bomV) : ''}</td>` : ''}${M.cols.map(c => `<td class="num">${x.sv[c] ? invMoney(x.sv[c]) : ''}</td>`).join('')}${M.hasBom ? `<td class="num">${x.bomQ ? n(x.bomQ) : ''}</td>` : ''}${M.cols.map(c => `<td class="num">${x.st[c] ? n(x.st[c]) : ''}</td>`).join('')}</tr>`).join('');
  printHtmlDoc('Count Result Value ' + invRD(), `<div class="pg"><h1>📊 ${srchEsc(invState.company)} — Count Result Value Count ${srchEsc(invRD())}${invResultSort === 'value' ? ' (Sorted by Value)' : ''}</h1><div class="meta">Branch: <b>${srchEsc(invState.branch)}</b> (${srchEsc(invState.branchCode)}) · Kabuuang Halaga: <b>₱${invMoney(M.tot)}</b>${invResultMO ? ` · Mark Out: ₱${invMoney(invResultMO)}` : ''}<br>${printedByLine()}</div><table style="font-size:.7rem;"><thead><tr><th colspan="6"></th><th colspan="${M.cols.length + (M.hasBom ? 1 : 0)}" style="text-align:center;">VALUE</th><th colspan="${M.cols.length + (M.hasBom ? 1 : 0)}" style="text-align:center;">QTY</th></tr><tr><td colspan="5"><b>TOTAL</b></td><td class="num"><b>${invMoney(M.tot)}</b></td>${hv}<td colspan="${M.cols.length + (M.hasBom ? 1 : 0)}"></td></tr><tr><th>Item Code</th><th>Item Description</th><th class="num">Count Result</th><th>UOM</th><th class="num">Unit Cost</th><th class="num">Total Value</th>${th}${th}</tr></thead><tbody>${rows}</tbody></table><div class="sign"><div>Binilang ni (Checked by)<br><b>&nbsp;</b></div><div>Tinanggap / Inaprubahan ni<br><b>&nbsp;</b></div></div></div>`);
}
function invCountResultCSV() {
  const M = invValMatrix(), n = v => Math.round(v * 1000) / 1000, hd = (M.hasBom ? ['From BOM'] : []).concat(M.cols);
  const L = [['Item Code', 'Item Description', 'Inventory Count Result', 'UOM', 'Unit Cost', 'Total Value'].concat(hd.map(h => 'Value ' + h), hd.map(h => 'Qty ' + h)).map(csvCell).join(',')];
  L.push((['TOTAL', '', '', '', '', Math.round(M.tot * 100) / 100].concat(M.hasBom ? [Math.round(M.bomT * 100) / 100] : [], M.cols.map(c => Math.round(M.colV[c] * 100) / 100))).map(csvCell).join(','));
  M.rows.forEach(x => L.push([x.r.code, x.r.name, n(x.r.total), x.r.uom, Math.round(x.uc * 100) / 100, Math.round(x.tv * 100) / 100].concat(M.hasBom ? [Math.round(x.bomV * 100) / 100] : [], M.cols.map(c => Math.round((x.sv[c] || 0) * 100) / 100), M.hasBom ? [n(x.bomQ)] : [], M.cols.map(c => n(x.st[c] || 0))).map(csvCell).join(',')));
  downloadCSVFile(L.join('\r\n'), `Count_Result_Value_${invState.branchCode}_${invRD()}${invResultSort === 'value' ? '_by_value' : ''}.csv`);
}
async function invPrintStationResult(st) {
  const names = st === '*' ? Object.keys(invResultDocs).sort(invNatSort) : [st]; let html = '';
  for (const n of names) { const c = invResultDocs[n]; if (!c) continue;
    const rows = await invRowsWithPhotos((c.lines || []).map(l => ({ code: l.itemCode, name: l.itemName, uom: l.uom, qty: l.qty, conv: l.conv || 1, wuom: l.wholeUom || '', w: l.whole, l: l.loose })));
    rows.sort((a, b) => String(a.name).localeCompare(String(b.name)));
    html += invSheetHtml({ station: n, branch: invState.branch, branchCode: invState.branchCode, company: invState.company, date: invRD(), rows, photos: true, split: rows.some(r => r.conv > 1), checkedBy: c.checkedBy || '', receivedBy: c.receivedBy || '', remarks: c.remarks || '' }); }
  if (!html) { alert('Walang naka-save na bilang para sa station na ito.'); return; } printHtmlDoc('Inventory ' + invRD(), html);
}
// ---- Weekly (Linggo) / Month-end schedule at Compare ng mga petsa ----
function invKind(d) { const t = new Date(d + 'T00:00:00'); if (isNaN(t)) return ''; const me = new Date(t.getFullYear(), t.getMonth() + 1, 0).getDate() === t.getDate(), sun = t.getDay() === 0; return me ? (sun ? 'Month-end (Linggo — isa lang ito)' : 'Month-end') : sun ? 'Weekly (Linggo)' : ''; }
function invKindBadge(d) { const k = invKind(d); return k ? `<small style="display:block;margin-top:.2rem;color:#047857;font-weight:600;">✅ ${k}</small>` : `<small style="display:block;margin-top:.2rem;color:#b45309;">⚠️ Hindi Linggo o month-end — para sa weekly, Linggo ang petsa.</small>`; }
let invCmpData = null;
async function invCompareOpen() {
  const S = invState; arModal('<div style="padding:1rem;">Kinukuha...</div>');
  try {
    await invLoadCosts(S.company); const snap = await db.collection('inventory_counts').where('branchCode', '==', S.branchCode).get(); const by = {}, dates = new Set();
    snap.forEach(d => { const c = d.data(), dt = c.countDate; if (!dt) return; dates.add(dt); (c.lines || []).forEach(l => { const o = by[l.itemCode] = by[l.itemCode] || { code: l.itemCode, name: l.itemName, uom: l.uom, q: {} }; o.q[dt] = (o.q[dt] || 0) + (+l.qty || 0); }); });
    const all = [...dates].sort(); invCmpData = { by, all, sel: new Set(all.slice(-5)), diffOnly: false }; invCompareRender();
  } catch (e) { arModal('<div style="color:#dc2626;padding:1rem;">Error: ' + srchEsc(e.message) + '</div>'); }
}
function invCmpToggle(d) { const s = invCmpData.sel; s.has(d) ? s.delete(d) : s.add(d); invCompareRender(); }
function invCmpRows() {
  const D = invCmpData, ds = [...D.sel].sort(); const rows = Object.values(D.by).map(o => { const uc = invUnitCost(o.code, 1); const cells = ds.map((d, i) => { const q = o.q[d] || 0, pq = i ? (o.q[ds[i - 1]] || 0) : null; return { d, q, v: q * uc, diff: pq === null ? null : q - pq }; }); return { o, uc, cells, chg: cells.some(c => c.diff) }; }).filter(r => r.cells.some(c => c.q) && (!D.diffOnly || r.chg));
  rows.sort((a, b) => String(a.o.name).localeCompare(String(b.o.name))); return { ds, rows };
}
function invCompareRender() {
  const D = invCmpData, S = invState, { ds, rows } = invCmpRows(), n = v => Math.round(v * 1000) / 1000;
  const chips = D.all.map(d => `<label style="display:inline-block;margin:.15rem;padding:.2rem .5rem;border:1px solid #e2e8f0;border-radius:6px;font-size:.78rem;background:${D.sel.has(d) ? '#dbeafe' : '#fff'};"><input type="checkbox" ${D.sel.has(d) ? 'checked' : ''} onchange="invCmpToggle('${d}')"> ${d}${invKind(d) ? '<br><small style="color:#64748b;">' + invKind(d).split(' (')[0] + '</small>' : ''}</label>`).join('') || '<small>Wala pang naka-save na bilang.</small>';
  const tv = ds.map((d, i) => rows.reduce((a, r) => a + r.cells[i].v, 0));
  const head = ds.map(d => `<th style="text-align:right;">${d.slice(5)}</th>`).join(''), body = rows.map(r => `<tr><td>${srchEsc(r.o.name)}<br><small style="color:#64748b;">${srchEsc(r.o.code)} · ${srchEsc(r.o.uom || '')}</small></td>${r.cells.map(c => `<td style="text-align:right;">${n(c.q)}${c.diff ? `<br><small style="color:${c.diff < 0 ? '#dc2626' : '#16a34a'};">${c.diff > 0 ? '+' : ''}${n(c.diff)}</small>` : ''}</td>`).join('')}</tr>`).join('') || `<tr><td colspan="${ds.length + 1}" style="text-align:center;color:#94a3b8;">Pumili ng petsa.</td></tr>`;
  arModal(`<h3>📈 Compare — ${srchEsc(S.branch)}</h3><p style="font-size:.82rem;color:#64748b;">Pumili ng mga petsa ng bilang (Weekly tuwing Linggo, at Month-end). Kapag Linggo ang month-end, isa lang ang bilang. Ang <span style="color:#dc2626;">pula</span> = nabawasan (nabasag/nagamit), <span style="color:#16a34a;">berde</span> = nadagdag, kumpara sa nakaraang petsa.</p><div>${chips}</div><label style="font-size:.82rem;"><input type="checkbox" ${D.diffOnly ? 'checked' : ''} onchange="invCmpData.diffOnly=this.checked;invCompareRender()"> Ipakita lang ang may pagbabago</label>
  <div style="margin:.4rem 0;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:.4rem .7rem;font-size:.82rem;"><b>Halaga:</b> ${ds.map((d, i) => d.slice(5) + ' ₱' + invMoney(tv[i])).join(' · ') || '—'}</div>
  <div style="max-height:45vh;overflow:auto;"><table data-notools="1"><thead><tr><th>Item</th>${head}</tr></thead><tbody>${body}</tbody></table></div><button class="btn btn-secondary btn-sm" style="margin-top:.5rem;" onclick="invCompareCSV()">📤 CSV</button> <button class="btn btn-secondary btn-sm" style="margin-top:.5rem;" onclick="invComparePrint()">🖨️ Print</button>`);
}
function invCompareCSV() {
  const { ds, rows } = invCmpRows(), L = [['Item Code', 'Item', 'UOM', 'Unit Cost'].concat(ds.map(d => d + ' Qty'), ds.map(d => d + ' Diff'), ds.map(d => d + ' Value')).map(csvCell).join(',')];
  L.push(['TOTAL', '', '', ''].concat(ds.map(() => ''), ds.map(() => ''), ds.map((d, i) => Math.round(rows.reduce((a, r) => a + r.cells[i].v, 0) * 100) / 100)).map(csvCell).join(','));
  rows.forEach(r => L.push([r.o.code, r.o.name, r.o.uom, r.uc].concat(r.cells.map(c => Math.round(c.q * 1000) / 1000), r.cells.map(c => c.diff === null ? '' : Math.round(c.diff * 1000) / 1000), r.cells.map(c => Math.round(c.v * 100) / 100)).map(csvCell).join(',')));
  downloadCSVFile(L.join('\r\n'), `Inventory_Compare_${invState.branchCode}.csv`);
}
function invComparePrint() {
  const { ds, rows } = invCmpRows(), n = v => Math.round(v * 1000) / 1000, th = ds.map(d => `<th class="num">${d}</th>`).join('');
  const body = rows.map(r => `<tr><td>${srchEsc(r.o.code)}</td><td>${srchEsc(r.o.name)}</td><td>${srchEsc(r.o.uom || '')}</td>${r.cells.map(c => `<td class="num">${n(c.q)}${c.diff ? ` <small style="color:${c.diff < 0 ? '#dc2626' : '#16a34a'};">(${c.diff > 0 ? '+' : ''}${n(c.diff)})</small>` : ''}</td>`).join('')}</tr>`).join('');
  const tot = ds.map((d, i) => `<td class="num"><b>${invMoney(rows.reduce((a, r) => a + r.cells[i].v, 0))}</b></td>`).join('');
  printHtmlDoc('Inventory Compare', `<div class="pg"><h1>📈 Inventory Compare — ${srchEsc(invState.branch)}</h1><div class="meta">Company: <b>${srchEsc(invState.company)}</b><br>${printedByLine()}</div><table style="font-size:.72rem;"><thead><tr><th>Code</th><th>Item</th><th>UOM</th>${th}</tr><tr><td colspan="3"><b>Halaga (₱)</b></td>${tot}</tr></thead><tbody>${body}</tbody></table></div>`);
}
// ---- Wares / items mula sa SAP Item Master + larawan mula sa Google Drive link ----
function invDriveId(u) { u = String(u || '').trim(); let m = u.match(/\/d\/([\w-]{10,})/) || u.match(/[?&]id=([\w-]{10,})/); return m ? m[1] : ''; }
function invDriveThumb(u) { u = String(u || '').trim(); if (!u) return ''; const id = invDriveId(u); return id ? `https://drive.google.com/thumbnail?id=${id}&sz=w400` : (/^https?:/i.test(u) ? u : ''); }
async function invPhotoLinksImport() {
  const t = await pickCSVFile(); if (!t) return; const rows = csvToObjects(t); let ok = 0, bad = 0, batch = db.batch(), n = 0;
  for (const r of rows) { const c = (r.item_code || r.itemcode || r.code || '').trim(), l = (r.photo_link || r.link || r.photo || r.picture || '').trim(); if (!c || !invDriveThumb(l)) { bad++; continue; } batch.set(db.collection('product_photos').doc(c), { link: l, updatedBy: invWho(), updatedAt: new Date().toISOString() }, { merge: true }); delete invPhotoCache[c]; ok++; if (++n % 400 === 0) { await batch.commit(); batch = db.batch(); } }
  try { await batch.commit(); alert(`✅ ${ok} larawan ang na-link.${bad ? ' ' + bad + ' row ang nilaktawan (walang code o link).' : ''}\\nTandaan: ang file sa Drive ay dapat "Anyone with the link" para lumabas.`); } catch (e) { alert('Error: ' + e.message); }
}
let sapPull = { items: [], exist: {} };
async function invSapPullOpen() {
  const cos = (typeof invCompaniesList !== 'undefined' ? invCompaniesList : []), sts = (typeof invStationsList !== 'undefined' ? invStationsList : []);
  arModal(`<h3>📒 Kunin mula SAP Item Master</h3><p style="font-size:.82rem;color:#64748b;">Piliin ang company at ang Item Group (hal. wares) para idagdag sa inventory list. Hindi papalitan ang mga item na nasa inventory na.</p>
  <div class="form-group"><label>Company</label><select id="sp-co" onchange="invSapPullLoad()"><option value="">— pumili —</option>${cos.map(c => `<option>${srchEsc(c)}</option>`).join('')}</select></div><div id="sp-groups"></div>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:.4rem;"><div class="form-group"><label>Uri</label><select id="sp-type"><option value="wares">🥢 Wares</option><option value="kitchen">🍳 Kitchen</option></select></div><div class="form-group"><label>Station</label><select id="sp-st">${sts.map(c => `<option>${srchEsc(c)}</option>`).join('') || '<option>Unassigned</option>'}</select></div></div>
  <button class="btn btn-success" onclick="invSapPullGo()">⬇️ Idagdag sa inventory</button>`);
}
async function invSapPullLoad() {
  const co = document.getElementById('sp-co').value, box = document.getElementById('sp-groups'); sapPull = { items: [], exist: {} }; if (!co) { box.innerHTML = ''; return; }
  box.innerHTML = 'Kinukuha...';
  try { const sn = await db.collection('sap_items').where('company', '==', co).get(); sn.forEach(d => sapPull.items.push(d.data())); const ex = await db.collection('inventory_items').where('company', '==', co).get(); ex.forEach(d => sapPull.exist[d.data().itemCode] = 1); } catch (e) { box.innerHTML = 'Error: ' + srchEsc(e.message); return; }
  const g = {}; sapPull.items.forEach(i => { if (i.itemGroup) g[i.itemGroup] = (g[i.itemGroup] || 0) + 1; });
  box.innerHTML = Object.keys(g).sort().map(k => `<label style="display:block;font-size:.85rem;"><input type="checkbox" class="sp-g" value="${srchEsc(k)}"> ${srchEsc(k)} <small style="color:#64748b;">(${g[k]})</small></label>`).join('') || '<small style="color:#dc2626;">Walang SAP item para sa company na ito. I-import muna sa 📒 SAP Item Master.</small>';
}
async function invSapPullGo() {
  const co = document.getElementById('sp-co').value, gs = [...document.querySelectorAll('.sp-g:checked')].map(x => x.value), type = document.getElementById('sp-type').value, st = document.getElementById('sp-st').value;
  if (!co || !gs.length) { alert('Pumili ng company at kahit isang Item Group.'); return; }
  const list = sapPull.items.filter(i => gs.includes(i.itemGroup) && i.active !== false && !sapPull.exist[i.itemCode]); if (!list.length) { alert('Walang bagong item na idaragdag (nasa inventory na lahat o inactive).'); return; }
  if (!await uiConfirm(`Idagdag ang ${list.length} item sa ${co} bilang ${type}, station "${st}"?`)) return;
  try { let batch = db.batch(), n = 0; for (const i of list) { batch.set(db.collection('inventory_items').doc(`${co}__${i.itemCode}`), { company: co, itemCode: i.itemCode, itemName: i.itemName, type, station: st, countUOM: i.invUom || i.purchUom || 'Pcs', source: 'sap', updatedAt: new Date().toISOString() }, { merge: true }); if (++n % 400 === 0) { await batch.commit(); batch = db.batch(); } } await batch.commit(); arCloseModal(); alert(`✅ ${list.length} item ang naidagdag. Palitan ang station ng bawat item sa Setup kung kailangan.`); } catch (e) { alert('Error: ' + e.message); }
}
// ---- Unit Cost (bawat item, bawat company) ----
let invCostDraft = {};
function invCostOpen() { invCostDraft = JSON.parse(JSON.stringify(invState.costs || {})); invCostRender(''); }
function invCostRender(q) {
  const its = invState.items.filter(i => !q || smartMatch(q, invItemName(i), i.itemCode)).slice(0, 60);
  const rows = its.map(i => `<tr><td style="font-size:.75rem;color:#64748b;">${srchEsc(i.itemCode)}</td><td>${srchEsc(invItemName(i))}<br><small style="color:#64748b;">/${srchEsc(invUom(i))}</small></td><td><input type="number" step="0.01" min="0" style="width:100px;" value="${invCostDraft[i.itemCode] !== undefined ? invCostDraft[i.itemCode] : ''}" placeholder="${invUnitCost(i.itemCode, invConv(i)) || ''}" onchange="invCostSet('${srchEsc(i.itemCode)}',this.value)"></td></tr>`).join('');
  arModal(`<h3>💲 Unit Cost — ${srchEsc(invState.company)}</h3><p style="font-size:.82rem;color:#64748b;">Halaga bawat <b>loose UOM</b> (hal. bawat KG / PACK). Kapag blangko, gagamitin ang presyo ng produkto. ${Object.keys(invCostDraft).length} ang may cost.</p><input id="cost-q" placeholder="🔍 Hanapin ang item..." value="${srchEsc(q)}" oninput="invCostRender(this.value)" style="width:100%;margin-bottom:.4rem;"><div style="max-height:45vh;overflow:auto;"><table data-notools="1"><thead><tr><th>Code</th><th>Item</th><th>Unit Cost</th></tr></thead><tbody>${rows}</tbody></table></div><div style="margin-top:.5rem;"><button class="btn btn-success" onclick="invCostSave()">💾 I-save</button> <button class="btn btn-secondary" onclick="invCostImport()">📥 Import CSV (item_code, unit_cost)</button></div>`);
  const el = document.getElementById('cost-q'); if (el && q) { el.focus(); el.setSelectionRange(q.length, q.length); }
}
function invCostSet(c, v) { if (v === '' || isNaN(+v)) delete invCostDraft[c]; else invCostDraft[c] = +v; }
async function invCostImport() { const t = await pickCSVFile(); if (!t) return; let n = 0; csvToObjects(t).forEach(o => { const c = o.item_code || o.itemcode || o.code, v = parseFloat(String(o.unit_cost || o.cost || '').replace(/,/g, '')); if (c && !isNaN(v)) { invCostDraft[c] = v; n++; } }); alert(`Na-load ang ${n} cost. I-click ang I-save.`); invCostRender(''); }
async function invCostSave() { try { await db.collection('inventory_costs').doc('company_' + invSlug(invState.company || '')).set({ company: invState.company, costs: invCostDraft, updatedBy: invWho(), updatedAt: new Date().toISOString() }); invState.costs = invCostDraft; arCloseModal(); alert('✅ Na-save ang Unit Cost.'); } catch (e) { alert('Error: ' + e.message); } }
// ---- Mark Out log (Transfer / Spoilage / RnD / Mark Out) ----
const MO_REASONS = { Transfer: 'Nilipat sa ibang store/location — ilagay sa remarks ang pinagpadalhan.', Spoilage: 'Good items na hindi na magamit (bulok/damage) — ilagay ang pinagmulang station.', RnD: 'Ginamit sa testing/development — ilagay ang activity.', 'Mark Out': 'Ginamit/nilabas para sa ibang gamit — ilagay ang paggamit.' };
let moRows = [], moPick = '', moFrom = '', moTo = '';
async function invMarkOutOpen() {
  const S = invState; if (!moFrom) moFrom = S.date.slice(0, 8) + '01'; if (!moTo) moTo = S.date; await invLoadCosts(S.company);
  arModal('<div style="padding:1rem;">Kinukuha...</div>');
  try { const snap = await db.collection('inventory_markouts').where('branchCode', '==', S.branchCode).get(); moRows = []; snap.forEach(d => moRows.push({ id: d.id, ...d.data() })); } catch (e) { moRows = []; }
  moPick = ''; invMarkOutRender();
}
function invMarkOutSearch() { const q = (document.getElementById('mo-q').value || '').trim(), box = document.getElementById('mo-r'); moPick = ''; if (!q) { box.style.display = 'none'; return; } box.innerHTML = invState.items.filter(i => smartMatch(q, invItemName(i), i.itemCode)).slice(0, 10).map(i => `<div style="padding:.4rem .6rem;border-bottom:1px solid #f1f5f9;cursor:pointer;" onclick="invMarkOutPick('${srchEsc(i.itemCode)}')"><b>${srchEsc(invItemName(i))}</b> <small style="color:#64748b;">${srchEsc(i.itemCode)} · ${srchEsc(invUom(i))}</small></div>`).join('') || '<div style="padding:.5rem;color:#94a3b8;">Walang nahanap.</div>'; box.style.display = 'block'; }
function invMarkOutPick(c) { const it = invState.items.find(i => i.itemCode === c); moPick = c; document.getElementById('mo-q').value = invItemName(it); document.getElementById('mo-r').style.display = 'none'; document.getElementById('mo-u').textContent = invUom(it) + ' @ ' + invMoney(invUnitCost(c, invConv(it))); }
function invMoFiltered() { return moRows.filter(m => m.date >= moFrom && m.date <= moTo).sort((a, b) => (a.date + (a.at || '')).localeCompare(b.date + (b.at || ''))); }
function invMarkOutRender() {
  const S = invState, list = invMoFiltered(), tot = list.reduce((a, m) => a + (+m.total || 0), 0), by = {}; list.forEach(m => by[m.reason] = (by[m.reason] || 0) + (+m.total || 0));
  const rows = list.map(m => `<tr><td>${srchEsc(m.date)}</td><td>${srchEsc(m.itemName)}<br><small style="color:#64748b;">${srchEsc(m.itemCode)}</small></td><td style="text-align:right;">${m.qty} ${srchEsc(m.uom)}</td><td style="text-align:right;">${invMoney(m.total)}</td><td>${srchEsc(m.reason)}<br><small>${srchEsc(m.remarks || '')}</small></td><td><small>${srchEsc(m.by || '')}</small></td><td><button class="btn btn-sm btn-danger" onclick="invMarkOutDel('${srchEsc(m.id)}')">🗑</button></td></tr>`).join('') || '<tr><td colspan="7" style="text-align:center;color:#94a3b8;">Wala pang Mark Out sa saklaw na petsa.</td></tr>';
  arModal(`<h3>📤 Mark Out — ${srchEsc(S.branch)}</h3><details open style="margin-bottom:.5rem;"><summary style="cursor:pointer;color:#64748b;font-size:.82rem;">Ano ang ibig sabihin ng bawat reason</summary>${Object.keys(MO_REASONS).map(k => `<div style="font-size:.8rem;"><b>${k}</b> — ${MO_REASONS[k]}</div>`).join('')}</details>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:.4rem;margin-bottom:.5rem;"><div style="grid-column:1/3;position:relative;"><input id="mo-q" placeholder="🔍 Item..." oninput="kDeb(()=>invMarkOutSearch(),'bq4')" style="width:100%;"><div id="mo-r" style="display:none;position:absolute;left:0;right:0;background:#fff;border:1px solid #e2e8f0;max-height:180px;overflow:auto;z-index:5;"></div></div>
  <input id="mo-d" type="date" value="${srchEsc(S.date)}"><input id="mo-n" type="number" step="any" min="0" placeholder="Qty"><small id="mo-u" style="grid-column:1/3;color:#64748b;"></small><select id="mo-s">${Object.keys(MO_REASONS).map(k => `<option>${k}</option>`).join('')}</select><input id="mo-m" placeholder="Remarks"><button class="btn btn-success" style="grid-column:1/3;" onclick="invMarkOutAdd()">➕ Idagdag</button></div>
  <div style="display:flex;gap:.4rem;align-items:center;margin-bottom:.4rem;"><input type="date" id="mo-f" value="${moFrom}" onchange="moFrom=this.value;invMarkOutRender()"> – <input type="date" id="mo-t" value="${moTo}" onchange="moTo=this.value;invMarkOutRender()"></div>
  <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:.4rem .7rem;margin-bottom:.4rem;"><b>Kabuuang Mark Out: ₱${invMoney(tot)}</b><br><small>${Object.keys(by).map(k => srchEsc(k) + ' ₱' + invMoney(by[k])).join(' · ') || '—'}</small></div>
  <div style="max-height:35vh;overflow:auto;"><table data-notools="1"><thead><tr><th>Petsa</th><th>Item</th><th style="text-align:right;">Qty</th><th style="text-align:right;">Cost</th><th>Reason</th><th>By</th><th></th></tr></thead><tbody>${rows}</tbody></table></div><button class="btn btn-secondary btn-sm" style="margin-top:.5rem;" onclick="invMarkOutCSV()">📤 CSV</button> <button class="btn btn-secondary btn-sm" style="margin-top:.5rem;" onclick="invMarkOutPrint()">🖨️ Print</button>`);
}
async function invMarkOutAdd() {
  const S = invState, it = S.items.find(i => i.itemCode === moPick), q = +document.getElementById('mo-n').value, d = document.getElementById('mo-d').value, rs = document.getElementById('mo-s').value, rm = document.getElementById('mo-m').value.trim();
  if (!it) { alert('Pumili ng item mula sa listahan.'); return; } if (!(q > 0)) { alert('Ilagay ang Qty.'); return; } if (!d) { alert('Ilagay ang petsa.'); return; } if (rs !== 'Mark Out' && !rm) { alert('Ilagay ang remarks (' + MO_REASONS[rs] + ')'); return; }
  const uc = invUnitCost(it.itemCode, invConv(it)), rec = { branchCode: S.branchCode, branch: S.branch, company: S.company, date: d, itemCode: it.itemCode, itemName: invItemName(it), qty: q, uom: invUom(it), unitCost: uc, total: Math.round(q * uc * 100) / 100, reason: rs, remarks: rm, by: invWho(), at: new Date().toISOString() };
  try { const r = await db.collection('inventory_markouts').add(rec); moRows.push({ id: (r && r.id) || ('m' + Date.now()), ...rec }); if (d > moTo) moTo = d; if (d < moFrom) moFrom = d; moPick = ''; invMarkOutRender(); } catch (e) { alert('Error: ' + e.message); }
}
async function invMarkOutDel(id) { if (!await uiConfirm('Burahin ang Mark Out na ito?')) return; try { await db.collection('inventory_markouts').doc(id).delete(); moRows = moRows.filter(m => m.id !== id); invMarkOutRender(); } catch (e) { alert('Error: ' + e.message); } }
function invMarkOutCSV() { const L = [['Store', 'Date', 'Item Code', 'Item Description', 'Qty', 'UOM', 'Unit Cost', 'Total Cost', 'Reason', 'Remarks', 'Declared By'].map(csvCell).join(',')]; invMoFiltered().forEach(m => L.push([m.branch, m.date, m.itemCode, m.itemName, m.qty, m.uom, m.unitCost, m.total, m.reason, m.remarks, m.by].map(csvCell).join(','))); downloadCSVFile(L.join('\r\n'), `Mark_Out_${invState.branchCode}_${moFrom}_${moTo}.csv`); }
function invMarkOutPrint() {
  const list = invMoFiltered(), tot = list.reduce((a, m) => a + (+m.total || 0), 0), rows = list.map(m => `<tr><td>${srchEsc(m.date)}</td><td>${srchEsc(m.itemCode)}</td><td>${srchEsc(m.itemName)}</td><td class="num">${m.qty}</td><td>${srchEsc(m.uom)}</td><td class="num">${invMoney(m.unitCost)}</td><td class="num">${invMoney(m.total)}</td><td>${srchEsc(m.reason)}</td><td>${srchEsc(m.remarks || '')}</td><td>${srchEsc(m.by || '')}</td></tr>`).join('');
  printHtmlDoc('Mark Out ' + moFrom + ' - ' + moTo, `<div class="pg"><h1>📤 Mark Out — ${srchEsc(invState.branch)}</h1><div class="meta">Company: <b>${srchEsc(invState.company)}</b> · ${srchEsc(moFrom)} hanggang ${srchEsc(moTo)} · Kabuuan: <b>₱${invMoney(tot)}</b><br>${printedByLine()}</div><table style="font-size:.75rem;"><thead><tr><th>Date</th><th>Code</th><th>Item Description</th><th class="num">Qty</th><th>UOM</th><th class="num">Unit Cost</th><th class="num">Total Cost</th><th>Reason</th><th>Remarks</th><th>Declared By</th></tr></thead><tbody>${rows}</tbody></table><div class="sign"><div>Declared by<br><b>&nbsp;</b></div><div>Approved by<br><b>&nbsp;</b></div></div></div>`);
}
function invDraftKey() { return `kusina_inv_${invState.branchCode}_${invState.date}_${invSlug(invState.station)}`; }
function invLoadDraft() {
  invState.entries = {}; invState.temps = []; invState.parts = {};
  try { const d = JSON.parse(localStorage.getItem(invDraftKey()) || 'null'); if (d) { invState.entries = d.entries || {}; invState.parts = d.parts || {}; invState.temps = d.temps || []; invState.checkedBy = d.checkedBy; invState.receivedBy = d.receivedBy; invState.remarks = d.remarks; } } catch (e) {}
}
function invSaveDraft() {
  try { localStorage.setItem(invDraftKey(), JSON.stringify({ entries: invState.entries, parts: invState.parts || {}, temps: invState.temps, checkedBy: invState.checkedBy, receivedBy: invState.receivedBy, remarks: invState.remarks })); } catch (e) {}
}
function invNatSort(a, b) { return String(a).localeCompare(String(b), undefined, { numeric: true }); }
function invStationNames() { return Object.keys(invState.stationItems || {}).sort(invNatSort); }
// Membership ng station: kada branch ang may sariling station at laman nito (puwedeng nasa higit sa isang station ang item)
function invBuildStationItems(doc) {
  if (doc && doc.stations) { const o = {}; Object.keys(doc.stations).forEach(k => { o[k] = (doc.stations[k] || []).slice(); }); return o; }
  const o = {}; invState.items.forEach(i => { const st = (doc && doc.map && doc.map[i.itemCode]) || i.station; if (st) (o[st] = o[st] || []).push(i.itemCode); }); return o;
}
function invStationOf(code, prefer) { const m = invState.stationItems || {}; if (prefer && (m[prefer] || []).includes(code)) return prefer; return invStationNames().find(k => (m[k] || []).includes(code)) || ''; }
function invStationItems() {
  const by = {}; invState.items.forEach(i => by[i.itemCode] = i); const codes = (invState.stationItems || {})[invState.station] || [];
  return codes.map(c => by[c]).filter(i => i && (!invState.type || i.type === invState.type)).sort((a, b) => String(invItemName(a)).localeCompare(String(invItemName(b))));
}
// Whole + Loose: kung may Whole:Loose na conversion ang produkto (hal. 1 CSE = 24 PC), dalawa ang input at ang total ay nasa loose unit
function invConv(it) { const p = invState.products[it.itemCode] || {}; const c = +p.conversionFactor || 1; if (c <= 1) return 1; if (it.countUOM && p.looseUOM && String(it.countUOM).toUpperCase() !== String(p.looseUOM).toUpperCase()) return 1; return c; }
function invWholeUom(it) { const p = invState.products[it.itemCode] || {}; return p.wholeUOM || 'Whole'; }
function invTotalFmt(q, conv, wu, lu) { q = +q || 0; const w = Math.floor(q / conv + 1e-9), l = Math.round((q - w * conv) * 100) / 100; return `${w} ${wu}${l ? ' + ' + l + ' ' + lu : ''}`; }
function invUom(it) { const p = invState.products[it.itemCode] || {}; return it.countUOM || p.looseUOM || p.wholeUOM || 'Pcs'; }
function invItemName(it) { const p = invState.products[it.itemCode]; return (p && p.itemName) || it.itemName || it.itemCode; }
function invRenderMain() {
  const root = document.getElementById('branch-inventory-root'); if (!root || !invState.ready) return;
  const stations = invStationNames();
  const items = invStationItems();
  const counted = items.filter(i => invNum(invState.entries[i.itemCode]) !== null).length;
  const rows = items.map(it => {
    const code = it.itemCode, v = invState.entries[code];
    return `<tr id="invrow-${srchEsc(invSlug(code))}" class="${invNum(v) !== null ? 'inv-done' : ''}">
      <td style="width:64px;"><img data-photo="${srchEsc(code)}" class="inv-thumb" style="visibility:hidden;" alt=""></td>
      <td><b>${srchEsc(invItemName(it))}</b><br><small style="color:#64748b;">ID: ${srchEsc(code)} · ${INV_TYPES[it.type] || ''}</small></td>
      <td>${srchEsc(invUom(it))}</td>
      ${invConv(it) > 1 ? (() => { const pt = (invState.parts || {})[code] || {}; return `<td style="width:210px;"><div style="display:flex;gap:.3rem;align-items:center;"><input type="number" inputmode="decimal" min="0" step="any" data-invw="${srchEsc(code)}" value="${pt.w == null ? '' : srchEsc(pt.w)}" placeholder="${srchEsc(invWholeUom(it))}" style="width:70px;font-weight:700;"><span style="font-size:.7rem;">${srchEsc(invWholeUom(it))}</span><input type="number" inputmode="decimal" min="0" step="any" data-invl="${srchEsc(code)}" value="${pt.l == null ? '' : srchEsc(pt.l)}" placeholder="${srchEsc(invUom(it))}" style="width:70px;font-weight:700;"><span style="font-size:.7rem;">${srchEsc(invUom(it))}</span></div><small id="invtot-${srchEsc(invSlug(code))}" style="color:#059669;">${v == null || v === '' ? '' : '= ' + srchEsc(v) + ' ' + srchEsc(invUom(it)) + ' (1 ' + srchEsc(invWholeUom(it)) + ' = ' + invConv(it) + ')'}</small></td></tr>`; })() : `<td style="width:120px;"><input type="number" inputmode="decimal" min="0" step="any" data-invq="${srchEsc(code)}" value="${v == null ? '' : srchEsc(v)}" placeholder="Bilang" style="width:100%;font-weight:700;"></td></tr>`}`;
  }).join('') || '<tr><td colspan="4" style="text-align:center;color:#94a3b8;padding:1rem;">Walang item sa station na ito.</td></tr>';
  const tmpRows = invState.temps.map((t, i) => `<tr class="inv-done" style="background:#fffbeb;"><td>🆕</td><td><b>${srchEsc(t.name)}</b><br><small style="color:#b45309;">Wala pang SAP code · ${srchEsc(t.code)}</small></td><td>${srchEsc(t.uom)}</td><td><b>${srchEsc(t.qty)}</b> <button class="btn btn-sm btn-danger" onclick="invRemoveTemp(${i})">✕</button></td></tr>`).join('');
  root.innerHTML = `
  <div class="card" data-notools="1">
    <div class="card-title"><span>📋 Inventory Count — ${srchEsc(invState.branch)} <small style="color:#64748b;">(${srchEsc(invState.branchCode)} · ${srchEsc(invState.company)})</small></span></div>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:0.75rem;margin-bottom:0.75rem;">
      <div class="form-group" style="margin:0;"><label>📅 Petsa ng Inventory</label><select id="inv-date" data-nosearch="1">${invDateOptions()}</select>${invKindBadge(invState.date)}</div>
      <div class="form-group" style="margin:0;"><label>📍 Station</label><select id="inv-station" data-searchable="1">${stations.map(s => `<option value="${srchEsc(s)}" ${s === invState.station ? 'selected' : ''}>📍 ${srchEsc(s)}</option>`).join('')}</select></div>
      <div class="form-group" style="margin:0;"><label>Uri</label><select id="inv-type" data-nosearch="1"><option value="">Lahat</option><option value="kitchen" ${invState.type === 'kitchen' ? 'selected' : ''}>🍳 Kitchen</option><option value="wares" ${invState.type === 'wares' ? 'selected' : ''}>🥢 Wares</option></select></div>
    </div>
    <div style="display:flex;gap:0.5rem;margin-bottom:0.5rem;">
      <div class="srch-wrap" style="flex:1;"><input type="text" id="inv-search" autocomplete="off" placeholder="🔎 Mag-search ng item / i-scan ang barcode (USB scanner: Enter)..."><div id="inv-results" class="srch-results"></div></div>
      <button type="button" class="btn btn-primary" onclick="openCameraBarcodeScanner('inv_count')">📷 Scan</button>
    </div>
    <label style="font-size:0.8rem;display:flex;gap:0.4rem;align-items:center;font-weight:500;margin-bottom:0.75rem;"><input type="checkbox" id="inv-auto-scan" style="width:auto;" ${(navigator.maxTouchPoints || 0) > 0 ? 'checked' : ''}> 🔁 Tuloy-tuloy na scan (pagka-Enter sa bilang, bubukas ulit ang camera)</label>
    <div style="font-size:0.85rem;color:#475569;margin-bottom:0.5rem;">Na-bilang: <b>${counted}</b> / ${items.length} sa station na ito</div>
    <div class="table-responsive"><table><thead><tr><th>Larawan</th><th>Item</th><th>UOM</th><th>Bilang</th></tr></thead><tbody>${rows}${tmpRows}</tbody></table></div>
    <div style="display:flex;gap:0.5rem;flex-wrap:wrap;margin:0.75rem 0;">
      <button class="btn btn-secondary btn-sm" onclick="invAddTempItem()">➕ Item na wala sa listahan</button>
      <button class="btn btn-secondary btn-sm" onclick="bomViewOpen()">🧪 Prepared / BOM</button>
      <button class="btn btn-secondary btn-sm" onclick="invStationMapOpen()">📍 I-set ang station ng mga item</button>
      <button class="btn btn-secondary btn-sm" onclick="invCountResult()">📊 Count Result (lahat ng station)</button>
      <button class="btn btn-secondary btn-sm" onclick="invCompareOpen()">📈 Weekly / Month-end Compare</button>
      <button class="btn btn-secondary btn-sm" onclick="invCostOpen()">💲 Unit Cost</button>
      <button class="btn btn-secondary btn-sm" onclick="invMarkOutOpen()">📤 Mark Out</button>
      <button class="btn btn-secondary btn-sm" onclick="invZeroBlanks()">0️⃣ Gawing 0 ang mga blanko</button>
      <button class="btn btn-secondary btn-sm" onclick="printInvSheet(false)">🖨️ Blank Sheet</button>
      <button class="btn btn-secondary btn-sm" onclick="printAllStationsBlank()">🖨️ Blank — lahat ng station</button>
      <button class="btn btn-secondary btn-sm" onclick="printInvSheet(true)">🖨️ May Bilang</button>
      <button class="btn btn-secondary btn-sm" onclick="exportInvCurrentCSV()">⬇️ CSV</button>
    </div>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:0.75rem;">
      <div class="form-group" style="margin:0;"><label>✍️ Binilang ni (Checked by)</label><input type="text" id="inv-checked" value="${srchEsc(invState.checkedBy != null ? invState.checkedBy : invWho())}"></div>
      <div class="form-group" style="margin:0;"><label>✍️ Tinanggap / Inaprubahan ni</label><input type="text" id="inv-received" value="${srchEsc(invState.receivedBy || '')}" placeholder="Pangalan ng manager / pumirma"></div>
      <div class="form-group" style="margin:0;"><label>Remarks</label><input type="text" id="inv-remarks" value="${srchEsc(invState.remarks || '')}"></div>
    </div>
    <button class="btn btn-success" style="width:100%;margin-top:1rem;font-weight:800;" onclick="submitInventoryCount()">💾 I-SAVE ANG INVENTORY NG STATION NA ITO</button>
  </div>
  <div class="card" data-notools="1"><div class="card-title"><span>🗂️ Mga Nakaraang Inventory ng Branch</span><button class="btn btn-secondary btn-sm" onclick="invLoadHistory()">🔄 Refresh</button></div>
    <div class="table-responsive"><table><thead><tr><th>Petsa</th><th>Station</th><th>Binilang ni</th><th>Pumirma</th><th>Items</th><th>Status</th><th>Aksyon</th></tr></thead><tbody id="inv-history-tbody"><tr><td colspan="7" style="text-align:center;color:#94a3b8;">Kinukuha...</td></tr></tbody></table></div></div>`;
  invHydratePhotos(root);
  invRenderHistory();
}
function invGrabFields() {
  const g = id => (document.getElementById(id) || {}).value;
  invState.checkedBy = g('inv-checked'); invState.receivedBy = g('inv-received'); invState.remarks = g('inv-remarks');
}
(function invBindBranchEvents() {
  document.addEventListener('input', e => {
    const t = e.target;
    if (t.dataset && t.dataset.invq !== undefined) {
      const code = t.dataset.invq; invState.entries[code] = t.value; invGrabFields(); invSaveDraft();
      const tr = t.closest('tr'); if (tr) tr.classList.toggle('inv-done', invNum(t.value) !== null);
    } else if (t.dataset && (t.dataset.invw !== undefined || t.dataset.invl !== undefined)) {
      const code = t.dataset.invw !== undefined ? t.dataset.invw : t.dataset.invl; const it = invState.items.find(i => i.itemCode === code); const tr = t.closest('tr');
      const w = tr.querySelector('[data-invw]').value, l = tr.querySelector('[data-invl]').value; invState.parts = invState.parts || {}; invState.parts[code] = { w, l };
      const conv = invConv(it); const has = invNum(w) !== null || invNum(l) !== null; const tot = has ? Math.round(((invNum(w) || 0) * conv + (invNum(l) || 0)) * 1000) / 1000 : '';
      invState.entries[code] = has ? String(tot) : ''; invGrabFields(); invSaveDraft(); tr.classList.toggle('inv-done', has);
      const lab = document.getElementById('invtot-' + invSlug(code)); if (lab) lab.textContent = has ? `= ${tot} ${invUom(it)} (1 ${invWholeUom(it)} = ${conv})` : '';
    } else if (t.id === 'inv-search') invSearch();
    else if (t.id === 'inv-checked' || t.id === 'inv-received' || t.id === 'inv-remarks') { invGrabFields(); invSaveDraft(); }
  });
  document.addEventListener('keydown', e => {
    const t = e.target;
    if (t.dataset && (t.dataset.invq !== undefined || t.dataset.invl !== undefined) && e.key === 'Enter') {
      e.preventDefault();
      const auto = document.getElementById('inv-auto-scan');
      if (auto && auto.checked) openCameraBarcodeScanner('inv_count');
      else { const s = document.getElementById('inv-search'); if (s) { s.value = ''; s.focus(); } }
    } else if (t.id === 'inv-search' && e.key === 'Enter') {
      e.preventDefault(); const it = invFindItem(t.value);
      if (it) { t.value = ''; invFocusItem(it.itemCode); } else if (invSearchResults[0]) invPickItem(0);
    }
  });
  document.addEventListener('change', e => {
    const t = e.target;
    if (t.id === 'inv-date' || t.id === 'inv-station' || t.id === 'inv-type') {
      invGrabFields();
      invSaveDraft();
      if (t.id === 'inv-date') invState.date = t.value || invToday();
      if (t.id === 'inv-station') invState.station = t.value;
      if (t.id === 'inv-type') invState.type = t.value;
      invLoadDraft(); invRenderMain();
    }
  });
  document.addEventListener('click', e => { if (!e.target.closest('.srch-wrap')) { const b = document.getElementById('inv-results'); if (b) b.style.display = 'none'; } });
})();
let invSearchResults = [];
function invSearch() {
  const q = (document.getElementById('inv-search') || {}).value || '';
  invSearchResults = invState.items.filter(i => { const p = invState.products[i.itemCode] || {}; return smartMatch(q, invItemName(i), i.itemCode, p.barcode, p.barcodeNumber, p.posCode, i.station); }).slice(0, 30);
  srchRender('inv-results', invSearchResults, i => `<b>${srchEsc(invItemName(i))}</b><br><small style="color:#64748b;">${srchEsc(i.itemCode)} · 📍 ${srchEsc(i.station)} · ${INV_TYPES[i.type] || ''}</small>`, 'invPickItem', 'Walang tugma. Puwedeng gamitin ang "➕ Item na wala sa listahan".');
}
function invPickItem(i) { const it = invSearchResults[i]; if (!it) return; const s = document.getElementById('inv-search'); if (s) s.value = ''; const b = document.getElementById('inv-results'); if (b) b.style.display = 'none'; invFocusItem(it.itemCode); }
function invFindItem(c) {
  const k = hubKey(c); if (!k) return null;
  return invState.items.find(i => { const p = invState.products[i.itemCode] || {}; return [i.itemCode, p.sapCode, p.barcode, p.barcodeNumber, p.posCode].some(x => x && hubKey(x) === k); }) || null;
}
function invFocusItem(code) {
  const it = invState.items.find(i => i.itemCode === code); if (!it) return;
  const _in = ((invState.stationItems || {})[invState.station] || []).includes(code);
  if (!_in || (invState.type && it.type !== invState.type)) { const st = invStationOf(code, invState.station); if (!st) { alert('Wala pa sa kahit anong station ang item na ito. Idagdag muna sa 📍 Station setup.'); return; } invGrabFields(); invSaveDraft(); invState.station = st; invState.type = ''; invLoadDraft(); invRenderMain(); }
  setTimeout(() => {
    const inp = document.querySelector(`input[data-invq="${CSS.escape(code)}"]`) || document.querySelector(`input[data-invw="${CSS.escape(code)}"]`);
    if (inp) { inp.scrollIntoView({ block: 'center', behavior: 'smooth' }); inp.focus(); inp.select(); const tr = inp.closest('tr'); if (tr) { tr.classList.add('inv-flash'); setTimeout(() => tr.classList.remove('inv-flash'), 1500); } }
  }, 60);
}
function invHandleScan(raw) {
  const it = invFindItem(raw);
  if (!it) { alert('⚠️ Walang item na may code/barcode na "' + String(raw).trim() + '" sa inventory list ng branch mo. Kung bago ito, gamitin ang "➕ Item na wala sa listahan".'); return; }
  invFocusItem(it.itemCode);
}
function invZeroBlanks() {
  invState.parts = invState.parts || {}; invStationItems().forEach(i => { if (invNum(invState.entries[i.itemCode]) === null) { invState.entries[i.itemCode] = '0'; if (invConv(i) > 1) invState.parts[i.itemCode] = { w: '0', l: '0' }; } });
  invSaveDraft(); invGrabFields(); invRenderMain();
}
async function invAddTempItem() {
  const name = (await uiPrompt('Pangalan ng item na wala sa listahan (hal. Bagong lalagyan, outside purchase):') || '').trim(); if (!name) return;
  const uom = (await uiPrompt('UOM (hal. pcs, kg, box):', 'pcs') || 'pcs').trim();
  const qty = invNum(await uiPrompt('Bilang:')); if (qty === null) { alert('Maglagay ng tamang bilang.'); return; }
  const code = 'TMP-' + invState.branchCode + '-' + (invSlug(name).toUpperCase().slice(0, 14) || Date.now());
  invState.temps.push({ code, name, uom, qty });
  invGrabFields(); invSaveDraft(); invRenderMain();
}
function invRemoveTemp(i) { invState.temps.splice(i, 1); invSaveDraft(); invRenderMain(); }

async function invRowsWithPhotos(rows) { await Promise.all(rows.map(async r => { r.photo = await invGetPhoto(r.code); })); return rows; }
function invCurrentRows() {
  return invStationItems().map(i => { const cv = invConv(i), pt = (invState.parts || {})[i.itemCode] || {}; return { code: i.itemCode, name: invItemName(i), uom: invUom(i), qty: invState.entries[i.itemCode], conv: cv, wuom: cv > 1 ? invWholeUom(i) : '', w: pt.w, l: pt.l }; });
}
async function printAllStationsBlank() {
  invGrabFields(); const keep = invState.station, keepType = invState.type; let html = '';
  try { invState.type = ''; for (const st of invStationNames()) { invState.station = st; let rows = invCurrentRows().map(r => ({ ...r, qty: '', w: '', l: '' })); if (!rows.length) continue; html += invSheetHtml({ station: st, branch: invState.branch, branchCode: invState.branchCode, company: invState.company, date: invState.date, rows, photos: false, split: rows.some(r => r.conv > 1), checkedBy: '', receivedBy: '', remarks: '' }); } } finally { invState.station = keep; invState.type = keepType; }
  if (!html) { alert('Walang laman ang mga station.'); return; } printHtmlDoc('Inventory — lahat ng station', html);
}
async function printInvSheet(withQty) {
  invGrabFields();
  let rows = invCurrentRows().map(r => ({ ...r, qty: withQty ? r.qty : '' }));
  if (withQty) invState.temps.forEach(t => rows.push({ code: t.code, name: t.name + ' (wala pang SAP)', uom: t.uom, qty: t.qty }));
  if (!rows.length) { alert('Walang item na ipi-print.'); return; }
  rows = await invRowsWithPhotos(rows);
  printHtmlDoc('Inventory ' + invState.station, invSheetHtml({ station: invState.station, branch: invState.branch, branchCode: invState.branchCode, company: invState.company, date: invState.date, type: invState.type ? INV_TYPES[invState.type] : '', rows, photos: true, split: rows.some(r => r.conv > 1), checkedBy: withQty ? invState.checkedBy : '', receivedBy: withQty ? invState.receivedBy : '', remarks: withQty ? invState.remarks : '' }));
}
function invCountCSV(c) {
  const rows = [['Inventory_ID', 'Item_Description', 'UOM', 'Qty', 'Branch_Code', 'Branch', 'Company', 'Station', 'Date', 'Checked_By', 'Received_Approved_By', 'Status']];
  (c.lines || []).forEach(l => rows.push([l.itemCode, l.itemName, l.uom, l.qty, c.branchCode, c.branch, c.company, c.station, c.countDate, c.checkedBy, c.approvedBy || c.receivedBy || '', c.status || '']));
  return rows.map(r => r.map(csvCell).join(',')).join('\r\n');
}
function exportInvCurrentCSV() {
  invGrabFields();
  const lines = invCurrentRows().filter(r => invNum(r.qty) !== null).map(r => ({ itemCode: r.code, itemName: r.name, uom: r.uom, qty: invNum(r.qty) }));
  invState.temps.forEach(t => lines.push({ itemCode: t.code, itemName: t.name, uom: t.uom, qty: t.qty }));
  if (!lines.length) { alert('Wala pang naka-encode na bilang.'); return; }
  downloadCSVFile(invCountCSV({ lines, branchCode: invState.branchCode, branch: invState.branch, company: invState.company, station: invState.station, countDate: invState.date, checkedBy: invState.checkedBy, receivedBy: invState.receivedBy, status: 'draft' }), `Inventory_${invState.branchCode}_${invState.date}_${invSlug(invState.station)}.csv`);
}
async function submitInventoryCount() {
  invGrabFields();
  const lines = [];
  invStationItems().forEach(i => { const q = invNum(invState.entries[i.itemCode]); if (q !== null) { const ln = { itemCode: i.itemCode, itemName: invItemName(i), uom: invUom(i), qty: q, type: i.type || '' }; const cv = invConv(i); if (cv > 1) { const pt = (invState.parts || {})[i.itemCode] || {}; ln.conv = cv; ln.wholeUom = invWholeUom(i); ln.whole = invNum(pt.w) || 0; ln.loose = invNum(pt.l) || 0; } lines.push(ln); } });
  invState.temps.forEach(t => lines.push({ itemCode: t.code, itemName: t.name, uom: t.uom, qty: invNum(t.qty), type: '', tmp: true }));
  if (!lines.length) { alert('Wala pang naka-encode na bilang.'); return; }
  if (!(invState.checkedBy || '').trim()) { alert('Ilagay kung sino ang nag-bilang (Checked by).'); return; }
  const uncounted = invStationItems().length - lines.filter(l => !l.tmp).length;
  if (uncounted > 0 && !await uiConfirm(`May ${uncounted} item sa station na ito na wala pang bilang. I-save pa rin? (Hindi sila isasama sa report.)`)) return;
  const id = `${invState.branchCode}-${invState.date.replace(/-/g, '')}-${invSlug(invState.station)}`;
  try {
    const ref = db.collection('inventory_counts').doc(id);
    const ex = await ref.get();
    if (ex.exists) {
      if ((ex.data().status || '') === 'approved') { alert('⚠️ Naka-approve na ang inventory ng station na ito sa petsang iyon. Makipag-ugnayan kay Admin para mabago.'); return; }
      if (!await uiConfirm('May na-save nang inventory para sa station at petsang ito. Papalitan ba?')) return;
    }
    const u = getCurrentUser() || {};
    await ref.set({ countId: id, branch: invState.branch, branchCode: invState.branchCode, company: invState.company, station: invState.station, countDate: invState.date, checkedBy: invState.checkedBy.trim(), checkedByEmail: u.email || '', receivedBy: (invState.receivedBy || '').trim(), remarks: invState.remarks || '', status: 'submitted', lines, uncounted, createdAt: firebase.firestore.FieldValue.serverTimestamp() });
    for (const t of invState.temps) {
      const rr = db.collection('inventory_item_requests').doc(t.code);
      if (!(await rr.get()).exists) await rr.set({ tmpCode: t.code, name: t.name, uom: t.uom, branch: invState.branch, branchCode: invState.branchCode, company: invState.company, status: 'pending', requestedBy: invWho(), firstSeenDate: invState.date, createdAt: firebase.firestore.FieldValue.serverTimestamp() });
    }
    try { await logSystemAction('INVENTORY_COUNT_SAVED', `${id}: ${lines.length} item, binilang ni ${invState.checkedBy}`); } catch (e) {}
    try { localStorage.removeItem(invDraftKey()); } catch (e) {}
    alert(`✅ Na-save ang inventory ng ${invState.station} (${invState.date}). ${lines.length} item.`);
    invState.entries = {}; invState.parts = {}; invState.temps = []; invState.receivedBy = ''; invState.remarks = '';
    invRenderMain(); invLoadHistory();
  } catch (e) { alert('Error sa pag-save: ' + e.message); }
}
async function invLoadHistory() {
  try {
    const snap = await db.collection('inventory_counts').where('branchCode', '==', invState.branchCode).get();
    invHistory = []; snap.forEach(d => { const x = { id: d.id, ...d.data() }; invHistory.push(x); invCountsCache[d.id] = x; });
    invHistory.sort((a, b) => String(b.countDate).localeCompare(String(a.countDate)));
    invRenderHistory();
  } catch (e) { console.warn(e); }
}
function invRenderHistory() {
  const tb = document.getElementById('inv-history-tbody'); if (!tb) return;
  tb.innerHTML = invHistory.length ? invHistory.map(c => invCountRowHtml(c, false)).join('') : '<tr><td colspan="7" style="text-align:center;color:#94a3b8;">Wala pang na-save na inventory.</td></tr>';
}
function invStatusBadge(c) { return c.status === 'approved' ? '<span class="badge badge-success">✔ Approved</span>' : '<span class="badge badge-warning">Submitted</span>'; }
function invCountRowHtml(c, admin) {
  const id = srchEsc(c.id);
  return `<tr><td>${srchEsc(c.countDate)}</td>${admin ? `<td><b>${srchEsc(c.branch)}</b><br><small>${srchEsc(c.branchCode)} · ${srchEsc(c.company)}</small></td>` : ''}<td>${srchEsc(c.station)}</td><td>${srchEsc(c.checkedBy)}</td><td>${srchEsc(c.approvedBy || c.receivedBy || '—')}</td><td>${(c.lines || []).length}</td><td>${invStatusBadge(c)}</td>
    <td style="white-space:nowrap;"><button class="btn btn-sm btn-secondary" onclick="viewInvCount('${id}')">👁️</button> <button class="btn btn-sm btn-secondary" onclick="printInvCount('${id}')">🖨️</button> <button class="btn btn-sm btn-secondary" onclick="exportInvCount('${id}')">⬇️</button>${admin && c.status !== 'approved' ? ` <button class="btn btn-sm btn-success" onclick="approveInvCount('${id}')">✔ Approve</button>` : ''}</td></tr>`;
}
function viewInvCount(id) {
  const c = invCountsCache[id]; if (!c) return;
  let ov = document.getElementById('inv-view-modal');
  if (!ov) { ov = document.createElement('div'); ov.id = 'inv-view-modal'; ov.className = 'modal-overlay'; ov.style.display = 'none'; ov.innerHTML = '<div class="modal-content" style="max-width:760px;max-height:90vh;overflow-y:auto;"><div id="inv-view-body"></div></div>'; document.body.appendChild(ov); }
  document.getElementById('inv-view-body').innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #e2e8f0;padding-bottom:0.5rem;margin-bottom:0.75rem;"><h3 style="margin:0;">📋 ${srchEsc(c.station)} — ${srchEsc(c.countDate)}</h3><button class="btn btn-secondary btn-sm" onclick="document.getElementById('inv-view-modal').style.display='none'">✕</button></div>
    <div style="font-size:0.85rem;color:#475569;margin-bottom:0.75rem;">Branch: <b>${srchEsc(c.branch)}</b> (${srchEsc(c.branchCode)}) · ${srchEsc(c.company)}<br>Binilang ni: <b>${srchEsc(c.checkedBy)}</b> · Tinanggap/Inaprubahan ni: <b>${srchEsc(c.approvedBy || c.receivedBy || '—')}</b>${c.approvedAt ? ' · ' + srchEsc(new Date(c.approvedAt.seconds ? c.approvedAt.seconds * 1000 : c.approvedAt).toLocaleString('en-PH')) : ''}<br>${invStatusBadge(c)} ${c.remarks ? '· ' + srchEsc(c.remarks) : ''}</div>
    <div class="table-responsive"><table><thead><tr><th>Inventory ID</th><th>Item</th><th>UOM</th><th>Bilang</th></tr></thead><tbody>${(c.lines || []).map(l => `<tr><td>${srchEsc(l.itemCode)}</td><td>${srchEsc(l.itemName)}${l.tmp ? ' <span class="badge badge-warning">Wala pang SAP</span>' : ''}</td><td>${srchEsc(l.uom)}</td><td><b>${srchEsc(l.qty)}</b></td></tr>`).join('')}</tbody></table></div>
    <div style="display:flex;gap:0.5rem;margin-top:1rem;"><button class="btn btn-primary" onclick="printInvCount('${srchEsc(id)}')">🖨️ Print</button><button class="btn btn-secondary" onclick="exportInvCount('${srchEsc(id)}')">⬇️ CSV</button></div>`;
  ov.style.display = 'flex';
}
async function printInvCount(id) {
  const c = invCountsCache[id]; if (!c) return;
  const rows = await invRowsWithPhotos((c.lines || []).map(l => ({ code: l.itemCode, name: l.itemName + (l.tmp ? ' (wala pang SAP)' : ''), uom: l.uom, qty: l.qty })));
  printHtmlDoc('Inventory ' + c.station, invSheetHtml({ station: c.station, branch: c.branch, branchCode: c.branchCode, company: c.company, date: c.countDate, rows, photos: true, checkedBy: c.checkedBy, receivedBy: c.approvedBy || c.receivedBy, remarks: c.remarks }));
}
function exportInvCount(id) { const c = invCountsCache[id]; if (c) downloadCSVFile(invCountCSV(c), `Inventory_${c.branchCode}_${c.countDate}_${invSlug(c.station)}.csv`); }