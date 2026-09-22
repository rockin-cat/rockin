// On-screen piano with the notes to play moving towards the keys.
//   horizontal: like Synthesia, keys at the bottom and notes falling down.
//   vertical:   like a piano roll (Logic), keys on the left and notes arriving
//               from the right.
// A key lights up when it is time to press it. Keys the student is holding turn
// green (right note for this bar), red (wrong note) or blue (no game running).
// The keys can also be clicked or touched.
//
// Drawing is kept off the per-frame path, so the page never starves the audio
// scheduler:
//   - base layer: empty lane and keyboard, drawn when the size, orientation or
//     key labels change;
//   - notes strip: notes and bar lines for the next two screens of music, drawn
//     when a note is judged or the strip runs out, and otherwise only moved with
//     a CSS transform (no repainting);
//   - top layer: lit and pressed keys and messages, drawn when they change.

import { noteName } from './theory.js';

export const LOWEST = 36; // C2
export const HIGHEST = 96; // C7

const BLACK = new Set([1, 3, 6, 8, 10]);
const isBlack = (note) => BLACK.has(((note % 12) + 12) % 12);
const BLACK_DEPTH = 0.62; // black keys, as a share of the key length
const STRIP_SCREENS = 2; // the notes strip holds this many lanes' worth of music

const COLOURS = {
  lane: '#17181c',
  laneLine: 'rgba(255,255,255,0.06)',
  laneOctave: 'rgba(255,255,255,0.13)',
  laneBlack: 'rgba(255,255,255,0.025)',
  barLine: 'rgba(255,255,255,0.28)',
  barText: 'rgba(255,255,255,0.75)',
  hint: 'rgba(255,255,255,0.45)',
  noteWhite: '#ffc012',
  noteBlack: '#e59a00',
  noteText: '#1d1d1f',
  hit: '#1f9d55',
  miss: '#d64545',
  demo: '#6fa8ff',
  good: '#35b36b',
  bad: '#e25555',
  neutral: '#4a8fe7',
  whiteKey: '#fbfbf8',
  blackKey: '#1d1d1f',
  keyEdge: '#b9b4ab',
  keyLabel: '#8a857c',
  shadow: 'rgba(0,0,0,0.35)',
};

const dpr = () => window.devicePixelRatio || 1;
const SOLFEGE = ['Do', 'Do#', 'Re', 'Re#', 'Mi', 'Fa', 'Fa#', 'Sol', 'Sol#', 'La', 'La#', 'Si'];
const LETTERS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

function sizeCanvas(canvas, width, height, scale) {
  const w = Math.max(1, Math.round(width * scale));
  const h = Math.max(1, Math.round(height * scale));
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }
  const ctx = canvas.getContext('2d');
  ctx.setTransform(w / width, 0, 0, h / height, 0, 0);
  ctx.clearRect(0, 0, width, height);
  return ctx;
}

function fill(ctx, { x, y, w, h }, colour) {
  ctx.fillStyle = colour;
  ctx.fillRect(x, y, w, h);
}

function roundRect(ctx, { x, y, w, h }, r) {
  r = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

const EMPTY = new Map();

export function createKeyboard(canvas, { onKeyDown, onKeyUp, range = null, compact = false } = {}) {
  // `canvas` becomes the top layer (it gets the pointer events); the other
  // layers are inserted underneath it.
  const base = document.createElement('canvas');
  const stripBox = document.createElement('div');
  const strip = document.createElement('canvas');
  base.className = 'piano-layer';
  stripBox.className = 'piano-strip';
  for (const node of [base, stripBox]) node.setAttribute('aria-hidden', 'true');
  stripBox.append(strip);
  canvas.before(base, stripBox);

  let orientation = 'horizontal';
  let whites = [];
  let low = 0;
  let high = 0;
  let g = null; // geometry
  let baseKey = '';
  let stripKey = '';
  let stripStart = 0; // tick at the strip's near edge
  let topKey = '';
  let lastLabels = null;
  let showNames = false;
  let labelKey = '';

  function setRange(from, to) {
    if (from === low && to === high) return;
    low = from;
    high = to;
    whites = [];
    for (let n = low; n <= high; n++) if (!isBlack(n)) whites.push(n);
  }

  // Coordinates: `a` runs along the keyboard (low to high pitch), `d` goes into
  // a key from the line where notes arrive, `t` goes into the lane from that line.
  function layout() {
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    const vertical = orientation === 'vertical';
    const along = vertical ? height : width;
    if (range) setRange(...(width >= 560 || vertical || range[0] < 48 ? range : [Math.max(range[0], 53), range[1]]));
    else if (vertical) setRange(...(height >= 640 ? [43, 91] : height >= 420 ? [48, 84] : [53, 81]));
    else setRange(...(width >= 1000 ? [LOWEST, HIGHEST] : width >= 600 ? [48, 84] : [53, 84]));

    // `compact`: almost all keys, with a thin strip above for messages.
    const depth = vertical
      ? Math.min(110, Math.max(60, width * 0.22))
      : compact
        ? Math.max(60, Math.min(160, height - 34))
        : Math.min(130, Math.max(70, height * 0.38));
    const laneLength = Math.max(1, (vertical ? width : height) - depth);
    const whiteSize = along / whites.length;
    const blackSize = whiteSize * 0.6;
    const keys = new Map();
    whites.forEach((note, i) => keys.set(note, { a: i * whiteSize, s: whiteSize, black: false }));
    for (let n = low; n <= high; n++) {
      if (isBlack(n)) keys.set(n, { a: keys.get(n - 1).a + whiteSize - blackSize / 2, s: blackSize, black: true });
    }
    const stripLength = laneLength * STRIP_SCREENS;

    const map = vertical
      ? {
          key: (a, s, d0, d1) => ({ x: depth - d1, y: along - a - s, w: d1 - d0, h: s }),
          lane: (a, s, t0, t1) => ({ x: depth + t0, y: along - a - s, w: t1 - t0, h: s }),
          stripRect: (a, s, t0, t1) => ({ x: t0, y: along - a - s, w: t1 - t0, h: s }),
          point: (a, d) => ({ x: depth - d, y: along - a }),
          lanePoint: (a, t) => ({ x: depth + t, y: along - a }),
          box: { left: depth, top: 0, width: laneLength, height },
          stripSize: { width: stripLength, height },
          // Strip position when its near edge is `t` away from the keys.
          place: (t) => `translate3d(${t}px, 0, 0)`,
        }
      : {
          key: (a, s, d0, d1) => ({ x: a, y: laneLength + d0, w: s, h: d1 - d0 }),
          lane: (a, s, t0, t1) => ({ x: a, y: laneLength - t1, w: s, h: t1 - t0 }),
          stripRect: (a, s, t0, t1) => ({ x: a, y: stripLength - t1, w: s, h: t1 - t0 }),
          point: (a, d) => ({ x: a, y: laneLength + d }),
          lanePoint: (a, t) => ({ x: a, y: laneLength - t }),
          box: { left: 0, top: 0, width, height: laneLength },
          stripSize: { width, height: stripLength },
          place: (t) => `translate3d(0, ${laneLength - stripLength - t}px, 0)`,
        };
    g = { vertical, width, height, along, depth, laneLength, stripLength, whiteSize, keys, ...map };
  }

  // ---- Base layer: lane and keyboard ----------------------------------------------

  function drawKey(ctx, n, colour) {
    const k = g.keys.get(n);
    if (!k.black) {
      fill(ctx, g.key(k.a, k.s, 0, g.depth), colour ?? COLOURS.whiteKey);
      fill(ctx, g.key(Math.round(k.a), 1, 0, g.depth), COLOURS.keyEdge);
      return;
    }
    const blackDepth = g.depth * BLACK_DEPTH;
    fill(ctx, g.key(k.a - 1, k.s, 0, blackDepth + 2), COLOURS.shadow);
    ctx.fillStyle = colour ?? COLOURS.blackKey;
    roundRect(ctx, g.key(k.a, k.s, 0, blackDepth), 2);
    ctx.fill();
  }

  function drawLabel(ctx, n, label, active) {
    const k = g.keys.get(n);
    const centre = k.a + k.s / 2;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';
    if (showNames && !k.black && k.s >= 26) {
      const p = g.point(centre, g.depth * (g.vertical ? 0.72 : 0.5));
      ctx.font = `600 ${Math.min(12, k.s * 0.45)}px system-ui, sans-serif`;
      ctx.fillStyle = active ? '#fff' : '#5a564f';
      ctx.fillText(SOLFEGE[n % 12], p.x, p.y);
      ctx.font = `${Math.min(10, k.s * 0.38)}px system-ui, sans-serif`;
      ctx.fillStyle = active ? '#fff' : COLOURS.keyLabel;
      ctx.fillText(LETTERS[n % 12], p.x + (g.vertical ? 22 : 0), p.y + (g.vertical ? 0 : 13));
    }
    if (label) {
      const p = g.point(centre, k.black ? g.depth * BLACK_DEPTH - 9 : g.depth - (g.vertical ? 30 : showNames ? 11 : 26));
      ctx.font = `600 ${Math.min(k.black ? 10 : 12, k.s * 0.6)}px ui-monospace, monospace`;
      ctx.fillStyle = k.black || active ? '#fff' : COLOURS.keyLabel;
      ctx.fillText(label, p.x, p.y);
    }
    if (n % 12 === 0 && !showNames) {
      const p = g.point(centre, g.depth - (g.vertical ? 12 : 9));
      ctx.font = `${Math.min(11, k.s * 0.6)}px system-ui, sans-serif`;
      ctx.fillStyle = active ? '#fff' : COLOURS.keyLabel;
      ctx.fillText(`Do${Math.floor(n / 12) - 1}`, p.x, p.y);
    }
  }

  function drawBase(labels) {
    const { vertical, width, height, along, laneLength, keys } = g;
    const ctx = sizeCanvas(base, width, height, dpr());
    fill(ctx, g.lane(0, along, 0, laneLength), COLOURS.lane);
    for (let n = low; n <= high; n++) {
      const k = keys.get(n);
      if (vertical && k.black) fill(ctx, g.lane(k.a, k.s, 0, laneLength), COLOURS.laneBlack);
      if (k.black || (n % 12 !== 0 && n % 12 !== 5)) continue;
      fill(ctx, g.lane(Math.round(k.a), 1, 0, laneLength), n % 12 === 0 ? COLOURS.laneOctave : COLOURS.laneLine);
    }
    for (const note of whites) drawKey(ctx, note, null);
    for (let n = low; n <= high; n++) if (keys.get(n).black) drawKey(ctx, n, null);
    for (let n = low; n <= high; n++) drawLabel(ctx, n, labels.get(n), false);

    // The strip is clipped to the lane.
    Object.assign(stripBox.style, {
      left: `${g.box.left}px`,
      top: `${g.box.top}px`,
      width: `${g.box.width}px`,
      height: `${g.box.height}px`,
    });
  }

  // ---- Notes strip ------------------------------------------------------------------

  function noteColour(status, black, hand = null) {
    if (status === 'hit') return COLOURS.hit;
    if (status === 'miss') return COLOURS.miss;
    if (status === 'demo') return COLOURS.demo;
    if (hand === 'left') return black ? '#e0701a' : '#ff8a2a'; // two hands: the left hand in orange
    if (hand === 'right') return black ? '#1f93d6' : '#3fb2f5'; // as the blue circles of the card
    return black ? COLOURS.noteBlack : COLOURS.noteWhite;
  }

  // Experimental: the card itself travels along the lane, over the keys of its chord.
  function drawCards(ctx, cards, tAt) {
    const { vertical, keys, whiteSize, stripLength } = g;
    for (const item of cards) {
      const t0 = tAt(item.startTick);
      const t1 = tAt(item.endTick);
      if (t1 <= 0 || t0 >= stripLength) continue;
      const known = item.notes.filter((n) => keys.has(n));
      if (!known.length) continue;
      const low = keys.get(Math.min(...known));
      const high = keys.get(Math.max(...known));
      let a0 = low.a - whiteSize * 0.4;
      let a1 = high.a + high.s + whiteSize * 0.4;
      const minSpan = whiteSize * 4;
      if (a1 - a0 < minSpan) {
        const mid = (a0 + a1) / 2;
        a0 = mid - minSpan / 2;
        a1 = mid + minSpan / 2;
      }
      const r = g.stripRect(a0, a1 - a0, t0 + 2, t1 - 2);
      ctx.fillStyle = '#f4f1ea';
      roundRect(ctx, r, 8);
      ctx.fill();
      // The card's circles, drawn along time: each one reaches the keys when it has to be played.
      const bandCentre = vertical ? r.y + r.h / 2 : r.x + r.w / 2;
      const band = vertical ? r.h : r.w;
      const beats = item.pattern?.length ?? 0;
      const span = (t1 - t0) / Math.max(1, beats);
      const shapes = [];
      (item.pattern ?? []).forEach((slices, beat) => {
        const unit = span / slices.length;
        slices.forEach((value, k) => {
          const start = t0 + (beat + k / slices.length) * span;
          if (value === 1) shapes.push({ start, end: start + unit, fill: true });
          else if (value === 2 && shapes.at(-1)?.fill) Object.assign(shapes.at(-1), { end: start + unit, held: true });
          else if (value === 0) shapes.push({ start, end: start + unit, fill: false });
        });
      });
      for (const shape of shapes) {
        const slice = shape.held ? span : shape.end - shape.start;
        const d = Math.max(4, Math.min(band * 0.62, slice * 0.86));
        const radius = d / 2;
        const from = shape.start + 2;
        const to = shape.held ? Math.max(from + d, shape.end - 3) : from + d;
        const rect = vertical
          ? { x: from, y: bandCentre - radius, w: to - from, h: d }
          : { x: bandCentre - radius, y: stripLength - to, w: d, h: to - from };
        ctx.beginPath();
        roundRect(ctx, rect, radius);
        if (shape.fill) {
          ctx.fillStyle = '#36b3ff';
          ctx.fill();
        } else {
          ctx.fillStyle = '#ffffff';
          ctx.fill();
          ctx.lineWidth = 1;
          ctx.strokeStyle = 'rgba(0,0,0,0.12)';
          ctx.stroke();
        }
      }
      ctx.lineWidth = 2;
      ctx.strokeStyle = COLOURS.noteWhite;
      roundRect(ctx, r, 8);
      ctx.stroke();
      // Judged attacks: a dot at the edge of the card, at its moment.
      for (const onset of item.onsets ?? []) {
        if (onset.status === 'pending') continue;
        const t = tAt(onset.startTick);
        const p = vertical ? { x: t, y: r.y + r.h + 5 } : { x: r.x - 5, y: stripLength - t };
        ctx.beginPath();
        ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
        ctx.fillStyle = noteColour(onset.status, false);
        ctx.fill();
      }
      // Faint marks of the chord keys along the card.
      for (const n of known) {
        const k = keys.get(n);
        fill(ctx, g.stripRect(k.a + k.s * 0.35, k.s * 0.3, Math.max(0, t0 - 6), t0), COLOURS.noteWhite);
      }
    }
  }

  function drawStrip({ window, notes, bars, cards }) {
    const { vertical, along, stripLength, keys } = g;
    strip.style.width = `${g.stripSize.width}px`;
    strip.style.height = `${g.stripSize.height}px`;
    const ctx = sizeCanvas(strip, g.stripSize.width, g.stripSize.height, Math.min(dpr(), 2));
    const tAt = (tick) => ((tick - stripStart) / window) * g.laneLength;

    ctx.font = '600 12px system-ui, sans-serif';
    for (const bar of bars) {
      const t = tAt(bar.tick);
      if (t < 0 || t > stripLength) continue;
      fill(ctx, g.stripRect(0, along, Math.round(t), Math.round(t) + 1), COLOURS.barLine);
      if (!bar.label) continue;
      ctx.fillStyle = COLOURS.barText;
      ctx.textAlign = 'left';
      if (vertical) {
        ctx.textBaseline = 'top';
        ctx.fillText(bar.label, t + 4, 4);
      } else {
        ctx.textBaseline = 'bottom';
        ctx.fillText(bar.label, 6, stripLength - t - 3);
      }
    }

    if (cards) {
      drawCards(ctx, cards, tAt);
      return;
    }
    for (const item of notes) {
      const t0 = Math.max(0, tAt(item.startTick));
      const t1 = Math.min(stripLength, tAt(item.endTick));
      if (t1 <= 0 || t0 >= stripLength || t1 - t0 < 1) continue;
      for (const midi of item.notes) {
        const k = keys.get(midi);
        if (!k) continue;
        const pad = k.black ? 1 : 2;
        const r = g.stripRect(k.a + pad, k.s - pad * 2, t0 + 1, Math.max(t0 + 4, t1 - 1));
        ctx.fillStyle = noteColour(item.status, k.black, item.hand);
        roundRect(ctx, r, 5);
        ctx.fill();
        const thin = Math.min(r.w, r.h);
        const long = Math.max(r.w, r.h);
        if (long > 18 && thin > 11) {
          ctx.fillStyle = COLOURS.noteText;
          ctx.font = `600 ${Math.min(11, thin * 0.6)}px system-ui, sans-serif`;
          const name = noteName(midi).replace(/-?\d+$/, '');
          if (vertical) {
            ctx.textAlign = 'left';
            ctx.textBaseline = 'middle';
            ctx.fillText(name, r.x + 3, r.y + r.h / 2);
          } else {
            ctx.textAlign = 'center';
            ctx.textBaseline = 'bottom';
            ctx.fillText(name, r.x + r.w / 2, r.y + r.h - 3);
          }
        }
      }
    }
  }

  // ---- Top layer: lit keys and messages -------------------------------------------------

  function drawTop({ lit, pressed, labels, message, marks }) {
    const { vertical, width, height, depth, laneLength, keys } = g;
    const ctx = sizeCanvas(canvas, width, height, dpr());

    if (message) {
      ctx.fillStyle = COLOURS.hint;
      const laneWidth = vertical ? width - depth : width;
      ctx.font = `${laneWidth < 600 ? 12 : 14}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const lines = laneWidth < 600 ? message.split(': ') : [message];
      const cx = vertical ? depth + laneWidth / 2 : width / 2;
      const cy = vertical ? height / 2 : laneLength / 2;
      lines.forEach((line, i) => ctx.fillText(line, cx, cy + (i - (lines.length - 1) / 2) * 18));
    }

    // A lit white key is repainted with its black neighbours so they stay on top.
    const colourOf = (midi) => COLOURS[pressed.get(midi)] ?? lit.get(midi) ?? null;
    const active = new Set([...pressed.keys(), ...lit.keys()].filter((n) => keys.has(n)));
    const repaint = new Set();
    for (const n of active) {
      repaint.add(n);
      if (!keys.get(n).black) for (const m of [n - 1, n + 1]) if (keys.get(m)?.black) repaint.add(m);
    }
    const order = [...repaint].sort((a, b) => Number(keys.get(a).black) - Number(keys.get(b).black));
    for (const n of order) drawKey(ctx, n, colourOf(n));
    for (const n of order) drawLabel(ctx, n, labels.get(n), active.has(n));

    // Marks: keys to find (no timing). `fill` paints the whole key, otherwise a
    // dot is drawn on it; `text` is written on the key or the dot.
    const filled = [...marks].filter(([n, mark]) => mark.fill && keys.has(n) && !active.has(n));
    const fillOrder = filled.sort(([a], [b]) => Number(keys.get(a).black) - Number(keys.get(b).black));
    for (const [n, mark] of fillOrder) {
      drawKey(ctx, n, mark.colour);
      if (!keys.get(n).black) for (const m of [n - 1, n + 1]) if (keys.get(m)?.black && !marks.get(m)?.fill) drawKey(ctx, m, colourOf(m));
    }
    for (const [n, mark] of fillOrder) {
      drawLabel(ctx, n, labels.get(n), false);
      if (!mark.text) continue;
      const k = keys.get(n);
      const p = g.point(k.a + k.s / 2, k.black ? g.depth * BLACK_DEPTH * 0.35 : g.depth * 0.25);
      ctx.fillStyle = k.black ? '#fff' : COLOURS.noteText;
      ctx.font = `800 ${Math.min(13, k.s * 0.42)}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(mark.text, p.x, p.y);
    }
    for (const [n, mark] of marks) {
      const k = keys.get(n);
      if (!k || mark.fill) continue;
      const depthAt = k.black ? g.depth * BLACK_DEPTH * 0.45 : g.depth * 0.72;
      const p = g.point(k.a + k.s / 2, depthAt);
      const r = Math.max(4, Math.min(9, k.s * 0.32));
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      ctx.fillStyle = mark.colour ?? COLOURS.noteWhite;
      ctx.fill();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = 'rgba(0,0,0,0.35)';
      ctx.stroke();
      if (mark.text) {
        ctx.fillStyle = COLOURS.noteText;
        ctx.font = `700 ${Math.min(10, r * 1.1)}px system-ui, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(mark.text, p.x, p.y + 0.5);
      }
    }
  }

  /**
   * `now`: current position in ticks (null when no game is running).
   * `window`: how many ticks of music the lane shows.
   * `notes`: [{ startTick, endTick, status, notes: [midi] }], covering at least
   *          `window * 2` ticks from `now`.
   * `bars`: [{ tick, label }] bar lines to draw in the lane.
   * `pressed`: Map midi -> 'good' | 'bad' | 'neutral'.
   * `labels`: Map midi -> computer-key letter.
   * `revision`: changes whenever a note's status or the bars in view change.
   * `marks`: Map midi -> { colour, text } dots to show without timing.
   * `names`: write the note name on every white key.
   * `cards`: [{ startTick, endTick, pattern, notes, onsets }] to draw the cards in
   *          the lane instead of the notes (experimental).
   */
  function draw({ now = null, window = 1, notes = [], bars = [], cards = null, pressed = new Map(), labels = new Map(), showGuide = true, message = '', revision = null, marks = EMPTY, names = false, lane = true }) {
    layout();
    showNames = names;
    if (!g.width || !g.height) return;

    // Cheap change checks (no per-frame string building, to keep garbage low).
    if (labels !== lastLabels) {
      lastLabels = labels;
      labelKey = [...labels].join(';');
    }
    const geometryKey = `${g.width}x${g.height}@${dpr()}|${orientation}|${low}-${high}`;
    const newBase = geometryKey + labelKey + (names ? '|names' : '');
    if (newBase !== baseKey) {
      drawBase(labels);
      baseKey = newBase;
      stripKey = '';
      topKey = '';
    }

    // Notes strip.
    const playing = now !== null && showGuide;
    stripBox.hidden = !playing || !lane;
    const lit = new Map();
    if (playing) {
      if (now < stripStart || now > stripStart + window * (STRIP_SCREENS - 1) || !stripKey) {
        stripStart = now;
        stripKey = '';
      }
      const stripEnd = stripStart + window * STRIP_SCREENS;
      const key = `${newBase}|${stripStart}|${window}|${revision}`;
      if (lane && key !== stripKey) {
        const visible = notes.filter((item) => item.endTick > stripStart && item.startTick < stripEnd);
        drawStrip({ window, notes: visible, bars, cards: cards?.filter((item) => item.endTick > stripStart && item.startTick < stripEnd) ?? null });
        stripKey = key;
      }
      const offset = ((stripStart - now) / window) * g.laneLength; // <= 0
      if (lane) strip.style.transform = g.place(offset);
      for (const item of notes) {
        if (item.startTick <= now && now < item.endTick) {
          for (const midi of item.notes) {
            const k = g.keys.get(midi);
            if (k) lit.set(midi, item.colour ?? noteColour(item.status, k.black, item.hand));
          }
        }
      }
    } else {
      stripKey = '';
    }

    // Top layer.
    const markKey = marks.size ? [...marks].map(([n, m]) => `${n}:${m.colour}:${m.text ?? ''}:${m.fill ? 1 : 0}`).join(';') : '';
    const newTop =
      pressed.size || lit.size || marks.size
        ? `${newBase}|${[...pressed].join(';')}|${[...lit].join(';')}|${message}|${markKey}`
        : `${newBase}||${message}`;
    if (newTop !== topKey) {
      drawTop({ lit, pressed, labels, message, marks });
      topKey = newTop;
    }
  }

  // ---- Mouse / touch ----------------------------------------------------------

  function noteAt(clientX, clientY) {
    if (!g) return null;
    const rect = canvas.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    const a = g.vertical ? g.along - y : x;
    const d = g.vertical ? g.depth - x : y - g.laneLength;
    if (d < 0 || d > g.depth) return null;
    if (d < g.depth * BLACK_DEPTH) {
      for (const [note, k] of g.keys) if (k.black && a >= k.a && a < k.a + k.s) return note;
    }
    const index = Math.floor(a / g.whiteSize);
    return whites[Math.max(0, Math.min(whites.length - 1, index))];
  }

  const active = new Map(); // pointerId -> note
  canvas.addEventListener('pointerdown', (event) => {
    const note = noteAt(event.clientX, event.clientY);
    if (note === null) return;
    event.preventDefault();
    canvas.setPointerCapture(event.pointerId);
    active.set(event.pointerId, note);
    onKeyDown?.(note, event.timeStamp);
  });
  canvas.addEventListener('pointermove', (event) => {
    if (!active.has(event.pointerId)) return;
    const note = noteAt(event.clientX, event.clientY);
    const previous = active.get(event.pointerId);
    if (note === null || note === previous) return;
    onKeyUp?.(previous, event.timeStamp);
    active.set(event.pointerId, note);
    onKeyDown?.(note, event.timeStamp);
  });
  const release = (event) => {
    const note = active.get(event.pointerId);
    if (note === undefined) return;
    active.delete(event.pointerId);
    onKeyUp?.(note, event.timeStamp);
  };
  canvas.addEventListener('pointerup', release);
  canvas.addEventListener('pointercancel', release);

  return {
    draw,
    /** Where the dot of a key is drawn, in CSS pixels of the canvas (null if not shown). */
    keyPoint(midi) {
      const k = g?.keys.get(midi);
      if (!k) return null;
      return g.point(k.a + k.s / 2, k.black ? g.depth * BLACK_DEPTH * 0.45 : g.depth * 0.72);
    },
    setOrientation(value) {
      orientation = value;
    },
    /** Changes the keys shown ([low, high] MIDI notes), e.g. more keys for two hands. */
    setKeyRange(value) {
      range = value;
    },
  };
}
