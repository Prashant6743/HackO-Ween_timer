/**
 * HackO'Ween — Timer, Dual-Theme System & Emergency Red Light Alarm System
 * Milestones: 3h, 2h, 1h, and 10m left trigger red light beacon and audible beep siren!
 */

/* ─── State ─── */
let serverOffset    = 0;
let startUTC        = null;
let endUTC          = null;

/* ─── DOM Elements ─── */
const daysEl          = document.getElementById('days');
const hoursEl         = document.getElementById('hours');
const minsEl          = document.getElementById('minutes');
const secsEl          = document.getElementById('seconds');
const phaseEl         = document.getElementById('timer-phase-label');
const displayEl       = document.getElementById('timer-display');
const endedEl         = document.getElementById('timer-ended-msg');
const timerWrap       = document.getElementById('timer-wrap');
const logoImg         = document.getElementById('logo-img');
const themeToggle     = document.getElementById('theme-toggle');
const themeLabel      = document.getElementById('theme-label');
const redAlertOverlay = document.getElementById('red-alert-overlay');
const alertBanner     = document.getElementById('alert-banner');
const alertBannerText = document.getElementById('alert-banner-text');
const alertDismissBtn = document.getElementById('alert-dismiss-btn');
const testAlertBtn    = document.getElementById('test-alert-btn');
const soundToggleBtn  = document.getElementById('sound-toggle-btn');
const soundIcon       = document.getElementById('sound-icon');

/* ─── Theme Management ─── */
const THEMES = {
  LIGHT: 'light',
  DARK: 'dark'
};

const PALETTES = {
  light: ['#e85d00', '#ff7a1a', '#c44a00', '#a06030'],
  dark:  ['#ff7a1a', '#ffa65c', '#c084fc', '#a855f7', '#e879f9']
};

let currentTheme = localStorage.getItem('hackoween_theme') || THEMES.LIGHT;

function applyTheme(theme) {
  currentTheme = theme;
  const isDark = theme === THEMES.DARK;

  document.body.classList.toggle('dark', isDark);

  if (logoImg) {
    logoImg.src = isDark ? 'logo-dark.png' : 'logo-light.png';
  }

  if (themeLabel) {
    themeLabel.textContent = isDark ? 'Light' : 'Dark';
  }

  if (themeToggle) {
    themeToggle.setAttribute('title', isDark ? 'Switch to Light Theme' : 'Switch to Dark Theme');
    themeToggle.setAttribute('aria-label', isDark ? 'Switch to Light Theme' : 'Switch to Dark Theme');
  }

  if (window.HackOWeen3D && window.HackOWeen3D.setTheme) {
    window.HackOWeen3D.setTheme(isDark);
  }

  localStorage.setItem('hackoween_theme', theme);
}

if (themeToggle) {
  themeToggle.addEventListener('click', () => {
    const nextTheme = currentTheme === THEMES.DARK ? THEMES.LIGHT : THEMES.DARK;
    applyTheme(nextTheme);
  });
}

// Initial theme apply
applyTheme(currentTheme);

/* ─── Audio Synthesizer (Beep Alert) ─── */
let audioCtx = null;
let soundEnabled = true;

function getAudioContext() {
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

// Unlock audio on any interaction
window.addEventListener('click', () => getAudioContext(), { once: false });
window.addEventListener('touchstart', () => getAudioContext(), { once: false });
window.addEventListener('keydown', () => getAudioContext(), { once: false });

function playBeepTone(freq = 880, duration = 0.16, type = 'sine', gainLevel = 0.3) {
  if (!soundEnabled) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);

    // Envelope
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(gainLevel, ctx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + duration);
  } catch (err) {
    console.warn('[Audio] Beep failed:', err);
  }
}

// Play multi-tone urgent alert pattern
function playAlertSiren() {
  if (!soundEnabled) return;
  // Tone 1
  playBeepTone(880, 0.18, 'triangle', 0.35);
  // Tone 2
  setTimeout(() => playBeepTone(880, 0.18, 'triangle', 0.35), 250);
  // Tone 3 (higher alarm accent)
  setTimeout(() => playBeepTone(1174, 0.35, 'sawtooth', 0.4), 500);

  // Second burst for urgency
  setTimeout(() => playBeepTone(880, 0.18, 'triangle', 0.35), 1100);
  setTimeout(() => playBeepTone(880, 0.18, 'triangle', 0.35), 1350);
  setTimeout(() => playBeepTone(1318, 0.45, 'sawtooth', 0.45), 1600);
}

// Sound toggle button
if (soundToggleBtn) {
  soundToggleBtn.addEventListener('click', () => {
    soundEnabled = !soundEnabled;
    soundIcon.textContent = soundEnabled ? '🔊' : '🔇';
    soundToggleBtn.title = soundEnabled ? 'Audio Alerts: ON (click to mute)' : 'Audio Alerts: MUTED (click to enable)';
    if (soundEnabled) {
      getAudioContext();
      playBeepTone(880, 0.1, 'sine', 0.2); // confirmation blip
    }
  });
}

/* ─── Emergency Red Light & Milestones Alert System ─── */
const ALERT_MILESTONES = [
  { id: '3h',  seconds: 3 * 3600, label: '3 Hours Remaining — Time Is Running Out!' },
  { id: '2h',  seconds: 2 * 3600, label: '2 Hours Remaining — Polish Your Builds!' },
  { id: '1h',  seconds: 1 * 3600, label: 'Final Hour Alert — 1 Hour Remaining!' },
  { id: '10m', seconds: 10 * 60,  label: 'Final Countdown — 10 Minutes Left! Submit on Unstop!' }
];

const triggeredMilestones = new Set();
let previousRemainingSeconds = null;
let alertTimerId = null;
let isEmergencyMode = false;

function triggerRedAlert(message, durationSec = 15) {
  if (alertTimerId) {
    clearTimeout(alertTimerId);
    alertTimerId = null;
  }

  // Activate red beacon visual effects
  if (redAlertOverlay) redAlertOverlay.classList.add('active');
  if (timerWrap) timerWrap.classList.add('alert-red');

  // Activate warning banner
  if (alertBanner && alertBannerText) {
    alertBannerText.textContent = message;
    alertBanner.classList.remove('hidden');
  }

  // Play audio siren beep
  playAlertSiren();

  // If duration > 0, auto-dismiss after durationSec seconds
  if (durationSec > 0) {
    alertTimerId = setTimeout(() => {
      dismissAlert(false);
    }, durationSec * 1000);
  }
}

function dismissAlert(force = true) {
  if (alertTimerId) {
    clearTimeout(alertTimerId);
    alertTimerId = null;
  }

  // If in final 10 minutes and not forced dismissal, keep red card active
  if (!force && isEmergencyMode) {
    if (alertBanner) alertBanner.classList.add('hidden');
    return;
  }

  if (redAlertOverlay) redAlertOverlay.classList.remove('active');
  if (timerWrap) timerWrap.classList.remove('alert-red');
  if (alertBanner) alertBanner.classList.add('hidden');
}

if (alertDismissBtn) {
  alertDismissBtn.addEventListener('click', () => dismissAlert(true));
}

// Test alarm button for immediate testing
if (testAlertBtn) {
  testAlertBtn.addEventListener('click', () => {
    getAudioContext();
    triggerRedAlert('🚨 Test Alert: Emergency Red Light Beacon & Beep Alarm Active!', 8);
  });
}

function checkAlertMilestones(totalSeconds) {
  // Final 10 minutes: persistent emergency mode
  if (totalSeconds <= 600 && totalSeconds > 0) {
    isEmergencyMode = true;
    if (timerWrap && !timerWrap.classList.contains('alert-red')) {
      timerWrap.classList.add('alert-red');
      if (redAlertOverlay) redAlertOverlay.classList.add('active');
    }
  } else {
    isEmergencyMode = false;
  }

  if (previousRemainingSeconds === null) {
    previousRemainingSeconds = totalSeconds;
    return;
  }

  // Check if crossing any milestone
  for (const m of ALERT_MILESTONES) {
    if (
      previousRemainingSeconds > m.seconds &&
      totalSeconds <= m.seconds &&
      !triggeredMilestones.has(m.id)
    ) {
      triggeredMilestones.add(m.id);
      const isPersistent = m.id === '10m';
      triggerRedAlert(m.label, isPersistent ? 0 : 15);
      break;
    }
  }

  previousRemainingSeconds = totalSeconds;
}

/* ─── Helpers ─── */
const pad = n => String(Math.max(0, Math.floor(n))).padStart(2, '0');
const now = () => Date.now() + serverOffset;

function tick(el, val) {
  if (el.textContent === val) return;
  el.textContent = val;
  el.classList.remove('tick');
  void el.offsetWidth;
  el.classList.add('tick');
  setTimeout(() => el.classList.remove('tick'), 300);
}

/* ─── Server sync ─── */
async function sync() {
  try {
    const t0  = Date.now();
    const res  = await fetch('/api/time');
    const data = await res.json();
    const t1  = Date.now();
    const latency = (t1 - t0) / 2;
    serverOffset = new Date(data.serverTime).getTime() + latency - t1;
    startUTC = new Date(data.targets.hackathonStart);
    endUTC   = new Date(data.targets.hackathonEnd);
  } catch (e) {
    console.warn('[Timer] sync failed:', e);
  }
}

/* ─── Update loop ─── */
function update() {
  if (!startUTC || !endUTC) return;
  const t = now();
  const start = startUTC.getTime();
  const end   = endUTC.getTime();

  if (t >= end) {
    // Ended
    displayEl.classList.add('hidden');
    endedEl.classList.remove('hidden');
    phaseEl.textContent = '🎃 Hackathon Complete!';
    dismissAlert(true);
    return;
  }

  const target = t < start ? start : end;
  phaseEl.textContent = t < start ? 'Hackathon Begins In' : '🔥 Hackathon In Progress — Ends In';

  const diff = Math.max(0, target - t);
  const total = Math.floor(diff / 1000);
  const d = Math.floor(total / 86400);
  const h = Math.floor((total % 86400) / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;

  tick(daysEl,  pad(d));
  tick(hoursEl, pad(h));
  tick(minsEl,  pad(m));
  tick(secsEl,  pad(s));

  // Check alert milestones (3h, 2h, 1h, 10m)
  checkAlertMilestones(total);
}

/* ─── Boot ─── */
(async function init() {
  await sync();
  update();
  setInterval(update, 1000);
  setInterval(sync, 30_000); // re-sync every 30s
})();
