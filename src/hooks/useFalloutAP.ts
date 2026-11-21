"use client";

// =============================================================================
// Libmork — Fallout 2d20: estado do pool de AP (equipe e supervisor)
// O servidor é a fonte de verdade; o cliente apenas ecoa o valor devolvido.
// =============================================================================

import { useCallback, useEffect, useState } from "react";
import { useSocket } from "@/context/SocketContext";

interface UseFalloutAPResult {
  partyAP: number;
  overseerAP: number;
  maxAP: number;
  isUpdating: boolean;
  error: string | null;
  updateAP: (deltaParty: number, deltaOverseer?: number) => Promise<void>;
}

export function useFalloutAP(campaignId: string | null): UseFalloutAPResult {
  const { emitFalloutApUpdate, subscribeFalloutApUpdate } = useSocket();

  const [partyAP, setPartyAP] = useState(0);
  const [overseerAP, setOverseerAP] = useState(0);
  const [maxAP, setMaxAP] = useState(6);
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!campaignId) return;
    let active = true;

    fetch(`/api/systems/fallout/campaigns/${campaignId}/ap`, { credentials: "include" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!active || !data?.success || !data.data) return;
        setPartyAP(data.data.partyAP);
        setOverseerAP(data.data.overseerAP);
        setMaxAP(data.data.maxPartyAP || 6);
      })
      .catch(() => {});

    return () => {
      active = false;
    };
  }, [campaignId]);

  useEffect(() => {
    return subscribeFalloutApUpdate((payload) => {
      if (!campaignId || payload.campaignId === campaignId) {
        if (payload.partyAP !== undefined) setPartyAP(payload.partyAP);
        if (payload.overseerAP !== undefined) setOverseerAP(payload.overseerAP);
      }
    });
  }, [campaignId, subscribeFalloutApUpdate]);

  const updateAP = useCallback(
    async (deltaParty: number, deltaOverseer: number = 0) => {
      if (!campaignId || isUpdating) return;

      setIsUpdating(true);
      setError(null);

      try {
        const res = await fetch(`/api/systems/fallout/campaigns/${campaignId}/ap`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ deltaParty, deltaOverseer }),
        });
        const json = await res.json().catch(() => null);

        if (!res.ok || !json?.success) {
          setError(json?.error || "Não foi possível ajustar o AP");
          return;
        }

        setPartyAP(json.data.partyAP);
        setOverseerAP(json.data.overseerAP);
        setMaxAP(json.data.maxPartyAP || 6);
        emitFalloutApUpdate({
          campaignId,
          partyAP: json.data.partyAP,
          overseerAP: json.data.overseerAP,
        });
      } catch {
        setError("Sem conexão com o servidor");
      } finally {
        setIsUpdating(false);
      }
    },
    [campaignId, isUpdating, emitFalloutApUpdate],
  );

  return { partyAP, overseerAP, maxAP, isUpdating, error, updateAP };
}
