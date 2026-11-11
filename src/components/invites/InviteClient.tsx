"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Character } from "@/types";
import type { MissingHabitant } from "@/lib/systems/missing/types";
import type { FalloutCharacter } from "@/lib/systems/fallout/types";
import type { PublicInvite } from "@/lib/server/public-invite";
import {
  getCharacterCreationHref,
  getCharacterNoun,
  getCreationSystem,
  getRulesEngineLabel,
  type CreationSystem,
} from "@/lib/systems/rules-engine";
import { Button } from "@/components/ui";

type SessionUser = {
  id: string;
  email: string;
  displayName: string;
  role: string;
};

type SelectableCharacter = { id: string; name: string; subtitle: string };

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
      throw new InviteRequestError(
        payload.error || "Não foi possível concluir a solicitação",
        response.status,
      );
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

/** Carrega apenas as fichas do mesmo sistema da campanha, prontas para vínculo. */
async function loadSelectableCharacters(
  system: CreationSystem,
  campaignId: string,
): Promise<SelectableCharacter[]> {
  if (system === "missing_zero") {
    const { data } = await fetchJson<MissingHabitant[]>("/api/systems/missing/habitants");
    return data
      .filter((habitant) => habitant.campaignId !== campaignId)
      .map((habitant) => {
        const readableLines = habitant.lines.filter((line) => !line.isErased).length;
        return {
          id: habitant.id,
          name: habitant.name,
          subtitle: `${readableLines} ${readableLines === 1 ? "linha" : "linhas"}`,
        };
      });
  }

  if (system === "fallout_2d20") {
    const { data } = await fetchJson<FalloutCharacter[]>("/api/systems/fallout/characters");
    return data
      .filter((character) => character.campaignId !== campaignId)
      .map((character) => ({
        id: character.id,
        name: character.name,
        subtitle: `Nível ${character.level} · ${character.origin.replace(/_/g, " ")}`,
      }));
  }

  const { data } = await fetchJson<Character[]>("/api/characters");
  return data.map((character) => ({
    id: character.id,
    name: character.name,
    subtitle: `Nível ${character.level}`,
  }));
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function InviteClient({ invite, token }: InviteClientProps) {
  const router = useRouter();
  const creationSystem = getCreationSystem(invite.rulesEngine);
  const noun = getCharacterNoun(invite.rulesEngine);
  const createHref = getCharacterCreationHref(invite.rulesEngine, invite.campaignId);

  const [user, setUser] = useState<SessionUser | null>(null);
  const [options, setOptions] = useState<SelectableCharacter[]>([]);
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
          const selectable = await loadSelectableCharacters(creationSystem, invite.campaignId);
          if (!cancelled) setOptions(selectable);
        } catch (requestError) {
          if (!cancelled) {
            setCharactersError(
              requestError instanceof InviteRequestError
                ? requestError.message
                : `Não foi possível carregar seus ${noun.plural}`,
            );
          }
        }
      } catch (requestError) {
        if (
          !cancelled &&
          (!(requestError instanceof InviteRequestError) || requestError.status !== 401)
        ) {
          setError(
            requestError instanceof InviteRequestError
              ? requestError.message
              : "Não foi possível verificar a sessão",
          );
        }
      } finally {
        if (!cancelled) setIsSessionLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [retryCount, creationSystem, invite.campaignId, noun.plural]);

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
      setError(
        requestError instanceof InviteRequestError
          ? requestError.message
          : "Erro de conexão. Tente novamente.",
      );
    } finally {
      setIsJoining(false);
    }
  };

  return (
    <div className="min-h-screen bg-dominant-deep py-8 text-secondary-pure">
      <div className="mx-auto max-w-lg px-4">
        <div className="rounded-lg border border-dominant-border bg-secondary-card p-6 shadow-xl">
          <p className="mb-2 text-sm font-semibold uppercase tracking-wider text-accent-vibrant">
            Convite de campanha
          </p>
          <h1 className="text-2xl font-bold text-secondary-pure">{invite.campaignName}</h1>
          <p className="mt-1 text-sm text-secondary-muted">
            Motor: {getRulesEngineLabel(invite.rulesEngine)}
            {invite.pvpEnabled ? " · PvP ativado" : ""}
          </p>
          {error && (
            <div className="mt-4 rounded-lg border border-accent-vibrant/40 bg-accent-dark/30 p-3 text-sm text-secondary-pure">
              {error}
            </div>
          )}
          <div className="mt-6">
            {isSessionLoading && (
              <p className="mb-4 text-center text-sm text-secondary-muted">Verificando sessão...</p>
            )}
            {!user ? (
              <div className="text-center">
                <p className="mb-4 text-secondary-muted">
                  Entre na sua conta para aceitar o convite.
                </p>
                <Link href={loginHref} className="inline-block">
                  <Button variant="primary" className="px-6 py-3 font-semibold">
                    Fazer login
                  </Button>
                </Link>
              </div>
            ) : charactersError ? (
              <div className="text-center">
                <p className="mb-4 text-accent-vibrant">{charactersError}</p>
                <Button
                  type="button"
                  onClick={retry}
                  variant="primary"
                  className="px-6 py-3 font-semibold"
                >
                  Tentar novamente
                </Button>
              </div>
            ) : options.length === 0 ? (
              <div className="text-center">
                <p className="mb-4 text-secondary-muted">
                  Você ainda não tem {noun.plural} deste sistema. Crie um para entrar na campanha.
                </p>
                <Link href={createHref} className="inline-block">
                  <Button variant="primary" className="px-6 py-3 font-semibold">
                    Criar {capitalize(noun.singular)}
                  </Button>
                </Link>
              </div>
            ) : (
              <div>
                <label className="mb-2 block text-sm font-medium text-secondary-muted">
                  Escolha o {noun.singular} que vai entrar na campanha
                </label>
                <select
                  value={selectedCharacterId}
                  onChange={(event) => setSelectedCharacterId(event.target.value)}
                  className="w-full rounded-lg border border-secondary-border bg-dominant-dark px-4 py-2 text-secondary-pure focus:border-accent-vibrant focus:outline-none focus:ring-2 focus:ring-accent"
                >
                  <option value="">Selecione um {noun.singular}</option>
                  {options.map((character) => (
                    <option key={character.id} value={character.id}>
                      {character.name} ({character.subtitle})
                    </option>
                  ))}
                </select>
                <Button
                  type="button"
                  onClick={handleJoin}
                  disabled={!selectedCharacterId || isJoining}
                  isLoading={isJoining}
                  variant="master"
                  className="mt-4 w-full py-3 font-semibold"
                >
                  Entrar na Campanha
                </Button>
                <p className="mt-3 text-center text-xs text-secondary-muted">
                  Ou{" "}
                  <Link
                    href={createHref}
                    className="font-semibold text-accent-vibrant hover:underline"
                  >
                    crie um novo {noun.singular}
                  </Link>{" "}
                  para esta campanha.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}