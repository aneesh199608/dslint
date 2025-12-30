import { rgbToHex } from "./colors";
import { sendStatus } from "./messages";
import { gatherNodesWithPaints } from "./selection";
import { findClosestTypographyVariable, findMatchingTypographyVariable, getTypography } from "./typography";
import {
  DEFAULT_SPACING_TOLERANCE,
  findNearestSpacingVariable,
  findSpacingVariable,
} from "./spacing";
import { setOriginalSelection } from "./highlight";
import { COLOR_MATCH_THRESHOLDS, findClosestColorVariable, findNearestColorVariable } from "./variables";
import type {
  LibraryScope,
  MatchSettings,
  ModePreference,
  NodeScanResult,
  PaintInfo,
  StatusState,
  TypographyInfo,
  PaddingInfo,
  GapInfo,
  StrokeWeightInfo,
  CornerRadiusInfo,
} from "./types";

const isZero = (value: number | null | undefined) => Math.abs(value ?? 0) < 0.000001;
const getBoundVariableId = (binding: unknown): string | null => {
  if (!binding) return null;
  if (typeof binding === "string") return binding;
  if (typeof binding === "object" && "id" in (binding as { id?: string })) {
    return (binding as { id?: string }).id ?? null;
  }
  return null;
};

const formatPaddingGroups = (
  sides: { label: string; name: string }[],
  collapseAllSame: boolean
) => {
  const groups: { name: string; labels: string[] }[] = [];
  for (const side of sides) {
    const existing = groups.find((g) => g.name === side.name);
    if (existing) {
      existing.labels.push(side.label);
    } else {
      groups.push({ name: side.name, labels: [side.label] });
    }
  }

  if (collapseAllSame && groups.length === 1) {
    return groups[0].name;
  }

  return groups
    .map((group) => `${group.labels.join(",")}: ${group.name}`)
    .join(", ");
};

const resolveSpacingMatch = async (
  value: number,
  libraryScope: LibraryScope,
  allowClosestMatch: boolean
) => {
  const exact = await findSpacingVariable(value, libraryScope);
  if (exact) {
    return { variable: exact, diff: 0, isClosest: false };
  }
  if (!allowClosestMatch) return null;
  const nearest = await findNearestSpacingVariable(
    value,
    DEFAULT_SPACING_TOLERANCE,
    libraryScope
  );
  if (!nearest) return null;
  return { variable: nearest.variable, diff: nearest.diff, isClosest: true };
};

const evalPaint = async (
  node: SceneNode,
  kind: "fill" | "stroke",
  preferredModeName: ModePreference,
  libraryScope: LibraryScope,
  allowClosestMatch: boolean
): Promise<PaintInfo | null> => {
  const paints = kind === "fill" ? (node as GeometryMixin).fills : (node as GeometryMixin).strokes;
  if (!Array.isArray(paints) || paints.length === 0) {
    return null;
  }

  const first = paints[0];

  if (first.type !== "SOLID") {
    return {
      kind,
      message: `Unsupported ${kind} type (only SOLID supported)`,
      state: "error",
    };
  }

  // Try to detect a bound variable from the paint itself or the node-level binding.
  const nodeBound = (node as any).boundVariables;
  const paintBinding = first.boundVariables?.color;
  const paintBindingId = typeof paintBinding === "string" ? paintBinding : paintBinding?.id;
  const nodePaintBound =
    kind === "fill"
      ? nodeBound?.fills?.[0]?.color?.id ?? nodeBound?.fills?.[0]?.id
      : nodeBound?.strokes?.[0]?.color?.id ?? nodeBound?.strokes?.[0]?.id;
  const boundId = paintBindingId ?? nodePaintBound;

  if (boundId) {
    const variable = await figma.variables.getVariableByIdAsync(boundId);
    const variableName = variable?.name ?? "Color variable";

    return {
      kind,
      message: `Using variable: ${variableName}`,
      state: "found",
      variableName,
    };
  }

  const styleId =
    kind === "fill" ? (node as any).fillStyleId : (node as any).strokeStyleId;
  if (styleId && styleId !== figma.mixed) {
    try {
      const style = await figma.getStyleByIdAsync(styleId as string);
      const styleName = style?.name ?? "Color style";
      return {
        kind,
        message: `Using style: ${styleName}`,
        state: "found",
        variableName: styleName,
      };
    } catch (err) {
      return {
        kind,
        message: "Using color style",
        state: "found",
      };
    }
  }

  const opacity = typeof first.opacity === "number" ? first.opacity : 1;
  // Use raw paint color for display so very low opacities still show the intended token tint.
  const hex = rgbToHex(first.color);
  const percent = opacity * 100;
  // Show very small opacities with a bit more precision so 0.1% does not show as 0.00%.
  const opacityDisplay =
    opacity !== 1
      ? ` @${
          percent >= 1
            ? percent.toFixed(1)
            : percent >= 0.1
            ? percent.toPrecision(3)
            : percent.toPrecision(2)
        }%`
      : "";

  // Only actionable missing if there is an exact color+opacity token match.
  const match = await findNearestColorVariable(
    first.color,
    opacity,
    preferredModeName,
    libraryScope
  );
  if (match) {
    return {
      kind,
      message: `Token: ${match.name}${opacityDisplay}`,
      state: "missing",
      variableName: match.name,
      hex,
    };
  }

  if (allowClosestMatch) {
    const closest = await findClosestColorVariable(
      first.color,
      opacity,
      preferredModeName,
      libraryScope
    );
    if (closest) {
      return {
        kind,
        message: `Nearest token: ${closest.variable.name}${opacityDisplay}`,
        state: "missing",
        variableName: closest.variable.name,
        hex,
      };
    }
  }

  return {
    kind,
      message: `${hex}${opacityDisplay} is not using a variable (${
        allowClosestMatch ? "no exact or nearest token match" : "no exact token match"
      }).`,
    state: "info",
    hex,
  };
};

const computeOverallState = (
  fill?: PaintInfo | null,
  stroke?: PaintInfo | null,
  typography?: TypographyInfo | null,
  padding?: PaddingInfo | null,
  gap?: GapInfo | null,
  strokeWeight?: StrokeWeightInfo | null,
  cornerRadius?: CornerRadiusInfo | null
): StatusState => {
  const states = [
    fill?.state,
    stroke?.state,
    typography?.state,
    padding?.state,
    gap?.state,
    // Stroke weight tokenization disabled for this iteration.
    // strokeWeight?.state,
    cornerRadius?.state,
  ].filter(Boolean) as StatusState[];
  if (states.some((s) => s === "missing")) return "missing";
  if (states.some((s) => s === "error")) return "error";
  if (states.some((s) => s === "found" || s === "applied")) return "found";
  return "info";
};

export const scanSelection = async (
  preferredModeName: ModePreference,
  libraryScope: LibraryScope,
  settings?: MatchSettings
): Promise<NodeScanResult[]> => {
  const selection = figma.currentPage.selection;
  setOriginalSelection(selection);

  if (selection.length === 0) {
    sendStatus({
      title: "Select a Layer or Frame to inspect",
      message: "",
      state: "info",
    });
    figma.ui.postMessage({
      type: "scan-results",
      payload: { items: [], mode: preferredModeName, emptySelection: true },
    });
    return [];
  }

  sendStatus({
    title: "Scanning...",
    message: "Analyzing selection for tokens.",
    state: "info",
  });

  const nodes = gatherNodesWithPaints(selection);
  const allowClosestMatch = Boolean(settings?.allowClosestMatch);
  const results: NodeScanResult[] = [];

  for (const node of nodes) {
    const fill = await evalPaint(node, "fill", preferredModeName, libraryScope, allowClosestMatch);
    const stroke = await evalPaint(node, "stroke", preferredModeName, libraryScope, allowClosestMatch);
    let typography: TypographyInfo | undefined;
    let padding: PaddingInfo | undefined;
    let gap: GapInfo | undefined;
    let strokeWeightInfo: StrokeWeightInfo | undefined;
    let cornerRadius: CornerRadiusInfo | undefined;

    if (node.type === "TEXT") {
      const boundId = node.textStyleId;
      if (boundId && boundId !== figma.mixed) {
        try {
          const style = await figma.getStyleByIdAsync(boundId);
          typography = {
            message: `Using style: ${style?.name ?? "Text style"}${
              node.hasMissingFont ? " (fonts missing)" : ""
            }`,
            state: "found",
            variableName: style?.name,
            styleId: boundId as string,
          };
        } catch (err) {
          typography = {
            message: "Typography style bound (details unavailable)",
            state: "found",
            styleId: boundId as string,
          };
        }
      } else {
        const typoInfo = getTypography(node);
        if (!typoInfo.value) {
          typography = {
            message: typoInfo.reason ?? "Typography unsupported for this text node.",
            state: "info",
          };
        } else {
        const match = await findMatchingTypographyVariable(
          node,
          preferredModeName,
          libraryScope,
          typoInfo.value
        );
        if (match) {
          typography = {
            message: `Token: ${match.variable.name}`,
            state: "missing",
            variableName: match.variable.name,
            styleId: match.variable.id,
          };
        } else if (allowClosestMatch) {
          const closest = await findClosestTypographyVariable(
            node,
            preferredModeName,
            libraryScope,
            typoInfo.value
          );
          if (closest) {
            typography = {
              message: `Nearest token: ${closest.variable.name}`,
              state: "missing",
              variableName: closest.variable.name,
              styleId: closest.variable.id,
            };
          } else {
            typography = {
              message: `Typography is not using a variable (${allowClosestMatch ? "no exact or nearest token match" : "no exact token match"}).`,
              state: "info",
            };
          }
        } else {
          typography = {
            message: `Typography is not using a variable (${allowClosestMatch ? "no exact or nearest token match" : "no exact token match"}).`,
            state: "info",
          };
        }
        }
      }
    }

    if ("paddingLeft" in node) {
      const layoutMode = (node as any).layoutMode;
      const isAutoLayout = layoutMode === "HORIZONTAL" || layoutMode === "VERTICAL";
      const layoutNode = node as AutoLayoutMixin;
      const pl = layoutNode.paddingLeft;
      const pr = layoutNode.paddingRight;
      const pt = layoutNode.paddingTop;
      const pb = layoutNode.paddingBottom;
      const bound = (node as any).boundVariables;
      const sides = [
        { value: pl, bound: getBoundVariableId(bound?.paddingLeft), label: "L" },
        { value: pr, bound: getBoundVariableId(bound?.paddingRight), label: "R" },
        { value: pt, bound: getBoundVariableId(bound?.paddingTop), label: "T" },
        { value: pb, bound: getBoundVariableId(bound?.paddingBottom), label: "B" },
      ];
      const relevant = sides.filter((s) => !isZero(s.value));
      if (!relevant.length) {
        padding = undefined; // all zeros: ignore
      } else if (!isAutoLayout) {
        padding = {
          message: "Padding present (auto layout off)",
          state: "info",
        };
      } else {
        const resolvedBound = await Promise.all(
          relevant.map(async (s) => {
            if (!s.bound) return { ...s, boundName: null };
            const variable = await figma.variables.getVariableByIdAsync(s.bound);
            return { ...s, boundName: variable?.name ?? "Unknown variable" };
          })
        );
        const allRelevantBound = resolvedBound.every((s) => Boolean(s.bound));
        const anyRelevantBound = resolvedBound.some((s) => Boolean(s.bound));
        if (allRelevantBound) {
          const message = formatPaddingGroups(
            resolvedBound.map((s) => ({ label: s.label, name: s.boundName ?? "Unknown variable" })),
            resolvedBound.length === 4
          );
          padding = {
            message,
            state: "found",
            variableName: resolvedBound
              .map((s) => s.boundName)
              .filter(Boolean)
              .join(", "),
          };
        } else if (anyRelevantBound) {
          const message = formatPaddingGroups(
            resolvedBound.map((s) => ({
              label: s.label,
              name: s.boundName ?? "(unbound)",
            })),
            false
          );
          padding = {
            message,
            state: "info",
          };
        } else {
          const matches = await Promise.all(
            relevant.map(async (s) => ({
              ...s,
              match: await resolveSpacingMatch(s.value, libraryScope, allowClosestMatch),
            }))
          );
          const unmatched = matches.filter((m) => !m.match);
          if (unmatched.length) {
            const values = relevant.map((s) => `${s.label}:${s.value}`).join(" ");
            padding = {
              message: `${values} is not using a variable (${
                allowClosestMatch ? "no exact or nearest token match" : "no exact token match"
              }).`,
              state: "info",
            };
          } else {
            const hasNearest = matches.some((m) => m.match?.isClosest);
            const parts = formatPaddingGroups(
              matches.map((m) => ({
                label: m.label,
                name: m.match!.variable.name,
              })),
              matches.length === 4
            );
            padding = {
              message: `${hasNearest ? "Nearest token" : "Token"}: ${parts}`,
              state: "missing",
              variableName: matches.map((m) => m.match!.variable.name).join(" / "),
            };
          }
        }
      }
    }

    if ("itemSpacing" in node && "layoutMode" in node) {
      const layoutMode = (node as any).layoutMode;
      const isAutoLayout = layoutMode === "HORIZONTAL" || layoutMode === "VERTICAL";
      const autoNode = node as AutoLayoutMixin;
      const spacing = autoNode.itemSpacing as number | "AUTO" | "Auto";
      const primaryAxisAlign = (node as any).primaryAxisAlignItems;
      const usesAutoGap =
        spacing === "AUTO" ||
        spacing === "Auto" ||
        primaryAxisAlign === "SPACE_BETWEEN" ||
        primaryAxisAlign === "AUTO";

      if (usesAutoGap) {
        gap = { message: "Gap uses Auto spacing (not tokenized)", state: "info" };
      } else if (typeof spacing !== "number") {
        gap = { message: "Gap spacing not numeric (not tokenized)", state: "info" };
      } else if (!isZero(spacing)) {
        if (!isAutoLayout) {
          gap = { message: "Gap present (auto layout off)", state: "info" };
        } else {
          const boundId = (node as any).boundVariables?.itemSpacing?.id;
          if (boundId) {
            const variable = await figma.variables.getVariableByIdAsync(boundId);
            gap = {
              message: `Gap using variable: ${variable?.name ?? "Spacing variable"}`,
              state: "found",
              variableName: variable?.name,
            };
          } else {
            const match = await resolveSpacingMatch(spacing, libraryScope, allowClosestMatch);
            if (match) {
              gap = {
                message: `${match.isClosest ? "Nearest token" : "Token"}: ${match.variable.name}`,
                state: "missing",
                variableName: match.variable.name,
              };
            } else {
              gap = {
                message: `${spacing} is not using a variable (${
                  allowClosestMatch ? "no exact or nearest token match" : "no exact token match"
                }).`,
                state: "info",
              };
            }
          }
        }
      }
    }

    // Stroke weight tokenization disabled for this iteration.
    // if ("strokeWeight" in node) {
    //   const weight = (node as any).strokeWeight;
    //   const strokes = (node as GeometryMixin).strokes;
    //   const bound = (node as any).boundVariables;
    //   const strokeEntry =
    //     Array.isArray(strokes) && strokes[0] && typeof strokes[0] === "object"
    //       ? (strokes[0] as any)
    //       : null;
    //   const strokeWeightAlias =
    //     strokeEntry && typeof strokeEntry.weight === "object" && "type" in strokeEntry.weight
    //       ? strokeEntry.weight
    //       : null;
    //
    //   const candidateIds: (string | undefined)[] = [
    //     typeof bound?.strokeWeight === "string" ? bound.strokeWeight : bound?.strokeWeight?.id,
    //     typeof bound?.strokes?.[0]?.weight === "string"
    //       ? (bound?.strokes?.[0]?.weight as string)
    //       : bound?.strokes?.[0]?.weight?.id,
    //     strokeWeightAlias?.type === "VARIABLE_ALIAS" ? strokeWeightAlias.id : undefined,
    //     typeof strokeEntry?.boundVariables?.weight === "string"
    //       ? (strokeEntry?.boundVariables?.weight as string)
    //       : strokeEntry?.boundVariables?.weight?.id,
    //     typeof bound?.strokes?.[0] === "string"
    //       ? (bound?.strokes?.[0] as string)
    //       : bound?.strokes?.[0]?.id, // consider if stroke-level binding is a FLOAT variable
    //     typeof bound?.["strokes/0/weight"] === "string"
    //       ? (bound?.["strokes/0/weight"] as string)
    //       : (bound?.["strokes/0/weight"] as any)?.id,
    //     typeof strokeEntry?.boundVariables?.strokeWeight === "string"
    //       ? (strokeEntry?.boundVariables?.strokeWeight as string)
    //       : strokeEntry?.boundVariables?.strokeWeight?.id,
    //   ];
    //
    //   const hasBoundAlias =
    //     candidateIds.some(Boolean) || strokeWeightAlias?.type === "VARIABLE_ALIAS";
    //
    //   let boundWeightVariable: Variable | null = null;
    //   let boundWeightVariableName: string | undefined;
    //   for (const cid of candidateIds) {
    //     if (!cid) continue;
    //     try {
    //       const variable = await figma.variables.getVariableByIdAsync(cid);
    //       if (variable && variable.resolvedType === "FLOAT") {
    //         boundWeightVariable = variable;
    //         boundWeightVariableName = variable.name;
    //         break;
    //       }
    //     } catch {
    //       // ignore lookup errors; fall back to alias detection
    //     }
    //   }
    //
    //   if (!Array.isArray(strokes) || strokes.length === 0) {
    //     // No usable strokes; show info only if weight > 0.
    //     if (typeof weight === "number" && weight > 0) {
    //       strokeWeightInfo = { message: "Stroke present but unsupported stroke list", state: "info" };
    //     }
    //   } else {
    //     const firstStroke = strokes[0];
    //     if (firstStroke.type !== "SOLID") {
    //       strokeWeightInfo = { message: "Stroke weight unsupported (non-solid stroke)", state: "info" };
    //     } else if (boundWeightVariable || hasBoundAlias) {
    //       strokeWeightInfo = {
    //         message: `Using variable: ${boundWeightVariableName ?? "Spacing variable"}`,
    //         state: "found",
    //         variableName: boundWeightVariableName,
    //       };
    //     } else if (typeof weight === "number") {
    //       if (isZero(weight)) {
    //         strokeWeightInfo = undefined;
    //       } else {
    //         const match = await findSpacingVariable(weight, libraryScope);
    //         if (match) {
    //           strokeWeightInfo = {
    //             message: match.name,
    //             state: "missing",
    //             variableName: match.name,
    //           };
    //         } else {
    //           strokeWeightInfo = {
    //             message: "Stroke weight has no matching token",
    //             state: "info",
    //           };
    //         }
    //       }
    //     }
    //   }
    // }

    if ("cornerRadius" in node) {
      const bindable = typeof (node as any).setBoundVariable === "function";
      if (!bindable) {
        cornerRadius = {
          message: "Corner radius token binding not supported for this node type.",
          state: "info",
        };
      } else {
      const bound = (node as any).boundVariables;
      const radius = (node as any).cornerRadius;

      const getVariableName = async (id?: string) => {
        if (!id) return undefined;
        const variable = await figma.variables.getVariableByIdAsync(id);
        return variable?.name;
      };

      const setFound = async (id?: string) => {
        const variableName = await getVariableName(id);
        cornerRadius = {
          message: `Corner radius using variable${variableName ? `: ${variableName}` : ""}`,
          state: "found",
          variableName,
        };
      };

      if (typeof radius === "number") {
        if (isZero(radius)) {
          cornerRadius = undefined; // treat 0 as absent
        } else {
          const boundId =
            bound?.cornerRadius?.id ??
            bound?.topLeftRadius?.id ??
            bound?.topRightRadius?.id ??
            bound?.bottomRightRadius?.id ??
            bound?.bottomLeftRadius?.id;
          if (boundId) {
            await setFound(boundId);
          } else {
            const match = await resolveSpacingMatch(radius, libraryScope, allowClosestMatch);
            if (match) {
              cornerRadius = {
                message: `${match.isClosest ? "Nearest token" : "Token"}: ${match.variable.name}`,
                state: "missing",
                variableName: match.variable.name,
              };
            } else {
              cornerRadius = {
                message: `${radius} is not using a variable (${
                  allowClosestMatch ? "no exact or nearest token match" : "no exact token match"
                }).`,
                state: "info",
              };
            }
          }
        }
      } else if (radius === figma.mixed) {
        const corners = [
          { label: "TL", value: (node as any).topLeftRadius, bound: bound?.topLeftRadius?.id },
          { label: "TR", value: (node as any).topRightRadius, bound: bound?.topRightRadius?.id },
          { label: "BR", value: (node as any).bottomRightRadius, bound: bound?.bottomRightRadius?.id },
          { label: "BL", value: (node as any).bottomLeftRadius, bound: bound?.bottomLeftRadius?.id },
        ].filter((c) => typeof c.value === "number" && !isZero(c.value));

        if (!corners.length) {
          cornerRadius = undefined;
        } else {
          const allBound = corners.every((c) => Boolean(c.bound));
          if (allBound) {
            await setFound(corners[0].bound);
          } else {
            const matches = await Promise.all(
              corners.map(async (c) => ({
                ...c,
                match: c.bound
                  ? null
                  : await resolveSpacingMatch(c.value as number, libraryScope, allowClosestMatch),
              }))
            );
            const matched = matches.filter((m) => m.match);
            if (!matched.length) {
              cornerRadius = {
                message: `${corners
                  .map((c) => `${c.label}:${c.value}`)
                  .join(" ")} is not using a variable (${
                  allowClosestMatch ? "no exact or nearest token match" : "no exact token match"
                }).`,
                state: "info",
              };
            } else {
              const hasNearest = matches.some((m) => m.match?.isClosest);
              const parts = matches
                .map((m) => {
                  if (m.bound) return `${m.label}:bound`;
                  if (m.match) {
                    return `${m.label}:${m.match.variable.name}`;
                  }
                  return `${m.label}:?`;
                })
                .join(" ");
              cornerRadius = {
                message: `${hasNearest ? "Nearest token" : "Token"}: ${parts}`,
                state: "missing",
                variableName: matches
                  .map((m) => (m.match ? m.match.variable.name : ""))
                  .filter(Boolean)
                  .join(" / "),
              };
            }
          }
        }
      }
      }
    }

    if (!fill && !stroke && !typography && !padding && !gap && !strokeWeightInfo && !cornerRadius)
      continue;

    const state = computeOverallState(
      fill,
      stroke,
      typography,
      padding,
      gap,
      strokeWeightInfo,
      cornerRadius
    );

    results.push({
      id: node.id,
      name: node.name,
      state,
      fill: fill || undefined,
      stroke: stroke || undefined,
      typography,
      padding,
      gap,
      strokeWeight: strokeWeightInfo,
      cornerRadius,
    });
  }

  const found = results.filter((r) => r.state === "found").length;
  const missing = results.filter((r) => r.state === "missing").length;
  const errors = results.filter((r) => r.state === "error").length;

  const title = "Scan complete";
  const message = `${found} with tokens, ${missing} missing, ${errors} unsupported`;

  sendStatus({ title, message, state: "info" });
  figma.ui.postMessage({
    type: "scan-results",
    payload: {
      items: results,
      mode: preferredModeName,
      emptySelection: false,
    },
  });

  return results;
};
