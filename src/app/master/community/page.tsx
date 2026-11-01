"use client";

import CommunityFeed from "@/components/community/CommunityFeed";

export default function MasterCommunityPage() {
  return (
    <div className="flex flex-col flex-1 h-full min-h-0 overflow-hidden">
      {/* Cabeçalho */}
      <header className="mb-4 shrink-0 border-b border-gray-800 pb-3">
        <div className="flex items-center gap-3">
          <span className="text-2xl">🌐</span>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-gray-100">
              Comunidade do Mestre
            </h1>
            <p className="text-xs text-gray-400">
              Explore, compartilhe e importe criações (magias, itens, classes, NPCs e mundos) da comunidade de mestres.
            </p>
          </div>
        </div>
      </header>

      {/* Feed da Comunidade */}
      <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
        <CommunityFeed />
      </div>
    </div>
  );
}
