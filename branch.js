let branchProducts = [];

async function loadBranchProducts() {
  const sel = document.getElementById('branch-product-select');
  if (!sel || !db) return;

  try {
    const snap = await db.collection('products').get();
    branchProducts = [];
    sel.innerHTML = '<option value="">-- Pumili ng Produkto mula sa Database --</option>';

    if (snap.empty) {
      sel.innerHTML = '<option value="">(Walang produkto sa database)</option>';
      return;
    }

    snap.forEach(doc => {
      const data = doc.data();
      branchProducts.push({ id: doc.id, ...data });
      sel.innerHTML += `<option value="${doc.id}">${data.itemName || doc.id} (${data.storageStation || 'Unassigned'})</option>`;
    });
  } catch (err) {
    console.error('Error loading branch products:', err);
  }
}

function onProductSelectChange() {
  const sel = document.getElementById('branch-product-select');
  const selectedId = sel.value;
  const banner = document.getElementById('product-meta-banner');
  const wholeLabel = document.getElementById('label-whole-units');
  const looseLabel = document.getElementById('label-loose-units');

  if (!selectedId) {
    banner.style.display = 'none';
    wholeLabel.innerText = 'Whole Units';
    looseLabel.innerText = 'Loose Units';
    calculateOrderPrice();
    return;
  }

  const prod = branchProducts.find(p => p.id === selectedId);
  if (prod) {
    const wholeUOM = prod.wholeUOM || 'Whole';
    const looseUOM = prod.looseUOM || 'Loose';
    const wholePrice = parseFloat(prod.wholePrice || 0);
    const loosePrice = parseFloat(prod.loosePrice || 0);
    const station = prod.storageStation || 'Unassigned';

    banner.style.display = 'block';
    document.getElementById('meta-station').innerText = station;
    document.getElementById('meta-whole-uom').innerText = wholeUOM;
    document.getElementById('meta-loose-uom').innerText = looseUOM;
    document.getElementById('meta-whole-price').innerText = '₱' + wholePrice.toFixed(2);
    document.getElementById('meta-loose-price').innerText = '₱' + loosePrice.toFixed(2);

    wholeLabel.innerText = `Whole Units (${wholeUOM}) - ₱${wholePrice.toFixed(2)}`;
    looseLabel.innerText = `Loose Units (${looseUOM}) - ₱${loosePrice.toFixed(2)}`;

    calculateOrderPrice();
  }
}

function calculateOrderPrice() {
  const sel = document.getElementById('branch-product-select');
  const selectedId = sel.value;
  const wholeQty = parseFloat(document.getElementById('order-whole').value || 0);
  const looseQty = parseFloat(document.getElementById('order-loose').value || 0);

  const breakdownEl = document.getElementById('calc-breakdown-text');
  const totalEl = document.getElementById('calc-total-price');

  if (!selectedId) {
    if (breakdownEl) breakdownEl.innerText = '0 Whole (₱0.00) + 0 Loose (₱0.00)';
    if (totalEl) totalEl.innerText = '₱0.00';
    return;
  }

  const prod = branchProducts.find(p => p.id === selectedId);
  const wholePrice = prod ? parseFloat(prod.wholePrice || 0) : 0;
  const loosePrice = prod ? parseFloat(prod.loosePrice || 0) : 0;
  const wholeUOM = prod ? prod.wholeUOM || 'Whole' : 'Whole';
  const looseUOM = prod ? prod.looseUOM || 'Loose' : 'Loose';

  const wholeSubtotal = wholeQty * wholePrice;
  const looseSubtotal = looseQty * loosePrice;
  const grandTotal = wholeSubtotal + looseSubtotal;

  if (breakdownEl) {
    breakdownEl.innerText = `${wholeQty} ${wholeUOM} (₱${wholeSubtotal.toFixed(2)}) + ${looseQty} ${looseUOM} (₱${looseSubtotal.toFixed(2)})`;
  }
  if (totalEl) {
    totalEl.innerText = '₱' + grandTotal.toFixed(2);
  }
}

function submitBranchOrder() {
  const sel = document.getElementById('branch-product-select');
  const selectedId = sel.value;
  const whole = parseFloat(document.getElementById('order-whole').value || 0);
  const loose = parseFloat(document.getElementById('order-loose').value || 0);

  if (!selectedId) {
    alert('Mangyaring pumili muna ng produkto mula sa dropdown.');
    return;
  }

  if (whole <= 0 && loose <= 0) {
    alert('Mangyaring maglagay ng bilang para sa Whole o Loose order.');
    return;
  }

  const prod = branchProducts.find(p => p.id === selectedId);
  const wholeUOM = prod ? prod.wholeUOM || 'Whole' : 'Whole';
  const looseUOM = prod ? prod.looseUOM || 'Loose' : 'Loose';
  const wholePrice = prod ? parseFloat(prod.wholePrice || 0) : 0;
  const loosePrice = prod ? parseFloat(prod.loosePrice || 0) : 0;
  const grandTotal = (whole * wholePrice) + (loose * loosePrice);
  const prodName = prod ? prod.itemName : selectedId;

  alert(`Matagumpay na naipadala ang order sa Commissary!\nProdukto: ${prodName}\nDami: ${whole} ${wholeUOM} at ${loose} ${looseUOM}\nKabuuang Halaga ng Order: ₱${grandTotal.toFixed(2)}`);
  document.getElementById('order-whole').value = 0;
  document.getElementById('order-loose').value = 0;
  calculateOrderPrice();
}

// Signature Pad
const canvas = document.getElementById('sig-canvas');
let ctx = null;
let isDrawing = false;

if (canvas) {
  ctx = canvas.getContext('2d');
  function resizeCanvas() {
    canvas.width = canvas.parentElement.clientWidth;
    canvas.height = canvas.parentElement.clientHeight;
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#0f172a';
  }
  window.addEventListener('resize', resizeCanvas);
  resizeCanvas();

  function getCoords(e) {
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return { x: clientX - rect.left, y: clientY - rect.top };
  }

  function startDraw(e) {
    isDrawing = true;
    const pos = getCoords(e);
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
  }

  function draw(e) {
    if (!isDrawing) return;
    const pos = getCoords(e);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
  }

  function stopDraw() { isDrawing = false; }

  canvas.addEventListener('mousedown', startDraw);
  canvas.addEventListener('mousemove', draw);
  canvas.addEventListener('mouseup', stopDraw);
  canvas.addEventListener('mouseleave', stopDraw);

  canvas.addEventListener('touchstart', (e) => { e.preventDefault(); startDraw(e); }, { passive: false });
  canvas.addEventListener('touchmove', (e) => { e.preventDefault(); draw(e); }, { passive: false });
  canvas.addEventListener('touchend', stopDraw);
}

function clearSignature() {
  if (ctx && canvas) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }
}

function saveReceivingProof() {
  const ts = new Date().toLocaleString();
  alert(`Naitala ang e-POD at pirma sa system! Oras: ${ts}`);
}

function submitReturnManifest() {
  const item = document.getElementById('return-item-name').value.trim();
  if (!item) {
    alert('Mangyaring ilagay ang item na ibabalik.');
    return;
  }
  alert('Naitala ang return manifest. Hihintayin ang cross-check inspection sa Commissary.');
  document.getElementById('return-item-name').value = '';
}
