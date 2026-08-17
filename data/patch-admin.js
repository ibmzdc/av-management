// patch-admin.js — inlines av-data.json into admin.html and dashboard.html as offline fallback
// Run from the av-management directory:  node data/patch-admin.js
// Or from workspace root:                node av-management/data/patch-admin.js
const fs   = require("fs");
const path = require("path");

const DATA_PATH      = path.join(__dirname, "av-data.json");
const ADMIN_PATH     = path.join(__dirname, "../app/admin.html");
const DASHBOARD_PATH = path.join(__dirname, "../app/dashboard.html");

const raw     = fs.readFileSync(DATA_PATH, "utf8");
const compact = JSON.stringify(JSON.parse(raw));  // compact, validated JSON

// ── Shared: replace `const EMBEDDED_DATA = <any>;` in any HTML file ──────────
function patchEmbeddedData(filePath) {
  let html = fs.readFileSync(filePath, "utf8");
  // Matches: const EMBEDDED_DATA = ...any amount of content...; (greedy on same line is fine;
  //          multi-line blobs end with }; on the same logical line since JSON is one line)
  if (!html.includes("const EMBEDDED_DATA = {")) {
    console.error(`⚠  Could not find EMBEDDED_DATA constant in ${path.basename(filePath)}`);
    process.exit(1);
  }
  const replaced = html.replace(
    /const EMBEDDED_DATA = \{.+\}(?=;\s*\n)/,
    `const EMBEDDED_DATA = ${compact}`
  );
  if (replaced === html) {
    console.log(`  (no change) ${path.basename(filePath)} — already up to date`);
    return;
  }
  fs.writeFileSync(filePath, replaced, "utf8");
  console.log(`✓ Patched ${path.basename(filePath)} — ${fs.statSync(filePath).size} bytes`);
}

// ── Patch admin.html ──────────────────────────────────────────────────────────
// admin.html also has a full load() function block that contains a Tier-3 fallback.
// We replace just the EMBEDDED_DATA assignment — the load() logic is left as-is.
patchEmbeddedData(ADMIN_PATH);

// ── Patch dashboard.html ──────────────────────────────────────────────────────
// dashboard.html is read-only for vendors; it also uses EMBEDDED_DATA as Tier-3 fallback.
patchEmbeddedData(DASHBOARD_PATH);
