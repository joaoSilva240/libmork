"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button, Form, Input } from "@/components/ui";
import { InitialContentModal } from "@/components/campaigns/InitialContentModal";
import type { RulesEngine } from "@/lib/utils/constants";
import { themes, type ThemeName, evaluateThemeContrast } from "@/lib/theme";

export function CampaignForm() {
  const router = useRouter();

  // Estados dos Campos Principais (Coluna 1)
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [rulesEngine, setRulesEngine] = useState<RulesEngine>("d20_mod");
  const [pvpEnabled, setPvpEnabled] = useState(false);
  const [difficultyModifierShadowPoints, setDifficultyModifierShadowPoints] = useState(0);
  const [selectedTheme, setSelectedTheme] = useState<ThemeName>("default-dark");
  const [themeModeFilter, setThemeModeFilter] = useState<"all" | "dark" | "light">("all");
  const [selectedNpcIds, setSelectedNpcIds] = useState<string[]>([]);
  const [selectedWorldIds, setSelectedWorldIds] = useState<string[]>([]);
  const [isContentModalOpen, setIsContentModalOpen] = useState(false);

  // Estados dos Arquivos e Imagens (Coluna 2)
  const [coverImageUrl, setCoverImageUrl] = useState<string | null>(null);
  const [worldMapUrl, setWorldMapUrl] = useState<string | null>(null);
  const [isUploadingCover, setIsUploadingCover] = useState(false);
  const [isUploadingMap, setIsUploadingMap] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const coverInputRef = useRef<HTMLInputElement>(null);
  const mapInputRef = useRef<HTMLInputElement>(null);

  // Estados de Assets e Handouts Iniciais (Issue #61)
  const [initialAssets, setInitialAssets] = useState<
    Array<{ name: string; description?: string; imageUrl: string; category: string }>
  >([]);
  const [newAssetName, setNewAssetName] = useState("");
  const [newAssetCategory, setNewAssetCategory] = useState("handout");
  const [newAssetDescription, setNewAssetDescription] = useState("");
  const [newAssetImageUrl, setNewAssetImageUrl] = useState("");
  const [isUploadingAsset, setIsUploadingAsset] = useState(false);
  const assetInputRef = useRef<HTMLInputElement>(null);

  // Estados de Envio
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleToggleNpc = (npcId: string) => {
    setSelectedNpcIds((prev) =>
      prev.includes(npcId) ? prev.filter((id) => id !== npcId) : [...prev, npcId]
    );
  };

  const handleToggleWorld = (worldId: string) => {
    setSelectedWorldIds((prev) =>
      prev.includes(worldId) ? prev.filter((id) => id !== worldId) : [...prev, worldId]
    );
  };

  const handleAssetFileUpload = async (file: File) => {
    setUploadError(null);
    setIsUploadingAsset(true);
    try {
      const formData = new FormData();
      formData.append("image", file);
      formData.append("type", "asset");

      const response = await fetch("/api/campaigns/upload", {
        method: "POST",
        body: formData,
        credentials: "include",
      });

      const data = await response.json();
      if (!response.ok) {
        setUploadError(data.error || "Erro ao enviar imagem de asset");
        return;
      }
      setNewAssetImageUrl(data.data.url);
    } catch {
      setUploadError("Erro de conexão ao enviar imagem.");
    } finally {
      setIsUploadingAsset(false);
      if (assetInputRef.current) assetInputRef.current.value = "";
    }
  };

  const handleAddInitialAsset = () => {
    if (!newAssetName.trim()) {
      setUploadError("Informe o nome do asset/handout.");
      return;
    }
    if (!newAssetImageUrl.trim()) {
      setUploadError("Informe a URL ou faça upload da imagem do asset.");
      return;
    }
    setInitialAssets((prev) => [
      ...prev,
      {
        name: newAssetName.trim(),
        category: newAssetCategory,
        description: newAssetDescription.trim() || undefined,
        imageUrl: newAssetImageUrl.trim(),
      },
    ]);
    setNewAssetName("");
    setNewAssetDescription("");
    setNewAssetImageUrl("");
    setUploadError(null);
  };

  const handleRemoveInitialAsset = (index: number) => {
    setInitialAssets((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleFileUpload = async (
    file: File,
    type: "cover" | "map"
  ) => {
    setUploadError(null);
    if (type === "cover") setIsUploadingCover(true);
    else setIsUploadingMap(true);

    try {
      const formData = new FormData();
      formData.append("image", file);
      formData.append("type", type);

      const response = await fetch("/api/campaigns/upload", {
        method: "POST",
        body: formData,
        credentials: "include",
      });

      const data = await response.json();

      if (!response.ok) {
        setUploadError(data.error || `Erro ao enviar ${type === "cover" ? "capa" : "mapa"}`);
        return;
      }

      if (type === "cover") {
        setCoverImageUrl(data.data.url);
      } else {
        setWorldMapUrl(data.data.url);
      }
    } catch {
      setUploadError("Erro de conexão ao enviar imagem.");
    } finally {
      if (type === "cover") {
        setIsUploadingCover(false);
        if (coverInputRef.current) coverInputRef.current.value = "";
      } else {
        setIsUploadingMap(false);
        if (mapInputRef.current) mapInputRef.current.value = "";
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const response = await fetch("/api/campaigns", {
        credentials: "include",
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          description: description || null,
          rulesEngine,
          pvpEnabled: rulesEngine === "missing_zero" ? false : pvpEnabled,
          difficultyModifierShadowPoints: rulesEngine === "missing_zero" ? 0 : difficultyModifierShadowPoints,
          coverImageUrl: coverImageUrl || null,
          worldMapUrl: worldMapUrl || null,
          theme: selectedTheme,
          initialNpcIds: selectedNpcIds,
          initialWorldIds: selectedWorldIds,
          initialAssets: initialAssets.length > 0 ? initialAssets : undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Erro ao criar campanha");
        return;
      }

      router.push(`/master/campaigns/${data.data.id}`);
    } catch {
      setError("Erro de conexão. Tente novamente.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-6xl pb-8">
      {/* Header com Navegação */}
      <div className="mb-6 flex items-center justify-between border-b border-gray-800 pb-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link
              href="/master"
              className="text-xs font-semibold text-purple-400 hover:text-purple-300 transition-colors"
            >
              ← Painel do Mestre
            </Link>
            <span className="text-gray-600 text-xs">/</span>
            <span className="text-gray-400 text-xs">Nova Campanha</span>
          </div>
          <h1 className="text-2xl font-extrabold text-white flex items-center gap-2">
            <span>✨</span> Criar Nova Campanha (Studio)
          </h1>
        </div>
      </div>

      <Form onSubmit={handleSubmit} error={error ?? undefined}>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* ========================================================================= */}
          {/* COLUNA 1: Parâmetros e Regras (7 Colunas no Desktop)                      */}
          {/* ========================================================================= */}
          <div className="lg:col-span-7 space-y-6">
            {/* Bloco 1: Informações Básicas */}
            <div className="rounded-2xl border border-gray-800/80 bg-gray-900/60 p-5 shadow-lg backdrop-blur-sm space-y-4">
              <h2 className="text-sm font-bold uppercase tracking-wider text-purple-400 flex items-center gap-1.5">
                <span>📜</span> Informações Gerais
              </h2>

              <Input
                label="Nome da Campanha"
                name="name"
                type="text"
                placeholder="Ex: As Crônicas de Morkvold"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                autoComplete="off"
                disabled={isLoading}
                className="bg-gray-950 text-white border-gray-800 focus:border-purple-500"
              />

              <div>
                <label className="block text-xs font-medium text-gray-300 mb-1.5">
                  Sinopse / Detalhes da Campanha
                </label>
                <textarea
                  name="description"
                  rows={4}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  disabled={isLoading}
                  placeholder="Descreva o cenário, premissa, clima da mesa ou regras gerais..."
                  className="w-full rounded-xl border border-gray-800 bg-gray-950 px-3.5 py-2.5 text-white placeholder-gray-500 focus:ring-2 focus:ring-purple-600 focus:border-transparent outline-none text-xs transition"
                />
              </div>
            </div>

            {/* Bloco 2: Motor de Regras e Mecânicas */}
            <div className="rounded-2xl border border-gray-800/80 bg-gray-900/60 p-5 shadow-lg backdrop-blur-sm space-y-4">
              <h2 className="text-sm font-bold uppercase tracking-wider text-purple-400 flex items-center gap-1.5">
                <span>🎲</span> Sistema e Regras (RF-019 / RF-053)
              </h2>

              <div>
                <label className="block text-xs font-medium text-gray-300 mb-2">
                  Motor de Resolução de Testes
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {/* Card d20_mod */}
                  <div
                    onClick={() => !isLoading && setRulesEngine("d20_mod")}
                    className={`cursor-pointer rounded-xl border p-3.5 transition-all select-none ${
                      rulesEngine === "d20_mod"
                        ? "border-purple-500 bg-purple-950/50 shadow-md ring-1 ring-purple-500/60"
                        : "border-gray-800 bg-gray-950/70 hover:border-gray-700 hover:bg-gray-950"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5 min-h-[24px]">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src="/DD-Logo.png"
                        alt="D&D Logo"
                        className="h-6 w-auto object-contain"
                      />
                      {rulesEngine === "d20_mod" && (
                        <span className="h-2 w-2 rounded-full bg-purple-400" />
                      )}
                    </div>
                    <p className="text-[11px] text-gray-400">
                      Sistema adaptado misturando D&D, Pathfinder 2e e regras da mesa.
                    </p>
                  </div>

                  {/* Card dual_d20_sum */}
                  <div
                    onClick={() => !isLoading && setRulesEngine("dual_d20_sum")}
                    className={`cursor-pointer rounded-xl border p-3.5 transition-all select-none ${
                      rulesEngine === "dual_d20_sum"
                        ? "border-purple-500 bg-purple-950/50 shadow-md ring-1 ring-purple-500/60"
                        : "border-gray-800 bg-gray-950/70 hover:border-gray-700 hover:bg-gray-950"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1 min-h-[24px]">
                      <span className="font-bold text-xs text-white">2d20 Somado (Dual)</span>
                      {rulesEngine === "dual_d20_sum" && (
                        <span className="h-2 w-2 rounded-full bg-purple-400" />
                      )}
                    </div>
                    <p className="text-[11px] text-gray-400">
                      Curva de sino com soma direta de 2 dados d20 para resultados concentrados e épicos.
                    </p>
                  </div>

                  {/* Card missing_zero */}
                  <div
                    onClick={() => !isLoading && setRulesEngine("missing_zero")}
                    className={`cursor-pointer rounded-xl border p-3.5 transition-all select-none ${
                      rulesEngine === "missing_zero"
                        ? "border-purple-500 bg-purple-950/50 shadow-md ring-1 ring-purple-500/60"
                        : "border-gray-800 bg-gray-950/70 hover:border-gray-700 hover:bg-gray-950"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1 min-h-[24px]">
                      <span className="font-bold text-xs text-white">MISSING — Edição ZERO</span>
                      {rulesEngine === "missing_zero" && (
                        <span className="h-2 w-2 rounded-full bg-purple-400" />
                      )}
                    </div>
                    <p className="text-[11px] text-gray-400">
                      Horror analógico com dados d6, registro pautado e ameaças de cena.
                    </p>
                  </div>
                </div>
              </div>

              {/* PvP Toggle */}
              {rulesEngine !== "missing_zero" && (
                <div className="flex items-center justify-between p-3 rounded-xl border border-gray-800 bg-gray-950/60">
                  <div>
                    <div className="text-xs font-bold text-white">Combate entre Jogadores (PvP)</div>
                    <div className="text-[11px] text-gray-400">
                      Permite desafios de duelo direto e ataques de alvo entre fichas de jogadores.
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={pvpEnabled}
                      onChange={(e) => setPvpEnabled(e.target.checked)}
                      disabled={isLoading}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                  </label>
                </div>
              )}

              {/* Modificador de Sombra */}
              {rulesEngine !== "missing_zero" && (
                <div>
                  <label className="block text-xs font-medium text-gray-300 mb-1">
                    Modificador de Dificuldade por Pontos de Sombra
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      type="range"
                      min={0}
                      max={10}
                      value={difficultyModifierShadowPoints}
                      onChange={(e) => setDifficultyModifierShadowPoints(Number(e.target.value))}
                      disabled={isLoading}
                      className="flex-1 accent-purple-600 bg-gray-950 h-2 rounded-lg cursor-pointer"
                    />
                    <span className="w-10 text-center font-mono font-bold text-xs bg-purple-950/80 border border-purple-800/60 rounded px-2 py-1 text-purple-300">
                      +{difficultyModifierShadowPoints}
                    </span>
                  </div>
                  <p className="text-[10px] text-gray-500 mt-1">
                    Aumenta os limiares de testes em proporção à corrupção pela Sombra da campanha.
                  </p>
                </div>
              )}
            </div>

            {/* Bloco 3: Conteúdo Inicial (NPCs e Mundos) */}
            <div className="rounded-2xl border border-gray-800/80 bg-gray-900/60 p-5 shadow-lg backdrop-blur-sm space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-bold uppercase tracking-wider text-purple-400 flex items-center gap-1.5">
                    <span>📦</span> Conteúdo Inicial
                  </h2>
                  <p className="text-[11px] text-gray-400 mt-0.5">
                    Importe criaturas, aliados e mundos da biblioteca central para a campanha de imediato.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsContentModalOpen(true)}
                  className="rounded-xl border border-purple-700/60 bg-purple-950/40 hover:bg-purple-900/60 px-3.5 py-1.5 text-xs font-bold text-purple-200 transition"
                >
                  {selectedNpcIds.length === 0 && selectedWorldIds.length === 0
                    ? "+ Selecionar Conteúdo"
                    : `Gerenciar (${selectedNpcIds.length + selectedWorldIds.length})`}
                </button>
              </div>

              {(selectedNpcIds.length > 0 || selectedWorldIds.length > 0) && (
                <div className="pt-2 space-y-3">
                  {selectedNpcIds.length > 0 && (
                    <div>
                      <div className="flex items-center justify-between text-xs text-gray-400 mb-1.5">
                        <span>NPCs selecionados ({selectedNpcIds.length}):</span>
                        <button
                          type="button"
                          onClick={() => setSelectedNpcIds([])}
                          className="text-[11px] text-red-400 hover:underline"
                        >
                          Limpar NPCs
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {selectedNpcIds.map((id) => (
                          <span
                            key={id}
                            className="inline-flex items-center gap-1.5 bg-gray-950 border border-gray-800 px-2 py-1 rounded-lg text-xs text-gray-300"
                          >
                            <span className="text-purple-400 font-bold">#</span>
                            <span className="truncate max-w-[120px]">{id.slice(0, 8)}...</span>
                            <button
                              type="button"
                              onClick={() => handleToggleNpc(id)}
                              className="text-gray-500 hover:text-red-400"
                            >
                              ✕
                            </button>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {selectedWorldIds.length > 0 && (
                    <div>
                      <div className="flex items-center justify-between text-xs text-gray-400 mb-1.5">
                        <span>Mundos selecionados ({selectedWorldIds.length}):</span>
                        <button
                          type="button"
                          onClick={() => setSelectedWorldIds([])}
                          className="text-[11px] text-red-400 hover:underline"
                        >
                          Limpar Mundos
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {selectedWorldIds.map((id) => (
                          <span
                            key={id}
                            className="inline-flex items-center gap-1.5 bg-gray-950 border border-blue-900/50 px-2 py-1 rounded-lg text-xs text-blue-200"
                          >
                            <span className="text-blue-400">🌍</span>
                            <span className="truncate max-w-[120px]">{id.slice(0, 8)}...</span>
                            <button
                              type="button"
                              onClick={() => handleToggleWorld(id)}
                              className="text-gray-500 hover:text-red-400"
                            >
                              ✕
                            </button>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Bloco 3: Tema e Acessibilidade da Campanha */}
            <div className="rounded-2xl border border-gray-800/80 bg-gray-900/60 p-5 shadow-lg backdrop-blur-sm space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold uppercase tracking-wider text-purple-400 flex items-center gap-1.5">
                  <span>🎨</span> Tema Visual da Campanha
                </h2>
                <div className="flex items-center gap-1 bg-gray-950 p-1 rounded-lg border border-gray-800 text-[11px]">
                  <button
                    type="button"
                    onClick={() => setThemeModeFilter("all")}
                    className={`px-2 py-0.5 rounded transition ${
                      themeModeFilter === "all"
                        ? "bg-purple-600 text-white font-bold"
                        : "text-gray-400 hover:text-white"
                    }`}
                  >
                    Todos
                  </button>
                  <button
                    type="button"
                    onClick={() => setThemeModeFilter("dark")}
                    className={`px-2 py-0.5 rounded transition ${
                      themeModeFilter === "dark"
                        ? "bg-purple-600 text-white font-bold"
                        : "text-gray-400 hover:text-white"
                    }`}
                  >
                    Escuros
                  </button>
                  <button
                    type="button"
                    onClick={() => setThemeModeFilter("light")}
                    className={`px-2 py-0.5 rounded transition ${
                      themeModeFilter === "light"
                        ? "bg-purple-600 text-white font-bold"
                        : "text-gray-400 hover:text-white"
                    }`}
                  >
                    Claros
                  </button>
                </div>
              </div>

              <p className="text-xs text-gray-400">
                Selecione a identidade visual e atmosfera desta mesa. Todos os temas são calibrados com padrão AAA de contraste.
              </p>

              <div
                className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-72 overflow-y-auto pr-1"
                role="radiogroup"
                aria-label="Seleção de tema da campanha"
              >
                {Object.values(themes)
                  .filter((t) => t.name !== "custom")
                  .filter((t) => (themeModeFilter === "all" ? true : t.mode === themeModeFilter))
                  .map((t) => {
                    const isSelected = selectedTheme === t.name;
                    const evalResult = evaluateThemeContrast(t);

                    return (
                      <div
                        key={t.name}
                        onClick={() => !isLoading && setSelectedTheme(t.name)}
                        role="radio"
                        aria-checked={isSelected}
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === " " || e.key === "Enter") {
                            e.preventDefault();
                            if (!isLoading) setSelectedTheme(t.name);
                          }
                        }}
                        className={`cursor-pointer rounded-xl border p-3 transition-all select-none flex flex-col justify-between gap-2 ${
                          isSelected
                            ? "border-purple-500 bg-purple-950/40 shadow-md ring-1 ring-purple-500/70"
                            : "border-gray-800 bg-gray-950/70 hover:border-gray-700 hover:bg-gray-950"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className="font-bold text-xs text-white truncate">
                              {t.label}
                            </span>
                            <span
                              className={`text-[9px] px-1.5 py-0.2 rounded font-mono ${
                                t.mode === "dark"
                                  ? "bg-gray-800 text-gray-300"
                                  : "bg-amber-100 text-amber-900"
                              }`}
                            >
                              {t.mode === "dark" ? "Escuro" : "Claro"}
                            </span>
                          </div>
                          {isSelected && (
                            <span className="h-2 w-2 rounded-full bg-purple-400 shrink-0" />
                          )}
                        </div>

                        <p className="text-[11px] text-gray-400 line-clamp-1">
                          {t.description}
                        </p>

                        <div className="flex items-center justify-between pt-1 border-t border-gray-800/60">
                          {/* Amostras das 4 cores do sistema */}
                          <div className="flex items-center gap-1">
                            <span
                              className="h-3.5 w-3.5 rounded-full border border-gray-700 shadow-sm"
                              style={{ backgroundColor: t.colors.dominant.deep }}
                              title="Fundo Dominante"
                            />
                            <span
                              className="h-3.5 w-3.5 rounded-full border border-gray-700 shadow-sm"
                              style={{ backgroundColor: t.colors.secondary.card }}
                              title="Superfície de Card"
                            />
                            <span
                              className="h-3.5 w-3.5 rounded-full border border-gray-700 shadow-sm"
                              style={{ backgroundColor: t.colors.accent.primary }}
                              title="Destaque Interativo"
                            />
                            <span
                              className="h-3.5 w-3.5 rounded-full border border-gray-700 shadow-sm"
                              style={{ backgroundColor: t.colors.secondary.pure }}
                              title="Texto Principal"
                            />
                          </div>

                          <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-950/70 px-1.5 py-0.5 rounded border border-emerald-800/60">
                            AAA ({evalResult.textOnDeepRatio}:1)
                          </span>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>

            {/* Ação de Submissão */}
            <div className="pt-2">
              <Button
                type="submit"
                variant="master"
                className="w-full py-3.5 text-sm font-bold shadow-lg shadow-purple-900/30"
                isLoading={isLoading}
              >
                Concluir e Criar Campanha
              </Button>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* COLUNA 2: Mídia, Uploaders e Live Preview (5 Colunas no Desktop)           */}
          {/* ========================================================================= */}
          <div className="lg:col-span-5 space-y-6">
            {/* Bloco de Uploaders de Imagens */}
            <div className="rounded-2xl border border-gray-800/80 bg-gray-900/60 p-5 shadow-lg backdrop-blur-sm space-y-4">
              <h2 className="text-sm font-bold uppercase tracking-wider text-purple-400 flex items-center gap-1.5">
                <span>🖼️</span> Mídia da Campanha
              </h2>

              {uploadError && (
                <div className="rounded-lg border border-red-800 bg-red-950/40 p-2.5 text-xs text-red-300">
                  {uploadError}
                </div>
              )}

              {/* Upload da Capa */}
              <div className="space-y-1.5">
                <span className="block text-xs font-semibold text-gray-300">
                  Imagem de Capa (Banner da Campanha)
                </span>
                <input
                  ref={coverInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFileUpload(file, "cover");
                  }}
                />
                <div className="flex items-center gap-3">
                  {coverImageUrl ? (
                    <div className="relative h-14 w-24 overflow-hidden rounded-lg border border-purple-800/50 bg-gray-950 shadow">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={coverImageUrl}
                        alt="Capa selecionada"
                        className="h-full w-full object-cover"
                      />
                    </div>
                  ) : (
                    <div className="flex h-14 w-24 items-center justify-center rounded-lg border border-dashed border-gray-800 bg-gray-950 text-[10px] text-gray-500">
                      Sem Capa
                    </div>
                  )}

                  <div className="flex-1 space-y-1">
                    <button
                      type="button"
                      disabled={isUploadingCover}
                      onClick={() => coverInputRef.current?.click()}
                      className="rounded-lg bg-gray-800 hover:bg-gray-700 border border-gray-700 px-3 py-1.5 text-xs font-semibold text-white transition disabled:opacity-50"
                    >
                      {isUploadingCover
                        ? "Enviando Capa..."
                        : coverImageUrl
                        ? "Trocar Imagem"
                        : "Upload da Capa"}
                    </button>
                    {coverImageUrl && (
                      <button
                        type="button"
                        onClick={() => setCoverImageUrl(null)}
                        className="block text-[11px] text-gray-500 hover:text-red-400 transition"
                      >
                        Remover capa
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Upload do Mapa Mundi */}
              <div className="space-y-1.5 pt-3 border-t border-gray-800/70">
                <span className="block text-xs font-semibold text-gray-300">
                  Mapa Mundi Geral (Opcional)
                </span>
                <input
                  ref={mapInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFileUpload(file, "map");
                  }}
                />
                <div className="flex items-center gap-3">
                  {worldMapUrl ? (
                    <div className="relative h-14 w-24 overflow-hidden rounded-lg border border-purple-800/50 bg-gray-950 shadow">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={worldMapUrl}
                        alt="Mapa selecionado"
                        className="h-full w-full object-cover"
                      />
                    </div>
                  ) : (
                    <div className="flex h-14 w-24 items-center justify-center rounded-lg border border-dashed border-gray-800 bg-gray-950 text-[10px] text-gray-500">
                      Sem Mapa
                    </div>
                  )}

                  <div className="flex-1 space-y-1">
                    <button
                      type="button"
                      disabled={isUploadingMap}
                      onClick={() => mapInputRef.current?.click()}
                      className="rounded-lg bg-gray-800 hover:bg-gray-700 border border-gray-700 px-3 py-1.5 text-xs font-semibold text-white transition disabled:opacity-50"
                    >
                      {isUploadingMap
                        ? "Enviando Mapa..."
                        : worldMapUrl
                        ? "Trocar Imagem"
                        : "Upload do Mapa"}
                    </button>
                    {worldMapUrl && (
                      <button
                        type="button"
                        onClick={() => setWorldMapUrl(null)}
                        className="block text-[11px] text-gray-500 hover:text-red-400 transition"
                      >
                        Remover mapa
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Bloco de Assets e Handouts Iniciais (Issue #61) */}
            <div className="rounded-2xl border border-gray-800/80 bg-gray-900/60 p-5 shadow-lg backdrop-blur-sm space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-bold uppercase tracking-wider text-purple-400 flex items-center gap-1.5">
                    <span>📜</span> Assets e Handouts da Campanha (Opcional)
                  </h2>
                  <p className="text-[11px] text-gray-400 mt-0.5">
                    Pré-carregue ilustrações, mapas e documentos para compartilhar durante as sessões.
                  </p>
                </div>
                {initialAssets.length > 0 && (
                  <span className="rounded-full bg-purple-950 border border-purple-700/60 px-2.5 py-0.5 text-xs font-bold text-purple-300">
                    {initialAssets.length}
                  </span>
                )}
              </div>

              {/* Formulário para novo asset */}
              <div className="rounded-xl border border-gray-800 bg-gray-950/70 p-3.5 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-300 mb-1">
                      Nome do Asset *
                    </label>
                    <input
                      type="text"
                      placeholder="Ex: Carta Antiga, Mapa do Covil"
                      value={newAssetName}
                      onChange={(e) => setNewAssetName(e.target.value)}
                      className="w-full rounded-lg border border-gray-800 bg-gray-900 px-2.5 py-1.5 text-xs text-white outline-none focus:border-purple-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-gray-300 mb-1">
                      Categoria
                    </label>
                    <select
                      value={newAssetCategory}
                      onChange={(e) => setNewAssetCategory(e.target.value)}
                      className="w-full rounded-lg border border-gray-800 bg-gray-900 px-2.5 py-1.5 text-xs text-white outline-none focus:border-purple-500"
                    >
                      <option value="handout">📜 Handout</option>
                      <option value="map">🗺️ Mapa</option>
                      <option value="illustration">🎨 Ilustração</option>
                      <option value="scene">🎬 Cena</option>
                      <option value="token">🪙 Token</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-gray-300 mb-1">
                    Descrição (Opcional)
                  </label>
                  <input
                    type="text"
                    placeholder="Nota visível aos jogadores ao compartilhar..."
                    value={newAssetDescription}
                    onChange={(e) => setNewAssetDescription(e.target.value)}
                    className="w-full rounded-lg border border-gray-800 bg-gray-900 px-2.5 py-1.5 text-xs text-white outline-none focus:border-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-gray-300 mb-1">
                    Imagem (URL ou Upload)
                  </label>
                  <input
                    ref={assetInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleAssetFileUpload(file);
                    }}
                  />
                  <div className="flex items-center gap-2">
                    <input
                      type="url"
                      placeholder="https://exemplo.com/imagem.jpg"
                      value={newAssetImageUrl}
                      onChange={(e) => setNewAssetImageUrl(e.target.value)}
                      className="flex-1 rounded-lg border border-gray-800 bg-gray-900 px-2.5 py-1.5 text-xs text-white font-mono outline-none focus:border-purple-500"
                    />
                    <button
                      type="button"
                      disabled={isUploadingAsset}
                      onClick={() => assetInputRef.current?.click()}
                      className="rounded-lg bg-gray-800 hover:bg-gray-700 border border-gray-700 px-3 py-1.5 text-xs font-semibold text-white transition shrink-0 disabled:opacity-50"
                    >
                      {isUploadingAsset ? "Enviando..." : "📁 Upload"}
                    </button>
                  </div>
                </div>

                <div className="pt-1 flex justify-end">
                  <button
                    type="button"
                    onClick={handleAddInitialAsset}
                    className="rounded-lg bg-purple-600 hover:bg-purple-500 px-3 py-1.5 text-xs font-bold text-white transition shadow flex items-center gap-1"
                  >
                    <span>＋</span>
                    <span>Adicionar à Lista</span>
                  </button>
                </div>
              </div>

              {/* Lista dos Assets Adicionados */}
              {initialAssets.length > 0 && (
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {initialAssets.map((asset, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between gap-3 rounded-lg border border-gray-800 bg-gray-950/80 p-2 text-xs"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="h-9 w-9 shrink-0 overflow-hidden rounded border border-gray-800 bg-gray-900">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={asset.imageUrl}
                            alt={asset.name}
                            className="h-full w-full object-cover"
                          />
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-white truncate max-w-[170px]">
                            {asset.name}
                          </p>
                          <span className="text-[10px] text-gray-400 capitalize">
                            {asset.category}
                          </span>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleRemoveInitialAsset(index)}
                        title="Remover asset da lista"
                        className="rounded p-1 text-gray-500 hover:bg-gray-800 hover:text-red-400 transition"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Live Preview em Tempo Real */}
            <div className="rounded-2xl border border-gray-800/80 bg-gray-900/60 p-5 shadow-lg backdrop-blur-sm space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold uppercase tracking-wider text-purple-400 flex items-center gap-1.5">
                  <span>👁️</span> Live Preview do Card
                </h2>
                <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-gray-800 text-gray-400">
                  Tempo Real
                </span>
              </div>
              <p className="text-[11px] text-gray-400">
                Visualização de como o card aparecerá nas listas do Mestre e dos Jogadores:
              </p>

              {/* Card Simulado */}
              {(() => {
                const previewTheme = themes[selectedTheme] || themes["default-dark"];
                return (
                  <div
                    className="relative overflow-hidden rounded-xl border p-5 shadow-xl transition-all"
                    style={{
                      backgroundColor: previewTheme.colors.secondary.card,
                      borderColor: previewTheme.colors.secondary.border,
                      fontFamily: previewTheme.fonts.body,
                      ...(coverImageUrl
                        ? {
                            backgroundImage: `url(${coverImageUrl})`,
                            backgroundSize: "cover",
                            backgroundPosition: "center",
                          }
                        : {}),
                    }}
                  >
                    {/* Overlay escuro elegante se houver capa */}
                    {coverImageUrl && (
                      <div className="absolute inset-0 bg-gradient-to-t from-gray-950 via-gray-950/80 to-gray-950/60 pointer-events-none" />
                    )}

                    <div className="relative z-10 space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <h3
                          className="text-lg font-bold drop-shadow-md"
                          style={{
                            color: previewTheme.colors.secondary.pure,
                            fontFamily: previewTheme.fonts.heading,
                          }}
                        >
                          {name || "Nome da Sua Campanha"}
                        </h3>
                        <div className="flex shrink-0 items-center gap-1.5">
                          {pvpEnabled && (
                            <span
                              className="rounded border px-2 py-0.5 text-[10px] font-semibold drop-shadow"
                              style={{
                                backgroundColor: previewTheme.colors.accent.dark,
                                borderColor: previewTheme.colors.accent.vibrant,
                                color: previewTheme.colors.secondary.pure,
                              }}
                            >
                              PvP Ativo
                            </span>
                          )}
                          {worldMapUrl && (
                            <span className="rounded-full bg-emerald-950/90 border border-emerald-700/60 px-2 py-0.5 text-[10px] font-semibold text-emerald-300 drop-shadow">
                              🗺️ Mapa Mundi
                            </span>
                          )}
                        </div>
                      </div>

                      <p
                        className="text-xs line-clamp-2 drop-shadow-sm min-h-[2rem]"
                        style={{ color: previewTheme.colors.secondary.offwhite }}
                      >
                        {description || "A descrição da campanha aparecerá aqui..."}
                      </p>

                      <div className="flex flex-wrap gap-2 text-xs pt-1">
                        <span
                          className="inline-flex items-center gap-1 rounded border px-2 py-1 text-[11px] drop-shadow-sm"
                          style={{
                            backgroundColor: previewTheme.colors.dominant.dark,
                            borderColor: previewTheme.colors.dominant.border,
                            color: previewTheme.colors.secondary.pure,
                          }}
                        >
                          {rulesEngine === "d20_mod" ? (
                            /* eslint-disable-next-line @next/next/no-img-element */
                            <img
                              src="/DD-Logo.png"
                              alt="D&D Logo"
                              className="h-4 w-auto object-contain inline-block"
                            />
                          ) : (
                            "2d20 somado"
                          )}
                        </span>
                        {difficultyModifierShadowPoints > 0 && (
                          <span
                            className="rounded border px-2 py-1 text-[11px] drop-shadow-sm"
                            style={{
                              backgroundColor: previewTheme.colors.accent.glow,
                              borderColor: previewTheme.colors.accent.primary,
                              color: previewTheme.colors.accent.hover,
                            }}
                          >
                            Sombra +{difficultyModifierShadowPoints}
                          </span>
                        )}
                        {selectedNpcIds.length > 0 && (
                          <span className="rounded bg-purple-950/80 border border-purple-700/50 px-2 py-1 text-purple-300 text-[11px] drop-shadow-sm">
                            {selectedNpcIds.length} NPCs
                          </span>
                        )}
                        {selectedWorldIds.length > 0 && (
                          <span className="rounded bg-blue-950/80 border border-blue-700/50 px-2 py-1 text-blue-300 text-[11px] drop-shadow-sm">
                            {selectedWorldIds.length} {selectedWorldIds.length === 1 ? "Mundo" : "Mundos"}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      </Form>

      {/* Modal de Seleção de Conteúdo Inicial (NPCs e Mundos) */}
      <InitialContentModal
        isOpen={isContentModalOpen}
        onClose={() => setIsContentModalOpen(false)}
        selectedNpcIds={selectedNpcIds}
        onToggleNpc={handleToggleNpc}
        onSelectMultipleNpcs={setSelectedNpcIds}
        selectedWorldIds={selectedWorldIds}
        onToggleWorld={handleToggleWorld}
        onSelectMultipleWorlds={setSelectedWorldIds}
      />
    </div>
  );
}
