export type ModePreference = "Light" | "Dark";

export type StatusState = "missing" | "found" | "applied" | "error" | "info";

export type LibraryScopeKind = "local" | "all" | "library";

export type LibraryScope =
  | { type: "local" }
  | { type: "all" }
  | { type: "library"; id: string; libraryName: string; collectionKeys: string[] };

export type LibraryOption = {
  id: string;
  label: string;
  scope: LibraryScope;
  disabled?: boolean;
  reason?: string;
};

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
  styleId?: string;
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

export type StrokeWeightInfo = {
  message: string;
  state: StatusState;
  variableName?: string;
};

export type CornerRadiusInfo = {
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
  strokeWeight?: StrokeWeightInfo;
  cornerRadius?: CornerRadiusInfo;
};
