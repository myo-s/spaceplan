"use client";

/**
 * SPACE PLAN — Moving In, step 01: the rooms.
 *
 * ONE CANVAS PER HOME. You drag out a room, then drag out the next one beside
 * it, and the flat assembles itself. Edges click together (lib/plan.js
 * `snapRect`) so rooms that touch really do touch, and because a wall is drawn
 * by STROKING the room rectangle, two rooms sharing an edge stroke the same
 * line twice and it reads as a single wall.
 *
 * L AND U SHAPED ROOMS come from the same one gesture: draw a second box
 * against the first and press Merge. A room is a LIST of boxes, and the wall
 * between two boxes of the SAME room is painted back out (`innerSeams`), so an
 * L is genuinely one room — one name, one area, one thing to furnish. No
 * polygon editing, no vertices, nothing new to learn.
 *
 * ONE SCALE, ONE VIEW. Both canvases share a single viewBox, so zooming or
 * panning moves both together and the two homes stay strictly comparable.
 * "The new place is smaller" is something you see, not something you work out.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import RoomLayer, { PLAN_CSS } from "./RoomLayer";
import {
  WALL, GRID, MIN_SIDE, WALL_NAMES,
  allParts, boxOf, clamp, collides, doorSwingPath, fmtArea, fmtLen, homeArea,
  homeBox, innerSeams, inputLen, makeRoom, mergeRooms, migrateRoom, OPENING_DEFAULT,
  nearestWall, nudgeStep, openingGapPath, openingGeom, parseLen, roomArea,
  roomBox, roomsTouch, sanitize, snap, snapRect, splitRoom, uid, windowPanePath,
} from "../lib/plan";

const STORE = "spaceplan.plan.v4";
const HANDLE_PX = 9;
const BOARD_GAP = 20;      // px — must match .boards gap in the CSS below
const ASPECT = 0.7;        // canvas height / width — must match .canvas aspect-ratio
const MIN_VIEW = 220;      // cm across, fully zoomed in
const MAX_VIEW = 4000;     // cm across, fully zoomed out
const DEFAULT_VIEW = { x: -60, y: -60, w: 940 };

const HOMES = [
  { key: "current", label: "Current place", kicker: "The one you live in now" },
  { key: "next", label: "New place", kicker: "The one you are moving into" },
];

/**
 * FOUR STEPS, and they name the SITUATION rather than the controls. Earlier
 * attempts called step 03 "What fits", then "The verdict", then "Keep, sell,
 * buy" — each one a truer description of the buttons on the screen and each
 * one further from what a person is actually doing there.
 *
 * CURRENT PLACE and NEW PLACE are the two words the whole app turns on. Step
 * 01 draws them side by side and hands them over; step 02 takes the first,
 * step 03 plans the second, step 04 is what you decided. Note that "plan" only
 * appears twice and means the same thing both times — an earlier set had a
 * "New place plan" next to a "Final plan" where the first meant a drawing and
 * the second meant a decision.
 */
const STEPS = [
  { label: "Compare spaces", href: "/draw-room" },
  { label: "Current place", href: "/furniture" },
  { label: "Plan new place", href: "/what-fits" },
  { label: "Final plan", href: "/plan" },
];

const EMPTY = { unit: "cm", homes: { current: { rooms: [] }, next: { rooms: [] } } };

export default function DrawRoom() {
  const [plan, setPlan] = useState(EMPTY);
  const [loaded, setLoaded] = useState(false);
  const [sel, setSel] = useState({ home: "current", roomId: null, part: null });
  const [drag, setDrag] = useState(null);
  const [draft, setDraft] = useState(null);
  /** "I am about to put a door somewhere" — the wall is chosen by clicking it. */
  const [placing, setPlacing] = useState(null);
  const [view, setView] = useState(DEFAULT_VIEW);
  const [boardPx, setBoardPx] = useState(440);
  const [aspect, setAspect] = useState(ASPECT);
  const boardRef = useRef(null);
  const dragRef = useRef(null);
  const viewRef = useRef(view);
  dragRef.current = drag;
  viewRef.current = view;

  /* ---------------------------------------------------------- persistence
   * The save effect waits for the load effect to have LANDED. Both run on the
   * same first commit, and on that commit `plan` is still the empty one — so a
   * save that fires immediately writes an empty flat straight over the one the
   * user saved last time. It only survived because the load had already read
   * the string by then; close the tab in that instant and the plan is gone.
   */
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORE);
      if (raw) {
        const s = JSON.parse(raw);
        if (s?.homes?.current?.rooms) {
          setPlan({
            ...s,
            unit: s.unit || "cm",
            homes: {
              current: { rooms: s.homes.current.rooms.map(migrateRoom) },
              next: { rooms: s.homes.next.rooms.map(migrateRoom) },
            },
          });
        }
      }
    } catch {}
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    try {
      window.localStorage.setItem(STORE, JSON.stringify(plan));
    } catch {}
  }, [plan, loaded]);

  /* ------------------------------------------------- one scale, measured */
  useEffect(() => {
    const el = boardRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(([e]) => {
      const w = e.contentRect.width || 900;
      const cols = w > 760 ? 2 : 1;
      setBoardPx(Math.max(160, (w - BOARD_GAP * (cols - 1)) / cols - 2));
      // the drawing is cut to the space it is given, not to a fixed ratio
      const canvas = el.querySelector(".canvas");
      if (canvas) {
        const r = canvas.getBoundingClientRect();
        if (r.width > 40 && r.height > 40) setAspect(r.height / r.width);
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const pxPerCm = boardPx / view.w;
  const viewBox = `${view.x} ${view.y} ${view.w} ${view.w * aspect}`;

  /* ---------------------------------------------------------- zoom + pan */
  const zoomAt = useCallback((factor, fx = 0.5, fy = 0.5) => {
    setView((v) => {
      const w = clamp(v.w * factor, MIN_VIEW, MAX_VIEW);
      if (w === v.w) return v;
      const h = v.w * aspect;
      const nh = w * aspect;
      return { x: v.x + (v.w - w) * fx, y: v.y + (h - nh) * fy, w };
    });
  }, [aspect]);

  const fitView = useCallback(() => {
    const box = boxOf([...plan.homes.current.rooms, ...plan.homes.next.rooms].flatMap((r) => r.parts));
    if (!box.w || !box.d) return setView(DEFAULT_VIEW);
    const w = clamp(Math.max(box.w, box.d / aspect) * 1.22, MIN_VIEW, MAX_VIEW);
    setView({
      x: box.x + box.w / 2 - w / 2,
      y: box.y + box.d / 2 - (w * aspect) / 2,
      w,
    });
  }, [plan, aspect]);

  /* -------------------------------------------------------------- edits */
  const setRoom = useCallback((homeKey, roomId, fn) => {
    setPlan((p) => ({
      ...p,
      homes: {
        ...p.homes,
        [homeKey]: {
          ...p.homes[homeKey],
          rooms: p.homes[homeKey].rooms.map((r) => (r.id === roomId ? sanitize(fn(r)) : r)),
        },
      },
    }));
  }, []);

  const setRooms = useCallback((homeKey, fn) => {
    setPlan((p) => ({
      ...p,
      homes: { ...p.homes, [homeKey]: { ...p.homes[homeKey], rooms: fn(p.homes[homeKey].rooms) } },
    }));
  }, []);

  const addRoom = (homeKey, room) => {
    setRooms(homeKey, (rooms) => [...rooms, room]);
    setSel({ home: homeKey, roomId: room.id, part: null });
  };

  const removeRoom = (homeKey, roomId) => {
    setRooms(homeKey, (rooms) => rooms.filter((r) => r.id !== roomId));
    setSel({ home: homeKey, roomId: null, part: null });
  };

  const merge = (homeKey, aId, bId) => {
    setRooms(homeKey, (rooms) => {
      const a = rooms.find((r) => r.id === aId);
      const b = rooms.find((r) => r.id === bId);
      if (!a || !b) return rooms;
      return rooms.filter((r) => r.id !== bId).map((r) => (r.id === aId ? sanitize(mergeRooms(a, b)) : r));
    });
    setSel({ home: homeKey, roomId: aId, part: null });
  };

  const split = (homeKey, roomId) => {
    setRooms(homeKey, (rooms) => rooms.flatMap((r) => (r.id === roomId ? splitRoom(r) : [r])));
    setSel({ home: homeKey, roomId, part: null });
  };

  const copyHome = (fromKey) => {
    const toKey = fromKey === "current" ? "next" : "current";
    const rooms = plan.homes[fromKey].rooms.map((r) => ({
      ...r,
      id: uid("room"),
      parts: r.parts.map((p) => ({ ...p })),
      openings: r.openings.map((o) => ({ ...o, id: uid("op") })),
    }));
    setPlan((p) => ({ ...p, homes: { ...p.homes, [toKey]: { rooms } } }));
    setSel({ home: toKey, roomId: null, part: null });
  };

  /* ------------------------------------------------- placing a door/window */
  /**
   * A door goes where you point at it. Guessing a wall for the user was the
   * one thing about this screen nobody could predict, so now the button arms
   * the tool and the next click on a wall is the answer.
   */
  const placeOpening = (pt, homeKey) => {
    const room = plan.homes[homeKey]?.rooms.find((r) => r.id === placing.roomId);
    if (!room || homeKey !== placing.home) return setPlacing(null);
    const hit = nearestWall(room, pt.x, pt.y);
    if (!hit || hit.dist > 200) return setPlacing(null);
    const width = Math.max(30, Math.min(OPENING_DEFAULT[placing.type], hit.len - 20));
    const op = {
      id: uid("op"),
      type: placing.type,
      part: hit.part,
      wall: hit.wall,
      width,
      along: clamp(hit.along - width / 2, 0, hit.len - width),
      hinge: "a",
      swing: "in",
    };
    setRoom(homeKey, room.id, (r) => ({ ...r, openings: [...r.openings, op] }));
    setSel({ home: homeKey, roomId: room.id, part: { kind: "opening", id: op.id } });
    setPlacing(null);
  };

  useEffect(() => {
    if (!placing) return;
    const esc = (e) => { if (e.key === "Escape") setPlacing(null); };
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [placing]);

  /* ------------------------------------------------------------ dragging */
  const startDrag = (e, info) => {
    e.stopPropagation();
    e.preventDefault();
    const svg = e.currentTarget.ownerSVGElement || e.currentTarget;
    if (!svg.viewBox) return;
    const pt = toCm(e, svg);
    if (placing) return placeOpening(pt, info.home);
    const wantsPan = info.mode === "create" && (e.button === 1 || e.shiftKey);
    const mode = wantsPan ? "pan" : info.mode;
    if (mode === "create" || mode === "pan") setSel((s) => ({ ...s, roomId: mode === "pan" ? s.roomId : null, part: null }));
    else setSel({ home: info.home, roomId: info.roomId, part: info.part ?? null });
    setDrag({
      ...info,
      mode,
      svg,
      start: pt,
      view0: viewRef.current,
      clientX0: e.clientX,
      clientY0: e.clientY,
    });
  };

  useEffect(() => {
    if (!drag) return;

    const move = (ev) => {
      const d = dragRef.current;
      if (!d) return;

      if (d.mode === "pan") {
        const r = d.svg.getBoundingClientRect();
        const perPx = d.view0.w / r.width;
        setView({
          x: d.view0.x - (ev.clientX - d.clientX0) * perPx,
          y: d.view0.y - (ev.clientY - d.clientY0) * perPx,
          w: d.view0.w,
        });
        return;
      }

      const pt = toCm(ev, d.svg);
      const rooms = plan.homes[d.home].rooms;

      if (d.mode === "create") {
        const others = allParts(rooms);
        const raw = {
          x: Math.min(d.start.x, pt.x),
          y: Math.min(d.start.y, pt.y),
          w: Math.abs(pt.x - d.start.x),
          d: Math.abs(pt.y - d.start.y),
        };
        const gridded = {
          x: snap(raw.x, plan.unit),
          y: snap(raw.y, plan.unit),
          w: Math.max(MIN_SIDE, snap(raw.w, plan.unit)),
          d: Math.max(MIN_SIDE, snap(raw.d, plan.unit)),
        };
        const s = snapRect(gridded, others, "ltrb");
        setDraft({ home: d.home, rect: s, bad: collides(s, others) });
        return;
      }

      if (d.mode === "move") {
        const others = allParts(rooms, { roomId: d.roomId });
        const dx = snap(pt.x - d.start.x, plan.unit);
        const dy = snap(pt.y - d.start.y, plan.unit);
        // snap the whole room by testing its bounding box, then shift every box
        const box = { x: d.orig.box.x + dx, y: d.orig.box.y + dy, w: d.orig.box.w, d: d.orig.box.d };
        const s = snapRect(box, others, "all");
        const ox = s.x - d.orig.box.x;
        const oy = s.y - d.orig.box.y;
        const moved = d.orig.parts.map((p) => ({ ...p, x: p.x + ox, y: p.y + oy }));
        if (moved.some((p) => collides(p, others))) return;
        setRoom(d.home, d.roomId, (r) => ({ ...r, parts: moved }));
        return;
      }

      if (d.mode === "resize") {
        const others = allParts(rooms, { roomId: d.roomId, partIdx: d.partIdx });
        const k = d.corner;
        const dx = pt.x - d.start.x;
        const dy = pt.y - d.start.y;
        const o = d.orig;
        let { x, y, w, d: dd } = o;
        if (k.includes("l")) { x = o.x + dx; w = o.w - dx; }
        if (k.includes("r")) { w = o.w + dx; }
        if (k.includes("t")) { y = o.y + dy; dd = o.d - dy; }
        if (k.includes("b")) { dd = o.d + dy; }
        if (k.includes("l")) { const nx = snap(x, plan.unit); w += x - nx; x = nx; }
        if (k.includes("r")) { w = snap(x + w, plan.unit) - x; }
        if (k.includes("t")) { const ny = snap(y, plan.unit); dd += y - ny; y = ny; }
        if (k.includes("b")) { dd = snap(y + dd, plan.unit) - y; }
        if (w < MIN_SIDE) { if (k.includes("l")) x = o.x + o.w - MIN_SIDE; w = MIN_SIDE; }
        if (dd < MIN_SIDE) { if (k.includes("t")) y = o.y + o.d - MIN_SIDE; dd = MIN_SIDE; }
        const s = snapRect({ x, y, w, d: dd }, others, k);
        if (collides(s, others)) return;
        setRoom(d.home, d.roomId, (r) => ({
          ...r,
          parts: r.parts.map((p, i) => (i === d.partIdx ? s : p)),
        }));
        return;
      }

      if (d.mode === "opening") {
        setRoom(d.home, d.roomId, (r) => {
          const hit = nearestWall(r, pt.x, pt.y);
          if (!hit) return r;
          return {
            ...r,
            openings: r.openings.map((o) => {
              if (o.id !== d.part.id) return o;
              const w = Math.min(o.width, hit.len);
              return {
                ...o,
                part: hit.part,
                wall: hit.wall,
                width: w,
                along: clamp(hit.along - w / 2, 0, hit.len - w),
              };
            }),
          };
        });
      }
    };

    const up = () => {
      const d = dragRef.current;
      if (d?.mode === "create") {
        setDraft((cur) => {
          if (cur && !cur.bad && cur.rect.w >= MIN_SIDE && cur.rect.d >= MIN_SIDE) {
            const n = plan.homes[d.home].rooms.length + 1;
            addRoom(d.home, makeRoom(defaultName(n), cur.rect.x, cur.rect.y, cur.rect.w, cur.rect.d));
          }
          return null;
        });
      }
      setDrag(null);
    };

    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
    };
  }, [drag, plan, setRoom]);

  const selectedRoom = plan.homes[sel.home]?.rooms.find((r) => r.id === sel.roomId) || null;
  const neighbours = selectedRoom
    ? plan.homes[sel.home].rooms.filter((r) => r.id !== selectedRoom.id && roomsTouch(r, selectedRoom))
    : [];

  return (
    <>
      <style>{PLAN_CSS + CSS}</style>
      <div className="wrap">
        <div className="rail">
          <a className="rail-l" href="/">← Space Plan</a>
          <div className="rail-c">Moving In · Draw · Sort · Decide</div>
          <div className="rail-r">
            <a href="/marketplace">Marketplace</a>
            <span className="dot" />
          </div>
        </div>

        <header className="headband">
          <h1>Compare spaces</h1>
          <div className="steps">
            {STEPS.map((s, i) => (
              <a key={s.label} className={"step" + (i === 0 ? " on" : "")} href={s.href}>
                {s.label}
              </a>
            ))}
          </div>
        </header>

        <div className="toolbar">
          <p className="lede">
            <span>Drag on a canvas to draw rooms.</span>
            <span>Here you can compare the current place and the new one.</span>
          </p>
          <div className="tools">
            <div className="units">
              <span className="lbl">Units</span>
              <button className={"seg" + (plan.unit === "cm" ? " on" : "")} onClick={() => setPlan((p) => ({ ...p, unit: "cm" }))}>cm</button>
              <button className={"seg" + (plan.unit === "ft" ? " on" : "")} onClick={() => setPlan((p) => ({ ...p, unit: "ft" }))}>ft / in</button>
            </div>
            <div className="units">
              <span className="lbl">View</span>
              <button className="seg" onClick={() => zoomAt(1 / 0.8)} title="Zoom out">−</button>
              <span className="zoomval">{Math.round((DEFAULT_VIEW.w / view.w) * 100)}%</span>
              <button className="seg" onClick={() => zoomAt(0.8)} title="Zoom in">+</button>
              <button className="seg" onClick={fitView}>Fit</button>
            </div>
          </div>
        </div>

        <div className="stage">
          <div className="boards" ref={boardRef}>
            {HOMES.map((h) => {
              const rooms = plan.homes[h.key].rooms;
              const other = plan.homes[h.key === "current" ? "next" : "current"].rooms;
              const box = homeBox(rooms);
              return (
                <section className="home" key={h.key}>
                  <div className="bhead">
                    <div>
                      <h2>{h.label}</h2>
                      <p className="kick">{h.kicker}</p>
                    </div>
                    <div className="btotal">
                      <b>{fmtArea(homeArea(rooms), plan.unit)}</b>
                      <span>{rooms.length} room{rooms.length === 1 ? "" : "s"}</span>
                    </div>
                  </div>

                  <HomeCanvas
                    homeKey={h.key}
                    rooms={rooms}
                    unit={plan.unit}
                    viewBox={viewBox}
                    pxPerCm={pxPerCm}
                    selId={sel.home === h.key ? sel.roomId : null}
                    part={sel.home === h.key ? sel.part : null}
                    draft={draft && draft.home === h.key ? draft : null}
                    placing={placing && placing.home === h.key ? placing : null}
                    onDrag={startDrag}
                    onZoom={zoomAt}
                  />

                  <div className="bfoot">
                    {rooms.length === 0 ? (
                      <span className="tip">No rooms yet</span>
                    ) : (
                      <span className="tip">
                        {fmtLen(box.w, plan.unit)} × {fmtLen(box.d, plan.unit)} overall
                      </span>
                    )}
                    {other.length === 0 && rooms.length > 0 && (
                      <button className="ghost sm" onClick={() => copyHome(h.key)}>
                        Copy to {h.key === "current" ? "new place" : "current place"}
                      </button>
                    )}
                  </div>
                </section>
              );
            })}
          </div>

          <Inspector
            plan={plan}
            sel={sel}
            room={selectedRoom}
            neighbours={neighbours}
            placing={placing}
            setRoom={setRoom}
            setSel={setSel}
            onRemove={removeRoom}
            onMerge={merge}
            onSplit={split}
            onPlace={(type) =>
              setPlacing((p) =>
                p && p.type === type ? null : { type, home: sel.home, roomId: sel.roomId }
              )
            }
          />
        </div>

        <footer className="foot">
          <div className="sum">
            <span>Current place <b>{fmtArea(homeArea(plan.homes.current.rooms), plan.unit)}</b></span>
            <span className="arrow">→</span>
            <span>New place <b>{fmtArea(homeArea(plan.homes.next.rooms), plan.unit)}</b></span>
            <span className="delta">{deltaLine(plan)}</span>
          </div>
          <div className="footr">
            <button
              className="ghost"
              onClick={() => {
                if (confirm("Clear both canvases and start again?")) {
                  setPlan((p) => ({ ...p, homes: EMPTY.homes }));
                  setSel({ home: "current", roomId: null, part: null });
                  setView(DEFAULT_VIEW);
                }
              }}
            >
              Reset
            </button>
            <a className="gonext" href="/furniture">
              Next →
            </a>
          </div>
        </footer>
      </div>
    </>
  );
}

/* ------------------------------------------------------------- helpers */

function toCm(ev, svg) {
  const r = svg.getBoundingClientRect();
  const vb = svg.viewBox.baseVal;
  return {
    x: vb.x + ((ev.clientX - r.left) / r.width) * vb.width,
    y: vb.y + ((ev.clientY - r.top) / r.height) * vb.height,
  };
}

const NAMES = ["Living room", "Bedroom", "Kitchen", "Bathroom", "Hallway", "Study"];
function defaultName(n) {
  return NAMES[n - 1] || `Room ${n}`;
}

function deltaLine(plan) {
  const a = homeArea(plan.homes.current.rooms);
  const b = homeArea(plan.homes.next.rooms);
  if (!a || !b) return "";
  const pct = Math.round(((b - a) / a) * 100);
  if (pct === 0) return "the same floor area";
  return pct < 0 ? `${Math.abs(pct)}% less floor` : `${pct}% more floor`;
}

/* -------------------------------------------------------- one home canvas */

const GRIPS = [
  ["tl", 0, 0], ["t", 0.5, 0], ["tr", 1, 0],
  ["r", 1, 0.5], ["br", 1, 1], ["b", 0.5, 1],
  ["bl", 0, 1], ["l", 0, 0.5],
];

function HomeCanvas({ homeKey, rooms, unit, viewBox, pxPerCm, selId, part, draft, placing, onDrag, onZoom }) {
  const u = 1 / Math.max(pxPerCm, 0.001);   // cm per px — keeps chrome one size
  const hs = HANDLE_PX * u;
  const gid = `gaps-${homeKey}`;
  const ref = useRef(null);
  const [ghost, setGhost] = useState(null);

  const placingRoom = placing ? rooms.find((r) => r.id === placing.roomId) : null;
  useEffect(() => {
    if (!placing) setGhost(null);
  }, [placing]);

  /** Follow the pointer along the walls, so you see exactly where it will land. */
  const trackGhost = (e) => {
    if (!placingRoom || !ref.current) return;
    const pt = toCm(e, ref.current);
    const hit = nearestWall(placingRoom, pt.x, pt.y);
    if (!hit || hit.dist > 200) return setGhost(null);
    const width = Math.max(30, Math.min(OPENING_DEFAULT[placing.type], hit.len - 20));
    setGhost({
      type: placing.type,
      part: hit.part,
      wall: hit.wall,
      width,
      along: clamp(hit.along - width / 2, 0, hit.len - width),
      hinge: "a",
      swing: "in",
    });
  };

  // The wheel has to be bound by hand: React's onWheel is passive, so it
  // cannot stop the page from scrolling underneath the zoom.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onWheel = (e) => {
      e.preventDefault();
      const r = el.getBoundingClientRect();
      onZoom(e.deltaY > 0 ? 1.12 : 1 / 1.12, (e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [onZoom]);

  const vb = viewBox.split(" ").map(Number);
  const g0x = Math.floor(vb[0] / GRID) * GRID;
  const g0y = Math.floor(vb[1] / GRID) * GRID;
  const grid = [];
  const step = vb[2] > 1800 ? GRID * 2 : GRID;
  for (let x = g0x; x < vb[0] + vb[2]; x += step) grid.push(`M${x} ${vb[1]} V${vb[1] + vb[3]}`);
  for (let y = g0y; y < vb[1] + vb[3]; y += step) grid.push(`M${vb[0]} ${y} H${vb[0] + vb[2]}`);

  const openings = rooms.flatMap((r) =>
    r.openings.map((op) => ({ room: r, op, g: openingGeom(r, op) })).filter((o) => o.g)
  );

  const floorRects = (suffix) =>
    rooms.flatMap((r) =>
      r.parts.map((p, i) => (
        <rect
          key={r.id + "-" + i + suffix}
          x={p.x}
          y={p.y}
          width={p.w}
          height={p.d}
          className={"floor" + (r.id === selId ? " on" : "")}
        />
      ))
    );

  return (
    <div className="canvasbox">
      <svg
        ref={ref}
        viewBox={viewBox}
        className={"canvas" + (placing ? " placing" : "")}
        onPointerMove={placing ? trackGhost : undefined}
        onPointerLeave={placing ? () => setGhost(null) : undefined}
      >
        <RoomLayer
          rooms={rooms}
          vb={vb}
          u={u}
          pxPerCm={pxPerCm}
          unit={unit}
          idPrefix={homeKey}
          selId={selId}
          labels="full"
          onSheetDown={(e) => onDrag(e, { mode: "create", home: homeKey })}
          onRoomDown={(e, r) =>
            onDrag(e, {
              mode: "move",
              home: homeKey,
              roomId: r.id,
              orig: { parts: r.parts.map((q) => ({ ...q })), box: roomBox(r) },
            })
          }
        />

        {/* handles for the room you are working on — one set per box */}
        {rooms.map((r) => {
          if (r.id !== selId) return null;
          return (
            <g key={r.id}>
              {r.openings.map((op) => {
                const g = openingGeom(r, op);
                if (!g) return null;
                return (
                  <circle
                    key={op.id}
                    cx={g.mid.x}
                    cy={g.mid.y}
                    r={hs * 0.5}
                    className={"h op" + (part?.kind === "opening" && part.id === op.id ? " sel" : "")}
                    onPointerDown={(e) =>
                      onDrag(e, { mode: "opening", home: homeKey, roomId: r.id, part: { kind: "opening", id: op.id } })
                    }
                  />
                );
              })}
              {r.parts.flatMap((p, pi) =>
                GRIPS.map(([k, fx, fy]) => (
                  <rect
                    key={pi + k}
                    x={p.x + p.w * fx - hs / 2}
                    y={p.y + p.d * fy - hs / 2}
                    width={hs}
                    height={hs}
                    className={"h grip g-" + k}
                    onPointerDown={(e) =>
                      onDrag(e, {
                        mode: "resize",
                        home: homeKey,
                        roomId: r.id,
                        partIdx: pi,
                        corner: k,
                        orig: { ...p },
                      })
                    }
                  />
                ))
              )}
            </g>
          );
        })}

        {draft && (
          <g pointerEvents="none">
            <rect
              x={draft.rect.x}
              y={draft.rect.y}
              width={draft.rect.w}
              height={draft.rect.d}
              className={"draft" + (draft.bad ? " bad" : "")}
              strokeWidth={2 * u}
            />
            <text
              x={draft.rect.x + draft.rect.w / 2}
              y={draft.rect.y + draft.rect.d / 2}
              className="rdim"
              fontSize={11 * u}
            >
              {fmtLen(draft.rect.w, unit)} × {fmtLen(draft.rect.d, unit)}
            </text>
          </g>
        )}

        {/* arming a door: light up the walls you can click, and show exactly
            where the opening would land */}
        {placingRoom && (
          <g pointerEvents="none">
            <g className="pickwall" strokeWidth={WALL + 5 * u}>
              {placingRoom.parts.map((p, i) => (
                <rect key={i} x={p.x} y={p.y} width={p.w} height={p.d} />
              ))}
            </g>
            {ghost &&
              (() => {
                const g = openingGeom(placingRoom, ghost);
                if (!g) return null;
                const s = ghost.type === "door" ? doorSwingPath(g, ghost) : null;
                return (
                  <g>
                    <path d={openingGapPath(g, WALL + 4 * u)} className="ghostgap" />
                    {s ? (
                      <g className="ghostline" fill="none" strokeWidth={2.4 * u}>
                        <path d={s.leaf} />
                        <path d={s.arc} strokeWidth={1.7 * u} />
                      </g>
                    ) : (
                      <path
                        className="ghostline"
                        fill="none"
                        strokeWidth={1.8 * u}
                        d={windowPanePath(g, WALL)}
                      />
                    )}
                  </g>
                );
              })()}
          </g>
        )}

        {placingRoom && (
          <text x={vb[0] + vb[2] / 2} y={vb[1] + 22 * u} className="banner" fontSize={11 * u}>
            Click a wall to place the {placing.type} · Esc to cancel
          </text>
        )}

        {rooms.length === 0 && !draft && !placing && (
          <text x={vb[0] + vb[2] / 2} y={vb[1] + vb[3] / 2} className="ghosttext" fontSize={17 * u}>
            Drag to draw a room
          </text>
        )}
      </svg>
    </div>
  );
}

/* ------------------------------------------------------------- inspector */

function Inspector({ plan, sel, room, neighbours, placing, setRoom, setSel, onRemove, onMerge, onSplit, onPlace }) {
  const unit = plan.unit;

  // Nothing selected, nothing to say. The panel used to fill up with three
  // paragraphs of instructions nobody reads twice; the canvas already says
  // "Drag to draw a room" in the middle of itself, which is where you are
  // looking. The empty column stays in the layout so the drawing does not
  // jump wider every time you click away from a room.
  if (!room) return <aside className="insp" />;

  const box = roomBox(room);
  const multi = room.parts.length > 1;
  const selOpening =
    sel.part?.kind === "opening" ? room.openings.find((o) => o.id === sel.part.id) : null;

  const setSide = (which, cm) => {
    if (!isFinite(cm) || multi) return;
    const v = Math.max(MIN_SIDE, Math.round(cm));
    setRoom(sel.home, room.id, (r) => ({ ...r, parts: [{ ...r.parts[0], [which]: v }] }));
  };

  const editOpening = (id, patch) =>
    setRoom(sel.home, room.id, (r) => ({
      ...r,
      openings: r.openings.map((o) => (o.id === id ? { ...o, ...patch } : o)),
    }));

  const dropOpening = (id) => {
    setRoom(sel.home, room.id, (r) => ({ ...r, openings: r.openings.filter((o) => o.id !== id) }));
    setSel((s) => ({ ...s, part: null }));
  };

  return (
    <aside className="insp">
      <div className="ihead">
        <span className="tag">{sel.home === "current" ? "Current place" : "New place"}</span>
        <input
          className="name"
          value={room.name}
          onChange={(e) => setRoom(sel.home, room.id, (r) => ({ ...r, name: e.target.value }))}
        />
      </div>

      {multi ? (
        <div className="ifield">
          <label>Overall</label>
          <p className="read">
            {fmtLen(box.w, unit)} × {fmtLen(box.d, unit)} · {room.parts.length} boxes
          </p>
          <p className="hint">Drag any box's corner to reshape this room.</p>
        </div>
      ) : (
        <div className="ifield two">
          <div>
            <label>Width</label>
            <LenInput cm={room.parts[0].w} unit={unit} onCommit={(v) => setSide("w", v)} />
          </div>
          <div>
            <label>Depth</label>
            <LenInput cm={room.parts[0].d} unit={unit} onCommit={(v) => setSide("d", v)} />
          </div>
        </div>
      )}

      <div className="ifield">
        <label>Floor area</label>
        <p className="read big">{fmtArea(roomArea(room), unit)}</p>
      </div>

      <div className="ifield">
        <label>Shape</label>
        {neighbours.length > 0 ? (
          <div className="segs">
            {neighbours.map((n) => (
              <button key={n.id} className="seg" onClick={() => onMerge(sel.home, room.id, n.id)}>
                Merge {n.name}
              </button>
            ))}
          </div>
        ) : (
          <p className="hint">
            Draw another box touching this room to merge them into one L or U shaped room.
          </p>
        )}
        {multi && (
          <button className="ghost sm" style={{ marginTop: 8 }} onClick={() => onSplit(sel.home, room.id)}>
            Split apart
          </button>
        )}
      </div>

      <div className="ifield">
        <label>Doors &amp; windows</label>
        <div className="segs">
          <button
            className={"seg pic" + (placing?.type === "door" ? " on" : "")}
            onClick={() => onPlace("door")}
          >
            <DoorMark />
            Door
          </button>
          <button
            className={"seg pic" + (placing?.type === "window" ? " on" : "")}
            onClick={() => onPlace("window")}
          >
            <WindowMark />
            Window
          </button>
        </div>
        <ul className="oplist">
          {room.openings.map((o, i) => (
            <li
              key={o.id}
              className={selOpening?.id === o.id ? "on" : ""}
              onClick={() => setSel((s) => ({ ...s, part: { kind: "opening", id: o.id } }))}
            >
              <b>{o.type === "door" ? "Door" : "Window"} {i + 1}</b>
              <span>{WALL_NAMES[o.wall]} · {fmtLen(o.width, unit)}</span>
            </li>
          ))}
          {room.openings.length === 0 && <li className="none">None yet</li>}
        </ul>

        {selOpening && (
          <div className="opedit">
            <label>Opening width</label>
            <LenInput
              cm={selOpening.width}
              unit={unit}
              onCommit={(v) => editOpening(selOpening.id, { width: clamp(v, 30, 400) })}
            />
            {selOpening.type === "door" && (
              <div className="segs">
                <button className="seg" onClick={() => editOpening(selOpening.id, { hinge: selOpening.hinge === "a" ? "b" : "a" })}>
                  Flip hinge
                </button>
                <button className="seg" onClick={() => editOpening(selOpening.id, { swing: selOpening.swing === "in" ? "out" : "in" })}>
                  Swing {selOpening.swing === "in" ? "out" : "in"}
                </button>
              </div>
            )}
            <button className="ghost sm" onClick={() => dropOpening(selOpening.id)}>
              Remove this {selOpening.type}
            </button>
          </div>
        )}
      </div>

      <div className="ifoot">
        <button className="ghost sm danger" onClick={() => onRemove(sel.home, room.id)}>
          Delete room
        </button>
      </div>
    </aside>
  );
}

/* ------------------------------------------------------- door + window marks
 *
 * The button shows the thing it draws. A door on the plan is a gap punched
 * through a thick wall, a leaf standing open across it and a thin arc sweeping
 * the floor it needs; a window is the same gap with a thin sill line laid
 * across it. Those are the marks, at button size, in the same proportions —
 * WALL is 11cm against an 85cm opening, roughly one to eight, so the wall here
 * is 2.6 units against a 12-unit gap.
 *
 * The point is that you never have to learn a legend: the word next to the
 * picture and the picture on the plan are the same picture.
 */
function DoorMark() {
  return (
    <svg className="opmark" viewBox="0 0 30 19" aria-hidden="true">
      {/* wall, with the opening left out of it */}
      <path className="omwall" d="M0 16 H9 M21 16 H30" />
      {/* the leaf, standing open, and the floor it sweeps */}
      <path className="omleaf" d="M9 16 V4" />
      <path className="omarc" d="M9 4 A12 12 0 0 1 21 16" />
    </svg>
  );
}

function WindowMark() {
  return (
    <svg className="opmark" viewBox="0 0 30 19" aria-hidden="true">
      <path className="omwall" d="M0 16 H9 M21 16 H30" />
      {/* the glazing box, outlined at both faces of the wall — the same mark,
          in the same proportions, that windowPanePath draws on the plan */}
      <path className="omsill" d="M9 14.7 H21 V17.3 H9 Z" />
    </svg>
  );
}

/**
 * A length field that speaks whichever unit is switched on. It holds its own
 * draft while focused so the formatter never fights the typist, and commits on
 * blur or Enter.
 */
function LenInput({ cm, unit, onCommit }) {
  const [draft, setDraft] = useState(inputLen(cm, unit));
  const [live, setLive] = useState(false);
  useEffect(() => {
    if (!live) setDraft(inputLen(cm, unit));
  }, [cm, unit, live]);

  const commit = (text) => {
    const v = parseLen(text, unit);
    if (isFinite(v)) onCommit(v);
    setDraft(inputLen(isFinite(v) ? v : cm, unit));
  };

  return (
    <div className="len">
      <button onClick={() => onCommit(cm - nudgeStep(unit))} aria-label="less">−</button>
      <input
        value={draft}
        onFocus={() => setLive(true)}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={(e) => { setLive(false); commit(e.target.value); }}
        onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
      />
      <button onClick={() => onCommit(cm + nudgeStep(unit))} aria-label="more">+</button>
    </div>
  );
}

/* ------------------------------------------------------------------ CSS
 *
 * ONLY WHAT IS PARTICULAR TO THIS SCREEN LIVES HERE. This block used to
 * re-declare the palette, the running head, the step rail, the buttons, the
 * canvas colours, the footer and the inspector — a second copy of PLAN_CSS
 * that had quietly drifted away from the original. That is why step 01 had a
 * 92px title and steps 02 and 03 had a 58px one, why this page scrolled while
 * the others did not, and why the small caps here were a different size from
 * the small caps there. Every one of those rules is now deleted, so the shared
 * sheet is the only sheet and the three screens are typographically identical.
 */

const CSS = `
/* ---------- toolbar ---------- */
/* The gap under the title and the gap under this line should match. They were
   23px and 10px, which glued the sentence to the drawing and made it look like
   a caption for the thing below rather than a line of its own. */
.toolbar{display:flex;align-items:center;justify-content:space-between;gap:20px;
  flex-wrap:wrap;margin-bottom:clamp(16px,2.6vh,32px);flex:0 0 auto;}
.lede{max-width:70ch;font-size:clamp(12.5px,1.02vw,15px);font-weight:600;line-height:1.45;}
.lede span{display:block;}
.tools{display:flex;align-items:center;gap:18px;flex-wrap:wrap;}

/* ---------- stage: two boards on the left, one panel on the right ---------- */
/* grid-template-rows is not decoration: a grid row defaults to max-content, so
   without it the panel grows past the bottom of the page and paints over the
   footer instead of scrolling inside itself. */
.stage{display:grid;grid-template-columns:minmax(0,1fr) 300px;grid-template-rows:minmax(0,1fr);
  gap:clamp(14px,1.8vw,26px);align-items:stretch;}
.boards{display:grid;grid-template-columns:1fr 1fr;gap:20px;align-items:stretch;
  min-width:0;min-height:0;}
.home{min-width:0;display:flex;flex-direction:column;min-height:0;}
.bhead{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex:0 0 auto;
  border-top:2px solid var(--ink);padding:8px 0;border-bottom:1px solid rgba(43,43,43,.3);
  margin-bottom:8px;}
.bhead h2{font-family:var(--display);font-weight:800;letter-spacing:-.02em;line-height:1;
  font-size:clamp(17px,1.6vw,24px);}
.bhead .kick{font-weight:600;font-size:9.5px;text-transform:uppercase;letter-spacing:.13em;
  opacity:.6;margin-top:4px;}
.btotal{text-align:right;flex:0 0 auto;}
.btotal b{display:block;font-family:var(--display);font-weight:800;font-size:clamp(14px,1.3vw,19px);
  letter-spacing:-.01em;}
.btotal span{font-weight:600;font-size:9.5px;text-transform:uppercase;letter-spacing:.13em;opacity:.6;}
/* the shared sheet gives a lone canvas the whole column; here the board also
   carries a head and a foot, so the drawing takes what is left instead */
.canvasbox{flex:1 1 auto;height:auto;}
.bfoot{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;
  padding-top:7px;flex:0 0 auto;}
/* the same treatment the furniture sizes get on step 02, for the same reason:
   it ends in a unit */
.tip{font-weight:600;font-size:10px;opacity:.7;}

/* ---------- drawing a room ---------- */
.floor{cursor:move;}
.draft{fill:rgba(210,191,129,.4);stroke:#2B2B2B;stroke-dasharray:8 6;}
.draft.bad{fill:rgba(43,43,43,.14);stroke-dasharray:3 5;}
.canvas.placing .sheet,.canvas.placing .floor{cursor:copy;}
.pickwall rect{fill:none;stroke:rgba(210,191,129,.85);}
.ghostgap{fill:var(--gold);}
.ghostline{stroke:#2B2B2B;stroke-linecap:round;}
.h{cursor:grab;}
.h.grip{fill:var(--cream);stroke:#2B2B2B;stroke-width:1.4;vector-effect:non-scaling-stroke;}
.g-tl,.g-br{cursor:nwse-resize;}
.g-tr,.g-bl{cursor:nesw-resize;}
.g-t,.g-b{cursor:ns-resize;}
.g-l,.g-r{cursor:ew-resize;}
.h.op{fill:#2B2B2B;stroke:var(--cream);stroke-width:1.6;vector-effect:non-scaling-stroke;}
.h.op.sel{fill:#fff;stroke:#2B2B2B;}

/* ---------- inspector ---------- */
.insp{align-self:stretch;overflow-y:auto;padding-right:4px;}
/* nothing selected: no heading, no paragraphs, no rule across the top */
.insp:empty{border-top:0;}
.ihead{padding-bottom:10px;border-bottom:1px solid rgba(43,43,43,.3);margin-bottom:12px;}
/* the room name is the user's own words, so it is set the way they typed it */
.name{width:100%;background:transparent;border:0;border-bottom:1px solid rgba(43,43,43,.35);
  font-family:var(--display);font-weight:800;font-size:18px;letter-spacing:-.02em;color:var(--ink);
  padding:2px 0 5px;}
.name:focus{outline:none;border-bottom-color:var(--ink);}

/* a button that shows what it draws */
.seg.pic{display:inline-flex;align-items:center;gap:7px;padding:5px 10px;}
.opmark{height:15px;width:auto;overflow:visible;flex:0 0 auto;}
.opmark path{fill:none;stroke:currentColor;stroke-linecap:butt;}
.omwall{stroke-width:2.6;}
.omleaf{stroke-width:1.7;}
.omarc{stroke-width:1.1;}
.omsill{stroke-width:1.1;}

/* the list of openings reads like the furniture list on step 02: the name of
   a thing in mixed case, its size alongside — not a row of shouting capitals */
.oplist{list-style:none;margin-top:10px;display:flex;flex-direction:column;gap:3px;}
.oplist li{display:flex;align-items:baseline;gap:8px;cursor:pointer;padding:6px 8px;
  border:1px solid transparent;}
.oplist li:hover{background:rgba(43,43,43,.06);}
.oplist li.on{border-color:var(--ink);background:var(--gold);}
.oplist li b{font-weight:800;font-size:12.5px;letter-spacing:-.005em;}
.oplist li span{margin-left:auto;font-weight:600;font-size:10px;opacity:.7;white-space:nowrap;}
.oplist li.none{opacity:.5;cursor:default;font-weight:600;font-size:11px;}
.opedit{margin-top:10px;padding:10px;border:1px solid rgba(43,43,43,.3);
  display:flex;flex-direction:column;gap:8px;}
.opedit label{margin-bottom:0;}
.ifoot{display:flex;gap:6px;flex-wrap:wrap;padding-top:12px;border-top:1px solid rgba(43,43,43,.3);}

/* ---------- narrow ---------- */
@media (max-width:1180px){
  .stage{grid-template-columns:minmax(0,1fr);}
  .ifield.two{max-width:420px;}
}
@media (max-width:760px){
  .boards{grid-template-columns:1fr;}
}
`;
