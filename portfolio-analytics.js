/* Portfolio-Messung v2. Eigener kleiner Transport zum dokumentierten /count-Endpunkt.
   Keine Drittanbieter-Skripte, kein Fingerprinting, keine Bildschirmdaten, keine Roh-URL.
   Basis: genau ein Aufruf je Dokument. Detailmessung erst nach ausdrücklicher Auswahl.
   Einziger Browserspeicher: die vom Nutzer gewünschte Einstellung, keine Besucher-ID.
   Die bestehende Video- und Kartenbedienung wird ausschließlich beobachtet. */
(function () {
  'use strict';
  if (window.__portfolioAnalyticsInstalled) return;
  window.__portfolioAnalyticsInstalled = true;
  const cfg = window.__ANALYTICS_CONFIG__ || {};
  const Core = window.PortfolioMeasurementCore;
  const de = document.documentElement.lang.startsWith('de');
  const tr = (a, b) => de ? a : b;
  const pages = {
    '/apple-projekte.html': ['apple', 'Apple-Portfolio · Deutsch'],
    '/apple-projects.html': ['apple', 'Apple portfolio · English'],
    '/de.html': ['mindflow', 'MindFlow · Deutsch'],
    '/index.html': ['mindflow', 'MindFlow · English'],
    '/': ['mindflow', 'MindFlow · English']
  };
  const info = pages[location.pathname];
  const path = location.pathname === '/' ? '/index.html' : location.pathname;
  const key = cfg.preferenceKey || 'portfolio-statistics-choice-v2';
  let choice = cfg.defaultMode === 'off' ? 'off' : 'basic';
  let volatile = false;
  let stopped = false;
  let pageSent = false;
  let detailsStarted = false;
  let sent = 0;
  let accepted = 0;
  let failed = 0;
  let timer = null;
  const activeRequests = new Set();
  const allowedHost = (cfg.allowedProductionHosts || []).includes(location.hostname);
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);
  const hostOK = cfg.environment === 'production' ? allowedHost && location.protocol === 'https:' : local && cfg.allow_local === true;
  let endpoint;
  try { endpoint = new URL(cfg.collectorEndpoint); } catch (_) { endpoint = null; }
  const endpointOK = endpoint && (cfg.environment === 'production'
    ? endpoint.href === 'https://sgillmeier.goatcounter.com/count'
    : local && cfg.allow_local === true && ['localhost', '127.0.0.1'].includes(endpoint.hostname));
  const configured = Boolean(Core && info && hostOK && endpointOK && cfg.enabled === true && cfg.productionApproval === true && window.top === window.self);
  const privacySignal = () => Boolean((cfg.respectDNT && [navigator.doNotTrack, window.doNotTrack, navigator.msDoNotTrack].some(x => x === '1' || x === 'yes')) || (cfg.respectGPC && navigator.globalPrivacyControl === true));
  // Eine vorhandene Nutzereinstellung lesen. Ungültige Werte erlauben nie Details.
  try {
    const raw = localStorage.getItem(key);
    if (raw) {
      const saved = JSON.parse(raw);
      if (saved.version === 2 && ['basic', 'extended', 'off'].includes(saved.mode) && Number.isFinite(saved.expires) && saved.expires > Date.now()) choice = saved.mode;
    }
  } catch (_) { /* Bei blockiertem Speicher bleibt die Auswahl auf diesen Aufruf begrenzt. */ }
  const mode = () => privacySignal() ? 'off' : choice;
  const mayCount = () => configured && !stopped && mode() !== 'off' && !document.prerendering;
  const mayDetail = () => mayCount() && mode() === 'extended';
  const liveVisible = () => document.visibilityState === 'visible';

  // Nur feste Werte übertragen. Der Referer-HTTP-Header wird vollständig unterdrückt.
  // Keine Cookies, keine Cookie-Zugangsdaten, kein Auth-Token, keine versteckte Ersatzroute.
  function transmit(name, isEvent, referrer) {
    if (!mayCount() || (isEvent && !mayDetail())) return false;
    if (isEvent && !/^(apple|mindflow)\.[a-z0-9._-]{1,100}$/.test(name)) return false;
    const q = new URLSearchParams({p: name, t: isEvent ? name : info[1], ns: 'true', r: referrer || '', e: isEvent ? 'true' : 'false'});
    const url = endpoint.href + '?' + q.toString();
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    if (controller) activeRequests.add(controller);
    sent += 1;
    // Jeder Aufruf wird höchstens einmal versucht. Fehler lösen keine Wiederholungsflut aus.
    fetch(url, {
      method: 'GET', mode: 'cors', credentials: 'omit', cache: 'no-store',
      referrerPolicy: 'no-referrer', redirect: 'error', keepalive: false,
      signal: controller ? controller.signal : undefined
    }).then(response => {
      if (response.status === 200 && !(response.headers.get('X-Goatcounter') || '')) accepted += 1;
      else failed += 1;
    }).catch(() => { failed += 1; }).finally(() => { if (controller) activeRequests.delete(controller); });
    return true;
  }
  const budget = Core ? new Core.EventBudget(cfg.maxEventsPerDocument || 60) : null;
  const event = name => { if (mayDetail() && budget && budget.accept(name)) transmit(name, true, ''); };
  const panels = [...document.querySelectorAll('[data-analytics-settings]')];
  function updateUI() {
    for (const panel of panels) {
      const out = panel.querySelector('[data-analytics-status]');
      if (out) out.textContent = privacySignal()
        ? tr('Ausgeschaltet: Ihr Browser sendet ein Datenschutzsignal.', 'Disabled: your browser sends a privacy signal.')
        : mode() === 'extended'
          ? tr('Zusätzliche Statistik erlaubt. Keine Personen- oder Sitzungskennung.', 'Additional statistics allowed. No person or session identifier.')
          : mode() === 'off'
            ? tr('Für diesen Browser ausgeschaltet.', 'Disabled for this browser.')
            : tr('Nur Seitenaufrufe. Keine Messung Ihrer Interaktionen.', 'Page counts only. Your interactions are not measured.');
      for (const button of panel.querySelectorAll('[data-analytics-choice]')) {
        button.setAttribute('aria-pressed', String(button.dataset.analyticsChoice === mode()));
        button.disabled = privacySignal();
      }
      const volatileNote = panel.querySelector('[data-analytics-volatile]');
      if (volatileNote) volatileNote.hidden = !volatile;
    }
  }
  function select(next) {
    if (!['basic', 'extended', 'off'].includes(next)) return;
    choice = next;
    try {
      localStorage.setItem(key, JSON.stringify({version: 2, mode: next, expires: Date.now() + (cfg.preferenceDays || 180) * 86400000}));
      volatile = false;
    } catch (_) { volatile = true; }
    if (next !== 'extended') {
      for (const controller of activeRequests) controller.abort();
      resetTiming();
    }
    updateUI();
    activate();
  }
  for (const panel of panels) {
    for (const button of panel.querySelectorAll('[data-analytics-choice]')) {
      button.addEventListener('click', () => select(button.dataset.analyticsChoice));
    }
  }
  addEventListener('storage', e => {
    if (e.key !== key) return;
    try {
      const saved = JSON.parse(e.newValue || 'null');
      choice = saved && saved.version === 2 && saved.expires > Date.now() && ['basic', 'extended', 'off'].includes(saved.mode) ? saved.mode : 'basic';
    } catch (_) { choice = 'basic'; }
    if (mode() !== 'extended') { resetTiming(); for (const c of activeRequests) c.abort(); }
    updateUI(); activate();
  });

  let sectionStates = [];
  let mediaStates = [];
  function resetTiming() {
    for (const s of sectionStates) { if (!s.gate.fired) s.gate = new Core.DwellGate(cfg.chapterVisibleSeconds || 10); }
    for (const s of mediaStates) { s.last = null; }
  }
  function sourceCategory() {
    // Nur bewusst gewählte allgemeine Kanäle oder eine kurze erlaubte Herkunftskategorie.
    const p = new URLSearchParams(location.search);
    let c = Core.campaign(p.get('utm_campaign') || p.get('utm_source') || p.get('src'));
    if (['cv', 'recruiting', 'linkedin'].includes(c)) return c;
    const host = Core.cleanReferrer(document.referrer, cfg.allowedProductionHosts);
    if (host === 'internal') return 'internal';
    if (/^(www\.)?(linkedin\.com|de\.linkedin\.com)$/.test(host)) return 'linkedin';
    if (['chatgpt.com', 'chat.openai.com', 'claude.ai', 'perplexity.ai', 'www.perplexity.ai', 'gemini.google.com'].includes(host)) return 'ai-link';
    if (/^(www\.)?(google\.(com|de|ch|at)|bing\.com|duckduckgo\.com)$/.test(host)) return 'search';
    return host === 'direct-or-unknown' ? 'direct-or-unknown' : 'other';
  }
  function actuallyVisible(el) {
    if (!liveVisible() || !el || el.hidden || !el.isConnected || el.getClientRects().length === 0) return false;
    const modal = document.querySelector('dialog[open]');
    if (modal && !modal.contains(el)) return false;
    const full = document.fullscreenElement || document.webkitFullscreenElement;
    if (full && !full.contains(el) && full !== el) return false;
    const rect = el.getBoundingClientRect();
    const style = getComputedStyle(el);
    return style.visibility !== 'hidden' && Number(style.opacity) !== 0 && rect.right > 0 && rect.left < innerWidth &&
      Core.sectionVisible({top: rect.top, bottom: rect.bottom, height: rect.height}, innerHeight, true);
  }
  function poll() {
    if (!mayDetail() || !liveVisible()) { resetTiming(); return; }
    const now = performance.now();
    for (const s of sectionStates) {
      if (s.gate.tick(now, actuallyVisible(s.el))) event('apple.' + s.name + '.visible-10s');
    }
    for (const s of mediaStates) {
      const v = s.video;
      if (!s.coverage && Number.isFinite(v.duration) && v.duration > 0) s.coverage = new Core.VisibleMediaCoverage(v.duration);
      const eligible = (s.nativeFullscreen || actuallyVisible(v)) && !v.paused && !v.ended && !v.seeking && v.readyState >= 2;
      if (!eligible || !s.coverage) { s.last = null; continue; }
      if (!s.seenStart) {
        s.seenStart = true;
        const automatic = document.documentElement.dataset.playbackMode === 'auto';
        event('apple.' + s.name + (automatic ? '.auto-visible' : '.manual-visible'));
      }
      if (s.last) {
        s.coverage.add(s.last.time, v.currentTime, now - s.last.wall, v.playbackRate || 1, true);
        for (const n of s.coverage.milestones()) event('apple.' + s.name + '.coverage-' + n);
      }
      s.last = {time: v.currentTime, wall: now};
    }
  }
  function bindDetails() {
    if (detailsStarted) return;
    detailsStarted = true;
    if (info[0] === 'apple') {
      const chapters = {'videos': 'videos', 'business-chat': 'business-chat', 'wikipedia': 'wikipedia', 'poi': 'poi', 'indoor-navigation': 'indoor', 'ar-navigation': 'ar'};
      for (const [id, name] of Object.entries(chapters)) {
        const el = document.getElementById(id);
        if (el) sectionStates.push({el, name, gate: new Core.DwellGate(cfg.chapterVisibleSeconds || 10)});
      }
      for (const card of document.querySelectorAll('.video-card')) {
        const video = card.querySelector('video');
        if (!video) continue;
        const name = card.dataset.videoIndex === '1' ? 'flyover' : 'ar-maps';
        const state = {card, video, name, last: null, coverage: null, seenStart: false, nativeFullscreen: false};
        mediaStates.push(state);
        const manual = () => event('apple.' + name + '.manual-takeover');
        // Nur tatsächliche Bedienelemente, nicht Beschriftungen oder die ganze Videokarte.
        card.addEventListener('click', e => {
          const target = e.target.closest('button, input, video');
          if (!target || !mayDetail()) return;
          manual();
          if (target.matches('.play-toggle')) event('apple.' + name + (video.paused ? '.manual-pause' : '.manual-start'));
          if (target.matches('[data-jump-seconds="62"]')) event('apple.' + name + '.flyover-62');
        });
        const seek = card.querySelector('.video-seek');
        if (seek) seek.addEventListener('input', () => { manual(); event('apple.' + name + '.seek'); state.last = null; }, {passive: true});
        video.addEventListener('keydown', e => { if ([' ', 'Enter', 'ArrowRight', 'ArrowLeft'].includes(e.key)) manual(); });
        for (const ev of ['pause', 'seeking', 'seeked', 'waiting', 'ratechange']) video.addEventListener(ev, () => { state.last = null; });
        video.addEventListener('playing', () => {
          state.last = null;
          if (mayDetail() && (state.nativeFullscreen || actuallyVisible(video))) {
            event('apple.' + name + (document.documentElement.dataset.playbackMode === 'auto' ? '.auto-start' : '.manual-start'));
          }
          poll();
        });
        video.addEventListener('webkitbeginfullscreen', () => { state.nativeFullscreen = true; manual(); event('apple.' + name + '.fullscreen'); });
        video.addEventListener('webkitendfullscreen', () => { state.nativeFullscreen = false; state.last = null; });
      }
      const full = () => {
        const el = document.fullscreenElement || document.webkitFullscreenElement;
        if (!el) return;
        const s = mediaStates.find(x => x.video === el || el.contains(x.video));
        if (s) { event('apple.' + s.name + '.fullscreen'); event('apple.' + s.name + '.manual-takeover'); }
      };
      document.addEventListener('fullscreenchange', full);
      document.addEventListener('webkitfullscreenchange', full);
      document.querySelectorAll('[data-zoom]').forEach((a, i) => a.addEventListener('click', () => event('apple.bild-' + (i + 1) + '.zoom')));
      document.querySelectorAll('details:not([data-analytics-settings])').forEach((d, i) => d.addEventListener('toggle', () => { if (d.open) event('apple.details-' + (i + 1) + '.open'); }));
    } else {
      const keys = ['entry', 'token', 'model', 'exit', 'meaning', 'question', 'progress', 'grounding', 'examples', 'sft', 'dpo', 'evaluate'];
      const tiles = [...document.querySelectorAll('a.tile[data-key], a.goal-tile[data-key]')].filter(el => keys.includes(el.dataset.key));
      // Auswahländerungen werden im Eltern-DOM beobachtet; keine Lektüre der iframe-Inhalte.
      const observe = new MutationObserver(records => {
        for (const r of records) {
          const tile = r.target;
          if (tile.getAttribute('aria-expanded') === 'true') event('mindflow.' + tile.dataset.key + '.open');
        }
      });
      for (const tile of tiles) {
        observe.observe(tile, {attributes: true, attributeFilter: ['aria-expanded']});
        tile.addEventListener('click', () => setTimeout(() => { if (tile.getAttribute('aria-expanded') === 'true') event('mindflow.' + tile.dataset.key + '.open'); }, 0));
      }
    }
    timer = setInterval(poll, 500);
  }
  function activate() {
    if (!mayCount() || !liveVisible()) return;
    if (!pageSent) { pageSent = transmit(path, false, ''); }
    if (mayDetail()) {
      bindDetails();
      event(info[0] + '.source.' + sourceCategory());
    }
  }
  document.addEventListener('visibilitychange', () => { resetTiming(); updateUI(); activate(); });
  document.addEventListener('prerenderingchange', activate);
  addEventListener('pagehide', () => { stopped = true; resetTiming(); if (timer) clearInterval(timer); timer = null; });
  addEventListener('pageshow', e => { if (e.persisted) { stopped = false; if (detailsStarted && !timer) timer = setInterval(poll, 500); activate(); } });
  // Lokale Diagnose zeigt nur Zählstände; kein Befüllen oder Senden frei erfundener Ereignisse.
  window.PortfolioAnalytics = Object.freeze({status: () => ({version: cfg.version, mode: mode(), configured, pageAttempted: pageSent, requestsAttempted: sent, responsesAccepted: accepted, requestsFailed: failed, detailsStarted})});
  updateUI();
  // Die schon vorhandene Sprachauswahl läuft vor diesem defer-Skript.
  setTimeout(activate, 100);
})();
