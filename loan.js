/* =====================================================================
   🏦 LOAN MANAGEMENT (Employee Loans)
   Firestore:
     system_settings/loan_config   {minTenureMonths, maxAmount, termOptions[], freqOptions[], maxActive, presidentEmail, presidents{company:email}, allowAdmin, updatedBy, updatedAt}  (Super Admin lang ang nagsusulat)
     system_settings/loan_template {text, updatedBy, updatedAt}                                                                                                                         (HR/Admin)
     loans/{LN-xxxx}  {empDocId, empId, name, email, company, branch, position, hireDate, amount, purpose, term, freq, startDate, installment, schedule[{n,due,amt,paid,paidAt,paidBy}],
                       status: Pending|Approved|Rejected|Active|Paid|Cancelled, forced, filedBy, filedAt, decidedBy, decidedAt, decisionNote, contractPrintedAt/By, signed{fileId,name,at,by}, log[]}
     employees/{id}.loanForce / loanForceBy / loanForceAt / loanForceLog[]   (checkbox sa Employee profile)
   Approver: President ng kumpanya (loan_config.presidents[company] o presidentEmail; fallback: request_approvers.presidentEmail) at Super Admin. (Opsyonal: pati Admin.)
   ===================================================================== */
const LN_DEF = { minTenureMonths: 12, maxAmount: 20000, termOptions: [3, 6, 9, 12], freqOptions: ['cutoff', 'monthly'], maxActive: 1, presidentEmail: '', presidents: {}, allowAdmin: false };
const LN_FREQ = { cutoff: 'Kada cut-off (15th & katapusan)', monthly: 'Kada buwan (katapusan)' };
const LN_STAT_CLR = { Pending: '#f59e0b', Approved: '#2563eb', Rejected: '#dc2626', Active: '#16a34a', Paid: '#64748b', Cancelled: '#94a3b8' };
const LN_DEF_TEMPLATE = `LOAN AGREEMENT / PROMISSORY NOTE

Petsa: {{date}}

Ako, si {{name}} (Employee ID: {{empId}}), {{position}} ng {{company}}, ay kusang-loob na umuutang sa kumpanya ng halagang {{amountWords}} (₱{{amount}}) para sa layuning: {{purpose}}.

1. PAGBABAYAD. Babayaran ko ang utang sa loob ng {{term}} buwan sa pamamagitan ng awtomatikong pagbabawas sa aking sahod, {{freq}}, na nagkakahalaga ng ₱{{installment}} bawat bawas, ayon sa iskedyul sa ibaba.

2. PAGPAPAYAG SA PAGBABAWAS. Pumapayag ako na ibawas ng kumpanya mula sa aking sahod ang bawat hulog. Kapag ako ay nagbitiw o natapos ang aking trabaho bago mabayaran ang buong utang, pumapayag akong ibawas ang natitirang balanse sa aking huling sahod, 13th month pay, at iba pang makukuha ko.

3. PAGKAKAMALI SA BAYAD. Kapag hindi nabawasan ang isang hulog sa takdang petsa, mananatili itong utang ko at ibabawas sa susunod na sahod.

ISKEDYUL NG BAYAD:
{{schedule}}

Nilagdaan ngayong {{date}}.



______________________________            ______________________________
{{name}}                                          {{president}}
Empleyado                                         Aprubado ni (President)`;

let LN = { self: false, my: null, cfg: null, tpl: null, loans: [], emps: [], tab: 'list', filter: 'all', q: '', loaded: false };

/* ---------- gamit ---------- */
function lnEsc(s) { return typeof srchEsc === 'function' ? srchEsc(s) : String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function lnR2(n) { return Math.round((+n || 0) * 100) / 100; }
function lnMoney(n) { return (+n || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function lnISO(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
function lnDate(s) { const [y, m, d] = String(s).slice(0, 10).split('-').map(Number); return new Date(y, m - 1, d); }
function lnEOM(y, m) { return new Date(y, m + 1, 0); }
function lnMe() { const u = (typeof getCurrentUser === 'function' && getCurrentUser()) || {}; return { email: String(u.email || '').toLowerCase(), name: u.name || u.email || '', role: u.role || '' }; }
function lnIsSuper() { return typeof superAdminIsMe === 'function' && superAdminIsMe(); }
function lnIsAdminRole() { return typeof normalizeRole === 'function' && normalizeRole(lnMe().role) === 'admin'; }
function lnCanManage() { return lnIsAdminRole() || lnIsSuper() || (typeof canEditModule === 'function' && canEditModule('loans')); } // HR
function lnCfg() { return Object.assign({}, LN_DEF, LN.cfg || {}); }
function lnTemplate() { return (LN.tpl && LN.tpl.text) || LN_DEF_TEMPLATE; }
function lnList(v) { return String(v || '').split(/[,;\s]+/).map(x => x.trim().toLowerCase()).filter(x => x.includes('@')); }

/* ---------- eligibility ---------- */
function lnTenureMonths(hire, now) {
  if (!hire) return null; const h = lnDate(hire), n = now ? new Date(now) : new Date(); if (isNaN(h)) return null;
  let m = (n.getFullYear() - h.getFullYear()) * 12 + (n.getMonth() - h.getMonth()); if (n.getDate() < h.getDate()) m--; return Math.max(0, m);
}
function lnTenureText(m) { if (m == null) return 'walang hire date'; const y = Math.floor(m / 12), r = m % 12; return (y ? y + ' taon ' : '') + (r || !y ? r + ' buwan' : '').trim(); }
function lnActiveLoans(empDocId, loans) { return (loans || []).filter(l => l.empDocId === empDocId && ['Pending', 'Approved', 'Active'].includes(l.status)); }
// {ok, reasons[], months, forced}
function lnEligibility(emp, cfg, loans, now) {
  cfg = cfg || lnCfg(); const reasons = [], months = lnTenureMonths(emp.hireDate, now); let forced = false;
  if ((emp.status || 'Active') !== 'Active') reasons.push('Hindi Active ang empleyado (' + (emp.status || '') + ').');
  if (months == null) reasons.push('Walang Hire Date sa profile.');
  else if (months < cfg.minTenureMonths) { if (emp.loanForce) forced = true; else reasons.push('Kulang pa ang tenure: ' + lnTenureText(months) + ' (kailangan ' + lnTenureText(cfg.minTenureMonths) + ').'); }
  else if (emp.loanForce) forced = false;
  const act = lnActiveLoans(emp.id, loans); if (act.length >= (+cfg.maxActive || 1)) reasons.push('May ' + act.length + ' aktibong/pending na loan na (' + act.map(l => l.id).join(', ') + ').');
  return { ok: !reasons.length, reasons, months, forced };
}

/* ---------- schedule ---------- */
// kasunod na cut-off (15 o katapusan) na >= date
function lnSnapCutoff(iso, freq) {
  const d = lnDate(iso), y = d.getFullYear(), m = d.getMonth(), day = d.getDate(), eom = lnEOM(y, m);
  if (freq === 'monthly') return lnISO(eom);
  if (day <= 15) return lnISO(new Date(y, m, 15)); return lnISO(eom);
}
function lnNextDue(iso, freq) {
  const d = lnDate(iso), y = d.getFullYear(), m = d.getMonth();
  if (freq === 'monthly') return lnISO(lnEOM(y, m + 1));
  if (d.getDate() <= 15) return lnISO(lnEOM(y, m)); return lnISO(new Date(y, m + 1, 15));
}
function lnSchedule(amount, term, freq, startISO) {
  amount = lnR2(amount); term = +term; const n = freq === 'cutoff' ? term * 2 : term; if (!(n > 0) || !(amount > 0)) return [];
  const per = Math.floor(amount / n * 100) / 100; let due = lnSnapCutoff(startISO, freq); const out = []; let left = amount;
  for (let i = 1; i <= n; i++) { const amt = i === n ? lnR2(left) : per; out.push({ n: i, due, amt, paid: false }); left = lnR2(left - amt); due = lnNextDue(due, freq); }
  return out;
}
function lnBalance(l) { return lnR2((l.schedule || []).reduce((s, x) => s + (x.paid ? 0 : x.amt), 0)); }
function lnPaidAmt(l) { return lnR2((l.schedule || []).reduce((s, x) => s + (x.paid ? x.amt : 0), 0)); }

/* ---------- approvers ---------- */
async function lnFallbackPresident() { try { const d = await db.collection('system_settings').doc('request_approvers').get(); return d.exists ? lnList(d.data().presidentEmail) : []; } catch (e) { return []; } }
function lnPresidentEmails(company, cfg, fallback) {
  cfg = cfg || lnCfg(); const p = (cfg.presidents || {})[company]; let l = lnList(p); if (!l.length) l = lnList(cfg.presidentEmail); if (!l.length) l = fallback || []; return l;
}
async function lnApproverEmails(company) { return lnPresidentEmails(company, lnCfg(), await lnFallbackPresident()); }
async function lnCanApprove(l) {
  if (lnIsSuper()) return true; const me = lnMe(); if (lnCfg().allowAdmin && lnIsAdminRole()) return true;
  return (await lnApproverEmails(l.company)).includes(me.email);
}

/* ---------- load ---------- */
async function loadLoans() {
  const root = document.getElementById('loan-root'); if (!root) return; LN.self = false; root.innerHTML = '<p style="padding:1rem;">Naglo-load…</p>';
  try {
    const [c, t, l, e] = await Promise.all([db.collection('system_settings').doc('loan_config').get(), db.collection('system_settings').doc('loan_template').get(), db.collection('loans').get(), db.collection('employees').get()]);
    LN.cfg = c.exists ? c.data() : null; LN.tpl = t.exists ? t.data() : null;
    LN.loans = l.docs.map(d => Object.assign({ id: d.id }, d.data())).sort((a, b) => String(b.filedAt || '').localeCompare(String(a.filedAt || '')));
    LN.emps = e.docs.map(d => Object.assign({ id: d.id }, d.data())).sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
    LN.loaded = true;
  } catch (er) { root.innerHTML = '<p style="padding:1rem;color:#dc2626;">Hindi ma-load: ' + lnEsc(er.message) + '</p>'; return; }
  lnRender();
}
function lnTab(t) { LN.tab = t; lnRender(); }
function lnRender() {
  const root = document.getElementById('loan-root'); if (!root) return;
  const tabs = [['list', '📋 Mga Loan'], ['tpl', '📄 Contract Template']]; if (lnIsSuper()) tabs.push(['setup', '⚙️ Setup (Super Admin)']);
  if (!tabs.find(x => x[0] === LN.tab)) LN.tab = 'list';
  let h = `<div style="padding:1rem;"><h2 style="margin:0 0 .6rem;">🏦 Loan Management</h2><div style="display:flex;gap:.4rem;flex-wrap:wrap;margin-bottom:.8rem;">${tabs.map(t => `<button class="btn ${LN.tab === t[0] ? 'btn-primary' : 'btn-secondary'}" onclick="lnTab('${t[0]}')">${t[1]}</button>`).join('')}</div>`;
  h += LN.tab === 'list' ? lnHtmlList() : LN.tab === 'tpl' ? lnHtmlTpl() : lnHtmlSetup(); root.innerHTML = h + '</div>';
}

/* ---------- listahan ---------- */
function lnHtmlList() {
  const cfg = lnCfg(), q = LN.q.toLowerCase(), f = LN.filter;
  const rows = LN.loans.filter(l => (f === 'all' || l.status === f) && (!q || (l.name + ' ' + l.empId + ' ' + l.id + ' ' + l.company).toLowerCase().includes(q)));
  const cnt = s => LN.loans.filter(l => l.status === s).length, out = LN.loans.filter(l => ['Active', 'Approved'].includes(l.status)).reduce((s, l) => s + lnBalance(l), 0);
  let h = `<div style="display:flex;gap:.6rem;flex-wrap:wrap;margin-bottom:.8rem;font-size:.85rem;"><span>⏳ Pending: <b>${cnt('Pending')}</b></span><span>✅ Aktibo: <b>${cnt('Active')}</b></span><span>Kabuuang balanse: <b>₱${lnMoney(out)}</b></span><span style="color:#64748b;">Limit ₱${lnMoney(cfg.maxAmount)} · Tenure ${lnTenureText(cfg.minTenureMonths)}</span></div>
  <div style="display:flex;gap:.5rem;flex-wrap:wrap;margin-bottom:.8rem;"><button class="btn btn-success" onclick="lnNew()">➕ Bagong Loan</button>
  <select onchange="LN.filter=this.value;lnRender()">${['all', 'Pending', 'Approved', 'Active', 'Paid', 'Rejected', 'Cancelled'].map(s => `<option value="${s}" ${f === s ? 'selected' : ''}>${s === 'all' ? 'Lahat' : s}</option>`).join('')}</select>
  <input type="text" placeholder="Hanapin pangalan / ID" value="${lnEsc(LN.q)}" onchange="LN.q=this.value;lnRender()"></div>`;
  if (!rows.length) return h + '<p style="color:#64748b;">Wala pang loan.</p>';
  h += `<div style="overflow:auto;"><table class="data-table" style="width:100%;font-size:.85rem;"><thead><tr><th>ID</th><th>Empleyado</th><th>Kumpanya</th><th>Halaga</th><th>Term</th><th>Balanse</th><th>Status</th><th></th></tr></thead><tbody>`;
  rows.forEach(l => { h += `<tr><td>${lnEsc(l.id)}</td><td>${lnEsc(l.name)}<br><small>${lnEsc(l.empId || '')}</small></td><td>${lnEsc(l.company || '')}</td><td>₱${lnMoney(l.amount)}</td><td>${l.term} mo · ${l.freq === 'cutoff' ? 'cut-off' : 'monthly'}</td><td>₱${lnMoney(lnBalance(l))}</td><td><span style="background:${LN_STAT_CLR[l.status] || '#64748b'};color:#fff;padding:.1rem .5rem;border-radius:1rem;font-size:.75rem;">${l.status}</span></td><td><button class="btn btn-secondary" onclick="lnOpen('${l.id}')">Buksan</button></td></tr>`; });
  return h + '</tbody></table></div>';
}

/* ---------- bagong loan ---------- */
function lnNew() {
  if (!lnCanManage()) { alert('HR/Admin lang ang makakapag-file ng loan.'); return; }
  const cfg = lnCfg(); const opts = LN.emps.filter(e => (e.status || 'Active') === 'Active');
  arModal(`<h3>➕ Bagong Loan</h3>
  <div class="form-group"><label>Empleyado</label><select id="ln-emp" onchange="lnNewCheck()" style="width:100%;"><option value="">— pumili —</option>${opts.map(e => `<option value="${e.id}">${lnEsc(e.name || '')} (${lnEsc(e.empId || '')})</option>`).join('')}</select></div>
  <div id="ln-elig" style="margin:.4rem 0;font-size:.85rem;"></div>
  <div id="ln-form" style="display:none;">
    <div class="form-group"><label>Halaga (max ₱${lnMoney(cfg.maxAmount)})</label><input type="number" id="ln-amt" min="1" max="${cfg.maxAmount}" step="0.01" oninput="lnNewPrev()"></div>
    <div class="form-group"><label>Layunin / Purpose</label><textarea id="ln-purpose" rows="2" style="width:100%;" placeholder="Hal.: Medical, tuition, emergency…"></textarea></div>
    <div class="form-group"><label>Term</label><select id="ln-term" onchange="lnNewPrev()">${cfg.termOptions.map(t => `<option value="${t}">${t} buwan</option>`).join('')}</select></div>
    <div class="form-group"><label>Kaltas</label><select id="ln-freq" onchange="lnNewPrev()">${cfg.freqOptions.map(f => `<option value="${f}">${LN_FREQ[f]}</option>`).join('')}</select></div>
    <div class="form-group"><label>Unang kaltas (mag-sisnap sa susunod na cut-off)</label><input type="date" id="ln-start" value="${lnISO(new Date())}" onchange="lnNewPrev()"></div>
    <div id="ln-prev" style="font-size:.82rem;background:#f8fafc;padding:.5rem;border-radius:.4rem;margin-bottom:.6rem;"></div>
    <button class="btn btn-success" onclick="lnNewSave()">📨 I-file para sa Approval</button></div>`);
}
function lnNewEmp() { const id = (document.getElementById('ln-emp') || {}).value; return LN.emps.find(e => e.id === id); }
function lnNewCheck() {
  const e = lnNewEmp(), box = document.getElementById('ln-elig'), form = document.getElementById('ln-form'); if (!e) { box.innerHTML = ''; form.style.display = 'none'; return; }
  const r = lnEligibility(e, lnCfg(), LN.loans); box.innerHTML = r.ok ? `<span style="color:#16a34a;">✅ Eligible — tenure ${lnTenureText(r.months)}${r.forced ? ' (pinayagan ni HR/Admin kahit kulang ang tenure ✔)' : ''}</span>` : `<span style="color:#dc2626;">⛔ ${r.reasons.map(lnEsc).join('<br>')}</span>`;
  form.style.display = r.ok ? 'block' : 'none'; if (r.ok) lnNewPrev();
}
function lnNewVals() { const g = id => (document.getElementById(id) || {}).value; return { amount: lnR2(g('ln-amt')), purpose: String(g('ln-purpose') || '').trim(), term: +g('ln-term'), freq: g('ln-freq'), start: g('ln-start') }; }
function lnNewPrev() {
  const v = lnNewVals(), el = document.getElementById('ln-prev'); if (!el) return; if (!(v.amount > 0) || !v.start) { el.innerHTML = ''; return; }
  const s = lnSchedule(v.amount, v.term, v.freq, v.start); el.innerHTML = `${s.length} hulog × ₱${lnMoney(s[0] && s[0].amt)} · una: ${s[0] ? s[0].due : '-'} · huli: ${s.length ? s[s.length - 1].due : '-'}`;
}
async function lnNewSave() {
  const e = LN.self ? LN.my.emp : lnNewEmp(), v = lnNewVals(), cfg = lnCfg(); if (!e) return;
  const r = lnEligibility(e, cfg, LN.loans); if (!r.ok) { alert(r.reasons.join('\n')); return; }
  if (!(v.amount > 0)) { alert('Ilagay ang halaga.'); return; } if (v.amount > cfg.maxAmount) { alert('Lampas sa limit na ₱' + lnMoney(cfg.maxAmount)); return; }
  if (!v.purpose) { alert('Ilagay ang purpose.'); return; } if (!cfg.termOptions.includes(v.term) || !cfg.freqOptions.includes(v.freq) || !v.start) { alert('Kulang o maling term/kaltas/petsa.'); return; }
  const me = lnMe(), now = new Date().toISOString(), id = 'LN-' + Date.now().toString(36).toUpperCase(); const sched = lnSchedule(v.amount, v.term, v.freq, v.start);
  const rec = { empDocId: e.id, empId: e.empId || '', name: e.name || '', email: String(e.email || '').toLowerCase(), company: (Array.isArray(e.companies) && e.companies[0]) || String(e.company || '').split(',')[0].trim(), branch: e.branch || '', position: e.role || '', hireDate: e.hireDate || '',
    amount: v.amount, purpose: v.purpose, term: v.term, freq: v.freq, startDate: sched[0].due, installment: sched[0].amt, schedule: sched, status: 'Pending', forced: !!r.forced, filedBy: me.email, filedByName: me.name, filedAt: now, selfFiled: !!LN.self, log: [{ at: now, by: me.email, act: (LN.self ? 'Na-file ng empleyado' : 'Na-file') + (r.forced ? ' (force-allow)' : '') }] };
  try {
    await db.collection('loans').doc(id).set(rec); LN.loans.unshift(Object.assign({ id }, rec));
    try { await logSystemAction('LOAN_FILED', `${id}: ${rec.name} ₱${lnMoney(rec.amount)} / ${rec.term} mo — ${rec.purpose}`); } catch (x) {}
    const to = await lnApproverEmails(rec.company); const subj = `🏦 Loan request: ${rec.name} — ₱${lnMoney(rec.amount)}`;
    await notify(to.length ? to : ['president'], subj, `${rec.name} (${rec.empId}) · ${rec.company}\nHalaga: ₱${lnMoney(rec.amount)} · ${rec.term} buwan · ${LN_FREQ[rec.freq]}\nPurpose: ${rec.purpose}\nIna-file ni: ${me.name}\n\nPara sa inyong approval sa Loan Management.`);
    arCloseModal(); (LN.self ? lnMyRender() : lnRender()); alert('✅ Na-file at naipadala ang notification/email sa President.');
  } catch (er) { alert('Hindi na-save: ' + er.message); }
}

/* ---------- detalye ---------- */
async function lnOpen(id) {
  const l = LN.loans.find(x => x.id === id); if (!l) return; const canApp = l.status === 'Pending' && await lnCanApprove(l), mg = lnCanManage();
  let h = `<h3>🏦 ${lnEsc(l.id)} — ${lnEsc(l.name)}</h3><div style="font-size:.88rem;line-height:1.6;">
  <b>${lnEsc(l.company)}</b> · ${lnEsc(l.position || '')} · Hire: ${lnEsc(l.hireDate || '-')}<br>
  Halaga: <b>₱${lnMoney(l.amount)}</b> · ${l.term} buwan · ${LN_FREQ[l.freq]} · ₱${lnMoney(l.installment)}/hulog<br>
  Purpose: ${lnEsc(l.purpose)}<br>Status: <b style="color:${LN_STAT_CLR[l.status]}">${l.status}</b>${l.forced ? ' · <span style="color:#b45309;">force-allow</span>' : ''}<br>
  Balanse: <b>₱${lnMoney(lnBalance(l))}</b> (nabayaran ₱${lnMoney(lnPaidAmt(l))})${l.decidedBy ? `<br>Desisyon: ${lnEsc(l.decidedBy)} · ${lnEsc((l.decidedAt || '').slice(0, 10))}${l.decisionNote ? ' — ' + lnEsc(l.decisionNote) : ''}` : ''}</div>`;
  h += `<div style="margin:.6rem 0;display:flex;gap:.4rem;flex-wrap:wrap;">`;
  if (canApp) h += `<button class="btn btn-success" onclick="lnDecide('${id}',true)">✅ Aprubahan</button><button class="btn btn-danger" onclick="lnDecide('${id}',false)">❌ I-reject</button>`;
  if (mg && ['Approved', 'Active'].includes(l.status)) h += `<button class="btn btn-primary" onclick="lnPrint('${id}')">🖨️ I-print ang Contract</button><label class="btn btn-secondary" style="cursor:pointer;">📤 I-upload ang Pirmadong Copy<input type="file" accept="image/*,application/pdf" style="display:none;" onchange="lnUploadSigned('${id}',this)"></label>`;
  if (l.signed) h += `<button class="btn btn-secondary" onclick="lnViewSigned('${id}')">👁 Pirmadong copy</button><button class="btn btn-secondary" onclick="reqDownload('${l.signed.fileId}')">⬇</button>`;
  if (mg && ['Pending', 'Approved'].includes(l.status)) h += `<button class="btn btn-secondary" onclick="lnCancel('${id}')">🚫 Cancel</button>`;
  h += `</div>`;
  if (l.status === 'Approved') h += `<p style="font-size:.8rem;color:#b45309;">Aprubado na. I-print ang contract, papirmahan sa empleyado, saka i-upload ang pirmadong copy para maging Aktibo ang loan.</p>`;
  h += `<table class="data-table" style="width:100%;font-size:.82rem;"><thead><tr><th>#</th><th>Petsa ng kaltas</th><th>Halaga</th><th>Bayad na?</th></tr></thead><tbody>${(l.schedule || []).map((s, i) => `<tr><td>${s.n}</td><td>${s.due}</td><td>₱${lnMoney(s.amt)}</td><td>${l.status === 'Active' && mg ? `<input type="checkbox" ${s.paid ? 'checked' : ''} onchange="lnPay('${id}',${i},this.checked)">` : (s.paid ? '✔ ' + lnEsc((s.paidAt || '').slice(0, 10)) : '')}</td></tr>`).join('')}</tbody></table>`;
  h += `<details style="margin-top:.6rem;font-size:.78rem;color:#64748b;"><summary>Log</summary>${(l.log || []).map(x => `${lnEsc((x.at || '').slice(0, 16).replace('T', ' '))} · ${lnEsc(x.by)} · ${lnEsc(x.act)}`).join('<br>')}</details>`;
  arModal(h);
}
async function lnSaveLoan(l, patch, act) {
  const me = lnMe(), now = new Date().toISOString(); Object.assign(l, patch); l.log = (l.log || []).concat([{ at: now, by: me.email, act }]);
  const data = Object.assign({}, patch, { log: l.log }); await db.collection('loans').doc(l.id).update(data);
  try { await logSystemAction('LOAN_' + String(act).split(' ')[0].toUpperCase(), `${l.id} (${l.name}): ${act}`); } catch (e) {}
}
async function lnDecide(id, ok) {
  const l = LN.loans.find(x => x.id === id); if (!l || l.status !== 'Pending') return; if (!(await lnCanApprove(l))) { alert('President/Super Admin lang ang puwedeng mag-approve.'); return; }
  let note = ''; if (!ok) { const r = await uiPrompt('Dahilan ng pag-reject:', ''); if (r === null) return; note = r; } else if (!(await uiConfirm(`Aprubahan ang loan ni ${l.name} (₱${lnMoney(l.amount)})?`))) return;
  const me = lnMe(), now = new Date().toISOString();
  try {
    await lnSaveLoan(l, { status: ok ? 'Approved' : 'Rejected', decidedBy: me.email, decidedAt: now, decisionNote: note }, ok ? 'Approved' : 'Rejected: ' + note);
    const who = [l.filedBy, l.email].filter(Boolean); await notify(who, `🏦 Loan ${ok ? 'APRUBADO' : 'REJECTED'}: ${l.name}`, `${l.id} · ₱${lnMoney(l.amount)} · ${l.term} buwan\n${ok ? 'Aprubado na. Makipag-ugnayan sa HR para sa contract.' : 'Dahilan: ' + note}`);
    arCloseModal(); lnRender();
  } catch (e) { alert(e.message); }
}
async function lnCancel(id) { const l = LN.loans.find(x => x.id === id); if (!l || !(await uiConfirm('I-cancel ang loan na ito?'))) return; try { await lnSaveLoan(l, { status: 'Cancelled' }, 'Cancelled'); arCloseModal(); lnRender(); } catch (e) { alert(e.message); } }
async function lnPay(id, i, v) {
  const l = LN.loans.find(x => x.id === id); if (!l || !lnCanManage()) return; const me = lnMe(); const s = l.schedule.map(x => Object.assign({}, x)); s[i].paid = !!v; s[i].paidAt = v ? new Date().toISOString() : ''; s[i].paidBy = v ? me.email : '';
  const done = s.every(x => x.paid);
  try { await lnSaveLoan(l, { schedule: s, status: done ? 'Paid' : 'Active' }, `Hulog #${s[i].n} ${v ? 'bayad' : 'binawi'}`); lnOpen(id); lnRender(); } catch (e) { alert(e.message); }
}

/* ---------- contract ---------- */
function lnFillTemplate(text, l, presName) {
  const vals = { date: new Date().toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' }), name: l.name, empId: l.empId, position: l.position || 'empleyado', company: l.company, amount: lnMoney(l.amount),
    amountWords: typeof numberToWordsPHP === 'function' ? numberToWordsPHP(l.amount) : '', purpose: l.purpose, term: l.term, freq: l.freq === 'cutoff' ? 'kada cut-off (ika-15 at katapusan ng buwan)' : 'kada buwan (katapusan)', installment: lnMoney(l.installment), president: presName || '', branch: l.branch || '', loanId: l.id };
  const sched = `<table style="width:100%;border-collapse:collapse;font-size:12px;margin:6px 0;"><tr><th style="border:1px solid #333;padding:3px;">#</th><th style="border:1px solid #333;padding:3px;">Petsa</th><th style="border:1px solid #333;padding:3px;text-align:right;">Halaga</th></tr>${(l.schedule || []).map(s => `<tr><td style="border:1px solid #333;padding:3px;">${s.n}</td><td style="border:1px solid #333;padding:3px;">${s.due}</td><td style="border:1px solid #333;padding:3px;text-align:right;">₱${lnMoney(s.amt)}</td></tr>`).join('')}</table>`;
  let out = lnEsc(text).replace(/\{\{\s*schedule\s*\}\}/g, '\u0001SCHED\u0001').replace(/\{\{\s*(\w+)\s*\}\}/g, (m, k) => k in vals ? lnEsc(vals[k]) : m);
  return out.replace(/\n/g, '<br>').replace(/\u0001SCHED\u0001/g, sched);
}
async function lnPrint(id) {
  const l = LN.loans.find(x => x.id === id); if (!l) return; const pe = (await lnApproverEmails(l.company))[0] || ''; let pn = l.decidedBy || pe;
  try { if (pn) { const u = await db.collection('users').doc(String(pn).toLowerCase()).get(); if (u.exists && u.data().name) pn = u.data().name; } } catch (e) {}
  const body = `${typeof compHeaderHtml === 'function' ? compHeaderHtml(l.company) : ''}<div style="font-size:13px;line-height:1.55;">${lnFillTemplate(lnTemplate(), l, pn)}</div>`;
  printHtmlDoc('Loan Contract ' + l.id, body);
  if (!l.contractPrintedAt) { try { await lnSaveLoan(l, { contractPrintedAt: new Date().toISOString(), contractPrintedBy: lnMe().email }, 'Contract printed'); } catch (e) {} }
}
async function lnUploadSigned(id, inp) {
  const l = LN.loans.find(x => x.id === id), f = inp.files && inp.files[0]; if (!l || !f) return; if (!lnCanManage()) { alert('HR lang.'); return; }
  try { const r = await reqSaveFile(f, 'loan:' + id, 'loan-signed'); const me = lnMe();
    await lnSaveLoan(l, { signed: { fileId: r.id, name: r.name || f.name, at: new Date().toISOString(), by: me.email }, status: l.status === 'Approved' ? 'Active' : l.status }, 'Signed copy uploaded');
    lnOpen(id); lnRender(); alert('✅ Na-upload ang pirmadong contract. Aktibo na ang loan.');
  } catch (e) { alert(e.message); }
}
async function lnViewSigned(id) { const l = LN.loans.find(x => x.id === id); if (!l || !l.signed) return; try { const f = await reqLoadFile(l.signed.fileId); if (!f) { alert('Wala na ang file.'); return; } imgOpen(f.dataUrl); } catch (e) { alert(e.message); } }

/* ---------- template ---------- */
function lnHtmlTpl() {
  const ed = lnCanManage();
  return `<p style="font-size:.85rem;color:#64748b;">Default na contract na ipi-print ni HR. Mga placeholder na awtomatikong napupunan: <code>{{name}} {{empId}} {{position}} {{company}} {{branch}} {{amount}} {{amountWords}} {{purpose}} {{term}} {{freq}} {{installment}} {{schedule}} {{date}} {{president}} {{loanId}}</code></p>
  <textarea id="ln-tpl" rows="22" style="width:100%;font-family:monospace;font-size:.82rem;" ${ed ? '' : 'readonly'}>${lnEsc(lnTemplate())}</textarea><br>
  ${ed ? `<button class="btn btn-success" onclick="lnTplSave()">💾 I-save ang Template</button> <button class="btn btn-secondary" onclick="lnTplReset()">↩️ Ibalik sa default</button> <button class="btn btn-secondary" onclick="lnTplPreview()">🖨️ Preview</button>` : ''}${LN.tpl && LN.tpl.updatedBy ? `<p style="font-size:.75rem;color:#64748b;">Huling binago ni ${lnEsc(LN.tpl.updatedBy)} · ${lnEsc((LN.tpl.updatedAt || '').slice(0, 10))}</p>` : ''}`;
}
async function lnTplSave() { const t = document.getElementById('ln-tpl').value; if (!t.trim()) { alert('Blangko ang template.'); return; } const me = lnMe(); const d = { text: t, updatedBy: me.email, updatedAt: new Date().toISOString() }; try { await db.collection('system_settings').doc('loan_template').set(d); LN.tpl = d; try { await logSystemAction('LOAN_TEMPLATE', 'Binago ang loan contract template'); } catch (e) {} alert('✅ Na-save.'); lnRender(); } catch (e) { alert(e.message); } }
function lnTplReset() { document.getElementById('ln-tpl').value = LN_DEF_TEMPLATE; }
function lnTplPreview() {
  const t = document.getElementById('ln-tpl').value, s = lnSchedule(12000, 6, 'cutoff', lnISO(new Date())); const l = { id: 'LN-SAMPLE', name: 'JUAN DELA CRUZ', empId: 'EMP-00001', position: 'Cook', company: 'Sample Company', amount: 12000, purpose: 'Sample', term: 6, freq: 'cutoff', installment: s[0].amt, schedule: s };
  printHtmlDoc('Loan Contract Preview', `<div style="font-size:13px;line-height:1.55;">${lnFillTemplate(t, l, 'PRESIDENT')}</div>`);
}

/* ---------- setup (Super Admin) ---------- */
function lnHtmlSetup() {
  if (!lnIsSuper()) return '<p>Super Admin lang.</p>'; const c = lnCfg(), m = +c.minTenureMonths, yrs = m % 12 === 0 && m > 0;
  return `<div style="max-width:560px;">
  <div class="form-group"><label>Minimum tenure bago makautang</label><div style="display:flex;gap:.4rem;"><input type="number" id="lc-ten" min="0" value="${yrs ? m / 12 : m}"><select id="lc-unit"><option value="m" ${yrs ? '' : 'selected'}>buwan</option><option value="y" ${yrs ? 'selected' : ''}>taon</option></select></div><small>Hal.: 1 taon, 2 taon, 3 taon, o 6 buwan. Puwedeng i-override per empleyado (checkbox sa Employee profile).</small></div>
  <div class="form-group"><label>Pinakamataas na halaga (₱)</label><input type="number" id="lc-max" min="1" value="${c.maxAmount}"></div>
  <div class="form-group"><label>Mga pagpipiliang term (buwan, may kuwit)</label><input type="text" id="lc-terms" value="${c.termOptions.join(', ')}"></div>
  <div class="form-group"><label>Paraan ng kaltas</label><label><input type="checkbox" id="lc-f-cutoff" ${c.freqOptions.includes('cutoff') ? 'checked' : ''}> Kada cut-off (15th & katapusan)</label><br><label><input type="checkbox" id="lc-f-monthly" ${c.freqOptions.includes('monthly') ? 'checked' : ''}> Kada buwan (katapusan)</label></div>
  <div class="form-group"><label>Max na sabay na aktibo/pending na loan kada empleyado</label><input type="number" id="lc-act" min="1" value="${c.maxActive}"></div>
  <div class="form-group"><label>Email ng President (default, lahat ng kumpanya)</label><input type="email" id="lc-pres" value="${lnEsc(c.presidentEmail)}" style="width:100%;" placeholder="blangko = gamitin ang President sa Mga Request → Approvers"></div>
  <div class="form-group"><label>President kada kumpanya (opsyonal)</label><div id="lc-comps"><small>Naglo-load ng mga kumpanya…</small></div></div>
  <label><input type="checkbox" id="lc-adm" ${c.allowAdmin ? 'checked' : ''}> Payagan din ang ibang Admin na mag-approve (hindi lang President/Super Admin)</label><br><br>
  <button class="btn btn-success" onclick="lnCfgSave()">💾 I-save ang Setup</button>${c.updatedBy ? `<p style="font-size:.75rem;color:#64748b;">Huling binago ni ${lnEsc(c.updatedBy)} · ${lnEsc((c.updatedAt || '').slice(0, 10))}</p>` : ''}</div>${lnLoadComps()}`;
}
function lnLoadComps() {
  setTimeout(async () => { const box = document.getElementById('lc-comps'); if (!box) return; let names = []; try { const s = await db.collection('companies').get(); names = s.docs.map(d => d.data().legalName || d.data().name || d.id); } catch (e) {}
    const pr = lnCfg().presidents || {}; names = [...new Set(names.concat(Object.keys(pr)))].filter(Boolean);
    box.innerHTML = names.length ? names.map((n, i) => `<div style="display:flex;gap:.4rem;margin-bottom:.3rem;"><span style="min-width:40%;font-size:.82rem;">${lnEsc(n)}</span><input type="email" class="lc-pc" data-co="${lnEsc(n)}" value="${lnEsc(pr[n] || '')}" style="flex:1;"></div>`).join('') : '<small>Walang nakalistang kumpanya.</small>'; }, 0);
  return '';
}
async function lnCfgSave() {
  if (!lnIsSuper()) { alert('Super Admin lang.'); return; } const g = id => (document.getElementById(id) || {}).value, ck = id => !!(document.getElementById(id) || {}).checked;
  let ten = Math.round(+g('lc-ten')); if (!(ten >= 0)) { alert('Maling tenure.'); return; } if (g('lc-unit') === 'y') ten *= 12;
  const terms = [...new Set(String(g('lc-terms')).split(/[,\s]+/).map(Number).filter(n => n > 0 && n <= 60))].sort((a, b) => a - b); if (!terms.length) { alert('Maglagay ng kahit isang term.'); return; }
  const fr = []; if (ck('lc-f-cutoff')) fr.push('cutoff'); if (ck('lc-f-monthly')) fr.push('monthly'); if (!fr.length) { alert('Pumili ng kahit isang paraan ng kaltas.'); return; }
  const mx = +g('lc-max'); if (!(mx > 0)) { alert('Maling max na halaga.'); return; }
  const pres = {}; document.querySelectorAll('.lc-pc').forEach(i => { const v = i.value.trim().toLowerCase(); if (v) pres[i.dataset.co] = v; });
  const d = { minTenureMonths: ten, maxAmount: mx, termOptions: terms, freqOptions: fr, maxActive: Math.max(1, +g('lc-act') || 1), presidentEmail: String(g('lc-pres')).trim().toLowerCase(), presidents: pres, allowAdmin: ck('lc-adm'), updatedBy: lnMe().email, updatedAt: new Date().toISOString() };
  try { await db.collection('system_settings').doc('loan_config').set(d); LN.cfg = d; try { await logSystemAction('LOAN_CONFIG', `Tenure ${ten}mo, max ₱${mx}, terms ${terms.join('/')}`); } catch (e) {} alert('✅ Na-save ang setup.'); lnRender(); } catch (e) { alert(e.message); }
}

/* ---------- Employee profile: force-allow checkbox (tinatawag ng app.js) ---------- */
function lnForceInfoHtml(e) {
  if (!e || !(e.loanForce || (e.loanForceLog || []).length)) return '';
  const last = (e.loanForceLog || []).slice(-1)[0]; return last ? `Huling: ${last.on ? 'PINAYAGAN' : 'inalis'} ni ${lnEsc(last.by)} noong ${lnEsc(String(last.at || '').slice(0, 10))}` : '';
}
async function lnForceSave(empDocId, checked, oldEmp) {
  const was = !!(oldEmp && oldEmp.loanForce); if (!empDocId || was === !!checked) return; const me = lnMe(), at = new Date().toISOString();
  const entry = { on: !!checked, by: me.email, at };
  await db.collection('employees').doc(empDocId).update({ loanForce: !!checked, loanForceBy: me.email, loanForceAt: at, loanForceLog: firebase.firestore.FieldValue.arrayUnion(entry) });
  if (oldEmp) { oldEmp.loanForce = !!checked; oldEmp.loanForceLog = (oldEmp.loanForceLog || []).concat([entry]); }
  try { await logSystemAction('LOAN_FORCE', `${checked ? 'Pinayagang mag-loan' : 'Inalis ang pahintulot mag-loan'}: ${(oldEmp && oldEmp.name) || empDocId}`); } catch (e) {}
}

/* ---------- SELF-APPLY (empleyado, sa branch.html → "Loan Ko") ---------- */
async function loadMyLoans() {
  const root = document.getElementById('loan-my-root'); if (!root) return; LN.self = true; root.innerHTML = '<p style="padding:1rem;">Naglo-load…</p>'; const me = lnMe();
  try {
    const c = await db.collection('system_settings').doc('loan_config').get(); LN.cfg = c.exists ? c.data() : null;
    const es = await db.collection('employees').where('email', '==', me.email).get(); const ed = es.docs[0];
    LN.my = { emp: ed ? Object.assign({ id: ed.id }, ed.data()) : null };
    const ls = await db.collection('loans').where('email', '==', me.email).get(); LN.loans = ls.docs.map(d => Object.assign({ id: d.id }, d.data())).sort((a, b) => String(b.filedAt || '').localeCompare(String(a.filedAt || '')));
  } catch (er) { root.innerHTML = '<p style="padding:1rem;color:#dc2626;">Hindi ma-load: ' + lnEsc(er.message) + '</p>'; return; }
  lnMyRender();
}
function lnMyRender() {
  const root = document.getElementById('loan-my-root'); if (!root) return; const cfg = lnCfg(), e = LN.my && LN.my.emp;
  let h = '<div style="padding:1rem;max-width:720px;"><h2 style="margin:0 0 .6rem;">🏦 Loan Ko</h2>';
  if (!e) return root.innerHTML = h + '<p>Walang employee record na naka-link sa email mo. Ipa-lagay kay HR ang email mo sa Employee profile.</p></div>';
  const r = lnEligibility(e, cfg, LN.loans);
  h += `<p style="font-size:.85rem;color:#64748b;">Limit ₱${lnMoney(cfg.maxAmount)} · kailangan ng ${lnTenureText(cfg.minTenureMonths)} na serbisyo · aaprubahan ng President.</p>`;
  if (r.ok) {
    h += `<div style="color:#16a34a;font-size:.85rem;margin-bottom:.5rem;">✅ Puwede kang mag-loan — tenure ${lnTenureText(r.months)}</div>
    <div class="form-group"><label>Halaga (max ₱${lnMoney(cfg.maxAmount)})</label><input type="number" id="ln-amt" min="1" max="${cfg.maxAmount}" step="0.01" oninput="lnNewPrev()"></div>
    <div class="form-group"><label>Layunin / Purpose</label><textarea id="ln-purpose" rows="2" style="width:100%;" placeholder="Hal.: Medical, tuition, emergency…"></textarea></div>
    <div class="form-group"><label>Term</label><select id="ln-term" onchange="lnNewPrev()">${cfg.termOptions.map(t => `<option value="${t}">${t} buwan</option>`).join('')}</select></div>
    <div class="form-group"><label>Kaltas</label><select id="ln-freq" onchange="lnNewPrev()">${cfg.freqOptions.map(f => `<option value="${f}">${LN_FREQ[f]}</option>`).join('')}</select></div>
    <div class="form-group"><label>Unang kaltas</label><input type="date" id="ln-start" value="${lnISO(new Date())}" onchange="lnNewPrev()"></div>
    <div id="ln-prev" style="font-size:.82rem;background:#f8fafc;padding:.5rem;border-radius:.4rem;margin-bottom:.6rem;"></div>
    <button class="btn btn-success" onclick="lnNewSave()">📨 I-submit para sa Approval</button>`;
  } else h += `<div style="color:#dc2626;font-size:.88rem;margin-bottom:.5rem;">⛔ ${r.reasons.map(lnEsc).join('<br>')}</div>`;
  h += '<h3 style="margin-top:1.2rem;">Mga Loan ko</h3>';
  h += LN.loans.length ? LN.loans.map(l => `<div style="border:1px solid #e2e8f0;border-radius:.5rem;padding:.6rem;margin-bottom:.5rem;font-size:.85rem;"><b>${lnEsc(l.id)}</b> · ₱${lnMoney(l.amount)} · ${l.term} buwan · <span style="background:${LN_STAT_CLR[l.status] || '#64748b'};color:#fff;padding:.05rem .5rem;border-radius:1rem;font-size:.75rem;">${l.status}</span><br>Balanse: ₱${lnMoney(lnBalance(l))} · Purpose: ${lnEsc(l.purpose)}${l.status === 'Approved' ? '<br><small style="color:#b45309;">Aprubado na — makipag-ugnayan kay HR para sa contract.</small>' : ''}${l.status === 'Rejected' && l.decisionNote ? '<br><small>Dahilan: ' + lnEsc(l.decisionNote) + '</small>' : ''}<br>${l.status === 'Pending' ? `<button class="btn btn-secondary" onclick="lnMyCancel('${l.id}')">🚫 I-cancel</button> ` : ''}<button class="btn btn-secondary" onclick="lnMySched('${l.id}')">Iskedyul</button></div>`).join('') : '<p style="color:#64748b;">Wala pa.</p>';
  root.innerHTML = h + '</div>'; if (r.ok) lnNewPrev();
}
function lnMySched(id) { const l = LN.loans.find(x => x.id === id); if (!l) return; arModal(`<h3>${lnEsc(l.id)}</h3><table class="data-table" style="width:100%;font-size:.82rem;"><thead><tr><th>#</th><th>Petsa</th><th>Halaga</th><th></th></tr></thead><tbody>${(l.schedule || []).map(s => `<tr><td>${s.n}</td><td>${s.due}</td><td>₱${lnMoney(s.amt)}</td><td>${s.paid ? '✔' : ''}</td></tr>`).join('')}</tbody></table>`); }
async function lnMyCancel(id) {
  const l = LN.loans.find(x => x.id === id); if (!l || l.status !== 'Pending' || !(await uiConfirm('I-cancel ang loan request?'))) return;
  try { l.status = 'Cancelled'; l.log = (l.log || []).concat([{ at: new Date().toISOString(), by: lnMe().email, act: 'Cancelled ng empleyado' }]); await db.collection('loans').doc(id).update({ status: 'Cancelled', log: l.log }); lnMyRender(); } catch (e) { alert(e.message); }
}
