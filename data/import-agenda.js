#!/usr/bin/env node
/**
 * import-agenda.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Reads Data/ZDC_Agenda_Master_2026_Fall.xlsx and writes av-management/data/av-data.json.
 *
 * Usage (from workspace root):
 *   node av-management/data/import-agenda.js
 *
 * Re-running is safe — it will merge new/changed sessions and preserve all
 * admin-edited AV tracking fields (files, avNote, operatorNote, showInDashboard,
 * and all av.* overrides) for any session whose id is unchanged.
 *
 * Inclusion rules:
 *   • ALL session types are imported (no type exclusion).
 *   • Only rows that have at least a Day, Date, and Start Time are included.
 *   • Duplicate rows (same Day + StartTime + Room + Title) are de-duped.
 *
 * Requirements:
 *   npm install xlsx          (SheetJS community edition)
 *
 * ─────────────────────────────────────────────────────────────────────────────
 */

const fs   = require("fs");
const path = require("path");
const XLSX = require("xlsx");

// ── Paths ────────────────────────────────────────────────────────────────────
const XLSX_PATH = path.join(__dirname, "../../Data/ZDC_Agenda_Master_2026_Fall.xlsx");
const OUT_PATH  = path.join(__dirname, "av-data.json");

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtTime(excelDateVal) {
  if (excelDateVal == null || excelDateVal === "") return null;
  if (excelDateVal instanceof Date) {
    const h = excelDateVal.getUTCHours().toString().padStart(2, "0");
    const m = excelDateVal.getUTCMinutes().toString().padStart(2, "0");
    return `${h}:${m}`;
  }
  if (typeof excelDateVal === "number") {
    const frac = excelDateVal % 1;
    const totalMin = Math.round(frac * 24 * 60);
    const h = Math.floor(totalMin / 60).toString().padStart(2, "0");
    const m = (totalMin % 60).toString().padStart(2, "0");
    return `${h}:${m}`;
  }
  if (typeof excelDateVal === "string" && excelDateVal.includes("T")) {
    const d = new Date(excelDateVal);
    if (!isNaN(d)) {
      const h = d.getUTCHours().toString().padStart(2, "0");
      const m = d.getUTCMinutes().toString().padStart(2, "0");
      return `${h}:${m}`;
    }
  }
  return null;
}

function fmtDate(val) {
  if (!val) return null;
  if (val instanceof Date) return val.toISOString().slice(0, 10);
  if (typeof val === "string" && val.includes("T")) return val.slice(0, 10);
  return null;
}

function slugify(str) {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

function clean(val) {
  if (val == null) return null;
  const s = String(val).replace(/\s+/g, " ").trim();
  return s || null;
}

// Parse 12-hour time string "3:00 PM" → "15:00"
function parse12h(raw) {
  if (!raw) return null;
  const m12 = String(raw).match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (m12) {
    let h = parseInt(m12[1]);
    const min = m12[2];
    const ampm = m12[3].toUpperCase();
    if (ampm === "PM" && h !== 12) h += 12;
    if (ampm === "AM" && h === 12) h = 0;
    return `${h.toString().padStart(2, "0")}:${min}`;
  }
  return String(raw).trim() || null;
}

// ── Read workbook ─────────────────────────────────────────────────────────────
console.log(`Reading: ${XLSX_PATH}`);
const wb = XLSX.readFile(XLSX_PATH, { cellDates: true });
const ws = wb.Sheets["ZDC Agenda Master"];
if (!ws) {
  console.error("Sheet 'ZDC Agenda Master' not found. Available sheets:", wb.SheetNames);
  process.exit(1);
}

// Row 0 = group headers (Session Details, AV & Technical Needs, …)
// Row 1 = real column headers
const raw = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, dateNF: "yyyy-mm-dd" });
const colHeaders = raw[1];
const dataRows   = raw.slice(2);

// Build column-name → index map (use first occurrence for duplicates)
const idx = {};
colHeaders.forEach((h, i) => {
  if (h && !idx[h]) idx[h] = i;
});

// Helper to get a value by column header name
function col(row, name) {
  const i = idx[name];
  return i !== undefined ? row[i] : undefined;
}

// ── Parse sessions ────────────────────────────────────────────────────────────
const sessions = [];
const seenIds  = new Set();

for (const row of dataRows) {
  // Skip entirely empty rows
  if (!row || row.every(c => c == null || c === "")) continue;

  const day         = clean(col(row, "Day"));
  const sessionType = clean(col(row, "Session Type"));
  const dateRaw     = col(row, "Date");
  const startRaw    = col(row, "Start Time (am/pm)");
  const endRaw      = col(row, "End Time (am/pm)");

  // Must have day + date + start time to be a valid session row
  if (!day || !sessionType || !dateRaw || !startRaw) continue;

  const date      = fmtDate(dateRaw);
  const startTime = parse12h(startRaw);
  const endTime   = parse12h(endRaw);

  const title      = clean(col(row, "Session Title"));
  const room       = clean(col(row, "Location/Room"));
  const safeTitle  = (title || "(Untitled)").replace(/\s+/g, " ").trim();

  // Stable de-dup key: same session repeated (e.g. AM/PM collab slots) is distinct by time+room+title
  const dedupe = `${day}|${startTime}|${(room||"").trim()}|${safeTitle.slice(0, 50)}`;
  if (seenIds.has(dedupe)) continue;
  seenIds.add(dedupe);

  const id = slugify(`${day}-${startTime || "tba"}-${(room || "tbd").slice(0, 18)}-${safeTitle.slice(0, 28)}`);

  const projection  = clean(col(row, "Projection"));
  const microphones = clean(col(row, "Microphones (type & quantity))"));
  const podiumRaw   = clean(col(row, "Podium Required"));
  const timerRaw    = clean(col(row, "Timer"));
  const monitor     = clean(col(row, "Monitor/Screen"));
  const specialReqs = clean(col(row, "Special Requirements"));
  const track       = clean(col(row, "Track"));
  const speakers    = clean(col(row, "Speaker(s)"));
  const roomSetup   = clean(col(row, "Room Setup Notes (INCLUDE: room set up, types of chairs, or luggage storage, DT Ushape)"));
  const description = clean(col(row, "Session Description"));

  // Seed av.presentationRequired for new sessions where the AV team drives projection
  const projLower = (projection || "").trim().toLowerCase();
  const avTeamPresentation = projLower.startsWith("av team") || projLower.startsWith("av ");

  sessions.push({
    id,
    day,
    date,
    startTime,
    endTime,
    sessionType,
    track: track || null,
    title: safeTitle,
    description: description || null,
    speakers: speakers ? speakers.replace(/[\t\n]+/g, ", ").replace(/,\s*,/g, ",").trim() : null,
    room: room || null,
    roomSetup: roomSetup || null,
    projection: projection || null,
    microphones: microphones || null,
    podium: podiumRaw === "Yes" || podiumRaw === "yes",
    timer: timerRaw && timerRaw !== " " ? timerRaw : null,
    monitor: monitor || null,
    specialReqs: specialReqs || null,
    showInDashboard: false,
    // Seed av.presentationRequired from XLSX for new sessions (preserved on re-run for existing)
    av: avTeamPresentation ? { presentationRequired: true } : undefined,
    // AV tracking fields — admin-editable, never overwritten by this script on re-run
    files: [],
    avNote: null,
    operatorNote: null
  });
}

console.log(`Parsed ${sessions.length} sessions across ${new Set(sessions.map(s=>s.day)).size} days.`);

// ── Merge with existing data (preserve AV tracking fields) ────────────────────
let existing = {};
if (fs.existsSync(OUT_PATH)) {
  try {
    const prev = JSON.parse(fs.readFileSync(OUT_PATH, "utf8"));
    for (const s of (prev.sessions || [])) {
      existing[s.id] = s;
    }
    console.log(`Found ${Object.keys(existing).length} existing sessions — merging…`);
  } catch(e) {
    console.warn("Could not read existing data, starting fresh:", e.message);
  }
}

let preserved = 0;
let brandNew  = 0;

for (const s of sessions) {
  const ex = existing[s.id];
  if (ex) {
    preserved++;
    // Preserve all admin-managed tracking fields — never overwrite with XLSX values
    s.files           = ex.files           || [];
    s.avNote          = ex.avNote          || null;
    s.operatorNote    = ex.operatorNote    || null;
    s.showInDashboard = ex.showInDashboard ?? false;
    // Preserve any admin-edited AV fields stored in s.av
    if (ex.av !== undefined) s.av = ex.av;
  } else {
    brandNew++;
    // Brand-new session — defaults already set above
  }
}

// Identify dropped sessions (were in existing JSON, not in new XLSX)
const newIds = new Set(sessions.map(s => s.id));
const dropped = Object.keys(existing).filter(id => !newIds.has(id));
if (dropped.length > 0) {
  console.log(`\n⚠  Dropped ${dropped.length} sessions (removed from XLSX):`);
  for (const id of dropped) {
    const s = existing[id];
    const hadData = (s.files && s.files.length > 0) || s.avNote || s.operatorNote || s.showInDashboard;
    console.log(`   ${hadData ? "*** HAS AV DATA *** " : ""}${s.day} | ${s.title} [${id}]`);
  }
}

console.log(`\nMerge summary: ${preserved} preserved · ${brandNew} new · ${dropped.length} dropped`);

// ── Write output ──────────────────────────────────────────────────────────────
let changelog = [];
if (fs.existsSync(OUT_PATH)) {
  try {
    const prev = JSON.parse(fs.readFileSync(OUT_PATH, "utf8"));
    if (Array.isArray(prev.changelog)) changelog = prev.changelog;
  } catch(_) {}
}

const output = {
  event:       "ZDC 2026 Fall",
  eventDates:  "Oct 18–22, 2026",
  location:    "Antwerp, Belgium",
  lastUpdated: new Date().toISOString(),
  changelog,
  sessions
};

fs.writeFileSync(OUT_PATH, JSON.stringify(output, null, 2), "utf8");
console.log(`\n✓ Written to: ${OUT_PATH}`);
console.log(`  Total sessions: ${sessions.length}`);
const days = [...new Set(sessions.map(s=>s.day))];
for (const d of days) {
  console.log(`    ${d}: ${sessions.filter(s=>s.day===d).length} sessions`);
}
