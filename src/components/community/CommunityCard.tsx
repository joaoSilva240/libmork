"use client";

import React, { useState } from "react";
import Link from "next/link";
import { ArrowBigDown, ArrowBigUp, Heart, MessageCircle, Repeat2, Download } from "lucide-react";
import { Toast } from "@/components/ui/Toast";
import ImportCustomizeModal from "./ImportCustomizeModal";

export type CommunityPost = {
  id: string;
  authorId: string;
  title: string;
  description: string | null;
  contentType: string;
  contentId?: string | null;
  tags: string[];
  payload: any;
  clonesCount: number;
  createdAt: string;
  updatedAt: string;
  author?: {
    id: string;
    displayName: string | null;
    masterName?: string | null;
    masterAvatar?: string | null;
  };
  likesCount: number;
  commentsCount: number;
  isLikedByMe: boolean;
  upvotes?: number;
  downvotes?: number;
  score?: number;
  userVote?: number | null;
};

export const CONTENT_TYPE_CONFIG: Record<
  string,
  { label: string; icon: string; badgeClass: string }
> = {
  spell: {
    label: "Magia",
    icon: "🔮",
    badgeClass: "bg-purple-950/60 text-purple-300 border-purple-800/50",
  },
  item: {
    label: "Item",
    icon: "⚔️",
    badgeClass: "bg-amber-950/60 text-amber-300 border-amber-800/50",
  },
  class: {
    label: "Classe",
    icon: "🛡️",
    badgeClass: "bg-emerald-950/60 text-emerald-300 border-emerald-800/50",
  },
  npc: {
    label: "NPC",
    icon: "👤",
    badgeClass: "bg-rose-950/60 text-rose-300 border-rose-800/50",
  },
  world: {
    label: "Mundo",
    icon: "🌍",
    badgeClass: "bg-cyan-950/60 text-cyan-300 border-cyan-800/50",
  },
  campaign: {
    label: "Campanha",
    icon: "🎲",
    badgeClass: "bg-indigo-950/60 text-indigo-300 border-indigo-800/50",
  },
};

type Props = {
  post: CommunityPost;
  onOpen: (post: CommunityPost) => void;
  onUpdate?: (post: CommunityPost) => void;
};

function formatRelativeTime(dateString: string): string {
  try {
    const date = new Date(dateString);
    const now = new Date();
    const diffSec = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffSec < 60) return "agora";
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `há ${diffMin}m`;
    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) return `há ${diffHours}h`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 30) return `há ${diffDays} dias`;
    return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
  } catch {
    return "";
  }
}

export default function CommunityCard({ post, onOpen, onUpdate }: Props) {
  const [isLiking, setIsLiking] = useState(false);
  const [isVoting, setIsVoting] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null);

  const handleVote = async (e: React.MouseEvent, targetValue: 1 | -1) => {
    e.stopPropagation();
    if (isVoting) return;

    const previousUserVote = post.userVote ?? null;
    const previousScore = post.score ?? 0;
    const previousUpvotes = post.upvotes ?? 0;
    const previousDownvotes = post.downvotes ?? 0;

    // Optimistic calculation
    let optimisticUserVote: number | null = targetValue;
    let optimisticScore = previousScore;
    let optimisticUpvotes = previousUpvotes;
    let optimisticDownvotes = previousDownvotes;

    if (previousUserVote === targetValue) {
      // Toggle off
      optimisticUserVote = null;
      if (targetValue === 1) {
        optimisticUpvotes = Math.max(0, optimisticUpvotes - 1);
        optimisticScore = optimisticScore - 1;
      } else {
        optimisticDownvotes = Math.max(0, optimisticDownvotes - 1);
        optimisticScore = optimisticScore + 1;
      }
    } else if (previousUserVote === null) {
      // New vote
      if (targetValue === 1) {
        optimisticUpvotes = optimisticUpvotes + 1;
        optimisticScore = optimisticScore + 1;
      } else {
        optimisticDownvotes = optimisticDownvotes + 1;
        optimisticScore = optimisticScore - 1;
      }
    } else {
      // Vote swap (-1 to 1 or 1 to -1)
      if (targetValue === 1) {
        optimisticUpvotes = optimisticUpvotes + 1;
        optimisticDownvotes = Math.max(0, optimisticDownvotes - 1);
        optimisticScore = optimisticScore + 2;
      } else {
        optimisticDownvotes = optimisticDownvotes + 1;
        optimisticUpvotes = Math.max(0, optimisticUpvotes - 1);
        optimisticScore = optimisticScore - 2;
      }
    }

    onUpdate?.({
      ...post,
      userVote: optimisticUserVote,
      score: optimisticScore,
      upvotes: optimisticUpvotes,
      downvotes: optimisticDownvotes,
    });

    setIsVoting(true);
    try {
      const res = await fetch(`/api/community/posts/${post.id}/vote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value: targetValue }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || "Falha ao registrar voto");
      }

      const data = await res.json();
      onUpdate?.({
        ...post,
        score: Number(data.score),
        upvotes: Number(data.upvotes),
        downvotes: Number(data.downvotes),
        userVote: data.userVote !== null && data.userVote !== undefined ? Number(data.userVote) : null,
      });
    } catch (err) {
      // Rollback on error
      onUpdate?.({
        ...post,
        userVote: previousUserVote,
        score: previousScore,
        upvotes: previousUpvotes,
        downvotes: previousDownvotes,
      });
      setToast({
        message: err instanceof Error ? err.message : "Erro ao votar",
        type: "error",
      });
    } finally {
      setIsVoting(false);
    }
  };

  const typeConfig = CONTENT_TYPE_CONFIG[post.contentType] || {
    label: post.contentType,
    icon: "📜",
    badgeClass: "bg-gray-800/80 text-gray-300 border-gray-700",
  };

  const handleLike = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isLiking) return;
    setIsLiking(true);

    try {
      const res = await fetch(`/api/community/posts/${post.id}/like`, {
        method: "POST",
      });
      if (!res.ok) {
        throw new Error("Falha ao curtir publicação");
      }
      const data = await res.json();
      const updatedPost = {
        ...post,
        isLikedByMe: Boolean(data.isLiked),
        likesCount: Number(data.likesCount),
      };
      onUpdate?.(updatedPost);
    } catch (err) {
      setToast({
        message: err instanceof Error ? err.message : "Erro ao registrar curtida",
        type: "error",
      });
    } finally {
      setIsLiking(false);
    }
  };

  const authorName = post.author?.masterName || post.author?.displayName || "Mestre Anônimo";
  const authorAvatar = post.author?.masterAvatar;
  const attachedImageUrl =
    post.payload?.imageUrl ||
    post.payload?.iconUrl ||
    post.payload?.mapUrl ||
    post.payload?.tokenUrl ||
    post.payload?.coverUrl;

  return (
    <>
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}

      {showImportModal && (
        <ImportCustomizeModal
          contentType={post.contentType}
          payload={post.payload ?? {}}
          postId={post.id}
          onClose={() => setShowImportModal(false)}
          onSuccess={() => {
            onUpdate?.({
              ...post,
              clonesCount: post.clonesCount + 1,
            });
          }}
        />
      )}

      <article
        onClick={() => onOpen(post)}
        className="group relative flex cursor-pointer items-center gap-3.5 px-4 py-3.5 transition-colors hover:bg-gray-900/50"
      >
        {/* Controle vertical de votação estilo Reddit à esquerda, centralizado no card */}
        <div
          className="flex flex-col items-center justify-center self-center shrink-0 w-8"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={(e) => handleVote(e, 1)}
            disabled={isVoting}
            aria-label="Votar positivo"
            title="Votar positivo"
            className={`flex items-center justify-center p-0.5 rounded transition-colors ${
              post.userVote === 1
                ? "text-orange-500 hover:text-orange-400"
                : "text-gray-400 hover:text-orange-400"
            }`}
          >
            <ArrowBigUp
              className={`h-5 w-5 ${
                post.userVote === 1 ? "fill-orange-500 text-orange-500" : ""
              }`}
            />
          </button>
          <span
            className={`text-xs font-bold my-0.5 text-center select-none ${
              post.userVote === 1
                ? "text-orange-500"
                : post.userVote === -1
                ? "text-blue-500"
                : "text-gray-300"
            }`}
            aria-label={`Pontuação: ${post.score ?? 0}`}
            title={`Pontuação: ${post.score ?? 0}`}
          >
            {post.score ?? 0}
          </span>
          <button
            type="button"
            onClick={(e) => handleVote(e, -1)}
            disabled={isVoting}
            aria-label="Votar negativo"
            title="Votar negativo"
            className={`flex items-center justify-center p-0.5 rounded transition-colors ${
              post.userVote === -1
                ? "text-blue-500 hover:text-blue-400"
                : "text-gray-400 hover:text-blue-400"
            }`}
          >
            <ArrowBigDown
              className={`h-5 w-5 ${
                post.userVote === -1 ? "fill-blue-500 text-blue-500" : ""
              }`}
            />
          </button>
        </div>

        {/* Avatar (40px circular) */}
        {authorAvatar ? (
          <Link
            href={`/master/community/profile/${post.authorId}`}
            onClick={(e) => e.stopPropagation()}
            className="flex h-10 w-10 shrink-0 overflow-hidden rounded-full ring-1 ring-white/10 hover:opacity-80 transition-opacity"
          >
            <img
              src={authorAvatar}
              alt={authorName}
              className="h-full w-full object-cover"
            />
          </Link>
        ) : (
          <Link
            href={`/master/community/profile/${post.authorId}`}
            onClick={(e) => e.stopPropagation()}
            className="flex h-10 w-10 shrink-0 select-none items-center justify-center rounded-full bg-gradient-to-tr from-purple-800 to-indigo-700 text-sm font-bold text-white shadow-sm ring-1 ring-white/10 hover:opacity-80 transition-opacity"
          >
            {authorName.charAt(0).toUpperCase()}
          </Link>
        )}

        {/* Layout central e direito */}
        <div className="flex min-w-0 flex-1 flex-col md:flex-row gap-4">
          {/* Coluna esquerda (flex-1): autor, título, descrição, tags e ações */}
          <div className="flex min-w-0 flex-1 flex-col">
            {/* Linha de cabeçalho: Autor, timestamp, badge */}
            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              <Link
                href={`/master/community/profile/${post.authorId}`}
                onClick={(e) => e.stopPropagation()}
                className="font-bold text-gray-100 hover:underline hover:text-purple-300"
              >
                {authorName}
              </Link>
              <span className="text-gray-600">·</span>
              <span className="text-gray-500">{formatRelativeTime(post.createdAt)}</span>
              <span
                className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.2 text-[11px] font-medium ${typeConfig.badgeClass}`}
              >
                <span>{typeConfig.icon}</span>
                <span>{typeConfig.label}</span>
              </span>
            </div>

            {/* Título do post */}
            <h3 className="mt-1 text-base font-bold text-gray-100 transition-colors group-hover:text-purple-300">
              {post.title}
            </h3>

            {/* Descrição */}
            <p className="mt-1 line-clamp-3 text-xs leading-relaxed text-gray-400">
              {post.description || "Nenhuma descrição fornecida."}
            </p>

            {/* Tags inline */}
            {post.tags && post.tags.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {post.tags.slice(0, 5).map((tag, idx) => (
                  <span
                    key={idx}
                    className="rounded-full bg-gray-900/90 border border-gray-800 px-2 py-0.5 text-[11px] text-gray-400 hover:text-purple-300 transition-colors"
                  >
                    #{tag}
                  </span>
                ))}
                {post.tags.length > 5 && (
                  <span className="text-[11px] text-gray-500 self-center">
                    +{post.tags.length - 5}
                  </span>
                )}
              </div>
            )}

            {/* Barra de ações com ícones minimalistas */}
            <div className="mt-3 flex items-center justify-between pt-1 text-xs text-gray-500">
              <div className="flex items-center gap-4">
                {/* Like com Heart */}
                <button
                  type="button"
                  onClick={handleLike}
                  disabled={isLiking}
                  aria-label="Curtidas"
                  title="Curtidas"
                  className={`inline-flex items-center gap-1.5 transition-colors hover:text-rose-400 ${
                    post.isLikedByMe ? "text-rose-500 font-semibold" : "text-gray-400"
                  }`}
                >
                  <Heart
                    className={`h-4 w-4 transition-transform active:scale-125 ${
                      post.isLikedByMe ? "fill-rose-500 text-rose-500" : ""
                    }`}
                  />
                  <span>{post.likesCount}</span>
                </button>

                {/* Comentários com MessageCircle */}
                <div
                  className="inline-flex items-center gap-1.5 text-gray-400 hover:text-blue-400 transition-colors"
                  aria-label="Comentários"
                  title="Comentários"
                >
                  <MessageCircle className="h-4 w-4" />
                  <span>{post.commentsCount}</span>
                </div>

                {/* Clones com Repeat2 */}
                <div
                  className="inline-flex items-center gap-1.5 text-gray-400 hover:text-emerald-400 transition-colors"
                  aria-label="Clones"
                  title="Clones"
                >
                  <Repeat2 className="h-4 w-4" />
                  <span>{post.clonesCount}</span>
                </div>
              </div>

              {/* Botão Importar com Download */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowImportModal(true);
                }}
                className="inline-flex items-center gap-1.5 rounded-full bg-purple-600 px-3 py-1 text-xs font-semibold text-white transition-all hover:bg-purple-500 shadow-sm"
              >
                <Download className="h-3.5 w-3.5" />
                <span>Importar</span>
              </button>
            </div>
          </div>

          {/* Coluna direita (largura fixa / compacta ~120px-160px) para imagem e destaque */}
          {attachedImageUrl && (
            <div className="shrink-0 w-full md:w-36 flex flex-col justify-center">
              <div className="relative overflow-hidden rounded-xl border border-gray-800 bg-gray-900 shadow-sm aspect-video md:aspect-square flex items-center justify-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={attachedImageUrl}
                  alt={post.title}
                  className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                  loading="lazy"
                />
                <span className="absolute bottom-1 right-1 rounded bg-black/70 px-1 py-0.5 text-[10px] text-gray-300 backdrop-blur-xs">
                  Anexo
                </span>
              </div>
            </div>
          )}
        </div>
      </article>
    </>
  );
}
