"use client";

import React, { useCallback, useEffect, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { CalendarCheck, Check, X, Users, Clock } from "lucide-react";
import type { CandidateDetail, SessionSummary } from "@/lib/server/session-service";
import { toLocalDateISO } from "@/lib/utils/session-dates";
import { ConfirmSessionModal } from "./ConfirmSessionModal";

type SessionDetailDrawerProps = {
  session: SessionSummary;
  isMaster: boolean;
  onClose: () => void;
  onConfirmed: (session: SessionSummary) => void;
  onCancelled: (sessionId: string) => void;
};

const STATUS_LABEL: Record<SessionSummary["status"], string> = {
  proposed: "Proposta",
  confirmed: "Confirmada",
  cancelled: "Cancelada",
};

const APPLICATION_LABEL: Record<"interested" | "accepted" | "rejected", string> = {
  interested: "Candidatura enviada",
  accepted: "Candidatura aceita",
  rejected: "Candidatura recusada",
};

function formatDay(iso: string): string {
  const [, m, d] = iso.split("-");
  return `${d}/${m}`;
}

function formatDateTime(isoDate: string): string {
  const date = new Date(isoDate);
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function SessionDetailDrawer({
  session,
  isMaster,
  onClose,
  onConfirmed,
  onCancelled,
}: SessionDetailDrawerProps) {
  const [candidates, setCandidates] = useState<CandidateDetail[]>([]);
  const [loadingCandidates, setLoadingCandidates] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [askCancel, setAskCancel] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canManage = isMaster && session.status === "proposed";

  useEffect(() => {
    if (!canManage) return;
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoadingCandidates(true);
    fetch(`/api/sessions/${session.id}/candidates`, { credentials: "include" })
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        if (data.success) {
          setCandidates(data.data as CandidateDetail[]);
        } else {
          setError(data.error ?? "Erro ao carregar candidaturas");
        }
      })
      .catch(() => {
        if (!cancelled) setError("Erro ao carregar candidaturas");
      })
      .finally(() => {
        if (!cancelled) setLoadingCandidates(false);
      });
    return () => {
      cancelled = true;
    };
  }, [canManage, session.id]);

  const decideCandidate = useCallback(
    async (userId: string, decision: "accepted" | "rejected") => {
      setError(null);
      try {
        const res = await fetch(`/api/sessions/${session.id}/candidates/${userId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ decision }),
        });
        const data = await res.json();
        if (!res.ok || !data.success) {
          setError(data.error ?? "Erro ao atualizar candidatura");
          return;
        }
        const updated = data.data as CandidateDetail;
        setCandidates((prev) => prev.map((c) => (c.userId === updated.userId ? updated : c)));
      } catch {
        setError("Erro ao atualizar candidatura");
      }
    },
    [session.id],
  );

  const handleConfirm = useCallback(
    async (scheduledAt: string, durationMinutes: number) => {
      const res = await fetch(`/api/sessions/${session.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ action: "confirm", scheduledAt, durationMinutes }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error ?? "Erro ao confirmar sessão");
      }
      onConfirmed(data.data as SessionSummary);
    },
    [session.id, onConfirmed],
  );

  const handleCancel = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/sessions/${session.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ action: "cancel" }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error ?? "Erro ao cancelar sessão");
        return;
      }
      onCancelled(session.id);
    } catch {
      setError("Erro ao cancelar sessão");
    } finally {
      setBusy(false);
    }
  }, [session.id, onCancelled]);

  const startDay = toLocalDateISO(new Date(session.proposedStart));
  const endDay = toLocalDateISO(new Date(session.proposedEnd));

  return (
    <>
      <Modal
        isOpen
        onClose={onClose}
        className="max-w-lg bg-secondary-card border border-secondary-border rounded-xl"
      >
        <Modal.Header className="flex items-start justify-between gap-2 border-b border-secondary-border p-4">
          <div className="flex min-w-0 flex-col gap-1.5">
            <h3 className="truncate text-base font-bold text-secondary-pure">
              {session.campaignName}
            </h3>
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="rounded-full bg-secondary-input px-2 py-0.5 text-[10px] font-semibold text-secondary-muted">
                {STATUS_LABEL[session.status]}
              </span>
              <span className="rounded-full bg-accent/20 px-2 py-0.5 text-[10px] font-semibold text-accent">
                {session.sessionType === "one_shot" ? "One-shot" : "Campanha continuada"}
              </span>
              {session.xpReward !== null && (
                <span className="rounded-full bg-secondary-input px-2 py-0.5 text-[10px] font-semibold text-secondary-muted">
                  XP {session.xpReward}
                </span>
              )}
            </div>
          </div>
          <Modal.CloseButton />
        </Modal.Header>

        <Modal.Body className="flex flex-col gap-4 p-4">
          {error && (
            <div className="rounded-lg bg-red-950/80 border border-red-800 p-2.5 text-xs text-red-300">
              {error}
            </div>
          )}

          <p className="whitespace-pre-wrap text-sm text-secondary-offwhite">
            {session.description}
          </p>

          <div className="flex flex-wrap items-center gap-3 text-xs text-secondary-muted">
            <span className="flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" />
              {formatDay(startDay)} – {formatDay(endDay)}
            </span>
            <span className="flex items-center gap-1">
              <Users className="h-3.5 w-3.5" />
              {session.acceptedCount}/{session.maxSlots} vagas
            </span>
            {session.status === "confirmed" && session.scheduledAt && (
              <span className="flex items-center gap-1 text-green-300">
                <CalendarCheck className="h-3.5 w-3.5" />
                {formatDateTime(session.scheduledAt)}
              </span>
            )}
          </div>

          {!isMaster && session.userApplication && (
            <div className="flex flex-col gap-1.5 rounded-lg border border-secondary-border bg-secondary-input/40 p-3">
              <p className="text-xs font-semibold text-secondary-pure">
                {APPLICATION_LABEL[session.userApplication.status]}
              </p>
              <p className="text-xs text-secondary-muted">
                {session.userApplication.availableDays.map(formatDay).join(", ")}
                {" · "}
                {session.userApplication.allDay
                  ? "Livre o dia todo"
                  : `${session.userApplication.preferredStart} – ${session.userApplication.preferredEnd}`}
              </p>
            </div>
          )}

          {canManage && (
            <div className="flex flex-col gap-2">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-secondary-muted">
                Candidaturas ({candidates.length})
              </p>
              {loadingCandidates && (
                <p className="text-xs text-secondary-muted">Carregando candidaturas...</p>
              )}
              {!loadingCandidates && candidates.length === 0 && (
                <p className="text-xs text-secondary-muted">Nenhuma candidatura ainda.</p>
              )}
              {candidates.map((c) => (
                <div
                  key={c.userId}
                  className="flex items-center justify-between gap-2 rounded-lg border border-secondary-border bg-secondary-input/40 p-3"
                >
                  <div className="flex min-w-0 items-center gap-2.5">
                    {c.avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={c.avatarUrl}
                        alt={c.displayName}
                        className="h-8 w-8 shrink-0 rounded-full object-cover"
                      />
                    ) : (
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent/20 text-xs font-bold text-accent">
                        {c.displayName.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div className="flex min-w-0 flex-col gap-0.5">
                      <p className="truncate text-xs font-semibold text-secondary-pure">
                        {c.displayName}
                      </p>
                      {c.characterName && (
                        <p className="truncate text-[10px] text-secondary-muted">
                          {c.characterName}
                        </p>
                      )}
                      <div className="flex flex-wrap items-center gap-1">
                        {c.availableDays.map((day) => (
                          <span
                            key={day}
                            className="rounded-full bg-accent/15 px-1.5 py-0.5 text-[9px] font-semibold text-accent"
                          >
                            {formatDay(day)}
                          </span>
                        ))}
                        <span className="text-[10px] text-secondary-muted">
                          {c.allDay
                            ? "Livre o dia todo"
                            : `${c.preferredStart} – ${c.preferredEnd}`}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    {c.status === "interested" ? (
                      <>
                        <button
                          type="button"
                          data-testid={`candidate-accept-${c.userId}`}
                          onClick={() => decideCandidate(c.userId, "accepted")}
                          className="rounded-full bg-green-900/40 p-1.5 text-green-300 transition-colors hover:bg-green-800/60 cursor-pointer"
                          title="Aceitar candidatura"
                        >
                          <Check className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          data-testid={`candidate-reject-${c.userId}`}
                          onClick={() => decideCandidate(c.userId, "rejected")}
                          className="rounded-full bg-red-950/60 p-1.5 text-red-300 transition-colors hover:bg-red-900/60 cursor-pointer"
                          title="Recusar candidatura"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </>
                    ) : (
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                          c.status === "accepted"
                            ? "bg-green-900/40 text-green-300"
                            : "bg-red-950/60 text-red-300"
                        }`}
                      >
                        {c.status === "accepted" ? "Aceito" : "Recusado"}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Modal.Body>

        {canManage && (
          <Modal.Footer className="flex flex-wrap items-center justify-end gap-2 border-t border-secondary-border p-4">
            {askCancel ? (
              <div className="flex w-full items-center justify-between gap-2">
                <p className="text-xs text-secondary-muted">Cancelar esta sessão?</p>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => setAskCancel(false)}
                    disabled={busy}
                  >
                    Voltar
                  </Button>
                  <Button
                    type="button"
                    variant="danger"
                    data-testid="confirm-cancel-session"
                    onClick={handleCancel}
                    disabled={busy}
                  >
                    {busy ? "Cancelando..." : "Sim, cancelar"}
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <Button
                  type="button"
                  variant="secondary"
                  data-testid="cancel-session-button"
                  onClick={() => setAskCancel(true)}
                  disabled={busy}
                >
                  Cancelar sessão
                </Button>
                <Button
                  type="button"
                  variant="primary"
                  data-testid="confirm-session-button"
                  onClick={() => setConfirmOpen(true)}
                  disabled={busy}
                >
                  <CalendarCheck className="h-4 w-4" />
                  Confirmar sessão
                </Button>
              </>
            )}
          </Modal.Footer>
        )}
      </Modal>

      <ConfirmSessionModal
        isOpen={confirmOpen}
        session={session}
        onClose={() => setConfirmOpen(false)}
        onConfirm={handleConfirm}
      />
    </>
  );
}
