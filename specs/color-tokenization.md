# Color Tokenization (Fill & Stroke)

**Updated**: 2025-12-11

## Purpose
- Document how the plugin detects and applies color tokens for fills and strokes today, including scan states, apply flows, and the color-variable matching algorithm.
- Covers both per-row apply (“Apply Fill/Stroke Token”) and bulk apply (“Apply Token to All” with Fills/Strokes toggles).

## Scan Behavior (src/scanner.ts)
- Scope: `scanSelection` walks selection + descendants via `gatherNodesWithPaints`; every node with `fills`/`strokes` is evaluated by `evalPaint` twice (once for `fill`, once for `stroke`).
- Supported paints: only the first paint is read; if it is not `SOLID`, the row is marked `error` (“Unsupported … type”). No paints → no fill/stroke entry.
- Binding detection order:
  - Paint-level variable binding (`first.boundVariables.color`), then node-level binding (`node.boundVariables.fills[0].color` or `strokes[0].color`), accepts alias or raw id.
  - If found, resolves the variable name and marks `state: "found"` with “Using variable: <name>”.
  - Else, if `fillStyleId`/`strokeStyleId` is present (and not `figma.mixed`), marks `state: "found"` with style name (or generic “Using color style” on fetch errors).
- Missing state (actionable): Only set when there is an exact color+opacity token match for the solid paint. Uses `findNearestColorVariable` (now exact-only) to resolve the variable; message `Matches variable: <name> @<opacity>%` and `state: "missing"` so the apply button appears.
- No-match state (informational): If no exact token exists, the unbound paint is shown as `state: "info"` with a message `… is not using a variable (no exact token match)`; this stays out of the Missing filter and shows no apply button.
- Node state aggregation: if any property (fill/stroke/typography/spacing/etc.) is `missing`, the node-level state becomes `missing`, which is what drives the “Missing only” filter and the apply buttons in `src/ui.html`.

## Apply Behavior (per-row & bulk)
- Entry points: UI row buttons emit `apply-token` with `target: "fill" | "stroke"`; bulk “Apply Token to All” calls `applyAllMissing`, which invokes `applyNearestTokenToNode` for rows whose fill/stroke is `missing` and the corresponding checkbox is enabled.
- Guards: node must exist and have a solid paint in the requested slot; otherwise sendStatus returns an error/info and exits.
- Token selection: delegates to `findNearestColorVariable` with the paint color + opacity, preferred mode, and selected library scope (local/all/library). **This now requires an exact match on color + opacity (within tiny float epsilon); nearest/fuzzy matches are rejected.** If none found, aborts with “No exact color token match found (requires matching color and opacity).”
- No-op protection: if the paint is already bound to the chosen variable (checked via `first.boundVariables.color` id), it bails with “This color is already bound to that token.”
- Applying:
  - Resolves the variable color for the preferred mode via `resolveColorForMode` (resolves aliases recursively, picks a mode matching the user’s Light/Dark choice or the collection default).
  - If the token has alpha, uses that as the new paint opacity; otherwise preserves the existing paint opacity. RGB channels are replaced with the resolved token color.
  - Writes the updated paint with `boundVariables.color` alias set; clears conflicting style ids (`setFillStyleIdAsync`/`setStrokeStyleIdAsync`) and reassigns the fills/strokes array to `[updatedPaint]`.
  - Also attempts an explicit `setBoundVariable("fills/0/color", …)` or `("strokes/0/color", …)` so node-level bindings reflect immediately.
- After apply: posts `Token applied` status, then rescans to refresh the UI row to “Using variable.”

## Color Variable Matching (src/variables.ts, src/colors.ts)
- Variable pool: `getVariablesForScope("COLOR", scope)` returns local variables plus imported library variables based on the current library selection; results are cached per scope/type.
- Mode resolution: `resolveColorForMode` picks a mode by case-insensitive name match to the preferred mode, else the collection default, else the first mode. Follows alias chains recursively and returns `{r,g,b,a}` (alpha defaults to 1).
- Exact-only matching:
  - Uses `colorsEqual` which compares effective channels (color * opacity) with tiny epsilons (1e-4 for RGB, 1e-3 for alpha) and enforces an opacity delta cap (`alphaEps` ≈ 0.02) against the paint opacity.
  - No fuzzy/nearest fallback: if no variable exactly matches the paint color + opacity, apply returns `null` and reports an error.
- Apply uses the resolved variable alpha to decide whether to override paint opacity; scan reporting uses raw paint color (not multiplied by opacity) so low-opacity paints still show the intended hue in the message.

## UI / States (src/ui.html, src/types.ts)
- Fill/Stroke status lines show red text when `state === "missing"`; “Apply Fill/Stroke Token” buttons render only in that state.
- Overall node row includes highlight control; bulk apply respects the Fills/Strokes checkboxes.
- `StatusState` values: `"missing"` → actionable, `"found"`/`"applied"` → green, `"error"` → unsupported, `"info"` → non-actionable informational.

## Notable Limitations
- Only the first paint is considered; multiple fills/strokes or gradients/patterns are unsupported and surface as errors.
- Scanner does not verify that a matching token exists before marking `missing`; any unbound solid paint is actionable, even if no exact color/opacity token exists—apply will now fail in that case.
- “Already applied” check only inspects the paint-level bound variable; if a binding exists solely on the node-level binding path, apply may still run.
