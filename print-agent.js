#!/usr/bin/env node
/* =====================================================================
   KUSINA POS — PRINT AGENT  (kitchen / station printers by IP)
   Tumatakbo sa isang computer o Raspberry Pi na NASA PARehong LAN ng mga printer ng branch (laging naka-on).
   Kumukuha ng "print job" mula sa Firestore (pos_print_jobs) at ipinapadala sa printer sa IP:port (ESC/POS, karaniwan port 9100).

   SETUP (isang beses):
     1. I-install ang Node.js (v18+).
     2. Sa folder na ito:   npm init -y && npm install firebase-admin
     3. Firebase Console → Project settings → Service accounts → "Generate new private key".
        I-save ang file bilang  serviceAccount.json  katabi ng print-agent.js.  (HUWAG i-share o i-upload sa GitHub!)
     4. Patakbuhin:   node print-agent.js --sites tns1,tky1
        ("--sites" = ang branch key(s) na sinisilbihan ng agent na ito; kapareho ng nasa POS. Kung hindi sigurado, patakbuhin
         nang walang --sites at ipi-print nito ang lahat ng pending job.)
     5. Para laging tumakbo:  npm install -g pm2 && pm2 start print-agent.js -- --sites tns1 && pm2 save && pm2 startup

   Mga limitasyon: ESC/POS lang ang sinusuportahan; ang mga Japanese/ibang non-ASCII na letra ay hindi maipi-print ng karamihan
   ng thermal printer (gagawing '?'), kaya gamitin ang "Pangalan sa kusina" (romaji/English) sa Menu.
   ===================================================================== */
'use strict';
const net = require('net');

const ESC = 0x1b, GS = 0x1d, LF = 0x0a;
const ascii = s => String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[“”]/g, '"').replace(/[‘’]/g, "'").replace(/[–—]/g, '-').replace(/×/g, 'x').replace(/[^\x20-\x7e]/g, '?');
function wrap(s, w) { const out = []; String(s).split('\n').forEach(line => { let cur = ''; line.split(/\s+/).forEach(word => { while (word.length > w) { if (cur) { out.push(cur); cur = ''; } out.push(word.slice(0, w)); word = word.slice(w); } if (!cur) cur = word; else if ((cur + ' ' + word).length <= w) cur += ' ' + word; else { out.push(cur); cur = word; } }); out.push(cur); }); return out; }
function buildTicket(job) {
  const t = job.ticket || {}, cols = job.paper === '58' ? 32 : 48, B = [], put = (...b) => B.push(Buffer.from(b)), txt = s => B.push(Buffer.from(ascii(s) + '\n', 'latin1'));
  const size = (w, h) => put(GS, 0x21, ((w - 1) << 4) | (h - 1)), bold = on => put(ESC, 0x45, on ? 1 : 0), align = n => put(ESC, 0x61, n), line = () => txt('-'.repeat(cols));
  const when = t.at ? new Date(t.at) : new Date(), hh = when.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' }), dd = when.toLocaleDateString('en-PH');
  put(ESC, 0x40); // init
  align(1); size(2, 2); bold(1); wrap(job.stationName || 'KITCHEN', Math.floor(cols / 2)).forEach(txt); bold(0); size(1, 1);
  if (t.reprint) { bold(1); txt('*** REPRINT ***'); bold(0); }
  if (t.type === 'test') { txt('TEST PRINT'); }
  line(); align(0);
  if (t.table) { size(2, 2); bold(1); wrap('TABLE ' + t.table, Math.floor(cols / 2)).forEach(txt); bold(0); size(1, 1); }
  const meta = [t.zone, t.pax ? t.pax + ' pax' : '', t.orderNo ? 'Order #' + t.orderNo : '', t.type === 'counter' && t.ref ? 'Counter ' + t.ref : ''].filter(Boolean).join('  |  '); if (meta) txt(meta);
  txt(dd + ' ' + hh + (t.by ? '  ' + t.by : '')); line();
  (t.items || []).forEach(it => { size(1, 2); bold(1); wrap(it.qty + ' x ' + it.name, cols).forEach(txt); bold(0); size(1, 1); if (it.note) wrap('   ** ' + it.note, cols).forEach(l => { bold(1); txt(l); bold(0); }); });
  line(); align(1); txt(t.type === 'test' ? 'Gumagana ang printer' : (job.siteName || '')); align(0); txt(''); txt(''); txt('');
  put(GS, 0x56, 0x42, 0x00); // feed + partial cut
  const one = Buffer.concat(B), n = Math.max(1, Math.min(5, +job.copies || 1)); return Buffer.concat(Array(n).fill(one));
}
function sendRaw(ip, port, buf, timeout) {
  return new Promise((res, rej) => { const s = new net.Socket(); let done = false; const fin = e => { if (done) return; done = true; try { s.destroy(); } catch (x) {} e ? rej(e) : res(); };
    s.setTimeout(timeout || 6000, () => fin(new Error('Timeout — hindi maabot ang printer ' + ip + ':' + port))); s.on('error', e => fin(new Error(e.code === 'ECONNREFUSED' ? 'Tinanggihan ang koneksyon (' + ip + ':' + port + ')' : e.code === 'EHOSTUNREACH' || e.code === 'ENETUNREACH' ? 'Hindi maabot ang ' + ip : e.message)));
    s.connect(+port || 9100, ip, () => { s.write(buf, err => { if (err) return fin(err); setTimeout(() => fin(null), 400); }); }); });
}
module.exports = { ascii, wrap, buildTicket, sendRaw };

/* ---------------- MAIN ---------------- */
if (require.main === module) {
  const args = process.argv.slice(2), arg = n => { const i = args.indexOf('--' + n); return i >= 0 ? args[i + 1] : ''; };
  const sites = new Set((arg('sites') || '').split(',').map(s => s.trim()).filter(Boolean)), keyFile = arg('key') || './serviceAccount.json', host = require('os').hostname();
  let admin; try { admin = require('firebase-admin'); } catch (e) { console.error('Kulang ang firebase-admin. Patakbuhin: npm install firebase-admin'); process.exit(1); }
  admin.initializeApp({ credential: admin.credential.cert(require(require('path').resolve(keyFile))) }); const db = admin.firestore(), busy = new Set(); const log = (...a) => console.log(new Date().toLocaleTimeString(), ...a);
  async function handle(doc) {
    if (busy.has(doc.id)) return; busy.add(doc.id); try {
      const ref = doc.ref; const claimed = await db.runTransaction(async tx => { const d = await tx.get(ref); const x = d.data(); if (!x || x.status !== 'pending') return null; tx.update(ref, { status: 'printing', claimedAt: Date.now(), agent: host }); return x; }); if (!claimed) return;
      try { await sendRaw(claimed.ip, claimed.port, buildTicket(claimed)); await ref.update({ status: 'printed', printedAt: new Date().toISOString(), error: '' }); log('✅', claimed.stationName, claimed.ip, (claimed.ticket || {}).table || ''); }
      catch (e) { const tries = (claimed.tries || 0) + 1; log('❌', claimed.stationName, claimed.ip, e.message); if (tries < 3) { await ref.update({ status: 'pending', tries, error: e.message }); setTimeout(() => handle({ id: doc.id + ':' + tries, ref }), 8000); busy.delete(doc.id); return; } await ref.update({ status: 'failed', tries, error: e.message }); }
    } finally { setTimeout(() => busy.delete(doc.id), 2000); }
  }
  db.collection('pos_print_jobs').where('status', '==', 'pending').onSnapshot(snap => snap.docChanges().forEach(ch => { if (ch.type === 'removed') return; const d = ch.doc.data(); if (sites.size && !sites.has(d.site)) return; handle(ch.doc); }), e => log('Listener error:', e.message));
  const beat = async () => { const list = sites.size ? [...sites] : null; try { if (list) for (const s of list) await db.collection('pos_print_agents').doc(s).set({ ms: Date.now(), at: new Date().toISOString(), host, version: '1.0' }); else await db.collection('pos_print_agents').doc('_any').set({ ms: Date.now(), host }); } catch (e) { log('heartbeat:', e.message); } };
  const cleanup = async () => { try { const old = Date.now() - 3 * 864e5, s = await db.collection('pos_print_jobs').where('createdMs', '<', old).limit(300).get(); const b = db.batch(); s.forEach(d => b.delete(d.ref)); if (!s.empty) { await b.commit(); log('Nilinis ang', s.size, 'lumang job'); } } catch (e) {} };
  const unstick = async () => { try { const s = await db.collection('pos_print_jobs').where('status', '==', 'printing').get(); s.forEach(d => { const x = d.data(); if (Date.now() - (x.claimedAt || 0) > 60000) d.ref.update({ status: 'pending' }); }); } catch (e) {} };
  beat(); setInterval(beat, 30000); cleanup(); setInterval(cleanup, 3600000); unstick(); setInterval(unstick, 60000);
  log('🖨️ Print Agent tumatakbo' + (sites.size ? ' para sa: ' + [...sites].join(', ') : ' (lahat ng branch)') + ' — Ctrl+C para huminto');
}
