"use client";

import { useEffect, useState, useCallback } from "react";
import { CalendarDays, Dices, Globe2, Pencil, Shield, Sparkles, Sword, UserRound } from "lucide-react";
import CommunityCard, { CommunityPost } from "./CommunityCard";
import PostDetailModal from "./PostDetailModal";
import EditMasterProfileModal from "./EditMasterProfileModal";

export type MasterProfileData = {
  id: string;
  displayName: string | null;
  masterName: string | null;
  masterAvatar: string | null;
  masterBio: string | null;
  masterBannerUrl: string | null;
  statistics: {
    campaigns: number;
    sessions: number;
    spells: number;
    items: number;
    classes: number;
    npcs: number;
    worlds: number;
  };
};

type Props = {
  userId: string;
  profileData?: MasterProfileData;
  currentUserId?: string | null;
  onPostClick?: (post: CommunityPost) => void;
};

type Tab = "posts" | "cloned" | "liked";

const STAT_CONFIG = [
  { key: "campaigns", label: "Campanhas", Icon: Dices },
  { key: "sessions", label: "Sessões", Icon: CalendarDays },
  { key: "spells", label: "Magias", Icon: Sparkles },
  { key: "items", label: "Itens", Icon: Sword },
  { key: "classes", label: "Classes", Icon: Shield },
  { key: "npcs", label: "NPCs", Icon: UserRound },
  { key: "worlds", label: "Mundos", Icon: Globe2 },
] as const;

export default function MasterProfile({
  userId,
  profileData,
  currentUserId,
  onPostClick,
}: Props) {
  const [profile, setProfile] = useState<MasterProfileData | null>(profileData ?? null);
  const [loadingProfile, setLoadingProfile] = useState(!profileData);
  const [tab, setTab] = useState<Tab>("posts");
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [loadingPosts, setLoadingPosts] = useState(false);
  const [selectedPost, setSelectedPost] = useState<CommunityPost | null>(null);
  const [editModalOpen, setEditModalOpen] = useState(false);

  // Determina se o perfil pertence ao usuário logado
  const isOwnProfile = Boolean(currentUserId && currentUserId === userId);

  // Carrega os dados do perfil se não vierem via SSR
  useEffect(() => {
    if (profileData) {
      setProfile(profileData);
      setLoadingProfile(false);
      return;
    }

    async function fetchProfile() {
      setLoadingProfile(true);
      try {
        const res = await fetch(`/api/community/profile/${userId}`);
        if (!res.ok) throw new Error("Erro ao carregar perfil de mestre");
        const data = await res.json();
        setProfile(data.profile ?? data);
      } catch (err) {
        console.error("Erro ao carregar perfil:", err);
      } finally {
        setLoadingProfile(false);
      }
    }

    void fetchProfile();
  }, [userId, profileData]);

  // Carrega os posts da tab ativa
  const fetchTabPosts = useCallback(async () => {
    setLoadingPosts(true);
    try {
      const endpoint = `/api/community/profile/${userId}/${tab}`;
      const res = await fetch(endpoint);
      if (!res.ok) throw new Error("Erro ao buscar publicações");
      const data = await res.json();
      setPosts(data.data ?? []);
    } catch (err) {
      console.error("Erro ao buscar publicações:", err);
      setPosts([]);
    } finally {
      setLoadingPosts(false);
    }
  }, [userId, tab]);

  useEffect(() => {
    void fetchTabPosts();
  }, [fetchTabPosts]);

  const handlePostUpdate = (updatedPost: CommunityPost) => {
    setPosts((prev) =>
      prev.map((p) => (p.id === updatedPost.id ? updatedPost : p))
    );
    if (selectedPost && selectedPost.id === updatedPost.id) {
      setSelectedPost(updatedPost);
    }
  };

  const handleCardClick = (post: CommunityPost) => {
    if (onPostClick) {
      onPostClick(post);
    } else {
      setSelectedPost(post);
    }
  };

  if (loadingProfile) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-3 text-gray-400">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-purple-500 border-t-transparent" />
        <span className="text-sm">Carregando perfil do mestre...</span>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-2 text-gray-400">
        <span className="text-2xl">🔍</span>
        <h2 className="text-base font-semibold text-gray-300">Perfil não encontrado</h2>
        <p className="text-xs text-gray-500">O usuário solicitado não existe ou não possui perfil ativo.</p>
      </div>
    );
  }

  const masterDisplayName = profile.masterName || profile.displayName || "Mestre Anônimo";
  const userHandle = profile.displayName || "mestre";
  const avatarUrl = profile.masterAvatar;
  const bannerUrl = profile.masterBannerUrl;

  return (
    <>
      {editModalOpen && (
        <EditMasterProfileModal
          profile={profile}
          onClose={() => setEditModalOpen(false)}
          onSaved={(updated) => {
            setProfile((prev) =>
              prev
                ? {
                    ...prev,
                    ...updated,
                    statistics: prev.statistics,
                  }
                : null
            );
          }}
        />
      )}

      {selectedPost && (
        <PostDetailModal
          post={selectedPost}
          onClose={() => setSelectedPost(null)}
          onCloned={() => {
            void fetchTabPosts();
          }}
        />
      )}

      <div className="flex flex-col w-full max-w-5xl mx-auto pb-12">
        {/* Banner do Perfil */}
        <div
          className="relative h-36 sm:h-48 md:h-60 w-full overflow-hidden bg-gradient-to-r from-purple-900 via-indigo-950 to-gray-900 shadow-inner"
          style={
            bannerUrl
              ? {
                  backgroundImage: `url(${bannerUrl})`,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                }
              : undefined
          }
        >
          {!bannerUrl && (
            <div className="absolute inset-0 flex items-center justify-center opacity-20">
              <Sparkles className="h-24 w-24 text-purple-300" />
            </div>
          )}
        </div>

        {/* Informações do Cabeçalho e Avatar */}
        <div className="relative px-4 sm:px-6">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
            {/* Avatar circular sobreposto */}
            <div className="-mt-14 sm:-mt-20 flex items-end gap-3">
              <div className="flex h-24 w-24 sm:h-32 sm:w-32 shrink-0 select-none items-center justify-center rounded-full border-4 border-gray-950 bg-gradient-to-tr from-purple-800 to-indigo-700 text-3xl sm:text-4xl font-extrabold text-white shadow-2xl overflow-hidden ring-1 ring-white/10">
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt={masterDisplayName}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span>{masterDisplayName.charAt(0).toUpperCase()}</span>
                )}
              </div>
            </div>

            {/* Botão de Editar Perfil (se proprietário) */}
            <div className="flex justify-end pt-2 sm:pt-0">
              {isOwnProfile && (
                <button
                  type="button"
                  onClick={() => setEditModalOpen(true)}
                  className="inline-flex items-center gap-2 rounded-full border border-gray-700 bg-gray-900/90 px-4 py-1.5 text-xs font-semibold text-gray-200 shadow-sm transition-all hover:border-purple-500 hover:bg-gray-800 hover:text-white"
                >
                  <Pencil className="h-3.5 w-3.5 text-purple-400" />
                  <span>Editar Perfil</span>
                </button>
              )}
            </div>
          </div>

          {/* Nome, Handle e Bio */}
          <div className="mt-3 space-y-1">
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-gray-100">
              {masterDisplayName}
            </h1>
            <p className="text-xs font-medium text-gray-500">
              @{userHandle}
            </p>
            {profile.masterBio ? (
              <p className="mt-2 text-sm leading-relaxed text-gray-300 max-w-3xl whitespace-pre-line">
                {profile.masterBio}
              </p>
            ) : (
              <p className="mt-2 text-xs italic text-gray-500">
                Nenhuma biografia informada.
              </p>
            )}
          </div>

          {/* Grid Horizontal de Estatísticas */}
          <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5">
            {STAT_CONFIG.map(({ key, label, Icon }) => {
              const count = profile.statistics?.[key] ?? 0;
              return (
                <div
                  key={key}
                  className="flex flex-col items-center justify-center rounded-xl border border-gray-800/80 bg-gray-900/40 p-2.5 transition-all hover:border-purple-800/60 hover:bg-gray-900/80"
                >
                  <Icon className="h-5 w-5 text-purple-400" />
                  <span className="text-base font-bold text-gray-100 mt-1">{count}</span>
                  <span className="text-[11px] font-medium text-gray-400">{label}</span>
                </div>
              );
            })}
          </div>

          {/* Abas de Conteúdo Fixas */}
          <div className="mt-6 border-b border-gray-800 overflow-x-auto scrollbar-none">
            <div className="flex gap-2 min-w-max justify-center">
              {[
                { id: "posts" as Tab, label: "Publicações" },
                { id: "cloned" as Tab, label: "Clonados" },
                { id: "liked" as Tab, label: "Curtidos" },
              ].map(({ id, label }) => {
                const isActive = tab === id;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setTab(id)}
                    className={`relative px-5 py-3 text-sm font-semibold transition-colors ${
                      isActive
                        ? "text-purple-400"
                        : "text-gray-400 hover:text-gray-200"
                    }`}
                  >
                    <span>{label}</span>
                    {isActive && (
                      <span className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full bg-purple-500" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Feed da Aba Ativa */}
          <div className="mt-4">
            {loadingPosts ? (
              <div className="flex h-40 flex-col items-center justify-center gap-2 text-gray-400">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-purple-500 border-t-transparent" />
                <span className="text-xs">Carregando conteúdo...</span>
              </div>
            ) : posts.length === 0 ? (
              <div className="flex h-40 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-gray-800/80 p-6 text-center text-gray-500">
                <span className="text-3xl">📭</span>
                <p className="text-sm font-medium text-gray-400">
                  {tab === "posts"
                    ? "Nenhuma publicação criada por este mestre."
                    : tab === "cloned"
                    ? "Nenhum conteúdo clonado por este mestre."
                    : "Nenhum conteúdo curtido por este mestre."}
                </p>
                <p className="text-xs text-gray-600">
                  As criações compartilhadas aparecerão aqui quando disponíveis.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-gray-800/80 rounded-xl border border-gray-800/80 bg-gray-950/60 overflow-hidden shadow-sm">
                {posts.map((post) => (
                  <CommunityCard
                    key={post.id}
                    post={post}
                    onOpen={handleCardClick}
                    onUpdate={handlePostUpdate}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
