"use client";

/**
 * SPACE PLAN — Moving In, step 02: the furniture.
 *
 * The screen answers one question and puts everything else second: WILL IT GO
 * IN THE NEW PLACE? So there is only one plan on screen — the new one — and
 * the left column is simply the list of what you own. You never redraw the old
 * flat, because the old flat is not in question.
 *
 * Anything that cannot be made to stand on the new floor stays in the list,
 * drawn in SAGE — the marketplace colour. That is not decoration: a piece that
 * does not fit is a piece somebody nearby wants, and the colour is the app's
 * whole argument in one move.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import RoomLayer, { PLAN_CSS } from "./RoomLayer";
import { FURNITURE, CATALOGUE, elevationSvg } from "../lib/furniture";
import {
  clamp, fmtArea, fmtLen, homeArea, homeBox, inputLen, migrateRoom,
  nudgeStep, parseLen, snap,
} from "../lib/plan";
import {
  ISSUE_TEXT, artTransform, findSpot, footprint, itemIssue, itemRect,
  makeItem, rotated, snapItem, tally,
} from "../lib/furnish";

const STORE = "spaceplan.plan.v4";
const ASPECT = 0.7;
const MIN_VIEW = 220;
const MAX_VIEW = 4000;
const DEFAULT_VIEW = { x: -60, y: -60, w: 940 };
const HANDLE_PX = 9;

const STEPS = [
  { label: "Rooms", href: "/draw-room" },
  { label: "Furniture", href: "/furniture" },
  { label: "What fits", href: null },
  { label: "Keep / Sell / Toss", href: null },
  { label: "Preview", href: null },
];

export default function Furnish() {
  const [plan, setPlan] = useState(null);
  const [selId, setSelId] = useState(null);
  const [drag, setDrag] = useState(null);
  const [view, setView] = useState(DEFAULT_VIEW);
  const [panMode, setPanMode] = useState(false);
  const [boxPx, setBoxPx] = useState(700);
  const boxRef = useRef(null);
  const svgRef = useRef(null);
  const dragRef = useRef(null);
  const viewRef = useRef(view);
  dragRef.current = drag;
  viewRef.current = view;

  /* ---------------------------------------------------------- persistence */
  useEffect(() => {
    let next = { unit: "cm", homes: { current: { rooms: [] }, next: { rooms: [] } }, inventory: [] };
    try {
      const raw = window.localStorage.getItem(STORE);
      if (raw) {
        const s = JSON.parse(raw);
        if (s?.homes?.next?.rooms) {
          next = {
            ...s,
            homes: {
              current: { rooms: (s.homes.current?.rooms || []).map(migrateRoom) },
              next: { rooms: (s.homes.next?.rooms || []).map(migrateRoom) },
            },
            inventory: s.inventory || [],
          };
        }
      }
    } catch {}
    setPlan(next);
  }, []);

  useEffect(() => {
    if (!plan) return;
    try {
      window.localStorage.setItem(STORE, JSON.stringify(plan));
    } catch {}
  }, [plan]);

  useEffect(() => {
    const el = boxRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(([e]) => setBoxPx(Math.max(240, e.contentRect.width || 700)));
    ro.observe(el);
    return () => ro.disconnect();
  }, [plan]);

  const rooms = plan?.homes.next.rooms || [];
  const items = plan?.inventory || [];
  const unit = plan?.unit || "cm";
  const pxPerCm = boxPx / view.w;
  const vb = [view.x, view.y, view.w, view.w * ASPECT];
  const u = 1 / Math.max(pxPerCm, 0.001);

  const fitView = useCallback((rs) => {
    const box = homeBox(rs);
    if (!box.w || !box.d) return setView(DEFAULT_VIEW);
    const w = clamp(Math.max(box.w, box.d / ASPECT) * 1.18, MIN_VIEW, MAX_VIEW);
    setView({ x: box.x + box.w / 2 - w / 2, y: box.y + box.d / 2 - (w * ASPECT) / 2, w });
  }, []);

  // frame the new place the first time it is seen
  const framed = useRef(false);
  useEffect(() => {
    if (framed.current || !rooms.length) return;
    framed.current = true;
    fitView(rooms);
  }, [rooms, fitView]);

  const zoomAt = useCallback((factor, fx = 0.5, fy = 0.5) => {
    setView((v) => {
      const w = clamp(v.w * factor, MIN_VIEW, MAX_VIEW);
      if (w === v.w) return v;
      return { x: v.x + (v.w - w) * fx, y: v.y + (v.w * ASPECT - w * ASPECT) * fy, w };
    });
  }, []);

  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const onWheel = (e) => {
      e.preventDefault();
      const r = el.getBoundingClientRect();
      zoomAt(e.deltaY > 0 ? 1.12 : 1 / 1.12, (e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [zoomAt, plan]);

  /* -------------------------------------------------------------- edits */
  const setItems = useCallback((fn) => {
    setPlan((p) => ({ ...p, inventory: fn(p.inventory || []) }));
  }, []);

  const setItem = useCallback((id, patch) => {
    setItems((list) => list.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  }, [setItems]);

  const own = (key) => {
    const it = makeItem(key);
    it.at = findSpot(it, rooms, items);
    setItems((list) => [...list, it]);
    setSelId(it.id);
  };

  const duplicate = (id) => {
    const src = items.find((i) => i.id === id);
    if (!src) return;
    const copy = { ...makeItem(src.key), name: src.name, w: src.w, d: src.d, h: src.h, rot: src.rot };
    copy.at = findSpot(copy, rooms, items);
    setItems((list) => [...list, copy]);
    setSelId(copy.id);
  };

  const drop = (id) => {
    setItems((list) => list.filter((i) => i.id !== id));
    setSelId((s) => (s === id ? null : s));
  };

  const putInPlan = (id) => {
    const it = items.find((i) => i.id === id);
    if (!it) return;
    const at = findSpot(it, rooms, items);
    if (!at) return;
    setItem(id, { at });
    setSelId(id);
  };

  /* ------------------------------------------------------------ dragging */
  const toCm = (ev) => {
    const svg = svgRef.current;
    const r = svg.getBoundingClientRect();
    return {
      x: vb[0] + ((ev.clientX - r.left) / r.width) * vb[2],
      y: vb[1] + ((ev.clientY - r.top) / r.height) * vb[3],
    };
  };

  const startDrag = (e, info) => {
    e.stopPropagation();
    e.preventDefault();
    const pt = toCm(e);
    const wantsPan = info.mode === "sheet" && (panMode || e.button === 1 || e.shiftKey);
    if (info.mode === "sheet" && !wantsPan) return setSelId(null);
    if (info.mode === "item") setSelId(info.id);
    setDrag({
      ...info,
      mode: wantsPan ? "pan" : info.mode,
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
        const r = svgRef.current.getBoundingClientRect();
        const perPx = d.view0.w / r.width;
        setView({
          x: d.view0.x - (ev.clientX - d.clientX0) * perPx,
          y: d.view0.y - (ev.clientY - d.clientY0) * perPx,
          w: d.view0.w,
        });
        return;
      }
      if (d.mode !== "item") return;
      const pt = toCm(ev);
      const it = items.find((i) => i.id === d.id);
      if (!it) return;
      const f = footprint(it);
      const raw = {
        x: snap(d.orig.x + pt.x - d.start.x, "cm"),
        y: snap(d.orig.y + pt.y - d.start.y, "cm"),
        w: f.w,
        d: f.d,
      };
      setItem(d.id, { at: snapItem(raw, rooms, items, d.id) });
    };
    const up = () => setDrag(null);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
    };
  }, [drag, items, rooms, setItem]);

  /* ------------------------------------------------------------ keyboard */
  useEffect(() => {
    const key = (e) => {
      if (e.target.tagName === "INPUT") return;
      if (e.key === "Escape") setSelId(null);
      if ((e.key === "r" || e.key === "R") && selId) {
        const it = items.find((i) => i.id === selId);
        if (it) setItem(selId, rotated(it));
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [selId, items, setItem]);

  if (!plan) return <div style={{ minHeight: "100vh", background: "#F0EAD8" }} />;

  const issues = new Map(items.map((it) => [it.id, itemIssue(it, rooms, items)]));
  const count = tally(items, rooms);
  const selected = items.find((i) => i.id === selId) || null;
  const trouble = items.filter((it) => issues.get(it.id));

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
          <h1>Furniture</h1>
          <div className="steps">
            {STEPS.map((s, i) =>
              s.href ? (
                <a key={s.label} className={"step" + (i === 1 ? " on" : "")} href={s.href}>
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

        {rooms.length === 0 ? (
          <div className="blank">
            <h2>The new place is still empty</h2>
            <p>
              Draw the rooms you are moving into first — this step puts your furniture
              into them.
            </p>
            <a className="gonext" href="/draw-room">← Back to Rooms</a>
          </div>
        ) : (
          <>
            <div className="toolbar">
              <p className="lede">
                Add what you own on the left. Each piece lands in the new place, and you
                drag it where it goes — it clicks against walls and against other
                furniture. Anything that will not stand on the floor stays in the list, in{" "}
                <i>sage</i>.
              </p>
              <div className="tools">
                <div className="units">
                  <span className="lbl">Units</span>
                  <button className={"seg" + (unit === "cm" ? " on" : "")} onClick={() => setPlan((p) => ({ ...p, unit: "cm" }))}>cm</button>
                  <button className={"seg" + (unit === "ft" ? " on" : "")} onClick={() => setPlan((p) => ({ ...p, unit: "ft" }))}>ft / in</button>
                </div>
                <div className="units">
                  <span className="lbl">View</span>
                  <button className="seg" onClick={() => zoomAt(1 / 0.8)}>−</button>
                  <span className="zoomval">{Math.round((DEFAULT_VIEW.w / view.w) * 100)}%</span>
                  <button className="seg" onClick={() => zoomAt(0.8)}>+</button>
                  <button className="seg" onClick={() => fitView(rooms)}>Fit</button>
                  <button className={"seg" + (panMode ? " on" : "")} onClick={() => setPanMode((v) => !v)}>Pan</button>
                </div>
              </div>
            </div>

            <div className="stage">
              <aside className="side">
                <div className="ifield">
                  <label>Add what you own</label>
                  <div className="cat">
                    {CATALOGUE.map((key) => (
                      <button key={key} className="tile" onClick={() => own(key)} title={`Add ${FURNITURE[key].label}`}>
                        <span
                          className="tileart"
                          dangerouslySetInnerHTML={{ __html: elevationSvg(key, 200) }}
                        />
                        <span className="tilelab">{FURNITURE[key].label}</span>
                      </button>
                    ))}
                  </div>
                  <p className="hint">
                    Nothing matching? Add the closest thing and change its measurements —
                    the drawing follows the numbers.
                  </p>
                </div>

                <div className="ifield">
                  <label>
                    What you own · {count.total} piece{count.total === 1 ? "" : "s"}
                  </label>
                  {items.length === 0 && <p className="hint">Nothing yet.</p>}
                  <ul className="inv">
                    {items.map((it) => {
                      const issue = issues.get(it.id);
                      const f = footprint(it);
                      return (
                        <li
                          key={it.id}
                          className={
                            "invrow" + (it.id === selId ? " on" : "") + (issue ? " bad" : "")
                          }
                        >
                          <button className="invhead" onClick={() => setSelId(it.id === selId ? null : it.id)}>
                            <b>{it.name}</b>
                            <span className="size">
                              {fmtLen(f.w, unit)} × {fmtLen(f.d, unit)}
                            </span>
                            {issue && <span className="flag">{ISSUE_TEXT[issue]}</span>}
                          </button>

                          {it.id === selId && (
                            <div className="invbody">
                              <input
                                className="rename"
                                value={it.name}
                                onChange={(e) => setItem(it.id, { name: e.target.value })}
                              />
                              <div className="three">
                                <div>
                                  <label>Width</label>
                                  <LenInput cm={it.w} unit={unit} onCommit={(v) => setItem(it.id, { w: Math.max(15, Math.round(v)) })} />
                                </div>
                                <div>
                                  <label>Depth</label>
                                  <LenInput cm={it.d} unit={unit} onCommit={(v) => setItem(it.id, { d: Math.max(15, Math.round(v)) })} />
                                </div>
                                <div>
                                  <label>Height</label>
                                  <LenInput cm={it.h} unit={unit} onCommit={(v) => setItem(it.id, { h: Math.max(5, Math.round(v)) })} />
                                </div>
                              </div>
                              <div className="segs">
                                <button className="seg" onClick={() => setItem(it.id, rotated(it))}>Rotate 90°</button>
                                <button className="seg" onClick={() => duplicate(it.id)}>Duplicate</button>
                                {it.at ? (
                                  <button className="seg" onClick={() => setItem(it.id, { at: null })}>Take out</button>
                                ) : (
                                  <button className="seg" onClick={() => putInPlan(it.id)}>Put in plan</button>
                                )}
                              </div>
                              <button className="ghost sm danger" onClick={() => drop(it.id)}>
                                I don&apos;t own this
                              </button>
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </div>

                {trouble.length > 0 && (
                  <div className="ifield sagebox">
                    <label>Won&apos;t go in — {trouble.length}</label>
                    <p className="hint">
                      These are the pieces the move has to decide about. Step 04 turns them
                      into Keep, Sell or Toss.
                    </p>
                  </div>
                )}
              </aside>

              <div className="canvasbox" ref={boxRef}>
                <svg
                  ref={svgRef}
                  viewBox={vb.join(" ")}
                  className={"canvas" + (panMode ? " panning" : "")}
                >
                  <RoomLayer
                    rooms={rooms}
                    vb={vb}
                    u={u}
                    pxPerCm={pxPerCm}
                    unit={unit}
                    idPrefix="furnish"
                    labels="none"
                    onSheetDown={(e) => startDrag(e, { mode: "sheet" })}
                    onRoomDown={(e) => startDrag(e, { mode: "sheet" })}
                  />

                  {/* the furniture itself, drawn from the same centimetres the
                      marketplace and the fit test use */}
                  <g>
                    {items.map((it) => {
                      if (!it.at) return null;
                      const issue = issues.get(it.id);
                      const r = itemRect(it);
                      const f = FURNITURE[it.key];
                      const cut = f.topCut
                        ? `<g class="fcut" fill="none"><path d="${f.topCut}"/></g>`
                        : "";
                      return (
                        <g key={it.id}>
                          {it.id === selId && (
                            <rect
                              className="halo"
                              x={r.x - 5 * u}
                              y={r.y - 5 * u}
                              width={r.w + 10 * u}
                              height={r.d + 10 * u}
                              strokeWidth={2 * u}
                            />
                          )}
                          <g
                            className={"item" + (issue ? " bad" : "")}
                            transform={artTransform(it)}
                            onPointerDown={(e) =>
                              startDrag(e, { mode: "item", id: it.id, orig: { ...it.at } })
                            }
                            dangerouslySetInnerHTML={{ __html: f.top + cut }}
                          />
                        </g>
                      );
                    })}
                  </g>

                  {/* Room names go ON TOP of the furniture and in the corner —
                      once a room is full, a centred label is simply buried. */}
                  <g className="tags" pointerEvents="none">
                    {rooms.map((r) => {
                      const p = r.parts.reduce((m, q) => (q.w * q.d > m.w * m.d ? q : m), r.parts[0]);
                      if (p.w * pxPerCm < 60) return null;
                      const pad = 9 * u;
                      const wide = (r.name.length * 7.6 + 14) * u;
                      return (
                        <g key={r.id} transform={`translate(${p.x + pad} ${p.y + pad})`}>
                          <rect width={wide} height={15 * u} className="tagbg" />
                          <text x={6 * u} y={8 * u} className="tagtx" fontSize={9.5 * u} letterSpacing={0.9 * u}>
                            {r.name}
                          </text>
                        </g>
                      );
                    })}
                  </g>

                  {/* rotate grip on the selected piece */}
                  {selected?.at && (
                    <rect
                      className="rotgrip"
                      x={itemRect(selected).x + itemRect(selected).w - (HANDLE_PX * u) / 2}
                      y={itemRect(selected).y - (HANDLE_PX * u) / 2}
                      width={HANDLE_PX * u}
                      height={HANDLE_PX * u}
                      onPointerDown={(e) => {
                        e.stopPropagation();
                        setItem(selected.id, rotated(selected));
                      }}
                    />
                  )}

                  {items.length === 0 && (
                    <text x={vb[0] + vb[2] / 2} y={vb[1] + vb[3] - 34 * u} className="ghosttext" fontSize={14 * u}>
                      Add a piece from the list
                    </text>
                  )}
                </svg>
              </div>
            </div>
          </>
        )}

        <footer className="foot">
          <div className="sum">
            <span>
              Fits <b>{count.placed}</b>
            </span>
            <span className="arrow">/</span>
            <span>
              Owned <b>{count.total}</b>
            </span>
            {count.trouble > 0 && (
              <span className="delta sage">{count.trouble} still to sort out</span>
            )}
            {rooms.length > 0 && (
              <span className="delta">
                New place {fmtArea(homeArea(rooms), unit)}
              </span>
            )}
          </div>
          <div className="footr">
            <a className="ghost" href="/draw-room">← Rooms</a>
            <button className="gonext" disabled title="Coming in step 03">
              Next · What fits →
            </button>
          </div>
        </footer>
      </div>
    </>
  );
}

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

const CSS = `
.toolbar{display:flex;align-items:center;justify-content:space-between;gap:20px;
  flex-wrap:wrap;margin-bottom:16px;}
.lede{max-width:66ch;font-size:clamp(12.5px,1.02vw,15px);font-weight:600;line-height:1.5;}
.lede i{font-style:normal;font-weight:800;}
.tools{display:flex;align-items:center;gap:18px;flex-wrap:wrap;}

.stage{display:grid;grid-template-columns:330px minmax(0,1fr);gap:clamp(16px,2vw,30px);
  align-items:start;flex:1 1 auto;}
.side{border-top:2px solid var(--ink);padding-top:10px;min-width:0;}

/* ---------- catalogue ---------- */
.cat{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;}
.tile{background:transparent;border:1px solid rgba(43,43,43,.28);padding:7px 4px 5px;
  display:flex;flex-direction:column;align-items:center;gap:5px;min-width:0;}
.tile:hover{border-color:var(--ink);background:var(--gold);}
.tileart{display:flex;align-items:flex-end;justify-content:center;height:44px;width:100%;}
.tileart svg{height:100%;width:auto;max-width:100%;display:block;}
.tilelab{font-weight:700;font-size:8.5px;text-transform:uppercase;letter-spacing:.08em;
  text-align:center;line-height:1.2;opacity:.8;}

/* ---------- inventory ---------- */
.inv{list-style:none;display:flex;flex-direction:column;gap:3px;}
.invrow{border:1px solid transparent;}
.invrow.on{border-color:var(--ink);background:var(--gold);}
.invrow.bad .invhead b{color:#5C6F6A;}
.invhead{width:100%;background:transparent;border:0;display:flex;align-items:baseline;gap:8px;
  padding:6px 8px;text-align:left;}
.invrow:not(.on) .invhead:hover{background:rgba(43,43,43,.06);}
.invhead b{font-weight:800;font-size:11px;text-transform:uppercase;letter-spacing:.08em;}
.invhead .size{margin-left:auto;font-weight:600;font-size:10px;opacity:.7;white-space:nowrap;}
.invhead .flag{flex:0 0 100%;font-weight:700;font-size:9px;text-transform:uppercase;
  letter-spacing:.12em;color:#5C6F6A;}
.invrow.on .invhead .flag{color:#2B2B2B;}
.invbody{padding:2px 8px 10px;display:flex;flex-direction:column;gap:8px;}
.invbody .three{display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;}
.invbody label{margin-bottom:4px;}
.rename{width:100%;background:transparent;border:0;border-bottom:1px solid rgba(43,43,43,.4);
  font-family:var(--display);font-weight:800;font-size:15px;color:var(--ink);padding:2px 0 4px;}
.rename:focus{outline:none;border-bottom-color:var(--ink);}
.sagebox{border-left:4px solid var(--sage);padding-left:10px;}

/* ---------- furniture on the plan ---------- */
.item{fill:#2B2B2B;cursor:move;}
.item.bad{fill:#99ABA6;}
.item .fcut{stroke:var(--floor);stroke-width:2.6;stroke-linecap:round;fill:none;}
.item.bad .fcut{stroke:var(--floor);}
.halo{fill:none;stroke:#2B2B2B;stroke-dasharray:7 5;}
.tagbg{fill:var(--cream);}
.tagtx{fill:#2B2B2B;font-family:'Archivo Narrow',sans-serif;font-weight:800;
  text-transform:uppercase;dominant-baseline:middle;}
.rotgrip{fill:var(--cream);stroke:#2B2B2B;stroke-width:1.4;vector-effect:non-scaling-stroke;
  cursor:alias;}
.sum .sage{color:#5C6F6A;}

.blank{border-top:2px solid var(--ink);padding:40px 0;max-width:52ch;}
.blank h2{font-family:var(--display);font-weight:800;font-size:26px;letter-spacing:-.02em;margin-bottom:8px;}
.blank p{font-weight:600;font-size:13px;line-height:1.5;margin-bottom:16px;}

@media (max-width:1000px){
  .stage{grid-template-columns:minmax(0,1fr);}
  .side{order:2;}
}
`;
