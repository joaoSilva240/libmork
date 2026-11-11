"use client";

// =============================================================================
// Libmork — Sistema Fallout 2d20: Rastreador de Pontos de Ação (AP Pool)
// Sincronização em tempo real entre Jogadores e Supervisor (Mestre)
// =============================================================================

import React, { useEffect, useState, useCallback } from "react";
import { useSocket } from "@/context/SocketContext";
import { Zap, Plus, Minus } from "lucide-react";

interface APTrackerWidgetProps {
  campaignId: string | null;
  isMaster?: boolean;
  className?: string;
  initialPartyAP?: number;
  initialOverseerAP?: number;
  maxPartyAP?: number;
}

export function APTrackerWidget({
  campaignId,
  isMaster = false,
  className = "",
  initialPartyAP = 0,
  initialOverseerAP = 0,
  maxPartyAP = 6,
}: APTrackerWidgetProps) {
  const { emitFalloutApUpdate, subscribeFalloutApUpdate } = useSocket();

  const [partyAP, setPartyAP] = useState<number>(initialPartyAP);
  const [overseerAP, setOverseerAP] = useState<number>(initialOverseerAP);
  const [maxAP, setMaxAP] = useState<number>(maxPartyAP);
  const [isUpdating, setIsUpdating] = useState<boolean>(false);

  // Carrega estado inicial do servidor caso haja campanha
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

  // Escuta atualizações via WebSocket
  useEffect(() => {
    const unsub = subscribeFalloutApUpdate((payload) => {
      if (!campaignId || payload.campaignId === campaignId) {
        if (payload.partyAP !== undefined) setPartyAP(payload.partyAP);
        if (payload.overseerAP !== undefined) setOverseerAP(payload.overseerAP);
      }
    });
    return unsub;
  }, [campaignId, subscribeFalloutApUpdate]);

  const updateAP = useCallback(
    async (deltaParty: number, deltaOverseer: number = 0) => {
      const nextParty = Math.max(0, Math.min(partyAP + deltaParty, maxAP));
      const nextOverseer = Math.max(0, overseerAP + deltaOverseer);

      setPartyAP(nextParty);
      setOverseerAP(nextOverseer);

      if (campaignId) {
        setIsUpdating(true);
        emitFalloutApUpdate({
          campaignId,
          partyAP: nextParty,
          overseerAP: nextOverseer,
        });

        try {
          await fetch(`/api/systems/fallout/campaigns/${campaignId}/ap`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({
              partyAP: nextParty,
              overseerAP: nextOverseer,
            }),
          });
        } catch {
          // Fallback silencioso
        } finally {
          setIsUpdating(false);
        }
      }
    },
    [campaignId, partyAP, overseerAP, maxAP, emitFalloutApUpdate],
  );

  return (
    <div
      data-testid="fallout-ap-tracker"
      className={`flex items-center gap-3 bg-black/70 border border-amber-500/40 rounded-lg px-3 py-2 text-amber-400 font-mono text-xs select-none shadow-[0_0_12px_rgba(245,158,11,0.15)] ${className}`}
    >
      {/* Pool da Equipe */}
      <div className="flex items-center gap-1.5">
        <span className="flex items-center gap-1 font-bold tracking-wider text-amber-300">
          <Zap size={14} className="fill-amber-400 text-amber-400" />
          <span>AP EQUIPE:</span>
        </span>

        {/* Marcadores de AP Pip-Boy */}
        <div
          className="flex items-center gap-1 mx-1"
          aria-label={`Pontos de Ação: ${partyAP} de ${maxAP}`}
        >
          {Array.from({ length: maxAP }).map((_, i) => (
            <div
              key={i}
              className={`w-3.5 h-3.5 rounded-sm border transition-all ${
                i < partyAP
                  ? "bg-amber-400 border-amber-300 shadow-[0_0_8px_rgba(245,158,11,0.8)]"
                  : "bg-amber-950/40 border-amber-900/60"
              }`}
            />
          ))}
        </div>

        <span className="font-semibold ml-0.5 text-amber-200">
          {partyAP}/{maxAP}
        </span>
      </div>

      {/* Controles de AP da Equipe */}
      <div className="flex items-center gap-1">
        <button
          type="button"
          disabled={partyAP <= 0 || isUpdating}
          onClick={() => updateAP(-1, 0)}
          className="p-1 rounded bg-amber-950/60 border border-amber-700/50 hover:bg-amber-900/60 text-amber-300 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
          title="Gastar 1 AP da Equipe"
          aria-label="Gastar 1 AP"
        >
          <Minus size={11} />
        </button>
        <button
          type="button"
          disabled={partyAP >= maxAP || isUpdating}
          onClick={() => updateAP(1, 0)}
          className="p-1 rounded bg-amber-950/60 border border-amber-700/50 hover:bg-amber-900/60 text-amber-300 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
          title="Adicionar 1 AP à Equipe"
          aria-label="Adicionar 1 AP"
        >
          <Plus size={11} />
        </button>
      </div>

      {/* Contador do Supervisor / Mestre (se for mestre ou se houver AP do supervisor ativo) */}
      {(isMaster || overseerAP > 0) && (
        <div className="flex items-center gap-2 pl-3 border-l border-amber-700/40">
          <span className="font-bold text-red-400 tracking-wider">AP SUPERVISOR:</span>
          <span className="font-semibold text-red-300">{overseerAP}</span>
          {isMaster && (
            <div className="flex items-center gap-1">
              <button
                type="button"
                disabled={overseerAP <= 0 || isUpdating}
                onClick={() => updateAP(0, -1)}
                className="p-1 rounded bg-red-950/60 border border-red-700/50 hover:bg-red-900/60 text-red-300 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
                title="Gastar 1 AP do Supervisor"
                aria-label="Gastar AP do Supervisor"
              >
                <Minus size={11} />
              </button>
              <button
                type="button"
                disabled={isUpdating}
                onClick={() => updateAP(0, 1)}
                className="p-1 rounded bg-red-950/60 border border-red-700/50 hover:bg-red-900/60 text-red-300 cursor-pointer transition-colors"
                title="Adicionar 1 AP ao Supervisor"
                aria-label="Adicionar AP ao Supervisor"
              >
                <Plus size={11} />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
