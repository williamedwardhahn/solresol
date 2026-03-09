# Solresol v4: From Tool to Instrument
## Improvement Plan — Based on Brett Victor & Alan Kay Code Review v3 (2026-03-09)

> **Context:** v3 completed the word predictor, mirror ghost, flip animation,
> onboarding, persistent sentence bar, stress toggles, model mutations, and
> structural analysis. The model layer is sound. But the interface still presents
> seven *views* of one thing instead of one *thing* that is seven views. The
> representations are spatially separated. There is no model of language beyond
> word-level. The rendering has no continuity — every interaction destroys and
> rebuilds the DOM. The views are rooms without hallways.
>
> v4 addresses these structural problems. The goal: you don't *use* the site
> to learn Solresol — you *think* in Solresol through the site.

---

## Phase 0: Fix Structural Defects

Bugs and architectural smells that undermine everything else.

### 0.1 Sequencer AudioContext Leak

**File:** `src/components/sequencer.js:190`

The sequencer creates a new `AudioContext` on every `startPlayback()`. This leaks
contexts (browsers limit to ~6) and bypasses the singleton in `synth.js`.

**Fix:** Import and use `playNote`/`playWord` from `synth.js` instead of manually
creating oscillators. The sequencer's `scheduleAudio()` function duplicates the
entire ADSR envelope logic. Delete it and delegate to the synth.

### 0.2 Canonical Syllable Display

**File:** new `src/utils/format.js`

`capitalize()` is written inline 5+ times across the codebase. Extract:

```js
export function displaySyllable(syl) {
  return syl.charAt(0).toUpperCase() + syl.slice(1);
}
export function displayWord(syllables) {
  return syllables.map(displaySyllable).join('');
}
```

Replace all inline `s.charAt(0).toUpperCase() + s.slice(1)` calls.

### 0.3 Split focusWord Into Two Concerns

**File:** `src/state/focus-word.js`

`focusWord` is simultaneously the keyboard input buffer AND the inspection target.
This means you can't inspect a word while building another.

**Split into:**
- `buildingWord` — the word being constructed note-by-note (keyboard writes here)
- `inspectedWord` — the word shown in the context panel (clicking any word writes here)

`setFocusWord()` → `inspectWord()` (only opens panel, doesn't touch building word)
`commitFocusWord()` → `commitBuildingWord()` (commits from building word)

The global keyboard writes to `buildingWord`. Click-to-focus writes to `inspectedWord`.
These are independent. You can build "DoReMi" while inspecting "FaLa" in the panel.

### 0.4 Declarative Input Routing

**File:** `src/components/global-keyboard.js`

Replace `captureKeyboard`/`releaseKeyboard` (global mutex on a function pointer)
with a priority-based input stack:

```js
const inputStack = []; // [{ id, handler, priority }]

export function pushInputHandler(id, handler, priority = 0) { ... }
export function popInputHandler(id) { ... }
// Keydown dispatches to highest-priority handler
```

Quiz pushes a handler at high priority. When quiz exits, it pops. No global
mutex. Multiple handlers can coexist (e.g., quiz captures 1-7 but Escape still
closes the panel).

### 0.5 Component Lifecycle Guard

**File:** new `src/utils/lifecycle.js`

The pattern `if (renderer) { renderer.destroy(); renderer = null; }` appears
12+ times. It's manual memory management. Create a guard:

```js
export function managed() {
  const refs = [];
  return {
    track(component) { refs.push(component); return component; },
    destroyAll() { refs.forEach(r => r.destroy?.()); refs.length = 0; },
  };
}
```

Each view/component creates a `managed()` scope. Its cleanup function calls
`destroyAll()`. No more manual null-checking.

---

## Phase 1: DOM Continuity

Stop destroying the DOM on every state change. Objects should have visual
persistence — they move, they morph, they don't vanish and reappear.

### 1.1 Incremental Word Renderer

**File:** `src/components/word-renderer.js`

Currently `render()` sets `el.innerHTML = ''` and rebuilds everything. Instead:

- On first render, build the DOM once and keep references to mutable elements
- On `word.onChange()`, diff against previous state:
  - Syllable added → animate new column sliding in from right
  - Syllable removed → animate column sliding out
  - Syllable changed → cross-fade color, update notation text
  - Stress changed → animate ring appearance/movement
- Sheet music SVG updates individual note elements, not full rebuild
- Definition text cross-fades

**Key principle:** The DOM elements for syllable columns are persistent objects.
They are created, they change, they are removed — but they are never bulk-destroyed
and recreated.

### 1.2 Persistent Building Area

**File:** `src/components/global-keyboard.js`

`renderBuilding()` currently destroys and recreates the word renderer AND word
predictor on every `focusWord.onChange`. Instead:

- Create the word renderer and predictor once
- Set them to `reactive: true` so they self-update
- Only recreate when transitioning between empty/non-empty states

### 1.3 Context Panel Morphing

**File:** `src/components/context-panel.js`

`showWord()` currently clears the panel content and rebuilds. Instead:

- Keep the renderer alive, call `displayWord.set(newSyllables)`
- The reactive renderer handles the visual update
- Category, antonym, actions sections update in place via DOM references
- History chips append/remove, not rebuild
- Switching between words feels like the panel *changes* rather than *reloads*

### 1.4 View Transitions

**File:** `src/app.js`, CSS

When navigating between views:
- Outgoing view fades/slides out (CSS `opacity` + `transform`)
- Incoming view fades/slides in
- Use `View Transitions API` where supported, CSS fallback otherwise
- The keyboard, sentence bar, and context panel never participate in transitions
  (they're persistent)

---

## Phase 2: Unified Representations

Seven views of one thing → one thing that is seven views.

### 2.1 Column-as-Object

**File:** `src/components/word-renderer.js`

Each syllable column should be a single interactive object, not a stack of
independent DOM elements:

```
┌─────────┐
│  [Red]   │  ← color block (click = play, drag = reorder)
│   Do     │  ← solfege label
│    1     │  ← number
│   001    │  ← binary
│    ⠁     │  ← braille
│    ♩     │  ← note head (integrated, not separate SVG)
└─────────┘
```

The column is one `<div>` with one click handler, one drag handler, one hover
state. Cross-highlighting already exists but currently queries by `data-syl-index`
across disconnected elements. With column-as-object, highlighting is just adding
a class to the column container.

The staff is not a separate SVG below — the note head lives inside the column,
and a background SVG draws the connecting staff lines across all columns.

### 2.2 Editable Columns

**File:** `src/components/word-renderer.js`

Add `editable: true` option:

- **Drag to reorder:** `pointerdown` on color block starts drag. Drop between
  columns to `insertAt`/`removeAt`+`insertAt`. Drop outside to `removeAt`.
  Uses the existing mutation API on `SolresolWord`.

- **Click notation to cycle:** Click number cell → increment 1→2→...→7→1,
  which changes the syllable at that position. Click solfege → inline edit.
  All mutations go through `word.syllables[i] = newSyl; word._notify()` or
  a new `replaceAt(i, syl)` method.

- **Drag note on staff:** Drag note head up/down to change pitch. Map Y
  position to syllable via `NOTE_POS` mapping.

### 2.3 Paint-to-Play Color Input

**File:** new `src/components/color-input.js`

A row of 7 color wells. Click a well, then click cells in a grid to paint that
color. Each painted cell becomes a syllable. The word forms as you paint, the
sound plays. An alternate input mode mounted in the Play view.

This makes color not just a display — it's a composition tool.

---

## Phase 3: Language Model

The system has a word model but no language model. Sentences are arrays of
words. Grammar is a slot-filler. Fix this.

### 3.1 Sentence Object

**File:** new `src/models/sentence.js`

```js
export class SolresolSentence {
  constructor() {
    this.words = [];      // SolresolWord[]
    this._listeners = new Set();
  }

  // Structure
  get subject() { ... }     // first noun-role word
  get verb() { ... }        // first verb-role word
  get isQuestion() { ... }  // ends with Sol particle
  get isNegated() { ... }   // has Do particle before verb
  get tense() { ... }       // detected from tense marker presence

  // Mutations
  addWord(word) { ... }
  removeWord(index) { ... }
  moveWord(from, to) { ... }
  setTense(tenseKey) { ... }  // insert/replace tense marker
  negate() { ... }            // insert/remove Do particle
  askQuestion() { ... }       // append/remove Sol

  // Translation
  get translation() { ... }   // English gloss with grammar awareness
  get grammaticalAnalysis() { ... }  // role assignment for each word

  // Observable
  onChange(fn) { ... }

  // Persistence
  toJSON() { ... }
  static fromJSON(data) { ... }
}
```

Replace `committedWords` array with a `SolresolSentence` instance. The sentence
bar renders from this object. The compose mode manipulates this object directly
instead of slot-filling a function.

### 3.2 Grammar as Computation

**File:** `src/utils/grammar.js`

Extend beyond `buildSentence()` (which just concatenates strings):

```js
// Analyze a sequence of words for grammatical structure
export function analyzeGrammar(words) {
  return {
    roles: assignRoles(words),       // [{word, role: 'subject'|'verb'|...}]
    tense: detectTense(words),       // detected tense marker
    isValid: checkWordOrder(words),  // basic word order validation
    suggestions: suggestNext(words), // what grammatical role is missing?
  };
}

// Given partial sentence, what should come next?
export function suggestNext(words) {
  // Word order: subject → directObj → adj → tense → verb → adv → indirectObj
  // Returns: ['verb', 'adjective'] — roles not yet filled
}

// Stress-aware audio parameters
export function stressParams(word) {
  const idx = word.stressIndex;
  return word.syllables.map((syl, i) => ({
    syllable: syl,
    gain: i === idx ? 0.5 : 0.3,
    duration: i === idx ? 0.6 : 0.4,
  }));
}
```

### 3.3 Live Grammar Feedback

**File:** `src/components/sentence-bar.js`

The sentence bar currently shows chips + translation. With the Sentence model:

- Color-code chips by grammatical role (subject = blue outline, verb = green, etc.)
- Show grammar suggestions: "Add a verb" if no verb detected
- Animate word insertion/removal instead of rebuilding chip list
- Drag to reorder words within the sentence
- The translation updates live and is grammar-aware ("I [past] go" not "I dodo go")

---

## Phase 4: The Predictor as Primary Interface

Brett Victor's core critique: the word predictor is the best component but it's
crammed into a tiny bar. The narrowing of possibility space should be the
primary visual.

### 4.1 Expanded Predictor Display

**File:** `src/components/word-predictor.js`, `styles/components.css`

When the keyboard is focused (user is actively building):

- The predictor expands to fill the main content area (not just the keyboard bar)
- Branches shown as a radial or tree layout, not a vertical text list
- Each branch shows color pip + syllable + word count + sample definitions (already exists)
- Animate branch expansion/contraction as syllables are added/removed
- The "meaning landscape" IS the primary workspace during word-building

When a word is committed, the predictor contracts back to the keyboard bar
and the main content returns.

### 4.2 Predictor ↔ Sunburst Fusion

**File:** `src/components/word-predictor.js`, `src/components/sunburst.js`

The predictor and sunburst show the same data (the tree of all words) in
different forms. Connect them:

- When the sunburst is visible, playing notes highlights the corresponding
  path through the sunburst arcs
- Clicking a sunburst arc adds that syllable to the building word
- The predictor and sunburst are two projections of the same trie

### 4.3 Dead-End Creativity

**File:** `src/components/word-predictor.js`

When the user reaches a dead end (no dictionary words continue from the current
prefix), don't just show "No dictionary words continue." Instead:

- Show the structural analysis: "This 4-syllable Fa-family word would be in
  the Core Vocabulary class"
- Show what the antonym would be (reversed syllables) and whether IT is defined
- Invite: "This word doesn't exist yet. What should it mean?"
- Store user-proposed definitions in `localStorage` for personal vocabulary

---

## Phase 5: Discovery-Based Learning

The quiz should emerge from use, not from a separate "Learn" tab.

### 5.1 Fix Onboarding

**File:** `src/components/onboarding.js`

Current onboarding plays DoReMi for the user. The user watches, not discovers.

**Change step 1:** Don't auto-play. Instead, prompt: "Press any three keys."
The user plays something random. THEN reveal: "You just played [word]. It
means [definition]." Or if undefined: "That combination doesn't have a meaning
yet — but [nearby word] does."

The "aha" comes from the user's OWN notes having meaning, not from watching
a demonstration.

### 5.2 Contextual Micro-Quizzes

**File:** new `src/components/micro-quiz.js`

Instead of a separate quiz view, embed tiny quiz moments in normal use:

- After playing a word 3 times, briefly flash: "Quick — what does [antonym] mean?"
- After inspecting a category, ask: "Which of these belongs to the same family?"
- After committing a sentence, ask: "What tense is this?"
- After the sunburst, ask: "Which sector has the most words?"

These are 5-second interruptions, not full quiz sessions. They appear as
toast-style overlays. Correct = brief confirmation. Wrong = brief correction.
Always dismissable.

### 5.3 Spaced Repetition Engine

**File:** new `src/utils/srs.js`

Track what the user has encountered and how well they know it:

```js
const SRS_KEY = 'solresol:srs';

export function recordEncounter(wordText, context) { ... }
export function recordQuizResult(concept, correct) { ... }
export function getWeakConcepts() { ... }    // least-mastered areas
export function getStaleWords() { ... }      // words not seen recently
export function shouldQuiz() { ... }         // time for a micro-quiz?
export function getNextQuizItem() { ... }    // what to quiz on
```

Concepts tracked: note recognition, category membership, reversal, stress→POS,
tense markers, word order. Per-word familiarity tracked by encounter count
and quiz performance.

### 5.4 Progressive Quiz Overhaul

**File:** `src/views/learn.js`

Replace the 5 random-choice quiz modes with progressive discovery levels:

1. **Ear Training** — keep as-is, works well
2. **Pattern Discovery** — play 3 words sharing a trait, ask "what's common?"
   (replaces category quiz that just tells you the answer)
3. **Symmetry Discovery** — play word + antonym, ask "what happened?"
   (replaces antonym quiz)
4. **Grammar Discovery** — same word with different stress, ask "what changed?"
   (new — makes stress rules experiential)
5. **Composition** — "Express this idea" with open-ended input, multiple valid answers
   (replaces translation quiz)

Progression unlocks: Level 2 requires 10 correct in Level 1, etc.
SRS engine feeds words into each level.

---

## Phase 6: Connective Tissue

The views are rooms without hallways. Create the hallways.

### 6.1 Universal Word Actions

**File:** `src/components/context-panel.js`

Every word, everywhere, when focused in the context panel, gets:

- **Dictionary** — navigate to dictionary filtered to this word (exists)
- **Sunburst** — zoom sunburst to this word's sector (exists)
- **Add to Sentence** — append to current sentence (new)
- **Add to Sequencer** — append to sequencer timeline (new)
- **Quiz Me** — start a micro-quiz about this word (new)
- **Star** — add to personal vocabulary (new)
- **Share** — export word card as PNG (exists)

### 6.2 Cross-View Recording

**File:** `src/components/sequencer.js`

Move recording listener from `play.js` to the sequencer itself. When recording,
`word:commit` events from ANY view add to the sequence. Clicking a dictionary
entry while recording adds it. The sequencer becomes a cross-view clipboard.

### 6.3 Sentence Persistence & Management

**File:** `src/state/focus-word.js` → refactored with `src/models/sentence.js`

- Multiple saved sentences (not just current)
- Save/load from localStorage under `solresol:sentences`
- UI: "Save Sentence", "Load Sentence", "New Sentence" in sentence bar
- Export as JSON, sharable

### 6.4 Personal Vocabulary

**File:** new `src/state/vocabulary.js`

- Star words from context panel → saved to `solresol:starred`
- Personal vocab filterable in dictionary view
- SRS engine prioritizes starred words
- For undefined words, save user-proposed definitions

---

## Phase 7: Audio as First-Class Medium

### 7.1 Stress in Audio

**File:** `src/audio/synth.js`

When playing a word with a stress position set, the stressed syllable should
be louder (gain 0.5 vs 0.3) and slightly longer (duration * 1.3). Use
`stressParams()` from Phase 3.2. The stress isn't just visual — you hear it.

### 7.2 Reverb & Space

**File:** `src/audio/synth.js`

Add a convolution reverb node to the audio chain (small room impulse response).
Makes the sounds feel like an instrument, not a test tone generator. Optional,
togglable from the waveform selector area.

### 7.3 Sequencer Uses Synth Module

**File:** `src/components/sequencer.js`

Delete `scheduleAudio()` and its manual oscillator creation. Use `playWord()`
and `playSentence()` from `synth.js` with `startTime` offsets. Single audio
context, single envelope shape, consistent sound.

---

## Phase 8: Polish

### 8.1 Dictionary Search via Trie

**File:** `src/utils/solresol.js`, `src/components/word-predictor.js`

The trie already exists in the predictor. Export it and use for `searchDictionary()`
prefix matching (currently O(n) filter). Keep substring fallback for English
definition search.

### 8.2 Swipe Gestures

**File:** `src/components/word-renderer.js`

- Swipe left on any word renderer → reverse (antonym flip)
- Swipe right → play the word
- Touch-friendly alternative to buttons

### 8.3 Accessibility Audit

- Add `aria-live="polite"` to predictor status line, sentence bar translation
- Ensure all interactive elements have focus styles
- Screen reader: announce syllable played, word committed, definition shown
- Keyboard navigation through predictor branches (arrow keys)

---

## Implementation Order

| Order | Phase | What | Why |
|-------|-------|------|-----|
| **1** | 0.1 | Fix sequencer AudioContext leak | Bug, 10 min fix |
| **2** | 0.2 | Extract capitalize/displaySyllable | Tech debt, 15 min |
| **3** | 0.5 | Component lifecycle guard | Prevents leaks during later work |
| **4** | 0.3 | Split focusWord → buildingWord + inspectedWord | Unblocks Phase 1.3, 2.2, 4.1 |
| **5** | 1.1 | Incremental word renderer | Foundation for all visual continuity |
| **6** | 1.2 | Persistent building area | Stops re-creating predictor every keystroke |
| **7** | 2.1 | Column-as-object | Unifies representations physically |
| **8** | 3.1 | Sentence object | Foundation for grammar features |
| **9** | 3.2 | Grammar as computation | Powers sentence bar and compose mode |
| **10** | 3.3 | Live grammar feedback in sentence bar | First visible payoff of sentence model |
| **11** | 4.1 | Expanded predictor display | Highest-impact UX change |
| **12** | 5.1 | Fix onboarding (user discovers, not watches) | Entry point fix |
| **13** | 0.4 | Declarative input routing | Needed before quiz overhaul |
| **14** | 5.2-5.4 | Micro-quizzes, SRS, progressive quiz | Learning system overhaul |
| **15** | 6.1-6.4 | Universal actions, cross-view recording, persistence | Connective tissue |
| **16** | 2.2-2.3 | Editable columns, color input | Direct manipulation |
| **17** | 7.1-7.3 | Audio improvements | Polish |
| **18** | 1.3-1.4 | Context panel morphing, view transitions | Visual polish |
| **19** | 4.2-4.3 | Predictor-sunburst fusion, dead-end creativity | Advanced features |
| **20** | 8.1-8.3 | Trie search, swipe, accessibility | Final polish |

---

## What Stays (v3 Strengths)

- Vanilla JS + Vite, zero runtime dependencies
- `SolresolWord` observable model with mutations
- Event bus (14-line `events.js`)
- Web Audio ADSR synth + Web MIDI input
- 4-view architecture (Play, Dictionary, Translate, Learn)
- Sunburst, sequencer, word predictor, context panel
- Onboarding flow (revised, not replaced)
- Dark theme, responsive CSS
- Dictionary data (3,152 entries)
- Trie-based prediction
- Mirror ghost + flip animation
- Persistent sentence bar with localStorage

## What Changes (v3 → v4)

| v3 | v4 |
|----|-----|
| `focusWord` = input buffer + inspection target | `buildingWord` + `inspectedWord` (independent) |
| `captureKeyboard` / `releaseKeyboard` mutex | Priority-based input handler stack |
| `innerHTML = ''` + full rebuild on every change | Incremental DOM updates, persistent elements |
| Manual `destroy()` / null-check pattern x12 | `managed()` lifecycle scope, automatic cleanup |
| `committedWords` = plain array | `SolresolSentence` object with grammar awareness |
| `buildSentence()` = string concatenation | Grammar computation: role detection, suggestions, validation |
| Representations in separate rows (7 views of 1 thing) | Column-as-object (1 thing that is 7 views) |
| Predictor in tiny keyboard bar | Predictor expands to fill main area during word-building |
| Sequencer creates own AudioContext | Sequencer uses shared synth module |
| capitalize() inline x5 | `displaySyllable()` canonical utility |
| Quiz: 5 random-choice modes | Progressive discovery + micro-quizzes + spaced repetition |
| Onboarding: watch DoReMi play | Onboarding: play your own notes, discover they have meaning |
| Views are isolated rooms | Universal word actions, cross-view recording, deep links |
| No personal vocabulary | Star words, propose definitions, SRS-driven review |
| Audio: flat gain for all syllables | Stress-aware gain + duration, optional reverb |
| Sentence bar: display-only chips | Draggable, grammar-colored, role-labeled, manageable |

---

## The North Star

**Victor:** "I should not be able to tell where the color block ends and the
sound begins. The column IS the syllable — it is simultaneously red, Do, 261 Hz,
001, and ⠁. When I drag it, all of those change. When I hear it, all of those
light up."

**Kay:** "A `SolresolSentence` should be as real as a `SolresolWord`. It should
know its own grammar, suggest what's missing, validate its structure, and persist
across sessions. The site should remember what you've learned and teach you what
you haven't — not through a quiz tab, but through the texture of everyday use."
