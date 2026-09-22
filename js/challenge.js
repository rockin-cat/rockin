// Challenge mode: the cards of each level and meter form a path from easy to
// hard. A card is passed after PASS_ROUNDS clean rounds of the progression in a
// row. When every card of a tier is passed, a mixed-card exam unlocks, and
// EXAM_PASS_STARS stars in it open the next tier. Progress lives in this
// browser's localStorage.

import { TIERS, cardLabel, tierOf } from './cards.js';

export const PASS_ROUNDS = 2;

// How much the on-screen keyboard helps. Exams are always played with 'none'.
export const HELP = [
  { id: 'full', name: 'Notes que arriben', mark: '✓', hint: 'les notes baixen fins a la tecla i s\'il·lumina quan toca' },
  { id: 'cards', name: 'Cartes al piano roll (experimental)', mark: '✓', hint: 'la carta arriba pel carril, a l\'alçada de les tecles de l\'acord: millor amb el teclat en vertical' },
  { id: 'keys', name: 'Només les tecles', mark: '✓✓', hint: 'un punt marca les tecles de l\'acord, però el ritme el llegeixes a la carta' },
  { id: 'none', name: 'Només la carta', mark: '★', hint: 'sense cap ajuda al teclat' },
];
export const helpIndex = (id) => Math.max(0, HELP.findIndex((h) => h.id === id));
export const EXAM_MIN_BARS = 8;
export const EXAM_PASS_STARS = 2;
export const starsFor = (ratio) => (ratio >= 0.9 ? 3 : ratio >= 0.75 ? 2 : ratio >= 0.5 ? 1 : 0);
export const examRounds = (progressionLength) => Math.max(1, Math.ceil(EXAM_MIN_BARS / progressionLength));

const STORAGE_KEY = 'rockin.progress.v1';

/** Progress is kept separately for each level and (for rhythm levels) each meter. */
export const trackKey = (level, meter) => (level === 3 ? 'L3' : `L${level}|${meter.label}`);

export function createProgress() {
  let data = {};
  try {
    data = JSON.parse(localStorage.getItem(STORAGE_KEY)) ?? {};
  } catch {
    data = {};
  }
  const save = () => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {
      // Private window or blocked storage: progress lasts until the page closes.
    }
  };
  const track = (key) => {
    data.tracks ??= {};
    return (data.tracks[key] ??= { passed: [], exams: {} });
  };

  return {
    get unlockAll() {
      return Boolean(data.unlockAll);
    },
    setUnlockAll(value) {
      data.unlockAll = value;
      save();
    },
    isPassed: (key, card) => track(key).passed.includes(card.filename),
    /** A card the student jumped over: it opens the next one but still counts as pending. */
    isSkipped: (key, card) => (track(key).skipped ?? []).includes(card.filename),
    markSkipped(key, card) {
      const t = track(key);
      t.skipped ??= [];
      if (!t.skipped.includes(card.filename) && !t.passed.includes(card.filename)) t.skipped.push(card.filename);
      save();
    },
    markPassed(key, card, help = 'full') {
      const t = track(key);
      if (!t.passed.includes(card.filename)) t.passed.push(card.filename);
      if (t.skipped) t.skipped = t.skipped.filter((f) => f !== card.filename);
      t.help ??= {};
      t.help[card.filename] = Math.max(t.help[card.filename] ?? 0, helpIndex(help));
      save();
    },
    /** The least help a card was passed with (index into HELP), or null. */
    passLevel: (key, card) => (track(key).passed.includes(card.filename) ? (track(key).help?.[card.filename] ?? 0) : null),
    examStars: (key, tier) => track(key).exams[tier] ?? null,
    setExamStars(key, tier, stars) {
      const t = track(key);
      t.exams[tier] = Math.max(stars, t.exams[tier] ?? 0);
      save();
    },
    reset() {
      data = { unlockAll: data.unlockAll };
      save();
    },
  };
}

/** The path for one track: tiers in order, each with its cards and exam state. */
export function buildMap(pool, progress, key) {
  const tiers = [];
  let open = true; // the previous tier's exam is passed
  for (const tier of TIERS) {
    const cards = pool.filter((card) => tierOf(card) === tier.id);
    if (!cards.length) continue;
    const tierOpen = open || progress.unlockAll;
    let previousDone = true;
    const items = cards.map((card) => {
      const passed = progress.isPassed(key, card);
      const skipped = !passed && progress.isSkipped?.(key, card);
      const unlocked = tierOpen && (previousDone || passed || skipped || progress.unlockAll);
      previousDone = passed || skipped;
      return { card, passed, skipped, unlocked, help: progress.passLevel(key, card) };
    });
    const allPassed = items.every((item) => item.passed);
    // Skipped cards also open the exam: passing it is proof enough.
    const allDone = items.every((item) => item.passed || item.skipped);
    const stars = progress.examStars(key, tier.id);
    tiers.push({
      ...tier,
      items,
      allPassed,
      allDone,
      stars,
      unlocked: tierOpen,
      examUnlocked: tierOpen && (allDone || progress.unlockAll),
    });
    open = tierOpen && (stars ?? 0) >= EXAM_PASS_STARS;
  }
  return tiers;
}

const sameTarget = (a, b) =>
  a && b && a.kind === b.kind && (a.kind === 'card' ? a.card.filename === b.card.filename : a.tier === b.tier);

/** Where the student should go next: the first card or exam not yet done. */
export function defaultTarget(map) {
  for (const tier of map) {
    const next = tier.items.find((item) => item.unlocked && !item.passed && !item.skipped);
    if (next) return { kind: 'card', card: next.card, tier: tier.id };
    if (tier.examUnlocked && (tier.stars ?? 0) < EXAM_PASS_STARS) return { kind: 'exam', tier: tier.id };
  }
  const first = map[0]?.items[0];
  return first ? { kind: 'card', card: first.card, tier: map[0].id } : null;
}

/** The target after passing `target`, or null if the tier's cards are done. */
export function nextCardInTier(map, target) {
  const tier = map.find((t) => t.id === target.tier);
  if (!tier) return null;
  const index = tier.items.findIndex((item) => item.card.filename === target.card.filename);
  const open = (item) => !item.passed && !item.skipped && item.card.filename !== target.card.filename;
  const next = tier.items.slice(index + 1).find(open) ?? tier.items.find(open);
  return next ? { kind: 'card', card: next.card, tier: tier.id } : null;
}

/** A target is still selectable when the map says it is unlocked. */
export function findTarget(map, target) {
  if (!target) return null;
  for (const tier of map) {
    if (target.kind === 'exam' && tier.id === target.tier && tier.examUnlocked) return { ...target };
    for (const item of tier.items) {
      if (target.kind === 'card' && item.unlocked && item.card.filename === target.card.filename) {
        return { kind: 'card', card: item.card, tier: tier.id };
      }
    }
  }
  return null;
}

export const targetLabel = (target) => {
  if (!target) return '';
  const tier = TIERS.find((t) => t.id === target.tier)?.name ?? '';
  return target.kind === 'exam' ? `Repte final ${tier.toLowerCase()}` : `${cardLabel(target.card)} · ${tier}`;
};

export const starText = (stars) => '★'.repeat(stars ?? 0) + '☆'.repeat(3 - (stars ?? 0));

// ---- Rendering --------------------------------------------------------------

const SVG = 'http://www.w3.org/2000/svg';
let clipCounter = 0;
const svgEl = (tag, attrs = {}) => {
  const node = document.createElementNS(SVG, tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  return node;
};

/** A tiny drawing of the card's pattern, so cards can be told apart without the image. */
export function cardGlyph(card) {
  if (card.type === 'melodic') {
    const top = Math.max(1, ...card.contour);
    const w = Math.max(40, card.contour.length * 9);
    const svg = svgEl('svg', { viewBox: `0 0 ${w} 20`, width: w, height: 20, class: 'glyph', 'aria-hidden': 'true' });
    const points = card.contour.map((rank, i) => [5 + (i * (w - 10)) / Math.max(1, card.contour.length - 1), 16 - (rank / top) * 12]);
    svg.append(svgEl('polyline', { points: points.map((p) => p.join(',')).join(' '), fill: 'none', stroke: '#1d8fd6', 'stroke-width': 1.5 }));
    for (const [x, y] of points) svg.append(svgEl('circle', { cx: x, cy: y, r: 2.4, fill: '#fff', stroke: '#1d8fd6', 'stroke-width': 1.3 }));
    return svg;
  }
  const beats = card.pattern.length;
  const w = beats * 18;
  const svg = svgEl('svg', { viewBox: `0 0 ${w} 20`, width: w, height: 20, class: 'glyph', 'aria-hidden': 'true' });
  card.pattern.forEach((slices, beat) => {
    const cx = 9 + beat * 18;
    const id = `glyph-clip-${clipCounter++}`;
    const clip = svgEl('clipPath', { id });
    clip.append(svgEl('circle', { cx, cy: 10, r: 7.5 }));
    svg.append(clip);
    const group = svgEl('g', { 'clip-path': `url(#${id})` });
    const sw = 15 / slices.length;
    slices.forEach((value, unit) => {
      const colour = value === 1 ? '#36b3ff' : value === 2 ? '#8fd4ff' : '#fff';
      group.append(svgEl('rect', { x: cx - 7.5 + unit * sw, y: 2, width: sw, height: 16, fill: colour }));
      if (unit > 0 && value !== 2) group.append(svgEl('rect', { x: cx - 7.5 + unit * sw - 0.4, y: 2, width: 0.8, height: 16, fill: '#fff' }));
    });
    svg.append(group);
    svg.append(svgEl('circle', { cx, cy: 10, r: 7.5, fill: 'none', stroke: '#9fb3c2', 'stroke-width': 0.8 }));
  });
  return svg;
}

const el = (tag, props = {}, children = []) => {
  const node = Object.assign(document.createElement(tag), props);
  node.append(...children);
  return node;
};

export function renderMap(container, map, selected, onSelect) {
  if (!map.length) {
    container.replaceChildren(el('p', { className: 'hint', textContent: 'No hi ha cartes per a aquest nivell i compàs.' }));
    return;
  }
  container.replaceChildren(
    ...map.map((tier) => {
      const done = tier.items.filter((i) => i.passed).length;
      const header = el('div', { className: 'tier-head' }, [
        el('strong', { textContent: tier.name }),
        el('span', { className: 'hint', textContent: ` ${tier.hint} · ${done}/${tier.items.length} superades` }),
        tier.unlocked ? '' : el('span', { className: 'badge', textContent: 'Bloquejat' }),
      ]);
      const chips = tier.items.map(({ card, passed, skipped, unlocked, help }) => {
        const target = { kind: 'card', card, tier: tier.id };
        const mark = passed ? HELP[help ?? 0].mark : skipped ? '⏭' : '';
        const button = el('button', {
          type: 'button',
          className: `card-chip${passed ? ' passed' : ''}${skipped ? ' skipped' : ''}${help === 2 ? ' mastered' : ''}${sameTarget(target, selected) ? ' active' : ''}`,
          disabled: !unlocked,
          title: `${cardLabel(card)}${passed ? ` · superada amb ajuda «${HELP[help ?? 0].name}»` : skipped ? ' · saltada: encara la pots superar' : unlocked ? '' : ' · bloquejada'}`,
        }, [cardGlyph(card), el('span', { textContent: `${card.number}${mark ? ` ${mark}` : ''}` })]);
        button.addEventListener('click', () => onSelect(target));
        return button;
      });
      const examTarget = { kind: 'exam', tier: tier.id };
      const exam = el('button', {
        type: 'button',
        className: `card-chip exam${sameTarget(examTarget, selected) ? ' active' : ''}${(tier.stars ?? 0) >= EXAM_PASS_STARS ? ' passed' : ''}`,
        disabled: !tier.examUnlocked,
        title: tier.examUnlocked
          ? `Repte final amb cartes barrejades i sense ajuda al teclat (calen ${EXAM_PASS_STARS} estrelles)`
          : 'Supera (o salta) totes les cartes per fer el repte final',
      }, [el('span', { textContent: 'Repte final' }), el('span', { className: 'stars', textContent: starText(tier.stars) })]);
      exam.addEventListener('click', () => onSelect(examTarget));
      return el('div', { className: `tier${tier.unlocked ? '' : ' locked'}` }, [header, el('div', { className: 'tier-cards' }, [...chips, exam])]);
    }),
  );
}
