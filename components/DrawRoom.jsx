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
  roomBox, roomsTouch, sanitize, snap, snapRect, splitRoom, uid,
} from "../lib/plan";

const STORE = "spaceplan.plan.v4";
const HANDLE_PX = 9;
const BOARD_GAP = 20;      // px — must match .boards gap in the CSS below
const ASPECT = 0.7;        // canvas height / width — must match .canvas aspect-ratio
const MIN_VIEW = 220;      // cm across, fully zoomed in
const MAX_VIEW = 4000;     // cm across, fully zoomed out
const DEFAULT_VIEW = { x: -60, y: -60, w: 940 };

const HOMES = [
  { key: "current", label: "Current place", kicker: "What you have now" },
  { key: "next", label: "New place", kicker: "Where it all has to go" },
];

const STEPS = [
  { label: "Rooms", href: "/draw-room" },
  { label: "Furniture", href: "/furniture" },
  { label: "What fits", href: null },
  { label: "Keep / Sell / Toss", href: null },
  { label: "Preview", href: null },
];

const EMPTY = { unit: "cm", homes: { current: { rooms: [] }, next: { rooms: [] } } };

export default function DrawRoom() {
  const [plan, setPlan] = useState(EMPTY);
  const [sel, setSel] = useState({ home: "current", roomId: null, part: null });
  const [drag, setDrag] = useState(null);
  const [draft, setDraft] = useState(null);
  /** "I am about to put a door somewhere" — the wall is chosen by clicking it. */
  const [placing, setPlacing] = useState(null);
  const [view, setView] = useState(DEFAULT_VIEW);
  const [panMode, setPanMode] = useState(false);
  const [boardPx, setBoardPx] = useState(440);
  const boardRef = useRef(null);
  const dragRef = useRef(null);
  const viewRef = useRef(view);
  dragRef.current = drag;
  viewRef.current = view;

  /* ---------------------------------------------------------- persistence */
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
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORE, JSON.stringify(plan));
    } catch {}
  }, [plan]);

  /* ------------------------------------------------- one scale, measured */
  useEffect(() => {
    const el = boardRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(([e]) => {
      const w = e.contentRect.width || 900;
      const cols = w > 760 ? 2 : 1;
      setBoardPx(Math.max(160, (w - BOARD_GAP * (cols - 1)) / cols - 2));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const pxPerCm = boardPx / view.w;
  const viewBox = `${view.x} ${view.y} ${view.w} ${view.w * ASPECT}`;

  /* ---------------------------------------------------------- zoom + pan */
  const zoomAt = useCallback((factor, fx = 0.5, fy = 0.5) => {
    setView((v) => {
      const w = clamp(v.w * factor, MIN_VIEW, MAX_VIEW);
      if (w === v.w) return v;
      const h = v.w * ASPECT;
      const nh = w * ASPECT;
      return { x: v.x + (v.w - w) * fx, y: v.y + (h - nh) * fy, w };
    });
  }, []);

  const fitView = useCallback(() => {
    const box = boxOf([...plan.homes.current.rooms, ...plan.homes.next.rooms].flatMap((r) => r.parts));
    if (!box.w || !box.d) return setView(DEFAULT_VIEW);
    const w = clamp(Math.max(box.w, box.d / ASPECT) * 1.22, MIN_VIEW, MAX_VIEW);
    setView({
      x: box.x + box.w / 2 - w / 2,
      y: box.y + box.d / 2 - (w * ASPECT) / 2,
      w,
    });
  }, [plan]);

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
    const wantsPan = info.mode === "create" && (panMode || e.button === 1 || e.shiftKey);
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
          <h1>Rooms</h1>
          <div className="steps">
            {STEPS.map((s, i) =>
              s.href ? (
                <a key={s.label} className={"step" + (i === 0 ? " on" : "")} href={s.href}>
                  <b>{String(i + 1).padStart(2, "0")}</b> {s.label}
                </a>
              ) : (
                <span key={s.label} className="step">
                  <b>{String(i + 1).padStart(2, "0")}</b> {s.label}
                </span>
              )
            )}
          </div>
        </header>

        <div className="toolbar">
          <p className="lede">
            Drag on the canvas to draw a room. Draw the next one against it — edges click
            together. For an <i>L</i> or <i>U</i> shaped room, draw a second box beside the
            first and press <i>Merge</i>: the wall between them disappears and it becomes one
            room.
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
              <button
                className={"seg" + (panMode ? " on" : "")}
                onClick={() => setPanMode((v) => !v)}
                title="Drag the canvas instead of drawing"
              >
                Pan
              </button>
            </div>
          </div>
        </div>

        <div className="stage">
          <div className="boards" ref={boardRef}>
            {HOMES.map((h, hi) => {
              const rooms = plan.homes[h.key].rooms;
              const other = plan.homes[h.key === "current" ? "next" : "current"].rooms;
              const box = homeBox(rooms);
              return (
                <section className="home" key={h.key}>
                  <div className="bhead">
                    <div>
                      <span className="num">{String(hi + 1).padStart(2, "0")}</span>
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
                    panMode={panMode}
                    selId={sel.home === h.key ? sel.roomId : null}
                    part={sel.home === h.key ? sel.part : null}
                    draft={draft && draft.home === h.key ? draft : null}
                    placing={placing && placing.home === h.key ? placing : null}
                    onDrag={startDrag}
                    onZoom={zoomAt}
                  />

                  <div className="bfoot">
                    {rooms.length === 0 ? (
                      <span className="tip">Drag anywhere on the canvas to draw your first room</span>
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
            <span>Current <b>{fmtArea(homeArea(plan.homes.current.rooms), plan.unit)}</b></span>
            <span className="arrow">→</span>
            <span>New <b>{fmtArea(homeArea(plan.homes.next.rooms), plan.unit)}</b></span>
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
              Next · Furniture →
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

function HomeCanvas({ homeKey, rooms, unit, viewBox, pxPerCm, panMode, selId, part, draft, placing, onDrag, onZoom }) {
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
        className={"canvas" + (panMode ? " panning" : "") + (placing ? " placing" : "")}
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
                        strokeWidth={2.6 * u}
                        d={`M${g.A.x} ${g.A.y} L${g.B.x} ${g.B.y}`}
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

  if (!room) {
    return (
      <aside className="insp">
        <h3>Nothing selected</h3>
        <p className="hint">
          Drag on a canvas to draw a room. Click a room to rename it, resize it, or put a
          door in it. Drag a room by its middle; drag a corner or an edge to resize.
        </p>
        <p className="hint">
          <b>L or U shaped room:</b> draw a second box against the first, select one of them,
          then press Merge. The two become a single room with the wall between them removed.
        </p>
        <p className="hint">
          <b>Wheel</b> zooms both canvases together. Hold <b>Shift</b> and drag — or turn on
          Pan — to move around.
        </p>
      </aside>
    );
  }

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
            className={"seg" + (placing?.type === "door" ? " on" : "")}
            onClick={() => onPlace("door")}
          >
            + Door
          </button>
          <button
            className={"seg" + (placing?.type === "window" ? " on" : "")}
            onClick={() => onPlace("window")}
          >
            + Window
          </button>
        </div>
        {placing ? (
          <p className="hint arm">
            Now click the wall you want the {placing.type} on. Esc cancels.
          </p>
        ) : (
          <p className="hint">You pick the wall — the button arms it, the click places it.</p>
        )}
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
            <p className="hint">Drag the dot on the plan to slide it along the wall, or onto another wall.</p>
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

/* ------------------------------------------------------------------ CSS */

const CSS = `
*{margin:0;padding:0;box-sizing:border-box;}
:root{--cream:#F0EAD8;--gold:#D2BF81;--sage:#99ABA6;--ink:#2B2B2B;
  --display:'Archivo',sans-serif;--text:'Archivo Narrow',sans-serif;}
html,body{min-height:100%;}
body{background:var(--cream);color:var(--ink);font-family:var(--text);
  -webkit-font-smoothing:antialiased;}
.wrap{max-width:1560px;margin:0 auto;padding:clamp(10px,1.3vh,20px) 3vw clamp(16px,2vh,30px);
  display:flex;flex-direction:column;min-height:100vh;}

/* ---------- running head ---------- */
.rail{display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:16px;
  padding-bottom:8px;border-bottom:1px solid var(--ink);margin-bottom:clamp(10px,1.4vh,20px);}
.rail-l,.rail-r{font-weight:700;font-size:clamp(9px,.78vw,11px);text-transform:uppercase;letter-spacing:.16em;}
.rail-l{color:var(--ink);text-decoration:none;}
.rail-l:hover{text-decoration:underline;text-underline-offset:3px;}
.rail-c{font-weight:700;font-size:clamp(11px,.95vw,14px);white-space:nowrap;}
.rail-r{justify-self:end;display:flex;align-items:center;gap:clamp(12px,1.4vw,22px);}
.rail-r a{color:var(--ink);text-decoration:none;}
.rail-r a:hover{text-decoration:underline;text-underline-offset:3px;}
.dot{width:7px;height:7px;border-radius:50%;background:var(--ink);flex:0 0 auto;}

/* ---------- headband ---------- */
.headband{display:flex;align-items:flex-end;justify-content:space-between;gap:24px;
  flex-wrap:wrap;border-bottom:3px solid var(--ink);padding-bottom:10px;margin-bottom:14px;}
.headband h1{font-family:var(--display);font-weight:800;line-height:.9;letter-spacing:-.03em;
  font-size:clamp(38px,6.4vw,92px);}
.steps{display:flex;gap:clamp(10px,1.4vw,22px);flex-wrap:wrap;padding-bottom:6px;}
.step{font-weight:600;font-size:clamp(8.5px,.74vw,10.5px);text-transform:uppercase;
  letter-spacing:.14em;opacity:.42;white-space:nowrap;}
.step b{font-weight:800;letter-spacing:.04em;}
.step.on{opacity:1;}

/* ---------- toolbar ---------- */
.toolbar{display:flex;align-items:center;justify-content:space-between;gap:20px;
  flex-wrap:wrap;margin-bottom:16px;}
.lede{max-width:66ch;font-size:clamp(12.5px,1.02vw,15px);font-weight:600;line-height:1.5;}
.lede i{font-style:normal;font-weight:800;}
.tools{display:flex;align-items:center;gap:18px;flex-wrap:wrap;}
.units{display:flex;align-items:center;gap:6px;flex:0 0 auto;}
.units .lbl{font-weight:700;font-size:9.5px;text-transform:uppercase;letter-spacing:.16em;opacity:.6;
  margin-right:2px;}
.zoomval{font-weight:700;font-size:10.5px;min-width:42px;text-align:center;letter-spacing:.04em;}

button{font:inherit;color:inherit;cursor:pointer;}
.seg{background:transparent;border:1px solid var(--ink);padding:5px 11px;
  font-family:var(--text);font-weight:700;font-size:10.5px;text-transform:uppercase;letter-spacing:.12em;}
.seg:hover{background:rgba(43,43,43,.08);}
.seg.on{background:var(--ink);color:var(--cream);}

/* ---------- stage ---------- */
.stage{display:grid;grid-template-columns:minmax(0,1fr) 300px;gap:clamp(16px,2vw,32px);
  align-items:start;flex:1 1 auto;}
.boards{display:grid;grid-template-columns:1fr 1fr;gap:20px;align-items:start;min-width:0;}
.home{min-width:0;}
.bhead{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;
  border-top:2px solid var(--ink);padding:10px 0;border-bottom:1px solid rgba(43,43,43,.3);
  margin-bottom:10px;}
.bhead .num{font-weight:800;font-size:9.5px;letter-spacing:.1em;opacity:.6;display:block;
  text-transform:uppercase;margin-bottom:2px;}
.bhead h2{font-family:var(--display);font-weight:800;letter-spacing:-.02em;line-height:1;
  font-size:clamp(19px,1.85vw,28px);}
.bhead .kick{font-weight:600;font-size:10px;text-transform:uppercase;letter-spacing:.13em;
  opacity:.6;margin-top:4px;}
.btotal{text-align:right;flex:0 0 auto;}
.btotal b{display:block;font-family:var(--display);font-weight:800;font-size:clamp(15px,1.4vw,21px);
  letter-spacing:-.01em;}
.btotal span{font-weight:600;font-size:9.5px;text-transform:uppercase;letter-spacing:.13em;opacity:.6;}

/* ---------- canvas ---------- */
.canvasbox{border:1px solid rgba(43,43,43,.4);overflow:hidden;}
.canvas{display:block;width:100%;aspect-ratio:100/70;touch-action:none;}
.sheet{fill:#F6F2E6;cursor:crosshair;}
.canvas.panning .sheet{cursor:grab;}
/* grid lines and wall strokes are hit-testable by default, and being on top
   they would swallow clicks meant for the floor or the empty sheet */
.gridlines,.walls{pointer-events:none;}
.gridlines{stroke:rgba(43,43,43,.13);fill:none;}
.floor{fill:#EDE6D2;cursor:move;}
.floor.on{fill:var(--gold);}
.walls rect{fill:none;stroke:#2B2B2B;}
.sill{stroke:#2B2B2B;fill:none;}
.swing{stroke:#2B2B2B;fill:none;stroke-linecap:round;}
.labels text{text-anchor:middle;dominant-baseline:middle;fill:#2B2B2B;}
.rname{font-family:'Archivo',sans-serif;font-weight:800;}
.rdim{font-family:'Archivo Narrow',sans-serif;font-weight:700;text-transform:uppercase;
  fill:#2B2B2B;opacity:.75;text-anchor:middle;dominant-baseline:middle;}
.ghosttext{text-anchor:middle;dominant-baseline:middle;fill:rgba(43,43,43,.35);
  font-family:'Archivo Narrow',sans-serif;font-weight:700;text-transform:uppercase;letter-spacing:.18em;}
.draft{fill:rgba(210,191,129,.4);stroke:#2B2B2B;stroke-dasharray:8 6;}
.draft.bad{fill:rgba(43,43,43,.14);stroke-dasharray:3 5;}
.canvas.placing .sheet,.canvas.placing .floor{cursor:copy;}
.pickwall rect{fill:none;stroke:rgba(210,191,129,.85);}
.ghostgap{fill:var(--gold);}
.ghostline{stroke:#2B2B2B;stroke-linecap:round;}
.banner{text-anchor:middle;dominant-baseline:middle;fill:#2B2B2B;
  font-family:'Archivo Narrow',sans-serif;font-weight:800;text-transform:uppercase;letter-spacing:.14em;}
.h{cursor:grab;}
.h.grip{fill:var(--cream);stroke:#2B2B2B;stroke-width:1.4;vector-effect:non-scaling-stroke;}
.g-tl,.g-br{cursor:nwse-resize;}
.g-tr,.g-bl{cursor:nesw-resize;}
.g-t,.g-b{cursor:ns-resize;}
.g-l,.g-r{cursor:ew-resize;}
.h.op{fill:#2B2B2B;stroke:var(--cream);stroke-width:1.6;vector-effect:non-scaling-stroke;}
.h.op.sel{fill:#fff;stroke:#2B2B2B;}

.bfoot{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;
  padding-top:8px;}
.tip{font-weight:600;font-size:10px;text-transform:uppercase;letter-spacing:.13em;opacity:.62;}

/* ---------- inspector ---------- */
.insp{border-top:2px solid var(--ink);padding-top:10px;position:sticky;top:12px;min-width:0;
  align-self:start;}
.insp h3{font-family:var(--display);font-weight:800;font-size:16px;letter-spacing:-.01em;}
.ihead{padding-bottom:12px;border-bottom:1px solid rgba(43,43,43,.3);margin-bottom:14px;}
.tag{display:block;font-weight:700;font-size:9.5px;text-transform:uppercase;letter-spacing:.16em;
  opacity:.6;margin-bottom:4px;}
.name{width:100%;background:transparent;border:0;border-bottom:1px solid rgba(43,43,43,.35);
  font-family:var(--display);font-weight:800;font-size:20px;letter-spacing:-.02em;color:var(--ink);
  padding:2px 0 5px;}
.name:focus{outline:none;border-bottom-color:var(--ink);}
.ifield{margin-bottom:16px;}
.ifield.two{display:grid;grid-template-columns:1fr 1fr;gap:10px;}
.ifield label{display:block;font-weight:700;font-size:9.5px;text-transform:uppercase;
  letter-spacing:.16em;opacity:.6;margin-bottom:6px;}
.segs{display:flex;flex-wrap:wrap;gap:6px;}
.hint{font-weight:600;font-size:11px;line-height:1.45;opacity:.68;margin-top:8px;}
.hint b{font-weight:800;opacity:1;}
.hint.arm{opacity:1;font-weight:800;background:var(--gold);padding:6px 8px;}
.read{font-weight:700;font-size:13px;}
.read.big{font-family:var(--display);font-weight:800;font-size:24px;letter-spacing:-.02em;}

.len{display:flex;align-items:stretch;border:1px solid var(--ink);}
.len input{flex:1 1 auto;min-width:0;width:100%;background:transparent;border:0;
  font-family:var(--text);font-weight:700;font-size:13px;color:var(--ink);padding:6px 8px;text-align:center;}
.len input:focus{outline:none;background:rgba(43,43,43,.06);}
.len button{background:transparent;border:0;padding:0 10px;font-weight:800;font-size:14px;line-height:1;}
.len button:hover{background:rgba(43,43,43,.1);}

.oplist{list-style:none;margin-top:10px;display:flex;flex-direction:column;gap:2px;}
.oplist li{display:flex;align-items:baseline;gap:8px;cursor:pointer;padding:5px 7px;
  font-weight:600;font-size:10.5px;text-transform:uppercase;letter-spacing:.1em;
  border:1px solid transparent;}
.oplist li:hover{background:rgba(43,43,43,.06);}
.oplist li.on{border-color:var(--ink);background:var(--gold);}
.oplist li b{font-weight:800;}
.oplist li span{margin-left:auto;opacity:.65;}
.oplist li.none{opacity:.5;cursor:default;}
.opedit{margin-top:10px;padding:10px;border:1px solid rgba(43,43,43,.3);
  display:flex;flex-direction:column;gap:8px;}
.opedit label{margin-bottom:0;}
.opedit .hint{margin-top:0;}

.ghost{background:transparent;border:1px solid rgba(43,43,43,.5);padding:7px 11px;
  font-family:var(--text);font-weight:700;font-size:10.5px;text-transform:uppercase;letter-spacing:.12em;}
.ghost:hover{border-color:var(--ink);background:rgba(43,43,43,.06);}
.ghost.sm{padding:6px 9px;font-size:9.5px;}
.ghost.danger:hover{background:var(--ink);color:var(--cream);border-color:var(--ink);}
.ifoot{display:flex;gap:6px;flex-wrap:wrap;padding-top:14px;border-top:1px solid rgba(43,43,43,.3);}

/* ---------- footer ---------- */
.foot{display:flex;align-items:center;justify-content:space-between;gap:20px;flex-wrap:wrap;
  margin-top:clamp(16px,2.2vh,30px);padding-top:12px;border-top:3px solid var(--ink);}
.sum{display:flex;align-items:baseline;gap:12px;flex-wrap:wrap;
  font-weight:600;font-size:10.5px;text-transform:uppercase;letter-spacing:.14em;}
.sum b{font-family:var(--display);font-weight:800;font-size:clamp(15px,1.5vw,22px);letter-spacing:-.01em;
  margin-left:6px;text-transform:none;}
.sum .arrow{font-size:16px;opacity:.5;}
.sum .delta{opacity:.7;padding-left:6px;border-left:1px solid rgba(43,43,43,.35);}
.footr{display:flex;gap:8px;align-items:center;}
.gonext{background:var(--ink);color:var(--cream);border:1px solid var(--ink);padding:9px 16px;
  font-family:var(--text);font-weight:800;font-size:11px;text-transform:uppercase;letter-spacing:.13em;}
.gonext:disabled{opacity:.34;cursor:not-allowed;}

/* ---------- narrow ---------- */
@media (max-width:1180px){
  .stage{grid-template-columns:minmax(0,1fr);}
  .insp{position:static;}
  .ifield.two{max-width:420px;}
}
@media (max-width:760px){
  .boards{grid-template-columns:1fr;}
  .headband h1{font-size:clamp(34px,12vw,60px);}
}
`;
