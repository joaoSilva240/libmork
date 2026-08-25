"use client";
 
import { useEffect, useState } from "react";
import Link from "next/link";
import type { Character } from "@/types";
import { CharacterCard } from "@/components/characters/CharacterCard";
import { LogoutButton } from "@/components/auth/LogoutButton";
import { Spinner } from "@/components/ui";
 
export function CharacterList() {
  const [characters, setCharacters] = useState<Character[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
 
  useEffect(() => {
    async function loadCharacters() {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      try {
        const response = await fetch("/api/characters", {
          credentials: "include",
          signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (!response.ok) {
          const data = await response.json().catch(() => ({}));

          if (response.status === 401) {
            window.location.href = '/login';
            return;
          }

          setError(data.error || "Erro ao carregar personagens");
          setIsLoading(false);
          return;
        }

        const data = await response.json();
        setCharacters(data.data);
      } catch (err: any) {
        clearTimeout(timeoutId);
        if (err.name === 'AbortError') {
          setError("Tempo esgotado. Verifique sua conexão.");
        } else {
          setError("Erro de conexão. Tente novamente.");
        }
      } finally {
        setIsLoading(false);
      }
    }

    loadCharacters();
  }, []);
 
  if (isLoading) {
    return (
      <div>
        <header className="mb-4 flex items-center justify-between border-b border-gray-800 bg-gray-900 p-4 rounded-xl">
          <h1 className="text-xl font-bold text-white">Libmork — Jogador</h1>
          <LogoutButton />
        </header>
        <div className="flex justify-center py-12">
          <Spinner size="lg" />
        </div>
      </div>
    );
  }
 
  if (error) {
    return (
      <div>
        <header className="mb-4 flex items-center justify-between border-b border-gray-800 bg-gray-900 p-4 rounded-xl">
          <h1 className="text-xl font-bold text-white">Libmork — Jogador</h1>
          <LogoutButton />
        </header>
        <div className="rounded-lg border border-red-800 bg-red-900/30 p-4 text-red-300">
          {error}
        </div>
      </div>
    );
  }
 
  if (characters.length === 0) {
    return (
      <div>
        <header className="mb-4 flex items-center justify-between border-b border-gray-800 bg-gray-900 p-4 rounded-xl">
          <h1 className="text-xl font-bold text-white">Libmork — Jogador</h1>
          <LogoutButton />
        </header>
        <div className="py-12 text-center">
          <p className="mb-4 text-gray-400">Você ainda não tem personagens.</p>
          <Link
            href="/player/characters/new"
            className="inline-block rounded-lg bg-blue-600 px-6 py-3 font-semibold text-white hover:bg-blue-700"
          >
            Criar Personagem
          </Link>
        </div>
      </div>
    );
  }
 
  return (
    <div>
      <header className="mb-6 flex items-center justify-between border-b border-gray-800 bg-gray-900 p-4 rounded-xl">
        <h1 className="text-xl font-bold text-white">Libmork — Jogador</h1>
        <LogoutButton />
      </header>
      <div>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-white">Meus Personagens</h2>
          <Link
            href="/player/characters/new"
            className="rounded-lg bg-blue-600 px-4 py-2 font-semibold text-white hover:bg-blue-700"
          >
            + Novo
          </Link>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {characters.map((character) => (
            <CharacterCard key={character.id} character={character} />
          ))}
        </div>
      </div>
    </div>
  );
}
