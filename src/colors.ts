export const toHex = (value: number): string =>
  Math.round(value * 255)
    .toString(16)
    .padStart(2, "0")
    .toUpperCase();

export const rgbToHex = (color: RGB): string =>
  `#${toHex(color.r)}${toHex(color.g)}${toHex(color.b)}`;

export const rgbDistanceSq = (a: RGB, b: RGB): number => {
  const dr = a.r - b.r;
  const dg = a.g - b.g;
  const db = a.b - b.b;
  return dr * dr + dg * dg + db * db;
};

export const colorsEqual = (a: RGB, b: RGB) => {
  const eps = 1e-5;
  return Math.abs(a.r - b.r) < eps && Math.abs(a.g - b.g) < eps && Math.abs(a.b - b.b) < eps;
};
