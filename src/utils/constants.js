export const NOTES = ['do', 're', 'mi', 'fa', 'sol', 'la', 'si'];

export const NOTE_COLORS = {
  do:  '#c40233',
  re:  '#e16b1a',
  mi:  '#eac100',
  fa:  '#00a368',
  sol: '#00b2b0',
  la:  '#0088bf',
  si:  '#624579',
};

export const NOTE_FREQUENCIES = {
  do:  261.626,
  re:  293.665,
  mi:  329.628,
  fa:  349.228,
  sol: 391.995,
  la:  440.000,
  si:  493.883,
};

// MIDI note number → solfege (middle octave C4=60)
export const MIDI_NOTE_MAP = {
  60: 'do',
  62: 're',
  64: 'mi',
  65: 'fa',
  67: 'sol',
  69: 'la',
  71: 'si',
};

export const NUMBER_TO_NOTE = {
  1: 'do',
  2: 're',
  3: 'mi',
  4: 'fa',
  5: 'sol',
  6: 'la',
  7: 'si',
};

export const NOTE_TO_NUMBER = Object.fromEntries(
  Object.entries(NUMBER_TO_NOTE).map(([k, v]) => [v, Number(k)])
);
