/**
 * SPACE PLAN — putting furniture into a plan.
 *
 * SAME ONE RULE AGAIN: centimetres, all the way through. A sofa is 200 wide
 * here for the same reason it is 200 wide in lib/furniture.js, which is why
 * "does it fit" is a comparison and never a conversion.
 *
 * An item stores the top-left of its FOOTPRINT — the axis-aligned box it
 * actually occupies after rotation — not the corner of its artwork. Dragging,
 * snapping and the fit test all want the footprint, and only the drawing wants
 * the artwork, so the drawing is the one that does the extra arithmetic
 * (`artTransform`).
 */

import { FURNITURE } from "./furniture";
import { WALL, clamp, openingGeom, overlaps, uid } from "./plan";

/** How far from a wall an item clicks into place, in cm. */
export const SNAP_TOL = 18;

export function makeItem(key) {
  const f = FURNITURE[key];
  return {
    id: uid("it"),
    key,
    name: f.label,
    w: f.w,
    d: f.d,
    h: f.h,
    rot: 0,
    at: null, // null = owned but not placed yet
  };
}

/** The box this item really occupies, after rotation. */
export function footprint(it) {
  const turned = Math.abs(it.rot % 180) === 90;
  return { w: turned ? it.d : it.w, d: turned ? it.w : it.d };
}

export function itemRect(it, at = it.at) {
  const f = footprint(it);
  return { x: at.x, y: at.y, w: f.w, d: f.d };
}

/**
 * Place the artwork so its ROTATED bounding box lands on the footprint. The
 * transform list reads outside-in: mirror it if asked, scale the drawing to
 * this item's real size, spin it about its own centre, then move it into place.
 *
 * Mirroring matters far more than it sounds: an L-shaped sofa opens to the left
 * or to the right, and rotating it four times never produces the other hand.
 * Flipping costs nothing in the footprint, so nothing else has to know.
 */
export function artTransform(it) {
  const base = FURNITURE[it.key];
  const sx = it.w / base.w;
  const sy = it.d / base.d;
  const turned = Math.abs(it.rot % 180) === 90;
  const tx = it.at.x - (turned ? (it.w - it.d) / 2 : 0);
  const ty = it.at.y - (turned ? (it.d - it.w) / 2 : 0);
  const shape = it.flip
    ? `translate(${it.w} 0) scale(${-sx} ${sy})`
    : `scale(${sx} ${sy})`;
  return `translate(${tx} ${ty}) rotate(${it.rot} ${it.w / 2} ${it.d / 2}) ${shape}`;
}

/* ------------------------------------------------------------------- fit */

/** The walkable inside of a room box: the floor minus half a wall all round. */
export function innerParts(rooms) {
  return rooms.flatMap((r) =>
    r.parts.map((p) => ({
      x: p.x + WALL / 2,
      y: p.y + WALL / 2,
      w: p.w - WALL,
      d: p.d - WALL,
    }))
  );
}

function inAny(x, y, parts) {
  return parts.some((p) => x >= p.x - 0.5 && x <= p.x + p.w + 0.5 && y >= p.y - 0.5 && y <= p.y + p.d + 0.5);
}

/**
 * Is this footprint standing entirely on floor? Sampled at nine points rather
 * than solved exactly, because rooms are a union of boxes and the nine points
 * catch every case that matters — including a sofa laid across a doorway,
 * where the corners are in two rooms but the middle is in the wall.
 */
export function onFloor(rect, rooms) {
  const parts = innerParts(rooms);
  if (!parts.length) return false;
  const e = 1.5;
  const xs = [rect.x + e, rect.x + rect.w / 2, rect.x + rect.w - e];
  const ys = [rect.y + e, rect.y + rect.d / 2, rect.y + rect.d - e];
  return xs.every((x) => ys.every((y) => inAny(x, y, parts)));
}

function closestPointOnRect(rect, p) {
  return {
    x: Math.max(rect.x, Math.min(p.x, rect.x + rect.w)),
    y: Math.max(rect.y, Math.min(p.y, rect.y + rect.d)),
  };
}

/**
 * Doors that this footprint would stop from opening. Tested as the swing disc
 * cut by the two half-planes that bound the quarter circle — the honest shape.
 * Its bounding box would condemn a chair standing in the far corner.
 */
export function blockedDoors(rect, rooms) {
  const hits = [];
  rooms.forEach((r) => {
    r.openings.forEach((op) => {
      if (op.type !== "door") return;
      const g = openingGeom(r, op);
      if (!g) return;
      const inward = op.swing !== "out";
      const m = inward ? { x: -g.n.x, y: -g.n.y } : { x: g.n.x, y: g.n.y };
      const hingeA = op.hinge !== "b";
      const hinge = hingeA ? g.A : g.B;
      const along = hingeA ? g.u : { x: -g.u.x, y: -g.u.y };
      const p = closestPointOnRect(rect, hinge);
      const dx = p.x - hinge.x;
      const dy = p.y - hinge.y;
      if (Math.hypot(dx, dy) >= g.w) return;          // outside the swing radius
      if (dx * m.x + dy * m.y < -1) return;           // the far side of the wall
      if (dx * along.x + dy * along.y < -1) return;   // behind the hinge
      hits.push({ room: r, opening: op });
    });
  });
  return hits;
}

export function hitsFurniture(rect, items, ignoreId) {
  return items.some((o) => o.at && o.id !== ignoreId && overlaps(rect, itemRect(o)));
}

/** Everything wrong with where this item is standing, in plain words. */
export function itemIssue(it, rooms, items) {
  if (!it.at) return "unplaced";
  const rect = itemRect(it);
  if (!onFloor(rect, rooms)) return "outside";
  if (hitsFurniture(rect, items, it.id)) return "overlap";
  return null;
}

export const ISSUE_TEXT = {
  unplaced: "Not in the plan",
  outside: "Over a wall",
  overlap: "On top of something",
};

/* --------------------------------------------------------------- snapping */

/**
 * Click furniture against walls and against other furniture. Pushing a sofa
 * until it touches the wall is the single most common thing anyone does with a
 * plan, so it should not require precision.
 */
export function snapItem(rect, rooms, items, ignoreId) {
  const xs = [];
  const ys = [];
  innerParts(rooms).forEach((p) => {
    xs.push(p.x, p.x + p.w);
    ys.push(p.y, p.y + p.d);
  });
  items.forEach((o) => {
    if (!o.at || o.id === ignoreId) return;
    const r = itemRect(o);
    xs.push(r.x, r.x + r.w);
    ys.push(r.y, r.y + r.d);
  });

  let { x, y } = rect;
  const dx = closer(nearest(x, xs), nearest(x + rect.w, xs));
  if (dx !== null) x += dx;
  const dy = closer(nearest(y, ys), nearest(y + rect.d, ys));
  if (dy !== null) y += dy;
  return { x: Math.round(x), y: Math.round(y) };
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

/* ------------------------------------------------------------- auto place */

/**
 * Somewhere sensible to drop a newly added piece. Tries the largest room
 * first and walks a coarse grid; returns null when the thing simply will not
 * go anywhere, which is itself the answer the app exists to give.
 */
export function findSpot(it, rooms, items) {
  const f = footprint(it);
  const boxes = rooms
    .flatMap((r) => r.parts)
    .slice()
    .sort((a, b) => b.w * b.d - a.w * a.d);
  const STEP = 10;
  for (const p of boxes) {
    for (let y = p.y + WALL / 2; y + f.d <= p.y + p.d - WALL / 2 + 0.5; y += STEP) {
      for (let x = p.x + WALL / 2; x + f.w <= p.x + p.w - WALL / 2 + 0.5; x += STEP) {
        const rect = { x: Math.round(x), y: Math.round(y), w: f.w, d: f.d };
        if (onFloor(rect, rooms) && !hitsFurniture(rect, items) && !blockedDoors(rect, rooms).length)
          return { x: rect.x, y: rect.y };
      }
    }
  }
  return null;
}

/** Turn 90° about the centre, so a sofa spins where it stands. */
export function rotated(it) {
  const before = footprint(it);
  const rot = (it.rot + 90) % 360;
  const next = { ...it, rot };
  const after = footprint(next);
  if (!it.at) return next;
  return {
    ...next,
    at: {
      x: Math.round(it.at.x + (before.w - after.w) / 2),
      y: Math.round(it.at.y + (before.d - after.d) / 2),
    },
  };
}

export function tally(items, rooms) {
  let placed = 0;
  let trouble = 0;
  items.forEach((it) => {
    const issue = itemIssue(it, rooms, items);
    if (!issue) placed += 1;
    else trouble += 1;
  });
  return { total: items.length, placed, trouble };
}

export { clamp };
