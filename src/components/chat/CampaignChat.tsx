"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { ChatGroupList } from "./ChatGroupList";
import { ActiveChatRoom } from "./ActiveChatRoom";
import { ChatSettingsPanel } from "./ChatSettingsPanel";
import { Spinner } from "@/components/ui/Spinner";
import { useSocket } from "@/context/SocketContext";
import type { ChatGroupSummary, ChatMessageDetail, PollDetail } from "@/lib/server/chat-service";
import type { CreatePollInput, ShareInput } from "@/lib/validators/chat";
import { MessageSquare } from "lucide-react";

type CampaignChatProps = {
  currentUser: {
    id: string;
    displayName: string | null;
    avatarUrl?: string | null;
  };
  initialGroupId?: string;
};

export function CampaignChat({ currentUser, initialGroupId }: CampaignChatProps) {
  const [groups, setGroups] = useState<ChatGroupSummary[]>([]);
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessageDetail[]>([]);
  const [isLoadingGroups, setIsLoadingGroups] = useState(true);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isMobileRoomOpen, setIsMobileRoomOpen] = useState(false);
  const [settingsGroupId, setSettingsGroupId] = useState<string | null>(null);

  const {
    joinChatGroup,
    leaveChatGroup,
    sendChatMessage,
    sendChatPollVote,
    sendChatPollClose,
    sendChatMemberUpdated,
    sendChatMemberRemoved,
    subscribeChatMessage,
    subscribeChatPollUpdated,
    subscribeChatPollClosed,
    subscribeChatMemberUpdated,
    subscribeChatMemberRemoved,
  } = useSocket();

  const activeGroupRef = useRef<string | null>(null);
  const currentUserRef = useRef(currentUser);

  useEffect(() => {
    activeGroupRef.current = activeGroupId;
  }, [activeGroupId]);

  useEffect(() => {
    currentUserRef.current = currentUser;
  }, [currentUser]);

  // Carrega lista de grupos
  const loadGroups = useCallback(async () => {
    try {
      const res = await fetch("/api/chat/groups", { credentials: "include" });
      const data = await res.json();
      if (res.ok && data.data) {
        setGroups(data.data);
        if (!activeGroupId && data.data.length > 0) {
          const preferred =
            initialGroupId &&
            data.data.some((g: ChatGroupSummary) => g.id === initialGroupId)
              ? initialGroupId
              : data.data[0].id;
          setActiveGroupId(preferred);
          if (initialGroupId === preferred) setIsMobileRoomOpen(true);
        }
      }
    } catch {
      // Ignora erro de rede temporário
    } finally {
      setIsLoadingGroups(false);
    }
  }, [activeGroupId, initialGroupId]);

  // Carrega mensagens do grupo ativo
  const loadMessages = useCallback(async (groupId: string) => {
    setIsLoadingMessages(true);
    try {
      const res = await fetch(`/api/chat/groups/${groupId}/messages`, {
        credentials: "include",
      });
      const data = await res.json();
      if (res.ok && data.data) {
        setMessages(data.data);
      }

      // Marca grupo como lido
      void fetch(`/api/chat/groups/${groupId}/read`, {
        method: "POST",
        credentials: "include",
      });

      // Zera contador de não lidas localmente
      setGroups((prev) => prev.map((g) => (g.id === groupId ? { ...g, unreadCount: 0 } : g)));
    } catch {
      // Ignora erro temporário
    } finally {
      setIsLoadingMessages(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadGroups();
  }, [loadGroups]);

  // Alterna grupo ativo e escuta eventos via Socket
  useEffect(() => {
    if (!activeGroupId) return;

    joinChatGroup(activeGroupId);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadMessages(activeGroupId);

    return () => {
      leaveChatGroup(activeGroupId);
    };
  }, [activeGroupId, joinChatGroup, leaveChatGroup, loadMessages]);

  // Subscrições Socket.IO em tempo real
  useEffect(() => {
    const unsubMsg = subscribeChatMessage((raw) => {
      const newMsg = raw as unknown as ChatMessageDetail;
      // Se a mensagem for do grupo ativo
      if (newMsg.groupId === activeGroupRef.current) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === newMsg.id)) return prev;
          return [...prev, newMsg];
        });
        // Marca como lido
        void fetch(`/api/chat/groups/${newMsg.groupId}/read`, {
          method: "POST",
          credentials: "include",
        });
      }

      // Atualiza o snippet e o timestamp na lista lateral de grupos
      setGroups((prev) =>
        prev.map((g) => {
          if (g.id === newMsg.groupId) {
            const isCurrent = g.id === activeGroupRef.current;
            return {
              ...g,
              unreadCount: isCurrent ? 0 : g.unreadCount + 1,
              lastMessage: {
                id: newMsg.id,
                content: newMsg.content,
                type: newMsg.type,
                createdAt: newMsg.createdAt,
                senderName: newMsg.senderName,
              },
              updatedAt: newMsg.createdAt,
            };
          }
          return g;
        }),
      );
    });

    const unsubPollVote = subscribeChatPollUpdated((raw) => {
      const payload = raw as unknown as { groupId: string; poll: PollDetail };
      if (payload.groupId === activeGroupRef.current) {
        setMessages((prev) =>
          prev.map((m) =>
            m.type === "poll" && m.poll?.id === payload.poll.id ? { ...m, poll: payload.poll } : m,
          ),
        );
      }
    });

    const unsubPollClose = subscribeChatPollClosed((raw) => {
      const payload = raw as unknown as { groupId: string; poll: PollDetail };
      if (payload.groupId === activeGroupRef.current) {
        setMessages((prev) =>
          prev.map((m) =>
            m.type === "poll" && m.poll?.id === payload.poll.id ? { ...m, poll: payload.poll } : m,
          ),
        );
      }
    });

    const unsubMemberUpdated = subscribeChatMemberUpdated((raw) => {
      const payload = raw as unknown as {
        groupId: string;
        userId: string;
        canRead: boolean;
        canWrite: boolean;
        canShare: boolean;
      };
      if (payload.userId === currentUserRef.current.id) {
        setGroups((prev) =>
          prev.map((g) =>
            g.id === payload.groupId
              ? {
                  ...g,
                  permissions: {
                    canRead: payload.canRead,
                    canWrite: payload.canWrite,
                    canShare: payload.canShare,
                  },
                }
              : g,
          ),
        );
      }
    });

    const unsubMemberRemoved = subscribeChatMemberRemoved((raw) => {
      const payload = raw as unknown as {
        groupId: string;
        userId: string;
        reason: "group" | "campaign";
      };
      if (payload.userId === currentUserRef.current.id) {
        setGroups((prev) => prev.filter((g) => g.id !== payload.groupId));
        if (activeGroupRef.current === payload.groupId) {
          setActiveGroupId(null);
          setMessages([]);
          setIsMobileRoomOpen(false);
        }
      } else {
        setGroups((prev) =>
          prev.map((g) =>
            g.id === payload.groupId
              ? { ...g, membersCount: Math.max(0, g.membersCount - 1) }
              : g,
          ),
        );
      }
    });

    return () => {
      unsubMsg();
      unsubPollVote();
      unsubPollClose();
      unsubMemberUpdated();
      unsubMemberRemoved();
    };
  }, [
    subscribeChatMessage,
    subscribeChatPollUpdated,
    subscribeChatPollClosed,
    subscribeChatMemberUpdated,
    subscribeChatMemberRemoved,
  ]);

  const handleSelectGroup = (groupId: string) => {
    setActiveGroupId(groupId);
    setIsMobileRoomOpen(true);
  };

  const handleSendMessage = async (content: string) => {
    if (!activeGroupId) return;
    const res = await fetch(`/api/chat/groups/${activeGroupId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content, type: "text" }),
      credentials: "include",
    });

    const data = await res.json();
    if (res.ok && data.data) {
      setMessages((prev) => [...prev, data.data]);
      sendChatMessage(data.data);
    }
  };

  const handleSendShare = async (share: ShareInput, text?: string) => {
    if (!activeGroupId) return;
    const res = await fetch(`/api/chat/groups/${activeGroupId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: text || "Conteúdo compartilhado", type: "share", share }),
      credentials: "include",
    });
    const data = await res.json();
    if (res.ok && data.data) {
      setMessages((prev) => [...prev, data.data]);
      sendChatMessage(data.data);
    }
  };

  const handleStartDm = async (otherUserId: string) => {
    const res = await fetch("/api/chat/dm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: otherUserId }),
      credentials: "include",
    });
    const data = await res.json();
    if (res.ok && data.data) {
      await loadGroups();
      setActiveGroupId(data.data.id);
      setIsMobileRoomOpen(true);
    }
  };

  const handleCreatePoll = async (pollInput: CreatePollInput) => {
    if (!activeGroupId) return;
    const res = await fetch(`/api/chat/groups/${activeGroupId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content: pollInput.title,
        type: "poll",
        poll: pollInput,
      }),
      credentials: "include",
    });

    const data = await res.json();
    if (res.ok && data.data) {
      setMessages((prev) => [...prev, data.data]);
      sendChatMessage(data.data);
    }
  };

  const handleVotePoll = async (pollId: string, optionIds: string[]) => {
    if (!activeGroupId) return;
    const res = await fetch(`/api/chat/polls/${pollId}/vote`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ optionIds }),
      credentials: "include",
    });

    const data = await res.json();
    if (res.ok && data.data) {
      const updatedPoll: PollDetail = data.data;
      setMessages((prev) =>
        prev.map((m) =>
          m.type === "poll" && m.poll?.id === pollId ? { ...m, poll: updatedPoll } : m,
        ),
      );
      sendChatPollVote({ groupId: activeGroupId, poll: updatedPoll });
    }
  };

  const handleClosePoll = async (pollId: string) => {
    if (!activeGroupId) return;
    const res = await fetch(`/api/chat/polls/${pollId}/close`, {
      method: "PATCH",
      credentials: "include",
    });

    const data = await res.json();
    if (res.ok && data.data) {
      const closedPoll: PollDetail = data.data;
      setMessages((prev) =>
        prev.map((m) =>
          m.type === "poll" && m.poll?.id === pollId ? { ...m, poll: closedPoll } : m,
        ),
      );
      sendChatPollClose({ groupId: activeGroupId, poll: closedPoll });
    }
  };

  const activeGroup = groups.find((g) => g.id === activeGroupId) || null;
  const settingsGroup = groups.find((g) => g.id === settingsGroupId) ?? null;

  if (isLoadingGroups) {
    return (
      <div className="flex h-full w-full items-center justify-center p-8">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div
      data-testid="campaign-chat-container"
      className="flex h-full w-full overflow-hidden border border-secondary-border rounded-xl bg-secondary-card shadow-sm"
    >
      {/* Coluna Esquerda: Lista de Grupos */}
      <div
        className={`h-full w-full md:w-80 lg:w-96 md:shrink-0 ${
          isMobileRoomOpen ? "hidden md:flex" : "flex"
        }`}
      >
        <ChatGroupList
          groups={groups}
          activeGroupId={activeGroupId}
          onSelectGroup={handleSelectGroup}
          currentUser={{
            displayName: currentUser.displayName,
            avatarUrl: currentUser.avatarUrl,
          }}
        />
      </div>

      {/* Coluna Direita: Conversa Ativa */}
      <div className={`h-full flex-1 min-w-0 ${!isMobileRoomOpen ? "hidden md:flex" : "flex"}`}>
        {activeGroup ? (
          isLoadingMessages ? (
            <div className="flex h-full w-full items-center justify-center">
              <Spinner size="md" />
            </div>
          ) : (
            <ActiveChatRoom
              group={activeGroup}
              messages={messages}
              currentUserId={currentUser.id}
              onSendMessage={handleSendMessage}
              onCreatePoll={handleCreatePoll}
              onVotePoll={handleVotePoll}
              onClosePoll={handleClosePoll}
              onSendShare={handleSendShare}
              onStartDm={handleStartDm}
              onOpenSettings={() => setSettingsGroupId(activeGroupId)}
              onBack={() => setIsMobileRoomOpen(false)}
            />
          )
        ) : (
          <div className="flex flex-col items-center justify-center h-full w-full text-center p-8 text-secondary-muted">
            <MessageSquare className="h-12 w-12 mb-3 opacity-30" />
            <h4 className="text-sm font-bold text-secondary-pure mb-1">
              Nenhuma conversa selecionada
            </h4>
            <p className="text-xs max-w-sm">
              Selecione um grupo de campanha à esquerda para visualizar mensagens e enquetes.
            </p>
          </div>
        )}
      </div>

      {settingsGroup && (
        <ChatSettingsPanel
          group={settingsGroup}
          currentUserId={currentUser.id}
          onClose={() => setSettingsGroupId(null)}
          onPermissionsChanged={(userId, perms) => {
            sendChatMemberUpdated({ groupId: settingsGroup.id, userId, ...perms });
            if (userId === currentUser.id) {
              setGroups((prev) =>
                prev.map((g) => (g.id === settingsGroup.id ? { ...g, permissions: perms } : g)),
              );
            }
          }}
          onMemberRemoved={(userId, reason) => {
            sendChatMemberRemoved({ groupId: settingsGroup.id, userId, reason });
            setGroups((prev) =>
              prev.map((g) =>
                g.id === settingsGroup.id
                  ? { ...g, membersCount: Math.max(0, g.membersCount - 1) }
                  : g,
              ),
            );
          }}
        />
      )}
    </div>
  );
}
