/**
 * SPACE PLAN — the answer.
 *
 * This is the file the whole app exists for. Everything before it is drawing;
 * this is the part that tells someone their sofa is not coming with them.
 *
 * It draws ONE distinction above all others, because it is the distinction
 * that changes what a person does next:
 *
 *   NEVER — the piece is too big for every room in the new place, at every
 *           rotation. No amount of rearranging helps. This is a decision to
 *           make, not a puzzle to solve. It is the sell/toss pile.
 *   MOVE  — the piece would fit; it is simply in the wrong spot right now, or
 *           has not been put down yet. This is a puzzle, and the app should
 *           help solve it rather than pass judgement.
 *   FITS  — standing on the floor, clear of the furniture, clear of the doors.
 *
 * Lumping those together as "doesn't fit" would be the easy thing and the
 * wrong thing: it would tell someone to sell a bookshelf that just needs
 * sliding two feet to the left.
 *
 * Every reason comes back in CENTIMETRES, because "22 cm too wide" is
 * actionable and "doesn't fit" is not.
 */

import { WALL, openingGeom } from "./plan";
import { blockedDoors, hitsFurniture, itemRect, onFloor } from "./furnish";

export { blockedDoors };

/* ------------------------------------------------------------ raw geometry */

/**
 * Could this piece stand in this box at all, in either orientation? The room
 * is measured wall face to wall face, which is the number a tape measure gives
 * you and the number the piece actually has to beat.
 */
function fitsBox(it, box) {
  const straight = it.w <= box.w + 0.5 && it.d <= box.d + 0.5;
  const turned = it.d <= box.w + 0.5 && it.w <= box.d + 0.5;
  if (straight) return { ok: true, turned: false };
  if (turned) return { ok: true, turned: true };
  return { ok: false };
}

/** How much too big, in the kinder of the two orientations. */
function shortfall(it, box) {
  const options = [
    { w: it.w, d: it.d, turned: false },
    { w: it.d, d: it.w, turned: true },
  ].map((o) => ({
    ...o,
    over: Math.max(0, o.w - box.w) + Math.max(0, o.d - box.d),
    overW: Math.max(0, o.w - box.w),
    overD: Math.max(0, o.d - box.d),
  }));
  return options.reduce((m, o) => (o.over < m.over ? o : m));
}

/**
 * The best room for this piece, and by how much it misses if it misses. Rooms
 * made of several boxes are measured box by box: an L-shaped room cannot take
 * a sofa longer than its longest arm, whatever its total area says.
 */
export function bestRoom(it, rooms) {
  let best = null;
  rooms.forEach((r) => {
    r.parts.forEach((p) => {
      const box = { w: p.w - WALL, d: p.d - WALL };
      const fit = fitsBox(it, box);
      const miss = shortfall(it, box);
      const cand = { room: r, box, fits: fit.ok, turned: fit.ok ? fit.turned : miss.turned, miss };
      if (!best) best = cand;
      else if (cand.fits && !best.fits) best = cand;
      else if (cand.fits === best.fits && cand.miss.over < best.miss.over) best = cand;
    });
  });
  return best;
}

export function fitsAnywhere(it, rooms) {
  const b = bestRoom(it, rooms);
  return !!b && b.fits;
}

/* --------------------------------------------------------- door clearance */

/** Assumed clear height of an interior door. Rooms do not store this yet. */
export const DOOR_HEIGHT = 198;

/**
 * Will it even get in?
 *
 * The naive test — is the footprint wider than the door — is WRONG, and wrong
 * in the expensive direction: it tells you to sell a sofa that any two people
 * could carry in on its side. Movers do not push furniture through flat; they
 * turn it so its longest axis goes through the opening lengthways, which means
 * the cross-section presented to the door is the OTHER TWO dimensions.
 *
 * So sort width, depth and height. The smallest has to clear the door's width
 * and the middle one has to clear its height; the largest never matters,
 * because that is the axis pointing down the hallway. A 200 × 88 × 80 sofa
 * goes through an 85 cm door on its side. A 100 × 100 × 120 piano does not go
 * through anything, at any angle.
 *
 * The widest door in the place is used, because if it will not go through the
 * friendliest door it will not go through any of them.
 */
export function tooWideForDoors(it, rooms) {
  const widths = rooms.flatMap((r) =>
    r.openings.filter((o) => o.type === "door").map((o) => openingGeom(r, o)?.w || 0)
  );
  if (!widths.length) return null;
  const widest = Math.max(...widths);
  const [slim, mid] = [it.w, it.d, it.h].sort((a, b) => a - b);
  if (slim <= widest + 0.5 && mid <= DOOR_HEIGHT + 0.5) return null;
  return { need: slim, have: widest, mid, tooTall: mid > DOOR_HEIGHT + 0.5 };
}

/* ------------------------------------------------------------- the verdict */

export const NEVER = "never";
export const MOVE = "move";
export const FITS = "fits";

/**
 * One piece, one verdict, with the numbers behind it.
 * `why` is a short sentence a person can act on; `kind` is what the UI groups by.
 */
export function judge(it, rooms, items) {
  const best = bestRoom(it, rooms);
  const doorway = tooWideForDoors(it, rooms);

  if (!best) {
    return { kind: NEVER, code: "noroom", why: "There are no rooms in the new place yet." };
  }

  if (!best.fits) {
    const m = best.miss;
    const parts = [];
    if (m.overW > 0) parts.push(`${Math.round(m.overW)} cm too wide`);
    if (m.overD > 0) parts.push(`${Math.round(m.overD)} cm too deep`);
    return {
      kind: NEVER,
      code: "toobig",
      room: best.room,
      why: `${parts.join(" and ")} for the biggest room it could go in.`,
      need: { w: m.w, d: m.d },
      have: best.box,
    };
  }

  if (doorway) {
    return {
      kind: NEVER,
      code: "doorway",
      why: doorway.tooTall
        ? `Turned on its side it is still ${Math.round(doorway.mid)} cm tall, and a door is about ${DOOR_HEIGHT} cm. It will not go through.`
        : `Even on its side it is ${Math.round(doorway.need)} cm across, and the widest door is ${Math.round(
            doorway.have
          )} cm. It will not get in the building.`,
      need: { w: doorway.tooTall ? doorway.mid : doorway.need, d: 0 },
      have: { w: doorway.tooTall ? DOOR_HEIGHT : doorway.have, d: 0 },
    };
  }

  if (!it.at) {
    return {
      kind: MOVE,
      code: "unplaced",
      room: best.room,
      why: `Not put down yet. It would go in ${best.room.name}${best.turned ? ", turned sideways" : ""}.`,
    };
  }

  const rect = itemRect(it);
  if (!onFloor(rect, rooms)) {
    return { kind: MOVE, code: "wall", room: best.room, why: `Standing over a wall. It fits in ${best.room.name}.` };
  }
  if (hitsFurniture(rect, items, it.id)) {
    return { kind: MOVE, code: "overlap", why: "On top of something else. Move one of them." };
  }
  const doors = blockedDoors(rect, rooms);
  if (doors.length) {
    return { kind: MOVE, code: "door", why: `Blocking a door in ${doors[0].room.name}. The door will not open.` };
  }

  return { kind: FITS, code: "ok", why: "Fits, clear of the walls, the furniture and the doors." };
}

/**
 * `against` is what is really standing in the new place — which is not the
 * same list as `items`. A piece you have decided to sell is off the plan, so
 * it must not go on blocking the space it used to occupy.
 */
export function judgeAll(items, rooms, against = items) {
  const map = new Map();
  items.forEach((it) => map.set(it.id, judge(it, rooms, against)));
  return map;
}

export function summarise(verdicts) {
  const out = { fits: 0, move: 0, never: 0, total: verdicts.size };
  verdicts.forEach((v) => {
    out[v.kind] += 1;
  });
  return out;
}

/** Longest clear run in the new place — the number people actually ask for. */
export function longestWall(rooms) {
  let best = 0;
  rooms.forEach((r) =>
    r.parts.forEach((p) => {
      best = Math.max(best, p.w - WALL, p.d - WALL);
    })
  );
  return best;
}
