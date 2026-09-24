// The shared library of the ROCKIN diagram generator
// (https://rockin-cat.github.io/Generador-diagrames/): songs that teachers share
// there, kept in a Google Drive folder behind a small Apps Script. This module
// talks to that script and turns a generator song into a path of the game.
//
// The script answers, with the teachers' code:
//   GET  ?codi=…          -> { ok, llista: [{ id, nom, data, titol, artista, autor, nivell, instruments }] }
//   GET  ?codi=…&id=…     -> { ok, canco: { titol, artista, acords, estructura: { to, mode, temps, estil, tempo, ordre, parts: [{ nom, acords, compassos }] }, items } }
// and { ok: false, error: 'codi' | 'no-trobada' | 'format' } when something is wrong.

import { parseChord } from './theory.js';

// The same web app the generator uses (Implementa → Aplicació web).
export const LIBRARY_URL = 'https://script.google.com/macros/s/AKfycbw2lhxNhxvT2EJGhQhpFlOAhT3M_RIrqN_tDQS0oChLULzyeX5dOP_HZLehm6SfXeWS/exec';
const CODE_KEY = 'rockin.play.biblio.codi';

export const LEVEL_COLOURS = { 0: '#2f9e44', 1: '#f08c00', 2: '#c92a2a' };

export function savedCode() {
  try {
    return localStorage.getItem(CODE_KEY) ?? '';
  } catch {
    return '';
  }
}

export function saveCode(code) {
  try {
    if (code) localStorage.setItem(CODE_KEY, code);
    else localStorage.removeItem(CODE_KEY);
  } catch {
    // private mode: the code is asked again next time
  }
}

async function ask(params) {
  const q = new URLSearchParams(params);
  let response;
  try {
    response = await fetch(`${LIBRARY_URL}?${q}`);
  } catch {
    throw new Error('xarxa');
  }
  let json;
  try {
    json = await response.json();
  } catch {
    throw new Error('xarxa');
  }
  if (!json.ok) {
    if (json.error === 'codi') saveCode('');
    throw new Error(json.error || 'error');
  }
  return json;
}

/** Every song shared in the library, newest first. */
export async function listLibrary(code) {
  const json = await ask({ codi: code });
  return (json.llista ?? []).slice().sort((a, b) => String(b.data).localeCompare(String(a.data)));
}

/** One song, as the generator saved it. */
export async function loadLibrarySong(code, id) {
  const json = await ask({ codi: code, id });
  return json.canco;
}

export function errorText(error) {
  return {
    codi: 'El codi del professorat no és correcte.',
    'sense-codi': 'Cal el codi del professorat per obrir la biblioteca.',
    'no-trobada': 'Aquesta cançó ja no és a la biblioteca.',
    format: 'Aquesta cançó no té acords que el joc pugui tocar.',
    xarxa: 'No s\'ha pogut connectar amb la biblioteca. Comprova la connexió a internet.',
  }[error?.message] ?? 'No s\'ha pogut obrir la biblioteca.';
}

// ---- From a generator song to a path spec ------------------------------------------------------------------

const NOTES_SHARP = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

/** A chord as the generator writes it ("D-", "F#m", "A5", "Bº") to what the game reads. */
export function gameChord(text) {
  const m = /^([A-Ga-g])([#b♯♭]?)(.*)$/.exec(String(text ?? '').trim());
  if (!m) return null;
  const letter = m[1].toUpperCase();
  const accidental = m[2] === '♯' ? '#' : m[2] === '♭' ? 'b' : m[2];
  const rest = m[3].trim();
  let suffix = '';
  if (/^(°|º|o|dim)/.test(rest)) suffix = 'dim';
  else if (/^(-|m(?!aj)|min)/.test(rest)) suffix = /7/.test(rest) ? 'm7' : 'm';
  else if (/^5/.test(rest)) suffix = ''; // a power chord: the game plays the triad
  else if (/^(maj7|M7|Δ)/.test(rest)) suffix = 'maj7';
  else if (/^7/.test(rest)) suffix = '7';
  else if (/^sus2/.test(rest)) suffix = 'sus2';
  else if (/^sus/.test(rest)) suffix = 'sus4';
  const symbol = `${letter}${accidental}${suffix}`;
  try {
    parseChord(symbol);
    return symbol;
  } catch {
    return null;
  }
}

/** The chord that fills most of a generator bar ({ div, cells }); the first one on a tie. */
function barChord(bar) {
  const cells = Array.isArray(bar?.cells) ? bar.cells : [];
  const count = new Map();
  for (const c of cells) {
    const symbol = gameChord(c);
    if (symbol) count.set(symbol, (count.get(symbol) ?? 0) + 1);
  }
  let best = null;
  for (const [symbol, n] of count) if (!best || n > best.n) best = { symbol, n };
  return best?.symbol ?? null;
}

/** "C | G Am | F" or "C G Am F" (the generator's chord text) -> one chord per bar. */
function barsFromText(text) {
  const out = [];
  for (const chunk of String(text ?? '').split('|')) {
    const tokens = chunk.split(/[\s,]+/).filter((t) => t && t !== '.' && t !== '_');
    const chords = tokens.map(gameChord).filter(Boolean);
    if (chords.length) out.push(chords[0]);
  }
  return out;
}

const STYLE_WORDS = [
  ['reggaeton', 'reggaeton'], ['dembow', 'reggaeton'], ['trap', 'hiphop'], ['hip', 'hiphop'], ['rap', 'hiphop'],
  ['reggae', 'reggae'], ['ska', 'ska'], ['rumba', 'rumba'], ['cumbia', 'cumbia'], ['cúmbia', 'cumbia'],
  ['bossa', 'bossa'], ['samba', 'bossa'], ['swing', 'swing'], ['jazz', 'swing'], ['blues', 'shuffle'], ['shuffle', 'shuffle'],
  ['funk', 'funk'], ['soul', 'funk'], ['disco', 'funk'], ['vals', 'vals'], ['waltz', 'vals'],
  ['balada', 'ballad'], ['ballad', 'ballad'], ['lent', 'ballad'], ['slow', 'ballad'],
];

/** The game's style for the free text of the generator ("Reggae", "Pop lent"…); null when none matches. */
export function gameStyle(text) {
  const t = String(text ?? '').toLowerCase();
  for (const [word, id] of STYLE_WORDS) if (t.includes(word)) return id;
  return null;
}

/** The generator's part name as the game shows it: "PART A" -> "A", "tornada" -> "Tornada". */
function shortName(name) {
  const m = /^PART\s+(.+)$/i.exec(String(name ?? ''));
  if (m) return m[1].toUpperCase();
  const n = String(name ?? '').trim();
  return n ? n.charAt(0).toUpperCase() + n.slice(1) : 'A';
}

/**
 * A path spec (as `buildPath` wants it) from a generator song. `entry` is the
 * library list item (id, titol, artista, autor, nivell). Throws 'format' when
 * there is nothing to play.
 */
export function specFromLibrary(song, entry) {
  const est = song?.estructura ?? {};
  const beats = parseInt(est.temps, 10) || 4;
  // 2/4 is played as 4/4 (one chord per bar either way).
  const meter = beats === 3 ? '3/4' : beats === 6 ? '6/8' : '4/4';
  const notes = [];
  const parts = {};
  const order = [];
  for (const part of est.parts ?? []) {
    const bars = Array.isArray(part.compassos) && part.compassos.length
      ? part.compassos.map(barChord).filter(Boolean)
      : barsFromText(part.acords);
    if (!bars.length) continue;
    let name = shortName(part.nom);
    let k = 2;
    while (parts[name]) name = `${shortName(part.nom)} ${k++}`;
    parts[name] = bars.join(' | ');
    if ((part.compassos ?? []).some((b) => new Set((b.cells ?? []).map(gameChord).filter(Boolean)).size > 1)) notes.push('split');
  }
  const names = Object.keys(parts);
  if (names.length) {
    const wanted = String(est.ordre ?? '').split(/[–\-–—>,]+/).map((s) => s.trim()).filter(Boolean);
    for (const w of wanted) {
      const hit = names.find((n) => n.toLowerCase() === w.toLowerCase()) ?? names.find((n) => n.toLowerCase().startsWith(w.toLowerCase()));
      if (hit) order.push(hit);
    }
    if (!order.length) order.push(...names);
  }
  let progression;
  if (names.length) {
    const main = parts[order.find((n) => !/^intro/i.test(n)) ?? order[0]];
    const bars = main.split('|').map((s) => s.trim());
    progression = bars.slice(0, Math.min(bars.length, 4)).join(' | ');
  } else {
    const chords = String(song?.acords ?? '').split(/[\s,\/|]+/).map(gameChord).filter(Boolean);
    if (!chords.length) throw new Error('format');
    progression = chords.slice(0, 4).join(' | ');
  }
  const tonic = NOTES_SHARP.includes(est.to) ? est.to : null;
  const key = tonic ? `${tonic}${est.mode === 'menor' ? 'm' : ''}` : undefined;
  const tempo = Math.max(40, Math.min(220, parseInt(est.tempo, 10) || 100));
  const matched = gameStyle(est.estil);
  const style = matched ?? (meter === '3/4' ? 'vals' : 'rock');
  const noteText = [
    notes.includes('split') ? 'Als compassos amb dos acords, el joc hi toca el que dura més.' : '',
    beats === 2 ? 'La cançó és en 2/4: aquí es toca en 4/4, un acord per compàs.' : '',
    est.estil && !matched ? `A la biblioteca l'estil és «${est.estil}»; aquí la banda el toca com a ${style === 'vals' ? 'vals' : 'rock'}.` : '',
  ].filter(Boolean).join(' ');
  return {
    id: `biblio:${entry.id}`,
    library: { id: entry.id, autor: entry.autor ?? '', nivell: entry.nivell ?? '', data: entry.data ?? '' },
    name: song?.titol || entry.titol || entry.nom || 'Cançó de la biblioteca',
    artist: song?.artista || entry.artista || '',
    key,
    progression,
    chorus: '',
    parts: names.length ? parts : undefined,
    order: names.length ? order : undefined,
    note: noteText,
    meter,
    style,
    tempo,
    readCards: false,
  };
}
