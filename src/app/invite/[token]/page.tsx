"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import type { Character } from "@/types";

type InviteInfo = {
  campaignId: string;
  campaignName: string;
  rulesEngine: string;
  pvpEnabled: boolean;
};

type SessionUser = {
  id: string;
  email: string;
  displayName: string;
  role: string;
};

export default function InvitePage() {
  const params = useParams<{ token: string }>();
  const router = useRouter();
  const [invite, setInvite] = useState<InviteInfo | null>(null);
  const [user, setUser] = useState<SessionUser | null>(null);
  const [characters, setCharacters] = useState<Character[]>([]);
  const [selectedCharacterId, setSelectedCharacterId] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isJoining, setIsJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const inviteResponse = await fetch(`/api/invites/${params.token}`);
        const inviteData = await inviteResponse.json();

        if (cancelled) return;

        if (!inviteResponse.ok) {
          setError(inviteData.error || "Convite inválido");
          return;
        }

        setInvite(inviteData.data);

        const meResponse = await fetch("/api/auth/me");

        if (meResponse.ok) {
          const meData = await meResponse.json();
          if (!cancelled) {
            setUser(meData.data);

            const charsResponse = await fetch("/api/characters");
            const charsData = await charsResponse.json();

            if (!cancelled && charsResponse.ok) {
              setCharacters(charsData.data);
            }
          }
        }
      } catch {
        if (!cancelled) {
          setError("Erro de conexão. Tente novamente.");
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [params.token]);

  const handleJoin = async () => {
    if (!selectedCharacterId) return;

    setError(null);
    setIsJoining(true);

    try {
      const response = await fetch(`/api/invites/${params.token}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ characterId: selectedCharacterId }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Erro ao entrar na campanha");
        return;
      }

      router.push("/player");
    } catch {
      setError("Erro de conexão. Tente novamente.");
    } finally {
      setIsJoining(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-950">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-700 border-t-purple-600" />
      </div>
    );
  }

  if (error && !invite) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-950 px-4">
        <div className="max-w-md w-full rounded-lg border border-red-800 bg-red-900/30 p-6 text-center">
          <h1 className="mb-2 text-2xl font-bold text-white">Convite indisponível</h1>
          <p className="text-red-300">{error}</p>
          <p className="mt-4 text-sm text-gray-400">
            O convite pode ter sido revogado pelo mestre.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 py-8">
      <div className="mx-auto max-w-lg px-4">
        <div className="rounded-lg border border-gray-800 bg-gray-900 p-6">
          <p className="mb-2 text-sm uppercase tracking-wider text-purple-400">
            Convite de campanha
          </p>
          <h1 className="text-2xl font-bold text-white">
            {invite?.campaignName}
          </h1>
          <p className="mt-1 text-sm text-gray-400">
            Motor: {invite?.rulesEngine === "d20_mod" ? "d20 + modificador" : "2d20 somado"}
            {invite?.pvpEnabled ? " · PvP ativado" : ""}
          </p>

          {error && (
            <div className="mt-4 rounded-lg border border-red-800 bg-red-900/30 p-3 text-sm text-red-300">
              {error}
            </div>
          )}

          <div className="mt-6">
            {!user ? (
              <div className="text-center">
                <p className="mb-4 text-gray-300">
                  Entre na sua conta para aceitar o convite.
                </p>
                <Link
                  href={`/login?redirect=${encodeURIComponent(`/invite/${params.token}`)}`}
                  className="inline-block rounded-lg bg-blue-600 px-6 py-3 font-semibold text-white hover:bg-blue-700"
                >
                  Fazer login
                </Link>
              </div>
            ) : characters.length === 0 ? (
              <div className="text-center">
                <p className="mb-4 text-gray-300">
                  Você ainda não tem personagens. Crie um para entrar na campanha.
                </p>
                <Link
                  href="/player/characters/new"
                  className="inline-block rounded-lg bg-blue-600 px-6 py-3 font-semibold text-white hover:bg-blue-700"
                >
                  Criar Personagem
                </Link>
              </div>
            ) : (
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-300">
                  Escolha o personagem que vai entrar na campanha
                </label>
                <select
                  value={selectedCharacterId}
                  onChange={(e) => setSelectedCharacterId(e.target.value)}
                  className="w-full rounded-lg border border-gray-700 bg-gray-950 px-4 py-2 text-white focus:ring-2 focus:ring-purple-600 focus:border-transparent"
                >
                  <option value="">Selecione um personagem</option>
                  {characters.map((character) => (
                    <option key={character.id} value={character.id}>
                      {character.name} (Nível {character.level})
                    </option>
                  ))}
                </select>
                <button
                  onClick={handleJoin}
                  disabled={!selectedCharacterId || isJoining}
                  className="mt-4 w-full rounded-lg bg-purple-600 px-6 py-3 font-semibold text-white hover:bg-purple-700 disabled:opacity-50"
                >
                  {isJoining ? "Entrando..." : "Entrar na Campanha"}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
