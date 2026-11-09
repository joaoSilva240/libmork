"use client";

import React, { useState } from "react";
import { useSearchParams } from "next/navigation";
import { Globe2, MessageSquare, CalendarDays } from "lucide-react";
import CommunityFeed from "./CommunityFeed";
import { CampaignChat } from "@/components/chat/CampaignChat";
import { MasterSessionCalendar } from "@/components/sessions/MasterSessionCalendar";

type MasterCommunityViewProps = {
  currentUser: {
    id: string;
    masterName: string | null;
    masterAvatar: string | null;
    displayName: string | null;
  };
};

export function MasterCommunityView({ currentUser }: MasterCommunityViewProps) {
  const searchParams = useSearchParams();
  const initialTab = searchParams.get("tab") === "chat" ? "chat" : "feed";
  const [activeTab, setActiveTab] = useState<"feed" | "chat" | "calendar">(initialTab);
  const dmGroupId = searchParams.get("dm") ?? undefined;

  return (
    <div className="flex flex-col flex-1 h-full min-h-0 overflow-hidden">
      {/* Barra de Abas da Comunidade */}
      <div className="flex items-center gap-2 border-b border-dominant-border bg-dominant-deep px-4 py-2 shrink-0">
        <button
          type="button"
          onClick={() => setActiveTab("feed")}
          data-testid="tab-community-feed"
          className={`flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-bold transition-colors cursor-pointer ${
            activeTab === "feed"
              ? "bg-accent text-white"
              : "text-secondary-muted hover:text-secondary-pure hover:bg-dominant-container"
          }`}
        >
          <Globe2 className="h-4 w-4" />
          Mural de Conteúdo
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("chat")}
          data-testid="tab-campaign-chat"
          className={`flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-bold transition-colors cursor-pointer ${
            activeTab === "chat"
              ? "bg-accent text-white"
              : "text-secondary-muted hover:text-secondary-pure hover:bg-dominant-container"
          }`}
        >
          <MessageSquare className="h-4 w-4" />
          Grupos de Campanha
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("calendar")}
          data-testid="tab-master-calendar"
          className={`flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-bold transition-colors cursor-pointer ${
            activeTab === "calendar"
              ? "bg-accent text-white"
              : "text-secondary-muted hover:text-secondary-pure hover:bg-dominant-container"
          }`}
        >
          <CalendarDays className="h-4 w-4" />
          Calendário
        </button>
      </div>

      {/* Conteúdo da Aba */}
      <div className="flex-1 min-h-0 flex flex-col overflow-hidden p-3 md:p-4">
        {activeTab === "feed" ? (
          <CommunityFeed currentUser={currentUser} />
        ) : activeTab === "calendar" ? (
          <MasterSessionCalendar />
        ) : (
          <CampaignChat
            currentUser={{
              id: currentUser.id,
              displayName: currentUser.displayName || currentUser.masterName || "Mestre",
              avatarUrl: currentUser.masterAvatar,
            }}
            initialGroupId={dmGroupId}
          />
        )}
      </div>
    </div>
  );
}
