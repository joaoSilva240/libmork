"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Package, Globe2, Map, Search, Share2 } from "lucide-react";
import type { ShareCatalog } from "@/lib/server/chat-service";
import type { ShareInput } from "@/lib/validators/chat";
import { CONTENT_LABELS } from "@/lib/validators/content";
import type { ContentType } from "@/lib/validators/content";

type SharePickerTab = "library" | "posts" | "campaigns";

type LibrarySearchItem = {
  id: string;
  name: string;
  contentType: string;
  description: string | null;
  imageUrl: string | null;
};

const LIBRARY_SEARCH_MIN_CHARS = 3;

type SharePickerModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onPick: (share: ShareInput, label: string) => void;
};

const TAB_CONFIG: { id: SharePickerTab; label: string; Icon: typeof Package }[] = [
  { id: "library", label: "Biblioteca", Icon: Package },
  { id: "posts", label: "Publicações", Icon: Globe2 },
  { id: "campaigns", label: "Campanhas", Icon: Map },
];

function shortDescription(description: string | null): string | null {
  if (!description) return null;
  return description.length > 80 ? `${description.slice(0, 80)}…` : description;
}

export function SharePickerModal({ isOpen, onClose, onPick }: SharePickerModalProps) {
  const [tab, setTab] = useState<SharePickerTab>("library");
  const [catalog, setCatalog] = useState<ShareCatalog | null>(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [libraryResults, setLibraryResults] = useState<LibrarySearchItem[]>([]);
  const [libraryLoading, setLibraryLoading] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;

    const loadCatalog = async () => {
      try {
        const res = await fetch("/api/chat/share-catalog", { credentials: "include" });
        const body = (await res.json()) as {
          success?: boolean;
          data?: ShareCatalog;
          error?: string;
        };
        if (cancelled) return;
        if (!res.ok || !body.success || !body.data) {
          setError(body.error || "Não foi possível carregar o catálogo");
          setLoading(false);
          return;
        }
        setCatalog(body.data);
        setError(null);
        setLoading(false);
      } catch {
        if (cancelled) return;
        setError("Não foi possível carregar o catálogo");
        setLoading(false);
      }
    };

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    setError(null);
    void loadCatalog();

    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  const query = search.trim().toLowerCase();
  const libraryQuery = search.trim();

  // Busca na biblioteca global sob demanda (mín. 3 caracteres, com debounce)
  useEffect(() => {
    if (!isOpen || tab !== "library") return;
    if (libraryQuery.length < LIBRARY_SEARCH_MIN_CHARS) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLibraryResults([]);
      setLibraryLoading(false);
      return;
    }

    let cancelled = false;
    const timeout = setTimeout(() => {
      void (async () => {
        setLibraryLoading(true);
        try {
          const res = await fetch(`/api/chat/search?q=${encodeURIComponent(libraryQuery)}`, {
            credentials: "include",
          });
          const body = (await res.json()) as {
            success?: boolean;
            data?: { users?: unknown[]; libraryItems?: LibrarySearchItem[] };
          };
          if (cancelled) return;
          setLibraryResults(body.data?.libraryItems ?? []);
        } catch {
          if (!cancelled) setLibraryResults([]);
        } finally {
          if (!cancelled) setLibraryLoading(false);
        }
      })();
    }, 300);

    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [isOpen, tab, libraryQuery]);

  const filteredPosts = useMemo(() => {
    if (!catalog) return [];
    return query
      ? catalog.posts.filter((post) => post.title.toLowerCase().includes(query))
      : catalog.posts;
  }, [catalog, query]);

  const filteredCampaigns = useMemo(() => {
    if (!catalog) return [];
    return query
      ? catalog.campaigns.filter((campaign) => campaign.name.toLowerCase().includes(query))
      : catalog.campaigns;
  }, [catalog, query]);

  const pickLibraryItem = (item: LibrarySearchItem) => {
    onPick(
      {
        kind: "library_item",
        id: item.id,
        contentType: item.contentType as ShareInput["contentType"],
      },
      item.name,
    );
    onClose();
  };

  const pickPost = (id: string, title: string) => {
    onPick({ kind: "post", id }, title);
    onClose();
  };

  const pickCampaign = (id: string, name: string) => {
    onPick({ kind: "campaign", id }, name);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      ariaLabel="Compartilhar conteúdo"
      className="max-w-md bg-secondary-card border border-secondary-border rounded-xl"
    >
      <Modal.Header className="flex items-center justify-between border-b border-secondary-border p-4">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/20 text-accent">
            <Share2 className="h-4 w-4" />
          </div>
          <h3 className="text-base font-bold text-secondary-pure">Compartilhar</h3>
        </div>
        <Modal.CloseButton />
      </Modal.Header>

      <div className="flex items-center gap-1 border-b border-secondary-border px-4 pt-3">
        {TAB_CONFIG.map(({ id, label, Icon }) => (
          <button
            key={id}
            type="button"
            data-testid={`share-tab-${id}`}
            onClick={() => setTab(id)}
            className={`flex items-center gap-1.5 rounded-t-lg border-b-2 px-3 py-2 text-xs font-semibold transition-colors cursor-pointer ${
              tab === id
                ? "border-accent text-accent"
                : "border-transparent text-secondary-muted hover:text-secondary-pure"
            }`}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </button>
        ))}
      </div>

      <Modal.Body className="flex flex-col gap-3 p-4 overflow-y-auto max-h-[60vh]">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-secondary-muted" />
          <input
            type="text"
            data-testid="share-search-input"
            placeholder="Buscar..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-secondary-border bg-secondary-input py-2 pl-9 pr-3 text-xs text-secondary-pure placeholder:text-secondary-muted focus:outline-none focus:ring-2 focus:ring-accent"
          />
        </div>

        {error && (
          <div className="rounded-lg bg-red-950/80 border border-red-800 p-2.5 text-xs text-red-300">
            {error}
          </div>
        )}

        {loading && (
          <p className="py-6 text-center text-xs text-secondary-muted">Carregando catálogo...</p>
        )}

        {!loading && !error && tab === "library" && (
          <>
            {libraryQuery.length < LIBRARY_SEARCH_MIN_CHARS ? (
              <p className="py-6 text-center text-xs text-secondary-muted">
                Digite ao menos {LIBRARY_SEARCH_MIN_CHARS} caracteres para buscar na biblioteca.
              </p>
            ) : libraryLoading ? (
              <p className="py-6 text-center text-xs text-secondary-muted">Buscando itens...</p>
            ) : libraryResults.length === 0 ? (
              <p className="py-6 text-center text-xs text-secondary-muted">
                Nenhum item encontrado.
              </p>
            ) : (
              libraryResults.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  data-testid={`share-item-${item.id}`}
                  onClick={() => pickLibraryItem(item)}
                  className="flex items-center gap-3 rounded-lg border border-secondary-border bg-secondary-input/60 p-2.5 text-left transition-colors hover:border-accent cursor-pointer"
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-md border border-secondary-border bg-dominant-deep">
                    {item.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={item.imageUrl} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <Package className="h-4 w-4 text-accent" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-bold text-secondary-pure">{item.name}</p>
                    {shortDescription(item.description) && (
                      <p className="truncate text-[10px] text-secondary-muted">
                        {shortDescription(item.description)}
                      </p>
                    )}
                  </div>
                  <span className="ml-auto shrink-0 rounded bg-accent/20 px-1 text-[9px] font-bold text-accent">
                    {CONTENT_LABELS[item.contentType as ContentType] ?? item.contentType}
                  </span>
                </button>
              ))
            )}
          </>
        )}

        {!loading && !error && tab === "posts" && (
          <>
            {filteredPosts.length === 0 && (
              <p className="py-6 text-center text-xs text-secondary-muted">
                Nenhuma publicação encontrada.
              </p>
            )}
            {filteredPosts.map((post) => (
              <button
                key={post.id}
                type="button"
                data-testid={`share-post-${post.id}`}
                onClick={() => pickPost(post.id, post.title)}
                className="flex items-center gap-3 rounded-lg border border-secondary-border bg-secondary-input/60 p-2.5 text-left transition-colors hover:border-accent cursor-pointer"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-secondary-border bg-dominant-deep">
                  <Globe2 className="h-4 w-4 text-accent" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-bold text-secondary-pure">{post.title}</p>
                  <p className="truncate text-[10px] text-secondary-muted">Por {post.authorName}</p>
                </div>
              </button>
            ))}
          </>
        )}

        {!loading && !error && tab === "campaigns" && (
          <>
            {filteredCampaigns.length === 0 && (
              <p className="py-6 text-center text-xs text-secondary-muted">
                {catalog && catalog.campaigns.length === 0
                  ? "Você não é mestre de nenhuma campanha"
                  : "Nenhuma campanha encontrada."}
              </p>
            )}
            {filteredCampaigns.map((campaign) => (
              <button
                key={campaign.id}
                type="button"
                data-testid={`share-campaign-${campaign.id}`}
                onClick={() => pickCampaign(campaign.id, campaign.name)}
                className="flex items-center gap-3 rounded-lg border border-secondary-border bg-secondary-input/60 p-2.5 text-left transition-colors hover:border-accent cursor-pointer"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-md border border-secondary-border bg-dominant-deep">
                  {campaign.coverImageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={campaign.coverImageUrl}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span className="text-xs font-bold text-accent">
                      {campaign.name.charAt(0).toUpperCase()}
                    </span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-bold text-secondary-pure">{campaign.name}</p>
                </div>
              </button>
            ))}
          </>
        )}
      </Modal.Body>
    </Modal>
  );
}
