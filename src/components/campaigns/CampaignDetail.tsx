"use client";

import { Fragment, useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Boxes, Settings } from "lucide-react";
import type { Campaign, Establishment, World } from "@/types";
import { ResizeHandle, Spinner, WindowPortal } from "@/components/ui";
import { useResizableLayout } from "@/hooks/useResizableLayout";
import { useSocket } from "@/context/SocketContext";
import { MasterRoster } from "@/components/campaigns/MasterRoster";
import { SessionLog } from "@/components/campaigns/SessionLog";
import { MissingSessionLog } from "@/components/systems/missing/MissingSessionLog";
import { APTrackerWidget } from "@/components/systems/fallout";
import { ContentOverlay } from "@/components/campaigns/ContentOverlay";
import { WorldOverlay } from "@/components/campaigns/WorldOverlay";
import { CampaignSettingsModal } from "./CampaignSettingsModal";
import { MasterMediaPanel } from "./shield/MasterMediaPanel";
import { MasterActorsPanel } from "./shield/MasterActorsPanel";
import { useMasterScreenConfig, type ShieldModuleId } from "@/hooks/useMasterScreenConfig";
import { useTheme } from "@/context/ThemeContext";
import {
  SHIELD_LEFT_MAX,
  SHIELD_LEFT_MIN,
  SHIELD_RIGHT_MAX,
  SHIELD_RIGHT_MIN,
  fitShieldColumns,
  getMaxSideWidth,
  getShieldGridTemplate,
  type ShieldSide,
} from "@/lib/layout/shieldColumns";

export function CampaignDetail() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { socket, setCampaignDice3DSettings } = useSocket();
  const { applyCampaignThemeOverride, clearCampaignThemeOverride } = useTheme();
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [worlds, setWorlds] = useState<World[]>([]);
  const [selectedWorldEstablishments, setSelectedWorldEstablishments] = useState<Establishment[]>(
    [],
  );
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);

  const [worldError, setWorldError] = useState<string | null>(null);
  const [isEstablishmentsExpanded, setIsEstablishmentsExpanded] = useState(false);

  const [showContentOverlay, setShowContentOverlay] = useState(false);
  const [selectedWorldId, setSelectedWorldId] = useState<string>("");
  const worldsRequestId = useRef(0);
  const [overlayWorld, setOverlayWorld] = useState<{ id: string; name: string } | null>(null);
  const [rosterVersion, setRosterVersion] = useState(0);
  const [isMesaPopped, setIsMesaPopped] = useState(false);
  const [popupBlockedWarning, setPopupBlockedWarning] = useState(false);

  const leftPanel = useResizableLayout({
    storageKey: campaign ? `libmork:campaign-left-panel:${campaign.id}` : undefined,
    initialWidth: 240,
    minWidth: SHIELD_LEFT_MIN,
    maxWidth: SHIELD_LEFT_MAX,
  });

  const rightPanel = useResizableLayout({
    storageKey: campaign ? `libmork:campaign-right-panel:${campaign.id}` : undefined,
    initialWidth: 260,
    minWidth: SHIELD_RIGHT_MIN,
    maxWidth: SHIELD_RIGHT_MAX,
  });

  const {
    config: screenConfig,
    updateConfig: updateScreenConfig,
    resetConfig: resetScreenConfig,
  } = useMasterScreenConfig();

  const [shieldGridEl, setShieldGridEl] = useState<HTMLDivElement | null>(null);
  const [shieldGridWidth, setShieldGridWidth] = useState(0);

  useEffect(() => {
    if (!shieldGridEl) return;
    const measure = () => setShieldGridWidth(shieldGridEl.clientWidth);
    measure();
    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", measure);
      return () => window.removeEventListener("resize", measure);
    }
    const observer = new ResizeObserver(measure);
    observer.observe(shieldGridEl);
    return () => observer.disconnect();
  }, [shieldGridEl]);

  // A coluna direita existe quando QUALQUER módulo ordenado nela está visível.
  // Não depende apenas de showSessionLog: Jukebox/Assets/etc. podem ser movidos
  // para a direita e o log pode estar oculto (Issue #75).
  const isModuleVisible = (moduleId: ShieldModuleId): boolean => {
    switch (moduleId) {
      case "sessionLog":
        return screenConfig.showSessionLog;
      // Blocos consolidados (issue #89): visíveis quando pelo menos uma aba está ativa.
      case "mediaPanel":
        return screenConfig.showMap || screenConfig.showAssets || screenConfig.showJukebox;
      case "actorsPanel":
        return screenConfig.showCharactersNpcs || screenConfig.showPlayers;
      default:
        return false;
    }
  };
  const hasRightColumn = screenConfig.rightColumnOrder.some(isModuleVisible);

  const shieldLayoutInput = {
    left: leftPanel.width,
    right: rightPanel.width,
    containerWidth: shieldGridWidth,
    showSessionLog: hasRightColumn,
  };
  const shieldColumns = fitShieldColumns(shieldLayoutInput);

  const resizeShieldSide = (side: ShieldSide, delta: number) => {
    if (delta === 0) return;
    const panel = side === "left" ? leftPanel : rightPanel;
    const current = shieldColumns[side];
    const maxWidth = getMaxSideWidth(side, { ...shieldLayoutInput, ...shieldColumns });
    // Só cresce até o limite que preserva a coluna central; encolher é sempre permitido.
    const next =
      delta > 0 ? Math.min(current + delta, Math.max(current, maxWidth)) : current + delta;
    if (next !== panel.width) panel.setWidth(next);
  };

  const handleCloseMesaPopOut = useCallback(() => {
    setIsMesaPopped(false);
  }, []);

  const handleBlockedMesaPopOut = useCallback(() => {
    setIsMesaPopped(false);
    setPopupBlockedWarning(true);
  }, []);

  const loadWorlds = useCallback(async () => {
    const requestId = ++worldsRequestId.current;
    try {
      const response = await fetch(`/api/campaigns/${params.id}/worlds`, {
        credentials: "include",
      });
      const data = await response.json();

      if (!response.ok) {
        setWorldError(data.error || "Erro ao carregar mundos");
        return;
      }

      if (requestId !== worldsRequestId.current) return;

      const nextWorlds = data.data as World[];
      setWorlds(nextWorlds);
      setSelectedWorldId((currentWorldId) => {
        if (nextWorlds.some((world) => world.id === currentWorldId)) {
          return currentWorldId;
        }
        return nextWorlds[0]?.id ?? "";
      });
    } catch {
      setWorldError("Erro de conexão. Tente novamente.");
    }
  }, [params.id]);

  useEffect(() => {
    async function loadData() {
      try {
        const response = await fetch(`/api/campaigns/${params.id}`, {
          credentials: "include",
        });
        const data = await response.json();

        if (!response.ok) {
          setError(data.error || "Erro ao carregar campanha");
          return;
        }

        setCampaign(data.data);
        await loadWorlds();
      } catch {
        setError("Erro de conexão. Tente novamente.");
      } finally {
        setIsLoading(false);
      }
    }

    loadData();
  }, [params.id, loadWorlds]);

  useEffect(() => {
    if (campaign?.theme) {
      applyCampaignThemeOverride(campaign.theme);
    }
    return () => {
      clearCampaignThemeOverride();
    };
  }, [campaign?.theme, applyCampaignThemeOverride, clearCampaignThemeOverride]);

  useEffect(() => {
    if (campaign && setCampaignDice3DSettings) {
      setCampaignDice3DSettings(campaign.id, {
        dice3dPlayersEnabled: campaign.dice3dPlayersEnabled ?? true,
        dice3dMasterEnabled: campaign.dice3dMasterEnabled ?? true,
      });
    }
  }, [
    campaign?.id,
    campaign?.dice3dPlayersEnabled,
    campaign?.dice3dMasterEnabled,
    setCampaignDice3DSettings,
  ]);

  useEffect(() => {
    if (!selectedWorldId) {
      setSelectedWorldEstablishments([]);
      return;
    }

    async function loadEstablishments() {
      try {
        const res = await fetch(`/api/worlds/${selectedWorldId}/establishments`, {
          credentials: "include",
        });
        const data = await res.json();
        if (res.ok && data.data) {
          setSelectedWorldEstablishments(data.data);
        } else {
          setSelectedWorldEstablishments([]);
        }
      } catch {
        setSelectedWorldEstablishments([]);
      }
    }

    loadEstablishments();
  }, [selectedWorldId]);

  const handleToggleEstablishment = async (est: Establishment) => {
    if (!selectedWorldId) return;
    const nextState = !est.isOpen;
    try {
      const res = await fetch(`/api/worlds/${selectedWorldId}/establishments/${est.id}/toggle`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ isOpen: nextState }),
      });

      if (res.ok) {
        setSelectedWorldEstablishments((prev) =>
          prev.map((item) => (item.id === est.id ? { ...item, isOpen: nextState } : item)),
        );
        socket?.emit("toggle-establishment", {
          campaignId: campaign?.id,
          establishment: { id: est.id, name: est.name },
          isOpen: nextState,
        });
      }
    } catch {
      console.error("Erro ao alternar status do estabelecimento");
    }
  };

  const handleDelete = async () => {
    if (
      !window.confirm(
        "Tem certeza que deseja excluir esta campanha? Todos os mundos e vínculos serão removidos.",
      )
    ) {
      return;
    }

    setIsDeleting(true);
    try {
      const response = await fetch(`/api/campaigns/${params.id}`, {
        method: "DELETE",
        credentials: "include",
      });

      if (!response.ok) {
        const data = await response.json();
        setError(data.error || "Erro ao excluir campanha");
        setIsDeleting(false);
        return;
      }

      router.push("/master");
    } catch {
      setError("Erro de conexão. Tente novamente.");
      setIsDeleting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center min-h-[400px]">
        <Spinner size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-800 bg-red-900/30 p-4 text-red-300">{error}</div>
    );
  }

  if (!campaign) {
    return null;
  }

  const isMissing = campaign.rulesEngine === "missing_zero";

  // Renderiza dinamicamente cada módulo do escudo conforme a ordenação/visibilidade
  // configurada. Módulos consolidados com abas: mediaPanel e actorsPanel (issue #89).
  const renderModule = (moduleId: ShieldModuleId) => {
    switch (moduleId) {
      case "mediaPanel":
        if (!isModuleVisible("mediaPanel")) return null;
        return (
          <MasterMediaPanel
            campaignId={campaign.id}
            masterId={campaign.masterId}
            activeAssetId={campaign.activeAssetId ?? null}
            isMissing={isMissing}
            showMap={screenConfig.showMap}
            showAssets={screenConfig.showAssets}
            showJukebox={screenConfig.showJukebox}
            worlds={worlds}
            worldError={worldError}
            selectedWorldId={selectedWorldId}
            onSelectWorld={setSelectedWorldId}
            onOpenWorld={setOverlayWorld}
            establishments={selectedWorldEstablishments}
            isEstablishmentsExpanded={isEstablishmentsExpanded}
            onToggleEstablishmentsExpanded={() => setIsEstablishmentsExpanded((prev) => !prev)}
            onToggleEstablishment={handleToggleEstablishment}
            className="lg:min-h-[200px]"
          />
        );

      case "actorsPanel":
        if (!isModuleVisible("actorsPanel")) return null;
        return (
          <MasterActorsPanel
            campaignId={campaign.id}
            rosterVersion={rosterVersion}
            showCharactersNpcs={screenConfig.showCharactersNpcs}
            showPlayers={screenConfig.showPlayers}
            className="lg:min-h-[200px]"
          />
        );

      case "sessionLog":
        if (!screenConfig.showSessionLog) return null;
        return (
          <div className="flex-1 min-h-[220px]">
            {!isMissing ? (
              <SessionLog campaignId={campaign.id} showDiceRolls={screenConfig.showDiceRolls} />
            ) : (
              <MissingSessionLog campaignId={campaign.id} />
            )}
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header Hero com Imagem de Capa e Gradiente */}
      <div
        className={`relative overflow-hidden mb-2 rounded-xl border px-4 py-2.5 shrink-0 shadow-lg ${
          isMissing
            ? "border-zinc-800 bg-[#0d0e12] font-mono shadow-rose-950/20"
            : "border-gray-800/80 bg-gray-900"
        }`}
        style={
          campaign.coverImageUrl
            ? {
                backgroundImage: `url(${campaign.coverImageUrl})`,
                backgroundSize: "cover",
                backgroundPosition: "center",
              }
            : undefined
        }
      >
        {campaign.coverImageUrl && (
          <div className="absolute inset-0 bg-gradient-to-r from-gray-950 via-gray-950/85 to-gray-950/60 pointer-events-none" />
        )}

        <div className="relative z-10 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <Link
              href="/master"
              className={`text-xs font-semibold transition-colors drop-shadow ${
                isMissing
                  ? "text-rose-400 hover:text-rose-300"
                  : "text-accent-hover hover:text-accent"
              }`}
            >
              ← Voltar
            </Link>
            <div
              className={`h-4 w-[1px] shrink-0 ${isMissing ? "bg-zinc-700" : "bg-dominant-border"}`}
            />
            <h1 className="text-base font-bold text-secondary-pure truncate drop-shadow-md">
              {campaign.name}
            </h1>
            {campaign.worldMapUrl && (
              <span className="shrink-0 rounded-full bg-emerald-950/90 border border-emerald-700/60 px-2 py-0.5 text-[10px] font-semibold text-emerald-300 drop-shadow">
                🗺️ Mapa Mundi
              </span>
            )}
            {isMissing ? (
              <span className="shrink-0 rounded bg-rose-950/90 border border-rose-800 px-2 py-0.5 text-[10px] text-rose-300 font-bold uppercase tracking-wider font-mono">
                <span>MISSING — Edição ZERO</span> {/* ARQUIVO CONFIDENCIAL */}
              </span>
            ) : campaign.rulesEngine === "fallout_2d20" ? (
              <span className="shrink-0 rounded bg-emerald-950/90 border border-emerald-500/60 px-2 py-0.5 text-[10px] text-emerald-300 font-bold uppercase tracking-wider font-mono">
                Fallout 2d20
              </span>
            ) : (
              <span className="hidden sm:inline-flex rounded bg-accent/20 border border-accent/40 px-2 py-0.5 text-[10px] text-accent-hover font-medium">
                {campaign.rulesEngine === "dual_d20_sum" ? "2d20 somado" : "d20 + mod"}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {campaign.rulesEngine === "fallout_2d20" && (
              <APTrackerWidget campaignId={campaign.id} isMaster />
            )}
            {!isMissing && (
              <button
                type="button"
                onClick={() => setShowContentOverlay(true)}
                className="bg-purple-600 hover:bg-purple-700 text-white rounded px-3 py-1.5 flex items-center gap-1"
                title="Gerenciar Conteúdo"
                aria-label="Gerenciar Conteúdo"
              >
                <Boxes size={16} />
              </button>
            )}
            <button
              type="button"
              onClick={() => setShowSettingsModal(true)}
              className="bg-purple-600 hover:bg-purple-700 text-white rounded px-3 py-1.5 flex items-center gap-1 shrink-0"
              title="Configurações e Edição da Campanha"
              aria-label="Configurações e Edição da Campanha"
            >
              <Settings size={16} />
            </button>
          </div>
        </div>
      </div>

      {popupBlockedWarning && (
        <div className="mb-2 flex items-center justify-between rounded-lg border border-amber-600/50 bg-amber-950/40 px-3 py-2 text-xs text-amber-200">
          <span>
            O navegador bloqueou a abertura da janela da Mesa. Permita pop-ups para este site para
            usar esta função.
          </span>
          <button
            onClick={() => setPopupBlockedWarning(false)}
            className="ml-2 font-bold text-amber-400 hover:underline"
          >
            Fechar
          </button>
        </div>
      )}

      <div
        ref={setShieldGridEl}
        data-testid="shield-grid"
        className={`flex-1 grid grid-cols-1 gap-2.5 overflow-hidden min-h-0 min-w-0 w-full ${isMesaPopped ? "lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]" : "lg:grid-cols-[var(--libmork-columns)]"}`}
        style={
          isMesaPopped
            ? undefined
            : ({
                "--w-l": `${shieldColumns.left}px`,
                "--w-r": `${shieldColumns.right}px`,
                "--libmork-columns": getShieldGridTemplate(hasRightColumn),
              } as CSSProperties)
        }
      >
        {/* ===== Coluna esquerda — módulos ordenados dinamicamente ===== */}
        <div
          data-testid="shield-left-column"
          className="relative flex flex-col gap-3 overflow-y-auto min-h-0 h-full min-w-0"
        >
          {screenConfig.leftColumnOrder.map((modId) => (
            <Fragment key={`left-${modId}`}>{renderModule(modId)}</Fragment>
          ))}

          <ResizeHandle
            direction="horizontal"
            position="bottom-right"
            onResize={(dx) => resizeShieldSide("left", dx)}
            title="Redimensionar coluna de gestão"
            data-testid="resize-left-column"
          />
        </div>

        {!isMesaPopped && (
          <div
            className={`relative flex flex-col h-full min-h-0 min-w-0 overflow-hidden rounded-xl border p-2.5 ${
              isMissing ? "border-zinc-800 bg-[#0d0e12]" : "border-gray-800 bg-gray-900"
            }`}
          >
            <MasterRoster
              key={`roster-${rosterVersion}`}
              campaignId={campaign.id}
              selectedWorldId={selectedWorldId}
              onTogglePopOut={() => setIsMesaPopped(true)}
              rulesEngine={campaign.rulesEngine}
              showRoster={screenConfig.showRoster}
              showCanvas={screenConfig.showCanvas}
              showMap={screenConfig.showMap}
              onResetConfig={resetScreenConfig}
            />

            {hasRightColumn && (
              <ResizeHandle
                direction="horizontal"
                position="bottom-right"
                onResize={(dx) => resizeShieldSide("right", -dx)}
                title="Redimensionar coluna da mesa"
                data-testid="resize-center-column"
              />
            )}
          </div>
        )}

        {/* ===== Coluna direita — módulos ordenados dinamicamente ===== */}
        {hasRightColumn && (
          <div
            data-testid="shield-right-column"
            className="relative flex flex-col gap-3 overflow-y-auto min-h-0 h-full min-w-0"
          >
            {screenConfig.rightColumnOrder.map((modId) => (
              <Fragment key={`right-${modId}`}>{renderModule(modId)}</Fragment>
            ))}

            {!isMesaPopped && (
              <ResizeHandle
                direction="horizontal"
                position="bottom-right"
                onResize={(dx) => resizeShieldSide("right", -dx)}
                title="Redimensionar coluna de logs"
                data-testid="resize-right-column"
              />
            )}
          </div>
        )}
      </div>

      {showContentOverlay && (
        <ContentOverlay
          campaignId={campaign.id}
          campaign={campaign}
          onClose={() => {
            setShowContentOverlay(false);
            setRosterVersion((v) => v + 1);
            void loadWorlds();
          }}
        />
      )}

      {overlayWorld && (
        <WorldOverlay
          campaignId={campaign.id}
          worldId={overlayWorld.id}
          worldName={overlayWorld.name}
          onClose={() => setOverlayWorld(null)}
          onChanged={() => setRosterVersion((v) => v + 1)}
        />
      )}

      {showSettingsModal && campaign && (
        <CampaignSettingsModal
          campaign={campaign}
          onClose={() => setShowSettingsModal(false)}
          onSaved={(updated) => {
            setCampaign(updated);
            if (updated.theme) {
              applyCampaignThemeOverride(updated.theme);
            }
          }}
          onDelete={handleDelete}
          isDeleting={isDeleting}
        />
      )}

      <WindowPortal
        isOpen={isMesaPopped}
        onClose={handleCloseMesaPopOut}
        title={`Mesa — ${campaign.name}`}
        width={1280}
        height={800}
        onBlocked={handleBlockedMesaPopOut}
      >
        <div className="flex flex-col h-full w-full overflow-hidden bg-gray-950 p-2.5">
          <MasterRoster
            key={`roster-popped-${rosterVersion}`}
            campaignId={campaign.id}
            selectedWorldId={selectedWorldId}
            isPoppedOut={true}
            onTogglePopOut={() => setIsMesaPopped(false)}
            rulesEngine={campaign.rulesEngine}
            showRoster={screenConfig.showRoster}
            showCanvas={screenConfig.showCanvas}
            showMap={screenConfig.showMap}
            onResetConfig={resetScreenConfig}
          />
        </div>
      </WindowPortal>
    </div>
  );
}
