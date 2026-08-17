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
└── docs/                       ← Reference guides (admin, AV team, project spec)
```

---

## How It Works

### Data Flow

```
ZDC_Agenda_Master_2026_Fall.xlsx
        ↓ (import-agenda.js or extract-all-sessions.mjs)
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
- **Session row** shows: Time · Title/Speaker · Room · Session Type · Projection · Dashboard checkbox · AV DETAILS button
- **Dashboard checkbox** — tick to include a session in the vendor dashboard; untick to hide it
- **AV DETAILS panel** (expandable) — all AV fields are editable inline:
  - Room, Projection (dropdown), Microphones, Podium (checkbox), Timer, Monitor, Track, Special Requirements, Room Setup
  - Changes write back to `DATA` in memory; saved on "Save to GitHub"
- **File tracking per session** — add multiple files, each with:
  - File type (Presentation / Video / Backup / Run-of-Show)
  - File name
  - IBM Box file ID (paste the full Box URL or bare ID — auto-stripped on paste)
  - Status: Pending / Approved / Updated / On Hold / **Distributed** / No File Needed
- **AV Note** — visible to the vendor team on the dashboard
- **Operator Note** — internal only, never shown on dashboard
- **Stats bar** — live counts: Sessions · Files tracked · Approved · Updated · On Hold · Distributed · Missing Files
- **Sidebar day nav** — shows approved+distributed / total file counts per day; click to scroll

### Saving

| Button | Requires | Effect |
|--------|----------|--------|
| **Save to GitHub** | GitHub token (repo scope) | PUTs `av-data.json` directly to GitHub via Contents API; dashboard updates within 60 s |
| **↓ Download JSON** | Nothing | Downloads `av-data.json` to your local machine for testing without a token |

**Token:** Entered via the **Token** button (top bar) → stored in `sessionStorage` for the browser session only. Get one at github.com/settings/tokens with `repo` scope.

### File Status Values

| Status | Meaning |
|--------|---------|
| `pending` | File expected but not yet received |
| `approved` | File received and approved for use |
| `updated` | File has been replaced with a newer version |
| `onhold` | File is on hold — awaiting action |
| `distributed` | AV lead confirmed the file has been sent to the vendor team (**shared global state**) |
| `nofile` | No file needed for this session |

---

## Vendor Dashboard (`app/dashboard.html`)

### Features

- **Shows only sessions flagged with Dashboard ✓ in admin** — currently 26 sessions
- **Auto-refreshes every 60 seconds** from GitHub raw URL with `cache: "no-store"`
- **Room filter bar** — filter all sessions by room with one click; persists across auto-refreshes
- **Day tabs** — Sunday through Thursday; filter + day tabs work independently

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
| `⏸` amber | On Hold | None — await AV lead |
| `—` grey | No file attached | Contact AV lead |

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

## Changelog (this session)

| Commit | Change |
|--------|--------|
| Editable AV fields | AV DETAILS panel replaced read-only cards with editable inputs for all 9 AV fields; writes back to JSON on save |
| Dashboard status fix | Fixed status case mismatch (admin wrote lowercase, dashboard expected Title Case) |
| Dashboard session filter | Dashboard now shows only sessions with `showInDashboard: true` (set by AV lead checkbox) |
| Dashboard checkbox | Per-session Dashboard checkbox on admin row; sets `showInDashboard` field; blue left border on checked cards |
| Download JSON button | Admin: ↓ Download JSON button for local testing without GitHub token |
| Smart download button | Dashboard: download button shows ⬇ New / ✓ Downloaded / ↻ Update Available based on localStorage vs `updatedAt` |
| Distributed status | New `distributed` file status — set by AV lead, globally visible to all dashboard viewers |
| Dashboard row redesign | Session row now has fixed columns: Time · Title · Room · AV Details button · Download Status button |
| AV chips moved to panel | AV details (Room/Proj/Mics/etc.) moved from always-visible row into expandable AV Details sub-panel |
| Download Status column | Renamed from "Files"; shows icon-only pills (↻⬇✓⏸—) per file; hover shows file name; legend bar added |
| Room filter | Filter bar above sessions; click any room to show only that room's sessions across all day tabs |
| Box URL auto-strip | Admin Box ID field now accepts full Box URLs and strips to bare ID automatically |
| cache: no-store | Dashboard fetch uses `cache: "no-store"` to defeat GitHub CDN caching |
| patch-admin.js rewrite | Handles both HTML files; graceful no-op when content already matches; fails fast on missing constant |
| Room filter bug fix | Fixed onclick quoting bug (JSON.stringify double-quotes broke HTML attribute); switched to DOM addEventListener |

---

*Built with IBM Bob · Zero servers · Static site · GitHub Pages · IBM Box file storage*
