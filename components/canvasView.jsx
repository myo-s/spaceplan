"use client";

/**
 * SPACE PLAN — the shared behaviour of a plan canvas: zoom, pan, and the
 * conversion from a pointer event to centimetres.
 *
 * Every screen draws the same plan, so they must move the same way. Wheel
 * zooms about the cursor; the wheel BUTTON or Shift-drag pans; Fit frames the
 * whole flat. Keeping it in one hook is what stops the screens from slowly
 * acquiring slightly different feels.
 *
 * The canvas takes its SHAPE FROM THE LAYOUT, not the other way round. It used
 * to declare a fixed aspect ratio, which meant a wide window produced a tall
 * drawing and pushed the page into a scroll. Now the element fills whatever
 * height the screen has left, its real size is measured, and the viewBox is
 * cut to match — so the plan fills the window exactly once, at any shape.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { clamp, homeBox } from "../lib/plan";

export const MIN_VIEW = 220;    // cm across, fully zoomed in
export const MAX_VIEW = 4000;   // cm across, fully zoomed out
export const DEFAULT_VIEW = { x: -60, y: -60, w: 940 };

export function useCanvasView(initial = DEFAULT_VIEW) {
  const [view, setView] = useState(initial);
  const [box, setBox] = useState({ w: 900, h: 620 });
  const boxRef = useRef(null);
  const svgRef = useRef(null);

  useEffect(() => {
    const el = svgRef.current || boxRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(([e]) => {
      const r = e.contentRect;
      if (r.width > 40 && r.height > 40) setBox({ w: r.width, h: r.height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  });

  const aspect = box.h / box.w;

  const zoomAt = useCallback((factor, fx = 0.5, fy = 0.5) => {
    setView((v) => {
      const w = clamp(v.w * factor, MIN_VIEW, MAX_VIEW);
      if (w === v.w) return v;
      return { x: v.x + (v.w - w) * fx, y: v.y + (v.w - w) * aspect * fy, w };
    });
  }, [aspect]);

  // The wheel has to be bound by hand: React's onWheel is passive, so it
  // cannot stop the page scrolling underneath the zoom.
  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const onWheel = (e) => {
      e.preventDefault();
      const r = el.getBoundingClientRect();
      zoomAt(
        e.deltaY > 0 ? 1.12 : 1 / 1.12,
        (e.clientX - r.left) / r.width,
        (e.clientY - r.top) / r.height
      );
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  });

  const fitTo = useCallback((rooms) => {
    const b = homeBox(rooms || []);
    if (!b.w || !b.d) return setView(DEFAULT_VIEW);
    const w = clamp(Math.max(b.w, b.d / aspect) * 1.16, MIN_VIEW, MAX_VIEW);
    setView({ x: b.x + b.w / 2 - w / 2, y: b.y + b.d / 2 - (w * aspect) / 2, w });
  }, [aspect]);

  const toCm = useCallback((ev) => {
    const r = svgRef.current.getBoundingClientRect();
    return {
      x: view.x + ((ev.clientX - r.left) / r.width) * view.w,
      y: view.y + ((ev.clientY - r.top) / r.height) * view.w * aspect,
    };
  }, [view, aspect]);

  const vb = useMemo(() => [view.x, view.y, view.w, view.w * aspect], [view, aspect]);
  const pxPerCm = box.w / view.w;

  return {
    view, setView, vb, pxPerCm, aspect,
    u: 1 / Math.max(pxPerCm, 0.001),      // cm per px — keeps chrome one size
    pct: Math.round((DEFAULT_VIEW.w / view.w) * 100),
    boxRef, svgRef, zoomAt, fitTo, toCm,
  };
}

/**
 * The handle that turns a piece. It used to be a plain square, which is the
 * same shape as every resize grip in every drawing program — so it read as
 * "drag me bigger". A circling arrow can only mean one thing.
 */
export function RotateGrip({ x, y, size, onPointerDown }) {
  const r = size * 0.36;
  const a = size * 0.18;
  return (
    <g className="rotgrip" transform={`translate(${x + size * 1.15} ${y - size * 1.15})`}
       onPointerDown={onPointerDown}>
      <circle r={size * 0.62} className="rgbg" />
      <path className="rgarc" fill="none" strokeWidth={size * 0.13}
        d={`M0 ${-r} A ${r} ${r} 0 1 1 ${-r} 0`} />
      <path className="rgtip" d={`M${-a * 0.2} ${-r - a} L${a * 1.5} ${-r} L${-a * 0.2} ${-r + a} Z`} />
    </g>
  );
}

/**
 * The handle that mirrors a piece. Sits opposite the rotate handle, because
 * they are the two things you can do to a shape in place — and because an
 * L-shaped sofa needs the mirror far more often than it needs the turn.
 *
 * The mark is a shape and its reflection across a line: filled on one side,
 * outlined on the other. The first attempt drew both sides filled with a
 * dashed axis between them, which at fifteen pixels was neither a mirror nor
 * anything else — the dashes turned to mush and two identical triangles
 * pointing apart read as "stretch me". Solid axis, and one side hollow: the
 * hollow side is the reflection, and that is the whole idea.
 */
export function FlipGrip({ x, y, size, on, onPointerDown }) {
  const h = size * 0.26;      // half-height: pointier reads as a mark, not a blob
  const w = size * 0.42;      // reach from the axis
  const gap = size * 0.15;    // clear air either side, or the two sides merge
  return (
    <g className={"flipgrip" + (on ? " on" : "")}
       transform={`translate(${x - size * 1.15} ${y - size * 1.15})`}
       onPointerDown={onPointerDown}>
      <circle r={size * 0.62} className="rgbg" />
      <path className="fgaxis" fill="none" strokeWidth={size * 0.05}
        d={`M0 ${-h * 1.7} V${h * 1.7}`} />
      <path className="fgsolid" d={`M${-gap} ${-h} L${-w} 0 L${-gap} ${h} Z`} />
      <path className="fghollow" fill="none" strokeWidth={size * 0.055}
        strokeLinejoin="round" d={`M${gap} ${-h} L${w} 0 L${gap} ${h} Z`} />
    </g>
  );
}

/**
 * The zoom cluster. There is deliberately no Pan button: the wheel button and
 * Shift-drag both pan already, and a mode toggle you have to remember to turn
 * off is worse than no toggle at all.
 */
export function ViewTools({ pct, zoomAt, onFit }) {
  return (
    <div className="units">
      <span className="lbl">View</span>
      <button className="seg" onClick={() => zoomAt(1 / 0.8)} title="Zoom out">−</button>
      <span className="zoomval">{pct}%</span>
      <button className="seg" onClick={() => zoomAt(0.8)} title="Zoom in">+</button>
      <button className="seg" onClick={onFit}>Fit</button>
    </div>
  );
}
