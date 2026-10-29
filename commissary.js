function triggerBufferChime() {
  try {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(440, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(880, audioCtx.currentTime + 0.3);
    gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.5);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.5);
  } catch (e) {
    console.log('Audio chime simulated');
  }
  alert('⚠️ Low Stock Alert: Babala sa Produksyon! Bumaba na sa Reorder Buffer limit ang Pork Tocino.');
}

function autoDeductDR() {
  const cond = document.getElementById('oil-cond').value;
  if (cond === 'good') {
    alert('Matagumpay na na-cross check ang 2 Tins ng used oil! Awtomatiko itong ibinawas sa total DR billing ng branch.');
  } else {
    alert('Na-tag bilang Spoilage / Contaminated. Hindi ito ibabawas sa utang ng branch at ididiretso sa Mark Out investigation.');
  }
}

function printDeliveryReceiptA4() {
  window.print();
}
