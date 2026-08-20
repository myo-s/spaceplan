/**
 * SPACE PLAN — furniture symbol library.
 *
 * ONE RULE: every number in this file is real centimetres.
 * A sofa is 200 wide because a sofa is 200cm wide. Nothing here is drawn to
 * "look right" — it is drawn to measure. That is what lets the same data serve
 * three different jobs without ever disagreeing with itself:
 *
 *   1. the marketplace / landing plate   -> `elevation` (front view)
 *   2. the plan editor                   -> `top` (top view, what you drag)
 *   3. the "does it fit?" answer         -> `w` / `d` / `h` compared to the room
 *
 * Coordinate conventions
 * ----------------------
 * elevation : drawn UPWARD from the baseline, so y is NEGATIVE above the floor
 *             and 0 is the floor. A row of items of different heights can share
 *             one baseline without any of them being redrawn.
 * top       : drawn from the top-left corner, x right and y down, like the plan
 *             itself. Origin (0,0) is the item's own corner so it can be
 *             translated and rotated by the editor without special cases.
 *
 * `cut` paths are detail lines (cushion seams, drawer fronts) meant to be
 * stroked in the CARD's background colour, cutting detail back out of a solid
 * silhouette. That is how the landing gets detail without outlines.
 */

export const INK = "#2B2B2B";

/**
 * w = width (cm, along the wall)
 * d = depth (cm, into the room) — needed for the top view
 * h = height (cm, off the floor) — needed for the elevation
 */
export const FURNITURE = {
  sofa: {
    label: "Sofa",
    w: 200, d: 88, h: 80,
    elevation: `
      <rect x="0" y="-80" width="200" height="68" rx="13"/>
      <rect x="30" y="-12" width="12" height="12"/>
      <rect x="158" y="-12" width="12" height="12"/>`,
    elevationCut: `M27 -58 V-14 M173 -58 V-14 M27 -44 H173 M75 -44 V-14 M125 -44 V-14`,
    top: `<rect x="0" y="0" width="200" height="88" rx="7"/>`,
    topCut: `M26 16 V88 M174 16 V88 M26 16 H174 M75 18 V88 M125 18 V88`,
  },

  chair: {
    label: "Chair",
    w: 45, d: 50, h: 85,
    elevation: `
      <rect x="0" y="-85" width="34" height="11" rx="4"/>
      <rect x="0" y="-85" width="11" height="45"/>
      <rect x="0" y="-43" width="45" height="10" rx="3"/>
      <rect x="0" y="-33" width="11" height="33"/>
      <rect x="35" y="-33" width="10" height="33"/>`,
    top: `<rect x="0" y="0" width="45" height="50" rx="5"/>`,
    topCut: `M0 12 H45`,
  },

  diningTable: {
    label: "Dining table",
    w: 140, d: 90, h: 75,
    elevation: `
      <rect x="0" y="-75" width="140" height="10" rx="3"/>
      <rect x="8" y="-65" width="10" height="65"/>
      <rect x="122" y="-65" width="10" height="65"/>`,
    top: `<rect x="0" y="0" width="140" height="90" rx="5"/>`,
    topCut: `M10 10 H130 M10 80 H130`,
  },

  roundTable: {
    label: "Round table",
    w: 110, d: 110, h: 75,
    elevation: `
      <rect x="0" y="-75" width="110" height="9" rx="3"/>
      <rect x="48" y="-66" width="14" height="58"/>
      <rect x="30" y="-8" width="50" height="8" rx="3"/>`,
    top: `<circle cx="55" cy="55" r="55"/>`,
    topCut: `M55 8 A47 47 0 1 1 54.9 8`,
  },

  coffeeTable: {
    label: "Coffee table",
    w: 110, d: 60, h: 40,
    elevation: `
      <rect x="0" y="-40" width="110" height="8" rx="3"/>
      <rect x="7" y="-32" width="9" height="32"/>
      <rect x="94" y="-32" width="9" height="32"/>
      <rect x="7" y="-16" width="96" height="6"/>`,
    top: `<rect x="0" y="0" width="110" height="60" rx="5"/>`,
    topCut: `M8 8 H102 M8 52 H102`,
  },

  dresser: {
    label: "Dresser",
    w: 100, d: 45, h: 80,
    elevation: `
      <rect x="0" y="-80" width="100" height="66" rx="3"/>
      <rect x="6" y="-14" width="10" height="14"/>
      <rect x="84" y="-14" width="10" height="14"/>`,
    elevationCut: `M4 -58 H96 M4 -36 H96 M50 -79 V-59
                   M22 -68 H34 M66 -68 H78 M40 -47 H60 M40 -25 H60`,
    top: `<rect x="0" y="0" width="100" height="45" rx="3"/>`,
    topCut: `M6 6 H94`,
  },

  tvStand: {
    label: "TV and stand",
    w: 160, d: 40, h: 115,
    elevation: `
      <rect x="30" y="-115" width="100" height="58" rx="3"/>
      <rect x="75" y="-57" width="10" height="9"/>
      <rect x="58" y="-48" width="44" height="6" rx="2"/>
      <rect x="0" y="-42" width="160" height="34" rx="3"/>
      <rect x="12" y="-8" width="11" height="8"/>
      <rect x="137" y="-8" width="11" height="8"/>`,
    elevationCut: `M4 -25 H156 M80 -42 V-25 M60 -34 H72 M88 -34 H100`,
    top: `<rect x="0" y="0" width="160" height="40" rx="3"/>`,
    topCut: `M40 4 H120`,
  },

  floorLamp: {
    label: "Floor lamp",
    w: 45, d: 45, h: 150,
    elevation: `
      <path d="M9 -150 H36 L45 -112 H0 Z"/>
      <rect x="19" y="-112" width="7" height="12"/>
      <path d="M14 -100 H31 L26 -58 H19 Z"/>
      <path d="M19 -58 H26 L35 -13 H10 Z"/>
      <rect x="7" y="-13" width="31" height="13" rx="3"/>`,
    top: `<circle cx="22.5" cy="22.5" r="22.5"/>`,
    topCut: `M22.5 8 A14.5 14.5 0 1 1 22.4 8`,
  },

  bed: {
    label: "Double bed",
    w: 150, d: 200, h: 55,
    elevation: `
      <rect x="0" y="-55" width="150" height="14" rx="4"/>
      <rect x="0" y="-41" width="150" height="26" rx="3"/>
      <rect x="6" y="-15" width="12" height="15"/>
      <rect x="132" y="-15" width="12" height="15"/>`,
    top: `<rect x="0" y="0" width="150" height="200" rx="5"/>`,
    topCut: `M0 14 H150 M10 22 H70 M80 22 H140 M0 70 H150`,
  },

  wardrobe: {
    label: "Wardrobe",
    w: 120, d: 60, h: 200,
    elevation: `
      <rect x="0" y="-200" width="120" height="192" rx="3"/>
      <rect x="6" y="-8" width="12" height="8"/>
      <rect x="102" y="-8" width="12" height="8"/>`,
    elevationCut: `M60 -196 V-12 M50 -110 V-90 M70 -110 V-90`,
    top: `<rect x="0" y="0" width="120" height="60" rx="3"/>`,
    topCut: `M60 0 V60 M6 6 H114`,
  },

  desk: {
    label: "Desk",
    w: 140, d: 70, h: 75,
    elevation: `
      <rect x="0" y="-75" width="140" height="9" rx="3"/>
      <rect x="8" y="-66" width="10" height="66"/>
      <rect x="122" y="-66" width="10" height="66"/>
      <rect x="70" y="-66" width="52" height="26" rx="2"/>`,
    elevationCut: `M70 -53 H122 M88 -59 H104 M88 -46 H104`,
    top: `<rect x="0" y="0" width="140" height="70" rx="4"/>`,
    topCut: `M8 8 H132`,
  },


  /* ---- more seating: one sofa was never going to be enough ---- */

  sofaL: {
    label: "L-shaped sofa",
    w: 260, d: 170, h: 80,
    elevation: `
      <rect x="0" y="-80" width="260" height="68" rx="13"/>
      <rect x="30" y="-12" width="12" height="12"/>
      <rect x="218" y="-12" width="12" height="12"/>`,
    elevationCut: `M27 -58 V-14 M233 -58 V-14 M27 -44 H233 M92 -44 V-14 M168 -44 V-14`,
    // the corner is the whole point: main run across the top, chaise down the right
    top: `<path d="M0 0 H260 V170 H170 V90 H0 Z"/>`,
    topCut: `M26 16 H244 V148 M26 16 V90 M120 18 V90`,
  },

  loveseat: {
    label: "Two-seat sofa",
    w: 150, d: 88, h: 80,
    elevation: `
      <rect x="0" y="-80" width="150" height="68" rx="13"/>
      <rect x="24" y="-12" width="11" height="12"/>
      <rect x="115" y="-12" width="11" height="12"/>`,
    elevationCut: `M25 -58 V-14 M125 -58 V-14 M25 -44 H125 M75 -44 V-14`,
    top: `<rect x="0" y="0" width="150" height="88" rx="7"/>`,
    topCut: `M25 16 V88 M125 16 V88 M25 16 H125 M75 18 V88`,
  },

  armchair: {
    label: "Armchair",
    w: 90, d: 88, h: 80,
    elevation: `
      <rect x="0" y="-80" width="90" height="68" rx="12"/>
      <rect x="18" y="-12" width="10" height="12"/>
      <rect x="62" y="-12" width="10" height="12"/>`,
    elevationCut: `M24 -58 V-14 M66 -58 V-14 M24 -44 H66`,
    top: `<rect x="0" y="0" width="90" height="88" rx="7"/>`,
    topCut: `M24 16 V88 M66 16 V88 M24 16 H66`,
  },

  ottoman: {
    label: "Footstool",
    w: 60, d: 60, h: 42,
    elevation: `
      <rect x="0" y="-42" width="60" height="34" rx="6"/>
      <rect x="7" y="-8" width="8" height="8"/>
      <rect x="45" y="-8" width="8" height="8"/>`,
    top: `<rect x="0" y="0" width="60" height="60" rx="6"/>`,
    topCut: `M9 9 H51 V51 H9 Z`,
  },

  /* ---- beds come in sizes, and the size is the whole question ---- */

  singleBed: {
    label: "Single bed",
    w: 90, d: 200, h: 55,
    elevation: `
      <rect x="0" y="-55" width="90" height="14" rx="4"/>
      <rect x="0" y="-41" width="90" height="26" rx="3"/>
      <rect x="5" y="-15" width="10" height="15"/>
      <rect x="75" y="-15" width="10" height="15"/>`,
    top: `<rect x="0" y="0" width="90" height="200" rx="5"/>`,
    topCut: `M0 14 H90 M10 22 H80 M0 70 H90`,
  },

  queenBed: {
    label: "Queen bed",
    w: 160, d: 200, h: 55,
    elevation: `
      <rect x="0" y="-55" width="160" height="14" rx="4"/>
      <rect x="0" y="-41" width="160" height="26" rx="3"/>
      <rect x="6" y="-15" width="12" height="15"/>
      <rect x="142" y="-15" width="12" height="15"/>`,
    top: `<rect x="0" y="0" width="160" height="200" rx="5"/>`,
    topCut: `M0 14 H160 M10 22 H75 M85 22 H150 M0 70 H160`,
  },

  kingBed: {
    label: "King bed",
    w: 180, d: 200, h: 55,
    elevation: `
      <rect x="0" y="-55" width="180" height="14" rx="4"/>
      <rect x="0" y="-41" width="180" height="26" rx="3"/>
      <rect x="6" y="-15" width="12" height="15"/>
      <rect x="162" y="-15" width="12" height="15"/>`,
    top: `<rect x="0" y="0" width="180" height="200" rx="5"/>`,
    topCut: `M0 14 H180 M10 22 H85 M95 22 H170 M0 70 H180`,
  },

  /* ---- storage and surfaces ---- */

  sideboard: {
    label: "Sideboard",
    w: 180, d: 45, h: 80,
    elevation: `
      <rect x="0" y="-80" width="180" height="66" rx="3"/>
      <rect x="8" y="-14" width="10" height="14"/>
      <rect x="162" y="-14" width="10" height="14"/>`,
    elevationCut: `M60 -78 V-16 M120 -78 V-16 M28 -47 H44 M88 -47 H104 M148 -47 H164`,
    top: `<rect x="0" y="0" width="180" height="45" rx="3"/>`,
    topCut: `M6 6 H174`,
  },

  nightstand: {
    label: "Bedside table",
    w: 45, d: 40, h: 55,
    elevation: `
      <rect x="0" y="-55" width="45" height="45" rx="3"/>
      <rect x="4" y="-10" width="8" height="10"/>
      <rect x="33" y="-10" width="8" height="10"/>`,
    elevationCut: `M4 -38 H41 M18 -47 H27 M18 -25 H27`,
    top: `<rect x="0" y="0" width="45" height="40" rx="3"/>`,
    topCut: `M5 5 H40`,
  },

  console: {
    label: "Console table",
    w: 110, d: 35, h: 80,
    elevation: `
      <rect x="0" y="-80" width="110" height="8" rx="3"/>
      <rect x="7" y="-72" width="8" height="72"/>
      <rect x="95" y="-72" width="8" height="72"/>
      <rect x="7" y="-40" width="96" height="6"/>`,
    top: `<rect x="0" y="0" width="110" height="35" rx="3"/>`,
    topCut: `M6 6 H104`,
  },

  deskL: {
    label: "Corner desk",
    w: 160, d: 140, h: 75,
    elevation: `
      <rect x="0" y="-75" width="160" height="9" rx="3"/>
      <rect x="8" y="-66" width="10" height="66"/>
      <rect x="142" y="-66" width="10" height="66"/>
      <rect x="80" y="-66" width="60" height="28" rx="2"/>`,
    elevationCut: `M80 -52 H140 M98 -60 H122 M98 -45 H122`,
    top: `<path d="M0 0 H160 V70 H70 V140 H0 Z"/>`,
    topCut: `M8 8 H152 M8 8 V132`,
  },

  /* ---- the heavy things people forget to measure ---- */

  fridge: {
    label: "Fridge",
    w: 70, d: 70, h: 180,
    elevation: `
      <rect x="0" y="-180" width="70" height="172" rx="4"/>
      <rect x="4" y="-8" width="10" height="8"/>
      <rect x="56" y="-8" width="10" height="8"/>`,
    elevationCut: `M4 -118 H66 M54 -168 V-128 M54 -108 V-68`,
    top: `<rect x="0" y="0" width="70" height="70" rx="4"/>`,
    topCut: `M6 6 H64`,
  },

  washer: {
    label: "Washing machine",
    w: 60, d: 60, h: 85,
    elevation: `<rect x="0" y="-85" width="60" height="85" rx="4"/>`,
    elevationCut: `M6 -72 H54 M14 -45 A16 16 0 1 1 13.9 -45`,
    top: `<rect x="0" y="0" width="60" height="60" rx="3"/>`,
    topCut: `M6 6 H54`,
  },

  bookshelf: {
    label: "Bookshelf",
    w: 90, d: 32, h: 180,
    elevation: `
      <rect x="0" y="-180" width="90" height="180" rx="3"/>`,
    elevationCut: `M6 -145 H84 M6 -110 H84 M6 -75 H84 M6 -40 H84`,
    top: `<rect x="0" y="0" width="90" height="32" rx="2"/>`,
    topCut: `M0 6 H90`,
  },
};

/**
 * The picker, grouped. A flat list of twenty-six silhouettes is a wall; the
 * same twenty-six under five headings is a shop. Order inside each group runs
 * biggest-problem-first, because the big things are what decide a move.
 */
export const CATEGORIES = [
  { name: "Seating", keys: ["sofaL", "sofa", "loveseat", "armchair", "chair", "ottoman"] },
  { name: "Beds", keys: ["kingBed", "queenBed", "bed", "singleBed"] },
  { name: "Tables & desks", keys: ["diningTable", "roundTable", "deskL", "desk", "coffeeTable", "console"] },
  { name: "Storage", keys: ["wardrobe", "sideboard", "dresser", "bookshelf", "tvStand", "nightstand"] },
  { name: "Appliances & other", keys: ["fridge", "washer", "floorLamp"] },
];

/** Everything the picker offers, flat. */
export const CATALOGUE = CATEGORIES.flatMap((c) => c.keys);

/**
 * Front elevation — for marketplace listings and the landing plate.
 * Give every <svg> the same CSS height and true relative scale is preserved,
 * because the viewBox height is the item's real height in cm.
 */
export function elevationSvg(key, rowHeightCm) {
  const f = FURNITURE[key];
  const h = rowHeightCm ?? f.h;
  const cut = f.elevationCut
    ? `<g class="cut" fill="none"><path d="${f.elevationCut}"/></g>`
    : "";
  return `<svg viewBox="0 -${h} ${f.w} ${h}" role="img" aria-label="${f.label}">
    <g fill="${INK}">${f.elevation}${cut}</g></svg>`;
}

/**
 * Top view — one symbol placed in the plan. The editor supplies position and
 * rotation; rotation is around the item's centre so a 90° turn swaps w and d.
 */
export function topSvg(key, { x = 0, y = 0, rotation = 0 } = {}) {
  const f = FURNITURE[key];
  const cut = f.topCut
    ? `<g class="cut" fill="none"><path d="${f.topCut}"/></g>`
    : "";
  const spin = rotation
    ? ` rotate(${rotation} ${f.w / 2} ${f.d / 2})`
    : "";
  return `<g transform="translate(${x} ${y})${spin}" fill="${INK}">
    ${f.top}${cut}</g>`;
}

/** Footprint after rotation — this is what the fit check actually needs. */
export function footprint(key, rotation = 0) {
  const f = FURNITURE[key];
  const turned = Math.abs(rotation % 180) === 90;
  return turned ? { w: f.d, d: f.w } : { w: f.w, d: f.d };
}

/**
 * The question the whole app exists to answer.
 * Returns every piece that cannot be made to fit the room at any rotation.
 */
export function whatDoesNotFit(items, room) {
  return items.filter(({ key }) => {
    const a = footprint(key, 0);
    const b = footprint(key, 90);
    const fits = (f) => f.w <= room.w && f.d <= room.d;
    return !fits(a) && !fits(b);
  });
}
