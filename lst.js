/* =====================================================================
   🗓️ LST MANAGEMENT  (Labor Scheduling Tool — galing sa Excel na KT_SO3_LST)
   Mga bahagi: Setup (shifts/roles/empleyado) · Forecast (GC/TC/Sales) · Daily Plan (MON–SUN:
   role & headcount, manning, plan vs actual) · Weekly (oras/duty/shift board) ·
   Schedule (For Sir Mark + Sprout upload + ilapat sa Attendance) · LST vs Bio (late, undertime,
   OT, night diff, holiday, net basic)
   Firestore: lst_setup/{site}, lst_weeks/{site}__{monday}, lst_bio/{site}__{monday}
   ===================================================================== */
const LST_DAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];
const LST_DN = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const LST_DEF = {
  slotStart: '06:00', slotCount: 36, nightStart: '22:00', nightEnd: '06:00', defRate: 0,
  shifts: [['BRK001', 'Break1'], ['BRK002', 'Break2'], ['SFT003', 'Floor'], ['SFT004', 'Prep'], ['SFT005', 'Cleaner'], ['SFT006', 'Admin task'], ['SFT007', 'Partial Inventory'], ['SFT008', 'Inventory'], ['SFT009', 'Training'], ['SFT010', 'Work Project'], ['SFT011', 'BOH_Cross Training']].map(a => ({ id: a[0], name: a[1] })),
  roles: ['FOH_Lead', 'FOH_Recep', 'FOH_Waiter', 'FOH_Cashier', 'MGT_Admin', 'FOH_Prep', 'FOH_Bar', 'FOH_Runner', 'FOH_Cleaner', 'FOH_Training', 'FOH_TakeOut', 'FOH_Mgr', 'BOH_Head Chef', 'BOH_Sushi', 'BOH_Agemono', 'BOH_Ramen', 'BOH_Dishwasher', 'BOH_Prep', 'BOH_Cleaner', 'BOH_Dispatcher', 'BOH_Sushi Reliever', 'BOH_Agemono_Ramen_Reliever', 'FOH_Inventory', 'BOH_Inventory', 'FOH_Partial Inventory', 'BOH_Partial Inventory', 'FOH_Rounds Checking of Facility', 'BOH_Cross Training', 'FOH_Duty in other Branch'].map((n, i) => ({ id: 'ROL' + String(i + 1).padStart(3, '0'), name: n })),
  emps: {}
};
let L = { sites: [], site: '', setup: null, week: '', plan: null, bio: null, hr: [], tab: 'plan', day: 'MON', shiftSel: 'Floor', bioEmp: '', dirty: false, allEmps: false, q: '' };

/* ---------- oras ---------- */
function lstMin(t) { if (t == null || t === '') return null; if (typeof t === 'number') return Math.round(t * 1440 * 1000) / 1000; const m = /^\s*(\d{1,2}):(\d{2})(?::(\d{2}))?\s*([ap]m)?\s*$/i.exec(String(t)); if (!m) return null; let h = +m[1]; if (m[4]) { const pm = /p/i.test(m[4]); h = (h % 12) + (pm ? 12 : 0); } return h * 60 + (+m[2]) + (+(m[3] || 0)) / 60; }
function lstHM(min) { if (min == null) return ''; const t = Math.round(min * 60) / 60, h = Math.floor(t / 60) % 24, m = Math.floor(t % 60), s = Math.round((t % 1) * 60); return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}` + (s ? ':' + String(s).padStart(2, '0') : ''); }
function lst12(min) { if (min == null) return ''; const h = Math.floor(min / 60) % 24, m = Math.floor(min % 60); return `${String(h % 12 === 0 ? 12 : h % 12).padStart(2, '0')}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`; }
const lstP2 = n => String(n).padStart(2, '0');
function lstISO(d) { return `${d.getFullYear()}-${lstP2(d.getMonth() + 1)}-${lstP2(d.getDate())}`; }
function lstDate(iso) { const [y, m, d] = iso.split('-').map(Number); return new Date(y, m - 1, d); }
function lstMonday(iso) { const d = lstDate(iso); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return lstISO(d); }
function lstDayDate(week, k) { const d = lstDate(week); d.setDate(d.getDate() + k); return lstISO(d); }
function lstMDY(iso) { const [y, m, d] = iso.split('-'); return `${m}/${d}/${y}`; }
const lstF05 = x => x - (((x % 0.5) + 0.5) % 0.5);
const lstR1 = x => Math.round(x * 10) / 10, lstR2 = x => Math.round(x * 100) / 100;
function lstSlots(S) { const a = lstMin(S.slotStart) || 0, n = Math.max(1, Math.min(49, +S.slotCount || 36)); return Array.from({ length: n }, (_, i) => a + i * 30); }
function lstShiftId(S, name) { const s = (S.shifts || []).find(x => x.name === name); return s ? s.id : ''; }
const lstIsBrk = id => /BRK/i.test(id || '');
function lstEsc(s) { return typeof srchEsc === 'function' ? srchEsc(s) : String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function lstSetupFill(s) { const o = JSON.parse(JSON.stringify(LST_DEF)); if (s) Object.keys(s).forEach(k => { if (s[k] != null) o[k] = s[k]; }); return o; }
function lstNewPlan(week) { const days = {}; LST_DAYS.forEach(d => { days[d] = { roles: [], rows: [] }; }); return { week, days, fc: { gc: {}, tc: {}, sales: {} } }; }

/* ---------- CALC: pang-araw (MON–SUN sheet) ---------- */
function lstRowSegs(S, r) { return (r.segs || []).map(g => { const a = lstMin(g.in), b = lstMin(g.out); if (!g.shift || a == null || b == null) return null; const o = b <= a ? b + 1440 : b; return { shift: g.shift, id: lstShiftId(S, g.shift), in: a, out: o }; }).filter(Boolean); }
function lstStrip(S, r, slots) { const sg = lstRowSegs(S, r); return slots.map(t => { for (const g of sg) { if ((t >= g.in && t < g.out) || (t + 1440 >= g.in && t + 1440 < g.out)) return g.id || g.shift; } return ''; }); }
function lstDayCalc(S, day, fc, dk) {
  const slots = lstSlots(S), n = slots.length; const z = () => Array(n).fill(0);
  const ideal = z(), plan = {}, act = {}, actual = z(), strips = [];
  (day.roles || []).forEach(l => { plan[l.role] = plan[l.role] || z(); slots.forEach((t, i) => { const v = +(l.hc || [])[i] || 0; ideal[i] += v; plan[l.role][i] += v; }); });
  (day.rows || []).forEach(r => { const st = lstStrip(S, r, slots); strips.push(st); if (!r.role) return; act[r.role] = act[r.role] || z(); st.forEach((id, i) => { if (id && !lstIsBrk(id)) { actual[i]++; act[r.role][i]++; } }); });
  const g = k => (fc && fc[k] && fc[k][dk]) || [], sales = slots.map((t, i) => +g('sales')[i] || 0);
  const tot = a => a.reduce((s, x) => s + x, 0);
  const idealHrs = tot(ideal) / 2, actualHrs = tot(actual) / 2, salesTot = tot(sales);
  return { slots, ideal, actual, plan, act, strips, sales, gc: slots.map((t, i) => +g('gc')[i] || 0), tc: slots.map((t, i) => +g('tc')[i] || 0), idealHrs, actualHrs, salesTot, idealProd: idealHrs ? salesTot / idealHrs : 0, planProd: actualHrs ? salesTot / actualHrs : 0, idealSlotProd: ideal.map((h, i) => h ? sales[i] * 2 / h : 0), actSlotProd: actual.map((h, i) => h ? sales[i] * 2 / h : 0) };
}
/* ---------- CALC: bawat empleyado bawat araw (_Records → WK_EMP / For Sir Mark) ---------- */
function lstEmpKey(r) { return r.eid || r.name || ''; }
function lstEmpDay(S, day, key) {
  const ev = []; (day.rows || []).forEach(r => { if (lstEmpKey(r) !== key) return; lstRowSegs(S, r).forEach(g => ev.push(g)); });
  if (!ev.length) return null;
  const all = ev.flatMap(g => [g.in, g.out]), span = (Math.max(...all) - Math.min(...all)) / 60;
  const spanOf = id => { const x = ev.filter(g => g.id === id).flatMap(g => [g.in, g.out]); return x.length ? (Math.max(...x) - Math.min(...x)) / 60 : 0; };
  const brk = spanOf('BRK001') + spanOf('BRK002'), nb = ev.filter(g => g.id !== 'BRK001'), b1 = ev.filter(g => g.id === 'BRK001');
  return { span, brk, duty: span - brk, inM: nb.length ? Math.min(...nb.map(g => g.in)) : null, outM: nb.length ? Math.max(...nb.map(g => g.out)) : null, outB: b1.length ? Math.min(...b1.map(g => g.in)) : null, inB: b1.length ? Math.max(...b1.map(g => g.out)) : null, first: Math.min(...all), last: Math.max(...all), ev, spanOf };
}
function lstPlanEmps(S, plan) { const seen = new Map(); LST_DAYS.forEach(d => ((plan.days[d] || {}).rows || []).forEach(r => { const k = lstEmpKey(r); if (k && !seen.has(k)) seen.set(k, { key: k, eid: r.eid || '', name: r.name || k }); })); return [...seen.values()]; }
function lstSched(S, plan, key) { return LST_DAYS.map(d => { const x = lstEmpDay(S, plan.days[d] || { rows: [] }, key); return x && x.inM != null ? { rest: false, inM: x.inM, outB: x.outB, inB: x.inB, outM: x.outM } : { rest: true }; }); }
function lstSchedHours(s) { if (s.rest) return { hrs: 0, ot: 0 }; const hrs = lstR2(((s.outM - s.inM) - (s.outB != null && s.inB != null ? s.inB - s.outB : 0)) / 60); return { hrs, ot: hrs >= 8 ? lstR2(hrs - 8) : 0 }; }

/* ---------- CALC: LST vs BIO (porma ng LSTvsBIO sheet) ---------- */
function lstBioCalc(cfg, lst, b, rate) {
  const R = { present: false }; const nz = v => v == null || v === ''; const BL = (+rate || 0) / 8;
  if (nz(b.in) || nz(b.out)) return Object.assign(R, { hourRate: BL, pay: b.leave ? +rate || 0 : 0, leave: !!b.leave });
  let tin = lstMin(b.in), tob = lstMin(b.outB), tib = lstMin(b.inB), tout = lstMin(b.out);
  if (tob != null && tob < tin) tob += 1440; if (tib != null && tib < (tob != null ? tob : tin)) tib += 1440; if (tout < Math.max(tin, tib || 0, tob || 0)) tout += 1440;
  const hasB = tob != null && tib != null, lin = lst && !lst.rest ? lst.inM : null;
  const N = ((tout - (lin != null ? lin : tin)) - (hasB ? tib - tob : 0)) / 60; // gaya ng sheet: out − LST in − break
  const hasLB = lst && !lst.rest && lst.outB != null && lst.inB != null;
  const plannedHrs = lin != null ? lstF05(((lst.outM - lst.inM) - (hasLB ? lst.inB - lst.outB : 0)) / 60) : N;
  const late = lin != null && tin > lin ? tin - lin : 0;
  const pB = hasLB ? lst.inB - lst.outB : 0, aB = hasB ? tib - tob : 0;
  const over = hasLB ? (pB > aB ? 0 : Math.floor(aB - pB)) : 0;
  const sf = Math.max(0, (plannedHrs - N) * 60), under = Math.max(0, sf - over);
  const brkOT = b.brkOT && hasLB ? (() => { const x = pB - aB; return x < 0 ? 0 : x - (x % 0.5); })() : 0;
  const otIn = b.otIn && lin != null ? (() => { const x = Math.max(0, lin - tin); return x - (x % 30); })() : 0;
  const ns = lstMin(cfg.nightStart || '22:00'), ne = lstMin(cfg.nightEnd || '06:00') + 1440;
  const AW = ns - tin > 0 ? Math.min(N, (ns - tin) / 60) : 0, AX = Math.max(0, (tout - ne) / 60), AYraw = AW + AX, AY = Math.floor((AYraw - (AYraw % 0.5)) * 100) / 100;
  const otOut = b.otOut ? (() => { const x = (AY > 8 ? AY - 8 : AY) * 60; return x - (x % 30); })() : 0;
  const otMin = brkOT + otIn + otOut, otPay = otMin / 60 * BL * 1.25;
  const ndRaw = tout > ns ? (tout - ns) / 60 : 0, nd = ndRaw - (ndRaw % 0.5), ndPay = BL * 0.10 * nd;
  const spPay = b.special ? Math.max(0, BL * 0.30 * AY) : 0, lgPay = b.legal ? BL * AY : 0;
  const tardMin = Math.floor(late + under + over), tardPay = BL / 60 * tardMin;
  const base = (+rate || 0) - tardPay, net = (b.legal ? base + lgPay : base) + (b.special ? spPay : 0) + otPay;
  return Object.assign(R, { present: true, hrs: lstR2(N), plannedHrs, late: lstR1(late), under: lstR1(under), over, brkOT, otIn, otOut, otMin, otPay: lstR2(otPay), nd, ndPay: lstR2(ndPay), regHrs: AY, spPay: lstR2(spPay), lgPay: lstR2(lgPay), tardMin, tardPay: lstR2(tardPay), paidHrs: lstR2(((tout - tin) - (hasB ? tib - tob : 0)) / 60), hourRate: lstR2(BL), pay: lstR2(net) });
}
/* ---------- DATA ---------- */
function lstKey(extra) { return (L.site || '') + (extra ? '__' + extra : ''); }
async function lstLoadSites() {
  if (L.sites.length || !db) return; try { (await db.collection('inventory_branches').get()).forEach(d => { const x = d.data(); L.sites.push({ key: typeof invSlug === 'function' ? invSlug(x.code || x.branch) : (x.code || x.branch), name: x.branch || x.code, code: x.code || '', company: x.company || '' }); }); } catch (e) {}
  L.sites.sort((a, b) => (a.company + a.name).localeCompare(b.company + b.name)); if (!L.site && L.sites[0]) L.site = L.sites[0].key;
}
async function lstLoadHR() { if (L.hr.length) return; try { (await db.collection('employees').get()).forEach(d => { const e = d.data(); L.hr.push(Object.assign({ id: d.id }, e)); }); } catch (e) {} L.hr = L.hr.filter(e => !/resign|terminat/i.test(e.status || '')); }
function lstSiteEmps() {
  const s = L.sites.find(x => x.key === L.site) || {}, nm = String(s.name || '').toLowerCase(), cd = String(s.code || '').toLowerCase();
  let list = L.hr.filter(e => e.empId || e.id); if (!L.allEmps) { const m = list.filter(e => [e.dept, e.branch, e.location].some(v => v && [nm, cd].includes(String(v).toLowerCase()))); if (m.length) list = m; }
  return list.map(e => { const eid = e.empId || e.id, st = (L.setup.emps || {})[eid] || {}; const full = e.lname ? `${e.lname}, ${e.fname || ''} ${e.mname || ''}`.trim() : (e.name || e.fname || eid); return { eid, full, nick: st.nick || e.nick || e.fname || full, rate: st.rate != null && st.rate !== '' ? +st.rate : (+e.dailyRate || +e.rate || 0) }; }).sort((a, b) => a.full.localeCompare(b.full));
}
async function lstLoadSetup() { const d = await db.collection('lst_setup').doc(L.site).get(); L.setup = lstSetupFill(d.exists ? d.data() : null); }
async function lstLoadWeek() {
  const w = L.week, [pd, bd] = await Promise.all([db.collection('lst_weeks').doc(lstKey(w)).get(), db.collection('lst_bio').doc(lstKey(w)).get()]);
  L.plan = pd.exists ? pd.data() : lstNewPlan(w); LST_DAYS.forEach(d => { L.plan.days = L.plan.days || {}; L.plan.days[d] = L.plan.days[d] || { roles: [], rows: [] }; }); L.plan.fc = L.plan.fc || { gc: {}, tc: {}, sales: {} }; L.bio = bd.exists ? bd.data() : { days: {}, rates: {} }; L.bio.days = L.bio.days || {}; L.dirty = false;
}
async function loadLST() {
  const root = document.getElementById('lst-root'); if (!root || !db) return;
  try { root.innerHTML = '<div class="card">Kinukuha...</div>'; await lstLoadSites(); await lstLoadHR(); if (!L.site) { root.innerHTML = '<div class="card">Wala pang Branch. Gumawa muna sa 🏢 Company Management.</div>'; return; } if (!L.week) L.week = lstMonday(lstISO(new Date())); await lstLoadSetup(); await lstLoadWeek(); lstRender(); } catch (e) { root.innerHTML = `<div class="card" style="color:#dc2626;">Error: ${lstEsc(e.message)}</div>`; }
}
async function lstSavePlan() { const u = getCurrentUser() || {}; try { await db.collection('lst_weeks').doc(lstKey(L.week)).set(Object.assign({}, L.plan, { site: L.site, week: L.week, updatedBy: u.email || '', updatedAt: new Date().toISOString() })); L.dirty = false; lstRender(); lstToast('✅ Na-save ang plan.'); } catch (e) { alert('Error: ' + e.message); } }
async function lstSaveSetup() { try { await db.collection('lst_setup').doc(L.site).set(L.setup); lstToast('✅ Na-save ang setup.'); } catch (e) { alert('Error: ' + e.message); } }
async function lstSaveBio() { const u = getCurrentUser() || {}; try { await db.collection('lst_bio').doc(lstKey(L.week)).set(Object.assign({}, L.bio, { site: L.site, week: L.week, updatedBy: u.email || '', updatedAt: new Date().toISOString() })); lstToast('✅ Na-save ang Bio.'); } catch (e) { alert('Error: ' + e.message); } }
function lstToast(m) { const el = document.getElementById('lst-msg'); if (el) { el.textContent = m; setTimeout(() => { if (el.textContent === m) el.textContent = ''; }, 4000); } }
function lstDirty() { L.dirty = true; const b = document.getElementById('lst-save'); if (b) b.style.outline = '3px solid #f59e0b'; }

/* ---------- RENDER: shell ---------- */
const LST_TABS = [['setup', '⚙️ Setup'], ['fc', '📈 Forecast'], ['plan', '🗓️ Daily Plan'], ['week', '👥 Weekly'], ['sched', '📋 Schedule / Sprout'], ['bio', '⏱️ LST vs Bio']];
function lstRender() {
  const root = document.getElementById('lst-root'); if (!root) return; const t = L.tab;
  root.innerHTML = `<div class="card"><div class="card-title"><span>🗓️ LST Management</span><span id="lst-msg" style="font-size:.8rem;color:#166534;"></span></div>
  <div style="display:flex;gap:.4rem;flex-wrap:wrap;align-items:end;margin-bottom:.5rem;"><div><label style="font-weight:700;">Branch</label><br><select onchange="lstSiteChange(this.value)" style="min-width:200px;">${L.sites.map(s => `<option value="${lstEsc(s.key)}" ${s.key === L.site ? 'selected' : ''}>${lstEsc((s.company ? s.company + ' — ' : '') + s.name)}</option>`).join('')}</select></div>
  <div><label style="font-weight:700;">Linggo (Lunes)</label><br><input type="date" value="${L.week}" onchange="lstWeekChange(this.value)"></div>
  <button class="btn btn-secondary btn-sm" onclick="lstWeekShift(-7)">◀</button><button class="btn btn-secondary btn-sm" onclick="lstWeekShift(7)">▶</button>
  <button class="btn btn-secondary btn-sm" onclick="lstImportOpen()" title="Kunin ang laman ng lumang LST Excel mo">📥 I-import ang LST Excel</button></div>
  <div style="display:flex;gap:.3rem;flex-wrap:wrap;margin-bottom:.6rem;">${LST_TABS.map(([k, l]) => `<button class="btn btn-sm ${t === k ? 'btn-primary' : 'btn-secondary'}" onclick="L.tab='${k}';lstRender()">${l}</button>`).join('')}</div>
  <div id="lst-body">${({ setup: lstHtmlSetup, fc: lstHtmlFC, plan: lstHtmlPlan, week: lstHtmlWeek, sched: lstHtmlSched, bio: lstHtmlBio }[t] || lstHtmlPlan)()}</div></div>`;
}
async function lstSiteChange(k) { if (L.dirty && !await uiConfirm('May hindi pa na-save na plan. Lumipat pa rin?')) { lstRender(); return; } L.site = k; await loadLST(); }
async function lstWeekChange(v) { if (!v) return; if (L.dirty && !await uiConfirm('May hindi pa na-save na plan. Lumipat pa rin?')) { lstRender(); return; } L.week = lstMonday(v); await lstLoadWeek(); lstRender(); }
function lstWeekShift(n) { const d = lstDate(L.week); d.setDate(d.getDate() + n); lstWeekChange(lstISO(d)); }

/* ---------- SETUP ---------- */
function lstHtmlSetup() {
  const S = L.setup, emps = lstSiteEmps();
  const ids = emps.map(e => `<tr data-crud-row><td><b>${lstEsc(e.full)}</b><br><small style="color:#64748b;">${lstEsc(e.eid)}</small></td><td><input value="${lstEsc((S.emps[e.eid] || {}).nick || '')}" placeholder="${lstEsc(e.nick)}" style="width:110px;" onchange="lstEmpSet('${lstEsc(e.eid)}','nick',this.value)"></td><td><input type="number" min="0" step="any" value="${(S.emps[e.eid] || {}).rate != null ? (S.emps[e.eid] || {}).rate : ''}" placeholder="${e.rate || S.defRate || 0}" style="width:90px;" onchange="lstEmpSet('${lstEsc(e.eid)}','rate',this.value)"></td></tr>`).join('') || '<tr><td colspan="3" style="color:#94a3b8;text-align:center;">Walang empleyado. Magdagdag sa 🧑‍💼 Employee DB (HR).</td></tr>';
  return `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:.5rem;margin-bottom:.6rem;">
   <div><label>Unang oras ng grid</label><input type="time" value="${S.slotStart}" onchange="L.setup.slotStart=this.value||'06:00'"></div><div><label>Bilang ng 30-min slots (max 49)</label><input type="number" min="1" max="49" value="${S.slotCount}" onchange="L.setup.slotCount=Math.max(1,Math.min(49,+this.value||36))"></div>
   <div><label>Simula ng Night Diff</label><input type="time" value="${S.nightStart}" onchange="L.setup.nightStart=this.value"></div><div><label>Tapos ng Night Diff</label><input type="time" value="${S.nightEnd}" onchange="L.setup.nightEnd=this.value"></div>
   <div><label>Default Daily Rate (₱)</label><input type="number" min="0" step="any" value="${S.defRate || 0}" onchange="L.setup.defRate=+this.value||0"></div>
   </div>
  <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:.8rem;">
   <div><b>⏱️ Shift Types</b> <small style="color:#64748b;">(ang ID na BRK ay break)</small>${lstListEditor('shifts', S.shifts, 'ID', 'Pangalan')}</div>
   <div><b>🎭 Roles</b>${lstListEditor('roles', S.roles, 'ID', 'Pangalan')}</div>
   <div><b>👥 Empleyado (galing HR)</b> <label style="font-size:.78rem;"><input type="checkbox" ${L.allEmps ? 'checked' : ''} onchange="L.allEmps=this.checked;lstRender()"> lahat ng branch</label><input type="search" placeholder="🔍 Hanapin..." oninput="crudFilter(this)" style="width:100%;margin:.3rem 0;"><div style="max-height:46vh;overflow:auto;"><table data-notools="1"><thead><tr><th>HR / Employee ID</th><th>Palayaw</th><th>Daily ₱</th></tr></thead><tbody>${ids}</tbody></table></div><small style="color:#64748b;">Ang Employee ID (hal. 220704-001) ang ginagamit sa Sprout. Ang palayaw ang lalabas sa grid.</small></div></div>
  <div style="margin-top:.7rem;"><button class="btn btn-success" onclick="lstSaveSetup()">💾 I-save ang Setup</button> <button class="btn btn-secondary btn-sm" onclick="lstSetupRedraw()">↻ I-refresh</button></div>`;
}
function lstSetupRedraw() { lstRender(); }
function lstListEditor(k, arr, a, b) {
  return `<div style="max-height:46vh;overflow:auto;"><table data-notools="1"><thead><tr><th>${a}</th><th>${b}</th><th></th></tr></thead><tbody>${arr.map((x, i) => `<tr><td><input value="${lstEsc(x.id)}" style="width:80px;" onchange="L.setup['${k}'][${i}].id=this.value.trim()"></td><td><input value="${lstEsc(x.name)}" style="width:100%;min-width:130px;" onchange="L.setup['${k}'][${i}].name=this.value.trim()"></td><td><button class="btn btn-sm btn-danger" onclick="lstListDel('${k}',${i})">✖</button></td></tr>`).join('')}</tbody></table></div><button class="btn btn-sm btn-secondary" onclick="lstListAdd('${k}')">➕ Dagdag</button>`;
}
function lstListAdd(k) { const arr = L.setup[k], pre = k === 'roles' ? 'ROL' : 'SFT'; let n = arr.length + 1; while (arr.some(x => x.id === pre + String(n).padStart(3, '0'))) n++; arr.push({ id: pre + String(n).padStart(3, '0'), name: '' }); lstRender(); }
async function lstListDel(k, i) { if (!await uiConfirm('Burahin ito?')) return; L.setup[k].splice(i, 1); lstRender(); }
function lstEmpSet(eid, f, v) { L.setup.emps = L.setup.emps || {}; const o = L.setup.emps[eid] = L.setup.emps[eid] || {}; if (f === 'rate') o.rate = v === '' ? null : +v; else o[f] = v.trim(); }

/* ---------- FORECAST ---------- */
function lstHtmlFC() {
  const S = L.setup, slots = lstSlots(S), fc = L.plan.fc; const defs = [['gc', 'GUEST COUNT (GC)'], ['tc', 'TRANSACTION COUNT (TC)'], ['sales', 'SALES (₱)']];
  return `<p style="font-size:.84rem;color:#64748b;">Ilagay o i-paste ang forecast bawat 30-minuto. Kung galing sa Excel (FC_LST), kopyahin ang 7 row (MON–SUN) at i-paste sa 📋 sa ibaba ng bawat seksyon. Ang Sales ay sa ₱ (ang FC_LST ng Excel na nasa libong piso ay awtomatikong ×1,000 sa pag-import).</p>
  ${defs.map(([k, l]) => `<h4 style="margin:.6rem 0 .2rem;">${l} <button class="btn btn-sm btn-secondary" onclick="lstFcPaste('${k}')">📋 I-paste mula Excel</button></h4><div class="table-responsive"><table data-notools="1" style="font-size:.7rem;"><thead><tr><th></th>${slots.map(t => `<th style="min-width:46px;">${lstHM(t % 1440)}</th>`).join('')}<th>Total</th></tr></thead><tbody>${LST_DAYS.map(d => { const a = (fc[k] || {})[d] || []; return `<tr><td><b>${d}</b></td>${slots.map((t, i) => `<td><input type="number" step="any" value="${a[i] || ''}" style="width:46px;font-size:.7rem;padding:2px;" onchange="lstFcSet('${k}','${d}',${i},this.value)"></td>`).join('')}<td><b>${lstR1(a.slice(0, slots.length).reduce((s, x) => s + (+x || 0), 0))}</b></td></tr>`; }).join('')}</tbody></table></div>`).join('')}
  <div style="margin-top:.6rem;"><button id="lst-save" class="btn btn-success" onclick="lstSavePlan()">💾 I-save</button></div>`;
}
function lstFcSet(k, d, i, v) { const fc = L.plan.fc; fc[k] = fc[k] || {}; const a = fc[k][d] = fc[k][d] || []; a[i] = v === '' ? 0 : +v; lstDirty(); }
async function lstFcPaste(k) {
  arModal(`<h3>📋 I-paste ang ${k.toUpperCase()}</h3><p style="font-size:.84rem;color:#64748b;">I-paste ang 7 row (MON–SUN), bawat row ay mga numero na magkakahiwalay ng tab o kuwit, nagsisimula sa unang slot. Puwedeng may unang column na MON/TUE... at puwede ring 1 row lang (para sa isang araw: pipiliin sa ibaba).</p><textarea id="lst-paste" rows="9" style="width:100%;font-family:monospace;"></textarea><div style="margin:.4rem 0;">Kung 1 row lang: <select id="lst-paste-day">${LST_DAYS.map(d => `<option>${d}</option>`).join('')}</select></div><button class="btn btn-success" onclick="lstFcPasteGo('${k}')">✅ Ilapat</button> <button class="btn btn-secondary" onclick="arCloseModal()">Kanselahin</button>`);
}
function lstFcPasteGo(k) {
  const lines = (document.getElementById('lst-paste').value || '').split(/\r?\n/).map(l => l.trim()).filter(Boolean); if (!lines.length) { alert('Walang na-paste.'); return; }
  const fc = L.plan.fc; fc[k] = fc[k] || {}; const n = lstSlots(L.setup).length;
  lines.forEach((ln, i) => { let cells = ln.split(/[\t,;]+/).map(x => x.trim()); let d = LST_DAYS[i]; if (/^(mon|tue|wed|thu|fri|sat|sun)/i.test(cells[0])) { d = cells[0].slice(0, 3).toUpperCase(); cells = cells.slice(1); } if (lines.length === 1 && !/^(mon|tue|wed|thu|fri|sat|sun)/i.test(ln)) d = document.getElementById('lst-paste-day').value; if (!d || !LST_DAYS.includes(d)) return; fc[k][d] = cells.slice(0, n).map(x => +String(x).replace(/[^0-9.\-]/g, '') || 0); });
  arCloseModal(); lstDirty(); lstRender();
}

/* ---------- DAILY PLAN ---------- */
function lstShiftCode(id) { if (!id) return ''; if (/^BRK/i.test(id)) return 'B' + (+id.replace(/\D/g, '') || ''); return String(+id.replace(/\D/g, '') || id.slice(0, 2)); }
function lstShiftColor(id) { if (!id) return ''; if (lstIsBrk(id)) return '#fde68a'; const pal = ['#bfdbfe', '#bbf7d0', '#fecaca', '#e9d5ff', '#fed7aa', '#a5f3fc', '#fbcfe8', '#d9f99d', '#ddd6fe']; return pal[(+id.replace(/\D/g, '') || 0) % pal.length]; }
/* ---------- BABALA: double-booked na empleyado (magka-overlap na oras sa magkaibang row/role) ---------- */
function lstConflicts(S, day) {
  const by = {}; (day.rows || []).forEach((r, ri) => { const k = lstEmpKey(r); if (!k) return; lstRowSegs(S, r).forEach(g => { (by[k] = by[k] || []).push({ ri, role: r.role || '?', name: r.name || k, in: g.in, out: g.out, shift: g.shift }); }); });
  const out = []; Object.keys(by).forEach(k => { const a = by[k]; for (let i = 0; i < a.length; i++) for (let j = i + 1; j < a.length; j++) { if (a[i].in < a[j].out && a[j].in < a[i].out) { out.push({ name: a[i].name, from: Math.max(a[i].in, a[j].in), to: Math.min(a[i].out, a[j].out), roles: [...new Set([a[i].role, a[j].role])].join(' & ') }); return; } } });
  return out;
}
function lstConflictHtml(S, day) {
  const c = lstConflicts(S, day); if (!c.length) return '';
  return `<div style="background:#fef2f2;border:1px solid #fecaca;color:#991b1b;border-radius:8px;padding:.5rem .7rem;margin-bottom:.5rem;font-size:.82rem;">⚠️ <b>Double-booked</b> (magkapatong ang oras, nabibilang nang dalawang beses sa Actual HC):<br>${c.map(x => `• <b>${lstEsc(x.name)}</b> ${lst12(x.from % 1440)}–${lst12(x.to % 1440)} (${lstEsc(x.roles)})`).join('<br>')}</div>`;
}
function lstHtmlPlan() {
  const S = L.setup, d = L.day, day = L.plan.days[d], C = lstDayCalc(S, day, L.plan.fc, d), n = C.slots.length, emps = lstSiteEmps();
  const hdr = C.slots.map(t => `<th style="min-width:40px;font-size:.62rem;">${lstHM(t % 1440)}</th>`).join('');
  const numRow = (lbl, arr, f) => `<tr><td colspan="9" style="font-weight:700;white-space:nowrap;">${lbl}</td>${arr.map(v => `<td style="text-align:center;font-size:.7rem;">${f ? f(v) : (v || '')}</td>`).join('')}</tr>`;
  const roleOpts = sel => `<option value=""></option>` + S.roles.filter(r => r.name).map(r => `<option ${r.name === sel ? 'selected' : ''}>${lstEsc(r.name)}</option>`).join('');
  const shOpts = sel => `<option value=""></option>` + S.shifts.filter(r => r.name).map(r => `<option ${r.name === sel ? 'selected' : ''}>${lstEsc(r.name)}</option>`).join('');
  const roleLines = day.roles.map((l, li) => `<tr><td colspan="9" style="white-space:nowrap;"><select onchange="lstRoleLine(${li},this.value)" style="max-width:150px;">${roleOpts(l.role)}</select> <button class="btn btn-sm btn-secondary" onclick="lstFill(${li})" title="Itakda ang bilang sa saklaw ng oras">⚡</button> <button class="btn btn-sm btn-danger" onclick="lstRoleDel(${li})">✖</button></td>${C.slots.map((t, i) => `<td><input type="number" min="0" step="1" value="${(l.hc || [])[i] || ''}" style="width:36px;font-size:.7rem;padding:2px;text-align:center;" onchange="lstHc(${li},${i},this.value)"></td>`).join('')}</tr>`).join('');
  const dl = emps.map(e => `<option value="${lstEsc(e.nick + ' · ' + e.eid)}">${lstEsc(e.full)}</option>`).join('');
  const rows = day.rows.map((r, ri) => { const st = C.strips[ri] || []; const sg = [0, 1, 2].map(k => { const g = (r.segs || [])[k] || {}; return `<td><select onchange="lstSeg(${ri},${k},'shift',this.value)" style="max-width:96px;font-size:.72rem;">${shOpts(g.shift)}</select></td><td><input type="time" value="${g.in || ''}" onchange="lstSeg(${ri},${k},'in',this.value)" style="width:86px;font-size:.72rem;"></td><td><input type="time" value="${g.out || ''}" onchange="lstSeg(${ri},${k},'out',this.value)" style="width:86px;font-size:.72rem;"></td>`; }).join('');
    return `<tr class="lst-row" data-q="${lstEsc(((r.name || '') + ' ' + (r.eid || '') + ' ' + (r.role || '')).toLowerCase())}"><td><select onchange="lstRowSet(${ri},'role',this.value)" style="max-width:130px;font-size:.72rem;">${roleOpts(r.role)}</select></td><td><input list="lst-emps" value="${lstEsc(r.name || '')}" placeholder="Empleyado" style="width:110px;font-size:.72rem;" onchange="lstRowEmp(${ri},this.value)"></td>${sg}<td style="white-space:nowrap;"><button class="btn btn-sm btn-secondary" onclick="lstRowDup(${ri})" title="Idagdag ang parehong empleyado">＋</button><button class="btn btn-sm btn-danger" onclick="lstRowDel(${ri})">✖</button></td>${st.map(id => `<td style="text-align:center;font-size:.68rem;background:${lstShiftColor(id)};" title="${lstEsc(id)}">${lstShiftCode(id)}</td>`).join('')}</tr>`; }).join('');
  const roleNames = [...new Set(day.roles.map(l => l.role).concat(day.rows.map(r => r.role)).filter(Boolean))];
  const pva = roleNames.map(r => { const p = C.plan[r] || Array(n).fill(0), a = C.act[r] || Array(n).fill(0); return `<tr><td colspan="9" rowspan="1" style="font-weight:700;white-space:nowrap;">${lstEsc(r)} <small>PLAN</small></td>${p.map(v => `<td style="text-align:center;font-size:.7rem;">${v || ''}</td>`).join('')}</tr><tr><td colspan="9" style="white-space:nowrap;">${lstEsc(r)} <small>ACTUAL</small></td>${a.map((v, i) => `<td style="text-align:center;font-size:.7rem;font-weight:700;background:${v < p[i] ? '#fecaca' : v > p[i] ? '#fef3c7' : (v ? '#dcfce7' : '')};">${v || ''}</td>`).join('')}</tr>`; }).join('');
  const legend = S.shifts.filter(s => s.name).map(s => `<span style="display:inline-block;margin:1px 3px;padding:1px 6px;border-radius:4px;background:${lstShiftColor(s.id)};font-size:.7rem;">${lstShiftCode(s.id)} = ${lstEsc(s.name)}</span>`).join('');
  return `<datalist id="lst-emps">${dl}</datalist>
  <div style="display:flex;gap:.3rem;flex-wrap:wrap;margin-bottom:.5rem;">${LST_DAYS.map((x, k) => `<button class="btn btn-sm ${x === d ? 'btn-primary' : 'btn-secondary'}" onclick="L.day='${x}';lstRender()">${x}<br><small>${lstDayDate(L.week, k).slice(5)}</small></button>`).join('')}</div>
  <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:.5rem;margin-bottom:.6rem;">
   <div class="card" style="padding:.5rem;"><small>Forecast Sales</small><br><b>₱${Math.round(C.salesTot).toLocaleString()}</b></div><div class="card" style="padding:.5rem;"><small>Ideal HC (labor hrs)</small><br><b>${lstR1(C.idealHrs)}</b></div><div class="card" style="padding:.5rem;"><small>Actual HC (labor hrs)</small><br><b>${lstR1(C.actualHrs)}</b></div><div class="card" style="padding:.5rem;"><small>Ideal Productivity (₱/labor hr)</small><br><b>${Math.round(C.idealProd).toLocaleString()}</b></div><div class="card" style="padding:.5rem;"><small>Planned Productivity (₱/labor hr)</small><br><b>${Math.round(C.planProd).toLocaleString()}</b></div></div>
  <div style="display:flex;gap:.4rem;flex-wrap:wrap;margin-bottom:.4rem;"><button id="lst-save" class="btn btn-success" onclick="lstSavePlan()">💾 I-save</button><button class="btn btn-secondary btn-sm" onclick="lstCopyDay()">📑 Kopyahin ang araw na ito sa ibang araw</button><button class="btn btn-secondary btn-sm" onclick="lstCopyPrev()">⏮️ Kopyahin ang nakaraang linggo</button><button class="btn btn-danger btn-sm" onclick="lstClearDay()">🧹 I-clear ang araw</button><input type="search" placeholder="🔍 Hanapin ang empleyado/role..." oninput="lstPlanFilter(this.value)" style="min-width:200px;"></div>
  ${lstConflictHtml(S, day)}<div class="table-responsive"><table data-notools="1" style="font-size:.72rem;"><thead><tr><th colspan="9"></th>${hdr}</tr></thead><tbody>
   <tr><td colspan="${9 + n}" style="background:#f1f5f9;font-weight:700;">FORECAST</td></tr>${numRow('GC', C.gc)}${numRow('TC', C.tc)}${numRow('SALES ₱', C.sales, v => v ? Math.round(v).toLocaleString() : '')}
   <tr><td colspan="${9 + n}" style="background:#f1f5f9;font-weight:700;">LABOR PLAN</td></tr>${numRow('Ideal HC', C.ideal)}${numRow('Actual HC', C.actual)}${numRow('Ideal Productivity', C.idealSlotProd, v => v ? Math.round(v) : '')}${numRow('Planned Productivity', C.actSlotProd, v => v ? Math.round(v) : '')}
   <tr><td colspan="${9 + n}" style="background:#eff6ff;font-weight:700;">ROLE & HEADCOUNT PLANNING <button class="btn btn-sm btn-secondary" onclick="lstRoleAdd()">➕ Role</button></td></tr>${roleLines}
   <tr><td colspan="${9 + n}" style="background:#f0fdf4;font-weight:700;">MANPOWER ASSIGNMENT <button class="btn btn-sm btn-secondary" onclick="lstRowAdd()">➕ Empleyado</button> <small style="font-weight:400;">Role · Empleyado · hanggang 3 shift (Shift Type, In, Out)</small></td></tr>
   <tr style="font-size:.65rem;color:#64748b;"><td>Role</td><td>Empleyado</td>${[1, 2, 3].map(k => `<td>Shift ${k}</td><td>In</td><td>Out</td>`).join('').slice(0, 0)}<td colspan="7">Shift 1 / In / Out · Shift 2 / In / Out · Shift 3 / In / Out</td><td></td>${C.slots.map(() => '<td></td>').join('')}</tr>${rows}
   <tr><td colspan="${9 + n}" style="background:#fefce8;font-weight:700;">PLAN VS ACTUAL (pula = kulang, dilaw = sobra)</td></tr>${pva}</tbody></table></div>
  <div style="margin-top:.4rem;">${legend}</div>`;
}
function lstPlanFilter(q) { q = q.toLowerCase().trim(); document.querySelectorAll('#lst-body tr.lst-row').forEach(r => { r.style.display = !q || q.split(/\s+/).every(w => (r.dataset.q || '').includes(w)) ? '' : 'none'; }); }
const lstDay = () => L.plan.days[L.day];
function lstRoleAdd() { lstDay().roles.push({ role: '', hc: [] }); lstDirty(); lstRender(); }
function lstRoleLine(i, v) { lstDay().roles[i].role = v; lstDirty(); lstRender(); }
async function lstRoleDel(i) { lstDay().roles.splice(i, 1); lstDirty(); lstRender(); }
function lstHc(li, si, v) { const l = lstDay().roles[li]; l.hc = l.hc || []; l.hc[si] = v === '' ? 0 : Math.max(0, +v); lstDirty(); lstRender(); }
function lstFill(li) {
  const slots = lstSlots(L.setup); arModal(`<h3>⚡ Itakda ang headcount</h3><div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:.4rem;"><div><label>Mula</label><input type="time" id="lf-a" value="10:00"></div><div><label>Hanggang (hindi kasama)</label><input type="time" id="lf-b" value="22:00"></div><div><label>Bilang</label><input type="number" id="lf-n" min="0" value="1"></div></div><p style="font-size:.8rem;color:#64748b;">Ilalagay sa lahat ng 30-min slot sa saklaw.</p><button class="btn btn-success" onclick="lstFillGo(${li})">✅ Ilapat</button> <button class="btn btn-secondary" onclick="arCloseModal()">Kanselahin</button>`);
}
function lstFillGo(li) { const a = lstMin(document.getElementById('lf-a').value), b = lstMin(document.getElementById('lf-b').value), n = Math.max(0, +document.getElementById('lf-n').value || 0); if (a == null || b == null) { alert('Ilagay ang oras.'); return; } const l = lstDay().roles[li]; l.hc = l.hc || []; lstSlots(L.setup).forEach((t, i) => { const tt = b <= a && t < a ? t + 1440 : t, bb = b <= a ? b + 1440 : b; if (tt >= a && tt < bb) l.hc[i] = n; }); arCloseModal(); lstDirty(); lstRender(); }
function lstRowAdd() { lstDay().rows.push({ role: '', eid: '', name: '', segs: [{}, {}, {}] }); lstDirty(); lstRender(); }
function lstRowSet(i, f, v) { lstDay().rows[i][f] = v; lstDirty(); lstRender(); }
function lstRowDup(i) { const r = lstDay().rows[i]; lstDay().rows.splice(i + 1, 0, { role: r.role, eid: r.eid, name: r.name, segs: [{}, {}, {}] }); lstDirty(); lstRender(); }
async function lstRowDel(i) { lstDay().rows.splice(i, 1); lstDirty(); lstRender(); }
function lstRowEmp(i, v) { const r = lstDay().rows[i], t = String(v).trim(); const m = lstSiteEmps().find(e => `${e.nick} · ${e.eid}` === t || e.eid === t || e.nick.toLowerCase() === t.toLowerCase() || e.full.toLowerCase() === t.toLowerCase()); if (m) { r.eid = m.eid; r.name = m.nick; } else { r.eid = ''; r.name = t; } lstDirty(); lstRender(); }
function lstSeg(i, k, f, v) { const r = lstDay().rows[i]; r.segs = r.segs || [{}, {}, {}]; r.segs[k] = r.segs[k] || {}; r.segs[k][f] = v; lstDirty(); lstRender(); }
async function lstClearDay() { if (!await uiConfirm(`I-clear ang plan ng ${L.day}?`)) return; L.plan.days[L.day] = { roles: [], rows: [] }; lstDirty(); lstRender(); }
function lstCopyDay() { arModal(`<h3>📑 Kopyahin ang ${L.day}</h3><p style="font-size:.84rem;color:#64748b;">Papalitan ang plan ng mga napiling araw.</p>${LST_DAYS.filter(x => x !== L.day).map(x => `<label style="margin-right:.6rem;"><input type="checkbox" class="lcd" value="${x}"> ${x}</label>`).join('')}<br><br><button class="btn btn-success" onclick="lstCopyGo()">✅ Kopyahin</button> <button class="btn btn-secondary" onclick="arCloseModal()">Kanselahin</button>`); }
function lstCopyGo() { const src = JSON.stringify(L.plan.days[L.day]); document.querySelectorAll('.lcd:checked').forEach(c => { L.plan.days[c.value] = JSON.parse(src); }); arCloseModal(); lstDirty(); lstRender(); }
async function lstCopyPrev() {
  if (!await uiConfirm('Kopyahin ang plan (role, manning at forecast) ng nakaraang linggo? Papalitan nito ang kasalukuyang plan.')) return;
  const prev = lstDayDate(L.week, -7); try { const d = await db.collection('lst_weeks').doc(lstKey(prev)).get(); if (!d.exists) { alert('Walang plan ang nakaraang linggo (' + prev + ').'); return; } const p = d.data(); L.plan = Object.assign(lstNewPlan(L.week), p, { week: L.week }); lstDirty(); lstRender(); } catch (e) { alert('Error: ' + e.message); }
}

/* ---------- WEEKLY (WK_EMP, WK_DUTY, WK_SFT) ---------- */
function lstHtmlWeek() {
  const S = L.setup, P = L.plan, emps = lstPlanEmps(S, P), slots = lstSlots(S), selId = lstShiftId(S, L.shiftSel);
  const q = (L.q || '').toLowerCase(); const list = emps.filter(e => !q || (e.name + ' ' + e.eid).toLowerCase().includes(q));
  const f = x => x ? lstR1(x) : '';
  const tbl = list.map(e => { const D = LST_DAYS.map(d => lstEmpDay(S, P.days[d], e.key)); const sum = a => a.reduce((s, x) => s + (x || 0), 0);
    const io = D.map(x => x ? x.span : 0), bk = D.map(x => x ? x.brk : 0), sh = D.map(x => x ? x.spanOf(selId) : 0), du = D.map(x => x ? x.duty : 0);
    const rg = x => x ? `${lst12(x.first)} – ${lst12(x.last)}` : '';
    return `<tr><td rowspan="4" style="vertical-align:top;"><b>${lstEsc(e.name)}</b><br><small>${lstEsc(e.eid)}</small></td><td>In / Out</td>${io.map((v, i) => `<td title="${lstEsc(rg(D[i]))}">${f(v)}</td>`).join('')}<td><b>${f(sum(io))}</b></td></tr><tr><td>Break Hrs</td>${bk.map(v => `<td>${f(v)}</td>`).join('')}<td><b>${f(sum(bk))}</b></td></tr><tr><td>${lstEsc(L.shiftSel)}</td>${sh.map(v => `<td>${f(v)}</td>`).join('')}<td><b>${f(sum(sh))}</b></td></tr><tr style="background:#f0fdf4;"><td><b>Planned Duty</b></td>${du.map(v => `<td><b>${f(v)}</b></td>`).join('')}<td><b>${f(sum(du))}</b></td></tr>`; }).join('') || '<tr><td colspan="10" style="text-align:center;color:#94a3b8;">Wala pang naka-assign sa Daily Plan.</td></tr>';
  const board = slots.map(t => `<tr><td style="white-space:nowrap;">${lstHM(t % 1440)}–${lstHM((t + 30) % 1440)}</td>${LST_DAYS.map(d => { const names = []; (P.days[d].rows || []).forEach(r => { const k = lstEmpKey(r); if (!k || names.some(n => n.k === k)) return; const sg = lstRowSegs(S, r); const hit = sg.find(g => (t >= g.in && t < g.out) || (t + 1440 >= g.in && t + 1440 < g.out)); if (hit) names.push({ k, n: r.name || k, brk: lstIsBrk(hit.id) }); }); return `<td style="font-size:.7rem;">${names.map(x => x.brk ? `<i style="color:#b45309;">${lstEsc(x.n)}</i>` : lstEsc(x.n)).join(', ')}</td>`; }).join('')}</tr>`).join('');
  return `<div style="display:flex;gap:.4rem;flex-wrap:wrap;margin-bottom:.5rem;align-items:end;"><input type="search" placeholder="🔍 Hanapin ang empleyado..." value="${lstEsc(L.q)}" oninput="L.q=this.value;lstRender();var i=document.querySelector('#lst-body input[type=search]');i.focus();i.setSelectionRange(i.value.length,i.value.length)" style="min-width:200px;"><div><label style="font-size:.8rem;">Shift Type na ipapakita</label><br><select onchange="L.shiftSel=this.value;lstRender()">${S.shifts.filter(s => s.name).map(s => `<option ${s.name === L.shiftSel ? 'selected' : ''}>${lstEsc(s.name)}</option>`).join('')}</select></div><button class="btn btn-secondary btn-sm" onclick="lstPrint('wk')">🖨️ Print</button></div>
  <h4>Oras ng Empleyado at Planned Duty Hours</h4><div class="table-responsive" id="lst-wk"><table data-notools="1"><thead><tr><th>Empleyado</th><th></th>${LST_DAYS.map((d, k) => `<th>${d}<br><small>${lstDayDate(L.week, k).slice(5)}</small></th>`).join('')}<th>TOT</th></tr></thead><tbody>${tbl}</tbody></table></div>
  <h4 style="margin-top:.8rem;">Shift Board (sino ang naka-duty kada oras)</h4><div class="table-responsive"><table data-notools="1"><thead><tr><th>Oras</th>${LST_DAYS.map(d => `<th>${d}</th>`).join('')}</tr></thead><tbody>${board}</tbody></table></div><small style="color:#64748b;">Ang <i style="color:#b45309;">naka-italic</i> ay nasa break.</small>`;
}
function lstPrint(w) { const el = document.getElementById(w === 'wk' ? 'lst-wk' : 'lst-sch'); if (!el) return; const h = `<div class="pg"><h1>LST — ${lstEsc((L.sites.find(s => s.key === L.site) || {}).name || '')} · Linggo ng ${L.week}</h1><div class="meta">${typeof printedByLine === 'function' ? printedByLine() : ''}</div>${el.innerHTML}</div>`; if (typeof printHtmlDoc === 'function') printHtmlDoc('LST ' + L.week, h); else window.print(); }

/* ---------- SCHEDULE (For Sir Mark / Sprout / Attendance) ---------- */
function lstSchedRows() {
  const S = L.setup, P = L.plan, out = []; const eid = k => (lstPlanEmps(S, P).find(e => e.key === k) || {}).eid || '';
  lstPlanEmps(S, P).forEach(e => { const sc = lstSched(S, P, e.key); sc.forEach((s, k) => { const h = lstSchedHours(s); out.push({ key: e.key, eid: e.eid, name: e.name, k, date: lstDayDate(L.week, k), day: LST_DAYS[k], s, hrs: h.hrs, ot: h.ot }); }); });
  return out;
}
function lstHtmlSched() {
  const rows = lstSchedRows(), q = (L.q || '').toLowerCase(); const list = rows.filter(r => !q || (r.name + ' ' + r.eid).toLowerCase().includes(q));
  return `<div style="display:flex;gap:.4rem;flex-wrap:wrap;margin-bottom:.5rem;"><input type="search" placeholder="🔍 Hanapin ang empleyado..." value="${lstEsc(L.q)}" oninput="L.q=this.value;lstRender();var i=document.querySelector('#lst-body input[type=search]');i.focus();i.setSelectionRange(i.value.length,i.value.length)" style="min-width:200px;">
   <button class="btn btn-primary btn-sm" onclick="lstExportSprout()">📤 Sprout Upload (FOR New Bio)</button><button class="btn btn-secondary btn-sm" onclick="lstExportMark()">📄 For Sir Mark (.xlsx)</button><button class="btn btn-secondary btn-sm" onclick="lstPrint('sch')">🖨️ Print</button><button class="btn btn-success btn-sm" onclick="lstApplyAttendance()">📅 Ilapat sa Attendance Schedule</button></div>
  <small style="color:#64748b;">Galing sa Daily Plan: IN = pinakamaagang non-break, OUT B / IN B = Break1, OUT = pinakahuling labas. Walang assignment = Rest Day. Ang Employee ID ang ginagamit sa Sprout.</small>
  <div class="table-responsive" id="lst-sch"><table data-notools="1"><thead><tr><th>Employee ID</th><th>Empleyado</th><th>Day</th><th>Date</th><th>IN</th><th>OUT B</th><th>IN B</th><th>OUT</th><th>Rest Day</th><th>Hours</th><th>P_Hours</th></tr></thead><tbody>${list.map(r => `<tr style="${r.s.rest ? 'background:#f1f5f9;color:#94a3b8;' : ''}"><td>${lstEsc(r.eid)}</td><td>${lstEsc(r.name)}</td><td>${r.day}</td><td>${lstMDY(r.date)}</td><td>${r.s.rest ? '' : lst12(r.s.inM)}</td><td>${r.s.rest ? '' : lst12(r.s.outB)}</td><td>${r.s.rest ? '' : lst12(r.s.inB)}</td><td>${r.s.rest ? '' : lst12(r.s.outM)}</td><td>${r.s.rest ? 'YES' : 'NO'}</td><td>${r.hrs || 0}</td><td>${r.ot || 0}</td></tr>`).join('') || '<tr><td colspan="11" style="text-align:center;color:#94a3b8;">Wala pang plan.</td></tr>'}</tbody></table></div>`;
}
function lstSproutAoA() {
  const rows = [['Do not type Anything in this column', '*Required', '*Required (mm/dd/yyyy)', '*Required (hh:mm AM/PM)', '*Required (hh:mm AM/PM)', '*Required (hh:mm AM/PM)', '*Required (hh:mm AM/PM)', '*Required(Yes/No)', '', '', ''], ['Status After Upload', 'Employee ID No', 'Date', 'Time From', 'Time To', 'Break Start', 'Break End', 'Rest Day', '', 'Hours', 'P_Hours']]; const skipped = new Set();
  lstSchedRows().forEach(r => { if (!r.eid) { skipped.add(r.name); return; } const s = r.s; rows.push(s.rest ? ['', r.eid, lstMDY(r.date), '', '', '', '', 'YES', '', 0, 0] : ['', r.eid, lstMDY(r.date), lst12(s.inM), lst12(s.outM), lst12(s.outB), lst12(s.inB), 'NO', '', r.hrs, r.ot]); });
  return { rows, skipped: [...skipped] };
}
async function lstXlsx(sheets, file) { if (typeof sapXlsxLib === 'function') await sapXlsxLib(); const wb = XLSX.utils.book_new(); sheets.forEach(([n, a, w]) => { const ws = XLSX.utils.aoa_to_sheet(a); if (w) ws['!cols'] = w.map(x => ({ wch: x })); XLSX.utils.book_append_sheet(wb, ws, n); }); XLSX.writeFile(wb, file); }
async function lstExportSprout() { const { rows, skipped } = lstSproutAoA(); if (rows.length <= 2) { alert('Walang ma-e-export. Mag-assign muna sa Daily Plan (at lagyan ng Employee ID).'); return; } try { await lstXlsx([['FOR New Bio', rows, [22, 16, 14, 12, 12, 12, 12, 10, 3, 8, 8]]], `Sprout_Upload_${L.week}.xlsx`); alert(`✅ ${rows.length - 2} row ang na-generate.` + (skipped.length ? '\n\nWalang Employee ID (hindi isinama):\n' + skipped.slice(0, 10).join('\n') : '')); } catch (e) { alert('Error: ' + e.message); } }
async function lstExportMark() {
  const hd = ['Employee ID', 'Employee', '', '', 'Week Type', 'Date', 'IN', 'OUT B', 'IN B', 'OUT', 'Rest Day'], rows = [['', (L.sites.find(s => s.key === L.site) || {}).name || '', '', '', L.week], [], hd];
  lstSchedRows().forEach(r => rows.push([r.eid, r.name, '', '', r.day, lstMDY(r.date), r.s.rest ? '' : lst12(r.s.inM), r.s.rest ? '' : lst12(r.s.outB), r.s.rest ? '' : lst12(r.s.inB), r.s.rest ? '' : lst12(r.s.outM), r.s.rest ? 'YES' : 'NO']));
  try { await lstXlsx([['For Sir Mark', rows, [14, 20, 3, 3, 10, 12, 10, 10, 10, 10, 9]]], `LST_Schedule_${L.week}.xlsx`); } catch (e) { alert('Error: ' + e.message); }
}
async function lstApplyAttendance() {
  if (!await uiConfirm('Ilapat ang schedule ng linggong ito sa 📅 Attendance Schedule ng mga empleyado (ayon sa Employee ID)? Papalitan nito ang weekly schedule nila.')) return;
  try {
    const profs = {}; (await db.collection('attendance_profiles').get()).forEach(d => { const p = d.data(); if (p.employeeId) profs[String(p.employeeId).toLowerCase()] = p; });
    const S = L.setup, P = L.plan, batch = db.batch(), u = getCurrentUser() || {}; let n = 0; const miss = [];
    lstPlanEmps(S, P).forEach(e => { const p = profs[String(e.eid).toLowerCase()]; if (!e.eid || !p) { miss.push(e.name + (e.eid ? ' (' + e.eid + ')' : ' — walang ID')); return; }
      const week = lstSched(S, P, e.key).map(s => { if (s.rest) return { off: true }; const h = x => lstHM(x % 1440); return s.outB != null && s.inB != null && s.inM < s.outB && s.outB < s.inB && s.inB < s.outM ? { segs: [{ in: h(s.inM), out: h(s.outB) }, { in: h(s.inB), out: h(s.outM) }] } : { segs: [{ in: h(s.inM), out: h(s.outM) }] }; });
      batch.set(db.collection('attendance_weeks').doc(p.email + '__' + L.week), { email: p.email, week, weekStart: L.week, managerEmail: p.managerEmail || '', setBy: u.email || '', updatedAt: new Date().toISOString(), source: 'LST' }); n++; });
    await batch.commit(); alert(`✅ Na-apply sa ${n} empleyado.` + (miss.length ? '\n\nWalang Attendance profile (idagdag sa Attendance → Kunin ang mga empleyado at itakda ang Employee ID):\n' + miss.slice(0, 12).join('\n') : ''));
  } catch (e) { alert('Error: ' + e.message); }
}

/* ---------- LST vs BIO ---------- */
function lstBioOf(eidKey, k) { return ((L.bio.days[eidKey] || {})[LST_DAYS[k]]) || {}; }
function lstRateOf(e) { const r = (L.bio.rates || {})[e.key]; if (r != null && r !== '') return +r; const st = (L.setup.emps || {})[e.eid]; if (st && st.rate != null && st.rate !== '') return +st.rate; const h = L.hr.find(x => (x.empId || x.id) === e.eid); return (h && (+h.dailyRate || +h.rate)) || +L.setup.defRate || 0; }
function lstHtmlBio() {
  const S = L.setup, P = L.plan, emps = lstPlanEmps(S, P); if (!emps.length) return '<div style="color:#94a3b8;padding:1rem;">Wala pang naka-assign sa Daily Plan ng linggong ito.</div>';
  if (!emps.some(e => e.key === L.bioEmp)) L.bioEmp = emps[0].key; const cur = emps.find(e => e.key === L.bioEmp), sc = lstSched(S, P, cur.key), rate = lstRateOf(cur);
  const R = LST_DAYS.map((d, k) => lstBioCalc(S, sc[k], lstBioOf(cur.key, k), rate)); const ok = R.filter(r => r.present);
  const sum = f => lstR2(ok.reduce((s, r) => s + (r[f] || 0), 0)); const days = ok.length, rest = sc.filter((s, k) => s.rest && !R[k].present && !R[k].leave).length, absent = sc.filter((s, k) => !s.rest && !R[k].present && !R[k].leave).length, leave = R.filter(r => r.leave && !r.present).length, pay = lstR2(R.reduce((s, r) => s + (r.pay || 0), 0));
  const inp = (k, f) => { const b = lstBioOf(cur.key, k); return `<input value="${lstEsc(b[f] || '')}" placeholder="--:--" style="width:70px;font-size:.72rem;padding:2px;" onchange="lstBioSet('${lstEsc(cur.key)}',${k},'${f}',this.value)">`; };
  const chk = (k, f) => `<input type="checkbox" ${lstBioOf(cur.key, k)[f] ? 'checked' : ''} onchange="lstBioSet('${lstEsc(cur.key)}',${k},'${f}',this.checked)">`;
  const body = LST_DAYS.map((d, k) => { const s = sc[k], r = R[k]; return `<tr style="${s.rest && !r.present ? 'background:#f1f5f9;' : ''}"><td><b>${d}</b><br><small>${lstDayDate(L.week, k).slice(5)}</small></td><td style="white-space:nowrap;font-size:.7rem;">${s.rest ? 'REST' : `${lst12(s.inM)}<br>${s.outB != null ? lst12(s.outB) + '–' + lst12(s.inB) + '<br>' : ''}${lst12(s.outM)}`}</td><td>${inp(k, 'in')}</td><td>${inp(k, 'outB')}</td><td>${inp(k, 'inB')}</td><td>${inp(k, 'out')}</td><td>${chk(k, 'otIn')}</td><td>${chk(k, 'otOut')}</td><td>${chk(k, 'brkOT')}</td><td>${chk(k, 'special')}</td><td>${chk(k, 'legal')}</td><td>${chk(k, 'leave')}</td>
    <td>${r.present ? r.hrs : ''}</td><td>${r.present ? r.late : ''}</td><td>${r.present ? r.under : ''}</td><td>${r.present ? r.over : ''}</td><td>${r.present ? r.otMin : ''}</td><td>${r.present ? r.otPay : ''}</td><td>${r.present ? r.nd : ''}</td><td>${r.present ? r.ndPay : ''}</td><td>${r.present ? (r.spPay + r.lgPay) : ''}</td><td>${r.present ? r.tardPay : ''}</td><td><b>${r.pay ? r.pay : (!r.present && !s.rest && !r.leave ? '<span style="color:#dc2626;">ABSENT</span>' : '')}</b></td></tr>`; }).join('');
  return `<div style="display:flex;gap:.4rem;flex-wrap:wrap;align-items:end;margin-bottom:.5rem;"><div><label style="font-weight:700;">Empleyado</label><br><select onchange="L.bioEmp=this.value;lstRender()">${emps.map(e => `<option value="${lstEsc(e.key)}" ${e.key === L.bioEmp ? 'selected' : ''}>${lstEsc(e.name)} (${lstEsc(e.eid || '—')})</option>`).join('')}</select></div>
   <div><label style="font-weight:700;">Daily Rate ₱</label><br><input type="number" min="0" step="any" value="${rate}" style="width:100px;" onchange="lstBioRate('${lstEsc(cur.key)}',this.value)"></div>
   <button class="btn btn-success btn-sm" onclick="lstSaveBio()">💾 I-save ang Bio</button><button class="btn btn-secondary btn-sm" onclick="lstBioPull()">🪪 Kunin ang punch (Attendance)</button><button class="btn btn-secondary btn-sm" onclick="lstBioSummary()">📊 Buod ng lahat</button></div>
  <div class="table-responsive"><table data-notools="1" style="font-size:.72rem;"><thead><tr><th>Araw</th><th>LST</th><th>IN</th><th>OUT BRK</th><th>IN BRK</th><th>OUT</th><th title="OT IN may form">OT In</th><th title="OT OUT may form">OT Out</th><th>Break OT</th><th>Special Hol.</th><th>Legal Hol.</th><th title="VL/SL na may bayad">VL/SL</th><th>Hrs</th><th>Late min</th><th>Under min</th><th>Over-break min</th><th>OT min</th><th>OT ₱</th><th>ND hrs</th><th>ND ₱</th><th>Holiday ₱</th><th>Tardy ₱</th><th>Net ₱</th></tr></thead><tbody>${body}</tbody></table></div>
  <div style="display:flex;gap:.6rem;flex-wrap:wrap;margin-top:.5rem;font-size:.85rem;"><span>📅 Days work: <b>${days}</b></span><span>😴 Rest: <b>${rest}</b></span><span>🚫 Absent: <b>${absent}</b></span><span>🏖️ Paid leave: <b>${leave}</b></span><span>⏱️ Late: <b>${sum('late')}</b>m</span><span>Under: <b>${sum('under')}</b>m</span><span>OT: <b>${sum('otMin')}</b>m (₱${sum('otPay')})</span><span>ND: ₱${sum('ndPay')}</span><span style="font-weight:800;">Net basic: ₱${pay}</span></div>
  <small style="color:#64748b;">Format ng oras: 10:46 o 10:46:29 (24h). Sundin ang formula ng LSTvsBIO: late = pasok matapos ang LST; undertime = kulang sa oras na hindi over-break; OT in/out ay bibilangin lang kung may check (may form), sa bawat 30 min; ND = oras pagkatapos ng ${lstEsc(S.nightStart)}.</small>`;
}
function lstBioSet(key, k, f, v) { L.bio.days[key] = L.bio.days[key] || {}; const o = L.bio.days[key][LST_DAYS[k]] = L.bio.days[key][LST_DAYS[k]] || {}; if (typeof v === 'string') { v = v.trim(); if (v && lstMin(v) == null) { alert('Mali ang oras. Gamitin ang 10:46 o 10:46:29'); lstRender(); return; } } o[f] = v; lstRender(); }
function lstBioRate(key, v) { L.bio.rates = L.bio.rates || {}; L.bio.rates[key] = v === '' ? null : +v; lstRender(); }
async function lstBioPull() {
  try { const emps = lstPlanEmps(L.setup, L.plan); const profs = {}; (await db.collection('attendance_profiles').get()).forEach(d => { const p = d.data(); if (p.employeeId) profs[String(p.employeeId).toLowerCase()] = p; }); const logs = {}; (await db.collection('attendance_logs').get()).forEach(d => { const x = d.data(); logs[x.email + '|' + x.date] = x; }); let n = 0;
    emps.forEach(e => { const p = profs[String(e.eid).toLowerCase()]; if (!p) return; LST_DAYS.forEach((d, k) => { const lg = logs[p.email + '|' + lstDayDate(L.week, k)]; if (!lg || !(lg.punches || []).length) return; const ts = lg.punches.map(x => { const t = new Date(x.at); return lstHM(t.getHours() * 60 + t.getMinutes() + t.getSeconds() / 60); }); const o = (L.bio.days[e.key] = L.bio.days[e.key] || {})[d] = (L.bio.days[e.key][d] || {}); o.in = ts[0]; o.out = ts[ts.length - 1]; if (ts.length >= 4) { o.outB = ts[1]; o.inB = ts[2]; } n++; }); });
    lstToast(`✅ ${n} araw ang nakuha mula sa punch.`); lstRender(); } catch (e) { alert('Error: ' + e.message); }
}
function lstBioSummary() {
  const S = L.setup, P = L.plan, rows = lstPlanEmps(S, P).map(e => { const sc = lstSched(S, P, e.key), rate = lstRateOf(e), R = LST_DAYS.map((d, k) => lstBioCalc(S, sc[k], lstBioOf(e.key, k), rate)); const ok = R.filter(r => r.present), s = f => lstR2(ok.reduce((a, r) => a + (r[f] || 0), 0)); return { e, days: ok.length, absent: sc.filter((x, k) => !x.rest && !R[k].present && !R[k].leave).length, late: s('late'), under: s('under'), over: s('over'), ot: s('otPay'), nd: s('ndPay'), hol: lstR2(s('spPay') + s('lgPay')), pay: lstR2(R.reduce((a, r) => a + (r.pay || 0), 0)) }; });
  window.__lstSum = rows; arModal(`<h3>📊 Buod — Linggo ng ${L.week}</h3><div style="max-height:60vh;overflow:auto;"><table data-notools="1" style="font-size:.78rem;"><thead><tr><th>Empleyado</th><th>Days</th><th>Absent</th><th>Late m</th><th>Under m</th><th>OB m</th><th>OT ₱</th><th>ND ₱</th><th>Hol ₱</th><th>Net ₱</th></tr></thead><tbody>${rows.map(r => `<tr><td>${lstEsc(r.e.name)}<br><small>${lstEsc(r.e.eid)}</small></td><td>${r.days}</td><td>${r.absent}</td><td>${r.late}</td><td>${r.under}</td><td>${r.over}</td><td>${r.ot}</td><td>${r.nd}</td><td>${r.hol}</td><td><b>${r.pay}</b></td></tr>`).join('')}</tbody><tfoot><tr><td><b>TOTAL</b></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td><b>${lstR2(rows.reduce((a, r) => a + r.pay, 0))}</b></td></tr></tfoot></table></div><button class="btn btn-secondary" onclick="lstSumCSV()">📥 CSV</button>`);
}
function lstSumCSV() { const rows = window.__lstSum || [], h = 'Employee ID,Empleyado,Days,Absent,Late min,Undertime min,Overbreak min,OT PHP,ND PHP,Holiday PHP,Net PHP'; const t = [h].concat(rows.map(r => [r.e.eid, '"' + r.e.name + '"', r.days, r.absent, r.late, r.under, r.over, r.ot, r.nd, r.hol, r.pay].join(','))).join('\r\n') + '\r\n'; if (typeof downloadCSVFile === 'function') downloadCSVFile(t, `LST_Bio_Summary_${L.week}.csv`); }

/* ---------- IMPORT mula sa LST Excel ---------- */
function lstImportOpen() {
  arModal(`<h3>📥 I-import ang LST Excel</h3><p style="font-size:.84rem;color:#64748b;">Piliin ang file mo (hal. KT_SO3_LST.xlsx). Kukunin ang Shift Types, Roles at palayaw/Employee ID (_SetupSched, _SetupMan), Forecast (FC_LST) at ang plan ng MON–SUN. Papalitan ang plan ng linggong nasa screen (petsa mula sa MON sheet, kung meron).</p><input type="file" id="lst-xl" accept=".xlsx,.xls"><br><br><button class="btn btn-success" onclick="lstImportGo()">📥 I-import</button> <button class="btn btn-secondary" onclick="arCloseModal()">Kanselahin</button>`);
}
async function lstImportGo() {
  const f = (document.getElementById('lst-xl') || {}).files; if (!f || !f[0]) { alert('Pumili ng file.'); return; }
  try { if (typeof sapXlsxLib === 'function') await sapXlsxLib(); const wb = XLSX.read(await f[0].arrayBuffer(), { type: 'array' }); const r = lstImportWb(wb); arCloseModal(); lstDirty(); lstRender(); alert(r); } catch (e) { alert('Error: ' + e.message); }
}
function lstSheetRows(wb, name) { const ws = wb.Sheets[name]; return ws ? XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null }) : null; }
function lstImportWb(wb) {
  const S = L.setup, out = []; const nm = x => (x == null ? '' : String(x).trim());
  const ss = lstSheetRows(wb, '_SetupSched'); if (ss) { const sh = []; for (let i = 1; i < ss.length; i++) { const id = nm(ss[i][1]), name = nm(ss[i][2]); if (id && name) sh.push({ id, name }); } if (sh.length) { S.shifts = sh; out.push(sh.length + ' shift type'); } const tm = []; for (let i = 1; i < ss.length; i++) if (typeof ss[i][4] === 'number') tm.push(ss[i][4]); if (tm.length) { S.slotStart = lstHM(Math.round((tm[0] % 1) * 1440)); } }
  const sm = lstSheetRows(wb, '_SetupMan'); const byNick = {};
  if (sm) { const roles = [], seen = new Set(); for (let i = 1; i < sm.length; i++) { const id = nm(sm[i][1]), name = nm(sm[i][2]); if (id && name && !seen.has(name)) { seen.add(name); roles.push({ id, name }); } const nick = nm(sm[i][5]), map = nm(sm[i][6]); if (nick && map) { S.emps[map] = Object.assign(S.emps[map] || {}, { nick }); byNick[nick.toLowerCase()] = map; } } if (roles.length) { S.roles = roles; out.push(roles.length + ' role'); } out.push(Object.keys(byNick).length + ' palayaw/ID'); }
  const nick2eid = n => byNick[String(n || '').trim().toLowerCase()] || (lstSiteEmps().find(e => e.nick.toLowerCase() === String(n || '').trim().toLowerCase()) || {}).eid || '';
  const plan = lstNewPlan(L.week), fcs = lstSheetRows(wb, 'FC_LST'); const slotsN = 49;
  if (fcs) { [['gc', 4], ['tc', 13], ['sales', 22]].forEach(([k, r0]) => { for (let d = 0; d < 7; d++) { const row = fcs[r0 + d] || []; plan.fc[k][LST_DAYS[d]] = row.slice(3, 3 + slotsN).map(v => k === 'sales' ? Math.round((+v || 0) * 1000) : (+v || 0)); } }); out.push('forecast'); }
  let maxSlot = 0, daysDone = 0, unmatched = new Set();
  LST_DAYS.forEach((d, di) => { const rows = lstSheetRows(wb, d); if (!rows) return; const day = plan.days[d]; if (di === 0 && typeof (rows[3] || [])[1] === 'number') { const dt = new Date(Math.round(((rows[3][1]) - 25569) * 86400000)); L.week = lstMonday(`${dt.getUTCFullYear()}-${lstP2(dt.getUTCMonth() + 1)}-${lstP2(dt.getUTCDate())}`); plan.week = L.week; }
    for (let i = 14; i <= 32; i++) { const row = rows[i] || [], role = nm(row[1]); if (!role) continue; const hc = row.slice(14, 14 + slotsN).map(v => +v || 0); if (hc.some(v => v)) { day.roles.push({ role, hc }); hc.forEach((v, j) => { if (v) maxSlot = Math.max(maxSlot, j + 1); }); } }
    for (let i = 35; i <= 72; i++) { const row = rows[i] || [], role = nm(row[1]), name = nm(row[2]); if (!role && !name) continue; const segs = [4, 7, 10].map(c => { const sh = nm(row[c]), a = row[c + 1], b = row[c + 2]; return sh && typeof a === 'number' && typeof b === 'number' ? { shift: sh, in: lstHM(Math.round(a * 1440)), out: lstHM(Math.round(b * 1440)) } : {}; }); const eid = nick2eid(name); if (name && !eid) unmatched.add(name); day.rows.push({ role, eid, name, segs }); }
    if (day.roles.length || day.rows.length) daysDone++; });
  if (maxSlot > S.slotCount) S.slotCount = Math.min(49, maxSlot);
  L.plan = plan; out.push(daysDone + ' araw na plan'); lstSaveSetup();
  return '✅ Na-import: ' + out.join(', ') + '. Linggo: ' + L.week + '.\n\nI-click ang 💾 I-save sa Daily Plan para ma-save ang plan.' + (unmatched.size ? '\n\nWalang katugmang Employee ID (palayaw lang): ' + [...unmatched].slice(0, 12).join(', ') : '');
}
