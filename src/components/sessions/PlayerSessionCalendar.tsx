"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { CalendarGrid } from "@/components/calendar/CalendarGrid";
import type { CalendarEvent, CalendarView } from "@/components/calendar/CalendarGrid";
import { useSocket } from "@/context/SocketContext";
import type { PlayerCalendarEntry } from "@/lib/server/session-service";
import { toLocalDateISO } from "@/lib/utils/session-dates";

type PlayerSessionCalendarProps = {
  refreshKey?: number;
};

function formatHour(iso: string): string {
  return new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" }).format(
    new Date(iso),
  );
}

export function PlayerSessionCalendar({ refreshKey = 0 }: PlayerSessionCalendarProps) {
  const { subscribeSessionConfirmed, subscribeSessionCancelled } = useSocket();
  const [entries, setEntries] = useState<PlayerCalendarEntry[]>([]);
  const [view, setView] = useState<CalendarView>("month");
  const [cursor, setCursor] = useState<Date>(() => new Date());
  const [selected, setSelected] = useState<PlayerCalendarEntry | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch("/api/player/calendar", { credentials: "include" });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error ?? "Erro ao carregar sua agenda");
        return;
      }
      setEntries(data.data as PlayerCalendarEntry[]);
    } catch {
      setError("Erro ao carregar sua agenda");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load, refreshKey]);

  useEffect(() => {
    const offConfirmed = subscribeSessionConfirmed(() => {
      void load();
    });
    const offCancelled = subscribeSessionCancelled(() => {
      void load();
    });
    return () => {
      offConfirmed();
      offCancelled();
    };
  }, [subscribeSessionConfirmed, subscribeSessionCancelled, load]);

  const events: CalendarEvent[] = entries.map((e) => ({
    id: e.sessionId,
    date: toLocalDateISO(new Date(e.scheduledAt)),
    title: e.campaignName,
    tone: "success",
    badge: formatHour(e.scheduledAt),
  }));

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-10 text-sm text-secondary-muted">
        <Loader2 className="h-4 w-4 animate-spin" />
        Carregando agenda...
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      {error && (
        <div className="rounded-lg bg-red-950/80 border border-red-800 p-2.5 text-xs text-red-300">
          {error}
        </div>
      )}

      {entries.length === 0 ? (
        <p className="py-10 text-center text-sm text-secondary-muted">
          Nenhuma sessão confirmada na sua agenda.
        </p>
      ) : (
        <div className="min-h-0 flex-1">
          <CalendarGrid
            view={view}
            cursor={cursor}
            events={events}
            onNavigate={setCursor}
            onViewChange={setView}
            onEventClick={(ev) => {
              const entry = entries.find((e) => e.sessionId === ev.id);
              if (entry) setSelected(entry);
            }}
          />
        </div>
      )}

      {selected && (
        <Modal
          isOpen
          onClose={() => setSelected(null)}
          className="max-w-md bg-secondary-card border border-secondary-border rounded-xl"
        >
          <Modal.Header className="flex items-start justify-between gap-2 border-b border-secondary-border p-4">
            <h3 className="truncate text-base font-bold text-secondary-pure">
              {selected.campaignName}
            </h3>
            <Modal.CloseButton />
          </Modal.Header>
          <Modal.Body className="flex flex-col gap-3 p-4">
            <p className="whitespace-pre-wrap text-sm text-secondary-offwhite">
              {selected.description}
            </p>
            <div className="flex flex-wrap items-center gap-3 text-xs text-secondary-muted">
              <span>
                {new Intl.DateTimeFormat("pt-BR", {
                  dateStyle: "short",
                  timeStyle: "short",
                }).format(new Date(selected.scheduledAt))}
              </span>
              <span>Duração: {Math.round(selected.durationMinutes / 60)}h</span>
              {selected.xpReward !== null && <span>XP {selected.xpReward}</span>}
            </div>
          </Modal.Body>
          <Modal.Footer className="flex items-center justify-end gap-2 border-t border-secondary-border p-4">
            <Link
              href={`/player?tab=campaigns&campaign=${selected.campaignId}`}
              data-testid="go-to-room-link"
              onClick={() => setSelected(null)}
              className="rounded-lg bg-accent px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-accent-hover cursor-pointer"
            >
              Ir para a sala
            </Link>
          </Modal.Footer>
        </Modal>
      )}
    </div>
  );
}
