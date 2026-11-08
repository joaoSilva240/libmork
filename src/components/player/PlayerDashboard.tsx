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
import {
  CampaignsFilledIcon,
  CharactersFilledIcon,
  SettingsFilledIcon,
  TreasuryIcon,
} from "@/components/ui/Icons";
import { MessageSquare } from "lucide-react";
import { CampaignChat } from "@/components/chat/CampaignChat";
import { Dice3DSettingsPanel } from "@/components/dice/Dice3DSettingsPanel";
import { MotionSettingsPanel } from "@/components/motion/MotionSettingsPanel";
import { WealthManager, type WealthData } from "@/components/player/WealthManager";
import { generateUUID } from "@/lib/utils/uuid";
import { useSocket } from "@/context/SocketContext";
import { JukeboxAudioBridge } from "@/components/audio/JukeboxAudioBridge";
import { PlayerAssetOverlay } from "@/components/campaigns/PlayerAssetOverlay";
import { ThemeConfigPanel } from "@/components/theme/ThemeConfigPanel";
import { useTheme } from "@/context/ThemeContext";

/**
 * Mapeia o nível de reputação (reputationLevel / trustLevel) para exatamente 0 a 4 pontos (dots):
 * - Valores no intervalo de 0 a 4 (escala padrão de 4 dots): clamp direto Math.min(4, Math.max(0, Math.round(level))).
 * - Valores de 5 a 10 (ex.: trustLevel de 0 a 10 do backend): normalizado para escala 0..4 via (level / 10) * 4.
 * - Valores acima de 10 (ex.: escala percentual 0..100): normalizado via (level / 100) * 4.
 * - Valores não-numéricos ou negativos são normalizados para 0 dots.
 */
function getReputationDots(reputationLevel: number): number {
  if (typeof reputationLevel !== "number" || isNaN(reputationLevel) || reputationLevel <= 0) {
    return 0;
  }
  if (reputationLevel <= 4) {
    return Math.min(4, Math.max(0, Math.round(reputationLevel)));
  }
  if (reputationLevel <= 10) {
    return Math.min(4, Math.max(0, Math.round((reputationLevel / 10) * 4)));
  }
  return Math.min(4, Math.max(0, Math.round((reputationLevel / 100) * 4)));
}

export function PlayerDashboard() {
  const { joinCampaign, leaveCampaign } = useSocket();
  const [activeTab, setActiveTab] = useState<
    "characters" | "campaigns" | "community" | "wealth" | "settings"
  >("characters");
  const [viewMode, setViewMode] = useState<"gallery" | "list">("gallery");
  const [displayName, setDisplayName] = useState("Jogador");
  const [userId, setUserId] = useState<string>("player-id");
  const [userName, setUserName] = useState<string>("Jogador");

  // Estado de Personagens
  const [characters, setCharacters] = useState<Character[]>([]);
  const [missingHabitants, setMissingHabitants] = useState<MissingHabitant[]>([]);
  const [selectedHabitant, setSelectedHabitant] = useState<MissingHabitant | null>(null);
  const [settingsSubTab, setSettingsSubTab] = useState<"themes_colors" | "fonts" | "ui_details">(
    "themes_colors",
  );
  const [isLoadingCharacters, setIsLoadingCharacters] = useState(true);
  const [charactersError, setCharactersError] = useState<string | null>(null);

  // Estado de Campanhas
  const [campaigns, setCampaigns] = useState<PlayerCampaign[]>([]);
  const [selectedCampaign, setSelectedCampaign] = useState<PlayerCampaign | null>(null);
  const [isLoadingCampaigns, setIsLoadingCampaigns] = useState(true);
  const [campaignsError, setCampaignsError] = useState<string | null>(null);
  const [campaignDetailsTab, setCampaignDetailsTab] = useState<"resumo" | "mundo">("resumo");
  const [campaignDetails, setCampaignDetails] = useState<{
    worlds: any[];
    establishments: any[];
    npcs: any[];
  } | null>(null);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);

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
  const [toasts, setToasts] = useState<
    Array<{ id: string; message: string; type?: "error" | "success" | "info" | "warning" }>
  >([]);
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
          await fetch("/api/auth/logout", { method: "POST", credentials: "include" }).catch(
            () => {},
          );
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
    void loadPlayerName();
  }, []);

  useEffect(() => {
    if (!selectedCampaign) {
      setCampaignDetailsTab("resumo");
      setCampaignDetails(null);
      return;
    }
    setCampaignDetailsTab("resumo");
    setCampaignDetails(null);

    let isMounted = true;
    setIsLoadingDetails(true);
    fetch(`/api/player/campaigns/${selectedCampaign.id}/details`, { credentials: "include" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (isMounted && data && data.success) {
          setCampaignDetails(data.data);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (isMounted) setIsLoadingDetails(false);
      });

    return () => {
      isMounted = false;
    };
  }, [selectedCampaign?.id]);

  useEffect(() => {
    if (!selectedCampaign) return;

    // Join campaign room (Issue #60 — sincronização de áudio)
    joinCampaign({
      campaignId: selectedCampaign.id,
      user: { id: userId, name: userName },
      role: "player",
    });

    return () => {
      leaveCampaign(selectedCampaign.id);
    };
  }, [selectedCampaign?.id, joinCampaign, leaveCampaign, userId, userName]);

  const loadPlayerName = async () => {
    try {
      const response = await fetch("/api/auth/me", {
        credentials: "include",
      });
      if (response.ok) {
        const data = await response.json();
        if (data.data?.displayName) {
          setDisplayName(data.data.displayName);
          setUserName(data.data.displayName);
        }
        if (data.data?.id) {
          setUserId(data.data.id);
        }
      }
    } catch {
      // Fallback silencioso para "Jogador"
    }
  };

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
    campaignCharacters: PlayerCampaign["characters"],
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

      const response = await fetch(`/api/campaigns/${importingCampaignId}/import-character`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ characterId }),
      });

      if (response.status === 201) {
        addToast(
          isMissing ? "Habitante vinculado com sucesso!" : "Personagem vinculado com sucesso!",
          "success",
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
          "warning",
        );
        return;
      }

      const data = await response.json().catch(() => ({}));
      addToast(
        data.error || (isMissing ? "Erro ao importar habitante" : "Erro ao importar personagem"),
        "error",
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
    c.name.toLowerCase().includes(importSearch.toLowerCase()),
  );

  const filteredImportableHabitants = importableHabitants.filter((h) =>
    h.name.toLowerCase().includes(importSearch.toLowerCase()),
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
    <div
      className={`${activeTab === "settings" ? "pt-[calc(8.25rem+env(safe-area-inset-top,0px))]" : "pt-[calc(5.5rem+env(safe-area-inset-top,0px))]"} pb-[calc(6rem+env(safe-area-inset-bottom,0px))]`}
    >
      <header className="fixed inset-x-0 top-0 z-30 border-x-0 border-t-0 border-b border-secondary-border bg-secondary-card shadow-md pt-[calc(1rem+env(safe-area-inset-top,0px))]">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-4 pb-3">
          <div>
            <h1 className="text-xl font-bold text-secondary-pure">{displayName}</h1>
            <p className="text-xs text-secondary-muted">Gerencie seus heróis e campanhas</p>
          </div>
          <LogoutButton />
        </div>

        {activeTab === "settings" && (
          <div className="border-t border-secondary-border bg-secondary-card/95 backdrop-blur-md px-4 py-2">
            <div className="mx-auto max-w-7xl">
              <nav
                className="grid grid-cols-3 gap-2"
                role="tablist"
                aria-label="Configurações do Tema e Interface"
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={settingsSubTab === "themes_colors"}
                  onClick={() => setSettingsSubTab("themes_colors")}
                  className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-bold transition-all ${
                    settingsSubTab === "themes_colors"
                      ? "bg-accent text-white shadow-sm ring-1 ring-accent"
                      : "text-secondary-muted hover:text-secondary-pure hover:bg-dominant-container/50"
                  }`}
                >
                  <span className="text-sm">🎨</span>
                  <span className="truncate">Temas</span>
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={settingsSubTab === "fonts"}
                  onClick={() => setSettingsSubTab("fonts")}
                  className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-bold transition-all ${
                    settingsSubTab === "fonts"
                      ? "bg-accent text-white shadow-sm ring-1 ring-accent"
                      : "text-secondary-muted hover:text-secondary-pure hover:bg-dominant-container/50"
                  }`}
                >
                  <span className="text-sm">✍️</span>
                  <span className="truncate">Tipografia</span>
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={settingsSubTab === "ui_details"}
                  onClick={() => setSettingsSubTab("ui_details")}
                  className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-bold transition-all ${
                    settingsSubTab === "ui_details"
                      ? "bg-accent text-white shadow-sm ring-1 ring-accent"
                      : "text-secondary-muted hover:text-secondary-pure hover:bg-dominant-container/50"
                  }`}
                >
                  <span className="text-sm">📐</span>
                  <span className="truncate">Detalhes</span>
                </button>
              </nav>
            </div>
          </div>
        )}
      </header>

      {activeTab === "characters" && (
        <Link
          href="/player/characters/new"
          aria-label="Novo Personagem"
          className="fixed bottom-[calc(5.75rem+env(safe-area-inset-bottom,0px))] right-4 z-30 flex items-center gap-2 rounded-full border border-purple-400/60 bg-purple-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-purple-950/50 transition-colors hover:bg-purple-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-300 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-950 sm:right-6 sm:px-6"
        >
          <span className="text-lg leading-none" aria-hidden="true">
            +
          </span>
          <span>Novo Personagem</span>
        </Link>
      )}

      <div className="container mx-auto px-4 space-y-6">
        {/* Conteúdo da Aba 1: Meus Personagens */}
        {activeTab === "characters" && (
          <div className="motion-page">
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
                <div className="mb-4 flex items-center justify-between gap-4">
                  <h2 className="text-2xl font-bold text-secondary-pure">Meus Personagens</h2>
                  <div
                    className="flex shrink-0 rounded-lg border border-secondary-border bg-secondary-card p-1"
                    role="group"
                    aria-label="Modo de visualização"
                  >
                    <button
                      type="button"
                      aria-label="Visualizar como galeria"
                      aria-pressed={viewMode === "gallery"}
                      onClick={() => setViewMode("gallery")}
                      className={`rounded-md p-2 transition-colors ${viewMode === "gallery" ? "bg-purple-700 text-white" : "text-gray-400 hover:bg-gray-800 hover:text-white"}`}
                    >
                      <svg
                        aria-hidden="true"
                        viewBox="0 0 24 24"
                        className="h-5 w-5"
                        fill="currentColor"
                      >
                        <path d="M4 4h6v6H4V4Zm10 0h6v6h-6V4ZM4 14h6v6H4v-6Zm10 0h6v6h-6v-6Z" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      aria-label="Visualizar como lista"
                      aria-pressed={viewMode === "list"}
                      onClick={() => setViewMode("list")}
                      className={`rounded-md p-2 transition-colors ${viewMode === "list" ? "bg-purple-700 text-white" : "text-gray-400 hover:bg-gray-800 hover:text-white"}`}
                    >
                      <svg
                        aria-hidden="true"
                        viewBox="0 0 24 24"
                        className="h-5 w-5"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <path d="M4 6h16M4 12h16M4 18h16" />
                      </svg>
                    </button>
                  </div>
                </div>
                <div
                  key={viewMode}
                  className={
                    viewMode === "gallery"
                      ? "motion-stagger grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
                      : "motion-stagger flex flex-col gap-2"
                  }
                >
                  {characters.map((character) =>
                    viewMode === "gallery" ? (
                      <CharacterCard key={character.id} character={character} />
                    ) : (
                      <Link
                        key={character.id}
                        href={`/player/characters/${character.id}`}
                        aria-label={`Ver ficha de ${character.name}`}
                        className="flex items-center gap-3 rounded-xl border border-secondary-border bg-secondary-card p-3 transition-colors hover:border-accent"
                      >
                        <div className="h-10 w-10 shrink-0 overflow-hidden rounded-full ring-2 ring-purple-500">
                          {character.imageUrl ? (
                            <img
                              src={character.imageUrl}
                              alt={character.name}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center bg-accent-glow text-accent-vibrant [data-theme-mode=light]:bg-accent/20 [data-theme-mode=light]:text-accent-dark font-bold">
                              {character.name.charAt(0).toUpperCase()}
                            </div>
                          )}
                        </div>
                        <span className="min-w-0 flex-1 truncate font-semibold text-secondary-pure">
                          {character.name}
                        </span>
                        <span className="shrink-0 rounded border border-accent/40 bg-accent/15 px-2 py-1 text-xs font-semibold text-accent-dark [data-theme-mode=dark]:border-accent-vibrant/50 [data-theme-mode=dark]:bg-accent-dark/90 [data-theme-mode=dark]:text-white">
                          Nv. {character.level}
                          {character.className ? ` · ${character.className}` : ""}
                        </span>
                      </Link>
                    ),
                  )}
                  {missingHabitants.map((habitant) => (
                    <MissingHabitantCard
                      key={habitant.id}
                      habitant={habitant}
                      compact={viewMode === "list"}
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
          <div className="motion-page">
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
              <div className="motion-stagger grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {campaigns.map((campaign) => (
                  <div
                    key={campaign.id}
                    className="motion-lift group relative overflow-hidden flex flex-col justify-between rounded-xl border border-secondary-border bg-secondary-card p-5 transition-all hover:border-accent hover:shadow-[0_0_20px_rgba(147,51,234,0.25)] cursor-pointer"
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
                          Mestre:{" "}
                          <span className="font-medium text-white">
                            {campaign.master.displayName}
                          </span>
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
                              <span className="text-red-300 font-semibold font-mono">
                                MISSING — Edição ZERO
                              </span>
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

        {/* Conteúdo da Aba: Comunidade / Chat de Campanhas */}
        {activeTab === "community" && (
          <div className="motion-page h-[calc(100vh-13rem)] pb-12">
            <CampaignChat currentUser={{ id: userId, displayName: userName }} />
          </div>
        )}

        {/* Conteúdo da Aba 3: Tesouraria (Wealth) */}
        {activeTab === "wealth" && (
          <div className="motion-page">
            <WealthManager
              initialData={wealthData}
              isLoading={isLoadingWealth}
              error={wealthError}
              onRefresh={refreshWealth}
              onShowToast={addToast}
            />
          </div>
        )}

        {activeTab === "settings" && (
          <div className="motion-page space-y-6 pb-24">
            <ThemeConfigPanel
              activeSubTab={settingsSubTab}
              onSubTabChange={setSettingsSubTab}
              hideSubTabsBar={true}
            />
            {settingsSubTab === "ui_details" && (
              <>
                <MotionSettingsPanel />
                <Dice3DSettingsPanel />
              </>
            )}
          </div>
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
              icon: <CharactersFilledIcon className="h-6 w-6" />,
            },
            {
              id: "campaigns",
              label: "Campanhas",
              icon: <CampaignsFilledIcon className="h-6 w-6" />,
            },
            {
              id: "community",
              label: "Comunidade",
              icon: <MessageSquare className="h-6 w-6" />,
            },
            {
              id: "wealth",
              label: "Tesouraria",
              icon: <TreasuryIcon className="h-6 w-6" />,
            },
            {
              id: "settings",
              label: "Configurações",
              icon: <SettingsFilledIcon className="h-6 w-6" />,
            },
          ]}
        />

        {/* Overlay de Detalhes da Campanha */}
        {selectedCampaign !== null &&
          importingCampaignId === null &&
          (() => {
            const isMissing = selectedCampaign.rulesEngine === "missing_zero";
            const campaignHabitants: MissingHabitant[] = isMissing
              ? selectedCampaign.habitants && selectedCampaign.habitants.length > 0
                ? selectedCampaign.habitants
                : missingHabitants.filter((h) => h.campaignId === selectedCampaign.id).length > 0
                  ? missingHabitants.filter((h) => h.campaignId === selectedCampaign.id)
                  : selectedCampaign.characters.map((c) => ({
                      id: c.id,
                      campaignId: selectedCampaign.id,
                      ownerId: "",
                      name: c.name,
                      status: (c.hitPointsCurrent > 0 ? "active" : "missing") as
                        "active" | "missing",
                      lines: [],
                      equipments: [
                        {
                          id: "1",
                          slot: 1 as const,
                          name: "",
                          notes: "",
                          status: "active" as const,
                        },
                        {
                          id: "2",
                          slot: 2 as const,
                          name: "",
                          notes: "",
                          status: "active" as const,
                        },
                        {
                          id: "3",
                          slot: 3 as const,
                          name: "",
                          notes: "",
                          status: "active" as const,
                        },
                      ],
                      createdAt: new Date().toISOString(),
                      updatedAt: new Date().toISOString(),
                    }))
              : [];

            const hasAliveCharacter = isMissing
              ? campaignHabitants.length > 0
                ? campaignHabitants.some((h) => h.status === "active")
                : selectedCampaign.characters.some((c) => c.hitPointsCurrent > 0)
              : selectedCampaign.characters.some((char) => char.hitPointsCurrent > 0);

            return (
              <div
                className="fixed inset-0 z-40 flex items-center justify-center bg-black/75 p-4"
                onClick={() => setSelectedCampaign(null)}
                role="presentation"
              >
                <div
                  className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl border border-secondary-border bg-secondary-card text-secondary-pure shadow-2xl"
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
                    className="absolute top-3.5 right-3.5 z-30 rounded-lg bg-dominant-container/80 backdrop-blur-md p-1.5 text-secondary-muted hover:bg-dominant-container hover:text-secondary-pure border border-secondary-border transition-colors"
                  >
                    ✕
                  </button>

                  {/* Banner Hero com a imagem da campanha */}
                  {selectedCampaign.coverImageUrl && (
                    <div className="relative h-40 sm:h-48 w-full overflow-hidden border-b border-secondary-border">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={selectedCampaign.coverImageUrl}
                        alt={selectedCampaign.name}
                        className="h-full w-full object-cover"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-secondary-card via-secondary-card/60 to-transparent" />
                    </div>
                  )}

                  <div className="p-5 space-y-5">
                    {/* Jukebox de áudio sincronizada (Issue #60) */}
                    <JukeboxAudioBridge campaignId={selectedCampaign.id} />

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

                      <h2
                        id="campaign-details-title"
                        className="text-2xl font-bold text-secondary-pure leading-tight"
                      >
                        {selectedCampaign.name}
                      </h2>
                      <p className="mt-1 text-sm text-secondary-muted">
                        Mestre:{" "}
                        <span className="font-medium text-secondary-pure">
                          {selectedCampaign.master.displayName}
                        </span>
                      </p>
                    </div>

                    <div
                      className="flex gap-2 border-b border-secondary-border"
                      role="tablist"
                      aria-label="Detalhes da campanha"
                    >
                      {(
                        [
                          ["resumo", "Resumo"],
                          ["mundo", "Mundo"],
                        ] as const
                      ).map(([id, label]) => (
                        <button
                          key={id}
                          type="button"
                          role="tab"
                          aria-selected={campaignDetailsTab === id}
                          onClick={() => setCampaignDetailsTab(id)}
                          className={`border-b-2 px-3 py-2 text-sm font-semibold transition-colors ${campaignDetailsTab === id ? "border-accent text-accent-vibrant [data-theme-mode=light]:text-accent-primary" : "border-transparent text-secondary-muted hover:text-secondary-pure"}`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>

                    {campaignDetailsTab === "resumo" ? (
                      <>
                        {/* Detalhes / Descrição */}
                        <div className="rounded-lg border border-secondary-border bg-dominant-container/40 p-4">
                          <h3 className="text-sm font-semibold text-accent-vibrant [data-theme-mode=light]:text-accent-primary">
                            Detalhes da Campanha
                          </h3>
                          <p className="mt-2 whitespace-pre-wrap text-sm text-secondary-offwhite leading-relaxed">
                            {selectedCampaign.description || "Nenhuma descrição fornecida."}
                          </p>
                        </div>

                        {/* Meus Personagens / Habitantes nesta campanha */}
                        <div>
                          <h3 className="text-sm font-semibold text-accent-vibrant [data-theme-mode=light]:text-accent-primary mb-2.5">
                            {isMissing
                              ? "Meus Habitantes nesta campanha"
                              : "Meus Personagens nesta campanha"}
                          </h3>
                          <div className="space-y-2.5">
                            {isMissing ? (
                              campaignHabitants.length === 0 ? (
                                <p className="text-sm text-gray-500">
                                  Nenhum habitante nesta campanha.
                                </p>
                              ) : (
                                campaignHabitants.map((habitant) => {
                                  const isDisappeared =
                                    habitant.status === "missing" ||
                                    (habitant.lines.length > 0 &&
                                      habitant.lines.every((l) => l.isErased));
                                  const totalLines = habitant.lines.length;
                                  const activeLines = habitant.lines.filter(
                                    (l) => !l.isErased,
                                  ).length;
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
                                      className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-secondary-border bg-dominant-deep/70 p-3.5 font-mono shadow-sm transition-colors hover:border-accent/40"
                                    >
                                      <div className="flex items-center gap-3.5 min-w-0">
                                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-dominant-container border border-secondary-border text-secondary-pure font-bold text-sm select-none">
                                          {initials}
                                        </div>
                                        <div className="min-w-0">
                                          <div className="flex flex-wrap items-center gap-2">
                                            <p className="font-semibold text-secondary-pure text-sm sm:text-base truncate">
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
                                          <div className="mt-1 text-xs text-secondary-muted">
                                            <span>
                                              {activeLines} / {totalLines} linhas de memórias
                                              legíveis
                                            </span>
                                          </div>
                                        </div>
                                      </div>
                                      <div className="flex items-center justify-end sm:shrink-0 pt-2 sm:pt-0 border-t border-secondary-border sm:border-t-0">
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
                              <p className="text-sm text-gray-500">
                                Nenhum personagem nesta campanha.
                              </p>
                            ) : (
                              selectedCampaign.characters.map((char) => (
                                <div
                                  key={char.id}
                                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-secondary-border bg-dominant-deep/70 p-3.5 transition-colors hover:border-accent/40 shadow-sm"
                                >
                                  <div className="flex items-center gap-3.5 min-w-0">
                                    <div className="relative h-12 w-12 shrink-0">
                                      {char.imageUrl ? (
                                        /* eslint-disable-next-line @next/next/no-img-element */
                                        <img
                                          src={char.imageUrl}
                                          alt={char.name}
                                          className="h-full w-full rounded-full object-cover ring-2 ring-accent shadow-md"
                                        />
                                      ) : (
                                        <div className="flex h-full w-full items-center justify-center rounded-full bg-accent-glow text-accent-vibrant [data-theme-mode=light]:text-accent-primary font-bold text-base uppercase ring-2 ring-accent shadow-md">
                                          {char.name.charAt(0).toUpperCase()}
                                        </div>
                                      )}
                                    </div>
                                    <div className="min-w-0">
                                      <p className="font-semibold text-secondary-pure text-sm sm:text-base truncate">
                                        {char.name}
                                      </p>
                                      <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs">
                                        <span className="rounded bg-accent-glow border border-accent/40 px-2 py-0.5 text-[11px] font-medium text-accent-vibrant [data-theme-mode=light]:text-accent-primary">
                                          Nível {char.level}
                                        </span>
                                        <span className="rounded border border-red-300 bg-red-50 px-2 py-0.5 text-[11px] font-medium text-red-700 [data-theme-mode=dark]:border-red-800/50 [data-theme-mode=dark]:bg-red-950/60 [data-theme-mode=dark]:text-red-300">
                                          HP {char.hitPointsCurrent}/{char.hitPointsMax}
                                        </span>
                                        <span className="rounded border border-blue-300 bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-700 [data-theme-mode=dark]:border-blue-800/50 [data-theme-mode=dark]:bg-blue-950/60 [data-theme-mode=dark]:text-blue-300">
                                          Mana {char.manaPointsCurrent}/{char.manaPointsMax}
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                  <div className="flex items-center justify-end sm:shrink-0 pt-2 sm:pt-0 border-t border-secondary-border sm:border-t-0">
                                    <Link
                                      href={`/player/characters/${char.id}`}
                                      onClick={() => setSelectedCampaign(null)}
                                    >
                                      <Button
                                        variant="secondary"
                                        className="px-3.5 py-1.5 text-xs font-semibold"
                                      >
                                        Abrir Ficha
                                      </Button>
                                    </Link>
                                  </div>
                                </div>
                              ))
                            )}
                          </div>
                        </div>
                      </>
                    ) : campaignDetailsTab === "mundo" ? (
                      <div className="space-y-4">
                        {isLoadingDetails ? (
                          <div className="flex items-center justify-center py-8">
                            <Spinner size="md" />
                          </div>
                        ) : !campaignDetails ? (
                          <p className="text-sm text-gray-500 text-center py-4">
                            Erro ao carregar dados do mundo
                          </p>
                        ) : (
                          <>
                            {/* NPCs */}
                            <div>
                              <h3 className="text-sm font-semibold text-accent-vibrant [data-theme-mode=light]:text-accent-primary mb-2">
                                👥 NPCs
                              </h3>
                              {campaignDetails.npcs.length === 0 ? (
                                <p className="text-xs text-gray-500">Nenhum NPC disponível</p>
                              ) : (
                                <div className="space-y-1.5">
                                  {campaignDetails.npcs.map((npc) => (
                                    <div
                                      key={npc.id}
                                      className="flex items-center gap-2.5 rounded-lg border border-secondary-border bg-dominant-deep/50 px-3 py-2"
                                    >
                                      {npc.imageUrl ? (
                                        /* eslint-disable-next-line @next/next/no-img-element */
                                        <img
                                          src={npc.imageUrl}
                                          alt={npc.name}
                                          className="h-8 w-8 rounded-full object-cover shrink-0"
                                        />
                                      ) : (
                                        <div className="h-8 w-8 rounded-full bg-dominant-container flex items-center justify-center text-xs font-bold text-secondary-muted shrink-0">
                                          {npc.name.charAt(0).toUpperCase()}
                                        </div>
                                      )}
                                      <div className="min-w-0">
                                        <p className="text-sm font-medium text-secondary-pure truncate">
                                          {npc.name}
                                        </p>
                                        <p className="text-xs text-secondary-muted">
                                          {npc.npcType} • Nível {npc.level}
                                        </p>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>

                            {/* Mundos e Estabelecimentos Unificados */}
                            <div>
                              <h3 className="text-sm font-semibold text-accent-vibrant [data-theme-mode=light]:text-accent-primary mb-2">
                                🌍 Mundos
                              </h3>
                              {campaignDetails.worlds.length === 0 ? (
                                <p className="text-xs text-gray-500">Nenhum mundo disponível</p>
                              ) : (
                                <div className="grid gap-2 sm:grid-cols-2">
                                  {campaignDetails.worlds.map((world) => {
                                    // Filtrar estabelecimentos deste mundo
                                    const worldEstablishments =
                                      campaignDetails.establishments.filter(
                                        (est) => est.worldId === world.id,
                                      );

                                    return (
                                      <div
                                        key={world.id}
                                        className="relative overflow-hidden rounded-lg border border-secondary-border bg-dominant-deep/80 min-h-[6.5rem] flex flex-col justify-end p-3"
                                      >
                                        {/* Arte de fundo com overlay */}
                                        {world.coverUrl && (
                                          <>
                                            <div
                                              className="absolute inset-0 bg-cover bg-center"
                                              style={{ backgroundImage: `url(${world.coverUrl})` }}
                                            />
                                            <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/70 to-black/30" />
                                          </>
                                        )}

                                        {/* Conteúdo sobreposto */}
                                        <div className="relative z-10 flex flex-col gap-1.5">
                                          <div className="flex items-start justify-between gap-2">
                                            <div className="min-w-0 flex-1">
                                              <p className="text-sm font-bold text-white truncate drop-shadow-md">
                                                {world.name}
                                              </p>
                                              {world.description && (
                                                <p className="text-xs text-gray-300 truncate drop-shadow">
                                                  {world.description}
                                                </p>
                                              )}
                                            </div>

                                            {/* Círculos de estabelecimentos */}
                                            {worldEstablishments.length > 0 ? (
                                              <div
                                                className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end max-w-[50%]"
                                                aria-label={`Estabelecimentos de ${world.name}`}
                                              >
                                                {worldEstablishments.map((est) => {
                                                  const activeDots = getReputationDots(
                                                    est.reputationLevel,
                                                  );
                                                  const dotsArray = [0, 1, 2, 3];

                                                  return (
                                                    <div
                                                      key={est.id}
                                                      className="relative inline-flex items-center justify-center shrink-0 cursor-default"
                                                      role="img"
                                                      title={`${est.name} (${est.type}) - Reputação: ${activeDots}/4 (${est.reputationLevel})`}
                                                      aria-label={`${est.name}, ${est.type}, Reputação nível ${est.reputationLevel} (${activeDots} de 4 segmentos)`}
                                                    >
                                                      {/* SVG com círculo e perímetro contínuo dividido em 4 arcos */}
                                                      <svg
                                                        width="30"
                                                        height="30"
                                                        viewBox="0 0 30 30"
                                                        className="drop-shadow-md"
                                                      >
                                                        {dotsArray.map((segmentIndex) => {
                                                          const gap = 4;
                                                          const startAngle =
                                                            -90 + segmentIndex * 90 + gap / 2;
                                                          const endAngle =
                                                            -90 + (segmentIndex + 1) * 90 - gap / 2;
                                                          const radius = 12.5;
                                                          const toPoint = (angle: number) => {
                                                            const radians = angle * (Math.PI / 180);
                                                            return {
                                                              x: 15 + radius * Math.cos(radians),
                                                              y: 15 + radius * Math.sin(radians),
                                                            };
                                                          };
                                                          const start = toPoint(startAngle);
                                                          const end = toPoint(endAngle);
                                                          const isActive =
                                                            segmentIndex < activeDots;

                                                          return (
                                                            <path
                                                              key={segmentIndex}
                                                              data-reputation-segment={segmentIndex}
                                                              data-active={
                                                                isActive ? "true" : "false"
                                                              }
                                                              d={`M ${start.x} ${start.y} A ${radius} ${radius} 0 0 1 ${end.x} ${end.y}`}
                                                              fill="none"
                                                              stroke={
                                                                isActive
                                                                  ? "var(--accent-vibrant, #c084fc)"
                                                                  : "var(--secondary-border, #374151)"
                                                              }
                                                              strokeWidth="2"
                                                              strokeLinecap="round"
                                                              opacity={isActive ? 1 : 0.7}
                                                            />
                                                          );
                                                        })}

                                                        {/* Círculo central representativo do estabelecimento */}
                                                        <circle
                                                          cx="15"
                                                          cy="15"
                                                          r="9"
                                                          fill="var(--secondary-card, #18181b)"
                                                          stroke="var(--secondary-border, #374151)"
                                                          strokeWidth="1"
                                                        />

                                                        {/* Inicial representativa do estabelecimento */}
                                                        <text
                                                          x="15"
                                                          y="15"
                                                          textAnchor="middle"
                                                          dominantBaseline="central"
                                                          fontSize="9.5"
                                                          fontWeight="700"
                                                          fill="var(--secondary-pure, #f3f4f6)"
                                                        >
                                                          {est.name.charAt(0).toUpperCase()}
                                                        </text>
                                                      </svg>
                                                    </div>
                                                  );
                                                })}
                                              </div>
                                            ) : (
                                              <span className="text-[10px] text-secondary-muted italic bg-dominant-container/60 px-1.5 py-0.5 rounded border border-secondary-border shrink-0 self-center">
                                                Nenhum estabelecimento
                                              </span>
                                            )}
                                          </div>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          </>
                        )}
                      </div>
                    ) : null}

                    {campaignDetailsTab === "resumo" && !hasAliveCharacter && (
                      <div className="space-y-2 border-t border-secondary-border pt-4">
                        <Link
                          href={
                            isMissing
                              ? `/player/characters/new?campaignId=${selectedCampaign.id}&system=missing_zero`
                              : `/player/characters/new?campaignId=${selectedCampaign.id}`
                          }
                          className="block"
                        >
                          <Button variant="primary" className="w-full justify-center">
                            {isMissing
                              ? "+ Criar Habitante nesta Campanha"
                              : "+ Criar Personagem nesta Campanha"}
                          </Button>
                        </Link>
                        <button
                          type="button"
                          onClick={() =>
                            handleOpenImportModal(selectedCampaign.id, selectedCampaign.characters)
                          }
                          className="w-full rounded-xl border border-accent/40 bg-accent-glow py-2 text-sm font-semibold text-accent-vibrant [data-theme-mode=light]:text-accent-primary hover:bg-accent/20 transition-colors"
                        >
                          {isMissing
                            ? "↩ Importar Habitante Existente"
                            : "↩ Importar Personagem Existente"}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })()}

        {/* Modal de Importação de Personagem / Habitante */}
        {importingCampaignId !== null &&
          (() => {
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
                  className="w-full max-w-md rounded-xl border border-secondary-border bg-secondary-card p-5 shadow-2xl text-secondary-pure"
                  onClick={(e) => e.stopPropagation()}
                  role="dialog"
                  aria-modal="true"
                >
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-bold text-secondary-pure">
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
                      className="rounded-lg p-1.5 text-secondary-muted hover:bg-dominant-container hover:text-secondary-pure transition-colors"
                    >
                      ✕
                    </button>
                  </div>

                  <input
                    type="text"
                    placeholder="Buscar por nome..."
                    value={importSearch}
                    onChange={(e) => setImportSearch(e.target.value)}
                    className="mb-4 w-full rounded-lg border border-secondary-border bg-dominant-deep px-3 py-2 text-sm text-secondary-pure placeholder-secondary-muted outline-none focus:border-accent"
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
                            className="flex items-center justify-between rounded-lg border border-secondary-border bg-dominant-deep p-2.5"
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
                                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-accent-glow text-accent-vibrant [data-theme-mode=light]:text-accent-primary font-bold text-xs shrink-0 border border-accent/40">
                                  {char.name.charAt(0).toUpperCase()}
                                </div>
                              )}
                              <div className="min-w-0">
                                <p className="truncate text-xs font-semibold text-secondary-pure">
                                  {char.name}
                                </p>
                                <p className="text-[11px] text-secondary-muted">
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
                              className="shrink-0 rounded-lg border border-accent/40 bg-accent-glow px-3 py-1.5 text-xs font-semibold text-accent-vibrant [data-theme-mode=light]:text-accent-primary hover:bg-accent/20 transition-colors disabled:opacity-50"
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

        {/* Handout / Asset Compartilhado pelo Mestre (Issue #61) */}
        <PlayerAssetOverlay />
      </div>
    </div>
  );
}
