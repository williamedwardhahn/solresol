const SRS_KEY = 'solresol:srs';
const BASE_INTERVAL_MS = 4 * 60 * 60 * 1000; // 4 hours
const QUIZ_ENCOUNTER_THRESHOLD = 5;

function load() {
  try {
    const raw = localStorage.getItem(SRS_KEY);
    if (raw) return JSON.parse(raw);
  } catch (_) { /* corrupted or unavailable */ }
  return {
    encounters: {},
    concepts: {},
    quizCount: 0,
    lastQuizTime: 0,
    encountersSinceQuiz: 0,
    streakDays: [],
  };
}

function save(data) {
  try {
    localStorage.setItem(SRS_KEY, JSON.stringify(data));
  } catch (_) { /* storage full or unavailable */ }
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function updateStreak(data) {
  const today = todayStr();
  if (data.streakDays.includes(today)) return;
  data.streakDays.push(today);
  // Trim to last 365 days max
  if (data.streakDays.length > 365) {
    data.streakDays = data.streakDays.slice(-365);
  }
}

function conceptKey(concept) {
  return `${concept.type}:${concept.value}`;
}

// Record that user encountered a word in some context
export function recordEncounter(wordText, context) {
  const data = load();
  const entry = data.encounters[wordText] || { count: 0, lastSeen: 0, contexts: [] };
  entry.count++;
  entry.lastSeen = Date.now();
  if (!entry.contexts.includes(context)) {
    entry.contexts.push(context);
  }
  data.encounters[wordText] = entry;
  data.encountersSinceQuiz++;
  updateStreak(data);
  save(data);
}

// Record quiz result for a concept
export function recordQuizResult(concept, correct) {
  const data = load();
  const key = conceptKey(concept);
  const entry = data.concepts[key] || { correct: 0, incorrect: 0, lastQuizzed: 0, interval: 1 };

  if (correct) {
    entry.correct++;
    entry.interval = Math.min(entry.interval * 2, 64); // cap at 64x base
  } else {
    entry.incorrect++;
    entry.interval = 1;
  }
  entry.lastQuizzed = Date.now();
  data.concepts[key] = entry;
  data.quizCount++;
  data.lastQuizTime = Date.now();
  data.encountersSinceQuiz = 0;
  updateStreak(data);
  save(data);
}

// Get weakest concepts (least mastered)
export function getWeakConcepts(limit = 5) {
  const data = load();
  const entries = Object.entries(data.concepts);
  if (!entries.length) return [];

  return entries
    .map(([key, c]) => {
      const total = c.correct + c.incorrect;
      const accuracy = total > 0 ? c.correct / total : 0;
      return { key, accuracy, interval: c.interval, total };
    })
    .filter(e => e.total > 0)
    .sort((a, b) => a.accuracy - b.accuracy || a.interval - b.interval)
    .slice(0, limit)
    .map(e => {
      const [type, ...rest] = e.key.split(':');
      return { type, value: rest.join(':'), accuracy: e.accuracy, interval: e.interval };
    });
}

// Get words the user hasn't seen recently
export function getStaleWords(limit = 10) {
  const data = load();
  const entries = Object.entries(data.encounters);
  if (!entries.length) return [];

  return entries
    .sort((a, b) => a[1].lastSeen - b[1].lastSeen)
    .slice(0, limit)
    .map(([word, info]) => ({ word, lastSeen: info.lastSeen, count: info.count }));
}

// Should we show a micro-quiz right now?
export function shouldQuiz() {
  const data = load();
  return data.encountersSinceQuiz >= QUIZ_ENCOUNTER_THRESHOLD;
}

// Get the next thing to quiz on, based on SRS scheduling
export function getNextQuizItem() {
  const data = load();
  const now = Date.now();
  const entries = Object.entries(data.concepts);
  if (!entries.length) return null;

  let mostOverdue = null;
  let maxOverdueRatio = 0;

  for (const [key, c] of entries) {
    const elapsed = now - c.lastQuizzed;
    const dueAfter = c.interval * BASE_INTERVAL_MS;
    const ratio = elapsed / dueAfter;
    if (ratio > maxOverdueRatio) {
      maxOverdueRatio = ratio;
      mostOverdue = key;
    }
  }

  if (!mostOverdue || maxOverdueRatio < 1) return null;

  const [type, ...rest] = mostOverdue.split(':');
  const value = rest.join(':');
  const c = data.concepts[mostOverdue];
  return { type, value, interval: c.interval, lastQuizzed: c.lastQuizzed };
}

// Get stats for display
export function getStats() {
  const data = load();
  const encounterEntries = Object.values(data.encounters);
  const totalEncounters = encounterEntries.reduce((sum, e) => sum + e.count, 0);
  const uniqueWords = encounterEntries.length;

  const conceptEntries = Object.values(data.concepts);
  const totalCorrect = conceptEntries.reduce((sum, c) => sum + c.correct, 0);
  const totalAttempts = conceptEntries.reduce((sum, c) => sum + c.correct + c.incorrect, 0);
  const accuracy = totalAttempts > 0 ? totalCorrect / totalAttempts : 0;

  // Calculate consecutive streak ending today
  const days = data.streakDays.slice().sort();
  let streakDays = 0;
  if (days.length) {
    const today = new Date(todayStr());
    let check = today;
    for (let i = days.length - 1; i >= 0; i--) {
      const d = new Date(days[i]);
      if (d.getTime() === check.getTime()) {
        streakDays++;
        check = new Date(check.getTime() - 86400000);
      } else if (d < check) {
        break;
      }
    }
  }

  return {
    totalEncounters,
    uniqueWords,
    quizzesTaken: data.quizCount,
    accuracy: Math.round(accuracy * 100) / 100,
    streakDays,
  };
}
