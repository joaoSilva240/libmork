"use client";

import { useState, useEffect, useCallback } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import { Toast } from "@/components/ui/Toast";
import { ArrowBigDown, ArrowBigUp, Heart, MessageCircle, Repeat2, Download, Sparkles } from "lucide-react";
import Link from "next/link";
import { CONTENT_TYPE_CONFIG, CommunityPost } from "./CommunityCard";
import ImportCustomizeModal from "./ImportCustomizeModal";

type Props = {
  post: CommunityPost;
  onClose: () => void;
  onCloned?: () => void;
};

type Comment = {
  id: string;
  postId: string;
  content: string;
  commentType?: string;
  attachmentContentType?: string | null;
  attachmentTitle?: string | null;
  attachmentPayload?: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
  author: {
    id: string;
    displayName: string | null;
    masterName?: string | null;
    masterAvatar?: string | null;
  };
};

export default function PostDetailModal({ post, onClose, onCloned }: Props) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [newComment, setNewComment] = useState("");
  const [isPosting, setIsPosting] = useState(false);
  const [isVoting, setIsVoting] = useState(false);
  const [showJson, setShowJson] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null);

  const [localPost, setLocalPost] = useState(post);

  useEffect(() => {
    setLocalPost(post);
  }, [post]);

  // Estado para o modal de pré-importação / personalização
  const [customizeImportTarget, setCustomizeImportTarget] = useState<{
    contentType: string;
    payload: Record<string, unknown>;
    postId?: string;
    commentId?: string;
  } | null>(null);

  const handleVote = async (targetValue: 1 | -1) => {
    if (isVoting) return;

    const previousUserVote = localPost.userVote ?? null;
    const previousScore = localPost.score ?? 0;
    const previousUpvotes = localPost.upvotes ?? 0;
    const previousDownvotes = localPost.downvotes ?? 0;

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
        optimisticScore -= 1;
      } else {
        optimisticDownvotes = Math.max(0, optimisticDownvotes - 1);
        optimisticScore += 1;
      }
    } else if (previousUserVote === null) {
      // New vote
      if (targetValue === 1) {
        optimisticUpvotes += 1;
        optimisticScore += 1;
      } else {
        optimisticDownvotes += 1;
        optimisticScore -= 1;
      }
    } else {
      // Vote swap
      if (targetValue === 1) {
        optimisticUpvotes += 1;
        optimisticDownvotes = Math.max(0, optimisticDownvotes - 1);
        optimisticScore += 2;
      } else {
        optimisticDownvotes += 1;
        optimisticUpvotes = Math.max(0, optimisticUpvotes - 1);
        optimisticScore -= 2;
      }
    }

    setLocalPost({
      ...localPost,
      userVote: optimisticUserVote,
      score: optimisticScore,
      upvotes: optimisticUpvotes,
      downvotes: optimisticDownvotes,
    });

    setIsVoting(true);
    try {
      const res = await fetch(`/api/community/posts/${localPost.id}/vote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value: targetValue }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || "Falha ao registrar voto");
      }

      const data = await res.json();
      setLocalPost({
        ...localPost,
        score: Number(data.score),
        upvotes: Number(data.upvotes),
        downvotes: Number(data.downvotes),
        userVote: data.userVote !== null && data.userVote !== undefined ? Number(data.userVote) : null,
      });
    } catch (err) {
      // Rollback on error
      setLocalPost({
        ...localPost,
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
    badgeClass: "bg-gray-800 text-gray-300 border-gray-700",
  };

  const loadComments = useCallback(async () => {
    setLoadingComments(true);
    try {
      const res = await fetch(`/api/community/posts/${post.id}/comments`);
      if (!res.ok) throw new Error("Falha ao carregar comentários");
      const data = await res.json();
      setComments(data.data ?? []);
    } catch (err) {
      setToast({
        message: err instanceof Error ? err.message : "Erro ao carregar comentários",
        type: "error",
      });
    } finally {
      setLoadingComments(false);
    }
  }, [post.id]);

  useEffect(() => {
    void loadComments();
  }, [loadComments]);

  const postComment = async () => {
    if (!newComment.trim() || isPosting) return;
    setIsPosting(true);

    try {
      const res = await fetch(`/api/community/posts/${post.id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: newComment.trim() }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Falha ao enviar comentário");
      }

      const data = await res.json();
      setComments((prev) => [...prev, data]);
      setNewComment("");
      setToast({ message: "Comentário publicado!", type: "success" });
    } catch (err) {
      setToast({
        message: err instanceof Error ? err.message : "Erro ao publicar comentário",
        type: "error",
      });
    } finally {
      setIsPosting(false);
    }
  };

  const handleOpenPostImport = () => {
    setCustomizeImportTarget({
      contentType: post.contentType,
      payload: post.payload ?? {},
      postId: post.id,
    });
  };

  const handleOpenCommentImport = (comment: Comment) => {
    if (!comment.attachmentContentType || !comment.attachmentPayload) return;
    setCustomizeImportTarget({
      contentType: comment.attachmentContentType,
      payload: comment.attachmentPayload,
      commentId: comment.id,
    });
  };

  const authorName = post.author?.masterName || post.author?.displayName || "Mestre Anônimo";
  const formattedDateTime = new Date(post.createdAt).toLocaleString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  const attachedImg =
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

      {customizeImportTarget && (
        <ImportCustomizeModal
          contentType={customizeImportTarget.contentType}
          payload={customizeImportTarget.payload}
          postId={customizeImportTarget.postId}
          commentId={customizeImportTarget.commentId}
          onClose={() => setCustomizeImportTarget(null)}
          onSuccess={() => {
            onCloned?.();
            void loadComments();
          }}
        />
      )}

      <Modal open onClose={onClose} labelledBy="post-detail-title">
        <div className="w-full max-w-2xl overflow-hidden rounded-2xl border border-gray-800 bg-gray-950 shadow-2xl">
          {/* Header minimalista com botão fechar */}
          <Modal.Header className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-800 bg-gray-950/90 px-4 py-3 backdrop-blur-md">
            <span className="text-sm font-semibold text-gray-200">Publicação</span>
            <Modal.CloseButton className="rounded-full p-1.5 text-gray-400 hover:bg-gray-900 hover:text-white transition-colors" />
          </Modal.Header>

          <Modal.Body className="max-h-[75vh] space-y-4 overflow-y-auto px-5 py-4">
            {/* Linha do autor */}
            <div className="flex items-center gap-3">
              {post.author?.masterAvatar ? (
                <Link
                  href={`/master/community/profile/${post.authorId}`}
                  className="flex h-11 w-11 shrink-0 overflow-hidden rounded-full ring-1 ring-white/10 hover:opacity-80 transition-opacity"
                >
                  <img
                    src={post.author.masterAvatar}
                    alt={authorName}
                    className="h-full w-full object-cover"
                  />
                </Link>
              ) : (
                <Link
                  href={`/master/community/profile/${post.authorId}`}
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-tr from-purple-700 to-indigo-600 text-base font-bold text-white shadow-inner hover:opacity-80 transition-opacity"
                >
                  {authorName.charAt(0).toUpperCase()}
                </Link>
              )}

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <Link
                    href={`/master/community/profile/${post.authorId}`}
                    className="font-bold text-gray-100 truncate hover:underline hover:text-purple-300"
                  >
                    {authorName}
                  </Link>
                  <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${typeConfig.badgeClass}`}>
                    <span>{typeConfig.icon}</span>
                    <span>{typeConfig.label}</span>
                  </span>
                </div>
                <div className="text-xs text-gray-500">Mestre da Comunidade</div>
              </div>

              {/* Botão Importar no topo com Download */}
              <button
                type="button"
                onClick={handleOpenPostImport}
                className="inline-flex items-center gap-1.5 rounded-full bg-purple-600 px-4 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-purple-500 shadow-sm"
              >
                <Download className="h-3.5 w-3.5" />
                <span>Importar</span>
              </button>
            </div>

            {/* Título e Descrição */}
            <div>
              <h2 id="post-detail-title" className="text-xl font-extrabold text-gray-100">
                {post.title}
              </h2>
              {post.description && (
                <p className="mt-2 text-sm leading-relaxed text-gray-300 whitespace-pre-line">
                  {post.description}
                </p>
              )}
            </div>

            {/* Tags */}
            {post.tags && post.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {post.tags.map((tag, idx) => (
                  <span
                    key={idx}
                    className="rounded-full bg-gray-900 border border-gray-800 px-2.5 py-0.5 text-xs text-purple-400"
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            )}

            {/* Imagem do Post se houver */}
            {attachedImg && (
              <div className="rounded-xl border border-gray-800 overflow-hidden bg-gray-900/50">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={attachedImg}
                  alt={post.title}
                  className="max-h-80 w-full object-contain bg-black/40"
                />
              </div>
            )}

            {/* Timestamp */}
            <div className="text-xs text-gray-500 pt-1">
              {formattedDateTime}
            </div>

            {/* Métricas / Contadores com ícones minimalistas */}
            <div className="flex items-center gap-6 border-y border-gray-800/80 py-3 text-xs text-gray-400">
              {/* Votação Reddit */}
              <div className="inline-flex self-center flex-col items-center justify-center gap-0 rounded-full border border-gray-800 bg-gray-900/60 px-2 py-0.5">
                <button
                  type="button"
                  onClick={() => handleVote(1)}
                  disabled={isVoting}
                  aria-label="Votar positivo"
                  title="Votar positivo"
                  className={`flex items-center justify-center p-0.5 rounded transition-colors ${
                    localPost.userVote === 1
                      ? "text-orange-500 hover:text-orange-400"
                      : "text-gray-400 hover:text-orange-400"
                  }`}
                >
                  <ArrowBigUp
                    className={`h-4 w-4 ${
                      localPost.userVote === 1 ? "fill-orange-500 text-orange-500" : ""
                    }`}
                  />
                </button>
                <span
                  className={`text-xs font-bold text-center select-none ${
                    localPost.userVote === 1
                      ? "text-orange-500"
                      : localPost.userVote === -1
                      ? "text-blue-500"
                      : "text-gray-200"
                  }`}
                  aria-label={`Pontuação: ${localPost.score ?? 0}`}
                  title={`Pontuação: ${localPost.score ?? 0}`}
                >
                  {localPost.score ?? 0}
                </span>
                <button
                  type="button"
                  onClick={() => handleVote(-1)}
                  disabled={isVoting}
                  aria-label="Votar negativo"
                  title="Votar negativo"
                  className={`flex items-center justify-center p-0.5 rounded transition-colors ${
                    localPost.userVote === -1
                      ? "text-blue-500 hover:text-blue-400"
                      : "text-gray-400 hover:text-blue-400"
                  }`}
                >
                  <ArrowBigDown
                    className={`h-4 w-4 ${
                      localPost.userVote === -1 ? "fill-blue-500 text-blue-500" : ""
                    }`}
                  />
                </button>
              </div>

              <div className="inline-flex items-center gap-1.5" aria-label="Curtidas" title="Curtidas">
                <Heart className={`h-4 w-4 ${post.isLikedByMe ? "fill-rose-500 text-rose-500" : ""}`} />
                <span><strong className="text-gray-100 font-bold">{post.likesCount}</strong></span>
              </div>
              <div className="inline-flex items-center gap-1.5" aria-label="Comentários" title="Comentários">
                <MessageCircle className="h-4 w-4" />
                <span><strong className="text-gray-100 font-bold">{post.commentsCount}</strong></span>
              </div>
              <div className="inline-flex items-center gap-1.5" aria-label="Clones" title="Clones">
                <Repeat2 className="h-4 w-4" />
                <span><strong className="text-gray-100 font-bold">{post.clonesCount}</strong></span>
              </div>

              <button
                type="button"
                onClick={() => setShowJson(!showJson)}
                className="ml-auto text-xs text-gray-500 hover:text-gray-300 underline"
              >
                {showJson ? "Ocultar dados" : "Ver dados técnicos"}
              </button>
            </div>

            {/* Payload JSON Técnico (expansível) */}
            {showJson && (
              <pre className="max-h-56 overflow-auto rounded-lg border border-gray-800 bg-black/60 p-3 text-[11px] font-mono text-gray-300">
                {JSON.stringify(post.payload, null, 2)}
              </pre>
            )}

            {/* Seção de comentários inline */}
            <div className="space-y-3 pt-2">
              <h3 className="text-sm font-bold text-gray-200">Comentários e Adaptações</h3>

              {/* Input inline */}
              <div className="flex items-start gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-800 text-xs font-semibold text-gray-300">
                  EU
                </div>
                <div className="flex-1 flex gap-2">
                  <input
                    type="text"
                    placeholder="Publicar sua resposta..."
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        void postComment();
                      }
                    }}
                    className="flex-1 rounded-full border border-gray-800 bg-gray-900/90 px-4 py-2 text-xs text-gray-200 placeholder-gray-500 focus:border-purple-500 focus:bg-gray-900 focus:outline-none"
                  />
                  <Button
                    onClick={postComment}
                    disabled={isPosting || !newComment.trim()}
                    variant="primary"
                    className="rounded-full px-4 py-1 text-xs"
                  >
                    {isPosting ? <Spinner size="sm" /> : "Responder"}
                  </Button>
                </div>
              </div>

              {/* Lista de Comentários */}
              {loadingComments ? (
                <div className="flex justify-center py-6">
                  <Spinner size="sm" />
                </div>
              ) : comments.length === 0 ? (
                <p className="py-4 text-center text-xs text-gray-500">
                  Nenhuma resposta ainda. Seja o primeiro a comentar ou crie uma versão adaptada!
                </p>
              ) : (
                <div className="divide-y divide-gray-800/60 pt-2 space-y-3">
                  {comments.map((comment) => {
                    const cAuthor = comment.author?.displayName || "Mestre Anônimo";
                    const isAttachment = comment.commentType === "attachment";
                    const payload = comment.attachmentPayload as Record<string, unknown> | undefined;
                    const commentImg =
                      payload?.imageUrl ||
                      payload?.iconUrl ||
                      payload?.mapUrl ||
                      payload?.tokenUrl;

                    if (isAttachment) {
                      return (
                        <div
                          key={comment.id}
                          className="rounded-xl border border-purple-800/40 bg-purple-950/20 p-3.5 space-y-2.5 transition-all hover:border-purple-700/60"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="inline-flex items-center gap-1 rounded-full bg-purple-900/60 px-2 py-0.5 text-[10px] font-semibold text-purple-300 border border-purple-700/50">
                                <Sparkles className="h-3 w-3" />
                                Adaptação da Comunidade
                              </span>
                              <span className="text-xs font-semibold text-gray-200">{cAuthor}</span>
                              <span className="text-gray-600">·</span>
                              <span className="text-[11px] text-gray-500">
                                {new Date(comment.createdAt).toLocaleDateString("pt-BR", {
                                  day: "2-digit",
                                  month: "short",
                                })}
                              </span>
                            </div>

                            <button
                              type="button"
                              onClick={() => handleOpenCommentImport(comment)}
                              className="inline-flex items-center gap-1 rounded-full bg-purple-600/90 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-purple-500 transition-colors"
                            >
                              <Download className="h-3 w-3" />
                              <span>Importar esta versão</span>
                            </button>
                          </div>

                          <div className="flex items-start gap-3">
                            {commentImg ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={String(commentImg)}
                                alt={comment.attachmentTitle || "Anexo"}
                                className="h-14 w-14 rounded-lg object-cover border border-purple-800/40 shrink-0"
                              />
                            ) : null}
                            <div className="min-w-0 flex-1">
                              <h4 className="text-xs font-bold text-gray-100">
                                {comment.attachmentTitle || "Versão Adaptada"}
                              </h4>
                              <p className="mt-0.5 text-xs text-gray-300 leading-relaxed">
                                {comment.content}
                              </p>
                              {payload && (payload.description || payload.damage || payload.rarity) ? (
                                <p className="mt-1 line-clamp-2 text-[11px] text-gray-400">
                                  {String(payload.description || payload.damage || payload.rarity)}
                                </p>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div key={comment.id} className="flex gap-3 py-3">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-800 text-xs font-semibold text-gray-400">
                          {cAuthor.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 text-xs">
                            <span className="font-semibold text-gray-200">{cAuthor}</span>
                            <span className="text-gray-600">·</span>
                            <span className="text-gray-500">
                              {new Date(comment.createdAt).toLocaleDateString("pt-BR", {
                                day: "2-digit",
                                month: "short",
                              })}
                            </span>
                          </div>
                          <p className="mt-1 text-xs text-gray-300 leading-relaxed whitespace-pre-wrap">
                            {comment.content}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </Modal.Body>
        </div>
      </Modal>
    </>
  );
}
