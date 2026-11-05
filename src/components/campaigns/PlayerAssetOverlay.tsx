"use client";

import React, { useState, useEffect, useRef } from "react";
import { useSocket } from "@/context/SocketContext";

const CATEGORY_CONFIG: Record<
  string,
  { label: string; icon: string; badgeClass: string }
> = {
  handout: {
    label: "Handout",
    icon: "📜",
    badgeClass: "bg-amber-950/80 text-amber-300 border-amber-700/60",
  },
  map: {
    label: "Mapa",
    icon: "🗺️",
    badgeClass: "bg-blue-950/80 text-blue-300 border-blue-700/60",
  },
  illustration: {
    label: "Ilustração",
    icon: "🎨",
    badgeClass: "bg-purple-950/80 text-purple-300 border-purple-700/60",
  },
  scene: {
    label: "Cena",
    icon: "🎬",
    badgeClass: "bg-rose-950/80 text-rose-300 border-rose-700/60",
  },
  token: {
    label: "Token",
    icon: "🪙",
    badgeClass: "bg-emerald-950/80 text-emerald-300 border-emerald-700/60",
  },
};

export function PlayerAssetOverlay() {
  const { activeAsset } = useSocket() || {};
  const [isMinimized, setIsMinimized] = useState<boolean>(false);
  const prevAssetIdRef = useRef<string | null>(null);

  // Sempre que um novo asset for ativado, reabre o overlay completo para o jogador
  useEffect(() => {
    if (activeAsset) {
      if (prevAssetIdRef.current !== activeAsset.id) {
        setIsMinimized(false);
        prevAssetIdRef.current = activeAsset.id;
      }
    } else {
      prevAssetIdRef.current = null;
      setIsMinimized(false);
    }
  }, [activeAsset]);

  if (!activeAsset) {
    return null;
  }

  const categoryInfo =
    CATEGORY_CONFIG[activeAsset.category] || {
      label: activeAsset.category || "Handout",
      icon: "🖼️",
      badgeClass: "bg-gray-800 text-gray-200 border-gray-700",
    };

  // Se minimizado: renderiza o chip flutuante fixo no canto inferior direito
  if (isMinimized) {
    return (
      <aside
        aria-label={`Handout Ativo: ${activeAsset.name}`}
        className="fixed bottom-6 right-6 z-40 flex items-center gap-3 rounded-full border border-purple-500/50 bg-gray-950/90 p-2 pr-4 shadow-2xl backdrop-blur-md transition-all hover:border-purple-400 select-none animate-in fade-in slide-in-from-bottom-2 duration-200"
      >
        <div
          onClick={() => setIsMinimized(false)}
          className="flex items-center gap-3 text-left cursor-pointer"
        >
          {/* Miniatura do Asset */}
          <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full border border-purple-400/40 bg-gray-900 shadow-inner">
            {activeAsset.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={activeAsset.imageUrl}
                alt={activeAsset.name}
                className="h-full w-full object-cover"
              />
            ) : (
              <span className="flex h-full w-full items-center justify-center text-sm">
                {categoryInfo.icon}
              </span>
            )}
          </div>

          {/* Textos Informativos */}
          <div className="flex flex-col min-w-0 pr-1">
            <div className="flex items-center gap-1.5">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
              <span className="text-[10px] font-bold tracking-wider uppercase text-emerald-400">
                Ao Vivo / Mestre Compartilhou
              </span>
            </div>
            <p className="text-xs font-semibold text-white truncate max-w-[200px]">
              Handout Ativo: {activeAsset.name}
            </p>
          </div>
        </div>

        {/* Botão Expandir */}
        <button
          type="button"
          onClick={() => setIsMinimized(false)}
          aria-label="Expandir"
          className="rounded-lg bg-purple-600/80 px-2.5 py-1 text-xs font-bold text-white hover:bg-purple-500 transition shadow shrink-0"
        >
          Expandir
        </button>
      </aside>
    );
  }

  // Quando aberto (não minimizado)
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Handout compartilhado: ${activeAsset.name}`}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
    >
      <div className="relative flex flex-col w-full max-w-4xl max-h-[90vh] overflow-hidden rounded-2xl border border-purple-500/30 bg-gray-950/95 text-gray-100 shadow-2xl">
        {/* Cabeçalho */}
        <div className="flex items-center justify-between border-b border-gray-800 bg-gray-900/90 px-5 py-3.5">
          <div className="flex items-center gap-3 min-w-0 pr-3">
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border text-xs font-bold uppercase tracking-wider ${categoryInfo.badgeClass}`}
            >
              <span>{categoryInfo.icon}</span>
              <span>{categoryInfo.label}</span>
            </span>

            <h2 className="text-base sm:text-lg font-bold text-white truncate">
              {activeAsset.name}
            </h2>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Botão Minimizar */}
            <button
              type="button"
              onClick={() => setIsMinimized(true)}
              aria-label="Minimizar asset"
              title="Minimizar para chip flutuante"
              className="flex items-center gap-1 rounded-lg border border-gray-700 bg-gray-800/80 px-2.5 py-1.5 text-xs font-medium text-gray-300 hover:bg-gray-700 hover:text-white transition"
            >
              <svg
                className="h-3.5 w-3.5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              <span className="hidden sm:inline">Minimizar</span>
            </button>

            {/* Botão Fechar / Ocultar (minimiza para o chip) */}
            <button
              type="button"
              onClick={() => setIsMinimized(true)}
              aria-label="Fechar overlay"
              title="Fechar (permanece disponível no chip flutuante)"
              className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-800 hover:text-white transition"
            >
              <span className="sr-only">Fechar</span>
              <svg
                className="h-5 w-5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </div>

        {/* Conteúdo com Imagem e Descrição */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 flex flex-col items-center">
          <div className="w-full flex justify-center bg-black/40 rounded-xl p-2 border border-gray-900">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={activeAsset.imageUrl}
              alt={activeAsset.name}
              className="max-h-[65vh] w-auto max-w-full object-contain rounded-lg shadow-2xl mx-auto"
            />
          </div>

          {activeAsset.description && (
            <div className="w-full max-w-3xl rounded-xl border border-gray-800/80 bg-gray-900/60 p-4 text-xs sm:text-sm text-gray-300 leading-relaxed">
              <p className="whitespace-pre-wrap">{activeAsset.description}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
