// ============================================================================
// EMPLOYEE PORTAL (employee.html) — self-service: Attendance Ko, Team Attendance (per department),
// OB/OT/Leave filing (nasa Attendance Ko), Loan Ko, HR Documents.
// Team Attendance: sino sa department mo ang pumasok na, late/early ng ilang minuto, naka-Leave/OB, o OFF.
// ============================================================================
const EMP = { date: '', team: null, timer: null, view: 'att' };

function empInit() { switchEmpView('att'); }

function switchEmpView(v) {
  EMP.view = v;
  document.querySelectorAll('.emp-view').forEach(el => el.style.display = 'none');
  const el = document.getElementById('emp-view-' + v); if (el) el.style.display = 'block';
  document.querySelectorAll('#app-sidebar .menu-item').forEach(a => a.classList.toggle('active', a.dataset.view === v));
  if (EMP.timer) { clearInterval(EMP.timer); EMP.timer = null; }
  if (v === 'att') loadAttendance();
  else if (v === 'team') { loadEmpTeam(); EMP.timer = setInterval(() => { if (EMP.view === 'team' && EMP.date === attISO(attNow())) loadEmpTeam(true); }, 60000); }
  else if (v === 'loan' && typeof loadMyLoans === 'function') loadMyLoans();
  else if (v === 'docs' && typeof loadHrDocs === 'function') loadHrDocs();
  try { const sb = document.getElementById('app-sidebar'); if (sb) sb.classList.remove('mobile-open'); document.body.classList.remove('menu-open'); } catch (e) {}
}

function empEsc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
function empMinTxt(m) { m = Math.abs(Math.round(m)); const h = Math.floor(m / 60), r = m % 60; return h ? (r ? `${h}h ${r}m` : `${h}h`) : `${r}m`; }

// Kalkulahin ang status ng isang tao sa isang petsa (schedule galing sa default week ng profile)
function empMemberStatus(p, log, mark, date, nowMin, today) {
  const dow = attDow(date); const day = ((p.defaultWeek || [])[dow]) || null;
  const segs = day && !day.off ? (day.segs || []) : []; const off = !!(day && day.off);
  const grace = +p.graceMin || 0;
  const punches = ((log && log.punches) || []).slice().sort((a, b) => String(a.at).localeCompare(String(b.at)));
  const ins = punches.filter(x => x.type === 'in'), outs = punches.filter(x => x.type === 'out');
  const firstIn = ins.length ? attPunchMin(ins[0].at) : null; const last = punches[punches.length - 1];
  const lastOut = last && last.type === 'out' ? attPunchMin(last.at) : null; const open = !!(last && last.type === 'in');
  const start = segs.length ? attMin(segs[0].in) : null; const end = segs.length ? attMin(segs[segs.length - 1].out) : null;
  const o = { p, firstIn, lastOut, open, start, end, sched: segs.length ? `${segs[0].in} – ${segs[segs.length - 1].out}` : (off ? 'OFF' : '—'), cls: 'gray', label: '', note: '' };
  if (mark && mark.kind === 'Leave') { o.cls = 'purple'; o.label = '🏖️ Leave'; if (firstIn == null) return o; }
  if (mark && mark.kind === 'OB' && firstIn == null) { o.cls = 'blue'; o.label = '🚗 OB (Official Business)'; return o; }
  if (firstIn != null) {
    o.cls = open ? 'green' : 'teal'; o.label = open ? '🟢 Naka-in' : '✅ Naka-out';
    if (start != null) { const d = firstIn - start; if (d > grace) { o.cls = 'amber'; o.note = `Late ${empMinTxt(d)}`; } else if (d < 0) { o.note = `Maaga ${empMinTxt(d)}`; } else o.note = 'On time'; }
    else o.note = off ? 'OFF pero pumasok' : 'Walang schedule';
    return o;
  }
  if (off) { o.label = '😴 OFF'; return o; }
  if (!segs.length) { o.label = '— Walang schedule'; return o; }
  if (date < today) { o.cls = 'red'; o.label = '❌ Absent'; return o; }
  if (date > today) { o.label = 'Naka-schedule'; return o; }
  if (nowMin > start + grace) { o.cls = 'red'; o.label = '⏰ Wala pang time-in'; o.note = `Late na ng ${empMinTxt(nowMin - start)}`; }
  else if (nowMin >= start - 60) { o.cls = 'gray'; o.label = '⌛ Hindi pa nag-time-in'; o.note = `Simula ${segs[0].in}`; }
  else { o.label = '⌛ Hindi pa oras'; o.note = `Simula ${segs[0].in}`; }
  return o;
}

async function loadEmpTeam(silent) {
  const root = document.getElementById('emp-team-root'); if (!root || !db) return;
  const me = attMe(); const today = attISO(attNow()); if (!EMP.date) EMP.date = today;
  if (!silent) root.innerHTML = '<div class="card">Kinukuha ang team attendance...</div>';
  try {
    const mp = await db.collection('attendance_profiles').doc(me.email).get(); const mine = mp.exists ? mp.data() : null;
    const dept = mine && mine.dept ? mine.dept : '';
    if (!dept) { root.innerHTML = `<div class="card"><div class="card-title">👥 Team Attendance</div><div style="background:#fffbeb;border:1px solid #fcd34d;padding:.7rem;border-radius:.4rem;">⚠️ Wala pang naka-set na department sa attendance profile mo. Sabihan ang HR na i-<b>Sync mula sa Employees</b> (Attendance → Schedule) para lumabas ang team mo.</div></div>`; return; }
    const [pq, lq, tq] = await Promise.all([
      db.collection('attendance_profiles').where('dept', '==', dept).get(),
      db.collection('attendance_logs').where('dept', '==', dept).where('date', '==', EMP.date).get(),
      db.collection('team_status').where('dept', '==', dept).where('date', '==', EMP.date).get()]);
    const logs = {}; lq.forEach(d => { const x = d.data(); logs[x.email] = x; }); const marks = {}; tq.forEach(d => { const x = d.data(); marks[x.email] = x; });
    const now = attNow(); const nowMin = now.getHours() * 60 + now.getMinutes();
    const rows = []; pq.forEach(d => { const p = d.data(); if (!p.email || /@noemail\.local$/.test(p.email)) return; rows.push(empMemberStatus(p, logs[p.email], marks[p.email], EMP.date, nowMin, today)); });
    rows.sort((a, b) => String(a.p.name || a.p.email).localeCompare(String(b.p.name || b.p.email)));
    EMP.team = { dept, rows };
    const cnt = { in: 0, late: 0, wait: 0, leave: 0, ob: 0, off: 0, absent: 0 };
    rows.forEach(r => { if (r.firstIn != null) { cnt.in++; if (r.cls === 'amber') cnt.late++; } else if (/Leave/.test(r.label)) cnt.leave++; else if (/OB/.test(r.label)) cnt.ob++; else if (/OFF/.test(r.label)) cnt.off++; else if (/Absent/.test(r.label)) cnt.absent++; else if (r.start != null) cnt.wait++; });
    const colors = { green: '#16a34a', teal: '#0d9488', amber: '#d97706', red: '#dc2626', purple: '#7c3aed', blue: '#2563eb', gray: '#64748b' };
    const tile = (n, l, c) => `<div style="background:#f8fafc;border-left:4px solid ${c};padding:.6rem .8rem;border-radius:.4rem;"><div style="font-size:1.3rem;font-weight:800;">${n}</div><small>${l}</small></div>`;
    const body = rows.map(r => {
      const tin = r.firstIn != null ? attHM(r.firstIn) : '—'; const tout = r.lastOut != null ? attHM(r.lastOut) : (r.open ? '…' : '—'); const c = colors[r.cls] || '#64748b';
      const initials = String(r.p.name || r.p.email).trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase();
      return `<tr><td><div style="display:flex;gap:.5rem;align-items:center;"><span style="width:30px;height:30px;border-radius:50%;background:${c};color:#fff;display:inline-flex;align-items:center;justify-content:center;font-size:.75rem;font-weight:700;">${empEsc(initials)}</span><b>${empEsc(r.p.name || r.p.email)}${r.p.email === me.email ? ' <small>(ikaw)</small>' : ''}</b></div></td>
        <td><small>${empEsc(r.sched)}</small></td><td>${tin}</td><td>${tout}</td>
        <td><span style="color:${c};font-weight:700;">${empEsc(r.label)}</span>${r.note ? `<br><small style="color:${r.cls === 'amber' || r.cls === 'red' ? '#b45309' : '#475569'};">${empEsc(r.note)}</small>` : ''}</td></tr>`;
    }).join('') || '<tr><td colspan="5" style="text-align:center;color:#94a3b8;padding:1rem;">Walang ibang miyembro ang department na ito.</td></tr>';
    root.innerHTML = `<div class="card"><div class="card-title"><span>👥 Team Attendance — ${empEsc(dept)}</span><span><input type="date" value="${EMP.date}" max="${today}" onchange="EMP.date=this.value||attISO(attNow());loadEmpTeam()"> <button class="btn btn-secondary btn-sm" onclick="EMP.date=attISO(attNow());loadEmpTeam()">Ngayon</button> <button class="btn btn-secondary btn-sm" onclick="loadEmpTeam()">🔄</button></span></div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:.6rem;margin-bottom:.8rem;">${tile(cnt.in, 'Nakapag-time-in', '#16a34a')}${tile(cnt.late, 'Late', '#d97706')}${tile(cnt.wait, 'Wala pa', '#64748b')}${tile(cnt.leave, 'Leave', '#7c3aed')}${tile(cnt.ob, 'OB', '#2563eb')}${tile(cnt.off, 'OFF', '#94a3b8')}${EMP.date < today ? tile(cnt.absent, 'Absent', '#dc2626') : ''}</div>
      <div class="table-responsive"><table data-notools="1"><thead><tr><th>Miyembro</th><th>Schedule</th><th>Time In</th><th>Time Out</th><th>Status</th></tr></thead><tbody>${body}</tbody></table></div>
      <p style="font-size:.75rem;color:#94a3b8;margin-top:.6rem;">Ang "Maaga/Late" ay kumpara sa regular na schedule ng bawat isa (bago ang anumang schedule adjustment). Nag-a-update bawat minuto.</p></div>`;
  } catch (e) { root.innerHTML = `<div class="card" style="color:#dc2626;">Hindi ma-load ang team attendance: ${empEsc(e.message)}</div>`; }
}
