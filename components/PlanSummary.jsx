"use client";

/**
 * SPACE PLAN — Moving In, step 04: your plan.
 *
 * The last screen used to hand you straight to the Marketplace, which asked
 * you to leave the moment you finished thinking — and left you with no record
 * of what you had decided. This is that record. Everything settled on the
 * three screens before it, gathered into piles you can read in one look:
 * what is coming, what is being sold, what is being let go, what you still
 * have to find.
 *
 * It is also the page that has a REASON TO SIGN IN. The plan lives in this
 * browser and nowhere else, which is fine until you open your laptop and it is
 * gone. Saying so plainly here — next to the plan you have just spent an hour
 * on — is more honest and more persuasive than a banner on the front page.
 *
 * The Marketplace is reached FROM here, in both directions at once: the sell
 * pile is a listing, the find pile is a search, and they are the same errand.
 */

import { useEffect, useMemo, useState } from "react";
import RoomLayer, { MOBILE_CSS, PLAN_CSS } from "./RoomLayer";
import { useCanvasView } from "./canvasView";
import { fmtArea, fmtLen, homeArea, migrateRoom } from "../lib/plan";
import { FURNITURE } from "../lib/furniture";
import { artTransform, footprint } from "../lib/furnish";
import { FITS, judgeAll } from "../lib/verdict";
import { getAccount, savePlan } from "../lib/account";

const STORE = "spaceplan.plan.v4";

const STEPS = [
  { label: "Compare spaces", href: "/draw-room" },
  { label: "Current place", href: "/furniture" },
  { label: "Plan new place", href: "/what-fits" },
  { label: "Final plan", href: "/plan" },
];

const inNew = (it) => ({ ...it, at: it.to ?? null });

/**
 * The four piles, named with the SAME FOUR WORDS as the buttons that made
 * them. "Coming with you" was a nicer sentence and a worse label: you pressed
 * Keep on the screen before, so this screen has to say Keep, or you are left
 * matching a phrase to a memory of a button.
 */
const PILES = [
  { key: "keep", title: "Keep", tone: "keep" },
  { key: "sell", title: "Sell", tone: "sell" },
  { key: "toss", title: "Toss", tone: "toss" },
  { key: "find", title: "Buy new", tone: "wish" },
];

export default function PlanSummary() {
  const [plan, setPlan] = useState(null);
  const [saved, setSaved] = useState(false);
  const [account, setAccount] = useState(null);
  const v = useCanvasView();

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
    setAccount(getAccount());
  }, []);

  const rooms = plan?.homes.next.rooms || [];
  const current = plan?.homes.current.rooms || [];
  const all = plan?.inventory || [];
  const unit = plan?.unit || "cm";

  const owned = useMemo(() => all.filter((i) => !i.wish), [all]);
  const standing = useMemo(
    () => all.filter((i) => i.to && i.fate !== "sell" && i.fate !== "toss").map(inNew),
    [all]
  );
  const verdicts = useMemo(
    () => judgeAll(owned.map(inNew), rooms, standing),
    [owned, rooms, standing]
  );

  /* This screen READS the decision, it does not make one. The rule is exactly
     the rule step 03 uses — a piece that fits and has not been argued with is
     kept — so the two pages can never disagree about what you decided. */
  const fateOf = (it) => it.fate || (verdicts.get(it.id)?.kind === FITS ? "keep" : null);

  const piles = {
    keep: owned.filter((i) => fateOf(i) === "keep"),
    sell: owned.filter((i) => fateOf(i) === "sell"),
    toss: owned.filter((i) => fateOf(i) === "toss"),
    find: all.filter((i) => i.wish),
  };

  /* Frame it, and RE-frame it whenever the canvas changes shape. The first
     fit happens before the element has been measured, so it lands against a
     guessed aspect ratio and the flat ends up sitting high in a tall box. The
     other screens live with that because a person can zoom; this one has no
     zoom controls at all, so the framing has to be right by itself. */
  const framed = useState({ at: 0 })[0];
  useEffect(() => {
    if (!rooms.length) return;
    if (Math.abs(v.aspect - framed.at) < 0.02) return;
    framed.at = v.aspect;
    v.fitTo(rooms);
  }, [rooms, v, framed]);

  /**
   * Save means save TO YOUR ACCOUNT, and if there is no account this button is
   * the reason to make one — which is the only honest way to ask. It used to
   * download a JSON file, which was a fine backup and a terrible answer to
   * "where did my plan go".
   */
  const save = () => {
    if (!account) {
      window.location.href = "/signup";
      return;
    }
    savePlan(plan);
    setSaved(true);
  };

  if (!plan) return <div style={{ minHeight: "100vh", background: "#ECE8E3" }} />;

  const ready = rooms.length > 0 || owned.length > 0;

  return (
    <>
      <style>{PLAN_CSS + CSS + MOBILE_CSS}</style>
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
          <h1>Final plan</h1>
          <div className="steps">
            {STEPS.map((s, i) => (
              <a key={s.label} className={"step" + (i === 3 ? " on" : "")} href={s.href}>
                {s.label}
              </a>
            ))}
          </div>
        </header>

        {!ready ? (
          <div className="blank">
            <h2>There is no plan yet</h2>
            <p>Draw the place you are moving into, put your furniture in it, and this page
              will hold the answer.</p>
            <a className="gonext" href="/draw-room">← Start with both places</a>
          </div>
        ) : (
          <div className="stage">
            {/* the new place, one last time and small: the piles beside it are
                the answer, but the answer means nothing without the room */}
            <div className="canvasbox" ref={v.boxRef}>
              <svg ref={v.svgRef} viewBox={v.vb.join(" ")} className="canvas">
                <RoomLayer
                  rooms={rooms} vb={v.vb} u={v.u} pxPerCm={v.pxPerCm} unit={unit}
                  idPrefix="summary" labels="none"
                />
                {/* The furniture that is actually coming, standing where you
                    put it. An empty flat here would make the piles beside it
                    look like a shopping receipt rather than a plan. Nothing on
                    this screen is draggable: it is the record, not the desk. */}
                <g pointerEvents="none">
                  {standing.map((it) => {
                    const f = FURNITURE[it.key];
                    if (!f) return null;
                    const cut = f.topCut && !it.wish
                      ? `<g class="fcut" fill="none"><path d="${f.topCut}"/></g>`
                      : "";
                    return (
                      <g key={it.id} className={"item" + (it.wish ? " wish" : "")}
                        transform={artTransform(it)}
                        dangerouslySetInnerHTML={{ __html: f.top + cut }} />
                    );
                  })}
                </g>

                {/* names last and in the corner: centred labels vanish under
                    the furniture the moment a room is full */}
                <g className="tags" pointerEvents="none">
                  {rooms.map((r) => {
                    const q = r.parts.reduce((m, x) => (x.w * x.d > m.w * m.d ? x : m), r.parts[0]);
                    if (q.w * v.pxPerCm < 60) return null;
                    const pad = 9 * v.u;
                    return (
                      <g key={r.id} transform={`translate(${q.x + pad} ${q.y + pad})`}>
                        <rect width={(r.name.length * 7.6 + 14) * v.u} height={15 * v.u} className="tagbg" />
                        <text x={6 * v.u} y={8 * v.u} className="tagtx" fontSize={9.5 * v.u} letterSpacing={0.9 * v.u}>
                          {r.name}
                        </text>
                      </g>
                    );
                  })}
                </g>
              </svg>
              <div className="undercanvas">
                <span className="tip">
                  Current place {fmtArea(homeArea(current), unit)} → new place {fmtArea(homeArea(rooms), unit)}
                  {" · "}{rooms.length} room{rooms.length === 1 ? "" : "s"}
                </span>
                <a className="seg" href="/what-fits">Change something</a>
              </div>
            </div>

            <div className="detail">
              {/* SAVE IS PART OF THE PLAN, not part of the page furniture. It
                  used to sit in the footer next to the navigation, where it
                  read as one more link out; here it is the first thing at the
                  top of the list it saves. And it says what it really does —
                  the plan is in this browser and nowhere else until you either
                  take a copy or sign in. */}
              <div className="keep">
                <p className="keepline">
                  {saved
                    ? "Saved to your account."
                    : account
                    ? `Signed in as ${account.email}`
                    : "This plan lives in this browser only."}
                </p>
                <div className="keepbtns">
                  <button className="seg" onClick={save}>Save plan</button>
                  {account
                    ? <a className="seg" href="/login">My plans</a>
                    : <a className="seg" href="/login">Log in</a>}
                </div>
              </div>

              {/* ONE LIST. Four boxes in a two-by-two grid made four small
                  documents; this is one document with four paragraphs. The
                  headings do the grouping, the rules do the separating, and
                  every line sits on the same left edge — which is the only
                  reason a list of twenty things stays readable. */}
              <ul className="all">
                {PILES.map((p) =>
                  piles[p.key].length === 0 ? null : (
                    <li className="group" key={p.key}>
                      <h2 className={"grouphead " + p.tone}>
                        <span className={"swatch " + p.tone} />
                        {p.title}
                        <b>{piles[p.key].length}</b>
                      </h2>
                      <ul className="pilelist">
                        {piles[p.key].map((it) => {
                          const f = footprint(it);
                          return (
                            <li key={it.id}>
                              <b>{it.name}</b>
                              <span>{fmtLen(f.w, unit)} × {fmtLen(f.d, unit)}</span>
                            </li>
                          );
                        })}
                      </ul>
                    </li>
                  )
                )}
              </ul>
            </div>
          </div>
        )}

        <footer className="foot">
          <div className="sum">
            <span>Keeping <b>{piles.keep.length}</b></span>
            {piles.sell.length > 0 && <span className="delta">{piles.sell.length} to sell</span>}
            {piles.find.length > 0 && <span className="delta">{piles.find.length} to look for</span>}
          </div>
          <div className="footr">
            <a className="ghost" href="/what-fits">← Back</a>
            <a className="gonext" href="/marketplace">
              Take {piles.sell.length + piles.find.length} to the Marketplace →
            </a>
          </div>
        </footer>
      </div>
    </>
  );
}

const CSS = `
/* The drawing is the subject and takes the room. The list was half the page
   wide, which left a hand's width of empty paper between every name and its
   size — a gap that reads as a mistake rather than as alignment. */
.stage{display:grid;grid-template-columns:minmax(0,1fr) clamp(320px,29vw,440px);
  grid-template-rows:minmax(0,1fr);gap:clamp(14px,1.8vw,26px);align-items:stretch;}
.undercanvas{display:flex;align-items:center;justify-content:space-between;gap:12px;
  flex-wrap:wrap;padding:8px 10px;border-top:1px solid rgba(39,40,41,.3);flex:0 0 auto;}
.tip{font-weight:600;font-size:10px;opacity:.75;}

/* ONE COLUMN, one list. The four piles used to be four bordered boxes in a
   two-by-two grid, which turned a single list of your things into four little
   documents with four ragged left edges. Now every line hangs off the same
   edge and the headings are the only thing that groups them. */
.detail{min-width:0;min-height:0;overflow-y:auto;padding-right:4px;
  display:flex;flex-direction:column;}

/* keeping it: the first thing at the top of the list it saves */
.keep{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;
  padding-bottom:11px;border-bottom:3px solid var(--ink);flex:0 0 auto;}
.keepline{font-weight:700;font-size:11px;opacity:.75;}
.keepbtns{display:flex;gap:6px;flex:0 0 auto;}

.all{list-style:none;}
.group + .group{margin-top:16px;}
.grouphead{font-family:var(--display);font-weight:800;letter-spacing:-.02em;font-size:15px;
  display:flex;align-items:center;gap:8px;padding:10px 2px 5px;}
.grouphead b{margin-left:auto;font-weight:800;font-size:12px;opacity:.55;}
/* THREE COLOURS AND A FILL, and between them they say everything:
     GOLD          keeping it — the Moving In colour, the same gold the Keep
                   button wears on the screen before
     SAGE FILLED   leaving you through the market
     SAGE HOLLOW   arriving through the market. Same colour because it is the
                   same errand; hollow because it is not yours yet. Filled
                   against empty is the clearest opposition there is for two
                   things pointing in opposite directions.
     GREY HOLLOW   gone, and not through the market */
.swatch{width:11px;height:11px;flex:0 0 auto;background:var(--gold);
  border:1px solid rgba(39,40,41,.45);}
.swatch.sell{background:var(--sage);border-color:var(--sage);}
.swatch.toss{background:transparent;border:1px solid rgba(39,40,41,.4);}
.swatch.wish{background:transparent;border:2px solid var(--sage);}

.pilelist{list-style:none;}
/* the pieces that are coming, drawn once and not touchable */
.item{fill:#272829;}
.item .fcut{stroke:var(--floor);stroke-width:2.6;stroke-linecap:round;fill:none;}
.item.wish{fill:none;stroke:#4F5966;stroke-width:3.5;stroke-linejoin:round;}
.tagbg{fill:var(--cream);}
.tagtx{fill:#272829;font-family:'Archivo Narrow',sans-serif;font-weight:800;
  dominant-baseline:middle;}
.pilelist li{display:flex;align-items:baseline;gap:8px;padding:6px 2px;
  border-bottom:1px solid rgba(39,40,41,.14);}
/* every row indented to clear its heading's swatch, so the names line up with
   the words above them and not with the squares */
.pilelist li{padding-left:19px;}
/* a name is one line, trimmed rather than folded — same rule as every other list */
.pilelist li b{font-weight:800;font-size:12.5px;letter-spacing:-.005em;
  min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.pilelist li span{margin-left:auto;flex:0 0 auto;font-weight:600;font-size:10px;opacity:.7;
  white-space:nowrap;}

.blank{border-top:2px solid var(--ink);padding:40px 0;max-width:52ch;}
.blank h2{font-family:var(--display);font-weight:800;font-size:26px;letter-spacing:-.02em;margin-bottom:8px;}
.blank p{font-weight:600;font-size:13px;line-height:1.5;margin-bottom:16px;}

@media (max-width:1040px){
  .stage{grid-template-columns:minmax(0,1fr);grid-template-rows:auto auto;}
  .detail{overflow:visible;}
}
`;
