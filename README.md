# ZDC 2026 Fall — AV Management System

**Event:** ZDC 2026 Fall · Antwerp, Belgium · Oct 18–22, 2026  
**Live site:** https://ibmzdc.github.io/av-management/  
**Admin:** https://ibmzdc.github.io/av-management/app/admin.html  
**Vendor Dashboard:** https://ibmzdc.github.io/av-management/app/dashboard.html

---

## Overview

A zero-server, static-site AV file-tracking system built on GitHub Pages.  
Session data originates from `Data/ZDC_Agenda_Master_2026_Fall.xlsx` and is stored as a single JSON file (`data/av-data.json`) that acts as the single source of truth.

- **AV Lead** uses `admin.html` to manage sessions, track files, and push changes to GitHub.  
- **Vendor AV team** uses `dashboard.html` — a live, read-only view that auto-refreshes every 60 seconds.  
- No backend, no database, no framework. All data lives in `av-data.json` on GitHub.

---

## Repository Structure

```
av-management/
├── index.html                  ← Landing hub (links to admin + dashboard)
├── app/
│   ├── admin.html              ← AV lead interface (85 sessions, inline embedded data)
│   └── dashboard.html          ← Vendor read-only dashboard (flagged sessions only)
├── data/
│   ├── av-data.json            ← Single source of truth (85 sessions)
│   ├── import-agenda.js        ← Re-seed script (requires xlsx npm pkg)
│   └── patch-admin.js          ← Re-embeds av-data.json into both HTML files
```

---

## How It Works

### Data Flow

```
ZDC_Agenda_Master_2026_Fall.xlsx
        ↓ (import-agenda.js)
data/av-data.json   ←──── AV Lead edits via admin.html ────→ GitHub (via Contents API)
        ↓ (patch-admin.js)                                         ↓
admin.html (embedded fallback)                        dashboard.html auto-refreshes
dashboard.html (embedded fallback)
```

### Three-Tier Data Loading

Both `admin.html` and `dashboard.html` load data in this priority order:

1. **GitHub Contents API / raw URL** — freshest data, requires network
2. **Relative fetch** of `../data/av-data.json` — works via local HTTP server or GitHub Pages
3. **Inline embedded fallback** — baked into the HTML by `patch-admin.js`, works from `file://`

---

## Admin (`app/admin.html`)

### Features

- **85 sessions** across 5 event days (Sunday–Thursday), all sourced from the XLSX agenda
- **Session cards** show at a glance: Time · Title/Speakers · Room · Session Type · overall Status pill · Dashboard toggle
- **Status-colored left border** on each card indicates the dominant file state at a glance
- **⭐ Dashboard filter** (topbar) — click to show only sessions flagged for the vendor dashboard
- **Search bar** (topbar) — free-text filter across all session cards; works alongside the dashboard filter
- **Dashboard toggle** — checkbox on each card; tick to include a session in the vendor dashboard
- **Bulk actions** — hover cards to reveal checkboxes; select multiple sessions to **Approve All Files**, **Mark Distributed**, or **Mark On Hold** in one click; a sticky bar shows count and actions
- **AV Details panel** (expandable per card) — split into two side-by-side sections:
  - **Session Information** (read-only): Speakers · Session Type · Track
  - **AV Requirements** (editable): Room · Projection · Microphones · Podium · Timer · Monitor · Special Requirements · Room Setup
- **File tracking per session** — add multiple files, each with:
  - File type (Presentation / Video / Backup / Run-of-Show)
  - File name
  - IBM Box file ID (paste the full Box URL or bare ID — auto-stripped on paste)
  - Status: Awaiting File / Approved / Updated / On Hold / Distributed / No File Needed
- **AV Note** — visible to the vendor team on the dashboard
- **Operator Note** — internal only, never shown on dashboard
- **Stats bar** — live counts: Sessions · Files Tracked · Approved · Updated · On Hold · Distributed · No Files
- **Sidebar day nav** — shows approved+distributed / total file counts per day with a progress bar; click to scroll
- **Toast notifications** — status change confirmation appears bottom-right with a single-step **Undo** option
- **Leave-page protection** — browser warns before closing or refreshing when there are unsaved changes
- **Responsive layout** — sidebar collapses to a slide-in drawer (☰ button) below 1024px; card columns reflow at 900px

### Saving

| Button | Requires | Effect |
|--------|----------|--------|
| **Save to GitHub** | GitHub token (repo scope) | PUTs `av-data.json` directly to GitHub via Contents API; dashboard updates within 60 s |
| **↓ Download JSON** | Nothing | Downloads `av-data.json` to your local machine for testing without a token |

**Token:** Entered via the **Token** button (top bar) → stored in `sessionStorage` for the browser session only. Get one at github.com/settings/tokens with `repo` scope.

### File Status Values

| Status (data value) | Display label | Meaning |
|---------------------|--------------|---------|
| `pending` | ⚠ Awaiting File | File expected but not yet received |
| `approved` | ✓ Approved | File received and approved for use |
| `updated` | ↑ Updated | File has been replaced with a newer version — re-download required |
| `onhold` | ⏸ On Hold | File is on hold — awaiting action |
| `distributed` | ⬆ Distributed | AV lead confirmed the file has been sent to the vendor team (**global shared state**) |
| `nofile` | — No File Needed | No file required for this session |

### Session Status Pill (collapsed card)

The single pill on each collapsed card summarises all file statuses for that session:

| Pill | Condition |
|------|-----------|
| ✓ Ready | All files approved, distributed, or no-file |
| ⬆ Distributed | All files distributed |
| ↑ Review Required | Any file is `updated` |
| ⏸ On Hold | Any file is `onhold` |
| — No Files Needed | All files are `nofile` |
| ⚠ No Files | Session has no files, or any file is `pending` |

---

## Vendor Dashboard (`app/dashboard.html`)

### Features

- **Shows only sessions flagged with Dashboard ✓ in admin**
- **Auto-refreshes every 60 seconds** from GitHub raw URL with `cache: "no-store"`
- **↺ Refresh Now** button for immediate manual refresh
- **Left nav sidebar** — day links and room filter; click a day or room to filter the main panel
- **Stats bar** — Sessions · Files Tracked · Approved · Updated · On Hold · Distributed · Awaiting File
- **Needs-Attention banner** — highlights sessions with `updated` files requiring re-download
- **🖨 Print Rundown** — prints a clean room-by-room rundown (hides nav and interactive elements)

### Session Row Layout

Each row shows five columns:

| Column | Content |
|--------|---------|
| **Time** | Start–End (24-hour) |
| **Title / Speakers** | Session name + speaker names |
| **Room** | Room name |
| **AV Details** | Button — click to expand AV requirements table (Room, Projection, Mics, Podium, Timer, Monitor, Room Setup, Special Reqs, AV Note) |
| **Download Status** | Button — shows per-file icon pills; click to expand full download table |

### Download Status Pills

Each file attached to a session appears as a small icon pill — hover to see the file name:

| Pill | State | Action needed |
|------|-------|---------------|
| `↻` amber pulsing | Update available — file changed since last download | Re-download |
| `⬇` blue | Not yet downloaded | Download |
| `✓` green | Downloaded or Distributed | None |
| `⏸` amber | On Hold — awaiting upload | None — await AV lead |
| `—` grey | Awaiting File | Contact AV lead |

**State logic:**
- `distributed` status (set by AV lead) → always shows `✓` for all viewers — **global shared state**
- `updated` status + file downloaded before `updatedAt` → shows `↻` (per-browser, via `localStorage`)
- All other download tracking is **per-browser** via `localStorage`

### Download Status — Global vs Local

| State | Who sets it | Visible to |
|-------|-------------|------------|
| `✓ Distributed` | AV Lead in admin | Everyone |
| `✓ Downloaded` | Individual browser (localStorage) | That browser only |
| `↻ Update Available` | Automatic (updatedAt vs last download) | That browser only |

---

## Local Development & Testing Workflow

### Option A — Test locally, push when ready

```bash
# 1. Make changes in admin.html (open from file://)
# 2. Click ↓ Download JSON → saves av-data.json to Downloads
# 3. Copy it over the data file
cp ~/Downloads/av-data.json av-management/data/av-data.json

# 4. Re-embed into both HTML files
node av-management/data/patch-admin.js

# 5. Commit everything and push
cd av-management
git add data/av-data.json app/admin.html app/dashboard.html
git commit -m "Update session data"
git push
```

### Option B — Edit directly on GitHub Pages (recommended)

1. Open `admin.html` on GitHub Pages
2. Enter GitHub token → make changes → **Save to GitHub**
3. Dashboard auto-refreshes within 60 seconds — done

> ⚠️ If you use Option A, **always commit `data/av-data.json`** along with the HTML files. The dashboard reads from the GitHub raw URL — if only the HTML is pushed, the JSON on GitHub stays stale.

---

## `import-agenda.js`

Seeds `av-data.json` from the XLSX agenda spreadsheet. Run once at the start of each event cycle.

```bash
# Run from the workspace root (one level above av-management/)
node av-management/data/import-agenda.js
```

**Requirements:** `npm install xlsx` (SheetJS community edition)

**What it does:**
- Reads `Data/ZDC_Agenda_Master_2026_Fall.xlsx`, sheet `ZDC Agenda Master`
- Filters to sessions with an AV projection need (`AV team` or `Presenter`) and excludes Meals, Breaks, Networking, etc.
- Generates a stable slug `id` for each session (day + start time + room + title)
- **Merge-safe:** re-running preserves all admin-edited fields (`files`, `avNote`, `operatorNote`, `showInDashboard`, and all AV requirement overrides) for any session whose `id` is unchanged
- New sessions added to the spreadsheet are picked up automatically; removed sessions are dropped

---

## `patch-admin.js`

Inlines the current `av-data.json` into both `admin.html` and `dashboard.html` as an offline fallback.

```bash
# Run from the av-management directory
node data/patch-admin.js
```

- Replaces `const EMBEDDED_DATA = {...};` in both files
- If content is already up to date, prints `(no change)` and skips the write
- Fails fast with an error if the `EMBEDDED_DATA` constant is not found

---

## IBM Box File IDs

Files are stored in IBM Box. The **Box file ID** is the token after `/s/` in a share link:

```
https://ibm.box.com/s/xk9abc123def456
                      ^^^^^^^^^^^^^^^^ ← this is the Box file ID
```

Paste either the full URL or the bare ID into the Box ID field in admin — it auto-strips to the bare ID.

---

## Session JSON Schema

```jsonc
{
  "id": "monday-09-00-belle-epoque-ballr-session-title",
  "day": "Monday",
  "date": "2026-10-19",
  "startTime": "09:00",
  "endTime": "09:30",
  "sessionType": "General Session",
  "track": null,
  "title": "Session Title",
  "speakers": "First Last, First Last",
  "room": "Belle Epoque Ballroom",
  "roomSetup": "Stage with podium, schoolroom 240",
  "projection": "AV team - LED",   // "AV team" | "AV team - LED" | "Presenter" | "not required" | "Design Fair Station" | null
  "microphones": "5 wireless mics plus 3 catchboxes",
  "podium": true,
  "timer": "30",                   // minutes, stored as string
  "monitor": "2 monitors for speaker",
  "specialReqs": null,
  "showInDashboard": true,         // AV lead controls this via checkbox in admin
  "files": [
    {
      "fileType": "presentation",  // presentation | video | backup | run-of-show
      "fileName": "My Deck",
      "boxFileId": "xk9abc123def456",
      "status": "approved",        // pending | approved | updated | onhold | distributed | nofile
      "updatedAt": "2026-08-17T19:03:53.667Z"
    }
  ],
  "avNote": "Visible to vendor team on dashboard",
  "operatorNote": "Internal only — not shown on dashboard"
}
```

---

*Built with IBM Bob · Zero servers · Static site · GitHub Pages · IBM Box file storage*
