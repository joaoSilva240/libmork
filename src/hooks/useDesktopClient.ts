"use client";

// =============================================================================
// Libmork — Hook useDesktopClient (Issue #80)
// =============================================================================

import { useCallback, useState } from "react";
import { getDesktopClient, getDesktopEnvironment, sendDesktopNotification } from "@/lib/desktop";
import type { DesktopNotificationOptions, ServerConfig } from "../../electron/types";

export function useDesktopClient() {
  const [env] = useState(() => getDesktopEnvironment());

  const notify = useCallback(async (options: DesktopNotificationOptions): Promise<boolean> => {
    return sendDesktopNotification(options);
  }, []);

  const getActiveServer = useCallback(async (): Promise<string | null> => {
    const client = getDesktopClient();
    if (!client) return null;
    return client.getActiveServer();
  }, []);

  const disconnectServer = useCallback(async () => {
    const client = getDesktopClient();
    if (client) {
      await client.disconnectServer();
    }
  }, []);

  const getServers = useCallback(async (): Promise<ServerConfig[]> => {
    const client = getDesktopClient();
    if (!client) return [];
    return client.getServerList();
  }, []);

  const openExternal = useCallback(async (url: string) => {
    const client = getDesktopClient();
    if (client) {
      await client.openExternal(url);
    } else if (typeof window !== "undefined") {
      window.open(url, "_blank", "noopener,noreferrer");
    }
  }, []);

  return {
    isDesktop: env.isDesktop,
    platform: env.platform,
    notify,
    getActiveServer,
    disconnectServer,
    getServers,
    openExternal,
  };
}
