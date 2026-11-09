"use client";

import { useEffect, useState, type ComponentType, type ReactNode } from "react";

export type ShieldTabDef = {
  id: string;
  label: string;
  icon: ComponentType<{ size?: number; className?: string; "aria-hidden"?: boolean }>;
  visible: boolean;
  /** Conteúdo da aba. Fica sempre montado (oculto via CSS) para preservar estado interno. */
  content: ReactNode;
};

type ShieldTabContainerProps = {
  /** Chave do localStorage para persistir a aba ativa (issue #89). */
  persistKey: string;
  tabs: ShieldTabDef[];
  className?: string;
  headerClassName?: string;
  /** Altura mínima aplicada ao corpo do contêiner. */
  minHClass?: string;
};

function readStoredTab(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStoredTab(key: string, tabId: string) {
  try {
    window.localStorage.setItem(key, tabId);
  } catch {
    // ignora erros de storage
  }
}

/**
 * Contêiner com abas compactas no cabeçalho (ícones do lucide-react) para o
 * Escudo do Mestre. Todas as abas visíveis ficam montadas no DOM e apenas a
 * ativa é exibida — garante que áudio da Jukebox e estado interno dos painéis
 * persistam ininterruptos ao navegar entre abas (issue #89).
 */
export function ShieldTabContainer({
  persistKey,
  tabs,
  className = "",
  headerClassName = "",
  minHClass = "lg:min-h-[160px]",
}: ShieldTabContainerProps) {
  const visibleTabs = tabs.filter((tab) => tab.visible);

  // Estado inicial: primeira aba visível (mesma renderização SSR/hidratação).
  // A aba preferida salva é restaurada pós-hidratação, como em MasterSidebar.
  const [activeTab, setActiveTab] = useState<string>(() => visibleTabs[0]?.id ?? "");

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setActiveTab((current) => {
      const stored = readStoredTab(persistKey);
      if (stored && visibleTabs.some((tab) => tab.id === stored)) {
        return stored;
      }
      // Fallback: se a aba salva ficou invisível, usa a primeira visível.
      if (!visibleTabs.some((tab) => tab.id === current)) {
        return visibleTabs[0]?.id ?? "";
      }
      return current;
    });
    // Reavalia apenas quando a lista de abas visíveis muda.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [persistKey, visibleTabs.map((t) => t.id).join("|")]);

  const selectTab = (tabId: string) => {
    setActiveTab(tabId);
    writeStoredTab(persistKey, tabId);
  };

  // Navegação acessível por teclado: setas esquerda/direita alternam abas.
  const handleHeaderKeyDown = (event: React.KeyboardEvent) => {
    if (visibleTabs.length < 2) return;
    const currentIndex = visibleTabs.findIndex((tab) => tab.id === activeTab);
    if (event.key === "ArrowRight") {
      event.preventDefault();
      selectTab(visibleTabs[(currentIndex + 1) % visibleTabs.length].id);
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      selectTab(visibleTabs[(currentIndex - 1 + visibleTabs.length) % visibleTabs.length].id);
    }
  };

  if (visibleTabs.length === 0) return null;

  // Módulo único visível: renderiza direto, sem cabeçalho de abas.
  if (visibleTabs.length === 1) {
    return (
      <div
        data-testid={`shield-tab-container-${persistKey.split(":").pop()}`}
        className={`flex flex-col overflow-hidden rounded-lg border border-gray-800 bg-gray-900 ${minHClass} lg:flex-1 ${className}`}
      >
        <div className={`flex min-h-0 flex-1 flex-col ${activeTab === visibleTabs[0].id ? "" : "hidden"}`}>
          {visibleTabs[0].content}
        </div>
      </div>
    );
  }

  return (
    <div
      data-testid={`shield-tab-container-${persistKey.split(":").pop()}`}
      className={`flex flex-col overflow-hidden rounded-lg border border-gray-800 bg-gray-900 ${minHClass} lg:flex-1 ${className}`}
    >
      <div
        role="tablist"
        aria-label="Painéis do escudo"
        onKeyDown={handleHeaderKeyDown}
        className={`flex shrink-0 items-center gap-1 border-b border-gray-800 bg-gray-950/60 px-1.5 py-1 ${headerClassName}`}
      >
        {visibleTabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = tab.id === activeTab;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              id={`shield-tab-${persistKey}-${tab.id}`}
              aria-selected={isActive}
              aria-controls={`shield-tabpanel-${persistKey}-${tab.id}`}
              tabIndex={isActive ? 0 : -1}
              data-testid={`shield-tab-${tab.id}`}
              onClick={() => selectTab(tab.id)}
              title={tab.label}
              aria-label={tab.label}
              className={`flex cursor-pointer items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                isActive
                  ? "bg-accent/20 text-accent-hover"
                  : "text-secondary-muted hover:bg-dominant-container hover:text-secondary-pure"
              }`}
            >
              <Icon size={14} aria-hidden={true} />
            </button>
          );
        })}
      </div>

      {visibleTabs.map((tab) => {
        const isActive = tab.id === activeTab;
        return (
          <div
            key={tab.id}
            role="tabpanel"
            id={`shield-tabpanel-${persistKey}-${tab.id}`}
            aria-labelledby={`shield-tab-${persistKey}-${tab.id}`}
            data-testid={`shield-tabpanel-${tab.id}`}
            hidden={!isActive}
            className={`min-h-0 flex-1 flex-col ${isActive ? "flex" : "hidden"}`}
            // Conteúdo permanece montado para preservar estado/áudio.
          >
            {tab.content}
          </div>
        );
      })}
    </div>
  );
}
