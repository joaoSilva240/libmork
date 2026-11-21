"use client";

// =============================================================================
// Libmork — Fallout 2d20: alvos e aplicação de radiação do Escudo do Mestre
// Imunidade por origem, clamp e condições são decididos no servidor.
// =============================================================================

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSocket } from "@/context/SocketContext";
import { getCharacterRadiation, isRadiationImmune } from "@/lib/systems/fallout/rules";
import type { FalloutCharacter, FalloutRadiationBroadcast } from "@/lib/systems/fallout/types";

export const RADIATION_STEPS = [1, 5] as const;

export interface RadiationFeedback {
  text: string;
  tone: "ok" | "error";
}

interface UseFalloutRadiationResult {
  targets: FalloutCharacter[];
  vulnerable: FalloutCharacter[];
  selectedIds: string[];
  selectedCount: number;
  averagePercent: number;
  step: number;
  isLoading: boolean;
  isApplying: boolean;
  feedback: RadiationFeedback | null;
  setStep: (step: number) => void;
  toggleTarget: (id: string) => void;
  selectAll: () => void;
  clearSelection: () => void;
  applyDelta: (sign: 1 | -1) => Promise<void>;
  reloadRoster: () => Promise<void>;
}

export function useFalloutRadiation(campaignId: string): UseFalloutRadiationResult {
  const { emitFalloutRadiationUpdate, subscribeFalloutRadiationUpdate } = useSocket();

  const [targets, setTargets] = useState<FalloutCharacter[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [step, setStep] = useState<number>(1);
  const [isLoading, setIsLoading] = useState(true);
  const [isApplying, setIsApplying] = useState(false);
  const [feedback, setFeedback] = useState<RadiationFeedback | null>(null);
  const didPickDefaults = useRef(false);

  const reloadRoster = useCallback(async () => {
    try {
      const res = await fetch(`/api/systems/fallout/characters?campaignId=${campaignId}`, {
        credentials: "include",
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success || !Array.isArray(json.data)) return;

      const roster: FalloutCharacter[] = json.data;
      setTargets(roster);
      if (!didPickDefaults.current) {
        didPickDefaults.current = true;
        setSelectedIds(roster.filter((c) => !isRadiationImmune(c.origin)).map((c) => c.id));
      }
    } catch {
      setFeedback({ text: "Sem conexão com o servidor", tone: "error" });
    } finally {
      setIsLoading(false);
    }
  }, [campaignId]);

  useEffect(() => {
    void reloadRoster();
  }, [reloadRoster]);

  useEffect(() => {
    return subscribeFalloutRadiationUpdate((payload: FalloutRadiationBroadcast) => {
      if (payload.campaignId !== campaignId) return;
      setTargets((prev) =>
        prev.map((target) => {
          const patch = payload.characters.find((c) => c.characterId === target.id);
          if (!patch) return target;
          return { ...target, radiation: patch.radiation, hpCurrent: patch.hpCurrent };
        }),
      );
    });
  }, [campaignId, subscribeFalloutRadiationUpdate]);

  useEffect(() => {
    if (!feedback) return;
    const timer = setTimeout(() => setFeedback(null), 4000);
    return () => clearTimeout(timer);
  }, [feedback]);

  const vulnerable = useMemo(() => targets.filter((c) => !isRadiationImmune(c.origin)), [targets]);
  const selectedCount = selectedIds.filter((id) => vulnerable.some((c) => c.id === id)).length;
  const averagePercent = vulnerable.length
    ? Math.round(
        vulnerable.reduce((acc, c) => acc + getCharacterRadiation(c).percent, 0) /
          vulnerable.length,
      )
    : 0;

  const toggleTarget = useCallback((id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }, []);

  const selectAll = useCallback(() => {
    setSelectedIds(vulnerable.map((c) => c.id));
  }, [vulnerable]);

  const clearSelection = useCallback(() => setSelectedIds([]), []);

  const applyDelta = useCallback(
    async (sign: 1 | -1) => {
      if (isApplying || selectedCount === 0) return;

      setIsApplying(true);
      setFeedback(null);
      const delta = sign * step;

      try {
        const res = await fetch("/api/systems/fallout/radiation", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ campaignId, characterIds: selectedIds, delta }),
        });
        const json = await res.json().catch(() => null);

        if (!res.ok || !json?.success) {
          setFeedback({ text: json?.error || "Não foi possível aplicar radiação", tone: "error" });
          return;
        }

        const { updated, immune } = json.data as {
          updated: FalloutRadiationBroadcast["characters"];
          immune: { characterId: string; name: string }[];
        };

        setTargets((prev) =>
          prev.map((target) => {
            const patch = updated.find((c) => c.characterId === target.id);
            if (!patch) return target;
            return { ...target, radiation: patch.radiation, hpCurrent: patch.hpCurrent };
          }),
        );

        emitFalloutRadiationUpdate({ campaignId, delta, characters: updated });

        const parts = [
          updated.length > 0
            ? `${delta > 0 ? "+" : ""}${delta} RADS em ${updated.length} sobrevivente(s)`
            : "Nenhum alvo afetado",
        ];
        if (immune.length > 0) parts.push(`${immune.length} imune(s) ignorado(s)`);
        setFeedback({ text: parts.join(" · "), tone: "ok" });
      } catch {
        setFeedback({ text: "Sem conexão com o servidor", tone: "error" });
      } finally {
        setIsApplying(false);
      }
    },
    [campaignId, isApplying, selectedCount, selectedIds, step, emitFalloutRadiationUpdate],
  );

  return {
    targets,
    vulnerable,
    selectedIds,
    selectedCount,
    averagePercent,
    step,
    isLoading,
    isApplying,
    feedback,
    setStep,
    toggleTarget,
    selectAll,
    clearSelection,
    applyDelta,
    reloadRoster,
  };
}
