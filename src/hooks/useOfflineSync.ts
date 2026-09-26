"use client";

import { useEffect, useState, useCallback } from "react";
import { syncPendingMutations } from "@/lib/offline/syncManager";
import { getPendingMutations } from "@/lib/offline/storage";

export function useOfflineSync(characterId?: string) {
  const [isOffline, setIsOffline] = useState<boolean>(
    typeof navigator !== "undefined" ? !navigator.onLine : false
  );
  const [pendingCount, setPendingCount] = useState<number>(0);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);

  const refreshPendingCount = useCallback(async () => {
    try {
      const pending = await getPendingMutations(characterId);
      setPendingCount(pending.length);
    } catch {
      setPendingCount(0);
    }
  }, [characterId]);

  const handleSync = useCallback(async () => {
    if (isSyncing) return;
    setIsSyncing(true);
    try {
      await syncPendingMutations();
      await refreshPendingCount();
    } finally {
      setIsSyncing(false);
    }
  }, [isSyncing, refreshPendingCount]);

  useEffect(() => {
    refreshPendingCount();

    const handleOnline = () => {
      setIsOffline(false);
      handleSync();
    };

    const handleOffline = () => {
      setIsOffline(true);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [handleOnline, handleSync, refreshPendingCount]);

  return {
    isOffline,
    pendingCount,
    isSyncing,
    syncMutations: handleSync,
    refreshPendingCount,
  };
}
