"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  ArrowLeft,
  Send,
  BarChart2,
  Shield,
  Users,
  MessageSquare,
  Plus,
  Menu,
  Settings,
  Package,
} from "lucide-react";
import type {
  ChatGroupSummary,
  ChatMessageDetail,
  SharePayload,
} from "@/lib/server/chat-service";
import { ChatPollBubble } from "./ChatPollBubble";
import { CreatePollModal } from "./CreatePollModal";
import { SharedContentCard } from "./SharedContentCard";
import { ShareDetailModal } from "./ShareDetailModal";
import { SharePickerModal } from "./SharePickerModal";
import type { CreatePollInput, ShareInput } from "@/lib/validators/chat";
import { CONTENT_LABELS } from "@/lib/validators/content";
import type { ContentType } from "@/lib/validators/content";

type ChatUserResult = {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  isGroupMember: boolean;
};

type LibraryMentionItem = {
  id: string;
  name: string;
  contentType: string;
  description: string | null;
  imageUrl: string | null;
};

type MentionEntry =
  | { kind: "user"; user: ChatUserResult }
  | { kind: "item"; item: LibraryMentionItem };

const MENTION_MIN_CHARS = 3;

type ActiveChatRoomProps = {
  group: ChatGroupSummary;
  messages: ChatMessageDetail[];
  currentUserId: string;
  onSendMessage: (content: string) => Promise<void>;
  onCreatePoll: (pollData: CreatePollInput) => Promise<void>;
  onVotePoll: (pollId: string, optionIds: string[]) => Promise<void>;
  onClosePoll: (pollId: string) => Promise<void>;
  onSendShare: (share: ShareInput, text?: string) => Promise<void>;
  onStartDm?: (userId: string) => Promise<void>;
  onOpenSettings: () => void;
  onBack?: () => void;
};

function formatMessageTime(dateString: string): string {
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return "";
  return date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

export function ActiveChatRoom({
  group,
  messages,
  currentUserId,
  onSendMessage,
  onCreatePoll,
  onVotePoll,
  onClosePoll,
  onSendShare,
  onStartDm,
  onOpenSettings,
  onBack,
}: ActiveChatRoomProps) {
  const [inputText, setInputText] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isPollModalOpen, setIsPollModalOpen] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [selectedShare, setSelectedShare] = useState<SharePayload | null>(null);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionResults, setMentionResults] = useState<MentionEntry[]>([]);
  const [mentionIndex, setMentionIndex] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const mentionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const canWrite = group.permissions.canWrite;

  const scrollToBottom = () => {
    if (typeof messagesEndRef.current?.scrollIntoView === "function") {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    return () => {
      if (mentionTimeoutRef.current) clearTimeout(mentionTimeoutRef.current);
    };
  }, []);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = inputText.trim();
    if (!text || isSending || !canWrite) return;

    setIsSending(true);
    try {
      await onSendMessage(text);
      setInputText("");
    } finally {
      setIsSending(false);
    }
  };

  const closeMention = () => {
    if (mentionTimeoutRef.current) clearTimeout(mentionTimeoutRef.current);
    setMentionQuery(null);
    setMentionResults([]);
    setMentionIndex(0);
  };

  const selectMention = (entry: MentionEntry) => {
    const textBefore = inputText.replace(/(^|\s)@\S+$/, "$1").trim();
    setInputText("");
    closeMention();
    if (entry.kind === "user") {
      void onSendShare({ kind: "profile", id: entry.user.userId }, textBefore || "Perfil compartilhado");
    } else {
      void onSendShare(
        {
          kind: "library_item",
          id: entry.item.id,
          contentType: entry.item.contentType as ContentType,
        },
        textBefore || entry.item.name,
      );
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setInputText(value);

    if (mentionTimeoutRef.current) clearTimeout(mentionTimeoutRef.current);

    const match = value.match(new RegExp(`(^|\\s)@(\\S{${MENTION_MIN_CHARS},})$`));
    if (!match) {
      setMentionQuery(null);
      setMentionResults([]);
      return;
    }

    const query = match[2];
    setMentionQuery(query);
    mentionTimeoutRef.current = setTimeout(() => {
      void (async () => {
        try {
          const res = await fetch(
            `/api/chat/search?q=${encodeURIComponent(query)}&groupId=${group.id}`,
            { credentials: "include" },
          );
          const data = await res.json();
          if (res.ok && data.data) {
            const foundUsers = (data.data.users ?? []) as ChatUserResult[];
            const foundItems = (data.data.libraryItems ?? []) as LibraryMentionItem[];
            setMentionResults([
              ...foundUsers.map((user): MentionEntry => ({ kind: "user", user })),
              ...foundItems.map((item): MentionEntry => ({ kind: "item", item })),
            ]);
            setMentionIndex(0);
          }
        } catch {
          // Ignora erro de rede temporário
        }
      })();
    }, 300);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const isMentionOpen = mentionQuery !== null && mentionResults.length > 0;

    if (e.key === "Escape" && isMentionOpen) {
      e.preventDefault();
      closeMention();
      return;
    }

    if (e.key === "Enter" && !e.shiftKey) {
      if (isMentionOpen) {
        e.preventDefault();
        selectMention(mentionResults[mentionIndex] ?? mentionResults[0]);
        return;
      }
      e.preventDefault();
      void handleSend(e);
    }
  };

  const isMaster = group.role === "admin";

  return (
    <div
      data-testid="active-chat-room"
      className="flex flex-col h-full w-full bg-dominant-deep/30 relative overflow-hidden"
    >
      {/* Top Header */}
      <div className="flex items-center justify-between border-b border-secondary-border p-3.5 bg-secondary-card shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              aria-label="Voltar para conversas"
              className="md:hidden p-1 rounded hover:bg-secondary-input text-secondary-muted hover:text-secondary-pure transition-colors cursor-pointer"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
          )}

          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-dominant-deep border border-secondary-border overflow-hidden">
            {group.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={group.avatarUrl} alt={group.name} className="h-full w-full object-cover" />
            ) : (
              <span className="text-sm font-black text-secondary-pure">
                {group.name.charAt(0).toUpperCase()}
              </span>
            )}
          </div>

          <div className="min-w-0">
            <h3 className="text-sm font-bold text-secondary-pure truncate">{group.name}</h3>
            <span className="text-[10px] text-secondary-muted flex items-center gap-1.5">
              <Users className="h-2.5 w-2.5" />
              {group.membersCount} participante{group.membersCount === 1 ? "" : "s"}
              {isMaster && (
                <span className="flex items-center gap-0.5 rounded bg-accent/20 border border-accent/40 px-1 text-[9px] font-bold text-accent">
                  <Shield className="h-2.5 w-2.5" /> Mestre / Admin
                </span>
              )}
            </span>
          </div>
        </div>

        <div className="relative shrink-0">
          <button
            type="button"
            onClick={() => setIsMenuOpen((v) => !v)}
            data-testid="chat-menu-button"
            aria-label="Menu do grupo"
            className="p-2 rounded-lg text-secondary-muted hover:text-secondary-pure hover:bg-secondary-input transition-colors cursor-pointer"
          >
            <Menu className="h-5 w-5" />
          </button>
          {isMenuOpen && (
            <div className="absolute right-0 top-full mt-1 w-44 rounded-lg border border-secondary-border bg-secondary-card shadow-lg z-20">
              <button
                type="button"
                onClick={() => {
                  setIsMenuOpen(false);
                  onOpenSettings();
                }}
                data-testid="chat-menu-settings"
                className="flex w-full items-center gap-2 px-3 py-2 text-xs text-secondary-pure hover:bg-secondary-input rounded-lg cursor-pointer"
              >
                <Settings className="h-3.5 w-3.5" /> Configurações
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Área de Histórico de Mensagens */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3.5">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center text-secondary-muted p-8">
            <MessageSquare className="h-10 w-10 mb-2 opacity-30" />
            <p className="text-xs">Nenhuma mensagem neste grupo ainda.</p>
            <p className="text-[11px] text-secondary-muted/80 mt-1">
              Envie uma mensagem ou crie uma enquete para iniciar a conversa!
            </p>
          </div>
        ) : (
          messages.map((msg) => {
            const isMe = msg.senderId === currentUserId;
            const isPoll = msg.type === "poll" && msg.poll;

            return (
              <div
                key={msg.id}
                data-testid={`chat-message-${msg.id}`}
                className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}
              >
                {/* Nome do Autor e Tag de Mestre */}
                {!isMe && (
                  <div className="flex items-center gap-1.5 mb-1 ml-1 text-[11px] text-secondary-muted">
                    <span className="font-semibold text-secondary-pure">{msg.senderName}</span>
                    {msg.isMaster && (
                      <span className="flex items-center gap-0.5 rounded bg-purple-950/80 border border-purple-700/60 px-1 text-[9px] font-bold text-purple-300">
                        <Shield className="h-2.5 w-2.5" /> Mestre
                      </span>
                    )}
                  </div>
                )}

                {/* Balão de Mensagem */}
                {msg.type === "share" && msg.payload ? (
                  <div
                    className={`relative max-w-[85%] sm:max-w-[70%] rounded-2xl px-2.5 py-2 shadow-sm ${
                      isMe
                        ? "bg-accent/15 border border-accent/30 rounded-tr-none"
                        : "bg-secondary-card border border-secondary-border rounded-tl-none"
                    }`}
                  >
                    {msg.content && (
                      <p className="mb-1.5 px-1 text-xs leading-relaxed text-secondary-pure whitespace-pre-wrap">
                        {msg.content}
                      </p>
                    )}
                    <SharedContentCard
                      payload={msg.payload}
                      onClick={() => setSelectedShare(msg.payload!)}
                    />
                    <div
                      className={`text-[9px] mt-1 text-right select-none text-secondary-muted`}
                    >
                      {formatMessageTime(msg.createdAt)}
                    </div>
                  </div>
                ) : isPoll ? (
                  <ChatPollBubble
                    poll={msg.poll!}
                    isMaster={isMaster}
                    currentUserId={currentUserId}
                    onVote={onVotePoll}
                    onClosePoll={onClosePoll}
                  />
                ) : (
                  <div
                    className={`relative max-w-[85%] sm:max-w-[70%] rounded-2xl px-3.5 py-2 text-xs shadow-sm break-words whitespace-pre-wrap ${
                      isMe
                        ? "bg-accent text-white rounded-tr-none"
                        : "bg-secondary-card border border-secondary-border text-secondary-pure rounded-tl-none"
                    }`}
                  >
                    <p className="leading-relaxed">{msg.content}</p>
                    <div
                      className={`text-[9px] mt-1 text-right select-none ${
                        isMe ? "text-white/70" : "text-secondary-muted"
                      }`}
                    >
                      {formatMessageTime(msg.createdAt)}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Barra Inferior de Envio */}
      <form
        onSubmit={handleSend}
        className="flex items-end gap-2 border-t border-secondary-border p-3 bg-secondary-card shrink-0"
      >
        {group.permissions.canShare && canWrite && (
          <button
            type="button"
            onClick={() => setIsShareModalOpen(true)}
            data-testid="open-share-modal-button"
            title="Compartilhar conteúdo"
            aria-label="Compartilhar conteúdo"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-secondary-border bg-secondary-input text-secondary-muted hover:text-accent hover:border-accent transition-colors cursor-pointer"
          >
            <Plus className="h-4 w-4" />
          </button>
        )}

        {isMaster && (
          <button
            type="button"
            onClick={() => setIsPollModalOpen(true)}
            data-testid="open-poll-modal-button"
            title="Criar nova enquete"
            aria-label="Criar nova enquete"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-secondary-border bg-secondary-input text-secondary-muted hover:text-accent hover:border-accent transition-colors cursor-pointer"
          >
            <BarChart2 className="h-4 w-4" />
          </button>
        )}

        <div className="flex-1 min-w-0 relative">
          {mentionQuery !== null && mentionResults.length > 0 && (
            <div
              data-testid="mention-dropdown"
              className="absolute bottom-full mb-2 left-0 right-0 z-20 flex max-h-64 flex-col gap-0.5 overflow-y-auto rounded-lg border border-secondary-border bg-secondary-card p-1 shadow-lg"
            >
              {mentionResults.map((entry, index) => {
                const prev = mentionResults[index - 1];
                const showLibraryHeader =
                  entry.kind === "item" && (!prev || prev.kind !== "item");
                const isSelected = index === mentionIndex;
                const rowClass = `flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-colors cursor-pointer ${
                  isSelected
                    ? "bg-secondary-input text-secondary-pure"
                    : "text-secondary-muted hover:bg-secondary-input hover:text-secondary-pure"
                }`;

                if (entry.kind === "user") {
                  const user = entry.user;
                  return (
                    <button
                      key={`user-${user.userId}`}
                      type="button"
                      data-testid={`mention-option-${user.userId}`}
                      onClick={() => selectMention(entry)}
                      onMouseEnter={() => setMentionIndex(index)}
                      className={rowClass}
                    >
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center overflow-hidden rounded-full bg-dominant-deep border border-secondary-border">
                        {user.avatarUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={user.avatarUrl} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <span className="text-[10px] font-bold text-accent">
                            {user.displayName.charAt(0).toUpperCase()}
                          </span>
                        )}
                      </span>
                      <span className="truncate font-semibold text-secondary-pure">
                        {user.displayName}
                      </span>
                      {user.isGroupMember && (
                        <span className="ml-auto shrink-0 rounded bg-accent/20 px-1 text-[9px] font-bold text-accent">
                          No grupo
                        </span>
                      )}
                    </button>
                  );
                }

                const item = entry.item;
                return (
                  <React.Fragment key={`item-${item.id}`}>
                    {showLibraryHeader && (
                      <p className="px-2 pt-1 text-[9px] font-bold uppercase tracking-wide text-secondary-muted">
                        Biblioteca global
                      </p>
                    )}
                    <button
                      type="button"
                      data-testid={`mention-option-item-${item.id}`}
                      onClick={() => selectMention(entry)}
                      onMouseEnter={() => setMentionIndex(index)}
                      className={rowClass}
                    >
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center overflow-hidden rounded-md bg-dominant-deep border border-secondary-border">
                        {item.imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={item.imageUrl} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <Package className="h-3.5 w-3.5 text-accent" />
                        )}
                      </span>
                      <span className="truncate font-semibold text-secondary-pure">
                        {item.name}
                      </span>
                      <span className="ml-auto shrink-0 rounded bg-accent/20 px-1 text-[9px] font-bold text-accent">
                        {CONTENT_LABELS[item.contentType as ContentType] ?? item.contentType}
                      </span>
                    </button>
                  </React.Fragment>
                );
              })}
            </div>
          )}
          <textarea
            rows={1}
            placeholder={
              canWrite
                ? "Digite uma mensagem... (Enter para enviar, Shift+Enter para linha)"
                : "Você não tem permissão para escrever neste grupo"
            }
            value={inputText}
            disabled={!canWrite}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            data-testid="chat-input-textarea"
            className="w-full resize-none rounded-xl border border-secondary-border bg-secondary-input px-3 py-2.5 text-xs text-secondary-pure placeholder-secondary-muted focus:outline-none focus:ring-1 focus:ring-accent max-h-32 disabled:cursor-not-allowed disabled:opacity-60"
          />
        </div>

        <button
          type="submit"
          disabled={!inputText.trim() || isSending || !canWrite}
          data-testid="send-message-button"
          aria-label="Enviar mensagem"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent text-white hover:bg-accent-hover transition-colors disabled:opacity-40 cursor-pointer"
        >
          <Send className="h-4 w-4" />
        </button>
      </form>

      {/* Modal de Criação de Enquete */}
      <CreatePollModal
        isOpen={isPollModalOpen}
        onClose={() => setIsPollModalOpen(false)}
        onSubmit={onCreatePoll}
      />

      {/* Modal de Compartilhamento */}
      <SharePickerModal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        onPick={(share, label) => {
          setIsShareModalOpen(false);
          void onSendShare(share, inputText.trim() || label);
          setInputText("");
        }}
      />

      {selectedShare && (
        <ShareDetailModal
          payload={selectedShare}
          currentUserId={currentUserId}
          onClose={() => setSelectedShare(null)}
          onStartDm={
            onStartDm
              ? async (userId) => {
                  setSelectedShare(null);
                  await onStartDm(userId);
                }
              : undefined
          }
        />
      )}
    </div>
  );
}
