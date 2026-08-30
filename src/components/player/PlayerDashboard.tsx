"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { Character, PlayerCampaign } from "@/types";
import { CharacterCard } from "@/components/characters/CharacterCard";
import { LogoutButton } from "@/components/auth/LogoutButton";
import { Spinner, Button } from "@/components/ui";
import { BottomNav } from "@/components/ui/BottomNav";
import { ToastContainer } from "@/components/ui/Toast";
import { CampaignsFilledIcon, CharactersFilledIcon } from "@/components/ui/Icons";
import { generateUUID } from "@/lib/utils/uuid";

export function PlayerDashboard() {
  const [activeTab, setActiveTab] = useState<"characters" | "campaigns">("characters");

  // Estado de Personagens
  const [characters, setCharacters] = useState<Character[]>([]);
  const [isLoadingCharacters, setIsLoadingCharacters] = useState(true);
  const [charactersError, setCharactersError] = useState<string | null>(null);

  // Estado de Campanhas
  const [campaigns, setCampaigns] = useState<PlayerCampaign[]>([]);
  const [isLoadingCampaigns, setIsLoadingCampaigns] = useState(true);
  const [campaignsError, setCampaignsError] = useState<string | null>(null);

  // Estado de Importação de Personagem
  const [importingCampaignId, setImportingCampaignId] = useState<string | null>(null);
  const [importableCharacters, setImportableCharacters] = useState<Character[]>([]);
  const [isLoadingImport, setIsLoadingImport] = useState(false);
  const [importSearch, setImportSearch] = useState("");

  // Toasts
  const [toasts, setToasts] = useState<Array<{ id: string; message: string; type?: "error" | "success" | "info" | "warning" }>>([]);
  const addToast = (message: string, type: "error" | "success" | "info" | "warning" = "info") => {
    setToasts((prev) => [...prev, { id: generateUUID(), message, type }]);
  };

  useEffect(() => {
    async function loadCharacters() {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      try {
        const response = await fetch("/api/characters", {
          credentials: "include",
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        if (!response.ok) {
          const data = await response.json().catch(() => ({}));

          if (response.status === 401) {
            await fetch("/api/auth/logout", { method: "POST", credentials: "include" }).catch(() => {});
            window.location.href = "/login";
            return;
          }

          setCharactersError(data.error || "Erro ao carregar personagens");
          setIsLoadingCharacters(false);
          return;
        }

        const data = await response.json();
        setCharacters(data.data || []);
      } catch (err: any) {
        clearTimeout(timeoutId);
        if (err.name === "AbortError") {
          setCharactersError("Tempo esgotado. Verifique sua conexão.");
        } else {
          setCharactersError("Erro de conexão. Tente novamente.");
        }
      } finally {
        setIsLoadingCharacters(false);
      }
    }

    async function loadCampaigns() {
      try {
        const response = await fetch("/api/player/campaigns", {
          credentials: "include",
        });

        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
          setCampaignsError(data.error || "Erro ao carregar campanhas");
          return;
        }

        const data = await response.json();
        setCampaigns(data.data || []);
      } catch {
        setCampaignsError("Erro de conexão ao carregar campanhas.");
      } finally {
        setIsLoadingCampaigns(false);
      }
    }

    void loadCharacters();
    void loadCampaigns();
  }, []);

  function handleOpenImportModal(
    campaignId: string,
    campaignCharacters: PlayerCampaign["characters"]
  ) {
    const linkedIds = new Set(campaignCharacters.map((c) => c.id));
    const available = characters.filter((c) => !linkedIds.has(c.id));

    if (available.length === 0) {
      addToast("Você não tem personagens para importar", "info");
      return;
    }

    setImportableCharacters(available);
    setImportingCampaignId(campaignId);
    setImportSearch("");
  }

  async function handleImportCharacter(characterId: string) {
    if (!importingCampaignId) return;

    setIsLoadingImport(true);
    try {
      const response = await fetch(
        `/api/campaigns/${importingCampaignId}/import-character`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ characterId }),
        }
      );

      if (response.status === 201) {
        addToast("Personagem vinculado com sucesso!", "success");

        // Re-fetch campanhas para atualizar a lista
        const campaignsResponse = await fetch("/api/player/campaigns", {
          credentials: "include",
        });
        if (campaignsResponse.ok) {
          const data = await campaignsResponse.json();
          setCampaigns(data.data || []);
        }

        setImportingCampaignId(null);
        setImportableCharacters([]);
        return;
      }

      if (response.status === 409) {
        addToast("Este personagem já está nesta campanha", "warning");
        return;
      }

      const data = await response.json().catch(() => ({}));
      addToast(data.error || "Erro ao importar personagem", "error");
    } catch {
      addToast("Erro de conexão. Tente novamente.", "error");
    } finally {
      setIsLoadingImport(false);
    }
  }

  const filteredImportableCharacters = importableCharacters.filter((c) =>
    c.name.toLowerCase().includes(importSearch.toLowerCase())
  );

  return (
    <div className="space-y-6 pb-20">
      <header className="flex items-center justify-between border border-secondary-border bg-secondary-card p-4 rounded-xl shadow-md">
        <div>
          <h1 className="text-xl font-bold text-secondary-pure">Libmork — Jogador</h1>
          <p className="text-xs text-secondary-muted">Gerencie seus heróis e campanhas</p>
        </div>
        <LogoutButton />
      </header>

      {/* Conteúdo da Aba 1: Meus Personagens */}
      {activeTab === "characters" && (
        <div>
          {isLoadingCharacters ? (
            <div className="flex min-h-[300px] items-center justify-center py-12">
              <Spinner size="lg" />
            </div>
          ) : charactersError ? (
            <div className="rounded-lg border border-accent-vibrant/40 bg-accent-dark/30 p-4 text-secondary-pure">
              {charactersError}
            </div>
          ) : characters.length === 0 ? (
            <div className="rounded-xl border border-gray-800 bg-gray-900/60 py-16 text-center">
              <p className="mb-4 text-secondary-muted">Você ainda não tem personagens.</p>
              <Link href="/player/characters/new">
                <Button variant="primary" className="px-6 py-3 font-semibold">
                  + Criar Personagem
                </Button>
              </Link>
            </div>
          ) : (
            <div>
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-2xl font-bold text-secondary-pure">Meus Personagens</h2>
                <Link href="/player/characters/new">
                  <Button variant="primary" className="px-4 py-2 font-semibold">
                    + Novo Personagem
                  </Button>
                </Link>
              </div>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {characters.map((character) => (
                  <CharacterCard key={character.id} character={character} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Conteúdo da Aba 2: Campanhas */}
      {activeTab === "campaigns" && (
        <div>
          {isLoadingCampaigns ? (
            <div className="flex min-h-[300px] items-center justify-center py-12">
              <Spinner size="lg" />
            </div>
          ) : campaignsError ? (
            <div className="rounded-lg border border-accent-vibrant/40 bg-accent-dark/30 p-4 text-secondary-pure">
              {campaignsError}
            </div>
          ) : campaigns.length === 0 ? (
            <div className="rounded-xl border border-gray-800 bg-gray-900/60 py-16 text-center">
              <p className="text-secondary-muted text-base">
                Você ainda não foi convidado para nenhuma campanha.
              </p>
              <p className="mt-2 text-xs text-gray-500">
                Peça ao seu Mestre para convidar o seu usuário pelo Escudo do Mestre.
              </p>
            </div>
          ) : (
            <div className="grid gap-6 md:grid-cols-2">
              {campaigns.map((campaign) => (
                <div
                  key={campaign.id}
                  className="flex flex-col justify-between rounded-xl border border-gray-800 bg-gray-900/90 p-5 shadow-lg transition-colors hover:border-gray-700"
                >
                  <div className="space-y-4">
                    {/* Cabeçalho da Campanha */}
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="text-xl font-bold text-white truncate">
                          {campaign.name}
                        </h3>
                        <span
                          className={`shrink-0 rounded px-2 py-0.5 text-[10px] font-semibold ${
                            campaign.pvpEnabled
                              ? "border border-red-800/60 bg-red-950/70 text-red-400"
                              : "border border-gray-700 bg-gray-800 text-gray-400"
                          }`}
                        >
                          {campaign.pvpEnabled ? "PvP Ativado" : "PvP Desativado"}
                        </span>
                      </div>
                      <p className="text-xs text-gray-400 mt-1">
                        Mestre: <span className="font-medium text-gray-200">{campaign.master.displayName}</span>
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2 text-xs">
                        <span className="rounded bg-purple-950/80 border border-purple-800/50 px-2 py-0.5 text-purple-300 font-medium">
                          Regras:{" "}
                          {campaign.rulesEngine === "dual_d20_sum"
                            ? "2d20 somado"
                            : "d20 + modificador"}
                        </span>
                      </div>
                    </div>

                    {/* Lista de Personagens na Campanha */}
                    <div className="border-t border-gray-800 pt-3">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-purple-400 mb-2">
                        Meus Personagens nesta Campanha ({campaign.characters.length})
                      </h4>

                      {campaign.characters.length === 0 ? (
                        <p className="text-xs text-gray-500 py-2">
                          Nenhum personagem criado nesta campanha ainda.
                        </p>
                      ) : (
                        <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                          {campaign.characters.map((char) => (
                            <div
                              key={char.id}
                              className="flex items-center justify-between rounded-lg border border-gray-800 bg-gray-950 p-2.5"
                            >
                              <div className="flex items-center gap-2.5 overflow-hidden">
                                {char.imageUrl ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img
                                    src={char.imageUrl}
                                    alt={char.name}
                                    className="h-9 w-9 rounded-full object-cover shrink-0"
                                  />
                                ) : (
                                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-purple-950 text-purple-300 font-bold text-xs shrink-0 border border-purple-800/60">
                                    {char.name.charAt(0).toUpperCase()}
                                  </div>
                                )}
                                <div className="min-w-0">
                                  <p className="truncate text-xs font-semibold text-white">
                                    {char.name}
                                  </p>
                                  <p className="text-[11px] text-gray-400">
                                    Nível {char.level} · HP:{" "}
                                    <span className="text-red-400 font-medium">
                                      {char.hitPointsCurrent}/{char.hitPointsMax}
                                    </span>
                                  </p>
                                </div>
                              </div>
                              <Link href={`/player/characters/${char.id}`}>
                                <Button
                                  variant="secondary"
                                  className="shrink-0 px-2.5 py-1 text-xs font-medium"
                                >
                                  Abrir Ficha
                                </Button>
                              </Link>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Botão de Criação de Personagem alinhado ao Bottom */}
                  <div className="mt-5 border-t border-gray-800 pt-3 space-y-2">
                    <Link
                      href={`/player/characters/new?campaignId=${campaign.id}`}
                      className="block w-full"
                    >
                      <Button
                        variant="primary"
                        className="w-full justify-center py-2 text-xs font-semibold"
                      >
                        + Criar Personagem nesta Campanha
                      </Button>
                    </Link>
                    <button
                      type="button"
                      onClick={() => handleOpenImportModal(campaign.id, campaign.characters)}
                      className="w-full rounded-xl border border-purple-800/60 bg-purple-950/40 py-2 text-xs font-semibold text-purple-300 hover:bg-purple-900/60 transition-colors"
                    >
                      ↩ Importar Personagem Existente
                    </button>
                  </div>
                </div>
              ))}
            </div>
            )}
        </div>
      )}

      <BottomNav
        activeId={activeTab}
        onChange={(id) => setActiveTab(id as typeof activeTab)}
        tabs={[
          {
            id: "characters",
            label: "Meus Personagens",
            icon: (
              <CharactersFilledIcon
                className={`h-6 w-6 ${activeTab === "characters" ? "fill-purple-400" : "fill-gray-500"}`}
              />
            ),
          },
          {
            id: "campaigns",
            label: "Campanhas",
            icon: (
              <CampaignsFilledIcon
                className={`h-6 w-6 ${activeTab === "campaigns" ? "fill-purple-400" : "fill-gray-500"}`}
              />
            ),
          },
        ]}
      />

      {/* Modal de Importação de Personagem */}
      {importingCampaignId !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
          <div className="w-full max-w-md rounded-xl border border-gray-800 bg-gray-900 p-5 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-white">Importar Personagem</h2>
              <button
                type="button"
                onClick={() => {
                  setImportingCampaignId(null);
                  setImportableCharacters([]);
                  setImportSearch("");
                }}
                className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-800 hover:text-white transition-colors"
              >
                ✕
              </button>
            </div>

            <input
              type="text"
              placeholder="Buscar por nome..."
              value={importSearch}
              onChange={(e) => setImportSearch(e.target.value)}
              className="mb-4 w-full rounded-lg border border-gray-800 bg-gray-950 px-3 py-2 text-sm text-white placeholder-gray-500 outline-none focus:border-purple-600"
            />

            <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
              {filteredImportableCharacters.length === 0 ? (
                <p className="py-4 text-center text-sm text-gray-500">
                  Nenhum personagem encontrado
                </p>
              ) : (
                filteredImportableCharacters.map((char) => (
                  <div
                    key={char.id}
                    className="flex items-center justify-between rounded-lg border border-gray-800 bg-gray-950 p-2.5"
                  >
                    <div className="flex items-center gap-2.5 overflow-hidden">
                      {char.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={char.imageUrl}
                          alt={char.name}
                          className="h-9 w-9 rounded-full object-cover shrink-0"
                        />
                      ) : (
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-purple-950 text-purple-300 font-bold text-xs shrink-0 border border-purple-800/60">
                          {char.name.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="truncate text-xs font-semibold text-white">
                          {char.name}
                        </p>
                        <p className="text-[11px] text-gray-400">
                          Nível {char.level} · HP:{" "}
                          <span className="text-red-400 font-medium">
                            {char.hitPointsCurrent}/{char.hitPointsMax}
                          </span>
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      disabled={isLoadingImport}
                      onClick={() => handleImportCharacter(char.id)}
                      className="shrink-0 rounded-lg border border-purple-800/60 bg-purple-950/60 px-3 py-1.5 text-xs font-semibold text-purple-300 hover:bg-purple-900/60 transition-colors disabled:opacity-50"
                    >
                      {isLoadingImport ? "…" : "Vincular"}
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      <ToastContainer
        toasts={toasts}
        onRemove={(id) => setToasts((prev) => prev.filter((t) => t.id !== id))}
      />
    </div>
  );
}
