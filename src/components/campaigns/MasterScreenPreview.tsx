import type { ComponentType } from "react";
import { Music, Image, MapPin, Users, UserCheck, ScrollText } from "lucide-react";
import {
  DEFAULT_SHIELD_LEFT_ORDER,
  DEFAULT_SHIELD_RIGHT_ORDER,
  type ShieldModuleId,
} from "@/hooks/useMasterScreenConfig";

type MasterScreenPreviewProps = {
  showRoster: boolean;
  showSessionLog: boolean;
  showCanvas: boolean;
  showMap: boolean;
  showJukebox?: boolean;
  showDiceRolls?: boolean;
  showCharactersNpcs?: boolean;
  showPlayers?: boolean;
  showAssets?: boolean;
  leftColumnOrder?: ShieldModuleId[];
  rightColumnOrder?: ShieldModuleId[];
};

type PreviewModuleMeta = {
  label: string;
  icon: ComponentType<{ size?: number; className?: string }>;
  accent?: boolean;
};

const MODULE_META: Record<ShieldModuleId, PreviewModuleMeta> = {
  mediaPanel: { label: "Mídia (Mundos/Assets/Jukebox)", icon: MapPin },
  actorsPanel: { label: "Participantes (Personagens/Jogadores)", icon: Users },
  worlds: { label: "Mundos", icon: MapPin },
  assets: { label: "Assets", icon: Image },
  jukebox: { label: "Jukebox", icon: Music, accent: true },
  charactersNpcs: { label: "Personagens", icon: Users },
  players: { label: "Jogadores", icon: UserCheck },
  sessionLog: { label: "Logs", icon: ScrollText, accent: true },
};

/** A decorative, live representation of the Master's Screen layout. */
export function MasterScreenPreview({
  showRoster,
  showSessionLog,
  showCanvas,
  showMap,
  showJukebox = true,
  showDiceRolls = true,
  showCharactersNpcs = true,
  showPlayers = true,
  showAssets = true,
  leftColumnOrder = DEFAULT_SHIELD_LEFT_ORDER,
  rightColumnOrder = DEFAULT_SHIELD_RIGHT_ORDER,
}: MasterScreenPreviewProps) {
  // Flag de visibilidade que controla cada módulo. "worlds" é exibido quando o
  // Mapa Tático está ativo (showMap), conforme a especificação da issue #75.
  const visibility: Record<ShieldModuleId, boolean> = {
    mediaPanel: showMap || showAssets || showJukebox,
    actorsPanel: showCharactersNpcs || showPlayers,
    worlds: showMap,
    assets: showAssets,
    jukebox: showJukebox,
    charactersNpcs: showCharactersNpcs,
    players: showPlayers,
    sessionLog: showSessionLog,
  };

  const leftModules = leftColumnOrder.filter((moduleId) => visibility[moduleId]);
  const rightModules = rightColumnOrder.filter((moduleId) => visibility[moduleId]);
  const showRightColumn = rightModules.length > 0;

  const renderBadge = (moduleId: ShieldModuleId) => {
    const meta = MODULE_META[moduleId];
    const Icon = meta.icon;
    return (
      <div
        key={moduleId}
        className={`flex h-7 items-center justify-center gap-1 rounded border px-1 text-[9px] font-medium transition-all duration-300 ${
          meta.accent
            ? "border-accent/30 bg-accent/10 text-accent-hover"
            : "border-secondary-border bg-dominant-deep text-secondary-offwhite"
        }`}
      >
        <Icon size={11} className="shrink-0" aria-hidden="true" />
        <span className="truncate">{meta.label}</span>
        {moduleId === "sessionLog" && showDiceRolls && (
          <span className="rounded bg-accent/20 px-1 text-[8px] font-bold text-accent-hover">
            Rolagens
          </span>
        )}
      </div>
    );
  };

  return (
    <div
      role="img"
      aria-label="Preview do layout do Escudo do Mestre"
      className="rounded-lg border border-secondary-border bg-dominant-deep p-3"
    >
      <div
        className={`grid min-h-64 gap-2 transition-all duration-300 ${
          showRightColumn
            ? "grid-cols-[minmax(80px,1fr)_minmax(0,3fr)_minmax(72px,1.2fr)]"
            : "grid-cols-[minmax(80px,1fr)_minmax(0,4fr)]"
        }`}
      >
        {/* Coluna 1: Gestão & Áudio */}
        <div
          data-testid="preview-left-col"
          aria-hidden="true"
          className="flex flex-col gap-1.5 rounded-md border border-secondary-border bg-secondary-card p-1.5 text-center text-[10px] text-secondary-muted transition-all duration-300"
        >
          <span className="font-bold text-accent-hover block border-b border-secondary-border/50 pb-1">
            Gestão
          </span>
          {leftModules.map(renderBadge)}
          {leftModules.length === 0 && (
            <div className="flex flex-1 items-center justify-center text-[9px] text-gray-500 italic">
              Vazio
            </div>
          )}
        </div>

        {/* Coluna 2: Mesa & Tático */}
        <div
          aria-hidden="true"
          className="flex min-w-0 flex-col gap-2 rounded-md border border-secondary-border bg-secondary-card p-2 transition-all duration-300"
        >
          <div className="flex items-center justify-between border-b border-secondary-border/50 pb-1 text-[10px]">
            <span className="font-bold text-secondary-pure">Mesa</span>
          </div>

          <div
            className={`flex min-h-0 flex-1 items-center justify-center rounded border border-secondary-border px-1 text-center text-[10px] text-secondary-offwhite transition-all duration-300 ${
              showCanvas || showMap ? "bg-dominant-deep" : "bg-dominant-container text-secondary-muted"
            }`}
          >
            {showCanvas || showMap ? "Canvas/Mapa" : "Vazio"}
          </div>

          {showRoster && (
            <div className="flex h-10 items-center justify-center rounded border border-secondary-border bg-dominant-deep text-[10px] text-secondary-offwhite transition-all duration-300 font-medium">
              Roster
            </div>
          )}
        </div>

        {/* Coluna 3: Logs & módulos à direita */}
        {showRightColumn && (
          <div
            data-testid="preview-right-col"
            aria-hidden="true"
            className="flex flex-col gap-1.5 rounded-md border border-secondary-border bg-secondary-card p-1.5 text-center text-[10px] text-secondary-muted transition-all duration-300"
          >
            {rightModules.map(renderBadge)}
          </div>
        )}
      </div>
    </div>
  );
}
