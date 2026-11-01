"use client";

import React, { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import { Toast } from "@/components/ui/Toast";
import { CONTENT_TYPE_CONFIG } from "./CommunityCard";

type Props = {
  contentType: string;
  payload: Record<string, unknown>;
  postId?: string;
  commentId?: string;
  onClose: () => void;
  onSuccess?: () => void;
};

const EDITABLE_FIELDS: Record<string, Array<{ key: string; label: string; type: "text" | "textarea" | "number" }>> = {
  spell: [
    { key: "name", label: "Nome", type: "text" },
    { key: "description", label: "Descrição", type: "textarea" },
    { key: "level", label: "Nível", type: "number" },
    { key: "school", label: "Escola", type: "text" },
    { key: "castingTime", label: "Tempo de Conjuração", type: "text" },
    { key: "range", label: "Alcance", type: "text" },
    { key: "components", label: "Componentes", type: "text" },
    { key: "duration", label: "Duração", type: "text" },
    { key: "damage", label: "Dano", type: "text" },
    { key: "imageUrl", label: "URL da Imagem", type: "text" },
  ],
  item: [
    { key: "name", label: "Nome", type: "text" },
    { key: "description", label: "Descrição", type: "textarea" },
    { key: "type", label: "Tipo", type: "text" },
    { key: "rarity", label: "Raridade", type: "text" },
    { key: "weight", label: "Peso", type: "number" },
    { key: "cost", label: "Custo", type: "number" },
    { key: "properties", label: "Propriedades", type: "text" },
    { key: "imageUrl", label: "URL da Imagem", type: "text" },
    { key: "iconUrl", label: "URL do Ícone", type: "text" },
  ],
  class: [
    { key: "name", label: "Nome", type: "text" },
    { key: "description", label: "Descrição", type: "textarea" },
    { key: "imageUrl", label: "URL da Imagem", type: "text" },
  ],
  npc: [
    { key: "name", label: "Nome", type: "text" },
    { key: "description", label: "Descrição", type: "textarea" },
    { key: "race", label: "Raça", type: "text" },
    { key: "role", label: "Papel", type: "text" },
    { key: "personality", label: "Personalidade", type: "textarea" },
    { key: "secrets", label: "Segredos", type: "textarea" },
    { key: "imageUrl", label: "URL da Imagem", type: "text" },
    { key: "tokenUrl", label: "URL do Token", type: "text" },
  ],
  world: [
    { key: "name", label: "Nome", type: "text" },
    { key: "description", label: "Descrição", type: "textarea" },
    { key: "theme", label: "Tema", type: "text" },
    { key: "lore", label: "História", type: "textarea" },
    { key: "imageUrl", label: "URL da Imagem", type: "text" },
    { key: "mapUrl", label: "URL do Mapa", type: "text" },
  ],
};

export default function ImportCustomizeModal({ contentType, payload, postId, commentId, onClose, onSuccess }: Props) {
  const [formData, setFormData] = useState<Record<string, unknown>>(payload);
  const [isImporting, setIsImporting] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const typeConfig = CONTENT_TYPE_CONFIG[contentType] || { label: contentType, icon: "📜", badgeClass: "bg-gray-800 text-gray-300" };
  const fields = EDITABLE_FIELDS[contentType] || [];

  const handleChange = (key: string, value: unknown) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  const handleImportOriginal = async () => {
    await doImport(payload);
  };

  const handleImportModified = async () => {
    await doImport(formData);
  };

  const doImport = async (dataToImport: Record<string, unknown>) => {
    if (isImporting) return;
    setIsImporting(true);

    try {
      const endpoint = commentId
        ? `/api/community/comments/${commentId}/clone`
        : `/api/community/posts/${postId}/clone`;

      const isModified = JSON.stringify(payload) !== JSON.stringify(dataToImport);

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: isModified ? JSON.stringify({ modifiedPayload: dataToImport }) : JSON.stringify({}),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Falha ao importar conteúdo");
      }

      setToast({ message: data.message || "Conteúdo importado com sucesso!", type: "success" });
      setTimeout(() => {
        onSuccess?.();
        onClose();
      }, 1200);
    } catch (err) {
      setToast({
        message: err instanceof Error ? err.message : "Erro ao importar conteúdo",
        type: "error",
      });
    } finally {
      setIsImporting(false);
    }
  };

  if (contentType === "campaign") {
    return (
      <>
        {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
        <Modal open onClose={onClose} labelledBy="import-campaign-warn">
          <div className="w-full max-w-md rounded-2xl border border-gray-800 bg-gray-950 p-6 text-center">
            <h2 id="import-campaign-warn" className="text-xl font-bold text-amber-400">
              ⚠️ Importação não suportada
            </h2>
            <p className="mt-3 text-sm text-gray-300">
              A importação de campanhas ainda não é suportada pelo sistema.
            </p>
            <Button onClick={onClose} variant="secondary" className="mt-4">
              Fechar
            </Button>
          </div>
        </Modal>
      </>
    );
  }

  const imageUrl = (payload.imageUrl || payload.iconUrl || payload.mapUrl || payload.tokenUrl) as string | undefined;

  return (
    <>
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      <Modal open onClose={onClose} labelledBy="import-customize-title">
        <div className="w-full max-w-2xl rounded-2xl border border-gray-800 bg-gray-950 shadow-2xl">
          <Modal.Header className="flex items-center justify-between border-b border-gray-800 px-5 py-4">
            <div className="flex items-center gap-2">
              <span className="text-lg">{typeConfig.icon}</span>
              <h2 id="import-customize-title" className="text-lg font-bold text-gray-100">
                Personalizar antes de importar
              </h2>
            </div>
            <Modal.CloseButton className="rounded-full p-1.5 text-gray-400 hover:bg-gray-900 hover:text-white transition-colors" />
          </Modal.Header>

          <Modal.Body className="max-h-[70vh] space-y-4 overflow-y-auto px-5 py-4">
            {imageUrl && (
              <div className="rounded-xl border border-gray-800 overflow-hidden bg-gray-900/50">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={imageUrl} alt="Preview" className="max-h-56 w-full object-contain bg-black/40" />
              </div>
            )}

            <div className="space-y-3">
              {fields.map((field) => (
                <div key={field.key}>
                  <label htmlFor={`field-${field.key}`} className="block text-xs font-semibold text-gray-300 mb-1">
                    {field.label}
                  </label>
                  {field.type === "textarea" ? (
                    <textarea
                      id={`field-${field.key}`}
                      value={String(formData[field.key] ?? "")}
                      onChange={(e) => handleChange(field.key, e.target.value)}
                      rows={3}
                      className="w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-200 placeholder-gray-500 focus:border-purple-500 focus:outline-none"
                    />
                  ) : (
                    <input
                      id={`field-${field.key}`}
                      type={field.type}
                      value={String(formData[field.key] ?? "")}
                      onChange={(e) =>
                        handleChange(field.key, field.type === "number" ? Number(e.target.value) : e.target.value)
                      }
                      className="w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-200 placeholder-gray-500 focus:border-purple-500 focus:outline-none"
                    />
                  )}
                </div>
              ))}
            </div>
          </Modal.Body>

          <div className="flex items-center justify-end gap-3 border-t border-gray-800 px-5 py-4">
            <Button onClick={handleImportOriginal} variant="secondary" disabled={isImporting}>
              {isImporting ? <Spinner size="sm" /> : "Importar Original"}
            </Button>
            <Button onClick={handleImportModified} variant="primary" disabled={isImporting}>
              {isImporting ? <Spinner size="sm" /> : "Salvar e Importar"}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
