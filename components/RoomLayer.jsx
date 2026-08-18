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
  openingGeom, roomArea, roomBox,
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
                strokeWidth={2.4 * u}
                d={`M${g.A.x} ${g.A.y} L${g.B.x} ${g.B.y}`}
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
 * The house style, shared by every step so the two screens are visibly the
 * same drawing. Each page inlines this alongside its own rules.
 */
export const PLAN_CSS = `
*{margin:0;padding:0;box-sizing:border-box;}
:root{--cream:#F0EAD8;--gold:#D2BF81;--sage:#99ABA6;--ink:#2B2B2B;--floor:#EDE6D2;
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

/* ---------- headband + step rail ---------- */
.headband{display:flex;align-items:flex-end;justify-content:space-between;gap:24px;
  flex-wrap:wrap;border-bottom:3px solid var(--ink);padding-bottom:10px;margin-bottom:14px;}
.headband h1{font-family:var(--display);font-weight:800;line-height:.9;letter-spacing:-.03em;
  font-size:clamp(38px,6.4vw,92px);}
.steps{display:flex;gap:clamp(10px,1.4vw,22px);flex-wrap:wrap;padding-bottom:6px;}
.step{font-weight:600;font-size:clamp(8.5px,.74vw,10.5px);text-transform:uppercase;
  letter-spacing:.14em;opacity:.42;white-space:nowrap;color:var(--ink);text-decoration:none;}
.step b{font-weight:800;letter-spacing:.04em;}
.step.on{opacity:1;}
a.step:hover{opacity:1;text-decoration:underline;text-underline-offset:4px;}

/* ---------- controls ---------- */
button{font:inherit;color:inherit;cursor:pointer;}
.seg{background:transparent;border:1px solid var(--ink);padding:5px 11px;
  font-family:var(--text);font-weight:700;font-size:10.5px;text-transform:uppercase;letter-spacing:.12em;}
.seg:hover{background:rgba(43,43,43,.08);}
.seg.on{background:var(--ink);color:var(--cream);}
.seg:disabled{opacity:.35;cursor:not-allowed;}
.ghost{background:transparent;border:1px solid rgba(43,43,43,.5);padding:7px 11px;
  font-family:var(--text);font-weight:700;font-size:10.5px;text-transform:uppercase;letter-spacing:.12em;}
.ghost:hover{border-color:var(--ink);background:rgba(43,43,43,.06);}
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
.canvasbox{border:1px solid rgba(43,43,43,.4);overflow:hidden;}
.canvas{display:block;width:100%;aspect-ratio:100/70;touch-action:none;}
.sheet{fill:#F6F2E6;cursor:crosshair;}
.canvas.panning .sheet{cursor:grab;}
/* grid lines and wall strokes are hit-testable by default, and being on top
   they would swallow clicks meant for the floor or the empty sheet */
.gridlines,.walls{pointer-events:none;}
.gridlines{stroke:rgba(43,43,43,.13);fill:none;}
.floor{fill:var(--floor);}
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
.banner{text-anchor:middle;dominant-baseline:middle;fill:#2B2B2B;
  font-family:'Archivo Narrow',sans-serif;font-weight:800;text-transform:uppercase;letter-spacing:.14em;}

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
.len input:focus{outline:none;background:rgba(43,43,43,.06);}
.len button{background:transparent;border:0;padding:0 10px;font-weight:800;font-size:14px;line-height:1;}
.len button:hover{background:rgba(43,43,43,.1);}

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
`;
