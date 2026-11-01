"use client";

import { useEffect, useState } from "react";
import { Pencil, X, Image as ImageIcon, User, AlignLeft } from "lucide-react";

export type ProfileData = {
  id?: string;
  displayName?: string | null;
  masterName?: string | null;
  masterAvatar?: string | null;
  masterBio?: string | null;
  masterBannerUrl?: string | null;
};

type Props = {
  profile?: ProfileData | null;
  onClose: () => void;
  onSaved: (profile: ProfileData) => void;
};

export default function EditMasterProfileModal({ profile, onClose, onSaved }: Props) {
  const [form, setForm] = useState<ProfileData>({
    masterName: "",
    masterAvatar: "",
    masterBio: "",
    masterBannerUrl: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (profile) {
      setForm({
        masterName: profile.masterName ?? "",
        masterAvatar: profile.masterAvatar ?? "",
        masterBio: profile.masterBio ?? "",
        masterBannerUrl: profile.masterBannerUrl ?? "",
      });
    }
  }, [profile]);

  const update = (field: keyof ProfileData, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const payload = {
        masterName: form.masterName?.trim() || null,
        masterAvatar: form.masterAvatar?.trim() || null,
        masterBio: form.masterBio?.trim() || null,
        masterBannerUrl: form.masterBannerUrl?.trim() || null,
      };

      const response = await fetch("/api/community/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error ?? "Não foi possível salvar o perfil");
      }

      onSaved(data.profile);
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível salvar o perfil");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
    >
      <form
        onSubmit={save}
        className="w-full max-w-lg rounded-2xl border border-gray-800 bg-gray-950 p-6 text-white shadow-2xl space-y-4"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-800 pb-3">
          <h2 className="flex items-center gap-2 text-lg font-bold text-gray-100">
            <Pencil className="h-5 w-5 text-purple-400" />
            Editar Perfil de Mestre
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-800 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Campos */}
        <div className="space-y-4 pt-1">
          <div>
            <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-300">
              <User className="h-3.5 w-3.5 text-purple-400" />
              Nome de Mestre / Handle
            </label>
            <input
              type="text"
              maxLength={100}
              placeholder="Ex: Gandalf, o Cinzento"
              value={form.masterName ?? ""}
              onChange={(e) => update("masterName", e.target.value)}
              className="mt-1.5 w-full rounded-lg border border-gray-800 bg-gray-900 px-3 py-2 text-sm text-gray-100 placeholder-gray-500 focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
            />
          </div>

          <div>
            <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-300">
              <ImageIcon className="h-3.5 w-3.5 text-indigo-400" />
              URL do Avatar
            </label>
            <input
              type="url"
              maxLength={500}
              placeholder="https://exemplo.com/avatar.jpg"
              value={form.masterAvatar ?? ""}
              onChange={(e) => update("masterAvatar", e.target.value)}
              className="mt-1.5 w-full rounded-lg border border-gray-800 bg-gray-900 px-3 py-2 text-sm text-gray-100 placeholder-gray-500 focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
            />
          </div>

          <div>
            <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-300">
              <ImageIcon className="h-3.5 w-3.5 text-cyan-400" />
              URL do Banner de Capa
            </label>
            <input
              type="url"
              maxLength={500}
              placeholder="https://exemplo.com/banner.jpg"
              value={form.masterBannerUrl ?? ""}
              onChange={(e) => update("masterBannerUrl", e.target.value)}
              className="mt-1.5 w-full rounded-lg border border-gray-800 bg-gray-900 px-3 py-2 text-sm text-gray-100 placeholder-gray-500 focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
            />
          </div>

          <div>
            <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-300">
              <AlignLeft className="h-3.5 w-3.5 text-emerald-400" />
              Biografia / Descrição (máx. 500 caracteres)
            </label>
            <textarea
              maxLength={500}
              rows={4}
              placeholder="Conte sobre suas campanhas, estilo de jogo e mundos..."
              value={form.masterBio ?? ""}
              onChange={(e) => update("masterBio", e.target.value)}
              className="mt-1.5 w-full rounded-lg border border-gray-800 bg-gray-900 px-3 py-2 text-sm text-gray-100 placeholder-gray-500 focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500 resize-none"
            />
            <div className="mt-1 text-right text-[11px] text-gray-500">
              {(form.masterBio ?? "").length} / 500
            </div>
          </div>
        </div>

        {error && (
          <div className="rounded-lg border border-red-800/50 bg-red-950/30 p-2.5 text-xs text-red-400">
            {error}
          </div>
        )}

        {/* Ações */}
        <div className="flex justify-end gap-3 pt-2 border-t border-gray-800">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-gray-700 bg-gray-900 px-4 py-2 text-xs font-medium text-gray-300 transition-colors hover:bg-gray-800"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-1.5 rounded-lg bg-purple-600 px-4 py-2 text-xs font-semibold text-white shadow-md transition-colors hover:bg-purple-500 disabled:opacity-50"
          >
            {saving ? "Salvando..." : "Salvar Alterações"}
          </button>
        </div>
      </form>
    </div>
  );
}
