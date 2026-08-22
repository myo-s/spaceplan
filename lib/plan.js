/**
 * SPACE PLAN — plan geometry + units.
 *
 * SAME ONE RULE AS lib/furniture.js: every number here is real centimetres.
 * The room is stored in cm, the furniture is stored in cm, so "does it fit?"
 * is a comparison and never a conversion. Feet and inches exist only at the
 * moment a number is shown to a person or typed by one.
 *
 * A home is ONE canvas. A room is an axis-aligned rectangle placed on it, so a
 * flat is drawn the way people actually describe one — this room here, the
 * next one against that wall. Rooms that touch share a wall automatically,
 * because a wall is drawn by STROKING the room rectangle: two rooms sharing an
 * edge stroke the same line twice and it reads as one wall of one thickness.
 * No boolean geometry, no wall objects, nothing to keep in sync.
 *
 * Coordinates match lib/furniture.js `top`: origin top-left, x right, y down.
 * A furniture top view can be dropped straight in with only its own translate.
 */

export const INK = "#272829";

/** Wall thickness, cm. Drawn centred on the room boundary. */
export const WALL = 11;

/** Floor grid, cm. One square is half a metre. */
export const GRID = 50;

/** Nothing smaller than this is a room. */
export const MIN_SIDE = 70;

/** How close two edges must be before they click together, in cm. */
export const SNAP_TOL = 32;

/* ------------------------------------------------------------------ units */

export function snapStep(unit) {
  return unit === "cm" ? 5 : 2.54;
}

export function nudgeStep(unit) {
  return unit === "cm" ? 10 : 2.54;
}

export function snap(cm, unit) {
  const s = snapStep(unit);
  return Math.round(cm / s) * s;
}

/** "420 cm" / "13′ 9″" — for captions and readouts. */
export function fmtLen(cm, unit) {
  if (unit === "cm") return `${Math.round(cm)} cm`;
  return ftIn(cm, " ");
}

/** "420" / "13′9″" — for labels, where space is tight. */
export function fmtLenShort(cm, unit) {
  if (unit === "cm") return `${Math.round(cm)}`;
  return ftIn(cm, "");
}

/** "420" / "13' 9"" — the editable form that goes into a text input. */
export function inputLen(cm, unit) {
  if (unit === "cm") return String(Math.round(cm));
  const inch = Math.round(cm / 2.54);
  const ft = Math.floor(inch / 12);
  const i = inch - ft * 12;
  return i ? `${ft}' ${i}"` : `${ft}'`;
}

function ftIn(cm, gap) {
  const inch = Math.round(cm / 2.54);
  const ft = Math.floor(inch / 12);
  const i = inch - ft * 12;
  return i ? `${ft}′${gap}${i}″` : `${ft}′`;
}

/**
 * Accepts what people actually type. In imperial a bare number means FEET,
 * because that is what someone writing down a room says.
 *   cm mode : "420"
 *   ft mode : "13' 9\""  "13'9"  "13.75"  "165\""
 */
export function parseLen(str, unit) {
  if (str == null) return NaN;
  const s = String(str).trim().replace(/[″”]/g, '"').replace(/[′’]/g, "'");
  if (!s) return NaN;
  if (unit === "cm") {
    const v = parseFloat(s);
    return isFinite(v) ? v : NaN;
  }
  const both = s.match(/^(-?[\d.]+)\s*'\s*(?:([\d.]+)\s*"?)?$/);
  if (both) {
    const ft = parseFloat(both[1]);
    const inch = both[2] ? parseFloat(both[2]) : 0;
    return (ft * 12 + inch) * 2.54;
  }
  const inchOnly = s.match(/^(-?[\d.]+)\s*"$/);
  if (inchOnly) return parseFloat(inchOnly[1]) * 2.54;
  const v = parseFloat(s);
  return isFinite(v) ? v * 30.48 : NaN;
}

/** "18.4 m²" / "198 ft²" */
export function fmtArea(cm2, unit) {
  if (unit === "cm") return `${(cm2 / 10000).toFixed(1)} m²`;
  return `${Math.round(cm2 / 929.0304)} ft²`;
}

export function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

/* ------------------------------------------------------------------ rooms */

let seq = 0;
export function uid(prefix = "r") {
  seq += 1;
  return `${prefix}${Date.now().toString(36)}${seq.toString(36)}`;
}

/**
 * A room is a LIST OF RECTANGLES, not one rectangle. Almost every room has
 * exactly one, and then this costs nothing. But an L-shaped living room is two
 * rectangles and a U-shaped one is three — so the shape a real flat actually
 * has is reachable by drawing another box and merging it in, with no polygon
 * editing, no vertex dragging, and no new tool to learn.
 *
 * The wall between two parts of the SAME room is painted back out again
 * (see `innerSeams`), which is what turns two boxes into one L.
 */
export function makeRoom(name, x, y, w, d) {
  return {
    id: uid("room"),
    name,
    parts: [{ x: Math.round(x), y: Math.round(y), w: Math.round(w), d: Math.round(d) }],
    openings: [],
  };
}

export function roomArea(r) {
  return r.parts.reduce((s, p) => s + p.w * p.d, 0);
}

export function homeArea(rooms) {
  return rooms.reduce((s, r) => s + roomArea(r), 0);
}

export function boxOf(rects) {
  if (!rects.length) return { x: 0, y: 0, w: 0, d: 0 };
  const x = Math.min(...rects.map((r) => r.x));
  const y = Math.min(...rects.map((r) => r.y));
  const r2 = Math.max(...rects.map((r) => r.x + r.w));
  const b2 = Math.max(...rects.map((r) => r.y + r.d));
  return { x, y, w: r2 - x, d: b2 - y };
}

export function roomBox(r) {
  return boxOf(r.parts);
}

/** Bounding box of a whole home — used for Fit and for the overall readout. */
export function homeBox(rooms) {
  return boxOf(rooms.flatMap((r) => r.parts));
}

/** Every rectangle on a canvas, optionally minus the one being edited. */
export function allParts(rooms, skip) {
  const out = [];
  rooms.forEach((r) => {
    r.parts.forEach((p, i) => {
      if (skip && skip.roomId === r.id && (skip.partIdx === undefined || skip.partIdx === i)) return;
      out.push(p);
    });
  });
  return out;
}

export function overlaps(a, b) {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.d && b.y < a.y + a.d;
}

/** Would this rectangle land on top of something? Touching is fine. */
export function collides(rect, parts) {
  return parts.some((p) => overlaps(rect, p));
}

/** Do two rectangles share a real stretch of border (not just a corner)? */
export function touches(a, b) {
  const vert =
    (near(a.x + a.w, b.x) || near(b.x + b.w, a.x)) &&
    Math.min(a.y + a.d, b.y + b.d) - Math.max(a.y, b.y) > 1;
  const horiz =
    (near(a.y + a.d, b.y) || near(b.y + b.d, a.y)) &&
    Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x) > 1;
  return vert || horiz;
}

function near(p, q) {
  return Math.abs(p - q) < 1;
}

export function roomsTouch(a, b) {
  return a.parts.some((p) => b.parts.some((q) => touches(p, q)));
}

/**
 * The wall segments that run BETWEEN two parts of the same room — the ones
 * that have to be painted back out so an L reads as one room. Each seam is
 * pulled in by half a wall at both ends, so the junctions where it meets a
 * real wall stay solid and no nick appears at the corner.
 */
export function innerSeams(parts, t) {
  const out = [];
  const half = t / 2;
  for (let i = 0; i < parts.length; i++) {
    for (let j = i + 1; j < parts.length; j++) {
      const a = parts[i];
      const b = parts[j];
      if (near(a.x + a.w, b.x) || near(b.x + b.w, a.x)) {
        const x = near(a.x + a.w, b.x) ? a.x + a.w : b.x + b.w;
        const y1 = Math.max(a.y, b.y) + half;
        const y2 = Math.min(a.y + a.d, b.y + b.d) - half;
        if (y2 > y1) out.push({ x: x - half, y: y1, w: t, d: y2 - y1 });
      }
      if (near(a.y + a.d, b.y) || near(b.y + b.d, a.y)) {
        const y = near(a.y + a.d, b.y) ? a.y + a.d : b.y + b.d;
        const x1 = Math.max(a.x, b.x) + half;
        const x2 = Math.min(a.x + a.w, b.x + b.w) - half;
        if (x2 > x1) out.push({ x: x1, y: y - half, w: x2 - x1, d: t });
      }
    }
  }
  return out;
}

/** Merge B into A: one room, two (or more) boxes, openings carried across. */
export function mergeRooms(a, b) {
  return {
    ...a,
    parts: [...a.parts, ...b.parts],
    openings: [
      ...a.openings,
      ...b.openings.map((o) => ({ ...o, id: uid("op"), part: o.part + a.parts.length })),
    ],
  };
}

/** Break a multi-part room back into one room per box. */
export function splitRoom(r) {
  return r.parts.map((p, i) => ({
    id: i === 0 ? r.id : uid("room"),
    name: i === 0 ? r.name : `${r.name} ${i + 1}`,
    parts: [p],
    openings: r.openings.filter((o) => o.part === i).map((o) => ({ ...o, part: 0 })),
  }));
}

/** Older saves stored one rectangle per room. Bring them forward. */
export function migrateRoom(r) {
  if (r.parts) return r;
  return {
    id: r.id,
    name: r.name,
    parts: [{ x: r.x, y: r.y, w: r.w, d: r.d }],
    openings: (r.openings || []).map((o) => ({ ...o, part: 0 })),
  };
}

/**
 * Click rooms together. Each moving edge looks for a neighbour edge to land
 * on — that is what makes a flat come out square instead of nearly-square.
 * `sides` limits which edges are allowed to snap, so a resize only pulls the
 * edge being dragged.
 */
export function snapRect(rect, others, sides = "all") {
  const xs = [0];
  const ys = [0];
  others.forEach((r) => {
    xs.push(r.x, r.x + r.w);
    ys.push(r.y, r.y + r.d);
  });

  let { x, y, w, d } = rect;
  if (sides === "all") {
    // moving the whole room: slide it, never reshape it
    const dx = closer(nearest(x, xs), nearest(x + w, xs));
    if (dx !== null) x += dx;
    const dy = closer(nearest(y, ys), nearest(y + d, ys));
    if (dy !== null) y += dy;
  } else {
    // resizing or drawing: each live edge finds its own neighbour
    if (sides.includes("l")) { const v = nearest(x, xs); if (v !== null) { x += v; w -= v; } }
    if (sides.includes("r")) { const v = nearest(x + w, xs); if (v !== null) w += v; }
    if (sides.includes("t")) { const v = nearest(y, ys); if (v !== null) { y += v; d -= v; } }
    if (sides.includes("b")) { const v = nearest(y + d, ys); if (v !== null) d += v; }
  }
  return {
    x: Math.round(x),
    y: Math.round(y),
    w: Math.max(MIN_SIDE, Math.round(w)),
    d: Math.max(MIN_SIDE, Math.round(d)),
  };
}

function nearest(v, candidates) {
  let best = null;
  candidates.forEach((c) => {
    const d = c - v;
    if (Math.abs(d) <= SNAP_TOL && (best === null || Math.abs(d) < Math.abs(best))) best = d;
  });
  return best;
}

function closer(a, b) {
  if (a === null) return b;
  if (b === null) return a;
  return Math.abs(a) <= Math.abs(b) ? a : b;
}

/* ------------------------------------------------------------------ walls */

/**
 * The four walls, clockwise from the top, each with its unit tangent and its
 * OUTWARD unit normal. Clockwise winding in a y-down space means (u.y, -u.x)
 * always points out of the room — so nothing has to test which side is which.
 */
export function walls(r) {
  const c = [
    { x: r.x, y: r.y },
    { x: r.x + r.w, y: r.y },
    { x: r.x + r.w, y: r.y + r.d },
    { x: r.x, y: r.y + r.d },
  ];
  return c.map((a, i) => {
    const b = c[(i + 1) % 4];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy) || 1e-6;
    const u = { x: dx / len, y: dy / len };
    return { i, a, b, len, u, n: { x: u.y, y: -u.x } };
  });
}

export const WALL_NAMES = ["Top", "Right", "Bottom", "Left"];

/**
 * Nearest wall to a point, across every box in the room — this is how an
 * opening follows the pointer, including onto a different box of the same
 * L-shaped room.
 */
export function nearestWall(room, x, y) {
  let best = null;
  room.parts.forEach((p, pi) => {
    walls(p).forEach((e) => {
      const t = clamp((x - e.a.x) * e.u.x + (y - e.a.y) * e.u.y, 0, e.len);
      const px = e.a.x + e.u.x * t;
      const py = e.a.y + e.u.y * t;
      const dist = Math.hypot(x - px, y - py);
      if (!best || dist < best.dist) best = { part: pi, wall: e.i, along: t, dist, len: e.len };
    });
  });
  return best;
}

/** Is this wall an inside seam between two boxes of the same room? */
function isSeam(room, partIdx, e) {
  const mx = (e.a.x + e.b.x) / 2 + e.n.x * 2;
  const my = (e.a.y + e.b.y) / 2 + e.n.y * 2;
  return room.parts.some(
    (p, i) => i !== partIdx && mx > p.x && mx < p.x + p.w && my > p.y && my < p.y + p.d
  );
}

/* --------------------------------------------------------------- openings */

export const OPENING_DEFAULT = { door: 85, window: 120 };

/** Put a new opening on the longest wall that actually faces outside. */
export function makeOpening(type, room) {
  let best = null;
  room.parts.forEach((p, pi) => {
    walls(p).forEach((e) => {
      if (isSeam(room, pi, e)) return;
      if (!best || e.len > best.len) best = { part: pi, wall: e.i, len: e.len };
    });
  });
  if (!best) best = { part: 0, wall: 0, len: room.parts[0].w };
  const width = Math.max(30, Math.min(OPENING_DEFAULT[type], best.len - 30));
  return {
    id: uid("op"),
    type,
    part: best.part,
    wall: best.wall,
    width,
    along: (best.len - width) / 2,
    hinge: "a",
    swing: "in",
  };
}

/** Everything needed to draw one door or window, derived fresh from the room. */
export function openingGeom(room, op) {
  const part = room.parts[op.part ?? 0];
  if (!part) return null;
  const e = walls(part)[op.wall];
  if (!e) return null;
  const w = Math.min(op.width, e.len);
  const along = clamp(op.along, 0, e.len - w);
  const A = { x: e.a.x + e.u.x * along, y: e.a.y + e.u.y * along };
  const B = { x: A.x + e.u.x * w, y: A.y + e.u.y * w };
  return { A, B, u: e.u, n: e.n, w, mid: { x: (A.x + B.x) / 2, y: (A.y + B.y) / 2 }, len: e.len, along };
}

/**
 * The rectangle that punches the opening clean through the wall. The wall is
 * stroked centred on the boundary, so the hole is centred on it too — which is
 * what makes a door in a shared wall open into both rooms at once.
 */
export function openingGapPath(g, t) {
  const half = t / 2 + 0.6;
  const ox = g.n.x * half;
  const oy = g.n.y * half;
  return `M${g.A.x - ox} ${g.A.y - oy} L${g.B.x - ox} ${g.B.y - oy} L${g.B.x + ox} ${
    g.B.y + oy
  } L${g.A.x + ox} ${g.A.y + oy} Z`;
}

/**
 * The pane. A window used to be one thin line straight down the middle of the
 * opening — fine at plan scale and completely illegible anywhere else: shrink
 * it and it is a dash, indistinguishable from a wall that simply stops. Drawn
 * instead as the glazing box — the opening outlined at both wall faces — it
 * stays a window at any size, which is what lets the very same mark sit inside
 * the button that places it.
 */
export function windowPanePath(g, t) {
  const half = t / 2;
  const ox = g.n.x * half;
  const oy = g.n.y * half;
  return `M${g.A.x - ox} ${g.A.y - oy} L${g.B.x - ox} ${g.B.y - oy} L${g.B.x + ox} ${
    g.B.y + oy
  } L${g.A.x + ox} ${g.A.y + oy} Z`;
}

/** Leaf + swing arc. One quarter circle is all it takes to read as a plan. */
export function doorSwingPath(g, op) {
  const inward = op.swing !== "out";
  const m = inward ? { x: -g.n.x, y: -g.n.y } : { x: g.n.x, y: g.n.y };
  const hingeA = op.hinge !== "b";
  const hinge = hingeA ? g.A : g.B;
  const other = hingeA ? g.B : g.A;
  const along = hingeA ? g.u : { x: -g.u.x, y: -g.u.y };
  const open = { x: hinge.x + m.x * g.w, y: hinge.y + m.y * g.w };
  const sweep = along.x * m.y - along.y * m.x > 0 ? 1 : 0;
  return {
    leaf: `M${hinge.x} ${hinge.y} L${open.x} ${open.y}`,
    arc: `M${other.x} ${other.y} A${g.w} ${g.w} 0 0 ${sweep} ${open.x} ${open.y}`,
  };
}

/** Keep every opening inside the wall it is on, after any resize. */
export function sanitize(room) {
  return {
    ...room,
    openings: (room.openings || []).map((op) => {
      const part = clamp(op.part ?? 0, 0, room.parts.length - 1);
      const wall = clamp(op.wall, 0, 3);
      const len = walls(room.parts[part])[wall].len;
      const width = clamp(op.width, 30, Math.max(30, len - 10));
      return { ...op, part, wall, width, along: clamp(op.along, 0, Math.max(0, len - width)) };
    }),
  };
}
