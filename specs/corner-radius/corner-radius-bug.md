# Corner Radius Token Apply Bug

## What the user sees
- When clicking either “Apply Corner Radius Token” on a row or running “Apply Token to All” with Spacings checked, the corner radius does not appear to resolve; the row stays visible under the “Missing only” filter.

## How corner radius is currently wired
- **Scan & state**: `src/scanner.ts` gathers corner radius info. If a radius value exactly matches a spacing variable (via `findSpacingVariable`), it sets `cornerRadius.state = "missing"` with a “matches token …” message; if bound, `cornerRadius.state = "found"`.
- **Apply (per-row & bulk)**: `src/apply.ts` `applyCornerRadiusTokenToNode` looks up an exact spacing variable match and binds it via `setBoundVariable` to `cornerRadius` and all corner props. `applyAllMissing` also calls this when Spacings is enabled and `item.cornerRadius.state === "missing"`.
- **UI bridge**: `src/ui.html` posts `apply-token` with `target="cornerRadius"`; `src/code.ts` routes that to `applyCornerRadiusTokenToNode` and then triggers a rescan.
- **Token lookup**: `src/spacing.ts` `findSpacingVariable` only matches when `abs(variableValue - radius) < 1e-5` (no tolerance).

## Likely causes of “still missing”
- **Binding failures are silent**: `applyCornerRadiusTokenToNode` swallows `setBoundVariable` errors and still reports success. If Figma rejects the bind (e.g., component restrictions, property path mismatch), the rescan will still see the radius as unbound and keep it in `missing`.
- **Exact-match requirement**: Both scan and apply require an exact numeric match to a spacing variable. Any radius slightly off (e.g., 7.99 vs 8) will never bind; the row stays “missing”.
- **Row still “missing” for other reasons**: The “Missing only” filter is driven by the overall `item.state`. If fill/stroke/typography are also missing, the row remains even if corner radius bound successfully. Check the per-property messages in the row to confirm whether corner radius switched to “using variable”.
- **No fallback when binding doesn’t reflect in scan**: Unlike stroke weight (which also writes `boundVariables` directly), corner radius relies solely on `setBoundVariable`. If that API does not populate `boundVariables`, the scan will never detect the binding.

## What to do next
- **Add visibility**: Temporarily log inside `applyCornerRadiusTokenToNode` when `setBoundVariable` throws and log `node.boundVariables` after binding to verify the API actually writes the alias.
- **Strengthen binding**: Mirror the stroke-weight strategy—after `setBoundVariable`, explicitly write `node.boundVariables` entries for `cornerRadius` and per-corner props so the scan can see the alias even if the API is flaky.
- **Handle near-matches**: Consider using `findNearestSpacingVariable` with `DEFAULT_SPACING_TOLERANCE` for corner radius (or add tolerance to `findSpacingVariable`) so 7.99→8px radii bind instead of failing silently.
- **Confirm row reason**: When reproducing, check the row messages post-apply to see whether corner radius switched to “using variable”; if the row remains because fill/stroke are missing, that’s UX noise rather than radius not applying.
- **Reproduce flow**: Pick a node with a radius that exactly matches a spacing variable; run “Apply Corner Radius Token”; verify whether `cornerRadius` message changes to “using variable”. If not, capture the console output from the added logs to pinpoint whether `setBoundVariable` is being rejected.

## Fix in code (added)
- Added logging and fallback binding in `src/apply.ts` `applyCornerRadiusTokenToNode`: on any `setBoundVariable` failure, we now log the failure and write `boundVariables` aliases directly for `cornerRadius` and per-corner props. Also log applied state with the variable id/name and current `boundVariables` snapshot to aid debugging.

## New observation from console
- Errors show both `setBoundVariable` and fallback writes failing with `TypeError` on props like `topLeftRadius`, and a final “applied” log still appears. The UI still says “Corner radius matches token spacing/2” (state = missing).
- Likely: the node type or component override does not permit binding corner radii, and `boundVariables` is read-only there. Our updated code now stops reporting success when no bindings stick and will surface an error status instead.

## Additional finding (Rectangle case)
- Repro on a `RECTANGLE` node shows every `setBoundVariable` call failing (all corners and the main `cornerRadius`), and the fallback `boundVariables` assignment also throws. `attemptedProps` is empty, meaning no bindings stuck at all.
- This points to Figma not allowing variable bindings for corner radius on Rectangle nodes (or on this file/override). We should treat these as unsupported for token binding and avoid showing an “Apply Corner Radius Token” action there.

## Next corrective steps
- Detect unsupported nodes/overrides: in `applyCornerRadiusTokenToNode`, when both `setBoundVariable` and fallback fail for all props, surface a specific error like “Corner radius variables aren’t supported on this node type/override (RECTANGLE)”. **Done** earlier, but we removed over-restrictive gating to allow rectangles once API calls are fixed.
- UI guard: hide/disable the corner-radius apply button for node types known to reject radius bindings (e.g., basic Rectangle) to avoid false expectations. **Relaxed**: now we let any node with `setBoundVariable` try binding; still show error if binding fails.
- If binding is supported on certain types (frames/instances with adjustable radii), limit to those by checking node capabilities before showing the button and before attempting to bind. **Relaxed**: capability check is now “has cornerRadius and setBoundVariable”.

## Root cause update
- `setBoundVariable` was being called with `variable.id` (string). Switching to passing the `Variable` object (matching Figma API usage) should allow binding on nodes that support radius binding (including Frames).
