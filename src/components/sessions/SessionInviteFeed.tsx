"use client";

import React, { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import type { SessionSummary } from "@/lib/server/session-service";
import { SessionInviteCard } from "./SessionInviteCard";
import { SessionInviteDetail } from "./SessionInviteDetail";
import { ApplySessionModal } from "./ApplySessionModal";

type SessionInviteFeedProps = {
  currentUserId: string;
  onApplied: (campaignId: string, sessionId: string) => void;
};

export function SessionInviteFeed({ onApplied }: SessionInviteFeedProps) {
  const [items, setItems] = useState<SessionSummary[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<SessionSummary | null>(null);
  const [applying, setApplying] = useState<SessionSummary | null>(null);

  const load = useCallback(async (targetPage: number, append: boolean) => {
    if (append) setLoadingMore(true);
    else setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/sessions?page=${targetPage}`, { credentials: "include" });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error ?? "Erro ao carregar convites");
        return;
      }
      const payload = data.data as { items: SessionSummary[]; page: number; hasMore: boolean };
      setItems((prev) => (append ? [...prev, ...payload.items] : payload.items));
      setPage(payload.page);
      setHasMore(payload.hasMore);
    } catch {
      setError("Erro ao carregar convites");
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load(1, false);
  }, [load]);

  const handleApplied = useCallback(
    (campaignId: string, sessionId: string) => {
      setSelected(null);
      setApplying(null);
      onApplied(campaignId, sessionId);
    },
    [onApplied],
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-10 text-sm text-secondary-muted">
        <Loader2 className="h-4 w-4 animate-spin" />
        Carregando convites...
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg bg-red-950/80 border border-red-800 p-3 text-xs text-red-300">
        {error}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {items.length === 0 ? (
        <p className="py-10 text-center text-sm text-secondary-muted">
          Nenhum convite de sessão no momento.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((session) => (
            <SessionInviteCard key={session.id} session={session} onOpen={setSelected} />
          ))}
        </div>
      )}

      {hasMore && (
        <button
          type="button"
          data-testid="load-more-invites"
          onClick={() => void load(page + 1, true)}
          disabled={loadingMore}
          className="mx-auto flex items-center gap-2 rounded-lg border border-secondary-border px-4 py-2 text-xs font-semibold text-secondary-pure transition-colors hover:border-accent/50 cursor-pointer disabled:opacity-50"
        >
          {loadingMore && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          Carregar mais
        </button>
      )}

      {selected && (
        <SessionInviteDetail
          session={selected}
          onClose={() => setSelected(null)}
          onApply={(s) => setApplying(s)}
        />
      )}

      {applying && (
        <ApplySessionModal
          session={applying}
          isOpen
          onClose={() => setApplying(null)}
          onApplied={handleApplied}
        />
      )}
    </div>
  );
}
