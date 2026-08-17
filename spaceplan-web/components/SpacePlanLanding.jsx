/**
 * SPACE PLAN - landing page.
 *
 * Self-contained: every rule lives in the <style> block below. Do NOT move it
 * into a CSS Module or rewrite it as Tailwind - `html,body{height:100%}` has to
 * stay global or the "fits on one screen" behaviour breaks.
 *
 * Fonts: React 19 / Next 15 hoists these <link> tags into <head>. On an older
 * setup, move them to app/layout.tsx instead.
 *
 * No client JS - the card hover is pure CSS, so this stays a server component.
 */
export default function SpacePlanLanding() {
  return (
    <>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link
        href="https://fonts.googleapis.com/css2?family=Archivo:wght@400;500;600;700;800&family=Archivo+Narrow:wght@400;500;600;700&display=swap"
        rel="stylesheet"
      />
      <style>{`
  *{margin:0;padding:0;box-sizing:border-box;}
  :root{--cream:#F0EAD8;--gold:#D2BF81;--sage:#99ABA6;--ink:#2B2B2B;
    --display:'Archivo',sans-serif;   /* masthead, headings, deck */
    --text:'Archivo Narrow',sans-serif; /* body, rail, captions, labels */
  }
  body{background:var(--cream);color:var(--ink);font-family:var(--text);
       -webkit-font-smoothing:antialiased;}
  /* One screen, no scrolling. Tying max-width to viewport HEIGHT scales the
     whole composition — masthead included — without ever breaking its
     edge-to-edge fit, because the measure itself narrows. */
  html,body{height:100%;}
  .wrap{max-width:min(1440px,121vh);margin:0 auto;
    padding:clamp(10px,1.3vh,20px) 4vw clamp(12px,1.7vh,26px);
    min-height:100%;display:flex;flex-direction:column;}
  .grid{flex:1 1 auto;min-height:0;}

  /* ---------- RUNNING HEAD (magazine rail) ---------- */
  .rail{display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:16px;
    padding-bottom:8px;border-bottom:1px solid var(--ink);margin-bottom:clamp(10px,1.5vh,22px);}
  .rail-l{font-weight:700;font-size:clamp(9px,.78vw,11px);text-transform:uppercase;letter-spacing:.16em;}
  .rail-c{font-weight:700;font-size:clamp(11.5px,1.02vw,15px);white-space:nowrap;}
  .rail-r{justify-self:end;display:flex;align-items:center;gap:clamp(12px,1.4vw,22px);
    font-weight:700;font-size:clamp(9px,.78vw,11px);text-transform:uppercase;letter-spacing:.16em;}
  .rail-r a{color:var(--ink);text-decoration:none;}
  .rail-r a:hover{text-decoration:underline;text-underline-offset:3px;}
  .dot{width:7px;height:7px;border-radius:50%;background:var(--ink);flex:0 0 auto;}

  /* MASTHEAD B — Archivo 800, mixed case, tight. The SVG's textLength pins the
     word to exactly the full box width at every screen size. */
  .headband{container-type:inline-size;}
  .headline-svg{display:block;width:100%;height:auto;}
  .headband{border-bottom:3px solid var(--ink);padding-bottom:.9vw;margin-bottom:clamp(11px,2vh,34px);}

  /* ---------- CARDS ---------- */
  .grid{display:flex;gap:2vw;align-items:stretch;}
  .card{position:relative;flex:1 1 0;min-width:0;display:flex;flex-direction:column;
    padding:clamp(20px,3.4vh,52px) clamp(24px,3.7vw,54px);min-height:0;
    color:var(--ink);text-decoration:none;
    transition:flex-grow .55s cubic-bezier(.22,.61,.36,1);}
  .card.gold{background:var(--gold);--plate:var(--gold);}
  .card.sage{background:var(--sage);--plate:var(--sage);}
  .hole{position:absolute;top:24px;right:24px;width:clamp(13px,1.5vw,20px);aspect-ratio:1;
    background:var(--cream);border-radius:50%;}

  /* tiny metadata row — the small end of the scale contrast */
  /* padding-right keeps "Enter" clear of the punch-hole dot at the top corner */
  .meta{display:flex;align-items:baseline;gap:11px;margin-bottom:clamp(13px,2.5vh,32px);
    padding-right:clamp(26px,2.2vw,32px);
    font-weight:700;font-size:clamp(9px,.78vw,11px);text-transform:uppercase;letter-spacing:.16em;}
  .meta .num{font-weight:800;letter-spacing:.04em;}
  .meta .kick{opacity:.72;}

  .card h2{font-family:var(--display);font-weight:800;line-height:.98;
    letter-spacing:-.022em;font-size:clamp(27px,3.15vw,49px);}
  .rule{height:2px;background:var(--ink);margin:clamp(10px,1.6vh,20px) 0 clamp(13px,2.1vh,27px);}

  /* deck / standfirst — the one line that has to land */
  /* deck stays on ONE line at every width, including the shrunken hover state */
  /* Standfirst. Ink, not cream: no light colour clears 1.82:1 on the gold card,
     and this is the one line that has to be read. Weight 500 keeps it clearly
     subordinate to the 800 headline without going faint. */
  /* Standfirst: small but bold. Weight, not size, is what separates it from
     the list underneath — so it reads as a claim, not as more body copy. */
  .deck{font-family:var(--display);font-weight:700;line-height:1.26;letter-spacing:-.006em;
    font-size:clamp(15px,1.48vw,21px);margin-bottom:clamp(13px,2.3vh,29px);}

  /* filled circle, same proportion as the dot in the running head, raised to
     sit on the x-height rather than the baseline */
  .card ul{list-style:none;font-weight:600;font-size:clamp(12.5px,1.02vw,14.5px);line-height:2.2;}
  .card ul li{display:flex;align-items:baseline;gap:clamp(11px,.95vw,14px);}
  .card ul li::before{content:"";flex:0 0 auto;width:.4em;height:.4em;border-radius:50%;
    background:var(--ink);transform:translateY(-.32em);}

  .art{margin-top:auto;padding-top:clamp(10px,2.4vh,30px);}
  .art > svg{width:100%;height:auto;display:block;max-height:clamp(80px,23vh,270px);}

  /* Catalogue plate. Each figure's flex-grow equals its real width, so the row
     keeps one true scale, every item lands on the same baseline at the same
     height, and it can never overflow the card. */
  .plate{display:flex;flex-direction:column;gap:clamp(14px,2.4vh,30px);}
  .prow{display:flex;align-items:flex-end;}
  .plate figure{min-width:0;}
  .plate svg{width:100%;height:auto;display:block;}
  /* detail cut back out of the silhouette in the card's own colour */
  .cut{fill:none;stroke:var(--plate);stroke-width:2.6;stroke-linecap:round;}
  .swing{fill:none;stroke:var(--ink);stroke-width:4;stroke-linecap:round;}
  .cutfill{fill:var(--plate);stroke:none;}

  /* caption under the plate — label + value, like a magazine figure */
  .cap{margin-top:14px;padding-top:10px;border-top:1px solid rgba(43,43,43,.32);
    font-weight:600;font-size:clamp(8.5px,.74vw,10.5px);text-transform:uppercase;letter-spacing:.13em;
    display:flex;gap:10px;align-items:baseline;}
  .cap b{font-weight:800;letter-spacing:.05em;flex:0 0 auto;}
  .cap span{opacity:.72;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}


  .enter{margin-left:auto;flex:0 0 auto;font-weight:800;letter-spacing:.09em;}

  /* hover: the card you point at grows, the other yields. Pure CSS. */
  @media (hover:hover) and (min-width:900px){
    .card .enter{opacity:0;transform:translateX(-8px);
      transition:opacity .4s ease,transform .4s ease;}
    .card:hover{flex-grow:1.85;}
    .card:hover .enter{opacity:1;transform:none;}
  }

  /* ---------- TABLET / PHONE ---------- */
  @media (max-width:900px){
    .grid{flex-direction:column;gap:4vw;}
    .card{min-height:auto;padding:26px;}
    .headband{padding-bottom:2.6vw;margin-bottom:5vw;border-bottom-width:2px;}
    .rail{margin-bottom:4vw;}
    .card ul{line-height:2.05;}
  
    .enter{opacity:1;}
  }
  @media (max-width:640px){
  
    .rail{grid-template-columns:1fr auto;row-gap:8px;}
    .rail-c{grid-column:1 / -1;grid-row:2;justify-self:start;}
    .headline .wg{flex:3 1 0;}
  }
`}</style>
      <div className="wrap">
      
          <div className="rail">
            <div className="rail-l">Space Plan</div>
            <div className="rail-c">Moving, Planning, Marketplace</div>
            <div className="rail-r"><a href="/marketplace">Marketplace</a><a href="/login">Login</a><span className="dot"></span></div>
          </div>
      
          <div className="headband">
            <svg className="headline-svg" viewBox="0 0 1000 197" role="img" aria-label="Space Plan">
              <text x="0" y="152" textLength="1000" lengthAdjust="spacing"
                    fontFamily="Archivo, sans-serif" fontWeight="800" fontSize="188"
                    fill="#2B2B2B">Space Plan</text>
            </svg>
          </div>
      
          <div className="grid">
            <a className="card gold" href="/draw-room">
              <div className="hole"></div>
              <div className="meta"><span className="num">01</span><span className="kick">Draw &#183; Sort &#183; Decide</span></div>
              <h2>Moving In</h2>
              <div className="rule"></div>
              <p className="deck">Will your furniture fit?</p>
              <ul>
                <li>Draw your new place in minutes</li>
                <li>Keep, sell, or toss in one pass</li>
                <li>Arrive knowing where everything goes</li>
              </ul>
              <div className="art">
                <svg viewBox="-4 -4 838 388" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Current plan and new plan"><path fillRule="evenodd" fill="#2B2B2B" d="M0 0 H430 V380 H0 Z M9 9 V371 H421 V9 Z"/><rect className="cutfill" x="150" y="0" width="150" height="9"/><rect fill="#2B2B2B" x="150" y="3.0" width="150" height="3"/><rect className="cutfill" x="66" y="371" width="78" height="9"/><g fill="#2B2B2B"><g transform="translate(40 30)"><rect x="0" y="0" width="200" height="88" rx="7"/><g className="cut"><path d="M26 16 V88 M174 16 V88 M26 16 H174 M75 18 V88 M125 18 V88"/></g></g><circle cx="300" cy="244" r="42"/><circle className="cutfill" cx="300" cy="244" r="35"/><circle cx="300" cy="244" r="29"/><rect x="282" y="184" width="36" height="13" rx="4"/><rect x="282" y="291" width="36" height="13" rx="4"/><rect x="240" y="226" width="13" height="36" rx="4"/><rect x="347" y="226" width="13" height="36" rx="4"/><rect x="388" y="150" width="33" height="120" rx="4"/></g><g className="swing"><path d="M66 371 v-78"/><path d="M66 293 A78 78 0 0 1 144 371"/></g><path fillRule="evenodd" fill="#2B2B2B" d="M500 0 H830 V380 H500 Z M509 9 V371 H821 V9 Z"/><rect className="cutfill" x="620" y="0" width="120" height="9"/><rect fill="#2B2B2B" x="620" y="3.0" width="120" height="3"/><rect className="cutfill" x="556" y="371" width="74" height="9"/><g fill="#2B2B2B"><g transform="translate(530 30)"><rect x="0" y="0" width="190" height="84" rx="7"/><g className="cut"><path d="M25 16 V84 M165 16 V84 M25 16 H165 M72 18 V84 M118 18 V84"/></g></g><circle cx="648" cy="226" r="36"/><circle className="cutfill" cx="648" cy="226" r="29"/><circle cx="648" cy="226" r="23"/><rect x="630" y="172" width="36" height="13" rx="4"/><rect x="630" y="267" width="36" height="13" rx="4"/><rect x="594" y="208" width="13" height="36" rx="4"/><rect x="689" y="208" width="13" height="36" rx="4"/><rect x="788" y="150" width="33" height="110" rx="4"/></g><g className="swing"><path d="M556 371 v-74"/><path d="M556 297 A74 74 0 0 1 630 371"/></g><g fill="none" stroke="#2B2B2B" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round"><path d="M450 190 H480 M469 178 L481 190 L469 202"/></g></svg>
              </div>
              <div className="cap"><b>Fig. 01</b><span>Current plan &#8594; New plan</span><b className="enter">Enter &#8594;</b></div>
            </a>
      
            <a className="card sage" href="/marketplace">
              <div className="hole"></div>
              <div className="meta"><span className="num">02</span><span className="kick">List &#183; Compare &#183; Meet</span></div>
              <h2>Market Place</h2>
              <div className="rule"></div>
              <p className="deck">Someone nearby wants it!</p>
              <ul>
                <li>Buy secondhand from neighbors</li>
                <li>Sell what won&#8217;t fit the new place</li>
                <li>Compare prices before you commit</li>
              </ul>
              <div className="art">
                <div className="plate"><div className="prow"><figure style={{flex:'45 1 0'}}><svg viewBox="0 -150 45 150" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Floor lamp"><g fill="#2B2B2B">
            <path d="M9 -150 H36 L45 -112 H0 Z"/>
            <rect x="19" y="-112" width="7" height="12"/>
            <path d="M14 -100 H31 L26 -58 H19 Z"/>
            <path d="M19 -58 H26 L35 -13 H10 Z"/>
            <rect x="7" y="-13" width="31" height="13" rx="3"/></g></svg></figure><div style={{flex:'67.5 1 0'}} aria-hidden="true"></div><figure style={{flex:'200 1 0'}}><svg viewBox="0 -150 200 150" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Sofa"><g fill="#2B2B2B">
            <rect x="0" y="-80" width="200" height="68" rx="13"/>
            <rect x="30" y="-12" width="12" height="12"/>
            <rect x="158" y="-12" width="12" height="12"/>
            <g className="cut"><path d="M27 -58 V-14 M173 -58 V-14 M27 -44 H173 M75 -44 V-14 M125 -44 V-14"/></g></g></svg></figure><div style={{flex:'67.5 1 0'}} aria-hidden="true"></div><figure style={{flex:'160 1 0'}}><svg viewBox="0 -150 160 150" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="TV and stand"><g fill="#2B2B2B">
            <rect x="30" y="-115" width="100" height="58" rx="3"/>
            <rect x="75" y="-57" width="10" height="9"/>
            <rect x="58" y="-48" width="44" height="6" rx="2"/>
            <rect x="0" y="-42" width="160" height="34" rx="3"/>
            <rect x="12" y="-8" width="11" height="8"/>
            <rect x="137" y="-8" width="11" height="8"/>
            <g className="cut"><path d="M4 -25 H156 M80 -42 V-25 M60 -34 H72 M88 -34 H100"/></g></g></svg></figure></div><div className="prow"><figure style={{flex:'240 1 0'}}><svg viewBox="0 -85 240 85" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Dining set"><g fill="#2B2B2B">
            <rect x="0" y="-85" width="28" height="11" rx="4"/>
            <rect x="0" y="-85" width="11" height="45"/>
            <rect x="0" y="-45" width="44" height="10" rx="3"/>
            <rect x="0" y="-35" width="11" height="35"/>
            <rect x="34" y="-35" width="10" height="35"/>
            <rect x="60" y="-75" width="120" height="10" rx="3"/>
            <rect x="68" y="-65" width="10" height="65"/>
            <rect x="162" y="-65" width="10" height="65"/>
            <rect x="212" y="-85" width="28" height="11" rx="4"/>
            <rect x="229" y="-85" width="11" height="45"/>
            <rect x="196" y="-45" width="44" height="10" rx="3"/>
            <rect x="196" y="-35" width="10" height="35"/>
            <rect x="229" y="-35" width="11" height="35"/></g></svg></figure><div style={{flex:'45 1 0'}} aria-hidden="true"></div><figure style={{flex:'100 1 0'}}><svg viewBox="0 -85 100 85" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Dresser"><g fill="#2B2B2B">
            <rect x="0" y="-80" width="100" height="66" rx="3"/>
            <rect x="6" y="-14" width="10" height="14"/>
            <rect x="84" y="-14" width="10" height="14"/>
            <g className="cut"><path d="M4 -58 H96 M4 -36 H96 M50 -79 V-59"/>
              <path d="M22 -68 H34 M66 -68 H78 M40 -47 H60 M40 -25 H60"/></g></g></svg></figure><div style={{flex:'45 1 0'}} aria-hidden="true"></div><figure style={{flex:'110 1 0'}}><svg viewBox="0 -85 110 85" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Coffee table"><g fill="#2B2B2B">
            <rect x="0" y="-40" width="110" height="8" rx="3"/>
            <rect x="7" y="-32" width="9" height="32"/>
            <rect x="94" y="-32" width="9" height="32"/>
            <rect x="7" y="-16" width="96" height="6"/></g></svg></figure></div></div></div>
              <div className="cap"><b>Fig. 02</b><span>Objects listed &#183; secondhand &amp; new</span><b className="enter">Enter &#8594;</b></div>
            </a>
          </div>
        </div>
    </>
  );
}
