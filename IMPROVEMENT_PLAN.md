# Solresol v3: From Application to Medium
## Improvement Plan — Based on Brett Victor & Alan Kay Code Review (2026-03-09)

> **Context:** v2 completed the architectural unification (SolresolWord model, WordRenderer,
> event bus, 4 views, sequencer, sunburst, composer, quiz modes). The foundation is solid.
> v3 addresses the deeper critiques: the site is still a *reference tool about* Solresol,
> not a *medium for thinking in* Solresol. Every display should be an input. Every
> representation should be live. The walls between views should dissolve.

---

## Phase 0: Enrich the Core Model

The `SolresolWord` model works but is designed for observation, not manipulation.
The grammar engine is a lookup table, not a computation. Fix both.

### 0.1 Expand SolresolWord Mutation API

**File:** `src/models/word.js`

Add manipulation methods that enable the interactive experiences in later phases:

```js
swap(i, j)         // swap two syllables (drag-to-rearrange)
insertAt(i, syl)   // insert syllable at position (direct editing)
removeAt(i)        // remove syllable at position
reverse()          // in-place reversal (antonym flip)
```

Also add a `stressPosition` property (null, 'last', 'penultimate', 'antepenultimate')
that changes the computed `partOfSpeech` (noun/adjective/verb/adverb). This makes
stress rules *live computed properties*, not reference text.

### 0.2 Make Every Word "Exist"

**File:** `src/models/word.js`, `src/utils/solresol.js`

Change `SolresolWord.exists` from `this.definition !== null` to `this.length > 0`.
Every 1-5 syllable combination IS a Solresol word. Add:

```js
get isDefined()    // has a dictionary entry (current `exists` behavior)
get isStructural() // is a tense marker, particle, or grammar word
get inferredCategory() // computed from first syllable even for undefined words
get inferredPartOfSpeech() // computed from stress + syllable count
```

For undefined words, display category inference and structural analysis instead
of showing nothing. "This word isn't in the historical dictionary, but based on
its structure it would belong to the Mi (Emotions) family."

### 0.3 Active Grammar Engine

**File:** `src/utils/grammar.js`

Add computational functions that *use* the grammar rules, not just store them:

```js
inferPartOfSpeech(word, stressPos)  // stress → part of speech
applySyllableStress(syllables, pos) // returns modified audio params (gain, duration)
suggestRole(word)                   // given a word, what sentence roles could it fill?
analyzeWord(word)                   // full structural analysis: category, possible POS,
                                    // antonym exists?, syllable count class, etc.
```

These power the "meaning landscape" and structural quiz features in later phases.

---

## Phase 1: The Meaning Landscape (Keyboard → Understanding)

The single highest-impact change: as the user plays notes, show them where they
are in the *space of possible meaning*, not just what syllables they've entered.

### 1.1 Predictive Word Fan

**Files:** `src/components/global-keyboard.js` (modify `renderBuilding()`),
new `src/components/word-predictor.js`

Replace the current "color blocks + definition" building display with a **live
word prediction fan**:

- After pressing Do, show all 7 Do- families as colored branches (451 words total)
- After Do-Re, show all DoRe- words (specific entries) narrowing the tree
- After Do-Re-Mi, either show the exact word or "undefined — would be in Re family"
- Each branch shows its category label and word count
- Hovering a branch previews its sound; clicking selects it (auto-completes)

**Implementation:** Build a trie from dictionary entries at init time. On each
syllable push, walk the trie and render immediate children as a fan/list. Use
the sunburst's arc-drawing code (`sunburst.js` `createArc()`) for the visual,
or a simpler vertical list for the building area.

**Data flow:**
```
focusWord.onChange → walk trie → render predictions in gk-building area
```

This transforms the keyboard from "press notes, hope for meaning" to
"navigate through the space of all possible words."

### 1.2 Persistent Keyboard Status Line

**File:** `src/components/global-keyboard.js`

Below the building area, add a status line that always shows:
- Current word's category (from first syllable, computed live)
- Current syllable count class ("2-syl = pronouns/particles")
- Whether the current prefix has any dictionary matches
- If the word is defined: its definition, live-updating

This uses `analyzeWord()` from Phase 0.3.

---

## Phase 2: Bidirectional Representations

Every notation system becomes an input, not just an output.

### 2.1 Editable Word Renderer

**File:** `src/components/word-renderer.js`

Add an `editable: true` option to `createWordRenderer()`:

- **Color blocks become draggable.** Drag to reorder syllables (calls `word.swap()`).
  Drop a block outside to remove it (calls `word.removeAt()`). Drop from the
  keyboard to insert (calls `word.insertAt()`).

- **Notation cells become clickable inputs.** Click a number cell → cycle through
  1-7 to change that syllable. Click a solfege cell → inline edit. Click a
  braille cell → cycle through braille patterns.

- **Sheet music notes become draggable.** Drag a note up/down on the staff to
  change pitch (syllable). The SVG note position maps to syllable via `NOTE_POS`
  in `word-renderer.js` line 253.

All inputs call the corresponding mutation on the `SolresolWord`, which triggers
`_notify()`, which re-renders all other representations. The model is already
observable — this just adds more ways to mutate it.

### 2.2 Draw-to-Play Binary Input

**File:** new `src/components/binary-input.js`

A grid of 3 rows x N columns. Click cells to toggle (binary 001-111 maps to
Do-Si). As you draw a binary pattern, the corresponding syllables appear,
the sound plays, and the word forms. This makes binary notation a *live input
channel* rather than a display curiosity.

Mount it in the Play view as an alternative input mode alongside the keyboard.

### 2.3 Voice Input (Web Speech API)

**File:** new `src/components/voice-input.js`

Use the Web Speech API's `SpeechRecognition` to listen for spoken syllables.
Map recognized words (do/re/mi/fa/sol/la/si) to `focusWord.push()`. Show
a microphone button in the global keyboard actions area.

Graceful fallback: if `SpeechRecognition` is unavailable, hide the button.
This adds a third I/O channel (keyboard, MIDI, voice) toward the goal of
channel-independent interaction.

---

## Phase 3: Omnipresent Antonym Reversal

Reversal is Solresol's deepest structural principle. It should be everywhere,
not buried in a dictionary sub-tab.

### 3.1 Mirror Presence

**File:** `src/components/word-renderer.js`

When a `WordRenderer` displays a word with 2+ syllables, show a **ghost mirror**
beneath it: the reversed syllables at 20% opacity with the antonym definition
(if it exists). This is always visible, always reminding the user of the symmetry.

CSS: `.wr-mirror { opacity: 0.2; transition: opacity 0.3s; }`
On hover: `.word-renderer:hover .wr-mirror { opacity: 0.6; }`

### 3.2 Flip Animation

**File:** `src/components/word-renderer.js`

The existing Reverse button (line 206-220) currently just calls `word.set(reversed)`.
Replace with an animation:

1. Color blocks slide to their reversed positions (CSS transitions on `order` or
   `transform: translateX(...)`)
2. During the slide, play the reversed sequence
3. Definition cross-fades from original to antonym
4. Mirror ghost swaps to show the original word

The `SolresolWord.reverse()` (new in-place method from 0.1) triggers the animation
via the existing `onChange` subscription.

### 3.3 Swipe-to-Reverse on Mobile

**File:** `src/components/word-renderer.js`

Add touch handlers: swipe left on any WordRenderer to reverse the word. The same
flip animation plays. This makes the structural principle a physical gesture.

---

## Phase 4: Dissolve the Views

The dictionary, sunburst, sequencer, and keyboard should be aspects of one
experience, not four tabs.

### 4.1 Unified Canvas Layout

**File:** `src/app.js`, `index.html`, new `src/layouts/unified.js`

Replace the 4-tab navigation with a **workspace layout**:

```
+------------------------------------------+
| Header                                   |
+------------------------------------------+
| [Global Keyboard with predictor]         |
+------------------+-----------------------+
|                  |                       |
|   Main Panel     |   Context Panel       |
|   (active view)  |   (word details)      |
|                  |                       |
+------------------+-----------------------+
| [Sentence Bar — committed words always visible] |
+------------------------------------------+
```

Key changes:
- **Sentence bar** at the bottom always shows committed words (currently only
  visible in Play view's free mode). Any word played from any view adds to it.
- **Context panel** stays as-is (already works globally).
- **Main panel** still routes between views, but the keyboard + sentence bar
  persist across all of them.
- Navigation becomes icons in the header, not a separate nav bar.

### 4.2 Sunburst as Keyboard Visualization

**File:** `src/components/sunburst.js`, `src/components/global-keyboard.js`

When the user plays notes on the keyboard, highlight the corresponding path
in the sunburst (if visible). After Do, the Do sector lights up. After Do-Re,
the DoRe sub-sector lights up. This connects the act of playing to the spatial
structure of the vocabulary.

**Implementation:** Emit `syllable:play` events (already exists at
`global-keyboard.js` line 182). The sunburst listens and highlights the
matching arc by adding a `.sunburst-arc--active` class.

### 4.3 Sequencer Records from Anywhere

**File:** `src/components/sequencer.js`, `src/state/focus-word.js`

The sequencer already has `addWord()` and `isRecording()`, and the play view
already auto-adds committed words during recording (`play.js` line 169-171).
Extend this: when the sequencer is recording, committed words from ANY view
(dictionary click, translate result, quiz answer) add to the sequence.

**Implementation:** Move the recording listener from `play.js` to `sequencer.js`
itself — have it listen globally for `word:commit` events via the event bus.

### 4.4 Deep Links Between Views

**Files:** All views

Every word displayed anywhere should be a portal to every other view:

- Click a word in the dictionary → opens in context panel (already works)
- Context panel "Find in Dictionary" → navigates to dictionary with search (already works)
- Context panel "Show on Sunburst" → navigates to sunburst zoomed to that word's sector (NEW)
- Context panel "Add to Sequencer" → adds word to sequencer timeline (NEW)
- Context panel "Quiz Me" → switches to Learn view with that word as the quiz target (NEW)
- Sunburst click → opens context panel (already works)

These are small additions to `context-panel.js` — new buttons that emit
navigation events.

---

## Phase 5: Discovery-First Learning

### 5.1 Guided First Experience

**File:** new `src/components/onboarding.js`, modify `src/app.js`

On first visit (check `localStorage` for `solresol:onboarded`), replace the
Play view with a guided sequence:

1. **"Hear this melody"** — play DoReMi automatically. Show colored blocks appearing
   one by one as each note sounds. Pause.
2. **"That was a word"** — reveal the definition. "DoReMi" means something.
3. **"Now you play"** — highlight the keyboard. Prompt: "Press 1, 2, 3."
4. **"Every combination is a word"** — let them play freely, showing definitions
   as they form words.
5. **"Colors ARE sounds ARE numbers"** — show the same word in all 7 notations.
6. **"Reverse it"** — show the antonym flip. "Now press 3, 2, 1."
7. **"You're speaking Solresol"** — transition to normal Play view.

Total: ~60 seconds. Skippable. Sets the tone: this is a *medium*, not a reference.

### 5.2 Structural Quiz Redesign

**File:** `src/views/learn.js`

Replace the five separate quiz modes with a **progressive discovery** system:

**Level 1: Ear Training** (existing, keep as-is)
- Hear note → identify by color/name

**Level 2: Pattern Discovery** (NEW — replaces category quiz)
- Play 3 words that start with Mi. Ask: "What do these have in common?"
- Show categories only AFTER the user guesses
- The system doesn't TELL you "first syllable = category" — you DISCOVER it

**Level 3: Symmetry Discovery** (NEW — replaces antonym quiz)
- Play FaLa (good). Play LaFa (bad). Ask: "What happened?"
- Let user reverse 3 more words and observe the meaning changes
- The reversal principle is DISCOVERED, not stated

**Level 4: Grammar Discovery** (NEW)
- Play the same word with different stress. Ask: "What changed?"
- Show the word used as noun, then adjective, then verb
- Stress rules are EXPERIENCED, not memorized

**Level 5: Composition Challenge** (NEW — replaces translation quiz)
- "Express this idea in Solresol" — open-ended, uses composer
- Multiple valid answers accepted (check via reverse-translate)
- Score based on whether the result translates back correctly

### 5.3 Spaced Repetition with Structure Awareness

**File:** `src/utils/quiz-engine.js` (new)

Track per-concept mastery, not per-word:
```js
{
  concepts: {
    'note-recognition': { correct: N, total: N, lastSeen },
    'category-do': { ... },  // per-category mastery
    'category-mi': { ... },
    'reversal': { ... },
    'stress-rules': { ... },
    'composition': { ... }
  },
  words: {
    'Dore': { correct: N, total: N, lastSeen },
    ...
  }
}
```

Preferentially quiz weak concepts and unfamiliar words. Store in `localStorage`.

---

## Phase 6: Persistence — A Medium Remembers

### 6.1 Save/Load Compositions

**File:** `src/state/focus-word.js`, `src/components/sequencer.js`

- Save committed sentences to `localStorage` under `solresol:compositions`
- Save sequencer timelines under `solresol:sequences`
- UI: "Save" and "Load" buttons in both Play and Sequencer views
- Export: JSON format, importable via paste/file

### 6.2 Personal Vocabulary

**File:** new `src/state/vocabulary.js`

- Let users "star" words → saved to `solresol:vocabulary`
- Add a star button to the context panel
- Personal vocab appears as a filterable set in dictionary
- Quiz preferentially uses starred words
- For undefined words (not in dictionary), let users propose definitions
  stored locally

### 6.3 Session Continuity

**File:** `src/state/focus-word.js`

- Save `committedWords` to `localStorage` on every commit
- Restore on page load
- The sentence bar survives page refresh and navigation
- Add "New Sentence" button to explicitly clear

---

## Phase 7: Polish & Performance

### 7.1 Animated Transitions

**Files:** CSS + view render functions

- View transitions: fade/slide between views instead of hard DOM replacement
- Word commit: current flash animation (play.js line 166) is good, extend to
  all contexts
- Context panel: word morphs when switching between words instead of full rebuild
  (modify `showWord()` in context-panel.js to diff and transition)

### 7.2 Sunburst Performance

**File:** `src/components/sunburst.js`

- Current: full SVG re-render on zoom (`svg.innerHTML = ''`, line 62)
- New: animate arc transitions using `d` attribute interpolation
- Add spatial continuity: zooming in/out should feel like camera movement

### 7.3 Audio Improvements

**File:** `src/audio/synth.js`

- Add reverb/delay effects for richer sound
- Stress visualization: louder + longer for stressed syllables (connect to
  `stressPosition` from Phase 0.1)
- Waveform preview: hear a short sample when changing waveform in the keyboard

### 7.4 Delete Legacy Files

**Directory:** `src/views/_archive/`, `legacy/`

Remove the 10 archived views and 21 legacy HTML/CSS files. They served their
purpose during unification. The v3 codebase should be clean.

---

## Implementation Priority

| Priority | Phase | Items | Rationale |
|----------|-------|-------|-----------|
| **P0** | 0.1, 0.2 | Model enrichment | Foundation for everything else |
| **P0** | 1.1 | Predictive word fan | Single highest-impact UX change |
| **P1** | 3.1, 3.2 | Mirror + flip animation | Makes the deepest structural principle visceral |
| **P1** | 5.1 | Guided first experience | Transforms the entry point from confusion to discovery |
| **P1** | 6.3 | Session continuity | Essential for "medium remembers" |
| **P2** | 2.1 | Editable word renderer | Bidirectional representations |
| **P2** | 4.1, 4.4 | Unified layout + deep links | Dissolves walls between views |
| **P2** | 5.2 | Structural quiz redesign | Discovery over memorization |
| **P3** | 0.3 | Active grammar engine | Powers structural quiz + composition |
| **P3** | 2.2, 2.3 | Binary input, voice input | Additional I/O channels |
| **P3** | 4.2, 4.3 | Sunburst-keyboard link, global recording | Cross-view integration |
| **P3** | 6.1, 6.2 | Save/load, personal vocab | Full persistence |
| **P4** | 7.* | Transitions, performance, audio, cleanup | Polish |

---

## What Stays (v2 Strengths)

- Vanilla JS + Vite (no frameworks)
- `SolresolWord` observable model
- `WordRenderer` unified display
- Event bus (`events.js`)
- Web Audio synth with ADSR
- Web MIDI input
- 4-view architecture (refined, not replaced)
- Sunburst visualization
- Sequencer with MIDI export
- Context panel
- Dark theme + responsive CSS
- Dictionary data (3,152 entries)

## What Changes (v2 → v3)

| v2 | v3 |
|----|-----|
| Keyboard shows color blocks while building | Keyboard shows predictive word fan — the meaning landscape |
| 7 notation systems are display-only | Each notation is a live input (click/drag/draw to edit) |
| Antonym reversal in dictionary sub-tab | Mirror ghost on every word, flip animation, swipe-to-reverse |
| 4 separate views with full page navigation | Unified workspace with persistent sentence bar |
| Quiz: stimulus → multiple choice → score | Progressive discovery: observe patterns → form hypotheses → test |
| Landing page: empty Play view | Guided first experience: hear melody → realize it's a word |
| `translate()` returns null for unknown words | Every word "exists" — undefined words get structural analysis |
| Grammar rules described as prose | Grammar rules are active computation: stress changes POS live |
| Compositions vanish on navigation | Sentence bar persists, compositions saveable |
| No personal vocabulary | Star words, propose definitions, spaced repetition by concept |

---

## The Goal (in their words)

**Victor:** "Every representation of a word becomes simultaneously visible and directly
manipulable. You don't read about Solresol — you play it, see it, flip it, hear it change."

**Kay:** "The site stops being a website about Solresol and becomes a medium for Solresol.
The dictionary is a space to explore. The grammar is a machine to operate. The quiz is a
game that teaches through structure. The seven representations are always present, always linked."
