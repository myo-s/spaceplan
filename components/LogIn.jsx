"use client";

/**
 * SPACE PLAN — the account door.
 *
 * There is no account system behind this yet, and the page says so rather than
 * pretending. A form that swallows an email address and does nothing is worse
 * than no form: it teaches people that the app lies.
 *
 * So the page offers what actually works today — a plan file you can carry
 * between browsers and machines — and takes an email for the moment accounts
 * open. The file half is not a placeholder either; export and import is what a
 * plan needs regardless of accounts, and it is the thing that makes "Save
 * plan" on the last screen mean something.
 */

import { useEffect, useRef, useState } from "react";
import { PLAN_CSS } from "./RoomLayer";
import { fmtArea, homeArea, migrateRoom } from "../lib/plan";

const STORE = "spaceplan.plan.v4";

export default function LogIn() {
  const [plan, setPlan] = useState(null);
  const [email, setEmail] = useState("");
  const [note, setNote] = useState(null);
  const fileRef = useRef(null);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORE);
      if (raw) {
        const s = JSON.parse(raw);
        if (s?.homes) setPlan(s);
      }
    } catch {}
  }, []);

  const rooms = plan?.homes?.next?.rooms || [];
  const current = plan?.homes?.current?.rooms || [];
  const items = plan?.inventory || [];
  const has = current.length > 0 || rooms.length > 0 || items.length > 0;

  const download = () => {
    if (!plan) return;
    try {
      const url = URL.createObjectURL(
        new Blob([JSON.stringify(plan, null, 2)], { type: "application/json" })
      );
      const a = document.createElement("a");
      a.href = url;
      a.download = "space-plan.json";
      a.click();
      URL.revokeObjectURL(url);
      setNote("Saved. The file is in your downloads.");
    } catch {
      setNote("That did not work — your browser blocked the download.");
    }
  };

  /**
   * Importing REPLACES, and says so before it does it. A plan is an hour of
   * somebody's evening; silently merging two of them would produce a third
   * that is nobody's.
   */
  const open = (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const s = JSON.parse(String(reader.result));
        if (!s?.homes?.current || !s?.homes?.next) throw new Error("not a plan");
        const clean = {
          unit: s.unit === "ft" ? "ft" : "cm",
          homes: {
            current: { rooms: (s.homes.current.rooms || []).map(migrateRoom) },
            next: { rooms: (s.homes.next.rooms || []).map(migrateRoom) },
          },
          inventory: Array.isArray(s.inventory) ? s.inventory : [],
        };
        if (has && !window.confirm("This replaces the plan already in this browser. Open it anyway?")) return;
        window.localStorage.setItem(STORE, JSON.stringify(clean));
        setPlan(clean);
        setNote("Opened. Every screen is showing this plan now.");
      } catch {
        setNote("That file is not a Space Plan.");
      }
    };
    reader.readAsText(file);
  };

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
          <h1>Log in</h1>
          <div className="steps">
            <a className="step" href="/plan">← Final plan</a>
          </div>
        </header>

        <div className="cols">
          <section className="col">
            <h2 className="colhead">An account, soon</h2>
            <p className="body">
              Accounts are not open yet. Leave an address and we will write to you once
              they are — one line, once, and nothing else.
            </p>
            <form
              className="form"
              onSubmit={(e) => {
                e.preventDefault();
                setNote(
                  email.includes("@")
                    ? "Noted. Nothing has been sent anywhere — accounts are not live yet."
                    : "That address does not look right."
                );
              }}
            >
              <label htmlFor="em">Email</label>
              <div className="field">
                <input
                  id="em"
                  type="email"
                  value={email}
                  placeholder="you@example.com"
                  onChange={(e) => setEmail(e.target.value)}
                />
                <button className="seg" type="submit">Tell me</button>
              </div>
            </form>
            <p className="body dim">
              When accounts open, signing in will keep your plan on our side rather than in
              this browser, and let you open it from a phone or another machine.
            </p>
          </section>

          <section className="col">
            <h2 className="colhead">Your plan, as a file</h2>
            <p className="body">
              This works today, with no account. The whole plan — both floor plans, every
              piece, every decision — is one small file you own.
            </p>

            {has ? (
              <div className="planbox">
                <p className="planline">
                  <b>{current.length}</b> room{current.length === 1 ? "" : "s"} now
                  {" · "}
                  <b>{rooms.length}</b> room{rooms.length === 1 ? "" : "s"} next
                  {" · "}
                  <b>{items.length}</b> piece{items.length === 1 ? "" : "s"}
                </p>
                <p className="planline dim">
                  {fmtArea(homeArea(current), plan?.unit || "cm")} →{" "}
                  {fmtArea(homeArea(rooms), plan?.unit || "cm")}
                </p>
              </div>
            ) : (
              <p className="body dim">There is no plan in this browser yet.</p>
            )}

            <div className="acts">
              <button className="seg" onClick={download} disabled={!has}>Save plan to a file</button>
              <button className="seg" onClick={() => fileRef.current?.click()}>Open a plan file</button>
              <input
                ref={fileRef}
                type="file"
                accept="application/json,.json"
                hidden
                onChange={(e) => {
                  open(e.target.files?.[0]);
                  e.target.value = "";
                }}
              />
            </div>
          </section>
        </div>

        {note && <p className="note">{note}</p>}

        <footer className="foot">
          <div className="sum">
            <span>Nothing here leaves your browser</span>
          </div>
          <div className="footr">
            <a className="ghost" href="/plan">← Back</a>
            <a className="gonext" href="/draw-room">Start a plan →</a>
          </div>
        </footer>
      </div>
    </>
  );
}

const CSS = `
.wrap{height:auto;min-height:100dvh;overflow:visible;}
.steps a.step{opacity:1;}

.cols{display:grid;grid-template-columns:1fr 1fr;gap:clamp(20px,3vw,48px);
  align-items:start;flex:1 1 auto;}
.col{border-top:3px solid var(--ink);padding-top:10px;min-width:0;}
.colhead{font-family:var(--display);font-weight:800;letter-spacing:-.02em;font-size:19px;
  margin-bottom:8px;}
.body{font-weight:600;font-size:13px;line-height:1.55;max-width:46ch;margin-bottom:14px;}
.body.dim{opacity:.65;font-size:12px;}

.form label{display:block;font-weight:700;font-size:9.5px;text-transform:uppercase;
  letter-spacing:.16em;opacity:.6;margin-bottom:6px;}
.field{display:flex;align-items:stretch;border:1px solid var(--ink);max-width:420px;
  margin-bottom:14px;}
.field input{flex:1 1 auto;min-width:0;background:transparent;border:0;
  font-family:var(--text);font-weight:700;font-size:13px;color:var(--ink);padding:8px 10px;}
.field input:focus{outline:none;background:rgba(43,43,43,.06);}
.field .seg{border:0;border-left:1px solid var(--ink);}

.planbox{border-left:4px solid var(--gold);padding:2px 0 2px 12px;margin-bottom:14px;}
.planline{font-weight:600;font-size:12.5px;line-height:1.6;}
.planline b{font-weight:800;}
.planline.dim{opacity:.65;font-size:11.5px;}
.acts{display:flex;gap:8px;flex-wrap:wrap;}

.note{margin-top:18px;padding:9px 12px;background:var(--gold);
  font-weight:700;font-size:12px;align-self:flex-start;}

@media (max-width:820px){ .cols{grid-template-columns:1fr;} }
`;
