"use client";

// =============================================================================
// Libmork — Barra de Cenas do escudo do mestre (Issue #86, Fase 1)
// =============================================================================
// 5 botões de cena no header; clicar a cena ativa a desativa (modo Livre).
// Nesta fase só persiste/sincroniza a cena; efeitos vêm na Fase 2.
// =============================================================================

import { SCENE_ORDER, SCENES, type ActiveScene } from "@/lib/scenes/sceneConfig";

type SceneBarProps = {
  activeScene: ActiveScene;
  onSceneChange: (next: ActiveScene) => void;
  disabled?: boolean;
  /** Combate segue rodando enquanto a cena exibida é outra (Fase 2). */
  combatBackgroundActive?: boolean;
  className?: string;
};

export function SceneBar({
  activeScene,
  onSceneChange,
  disabled = false,
  combatBackgroundActive = false,
  className = "",
}: SceneBarProps) {
  return (
    <div
      data-testid="scene-bar"
      className={`flex items-center gap-1.5 rounded-lg border border-gray-800 bg-gray-950/70 px-2 py-1 ${className}`}
    >
      <span
        data-testid="scene-mode-label"
        className="mr-1 whitespace-nowrap text-[10px] uppercase tracking-wider text-gray-400"
      >
        {activeScene ? `Cena: ${SCENES[activeScene].label}` : "Cena: Livre"}
      </span>
      {combatBackgroundActive && activeScene !== "combat" && (
        <span
          data-testid="scene-combat-indicator"
          title="Combate ativo em 2º plano"
          className="relative flex h-2.5 w-2.5 items-center"
        >
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-500" />
        </span>
      )}
      {SCENE_ORDER.map((value) => {
        const scene = SCENES[value];
        const Icon = scene.icon;
        const isActive = activeScene === value;
        return (
          <button
            key={value}
            type="button"
            data-testid={`scene-btn-${value}`}
            aria-pressed={isActive}
            disabled={disabled}
            title={
              isActive
                ? `${scene.label} — clique para voltar ao modo Livre`
                : `Ativar cena: ${scene.label}`
            }
            onClick={() => onSceneChange(isActive ? null : value)}
            className={`flex cursor-pointer items-center gap-1 rounded border px-2 py-1 text-xs font-semibold transition-colors ${
              isActive
                ? scene.activeClasses
                : "border-gray-700 bg-gray-800/70 text-gray-300 hover:bg-gray-700"
            } ${disabled ? "cursor-not-allowed opacity-50" : ""}`}
          >
            <Icon size={14} />
            <span className="hidden xl:inline">{scene.label}</span>
          </button>
        );
      })}
    </div>
  );
}
