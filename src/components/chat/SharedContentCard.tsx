"use client";

import React from "react";
import { ChevronRight, Package, UserRound, Globe2, Map } from "lucide-react";
import type { SharePayload } from "@/lib/server/chat-service";

const KIND_CONFIG = {
  library_item: { Icon: Package, label: "Item da biblioteca" },
  profile: { Icon: UserRound, label: "Perfil" },
  post: { Icon: Globe2, label: "Publicação" },
  campaign: { Icon: Map, label: "Campanha" },
} as const;

function describePayload(payload: SharePayload): {
  title: string;
  subtitle: string;
  imageUrl: string | null;
} {
  switch (payload.kind) {
    case "library_item":
      return {
        title: payload.snapshot.name,
        subtitle: payload.snapshot.description
          ? payload.snapshot.description.slice(0, 80)
          : "Biblioteca geral",
        imageUrl: payload.snapshot.imageUrl,
      };
    case "profile":
      return {
        title: payload.snapshot.displayName,
        subtitle: payload.snapshot.bio ? payload.snapshot.bio.slice(0, 80) : "Perfil de usuário",
        imageUrl: payload.snapshot.avatarUrl,
      };
    case "post":
      return {
        title: payload.snapshot.title,
        subtitle: `Por ${payload.snapshot.authorName}`,
        imageUrl: null,
      };
    case "campaign":
      return {
        title: payload.snapshot.name,
        subtitle: `Mestre: ${payload.snapshot.masterName}`,
        imageUrl: payload.snapshot.coverImageUrl,
      };
  }
}

export function SharedContentCard({
  payload,
  onClick,
}: {
  payload: SharePayload;
  onClick: () => void;
}) {
  const { Icon, label } = KIND_CONFIG[payload.kind];
  const { title, subtitle, imageUrl } = describePayload(payload);

  return (
    <button
      type="button"
      onClick={onClick}
      data-testid={`shared-card-${payload.kind}`}
      className="flex w-full max-w-[320px] items-center gap-3 rounded-lg border border-secondary-border bg-secondary-input/60 p-2.5 text-left transition-colors hover:border-accent cursor-pointer"
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-md bg-dominant-deep border border-secondary-border">
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imageUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <Icon className="h-4 w-4 text-accent" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[9px] font-bold uppercase tracking-wide text-secondary-muted">{label}</p>
        <p className="truncate text-xs font-bold text-secondary-pure">{title}</p>
        <p className="truncate text-[10px] text-secondary-muted">{subtitle}</p>
      </div>
      <ChevronRight className="h-4 w-4 shrink-0 text-secondary-muted" />
    </button>
  );
}
