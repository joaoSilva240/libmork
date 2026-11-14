"use client";

import React, { useEffect, useState } from "react";
import { MessageSquare } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import type { SharePayload } from "@/lib/server/chat-service";
import PostDetailModal from "@/components/community/PostDetailModal";
import type { CommunityPost } from "@/components/community/CommunityCard";
import { CONTENT_LABELS } from "@/lib/validators/content";
import type { ContentType } from "@/lib/validators/content";

type ShareDetailModalProps = {
  payload: SharePayload;
  currentUserId: string;
  onClose: () => void;
  onStartDm?: (userId: string) => void;
};

type CharacterOption = {
  id: string;
  name: string;
};

export function ShareDetailModal({
  payload,
  currentUserId,
  onClose,
  onStartDm,
}: ShareDetailModalProps) {
  if (payload.kind === "post") {
    const s = payload.snapshot;
    const post: CommunityPost = {
      id: s.postId,
      authorId: s.authorId,
      title: s.title,
      description: s.description,
      contentType: s.contentType,
      tags: s.tags,
      payload: s.payload,
      clonesCount: 0,
      createdAt: "",
      updatedAt: "",
      author: { id: s.authorId, displayName: s.authorName },
      likesCount: 0,
      commentsCount: 0,
      isLikedByMe: false,
    };
    return <PostDetailModal post={post} onClose={onClose} />;
  }

  return (
    <GenericShareModal
      payload={payload}
      currentUserId={currentUserId}
      onClose={onClose}
      onStartDm={onStartDm}
    />
  );
}

function GenericShareModal({
  payload,
  currentUserId,
  onClose,
  onStartDm,
}: Omit<ShareDetailModalProps, "payload"> & {
  payload: Exclude<SharePayload, { kind: "post" }>;
}) {
  const [characters, setCharacters] = useState<CharacterOption[]>([]);
  const [selectedCharacterId, setSelectedCharacterId] = useState("");
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [joinSuccess, setJoinSuccess] = useState<string | null>(null);

  const isCampaign = payload.kind === "campaign";

  useEffect(() => {
    if (!isCampaign) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/characters", { credentials: "include" });
        const data = (await res.json()) as { data?: CharacterOption[] } | CharacterOption[];
        const list = Array.isArray(data) ? data : (data.data ?? []);
        if (!cancelled) {
          setCharacters(list);
          if (list.length > 0) setSelectedCharacterId(list[0].id);
        }
      } catch {
        if (!cancelled) setJoinError("Não foi possível carregar seus personagens");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isCampaign]);

  const handleJoinCampaign = async (inviteToken: string) => {
    if (!selectedCharacterId) {
      setJoinError("Selecione um personagem para entrar na campanha");
      return;
    }
    setJoining(true);
    setJoinError(null);
    try {
      const res = await fetch(`/api/invites/${inviteToken}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ characterId: selectedCharacterId }),
        credentials: "include",
      });
      const data = (await res.json()) as { success?: boolean; error?: string };
      if (res.ok && data.success) {
        setJoinSuccess("Você entrou na campanha!");
        onClose();
      } else {
        setJoinError(data.error ?? "Não foi possível entrar na campanha");
      }
    } catch {
      setJoinError("Não foi possível entrar na campanha");
    } finally {
      setJoining(false);
    }
  };

  return (
    <Modal
      isOpen
      onClose={onClose}
      className="mx-auto max-w-md w-full bg-secondary-card border border-secondary-border rounded-2xl p-5 shadow-2xl"
      aria-label="Detalhes do conteúdo compartilhado"
    >
      {payload.kind === "profile" && (
        <div className="flex flex-col items-center gap-3 text-center">
          {payload.snapshot.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={payload.snapshot.avatarUrl}
              alt={payload.snapshot.displayName}
              className="h-20 w-20 rounded-full object-cover border border-secondary-border"
            />
          ) : (
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-dominant-deep border border-secondary-border text-2xl font-bold text-accent">
              {payload.snapshot.displayName.charAt(0).toUpperCase()}
            </div>
          )}
          <h3 className="text-base font-bold text-secondary-pure">
            {payload.snapshot.displayName}
          </h3>
          {payload.snapshot.bio && (
            <p className="text-xs leading-relaxed text-secondary-muted">{payload.snapshot.bio}</p>
          )}
          {payload.snapshot.userId !== currentUserId && onStartDm && (
            <button
              type="button"
              data-testid="start-dm-from-card"
              onClick={() => {
                onStartDm(payload.snapshot.userId);
                onClose();
              }}
              className="mt-2 flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-xs font-bold text-dominant-deep transition-opacity hover:opacity-90 cursor-pointer"
            >
              <MessageSquare className="h-4 w-4" />
              Iniciar chat
            </button>
          )}
        </div>
      )}

      {payload.kind === "library_item" && (
        <div className="flex flex-col gap-3">
          {payload.snapshot.imageUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={payload.snapshot.imageUrl}
              alt={payload.snapshot.name}
              className="max-h-48 w-full rounded-lg object-cover border border-secondary-border"
            />
          )}
          <div className="flex items-center gap-2">
            <h3 className="text-base font-bold text-secondary-pure">{payload.snapshot.name}</h3>
            <span className="rounded-full border border-accent/40 bg-accent/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-accent">
              {CONTENT_LABELS[payload.snapshot.contentType as ContentType] ??
                payload.snapshot.contentType}
            </span>
          </div>
          {payload.snapshot.description && (
            <p className="text-xs leading-relaxed text-secondary-muted">
              {payload.snapshot.description}
            </p>
          )}
        </div>
      )}

      {payload.kind === "campaign" && (
        <div className="flex flex-col gap-3">
          {payload.snapshot.coverImageUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={payload.snapshot.coverImageUrl}
              alt={payload.snapshot.name}
              className="max-h-40 w-full rounded-lg object-cover border border-secondary-border"
            />
          )}
          <h3 className="text-base font-bold text-secondary-pure">{payload.snapshot.name}</h3>
          <p className="text-xs text-secondary-muted">Mestre: {payload.snapshot.masterName}</p>

          <label htmlFor="share-campaign-character" className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-secondary-pure">Seu personagem</span>
            <select
              id="share-campaign-character"
              value={selectedCharacterId}
              onChange={(e) => setSelectedCharacterId(e.target.value)}
              className="rounded-lg border border-secondary-border bg-secondary-input px-3 py-2 text-sm text-secondary-pure focus:outline-none focus:ring-2 focus:ring-accent"
            >
              {characters.length === 0 && <option value="">Nenhum personagem disponível</option>}
              {characters.map((character) => (
                <option key={character.id} value={character.id}>
                  {character.name}
                </option>
              ))}
            </select>
          </label>

          {joinError && (
            <p data-testid="join-campaign-error" className="text-xs font-medium text-red-400">
              {joinError}
            </p>
          )}
          {joinSuccess && <p className="text-xs font-medium text-accent">{joinSuccess}</p>}

          <button
            type="button"
            data-testid="join-campaign-button"
            disabled={joining || characters.length === 0}
            onClick={() => void handleJoinCampaign(payload.snapshot.inviteToken)}
            className="mt-1 rounded-lg bg-accent px-4 py-2 text-xs font-bold text-dominant-deep transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
          >
            {joining ? "Entrando..." : "Entrar na campanha"}
          </button>
        </div>
      )}
    </Modal>
  );
}
