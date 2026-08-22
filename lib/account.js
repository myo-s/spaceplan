"use client";

/**
 * SPACE PLAN — the account, as far as it goes today.
 *
 * THERE IS NO SERVER YET. This module is the shape of the real thing wearing
 * localStorage: an account is an email and a name, and a saved plan is a row
 * with an id, a title, a timestamp and the plan itself. When Postgres arrives,
 * every function here becomes one query and NOTHING ELSE IN THE APP CHANGES,
 * because no screen touches the storage directly — they all come through these
 * six calls.
 *
 * It is written down plainly on the screens that use it: an account kept in
 * one browser is not an account, and pretending otherwise would be the kind of
 * lie people only discover on their second device.
 */

const ACCOUNT = "spaceplan.account.v1";
const SAVED = "spaceplan.saved.v1";
export const PLAN_STORE = "spaceplan.plan.v4";

const read = (key, fallback) => {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
};

const write = (key, value) => {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {}
};

export function getAccount() {
  const a = read(ACCOUNT, null);
  return a && a.email ? a : null;
}

/** Log in and sign up are the same call here; only the screens differ. */
export function setAccount({ email, name }) {
  const a = { email: String(email || "").trim(), name: String(name || "").trim() };
  if (!a.email) return null;
  write(ACCOUNT, a);
  return a;
}

export function clearAccount() {
  try {
    window.localStorage.removeItem(ACCOUNT);
  } catch {}
}

/** Newest first — the one you want is almost always the one you touched last. */
export function listPlans() {
  const rows = read(SAVED, []);
  return Array.isArray(rows)
    ? rows.slice().sort((a, b) => (b.savedAt || 0) - (a.savedAt || 0))
    : [];
}

/**
 * Save the plan sitting in the browser to the account. `id` updates a row in
 * place — otherwise the list fills up with a dozen near-identical copies of
 * one evening's work, which is worse than no history at all.
 */
export function savePlan(plan, { id, title } = {}) {
  if (!plan) return null;
  const rows = read(SAVED, []).filter(Boolean);
  const stamp = Date.now();
  const at = rows.findIndex((r) => r.id === id);
  const row = {
    id: id || `plan_${stamp.toString(36)}`,
    title: title || (at >= 0 ? rows[at].title : "") || defaultTitle(rows.length),
    savedAt: stamp,
    data: plan,
  };
  if (at >= 0) rows[at] = row;
  else rows.push(row);
  write(SAVED, rows);
  return row;
}

export function removePlan(id) {
  write(SAVED, read(SAVED, []).filter((r) => r && r.id !== id));
}

/** Put a saved plan back where every screen looks for it. */
export function openPlan(id) {
  const row = read(SAVED, []).find((r) => r && r.id === id);
  if (!row) return null;
  write(PLAN_STORE, row.data);
  return row;
}

/** The plan currently in the browser, whether or not it has ever been saved. */
export function currentPlan() {
  const p = read(PLAN_STORE, null);
  return p?.homes ? p : null;
}

function defaultTitle(n) {
  return n === 0 ? "My move" : `My move ${n + 1}`;
}

export function whenSaved(ms) {
  if (!ms) return "";
  const d = new Date(ms);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  const time = d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  if (sameDay) return `Today, ${time}`;
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short" }) + `, ${time}`;
}
