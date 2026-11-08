"use client";

import React from "react";
import { CalendarDays, Star, Users } from "lucide-react";
import type { SessionSummary } from "@/lib/server/session-service";
import { toLocalDateISO } from "@/lib/utils/session-dates";

type SessionInviteCardProps = {
  session: SessionSummary;
  onOpen: (session: SessionSummary) => void;
};

function formatDay(iso: string): string {
  const [, m, d] = iso.split("-");
  return `${d}/${m}`;
}

export function SessionInviteCard({ session, onOpen }: SessionInviteCardProps) {
  const startDay = toLocalDateISO(new Date(session.proposedStart));
  const endDay = toLocalDateISO(new Date(session.proposedEnd));

  return (
    <button
      type="button"
      data-testid={`session-invite-${session.id}`}
      onClick={() => onOpen(session)}
      className="flex w-full cursor-pointer flex-col overflow-hidden rounded-xl border border-secondary-border bg-secondary-card text-left transition-colors hover:border-accent/50"
    >
      <div className="relative h-20 w-full shrink-0 overflow-hidden bg-gradient-to-br from-accent/30 to-dominant-deep">
        {session.coverImageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={session.coverImageUrl}
            alt=""
            className="h-full w-full object-cover opacity-80"
          />
        )}
        <span className="absolute bottom-2 left-3 text-2xl font-black text-white/90 drop-shadow">
          {session.campaignName.charAt(0).toUpperCase()}
        </span>
      </div>

      <div className="flex flex-col gap-2 p-3">
        <div className="flex items-center justify-between gap-2">
          <p className="truncate text-sm font-bold text-secondary-pure">{session.campaignName}</p>
          <span className="shrink-0 rounded-full bg-accent/20 px-2 py-0.5 text-[10px] font-semibold text-accent">
            {session.sessionType === "one_shot" ? "One-shot" : "Campanha"}
          </span>
        </div>

        <p className="truncate text-[11px] text-secondary-muted">
          Mestre <span className="font-semibold text-secondary-offwhite">{session.masterName}</span>
        </p>

        <p className="line-clamp-2 text-xs text-secondary-offwhite">{session.description}</p>

        <div className="flex flex-wrap items-center gap-2 text-[11px] text-secondary-muted">
          <span className="flex items-center gap-1 rounded-full bg-secondary-input px-2 py-0.5 font-semibold text-green-300">
            <Users className="h-3 w-3" />
            {session.remainingSlots} vagas
          </span>
          {session.xpReward !== null && (
            <span className="flex items-center gap-1 rounded-full bg-secondary-input px-2 py-0.5 font-semibold text-secondary-offwhite">
              <Star className="h-3 w-3" />
              XP {session.xpReward}
            </span>
          )}
          <span className="flex items-center gap-1">
            <CalendarDays className="h-3 w-3" />
            {formatDay(startDay)} – {formatDay(endDay)}
          </span>
        </div>
      </div>
    </button>
  );
}
