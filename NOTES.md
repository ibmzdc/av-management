# AV Management Tool — Developer Notes

Quick-reference for anyone (human or AI) picking up this project.

---

## What this is

A two-page AV management tool for the IBM Z Design Council (ZDC) conference.
- **`app/admin.html`** — AV lead only. Edit sessions, AV requirements, file statuses.
- **`app/dashboard.html`** — Read-only vendor view. Auto-refreshes every 60 s.
- **`data/av-data.json`** — Live session data. Saved via GitHub Contents API.
- **`app/av-config.js`** — Reference copy of config constants. **Not loaded by HTML files** (blocked on `file://`). Edit here first, then sync to both HTML files manually.

Runs as plain HTML from `file://` or GitHub Pages — no build step, no framework.

---

## Critical gotchas

### 1. No nested template literals in `renderAVReqs()`
Using backtick strings inside a template literal causes a **silent JS parse error** that kills the entire page with no console output. `renderAVReqs()` must use plain string concatenation (`+`). This has broken the page twice — do not "clean it up" with template literals.

### 2. No `:has()` CSS selector
Not supported in Firefox / older Safari. Use `getElementById` or class toggling instead.

### 3. Config must be inlined in both HTML files
`av-config.js` cannot be loaded via `<script src>` on `file://`. The four constants below are copy-pasted into the first `<script>` block of each HTML file:
- `AV_GROUPS`
- `AV_CONFIG`
- `ROOM_SETUP_PRESETS`
- `STAGE_SETUP_PRESETS`

**Three-file rule:** any change to these constants must be made in all three places:
1. `app/av-config.js` (reference)
2. `app/admin.html` (inline `<script>`)
3. `app/dashboard.html` (inline `<script>`)

### 4. `EMBEDDED_DATA` fallback
Both HTML files inline `EMBEDDED_DATA` (a snapshot of `av-data.json`) as a fallback for `file://` use. When saving sessions via the GitHub API, the HTML files are **not** automatically updated — `EMBEDDED_DATA` will drift from live data. That is expected and acceptable.

### 5. Legacy root fields
When saving a session, these legacy root-level fields are mirrored from `s.av.*` for backward compatibility with old session data:
- `s.roomSetup` ← `s.av.roomSetup`
- `s.stageSetup` ← `s.av.stageSetup`
- `s.podium` ← `s.av.podium`
- `s.specialReqs` ← `s.av.specialReqs`

---

## Git workflow

**The git repo root is `av-management/`**, one level below the workspace root (`ZDC 2016 Fall v2/`).

Always use `cwd: "av-management"` for all git commands. The remote frequently has ahead commits (data file updated by a separate process), so always:

```bash
git pull --rebase && git push
```

Never just `git push` without pulling first.

---

## Room / Stage Setup picker format

Room Setup and Stage Setup values are serialised as a pipe-delimited string:

```
presetKey|opt1,opt2,capacity:N|free text note
```

Example: `ballroom|schoolroom,capacity:240,aisles|Extra chairs at the back`

The dashboard has a `decodePickerValue()` function that renders this as human-readable text.

---

## Key functions — admin.html

| Function | Purpose |
|---|---|
| `renderSession()` | Renders a full session card (collapsed + expanded) |
| `renderAVReqs()` | Renders the inline AV edit form (speakers, AV groups, session info) — uses string concat, NOT template literals |
| `collectAVReqs()` | Reads all AV + session info fields from the expanded card DOM and writes back to session object |
| `collectSessionFiles()` | Reads file rows from expanded card DOM |
| `collectFormState()` | Calls collectAVReqs + collectSessionFiles for all sessions before save |
| `onDashToggle()` | Toggles `showInDashboard` on a session, updates pill button + card border |
| `bulkDashToggle()` | Turns all visible sessions on/off dashboard in one click |
| `toggleDashFilter()` | Filters card list to dashboard-flagged sessions only |
| `renderSetupPicker()` | Renders the Room/Stage Setup picker UI |
| `showPrintDialog()` | *Not in admin — dashboard only* |

## Key functions — dashboard.html

| Function | Purpose |
|---|---|
| `showPrintDialog()` | Shows By Room / By Day mode picker before printing |
| `printRoomRundown(mode)` | Builds and prints the rundown DOM; uses `pesc()` for all text output |
| `pesc()` | Local helper inside `printRoomRundown` — normalises smart punctuation to ASCII before injecting into print DOM |
| `vendorSessions()` | Returns only sessions with `showInDashboard: true` |
| `migrateSession()` | Migrates legacy root-level fields to `s.av.*` at load time |
| `renderAll()` | Top-level render: summary, days, changelog, needs-attention |
| `decodePickerValue()` | Converts serialised picker string to human-readable text |

---

## Print Rundown — key behaviours

- **Two modes:** By Room (room → day sections) and By Day (day → room sections)
- **`pesc()`** normalises en-dashes, smart quotes to ASCII — required because browser print PDF renderer misreads Unicode in dynamically-injected DOM
- **Color bands:** `.prd-room-hdr` (dark navy, white text) = top-level section; `.prd-day-hdr` (light blue) = sub-section. Requires `print-color-adjust: exact` — set on `*` inside `@media print`
- **Dialog removal:** dialog must be removed from DOM synchronously (`m.style.display='none'; document.body.removeChild(m)`) BEFORE `printRoomRundown()` is called, or it prints on every page
- **Files column logic:** "Not required" shown (grey) when `av.presentationRequired === false` OR source is `Design Fair Station` / `Collaborative` / `Presenter Laptop`. "Awaiting file" shown only when `presentationRequired: true` with an AV Team source and no files added yet

---

## Current state / next work items

- **Accomplished in This Session:**
  - **Print Rundown overhaul:** Title page fix, font sizing, time column `calc()` fix, full AV label text, AV note moved to AV column, color-banded section headers, By Room / By Day mode picker, dialog DOM removal fix, `pesc()` normalization, `print-color-adjust: exact` for color printing
  - **Files column logic:** "Not required" for Design Fair Station, Presenter Laptop, Collaborative, and `presentationRequired: false` sessions
  - **Migration guard:** `migrateSession()` now only copies `s.projection` → `av.presentationSource` for known valid values (not free-text notes)
  - **Encoding cleanup:** Fixed 16 garbled session fields (en-dashes, apostrophes) from triple UTF-8 encoding. Fixed `eventDates` field.
  - **Admin toggle button:** Dashboard checkbox replaced with a pill-style toggle button (grey = off, blue = "On Dashboard")
  - **Admin bulk toggle:** "Dashboard: All" button in topbar turns all visible sessions on/off in one click
  - **Admin Session Info panel:** Title, Start Time, End Time, Room, Session Type now editable inline in expanded card — collected by `collectAVReqs()` on save

- **Known open issue:**
  - The `â` garbled character in session 54 title ("Continuing IBM Z full-stack simplification – from complexity to code") still appears in PDF output when printed via Safari/Chrome print-to-PDF. The data in `av-data.json` and the HTML are clean (U+2013 en-dash). `pesc()` converts it to `-` but the PDF renderer is still seeing the raw Unicode. Root cause not yet identified — possibly a browser-version-specific print encoding bug.

- **Next Work Items:**
  - Resolve session 54 PDF encoding issue
  - Standard session data maintenance as event approaches

---

## Backup tags

- `backup-pre-av-config` — state on GitHub before the AV_CONFIG refactor
