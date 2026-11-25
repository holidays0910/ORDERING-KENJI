#!/usr/bin/env node
/* =====================================================================
   KUSINA POS — BRIDGE  (LAN / offline relay)   v1
   Tumatakbo sa Post 1 (main) o sa isang laging naka-on na computer sa LAN. Windows / Ubuntu / Raspberry Pi. WALANG kailangang i-install
   maliban sa Node.js 18+ (walang npm install). Ilagay sa iisang folder kasama ang  print-agent.js.

     node kusina-bridge.js                     (port 8787)
     node kusina-bridge.js --port 8787 --pass MyAdminPass

   Ano ang ginagawa:
     1. 📲 Waiter-lite page  (http://<IP-ng-Post1>:8787/waiter) — para sa Post 2, 3… (iPad/phone) kahit WALANG INTERNET. Piliin ang table at item,
        ipapadala sa Post 1 sa pamamagitan ng LAN. Ang Post 1 ang tatanggap, magbubukas ng table, at magpi-print sa kusina.
     2. 🖨️ Printer relay — nagpi-print sa thermal printers (Star TSP143III / BSC10 / Epson TM-T…) sa static IP, port 9100, kahit offline ang internet.
     3. 🔧 Admin page (http://localhost:8787/admin) — mag-login ang admin, makikita ang mga IP na nakakonekta, at itatakda kung Post 1 (main) o Post 2+ ang bawat IP.
        Dito rin ilalagay ang IP ng mga printer at susubukan ang print.
   Hindi ito nagpapalit ng cloud: ang Post 1 (browser) ang nagsi-sync sa Firebase pagbalik ng internet (offline persistence).
   SECURITY: ang Post 1 ay gumagamit ng "key" (nasa Admin page) para sa mga sensitibong API. Ang waiter-lite ay para lang sa mga IP na itinakda ng admin.
   Huwag i-expose ang port 8787 sa internet (LAN lang; huwag i-port-forward).
   ===================================================================== */
'use strict';
const http = require('http'), fs = require('fs'), path = require('path'), crypto = require('crypto'), os = require('os');
let PA = {}; try { PA = require('./print-agent.js'); } catch (e) { console.warn('⚠ Walang print-agent.js sa tabi nito — hindi gagana ang printer relay.'); }
const args = process.argv.slice(2), arg = n => { const i = args.indexOf('--' + n); return i >= 0 ? args[i + 1] : ''; };
const PORT = +arg('port') || +process.env.KB_PORT || 8787, DIR = path.resolve(arg('data') || process.env.KB_DATA || path.join(__dirname, 'bridge-data'));
fs.mkdirSync(DIR, { recursive: true });
const CFG_F = path.join(DIR, 'config.json'), ORD_F = path.join(DIR, 'orders.json');
const readJ = (f, d) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { return d; } };
const writeJ = (f, o) => { const t = f + '.tmp'; fs.writeFileSync(t, JSON.stringify(o)); fs.renameSync(t, f); };
const hash = (pw, salt) => crypto.scryptSync(String(pw), salt, 32).toString('hex');
const rnd = n => crypto.randomBytes(n).toString('hex');
let C = readJ(CFG_F, null), firstPass = '';
if (!C) { const pw = arg('pass') || process.env.KB_PASS || rnd(4); if (!arg('pass') && !process.env.KB_PASS) firstPass = pw; const salt = rnd(8); C = { key: rnd(10), salt, hash: hash(pw, salt), site: '', posts: {}, printers: {}, staff: [], created: new Date().toISOString() }; writeJ(CFG_F, C); }
else if (arg('pass')) { C.salt = rnd(8); C.hash = hash(arg('pass'), C.salt); writeJ(CFG_F, C); }
const saveC = () => writeJ(CFG_F, C);
let O = readJ(ORD_F, { seq: 0, list: [] }); let saveT = null; const saveO = () => { clearTimeout(saveT); saveT = setTimeout(() => { O.list = O.list.slice(-500); writeJ(ORD_F, O); }, 150); };
let SNAP = { menu: [], tables: [], site: '', at: 0 }; const SEEN = {}, SESS = {}, FAIL = {}, LAST = {};
const log = (...a) => console.log(new Date().toLocaleTimeString(), ...a);
const ipOf = req => String(req.socket.remoteAddress || '').replace(/^::ffff:/, ''), isLoop = ip => ip === '127.0.0.1' || ip === '::1';
const eqKey = (a, b) => { a = Buffer.from(String(a || '')); b = Buffer.from(String(b || '')); return a.length === b.length && crypto.timingSafeEqual(a, b); };
const postOf = ip => (C.posts[ip] && +C.posts[ip].post) || (isLoop(ip) ? 1 : 0);
function seen(req) { const ip = ipOf(req); const s = SEEN[ip] = SEEN[ip] || { ip, first: Date.now(), n: 0 }; s.last = Date.now(); s.n++; s.ua = String(req.headers['user-agent'] || '').slice(0, 120); }
const lanIPs = () => Object.values(os.networkInterfaces()).flat().filter(i => i && i.family === 'IPv4' && !i.internal).map(i => i.address);

function send(res, code, body, type) { const h = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'content-type,x-key,x-admin', 'Access-Control-Allow-Methods': 'GET,POST,OPTIONS', 'Access-Control-Allow-Private-Network': 'true', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }; if (typeof body === 'object' && !Buffer.isBuffer(body)) { h['Content-Type'] = 'application/json'; body = JSON.stringify(body); } else h['Content-Type'] = type || 'text/plain; charset=utf-8'; if (type && /html/.test(type)) h['Content-Security-Policy'] = "default-src 'self'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; connect-src 'self'; img-src 'self' data:"; res.writeHead(code, h); res.end(body); }
function body(req) { return new Promise((ok, no) => { let n = 0; const a = []; req.on('data', c => { n += c.length; if (n > 1.2e6) { no(new Error('too big')); req.destroy(); return; } a.push(c); }); req.on('end', () => { try { ok(a.length ? JSON.parse(Buffer.concat(a).toString('utf8')) : {}); } catch (e) { no(new Error('bad json')); } }); req.on('error', no); }); }
const str = (v, n) => String(v == null ? '' : v).slice(0, n);

async function api(req, res, u) {
  const ip = ipOf(req), p = u.pathname, m = req.method, key = req.headers['x-key'], adm = SESS[req.headers['x-admin']] > Date.now(), keyOk = eqKey(key, C.key);
  if (m === 'OPTIONS') return send(res, 204, '');
  if (p === '/api/ping') { seen(req); return send(res, 200, { ok: true, name: 'kusina-bridge', v: 1, ip, post: postOf(ip), assigned: postOf(ip) > 0, key: keyOk, site: SNAP.site || C.site, snapAt: SNAP.at }); }
  if (p === '/api/login' && m === 'POST') { const f = FAIL[ip] = (FAIL[ip] || []).filter(t => Date.now() - t < 300000); if (f.length >= 5) return send(res, 429, { error: 'Masyadong maraming maling subok. Maghintay ng 5 minuto.' }); const b = await body(req); if (hash(str(b.pass, 100), C.salt) === C.hash) { const t = rnd(16); SESS[t] = Date.now() + 8 * 3600e3; log('🔓 admin login mula sa', ip); return send(res, 200, { token: t }); } f.push(Date.now()); return send(res, 401, { error: 'Maling password.' }); }
  if (p.startsWith('/api/admin/')) {
    if (!adm) return send(res, 401, { error: 'Mag-login muna.' }); const b = m === 'POST' ? await body(req) : {};
    if (p === '/api/admin/state') return send(res, 200, { key: C.key, seen: Object.values(SEEN).sort((a, b) => b.last - a.last).slice(0, 60), posts: C.posts, printers: C.printers, staff: C.staff, site: SNAP.site || C.site, snapAt: SNAP.at, tables: SNAP.tables.length, menu: SNAP.menu.length, orders: O.list.slice(-30).reverse(), ips: lanIPs(), me: ip });
    if (p === '/api/admin/post') { const n = Math.max(0, Math.min(20, Math.floor(+b.post) || 0)), t = str(b.ip, 45); if (!/^[0-9a-fA-F:.]+$/.test(t)) return send(res, 400, { error: 'Maling IP.' }); if (n === 1 && Object.entries(C.posts).some(([k, v]) => v.post === 1 && k !== t)) return send(res, 409, { error: 'May Post 1 (main) na. Isang main lang bawat branch — alisin muna ang kasalukuyan.' }); if (n) C.posts[t] = { post: n, name: str(b.name, 40) }; else delete C.posts[t]; saveC(); return send(res, 200, { ok: true }); }
    if (p === '/api/admin/printer') { const k = str(b.key, 30).replace(/[^\w-]/g, ''); if (!k) return send(res, 400, { error: 'Kulang ang pangalan.' }); if (b.remove) delete C.printers[k]; else { if (!/^\d{1,3}(\.\d{1,3}){3}$/.test(str(b.ip, 20))) return send(res, 400, { error: 'Maling IP ng printer.' }); C.printers[k] = { ip: str(b.ip, 20), port: +b.port || 9100, paper: b.paper === '58' ? '58' : '80', name: str(b.name, 40) || k }; } saveC(); return send(res, 200, { ok: true }); }
    if (p === '/api/admin/staff') { C.staff = (Array.isArray(b.staff) ? b.staff : []).map(x => str(x, 40).trim()).filter(Boolean).slice(0, 60); saveC(); return send(res, 200, { ok: true }); }
    if (p === '/api/admin/testprint') return doPrint(res, { ip: b.ip, port: b.port, paper: b.paper, stationName: 'BRIDGE TEST', ticket: { type: 'test' } });
    if (p === '/api/admin/newkey') { C.key = rnd(10); saveC(); return send(res, 200, { key: C.key }); }
    if (p === '/api/admin/pass') { if (str(b.pass, 100).length < 6) return send(res, 400, { error: 'Hindi bababa sa 6 na letra.' }); C.salt = rnd(8); C.hash = hash(b.pass, C.salt); saveC(); return send(res, 200, { ok: true }); }
    return send(res, 404, { error: 'wala' });
  }
  // --- Post 1 (key)
  if (p === '/api/snapshot' && m === 'POST') { if (!keyOk) return send(res, 401, { error: 'Maling key.' }); const b = await body(req); SNAP = { site: str(b.site, 40), menu: (Array.isArray(b.menu) ? b.menu : []).slice(0, 800).map(x => ({ id: str(x.id, 60), name: str(x.name, 80), price: +x.price || 0, category: str(x.category, 40), rm: (Array.isArray(x.rm) ? x.rm : []).slice(0, 12).map(r => ({ k: str(r.k, 40), n: str(r.n, 40), c: +r.c || 0 })) })), tables: (Array.isArray(b.tables) ? b.tables : []).slice(0, 200).map(x => ({ id: str(x.id, 60), name: str(x.name, 40), zone: str(x.zone, 30), open: !!x.open, pax: +x.pax || 0 })), at: Date.now() }; return send(res, 200, { ok: true, menu: SNAP.menu.length, tables: SNAP.tables.length }); }
  if (p === '/api/orders' && m === 'GET') { if (!keyOk) return send(res, 401, { error: 'Maling key.' }); return send(res, 200, { orders: O.list.filter(o => o.status === (u.searchParams.get('status') || 'new')).slice(0, 50) }); }
  if (p === '/api/orders/ack' && m === 'POST') { if (!keyOk) return send(res, 401, { error: 'Maling key.' }); const b = await body(req), o = O.list.find(x => x.id === str(b.id, 40)); if (!o) return send(res, 404, { error: 'Walang order.' }); if (!['accepted', 'rejected'].includes(b.status)) return send(res, 400, { error: 'Maling status.' }); o.status = b.status; o.orderNo = +b.orderNo || 0; o.reason = str(b.reason, 120); o.ackAt = Date.now(); saveO(); return send(res, 200, { ok: true }); }
  if (p === '/api/print' && m === 'POST') { if (!keyOk) return send(res, 401, { error: 'Maling key.' }); return doPrint(res, await body(req)); }
  if (p === '/api/probe' && m === 'POST') { if (!keyOk) return send(res, 401, { error: 'Maling key.' }); const b = await body(req); if (!PA.probe) return send(res, 200, { ok: false, why: 'Walang print-agent.js' }); const r = await PA.probe(str(b.ip, 20), +b.port || 9100); return send(res, 200, r); }
  // --- Waiter-lite (para sa IP na itinakda ng admin)
  const lan = postOf(ip) > 0 || keyOk;
  if (p === '/api/snapshot' && m === 'GET') { seen(req); if (!lan) return send(res, 403, { error: 'Hindi pa naka-assign ang device na ito. Sabihin sa admin ang IP: ' + ip, ip }); return send(res, 200, Object.assign({}, SNAP, { staff: C.staff, post: postOf(ip), ip })); }
  if (p === '/api/order' && m === 'POST') {
    if (!lan) return send(res, 403, { error: 'Hindi pa naka-assign ang device na ito. Sabihin sa admin ang IP: ' + ip, ip }); if (Date.now() - (LAST[ip] || 0) < 1500) return send(res, 429, { error: 'Sandali lang.' }); const b = await body(req);
    const tb = SNAP.tables.find(x => x.id === str(b.table, 60)); if (!tb) return send(res, 400, { error: 'Hindi nakilala ang table. I-refresh ang page.' });
    const items = (Array.isArray(b.items) ? b.items : []).slice(0, 40).map(i => { const mi = SNAP.menu.find(x => x.id === str(i.id, 60)); if (!mi) return null; const xo = (Array.isArray(i.xo) ? i.xo : []).map(x => str(x, 40)).filter(k => (mi.rm || []).some(r => r.k === k)).slice(0, 12); return { id: mi.id, qty: Math.max(1, Math.min(50, Math.floor(+i.qty) || 1)), xo, note: str(i.note, 80) }; }).filter(Boolean);
    if (!items.length) return send(res, 400, { error: 'Walang valid na item.' }); if (!(+b.pax > 0) && !tb.open) return send(res, 400, { error: 'Ilagay kung ilang pax (bagong table).' });
    LAST[ip] = Date.now(); const o = { id: 'LO' + Date.now().toString(36).toUpperCase() + rnd(2).toUpperCase(), seq: ++O.seq, at: new Date().toISOString(), ip, post: postOf(ip), table: tb.id, tableName: tb.name, pax: Math.max(0, Math.min(50, Math.floor(+b.pax) || 0)), staff: str(b.staff, 40), note: str(b.note, 120), items, status: 'new' }; O.list.push(o); saveO(); log('📲 order', o.id, tb.name, 'mula', ip); return send(res, 200, { id: o.id, seq: o.seq });
  }
  if (p.startsWith('/api/order/') && m === 'GET') { if (!lan) return send(res, 403, { error: 'Hindi naka-assign.' }); const o = O.list.find(x => x.id === str(p.slice(11), 40)); if (!o) return send(res, 404, { error: 'Walang order.' }); return send(res, 200, { id: o.id, status: o.status, orderNo: o.orderNo || 0, reason: o.reason || '' }); }
  return send(res, 404, { error: 'wala' });
}
async function doPrint(res, b) {
  if (!PA.buildTicket) return send(res, 500, { ok: false, error: 'Walang print-agent.js sa tabi ng bridge.' });
  const ip = str(b.ip, 20), port = +b.port || 9100; if (!/^\d{1,3}(\.\d{1,3}){3}$/.test(ip)) return send(res, 400, { ok: false, error: 'Maling IP ng printer.' });
  try { const buf = PA.buildTicket({ paper: b.paper === '58' ? '58' : '80', copies: Math.max(1, Math.min(5, +b.copies || 1)), stationName: str(b.stationName, 40), siteName: str(b.siteName, 60), ticket: b.ticket && typeof b.ticket === 'object' ? b.ticket : {} }); await PA.sendRaw(ip, port, buf, 4000); log('🖨️', ip, str(b.stationName, 20)); return send(res, 200, { ok: true }); }
  catch (e) { return send(res, 200, { ok: false, error: String(e.message || e).slice(0, 160) }); }
}

const WAITER = require('./bridge-pages.js').waiter, ADMIN = require('./bridge-pages.js').admin;
http.createServer(async (req, res) => {
  try { const u = new URL(req.url, 'http://x'); if (u.pathname === '/') { seen(req); res.writeHead(302, { Location: '/waiter' }); return res.end(); }
    if (u.pathname === '/waiter') { seen(req); return send(res, 200, WAITER, 'text/html; charset=utf-8'); }
    if (u.pathname === '/admin') return send(res, 200, ADMIN, 'text/html; charset=utf-8');
    if (u.pathname.startsWith('/api/')) return await api(req, res, u);
    return send(res, 404, 'Wala');
  } catch (e) { try { send(res, 400, { error: e.message }); } catch (x) {} }
}).listen(PORT, '0.0.0.0', () => {
  log('🌉 Kusina Bridge tumatakbo sa port ' + PORT); lanIPs().forEach(i => log('   Waiter-lite:  http://' + i + ':' + PORT + '/waiter')); log('   Admin:        http://localhost:' + PORT + '/admin'); log('   Key ng Post 1: ' + C.key + '  (ilalagay sa POS → Setup → 🌉 Bridge)');
  if (firstPass) log('   🔑 ADMIN PASSWORD (isang beses lang ipapakita — itala!): ' + firstPass);
});
