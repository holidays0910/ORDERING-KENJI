// Branch Logic: Canvas & Direct Actions

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

function submitBranchOrder() {
  const item = document.getElementById('order-product-name').value.trim();
  const whole = document.getElementById('order-whole').value;
  const loose = document.getElementById('order-loose').value;
  if (!item) {
    alert('Mangyaring ilagay ang pangalan ng produkto.');
    return;
  }
  alert(`Naipadala ang order (${whole} Whole, ${loose} Loose ng ${item}) sa Commissary!`);
  document.getElementById('order-product-name').value = '';
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
