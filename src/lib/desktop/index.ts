// =============================================================================
// Libmork — Detecção e helpers do Desktop Client (Issue #80)
// =============================================================================

import type { DesktopNotificationOptions } from "../../../electron/types";

export interface DesktopEnvironment {
  isDesktop: boolean;
  platform?: string;
  version?: string;
}

export function getDesktopEnvironment(): DesktopEnvironment {
  if (typeof window === "undefined") return { isDesktop: false };
  if (window.desktopClient?.isElectron) {
    return {
      isDesktop: true,
      platform: window.desktopClient.platform,
      version: window.desktopClient.version,
    };
  }
  return { isDesktop: false };
}

export function getDesktopClient() {
  if (typeof window === "undefined") return null;
  return window.desktopClient ?? null;
}

export async function sendDesktopNotification(
  options: DesktopNotificationOptions,
): Promise<boolean> {
  const client = getDesktopClient();
  if (client) {
    return client.sendNotification(options);
  }

  if (typeof window !== "undefined" && "Notification" in window) {
    if (Notification.permission === "granted") {
      new Notification(options.title, {
        body: options.body,
        tag: options.tag,
        silent: options.sound === false,
      });
      return true;
    }
  }
  return false;
}
