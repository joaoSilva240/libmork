"use client";

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";
import { io, Socket } from "socket.io-client";

// 3-second loading delay constant (3000ms)
export const DICE_ROLL_LOADING_DELAY = 3000;

export interface PresenceUser {
  userId: string;
  userName: string;
  actorId?: string | null;
  role: "master" | "player";
  online: boolean;
  updatedAt: string;
}

export interface ActorStatusPayload {
  campaignId: string;
  actorId: string;
  currentHp?: number;
  maxHp?: number;
  currentMana?: number;
  maxMana?: number;
  currentXp?: number;
  level?: number;
  conditions?: string[];
  notes?: string;
}

export interface RollDataPayload {
  campaignId: string;
  actorId?: string;
  actorName: string;
  rollType: string; // "ataque", "atributo", "pericia", "livre"
  formula: string; // ex: "1d20 + 3" ou "2d20"
  result: number;
  diceDetail?: string; // ex: "Rolou [15] + 3 = 18"
  isManual?: boolean;
  damage?: number;
  damageRoll?: string;
  damageTaken?: number;
  hit?: boolean;
  details?: string;
  actionId?: string;
  timestamp?: string;
}

import type { CombatSessionState, PendingDefenseReaction } from "@/lib/engine";
import type { DuelSessionState } from "@/lib/engine/duel";

export interface DefenseReactionRequestPayload extends PendingDefenseReaction {
  campaignId: string;
}

export interface DefenseReactionResponsePayload {
  campaignId: string;
  reactionId: string;
  targetId: string;
  reaction: "dodge" | "block";
}

export interface DuelInviteRequestPayload {
  campaignId: string;
  challengerId: string;
  challengerName: string;
  targetCharacterId: string;
  targetCharacterName: string;
  permanentResults: boolean;
}

export interface DuelInviteResponsePayload {
  campaignId: string;
  challengerId: string;
  targetCharacterId: string;
  accepted: boolean;
  permanentResults: boolean;
}

interface SocketContextValue {
  socket: Socket | null;
  isConnected: boolean;
  presenceList: PresenceUser[];
  joinCampaign: (data: { campaignId: string; user?: { id: string; name: string }; actorId?: string; role?: "master" | "player" }) => void;
  leaveCampaign: (campaignId: string) => void;
  updateActorStatus: (payload: ActorStatusPayload) => void;
  rollDice: (rollPayload: RollDataPayload) => void;
  updateCombatState: (combatState: CombatSessionState) => void;
  requestInitiativeRoll: (campaignId: string) => void;
  requestInitiativeRollDelayed: (campaignId: string, options?: { onComplete?: () => void }) => void;
  requestDefenseReaction: (payload: DefenseReactionRequestPayload) => void;
  respondDefenseReaction: (payload: DefenseReactionResponsePayload) => void;
  requestDuelInvite: (payload: DuelInviteRequestPayload) => void;
  respondDuelInvite: (payload: DuelInviteResponsePayload) => void;
  updateDuelState: (duelState: DuelSessionState) => void;
  finishDuel: (payload: { campaignId: string; duelId: string; winnerId?: string }) => void;
  subscribeActorStatus: (handler: (payload: ActorStatusPayload) => void) => () => void;
  subscribeDiceRoll: (handler: (roll: RollDataPayload) => void) => () => void;
  subscribeCombatState: (handler: (state: CombatSessionState) => void) => () => void;
  subscribeInitiativeRequest: (handler: (payload: { campaignId: string }) => void) => () => void;
  subscribeDefenseRequest: (handler: (payload: DefenseReactionRequestPayload) => void) => () => void;
  subscribeDefenseResponse: (handler: (payload: DefenseReactionResponsePayload) => void) => () => void;
  subscribeDuelInvite: (handler: (payload: DuelInviteRequestPayload) => void) => () => void;
  subscribeDuelResponse: (handler: (payload: DuelInviteResponsePayload) => void) => () => void;
  subscribeDuelState: (handler: (state: DuelSessionState) => void) => () => void;
  subscribeDuelFinish: (handler: (payload: { campaignId: string; duelId: string; winnerId?: string }) => void) => () => void;
}

const SocketContext = createContext<SocketContextValue | undefined>(undefined);

export function SocketProvider({ children }: { children: React.ReactNode }) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [presenceList, setPresenceList] = useState<PresenceUser[]>([]);
  const socketRef = useRef<Socket | null>(null);
  const statusSubscribersRef = useRef<Set<(payload: ActorStatusPayload) => void>>(new Set());
  const rollSubscribersRef = useRef<Set<(roll: RollDataPayload) => void>>(new Set());
  const combatSubscribersRef = useRef<Set<(state: CombatSessionState) => void>>(new Set());
  const initRequestSubscribersRef = useRef<Set<(payload: { campaignId: string }) => void>>(new Set());
  const defenseRequestSubscribersRef = useRef<Set<(payload: DefenseReactionRequestPayload) => void>>(new Set());
  const defenseResponseSubscribersRef = useRef<Set<(payload: DefenseReactionResponsePayload) => void>>(new Set());
  const duelInviteSubscribersRef = useRef<Set<(payload: DuelInviteRequestPayload) => void>>(new Set());
  const duelResponseSubscribersRef = useRef<Set<(payload: DuelInviteResponsePayload) => void>>(new Set());
  const duelStateSubscribersRef = useRef<Set<(state: DuelSessionState) => void>>(new Set());
  const duelFinishSubscribersRef = useRef<Set<(payload: { campaignId: string; duelId: string; winnerId?: string }) => void>>(new Set());

  useEffect(() => {
    // Inicializa a conexão Socket.IO na mesma origem
    const socketInstance = io({
      path: "/api/socket/io",
      addTrailingSlash: false,
      transports: ["websocket", "polling"],
      autoConnect: true,
      withCredentials: true,
      timeout: 5000,
    });

    socketRef.current = socketInstance;

    socketInstance.on("connect", () => {
      setIsConnected(true);
      setSocket(socketInstance);
    });

    socketInstance.on("disconnect", () => {
      setIsConnected(false);
    });

    socketInstance.on("connect_error", () => {
      // Se falhar o servidor customizado WebSocket (ex: rodando via next dev padrão),
      // forçamos o estado local online para a interface não ficar travada em "Conectando..."
      setIsConnected(true);
    });

    socketInstance.on("presence-update", ({ presence }: { presence: PresenceUser[] }) => {
      setPresenceList(presence || []);
    });

    socketInstance.on("actor-status-updated", (payload: ActorStatusPayload) => {
      statusSubscribersRef.current.forEach((handler) => handler(payload));
    });

    socketInstance.on("dice-rolled", (rollData: RollDataPayload) => {
      rollSubscribersRef.current.forEach((handler) => handler(rollData));
    });

    socketInstance.on("combat-state-updated", (state: CombatSessionState) => {
      combatSubscribersRef.current.forEach((handler) => handler(state));
    });

    socketInstance.on("initiative-roll-requested", (payload: { campaignId: string }) => {
      initRequestSubscribersRef.current.forEach((handler) => handler(payload));
    });

    socketInstance.on("defense-reaction-requested", (payload: DefenseReactionRequestPayload) => {
      defenseRequestSubscribersRef.current.forEach((handler) => handler(payload));
    });

    socketInstance.on("defense-reaction-responded", (payload: DefenseReactionResponsePayload) => {
      defenseResponseSubscribersRef.current.forEach((handler) => handler(payload));
    });

    socketInstance.on("duel-invite-requested", (payload: DuelInviteRequestPayload) => {
      duelInviteSubscribersRef.current.forEach((handler) => handler(payload));
    });

    socketInstance.on("duel-invite-responded", (payload: DuelInviteResponsePayload) => {
      duelResponseSubscribersRef.current.forEach((handler) => handler(payload));
    });

    socketInstance.on("duel-state-updated", (state: DuelSessionState) => {
      duelStateSubscribersRef.current.forEach((handler) => handler(state));
    });

    socketInstance.on("duel-finished", (payload: { campaignId: string; duelId: string; winnerId?: string }) => {
      duelFinishSubscribersRef.current.forEach((handler) => handler(payload));
    });

    return () => {
      socketInstance.disconnect();
      socketRef.current = null;
    };
  }, []);

  const joinCampaign = useCallback(
    (data: { campaignId: string; user?: { id: string; name: string }; actorId?: string; role?: "master" | "player" }) => {
      const currentSocket = socketRef.current || socket;
      if (currentSocket) {
        currentSocket.emit("join-campaign", data);
      }
    },
    [socket]
  );

  const leaveCampaign = useCallback(
    (campaignId: string) => {
      const currentSocket = socketRef.current || socket;
      if (currentSocket) {
        currentSocket.emit("leave-campaign", { campaignId });
      }
    },
    [socket]
  );

  const updateActorStatus = useCallback(
    (payload: ActorStatusPayload) => {
      const currentSocket = socketRef.current || socket;
      if (currentSocket) {
        currentSocket.emit("update-actor-status", payload);
      }
    },
    [socket]
  );

  const rollDice = useCallback(
    (rollPayload: RollDataPayload) => {
      const currentSocket = socketRef.current || socket;
      if (currentSocket) {
        currentSocket.emit("roll-dice", {
          ...rollPayload,
          timestamp: rollPayload.timestamp || new Date().toISOString(),
        });
      }
    },
    [socket]
  );

  const requestInitiativeRollDelayed = useCallback(
    (campaignId: string, options?: { onComplete?: () => void }) => {
      setTimeout(() => {
        const currentSocket = socketRef.current || socket;
        if (currentSocket) {
          currentSocket.emit("request-initiative-roll", { campaignId });
        }
        options?.onComplete?.();
      }, DICE_ROLL_LOADING_DELAY);
    },
    [socket]
  );

  const updateCombatState = useCallback(
    (combatState: CombatSessionState) => {
      const currentSocket = socketRef.current || socket;
      if (currentSocket) {
        currentSocket.emit("update-combat-state", combatState);
      }
    },
    [socket]
  );

  const requestInitiativeRoll = useCallback(
    (campaignId: string) => {
      const currentSocket = socketRef.current || socket;
      if (currentSocket) {
        currentSocket.emit("request-initiative-roll", { campaignId });
      }
    },
    [socket]
  );

  const requestDefenseReaction = useCallback(
    (payload: DefenseReactionRequestPayload) => {
      const currentSocket = socketRef.current || socket;
      if (currentSocket) {
        currentSocket.emit("request-defense-reaction", payload);
      }
    },
    [socket]
  );

  const respondDefenseReaction = useCallback(
    (payload: DefenseReactionResponsePayload) => {
      const currentSocket = socketRef.current || socket;
      if (currentSocket) {
        currentSocket.emit("respond-defense-reaction", payload);
      }
    },
    [socket]
  );

  const requestDuelInvite = useCallback(
    (payload: DuelInviteRequestPayload) => {
      const currentSocket = socketRef.current || socket;
      if (currentSocket) {
        currentSocket.emit("request-duel-invite", payload);
      }
    },
    [socket]
  );

  const respondDuelInvite = useCallback(
    (payload: DuelInviteResponsePayload) => {
      const currentSocket = socketRef.current || socket;
      if (currentSocket) {
        currentSocket.emit("respond-duel-invite", payload);
      }
    },
    [socket]
  );

  const updateDuelState = useCallback(
    (duelState: DuelSessionState) => {
      const currentSocket = socketRef.current || socket;
      if (currentSocket) {
        currentSocket.emit("update-duel-state", duelState);
      }
    },
    [socket]
  );

  const finishDuel = useCallback(
    (payload: { campaignId: string; duelId: string; winnerId?: string }) => {
      const currentSocket = socketRef.current || socket;
      if (currentSocket) {
        currentSocket.emit("finish-duel", payload);
      }
    },
    [socket]
  );

  const subscribeActorStatus = useCallback((handler: (payload: ActorStatusPayload) => void) => {
    statusSubscribersRef.current.add(handler);
    return () => {
      statusSubscribersRef.current.delete(handler);
    };
  }, []);

  const subscribeDiceRoll = useCallback((handler: (roll: RollDataPayload) => void) => {
    rollSubscribersRef.current.add(handler);
    return () => {
      rollSubscribersRef.current.delete(handler);
    };
  }, []);

  const subscribeCombatState = useCallback((handler: (state: CombatSessionState) => void) => {
    combatSubscribersRef.current.add(handler);
    return () => {
      combatSubscribersRef.current.delete(handler);
    };
  }, []);

  const subscribeInitiativeRequest = useCallback((handler: (payload: { campaignId: string }) => void) => {
    initRequestSubscribersRef.current.add(handler);
    return () => {
      initRequestSubscribersRef.current.delete(handler);
    };
  }, []);

  const subscribeDefenseRequest = useCallback((handler: (payload: DefenseReactionRequestPayload) => void) => {
    defenseRequestSubscribersRef.current.add(handler);
    return () => {
      defenseRequestSubscribersRef.current.delete(handler);
    };
  }, []);

  const subscribeDefenseResponse = useCallback((handler: (payload: DefenseReactionResponsePayload) => void) => {
    defenseResponseSubscribersRef.current.add(handler);
    return () => {
      defenseResponseSubscribersRef.current.delete(handler);
    };
  }, []);

  const subscribeDuelInvite = useCallback((handler: (payload: DuelInviteRequestPayload) => void) => {
    duelInviteSubscribersRef.current.add(handler);
    return () => {
      duelInviteSubscribersRef.current.delete(handler);
    };
  }, []);

  const subscribeDuelResponse = useCallback((handler: (payload: DuelInviteResponsePayload) => void) => {
    duelResponseSubscribersRef.current.add(handler);
    return () => {
      duelResponseSubscribersRef.current.delete(handler);
    };
  }, []);

  const subscribeDuelState = useCallback((handler: (state: DuelSessionState) => void) => {
    duelStateSubscribersRef.current.add(handler);
    return () => {
      duelStateSubscribersRef.current.delete(handler);
    };
  }, []);

  const subscribeDuelFinish = useCallback((handler: (payload: { campaignId: string; duelId: string; winnerId?: string }) => void) => {
    duelFinishSubscribersRef.current.add(handler);
    return () => {
      duelFinishSubscribersRef.current.delete(handler);
    };
  }, []);

  return (
    <SocketContext.Provider
      value={{
        socket,
        isConnected,
        presenceList,
        joinCampaign,
        leaveCampaign,
        updateActorStatus,
        rollDice,
        updateCombatState,
        requestInitiativeRoll,
        requestInitiativeRollDelayed,
        requestDefenseReaction,
        respondDefenseReaction,
        requestDuelInvite,
        respondDuelInvite,
        updateDuelState,
        finishDuel,
        subscribeActorStatus,
        subscribeDiceRoll,
        subscribeCombatState,
        subscribeInitiativeRequest,
        subscribeDefenseRequest,
        subscribeDefenseResponse,
        subscribeDuelInvite,
        subscribeDuelResponse,
        subscribeDuelState,
        subscribeDuelFinish,
      }}
    >
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket() {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error("useSocket deve ser usado dentro de um SocketProvider");
  }
  return context;
}
