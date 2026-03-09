const STARRED_KEY = 'solresol:starred';
const CUSTOM_DEFS_KEY = 'solresol:custom-defs';

/**
 * Check if a word is starred
 * @param {string} text - word text like "fala"
 */
export function isStarred(text) {
  try {
    const starred = JSON.parse(localStorage.getItem(STARRED_KEY) || '[]');
    return starred.includes(text);
  } catch { return false; }
}

/**
 * Toggle star status. Returns new starred state.
 */
export function toggleStar(text) {
  try {
    const starred = JSON.parse(localStorage.getItem(STARRED_KEY) || '[]');
    const idx = starred.indexOf(text);
    if (idx === -1) starred.push(text);
    else starred.splice(idx, 1);
    localStorage.setItem(STARRED_KEY, JSON.stringify(starred));
    return idx === -1;
  } catch { return false; }
}

/**
 * Get all starred words
 */
export function getStarredWords() {
  try {
    return JSON.parse(localStorage.getItem(STARRED_KEY) || '[]');
  } catch { return []; }
}

/**
 * Save a custom definition for an undefined word
 */
export function setCustomDefinition(wordText, definition) {
  try {
    const defs = JSON.parse(localStorage.getItem(CUSTOM_DEFS_KEY) || '{}');
    defs[wordText] = definition;
    localStorage.setItem(CUSTOM_DEFS_KEY, JSON.stringify(defs));
  } catch {}
}

/**
 * Get custom definition for a word (or null)
 */
export function getCustomDefinition(wordText) {
  try {
    const defs = JSON.parse(localStorage.getItem(CUSTOM_DEFS_KEY) || '{}');
    return defs[wordText] || null;
  } catch { return null; }
}

/**
 * Get all custom definitions
 */
export function getAllCustomDefinitions() {
  try {
    return JSON.parse(localStorage.getItem(CUSTOM_DEFS_KEY) || '{}');
  } catch { return {}; }
}

/**
 * Remove a custom definition
 */
export function removeCustomDefinition(wordText) {
  try {
    const defs = JSON.parse(localStorage.getItem(CUSTOM_DEFS_KEY) || '{}');
    delete defs[wordText];
    localStorage.setItem(CUSTOM_DEFS_KEY, JSON.stringify(defs));
  } catch {}
}

/**
 * Get vocabulary stats
 */
export function getVocabStats() {
  const starred = getStarredWords();
  const customDefs = getAllCustomDefinitions();
  return {
    starredCount: starred.length,
    customDefCount: Object.keys(customDefs).length,
    starred,
    customDefs,
  };
}
