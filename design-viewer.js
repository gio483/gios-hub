/* =====================================================================
   DESIGN VIEWER: the shared shell behind every design piece's page
   ---------------------------------------------------------------------
   A piece's page (e.g. sdlr-door-hangers.html) only holds two things:

     const VIEWER   = { title:'Door Hanger', company:'sdlr', section:'handouts' };
     const VERSIONS = [ { date, label, items:[ { file, name, note, final? } ] }, ... ];

   then loads this file. Everything else (the top bar, the way back to the
   gallery, the version list, sharing) is drawn here, so every piece looks
   and works the same.

   Which version opens: the item marked `final: true`, else the FIRST item
   (keep VERSIONS newest first). Anyone who opens the page lands on that one.
   An older version shows an amber strip with a button back to it.

   VIEWER fields
     title     piece name                 company  key of COMPANIES below
     section   the gallery section it files under (designs.html?c=..#section)
     frameBg   colour behind the page while it loads (default cream)
     status    'review' while the piece is still being decided: the page says
               "Not final yet" until a version is marked final
     retired   a sentence shown on a strip when the piece should no longer be
               used (e.g. printed with an old phone number), with
     retiredLink { label, href } pointing at the piece that replaces it

   Link to one version: page.html?v=<that version's file name>
   ===================================================================== */
(function(){
  const COMPANIES = {
    sdlr: { short:'SDLR', accent:'#9fb56a', bg:'#3b4a30', mark:'brand/sdlr-mark.png', gallery:'designs.html?c=sdlr' },
    ksh:  { short:'KSH',  accent:'#3f97d3', bg:'#0f2a44', mark:'brand/ksh-mark.png',  gallery:'designs.html?c=ksh' }
  };
  const V = window.VIEWER || (typeof VIEWER !== 'undefined' ? VIEWER : {});
  const GROUPS = typeof VERSIONS !== 'undefined' ? VERSIONS : [];
  const co = COMPANIES[V.company] || COMPANIES.sdlr;
  const esc = s => String(s==null?'':s).replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  const all = GROUPS.flatMap(g => g.items.map(it => Object.assign({ group:g }, it)));
  if(!all.length) return;
  const current = all.find(it => it.final) || all[0];
  // "Final" when the piece says so, either with final:true or in the version's name
  const saysFinal = it => it.final === true || (/\bfinal\b/i.test(it.name) && !/not final/i.test(it.name));
  const retired = V.retired || '';
  const currentIsFinal = !retired && saysFinal(current);
  // how the version that opens is labelled: [in the top bar, in the list, tag colour]
  const LABEL = retired ? ['Printed earlier', 'Printed earlier', 'grey']
    : currentIsFinal ? ['Final', 'Use this one', 'final']
    : V.status === 'review' ? ['Not final yet', 'Newest · not final yet', 'old']
    : ['Newest', 'Newest', ''];
  const asked = new URLSearchParams(location.search).get('v');
  let active = all.find(it => it.file === asked) || current;

  document.documentElement.style.setProperty('--accent', co.accent);
  if(V.frameBg) document.documentElement.style.setProperty('--frame', V.frameBg);
  document.title = (V.title || 'Design') + ' · ' + co.short;
  if(!document.querySelector('link[href*="Barlow+Condensed"]')){
    const f = document.createElement('link'); f.rel = 'stylesheet';
    f.href = 'https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@500;600;700&display=swap';
    document.head.appendChild(f);
  }

  const back = co.gallery + (V.section ? '#' + V.section : '');
  const ICON = {
    back:'<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M15 19l-7-7 7-7"/></svg>',
    list:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5"/><path d="M12 8v4l3 2"/></svg>',
    share:'<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.07 0l3-3a5 5 0 0 0-7.07-7.07l-1.5 1.5"/><path d="M14 11a5 5 0 0 0-7.07 0l-3 3a5 5 0 0 0 7.07 7.07l1.5-1.5"/></svg>',
    open:'<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 4h6v6"/><path d="M20 4l-9 9"/><path d="M19 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5"/></svg>',
    close:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>'
  };

  let n = 0;
  const listHTML = GROUPS.map(g => `<div class="dv-date">${esc(g.label)}</div>` + g.items.map(() => {
    const it = all[n], i = n++;
    return `<button class="dv-item" data-i="${i}">
      <span class="nm">${esc(it.name)}${it === current ? `<span class="dv-tag ${LABEL[2]}">${LABEL[1]}</span>` : ''}</span>
      <span class="nt">${esc(it.note || '')}</span>
    </button>`;
  }).join('')).join('');

  document.body.insertAdjacentHTML('afterbegin', `
    <header class="dv-top">
      <a class="dv-back" href="${esc(back)}" title="Back to all ${esc(co.short)} designs">${ICON.back}<i style="--mbg:${esc(co.bg)}"><img src="${esc(co.mark)}" alt=""></i><span>${esc(co.short)} designs</span></a>
      <div class="dv-title"><b>${esc(V.title || '')}</b><div class="dv-now" id="dvNow"></div></div>
      <div class="dv-actions">
        <button class="dv-btn" id="dvVersions" title="See every version" aria-expanded="false">${ICON.list}<span class="lbl">Versions</span><span class="n">${all.length}</span></button>
        <button class="dv-btn" id="dvShare" title="Copy the link to this page">${ICON.share}<span class="lbl">Copy link</span></button>
        <a class="dv-btn" id="dvOpen" target="_blank" rel="noopener" title="Open this version on its own, full screen">${ICON.open}<span class="lbl">Full screen</span></a>
      </div>
    </header>
    <div class="dv-old" id="dvOld"><span id="dvOldText"></span><button id="dvOldBtn"></button></div>
    <div class="dv-body">
      <aside class="dv-side" id="dvSide" aria-label="Versions">
        <div class="dv-side-h"><b>${all.length} version${all.length>1?'s':''} · newest first</b><button id="dvClose" aria-label="Close the version list">${ICON.close}</button></div>
        ${listHTML}
      </aside>
      <div class="dv-scrim" id="dvScrim"></div>
      <main class="dv-main">
        <div class="dv-loading" id="dvLoading" role="status" aria-label="Loading"></div>
        <iframe id="dvFrame" title="${esc(V.title || 'Design')}" allow="fullscreen" allowfullscreen></iframe>
      </main>
    </div>
    <div class="dv-toast" id="dvToast"></div>`);

  const $ = id => document.getElementById(id);
  const frame = $('dvFrame'), loading = $('dvLoading');
  const narrow = () => window.matchMedia('(max-width:820px)').matches;
  frame.addEventListener('load', () => loading.classList.remove('show'));

  function show(it, push){
    active = it;
    loading.classList.add('show');
    frame.src = it.file;
    $('dvOpen').href = it.file;
    const isCur = it === current;
    $('dvNow').innerHTML = (isCur
      ? `<span class="dv-tag ${LABEL[2]}">${LABEL[0]}</span>`
      : `<span class="dv-tag old">Older version</span>`) + `<span>${esc(isCur && currentIsFinal ? it.name.replace(/^final\s*[\u00b7:,-]?\s*/i, '') : it.name)}</span>`;
    const link = retired && isCur ? V.retiredLink : null;
    $('dvOld').classList.toggle('show', !isCur || !!retired);
    $('dvOldText').textContent = isCur ? retired : 'You are looking at an older version: ' + it.name + '.';
    $('dvOldBtn').textContent = isCur ? (link ? link.label : '') : (currentIsFinal ? 'Go to the final' : 'Go to the newest');
    $('dvOldBtn').style.display = isCur && !link ? 'none' : '';
    document.querySelectorAll('.dv-item').forEach(b => b.classList.toggle('active', all[+b.dataset.i] === it));
    if(push){
      const url = location.pathname + (isCur ? '' : '?v=' + encodeURIComponent(it.file));
      history.replaceState(null, '', url);
    }
    if(narrow()) setOpen(false);
  }
  function setOpen(open, remember){
    document.body.classList.toggle('dv-open', open);
    $('dvVersions').classList.toggle('on', open);
    $('dvVersions').setAttribute('aria-expanded', open);
    if(remember && !narrow()){ try{ localStorage.setItem('dv-side', open ? '1' : ''); }catch(e){} }
  }
  let toastT;
  function toast(msg){ const t = $('dvToast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 2200); }

  $('dvSide').addEventListener('click', e => { const b = e.target.closest('.dv-item'); if(b) show(all[+b.dataset.i], true); });
  $('dvVersions').onclick = () => setOpen(!document.body.classList.contains('dv-open'), true);
  $('dvClose').onclick = () => setOpen(false, true);
  $('dvScrim').onclick = () => setOpen(false);
  $('dvOldBtn').onclick = () => { if(active === current && V.retiredLink) location.href = V.retiredLink.href; else show(current, true); };
  $('dvShare').onclick = async () => {
    const url = location.origin + location.pathname + (active === current ? '' : '?v=' + encodeURIComponent(active.file));
    try{ await navigator.clipboard.writeText(url); toast('Link copied'); }
    catch(e){ prompt('Copy this link', url); }
  };
  document.addEventListener('keydown', e => { if(e.key === 'Escape' && narrow()) setOpen(false); });

  let remembered = false;
  try{ remembered = localStorage.getItem('dv-side') === '1'; }catch(e){}
  setOpen(remembered && !narrow());
  show(active, false);
})();
