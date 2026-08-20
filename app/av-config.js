// ── AV_CONFIG — single source of truth for all AV requirement fields ──────────
//
// Each entry drives:
//   • The "Add Session" modal form (admin.html)
//   • The per-session AV detail panel (admin.html)
//   • The dashboard AV display (dashboard.html)
//
// To add a new field:  append one object here — no other file needs changing.
// To rename a label:   change `label` here only.
// To reorder fields:   reorder within a group here.
//
// Field schema:
//   group   — display group name (must match a GROUPS entry below)
//   label   — human-readable label shown in UI
//   id      — data key stored in s.av (and used as element id suffix)
//   modalId — id used in the "Add Session" modal input (may differ from id)
//   type    — "bool" | "num" | "text" | "select"
//   options — array of {value, label} for type:"select"
//   full    — if true, field spans full width (text areas)
//   rows    — textarea row count (type:"text" only, default 2)
//   placeholder — optional placeholder string
//
// Special fields handled separately (not in AV_CONFIG):
//   • Speakers   — dynamic list with add/remove buttons
//   • specialRequirements — stored as array; has its own save logic

const AV_GROUPS = [
  { key: "presentation", icon: "🎞",  label: "Presentation" },
  { key: "audio",        icon: "🎙",  label: "Audio"        },
  { key: "video",        icon: "📽",  label: "Video"        },
  { key: "staging",      icon: "🎭",  label: "Staging"      },
  { key: "room",         icon: "🏛",  label: "Room"         },
];

const AV_CONFIG = [
  // ── Presentation ───────────────────────────────────────────────────────────
  {
    group: "presentation", label: "Presentation Required",
    id: "presentationRequired", modalId: "ns-presRequired",
    type: "bool"
  },
  {
    group: "presentation", label: "Source",
    id: "presentationSource", modalId: "ns-presentationSource",
    type: "select",
    options: [
      { value: "",                    label: "— none —"           },
      { value: "AV Team",             label: "AV Team"            },
      { value: "AV team - LED",       label: "AV Team – LED"      },
      { value: "Presenter Laptop",    label: "Presenter Laptop"   },
      { value: "LED Wall",            label: "LED Wall"           },
      { value: "Design Fair Station", label: "Design Fair Station"},
    ]
  },
  {
    group: "presentation", label: "Clicker",
    id: "clicker", modalId: "ns-clicker",
    type: "bool"
  },
  {
    group: "presentation", label: "Confidence Monitors",
    id: "confidenceMonitors", modalId: "ns-confidenceMonitors",
    type: "num"
  },
  {
    group: "presentation", label: "Timer (min)",
    id: "timerMins", modalId: "ns-timerMins",
    type: "num"
  },

  // ── Audio ──────────────────────────────────────────────────────────────────
  {
    group: "audio", label: "Handheld Mics",
    id: "wirelessHandheldMics", modalId: "ns-wirelessHandheld",
    type: "num"
  },
  {
    group: "audio", label: "Lavalier / Headset",
    id: "lavalierHeadsetMics", modalId: "ns-lavalierHeadset",
    type: "num"
  },
  {
    group: "audio", label: "Catchbox",
    id: "catchBoxMics", modalId: "ns-catchBoxMics",
    type: "num"
  },
  {
    group: "audio", label: "Audio Playback",
    id: "audioPlayback", modalId: "ns-audioPlayback",
    type: "bool"
  },
  {
    group: "audio", label: "XLR Audio Feed",
    id: "xlrAudioFeed", modalId: "ns-xlrAudioFeed",
    type: "bool"
  },

  // ── Video ──────────────────────────────────────────────────────────────────
  {
    group: "video", label: "Projector",
    id: "projector", modalId: "ns-projector",
    type: "bool"
  },
  {
    group: "video", label: "Video Playback",
    id: "videoPlayback", modalId: "ns-videoPlayback",
    type: "bool"
  },

  // ── Staging ────────────────────────────────────────────────────────────────
  {
    group: "staging", label: "Podium",
    id: "podium", modalId: "ns-podium",
    type: "bool"
  },
  {
    group: "staging", label: "Panel Chairs",
    id: "panelChairs", modalId: "ns-panelChairs",
    type: "num"
  },
  {
    group: "staging", label: "Side Tables",
    id: "sideTables", modalId: "ns-sideTables",
    type: "num"
  },
  {
    group: "staging", label: "High-top Tables",
    id: "highTopTables", modalId: "ns-highTopTables",
    type: "num"
  },
  {
    group: "staging", label: "Easel",
    id: "easel", modalId: "ns-easel",
    type: "bool"
  },
  {
    group: "staging", label: "Flip Chart",
    id: "flipChart", modalId: "ns-flipChart",
    type: "bool"
  },

  // ── Room ───────────────────────────────────────────────────────────────────
  {
    group: "room", label: "Room Setup",
    id: "roomSetup", modalId: "ns-roomsetup",
    type: "text", full: true, rows: 2,
    placeholder: "Stage with podium, schoolroom 240…"
  },
  {
    group: "room", label: "Stage Setup",
    id: "stageSetup", modalId: "ns-stagesetup",
    type: "text", full: true, rows: 2,
    placeholder: "Stage setup details…"
  },
];
