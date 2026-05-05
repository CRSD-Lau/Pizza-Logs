import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { GearImportBookmarklet } from "../app/admin/GearImportBookmarklet";
import { LOCAL_USERSCRIPT_URL, USERSCRIPT_URL } from "../lib/armory-gear-client-scripts";

const markup = renderToStaticMarkup(React.createElement(GearImportBookmarklet));

assert.match(markup, /Browser Gear Import/);
assert.match(markup, new RegExp(USERSCRIPT_URL.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
assert.match(markup, new RegExp(LOCAL_USERSCRIPT_URL.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
assert.match(markup, /Install \/ Update Gear Userscript/);
assert.match(markup, /Install Local Gear Userscript/);
assert.doesNotMatch(markup, /Character Portraits|Portrait Userscript|player-portraits/);

console.log("gear-import-bookmarklet tests passed");
