# Stroke Weight Tokenization

**Updated**: 2026-01-18

## Goal
- Tokenize stroke weight using spacing tokens, mirroring the flows we already have for padding and corner radius (scan marks actionable “missing”, per-row apply binds the variable, bulk apply respects the Spacings checkbox).  
- Keep other properties (fill, stroke color, padding, radius) unchanged when applying stroke-weight tokens.

## Current Problem
- Scan shows `Stroke weight matches token spacing/1`, but the “Apply Stroke Weight” button is not shown and the row is not marked missing—even though the stroke weight is not yet tokenized. So the user cannot apply it from the UI, and it never moves to success.
- Other properties in the same node are already bound:  
  - Fill: Using variable `base/chart-2`  
  - Stroke: Using variable `base/muted-foreground`  
  - Corner radius: Using variable `spacing/2`
- Likely cause: scanner is treating “exact match” as informational instead of “missing/actionable,” so the apply button is suppressed and the row stays out of the Missing filter.

## Desired Behavior (align with padding/corner radius patterns)
- Scan: If a stroke weight exactly matches a spacing token and is unbound, mark it missing (actionable). If bound, mark found/applied. If unsupported/no match, mark info without an apply button.
- Apply (per-row and bulk): Bind stroke weight to the matching spacing variable at node level and stroke entry, similar to how padding and corner radius bind their variables, so a rescan shows “using variable” and the row moves out of Missing.

## Padding vs. Stroke Weight (where to compare)
- Token lookup helper: Both use `findSpacingVariable` in `src/spacing.ts` for exact FLOAT matches. If stroke weight fails to resolve, start there.
- Scan logic:
  - Padding: `src/scanner.ts` (padding block) checks per-side boundVariables first; if unbound and all sides match spacing tokens, it sets state to `missing` so the button shows.
  - Stroke weight: `src/scanner.ts` (strokeWeight block) gathers bound ids from multiple shapes (node.boundVariables.strokeWeight, strokes/0/weight, paint alias). If it sees any id, it marks `found`; only an exact match with no binding is `missing`. This is the place to tweak “missing vs found” state for stroke weights.
- Apply logic:
  - Padding: `src/apply.ts::applyPaddingTokenToNode` binds side(s) directly via `setBoundVariable` (paddingTop/Right/Bottom/Left) and returns; scanner then reads those bindings.
  - Stroke weight: `src/apply.ts::applyStrokeWeightTokenToNode` clears stroke style, then tries multiple bindings (`strokeWeight`, `strokes/0/weight`, direct `boundVariables` assignment, and embeds alias on `strokes[0].weight`). If the scanner misses a binding shape, align the scanner candidates with what apply writes.
- UI controls: `src/ui.html` shows “Apply Padding Token” or “Apply Stroke Weight Token” when the scan state is `missing`; if stroke weight ends up `found` instead of `missing`, the button is hidden. Fixing scanner state is what restores the button and removes the row from the Missing filter after apply.
- Message routing: `src/code.ts` wires `apply-token` targets `padding` and `strokeWeight` to their respective helpers; bulk apply (`applyAllMissing` in `src/apply.ts`) also calls both when their state is `missing`.

## Relevant Files to Inspect/Update
- `src/scanner.ts`: stroke-weight scan state, missing/found rules.
- `src/apply.ts`: stroke-weight apply helper and how it writes bindings.
- `src/code.ts`: message routing for `apply-token` targets.
- `src/ui.html`: per-row status line and “Apply Stroke Weight” button visibility.
- `src/types.ts`: shape of `strokeWeight` info in scan results.
- `dist/code.js`: bundled output after changes.

*(Already reviewed this codebase for the issue above; next agent should start with these touchpoints.)*

## Next Steps to Unblock
- Verify where the binding is stored after apply (node.boundVariables vs stroke entry vs strokeWeight property) and ensure the scanner reads the same shape the applier writes.  
- Mirror padding/corner-radius detection logic: prefer boundVariables IDs, fall back to stroke entry alias, and treat exact token + no binding as missing.  
- Add a targeted test node in the sandbox to confirm the state flips to found after apply.
