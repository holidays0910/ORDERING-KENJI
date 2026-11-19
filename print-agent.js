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

   BACKUP / FAILOVER: kapag hindi maabot ang printer ng isang station (patay, nabunot ang kuryente/network, nakuha ng ibang device ang IP,
   naubos ang papel, nakabukas ang takip), HINDI ito maghihintay — ililipat ng agent ang ticket sa BACKUP printer ng station, o sa
   default na backup (Cashier printer). May tatak sa ticket kung saan galing. Kung wala talagang available, mamarkahan itong 'failed' at
   lalabas ang babala sa POS (puwedeng i-print sa browser).

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
  if (t.type === 'receipt') { (t.lines || []).forEach(l => { const o = typeof l === 'string' ? { t: l } : l; align(o.c ? 1 : 0); bold(o.b ? 1 : 0); if (o.big) size(2, 2); wrap(o.t === '' ? ' ' : o.t, o.big ? Math.floor(cols / 2) : cols).forEach(x => txt(x === ' ' ? '' : x)); if (o.big) size(1, 1); }); bold(0); align(0); if (t.reroute && t.reroute.length) { txt(''); txt('(Nilipat mula sa: ' + t.reroute.join('; ') + ')'); } txt(''); txt(''); txt(''); put(GS, 0x56, 0x42, 0x00); const r1 = Buffer.concat(B), nr = Math.max(1, Math.min(5, +job.copies || 1)); return Buffer.concat(Array(nr).fill(r1)); }
  align(1); size(2, 2); bold(1); wrap(job.stationName || 'KITCHEN', Math.floor(cols / 2)).forEach(txt); bold(0); size(1, 1);
  if (t.reprint) { bold(1); txt('*** REPRINT ***'); bold(0); }
  if (t.type === 'test') { txt('TEST PRINT'); }
  if (t.reroute && t.reroute.length) { bold(1); txt('>>> NILIPAT DITO <<<'); bold(0); t.reroute.forEach(r => wrap('galing: ' + r, cols).forEach(txt)); }
  line(); align(0);
  if (t.chan && t.type === 'counter') { size(2, 2); bold(1); wrap(t.chan.toUpperCase(), Math.floor(cols / 2)).forEach(txt); bold(0); size(1, 1); }
  if (t.table) { size(2, 2); bold(1); wrap('TABLE ' + t.table, Math.floor(cols / 2)).forEach(txt); bold(0); size(1, 1); }
  const meta = [t.zone, t.pax ? t.pax + ' pax' : '', t.orderNo ? 'Order #' + t.orderNo : '', t.type === 'counter' && t.ref ? 'Counter ' + t.ref : ''].filter(Boolean).join('  |  '); if (meta) txt(meta);
  txt(dd + ' ' + hh + (t.by ? '  ' + t.by : '')); line();
  (t.items || []).forEach(it => { size(1, 2); bold(1); wrap(it.qty + ' x ' + it.name, cols).forEach(txt); bold(0); size(1, 1); if (it.also && it.also.length) wrap('   + kasama sa: ' + it.also.join(', '), cols).forEach(txt); if (it.note) wrap('   ** ' + it.note, cols).forEach(l => { bold(1); txt(l); bold(0); }); });
  line(); align(1); txt(t.type === 'test' ? 'Gumagana ang printer' : (job.siteName || '')); align(0); txt(''); txt(''); txt('');
  put(GS, 0x56, 0x42, 0x00); // feed + partial cut
  const one = Buffer.concat(B), n = Math.max(1, Math.min(5, +job.copies || 1)); return Buffer.concat(Array(n).fill(one));
}

const sleep = ms => new Promise(r => setTimeout(r, ms));
const errMsg = (e, ip, port) => e.code === 'ECONNREFUSED' ? 'Tinanggihan ang koneksyon (' + ip + ':' + port + ')' : e.code === 'EHOSTUNREACH' || e.code === 'ENETUNREACH' ? 'Hindi maabot ang ' + ip : e.code === 'ECONNRESET' ? 'Naputol ang koneksyon (' + ip + ')' : e.message;
function sendRaw(ip, port, buf, timeout) {
  return new Promise((res, rej) => { const s = new net.Socket(); let done = false; const fin = e => { if (done) return; done = true; try { s.destroy(); } catch (x) {} e ? rej(e) : res(); };
    s.setTimeout(timeout || 6000, () => fin(new Error('Timeout — hindi maabot ang printer ' + ip + ':' + port))); s.on('error', e => fin(new Error(errMsg(e, ip, port))));
    s.connect(+port || 9100, ip, () => { s.write(buf, err => { if (err) return fin(err); setTimeout(() => fin(null), 400); }); }); });
}
/* Status ng printer (ESC/POS real-time status DLE EOT 1/2/4). Kung hindi sumasagot ang device pero nakakonekta: unverified (ituturing na OK). */
function interpret(b) {
  if (!b || b.length < 3) return { reach: true, ok: true, unverified: true };
  const b1 = b[0], b2 = b[1], b4 = b[2];
  if (b4 & 0x60) return { reach: true, ok: false, why: 'Naubos ang papel' };
  if (b2 & 0x04) return { reach: true, ok: false, why: 'Nakabukas ang takip ng printer' };
  if (b2 & 0x40) return { reach: true, ok: false, why: 'May error ang printer' };
  if (b1 & 0x08) return { reach: true, ok: false, why: 'Offline ang printer' };
  return { reach: true, ok: true };
}
function probe(ip, port, timeout) {
  return new Promise(res => { const s = new net.Socket(); let done = false; const buf = []; const fin = r => { if (done) return; done = true; try { s.destroy(); } catch (x) {} res(r); };
    s.setTimeout(timeout || 2500, () => fin({ reach: false, ok: false, why: 'Timeout — hindi maabot ang ' + ip })); s.on('error', e => fin({ reach: false, ok: false, why: errMsg(e, ip, port) }));
    s.on('data', d => { buf.push(...d); if (buf.length >= 3) fin(interpret(buf)); });
    s.connect(+port || 9100, ip, () => { s.write(Buffer.from([0x10, 4, 1, 0x10, 4, 2, 0x10, 4, 4])); setTimeout(() => fin(interpret(buf)), 1200); }); });
}
module.exports = { ascii, wrap, buildTicket, sendRaw, probe, interpret };

/* ---------------- AGENT CORE (may failover) ---------------- */
function makeAgent(db, o) {
  o = o || {}; const sites = o.sites || new Set(), host = o.host || 'agent', log = o.log || (() => {}), busy = new Set(), health = {}, cfgs = {};
  const H = (site, k) => (health[site] || {})[k], isDown = (site, k) => { const h = H(site, k); return !!(h && h.ok === false && Date.now() - h.ms < 120000); };
  const setH = (site, k, r) => { (health[site] = health[site] || {})[k] = { ok: !!r.ok, why: r.why || '', unverified: !!r.unverified, ms: Date.now() }; };
  async function getCfg(site) { if (cfgs[site]) return cfgs[site]; const d = await db.collection('pos_stations').doc(site).get(); return d.exists ? d.data() : {}; }
  async function reroute(ref, j, reason) {
    const c = await getCfg(j.site), map = c.map || {}, names = c.names || {}, fb = c.fallback === undefined ? '_cashier' : c.fallback; const visited = (j.via && j.via.length ? j.via.slice() : [j.station]); let cur = j.station, dest = '';
    for (let i = 0; i < 8; i++) { const next = (map[cur] || {}).backup || fb; if (!next || visited.includes(next)) break; visited.push(next); const m = map[next]; if (m && m.ip && m.enabled !== false && !isDown(j.site, next)) { dest = next; break; } cur = next; }
    if (dest) {
      const m = map[dest], nm = names[dest] || (dest === '_cashier' ? 'CASHIER' : dest), id = 'PJ' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), now = Date.now();
      const nj = Object.assign({}, j, { ip: m.ip, port: +m.port || 9100, paper: m.paper || '80', copies: +m.copies || 1, station: dest, stationName: nm, status: 'pending', tries: 0, error: '', via: visited, createdMs: now, createdAt: new Date(now).toISOString(), claimedAt: 0, agent: '' });
      nj.ticket = Object.assign({}, j.ticket, { reroute: (j.ticket.reroute || []).concat([(j.stationName || j.station) + ' - ' + reason]) });
      await db.collection('pos_print_jobs').doc(id).set(nj); await ref.update({ status: 'rerouted', rerouteTo: nm, error: reason }); log('↪️', j.stationName, '→', nm, '(' + reason + ')'); return nm;
    }
    await ref.update({ status: 'failed', error: reason + ' — walang available na backup printer' }); log('❌ FAILED', j.stationName, reason); return '';
  }
  async function handle(doc) {
    if (busy.has(doc.id)) return; busy.add(doc.id); try {
      const ref = doc.ref; const j = await db.runTransaction(async tx => { const d = await tx.get(ref); const x = d.data(); if (!x || x.status !== 'pending') return null; tx.update(ref, { status: 'printing', claimedAt: Date.now(), agent: host }); return x; }); if (!j) return;
      let reason = ''; const h = H(j.site, j.station);
      if (h && h.ok === false && Date.now() - h.ms < 120000) reason = h.why;
      else { let pr = await probe(j.ip, j.port); if (!pr.reach) { await sleep(o.retryMs != null ? o.retryMs : 1200); pr = await probe(j.ip, j.port); } if (!pr.ok) reason = pr.why; else { try { await sendRaw(j.ip, j.port, buildTicket(j), 4000); } catch (e) { reason = e.message; } } }
      if (!reason) { setH(j.site, j.station, { ok: true }); await ref.update({ status: 'printed', printedAt: new Date().toISOString(), error: '' }); log('✅', j.stationName, j.ip, (j.ticket || {}).table || ''); }
      else { setH(j.site, j.station, { ok: false, why: reason }); await reroute(ref, j, reason); if (o.onDown) o.onDown(); }
    } finally { setTimeout(() => busy.delete(doc.id), o.busyMs != null ? o.busyMs : 2000); }
  }
  async function checkAll() {
    for (const site of Object.keys(cfgs)) { const map = (cfgs[site] || {}).map || {}; for (const k of Object.keys(map)) { const m = map[k]; if (!m || !m.ip || m.enabled === false) continue; const r = await probe(m.ip, m.port); setH(site, k, r); } }
  }
  async function beat() {
    const list = Object.keys(cfgs).filter(s => !sites.size || sites.has(s)); const ids = list.length ? list : (sites.size ? [...sites] : ['_any']);
    for (const s of ids) { const pr = {}; Object.keys(health[s] || {}).forEach(k => { const h = health[s][k]; pr[k] = { ok: h.ok, why: h.why, unverified: h.unverified, ms: h.ms }; }); try { await db.collection('pos_print_agents').doc(s).set({ ms: Date.now(), at: new Date().toISOString(), host, version: '2.0', printers: pr }); } catch (e) { log('heartbeat:', e.message); } }
  }
  return { handle, reroute, checkAll, beat, health, cfgs, isDown };
}
module.exports.makeAgent = makeAgent;

/* ---------------- MAIN ---------------- */
if (require.main === module) {
  const args = process.argv.slice(2), arg = n => { const i = args.indexOf('--' + n); return i >= 0 ? args[i + 1] : ''; };
  const sites = new Set((arg('sites') || '').split(',').map(s => s.trim()).filter(Boolean)), keyFile = arg('key') || './serviceAccount.json', host = require('os').hostname();
  let admin; try { admin = require('firebase-admin'); } catch (e) { console.error('Kulang ang firebase-admin. Patakbuhin: npm install firebase-admin'); process.exit(1); }
  admin.initializeApp({ credential: admin.credential.cert(require(require('path').resolve(keyFile))) }); const db = admin.firestore(); const log = (...a) => console.log(new Date().toLocaleTimeString(), ...a);
  const ag = makeAgent(db, { sites, host, log, onDown: () => ag.beat() });
  db.collection('pos_stations').onSnapshot(snap => snap.docChanges().forEach(ch => { if (ch.type === 'removed') delete ag.cfgs[ch.doc.id]; else if (!sites.size || sites.has(ch.doc.id)) ag.cfgs[ch.doc.id] = ch.doc.data(); }), e => log('Config listener:', e.message));
  db.collection('pos_print_jobs').where('status', '==', 'pending').onSnapshot(snap => snap.docChanges().forEach(ch => { if (ch.type === 'removed') return; const d = ch.doc.data(); if (sites.size && !sites.has(d.site)) return; ag.handle(ch.doc).catch(e => log('handle:', e.message)); }), e => log('Listener error:', e.message));
  const cleanup = async () => { try { const old = Date.now() - 3 * 864e5, s = await db.collection('pos_print_jobs').where('createdMs', '<', old).limit(300).get(); const b = db.batch(); s.forEach(d => b.delete(d.ref)); if (!s.empty) { await b.commit(); log('Nilinis ang', s.size, 'lumang job'); } } catch (e) {} };
  const unstick = async () => { try { const s = await db.collection('pos_print_jobs').where('status', '==', 'printing').get(); s.forEach(d => { const x = d.data(); if (Date.now() - (x.claimedAt || 0) > 60000) d.ref.update({ status: 'pending' }); }); } catch (e) {} };
  const health = async () => { try { await ag.checkAll(); await ag.beat(); } catch (e) { log('health:', e.message); } };
  setTimeout(health, 3000); setInterval(health, 20000); cleanup(); setInterval(cleanup, 3600000); unstick(); setInterval(unstick, 60000);
  log('🖨️ Print Agent v2 (may backup/failover) tumatakbo' + (sites.size ? ' para sa: ' + [...sites].join(', ') : ' (lahat ng branch)') + ' — Ctrl+C para huminto');
}
