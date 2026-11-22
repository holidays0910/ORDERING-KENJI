/* 💬 KusinaERP Messenger — chat (1-on-1 at group), text/emoji/larawan/GIF/voice/video, delete for me / for everyone.
   Firestore: chat_directory/{email} · chats/{id} · chats/{id}/messages/{mid} · chats/{id}/media/{mid}_{n}
   Walang Firebase Storage: ang media ay naka-base64 sa Firestore (hinahati sa 700 KB chunks). */
(function () {
  if (window.kMsg) return;
  const E = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const K = e => String(e || '').toLowerCase().replace(/[.#$\[\]\/]/g, '_');
  const LIM = { img: 1280, gif: 1400000, video: 5 * 1024 * 1024, voice: 120, chunk: 700000 };
  const EMO = '😀 😃 😄 😁 😆 😅 😂 🤣 😊 😇 🙂 😉 😍 🥰 😘 😋 😎 🤩 🥳 😏 😒 😞 😔 😢 😭 😤 😡 🤯 😱 😴 🤔 🙄 😬 🤗 🤝 👍 👎 👏 🙌 🙏 💪 👌 ✌️ 🤞 👋 ❤️ 🧡 💛 💚 💙 💜 🔥 ✨ 🎉 🎂 🍕 🍔 🍟 🍜 🍣 🍗 ☕ 🍺 ✅ ❌ ⚠️ ❓ 💯 👀 🙈 🚀 🛒 💰 📌 📅 ⏰'.split(' ');
  let ME = null, CH = [], CUR = null, MSGS = [], DIR = [], offC = null, offM = null, open = false, first = true, rec = null, view = 'list';
  const MC = new Map(); let seenAt = {};
  const db_ = () => { try { if (window.db) return window.db; } catch (e) {} try { if (typeof db !== 'undefined' && db && db.collection) return db; } catch (e) {} try { if (window.firebase && firebase.apps && firebase.apps.length) return (window.db = firebase.firestore()); } catch (e) {} return null; }, now = () => new Date().toISOString();
  const nm = e => { const d = DIR.find(x => x.email === e); return d ? d.name : e; };
  function who() { try { let u = null; try { u = (typeof getCurrentUser === 'function' ? getCurrentUser() : null); } catch (e) {} if (!u) { try { u = JSON.parse(localStorage.getItem('kusina_current_user') || 'null'); } catch (e) {} } u = u || {}; const a = (window.auth && auth.currentUser) || {}, e = String(u.email || a.email || '').toLowerCase(); return e ? { email: e, name: String(u.name || u.fullName || a.displayName || e.split('@')[0]), role: String(u.role || '') } : null; } catch (e) { return null; } }
  function css() {
    if (document.getElementById('km-css')) return; const s = document.createElement('style'); s.id = 'km-css'; s.textContent = `
:root{--km-bg:#fff;--km-fg:#0f172a;--km-mut:#64748b;--km-bd:#e2e8f0;--km-me:#2563eb;--km-oth:#f1f5f9}
@media (prefers-color-scheme:dark){:root:not([data-theme=light]){--km-bg:#1e293b;--km-fg:#f1f5f9;--km-mut:#94a3b8;--km-bd:#334155;--km-oth:#334155}}
#km-fab{position:fixed;right:14px;bottom:14px;z-index:9990;width:54px;height:54px;border-radius:50%;border:0;background:var(--km-me);color:#fff;font-size:26px;box-shadow:0 4px 14px #0005;cursor:pointer}
#km-fab b{position:absolute;top:-4px;right:-4px;background:#dc2626;color:#fff;border-radius:10px;font-size:12px;min-width:20px;padding:1px 5px}
#km-p{position:fixed;z-index:9995;right:0;bottom:0;width:min(860px,100vw);height:min(640px,100dvh);background:var(--km-bg);color:var(--km-fg);border:1px solid var(--km-bd);border-radius:12px 0 0 0;display:none;box-shadow:0 0 24px #0006;overflow:hidden}
#km-p.on{display:flex}#km-l{width:290px;border-right:1px solid var(--km-bd);display:flex;flex-direction:column}#km-c{flex:1;display:flex;flex-direction:column;min-width:0}
.km-h{padding:.6rem .8rem;border-bottom:1px solid var(--km-bd);display:flex;gap:.4rem;align-items:center;font-weight:700}.km-h .sp{flex:1}
.km-b{border:0;background:none;color:inherit;cursor:pointer;font-size:18px;padding:.2rem .4rem;border-radius:6px}.km-b:hover{background:var(--km-oth)}
.km-i{display:flex;gap:.5rem;padding:.55rem .8rem;cursor:pointer;border-bottom:1px solid var(--km-bd);align-items:center}.km-i:hover,.km-i.on{background:var(--km-oth)}
.km-av{width:38px;height:38px;border-radius:50%;background:#64748b;color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;flex:none}
.km-i .t{flex:1;min-width:0}.km-i .t div{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.km-i small{color:var(--km-mut)}.km-u{background:#dc2626;color:#fff;border-radius:10px;font-size:11px;padding:1px 6px}
#km-m{flex:1;overflow:auto;padding:.6rem;display:flex;flex-direction:column;gap:.25rem}
.km-g{max-width:78%;padding:.4rem .6rem;border-radius:14px;background:var(--km-oth);align-self:flex-start;word-break:break-word;position:relative}.km-g.me{background:var(--km-me);color:#fff;align-self:flex-end}
.km-g small{display:block;font-size:10px;opacity:.75}.km-g img,.km-g video{max-width:260px;max-height:300px;border-radius:8px;display:block}.km-g audio{max-width:240px}
.km-g.del{opacity:.6;font-style:italic}.km-g .mn{display:none;position:absolute;top:2px;right:4px;cursor:pointer}.km-g:hover .mn{display:block}.km-sys{align-self:center;font-size:12px;color:var(--km-mut)}
#km-f{border-top:1px solid var(--km-bd);padding:.5rem;display:flex;gap:.3rem;align-items:flex-end}#km-t{flex:1;resize:none;max-height:100px;border:1px solid var(--km-bd);border-radius:18px;padding:.5rem .8rem;background:var(--km-bg);color:var(--km-fg);font-size:16px;font-family:inherit}
#km-emo{display:none;flex-wrap:wrap;gap:2px;padding:.4rem;border-top:1px solid var(--km-bd);max-height:130px;overflow:auto}#km-emo span{font-size:24px;cursor:pointer;padding:2px}
.km-menu{position:fixed;z-index:9999;background:var(--km-bg);color:var(--km-fg);border:1px solid var(--km-bd);border-radius:8px;box-shadow:0 4px 16px #0005;overflow:hidden}.km-menu div{padding:.5rem .9rem;cursor:pointer;white-space:nowrap}.km-menu div:hover{background:var(--km-oth)}
.km-ov{position:fixed;inset:0;background:#0007;z-index:9998;display:flex;align-items:center;justify-content:center}.km-box{background:var(--km-bg);color:var(--km-fg);border-radius:12px;padding:1rem;width:min(420px,94vw);max-height:84dvh;overflow:auto}.km-box input[type=text],.km-box input:not([type]){width:100%;padding:.5rem;border:1px solid var(--km-bd);border-radius:8px;background:var(--km-bg);color:var(--km-fg);font-size:16px;margin:.3rem 0}
.km-btn{padding:.5rem .9rem;border:0;border-radius:8px;background:var(--km-me);color:#fff;cursor:pointer}.km-btn.s{background:var(--km-oth);color:var(--km-fg)}
.km-toast{position:fixed;right:14px;bottom:80px;z-index:9996;background:#0f172a;color:#fff;padding:.6rem .9rem;border-radius:10px;max-width:260px;cursor:pointer}
@media (max-width:760px){#km-p{width:100vw;height:100dvh;border-radius:0}#km-l{width:100%}#km-p.c #km-l{display:none}#km-p:not(.c) #km-c{display:none}}`; document.head.appendChild(s);
  }
  const $ = id => document.getElementById(id);
  const peer = c => c.type === 'dm' ? (c.members.find(x => x !== ME.email) || '') : '';
  const title = c => c.type === 'group' ? (c.name || 'Group') : ((c.names || {})[K(peer(c))] || nm(peer(c)));
  const unread = c => c.lastBy && c.lastBy !== ME.email && String(c.lastAt || '') > String((c.reads || {})[K(ME.email)] || '') && String(c.lastAt || '') > String((c.hidden || {})[K(ME.email)] || '');
  const vis = c => String(c.lastAt || c.createdAt || '') > String((c.hidden || {})[K(ME.email)] || '');
  const totalUn = () => CH.filter(c => vis(c) && unread(c)).length;
  function badge() { const f = $('km-fab'); if (!f || !ME) return; const n = totalUn(); f.innerHTML = '💬' + (n ? '<b>' + n + '</b>' : ''); const t = document.title.replace(/^\(\d+\) /, ''); document.title = n ? '(' + n + ') ' + t : t; }
  function beep() { try { const c = new (window.AudioContext || window.webkitAudioContext)(), o = c.createOscillator(); o.connect(c.destination); o.frequency.value = 660; o.start(); setTimeout(() => o.stop(), 150); } catch (e) {} }
  function toast(t, c) { const d = document.createElement('div'); d.className = 'km-toast'; d.textContent = t; d.onclick = () => { d.remove(); openChat(c.id); show(true); }; document.body.appendChild(d); setTimeout(() => d.remove(), 6000); }
  function listenChats() {
    if (offC) offC(); offC = db_().collection('chats').where('members', 'array-contains', ME.email).onSnapshot(sn => {
      const a = []; sn.forEach(d => a.push(Object.assign({ id: d.id }, d.data()))); a.sort((x, y) => String(y.lastAt || y.createdAt).localeCompare(String(x.lastAt || x.createdAt))); const prev = seenAt; CH = a; seenAt = {};
      a.forEach(c => { seenAt[c.id] = c.lastAt || ''; if (!first && unread(c) && String(c.lastAt) > String(prev[c.id] || '') && !(open && CUR && CUR.id === c.id)) { beep(); toast('💬 ' + title(c) + ': ' + (c.lastMsg || ''), c); try { if (document.hidden && window.Notification && Notification.permission === 'granted') new Notification(title(c), { body: c.lastMsg || '' }); } catch (e) {} } });
      first = false; badge(); if (open) drawList(); if (CUR) { const n = CH.find(x => x.id === CUR.id); if (n) { CUR = n; if (open && view === 'chat') { markRead(); drawHead(); } } }
    }, () => {});
  }
  async function loadDir() { try { const s = await db_().collection('chat_directory').get(); DIR = []; s.forEach(d => { const x = d.data(); if (x.email && x.email !== ME.email) DIR.push(x); }); DIR.sort((a, b) => String(a.name).localeCompare(b.name)); } catch (e) {} }
  async function build() {
    css(); if ($('km-fab')) return; const f = document.createElement('button'); f.id = 'km-fab'; f.title = 'Messenger'; f.onclick = () => { if (!ME) { alert('Messenger: ' + kMsg.status); return; } show(!open); }; document.body.appendChild(f); f.textContent = '💬';
    const p = document.createElement('div'); p.id = 'km-p'; p.innerHTML = '<div id="km-l"></div><div id="km-c"></div>'; document.body.appendChild(p); badge();
  }
  function show(on) { open = on; const p = $('km-p'); if (!p) return; p.classList.toggle('on', on); if (on) { try { if (window.Notification && Notification.permission === 'default') Notification.requestPermission(); } catch (e) {} loadDir().then(() => { drawList(); }); drawList(); drawConv(); } }
  function drawList() {
    const l = $('km-l'); if (!l) return; const q = (window._kmq || '').toLowerCase(), L = CH.filter(c => vis(c) && (!q || title(c).toLowerCase().includes(q)));
    l.innerHTML = `<div class="km-h">💬 Messenger<span class="sp"></span><button class="km-b" title="Bagong chat" onclick="kMsg.newChat()">✏️</button><button class="km-b" title="Bagong group" onclick="kMsg.newGroup()">👥</button><button class="km-b" onclick="kMsg.close()">✖</button></div><div style="padding:.4rem .6rem;"><input id="km-s" placeholder="🔎 Hanapin ang chat" value="${E(window._kmq || '')}" style="width:100%;padding:.4rem .7rem;border:1px solid var(--km-bd);border-radius:18px;background:var(--km-bg);color:var(--km-fg);font-size:16px;" oninput="window._kmq=this.value;clearTimeout(window._kmt);window._kmt=setTimeout(()=>kMsg._dl(),250)"></div><div style="overflow:auto;flex:1;">${L.map(c => `<div class="km-i ${CUR && CUR.id === c.id ? 'on' : ''}" onclick="kMsg.open('${c.id}')"><div class="km-av">${c.type === 'group' ? '👥' : E(title(c).charAt(0).toUpperCase())}</div><div class="t"><div><b>${E(title(c))}</b></div><div><small>${E(c.lastBy === ME.email ? 'Ikaw: ' : '')}${E(c.lastMsg || 'Wala pang mensahe')}</small></div></div>${unread(c) ? '<span class="km-u">●</span>' : ''}</div>`).join('') || '<div style="padding:1rem;color:var(--km-mut);">Wala pang chat. Pindutin ang ✏️ para magsimula.</div>'}</div>`;
    const s = $('km-s'); if (s && document.activeElement === document.body && window._kmq) { s.focus(); s.setSelectionRange(s.value.length, s.value.length); }
  }
  function drawConv() {
    const c = $('km-c'); if (!c) return; if (!CUR) { c.innerHTML = '<div style="margin:auto;color:var(--km-mut);padding:1rem;text-align:center;">Pumili ng chat sa kaliwa o magsimula ng bago ✏️<br><small>Hindi nababasa ng ibang user ang mga mensahe ninyo.</small></div>'; return; }
    c.innerHTML = `<div class="km-h" id="km-hd"></div><div id="km-m"></div><div id="km-emo">${EMO.map(e => `<span onclick="kMsg._emo('${e}')">${e}</span>`).join('')}</div><div id="km-f"><button class="km-b" title="Emoji" onclick="kMsg._tgEmo()">😊</button><button class="km-b" title="Larawan / GIF / Video" onclick="document.getElementById('km-file').click()">📎</button><input type="file" id="km-file" accept="image/*,video/*" style="display:none" onchange="kMsg.file(this)"><textarea id="km-t" rows="1" placeholder="Mag-type ng mensahe…" onkeydown="if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();kMsg.send()}"></textarea><button class="km-b" id="km-mic" title="Voice message" onclick="kMsg.mic()">🎤</button><button class="km-b" title="Ipadala" onclick="kMsg.send()">➤</button></div>`; drawHead(); drawMsgs();
  }
  function drawHead() { const h = $('km-hd'); if (!h || !CUR) return; h.innerHTML = `<button class="km-b" onclick="kMsg._back()" style="display:${innerWidth <= 760 ? 'inline' : 'none'}">◀</button><div class="km-av" style="width:30px;height:30px;">${CUR.type === 'group' ? '👥' : E(title(CUR).charAt(0).toUpperCase())}</div><span>${E(title(CUR))}${CUR.type === 'group' ? '<br><small style="font-weight:400;color:var(--km-mut);">' + CUR.members.length + ' miyembro</small>' : ''}</span><span class="sp"></span>${CUR.type === 'group' ? '<button class="km-b" title="Group" onclick="kMsg.group()">⚙️</button>' : ''}<button class="km-b" title="I-delete ang chat para sa akin" onclick="kMsg.delChat()">🗑️</button>`; }
  async function media(m) { if (m.media.d) return m.media.d; const k = m.id; if (MC.has(k)) return MC.get(k); let s = ''; for (let i = 0; i < m.media.chunks; i++) { const d = await db_().collection('chats').doc(CUR.id).collection('media').doc(m.id + '_' + i).get(); s += (d.data() || {}).d || ''; } MC.set(k, s); return s; }
  function mhtml(m) {
    const x = m.media, id = 'km-md-' + m.id; if (!x) return '';
    if (x.d) return m.kind === 'voice' ? `<audio controls src="${x.d}"></audio>` : m.kind === 'video' ? `<video controls playsinline src="${x.d}"></video>` : `<img src="${x.d}" onclick="kMsg.zoom(this.src)">`;
    return `<div id="${id}" style="cursor:pointer;" onclick="kMsg._ld('${m.id}')">${m.kind === 'voice' ? '🎤 I-play' : m.kind === 'video' ? '🎬 I-play ang video' : '🖼️ I-load ang larawan'} (${Math.round((x.size || 0) / 1024)} KB)</div>`;
  }
  function drawMsgs() {
    const box = $('km-m'); if (!box) return; const hid = String((CUR.hidden || {})[K(ME.email)] || ''), L = MSGS.filter(m => !(m.deletedFor || []).includes(ME.email) && String(m.at) > hid), near = box.scrollHeight - box.scrollTop - box.clientHeight < 120, lastMine = [...L].reverse().find(m => m.from === ME.email), others = (CUR.members || []).filter(e => e !== ME.email);
    box.innerHTML = L.map(m => { if (m.kind === 'sys') return `<div class="km-sys">${E(m.text)}</div>`; const me = m.from === ME.email, d = m.deletedAll; return `<div class="km-g ${me ? 'me' : ''} ${d ? 'del' : ''}" oncontextmenu="event.preventDefault();kMsg.menu(event,'${m.id}')"><span class="mn" onclick="kMsg.menu(event,'${m.id}')">⋮</span>${CUR.type === 'group' && !me ? `<small>${E(m.fromName || nm(m.from))}</small>` : ''}${d ? '🚫 Binura ang mensahe' : (mhtml(m) + (m.text ? `<div>${E(m.text).replace(/\n/g, '<br>')}</div>` : ''))}<small>${E(String(m.at).slice(11, 16))}${me && lastMine && lastMine.id === m.id && others.length && others.every(e => String((CUR.reads || {})[K(e)] || '') >= m.at) ? ' · Nabasa' : ''}</small></div>`; }).join('');
    if (near || first) box.scrollTop = box.scrollHeight;
  }
  function openChat(id) { const c = CH.find(x => x.id === id); if (!c) return; CUR = c; MSGS = []; view = 'chat'; $('km-p').classList.add('c'); if (offM) offM(); drawList(); drawConv(); const box = () => $('km-m');
    offM = db_().collection('chats').doc(id).collection('messages').orderBy('at').limitToLast(200).onSnapshot(sn => { MSGS = []; sn.forEach(d => MSGS.push(Object.assign({ id: d.id }, d.data()))); drawMsgs(); const b = box(); if (b) b.scrollTop = b.scrollHeight; markRead(); }, () => {}); markRead(); }
  function markRead() { if (!CUR || !open) return; if (String((CUR.reads || {})[K(ME.email)] || '') >= String(CUR.lastAt || '')) return; db_().collection('chats').doc(CUR.id).update({ ['reads.' + K(ME.email)]: now() }).catch(() => {}); }
  async function post(msg, preview) {
    if (!CUR) return; const t = now(), ref = db_().collection('chats').doc(CUR.id).collection('messages').doc(), id = ref.id;
    if (msg.media && msg._data && msg._data.length <= LIM.chunk) { msg.media.d = msg._data; msg.media.chunks = 0; } else if (msg.media && !msg.media.d) { const s = msg._data; for (let i = 0; i * LIM.chunk < s.length; i++) await db_().collection('chats').doc(CUR.id).collection('media').doc(id + '_' + i).set({ d: s.slice(i * LIM.chunk, (i + 1) * LIM.chunk), at: t }); msg.media.chunks = Math.ceil(s.length / LIM.chunk); } delete msg._data;
    await ref.set(Object.assign({ from: ME.email, fromName: ME.name, at: t, deletedFor: [], deletedAll: false }, msg));
    await db_().collection('chats').doc(CUR.id).update({ lastAt: t, lastBy: ME.email, lastMsg: String(preview).slice(0, 80), ['reads.' + K(ME.email)]: t });
  }
  const readFile = f => new Promise((ok, no) => { const r = new FileReader(); r.onload = () => ok(r.result); r.onerror = () => no(r.error); r.readAsDataURL(f); });
  async function shrink(f) { const url = await readFile(f), img = await new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = no; i.src = url; }), k = Math.min(1, LIM.img / Math.max(img.width, img.height)), c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k); c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); return { d: c.toDataURL('image/jpeg', 0.72), w: c.width, h: c.height }; }
  const kMsg = window.kMsg = {
    status: 'nagsisimula…',
    async init() {
      try {
        const w = who(); if (!w) { kMsg.status = 'Hindi pa naka-login (walang user)'; return setTimeout(() => kMsg.init(), 1500); } if (!db_()) { kMsg.status = 'Walang database — firebase.apps=' + (window.firebase && firebase.apps ? firebase.apps.length : 'walang firebase') + ', window.db=' + typeof window.db; return setTimeout(() => kMsg.init(), 1500); }
        if (ME && ME.email === w.email) return; ME = w; first = true; kMsg.status = 'OK: ' + ME.email;
        try { await db_().collection('chat_directory').doc(ME.email).set({ email: ME.email, name: ME.name, role: ME.role, seen: now() }, { merge: true }); } catch (e) { kMsg.status += ' · directory: ' + e.message; console.warn('[Messenger] directory', e); }
        await loadDir(); listenChats(); badge(); const f = $('km-fab'); if (f) f.style.display = '';
      } catch (e) { kMsg.status = 'Error: ' + e.message; console.error('[Messenger]', e); setTimeout(() => kMsg.init(), 3000); }
    },
    diag() { const s = 'Messenger v2 — ' + kMsg.status + (ME ? '' : '') + ' · chats: ' + CH.length; console.log(s); return s; },
    close() { show(false); }, _dl: drawList, open: openChat, _back() { view = 'list'; $('km-p').classList.remove('c'); },
    _tgEmo() { const e = $('km-emo'); e.style.display = e.style.display === 'flex' ? 'none' : 'flex'; }, _emo(e) { const t = $('km-t'); t.value += e; t.focus(); },
    zoom(src) { const o = document.createElement('div'); o.className = 'km-ov'; o.onclick = () => o.remove(); o.innerHTML = `<img src="${src}" style="max-width:96vw;max-height:94vh;">`; document.body.appendChild(o); },
    async _ld(id) { const m = MSGS.find(x => x.id === id), el = $('km-md-' + id); if (!m || !el) return; el.textContent = 'Nilo-load…'; try { const d = await media(m); el.outerHTML = mhtml(Object.assign({}, m, { media: Object.assign({}, m.media, { d }) })); } catch (e) { el.textContent = 'Hindi ma-load'; } },
    async send() { const t = $('km-t'), x = t.value.trim(); if (!x) return; t.value = ''; try { await post({ kind: 'text', text: x }, x); } catch (e) { alert('Hindi naipadala: ' + e.message); } },
    async file(inp) {
      const f = inp.files && inp.files[0]; inp.value = ''; if (!f) return; try {
        if (/^video\//.test(f.type)) { if (f.size > LIM.video) { alert('Masyadong malaki ang video. Hanggang ' + Math.round(LIM.video / 1048576) + ' MB lang (mga 15–30 segundo).'); return; } const d = await readFile(f); await post({ kind: 'video', text: '', media: { mime: f.type, size: d.length }, _data: d }, '🎬 Video'); }
        else if (f.type === 'image/gif') { if (f.size > LIM.gif) { alert('Masyadong malaki ang GIF (hanggang 1.4 MB).'); return; } const d = await readFile(f); await post({ kind: 'gif', text: '', media: { mime: 'image/gif', size: d.length }, _data: d }, 'GIF'); }
        else if (/^image\//.test(f.type)) { const r = await shrink(f); await post({ kind: 'image', text: '', media: { mime: 'image/jpeg', size: r.d.length, w: r.w, h: r.h }, _data: r.d }, '📷 Larawan'); }
        else alert('Larawan, GIF o video lang ang puwede.');
      } catch (e) { alert('Hindi naipadala: ' + e.message); }
    },
    async mic() {
      const b = $('km-mic'); if (rec) { rec.stop(); return; }
      try { const st = await navigator.mediaDevices.getUserMedia({ audio: true }), mr = new MediaRecorder(st), ch = [], t0 = Date.now(); rec = mr; b.textContent = '⏹️'; b.style.color = '#dc2626'; const tm = setTimeout(() => mr.state === 'recording' && mr.stop(), LIM.voice * 1000);
        mr.ondataavailable = e => e.data.size && ch.push(e.data); mr.onstop = async () => { clearTimeout(tm); st.getTracks().forEach(x => x.stop()); rec = null; b.textContent = '🎤'; b.style.color = ''; const blob = new Blob(ch, { type: mr.mimeType || 'audio/webm' }); if (!blob.size || Date.now() - t0 < 600) return; const d = await readFile(blob); try { await post({ kind: 'voice', text: '', media: { mime: blob.type, size: d.length, dur: Math.round((Date.now() - t0) / 1000) }, _data: d }, '🎤 Voice message'); } catch (e) { alert('Hindi naipadala: ' + e.message); } }; mr.start();
      } catch (e) { alert('Hindi ma-access ang mikropono. Payagan ito sa browser.'); }
    },
    menu(ev, id) {
      ev.stopPropagation(); document.querySelectorAll('.km-menu').forEach(x => x.remove()); const m = MSGS.find(x => x.id === id); if (!m || m.kind === 'sys') return; const d = document.createElement('div'); d.className = 'km-menu'; d.style.left = Math.min(ev.clientX, innerWidth - 210) + 'px'; d.style.top = Math.min(ev.clientY, innerHeight - 120) + 'px';
      d.innerHTML = `${m.text && !m.deletedAll ? '<div data-a="copy">📋 Kopyahin</div>' : ''}<div data-a="me">🙈 I-delete para sa akin</div>${m.from === ME.email && !m.deletedAll ? '<div data-a="all">🗑️ I-delete para sa lahat</div>' : ''}`; document.body.appendChild(d);
      d.onclick = async e => { const a = e.target.dataset.a; d.remove(); if (a === 'copy') navigator.clipboard && navigator.clipboard.writeText(m.text); if (a === 'me') await kMsg.delMe(id); if (a === 'all') await kMsg.delAll(id); }; setTimeout(() => document.addEventListener('click', () => d.remove(), { once: true }), 0);
    },
    async delMe(id) { try { await db_().collection('chats').doc(CUR.id).collection('messages').doc(id).update({ deletedFor: firebase.firestore.FieldValue.arrayUnion(ME.email) }); } catch (e) { alert('Error: ' + e.message); } },
    async delAll(id) {
      if (!confirm('I-delete ang mensaheng ito para sa lahat?')) return; const m = MSGS.find(x => x.id === id); try { await db_().collection('chats').doc(CUR.id).collection('messages').doc(id).update({ deletedAll: true, text: '', media: null, kind: 'text', deletedAt: now() });
        for (let i = 0; m && m.media && i < (m.media.chunks || 0); i++) { try { await db_().collection('chats').doc(CUR.id).collection('media').doc(id + '_' + i).delete(); } catch (e) {} }
        if (CUR.lastBy === ME.email && MSGS[MSGS.length - 1] && MSGS[MSGS.length - 1].id === id) await db_().collection('chats').doc(CUR.id).update({ lastMsg: '🚫 Binura ang mensahe' }); } catch (e) { alert('Error: ' + e.message); }
    },
    async delChat() { if (!CUR || !confirm('I-delete ang chat na ito para sa iyo? (Hindi mawawala sa kausap mo.)')) return; try { await db_().collection('chats').doc(CUR.id).update({ ['hidden.' + K(ME.email)]: now() }); CUR = null; if (offM) offM(); drawList(); drawConv(); } catch (e) { alert('Error: ' + e.message); } },
    _pick(title_, multi, cb) {
      const o = document.createElement('div'); o.className = 'km-ov'; o.innerHTML = `<div class="km-box"><b>${title_}</b>${multi === 'group' ? '<input id="km-gn" placeholder="Pangalan ng group" maxlength="60">' : ''}<input id="km-ps" placeholder="🔎 Hanapin ang tao (pangalan o email)"><div id="km-pl" style="max-height:300px;overflow:auto;"></div><div style="margin-top:.5rem;text-align:right;"><button class="km-btn s" id="km-no">Kanselahin</button> ${multi ? '<button class="km-btn" id="km-ok">Gumawa</button>' : ''}</div></div>`; document.body.appendChild(o); const sel = new Set();
      const draw = () => { const q = ($('km-ps').value || '').toLowerCase(), L = DIR.filter(d => !q || (d.name + ' ' + d.email).toLowerCase().includes(q)).slice(0, 80); $('km-pl').innerHTML = L.map(d => `<label class="km-i" style="cursor:pointer;">${multi ? `<input type="checkbox" data-e="${E(d.email)}" ${sel.has(d.email) ? 'checked' : ''}>` : ''}<div class="km-av">${E(String(d.name).charAt(0).toUpperCase())}</div><div class="t"><div><b>${E(d.name)}</b></div><div><small>${E(d.role || '')} · ${E(d.email)}</small></div></div></label>`).join('') || '<div style="padding:.6rem;color:var(--km-mut);">Walang nahanap. (Lalabas lang ang mga taong nakapag-login na pagkatapos i-install ang Messenger.)</div>'; $('km-pl').querySelectorAll('.km-i').forEach((el, idx) => { if (!multi) el.onclick = () => { o.remove(); cb([L[idx].email]); }; else { const ck = el.querySelector('input'); ck.onchange = () => { ck.checked ? sel.add(ck.dataset.e) : sel.delete(ck.dataset.e); }; } }); };
      $('km-ps').oninput = draw; draw(); $('km-no').onclick = () => o.remove(); if (multi) $('km-ok').onclick = () => { const n = ($('km-gn') || {}).value || ''; if (multi === 'group' && !n.trim()) { alert('Ilagay ang pangalan ng group.'); return; } if (!sel.size) { alert('Pumili ng kahit isang tao.'); return; } o.remove(); cb([...sel], n.trim()); };
    },
    async newChat() { await loadDir(); kMsg._pick('✏️ Sino ang kakausapin mo?', false, async ([em]) => {
      const id = 'dm_' + [ME.email, em].sort().join('__').replace(/[\/]/g, '_'), ref = db_().collection('chats').doc(id); try { const d = await ref.get(); if (d.exists) await ref.update({ ['hidden.' + K(ME.email)]: '' }); else await ref.set({ type: 'dm', members: [ME.email, em].sort(), names: { [K(ME.email)]: ME.name, [K(em)]: nm(em) }, createdBy: ME.email, createdAt: now(), lastAt: '', lastBy: '', lastMsg: '', reads: {}, hidden: {} }); const w = setInterval(() => { if (CH.find(x => x.id === id)) { clearInterval(w); openChat(id); } }, 150); setTimeout(() => clearInterval(w), 4000); } catch (e) { alert('Hindi masimulan: ' + e.message); } }); },
    async newGroup() { await loadDir(); kMsg._pick('👥 Bagong group', 'group', async (ems, name) => { const members = [...new Set([ME.email, ...ems])], id = 'g_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); try { await db_().collection('chats').doc(id).set({ type: 'group', name, members, admins: [ME.email], createdBy: ME.email, createdAt: now(), lastAt: now(), lastBy: ME.email, lastMsg: 'Ginawa ang group', reads: {}, hidden: {} }); const w = setInterval(() => { if (CH.find(x => x.id === id)) { clearInterval(w); openChat(id); } }, 150); setTimeout(() => clearInterval(w), 4000); } catch (e) { alert('Hindi magawa: ' + e.message); } }); },
    group() {
      if (!CUR || CUR.type !== 'group') return; const adm = CUR.createdBy === ME.email, o = document.createElement('div'); o.className = 'km-ov';
      o.innerHTML = `<div class="km-box"><b>⚙️ ${E(CUR.name)}</b>${adm ? '<div><button class="km-btn s" id="g-rn">✏️ Palitan ang pangalan</button> <button class="km-btn s" id="g-ad">➕ Magdagdag</button></div>' : ''}<div style="margin:.5rem 0;">${CUR.members.map(e => `<div class="km-i" style="cursor:default;"><div class="km-av">${E(nm(e).charAt(0).toUpperCase())}</div><div class="t"><div>${E(e === ME.email ? ME.name + ' (ikaw)' : nm(e))}${e === CUR.createdBy ? ' 👑 admin' : ''}</div></div>${adm && e !== ME.email ? `<button class="km-b" data-rm="${E(e)}" title="Alisin">❌</button>` : ''}</div>`).join('')}</div><button class="km-btn s" id="g-lv">🚪 Umalis sa group</button> <button class="km-btn s" id="g-x">Isara</button></div>`; document.body.appendChild(o);
      const sys = t => db_().collection('chats').doc(CUR.id).collection('messages').add({ kind: 'sys', text: t, from: ME.email, at: now(), deletedFor: [] });
      o.querySelector('#g-x').onclick = () => o.remove(); o.querySelector('#g-lv').onclick = async () => { if (!confirm(adm ? 'Ikaw ang admin ng group. Kapag umalis ka, wala nang makakapagdagdag ng miyembro. Umalis pa rin?' : 'Umalis sa group?')) return; try { await sys(ME.name + ' ay umalis'); await db_().collection('chats').doc(CUR.id).update({ members: firebase.firestore.FieldValue.arrayRemove(ME.email), admins: firebase.firestore.FieldValue.arrayRemove(ME.email) }); o.remove(); CUR = null; if (offM) offM(); drawList(); drawConv(); } catch (e) { alert('Error: ' + e.message); } };
      if (adm) { o.querySelector('#g-rn').onclick = async () => { const n = prompt('Bagong pangalan:', CUR.name); if (n && n.trim()) { await db_().collection('chats').doc(CUR.id).update({ name: n.trim() }); o.remove(); } }; o.querySelector('#g-ad').onclick = () => { o.remove(); kMsg._pick('➕ Idagdag sa group', 'add', async ems => { const nw = ems.filter(e => !CUR.members.includes(e)); if (!nw.length) return; await db_().collection('chats').doc(CUR.id).update({ members: firebase.firestore.FieldValue.arrayUnion(...nw) }); await sys(ME.name + ' ay nagdagdag ng ' + nw.map(nm).join(', ')); }); };
        o.querySelectorAll('[data-rm]').forEach(b => b.onclick = async () => { const e = b.dataset.rm; if (!confirm('Alisin si ' + nm(e) + '?')) return; await db_().collection('chats').doc(CUR.id).update({ members: firebase.firestore.FieldValue.arrayRemove(e), admins: firebase.firestore.FieldValue.arrayRemove(e) }); await sys(ME.name + ' ay nag-alis kay ' + nm(e)); o.remove(); }); }
    },
    _st: () => ({ ME, CH, CUR, MSGS, DIR })
  };
  console.log('[Messenger] v2 loaded'); const boot = () => { try { css(); build(); } catch (e) { console.error('[Messenger] build', e); } setTimeout(() => kMsg.init(), 500); }; if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
