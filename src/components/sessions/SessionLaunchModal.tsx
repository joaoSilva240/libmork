"use client";

import React, { useCallback, useEffect, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { CalendarPlus } from "lucide-react";
import type { SessionContext, SessionSummary } from "@/lib/server/session-service";

type CampaignOption = {
  id: string;
  name: string;
};

type SessionLaunchModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onLaunched: (session: SessionSummary) => void;
};

export function SessionLaunchModal({ isOpen, onClose, onLaunched }: SessionLaunchModalProps) {
  const [campaigns, setCampaigns] = useState<CampaignOption[]>([]);
  const [selectedCampaignId, setSelectedCampaignId] = useState("");
  const [context, setContext] = useState<SessionContext | null>(null);
  const [loadingContext, setLoadingContext] = useState(false);
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [sessionType, setSessionType] = useState<"one_shot" | "continuing">("one_shot");
  const [maxSlots, setMaxSlots] = useState("4");
  const [xpReward, setXpReward] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    fetch("/api/campaigns", { credentials: "include" })
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        if (data.success) {
          setCampaigns(
            (data.data as { id: string; name: string }[]).map((c) => ({
              id: c.id,
              name: c.name,
            })),
          );
        }
      })
      .catch(() => {
        /* silencioso: lista vazia */
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  useEffect(() => {
    if (!selectedCampaignId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setContext(null);
      return;
    }
    let cancelled = false;
    setLoadingContext(true);
    fetch(`/api/campaigns/${selectedCampaignId}/session-context`, { credentials: "include" })
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        if (data.success) {
          setContext(data.data as SessionContext);
        } else {
          setContext(null);
          setError(data.error ?? "Erro ao carregar contexto da campanha");
        }
      })
      .catch(() => {
        if (!cancelled) setError("Erro ao carregar contexto da campanha");
      })
      .finally(() => {
        if (!cancelled) setLoadingContext(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedCampaignId]);

  const needsConfig =
    context !== null &&
    (context.isFirstSession || context.oneShot === null || context.maxPlayers === null);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);

      if (!selectedCampaignId) {
        setError("Selecione uma campanha");
        return;
      }
      const trimmed = description.trim();
      if (trimmed.length < 10) {
        setError("A descrição deve ter no mínimo de 10 caracteres");
        return;
      }
      if (!startDate || !endDate) {
        setError("Informe o período proposto (início e fim)");
        return;
      }
      if (endDate < startDate) {
        setError("A data final deve ser igual ou posterior à data inicial");
        return;
      }
      const slots = Number(maxSlots);
      if (needsConfig && (!Number.isInteger(slots) || slots < 1 || slots > 20)) {
        setError("As vagas devem ser um número entre 1 e 20");
        return;
      }

      const body: Record<string, unknown> = {
        campaignId: selectedCampaignId,
        description: trimmed,
        proposedStart: new Date(`${startDate}T00:00:00`).toISOString(),
        proposedEnd: new Date(`${endDate}T23:59:59`).toISOString(),
      };
      if (needsConfig) {
        body.sessionType = sessionType;
        body.maxSlots = slots;
      }
      if (xpReward.trim()) {
        body.xpReward = Number(xpReward);
      }

      setSubmitting(true);
      try {
        const res = await fetch("/api/sessions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(body),
        });
        const data = await res.json();
        if (!res.ok || !data.success) {
          setError(data.error ?? "Erro ao lançar sessão");
          return;
        }
        onLaunched(data.data as SessionSummary);
        setSelectedCampaignId("");
        setContext(null);
        setDescription("");
        setStartDate("");
        setEndDate("");
        setSessionType("one_shot");
        setMaxSlots("4");
        setXpReward("");
        onClose();
      } catch {
        setError("Erro ao lançar sessão");
      } finally {
        setSubmitting(false);
      }
    },
    [
      selectedCampaignId,
      description,
      startDate,
      endDate,
      needsConfig,
      maxSlots,
      sessionType,
      xpReward,
      onLaunched,
      onClose,
    ],
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      className="max-w-md bg-secondary-card border border-secondary-border rounded-xl"
    >
      <form onSubmit={handleSubmit} className="flex flex-col h-full">
        <Modal.Header className="flex items-center justify-between border-b border-secondary-border p-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/20 text-accent">
              <CalendarPlus className="h-4 w-4" />
            </div>
            <h3 className="text-base font-bold text-secondary-pure">Lançar Sessão</h3>
          </div>
          <Modal.CloseButton />
        </Modal.Header>

        <Modal.Body className="flex flex-col gap-4 p-4 overflow-y-auto max-h-[70vh]">
          {error && (
            <div className="rounded-lg bg-red-950/80 border border-red-800 p-2.5 text-xs text-red-300">
              {error}
            </div>
          )}

          {/* Campanha */}
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="launch-campaign-select"
              className="text-xs font-semibold text-secondary-pure"
            >
              Campanha *
            </label>
            <select
              id="launch-campaign-select"
              data-testid="launch-campaign-select"
              value={selectedCampaignId}
              onChange={(e) => setSelectedCampaignId(e.target.value)}
              className="rounded-lg border border-secondary-border bg-secondary-input px-3 py-2 text-sm text-secondary-pure focus:outline-none focus:ring-2 focus:ring-accent"
            >
              <option value="">Selecione uma campanha</option>
              {campaigns.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {loadingContext && <p className="text-xs text-secondary-muted">Carregando contexto...</p>}

          {context && !loadingContext && needsConfig && (
            <div className="flex flex-col gap-2 rounded-lg border border-accent/30 bg-accent/5 p-3">
              <p className="text-xs font-semibold text-secondary-pure">
                Primeira sessão desta campanha — configure o formato
              </p>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-1.5 text-xs text-secondary-pure cursor-pointer">
                  <input
                    type="radio"
                    name="launch-session-type"
                    data-testid="launch-type-one-shot"
                    checked={sessionType === "one_shot"}
                    onChange={() => setSessionType("one_shot")}
                    className="h-3.5 w-3.5 accent-accent"
                  />
                  One-shot
                </label>
                <label className="flex items-center gap-1.5 text-xs text-secondary-pure cursor-pointer">
                  <input
                    type="radio"
                    name="launch-session-type"
                    data-testid="launch-type-continuing"
                    checked={sessionType === "continuing"}
                    onChange={() => setSessionType("continuing")}
                    className="h-3.5 w-3.5 accent-accent"
                  />
                  Campanha continuada
                </label>
              </div>
              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="launch-max-slots"
                  className="text-xs font-semibold text-secondary-pure"
                >
                  Vagas (1–20) *
                </label>
                <input
                  id="launch-max-slots"
                  data-testid="launch-max-slots"
                  type="number"
                  min={1}
                  max={20}
                  value={maxSlots}
                  onChange={(e) => setMaxSlots(e.target.value)}
                  className="rounded-lg border border-secondary-border bg-secondary-input px-3 py-2 text-sm text-secondary-pure focus:outline-none focus:ring-2 focus:ring-accent"
                />
              </div>
            </div>
          )}

          {context && !loadingContext && !needsConfig && (
            <div className="flex flex-col gap-2 rounded-lg border border-secondary-border bg-secondary-input/40 p-3">
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-accent/20 px-2 py-0.5 text-[10px] font-semibold text-accent">
                  {context.oneShot ? "One-shot" : "Campanha continuada"}
                </span>
                <span className="rounded-full bg-green-900/40 border border-green-700/50 px-2 py-0.5 text-[10px] font-semibold text-green-300">
                  {context.maxPlayers} vagas
                </span>
              </div>
              {context.enrolledPlayers.length > 0 && (
                <div className="flex flex-col gap-1">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-secondary-muted">
                    Jogadores inscritos (aceitos automaticamente)
                  </p>
                  {context.enrolledPlayers.map((p) => (
                    <p key={p.userId} className="flex items-center gap-1.5 text-xs">
                      <span className="font-semibold text-secondary-pure">{p.displayName}</span>
                      {p.characterName ? (
                        <span className="text-secondary-muted">{p.characterName}</span>
                      ) : null}
                    </p>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Descrição */}
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="launch-description"
              className="text-xs font-semibold text-secondary-pure"
            >
              Descrição da sessão *
            </label>
            <textarea
              id="launch-description"
              data-testid="launch-description"
              rows={4}
              placeholder="O que aguarda os aventureiros nesta sessão?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="rounded-lg border border-secondary-border bg-secondary-input px-3 py-2 text-sm text-secondary-pure focus:outline-none focus:ring-2 focus:ring-accent resize-none"
            />
          </div>

          {/* Período proposto */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="launch-start-date"
                className="text-xs font-semibold text-secondary-pure"
              >
                Início do período *
              </label>
              <input
                id="launch-start-date"
                data-testid="launch-start-date"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="rounded-lg border border-secondary-border bg-secondary-input px-3 py-2 text-sm text-secondary-pure focus:outline-none focus:ring-2 focus:ring-accent"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="launch-end-date"
                className="text-xs font-semibold text-secondary-pure"
              >
                Fim do período *
              </label>
              <input
                id="launch-end-date"
                data-testid="launch-end-date"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="rounded-lg border border-secondary-border bg-secondary-input px-3 py-2 text-sm text-secondary-pure focus:outline-none focus:ring-2 focus:ring-accent"
              />
            </div>
          </div>

          {/* XP opcional */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="launch-xp" className="text-xs font-semibold text-secondary-pure">
              Recompensa de XP (opcional)
            </label>
            <input
              id="launch-xp"
              data-testid="launch-xp"
              type="number"
              min={0}
              placeholder="Ex.: 500"
              value={xpReward}
              onChange={(e) => setXpReward(e.target.value)}
              className="rounded-lg border border-secondary-border bg-secondary-input px-3 py-2 text-sm text-secondary-pure focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>
        </Modal.Body>

        <Modal.Footer className="flex items-center justify-end gap-2 border-t border-secondary-border p-4">
          <Button type="button" variant="secondary" onClick={onClose} disabled={submitting}>
            Cancelar
          </Button>
          <Button
            type="submit"
            variant="primary"
            data-testid="launch-submit"
            disabled={submitting || loadingContext}
          >
            {submitting ? "Lançando..." : "Lançar Sessão"}
          </Button>
        </Modal.Footer>
      </form>
    </Modal>
  );
}
