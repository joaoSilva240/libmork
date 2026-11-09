"use client";

// =============================================================================
// Libmork — DesktopNotifier: Notificações Nativas em Tempo Real (Issue #80)
// =============================================================================
// Escuta eventos do SocketContext (turno na iniciativa, reação de defesa,
// convites de duelo e logs/mensagens da campanha) e dispara notificações
// nativas do SO via Electron IPC (ou Web Notification API como fallback).

import { useEffect, useRef } from "react";
import { useSocket } from "@/context/SocketContext";
import { getDesktopClient, sendDesktopNotification } from "@/lib/desktop";

export default function DesktopNotifier() {
  const {
    subscribeInitiativeRequest,
    subscribeCombatState,
    subscribeDefenseRequest,
    subscribeDuelInvite,
    subscribeCampaignLogCreated,
  } = useSocket();
  const lastTurnKeyRef = useRef<string | null>(null);

  useEffect(() => {
    const unsubInitiative = subscribeInitiativeRequest((payload) => {
      sendDesktopNotification({
        title: "Iniciativa Solicitada",
        body: "O Mestre solicitou que os participantes rolem iniciativa!",
        tag: `initiative-${payload.campaignId}`,
      });
    });

    const unsubCombat = subscribeCombatState((state) => {
      if (!state.active || !state.combatants || state.combatants.length === 0) {
        lastTurnKeyRef.current = null;
        return;
      }

      const currentCombatant = state.combatants[state.currentTurnIndex];
      if (!currentCombatant) return;

      const turnKey = `${state.id}-${state.round}-${state.currentTurnIndex}-${currentCombatant.id}`;
      if (lastTurnKeyRef.current === turnKey) return;
      lastTurnKeyRef.current = turnKey;

      sendDesktopNotification({
        title: `Turno de ${currentCombatant.name}`,
        body: `Rodada ${state.round} — É a vez de ${currentCombatant.name} agir no combate.`,
        tag: `combat-turn-${state.campaignId}`,
      });
    });

    const unsubDefense = subscribeDefenseRequest((payload) => {
      const actionLabel = payload.actionName ? ` com ${payload.actionName}` : "";
      sendDesktopNotification({
        title: "Solicitação de Reação de Defesa",
        body: `${payload.attackerName} atacou ${payload.targetName}${actionLabel} (${payload.rawDamage} de dano)! Escolha Esquivar ou Bloquear.`,
        tag: `defense-${payload.id}`,
      });
    });

    const unsubDuel = subscribeDuelInvite((payload) => {
      sendDesktopNotification({
        title: "Convite de Duelo",
        body: `${payload.challengerName} desafiou ${payload.targetCharacterName} para um duelo${payload.permanentResults ? " (Resultados Permanentes)" : ""}!`,
        tag: `duel-${payload.campaignId}-${payload.challengerId}-${payload.targetCharacterId}`,
      });
    });

    const unsubLog = subscribeCampaignLogCreated((payload) => {
      if (!payload?.log) return;
      const actor = payload.log.actorName || "Sistema";
      const message = payload.log.description || payload.log.action;
      if (!message) return;

      sendDesktopNotification({
        title: `Mensagem da Campanha — ${actor}`,
        body: message,
        tag: `log-${payload.log.id}`,
      });
    });

    return () => {
      unsubInitiative();
      unsubCombat();
      unsubDefense();
      unsubDuel();
      unsubLog();
    };
  }, [
    subscribeInitiativeRequest,
    subscribeCombatState,
    subscribeDefenseRequest,
    subscribeDuelInvite,
    subscribeCampaignLogCreated,
  ]);

  // Ponte de eventos de atalhos globais do Electron para a Jukebox
  useEffect(() => {
    const client = getDesktopClient();
    if (!client) return;

    const offPlay = client.onJukeboxTogglePlay(() => {
      window.dispatchEvent(new CustomEvent("libmork:jukebox-toggle-play"));
    });

    const offMute = client.onJukeboxMute(() => {
      window.dispatchEvent(new CustomEvent("libmork:jukebox-mute"));
    });

    return () => {
      offPlay();
      offMute();
    };
  }, []);

  return null;
}
