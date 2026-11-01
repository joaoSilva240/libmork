"use client";

import { useState, useEffect } from "react";

const CATEGORIES = [
  { value: "", label: "Todos" },
  { value: "spell", label: "Magias", icon: "🔮" },
  { value: "item", label: "Itens", icon: "⚔️" },
  { value: "class", label: "Classes", icon: "🛡️" },
  { value: "npc", label: "NPCs", icon: "👤" },
  { value: "world", label: "Mundos", icon: "🌍" },
  { value: "campaign", label: "Campanhas", icon: "🎲" },
];

type Filters = {
  type: string;
  search: string;
  sort: string;
};

type Props = {
  value: Filters;
  onChange: (filters: Filters) => void;
};

export default function CommunityFilters({ value, onChange }: Props) {
  const [search, setSearch] = useState(value.search);
  const [debounce, setDebounce] = useState<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (debounce) clearTimeout(debounce);
    const t = setTimeout(() => {
      onChange({ ...value, search });
    }, 400);
    setDebounce(t);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  return (
    <div className="flex flex-col gap-2.5 p-3">
      {/* Busca e Ordenação */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-gray-500">
            <svg
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          </span>
          <input
            type="text"
            placeholder="Buscar por palavras-chave ou tags..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-full border border-gray-800 bg-gray-900/80 py-1.5 pl-9 pr-4 text-xs text-gray-200 placeholder-gray-500 transition-colors focus:border-purple-500 focus:bg-gray-900 focus:outline-none"
          />
        </div>

        <select
          value={value.sort}
          onChange={(e) => onChange({ ...value, sort: e.target.value })}
          className="rounded-full border border-gray-800 bg-gray-900/80 px-3 py-1.5 text-xs text-gray-300 transition-colors focus:border-purple-500 focus:bg-gray-900 focus:outline-none cursor-pointer"
        >
          <option value="recent">Mais Recentes</option>
          <option value="popular">Mais Populares</option>
          <option value="cloned">Mais Clonados</option>
        </select>
      </div>

      {/* Categorias / Pills horizontais */}
      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
        {CATEGORIES.map((cat) => {
          const isActive = value.type === cat.value;
          return (
            <button
              key={cat.value}
              onClick={() => onChange({ ...value, type: cat.value })}
              className={`flex shrink-0 items-center gap-1 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                isActive
                  ? "bg-purple-600 text-white"
                  : "bg-gray-900/90 text-gray-400 hover:bg-gray-800 hover:text-gray-200 border border-gray-800"
              }`}
            >
              {cat.icon && <span className="text-[11px]">{cat.icon}</span>}
              <span>{cat.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
