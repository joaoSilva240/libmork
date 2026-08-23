"use client";

import { useState } from "react";
import { ContentManager } from "@/components/content/ContentManager";
import { LibraryNpcs } from "@/components/npcs/LibraryNpcs";

const TABS = [
  { key: "content", label: "Conteúdo" },
  { key: "npcs", label: "NPCs" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

export default function LibraryPage() {
  const [activeTab, setActiveTab] = useState<TabKey>("content");

  return (
    <div>
      <div className="mb-6 flex flex-wrap gap-2">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === tab.key
                ? "bg-purple-600 text-white"
                : "bg-gray-800 text-gray-300 hover:bg-gray-700"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "content" ? (
        <ContentManager basePath="/api/content" title="Biblioteca Global" />
      ) : (
        <LibraryNpcs />
      )}
    </div>
  );
}
