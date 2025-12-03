import type { StatusPayload } from "./types";

export const sendStatus = (payload: StatusPayload) => {
  figma.ui.postMessage({ type: "status", payload });
};
