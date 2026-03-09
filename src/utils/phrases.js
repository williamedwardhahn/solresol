/**
 * Solresol phrase book — common phrases with full and condensed forms.
 */

export const PHRASE_CATEGORIES = [
  {
    label: 'Greetings',
    phrases: [
      { solresol: 'Simi', condensed: 'Ti, miu!', english: 'Good morning / Good evening' },
      { solresol: 'Simi Misol', condensed: 'Ti, mou!', english: 'Have a nice day' },
      { solresol: 'Misi', condensed: 'Misi', english: 'Good evening, good night' },
      { solresol: 'Solsi Lare', condensed: 'Tale mar', english: 'Pleased to meet you' },
    ],
  },
  {
    label: 'Essential',
    phrases: [
      { solresol: 'Si', condensed: 'Iu', english: 'Yes' },
      { solresol: 'Do', condensed: 'O', english: 'No' },
      { solresol: 'Solsi', condensed: 'Siu', english: 'Thank you' },
      { solresol: 'Sollami', condensed: 'Mar', english: 'Please' },
      { solresol: 'Sollado', condensed: 'Raut', english: 'Sorry / Excuse me' },
    ],
  },
  {
    label: 'Questions',
    phrases: [
      { solresol: 'Dosol Misol Sol', condensed: 'Dis ou?', english: 'How are you?' },
      { solresol: 'Dosol Misol', condensed: 'Dis ro', english: "I'm doing well" },
      { solresol: 'Remifa Dore Sol', condensed: 'Riuse ou?', english: "What's your name?" },
      { solresol: 'Fado Sol', condensed: 'Fado sol?', english: 'What? What is this?' },
      { solresol: 'Fasol Sol', condensed: 'Fasol sol?', english: 'Why? What for?' },
      { solresol: 'Sido Sol', condensed: 'Sido sol?', english: 'How?' },
    ],
  },
  {
    label: 'Communication',
    phrases: [
      { solresol: 'Si Lafafa', condensed: 'Iu fauf', english: 'Yes, I understand' },
      { solresol: 'Sollado Do Lafafa', condensed: 'Raut, o fauf', english: "Sorry, I don't understand" },
      { solresol: 'Sollami Solrefa Sifa', condensed: 'Mar, sou rita fiu', english: 'Please speak more slowly' },
      { solresol: 'Lamire Lasi', condensed: 'Sou lir da', english: 'Write it down' },
      { solresol: 'Solresol Dore Sol', condensed: 'Solresol dore sol?', english: 'Do you speak Solresol?' },
    ],
  },
  {
    label: 'Social',
    phrases: [
      { solresol: 'Misol Lare', condensed: 'Mal mou!', english: 'Congratulations!' },
      { solresol: 'Misisol Sire', condensed: 'Mouti siur!', english: 'Happy Anniversary!' },
      { solresol: 'Fala', condensed: 'Fala', english: 'Good, tasty, delicious' },
      { solresol: 'Lafa', condensed: 'Lafa', english: 'Bad' },
      { solresol: 'Solla', condensed: 'Solla', english: 'Always' },
      { solresol: 'Lasol', condensed: 'Lasol', english: 'Never' },
    ],
  },
];

/** Flat list of all phrases */
export function getAllPhrases() {
  return PHRASE_CATEGORIES.flatMap(cat =>
    cat.phrases.map(p => ({ ...p, category: cat.label }))
  );
}
