"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { Character, PlayerCampaign } from "@/types";
import type { MissingHabitant, EquipmentStatus } from "@/lib/systems/missing/types";
import { CharacterCard } from "@/components/characters/CharacterCard";
import { MissingHabitantCard } from "@/components/systems/missing/MissingHabitantCard";
import { MissingHabitantSheet } from "@/components/systems/missing/MissingHabitantSheet";
import { LogoutButton } from "@/components/auth/LogoutButton";
import { Spinner, Button } from "@/components/ui";
import { BottomNav } from "@/components/ui/BottomNav";
import { ToastContainer } from "@/components/ui/Toast";
import { CampaignsFilledIcon, CharactersFilledIcon, TreasuryIcon } from "@/components/ui/Icons";
import { WealthManager, type WealthData } from "@/components/player/WealthManager";
import { generateUUID } from "@/lib/utils/uuid";

export function PlayerDashboard() {
  const [activeTab, setActiveTab] = useState<"characters" | "campaigns" | "wealth">("characters");

  // Estado de Personagens
  const [characters, setCharacters] = useState<Character[]>([]);
  const [missingHabitants, setMissingHabitants] = useState<MissingHabitant[]>([]);
  const [selectedHabitant, setSelectedHabitant] = useState<MissingHabitant | null>(null);
  const [isLoadingCharacters, setIsLoadingCharacters] = useState(true);
  const [charactersError, setCharactersError] = useState<string | null>(null);

  // Estado de Campanhas
  const [campaigns, setCampaigns] = useState<PlayerCampaign[]>([]);
  const [selectedCampaign, setSelectedCampaign] = useState<PlayerCampaign | null>(null);
  const [isLoadingCampaigns, setIsLoadingCampaigns] = useState(true);
  const [campaignsError, setCampaignsError] = useState<string | null>(null);

  // Estado de Tesouraria / Wealth
  const [wealthData, setWealthData] = useState<WealthData | null>(null);
  const [isLoadingWealth, setIsLoadingWealth] = useState(true);
  const [wealthError, setWealthError] = useState<string | null>(null);

  // Estado de Importação de Personagem / Habitante
  const [importingCampaignId, setImportingCampaignId] = useState<string | null>(null);
  const [importableCharacters, setImportableCharacters] = useState<Character[]>([]);
  const [importableHabitants, setImportableHabitants] = useState<MissingHabitant[]>([]);
  const [isLoadingImport, setIsLoadingImport] = useState(false);
  const [importSearch, setImportSearch] = useState("");

  // Toasts
  const [toasts, setToasts] = useState<Array<{ id: string; message: string; type?: "error" | "success" | "info" | "warning" }>>([]);
  const addToast = (message: string, type: "error" | "success" | "info" | "warning" = "info") => {
    setToasts((prev) => [...prev, { id: generateUUID(), message, type }]);
  };

  const loadCharacters = async () => {
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
    } catch (err: unknown) {
      clearTimeout(timeoutId);
      if (err instanceof Error && err.name === "AbortError") {
        setCharactersError("Tempo esgotado. Verifique sua conexão.");
      } else {
        setCharactersError("Erro de conexão. Tente novamente.");
      }
    } finally {
      setIsLoadingCharacters(false);
    }
  };

  const loadCampaigns = async () => {
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
      const updatedCampaigns: PlayerCampaign[] = data.data || [];
      setCampaigns(updatedCampaigns);
      setSelectedCampaign((prevSelected) => {
        if (!prevSelected) return null;
        return updatedCampaigns.find((c) => c.id === prevSelected.id) || null;
      });
    } catch {
      setCampaignsError("Erro de conexão ao carregar campanhas.");
    } finally {
      setIsLoadingCampaigns(false);
    }
  };

  const loadMissingHabitants = async () => {
    try {
      const response = await fetch("/api/systems/missing/habitants", {
        credentials: "include",
      });
      if (!response.ok) {
        setMissingHabitants([]);
        return;
      }
      const data = await response.json().catch(() => ({}));
      setMissingHabitants(data.data || []);
    } catch {
      setMissingHabitants([]);
    }
  };

  const loadWealth = async () => {
    try {
      const response = await fetch("/api/player/wealth", {
        credentials: "include",
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        setWealthError(data.error || "Erro ao carregar tesouraria");
        return;
      }

      const data = await response.json();
      setWealthData(data.data || null);
    } catch {
      setWealthError("Erro de conexão ao carregar tesouraria.");
    } finally {
      setIsLoadingWealth(false);
    }
  };

  useEffect(() => {
    void loadCharacters();
    void loadMissingHabitants();
    void loadCampaigns();
    void loadWealth();
  }, []);

  const refreshWealth = async () => {
    try {
      const response = await fetch("/api/player/wealth", {
        credentials: "include",
      });
      if (response.ok) {
        const data = await response.json();
        setWealthData(data.data || null);
      }
    } catch {
      // ignore
    }
  };

  function handleOpenImportModal(
    campaignId: string,
    campaignCharacters: PlayerCampaign["characters"]
  ) {
    const targetCampaign =
      (selectedCampaign?.id === campaignId ? selectedCampaign : null) ||
      campaigns.find((c) => c.id === campaignId);

    const isMissing = targetCampaign?.rulesEngine === "missing_zero";

    if (isMissing) {
      const available = missingHabitants.filter((h) => h.campaignId !== campaignId);

      if (available.length === 0) {
        addToast("Você não tem habitantes para importar", "info");
        return;
      }

      setImportableHabitants(available);
      setImportableCharacters([]);
      setImportingCampaignId(campaignId);
      setImportSearch("");
      return;
    }

    const linkedIds = new Set(campaignCharacters.map((c) => c.id));
    const available = characters.filter((c) => !linkedIds.has(c.id));

    if (available.length === 0) {
      addToast("Você não tem personagens para importar", "info");
      return;
    }

    setImportableCharacters(available);
    setImportableHabitants([]);
    setImportingCampaignId(campaignId);
    setImportSearch("");
  }

  async function handleImportCharacter(characterId: string) {
    if (!importingCampaignId) return;

    setIsLoadingImport(true);
    try {
      const targetCampaign =
        (selectedCampaign?.id === importingCampaignId ? selectedCampaign : null) ||
        campaigns.find((c) => c.id === importingCampaignId);
      const isMissing = targetCampaign?.rulesEngine === "missing_zero";

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
        addToast(
          isMissing
            ? "Habitante vinculado com sucesso!"
            : "Personagem vinculado com sucesso!",
          "success"
        );

        // Recarregar campanhas e recarregar habitantes
        await Promise.all([loadCampaigns(), loadMissingHabitants()]);

        setImportingCampaignId(null);
        setImportableCharacters([]);
        setImportableHabitants([]);
        return;
      }

      if (response.status === 409) {
        addToast(
          isMissing
            ? "Este habitante já está nesta campanha"
            : "Este personagem já está nesta campanha",
          "warning"
        );
        return;
      }

      const data = await response.json().catch(() => ({}));
      addToast(
        data.error ||
          (isMissing ? "Erro ao importar habitante" : "Erro ao importar personagem"),
        "error"
      );
    } catch {
      addToast("Erro de conexão. Tente novamente.", "error");
    } finally {
      setIsLoadingImport(false);
    }
  }

  const handleEraseHabitantLine = async (lineId: string, reason?: string) => {
    if (!selectedHabitant) return;
    try {
      const res = await fetch(`/api/systems/missing/habitants/${selectedHabitant.id}/erase`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ lineId, reason }),
      });
      if (res.ok) {
        const json = await res.json();
        const updated: MissingHabitant = json.data;
        setSelectedHabitant(updated);
        setMissingHabitants((prev) => prev.map((h) => (h.id === updated.id ? updated : h)));
        setSelectedCampaign((prev) => {
          if (!prev || !prev.habitants) return prev;
          return {
            ...prev,
            habitants: prev.habitants.map((h) => (h.id === updated.id ? updated : h)),
          };
        });
      } else {
        const errData = await res.json().catch(() => ({}));
        addToast(errData.error || "Erro ao rasurar linha", "error");
      }
    } catch {
      addToast("Erro de conexão ao rasurar linha", "error");
    }
  };

  const handleAddHabitantLine = async (text: string) => {
    if (!selectedHabitant) return;
    try {
      const res = await fetch(`/api/systems/missing/habitants/${selectedHabitant.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ addLine: text }),
      });
      if (res.ok) {
        const json = await res.json();
        const updated: MissingHabitant = json.data;
        setSelectedHabitant(updated);
        setMissingHabitants((prev) => prev.map((h) => (h.id === updated.id ? updated : h)));
        setSelectedCampaign((prev) => {
          if (!prev || !prev.habitants) return prev;
          return {
            ...prev,
            habitants: prev.habitants.map((h) => (h.id === updated.id ? updated : h)),
          };
        });
      } else {
        const errData = await res.json().catch(() => ({}));
        addToast(errData.error || "Erro ao adicionar linha", "error");
      }
    } catch {
      addToast("Erro de conexão ao adicionar linha", "error");
    }
  };

  const handleUpdateHabitantEquipment = async (
    slot: 1 | 2 | 3,
    equipment: { name: string; notes?: string; status: EquipmentStatus },
  ) => {
    if (!selectedHabitant) return;
    try {
      const res = await fetch(`/api/systems/missing/habitants/${selectedHabitant.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          equipment: {
            slot,
            ...equipment,
          },
        }),
      });
      if (res.ok) {
        const json = await res.json();
        const updated: MissingHabitant = json.data;
        setSelectedHabitant(updated);
        setMissingHabitants((prev) => prev.map((h) => (h.id === updated.id ? updated : h)));
        setSelectedCampaign((prev) => {
          if (!prev || !prev.habitants) return prev;
          return {
            ...prev,
            habitants: prev.habitants.map((h) => (h.id === updated.id ? updated : h)),
          };
        });
      } else {
        const errData = await res.json().catch(() => ({}));
        addToast(errData.error || "Erro ao atualizar equipamento", "error");
      }
    } catch {
      addToast("Erro de conexão ao atualizar equipamento", "error");
    }
  };

  const filteredImportableCharacters = importableCharacters.filter((c) =>
    c.name.toLowerCase().includes(importSearch.toLowerCase())
  );

  const filteredImportableHabitants = importableHabitants.filter((h) =>
    h.name.toLowerCase().includes(importSearch.toLowerCase())
  );

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setSelectedCampaign(null);
        setImportingCampaignId(null);
        setImportableCharacters([]);
        setImportableHabitants([]);
        setSelectedHabitant(null);
      }
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, []);

  return (
    <div className="space-y-6 pb-[calc(6rem+env(safe-area-inset-bottom,0px))]">
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
          ) : characters.length === 0 && missingHabitants.length === 0 ? (
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
                {missingHabitants.map((habitant) => (
                  <MissingHabitantCard
                    key={habitant.id}
                    habitant={habitant}
                    onOpen={(h) => setSelectedHabitant(h)}
                  />
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
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {campaigns.map((campaign) => (
                <div
                  key={campaign.id}
                  className="group relative overflow-hidden flex flex-col justify-between rounded-xl border border-secondary-border bg-secondary-card p-5 transition-all hover:border-accent hover:shadow-[0_0_20px_rgba(147,51,234,0.25)] cursor-pointer"
                  style={
                    campaign.coverImageUrl
                      ? {
                          backgroundImage: `url(${campaign.coverImageUrl})`,
                          backgroundSize: "cover",
                          backgroundPosition: "center",
                        }
                      : undefined
                  }
                  onClick={() => setSelectedCampaign(campaign)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setSelectedCampaign(campaign);
                    }
                  }}
                  role="button"
                  tabIndex={0}
                  aria-label={`Ver detalhes da campanha ${campaign.name}`}
                >
                  {campaign.coverImageUrl && (
                    <div className="absolute inset-0 bg-gradient-to-t from-gray-950 via-gray-950/85 to-gray-950/65 group-hover:via-gray-950/75 transition-colors pointer-events-none" />
                  )}

                  <div className="relative z-10 flex flex-col justify-between h-full space-y-3">
                    <div>
                      {/* Topo do Card: Nome e Tags no canto superior direito (PvP + Mapa) */}
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="text-lg font-bold text-secondary-pure drop-shadow-md group-hover:text-purple-200 transition-colors truncate">
                          {campaign.name}
                        </h3>
                        <div className="flex shrink-0 items-center gap-1.5">
                          {campaign.pvpEnabled && (
                            <span className="rounded bg-accent-dark/90 border border-accent-vibrant/50 px-2 py-0.5 text-[10px] font-semibold text-secondary-pure drop-shadow">
                              PvP
                            </span>
                          )}
                          {campaign.worldMapUrl && (
                            <span className="rounded-full bg-emerald-950/90 border border-emerald-700/60 px-2 py-0.5 text-[10px] font-semibold text-emerald-300 drop-shadow">
                              🗺️ Mapa
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Mestre */}
                      <p className="mt-1 text-xs text-gray-300 drop-shadow-sm">
                        Mestre: <span className="font-medium text-white">{campaign.master.displayName}</span>
                      </p>

                      {/* Tags de Regras */}
                      <div className="mt-3 flex flex-wrap gap-2 text-xs text-secondary-muted">
                        <span className="inline-flex items-center gap-1 rounded bg-dominant-dark/90 border border-dominant-border px-2 py-1 text-white text-[11px] drop-shadow-sm">
                          {campaign.rulesEngine === "d20_mod" ? (
                            /* eslint-disable-next-line @next/next/no-img-element */
                            <img
                              src="/DD-Logo.png"
                              alt="D&D"
                              className="h-4 w-auto object-contain inline-block"
                            />
                          ) : campaign.rulesEngine === "missing_zero" ? (
                            <span className="text-red-300 font-semibold font-mono">MISSING — Edição ZERO</span>
                          ) : (
                            "2d20 somado"
                          )}
                        </span>
                      </div>
                    </div>

                    {/* Personagens da Campanha (Avatar Stack) */}
                    <div className="border-t border-secondary-border/60 pt-3">
                      {(() => {
                        const rosterItems =
                          campaign.roster && campaign.roster.length > 0
                            ? campaign.roster
                            : campaign.characters.map((c) => ({
                                id: c.id,
                                name: c.name,
                                imageUrl: c.imageUrl,
                                isMine: true,
                              }));

                        if (rosterItems.length === 0) {
                          return (
                            <div className="flex items-center gap-2 py-1 text-xs text-gray-500">
                              <span className="inline-block h-2 w-2 rounded-full bg-gray-700" />
                              <span>Nenhum personagem vinculado</span>
                            </div>
                          );
                        }

                        // Ordenar: primeiro os do jogador (isMine === true), depois os outros
                        const sortedRoster = [...rosterItems].sort((a, b) => {
                          if (a.isMine === b.isMine) return 0;
                          return a.isMine ? -1 : 1;
                        });

                        const maxVisible = 5;
                        const visibleChars = sortedRoster.slice(0, maxVisible);
                        const overflowCount = sortedRoster.length - maxVisible;

                        return (
                          <div className="flex items-center">
                            <div className="flex items-center -space-x-2">
                              {visibleChars.map((char) => (
                                <div
                                  key={char.id}
                                  title={`${char.name}${char.isMine ? " (Seu personagem)" : ""}`}
                                  className={`relative inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold transition-transform hover:scale-110 hover:z-30 ${
                                    char.isMine
                                      ? "ring-2 ring-purple-500 z-20 shadow-md"
                                      : "ring-2 ring-gray-900 z-10"
                                  }`}
                                >
                                  {char.imageUrl ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img
                                      src={char.imageUrl}
                                      alt={char.name}
                                      className="h-full w-full rounded-full object-cover"
                                    />
                                  ) : (
                                    <div
                                      className={`flex h-full w-full items-center justify-center rounded-full uppercase ${
                                        char.isMine
                                          ? "bg-purple-950 text-purple-200 border border-purple-600/60"
                                          : "bg-gray-800 text-gray-300 border border-gray-700"
                                      }`}
                                    >
                                      {char.name.charAt(0) || "?"}
                                    </div>
                                  )}
                                </div>
                              ))}
                              {overflowCount > 0 && (
                                <div
                                  title={`+${overflowCount} outros personagens`}
                                  className="relative inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-800 text-[11px] font-bold text-gray-300 ring-2 ring-gray-900 z-0"
                                >
                                  +{overflowCount}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            )}
        </div>
      )}

      {/* Conteúdo da Aba 3: Tesouraria (Wealth) */}
      {activeTab === "wealth" && (
        <WealthManager
          initialData={wealthData}
          isLoading={isLoadingWealth}
          error={wealthError}
          onRefresh={refreshWealth}
          onShowToast={addToast}
        />
      )}

      <ToastContainer
        toasts={toasts}
        onRemove={(id) => setToasts((prev) => prev.filter((t) => t.id !== id))}
      />

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
          {
            id: "wealth",
            label: "Tesouraria",
            icon: (
              <TreasuryIcon
                className={`h-6 w-6 ${activeTab === "wealth" ? "text-purple-400" : "text-gray-500"}`}
              />
            ),
          },
        ]}
      />

      {/* Overlay de Detalhes da Campanha */}
      {selectedCampaign !== null && importingCampaignId === null && (() => {
        const isMissing = selectedCampaign.rulesEngine === "missing_zero";
        const campaignHabitants: MissingHabitant[] = isMissing
          ? (selectedCampaign.habitants && selectedCampaign.habitants.length > 0
              ? selectedCampaign.habitants
              : missingHabitants.filter((h) => h.campaignId === selectedCampaign.id).length > 0
                ? missingHabitants.filter((h) => h.campaignId === selectedCampaign.id)
                : selectedCampaign.characters.map((c) => ({
                    id: c.id,
                    campaignId: selectedCampaign.id,
                    ownerId: "",
                    name: c.name,
                    status: (c.hitPointsCurrent > 0 ? "active" : "missing") as "active" | "missing",
                    lines: [],
                    equipments: [
                      { id: "1", slot: 1 as const, name: "", notes: "", status: "active" as const },
                      { id: "2", slot: 2 as const, name: "", notes: "", status: "active" as const },
                      { id: "3", slot: 3 as const, name: "", notes: "", status: "active" as const },
                    ],
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                  })))
          : [];

        const hasAliveCharacter = isMissing
          ? (campaignHabitants.length > 0
              ? campaignHabitants.some((h) => h.status === "active")
              : selectedCampaign.characters.some((c) => c.hitPointsCurrent > 0))
          : selectedCampaign.characters.some((char) => char.hitPointsCurrent > 0);

        return (
          <div
            className="fixed inset-0 z-40 flex items-center justify-center bg-black/75 p-4"
            onClick={() => setSelectedCampaign(null)}
            role="presentation"
          >
            <div
              className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl border border-gray-800 bg-gray-900 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-labelledby="campaign-details-title"
            >
              {/* Botão Fechar flutuante */}
              <button
                type="button"
                aria-label="Fechar"
                onClick={() => setSelectedCampaign(null)}
                className="absolute top-3.5 right-3.5 z-30 rounded-lg bg-gray-950/80 backdrop-blur-md p-1.5 text-gray-400 hover:bg-gray-800 hover:text-white transition-colors"
              >
                ✕
              </button>

              {/* Banner Hero com a imagem da campanha */}
              {selectedCampaign.coverImageUrl && (
                <div className="relative h-40 sm:h-48 w-full overflow-hidden border-b border-gray-800/80">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={selectedCampaign.coverImageUrl}
                    alt={selectedCampaign.name}
                    className="h-full w-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-gray-900 via-gray-900/60 to-black/40" />
                </div>
              )}

              <div className="p-5 space-y-5">
                {/* Topo do Modal: Badges e Informações da Campanha */}
                <div className="pr-10">
                  <div className="flex flex-wrap items-center gap-1.5 mb-2.5">
                    {/* Regras */}
                    {selectedCampaign.rulesEngine === "d20_mod" ? (
                      <span className="inline-flex items-center gap-1 rounded bg-dominant-dark/90 border border-dominant-border px-2 py-0.5 text-white text-[11px] font-medium drop-shadow-sm">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src="/DD-Logo.png"
                          alt="D&D"
                          className="h-3.5 w-auto object-contain inline-block"
                        />
                      </span>
                    ) : selectedCampaign.rulesEngine === "missing_zero" ? (
                      <span className="inline-flex items-center gap-1 rounded bg-red-950/90 border border-red-900/60 px-2.5 py-0.5 text-red-300 text-[11px] font-semibold tracking-wider font-mono drop-shadow-sm">
                        MISSING — Edição ZERO
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded bg-dominant-dark/90 border border-dominant-border px-2 py-0.5 text-white text-[11px] font-medium drop-shadow-sm">
                        2d20 somado
                      </span>
                    )}

                    {/* PvP */}
                    {selectedCampaign.pvpEnabled && (
                      <span className="rounded bg-accent-dark/90 border border-accent-vibrant/50 px-2 py-0.5 text-[10px] font-semibold text-secondary-pure drop-shadow">
                        PvP Habilitado
                      </span>
                    )}

                    {/* Mapa */}
                    {selectedCampaign.worldMapUrl && (
                      <a
                        href={selectedCampaign.worldMapUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 rounded-full bg-emerald-950/90 border border-emerald-700/60 px-2.5 py-0.5 text-[10px] font-semibold text-emerald-300 drop-shadow hover:bg-emerald-900 transition-colors"
                      >
                        🗺️ Mapa Mundi
                      </a>
                    )}
                  </div>

                  <h2 id="campaign-details-title" className="text-2xl font-bold text-white leading-tight">
                    {selectedCampaign.name}
                  </h2>
                  <p className="mt-1 text-sm text-gray-400">
                    Mestre: <span className="font-medium text-gray-200">{selectedCampaign.master.displayName}</span>
                  </p>
                </div>

                {/* Detalhes / Descrição */}
                <div className="rounded-lg border border-gray-800 bg-gray-950/60 p-4">
                  <h3 className="text-sm font-semibold text-purple-300">Detalhes da Campanha</h3>
                  <p className="mt-2 whitespace-pre-wrap text-sm text-gray-300 leading-relaxed">
                    {selectedCampaign.description || "Nenhuma descrição fornecida."}
                  </p>
                </div>

                {/* Meus Personagens / Habitantes nesta campanha */}
                <div>
                  <h3 className="text-sm font-semibold text-purple-300 mb-2.5">
                    {isMissing ? "Meus Habitantes nesta campanha" : "Meus Personagens nesta campanha"}
                  </h3>
                  <div className="space-y-2.5">
                    {isMissing ? (
                      campaignHabitants.length === 0 ? (
                        <p className="text-sm text-gray-500">Nenhum habitante nesta campanha.</p>
                      ) : (
                        campaignHabitants.map((habitant) => {
                          const isDisappeared =
                            habitant.status === "missing" ||
                            (habitant.lines.length > 0 && habitant.lines.every((l) => l.isErased));
                          const totalLines = habitant.lines.length;
                          const activeLines = habitant.lines.filter((l) => !l.isErased).length;
                          const initials =
                            habitant.name
                              .split(" ")
                              .map((w) => w[0])
                              .filter(Boolean)
                              .slice(0, 2)
                              .join("")
                              .toUpperCase() || "H";

                          return (
                            <div
                              key={habitant.id}
                              className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-zinc-800 bg-[#121316] p-3.5 font-mono shadow-sm transition-colors hover:border-zinc-700"
                            >
                              <div className="flex items-center gap-3.5 min-w-0">
                                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-zinc-800 border border-zinc-700 text-zinc-200 font-bold text-sm select-none">
                                  {initials}
                                </div>
                                <div className="min-w-0">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <p className="font-semibold text-zinc-100 text-sm sm:text-base truncate">
                                      {habitant.name}
                                    </p>
                                    {isDisappeared ? (
                                      <span className="rounded bg-red-950 text-red-500 border border-red-800 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider">
                                        Desaparecido
                                      </span>
                                    ) : (
                                      <span className="rounded bg-emerald-950/80 text-emerald-400 border border-emerald-800/60 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider">
                                        Ativo
                                      </span>
                                    )}
                                    <span className="rounded bg-red-950/70 border border-red-800/50 px-2 py-0.5 text-[10px] font-medium text-red-300">
                                      MISSING — Edição ZERO
                                    </span>
                                  </div>
                                  <div className="mt-1 text-xs text-zinc-400">
                                    <span>{activeLines} / {totalLines} linhas de memórias legíveis</span>
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center justify-end sm:shrink-0 pt-2 sm:pt-0 border-t border-zinc-900 sm:border-t-0">
                                <Button
                                  variant="secondary"
                                  className="px-3.5 py-1.5 text-xs font-semibold"
                                  onClick={() => setSelectedHabitant(habitant)}
                                >
                                  Abrir Ficha
                                </Button>
                              </div>
                            </div>
                          );
                        })
                      )
                    ) : selectedCampaign.characters.length === 0 ? (
                      <p className="text-sm text-gray-500">Nenhum personagem nesta campanha.</p>
                    ) : (
                      selectedCampaign.characters.map((char) => (
                        <div
                          key={char.id}
                          className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-gray-800 bg-gray-950 p-3.5 transition-colors hover:border-gray-700 shadow-sm"
                        >
                          <div className="flex items-center gap-3.5 min-w-0">
                            <div className="relative h-12 w-12 shrink-0">
                              {char.imageUrl ? (
                                /* eslint-disable-next-line @next/next/no-img-element */
                                <img
                                  src={char.imageUrl}
                                  alt={char.name}
                                  className="h-full w-full rounded-full object-cover ring-2 ring-purple-500 shadow-md"
                                />
                              ) : (
                                <div className="flex h-full w-full items-center justify-center rounded-full bg-purple-950 text-purple-200 font-bold text-base uppercase ring-2 ring-purple-500 shadow-md">
                                  {char.name.charAt(0).toUpperCase()}
                                </div>
                              )}
                            </div>
                            <div className="min-w-0">
                              <p className="font-semibold text-white text-sm sm:text-base truncate">
                                {char.name}
                              </p>
                              <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs">
                                <span className="rounded bg-purple-950/80 border border-purple-800/60 px-2 py-0.5 text-[11px] font-medium text-purple-200">
                                  Nível {char.level}
                                </span>
                                <span className="rounded bg-red-950/60 border border-red-800/50 px-2 py-0.5 text-[11px] font-medium text-red-300">
                                  HP {char.hitPointsCurrent}/{char.hitPointsMax}
                                </span>
                                <span className="rounded bg-blue-950/60 border border-blue-800/50 px-2 py-0.5 text-[11px] font-medium text-blue-300">
                                  Mana {char.manaPointsCurrent}/{char.manaPointsMax}
                                </span>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center justify-end sm:shrink-0 pt-2 sm:pt-0 border-t border-gray-900 sm:border-t-0">
                            <Link
                              href={`/player/characters/${char.id}`}
                              onClick={() => setSelectedCampaign(null)}
                            >
                              <Button variant="secondary" className="px-3.5 py-1.5 text-xs font-semibold">
                                Abrir Ficha
                              </Button>
                            </Link>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Ações da Campanha */}
                {!hasAliveCharacter && (
                  <div className="space-y-2 border-t border-gray-800 pt-4">
                    <Link
                      href={
                        isMissing
                          ? `/player/characters/new?campaignId=${selectedCampaign.id}&system=missing_zero`
                          : `/player/characters/new?campaignId=${selectedCampaign.id}`
                      }
                      className="block"
                    >
                      <Button variant="primary" className="w-full justify-center">
                        {isMissing ? "+ Criar Habitante nesta Campanha" : "+ Criar Personagem nesta Campanha"}
                      </Button>
                    </Link>
                    <button
                      type="button"
                      onClick={() =>
                        handleOpenImportModal(
                          selectedCampaign.id,
                          selectedCampaign.characters
                        )
                      }
                      className="w-full rounded-xl border border-purple-800/60 bg-purple-950/40 py-2 text-sm font-semibold text-purple-300 hover:bg-purple-900/60 transition-colors"
                    >
                      {isMissing ? "↩ Importar Habitante Existente" : "↩ Importar Personagem Existente"}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* Modal de Importação de Personagem / Habitante */}
      {importingCampaignId !== null && (() => {
        const importingCampaign =
          (selectedCampaign?.id === importingCampaignId ? selectedCampaign : null) ||
          campaigns.find((c) => c.id === importingCampaignId);
        const isImportingMissing = importingCampaign?.rulesEngine === "missing_zero";

        return (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4"
            onClick={() => {
              setImportingCampaignId(null);
              setImportableCharacters([]);
              setImportableHabitants([]);
              setImportSearch("");
            }}
            role="presentation"
          >
            <div
              className="w-full max-w-md rounded-xl border border-gray-800 bg-gray-900 p-5 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-white">
                  {isImportingMissing ? "Importar Habitante" : "Importar Personagem"}
                </h2>
                <button
                  type="button"
                  onClick={() => {
                    setImportingCampaignId(null);
                    setImportableCharacters([]);
                    setImportableHabitants([]);
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

              {isImportingMissing ? (
                <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
                  {filteredImportableHabitants.length === 0 ? (
                    <p className="py-4 text-center text-sm text-gray-500">
                      Nenhum habitante encontrado
                    </p>
                  ) : (
                    filteredImportableHabitants.map((habitant) => {
                      const isDisappeared =
                        habitant.status === "missing" ||
                        (habitant.lines.length > 0 && habitant.lines.every((l) => l.isErased));
                      const readableLines = habitant.lines.filter((l) => !l.isErased).length;
                      const initials =
                        habitant.name
                          .split(" ")
                          .map((w) => w[0])
                          .filter(Boolean)
                          .slice(0, 2)
                          .join("")
                          .toUpperCase() || "H";

                      return (
                        <div
                          key={habitant.id}
                          className="flex items-center justify-between rounded-lg border border-zinc-800 bg-[#121316] p-2.5 font-mono shadow-xs"
                        >
                          <div className="flex items-center gap-2.5 overflow-hidden">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-zinc-800 border border-zinc-700 text-zinc-200 font-bold text-xs select-none">
                              {initials}
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <p className="truncate text-xs font-semibold text-zinc-100">
                                  {habitant.name}
                                </p>
                                {isDisappeared ? (
                                  <span className="rounded bg-red-950 text-red-500 border border-red-800 px-1.5 py-0.2 text-[9px] font-bold uppercase tracking-wider">
                                    Desaparecido
                                  </span>
                                ) : (
                                  <span className="rounded bg-emerald-950/80 text-emerald-400 border border-emerald-800/60 px-1.5 py-0.2 text-[9px] font-bold uppercase tracking-wider">
                                    Ativo
                                  </span>
                                )}
                              </div>
                              <p className="text-[11px] text-zinc-400">
                                {readableLines} linhas
                              </p>
                            </div>
                          </div>
                          <button
                            type="button"
                            disabled={isLoadingImport}
                            onClick={() => handleImportCharacter(habitant.id)}
                            className="shrink-0 rounded-lg border border-red-900/60 bg-red-950/60 px-3 py-1.5 text-xs font-semibold text-red-300 hover:bg-red-900/60 transition-colors disabled:opacity-50"
                          >
                            {isLoadingImport ? "…" : "Vincular"}
                          </button>
                        </div>
                      );
                    })
                  )}
                </div>
              ) : (
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
              )}
            </div>
          </div>
        );
      })()}

      {/* Modal / Overlay em Tela Cheia da Ficha de Habitante de MISSING */}
      {selectedHabitant !== null && (
        <div
          className="fixed inset-0 z-50 flex flex-col bg-[#0a0b0d] overflow-hidden"
          role="dialog"
          aria-modal="true"
          aria-label={`Ficha de ${selectedHabitant.name}`}
        >
          <MissingHabitantSheet
            habitant={selectedHabitant}
            campaignId={selectedHabitant.campaignId || undefined}
            onClose={() => setSelectedHabitant(null)}
            onEraseLine={handleEraseHabitantLine}
            onAddLine={handleAddHabitantLine}
            onUpdateEquipment={handleUpdateHabitantEquipment}
          />
        </div>
      )}

    </div>
  );
}
