"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Character } from "@/types";
import type { PublicInvite } from "@/lib/server/public-invite";
import { Button } from "@/components/ui";

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
    <div className="min-h-screen bg-dominant-deep py-8 text-secondary-pure">
      <div className="mx-auto max-w-lg px-4">
        <div className="rounded-lg border border-dominant-border bg-secondary-card p-6 shadow-xl">
          <p className="mb-2 text-sm font-semibold uppercase tracking-wider text-accent-vibrant">Convite de campanha</p>
          <h1 className="text-2xl font-bold text-secondary-pure">{invite.campaignName}</h1>
          <p className="mt-1 text-sm text-secondary-muted">
            Motor: {invite.rulesEngine === "d20_mod" ? "d20 + modificador" : "2d20 somado"}
            {invite.pvpEnabled ? " · PvP ativado" : ""}
          </p>
          {error && <div className="mt-4 rounded-lg border border-accent-vibrant/40 bg-accent-dark/30 p-3 text-sm text-secondary-pure">{error}</div>}
          <div className="mt-6">
            {isSessionLoading && <p className="mb-4 text-center text-sm text-secondary-muted">Verificando sessão...</p>}
            {!user ? (
              <div className="text-center">
                <p className="mb-4 text-secondary-muted">Entre na sua conta para aceitar o convite.</p>
                <Link href={loginHref} className="inline-block">
                  <Button variant="primary" className="px-6 py-3 font-semibold">Fazer login</Button>
                </Link>
              </div>
            ) : charactersError ? (
              <div className="text-center">
                <p className="mb-4 text-accent-vibrant">{charactersError}</p>
                <Button type="button" onClick={retry} variant="primary" className="px-6 py-3 font-semibold">Tentar novamente</Button>
              </div>
            ) : characters.length === 0 ? (
              <div className="text-center">
                <p className="mb-4 text-secondary-muted">Você ainda não tem personagens. Crie um para entrar na campanha.</p>
                <Link href="/player/characters/new" className="inline-block">
                  <Button variant="primary" className="px-6 py-3 font-semibold">Criar Personagem</Button>
                </Link>
              </div>
            ) : (
              <div>
                <label className="mb-2 block text-sm font-medium text-secondary-muted">Escolha o personagem que vai entrar na campanha</label>
                <select value={selectedCharacterId} onChange={(event) => setSelectedCharacterId(event.target.value)} className="w-full rounded-lg border border-secondary-border bg-dominant-dark px-4 py-2 text-secondary-pure focus:border-accent-vibrant focus:outline-none focus:ring-2 focus:ring-accent"><option value="">Selecione um personagem</option>{characters.map((character) => <option key={character.id} value={character.id}>{character.name} (Nível {character.level})</option>)}</select>
                <Button type="button" onClick={handleJoin} disabled={!selectedCharacterId || isJoining} isLoading={isJoining} variant="master" className="mt-4 w-full py-3 font-semibold">Entrar na Campanha</Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
