"use client";

import React from "react";
import { useOfflineSync } from "@/hooks/useOfflineSync";
import { Spinner } from "./Spinner";

export function OfflineSyncIndicator({ characterId }: { characterId?: string }) {
  const { isOffline, pendingCount, isSyncing, syncMutations } = useOfflineSync(characterId);

  if (!isOffline && pendingCount === 0 && !isSyncing) {
    return null;
  }

  return (
    <div className="fixed bottom-16 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 rounded-full border border-amber-500/40 bg-gray-950/90 px-4 py-2 text-xs font-semibold text-amber-300 shadow-xl backdrop-blur-md">
      {isSyncing ? (
        <>
          <Spinner size="sm" />
          <span>Sincronizando alterações com o servidor...</span>
        </>
      ) : isOffline ? (
        <>
          <span className="text-sm">📡</span>
          <span>Modo Offline ({pendingCount} pendente{pendingCount !== 1 ? "s" : ""})</span>
        </>
      ) : (
        <>
          <span className="text-sm">⚡</span>
          <span>{pendingCount} alteração(ões) pendente(s)</span>
          <button
            type="button"
            onClick={syncMutations}
            className="ml-2 rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-bold text-gray-950 hover:bg-amber-400"
          >
            Sincronizar
          </button>
        </>
      )}
    </div>
  );
}
