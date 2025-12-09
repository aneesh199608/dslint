<!--
Sync Impact Report
- Version change: 1.0.0 → 1.0.1
- Modified principles: clarified names/intent, no additions or removals
- Added sections: none
- Removed sections: none
- Templates requiring updates: plan-template.md ✅ (Constitution Check gates aligned); spec-template.md ⚠ (leave placeholders until feature specs are authored); tasks-template.md ⚠ (keep sample tasks placeholder-only)
- Follow-up TODOs: none
-->

# DSLint Constitution

## Core Principles

### I. Token-First Read, Opt-In Apply
Scans default to non-destructive inspection; mutations happen only from explicit user actions (row apply or bulk apply). Prefer binding to variables/styles over rewriting raw values and skip applies when a node is already bound.

### II. Mode Fidelity
Resolve variables using the user-selected mode (Light/Dark) with safe fallbacks; if a mode cannot be resolved, surface a warning instead of applying. Preserve alpha semantics and avoid applying clearly wrong tokens when opacity deltas are too large.

### III. Selection Safety & Context Preservation
Capture and restore the user’s selection when highlighting; never leave the canvas in a different selection state unintentionally. When walking frames, include relevant descendants for reporting but only mutate nodes when a user explicitly triggers an apply.

### IV. Offline, Deterministic Execution
Operate without network access and rely solely on local variables/styles and document state. Handle missing collections, aliases, and unsupported node types gracefully with actionable status messages instead of crashes.

### V. Lean UX & Performance
Keep the UI responsive with light DOM work; filter/paginate instead of heavy re-renders on large selections. Status messaging should clearly report scan counts (found/missing/unsupported) and next actions.

## Delivery Constraints
Target runtime is Figma (desktop or browser) without experimental APIs. Color support is solid fills/strokes only until expanded; multi-fill/stroke handling and typography apply are follow-ups. Spacing apply is limited to auto layout padding/gaps and should not bind zero values. No persistent storage—state lives in-memory; never emit variable IDs outside plugin messaging.

## Development Workflow & Quality Gates
Toolchain: TypeScript with esbuild bundling to `dist/`; keep `src/ui.html` messaging in sync with `code.ts` statuses. Commands: `npm run build` for release bundles, `npm run watch` during development; ensure `manifest.json` points at built assets. Manual QA in Figma must cover scan of single/multi-node selections, apply tokens (fill/stroke/spacing), highlight/restore selection, and UI resize. Wrap Figma API calls to avoid uncaught errors; log to console for diagnosis. Update `README.md` when feature scope changes (strokes, spacing, typography apply) and record limitations here.

## Governance
This constitution guides DSLint behavior and developer decisions ahead of ad-hoc practices. Amendments require documenting rationale, updating version metadata, and noting migration or UX impacts. Reviews must check new features against the Core Principles and Delivery Constraints before merge.

**Version**: 1.0.1 | **Ratified**: 2025-12-09 | **Last Amended**: 2025-12-09
