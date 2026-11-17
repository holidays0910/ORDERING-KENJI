// ===================================================================
// 📥 POS SALES IMPORT para sa Prime Cost — pos_import.js
// Mga profile: DreamPOS (Kenjitei) · Odoo POS (Tanoshi) · LS Central (Tokiya)
// Awtomatikong kinikilala ang format ayon sa laman ng Excel. Preview muna bago i-apply.
// ===================================================================
const POSI_KEYS = ['vat', 'exm', 'sc', 'pwd', 'disc', 'comp'];
const POSI_LABEL = { vat: 'Sales (Vatable) — net', exm: 'Sales (Vat-Exempt) — net', sc: 'Senior Citizens Discount', pwd: 'PWD Discount', disc: 'Sales Discount', comp: 'Complimentary' };
let POSI = null;

// ---------- PURE ----------
const posiNum = v => { if (typeof v === 'number') return v; const n = parseFloat(String(v == null ? '' : v).replace(/[,₱\s]/g, '')); return isNaN(n) ? 0 : n; };
const posiR2 = n => Math.round((+n || 0) * 100) / 100;
const posiZ = () => Array(7).fill(0);
const posiEmpty = () => { const o = {}; POSI_KEYS.forEach(k => o[k] = posiZ()); return o; };
function posiISO(v) { // Date | serial | 'YYYY-MM-DD' | 'D-Mon-YYYY' -> 'YYYY-MM-DD'
  if (v instanceof Date && !isNaN(v)) return v.getFullYear() + '-' + String(v.getMonth() + 1).padStart(2, '0') + '-' + String(v.getDate()).padStart(2, '0');
  if (typeof v === 'number' && v > 30000) return posiISO(new Date(Math.round((v - 25569) * 864e5) + 12 * 36e5));
  const s = String(v || '').trim(); if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10); const d = new Date(s); return isNaN(d) ? '' : posiISO(d);
}
const posiDayIdx = (iso, monday) => Math.round((new Date(iso + 'T00:00:00Z') - new Date(monday + 'T00:00:00Z')) / 864e5);
function posiDetect(sheets) { // sheets: [{name, rows}]
  for (const sh of sheets) { const top = sh.rows.slice(0, 12).map(r => (r || []).map(c => String(c == null ? '' : c).trim())); const flat = top.flat();
    if (top.some(r => r.includes('Transaction No.')) && flat.includes('VAT Bus. Posting Group')) return { profile: 'ls', sheet: sh };
    if (flat.some(c => /^Itemize Analysis Report/i.test(c))) return { profile: 'odoo', sheet: sh };
    if (flat.includes('Barcode') && flat.includes('Net Sales') && flat.includes('Item Description')) return { profile: 'dream', sheet: sh }; }
  return null;
}
// ----- LS Central: bawat linya ng resibo, may petsa -----
function posiParseLS(rows, monday) {
  const hi = rows.findIndex(r => (r || []).includes('Transaction No.')); const H = {}; (rows[hi] || []).forEach((c, i) => { if (c) H[String(c).trim()] = i; });
  const need = ['Date', 'Quantity', 'Net Amount', 'Discount Amount', 'VAT Bus. Posting Group']; const miss = need.filter(n => H[n] === undefined); if (miss.length) throw new Error('Kulang ang column: ' + miss.join(', '));
  const days = posiEmpty(), bills = Array.from({ length: 7 }, () => new Set()), items = {}, notes = []; let out = 0, n = 0, refunds = 0, minD = '', maxD = '', groups = {};
  for (let i = hi + 1; i < rows.length; i++) { const r = rows[i]; if (!r || r[H['Transaction No.']] == null || r[H['Transaction No.']] === '') continue;
    const iso = posiISO(r[H['Date']]); if (!iso) continue; n++; if (!minD || iso < minD) minD = iso; if (!maxD || iso > maxD) maxD = iso;
    const d = posiDayIdx(iso, monday); if (d < 0 || d > 6) { out++; continue; }
    const q = posiNum(r[H['Quantity']]), net = -posiNum(r[H['Net Amount']]), dc = (q < 0 ? 1 : -1) * posiNum(r[H['Discount Amount']]), g = String(r[H['VAT Bus. Posting Group']] || '').toUpperCase(); groups[g] = (groups[g] || 0) + 1; if (q > 0) refunds++;
    if (g === 'CEXEMPT') { days.exm[d] += net; days.sc[d] += dc; } else { days.vat[d] += net; days.disc[d] += dc; }
    bills[d].add(r[H['Receipt No.']] || r[H['Transaction No.']]);
    const code = String(r[H['Item No.']] == null ? '' : r[H['Item No.']]), nm = String(r[H['Item Description']] || ''), k = code || nm; const it = items[k] || (items[k] = { code, name: nm, qty: 0, net: 0 }); it.qty += -q; it.net += net; }
  POSI_KEYS.forEach(k => days[k] = days[k].map(posiR2));
  if (out) notes.push(`⚠️ ${out} linya ang labas sa napiling linggo at hindi isinama.`);
  if (refunds) notes.push(`${refunds} linyang positibo ang Quantity (refund/void) ay ibinawas na sa benta.`);
  if (days.sc.some(x => x)) notes.push('Ang discount ng VAT-exempt ay inilagay sa **Senior Citizens**. Hindi hati ang Senior at PWD sa LS Central; hatiin sa Prime Cost kung kailangan.');
  if (groups.CZERORATED) notes.push(`${groups.CZERORATED} zero-rated na linya ay isinama sa Vatable.`);
  return { profile: 'ls', title: 'LS Central (Tokiya)', start: minD, end: maxD, daily: true, days, covers: posiZ(), billsCount: bills.reduce((s, x) => s + x.size, 0), items: Object.values(items).map(x => ({ ...x, qty: posiR2(x.qty), net: posiR2(x.net) })), notes, lines: n };
}
// ----- Odoo POS (Itemize Analysis Report): weekly total lang -----
function posiParseOdoo(rows, monday, o) {
  o = o || {}; const find = k => rows.findIndex(r => r && String(r[0] || '').trim() === k); let start = '', end = '';
  const si = find('Start Date'), ei = find('End Date'); if (si >= 0) start = posiISO(rows[si][1]); if (ei >= 0) end = posiISO(rows[ei][1]);
  const ti = find('Sales Total'); if (ti < 0) throw new Error('Walang "Sales Total" sa dulo ng report.'); const T = rows[ti + 1] || []; const sales = posiNum(T[0]), sc = posiNum(T[2]), tax = posiNum(T[3]), disc = posiNum(T[4]);
  const bi = find('Bill#'); const B = bi >= 0 ? rows[bi + 1] || [] : []; const items = [];
  const hdr = find('Category'); for (let i = hdr + 1; i < ti; i++) { const r = rows[i]; if (!r || r[0] || !r[1] || typeof r[2] !== 'number' || typeof r[4] !== 'number') continue; items.push({ code: '', name: String(r[1]), qty: posiR2(r[4]), net: posiR2(r[5]) }); }
  const vatIncl = o.vatIncl !== false; const base = vatIncl ? sales - tax : sales; const days = posiEmpty(); days.vat[6] = posiR2(base - 0); days.disc[6] = posiR2(disc);
  const notes = [vatIncl ? `Ang Sales Total (${posiR2(sales)}) ay itinuring na **kasama ang VAT**; ibinawas ang Tax Total (${posiR2(tax)}).` : 'Ang Sales Total ay itinuring na **walang VAT**.', 'Weekly total lang ang Odoo report: inilagay ang buong linggo sa **Linggo**.', 'Walang hati ang Vat-exempt, Senior at PWD sa report na ito; lahat ay nasa Vatable. Itama sa Prime Cost kung kailangan.'];
  if (sc) notes.push(`May Service Charge na ${posiR2(sc)} sa report (hindi isinama).`);
  const covers = posiZ(); covers[6] = posiNum(B[1]);
  return { profile: 'odoo', title: 'Odoo POS (Tanoshi)', start, end, daily: false, days, covers, billsCount: posiNum(B[0]), items, notes, raw: { sales, tax, disc }, lines: items.length };
}
// ----- DreamPOS (salesitem_report): kabuuan kada item, may seksyon kada branch -----
function posiParseDream(rows) {
  const hi = rows.findIndex(r => (r || []).some(c => String(c).trim() === 'Barcode') && (r || []).some(c => String(c).trim() === 'Net Sales')); const H = {}; rows[hi].forEach((c, i) => { if (c) H[String(c).trim()] = i; });
  const B = []; let cur = null;
  for (let i = hi + 1; i < rows.length; i++) { const r = rows[i] || [], a = String(r[1] == null ? '' : r[1]);
    const m = /^Branch\s*:\s*(\S+)\s*-\s*(.*)$/.exec(a); if (m) { cur = { code: m[1], name: m[2].trim(), gross: 0, disc: 0, ve: 0, refund: 0, net: 0, svc: 0, items: [] }; B.push(cur); continue; }
    if (!cur) continue; if (/^Branch Total/i.test(a) || /^Grand Total/i.test(a)) continue; if (!r[H['Item Description']]) continue;
    const g = posiNum(r[H['Gross']]), d = posiNum(r[H['Discount']]), ve = posiNum(r[H['VE Amt']]), rf = posiNum(r[H['Refund']]), nt = posiNum(r[H['Net Sales']]); cur.gross += g; cur.disc += d; cur.ve += ve; cur.refund += rf; cur.net += nt; cur.svc += posiNum(r[H['SVC']]);
    cur.items.push({ code: String(r[H['Barcode']] || ''), name: String(r[H['Item Description']]), qty: posiR2(posiNum(r[H['Qty']])), net: posiR2(nt) }); }
  if (!B.length) throw new Error('Walang "Branch :" na seksyon sa report.'); return B;
}
// Hango sa totoong datos: ang VAT-exempt (senior/PWD) ay may 20% discount sa ex-VAT na base; VE Amt = 12% ng base na iyon.
function posiDreamTotals(b) {
  const exBase = b.ve / 0.12, scpwd = 0.2 * exBase, dTot = Math.abs(b.disc), reg = Math.max(0, dTot - scpwd), exNet = exBase - scpwd;
  const grossExVat = b.gross / 1.12, vatBase = grossExVat - exBase - reg / 1.12; const days = posiEmpty();
  days.vat[6] = posiR2(vatBase); days.exm[6] = posiR2(exNet); days.sc[6] = posiR2(Math.min(scpwd, dTot)); days.disc[6] = posiR2(reg / 1.12);
  return { days, covers: posiZ(), notes: ['Weekly total lang ang DreamPOS report: inilagay ang buong linggo sa **Linggo**. Walang petsa sa file, kaya ikaw ang pumili ng linggo.', 'Ang hati ng Vatable / Vat-exempt / Senior-PWD ay **tantiya** mula sa VE Amt (Senior/PWD = 20% ng ex-VAT na base). Tingnan at itama sa Prime Cost kung kailangan.', 'Walang covers sa DreamPOS report; ilagay nang manu-mano.'], raw: { gross: posiR2(b.gross), disc: posiR2(b.disc), ve: posiR2(b.ve), net: posiR2(b.net), svc: posiR2(b.svc) } };
}
const posiTotals = days => { const t = {}; POSI_KEYS.forEach(k => t[k] = posiR2(days[k].reduce((s, x) => s + x, 0))); t.gross = posiR2(POSI_KEYS.reduce((s, k) => s + t[k], 0)); return t; };

// ---------- UI ----------
function posiOpen() {
  if (!(typeof pcCan === 'function') || !pcCan()) { alert('Ang manager ng branch (o Admin) lang ang puwedeng mag-import, at hindi puwede sa naka-lock na linggo.'); return; }
  arModal(`<h3>📥 I-import ang POS Sales</h3><p style="font-size:.85rem;">Piliin ang weekly sales report ng POS (<b>Excel</b>). Awtomatikong kikilalanin kung DreamPOS, Odoo, o LS Central. May preview muna bago i-apply.</p>
  <div style="font-size:.82rem;background:#f0f9ff;padding:.5rem;border-radius:6px;margin-bottom:.5rem;">Linggo: <b>${PC.week}</b> – ${(() => { const d = pcDate(PC.week); d.setDate(d.getDate() + 6); return pcISO(d); })()} · Site: <b>${pcEsc(pcSite().name || '')}</b></div>
  <input type="file" id="posi-file" accept=".xlsx,.xls,.xlsm"> <div id="posi-out" style="margin-top:.6rem;"></div>`);
  document.getElementById('posi-file').onchange = posiRead;
}
async function posiRead() {
  const f = document.getElementById('posi-file').files[0], out = document.getElementById('posi-out'); if (!f) return; out.innerHTML = 'Binabasa...';
  try { if (typeof sapXlsxLib === 'function') await sapXlsxLib(); const wb = XLSX.read(await f.arrayBuffer(), { type: 'array', cellDates: true });
    const sheets = wb.SheetNames.map(n => ({ name: n, rows: XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1, raw: true, defval: null }) })); const det = posiDetect(sheets); if (!det) throw new Error('Hindi makilala ang format. Dapat galing sa DreamPOS (salesitem_report), Odoo (Itemize Analysis Report), o LS Central (Transaction line export).');
    POSI = { file: f.name, rows: det.sheet.rows, profile: det.profile, vatIncl: true, branch: 0 }; posiBuild();
  } catch (e) { out.innerHTML = `<div style="color:#dc2626;">❌ ${pcEsc(e.message)}</div>`; }
}
function posiBuild() {
  const out = document.getElementById('posi-out'), P = POSI; let R, extra = '';
  try {
    if (P.profile === 'ls') R = posiParseLS(P.rows, PC.week);
    else if (P.profile === 'odoo') R = posiParseOdoo(P.rows, PC.week, { vatIncl: P.vatIncl });
    else { P.branches = P.branches || posiParseDream(P.rows); const b = P.branches[P.branch] || P.branches[0], T = posiDreamTotals(b); R = { profile: 'dream', title: 'DreamPOS (Kenjitei)', start: '', end: '', daily: false, days: T.days, covers: T.covers, billsCount: 0, items: b.items, notes: T.notes, raw: T.raw, lines: b.items.length };
      extra = `<div style="margin:.4rem 0;"><label>Branch sa file: </label><select data-nosearch="1" onchange="POSI.branch=+this.value;posiBuild()">${P.branches.map((x, i) => `<option value="${i}" ${i === P.branch ? 'selected' : ''}>${pcEsc(x.code + ' — ' + x.name)}</option>`).join('')}</select></div>`; }
  } catch (e) { out.innerHTML = `<div style="color:#dc2626;">❌ ${pcEsc(e.message)}</div>`; return; }
  P.R = R; const T = posiTotals(R.days), mon = PC.week, sun = (() => { const d = pcDate(mon); d.setDate(d.getDate() + 6); return pcISO(d); })(); let warn = '';
  if (R.profile === 'odoo' && R.start && (R.start !== mon || R.end !== sun)) warn = `<div style="background:#fef2f2;color:#b91c1c;padding:.4rem .6rem;border-radius:6px;margin:.4rem 0;">⚠️ Ang period ng file (<b>${R.start} – ${R.end}</b>) ay hindi tugma sa napiling linggo (<b>${mon} – ${sun}</b>). Palitan muna ang linggo sa Prime Cost bago i-apply.</div>`;
  P.block = !!warn || !T.gross;
  const vatSw = R.profile === 'odoo' ? `<label style="display:flex;gap:.3rem;margin:.4rem 0;"><input type="checkbox" style="width:auto;" ${P.vatIncl ? 'checked' : ''} onchange="POSI.vatIncl=this.checked;posiBuild()"> Kasama ang VAT sa Sales Total ng Odoo</label>` : '';
  out.innerHTML = `<div style="font-weight:700;color:#065f46;">✔ Nakilala: ${pcEsc(R.title)} · ${R.lines} linya${R.billsCount ? ' · ' + R.billsCount + ' bill' : ''}${R.start ? ' · ' + R.start + ' → ' + R.end : ''}</div>${extra}${vatSw}${warn}
  <div class="table-responsive"><table style="font-size:.85rem;"><thead><tr><th>Field sa Prime Cost</th>${PC_DAYS.map(d => `<th style="text-align:right;">${d}</th>`).join('')}<th style="text-align:right;">Total</th></tr></thead><tbody>${POSI_KEYS.map(k => `<tr><td>${POSI_LABEL[k]}</td>${R.days[k].map(x => `<td style="text-align:right;">${x ? pcM(x) : ''}</td>`).join('')}<td style="text-align:right;"><b>${pcM(T[k])}</b></td></tr>`).join('')}${R.covers.some(x => x) ? `<tr><td>Covers</td>${R.covers.map(x => `<td style="text-align:right;">${x || ''}</td>`).join('')}<td style="text-align:right;"><b>${R.covers.reduce((s, x) => s + x, 0)}</b></td></tr>` : ''}</tbody><tfoot><tr><td><b>Gross (Prime Cost)</b></td><td colspan="7"></td><td style="text-align:right;"><b>₱${pcM(T.gross)}</b></td></tr></tfoot></table></div>
  ${R.notes.map(n => `<div style="font-size:.8rem;color:#475569;margin:.2rem 0;">• ${pcEsc(n).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')}</div>`).join('')}
  <div style="font-size:.8rem;margin-top:.3rem;">Mga item na babasahin para sa product mix: <b>${R.items.length}</b></div>
  <button class="btn btn-success" style="margin-top:.6rem;" onclick="posiApply()" ${P.block ? 'disabled' : ''}>✅ I-apply sa Prime Cost</button> <small style="color:#64748b;">Papalitan lang ang sales at covers na nakalista; hindi ginagalaw ang ibang bahagi.</small>`;
}
async function posiApply() {
  const R = POSI && POSI.R; if (!R) return; if (PC.W.locked) { alert('Naka-lock ang linggo.'); return; }
  const had = POSI_KEYS.some(k => ((PC.W.sales || {})[k] || []).some(x => +x)); if (had && !await uiConfirm('May sales nang naka-save sa linggong ito. Papalitan ng bagong import ang Vatable, Vat-exempt, Senior, PWD, Discount at Comp. Tuloy?')) return;
  PC.W.sales = PC.W.sales || {}; POSI_KEYS.forEach(k => { if (k === 'comp') return; PC.W.sales[k] = R.days[k].slice(); });
  if (R.covers.some(x => x)) PC.W.covers = R.covers.slice();
  PC.W.pos = { profile: R.profile, file: POSI.file, at: new Date().toISOString(), by: (PC.me || {}).email || '', start: R.start || '', end: R.end || '', daily: R.daily, bills: R.billsCount || 0, items: R.items.slice(0, 600) };
  PC.dirty = true; try { await pcSave(true); if (typeof logSystemAction === 'function') await logSystemAction('POS_IMPORT', `${pcSite().name} ${PC.week}: ${R.title} (${POSI.file})`); } catch (e) { alert('Error: ' + e.message); return; }
  arCloseModal(); if (typeof pcRender === 'function') pcRender(); pcToast('✅ Na-import ang POS sales.');
}
