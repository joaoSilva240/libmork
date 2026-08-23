"use client";

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";
import { io, Socket } from "socket.io-client";

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
  timestamp?: string;
}

interface SocketContextValue {
  socket: Socket | null;
  isConnected: boolean;
  presenceList: PresenceUser[];
  joinCampaign: (data: { campaignId: string; user?: { id: string; name: string }; actorId?: string; role?: "master" | "player" }) => void;
  leaveCampaign: (campaignId: string) => void;
  updateActorStatus: (payload: ActorStatusPayload) => void;
  rollDice: (rollPayload: RollDataPayload) => void;
  subscribeActorStatus: (handler: (payload: ActorStatusPayload) => void) => () => void;
  subscribeDiceRoll: (handler: (roll: RollDataPayload) => void) => () => void;
}

const SocketContext = createContext<SocketContextValue | undefined>(undefined);

export function SocketProvider({ children }: { children: React.ReactNode }) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [presenceList, setPresenceList] = useState<PresenceUser[]>([]);
  const socketRef = useRef<Socket | null>(null);
  const statusSubscribersRef = useRef<Set<(payload: ActorStatusPayload) => void>>(new Set());
  const rollSubscribersRef = useRef<Set<(roll: RollDataPayload) => void>>(new Set());

  useEffect(() => {
    // Inicializa a conexão Socket.IO na mesma origem
    const socketInstance = io({
      path: "/api/socket/io",
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
        subscribeActorStatus,
        subscribeDiceRoll,
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
