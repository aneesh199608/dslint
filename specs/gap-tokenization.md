# Gap Tokenization

**Updated**: 2026-01-18

## Purpose
- Describe how gap (auto layout item spacing) tokenization currently works in the DSLint Figma plugin so we can align UX, scanning, and apply flows with other spacing properties.
- Capture the user journeys already supported in code and the guardrails/limitations observed in the current implementation.

## User Journeys (as built)
- Scan selection: user clicks “Scan Again,” plugin walks selection + descendants (`gatherNodesWithPaints`). For any node with `itemSpacing` and `layoutMode`, if gap ≠ 0 it surfaces a Gap status row in the results list (`src/scanner.ts`). Missing filter shows nodes whose overall state is `missing`, so gap contributes when marked missing.
- Per-row apply: when scan marks gap `missing` (exact token match but unbound), the UI renders “Apply Gap Token.” Clicking it sends `apply-token` with target `gap`; `applyGapTokenToNode` binds the matching spacing variable via `setBoundVariable("itemSpacing", …)` and rescans.
- Bulk apply: “Apply Token to All” with the Spacings checkbox on sets `spacing: true` for `applyAllMissing`; rows whose `gap.state === "missing"` are fed to `applyGapTokenToNode`. Other properties (fill, stroke, padding, radius, stroke weight) follow their own flags.
- Informational states: if auto layout is off but item spacing exists, the row shows “Gap present (auto layout off)” (state `info`) with no button; if gap is 0 or undefined, gap is suppressed entirely for that node (no row, no apply).

## Current Functionality (code read-through)
- Detection (`src/scanner.ts`):
  - Considers nodes with `itemSpacing` and `layoutMode`. Requires `itemSpacing` non-zero to show anything.
  - If layout mode is not `HORIZONTAL` or `VERTICAL`, sets `gap` to `info` with message “Gap present (auto layout off).”
  - If auto layout and `boundVariables.itemSpacing.id` exists, sets state `found` and displays the variable name.
  - If the gap uses Auto/space-between (either `itemSpacing === "AUTO"/"Auto"` or `primaryAxisAlignItems === "SPACE_BETWEEN"`), marks info and does not offer apply.
  - Else resolves an exact spacing token via `findSpacingVariable(spacing)`; if found, sets state `missing` with “Gap matches token X”; if not found, sets state `info` (“Gap has no matching token”).
- Apply (`src/apply.ts::applyGapTokenToNode`):
  - Guards: node must expose `itemSpacing` + `layoutMode`; layout mode must be auto layout. If gap is Auto/space-between, aborts with “Gap uses Auto spacing; leaving unchanged.” If gap ≤ 0, aborts with “Gap is 0; nothing to tokenize.”
  - Uses exact match only (`findSpacingVariable`) to locate a spacing FLOAT variable; if missing, shows “No gap token found.”
  - On match, binds alias to `itemSpacing` and reports “Gap token applied: <name>”; does not alter other props.
- Bulk routing (`src/apply.ts::applyAllMissing`): when `spacing` flag is true, calls `applyGapTokenToNode` for rows whose `gap.state` is `missing`, then rescans.
- UI hooks (`src/ui.html`):
  - Gap status line uses red text when state is `missing`; otherwise muted.
  - “Apply Gap Token” button renders only when `item.gap.state === "missing"`.
  - Spacings checkbox controls whether gap participates in bulk apply; missing filter depends on the aggregate node state computed in `scanSelection`.
- Token lookup (`src/spacing.ts`): `findSpacingVariable` resolves default-mode FLOAT variables and matches by exact value (epsilon 1e-5); no tolerance/nearest behavior for gaps.

## Observations / Limitations
- Only exact matches get marked `missing` and are eligible for apply; near misses never surface an action.
- Gap value `"AUTO"` should remain untouched; scanner marks it informational and applier bails to avoid binding a numeric token to auto spacing.
- Gap rows do not appear when spacing is zero, so designers cannot bind a zero gap intentionally (no-op).
- Bound detection only checks `boundVariables.itemSpacing`; if a binding were stored elsewhere (not currently), the scanner would miss it.
- Auto layout is required for apply; nodes with legacy/non-auto-layout spacing values stay informational with no remediation path.
