"use client";

import React, { useEffect, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Sparkles } from "lucide-react";
import type { SessionSummary } from "@/lib/server/session-service";
import { eachDayISO } from "@/lib/utils/session-dates";

type CharacterOption = {
  id: string;
  name: string;
};

type ApplySessionModalProps = {
  session: SessionSummary;
  isOpen: boolean;
  onClose: () => void;
  onApplied: (campaignId: string, sessionId: string) => void;
};

export function ApplySessionModal({ session, isOpen, onClose, onApplied }: ApplySessionModalProps) {
  const [characters, setCharacters] = useState<CharacterOption[]>([]);
  const [characterId, setCharacterId] = useState("");
  const [selectedDays, setSelectedDays] = useState<string[]>([]);
  const [allDay, setAllDay] = useState(true);
  const [timeStart, setTimeStart] = useState("");
  const [timeEnd, setTimeEnd] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const days = eachDayISO(new Date(session.proposedStart), new Date(session.proposedEnd));

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    fetch("/api/characters", { credentials: "include" })
      .then((res) => res.json())
      .then((data) => {
        if (cancelled || !data.success) return;
        setCharacters(
          (data.data as { id: string; name: string }[]).map((c) => ({ id: c.id, name: c.name })),
        );
      })
      .catch(() => {
        /* lista de personagens é opcional */
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  const toggleDay = (day: string) => {
    setSelectedDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort(),
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (selectedDays.length === 0) {
      setError("Selecione ao menos um dia disponível");
      return;
    }
    if (!allDay) {
      if (!timeStart || !timeEnd) {
        setError("Informe início e fim do horário preferido");
        return;
      }
      if (timeEnd <= timeStart) {
        setError("O fim do horário deve ser depois do início");
        return;
      }
    }

    const body: Record<string, unknown> = {
      characterId: characterId || null,
      availableDays: selectedDays,
    };
    if (!allDay) {
      body.preferredStart = timeStart;
      body.preferredEnd = timeEnd;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/sessions/${session.id}/candidates`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error ?? "Erro ao enviar candidatura");
        return;
      }
      onApplied(session.campaignId, session.id);
      onClose();
    } catch {
      setError("Erro ao enviar candidatura");
    } finally {
      setSubmitting(false);
    }
  };

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
              <Sparkles className="h-4 w-4" />
            </div>
            <h3 className="text-base font-bold text-secondary-pure">Tenho Interesse</h3>
          </div>
          <Modal.CloseButton />
        </Modal.Header>

        <Modal.Body className="flex flex-col gap-4 p-4 overflow-y-auto max-h-[70vh]">
          {error && (
            <div className="rounded-lg bg-red-950/80 border border-red-800 p-2.5 text-xs text-red-300">
              {error}
            </div>
          )}

          {/* Personagem */}
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="apply-character-select"
              className="text-xs font-semibold text-secondary-pure"
            >
              Personagem
            </label>
            <select
              id="apply-character-select"
              data-testid="apply-character-select"
              value={characterId}
              onChange={(e) => setCharacterId(e.target.value)}
              className="rounded-lg border border-secondary-border bg-secondary-input px-3 py-2 text-sm text-secondary-pure focus:outline-none focus:ring-2 focus:ring-accent"
            >
              <option value="">Candidatar-se sem ficha</option>
              {characters.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Dias disponíveis */}
          <div className="flex flex-col gap-1.5">
            <p className="text-xs font-semibold text-secondary-pure">Dias disponíveis *</p>
            <div className="flex flex-wrap gap-1.5">
              {days.map((day) => {
                const [, m, d] = day.split("-");
                const selected = selectedDays.includes(day);
                return (
                  <button
                    key={day}
                    type="button"
                    data-testid={`apply-day-${day}`}
                    onClick={() => toggleDay(day)}
                    className={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors cursor-pointer ${
                      selected
                        ? "border-accent bg-accent text-white"
                        : "border-secondary-border bg-secondary-input text-secondary-muted hover:text-secondary-pure"
                    }`}
                  >
                    {d}/{m}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Horário */}
          <label className="flex items-center gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              data-testid="apply-all-day"
              checked={allDay}
              onChange={(e) => setAllDay(e.target.checked)}
              className="h-4 w-4 rounded border-secondary-border bg-secondary-input text-accent focus:ring-accent accent-accent"
            />
            <span className="text-xs font-medium text-secondary-pure">Livre o dia todo</span>
          </label>

          {!allDay && (
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="apply-time-start"
                  className="text-xs font-semibold text-secondary-pure"
                >
                  Início *
                </label>
                <input
                  id="apply-time-start"
                  data-testid="apply-time-start"
                  type="time"
                  value={timeStart}
                  onChange={(e) => setTimeStart(e.target.value)}
                  className="rounded-lg border border-secondary-border bg-secondary-input px-3 py-2 text-sm text-secondary-pure focus:outline-none focus:ring-2 focus:ring-accent"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="apply-time-end"
                  className="text-xs font-semibold text-secondary-pure"
                >
                  Fim *
                </label>
                <input
                  id="apply-time-end"
                  data-testid="apply-time-end"
                  type="time"
                  value={timeEnd}
                  onChange={(e) => setTimeEnd(e.target.value)}
                  className="rounded-lg border border-secondary-border bg-secondary-input px-3 py-2 text-sm text-secondary-pure focus:outline-none focus:ring-2 focus:ring-accent"
                />
              </div>
            </div>
          )}
        </Modal.Body>

        <Modal.Footer className="flex items-center justify-end gap-2 border-t border-secondary-border p-4">
          <Button type="button" variant="secondary" onClick={onClose} disabled={submitting}>
            Cancelar
          </Button>
          <Button type="submit" variant="primary" data-testid="apply-submit" disabled={submitting}>
            {submitting ? "Enviando..." : "Enviar candidatura"}
          </Button>
        </Modal.Footer>
      </form>
    </Modal>
  );
}
