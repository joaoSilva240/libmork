"use client";

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";
import { io, Socket } from "socket.io-client";
import type { CampaignLog } from "@/types";
import type {
  AudioTrackAddPayload,
  AudioTrackPlayPayload,
  AudioTrackPausePayload,
  AudioTrackLoopPayload,
  AudioTrackRemovePayload,
  AudioTrackPlaylistPayload,
  AudioTrackStatePayload,
} from "@/lib/audio/jukebox-protocol";
import { AUDIO_EVENTS } from "@/lib/audio/jukebox-protocol";

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

export interface CampaignLogPayload {
  campaignId: string;
  log: CampaignLog;
}

export interface CharacterInventoryChangePayload {
  campaignId: string;
  characterId: string;
  changeType:
    | "item-added"
    | "item-removed"
    | "spell-added"
    | "spell-removed"
    | "skill-added"
    | "skill-removed";
  contentType: "items" | "spells" | "skills";
  contentId: string;
  junctionId?: string;
  content?: Record<string, unknown>;
}

export interface CampaignInviteCreatedPayload {
  campaignId: string;
  invite: {
    id: string;
    userId: string;
    createdAt: string;
  };
  player: {
    id: string;
    displayName?: string;
    email?: string;
  };
}

export interface CampaignInviteRevokedPayload {
  campaignId: string;
  inviteId: string;
  userId: string;
}

interface SocketContextValue {
  socket: Socket | null;
  isConnected: boolean;
  presenceList: PresenceUser[];
  joinCampaign: (data: {
    campaignId: string;
    user?: { id: string; name: string };
    actorId?: string;
    role?: "master" | "player";
  }) => void;
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
  subscribeDefenseRequest: (
    handler: (payload: DefenseReactionRequestPayload) => void,
  ) => () => void;
  subscribeDefenseResponse: (
    handler: (payload: DefenseReactionResponsePayload) => void,
  ) => () => void;
  subscribeDuelInvite: (handler: (payload: DuelInviteRequestPayload) => void) => () => void;
  subscribeDuelResponse: (handler: (payload: DuelInviteResponsePayload) => void) => () => void;
  subscribeDuelState: (handler: (state: DuelSessionState) => void) => () => void;
  subscribeDuelFinish: (
    handler: (payload: { campaignId: string; duelId: string; winnerId?: string }) => void,
  ) => () => void;

  // Logs
  broadcastCampaignLog: (payload: CampaignLogPayload) => void;
  broadcastCampaignLogUpdate: (payload: CampaignLogPayload) => void;
  subscribeCampaignLogCreated: (callback: (payload: CampaignLogPayload) => void) => () => void;
  subscribeCampaignLogUpdated: (callback: (payload: CampaignLogPayload) => void) => () => void;

  // Inventário
  notifyCharacterInventoryChange: (payload: CharacterInventoryChangePayload) => void;
  subscribeCharacterInventoryChange: (
    callback: (payload: CharacterInventoryChangePayload) => void,
  ) => () => void;

  // Convites
  notifyCampaignInviteCreated: (payload: CampaignInviteCreatedPayload) => void;
  notifyCampaignInviteRevoked: (payload: CampaignInviteRevokedPayload) => void;
  subscribeCampaignInviteCreated: (
    callback: (payload: CampaignInviteCreatedPayload) => void,
  ) => () => void;
  subscribeCampaignInviteRevoked: (
    callback: (payload: CampaignInviteRevokedPayload) => void,
  ) => () => void;

  // Jukebox (Issue #60)
  emitAudioTrackAdd: (payload: AudioTrackAddPayload) => void;
  emitAudioTrackPlay: (payload: AudioTrackPlayPayload) => void;
  emitAudioTrackPause: (payload: AudioTrackPausePayload) => void;
  emitAudioTrackLoop: (payload: AudioTrackLoopPayload) => void;
  emitAudioTrackRemove: (payload: AudioTrackRemovePayload) => void;
  emitAudioTrackPlaylist: (payload: AudioTrackPlaylistPayload) => void;
  subscribeAudioTrackAdd: (callback: (payload: AudioTrackAddPayload) => void) => () => void;
  subscribeAudioTrackPlay: (callback: (payload: AudioTrackPlayPayload) => void) => () => void;
  subscribeAudioTrackPause: (callback: (payload: AudioTrackPausePayload) => void) => () => void;
  subscribeAudioTrackLoop: (callback: (payload: AudioTrackLoopPayload) => void) => () => void;
  subscribeAudioTrackRemove: (callback: (payload: AudioTrackRemovePayload) => void) => () => void;
  subscribeAudioTrackPlaylist: (
    callback: (payload: AudioTrackPlaylistPayload) => void,
  ) => () => void;
  subscribeAudioTrackState: (callback: (payload: AudioTrackStatePayload) => void) => () => void;
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
  const initRequestSubscribersRef = useRef<Set<(payload: { campaignId: string }) => void>>(
    new Set(),
  );
  const defenseRequestSubscribersRef = useRef<
    Set<(payload: DefenseReactionRequestPayload) => void>
  >(new Set());
  const defenseResponseSubscribersRef = useRef<
    Set<(payload: DefenseReactionResponsePayload) => void>
  >(new Set());
  const duelInviteSubscribersRef = useRef<Set<(payload: DuelInviteRequestPayload) => void>>(
    new Set(),
  );
  const duelResponseSubscribersRef = useRef<Set<(payload: DuelInviteResponsePayload) => void>>(
    new Set(),
  );
  const duelStateSubscribersRef = useRef<Set<(state: DuelSessionState) => void>>(new Set());
  const duelFinishSubscribersRef = useRef<
    Set<(payload: { campaignId: string; duelId: string; winnerId?: string }) => void>
  >(new Set());
  const audioTrackAddSubscribersRef = useRef<Set<(payload: AudioTrackAddPayload) => void>>(
    new Set(),
  );
  const audioTrackPlaySubscribersRef = useRef<Set<(payload: AudioTrackPlayPayload) => void>>(
    new Set(),
  );
  const audioTrackPauseSubscribersRef = useRef<Set<(payload: AudioTrackPausePayload) => void>>(
    new Set(),
  );
  const audioTrackLoopSubscribersRef = useRef<Set<(payload: AudioTrackLoopPayload) => void>>(
    new Set(),
  );
  const audioTrackRemoveSubscribersRef = useRef<Set<(payload: AudioTrackRemovePayload) => void>>(
    new Set(),
  );
  const audioTrackPlaylistSubscribersRef = useRef<
    Set<(payload: AudioTrackPlaylistPayload) => void>
  >(new Set());
  const audioTrackStateSubscribersRef = useRef<Set<(payload: AudioTrackStatePayload) => void>>(
    new Set(),
  );

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

    socketInstance.on(
      "duel-finished",
      (payload: { campaignId: string; duelId: string; winnerId?: string }) => {
        duelFinishSubscribersRef.current.forEach((handler) => handler(payload));
      },
    );

    socketInstance.on(AUDIO_EVENTS.TRACK_ADD, (payload: AudioTrackAddPayload) => {
      audioTrackAddSubscribersRef.current.forEach((handler) => handler(payload));
    });

    socketInstance.on(AUDIO_EVENTS.TRACK_PLAY, (payload: AudioTrackPlayPayload) => {
      audioTrackPlaySubscribersRef.current.forEach((handler) => handler(payload));
    });

    socketInstance.on(AUDIO_EVENTS.TRACK_PAUSE, (payload: AudioTrackPausePayload) => {
      audioTrackPauseSubscribersRef.current.forEach((handler) => handler(payload));
    });

    socketInstance.on(AUDIO_EVENTS.TRACK_LOOP, (payload: AudioTrackLoopPayload) => {
      audioTrackLoopSubscribersRef.current.forEach((handler) => handler(payload));
    });

    socketInstance.on(AUDIO_EVENTS.TRACK_REMOVE, (payload: AudioTrackRemovePayload) => {
      audioTrackRemoveSubscribersRef.current.forEach((handler) => handler(payload));
    });

    socketInstance.on(AUDIO_EVENTS.TRACK_PLAYLIST, (payload: AudioTrackPlaylistPayload) => {
      audioTrackPlaylistSubscribersRef.current.forEach((handler) => handler(payload));
    });

    socketInstance.on(AUDIO_EVENTS.TRACK_STATE, (payload: AudioTrackStatePayload) => {
      audioTrackStateSubscribersRef.current.forEach((handler) => handler(payload));
    });

    return () => {
      socketInstance.disconnect();
      socketRef.current = null;
    };
  }, []);

  const joinCampaign = useCallback(
    (data: {
      campaignId: string;
      user?: { id: string; name: string };
      actorId?: string;
      role?: "master" | "player";
    }) => {
      const currentSocket = socketRef.current || socket;
      if (currentSocket) {
        currentSocket.emit("join-campaign", data);
      }
    },
    [socket],
  );

  const leaveCampaign = useCallback(
    (campaignId: string) => {
      const currentSocket = socketRef.current || socket;
      if (currentSocket) {
        currentSocket.emit("leave-campaign", { campaignId });
      }
    },
    [socket],
  );

  const updateActorStatus = useCallback(
    (payload: ActorStatusPayload) => {
      const currentSocket = socketRef.current || socket;
      if (currentSocket) {
        currentSocket.emit("update-actor-status", payload);
      }
    },
    [socket],
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
    [socket],
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
    [socket],
  );

  const updateCombatState = useCallback(
    (combatState: CombatSessionState) => {
      const currentSocket = socketRef.current || socket;
      if (currentSocket) {
        currentSocket.emit("update-combat-state", combatState);
      }
    },
    [socket],
  );

  const requestInitiativeRoll = useCallback(
    (campaignId: string) => {
      const currentSocket = socketRef.current || socket;
      if (currentSocket) {
        currentSocket.emit("request-initiative-roll", { campaignId });
      }
    },
    [socket],
  );

  const requestDefenseReaction = useCallback(
    (payload: DefenseReactionRequestPayload) => {
      const currentSocket = socketRef.current || socket;
      if (currentSocket) {
        currentSocket.emit("request-defense-reaction", payload);
      }
    },
    [socket],
  );

  const respondDefenseReaction = useCallback(
    (payload: DefenseReactionResponsePayload) => {
      const currentSocket = socketRef.current || socket;
      if (currentSocket) {
        currentSocket.emit("respond-defense-reaction", payload);
      }
    },
    [socket],
  );

  const requestDuelInvite = useCallback(
    (payload: DuelInviteRequestPayload) => {
      const currentSocket = socketRef.current || socket;
      if (currentSocket) {
        currentSocket.emit("request-duel-invite", payload);
      }
    },
    [socket],
  );

  const respondDuelInvite = useCallback(
    (payload: DuelInviteResponsePayload) => {
      const currentSocket = socketRef.current || socket;
      if (currentSocket) {
        currentSocket.emit("respond-duel-invite", payload);
      }
    },
    [socket],
  );

  const updateDuelState = useCallback(
    (duelState: DuelSessionState) => {
      const currentSocket = socketRef.current || socket;
      if (currentSocket) {
        currentSocket.emit("update-duel-state", duelState);
      }
    },
    [socket],
  );

  const finishDuel = useCallback(
    (payload: { campaignId: string; duelId: string; winnerId?: string }) => {
      const currentSocket = socketRef.current || socket;
      if (currentSocket) {
        currentSocket.emit("finish-duel", payload);
      }
    },
    [socket],
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

  const subscribeInitiativeRequest = useCallback(
    (handler: (payload: { campaignId: string }) => void) => {
      initRequestSubscribersRef.current.add(handler);
      return () => {
        initRequestSubscribersRef.current.delete(handler);
      };
    },
    [],
  );

  const subscribeDefenseRequest = useCallback(
    (handler: (payload: DefenseReactionRequestPayload) => void) => {
      defenseRequestSubscribersRef.current.add(handler);
      return () => {
        defenseRequestSubscribersRef.current.delete(handler);
      };
    },
    [],
  );

  const subscribeDefenseResponse = useCallback(
    (handler: (payload: DefenseReactionResponsePayload) => void) => {
      defenseResponseSubscribersRef.current.add(handler);
      return () => {
        defenseResponseSubscribersRef.current.delete(handler);
      };
    },
    [],
  );

  const subscribeDuelInvite = useCallback(
    (handler: (payload: DuelInviteRequestPayload) => void) => {
      duelInviteSubscribersRef.current.add(handler);
      return () => {
        duelInviteSubscribersRef.current.delete(handler);
      };
    },
    [],
  );

  const subscribeDuelResponse = useCallback(
    (handler: (payload: DuelInviteResponsePayload) => void) => {
      duelResponseSubscribersRef.current.add(handler);
      return () => {
        duelResponseSubscribersRef.current.delete(handler);
      };
    },
    [],
  );

  const subscribeDuelState = useCallback((handler: (state: DuelSessionState) => void) => {
    duelStateSubscribersRef.current.add(handler);
    return () => {
      duelStateSubscribersRef.current.delete(handler);
    };
  }, []);

  const subscribeDuelFinish = useCallback(
    (handler: (payload: { campaignId: string; duelId: string; winnerId?: string }) => void) => {
      duelFinishSubscribersRef.current.add(handler);
      return () => {
        duelFinishSubscribersRef.current.delete(handler);
      };
    },
    [],
  );

  const broadcastCampaignLog = useCallback(
    (payload: CampaignLogPayload) => {
      const currentSocket = socketRef.current || socket;
      if (currentSocket) {
        currentSocket.emit("create-campaign-log", payload);
      }
    },
    [socket],
  );

  const broadcastCampaignLogUpdate = useCallback(
    (payload: CampaignLogPayload) => {
      const currentSocket = socketRef.current || socket;
      if (currentSocket) {
        currentSocket.emit("update-campaign-log", payload);
      }
    },
    [socket],
  );

  const notifyCharacterInventoryChange = useCallback(
    (payload: CharacterInventoryChangePayload) => {
      const currentSocket = socketRef.current || socket;
      if (currentSocket) {
        currentSocket.emit("notify-character-inventory-change", payload);
      }
    },
    [socket],
  );

  const notifyCampaignInviteCreated = useCallback(
    (payload: CampaignInviteCreatedPayload) => {
      const currentSocket = socketRef.current || socket;
      if (currentSocket) {
        currentSocket.emit("notify-campaign-invite-created", payload);
      }
    },
    [socket],
  );

  const notifyCampaignInviteRevoked = useCallback(
    (payload: CampaignInviteRevokedPayload) => {
      const currentSocket = socketRef.current || socket;
      if (currentSocket) {
        currentSocket.emit("notify-campaign-invite-revoked", payload);
      }
    },
    [socket],
  );

  const subscribeCampaignLogCreated = useCallback(
    (callback: (payload: CampaignLogPayload) => void) => {
      const currentSocket = socketRef.current || socket;
      if (currentSocket) {
        currentSocket.on("campaign-log-created", callback);
      }
      return () => {
        const activeSocket = socketRef.current || socket;
        if (activeSocket) {
          activeSocket.off("campaign-log-created", callback);
        }
      };
    },
    [socket],
  );

  const subscribeCampaignLogUpdated = useCallback(
    (callback: (payload: CampaignLogPayload) => void) => {
      const currentSocket = socketRef.current || socket;
      if (currentSocket) {
        currentSocket.on("campaign-log-updated", callback);
      }
      return () => {
        const activeSocket = socketRef.current || socket;
        if (activeSocket) {
          activeSocket.off("campaign-log-updated", callback);
        }
      };
    },
    [socket],
  );

  const subscribeCharacterInventoryChange = useCallback(
    (callback: (payload: CharacterInventoryChangePayload) => void) => {
      const currentSocket = socketRef.current || socket;
      if (currentSocket) {
        currentSocket.on("character-inventory-changed", callback);
      }
      return () => {
        const activeSocket = socketRef.current || socket;
        if (activeSocket) {
          activeSocket.off("character-inventory-changed", callback);
        }
      };
    },
    [socket],
  );

  const subscribeCampaignInviteCreated = useCallback(
    (callback: (payload: CampaignInviteCreatedPayload) => void) => {
      const currentSocket = socketRef.current || socket;
      if (currentSocket) {
        currentSocket.on("campaign-invite-created", callback);
      }
      return () => {
        const activeSocket = socketRef.current || socket;
        if (activeSocket) {
          activeSocket.off("campaign-invite-created", callback);
        }
      };
    },
    [socket],
  );

  const subscribeCampaignInviteRevoked = useCallback(
    (callback: (payload: CampaignInviteRevokedPayload) => void) => {
      const currentSocket = socketRef.current || socket;
      if (currentSocket) {
        currentSocket.on("campaign-invite-revoked", callback);
      }
      return () => {
        const activeSocket = socketRef.current || socket;
        if (activeSocket) {
          activeSocket.off("campaign-invite-revoked", callback);
        }
      };
    },
    [socket],
  );

  // ============================= Jukebox Emitters =============================

  const emitAudioTrackAdd = useCallback(
    (payload: AudioTrackAddPayload) => {
      const currentSocket = socketRef.current || socket;
      if (currentSocket) {
        currentSocket.emit(AUDIO_EVENTS.TRACK_ADD, payload);
      }
    },
    [socket],
  );

  const emitAudioTrackPlay = useCallback(
    (payload: AudioTrackPlayPayload) => {
      const currentSocket = socketRef.current || socket;
      if (currentSocket) {
        currentSocket.emit(AUDIO_EVENTS.TRACK_PLAY, payload);
      }
    },
    [socket],
  );

  const emitAudioTrackPause = useCallback(
    (payload: AudioTrackPausePayload) => {
      const currentSocket = socketRef.current || socket;
      if (currentSocket) {
        currentSocket.emit(AUDIO_EVENTS.TRACK_PAUSE, payload);
      }
    },
    [socket],
  );

  const emitAudioTrackLoop = useCallback(
    (payload: AudioTrackLoopPayload) => {
      const currentSocket = socketRef.current || socket;
      if (currentSocket) {
        currentSocket.emit(AUDIO_EVENTS.TRACK_LOOP, payload);
      }
    },
    [socket],
  );

  const emitAudioTrackRemove = useCallback(
    (payload: AudioTrackRemovePayload) => {
      const currentSocket = socketRef.current || socket;
      if (currentSocket) {
        currentSocket.emit(AUDIO_EVENTS.TRACK_REMOVE, payload);
      }
    },
    [socket],
  );

  const emitAudioTrackPlaylist = useCallback(
    (payload: AudioTrackPlaylistPayload) => {
      const currentSocket = socketRef.current || socket;
      if (currentSocket) {
        currentSocket.emit(AUDIO_EVENTS.TRACK_PLAYLIST, payload);
      }
    },
    [socket],
  );

  // ============================= Jukebox Subscribers =============================

  const subscribeAudioTrackAdd = useCallback(
    (callback: (payload: AudioTrackAddPayload) => void) => {
      const currentSocket = socketRef.current || socket;
      if (currentSocket) {
        currentSocket.on(AUDIO_EVENTS.TRACK_ADD, callback);
      }
      return () => {
        const activeSocket = socketRef.current || socket;
        if (activeSocket) {
          activeSocket.off(AUDIO_EVENTS.TRACK_ADD, callback);
        }
      };
    },
    [socket],
  );

  const subscribeAudioTrackPlay = useCallback(
    (callback: (payload: AudioTrackPlayPayload) => void) => {
      const currentSocket = socketRef.current || socket;
      if (currentSocket) {
        currentSocket.on(AUDIO_EVENTS.TRACK_PLAY, callback);
      }
      return () => {
        const activeSocket = socketRef.current || socket;
        if (activeSocket) {
          activeSocket.off(AUDIO_EVENTS.TRACK_PLAY, callback);
        }
      };
    },
    [socket],
  );

  const subscribeAudioTrackPause = useCallback(
    (callback: (payload: AudioTrackPausePayload) => void) => {
      const currentSocket = socketRef.current || socket;
      if (currentSocket) {
        currentSocket.on(AUDIO_EVENTS.TRACK_PAUSE, callback);
      }
      return () => {
        const activeSocket = socketRef.current || socket;
        if (activeSocket) {
          activeSocket.off(AUDIO_EVENTS.TRACK_PAUSE, callback);
        }
      };
    },
    [socket],
  );

  const subscribeAudioTrackLoop = useCallback(
    (callback: (payload: AudioTrackLoopPayload) => void) => {
      const currentSocket = socketRef.current || socket;
      if (currentSocket) {
        currentSocket.on(AUDIO_EVENTS.TRACK_LOOP, callback);
      }
      return () => {
        const activeSocket = socketRef.current || socket;
        if (activeSocket) {
          activeSocket.off(AUDIO_EVENTS.TRACK_LOOP, callback);
        }
      };
    },
    [socket],
  );

  const subscribeAudioTrackRemove = useCallback(
    (callback: (payload: AudioTrackRemovePayload) => void) => {
      const currentSocket = socketRef.current || socket;
      if (currentSocket) {
        currentSocket.on(AUDIO_EVENTS.TRACK_REMOVE, callback);
      }
      return () => {
        const activeSocket = socketRef.current || socket;
        if (activeSocket) {
          activeSocket.off(AUDIO_EVENTS.TRACK_REMOVE, callback);
        }
      };
    },
    [socket],
  );

  const subscribeAudioTrackPlaylist = useCallback(
    (callback: (payload: AudioTrackPlaylistPayload) => void) => {
      const currentSocket = socketRef.current || socket;
      if (currentSocket) {
        currentSocket.on(AUDIO_EVENTS.TRACK_PLAYLIST, callback);
      }
      return () => {
        const activeSocket = socketRef.current || socket;
        if (activeSocket) {
          activeSocket.off(AUDIO_EVENTS.TRACK_PLAYLIST, callback);
        }
      };
    },
    [socket],
  );

  const subscribeAudioTrackState = useCallback(
    (callback: (payload: AudioTrackStatePayload) => void) => {
      const currentSocket = socketRef.current || socket;
      if (currentSocket) {
        currentSocket.on(AUDIO_EVENTS.TRACK_STATE, callback);
      }
      return () => {
        const activeSocket = socketRef.current || socket;
        if (activeSocket) {
          activeSocket.off(AUDIO_EVENTS.TRACK_STATE, callback);
        }
      };
    },
    [socket],
  );

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
        broadcastCampaignLog,
        broadcastCampaignLogUpdate,
        subscribeCampaignLogCreated,
        subscribeCampaignLogUpdated,
        notifyCharacterInventoryChange,
        subscribeCharacterInventoryChange,
        notifyCampaignInviteCreated,
        notifyCampaignInviteRevoked,
        subscribeCampaignInviteCreated,
        subscribeCampaignInviteRevoked,
        emitAudioTrackAdd,
        emitAudioTrackPlay,
        emitAudioTrackPause,
        emitAudioTrackLoop,
        emitAudioTrackRemove,
        emitAudioTrackPlaylist,
        subscribeAudioTrackAdd,
        subscribeAudioTrackPlay,
        subscribeAudioTrackPause,
        subscribeAudioTrackLoop,
        subscribeAudioTrackRemove,
        subscribeAudioTrackPlaylist,
        subscribeAudioTrackState,
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
