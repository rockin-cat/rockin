// The songs of the ROCKIN songbook ("Llibre de temes"): chords, structure,
// style and tempo, as in the structure grids of the book (no lyrics).
//
// parts: the chords of every part, one bar per chord.
// order: the parts in the order of the song.
// A part written with "×n" in the book is repeated in `parts`.

const times = (text, n) => Array.from({ length: n }, () => text).join(' | ');

export const SONGBOOK = [
  {
    id: 'llibre-corren',
    name: 'Corren',
    artist: 'Gossos',
    key: 'Dm',
    style: 'reggae',
    tempo: 110,
    parts: { Intro: 'Dm | F | C | Dm', A: 'Dm | F | C | Dm', B: 'Dm | F | C | Dm' },
    order: ['Intro', 'A', 'B', 'A', 'B'],
  },
  {
    id: 'llibre-de-bonesh',
    name: 'De Bonesh',
    artist: 'Oques Grasses',
    key: 'G',
    style: 'rock',
    tempo: 98,
    parts: { A: 'G | D | Em | C', B: 'G | D | Em | C', C: 'G | D | Em | C', D: 'G | D | Em | C' },
    order: ['A', 'B', 'C', 'A', 'B', 'C', 'D'],
  },
  {
    id: 'llibre-diamonds',
    name: 'Diamonds',
    artist: 'Rihanna',
    key: 'Bm',
    style: 'rock',
    tempo: 92,
    parts: { Intro: 'G | Bm | A | A', A: 'G | Bm | A | A', B: 'G | Bm | A | A', C: 'G | Bm | A | A' },
    order: ['Intro', 'A', 'B', 'C', 'A', 'B', 'C', 'B', 'C'],
  },
  {
    id: 'llibre-en-la-tormenta',
    name: 'En la tormenta',
    artist: 'Iseo & Dodosound',
    key: 'Bbm',
    style: 'reggae',
    tempo: 100,
    parts: { Intro: 'Bbm | Ebm | Bbm | Ebm', Melo: 'Bbm | Ebm | Bbm | Ebm', A: 'Bbm | Ebm | Bbm | Ebm', B: 'Bbm | Ebm | Bbm | Ebm' },
    order: ['Intro', 'Melo', 'A', 'B', 'A', 'B', 'Melo'],
  },
  {
    id: 'llibre-flor-de-primavera',
    name: 'Flor de primavera',
    artist: 'La Troba Kung-Fú',
    key: 'A',
    style: 'rumba',
    tempo: 110,
    parts: { Intro: 'A | G | D | A', A: 'A | G | D | A', B: 'A | G | D | A', Solo: 'A | G | D | A' },
    order: ['Intro', 'B', 'A', 'B', 'A', 'Solo'],
  },
  {
    id: 'llibre-me-gustas-tu',
    name: 'Me gustas tú',
    artist: 'Manu Chao',
    key: 'Bm',
    style: 'reggae',
    tempo: 110,
    parts: { Intro: 'Bm | A | Em | Em', A: 'Bm | A | Em | Em', B: 'Bm | A | Em | Em' },
    order: ['Intro', 'A', 'B', 'A', 'B', 'A', 'B'],
  },
  {
    id: 'llibre-sense-tu',
    name: 'Sense tu',
    artist: 'Teràpia de Shock',
    key: 'D',
    style: 'ballad',
    tempo: 80,
    parts: {
      A: 'D | G | Em | A | G | A',
      B: 'D | G | Em | A | D | G | Em | A',
      C: 'D | G | Em | A | D | G | Em | A | G | A',
      Coda: 'D | G | Em | A | D',
    },
    order: ['A', 'B', 'A', 'B', 'C', 'Coda'],
    note: 'A la tornada (B i C) els acords canvien cada dos temps; aquí es toquen d\'un en un per aprendre l\'ordre.',
  },
  {
    id: 'llibre-som-ocells',
    name: 'Som ocells',
    artist: 'Nil Moliner',
    key: 'Em',
    style: 'rock',
    tempo: 150,
    parts: {
      A: 'Em | C | G | D',
      B: 'Em | C | G | D',
      C: `${times('Em | C | G | D', 3)} | Em | C | D | D`,
      Coda: 'Em | C | G | D | Em',
    },
    order: ['B', 'A', 'C', 'B', 'A', 'B', 'B', 'Coda'],
  },
  {
    id: 'llibre-urras',
    name: 'Urras',
    artist: 'Adala',
    key: 'Am',
    style: 'reggae',
    tempo: 110,
    parts: { Intro: 'Am | Am | Dm | Em', A: 'Am | Am | Dm | Em', B: 'Am | Am | Dm | Em', Solo: 'Am | Am | Dm | Em' },
    order: ['Intro', 'A', 'B', 'Solo', 'A', 'B'],
  },
];

/** The spec of a path (see buildPath) for a song of the book. */
export function songbookSpec(song) {
  const main = song.parts[song.order.find((p) => p !== 'Intro') ?? song.order[0]];
  return {
    id: song.id,
    name: song.name,
    artist: song.artist,
    key: song.key,
    progression: firstRound(main),
    chorus: '',
    parts: song.parts,
    order: song.order,
    note: song.note ?? '',
    meter: '4/4',
    style: song.style,
    tempo: song.tempo,
    readCards: false,
    book: true,
  };
}

/** The first round of a part: its first four bars (or all, when shorter or not a repeat). */
function firstRound(text) {
  const bars = text.split('|').map((s) => s.trim());
  return bars.slice(0, Math.min(bars.length, 4)).join(' | ');
}
