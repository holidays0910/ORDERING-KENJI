// Admin Role, Station, and UOM Management

// 1. User Role Management
async function loadFirestoreUsers() {
  const tbody = document.getElementById('user-approval-table');
  if (!tbody) return;

  if (!db) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: #ef4444;">Hindi ma-access ang Firestore database. Pakisuri ang firebase-config.js.</td></tr>';
    return;
  }

  try {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: #64748b;">Kinukuha ang mga users mula sa Firestore...</td></tr>';
    const snapshot = await db.collection('users').get();

    if (snapshot.empty) {
      tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: #64748b;">Walang nakitang users sa database.</td></tr>';
      return;
    }

    let rowsHtml = '';
    snapshot.forEach(doc => {
      const data = doc.data();
      const email = doc.id;
      const name = data.name || email.split('@')[0];
      const role = (data.role || 'pending').toLowerCase().trim();
      const status = (data.status || 'pending').toLowerCase().trim();
      const branch = data.branch || data.requestedStation || '';

      rowsHtml += `
        <tr id="user-row-${email.replace(/[@.]/g, '_')}">
          <td>
            <b>${name}</b><br>
            <small style="color: #64748b;">${email}</small>
          </td>
          <td>
            <input type="text" id="station-${email.replace(/[@.]/g, '_')}" value="${branch}" placeholder="Hal: Commissary Meat / Branch ATC" style="font-size: 0.85rem; padding: 0.35rem 0.5rem;">
          </td>
          <td>
            <select id="role-${email.replace(/[@.]/g, '_')}" style="font-size: 0.85rem; padding: 0.35rem 0.5rem;">
              <option value="branch" ${role === 'branch' ? 'selected' : ''}>Branch Operations</option>
              <option value="commissary" ${role === 'commissary' ? 'selected' : ''}>Commissary Hub</option>
              <option value="admin" ${role === 'admin' ? 'selected' : ''}>Head Office Admin</option>
              <option value="pending" ${role === 'pending' ? 'selected' : ''}>Pending (No Access)</option>
            </select>
          </td>
          <td>
            <select id="status-${email.replace(/[@.]/g, '_')}" style="font-size: 0.85rem; padding: 0.35rem 0.5rem;">
              <option value="active" ${status === 'active' ? 'selected' : ''}>Active (Papasok)</option>
              <option value="pending" ${status === 'pending' ? 'selected' : ''}>Pending (Bawal)</option>
              <option value="disabled" ${status === 'disabled' ? 'selected' : ''}>Disabled (Blocked)</option>
            </select>
          </td>
          <td>
            <button class="btn btn-sm btn-primary" onclick="saveUserRole('${email}')">💾 I-save</button>
          </td>
        </tr>
      `;
    });

    tbody.innerHTML = rowsHtml;
  } catch (err) {
    console.error('Error loading users:', err);
    tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: #ef4444;">Error sa pag-load: ${err.message}</td></tr>`;
  }
}

async function saveUserRole(email) {
  const safeId = email.replace(/[@.]/g, '_');
  const roleEl = document.getElementById(`role-${safeId}`);
  const statusEl = document.getElementById(`status-${safeId}`);
  const stationEl = document.getElementById(`station-${safeId}`);

  if (!roleEl || !statusEl || !stationEl) return;

  const newRole = roleEl.value;
  const newStatus = statusEl.value;
  const newStation = stationEl.value.trim() || 'Branch';

  if (!db) {
    alert('Walang koneksyon sa database.');
    return;
  }

  try {
    await db.collection('users').doc(email.toLowerCase()).update({
      role: newRole,
      status: newStatus,
      branch: newStation
    });

    alert(`Matagumpay na na-update ang user ${email}!\nRole: ${newRole.toUpperCase()} | Status: ${newStatus.toUpperCase()}`);
  } catch (err) {
    alert('Nabigo ang pag-save ng role: ' + err.message);
  }
}

// 2. Storage Station Category Management
async function loadStorageStations() {
  const tbody = document.getElementById('stations-list-tbody');
  if (!tbody || !db) return;

  try {
    const snap = await db.collection('storage_stations').orderBy('createdAt', 'desc').get();
    if (snap.empty) {
      tbody.innerHTML = '<tr><td colspan="2" style="text-align: center; color: #94a3b8; padding: 1rem;">Wala pang nalikhang stations.</td></tr>';
      return;
    }

    let html = '';
    snap.forEach(doc => {
      const data = doc.data();
      const name = data.name || doc.id;
      html += `
        <tr>
          <td><b>📍 ${name}</b></td>
          <td>
            <button class="btn btn-sm btn-danger" onclick="deleteStorageStation('${doc.id}')">🗑️</button>
          </td>
        </tr>
      `;
    });
    tbody.innerHTML = html;
  } catch (err) {
    console.error('Error loading stations:', err);
  }
}

async function addNewStorageStation() {
  const input = document.getElementById('new-station-label');
  const name = input ? input.value.trim() : '';

  if (!name) {
    alert('Mangyaring ilagay ang pangalan ng station (hal. Station 1 - Cold Storage).');
    return;
  }

  if (!db) return;

  try {
    const safeDocId = name.replace(/[/\\#?]/g, '-');
    await db.collection('storage_stations').doc(safeDocId).set({
      name: name,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    alert(`Naidagdag ang "${name}" bilang Storage Station!`);
    input.value = '';
    loadStorageStations();
  } catch (err) {
    alert('Error sa pagdagdag ng station: ' + err.message);
  }
}

async function deleteStorageStation(docId) {
  if (!confirm('Tanggalin ang station na ito?')) return;
  if (!db) return;

  try {
    await db.collection('storage_stations').doc(docId).delete();
    loadStorageStations();
  } catch (err) {
    alert('Error: ' + err.message);
  }
}

// 3. User-Defined UOM Manager (Whole & Loose)
async function loadUOMs() {
  const tbody = document.getElementById('uom-list-tbody');
  if (!tbody || !db) return;

  try {
    const snap = await db.collection('uom_settings').orderBy('createdAt', 'desc').get();
    if (snap.empty) {
      tbody.innerHTML = '<tr><td colspan="3" style="text-align: center; color: #94a3b8; padding: 1rem;">Wala pang na-set up na UOM. Mag-type sa itaas at mag-add.</td></tr>';
      return;
    }

    let html = '';
    snap.forEach(doc => {
      const data = doc.data();
      const type = data.type || 'whole';
      const name = data.name || doc.id;
      const typeBadge = type === 'whole' 
        ? '<span class="badge badge-admin">📦 Whole Unit</span>'
        : '<span class="badge badge-branch">🥢 Loose Unit</span>';

      html += `
        <tr>
          <td>${typeBadge}</td>
          <td><b>${name}</b></td>
          <td>
            <button class="btn btn-sm btn-danger" onclick="deleteUOM('${doc.id}')">🗑️</button>
          </td>
        </tr>
      `;
    });
    tbody.innerHTML = html;
  } catch (err) {
    console.error('Error loading UOMs:', err);
  }
}

async function addNewUOM() {
  const type = document.getElementById('new-uom-type').value;
  const input = document.getElementById('new-uom-name');
  const name = input ? input.value.trim() : '';

  if (!name) {
    alert('Mangyaring ilagay ang pangalan ng Unit of Measure (hal. Box, Tin, Kg, Pack).');
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

    alert(`Matagumpay na naidagdag ang "${name}" bilang ${type.toUpperCase()} UOM!`);
    input.value = '';
    loadUOMs();
  } catch (err) {
    alert('Error sa pagdagdag ng UOM: ' + err.message);
  }
}

async function deleteUOM(docId) {
  if (!confirm('Tanggalin ang UOM na ito?')) return;
  if (!db) return;

  try {
    await db.collection('uom_settings').doc(docId).delete();
    loadUOMs();
  } catch (err) {
    alert('Error: ' + err.message);
  }
}

function downloadCSVTemplate() {
  const headers = "SAP_Item_Code,Item_Description,Commissary_Hub,Storage_Station,Whole_UOM,Loose_UOM,Whole_Price,Loose_Price,Conversion_Factor,Buffer_Limit\n";
  const sample1 = "SAP-001,Beef Tapa Marinated,Commissary Meat,Station 1 - Cold Storage,Box,Sheets,500,12,50,15\n";
  const sample2 = "SAP-002,Cooking Oil 18L,Commissary Wares,Station 2 - Dry Warehouse,Tin,Liters,1200,75,18,5\n";
  const blob = new Blob([headers + sample1 + sample2], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = "ERP_Product_Master_With_UOM.csv";
  a.click();
}

function processCSVUpload() {
  const input = document.getElementById('csv-file-input');
  if (!input.files.length) {
    alert('Mangyaring pumili muna ng .CSV file.');
    return;
  }
  const file = input.files[0];
  const reader = new FileReader();
  reader.onload = async function(e) {
    const lines = e.target.result.split('\n');
    let addedCount = 0;
    
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      const cols = line.split(',');
      if (cols.length >= 6) {
        const itemCode = cols[0].trim();
        const itemName = cols[1].trim();
        const hub = cols[2].trim();
        const storageStation = cols[3].trim();
        const wholeUOM = cols[4].trim() || 'Box';
        const looseUOM = cols[5].trim() || 'Pcs';
        const wholePrice = parseFloat(cols[6] || 0);
        const loosePrice = parseFloat(cols[7] || 0);
        const conversion = parseInt(cols[8] || 1);
        const bufferLimit = parseInt(cols[9] || 5);

        if (db && itemCode) {
          try {
            await db.collection('products').doc(itemCode).set({
              itemCode: itemCode,
              itemName: itemName,
              commissarySource: hub,
              storageStation: storageStation,
              wholeUOM: wholeUOM,
              looseUOM: looseUOM,
              wholePrice: wholePrice,
              loosePrice: loosePrice,
              conversionFactor: conversion,
              bufferLimit: bufferLimit,
              stockWhole: 0,
              stockLoose: 0,
              updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
            addedCount++;
          } catch (err) {
            console.error('Error adding product:', err);
          }
        }
      }
    }

    alert(`Matagumpay na nai-upload ang mga produkto sa Firestore! (${addedCount} items may kasamang Storage Station at UOM)`);
  };
  reader.readAsText(file);
}

function copyTableToGoogleSheets() {
  const table = document.getElementById('variance-table');
  let tsv = '';
  for (let row of table.rows) {
    let rowData = [];
    for (let cell of row.cells) {
      rowData.push(cell.innerText.replace(/\t|\n/g, ' '));
    }
    tsv += rowData.join('\t') + '\n';
  }
  navigator.clipboard.writeText(tsv).then(() => {
    alert('Na-kopya na ang buong report! Pwede mo na itong i-Paste (Ctrl+V) diretso sa Google Sheets.');
  });
}
