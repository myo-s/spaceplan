"use client";

/**
 * SPACE PLAN — Moving In, step 02: your furniture, in the place you live now.
 *
 * This screen used to draw the NEW home and ask you to fill it, which put the
 * answer before the question: once a sofa has been placed in the new living
 * room, "will the sofa fit?" has already been answered by the act of placing
 * it. So step 02 is not a test any more. It is a RECORD.
 *
 * You lay your furniture out in the flat you are standing in — which you can
 * do from memory, because you can see it — and everything fits by definition,
 * because it is already there. Step 03 then takes that record and moves it
 * into the new place, which is where the real question lives.
 *
 * A side effect worth having: the current-place plan drawn in step 01 stops
 * being decoration and starts doing work.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import RoomLayer, { MOBILE_CSS, PLAN_CSS } from "./RoomLayer";
import { FURNITURE } from "../lib/furniture";
import Catalogue, { CATALOGUE_CSS } from "./Catalogue";
import { FlipGrip, RotateGrip, ViewTools, useCanvasView } from "./canvasView";
import {
  clamp, fmtArea, fmtLen, homeArea, homeBox, inputLen, migrateRoom,
  nudgeStep, parseLen, snap,
} from "../lib/plan";
import {
  ISSUE_TEXT, artTransform, findSpot, footprint, itemIssue, itemRect,
  makeItem, rotated, snapItem, tally,
} from "../lib/furnish";

const STORE = "spaceplan.plan.v4";
const HANDLE_PX = 9;

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

export default function Furnish() {
  const [plan, setPlan] = useState(null);
  const [selId, setSelId] = useState(null);
  const [drag, setDrag] = useState(null);
  const v = useCanvasView();
  const dragRef = useRef(null);
  dragRef.current = drag;

  /* ---------------------------------------------------------- persistence */
  useEffect(() => {
    let next = { unit: "cm", homes: { current: { rooms: [] }, next: { rooms: [] } }, inventory: [] };
    try {
      const raw = window.localStorage.getItem(STORE);
      if (raw) {
        const saved = JSON.parse(raw);
        if (saved?.homes?.current?.rooms) {
          next = {
            ...saved,
            homes: {
              current: { rooms: (saved.homes.current?.rooms || []).map(migrateRoom) },
              next: { rooms: (saved.homes.next?.rooms || []).map(migrateRoom) },
            },
            inventory: saved.inventory || [],
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

  const rooms = plan?.homes.current.rooms || [];
  /* Furniture you are only PLANNING to buy lives in the same inventory, because
     step 03 needs both in one list — but it has no business here. This screen
     records the room you are standing in, and a footstool you have not bought
     is not standing in it. It was being counted, drawn and listed as owned. */
  const items = (plan?.inventory || []).filter((i) => !i.wish);
  const unit = plan?.unit || "cm";
  const { vb, pxPerCm, u } = v;

  // frame the new place the first time it is seen
  const framed = useRef(false);
  useEffect(() => {
    if (framed.current || !rooms.length) return;
    framed.current = true;
    v.fitTo(rooms);
  }, [rooms, v]);

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
  const startDrag = (e, info) => {
    e.stopPropagation();
    e.preventDefault();
    const pt = v.toCm(e);
    const wantsPan = info.mode === "sheet" && (e.button === 1 || e.shiftKey);
    if (info.mode === "sheet" && !wantsPan) return setSelId(null);
    if (info.mode === "item") setSelId(info.id);
    setDrag({
      ...info,
      mode: wantsPan ? "pan" : info.mode,
      start: pt,
      view0: v.view,
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
        const r = v.svgRef.current.getBoundingClientRect();
        const perPx = d.view0.w / r.width;
        v.setView({
          x: d.view0.x - (ev.clientX - d.clientX0) * perPx,
          y: d.view0.y - (ev.clientY - d.clientY0) * perPx,
          w: d.view0.w,
        });
        return;
      }
      if (d.mode !== "item") return;
      const pt = v.toCm(ev);
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

  if (!plan) return <div style={{ minHeight: "100vh", background: "#ECE8E3" }} />;

  const issues = new Map(items.map((it) => [it.id, itemIssue(it, rooms, items)]));
  const count = tally(items, rooms);
  const selected = items.find((i) => i.id === selId) || null;
  const trouble = items.filter((it) => issues.get(it.id));

  return (
    <>
      <style>{PLAN_CSS + CATALOGUE_CSS + CSS + MOBILE_CSS}</style>
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
          <h1>Current place</h1>
          <div className="steps">
            {STEPS.map((s, i) =>
              s.href ? (
                <a key={s.label} className={"step" + (i === 1 ? " on" : "")} href={s.href}>
                  {s.label}
                </a>
              ) : (
                <span key={s.label} className="step">
                  {s.label}
                </span>
              )
            )}
          </div>
        </header>

        {rooms.length === 0 ? (
          <div className="blank">
            <h2>Your current place is still empty</h2>
            <p>
              Draw the rooms you live in now first — this step is where you record the
              furniture standing in them.
            </p>
            <a className="gonext" href="/draw-room">← Back to the plans</a>
          </div>
        ) : (
          <>
            <div className="toolbar">
              <p className="lede">
                <span>This is the place you live in now.</span>
                <span>Put your furniture roughly where it actually stands.</span>
                <span>The next step moves it all into the new place and tells you what makes it.</span>
              </p>
              <div className="tools">
                <div className="units">
                  <span className="lbl">Units</span>
                  <button className={"seg" + (unit === "cm" ? " on" : "")} onClick={() => setPlan((p) => ({ ...p, unit: "cm" }))}>cm</button>
                  <button className={"seg" + (unit === "ft" ? " on" : "")} onClick={() => setPlan((p) => ({ ...p, unit: "ft" }))}>ft / in</button>
                </div>
                <ViewTools pct={v.pct} zoomAt={v.zoomAt} onFit={() => v.fitTo(rooms)} />
              </div>
            </div>

            <div className="stage">
              {/* the drawing leads; the controls answer to it */}
              <div className="canvasbox" ref={v.boxRef}>
                <svg
                  ref={v.svgRef}
                  viewBox={vb.join(" ")}
                  className="canvas"
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
                    <FlipGrip
                      x={itemRect(selected).x}
                      y={itemRect(selected).y}
                      size={HANDLE_PX * 2.2 * u}
                      on={selected.flip}
                      onPointerDown={(e) => {
                        e.stopPropagation();
                        setItem(selected.id, { flip: !selected.flip });
                      }}
                    />
                  )}
                  {selected?.at && (
                    <RotateGrip
                      x={itemRect(selected).x + itemRect(selected).w}
                      y={itemRect(selected).y}
                      size={HANDLE_PX * 2.2 * u}
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

              <aside className="side">
                <section className="block">
                  <h2 className="blockhead">
                    What you own <b>{count.total}</b>
                  </h2>
                  {items.length === 0 && (
                    <p className="hint">Open a shelf below and pick what you have.</p>
                  )}
                  <ul className="inv">
                    {items.map((it) => {
                      const issue = issues.get(it.id);
                      const f = footprint(it);
                      return (
                        <li key={it.id} className={"invrow" + (it.id === selId ? " on" : "") + (issue ? " bad" : "")}>
                          {it.id === selId ? (
                            <div className="invhead open">
                              <input className="rename" value={it.name}
                                onChange={(e) => setItem(it.id, { name: e.target.value })} />
                              <span className="size">{fmtLen(f.w, unit)} × {fmtLen(f.d, unit)}</span>
                            </div>
                          ) : (
                            <button className="invhead" onClick={() => setSelId(it.id)}>
                              <b>{it.name}</b>
                              <span className="size">{fmtLen(f.w, unit)} × {fmtLen(f.d, unit)}</span>
                              {issue && <span className="flag">{ISSUE_TEXT[issue]}</span>}
                            </button>
                          )}

                          {it.id === selId && (
                            <div className="invbody">
                              <div className="three">
                                <div>
                                  <label>Width</label>
                                  <LenInput cm={it.w} unit={unit} onCommit={(x) => setItem(it.id, { w: Math.max(15, Math.round(x)) })} />
                                </div>
                                <div>
                                  <label>Depth</label>
                                  <LenInput cm={it.d} unit={unit} onCommit={(x) => setItem(it.id, { d: Math.max(15, Math.round(x)) })} />
                                </div>
                              </div>
                              {!it.at && (
                                <button className="seg" onClick={() => putInPlan(it.id)}>Put it in the plan</button>
                              )}
                              <button className="ghost sm danger" onClick={() => drop(it.id)}>
                                I don&apos;t own this
                              </button>
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </section>

                <section className="block">
                  <h2 className="blockhead">Furniture library</h2>
                  <Catalogue onPick={own} verb="Add" />
                </section>
              </aside>
            </div>
          </>
        )}

        <footer className="foot">
          {/* nothing here is a verdict: this screen only records what you have */}
          <div className="sum">
            <span>
              Recorded <b>{count.total}</b>
            </span>
            {count.trouble > 0 && (
              <span className="delta">{count.trouble} not placed yet</span>
            )}
            {rooms.length > 0 && (
              <span className="delta">
                Current place <b>{fmtArea(homeArea(rooms), unit)}</b>
              </span>
            )}
          </div>
          <div className="footr">
            <a className="ghost" href="/draw-room">← Back</a>
            <a className="gonext" href="/what-fits">
              Next →
            </a>
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
/* The gap under the title and the gap under this line should match. They were
   23px and 10px, which glued the sentence to the drawing and made it look like
   a caption for the thing below rather than a line of its own. */
.toolbar{display:flex;align-items:center;justify-content:space-between;gap:20px;
  flex-wrap:wrap;margin-bottom:clamp(16px,2.6vh,32px);flex:0 0 auto;}
.lede{max-width:70ch;font-size:clamp(12.5px,1.02vw,15px);font-weight:600;line-height:1.45;}
.lede span{display:block;}
.lede i{font-style:normal;font-weight:800;}
.tools{display:flex;align-items:center;gap:18px;flex-wrap:wrap;}

/* canvas first, controls second — the plan is the subject of the screen */
/* grid-template-rows is not decoration: a grid row defaults to max-content, so
   without it the panel grows past the bottom of the page and paints over the
   footer instead of scrolling inside itself. */
.stage{display:grid;grid-template-columns:minmax(0,1fr) 340px;grid-template-rows:minmax(0,1fr);
  gap:clamp(14px,1.8vw,26px);align-items:stretch;min-height:0;}
.side{min-width:0;display:flex;flex-direction:column;gap:16px;overflow-y:auto;
  padding-right:4px;}
.block{border-top:3px solid var(--ink);padding-top:8px;}
.blockhead{font-family:var(--display);font-weight:800;letter-spacing:-.02em;font-size:17px;
  display:flex;align-items:baseline;gap:8px;margin-bottom:6px;}
.blockhead b{margin-left:auto;font-weight:800;font-size:12px;opacity:.55;}


/* ---------- inventory ---------- */
.inv{list-style:none;display:flex;flex-direction:column;gap:3px;}
.invrow{border:1px solid transparent;}
.invrow.on{border-color:var(--ink);background:var(--gold);}
/* A NAME IS ONE LINE. "Dining table for eight" used to break across four of
   them, 39px wide, because the warning underneath it was a flex item claiming
   100% of the row and the name simply got out of its way. The row wraps now,
   so the warning takes its own line, and a name too long for the panel is
   trimmed with an ellipsis rather than folded up. */
.invhead{width:100%;background:transparent;border:0;display:flex;flex-wrap:wrap;
  align-items:baseline;gap:4px 8px;padding:6px 8px;text-align:left;}
.invrow:not(.on) .invhead:hover{background:rgba(39,40,41,.06);}
.invhead b{font-weight:800;font-size:12.5px;letter-spacing:-.005em;
  min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.invhead .size{margin-left:auto;flex:0 0 auto;font-weight:600;font-size:10px;opacity:.7;
  white-space:nowrap;}
/* The name stays INK. It was going sage when a piece had nowhere to stand,
   which said the wrong thing twice over: sage is the colour of furniture
   LEAVING you, and this is furniture you own and are keeping. The warning is
   the warning's job — it wears the Moving In gold, so it is impossible to miss
   without recolouring something that belongs to you. */
/* flex-basis 100% is what breaks the line; max-width:max-content is what stops
   the chip then painting the full width of the panel. Without the second half
   a list of five unplaced pieces is five gold bars and no list. */
.invhead .flag{flex:0 1 100%;max-width:max-content;font-weight:700;font-size:9px;
  text-transform:uppercase;letter-spacing:.12em;background:var(--gold);color:var(--ink);
  padding:2px 5px;}
.invbody{padding:2px 8px 10px;display:flex;flex-direction:column;gap:8px;}
.invbody .three{display:grid;grid-template-columns:1fr 1fr;gap:8px;align-items:end;}
.invbody .three .seg{padding:7px 4px;}
.flipcell{display:flex;align-items:flex-end;height:100%;}
.invhead.open{display:flex;align-items:baseline;gap:8px;padding:6px 8px;}
.invhead.open .rename{flex:1 1 auto;min-width:0;font-size:12.5px;letter-spacing:-.005em;
  font-family:var(--text);font-weight:800;}
.invbody label{display:block;font-weight:700;font-size:9px;text-transform:uppercase;
  letter-spacing:.16em;opacity:.6;margin-bottom:4px;}
.rename{width:100%;background:transparent;border:0;border-bottom:1px solid rgba(39,40,41,.4);
  font-family:var(--display);font-weight:800;font-size:15px;color:var(--ink);padding:2px 0 4px;}
.rename:focus{outline:none;border-bottom-color:var(--ink);}
.sagebox{border-left:4px solid var(--sage);padding-left:10px;}

/* ---------- furniture on the plan ---------- */
.item{fill:#272829;cursor:move;}
.item.bad{fill:#87929F;}
.item .fcut{stroke:var(--floor);stroke-width:2.6;stroke-linecap:round;fill:none;}
.item.bad .fcut{stroke:var(--floor);}
.halo{fill:none;stroke:#272829;stroke-dasharray:7 5;}
.tagbg{fill:var(--cream);}
.tagtx{fill:#272829;font-family:'Archivo Narrow',sans-serif;font-weight:800;
  dominant-baseline:middle;}
.sum .sage{color:#4F5966;}

.blank{border-top:2px solid var(--ink);padding:40px 0;max-width:52ch;}
.blank h2{font-family:var(--display);font-weight:800;font-size:26px;letter-spacing:-.02em;margin-bottom:8px;}
.blank p{font-weight:600;font-size:13px;line-height:1.5;margin-bottom:16px;}

@media (max-width:1000px){ .stage{grid-template-columns:minmax(0,1fr);} }
`;
