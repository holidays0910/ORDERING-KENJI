

// ---------- Recipe Builder: searchable + scannable ingredient picker ----------
let bomSelectedRM = null;
let bomRMResults = [];

function bomProdCodes(p) {
  return [p.itemName, p.sapCode, p.itemCode, p.posCode, p.pos_code, p.barcode, p.barcodeNumber, p.id];
}
function bomFindByCode(code) {
  const c = String(code || '').toUpperCase().trim();
  if (!c) return null;
  return (adminProductsList || []).find(p =>
    [p.barcode, p.barcodeNumber, p.posCode, p.pos_code, p.sapCode, p.itemCode, p.id].some(v => v && String(v).toUpperCase() === c)
  ) || null;
}
function bomUomName(ing) {
  const p = (adminProductsList || []).find(x => x.id === ing.itemCode);
  if (p) return ing.uom === 'Whole' ? (p.wholeUOM || 'Whole') : (p.looseUOM || 'Loose');
  return ing.uomName || ing.uom;
}
function bomResetRMPicker() {
  bomSelectedRM = null;
  const inp = document.getElementById('bom-rm-select');
  const qty = document.getElementById('bom-rm-qty');
  if (inp) inp.value = '';
  if (qty) qty.value = '';
  bomRenderGuide();
}
function bomRenderGuide() {
  const g = document.getElementById('bom-rm-guide');
  const unitEl = document.getElementById('bom-qty-unit');
  const uSel = document.getElementById('bom-rm-uom');
  const p = bomSelectedRM;
  if (!p) {
    if (g) g.innerHTML = '📏 Pumili o mag-scan ng sangkap para makita ang <b>Unit of Measure (UOM)</b> nito.';
    if (unitEl) unitEl.innerText = '--';
    if (uSel) uSel.innerHTML = '<option value="Whole">Whole</option><option value="Loose">Loose</option>';
    return;
  }
  const w = p.wholeUOM || 'Whole', l = p.looseUOM || 'Loose';
  const cf = parseFloat(p.conversionFactor) || 1;
  if (g) g.innerHTML = `📏 <b>${srchEsc(p.itemName)}</b><br>` +
    `Whole = <b>${srchEsc(w)}</b> &nbsp;|&nbsp; Loose = <b>${srchEsc(l)}</b>` +
    (cf > 1 ? `<br>🔁 1 ${srchEsc(w)} = <b>${cf} ${srchEsc(l)}</b>` : '');
  if (uSel) {
    const prev = uSel.value;
    uSel.innerHTML = `<option value="Whole">${srchEsc(w)} (Whole)</option><option value="Loose">${srchEsc(l)} (Loose)</option>`;
    uSel.value = cf > 1 ? 'Loose' : 'Whole';
  }
  bomUomChanged();
}
function bomUomChanged() {
  const p = bomSelectedRM;
  const unitEl = document.getElementById('bom-qty-unit');
  const uSel = document.getElementById('bom-rm-uom');
  if (!unitEl || !uSel) return;
  if (!p) { unitEl.innerText = '--'; return; }
  unitEl.innerText = uSel.value === 'Whole' ? (p.wholeUOM || 'Whole') : (p.looseUOM || 'Loose');
}
function bomSearchRM() {
  const inp = document.getElementById('bom-rm-select');
  if (!inp) return;
  // Kapag nag-type ulit, balewala na ang naunang napili
  if (bomSelectedRM && inp.value !== bomSelectedRM.itemName) { bomSelectedRM = null; bomRenderGuide(); }
  bomRMResults = bomHubProducts()
    .filter(p => smartMatch(inp.value, ...bomProdCodes(p)))
    .sort((a, b) => String(a.itemName).localeCompare(String(b.itemName)))
    .slice(0, 40);
  srchRender('bom-rm-results', bomRMResults, p =>
    `<b>${srchEsc(p.itemName)}</b><br><small style="color:#64748b;">${srchEsc(p.sapCode || p.itemCode || p.id)}${(p.barcode || p.barcodeNumber) ? ' · ' + srchEsc(p.barcode || p.barcodeNumber) : ''} · ${srchEsc(p.wholeUOM || 'Whole')} / ${srchEsc(p.looseUOM || 'Loose')}</small>`,
    'bomPickRM', 'Walang tugmang produkto.');
}
function bomPickRM(i) {
  if (bomRMResults[i]) bomSetSelectedRM(bomRMResults[i]);
}
function bomRMKey(e) {
  if (e.key === 'Enter') {
    const inp = document.getElementById('bom-rm-select');
    const exact = bomFindByCode(inp.value); // para sa USB/keyboard barcode scanner
    if (exact) { e.preventDefault(); bomSetSelectedRM(exact); return; }
  }
  srchKey(e, 'bom-rm-results', bomPickRM);
}
function bomSetSelectedRM(p) {
  bomSelectedRM = p;
  const inp = document.getElementById('bom-rm-select');
  if (inp) inp.value = p.itemName;
  const box = document.getElementById('bom-rm-results');
  if (box) box.style.display = 'none';
  bomRenderGuide();
  const qty = document.getElementById('bom-rm-qty');
  if (qty) { qty.focus(); qty.select(); }
}
function bomHandleScan(code) {
  closeCameraBarcodeScanner();
  const p = bomFindByCode(code);
  if (!p) {
    alert(`⚠️ Walang produktong may barcode/code na "${code}" sa Product Master. Lagyan muna ng barcode ang produkto o hanapin sa search box.`);
    return;
  }
  bomSetSelectedRM(p);
}

function addIngredientToBOM() {
  let prod = bomSelectedRM;
  if (!prod) {
    const inp = document.getElementById('bom-rm-select');
    prod = bomFindByCode(inp ? inp.value : '');
  }
  const qty = parseFloat(document.getElementById('bom-rm-qty').value || 0);
  const uom = document.getElementById('bom-rm-uom').value;

  if (!prod) { alert('Pumili muna ng sangkap mula sa search list o mag-scan ng barcode.'); return; }
  if (!(qty > 0)) { alert('Ilagay ang quantity (dapat mas mataas sa 0).'); return; }

  const uomName = uom === 'Whole' ? (prod.wholeUOM || 'Whole') : (prod.looseUOM || 'Loose');
  const exist = activeIngredients.find(i => i.itemCode === prod.id && i.uom === uom);
  if (exist) {
    exist.qty = Math.round((exist.qty + qty) * 10000) / 10000;
    alert(`ℹ️ Nasa recipe na ang ${prod.itemName}. Idinagdag ang ${qty} ${uomName} sa dati.`);
  } else {
    activeIngredients.push({
      itemCode: prod.id,
      itemName: prod.itemName,
      qty: qty,
      uom: uom,
      uomName: uomName,
      unitPrice: uom === 'Whole' ? (prod.wholePrice||0) : (prod.loosePrice||0)
    });
  }

  bomResetRMPicker();
  renderIngredientsTable();
  const auto = document.getElementById('bom-auto-scan');
  if (auto && auto.checked) openCameraBarcodeScanner('bom_rm');
  else { const inp = document.getElementById('bom-rm-select'); if (inp) inp.focus(); }
}

function removeIngredientFromBOM(idx) {
  activeIngredients.splice(idx, 1);
  renderIngredientsTable();
}

function renderIngredientsTable() {
  const tbody = document.getElementById('bom-ingredients-tbody');
  if (activeIngredients.length === 0) {
    tbody.innerHTML = '<tr><td colspan="3" style="text-align:center; color:#94a3b8;">Walang sangkap.</td></tr>';
    return;
  }
  let html = '';
  activeIngredients.forEach((i, idx) => {
    html += `<tr>
      <td>${i.itemName} <small>(${i.itemCode})</small></td>
      <td style="white-space:nowrap;">
        <input type="number" value="${i.qty}" min="0.01" step="0.01" style="width:90px; padding:0.3rem;" onchange="updateIngredientQty(${idx}, this.value)">
        <select style="padding:0.3rem; width:auto;" onchange="updateIngredientUOM(${idx}, this.value)">
          <option value="Whole" ${i.uom === 'Whole' ? 'selected' : ''}>${srchEsc(bomUomLabelFor(i, 'Whole'))} (Whole)</option>
          <option value="Loose" ${i.uom === 'Loose' ? 'selected' : ''}>${srchEsc(bomUomLabelFor(i, 'Loose'))} (Loose)</option>
        </select>
      </td>
      <td><button class="btn btn-sm btn-danger" onclick="removeIngredientFromBOM(${idx})">✕</button></td>
    </tr>`;
  });
  tbody.innerHTML = html;
}

async function saveRecipeBOM() {
  const fgVal = document.getElementById('bom-finished-good').value.trim();
  const yieldQty = parseFloat(document.getElementById('bom-yield-qty').value || 1);
  const hubVal = (document.getElementById('bom-hub') || {}).value || '';
  const notesVal = ((document.getElementById('bom-notes') || {}).value || '').trim();
  const scopeVal = hubVal ? 'private' : 'shared';
  
  activeIngredients.forEach(i => { i.uomName = bomUomName(i); });
  if (!fgVal) { alert('Mangyaring ilagay ang pangalan ng Finished Good / Recipe.'); return; }
  if (activeIngredients.length === 0) { alert('Magdagdag ng kahit isang raw material na sangkap.'); return; }
  
  // ---------- EDIT MODE: existing recipe, puwedeng palitan ang pangalan, yield at sangkap ----------
  if (editingBomId) {
    const old = bomRecipes.find(b => b.id === editingBomId);
    if (!old) { alert('Hindi nahanap ang recipe.'); return; }
    const newName = fgVal.trim();
    if (!(yieldQty > 0)) { alert('Dapat mas mataas sa 0 ang yield.'); return; }
    try {
      const me = (typeof getCurrentUser === 'function' && getCurrentUser()) || {};
      const who = me.name || me.username || me.email || 'admin';
      const batch = db.batch();
      batch.update(db.collection('bom_recipes').doc(editingBomId), {
        finishedGoodName: newName,
        yieldQty: yieldQty,
        ingredients: activeIngredients,
        hub: hubVal, scope: scopeVal, notes: notesVal,
        revision: (old.revision || 1) + 1,
        lastEditedBy: who,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      // Isang recipe = isang produktong nabebenta, kaya sabay ding napapalitan ang pangalan sa Product Master
      if (newName !== old.finishedGoodName) {
        batch.update(db.collection('products').doc(old.finishedGoodCode), { itemName: newName });
      }
      await batch.commit();
      const changes = [];
      if (newName !== old.finishedGoodName) changes.push(`pangalan: "${old.finishedGoodName}" → "${newName}"`);
      if (yieldQty !== old.yieldQty) changes.push(`yield: ${old.yieldQty} → ${yieldQty}`);
      changes.push('sangkap: ' + old.ingredients.map(i => `${i.qty} ${i.uom} ${i.itemName}`).join(', ') + ' → ' + activeIngredients.map(i => `${i.qty} ${i.uom} ${i.itemName}`).join(', '));
      await logSystemAction('BOM_EDITED', `Na-edit ang recipe ${editingBomId}: ${changes.join(' | ')}`);
      alert(`✅ Na-update ang recipe: ${newName}.\n(Gagamitin na ang bagong timpla sa susunod na production. Hindi nababago ang mga nagawa na.)`);
      document.getElementById('recipe-builder-modal').style.display = 'none';
      const _savedId = editingBomId;
      editingBomId = null;
      if (typeof loadAdminProducts === 'function') loadAdminProducts();
      if (typeof loadCommissaryInventory === 'function') loadCommissaryInventory();
      await loadManufacturing();
      viewBomReport(_savedId);
    } catch(e) { alert('Error: ' + e.message); }
    return;
  }

  const match = fgVal.match(/\(([^)]+)\)$/);
  let fgId = match ? match[1] : null;
  let fgName = fgVal;
  
  let fgProd = null;
  
  if (fgId) {
    // Gumamit ng existing product
    fgProd = adminProductsList.find(p => (p.itemCode || p.id) === fgId);
    if (fgProd) fgName = fgProd.itemName;
  }
  
  try {
    // Kung walang nahanap o bagong type lang ng pangalan (ex: "Gyoza Wrapper"), Awtomatikong i-create as NEW PRODUCT!
    if (!fgProd) {
      fgId = 'FG-' + Date.now().toString().slice(-6);
      fgName = fgVal.replace(/\([^)]+\)$/, '').trim(); // Remove any fake parentheses if typed manually
      
      await db.collection('products').doc(fgId).set({
        itemCode: fgId,
        sapCode: fgId,
        itemName: fgName,
        commissarySource: hubVal || 'Commissary Hub',
        scope: scopeVal,
        storageStation: 'Finished Goods (Production)',
        wholeUOM: 'Batches',
        looseUOM: 'Pcs',
        wholePrice: 0, // Admin can edit price later
        loosePrice: 0,
        stockWhole: 0,
        stockLoose: 0,
        bufferLimit: 5,
        conversionFactor: yieldQty, // Set as default conversion
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      
      // Mag-log na may na-create na bagong produkto
      await logSystemAction('PRODUCT_CREATED_VIA_BOM', `Awtomatikong gumawa ng bagong Finished Good product: ${fgName} (${fgId})`);
    }
    
    const bomId = `BOM-${fgId}`;
    
    await db.collection('bom_recipes').doc(bomId).set({
      finishedGoodCode: fgId,
      finishedGoodName: fgName,
      yieldQty: yieldQty,
      ingredients: activeIngredients,
      hub: hubVal, scope: scopeVal, notes: notesVal,
      revision: 1,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    
    alert(`✅ Recipe Saved!\n\nNaitala na ang BOM para sa: ${fgName}.\n(Kung ito ay bagong pangalan, awtomatiko na rin itong naidagdag sa Product Masterlist para ma-order ng mga branch at mamonitor sa inventory!)`);
    document.getElementById('recipe-builder-modal').style.display = 'none';
    
    // Refresh tables
    if (typeof loadAdminProducts === 'function') loadAdminProducts();
    if (typeof loadCommissaryInventory === 'function') loadCommissaryInventory();
    await loadManufacturing();
    viewBomReport(bomId);
  } catch(e) { 
    alert('Error: ' + e.message); 
  }
}

async function deleteBOM(id) {
  if(!await uiConfirm('Burahin ang BOM na ito?')) return;
  await db.collection('bom_recipes').doc(id).delete();
  loadManufacturing();
}

// Work Order Execution
async function openWorkOrderModal() {
  if (bomRecipes.length === 0) await loadManufacturing();
  const input = document.getElementById('wo-bom-select');
  const list = document.getElementById('wo-bom-list');
  if (input) input.value = '';
  if (list) {
    list.innerHTML = '';
    visibleBoms().forEach(b => {
      list.innerHTML += `<option value="${b.finishedGoodName} (${b.id})"></option>`;
    });
  }
  document.getElementById('wo-multiplier').value = 1;
  previewWorkOrder();
  document.getElementById('work-order-modal').style.display = 'flex';
}

function previewWorkOrder() {
  const bomVal = document.getElementById('wo-bom-select')?.value;
  const match = bomVal ? bomVal.match(/\(([^)]+)\)$/) : null;
  const bomId = match ? match[1] : null;
  const multi = parseFloat(document.getElementById('wo-multiplier')?.value || 1);
  const outEl = document.getElementById('wo-projected-yield');
  const rmEl = document.getElementById('wo-projected-rm');
  
  if (!bomId || !bomRecipes) {
    outEl.innerText = '--';
    rmEl.innerHTML = '<li>--</li>';
    return;
  }
  
  const bom = bomRecipes.find(b => b.id === bomId);
  if (!bom) return;
  
  outEl.innerText = `+${bom.yieldQty * multi} units ng ${bom.finishedGoodName}`;
  let rms = '';
  bom.ingredients.forEach(i => {
    rms += `<li><b style="color:#ef4444;">-${i.qty * multi}</b> ${bomUomName(i)} of ${i.itemName}</li>`;
  });
  rmEl.innerHTML = rms;
}

async function executeWorkOrder() {
  const bomVal = document.getElementById('wo-bom-select')?.value;
  const match = bomVal ? bomVal.match(/\(([^)]+)\)$/) : null;
  const bomId = match ? match[1] : null;
  const multi = parseFloat(document.getElementById('wo-multiplier').value || 1);
  if (!bomId || multi <= 0) { alert('Invalid work order config.'); return; }

  const bom = bomRecipes.find(b => b.id === bomId);
  if (!bom) { alert('Hindi nahanap ang recipe.'); return; }

  try {
    // Tingnan muna kung sapat ang Raw Materials
    const ings = bom.ingredients || [];
    const snaps = await Promise.all(ings.map(i => db.collection('products').doc(i.itemCode).get()));
    const short = [];
    ings.forEach((i, idx) => {
      const need = i.qty * multi;
      const d = snaps[idx].exists ? snaps[idx].data() : null;
      const have = d ? parseFloat(i.uom === 'Whole' ? (d.stockWhole || 0) : (d.stockLoose || 0)) : 0;
      if (!d || have < need) short.push(`• ${i.itemName}: meron ${have} ${bomUomName(i)}, kailangan ${need}`);
    });
    const warn = short.length ? `\n\n⚠️ KULANG ANG RAW MATERIALS:\n${short.join('\n')}\n(Magiging negative ang stock nito kapag itinuloy.)` : '';
    if (!await uiConfirm('Execute Work Order? Ito ay agad na magbabawas sa iyong Raw Materials.' + warn)) return;

    const batch = db.batch();
    const woRef = 'WO-' + Date.now().toString().slice(-8);
    const outQty = bom.yieldQty * multi;

    // 1. Add FG
    const fgRef = db.collection('products').doc(bom.finishedGoodCode);
    batch.update(fgRef, { stockWhole: firebase.firestore.FieldValue.increment(outQty) });
    addStockMovementToBatch(batch, bom.finishedGoodCode, bom.finishedGoodName, 'PRODUCTION_OUTPUT', woRef, outQty, 0, 'Recipe ' + bomId + ' x' + multi);

    // 2. Deduct RM
    ings.forEach(i => {
      const rmRef = db.collection('products').doc(i.itemCode);
      const dec = -(i.qty * multi);
      if (i.uom === 'Whole') {
        batch.update(rmRef, { stockWhole: firebase.firestore.FieldValue.increment(dec) });
        addStockMovementToBatch(batch, i.itemCode, i.itemName, 'PRODUCTION_INPUT', woRef, dec, 0, 'Recipe ' + bomId + ' x' + multi);
      } else {
        batch.update(rmRef, { stockLoose: firebase.firestore.FieldValue.increment(dec) });
        addStockMovementToBatch(batch, i.itemCode, i.itemName, 'PRODUCTION_INPUT', woRef, 0, dec, 'Recipe ' + bomId + ' x' + multi);
      }
    });
    
    await batch.commit();
    await logSystemAction('WORK_ORDER_EXECUTED', `${woRef}: Ginawa ang ${outQty} units ng ${bom.finishedGoodName}. Nabawas ang RM.`);
    alert('✅ Work Order Completed! Inventory Updated.');
    document.getElementById('work-order-modal').style.display = 'none';
  } catch(e) { alert('Error: ' + e.message); }
}

// ========================================================
// 📊 RECIPE COSTING (COGS) ENGINE
// ========================================================
async function loadCosting() {
  const tbody = document.getElementById('admin-costing-tbody');
  if (!tbody || !db) return;
  
  if (adminProductsList.length === 0) await loadAdminProducts();
  if (bomRecipes.length === 0) await loadManufacturing();
  
  if (bomRecipes.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: #94a3b8;">Gumawa muna ng BOM / Recipe.</td></tr>';
    return;
  }
  
  let html = '';
  bomRecipes.forEach(bom => {
    const fg = adminProductsList.find(p => p.id === bom.finishedGoodCode);
    const sellPrice = fg ? (parseFloat(fg.wholePrice||0)) : 0;
    
    let cogs = 0;
    bom.ingredients.forEach(ing => {
      // Find latest price in products master
      const rm = adminProductsList.find(p => p.id === ing.itemCode);
      if (rm) {
        const cost = ing.uom === 'Whole' ? parseFloat(rm.wholePrice||0) : parseFloat(rm.loosePrice||0);
        cogs += (cost * ing.qty);
      } else {
        cogs += (ing.unitPrice * ing.qty); // fallback
      }
    });
    
    const cogsPerYield = cogs / (bom.yieldQty || 1);
    const margin = sellPrice > 0 ? ((sellPrice - cogsPerYield) / sellPrice) * 100 : 0;
    
    const badge = margin > 40 ? 'badge-success' : (margin > 20 ? 'badge-warning' : 'badge-danger');
    const msg = margin > 40 ? 'Healthy Margin' : (margin > 20 ? 'Warning: Low Margin' : 'Critical / Lugi');
    
    html += `<tr>
      <td><b>${bom.finishedGoodName}</b><br><small>Yield: ${bom.yieldQty}</small></td>
      <td>₱${sellPrice.toFixed(2)}</td>
      <td><b style="color:#b91c1c;">₱${cogsPerYield.toFixed(2)}</b> / batch</td>
      <td><b style="color:#0f172a;">${margin.toFixed(2)}%</b></td>
      <td><span class="badge ${badge}">${msg}</span></td>
    </tr>`;
  });
  
  tbody.innerHTML = html;
}

// ========================================================
// 📅 LOT TRACING (FEFO) ENGINE
// ========================================================
async function loadLotTracing() {
  const tbody = document.getElementById('admin-lot-tbody');
  if (!tbody || !db) return;
  try {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align: center;">Kinukuha ang Lots...</td></tr>';
    const snap = await db.collection('inventory_lots').orderBy('expiryDate', 'asc').get();
    if (snap.empty) {
      tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: #94a3b8;">Walang naka-tag na Lots.</td></tr>';
      return;
    }
    let html = '';
    const now = new Date();
    snap.forEach(doc => {
      const d = doc.data();
      const exp = new Date(d.expiryDate);
      const diffDays = Math.ceil((exp - now) / (1000 * 60 * 60 * 24));
      
      let badge = 'badge-success';
      let msg = 'Good / Fresh';
      if (diffDays <= 0) { badge = 'badge-danger'; msg = 'EXPIRED!'; }
      else if (diffDays <= 7) { badge = 'badge-danger'; msg = '⚠️ Expires in ' + diffDays + ' days'; }
      else if (diffDays <= 30) { badge = 'badge-warning'; msg = 'Expires in ' + diffDays + ' days'; }
      
      html += `<tr>
        <td><b>${d.lotNumber}</b></td>
        <td>${d.itemName}</td>
        <td>${d.qty}</td>
        <td><b>${d.expiryDate}</b></td>
        <td><span class="badge ${badge}">${msg}</span></td>
      </tr>`;
    });
    tbody.innerHTML = html;
  } catch(e) { console.error(e); }
}

async function openLotModal() {
  if (adminProductsList.length === 0) await loadAdminProducts();
  const sel = document.getElementById('lot-product-select');
  if (sel) {
    sel.innerHTML = '<option value="">-- Piliin ang Item --</option>';
    adminProductsList.forEach(p => {
      sel.innerHTML += `<option value="${p.id}|${p.itemName}">${p.itemName} (${p.itemCode})</option>`;
    });
  }
  document.getElementById('lot-modal').style.display = 'flex';
}

async function saveLotRecord() {
  const pVal = document.getElementById('lot-product-select').value;
  const lotNo = document.getElementById('lot-number').value.trim();
  const qty = document.getElementById('lot-qty').value;
  const exp = document.getElementById('lot-expiry').value;
  
  if (!pVal || !lotNo || !exp) { alert('Kumpletuhin ang detalye ng lot.'); return; }
  
  const [pId, pName] = pVal.split('|');
  
  try {
    await db.collection('inventory_lots').doc(lotNo).set({
      lotNumber: lotNo,
      productId: pId,
      itemName: pName,
      qty: parseFloat(qty),
      expiryDate: exp,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    alert('✅ Lot / Expiry Tag Saved!');
    document.getElementById('lot-modal').style.display = 'none';
    loadLotTracing();
  } catch(e) { alert(e.message); }
}

// ========================================================
// ⚙️ ASSET MAINTENANCE ENGINE
// ========================================================
async function loadAssets() {
  const tbody = document.getElementById('admin-assets-tbody');
  if (!tbody || !db) return;
  try {
    const snap = await db.collection('assets').get();
    if (snap.empty) {
      tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: #94a3b8;">Walang assets.</td></tr>';
      return;
    }
    let html = '';
    const now = new Date();
    snap.forEach(doc => {
      const d = doc.data();
      const mDue = new Date(d.maintenanceDue);
      const diff = Math.ceil((mDue - now) / (1000 * 60 * 60 * 24));
      
      let stat = d.status || 'Operational';
      let statBadge = stat === 'Operational' ? 'badge-success' : 'badge-danger';
      
      let mBadge = diff <= 7 ? `<b style="color:red;">${d.maintenanceDue} (DUE)</b>` : d.maintenanceDue;
      
      html += `<tr>
        <td><b>${d.assetCode}</b></td>
        <td>${d.assetName}</td>
        <td>${d.location}</td>
        <td>${mBadge}</td>
        <td><span class="badge ${statBadge}">${stat}</span></td>
      </tr>`;
    });
    tbody.innerHTML = html;
  } catch(e) { console.error(e); }
}

function openAssetModal() {
  document.getElementById('asset-modal').style.display = 'flex';
}

async function saveAsset() {
  const code = document.getElementById('asset-code').value.trim();
  const name = document.getElementById('asset-name').value.trim();
  const loc = document.getElementById('asset-location').value.trim();
  const due = document.getElementById('asset-maintenance').value;
  const stat = document.getElementById('asset-status').value;
  
  if (!code || !name) { alert('Kumpletuhin ang detalye ng asset.'); return; }
  
  try {
    await db.collection('assets').doc(code).set({
      assetCode: code,
      assetName: name,
      location: loc,
      maintenanceDue: due,
      status: stat
    });
    alert('✅ Asset Saved!');
    document.getElementById('asset-modal').style.display = 'none';
    loadAssets();
  } catch(e) { alert(e.message); }
}

// ========================================================
// 🔁 SUBSCRIPTIONS (software / hosting / domain) — Admin at Super Admin lang
// subscriptions/{id} {name, vendor, cost, cycle, nextDue(YYYY-MM-DD), remindDays, assignees[email], notes, status, lastKey}
// May notification (🔔 + email kung naka-setup) sa mga naka-assign kapag malapit na / due na.
// ========================================================
const SUB_CYCLES = { monthly: ['Buwan-buwan', 1], quarterly: ['Kada 3 buwan', 3], semiannual: ['Kada 6 buwan', 6], yearly: ['Taon-taon', 12], once: ['Isang beses', 0] };
let subState = { list: [], users: [] };
function subIsAdmin() { try { return normalizeRole((getCurrentUser() || {}).role) === 'admin'; } catch (e) { return false; } }
function subToday() { return new Date().toLocaleDateString('en-CA'); }
function subAddMonths(ymd, n) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd || ''); if (!m || !n) return ymd; let y = +m[1], mo = +m[2] - 1 + n, d = +m[3];
  y += Math.floor(mo / 12); mo = ((mo % 12) + 12) % 12; const last = new Date(y, mo + 1, 0).getDate(); d = Math.min(d, last);
  return `${y}-${String(mo + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}
function subDaysTo(ymd) { const a = new Date(subToday() + 'T00:00:00'), b = new Date(ymd + 'T00:00:00'); return Math.round((b - a) / 86400000); }
function subStage(x) {
  if (!x || x.status === 'cancelled' || !x.nextDue) return '';
  const dd = subDaysTo(x.nextDue); if (isNaN(dd)) return '';
  if (dd < 0) return 'overdue'; if (dd === 0) return 'due'; if (dd <= (+x.remindDays || 0)) return 'soon'; return '';
}
async function loadSubs() {
  const host = document.getElementById('subs-root'); if (!host || !db) return;
  if (!subIsAdmin()) { host.innerHTML = '<div class="card" style="color:#dc2626;">Admin at Super Admin lang ang may access dito.</div>'; return; }
  host.innerHTML = '<p style="color:#64748b;">Kinukuha...</p>';
  try {
    const [ss, us] = await Promise.all([db.collection('subscriptions').get(), db.collection('users').get()]);
    subState.list = []; ss.forEach(d => subState.list.push({ id: d.id, ...d.data() }));
    subState.users = []; us.forEach(d => { const x = d.data(); if (String(x.status || '').toLowerCase() === 'active') subState.users.push({ email: d.id, name: x.name || d.id.split('@')[0], role: String(x.role || ''), branch: x.branch || '' }); });
    subState.users.sort((a, b) => (/admin|account|head/i.test(b.role) ? 1 : 0) - (/admin|account|head/i.test(a.role) ? 1 : 0) || a.name.localeCompare(b.name));
    subRender();
  } catch (e) { host.innerHTML = '<div class="card" style="color:#dc2626;">Error: ' + srchEsc(e.message) + '</div>'; }
}
function subRender() {
  const host = document.getElementById('subs-root'); if (!host) return;
  const L = subState.list.slice().sort((a, b) => String(a.nextDue || '9999').localeCompare(String(b.nextDue || '9999')));
  const names = e => { const u = subState.users.find(x => x.email === e); return u ? u.name : e; };
  const badge = x => { const g = subStage(x); const dd = subDaysTo(x.nextDue); if (x.status === 'cancelled') return '<span class="badge" style="background:#e2e8f0;color:#475569;">Cancelled</span>';
    if (g === 'overdue') return `<span class="badge badge-danger">⚠️ Lampas ${-dd} araw</span>`; if (g === 'due') return '<span class="badge badge-danger">📅 Due ngayon</span>'; if (g === 'soon') return `<span class="badge badge-warning">⏰ ${dd} araw na lang</span>`; return '<span class="badge badge-success">OK</span>'; };
  const alertN = L.filter(x => ['overdue', 'due', 'soon'].includes(subStage(x))).length;
  const monthly = L.filter(x => x.status !== 'cancelled').reduce((t, x) => { const c = SUB_CYCLES[x.cycle] || ['', 0]; return t + (c[1] ? (+x.cost || 0) / c[1] : 0); }, 0);
  const rows = L.length ? L.map(x => `<tr>
      <td><b>${srchEsc(x.name)}</b>${x.vendor ? '<br><small style="color:#64748b;">' + srchEsc(x.vendor) + '</small>' : ''}${x.notes ? '<br><small style="color:#94a3b8;">' + srchEsc(x.notes) + '</small>' : ''}</td>
      <td style="text-align:right;">₱${(+x.cost || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}<br><small>${srchEsc((SUB_CYCLES[x.cycle] || [x.cycle || ''])[0])}</small></td>
      <td>${srchEsc(x.nextDue || '—')}<br>${badge(x)}</td>
      <td><small>${(x.assignees || []).map(e => srchEsc(names(e))).join(', ') || '— walang naka-assign —'}</small><br><small style="color:#94a3b8;">Paalala: ${+x.remindDays || 0} araw bago</small></td>
      <td style="white-space:nowrap;">${x.status === 'cancelled' ? '' : `<button class="btn btn-sm btn-success" title="Na-renew / nabayaran na: ilipat ang due date" onclick="subRenew('${x.id}')">✅ Renew</button> `}<button class="btn btn-sm btn-primary" onclick="subEdit('${x.id}')">✏️</button> <button class="btn btn-sm btn-danger" onclick="subDelete('${x.id}')">🗑️</button></td></tr>`).join('')
    : '<tr><td colspan="5" style="text-align:center;color:#94a3b8;padding:1.2rem;">Wala pang subscription. I-click ang ➕ Add.</td></tr>';
  host.innerHTML = `<div class="card"><div class="card-title"><span>🔁 Subscriptions (Software / Hosting / Domain)</span><div style="display:flex;gap:.5rem;"><button class="btn btn-success btn-sm" onclick="subEdit()">➕ Add</button><button class="btn btn-secondary btn-sm" onclick="subCheck(true)">🔔 I-check at Ipadala ang Paalala</button><button class="btn btn-secondary btn-sm" onclick="loadSubs()">🔄</button></div></div>
    <p style="font-size:.85rem;color:#64748b;">Mga software/serbisyong binabayaran taon-taon o buwan-buwan (hal. website hosting tuwing unang linggo ng Marso). Mag-aabiso (🔔${'' } at email kung naka-setup) sa mga naka-assign bago ang due date. Admin at Super Admin lang ang makakapag-add, edit, at delete.</p>
    <div style="display:flex;gap:1rem;flex-wrap:wrap;margin-bottom:.6rem;font-size:.85rem;"><span>Kabuuan: <b>${L.length}</b></span><span style="color:${alertN ? '#dc2626' : '#16a34a'};">Kailangan ng aksyon: <b>${alertN}</b></span><span>Tantiyang gastos/buwan: <b>₱${monthly.toLocaleString('en-PH', { maximumFractionDigits: 0 })}</b></span></div>
    <div class="table-responsive"><table><thead><tr><th>Subscription</th><th style="text-align:right;">Halaga</th><th>Susunod na Due</th><th>Naka-assign</th><th></th></tr></thead><tbody>${rows}</tbody></table></div></div>`;
}
function subEdit(id) {
  if (!subIsAdmin()) { alert('Admin at Super Admin lang.'); return; }
  const x = (id && subState.list.find(v => v.id === id)) || { cycle: 'yearly', remindDays: 14, status: 'active', assignees: [], nextDue: '' };
  const cyc = Object.keys(SUB_CYCLES).map(k => `<option value="${k}" ${x.cycle === k ? 'selected' : ''}>${SUB_CYCLES[k][0]}</option>`).join('');
  const ppl = subState.users.map(u => `<label class="sub-u" style="display:flex;gap:.4rem;align-items:center;font-weight:400;margin:.1rem 0;"><input type="checkbox" class="sub-as" value="${srchEsc(u.email)}" ${(x.assignees || []).includes(u.email) ? 'checked' : ''}> <span>${srchEsc(u.name)} <small style="color:#64748b;">— ${srchEsc(u.role)}${u.branch ? ', ' + srchEsc(u.branch) : ''}</small></span></label>`).join('');
  arModal(`<h3>${id ? '✏️ Edit' : '➕ Bagong'} Subscription</h3><input type="hidden" id="sub-id" value="${id || ''}">
    <div class="form-group"><label>Pangalan (hal. Website Hosting)</label><input type="text" id="sub-name" value="${srchEsc(x.name || '')}"></div>
    <div class="form-group"><label>Provider / Vendor</label><input type="text" id="sub-vendor" value="${srchEsc(x.vendor || '')}" placeholder="Hal: Hostinger"></div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:.6rem;"><div class="form-group"><label>Halaga (₱)</label><input type="number" id="sub-cost" min="0" step="0.01" value="${+x.cost || ''}"></div><div class="form-group"><label>Bayad / Cycle</label><select id="sub-cycle" data-nosearch="1">${cyc}</select></div></div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:.6rem;"><div class="form-group"><label>Susunod na Due Date</label><input type="date" id="sub-due" value="${srchEsc(x.nextDue || '')}"></div><div class="form-group"><label>Ipaalala ilang araw bago</label><input type="number" id="sub-remind" min="0" max="120" value="${+x.remindDays || 0}"></div></div>
    <div class="form-group"><label>Naka-assign (makakatanggap ng paalala)</label><input type="text" placeholder="🔎 hanapin..." oninput="document.querySelectorAll('.sub-u').forEach(l=>l.style.display=l.innerText.toLowerCase().includes(this.value.toLowerCase())?'flex':'none')" style="margin-bottom:.3rem;"><div style="max-height:160px;overflow:auto;border:1px solid #e2e8f0;border-radius:.4rem;padding:.4rem;">${ppl || '<small>Walang active user.</small>'}</div></div>
    <div class="form-group"><label>Status</label><select id="sub-status" data-nosearch="1"><option value="active" ${x.status !== 'cancelled' ? 'selected' : ''}>Active</option><option value="cancelled" ${x.status === 'cancelled' ? 'selected' : ''}>Cancelled / Hindi na ni-renew</option></select></div>
    <div class="form-group"><label>Notes</label><input type="text" id="sub-notes" value="${srchEsc(x.notes || '')}" placeholder="Hal: account sa finance@..., card ending..."></div>
    <button class="btn btn-success" style="width:100%;" onclick="subSave()">💾 I-save</button>`);
}
async function subSave() {
  if (!subIsAdmin()) { alert('Admin at Super Admin lang.'); return; }
  const g = id => (document.getElementById(id) || {}).value || '';
  const name = g('sub-name').trim(), due = g('sub-due'), as = [...document.querySelectorAll('.sub-as:checked')].map(c => c.value);
  if (!name) { alert('Ilagay ang pangalan.'); return; } if (!/^\d{4}-\d{2}-\d{2}$/.test(due)) { alert('Ilagay ang due date.'); return; }
  if (!as.length) { alert('Mag-assign ng kahit isang tao para may makatanggap ng paalala.'); return; }
  const id = g('sub-id'), old = subState.list.find(v => v.id === id) || {};
  const doc = { name, vendor: g('sub-vendor').trim(), cost: Math.max(0, +g('sub-cost') || 0), cycle: g('sub-cycle') || 'yearly', nextDue: due, remindDays: Math.max(0, +g('sub-remind') || 0), assignees: as, status: g('sub-status') || 'active', notes: g('sub-notes').trim(), updatedBy: (getCurrentUser() || {}).email || '', updatedAt: new Date().toISOString() };
  if (old.nextDue !== due) doc.lastKey = '';
  try {
    if (id) await db.collection('subscriptions').doc(id).update(doc); else { doc.createdBy = doc.updatedBy; doc.createdAt = doc.updatedAt; doc.lastKey = ''; await db.collection('subscriptions').add(doc); }
    try { await logSystemAction(id ? 'SUBSCRIPTION_UPDATED' : 'SUBSCRIPTION_ADDED', `${name} — due ${due}, ${as.length} naka-assign`); } catch (e) {}
    arCloseModal(); loadSubs();
  } catch (e) { alert('Hindi na-save: ' + e.message); }
}
async function subRenew(id) {
  const x = subState.list.find(v => v.id === id); if (!x) return; const n = (SUB_CYCLES[x.cycle] || ['', 0])[1];
  if (!n) { if (await uiConfirm(`"${x.name}" ay isang beses lang. Markahan bilang Cancelled/tapos na?`)) { await db.collection('subscriptions').doc(id).update({ status: 'cancelled' }); try { await logSystemAction('SUBSCRIPTION_CLOSED', x.name); } catch (e) {} loadSubs(); } return; }
  let nd = x.nextDue; do { nd = subAddMonths(nd, n); } while (nd <= subToday() && nd < '2100');
  const t = await uiPrompt(`Na-renew ang "${x.name}". Susunod na due date (YYYY-MM-DD):`, nd); if (t === null) return; if (!/^\d{4}-\d{2}-\d{2}$/.test(t.trim())) { alert('Maling format ng petsa.'); return; }
  try { await db.collection('subscriptions').doc(id).update({ nextDue: t.trim(), lastKey: '', lastRenewedAt: new Date().toISOString(), updatedBy: (getCurrentUser() || {}).email || '' }); try { await logSystemAction('SUBSCRIPTION_RENEWED', `${x.name}: ${x.nextDue} → ${t.trim()}`); } catch (e) {} loadSubs(); } catch (e) { alert(e.message); }
}
async function subDelete(id) {
  if (!subIsAdmin()) { alert('Admin at Super Admin lang.'); return; }
  const x = subState.list.find(v => v.id === id); if (!x) return;
  if (!(await uiConfirm(`Burahin ang subscription na "${x.name}"?`))) return;
  try { await db.collection('subscriptions').doc(id).delete(); try { await logSystemAction('SUBSCRIPTION_DELETED', x.name); } catch (e) {} loadSubs(); } catch (e) { alert(e.message); }
}
// Pagpapadala ng paalala: isang beses kada yugto (malapit / due / lampas) bawat due date. Tumatakbo kapag may Admin na nagbukas ng admin page.
async function subCheck(manual) {
  try {
    if (!db || !subIsAdmin()) return;
    const snap = await db.collection('subscriptions').get(); let sent = 0;
    for (const d of snap.docs) {
      const x = { id: d.id, ...d.data() }; const g = subStage(x); if (!g) continue;
      const key = x.nextDue + '|' + g; if (x.lastKey === key) continue;
      const to = (x.assignees || []).filter(Boolean); if (!to.length) continue;
      const dd = subDaysTo(x.nextDue);
      const when = g === 'overdue' ? `LAMPAS NA ng ${-dd} araw` : g === 'due' ? 'DUE NGAYON' : `${dd} araw na lang`;
      await db.collection('subscriptions').doc(d.id).update({ lastKey: key, lastNotifiedAt: new Date().toISOString() });
      await notify(to, `🔁 Subscription: ${x.name} — ${when}`, `${x.name}${x.vendor ? ' (' + x.vendor + ')' : ''} — due ${x.nextDue}${x.cost ? ', ₱' + Number(x.cost).toLocaleString('en-PH') : ''}. Paki-renew/bayaran, at i-click ang ✅ Renew sa Subscriptions pagkatapos.`, { includeSelf: true });
      sent++;
    }
    if (manual) alert(sent ? `🔔 Nagpadala ng ${sent} paalala.` : 'Walang bagong paalala ngayon (naipadala na o wala pang malapit na due).');
  } catch (e) { if (manual) alert('Error: ' + e.message); }
}
window.addEventListener('load', () => { if (/admin\.html/i.test(location.pathname)) setTimeout(() => { try { subCheck(false); } catch (e) {} }, 6000); });