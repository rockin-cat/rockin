// Two hands ("Dues mans"): cards with two rows (blue = right hand, orange =
// left hand) and the path that uses them.
//
// The path follows the way the teacher works it in class:
//   1. both hands play the same chord (the left one an octave lower);
//   2. the left hand plays only the bass: the bottom note of that same chord;
//   3. each hand its own rhythm (bass and chord alternate, reggae, rock…).
// The cards are drawn by the program (the physical cards have one row), with
// the same look as the scanned ones.

import { chordName } from './missions.js';

const W = 555;
const H = 779; // same proportions as the scanned cards (1109 × 1558)
const RADIUS = 0.074; // of the width, for four beats
const ROW_Y = { right: 0.43, left: 0.57, mid: 0.5 }; // of the height
/** Where the circles of a card with `n` beats go (fractions of the width), as on the scanned cards. */
const cellsFor = (n) => {
  const step = 0.854 / n;
  const cell = step * 0.807;
  return Array.from({ length: n }, (_, k) => ({ x0: 0.073 + k * step + (step - cell) / 2, x1: 0.073 + k * step + (step + cell) / 2 }));
};
const radiusFor = (n) => Math.min(RADIUS, (0.854 / n) * 0.35);
export const RIGHT_COLOUR = '#3fb2f5';
export const LEFT_COLOUR = '#ff8a2a';

// right / left: one entry per beat, one value per slice (1 play, 2 hold, 0 silence).
const PATTERNS = [
  { n: 1, title: 'Les dues, a cada temps', right: [[1], [1], [1], [1]], left: [[1], [1], [1], [1]] },
  { n: 2, title: 'Les dues, nota llarga', right: [[1], [2], [2], [2]], left: [[1], [2], [2], [2]] },
  { n: 3, title: 'Les dues, amb un silenci', right: [[1], [1], [0], [1]], left: [[1], [1], [0], [1]] },
  { n: 4, title: 'Dreta a cada temps, esquerra llarga', right: [[1], [1], [1], [1]], left: [[1], [2], [2], [2]] },
  { n: 5, title: 'Esquerra al 1 i al 3', right: [[1], [1], [1], [1]], left: [[1], [0], [1], [0]] },
  { n: 6, title: 'Una i una', right: [[0], [1], [0], [1]], left: [[1], [0], [1], [0]] },
  { n: 7, title: 'Esquerra al 1, dreta després', right: [[0], [1], [1], [1]], left: [[1], [0], [0], [0]] },
  { n: 8, title: 'Reggae', right: [[0, 1], [0, 1], [0, 1], [0, 1]], left: [[1], [2], [1], [2]] },
  { n: 9, title: 'Rock', right: [[1], [1], [1], [1]], left: [[1], [0], [1, 1], [0]] },
  { n: 10, title: 'Balada', right: [[0], [1], [1], [1]], left: [[1], [2], [1], [2]] },
  // Medium: split beats in one hand. Hard: split beats in both hands, each hand a different rhythm.
  { n: 11, title: 'Esquerra a contratemps', right: [[1], [1], [1], [1]], left: [[0, 1], [0, 1], [0, 1], [0, 1]] },
  { n: 12, title: 'Dreta en corxeres', right: [[1, 1], [1, 1], [1, 1], [1, 1]], left: [[1], [0], [1], [0]] },
  { n: 13, title: 'Pop sincopat', right: [[1], [0, 1], [0, 1], [0, 1]], left: [[1], [2], [1], [2]] },
  { n: 14, title: 'Galop', right: [[0, 1], [0, 1], [0, 1], [0, 1]], left: [[1, 1], [0], [1, 1], [0]] },
  { n: 15, title: 'Bossa', right: [[1], [0, 1], [0, 1], [0]], left: [[1], [0, 1], [1], [0, 1]] },
  { n: 16, title: 'Funk', right: [[0, 1], [1, 0], [0, 1], [1, 0]], left: [[1], [0], [0, 1], [0]] },
  // Hard: fine subdivisions make sense between the two hands, not inside one. These
  // cards are drawn as ONE row with the colours interleaved (blue = right, orange =
  // left), the way a merengue pattern is played: one hand after the other.
  { n: 17, title: 'Alternades en corxeres', tier: 'hard', alternate: true, right: [[1, 0], [1, 0], [1, 0], [1, 0]], left: [[0, 1], [0, 1], [0, 1], [0, 1]] },
  { n: 18, title: 'Merengue (mans alternades)', tier: 'hard', alternate: true, right: [[1, 0, 1, 0], [1, 0, 1, 0], [1, 0, 1, 0], [1, 0, 1, 0]], left: [[0, 1, 0, 1], [0, 1, 0, 1], [0, 1, 0, 1], [0, 1, 0, 1]] },
  { n: 19, title: 'Esquerra als temps, dreta al mig', tier: 'hard', alternate: true, right: [[0, 1, 1, 0], [0, 1, 1, 0], [0, 1, 1, 0], [0, 1, 1, 0]], left: [[1, 0, 0, 1], [1, 0, 0, 1], [1, 0, 0, 1], [1, 0, 0, 1]] },
  { n: 20, title: 'Alternades amb silenci', tier: 'hard', alternate: true, right: [[1, 0, 1, 0], [0, 0, 1, 0], [1, 0, 1, 0], [0, 0, 1, 0]], left: [[0, 1, 0, 1], [1, 0, 0, 1], [0, 1, 0, 1], [1, 0, 0, 1]] },
];

export const twoHandName = (n) => `dues_mans_${String(n).padStart(2, '0')}`;

let icon = null;
if (typeof Image !== 'undefined') {
  icon = new Image();
  icon.src = 'assets/brand/rockin-icon.png';
}

const LONG_COLOUR = { '#3fb2f5': '#00c2c7', '#ff8a2a': '#e0661a' }; // long notes, as the teal bars of the printed cards

function drawRow(ctx, pattern, y, colour) {
  const CELLS = cellsFor(pattern.length);
  const r = radiusFor(pattern.length) * W;
  const whole = (slices) => slices.length === 1;
  pattern.forEach((slices, beat) => {
    const x0 = CELLS[beat].x0 * W;
    const x1 = CELLS[beat].x1 * W;
    const cx = (x0 + x1) / 2;
    const continues = whole(slices) && slices[0] === 2 && beat > 0 && whole(pattern[beat - 1]) && pattern[beat - 1][0] !== 0;
    if (continues) return; // drawn with the note it continues
    // A long note: a bar as tall as the circles, from this circle to the last held one.
    let end = beat;
    while (whole(slices) && slices[0] === 1 && end + 1 < pattern.length && whole(pattern[end + 1]) && pattern[end + 1][0] === 2) end++;
    if (end > beat) {
      const left = cx - r;
      const right = (CELLS[end].x0 + CELLS[end].x1) / 2 * W + r;
      ctx.fillStyle = LONG_COLOUR[colour] ?? colour;
      ctx.beginPath();
      ctx.roundRect(left, y - r, right - left, 2 * r, r * 0.35);
      ctx.fill();
      return;
    }
    if (slices.length === 1) {
      ctx.beginPath();
      ctx.arc(cx, y, r, 0, Math.PI * 2);
      if (slices[0] !== 0) {
        ctx.fillStyle = slices[0] === 2 ? LONG_COLOUR[colour] ?? colour : colour;
        ctx.fill();
      } else {
        ctx.fillStyle = '#fff';
        ctx.fill();
        ctx.lineWidth = 3;
        ctx.strokeStyle = 'rgba(0,0,0,0.12)';
        ctx.stroke();
      }
      return;
    }
    // A split circle, as on the printed cards: vertical strips from left to right,
    // coloured = play, white = silence, a held slice joins the previous one (no gap).
    const n = slices.length;
    const sw = (2 * r) / n;
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, y, r, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = '#fff';
    ctx.fillRect(cx - r, y - r, 2 * r, 2 * r);
    let sounding = false;
    slices.forEach((value, k) => {
      sounding = value === 1 || (value === 2 && sounding);
      if (sounding) {
        ctx.fillStyle = colour;
        ctx.fillRect(cx - r + k * sw, y - r, sw + 0.5, 2 * r);
      }
    });
    ctx.fillStyle = '#f2efe9';
    slices.forEach((value, k) => {
      if (k > 0 && value !== 2) ctx.fillRect(cx - r + k * sw - r * 0.06, y - r, r * 0.12, 2 * r);
    });
    ctx.restore();
    if (slices.includes(0)) {
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(0,0,0,0.12)';
      ctx.beginPath();
      ctx.arc(cx, y, r, 0, Math.PI * 2);
      ctx.stroke();
    }
  });
}

/**
 * Alternating cards: one row where every stroke is coloured by the hand that
 * plays it (blue = right, orange = left), like a merengue pattern.
 */
function drawAlternating(ctx, right, left, y) {
  const CELLS = cellsFor(right.length);
  const r = radiusFor(right.length) * W;
  right.forEach((slices, beat) => {
    const x0 = CELLS[beat].x0 * W;
    const x1 = CELLS[beat].x1 * W;
    const cx = (x0 + x1) / 2;
    const n = Math.max(slices.length, left[beat].length);
    const sw = (2 * r) / n;
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, y, r, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = '#fff';
    ctx.fillRect(cx - r, y - r, 2 * r, 2 * r);
    let sounding = null;
    for (let k = 0; k < n; k++) {
      const rv = slices[k] ?? 0;
      const lv = left[beat][k] ?? 0;
      if (rv === 1) sounding = RIGHT_COLOUR;
      else if (lv === 1) sounding = LEFT_COLOUR;
      else if (rv !== 2 && lv !== 2) sounding = null;
      if (sounding) {
        ctx.fillStyle = sounding;
        ctx.fillRect(cx - r + k * sw, y - r, sw + 0.5, 2 * r);
      }
    }
    ctx.fillStyle = '#f2efe9';
    for (let k = 1; k < n; k++) ctx.fillRect(cx - r + k * sw - r * 0.06, y - r, r * 0.12, 2 * r);
    ctx.restore();
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(0,0,0,0.12)';
    ctx.beginPath();
    ctx.arc(cx, y, r, 0, Math.PI * 2);
    ctx.stroke();
  });
}

function drawCard(p) {
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#f2efe9';
  ctx.fillRect(0, 0, W, H);
  if (icon?.complete && icon.naturalWidth) ctx.drawImage(icon, W * 0.78, H * 0.035, W * 0.14, W * 0.14);
  // Hand labels at the side of each row.
  ctx.font = `800 ${Math.round(W * 0.03)}px system-ui, sans-serif`;
  ctx.textAlign = 'left';
  if (p.alternate) {
    drawAlternating(ctx, p.right, p.left, ROW_Y.mid * H);
  } else {
    drawRow(ctx, p.right, ROW_Y.right * H, RIGHT_COLOUR);
    drawRow(ctx, p.left, ROW_Y.left * H, LEFT_COLOUR);
  }
  return canvas.toDataURL('image/png');
}

const layoutFor = (row, n = 4) => ({ y: ROW_Y[row], radius: radiusFor(n), cells: cellsFor(n) });
const splits = (pattern) => pattern.map((s) => s.length);

let cache = null;

/** The two-hand cards, as card objects (drawn once). */
export function twoHandCards() {
  if (cache) return cache;
  cache = PATTERNS.map((p) => {
    const src = typeof document === 'undefined' ? '' : drawCard(p);
    const rows = p.alternate ? { right: 'mid', left: 'mid' } : { right: 'right', left: 'left' };
    const right = { pattern: p.right, subdivisions_per_beat: splits(p.right), layout: layoutFor(rows.right) };
    const left = { pattern: p.left, subdivisions_per_beat: splits(p.left), layout: layoutFor(rows.left) };
    return {
      filename: twoHandName(p.n),
      number: p.n,
      tier: p.tier,
      alternate: Boolean(p.alternate),
      title: p.title,
      type: 'rhythmic',
      meter: 'binary',
      twoHands: true,
      src,
      fullSrc: src,
      ...right,
      hands: { right, left },
    };
  });
  return cache;
}

// ---- Two-hand copies of the scanned cards: the same pattern in both rows ----

export const twoName = (filename) => (filename?.startsWith('2x:') || filename?.startsWith('dues_mans') ? filename : `2x:${filename}`);
const derived = new Map();

/** The two-hand copy of a one-row card (`base`), drawn once. */
export function derivedCard(base) {
  if (!base) return null;
  if (!derived.has(base.filename)) {
    const n = base.pattern.length;
    const src = typeof document === 'undefined' ? '' : drawCard({ right: base.pattern, left: base.pattern });
    const row = (name) => ({ pattern: base.pattern, subdivisions_per_beat: base.subdivisions_per_beat, layout: layoutFor(name, n) });
    derived.set(base.filename, {
      ...base,
      filename: twoName(base.filename),
      twoHands: true,
      src,
      fullSrc: src,
      ...row('right'),
      hands: { right: row('right'), left: row('left') },
    });
  }
  return derived.get(base.filename);
}

/** Redraws the cards once the corner icon has loaded (calls back with the new cards). */
export function whenIconReady(callback) {
  if (!icon || (icon.complete && icon.naturalWidth)) return;
  icon.addEventListener('load', () => {
    cache = null;
    derived.clear();
    callback(twoHandCards());
  }, { once: true });
}

/** The card as one hand sees it (for the evaluator). */
export const handCard = (card, hand) => (card.twoHands ? { ...card, ...card.hands[hand] } : card);

/**
 * The two-hand path for a wheel. kit: { key, title, wheel, meter, style, tempo }.
 * Worlds are flagged `twoHands`; `left` says what the left hand plays.
 */
export function twoHandsPath(kit) {
  const c = twoHandName;
  const wheel = kit.wheel;
  const wheelText = wheel.map(chordName).join(' – ');
  const common = { progression: wheel.join(' | '), chords: [...new Set(wheel)], level: 2, meter: '4/4', style: kit.style ?? 'rock', twoHands: true };
  const id = (w, k) => `2m:${kit.key}:${w}:${k}`;
  const songCard = { reggae: 8, rumba: 9, rock: 9, ballad: 10, reggaeton: 9, funk: 9 }[kit.style] ?? 9;
  const worlds = [
    {
      ...common,
      id: `2m:${kit.key}:igual`,
      title: 'Les dues mans, el mateix acord',
      goal: `Tocar ${wheelText} amb les dues mans alhora`,
      left: 'chord',
      missions: [
        {
          id: id('a', 0),
          type: 'lesson',
          title: 'La carta de dues mans',
          slides: [
            { card: c(1), title: 'Dues files, dues mans', text: 'La fila <b style="color:#3fb2f5">blava</b> és la <b>mà dreta</b>. La fila <b style="color:#ff8a2a">taronja</b> és la <b>mà esquerra</b>. Quan les dues tenen rodona al mateix temps, toquen <b>alhora</b>.' },
            { card: c(1), title: 'El mateix acord, més greu', text: 'La mà esquerra fa <b>el mateix acord</b> que la dreta, però <b>més a l\'esquerra</b> del teclat (una octava més avall). Al teclat veuràs la dreta en <b style="color:#3fb2f5">blau</b> i l\'esquerra en <b style="color:#ff8a2a">taronja</b>.' },
            { card: c(3), title: 'Silencis i notes llargues', text: 'Tot funciona igual que a les cartes d\'una fila: rodona blanca = silenci, barra = mantén les tecles.' },
          ],
        },
        { id: id('a', 1), type: 'steps', title: 'La roda a dues mans, pas a pas', chords: wheel },
        { id: id('a', 2), type: 'pattern', title: 'A cada temps', card: c(1), help: 'shape' },
        { id: id('a', 3), type: 'pattern', title: 'Notes llargues', card: c(2), help: 'shape' },
        { id: id('a', 4), type: 'mix', title: 'Objectiu: dues cartes', cards: [c(1), c(3)] },
      ],
    },
    {
      ...common,
      id: `2m:${kit.key}:baix`,
      title: 'L\'esquerra fa el baix',
      goal: `La dreta fa l'acord i l'esquerra, només la nota de baix`,
      left: 'bass',
      missions: [
        {
          id: id('b', 0),
          type: 'lesson',
          title: 'El baix és part de l\'acord',
          slides: [
            { card: c(1), title: 'Només una nota', text: 'Ara la mà esquerra toca <b>només la nota de baix</b> de l\'acord: la mateixa que la dreta té sota el polze, però més greu. És el mateix acord: l\'esquerra en fa només una part.' },
            { card: c(4), title: 'Cada mà, el seu ritme', text: 'Mira bé les dues files: aquí la dreta toca a cada temps i l\'esquerra fa una <b>nota llarga</b>.' },
          ],
        },
        { id: id('b', 1), type: 'steps', title: 'Acord i baix, pas a pas', chords: wheel },
        { id: id('b', 2), type: 'pattern', title: 'Baix a cada temps', card: c(1), help: 'shape' },
        { id: id('b', 3), type: 'pattern', title: 'Baix llarg', card: c(4), help: 'shape' },
        { id: id('b', 4), type: 'pattern', title: 'Baix al 1 i al 3', card: c(5), help: 'none' },
        { id: id('b', 5), type: 'mix', title: 'Objectiu: tres cartes', cards: [c(4), c(5), c(1)] },
      ],
    },
    {
      ...common,
      id: `2m:${kit.key}:ritmes`,
      title: 'Cadascuna el seu ritme',
      goal: 'Baix i acord amb ritmes diferents, com a les cançons',
      left: 'bass',
      missions: [
        { id: id('c', 0), type: 'pattern', title: 'Una i una', card: c(6), help: 'shape' },
        { id: id('c', 1), type: 'pattern', title: 'Esquerra primer', card: c(7), help: 'none' },
        { id: id('c', 2), type: 'pattern', title: 'Rock', card: c(9), help: 'none' },
        { id: id('c', 3), type: 'pattern', title: 'Reggae', card: c(8), help: 'none' },
        { id: id('c', 4), type: 'song', title: kit.custom ? 'La cançó a dues mans' : 'La roda a tempo', songs: kit.title, progression: wheel.join(' | '), card: c(songCard), style: kit.style, tempo: kit.tempo ?? undefined },
        { id: id('c', 5), type: 'band', title: 'Toca amb la banda', cards: [c(6), c(4), c(9), c(5)] },
      ],
    },
    {
      ...common,
      id: `2m:${kit.key}:dificil`,
      title: 'Dues mans: ritmes difícils',
      goal: 'Temps partits entre les dues mans, alternant-les',
      left: 'bass',
      missions: [
        { id: id('d', 0), type: 'pattern', title: 'Esquerra a contratemps', card: c(11), help: 'shape' },
        { id: id('d', 1), type: 'pattern', title: 'Dreta en corxeres', card: c(12), help: 'shape' },
        { id: id('d', 2), type: 'pattern', title: 'Pop sincopat', card: c(13), help: 'none' },
        { id: id('d', 3), type: 'pattern', title: 'Galop', card: c(14), help: 'none' },
        { id: id('d', 4), type: 'mix', title: 'Objectiu: tres ritmes', cards: [c(15), c(16), c(13)] },
        { id: id('d', 5), type: 'pattern', title: 'Alternades en corxeres', card: c(17), help: 'shape' },
        { id: id('d', 6), type: 'pattern', title: 'Merengue: mans alternades', card: c(18), help: 'shape' },
        { id: id('d', 7), type: 'pattern', title: 'Esquerra als temps, dreta al mig', card: c(19), help: 'none' },
        { id: id('d', 8), type: 'mix', title: 'Objectiu: alternades', cards: [c(20), c(18), c(17)] },
        { id: id('d', 9), type: 'band', title: 'Toca amb la banda', cards: [c(16), c(17), c(14), c(20)] },
      ],
    },
  ];
  return worlds;
}

// ---- Two-hand judging (used by "Sessió") --------------------------------------------------------

export const SPLIT_NOTE = 60; // notes below middle C are the left hand

/**
 * One judge per hand, each with its row of the card. `make(level, deck, onResult)`
 * creates a normal evaluator. `left`: 'chord' | 'bass'. `voices(bar)` gives
 * { right, left } keys for the guide. Returns the evaluator interface.
 */
export function twoHandJudge({ make, deck, onResult, left = 'chord', voices }) {
  const handDeck = (hand) => ({ cardForBar: (b) => handCard(deck.cardForBar(b), hand) });
  const right = make(2, handDeck('right'), (r) => onResult({ ...r, hand: 'right' }));
  const leftJudge = make(left === 'bass' ? 1 : 2, handDeck('left'), (r) => onResult({ ...r, hand: 'left' }));
  // Which hand played a note: normally middle C splits the keyboard, but if the
  // note is clearly nearer the other hand's chord (an octave chosen a bit high or
  // low), it counts for that hand. Otherwise a C played with the left hand above
  // middle C — or with the right hand below it — would be judged as missing.
  let at = 0;
  const owner = new Map(); // note -> the judge that took it, so the release matches
  const nearest = (list, note) => (list?.length ? Math.min(...list.map((n) => Math.abs(n - note))) : 99);
  const pick = (note) => {
    const v = voices?.(Math.max(0, at)) ?? null;
    if (v) {
      const dR = nearest(v.right, note);
      const dL = nearest(v.left, note);
      if (dR <= 7 && dR < dL) return right;
      if (dL <= 7 && dL < dR) return leftJudge;
    }
    return note < SPLIT_NOTE ? leftJudge : right;
  };
  return {
    noteOn: (m) => {
      const judge = pick(m.note);
      owner.set(m.note, judge);
      judge.noteOn(m);
    },
    noteOff: (m) => {
      const judge = owner.get(m.note) ?? pick(m.note);
      owner.delete(m.note);
      judge.noteOff(m);
    },
    update: (p) => {
      at = p.bar ?? at;
      right.update(p);
      leftJudge.update(p);
    },
    describeBar: (b) => `${right.describeBar(b)} · esquerra: ${leftJudge.describeBar(b)}`,
    markersForBar: (b) => right.markersForBar(b),
    markersLeft: (b) => leftJudge.markersForBar(b),
    guideForBar: (b) => {
      const v = voices(b);
      return [
        ...right.guideForBar(b).map((item) => ({ ...item, notes: v.right, hand: 'right' })),
        ...leftJudge.guideForBar(b).map((item) => ({ ...item, notes: v.left, hand: 'left' })),
      ];
    },
    allowedPitchClasses: (b) => right.allowedPitchClasses(b),
    setDemo: (from, to) => {
      right.setDemo(from, to);
      leftJudge.setDemo(from, to);
    },
    isDemo: (b) => right.isDemo(b),
    forgetFrom: (b) => {
      right.forgetFrom(b);
      leftJudge.forgetFrom(b);
    },
  };
}
