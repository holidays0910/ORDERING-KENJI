// Commissary Hub Logic: Storage Station & UOM Dropdowns
let currentInventory = [];
let availableStations = [];
let availableWholeUOMs = [];
let availableLooseUOMs = [];

// Load user-defined Stations and UOMs into dropdowns
async function loadDropdownOptions() {
  if (!db) return;

  try {
    // 1. Load Stations
    const stationSnap = await db.collection('storage_stations').get();
    availableStations = [];
    stationSnap.forEach(doc => {
      const data = doc.data();
      availableStations.push(data.name || doc.id);
    });

    const modalStation = document.getElementById('new-storage-station');
    if (modalStation) {
      modalStation.innerHTML = '<option value="">-- Pumili ng Nalikhang Station --</option>';
      availableStations.forEach(st => {
        modalStation.innerHTML += `<option value="${st}">📍 ${st}</option>`;
      });
    }

    const filterSelect = document.getElementById('station-filter');
    if (filterSelect) {
      filterSelect.innerHTML = '<option value="all">Lahat ng Storage Stations</option>';
      availableStations.forEach(st => {
        filterSelect.innerHTML += `<option value="${st}">📍 ${st}</option>`;
      });
    }

    // 2. Load UOMs (Whole & Loose)
    const uomSnap = await db.collection('uom_settings').get();
    availableWholeUOMs = [];
    availableLooseUOMs = [];

    uomSnap.forEach(doc => {
      const data = doc.data();
      const type = data.type || 'whole';
      const name = data.name || doc.id;
      if (type === 'whole') availableWholeUOMs.push(name);
      else availableLooseUOMs.push(name);
    });

    // Populate Whole UOM Dropdown
    const wholeSelect = document.getElementById('new-whole-uom');
    if (wholeSelect) {
      wholeSelect.innerHTML = '<option value="">-- Pumili ng Whole UOM --</option>';
      availableWholeUOMs.forEach(uom => {
        wholeSelect.innerHTML += `<option value="${uom}">📦 ${uom}</option>`;
      });
    }

    // Populate Loose UOM Dropdown
    const looseSelect = document.getElementById('new-loose-uom');
    if (looseSelect) {
      looseSelect.innerHTML = '<option value="">-- Pumili ng Loose UOM --</option>';
      availableLooseUOMs.forEach(uom => {
        looseSelect.innerHTML += `<option value="${uom}">🥢 ${uom}</option>`;
      });
    }

  } catch (err) {
    console.error('Error loading dropdown options:', err);
  }
}

async function addStationFromCommissary() {
  const input = document.getElementById('commissary-new-station');
  const name = input ? input.value.trim() : '';

  if (!name) {
    alert('Mangyaring ilagay ang pangalan ng station (hal: Cold Storage 1).');
    return;
  }

  if (!db) return;

  try {
    const safeDocId = name.replace(/[/\\#?]/g, '-');
    await db.collection('storage_stations').doc(safeDocId).set({
      name: name,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    alert(`Naidagdag ang "${name}" bilang Station!`);
    input.value = '';
    loadDropdownOptions();
  } catch (err) {
    alert('Error: ' + err.message);
  }
}

async function addUOMFromCommissary() {
  const type = document.getElementById('commissary-uom-type').value;
  const input = document.getElementById('commissary-new-uom');
  const name = input ? input.value.trim() : '';

  if (!name) {
    alert('Mangyaring ilagay ang pangalan ng UOM (hal: Box, Sack, Kg, Sheets).');
    return;
  }

  if (!db) return;

  try {
    const safeDocId = `${type}_${name.replace(/[/\\#?]/g, '-').toLowerCase()}`;
    await db.collection('uom_settings').doc(safeDocId).set({
      type: type,
      name: name,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    alert(`Naidagdag ang "${name}" bilang ${type.toUpperCase()} UOM! Mababasa na ito sa dropdown.`);
    input.value = '';
    loadDropdownOptions();
  } catch (err) {
    alert('Error: ' + err.message);
  }
}

async function loadCommissaryInventory() {
  const tbody = document.getElementById('inventory-tbody');
  if (!tbody) return;

  if (!db) {
    tbody.innerHTML = '<tr><td colspan="11" style="text-align: center; color: #ef4444;">Hindi ma-access ang Firestore database. Pakisuri ang firebase-config.js.</td></tr>';
    return;
  }

  const u = getCurrentUser();
  const userHub = (u && u.branch) ? u.branch.toLowerCase().trim() : '';

  try {
    tbody.innerHTML = '<tr><td colspan="11" style="text-align: center; color: #64748b;">Kinukuha ang inventory mula sa Firestore...</td></tr>';
    
    const snapshot = await db.collection('products').get();
    if (snapshot.empty) {
      tbody.innerHTML = '<tr><td colspan="11" style="text-align: center; color: #94a3b8; padding: 1.5rem;">Walang nakatalang produkto sa database. I-click ang "➕ Mag-add ng Bagong Produkto" para mag-simula.</td></tr>';
      return;
    }

    currentInventory = [];
    snapshot.forEach(doc => {
      const data = doc.data();
      const prodHub = (data.commissarySource || '').toLowerCase().trim();

      if (u.role === 'admin' || !prodHub || prodHub.includes(userHub) || userHub.includes(prodHub)) {
        currentInventory.push({ id: doc.id, ...data });
      }
    });

    renderInventoryTable(currentInventory);

  } catch (err) {
    console.error('Error loading inventory:', err);
    tbody.innerHTML = `<tr><td colspan="11" style="text-align: center; color: #ef4444;">Error sa pagkuha ng inventory: ${err.message}</td></tr>`;
  }
}

function renderInventoryTable(items) {
  const tbody = document.getElementById('inventory-tbody');
  if (!tbody) return;

  if (items.length === 0) {
    tbody.innerHTML = '<tr><td colspan="11" style="text-align: center; color: #94a3b8; padding: 1.5rem;">Walang produkto para sa napiling Storage Station filter.</td></tr>';
    return;
  }

  let html = '';
  items.forEach(item => {
    const code = item.itemCode || item.id;
    const name = item.itemName || 'Walang Pangalan';
    const station = item.storageStation || 'Unassigned Station';
    const wholeUOM = item.wholeUOM || 'Whole';
    const looseUOM = item.looseUOM || 'Loose';
    const whole = item.stockWhole || 0;
    const loose = item.stockLoose || 0;
    const buffer = item.bufferLimit || 5;
    const wholePrice = parseFloat(item.wholePrice || 0);
    const loosePrice = parseFloat(item.loosePrice || 0);

    const isLow = whole < buffer;
    const statusHtml = isLow
      ? '<span class="badge badge-warning">⚠️ Low Stock (Buffer Alert)</span>'
      : '<span class="badge badge-branch">Normal / Safe</span>';

    html += `
      <tr>
        <td><b>${code}</b></td>
        <td><b>${name}</b></td>
        <td><span class="badge badge-admin">📍 ${station}</span></td>
        <td><span class="badge badge-secondary">📦 ${wholeUOM}</span></td>
        <td><span class="badge badge-secondary">🥢 ${looseUOM}</span></td>
        <td><b style="color: #2563eb;">₱${wholePrice.toFixed(2)}</b></td>
        <td><b style="color: #059669;">₱${loosePrice.toFixed(2)}</b></td>
        <td><b>${whole}</b> ${wholeUOM} & <b>${loose}</b> ${looseUOM}</td>
        <td>${buffer} ${wholeUOM}</td>
        <td>${statusHtml}</td>
        <td>
          <button class="btn btn-sm btn-secondary" onclick="updateStock('${item.id}', 5)">+5 Restock</button>
        </td>
      </tr>
    `;
  });

  tbody.innerHTML = html;
}

function filterInventoryByStation() {
  const sel = document.getElementById('station-filter').value;
  if (sel === 'all') {
    renderInventoryTable(currentInventory);
  } else {
    const filtered = currentInventory.filter(item => {
      const st = item.storageStation || '';
      return st === sel;
    });
    renderInventoryTable(filtered);
  }
}

function showAddProductModal() {
  loadDropdownOptions();
  document.getElementById('add-product-modal').style.display = 'flex';
}

function closeAddProductModal() {
  document.getElementById('add-product-modal').style.display = 'none';
}

async function saveProductWithStationAndUOM() {
  const code = document.getElementById('new-item-code').value.trim();
  const name = document.getElementById('new-item-name').value.trim();
  const station = document.getElementById('new-storage-station').value;
  const wholeUOM = document.getElementById('new-whole-uom').value || 'Box';
  const looseUOM = document.getElementById('new-loose-uom').value || 'Pcs';
  const wholePrice = parseFloat(document.getElementById('new-whole-price').value || 0);
  const loosePrice = parseFloat(document.getElementById('new-loose-price').value || 0);
  const whole = parseInt(document.getElementById('new-stock-whole').value || 0);
  const loose = parseInt(document.getElementById('new-stock-loose').value || 0);
  const conv = parseInt(document.getElementById('new-conversion-factor').value || 1);
  const buffer = parseInt(document.getElementById('new-buffer-limit').value || 5);

  if (!code || !name) {
    alert('Mangyaring ilagay ang Item Code at Pangalan ng Produkto.');
    return;
  }

  if (!station) {
    alert('Mangyaring pumili ng Storage Station.');
    return;
  }

  const u = getCurrentUser();
  const userHub = (u && u.branch) ? u.branch : 'Commissary Hub';

  if (!db) {
    alert('Walang database connection.');
    return;
  }

  try {
    await db.collection('products').doc(code).set({
      itemCode: code,
      itemName: name,
      storageStation: station,
      wholeUOM: wholeUOM,
      looseUOM: looseUOM,
      wholePrice: wholePrice,
      loosePrice: loosePrice,
      conversionFactor: conv,
      commissarySource: userHub,
      stockWhole: whole,
      stockLoose: loose,
      bufferLimit: buffer,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    alert(`Matagumpay na naitala ang ${name}!\nStation: ${station}\nWhole Price: ₱${wholePrice.toFixed(2)} / ${wholeUOM}\nLoose Price: ₱${loosePrice.toFixed(2)} / ${looseUOM}`);
    closeAddProductModal();
    loadCommissaryInventory();
  } catch (err) {
    alert('Hindi nai-save: ' + err.message);
  }
}

async function updateStock(docId, addQty) {
  if (!db) return;
  try {
    await db.collection('products').doc(docId).update({
      stockWhole: firebase.firestore.FieldValue.increment(addQty)
    });
    loadCommissaryInventory();
  } catch (e) {
    console.warn(e);
  }
}

function printDeliveryReceiptA4() {
  window.print();
}
