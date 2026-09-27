"use client";

import React, { useEffect, useState, useCallback } from "react";
import { Spinner } from "@/components/ui";
import { useSocket } from "@/context/SocketContext";

export interface MarketplaceOverlayProps {
  campaignId?: string;
  characterId?: string;
}

export interface InventoryItem {
  id: string;
  name: string;
  description?: string | null;
  contentType: string;
  priceGold: number;
  stock: number;
  establishmentName?: string;
}

export function MarketplaceOverlay({ campaignId, characterId }: MarketplaceOverlayProps) {
  const { socket } = useSocket();
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(true);
  const [openEstablishments, setOpenEstablishments] = useState<Array<{ id: string; name: string; worldId: string }>>([]);
  const [catalog, setCatalog] = useState<InventoryItem[]>([]);
  const [isLoadingCatalog, setIsLoadingCatalog] = useState(false);
  const [isBuying, setIsBuying] = useState<string | null>(null);
  const [message, setMessage] = useState<{ text: string; isError?: boolean } | null>(null);

  // Busca inicial de estabelecimentos abertos
  const checkOpenEstablishments = useCallback(async () => {
    if (!campaignId) return;
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/worlds`, { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        const worlds = data.data || [];
        const openEsts: Array<{ id: string; name: string; worldId: string }> = [];
        for (const world of worlds) {
          const estRes = await fetch(`/api/worlds/${world.id}/establishments`, { credentials: "include" });
          if (estRes.ok) {
            const estData = await estRes.json();
            const estList = (estData.data || []).filter((e: any) => e.isOpen);
            for (const openEst of estList) {
              openEsts.push({ id: openEst.id, name: openEst.name, worldId: world.id });
            }
          }
        }
        if (openEsts.length > 0) {
          setOpenEstablishments(openEsts);
          setIsOpen(true);
        } else {
          setOpenEstablishments([]);
          setIsOpen(false);
        }
      }
    } catch {
      // Ignora erro inicial
    }
  }, [campaignId]);

  useEffect(() => {
    checkOpenEstablishments();
  }, [checkOpenEstablishments]);

  // Escuta WebSocket
  useEffect(() => {
    if (!socket || !campaignId) return;

    const handleStatus = (payload: { campaignId: string; establishment: { id: string; name: string; worldId?: string }; isOpen: boolean }) => {
      if (payload.campaignId === campaignId) {
        setOpenEstablishments((prev) => {
          let updated: Array<{ id: string; name: string; worldId: string }>;
          if (payload.isOpen) {
            const exists = prev.some((e) => e.id === payload.establishment.id);
            if (exists) {
              updated = prev;
            } else {
              updated = [
                ...prev,
                {
                  id: payload.establishment.id,
                  name: payload.establishment.name,
                  worldId: payload.establishment.worldId || "",
                },
              ];
            }
          } else {
            updated = prev.filter((e) => e.id !== payload.establishment.id);
          }

          if (updated.length > 0) {
            setIsOpen(true);
          } else {
            setIsOpen(false);
          }

          return updated;
        });
      }
    };

    socket.on("establishment-status-updated", handleStatus);
    return () => {
      socket.off("establishment-status-updated", handleStatus);
    };
  }, [socket, campaignId]);

  // Carrega inventário de todos os estabelecimentos abertos
  useEffect(() => {
    if (openEstablishments.length === 0) {
      setCatalog([]);
      return;
    }

    async function loadCatalog() {
      setIsLoadingCatalog(true);
      try {
        const results = await Promise.all(
          openEstablishments.map(async (est) => {
            const res = await fetch(
              `/api/worlds/${est.worldId || "dummy"}/establishments/${est.id}/inventory`,
              { credentials: "include" }
            );
            if (res.ok) {
              const data = await res.json();
              const items: InventoryItem[] = (data.data || []).map((item: InventoryItem) => ({
                ...item,
                establishmentName: est.name,
              }));
              return items;
            }
            return [];
          })
        );
        const unifiedCatalog = results.flat();
        setCatalog(unifiedCatalog);
      } catch {
        // Ignora erro
      } finally {
        setIsLoadingCatalog(false);
      }
    }

    loadCatalog();
  }, [openEstablishments]);

  const handleBuy = async (item: InventoryItem) => {
    if (!characterId || !campaignId) return;
    setIsBuying(item.id);
    setMessage(null);

    try {
      const res = await fetch(`/api/campaigns/${campaignId}/establishments/buy`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ characterId, inventoryItemId: item.id }),
      });

      const data = await res.json();
      if (!res.ok) {
        setMessage({ text: data.error || "Erro ao efetuar compra.", isError: true });
        return;
      }

      setMessage({ text: data.message || `Item "${item.name}" comprado!` });
    } catch {
      setMessage({ text: "Erro de conexão ao comprar.", isError: true });
    } finally {
      setIsBuying(null);
    }
  };

  if (!isOpen || openEstablishments.length === 0) return null;

  const getMarketTitle = () => {
    if (openEstablishments.length === 1) {
      return openEstablishments[0].name;
    }
    if (openEstablishments.length <= 3) {
      return openEstablishments.map((e) => e.name).join(", ");
    }
    return `Mercados (${openEstablishments.length})`;
  };

  if (isMinimized) {
    return (
      <div className="fixed top-4 right-4 z-50">
        <button
          type="button"
          onClick={() => setIsMinimized(false)}
          className="border border-emerald-500/30 bg-gray-900/90 text-xs text-gray-200 px-3.5 py-1.5 rounded-full shadow-lg backdrop-blur-md hover:bg-gray-800 transition-all flex items-center gap-2"
        >
          <span className="h-2 w-2 rounded-full bg-emerald-500 shrink-0" />
          <span>Mercado: {getMarketTitle()}</span>
        </button>
      </div>
    );
  }

  return (
    <div className="fixed top-4 left-4 right-4 sm:left-auto sm:right-4 sm:w-80 max-h-[85vh] z-50 flex flex-col rounded-2xl border border-gray-800 bg-gray-950/95 p-4 shadow-2xl backdrop-blur-md text-white animate-in fade-in slide-in-from-top-2">
      <div className="flex items-center justify-between border-b border-gray-800 pb-2 mb-3 shrink-0">
        <h3 className="font-bold text-sm text-purple-400 flex items-center gap-2 truncate pr-2">
          <span>🏬</span> <span className="truncate">{getMarketTitle()}</span> <span className="text-[10px] text-emerald-400 shrink-0">(Aberto)</span>
        </h3>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setIsMinimized(true)}
            className="text-xs text-gray-400 hover:text-white"
            title="Minimizar"
          >
            ➖
          </button>
          <button
            type="button"
            onClick={() => setIsMinimized(true)}
            className="text-xs text-gray-400 hover:text-white"
            title="Fechar"
          >
            ✕
          </button>
        </div>
      </div>

      {message && (
        <div
          className={`mb-3 rounded-lg border p-2 text-xs font-semibold shrink-0 ${
            message.isError
              ? "border-red-800 bg-red-950/60 text-red-300"
              : "border-emerald-800 bg-emerald-950/60 text-emerald-300"
          }`}
        >
          {message.text}
        </div>
      )}

      {isLoadingCatalog ? (
        <div className="flex justify-center py-4">
          <Spinner size="sm" />
        </div>
      ) : catalog.length === 0 ? (
        <p className="text-xs text-gray-400 py-2 italic text-center">Nenhum produto à venda no momento.</p>
      ) : (
        <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1">
          {catalog.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between rounded-xl border border-gray-800 bg-gray-900/80 p-2 text-xs gap-2"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 flex-wrap">
                  {item.establishmentName && (
                    <span className="rounded bg-purple-950/80 border border-purple-800/80 px-1.5 py-0.5 text-[9px] font-bold text-purple-300 shrink-0">
                      [{item.establishmentName}]
                    </span>
                  )}
                  <span className="font-bold text-white truncate">{item.name}</span>
                </div>
                <span className="text-[10px] text-amber-400 font-semibold block mt-0.5">
                  🪙 {item.priceGold} Ouro
                </span>
              </div>
              <button
                type="button"
                onClick={() => handleBuy(item)}
                disabled={isBuying === item.id || item.stock === 0}
                className="rounded-lg bg-purple-600 px-3 py-1 text-[11px] font-bold text-white hover:bg-purple-500 disabled:opacity-50 shrink-0"
              >
                {isBuying === item.id ? <Spinner size="sm" /> : item.stock === 0 ? "Esgotado" : "Comprar"}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
