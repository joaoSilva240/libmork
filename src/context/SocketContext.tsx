"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useMemo,
  useRef,
} from "react";
import { io, Socket } from "socket.io-client";
import { showDice3D, type Dice3DDie } from "@/lib/dice3d";
import type { CampaignLog, CampaignAsset } from "@/types";
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
  senderRole?: "master" | "player";
  senderSocketId?: string;
  rolledDice?: Dice3DDie[];
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

  // Assets (Issue #61)
  activeAsset: CampaignAsset | null;
  activateCampaignAsset: (payload: { campaignId: string; asset: CampaignAsset }) => void;
  deactivateCampaignAsset: (payload: { campaignId: string }) => void;
  subscribeCampaignAssetActivated: (handler: (asset: CampaignAsset) => void) => () => void;
  subscribeCampaignAssetDeactivated: (handler: () => void) => () => void;
  subscribeCampaignAssetState: (handler: (asset: CampaignAsset | null) => void) => () => void;

  // Configurações de Dados 3D (Issue #74)
  setCampaignDice3DSettings: (
    campaignId: string,
    settings: { dice3dPlayersEnabled: boolean; dice3dMasterEnabled: boolean },
  ) => void;
  broadcastCampaignDice3DSettings: (payload: {
    campaignId: string;
    dice3dPlayersEnabled: boolean;
    dice3dMasterEnabled: boolean;
  }) => void;

  // Chat de Campanha (Issue #62)
  joinChatGroup: (groupId: string) => void;
  leaveChatGroup: (groupId: string) => void;
  sendChatMessage: (payload: Record<string, unknown>) => void;
  sendChatPollVote: (payload: Record<string, unknown>) => void;
  sendChatPollClose: (payload: Record<string, unknown>) => void;
  subscribeChatMessage: (callback: (payload: Record<string, unknown>) => void) => () => void;
  subscribeChatPollUpdated: (callback: (payload: Record<string, unknown>) => void) => () => void;
  subscribeChatPollClosed: (callback: (payload: Record<string, unknown>) => void) => () => void;
  sendChatMemberUpdated: (payload: Record<string, unknown>) => void;
  sendChatMemberRemoved: (payload: Record<string, unknown>) => void;
  subscribeChatMemberUpdated: (callback: (payload: Record<string, unknown>) => void) => () => void;
  subscribeChatMemberRemoved: (callback: (payload: Record<string, unknown>) => void) => () => void;
  // Sessões Agendadas (Issue #63)
  sendSessionPublish: (payload: Record<string, unknown>) => void;
  sendSessionApply: (payload: Record<string, unknown>) => void;
  sendSessionConfirm: (payload: Record<string, unknown>) => void;
  sendSessionCancel: (payload: Record<string, unknown>) => void;
  subscribeSessionPublished: (callback: (payload: Record<string, unknown>) => void) => () => void;
  subscribeSessionApplied: (callback: (payload: Record<string, unknown>) => void) => () => void;
  subscribeSessionConfirmed: (callback: (payload: Record<string, unknown>) => void) => () => void;
  subscribeSessionCancelled: (callback: (payload: Record<string, unknown>) => void) => () => void;
}

const SocketContext = createContext<SocketContextValue | undefined>(undefined);

export function SocketProvider({ children }: { children: React.ReactNode }) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [presenceList, setPresenceList] = useState<PresenceUser[]>([]);
  const [activeAsset, setActiveAsset] = useState<CampaignAsset | null>(null);
  const currentRoleRef = useRef<"master" | "player">("player");
  const campaignDice3DRef = useRef<
    Map<string, { dice3dPlayersEnabled: boolean; dice3dMasterEnabled: boolean }>
  >(new Map());
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
  const assetActivatedSubscribersRef = useRef<Set<(asset: CampaignAsset) => void>>(new Set());
  const assetDeactivatedSubscribersRef = useRef<Set<() => void>>(new Set());
  const assetStateSubscribersRef = useRef<Set<(asset: CampaignAsset | null) => void>>(new Set());

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

      // Issue #74: Remote 3D Dice rendering
      if (
        rollData.rolledDice &&
        rollData.rolledDice.length > 0 &&
        rollData.senderSocketId !== socketInstance.id
      ) {
        const settings = campaignDice3DRef.current.get(rollData.campaignId) ?? {
          dice3dPlayersEnabled: true,
          dice3dMasterEnabled: true,
        };
        const myRole = currentRoleRef.current;
        const senderRole = rollData.senderRole ?? "player";

        if (myRole === "master" && senderRole === "player" && settings.dice3dPlayersEnabled) {
          showDice3D(rollData.rolledDice);
        } else if (myRole === "player" && senderRole === "master" && settings.dice3dMasterEnabled) {
          showDice3D(rollData.rolledDice);
        }
      }
    });

    socketInstance.on(
      "campaign:dice3d-settings-updated",
      (payload: {
        campaignId: string;
        dice3dPlayersEnabled: boolean;
        dice3dMasterEnabled: boolean;
      }) => {
        campaignDice3DRef.current.set(payload.campaignId, {
          dice3dPlayersEnabled: payload.dice3dPlayersEnabled,
          dice3dMasterEnabled: payload.dice3dMasterEnabled,
        });
      },
    );

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

    socketInstance.on(
      "campaign:asset-activated",
      (payload: { campaignId: string; asset: CampaignAsset }) => {
        setActiveAsset(payload.asset);
        assetActivatedSubscribersRef.current.forEach((handler) => handler(payload.asset));
      },
    );

    socketInstance.on("campaign:asset-deactivated", (payload: { campaignId: string }) => {
      setActiveAsset(null);
      assetDeactivatedSubscribersRef.current.forEach((handler) => handler());
    });

    socketInstance.on(
      "campaign:asset-state",
      (payload: { campaignId: string; asset: CampaignAsset | null }) => {
        const asset = payload.asset || null;
        setActiveAsset(asset);
        assetStateSubscribersRef.current.forEach((handler) => handler(asset));
      },
    );

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
      if (data.role) {
        currentRoleRef.current = data.role;
      }
      const currentSocket = socketRef.current || socket;
      if (currentSocket) {
        currentSocket.emit("join-campaign", data);
      }
    },
    [socket],
  );

  const leaveCampaign = useCallback(
    (campaignId: string) => {
      setActiveAsset(null);
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
          senderRole: rollPayload.senderRole ?? currentRoleRef.current,
          timestamp: rollPayload.timestamp || new Date().toISOString(),
        });
      }
    },
    [socket],
  );

  const setCampaignDice3DSettings = useCallback(
    (
      campaignId: string,
      settings: { dice3dPlayersEnabled: boolean; dice3dMasterEnabled: boolean },
    ) => {
      campaignDice3DRef.current.set(campaignId, settings);
    },
    [],
  );

  const broadcastCampaignDice3DSettings = useCallback(
    (payload: {
      campaignId: string;
      dice3dPlayersEnabled: boolean;
      dice3dMasterEnabled: boolean;
    }) => {
      campaignDice3DRef.current.set(payload.campaignId, {
        dice3dPlayersEnabled: payload.dice3dPlayersEnabled,
        dice3dMasterEnabled: payload.dice3dMasterEnabled,
      });
      const currentSocket = socketRef.current || socket;
      if (currentSocket) {
        currentSocket.emit("campaign:dice3d-settings-update", payload);
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
      audioTrackAddSubscribersRef.current.add(callback);
      return () => {
        audioTrackAddSubscribersRef.current.delete(callback);
      };
    },
    [],
  );

  const subscribeAudioTrackPlay = useCallback(
    (callback: (payload: AudioTrackPlayPayload) => void) => {
      audioTrackPlaySubscribersRef.current.add(callback);
      return () => {
        audioTrackPlaySubscribersRef.current.delete(callback);
      };
    },
    [],
  );

  const subscribeAudioTrackPause = useCallback(
    (callback: (payload: AudioTrackPausePayload) => void) => {
      audioTrackPauseSubscribersRef.current.add(callback);
      return () => {
        audioTrackPauseSubscribersRef.current.delete(callback);
      };
    },
    [],
  );

  const subscribeAudioTrackLoop = useCallback(
    (callback: (payload: AudioTrackLoopPayload) => void) => {
      audioTrackLoopSubscribersRef.current.add(callback);
      return () => {
        audioTrackLoopSubscribersRef.current.delete(callback);
      };
    },
    [],
  );

  const subscribeAudioTrackRemove = useCallback(
    (callback: (payload: AudioTrackRemovePayload) => void) => {
      audioTrackRemoveSubscribersRef.current.add(callback);
      return () => {
        audioTrackRemoveSubscribersRef.current.delete(callback);
      };
    },
    [],
  );

  const subscribeAudioTrackPlaylist = useCallback(
    (callback: (payload: AudioTrackPlaylistPayload) => void) => {
      audioTrackPlaylistSubscribersRef.current.add(callback);
      return () => {
        audioTrackPlaylistSubscribersRef.current.delete(callback);
      };
    },
    [],
  );

  const subscribeAudioTrackState = useCallback(
    (callback: (payload: AudioTrackStatePayload) => void) => {
      audioTrackStateSubscribersRef.current.add(callback);
      return () => {
        audioTrackStateSubscribersRef.current.delete(callback);
      };
    },
    [],
  );

  // ============================= Assets (Issue #61) =============================

  const activateCampaignAsset = useCallback(
    (payload: { campaignId: string; asset: CampaignAsset }) => {
      const currentSocket = socketRef.current || socket;
      if (currentSocket) {
        currentSocket.emit("campaign:asset-activate", payload);
      }
    },
    [socket],
  );

  const deactivateCampaignAsset = useCallback(
    (payload: { campaignId: string }) => {
      const currentSocket = socketRef.current || socket;
      if (currentSocket) {
        currentSocket.emit("campaign:asset-deactivate", payload);
      }
    },
    [socket],
  );

  const subscribeCampaignAssetActivated = useCallback((handler: (asset: CampaignAsset) => void) => {
    assetActivatedSubscribersRef.current.add(handler);
    return () => {
      assetActivatedSubscribersRef.current.delete(handler);
    };
  }, []);

  const subscribeCampaignAssetDeactivated = useCallback((handler: () => void) => {
    assetDeactivatedSubscribersRef.current.add(handler);
    return () => {
      assetDeactivatedSubscribersRef.current.delete(handler);
    };
  }, []);

  const subscribeCampaignAssetState = useCallback(
    (handler: (asset: CampaignAsset | null) => void) => {
      assetStateSubscribersRef.current.add(handler);
      return () => {
        assetStateSubscribersRef.current.delete(handler);
      };
    },
    [],
  );

  // ============================= Chat (Issue #62) =============================

  const joinChatGroup = useCallback(
    (groupId: string) => {
      const currentSocket = socketRef.current || socket;
      if (currentSocket) {
        currentSocket.emit("chat:join-group", { groupId });
      }
    },
    [socket],
  );

  const leaveChatGroup = useCallback(
    (groupId: string) => {
      const currentSocket = socketRef.current || socket;
      if (currentSocket) {
        currentSocket.emit("chat:leave-group", { groupId });
      }
    },
    [socket],
  );

  const sendChatMessage = useCallback(
    (payload: Record<string, unknown>) => {
      const currentSocket = socketRef.current || socket;
      if (currentSocket) {
        currentSocket.emit("chat:send-message", payload);
      }
    },
    [socket],
  );

  const sendChatPollVote = useCallback(
    (payload: Record<string, unknown>) => {
      const currentSocket = socketRef.current || socket;
      if (currentSocket) {
        currentSocket.emit("chat:poll-vote", payload);
      }
    },
    [socket],
  );

  const sendChatPollClose = useCallback(
    (payload: Record<string, unknown>) => {
      const currentSocket = socketRef.current || socket;
      if (currentSocket) {
        currentSocket.emit("chat:poll-close", payload);
      }
    },
    [socket],
  );

  const subscribeChatMessage = useCallback(
    (callback: (payload: Record<string, unknown>) => void) => {
      const currentSocket = socketRef.current || socket;
      if (currentSocket) {
        currentSocket.on("chat:new-message", callback);
      }
      return () => {
        const activeSocket = socketRef.current || socket;
        if (activeSocket) {
          activeSocket.off("chat:new-message", callback);
        }
      };
    },
    [socket],
  );

  const subscribeChatPollUpdated = useCallback(
    (callback: (payload: Record<string, unknown>) => void) => {
      const currentSocket = socketRef.current || socket;
      if (currentSocket) {
        currentSocket.on("chat:poll-updated", callback);
      }
      return () => {
        const activeSocket = socketRef.current || socket;
        if (activeSocket) {
          activeSocket.off("chat:poll-updated", callback);
        }
      };
    },
    [socket],
  );

  const subscribeChatPollClosed = useCallback(
    (callback: (payload: Record<string, unknown>) => void) => {
      const currentSocket = socketRef.current || socket;
      if (currentSocket) {
        currentSocket.on("chat:poll-closed", callback);
      }
      return () => {
        const activeSocket = socketRef.current || socket;
        if (activeSocket) {
          activeSocket.off("chat:poll-closed", callback);
        }
      };
    },
    [socket],
  );

  const sendChatMemberUpdated = useCallback(
    (payload: Record<string, unknown>) => {
      const currentSocket = socketRef.current || socket;
      if (currentSocket) {
        currentSocket.emit("chat:member-updated", payload);
      }
    },
    [socket],
  );

  const sendChatMemberRemoved = useCallback(
    (payload: Record<string, unknown>) => {
      const currentSocket = socketRef.current || socket;
      if (currentSocket) {
        currentSocket.emit("chat:member-removed", payload);
      }
    },
    [socket],
  );

  const subscribeChatMemberUpdated = useCallback(
    (callback: (payload: Record<string, unknown>) => void) => {
      const currentSocket = socketRef.current || socket;
      if (currentSocket) {
        currentSocket.on("chat:member-updated", callback);
      }
      return () => {
        const activeSocket = socketRef.current || socket;
        if (activeSocket) {
          activeSocket.off("chat:member-updated", callback);
        }
      };
    },
    [socket],
  );

  const subscribeChatMemberRemoved = useCallback(
    (callback: (payload: Record<string, unknown>) => void) => {
      const currentSocket = socketRef.current || socket;
      if (currentSocket) {
        currentSocket.on("chat:member-removed", callback);
      }
      return () => {
        const activeSocket = socketRef.current || socket;
        if (activeSocket) {
          activeSocket.off("chat:member-removed", callback);
        }
      };
    },
    [socket],
  );

  // ============================= Sessões (Issue #63) =============================

  const sendSessionPublish = useCallback(
    (payload: Record<string, unknown>) => {
      const currentSocket = socketRef.current || socket;
      if (currentSocket) {
        currentSocket.emit("session:publish", payload);
      }
    },
    [socket],
  );

  const sendSessionApply = useCallback(
    (payload: Record<string, unknown>) => {
      const currentSocket = socketRef.current || socket;
      if (currentSocket) {
        currentSocket.emit("session:apply", payload);
      }
    },
    [socket],
  );

  const sendSessionConfirm = useCallback(
    (payload: Record<string, unknown>) => {
      const currentSocket = socketRef.current || socket;
      if (currentSocket) {
        currentSocket.emit("session:confirm", payload);
      }
    },
    [socket],
  );

  const sendSessionCancel = useCallback(
    (payload: Record<string, unknown>) => {
      const currentSocket = socketRef.current || socket;
      if (currentSocket) {
        currentSocket.emit("session:cancel", payload);
      }
    },
    [socket],
  );

  const subscribeSessionPublished = useCallback(
    (callback: (payload: Record<string, unknown>) => void) => {
      const currentSocket = socketRef.current || socket;
      if (currentSocket) {
        currentSocket.on("session:published", callback);
      }
      return () => {
        const activeSocket = socketRef.current || socket;
        if (activeSocket) {
          activeSocket.off("session:published", callback);
        }
      };
    },
    [socket],
  );

  const subscribeSessionApplied = useCallback(
    (callback: (payload: Record<string, unknown>) => void) => {
      const currentSocket = socketRef.current || socket;
      if (currentSocket) {
        currentSocket.on("session:applied", callback);
      }
      return () => {
        const activeSocket = socketRef.current || socket;
        if (activeSocket) {
          activeSocket.off("session:applied", callback);
        }
      };
    },
    [socket],
  );

  const subscribeSessionConfirmed = useCallback(
    (callback: (payload: Record<string, unknown>) => void) => {
      const currentSocket = socketRef.current || socket;
      if (currentSocket) {
        currentSocket.on("session:confirmed", callback);
      }
      return () => {
        const activeSocket = socketRef.current || socket;
        if (activeSocket) {
          activeSocket.off("session:confirmed", callback);
        }
      };
    },
    [socket],
  );

  const subscribeSessionCancelled = useCallback(
    (callback: (payload: Record<string, unknown>) => void) => {
      const currentSocket = socketRef.current || socket;
      if (currentSocket) {
        currentSocket.on("session:cancelled", callback);
      }
      return () => {
        const activeSocket = socketRef.current || socket;
        if (activeSocket) {
          activeSocket.off("session:cancelled", callback);
        }
      };
    },
    [socket],
  );

  const contextValue = useMemo<SocketContextValue>(
    () => ({
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
      activeAsset,
      activateCampaignAsset,
      deactivateCampaignAsset,
      subscribeCampaignAssetActivated,
      subscribeCampaignAssetDeactivated,
      subscribeCampaignAssetState,
      setCampaignDice3DSettings,
      broadcastCampaignDice3DSettings,
      joinChatGroup,
      leaveChatGroup,
      sendChatMessage,
      sendChatPollVote,
      sendChatPollClose,
      subscribeChatMessage,
      subscribeChatPollUpdated,
      subscribeChatPollClosed,
      sendChatMemberUpdated,
      sendChatMemberRemoved,
      subscribeChatMemberUpdated,
      subscribeChatMemberRemoved,
      sendSessionPublish,
      sendSessionApply,
      sendSessionConfirm,
      sendSessionCancel,
      subscribeSessionPublished,
      subscribeSessionApplied,
      subscribeSessionConfirmed,
      subscribeSessionCancelled,
    }),
    [
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
      activeAsset,
      activateCampaignAsset,
      deactivateCampaignAsset,
      subscribeCampaignAssetActivated,
      subscribeCampaignAssetDeactivated,
      subscribeCampaignAssetState,
      setCampaignDice3DSettings,
      broadcastCampaignDice3DSettings,
      joinChatGroup,
      leaveChatGroup,
      sendChatMessage,
      sendChatPollVote,
      sendChatPollClose,
      subscribeChatMessage,
      subscribeChatPollUpdated,
      subscribeChatPollClosed,
      sendChatMemberUpdated,
      sendChatMemberRemoved,
      subscribeChatMemberUpdated,
      subscribeChatMemberRemoved,
      sendSessionPublish,
      sendSessionApply,
      sendSessionConfirm,
      sendSessionCancel,
      subscribeSessionPublished,
      subscribeSessionApplied,
      subscribeSessionConfirmed,
      subscribeSessionCancelled,
    ],
  );

  return <SocketContext.Provider value={contextValue}>{children}</SocketContext.Provider>;
}

export function useSocket() {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error("useSocket deve ser usado dentro de um SocketProvider");
  }
  return context;
}
