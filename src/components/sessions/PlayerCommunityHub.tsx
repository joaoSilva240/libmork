"use client";

import React, { useCallback, useEffect, useState } from "react";
import { MessageSquare, CalendarDays, Maximize2, Minimize2 } from "lucide-react";
import { CampaignChat } from "@/components/chat/CampaignChat";
import { Toast } from "@/components/ui/Toast";
import { useSocket } from "@/context/SocketContext";
import { PlayerSessionCalendar } from "./PlayerSessionCalendar";

type HubTab = "groups" | "calendar";
type LocalToast = { id: number; message: string; type: "success" | "info" | "error" };

const STORAGE_KEY = "libmork.communityHubTab";

type PlayerCommunityHubProps = {
  currentUser: {
    id: string;
    displayName: string;
    avatarUrl?: string | null;
  };
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
};

function readInitialTab(): HubTab {
  if (typeof window === "undefined") return "groups";
  return window.localStorage.getItem(STORAGE_KEY) === "calendar" ? "calendar" : "groups";
}

export function PlayerCommunityHub({
  currentUser,
  isFullscreen = false,
  onToggleFullscreen,
}: PlayerCommunityHubProps) {
  const { joinCampaign, leaveCampaign, subscribeSessionConfirmed, subscribeSessionCancelled } =
    useSocket();

  const [tab, setTab] = useState<HubTab>(readInitialTab);
  const [refreshKey, setRefreshKey] = useState(0);
  const [toasts, setToasts] = useState<LocalToast[]>([]);

  const pushToast = useCallback((message: string, type: LocalToast["type"] = "info") => {
    setToasts((prev) => [...prev, { id: Date.now() + Math.random(), message, type }]);
  }, []);

  const removeToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // Entra nas salas de campanha do jogador para receber eventos de sessão em tempo real
  useEffect(() => {
    let cancelled = false;
    let joinedIds: string[] = [];
    fetch("/api/player/campaigns", { credentials: "include" })
      .then((res) => res.json())
      .then((data) => {
        if (cancelled || !data.success) return;
        joinedIds = (data.data as { id: string }[]).map((c) => c.id);
        joinedIds.forEach((campaignId) => joinCampaign({ campaignId, role: "player" }));
      })
      .catch(() => {
        /* sem realtime se a busca falhar */
      });
    return () => {
      cancelled = true;
      joinedIds.forEach((campaignId) => leaveCampaign(campaignId));
    };
  }, [joinCampaign, leaveCampaign]);

  useEffect(() => {
    const offConfirmed = subscribeSessionConfirmed(() => {
      pushToast("Uma sessão foi confirmada", "success");
      setRefreshKey((k) => k + 1);
    });
    const offCancelled = subscribeSessionCancelled(() => {
      pushToast("Uma sessão foi cancelada", "info");
      setRefreshKey((k) => k + 1);
    });
    return () => {
      offConfirmed();
      offCancelled();
    };
  }, [subscribeSessionConfirmed, subscribeSessionCancelled, pushToast]);

  const handleTabChange = useCallback((next: HubTab) => {
    setTab(next);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, next);
    }
  }, []);

  const tabClass = (active: boolean) =>
    `flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-bold transition-all cursor-pointer ${
      active
        ? "bg-accent text-white shadow-sm"
        : "text-secondary-muted hover:text-secondary-pure hover:bg-dominant-container"
    }`;

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-secondary-border bg-secondary-card shadow-lg">
      <div className="flex shrink-0 items-center gap-2 border-b border-secondary-border bg-dominant-deep/80 px-4 py-2.5">
        <div className="flex items-center gap-1 rounded-xl border border-secondary-border/70 bg-dominant-deep p-1">
          <button
            type="button"
            data-testid="hub-tab-groups"
            onClick={() => handleTabChange("groups")}
            className={tabClass(tab === "groups")}
          >
            <MessageSquare className="h-4 w-4" />
            Conversas de Grupo
          </button>
          <button
            type="button"
            data-testid="hub-tab-calendar"
            onClick={() => handleTabChange("calendar")}
            className={tabClass(tab === "calendar")}
          >
            <CalendarDays className="h-4 w-4" />
            Calendário
          </button>
        </div>

        {onToggleFullscreen && (
          <button
            type="button"
            data-testid="hub-fullscreen-toggle"
            onClick={onToggleFullscreen}
            title={isFullscreen ? "Sair da tela cheia" : "Tela cheia"}
            aria-label={isFullscreen ? "Sair da tela cheia" : "Tela cheia"}
            aria-pressed={isFullscreen}
            className="ml-auto flex items-center gap-1.5 rounded-xl border border-secondary-border/70 bg-dominant-deep px-2.5 py-1.5 text-xs font-medium text-secondary-muted transition-colors hover:bg-dominant-container hover:text-secondary-pure cursor-pointer"
          >
            {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </button>
        )}
      </div>

      <div
        className={`flex min-h-0 flex-1 flex-col ${
          tab === "groups" ? "overflow-hidden p-2 sm:p-3" : "overflow-y-auto"
        }`}
      >
        {tab === "groups" && <CampaignChat currentUser={currentUser} />}
        {tab === "calendar" && <PlayerSessionCalendar refreshKey={refreshKey} />}
      </div>

      <div className="pointer-events-none fixed bottom-4 right-4 z-[60] flex flex-col gap-2">
        {toasts.map((t) => (
          <div key={t.id} className="pointer-events-auto">
            <Toast message={t.message} type={t.type} onClose={() => removeToast(t.id)} />
          </div>
        ))}
      </div>
    </div>
  );
}
