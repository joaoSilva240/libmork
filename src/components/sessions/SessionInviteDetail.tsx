"use client";

import React from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { CalendarDays, Star, Users, Sparkles } from "lucide-react";
import type { SessionSummary } from "@/lib/server/session-service";
import { toLocalDateISO } from "@/lib/utils/session-dates";

type SessionInviteDetailProps = {
  session: SessionSummary;
  onClose: () => void;
  onApply: (session: SessionSummary) => void;
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

export function SessionInviteDetail({ session, onClose, onApply }: SessionInviteDetailProps) {
  const startDay = toLocalDateISO(new Date(session.proposedStart));
  const endDay = toLocalDateISO(new Date(session.proposedEnd));

  return (
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
        <p className="flex items-center gap-1.5 text-xs text-secondary-muted">
          Mestre <span className="font-semibold text-secondary-offwhite">{session.masterName}</span>
        </p>

        <p className="whitespace-pre-wrap text-sm text-secondary-offwhite">{session.description}</p>

        <div className="flex flex-wrap items-center gap-3 text-xs text-secondary-muted">
          <span className="flex items-center gap-1">
            <CalendarDays className="h-3.5 w-3.5" />
            {formatDay(startDay)} – {formatDay(endDay)}
          </span>
          <span className="flex items-center gap-1 text-green-300">
            <Users className="h-3.5 w-3.5" />
            {session.remainingSlots} de {session.maxSlots} vagas
          </span>
          {session.xpReward !== null && (
            <span className="flex items-center gap-1">
              <Star className="h-3.5 w-3.5" />
              XP {session.xpReward}
            </span>
          )}
        </div>

        {session.userApplication && (
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
      </Modal.Body>

      <Modal.Footer className="flex items-center justify-end gap-2 border-t border-secondary-border p-4">
        <Button type="button" variant="secondary" onClick={onClose}>
          Fechar
        </Button>
        {!session.userApplication && session.status === "proposed" && (
          <Button
            type="button"
            variant="primary"
            data-testid="apply-interest-button"
            onClick={() => onApply(session)}
          >
            <Sparkles className="h-4 w-4" />
            Tenho Interesse
          </Button>
        )}
      </Modal.Footer>
    </Modal>
  );
}
