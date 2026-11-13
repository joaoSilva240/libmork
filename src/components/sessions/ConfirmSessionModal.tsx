"use client";

import React, { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { CalendarCheck } from "lucide-react";
import type { SessionSummary } from "@/lib/server/session-service";
import { toLocalDateISO } from "@/lib/utils/session-dates";

type ConfirmSessionModalProps = {
  isOpen: boolean;
  session: SessionSummary;
  onClose: () => void;
  onConfirm: (scheduledAt: string, durationMinutes: number) => Promise<void>;
};

export function ConfirmSessionModal({
  isOpen,
  session,
  onClose,
  onConfirm,
}: ConfirmSessionModalProps) {
  const startDay = toLocalDateISO(new Date(session.proposedStart));
  const endDay = toLocalDateISO(new Date(session.proposedEnd));
  const minDateTime = `${startDay}T00:00`;
  const maxDateTime = `${endDay}T23:59`;

  const [datetime, setDatetime] = useState(minDateTime);
  const [duration, setDuration] = useState(String(session.durationMinutes || 240));
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!datetime) {
      setError("Escolha a data e hora da sessão");
      return;
    }
    const chosen = new Date(datetime);
    if (chosen < new Date(`${startDay}T00:00:00`) || chosen > new Date(`${endDay}T23:59:59`)) {
      setError("A data final está fora do período proposto");
      return;
    }
    const minutes = Number(duration);
    if (!Number.isInteger(minutes) || minutes < 30 || minutes > 1440) {
      setError("A duração deve ser entre 30 e 1440 minutos");
      return;
    }

    setSubmitting(true);
    try {
      await onConfirm(chosen.toISOString(), minutes);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao confirmar sessão");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      className="max-w-sm bg-secondary-card border border-secondary-border rounded-xl"
    >
      <form onSubmit={handleSubmit} className="flex flex-col h-full">
        <Modal.Header className="flex items-center justify-between border-b border-secondary-border p-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/20 text-accent">
              <CalendarCheck className="h-4 w-4" />
            </div>
            <h3 className="text-base font-bold text-secondary-pure">Confirmar Sessão</h3>
          </div>
          <Modal.CloseButton />
        </Modal.Header>

        <Modal.Body className="flex flex-col gap-4 p-4">
          {error && (
            <div className="rounded-lg bg-red-950/80 border border-red-800 p-2.5 text-xs text-red-300">
              {error}
            </div>
          )}

          <p className="text-xs text-secondary-muted">
            Escolha a data e hora dentro do período proposto (
            {startDay.split("-").reverse().join("/")} a {endDay.split("-").reverse().join("/")}).
          </p>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="confirm-datetime" className="text-xs font-semibold text-secondary-pure">
              Data e hora *
            </label>
            <input
              id="confirm-datetime"
              data-testid="confirm-datetime"
              type="datetime-local"
              min={minDateTime}
              max={maxDateTime}
              step={60}
              value={datetime}
              onChange={(e) => setDatetime(e.target.value)}
              className="rounded-lg border border-secondary-border bg-secondary-input px-3 py-2 text-sm text-secondary-pure focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="confirm-duration" className="text-xs font-semibold text-secondary-pure">
              Duração (minutos) *
            </label>
            <input
              id="confirm-duration"
              data-testid="confirm-duration"
              type="number"
              min={30}
              max={1440}
              step={30}
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              className="rounded-lg border border-secondary-border bg-secondary-input px-3 py-2 text-sm text-secondary-pure focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>
        </Modal.Body>

        <Modal.Footer className="flex items-center justify-end gap-2 border-t border-secondary-border p-4">
          <Button type="button" variant="secondary" onClick={onClose} disabled={submitting}>
            Voltar
          </Button>
          <Button
            type="submit"
            variant="primary"
            data-testid="confirm-session-submit"
            disabled={submitting}
          >
            {submitting ? "Confirmando..." : "Confirmar"}
          </Button>
        </Modal.Footer>
      </form>
    </Modal>
  );
}
