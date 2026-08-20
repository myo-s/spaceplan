"use client";

/**
 * SPACE PLAN — the furniture catalogue, as folders.
 *
 * Twenty-six silhouettes laid out flat is a wall of pictures: you cannot see
 * where one kind of thing ends and the next begins, and it swallows the panel
 * whether or not you are shopping. As five closed folders it is five lines of
 * text, and opening one is a single click that shows only that shelf.
 *
 * One folder open at a time, on purpose. Two open is how you get back to the
 * wall.
 */

import { useState } from "react";
import { CATEGORIES, FURNITURE, elevationSvg } from "../lib/furniture";

export default function Catalogue({ onPick, verb = "Add" }) {
  const [open, setOpen] = useState(null);

  return (
    <div className="folders">
      {CATEGORIES.map((c) => {
        const isOpen = open === c.name;
        return (
          <div className={"folder" + (isOpen ? " on" : "")} key={c.name}>
            <button className="foldhead" onClick={() => setOpen(isOpen ? null : c.name)}>
              <span className="caret">{isOpen ? "▾" : "▸"}</span>
              <b>{c.name}</b>
              <span className="count">{c.keys.length}</span>
            </button>
            {isOpen && (
              <div className="shelf">
                {c.keys.map((key) => (
                  <button
                    key={key}
                    className="tile"
                    onClick={() => onPick(key)}
                    title={`${verb} ${FURNITURE[key].label}`}
                  >
                    <span
                      className="tileart"
                      dangerouslySetInnerHTML={{ __html: elevationSvg(key, 200) }}
                    />
                    <span className="tilelab">{FURNITURE[key].label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/** Shared with every screen that shows the catalogue. */
export const CATALOGUE_CSS = `
.folders{display:flex;flex-direction:column;}
.folder{border-bottom:1px solid rgba(43,43,43,.14);}
.foldhead{width:100%;background:transparent;border:0;display:flex;align-items:center;gap:8px;
  padding:9px 4px;text-align:left;}
.foldhead:hover{background:rgba(43,43,43,.05);}
.foldhead b{font-weight:800;font-size:11px;text-transform:uppercase;letter-spacing:.1em;}
.foldhead .caret{font-size:10px;width:9px;opacity:.6;}
.foldhead .count{margin-left:auto;font-weight:700;font-size:10px;opacity:.5;}
.folder.on .foldhead{background:var(--gold);}
.shelf{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;padding:8px 4px 12px;}
.tile{background:transparent;border:1px solid rgba(43,43,43,.28);padding:7px 4px 5px;
  display:flex;flex-direction:column;align-items:center;gap:5px;min-width:0;}
.tile:hover{border-color:var(--ink);background:var(--gold);}
.tileart{display:flex;align-items:flex-end;justify-content:center;height:38px;width:100%;}
.tileart svg{height:100%;width:auto;max-width:100%;display:block;}
/* A tile label is the NAME OF A THING, so it is set the way the thing is
   written — the same words appear one click later in "What you own", and the
   same words in two different cases read as two different objects. The folder
   headings above stay in caps because a category is the app talking. */
.tilelab{font-weight:700;font-size:9px;letter-spacing:-.002em;
  text-align:center;line-height:1.2;opacity:.85;}
`;
