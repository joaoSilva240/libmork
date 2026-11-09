"use client";

import { useState, type ComponentType } from "react";
import {
  GripVertical,
  ArrowUp,
  ArrowDown,
  ArrowLeftRight,
  Music,
  Image,
  MapPin,
  Users,
  UserCheck,
  ScrollText,
} from "lucide-react";
import type { MasterScreenConfig, ShieldModuleId } from "@/hooks/useMasterScreenConfig";

type MasterScreenConfigPanelProps = {
  config: MasterScreenConfig;
  onUpdate: (patch: Partial<MasterScreenConfig>) => void;
  onReset: () => void;
};

type ColumnSide = "left" | "right";

type VisibilityFlag =
  | "showMap"
  | "showAssets"
  | "showJukebox"
  | "showCharactersNpcs"
  | "showPlayers"
  | "showSessionLog";

const MODULE_META: Record<
  ShieldModuleId,
  { label: string; icon: ComponentType<{ size?: number; className?: string }> }
> = {
  // Blocos consolidados da issue #89
  mediaPanel: { label: "Cenário & Mídia (Mundos/Assets/Jukebox)", icon: MapPin },
  actorsPanel: { label: "Participantes (Personagens/Jogadores)", icon: Users },
  worlds: { label: "Mundos & Cenas", icon: MapPin },
  assets: { label: "Assets & Handouts", icon: Image },
  jukebox: { label: "Jukebox de Áudio", icon: Music },
  charactersNpcs: { label: "Personagens & NPCs", icon: Users },
  players: { label: "Jogadores Conectados", icon: UserCheck },
  sessionLog: { label: "Log da Sessão", icon: ScrollText },
};

// Flag de visibilidade que controla cada módulo no escudo. "worlds" é exibido
// quando o Mapa Tático está ativo (showMap), conforme a especificação da issue #75.
const MODULE_VISIBILITY: Record<ShieldModuleId, VisibilityFlag | "consolidated-media" | "consolidated-actors"> = {
  mediaPanel: "consolidated-media",
  actorsPanel: "consolidated-actors",
  worlds: "showMap",
  assets: "showAssets",
  jukebox: "showJukebox",
  charactersNpcs: "showCharactersNpcs",
  players: "showPlayers",
  sessionLog: "showSessionLog",
};

export function MasterScreenConfigPanel({ config, onUpdate, onReset }: MasterScreenConfigPanelProps) {
  const [draggedModule, setDraggedModule] = useState<ShieldModuleId | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<ColumnSide | null>(null);

  const leftOrder = config.leftColumnOrder;
  const rightOrder = config.rightColumnOrder;

  // Move um módulo para uma coluna, opcionalmente em uma posição específica.
  const moveModule = (moduleId: ShieldModuleId, targetCol: ColumnSide, targetIndex?: number) => {
    const left = leftOrder.filter((m) => m !== moduleId);
    const right = rightOrder.filter((m) => m !== moduleId);
    const target = targetCol === "left" ? left : right;
    const insertAt =
      targetIndex === undefined ? target.length : Math.max(0, Math.min(targetIndex, target.length));
    target.splice(insertAt, 0, moduleId);
    onUpdate({ leftColumnOrder: left, rightColumnOrder: right });
  };

  // Reordena um módulo dentro da mesma coluna (botões de acessibilidade ↑ / ↓).
  const reorderWithin = (col: ColumnSide, fromIndex: number, toIndex: number) => {
    const current = col === "left" ? leftOrder : rightOrder;
    if (
      fromIndex < 0 ||
      toIndex < 0 ||
      fromIndex >= current.length ||
      toIndex >= current.length ||
      fromIndex === toIndex
    ) {
      return;
    }
    const order = [...current];
    const [moved] = order.splice(fromIndex, 1);
    order.splice(toIndex, 0, moved);
    onUpdate(col === "left" ? { leftColumnOrder: order } : { rightColumnOrder: order });
  };

  // Transfere um módulo para a coluna oposta (botão de acessibilidade ⇄).
  const switchColumn = (moduleId: ShieldModuleId) => {
    moveModule(moduleId, leftOrder.includes(moduleId) ? "right" : "left");
  };

  // Drop no contêiner da coluna: anexa o módulo arrastado ao final da coluna alvo.
  const handleDrop = (col: ColumnSide) => {
    const source = draggedModule;
    setDraggedModule(null);
    setDragOverColumn(null);
    if (!source) return;
    moveModule(source, col);
  };

  // Drop sobre um card específico: insere o módulo arrastado antes do card alvo.
  const handleDropOnCard = (targetModuleId: ShieldModuleId, col: ColumnSide) => {
    const source = draggedModule;
    setDraggedModule(null);
    setDragOverColumn(null);
    if (!source || source === targetModuleId) return;
    const order = (col === "left" ? leftOrder : rightOrder).filter((m) => m !== source);
    const targetIndex = order.indexOf(targetModuleId);
    moveModule(source, col, targetIndex === -1 ? undefined : targetIndex);
  };

  const renderModuleCard = (
    moduleId: ShieldModuleId,
    index: number,
    col: ColumnSide,
    total: number
  ) => {
    const meta = MODULE_META[moduleId];
    const Icon = meta.icon;
    const flag = MODULE_VISIBILITY[moduleId];
    const isActive =
      flag === "consolidated-media"
        ? config.showMap || config.showAssets || config.showJukebox
        : flag === "consolidated-actors"
          ? config.showCharactersNpcs || config.showPlayers
          : config[flag];
    const isDragging = draggedModule === moduleId;

    return (
      <div
        key={moduleId}
        data-testid={`module-card-${moduleId}`}
        draggable
        onDragStart={(e) => {
          setDraggedModule(moduleId);
          // dataTransfer pode ser nulo em ambientes de teste (jsdom); o estado
          // draggedModule é a fonte de verdade para o drop.
          if (e.dataTransfer) {
            e.dataTransfer.effectAllowed = "move";
            e.dataTransfer.setData("text/plain", moduleId);
          }
        }}
        onDragEnd={() => {
          setDraggedModule(null);
          setDragOverColumn(null);
        }}
        onDragOver={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setDragOverColumn(col);
        }}
        onDrop={(e) => {
          e.preventDefault();
          e.stopPropagation();
          handleDropOnCard(moduleId, col);
        }}
        className={`flex items-center gap-2 rounded-md border border-secondary-border bg-secondary-card px-2 py-1.5 cursor-grab active:cursor-grabbing transition ${
          isDragging ? "opacity-50" : ""
        }`}
      >
        <GripVertical size={14} className="shrink-0 text-secondary-muted" aria-hidden="true" />
        <Icon size={16} className="shrink-0 text-accent-hover" aria-hidden="true" />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-secondary-pure truncate">{meta.label}</p>
          <span
            className={`text-[9px] font-bold uppercase tracking-wide ${
              isActive ? "text-accent-hover" : "text-secondary-muted"
            }`}
          >
            {isActive ? "Ativo" : "Oculto"}
          </span>
        </div>
        <div className="flex items-center gap-0.5 shrink-0">
          <button
            type="button"
            data-testid={`btn-move-up-${moduleId}`}
            disabled={index === 0}
            onClick={() => reorderWithin(col, index, index - 1)}
            aria-label={`Mover ${meta.label} para cima`}
            title="Mover para cima"
            className="p-1 rounded text-secondary-muted hover:text-secondary-pure hover:bg-dominant-deep disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ArrowUp size={12} aria-hidden="true" />
          </button>
          <button
            type="button"
            data-testid={`btn-move-down-${moduleId}`}
            disabled={index === total - 1}
            onClick={() => reorderWithin(col, index, index + 1)}
            aria-label={`Mover ${meta.label} para baixo`}
            title="Mover para baixo"
            className="p-1 rounded text-secondary-muted hover:text-secondary-pure hover:bg-dominant-deep disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ArrowDown size={12} aria-hidden="true" />
          </button>
          <button
            type="button"
            data-testid={`btn-move-col-${moduleId}`}
            onClick={() => switchColumn(moduleId)}
            aria-label={`Mover ${meta.label} para a outra coluna`}
            title="Mover para a outra coluna"
            className="p-1 rounded text-secondary-muted hover:text-secondary-pure hover:bg-dominant-deep transition-colors"
          >
            <ArrowLeftRight size={12} aria-hidden="true" />
          </button>
        </div>
      </div>
    );
  };

  const renderColumn = (col: ColumnSide, title: string) => {
    const order = col === "left" ? leftOrder : rightOrder;
    const isOver = dragOverColumn === col;

    return (
      <div className="flex flex-col gap-1.5">
        <h5 className="text-[11px] font-semibold text-secondary-pure">{title}</h5>
        <div
          data-testid={`dropzone-${col}`}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOverColumn(col);
          }}
          onDragLeave={() => setDragOverColumn((prev) => (prev === col ? null : prev))}
          onDrop={(e) => {
            e.preventDefault();
            handleDrop(col);
          }}
          className={`flex flex-col gap-1.5 rounded-lg border p-2 min-h-[64px] bg-dominant-deep/40 transition ${
            isOver ? "border-accent-hover ring-1 ring-accent-hover" : "border-secondary-border"
          }`}
        >
          {order.map((moduleId, index) => renderModuleCard(moduleId, index, col, order.length))}
          {order.length === 0 && (
            <p className="text-[10px] text-secondary-muted text-center py-2">Solte um módulo aqui</p>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="rounded-lg border border-secondary-border bg-secondary-card p-4 space-y-4">
      <div className="border-b border-secondary-border pb-2">
        <h3 className="font-semibold text-secondary-pure text-sm flex items-center gap-2">
          <span>🛡️</span> Visibilidade do Escudo
        </h3>
        <p className="text-[11px] text-secondary-muted mt-0.5">
          Ative ou desative módulos individuais para personalizar seu fluxo de jogo.
        </p>
      </div>

      <div className="space-y-2.5">
        <h4 className="text-[10px] font-bold uppercase tracking-wider text-accent-hover">
          Mesa & Grid de Combate
        </h4>

        <label className="flex items-center justify-between gap-2 text-xs cursor-pointer group p-1.5 rounded hover:bg-dominant-deep/50 transition">
          <span className="text-secondary-offwhite group-hover:text-secondary-pure transition-colors">
            Carrossel de Personagens
          </span>
          <input
            type="checkbox"
            checked={config.showRoster}
            onChange={(e) => onUpdate({ showRoster: e.target.checked })}
            className="h-4 w-4 rounded border-secondary-border bg-dominant-deep text-accent focus:ring-2 focus:ring-accent cursor-pointer"
          />
        </label>

        <label className="flex items-center justify-between gap-2 text-xs cursor-pointer group p-1.5 rounded hover:bg-dominant-deep/50 transition">
          <span className="text-secondary-offwhite group-hover:text-secondary-pure transition-colors">
            Rolagens da Mesa
          </span>
          <input
            type="checkbox"
            checked={config.showDiceRolls}
            onChange={(e) => onUpdate({ showDiceRolls: e.target.checked })}
            className="h-4 w-4 rounded border-secondary-border bg-dominant-deep text-accent focus:ring-2 focus:ring-accent cursor-pointer"
          />
        </label>

        <label className="flex items-center justify-between gap-2 text-xs cursor-pointer group p-1.5 rounded hover:bg-dominant-deep/50 transition">
          <span className="text-secondary-offwhite group-hover:text-secondary-pure transition-colors">
            Canvas Infinito
          </span>
          <input
            type="checkbox"
            checked={config.showCanvas}
            onChange={(e) => onUpdate({ showCanvas: e.target.checked })}
            className="h-4 w-4 rounded border-secondary-border bg-dominant-deep text-accent focus:ring-2 focus:ring-accent cursor-pointer"
          />
        </label>

        <label className="flex items-center justify-between gap-2 text-xs cursor-pointer group p-1.5 rounded hover:bg-dominant-deep/50 transition">
          <span className="text-secondary-offwhite group-hover:text-secondary-pure transition-colors">
            Mapa Tático
          </span>
          <input
            type="checkbox"
            checked={config.showMap}
            onChange={(e) => onUpdate({ showMap: e.target.checked })}
            className="h-4 w-4 rounded border-secondary-border bg-dominant-deep text-accent focus:ring-2 focus:ring-accent cursor-pointer"
          />
        </label>
      </div>

      <div className="space-y-2.5 pt-2 border-t border-secondary-border/60">
        <h4 className="text-[10px] font-bold uppercase tracking-wider text-accent-hover">
          Painel de Gestão & Áudio
        </h4>

        <label className="flex items-center justify-between gap-2 text-xs cursor-pointer group p-1.5 rounded hover:bg-dominant-deep/50 transition">
          <span className="text-secondary-offwhite group-hover:text-secondary-pure transition-colors">
            Jukebox de Áudio
          </span>
          <input
            type="checkbox"
            checked={config.showJukebox}
            onChange={(e) => onUpdate({ showJukebox: e.target.checked })}
            className="h-4 w-4 rounded border-secondary-border bg-dominant-deep text-accent focus:ring-2 focus:ring-accent cursor-pointer"
          />
        </label>

        <label className="flex items-center justify-between gap-2 text-xs cursor-pointer group p-1.5 rounded hover:bg-dominant-deep/50 transition">
          <span className="text-secondary-offwhite group-hover:text-secondary-pure transition-colors">
            Personagens e NPCs
          </span>
          <input
            type="checkbox"
            checked={config.showCharactersNpcs}
            onChange={(e) => onUpdate({ showCharactersNpcs: e.target.checked })}
            className="h-4 w-4 rounded border-secondary-border bg-dominant-deep text-accent focus:ring-2 focus:ring-accent cursor-pointer"
          />
        </label>

        <label className="flex items-center justify-between gap-2 text-xs cursor-pointer group p-1.5 rounded hover:bg-dominant-deep/50 transition">
          <span className="text-secondary-offwhite group-hover:text-secondary-pure transition-colors">
            Jogadores Conectados
          </span>
          <input
            type="checkbox"
            checked={config.showPlayers}
            onChange={(e) => onUpdate({ showPlayers: e.target.checked })}
            className="h-4 w-4 rounded border-secondary-border bg-dominant-deep text-accent focus:ring-2 focus:ring-accent cursor-pointer"
          />
        </label>

        <label className="flex items-center justify-between gap-2 text-xs cursor-pointer group p-1.5 rounded hover:bg-dominant-deep/50 transition">
          <span className="flex flex-col gap-0.5">
            <span className="text-secondary-offwhite group-hover:text-secondary-pure transition-colors">
              Assets e Handouts
            </span>
            <span className="text-[11px] text-secondary-muted">
              Exibe o painel de handouts, mapas e cenas visuais compartilháveis.
            </span>
          </span>
          <input
            type="checkbox"
            checked={config.showAssets}
            onChange={(e) => onUpdate({ showAssets: e.target.checked })}
            className="h-4 w-4 shrink-0 rounded border-secondary-border bg-dominant-deep text-accent focus:ring-2 focus:ring-accent cursor-pointer"
          />
        </label>
      </div>

      <div className="space-y-2.5 pt-2 border-t border-secondary-border/60">
        <h4 className="text-[10px] font-bold uppercase tracking-wider text-accent-hover">
          Histórico da Sessão
        </h4>

        <label className="flex items-center justify-between gap-2 text-xs cursor-pointer group p-1.5 rounded hover:bg-dominant-deep/50 transition">
          <span className="text-secondary-offwhite group-hover:text-secondary-pure transition-colors">
            Log da Sessão
          </span>
          <input
            type="checkbox"
            checked={config.showSessionLog}
            onChange={(e) => onUpdate({ showSessionLog: e.target.checked })}
            className="h-4 w-4 rounded border-secondary-border bg-dominant-deep text-accent focus:ring-2 focus:ring-accent cursor-pointer"
          />
        </label>
      </div>

      <div className="space-y-2.5 pt-2 border-t border-secondary-border/60">
        <h4 className="text-[10px] font-bold uppercase tracking-wider text-accent-hover">
          Organizador de Módulos
        </h4>
        <p className="text-[11px] text-secondary-muted">
          Arraste os blocos entre as colunas ou use os botões para reordenar. Mundos/Assets/Jukebox
          e Personagens/Jogadores são agrupados em blocos com abas no Escudo (issue #89). A ordem é
          salva automaticamente.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {renderColumn("left", "Coluna Esquerda (Gestão)")}
          {renderColumn("right", "Coluna Direita (Logs)")}
        </div>
      </div>

      <button
        type="button"
        onClick={onReset}
        className="mt-4 w-full rounded-lg border border-secondary-border bg-dominant-container px-3 py-1.5 text-xs font-semibold text-secondary-offwhite hover:bg-dominant-container/80 hover:text-secondary-pure transition-colors"
      >
        Restaurar Padrão
      </button>
    </div>
  );
}
