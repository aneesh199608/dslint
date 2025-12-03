export type ModePreference = "Light" | "Dark";

export type StatusState = "missing" | "found" | "applied" | "error" | "info";

export type StatusPayload = {
  title: string;
  message: string;
  state?: StatusState;
};

export type NodeScanResult = {
  id: string;
  name: string;
  message: string;
  state: StatusState;
  hex?: string;
  variableName?: string;
};
