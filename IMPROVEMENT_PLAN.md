# Solresol: Joint Improvement Plan
## Brett Victor & Alan Kay — A Collaborative Redesign

---

## Preamble

**Victor:** I have read every file in this codebase. The bones are solid — clean vanilla JS, a real synthesizer with ADSR envelopes (`src/audio/synth.js`), MIDI input support (`src/audio/midi.js`), seven notation systems (`src/utils/notation.js`), a 3,152-entry dictionary, and an SVG sheet music renderer. What is missing is not *capability* but *coupling*. Every representation — sound, color, number, notation, gesture — lives in its own silo. The color blocks (`src/components/color-block.js`) are output-only. The synth is play-only. The dictionary is a table you scroll. Nothing feeds back into anything else.

**Kay:** And nothing is *alive*. I count nine views in `src/app.js`, each rendering its own static HTML into `#app-content` and then wiring up event handlers procedurally. There is no shared object model for "a Solresol word" that all views observe and manipulate simultaneously. The `buildSentence()` function in `src/utils/grammar.js` is pure logic that no view ever calls. The MIDI Lab (`src/views/midi-lab.js`) is the closest thing to a living environment — you play notes and words form — but it is quarantined in its own tab, disconnected from the dictionary, the translator, and the quiz.

**Together:** This plan transforms the site from nine separate pages *about* Solresol into a single unified *medium* for thinking in Solresol.

---

## Architecture: The Missing Abstraction

Before individual features, we must establish the shared object that every improvement depends on.

### A0. Create `SolresolWord` — The Living Object

**What:** A new module `src/models/word.js` that represents a Solresol word as a single observable entity exposing *all* its simultaneous representations.

**Why (Victor):** Right now, to display a word, every view independently calls `parseWord()`, `getColor()`, `createWordBlocks()`, `createSheetMusic()`, `createNotationDisplay()`, `playWord()`, and `translate()`. The word is not an object — it is a series of function calls scattered across nine views. If you change one representation, nothing else reacts.

**Why (Kay):** A Solresol word *is* simultaneously a sound, a color sequence, a number, a notation, a gesture, and a meaning. That simultaneity is the entire point of Sudre's invention. We need a single object that *is* all of these at once, and that any part of the UI can observe.

**How:**
```js
// src/models/word.js
import { parseWord, getColor, getFrequency, translate } from '../utils/solresol.js';
import { getAllNotations } from '../utils/notation.js';
import { getAntonym } from '../utils/antonyms.js';
import { getSemanticCategory } from '../utils/grammar.js';

export class SolresolWord {
  constructor(input) {
    // Accept syllable array, string, or number string
    this.syllables = Array.isArray(input) ? input : parseWord(String(input));
    this._listeners = new Set();
  }

  get text() { return this.syllables.map(s => s[0].toUpperCase() + s.slice(1)).join(''); }
  get colors() { return this.syllables.map(getColor); }
  get frequencies() { return this.syllables.map(getFrequency); }
  get definition() { return translate(this.text); }
  get notations() { return getAllNotations(this.text); }
  get antonym() { return getAntonym(this.text); }
  get category() { return getSemanticCategory(this.text); }
  get length() { return this.syllables.length; }

  reversed() { return new SolresolWord([...this.syllables].reverse()); }

  onChange(fn) { this._listeners.add(fn); return () => this._listeners.delete(fn); }
  _notify() { this._listeners.forEach(fn => fn(this)); }

  push(syllable) { this.syllables.push(syllable); this._notify(); }
  pop() { this.syllables.pop(); this._notify(); }
  clear() { this.syllables = []; this._notify(); }
  set(syllables) { this.syllables = [...syllables]; this._notify(); }
}
```

**Files affected:** New file. Then gradually replace raw `parseWord()` + scattered function calls in every view.

### A1. Create `WordRenderer` — The Unified Display Component

**What:** A new component `src/components/word-renderer.js` that, given a `SolresolWord`, renders *all active representations simultaneously* and updates reactively.

**Why (Victor):** Currently `createWordBlocks()`, `createNotationDisplay()`, `createSheetMusic()` are three separate functions that produce three separate DOM trees with no connection. A word should be *one visual object* showing all its faces at once, and clicking/hovering on any face should highlight the corresponding element in every other face.

**How:** This component takes a `SolresolWord` and a `Set` of active representation modes. It renders a unified card where:
- Color blocks, sheet music notes, number digits, and braille characters are vertically aligned so that each syllable forms a column.
- Hovering over any element highlights the corresponding syllable across ALL representations.
- Clicking any element plays that syllable's note.
- The component subscribes to `word.onChange()` and re-renders reactively.

This replaces the current pattern where `dictionary.js` line 157 does `card.append(title, createWordBlocks(syllables), defEl, notation, createSheetMusic(syllables))` as five disconnected append calls.

---

## Phase 1: Transform the Entry Point (Highest Impact)

### 1.1 Replace Translator with a Play-First Instrument

**What:** The current default view (`#translator`, `DEFAULT_ROUTE` in `src/app.js` line 23) is a text input. Replace it with an interactive **Solresol Instrument** — a merged, enhanced version of the current MIDI Lab (`src/views/midi-lab.js`) and translator.

**Why (Victor):** The first thing you encounter is a text box that says "Type an English word..." This is exactly backwards. You should *play* first. The MIDI Lab already has an on-screen keyboard (lines 49-57 of `midi-lab.js`) and the synth already supports ADSR envelopes. But these are hidden on a separate tab. The instrument should BE the front door.

**Why (Kay):** The medium must be play-first. Nobody learned piano by typing note names into a search box. The keyboard/MIDI interaction from `midi-lab.js` must be the primary interface, with translation appearing as a *consequence* of playing, not a *precondition* for hearing.

**How — specific changes:**

1. **In `src/app.js`:** Change `DEFAULT_ROUTE` from `'translator'` to `'instrument'`. Add new route:
   ```js
   instrument: { label: 'Play', render: renderInstrument }
   ```

2. **New file `src/views/instrument.js`:** Combines the on-screen keyboard from `midi-lab.js` (lines 49-57), the MIDI input initialization (lines 60-76), the word-building logic (lines 89-110), and adds:
   - **The 7-key instrument** — large, colored, touchable keys that produce sound immediately (using `playNote()` from `synth.js` with the existing ADSR envelope). These are the `.midi-key` buttons from `midi-lab.js` but larger, centered, and the first thing you see.
   - **Keyboard mapping** — already exists in `midi-lab.js` lines 154-161 (keys 1-7). Extend to also map QWEASD or ASDFGHJ (home row) for more natural typing-as-playing.
   - **Live word formation** — as you play notes, syllables accumulate (reuse `currentSyllables` pattern from `midi-lab.js` line 45). A `WordRenderer` shows the forming word in ALL representations simultaneously (color, staff, number, braille).
   - **Automatic dictionary lookup** — after a silence timeout (reuse `midi.silenceTimeout` pattern, `midi.js` line 18), or on explicit commit, show the English meaning IF the word exists. This replaces the current `commitWord()` function in `midi-lab.js` lines 100-110 but adds visual feedback: the word "lights up" if found in the dictionary, dims if not.
   - **Bidirectional translation panel** — a collapsible secondary panel (not the primary interface) that provides the current `renderTranslator()` text-input functionality for when users DO want to type English.

3. **Reuse existing CSS:** The `.midi-keyboard` and `.midi-key` styles in `components.css` lines 24-46 already handle the colored keys with hover/active transforms. Scale them up for the instrument view.

4. **Remove or repurpose `midi-lab.js`:** Its functionality is absorbed into the instrument. The MIDI Lab tab becomes "Advanced" with waveform selection and composition features (see Phase 3).

### 1.2 Make Color Blocks Clickable Input, Not Just Output

**What:** Transform `createBlock()` and `createWordBlocks()` in `src/components/color-block.js` from display-only to interactive.

**Why (Victor):** Color blocks appear everywhere — dictionary rows, translator results, quiz options, explorer entries, antonym pairs, phrasebook, numbers. They are currently `<div>` elements with `aria-label` (line 26) but no click/touch handlers. Every single color block on the site should be an instrument key.

**How:**
1. **In `src/components/color-block.js`:** Add an optional `onClick` handler to `createBlock()`:
   ```js
   export function createBlock(syllable, opts = {}) {
     const { showLabel = true, size = 'md', interactive = false, onPlay } = opts;
     const el = document.createElement(interactive ? 'button' : 'div');
     // ... existing code ...
     if (interactive || onPlay) {
       el.style.cursor = 'pointer';
       el.setAttribute('role', 'button');
       el.setAttribute('tabindex', '0');
       el.addEventListener('click', () => {
         playNote(syllable, { duration: 0.4 });
         if (onPlay) onPlay(syllable);
       });
     }
     return el;
   }
   ```

2. **In `createWordBlocks()`:** Add a `playable: true` option that makes each block clickable and also adds a "play all" behavior on double-click of the container:
   ```js
   if (opts.playable) {
     row.addEventListener('dblclick', () => playWord(syllables));
   }
   ```

3. **Propagate `playable: true` everywhere:** In `dictionary.js`, `explorer.js`, `antonyms.js`, `phrasebook.js`, `numbers.js` — every call to `createWordBlocks()` should pass `{ playable: true }`. This is approximately 15 call sites across the codebase. Each is a one-line change adding the option.

### 1.3 Unify Representations with Cross-Highlighting

**What:** When you hover over a color block, highlight the corresponding note on a staff, the corresponding number, and the corresponding braille character — and vice versa.

**Why (Kay):** Solresol's genius is that the SAME word is sound AND color AND number AND music AND gesture. But currently, `createNotationDisplay()` in `src/components/notation-display.js` renders each notation as a separate `.notation-row` (lines 21-64) with no connection between them. The color blocks in `color-block.js` know nothing about the notation display. The sheet music in `sheet-music.js` knows nothing about either.

**How:**
1. **In `WordRenderer` (new component from A1):** Assign each syllable position a data attribute (`data-syl-index="0"`, etc.) across ALL representations — the color block, the staff note, the number digit, the braille character.

2. **Add a shared hover handler:** When any element with `data-syl-index` is hovered, find all sibling elements with the same index and add a `.syl-highlight` class. CSS handles the visual:
   ```css
   .syl-highlight { outline: 2px solid var(--accent); outline-offset: 2px; }
   ```

3. **On click of any syllable element in the unified display:** play that single note using `playNote()` from `synth.js`.

---

## Phase 2: Transform the Dictionary into a Spatial, Explorable Map

### 2.1 Spatial Dictionary View (replacing the paginated table)

**What:** Replace the flat paginated list in `src/views/dictionary.js` (the `dict-list` div populated in the `render()` function, lines 81-149) with a zoomable spatial layout.

**Why (Victor):** The dictionary currently displays 50 entries per page in a grid of `[word | blocks | definition | play]` rows (`.dict-row` with `grid-template-columns: 140px auto 1fr 40px`). With 3,152 entries, this is 63 pages. You cannot see the shape of the language. You cannot see that words starting with "Do" cluster around time/universe, or that 4-syllable words dominate the vocabulary. The dictionary should be a *map* you explore, not a list you scroll.

**Why (Kay):** The `SEMANTIC_CATEGORIES` in `grammar.js` (lines 93-101) define seven domains — one per note. The `renderExplorer()` function in `explorer.js` already groups words by first syllable and then by two-syllable family prefixes. But it renders them as collapsible sections (line 95: `list.style.display = expanded ? 'flex' : 'none'`). The spatial structure of the language should be *visible*, not hidden behind toggles.

**How — The Sunburst/Treemap Layout:**

1. **New file `src/views/dictionary-spatial.js`:** Renders a zoomable sunburst or treemap using vanilla SVG (no library needed — the codebase already renders SVG in `sheet-music.js`).

2. **Structure:** The outermost ring/level shows 7 segments — one per starting note, colored by `NOTE_COLORS` from `constants.js`. The second ring subdivides by the second syllable (7x7 = 49 two-syllable prefixes). The third ring shows individual words. Each cell is sized proportionally to the number of entries.

3. **Interaction:**
   - **Click a segment** to zoom in (filter to that prefix). The existing `applyFilters()` function in `dictionary.js` (lines 61-79) already handles `startNote` filtering — reuse this logic.
   - **Hover a segment** to hear its base syllables (using `playWord()`).
   - **Each word cell** shows its color blocks and, on hover, expands to reveal definition, antonym link, and full notation display.

4. **Preserve the list view as an option:** Add a toggle between "Map" and "List" views at the top of the dictionary. The list view keeps the current `render()` function's paginated approach. The map view is the new default.

5. **SVG implementation approach:** Use `<g>` groups with `transform` for zoom. Each segment is a `<path>` (arc for sunburst) or `<rect>` (for treemap) filled with the note color at reduced opacity, with text labels. The existing SVG skills from `sheet-music.js` (namespace handling, attribute setting patterns) transfer directly.

### 2.2 Dictionary Detail Pane — Unified Word View

**What:** Replace the current inline `showDetail()` function in `dictionary.js` (lines 176-235) with a slide-out panel that uses the new `WordRenderer` component.

**Why:** Currently, clicking a dictionary row inserts a `.dict-detail` div after the row (line 234: `rowEl.after(detail)`) containing blocks, definition, category, antonym text, notation toggles, and sheet music — but these are all disconnected static elements. The detail view should be a living, interactive `WordRenderer`.

**How:**
1. The detail pane renders a `SolresolWord` instance through `WordRenderer`.
2. The antonym is shown as a *linked pair* — the original word and its reversal side by side, with a button to flip between them (see Phase 2.3).
3. The `getSemanticCategory()` result (currently just a text label, line 198-203) becomes a link back to the spatial map, zooming to that category.
4. Related words (same 2-syllable prefix) are shown as a small cluster, pulled from the same `families` grouping logic used in `explorer.js` lines 52-65.

### 2.3 Dynamic Antonym Reversal

**What:** Replace the static antonym list in `src/views/antonyms.js` with an interactive reversal visualizer.

**Why (Victor):** The current antonym view renders 22 hardcoded pairs from `ANTONYM_PAIRS` in `antonyms.js` (utils) as static rows with a `↔` arrow between them. The arrow is text (line 40: `arrow.textContent = '↔'`). You cannot *do* anything with it. The reversal — Solresol's most elegant structural principle — should be something you *perform*, not something you read about.

**Why (Kay):** The `getAntonym()` function in `utils/antonyms.js` (lines 49-64) already computes automatic reversal for ANY word, not just the 22 hardcoded pairs. Lines 56-63 reverse the syllables and check the dictionary. This capability is hidden behind a utility function that only the dictionary detail view calls.

**How:**

1. **New interaction: Drag-to-reverse.** Display a word as an array of color blocks. The user can *drag the entire row* to reverse it (or click a "Reverse" button, or use a keyboard shortcut). The blocks animate into their reversed positions using CSS transitions:
   ```css
   .antonym-block { transition: transform 0.4s ease-in-out; }
   ```
   As the blocks move, the sound plays in reverse order (using `playWord()` with the reversed syllable array). The definition label cross-fades from the original meaning to the antonym meaning.

2. **Any-word reversal tool.** Add an input field at the top of the antonym view where you can type or play ANY Solresol word and see its reversal computed live (using the existing `getAntonym()` auto-reversal logic). Show whether the reversed word exists in the dictionary. This turns the antonym view from a reference table into an exploration tool.

3. **Reversal available everywhere.** Add a small "reverse" icon button to every `WordRenderer` instance. When clicked, it animates the syllable reversal in place. This makes the antonym principle discoverable in every context — dictionary, translator, quiz feedback.

4. **Visual connection:** When viewing a word and its antonym side by side, draw SVG connector lines between corresponding syllable positions (syllable 1 connects to syllable N, syllable 2 to syllable N-1, etc.), making the reversal structure visible as a crossing pattern.

---

## Phase 3: Build a Composition Environment

### 3.1 The Sentence Builder — Executable Grammar

**What:** Create a new view `src/views/composer.js` that makes the `buildSentence()` function from `src/utils/grammar.js` (lines 40-78) interactive and audible.

**Why (Victor):** `buildSentence()` is a beautiful piece of logic that nobody ever sees. It accepts `{ subject, directObj, adjective, tense, verb, adverb, indirectObj, negate, question, modifier }` and produces correctly ordered Solresol words. But no view calls it. The translator's sentence mode (`doSentence()` in `translator.js` lines 161-214) does word-by-word English-to-Solresol lookup — it doesn't use grammar rules at all.

**Why (Kay):** Grammar should be *executable*, not descriptive. The reference page (`reference.js` lines 29-62) describes word order and stress rules as static HTML bullet points. But Sudre's grammar IS a program — word order is fixed, tense is a prefix marker, stress changes part of speech. You should be able to *construct* sentences by slotting words into grammatical roles and hear/see the result as a musical phrase.

**How:**

1. **Slot-based interface.** Display labeled slots in a horizontal row: `[Subject] [Direct Object] [Adjective] [Tense] [Verb] [Adverb] [Indirect Object]`. Each slot is a drop zone.

2. **Word palette.** Below the slots, show a searchable word palette (reuse `searchDictionary()` from `solresol.js` line 79). Words can be dragged from the palette into slots, or clicked to fill the next empty slot.

3. **Tense/modifier controls.** The `TENSE_MARKERS` (grammar.js lines 8-16) and `MODIFIERS` (lines 18-23) become dropdown selectors attached to their respective slots. Selecting "Past" auto-inserts `Dodo` before the verb, visually showing the tense marker as a separate block.

4. **Live output.** As slots are filled, the composed sentence renders below using `WordRenderer`, showing the full sentence as:
   - A sequence of color block groups (word boundaries visible)
   - Sheet music (using `createSheetMusic()` with the flat syllable array)
   - All active notation systems
   - A play button that calls `playSentence()` (from `synth.js` lines 92-111) with appropriate word gaps

5. **Stress visualization.** The `STRESS_RULES` from `grammar.js` lines 83-88 become interactive. Each word in the sentence has a small toggle: noun (no stress), adjective (last syllable stressed), verb (penultimate), adverb (antepenultimate). Changing the stress:
   - Visually bolds/enlarges the stressed syllable's color block
   - Changes the audio: the stressed syllable plays louder (increase `gain` parameter in the `playNote()` call) and slightly longer

6. **Negation and question.** Toggle buttons for `negate` (prefixes `Do` to the verb, grammar.js line 67) and `question` (appends `Sol` to the sentence, line 75). These animate into the sentence — a "Do" block slides in before the verb, a "Sol" block appends to the end.

7. **Route:** Add to `app.js` routes as `composer: { label: 'Compose', render: renderComposer }`.

### 3.2 Evolve the MIDI Lab into a Sequencer

**What:** After the MIDI Lab's basic functionality moves to the Instrument view (Phase 1.1), repurpose the MIDI Lab route as an advanced **Solresol Sequencer**.

**Why:** The current MIDI Lab (`midi-lab.js`) only supports linear note-by-note entry with auto-commit at 5 syllables (line 95). There is no way to edit, reorder, or loop. A sequencer would let users compose multi-word phrases and hear them as music.

**How:**

1. **Grid sequencer.** A 7-row (one per note) by N-column (beats) grid. Clicking a cell toggles that note at that beat. Rows are colored by `NOTE_COLORS`. Playing steps through columns left to right.

2. **Word grouping.** Users can select consecutive columns and group them as a "word." The sequencer calls `translate()` on each group and shows the English meaning below.

3. **Loop playback.** A play/pause button loops the sequence. Tempo control (reuse the `tempo` parameter from `playWord()` in `synth.js` line 73).

4. **Export.** Generate a shareable URL encoding the sequence in the hash (the app already uses hash-based routing with query params — see `getHashParams()` in `app.js` lines 33-38).

---

## Phase 4: Restructure the Quiz Toward Play-First Learning

### 4.1 Ear-First Progression

**What:** Redesign the quiz (`src/views/quiz.js`) to start from listening/playing and build toward reading/translating, instead of the current mode-select approach.

**Why (Victor):** The quiz offers three modes — "Note Recognition," "Word Building," and "Translation" — as equal choices (line 20-24). But these represent a learning progression that should be sequential. Note Recognition (lines 80-137) plays a note and asks you to identify it — this is the right starting point. Word Building (lines 140-223) asks you to reconstruct a heard word — this is the right second step. Translation (lines 226-313) tests vocabulary — this should come last. The quiz should guide this progression, not present it as a flat menu.

**Why (Kay):** More fundamentally, the quiz should teach through *structure*, not recall. The current translation quiz (lines 226-313) is multiple choice: "Which Solresol word means X?" with 4 random options. This tests memorization. Instead, it should teach the structural principles — why words starting with "Mi" relate to emotions, why reversal creates opposites, why stress changes part of speech.

**How:**

1. **Progressive unlocking.** Start with Note Recognition. After a streak of 5, unlock Word Building. After a streak of 5 there, unlock Translation. Show progress visually.

2. **Structural quiz modes** (new):
   - **Category quiz:** Play a word, ask which semantic domain it belongs to (using `getSemanticCategory()`). The 7 category buttons from `explorer.js` (lines 24-39) become the answer options. This teaches the first-syllable rule.
   - **Antonym quiz:** Show a word, ask the user to *play* its antonym by reversing the syllables on the instrument keyboard. This teaches the reversal principle through action, not recall.
   - **Stress quiz:** Play the same word with different stress patterns. Ask which part of speech it became. This teaches the `STRESS_RULES` from `grammar.js`.

3. **Instrument-based answering.** For Word Building, replace the 7 separate note buttons (quiz.js lines 174-181) with the same colored instrument keyboard from the Instrument view. The student literally *plays* the answer.

4. **Immediate feedback through all representations.** When the correct answer is revealed, show it through the `WordRenderer` — all representations simultaneously. This replaces the current text-only feedback (e.g., line 113: `feedback.textContent = correct ? 'Correct!' : 'Wrong — it was ...'`).

### 4.2 Spaced Repetition Memory

**What:** Track which words/concepts the user gets wrong and preferentially re-test them.

**How:** Store quiz history in `localStorage`. Maintain a simple map of `{ word: { correct: N, wrong: N, lastSeen: timestamp } }`. The `pickRandom()` function in quiz.js (lines 62-64) currently does pure random selection — replace it with weighted selection favoring words with lower accuracy or older `lastSeen`.

---

## Phase 5: Unify the Explorer, Dictionary, and Reference

### 5.1 Merge Explorer into Dictionary

**What:** The Semantic Explorer (`src/views/explorer.js`) and the Dictionary (`src/views/dictionary.js`) show the same data (both call `getAllEntries()`) with different organizations. Merge them into one view with switchable layouts.

**Why:** Currently, exploring by semantic category requires navigating to a different tab. In the spatial dictionary (Phase 2.1), semantic categories are ALREADY the top-level organization. The Explorer's category buttons (`explorer-cats`) become filters/zoom-levels in the spatial dictionary.

**How:** Remove the separate `explorer` route from `app.js`. Add a "By Category" layout option to the dictionary view alongside "Map" and "List." The category buttons from explorer.js (lines 24-39) become a sidebar or filter bar in the dictionary.

### 5.2 Make the Reference Page Interactive

**What:** Transform `src/views/reference.js` from static HTML articles into interactive demonstrations.

**Why (Kay):** The reference page has five `<article class="ref-section">` blocks of static text describing Solresol. The "Grammar Rules" section (lines 29-62) describes word order, stress, antonyms, gender, and tense — all as text. But we now have executable grammar (`buildSentence()`), a composer, and interactive antonyms. Each reference section should be a *live demo*.

**How:**

1. **"The Seven Notes" section** (lines 27-28): Already has clickable cards (lines 94-123). Good. Enhance by adding mini color blocks and all notation representations.

2. **"Grammar Rules" section:** Replace the bullet-point descriptions with embedded mini-versions of the composer. Example: the "Word Order" section shows a pre-filled `buildSentence()` example that the user can modify. The "Stress" section shows the same word with toggleable stress, playing different audio for each.

3. **"Antonyms by Reversal" section** (lines 48-51): Currently shows one hardcoded example (Fala/Lafa, lines 125-145). Replace with the drag-to-reverse widget from Phase 2.3, pre-loaded with Fala.

4. **"Communication Modes" table** (lines 64-79): Replace the static `<table>` with a live demo where a single word is entered/played and ALL communication modes update simultaneously — this is exactly what `WordRenderer` does.

---

## Phase 6: Technical Improvements

### 6.1 Event Bus for Cross-View Communication

**What:** Create a simple pub/sub event bus `src/utils/events.js` for decoupled communication.

**Why:** Currently, the only cross-component communication is MIDI events dispatched on `document` (midi.js line 85). The app needs events like `word:selected`, `word:played`, `syllable:hover` that any component can emit and any other can respond to.

**How:**
```js
// src/utils/events.js
const bus = new EventTarget();
export const emit = (type, detail) => bus.dispatchEvent(new CustomEvent(type, { detail }));
export const on = (type, fn) => { bus.addEventListener(type, fn); return () => bus.removeEventListener(type, fn); };
```

### 6.2 Persistent State

**What:** Save user preferences (active notations, quiz progress, last viewed word) in `localStorage`.

**Why:** Currently, `activeNotations` in `dictionary.js` (line 174) is reset to default on every page load. Quiz score (quiz.js lines 37-38) resets on every tab switch. The notation toggles in `createNotationToggles()` are local to each view instance.

**How:** A `src/utils/store.js` module with `get(key, default)` and `set(key, value)` wrapping `localStorage` with JSON serialization.

### 6.3 Keyboard Shortcut System

**What:** Unify keyboard handling across views.

**Why:** Currently, keyboard handlers are registered and cleaned up per-view: quiz.js registers `keydown` for 1-7 (line 133), midi-lab.js registers `keydown` for 1-7 (line 155). These conflict if not properly cleaned up (though the current `currentCleanup` pattern in `app.js` lines 41-44 handles this). A global shortcut system would allow: Space = play current word, R = reverse, 1-7 = play notes (globally), Escape = clear.

**How:** A `src/utils/shortcuts.js` module that registers global listeners and exposes `registerShortcut(key, handler, { view?: string })` with automatic cleanup on view change.

### 6.4 Touch/Gesture Support for Mobile

**What:** Add touch gestures to the instrument keyboard and color blocks.

**Why:** The `.midi-key` buttons in `components.css` (lines 33-46) have hover/active transforms but no touch-specific handling. On mobile, the instrument should support:
- Touch and drag across keys to play a glissando
- Swipe left on a word to reverse it (antonym)
- Long-press on a color block for detailed info

**How:** Add `touchstart`/`touchmove`/`touchend` handlers to the instrument keyboard. For the glissando, track which key the touch is currently over and play notes as the finger moves.

---

## Implementation Order (Recommended)

| Week | Items | Impact |
|------|-------|--------|
| 1 | A0 (SolresolWord model), A1 (WordRenderer), 6.1 (Event bus) | Foundation for everything |
| 2 | 1.1 (Instrument as home page), 1.2 (Clickable color blocks) | Transforms the first impression from "text encyclopedia" to "musical instrument" |
| 3 | 1.3 (Cross-highlighting), 2.3 (Dynamic antonym reversal) | Makes simultaneity and structure visible |
| 4 | 2.1 (Spatial dictionary), 2.2 (Unified detail pane) | Transforms the dictionary from a table into an explorable space |
| 5 | 3.1 (Composer / executable grammar) | Makes grammar alive |
| 6 | 4.1 (Play-first quiz), 4.2 (Spaced repetition) | Transforms learning from recall to structural understanding |
| 7 | 5.1 (Merge explorer), 5.2 (Interactive reference) | Consolidation and polish |
| 8 | 3.2 (Sequencer), 6.2-6.4 (State, shortcuts, touch) | Advanced features and polish |

---

## Summary: What Changes and What Stays

**Stays:**
- The entire vanilla JS + Vite stack (no frameworks added)
- The audio engine (`synth.js`) — it is well-built with proper ADSR
- The MIDI input system (`midi.js`) — clean event-based architecture
- The dictionary data (`dictionary.json`, 3,152 entries)
- The notation systems (`notation.js`, 7 systems)
- The grammar logic (`grammar.js` `buildSentence()`)
- The dark theme and responsive CSS foundation
- The hash-based routing system in `app.js`

**Changes:**
- The *entry point* changes from text input to instrument (swap DEFAULT_ROUTE, new instrument view)
- The *dictionary* changes from paginated table to spatial map (new spatial renderer, keep list as fallback)
- The *color blocks* change from output-only to interactive (add click handlers in `color-block.js`)
- The *antonyms* change from static list to interactive reversal (animation + any-word reversal tool)
- The *quiz* changes from random recall to structural progression (new quiz modes, progressive unlocking)
- The *grammar* changes from static text to executable composer (new composer view using `buildSentence()`)
- The *word display* changes from scattered function calls to unified `WordRenderer` with cross-highlighting
- The *reference* changes from encyclopedia articles to live demonstrations

**The Core Transformation (Victor):** Every representation of a word becomes simultaneously visible and directly manipulable. You don't *read about* Solresol's seven notation systems in a reference table — you SEE them all updating as you play. You don't *read about* antonym reversal — you DRAG the blocks and hear the meaning flip. You don't *type* to translate — you PLAY and the translation appears.

**The Core Transformation (Kay):** The site stops being a website about Solresol and becomes a medium for Solresol. The dictionary is not a book to look things up in — it is a space to explore. The grammar is not rules to memorize — it is a machine to operate. The quiz is not a test — it is a game that teaches through the structure of the language itself. The seven simultaneous representations are not a feature list — they are the fundamental nature of every word, always present, always linked.
