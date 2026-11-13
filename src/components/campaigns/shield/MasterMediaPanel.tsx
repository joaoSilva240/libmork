"use client";

import { Image, MapPin, Music } from "lucide-react";
import { MasterJukebox } from "@/components/campaigns/MasterJukebox";
import { MasterAssetsPanel } from "@/components/campaigns/MasterAssetsPanel";
import { MasterWorldsPanel } from "./MasterWorldsPanel";
import { ShieldTabContainer, type ShieldTabDef } from "./ShieldTabContainer";
import type { Establishment, World } from "@/types";
import type { ActiveScene } from "@/lib/scenes/sceneConfig";

type MasterMediaPanelProps = {
  campaignId: string;
  masterId: string;
  activeAssetId: string | null;
  isMissing: boolean;
  showMap: boolean;
  showAssets: boolean;
  showJukebox: boolean;
  // Conteúdo da aba de Mundos (estado permanece em CampaignDetail):
  worlds: World[];
  worldError: string | null;
  selectedWorldId: string;
  onSelectWorld: (worldId: string) => void;
  onOpenWorld: (world: { id: string; name: string }) => void;
  establishments: Establishment[];
  isEstablishmentsExpanded: boolean;
  onToggleEstablishmentsExpanded: () => void;
  onToggleEstablishment: (establishment: Establishment) => void;
  className?: string;
  activeScene?: ActiveScene;
};

/**
 * Painel Unificado de Cenário & Mídia do Escudo (issue #89): consolida
 * Mundos, Assets e Jukebox em um contêiner com abas. As abas ficam montadas
 * enquanto visíveis — o áudio da Jukebox não para ao trocar de aba.
 */
export function MasterMediaPanel({
  campaignId,
  masterId,
  activeAssetId,
  isMissing,
  showMap,
  showAssets,
  showJukebox,
  worlds,
  worldError,
  selectedWorldId,
  onSelectWorld,
  onOpenWorld,
  establishments,
  isEstablishmentsExpanded,
  onToggleEstablishmentsExpanded,
  onToggleEstablishment,
  className = "",
  activeScene = null,
}: MasterMediaPanelProps) {
  const tabs: ShieldTabDef[] = [
    {
      id: "worlds",
      label: isMissing ? "Cenas / Locais de Investigação" : "Mundos & Cenas de Investigação",
      icon: MapPin,
      visible: showMap,
      content: (
        <MasterWorldsPanel
          isMissing={isMissing}
          worlds={worlds}
          worldError={worldError}
          selectedWorldId={selectedWorldId}
          onSelectWorld={onSelectWorld}
          onOpenWorld={onOpenWorld}
          establishments={establishments}
          isEstablishmentsExpanded={isEstablishmentsExpanded}
          onToggleEstablishmentsExpanded={onToggleEstablishmentsExpanded}
          onToggleEstablishment={onToggleEstablishment}
          activeScene={activeScene}
        />
      ),
    },
    {
      id: "assets",
      label: "Assets & Handouts",
      icon: Image,
      visible: showAssets,
      content: (
        <MasterAssetsPanel
          campaignId={campaignId}
          initialActiveAssetId={activeAssetId}
          className="h-full w-full overflow-y-auto border-0 bg-transparent p-3"
          isCompact={true}
        />
      ),
    },
    {
      id: "jukebox",
      label: "Jukebox de Áudio",
      icon: Music,
      visible: showJukebox,
      content: (
        <MasterJukebox
          campaignId={campaignId}
          userId={masterId}
          userName="Mestre"
          activeScene={activeScene}
          className="h-full w-full overflow-y-auto border-0 bg-transparent p-3"
        />
      ),
    },
  ];

  return (
    <ShieldTabContainer persistKey="libmork:shield-tab:media" tabs={tabs} className={className} />
  );
}
