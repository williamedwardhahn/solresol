import { NOTES, NOTE_COLORS } from '../utils/constants.js';
import { SolresolWord } from '../models/word.js';
import { createWordBlocks } from './color-block.js';
import { playSentence } from '../audio/synth.js';
import { translate } from '../utils/solresol.js';
import { displayWord } from '../utils/format.js';
import { on } from '../utils/events.js';

/**
 * Sequencer component — timeline with record/play/loop, tempo control,
 * visual playback cursor, and MIDI export.
 */
export function createSequencer(container) {
  const state = {
    words: [],           // array of { syllables: string[], text: string }
    tempo: 2.5,          // notes per second
    wordGap: 0.5,        // seconds between words
    playing: false,
    looping: false,
    recording: false,
    cursor: 0,           // current playback position in seconds
    animFrame: null,
    playStartTime: null,
  };

  container.innerHTML = `
    <div class="seq-wrapper">
      <div class="seq-toolbar">
        <button class="btn btn--sm seq-rec" id="seq-rec" title="Record">&#9679; Rec</button>
        <button class="btn btn--sm" id="seq-play" title="Play">&#9654; Play</button>
        <button class="btn btn--sm" id="seq-stop" title="Stop">&#9632; Stop</button>
        <button class="btn btn--sm" id="seq-loop" title="Loop">&#8634; Loop</button>
        <button class="btn btn--sm" id="seq-clear" title="Clear">Clear</button>
        <div class="seq-tempo">
          <label class="seq-tempo-label">Tempo</label>
          <input type="range" id="seq-tempo" min="0.5" max="6" step="0.1" value="2.5" class="seq-tempo-slider">
          <span id="seq-tempo-val" class="seq-tempo-val">2.5</span>
        </div>
        <button class="btn btn--sm" id="seq-export" title="Export MIDI">Export MIDI</button>
      </div>
      <div class="seq-timeline" id="seq-timeline">
        <div class="seq-cursor" id="seq-cursor"></div>
        <div class="seq-blocks" id="seq-blocks"></div>
        <div class="seq-empty" id="seq-empty">Record or add words to build a sequence</div>
      </div>
      <div class="seq-info" id="seq-info"></div>
    </div>
  `;

  const recBtn = container.querySelector('#seq-rec');
  const playBtn = container.querySelector('#seq-play');
  const stopBtn = container.querySelector('#seq-stop');
  const loopBtn = container.querySelector('#seq-loop');
  const clearBtn = container.querySelector('#seq-clear');
  const tempoSlider = container.querySelector('#seq-tempo');
  const tempoVal = container.querySelector('#seq-tempo-val');
  const exportBtn = container.querySelector('#seq-export');
  const timeline = container.querySelector('#seq-timeline');
  const cursorEl = container.querySelector('#seq-cursor');
  const blocksEl = container.querySelector('#seq-blocks');
  const emptyEl = container.querySelector('#seq-empty');
  const infoEl = container.querySelector('#seq-info');

  // Tempo control
  tempoSlider.addEventListener('input', () => {
    state.tempo = parseFloat(tempoSlider.value);
    tempoVal.textContent = state.tempo.toFixed(1);
    renderTimeline();
  });

  // Record toggle
  recBtn.addEventListener('click', () => {
    state.recording = !state.recording;
    recBtn.classList.toggle('seq-rec--active', state.recording);
  });

  // Play
  playBtn.addEventListener('click', () => {
    if (state.words.length === 0) return;
    startPlayback();
  });

  // Stop
  stopBtn.addEventListener('click', stopPlayback);

  // Loop toggle
  loopBtn.addEventListener('click', () => {
    state.looping = !state.looping;
    loopBtn.classList.toggle('btn--active', state.looping);
  });

  // Clear
  clearBtn.addEventListener('click', () => {
    stopPlayback();
    state.words = [];
    renderTimeline();
  });

  // Export MIDI
  exportBtn.addEventListener('click', exportMidi);

  function addWord(syllables) {
    const text = displayWord(syllables);
    state.words.push({ syllables: [...syllables], text });
    renderTimeline();
  }

  function removeWord(index) {
    state.words.splice(index, 1);
    renderTimeline();
  }

  function getTotalDuration() {
    if (state.words.length === 0) return 0;
    const interval = 1 / state.tempo;
    let dur = 0;
    for (const w of state.words) {
      dur += w.syllables.length * interval + state.wordGap;
    }
    return dur - state.wordGap; // no gap after last word
  }

  function renderTimeline() {
    blocksEl.innerHTML = '';
    emptyEl.style.display = state.words.length === 0 ? '' : 'none';

    if (state.words.length === 0) {
      infoEl.textContent = '';
      return;
    }

    const totalDur = getTotalDuration();
    const interval = 1 / state.tempo;
    let offset = 0;

    for (let wi = 0; wi < state.words.length; wi++) {
      const w = state.words[wi];
      const wordDur = w.syllables.length * interval;
      const startPct = (offset / totalDur) * 100;
      const widthPct = (wordDur / totalDur) * 100;

      const block = document.createElement('div');
      block.className = 'seq-block';
      block.style.left = startPct + '%';
      block.style.width = widthPct + '%';

      // Syllable sub-blocks
      for (let si = 0; si < w.syllables.length; si++) {
        const syl = w.syllables[si];
        const subBlock = document.createElement('div');
        subBlock.className = 'seq-syl';
        subBlock.style.backgroundColor = NOTE_COLORS[syl] || '#555';
        subBlock.style.width = (100 / w.syllables.length) + '%';
        subBlock.title = syl;
        block.appendChild(subBlock);
      }

      // Label
      const label = document.createElement('div');
      label.className = 'seq-block-label';
      const def = translate(w.text.toLowerCase());
      label.textContent = def || w.text;
      block.appendChild(label);

      // Remove button
      const removeBtn = document.createElement('button');
      removeBtn.className = 'seq-block-remove';
      removeBtn.textContent = '×';
      removeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        removeWord(wi);
      });
      block.appendChild(removeBtn);

      blocksEl.appendChild(block);
      offset += wordDur + state.wordGap;
    }

    const totalNotes = state.words.reduce((s, w) => s + w.syllables.length, 0);
    infoEl.textContent = `${state.words.length} words, ${totalNotes} notes, ${totalDur.toFixed(1)}s`;
  }

  function startPlayback() {
    stopPlayback();
    if (state.words.length === 0) return;

    state.playing = true;
    playBtn.disabled = true;

    scheduleAudio();
    state.playStartTime = performance.now();
    state.cursor = 0;

    const totalDur = getTotalDuration();

    function tick() {
      const elapsed = (performance.now() - state.playStartTime) / 1000;
      state.cursor = elapsed;
      const pct = Math.min((elapsed / totalDur) * 100, 100);
      cursorEl.style.left = pct + '%';
      cursorEl.style.display = 'block';

      if (elapsed >= totalDur) {
        if (state.looping) {
          state.playStartTime = performance.now();
          scheduleAudio();
          state.animFrame = requestAnimationFrame(tick);
        } else {
          stopPlayback();
        }
        return;
      }
      state.animFrame = requestAnimationFrame(tick);
    }

    state.animFrame = requestAnimationFrame(tick);
  }

  function scheduleAudio() {
    const words = state.words.map(w => w.syllables);
    playSentence(words, { tempo: state.tempo, wordGap: state.wordGap });
  }

  function stopPlayback() {
    state.playing = false;
    playBtn.disabled = false;
    cursorEl.style.display = 'none';
    if (state.animFrame) {
      cancelAnimationFrame(state.animFrame);
      state.animFrame = null;
    }
  }

  function exportMidi() {
    if (state.words.length === 0) return;

    // Build a simple MIDI file (format 0)
    const TICKS_PER_BEAT = 480;
    const BPM = state.tempo * 60; // notes/sec -> beats/min (1 note = 1 beat)

    const sylToMidi = { do: 60, re: 62, mi: 64, fa: 65, sol: 67, la: 69, si: 71 };
    const events = [];
    let tick = 0;
    const noteDur = Math.round(TICKS_PER_BEAT * 0.9);
    const gapTicks = Math.round(state.wordGap * (BPM / 60) * TICKS_PER_BEAT);

    for (const w of state.words) {
      for (const syl of w.syllables) {
        const note = sylToMidi[syl] || 60;
        events.push({ tick, type: 'on', note, vel: 100 });
        events.push({ tick: tick + noteDur, type: 'off', note, vel: 0 });
        tick += TICKS_PER_BEAT;
      }
      tick += gapTicks;
    }

    // Sort events by tick
    events.sort((a, b) => a.tick - b.tick);

    // Convert to delta-time MIDI bytes
    const trackData = [];

    // Tempo meta event
    const uspb = Math.round(60000000 / BPM);
    trackData.push(0x00, 0xFF, 0x51, 0x03,
      (uspb >> 16) & 0xFF, (uspb >> 8) & 0xFF, uspb & 0xFF);

    let lastTick = 0;
    for (const ev of events) {
      const delta = ev.tick - lastTick;
      lastTick = ev.tick;
      trackData.push(...varLen(delta));
      trackData.push(ev.type === 'on' ? 0x90 : 0x80, ev.note, ev.type === 'on' ? ev.vel : 0);
    }

    // End of track
    trackData.push(0x00, 0xFF, 0x2F, 0x00);

    // Build file
    const header = [
      0x4D, 0x54, 0x68, 0x64, // MThd
      0x00, 0x00, 0x00, 0x06, // header length
      0x00, 0x00,             // format 0
      0x00, 0x01,             // 1 track
      (TICKS_PER_BEAT >> 8) & 0xFF, TICKS_PER_BEAT & 0xFF,
    ];

    const trackLen = trackData.length;
    const track = [
      0x4D, 0x54, 0x72, 0x6B, // MTrk
      (trackLen >> 24) & 0xFF, (trackLen >> 16) & 0xFF,
      (trackLen >> 8) & 0xFF, trackLen & 0xFF,
      ...trackData,
    ];

    const midiBytes = new Uint8Array([...header, ...track]);
    const blob = new Blob([midiBytes], { type: 'audio/midi' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'solresol-sequence.mid';
    a.click();
    URL.revokeObjectURL(url);
  }

  function varLen(value) {
    if (value < 0) value = 0;
    const bytes = [];
    bytes.push(value & 0x7F);
    value >>= 7;
    while (value > 0) {
      bytes.push((value & 0x7F) | 0x80);
      value >>= 7;
    }
    return bytes.reverse();
  }

  renderTimeline();

  // Cross-view recording: auto-add words committed from any view
  on('word:commit', ({ word }) => {
    if (state.recording && word && word.syllables) {
      addWord(word.syllables);
    }
  });

  // Allow other components (e.g. context panel) to add words directly
  on('sequencer:add', ({ syllables }) => {
    if (syllables) addWord(syllables);
  });

  // Public API
  return {
    el: container,
    addWord,
    removeWord,
    isRecording: () => state.recording,
    setRecording(val) {
      state.recording = val;
      recBtn.classList.toggle('seq-rec--active', val);
    },
    destroy() {
      stopPlayback();
      container.innerHTML = '';
    },
  };
}
