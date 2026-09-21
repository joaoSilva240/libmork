"use client";

import React, { useState, useEffect, useCallback } from "react";
import type { LibraryDocument } from "@/types";
import { Button, Spinner } from "@/components/ui";
import { PdfViewerModal } from "./PdfViewerModal";
import { CreateDocumentModal } from "./CreateDocumentModal";
import { TomeViewer } from "./TomeViewer";

interface LibraryDocumentsProps {
  campaignId?: string | null;
  onRegisterActions?: (actions: { openCreate: () => void; openTome?: () => void }) => void;
  isTomeActive?: boolean;
  onToggleTome?: (active?: boolean) => void;
}

export function LibraryDocuments({
  campaignId = null,
  onRegisterActions,
  isTomeActive: externalIsTomeActive,
  onToggleTome: externalOnToggleTome,
}: LibraryDocumentsProps) {
  const [documents, setDocuments] = useState<LibraryDocument[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filtros
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedProvider, setSelectedProvider] = useState<string>("all");

  // Usuário autenticado
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);

  // Estado inline do Tome
  const [internalIsTomeActive, setInternalIsTomeActive] = useState(false);
  const isTomeOpen = externalIsTomeActive !== undefined ? externalIsTomeActive : internalIsTomeActive;
  const toggleTome = useCallback((nextState?: boolean) => {
    if (externalOnToggleTome) {
      externalOnToggleTome(nextState);
    } else {
      setInternalIsTomeActive((prev) => (nextState !== undefined ? nextState : !prev));
    }
  }, [externalOnToggleTome]);

  // Modais
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingDoc, setEditingDoc] = useState<LibraryDocument | null>(null);
  const [viewingDoc, setViewingDoc] = useState<LibraryDocument | null>(null);

  // Carregar dados de autenticação da sessão atual
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch("/api/auth/me", { credentials: "include" });
        if (res.ok) {
          const data = await res.json();
          if (active && data.success && data.data) {
            setCurrentUserId(data.data.id);
            setIsAuthenticated(true);
          }
        }
      } catch {
        // Usuário não autenticado ou convidado
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const loadDocuments = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (campaignId) params.set("campaignId", campaignId);
      if (searchQuery.trim()) params.set("q", searchQuery.trim());
      if (selectedCategory !== "all") params.set("category", selectedCategory);
      if (selectedProvider !== "all") params.set("provider", selectedProvider);

      const url = `/api/library/documents${params.toString() ? `?${params.toString()}` : ""}`;
      const res = await fetch(url, { credentials: "include" });
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Erro ao carregar documentos");
      }

      setDocuments(data.data || []);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Erro ao carregar biblioteca de regras");
      }
    } finally {
      setIsLoading(false);
    }
  }, [campaignId, searchQuery, selectedCategory, selectedProvider]);

  useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);

  // Registra a ação de criar documento para o botão da toolbar externa se provido
  useEffect(() => {
    if (onRegisterActions) {
      onRegisterActions({
        openCreate: () => {
          setEditingDoc(null);
          setShowCreateModal(true);
        },
        openTome: () => {
          toggleTome(true);
        },
      });
    }
  }, [onRegisterActions, toggleTome]);

  const handleDelete = async (doc: LibraryDocument) => {
    if (doc.isOfficial) {
      alert("Documentos oficiais do sistema não podem ser excluídos.");
      return;
    }

    if (!confirm(`Deseja realmente remover a referência "${doc.title}"?`)) {
      return;
    }

    try {
      const res = await fetch(`/api/library/documents/${doc.id}`, {
        method: "DELETE",
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Erro ao excluir documento");
      }
      setDocuments((prev) => prev.filter((d) => d.id !== doc.id));
    } catch (err: unknown) {
      if (err instanceof Error) {
        alert(err.message);
      } else {
        alert("Erro ao excluir documento");
      }
    }
  };

  const handleEdit = (doc: LibraryDocument) => {
    if (doc.isOfficial) {
      alert("Documentos oficiais do sistema não podem ser editados.");
      return;
    }
    setEditingDoc(doc);
    setShowCreateModal(true);
  };

  return (
    <div className="flex flex-col h-full space-y-4">
      {isTomeOpen ? (
        /* Painel Inline do Tome substituindo barra de busca, filtros e cards */
        <div className="relative flex flex-col flex-1 w-full min-h-[600px] h-[calc(100vh-16rem)] rounded-2xl border border-purple-900/60 bg-gray-950 overflow-hidden shadow-xl">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800 bg-gray-900/90 shrink-0">
            <div className="flex items-center gap-3 overflow-hidden">
              <span className="text-xl" aria-hidden="true">📖</span>
              <h2 className="text-sm sm:text-base font-bold text-white truncate">Tome</h2>
            </div>
            <Button
              type="button"
              variant="secondary"
              onClick={() => toggleTome(false)}
              className="!px-3 !py-1 text-xs"
              aria-label="Voltar / Fechar Tome"
            >
              Voltar / Fechar Tome
            </Button>
          </div>
          <div className="relative flex-1 w-full min-h-0 bg-gray-950 overflow-hidden">
            <TomeViewer viewport="desktop" />
          </div>
        </div>
      ) : (
        <>
          {/* Barra de Filtros e Busca */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-gray-900/60 p-3 rounded-2xl border border-gray-800">
            <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[280px]">
              {/* Busca textual */}
              <div className="relative flex-1 min-w-[200px]">
                <input
                  type="text"
                  placeholder="Buscar regras, livros, manuais..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full rounded-xl border border-gray-800 bg-gray-900 px-3.5 py-2 pl-9 text-xs text-white placeholder-gray-500 focus:border-purple-500 focus:outline-none transition"
                />
                <span className="absolute left-3 top-2.5 text-xs text-gray-500">🔍</span>
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    className="absolute right-3 top-2 text-xs text-gray-500 hover:text-white"
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* Filtro de Categoria */}
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="rounded-xl border border-gray-800 bg-gray-900 px-3 py-2 text-xs text-white focus:border-purple-500 focus:outline-none"
              >
                <option value="all">Todas Categorias</option>
                <option value="livro-base">Livro Base</option>
                <option value="suplemento">Suplemento</option>
                <option value="errata">Errata / FAQ</option>
                <option value="aventura">Aventura</option>
                <option value="outro">Outro</option>
              </select>

              {/* Filtro de Provedor */}
              <select
                value={selectedProvider}
                onChange={(e) => setSelectedProvider(e.target.value)}
                className="rounded-xl border border-gray-800 bg-gray-900 px-3 py-2 text-xs text-white focus:border-purple-500 focus:outline-none"
              >
                <option value="all">Todos Provedores</option>
                <option value="kavita">Kavita (OPDS)</option>
                <option value="external">Externo</option>
                <option value="gdrive">Google Drive</option>
                <option value="smb">Compartilhamento SMB</option>
                <option value="notion">Notion</option>
                <option value="gitbook">GitBook</option>
              </select>
            </div>

            {/* Botão Tome */}
            <div className="flex items-center gap-2 shrink-0">
              <Button
                type="button"
                variant="secondary"
                onClick={() => toggleTome(true)}
                className="!py-2 !px-3.5 text-xs flex items-center gap-1.5 border-purple-600 bg-purple-950/80 text-purple-200 hover:bg-purple-900"
                title="Abrir Tome"
              >
                <span>Tome</span>
              </Button>
            </div>
          </div>

          {/* Mensagem de Erro */}
          {error && (
            <div className="rounded-xl border border-red-800 bg-red-950/60 p-3 text-xs text-red-200">
              {error}
            </div>
          )}

          {/* Grid de Cards de Documentos */}
          {isLoading ? (
            <div className="flex flex-col items-center justify-center p-12 space-y-3">
              <Spinner size="lg" />
              <span className="text-xs text-gray-400">Carregando acervo de regras e livros...</span>
            </div>
          ) : documents.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-12 text-center rounded-2xl border border-dashed border-gray-800 bg-gray-950/40">
              <span className="text-4xl mb-2">📜</span>
              <h4 className="text-sm font-semibold text-gray-300">Nenhum documento encontrado</h4>
              <p className="text-xs text-gray-500 mt-1 max-w-sm">
                {searchQuery || selectedCategory !== "all" || selectedProvider !== "all"
                  ? "Tente ajustar os filtros ou os termos de busca."
                  : "Nenhum livro ou documento disponível no momento."}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,160px),240px))] auto-rows-max justify-center content-start gap-4 overflow-y-auto max-h-[calc(100vh-18rem)] pr-1">
              {documents.map((doc, idx) => {
                // Provedor formatado com badge
                const providerColors: Record<string, string> = {
                  kavita: "bg-amber-950/80 text-amber-300 border-amber-800",
                  smb: "bg-emerald-950/80 text-emerald-300 border-emerald-800",
                  gdrive: "bg-blue-950/80 text-blue-300 border-blue-800",
                  notion: "bg-zinc-800 text-zinc-200 border-zinc-700",
                  gitbook: "bg-cyan-950/80 text-cyan-300 border-cyan-800",
                  external: "bg-purple-950/80 text-purple-300 border-purple-800",
                };
                const badgeClass =
                  providerColors[doc.provider] ||
                  "bg-gray-800 text-gray-300 border-gray-700";

                return (
                  <div
                    key={doc.id ? `${doc.id}-${idx}` : `doc-${idx}`}
                    tabIndex={0}
                    className="group relative flex flex-col justify-end aspect-[2/3] w-full max-w-[240px] h-auto mx-auto rounded-2xl overflow-hidden border border-gray-800 bg-gray-950 shadow-md hover:border-purple-500/80 hover:shadow-xl hover:shadow-purple-950/40 focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all select-none cursor-pointer"
                  >
                    {/* Background Poster (Capa como background) */}
                    {doc.coverUrl ? (
                      <div
                        className="absolute inset-0 bg-cover bg-center transition-transform duration-500 ease-out group-hover:scale-105 group-focus-within:scale-105"
                        style={{ backgroundImage: `url("${doc.coverUrl}")` }}
                      />
                    ) : (
                      <div className="absolute inset-0 bg-gradient-to-b from-gray-900 via-gray-950 to-black flex items-center justify-center">
                        <span className="text-4xl text-purple-400/60">📖</span>
                      </div>
                    )}

                    {/* Gradient overlay base para legibilidade sutil */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-black/40 group-hover:opacity-0 group-focus-within:opacity-0 transition-opacity" />

                    {/* Overlay completo em Hover/Focus e acessível em Touch (Focus-within / Active) */}
                    <div className="absolute inset-0 z-20 flex flex-col justify-between p-3.5 bg-gradient-to-t from-black/95 via-gray-950/90 to-black/80 backdrop-blur-[2px] opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 group-active:opacity-100 transition-all duration-200">
                      {/* Topo do Overlay: Badges */}
                      <div className="flex items-center justify-between gap-1">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border uppercase tracking-wide ${badgeClass}`}>
                          {doc.provider}
                        </span>
                        {doc.isOfficial ? (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-amber-950/80 text-amber-300 border border-amber-800">
                            OFICIAL
                          </span>
                        ) : (
                          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-md bg-gray-800/80 text-gray-300 border border-gray-700">
                            {doc.category}
                          </span>
                        )}
                      </div>

                      {/* Conteúdo Central: Metadados */}
                      <div className="my-auto py-2">
                        <h3 className="text-xs sm:text-sm font-bold text-white line-clamp-2 leading-snug">
                          {doc.title}
                        </h3>
                        {doc.description && (
                          <p className="text-[11px] text-gray-300 line-clamp-3 mt-1.5 leading-relaxed">
                            {doc.description}
                          </p>
                        )}
                        {doc.tags && doc.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {doc.tags.slice(0, 3).map((tag, idx) => (
                              <span key={idx} className="text-[9px] px-1.5 py-0.5 rounded bg-purple-950/60 border border-purple-800/50 text-purple-300">
                                #{tag}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Base: Ações do Card */}
                      <div className="pt-2 border-t border-gray-800 flex items-center justify-between gap-1.5">
                        <div className="flex items-center gap-1.5 flex-1">
                          <button
                            type="button"
                            onClick={() => setViewingDoc(doc)}
                            className="flex-1 rounded-xl bg-purple-600 hover:bg-purple-500 active:bg-purple-700 text-white font-semibold px-2.5 py-2 text-xs transition text-center shadow-lg flex items-center justify-center gap-1"
                            title="Visualizar documento em leitor integrado"
                          >
                            <span>Visualizar</span>
                          </button>
                          {(doc.externalUrl || doc.webReaderUrl) && (
                            <a
                              href={
                                doc.provider === "smb"
                                  ? `/api/library/documents/stream?file=${encodeURIComponent(doc.externalUrl)}`
                                  : doc.provider === "kavita" && doc.externalUrl.startsWith("/api/library/kavita/proxy")
                                  ? doc.externalUrl
                                  : doc.provider === "kavita" && !doc.externalUrl && doc.webReaderUrl
                                  ? doc.webReaderUrl
                                  : doc.externalUrl
                              }
                              target="_blank"
                              rel="noopener noreferrer"
                              className="rounded-xl border border-gray-700 bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white px-2.5 py-2 text-xs transition flex items-center justify-center"
                              title={
                                doc.provider === "kavita" && !doc.externalUrl && doc.webReaderUrl
                                  ? "Abrir no Kavita em nova aba"
                                  : "Abrir original em nova aba"
                              }
                            >
                              ↗
                            </a>
                          )}
                        </div>

                        {/* Edição / Exclusão (Apenas para docs locais NÃO oficiais e usuários autenticados) */}
                        {!doc.isOfficial && doc.provider !== "kavita" && isAuthenticated && (
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleEdit(doc);
                              }}
                              className="rounded-lg p-1.5 text-gray-400 hover:text-purple-300 hover:bg-gray-800 transition text-xs"
                              title="Editar documento"
                              aria-label="Editar"
                            >
                              ✏️
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDelete(doc);
                              }}
                              className="rounded-lg p-1.5 text-gray-400 hover:text-red-400 hover:bg-gray-800 transition text-xs"
                              title="Excluir documento"
                              aria-label="Excluir"
                            >
                              🗑️
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Modal Leitor de PDF / Visualizador de Iframe */}
      {viewingDoc && (
        <PdfViewerModal
          isOpen={Boolean(viewingDoc)}
          onClose={() => setViewingDoc(null)}
          title={viewingDoc.title}
          url={viewingDoc.externalUrl}
          provider={viewingDoc.provider}
          externalUrl={viewingDoc.externalUrl}
          pdfProxyUrl={viewingDoc.pdfProxyUrl}
          acquisitionUrl={viewingDoc.acquisitionUrl}
          webReaderUrl={viewingDoc.webReaderUrl}
        />
      )}

      {/* Modal de Criação / Edição de Documento */}
      {showCreateModal && (
        <CreateDocumentModal
          isOpen={showCreateModal}
          onClose={() => {
            setShowCreateModal(false);
            setEditingDoc(null);
          }}
          onSuccess={() => {
            loadDocuments();
          }}
          campaignId={campaignId}
          editingDocument={editingDoc}
        />
      )}
    </div>
  );
}
