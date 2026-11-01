"use client";

import React, { useState, useEffect } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import { Toast } from "@/components/ui/Toast";

type Props = {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
};

type ContentTypeOption = {
  type: "spell" | "item" | "class" | "npc" | "world";
  label: string;
  icon: string;
  endpoint: string;
};

const CONTENT_TYPES: ContentTypeOption[] = [
  { type: "spell", label: "Magia", icon: "🔮", endpoint: "/api/content/spells" },
  { type: "item", label: "Item", icon: "⚔️", endpoint: "/api/content/items" },
  { type: "class", label: "Classe", icon: "🛡️", endpoint: "/api/classes" },
  { type: "npc", label: "NPC", icon: "👤", endpoint: "/api/npcs" },
  { type: "world", label: "Mundo", icon: "🌍", endpoint: "/api/worlds" },
];

export default function CreatePostModal({ open, onClose, onCreated }: Props) {
  const [contentType, setContentType] = useState<"spell" | "item" | "class" | "npc" | "world">("spell");
  const [sourceMode, setSourceMode] = useState<"existing" | "manual">("existing");

  // Entidades carregadas da API
  const [entities, setEntities] = useState<any[]>([]);
  const [loadingEntities, setLoadingEntities] = useState(false);
  const [selectedEntityId, setSelectedEntityId] = useState("");

  // Formulário do post
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [tagsInput, setTagsInput] = useState("");
  const [payloadText, setPayloadText] = useState("{\n  \"name\": \"\"\n}");
  const [contentId, setContentId] = useState<string | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null);

  // Carrega entidades existentes quando muda contentType
  useEffect(() => {
    if (!open) return;
    const currentConfig = CONTENT_TYPES.find((c) => c.type === contentType);
    if (!currentConfig) return;

    let isMounted = true;
    setLoadingEntities(true);
    setSelectedEntityId("");

    fetch(currentConfig.endpoint)
      .then(async (res) => {
        if (!res.ok) throw new Error("Falha ao buscar dados");
        return res.json();
      })
      .then((data) => {
        if (!isMounted) return;
        const list = Array.isArray(data) ? data : data.data || [];
        setEntities(list);
      })
      .catch(() => {
        if (isMounted) setEntities([]);
      })
      .finally(() => {
        if (isMounted) setLoadingEntities(false);
      });

    return () => {
      isMounted = false;
    };
  }, [contentType, open]);

  // Quando o usuário seleciona uma entidade existente da lista
  const handleSelectEntity = (id: string) => {
    setSelectedEntityId(id);
    if (!id) {
      setContentId(null);
      return;
    }

    const entity = entities.find((e) => e.id === id);
    if (!entity) return;

    setContentId(entity.id);
    setTitle(entity.name || "");
    setDescription(entity.description || "");

    // Monta tags padrão
    const defaultTags: string[] = [contentType];
    if (entity.category) defaultTags.push(entity.category);
    if (entity.rarity) defaultTags.push(entity.rarity);
    if (entity.school) defaultTags.push(entity.school);
    setTagsInput(defaultTags.join(", "));

    // Prepara payload congelado
    const cloneObj = { ...entity };
    setPayloadText(JSON.stringify(cloneObj, null, 2));
  };

  // Se trocar para modo manual, configura payload inicial limpo
  const handleModeChange = (mode: "existing" | "manual") => {
    setSourceMode(mode);
    if (mode === "manual") {
      setSelectedEntityId("");
      setContentId(null);
      const defaultPayload =
        contentType === "spell"
          ? { name: title || "Nova Magia", circle: 1, manaCost: 5, school: "Evocação", description: description || "" }
          : contentType === "item"
          ? { name: title || "Novo Item", category: "Arma", rarity: "Comum", description: description || "" }
          : contentType === "class"
          ? { name: title || "Nova Classe", hitDie: "d8", hpPerLevel: 5, description: description || "" }
          : contentType === "npc"
          ? { name: title || "Novo NPC", level: 1, hp: 20, description: description || "" }
          : { name: title || "Novo Mundo", description: description || "" };
      setPayloadText(JSON.stringify(defaultPayload, null, 2));
      if (!tagsInput) {
        setTagsInput(contentType);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setToast({ message: "O título é obrigatório", type: "error" });
      return;
    }

    let parsedPayload: unknown;
    try {
      parsedPayload = JSON.parse(payloadText);
    } catch {
      setToast({ message: "O payload JSON é inválido. Corrija o formato antes de prosseguir.", type: "error" });
      return;
    }

    const tags = tagsInput
      .split(",")
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean);

    setSubmitting(true);

    try {
      const res = await fetch("/api/community/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || null,
          contentType,
          contentId: contentId || null,
          tags,
          payload: parsedPayload,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Erro ao publicar criação");
      }

      setToast({ message: "Publicação criada com sucesso na Comunidade!", type: "success" });
      setTimeout(() => {
        onCreated();
      }, 1000);
    } catch (err) {
      setToast({
        message: err instanceof Error ? err.message : "Erro ao publicar criação",
        type: "error",
      });
      setSubmitting(false);
    }
  };

  return (
    <>
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}

      <Modal open={open} onClose={onClose} labelledBy="create-post-title">
        <div className="w-full max-w-3xl rounded-xl border border-gray-800 bg-gray-900 shadow-2xl flex flex-col max-h-[90vh]">
          <Modal.Header className="flex items-center justify-between border-b border-gray-800 p-5 shrink-0">
            <div>
              <h2 id="create-post-title" className="text-xl font-bold text-gray-100 flex items-center gap-2">
                <span>🌐</span> Publicar na Comunidade do Mestre
              </h2>
              <p className="mt-1 text-xs text-gray-400">
                Compartilhe suas criações com outros mestres do Libmork
              </p>
            </div>
            <Modal.CloseButton className="rounded p-1.5 text-gray-400 hover:bg-gray-800 hover:text-white" />
          </Modal.Header>

          <Modal.Body className="p-5 overflow-y-auto space-y-5">
            <form id="create-post-form" onSubmit={handleSubmit} className="space-y-5">
              {/* Seleção do Tipo de Conteúdo */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">
                  Tipo de Conteúdo
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                  {CONTENT_TYPES.map((typeOption) => (
                    <button
                      key={typeOption.type}
                      type="button"
                      onClick={() => {
                        setContentType(typeOption.type);
                        setSourceMode("existing");
                      }}
                      className={`flex flex-col items-center justify-center p-3 rounded-lg border text-sm font-medium transition-all ${
                        contentType === typeOption.type
                          ? "border-purple-500 bg-purple-950/40 text-purple-200 shadow-sm"
                          : "border-gray-800 bg-gray-950/60 text-gray-400 hover:border-gray-700 hover:text-gray-200"
                      }`}
                    >
                      <span className="text-xl mb-1">{typeOption.icon}</span>
                      <span>{typeOption.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Origem: Existente vs Manual */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-gray-400">
                    Origem do Conteúdo
                  </label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => handleModeChange("existing")}
                      className={`px-3 py-1 rounded text-xs font-medium transition-all ${
                        sourceMode === "existing"
                          ? "bg-purple-700 text-white"
                          : "bg-gray-800 text-gray-400 hover:text-gray-200"
                      }`}
                    >
                      Carregar Existente
                    </button>
                    <button
                      type="button"
                      onClick={() => handleModeChange("manual")}
                      className={`px-3 py-1 rounded text-xs font-medium transition-all ${
                        sourceMode === "manual"
                          ? "bg-purple-700 text-white"
                          : "bg-gray-800 text-gray-400 hover:text-gray-200"
                      }`}
                    >
                      Preencher Manualmente
                    </button>
                  </div>
                </div>

                {sourceMode === "existing" && (
                  <div className="rounded-lg border border-gray-800 bg-gray-950/60 p-3">
                    {loadingEntities ? (
                      <div className="flex items-center justify-center py-4 gap-2 text-xs text-gray-400">
                        <Spinner size="sm" />
                        Carregando {contentType}s da sua biblioteca...
                      </div>
                    ) : entities.length === 0 ? (
                      <div className="text-xs text-gray-400 text-center py-3">
                        Nenhuma criação do tipo encontrada na sua biblioteca.
                        <button
                          type="button"
                          onClick={() => handleModeChange("manual")}
                          className="ml-2 text-purple-400 hover:underline"
                        >
                          Preencher manualmente?
                        </button>
                      </div>
                    ) : (
                      <div>
                        <select
                          value={selectedEntityId}
                          onChange={(e) => handleSelectEntity(e.target.value)}
                          className="w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-200 focus:border-purple-500 focus:outline-none"
                        >
                          <option value="">-- Selecione uma entidade existente --</option>
                          {entities.map((item) => (
                            <option key={item.id} value={item.id}>
                              {item.name || item.title || "Sem nome"} {item.circle ? `(Círculo ${item.circle})` : ""}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Título e Descrição */}
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1">
                    Título da Publicação *
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={150}
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Ex.: Bola de Fogo Aprimorada, Espada Vorpal Ancestral..."
                    className="w-full rounded-lg border border-gray-700 bg-gray-950 px-3.5 py-2 text-sm text-gray-200 placeholder-gray-500 focus:border-purple-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1">
                    Descrição / Lore
                  </label>
                  <textarea
                    rows={3}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Conte mais sobre o contexto, origem ou como utilizar esta criação em mesa..."
                    className="w-full rounded-lg border border-gray-700 bg-gray-950 px-3.5 py-2 text-sm text-gray-200 placeholder-gray-500 focus:border-purple-500 focus:outline-none resize-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1">
                    Tags (separadas por vírgula)
                  </label>
                  <input
                    type="text"
                    value={tagsInput}
                    onChange={(e) => setTagsInput(e.target.value)}
                    placeholder="magia, fogo, combate, level-3, homebrew"
                    className="w-full rounded-lg border border-gray-700 bg-gray-950 px-3.5 py-2 text-sm text-gray-200 placeholder-gray-500 focus:border-purple-500 focus:outline-none"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-semibold uppercase tracking-wider text-gray-400">
                      Preview / Dados da Entidade (Payload JSON)
                    </label>
                    <span className="text-[11px] text-gray-500">Editável se necessário</span>
                  </div>
                  <textarea
                    rows={6}
                    value={payloadText}
                    onChange={(e) => setPayloadText(e.target.value)}
                    className="w-full rounded-lg border border-gray-800 bg-gray-950 p-3 font-mono text-xs text-purple-200 focus:border-purple-500 focus:outline-none resize-none"
                  />
                </div>
              </div>
            </form>
          </Modal.Body>

          <Modal.Footer className="flex items-center justify-end gap-3 border-t border-gray-800 p-5 shrink-0">
            <Button type="button" onClick={onClose} variant="secondary">
              Cancelar
            </Button>
            <Button
              type="submit"
              form="create-post-form"
              disabled={submitting}
              variant="master"
            >
              {submitting ? (
                <span className="flex items-center gap-2">
                  <Spinner size="sm" />
                  Publicando...
                </span>
              ) : (
                "Publicar na Comunidade"
              )}
            </Button>
          </Modal.Footer>
        </div>
      </Modal>
    </>
  );
}
