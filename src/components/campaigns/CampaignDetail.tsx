"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import type { Campaign, World } from "@/types";
import { Spinner, WindowPortal } from "@/components/ui";
import { CampaignInvites } from "@/components/campaigns/CampaignInvites";
import { MasterRoster } from "@/components/campaigns/MasterRoster";
import { SessionLog } from "@/components/campaigns/SessionLog";
import { ContentOverlay } from "@/components/campaigns/ContentOverlay";
import { WorldOverlay } from "@/components/campaigns/WorldOverlay";

export function CampaignDetail() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [worlds, setWorlds] = useState<World[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const [worldError, setWorldError] = useState<string | null>(null);

  const [showContentOverlay, setShowContentOverlay] = useState(false);
  const [selectedWorldId, setSelectedWorldId] = useState<string>("");
  const worldsRequestId = useRef(0);
  const [overlayWorld, setOverlayWorld] = useState<{ id: string; name: string } | null>(null);
  const [rosterVersion, setRosterVersion] = useState(0);
  const [isMesaPopped, setIsMesaPopped] = useState(false);
  const [popupBlockedWarning, setPopupBlockedWarning] = useState(false);

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

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header Hero com Imagem de Capa e Gradiente */}
      <div
        className="relative overflow-hidden mb-2 rounded-xl border border-gray-800/80 bg-gray-900 px-4 py-2.5 shrink-0 shadow-lg"
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
              className="text-xs font-semibold text-purple-400 hover:text-purple-300 transition-colors drop-shadow"
            >
              ← Voltar
            </Link>
            <div className="h-4 w-[1px] bg-gray-700/80 shrink-0" />
            <h1 className="text-base font-bold text-white truncate drop-shadow-md">
              {campaign.name}
            </h1>
            {campaign.worldMapUrl && (
              <span className="shrink-0 rounded-full bg-emerald-950/90 border border-emerald-700/60 px-2 py-0.5 text-[10px] font-semibold text-emerald-300 drop-shadow">
                🗺️ Mapa Mundi
              </span>
            )}
            <span className="hidden sm:inline-flex rounded bg-purple-950/80 border border-purple-800/50 px-2 py-0.5 text-[10px] text-purple-300 font-medium">
              {campaign.rulesEngine === "dual_d20_sum" ? "2d20 somado" : "d20 + mod"}
            </span>
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

      <div className={`flex-1 grid gap-2.5 overflow-hidden min-h-0 ${isMesaPopped ? "lg:grid-cols-[1fr_1fr]" : "lg:grid-cols-[220px_minmax(0,1fr)_240px] xl:grid-cols-[240px_minmax(0,1fr)_260px]"}`}>
        {/* ===== Coluna esquerda — Gestão ===== */}
        <div className="space-y-3 overflow-y-auto min-h-0">
          <div className="rounded-lg border border-gray-800 bg-gray-900 p-3">
            <button
              onClick={() => setShowContentOverlay(true)}
              className="w-full rounded-lg bg-purple-600 px-3 py-2 text-sm font-semibold text-white hover:bg-purple-700"
            >
              Gerenciar Conteúdo
            </button>
          </div>

          <div className="rounded-lg border border-gray-800 bg-gray-900 p-3">
            <h3 className="mb-2 font-semibold text-white">Mundos</h3>

            {worldError && (
              <div className="mb-2 rounded-lg border border-red-800 bg-red-900/30 p-2 text-xs text-red-300">
                {worldError}
              </div>
            )}

            {worlds.length === 0 ? (
              <p className="mb-2 text-sm text-gray-400">Nenhum mundo criado ainda.</p>
            ) : (
              <div className="mb-3 space-y-2">
                {worlds.map((world) => (
                  <div
                    key={world.id}
                    className={`relative overflow-hidden rounded-lg border p-2 bg-cover bg-center transition-colors ${
                      selectedWorldId === world.id
                        ? "border-purple-500 bg-purple-950/60 ring-1 ring-purple-400/60"
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
                        <button
                          onClick={() => setSelectedWorldId(world.id)}
                          className="text-left text-sm font-semibold text-white hover:text-purple-300 drop-shadow-sm"
                        >
                          {world.name}
                        </button>
                        {selectedWorldId === world.id && (
                          <span className="mt-1 inline-block rounded-full bg-purple-600 px-2 py-0.5 text-[10px] font-bold text-white">
                            Selecionado
                          </span>
                        )}
                        {world.description && (
                          <p className="mt-0.5 text-xs text-gray-300 drop-shadow-sm">{world.description}</p>
                        )}
                        {world.mapUrl && (
                          <p className="mt-1 text-[10px] text-purple-400">🗺️ Possui mapa</p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

          </div>

          <CampaignInvites key={`invites-${rosterVersion}`} campaignId={campaign.id} />
        </div>

        {!isMesaPopped && (
          <div className="flex flex-col h-full min-h-0 overflow-hidden rounded-xl border border-gray-800 bg-gray-900 p-2.5">
            <MasterRoster
              key={`roster-${rosterVersion}`}
              campaignId={campaign.id}
              selectedWorldId={selectedWorldId}
              onWorldSelected={setSelectedWorldId}
              onTogglePopOut={() => setIsMesaPopped(true)}
            />
          </div>
        )}

        {/* ===== Coluna direita — Log da sessão ===== */}
        <SessionLog campaignId={campaign.id} />
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
        onClose={() => setIsMesaPopped(false)}
        title={`Mesa — ${campaign.name}`}
        width={1280}
        height={800}
        onBlocked={() => {
          setIsMesaPopped(false);
          setPopupBlockedWarning(true);
        }}
      >
        <div className="flex flex-col h-full w-full overflow-hidden bg-gray-950 p-2.5">
          <MasterRoster
            key={`roster-popped-${rosterVersion}`}
            campaignId={campaign.id}
            selectedWorldId={selectedWorldId}
            onWorldSelected={setSelectedWorldId}
            isPoppedOut={true}
            onTogglePopOut={() => setIsMesaPopped(false)}
          />
        </div>
      </WindowPortal>
    </div>
  );
}
