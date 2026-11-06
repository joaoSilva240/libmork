"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  Clapperboard,
  Coins,
  EyeOff,
  FileUp,
  Image as ImageIcon,
  Link,
  Loader2,
  Map as MapIcon,
  Maximize2,
  Palette,
  Play,
  Plus,
  Presentation,
  Scroll,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import type { CampaignAsset } from "@/types";
import { useSocket } from "@/context/SocketContext";

export interface MasterAssetsPanelProps {
  campaignId: string;
  initialActiveAssetId?: string | null;
  className?: string;
  isCompact?: boolean;
}

const CATEGORIES: { value: string; label: string; icon: React.ComponentType<{ size?: number }> }[] =
  [
    { value: "handout", label: "Handout", icon: Scroll },
    { value: "map", label: "Mapa", icon: MapIcon },
    { value: "illustration", label: "Ilustração", icon: Palette },
    { value: "scene", label: "Cena", icon: Clapperboard },
    { value: "token", label: "Token", icon: Coins },
  ];

export function MasterAssetsPanel({
  campaignId,
  initialActiveAssetId = null,
  className = "",
  isCompact = false,
}: MasterAssetsPanelProps) {
  const socketContext = useSocket() || {};
  const {
    activeAsset,
    activateCampaignAsset,
    deactivateCampaignAsset,
    subscribeCampaignAssetActivated,
    subscribeCampaignAssetDeactivated,
  } = socketContext;

  const [assets, setAssets] = useState<CampaignAsset[]>([]);
  const [activeAssetId, setActiveAssetId] = useState<string | null>(
    initialActiveAssetId ?? activeAsset?.id ?? null,
  );
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Estados do Modal / Formulário de Criação
  const [isCreateOpen, setIsCreateOpen] = useState<boolean>(false);
  const [createMode, setCreateMode] = useState<"file" | "url">("url");
  const [name, setName] = useState<string>("");
  const [category, setCategory] = useState<string>("handout");
  const [description, setDescription] = useState<string>("");
  const [imageUrl, setImageUrl] = useState<string>("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Estado de Preview e Exclusão
  const [previewAsset, setPreviewAsset] = useState<CampaignAsset | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Busca lista de assets
  const fetchAssets = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/assets`, {
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Erro ao carregar assets da campanha");
      }
      setAssets(data.data || []);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro ao carregar assets";
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  }, [campaignId]);

  useEffect(() => {
    fetchAssets();
  }, [fetchAssets]);

  // Sincronização em tempo real de ativação/desativação
  useEffect(() => {
    if (activeAsset) {
      setActiveAssetId(activeAsset.id);
    }
  }, [activeAsset]);

  useEffect(() => {
    const unsubActivated = subscribeCampaignAssetActivated
      ? subscribeCampaignAssetActivated((asset) => {
          setActiveAssetId(asset.id);
        })
      : () => {};
    const unsubDeactivated = subscribeCampaignAssetDeactivated
      ? subscribeCampaignAssetDeactivated(() => {
          setActiveAssetId(null);
        })
      : () => {};
    return () => {
      unsubActivated();
      unsubDeactivated();
    };
  }, [subscribeCampaignAssetActivated, subscribeCampaignAssetDeactivated]);

  // Handler de Ativação (Apresentar aos Jogadores)
  const handleActivate = async (asset: CampaignAsset) => {
    setActionLoadingId(asset.id);
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/assets/${asset.id}/activate`, {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Falha ao ativar asset");
      }
      setActiveAssetId(asset.id);
      if (activateCampaignAsset) {
        activateCampaignAsset({ campaignId, asset });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro ao ativar asset";
      alert(msg);
    } finally {
      setActionLoadingId(null);
    }
  };

  // Handler de Desativação (Ocultar da Mesa)
  const handleDeactivate = async () => {
    setActionLoadingId("deactivate");
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/assets/deactivate`, {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Falha ao desativar asset");
      }
      setActiveAssetId(null);
      if (deactivateCampaignAsset) {
        deactivateCampaignAsset({ campaignId });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro ao desativar asset";
      alert(msg);
    } finally {
      setActionLoadingId(null);
    }
  };

  // Handler de Exclusão
  const handleDelete = async (assetId: string) => {
    if (!window.confirm("Deseja realmente excluir este asset da campanha?")) {
      return;
    }

    setDeletingId(assetId);
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/assets/${assetId}`, {
        method: "DELETE",
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Falha ao remover asset");
      }

      setAssets((prev) => prev.filter((a) => a.id !== assetId));
      if (activeAssetId === assetId) {
        setActiveAssetId(null);
        if (deactivateCampaignAsset) {
          deactivateCampaignAsset({ campaignId });
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro ao remover asset";
      alert(msg);
    } finally {
      setDeletingId(null);
    }
  };

  // Handler de Criação de Novo Asset
  const handleCreateAsset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setFormError("O nome do asset é obrigatório.");
      return;
    }

    setIsSubmitting(true);
    setFormError(null);

    try {
      let created: CampaignAsset;

      if (createMode === "file") {
        if (!selectedFile) {
          throw new Error("Selecione um arquivo de imagem para enviar.");
        }
        const formData = new FormData();
        formData.append("name", name.trim());
        formData.append("category", category);
        if (description.trim()) formData.append("description", description.trim());
        formData.append("file", selectedFile);

        const res = await fetch(`/api/campaigns/${campaignId}/assets`, {
          method: "POST",
          credentials: "include",
          body: formData,
        });
        const data = await res.json();
        if (!res.ok || !data.success) {
          throw new Error(data.error || "Erro ao fazer upload do asset");
        }
        created = data.data;
      } else {
        if (!imageUrl.trim()) {
          throw new Error("Informe a URL da imagem.");
        }
        const res = await fetch(`/api/campaigns/${campaignId}/assets`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            name: name.trim(),
            category,
            description: description.trim() || null,
            imageUrl: imageUrl.trim(),
          }),
        });
        const data = await res.json();
        if (!res.ok || !data.success) {
          throw new Error(data.error || "Erro ao criar asset");
        }
        created = data.data;
      }

      setAssets((prev) => [created, ...prev]);
      setName("");
      setDescription("");
      setImageUrl("");
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      setIsCreateOpen(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro ao salvar asset";
      setFormError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const SelectedCategoryIcon = CATEGORIES.find((c) => c.value === category)?.icon ?? ImageIcon;

  return (
    <div
      className={`rounded-xl border border-secondary-border bg-secondary-card p-3 text-secondary-pure ${className}`}
    >
      {/* Cabeçalho do Painel */}
      <div className="mb-2 flex items-center justify-between gap-2 border-b border-secondary-border/70 pb-2">
        <div className="flex min-w-0 items-center gap-1.5">
          <Presentation size={14} className="shrink-0 text-accent" />
          <h3 className="flex min-w-0 items-center gap-1.5 text-xs font-bold text-white">
            <span className="truncate">Assets &amp; Handouts</span>
            {assets.length > 0 && (
              <span className="shrink-0 text-[10px] font-medium text-secondary-muted">
                {assets.length}
              </span>
            )}
          </h3>
          {!isCompact && (
            <p className="hidden truncate text-[11px] text-secondary-muted lg:block">
              Compartilhe ilustrações, mapas e handouts em tempo real na tela dos jogadores.
            </p>
          )}
        </div>

        <button
          type="button"
          onClick={() => setIsCreateOpen(true)}
          aria-label="Novo Asset"
          title="Novo Asset"
          className="flex shrink-0 items-center gap-1 rounded-md bg-accent px-2 py-1 text-[11px] font-bold text-white transition hover:bg-accent-vibrant"
        >
          <Plus size={12} />
          <span className={isCompact ? "sr-only" : undefined}>Novo Asset</span>
        </button>
      </div>

      {/* Mensagem de Erro Geral */}
      {error && (
        <div className="mb-3 rounded-lg border border-red-800 bg-red-950/40 p-2.5 text-xs text-red-300">
          {error}
        </div>
      )}

      {/* Lista de Assets */}
      {isLoading ? (
        <div className="flex items-center justify-center gap-1.5 py-5 text-[11px] text-secondary-muted">
          <Loader2 size={12} className="animate-spin" />
          <span>Carregando assets da campanha...</span>
        </div>
      ) : assets.length === 0 ? (
        <div className="flex flex-col items-center gap-1 rounded-lg border border-dashed border-secondary-border/60 py-5">
          <ImageIcon size={16} className="text-secondary-muted" />
          <p className="text-[11px] text-secondary-muted">Nenhum asset cadastrado ainda.</p>
          <button
            type="button"
            onClick={() => setIsCreateOpen(true)}
            className="text-[11px] font-semibold text-accent-vibrant hover:underline"
          >
            Adicionar o primeiro handout ou mapa
          </button>
        </div>
      ) : (
        <div className="max-h-[320px] space-y-1 overflow-y-auto pr-1">
          {assets.map((asset) => {
            const isActive = activeAssetId === asset.id;
            const cat = CATEGORIES.find((c) => c.value === asset.category) || {
              label: asset.category,
              icon: ImageIcon,
            };
            const CatIcon = cat.icon;

            return (
              <div
                key={asset.id}
                data-testid={`asset-card-${asset.id}`}
                className={`flex items-center gap-2 rounded-md border px-1.5 py-1 transition ${
                  isActive
                    ? "border-emerald-600/60 bg-emerald-950/25"
                    : "border-transparent hover:border-secondary-border/70 hover:bg-dominant-deep/60"
                }`}
              >
                {/* Miniatura */}
                <div
                  onClick={() => setPreviewAsset(asset)}
                  role="button"
                  tabIndex={0}
                  title="Clique para ampliar"
                  className="group relative h-8 w-8 shrink-0 cursor-pointer overflow-hidden rounded border border-secondary-border bg-gray-900"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={asset.imageUrl}
                    alt={asset.name}
                    className="h-full w-full object-cover"
                  />
                  <div className="absolute inset-0 flex items-center justify-center bg-black/40 text-white opacity-0 transition group-hover:opacity-100">
                    <Maximize2 size={10} />
                  </div>
                </div>

                {/* Nome, categoria e descrição */}
                <div className="min-w-0 flex-1">
                  <div className="flex min-w-0 items-center gap-1.5">
                    <span title={cat.label} className="shrink-0 text-secondary-muted">
                      <CatIcon size={11} />
                    </span>
                    <span
                      title={asset.description || asset.name}
                      className="truncate text-[11px] font-semibold text-white"
                    >
                      {asset.name}
                    </span>
                    {isActive && (
                      <span className="shrink-0 rounded-sm bg-emerald-950 px-1 text-[8px] font-bold uppercase tracking-wider text-emerald-400">
                        ATIVO NA MESA
                      </span>
                    )}
                  </div>
                  {!isCompact && asset.description && (
                    <p className="truncate text-[10px] text-secondary-muted">{asset.description}</p>
                  )}
                </div>

                {/* Ações do Asset */}
                <div className="flex shrink-0 items-center gap-0.5">
                  <button
                    type="button"
                    onClick={() => setPreviewAsset(asset)}
                    title="Pré-visualizar em tamanho ampliado"
                    aria-label={`Pré-visualizar ${asset.name}`}
                    className="rounded p-1 text-secondary-muted transition hover:bg-dominant-container hover:text-white"
                  >
                    <Maximize2 size={12} />
                  </button>

                  {isActive ? (
                    <button
                      type="button"
                      onClick={handleDeactivate}
                      disabled={actionLoadingId === "deactivate"}
                      aria-label="Ocultar da Mesa"
                      title="Ocultar da Mesa"
                      className="rounded p-1 text-amber-400 transition hover:bg-amber-950/60 hover:text-amber-300 disabled:opacity-50"
                    >
                      {actionLoadingId === "deactivate" ? (
                        <Loader2 size={12} className="animate-spin" />
                      ) : (
                        <EyeOff size={12} />
                      )}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleActivate(asset)}
                      disabled={actionLoadingId === asset.id}
                      aria-label="Apresentar aos Jogadores"
                      title="Apresentar aos Jogadores"
                      className="rounded p-1 text-emerald-400 transition hover:bg-emerald-950/60 hover:text-emerald-300 disabled:opacity-50"
                    >
                      {actionLoadingId === asset.id ? (
                        <Loader2 size={12} className="animate-spin" />
                      ) : (
                        <Play size={12} />
                      )}
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => handleDelete(asset.id)}
                    disabled={deletingId === asset.id}
                    title="Excluir asset"
                    aria-label={`Excluir asset ${asset.name}`}
                    className="rounded p-1 text-secondary-muted transition hover:bg-red-950/60 hover:text-red-400 disabled:opacity-50"
                  >
                    {deletingId === asset.id ? (
                      <Loader2 size={12} className="animate-spin" />
                    ) : (
                      <Trash2 size={12} />
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal de Criação de Asset */}
      {isCreateOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="create-asset-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
        >
          <div className="relative w-full max-w-lg rounded-xl border border-secondary-border bg-secondary-card p-5 shadow-2xl text-secondary-pure">
            <div className="flex items-center justify-between border-b border-secondary-border/70 pb-3 mb-4">
              <h4
                id="create-asset-title"
                className="flex items-center gap-2 text-sm font-bold text-white"
              >
                <Sparkles size={14} className="text-accent" /> Adicionar Asset ou Handout
              </h4>
              <button
                type="button"
                onClick={() => setIsCreateOpen(false)}
                aria-label="Fechar"
                className="rounded p-1 text-secondary-muted transition hover:bg-dominant-container hover:text-white"
              >
                <X size={14} />
              </button>
            </div>

            {formError && (
              <div className="mb-3 rounded-lg border border-red-800 bg-red-950/40 p-2.5 text-xs text-red-300">
                {formError}
              </div>
            )}

            <form onSubmit={handleCreateAsset} className="space-y-3.5">
              {/* Nome */}
              <div>
                <label className="block text-xs font-semibold text-secondary-pure mb-1">
                  Nome do Asset *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Carta Misteriosa, Mapa da Cidadela"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-lg border border-secondary-border bg-dominant-deep px-3 py-2 text-xs text-secondary-pure outline-none focus:ring-1 focus:ring-accent"
                />
              </div>

              {/* Categoria */}
              <div>
                <label className="block text-xs font-semibold text-secondary-pure mb-1">
                  Categoria
                </label>
                <div className="flex items-center gap-2">
                  <SelectedCategoryIcon size={14} className="shrink-0 text-secondary-muted" />
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full rounded-lg border border-secondary-border bg-dominant-deep px-3 py-2 text-xs text-secondary-pure outline-none focus:ring-1 focus:ring-accent"
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c.value} value={c.value}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Descrição */}
              <div>
                <label className="block text-xs font-semibold text-secondary-pure mb-1">
                  Descrição (Opcional - visível para jogadores quando exibido)
                </label>
                <textarea
                  rows={2}
                  placeholder="Anotação ou texto revelado junto ao handout..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full rounded-lg border border-secondary-border bg-dominant-deep px-3 py-2 text-xs text-secondary-pure outline-none focus:ring-1 focus:ring-accent"
                />
              </div>

              {/* Seletor de Modo: Arquivo ou URL */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <button
                    type="button"
                    onClick={() => setCreateMode("url")}
                    className={`flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-semibold transition ${
                      createMode === "url"
                        ? "bg-accent text-white"
                        : "bg-dominant-container text-secondary-muted hover:text-white"
                    }`}
                  >
                    <Link size={12} /> URL da Imagem
                  </button>
                  <button
                    type="button"
                    onClick={() => setCreateMode("file")}
                    className={`flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-semibold transition ${
                      createMode === "file"
                        ? "bg-accent text-white"
                        : "bg-dominant-container text-secondary-muted hover:text-white"
                    }`}
                  >
                    <FileUp size={12} /> Upload de Arquivo
                  </button>
                </div>

                {createMode === "url" ? (
                  <input
                    type="url"
                    placeholder="https://exemplo.com/imagem.jpg"
                    value={imageUrl}
                    onChange={(e) => setImageUrl(e.target.value)}
                    className="w-full rounded-lg border border-secondary-border bg-dominant-deep px-3 py-2 text-xs text-secondary-pure font-mono outline-none focus:ring-1 focus:ring-accent"
                  />
                ) : (
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                    className="w-full text-xs text-secondary-pure file:mr-2 file:rounded file:border-0 file:bg-dominant-container file:px-2.5 file:py-1 file:text-xs file:font-semibold file:text-white hover:file:bg-accent"
                  />
                )}
              </div>

              {/* Botões do Formulário */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-secondary-border/70">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  disabled={isSubmitting}
                  className="rounded-lg border border-secondary-border bg-dominant-container px-3.5 py-1.5 text-xs font-semibold text-secondary-pure hover:bg-dominant-container/80 transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="rounded-lg bg-accent px-4 py-1.5 text-xs font-bold text-white hover:bg-accent-vibrant transition shadow disabled:opacity-50"
                >
                  {isSubmitting ? "Salvando..." : "Salvar Asset"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Pré-visualização Ampliada */}
      {previewAsset && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="preview-asset-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md"
          onClick={() => setPreviewAsset(null)}
        >
          <div
            className="relative flex flex-col w-full max-w-3xl max-h-[90vh] overflow-hidden rounded-xl border border-secondary-border bg-gray-950 p-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-gray-800 pb-2 mb-3">
              <h4 id="preview-asset-title" className="text-sm font-bold text-white">
                {previewAsset.name}
              </h4>
              <button
                type="button"
                onClick={() => setPreviewAsset(null)}
                aria-label="Fechar pré-visualização"
                className="rounded p-1 text-gray-400 transition hover:bg-gray-800 hover:text-white"
              >
                <X size={14} />
              </button>
            </div>

            <div className="flex-1 overflow-auto flex items-center justify-center bg-black/50 rounded-lg p-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={previewAsset.imageUrl}
                alt={previewAsset.name}
                className="max-h-[70vh] w-auto max-w-full object-contain rounded"
              />
            </div>

            {previewAsset.description && (
              <p className="mt-3 text-xs text-gray-300 whitespace-pre-wrap bg-gray-900/60 p-2.5 rounded border border-gray-800">
                {previewAsset.description}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
