"use client";

import React, { useState, useEffect } from "react";
import { Button, Form, Input } from "@/components/ui";
import {
  LIBRARY_PROVIDERS,
  LIBRARY_CATEGORIES,
  LibraryProvider,
  LibraryCategory,
  CreateLibraryDocumentInput,
} from "@/lib/validators/library-document";
import type { LibraryDocument } from "@/types";

interface CreateDocumentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (newDoc: LibraryDocument) => void;
  campaignId?: string | null;
  editingDocument?: LibraryDocument | null;
}

export function CreateDocumentModal({
  isOpen,
  onClose,
  onSuccess,
  campaignId = null,
  editingDocument = null,
}: CreateDocumentModalProps) {
  const isEditing = Boolean(editingDocument);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [coverUrl, setCoverUrl] = useState("");
  const [externalUrl, setExternalUrl] = useState("");
  const [provider, setProvider] = useState<LibraryProvider>("external");
  const [category, setCategory] = useState<LibraryCategory>("livro-base");
  const [tagsStr, setTagsStr] = useState("");
  const [isPublic, setIsPublic] = useState(true);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (editingDocument) {
      setTitle(editingDocument.title || "");
      setDescription(editingDocument.description || "");
      setCoverUrl(editingDocument.coverUrl || "");
      setExternalUrl(editingDocument.externalUrl || "");
      setProvider(
        LIBRARY_PROVIDERS.includes(editingDocument.provider as LibraryProvider)
          ? (editingDocument.provider as LibraryProvider)
          : "external"
      );
      setCategory(
        LIBRARY_CATEGORIES.includes(editingDocument.category as LibraryCategory)
          ? (editingDocument.category as LibraryCategory)
          : "livro-base"
      );
      setTagsStr((editingDocument.tags || []).join(", "));
      setIsPublic(editingDocument.isPublic ?? true);
    } else {
      setTitle("");
      setDescription("");
      setCoverUrl("");
      setExternalUrl("");
      setProvider("external");
      setCategory("livro-base");
      setTagsStr("");
      setIsPublic(true);
    }
    setError(null);
  }, [editingDocument, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    const tags = tagsStr
      .split(",")
      .map((t) => t.trim())
      .filter((t) => t.length > 0);

    const payload: Partial<CreateLibraryDocumentInput> = {
      title: title.trim(),
      description: description.trim() ? description.trim() : null,
      coverUrl: coverUrl.trim() ? coverUrl.trim() : null,
      externalUrl: externalUrl.trim(),
      provider,
      category,
      tags: tags.length > 0 ? tags : null,
      isPublic,
      campaignId: campaignId ?? null,
    };

    try {
      const endpoint = isEditing && editingDocument
        ? `/api/library/documents/${editingDocument.id}`
        : "/api/library/documents";
      const method = isEditing ? "PATCH" : "POST";

      const res = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        credentials: "include",
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Erro ao salvar referência de documento");
      }

      onSuccess(data.data);
      onClose();
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Erro desconhecido ao salvar documento");
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-document-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-2xl border border-purple-900/60 bg-gray-950 p-6 text-gray-100 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-gray-800 pb-3">
          <div className="flex items-center gap-2">
            <span className="text-xl">📚</span>
            <h2 id="create-document-title" className="text-lg font-bold text-white">
              {isEditing ? "Editar Referência" : "Nova Referência de Livro / Regras"}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-white"
            aria-label="Fechar"
          >
            ✕
          </button>
        </div>

        {error && (
          <div className="rounded-xl border border-red-800/80 bg-red-950/60 p-3 text-xs text-red-200">
            {error}
          </div>
        )}

        <Form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-semibold text-gray-300">
              Título do Documento *
            </label>
            <Input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex: Tormenta20 - Livro Básico, D&D 5e - Manual do Jogador"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-semibold text-gray-300">
                Categoria *
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as LibraryCategory)}
                className="w-full rounded-xl border border-gray-800 bg-gray-900 px-3 py-2 text-xs text-white focus:border-purple-500 focus:outline-none"
              >
                <option value="livro-base">Livro Base</option>
                <option value="suplemento">Suplemento</option>
                <option value="errata">Errata / FAQ</option>
                <option value="aventura">Aventura</option>
                <option value="outro">Outro</option>
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-gray-300">
                Provedor / Hospedagem *
              </label>
              <select
                value={provider}
                onChange={(e) => setProvider(e.target.value as LibraryProvider)}
                className="w-full rounded-xl border border-gray-800 bg-gray-900 px-3 py-2 text-xs text-white focus:border-purple-500 focus:outline-none"
              >
                <option value="external">Externo (Link direto)</option>
                <option value="gdrive">Google Drive</option>
                <option value="smb">Compartilhamento de Rede / SMB</option>
                <option value="kavita">Servidor Kavita (OPDS)</option>
                <option value="notion">Notion</option>
                <option value="gitbook">GitBook</option>
              </select>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-gray-300">
              URL Externa ou Subcaminho SMB *
            </label>
            <Input
              type="text"
              required
              value={externalUrl}
              onChange={(e) => setExternalUrl(e.target.value)}
              placeholder={
                provider === "smb"
                  ? "Ex: livros/core-rules.pdf ou smb://servidor/pasta/livro.pdf"
                  : provider === "gdrive"
                  ? "Ex: https://drive.google.com/file/d/.../view"
                  : "Ex: https://meusite.com/documento.pdf"
              }
            />
            <p className="mt-1 text-[11px] text-gray-500">
              {provider === "smb"
                ? "Para SMB, informe o caminho relativo configurado em LIBRARY_SMB_PATH no servidor."
                : "Insira a URL direta do arquivo ou pasta compartilhada."}
            </p>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-gray-300">
              URL da Imagem de Capa (Opcional)
            </label>
            <Input
              type="text"
              value={coverUrl}
              onChange={(e) => setCoverUrl(e.target.value)}
              placeholder="Ex: https://meusite.com/capa.jpg"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-gray-300">
              Descrição (Opcional)
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full rounded-xl border border-gray-800 bg-gray-900 px-3 py-2 text-xs text-white placeholder-gray-500 focus:border-purple-500 focus:outline-none"
              placeholder="Breve resumo sobre o conteúdo deste manual..."
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-gray-300">
              Tags (Separadas por vírgula)
            </label>
            <Input
              type="text"
              value={tagsStr}
              onChange={(e) => setTagsStr(e.target.value)}
              placeholder="Ex: d20, pf2e, magia, oficial"
            />
          </div>

          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="isPublicCheck"
              checked={isPublic}
              onChange={(e) => setIsPublic(e.target.checked)}
              className="h-4 w-4 rounded border-gray-800 bg-gray-900 text-purple-600 focus:ring-purple-500"
            />
            <label htmlFor="isPublicCheck" className="text-xs text-gray-300">
              Documento visível publicamente
            </label>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-gray-800">
            <Button
              type="button"
              variant="secondary"
              onClick={onClose}
              disabled={isLoading}
            >
              Cancelar
            </Button>
            <Button type="submit" variant="primary" isLoading={isLoading}>
              {isEditing ? "Salvar Alterações" : "Adicionar Referência"}
            </Button>
          </div>
        </Form>
      </div>
    </div>
  );
}
