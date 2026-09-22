// "Juga" extras for the classroom: the teacher view (progress of every student
// on this computer) and the printable sheet of a path.

import { parseChord, pitchClass } from './theory.js';
import { chordName, triadNoteNames, wheelChanges } from './missions.js';
import { degreeOf } from './degrees.js';
import { fingers, inversionVoicing, rootVoicing, voiceChain } from './voicing.js';

const el = (tag, props = {}, children = []) => {
  const node = Object.assign(document.createElement(tag), props);
  node.append(...children.filter((c) => c !== null && c !== undefined && c !== false));
  return node;
};
const SVG = 'http://www.w3.org/2000/svg';
const svgEl = (tag, attrs = {}, children = []) => {
  const node = document.createElementNS(SVG, tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, String(v));
  node.append(...children);
  return node;
};

export const REFLECTIONS = [
  { id: 'canvis', label: 'Als canvis d\'acord' },
  { id: 'ritme', label: 'Llegint el ritme de la carta' },
  { id: 'notes', label: 'Trobant les notes' },
  { id: 'perdut', label: 'He perdut el fil i m\'ha costat tornar a entrar' },
  { id: 'be', label: 'Cap problema, m\'ha sortit bé' },
];

const day = (t) => new Date(t).toLocaleDateString('ca', { day: 'numeric', month: 'short' });
const time = (t) => new Date(t).toLocaleString('ca', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

/** Spelled name of a key inside a chord: E in C major is "Mi". */
export function keyName(midi, symbol) {
  const chord = parseChord(symbol);
  const i = chord.triad.indexOf(pitchClass(midi));
  return i >= 0 ? triadNoteNames(symbol)[i] : '?';
}

// ---- Teacher view ----------------------------------------------------------------------

/**
 * store: { students: { id: { name, stars, log: [{ m, p, s, r, tempo, t, reflect }] } } }
 * path: the path shown on the map.
 */
export function renderTeacher({ store, path, onDelete, onRename, button }) {
  const students = Object.entries(store.students);
  const missionTitle = new Map(path.missions.map((m) => [m.id, `${m.world.title} · ${m.title}`]));
  missionTitle.set('placement', 'Prova de nivell');
  missionTitle.set('jam', 'Toca amb la banda (nivell més alt)');
  const total = path.missions.length * 3;

  const rows = students.map(([id, st]) => {
    const log = st.log.filter((e) => e.p === path.id);
    const stars = path.missions.reduce((sum, m) => sum + (st.stars[m.id] ?? 0), 0);
    const tries = new Map();
    for (const e of log) tries.set(e.m, (tries.get(e.m) ?? 0) + 1);
    const hard = [...tries]
      .filter(([m, n]) => n >= 3 && (st.stars[m] ?? 0) <= 1)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([m, n]) => `${missionTitle.get(m) ?? m} (${n} intents)`);
    const reflections = new Map();
    for (const e of log) if (e.reflect) reflections.set(e.reflect, (reflections.get(e.reflect) ?? 0) + 1);
    const last = log.at(-1)?.t;
    const worlds = path.worlds.map((w) => {
      const got = w.missions.reduce((sum, m) => sum + (st.stars[m.id] ?? 0), 0);
      const share = got / (w.missions.length * 3);
      return el('span', { className: 'teacher-world', title: `${w.title}: ${got}/${w.missions.length * 3} ★` }, [
        el('i', { style: `width:${Math.round(share * 100)}%` }),
      ]);
    });
    return el('tr', {}, [
      el('th', { scope: 'row' }, [
        el('span', { textContent: st.name }),
        el('div', { className: 'teacher-actions' }, [
          button('Canvia el nom', () => onRename(id), 'ghost small'),
          button('Esborra', () => onDelete(id), 'ghost small'),
        ]),
      ]),
      el('td', { textContent: `${stars} / ${total}` }),
      el('td', {}, [el('div', { className: 'teacher-worlds' }, worlds)]),
      el('td', { textContent: String(log.length) }),
      el('td', { textContent: last ? day(last) : '—' }),
      el('td', { innerHTML: hard.length ? hard.join('<br>') : '—' }),
      el('td', {
        innerHTML: reflections.size
          ? REFLECTIONS.filter((r) => reflections.has(r.id)).map((r) => `${r.label}: <b>${reflections.get(r.id)}</b>`).join('<br>')
          : '—',
      }),
    ]);
  });

  const detailSelect = el('select', {}, students.map(([id, st]) => new Option(st.name, id)));
  const detail = el('div', { className: 'teacher-detail' });
  const showDetail = () => {
    const st = store.students[detailSelect.value];
    if (!st) return detail.replaceChildren();
    const log = st.log.filter((e) => e.p === path.id).slice(-20).reverse();
    detail.replaceChildren(
      log.length
        ? el('table', { className: 'teacher-table small' }, [
            el('thead', {}, [el('tr', {}, ['Quan', 'Missió', '★', 'Compassos nets', 'Tempo', 'On ha perdut el fil'].map((h) => el('th', { textContent: h })))]),
            el('tbody', {}, log.map((e) => el('tr', {}, [
              el('td', { textContent: time(e.t) }),
              el('td', { textContent: missionTitle.get(e.m) ?? e.m }),
              el('td', { textContent: e.m === 'placement' ? `${e.s}/4 proves` : '★'.repeat(e.s) + '☆'.repeat(Math.max(0, 3 - e.s)) }),
              el('td', { textContent: e.m === 'placement' ? `comença a: ${missionTitle.get(e.start) ?? e.start}` : e.r === undefined || e.r === null ? '—' : `${Math.round(e.r * 100)}%` }),
              el('td', { textContent: e.tempo ?? '—' }),
              el('td', { textContent: REFLECTIONS.find((r) => r.id === e.reflect)?.label ?? '—' }),
            ]))),
          ])
        : el('p', { className: 'play-note', textContent: 'Encara no ha jugat aquest camí.' }),
    );
  };
  detailSelect.addEventListener('change', showDetail);
  showDetail();

  const csv = () => {
    const lines = [['alumne', 'camí', 'missió', 'estrelles', 'compassos nets', 'tempo', 'data', 'autoavaluació']];
    for (const [, st] of students) {
      for (const e of st.log) {
        lines.push([st.name, e.p, missionTitle.get(e.m) ?? e.m, e.s, e.r === undefined || e.r === null ? '' : Math.round(e.r * 100) + '%', e.tempo ?? '', new Date(e.t).toISOString(), REFLECTIONS.find((r) => r.id === e.reflect)?.label ?? '']);
      }
    }
    const text = lines.map((l) => l.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(';')).join('\n');
    const link = el('a', { href: URL.createObjectURL(new Blob(['﻿' + text], { type: 'text/csv' })), download: 'rockin-progres.csv' });
    document.body.append(link);
    link.click();
    link.remove();
  };

  return el('div', { className: 'play-world teacher' }, [
    el('div', { className: 'play-kicker', textContent: 'Vista del professor' }),
    el('h2', { textContent: `Progrés a ${path.title}` }),
    el('p', { textContent: 'Tots els alumnes que han jugat en aquest ordinador. Les barres són els mons del camí; «Li costa» són missions amb 3 intents o més i poques estrelles.' }),
    students.length
      ? el('div', { className: 'teacher-scroll' }, [
          el('table', { className: 'teacher-table' }, [
            el('thead', {}, [el('tr', {}, ['Nom', 'Estrelles', 'Mons', 'Intents', 'Últim dia', 'Li costa', 'On diu que ha perdut el fil'].map((h) => el('th', { textContent: h })))]),
            el('tbody', {}, rows),
          ]),
        ])
      : el('p', { textContent: 'Encara no hi ha cap alumne.' }),
    students.length ? el('h3', { textContent: 'Últims intents' }) : null,
    students.length ? el('label', { className: 'play-field inline' }, [el('span', { textContent: 'Alumne' }), detailSelect]) : null,
    students.length ? detail : null,
    el('div', { className: 'play-buttons' }, [students.length ? button('⬇ Descarrega-ho (CSV)', csv, 'ghost') : null].filter(Boolean)),
  ]);
}

// ---- Chord change diagram --------------------------------------------------------------

let arrowIds = 0;

/**
 * A picture of a chord change: a small keyboard with the fingers of chord A
 * (dots at the bottom of the keys, colour of A), the fingers of chord B (dots
 * higher up, colour of B) and an arrow from each finger to where it goes.
 * A key that stays under the same finger gets a green dot and a pin; keys that
 * are in both chords are tinted green. If the whole hand moves the same way, a
 * big hand arrow on top says so.
 * from/to: chord symbols; a/b: voicings; key: the key of the song (colours).
 */
export function changeDiagram({ from, to, a, b, key = 'C', names = true, compact = false }) {
  const A = [...a].sort((x, y) => x - y);
  const B = [...b].sort((x, y) => x - y);
  const fa = fingers(A);
  const fb = fingers(B);
  const da = degreeOf(from, key);
  const db = degreeOf(to, key);
  const black = (n) => [1, 3, 6, 8, 10].includes(pitchClass(n));
  let low = Math.min(...A, ...B) - 2;
  let high = Math.max(...A, ...B) + 2;
  while (black(low)) low--;
  while (black(high)) high++;
  const W = compact ? 18 : 24;
  const H = compact ? 78 : 104;
  const TOP = compact ? 30 : 42; // room for the arrows and the hand
  const BOTTOM = names ? (compact ? 24 : 32) : 4;
  const whites = [];
  for (let n = low; n <= high; n++) if (!black(n)) whites.push(n);
  const width = whites.length * W;
  const id = `arr${++arrowIds}`;
  const svg = svgEl('svg', { viewBox: `0 0 ${width} ${TOP + H + BOTTOM}`, class: `change-diagram${compact ? ' compact' : ''}`, role: 'img', 'aria-label': `${chordName(from)} a ${chordName(to)}` });
  svg.append(svgEl('defs', {}, [
    svgEl('marker', { id, viewBox: '0 0 10 10', refX: 7, refY: 5, markerWidth: 4.2, markerHeight: 4.2, orient: 'auto-start-reverse' }, [
      svgEl('path', { d: 'M0,0 L10,5 L0,10 z', fill: '#1d1d1f' }),
    ]),
  ]));
  const shared = new Set(A.filter((n) => B.includes(n)));
  const x = new Map();
  const g = svgEl('g', { transform: `translate(0 ${TOP})` });
  whites.forEach((n, i) => {
    x.set(n, i * W + W / 2);
    g.append(svgEl('rect', { x: i * W, y: 0, width: W, height: H, rx: 3, fill: shared.has(n) ? '#c9f5d9' : '#fff', stroke: '#444', 'stroke-width': 1 }));
  });
  const BH = H * 0.6;
  for (let n = low; n <= high; n++) {
    if (!black(n)) continue;
    const cx = x.get(n - 1) + W / 2;
    x.set(n, cx);
    g.append(svgEl('rect', { x: cx - W * 0.32, y: 0, width: W * 0.64, height: BH, rx: 2, fill: shared.has(n) ? '#2f8f57' : '#222' }));
  }
  const r = compact ? 6.5 : 8.5;
  // Where the dots go: chord A low on the key, chord B higher.
  const yA = (n) => (black(n) ? BH - r - 3 : H - r - 3);
  const yB = (n) => (black(n) ? r + 4 : BH + r + 2);
  const dot = (n, y, fill, ink, text, ring = '#1d1d1f') => {
    g.append(svgEl('circle', { cx: x.get(n), cy: y, r, fill, stroke: ring, 'stroke-width': 1.3 }));
    const t = svgEl('text', { x: x.get(n), y: y + r * 0.42, 'text-anchor': 'middle', 'font-size': r * 1.25, 'font-weight': 800, fill: ink });
    t.textContent = text;
    g.append(t);
  };
  const moves = B.map((n, i) => ({ from: A[i], to: n, fa: fa[i], fb: fb[i] }));
  const arrows = svgEl('g', {});
  for (const m of moves) {
    if (m.from === m.to) continue;
    const x1 = x.get(m.from);
    const x2 = x.get(m.to);
    const y1 = yA(m.from) - r;
    const y2 = yB(m.to) - r;
    const lift = 10 + Math.min(28, Math.abs(x2 - x1) * 0.35);
    const cy = Math.min(y1, y2) - lift;
    const d = `M${x1},${y1} Q${(x1 + x2) / 2},${cy} ${x2},${y2 - 1}`;
    arrows.append(svgEl('path', { d, fill: 'none', stroke: '#fff', 'stroke-width': compact ? 4 : 5, 'stroke-linecap': 'round' }));
    arrows.append(svgEl('path', { d, fill: 'none', stroke: '#1d1d1f', 'stroke-width': compact ? 1.8 : 2.3, 'marker-end': `url(#${id})` }));
  }
  g.append(arrows);
  for (const m of moves) {
    if (m.from === m.to && m.fa === m.fb) {
      dot(m.from, yA(m.from), '#3ddc84', '#0d2b1a', String(m.fa));
      const pin = svgEl('text', { x: x.get(m.from), y: yA(m.from) - r - 3, 'text-anchor': 'middle', 'font-size': r * 1.5 });
      pin.textContent = '📌';
      g.append(pin);
    } else {
      dot(m.from, yA(m.from), da.colour, da.ink, String(m.fa));
      dot(m.to, yB(m.to), db.colour, db.ink, String(m.fb));
    }
  }
  if (names) {
    const used = [...new Set([...A, ...B])];
    for (const n of used) {
      // Names of white keys on the lower line, of black keys on the upper one.
      const y = black(n) ? H + (compact ? 10 : 13) : H + BOTTOM - 3;
      const t = svgEl('text', { x: x.get(n), y, 'text-anchor': 'middle', 'font-size': compact ? 8 : 11, 'font-weight': 700, fill: black(n) ? '#333' : '#555' });
      t.textContent = B.includes(n) ? keyName(n, to) : keyName(n, from);
      g.append(t);
    }
  }
  svg.append(g);
  // The whole hand moves the same way.
  const diffs = moves.map((m) => m.to - m.from);
  if (diffs.every((d) => d === diffs[0]) && diffs[0] !== 0) {
    const left = diffs[0] < 0;
    const x1 = x.get(A[0]);
    const x2 = x.get(B[2]);
    const y = TOP * 0.42;
    const hand = svgEl('text', { x: left ? Math.max(x1, x2) + 4 : Math.min(x1, x2) - 4, y: y + 6, 'text-anchor': left ? 'start' : 'end', 'font-size': compact ? 14 : 18 });
    hand.textContent = '✋';
    svg.append(
      svgEl('path', { d: `M${left ? Math.max(x1, x2) : Math.min(x1, x2)},${y} L${left ? Math.min(x.get(B[0]), x1) : Math.max(x2, x.get(A[2]))},${y}`, stroke: '#1d1d1f', 'stroke-width': compact ? 3 : 4, fill: 'none', 'marker-end': `url(#${id})` }),
      hand,
    );
  }
  return svg;
}

/** The legend of a change diagram: chord A → chord B with their colours, and what the marks mean. */
export function changeLegend({ from, to, key = 'C', a, b }) {
  const chip = (symbol, where) => {
    const d = degreeOf(symbol, key);
    const node = el('span', { className: 'cd-chip' }, [el('i', { textContent: '●' }), ` ${chordName(symbol)} `, el('small', { textContent: where })]);
    node.style.setProperty('--c', d.colour);
    return node;
  };
  const A = [...a].sort((p, q) => p - q);
  const B = [...b].sort((p, q) => p - q);
  const fa = fingers(A);
  const fb = fingers(B);
  const kept = A.filter((n, i) => B[i] === n && fa[i] === fb[i]).length;
  const shared = a.filter((n) => b.includes(n)).length;
  return el('div', { className: 'cd-legend' }, [
    chip(from, 'ara'),
    el('span', { className: 'cd-arrow', textContent: '➜' }),
    chip(to, 'després'),
    kept ? el('span', { className: 'cd-badge pin', textContent: `📌 ${kept} ${kept === 1 ? 'dit quiet' : 'dits quiets'}` }) : null,
    shared > kept ? el('span', { className: 'cd-badge same', textContent: `🟩 ${shared - kept} ${shared - kept === 1 ? 'tecla repetida' : 'tecles repetides'}` }) : null,
  ]);
}

// ---- Printable sheet --------------------------------------------------------------------

/** A small keyboard from F3 to E5 with the given keys marked (finger numbers inside). */
export function keyboardSvg(notes, { labels = [], low = 53, high = 76, shared = [] } = {}) {
  const black = (n) => [1, 3, 6, 8, 10].includes(pitchClass(n));
  const whites = [];
  for (let n = low; n <= high; n++) if (!black(n)) whites.push(n);
  const W = 14;
  const H = 56;
  const svg = svgEl('svg', { viewBox: `0 0 ${whites.length * W} ${H + 2}`, class: 'sheet-keys', 'aria-hidden': 'true' });
  const x = new Map();
  whites.forEach((n, i) => {
    x.set(n, i * W);
    svg.append(svgEl('rect', { x: i * W, y: 0, width: W, height: H, fill: '#fff', stroke: '#555', 'stroke-width': 0.8 }));
  });
  for (let n = low; n <= high; n++) {
    if (!black(n)) continue;
    const left = x.get(n - 1) ?? -W;
    x.set(n, left + W * 0.68);
    svg.append(svgEl('rect', { x: left + W * 0.68, y: 0, width: W * 0.64, height: H * 0.6, fill: '#222' }));
  }
  notes.forEach((n, i) => {
    if (!x.has(n)) return;
    const cx = x.get(n) + (black(n) ? W * 0.32 : W / 2);
    const cy = black(n) ? H * 0.42 : H * 0.8;
    const on = shared.includes(n);
    svg.append(svgEl('circle', { cx, cy, r: 5.6, fill: on ? '#35b36b' : '#ffc012', stroke: '#222', 'stroke-width': 0.8 }));
    if (labels[i] !== undefined) {
      const t = svgEl('text', { x: cx, y: cy + 2.8, 'text-anchor': 'middle', 'font-size': 8, 'font-weight': 700, fill: '#111' });
      t.textContent = String(labels[i]);
      svg.append(t);
    }
  });
  return svg;
}

/** The wheel of a path: the one of its "learn the wheel" world, or of the first world. */
export function mainWheel(path) {
  const world = path.worlds.find((w) => w.missions.some((m) => m.type === 'steps')) ?? path.worlds[0];
  return world.progression.split('|').map((s) => s.trim()).filter(Boolean);
}

const keyLabel = (key) => `${chordName(key.replace(/m$/, ''))} ${key.endsWith('m') ? 'menor' : 'major'}`;

/** A chord cell with the colour of its degree. */
function colourCell(symbol, key, tag = 'span') {
  const d = degreeOf(symbol, key);
  const node = el(tag, { className: 'sheet-deg' }, [el('b', { textContent: chordName(symbol) }), el('i', { textContent: d.label })]);
  node.style.background = d.colour;
  node.style.color = d.ink;
  return node;
}

export function renderSheet({ path, cards, student }) {
  const wheel = mainWheel(path);
  const key = path.key ?? 'C';
  const chords = [...new Set(path.worlds.flatMap((w) => w.missions.filter((m) => m.type === 'chord').map((m) => m.chord)))];
  const structure = path.missions.find((m) => m.type === 'structure');
  const inversions = path.missions.find((m) => m.type === 'invert');
  const cardNames = [...new Set(path.missions.filter((m) => ['pattern', 'mix', 'band', 'song'].includes(m.type)).flatMap((m) => m.cards ?? [m.card]))];
  const cardList = cardNames.map((f) => cards.find((c) => c.filename === f)).filter(Boolean).slice(0, 9);
  const chain = voiceChain(wheel);

  const chordBox = (symbol) => {
    const notes = rootVoicing(symbol);
    const names = triadNoteNames(symbol);
    const chord = parseChord(symbol);
    const third = (chord.triad[1] - chord.root + 12) % 12;
    const fifth = (chord.triad[2] - chord.triad[1] + 12) % 12;
    return el('div', { className: 'sheet-chord' }, [
      colourCell(symbol, key, 'h4'),
      keyboardSvg(notes, { labels: fingers(notes) }),
      el('p', { textContent: `${names.join(' – ')} · ${names[0]} + ${third} + ${fifth} tecles` }),
    ]);
  };

  const changes = wheelChanges(wheel).map(({ from, to }) => {
    const a = chain[wheel.indexOf(from)];
    const b = rootVoicing(to);
    return el('div', { className: 'sheet-change' }, [
      el('div', { className: 'sheet-change-head' }, [colourCell(from, key), el('span', { textContent: '➜' }), colourCell(to, key)]),
      changeDiagram({ from, to, a, b, key, compact: true }),
    ]);
  });

  const invBox = inversions
    ? el('section', {}, [
        el('h3', { textContent: `Inversions de ${chordName(inversions.chord)}` }),
        el('div', { className: 'sheet-inv' }, [0, 1, 2].map((k) => {
          const notes = k === 0 ? rootVoicing(inversions.chord) : inversionVoicing(inversions.chord, k, rootVoicing(inversions.chord)[0] + 1);
          return el('div', { className: 'sheet-chord small' }, [
            el('h4', { textContent: ['Normal', '1a inversió', '2a inversió'][k] }),
            keyboardSvg(notes, { labels: fingers(notes) }),
            el('p', { textContent: notes.map((n) => keyName(n, inversions.chord)).join(' – ') }),
          ]);
        })),
        el('p', { className: 'sheet-hint', textContent: 'Per invertir: la nota de baix puja una octava.' }),
      ])
    : null;

  return el('div', { className: 'print-sheet' }, [
    el('header', {}, [
      el('div', { className: 'sheet-brand' }, [
        el('img', { src: 'assets/brand/rockin-logo.png', alt: 'ROCKIN' }),
        el('div', {}, [
          el('small', { textContent: path.spec?.book ? `Llibre ROCKIN · ${path.spec.artist}` : 'Fitxa del camí' }),
          el('h2', { textContent: path.title }),
          path.spec ? el('small', { textContent: `Tonalitat: ${keyLabel(path.key)} · ${path.spec.tempo} bpm${path.spec.order ? ` · ${path.spec.order.join(' – ')}` : ''}` }) : null,
        ]),
      ]),
      el('div', { className: 'sheet-name', textContent: `Nom: ${student ?? '________________________'}` }),
    ]),
    el('div', { className: 'sheet-grid' }, [
      el('div', { className: 'sheet-col' }, [
        el('section', {}, [
          el('h3', { textContent: 'La roda' }),
          el('div', { className: 'sheet-wheel' }, wheel.map((c) => colourCell(c, key))),
          structure
            ? el('div', { className: 'sheet-structure' }, [
                ...structure.sections.map((sec) =>
                  el('div', { className: 'sheet-part' }, [el('b', { textContent: `${sec.name}` }), el('span', {}, sec.progression.split('|').map((x) => colourCell(x.trim(), key)))]),
                ),
                el('div', {}, [el('b', { textContent: 'Ordre: ' }), el('span', { textContent: structure.order.map((i) => structure.sections[i].name).join(' → ') })]),
              ])
            : null,
        ]),
        cardList.length
          ? el('section', {}, [
              el('h3', { textContent: 'Les cartes' }),
              el('div', { className: 'sheet-cards' }, cardList.map((c) => el('img', { src: c.src, alt: '' }))),
              el('p', { className: 'sheet-hint', textContent: 'Blava: toca · blanca: silenci · barra: mantén la tecla.' }),
            ])
          : null,
        el('section', {}, [
          el('h3', { textContent: 'Abans de tocar amb el grup' }),
          el('ul', { className: 'sheet-check' }, [
            'Construeixo cada acord comptant tecles.',
            'Faig els canvis sense mirar el teclat.',
            'Segueixo les cartes sense aturar-me.',
            'Si m\'equivoco, torno a entrar a la carta següent.',
            'Començo i acabo alhora amb el grup.',
          ].map((t) => el('li', { textContent: t }))),
        ]),
      ]),
      el('section', { className: 'sheet-col' }, [
        el('h3', { textContent: 'Els acords' }),
        el('div', { className: 'sheet-chords' }, chords.map(chordBox)),
        el('p', { className: 'sheet-hint', textContent: 'Major: salta 4 tecles i després 3. Menor (m): 3 i després 4. Compta blanques i negres. Els números són els dits.' }),
      ]),
      el('div', { className: 'sheet-col' }, [
        el('section', {}, [
          el('h3', { textContent: 'Els canvis' }),
          el('div', { className: 'sheet-changes' }, changes),
          el('p', { className: 'sheet-hint', textContent: 'Número = dit · fletxa = on va el dit · 📌 = el dit no es mou · verd = tecla dels dos acords.' }),
        ]),
        invBox,
      ]),
    ]),
  ]);
}
