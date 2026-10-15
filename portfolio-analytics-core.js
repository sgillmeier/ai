/* Messkern ohne Netzwerk und Browserspeicher. Kommentare bewusst auf Deutsch. */
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.PortfolioMeasurementCore = api;
})(typeof globalThis === 'object' ? globalThis : this, function () {
  'use strict';
  const finite = n => typeof n === 'number' && Number.isFinite(n);

  function cleanReferrer(raw, ownHosts) {
    if (!raw) return 'direct-or-unknown';
    try {
      const u = new URL(raw);
      if (!['https:', 'http:'].includes(u.protocol)) return 'direct-or-unknown';
      const host = u.hostname.toLowerCase().replace(/^www\./, '');
      if (u.username || u.password) return 'direct-or-unknown';
      if (/^\d+\.\d+\.\d+\.\d+$/.test(host) || host.includes(':') || !host.includes('.') || /\.(local|localhost|internal|invalid)$/.test(host)) return 'direct-or-unknown';
      const own = (ownHosts || []).map(x => x.toLowerCase().replace(/^www\./, ''));
      return own.includes(host) ? 'internal' : host.slice(0, 253);
    } catch (_) { return 'direct-or-unknown'; }
  }

  function campaign(raw) {
    const value = typeof raw === 'string' ? raw.trim().toLowerCase() : '';
    if (!value) return 'none';
    return ['cv', 'recruiting', 'linkedin'].includes(value) ? value : 'other';
  }

  function sectionVisible(rect, viewportHeight, documentVisible) {
    if (!documentVisible || !rect || !finite(viewportHeight) || viewportHeight <= 0) return false;
    if (![rect.top, rect.bottom, rect.height].every(finite) || rect.height <= 0 || rect.bottom <= rect.top) return false;
    const overlap = Math.max(0, Math.min(rect.bottom, viewportHeight) - Math.max(rect.top, 0));
    const required = Math.min(160, rect.height * 0.5, viewportHeight * 0.4);
    return overlap >= required;
  }

  class DwellGate {
    constructor(seconds = 10, maxGapMs = 1500) {
      if (!finite(seconds) || seconds <= 0 || !finite(maxGapMs) || maxGapMs <= 0) throw new TypeError('Ungültige Zeitgrenze');
      this.requiredMs = seconds * 1000;
      this.maxGapMs = maxGapMs;
      this.accumulatedMs = 0;
      this.previousMs = null;
      this.wasEligible = false;
      this.fired = false;
    }
    tick(nowMs, eligible) {
      if (!finite(nowMs)) throw new TypeError('Zeitstempel muss endlich sein');
      if (this.fired) return false;
      const delta = this.previousMs === null ? 0 : nowMs - this.previousMs;
      if (!eligible || !this.wasEligible || delta < 0 || delta > this.maxGapMs) this.accumulatedMs = 0;
      else this.accumulatedMs += delta;
      this.previousMs = nowMs;
      this.wasEligible = Boolean(eligible);
      if (eligible && this.accumulatedMs >= this.requiredMs) { this.fired = true; return true; }
      return false;
    }
  }

  class VisibleMediaCoverage {
    constructor(duration) {
      if (!finite(duration) || duration <= 0) throw new TypeError('Gültige Mediendauer nötig');
      this.duration = duration;
      this.intervals = [];
      this.sentMilestones = new Set();
      this.visibleWallSeconds = 0;
    }
    add(from, to, wallMs, playbackRate, eligible) {
      // Keine Suchsprünge, rückwärtslaufenden Zeiten, Hintergrund- oder Schlafzeit zählen.
      if (!eligible || ![from, to, wallMs, playbackRate].every(finite)) return false;
      if (from < 0 || to <= from || from >= this.duration || wallMs <= 0 || wallMs > 1500 || playbackRate <= 0 || playbackRate > 16) return false;
      const mediaDelta = to - from;
      if (mediaDelta > wallMs / 1000 * playbackRate + 0.35) return false;
      const range = [from, Math.min(to, this.duration)];
      if (range[1] <= range[0]) return false;
      const input = this.intervals.concat([range]).sort((a, b) => a[0] - b[0]);
      const merged = [];
      for (const current of input) {
        const last = merged[merged.length - 1];
        if (last && current[0] <= last[1] + 0.001) last[1] = Math.max(last[1], current[1]);
        else merged.push(current.slice());
      }
      this.intervals = merged;
      this.visibleWallSeconds += Math.min(wallMs / 1000, mediaDelta / playbackRate);
      return true;
    }
    coveredSeconds() { return this.intervals.reduce((sum, p) => sum + p[1] - p[0], 0); }
    fraction() { return Math.min(1, this.coveredSeconds() / this.duration); }
    milestones() {
      const fresh = [];
      for (const threshold of [25, 50, 90]) {
        if (this.fraction() * 100 + 1e-8 >= threshold && !this.sentMilestones.has(threshold)) {
          this.sentMilestones.add(threshold); fresh.push(threshold);
        }
      }
      return fresh;
    }
  }

  class EventBudget {
    constructor(maximum = 60) {
      if (!Number.isInteger(maximum) || maximum < 1 || maximum > 200) throw new TypeError('Ungültiges Ereignisbudget');
      this.maximum = maximum;
      this.sent = new Set();
    }
    accept(name) {
      // Feste kleine Ereignismenge statt Freitext oder Benutzerdaten.
      if (typeof name !== 'string' || !/^[a-z0-9][a-z0-9._-]{0,100}$/.test(name)) return false;
      if (this.sent.has(name) || this.sent.size >= this.maximum) return false;
      this.sent.add(name); return true;
    }
  }

  return Object.freeze({cleanReferrer, campaign, sectionVisible, DwellGate, VisibleMediaCoverage, EventBudget});
});
