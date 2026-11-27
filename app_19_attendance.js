


// ========================================================
// 🕒 ATTENDANCE & SCHEDULE  (parang Sprout)
// attendance_profiles/{email}: {email,name,branch,managerEmail,defaultWeek[7],graceMin}
// attendance_weeks/{email}__{monday}: {email,week[7]}        (null = gamitin ang default)
// attendance_logs/{email}__{date}: {email,date,month,managerEmail,punches:[{type,at,src}]}
// attendance_requests/{id}: {type:OB|OT|SchedAdj, email,date,from,to,segs,reason,status}
// Day = {off:true} | {segs:[{in:'10:00',out:'12:00'},{in:'15:00',out:'19:00'}]}
// ========================================================
const ATT_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
let attState = { tab: 'me', month: '', week: '', prof: null, logs: {}, weeks: {}, reqs: [], team: [], teamLogs: [], teamReqs: [], teamWeeks: {}, isMgr: false };
function attNow() { return new Date(); }
function attRoot() { return document.getElementById('att-root'); }
function attMe() { const u = getCurrentUser() || {}; return { email: String(u.email || '').toLowerCase(), name: u.name || u.email || '', role: normalizeRole(u.role), branch: u.branch || '' }; }
function attPad(n) { return String(n).padStart(2, '0'); }
function attISO(d) { return `${d.getFullYear()}-${attPad(d.getMonth() + 1)}-${attPad(d.getDate())}`; }
function attDate(iso) { const [y, m, d] = iso.split('-').map(Number); return new Date(y, m - 1, d); }
function attDow(iso) { return (attDate(iso).getDay() + 6) % 7; }
function attMonday(iso) { const d = attDate(iso); d.setDate(d.getDate() - attDow(iso)); return attISO(d); }
function attMin(t) { const m = /^(\d{1,2})(?::(\d{2}))?$/.exec(String(t || '').trim()); return m ? (+m[1]) * 60 + (+(m[2] || 0)) : null; }
function attHM(min) { return `${attPad(Math.floor(min / 60) % 24)}:${attPad(min % 60)}`; }
function attPunchMin(iso) { const d = new Date(iso); return d.getHours() * 60 + d.getMinutes(); }
let attPresets = {}; // name(lowercase) -> text
function attParseDay(txt, depth) {
  const t = String(txt || '').trim(); if (!t) return null; if (/^(off|rd|rest)/i.test(t)) return { off: true };
  if (!depth && attPresets[t.toLowerCase()]) return attParseDay(attPresets[t.toLowerCase()], 1);
  const segs = [];
  for (const part of t.split('/')) {
    const m = /^\s*([\d:]+)\s*-\s*([\d:]+)\s*(?:@\s*([\d:]+)\s*-\s*([\d:]+))?\s*$/.exec(part); if (!m) return null;
    const a = attMin(m[1]), b = attMin(m[2]); if (a == null || b == null || b <= a) return null;
    if (m[3]) { const c = attMin(m[3]), d = attMin(m[4]); if (c == null || d == null || !(a < c && c < d && d < b)) return null; segs.push({ in: attHM(a), out: attHM(c) }, { in: attHM(d), out: attHM(b) }); }
    else segs.push({ in: attHM(a), out: attHM(b) });
  }
  return segs.length ? { segs } : null;
}
function attDayTxt(d) { if (!d) return ''; if (d.off) return 'OFF'; const g = d.segs || []; if (g.length === 2) return `${g[0].in}-${g[1].out}@${g[0].out}-${g[1].in}`; return g.map(s => `${s.in}-${s.out}`).join('/'); }
function attDayMin(d) { return d && d.segs ? d.segs.reduce((n, s) => n + (attMin(s.out) - attMin(s.in)), 0) : 0; }
function attHrs(m) { return m ? (Math.round(m / 6) / 10) + 'h' : '—'; }
function attDayDesc(d) { if (!d) return 'Walang schedule'; if (d.off) return 'OFF (day off)'; const g = d.segs || []; if (!g.length) return 'Walang schedule'; return `${g[0].in} – ${g[g.length - 1].out}${g.length === 2 ? ` · break ${g[0].out}–${g[1].in}` : g.length > 2 ? ' · ' + g.map(x => x.in + '-' + x.out).join(' / ') : ''} · ${attHrs(attDayMin(d))}`; }
function attSegsFor(date) {
  const S = attState; const adj = S.reqs.concat(S.teamReqs || []).find(r => r.type === 'SchedAdj' && r.status === 'Approved' && r.date === date && r.email === S._cur);
  if (adj && adj.segs) return { segs: adj.segs, src: 'Adjusted' };
  const wk = (S.weeks[S._cur + '__' + attMonday(date)] || {}).week; const dow = attDow(date);
  const day = (wk && wk[dow]) || ((S.profCur && S.profCur.defaultWeek) || [])[dow];
  if (!day) return { segs: [], src: 'none' }; if (day.off) return { segs: [], off: true, src: 'off' };
  return { segs: day.segs || [], src: wk && wk[dow] ? 'week' : 'default' };
}
// kalkulahin ang isang araw
function attCompute(date, log, reqs, sched, grace) {
  const today = attISO(attNow()); const out = { date, segs: sched.segs, off: !!sched.off, ints: [], late: 0, under: 0, absent: false, otEarly: 0, otLate: 0, otPaid: 0, nsd: 0, worked: 0, ob: false, open: false, status: '' };
  const ob = reqs.find(r => r.type === 'OB' && r.status === 'Approved' && r.date === date);
  const lvReq = reqs.find(r => r.type === 'Leave' && r.status === 'Approved' && (r.days || []).some(x => x.date === date)); const lvDay = lvReq && lvReq.days.find(x => x.date === date); if (lvDay) out.leave = { paid: !!lvDay.paid, frac: +lvDay.frac || 1, type: lvReq.leaveType || '' };
  const punches = ((log && log.punches) || []).slice().sort((a, b) => String(a.at).localeCompare(String(b.at)));
  let cur = null;
  punches.forEach(p => { const m = attPunchMin(p.at); if (p.type === 'in') { if (cur == null) cur = m; } else if (cur != null) { if (m > cur) out.ints.push([cur, m]); cur = null; } });
  if (cur != null) { out.open = true; if (date === today) { const nm = attNow().getHours() * 60 + attNow().getMinutes(); if (nm > cur) out.ints.push([cur, nm]); } }
  if (ob) { const a = attMin(ob.from), b = attMin(ob.to); if (a != null && b != null && b > a) { out.ints.push([a, b]); out.ob = true; } }
  const ov = (a, b, c, d) => Math.max(0, Math.min(b, d) - Math.max(a, c));
  const segs = sched.segs.map(s => [attMin(s.in), attMin(s.out)]);
  segs.forEach(([a, b], k) => {
    const hit = out.ints.filter(([x, y]) => ov(x, y, a, b) > 0);
    if (!hit.length) { out.under += (date < today || (date === today && attNow().getHours() * 60 + attNow().getMinutes() >= b)) ? (b - a) : 0; return; }
    const first = Math.min(...hit.map(h => Math.max(h[0], a))), last = Math.max(...hit.map(h => Math.min(h[1], b)));
    out.late += Math.max(0, first - a - (k === 0 ? grace : 0)); if (!(date === today && out.open)) out.under += Math.max(0, b - last);
    out.worked += hit.reduce((s, h) => s + ov(h[0], h[1], a, b), 0);
  });
  if (segs.length) {
    const s0 = segs[0][0], sN = segs[segs.length - 1][1];
    out.ints.forEach(([x, y]) => { out.otEarly += ov(x, y, 0, s0); out.otLate += ov(x, y, sN, 24 * 60); });
  } else out.ints.forEach(([x, y]) => { out.otLate += (y - x); });
  const otr = reqs.filter(r => r.type === 'OT' && r.status === 'Approved' && r.date === date);
  otr.forEach(r => { const a = attMin(r.from), b = attMin(r.to); if (a == null || b == null) return; out.ints.forEach(([x, y]) => { out.otPaid += ov(x, y, a, b); }); });
  out.ints.forEach(([x, y]) => { out.nsd += ov(x, y, 22 * 60, 24 * 60) + ov(x, y, 0, 6 * 60); });
  const has = out.ints.length > 0;
  if (segs.length && !has && date < today) out.absent = true;
  out.status = out.off ? (has ? 'Off (pumasok)' : 'Off') : !segs.length ? (has ? 'Walang schedule' : '—') : out.absent ? 'Absent' : date > today ? '' : has ? (out.ob ? 'OB' : out.late ? 'Late' : 'Present') : 'Naghihintay';
  if (out.open && date < today) out.status += ' ⚠️ walang time-out';
  if (out.leave) { if (!has || out.leave.frac >= 1) { out.absent = false; if (!has) { out.under = 0; out.late = 0; } } out.status = 'Leave ' + (out.leave.paid ? '(w/ pay)' : '(no pay)') + (out.leave.frac < 1 ? ' ½' : '') + (has ? ' · pumasok' : ''); }
  out.sugg = Math.max(0, out.otEarly + out.otLate - out.otPaid);
  return out;
}
async function loadAttendance() {
  const root = attRoot(); if (!root || !db) return; const me = attMe(); const S = attState;
  root.innerHTML = '<div class="card">Kinukuha ang attendance...</div>';
  if (!S.month) S.month = attISO(attNow()).slice(0, 7); if (!S.week) S.week = attMonday(attISO(attNow()));
  try {
    try { const pz = await db.collection('system_settings').doc('attendance_presets').get(); attPresets = {}; ((pz.exists && pz.data().text) || '').split(/\r?\n/).forEach(l => { const m = /^\s*([^=]+?)\s*=\s*(.+?)\s*$/.exec(l); if (m) attPresets[m[1].toLowerCase()] = m[2]; }); } catch (e) {}
    const pd = await db.collection('attendance_profiles').doc(me.email).get(); S.prof = pd.exists ? pd.data() : null; S._cur = me.email; S.profCur = S.prof;
    const [lg, rq, wk] = await Promise.all([db.collection('attendance_logs').where('email', '==', me.email).get(), db.collection('attendance_requests').where('email', '==', me.email).get(), db.collection('attendance_weeks').where('email', '==', me.email).get()]);
    S.logs = {}; lg.forEach(d => { S.logs[d.data().date] = d.data(); }); S.reqs = []; rq.forEach(d => S.reqs.push({ id: d.id, ...d.data() })); S.weeks = {}; wk.forEach(d => S.weeks[d.id] = d.data());
    S.reqs.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
    try { const bd = await db.collection('leave_balances').doc(me.email).get(); S.bal = bd.exists ? bd.data() : null; } catch (e) { S.bal = null; } try { const dd = await db.collection('system_settings').doc('leave_defaults').get(); S.lvDef = dd.exists ? dd.data() : null; } catch (e) { S.lvDef = null; }
    const tq = me.role === 'admin' ? await db.collection('attendance_profiles').get() : await db.collection('attendance_profiles').where('managerEmail', '==', me.email).get();
    S.team = []; tq.forEach(d => S.team.push(d.data())); S.team = S.team.filter(p => p.email !== me.email || me.role === 'admin');
    S.isMgr = me.role === 'admin' || S.team.length > 0; if (!S.isMgr && (S.tab === 'team' || S.tab === 'sched')) S.tab = 'me';
    if (S.isMgr) { await attLoadTeamData(); }
    attRender();
  } catch (e) { root.innerHTML = `<div class="card" style="color:#dc2626;">Error: ${srchEsc(e.message)}</div>`; }
}
async function attLoadTeamData() {
  const me = attMe(), S = attState; const base = (c) => me.role === 'admin' ? db.collection(c).get() : db.collection(c).where('managerEmail', '==', me.email).get();
  const [lg, rq, wk] = await Promise.all([base('attendance_logs'), base('attendance_requests'), base('attendance_weeks')]);
  S.teamLogs = []; lg.forEach(d => S.teamLogs.push(d.data())); S.teamReqs = []; rq.forEach(d => S.teamReqs.push({ id: d.id, ...d.data() })); S.teamWeeks = {}; wk.forEach(d => S.teamWeeks[d.id] = d.data());
}
function attTabs() { const S = attState; const t = [['me', '👤 Attendance Ko']]; if (S.isMgr) t.push(['team', '👥 Team & Approvals'], ['sched', '📅 Schedule']); return `<div style="display:flex;gap:.4rem;flex-wrap:wrap;margin-bottom:.7rem;">${t.map(([k, l]) => `<button class="btn btn-sm ${S.tab === k ? 'btn-primary' : 'btn-secondary'}" onclick="attState.tab='${k}';attRender()">${l}${k === 'team' ? attPendingBadge() : ''}</button>`).join('')}</div>`; }
function attPendingBadge() { const n = attState.teamReqs.filter(r => r.status === 'Pending').length; return n ? ` <span style="background:#dc2626;color:#fff;border-radius:999px;padding:0 6px;font-size:.7rem;">${n}</span>` : ''; }
function attRender() { const S = attState; if (S.tab === 'team') return attRenderTeam(); if (S.tab === 'sched') { attRenderSched(); attSchedFilter(); return; } return attRenderMe(); }
function attMins(m) { if (!m) return '—'; const h = Math.floor(m / 60), r = m % 60; return h ? `${h}h ${r}m` : `${r}m`; }
function attDaysOfMonth(ym) { const [y, m] = ym.split('-').map(Number); const n = new Date(y, m, 0).getDate(); return Array.from({ length: n }, (_, i) => `${ym}-${attPad(i + 1)}`); }
function attMonthRows(email, prof, logs, reqs, weeks, ym) {
  const grace = (prof && +prof.graceMin) || 0; const cur = attState._cur, cp = attState.profCur;
  attState._cur = email; attState.profCur = prof; const prevW = attState.weeks, prevR = attState.reqs; attState.weeks = weeks; attState.reqs = reqs;
  const rows = attDaysOfMonth(ym).map(d => attCompute(d, logs[d], reqs.filter(r => r.date === d || (r.type === 'Leave' && (r.days || []).some(x => x.date === d))), attSegsFor(d), grace));
  attState._cur = cur; attState.profCur = cp; attState.weeks = prevW; attState.reqs = prevR; return rows;
}
function attSummary(rows) { const t = { present: 0, absent: 0, lateDays: 0, late: 0, under: 0, otPaid: 0, sugg: 0, nsd: 0, worked: 0, leavePaid: 0, leaveUnpaid: 0 }; rows.forEach(r => { if (r.leave) { if (r.leave.paid) t.leavePaid += r.leave.frac; else t.leaveUnpaid += r.leave.frac; } if (['Present', 'Late', 'OB'].includes(r.status.split(' ')[0]) || /^(Present|Late|OB)/.test(r.status)) t.present++; if (r.absent) t.absent++; if (r.late) { t.lateDays++; t.late += r.late; } t.under += r.under; t.otPaid += r.otPaid; t.sugg += r.sugg; t.nsd += r.nsd; t.worked += r.worked; }); return t; }
function attRenderMe() {
  const root = attRoot(), S = attState, me = attMe(); const today = attISO(attNow()); const log = S.logs[today];
  const sched = attSegsFor(today); const rows = attMonthRows(me.email, S.prof, S.logs, S.reqs, S.weeks, S.month); const T = attSummary(rows);
  const labs = sched.segs.length === 2 ? ['Time In', 'Break Out', 'Break In', 'Time Out'] : ['Time In', 'Time Out', 'Time In', 'Time Out'];
  const pun = ((log && log.punches) || []).map((p, i) => `${p.type === 'in' ? '🟢' : '🔴'} ${labs[i] || (p.type === 'in' ? 'In' : 'Out')} ${attHM(attPunchMin(p.at))}${p.src && p.src !== 'device' ? ' (' + p.src + ')' : ''}`).join(' · ') || 'Wala pang tap ngayon';
  const last = log && log.punches && log.punches.slice(-1)[0]; const nextType = last && last.type === 'in' ? 'out' : 'in';
  const field = S.prof && S.prof.fieldStaff;
  const body = rows.filter(r => r.date <= today || r.segs.length).map(r => `<tr><td>${r.date.slice(5)} <small>${ATT_DAYS[attDow(r.date)]}</small></td><td><small>${r.off ? 'OFF' : attDayDesc({ segs: r.segs }).replace(/ · [\d.]+h$/, '') || '—'}</small></td><td>${attHrs(r.segs.reduce((n, s) => n + attMin(s.out) - attMin(s.in), 0))}</td><td><small>${r.ints.map(([a, b]) => attHM(a) + '-' + attHM(b)).join(' / ') || '—'}</small></td><td>${r.late ? `<span style="color:#dc2626;">${r.late}m</span>` : '—'}</td><td>${r.under ? `<span style="color:#d97706;">${r.under}m</span>` : '—'}</td><td>${r.otPaid ? `<b style="color:#059669;">${r.otPaid}m</b>` : (r.sugg >= 15 ? `<span style="color:#7c3aed;" title="Smart suggestion">💡 ${r.sugg}m</span>` : '—')}</td><td>${srchEsc(r.status)}</td><td style="white-space:nowrap;"><button class="btn btn-sm btn-secondary" onclick="attOpenReq('OB','${r.date}')">OB</button> <button class="btn btn-sm btn-secondary" onclick="attOpenReq('OT','${r.date}',${r.sugg || 0})">OT</button> <button class="btn btn-sm btn-secondary" onclick="attOpenReq('SchedAdj','${r.date}')">Adj</button></td></tr>`).join('');
  const myReqs = S.reqs.slice(0, 15).map(r => `<tr><td>${srchEsc(r.type)}</td><td>${srchEsc(r.date)}</td><td>${srchEsc(r.type === 'Leave' ? attLeaveTxt(r) : r.type === 'SchedAdj' ? attDayTxt({ segs: r.segs }) : (r.from || '') + '-' + (r.to || ''))}</td><td>${srchEsc(r.reason || '')}${(r.photoIds || []).length ? ' 📷' : ''}</td><td>${r.status === 'Approved' ? '✅' : r.status === 'Rejected' ? '⛔' : r.status === 'Returned' ? '↩' : '⏳'} ${r.status}${r.note ? ' — ' + srchEsc(r.note) : ''}${r.status === 'Returned' ? ` <button class="btn btn-sm btn-primary" onclick="attOpenReq('${r.type}','${r.date}',0,'${r.id}')">✏️ I-edit at ipasa ulit</button>` : ''}</td></tr>`).join('') || '<tr><td colspan="5" style="color:#94a3b8;">Wala pang request.</td></tr>';
  root.innerHTML = `<div class="card"><div class="card-title"><span>🕒 Attendance Ko</span><span><button class="btn btn-success btn-sm" onclick="attLeaveOpen()">🏖️ Mag-file ng Leave</button> <button class="btn btn-secondary btn-sm" onclick="loadAttendance()">🔄</button></span></div>${attTabs()}
    ${S.prof ? '' : '<div style="background:#fffbeb;border:1px solid #fcd34d;padding:.5rem;border-radius:.4rem;margin-bottom:.6rem;">⚠️ Wala ka pang schedule. Makipag-ugnayan sa manager o HR.</div>'}
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:.8rem;margin-bottom:.8rem;">
      <div style="background:#f8fafc;border-radius:.5rem;padding:1rem;"><small>Ngayon · ${today} ${ATT_DAYS[attDow(today)]}</small>
        <div style="margin:.3rem 0;">Schedule: <b>${sched.off ? 'OFF (day off)' : attDayDesc({ segs: sched.segs })}</b>${sched.src === 'Adjusted' ? ' <small>(inayos)</small>' : ''}</div><div style="margin-bottom:.6rem;font-size:.85rem;">${pun}</div>
        ${field ? `<div style="font-size:.8rem;color:#0369a1;margin-bottom:.4rem;">📱 Field/Buyer — puwedeng mag-tap sa app</div><button class="btn ${nextType === 'in' ? 'btn-success' : 'btn-danger'}" style="width:100%;font-size:1.1rem;padding:.9rem;" onclick="attPunch()">${nextType === 'in' ? '🟢 TIME IN' : '🔴 TIME OUT'}</button>` : '<div style="font-size:.8rem;color:#64748b;">🪪 Mag-tap ng RFID card, tapos fingerprint sa terminal ng branch. Wala nang button dito. Kung wala ka sa branch, mag-file ng <b>OB</b> sa ibaba.</div>'}</div>
      <div style="background:#f8fafc;border-radius:.5rem;padding:1rem;"><div style="display:flex;justify-content:space-between;align-items:center;"><b>Buod ng buwan</b><input type="month" value="${S.month}" onchange="attState.month=this.value;attRender()"></div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:.3rem;margin-top:.5rem;font-size:.9rem;"><div>✅ Present: <b>${T.present}</b></div><div>❌ Absent: <b>${T.absent}</b></div><div>⏰ Late: <b>${T.lateDays}</b> (${attMins(T.late)})</div><div>↘ Undertime: <b>${attMins(T.under)}</b></div><div>➕ OT (approved): <b>${attMins(T.otPaid)}</b></div><div>🌙 Night diff: <b>${attMins(T.nsd)}</b></div><div>🏖️ Leave: <b>${T.leavePaid}</b> w/ pay · <b>${T.leaveUnpaid}</b> no pay</div></div></div></div>
    ${attLeaveBox()}
    ${T.sugg >= 15 ? `<div style="background:#f5f3ff;border:1px solid #c4b5fd;padding:.5rem;border-radius:.4rem;margin-bottom:.6rem;">💡 <b>Smart suggestion:</b> may ${attMins(T.sugg)} kang tap na labas sa schedule ngayong buwan na wala pang approved OT. I-click ang <b>OT</b> sa araw na iyon para i-file (si manager ang magpapasya; hindi bayad ang pagbibihis/prep).</div>` : ''}
    <div class="table-responsive"><table data-notools="1"><thead><tr><th>Petsa</th><th>Schedule</th><th>Oras</th><th>Actual</th><th>Late</th><th>UT</th><th>OT</th><th>Status</th><th>I-file</th></tr></thead><tbody>${body}</tbody></table></div>
    <h4 style="margin:1rem 0 .3rem;">Mga na-file ko</h4><div class="table-responsive"><table data-notools="1"><thead><tr><th>Uri</th><th>Petsa</th><th>Oras</th><th>Dahilan</th><th>Status</th></tr></thead><tbody>${myReqs}</tbody></table></div></div>`;
}

// Leave entitlement kada taon (HR). Blangko = default ng kumpanya. Nagre-reset kada Enero 1 (awtomatiko — binibilang lang ang nagamit sa kasalukuyang taon).
let lvBal = { orig: null, email: '' };
async function lvBalLoad(email) {
  const s = document.getElementById('hr-emp-sil'), l = document.getElementById('hr-emp-vl'), i = document.getElementById('hr-emp-bal-info'); lvBal = { orig: null, email: String(email || '').toLowerCase() }; if (s) s.value = ''; if (l) l.value = '';
  let def = {}; try { const dd = await db.collection('system_settings').doc('leave_defaults').get(); def = dd.exists ? dd.data() : {}; } catch (e) {}
  if (s) s.placeholder = 'default ' + (def.sil || 0); if (l) l.placeholder = 'default ' + (def.vl || 0);
  if (i) i.textContent = 'Blangko = default ng kumpanya. Nagre-reset kada Enero 1.';
  if (!lvBal.email) { if (i) i.textContent = 'Lagyan ng email ang empleyado para mag-apply ang sariling bilang. Nagre-reset kada Enero 1.'; return; }
  try { const d = await db.collection('leave_balances').doc(lvBal.email).get(); if (d.exists) { const x = d.data(); lvBal.orig = x; if (s && x.sil !== null && x.sil !== undefined) s.value = x.sil; if (l && x.vl !== null && x.vl !== undefined) l.value = x.vl; } } catch (e) {}
}
async function lvBalSave(email, name) {
  email = String(email || '').toLowerCase(); if (!email) return; const g = id => { const v = String((document.getElementById(id) || {}).value || '').trim(); return v === '' ? null : (parseFloat(v) || 0); }; const s = g('hr-emp-sil'), l = g('hr-emp-vl');
  const o = lvBal.orig || { sil: null, vl: null }; const same = (a, b) => (a === null || a === undefined ? null : +a) === b; if (same(o.sil, s) && same(o.vl, l)) return;
  const me = getCurrentUser() || {}, now = new Date().toISOString(), entry = { at: now, by: me.email || '', sil: s, vl: l, prevSil: o.sil === undefined ? null : o.sil, prevVl: o.vl === undefined ? null : o.vl };
  await db.collection('leave_balances').doc(email).set({ sil: s, vl: l, updatedBy: me.email || '', updatedAt: now, log: firebase.firestore.FieldValue.arrayUnion(entry) }, { merge: true });
  try { await logSystemAction('LEAVE_BALANCE', `${name || email}: SIL ${entry.prevSil === null ? 'default' : entry.prevSil}→${s === null ? 'default' : s}, VL ${entry.prevVl === null ? 'default' : entry.prevVl}→${l === null ? 'default' : l}`); } catch (e) {}
}
// Default ng kumpanya (lahat ng empleyado na walang sariling bilang)
async function lvDefOpen() {
  let d = {}; try { const x = await db.collection('system_settings').doc('leave_defaults').get(); d = x.exists ? x.data() : {}; } catch (e) {}
  arModal(`<h3>🏖️ Default Leave (kada taon)</h3><p style="font-size:.85rem;color:#64748b;">Ito ang taunang bilang ng leave w/ pay ng LAHAT ng empleyado, maliban sa mga may sariling bilang sa profile. <b>Awtomatikong nagre-reset tuwing Enero 1</b> — hindi na kailangang i-reset ni HR.</p>
  <div class="form-group"><label>Service Incentive Leave (SIL) — araw kada taon</label><input type="number" id="lvd-sil" step="0.5" min="0" value="${d.sil !== undefined ? d.sil : 5}"></div>
  <div class="form-group"><label>Vacation Leave (VL) — araw kada taon</label><input type="number" id="lvd-vl" step="0.5" min="0" value="${d.vl !== undefined ? d.vl : 0}"></div>
  <button class="btn btn-success" onclick="lvDefSave()">💾 I-save</button>${d.updatedBy ? `<p style="font-size:.75rem;color:#64748b;">Huling binago ni ${srchEsc(d.updatedBy)} · ${srchEsc(String(d.updatedAt || '').slice(0, 10))}</p>` : ''}`);
}
async function lvDefSave() {
  const sil = parseFloat(document.getElementById('lvd-sil').value) || 0, vl = parseFloat(document.getElementById('lvd-vl').value) || 0, me = getCurrentUser() || {};
  try { await db.collection('system_settings').doc('leave_defaults').set({ sil, vl, updatedBy: me.email || '', updatedAt: new Date().toISOString() }); try { await logSystemAction('LEAVE_DEFAULTS', `SIL ${sil}, VL ${sl} kada taon`); } catch (e) {} alert('✅ Na-save.'); arCloseModal(); } catch (e) { alert(e.message); }
}
/* ===================== 🏖️ LEAVE (SIL / Vacation) — balance galing sa HR; w/ pay hanggang balance lang, ang sobra ay w/o pay ===================== */
// Annual: kada Enero 1 nagre-reset. Entitlement = leave_balances/{email}.sil/.vl (kung may sariling set si HR) o ang default ng kumpanya (system_settings/leave_defaults {sil,sl}).
// Available (taon Y) = entitlement − may-bayad na araw (Pending/Approved) na ang petsa ay nasa taong Y.
const ATT_LV = { SIL: ['sil', 'Service Incentive Leave (SIL)'], VL: ['vl', 'Vacation Leave (VL)'] };
function attLeaveTxt(r) { const d = r.days || []; return `${attLvName(r.leaveType)} · ${d.length} araw (${d.filter(x => x.paid).reduce((s, x) => s + (+x.frac || 1), 0)} w/ pay · ${d.filter(x => !x.paid).reduce((s, x) => s + (+x.frac || 1), 0)} no pay): ` + d.map(x => x.date.slice(5) + (x.frac < 1 ? '½' : '') + (x.paid ? '✔' : '✖')).join(' '); }
function attLvName(t) { return (ATT_LV[t] || [0, t || 'Leave'])[1]; }
function attLeaveEnt(type, bal, def) { const key = (ATT_LV[type] || [''])[0]; if (bal && bal[key] !== undefined && bal[key] !== null && bal[key] !== '') return +bal[key] || 0; return def ? (+def[key] || 0) : 0; }
function attLeaveAvail(type, reqs, bal, excludeId, year, def) {
  year = String(year || new Date().getFullYear()); const ent = attLeaveEnt(type, bal, def); let used = 0;
  (reqs || []).forEach(r => { if (r.type !== 'Leave' || r.leaveType !== type || !['Pending', 'Approved'].includes(r.status) || r.id === excludeId) return; (r.days || []).forEach(x => { if (x.paid && String(x.date).slice(0, 4) === year) used += (+x.frac || 1); }); });
  return Math.max(0, Math.round((ent - used) * 100) / 100);
}
function attLeaveBox() { const S = attState, y = String(new Date().getFullYear()); const ent = t => attLeaveEnt(t, S.bal, S.lvDef); return `<div style="background:#f0fdf4;border:1px solid #86efac;padding:.5rem;border-radius:.4rem;margin-bottom:.6rem;font-size:.88rem;">🏖️ Natitirang leave w/ pay ngayong ${y}: <b>SIL ${attLeaveAvail('SIL', S.reqs, S.bal, null, y, S.lvDef)}</b>/${ent('SIL')} araw · <b>VL ${attLeaveAvail('VL', S.reqs, S.bal, null, y, S.lvDef)}</b>/${ent('VL')} araw <small style="color:#64748b;">(nagre-reset tuwing Enero 1)</small></div>`; }
let attLv = { days: [] };
function attLeaveOpen() {
  const t = attISO(attNow()); attLv = { days: [] };
  arModal(`<h3>🏖️ Mag-file ng Leave</h3>${attLeaveBox()}
  <div class="form-group"><label>Uri</label><select id="lv-type" onchange="attLeaveRecalc(true)">${Object.keys(ATT_LV).map(k => `<option value="${k}">${ATT_LV[k][1]}</option>`).join('')}</select></div>
  <div style="display:flex;gap:.5rem;flex-wrap:wrap;"><div class="form-group"><label>Mula</label><input type="date" id="lv-from" value="${t}"></div><div class="form-group"><label>Hanggang</label><input type="date" id="lv-to" value="${t}"></div><div class="form-group" style="align-self:end;"><button type="button" class="btn btn-secondary" onclick="attLeaveGen()">Ilista ang mga araw</button></div></div>
  <div id="lv-days"></div><div id="lv-sum" style="font-size:.85rem;margin:.4rem 0;"></div>
  <div class="form-group"><label>Dahilan</label><textarea id="lv-reason" rows="2" style="width:100%;"></textarea></div>
  <button type="button" class="btn btn-success" onclick="attLeaveSubmit()">📨 I-submit</button>`);
  attLeaveGen();
}
function attLeaveGen() {
  const a = (document.getElementById('lv-from') || {}).value, b = (document.getElementById('lv-to') || {}).value; if (!a || !b || b < a) { alert('Mali ang petsa.'); return; }
  const out = []; let d = new Date(a + 'T00:00:00'); const end = new Date(b + 'T00:00:00'); if ((end - d) / 864e5 > 30) { alert('Hanggang 31 araw lang kada file.'); return; }
  while (d <= end) { out.push({ date: attISO(d), frac: 1, paid: false }); d.setDate(d.getDate() + 1); }
  attLv.days = out; attLeaveRecalc(true);
}
// awtomatikong ilagay ang w/ pay sa mga unang araw hanggang maubos ang balance (puwedeng palitan ng empleyado)
function attLeaveRecalc(auto) {
  const S = attState, type = (document.getElementById('lv-type') || {}).value || 'SIL', left = {};
  if (auto) attLv.days.forEach(x => { const y = x.date.slice(0, 4); if (left[y] === undefined) left[y] = attLeaveAvail(type, S.reqs, S.bal, null, y, S.lvDef); if (x.frac <= left[y] + 1e-9) { x.paid = true; left[y] -= x.frac; } else x.paid = false; });
  attLeaveDraw();
}
function attLeaveOver(type) { const S = attState, by = {}; attLv.days.forEach(x => { if (x.paid) by[x.date.slice(0, 4)] = (by[x.date.slice(0, 4)] || 0) + x.frac; }); return Object.keys(by).filter(y => by[y] > attLeaveAvail(type, S.reqs, S.bal, null, y, S.lvDef) + 1e-9).map(y => y + ' (available ' + attLeaveAvail(type, S.reqs, S.bal, null, y, S.lvDef) + ')'); }
function attLeaveDraw() {
  const S = attState, type = (document.getElementById('lv-type') || {}).value || 'SIL', box = document.getElementById('lv-days'); if (!box) return;
  const paid = attLv.days.filter(x => x.paid).reduce((s, x) => s + x.frac, 0), unp = attLv.days.filter(x => !x.paid).reduce((s, x) => s + x.frac, 0), over = attLeaveOver(type);
  box.innerHTML = attLv.days.length ? `<table style="width:100%;font-size:.85rem;"><tbody>${attLv.days.map((x, i) => `<tr><td>${x.date.slice(5)} <small>${ATT_DAYS[attDow(x.date)]}</small></td><td><select onchange="attLv.days[${i}].frac=+this.value;attLeaveDraw()"><option value="1" ${x.frac === 1 ? 'selected' : ''}>Buong araw</option><option value="0.5" ${x.frac === 0.5 ? 'selected' : ''}>Half day</option></select></td><td><select onchange="attLv.days[${i}].paid=this.value==='1';attLeaveDraw()"><option value="1" ${x.paid ? 'selected' : ''}>With pay</option><option value="0" ${x.paid ? '' : 'selected'}>Without pay</option></select></td><td><button type="button" class="btn btn-secondary btn-sm" onclick="attLv.days.splice(${i},1);attLeaveDraw()">✖</button></td></tr>`).join('')}</tbody></table>` : '<small>Walang araw. Pindutin ang "Ilista ang mga araw".</small>';
  document.getElementById('lv-sum').innerHTML = `<b>${paid}</b> araw w/ pay · <b>${unp}</b> araw w/o pay${over.length ? ' <span style="color:#dc2626;">⛔ lampas sa natitirang leave: ' + over.join(', ') + ' — gawing Without pay ang iba</span>' : ''}`;
}
async function attLeaveSubmit() {
  const me = attMe(), S = attState, type = (document.getElementById('lv-type') || {}).value, reason = ((document.getElementById('lv-reason') || {}).value || '').trim(); if (!attLv.days.length) { alert('Walang araw na naka-file.'); return; } if (!reason) { alert('Ilagay ang dahilan.'); return; }
  const paid = attLv.days.filter(x => x.paid).reduce((s, x) => s + x.frac, 0), ov = attLeaveOver(type); if (ov.length) { alert('Lampas sa natitirang leave w/ pay: ' + ov.join(', ') + '. Gawing Without pay ang iba.'); return; }
  const dup = S.reqs.find(r => r.type === 'Leave' && ['Pending', 'Approved'].includes(r.status) && (r.days || []).some(x => attLv.days.some(y => y.date === x.date))); if (dup) { alert('May na-file ka nang leave sa isa sa mga petsang ito.'); return; }
  const days = attLv.days.slice().sort((a, b) => a.date.localeCompare(b.date)).map(x => ({ date: x.date, frac: x.frac, paid: !!x.paid }));
  if (!(S.prof && S.prof.managerEmail) && !(await uiConfirm('Wala kang naka-set na manager. Ipapadala ito sa HR/admin. Ituloy?'))) return;
  try {
    await db.collection('attendance_requests').add({ type: 'Leave', leaveType: type, date: days[0].date, days, paidDays: paid, unpaidDays: days.reduce((s, x) => s + x.frac, 0) - paid, reason, status: 'Pending', note: '', email: me.email, name: me.name, branch: me.branch, managerEmail: (S.prof && S.prof.managerEmail) || '', createdAt: new Date().toISOString(), photoIds: [] });
    notify([(S.prof && S.prof.managerEmail) || ''].filter(Boolean), `Bagong Leave request — ${me.name}`, `${me.name}: ${attLvName(type)} ${days[0].date}${days.length > 1 ? ' hanggang ' + days[days.length - 1].date : ''} (${paid} w/ pay, ${days.reduce((s, x) => s + x.frac, 0) - paid} w/o pay). Dahilan: ${reason}`);
    arCloseModal(); alert('✅ Na-submit ang leave. Hintayin ang approval.'); loadAttendance();
  } catch (e) { alert('Error: ' + e.message); }
}
async function attPunch() {
  const me = attMe(), S = attState; const now = attNow(); const date = attISO(now); const id = me.email + '__' + date; const ref = db.collection('attendance_logs').doc(id);
  try {
    let type = ''; let geo = null;
    if (S.prof && S.prof.fieldStaff && navigator.geolocation) { geo = await new Promise(res => { const t = setTimeout(() => res(null), 4000); navigator.geolocation.getCurrentPosition(p => { clearTimeout(t); res({ lat: +p.coords.latitude.toFixed(5), lng: +p.coords.longitude.toFixed(5) }); }, () => { clearTimeout(t); res(null); }, { timeout: 3500 }); }); }
    await db.runTransaction(async tx => {
      const snap = await tx.get(ref); const d = snap.exists ? snap.data() : { email: me.email, name: me.name, date, month: date.slice(0, 7), managerEmail: (S.prof && S.prof.managerEmail) || '', punches: [] };
      const last = d.punches[d.punches.length - 1];
      if (last && now - new Date(last.at) < 10000) throw new Error('Kaka-punch mo lang. Maghintay ng ilang segundo.');
      if (S.prof && S.prof.dept) d.dept = S.prof.dept;
      type = last && last.type === 'in' ? 'out' : 'in'; const pn = { type, at: now.toISOString(), src: S.prof && S.prof.fieldStaff ? 'app' : 'web' }; if (geo) pn.geo = geo; d.punches.push(pn); tx.set(ref, d);
    });
    try { logSystemAction('ATT_PUNCH', `${me.email} time-${type}`); } catch (e) {}
    await loadAttendance();
  } catch (e) { alert(e.message); }
}
function attOpenReq(type, date, sugg, editId) {
  const lab = { OB: 'Official Business (OB)', OT: 'Overtime (OT)', SchedAdj: 'Schedule Adjustment' }[type]; const sc = attSegsFor(date); const log = attState.logs[date]; const ed = editId ? attState.reqs.find(r => r.id === editId) : null;
  let a = ed ? (ed.from || '') : '', b = ed ? (ed.to || '') : '';
  if (!ed && type === 'OT' && log && log.punches.length) { const c = attCompute(date, log, attState.reqs.filter(r => r.date === date), sc, 0); if (c.otEarly >= c.otLate && c.ints.length) { a = attHM(c.ints[0][0]); b = sc.segs[0] ? sc.segs[0].in : ''; } else if (c.ints.length) { a = sc.segs.length ? sc.segs[sc.segs.length - 1].out : ''; b = attHM(c.ints[c.ints.length - 1][1]); } }
  const form = type === 'SchedAdj' ? `<div class="form-group"><label>Bagong schedule (hal. 11:00-20:00@15:00-16:00 = pasok-labas@simula ng break-balik)</label><input type="text" id="ar-segs" value="${srchEsc(ed ? attDayTxt({ segs: ed.segs }) : attDayTxt({ segs: sc.segs }))}"></div>` : `<div style="display:grid;grid-template-columns:1fr 1fr;gap:.6rem;"><div><label>Mula</label><input type="time" id="ar-from" value="${a}"></div><div><label>Hanggang</label><input type="time" id="ar-to" value="${b}"></div></div>${type === 'OT' ? `<div class="form-group"><label>Uri ng OT</label><select id="ar-ottype"><option ${ed && ed.otType === 'Normal OT' ? 'selected' : ''}>Normal OT</option><option ${ed && ed.otType === 'Early OT' ? 'selected' : ''}>Early OT</option></select></div>` : ''}${type === 'OB' ? '<small style="color:#64748b;">Isulat ang buong oras ng OB (hal. 06:00–11:00). Kapag na-approve, papasok ito sa actual time mo at mawawala ang late.</small>' : ''}`;
  arModal(`<h3>📝 ${lab} — ${date}</h3>${ed && ed.note ? `<div style="background:#fff7ed;border:1px solid #fdba74;padding:.4rem;border-radius:.4rem;margin-bottom:.5rem;">↩ Ibinalik ni manager: ${srchEsc(ed.note)}</div>` : ''}${form}<div class="form-group"><label>Dahilan / Destinasyon</label><textarea id="ar-reason" rows="3" style="width:100%;" placeholder="Hal: Pinabili ni manager / meeting sa supplier">${srchEsc(ed ? ed.reason : '')}</textarea></div><div class="form-group"><label>📷 Larawan (optional — hal. OB form na may pirma, hanggang 3)</label><input type="file" id="ar-photo" accept="image/*" multiple></div><button class="btn btn-success" onclick="attSubmitReq('${type}','${date}','${editId || ''}')">📤 ${ed ? 'Ipasa ulit' : 'I-submit'} kay manager</button>`);
}
async function attSubmitReq(type, date, editId) {
  const me = attMe(), S = attState; const reason = (document.getElementById('ar-reason') || {}).value.trim(); if (!reason) { alert('Ilagay ang dahilan.'); return; }
  const doc = { reason, status: 'Pending', note: '' };
  if (type === 'SchedAdj') { const d = attParseDay((document.getElementById('ar-segs') || {}).value); if (!d || !d.segs) { alert('Mali ang format. Hal: 11:00-20:00@15:00-16:00'); return; } doc.segs = d.segs; }
  else { doc.from = (document.getElementById('ar-from') || {}).value; doc.to = (document.getElementById('ar-to') || {}).value; if (!doc.from || !doc.to || attMin(doc.to) <= attMin(doc.from)) { alert('Ilagay ang tamang oras (Hanggang ay dapat mas huli).'); return; } if (type === 'OT') doc.otType = (document.getElementById('ar-ottype') || {}).value; }
  try {
    const files = [...(((document.getElementById('ar-photo') || {}).files) || [])].slice(0, 3); const ids = [];
    for (const f of files) { const id = 'AP-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); await db.collection('attendance_photos').doc(id).set({ dataUrl: await compressImageFile(f, 1000, 0.7), email: me.email, createdAt: new Date().toISOString() }); ids.push(id); }
    if (editId) { const old = S.reqs.find(r => r.id === editId) || {}; if (ids.length || (old.photoIds || []).length) doc.photoIds = (old.photoIds || []).concat(ids); doc.resubmittedAt = new Date().toISOString(); await db.collection('attendance_requests').doc(editId).update(doc); }
    else { if (!(S.prof && S.prof.managerEmail) && !await uiConfirm('Wala kang naka-set na manager. Ipapadala ito sa HR/admin. Ituloy?')) return; await db.collection('attendance_requests').add(Object.assign({ type, date, email: me.email, name: me.name, branch: me.branch, managerEmail: (S.prof && S.prof.managerEmail) || '', createdAt: new Date().toISOString(), photoIds: ids }, doc)); }
    notify([(S.prof && S.prof.managerEmail) || ''].filter(Boolean), `${editId ? 'Ipinasa ulit' : 'Bagong'} ${type} request — ${me.name}`, `${me.name} ay nag-file ng ${type} para sa ${date}. Dahilan: ${reason}`);
    arCloseModal(); alert('✅ Na-submit. Hintayin ang approval.'); loadAttendance();
  } catch (e) { alert('Error: ' + e.message); }
}
async function attPhotoHtml(ids) { const o = []; for (const id of (ids || [])) { try { const d = await db.collection('attendance_photos').doc(id).get(); if (d.exists) o.push(`<img src="${d.data().dataUrl}" style="max-width:100%;margin:.3rem 0;border-radius:.4rem;">`); } catch (e) {} } return o.join(''); }
async function attViewPhotos(id) { const r = attState.teamReqs.find(x => x.id === id) || attState.reqs.find(x => x.id === id); if (!r) return; arModal(`<h3>📷 ${srchEsc(r.type)} — ${srchEsc(r.name || '')} ${srchEsc(r.date)}</h3>` + (await attPhotoHtml(r.photoIds) || 'Walang larawan.')); }
function attRenderTeam() {
  const root = attRoot(), S = attState; const me = attMe(); const pend = S.teamReqs.filter(r => r.status === 'Pending').sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));
  const pr = pend.map(r => `<tr><td>${srchEsc(r.name)}</td><td><b>${srchEsc(r.type)}</b>${r.otType ? ' · ' + srchEsc(r.otType) : ''}</td><td>${srchEsc(r.date)}</td><td>${srchEsc(r.type === 'Leave' ? attLeaveTxt(r) : r.type === 'SchedAdj' ? attDayTxt({ segs: r.segs }) : r.from + '-' + r.to)}</td><td>${srchEsc(r.reason)}</td><td style="white-space:nowrap;">${(r.photoIds || []).length ? `<button class="btn btn-sm btn-secondary" onclick="attViewPhotos('${r.id}')">📷</button> ` : ''}<button class="btn btn-sm btn-success" title="Approve" onclick="attDecide('${r.id}',true)">✅</button> <button class="btn btn-sm btn-warning" title="Ibalik kay employee para ayusin" onclick="attReturn('${r.id}')">↩</button> <button class="btn btn-sm btn-danger" title="Reject" onclick="attDecide('${r.id}',false)">⛔</button></td></tr>`).join('') || '<tr><td colspan="6" style="color:#94a3b8;">Walang naghihintay.</td></tr>';
  const sum = S.team.map(p => { const logs = {}; S.teamLogs.filter(l => l.email === p.email).forEach(l => logs[l.date] = l); const wk = {}; Object.keys(S.teamWeeks).forEach(k => { if (k.startsWith(p.email + '__')) wk[k] = S.teamWeeks[k]; }); const reqs = S.teamReqs.filter(r => r.email === p.email); const rows = attMonthRows(p.email, p, logs, reqs, wk, S.month); return { p, T: attSummary(rows) }; });
  const body = sum.map(({ p, T }) => `<tr><td><b>${srchEsc(p.name || p.email)}</b><br><small>${srchEsc(p.email)}</small></td><td>${T.present}</td><td>${T.absent}</td><td>${T.lateDays} <small>(${attMins(T.late)})</small></td><td>${attMins(T.under)}</td><td>${attMins(T.otPaid)}</td><td>${attMins(T.nsd)}</td></tr>`).join('') || '<tr><td colspan="7" style="color:#94a3b8;">Wala pang team. Itakda ang manager sa 📅 Schedule.</td></tr>';
  root.innerHTML = `<div class="card"><div class="card-title"><span>👥 Team & Approvals</span><button class="btn btn-secondary btn-sm" onclick="loadAttendance()">🔄</button></div>${attTabs()}
    <h4>⏳ Naghihintay ng approval (${pend.length})</h4><div class="table-responsive"><table data-notools="1"><thead><tr><th>Empleyado</th><th>Uri</th><th>Petsa</th><th>Oras</th><th>Dahilan</th><th></th></tr></thead><tbody>${pr}</tbody></table></div>
    <div style="display:flex;gap:.5rem;align-items:center;margin:1rem 0 .4rem;"><h4 style="margin:0;">Buod ng team</h4><input type="month" value="${S.month}" onchange="attState.month=this.value;attRender()"><button class="btn btn-secondary btn-sm" onclick="attExportTeamCSV()">📤 CSV (payroll)</button></div>
    <div class="table-responsive"><table data-notools="1"><thead><tr><th>Empleyado</th><th>Present</th><th>Absent</th><th>Late</th><th>Undertime</th><th>OT (approved)</th><th>Night Diff</th></tr></thead><tbody>${body}</tbody></table></div></div>`;
}
async function attReturn(id) {
  const r = attState.teamReqs.find(x => x.id === id); if (!r) return; const me = attMe();
  if (me.role !== 'admin' && r.managerEmail !== me.email) { alert('Hindi mo ito empleyado/team.'); return; }
  const note = await uiPrompt('Ano ang dapat ayusin? (hal. mali ang oras / mali ang petsa)'); if (!note) return;
  try { await db.collection('attendance_requests').doc(id).update({ status: 'Returned', decidedBy: me.name, decidedAt: new Date().toISOString(), note }); notify([r.email], `Ibinalik ang ${r.type} request mo (${r.date})`, `${me.name}: ${note}. Buksan ang Attendance para i-edit at ipasa ulit.`); await loadAttendance(); attState.tab = 'team'; attRender(); } catch (e) { alert('Error: ' + e.message); }
}
// Team board marker: ilagay sa team_status ang approved Leave / OB (para makita ng ka-department kung sino ang wala). Walang dahilan/detalye.
async function attTeamStatusWrite(r) {
  if (!r || (r.type !== 'Leave' && r.type !== 'OB')) return;
  const p = (attState.team || []).find(x => x.email === r.email) || {}; const dept = p.dept || p.branch || ''; if (!dept) return;
  const days = r.type === 'Leave' ? (r.days || []).map(x => x.date) : [r.date];
  const batch = db.batch();
  days.filter(Boolean).forEach(d => batch.set(db.collection('team_status').doc(r.email + '__' + d), { email: r.email, name: r.name || p.name || r.email, dept, date: d, kind: r.type, leaveType: r.type === 'Leave' ? (r.leaveType || '') : '', updatedAt: new Date().toISOString() }));
  await batch.commit();
}
async function attDecide(id, ok) {
  const r = attState.teamReqs.find(x => x.id === id); if (!r) return; const me = attMe();
  if (me.role !== 'admin' && r.managerEmail !== me.email) { alert('Hindi mo ito empleyado/team.'); return; }
  let note = ''; if (!ok) { note = await uiPrompt('Dahilan ng pag-reject:'); if (!note) return; } else note = await uiPrompt('Komento (optional):') || '';
  try { await db.collection('attendance_requests').doc(id).update({ status: ok ? 'Approved' : 'Rejected', decidedBy: me.name, decidedAt: new Date().toISOString(), note }); if (ok) { try { await attTeamStatusWrite(r); } catch (e) { console.warn('team_status:', e.message); } } notify([r.email], `${r.type} request mo (${r.date}): ${ok ? 'APPROVED' : 'REJECTED'}`, `${me.name} ay ${ok ? 'nag-approve' : 'nag-reject'} ng ${r.type} request mo para sa ${r.date}.${note ? ' Komento: ' + note : ''}`); try { logSystemAction('ATT_REQ_DECISION', `${r.email} ${r.type} ${r.date}: ${ok ? 'approved' : 'rejected'}`); } catch (e) {} await loadAttendance(); attState.tab = 'team'; attRender(); } catch (e) { alert('Error: ' + e.message); }
}
function attTeamSummaryRows() {
  const S = attState; return S.team.map(p => { const logs = {}; S.teamLogs.filter(l => l.email === p.email).forEach(l => logs[l.date] = l); const wk = {}; Object.keys(S.teamWeeks).forEach(k => { if (k.startsWith(p.email + '__')) wk[k] = S.teamWeeks[k]; }); const rows = attMonthRows(p.email, p, logs, S.teamReqs.filter(r => r.email === p.email), wk, S.month); return { p, T: attSummary(rows), rows }; });
}
function attExportTeamCSV() {
  const L = [['Email', 'Name', 'Month', 'Days_Present', 'Days_Absent', 'Late_Days', 'Late_Minutes', 'Undertime_Minutes', 'OT_Approved_Minutes', 'Night_Diff_Minutes', 'Leave_Paid_Days', 'Leave_Unpaid_Days'].join(',')];
  attTeamSummaryRows().forEach(({ p, T }) => L.push([csvCell(p.email), csvCell(p.name), attState.month, T.present, T.absent, T.lateDays, T.late, T.under, T.otPaid, T.nsd, T.leavePaid, T.leaveUnpaid].join(',')));
  downloadCSVFile(L.join('\r\n'), 'Attendance_' + attState.month + '.csv');
}
// ---- Schedule editor (weekly) + bulk upload ----
function attRenderSched() {
  const root = attRoot(), S = attState, me = attMe(); const isDef = S.week === 'default';
  const rows = S.team.map((p, i) => { const wk = (S.teamWeeks[p.email + '__' + S.week] || {}).week || []; const def = p.defaultWeek || []; const days = isDef ? def : ATT_DAYS.map((d, k) => wk[k] || def[k]); const tot = days.reduce((n, d) => n + attDayMin(d), 0);
    return `<tr class="as-row" data-q="${srchEsc((String(p.name || '') + ' ' + p.email + ' ' + (p.employeeId || '') + ' ' + (p.cardNo || '') + ' ' + (p.branch || '')).toLowerCase())}"><td style="min-width:170px;"><b>${srchEsc(p.name || p.email)}</b><br><small>${srchEsc(p.email)}</small><br><input type="text" id="as-eid-${i}" value="${srchEsc(p.employeeId || '')}" placeholder="Employee ID" style="width:90px;font-size:.75rem;"> <input type="text" id="as-card-${i}" value="${srchEsc(p.cardNo || '')}" placeholder="RFID card #" style="width:90px;font-size:.75rem;">
      <br><label style="font-size:.72rem;" title="Buyer / field staff: puwedeng mag-tap sa app (walang biometrics)"><input type="checkbox" id="as-field-${i}" ${p.fieldStaff ? 'checked' : ''}> 📱 Field/Buyer</label>${me.role === 'admin' ? `<br><input type="email" id="as-mgr-${i}" value="${srchEsc(p.managerEmail || '')}" placeholder="manager email" style="width:170px;font-size:.75rem;">` : ''}</td>${ATT_DAYS.map((d, k) => `<td><input type="text" list="att-presets" id="as-${i}-${k}" value="${srchEsc(attDayTxt(isDef ? def[k] : wk[k]))}" placeholder="${srchEsc(isDef ? '' : attDayTxt(def[k]) || '—')}" style="width:150px;font-size:.78rem;"><div style="font-size:.7rem;color:#64748b;">${attDayDesc(isDef ? def[k] : (wk[k] || def[k])).split(' · ').slice(1).join(' · ')}</div></td>`).join('')}<td style="text-align:right;"><b>${attHrs(tot)}</b><br><small>/ linggo</small></td></tr>`; }).join('') || '<tr><td colspan="9" style="color:#94a3b8;">Wala pang empleyado sa team mo.</td></tr>';
  const presetOpts = Object.keys(attPresets).map(k => `<option value="${srchEsc(k)}">`).join('');
  root.innerHTML = `<div class="card"><div class="card-title"><span>📅 Schedule ng Team</span></div>${attTabs()}
    <p style="font-size:.85rem;color:#64748b;">Format ng bawat araw: <b>08:00-17:00@12:00-13:00</b> (pasok-labas@simula ng break-balik) · <b>10:00-12:00/15:00-19:00</b> (split shift) · <b>OFF</b> · o pangalan ng <b>Shift Preset</b>. Blangko = default. Ipinapakita sa gilid ang break at oras na bibilangin.</p>
    <datalist id="att-presets">${presetOpts}</datalist>
    <div style="display:flex;gap:.4rem;flex-wrap:wrap;align-items:end;margin-bottom:.4rem;"><input type="search" id="as-search" placeholder="🔍 Hanapin ang empleyado (pangalan, ID, email, branch)..." oninput="attSchedFilter()" style="min-width:260px;flex:1;"><small id="as-count" style="color:#64748b;"></small></div>
    <div style="display:flex;gap:.4rem;flex-wrap:wrap;align-items:end;margin-bottom:.6rem;"><div><label style="font-weight:700;">Linggo (Lunes)</label><br><input type="date" value="${isDef ? '' : S.week}" onchange="attState.week=attMonday(this.value);attRender()"></div>
      <button class="btn btn-sm ${isDef ? 'btn-primary' : 'btn-secondary'}" onclick="attState.week='${isDef ? attMonday(attISO(attNow())) : 'default'}';attRender()">${isDef ? '◀ Weekly' : '⚙️ Default na schedule'}</button>
      <button class="btn btn-primary btn-sm" onclick="attSproutExport()" title="Excel na kapareho ng upload template ng Sprout (FOR New Bio)">📤 Sprout Upload (.xlsx)</button><button class="btn btn-secondary btn-sm" onclick="attSchedTemplate()">📄 Template</button><button class="btn btn-secondary btn-sm" onclick="attSchedImport()">📥 Bulk upload schedule</button>
      ${me.role === 'admin' ? '<button class="btn btn-secondary btn-sm" onclick="attPresetEdit()">⏱️ Shift Presets</button><button class="btn btn-secondary btn-sm" onclick="attImportPunches()">🪪 I-import ang punch logs (device)</button><button class="btn btn-secondary btn-sm" onclick="attSyncEmployees()">🔄 Kunin ang mga empleyado (HR)</button>' : ''}<button class="btn btn-success" onclick="attSchedSave()">💾 I-save</button></div>
    <div class="table-responsive"><table data-notools="1"><thead><tr><th>Empleyado</th>${ATT_DAYS.map(d => `<th>${d}</th>`).join('')}<th>Oras</th></tr></thead><tbody>${rows}</tbody></table></div><small style="color:#64748b;">${isDef ? 'Default na schedule (Lunes–Linggo) na susundin kung walang weekly na schedule.' : 'Weekly schedule para sa linggong nagsisimula ' + S.week}</small></div>`;
}
async function attSchedSave() {
  const S = attState, me = attMe(); const isDef = S.week === 'default'; const batch = db.batch(); const now = new Date().toISOString(); const badCells = [];
  S.team.forEach((p, i) => {
    const week = ATT_DAYS.map((d, k) => { const v = (document.getElementById(`as-${i}-${k}`) || {}).value; const x = attParseDay(v); if (v && v.trim() && !x) badCells.push(`${p.name || p.email} ${d}: "${v}"`); return x; });
    const mg = document.getElementById('as-mgr-' + i); const mgr = mg ? mg.value.trim().toLowerCase() : (p.managerEmail || '');
    const fcb = document.getElementById('as-field-' + i); const field = fcb ? !!fcb.checked : !!p.fieldStaff;
    const eid = ((document.getElementById('as-eid-' + i) || {}).value || '').trim(), card = ((document.getElementById('as-card-' + i) || {}).value || '').trim();
    if (isDef || mgr !== (p.managerEmail || '') || field !== !!p.fieldStaff || eid !== (p.employeeId || '') || card !== (p.cardNo || '')) batch.set(db.collection('attendance_profiles').doc(p.email), Object.assign({}, p, { managerEmail: mgr, fieldStaff: field, employeeId: eid, cardNo: card, defaultWeek: isDef ? week : (p.defaultWeek || []), updatedBy: me.email }), { merge: true });
    if (!isDef && week.some(x => x)) batch.set(db.collection('attendance_weeks').doc(p.email + '__' + S.week), { email: p.email, week, weekStart: S.week, managerEmail: mgr, setBy: me.email, updatedAt: now });
    else if (!isDef) batch.delete(db.collection('attendance_weeks').doc(p.email + '__' + S.week));
  });
  if (badCells.length) { alert('May mali sa format, hindi pa na-save:\n' + badCells.slice(0, 8).join('\n')); return; }
  try { await batch.commit(); alert('✅ Na-save ang schedule.'); await loadAttendance(); attState.tab = 'sched'; attRender(); } catch (e) { alert('Error: ' + e.message); }
}
async function attPresetEdit() {
  const cur = Object.keys(attPresets).map(k => `${k} = ${attPresets[k]}`).join('\n');
  arModal(`<h3>⏱️ Shift Presets</h3><p style="font-size:.85rem;color:#64748b;">Isang linya bawat shift: <b>pangalan = pasok-labas@simula ng break-balik</b>. Hal:<br>HO 8-5 = 08:00-17:00@12:00-13:00<br>Branch Split = 10:00-12:00/15:00-19:00<br>Maaari mo itong gamitin sa grid at bulk upload sa halip na isulat ang oras.</p><textarea id="att-pre-ta" rows="8" style="width:100%;">${srchEsc(cur)}</textarea><button class="btn btn-success" onclick="attPresetSave()">💾 I-save</button>`);
}
async function attPresetSave() {
  const text = (document.getElementById('att-pre-ta') || {}).value || ''; const bad = text.split(/\r?\n/).filter(l => l.trim()).filter(l => { const m = /^\s*([^=]+?)\s*=\s*(.+?)\s*$/.exec(l); return !m || !attParseDay(m[2], 1); });
  if (bad.length) { alert('Mali ang format ng:\n' + bad.slice(0, 5).join('\n')); return; }
  try { await db.collection('system_settings').doc('attendance_presets').set({ text }); arCloseModal(); await loadAttendance(); attState.tab = 'sched'; attRender(); } catch (e) { alert('Error: ' + e.message); }
}
function attSchedTemplate() {
  const t = ['#GABAY: isang row bawat empleyado. Employee_ID (o Email) ang pagkakakilanlan. Time_In, Break_Start, Break_End, Time_Out = shift na ilalapat sa lahat ng araw MALIBAN sa Rest_Day (hal. Sun o Sat,Sun). Kung walang break, iwanang blangko ang Break.', '#Opsyonal: Mon..Sun = oras ng partikular na araw (OFF / 08:00-17:00@12:00-13:00 / pangalan ng preset) na papalit sa shift ng row. Week_Start = Lunes ng linggo (YYYY-MM-DD); blangko = ang napiling linggo sa screen. Burahin ang mga linyang nagsisimula sa #.', 'Employee_ID,Email,Week_Start,Time_In,Break_Start,Break_End,Time_Out,Rest_Day,Mon,Tue,Wed,Thu,Fri,Sat,Sun'];
  attState.team.forEach(p => t.push([csvCell(p.employeeId || ''), csvCell(p.email), attState.week === 'default' ? '' : attState.week, '08:00', '12:00', '13:00', '17:00', 'Sun', '', '', '', '', '', '', ''].join(',')));
  downloadCSVFile(t.join('\r\n') + '\r\n', 'Schedule_Template.csv');
}
function attRowWeek(r) {
  const DK = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']; let base = null;
  if (r.time_in && r.time_out) base = attParseDay(`${r.time_in}-${r.time_out}${r.break_start && r.break_end ? '@' + r.break_start + '-' + r.break_end : ''}`);
  const rest = String(r.rest_day || '').toLowerCase().split(/[,/ ]+/).filter(Boolean).map(x => x.slice(0, 3));
  return DK.map(k => { const v = String(r[k] || '').trim(); if (v) { const x = attParseDay(v); return x || undefined; } if (rest.includes(k)) return { off: true }; return base; });
}
async function attSchedImport() {
  const text0 = await pickCSVFile(); if (!text0) return; const text = text0.split(/\r?\n/).filter(l => !/^\s*"?#/.test(l)).join('\n'); const objs = csvToObjects(text); const S = attState, me = attMe();
  const byEmail = {}, byEid = {}; S.team.forEach(p => { byEmail[p.email] = p; if (p.employeeId) byEid[String(p.employeeId).toLowerCase()] = p; });
  let n = 0; const bad = []; const batch = db.batch();
  objs.forEach((r, i) => {
    const p = byEid[String(r.employee_id || '').trim().toLowerCase()] || byEmail[String(r.email || '').trim().toLowerCase()]; if (!p) { bad.push(`Row ${i + 1}: ${r.employee_id || r.email || '(walang ID)'} — hindi mo team / walang profile`); return; }
    const week = attRowWeek(r); if (week.includes(undefined)) { bad.push(`Row ${i + 1}: ${p.email} — mali ang oras sa isang araw`); return; } if (!week.some(x => x)) { bad.push(`Row ${i + 1}: ${p.email} — walang schedule`); return; }
    const ws = r.week_start ? attMonday(String(r.week_start).trim()) : (S.week === 'default' ? 'default' : S.week);
    if (ws === 'default') batch.set(db.collection('attendance_profiles').doc(p.email), Object.assign({}, p, { defaultWeek: week }), { merge: true });
    else batch.set(db.collection('attendance_weeks').doc(p.email + '__' + ws), { email: p.email, week, weekStart: ws, managerEmail: p.managerEmail || '', setBy: me.email, updatedAt: new Date().toISOString() });
    n++;
  });
  try { await batch.commit(); alert(`✅ Na-upload ang ${n} schedule.${bad.length ? '\n\nHindi isinama:\n' + bad.slice(0, 15).join('\n') : ''}`); await loadAttendance(); attState.tab = 'sched'; attRender(); } catch (e) { alert('Error: ' + e.message); }
}
// Punch logs mula sa terminal (RFID + fingerprint): CSV na may Employee_ID (o Card_No / Email) at DateTime
async function attImportPunches() {
  const text0 = await pickCSVFile(); if (!text0) return; const objs = csvToObjects(text0.split(/\r?\n/).filter(l => !/^\s*"?#/.test(l)).join('\n')); const S = attState;
  const by = {}; S.team.forEach(p => { [p.employeeId, p.cardNo, p.email].forEach(k => { if (k) by[String(k).toLowerCase()] = p; }); });
  const groups = {}, bad = [];
  objs.forEach((r, i) => { const key = String(r.employee_id || r.card_no || r.user_id || r.email || '').trim().toLowerCase(); const p = by[key]; const dt = new Date(String(r.datetime || r.date_time || r.timestamp || '').replace(/(\d{4}-\d\d-\d\d)\s+/, '$1T')); if (!p || isNaN(dt)) { bad.push(`Row ${i + 2}: ${key || '?'}`); return; } const iso = attISO(dt); (groups[p.email + '__' + iso] = groups[p.email + '__' + iso] || { p, iso, at: [] }).at.push(dt); });
  let n = 0; const batch = db.batch();
  for (const id of Object.keys(groups)) { const g = groups[id]; const ex = await db.collection('attendance_logs').doc(id).get(); const old = ex.exists ? ex.data().punches || [] : []; const all = old.map(p => ({ at: p.at, src: p.src || 'device' })).concat(g.at.map(d => ({ at: d.toISOString(), src: 'device' })));
    const seen = new Set(); const uniq = all.sort((a, b) => String(a.at).localeCompare(String(b.at))).filter(p => { const k = String(p.at).slice(0, 16); if (seen.has(k)) return false; seen.add(k); return true; }).map((p, i) => Object.assign(p, { type: i % 2 ? 'out' : 'in' }));
    batch.set(db.collection('attendance_logs').doc(id), { email: g.p.email, name: g.p.name || g.p.email, date: g.iso, month: g.iso.slice(0, 7), managerEmail: g.p.managerEmail || '', dept: g.p.dept || '', punches: uniq }, { merge: true }); n++; }
  try { await batch.commit(); alert(`✅ ${n} araw ng punch ang na-import.${bad.length ? '\n\nHindi nahanap:\n' + bad.slice(0, 12).join('\n') : ''}`); await loadAttendance(); } catch (e) { alert('Error: ' + e.message); }
}
// ===== Sprout upload (kapareho ng sheet na "FOR New Bio") =====
function attSchedFilter() {
  const q = ((document.getElementById('as-search') || {}).value || '').toLowerCase().trim(); let v = 0, t = 0;
  document.querySelectorAll('#att-root tr.as-row').forEach(r => { t++; const ok = !q || q.split(/\s+/).every(w => (r.dataset.q || '').includes(w)); r.style.display = ok ? '' : 'none'; if (ok) v++; });
  const c = document.getElementById('as-count'); if (c) c.textContent = q ? `${v} / ${t}` : `${t} empleyado`;
}
function att12(hm) { const m = attMin(hm); if (m == null) return ''; const h = Math.floor(m / 60) % 24; return `${attPad(h % 12 === 0 ? 12 : h % 12)}:${attPad(m % 60)} ${h < 12 ? 'AM' : 'PM'}`; }
function attSproutRows(week, team, weeks) {
  const rows = [['Do not type Anything in this column', '*Required', '*Required (mm/dd/yyyy)', '*Required (hh:mm AM/PM)', '*Required (hh:mm AM/PM)', '*Required (hh:mm AM/PM)', '*Required (hh:mm AM/PM)', '*Required(Yes/No)', '', '', ''], ['Status After Upload', 'Employee ID No', 'Date', 'Time From', 'Time To', 'Break Start', 'Break End', 'Rest Day', '', 'Hours', 'P_Hours']];
  const skipped = [];
  team.forEach(p => {
    if (!p.employeeId) { skipped.push(`${p.name || p.email}: walang Employee ID`); return; }
    const wk = (weeks[p.email + '__' + week] || {}).week || [], def = p.defaultWeek || [];
    for (let k = 0; k < 7; k++) {
      const d = wk[k] || def[k]; if (!d) continue; const dt = attDate(week); dt.setDate(dt.getDate() + k); const ds = `${attPad(dt.getMonth() + 1)}/${attPad(dt.getDate())}/${dt.getFullYear()}`;
      if (d.off) { rows.push(['', p.employeeId, ds, '', '', '', '', 'YES', '', 0, 0]); continue; }
      const g = d.segs || []; if (!g.length) continue; const first = g[0].in, last = g[g.length - 1].out; const brk = g.length > 1 ? [g[0].out, g[1].in] : ['', ''];
      const mins = attMin(last) - attMin(first) - (g.length > 1 ? attMin(g[1].in) - attMin(g[0].out) : 0), hrs = Math.round(mins / 6) / 10;
      rows.push(['', p.employeeId, ds, att12(first), att12(last), brk[0] ? att12(brk[0]) : '', brk[1] ? att12(brk[1]) : '', 'NO', '', hrs, Math.max(0, Math.round((hrs - 8) * 10) / 10)]);
    }
  });
  return { rows, skipped };
}
async function attSproutExport() {
  const S = attState; if (S.week === 'default') { alert('Pumili muna ng linggo (i-click ang "◀ Weekly" at itakda ang Lunes). Ang Sprout upload ay may petsa bawat araw.'); return; }
  const vis = new Set([...document.querySelectorAll('#att-root tr.as-row')].map((r, i) => r.style.display === 'none' ? -1 : i)); const team = S.team.filter((p, i) => vis.has(i));
  const { rows, skipped } = attSproutRows(S.week, team, S.teamWeeks);
  if (rows.length <= 2) { alert('Walang schedule na ma-e-export para sa linggong ito.' + (skipped.length ? '\n\n' + skipped.slice(0, 8).join('\n') : '')); return; }
  try { await sapXlsxLib(); const ws = XLSX.utils.aoa_to_sheet(rows); ws['!cols'] = [{ wch: 22 }, { wch: 16 }, { wch: 14 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 10 }, { wch: 3 }, { wch: 8 }, { wch: 8 }]; const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'FOR New Bio'); XLSX.writeFile(wb, `Sprout_Upload_${S.week}.xlsx`);
    alert(`✅ Na-generate: ${rows.length - 2} araw para sa ${team.length - skipped.length} empleyado.` + (skipped.length ? '\n\nHindi isinama:\n' + skipped.slice(0, 10).join('\n') : '')); } catch (e) { alert('Error: ' + e.message); }
}
async function attSyncEmployees() {
  const snap = await db.collection('employees').get(); const batch = db.batch(); let n = 0;
  snap.forEach(d => { const e = d.data(); const em = String(e.email || '').trim().toLowerCase() || ('emp-' + String(e.empId || d.id).trim().toLowerCase().replace(/[^a-z0-9]+/g, '-') + '@noemail.local'); if (e.status && e.status !== 'Active') return; const old = attState.team.find(p => p.email === em) || {}; batch.set(db.collection('attendance_profiles').doc(em), { email: em, name: e.name || em, branch: e.dept || '', dept: e.dept || '', employeeId: old.employeeId || e.empId || d.id, managerEmail: old.managerEmail || '', graceMin: 0 }, { merge: true }); n++; });
  await batch.commit(); alert(`✅ ${n} empleyado ang nai-sync (pati walang email). Itakda ang manager at Employee ID / Biometric ID sa bawat row.`); await loadAttendance(); attState.tab = 'sched'; attRender();
}

// ---- SAP B1 Item Master parser (galing sa PDF/text o CSV) ----
const SAP_HEADERS = ['Item No.', 'Item Description', 'In Stock', 'Purchasing UoM', 'Item Group', 'Active', 'No. of Items per Purchase Unit', 'No. of Items per Sales Unit', 'Last Purchase Price', 'Last Purchase Date', 'Inventory UoM', 'Date of Update'];
function sapNum(s) { const n = parseFloat(String(s == null ? '' : s).replace(/,/g, '')); return isNaN(n) ? 0 : n; }
function sapIsDate(t) { return /^\d{1,2}[./]\d{1,2}[./]\d{2,4}$/.test(t || ''); }
function sapDateISO(t) {
  const m = /^(\d{1,2})[./](\d{1,2})[./](\d{2,4})$/.exec(String(t || '').trim()); if (!m) return '';
  let y = +m[3]; if (y < 100) y += 2000; if (y < 1990) return ''; // 12/30/1899 = blangko ng SAP
  return `${y}-${String(m[1]).padStart(2, '0')}-${String(m[2]).padStart(2, '0')}`;
}
function sapFixGroup(g) { g = String(g || '').trim().replace(/\s+/g, ' '); return g === 'S-CLEANING SUPPLIE' ? 'S-CLEANING SUPPLIES' : g; }
// Whole:Loose — "No. of Items per Purchase Unit" ang laman ng 1 whole (hal. 1 CSE = 24 pcs). Kung 1:1 sa SAP pero may (24/CSE) sa pangalan, mungkahi lang ito.
function sapEnrich(r) {
  const same = (a, b) => a && b && String(a).trim().toUpperCase()[0] === String(b).trim().toUpperCase()[0];
  r.conv = r.perPurchase > 1 ? r.perPurchase : 1; r.convSrc = r.perPurchase > 1 ? 'SAP' : 'default'; r.convSuggest = 0;
  if (r.perPurchase <= 1 && !/^(PC|PCS|PIECE|PIECES)$/i.test(r.purchUom || '')) {
    const m = /\((\d{1,3})\s*(?:PCS?|PIECES?)?\s*\/\s*(CASE|CSE|BOX|BX|CTN|CARTON|TRAY|PACK|PCK|SACK|SK|BAG|BTL|DOZEN)\b/i.exec(r.itemName || '');
    if (m && +m[1] > 1 && same(m[2], r.purchUom)) { r.convSuggest = +m[1]; r.conv = +m[1]; r.convSrc = 'description'; }
  }
  r.wholeUOM = r.purchUom || r.invUom || 'PC';
  r.looseUOM = r.conv > 1 ? ((r.invUom && r.invUom.toUpperCase() !== String(r.purchUom).toUpperCase()) ? r.invUom : 'PC') : (r.invUom || r.purchUom || 'PC');
  return r;
}
function sapParseText(raw) {
  let t = String(raw || '').replace(/\r/g, ' ').replace(/\n/g, ' ');
  t = t.replace(/Item No\.\s*Item Description\s*In Stock\s*Purchasing UoM\s*Item Group\s*Active\s*No\. of Items per Purchase Unit\s*No\. of Items per Sales Unit\s*Last Purchase Price\s*Last Purchase Date\s*Inventory UoM\s*Date of Update/gi, ' ').replace(/\b12\/30\/1899\b/g, ' ').replace(/\s+/g, ' ');
  const starts = []; const re = /(?:^|\s)([A-Z]{2}\d{6})(?=\s)/g; let m;
  while ((m = re.exec(t))) starts.push({ code: m[1], at: m.index + m[0].length - m[1].length });
  const rows = [], bad = [], seen = {};
  starts.forEach((s, i) => {
    const seg = t.slice(s.at, i + 1 < starts.length ? starts[i + 1].at : t.length).trim();
    const body = seg.slice(s.code.length).trim();
    const a = /^(.*?)\s*(Yes|No)\s+([\d.]+)\s+([\d.]+)\s+(-?[\d,]*\.?\d+)(.*)$/.exec(body);
    if (!a) { bad.push(seg.slice(0, 80)); return; }
    const pre = a[1], tail = a[6].trim().split(/\s+/).filter(Boolean);
    const b = /^(.*?)(?:\s|(?<=[)\w]))(-?[\d,]*\.?\d+)(?:\s+(\S+))?\s+((?:[A-Z]\s?-\s?[A-Za-z0-9\/&. ]*?|Items)\s*)$/.exec(pre + ' ');
    if (!b) { bad.push(seg.slice(0, 80)); return; }
    let purchDate = '', upd = '', invUom = '';
    if (tail.length && sapIsDate(tail[0])) purchDate = tail.shift();
    if (tail.length && sapIsDate(tail[tail.length - 1])) upd = tail.pop();
    invUom = tail.join(' '); if (/^manual$/i.test(invUom)) invUom = '';
    const r = { itemCode: s.code, itemName: b[1].trim(), inStock: sapNum(b[2]), purchUom: b[3] || '', itemGroup: sapFixGroup(b[4]), active: a[2] === 'Yes', perPurchase: sapNum(a[3]), perSales: sapNum(a[4]), lastPrice: sapNum(a[5]), lastPurchaseDate: sapDateISO(purchDate), invUom, updateDate: sapDateISO(upd) };
    const stamp = x => (x.lastPurchaseDate > x.updateDate ? x.lastPurchaseDate : x.updateDate) || '';
    if (seen[s.code] != null) { const old = rows[seen[s.code]]; if (stamp(r) >= stamp(old)) rows[seen[s.code]] = r; return; } // pinakabagong petsa ang panalo
    seen[s.code] = rows.length; rows.push(r);
  });
  rows.forEach(sapEnrich);
  return { rows, bad };
}

// ---- SAP Item Master (kada company): import PDF/TXT/CSV, export sa SAP format ----
// sap_items/{companySlug}__{ItemNo}
let sapState = { company: '', companies: [], items: [], q: '', group: '', preview: null };
function sapRoot() { return document.getElementById('sap-root'); }
async function loadSapItems() {
  const root = sapRoot(); if (!root || !db) return;
  try {
    if (!sapState.companies.length) { const c = await db.collection('companies').get(); c.forEach(d => sapState.companies.push(d.data().name || d.id)); sapState.companies.sort(); }
    if (!sapState.company) sapState.company = sapState.companies[0] || '';
    sapState.items = [];
    if (sapState.company) { const s = await db.collection('sap_items').where('company', '==', sapState.company).get(); s.forEach(d => sapState.items.push({ id: d.id, ...d.data() })); sapState.items.sort((a, b) => String(a.itemCode).localeCompare(String(b.itemCode))); }
    sapRender();
  } catch (e) { root.innerHTML = `<div class="card" style="color:#dc2626;">Error: ${srchEsc(e.message)}</div>`; }
}
function sapFiltered() { const S = sapState; return S.items.filter(i => (!S.group || i.itemGroup === S.group) && (!S.q || smartMatch(S.q, i.itemName, i.itemCode, i.itemGroup))); }
function sapRender() {
  const S = sapState, root = sapRoot(); const list = sapFiltered(); const groups = [...new Set(S.items.map(i => i.itemGroup).filter(Boolean))].sort();
  const val = S.items.reduce((s, i) => s + (i.inStock || 0) * (i.lastPrice || 0) / (i.perPurchase || 1), 0);
  root.innerHTML = `<div class="card"><div class="card-title"><span>📒 SAP Item Master (kada Company)</span></div>
    ${S.companies.length ? '' : '<p style="color:#b45309;">Wala pang company. Gumawa muna sa 🏢 Company Management.</p>'}
    <div style="display:flex;gap:.4rem;flex-wrap:wrap;align-items:end;margin-bottom:.6rem;">
      <div><label style="font-weight:700;">Company</label><br><select onchange="sapState.company=this.value;sapState.q='';sapState.group='';loadSapItems()">${S.companies.map(c => `<option ${c === S.company ? 'selected' : ''}>${srchEsc(c)}</option>`).join('')}</select></div>
      <button class="btn btn-success" onclick="sapPickFile()">📥 Import SAP (Excel / PDF / TXT / CSV)</button>
      <button class="btn btn-secondary" onclick="sapExportCSV()">📤 Export (SAP format)</button>
      <button class="btn btn-secondary" onclick="sapRestoreOpen()">🕘 Restore Points</button>
      <button class="btn btn-secondary" onclick="sapTemplate()">📄 Template</button>
      <button class="btn btn-secondary" onclick="sapCopyToCompany()">📋 Kopyahin sa ibang company</button>
      <button class="btn btn-primary" onclick="sapSyncProducts()">🔄 I-sync sa Products (UOM + Whole:Loose)</button>
      <button class="btn btn-secondary" onclick="sapUseAsUnitCost()">💲 Gawing Unit Cost ang Last Purchase Price</button></div>
    <small style="color:#64748b;">Mga column (parehong ayos ng SAP B1): ${SAP_HEADERS.join(' · ')}. Ang bawat import ay <b>pinapalitan</b> ang buong listahan ng company (ang wala sa bagong file ay natatanggal). May 🕘 Restore Point na may petsa bago palitan, para maibalik mo ang dati.</small>
    <div style="display:flex;gap:.4rem;flex-wrap:wrap;margin:.6rem 0;"><input type="search" placeholder="🔍 Hanapin (code / pangalan)" value="${srchEsc(S.q)}" oninput="sapState.q=this.value;sapRenderTable()" style="min-width:220px;">
      <select onchange="sapState.group=this.value;sapRenderTable()"><option value="">Lahat ng Item Group</option>${groups.map(g => `<option ${g === S.group ? 'selected' : ''}>${srchEsc(g)}</option>`).join('')}</select></div>
    <div id="sap-sum" style="margin-bottom:.4rem;font-size:.9rem;"></div><div class="table-responsive" id="sap-tbl"></div></div>`;
  sapRenderTable(val);
}
function sapRenderTable(val) {
  const S = sapState; const list = sapFiltered(); const sum = document.getElementById('sap-sum'); if (!sum) return;
  if (val == null) val = S.items.reduce((s, i) => s + (i.inStock || 0) * (i.lastPrice || 0) / (i.perPurchase || 1), 0);
  sum.innerHTML = `<b>${list.length}</b> / ${S.items.length} item · Active: ${S.items.filter(i => i.active).length} · Tantiyang halaga (In Stock × Last Price): <b>${money(val)}</b>${sapLatest(S.items)}`;
  document.getElementById('sap-tbl').innerHTML = `<table data-notools="1"><thead><tr><th>Item No.</th><th>Item Description</th><th>In Stock</th><th>Purch. UoM</th><th>Item Group</th><th>Active</th><th>Whole:Loose</th><th>Last Price</th><th>Last Purch. Date</th><th>Inv. UoM</th><th>Updated (SAP)</th><th>SAP as of</th><th>Na-import sa ERP</th></tr></thead><tbody>${list.slice(0, 400).map(i => `<tr><td>${srchEsc(i.itemCode)}</td><td>${srchEsc(i.itemName)}</td><td style="text-align:right;">${(+i.inStock || 0).toLocaleString()}</td><td>${srchEsc(i.purchUom)}</td><td>${srchEsc(i.itemGroup)}</td><td>${i.active ? 'Yes' : '<span style="color:#dc2626;">No</span>'}</td><td>1:${i.conv || 1}${i.convSrc === 'description' ? ' <span title="Hinango sa pangalan, hindi sa SAP — i-check" style="color:#7c3aed;">💡</span>' : ''}</td><td style="text-align:right;">${money(i.lastPrice)}</td><td>${srchEsc(i.lastPurchaseDate || '')}</td><td>${srchEsc(i.invUom)}</td><td>${srchEsc(i.updateDate || '')}</td><td>${srchEsc(i.asOf || '')}</td><td>${srchEsc(sapStamp(i.importedAt))}</td></tr>`).join('') || '<tr><td colspan="13" style="text-align:center;color:#94a3b8;">Wala pang item. I-import ang SAP extract.</td></tr>'}</tbody></table>${list.length > 400 ? `<small>Ipinapakita ang unang 400. Gamitin ang search o i-export para sa lahat.</small>` : ''}`;
}
function sapCsvRows(rows) {
  const L = [SAP_HEADERS.join(',')];
  rows.forEach(i => L.push([i.itemCode, i.itemName, i.inStock, i.purchUom, i.itemGroup, i.active ? 'Yes' : 'No', i.perPurchase, i.perSales, i.lastPrice, sapDateOut(i.lastPurchaseDate), i.invUom, sapDateOut(i.updateDate)].map(csvCell).join(',')));
  return L.join('\r\n');
}
function sapStamp(iso) { if (!iso) return ''; const d = new Date(iso); return isNaN(d) ? String(iso) : d.toLocaleString('en-PH', { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }); }
function sapLatest(items) { let asOf = '', imp = '', upd = ''; (items || []).forEach(i => { if (i.asOf && String(i.asOf) > asOf) asOf = String(i.asOf); if (i.importedAt && i.importedAt > imp) imp = i.importedAt; if (i.updateDate && String(i.updateDate) > upd) upd = String(i.updateDate); }); return (asOf ? ' · 📅 SAP as of <b>' + srchEsc(asOf) + '</b>' : '') + (imp ? ' · Huling na-import sa ERP: <b>' + srchEsc(sapStamp(imp)) + '</b>' : '') + (upd ? ' · Pinakabagong Update Date sa SAP: <b>' + srchEsc(upd) + '</b>' : ''); }
function sapDateOut(iso) { const m = /^(\d{4})-(\d\d)-(\d\d)$/.exec(iso || ''); return m ? `${m[2]}.${m[3]}.${m[1]}` : ''; }
function sapExportCSV() { if (!sapState.items.length) { alert('Walang item na i-e-export.'); return; } downloadCSVFile(sapCsvRows(sapFiltered()), `SAP_Items_${invSlug(sapState.company)}.csv`); }
function sapTemplate() { downloadCSVFile(SAP_HEADERS.join(',') + '\r\nPC131007,YAKINIKUDON SAUCE,248,PACK,R-PRODUCTION,Yes,1,1,892.86,06.25.2026,PACK,07.04.2021\r\n', 'SAP_Items_Template.csv'); }
function sapParseCSVText(text) {
  const norm = h => String(h || '').toLowerCase().replace(/[^a-z]/g, '');
  const objs = csvToObjects(text.split(/\r?\n/).filter(l => !/^\s*"?#/.test(l)).join('\n')); // csvToObjects ginagawang lowercase/underscore ang header
  const key = o => { const m = {}; Object.keys(o).forEach(k => m[norm(k)] = o[k]); return m; };
  const rows = [], bad = [];
  objs.forEach((o, i) => { const m = key(o); const code = String(m.itemno || '').trim(); if (!code) { bad.push('Row ' + (i + 2) + ': walang Item No.'); return; }
    rows.push({ company: String(m.company || '').trim(), itemCode: code, itemName: String(m.itemdescription || '').trim(), inStock: sapNum(m.instock), purchUom: m.purchasinguom || '', itemGroup: sapFixGroup(m.itemgroup), active: !/^(no|n|false|0)$/i.test(String(m.active || 'Yes').trim()), perPurchase: sapNum(m.noofitemsperpurchaseunit) || 1, perSales: sapNum(m.noofitemspersalesunit) || 1, lastPrice: sapNum(m.lastpurchaseprice), lastPurchaseDate: sapDateISO(m.lastpurchasedate), invUom: m.inventoryuom || '', updateDate: sapDateISO(m.dateofupdate) }); });
  rows.forEach(sapEnrich);
  return { rows, bad };
}
async function sapPdfToText(file) {
  if (!window.pdfjsLib) await new Promise((res, rej) => { const s = document.createElement('script'); s.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js'; s.onload = res; s.onerror = () => rej(new Error('Hindi ma-load ang PDF reader (kailangan ng internet).')); document.head.appendChild(s); });
  pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  const pdf = await pdfjsLib.getDocument({ data: await file.arrayBuffer() }).promise; let out = '';
  for (let p = 1; p <= pdf.numPages; p++) { const c = await (await pdf.getPage(p)).getTextContent(); let line = '', y = null; c.items.forEach(it => { const yy = Math.round(it.transform[5]); if (y !== null && Math.abs(yy - y) > 2) { out += line.trim() + '\n'; line = ''; } y = yy; line += it.str + ' '; }); out += line.trim() + '\n'; }
  return out;
}
// Single-flight: hindi puwedeng ma-double-click ang import / sync. Hanggang matapos ang unang takbo, ignored ang ikalawa.
const sapBusy = {};
async function sapOnce(key, fn, btn) {
  if (sapBusy[key]) return; sapBusy[key] = true; let old = ''; if (btn) { old = btn.innerHTML; btn.disabled = true; btn.innerHTML = '⏳ Sandali lang...'; }
  try { return await fn(); } finally { sapBusy[key] = false; if (btn && btn.isConnected) { btn.disabled = false; btn.innerHTML = old; } }
}
function sapPickFile() {
  if (sapBusy.pick) return; sapBusy.pick = true; setTimeout(() => { sapBusy.pick = false; }, 2500);
  if (!sapState.company) { alert('Pumili muna ng Company.'); return; }
  const f = document.createElement('input'); f.type = 'file'; f.accept = '.xlsx,.xls,.pdf,.txt,.csv,text/plain,text/csv,application/pdf';
  f.onchange = async () => { if (!f.files.length) return; await sapOnce('open', () => sapHandleFile(f.files[0])); }; f.click();
}
// ---- Excel (.xlsx) na SAP extract: maraming sheet (kada company) at magkakaibang layout ----
const SAP_XCOLS = { itemno: 'itemCode', itemdescription: 'itemName', instock: 'inStock', purchasinguom: 'purchUom', itemgroup: 'itemGroup', active: 'active', inactive: 'inactive', noofitemsperpurchaseunit: 'perPurchase', noofitemspersalesunit: 'perSales', quantityperpackagesales: 'perSales', lastpurchaseprice: 'lastPrice', lastpurchasedate: 'lastPurchaseDate', inventoryuom: 'invUom', dateofupdate: 'updateDate' };
function sapXDate(v) { if (v instanceof Date && !isNaN(v)) return `${v.getFullYear()}-${String(v.getMonth() + 1).padStart(2, '0')}-${String(v.getDate()).padStart(2, '0')}`; if (typeof v === 'number' && v > 30000 && v < 80000) { const d = new Date(Math.round((v - 25569) * 86400000)); return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`; } const t = String(v == null ? '' : v).trim(); return /^\d{4}-\d\d-\d\d/.test(t) ? t.slice(0, 10) : sapDateISO(t); }
function sapRowsFromAoA(aoa) {
  const norm = h => String(h == null ? '' : h).toLowerCase().replace(/[^a-z]/g, ''); let hi = -1, map = {};
  for (let i = 0; i < Math.min(aoa.length, 8); i++) { const m = {}; (aoa[i] || []).forEach((h, j) => { const k = SAP_XCOLS[norm(h)]; if (k && m[k] === undefined) m[k] = j; }); if (m.itemName !== undefined && m.purchUom !== undefined) { if (m.itemCode === undefined) m.itemCode = 0; hi = i; map = m; break; } }
  if (hi < 0) return { rows: [], bad: ['Walang header na "Item Description / Purchasing UoM" sa sheet na ito.'], noHeader: true };
  const rows = [], bad = [], seen = {}; const g = (r, k) => map[k] === undefined ? '' : r[map[k]];
  for (let i = hi + 1; i < aoa.length; i++) {
    const r = aoa[i] || []; const code = String(g(r, 'itemCode') == null ? '' : g(r, 'itemCode')).trim(); if (!code) continue; const name = String(g(r, 'itemName') == null ? '' : g(r, 'itemName')).trim(); if (!name) { bad.push(code + ': walang description'); continue; }
    const inv = String(g(r, 'invUom') || '').trim(); const act = map.active !== undefined ? !/^(no|n|false|0)$/i.test(String(g(r, 'active'))) : (map.inactive !== undefined ? !/^(yes|y|true|1)$/i.test(String(g(r, 'inactive'))) : true);
    const x = { itemCode: code, itemName: name, inStock: sapNum(g(r, 'inStock')), purchUom: String(g(r, 'purchUom') || '').replace(/^none$/i, '').trim(), itemGroup: sapFixGroup(g(r, 'itemGroup')), active: act, perPurchase: sapNum(g(r, 'perPurchase')) || 1, perSales: sapNum(g(r, 'perSales')) || 1, lastPrice: sapNum(g(r, 'lastPrice')), lastPurchaseDate: sapXDate(g(r, 'lastPurchaseDate')), invUom: /^(manual|none)$/i.test(inv) ? '' : inv, updateDate: sapXDate(g(r, 'updateDate')) };
    const stamp = z => (z.lastPurchaseDate > z.updateDate ? z.lastPurchaseDate : z.updateDate) || '';
    if (seen[code] != null) { if (stamp(x) >= stamp(rows[seen[code]])) rows[seen[code]] = x; continue; } seen[code] = rows.length; rows.push(x);
  }
  rows.forEach(sapEnrich); return { rows, bad };
}
async function sapXlsxLib() { if (window.XLSX) return; await new Promise((res, rej) => { const s = document.createElement('script'); s.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js'; s.onload = res; s.onerror = () => rej(new Error('Hindi ma-load ang Excel reader (kailangan ng internet).')); document.head.appendChild(s); }); }
let sapXWb = null;
async function sapXlsxOpen(file) {
  try {
    await sapXlsxLib(); const wb = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: true }); sapXWb = { wb, aoa: {}, file: file.name }; const cos = sapState.companies.slice(), norm = t => String(t || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const rows = wb.SheetNames.map((n, i) => { const aoa = XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1, raw: true, defval: '' }); sapXWb.aoa[n] = aoa; const p = sapRowsFromAoA(aoa); if (p.noHeader) return ''; const guess = cos.find(c => norm(c) === norm(n)) || ''; return `<tr><td><input type="checkbox" class="sx-on" data-i="${i}" ${guess ? 'checked' : ''}></td><td><b>${srchEsc(n)}</b><br><small style="color:#64748b;">${p.rows.length} item</small></td><td><select class="sx-co" data-i="${i}"><option value="">— pumili —</option>${cos.map(c => `<option ${c === guess ? 'selected' : ''}>${srchEsc(c)}</option>`).join('')}</select></td></tr>`; }).join('');
    arModal(`<h3>📥 Excel — ${srchEsc(file.name)}</h3><p style="font-size:.85rem;color:#64748b;">I-check ang sheet na ii-import at piliin kung anong Company. Mga sheet na walang "Item Description / Purchasing UoM" na header ay hindi ipinapakita. Kapag dalawang sheet ang parehong company, ang mas bagong Last Purchase Date ang mananaig.</p><div style="max-height:45vh;overflow:auto;"><table data-notools="1"><thead><tr><th></th><th>Sheet</th><th>Company</th></tr></thead><tbody>${rows || '<tr><td colspan="3">Walang sheet na may SAP item layout.</td></tr>'}</tbody></table></div><button class="btn btn-success" style="margin-top:.6rem;" onclick="sapXlsxPreview()">Susunod ➜ Preview</button>`);
  } catch (e) { alert('Error: ' + e.message); }
}
function sapXlsxPreview() {
  const names = sapXWb.wb.SheetNames, byKey = {}, bad = []; let cnt = {};
  document.querySelectorAll('.sx-on:checked').forEach(c => { const i = +c.dataset.i, co = (document.querySelector(`.sx-co[data-i="${i}"]`) || {}).value; if (!co) { bad.push(names[i] + ': walang company'); return; } const p = sapRowsFromAoA(sapXWb.aoa[names[i]]); p.bad.forEach(b => bad.push(names[i] + ': ' + b)); p.rows.forEach(r => { const k = co + '|' + r.itemCode, ex = byKey[k]; const st = z => (z.lastPurchaseDate > z.updateDate ? z.lastPurchaseDate : z.updateDate) || ''; if (!ex || st(r) >= st(ex)) byKey[k] = Object.assign(r, { company: co }); }); });
  const rows = Object.values(byKey); rows.forEach(r => cnt[r.company] = (cnt[r.company] || 0) + 1); if (!rows.length) { alert('Walang napiling sheet na may company.' + (bad.length ? '\n' + bad.slice(0, 3).join('\n') : '')); return; }
  sapState.preview = { rows, bad, file: sapXWb.file };
  arModal(`<h3>📥 Preview — ${srchEsc(sapXWb.file)}</h3><p><b>${rows.length}</b> item: ${Object.keys(cnt).map(c => srchEsc(c) + ' (' + cnt[c] + ')').join(' · ')}${bad.length ? '<br>⚠️ ' + bad.length + ' ang nilaktawan' : ''}</p><div style="max-height:180px;overflow:auto;font-size:.8rem;border:1px solid #e2e8f0;border-radius:.4rem;padding:.4rem;">${rows.slice(0, 8).map(r => `${srchEsc(r.company)} · ${srchEsc(r.itemCode)} · ${srchEsc(r.itemName)} · ${srchEsc(r.purchUom)} · ₱${r.lastPrice}`).join('<br>')}</div><div class="form-group" style="margin-top:.6rem;"><label>SAP as of (petsa ng extract)</label><input type="date" id="sap-asof" value="${attISO(new Date())}"></div><button class="btn btn-success" onclick="sapConfirmImport(this)">✅ I-import</button>`);
}
async function sapUseAsUnitCost() { return sapOnce('cost', () => sapUseAsUnitCostRun(), (typeof event !== 'undefined' && event && event.target && event.target.tagName === 'BUTTON') ? event.target : null); }
async function sapUseAsUnitCostRun() {
  const S = sapState; const list = S.items.filter(i => i.lastPrice > 0 && i.active !== false); if (!list.length) { alert('Walang item na may Last Purchase Price.'); return; }
  if (!await uiConfirm(`Gawing Unit Cost ng ${S.company} ang Last Purchase Price ng ${list.length} item? (Ang presyo bawat Whole ay hahatiin sa Whole:Loose para maging presyo bawat loose UOM. Papalitan ang mga cost na nandoon na.)`)) return;
  try { const ref = db.collection('inventory_costs').doc('company_' + invSlug(S.company)); const d = await ref.get(); const costs = d.exists ? (d.data().costs || {}) : {}; list.forEach(i => { costs[i.itemCode] = Math.round(i.lastPrice / (i.conv > 1 ? i.conv : 1) * 10000) / 10000; }); await ref.set({ company: S.company, costs, source: 'SAP last purchase price', updatedAt: new Date().toISOString() }, { merge: true }); try { await logSystemAction('UNIT_COST_FROM_SAP', `${S.company}: ${list.length} item`); } catch (e) {} alert(`✅ Na-set ang Unit Cost ng ${list.length} item.`); } catch (e) { alert('Error: ' + e.message); }
}
async function sapHandleFile(file) {
  if (/\.xlsx?$/i.test(file.name)) return sapXlsxOpen(file);
  try {
    let parsed;
    if (/\.pdf$/i.test(file.name)) parsed = sapParseText(await sapPdfToText(file));
    else { const txt = await file.text(); parsed = /^\s*"?(Company"?\s*,\s*"?)?Item No\.?"?\s*,/i.test(txt.split(/\r?\n/).find(l => l.trim() && !l.trim().startsWith('#')) || '') ? sapParseCSVText(txt) : sapParseText(txt); }
    if (!parsed.rows.length) { alert('Walang nabasang item. Siguraduhing SAP Item Master ang file (Item No., Item Description, In Stock...).'); return; }
    const have = new Set(sapState.items.map(i => i.itemCode)); const nw = parsed.rows.filter(r => !have.has(r.itemCode)).length;
    sapState.preview = { rows: parsed.rows, bad: parsed.bad, file: file.name };
    arModal(`<h3>📥 Preview — ${srchEsc(sapState.company)}</h3><p><b>${parsed.rows.length}</b> item ang nabasa mula sa <i>${srchEsc(file.name)}</i><br>🆕 Bago: <b>${nw}</b> · ♻️ Ia-update: <b>${parsed.rows.length - nw}</b> · ⚠️ Hindi nabasa: <b>${parsed.bad.length}</b> (ibang layout)<br>📦 May Whole:Loose (galing SAP): <b>${parsed.rows.filter(r => r.convSrc === 'SAP').length}</b> · 💡 Mungkahi mula sa pangalan: <b>${parsed.rows.filter(r => r.convSrc === 'description').length}</b></p>
      <div style="max-height:180px;overflow:auto;font-size:.8rem;border:1px solid #e2e8f0;border-radius:.4rem;padding:.4rem;">${parsed.rows.slice(0, 8).map(r => `${srchEsc(r.itemCode)} · ${srchEsc(r.itemName)} · ${r.inStock} ${srchEsc(r.purchUom)} · ${srchEsc(r.itemGroup)} · ${money(r.lastPrice)}`).join('<br>')}</div>
      <div class="form-group" style="margin-top:.6rem;"><label>SAP as of (petsa ng extract)</label><input type="date" id="sap-asof" value="${attISO(new Date())}"></div>
      <button class="btn btn-success" onclick="sapConfirmImport(this)">✅ I-import sa ${srchEsc(sapState.company)}</button>`);
  } catch (e) { alert('Error: ' + e.message); }
}
/* Product Masterlist → i-sync ang SAP Item Master (sub item master) ng napiling company */
async function apSapSync(btn) {
  const co = (document.getElementById('admin-product-company') || {}).value;
  if (!co || co === '__none') { alert('Piliin muna ang 🏢 Company sa itaas (hindi puwede ang "Lahat" o "walang company") para malaman kung aling SAP Item Master ang isi-sync.'); return; }
  await sapOnce('sync', async () => {
    try {
      sapState.company = co; sapState.items = []; const s = await db.collection('sap_items').where('company', '==', co).get(); s.forEach(d => sapState.items.push({ id: d.id, ...d.data() }));
      if (!sapState.items.length) { alert('Wala pang SAP Item Master ang ' + co + '.\n\nI-upload muna sa 📒 SAP Item Master (kada Company), saka bumalik dito.'); return; }
      await sapSyncProductsRun(); if (typeof loadAdminProducts === 'function') loadAdminProducts();
    } catch (e) { alert('Error: ' + e.message); }
  }, btn);
}
async function sapSyncProducts() { return sapOnce('sync', () => sapSyncProductsRun(), (typeof event !== 'undefined' && event && event.target && event.target.tagName === 'BUTTON') ? event.target : null); }
async function sapSyncProductsRun() {
  const S = sapState; if (!S.items.length) { alert('Mag-import muna ng SAP items.'); return; }
  try {
    const ps = await db.collection('products').get(); const by = {}; ps.forEach(d => { const p = d.data(); [d.id, p.sapCode, p.itemCode].forEach(k => { if (k) by[hubKey(k)] = { id: d.id, ...p }; }); });
    const act = S.items.filter(i => i.active); const ex = act.filter(i => by[hubKey(i.itemCode)]), nw = act.filter(i => !by[hubKey(i.itemCode)]);
    const chg = ex.filter(i => { const p = by[hubKey(i.itemCode)]; return String(p.wholeUOM || '') !== i.wholeUOM || String(p.looseUOM || '') !== i.looseUOM || (+p.conversionFactor || 1) !== (i.conv || 1); });
    if (!await uiConfirm(`I-sync ang ${S.company}?\n\n• May produkto na: ${ex.length} (${chg.length} ang magbabago ng UOM / Whole:Loose)\n• Bagong produkto: ${nw.length} (presyo 0, walang station — i-set mo pagkatapos)\n\nHindi ginagalaw ang presyo, stock, at station ng existing. Ia-add lang ang company tag.`)) return;
    let batch = db.batch(), n = 0; const co = S.company;
    for (const i of ex) { const p = by[hubKey(i.itemCode)]; const cos = Array.isArray(p.companies) && p.companies.length ? p.companies : []; batch.set(db.collection('products').doc(p.id), Object.assign({ wholeUOM: i.wholeUOM, looseUOM: i.looseUOM, conversionFactor: i.conv || 1 }, cos.length && !cos.includes(co) ? { companies: cos.concat(co) } : {}), { merge: true }); if (++n % 400 === 0) { await batch.commit(); batch = db.batch(); } }
    for (const i of nw) { batch.set(db.collection('products').doc(i.itemCode), { itemCode: i.itemCode, sapCode: i.itemCode, itemName: i.itemName, storageStation: 'Unassigned', wholeUOM: i.wholeUOM, looseUOM: i.looseUOM, conversionFactor: i.conv || 1, wholePrice: 0, loosePrice: 0, stockWhole: 0, stockLoose: 0, bufferLimit: 5, packagingInstructions: '', companies: [co], fromSap: true, updatedAt: new Date().toISOString() }, { merge: true }); if (++n % 400 === 0) { await batch.commit(); batch = db.batch(); } }
    await batch.commit(); try { await logSystemAction('SAP_PRODUCTS_SYNC', `${co}: ${ex.length} update, ${nw.length} bago`); } catch (e) {}
    alert(`✅ Tapos: ${chg.length} UOM ang inayos, ${nw.length} bagong produkto.`);
  } catch (e) { alert('Error: ' + e.message); }
}
async function sapConfirmImport(btn) {
  return sapOnce('import', () => sapConfirmImportRun(), btn || (typeof event !== 'undefined' && event && event.target && event.target.tagName === 'BUTTON' ? event.target : null));
}
// ---- Restore points: bago palitan ang SAP items ng isang company, may snapshot na may petsa ----
async function sapSnapSave(company, items, reason, file) {
  if (!items.length) return null; const slug = invSlug(company), id = slug + '__' + Date.now(); const u = getCurrentUser() || {};
  const clean = items.map(i => { const x = Object.assign({}, i); delete x.id; return x; });
  let batch = db.batch(); let n = 0, ci = 0;
  for (let k = 0; k < clean.length; k += 300) { batch.set(db.collection('sap_snapshot_chunks').doc(id + '__' + (ci++)), { snap: id, n: ci - 1, items: clean.slice(k, k + 300) }); if (++n % 20 === 0) { await batch.commit(); batch = db.batch(); } }
  batch.set(db.collection('sap_snapshots').doc(id), { company, slug, createdAt: new Date().toISOString(), count: clean.length, chunks: ci, reason: reason || '', file: file || '', by: u.name || u.email || '' });
  await batch.commit();
  // iwanang 15 pinakabago kada company
  try { const q = await db.collection('sap_snapshots').where('company', '==', company).get(); const all = []; q.forEach(d => all.push({ id: d.id, ...d.data() })); all.sort((x, y) => String(y.createdAt).localeCompare(String(x.createdAt)));
    for (const o of all.slice(15)) { const cs = await db.collection('sap_snapshot_chunks').where('snap', '==', o.id).get(); const bb = db.batch(); cs.forEach(c => bb.delete(c.ref)); bb.delete(db.collection('sap_snapshots').doc(o.id)); await bb.commit(); } } catch (e) { console.warn('prune:', e.message); }
  return id;
}
// Palitan ang buong SAP list ng company: isulat ang bago, tanggalin ang wala sa bago
async function sapReplaceCompany(company, rows, asOf) {
  const slug = invSlug(company); const ex = await db.collection('sap_items').where('company', '==', company).get(); const keep = new Set(rows.map(r => `${slug}__${r.itemCode}`)); const del = []; ex.forEach(d => { if (!keep.has(d.id)) del.push(d.ref); });
  let batch = db.batch(), n = 0; const flush = async () => { await batch.commit(); batch = db.batch(); };
  for (const r of rows) { const d = Object.assign({}, r, { company, asOf, importedAt: new Date().toISOString() }); delete d.id; batch.set(db.collection('sap_items').doc(`${slug}__${r.itemCode}`), d, { merge: true }); if (++n % 400 === 0) await flush(); }
  for (const ref of del) { batch.delete(ref); if (++n % 400 === 0) await flush(); }
  await batch.commit(); return { removed: del.length };
}
async function sapConfirmImportRun() {
  const P = sapState.preview; if (!P) return; const asOf = (document.getElementById('sap-asof') || {}).value || '';
  try {
    const byCo = {}; P.rows.forEach(r => { const c = r.company || sapState.company; (byCo[c] = byCo[c] || []).push(r); });
    const plan = []; for (const c of Object.keys(byCo)) { const ex = await db.collection('sap_items').where('company', '==', c).get(); const slug = invSlug(c); const have = new Set(); ex.forEach(d => have.add(d.id)); const keep = new Set(byCo[c].map(r => `${slug}__${r.itemCode}`)); plan.push({ c, old: have.size, nw: byCo[c].filter(r => !have.has(`${slug}__${r.itemCode}`)).length, gone: [...have].filter(i => !keep.has(i)).length, total: byCo[c].length }); }
    const msg = plan.map(p => `• ${p.c}: ${p.total} item sa file (${p.nw} bago) — PAPALITAN ang ${p.old} na nakasave; ${p.gone} ang mawawala`).join('\n');
    if (!await uiConfirm(`Palitan ang SAP Item Master?\n\n${msg}\n\nMay Restore Point na may petsa bago palitan — puwede mong ibalik anumang oras (🕘 Restore Points).`)) return;
    const cos = new Set(); let removed = 0;
    for (const c of Object.keys(byCo)) {
      cos.add(c);
      const ex = await db.collection('sap_items').where('company', '==', c).get(); const old = []; ex.forEach(d => old.push({ id: d.id, ...d.data() }));
      if (old.length) await sapSnapSave(c, old, 'Bago mag-import ng ' + (P.file || 'bagong SAP'), P.file);
      const r = await sapReplaceCompany(c, byCo[c], asOf); removed += r.removed;
    }
    for (const c of cos) { try { if (!sapState.companies.includes(c)) { await db.collection('companies').doc(c).set({ name: c }, { merge: true }); sapState.companies.push(c); } } catch (e) {} }
    try { await logSystemAction('SAP_ITEMS_REPLACED', `${[...cos].join(', ')}: ${P.rows.length} item, ${removed} natanggal (${P.file || ''})`); } catch (e) {}
    arCloseModal(); alert(`✅ Napalitan ang SAP list ng ${[...cos].join(', ')}: ${P.rows.length} item (${removed} ang natanggal). May Restore Point ang dating listahan.`); sapState.preview = null; sapState.company = sapState.company || [...cos][0]; await loadSapItems();
    if (cos.size === 1) { const co1 = [...cos][0]; if (await uiConfirm(`I-sync na rin ba agad sa 📦 Product Masterlist ng ${co1}?\n\n(Ia-update ang UOM / Whole:Loose at idaragdag ang mga bagong item bilang produkto. Hindi ginagalaw ang presyo, stock at station.)`)) { sapState.company = co1; await loadSapItems(); await sapSyncProductsRun(); } }
  } catch (e) { alert('Error: ' + e.message); }
}
async function sapRestoreOpen() {
  const S = sapState; if (!S.company) { alert('Pumili muna ng Company.'); return; }
  try {
    const q = await db.collection('sap_snapshots').where('company', '==', S.company).get(); const all = []; q.forEach(d => all.push({ id: d.id, ...d.data() })); all.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
    const rows = all.map(o => `<tr><td>${srchEsc(new Date(o.createdAt).toLocaleString('en-PH', { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }))}</td><td><b>${o.count}</b> item</td><td style="font-size:.8rem;">${srchEsc(o.reason || '')}<br><small style="color:#64748b;">${srchEsc(o.by || '')}</small></td><td><button class="btn btn-sm btn-primary" onclick="sapRestoreDo('${o.id}')">↩️ I-restore</button></td></tr>`).join('');
    arModal(`<h3>🕘 Restore Points — ${srchEsc(S.company)}</h3><p style="font-size:.85rem;color:#64748b;">Awtomatikong ginagawa bago palitan ng bagong SAP import. Kapag nag-restore, ang kasalukuyang listahan ay sine-save din muna bilang Restore Point, kaya hindi mawawala. Nakatago ang pinakabagong 15.</p><div style="max-height:50vh;overflow:auto;"><table data-notools="1"><thead><tr><th>Petsa</th><th>Laman</th><th>Dahilan</th><th></th></tr></thead><tbody>${rows || '<tr><td colspan="4" style="text-align:center;color:#94a3b8;">Wala pang Restore Point.</td></tr>'}</tbody></table></div>`);
  } catch (e) { alert('Error: ' + e.message); }
}
async function sapRestoreDo(id) { return sapOnce('restore', () => sapRestoreRun(id)); }
async function sapRestoreRun(id) {
  try {
    const m = await db.collection('sap_snapshots').doc(id).get(); if (!m.exists) { alert('Wala na ang Restore Point na ito.'); return; } const o = m.data();
    if (!await uiConfirm(`I-restore ang SAP list ng ${o.company} noong ${new Date(o.createdAt).toLocaleString()} (${o.count} item)?\n\nPapalitan ang kasalukuyang listahan. Sine-save muna ang kasalukuyan bilang bagong Restore Point.`)) return;
    const cs = await db.collection('sap_snapshot_chunks').where('snap', '==', id).get(); const parts = []; cs.forEach(d => parts.push(d.data())); parts.sort((a, b) => a.n - b.n); const rows = []; parts.forEach(p => rows.push(...(p.items || [])));
    if (rows.length !== o.count) { alert(`Kulang ang Restore Point (${rows.length}/${o.count}). Hindi itinuloy.`); return; }
    const cur = await db.collection('sap_items').where('company', '==', o.company).get(); const now = []; cur.forEach(d => now.push({ id: d.id, ...d.data() }));
    if (now.length) await sapSnapSave(o.company, now, 'Bago mag-restore (' + new Date(o.createdAt).toLocaleDateString() + ')', '');
    const r = await sapReplaceCompany(o.company, rows, rows[0] && rows[0].asOf || '');
    try { await logSystemAction('SAP_ITEMS_RESTORED', `${o.company}: ${rows.length} item galing ${o.createdAt}`); } catch (e) {}
    arCloseModal(); alert(`✅ Naibalik ang ${rows.length} item (${r.removed} ang natanggal).`); loadSapItems();
  } catch (e) { alert('Error: ' + e.message); }
}
async function sapCopyToCompany() {
  const S = sapState; if (!S.items.length) { alert('Walang item na kokopyahin.'); return; }
  const others = S.companies.filter(c => c !== S.company); if (!others.length) { alert('Gumawa muna ng isa pang company (Company Management).'); return; }
  arModal(`<h3>📋 Kopyahin ang ${S.items.length} item ng ${srchEsc(S.company)}</h3><p style="font-size:.85rem;">Para sa mga company na pareho ang code at pangalan (hal. Tokiya at Tanoshi). Ina-update ang kaparehong Item No.; walang binubura.</p><div class="form-group"><label>Kopyahin sa</label><select id="sap-copy-to">${others.map(c => `<option>${srchEsc(c)}</option>`).join('')}</select></div><button class="btn btn-success" onclick="sapDoCopy()">📋 Kopyahin</button>`);
}
async function sapDoCopy() {
  const S = sapState, to = (document.getElementById('sap-copy-to') || {}).value; if (!to) return; const slug = invSlug(to);
  try { let batch = db.batch(), n = 0; for (const i of S.items) { const d = Object.assign({}, i, { company: to }); delete d.id; batch.set(db.collection('sap_items').doc(`${slug}__${i.itemCode}`), d, { merge: true }); if (++n % 400 === 0) { await batch.commit(); batch = db.batch(); } } await batch.commit(); arCloseModal(); alert(`✅ Nakopya ang ${n} item sa ${to}.`); S.company = to; loadSapItems(); } catch (e) { alert('Error: ' + e.message); }
}


// ---- GRPO / A-P Invoice reconciliation (GRNI: Goods Receipts Not Invoiced) ----
let grniRows = [];
function grniTs(v) { try { return v && v.toDate ? v.toDate() : (v && v.seconds ? new Date(v.seconds * 1000) : (v ? new Date(v) : null)); } catch (e) { return null; } }
async function openGrni() {
  arModal('<div style="padding:1rem;">Kinukuha ang listahan...</div>');
  try {
    const snap = await db.collection('vendor_pos').get(); const now = Date.now(); grniRows = [];
    snap.forEach(d => { const p = { id: d.id, ...d.data() }; if (!p.receivedAt) return; if (/^Cancel/i.test(p.status || '')) return;
      const grpo = String(p.grpoNo || '').trim(), ap = String(p.sapApInvoiceNo || '').trim(); if (ap) return;
      const rd = grniTs(p.receivedAt); grniRows.push({ id: p.id, po: p.poNumber || p.id, vendor: p.vendorName || '', si: p.vendorInvoiceNo || '', grpo, amount: +p.actualTotalAmount || +p.totalAmount || 0, rec: rd ? rd.toISOString().slice(0, 10) : '', days: rd ? Math.floor((now - rd.getTime()) / 86400000) : 0, status: p.status || '' }); });
    grniRows.sort((a, b) => b.days - a.days);
    const noG = grniRows.filter(r => !r.grpo), withG = grniRows.filter(r => r.grpo); const tot = r => r.reduce((s, x) => s + x.amount, 0);
    const tbl = rows => rows.map(r => `<tr><td>${srchEsc(r.po)}</td><td>${srchEsc(r.vendor)}</td><td>${srchEsc(r.si)}</td><td>${srchEsc(r.grpo) || '<span style="color:#dc2626;">—</span>'}</td><td>${srchEsc(r.rec)}</td><td style="text-align:right;">${r.days}d</td><td style="text-align:right;">${money(r.amount)}</td><td><button class="btn btn-sm btn-secondary" onclick="arCloseModal();poEditSapRefs('${srchEsc(r.id)}')">✏️ SAP #</button></td></tr>`).join('') || '<tr><td colspan="8" style="text-align:center;color:#94a3b8;">Wala. ✅</td></tr>';
    const head = '<thead><tr><th>PO</th><th>Vendor</th><th>Vendor SI#</th><th>GRPO#</th><th>Natanggap</th><th>Edad</th><th>Halaga</th><th></th></tr></thead>';
    arModal(`<h3>📑 GRPO na wala pang A/P Invoice</h3><p style="font-size:.85rem;color:#64748b;">Natanggap na sa app (may GRPO sa SAP) pero wala pang A/P Invoice#. Ito ang "Goods Receipts Not Invoiced". Kapag na-invoice na sa SAP, ilagay ang A/P Invoice# (✏️).</p>
      <div style="margin-bottom:.5rem;"><b>May GRPO, hindi pa na-invoice:</b> ${withG.length} PO · <b>${money(tot(withG))}</b> &nbsp; | &nbsp; <b style="color:#dc2626;">Walang GRPO#:</b> ${noG.length} PO · ${money(tot(noG))}</div>
      <div style="max-height:55vh;overflow:auto;"><h4>⏳ May GRPO, wala pang A/P Invoice</h4><table data-notools="1">${head}<tbody>${tbl(withG)}</tbody></table><h4 style="margin-top:1rem;">⚠️ Natanggap pero walang GRPO#</h4><table data-notools="1">${head}<tbody>${tbl(noG)}</tbody></table></div>
      <div style="margin-top:.6rem;"><button class="btn btn-secondary btn-sm" onclick="grniCSV()">📤 CSV</button></div>`);
  } catch (e) { arModal('<div style="color:#dc2626;padding:1rem;">Error: ' + srchEsc(e.message) + '</div>'); }
}
function grniCSV() {
  const L = ['PO,Vendor,Vendor_SI,GRPO_No,Received,Days_Outstanding,Amount,Has_GRPO'];
  grniRows.forEach(r => L.push([r.po, r.vendor, r.si, r.grpo, r.rec, r.days, r.amount.toFixed(2), r.grpo ? 'Yes' : 'No'].map(csvCell).join(',')));
  downloadCSVFile(L.join('\r\n'), 'GRPO_Not_Invoiced.csv');
}