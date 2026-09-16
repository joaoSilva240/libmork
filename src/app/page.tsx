"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";

export default function HomePage() {
  const [hovered, setHovered] = useState<"player" | "master" | null>(null);

  return (
    <main
      onMouseLeave={() => setHovered(null)}
      className="relative flex h-screen w-full flex-col overflow-hidden bg-dominant-pure text-secondary-pure md:flex-row select-none"
    >
      {/* Lado do Jogador */}
      <Link
        href="/player"
        onMouseEnter={() => setHovered("player")}
        className={`group relative flex w-full items-center justify-center overflow-hidden border-b border-gray-300/80 md:border-b-0 md:border-r md:border-gray-300/80 transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] transform-gpu cursor-pointer ${
          hovered === "player"
            ? "h-[55%] md:h-full md:flex-[1.25]"
            : hovered === "master"
              ? "h-[45%] md:h-full md:flex-[0.95]"
              : "h-1/2 md:h-full md:flex-1"
        }`}
        aria-label="Acessar Frente do Jogador"
      >
        {/* Imagem de Fundo com zoom suave ao hover, desfoque e escurecimento quando o outro lado estiver em hover */}
        <div className="absolute inset-0 z-0">
          <Image
            src="/Wallpapers/Jogadores.jpg"
            alt="Frente do Jogador"
            fill
            priority
            sizes="(max-width: 768px) 100vw, 65vw"
            className={`object-cover object-center transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] will-change-transform transform-gpu group-hover:scale-110 group-hover:brightness-105 ${
              hovered === "master"
                ? "blur-[2px] brightness-75"
                : "blur-0 brightness-100"
            }`}
          />
        </div>

        {/* Camada de Gradiente / Overlay Atmosférico */}
        <div className="absolute inset-0 z-1 bg-gradient-to-t from-dominant-deep/90 via-dominant-pure/60 to-dominant-pure/40 transition-opacity duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:opacity-75 md:bg-gradient-to-r md:from-dominant-deep/85 md:via-dominant-pure/55 md:to-transparent" />
        
        {/* Efeito de iluminação / vignette azulada sutil para o Jogador */}
        <div className="absolute inset-0 z-2 bg-radial from-blue-950/20 via-transparent to-black/60 transition-colors duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:from-blue-900/30 group-hover:to-black/40" />

        {/* Conteúdo Centralizado */}
        <div className="relative z-10 flex flex-col items-center justify-center px-6 text-center transition-transform duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:-translate-y-1">
          <span className="mb-2 text-xs font-semibold tracking-[0.35em] uppercase text-blue-400/90 transition-colors duration-300 group-hover:text-blue-300 drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)]">
            Aventura &amp; Personagem
          </span>
          <h2 className="font-fantasy-title text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold tracking-widest text-secondary-pure drop-shadow-[0_4px_16px_rgba(0,0,0,0.95)] transition-all duration-300 group-hover:text-blue-100 group-hover:drop-shadow-[0_0_24px_rgba(96,165,250,0.45)]">
            Jogador
          </h2>
          <div className="mt-4 h-[2px] w-12 bg-blue-500/60 transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:w-24 group-hover:bg-blue-400" />
        </div>
      </Link>

      {/* Lado do Mestre */}
      <Link
        href="/master"
        onMouseEnter={() => setHovered("master")}
        className={`group relative flex w-full items-center justify-center overflow-hidden transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] transform-gpu cursor-pointer ${
          hovered === "master"
            ? "h-[55%] md:h-full md:flex-[1.25]"
            : hovered === "player"
              ? "h-[45%] md:h-full md:flex-[0.95]"
              : "h-1/2 md:h-full md:flex-1"
        }`}
        aria-label="Acessar Escudo do Mestre"
      >
        {/* Imagem de Fundo com zoom suave ao hover, desfoque e escurecimento quando o outro lado estiver em hover */}
        <div className="absolute inset-0 z-0">
          <Image
            src="/Wallpapers/Master.jpg"
            alt="Escudo do Mestre"
            fill
            priority
            sizes="(max-width: 768px) 100vw, 65vw"
            className={`object-cover object-center transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] will-change-transform transform-gpu group-hover:scale-110 group-hover:brightness-105 ${
              hovered === "player"
                ? "blur-[2px] brightness-75"
                : "blur-0 brightness-100"
            }`}
          />
        </div>

        {/* Camada de Gradiente / Overlay Atmosférico */}
        <div className="absolute inset-0 z-1 bg-gradient-to-t from-dominant-deep/90 via-dominant-pure/60 to-dominant-pure/40 transition-opacity duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:opacity-75 md:bg-gradient-to-l md:from-dominant-deep/85 md:via-dominant-pure/55 md:to-transparent" />
        
        {/* Efeito de iluminação / vignette arroxeada misteriosa para o Mestre */}
        <div className="absolute inset-0 z-2 bg-radial from-purple-950/25 via-transparent to-black/60 transition-colors duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:from-purple-900/35 group-hover:to-black/40" />

        {/* Conteúdo Centralizado */}
        <div className="relative z-10 flex flex-col items-center justify-center px-6 text-center transition-transform duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:-translate-y-1">
          <span className="mb-2 text-xs font-semibold tracking-[0.35em] uppercase text-purple-400/90 transition-colors duration-300 group-hover:text-purple-300 drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)]">
            Controle &amp; Narrativa
          </span>
          <h2 className="font-fantasy-title text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold tracking-widest text-secondary-pure drop-shadow-[0_4px_16px_rgba(0,0,0,0.95)] transition-all duration-300 group-hover:text-purple-100 group-hover:drop-shadow-[0_0_24px_rgba(192,132,252,0.45)]">
            Mestre
          </h2>
          <div className="mt-4 h-[2px] w-12 bg-purple-500/60 transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:w-24 group-hover:bg-purple-400" />
        </div>
      </Link>
    </main>
  );
}

