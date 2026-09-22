// Card data: loads the JSON dictionary describing each card image, sorts the
// cards into difficulty tiers and deals the card shown in each bar.

export async function loadCards(url = 'data/cards.json') {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`No s'ha pogut carregar ${url} (${response.status})`);
  const { cards } = await response.json();
  // `src` is the light copy made by tools/make-web-assets.py; `fullSrc` the original.
  return Object.entries(cards).map(([filename, card]) => ({
    filename,
    src: `assets/web/${filename.replace(/\.png$/, '.jpg')}`,
    fullSrc: `assets/${filename}`,
    ...card,
  }));
}

export const TIERS = [
  { id: 'easy', name: 'Fàcil', hint: 'temps sencers, notes llargues i silencis' },
  { id: 'medium', name: 'Intermedi', hint: 'primera subdivisió del pols' },
  { id: 'hard', name: 'Difícil', hint: 'subdivisions més petites' },
];

/**
 * Rhythm cards: whole beats only = easy, the first subdivision of the pulse
 * (2 in simple meters, 3 in compound ones) = medium, anything finer = hard.
 * Melodic cards: 4 notes = easy, 5-6 = medium, 7 or more = hard.
 */
export function tierOf(card) {
  if (card.type === 'melodic') return card.notes <= 4 ? 'easy' : card.notes <= 6 ? 'medium' : 'hard';
  if (card.tier) return card.tier;
  const rows = card.hands ? [card.hands.right, card.hands.left] : [card];
  const finest = Math.max(...rows.flatMap((row) => row.subdivisions_per_beat));
  return finest === 1 ? 'easy' : finest <= 3 ? 'medium' : 'hard';
}

export const cardLabel = (card) =>
  `${card.type === 'melodic' ? 'Melòdica' : card.meter === 'binary' ? 'Binària' : 'Ternària'} ${card.number}`;

// A rhythmic card is played one circle per felt pulse of the bar, so it fits a
// meter with that many pulses whose pulse divides the same way: in 2 or 4 for
// simple meters (4/4, 3/4), in 3 for compound ones (6/8, 12/8).
const SUBDIVISIONS = { simple: [1, 2, 4, 8], compound: [1, 3, 6] };

function fitsMeter(card, meter) {
  const allowed = SUBDIVISIONS[meter.compound ? 'compound' : 'simple'];
  return card.pattern.length === meter.pulses && card.subdivisions_per_beat.every((n) => allowed.includes(n));
}

/** Every card that can be played at this level and meter, easiest first. */
export function playableCards(cards, { cardType, meter }) {
  let pool = cards.filter((card) => card.type === cardType);
  if (cardType === 'rhythmic') {
    const fitting = pool.filter((card) => fitsMeter(card, meter));
    const samePulses = pool.filter((card) => card.pattern.length === meter.pulses);
    if (fitting.length) {
      pool = fitting;
    } else if (samePulses.length) {
      pool = samePulses;
      console.warn(`[Cards] no card subdivides the pulse like ${meter.label}; using every card with ${meter.pulses} beats`);
    } else {
      console.warn(`[Cards] no card has ${meter.pulses} beats; cards will be stretched over the ${meter.label} bar`);
    }
  }
  const order = (card) => TIERS.findIndex((t) => t.id === tierOf(card));
  return pool.sort((a, b) => order(a) - order(b) || (a.meter ?? '').localeCompare(b.meter ?? '') || a.number - b.number);
}

/**
 * Deals one card per bar (or per time round) at random from `pool`.
 * `setFixed(card, fromBar, toBar)` plays a single card from `fromBar` on (until
 * `toBar`, if given). The challenge mode, the "change when passed" option and
 * the example ("Escolta") use it. `pick(except)` draws a random card.
 */
export function createDeck(pool, { progressionLength, changeEvery }) {
  if (!pool.length) throw new Error('No hi ha cartes per a aquesta combinació');
  console.log(`[Cards] deck (${pool.length}): ${pool.map((card) => card.filename).join(', ')}`);

  // Dealt lazily but strictly in order, so looking ahead at a future bar never
  // changes a card already dealt. The same card is never dealt twice in a row.
  const dealt = [];
  const deal = () => {
    const previous = dealt.at(-1);
    const choices = pool.length > 1 ? pool.filter((card) => card !== previous) : pool;
    dealt.push(choices[Math.floor(Math.random() * choices.length)]);
  };
  const fixed = []; // [{ fromBar, toBar, card }], later entries win

  return {
    cards: pool,
    cardForBar(bar) {
      const b = Math.max(0, bar);
      const override = fixed.findLast((f) => f.fromBar <= b && (f.toBar === undefined || b < f.toBar));
      if (override) return override.card;
      const index = Math.max(0, changeEvery === 'bar' ? bar : Math.floor(bar / progressionLength));
      while (dealt.length <= index) deal();
      return dealt[index];
    },
    setFixed(card, fromBar = 0, toBar = undefined) {
      fixed.push({ fromBar, toBar, card });
    },
    pick(except) {
      const choices = pool.length > 1 ? pool.filter((card) => card !== except) : pool;
      return choices[Math.floor(Math.random() * choices.length)];
    },
  };
}

/**
 * When each point of a melodic card is played, as fractions of the bar, on a
 * steady grid: `n` notes on the pulse subdivisions (two per pulse, three in
 * compound meters), as long as they fit — 2 notes take half a bar each, 3–4
 * take a pulse each, 5–8 half a pulse. The last note rings to the end of the
 * bar. `hops` are the steady grid moments for the ball.
 */
export function melodicSlots(n, { pulses = 4, compound = false } = {}) {
  const grid = pulses * (compound ? 3 : 2);
  let unit = 0;
  for (const u of [grid / 2, compound ? 3 : 2, 1]) {
    if (Number.isInteger(u) && u >= 1 && n * u <= grid) {
      unit = u;
      break;
    }
  }
  if (!unit) {
    // Too many notes for the grid: spread them evenly.
    const slots = Array.from({ length: n }, (_, i) => ({ f0: i / n, f1: (i + 1) / n }));
    return { slots, hops: slots.map((s) => s.f0) };
  }
  const slots = Array.from({ length: n }, (_, i) => ({ f0: (i * unit) / grid, f1: i === n - 1 ? 1 : ((i + 1) * unit) / grid }));
  // The ball keeps at least one bounce per pulse.
  const step = Math.min(unit, compound ? 3 : 2);
  const hops = [];
  for (let k = 0; k < grid; k += step) hops.push(k / grid);
  return { slots, hops };
}
