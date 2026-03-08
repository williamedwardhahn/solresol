import { getFrequency } from '../utils/solresol.js';

let audioCtx = null;

function getContext() {
  if (!audioCtx) {
    try {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    } catch {
      console.warn('Web Audio API not supported');
      return null;
    }
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

/**
 * Play a single note
 * @param {string} syllable - e.g. 'do', 're'
 * @param {object} opts
 * @param {number} opts.duration - seconds (default 0.4)
 * @param {string} opts.waveform - 'sine'|'sawtooth'|'square'|'triangle'
 * @param {number} opts.gain - 0-1 (default 0.3)
 * @param {number} opts.startTime - audioCtx time offset (default now)
 */
export function playNote(syllable, opts = {}) {
  const ctx = getContext();
  if (!ctx) return;

  const {
    duration = 0.4,
    waveform = 'sine',
    gain = 0.3,
    startTime = ctx.currentTime,
  } = opts;

  const freq = getFrequency(syllable);
  if (!freq) return;

  const osc = ctx.createOscillator();
  const gainNode = ctx.createGain();

  osc.type = waveform;
  osc.frequency.setValueAtTime(freq, startTime);

  // ADSR-like envelope
  gainNode.gain.setValueAtTime(0, startTime);
  gainNode.gain.linearRampToValueAtTime(gain, startTime + 0.02);        // attack
  gainNode.gain.linearRampToValueAtTime(gain * 0.7, startTime + 0.1);   // decay
  gainNode.gain.setValueAtTime(gain * 0.7, startTime + duration - 0.05); // sustain
  gainNode.gain.linearRampToValueAtTime(0, startTime + duration);        // release

  osc.connect(gainNode);
  gainNode.connect(ctx.destination);

  osc.start(startTime);
  osc.stop(startTime + duration);
}

/**
 * Play a sequence of syllables
 * @param {string[]} syllables - array of syllable strings
 * @param {object} opts - same as playNote plus tempo
 * @param {number} opts.tempo - notes per second (default 2.5, clamped 0.1–10)
 */
export function playWord(syllables, opts = {}) {
  const ctx = getContext();
  if (!ctx) return;

  const { tempo = 2.5, ...noteOpts } = opts;
  const safeTempo = Math.max(0.1, Math.min(10, tempo || 2.5));
  const interval = 1 / safeTempo;

  syllables.forEach((syl, i) => {
    playNote(syl, {
      ...noteOpts,
      duration: interval * 0.9,
      startTime: ctx.currentTime + i * interval,
    });
  });
}

/**
 * Play multiple words as a sentence with pauses between words.
 * @param {string[][]} words - array of syllable arrays (one per word)
 * @param {object} opts - same as playWord plus wordGap
 * @param {number} opts.wordGap - seconds between words (default 0.5)
 */
export function playSentence(words, opts = {}) {
  const ctx = getContext();
  if (!ctx) return;

  const { tempo = 2.5, wordGap = 0.5, ...noteOpts } = opts;
  const safeTempo = Math.max(0.1, Math.min(10, tempo || 2.5));
  const interval = 1 / safeTempo;
  let offset = 0;

  for (const syllables of words) {
    syllables.forEach((syl, i) => {
      playNote(syl, {
        ...noteOpts,
        duration: interval * 0.9,
        startTime: ctx.currentTime + offset + i * interval,
      });
    });
    offset += syllables.length * interval + wordGap;
  }
}
