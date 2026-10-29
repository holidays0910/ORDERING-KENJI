function updateUnitCalculator() {
  calculateTotalOrder();
}

function calculateTotalOrder() {
  const sel = document.getElementById('order-product');
  const opt = sel.options[sel.selectedIndex];
  const conv = parseInt(opt.getAttribute('data-conv') || '1');
  const whole = parseInt(document.getElementById('order-whole').value || '0');
  const loose = parseInt(document.getElementById('order-loose').value || '0');
  
  const totalLoose = (whole * conv) + loose;
  document.getElementById('total-units-text').innerText = 
    `${whole} Whole & ${loose} Loose (Kabuuang Equivalent: ${totalLoose} units)`;
}

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
    return {
      x: clientX - rect.left,
      y: clientY - rect.top
    };
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

  function stopDraw() {
    isDrawing = false;
  }

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
  const offlineTimestamp = new Date().toISOString();
  alert(`Matagumpay na naitala ang Electronic Proof of Delivery!\nEksaktong Oras: ${offlineTimestamp}\nNaka-queue sa offline storage para i-sync.`);
}
