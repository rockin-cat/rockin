// Content of the guided game ("Juga"). The path goes from the whole to the
// parts and back: read the cards on one note, then learn the WHOLE chord wheel
// with long notes (build every chord from its root, practise each change,
// play the wheel step by step and then with music), and only then add rhythm
// cards, songs and structure. Inversions come at the end, once the chords are
// known from their root.
//
// Mission types:
//   lesson    - slides that explain how to read the cards, each with an example
//   chord     - learn a chord: look, build it by counting semitones, play it
//   change    - from one chord to the next: what each finger does, then practise
//               it; the game waits until it is right
//   steps     - the whole wheel, chord by chord on the score; the game waits
//   pattern   - one card over the wheel (listen, then play)
//   mix       - several cards over the wheel, no help on the keyboard
//   song      - a known song's wheel with a card and a matching style
//   structure - verse and chorus: two wheels in the order of a song
//   band      - the wheel without stopping, a new card each round, as when
//               playing with classmates
//   invert    - build the inversions of a chord
// Missions and worlds with `inversions: true` place each chord as close as
// possible to the previous one.

import { parseChord, parseTimeSignature, splitChord } from './theory.js';
import { playableCards, tierOf } from './cards.js';

const card = (n) => `rhythm_binary_${String(n).padStart(2, '0')}.png`;
const WHEEL = ['C', 'G', 'Am', 'F'];
const mel = (n) => `melodic_${String(n).padStart(2, '0')}.png`;

/**
 * Level 2 (after the path): arpeggios and melodic contour, over `wheel`.
 * Melodic cards: each point is a note of the chord, higher on the card = higher note.
 */
export function levelTwoWorlds({ wheel, idOf = (w, k) => `${w}-${k}`, worldId = (w) => w, style = 'ballad', meter = '4/4' }) {
  // From fewer different notes to more: cards with 2 heights, then 3, and only at the end 4.
  const progression = wheel.join(' | ');
  const common = { progression, chords: [...new Set(wheel)], level: 3, style, meter, level2: true };
  return [
    {
      ...common,
      id: worldId('arpegis'),
      title: 'Nivell 2 · Arpegis',
      goal: 'Tocar la roda amb les notes de cada acord d\'una en una',
      missions: [
        {
          id: idOf('arp', 'lliçó'),
          type: 'lesson',
          title: 'Cartes de línia',
          slides: [
            { card: mel(9), title: 'Cada punt és una nota', text: 'Aquestes cartes no tenen rodones sinó <b>punts units per una línia</b>. Cada punt és una nota de l\'acord, tocada <b>d\'una en una</b>. Aquí només n\'hi ha de dues alçades: <b>dues notes</b> de l\'acord.' },
            { card: mel(7), title: 'Amunt i avall', text: 'Si el punt següent és <b>més amunt</b>, toca una nota <b>més aguda</b> de l\'acord. Si és <b>més avall</b>, més greu.' },
            { card: mel(26), title: 'A la mateixa altura', text: 'Dos punts a la mateixa altura són <b>la mateixa nota</b>.' },
          ],
        },
        { id: idOf('arp', 'notes'), type: 'arpeggio', title: 'La roda nota a nota' },
        { id: idOf('arp', 1), type: 'pattern', title: 'Dues notes: amunt i avall', card: mel(9), help: 'shape' },
        { id: idOf('arp', 2), type: 'pattern', title: 'Dues notes: avall i amunt', card: mel(7), help: 'shape' },
        { id: idOf('arp', 3), type: 'pattern', title: 'Dues notes repetides', card: mel(26), help: 'none' },
        { id: idOf('arp', 4), type: 'pattern', title: 'Tres notes', card: mel(20), help: 'shape' },
        { id: idOf('arp', 'repte'), type: 'mix', title: 'Objectiu: tres cartes', cards: [mel(10), mel(27), mel(23)] },
      ],
    },
    {
      ...common,
      id: worldId('contorn'),
      title: 'Nivell 2 · Contorn melòdic',
      goal: 'Seguir la línia de qualsevol carta melòdica sobre la roda',
      missions: [
        { id: idOf('con', 1), type: 'pattern', title: 'Tres notes avall', card: mel(5), help: 'shape' },
        { id: idOf('con', 2), type: 'pattern', title: 'Tres notes amunt', card: mel(6), help: 'shape' },
        { id: idOf('con', 3), type: 'pattern', title: 'Tres notes que tornen', card: mel(21), help: 'none' },
        { id: idOf('con', 4), type: 'pattern', title: 'Quatre notes amunt', card: mel(14), help: 'shape' },
        { id: idOf('con', 5), type: 'pattern', title: 'Quatre notes avall', card: mel(17), help: 'none' },
        { id: idOf('con', 'repte'), type: 'mix', title: 'Objectiu: tres contorns', cards: [mel(22), mel(13), mel(15)] },
        { id: idOf('con', 'banda'), type: 'band', title: 'Toca amb la banda', cards: [mel(20), mel(14), mel(5), mel(17)] },
      ],
    },
  ];
}

export const WORLDS = [
  {
    id: 'ritme',
    title: 'Llegeix les cartes',
    goal: 'Tocar el Do seguint tres cartes diferents',
    progression: 'C',
    level: 1,
    chords: ['C'],
    style: 'rock',
    missions: [
      {
        id: 'ritme-lliçó',
        type: 'lesson',
        title: 'Com funciona una carta',
        slides: [
          {
            card: card(1),
            title: 'Cada rodona és un temps',
            text: 'Llegeix la carta d\'esquerra a dreta. La pilota bota sobre cada rodona al ritme de la música. <b>Rodona blava = toca.</b>',
          },
          {
            card: card(2),
            title: 'Rodona blanca = silenci',
            text: 'Quan la pilota bota sobre una rodona blanca, <b>no toquis</b>: espera la següent.',
          },
          {
            card: card(6),
            title: 'Barra = nota llarga',
            text: 'Una barra que ocupa diverses rodones és una <b>nota llarga</b>: toca al principi i <b>mantén la tecla</b> fins que s\'acabi.',
          },
        ],
      },
      { id: 'ritme-0', type: 'wait', title: 'El joc t\'espera', cards: [card(1), card(2), card(6)] },
      { id: 'ritme-1', type: 'pattern', title: 'Quatre temps', card: card(1), help: 'shape' },
      { id: 'ritme-2', type: 'pattern', title: 'Un silenci', card: card(2), help: 'shape' },
      { id: 'ritme-3', type: 'pattern', title: 'Una nota llarga', card: card(6), help: 'none' },
      { id: 'ritme-repte', type: 'mix', title: 'Objectiu: tres cartes', cards: [card(7), card(5), card(3)] },
    ],
  },
  {
    id: 'roda',
    title: 'Aprèn la roda',
    goal: 'Tocar Do – Sol – La m – Fa amb notes llargues, sense mirar el teclat',
    progression: 'C | G | Am | F',
    level: 2,
    chords: WHEEL,
    style: 'ballad',
    missions: [
      { id: 'roda-do', type: 'chord', title: 'Construeix el Do', chord: 'C' },
      { id: 'roda-sol', type: 'chord', title: 'Construeix el Sol', chord: 'G' },
      { id: 'roda-do-sol', type: 'change', title: 'Canvi Do → Sol', from: 'C', to: 'G' },
      { id: 'roda-la', type: 'chord', title: 'Construeix el La menor', chord: 'Am' },
      { id: 'roda-sol-la', type: 'change', title: 'Canvi Sol → La m', from: 'G', to: 'Am' },
      { id: 'roda-fa', type: 'chord', title: 'Construeix el Fa', chord: 'F' },
      { id: 'roda-la-fa', type: 'change', title: 'Canvi La m → Fa', from: 'Am', to: 'F' },
      { id: 'roda-fa-do', type: 'change', title: 'Canvi Fa → Do', from: 'F', to: 'C' },
      { id: 'roda-passos', type: 'steps', title: 'La roda pas a pas', chords: WHEEL },
      { id: 'roda-llarga', type: 'pattern', title: 'La roda amb música', card: card(5), help: 'shape' },
      { id: 'roda-repte', type: 'mix', title: 'Objectiu: la roda de memòria', cards: [card(5), card(5)] },
    ],
  },
  {
    id: 'ritme-roda',
    title: 'La roda amb ritme',
    goal: 'Tocar Do – Sol – La m – Fa seguint les cartes: la roda de centenars de cançons',
    progression: 'C | G | Am | F',
    level: 2,
    chords: WHEEL,
    style: 'rock',
    missions: [
      { id: 'rr-1', type: 'pattern', title: 'Un acord a cada temps', card: card(1), help: 'shape' },
      { id: 'rr-2', type: 'pattern', title: 'Nota llarga al mig', card: card(6), help: 'none' },
      { id: 'rr-3', type: 'pattern', title: 'Un silenci', card: card(2), help: 'none' },
      { id: 'rr-repte', type: 'mix', title: 'Objectiu: tres cartes seguides', cards: [card(7), card(3), card(4)] },
      { id: 'rr-banda', type: 'band', title: 'Toca amb la banda', cards: [card(1), card(2), card(6), card(5)] },
    ],
  },
  {
    id: 'cançons',
    title: 'Cançons i estructura',
    goal: 'Els mateixos quatre acords, en un altre ordre, són moltes cançons',
    progression: 'C | G | Am | F',
    level: 2,
    chords: WHEEL,
    style: 'rock',
    missions: [
      { id: 'cançó-1', type: 'song', title: 'La m – Fa – Do – Sol', songs: 'Com a «Despacito» o «Hello» d\'Adele', progression: 'Am | F | C | G', card: card(1), style: 'reggaeton', tempo: 90 },
      { id: 'cançó-2', type: 'song', title: 'Do – La m – Fa – Sol', songs: 'La progressió dels anys 50: «Stand By Me», «Perfect»', progression: 'C | Am | F | G', card: card(5), style: 'ballad', tempo: 66 },
      { id: 'cançó-3', type: 'song', title: 'Fa – Sol – Do – La m', songs: 'Com a «Viva la Vida» de Coldplay', progression: 'F | G | C | Am', card: card(8), style: 'rock', tempo: 80 },
      { id: 'cançó-4', type: 'song', title: 'La m – Sol – Fa – Sol', songs: 'Com a «My Heart Will Go On»', progression: 'Am | G | F | G', card: card(6), style: 'ballad', tempo: 66 },
      { id: 'cançó-5', type: 'song', title: 'Do – Sol – La m – Fa', songs: 'Com a «Poker Face» de Lady Gaga', progression: 'C | G | Am | F', card: card(2), style: 'funk', tempo: 90 },
      {
        id: 'cançó-estructura',
        type: 'structure',
        title: 'Estrofa i tornada',
        songs: 'Moltes cançons alternen una estrofa i una tornada amb rodes diferents',
        sections: [
          { name: 'Estrofa', progression: 'Am | F | C | G', card: card(5) },
          { name: 'Tornada', progression: 'C | G | Am | F', card: card(1) },
        ],
        order: [0, 1, 0, 1],
        style: 'rock',
      },
    ],
  },
  {
    id: 'mitges',
    title: 'Temps partits',
    goal: 'Tocar la roda amb cartes de rodones partides',
    progression: 'C | G | Am | F',
    level: 2,
    chords: WHEEL,
    style: 'rock',
    missions: [
      {
        id: 'mitges-lliçó',
        type: 'lesson',
        title: 'Rodones partides',
        slides: [
          {
            card: card(11),
            title: 'Mitja rodona',
            text: 'Una rodona partida en dues és un temps dividit en dos. Si la primera meitat és blanca, espera i <b>toca a la segona meitat</b>.',
          },
          {
            card: card(13),
            title: 'Dues notes per temps',
            text: 'Si les dues meitats són blaves, toca <b>dues vegades</b> a cada temps. Compta en veu alta: «1 i 2 i 3 i 4 i».',
          },
        ],
      },
      { id: 'mitges-1', type: 'pattern', title: 'Una meitat al final', card: card(11), help: 'shape' },
      { id: 'mitges-2', type: 'pattern', title: 'Dues i dues', card: card(18), help: 'none' },
      { id: 'mitges-repte', type: 'mix', title: 'Objectiu: temps partits', cards: [card(16), card(22), card(13)] },
    ],
  },
  {
    id: 'inversions',
    title: 'Inversions: mou menys la mà',
    goal: 'Tocar la roda amb cada acord a la posició més propera de l\'anterior',
    progression: 'C | G | Am | F',
    level: 2,
    chords: WHEEL,
    style: 'ballad',
    inversions: true,
    missions: [
      { id: 'inv-do', type: 'invert', title: 'Inverteix el Do', chord: 'C' },
      { id: 'inv-la', type: 'invert', title: 'Inverteix el La menor', chord: 'Am' },
      { id: 'inv-do-sol', type: 'change', title: 'Do → Sol, a prop', from: 'C', to: 'G' },
      { id: 'inv-sol-la', type: 'change', title: 'Sol → La m, a prop', from: 'G', to: 'Am' },
      { id: 'inv-la-fa', type: 'change', title: 'La m → Fa, a prop', from: 'Am', to: 'F' },
      { id: 'inv-passos', type: 'steps', title: 'La roda a prop, pas a pas', chords: WHEEL },
      { id: 'inv-1', type: 'pattern', title: 'La roda a prop amb música', card: card(5), help: 'shape' },
      { id: 'inv-banda', type: 'band', title: 'Toca amb la banda', cards: [card(6), card(3), card(7), card(1)] },
    ],
  },
];

WORLDS.push(...levelTwoWorlds({ wheel: WHEEL }));

export const SPEEDS = [
  { id: 'lent', name: 'Lent', tempo: 60 },
  { id: 'normal', name: 'Normal', tempo: 76 },
  { id: 'rapid', name: 'Ràpid', tempo: 96 },
];

for (const world of WORLDS) world.meter ??= '4/4';

/** A path: its worlds and every mission in order, each knowing its world. */
export function makePath({ id, title, worlds, custom = false, key = 'C', spec = null }) {
  const missions = worlds.flatMap((world) => world.missions.map((mission, step) => ({ ...mission, world, step })));
  return { id, title, worlds, missions, custom, key, spec };
}

export const ROCKIN_PATH = makePath({ id: 'rockin', title: 'Camí ROCKIN', worlds: WORLDS, key: 'C' });

// Kept for older imports.
export const ALL_MISSIONS = ROCKIN_PATH.missions;

// ---- Paths made by the teacher -----------------------------------------------------

const hasBeat = (c, value) => c.pattern.some((beat) => beat.includes(value));
const plain = (c) => c.pattern.every((beat) => beat.length === 1 && beat[0] === 1);

/** Without a key, the first chord is home. */
const keyGuess = (symbol) => {
  const { root, suffix } = splitChord(symbol);
  return `${root}${suffix.startsWith('m') && !suffix.startsWith('maj') ? 'm' : ''}`;
};

const SOLFA = { C: 'Do', D: 'Re', E: 'Mi', F: 'Fa', G: 'Sol', A: 'La', B: 'Si' };
const noteName = (n) => `${SOLFA[n[0]]}${n.slice(1).replace('#', '♯').replace('b', '♭')}`;

const LETTERS = 'CDEFGAB';
const LETTER_PCS = [0, 2, 4, 5, 7, 9, 11];

/** Catalan names of a triad's notes spelled from its letters: E → Mi, Sol♯, Si. */
export function triadNoteNames(symbol) {
  const { root } = splitChord(symbol);
  const chord = parseChord(symbol);
  const start = LETTERS.indexOf(root[0]);
  return chord.triad.map((pc, k) => {
    const letter = (start + k * 2) % 7;
    let shift = (((pc - LETTER_PCS[letter]) % 12) + 18) % 12 - 6;
    const accidental = shift > 0 ? '♯'.repeat(shift) : '♭'.repeat(-shift);
    return `${SOLFA[LETTERS[letter]]}${accidental}`;
  });
}

/** Short Catalan chord name, spelled as written: "Do", "La m", "La♭", "Sol7", "Do/Mi". */
export function chordName(symbol) {
  const { root, suffix, bass } = splitChord(symbol);
  const quality = suffix === '' ? '' : suffix === 'm' ? ' m' : suffix;
  return `${noteName(root)}${quality}${bass ? `/${noteName(bass)}` : ''}`;
}

/** Consecutive pairs of different chords in a wheel, including the way back to the start, without repeats. */
export function wheelChanges(bars) {
  const pairs = [];
  bars.forEach((from, i) => {
    const to = bars[(i + 1) % bars.length];
    if (from !== to && !pairs.some((p) => p.from === from && p.to === to)) pairs.push({ from, to });
  });
  return pairs;
}

/**
 * Builds a path with the same sequence as the ROCKIN one for any chord wheel
 * and meter: (optionally) read the cards, learn the whole wheel with long notes,
 * the wheel with rhythm cards, the song (with its chorus, if there is one) and
 * the wheel with inversions.
 *
 * spec: { id, name, progression: 'Am | F | C | G', chorus?: 'C | G | Am | F',
 *         meter: '4/4', style, tempo, readCards?: boolean }
 */
export function buildPath(spec, allCards) {
  const meter = parseTimeSignature(spec.meter);
  const pool = playableCards(allCards, { cardType: 'rhythmic', meter });
  const easy = pool.filter((c) => tierOf(c) === 'easy');
  const medium = pool.filter((c) => tierOf(c) === 'medium');
  const base = easy.length >= 3 ? easy : pool;
  if (!base.length) throw new Error(`No hi ha cartes per al compàs ${spec.meter}`);
  const pick = (test, avoid = []) => base.find((c) => test(c) && !avoid.includes(c)) ?? base.find((c) => !avoid.includes(c)) ?? base[0];
  const e1 = pick(plain);
  const e2 = pick((c) => hasBeat(c, 0), [e1]);
  const e3 = pick((c) => hasBeat(c, 2), [e1, e2]);
  const rest = base.filter((c) => ![e1, e2, e3].includes(c));
  const e4 = rest[0] ?? e2;
  const hard = medium.length >= 3 ? medium.slice(0, 3) : [e4, e3, e2];
  const whole = pool.find((c) => c.pattern.length === meter.pulses && c.pattern.every((beat, i) => beat.length === 1 && beat[0] === (i === 0 ? 1 : 2))) ?? e1;
  const name = (c) => c.filename;

  const split = (text) => (text ?? '').split('|').map((s) => s.trim()).filter(Boolean);
  const bars = split(spec.progression);
  const chorus = split(spec.chorus);
  if (!bars.length) throw new Error('Escriu almenys un acord');
  // Songs of the book: every part of the song, in order.
  const parts = spec.parts ? Object.entries(spec.parts).map(([partName, text]) => ({ name: partName, bars: split(text) })) : [];
  const chords = [...new Set(bars)];
  const partChords = [...new Set(parts.flatMap((p) => p.bars))].filter((c) => !chords.includes(c) && !chorus.includes(c));
  const chorusChords = [...new Set(chorus)].filter((c) => !chords.includes(c));
  [...chords, ...chorusChords, ...partChords].forEach((symbol) => parseChord(symbol)); // validates
  const root = splitChord(chords[0]).root;
  const wheel = bars.join(' | ');
  const wheelText = bars.map(chordName).join(' – ');
  const common = { meter: spec.meter, style: spec.style, level: 2, progression: wheel, chords };
  const worlds = [];
  const id = (w, k) => `${spec.id}:${w}:${k}`;

  if (spec.readCards) {
    worlds.push({
      ...common,
      id: `${spec.id}:ritme`,
      title: 'Llegeix les cartes',
      goal: `Tocar la nota ${noteName(root)} seguint tres cartes`,
      progression: chords[0],
      level: 1,
      chords: [chords[0]],
      missions: [
        {
          id: id('r', 0),
          type: 'lesson',
          title: 'Com funciona una carta',
          slides: [
            { card: name(e1), title: 'Cada rodona és un temps', text: 'Llegeix la carta d\'esquerra a dreta. La pilota bota sobre cada rodona al ritme de la música. <b>Rodona blava = toca.</b>' },
            hasBeat(e2, 0) ? { card: name(e2), title: 'Rodona blanca = silenci', text: 'Quan la pilota bota sobre una rodona blanca, <b>no toquis</b>: espera la següent.' } : null,
            hasBeat(e3, 2) ? { card: name(e3), title: 'Barra = nota llarga', text: 'Una barra que ocupa diverses rodones és una <b>nota llarga</b>: toca al principi i <b>mantén la tecla</b> fins que s\'acabi.' } : null,
          ].filter(Boolean),
        },
        { id: id('r', 1), type: 'pattern', title: 'Tots els temps', card: name(e1), help: 'shape' },
        { id: id('r', 2), type: 'pattern', title: 'Amb silencis', card: name(e2), help: 'shape' },
        { id: id('r', 3), type: 'mix', title: 'Objectiu: tres cartes', cards: [e3, e4, e2].map(name) },
      ],
    });
  }

  // Learn the wheel: each chord, and each change as soon as both chords are known.
  const learn = [];
  const changes = wheelChanges(bars);
  const added = new Set();
  const learned = new Set();
  chords.forEach((symbol) => {
    learn.push({ id: id('l', `c-${symbol}`), type: 'chord', title: `Construeix ${chordName(symbol)}`, chord: symbol });
    learned.add(symbol);
    for (const pair of changes) {
      const key = `${pair.from}>${pair.to}`;
      if (added.has(key) || !learned.has(pair.from) || !learned.has(pair.to)) continue;
      added.add(key);
      learn.push({ id: id('l', `x-${key}`), type: 'change', title: `Canvi ${chordName(pair.from)} → ${chordName(pair.to)}`, from: pair.from, to: pair.to });
    }
  });
  learn.push(
    { id: id('l', 'steps'), type: 'steps', title: 'La roda pas a pas', chords: bars },
    { id: id('l', 'long'), type: 'pattern', title: 'La roda amb música', card: name(whole), help: 'shape' },
    { id: id('l', 'goal'), type: 'mix', title: 'Objectiu: la roda de memòria', cards: [whole, whole].map(name) },
  );
  worlds.push({
    ...common,
    id: `${spec.id}:roda`,
    title: 'Aprèn la roda',
    goal: `Tocar ${wheelText} amb notes llargues, sense mirar el teclat`,
    missions: learn,
  });

  worlds.push({
    ...common,
    id: `${spec.id}:ritme-roda`,
    title: 'La roda amb ritme',
    goal: `Tocar ${wheelText} seguint les cartes`,
    missions: [
      { id: id('t', 0), type: 'pattern', title: 'Tots els temps', card: name(e1), help: 'shape' },
      { id: id('t', 1), type: 'pattern', title: 'Sense ajuda', card: name(e3), help: 'none' },
      { id: id('t', 2), type: 'pattern', title: 'Amb silencis', card: name(e2), help: 'none' },
      { id: id('t', 3), type: 'mix', title: 'Objectiu: tres cartes seguides', cards: [e4, e2, e3].map(name) },
      { id: id('t', 4), type: 'band', title: 'Toca amb la banda', cards: [e1, e2, e3, e4].map(name) },
    ],
  });

  const song = [
    { id: id('s', 0), type: 'song', title: 'La roda a tempo', songs: spec.name || 'La roda sencera', progression: wheel, card: name(e1), style: spec.style, tempo: spec.tempo },
    { id: id('s', 1), type: 'mix', title: 'Cartes més difícils', cards: hard.map(name) },
  ];
  if (parts.length) {
    // New chords, and the parts with changes that are not in the wheel.
    for (const symbol of partChords) song.push({ id: id('s', `c-${symbol}`), type: 'chord', title: `Construeix ${chordName(symbol)}`, chord: symbol });
    const known = new Set(changes.map((c) => `${c.from}>${c.to}`));
    for (const part of parts) {
      const fresh = [];
      part.bars.forEach((c, k) => {
        const key = k > 0 && part.bars[k - 1] !== c ? `${part.bars[k - 1]}>${c}` : null;
        if (key && !known.has(key)) {
          known.add(key);
          fresh.push({ from: part.bars[k - 1], to: c });
        }
      });
      if (!fresh.length) continue;
      for (const pair of fresh) song.push({ id: id('s', `x-${pair.from}>${pair.to}`), type: 'change', title: `Canvi ${chordName(pair.from)} → ${chordName(pair.to)}`, from: pair.from, to: pair.to });
      // Leave out the full wheels at the start of the part.
      let start = 0;
      while (start + bars.length <= part.bars.length && bars.every((c, j) => part.bars[start + j] === c)) start += bars.length;
      song.push({ id: id('s', `p-${part.name}`), type: 'steps', title: `La part ${part.name} pas a pas`, chords: part.bars.slice(Math.max(0, start - 1)) });
    }
    const names = parts.map((p) => p.name);
    song.push({
      id: id('s', 'structure'),
      type: 'structure',
      title: 'La cançó sencera',
      songs: `${spec.name}${spec.artist ? ` (${spec.artist})` : ''}`,
      sections: parts.map((p, k) => ({ name: p.name, progression: p.bars.join(' | '), card: name(k % 2 ? e1 : whole) })),
      order: spec.order.map((n) => names.indexOf(n)).filter((k) => k >= 0),
      style: spec.style,
      tempo: spec.tempo,
    });
  } else if (chorus.length) {
    for (const symbol of chorusChords) song.push({ id: id('s', `c-${symbol}`), type: 'chord', title: `Construeix ${chordName(symbol)}`, chord: symbol });
    song.push(
      { id: id('s', 'chorus'), type: 'steps', title: 'La tornada pas a pas', chords: chorus },
      {
        id: id('s', 'structure'),
        type: 'structure',
        title: 'Estrofa i tornada',
        songs: spec.name || 'La cançó sencera',
        sections: [
          { name: 'Estrofa', progression: wheel, card: name(whole) },
          { name: 'Tornada', progression: chorus.join(' | '), card: name(e1) },
        ],
        order: [0, 1, 0, 1],
        style: spec.style,
        tempo: spec.tempo,
      },
    );
  }
  worlds.push({
    ...common,
    id: `${spec.id}:final`,
    title: spec.name || 'La cançó',
    goal: parts.length ? `Tocar la cançó sencera: ${spec.order.join(' – ')}` : chorus.length ? `Tocar l'estrofa (${wheelText}) i la tornada (${chorus.map(chordName).join(' – ')})` : `Tocar ${wheelText} com a la cançó`,
    chords: [...chords, ...chorusChords, ...partChords],
    missions: song,
  });

  const minor = chords.find((c) => splitChord(c).suffix === 'm' && c !== chords[0]);
  const inv = [{ id: id('i', 0), type: 'invert', title: `Inverteix ${chordName(chords[0])}`, chord: chords[0] }];
  if (minor) inv.push({ id: id('i', 1), type: 'invert', title: `Inverteix ${chordName(minor)}`, chord: minor });
  changes.slice(0, 4).forEach((pair, k) => {
    inv.push({ id: id('i', `x${k}`), type: 'change', title: `${chordName(pair.from)} → ${chordName(pair.to)}, a prop`, from: pair.from, to: pair.to });
  });
  inv.push(
    { id: id('i', 'steps'), type: 'steps', title: 'La roda a prop, pas a pas', chords: bars },
    { id: id('i', 'long'), type: 'pattern', title: 'La roda a prop amb música', card: name(whole), help: 'shape' },
    { id: id('i', 'band'), type: 'band', title: 'Toca amb la banda', cards: [e3, e2, e4, e1].map(name) },
  );
  worlds.push({
    ...common,
    id: `${spec.id}:inversions`,
    title: 'Inversions: mou menys la mà',
    goal: `Tocar ${wheelText} amb cada acord a la posició més propera`,
    inversions: true,
    missions: inv,
  });

  worlds.push(...levelTwoWorlds({
    wheel: bars,
    idOf: (w, k) => id(w, k),
    worldId: (w) => `${spec.id}:${w}`,
    style: spec.style === 'rock' ? 'ballad' : spec.style,
    meter: spec.meter,
  }));

  return makePath({ id: spec.id, title: spec.name || bars.join(' '), worlds, custom: true, key: spec.key ?? keyGuess(chords[0]), spec });
}

// ---- Chord workshop ("Taller d'acords") --------------------------------------------------------
// Short games, always open, to learn the keys and build chords by counting.
//   find  - find the note shown (white keys, then black keys)
//   jump  - from a lit key, jump N keys to the right (counting black and white)
//   build - build the chord shown: root, jump, jump (guided with counting), then alone
//   rush  - as many chords as you can in a minute

const WHITE_ROOTS = ['C', 'D', 'E', 'F', 'G', 'A'];

export const WORKSHOP_WORLDS = [
  {
    id: 'taller-notes',
    title: 'Les notes',
    goal: 'Trobar qualsevol nota al teclat',
    missions: [
      { id: 'taller-blanques', type: 'find', title: 'Les notes blanques', set: 'white', names: true },
      { id: 'taller-blanques-2', type: 'find', title: 'Blanques sense noms', set: 'white', names: false },
      { id: 'taller-negres', type: 'find', title: 'Les tecles negres', set: 'black', names: false },
    ],
  },
  {
    id: 'taller-salts',
    title: 'Salts',
    goal: 'Comptar tecles, blanques i negres',
    missions: [
      { id: 'taller-salt-1', type: 'jump', title: 'Salts d\'1 a 4', steps: [1, 2, 3, 4], numbers: true },
      { id: 'taller-salt-2', type: 'jump', title: 'Salts de 3 i de 4', steps: [3, 4], numbers: false },
    ],
  },
  {
    id: 'taller-majors',
    title: 'Acords majors',
    goal: 'Construir acords majors: salta 4 i després 3',
    missions: [
      { id: 'taller-major-1', type: 'build', title: 'Do, Fa i Sol, amb ajuda', roots: ['C', 'F', 'G'], quality: '', guided: true },
      { id: 'taller-major-2', type: 'build', title: 'Majors sense ajuda', roots: WHITE_ROOTS, quality: '', guided: false },
    ],
  },
  {
    id: 'taller-menors',
    title: 'Acords menors',
    goal: 'Construir acords menors: salta 3 i després 4',
    missions: [
      { id: 'taller-menor-1', type: 'build', title: 'La m, Re m i Mi m, amb ajuda', roots: ['A', 'D', 'E'], quality: 'm', guided: true },
      { id: 'taller-menor-2', type: 'build', title: 'Menors sense ajuda', roots: WHITE_ROOTS, quality: 'm', guided: false },
    ],
  },
  {
    id: 'taller-reptes',
    title: 'Reptes',
    goal: 'Majors i menors barrejats, i contra rellotge',
    missions: [
      { id: 'taller-barreja', type: 'build', title: 'Major o menor?', roots: WHITE_ROOTS, quality: 'mix', guided: false },
      { id: 'taller-rellotge', type: 'rush', title: 'Contra rellotge', roots: WHITE_ROOTS, seconds: 60 },
    ],
  },
];

for (const world of WORKSHOP_WORLDS) {
  world.progression ??= '';
  world.chords ??= [];
  world.level ??= 2;
  world.meter ??= '4/4';
  world.workshop = true;
}

export const WORKSHOP_PATH = makePath({ id: 'taller', title: 'Taller d\'acords', worlds: WORKSHOP_WORLDS });
