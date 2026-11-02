"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
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
import { useMasterScreenConfig } from "@/hooks/useMasterScreenConfig";

export function CampaignDetail() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { socket } = useSocket();
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [worlds, setWorlds] = useState<World[]>([]);
  const [selectedWorldEstablishments, setSelectedWorldEstablishments] = useState<Establishment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

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
    minWidth: 180,
    maxWidth: 420,
  });

  const rightPanel = useResizableLayout({
    storageKey: campaign ? `libmork:campaign-right-panel:${campaign.id}` : undefined,
    initialWidth: 260,
    minWidth: 200,
    maxWidth: 460,
  });

  const centerPanel = useResizableLayout({
    storageKey: campaign ? `libmork:campaign-center-panel:${campaign.id}` : undefined,
    initialWidth: 640,
    minWidth: 360,
    maxWidth: 1400,
  });

  const { config: screenConfig, updateConfig: updateScreenConfig, resetConfig: resetScreenConfig } = useMasterScreenConfig();

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
        credentials: "include"
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
          credentials: "include"
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
          prev.map((item) => (item.id === est.id ? { ...item, isOpen: nextState } : item))
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
    if (!window.confirm("Tem certeza que deseja excluir esta campanha? Todos os mundos e vínculos serão removidos.")) {
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
      <div className="rounded-lg border border-red-800 bg-red-900/30 p-4 text-red-300">
        {error}
      </div>
    );
  }

  if (!campaign) {
    return null;
  }

  const isMissing = campaign.rulesEngine === "missing_zero";

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
                  : "text-purple-400 hover:text-purple-300"
              }`}
            >
              ← Voltar
            </Link>
            <div className={`h-4 w-[1px] shrink-0 ${isMissing ? "bg-zinc-700" : "bg-gray-700/80"}`} />
            <h1 className="text-base font-bold text-white truncate drop-shadow-md">
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
              <span className="hidden sm:inline-flex rounded bg-purple-950/80 border border-purple-800/50 px-2 py-0.5 text-[10px] text-purple-300 font-medium">
                {campaign.rulesEngine === "dual_d20_sum"
                  ? "2d20 somado"
                  : "d20 + mod"}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleDelete}
              disabled={isDeleting}
              className="rounded-lg bg-red-900/70 border border-red-700/60 px-2.5 py-1 text-xs font-semibold text-red-200 hover:bg-red-800 transition disabled:opacity-50 drop-shadow"
            >
              {isDeleting ? "Excluindo..." : "Excluir"}
            </button>
          </div>
        </div>
      </div>

      {popupBlockedWarning && (
        <div className="mb-2 flex items-center justify-between rounded-lg border border-amber-600/50 bg-amber-950/40 px-3 py-2 text-xs text-amber-200">
          <span>O navegador bloqueou a abertura da janela da Mesa. Permita pop-ups para este site para usar esta função.</span>
          <button
            onClick={() => setPopupBlockedWarning(false)}
            className="ml-2 font-bold text-amber-400 hover:underline"
          >
            Fechar
          </button>
        </div>
      )}

      <div
        className={`flex-1 grid grid-cols-1 gap-2.5 overflow-hidden min-h-0 ${isMesaPopped ? "lg:grid-cols-[1fr_1fr]" : "lg:grid-cols-[var(--libmork-columns)]"}`}
        style={
          isMesaPopped
            ? undefined
            : ({
                "--libmork-columns": screenConfig.showSessionLog
                  ? `${leftPanel.width}px ${centerPanel.width}px ${rightPanel.width}px`
                  : `${leftPanel.width}px ${centerPanel.width}px`,
              } as CSSProperties)
        }
      >
        {/* ===== Coluna esquerda — Gestão ===== */}
        <div className="relative space-y-3 overflow-y-auto min-h-0">
          {/* Jukebox de Áudio (Issue #60) */}
          <MasterJukebox
            campaignId={campaign.id}
            userId=""
            userName="Mestre"
            className="rounded-lg border border-gray-800 bg-gray-900 p-3"
          />

          {!isMissing && (
            <div className="rounded-lg border border-gray-800 bg-gray-900 p-3">
              <button
                onClick={() => setShowContentOverlay(true)}
                className="w-full rounded-lg bg-purple-600 px-3 py-2 text-sm font-semibold text-white hover:bg-purple-700"
              >
                Gerenciar Conteúdo
              </button>
            </div>
          )}

          <div
            className={`relative rounded-lg border p-3 overflow-y-auto ${
              isMissing ? "border-zinc-800 bg-[#0e0f12] font-mono" : "border-gray-800 bg-gray-900"
            }`}
            style={{ height: `${worldsPanel.height}px` }}
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
                {isMissing ? "Nenhum local de investigação criado ainda." : "Nenhum mundo criado ainda."}
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
                          : "border-purple-500 bg-purple-950/60 ring-1 ring-purple-400/60"
                        : isMissing
                          ? "border-zinc-800 bg-zinc-950"
                          : "border-gray-800 bg-gray-950"
                    }`}
                    style={
                      world.coverUrl
                        ? { backgroundImage: `url(${world.coverUrl})` }
                        : undefined
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
                            className="text-left text-sm font-semibold text-white hover:text-purple-300 drop-shadow-sm flex-1 truncate"
                          >
                            {world.name}
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setOverlayWorld(world);
                            }}
                            className={`rounded-lg border px-2 py-1 text-[11px] font-bold transition-colors shrink-0 ${
                              isMissing
                                ? "bg-zinc-800 border-zinc-700 text-zinc-200 hover:bg-zinc-700"
                                : "bg-purple-900/60 border-purple-700/80 text-purple-200 hover:bg-purple-800"
                            }`}
                            title="Abrir Detalhes do Local (NPCs, Encontros)"
                          >
                            {isMissing ? "⚙️ Ver Cena" : "⚙️ Ver Detalhes"}
                          </button>
                        </div>
                        {selectedWorldId === world.id && (
                          <span
                            className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-bold text-white ${
                              isMissing ? "bg-rose-700" : "bg-purple-600"
                            }`}
                          >
                            Selecionado
                          </span>
                        )}
                        {world.description && (
                          <p className="mt-0.5 text-xs text-gray-300 drop-shadow-sm">{world.description}</p>
                        )}
                        {world.mapUrl && (
                          <p className={`mt-1 text-[10px] ${isMissing ? "text-rose-400" : "text-purple-400"}`}>
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
              <div className="rounded-lg border border-gray-800 bg-gray-900 p-3 mt-3">
                <button
                  type="button"
                  onClick={() => setIsEstablishmentsExpanded((prev) => !prev)}
                  className="mb-2 flex w-full items-center justify-between font-semibold text-xs text-white"
                >
                  <span className="flex items-center gap-1">
                    <span>{isEstablishmentsExpanded ? "▼" : "►"}</span>
                    <span>🏬 Estabelecimentos</span>
                  </span>
                  <span className="text-[10px] font-normal text-purple-400">
                    ({selectedWorldEstablishments.length})
                  </span>
                </button>

                <div
                  className={`grid transition-all duration-200 ${
                    isEstablishmentsExpanded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
                  }`}
                >
                  <div className="overflow-hidden">
                    {isEstablishmentsExpanded && (
                      <>
                        {selectedWorldEstablishments.length === 0 ? (
                          <p className="text-xs text-gray-500 italic">Nenhum estabelecimento neste mundo.</p>
                        ) : (
                          <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                            {selectedWorldEstablishments.map((est) => (
                              <div
                                key={est.id}
                                className="flex items-center justify-between rounded-lg border border-gray-800 bg-gray-950 p-2 text-xs"
                              >
                                <div className="min-w-0 flex-1 pr-2">
                                  <span className="font-semibold text-white block truncate">{est.name}</span>
                                  <span className="text-[10px] text-gray-400 block truncate">
                                    {est.type || "Geral"}
                                  </span>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => handleToggleEstablishment(est)}
                                  className={`rounded-full px-2 py-0.5 text-[10px] font-bold transition-all cursor-pointer ${
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

          <CampaignInvites key={`invites-${rosterVersion}`} campaignId={campaign.id} />

          <ResizeHandle
            direction="horizontal"
            position="bottom-right"
            onResize={(dx) => leftPanel.handleResize(dx, 0)}
            title="Redimensionar coluna de gestão"
            data-testid="resize-left-column"
          />
        </div>

        {!isMesaPopped && (
          <div
            className={`relative flex flex-col h-full min-h-0 overflow-hidden rounded-xl border p-2.5 ${
              isMissing ? "border-zinc-800 bg-[#0d0e12]" : "border-gray-800 bg-gray-900"
            }`}
          >
            <MasterRoster
              key={`roster-${rosterVersion}`}
              campaignId={campaign.id}
              selectedWorldId={selectedWorldId}
              onWorldSelected={setSelectedWorldId}
              onTogglePopOut={() => setIsMesaPopped(true)}
              rulesEngine={campaign.rulesEngine}
              showRoster={screenConfig.showRoster}
              showCanvas={screenConfig.showCanvas}
              showMap={screenConfig.showMap}
              onResetConfig={resetScreenConfig}
            />

            <ResizeHandle
              direction="horizontal"
              position="bottom-right"
              onResize={(dx) => centerPanel.handleResize(dx, 0)}
              title="Redimensionar coluna da mesa"
              data-testid="resize-center-column"
            />
          </div>
        )}

        {/* ===== Coluna direita — Log da sessão ===== */}
        {screenConfig.showSessionLog && (
          <div className="relative flex flex-col h-full max-h-full min-h-0 overflow-hidden">
            {!isMissing ? (
              <SessionLog campaignId={campaign.id} />
            ) : (
              <MissingSessionLog campaignId={campaign.id} />
            )}

            {!isMesaPopped && (
              <ResizeHandle
                direction="horizontal"
                position="bottom-right"
                onResize={(dx) => rightPanel.handleResize(-dx, 0)}
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
            onWorldSelected={setSelectedWorldId}
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
