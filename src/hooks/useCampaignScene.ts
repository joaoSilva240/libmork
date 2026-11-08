"use client";

// =============================================================================
// Libmork — Hook: Cena ativa do escudo do mestre (Issue #86, Fase 1)
// =============================================================================
// Estado central da cena: restaura do banco (initialScene vindo do GET da
// campanha), persiste via PATCH e sincroniza em tempo real pelo evento
// socket "scene-changed" (aba principal, pop-out da Mesa e outras abas).
// =============================================================================

import { useCallback, useEffect, useState } from "react";
import type { Socket } from "socket.io-client";
import { sanitizeActiveScene, type ActiveScene } from "@/lib/scenes/sceneConfig";

type MinimalSocket = Pick<Socket, "on" | "off" | "emit">;

type SceneChangedPayload = { campaignId?: string; scene?: unknown };

export type UseCampaignSceneOptions = {
  campaignId: string | null;
  initialScene?: unknown;
  socket: MinimalSocket | null;
};

export type UseCampaignSceneResult = {
  activeScene: ActiveScene;
  isSaving: boolean;
  error: string | null;
  setScene: (next: ActiveScene, encounterAction?: "ended" | "kept") => Promise<void>;
};

export function useCampaignScene({
  campaignId,
  initialScene,
  socket,
}: UseCampaignSceneOptions): UseCampaignSceneResult {
  const [activeScene, setActiveScene] = useState<ActiveScene>(() => sanitizeActiveScene(initialScene));
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // A campanha carrega depois do mount: restaura a cena persistida.
  useEffect(() => {
    setActiveScene(sanitizeActiveScene(initialScene));
  }, [campaignId, initialScene]);

  // Sync em tempo real — ignora eventos de outras campanhas.
  useEffect(() => {
    if (!socket || !campaignId) return;
    const handler = (payload: SceneChangedPayload) => {
      if (payload?.campaignId !== campaignId) return;
      setActiveScene(sanitizeActiveScene(payload.scene ?? null));
    };
    socket.on("scene-changed", handler);
    return () => {
      socket.off("scene-changed", handler);
    };
  }, [socket, campaignId]);

  const setScene = useCallback(
    async (next: ActiveScene, encounterAction?: "ended" | "kept") => {
      if (!campaignId) return;
      const previous = activeScene;
      setActiveScene(next); // otimista; rollback em falha
      setIsSaving(true);
      setError(null);
      try {
        const res = await fetch(`/api/campaigns/${campaignId}/scene`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ scene: next, encounterAction }),
        });
        if (!res.ok) throw new Error(`PATCH scene HTTP ${res.status}`);
        socket?.emit("scene-changed", { campaignId, scene: next, encounterAction });
      } catch {
        setActiveScene(previous);
        setError("Não foi possível salvar a cena");
      } finally {
        setIsSaving(false);
      }
    },
    [activeScene, campaignId, socket],
  );

  return { activeScene, isSaving, error, setScene };
}
