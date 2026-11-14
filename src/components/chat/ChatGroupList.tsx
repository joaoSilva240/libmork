"use client";

import React, { useState } from "react";
import { Search, Shield, MessageSquare, Users } from "lucide-react";
import type { ChatGroupSummary } from "@/lib/server/chat-service";

type ChatGroupListProps = {
  groups: ChatGroupSummary[];
  activeGroupId: string | null;
  onSelectGroup: (groupId: string) => void;
  currentUser?: {
    displayName?: string | null;
    avatarUrl?: string | null;
  };
};

function formatGroupTimestamp(timestamp: string): string {
  const date = new Date(timestamp);
  if (isNaN(date.getTime())) return "";

  const now = new Date();
  const isToday =
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear();

  if (isToday) {
    return date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  }

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday =
    date.getDate() === yesterday.getDate() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getFullYear() === yesterday.getFullYear();

  if (isYesterday) {
    return "Ontem";
  }

  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

export function ChatGroupList({
  groups,
  activeGroupId,
  onSelectGroup,
  currentUser,
}: ChatGroupListProps) {
  const [search, setSearch] = useState("");

  const filteredGroups = groups.filter((g) => g.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div
      data-testid="chat-group-list"
      className="flex flex-col h-full w-full border-r border-secondary-border bg-secondary-card"
    >
      {/* Top Header */}
      <div className="flex items-center justify-between border-b border-secondary-border px-4 py-3.5 bg-dominant-deep/40 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent/15 border border-accent/30 font-bold text-accent">
            {currentUser?.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={currentUser.avatarUrl}
                alt={currentUser.displayName || "Avatar"}
                className="h-full w-full object-cover rounded-xl"
              />
            ) : (
              <span>{(currentUser?.displayName || "U").charAt(0).toUpperCase()}</span>
            )}
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-secondary-pure truncate">
              {currentUser?.displayName || "Minhas Conversas"}
            </h3>
            <span className="text-[10px] text-secondary-muted flex items-center gap-1">
              <MessageSquare className="h-2.5 w-2.5 text-accent" /> Grupos de Campanha
            </span>
          </div>
        </div>
        <span className="rounded-full border border-secondary-border bg-dominant-deep px-2 py-0.5 text-[10px] font-bold text-secondary-muted">
          {groups.length}
        </span>
      </div>

      {/* Busca */}
      <div className="p-3 border-b border-secondary-border/60 shrink-0">
        <div className="relative flex items-center">
          <Search className="absolute left-3 h-3.5 w-3.5 text-secondary-muted pointer-events-none" />
          <input
            type="text"
            placeholder="Pesquisar conversas..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-secondary-border bg-secondary-input pl-8 pr-3 py-2 text-xs text-secondary-pure placeholder-secondary-muted focus:outline-none focus:ring-1 focus:ring-accent"
          />
        </div>
      </div>

      {/* Lista de Grupos */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {filteredGroups.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-8 text-center text-secondary-muted">
            <Users className="h-8 w-8 mb-2 opacity-40" />
            <p className="text-xs">
              {search
                ? "Nenhuma conversa encontrada."
                : "Você ainda não possui grupos de campanha."}
            </p>
          </div>
        ) : (
          filteredGroups.map((group) => {
            const isActive = group.id === activeGroupId;
            const lastMsg = group.lastMessage;

            let snippet = "Nenhuma mensagem ainda";
            if (lastMsg) {
              if (lastMsg.type === "poll") {
                snippet = `📊 Enquete: ${lastMsg.content}`;
              } else {
                snippet = `${lastMsg.senderName}: ${lastMsg.content}`;
              }
            }

            return (
              <button
                key={group.id}
                type="button"
                onClick={() => onSelectGroup(group.id)}
                data-testid={`chat-group-item-${group.id}`}
                className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-all cursor-pointer border ${
                  isActive
                    ? "bg-accent/15 border-accent/40 shadow-sm"
                    : "border-transparent hover:bg-secondary-input/60 hover:border-secondary-border/50"
                }`}
              >
                {/* Avatar da Campanha */}
                <div className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-dominant-deep border border-secondary-border overflow-hidden">
                  {group.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={group.avatarUrl}
                      alt={group.name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span className="text-sm font-black text-secondary-pure">
                      {group.name.charAt(0).toUpperCase()}
                    </span>
                  )}
                </div>

                {/* Dados do Grupo */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1.5 mb-1">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="text-xs font-bold text-secondary-pure truncate">
                        {group.name}
                      </span>
                      {group.role === "admin" && (
                        <span className="flex items-center gap-0.5 rounded-md bg-accent/20 border border-accent/40 px-1.5 py-0.5 text-[9px] font-bold text-accent shrink-0">
                          <Shield className="h-2.5 w-2.5" />
                          Mestre
                        </span>
                      )}
                    </div>
                    {lastMsg && (
                      <span className="text-[10px] text-secondary-muted shrink-0">
                        {formatGroupTimestamp(lastMsg.createdAt)}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[11px] text-secondary-muted truncate leading-tight">
                      {snippet}
                    </p>
                    {group.unreadCount > 0 && (
                      <span
                        data-testid={`unread-badge-${group.id}`}
                        className="flex h-4 min-w-[16px] items-center justify-center rounded-full bg-accent px-1.5 text-[9px] font-bold text-white shrink-0"
                      >
                        {group.unreadCount}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
