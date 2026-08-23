"use client";

import { useState } from "react";
import { ContentManager } from "@/components/content/ContentManager";

type ContentOverlayProps = {
  campaignId: string;
  onClose: () => void;
};

type ContentTab = "skills" | "spells" | "items" | "conditions";

export function ContentOverlay({ campaignId, onClose }: ContentOverlayProps) {
  const [activeTab, setActiveTab] = useState<ContentTab>("skills");

  const tabs: { key: ContentTab; label: string }[] = [
    { key: "skills", label: "Perícias" },
    { key: "spells", label: "Magias" },
    { key: "items", label: "Itens" },
    { key: "conditions", label: "Condições" },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-3"
      onClick={onClose}
    >
      <div
        className="w-full max-w-6xl rounded-xl border border-gray-800 bg-gray-900 p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-bold text-white">Gerenciar Conteúdo</h2>
          <button
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-sm text-gray-400 hover:text-white"
          >
            ✕
          </button>
        </div>

        <div className="mb-4 flex gap-2 border-b border-gray-800 pb-2">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors ${
                activeTab === tab.key
                  ? "bg-purple-600 text-white"
                  : "bg-gray-800 text-gray-300 hover:bg-gray-700"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="max-h-[70vh] overflow-y-auto">
          {activeTab === "skills" && (
            <ContentManager basePath={`/api/campaigns/${campaignId}/content`} title="Perícias" />
          )}
          {activeTab === "spells" && (
            <ContentManager basePath={`/api/campaigns/${campaignId}/content`} title="Magias" />
          )}
          {activeTab === "items" && (
            <ContentManager basePath={`/api/campaigns/${campaignId}/content`} title="Itens" />
          )}
          {activeTab === "conditions" && (
            <ContentManager basePath={`/api/campaigns/${campaignId}/content`} title="Condições" />
          )}
        </div>
      </div>
    </div>
  );
}
