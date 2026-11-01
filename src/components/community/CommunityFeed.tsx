"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import { User, Plus } from "lucide-react";
import CommunityFilters from "./CommunityFilters";
import CommunityCard, { CommunityPost } from "./CommunityCard";
import CreatePostModal from "./CreatePostModal";
import PostDetailModal from "./PostDetailModal";
import { Spinner } from "@/components/ui/Spinner";
import { Button } from "@/components/ui/Button";

type CurrentUser = {
  id: string;
  masterName: string | null;
  masterAvatar: string | null;
  displayName: string | null;
};

type CommunityFeedProps = {
  currentUser?: CurrentUser;
};

export default function CommunityFeed({ currentUser }: CommunityFeedProps) {
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [filters, setFilters] = useState({
    type: "",
    search: "",
    sort: "top",
  });

  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedPost, setSelectedPost] = useState<CommunityPost | null>(null);

  const fetchPosts = useCallback(
    async (targetPage = 1, currentFilters = filters) => {
      if (targetPage === 1) {
        setLoading(true);
      } else {
        setLoadingMore(true);
      }
      setError(null);

      try {
        const query = new URLSearchParams({
          page: String(targetPage),
          limit: "12",
        });

        if (currentFilters.type) {
          query.set("type", currentFilters.type);
        }
        if (currentFilters.search) {
          query.set("search", currentFilters.search);
        }

        const res = await fetch(`/api/community/posts?${query.toString()}`);
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || "Falha ao carregar publicações da comunidade");
        }

        const json = await res.json();
        const data: CommunityPost[] = json.data || [];

        setPosts((prev) => (targetPage === 1 ? data : [...prev, ...data]));
        setPage(targetPage);
        setHasMore(data.length === 12);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erro desconhecido");
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [filters]
  );

  useEffect(() => {
    void fetchPosts(1, filters);
  }, [filters.type, filters.search, fetchPosts]);

  const handleFilterChange = (newFilters: typeof filters) => {
    setFilters(newFilters);
  };

  const handlePostUpdate = (updatedPost: CommunityPost) => {
    setPosts((prev) =>
      prev.map((p) => (p.id === updatedPost.id ? updatedPost : p))
    );
    if (selectedPost && selectedPost.id === updatedPost.id) {
      setSelectedPost(updatedPost);
    }
  };

  // Ordenação client-side
  const sortedPosts = useMemo(() => {
    return [...posts].sort((a, b) => {
      if (filters.sort === "popular") {
        return b.likesCount - a.likesCount;
      }
      if (filters.sort === "cloned") {
        return b.clonesCount - a.clonesCount;
      }
      // "recent" (padrão)
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [posts, filters.sort]);

  return (
    <section className="flex flex-col flex-1 min-h-0 bg-gray-950">
      {/* Cabeçalho compacto do Mestre ou fallback */}
      {currentUser ? (
        <header className="flex items-center justify-between px-4 py-3 border-b border-gray-800 bg-gray-950 shrink-0">
          <Link
            href={`/master/community/profile/${currentUser.id}`}
            className="flex items-center gap-3 hover:opacity-80 transition-opacity"
          >
            {currentUser.masterAvatar ? (
              <img
                src={currentUser.masterAvatar}
                alt="Avatar"
                className="w-10 h-10 rounded-full object-cover border border-gray-700"
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-gray-800 border border-gray-700 flex items-center justify-center text-gray-400">
                <User size={20} />
              </div>
            )}
            <div>
              <p className="font-semibold text-gray-100 text-sm">
                {currentUser.masterName || currentUser.displayName || "Mestre"}
              </p>
              <p className="text-xs text-gray-500">Ver perfil</p>
            </div>
          </Link>
          <Button
            onClick={() => setIsCreateModalOpen(true)}
            variant="master"
            className="flex items-center gap-2 text-sm shadow-md"
          >
            <Plus size={16} />
            Publicar Criação
          </Button>
        </header>
      ) : (
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 shrink-0 px-4 py-3 border-b border-gray-800 bg-gray-950">
          <div className="text-xs text-gray-400">
            Mostrando{" "}
            <span className="font-semibold text-gray-200">
              {sortedPosts.length}
            </span>{" "}
            criações compartilhadas
          </div>

          <Button
            onClick={() => setIsCreateModalOpen(true)}
            variant="master"
            className="self-start md:self-auto gap-2 text-sm shadow-md"
          >
            <Plus size={16} />
            <span>+ Publicar Criação</span>
          </Button>
        </div>
      )}

      {/* Barra de Filtros */}
      <div className="border-b border-gray-800 bg-gray-950">
        <CommunityFilters value={filters} onChange={handleFilterChange} />
      </div>

      {/* Feed contínuo */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-gray-400">
            <Spinner size="lg" />
            <span className="text-sm">Carregando comunidade...</span>
          </div>
        ) : error ? (
          <div className="mx-4 mt-6 flex flex-col items-center justify-center p-8 rounded-xl border border-red-900/60 bg-red-950/30 text-center gap-3">
            <span className="text-3xl">⚠️</span>
            <p className="text-sm text-red-300">{error}</p>
            <Button
              onClick={() => void fetchPosts(1, filters)}
              variant="secondary"
              className="text-xs"
            >
              Tentar Novamente
            </Button>
          </div>
        ) : sortedPosts.length === 0 ? (
          <div className="mx-4 mt-8 flex flex-col items-center justify-center p-12 rounded-xl border border-gray-800 bg-gray-950/40 text-center gap-4">
            <span className="text-4xl">📜</span>
            <div>
              <h3 className="text-base font-semibold text-gray-300">
                Nenhuma criação encontrada
              </h3>
              <p className="text-xs text-gray-500 mt-1 max-w-sm">
                Não encontramos publicações com esses filtros. Seja o primeiro a compartilhar uma criação lendária!
              </p>
            </div>
            <Button
              onClick={() => setIsCreateModalOpen(true)}
              variant="primary"
              className="text-xs"
            >
              + Criar Primeira Publicação
            </Button>
          </div>
        ) : (
          <div>
            {sortedPosts.map((post) => (
              <CommunityCard
                key={post.id}
                post={post}
                onOpen={(p) => setSelectedPost(p)}
                onUpdate={handlePostUpdate}
              />
            ))}
          </div>
        )}

        {/* Botão Carregar mais */}
        {!loading && hasMore && (
          <div className="flex justify-center py-6 border-t border-gray-800">
            <Button
              onClick={() => void fetchPosts(page + 1, filters)}
              disabled={loadingMore}
              variant="secondary"
              className="text-sm px-6"
            >
              {loadingMore ? (
                <span className="flex items-center gap-2">
                  <Spinner size="sm" />
                  Carregando...
                </span>
              ) : (
                "Carregar mais"
              )}
            </Button>
          </div>
        )}
      </div>

      {/* Modal de Criação de Post */}
      <CreatePostModal
        open={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onCreated={() => {
          setIsCreateModalOpen(false);
          void fetchPosts(1, filters);
        }}
      />

      {/* Modal de Detalhes do Post */}
      {selectedPost && (
        <PostDetailModal
          post={selectedPost}
          onClose={() => setSelectedPost(null)}
          onCloned={() => {
            const updated = {
              ...selectedPost,
              clonesCount: selectedPost.clonesCount + 1,
            };
            handlePostUpdate(updated);
          }}
        />
      )}
    </section>
  );
}
