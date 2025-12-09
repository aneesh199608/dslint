# Implementation Plan: Corner Radius Tokenization

**Date**: 2025-12-09 | **Spec**: specs/corner-radius/corner-radius-tokenization.md  
**Input**: Feature specification from `specs/corner-radius/corner-radius-tokenization.md`

## Summary

Add corner-radius tokenization to the existing Spacings flow and UI: reuse the spacing variable resolver (as used for padding in `src/spacing.ts` and `applyPaddingTokenToNode` in `src/apply.ts`), surface an in-row action button (“Apply Corner Radius Token”) similar to padding, and include corner radii in the bulk “Apply Token to All” path with mismatch reporting/tolerance handling aligned to padding.

## Technical Context

**Language/Version**: TypeScript targeting Figma plugin runtime  
**Primary Dependencies**: Figma plugin APIs; local spacing variable resolver in `src/spacing.ts`; UI in `src/ui.html`/`code.ts` message bridge  
**Storage**: N/A (Figma document variables only)  
**Testing**: Manual plugin run; no automated tests present (NEEDS CLARIFICATION if adding)  
**Target Platform**: Figma desktop/web plugin runtime  
**Project Type**: Single plugin project  
**Performance Goals**: Keep bulk apply performant on ~200 selected nodes; status updates should stay responsive  
**Constraints**: Offline/deterministic (no network); avoid altering non-radius properties when Spacings checkbox is used solely for radius  
**Scale/Scope**: Operates on selection/page-level scopes; reuse existing spacing tokens only

## Constitution Check

- Non-destructive first: Plan reads selection and tokens before mutating; per-node apply button scoped to that node.  
- Mode fidelity: Use existing spacing variable resolution (matching padding tolerance); no mode-specific branching needed for numeric spacing tokens.  
- Selection safety: Highlighting already restores; ensure corner radius apply does not change selection state.  
- Offline & deterministic: Uses local variables only; tolerances reused from padding resolver.  
- Lean UX/perf: Reuse existing results list; add a single button per row and status update; avoid extra re-render passes.

## Project Structure

```text
specs/
├── corner-radius-tokenization.md
└── corner-radius-tokenization-plan.md   # this file

src/
├── apply.ts
├── spacing.ts
├── scanner.ts
├── selection.ts
├── code.ts
├── ui.html
├── types.ts
├── variables.ts
├── colors.ts
├── typography.ts
└── highlight.ts
```

**Structure Decision**: Single-plugin project rooted in `src/`; specs captured in `specs/` with plan alongside the spec file.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|--------------------------------------|
| (none) |  |  |
