"use client";

/**
 * SPACE PLAN — the plan drawing itself, shared by every step.
 *
 * Step 01 draws rooms to edit them; step 02 draws the same rooms to put
 * furniture in them; step 05 will draw them again. They must be the SAME
 * drawing or the app stops feeling like one thing, so the drawing lives here
 * and each step adds only its own overlay on top.
 *
 * Everything it needs to know is in the room data (lib/plan.js). It owns no
 * state and makes no decisions — it renders sheet, grid, floors, walls, the
 * seams that turn two boxes into one L-shaped room, and the openings.
 */

import {
  WALL, GRID, doorSwingPath, fmtArea, fmtLen, innerSeams, openingGapPath,
  openingGeom, roomArea, roomBox, windowPanePath,
} from "../lib/plan";

export default function RoomLayer({
  rooms,
  vb,                 // [x, y, w, h] of the viewBox, in cm
  u,                  // cm per px — keeps chrome one size at any zoom
  pxPerCm,
  unit,
  idPrefix = "p",
  selId = null,
  labels = "full",    // "full" | "name" | "none"
  onSheetDown,
  onRoomDown,
}) {
  const gid = `gaps-${idPrefix}`;
  const step = vb[2] > 1800 ? GRID * 2 : GRID;
  const grid = [];
  for (let x = Math.floor(vb[0] / step) * step; x < vb[0] + vb[2]; x += step) {
    grid.push(`M${x} ${vb[1]} V${vb[1] + vb[3]}`);
  }
  for (let y = Math.floor(vb[1] / step) * step; y < vb[1] + vb[3]; y += step) {
    grid.push(`M${vb[0]} ${y} H${vb[0] + vb[2]}`);
  }

  const openings = rooms.flatMap((r) =>
    r.openings.map((op) => ({ op, g: openingGeom(r, op) })).filter((o) => o.g)
  );

  const floors = (suffix, interactive) =>
    rooms.flatMap((r) =>
      r.parts.map((p, i) => (
        <rect
          key={r.id + i + suffix}
          x={p.x}
          y={p.y}
          width={p.w}
          height={p.d}
          className={"floor" + (r.id === selId ? " on" : "")}
          onPointerDown={interactive && onRoomDown ? (e) => onRoomDown(e, r) : undefined}
        />
      ))
    );

  return (
    <>
      <defs>
        <clipPath id={gid}>
          {openings.map(({ op, g }) => (
            <path key={op.id} d={openingGapPath(g, WALL)} />
          ))}
        </clipPath>
      </defs>

      <rect
        x={vb[0]}
        y={vb[1]}
        width={vb[2]}
        height={vb[3]}
        className="sheet"
        onPointerDown={onSheetDown}
      />
      <g className="gridlines" strokeWidth={u}>
        <path d={grid.join(" ")} />
      </g>

      {/* floors, then walls on top: two boxes that touch stroke the same
          boundary twice, so a shared wall comes out as one wall */}
      <g>{floors("", true)}</g>
      <g className="walls" strokeWidth={WALL}>
        {rooms.flatMap((r) =>
          r.parts.map((p, i) => (
            <rect key={r.id + i} x={p.x} y={p.y} width={p.w} height={p.d} />
          ))
        )}
      </g>

      {/* paint the wall back OUT between boxes of the same room — this is the
          whole trick that turns two rectangles into one L-shaped room */}
      <g>
        {rooms.flatMap((r) =>
          innerSeams(r.parts, WALL).map((s, i) => {
            // bleed sideways over the floor either side, so no antialiased
            // hairline of the old wall survives along the seam
            const vertical = s.d > s.w;
            const b = 1.6;
            return (
              <rect
                key={r.id + "seam" + i}
                x={vertical ? s.x - b : s.x}
                y={vertical ? s.y : s.y - b}
                width={vertical ? s.w + b * 2 : s.w}
                height={vertical ? s.d : s.d + b * 2}
                className={"floor" + (r.id === selId ? " on" : "")}
                pointerEvents="none"
              />
            );
          })
        )}
      </g>

      {/* re-lay the sheet and the floors, but only inside the openings — that
          punches every door and window through in the right colour, including
          the ones in a wall shared by two rooms */}
      {openings.length > 0 && (
        <g clipPath={`url(#${gid})`} pointerEvents="none">
          <rect x={vb[0]} y={vb[1]} width={vb[2]} height={vb[3]} className="sheet" />
          {floors("-gap", false)}
        </g>
      )}

      <g pointerEvents="none">
        {openings.map(({ op, g }) => {
          if (op.type === "window") {
            return (
              <path
                key={op.id}
                className="sill"
                strokeWidth={1.6 * u}
                d={windowPanePath(g, WALL)}
              />
            );
          }
          const s = doorSwingPath(g, op);
          return (
            <g key={op.id} className="swing">
              <path d={s.leaf} strokeWidth={2.6 * u} />
              <path d={s.arc} strokeWidth={1.7 * u} />
            </g>
          );
        })}
      </g>

      {labels !== "none" && (
        <g className="labels" pointerEvents="none">
          {rooms.map((r) => {
            const p = r.parts.reduce((m, q) => (q.w * q.d > m.w * m.d ? q : m), r.parts[0]);
            if (p.w * pxPerCm < 52) return null;
            const cx = p.x + p.w / 2;
            const cy = p.y + p.d / 2;
            const showDims =
              labels === "full" && p.w * pxPerCm > 104 && p.d * pxPerCm > 58;
            const box = roomBox(r);
            return (
              <g key={r.id}>
                <text x={cx} y={showDims ? cy - 9 * u : cy} className="rname" fontSize={12.5 * u}>
                  {r.name}
                </text>
                {showDims && (
                  <text x={cx} y={cy + 9 * u} className="rdim" fontSize={9.5 * u} letterSpacing={1.1 * u}>
                    {r.parts.length > 1
                      ? `${fmtArea(roomArea(r), unit)} · ${r.parts.length} boxes`
                      : `${fmtLen(box.w, unit)} × ${fmtLen(box.d, unit)}`}
                  </text>
                )}
              </g>
            );
          })}
        </g>
      )}
    </>
  );
}

/**
 * ON A PHONE, ONE SCREEN IS THE WRONG RULE.
 *
 * Every screen here is built to be exactly the window tall and never scroll,
 * because a plan you have to scroll to see is a plan you cannot judge. On a
 * desktop that is right. On a 390-pixel phone the panel stops sitting BESIDE
 * the drawing and starts sitting UNDER it — and then the title, the sentence,
 * the toolbar and the list eat the whole 100dvh between them and the drawing
 * is left with twelve pixels. Measured, not guessed: twelve on Current place,
 * zero on Plan new place.
 *
 * So below 860px the rule is simply switched off. The page scrolls, which is
 * what a phone is for, and the plan is given a shape of its own instead of
 * whatever is left over. Everything else here follows from the same idea —
 * less chrome, fewer words, one line of navigation — because the space has to
 * come from somewhere and it should not come out of the drawing.
 *
 * It is exported separately and appended LAST by every page, because the page
 * stylesheets come after PLAN_CSS and would otherwise out-rank it.
 */
export const MOBILE_CSS = `
/* short and wide: not enough height for a full-height plan either way */
@media (max-height:620px) and (min-width:861px){
  .wrap{height:auto;overflow:visible;}
  .canvasbox{height:auto;}
  .canvas{aspect-ratio:100/68;flex:0 0 auto;}
}

@media (max-width:860px){
  .wrap{height:auto;min-height:100dvh;overflow:visible;
    padding:10px 5vw 18px;}

  /* the running head sheds its motto — it is the one decorative thing on it */
  .rail{gap:10px;margin-bottom:14px;}
  .rail-c{display:none;}
  .rail-l{white-space:nowrap;}

  /* THE STEP RAIL IS ONE LINE. Four names will not fit across a phone, so it
     stops wrapping and starts sliding; the current step is the one you can
     see, which is the one that matters. */
  .headband{gap:10px;padding-bottom:14px;margin-bottom:16px;}
  .headband h1{font-size:clamp(24px,7.4vw,34px);}
  .steps{flex-wrap:nowrap;overflow-x:auto;gap:8px;width:100%;padding-bottom:2px;
    scrollbar-width:none;-webkit-overflow-scrolling:touch;}
  .steps::-webkit-scrollbar{display:none;}
  .step{font-size:8px;letter-spacing:.06em;}

  /* SAY LESS. The ledes are two and three sentences of context you do not need
     while standing up on a train — the first line is the instruction, the rest
     is the explanation. */
  .lede span:not(:first-child){display:none;}
  .lede{font-size:13.5px;line-height:1.4;}
  .toolbar{margin-bottom:14px;gap:12px;}
  /* the two control groups fit on one row only once the words "UNITS" and
     "VIEW" come off them — the buttons say what they are */
  .tools{gap:14px;width:100%;}
  .units .lbl{display:none;}
  .zoomval{min-width:36px;}

  /* the plan gets a shape instead of the leftovers */
  .stage{display:block;flex:0 0 auto;min-height:0;}
  .canvasbox{height:auto;flex:0 0 auto;margin-bottom:18px;}
  .canvas{aspect-ratio:4/3;flex:0 0 auto;min-height:0;}

  /* panels scroll with the page, not inside themselves */
  .insp,.side,.detail,.piles{overflow:visible;min-height:0;max-height:none;}

  /* the footer stacks: the summary is a line of reading, the buttons are a
     row of targets, and squeezing them side by side wrapped "← Back" onto two
     lines while the wide button still did not fit */
  .foot{margin-top:18px;gap:12px;flex-direction:column;align-items:stretch;}
  .sum{font-size:10px;gap:8px;}
  .footr{width:100%;}
  .footr .ghost{white-space:nowrap;flex:0 0 auto;}
  .footr .gonext{flex:1 1 auto;text-align:center;white-space:nowrap;
    font-size:10px;padding:11px 10px;letter-spacing:.1em;}
}
`;

/**
 * The house style, shared by every step so the two screens are visibly the
 * same drawing. Each page inlines this alongside its own rules.
 */
export const PLAN_CSS = `
*{margin:0;padding:0;box-sizing:border-box;}
/* THE PALETTE, and the one thing worth knowing about it: the two accents are
   now nearly OPPOSITE in hue — ochre at 40 degrees, slate at 212 — where the
   old gold and sage were only 117 apart and read as two versions of one muted
   mid-tone. Two accents that mean two opposite things (what you keep, what
   goes to the market) should not have to be told apart by memory.

   The ground is a warm grey rather than a neutral one, and that is not
   decoration either: neutral grey beside a saturated ochre makes the ochre
   look dirty. A little warmth in the paper lets the gold sit.

   The three SURFACE values move together or the drawing stops reading — the
   sheet a step lighter than the page, the floor a step darker, and the gap
   between them is what tells you where a room stops. */
:root{--cream:#ECE8E3;--gold:#C6A158;--sage:#87929F;--ink:#272829;--floor:#E2DDD7;
  --display:'Archivo',sans-serif;--text:'Archivo Narrow',sans-serif;}
html,body{min-height:100%;}
body{background:var(--cream);color:var(--ink);font-family:var(--text);
  -webkit-font-smoothing:antialiased;}
/* ONE SCREEN. The page is exactly the window tall and never scrolls; the plan
   takes whatever height is left over and the side panel scrolls inside itself.
   A drawing you have to scroll to see is a drawing you cannot judge. */
.wrap{max-width:1560px;margin:0 auto;padding:clamp(8px,1.2vh,18px) 3vw clamp(8px,1.2vh,16px);
  display:flex;flex-direction:column;height:100dvh;overflow:hidden;}
.stage{flex:1 1 auto;min-height:0;}

/* ---------- running head ---------- */
.rail{display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:16px;flex:0 0 auto;
  padding-bottom:6px;border-bottom:1px solid var(--ink);margin-bottom:clamp(20px,3.2vh,44px);}
.rail-l,.rail-r{font-weight:700;font-size:clamp(9px,.78vw,11px);text-transform:uppercase;letter-spacing:.16em;}
.rail-l{color:var(--ink);text-decoration:none;}
.rail-l:hover{text-decoration:underline;text-underline-offset:3px;}
.rail-c{font-weight:700;font-size:clamp(11px,.95vw,14px);white-space:nowrap;}
.rail-r{justify-self:end;display:flex;align-items:center;gap:clamp(12px,1.4vw,22px);}
.rail-r a{color:var(--ink);text-decoration:none;}
.rail-r a:hover{text-decoration:underline;text-underline-offset:3px;}
.dot{width:7px;height:7px;border-radius:50%;background:var(--ink);flex:0 0 auto;}

/* ---------- headband + step rail ---------- */
/* THE TITLE NEEDS AIR. It used to sit 6px under the rule above it and 8px on
   top of the rule below, which read as a headline squeezed between two wires.
   The space is in vh so it opens up on a tall window and closes on a short one
   — the page still has to fit the screen exactly once. */
.headband{display:flex;align-items:flex-end;justify-content:space-between;gap:24px;
  flex-wrap:wrap;border-bottom:3px solid var(--ink);
  padding-bottom:clamp(16px,2.7vh,36px);margin-bottom:clamp(16px,2.6vh,32px);
  flex:0 0 auto;}
/* THE SAME MASTHEAD AS THE FRONT DOOR, one size down. The front page sets
   "Space Plan" in Archivo 800 at its NATURAL width — measured, the SVG stretch
   there works out to -0.002em, which is no tracking at all. These titles used
   to be tightened to -0.03em, a different voice however slightly, and at 58px
   the extra size was what made them read as fat. Same face, same weight, same
   tracking, 48px: the front page's nameplate, arriving on an inside page. */
.headband h1{font-family:var(--display);font-weight:800;line-height:1;
  letter-spacing:-.002em;font-size:clamp(26px,3.7vw,48px);}
.steps{display:flex;gap:clamp(10px,1.4vw,22px);flex-wrap:wrap;padding-bottom:6px;}
.step{font-weight:600;font-size:clamp(8.5px,.74vw,10.5px);text-transform:uppercase;
  letter-spacing:.14em;opacity:.42;white-space:nowrap;color:var(--ink);text-decoration:none;}
.step b{font-weight:800;letter-spacing:.04em;}
.step.on{opacity:1;}
a.step:hover{opacity:1;text-decoration:underline;text-underline-offset:4px;}

/* ---------- one rule about capitals ----------
   Archivo (wide) in mixed case for anything you READ: page titles, headings,
   sentences, big numbers. The page title is set exactly as the front page sets
   the app's own name — Archivo 800 at natural width — so every screen carries
   the same nameplate.
   Archivo Narrow (narrow) in CAPS with letterspacing for anything you SCAN:
   buttons, field labels, running heads, captions, tags.
   And a third rule that trumps both: text the USER typed is shown exactly as
   they typed it. Their furniture is called "Grandma's dresser", not
   "GRANDMA'S DRESSER" — uppercasing someone's own words throws away their
   capitals and makes long names hard to read.
   ------------------------------------------------------------------------ */

/* ---------- controls ---------- */
button{font:inherit;color:inherit;cursor:pointer;}
.seg{background:transparent;border:1px solid var(--ink);padding:5px 11px;
  font-family:var(--text);font-weight:700;font-size:10.5px;text-transform:uppercase;letter-spacing:.12em;}
/* anchors styled as buttons must not fall back to the browser's link blue */
a.seg,a.ghost,a.gonext{color:var(--ink);text-decoration:none;display:inline-block;}
a.gonext{color:var(--cream);}
.seg:hover{background:rgba(39,40,41,.08);}
.seg.on{background:var(--ink);color:var(--cream);}
.seg:disabled{opacity:.35;cursor:not-allowed;}
.ghost{background:transparent;border:1px solid rgba(39,40,41,.5);padding:7px 11px;
  font-family:var(--text);font-weight:700;font-size:10.5px;text-transform:uppercase;letter-spacing:.12em;}
.ghost:hover{border-color:var(--ink);background:rgba(39,40,41,.06);}
.ghost.sm{padding:6px 9px;font-size:9.5px;}
.ghost.danger:hover{background:var(--ink);color:var(--cream);border-color:var(--ink);}
.ghost:disabled{opacity:.35;cursor:not-allowed;}
.gonext{background:var(--ink);color:var(--cream);border:1px solid var(--ink);padding:9px 16px;
  font-family:var(--text);font-weight:800;font-size:11px;text-transform:uppercase;letter-spacing:.13em;
  text-decoration:none;display:inline-block;}
.gonext:disabled{opacity:.34;cursor:not-allowed;}
.units{display:flex;align-items:center;gap:6px;flex:0 0 auto;}
.units .lbl{font-weight:700;font-size:9.5px;text-transform:uppercase;letter-spacing:.16em;opacity:.6;
  margin-right:2px;}
.zoomval{font-weight:700;font-size:10.5px;min-width:42px;text-align:center;letter-spacing:.04em;}

/* ---------- canvas ---------- */
.canvasbox{border:1px solid rgba(39,40,41,.4);overflow:hidden;
  display:flex;flex-direction:column;min-height:0;height:100%;}
.canvas{display:block;width:100%;flex:1 1 auto;min-height:0;touch-action:none;}
.sheet{fill:#F5F2EE;cursor:crosshair;}
.canvas.panning .sheet{cursor:grab;}
/* grid lines and wall strokes are hit-testable by default, and being on top
   they would swallow clicks meant for the floor or the empty sheet */
.gridlines,.walls{pointer-events:none;}
.gridlines{stroke:rgba(39,40,41,.13);fill:none;}
.floor{fill:var(--floor);}
.floor.on{fill:var(--gold);}
.walls rect{fill:none;stroke:#272829;}
.sill{stroke:#272829;fill:none;}
.swing{stroke:#272829;fill:none;stroke-linecap:round;}
.labels text{text-anchor:middle;dominant-baseline:middle;fill:#272829;}
.rname{font-family:'Archivo',sans-serif;font-weight:800;}
/* NOT uppercased: this line ends in a unit, and "420 CM" is not how anyone
   writes a centimetre. The same measurement appears in mixed case in the
   panels on every step, and it has to be the same string in both places. */
.rdim{font-family:'Archivo Narrow',sans-serif;font-weight:700;
  fill:#272829;opacity:.75;text-anchor:middle;dominant-baseline:middle;}
.ghosttext{text-anchor:middle;dominant-baseline:middle;fill:rgba(39,40,41,.35);
  font-family:'Archivo Narrow',sans-serif;font-weight:700;text-transform:uppercase;letter-spacing:.18em;}
.banner{text-anchor:middle;dominant-baseline:middle;fill:#272829;
  font-family:'Archivo Narrow',sans-serif;font-weight:800;text-transform:uppercase;letter-spacing:.14em;}

.rotgrip{cursor:alias;}
.rotgrip .rgbg{fill:var(--cream);stroke:#272829;stroke-width:1.2;vector-effect:non-scaling-stroke;}
.rotgrip .rgarc{stroke:#272829;stroke-linecap:round;}
.rotgrip .rgtip{fill:#272829;}
.rotgrip:hover .rgbg{fill:var(--gold);}
.flipgrip{cursor:pointer;}
.flipgrip .rgbg{fill:var(--cream);stroke:#272829;stroke-width:1.2;vector-effect:non-scaling-stroke;}
.flipgrip .fgaxis{stroke:#272829;}
.flipgrip .fgsolid{fill:#272829;}
.flipgrip .fghollow{stroke:#272829;}
.flipgrip:hover .rgbg{fill:var(--gold);}
.flipgrip.on .rgbg{fill:var(--gold);}

/* ---------- panel furniture ---------- */
.insp{border-top:2px solid var(--ink);padding-top:10px;min-width:0;align-self:start;}
.insp h3{font-family:var(--display);font-weight:800;font-size:16px;letter-spacing:-.01em;}
.tag{display:block;font-weight:700;font-size:9.5px;text-transform:uppercase;letter-spacing:.16em;
  opacity:.6;margin-bottom:4px;}
.ifield{margin-bottom:16px;}
.ifield.two{display:grid;grid-template-columns:1fr 1fr;gap:10px;}
.ifield label{display:block;font-weight:700;font-size:9.5px;text-transform:uppercase;
  letter-spacing:.16em;opacity:.6;margin-bottom:6px;}
.segs{display:flex;flex-wrap:wrap;gap:6px;}
.hint{font-weight:600;font-size:11px;line-height:1.45;opacity:.68;margin-top:8px;}
.hint b{font-weight:800;opacity:1;}
.read{font-weight:700;font-size:13px;}
.read.big{font-family:var(--display);font-weight:800;font-size:24px;letter-spacing:-.02em;}
.len{display:flex;align-items:stretch;border:1px solid var(--ink);}
.len input{flex:1 1 auto;min-width:0;width:100%;background:transparent;border:0;
  font-family:var(--text);font-weight:700;font-size:13px;color:var(--ink);padding:6px 8px;text-align:center;}
.len input:focus{outline:none;background:rgba(39,40,41,.06);}
.len button{background:transparent;border:0;padding:0 10px;font-weight:800;font-size:14px;line-height:1;}
.len button:hover{background:rgba(39,40,41,.1);}


/* ---------- footer ---------- */
.foot{display:flex;align-items:center;justify-content:space-between;gap:20px;flex-wrap:wrap;
  margin-top:clamp(8px,1.4vh,16px);padding-top:9px;border-top:3px solid var(--ink);flex:0 0 auto;}
.sum{display:flex;align-items:baseline;gap:12px;flex-wrap:wrap;
  font-weight:600;font-size:10.5px;text-transform:uppercase;letter-spacing:.14em;}
.sum b{font-family:var(--display);font-weight:800;font-size:clamp(15px,1.5vw,22px);letter-spacing:-.01em;
  margin-left:6px;text-transform:none;}
.sum .arrow{font-size:16px;opacity:.5;}
.sum .delta{opacity:.7;padding-left:6px;border-left:1px solid rgba(39,40,41,.35);}
.footr{display:flex;gap:8px;align-items:center;}
`;
