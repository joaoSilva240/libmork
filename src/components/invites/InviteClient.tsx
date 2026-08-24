"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Character } from "@/types";
import type { PublicInvite } from "@/lib/server/public-invite";

type SessionUser = {
  id: string;
  email: string;
  displayName: string;
  role: string;
};

type InviteClientProps = { invite: PublicInvite; token: string };
const REQUEST_TIMEOUT_MS = 12_000;

class InviteRequestError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "InviteRequestError";
    this.status = status;
  }
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<{ data: T; status: number }> {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    const body = await response.text();
    let payload: { data?: T; error?: string };
    try {
      payload = JSON.parse(body) as { data?: T; error?: string };
    } catch {
      throw new InviteRequestError("Resposta inválida do servidor", response.status);
    }
    if (!response.ok) {
      throw new InviteRequestError(payload.error || "Não foi possível concluir a solicitação", response.status);
    }
    return { data: payload.data as T, status: response.status };
  } catch (requestError) {
    if (requestError instanceof InviteRequestError) throw requestError;
    if (requestError instanceof DOMException && requestError.name === "AbortError") {
      throw new InviteRequestError("A solicitação excedeu o tempo limite", 408);
    }
    throw new InviteRequestError("Erro de conexão. Tente novamente.", 0);
  } finally {
    window.clearTimeout(timeoutId);
  }
}

export function InviteClient({ invite, token }: InviteClientProps) {
  const router = useRouter();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [characters, setCharacters] = useState<Character[]>([]);
  const [selectedCharacterId, setSelectedCharacterId] = useState("");
  const [isSessionLoading, setIsSessionLoading] = useState(true);
  const [isJoining, setIsJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [charactersError, setCharactersError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const tokenPath = encodeURIComponent(token);
  const invitePath = `/invite/${tokenPath}`;
  const loginHref = `/login?redirect=${encodeURIComponent(invitePath)}`;

  const retry = useCallback(() => {
    setError(null);
    setCharactersError(null);
    setIsSessionLoading(true);
    setRetryCount((count) => count + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const sessionResult = await fetchJson<SessionUser>("/api/auth/me");
        if (cancelled) return;
        setUser(sessionResult.data);
        try {
          const charactersResult = await fetchJson<Character[]>("/api/characters");
          if (!cancelled) setCharacters(charactersResult.data);
        } catch (requestError) {
          if (!cancelled) {
            setCharactersError(requestError instanceof InviteRequestError ? requestError.message : "Não foi possível carregar seus personagens");
          }
        }
      } catch (requestError) {
        if (!cancelled && (!(requestError instanceof InviteRequestError) || requestError.status !== 401)) {
          setError(requestError instanceof InviteRequestError ? requestError.message : "Não foi possível verificar a sessão");
        }
      } finally {
        if (!cancelled) setIsSessionLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [retryCount]);

  const handleJoin = async () => {
    if (!selectedCharacterId) return;
    setError(null);
    setIsJoining(true);
    try {
      await fetchJson<unknown>(`/api/invites/${tokenPath}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ characterId: selectedCharacterId }),
      });
      router.push("/player");
    } catch (requestError) {
      setError(requestError instanceof InviteRequestError ? requestError.message : "Erro de conexão. Tente novamente.");
    } finally {
      setIsJoining(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 py-8">
      <div className="mx-auto max-w-lg px-4">
        <div className="rounded-lg border border-gray-800 bg-gray-900 p-6">
          <p className="mb-2 text-sm uppercase tracking-wider text-purple-400">Convite de campanha</p>
          <h1 className="text-2xl font-bold text-white">{invite.campaignName}</h1>
          <p className="mt-1 text-sm text-gray-400">
            Motor: {invite.rulesEngine === "d20_mod" ? "d20 + modificador" : "2d20 somado"}
            {invite.pvpEnabled ? " · PvP ativado" : ""}
          </p>
          {error && <div className="mt-4 rounded-lg border border-red-800 bg-red-900/30 p-3 text-sm text-red-300">{error}</div>}
          <div className="mt-6">
            {isSessionLoading && <p className="mb-4 text-center text-sm text-gray-400">Verificando sessão...</p>}
            {!user ? (
              <div className="text-center">
                <p className="mb-4 text-gray-300">Entre na sua conta para aceitar o convite.</p>
                <Link href={loginHref} className="inline-block rounded-lg bg-blue-600 px-6 py-3 font-semibold text-white hover:bg-blue-700">Fazer login</Link>
              </div>
            ) : charactersError ? (
              <div className="text-center"><p className="mb-4 text-red-300">{charactersError}</p><button type="button" onClick={retry} className="rounded-lg bg-blue-600 px-6 py-3 font-semibold text-white hover:bg-blue-700">Tentar novamente</button></div>
            ) : characters.length === 0 ? (
              <div className="text-center"><p className="mb-4 text-gray-300">Você ainda não tem personagens. Crie um para entrar na campanha.</p><Link href="/player/characters/new" className="inline-block rounded-lg bg-blue-600 px-6 py-3 font-semibold text-white hover:bg-blue-700">Criar Personagem</Link></div>
            ) : (
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-300">Escolha o personagem que vai entrar na campanha</label>
                <select value={selectedCharacterId} onChange={(event) => setSelectedCharacterId(event.target.value)} className="w-full rounded-lg border border-gray-700 bg-gray-950 px-4 py-2 text-white focus:border-transparent focus:ring-2 focus:ring-purple-600"><option value="">Selecione um personagem</option>{characters.map((character) => <option key={character.id} value={character.id}>{character.name} (Nível {character.level})</option>)}</select>
                <button type="button" onClick={handleJoin} disabled={!selectedCharacterId || isJoining} className="mt-4 w-full rounded-lg bg-purple-600 px-6 py-3 font-semibold text-white hover:bg-purple-700 disabled:opacity-50">{isJoining ? "Entrando..." : "Entrar na Campanha"}</button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
