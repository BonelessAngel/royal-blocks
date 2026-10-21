// Töne werden im Browser erzeugt (Web Audio), es gibt keine Tondateien.

let ctx = null;
let master = null;
let enabled = true;

export function setSoundEnabled(on) {
  enabled = on;
}

// Browser erlauben Ton erst nach einer Berührung; wird bei der ersten Eingabe aufgerufen.
export function unlockAudio() {
  if (ctx) {
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    return;
  }
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) return;
  ctx = new AudioCtx();
  master = ctx.createGain();
  master.gain.value = 0.35;
  master.connect(ctx.destination);
}

function tone(freq, { start = 0, dur = 0.15, type = 'sine', vol = 0.5, slide = 0 } = {}) {
  if (!enabled || !ctx) return;
  const t = ctx.currentTime + start;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (slide) osc.frequency.exponentialRampToValueAtTime(freq * slide, t + dur);
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(vol, t + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(gain).connect(master);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

// Pentatonik: klingt bei jeder Kombination harmonisch
const SCALE = [0, 2, 4, 7, 9];
const note = (step) => 440 * 2 ** ((SCALE[step % 5] + 12 * Math.floor(step / 5) - 9) / 12);

export const sounds = {
  pickup() {
    tone(660, { dur: 0.06, type: 'triangle', vol: 0.25 });
  },
  place() {
    tone(180, { dur: 0.09, type: 'triangle', vol: 0.6, slide: 0.6 });
    tone(900, { dur: 0.04, type: 'square', vol: 0.06 });
  },
  invalid() {
    tone(140, { dur: 0.14, type: 'sawtooth', vol: 0.12, slide: 0.8 });
  },
  // level = Stärke der Pokerhand (0..9), streak = laufende Serie
  clear(level, streak, combo) {
    const base = 5 + Math.min(streak, 6);
    const count = 3 + Math.min(level, 5);
    for (let k = 0; k < count; k++) {
      tone(note(base + k), { start: k * 0.05, dur: 0.22, type: 'triangle', vol: 0.35 });
    }
    if (combo > 1) tone(note(base + count + 2), { start: count * 0.05, dur: 0.4, type: 'sine', vol: 0.4 });
    if (level >= 4) {
      // starke Hand: Akkord mit Glitzern
      [0, 2, 4].forEach((s) => tone(note(base + 5 + s), { start: 0.3, dur: 0.7, type: 'sine', vol: 0.25 }));
      for (let k = 0; k < 6; k++) tone(note(base + 10 + k), { start: 0.35 + k * 0.04, dur: 0.12, type: 'square', vol: 0.05 });
    }
  },
  blocked() {
    tone(110, { dur: 0.35, type: 'sawtooth', vol: 0.18, slide: 0.7 });
    tone(116, { start: 0.02, dur: 0.35, type: 'square', vol: 0.08, slide: 0.7 });
    tone(80, { start: 0.12, dur: 0.3, type: 'triangle', vol: 0.4, slide: 0.8 });
  },
  levelUp() {
    [0, 2, 4, 5, 7].forEach((s, k) => tone(note(5 + s), { start: k * 0.09, dur: 0.3, type: 'square', vol: 0.12 }));
    tone(note(15), { start: 0.5, dur: 0.6, type: 'triangle', vol: 0.35 });
  },
  tableClear() {
    for (let k = 0; k < 10; k++) tone(note(8 + k), { start: k * 0.06, dur: 0.3, type: 'triangle', vol: 0.3 });
  },
  record() {
    [0, 2, 4, 7].forEach((s, k) => tone(note(10 + s), { start: k * 0.12, dur: 0.35, type: 'triangle', vol: 0.35 }));
  },
  gameOver() {
    [7, 4, 2, 0].forEach((s, k) => tone(note(5 + s), { start: k * 0.16, dur: 0.4, type: 'sine', vol: 0.3 }));
  },
};

let vibrationEnabled = true;
export function setVibrationEnabled(on) {
  vibrationEnabled = on;
}
export function vibrate(pattern) {
  if (vibrationEnabled && navigator.vibrate) {
    try {
      navigator.vibrate(pattern);
    } catch {
      // manche Browser verbieten Vibration – egal
    }
  }
}
