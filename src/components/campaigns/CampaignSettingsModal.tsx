"use client";

import { useState } from "react";
import type { Campaign } from "@/types";
import { themes, type ThemeName } from "@/lib/theme";
import { MasterAssetsPanel } from "./MasterAssetsPanel";
import { useSocket } from "@/context/SocketContext";

type CampaignSettingsModalProps = {
  campaign: Campaign;
  onClose: () => void;
  onSaved: (updatedCampaign: Campaign) => void;
  onDelete: () => Promise<void> | void;
  isDeleting?: boolean;
};

export function CampaignSettingsModal({
  campaign,
  onClose,
  onSaved,
  onDelete,
  isDeleting = false,
}: CampaignSettingsModalProps) {
  const { broadcastCampaignDice3DSettings } = useSocket();

  const [name, setName] = useState(campaign.name);
  const [description, setDescription] = useState(campaign.description || "");
  const [theme, setTheme] = useState<string>(campaign.theme || "default-dark");
  const [coverImageUrl, setCoverImageUrl] = useState(campaign.coverImageUrl || "");
  const [pvpEnabled, setPvpEnabled] = useState(campaign.pvpEnabled);
  const [difficultyModifier, setDifficultyModifier] = useState<number>(
    campaign.difficultyModifierShadowPoints || 0
  );
  const [dice3dPlayersEnabled, setDice3dPlayersEnabled] = useState(
    campaign.dice3dPlayersEnabled ?? true
  );
  const [dice3dMasterEnabled, setDice3dMasterEnabled] = useState(
    campaign.dice3dMasterEnabled ?? true
  );
  const [activeTab, setActiveTab] = useState<"geral" | "assets">("geral");

  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("O nome da campanha é obrigatório.");
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const response = await fetch(`/api/campaigns/${campaign.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || null,
          theme: theme || "default-dark",
          coverImageUrl: coverImageUrl.trim() || null,
          pvpEnabled,
          difficultyModifierShadowPoints: Number(difficultyModifier) || 0,
          dice3dPlayersEnabled,
          dice3dMasterEnabled,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Erro ao salvar alterações da campanha");
        return;
      }

      broadcastCampaignDice3DSettings?.({
        campaignId: campaign.id,
        dice3dPlayersEnabled,
        dice3dMasterEnabled,
      });

      onSaved(data.data as Campaign);
      onClose();
    } catch {
      setError("Erro de conexão ao salvar alterações");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-labelledby="campaign-settings-title"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
    >
      <div className="relative w-full max-w-2xl max-h-[90vh] flex flex-col rounded-xl border border-secondary-border bg-secondary-card text-secondary-pure shadow-2xl overflow-hidden">
        {/* Cabeçalho */}
        <div className="flex items-center justify-between border-b border-secondary-border px-5 py-3.5 bg-dominant-deep">
          <div className="flex items-center gap-2">
            <span className="text-xl">⚙️</span>
            <div>
              <h2 id="campaign-settings-title" className="text-base font-bold text-secondary-pure">
                Configurações da Campanha
              </h2>
              <p className="text-xs text-secondary-muted">
                Edite os detalhes, regras visuais e dados fundamentais de {campaign.name}.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-secondary-muted hover:bg-dominant-container hover:text-secondary-pure transition"
            aria-label="Fechar configurações"
          >
            ✕
          </button>
        </div>

        {/* Abas de Navegação */}
        <div className="flex items-center border-b border-secondary-border bg-dominant-deep/70 px-5 gap-4">
          <button
            type="button"
            onClick={() => setActiveTab("geral")}
            className={`py-2.5 text-xs font-bold border-b-2 transition flex items-center gap-1.5 ${
              activeTab === "geral"
                ? "border-accent text-accent-vibrant"
                : "border-transparent text-secondary-muted hover:text-secondary-pure"
            }`}
          >
            <span>⚙️</span>
            <span>Geral</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("assets")}
            className={`py-2.5 text-xs font-bold border-b-2 transition flex items-center gap-1.5 ${
              activeTab === "assets"
                ? "border-accent text-accent-vibrant"
                : "border-transparent text-secondary-muted hover:text-secondary-pure"
            }`}
          >
            <span>🖼️</span>
            <span>Assets & Handouts</span>
          </button>
        </div>

        {activeTab === "assets" ? (
          <div className="flex-1 overflow-y-auto p-5">
            <MasterAssetsPanel
              campaignId={campaign.id}
              initialActiveAssetId={campaign.activeAssetId}
              isCompact={false}
            />
          </div>
        ) : (
          /* Corpo do formulário com scroll */
          <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-5 space-y-5">
            {error && (
              <div className="rounded-lg border border-red-800 bg-red-950/40 p-3 text-xs text-red-300">
                {error}
              </div>
            )}

          {/* Nome da Campanha */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold uppercase tracking-wider text-accent-hover">
              Nome da Campanha *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              maxLength={200}
              placeholder="Ex: As Crônicas de Morkvold"
              className="w-full rounded-lg border border-secondary-border bg-dominant-deep px-3 py-2 text-sm text-secondary-pure outline-none focus:ring-2 focus:ring-accent"
            />
          </div>

          {/* Descrição */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold uppercase tracking-wider text-accent-hover">
              Descrição do Cenário & Sinopse
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              maxLength={5000}
              placeholder="Resumo da premissa da aventura, objetivos do grupo ou anotações gerais..."
              className="w-full rounded-lg border border-secondary-border bg-dominant-deep px-3 py-2 text-xs text-secondary-pure outline-none focus:ring-2 focus:ring-accent leading-relaxed"
            />
          </div>

          {/* Tema Visual da Campanha */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold uppercase tracking-wider text-accent-hover">
              Tema Visual Oficial da Campanha (WCAG AAA)
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {Object.values(themes).map((t) => {
                const isSelected = theme === t.name;
                return (
                  <button
                    key={t.name}
                    type="button"
                    onClick={() => setTheme(t.name)}
                    className={`flex items-center justify-between p-2.5 rounded-lg border text-left transition select-none ${
                      isSelected
                        ? "border-accent ring-2 ring-accent"
                        : "border-secondary-border hover:border-accent/40"
                    }`}
                    style={{
                      backgroundColor: t.colors.dominant.deep,
                      color: t.colors.secondary.pure,
                    }}
                  >
                    <div className="min-w-0 pr-2">
                      <span className="text-xs font-bold block truncate">{t.label}</span>
                      <span
                        className="text-[10px] block truncate"
                        style={{ color: t.colors.secondary.muted }}
                      >
                        {t.mode === "dark" ? "🌙 Escuro" : "☀️ Claro"}
                      </span>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <span
                        className="h-3 w-3 rounded-full border border-white/20"
                        style={{ backgroundColor: t.colors.dominant.deep }}
                        title="Dominante"
                      />
                      <span
                        className="h-3 w-3 rounded-full border border-white/20"
                        style={{ backgroundColor: t.colors.secondary.card }}
                        title="Card"
                      />
                      <span
                        className="h-3 w-3 rounded-full"
                        style={{ backgroundColor: t.colors.accent.primary }}
                        title="Destaque"
                      />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* URL da Imagem de Capa */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold uppercase tracking-wider text-accent-hover">
              URL da Imagem de Capa (Opcional)
            </label>
            <input
              type="text"
              value={coverImageUrl}
              onChange={(e) => setCoverImageUrl(e.target.value)}
              placeholder="https://exemplo.com/capa.jpg ou /images/..."
              className="w-full rounded-lg border border-secondary-border bg-dominant-deep px-3 py-2 text-xs text-secondary-pure font-mono outline-none focus:ring-2 focus:ring-accent"
            />
          </div>

          {/* Regras e Parâmetros da Mesa */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-secondary-border/60">
            {/* Toggle PvP */}
            <label className="flex items-center justify-between p-3 rounded-lg border border-secondary-border bg-dominant-deep cursor-pointer group">
              <div>
                <span className="text-xs font-bold text-secondary-pure group-hover:text-accent-hover transition block">
                  Combate entre Jogadores (PvP)
                </span>
                <span className="text-[11px] text-secondary-muted block mt-0.5">
                  Permite rolagens diretas de ataque entre personagens aliados.
                </span>
              </div>
              <input
                type="checkbox"
                checked={pvpEnabled}
                onChange={(e) => setPvpEnabled(e.target.checked)}
                className="h-4 w-4 rounded border-secondary-border bg-secondary-card text-accent focus:ring-2 focus:ring-accent cursor-pointer ml-3 shrink-0"
              />
            </label>

            {/* Modificador de Pontos de Sombra */}
            <div className="p-3 rounded-lg border border-secondary-border bg-dominant-deep flex flex-col justify-between">
              <div>
                <label className="text-xs font-bold text-secondary-pure block">
                  Dificuldade / Pontos de Sombra
                </label>
                <span className="text-[11px] text-secondary-muted block mt-0.5">
                  Acréscimo fixo de perigo para regras sombrias e testes de estresse.
                </span>
              </div>
              <input
                type="number"
                min={0}
                max={99}
                value={difficultyModifier}
                onChange={(e) => setDifficultyModifier(Number(e.target.value) || 0)}
                className="mt-2 w-24 rounded border border-secondary-border bg-secondary-card px-2.5 py-1 text-xs text-secondary-pure font-mono outline-none focus:ring-1 focus:ring-accent"
              />
            </div>

            {/* Toggle Dados 3D Jogadores */}
            <label className="flex items-center justify-between p-3 rounded-lg border border-secondary-border bg-dominant-deep cursor-pointer group">
              <div>
                <span className="text-xs font-bold text-secondary-pure group-hover:text-accent-hover transition block">
                  Dados 3d nas rolagens dos jogadores
                </span>
                <span className="text-[11px] text-secondary-muted block mt-0.5">
                  Quando ligado, as rolagens dos jogadores aparecem em 3d para o mestre.
                </span>
              </div>
              <input
                type="checkbox"
                data-testid="toggle-dice3d-players"
                checked={dice3dPlayersEnabled}
                onChange={(e) => setDice3dPlayersEnabled(e.target.checked)}
                className="h-4 w-4 rounded border-secondary-border bg-secondary-card text-accent focus:ring-2 focus:ring-accent cursor-pointer ml-3 shrink-0"
              />
            </label>

            {/* Toggle Dados 3D Mestre */}
            <label className="flex items-center justify-between p-3 rounded-lg border border-secondary-border bg-dominant-deep cursor-pointer group">
              <div>
                <span className="text-xs font-bold text-secondary-pure group-hover:text-accent-hover transition block">
                  Dados 3d nas rolagens do mestre
                </span>
                <span className="text-[11px] text-secondary-muted block mt-0.5">
                  Quando ligado, a rolagem do mestre aparece em 3d para o jogador.
                </span>
              </div>
              <input
                type="checkbox"
                data-testid="toggle-dice3d-master"
                checked={dice3dMasterEnabled}
                onChange={(e) => setDice3dMasterEnabled(e.target.checked)}
                className="h-4 w-4 rounded border-secondary-border bg-secondary-card text-accent focus:ring-2 focus:ring-accent cursor-pointer ml-3 shrink-0"
              />
            </label>
          </div>

          {/* Zona de Perigo / Excluir Campanha */}
          <div className="rounded-lg border border-red-900/60 bg-red-950/20 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-red-400 flex items-center gap-1.5">
                  <span>⚠️</span> Zona de Perigo — Excluir Campanha
                </h3>
                <p className="text-xs text-red-300/80 mt-1">
                  A exclusão é permanente. Todos os mundos, personagens vinculados e registros de rolagens serão apagados.
                </p>
              </div>
            </div>

            {showDeleteConfirm ? (
              <div className="rounded border border-red-700 bg-red-900/30 p-3 space-y-2">
                <p className="text-xs font-bold text-red-200">
                  Tem certeza absoluta que deseja excluir a campanha "{campaign.name}"?
                </p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={onDelete}
                    disabled={isDeleting}
                    className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-red-700 transition disabled:opacity-50 shadow"
                  >
                    {isDeleting ? "Excluindo Campanha..." : "Sim, Excluir Definitivamente"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowDeleteConfirm(false)}
                    disabled={isDeleting}
                    className="rounded-lg border border-secondary-border bg-dominant-deep px-3 py-1.5 text-xs font-semibold text-secondary-pure hover:bg-dominant-container transition"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(true)}
                className="rounded-lg border border-red-700/80 bg-red-900/60 px-3 py-1.5 text-xs font-bold text-red-100 hover:bg-red-800 transition shadow"
              >
                Excluir Campanha
              </button>
            )}
          </div>

          {/* Rodapé com botões de Salvar / Cancelar */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-secondary-border">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving || isDeleting}
              className="rounded-lg border border-secondary-border bg-dominant-container px-4 py-2 text-xs font-semibold text-secondary-offwhite hover:bg-dominant-container/80 transition"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSaving || isDeleting}
              className="rounded-lg bg-accent px-4 py-2 text-xs font-bold text-white hover:bg-accent-vibrant transition shadow disabled:opacity-50"
            >
              {isSaving ? "Salvando..." : "Salvar Alterações"}
            </button>
          </div>
        </form>
        )}
      </div>
    </div>
  );
}
