"use client";

/**
 * SPACE PLAN — Moving In, step 03: what fits. The last screen.
 *
 * The core moment of the app, and now the whole end of it: the verdict, the
 * decision, and the shopping list in one place. Splitting those across screens
 * asked someone to read "31 cm too wide", walk to another page, and remember
 * what they had just been told. They belong in one breath: it doesn't fit →
 * so sell it → so what goes there instead?
 *
 * It is built around one refusal: NOT to say "doesn't fit" about two very
 * different situations. A piece that is too big for every room is a decision.
 * A piece merely standing in the wrong place is a puzzle, and the screen
 * offers to solve it instead of passing judgement.
 *
 * The palette answers one question per mark — WHOSE IS IT, and where is it
 * going:
 *   INK FILLED   — yours
 *   GOLD         — keeping it, and the Moving In colour throughout
 *   SAGE         — leaving you, for the marketplace
 *   INK OUTLINE  — not yours yet: a piece you are planning to buy
 *
 * Sage was briefly used for both directions of the market, on the theory that
 * furniture arriving and furniture departing are the same idea. They are, but
 * two identical colours on one screen read as one thing, and being read beats
 * being clever.
 *
 * The planned pieces were drawn as DASHED outlines for a while, which did keep
 * them apart from the ink of the things you own — but a dash is a whisper. It
 * says "provisional, don't look at me", when the whole point of the block is to
 * imagine something arriving. They are drawn as SOLID outlines now: the same
 * confident line every other piece has, just not filled in yet. Filled means
 * you have it, hollow means you do not — and no fourth colour was needed to
 * say so, which matters, because the palette is four colours and every one of
 * them already has a job.
 *
 * The panel is two blocks, not one long list — WHAT YOU OWN, and WHAT YOU ARE
 * PLANNING. They are different kinds of thinking and they should not run into
 * each other. Inside the first, the problem groups drain into the three piles
 * as you decide, so the screen gets simpler the further you get.
 */

import { useEffect, useMemo, useState } from "react";
import RoomLayer, { MOBILE_CSS, PLAN_CSS } from "./RoomLayer";
import { FlipGrip, RotateGrip, ViewTools, useCanvasView } from "./canvasView";
import { FURNITURE } from "../lib/furniture";
import Catalogue, { CATALOGUE_CSS } from "./Catalogue";
import {
  fmtArea, fmtLen, homeArea, inputLen, migrateRoom, nudgeStep, parseLen, snap,
} from "../lib/plan";
import {
  artTransform, findSpot, footprint, itemRect, makeItem, rotated, snapItem,
} from "../lib/furnish";
import { FITS, MOVE, NEVER, judgeAll, longestWall } from "../lib/verdict";

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

/**
 * ONE LIST, sorted. There used to be five headed groups here and the screen
 * read as work before you had done any. A pile does not need a title: put the
 * same-coloured rows next to each other and the eye groups them for free.
 *
 * Order is what needs you first: things that cannot come, then things standing
 * in the wrong place, then the three piles.
 */
const ORDER = { problem: 0, move: 1, keep: 2, sell: 3, toss: 4 };

/**
 * A piece has TWO positions, because it lives in two different rooms of two
 * different flats. `at` is where it stands today (step 02) and `to` is where it
 * would stand in the new place. They cannot be the same number: the new flat
 * has its own coordinates, and knowing where the sofa is now tells you nothing
 * about where it goes next.
 *
 * Everything shared — snapping, the fit test, the drawing — speaks `at`, so
 * this screen hands it items wearing `to` as their `at` and writes the answer
 * back to `to`. One adapter, and no other file has to know there are two.
 */
const inNew = (it) => ({ ...it, at: it.to ?? null });

const FATE_LABEL = { keep: "Keep", sell: "Sell", toss: "Toss" };
const FATE_LINE = {
  keep: "Coming with you.",
  sell: "Listed to sell — off the plan, on its way to someone nearby.",
  toss: "Not coming. Off the plan.",
};

export default function Verdict() {
  const [plan, setPlan] = useState(null);
  const [selId, setSelId] = useState(null);
  const [drag, setDrag] = useState(null);
  const v = useCanvasView();

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

  const rooms = plan?.homes.next.rooms || [];
  const all = plan?.inventory || [];
  const unit = plan?.unit || "cm";

  const owned = useMemo(() => all.filter((i) => !i.wish), [all]);
  const wishes = useMemo(() => all.filter((i) => i.wish), [all]);
  /** What is actually standing in the new place — sold and tossed are gone. */
  const standing = useMemo(
    () => all.filter((i) => i.to && i.fate !== "sell" && i.fate !== "toss").map(inNew),
    [all]
  );

  const verdicts = useMemo(
    () => judgeAll(owned.map(inNew), rooms, standing),
    [owned, rooms, standing]
  );
  /**
   * A piece that fits and has not been argued with is kept. Saying so out loud
   * means the Keep pile is the real answer to "what am I taking", not just the
   * things you happened to click.
   */
  const fateOf = (it) => it.fate || (verdicts.get(it.id)?.kind === FITS ? "keep" : null);
  const pile = (f) => owned.filter((it) => fateOf(it) === f);
  const fates = { keep: pile("keep").length, sell: pile("sell").length, toss: pile("toss").length };

  const framed = useState({ done: false })[0];
  useEffect(() => {
    if (framed.done || !rooms.length) return;
    framed.done = true;
    v.fitTo(rooms);
  }, [rooms, v, framed]);

  /* Nothing has ever been moved into the new place, so make the first attempt
     rather than opening on an empty flat and an empty verdict. */
  const seeded = useState({ done: false })[0];
  useEffect(() => {
    if (seeded.done || !rooms.length || !all.length) return;
    seeded.done = true;
    if (all.some((i) => i.to)) return;
    setPlan((p) => {
      const down = [];
      return {
        ...p,
        inventory: p.inventory.map((it) => {
          const to = findSpot(inNew(it), rooms, down);
          if (!to) return it;
          down.push({ ...inNew(it), at: to });
          return { ...it, to };
        }),
      };
    });
  }, [rooms, all, seeded]);

  const setItem = (id, patch) =>
    setPlan((p) => ({ ...p, inventory: p.inventory.map((i) => (i.id === id ? { ...i, ...patch } : i)) }));

  /**
   * Deciding moves the furniture, not just a label. Sell or toss and it leaves
   * the drawing at once — because it is leaving. Keep it and it comes back,
   * finding itself a spot if it had none.
   */
  const decide = (it, fate) => {
    const next = fate === it.fate ? null : fate;
    if (next === "sell" || next === "toss") return setItem(it.id, { fate: next, to: null });
    const to = it.to || findSpot(inNew(it), rooms, standing);
    setItem(it.id, { fate: next, to });
  };

  /** A piece you do not own yet, to try in the space something else vacated. */
  const want = (key) => {
    const it = { ...makeItem(key), wish: true };
    it.to = findSpot(it, rooms, standing);
    setPlan((p) => ({ ...p, inventory: [...p.inventory, it] }));
    setSelId(it.id);
  };

  const forget = (id) => {
    setPlan((p) => ({ ...p, inventory: p.inventory.filter((i) => i.id !== id) }));
    setSelId((s) => (s === id ? null : s));
  };

  /* ------------------------------------------------------------- dragging */
  const startDrag = (e, info) => {
    e.stopPropagation();
    e.preventDefault();
    const pt = v.toCm(e);
    const wantsPan = info.mode === "sheet" && (e.button === 1 || e.shiftKey);
    if (info.mode === "sheet" && !wantsPan) return setSelId(null);
    if (info.mode === "item") setSelId(info.id);
    setDrag({ ...info, mode: wantsPan ? "pan" : info.mode, start: pt, view0: v.view, clientX0: e.clientX, clientY0: e.clientY });
  };

  useEffect(() => {
    if (!drag) return;
    const move = (ev) => {
      if (drag.mode === "pan") {
        const r = v.svgRef.current.getBoundingClientRect();
        const perPx = drag.view0.w / r.width;
        v.setView({
          x: drag.view0.x - (ev.clientX - drag.clientX0) * perPx,
          y: drag.view0.y - (ev.clientY - drag.clientY0) * perPx,
          w: drag.view0.w,
        });
        return;
      }
      if (drag.mode !== "item") return;
      const pt = v.toCm(ev);
      const it = all.find((i) => i.id === drag.id);
      if (!it) return;
      const f = footprint(it);
      const raw = {
        x: snap(drag.orig.x + pt.x - drag.start.x, "cm"),
        y: snap(drag.orig.y + pt.y - drag.start.y, "cm"),
        w: f.w,
        d: f.d,
      };
      setItem(drag.id, { to: snapItem(raw, rooms, standing, drag.id) });
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
  }, [drag, all, standing, rooms, v]);

  useEffect(() => {
    const key = (e) => {
      if (e.target.tagName === "INPUT") return;
      if (e.key === "Escape") setSelId(null);
      if ((e.key === "r" || e.key === "R") && selId) {
        const it = all.find((i) => i.id === selId);
        if (it) setItem(selId, rotated(it));
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [selId, all]);

  if (!plan) return <div style={{ minHeight: "100vh", background: "#ECE8E3" }} />;

  /** What this piece is, in one word — swatch, sort order and tag all agree. */
  const stateOf = (it) => {
    if (it.fate) return it.fate;
    const k = verdicts.get(it.id)?.kind;
    if (k === NEVER) return "problem";
    if (k === MOVE) return "move";
    return "keep";
  };
  const sorted = owned
    .slice()
    .sort((a, b) => ORDER[stateOf(a)] - ORDER[stateOf(b)] || a.name.localeCompare(b.name));

  const ready = rooms.length > 0 && owned.length > 0;
  const sel0 = all.find((i) => i.id === selId) || null;
  const selected = sel0 && sel0.to ? inNew(sel0) : null;

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
          <h1>Plan new place</h1>
          <div className="steps">
            {STEPS.map((s, i) => (
              <a key={s.label} className={"step" + (i === 2 ? " on" : "")} href={s.href}>
                {s.label}
              </a>
            ))}
          </div>
        </header>

        {!ready ? (
          <div className="blank">
            <h2>{rooms.length === 0 ? "The new place is still empty" : "Nothing to check yet"}</h2>
            <p>
              {rooms.length === 0
                ? "Draw the rooms you are moving into — this step moves your furniture into them."
                : "Record what you own in step 02 and this step will tell you what makes it and what doesn't."}
            </p>
            <a className="gonext" href={rooms.length === 0 ? "/draw-room" : "/furniture"}>
              {rooms.length === 0 ? "← Back to the plans" : "← Back to your place"}
            </a>
          </div>
        ) : (
          <>
            {/* NO SCOREBOARD. There was a band here reading "1 of 2 pieces fit",
                with chips counting the failures and a button offering to shove
                everything into place at once. It was the page shouting a total
                at you before you had looked at a single thing — and the total
                is not the point. Every piece says its own piece in its own row,
                and the plan below shows the truth at full size. One rule under
                the title now, the same single rule the other screens have. */}
            {/* The title names the place; this says what you are doing in it.
                Without a line here the screen is a drawing and a list, and
                nothing tells you that the list is a decision. */}
            <div className="toolbar">
              <p className="lede">
                <span>Everything you own is in the new place — keep it, sell it, or let it go.</span>
                <span>Or plan something new in the space it leaves.</span>
              </p>
            </div>

            <div className="stage">
              <div className="canvasbox" ref={v.boxRef}>
                <svg ref={v.svgRef} viewBox={v.vb.join(" ")} className="canvas">
                  <RoomLayer
                    rooms={rooms} vb={v.vb} u={v.u} pxPerCm={v.pxPerCm} unit={unit}
                    idPrefix="verdict" labels="none"
                    onSheetDown={(e) => startDrag(e, { mode: "sheet" })}
                    onRoomDown={(e) => startDrag(e, { mode: "sheet" })}
                  />

                  <g pointerEvents="none">
                    {standing.map((it) => {
                      if (verdicts.get(it.id)?.code !== "door") return null;
                      const r = itemRect(it);
                      return <rect key={it.id + "w"} className="clash" x={r.x} y={r.y} width={r.w} height={r.d} />;
                    })}
                  </g>

                  <g>
                    {standing.map((it) => {
                      const j = verdicts.get(it.id);
                      const r = itemRect(it);
                      const f = FURNITURE[it.key];
                      const cut = f.topCut ? `<g class="fcut" fill="none"><path d="${f.topCut}"/></g>` : "";
                      const tone = it.wish ? "wish" : it.fate === "keep" ? FITS : j ? j.kind : FITS;
                      return (
                        <g key={it.id}>
                          {it.id === selId && (
                            <rect className="halo" x={r.x - 5 * v.u} y={r.y - 5 * v.u}
                              width={r.w + 10 * v.u} height={r.d + 10 * v.u} strokeWidth={2 * v.u} />
                          )}
                          <g
                            className={"item " + tone}
                            transform={artTransform(it)}
                            onPointerDown={(e) => startDrag(e, { mode: "item", id: it.id, orig: { ...it.at } })}
                            onDoubleClick={() => setItem(it.id, rotated(it))}
                            dangerouslySetInnerHTML={{ __html: f.top + cut }}
                          />
                        </g>
                      );
                    })}
                  </g>

                  <g className="tags" pointerEvents="none">
                    {rooms.map((r) => {
                      const p = r.parts.reduce((m, q) => (q.w * q.d > m.w * m.d ? q : m), r.parts[0]);
                      if (p.w * v.pxPerCm < 60) return null;
                      const pad = 9 * v.u;
                      return (
                        <g key={r.id} transform={`translate(${p.x + pad} ${p.y + pad})`}>
                          <rect width={(r.name.length * 7.6 + 14) * v.u} height={15 * v.u} className="tagbg" />
                          <text x={6 * v.u} y={8 * v.u} className="tagtx" fontSize={9.5 * v.u} letterSpacing={0.9 * v.u}>
                            {r.name}
                          </text>
                        </g>
                      );
                    })}
                  </g>

                  {selected?.at && (
                    <FlipGrip
                      x={itemRect(selected).x}
                      y={itemRect(selected).y}
                      size={HANDLE_PX * 2.2 * v.u}
                      on={selected.flip}
                      onPointerDown={(e) => {
                        e.stopPropagation();
                        setItem(selected.id, { flip: !selected.flip });
                      }} />
                  )}
                  {selected?.at && (
                    <RotateGrip
                      x={itemRect(selected).x + itemRect(selected).w}
                      y={itemRect(selected).y}
                      size={HANDLE_PX * 2.2 * v.u}
                      onPointerDown={(e) => { e.stopPropagation(); setItem(selected.id, rotated(selected)); }} />
                  )}
                </svg>
                <div className="undercanvas">
                  <span className="tip">
                    <b className="key ink" /> yours <b className="key hollow" /> to buy · drag to move · double-click to turn
                  </span>
                  <ViewTools pct={v.pct} zoomAt={v.zoomAt} onFit={() => v.fitTo(rooms)} />
                </div>
              </div>

              {/* THREE BLOCKS, in the order the work actually happens: settle
                  what you already own, notice what is missing, go and find it.
                  The library is its own block — it used to sit inside Plan new
                  furniture, which made one block that was half a list of
                  decisions and half a shop, and you could not tell where the
                  things you had chosen ended and the things on offer began.

                  YOUR FINAL LIST, not "what you own". Step 02 is where you take
                  stock; by the time you are here the question is no longer what
                  you have, it is what you have settled on. The same words on
                  both screens would say nothing had moved. */}
              <aside className="insp">
                <section className="block own">
                  <h2 className="blockhead">Your final list <b>{owned.length}</b></h2>
                  <ul className="rows">
                    {sorted.map((it, i) => (
                      <Row key={it.id} it={it} unit={unit}
                        why={it.fate ? { why: FATE_LINE[it.fate] } : verdicts.get(it.id)}
                        state={stateOf(it)} fate={fateOf(it)}
                        rule={i > 0 && stateOf(sorted[i - 1]) !== stateOf(it)}
                        open={it.id === selId}
                        onOpen={() => setSelId(it.id === selId ? null : it.id)}
                        onDecide={(f) => decide(it, f)} />
                    ))}
                  </ul>
                </section>

                <section className="block buy">
                  <h2 className="blockhead">Plan new furniture <b>{wishes.length}</b></h2>
                  {wishes.length > 0 ? (
                    <ul className="rows">
                      {wishes.map((it) => (
                        <Row key={it.id} it={it} unit={unit} state="wish"
                          open={it.id === selId}
                          onOpen={() => setSelId(it.id === selId ? null : it.id)}
                          setItem={setItem} onForget={() => forget(it.id)} />
                      ))}
                    </ul>
                  ) : (
                    <p className="hint">Pick anything from the library below to try it in the plan.</p>
                  )}
                </section>

                <section className="block">
                  <h2 className="blockhead">Furniture library</h2>
                  <Catalogue onPick={want} verb="Want" />
                </section>
              </aside>
            </div>
          </>
        )}

        {/* ONE DOOR TO THE MARKET, and this is it. There used to be a second
            link buried in the panel — "Look for these in the market" — which
            asked you to leave in the middle of deciding, and carried only half
            the story: the things you had marked to SELL had no way out at all.
            Both directions of the market are the same errand and it comes after
            the deciding, so the footer counts what is going and the button
            takes it. */}
        <footer className="foot">
          <div className="sum">
            <span>New place <b>{fmtArea(homeArea(rooms), unit)}</b></span>
            {fates.sell > 0 && <span className="delta">{fates.sell} to sell</span>}
            {wishes.length > 0 && <span className="delta">{wishes.length} to look for</span>}
            <span className="delta">Longest clear run <b>{fmtLen(longestWall(rooms), unit)}</b></span>
          </div>
          <div className="footr">
            <a className="ghost" href="/furniture">← Back</a>
            <a className="gonext" href="/plan">Next →</a>
          </div>
        </footer>
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ rows */

/**
 * One row, one piece. Collapsed it says only what you scan for: a swatch, a
 * name, a size. Open it says why, and offers the decision. The old version put
 * a heading, a paragraph and a count above every handful of these.
 */
function Row({ it, unit, why, state, fate, rule, open, onOpen, onDecide, setItem, onForget }) {
  const f = footprint(it);
  const wish = state === "wish";
  return (
    <li className={"row " + state + (open ? " on" : "") + (rule ? " rule" : "")}>
      {open && wish ? (
        <div className="rhead open">
          <span className={"swatch " + state} />
          <input className="rename" value={it.name}
            onChange={(e) => setItem(it.id, { name: e.target.value })} />
          <span className="size">{fmtLen(f.w, unit)} × {fmtLen(f.d, unit)}</span>
        </div>
      ) : (
        <button className="rhead" onClick={onOpen}>
          <span className={"swatch " + state} />
          <b>{it.name}</b>
          <span className="size">{fmtLen(f.w, unit)} × {fmtLen(f.d, unit)}</span>
        </button>
      )}

      {open && (
        <div className="rbody">
          {why?.why && <p className="why">{why.why}</p>}
          {why?.have && why?.need && <Compare need={why.need} have={why.have} unit={unit} code={why.code} />}
          {wish ? (
            <>
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
              <button className="ghost sm" onClick={onForget}>Don&apos;t want it after all</button>
            </>
          ) : (
            <div className="decide">
              {["keep", "sell", "toss"].map((k) => (
                <button key={k} className={"seg fate-" + k + (fate === k ? " on" : "")} onClick={() => onDecide(k)}>
                  {FATE_LABEL[k]}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </li>
  );
}

/** Two bars, to scale, so the shortfall is a length and not a sentence. */
function Compare({ need, have, unit, code }) {
  const max = Math.max(need.w, have.w, need.d || 0, have.d || 0) || 1;
  const rows = code === "doorway"
    ? [["Slimmest way through", need.w], ["Door allows", have.w]]
    : [["It needs", need.w], ["Room has", have.w], ["It needs", need.d], ["Room has", have.d]];
  return (
    <div className="cmp">
      {rows.map(([label, val], i) => (
        <div className="cmprow" key={i}>
          <span className="cmplab">{label}</span>
          <span className="cmpbar">
            <span className={"cmpfill" + (i % 2 === 0 ? " need" : " have")} style={{ width: `${(val / max) * 100}%` }} />
          </span>
          <span className="cmpval">{fmtLen(val, unit)}</span>
        </div>
      ))}
    </div>
  );
}

function LenInput({ cm, unit, onCommit }) {
  const [draft, setDraft] = useState(inputLen(cm, unit));
  const [live, setLive] = useState(false);
  useEffect(() => {
    if (!live) setDraft(inputLen(cm, unit));
  }, [cm, unit, live]);
  const commit = (text) => {
    const val = parseLen(text, unit);
    if (isFinite(val)) onCommit(val);
    setDraft(inputLen(isFinite(val) ? val : cm, unit));
  };
  return (
    <div className="len">
      <button onClick={() => onCommit(cm - nudgeStep(unit))} aria-label="less">−</button>
      <input value={draft} onFocus={() => setLive(true)} onChange={(e) => setDraft(e.target.value)}
        onBlur={(e) => { setLive(false); commit(e.target.value); }}
        onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }} />
      <button onClick={() => onCommit(cm + nudgeStep(unit))} aria-label="more">+</button>
    </div>
  );
}

const CSS = `
/* grid-template-rows is not decoration: a grid row defaults to max-content, so
   without it the panel grows past the bottom of the page and paints over the
   footer instead of scrolling inside itself. */
/* the gap under the title and the gap under this line match — see DrawRoom */
.toolbar{margin-bottom:clamp(16px,2.6vh,32px);flex:0 0 auto;}
.lede{max-width:78ch;font-size:clamp(12.5px,1.02vw,15px);font-weight:600;line-height:1.45;}
.lede span{display:block;}

.stage{display:grid;grid-template-columns:minmax(0,1fr) 340px;grid-template-rows:minmax(0,1fr);
  gap:clamp(14px,1.8vw,26px);align-items:stretch;min-height:0;}
.undercanvas{display:flex;align-items:center;justify-content:space-between;gap:12px;
  flex-wrap:wrap;padding:8px 10px;border-top:1px solid rgba(39,40,41,.3);}
/* a sentence you read, so no caps — the same treatment the measurements get
   on step 01 and the sizes get on step 02 */
.tip{font-weight:600;font-size:10px;opacity:.75;display:flex;align-items:center;gap:5px;}
.key{width:11px;height:11px;display:inline-block;}
.key.ink{background:#272829;}
.key.hollow{background:transparent;border:2px solid #4F5966;}

.item{fill:#272829;cursor:move;}
.item.never{fill:#87929F;}
.item.move{fill:#AE9159;}
/* not yours yet: hollow, but drawn with the SAME solid line as everything
   else. The dash was doing two jobs at once — "not yours" and "not sure" —
   and only one of them was true. */
.item.wish{fill:none;stroke:#4F5966;stroke-width:3.5;stroke-linejoin:round;}
.item.wish .fcut{display:none;}
.item .fcut{stroke:var(--floor);stroke-width:2.6;stroke-linecap:round;fill:none;}
.halo{fill:none;stroke:#272829;stroke-dasharray:7 5;}
.clash{fill:rgba(135,146,159,.55);}
.tagbg{fill:var(--cream);}
.tagtx{fill:#272829;font-family:'Archivo Narrow',sans-serif;font-weight:800;
  dominant-baseline:middle;}

/* align-self:stretch undoes the shared sheet's align-self:start — without it
   the panel is sized by its content, so a long shopping list runs off the
   bottom of the page instead of scrolling inside its own column */
.insp{display:flex;flex-direction:column;gap:16px;min-width:0;min-height:0;
  align-self:stretch;overflow-y:auto;padding-right:4px;}
.block{border-top:3px solid var(--ink);padding-top:8px;}
/* the first block sits directly under the headband rule, and two identical
   3px rules 25px apart read as one badly-drawn double line */
.insp .block:first-child{border-top:0;padding-top:0;}
.blockhead{font-family:var(--display);font-weight:800;letter-spacing:-.02em;font-size:17px;
  display:flex;align-items:center;gap:8px;margin-bottom:6px;}
.blockhead b{margin-left:auto;font-weight:800;font-size:12px;opacity:.55;}

/* one row per piece; a rule appears wherever the pile changes, which is all
   the grouping five headings used to do */
.rows{list-style:none;}
.row{border-bottom:1px solid rgba(39,40,41,.14);}
.row.rule{border-top:1px solid rgba(39,40,41,.5);}
.row.on{background:rgba(39,40,41,.05);}
/* The piece you are planning, while you are planning it — in the Moving In
   gold, the same colour the open catalogue folder below it already wears, so
   the whole block highlights in one voice.

   The colour goes on the NAME BAR only, not down the whole open body: a wash
   of colour behind two number fields and a button is a mood, not a highlight,
   and it drowns out the one thing it is meant to point at. */
.row.wish.on{background:transparent;}
.row.wish.on .rhead.open{background:var(--sage);}
.row.wish.on .rhead.open .size{opacity:.9;}
.row.wish.on .rename{border-bottom:1px solid rgba(39,40,41,.45);}
.rhead{width:100%;background:transparent;border:0;display:flex;align-items:center;gap:9px;
  padding:9px 4px;text-align:left;}
.row:not(.on) .rhead:hover{background:rgba(39,40,41,.05);}
.rhead b{font-weight:800;font-size:12.5px;letter-spacing:-.005em;
  min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.rhead .size{margin-left:auto;flex:0 0 auto;font-weight:600;font-size:10px;opacity:.7;
  white-space:nowrap;}
/* The swatch IS the decision, and it wears the decision's colour: gold for
   Keep — the Moving In gold, the same gold on the Keep button below it — sage
   filled for Sell, sage hollow for a piece arriving through the market, grey
   hollow for gone. */
.swatch{width:11px;height:11px;flex:0 0 auto;background:var(--ink);}
.swatch.problem{background:var(--sage);}
.swatch.move{background:#AE9159;}
.swatch.keep{background:var(--gold);border:1px solid rgba(39,40,41,.45);}
.swatch.sell{background:var(--sage);}
.swatch.toss{background:transparent;border:1px solid rgba(39,40,41,.4);}
.swatch.wish{background:transparent;border:2px solid var(--sage);}
.rbody{padding:0 4px 12px;display:flex;flex-direction:column;gap:9px;}
.why{font-weight:700;font-size:12px;line-height:1.4;}
.rbody .three{display:grid;grid-template-columns:1fr 1fr;gap:8px;align-items:end;}
.rbody .three .seg{padding:7px 4px;}
.flipcell{display:flex;align-items:flex-end;height:100%;}
.rhead.open{display:flex;align-items:center;gap:9px;padding:9px 6px;}
/* The rename field had no rule of its own here, so it fell back to the
   browser's default input: a white box with an inset border, sitting on the
   page like a form control someone forgot to style. */
.rename{width:100%;background:transparent;border:0;border-bottom:1px solid rgba(39,40,41,.4);
  font-family:var(--text);font-weight:800;color:var(--ink);padding:2px 0 3px;}
.rename:focus{outline:none;border-bottom-color:var(--ink);}
.rhead.open .rename{flex:1 1 auto;min-width:0;font-size:12.5px;letter-spacing:-.005em;
  font-family:var(--text);font-weight:800;}
.rbody label{display:block;font-weight:700;font-size:9px;text-transform:uppercase;
  letter-spacing:.16em;opacity:.6;margin-bottom:4px;}

/* Keep wears the Moving In colour: it is the pile that comes with you. */
.decide{display:flex;gap:5px;}
.decide .seg{flex:1 1 0;text-align:center;padding:7px 4px;}
.seg.fate-keep.on{background:var(--gold);color:var(--ink);border-color:var(--ink);}
.seg.fate-sell.on{background:var(--sage);color:var(--ink);border-color:var(--sage);}
.seg.fate-toss.on{background:transparent;color:var(--ink);border-style:dashed;border-width:2px;}

.seg.wide,.ghost.wide{display:block;width:100%;text-align:center;}

.cmp{display:flex;flex-direction:column;gap:3px;}
.cmprow{display:grid;grid-template-columns:74px 1fr 56px;align-items:center;gap:7px;}
.cmplab{font-weight:700;font-size:8.5px;text-transform:uppercase;letter-spacing:.1em;opacity:.6;}
.cmpbar{height:9px;background:rgba(39,40,41,.1);display:block;}
.cmpfill{display:block;height:100%;}
.cmpfill.need{background:var(--sage);}
.cmpfill.have{background:var(--ink);}
.cmpval{font-weight:700;font-size:9.5px;text-align:right;}

.blank{border-top:2px solid var(--ink);padding:40px 0;max-width:56ch;}
.blank h2{font-family:var(--display);font-weight:800;font-size:26px;letter-spacing:-.02em;margin-bottom:8px;}
.blank p{font-weight:600;font-size:13px;line-height:1.5;margin-bottom:16px;}

@media (max-width:1040px){ .stage{grid-template-columns:minmax(0,1fr);} }
`;
