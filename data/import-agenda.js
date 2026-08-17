#!/usr/bin/env node
/**
 * import-agenda.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Reads Data/ZDC_Agenda_Master_2026_Fall.xlsx and writes av-management/data/av-data.json.
 *
 * Usage (from workspace root):
 *   node av-management/data/import-agenda.js
 *
 * Run this once at the start of each event cycle to seed the data file from
 * the agenda spreadsheet.  Re-running is safe — it will merge new sessions in
 * and preserve any existing AV tracking fields (files, avNote, operatorNote)
 * on sessions whose id is unchanged.
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

// ── Session types to INCLUDE in AV tracking ──────────────────────────────────
const EXCLUDED_TYPES = new Set([
  "Meal", "Break", "Networking", "Transportation", "Registration",
  "Collaborative Session", "Collaborative Session Playbacks"
]);

// ── Only include sessions where Projection is "AV Team" or "Presenter" ────────
function hasAVProjection(projectionVal) {
  if (!projectionVal) return false;
  const p = projectionVal.trim().toLowerCase();
  return p.startsWith("av team") || p === "presenter";
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtTime(excelDateVal) {
  // Times in Excel are stored as fractional days from 1899-12-30
  if (excelDateVal == null || excelDateVal === "") return null;
  // If already a JS Date (SheetJS with dates:true)
  if (excelDateVal instanceof Date) {
    const h = excelDateVal.getUTCHours().toString().padStart(2, "0");
    const m = excelDateVal.getUTCMinutes().toString().padStart(2, "0");
    return `${h}:${m}`;
  }
  // Numeric fractional day
  if (typeof excelDateVal === "number") {
    // Strip integer part (date), keep fractional (time)
    const frac = excelDateVal % 1;
    const totalMin = Math.round(frac * 24 * 60);
    const h = Math.floor(totalMin / 60).toString().padStart(2, "0");
    const m = (totalMin % 60).toString().padStart(2, "0");
    return `${h}:${m}`;
  }
  // ISO string fallback
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

// ── Read workbook ─────────────────────────────────────────────────────────────
console.log(`Reading: ${XLSX_PATH}`);
const wb = XLSX.readFile(XLSX_PATH, { cellDates: true });
const ws = wb.Sheets["ZDC Agenda Master"];
if (!ws) {
  console.error("Sheet 'ZDC Agenda Master' not found. Available sheets:", wb.SheetNames);
  process.exit(1);
}

// Convert to array of arrays; first row is group headers, second row is real headers
const raw = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, dateNF: "yyyy-mm-dd" });

// Row 0 = group headers (Session Details, AV & Technical Needs, …)
// Row 1 = real column headers
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
  const title       = clean(col(row, "Session Title"));

  if (!day || !sessionType) continue;
  if (EXCLUDED_TYPES.has(sessionType)) continue;

  // Apply projection filter before reading the rest of the row
  const projectionRaw = clean(col(row, "Projection"));
  if (!hasAVProjection(projectionRaw)) continue;

  const dateRaw  = col(row, "Date");
  const startRaw = col(row, "Start Time (am/pm)");
  const endRaw   = col(row, "End Time (am/pm)");

  // Parse times — SheetJS with raw:false returns formatted strings like "3:00 PM"
  let startTime = null;
  let endTime   = null;
  if (startRaw) {
    // Try to convert "3:00 PM" → "15:00"
    const m12 = String(startRaw).match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
    if (m12) {
      let h = parseInt(m12[1]);
      const min = m12[2];
      const ampm = m12[3].toUpperCase();
      if (ampm === "PM" && h !== 12) h += 12;
      if (ampm === "AM" && h === 12) h = 0;
      startTime = `${h.toString().padStart(2,"0")}:${min}`;
    } else {
      startTime = String(startRaw).trim();
    }
  }
  if (endRaw) {
    const m12 = String(endRaw).match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
    if (m12) {
      let h = parseInt(m12[1]);
      const min = m12[2];
      const ampm = m12[3].toUpperCase();
      if (ampm === "PM" && h !== 12) h += 12;
      if (ampm === "AM" && h === 12) h = 0;
      endTime = `${h.toString().padStart(2,"0")}:${min}`;
    } else {
      endTime = String(endRaw).trim();
    }
  }

  const date       = fmtDate(dateRaw);
  const room       = clean(col(row, "Location/Room"));
  const safeTitle  = (title || "(Untitled)").replace(/\s+/g, " ").trim();

  // Stable dedup key: same session repeated across Monday AM / PM is distinct by time
  const dedupe = `${day}|${startTime}|${room}|${safeTitle.slice(0,50)}`;
  if (seenIds.has(dedupe)) continue;
  seenIds.add(dedupe);

  const id = slugify(`${day}-${startTime || "tba"}-${(room || "tbd").slice(0, 18)}-${safeTitle.slice(0, 28)}`);

  const projection  = projectionRaw; // already read above for filter
  const microphones = clean(col(row, "Microphones (type & quantity))"));
  const podiumRaw   = clean(col(row, "Podium Required"));
  const timerRaw    = clean(col(row, "Timer"));
  const monitor     = clean(col(row, "Monitor/Screen"));
  const specialReqs = clean(col(row, "Special Requirements"));
  const track       = clean(col(row, "Track"));
  const speakers    = clean(col(row, "Speaker(s)"));
  const roomSetup   = clean(col(row, "Room Setup Notes (INCLUDE: room set up, types of chairs, or luggage storage, DT Ushape)"));
  const description = clean(col(row, "Session Description"));

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
    // AV tracking fields — admin-editable, never overwritten by this script on re-run
    files: [],
    avNote: null,
    operatorNote: null
  });
}

console.log(`Parsed ${sessions.length} AV-relevant sessions across ${new Set(sessions.map(s=>s.day)).size} days.`);

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

for (const s of sessions) {
  const ex = existing[s.id];
  if (ex) {
    // Preserve all admin-managed fields — never overwrite with XLSX values
    s.files           = ex.files           || [];
    s.avNote          = ex.avNote          || null;
    s.operatorNote    = ex.operatorNote    || null;
    s.showInDashboard = ex.showInDashboard ?? false;
    // Preserve admin-edited AV fields if they differ from XLSX
    // (admin edits take precedence; XLSX value used only for new sessions)
    if (ex.projection  !== undefined) s.projection  = ex.projection;
    if (ex.microphones !== undefined) s.microphones = ex.microphones;
    if (ex.podium      !== undefined) s.podium      = ex.podium;
    if (ex.timer       !== undefined) s.timer       = ex.timer;
    if (ex.monitor     !== undefined) s.monitor     = ex.monitor;
    if (ex.specialReqs !== undefined) s.specialReqs = ex.specialReqs;
    if (ex.roomSetup   !== undefined) s.roomSetup   = ex.roomSetup;
    if (ex.room        !== undefined) s.room        = ex.room;
    if (ex.track       !== undefined) s.track       = ex.track;
  } else {
    // Brand-new session from XLSX — default dashboard to false
    s.showInDashboard = false;
  }
}

// ── Write output ──────────────────────────────────────────────────────────────
const output = {
  event:       "ZDC 2026 Fall",
  eventDates:  "Oct 18–22, 2026",
  location:    "Antwerp, Belgium",
  lastUpdated: new Date().toISOString(),
  changelog:   existing["__meta__"]?.changelog || [],
  sessions
};

// Preserve top-level changelog if it existed
if (fs.existsSync(OUT_PATH)) {
  try {
    const prev = JSON.parse(fs.readFileSync(OUT_PATH, "utf8"));
    if (Array.isArray(prev.changelog)) output.changelog = prev.changelog;
  } catch(_) {}
}

fs.writeFileSync(OUT_PATH, JSON.stringify(output, null, 2), "utf8");
console.log(`✓ Written to: ${OUT_PATH}`);
console.log(`  Sessions: ${sessions.length}`);
const days = [...new Set(sessions.map(s=>s.day))];
for (const d of days) {
  console.log(`    ${d}: ${sessions.filter(s=>s.day===d).length} sessions`);
}
