/* =====================================================================
   🚀 GO-LIVE RESET — linisin ang lahat ng test/sample data nang sabay-sabay bago ang totoong gamit.
   Ang SI number (POS at invoice) ay babalik sa 1. HINDI ginagalaw: Users/Logins, Employees, Products, BOM, Vendors,
   Customers, Companies, POS menu/setup, Access Control, Branding at iba pang SETTINGS / master data.
   Admin lang (parehong rules ng Truncate tool). Kailangan ng bagong firestore.rules (may delete para sa Admin sa mga collection na ito).
   ===================================================================== */
const GL_GROUPS = [
  { k: 'pos', t: '🛒 POS — benta, shift, tabs, QR orders, gift cards, reservations, SI counter (babalik sa 1)', cols: ['pos_sales', 'pos_shifts', 'pos_counters', 'pos_tabs', 'pos_qr_orders', 'pos_print_jobs', 'pos_reservations', 'pos_giftcards', 'pos_event_stock'] },
  { k: 'ord', t: '📦 Orders, Requests, PO, Spoilage, Inventory count/movement (at invoice SI counter)', cols: ['orders', 'disputes', 'requests', 'request_counter', 'request_photos', 'vendor_pos', 'spoilage_requests', 'payment_submissions', 'stock_movements', 'inventory_markouts', 'inventory_counts', 'inventory_snapshots', 'inventory_lots', 'inventory_item_requests', 'sap_snapshots', 'sap_snapshot_chunks'], seq: true },
  { k: 'fin', t: '💰 Accounting (ledger), AR legacy, Payroll, Prime cost, LST', cols: ['general_ledger', 'ar_legacy', 'ar_payment_photos', 'payrolls', 'pc_weeks', 'lst_weeks', 'price_history'] },
  { k: 'hr', t: '👥 Attendance logs/requests, Memos, Loans, HR doc files', cols: ['attendance_logs', 'attendance_weeks', 'attendance_requests', 'attendance_photos', 'memos', 'memo_acks', 'memo_views', 'loans', 'hr_doc_files'] },
  { k: 'tk', t: '🎫 Tickets (Kanban) at ticket counter', cols: ['tk_tickets', 'tk_counters'] },
  { k: 'chat', t: '💬 Messenger — lahat ng chat, story, note, tawag, lock', cols: ['chats', 'chat_stories', 'chat_notes', 'chat_friends', 'chat_calls', 'chat_locks', 'chat_pin_req', 'chat_sched', 'chat_restore_req', 'login_devices', 'presence'], noBackup: true },
  { k: 'log', t: '📜 Logs — activity, login history, notifications, backups ng system', cols: ['activity_logs', 'login_history', 'login_attempts', 'notifications', 'email_log', 'sec_errors', 'system_health', 'product_logs', 'db_backups', 'db_backup_chunks'], noBackup: true }
];
const GL_SUBS = { chats: ['messages', 'media'], chat_stories: ['chunks'], chat_calls: ['cand'] };
const glE = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
let GL_BUSY = false;

function glOpen() {
  const u = (typeof getCurrentUser === 'function' && getCurrentUser()) || {};
  if (!u || (typeof normalizeRole === 'function' && normalizeRole(u.role) !== 'admin')) { alert('Admin lang ang puwedeng gumamit nito.'); return; }
  const o = document.createElement('div'); o.id = 'gl-ov'; o.style.cssText = 'position:fixed;inset:0;background:#000a;z-index:10060;display:flex;align-items:flex-start;justify-content:center;padding:3vh 8px;overflow:auto';
  o.innerHTML = `<div style="background:#fff;color:#111;border-radius:12px;padding:1rem;width:min(640px,100%)">
  <h3 style="margin:0 0 .3rem">🚀 Go-Live Reset</h3>
  <div style="font-size:.85rem;color:#7f1d1d;background:#fef2f2;border-radius:8px;padding:.5rem;margin-bottom:.6rem">Buburahin ang <b>lahat ng test/sample data</b> sa mga napili at <b>magre-reset ang SI number sa 1</b>. Hindi ito mababawi (maliban sa backup file). <b>Hindi</b> ginagalaw ang mga user/login, produkto, BOM, vendor, customer, POS menu/setup, access control at settings.</div>
  ${GL_GROUPS.map(g => `<label style="display:block;margin:.35rem 0;font-size:.88rem"><input type="checkbox" class="gl-ck" value="${g.k}" checked> ${glE(g.t)}</label>`).join('')}
  <label style="display:block;margin:.6rem 0;font-size:.88rem"><input type="checkbox" id="gl-bk" checked> ⬇ Mag-download muna ng backup (JSON) ng mga collection na ire-reset (hindi kasama ang Messenger at logs)</label>
  <div style="font-size:.8rem;color:#475569;margin-bottom:.5rem">Sa dulo ay hihingan ka ng kumpirmasyon. Pagkatapos, sa bawat POS terminal/phone ay i-clear ang browser data o mag-Ctrl+F5 para malinis ang lokal na counter.</div>
  <div id="gl-prog" style="font-size:.85rem;white-space:pre-wrap;max-height:180px;overflow:auto;background:#f8fafc;border-radius:6px;padding:.4rem;display:none"></div>
  <div style="text-align:right;margin-top:.6rem"><button class="btn btn-secondary btn-sm" onclick="document.getElementById('gl-ov').remove()">Kanselahin</button> <button class="btn btn-danger btn-sm" id="gl-go" onclick="glRun()" style="font-weight:700">🚀 Simulan ang Reset</button></div></div>`;
  document.body.appendChild(o);
}
function glLog(m) { const p = document.getElementById('gl-prog'); if (!p) return; p.style.display = 'block'; p.textContent += m + '\n'; p.scrollTop = p.scrollHeight; }
async function glDelAll(ref, onDoc) {
  let n = 0;
  for (;;) {
    const sn = await ref.limit(400).get(); if (sn.empty) break;
    if (onDoc) for (const d of sn.docs) await onDoc(d);
    const b = db.batch(); sn.docs.forEach(d => b.delete(d.ref)); await b.commit(); n += sn.size; if (sn.size < 400) break;
  }
  return n;
}
async function glDelCol(name) {
  const subs = GL_SUBS[name] || [];
  return glDelAll(db.collection(name), async d => { for (const s of subs) { await glDelAll(d.ref.collection(s), s === 'media' ? async m => { await glDelAll(m.ref.collection('chunks')); } : null); } });
}
async function glRun() {
  if (GL_BUSY) return; const sel = [...document.querySelectorAll('.gl-ck:checked')].map(x => x.value); if (!sel.length) { alert('Pumili ng kahit isa.'); return; }
  const groups = GL_GROUPS.filter(g => sel.includes(g.k)), u = (typeof getCurrentUser === 'function' && getCurrentUser()) || {};
  if (typeof secNeed4 === 'function' && !(await secNeed4('truncate', 'Go-Live Reset: ' + groups.map(g => g.k).join(', ')))) return;
  const word = await uiPrompt('⚠️ FINAL NA KUMPIRMASYON\nBuburahin ang lahat ng data sa: ' + groups.map(g => g.k.toUpperCase()).join(', ') + ' at magre-reset ang SI number sa 1.\n\nI-type ang eksaktong "GO LIVE" para ituloy:');
  if (word !== 'GO LIVE') { alert('Hindi itinuloy.'); return; }
  GL_BUSY = true; const go = document.getElementById('gl-go'); if (go) go.disabled = true;
  try {
    if (document.getElementById('gl-bk').checked) {
      glLog('⏳ Kinukuha ang backup…'); const dump = { exportedAt: new Date().toISOString(), exportedBy: u.email || '', collections: {} };
      for (const g of groups.filter(x => !x.noBackup)) for (const c of g.cols) { const sn = await db.collection(c).get(); if (!sn.empty) dump.collections[c] = sn.docs.map(d => ({ id: d.id, data: d.data() })); }
      const blob = new Blob([JSON.stringify(dump)], { type: 'application/json' }), a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'BACKUP_GOLIVE_' + new Date().toISOString().slice(0, 10) + '.json'; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
      glLog('✔ Na-download ang backup (' + Object.keys(dump.collections).length + ' collection).');
    }
    let total = 0;
    for (const g of groups) for (const c of g.cols) { try { const n = await glDelCol(c); total += n; glLog((n ? '✔ ' : '· ') + c + ': ' + n + ' nabura'); } catch (e) { glLog('✖ ' + c + ': ' + e.message + ' (tingnan kung na-publish ang bagong firestore.rules)'); } }
    if (groups.some(g => g.seq)) { try { await db.collection('system_settings').doc('invoice_sequence').set({ lastSI: 0 }, { merge: true }); glLog('✔ Invoice SI sequence: balik sa 0 (susunod ay 1)'); } catch (e) { glLog('✖ invoice_sequence: ' + e.message); } }
    if (groups.some(g => g.k === 'pos')) glLog('ℹ POS SI number: babalik sa 1 (o sa "SI Next" na nakalagay sa POS Setup).');
    try { if (typeof logSystemAction === 'function') logSystemAction('GO_LIVE_RESET', 'Go-Live Reset: ' + groups.map(g => g.k).join(', ') + ' (' + total + ' docs)'); } catch (e) {}
    glLog('\n✅ TAPOS. ' + total + ' dokumento ang nabura. Sa bawat POS device: i-clear ang browser data / Ctrl+F5.');
  } catch (e) { glLog('✖ Error: ' + e.message); }
  GL_BUSY = false; if (go) go.disabled = false;
}
