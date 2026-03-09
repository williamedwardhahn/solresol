# Brett Victor & Alan Kay Code Review — v3 (2026-03-09)

## Brett Victor

### Core Insight (Positive)
- `SolresolWord` model is exactly right — a word IS simultaneously color, sound, number, notation, meaning
- Word predictor is the best component — makes language structure visible as you act

### Critiques

**1. Representations are spatially separated, not unified**
- Color blocks, sheet music, braille, binary are in separate rows — seven *views* of one thing instead of one *thing* that is seven views
- Should not be able to tell where color ends and sound begins
- Dragging a note on staff should change color block because they ARE the same object

**2. No direct manipulation**
- `swap()`, `insertAt()`, `removeAt()` exist on model but have no gestural interface
- Can't drag color blocks to reorder syllables
- Can't paint colors and hear them
- Antonym mirror should be spatial, not a ghost div

**3. innerHTML = '' everywhere — no continuity**
- Every render function nukes DOM and rebuilds
- Flip animation calculates positions then destroys DOM after 420ms
- No persistent visual identity for objects across renders

**4. Word predictor buried**
- Branching tree of 3,152 words should be primary visual, not afterthought in tiny bar
- The narrowing of possibility space is the most powerful feedback loop — make it huge

**5. Sequencer creates new AudioContext on every playback**
- `sequencer.js:190` — leaks contexts, treats audio as side effect
- Should play through same instrument the keyboard uses

**6. capitalize() written 5 times**
- Same expression inline everywhere — no canonical "display a syllable"

**7. Onboarding doesn't let user discover meaning**
- Should let user stumble into meaning from own notes, not watch DoReMi animate

---

## Alan Kay

### Positives
- Built without framework, but with coherent component architecture that emerged from domain
- `SolresolWord` is a "well-found object" — identity, state, behavior, observers
- Code is readable, file structure makes sense, new person could understand in afternoon
- 14-line event bus is elegant

### Critiques

**1. No model of language**
- `committedWords` is a plain array, `buildSentence()` concatenates strings
- No Sentence object, no Grammar object, no linguistic structure beyond slot-filling
- Grammar rules documented as HTML paragraphs, not encoded in manipulable model
- Stress toggle mutates disconnected clone — insight goes nowhere

**2. focusWord singleton doing too much**
- Simultaneously: input buffer, inspection target, cross-component highlight
- Can't inspect a word while building another
- `setFocusWord` sets syllables AND opens panel — conflation

**3. captureKeyboard is a global mutex**
- Wrong solution to wrong problem — input routing should be declarative, not captured function pointer

**4. No rendering abstraction**
- Every component does raw DOM construction
- `if (currentRenderer) { currentRenderer.destroy(); currentRenderer = null; }` appears dozen times
- Manual memory management in JS — one forgotten destroy() = listener leak
- System can't verify cleanup happened

**5. Dictionary search is O(n) brute force**
- Trie exists for predictor but `searchDictionary()` and `reverseTranslate()` still filter()
- Missed opportunity for structural reuse

**6. Is this a reference tool or an instrument?**
- Each view is a well-built room with no hallways between them
- No compositional flow from sunburst → composition
- No way to practice phrasebook phrases
- Quiz has no spaced repetition, no progression, no memory of learning
- Sentence bar is just a list of chips — doesn't carry meaning forward

**7. What it should become**
- Word should be draggable, droppable, editable in place
- Sentences should be first-class objects with grammar model
- Sunburst should be background/spatial map for entire app
- Predictor should be primary interface
- Sequencer should record sentences
- Quiz should emerge from actual use, not random multiple-choice
- Build a medium through which people THINK in Solresol, not a tool that teaches it
