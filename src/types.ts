export type ModePreference = "Light" | "Dark";

export type StatusState = "missing" | "found" | "applied" | "error" | "info";

export type StatusPayload = {
  title: string;
  message: string;
  state?: StatusState;
};

export type PaintInfo = {
  kind: "fill" | "stroke";
  message: string;
  state: StatusState;
  hex?: string;
  variableName?: string;
};

export type TypographyInfo = {
  message: string;
  state: StatusState;
  variableName?: string;
};

export type PaddingInfo = {
  message: string;
  state: StatusState;
  variableName?: string;
};

export type GapInfo = {
  message: string;
  state: StatusState;
  variableName?: string;
};

export type NodeScanResult = {
  id: string;
  name: string;
  state: StatusState;
  fill?: PaintInfo;
  stroke?: PaintInfo;
  typography?: TypographyInfo;
  padding?: PaddingInfo;
  gap?: GapInfo;
};
