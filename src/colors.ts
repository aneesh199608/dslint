export const toHex = (value: number): string =>
  Math.round(value * 255)
    .toString(16)
    .padStart(2, "0")
    .toUpperCase();

export type RGBA = RGB & { a?: number };

export const rgbToHex = (color: RGB): string =>
  `#${toHex(color.r)}${toHex(color.g)}${toHex(color.b)}`;

export const rgbDistanceSq = (a: RGBA, b: RGBA, alphaA = 1, alphaB = 1): number => {
  // Compare effective channels (respecting opacity), so semi-transparent tokens match correctly.
  const effAlphaA = (a.a ?? 1) * alphaA;
  const effAlphaB = (b.a ?? 1) * alphaB;
  const dr = a.r * effAlphaA - b.r * effAlphaB;
  const dg = a.g * effAlphaA - b.g * effAlphaB;
  const db = a.b * effAlphaA - b.b * effAlphaB;
  return dr * dr + dg * dg + db * db;
};

export const colorsEqual = (a: RGBA, b: RGBA, alphaA = 1, alphaB = 1) => {
  const channelEps = 1e-4;
  const alphaEps = 1e-3;
  const effAlphaA = (a.a ?? 1) * alphaA;
  const effAlphaB = (b.a ?? 1) * alphaB;
  const alphaDiff = Math.abs(effAlphaA - effAlphaB);
  return (
    Math.abs(a.r * effAlphaA - b.r * effAlphaB) < channelEps &&
    Math.abs(a.g * effAlphaA - b.g * effAlphaB) < channelEps &&
    Math.abs(a.b * effAlphaA - b.b * effAlphaB) < channelEps &&
    alphaDiff < alphaEps
  );
};
