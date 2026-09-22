// The "score" of cards in "Juga": every bar of a try as a small card in rows,
// with its chord written above, like a lead sheet. A ball bounces from circle
// to circle and from card to card, and each card keeps the marks of how it
// was played:
//   - a green dot where a right attack was played (left of the circle = early,
//     right = late);
//   - a red X where a wrong or extra note was played, with the note name;
//   - a red ring round a circle nobody played, an orange one when the chord was
//     incomplete;
//   - a red "~" over a silence where a note kept ringing.
// Each card has its own small canvas, redrawn only when it changes, so drawing
// stays cheap while the music plays.

import { melodicSlots } from './cards.js';

const ASPECT = 1.6; // width / height of the visible band of a card
const IMAGE_RATIO = 1558 / 1109; // card image height / width
const BALL_R = 9;
const COLOURS = { pending: 'rgba(29,29,31,0.28)', hit: '#1f9d55', miss: '#d64545', warn: '#f08a00', ball: '#ffb400' };

const el = (tag, props = {}, children = []) => {
  const node = Object.assign(document.createElement(tag), props);
  node.append(...children.filter((c) => c !== null && c !== undefined && c !== false));
  return node;
};

export function createScore(container) {
  const rowsBox = el('div', { className: 'score-rows' });
  const scroller = el('div', { className: 'score-scroll' }, [rowsBox]);
  // The ball flies over all the cards, so it is drawn on a layer above them.
  const overlay = el('canvas', { className: 'score-overlay' });
  container.classList.add('play-score');
  container.append(scroller, overlay);
  let lastBall = null; // area of the overlay drawn last frame

  let tiles = []; // { bar, node, card, canvas, cover, rowNode, geometry, drawn }
  let barList = []; // the bars of the try, to write the chord of the bar being played
  let ballTile = -1;
  let shownRow = null;
  let pulses = 4;
  const dirty = new Set();
  if (typeof ResizeObserver !== 'undefined') {
    // Only a real change of size redraws: repainting the cards can nudge the
    // layout by a fraction of a pixel, and reacting to that would feed itself
    // (this was enough to lock the page up when entering full screen).
    let lastSize = '';
    new ResizeObserver((entries) => {
      const box = entries[0]?.contentRect;
      const key = box ? `${Math.round(box.width)}x${Math.round(box.height)}` : '';
      if (key === lastSize) return;
      lastSize = key;
      tiles.forEach((tile, k) => tile && dirty.add(k));
    }).observe(container);
  }

  /**
   * bars: [{ card, name, kind: 'demo' | 'ready' | 'play' | 'step', tag, repeatOf? }]
   * rows: [{ label, bars: [index], repeat? }]; `columns`: cards per row.
   * A bar with `repeatOf: k` is played on the card of bar k (a row played twice, marked "×2").
   */
  function setBars(bars, { rows, columns, meterPulses = 4 }) {
    pulses = meterPulses;
    barList = bars;
    lastBall = null;
    rowsBox.replaceChildren();
    tiles = [];
    ballTile = -1;
    shownRow = null;
    dirty.clear();
    container.style.setProperty('--score-columns', String(columns));
    // How many rows there are decides how big each card can be (see --score-card).
    // Rows of one single card go side by side, so nothing hides below the fold.
    const side = rows.length > 1 && rows.every((r) => r.bars.length === 1);
    container.classList.toggle('side', side);
    container.style.setProperty('--score-rows', String(side ? 1 : Math.max(1, rows.length)));
    container.style.setProperty('--score-total', String(rows.reduce((n, r) => n + r.bars.length, 0)));
    container.classList.toggle('few', columns <= 2);
    for (const row of rows) {
      // A row of one card played once per chord ("una per acord") uses the same
      // badge as a repeated row: the card is one, the chords go by on it.
      const repeatBadge = row.repeat > 1 || row.perChord ? el('span', { className: 'score-repeat', textContent: row.perChord ? 'una carta per acord' : `×${row.repeat}` }) : null;
      // One card for the whole wheel: the chords still show, in order, so you
      // can see how much is left to play and what is coming.
      const chips = (row.chordBars ?? []).map((index) => {
        const bar = bars[index];
        const chip = el('span', { className: 'score-wheel-chip', textContent: bar?.name ?? '' });
        if (bar?.colour) {
          chip.style.background = bar.colour;
          chip.style.color = bar.ink;
        }
        return chip;
      });
      const wheelStrip = chips.length ? el('div', { className: 'score-wheel' }, chips) : null;
      const rowNode = el('div', { className: `score-row${row.kind ? ` ${row.kind}` : ''}${repeatBadge ? ' repeated' : ''}` }, [
        row.label || repeatBadge || wheelStrip ? el('div', { className: 'score-row-label' }, [row.label ?? '', repeatBadge, wheelStrip]) : null,
      ]);
      rowNode.repeatBadge = repeatBadge;
      rowNode.repeat = row.repeat ?? 1;
      rowNode.perChord = row.perChord ?? 0;
      rowNode.chips = chips;
      rowNode.chordBars = row.chordBars ?? [];
      const grid = el('div', { className: 'score-grid' });
      if (row.bars.length > columns) grid.style.setProperty('--score-columns', String(row.bars.length));
      rowNode.append(grid);
      for (const index of row.bars) {
        const bar = bars[index];
        const canvas = el('canvas', { className: 'score-canvas' });
        const cardBox = el('div', { className: 'score-card' });
        let cover = null;
        if (bar.kind === 'ready') {
          cardBox.append(el('div', { className: 'score-ready' }, [
            el('b', { textContent: 'Ara tu!' }),
            el('span', { textContent: Array.from({ length: pulses }, (_, i) => i + 1).join(' ') }),
          ]));
        } else if (bar.card) {
          const img = el('img', { alt: '', decoding: 'async', src: bar.card.src });
          img.onerror = () => {
            if (img.getAttribute('src') !== bar.card.fullSrc) img.src = bar.card.fullSrc;
          };
          cardBox.append(img);
        }
        if (bar.kind === 'demo') {
          cover = el('div', { className: 'score-cover' }, [
            el('span', { className: 'score-hand', textContent: '✋', ariaHidden: 'true' }),
            el('strong', { textContent: 'Escolta' }),
          ]);
          cardBox.append(cover);
        }
        cardBox.append(canvas);
        const node = el('div', { className: `score-tile ${bar.kind}` }, [
          el('div', { className: 'score-head' }, [
            (() => {
              const b = el('b', { textContent: bar.name ?? '' });
              if (bar.colour) {
                b.className = 'deg';
                b.style.background = bar.colour;
                b.style.color = bar.ink;
                if (bar.degree) b.dataset.degree = bar.degree;
              }
              return b;
            })(),
            bar.tag ? el('small', { textContent: bar.tag }) : null,
          ]),
          cardBox,
        ]);
        grid.append(node);
        const headB = node.querySelector('b');
        tiles[index] = { bar: index, node, headB, card: bar.kind === 'ready' ? null : bar.card, canvas, cover, rowNode, geometry: null, sizeKey: '', active: index, first: index };
        dirty.add(index);
      }
      rowsBox.append(rowNode);
    }
    // Second passes share the card of the first one.
    bars.forEach((bar, index) => {
      if (bar.repeatOf !== undefined && tiles[bar.repeatOf]) tiles[index] = tiles[bar.repeatOf];
    });
    passOf = (index) => {
      const tile = tiles[index];
      if (!tile) return 1;
      let pass = 1;
      bars.forEach((bar, k) => {
        if (k < index && tiles[k] === tile) pass++;
      });
      return pass;
    };
  }
  let passOf = () => 1;

  function setStatus(index, status) {
    const tile = tiles[index];
    if (!tile || tile.active > index) return;
    tile.node.classList.remove('ok', 'miss', 'past');
    if (status) tile.node.classList.add(status);
  }

  /** A new pass over a shared card: it starts clean, without the marks or the
   * green / red border of the pass before. */
  function startPass(tile, index) {
    if (!tile || index <= tile.active) return;
    tile.active = index;
    tile.node.classList.remove('ok', 'miss', 'past');
    dirty.add(index);
  }

  function setCurrent(index) {
    const current = tiles[index];
    for (const tile of new Set(tiles)) tile?.node.classList.toggle('now', tile === current);
    const tile = tiles[index];
    if (tile) {
      startPass(tile, index);
      const badge = tile.rowNode.repeatBadge;
      const pass = passOf(index);
      if (tile.rowNode.perChord) {
        // One card for the whole wheel: the chord written on it is the one playing.
        const bar = barList[index];
        if (bar && tile.headB) {
          tile.headB.textContent = bar.name ?? '';
          if (bar.colour) {
            tile.headB.className = 'deg';
            tile.headB.style.background = bar.colour;
            tile.headB.style.color = bar.ink;
            if (bar.degree) tile.headB.dataset.degree = bar.degree;
          }
        }
        const at = tile.rowNode.chordBars.indexOf(index);
        tile.rowNode.chips.forEach((chip, k) => chip.classList.toggle('now', k === at));
        if (badge) {
          const n = tile.rowNode.perChord;
          const turn = Math.floor((pass - 1) / n) + 1;
          badge.textContent = `una carta · acord ${((pass - 1) % n) + 1} de ${n}${tile.rowNode.repeat > 1 ? ` · ${turn}a volta` : ''}`;
          badge.classList.toggle('second', turn > 1);
        }
      } else if (badge) {
        badge.textContent = `×${tile.rowNode.repeat} · ${pass === 1 ? '1a' : `${pass}a`} volta`;
        badge.classList.toggle('second', pass > 1);
      }
    }
    if (!tile || tile.rowNode === shownRow) return;
    shownRow = tile.rowNode;
    const top = tile.rowNode.offsetTop - rowsBox.offsetTop;
    scroller.scrollTo({ top: Math.max(0, top - 4), behavior: 'smooth' });
  }

  function shake(index) {
    const cover = tiles[index]?.cover;
    if (!cover) return;
    cover.classList.remove('shake');
    void cover.offsetWidth;
    cover.classList.add('shake');
  }

  const touch = (index) => dirty.add(index);

  function flag(index, name, on) {
    tiles[index]?.node.classList.toggle(name, on);
  }

  // ---- Geometry -------------------------------------------------------------------

  function geometry(tile) {
    const w = tile.canvas.clientWidth;
    const h = tile.canvas.clientHeight;
    if (!w || !h) return null;
    const key = `${w}x${h}`;
    if (tile.sizeKey === key && tile.geometry) return tile.geometry;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    tile.canvas.width = Math.round(w * dpr);
    tile.canvas.height = Math.round(h * dpr);
    tile.sizeKey = key;
    const g = { w, h, dpr, anchors: [], landings: [], spots: [], rests: [] };
    const card = tile.card;
    if (card?.type === 'melodic' && card.layout?.points) {
      // Melodic cards: one point per note, spread evenly over the bar, at its height.
      const full = w * IMAGE_RATIO;
      const offset = (full - h) / 2;
      const pts = card.layout.points.map((pt) => ({ x: pt.x * w, y: pt.y * full - offset }));
      const ring = Math.max(5, w * 0.03);
      g.r = ring;
      g.centreY = pts.reduce((sum, pt) => sum + pt.y, 0) / pts.length;
      g.melodic = true;
      g.maxY = Math.max(...pts.map((pt) => pt.y));
      // The ball bounces on a steady pulse: on each point when it is played, and in place while the last one rings.
      const { slots, hops } = melodicSlots(pts.length, { pulses });
      pts.forEach((pt, i) => {
        const f = slots[i].f0;
        g.anchors.push({ f, x: pt.x });
        g.spots.push({ x: pt.x, y: pt.y, r: ring, f });
      });
      for (const f of hops) {
        let k = 0;
        while (k < slots.length - 1 && slots[k + 1].f0 <= f + 1e-9) k++;
        g.landings.push({ f, x: pts[k].x, y: pts[k].y - ring - BALL_R - 2 });
      }
      const lastX = Math.min(w - 4, pts.at(-1).x + (w - pts.at(-1).x) / 2);
      g.landings.push({ f: 1, x: lastX, y: g.landings.at(-1).y });
      g.anchors.push({ f: 1, x: lastX });
      g.hop = Math.max(4, Math.min(w * 0.08, Math.min(...pts.map((pt) => pt.y)) - ring - BALL_R - 1));
      tile.geometry = g;
      return g;
    }
    if (!card?.layout?.cells) {
      g.centreY = h * 0.62;
      g.r = h * 0.18;
      g.landings = [{ f: 0, x: w / 2, y: g.centreY - BALL_R }, { f: 1, x: w / 2, y: g.centreY - BALL_R }];
      g.anchors = [{ f: 0, x: w / 2 }, { f: 1, x: w / 2 }];
      tile.geometry = g;
      return g;
    }
    const full = w * IMAGE_RATIO;
    const offset = (full - h) / 2;
    const { cells, y, radius } = card.layout;
    g.centreY = y * full - offset;
    g.r = radius * w;
    const restY = g.centreY - g.r - BALL_R - 3;
    const beats = card.pattern.length;
    // The spots of one row of circles (two-hand cards have two).
    const rowOf = (row) => {
      const out = { centreY: row.layout.y * full - offset, r: row.layout.radius * w, spots: [], rests: [] };
      row.pattern.forEach((slices, beat) => {
        const x0 = row.layout.cells[beat].x0 * w;
        const x1 = row.layout.cells[beat].x1 * w;
        const sw = (x1 - x0) / slices.length;
        slices.forEach((value, unit) => {
          const x = x0 + (unit + 0.5) * sw;
          const f = (beat + unit / slices.length) / beats;
          if (value === 1) out.spots.push({ x, r: slices.length > 1 ? out.r * 0.5 : out.r, f });
          if (value === 0) out.rests.push({ x, f });
        });
      });
      return out;
    };
    card.pattern.forEach((slices, beat) => {
      const x0 = cells[beat].x0 * w;
      const x1 = cells[beat].x1 * w;
      g.landings.push({ f: beat / beats, x: (x0 + x1) / 2, y: restY });
      // Time anchors: the finest slicing of this beat in any row.
      const units = card.twoHands ? Math.max(slices.length, card.hands.left.pattern[beat].length) : slices.length;
      for (let unit = 0; unit < units; unit++) g.anchors.push({ f: (beat + unit / units) / beats, x: x0 + ((unit + 0.5) * (x1 - x0)) / units });
    });
    const right = rowOf(card);
    g.spots = right.spots;
    g.rests = right.rests;
    g.rows = { right, left: card.twoHands ? rowOf(card.hands.left) : null };
    const last = cells.at(-1);
    g.landings.push({ f: 1, x: last.x1 * w + (w - last.x1 * w) / 2, y: restY });
    g.anchors.push({ f: 1, x: last.x1 * w + (w - last.x1 * w) / 2 });
    g.hop = Math.max(4, Math.min(w * 0.1, restY - BALL_R - 1));
    tile.geometry = g;
    return g;
  }

  /** Horizontal position of a moment of the bar (0 = start, 1 = end, may be outside). */
  function xAt(g, f) {
    const a = g.anchors;
    if (f <= a[0].f) {
      const slope = a.length > 1 ? (a[1].x - a[0].x) / Math.max(1e-6, a[1].f - a[0].f) : g.w;
      return Math.max(6, a[0].x + (f - a[0].f) * slope);
    }
    let i = 0;
    while (i < a.length - 2 && a[i + 1].f <= f) i++;
    const s = Math.min(1, (f - a[i].f) / Math.max(1e-6, a[i + 1].f - a[i].f));
    return Math.min(g.w - 6, a[i].x + (a[i + 1].x - a[i].x) * s);
  }

  function ballPosition(g, f) {
    const L = g.landings;
    let i = 0;
    while (i < L.length - 2 && L[i + 1].f <= f) i++;
    const a = L[i];
    const b = L[i + 1];
    const s = Math.min(1, Math.max(0, (f - a.f) / Math.max(1e-6, b.f - a.f)));
    const height = (g.hop ?? 20) * Math.min(1, 0.35 + (b.f - a.f) * pulses * 0.45);
    return { x: a.x + (b.x - a.x) * s, y: a.y - height * Math.sin(Math.PI * s), ground: a.y };
  }

  // ---- Drawing ----------------------------------------------------------------------

  function drawX(ctx, x, y, size, colour) {
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(x - size, y - size);
    ctx.lineTo(x + size, y + size);
    ctx.moveTo(x + size, y - size);
    ctx.lineTo(x - size, y + size);
    ctx.stroke();
    ctx.strokeStyle = colour;
    ctx.lineWidth = 3.2;
    ctx.stroke();
  }

  function label(ctx, text, x, y, colour) {
    ctx.font = '700 11px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    const w = ctx.measureText(text).width + 8;
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    ctx.fillRect(x - w / 2, y - 1, w, 15);
    ctx.fillStyle = colour;
    ctx.fillText(text, x, y + 1);
  }

  function drawTile(tile, data, ball) {
    const g = geometry(tile);
    if (!g) return;
    const ctx = tile.canvas.getContext('2d');
    ctx.setTransform(g.dpr, 0, 0, g.dpr, 0, 0);
    ctx.clearRect(0, 0, g.w, g.h);
    const two = Boolean(g.rows?.left);
    const rowFor = (hand) => (hand === 'left' && two ? g.rows.left : g.rows?.right ?? g);
    // With two rows, the marks of the right hand go above its row and those of the left hand below its row.
    const belowOf = (row, hand) => (g.melodic ? g.maxY + g.r + 6 : two && hand !== 'left' ? row.centreY - row.r - 9 : row.centreY + row.r + 6);
    const labelOf = (row, hand) => (two && hand !== 'left' ? Math.max(1, row.centreY - row.r - 30) : belowOf(row, hand) + 10);

    // Attacks still to judge or missed (hits are drawn where they were played).
    const pending = (spots, onsets, below) => spots.forEach((spot, i) => {
      if (onsets?.[i] !== 'pending') return;
      ctx.beginPath();
      ctx.arc(spot.x, below + 4, 4, 0, Math.PI * 2);
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = COLOURS.pending;
      ctx.stroke();
    });
    pending(g.spots, data?.onsets, belowOf(rowFor('right'), 'right'));
    if (two) pending(g.rows.left.spots, data?.onsetsLeft, belowOf(g.rows.left, 'left'));

    for (const mark of data?.marks ?? []) {
      const row = rowFor(mark.hand);
      const at = g.melodic && mark.index !== undefined ? g.spots[mark.index] : null;
      const rg = at ? { ...g, spots: [at], centreY: at.y, r: at.r } : { ...g, spots: row.spots, centreY: row.centreY, r: row.r };
      const below = belowOf(row, mark.hand);
      paintMark(ctx, rg, mark, below, labelOf(row, mark.hand));
    }

    if (ball?.count) {
      ctx.font = `900 ${Math.round(g.h * 0.7)}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = 'rgba(29,29,31,0.55)';
      ctx.fillText(ball.count, g.w / 2, g.h / 2 + 4);
    }
  }

  /** One mark on a row of circles (`g` has that row's spots, centre and radius). */
  function paintMark(ctx, g, mark, below, labelY = below + 10) {
    const x = g.melodic && g.spots.length === 1 ? g.spots[0].x : mark.kind === 'missed' || mark.kind === 'incomplete' ? nearestSpot(g, mark.f)?.x ?? xAt(g, mark.f) : xAt(g, mark.f);
    if (mark.kind === 'hit') {
      ctx.beginPath();
      ctx.arc(x, below + 4, 5, 0, Math.PI * 2);
      ctx.fillStyle = COLOURS.hit;
      ctx.fill();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = '#fff';
      ctx.stroke();
    } else if (mark.kind === 'missed' || mark.kind === 'incomplete') {
      const spot = nearestSpot(g, mark.f);
      const colour = mark.kind === 'missed' ? COLOURS.miss : COLOURS.warn;
      ctx.beginPath();
      ctx.arc(x, g.centreY, (spot?.r ?? g.r) + 3, 0, Math.PI * 2);
      ctx.lineWidth = 4;
      ctx.strokeStyle = colour;
      ctx.stroke();
      if (mark.label) label(ctx, mark.label, x, labelY, colour);
    } else if (mark.kind === 'rest') {
      ctx.font = '900 30px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.lineWidth = 4;
      ctx.strokeStyle = '#fff';
      ctx.strokeText('~', x, g.centreY);
      ctx.fillStyle = COLOURS.miss;
      ctx.fillText('~', x, g.centreY);
      label(ctx, mark.label ?? 'aixeca', x, labelY, COLOURS.miss);
    } else {
      drawX(ctx, x, g.centreY, Math.max(6, g.r * 0.35), COLOURS.miss);
      if (mark.label) label(ctx, mark.label, x, labelY, COLOURS.miss);
    }
  }

  // ---- The ball, on the layer above the cards ---------------------------------------

  function offsetOf(tile) {
    const a = tile.canvas.getBoundingClientRect();
    const b = container.getBoundingClientRect();
    return { x: a.left - b.left, y: a.top - b.top };
  }

  /** Where the ball is, in layer coordinates. The last beat of a card flies to the next card. */
  function ballPoint(ball) {
    const tile = tiles[ball.bar];
    const g = tile && geometry(tile);
    if (!g) return null;
    const o = offsetOf(tile);
    const L = g.landings;
    if (ball.jump !== undefined) {
      // A single hop from this card's first circle to the next card's (or in place on the last card).
      const from = { x: o.x + L[0].x, y: o.y + L[0].y };
      const nextTile = tiles[ball.bar + 1];
      const ng = nextTile && geometry(nextTile);
      const no = ng && offsetOf(nextTile);
      const to = ng ? { x: no.x + ng.landings[0].x, y: no.y + ng.landings[0].y } : from;
      const s = Math.min(1, Math.max(0, ball.jump));
      const distance = Math.hypot(to.x - from.x, to.y - from.y);
      const lift = Math.min(90, Math.max(g.hop ?? 20, distance * 0.25));
      const ground = from.y + (to.y - from.y) * s;
      return { x: from.x + (to.x - from.x) * s, y: ground - lift * Math.sin(Math.PI * s), ground };
    }
    if (ball.inPlace !== undefined) {
      const hop = (g.hop ?? 20) * 0.6 * Math.sin(Math.PI * ball.inPlace);
      return { x: o.x + L[0].x, y: o.y + L[0].y - hop, ground: o.y + L[0].y };
    }
    const lastBeat = L[L.length - 2];
    const nextTile = tiles[ball.bar + 1];
    const ng = nextTile && ball.f > lastBeat.f && geometry(nextTile);
    if (ng) {
      const no = offsetOf(nextTile);
      const from = { x: o.x + lastBeat.x, y: o.y + lastBeat.y };
      const to = { x: no.x + ng.landings[0].x, y: no.y + ng.landings[0].y };
      const sRaw = (ball.f - lastBeat.f) / Math.max(1e-6, 1 - lastBeat.f);
      const s = Math.min(1, Math.max(0, sRaw));
      const distance = Math.hypot(to.x - from.x, to.y - from.y);
      const lift = Math.min(90, Math.max(g.hop ?? 20, distance * 0.22));
      const ground = from.y + (to.y - from.y) * s;
      return { x: from.x + (to.x - from.x) * s, y: Math.min(from.y, to.y) + (ground - Math.min(from.y, to.y)) - lift * Math.sin(Math.PI * s), ground };
    }
    const p = ballPosition(g, ball.f);
    return { x: o.x + p.x, y: o.y + p.y, ground: o.y + p.ground };
  }

  function drawBall(ball) {
    const w = container.clientWidth;
    const h = container.clientHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    if (overlay.width !== Math.round(w * dpr) || overlay.height !== Math.round(h * dpr)) {
      overlay.width = Math.round(w * dpr);
      overlay.height = Math.round(h * dpr);
      lastBall = null;
    }
    const ctx = overlay.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (lastBall) ctx.clearRect(lastBall.x - 2, lastBall.y - 2, lastBall.w + 4, lastBall.h + 4);
    else ctx.clearRect(0, 0, w, h);
    lastBall = null;
    const p = ball && ballPoint(ball);
    if (!p) return;
    const top = Math.min(p.y, p.ground) - BALL_R - 2;
    lastBall = { x: p.x - BALL_R - 3, y: top, w: 2 * BALL_R + 6, h: p.ground + BALL_R * 1.5 - top + 2 };
    ctx.fillStyle = 'rgba(0,0,0,0.15)';
    ctx.beginPath();
    ctx.ellipse(p.x, p.ground + BALL_R, BALL_R, BALL_R * 0.35, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(p.x, p.y, BALL_R, 0, Math.PI * 2);
    ctx.fillStyle = COLOURS.ball;
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#1d1d1f';
    ctx.stroke();
  }

  function nearestSpot(g, f) {
    let best = null;
    for (const s of g.spots) if (!best || Math.abs(s.f - f) < Math.abs(best.f - f)) best = s;
    return best;
  }

  /**
   * ball: null or { bar, f, count?, inPlace? } (inPlace: 0..1 hop over the first circle).
   * dataFor(bar): { onsets: [status], marks: [{ f, kind, label }] }.
   */
  function frame(ball, dataFor) {
    const now = ball ? ball.bar : -1;
    if (now !== ballTile) {
      if (ballTile >= 0) dirty.add(ballTile);
      ballTile = now;
      if (now >= 0) startPass(tiles[now], now);
    }
    if (now >= 0 && tiles[now] && (ball.count || dirty.has(now))) drawTile(tiles[now], dataFor(now), ball);
    else if (now >= 0 && tiles[now] && tiles[now].hadCount) drawTile(tiles[now], dataFor(now), null);
    if (now >= 0 && tiles[now]) tiles[now].hadCount = Boolean(ball.count);
    drawBall(ball);
    for (const index of dirty) {
      if (index === now || !tiles[index] || tiles[index].active !== index) continue;
      drawTile(tiles[index], dataFor(index), null);
    }
    dirty.clear();
  }

  /** Redraw every card (after a resize or at the end of a try). */
  function redrawAll(dataFor) {
    tiles.forEach((tile, k) => {
      if (tile && tile.active === k) drawTile(tile, dataFor(k), null);
    });
    ballTile = -1;
  }

  const clear = () => {
    drawBall(null);
    rowsBox.replaceChildren();
    tiles = [];
    ballTile = -1;
    shownRow = null;
  };

  return { setBars, setStatus, setCurrent, shake, touch, flag, frame, redrawAll, clear, get size() { return tiles.length; } };
}
