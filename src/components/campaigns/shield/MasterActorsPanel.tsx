"use client";

import { useCallback } from "react";
import { UserCheck, Users } from "lucide-react";
import { CampaignInvites } from "@/components/campaigns/CampaignInvites";
import { ShieldTabContainer, type ShieldTabDef } from "./ShieldTabContainer";

type MasterActorsPanelProps = {
  campaignId: string;
  rosterVersion: number;
  showCharactersNpcs: boolean;
  showPlayers: boolean;
  className?: string;
};

/**
 * Painel Unificado de Participantes do Escudo (issue #89): consolida
 * Personagens/NPCs e Jogadores Conectados em um contêiner com abas.
 *
 * As assinaturas WebSocket (`subscribeCampaignInviteCreated`/`Revoked`) já são
 * registradas apenas pela instância de `CampaignInvites` com `showPlayers`,
 * conforme otimização da issue #75 — e ambas as abas permanecem montadas
 * enquanto visíveis para preservar buscas e estado interno.
 */
export function MasterActorsPanel({
  campaignId,
  rosterVersion,
  showCharactersNpcs,
  showPlayers,
  className = "",
}: MasterActorsPanelProps) {
  const renderInvites = useCallback(
    (mode: "npcs" | "players") => (
      <CampaignInvites
        key={`invites-${mode}-${rosterVersion}`}
        campaignId={campaignId}
        showCharactersNpcs={mode === "npcs"}
        showPlayers={mode === "players"}
        className="h-full w-full overflow-y-auto border-0 bg-transparent p-3"
      />
    ),
    [campaignId, rosterVersion]
  );

  const tabs: ShieldTabDef[] = [
    {
      id: "charactersNpcs",
      label: "Personagens & NPCs",
      icon: Users,
      visible: showCharactersNpcs,
      content: renderInvites("npcs"),
    },
    {
      id: "players",
      label: "Jogadores Conectados",
      icon: UserCheck,
      visible: showPlayers,
      content: renderInvites("players"),
    },
  ];

  return (
    <ShieldTabContainer
      persistKey="libmork:shield-tab:actors"
      tabs={tabs}
      className={className}
    />
  );
}
