// =============================================================================
// Libmork — Declaração Global do Desktop Client (Issue #80)
// =============================================================================

import type { DesktopClientApi } from "../../electron/types";

declare global {
  interface Window {
    desktopClient?: DesktopClientApi;
  }
}

export {};
