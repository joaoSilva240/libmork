"use client";

import React, { useCallback, useEffect, useState } from "react";
import { Plus, CalendarDays, Loader2 } from "lucide-react";
import { CalendarGrid } from "@/components/calendar/CalendarGrid";
import type { CalendarEvent, CalendarView } from "@/components/calendar/CalendarGrid";
import { Button } from "@/components/ui/Button";
import { Toast } from "@/components/ui/Toast";
import { useSocket } from "@/context/SocketContext";
import type { SessionSummary } from "@/lib/server/session-service";
import { toLocalDateISO } from "@/lib/utils/session-dates";
import { SessionLaunchModal } from "./SessionLaunchModal";
import { SessionDetailDrawer } from "./SessionDetailDrawer";

type LocalToast = { id: number; message: string; type: "success" | "info" | "error" };

function toneFor(session: SessionSummary): CalendarEvent["tone"] {
  if (session.status === "confirmed") return "success";
  if (session.status === "cancelled") return "muted";
  return "accent";
}

export function MasterSessionCalendar() {
  const {
    sendSessionPublish,
    sendSessionConfirm,
    sendSessionCancel,
    subscribeSessionApplied,
    subscribeSessionConfirmed,
    subscribeSessionCancelled,
  } = useSocket();

  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [view, setView] = useState<CalendarView>("month");
  const [cursor, setCursor] = useState<Date>(() => new Date());
  const [launchOpen, setLaunchOpen] = useState(false);
  const [selected, setSelected] = useState<SessionSummary | null>(null);
  const [toasts, setToasts] = useState<LocalToast[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const pushToast = useCallback((message: string, type: LocalToast["type"] = "info") => {
    setToasts((prev) => [...prev, { id: Date.now() + Math.random(), message, type }]);
  }, []);

  const removeToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const loadSessions = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch("/api/sessions/master", { credentials: "include" });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error ?? "Erro ao carregar sessões");
        return;
      }
      setSessions(data.data as SessionSummary[]);
    } catch {
      setError("Erro ao carregar sessões");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadSessions();
  }, [loadSessions]);

  useEffect(() => {
    const offApplied = subscribeSessionApplied(() => {
      void loadSessions();
    });
    const offConfirmed = subscribeSessionConfirmed(() => {
      pushToast("Sessão confirmada", "success");
      void loadSessions();
    });
    const offCancelled = subscribeSessionCancelled(() => {
      pushToast("Sessão cancelada", "info");
      void loadSessions();
    });
    return () => {
      offApplied();
      offConfirmed();
      offCancelled();
    };
  }, [
    subscribeSessionApplied,
    subscribeSessionConfirmed,
    subscribeSessionCancelled,
    loadSessions,
    pushToast,
  ]);

  const events: CalendarEvent[] = sessions.map((s) => ({
    id: s.id,
    date: toLocalDateISO(new Date(s.scheduledAt ?? s.proposedStart)),
    title: s.campaignName,
    tone: toneFor(s),
    badge: `${s.acceptedCount}/${s.maxSlots}`,
  }));

  const handleLaunched = useCallback(
    (session: SessionSummary) => {
      sendSessionPublish({ campaignId: session.campaignId, session });
      pushToast("Convite de sessão publicado", "success");
      setLaunchOpen(false);
      void loadSessions();
    },
    [sendSessionPublish, pushToast, loadSessions],
  );

  const handleConfirmed = useCallback(
    (session: SessionSummary) => {
      sendSessionConfirm({ campaignId: session.campaignId, session });
      pushToast("Sessão confirmada", "success");
      setSelected(null);
      void loadSessions();
    },
    [sendSessionConfirm, pushToast, loadSessions],
  );

  const handleCancelled = useCallback(
    (sessionId: string) => {
      const session = sessions.find((s) => s.id === sessionId);
      if (session) {
        sendSessionCancel({ campaignId: session.campaignId, sessionId });
      }
      pushToast("Sessão cancelada", "info");
      setSelected(null);
      void loadSessions();
    },
    [sessions, sendSessionCancel, pushToast, loadSessions],
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-10 text-sm text-secondary-muted">
        <Loader2 className="h-4 w-4 animate-spin" />
        Carregando calendário...
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-bold text-secondary-pure">
          <CalendarDays className="h-4 w-4 text-accent" />
          Calendário de Sessões
        </h2>
        <Button
          type="button"
          variant="primary"
          data-testid="launch-session-button"
          onClick={() => setLaunchOpen(true)}
        >
          <Plus className="h-4 w-4" />
          Lançar Sessão
        </Button>
      </div>

      {error && (
        <div className="rounded-lg bg-red-950/80 border border-red-800 p-2.5 text-xs text-red-300">
          {error}
        </div>
      )}

      <div className="min-h-0 flex-1">
        <CalendarGrid
          view={view}
          cursor={cursor}
          events={events}
          onNavigate={setCursor}
          onViewChange={setView}
          onEventClick={(ev) => {
            const session = sessions.find((s) => s.id === ev.id);
            if (session) setSelected(session);
          }}
        />
      </div>

      <div className="pointer-events-none fixed bottom-4 right-4 z-[60] flex flex-col gap-2">
        {toasts.map((t) => (
          <div key={t.id} className="pointer-events-auto">
            <Toast message={t.message} type={t.type} onClose={() => removeToast(t.id)} />
          </div>
        ))}
      </div>

      <SessionLaunchModal
        isOpen={launchOpen}
        onClose={() => setLaunchOpen(false)}
        onLaunched={handleLaunched}
      />

      {selected && (
        <SessionDetailDrawer
          session={selected}
          isMaster
          onClose={() => setSelected(null)}
          onConfirmed={handleConfirmed}
          onCancelled={handleCancelled}
        />
      )}
    </div>
  );
}
