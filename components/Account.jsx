"use client";

/**
 * SPACE PLAN — log in, sign up, and the plans behind them.
 *
 * ONE COMPONENT, TWO DOORS. `mode` decides which of them this page is; the
 * form is nearly identical and the difference that matters is which one asks
 * for a name and where the small print points. Two files would have drifted.
 *
 * A NOTE ON THE TWO WORDS, because they are not the pair they look like:
 * "log in" and "sign IN" mean the same thing in English — both are for an
 * account you already have. The opposite of logging in is signing UP. Calling
 * the create-an-account page "Sign in" would put the same instruction on both
 * doors, which is exactly the mistake the small print is there to prevent.
 *
 * THE POINT OF LOGGING IN IS THE LIST. Before, this page offered a file to
 * download, which is a fine backup and a poor reason to make an account. Now
 * logging in shows your saved plans and lets you open one — which is what an
 * account is for, and what makes "Save plan" on the last screen mean anything.
 */

import { useEffect, useState } from "react";
import { MOBILE_CSS, PLAN_CSS } from "./RoomLayer";
import { fmtArea, homeArea } from "../lib/plan";
import {
  clearAccount, currentPlan, getAccount, listPlans, openPlan, removePlan,
  savePlan, setAccount, whenSaved,
} from "../lib/account";

export default function Account({ mode = "login" }) {
  const isSignup = mode === "signup";
  const [account, setAcc] = useState(null);
  const [ready, setReady] = useState(false);
  const [rows, setRows] = useState([]);
  const [here, setHere] = useState(null);
  const [form, setForm] = useState({ name: "", email: "" });
  const [note, setNote] = useState(null);

  const refresh = () => {
    setRows(listPlans());
    setHere(currentPlan());
  };

  useEffect(() => {
    setAcc(getAccount());
    refresh();
    setReady(true);
  }, []);

  const submit = (e) => {
    e.preventDefault();
    if (!form.email.includes("@")) return setNote("That address does not look right.");
    const a = setAccount(form);
    setAcc(a);
    setNote(null);
    refresh();
  };

  const saveCurrent = () => {
    const p = currentPlan();
    if (!p) return setNote("There is no plan in this browser to save.");
    savePlan(p);
    refresh();
    setNote("Saved.");
  };

  const open = (id) => {
    openPlan(id);
    refresh();
    setNote("Opened. Every screen is showing this plan now.");
  };

  if (!ready) return <div style={{ minHeight: "100vh", background: "#ECE8E3" }} />;

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
          <h1>{account ? "Your account" : isSignup ? "Sign up" : "Log in"}</h1>
          <div className="steps">
            <a className="step on" href="/plan">← Final plan</a>
          </div>
        </header>

        {account ? (
          <SavedPlans
            account={account}
            rows={rows}
            here={here}
            onOpen={open}
            onSave={saveCurrent}
            onRemove={(id) => { removePlan(id); refresh(); }}
            onOut={() => { clearAccount(); setAcc(null); setNote(null); }}
          />
        ) : (
          <div className="door">
            <form className="form" onSubmit={submit}>
              <p className="body">
                {isSignup
                  ? "Make an account and your plan follows you — to a phone on the way to a viewing, to a laptop at the kitchen table."
                  : "Log in and your saved plans are here, ready to open."}
              </p>

              {isSignup && (
                <>
                  <label htmlFor="nm">Your name</label>
                  <div className="field">
                    <input id="nm" value={form.name} placeholder="Myokyung"
                      onChange={(e) => setForm({ ...form, name: e.target.value })} />
                  </div>
                </>
              )}

              <label htmlFor="em">Email</label>
              <div className="field">
                <input id="em" type="email" value={form.email} placeholder="you@example.com"
                  onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>

              <button className="gonext wide" type="submit">
                {isSignup ? "Create my account" : "Log in"} →
              </button>

              {/* the two doors point at each other, and only at each other */}
              <p className="swap">
                {isSignup ? (
                  <>Already have an account? <a href="/login">Log in</a>.</>
                ) : (
                  <>Don&apos;t have an account? <a href="/signup">Sign up</a>.</>
                )}
              </p>
            </form>

            <aside className="aside">
              <h2 className="colhead">Where this goes</h2>
              <p className="body">
                Right now an account lives in this browser and nowhere else. It is enough to
                show you how it works, and it is not enough to trust with an hour of your
                evening.
              </p>
              <p className="body">
                Real accounts are next: the plan will sit on our side, and this page will
                open it on any machine you log in from.
              </p>
            </aside>
          </div>
        )}

        {note && <p className="note">{note}</p>}

        <footer className="foot">
          <div className="sum">
            <span>{account ? account.email : "Kept in this browser for now"}</span>
          </div>
          <div className="footr">
            <a className="ghost" href="/plan">← Back</a>
            {account
              ? <a className="gonext" href="/draw-room">Keep planning →</a>
              : <a className="gonext" href="/draw-room">Start a plan →</a>}
          </div>
        </footer>
      </div>
    </>
  );
}

/**
 * What you logged in FOR. The plan open in the browser sits at the top with
 * the one button that matters, and everything you have saved is underneath it.
 */
function SavedPlans({ account, rows, here, onOpen, onSave, onRemove, onOut }) {
  const unit = here?.unit || "cm";
  return (
    <div className="acct">
      <div className="who">
        <p className="whoname">{account.name || account.email}</p>
        <button className="seg" onClick={onOut}>Log out</button>
      </div>

      <section className="block">
        <h2 className="colhead">Open in this browser</h2>
        {here ? (
          <div className="here">
            <p className="planline">
              <b>{here.homes?.current?.rooms?.length || 0}</b> room
              {(here.homes?.current?.rooms?.length || 0) === 1 ? "" : "s"} now
              {" · "}
              <b>{here.homes?.next?.rooms?.length || 0}</b> room
              {(here.homes?.next?.rooms?.length || 0) === 1 ? "" : "s"} next
              {" · "}
              <b>{(here.inventory || []).length}</b> piece
              {(here.inventory || []).length === 1 ? "" : "s"}
              {" · "}
              {fmtArea(homeArea(here.homes?.current?.rooms || []), unit)} →{" "}
              {fmtArea(homeArea(here.homes?.next?.rooms || []), unit)}
            </p>
            <button className="seg" onClick={onSave}>Save to my account</button>
          </div>
        ) : (
          <p className="body dim">Nothing drawn yet in this browser.</p>
        )}
      </section>

      <section className="block">
        <h2 className="colhead">Saved plans <b>{rows.length}</b></h2>
        {rows.length === 0 ? (
          <p className="body dim">
            Nothing saved yet. Save the plan above, or press Save plan on the Final plan
            screen.
          </p>
        ) : (
          <ul className="plans">
            {rows.map((r) => {
              const cur = r.data?.homes?.current?.rooms || [];
              const nxt = r.data?.homes?.next?.rooms || [];
              const inv = r.data?.inventory || [];
              const u = r.data?.unit || "cm";
              return (
                <li className="planrow" key={r.id}>
                  <div className="planmeta">
                    <b>{r.title}</b>
                    <span className="when">{whenSaved(r.savedAt)}</span>
                    <span className="planline dim">
                      {cur.length} → {nxt.length} rooms · {inv.length} piece
                      {inv.length === 1 ? "" : "s"} ·{" "}
                      {fmtArea(homeArea(cur), u)} → {fmtArea(homeArea(nxt), u)}
                    </span>
                  </div>
                  <div className="planacts">
                    <button className="seg" onClick={() => onOpen(r.id)}>Open</button>
                    <button className="ghost sm danger" onClick={() => onRemove(r.id)}>Delete</button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

const CSS = `
.wrap{height:auto;min-height:100dvh;overflow:visible;}
.steps a.step{opacity:1;}
.colhead{font-family:var(--display);font-weight:800;letter-spacing:-.02em;font-size:19px;
  display:flex;align-items:baseline;gap:8px;margin-bottom:8px;}
.colhead b{margin-left:auto;font-weight:800;font-size:13px;opacity:.55;}
.body{font-weight:600;font-size:13px;line-height:1.6;max-width:44ch;margin-bottom:16px;}
.body.dim{opacity:.65;}

/* ---------- the door ---------- */
.door{display:grid;grid-template-columns:minmax(0,420px) minmax(0,1fr);
  gap:clamp(24px,5vw,80px);align-items:start;flex:1 1 auto;}
.form{padding-top:2px;}
.form label{display:block;font-weight:700;font-size:9.5px;text-transform:uppercase;
  letter-spacing:.16em;opacity:.6;margin-bottom:6px;}
.field{display:flex;align-items:stretch;border:1px solid var(--ink);margin-bottom:14px;}
.field input{flex:1 1 auto;min-width:0;width:100%;background:transparent;border:0;
  font-family:var(--text);font-weight:700;font-size:13px;color:var(--ink);padding:9px 11px;}
.field input:focus{outline:none;background:rgba(39,40,41,.06);}
.gonext.wide{display:block;width:100%;text-align:center;}
.swap{margin-top:14px;font-weight:600;font-size:12.5px;}
.swap a{color:var(--ink);font-weight:800;text-underline-offset:3px;}
.aside{padding-top:2px;}

/* ---------- the account ---------- */
.acct{flex:1 1 auto;}
/* no rule here: it would sit 25px under the headband's own 3px rule and read
   as one badly-drawn double line */
.who{display:flex;align-items:center;justify-content:space-between;gap:12px;
  margin-bottom:26px;}
.whoname{font-family:var(--display);font-weight:800;font-size:22px;letter-spacing:-.02em;}
.block{margin-bottom:28px;}
.here{border-left:4px solid var(--gold);padding-left:12px;}
.planline{font-weight:600;font-size:12.5px;line-height:1.6;margin-bottom:10px;}
.planline b{font-weight:800;}
.planline.dim{opacity:.62;font-size:11.5px;margin-bottom:0;}

.plans{list-style:none;border-top:1px solid rgba(39,40,41,.3);}
.planrow{display:flex;align-items:center;justify-content:space-between;gap:16px;
  flex-wrap:wrap;padding:11px 2px;border-bottom:1px solid rgba(39,40,41,.16);}
.planmeta{min-width:0;display:flex;flex-direction:column;gap:2px;}
.planmeta b{font-weight:800;font-size:14px;letter-spacing:-.01em;}
.when{font-weight:700;font-size:9.5px;text-transform:uppercase;letter-spacing:.14em;opacity:.55;}
.planacts{display:flex;gap:6px;flex:0 0 auto;}

.note{margin-top:6px;margin-bottom:6px;padding:9px 12px;background:var(--gold);
  font-weight:700;font-size:12px;align-self:flex-start;}

@media (max-width:860px){ .door{grid-template-columns:minmax(0,1fr);} }
`;
