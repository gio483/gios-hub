// The Making of a Man: shared state, cloud sync and notifications
(function(){
  const API = '/api/lifeos?ns=mom';
  const LS = {
    get(k,d){ try{ const v=localStorage.getItem('mom:'+k); return v===null?d:JSON.parse(v);}catch(e){return d} },
    set(k,v){ try{ localStorage.setItem('mom:'+k, JSON.stringify(v)); }catch(e){} },
    del(k){ try{ localStorage.removeItem('mom:'+k); }catch(e){} }
  };

  // ---- state ----
  let state = LS.get('state', null);
  if (!state) {
    state = { done:{}, j:{}, vm:{} };
    const oldDone = LS.get('done', []);
    (oldDone||[]).forEach(n=> state.done[n]={v:true,u:Date.now()});
    for (let n=1;n<=21;n++){ const t=LS.get('j'+n,null); if(t) state.j[n]={t,u:Date.now()}; }
    LS.set('state', state);
  }
  ['done','j','vm'].forEach(k=>{ if(!state[k]) state[k]={}; });

  function mergeMap(a={},b={}){ const o={...a}; for(const [k,v] of Object.entries(b||{})){ if(!v||typeof v!=='object') continue; if(!o[k]||Number(v.u||0)>=Number(o[k].u||0)) o[k]=v; } return o; }
  function absorb(remote){ if(!remote) return; ['done','j','vm'].forEach(k=> state[k]=mergeMap(state[k], remote[k])); if(remote.push) MOM.push=remote.push; LS.set('state',state); }

  const listeners=[];
  function emit(){ listeners.forEach(f=>{ try{f(state)}catch(e){} }); }

  // ---- sync ----
  let syncTimer=null, syncing=false;
  async function hash(s){ const b=await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)); return [...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,'0')).join(''); }
  async function setPhrase(phrase){
    const p=(phrase||'').trim().toLowerCase().replace(/\s+/g,' ');
    if(p.length<8) throw new Error('Use at least 8 characters. A short sentence works best.');
    const id=await hash('making-of-a-man|'+p);
    LS.set('id', id); MOM.id=id; await syncNow(); return id;
  }
  function forget(){ LS.del('id'); MOM.id=null; emit(); }
  async function syncNow(){
    if(!MOM.id || syncing) return; syncing=true; MOM.status='Syncing'; emit();
    try{
      const r=await fetch(API+'&id='+MOM.id,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({data:{done:state.done,j:state.j,vm:state.vm}})});
      const js=await r.json(); if(!r.ok) throw new Error(js.error||'sync failed');
      absorb(js.data); MOM.status='Synced'; MOM.lastSync=Date.now();
    }catch(e){ MOM.status='Offline, saved on this device'; }
    syncing=false; emit();
  }
  function queueSync(){ clearTimeout(syncTimer); syncTimer=setTimeout(syncNow, 1200); }

  // ---- mutations ----
  function setDone(n,v){ state.done[n]={v:!!v,u:Date.now()}; LS.set('state',state); emit(); queueSync(); }
  function isDone(n){ return !!(state.done[n]&&state.done[n].v); }
  function setJournal(n,t){ state.j[n]={t,u:Date.now()}; LS.set('state',state); queueSync(); }
  function journal(n){ return (state.j[n]&&state.j[n].t)||''; }
  function setVerse(n,l){ state.vm[n]={l,u:Date.now()}; LS.set('state',state); emit(); queueSync(); }
  function verse(n){ return (state.vm[n]&&state.vm[n].l)||0; }
  function doneCount(){ let c=0; for(let n=1;n<=21;n++) if(isDone(n)) c++; return c; }
  function nextDay(){ for(let n=1;n<=21;n++) if(!isDone(n)) return n; return 0; }

  // ---- notifications ----
  const isIOS = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform==='MacIntel' && navigator.maxTouchPoints>1);
  const standalone = (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone===true;
  function pushSupport(){
    if(!('serviceWorker' in navigator)) return {ok:false, why:'This browser cannot receive notifications.'};
    if(isIOS && !standalone) return {ok:false, ios:true, why:'On iPhone, add this app to your Home Screen first, then open it from the icon.'};
    if(!('PushManager' in window) || !('Notification' in window)) return {ok:false, why:'Notifications are not supported here. Update iOS to 16.4 or later.'};
    return {ok:true};
  }
  async function registerSW(){ if(!('serviceWorker' in navigator)) return null; try{ return await navigator.serviceWorker.register('/vibe/sw.js',{scope:'/vibe/'}); }catch(e){ return null; } }
  function b64ToU8(b){ const p='='.repeat((4-b.length%4)%4); const s=atob((b+p).replace(/-/g,'+').replace(/_/g,'/')); return Uint8Array.from([...s].map(c=>c.charCodeAt(0))); }
  async function enablePush(){
    const sup=pushSupport(); if(!sup.ok) throw new Error(sup.why);
    if(!MOM.id) throw new Error('Set your sync phrase first, so your notifications know your progress.');
    const perm=await Notification.requestPermission(); if(perm!=='granted') throw new Error('Notifications were not allowed. You can turn them on in iPhone Settings, Notifications.');
    const reg=await registerSW(); if(!reg) throw new Error('Could not start the background service.');
    await navigator.serviceWorker.ready;
    const {key}=await fetch(API+'&action=vapid').then(r=>r.json());
    if(!key) throw new Error('Notifications are not switched on for the server yet.');
    let sub=await reg.pushManager.getSubscription();
    if(!sub) sub=await reg.pushManager.subscribe({userVisibleOnly:true, applicationServerKey:b64ToU8(key)});
    const r=await fetch(API+'&action=subscribe&id='+MOM.id,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({subscription:sub.toJSON(), tz:Intl.DateTimeFormat().resolvedOptions().timeZone})});
    if(!r.ok) throw new Error((await r.json()).error||'Could not save your subscription.');
    LS.set('pushOn', true); MOM.pushOn=true; emit(); return true;
  }
  async function disablePush(){
    try{ const reg=await navigator.serviceWorker.getRegistration('/vibe/'); const s=reg&&await reg.pushManager.getSubscription(); if(s) await s.unsubscribe(); }catch(e){}
    if(MOM.id) await fetch(API+'&action=unsubscribe&id='+MOM.id,{method:'POST'});
    LS.set('pushOn', false); MOM.pushOn=false; emit();
  }
  async function testPush(slot){
    const r=await fetch(API+'&action=test&id='+MOM.id,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({slot:slot||'test'})});
    const js=await r.json(); if(!r.ok) throw new Error(js.error||'Test failed'); return true;
  }

  async function invite(){
    const url=location.origin+'/vibe/readings.html';
    const text='Brother, I am going through these 21 readings: Scripture, a reflection, a prayer and a memory verse each day. Do them with me and let’s talk once a week.';
    if(navigator.share){ try{ await navigator.share({title:'The Making of a Man', text, url}); return 'shared'; }catch(e){ return 'cancel'; } }
    try{ await navigator.clipboard.writeText(text+' '+url); return 'copied'; }catch(e){ prompt('Copy this link', url); return 'copied'; }
  }

  const MOM = window.MOM = {
    id: LS.get('id', null), status: '', pushOn: LS.get('pushOn', false), push:null,
    state, on(f){ listeners.push(f); }, emit,
    setDone, isDone, setJournal, journal, setVerse, verse, doneCount, nextDay,
    setPhrase, forget, syncNow, pushSupport, enablePush, disablePush, testPush, registerSW, invite, isIOS, standalone,
    data: null,
    async load(){ if(!MOM.data) MOM.data = await fetch('/vibe/mom-data.json',{cache:'no-cache'}).then(r=>r.json()); return MOM.data; }
  };
  registerSW();
  if(MOM.id) syncNow();
  document.addEventListener('visibilitychange',()=>{ if(document.visibilityState==='visible' && MOM.id) syncNow(); });
})();

// ---- Settings sheet (shared UI) ----
(function(){
  const css=`.mset{position:fixed;inset:0;z-index:300;background:rgba(5,4,3,.82);backdrop-filter:blur(6px);display:none;align-items:flex-end;justify-content:center}
  .mset.open{display:flex}
  .mset .sheet{width:min(640px,100%);max-height:88svh;overflow-y:auto;background:#14110d;border:1px solid rgba(201,163,90,.25);border-radius:18px 18px 0 0;padding:22px 22px calc(34px + env(safe-area-inset-bottom));color:#efe8dc;font-family:Inter,system-ui,sans-serif}
  .mset h3{font-family:Cinzel,serif;font-weight:400;letter-spacing:.14em;font-size:18px;margin-bottom:4px}
  .mset .grp{border-top:1px solid rgba(201,163,90,.18);padding:18px 0 4px;margin-top:14px}
  .mset .grp b{display:block;font-family:Cinzel,serif;font-weight:400;letter-spacing:.2em;font-size:11px;color:#e6c88a;margin-bottom:8px}
  .mset p,.mset li{color:#b9ae9a;font-size:14px;line-height:1.6}
  .mset ol{padding-left:20px}
  .mset input{width:100%;padding:13px 14px;border-radius:10px;border:1px solid rgba(201,163,90,.3);background:#0b0907;color:#efe8dc;font-size:16px;margin:10px 0}
  .mset .row{display:flex;gap:8px;flex-wrap:wrap;margin-top:8px}
  .mset button.b{padding:11px 16px;border-radius:99px;border:1px solid rgba(201,163,90,.35);font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:#efe8dc;background:none;cursor:pointer}
  .mset button.b.solid{background:#c9a35a;color:#120e08;border-color:#c9a35a}
  .mset .msg{font-size:13px;color:#e6c88a;margin-top:8px;min-height:18px}
  .mset .close{float:right;font-size:26px;line-height:1;background:none;border:0;color:#efe8dc;cursor:pointer}`;
  const st=document.createElement('style'); st.textContent=css; document.head.appendChild(st);
  const el=document.createElement('div'); el.className='mset'; el.id='mset';
  el.innerHTML=`<div class="sheet"><button class="close" data-x>&times;</button><h3>THE APP</h3><p>Make it follow you, and let it call you back each morning.</p>
   <div class="grp"><b>1 · SYNC YOUR JOURNAL</b><p id="syncInfo"></p>
     <input id="phrase" type="password" placeholder="Your private sync phrase" autocomplete="off">
     <p style="font-size:12px">Pick a short sentence only you would know. Type the same phrase on your phone and laptop to share one journal. A brother uses his own phrase for his own journal.</p>
     <div class="row"><button class="b solid" id="setPhrase">Save phrase</button><button class="b" id="syncBtn">Sync now</button><button class="b" id="forget">Use a different phrase</button></div><div class="msg" id="syncMsg"></div></div>
   <div class="grp" id="installGrp"><b>2 · PUT IT ON YOUR HOME SCREEN</b>
     <ol><li>Open this page in <strong>Safari</strong> on your iPhone.</li><li>Tap the <strong>Share</strong> button, then <strong>Add to Home Screen</strong>.</li><li>Open <strong>The Making</strong> from its new icon, then come back to this panel.</li></ol></div>
   <div class="grp"><b>3 · MORNING AND EVENING NOTIFICATIONS</b><p>About 7 AM: your next reading. About 8 PM: tonight’s memory verse. (One hour earlier after the clocks change in November.)</p>
     <div class="row"><button class="b solid" id="pushOn">Turn on notifications</button><button class="b" id="pushTest">Send a test</button><button class="b" id="pushOff">Turn off</button></div><div class="msg" id="pushMsg"></div></div>
   <div class="grp"><b>4 · DO IT WITH A BROTHER</b><p>Send him the link. He picks his own sync phrase, and on days 7, 14 and 21 there is a question for the two of you to talk through.</p>
     <div class="row"><button class="b solid" id="invite">Invite a brother</button></div><div class="msg" id="invMsg"></div></div></div>`;
  document.body.appendChild(el);
  const $=s=>el.querySelector(s);
  function paint(){
    $('#syncInfo').textContent = MOM.id ? `Sync is on. ${MOM.status||''}` : 'Sync is off. Your journal is only on this device right now.';
    $('#forget').style.display = MOM.id?'':'none';
    $('#installGrp').style.display = (MOM.isIOS && !MOM.standalone) ? '' : 'none';
    const sup=MOM.pushSupport();
    $('#pushMsg').textContent = sup.ok ? (MOM.pushOn?'Notifications are on for this device.':'') : sup.why;
  }
  MOM.on(paint);
  el.addEventListener('click',e=>{ if(e.target===el||e.target.dataset.x!==undefined) el.classList.remove('open'); });
  $('#setPhrase').onclick=async()=>{ $('#syncMsg').textContent='Saving...'; try{ await MOM.setPhrase($('#phrase').value); $('#phrase').value=''; $('#syncMsg').textContent='Saved. Your journal now follows you.'; }catch(e){ $('#syncMsg').textContent=e.message; } paint(); };
  $('#syncBtn').onclick=async()=>{ await MOM.syncNow(); $('#syncMsg').textContent=MOM.status; };
  $('#forget').onclick=()=>{ MOM.forget(); $('#syncMsg').textContent='Enter a phrase to sync again.'; paint(); };
  $('#pushOn').onclick=async()=>{ $('#pushMsg').textContent='Asking...'; try{ await MOM.enablePush(); $('#pushMsg').textContent='Done. You will hear from it tomorrow morning. Tap Send a test to check now.'; }catch(e){ $('#pushMsg').textContent=e.message; } };
  $('#pushTest').onclick=async()=>{ $('#pushMsg').textContent='Sending...'; try{ await MOM.testPush('morning'); $('#pushMsg').textContent='Sent. It should appear in a few seconds.'; }catch(e){ $('#pushMsg').textContent=e.message; } };
  $('#pushOff').onclick=async()=>{ await MOM.disablePush(); $('#pushMsg').textContent='Notifications are off.'; };
  $('#invite').onclick=async()=>{ const r=await MOM.invite(); $('#invMsg').textContent = r==='copied'?'Link copied. Send it to him.': r==='shared'?'Sent.':''; };
  MOM.openSettings=()=>{ paint(); el.classList.add('open'); };
  paint();
})();

// ---- iPhone style tab bar (phones only) ----
(function(){
  const page = location.pathname.endsWith('verses.html') ? 'verses' : 'readings';
  const ic = {
    read:'<svg viewBox="0 0 24 24"><path d="M4 5.5C4 4.7 4.7 4 5.5 4H11v16H5.5C4.7 20 4 19.3 4 18.5z"/><path d="M20 5.5c0-.8-.7-1.5-1.5-1.5H13v16h5.5c.8 0 1.5-.7 1.5-1.5z"/></svg>',
    verse:'<svg viewBox="0 0 24 24"><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/></svg>',
    watch:'<svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="3"/><path d="M10 9.5v5l4.5-2.5z" class="f"/></svg>',
    app:'<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21M5.6 5.6l1.8 1.8M16.6 16.6l1.8 1.8M5.6 18.4l1.8-1.8M16.6 7.4l1.8-1.8"/></svg>'
  };
  const css=`.tabbar{display:none}
  @media (max-width:760px){
    .tabbar{display:flex;position:fixed;left:0;right:0;bottom:0;z-index:60;justify-content:space-around;
      padding:8px 6px calc(8px + env(safe-area-inset-bottom));background:rgba(14,11,8,.86);backdrop-filter:blur(18px) saturate(1.4);-webkit-backdrop-filter:blur(18px) saturate(1.4);border-top:1px solid rgba(201,163,90,.18)}
    .tabbar a{flex:1;display:flex;flex-direction:column;align-items:center;gap:4px;text-decoration:none;color:#8f8573;font:500 10px Inter,system-ui,sans-serif;letter-spacing:.06em;padding:4px 0;-webkit-tap-highlight-color:transparent}
    .tabbar svg{width:25px;height:25px;fill:none;stroke:currentColor;stroke-width:1.6;stroke-linecap:round;stroke-linejoin:round}
    .tabbar svg .f{fill:currentColor;stroke:none}
    .tabbar a.on{color:#e6c88a}
    .tabbar a.on svg{filter:drop-shadow(0 0 6px rgba(230,200,138,.35))}
    body{padding-bottom:calc(68px + env(safe-area-inset-bottom))}
  }`;
  const st=document.createElement('style'); st.textContent=css; document.head.appendChild(st);
  const nav=document.createElement('nav'); nav.className='tabbar';
  nav.innerHTML=`<a href="readings.html#readings" data-t="readings">${ic.read}<span>Readings</span></a>
    <a href="verses.html" data-t="verses">${ic.verse}<span>Verses</span></a>
    <a href="readings.html#watch" data-t="watch">${ic.watch}<span>Watch</span></a>
    <a href="#" data-t="app">${ic.app}<span>App</span></a>`;
  document.body.appendChild(nav);
  function mark(){
    let cur = page;
    if(page==='readings'){ const w=document.getElementById('watch'); if(w && w.getBoundingClientRect().top < innerHeight*0.5) cur='watch'; }
    nav.querySelectorAll('a').forEach(a=>a.classList.toggle('on', a.dataset.t===cur));
  }
  mark(); addEventListener('scroll', mark, {passive:true});
  nav.querySelector('[data-t=app]').onclick=e=>{ e.preventDefault(); MOM.openSettings && MOM.openSettings(); };
  nav.querySelectorAll('a[href^="readings.html#"]').forEach(a=>a.addEventListener('click',e=>{
    if(page!=='readings') return; e.preventDefault(); const id=a.getAttribute('href').split('#')[1];
    if(location.hash.startsWith('#day-')){ history.pushState('', document.title, location.pathname); dispatchEvent(new HashChangeEvent('hashchange')); }
    const t=document.getElementById(id); if(t) t.scrollIntoView({behavior:'smooth'});
  }));
})();
