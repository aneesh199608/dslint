// Helpers for spacing variables (padding, etc.)

const resolveNumericValue = async (variable: Variable) => {
  const collection = await figma.variables.getVariableCollectionByIdAsync(
    variable.variableCollectionId
  );
  const modeId = collection?.defaultModeId ?? collection?.modes?.[0]?.modeId;
  if (!modeId) return null;
  const val = variable.valuesByMode[modeId];
  if (typeof val === "number") return val;
  if (typeof val === "object" && "type" in val && val.type === "VARIABLE_ALIAS") {
    const target = await figma.variables.getVariableByIdAsync(val.id);
    if (!target) return null;
    return resolveNumericValue(target);
  }
  return null;
};

export const findSpacingVariable = async (value: number) => {
  const vars = await figma.variables.getLocalVariablesAsync("FLOAT");
  for (const variable of vars) {
    const resolved = await resolveNumericValue(variable);
    if (resolved !== null && Math.abs(resolved - value) < 1e-5) {
      return variable;
    }
  }
  return null;
};
