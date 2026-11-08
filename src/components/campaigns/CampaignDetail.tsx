"use client";

import { Fragment, useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Boxes, Settings } from "lucide-react";
import type { Campaign, Establishment, World } from "@/types";
import { ResizeHandle, Spinner, WindowPortal } from "@/components/ui";
import { useResizableLayout } from "@/hooks/useResizableLayout";
import { useSocket } from "@/context/SocketContext";
import { CampaignInvites } from "@/components/campaigns/CampaignInvites";
import { MasterRoster } from "@/components/campaigns/MasterRoster";
import { SessionLog } from "@/components/campaigns/SessionLog";
import { MissingSessionLog } from "@/components/systems/missing/MissingSessionLog";
import { ContentOverlay } from "@/components/campaigns/ContentOverlay";
import { WorldOverlay } from "@/components/campaigns/WorldOverlay";
import { MasterJukebox } from "./MasterJukebox";
import { MasterAssetsPanel } from "./MasterAssetsPanel";
import { CampaignSettingsModal } from "./CampaignSettingsModal";
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

  const worldsPanel = useResizableLayout({
    storageKey: campaign ? `libmork:campaign-worlds-panel:${campaign.id}` : undefined,
    initialHeight: 320,
    minHeight: 180,
    maxHeight: 600,
  });

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
      case "jukebox":
        return screenConfig.showJukebox;
      case "assets":
        return screenConfig.showAssets;
      case "worlds":
        return screenConfig.showMap;
      case "charactersNpcs":
        return screenConfig.showCharactersNpcs;
      case "players":
        return screenConfig.showPlayers;
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
    const next = delta > 0 ? Math.min(current + delta, Math.max(current, maxWidth)) : current + delta;
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
  // configurada (Issue #75). Mantém props, classes e handles existentes.
  const renderModule = (moduleId: ShieldModuleId) => {
    switch (moduleId) {
      case "jukebox":
        if (!screenConfig.showJukebox) return null;
        return (
          <MasterJukebox
            campaignId={campaign.id}
            userId={campaign.masterId}
            userName="Mestre"
            className="flex flex-col overflow-hidden rounded-lg border border-gray-800 bg-gray-900 p-3 lg:min-h-[160px] lg:flex-1"
          />
        );

      case "assets":
        if (!screenConfig.showAssets) return null;
        return (
          <MasterAssetsPanel
            campaignId={campaign.id}
            initialActiveAssetId={campaign.activeAssetId}
            className="flex flex-col overflow-hidden rounded-lg border border-secondary-border bg-secondary-card p-3 lg:min-h-[140px] lg:flex-1"
            isCompact={true}
          />
        );

      case "worlds": {
        if (!screenConfig.showMap) return null;
        return (
          <div
            className={`relative rounded-lg border p-3 overflow-y-auto lg:min-h-[180px] lg:flex-1 ${
              isMissing ? "border-zinc-800 bg-[#0e0f12] font-mono" : "border-gray-800 bg-gray-900"
            }`}
            style={{ flexBasis: `${worldsPanel.height}px` }}
          >
            <h3 className="mb-2 font-semibold text-white">
              {isMissing ? "Cenas / Locais de Investigação" : "Mundos"}
            </h3>

            {worldError && (
              <div className="mb-2 rounded-lg border border-red-800 bg-red-900/30 p-2 text-xs text-red-300">
                {worldError}
              </div>
            )}

            {worlds.length === 0 ? (
              <p className="mb-2 text-sm text-gray-400">
                {isMissing
                  ? "Nenhum local de investigação criado ainda."
                  : "Nenhum mundo criado ainda."}
              </p>
            ) : (
              <div className="mb-3 space-y-2">
                {worlds.map((world) => (
                  <div
                    key={world.id}
                    className={`relative overflow-hidden rounded-lg border p-2 bg-cover bg-center transition-colors ${
                      selectedWorldId === world.id
                        ? isMissing
                          ? "border-rose-600 bg-rose-950/40 ring-1 ring-rose-500/50"
                          : "border-accent bg-accent/20 ring-1 ring-accent/60"
                        : isMissing
                          ? "border-zinc-800 bg-zinc-950"
                          : "border-secondary-border bg-secondary-card"
                    }`}
                    style={
                      world.coverUrl ? { backgroundImage: `url(${world.coverUrl})` } : undefined
                    }
                  >
                    {world.coverUrl && (
                      <div className="absolute inset-0 bg-gradient-to-r from-gray-950/95 via-gray-950/85 to-gray-950/70" />
                    )}
                    <div className="relative z-10">
                      <div className="min-w-0">
                        <div className="flex items-center justify-between gap-1">
                          <button
                            onClick={() => setSelectedWorldId(world.id)}
                            className="text-left text-sm font-semibold text-secondary-pure hover:text-accent-hover drop-shadow-sm flex-1 truncate"
                          >
                            {world.name}
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setOverlayWorld(world);
                            }}
                            className="bg-purple-600 hover:bg-purple-700 text-white rounded px-3 py-1.5 flex items-center gap-1 shrink-0"
                            title="Abrir Detalhes do Local (NPCs, Encontros)"
                            aria-label={
                              isMissing ? `Ver cena de ${world.name}` : `Ver detalhes de ${world.name}`
                            }
                          >
                            <Settings size={16} />
                          </button>
                        </div>
                        {selectedWorldId === world.id && (
                          <span
                            className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-bold text-white ${
                              isMissing ? "bg-rose-700" : "bg-accent"
                            }`}
                          >
                            Selecionado
                          </span>
                        )}
                        {world.description && (
                          <p className="mt-0.5 text-xs text-secondary-muted drop-shadow-sm">
                            {world.description}
                          </p>
                        )}
                        {world.mapUrl && (
                          <p
                            className={`mt-1 text-[10px] ${isMissing ? "text-rose-400" : "text-accent-hover"}`}
                          >
                            🗺️ Possui mapa
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* ===== Estabelecimentos do Mundo Selecionado (apenas regras padrão d20) ===== */}
            {!isMissing && selectedWorldId && (
              <div className="rounded-lg border border-secondary-border bg-secondary-card p-3 mt-3">
                <button
                  type="button"
                  onClick={() => setIsEstablishmentsExpanded((prev) => !prev)}
                  className="mb-2 flex w-full items-center justify-between font-semibold text-xs text-secondary-pure"
                >
                  <span className="flex items-center gap-1">
                    <span>{isEstablishmentsExpanded ? "▼" : "►"}</span>
                    <span>🏬 Estabelecimentos</span>
                  </span>
                  <span className="text-[10px] font-normal text-accent-hover">
                    ({selectedWorldEstablishments.length})
                  </span>
                </button>

                <div
                  className={`grid transition-all duration-200 ${
                    isEstablishmentsExpanded
                      ? "grid-rows-[1fr] opacity-100"
                      : "grid-rows-[0fr] opacity-0"
                  }`}
                >
                  <div className="overflow-hidden">
                    {isEstablishmentsExpanded && (
                      <>
                        {selectedWorldEstablishments.length === 0 ? (
                          <p className="text-xs text-gray-500 italic">
                            Nenhum estabelecimento neste mundo.
                          </p>
                        ) : (
                          <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                            {selectedWorldEstablishments.map((est) => (
                              <div
                                key={est.id}
                                className="flex items-center justify-between rounded-lg border border-gray-800 bg-gray-950 p-2 text-xs"
                              >
                                <div className="min-w-0 flex-1 pr-2">
                                  <span className="font-semibold text-white block truncate">
                                    {est.name}
                                  </span>
                                  <span className="text-[10px] text-gray-400 block truncate">
                                    {est.type || "Geral"}
                                  </span>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => handleToggleEstablishment(est)}
                                  className={`rounded-full px-2 py-0.5 text-[10px] font-bold transition-all cursor-pointer shrink-0 whitespace-nowrap ${
                                    est.isOpen
                                      ? "bg-emerald-950/80 text-emerald-300 border border-emerald-800/80 hover:bg-emerald-900"
                                      : "bg-gray-800 text-gray-400 border border-gray-700 hover:text-white"
                                  }`}
                                >
                                  {est.isOpen ? "🟢 Aberto" : "⚪ Fechado"}
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>
            )}

            <ResizeHandle
              direction="vertical"
              onResize={(_, dy) => worldsPanel.handleResize(0, dy)}
              title="Redimensionar painel de mundos"
              data-testid="resize-worlds-panel"
            />
          </div>
        );
      }

      case "charactersNpcs":
        if (!screenConfig.showCharactersNpcs) return null;
        return (
          <CampaignInvites
            key={`invites-npcs-${rosterVersion}`}
            campaignId={campaign.id}
            showCharactersNpcs={true}
            showPlayers={false}
            className="flex flex-col overflow-hidden lg:min-h-[160px] lg:flex-1"
          />
        );

      case "players":
        if (!screenConfig.showPlayers) return null;
        return (
          <CampaignInvites
            key={`invites-players-${rosterVersion}`}
            campaignId={campaign.id}
            showCharactersNpcs={false}
            showPlayers={true}
            className="flex flex-col overflow-hidden lg:min-h-[160px] lg:flex-1"
          />
        );

      case "sessionLog":
        if (!screenConfig.showSessionLog) return null;
        return (
          <div className="flex-1 min-h-[220px]">
            {!isMissing ? (
              <SessionLog
                campaignId={campaign.id}
                showDiceRolls={screenConfig.showDiceRolls}
              />
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
            ) : (
              <span className="hidden sm:inline-flex rounded bg-accent/20 border border-accent/40 px-2 py-0.5 text-[10px] text-accent-hover font-medium">
                {campaign.rulesEngine === "dual_d20_sum" ? "2d20 somado" : "d20 + mod"}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
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
