"use client";

import React from "react";

export const TOME_DEFAULT_URL = "http://100.122.171.83:8080";

export type TomeViewport = "desktop" | "mobile";

export interface TomeViewerProps {
  onClose?: () => void;
  url?: string;
  className?: string;
  viewport?: TomeViewport;
}

/**
 * Largura padrão do viewport mobile do Tome (390px).
 * O gutter extra de 20px no wrapper e no iframe empurra a barra de rolagem nativa
 * do documento interno (cross-origin, inacessível via CSS do pai) para fora da viewport
 * visível, que é recortada de forma limpa pelo container com overflow-hidden.
 */
const SCROLLBAR_GUTTER_PX = 20;

export function TomeViewer({
  url = TOME_DEFAULT_URL,
  className = "",
  viewport = "desktop",
}: TomeViewerProps) {
  if (viewport === "mobile") {
    return (
      <div
        data-testid="tome-inline-viewer"
        className={`relative w-full h-full min-h-0 flex-1 flex justify-center bg-gray-950 touch-auto scrollbar-hide ${className}`}
      >
        {/* 
          Container de recorte (viewport clip wrapper):
          Possui exatamente a largura visível pretendida (min(390px, 100%)),
          com overflow: hidden para recortar qualquer scrollbar lateral nativa
          gerada pelo iframe cross-origin.
        */}
        <div
          data-testid="tome-clip-wrapper"
          style={{
            width: "min(390px, 100%)",
            maxWidth: "100%",
          }}
          className="relative h-full min-h-0 overflow-hidden border-y-0 border-x border-gray-800/60 bg-gray-950 shadow-2xl touch-auto"
        >
          <iframe
            src={url}
            title="Visualizador Tome"
            scrolling="no"
            style={{
              width: `calc(100% + ${SCROLLBAR_GUTTER_PX}px)`,
              height: "100%",
              scrollbarWidth: "none",
              msOverflowStyle: "none",
            }}
            className="h-full min-h-0 border-0 bg-gray-950 touch-auto pointer-events-auto scrollbar-hide"
            allow="fullscreen; autoplay; clipboard-read; clipboard-write; display-capture"
            loading="eager"
          />
        </div>
      </div>
    );
  }

  return (
    <div
      data-testid="tome-inline-viewer"
      className={`relative w-full h-full min-h-0 flex-1 bg-gray-950 ${className}`}
    >
      <iframe
        src={url}
        title="Visualizador Tome"
        style={{
          width: "100%",
          height: "100%",
        }}
        className="w-full h-full min-h-0 border-0 bg-gray-950 pointer-events-auto"
        allow="fullscreen; autoplay; clipboard-read; clipboard-write; display-capture"
        loading="eager"
      />
    </div>
  );
}


