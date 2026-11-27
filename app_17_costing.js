


// ========================================================
// 💰 PUHUNAN (COST) vs PRESYONG PANINDA (SELLING PRICE) at MARGIN
// Ang wholePrice/loosePrice ng produkto = PRESYONG PANINDA sa branch/customer.
// Ang puhunan ay nasa HIWALAY na collection (product_costs) para hindi makita ng branch (staff lang).
// Pricing rules (product_costs/_rules): overheadPct = gastos sa truck, maintenance, gasolina, labor; markupPct = tubo.
// ========================================================
let productCosts = {};
let pricingRules = { overheadPct: 0, markupPct: 0 };
async function loadProductCosts() {
  productCosts = {};
  try {
    const snap = await db.collection('product_costs').get();
    snap.forEach(d => { if (d.id === '_rules') pricingRules = { overheadPct: parseFloat(d.data().overheadPct) || 0, markupPct: parseFloat(d.data().markupPct) || 0 }; else productCosts[d.id] = d.data(); });
  } catch (e) { /* walang pahintulot (hal. branch) o walang data */ }
  return productCosts;
}
function costOf(p, uom) {
  const c = productCosts[p && p.id] || {};
  const v = parseFloat(uom === 'Whole' ? c.costWhole : c.costLoose) || 0;
  return v;
}
function marginInfo(cost, price) {
  cost = parseFloat(cost) || 0; price = parseFloat(price) || 0;
  if (!(price > 0)) return { margin: null, markup: null, profit: price - cost };
  return { margin: cost > 0 ? ((price - cost) / price) * 100 : null, markup: cost > 0 ? ((price - cost) / cost) * 100 : null, profit: price - cost };
}
function minPriceFor(cost) { return (parseFloat(cost) || 0) * (1 + pricingRules.overheadPct / 100); }
function suggestedPriceFor(cost) { return minPriceFor(cost) * (1 + pricingRules.markupPct / 100); }
function money(n) { return '₱' + (parseFloat(n) || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
async function editPricingRules() {
  const o = await uiPrompt('Overhead % (gastos sa truck, maintenance, gasolina, labor na dapat mabawi sa bawat produkto):', pricingRules.overheadPct);
  if (o === null) return;
  const m = await uiPrompt('Tubo / Markup % (idadagdag pagkatapos ng overhead):', pricingRules.markupPct);
  if (m === null) return;
  const ov = parseFloat(o), mk = parseFloat(m);
  if (isNaN(ov) || isNaN(mk) || ov < 0 || mk < 0) { alert('Maglagay ng tamang numero (0 o higit pa).'); return; }
  try {
    await db.collection('product_costs').doc('_rules').set({ overheadPct: ov, markupPct: mk, updatedAt: firebase.firestore.FieldValue.serverTimestamp() });
    pricingRules = { overheadPct: ov, markupPct: mk };
    try { await logSystemAction('PRICING_RULES', `Overhead ${ov}%, Markup ${mk}%`); } catch (e) {}
    alert(`✅ Na-save: Overhead ${ov}% · Markup ${mk}%. Halimbawa: puhunan ₱100 → pinakamababang presyo ${money(minPriceFor(100))} → suggested ${money(suggestedPriceFor(100))}.`);
    if (typeof renderAdminProductsTable === 'function' && adminProductsList.length) renderAdminProductsTable(adminProductsList);
  } catch (e) { alert('Error: ' + e.message); }
}
function updateAdminMarginBox() {
  const box = document.getElementById('admin-item-margin-box'); if (!box) return;
  const g = id => parseFloat((document.getElementById(id) || {}).value) || 0;
  const cw = g('admin-item-cost-whole'), pw = g('admin-item-whole-price'), cl = g('admin-item-cost-loose'), pl = g('admin-item-loose-price');
  const line = (label, c, p) => {
    if (!(c > 0)) return `<div>${label}: <span style="color:#94a3b8;">ilagay ang puhunan</span></div>`;
    const m = marginInfo(c, p), min = minPriceFor(c), low = p < min;
    return `<div>${label}: Puhunan <b>${money(c)}</b> → Paninda <b>${money(p)}</b> · Tubo <b style="color:${m.profit < 0 ? '#dc2626' : '#059669'}">${money(m.profit)}</b> (${m.margin == null ? '—' : m.margin.toFixed(1) + '% margin'} · ${m.markup == null ? '—' : m.markup.toFixed(1) + '% markup'})${low ? ` <b style="color:#dc2626;">⚠️ Mas mababa sa ${money(min)} (kulang pambawi sa overhead ${pricingRules.overheadPct}%)</b>` : ''}<br><small style="color:#64748b;">Suggested na presyo: ${money(suggestedPriceFor(c))}</small></div>`;
  };
  box.innerHTML = line('Whole', cw, pw) + line('Loose', cl, pl);
}
// ===== Supplier Price + SRP + Conversion sa gramo/ml =====
function apNum(id) { const v = parseFloat((document.getElementById(id) || {}).value); return isNaN(v) ? 0 : v; }
function apSetVal(id, v) { const el = document.getElementById(id); if (el) el.value = v; }
function updateAdminGramBox() {
  const box = document.getElementById('admin-item-gram-box'); if (!box) return;
  const cw = apNum('admin-item-content-whole'), cl = apNum('admin-item-content-loose'), u = (document.getElementById('admin-item-content-unit') || {}).value || 'g', conv = apNum('admin-item-conversion') || 1;
  const sw = apNum('admin-item-sp-whole'), sl = apNum('admin-item-sp-loose'), pw = apNum('admin-item-whole-price'), pl = apNum('admin-item-loose-price'), mon = n => (typeof money === 'function' ? money(n) : '₱' + n.toFixed(2)), per = (p, c) => (p > 0 && c > 0 ? p / c : 0), f4 = n => n.toFixed(4).replace(/0+$/, '').replace(/\.$/, '');
  let h = '';
  if (cw > 0 && cl > 0) { const r = cw / cl; h += `1 Whole = <b>${f4(cw)} ${u}</b> · 1 Loose = <b>${f4(cl)} ${u}</b> → 1 Whole = <b>${f4(r)}</b> Loose ${Math.abs(r - conv) > 0.0001 ? `<span style="color:#b45309;">(iba sa Conversion na ${conv}; pindutin ang ↔️ para tumugma)</span>` : '✔'}<br>`; }
  else if (cw > 0 || cl > 0) h += `<span style="color:#64748b;">Ilagay ang laman ng parehong Whole at Loose para makompyut ang conversion.</span><br>`;
  const pg = (label, p, c) => (p > 0 && c > 0 ? `${label}: <b>${mon(per(p, c))}</b> bawat ${u}` : ''); const pr = [pg('SRP Whole', pw, cw), pg('SRP Loose', pl, cl), pg('Supplier Whole', sw, cw), pg('Supplier Loose', sl, cl)].filter(Boolean); if (pr.length) h += '⚖️ ' + pr.join(' · ') + '<br>';
  if (sw > 0 && pw > 0) { const t = pw - sw; h += `🚚→💰 Supplier ${mon(sw)} → SRP ${mon(pw)} · Tubo <b style="color:${t < 0 ? '#dc2626' : '#059669'}">${mon(t)}</b> (${((t / pw) * 100).toFixed(1)}% margin)`; }
  box.innerHTML = (h || '<span style="color:#94a3b8;">Ilagay ang laman ng Whole/Loose sa gramo o ml para makita ang presyo bawat gramo.</span>') + (cw > 0 && cl > 0 ? ` <button type="button" class="btn btn-secondary btn-sm" onclick="apApplyConv()" title="Gamitin ang Whole ÷ Loose bilang Conversion">↔️ Gamitin bilang Conversion</button>` : '');
}
function apApplyConv() { const cw = apNum('admin-item-content-whole'), cl = apNum('admin-item-content-loose'); if (!(cw > 0 && cl > 0)) return; const r = cw / cl; if (Math.abs(r - Math.round(r)) > 0.0001) { alert(`Hindi buong numero ang ${r.toFixed(4)} (Whole ÷ Loose). Ayusin ang laman ng Loose para buo ang bilang (hal. 1000 g ÷ 100 g = 10).`); return; } apSetVal('admin-item-conversion', Math.round(r)); autoComputeAdminLoosePrice(); autoComputeAdminLooseCost(); apSpLoose(); updateAdminMarginBox(); updateAdminGramBox(); }
function apSpLoose() { const sw = apNum('admin-item-sp-whole'), conv = apNum('admin-item-conversion') || 1; if (sw > 0 && conv > 0) apSetVal('admin-item-sp-loose', (sw / conv).toFixed(4)); }
function autoComputeAdminLooseCost() {
  const cw = parseFloat((document.getElementById('admin-item-cost-whole') || {}).value) || 0;
  const conv = parseFloat((document.getElementById('admin-item-conversion') || {}).value) || 1;
  const cl = document.getElementById('admin-item-cost-loose');
  if (cl && cw > 0 && conv > 0) cl.value = (cw / conv).toFixed(4);
}
document.addEventListener('input', e => {
  const id = e.target && e.target.id;
  if (id === 'admin-item-cost-whole' || id === 'admin-item-conversion') autoComputeAdminLooseCost();
  if (id === 'admin-item-sp-whole' || id === 'admin-item-conversion') { apSpLoose(); if (id === 'admin-item-sp-whole' && !apNum('admin-item-cost-whole') && apNum('admin-item-sp-whole') > 0) { apSetVal('admin-item-cost-whole', apNum('admin-item-sp-whole')); autoComputeAdminLooseCost(); } }
  if (id === 'admin-item-content-whole' && apNum('admin-item-content-whole') > 0 && !apNum('admin-item-content-loose') && apNum('admin-item-conversion') > 1) apSetVal('admin-item-content-loose', +(apNum('admin-item-content-whole') / apNum('admin-item-conversion')).toFixed(4));
  if (/^admin-item-(sp-|content-|whole-price|loose-price|conversion)/.test(id || '')) updateAdminGramBox();
  if (['admin-item-cost-whole', 'admin-item-cost-loose', 'admin-item-whole-price', 'admin-item-loose-price', 'admin-item-conversion'].includes(id)) updateAdminMarginBox();
});
(function hookCostForm() {
  const orig = window.openAdminProductModal; if (typeof orig !== 'function') return;
  window.openAdminProductModal = async function (id) {
    const r = await orig.apply(this, arguments);
    if (!Object.keys(productCosts).length) await loadProductCosts();
    const c = id ? (productCosts[id] || {}) : {};
    const set = (k, v) => { const el = document.getElementById(k); if (el) el.value = v || 0; };
    set('admin-item-cost-whole', c.costWhole); set('admin-item-cost-loose', c.costLoose); set('admin-item-sp-whole', c.supplierPrice); set('admin-item-sp-loose', c.supplierPriceLoose);
    { const pr = id ? (adminProductsList || []).find(p => p.id === id) : null; const cu = document.getElementById('admin-item-content-unit'); apSetVal('admin-item-content-whole', pr && pr.wholeContent ? pr.wholeContent : ''); apSetVal('admin-item-content-loose', pr && pr.looseContent ? pr.looseContent : ''); if (cu) cu.value = (pr && pr.contentUnit) || 'g'; }
    updateAdminMarginBox(); updateAdminGramBox();
    return r;
  };
})();
async function saveProductCost(code) {
  const g = id => parseFloat((document.getElementById(id) || {}).value) || 0;
  const u = getCurrentUser() || {};
  await db.collection('product_costs').doc(code).set({ costWhole: g('admin-item-cost-whole'), costLoose: g('admin-item-cost-loose'), supplierPrice: g('admin-item-sp-whole'), supplierPriceLoose: g('admin-item-sp-loose'), updatedBy: u.email || '', updatedAt: firebase.firestore.FieldValue.serverTimestamp() }, { merge: true });
  productCosts[code] = { costWhole: g('admin-item-cost-whole'), costLoose: g('admin-item-cost-loose'), supplierPrice: g('admin-item-sp-whole'), supplierPriceLoose: g('admin-item-sp-loose') };
}
function productPriceCellsHtml(prod, wholeUOM, looseUOM) {
  const p = { id: prod.id };
  const cw = costOf(p, 'Whole'), cl = costOf(p, 'Loose');
  const note = (cost, price) => {
    if (!(cost > 0)) return '<br><small style="color:#94a3b8;">walang puhunan</small>';
    const m = marginInfo(cost, price), low = price < minPriceFor(cost);
    return `<br><small style="color:${low ? '#dc2626' : '#64748b'};">Puhunan ${money(cost)} · ${m.margin == null ? '' : m.margin.toFixed(0) + '% margin'}${low ? ' ⚠️' : ''}</small>`;
  };
  const sc = (productCosts[prod.id] || {}), cu = prod.contentUnit || 'g';
  const gram = (price, content) => (content > 0 && price > 0 ? `<br><small style="color:#0369a1;">⚖️ ${content} ${cu} · ${money(price / content)}/${cu}</small>` : '');
  const sup = (v) => (v > 0 ? `<br><small style="color:#7c3aed;">🚚 Supplier ${money(v)}</small>` : '');
  return `<td><small style="color:#64748b;">SRP</small> <b style="color: #2563eb;">${money(prod.wholePrice)}</b> / ${wholeUOM}${sup(parseFloat(sc.supplierPrice) || 0)}${note(cw, parseFloat(prod.wholePrice) || 0)}${gram(parseFloat(prod.wholePrice) || 0, parseFloat(prod.wholeContent) || 0)}</td>
        <td><small style="color:#64748b;">SRP</small> <b style="color: #059669;">${money(prod.loosePrice)}</b> / ${looseUOM}${sup(parseFloat(sc.supplierPriceLoose) || 0)}${note(cl, parseFloat(prod.loosePrice) || 0)}${gram(parseFloat(prod.loosePrice) || 0, parseFloat(prod.looseContent) || 0)}</td>`;
}
// ---- BOM: ang cost ng recipe ay PUHUNAN ng sangkap (hindi ang presyong paninda) ----
async function applyBomPricing(bomId) {
  const bom = bomRecipes.find(b => b.id === bomId); if (!bom) return;
  const r = bomReportData(bom, 1);
  if (r.noCost > 0 && !await uiConfirm(`⚠️ May ${r.noCost} sangkap na walang puhunan (ginamit ang presyong paninda nila). Hindi tumpak ang cost. Ituloy pa rin?`)) return;
  const perUnit = r.perUnit, sugg = suggestedPriceFor(perUnit), batchSugg = suggestedPriceFor(r.total);
  if (!await uiConfirm(`I-apply sa produkto na "${bom.finishedGoodName}"?\n\nPuhunan bawat unit: ${money(perUnit)}\nPuhunan bawat batch: ${money(r.total)}\nBagong presyong paninda bawat unit: ${money(sugg)}\nBagong presyong paninda bawat batch: ${money(batchSugg)}\n(Overhead ${pricingRules.overheadPct}% + Markup ${pricingRules.markupPct}%)`)) return;
  try {
    const code = bom.finishedGoodCode;
    await db.collection('product_costs').doc(code).set({ costWhole: +r.total.toFixed(4), costLoose: +perUnit.toFixed(4), updatedBy: (getCurrentUser() || {}).email || '', updatedAt: firebase.firestore.FieldValue.serverTimestamp() }, { merge: true });
    await db.collection('products').doc(code).set({ wholePrice: +batchSugg.toFixed(2), loosePrice: +sugg.toFixed(2) }, { merge: true });
    productCosts[code] = { costWhole: r.total, costLoose: perUnit };
    try { await logSystemAction('BOM_PRICING_APPLIED', `${code}: puhunan ${perUnit.toFixed(2)}/unit, paninda ${sugg.toFixed(2)}/unit`); } catch (e) {}
    alert('✅ Na-update ang puhunan at presyong paninda ng produkto.');
    if (typeof loadAdminProducts === 'function') loadAdminProducts();
  } catch (e) { alert('Error: ' + e.message); }
}


// ========================================================
// 📝 PO STATUS FLOW (SAP B1 style)
// Draft → For Approval → Approved → Received (GRPO / A/P Invoice) → For Payment → Paid & Closed
// ========================================================
function poFmtDate(t){ try{ const d=t&&t.toDate?t.toDate():(t&&t.seconds?new Date(t.seconds*1000):new Date(t)); return isNaN(d)?'':d.toLocaleDateString('en-PH'); }catch(e){return '';} }
function poIsApproved(po){
  if (!po) return false;
  if (po.status === 'Sent to Vendor' || po.status === 'Approved') return true; // legacy PO = approved na
  return false;
}
function poStatusBadge(po){
  const st = po.status || '';
  const ap = po.approvals || {};
  const sc = ap.supplyChain ? '✅' : '⬜', co = ap.coo ? '✅' : '⬜';
  if (st === 'Draft') return '<span class="badge badge-secondary">Draft</span>';
  if (st === 'For Approval') return `<span class="badge badge-warning">For Approval</span><br><small>${sc} SC Head &nbsp; ${co} COO</small>`;
  if (st === 'Approved' || st === 'Sent to Vendor') return `<span class="badge badge-commissary">Approved${st==='Sent to Vendor'?' (legacy)':''}</span>${po.dpAmount?`<br><small style="color:#7c3aed;">DP ${money(po.dpAmount)}</small>`:''}`;
  return `<span class="badge badge-success">${st}</span>`;
}
function poSapRefsHtml(po){
  const r=[]; if(po.sapPoNo) r.push('SAP PO: '+srchEsc(po.sapPoNo)); if(po.grpoNo) r.push('GRPO: '+srchEsc(po.grpoNo)); if(po.sapApInvoiceNo) r.push('A/P Inv: '+srchEsc(po.sapApInvoiceNo)); if(po.requestKey) r.push('📎 '+srchEsc(po.requestKey)+(po.company?' · '+srchEsc(po.company):'')+(po.branch?' · '+srchEsc(po.branch):''));
  return r.length?`<br><small style="color:#0369a1;">${r.join(' • ')}</small>`:'';
}
function poActionButtons(po){
  const st = po.status || '', ap = po.approvals || {};
  let h = '';
  if (st === 'Draft') h += `<button class="btn btn-sm btn-warning" onclick="poSubmitForApproval('${po.id}')">📤 Submit for Approval</button>`;
  if (st === 'For Approval') {
    if (!ap.supplyChain) h += `<button class="btn btn-sm btn-success" onclick="poSignOff('${po.id}','supplyChain')">✍️ Head of SC</button>`;
    if (!ap.coo) h += `<button class="btn btn-sm btn-success" onclick="poSignOff('${po.id}','coo')">✍️ COO</button>`;
    h += `<button class="btn btn-sm btn-danger" onclick="poReturnToDraft('${po.id}')">↩ Return</button>`;
  }
  if (poIsApproved(po)) {
    h += `<button class="btn btn-sm btn-success" style="font-weight:bold;" onclick="openReceivePOModal('${po.id}')">📦 Receive</button>`;
    h += `<button class="btn btn-sm btn-secondary" onclick="poDownPayment('${po.id}')">💵 DP</button>`;
    h += `<button class="btn btn-sm btn-secondary" onclick="poEditSapRefs('${po.id}')">🏷️ SAP</button>`;
  }
  return h;
}
function poLog(poId, text){ try{ logSystemAction('PO_FLOW', `${poId}: ${text}`); }catch(e){} }
async function poSubmitForApproval(poId){
  if (!await uiConfirm('I-submit ang PO for approval? (I-print at ipapirma sa Head of Supply Chain at COO.)')) return;
  await db.collection('vendor_pos').doc(poId).update({ status:'For Approval', approvals:{} });
  notify(['coo', 'supply'], `PO para sa pirma: ${poId}`, `${(getCurrentUser() || {}).name || ''} ay nag-submit ng PO ${poId} for approval (Head of SC at COO).`);
  poLog(poId,'Submitted for approval'); loadAdminVendorPOs();
}
async function poReturnToDraft(poId){
  if (!await uiConfirm('Ibalik sa Draft ang PO? Mabubura ang mga pirma.')) return;
  await db.collection('vendor_pos').doc(poId).update({ status:'Draft', approvals:{} });
  poLog(poId,'Returned to draft'); loadAdminVendorPOs();
}
async function poSignOff(poId, who){
  const label = who === 'coo' ? 'COO' : 'Head of Supply Chain';
  const u = getCurrentUser(); const name = (u && (u.name||u.email)) || 'Admin';
  const po = (allVendorPOs||[]).find(p=>p.id===poId); if(!po) return;
  try {
    const cfg = await poGetSignatories(); const need = (who === 'coo' ? cfg.cooEmail : cfg.supplyChainEmail) || '';
    if (need && need.toLowerCase() !== String((u && u.email) || '').toLowerCase()) { alert(`⚠️ Si ${need} lang ang puwedeng mag-sign-off bilang ${label}.`); return; }
  } catch (e) {}
  if (!await uiConfirm(`Ikinukumpirma mo na pumirma na ang ${label} sa printed PO ${po.poNumber}?\n\nIre-record ito bilang naka-sign-off (${name}).`)) return;
  const ref = db.collection('vendor_pos').doc(poId);
  try {
    await db.runTransaction(async tx=>{
      const snap = await tx.get(ref); if(!snap.exists) throw new Error('Hindi nahanap ang PO.');
      const d = snap.data();
      if (d.status !== 'For Approval') throw new Error('Hindi na For Approval ang PO.');
      const approvals = Object.assign({}, d.approvals||{});
      approvals[who] = { by: label + ' – ' + name, at: new Date().toISOString() };
      const upd = { approvals };
      if (approvals.supplyChain && approvals.coo) { upd.status = 'Approved'; upd.approvedAt = firebase.firestore.FieldValue.serverTimestamp(); }
      tx.update(ref, upd);
    });
    poLog(poId, `${label} signed off`); loadAdminVendorPOs();
  } catch(e){ alert('Error: '+e.message); }
}
async function poGetSignatories(){ const d = await db.collection('system_settings').doc('po_signatories').get(); return d.exists ? d.data() : {}; }
async function poSetSignatories(){
  const cfg = await poGetSignatories();
  const sc = await uiPrompt('Email ng HEAD OF SUPPLY CHAIN (siya lang ang makaka-sign-off). Blangko = kahit sinong admin:', cfg.supplyChainEmail || ''); if (sc === null) return;
  const coo = await uiPrompt('Email ng COO (siya lang ang makaka-sign-off). Blangko = kahit sinong admin:', cfg.cooEmail || ''); if (coo === null) return;
  await db.collection('system_settings').doc('po_signatories').set({ supplyChainEmail: sc.trim().toLowerCase(), cooEmail: coo.trim().toLowerCase() });
  alert('✅ Na-save ang mga signatory.');
}
async function poEditSapRefs(poId){
  const ref = db.collection('vendor_pos').doc(poId);
  const snap = await ref.get(); if(!snap.exists) return; const d = snap.data();
  const sapPo = await uiPrompt('SAP PO No. (Purchase Order sa SAP B1):', d.sapPoNo||''); if (sapPo===null) return;
  const grpo = await uiPrompt('GRPO No. (Goods Receipt PO sa SAP):', d.grpoNo||''); if (grpo===null) return;
  const apInv = await uiPrompt('SAP A/P Invoice No.:', d.sapApInvoiceNo||''); if (apInv===null) return;
  await ref.update({ sapPoNo: sapPo.trim(), grpoNo: grpo.trim(), sapApInvoiceNo: apInv.trim() });
  poLog(poId,'SAP refs updated');
  loadAdminVendorPOs(); if (typeof loadAdminAPInvoices==='function') loadAdminAPInvoices();
}
async function poDownPayment(poId){
  const ref = db.collection('vendor_pos').doc(poId);
  const glRef = db.collection('general_ledger').doc('DP-' + poId);
  const amtStr = await uiPrompt('Down payment amount (₱):'); if (amtStr===null) return;
  const amt = parseFloat(amtStr);
  if (!(amt>0)) { alert('Maglagay ng tamang halaga.'); return; }
  try {
    await db.runTransaction(async tx=>{
      const snap = await tx.get(ref); if(!snap.exists) throw new Error('Hindi nahanap ang PO.');
      const d = snap.data();
      if (d.dpAmount) throw new Error('May naka-record nang down payment (' + money(d.dpAmount) + ').');
      if (d.status === 'Paid & Closed') throw new Error('Paid & Closed na ang PO.');
      const total = parseFloat(d.actualTotalAmount || d.totalAmount || 0);
      if (amt > total) throw new Error('Mas malaki ang down payment kaysa sa total ng PO.');
      const g = await tx.get(glRef);
      if (!g.exists) tx.set(glRef, { type:'Supplier Down Payment (PO)', ref:`DP PO ${d.poNumber||poId} - ${d.vendorName||''}`, credit:amt, debit:0, sourcePO:poId, timestamp:firebase.firestore.FieldValue.serverTimestamp() });
      tx.update(ref, { dpAmount: amt, dpAt: firebase.firestore.FieldValue.serverTimestamp(), dpBy: (getCurrentUser()?.name||'Accounting') });
    });
    poLog(poId, 'Down payment ' + amt);
    alert('✅ Na-record ang down payment. Ibabawas ito sa final payment.');
    loadAdminVendorPOs(); if (typeof loadAdminAPInvoices==='function') loadAdminAPInvoices();
  } catch(e){ alert('Error: '+e.message); }
}


// ========================================================
// 💲 PRICE LIST PER COMPANY / CUSTOMER
// price_lists/{companySlug} = { company, transportPct, prices:{ code:{whole,loose} } }
// Walang entry = default presyong paninda ng produkto. Hindi kasama ang puhunan dito (nababasa ng branch).
// ========================================================
let plState = { company: '', rows: [], transportPct: 0, lists: {} };
async function applyCompanyPriceList(products, company) {
  if (!company || !db) return products;
  try {
    const d = await db.collection('price_lists').doc(invSlug(company)).get();
    if (!d.exists) return products;
    const pr = (d.data() || {}).prices || {};
    products.forEach(p => {
      const o = pr[p.id] || pr[p.sapCode];
      if (!o) return;
      if (o.whole != null && o.whole !== '') { p.defaultWholePrice = p.wholePrice; p.wholePrice = parseFloat(o.whole) || 0; }
      if (o.loose != null && o.loose !== '') { p.defaultLoosePrice = p.loosePrice; p.loosePrice = parseFloat(o.loose) || 0; }
      p.priceListApplied = company;
    });
  } catch (e) { console.warn('price list', e); }
  return products;
}
async function loadPriceLists() {
  const root = document.getElementById('pricelist-admin-root'); if (!root || !db) return;
  root.innerHTML = '<div class="card">Kinukuha ang mga price list...</div>';
  try {
    const [cSnap, lSnap, pSnap] = await Promise.all([db.collection('companies').get(), db.collection('price_lists').get(), db.collection('products').get(), loadProductCosts()]);
    plState.companies = []; cSnap.forEach(d => plState.companies.push(d.data().name || d.id));
    plState.lists = {}; lSnap.forEach(d => plState.lists[d.id] = d.data());
    plState.products = []; pSnap.forEach(d => plState.products.push({ id: d.id, ...d.data() }));
    plState.products.sort((a, b) => (a.itemName || '').localeCompare(b.itemName || ''));
    if (!plState.company || !plState.companies.includes(plState.company)) plState.company = plState.companies[0] || '';
    plRender();
  } catch (e) { root.innerHTML = `<div class="card" style="color:#dc2626;">Error: ${srchEsc(e.message)}</div>`; }
}
function plPickCompany(v) { plState.company = v; plRender(); }
function plCurrentList() { return plState.lists[invSlug(plState.company)] || { prices: {}, transportPct: 0 }; }
function plRender() {
  const root = document.getElementById('pricelist-admin-root'); if (!root) return;
  if (!plState.companies.length) { root.innerHTML = '<div class="card">Wala pang company. Gumawa muna sa 🏢 Company Management (isama ang external customers tulad ng ibang company na umo-order ng ramen/gyoza wrapper).</div>'; return; }
  const list = plCurrentList(), pr = list.prices || {};
  const q = (document.getElementById('pl-search') || {}).value || '';
  const prods = plState.products.filter(p => productForCompany(p, plState.company) && (!q || smartMatch(q, (p.itemName || '') + ' ' + (p.sapCode || p.id))));
  plState.rows = prods;
  const opts = plState.companies.map(c => `<option ${c === plState.company ? 'selected' : ''}>${srchEsc(c)}</option>`).join('');
  const tp = list.transportPct != null ? list.transportPct : 0;
  let rows = '';
  prods.forEach((p, i) => {
    const o = pr[p.id] || {}; const cw = costOf(p, 'Whole'), cl = costOf(p, 'Loose');
    const chk = (cost, val, def) => { const price = (val !== '' && val != null) ? parseFloat(val) : parseFloat(def) || 0; if (!(cost > 0)) return '<small style="color:#94a3b8;">walang puhunan</small>'; const m = marginInfo(cost, price); const low = price < minPriceFor(cost); return `<small style="color:${low ? '#dc2626' : '#059669'};">${m.margin == null ? '' : m.margin.toFixed(0) + '%'} ${low ? '⚠️ mababa sa min ' + money(minPriceFor(cost)) : ''}</small>`; };
    rows += `<tr data-i="${i}"><td><b>${srchEsc(p.itemName || '')}</b><br><small style="font-family:monospace;color:#64748b;">${srchEsc(p.sapCode || p.id)}</small></td>
      <td>${cw > 0 ? money(cw) : '—'}<br>${cl > 0 ? money(cl) : '—'}</td>
      <td>${money(p.wholePrice)}<br>${money(p.loosePrice)}<br><small style="color:#64748b;">/${srchEsc(p.wholeUOM || '')} · /${srchEsc(p.looseUOM || '')}</small></td>
      <td><input type="number" step="0.01" min="0" id="pl-w-${i}" value="${o.whole != null ? o.whole : ''}" placeholder="${p.wholePrice || 0}" style="width:100px;" oninput="plRowMargin(${i})"><br><span id="pl-wm-${i}">${chk(cw, o.whole, p.wholePrice)}</span></td>
      <td><input type="number" step="0.01" min="0" id="pl-l-${i}" value="${o.loose != null ? o.loose : ''}" placeholder="${p.loosePrice || 0}" style="width:100px;" oninput="plRowMargin(${i})"><br><span id="pl-lm-${i}">${chk(cl, o.loose, p.loosePrice)}</span></td></tr>`;
  });
  root.innerHTML = `<div class="card"><div class="card-title"><span>💲 Price List per Company</span></div>
    <p style="font-size:.85rem;color:#64748b;">Iba-iba ang presyong paninda bawat company. Walang laman = gagamitin ang default na presyo ng produkto. Ang branch na nasa company na ito ang makakakita ng presyong ito. Nakikita lang ng admin/staff ang puhunan.</p>
    <div style="display:flex;gap:.5rem;flex-wrap:wrap;align-items:end;margin-bottom:.75rem;">
      <div><label style="font-weight:700;">Company / Customer</label><br><select id="pl-company" onchange="plPickCompany(this.value)">${opts}</select></div>
      <div><label style="font-weight:700;">Transport / delivery % (truck)</label><br><input type="number" id="pl-transport" step="0.1" min="0" value="${tp}" style="width:110px;"></div>
      <button class="btn btn-secondary btn-sm" onclick="plAutoFill(false)">⚡ Auto-fill (blanks) mula sa puhunan</button>
      <button class="btn btn-secondary btn-sm" onclick="plAutoFill(true)">⚡ Auto-fill lahat</button>
      <button class="btn btn-secondary btn-sm" onclick="plClear()">🧹 Clear</button>
      <button class="btn btn-secondary btn-sm" onclick="plPrint()">🖨️ Print</button>
      <button class="btn btn-secondary btn-sm" onclick="plExportCSV()">📤 CSV</button>
      <button class="btn btn-secondary btn-sm" onclick="plImportCSV()">📥 Import</button>
      <button class="btn btn-success" onclick="plSave()">💾 I-save</button></div>
    <small style="color:#64748b;">Auto-fill formula: puhunan × (1 + overhead ${pricingRules.overheadPct}%) × (1 + tubo ${pricingRules.markupPct}%) × (1 + transport %).</small>
    <input type="text" id="pl-search" placeholder="🔎 Hanapin ang produkto..." oninput="plRender()" value="${srchEsc(q)}" style="margin:.6rem 0;width:100%;">
    <div class="table-responsive"><table data-notools="1"><thead><tr><th>Produkto</th><th>Puhunan<br><small>Whole / Loose</small></th><th>Default na presyo</th><th>Presyo ng company (Whole)</th><th>Presyo ng company (Loose)</th></tr></thead><tbody>${rows || '<tr><td colspan="5">Walang produkto para sa company na ito.</td></tr>'}</tbody></table></div></div>`;
}
function plRowMargin(i) {
  const p = plState.rows[i]; if (!p) return;
  const set = (id, cost, inputId, def) => { const v = (document.getElementById(inputId) || {}).value; const price = v !== '' ? parseFloat(v) : parseFloat(def) || 0; const el = document.getElementById(id); if (!el) return; if (!(cost > 0)) { el.innerHTML = '<small style="color:#94a3b8;">walang puhunan</small>'; return; } const m = marginInfo(cost, price), low = price < minPriceFor(cost); el.innerHTML = `<small style="color:${low ? '#dc2626' : '#059669'};">${m.margin == null ? '' : m.margin.toFixed(0) + '%'} ${low ? '⚠️ mababa sa min ' + money(minPriceFor(cost)) : ''}</small>`; };
  set('pl-wm-' + i, costOf(p, 'Whole'), 'pl-w-' + i, p.wholePrice); set('pl-lm-' + i, costOf(p, 'Loose'), 'pl-l-' + i, p.loosePrice);
}
function plAutoFill(all) {
  const t = parseFloat((document.getElementById('pl-transport') || {}).value) || 0;
  plState.rows.forEach((p, i) => {
    [['Whole', 'pl-w-' + i], ['Loose', 'pl-l-' + i]].forEach(([u, id]) => {
      const el = document.getElementById(id); const c = costOf(p, u);
      if (!el || !(c > 0)) return;
      if (all || el.value === '') el.value = (suggestedPriceFor(c) * (1 + t / 100)).toFixed(2);
    });
    plRowMargin(i);
  });
}
async function plClear() { if (!await uiConfirm('Burahin ang lahat ng custom price sa screen na ito? (Hindi pa ma-save hanggang i-click ang I-save)')) return; plState.rows.forEach((p, i) => { ['pl-w-', 'pl-l-'].forEach(x => { const e = document.getElementById(x + i); if (e) e.value = ''; }); plRowMargin(i); }); }
function plCollect() {
  const prices = Object.assign({}, plCurrentList().prices || {});
  plState.rows.forEach((p, i) => {
    const w = (document.getElementById('pl-w-' + i) || {}).value, l = (document.getElementById('pl-l-' + i) || {}).value;
    const e = {}; if (w !== '' && w != null) e.whole = parseFloat(w) || 0; if (l !== '' && l != null) e.loose = parseFloat(l) || 0;
    if (Object.keys(e).length) prices[p.id] = e; else delete prices[p.id];
  });
  return prices;
}
async function plSave() {
  const prices = plCollect(); const t = parseFloat((document.getElementById('pl-transport') || {}).value) || 0;
  let low = 0; plState.rows.forEach(p => { const o = prices[p.id]; if (!o) return; if (o.whole != null && costOf(p, 'Whole') > 0 && o.whole < minPriceFor(costOf(p, 'Whole'))) low++; if (o.loose != null && costOf(p, 'Loose') > 0 && o.loose < minPriceFor(costOf(p, 'Loose'))) low++; });
  if (low && !await uiConfirm(`⚠️ May ${low} presyo na mas mababa sa minimum (puhunan + overhead). Hindi mababawi ang gastos sa truck. Ituloy pa rin?`)) return;
  const u = getCurrentUser() || {};
  try {
    const data = { company: plState.company, transportPct: t, prices, updatedBy: u.email || '', updatedAt: firebase.firestore.FieldValue.serverTimestamp() };
    await db.collection('price_lists').doc(invSlug(plState.company)).set(data);
    plState.lists[invSlug(plState.company)] = data;
    try { await logSystemAction('PRICE_LIST_SAVED', `${plState.company}: ${Object.keys(prices).length} custom price(s)`); } catch (e) {}
    alert(`✅ Na-save ang price list ng ${plState.company} (${Object.keys(prices).length} custom na presyo).`);
    plRender();
  } catch (e) { alert('Error: ' + e.message); }
}
function plPrint() {
  const pr = plCollect();
  const rows = plState.rows.map(p => { const o = pr[p.id] || {}; const w = o.whole != null ? o.whole : p.wholePrice, l = o.loose != null ? o.loose : p.loosePrice; return `<tr><td>${srchEsc(p.sapCode || p.id)}</td><td>${srchEsc(p.itemName || '')}</td><td class="num">${money(w)} / ${srchEsc(p.wholeUOM || '')}</td><td class="num">${money(l)} / ${srchEsc(p.looseUOM || '')}</td></tr>`; }).join('');
  printHtmlDoc('Price List - ' + plState.company, `<h1>Price List — ${srchEsc(plState.company)}</h1><div class="meta">${printedByLine ? printedByLine() : ''}</div><table><thead><tr><th>Code</th><th>Produkto</th><th class="num">Whole</th><th class="num">Loose</th></tr></thead><tbody>${rows}</tbody></table>`);
}
function plExportCSV() {
  const pr = plCollect();
  const lines = [['Code', 'Item', 'Whole_Price', 'Loose_Price'].join(',')];
  plState.rows.forEach(p => { const o = pr[p.id] || {}; lines.push([csvCell(p.sapCode || p.id), csvCell(p.itemName), o.whole != null ? o.whole : p.wholePrice, o.loose != null ? o.loose : p.loosePrice].join(',')); });
  downloadCSVFile(lines.join('\r\n'), 'PriceList_' + invSlug(plState.company) + '.csv');
}
async function plImportCSV() {
  const txt = await pickCSVFile(); if (!txt) return;
  const objs = csvToObjects(txt); let n = 0;
  objs.forEach(o => {
    const code = o.code || o.sap_code || o.item_code; const p = plState.rows.find(x => (x.sapCode || x.id) === code || x.id === code); if (!p) return;
    const i = plState.rows.indexOf(p);
    const w = document.getElementById('pl-w-' + i), l = document.getElementById('pl-l-' + i);
    if (w && o.whole_price !== undefined && o.whole_price !== '') { w.value = parseFloat(o.whole_price) || 0; n++; }
    if (l && o.loose_price !== undefined && o.loose_price !== '') { l.value = parseFloat(o.loose_price) || 0; }
    plRowMargin(i);
  });
  alert(`Na-load ang ${n} presyo. I-click ang 💾 I-save para ma-save.`);
}


// ========================================================
// 💱 DAILY PRICE SHEET  (SRP ng araw — commissary head/officer ang nagpe-presyo)
// - Hindi binabago ang SRP kung hindi ini-edit ("susundin ang luma").
// - Ang order ay naka-lock sa presyong nakita nang i-place (nasa order.items).
// - price_history ang tala ng bawat pagbabago ng puhunan at SRP.
// ========================================================
let dpState = { hub: '', rows: [], orig: {} };
function dpRoot() { return document.getElementById('dp-root'); }
async function loadDailyPrices() {
  const root = dpRoot(); if (!root || !db) return;
  root.innerHTML = '<div class="card">Kinukuha ang mga produkto...</div>';
  try {
    const [pSnap] = await Promise.all([db.collection('products').get(), loadProductCosts()]);
    dpState.all = []; pSnap.forEach(d => dpState.all.push({ id: d.id, ...d.data() }));
    dpState.all.sort((a, b) => (a.itemName || '').localeCompare(b.itemName || ''));
    const u = getCurrentUser() || {};
    dpState.isAdmin = normalizeRole(u.role) === 'admin';
    if (!dpState.isAdmin) dpState.hub = myHubName();
    dpRender();
  } catch (e) { root.innerHTML = `<div class="card" style="color:#dc2626;">Error: ${srchEsc(e.message)}</div>`; }
}
function dpHubs() { const set = new Set(); (dpState.all || []).forEach(p => { if (p.commissarySource) set.add(p.commissarySource); }); return [...set]; }
function dpDaysOld(p) { const t = p.priceUpdatedAt; if (!t) return null; const d = t.toDate ? t.toDate() : (t.seconds ? new Date(t.seconds * 1000) : new Date(t)); return Math.floor((Date.now() - d.getTime()) / 86400000); }
function dpRender() {
  const root = dpRoot(); if (!root) return;
  const q = (document.getElementById('dp-search') || {}).value || '';
  const rows = (dpState.all || []).filter(p => productVisibleToHub(p, dpState.hub) && (!q || smartMatch(q, (p.itemName || '') + ' ' + (p.sapCode || p.id))));
  dpState.rows = rows; dpState.orig = {};
  const hubSel = dpState.isAdmin ? `<div><label style="font-weight:700;">Commissary / Hub</label><br><select id="dp-hub" onchange="dpState.hub=this.value;dpRender()"><option value="">(Lahat)</option>${dpHubs().map(h => `<option ${h === dpState.hub ? 'selected' : ''}>${srchEsc(h)}</option>`).join('')}</select></div>` : `<div><b>🏭 ${srchEsc(dpState.hub || 'Commissary')}</b></div>`;
  let body = '';
  rows.forEach((p, i) => {
    const c = productCosts[p.id] || {};
    dpState.orig[p.id] = { cw: parseFloat(c.costWhole) || 0, cl: parseFloat(c.costLoose) || 0, pw: parseFloat(p.wholePrice) || 0, pl: parseFloat(p.loosePrice) || 0 };
    const age = dpDaysOld(p);
    const ageTxt = age == null ? '<small style="color:#94a3b8;">hindi pa napepresyuhan</small>' : `<small style="color:${age >= 3 ? '#dc2626' : '#64748b'};">${age === 0 ? 'ngayon' : age + ' araw na'}${age >= 3 ? ' ⚠️' : ''}</small>`;
    body += `<tr><td><b>${srchEsc(p.itemName || '')}</b><br><small style="font-family:monospace;color:#64748b;">${srchEsc(p.sapCode || p.id)}</small></td>
      <td>${ageTxt}</td>
      <td><input type="number" step="0.01" min="0" id="dp-cw-${i}" value="${dpState.orig[p.id].cw || ''}" style="width:90px" oninput="dpCostInput(${i})"> <small>/${srchEsc(p.wholeUOM || 'Whole')}</small><br>
          <input type="number" step="0.0001" min="0" id="dp-cl-${i}" value="${dpState.orig[p.id].cl || ''}" style="width:90px" oninput="dpMargin(${i})"> <small>/${srchEsc(p.looseUOM || 'Loose')}</small></td>
      <td><input type="number" step="0.01" min="0" id="dp-pw-${i}" value="${dpState.orig[p.id].pw}" style="width:90px" oninput="dpMargin(${i})"><br>
          <input type="number" step="0.01" min="0" id="dp-pl-${i}" value="${dpState.orig[p.id].pl}" style="width:90px" oninput="dpMargin(${i})"></td>
      <td id="dp-m-${i}"></td><td><button class="btn btn-sm btn-secondary" onclick="dpHistory('${p.id}')">🕘</button></td></tr>`;
  });
  root.innerHTML = `<div class="card"><div class="card-title"><span>💱 Daily Price Sheet — Presyo ng Araw</span></div>
    <p style="font-size:.85rem;color:#64748b;">I-update ang <b>puhunan</b> (galing supplier/Baguio) at ang <b>SRP</b> (presyong ibebenta). Kapag hindi mo binago ang SRP, susundin pa rin ang dating SRP. Ang mga order na na-place na ay hindi magbabago ng presyo. Ang puhunan ay hindi nakikita ng branch/customer.</p>
    <div style="display:flex;gap:.5rem;flex-wrap:wrap;align-items:end;margin-bottom:.6rem;">${hubSel}
      <div><label style="font-weight:700;">Dagdag para sa gas / biyahe %</label><br><input type="number" id="dp-extra" value="0" step="0.1" min="0" style="width:100px;"></div>
      <button class="btn btn-secondary btn-sm" onclick="dpAuto()">⚡ I-compute ang SRP mula sa puhunan (kung binago ang puhunan)</button>
      <button class="btn btn-secondary btn-sm" onclick="dpPrintList()">🖨️ Print Presyo Ngayon</button>
      <button class="btn btn-success" onclick="dpSave()">💾 I-save ang presyo ngayon</button></div>
    <small style="color:#64748b;">Formula: puhunan × (1 + overhead ${pricingRules.overheadPct}%) × (1 + tubo ${pricingRules.markupPct}%) × (1 + dagdag %).</small>
    <input type="text" id="dp-search" placeholder="🔎 Hanapin ang produkto..." oninput="dpRender()" value="${srchEsc(q)}" style="margin:.6rem 0;width:100%;">
    <div class="table-responsive"><table data-notools="1"><thead><tr><th>Produkto</th><th>Huling presyo</th><th>Puhunan ngayon<br><small>Whole / Loose</small></th><th>SRP<br><small>Whole / Loose</small></th><th>Tubo</th><th></th></tr></thead><tbody>${body || '<tr><td colspan="6">Walang produkto sa hub na ito.</td></tr>'}</tbody></table></div></div>`;
  rows.forEach((p, i) => dpMargin(i));
}
function dpV(id) { const e = document.getElementById(id); return e && e.value !== '' ? parseFloat(e.value) || 0 : 0; }
function dpCostInput(i) {
  const p = dpState.rows[i]; const conv = parseFloat(p.conversionFactor) || 1; const cl = document.getElementById('dp-cl-' + i);
  const cw = dpV('dp-cw-' + i); if (cl && conv > 1 && cw > 0) cl.value = (cw / conv).toFixed(4);
  dpMargin(i);
}
function dpMargin(i) {
  const el = document.getElementById('dp-m-' + i); if (!el) return;
  const cw = dpV('dp-cw-' + i), pw = dpV('dp-pw-' + i);
  if (!(cw > 0)) { el.innerHTML = '<small style="color:#94a3b8;">walang puhunan</small>'; return; }
  const m = marginInfo(cw, pw), low = pw < minPriceFor(cw);
  el.innerHTML = `<b style="color:${m.profit < 0 ? '#dc2626' : '#059669'}">${money(m.profit)}</b><br><small style="color:${low ? '#dc2626' : '#64748b'}">${m.margin == null ? '' : m.margin.toFixed(0) + '%'}${low ? ' ⚠️ mababa sa min ' + money(minPriceFor(cw)) : ''}</small>`;
}
function dpAuto() {
  const ex = parseFloat((document.getElementById('dp-extra') || {}).value) || 0;
  dpState.rows.forEach((p, i) => {
    const o = dpState.orig[p.id], cw = dpV('dp-cw-' + i), cl = dpV('dp-cl-' + i);
    if (cw > 0 && cw !== o.cw) document.getElementById('dp-pw-' + i).value = (suggestedPriceFor(cw) * (1 + ex / 100)).toFixed(2);
    if (cl > 0 && cl !== o.cl) document.getElementById('dp-pl-' + i).value = (suggestedPriceFor(cl) * (1 + ex / 100)).toFixed(2);
    dpMargin(i);
  });
}
async function dpSave() {
  const changes = [];
  dpState.rows.forEach((p, i) => {
    const o = dpState.orig[p.id], n = { cw: dpV('dp-cw-' + i), cl: dpV('dp-cl-' + i), pw: dpV('dp-pw-' + i), pl: dpV('dp-pl-' + i) };
    if (n.cw !== o.cw || n.cl !== o.cl || n.pw !== o.pw || n.pl !== o.pl) changes.push({ p, o, n });
  });
  if (!changes.length) { alert('Walang binago.'); return; }
  const low = changes.filter(c => c.n.cw > 0 && c.n.pw < minPriceFor(c.n.cw)).length;
  if (!await uiConfirm(`I-save ang ${changes.length} binagong presyo?${low ? `\n\n⚠️ ${low} ang mas mababa sa puhunan + overhead.` : ''}\n\nMagagamit na ito sa mga susunod na order. Hindi magbabago ang mga order na na-place na.`)) return;
  const u = getCurrentUser() || {}; const by = u.name || u.email || ''; const day = new Date().toISOString().slice(0, 10);
  try {
    const batch = db.batch(); const ts = firebase.firestore.FieldValue.serverTimestamp();
    changes.forEach(({ p, o, n }) => {
      batch.update(db.collection('products').doc(p.id), { wholePrice: n.pw, loosePrice: n.pl, priceUpdatedAt: ts, priceUpdatedBy: by });
      batch.set(db.collection('product_costs').doc(p.id), { costWhole: n.cw, costLoose: n.cl, updatedBy: u.email || '', updatedAt: ts }, { merge: true });
      batch.set(db.collection('price_history').doc(), { code: p.id, itemName: p.itemName || '', hub: p.commissarySource || dpState.hub || '', date: day, costWhole: n.cw, costLoose: n.cl, wholePrice: n.pw, loosePrice: n.pl, prevWholePrice: o.pw, prevLoosePrice: o.pl, prevCostWhole: o.cw, by, at: ts });
    });
    await batch.commit();
    changes.forEach(({ p, n }) => { p.wholePrice = n.pw; p.loosePrice = n.pl; p.priceUpdatedAt = { seconds: Math.floor(Date.now() / 1000) }; productCosts[p.id] = Object.assign({}, productCosts[p.id], { costWhole: n.cw, costLoose: n.cl }); });
    try { await logSystemAction('DAILY_PRICE_UPDATE', `${changes.length} presyo ang binago (${dpState.hub || 'lahat'})`); } catch (e) {}
    alert(`✅ Na-save ang ${changes.length} presyo para sa ${day}.`);
    dpRender();
  } catch (e) { alert('Error: ' + e.message); }
}
async function dpHistory(code) {
  const snap = await db.collection('price_history').where('code', '==', code).get();
  const rows = []; snap.forEach(d => rows.push(d.data()));
  rows.sort((a, b) => ((b.at && b.at.seconds) || 0) - ((a.at && a.at.seconds) || 0));
  const html = rows.slice(0, 30).map(r => `<tr><td>${srchEsc(r.date || '')}</td><td>${money(r.costWhole)}</td><td>${money(r.prevWholePrice)} → <b>${money(r.wholePrice)}</b></td><td>${money(r.loosePrice)}</td><td>${srchEsc(r.by || '')}</td></tr>`).join('') || '<tr><td colspan="5">Wala pang history.</td></tr>';
  arModal(`<h3>🕘 Price History — ${srchEsc((rows[0] && rows[0].itemName) || code)}</h3><div class="table-responsive"><table data-notools="1"><thead><tr><th>Petsa</th><th>Puhunan (W)</th><th>SRP Whole</th><th>SRP Loose</th><th>Nag-update</th></tr></thead><tbody>${html}</tbody></table></div>`);
}
function dpPrintList() {
  const rows = dpState.rows.map((p, i) => `<tr><td>${srchEsc(p.sapCode || p.id)}</td><td>${srchEsc(p.itemName || '')}</td><td class="num">${money(dpV('dp-pw-' + i))} / ${srchEsc(p.wholeUOM || '')}</td><td class="num">${money(dpV('dp-pl-' + i))} / ${srchEsc(p.looseUOM || '')}</td></tr>`).join('');
  printHtmlDoc('Presyo ngayon', `<h1>Presyo ng Araw — ${srchEsc(dpState.hub || 'Commissary')}</h1><div class="meta">${new Date().toLocaleDateString('en-PH')} · ${printedByLine()}</div><table><thead><tr><th>Code</th><th>Produkto</th><th class="num">Whole</th><th class="num">Loose</th></tr></thead><tbody>${rows}</tbody></table>`);
}

// ========================================================
// 📒 AR LEDGER — bayad ng customers/branches (Unpaid / Partial / Paid)
// ar_accounts/{orderId}: { orderId, total, paid, status, payments:[{id,date,amount,mode,ref,notes,by,at,photoId,voided}] }
// ar_payment_photos/{photoId}: { dataUrl }
// ========================================================
const AR_MODES = ['Cash', 'GCash', 'Maya', 'Bank Transfer', 'Check', 'Inter-company Transfer', 'Others'];
let arState = { orders: [], accts: {}, tab: 'all', q: '', from: '', to: '', customer: '', company: '' };
function arModal(html) {
  let m = document.getElementById('ar-modal');
  if (!m) { m = document.createElement('div'); m.id = 'ar-modal'; m.className = 'modal-overlay'; document.body.appendChild(m); }
  m.style.display = 'flex';
  m.innerHTML = `<div class="modal-content" style="max-width:760px;width:96%;max-height:90vh;overflow:auto;padding:1.2rem;background:#fff;border-radius:.6rem;">${html}<div style="text-align:right;margin-top:.8rem;"><button class="btn btn-secondary" onclick="arCloseModal()">Isara</button></div></div>`;
  try { if (typeof arAfterRender === 'function') arAfterRender(); } catch (e) {}
}
function arCloseModal() { const m = document.getElementById('ar-modal'); if (m) m.style.display = 'none'; }
function arRoot() { return document.getElementById('ar-root'); }
function arCustomer(o) { return o.customerName || o.branchName || '—'; }
function arOrderTotal(o) { return parseFloat(o.totalAmount) || 0; }
function arPaid(a) { return ((a && a.payments) || []).reduce((s, p) => s + (p.voided ? 0 : (parseFloat(p.amount) || 0)), 0); }
function arStatusOf(total, paid) { return paid >= total - 0.005 && total > 0 ? 'Paid' : (paid > 0.005 ? 'Partial' : 'Unpaid'); }
function arIncluded(o) { const st = o.status || ''; if (o.isAgentOrder && !/^Cancel|Rejected|Cancellation Requested/.test(st)) return true; return !/^Cancel|Rejected|Pending Admin|^Pending Preparation$|Cancellation Requested/.test(st); }
async function loadArLedger() {
  const root = arRoot(); if (!root || !db) return;
  root.innerHTML = '<div class="card">Kinukuha ang ledger...</div>';
  try {
    const [oSnap, aSnap, pSnap, lSnap, cSnap] = await Promise.all([db.collection('orders').orderBy('createdAt', 'desc').limit(500).get(), db.collection('ar_accounts').get(), db.collection('products').get(), db.collection('ar_legacy').get(), db.collection('customers').get()]);
    arState.customers = []; cSnap.forEach(d => arState.customers.push({ id: d.id, ...d.data() }));
    arState.subs = []; try { (await db.collection('payment_submissions').get()).forEach(d => arState.subs.push({ id: d.id, ...d.data() })); } catch (e) {}
    const hubOf = {}; pSnap.forEach(d => { hubOf[d.id] = d.data().commissarySource || ''; });
    const u = getCurrentUser() || {}; const admin = normalizeRole(u.role) === 'admin'; const myHub = admin ? '' : myHubName();
    arState.orders = []; oSnap.forEach(d => {
      const o = { id: d.id, ...d.data() }; if (!arIncluded(o)) return;
      const hubs = new Set((o.items || []).map(i => hubOf[i.itemCode] || '').filter(Boolean));
      if (myHub && hubs.size && ![...hubs].some(h => hubKey(h) === hubKey(myHub))) return;
      o._hubs = [...hubs]; arState.orders.push(o);
    });
    lSnap.forEach(d => {
      const l = d.data(); if (myHub && l.hub && hubKey(l.hub) !== hubKey(myHub)) return;
      arState.orders.push({ id: d.id, orderId: d.id, siNumber: l.invoiceNo, customerName: l.customerName, customerId: l.customerId || '', totalAmount: l.total, targetDeliveryDate: l.date, dueDate: l.dueDate || '', status: 'Legacy', branchName: '', _legacy: true, _hubs: l.hub ? [l.hub] : [], company: l.company || l.hub || '' });
    });
    arState.accts = {}; aSnap.forEach(d => arState.accts[d.id] = d.data());
    arRender();
  } catch (e) { root.innerHTML = `<div class="card" style="color:#dc2626;">Error: ${srchEsc(e.message)}</div>`; }
}
// Company ng benta (nagbebenta/nag-iinvoice): order.company, o kaya ang commissary hub ng mga item, o ang company ng branch
function arCompanyOf(o) { return String(o.company || o.companyName || (o._hubs && o._hubs[0]) || (typeof compForBranch === 'function' ? compForBranch(o.branchName || o.branch) : '') || '').trim() || '(Walang company)'; }
function arCoOk(o) { const c = arState.company; return !c || hubKey(arCompanyOf(o)) === hubKey(c); }
function arCompanies() { return [...new Set(arState.orders.map(arCompanyOf))].sort((a, b) => a.localeCompare(b)); }
function arRowsFiltered() {
  const S = arState;
  return S.orders.map(o => { const a = S.accts[o.id]; const total = arOrderTotal(o), paid = arPaid(a); return { o, a, total, paid, bal: Math.max(0, total - paid), st: arStatusOf(total, paid) }; })
    .filter(r => arCoOk(r.o) && (S.tab === 'all' || (S.tab === 'pending' ? arPendingFor(r.o.id).length > 0 : r.st.toLowerCase() === S.tab)) && (!S.customer || arCustomer(r.o) === S.customer)
      && (!S.q || smartMatch(S.q, arCustomer(r.o) + ' ' + (r.o.siNumber || '') + ' ' + r.o.id))
      && (!S.from || arDate(r.o) >= S.from) && (!S.to || arDate(r.o) <= S.to));
}
function arDate(o) { if (o.targetDeliveryDate) return o.targetDeliveryDate; const t = o.createdAt; const d = t && (t.toDate ? t.toDate() : t.seconds ? new Date(t.seconds * 1000) : new Date(t)); return d ? d.toISOString().slice(0, 10) : ''; }
function arAge(o) { const d = arDate(o); return d ? Math.max(0, Math.floor((Date.now() - new Date(d).getTime()) / 86400000)) : 0; }
function arRender() { const v = arState.view || 'ledger'; if (v === 'customers') return arRenderCustomers(); if (v === 'monthly') return arRenderMonthly(); return arRenderLedger(); }
const AR_HINT = {
  ledger: '💡 <b>Ledger:</b> bawat invoice/PO ng customer. 1) Piliin ang <b>Company</b> sa itaas · 2) Piliin ang customer o mag-search · 3) Sa bawat linya: <b>💵 Bayad</b> = mag-record ng bayad · <b>🔍</b> = tingnan ang mga bayad · <b>🧾</b> = resibo · <b>🔔 I-confirm</b> = may ipinadalang bayad ang customer na kailangang i-verify.',
  customers: '💡 <b>Per Customer:</b> kabuuang utang ng bawat customer at kung gaano na katagal (0–30, 31–60, 61–90, 90+ araw). Pindutin ang <b>🔍</b> para makita ang mga invoice niya. Naka-check ang "May utang lang" — i-uncheck para makita rin ang bayad na.',
  monthly: '💡 <b>Buwanang Report:</b> piliin ang buwan para makita ang benta, nakolekta at natitirang utang sa buwan na iyon. Puwedeng i-print o i-download.'
};
function arViewTabs() {
  const v = arState.view || 'ledger', cos = arCompanies();
  return `<div style="display:flex;gap:.4rem;flex-wrap:wrap;align-items:center;margin-bottom:.4rem;">${[['ledger', '📒 Ledger'], ['customers', '👥 Per Customer (Balance)'], ['monthly', '🗓️ Buwanang Report']].map(([k, l]) => `<button class="btn btn-sm ${v === k ? 'btn-primary' : 'btn-secondary'}" onclick="arState.view='${k}';arRender()">${l}</button>`).join('')}
    <span style="margin-left:auto;display:flex;gap:.4rem;align-items:center;flex-wrap:wrap;"><label style="font-weight:700;font-size:.85rem;">🏢 Company:</label><select id="ar-company" title="Piliin ang company para ang makikita lang ay ang benta at utang ng company na iyon" onchange="arState.company=this.value;arState.customer='';arRender()"><option value="">Lahat ng company</option>${cos.map(c => `<option value="${srchEsc(c)}" ${hubKey(c) === hubKey(arState.company) && arState.company ? 'selected' : ''}>${srchEsc(c)}</option>`).join('')}</select><button class="btn btn-sm btn-secondary" onclick="arGuide()" title="Buong gabay sa lahat ng button at filter dito">❓ Gabay</button></span></div>
  <div style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:.4rem;padding:.45rem .6rem;font-size:.8rem;color:#075985;margin-bottom:.7rem;">${AR_HINT[v] || ''}${arState.company ? `<br>🏢 Naka-filter sa company: <b>${srchEsc(arState.company)}</b> — ang mga total at listahan ay para sa company na ito lang.` : ''}</div>`;
}
function arRenderLedger() {
  const root = arRoot(); if (!root) return; const S = arState;
  const rows = arRowsFiltered();
  const tot = rows.reduce((a, r) => ({ t: a.t + r.total, p: a.p + r.paid, b: a.b + r.bal }), { t: 0, p: 0, b: 0 });
  const customers = [...new Set(S.orders.filter(arCoOk).map(arCustomer))].sort();
  const tabs = ['all', 'unpaid', 'partial', 'paid', 'pending'].map(t => `<button class="btn btn-sm ${S.tab === t ? 'btn-primary' : 'btn-secondary'}" onclick="arState.tab='${t}';arRender()">${{ all: 'Lahat', unpaid: '❌ Unpaid', partial: '🟡 Partial', paid: '✅ Paid', pending: `🔔 Para i-confirm (${(S.subs || []).filter(x => x.status === 'pending').length})` }[t]}</button>`).join(' ');
  const badge = st => `<span class="badge ${st === 'Paid' ? 'badge-branch' : st === 'Partial' ? 'badge-warning' : 'badge-admin'}">${st}</span>`;
  const body = rows.map(r => `<tr><td>${srchEsc(arDate(r.o))}</td><td><b>${srchEsc(r.o.siNumber || '—')}</b><br><small>${srchEsc(r.o.id)}</small></td><td>${srchEsc(arCustomer(r.o))}${r.o.customerName && r.o.branchName ? `<br><small style="color:#64748b;">${srchEsc(r.o.branchName)}</small>` : ''}</td>
    <td class="num">${money(r.total)}</td><td class="num">${money(r.paid)}</td><td class="num"><b style="color:${r.bal > 0 ? '#b91c1c' : '#059669'}">${money(r.bal)}</b>${r.bal > 0 ? `<br><small style="color:#64748b;">${arAge(r.o)} araw</small>` : ''}</td><td>${badge(r.st)}</td>
    <td>${arPendingFor(r.o.id).length ? `<button class="btn btn-sm btn-warning" onclick="arReviewSub('${r.o.id}')">🔔 I-confirm</button> ` : ''}${r.o._legacy ? '' : `<button class="btn btn-sm btn-secondary" onclick="ordReceiptPreview('${r.o.id}')">🧾</button> `}${r.bal > 0 ? `<button class="btn btn-sm btn-success" onclick="arOpenPay('${r.o.id}')">💵 Bayad</button> ` : ''}<button class="btn btn-sm btn-secondary" onclick="arViewPayments('${r.o.id}')">🔍</button></td></tr>`).join('') || '<tr><td colspan="8" style="text-align:center;color:#94a3b8;">Walang tugma.</td></tr>';
  root.innerHTML = `<div class="card"><div class="card-title"><span>📒 AR Ledger — Benta at Bayad ng Customers</span><button class="btn btn-secondary btn-sm" onclick="loadArLedger()">🔄 Refresh</button></div>
    ${arViewTabs()}
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:.5rem;margin-bottom:.7rem;">
      <div style="background:#eff6ff;padding:.6rem;border-radius:.4rem;"><small>Total Benta</small><br><b>${money(tot.t)}</b></div>
      <div style="background:#ecfdf5;padding:.6rem;border-radius:.4rem;"><small>Nakolekta</small><br><b>${money(tot.p)}</b></div>
      <div style="background:#fef2f2;padding:.6rem;border-radius:.4rem;"><small>Utang / Unpaid</small><br><b style="color:#b91c1c;">${money(tot.b)}</b></div></div>
    <div style="display:flex;gap:.4rem;flex-wrap:wrap;align-items:end;margin-bottom:.6rem;">${tabs}
      <select onchange="arState.customer=this.value;arRender()"><option value="">Lahat ng customer</option>${customers.map(c => `<option ${c === S.customer ? 'selected' : ''}>${srchEsc(c)}</option>`).join('')}</select>
      <input type="date" value="${S.from}" onchange="arState.from=this.value;arRender()" title="Mula"><input type="date" value="${S.to}" onchange="arState.to=this.value;arRender()" title="Hanggang">
      <input type="text" id="ar-search" value="${srchEsc(S.q)}" placeholder="🔎 Customer / SI / PO..." oninput="arState.q=this.value;arRenderKeepFocus()" style="min-width:180px;">
      <button class="btn btn-secondary btn-sm" onclick="arPrintStatement()">🖨️ Statement</button>
      <button class="btn btn-secondary btn-sm" onclick="arExportSalesCSV()">📤 Sales CSV</button>
      <button class="btn btn-secondary btn-sm" onclick="arExportPaymentsCSV()">📤 Payments CSV</button>
      <button class="btn btn-secondary btn-sm" onclick="arDownloadLegacyTemplate()">📄 Template (lumang AR)</button>
      <button class="btn btn-secondary btn-sm" onclick="arImportLegacy()">📥 Import lumang AR</button></div>
    <div class="table-responsive"><table data-notools="1"><thead><tr><th>Petsa</th><th>SI / PO</th><th>Customer</th><th class="num">Total</th><th class="num">Bayad</th><th class="num">Balance</th><th>Status</th><th></th></tr></thead><tbody>${body}</tbody></table></div></div>`;
}
const AR_TIPS = { loadArLedger: 'I-reload ang pinakabagong benta at bayad mula sa database', arPrintStatement: 'I-print ang Statement of Account ng piniling customer (o lahat) ayon sa kasalukuyang filter', arExportSalesCSV: 'I-download ang listahan ng benta/invoice bilang CSV (para sa Excel)', arExportPaymentsCSV: 'I-download ang lahat ng bayad bilang CSV', arDownloadLegacyTemplate: 'I-download ang blangkong template para sa mga lumang utang (bago ang system na ito)', arImportLegacy: 'I-upload ang napunan na template para maipasok ang lumang AR', arReviewSub: 'May bayad na ipinadala ang customer: tingnan ang patunay at i-confirm o i-reject', ordReceiptPreview: 'Tingnan o i-print ang resibo ng order', arOpenPay: 'Mag-record ng bayad (cash, GCash, bank, check…) para sa invoice na ito', arViewPayments: 'Tingnan ang lahat ng bayad sa invoice na ito at ang patunay; puwedeng i-void kung nagkamali', arPrintCustomers: 'I-print ang balance per customer kasama ang aging', arExportCustomersCSV: 'I-download ang balance per customer bilang CSV', arSubmitPay: 'I-save ang bayad. Kailangan ang larawan ng patunay', arVoidPayment: 'I-void ang bayad na mali (nananatili sa talaan bilang voided)', arShowPhoto: 'Tingnan ang larawan ng bayad', arImportConfirm: 'Ituloy ang pag-import ng lumang AR' };
function arAfterRender() {
  const roots = [arRoot(), document.getElementById('ar-modal')]; roots.forEach(r => { if (!r) return;
    r.querySelectorAll('button[onclick],[onclick]').forEach(b => { if (b.title) return; const oc = b.getAttribute('onclick') || '', m = /^\s*([A-Za-z_]\w*)\(/.exec(oc); if (m && AR_TIPS[m[1]]) { b.title = AR_TIPS[m[1]]; return; } const tb = /arState\.tab='(\w+)'/.exec(oc); if (tb) b.title = { all: 'Ipakita ang lahat ng invoice', unpaid: 'Ipakita ang mga wala pang bayad', partial: 'Ipakita ang mga bahagyang bayad lang', paid: 'Ipakita ang mga bayad na', pending: 'Mga bayad na ipinadala ng customer na hinihintay mong i-confirm' }[tb[1]] || ''; const vw = /arState\.view='(\w+)'/.exec(oc); if (vw && !tb) b.title = { ledger: 'Listahan ng bawat invoice at bayad', customers: 'Balance at aging kada customer', monthly: 'Ulat kada buwan' }[vw[1]] || ''; });
    r.querySelectorAll('select,input').forEach(e => { if (e.title) return; if (e.type === 'date' && !e.title) e.title = e.id === 'ar-date' ? 'Petsa ng pagbayad' : 'Petsa'; else if (e.id === 'ar-search') e.title = 'Maghanap ng customer, SI number o PO'; else if (e.tagName === 'SELECT' && /arState\.customer=/.test(e.getAttribute('onchange') || '')) e.title = 'Piliin ang customer para sa kanya lang ipakita'; else if (e.id === 'ar-mode') e.title = 'Paano nagbayad (Cash, GCash, Bank Transfer, Check…)'; else if (e.id === 'ar-amt') e.title = 'Halaga ng binayad (default ang balance)'; else if (e.id === 'ar-ref') e.title = 'OR number, check number o reference ng GCash/bank'; else if (e.id === 'ar-photo') e.title = 'Larawan ng resibo/screenshot bilang patunay'; else if (e.id === 'ar-notes') e.title = 'Dagdag na tala (opsyonal)'; });
  });
}
function arGuide() {
  const row = (b, t) => `<tr><td style="white-space:nowrap;vertical-align:top;padding:.25rem .5rem;"><b>${b}</b></td><td style="padding:.25rem .5rem;font-size:.88rem;">${t}</td></tr>`;
  arModal(`<h3>❓ Gabay sa AR Ledger</h3><p style="font-size:.85rem;color:#475569;">Ang AR (Accounts Receivable) ay ang mga <b>utang ng customers</b> sa atin. Dito mo nakikita ang benta, mga bayad, at kung magkano pa ang hindi nababayaran.</p>
  <h4>Una: Piliin ang Company</h4><table>${row('🏢 Company', 'Nasa kanang itaas. Piliin ang company na tinitingnan mo (hal. ang commissary na nag-invoice). Sa lahat ng tab, ang makikita at ang mga total ay para sa company lang na iyon. Piliin ang "Lahat ng company" para sa kabuuan.')}</table>
  <h4>Mga Tab</h4><table>${row('📒 Ledger', 'Bawat invoice/PO: petsa, customer, total, bayad, balance at status.')}${row('👥 Per Customer', 'Kabuuang balance ng bawat customer at aging (0–30, 31–60, 61–90, 90+ araw). Ginagamit sa paniningil.')}${row('🗓️ Buwanang Report', 'Benta, nakolekta at utang sa isang buwan; mabuting gamitin sa month-end.')}</table>
  <h4>Mga Filter (sa Ledger)</h4><table>${row('Lahat · ❌ Unpaid · 🟡 Partial · ✅ Paid', 'Salain ayon sa kalagayan ng bayad. Unpaid = wala pang bayad, Partial = may bayad pero kulang.')}${row('🔔 Para i-confirm', 'Mga bayad na ipinadala ng customer (may screenshot) na hinihintay mong tingnan. Ang numero ay ang bilang na naghihintay.')}${row('Customer dropdown', 'Piliin ang isang customer para siya lang ang ipakita.')}${row('📅 Mula / Hanggang', 'Saklaw ng petsa ng invoice.')}${row('🔎 Search', 'Mag-type ng pangalan ng customer, SI number o PO.')}</table>
  <h4>Mga Button sa Taas</h4><table>${row('🔄 Refresh', 'Kunin ulit ang pinakabagong datos.')}${row('🖨️ Statement', 'I-print ang Statement of Account para ipadala sa customer (ayon sa napili mong customer at filter).')}${row('📤 Sales CSV / Payments CSV', 'I-download para sa Excel: listahan ng benta o listahan ng bayad.')}${row('📄 Template (lumang AR) at 📥 Import', 'Para sa mga utang bago pa ang system na ito: i-download ang template, punan, saka i-import.')}</table>
  <h4>Mga Button sa Bawat Linya</h4><table>${row('💵 Bayad', 'Mag-record ng bayad. Ilagay ang halaga, petsa, mode (Cash/GCash/Bank/Check), reference at <b>larawan ng patunay (kailangan)</b>. Pwedeng bahagi lang ng balance.')}${row('🔍', 'Tingnan ang lahat ng bayad sa invoice na iyon. Dito rin mo mai-vo-void ang maling bayad.')}${row('🧾', 'Tingnan o i-print ang resibo ng order.')}${row('🔔 I-confirm', 'Lalabas kapag may ipinadala ang customer na bayad. Tingnan ang patunay at i-confirm o i-reject.')}</table>
  <h4>Mga Kulay at Status</h4><table>${row('Berde', 'Bayad na o walang balance.')}${row('Pula', 'May balance (utang). Nakasulat sa ilalim kung ilang araw na.')}</table>
  <h4>Paano gamitin (accounting)</h4><ol style="font-size:.88rem;"><li>Piliin ang <b>Company</b>.</li><li>Buksan ang <b>Per Customer</b> para makita kung sino ang may utang.</li><li>Pindutin ang <b>🔍</b> sa customer para makita ang mga invoice niya.</li><li>Kapag may nagbayad, <b>💵 Bayad</b> sa tamang invoice at ilagay ang patunay.</li><li>Sa dulo ng buwan, <b>Buwanang Report</b> at i-download ang CSV.</li></ol>`);
}
function arRenderKeepFocus() { arRender(); const e = document.getElementById('ar-search'); if (e) { e.focus(); e.setSelectionRange(e.value.length, e.value.length); } }
function arOpenPay(orderId) {
  const o = arState.orders.find(x => x.id === orderId); if (!o) return;
  const total = arOrderTotal(o), paid = arPaid(arState.accts[orderId]), bal = Math.max(0, total - paid);
  arModal(`<h3>💵 Mag-record ng Bayad</h3><p><b>${srchEsc(arCustomer(o))}</b> · SI ${srchEsc(o.siNumber || o.id)}<br>Total ${money(total)} · Bayad na ${money(paid)} · <b style="color:#b91c1c;">Balance ${money(bal)}</b></p>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:.6rem;">
      <div><label>Halaga (₱) <small style="color:#64748b;">(puwedeng bahagi lang ng balance)</small></label><input type="number" id="ar-amt" step="0.01" min="0" value="${bal.toFixed(2)}"></div>
      <div><label>Petsa ng bayad</label><input type="date" id="ar-date" value="${new Date().toISOString().slice(0, 10)}"></div>
      <div><label>Mode of payment <small style="color:#64748b;">(paano nagbayad)</small></label><select id="ar-mode">${AR_MODES.map(m => `<option>${m}</option>`).join('')}</select></div>
      <div><label>Reference / OR / Check No. <small style="color:#64748b;">(GCash ref, check no., OR)</small></label><input type="text" id="ar-ref"></div></div>
    <div style="margin-top:.6rem;"><label>📷 Larawan ng bayad (kailangan) <small style="color:#64748b;">— resibo o screenshot bilang patunay</small></label><input type="file" id="ar-photo" accept="image/*" capture="environment"></div>
    <div style="margin-top:.6rem;"><label>Notes</label><input type="text" id="ar-notes"></div>
    <div style="margin-top:.8rem;"><button class="btn btn-success" onclick="arSubmitPay('${orderId}')">💾 I-save ang bayad</button></div>`);
}
async function arSubmitPay(orderId) {
  const o = arState.orders.find(x => x.id === orderId); if (!o) return;
  const amount = parseFloat((document.getElementById('ar-amt') || {}).value) || 0;
  const file = (document.getElementById('ar-photo') || {}).files && document.getElementById('ar-photo').files[0];
  const mode = (document.getElementById('ar-mode') || {}).value, ref = ((document.getElementById('ar-ref') || {}).value || '').trim();
  const date = (document.getElementById('ar-date') || {}).value, notes = ((document.getElementById('ar-notes') || {}).value || '').trim();
  if (!(amount > 0)) { alert('Maglagay ng halaga.'); return; }
  if (!date) { alert('Maglagay ng petsa ng bayad.'); return; }
  if (!file) { alert('Kailangan ng larawan ng bayad (resibo / screenshot / deposit slip).'); return; }
  let dataUrl; try { dataUrl = await compressImageFile(file, 1100, 0.7); } catch (e) { alert(e.message); return; }
  const u = getCurrentUser() || {}; const by = u.name || u.email || '';
  const pid = 'PAY-' + Date.now().toString().slice(-8) + Math.floor(Math.random() * 90 + 10);
  const ref0 = db.collection('ar_accounts').doc(orderId);
  try {
    await db.runTransaction(async tx => {
      const snap = await tx.get(ref0); const a = snap.exists ? snap.data() : { orderId, payments: [] };
      const total = arOrderTotal(o), paid = arPaid(a);
      if (amount > total - paid + 0.005) throw new Error(`Sobra ang halaga. Balance lang ay ${money(total - paid)}.`);
      const payments = (a.payments || []).concat([{ id: pid, date, amount, mode, ref, notes, by, at: new Date().toISOString(), photoId: pid }]);
      const np = paid + amount;
      tx.set(db.collection('ar_payment_photos').doc(pid), { dataUrl, orderId, createdAt: firebase.firestore.FieldValue.serverTimestamp() });
      tx.set(ref0, { orderId, siNumber: o.siNumber || '', customer: arCustomer(o), total, paid: np, status: arStatusOf(total, np), payments, updatedAt: firebase.firestore.FieldValue.serverTimestamp() });
    });
    try { await logSystemAction('AR_PAYMENT', `${arCustomer(o)} · ${o.siNumber || o.id} · ${money(amount)} · ${mode}`); } catch (e) {}
    await arSyncOrder(orderId);
    arCloseModal(); await loadArLedger();
  } catch (e) { alert('Error: ' + e.message); }
}
function arViewPayments(orderId) {
  const o = arState.orders.find(x => x.id === orderId); if (!o) return; const a = arState.accts[orderId] || { payments: [] };
  const rows = (a.payments || []).map(p => `<tr style="${p.voided ? 'opacity:.5;text-decoration:line-through;' : ''}"><td>${srchEsc(p.date)}</td><td>${money(p.amount)}</td><td>${srchEsc(p.mode)}</td><td>${srchEsc(p.ref || '')}</td><td>${srchEsc(p.by || '')}</td>
    <td><button class="btn btn-sm btn-secondary" onclick="arShowPhoto('${p.photoId}')">📷</button>${p.voided ? ` <small>VOID: ${srchEsc(p.voidReason || '')}</small>` : ` <button class="btn btn-sm btn-danger" onclick="arVoidPayment('${orderId}','${p.id}')">🚫</button>`}</td></tr>`).join('') || '<tr><td colspan="6">Wala pang bayad.</td></tr>';
  const total = arOrderTotal(o), paid = arPaid(a);
  arModal(`<h3>🔍 ${srchEsc(arCustomer(o))} · SI ${srchEsc(o.siNumber || o.id)}</h3><p>Total ${money(total)} · Bayad ${money(paid)} · Balance <b>${money(Math.max(0, total - paid))}</b> · ${arStatusOf(total, paid)}</p><div class="table-responsive"><table data-notools="1"><thead><tr><th>Petsa</th><th>Halaga</th><th>Mode</th><th>Ref</th><th>Tumanggap</th><th></th></tr></thead><tbody>${rows}</tbody></table></div><div id="ar-photo-box" style="margin-top:.6rem;"></div>`);
}
async function arShowPhoto(pid) {
  const box = document.getElementById('ar-photo-box'); if (!box) return;
  if (!pid) { box.textContent = 'Walang larawan (galing sa import ng lumang AR).'; return; }
  try { const d = await db.collection('ar_payment_photos').doc(pid).get(); box.innerHTML = d.exists ? `<img src="${d.data().dataUrl}" style="max-width:100%;border:1px solid #cbd5e1;border-radius:.4rem;">` : 'Walang larawan.'; } catch (e) { box.textContent = e.message; }
}
async function arVoidPayment(orderId, pid) {
  const reason = await uiPrompt('Dahilan ng pag-void ng bayad na ito:'); if (!reason) return;
  const ref0 = db.collection('ar_accounts').doc(orderId); const o = arState.orders.find(x => x.id === orderId);
  try {
    await db.runTransaction(async tx => {
      const snap = await tx.get(ref0); if (!snap.exists) throw new Error('Walang record.');
      const a = snap.data(); const u = getCurrentUser() || {};
      const payments = (a.payments || []).map(p => p.id === pid ? Object.assign({}, p, { voided: true, voidReason: reason, voidedBy: u.name || u.email || '' }) : p);
      const total = o ? arOrderTotal(o) : (a.total || 0), np = payments.reduce((s, p) => s + (p.voided ? 0 : p.amount), 0);
      tx.update(ref0, { payments, paid: np, status: arStatusOf(total, np) });
    });
    try { await logSystemAction('AR_PAYMENT_VOID', `${orderId} ${pid}: ${reason}`); } catch (e) {}
    await arSyncOrder(orderId);
    arCloseModal(); await loadArLedger();
  } catch (e) { alert('Error: ' + e.message); }
}
function arPrintStatement() {
  const rows = arRowsFiltered(); const cust = arState.customer || 'Lahat ng customer';
  const body = rows.map(r => `<tr><td>${srchEsc(arDate(r.o))}</td><td>${srchEsc(r.o.siNumber || r.o.id)}</td><td>${srchEsc(arCustomer(r.o))}</td><td class="num">${money(r.total)}</td><td class="num">${money(r.paid)}</td><td class="num">${money(r.bal)}</td><td>${r.st}</td></tr>`).join('');
  const t = rows.reduce((a, r) => ({ t: a.t + r.total, p: a.p + r.paid, b: a.b + r.bal }), { t: 0, p: 0, b: 0 });
  printHtmlDoc('Statement of Account', `<h1>Statement of Account</h1><div class="meta">${srchEsc(cust)} · ${printedByLine()}</div><table><thead><tr><th>Petsa</th><th>SI/PO</th><th>Customer</th><th class="num">Total</th><th class="num">Bayad</th><th class="num">Balance</th><th>Status</th></tr></thead><tbody>${body}<tr class="total"><td colspan="3">KABUUAN</td><td class="num">${money(t.t)}</td><td class="num">${money(t.p)}</td><td class="num">${money(t.b)}</td><td></td></tr></tbody></table>`);
}
function arExportSalesCSV() {
  const L = [['Date', 'Invoice_No', 'PO_No', 'Customer', 'Branch', 'Subtotal', 'Discount', 'VAT', 'Total', 'Paid', 'Balance', 'Status'].join(',')];
  arRowsFiltered().forEach(r => L.push([arDate(r.o), csvCell(r.o.siNumber || ''), csvCell(r.o.id), csvCell(arCustomer(r.o)), csvCell(r.o.branchName || ''), (+r.o.subtotalAmount || 0).toFixed(2), (+r.o.discountAmount || 0).toFixed(2), (+r.o.vatAmount || 0).toFixed(2), r.total.toFixed(2), r.paid.toFixed(2), r.bal.toFixed(2), r.st].join(',')));
  downloadCSVFile(L.join('\r\n'), 'AR_Sales.csv');
}
function arExportPaymentsCSV() {
  const L = [['Payment_Date', 'Customer', 'Invoice_No', 'PO_No', 'Amount', 'Mode', 'Reference', 'Received_By', 'Voided'].join(',')];
  arRowsFiltered().forEach(r => ((r.a && r.a.payments) || []).forEach(p => L.push([p.date, csvCell(arCustomer(r.o)), csvCell(r.o.siNumber || ''), csvCell(r.o.id), (+p.amount || 0).toFixed(2), csvCell(p.mode), csvCell(p.ref || ''), csvCell(p.by || ''), p.voided ? 'YES' : ''].join(','))));
  downloadCSVFile(L.join('\r\n'), 'AR_Payments.csv');
}