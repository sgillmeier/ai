/* Bedienung als Ergänzung: Inhalt, Bildquellen und native Player bleiben ohne JavaScript verfügbar. */
(()=>{'use strict';
 const de=document.documentElement.lang==='de',text=(a,b)=>de?a:b;
 const format=n=>{n=Number.isFinite(n)?Math.max(0,n):0;return Math.floor(n/60)+':'+String(Math.floor(n%60)).padStart(2,'0');};
 // Explizite Sprachauswahl erhält den Abschnitt.
 const info=window.appleLanguage,nav=document.querySelector('.portfolio-language');const baseURL=/^(https?:|file:)$/.test(location.protocol)?location.href:document.baseURI;
 if(nav&&info){const update=()=>{for(const a of nav.querySelectorAll('[data-lang]')){const choice=a.dataset.lang,target=choice==='auto'?info.browser:choice;const u=new URL(target==='de'?info.de:info.en,baseURL);u.searchParams.set('lang',choice);u.hash=location.hash;a.href=u.href;}};update();addEventListener('hashchange',update);}
 const videos=[...document.querySelectorAll('.video-card video')];
 const reduced=matchMedia('(prefers-reduced-motion: reduce)');const connection=navigator.connection;
 const deepLink=location.hash&&!['#videos','#video-ar-maps','#top'].includes(location.hash);
 let mode=(reduced.matches||connection?.saveData||deepLink)?'suppressed':'auto';
 let active=0,suspended=null,ticket=0,desired=null;
 const ownPauses=new WeakSet(),ownSeeks=new WeakSet();
 const status=document.getElementById('sequence-status'),restart=document.getElementById('sequence-restart');
 const statusText={auto:text('Filmfolge: AR-Maps, danach Flyover','Sequence: AR-Maps, then Flyover'),manual:text('Manuelle Wiedergabe','Manual playback'),blocked:text('Abspielen wählen, um zu starten.','Choose Play to start.'),suppressed:text('Beide Filme einzeln oder nacheinander ansehen.','Watch the films individually or in sequence.'),complete:text('Beide Filme sind beendet.','Both films have finished.'),error:text('Filmfolge angehalten.','Sequence stopped.')};
 const show=()=>{document.documentElement.dataset.playbackMode=mode;if(status)status.textContent=statusText[mode];if(restart){restart.hidden=mode==='auto';restart.textContent=text('Filme nacheinander abspielen','Play films in sequence');}};
 const pauseOwn=v=>{if(!v.paused&&!v.ended){ownPauses.add(v);v.pause();}};
 const pauseOthers=keep=>videos.forEach(v=>{if(v!==keep)pauseOwn(v);});
 const manual=()=>{if(mode!=='manual'){mode='manual';suspended=null;++ticket;show();}};
 const requestPlay=async(index,automatic=false)=>{
  const v=videos[index];if(!v)return;if(automatic&&mode!=='auto')return;
  if(automatic&&document.hidden){suspended=index;return;}
  const id=++ticket;desired=index;active=index;pauseOthers(v);v.muted=true;v.defaultMuted=true;v.playsInline=true;
  const error=v.closest('.video-card').querySelector('.video-error');if(error)error.hidden=true;
  try{await v.play();if(id!==ticket&&desired!==index)pauseOwn(v);}
  catch(e){if(id!==ticket)return;if(automatic&&mode==='auto'){mode='blocked';desired=null;show();}else if(e?.name!=='AbortError'){if(error)error.hidden=false;v.controls=true;}}
 };
 // Keine unbeabsichtigte spätere Übernahme nach Maus-, Touch- oder Tastaturbedienung.
 for(const type of ['pointerdown','keydown','click'])document.addEventListener(type,e=>{const target=e.target instanceof Element?e.target:null;if(target?.closest('.video-card'))manual();},true);
 videos.forEach((v,index)=>{
  v.muted=true;v.defaultMuted=true;v.playsInline=true;
  const card=v.closest('.video-card'),ui=card.querySelector('.video-ui'),toggle=ui.querySelector('.play-toggle'),label=toggle.querySelector('span'),glyph=toggle.querySelector('use'),time=ui.querySelector('.video-time'),seek=ui.querySelector('.video-seek'),full=ui.querySelector('.fullscreen'),error=card.querySelector('.video-error');
  let scrubbing=false;const duration=()=>Number.isFinite(v.duration)&&v.duration>0?v.duration:Number(v.dataset.duration)||0;
  const refresh=()=>{const d=duration();time.textContent=format(v.currentTime)+' / '+format(Math.round(d));if(!scrubbing)seek.value=String(d?Math.round(v.currentTime/d*1000):0);seek.setAttribute('aria-valuetext',format(v.currentTime)+' / '+format(Math.round(d)));const playing=!v.paused&&!v.ended;label.textContent=playing?text('Pause','Pause'):text('Abspielen','Play');toggle.setAttribute('aria-label',playing?text('Video pausieren','Pause video'):text('Video abspielen','Play video'));glyph.setAttribute('href',playing?'#i-pause':'#i-play');card.dataset.playing=playing?'true':'false';if(index===0&&d)card.querySelector('.seek-track').style.setProperty('--chapter',(62/d*100)+'%');};
  const togglePlay=()=>{manual();if(!v.paused){desired=null;++ticket;v.pause();}else requestPlay(index,false);};
  toggle.addEventListener('click',togglePlay);
  v.addEventListener('click',()=>{if(!v.controls)togglePlay();});
  v.addEventListener('keydown',e=>{if(e.key===' '||e.key==='Enter'){e.preventDefault();togglePlay();}else if(e.key==='ArrowRight'||e.key==='ArrowLeft'){e.preventDefault();manual();v.currentTime=Math.max(0,Math.min(duration(),v.currentTime+(e.key==='ArrowRight'?5:-5)));}});
  v.addEventListener('play',()=>{pauseOthers(v);refresh();});
  v.addEventListener('pause',()=>{const controlled=ownPauses.has(v);ownPauses.delete(v);if(!controlled&&mode==='auto'&&active===index&&!v.ended&&!document.hidden){manual();desired=null;}refresh();});
  v.addEventListener('seeking',()=>{if(!ownSeeks.has(v)&&mode==='auto'&&v.currentTime>.1){manual();}refresh();});
  v.addEventListener('seeked',()=>{ownSeeks.delete(v);refresh();});
  v.addEventListener('webkitbeginfullscreen',manual);
  v.addEventListener('ended',()=>{refresh();if(mode!=='auto'||active!==index)return;if(index===0){active=1;const next=videos[1];if(next.currentTime>0){ownSeeks.add(next);next.currentTime=0;}if(document.hidden){suspended=1;}else requestPlay(1,true);}else{mode='complete';desired=null;show();}});
  v.addEventListener('error',()=>{if(error)error.hidden=false;v.controls=true;if(mode==='auto'){mode='error';desired=null;++ticket;show();}});
  for(const event of ['loadedmetadata','timeupdate','durationchange'])v.addEventListener(event,refresh);
  seek.addEventListener('input',()=>{manual();scrubbing=true;time.textContent=format(Number(seek.value)/1000*duration())+' / '+format(Math.round(duration()));});
  seek.addEventListener('change',()=>{manual();const fraction=Number(seek.value)/1000;const apply=()=>{v.currentTime=fraction*duration();scrubbing=false;refresh();};if(v.readyState>=1)apply();else{v.addEventListener('loadedmetadata',apply,{once:true});v.load();}});
  full.addEventListener('click',async()=>{manual();try{if(v.webkitEnterFullscreen)v.webkitEnterFullscreen();else if(v.requestFullscreen)await v.requestFullscreen();else{v.controls=true;v.focus();}}catch(_){v.controls=true;}});
  const jump=card.querySelector('[data-jump-seconds]');if(jump)jump.addEventListener('click',()=>{manual();pauseOthers(v);const apply=()=>{v.currentTime=Math.min(62,Math.max(0,duration()-.1));requestPlay(index,false);};if(v.readyState>=1)apply();else{v.addEventListener('loadedmetadata',apply,{once:true});v.load();}});
  ui.hidden=false;v.controls=false;refresh();
 });
 const stopAuto=()=>{if(mode==='auto'){mode='suppressed';desired=null;suspended=null;++ticket;videos.forEach(pauseOwn);show();}};
 if(restart)restart.addEventListener('click',()=>{++ticket;videos.forEach(pauseOwn);mode='auto';suspended=null;active=0;for(const v of videos){if(v.currentTime>0){ownSeeks.add(v);v.currentTime=0;}}show();requestPlay(0,true);});
 document.addEventListener('visibilitychange',()=>{if(mode!=='auto')return;if(document.hidden){suspended=active;desired=null;++ticket;videos.forEach(pauseOwn);}else if(suspended!==null){const index=suspended;suspended=null;requestPlay(index,true);}});
 reduced.addEventListener?.('change',e=>{if(e.matches)stopAuto();});connection?.addEventListener?.('change',()=>{if(connection.saveData)stopAuto();});
 addEventListener('pagehide',()=>{++ticket;desired=null;videos.forEach(pauseOwn);});
 const seq=document.querySelector('.sequence-controls');if(seq)seq.hidden=false;show();if(videos.length===2&&mode==='auto'){if(document.hidden)suspended=0;else requestPlay(0,true);}
 // Sichtbare Kapitelposition, keine Inhalte durch Skript ausblenden.
 const links=[...document.querySelectorAll('.chapter-links a')],sections=links.map(a=>document.querySelector(a.getAttribute('href'))).filter(Boolean);let queued=false;
 const mark=()=>{queued=false;let current=sections[0];for(const section of sections){if(section.getBoundingClientRect().top<=150)current=section;}for(const a of links){if(a.getAttribute('href')==='#'+current?.id)a.setAttribute('aria-current','true');else a.removeAttribute('aria-current');}};
 addEventListener('scroll',()=>{if(!queued){queued=true;requestAnimationFrame(mark);}},{passive:true});mark();
 // Normale Bildlinks bleiben ohne Dialog-Unterstützung funktionsfähig.
 if(typeof HTMLDialogElement!=='undefined'&&HTMLDialogElement.prototype.showModal){
  const modal=document.createElement('dialog');modal.className='image-modal';modal.setAttribute('aria-label',text('Vollständige Abbildung','Full image'));modal.innerHTML='<div class="modal-head"><p></p><button type="button" aria-label="'+text('Schließen','Close')+'">×</button></div><div class="modal-image"><img alt=""></div><div class="modal-tail">'+text('Die vollständige Abbildung lässt sich durchscrollen. Escape schließt die Ansicht.','Scroll to see the complete image. Press Escape to close.')+'</div>';document.body.append(modal);const image=modal.querySelector('img'),caption=modal.querySelector('p');let lastFocus=null;
  modal.querySelector('button').addEventListener('click',()=>modal.close());modal.addEventListener('click',e=>{if(e.target===modal)modal.close();});modal.addEventListener('close',()=>lastFocus?.focus());
  for(const a of document.querySelectorAll('[data-zoom]'))a.addEventListener('click',e=>{if(e.button!==0||e.metaKey||e.ctrlKey||e.shiftKey||e.altKey)return;e.preventDefault();lastFocus=a;const original=a.closest('figure')?.querySelector('img');image.src=a.href;image.alt=original?.alt||'';caption.textContent=image.alt;modal.showModal();});
 }
})();
