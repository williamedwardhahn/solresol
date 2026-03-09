import { parseWord, getColor, syllableToNumber } from './solresol.js';
import { displaySyllable, displayWord } from './format.js';

/**
 * Seven notation systems for Solresol.
 */

const BRAILLE = {
  do:  '⠁', re:  '⠂', mi:  '⠃',
  fa:  '⠄', sol: '⠅', la:  '⠆', si:  '⠇',
};

const BINARY = {
  do: '001', re: '010', mi: '011',
  fa: '100', sol: '101', la: '110', si: '111',
};

const ASCII_SHORT = {
  do: 'o', re: 'l', mi: 'n',
  fa: '7', sol: 'z', la: 'c', si: 'j',
};

const SAUSO = {
  do: '𐑴', re: '𐑦', mi: '𐑵',
  fa: '𐑳', sol: '𐑯', la: '𐑤', si: '𐑨',
};

/**
 * Get all notation representations for a Solresol word.
 * @param {string} word - Solresol word string
 * @returns {object} all notation forms
 */
export function getAllNotations(word) {
  const syllables = parseWord(word);
  if (syllables.length === 0) return null;

  return {
    solfege: displayWord(syllables),
    numbers: syllables.map(s => syllableToNumber(s)).join(''),
    colors: syllables.map(s => getColor(s)),
    binary: syllables.map(s => BINARY[s]).join(' '),
    braille: syllables.map(s => BRAILLE[s]).join(''),
    ascii: syllables.map(s => ASCII_SHORT[s]).join(''),
    sauso: syllables.map(s => SAUSO[s]).join(''),
  };
}

/** Get the notation map for a single syllable */
export function getSyllableNotations(syllable) {
  const s = syllable.toLowerCase();
  return {
    solfege: displaySyllable(s),
    number: syllableToNumber(s),
    color: getColor(s),
    binary: BINARY[s] || '',
    braille: BRAILLE[s] || '',
    ascii: ASCII_SHORT[s] || '',
    sauso: SAUSO[s] || '',
  };
}

/** All notation system names for UI toggles */
export const NOTATION_SYSTEMS = [
  { key: 'solfege', label: 'Solfege' },
  { key: 'numbers', label: 'Numbers' },
  { key: 'colors',  label: 'Colors' },
  { key: 'binary',  label: 'Binary' },
  { key: 'braille', label: 'Braille' },
  { key: 'ascii',   label: 'ASCII' },
  { key: 'sauso',   label: 'Sauso' },
];
