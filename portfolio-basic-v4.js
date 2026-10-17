/* Reine Aufrufstatistik. Kein Verhaltenstracking, keine Besucherkennung.
   Eine ausdrückliche Widerspruchseinstellung bleibt funktionsbezogen gespeichert. */
(() => {
  'use strict';
  if (window.__portfolioBasicV4) return;
  window.__portfolioBasicV4 = true;
  const de = document.documentElement.lang.startsWith('de');
  const tr = (a,b) => de ? a : b;
  const key = 'portfolio-pagecounts-choice-v4';
  const titles = {'/de.html':'MindFlow · Deutsch','/index.html':'MindFlow · English','/':'MindFlow · English','/apple-projekte.html':'Apple · Deutsch','/apple-projects.html':'Apple · English','/mindflow-lesen.html':'MindFlow Lesetext · Deutsch','/mindflow-read.html':'MindFlow text · English'};
  const path = location.pathname === '/' ? '/index.html' : location.pathname;
  let off = false, attempted = false, accepted = false, failed = false, controller = null;
  const signal = () => [navigator.doNotTrack,window.doNotTrack,navigator.msDoNotTrack].some(v => v==='1'||v==='yes') || navigator.globalPrivacyControl===true;
  // Nur ausdrücklich gespeicherte Funktionswünsche lesen, keine Kennung anlegen.
  function readPreference(){
    off=false;
    try {
      const raw=localStorage.getItem(key);
      if(raw){const p=JSON.parse(raw);if(p.version===4&&p.expires>Date.now()){off=p.off===true;return;}}
      const old=JSON.parse(localStorage.getItem('portfolio-statistics-choice-v2')||'null');
      if(old&&old.expires>Date.now()&&old.mode==='off') off=true;
    } catch (_) { /* Bei blockiertem Speicher gilt die aktuelle Auswahl nur im Dokument. */ }
  }
  function ui(){
    document.querySelectorAll('[data-basic-settings]').forEach(el=>{
      const s=el.querySelector('[data-basic-status]');
      if(s)s.textContent=signal()?tr('Ausgeschaltet durch das Datenschutzsignal Ihres Browsers.','Disabled by your browser’s privacy signal.'):off?tr('Aufrufstatistik ist ausgeschaltet.','Page counts are disabled.'):tr('Nur Seitenaufrufe; keine Messung von Interaktionen.','Page counts only; interactions are not measured.');
      const b=el.querySelector('[data-basic-off]'),a=el.querySelector('[data-basic-on]');
      if(b){b.hidden=off||signal();} if(a){a.hidden=!off||signal();}
    });
  }
  function count(){
    if(attempted||off||signal()||document.prerendering||document.visibilityState!=='visible')return;
    if(!['why-we-think.com','www.why-we-think.com'].includes(location.hostname)||location.protocol!=='https:'||window.top!==window.self||!titles[path])return;
    attempted=true;
    const q=new URLSearchParams({p:path,t:titles[path],ns:'true',e:'false',r:''});
    controller=new AbortController();
    // Keine Roh-URL, keine Abfrageparameter, keine Bildschirmdaten und kein Referrer.
    fetch('https://sgillmeier.goatcounter.com/count?'+q,{method:'GET',mode:'cors',credentials:'omit',cache:'no-store',referrerPolicy:'no-referrer',redirect:'error',signal:controller.signal})
      .then(r=>{accepted=r.status===200&&!r.headers.get('X-Goatcounter');failed=!accepted;})
      .catch(()=>{failed=true;});
  }
  function select(value){
    off=value;
    if(off&&controller)controller.abort();
    try{localStorage.setItem(key,JSON.stringify({version:4,off:off,expires:Date.now()+180*86400000}));}catch(_){}
    ui();count();
  }
  readPreference();ui();
  document.querySelectorAll('[data-basic-off]').forEach(b=>b.addEventListener('click',()=>select(true)));
  document.querySelectorAll('[data-basic-on]').forEach(b=>b.addEventListener('click',()=>select(false)));
  addEventListener('storage',e=>{if(e.key===key||e.key==='portfolio-statistics-choice-v2'){readPreference();if(off&&controller)controller.abort();ui();count();}});
  document.addEventListener('visibilitychange',count);
  document.addEventListener('prerenderingchange',count);
  setTimeout(count,120);
  window.PortfolioAnalytics=Object.freeze({status:()=>({version:'2026-10-17-basic-v4',mode:off||signal()?'off':'pageviews-only',pageAttempted:attempted,responseAccepted:accepted,requestFailed:failed,detailTracking:false})});
})();
