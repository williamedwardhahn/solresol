import { MIDI_NOTE_MAP, NOTES } from '../utils/constants.js';

/**
 * MIDI input handler with graceful fallback.
 * Emits custom events on the provided target element.
 *
 * Events dispatched:
 *   'midi:note'    — detail: { syllable, velocity, noteNumber }
 *   'midi:noteoff' — detail: { syllable, noteNumber }
 *   'midi:status'  — detail: { connected: bool, message: string }
 */
export class MidiInput {
  constructor(eventTarget = document) {
    this.target = eventTarget;
    this.access = null;
    this.inputs = [];
    this.silenceTimer = null;
    this.silenceTimeout = 1000; // ms
  }

  async init() {
    if (!navigator.requestMIDIAccess) {
      this._emit('midi:status', { connected: false, message: 'Web MIDI not supported' });
      return false;
    }

    try {
      this.access = await navigator.requestMIDIAccess();
      this._connectInputs();

      // Re-scan when devices change
      this.access.onstatechange = () => this._connectInputs();

      return true;
    } catch (err) {
      this._emit('midi:status', { connected: false, message: err.message });
      return false;
    }
  }

  _connectInputs() {
    this.inputs = Array.from(this.access.inputs.values());

    if (this.inputs.length === 0) {
      this._emit('midi:status', { connected: false, message: 'No MIDI devices found' });
      return;
    }

    this._emit('midi:status', {
      connected: true,
      message: `Connected: ${this.inputs.map(i => i.name).join(', ')}`,
    });

    for (const input of this.inputs) {
      input.onmidimessage = (e) => this._onMessage(e);
    }
  }

  _onMessage(event) {
    const [status, noteNumber, velocity] = event.data;
    const command = status & 0xf0;

    // Find closest solfege note (map across octaves)
    const pitchClass = noteNumber % 12;
    const baseMidi = 60 + pitchClass; // normalize to middle octave
    const syllable = MIDI_NOTE_MAP[baseMidi];

    if (!syllable) return; // not a solfege-mapped note

    if (command === 0x90 && velocity > 0) {
      this._emit('midi:note', { syllable, velocity, noteNumber });
      this._resetSilenceTimer();
    } else if (command === 0x80 || (command === 0x90 && velocity === 0)) {
      this._emit('midi:noteoff', { syllable, noteNumber });
    }
  }

  _resetSilenceTimer() {
    clearTimeout(this.silenceTimer);
    this.silenceTimer = setTimeout(() => {
      this._emit('midi:silence', {});
    }, this.silenceTimeout);
  }

  _emit(type, detail) {
    this.target.dispatchEvent(new CustomEvent(type, { detail }));
  }

  destroy() {
    for (const input of this.inputs) {
      input.onmidimessage = null;
    }
    clearTimeout(this.silenceTimer);
  }
}
