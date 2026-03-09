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

export { getContext };

// --------------- Reverb ---------------

let reverbEnabled = false;
let reverbNodes = null;

export function setReverb(enabled) {
  reverbEnabled = enabled;
}

export function isReverbEnabled() {
  return reverbEnabled;
}

/**
 * Create (or return cached) reverb effect nodes for the current AudioContext.
 * Chain: input → delay → feedbackGain → destination  (wet path)
 *        input → destination                          (dry path)
 * @returns {{ input: GainNode }}
 */
function getReverbChain(ctx) {
  if (reverbNodes && reverbNodes.ctx === ctx) return reverbNodes;

  const input = ctx.createGain();     // entry point for wet/dry routing
  const delay = ctx.createDelay(1.0);
  const feedback = ctx.createGain();
  const wet = ctx.createGain();

  delay.delayTime.value = 0.1;
  feedback.gain.value = 0.3;
  wet.gain.value = 0.4;  // wet mix level

  // feedback loop: delay → feedback → delay
  delay.connect(feedback);
  feedback.connect(delay);

  // wet path: input → delay → wet → destination
  input.connect(delay);
  delay.connect(wet);
  wet.connect(ctx.destination);

  // dry path: input → destination
  input.connect(ctx.destination);

  reverbNodes = { ctx, input };
  return reverbNodes;
}

// --------------- playNote ---------------

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

  if (reverbEnabled) {
    const reverb = getReverbChain(ctx);
    gainNode.connect(reverb.input);
  } else {
    gainNode.connect(ctx.destination);
  }

  osc.start(startTime);
  osc.stop(startTime + duration);
}

// --------------- playWord ---------------

/**
 * Play a sequence of syllables
 * @param {string[]} syllables - array of syllable strings
 * @param {object} opts - same as playNote plus tempo and stressIndex
 * @param {number} opts.tempo - notes per second (default 2.5, clamped 0.1–10)
 * @param {number} opts.stressIndex - index of stressed syllable (-1 = none)
 */
export function playWord(syllables, opts = {}) {
  const ctx = getContext();
  if (!ctx) return;

  const { tempo = 2.5, stressIndex = -1, ...noteOpts } = opts;
  const safeTempo = Math.max(0.1, Math.min(10, tempo || 2.5));
  const interval = 1 / safeTempo;
  let offset = 0;

  syllables.forEach((syl, i) => {
    const isStressed = i === stressIndex;
    const dur = isStressed ? interval * 0.9 * 1.3 : interval * 0.9;
    const g = isStressed ? (noteOpts.gain || 0.3) * 1.5 : noteOpts.gain;
    playNote(syl, {
      ...noteOpts,
      duration: dur,
      gain: g,
      startTime: ctx.currentTime + offset,
    });
    offset += isStressed ? interval * 1.3 : interval;
  });
}

// --------------- playSentence ---------------

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
