"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { Character } from "@/types";
import type { MissingHabitant, EquipmentStatus } from "@/lib/systems/missing/types";
import { CharacterCard } from "@/components/characters/CharacterCard";
import { MissingHabitantCard } from "@/components/systems/missing/MissingHabitantCard";
import { MissingHabitantSheet } from "@/components/systems/missing/MissingHabitantSheet";
import { LogoutButton } from "@/components/auth/LogoutButton";
import { Spinner, Button } from "@/components/ui";

export function CharacterList() {
  const [characters, setCharacters] = useState<Character[]>([]);
  const [missingHabitants, setMissingHabitants] = useState<MissingHabitant[]>([]);
  const [selectedHabitant, setSelectedHabitant] = useState<MissingHabitant | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadCharacters() {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      try {
        const response = await fetch("/api/characters", {
          credentials: "include",
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        if (!response.ok) {
          const data = await response.json().catch(() => ({}));

          if (response.status === 401) {
            await fetch("/api/auth/logout", { method: "POST", credentials: "include" }).catch(() => {});
            window.location.href = "/login";
            return;
          }

          setError(data.error || "Erro ao carregar personagens");
          setIsLoading(false);
          return;
        }

        const data = await response.json();
        setCharacters(data.data || []);
      } catch (err: unknown) {
        clearTimeout(timeoutId);
        if (err instanceof Error && err.name === "AbortError") {
          setError("Tempo esgotado. Verifique sua conexão.");
        } else {
          setError("Erro de conexão. Tente novamente.");
        }
      } finally {
        setIsLoading(false);
      }
    }

    async function loadMissingHabitants() {
      try {
        const response = await fetch("/api/systems/missing/habitants", {
          credentials: "include",
        });
        if (!response.ok) {
          setMissingHabitants([]);
          return;
        }
        const data = await response.json().catch(() => ({}));
        setMissingHabitants(data.data || []);
      } catch {
        setMissingHabitants([]);
      }
    }

    void loadCharacters();
    void loadMissingHabitants();
  }, []);

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setSelectedHabitant(null);
      }
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, []);

  const handleEraseHabitantLine = async (lineId: string, reason?: string) => {
    if (!selectedHabitant) return;
    try {
      const res = await fetch(`/api/systems/missing/habitants/${selectedHabitant.id}/erase`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ lineId, reason }),
      });
      if (res.ok) {
        const json = await res.json();
        const updated: MissingHabitant = json.data;
        setSelectedHabitant(updated);
        setMissingHabitants((prev) => prev.map((h) => (h.id === updated.id ? updated : h)));
      }
    } catch {
      // Silencioso/resiliente
    }
  };

  const handleAddHabitantLine = async (text: string) => {
    if (!selectedHabitant) return;
    try {
      const res = await fetch(`/api/systems/missing/habitants/${selectedHabitant.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ addLine: text }),
      });
      if (res.ok) {
        const json = await res.json();
        const updated: MissingHabitant = json.data;
        setSelectedHabitant(updated);
        setMissingHabitants((prev) => prev.map((h) => (h.id === updated.id ? updated : h)));
      }
    } catch {
      // Silencioso/resiliente
    }
  };

  const handleUpdateHabitantEquipment = async (
    slot: 1 | 2 | 3,
    equipment: { name: string; notes?: string; status: EquipmentStatus },
  ) => {
    if (!selectedHabitant) return;
    try {
      const res = await fetch(`/api/systems/missing/habitants/${selectedHabitant.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          equipment: {
            slot,
            ...equipment,
          },
        }),
      });
      if (res.ok) {
        const json = await res.json();
        const updated: MissingHabitant = json.data;
        setSelectedHabitant(updated);
        setMissingHabitants((prev) => prev.map((h) => (h.id === updated.id ? updated : h)));
      }
    } catch {
      // Silencioso/resiliente
    }
  };

  if (isLoading) {
    return (
      <div>
        <header className="mb-4 flex items-center justify-between border border-secondary-border bg-secondary-card p-4 rounded-xl shadow-md">
          <h1 className="text-xl font-bold text-secondary-pure">Libmork — Jogador</h1>
          <LogoutButton />
        </header>
        <div className="flex flex-1 items-center justify-center py-12 min-h-[300px]">
          <Spinner size="lg" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <header className="mb-4 flex items-center justify-between border border-secondary-border bg-secondary-card p-4 rounded-xl shadow-md">
          <h1 className="text-xl font-bold text-secondary-pure">Libmork — Jogador</h1>
          <LogoutButton />
        </header>
        <div className="rounded-lg border border-accent-vibrant/40 bg-accent-dark/30 p-4 text-secondary-pure">
          {error}
        </div>
      </div>
    );
  }

  if (characters.length === 0 && missingHabitants.length === 0) {
    return (
      <div>
        <header className="mb-4 flex items-center justify-between border border-secondary-border bg-secondary-card p-4 rounded-xl shadow-md">
          <h1 className="text-xl font-bold text-secondary-pure">Libmork — Jogador</h1>
          <LogoutButton />
        </header>
        <div className="py-12 text-center">
          <p className="mb-4 text-secondary-muted">Você ainda não tem personagens.</p>
          <Link href="/player/characters/new">
            <Button variant="primary" className="px-6 py-3 font-semibold">
              Criar Personagem
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div>
      <header className="mb-6 flex items-center justify-between border border-secondary-border bg-secondary-card p-4 rounded-xl shadow-md">
        <h1 className="text-xl font-bold text-secondary-pure">Libmork — Jogador</h1>
        <LogoutButton />
      </header>
      <div>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-secondary-pure">Meus Personagens</h2>
          <Link href="/player/characters/new">
            <Button variant="primary" className="px-4 py-2 font-semibold">
              + Novo
            </Button>
          </Link>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {characters.map((character) => (
            <CharacterCard key={character.id} character={character} />
          ))}
          {missingHabitants.map((habitant) => (
            <MissingHabitantCard
              key={habitant.id}
              habitant={habitant}
              onOpen={(h) => setSelectedHabitant(h)}
            />
          ))}
        </div>
      </div>

      {/* Modal / Overlay em Tela Cheia da Ficha de Habitante de MISSING */}
      {selectedHabitant !== null && (
        <div
          className="fixed inset-0 z-50 flex flex-col bg-[#0a0b0d] overflow-hidden"
          role="dialog"
          aria-modal="true"
          aria-label={`Ficha de ${selectedHabitant.name}`}
        >
          <MissingHabitantSheet
            habitant={selectedHabitant}
            campaignId={selectedHabitant.campaignId || undefined}
            onClose={() => setSelectedHabitant(null)}
            onEraseLine={handleEraseHabitantLine}
            onAddLine={handleAddHabitantLine}
            onUpdateEquipment={handleUpdateHabitantEquipment}
          />
        </div>
      )}
    </div>
  );
}
