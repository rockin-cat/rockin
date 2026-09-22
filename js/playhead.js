// Playhead: a ball that bounces across the card image in time with the music.
// It lands once per pulse on a rhythm card (the circles), or on every point of
// a melodic card. Each note the student has
// to play gets a marker that turns green or red once it has been judged.

const BALL_RADIUS = 11;
const MARKER_COLOURS = { pending: 'rgba(29, 29, 31, 0.3)', hit: '#1f9d55', miss: '#d64545' };

export function createPlayhead(canvas) {
  const ctx = canvas.getContext('2d');

  function clear() {
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    if (canvas.width !== Math.round(width * dpr) || canvas.height !== Math.round(height * dpr)) {
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);
    return { width, height };
  }

  /** `markers` are the evaluator's expected notes for this bar, in card order. */
  /**
   * `marks`: how the bar was played, as in "Juga": { f (fraction of the bar), kind, label, hand }.
   * kind: wrong / extra / offbeat (red X), missed (red ring), incomplete (orange ring),
   * rest (red ~), short (X "mantén!").
   */
  function draw({ position, card, markers, markersLeft = null, marks = [] }) {
    const size = clear();
    if (!card || !size.width) return;
    const { landings, spots } = card.type === 'melodic' ? melodicGeometry(card, size) : rhythmicGeometry(card, size);

    markers.forEach((marker, i) => drawMarker(spots[i], marker.status));
    // Two-hand cards: the left hand's markers go under the orange row.
    if (card.twoHands && markersLeft) {
      const left = rhythmicGeometry({ ...card, ...card.hands.left, twoHands: false }, size).spots;
      markersLeft.forEach((marker, i) => drawMarker(left[i], marker.status));
    }

    if (card.type !== 'melodic') for (const mark of marks) drawMark(card, size, mark);
    else for (const mark of marks) if (mark.index !== undefined && mark.kind !== 'hit') drawMelodicMark(card, size, mark);

    if (position.countIn) {
      // Bounce in place over the first landing, once per count-in pulse.
      const { x, y } = landings[0];
      drawBall({ x, y: y - hopHeight(0.25, size) * Math.sin(Math.PI * position.pulseFraction), groundY: y });
    } else {
      drawBall(ballAt(landings, position.barFraction, size));
    }
  }

  function drawMarker(spot, status) {
    if (!spot) return;
    ctx.beginPath();
    ctx.arc(spot.x, spot.y, spot.r, 0, Math.PI * 2);
    if (spot.ring) {
      if (status === 'pending') return;
      ctx.lineWidth = 4;
      ctx.strokeStyle = MARKER_COLOURS[status];
      ctx.stroke();
    } else if (status === 'pending') {
      ctx.lineWidth = 2;
      ctx.strokeStyle = MARKER_COLOURS.pending;
      ctx.stroke();
    } else {
      ctx.fillStyle = MARKER_COLOURS[status];
      ctx.fill();
    }
  }

  function label(text, x, y, colour) {
    if (!text) return;
    ctx.font = '700 12px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    const w = ctx.measureText(text).width + 8;
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    ctx.fillRect(x - w / 2, y - 1, w, 16);
    ctx.fillStyle = colour;
    ctx.fillText(text, x, y + 1);
  }

  function cross(x, y, size) {
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x - size, y - size);
    ctx.lineTo(x + size, y + size);
    ctx.moveTo(x + size, y - size);
    ctx.lineTo(x - size, y + size);
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 7;
    ctx.stroke();
    ctx.strokeStyle = MARKER_COLOURS.miss;
    ctx.lineWidth = 3.5;
    ctx.stroke();
  }

  function drawMark(card, size, mark) {
    if (mark.kind === 'hit') return; // the green marker says it
    const row = card.twoHands && mark.hand === 'left' ? { ...card, ...card.hands.left, twoHands: false } : card;
    const { cells, y, radius } = row.layout;
    const beats = row.pattern.length;
    const centreY = y * size.height;
    const r = radius * size.width;
    const beatF = Math.max(0, Math.min(beats - 0.001, mark.f * beats));
    const beat = Math.floor(beatF);
    const x0 = cells[beat].x0 * size.width;
    const x1 = cells[beat].x1 * size.width;
    const exact = x0 + (beatF - beat) * (x1 - x0);
    const centre = (x0 + x1) / 2;
    // Labels of the right hand of a two-hand card go above it; the rest below.
    const labelY = card.twoHands && mark.hand !== 'left' ? centreY - r - 34 : centreY + r + 26;
    if (mark.kind === 'missed' || mark.kind === 'incomplete') {
      const colour = mark.kind === 'missed' ? MARKER_COLOURS.miss : '#f08a00';
      ctx.beginPath();
      ctx.arc(centre, centreY, r + 4, 0, Math.PI * 2);
      ctx.lineWidth = 5;
      ctx.strokeStyle = colour;
      ctx.stroke();
      label(mark.label, centre, labelY, colour);
    } else if (mark.kind === 'rest') {
      ctx.font = '900 34px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.lineWidth = 5;
      ctx.strokeStyle = '#fff';
      ctx.strokeText('~', exact, centreY);
      ctx.fillStyle = MARKER_COLOURS.miss;
      ctx.fillText('~', exact, centreY);
      label(mark.label ?? 'aixeca', exact, labelY, MARKER_COLOURS.miss);
    } else {
      cross(exact, centreY, Math.max(7, r * 0.35));
      label(mark.label, exact, labelY, MARKER_COLOURS.miss);
    }
  }

  function drawMelodicMark(card, size, mark) {
    const p = card.layout.points[mark.index];
    if (!p) return;
    const x = p.x * size.width;
    const y = p.y * size.height;
    if (mark.kind === 'missed') {
      ctx.beginPath();
      ctx.arc(x, y, size.width * 0.03, 0, Math.PI * 2);
      ctx.lineWidth = 4;
      ctx.strokeStyle = MARKER_COLOURS.miss;
      ctx.stroke();
    } else {
      cross(x, y, 8);
      label(mark.label, x, y + 16, MARKER_COLOURS.miss);
    }
  }

  function drawBall({ x, y, groundY }) {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.12)';
    ctx.beginPath();
    ctx.ellipse(x, groundY + BALL_RADIUS, BALL_RADIUS, BALL_RADIUS * 0.35, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    ctx.arc(x, y, BALL_RADIUS, 0, Math.PI * 2);
    ctx.fillStyle = '#ffb400';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#1d1d1f';
    ctx.stroke();
  }

  return { draw, clear };
}

// Landings: where (x, y) and when (f = fraction of the bar) the ball touches
// down. Spots: where the marker for each expected note is drawn.

function rhythmicGeometry(card, { width, height }) {
  const { cells, y, radius } = card.layout;
  const centreY = y * height;
  const r = radius * width;
  // Two-hand cards: the pulse markers go above the blue row (below it is the orange row), and the ball above them.
  const above = Boolean(card.twoHands);
  const markerY = above ? centreY - r - 12 : centreY + r + 16;
  const ground = (above ? markerY - 8 : centreY - r) - BALL_RADIUS - 4;
  const beats = card.pattern.length;
  const landings = [];
  const spots = [];
  // The ball lands on the centre of each circle, once per pulse.
  card.pattern.forEach((slices, beat) => {
    const x0 = cells[beat].x0 * width;
    const x1 = cells[beat].x1 * width;
    landings.push({ f: beat / beats, x: (x0 + x1) / 2, y: ground });
    const sliceWidth = (x1 - x0) / slices.length;
    slices.forEach((value, unit) => {
      if (value === 1) spots.push({ x: x0 + (unit + 0.5) * sliceWidth, y: markerY, r: 6 });
    });
  });
  landings.push({ f: 1, x: cells.at(-1).x1 * width, y: ground });
  return { landings, spots };
}

function melodicGeometry(card, { width, height }) {
  const ring = width * 0.022;
  const points = card.layout.points.map((p) => ({ x: p.x * width, y: p.y * height }));
  const landings = points.map((p, i) => ({ f: i / points.length, x: p.x, y: p.y - ring - BALL_RADIUS - 2 }));
  landings.push({ ...landings.at(-1), f: 1 });
  const spots = points.map((p) => ({ ...p, r: ring + 6, ring: true }));
  return { landings, spots };
}

// Longer notes get higher hops.
const hopHeight = (barFraction, { width }) => width * Math.min(0.12, 0.03 + 0.3 * barFraction);

function ballAt(landings, f, size) {
  let i = 0;
  while (i < landings.length - 2 && landings[i + 1].f <= f) i++;
  const a = landings[i];
  const b = landings[i + 1];
  const s = Math.min(1, Math.max(0, (f - a.f) / (b.f - a.f)));
  const groundY = a.y + (b.y - a.y) * s;
  return { x: a.x + (b.x - a.x) * s, y: groundY - hopHeight(b.f - a.f, size) * Math.sin(Math.PI * s), groundY };
}
