"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import type { Character } from "@/types";
import { ATTRIBUTES } from "@/lib/utils/constants";
import type { Attribute } from "@/lib/utils/constants";
import { getDerivedStats } from "@/lib/engine/attributes";
import { ShareLink } from "@/components/characters/ShareLink";
import { ImageUpload } from "@/components/characters/ImageUpload";
import { CharacterContent } from "@/components/characters/CharacterContent";
import { NfcManager } from "@/components/characters/NfcManager";
import {
  StatusFilledIcon,
  SkillsFilledIcon,
  InventoryFilledIcon,
  SettingsFilledIcon,
} from "@/components/ui/Icons";
import {
  useSocket,
  type DefenseReactionRequestPayload,
  type DuelInviteRequestPayload,
} from "@/context/SocketContext";
import { DefenseReactionModal } from "@/components/combat/DefenseReactionModal";
import { DeathSaveModal } from "@/components/combat/DeathSaveModal";
import { PlayerTurnOverlay } from "@/components/combat/PlayerTurnOverlay";
import { ShadowPointsModal } from "@/components/characters/ShadowPointsModal";
import { DuelInviteModal } from "@/components/combat/DuelInviteModal";
import { DuelIncomingInviteModal } from "@/components/combat/DuelIncomingInviteModal";
import { DuelArenaModal } from "@/components/combat/DuelArenaModal";
import type { CombatSessionState } from "@/lib/engine";
import type { DuelSessionState } from "@/lib/engine/duel";
import { createDuelSession, startDuelSession } from "@/lib/engine/duel";
import { applyHpChange, spendCombatActions } from "@/lib/engine";

type TabType = "status" | "skills" | "inventory" | "settings";

const ATTRIBUTE_LABELS: Record<Attribute, string> = {
  forca: "Força",
  destreza: "Destreza",
  vigor: "Vigor",
  inteligencia: "Inteligência",
  empatia: "Empatia",
};

const ATTRIBUTE_ICONS: Record<Attribute, string> = {
  forca: "⚔️",
  destreza: "🏹",
  vigor: "🛡️",
  inteligencia: "🧠",
  empatia: "💬",
};

export function CharacterDetail() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const {
    updateActorStatus,
    rollDice,
    isConnected,
    joinCampaign,
    subscribeInitiativeRequest,
    subscribeDefenseRequest,
    subscribeCombatState,
    subscribeActorStatus,
    subscribeDuelInvite,
    subscribeDuelResponse,
    subscribeDuelState,
    subscribeDuelFinish,
    respondDefenseReaction,
    updateCombatState,
    updateDuelState,
  } = useSocket();

  const [character, setCharacter] = useState<Character | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>("status");
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  // Combate & Interações ao vivo
  const [combatState, setCombatState] = useState<CombatSessionState | null>(null);
  const [showInitiativeModal, setShowInitiativeModal] = useState(false);
  const [manualInitiative, setManualInitiative] = useState("");
  const [defenseRequestPayload, setDefenseRequestPayload] = useState<DefenseReactionRequestPayload | null>(null);

  // Pontos de Sombra (RF-045, D-26)
  const [showShadowModal, setShowShadowModal] = useState(false);
  const [userShadowPoints, setUserShadowPoints] = useState(0);

  // Duelo P2P (RF-069, D-45)
  const [showDuelInviteModal, setShowDuelInviteModal] = useState(false);
  const [incomingDuelInvite, setIncomingDuelInvite] = useState<DuelInviteRequestPayload | null>(null);
  const [activeDuelState, setActiveDuelState] = useState<DuelSessionState | null>(null);

  // Rolagem de Dados
  const [activeRollResult, setActiveRollResult] = useState<{
    title: string;
    formula: string;
    result: number;
    detail: string;
  } | null>(null);

  const characterRef = useRef<Character | null>(null);
  const combatStateRef = useRef<CombatSessionState | null>(null);
  const combatRevisionRef = useRef(0);
  const syncCharacterFromCombatState = (state: CombatSessionState) => {
    const current = characterRef.current;
    if (!current) return;
    const self = state.combatants.find((combatant) =>
      combatant.id === current.id || combatant.characterId === current.id || combatant.npcId === current.id
    );
    if (!self) return;
    setCharacter((prev) => prev ? {
      ...prev,
      hitPointsCurrent: self.hpCurrent,
      hitPointsMax: self.hpMax,
      ...(self.manaCurrent == null ? {} : { manaPointsCurrent: self.manaCurrent }),
      ...(self.manaMax == null ? {} : { manaPointsMax: self.manaMax }),
    } : prev);
  };
  useEffect(() => {
    characterRef.current = character;
  }, [character]);

  useEffect(() => {
    combatStateRef.current = combatState;
  }, [combatState]);

  useEffect(() => {
    let cancelled = false;

    async function loadCharacter() {
      try {
        const response = await fetch(`/api/characters/${params.id}`);
        const data = await response.json();

        if (cancelled) return;

        if (!response.ok) {
          setError(data.error || "Erro ao carregar personagem");
          return;
        }

        setCharacter(data.data);

        // Buscar Pontos de Sombra do Usuário
        const meRes = await fetch("/api/auth/me");
        if (meRes.ok) {
          const meData = await meRes.json();
          if (meData.user?.shadowPoints !== undefined) {
            setUserShadowPoints(meData.user.shadowPoints);
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
    }

    void loadCharacter();

    return () => {
      cancelled = true;
    };
  }, [params.id]);

  useEffect(() => {
    if (!character?.id) return;

    joinCampaign({
      campaignId: character.campaignId ?? "",
      user: { id: character.id, name: character.name },
      actorId: character.id,
      role: "player",
    });

    const unsubInit = subscribeInitiativeRequest(() => {
      setShowInitiativeModal(true);
    });

    const unsubDefense = subscribeDefenseRequest((payload) => {
      if (characterRef.current && payload.targetId === characterRef.current.id) {
        setDefenseRequestPayload(payload);
      }
    });

    const unsubCombat = subscribeCombatState((state) => {
      if (state.campaignId !== characterRef.current?.campaignId) return;
      if ((state.revision ?? 0) < combatRevisionRef.current) return;
      combatRevisionRef.current = state.revision ?? combatRevisionRef.current;
      setCombatState(state);
      syncCharacterFromCombatState(state);
    });

    const unsubActorStatus = subscribeActorStatus((payload) => {
      const current = characterRef.current;
      if (!current || payload.campaignId !== current.campaignId || payload.actorId !== current.id) return;
      setCharacter((prev) => prev ? {
        ...prev,
        ...(payload.currentHp === undefined ? {} : { hitPointsCurrent: Math.max(0, Math.min(payload.maxHp ?? prev.hitPointsMax, payload.currentHp)) }),
        ...(payload.maxHp === undefined ? {} : { hitPointsMax: Math.max(0, payload.maxHp) }),
        ...(payload.currentMana === undefined ? {} : { manaPointsCurrent: Math.max(0, Math.min(payload.maxMana ?? prev.manaPointsMax, payload.currentMana)) }),
        ...(payload.maxMana === undefined ? {} : { manaPointsMax: Math.max(0, payload.maxMana) }),
      } : prev);

      const combat = combatStateRef.current;
      if (combat && combat.active) {
        const combatant = combat.combatants.find((c) => c.id === current.id || c.characterId === current.id);
        if (combatant) {
          const nextHp = payload.currentHp !== undefined ? Math.max(0, Math.min(payload.maxHp ?? combatant.hpMax, payload.currentHp)) : combatant.hpCurrent;
          const nextHpMax = payload.maxHp !== undefined ? Math.max(0, payload.maxHp) : combatant.hpMax;
          const nextMana = payload.currentMana !== undefined ? Math.max(0, Math.min(payload.maxMana ?? (combatant.manaMax ?? 0), payload.currentMana)) : combatant.manaCurrent;
          const nextManaMax = payload.maxMana !== undefined ? Math.max(0, payload.maxMana) : combatant.manaMax;

          const updatedCombatants = combat.combatants.map((c) => {
            if (c.id === combatant.id) {
              return {
                ...c,
                hpCurrent: nextHp,
                hpMax: nextHpMax,
                manaCurrent: nextMana,
                manaMax: nextManaMax,
                isFallen: nextHp <= 0 && !c.isDead,
              };
            }
            return c;
          });

          const nextRevision = (combat.revision ?? 0) + 1;
          combatRevisionRef.current = nextRevision;

          const nextState = {
            ...combat,
            combatants: updatedCombatants,
            revision: nextRevision,
            updatedAt: Date.now(),
          };

          setCombatState(nextState);
          updateCombatState(nextState);
        }
      }

      void fetch(`/api/campaigns/${current.campaignId}/actors/${current.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(payload.currentHp === undefined ? {} : { hitPointsCurrent: payload.currentHp }),
          ...(payload.currentMana === undefined ? {} : { manaPointsCurrent: payload.currentMana }),
          reason: "atualização de combate",
        }),
      });
    });

    const unsubDuelInvite = subscribeDuelInvite((payload) => {
      if (characterRef.current && payload.targetCharacterId === characterRef.current.id) {
        setIncomingDuelInvite(payload);
      }
    });

    const unsubDuelResponse = subscribeDuelResponse((payload) => {
      if (characterRef.current && payload.challengerId === characterRef.current.id && payload.accepted) {
        const char = characterRef.current;
        const newDuel = createDuelSession(payload.campaignId, payload.permanentResults, [
          {
            id: char.id,
            characterId: char.id,
            name: char.name,
            avatarUrl: char.imageUrl,
            initiative: Math.floor(Math.random() * 20) + 1,
            hpCurrent: char.hitPointsCurrent,
            hpMax: char.hitPointsMax,
            manaCurrent: char.manaPointsCurrent,
            manaMax: char.manaPointsMax,
            vigor: char.attributes.vigor,
            destreza: char.attributes.destreza,
            level: char.level,
            originalHp: char.hitPointsCurrent,
            originalMana: char.manaPointsMax,
          },
        ]);
        const started = startDuelSession(newDuel);
        setActiveDuelState(started);
        updateDuelState(started);
      }
    });

    const unsubDuelState = subscribeDuelState((state) => {
      if (
        characterRef.current &&
        state.participants.some((p) => p.characterId === characterRef.current?.id)
      ) {
        setActiveDuelState(state);
      }
    });

    const unsubDuelFinish = subscribeDuelFinish(() => {
      setActiveDuelState((prev) => (prev ? { ...prev, status: "finished" } : null));
    });

    return () => {
      unsubInit();
      unsubDefense();
      unsubCombat();
      unsubActorStatus();
      unsubDuelInvite();
      unsubDuelResponse();
      unsubDuelState();
      unsubDuelFinish();
    };
  }, [
    character?.id,
    character?.name,
    joinCampaign,
    subscribeInitiativeRequest,
    subscribeDefenseRequest,
    subscribeCombatState,
    subscribeActorStatus,
    subscribeDuelInvite,
    subscribeDuelResponse,
    subscribeDuelState,
    subscribeDuelFinish,
    updateDuelState,
  ]);

  const handleDelete = async () => {
    if (!window.confirm("Tem certeza que deseja excluir este personagem?")) {
      return;
    }

    setIsDeleting(true);
    try {
      const response = await fetch(`/api/characters/${params.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const data = await response.json();
        setError(data.error || "Erro ao excluir personagem");
        setIsDeleting(false);
        return;
      }

      router.push("/player");
    } catch {
      setError("Erro de conexão. Tente novamente.");
      setIsDeleting(false);
    }
  };

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      const response = await fetch("/api/auth/logout", { method: "POST" });
      if (!response.ok) throw new Error("logout failed");
      router.push("/login");
      router.refresh();
    } catch {
      setError("Não foi possível encerrar a sessão.");
      setIsLoggingOut(false);
    }
  };

  const handleRespondDefense = async (
    reaction: "dodge" | "block",
    details: string,
    damageTaken: number
  ) => {
    if (!character || !defenseRequestPayload) return;

    const currentTarget = combatState?.combatants.find((combatant) => combatant.id === character.id);
    const updatedTarget = currentTarget ? applyHpChange(currentTarget, -damageTaken) : null;
    if (updatedTarget && combatState) {
      const nextState = {
        ...combatState,
        combatants: combatState.combatants.map((combatant) => combatant.id === updatedTarget.id ? updatedTarget : combatant),
        pendingReaction: null,
      };
      // O estado realtime é a fonte da verdade; persiste o mesmo resultado uma vez.
      updateCombatState(nextState);
      setCharacter((prev) => prev ? { ...prev, hitPointsCurrent: updatedTarget.hpCurrent } : prev);
      try {
        const response = await fetch(`/api/campaigns/${character.campaignId}/actors/${character.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ hitPointsCurrent: updatedTarget.hpCurrent, reason: "reação defensiva" }),
        });
        if (!response.ok) setError("HP atualizado em tempo real, mas a persistência falhou.");
      } catch {
        setError("HP atualizado em tempo real, mas a persistência falhou.");
      }
      updateActorStatus({ campaignId: character.campaignId ?? "", actorId: character.id, currentHp: updatedTarget.hpCurrent });
    }

    rollDice({
      campaignId: defenseRequestPayload.campaignId,
      actorId: character.id,
      actorName: character.name,
      rollType: "defesa",
      formula: reaction === "dodge" ? "Esquiva (Estática)" : "Bloqueio (Mitigação)",
      result: damageTaken,
      diceDetail: details,
    });

    respondDefenseReaction({
      campaignId: defenseRequestPayload.campaignId,
      reactionId: defenseRequestPayload.id,
      targetId: character.id,
      reaction,
    });

    setDefenseRequestPayload(null);
  };

  const handleCombatStateChange = (state: CombatSessionState) => {
    if (state.campaignId !== character?.campaignId) return;
    syncCharacterFromCombatState(state);
    setCombatState(state);
    updateCombatState(state);
  };

  const handleActorStatusChange = (actor: { characterId?: string; npcId?: string; id: string; hpCurrent: number; hpMax: number; manaCurrent?: number; manaMax?: number }) => {
    if (actor.characterId !== character?.id && actor.npcId !== character?.id && actor.id !== character?.id) return;
    setCharacter((prev) => prev ? {
      ...prev,
      hitPointsCurrent: actor.hpCurrent,
      hitPointsMax: actor.hpMax,
      ...(actor.manaCurrent == null ? {} : { manaPointsCurrent: actor.manaCurrent }),
      ...(actor.manaMax == null ? {} : { manaPointsMax: actor.manaMax }),
    } : prev);
  };

  const handleActionResult = (result: { title: string; formula: string; result: number; detail: string }) => {
    setActiveRollResult(result);
  };

  const handleSendInitiative = (val?: number) => {
    if (!character) return;
    const finalVal = val ?? (Number(manualInitiative) || Math.floor(Math.random() * 20) + 1);

    rollDice({
      campaignId: character.campaignId ?? "",
      actorId: character.id,
      actorName: character.name,
      rollType: "iniciativa",
      formula: "1d20 + Iniciativa",
      result: finalVal,
      diceDetail: `Rolou ${finalVal} para Iniciativa`,
    });

    setShowInitiativeModal(false);
    setManualInitiative("");
  };

  const handlePhoenixRebirth = async (newLevel: number, newHpMax: number, newManaMax: number) => {
    if (!character) return;
    try {
      const res = await fetch(`/api/characters/${character.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          level: newLevel,
          hitPointsMax: newHpMax,
          hitPointsCurrent: Math.floor(newHpMax * 0.5),
          manaPointsMax: newManaMax,
          manaPointsCurrent: Math.floor(newManaMax * 0.5),
        }),
      });

      if (res.ok) {
        const updated = await res.json();
        setCharacter(updated.data);
      }
    } catch {
      setError("Erro ao processar Renascimento Fênix.");
    }
  };

  const handlePermanentDeath = async (shadowPoints: number) => {
    if (!character) return;
    alert(`Personagem finalizado com Morte Definitiva. Você recebeu ${shadowPoints} Pontos de Sombra!`);
    router.push("/player");
  };

  const isCombatActive = Boolean(combatState?.active && combatState.combatants.length > 0);
  const myCombatant = isCombatActive && character
    ? combatState?.combatants.find((c) => c.id === character.id || c.characterId === character.id)
    : null;
  const currentCombatant = isCombatActive
    ? combatState?.combatants[combatState.currentTurnIndex]
    : null;

  // Bloqueio de turno: se o combate está ativo, o personagem está nele e NÃO é a vez dele
  const isTurnLocked = Boolean(
    isCombatActive &&
    myCombatant &&
    currentCombatant &&
    currentCombatant.id !== myCombatant.id
  );

  const handleRollAttribute = (attr: Attribute) => {
    if (!character) return;

    if (isTurnLocked) {
      alert("🔒 Fora do seu turno");
      return;
    }
    const stats = getDerivedStats(character.attributes, character.level);
    const mod = stats.modifiers[attr];
    const array = new Uint32Array(1);
    if (typeof window !== "undefined" && window.crypto) {
      window.crypto.getRandomValues(array);
    }
    const d20 = (array[0] % 20) + 1;
    const total = d20 + mod;
    const label = ATTRIBUTE_LABELS[attr];
    const formula = `1d20 + ${label} (${mod >= 0 ? `+${mod}` : mod})`;
    const detail = `Dado [${d20}] ${mod >= 0 ? `+ ${mod}` : `- ${Math.abs(mod)}`} = ${total}`;

    setActiveRollResult({
      title: `Teste de ${label}`,
      formula,
      result: total,
      detail,
    });

    rollDice({
      campaignId: character.campaignId ?? "",
      actorId: character.id,
      actorName: character.name,
      rollType: `Atributo: ${label}`,
      formula,
      result: total,
      diceDetail: detail,
      isManual: false,
    });

    // Dedução automática de ação de combate se for o turno do personagem (RF-040, RF-062)
    if (combatState?.active && combatState.combatants.length > 0) {
      const current = combatState.combatants[combatState.currentTurnIndex];
      if (current && (current.id === character.id || current.characterId === character.id)) {
        const spent = spendCombatActions(combatState, current.id, 1);
        if (spent.success) {
          updateCombatState(spent.session);
        }
      }
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-[80vh] flex-col items-center justify-center space-y-3">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-gray-800 border-t-purple-600" />
        <p className="text-xs text-gray-400 font-medium">Carregando ficha...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-md p-4">
        <div className="rounded-2xl border border-red-900/60 bg-red-950/40 p-4 text-center text-sm text-red-300">
          <p className="font-bold mb-1">Erro de Carregamento</p>
          <p>{error}</p>
          <Link href="/player" className="mt-3 inline-block text-xs font-semibold text-purple-400 underline">
            Voltar para Personagens
          </Link>
        </div>
      </div>
    );
  }

  if (!character) {
    return null;
  }

  const stats = getDerivedStats(character.attributes, character.level);
  const hpPercent = Math.min(100, Math.max(0, (character.hitPointsCurrent / Math.max(character.hitPointsMax, 1)) * 100));
  const manaPercent = Math.min(100, Math.max(0, (character.manaPointsCurrent / Math.max(character.manaPointsMax, 1)) * 100));

  return (
    <div className="relative mx-auto min-h-screen max-w-md bg-gray-950 text-gray-100 pb-24 shadow-2xl font-sans">
      {/* Top Header Mobile Bar */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-gray-800/80 bg-gray-900/90 px-4 py-3 backdrop-blur-md">
        <Link href="/player" className="text-sm font-bold text-gray-200 hover:text-white">
          Libmork — Jogador
        </Link>
        <span aria-label={isConnected ? "Conectado à mesa" : "Desconectado da mesa"} title={isConnected ? "Conectado à mesa" : "Desconectado da mesa"} className={`h-2.5 w-2.5 rounded-full ${isConnected ? "bg-emerald-400" : "bg-red-500"}`} />
      </header>

      {/* Banner de Combate Ativo */}
      {combatState?.active && combatState.combatants.length > 0 && (
        <div className="bg-purple-950/80 border-b border-purple-800/60 px-4 py-2 text-xs flex items-center justify-between">
          <span className="font-bold text-purple-300 flex items-center gap-1.5">
            ⚔️ Combate Rodada {combatState.round}
          </span>
          <span className="text-gray-300">
            Turno: <strong className="text-white">{combatState.combatants[combatState.currentTurnIndex]?.name}</strong>
          </span>
        </div>
      )}

      {/* Main Tab Content */}
      <main className="p-4 space-y-4">
        {isTurnLocked && (
          <div className="flex items-center justify-center gap-1.5 rounded-full border border-amber-800/60 bg-amber-950/40 px-3 py-1 text-xs font-bold text-amber-300 shadow-sm w-fit mx-auto">
            🔒 <span>Turno de {currentCombatant?.name}</span>
          </div>
        )}
        {/* Modal de Resultado de Rolagem de Dados */}
        {activeRollResult && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4"
            onClick={() => setActiveRollResult(null)}
          >
            <div
              className="w-full max-w-xs rounded-2xl border border-purple-600/50 bg-gray-900 p-5 text-center shadow-2xl animate-in fade-in zoom-in"
              onClick={(e) => e.stopPropagation()}
            >
              <span className="text-2xl mb-1 block">🎲</span>
              <h4 className="text-sm font-bold text-white">{activeRollResult.title}</h4>
              <p className="text-xs text-purple-300 font-semibold mb-3">{activeRollResult.formula}</p>
              
              <div className="my-2 rounded-xl bg-purple-950/80 border border-purple-800/60 py-4">
                <span className="text-4xl font-black text-purple-400">{activeRollResult.result}</span>
              </div>
              <p className="text-[11px] text-gray-400 mb-4">{activeRollResult.detail}</p>
              
              <button
                onClick={() => setActiveRollResult(null)}
                className="w-full rounded-xl bg-purple-600 py-2 text-xs font-bold text-white hover:bg-purple-700"
              >
                Fechar
              </button>
            </div>
          </div>
        )}

        {/* TAB 1: STATUS */}
        {activeTab === "status" && (
          <div className="space-y-4 animate-in fade-in duration-200">
            {/* Header Hero Card */}
            <div className="relative overflow-hidden rounded-2xl border border-gray-800 bg-gradient-to-b from-gray-900 to-gray-950 p-4 shadow-lg">
              <div className="flex items-center gap-4">
                {character.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={character.imageUrl}
                    alt={character.name}
                    className="h-20 w-20 shrink-0 rounded-2xl border-2 border-purple-600/60 object-cover shadow-md"
                  />
                ) : (
                  <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl border-2 border-purple-700/60 bg-purple-950/60 text-2xl font-black text-purple-300">
                    {character.name.slice(0, 2).toUpperCase()}
                  </div>
                )}

                <div className="min-w-0 flex-1">
                  <span className="inline-block rounded-md bg-purple-950/80 px-2 py-0.5 text-[10px] font-bold text-purple-300 border border-purple-800/60">
                    Nível {character.level}
                  </span>
                  <h2 className="mt-1 truncate text-xl font-bold text-white tracking-tight">{character.name}</h2>
                  <p className="text-xs text-gray-400">{character.xp} XP total</p>

                  {/* XP Progress Bar */}
                  <div className="mt-2.5 space-y-1">
                    <div className="flex justify-between text-[10px] text-gray-400 font-medium">
                      <span>Progresso XP</span>
                      <span>{character.xp % 100} / 100 XP</span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-800">
                      <div
                        className="h-full bg-gradient-to-r from-purple-600 to-blue-500 transition-all duration-300"
                        style={{ width: `${character.xp % 100}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Combat Stats: HP, Mana, Bloqueio */}
            <div className="grid grid-cols-3 gap-2.5">
              {/* HP Card */}
              <div className="flex flex-col justify-between rounded-2xl border border-red-900/60 bg-red-950/20 p-3 shadow-sm">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-red-400 uppercase tracking-wider">VIDA (HP)</span>
                    <span className="text-[10px] text-red-300 font-semibold">{Math.round(hpPercent)}%</span>
                  </div>
                  <p className="mt-1 text-lg font-black text-red-400">
                    {character.hitPointsCurrent} <span className="text-xs font-normal text-red-300/70">/ {character.hitPointsMax}</span>
                  </p>
                </div>

                <div className="mt-2 space-y-2">
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-900">
                    <div className="h-full bg-red-500 transition-all duration-300" style={{ width: `${hpPercent}%` }} />
                  </div>
                </div>
              </div>

              {/* Mana Card */}
              <div className="flex flex-col justify-between rounded-2xl border border-blue-900/60 bg-blue-950/20 p-3 shadow-sm">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-blue-400 uppercase tracking-wider">MANA (MP)</span>
                    <span className="text-[10px] text-blue-300 font-semibold">{Math.round(manaPercent)}%</span>
                  </div>
                  <p className="mt-1 text-lg font-black text-blue-400">
                    {character.manaPointsCurrent} <span className="text-xs font-normal text-blue-300/70">/ {character.manaPointsMax}</span>
                  </p>
                </div>

                <div className="mt-2 space-y-2">
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-900">
                    <div className="h-full bg-blue-500 transition-all duration-300" style={{ width: `${manaPercent}%` }} />
                  </div>
                </div>
              </div>

              {/* Bloqueio / Defesa Card */}
              <div className="flex flex-col justify-between rounded-2xl border border-gray-800 bg-gray-900/60 p-3 shadow-sm">
                <div>
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">BLOQUEIO</span>
                  <p className="mt-1 text-2xl font-black text-white">{stats.block}</p>
                </div>
                <div className="mt-2">
                  <p className="text-[10px] text-gray-500 leading-tight">Mitigação tática com Vigor</p>
                </div>
              </div>
            </div>

            {/* Atributos do Personagem com Rolagem Instantânea */}
            <div className="rounded-2xl border border-gray-800 bg-gray-900/80 p-4 shadow-sm">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-gray-300">Atributos Principais</h3>
                <span className="text-[10px] text-purple-400 font-medium">Toque para rolar d20</span>
              </div>

              <div className="space-y-2">
                {ATTRIBUTES.map((attr) => {
                  const mod = stats.modifiers[attr];
                  const value = character.attributes[attr];
                  return (
                    <button
                      key={attr}
                      onClick={() => handleRollAttribute(attr)}
                      disabled={isTurnLocked}
                      className={`flex w-full items-center justify-between rounded-xl border border-gray-800/80 bg-gray-950 p-2.5 transition-all ${
                        isTurnLocked
                          ? "opacity-50 cursor-not-allowed border-gray-900 bg-gray-950/40"
                          : "hover:border-purple-600/60 hover:bg-purple-950/20 active:scale-[0.99]"
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="text-lg">{ATTRIBUTE_ICONS[attr]}</span>
                        <span className="text-xs font-semibold text-gray-200">{ATTRIBUTE_LABELS[attr]}</span>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-white">{value}</span>
                        <span
                          className={`min-w-8 rounded-md py-0.5 px-1.5 text-center text-xs font-black ${
                            mod >= 0 ? "bg-emerald-950 text-emerald-400 border border-emerald-800/60" : "bg-rose-950 text-rose-400 border border-rose-800/60"
                          }`}
                        >
                          {mod >= 0 ? `+${mod}` : mod}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: PERÍCIAS */}
        {activeTab === "skills" && (
          <div className="space-y-4 animate-in fade-in duration-200">
            <div className="rounded-2xl border border-purple-900/60 bg-purple-950/20 p-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-purple-300">
                Perícias & Treinamento
              </h3>
              <p className="mt-1 text-xs text-gray-300">
                Slots de perícias treinadas disponíveis por Inteligência:{" "}
                <span className="font-bold text-purple-400">{stats.trainedSkillSlots}</span>
              </p>
            </div>

            {/* Gerenciador completo de Perícias */}
              <CharacterContent characterId={character.id} campaignId={character.campaignId} characterManaCurrent={character.manaPointsCurrent} characterManaMax={character.manaPointsMax} combatState={combatState} onCombatStateChange={handleCombatStateChange} onActorStatusChange={handleActorStatusChange} onActionResult={handleActionResult} combatants={combatState?.combatants ?? []} defaultType="skills" allowedTypes={["skills"]} isTurnLocked={isTurnLocked} onPersistActorStatus={async (actor, hp, mana) => { if (actor.characterId !== character.id && actor.id !== character.id && actor.type !== "npc" && !actor.npcId) return; const response = await fetch(`/api/campaigns/${character.campaignId}/actors/${actor.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ hitPointsCurrent: hp, ...(mana == null ? {} : { manaPointsCurrent: mana }), reason: "combate" }) }); if (!response.ok) setError("Estado atualizado em tempo real, mas a persistência falhou."); }} />
          </div>
        )}

        {/* TAB 3: INVENTÁRIO */}
        {activeTab === "inventory" && (
          <div className="space-y-4 animate-in fade-in duration-200">
            {/* Conteúdo da Ficha (Itens, Magias, Habilidades, Condições) */}
              <CharacterContent characterId={character.id} campaignId={character.campaignId} characterManaCurrent={character.manaPointsCurrent} characterManaMax={character.manaPointsMax} combatState={combatState} onCombatStateChange={handleCombatStateChange} onActorStatusChange={handleActorStatusChange} onActionResult={handleActionResult} combatants={combatState?.combatants ?? []} defaultType="items" allowedTypes={["items", "spells", "conditions"]} isTurnLocked={isTurnLocked} onPersistActorStatus={async (actor, hp, mana) => { if (actor.characterId !== character.id && actor.id !== character.id && actor.type !== "npc" && !actor.npcId) return; const response = await fetch(`/api/campaigns/${character.campaignId}/actors/${actor.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ hitPointsCurrent: hp, ...(mana == null ? {} : { manaPointsCurrent: mana }), reason: "combate" }) }); if (!response.ok) setError("Estado atualizado em tempo real, mas a persistência falhou."); }} />
          </div>
        )}

        {/* TAB 4: CONFIGURAÇÕES */}
        {activeTab === "settings" && (
          <div className="space-y-4 animate-in fade-in duration-200">
            <div className="rounded-2xl border border-gray-800 bg-gray-900 p-4 space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-gray-300">
                Gerenciamento da Ficha
              </h3>

              <div className="flex flex-col gap-2 border-b border-gray-800 pb-4">
                <button type="button" onClick={() => setShowDuelInviteModal(true)} className="w-full rounded-xl border border-rose-800/80 bg-rose-950/40 py-2.5 text-xs font-bold text-rose-300 hover:bg-rose-900/60">
                  ⚔️ Duelo P2P
                </button>
                {userShadowPoints > 0 && (
                  <button type="button" onClick={() => setShowShadowModal(true)} className="w-full rounded-xl border border-purple-800/80 bg-purple-950/40 py-2.5 text-xs font-bold text-purple-300 hover:bg-purple-900/60">
                    🔮 Gastar Sombra ({userShadowPoints})
                  </button>
                )}
              </div>

              {/* Upload de Foto */}
              <div className="border-b border-gray-800 pb-4">
                <p className="mb-2 text-xs font-medium text-gray-400">Imagem do Personagem</p>
                <ImageUpload
                  characterId={character.id}
                  currentImageUrl={character.imageUrl}
                  characterName={character.name}
                  onUploaded={(imageUrl) =>
                    setCharacter((prev) => (prev ? { ...prev, imageUrl } : prev))
                  }
                />
              </div>

              {/* Links Públicos de Compartilhamento */}
              <div className="border-b border-gray-800 pb-4">
                <ShareLink characterId={character.id} />
              </div>

              {/* Associação de Etiquetas NFC */}
              <div className="border-b border-gray-800 pb-4">
                <NfcManager characterId={character.id} />
              </div>

              {/* Exclusão do Personagem */}
              <div className="pt-2">
                <button type="button" onClick={() => void handleLogout()} disabled={isLoggingOut} className="mb-2 w-full rounded-xl border border-gray-700 bg-gray-800 py-2.5 text-xs font-bold text-gray-200 hover:bg-gray-700 disabled:opacity-50">
                  {isLoggingOut ? "Saindo..." : "Sair"}
                </button>
                <button
                  onClick={handleDelete}
                  disabled={isDeleting}
                  className="w-full rounded-xl border border-red-800/80 bg-red-950/40 py-2.5 text-xs font-bold text-red-300 hover:bg-red-900/60 disabled:opacity-50"
                >
                  {isDeleting ? "Excluindo Ficha..." : "🗑️ Excluir Personagem"}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Overlay Compacto de Turno do Jogador (apenas em combate ativo) */}
      {combatState && character && (
        <PlayerTurnOverlay combatState={combatState} characterId={character.id} />
      )}

      {/* Sticky Bottom Navigation Bar (Menu Inferior com Ícones Filled) */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 mx-auto max-w-md border-t border-gray-800/80 bg-gray-900/95 py-2 px-3 backdrop-blur-lg shadow-2xl">
        <div className="flex items-center justify-around">
          {/* Tab 1: Status */}
          <button
            onClick={() => setActiveTab("status")}
            className={`flex flex-col items-center gap-1 px-3 py-1 transition-all ${
              activeTab === "status"
                ? "text-purple-400 scale-105"
                : "text-gray-500 hover:text-gray-300"
            }`}
          >
            <StatusFilledIcon className={`h-6 w-6 ${activeTab === "status" ? "fill-purple-400" : "fill-gray-500"}`} />
            <span className={`text-[10px] font-bold ${activeTab === "status" ? "text-purple-400" : "text-gray-400"}`}>
              Status
            </span>
          </button>

          {/* Tab 2: Perícias */}
          <button
            onClick={() => setActiveTab("skills")}
            className={`flex flex-col items-center gap-1 px-3 py-1 transition-all ${
              activeTab === "skills"
                ? "text-purple-400 scale-105"
                : "text-gray-500 hover:text-gray-300"
            }`}
          >
            <SkillsFilledIcon className={`h-6 w-6 ${activeTab === "skills" ? "fill-purple-400" : "fill-gray-500"}`} />
            <span className={`text-[10px] font-bold ${activeTab === "skills" ? "text-purple-400" : "text-gray-400"}`}>
              Perícias
            </span>
          </button>

          {/* Tab 3: Inventário */}
          <button
            onClick={() => setActiveTab("inventory")}
            className={`flex flex-col items-center gap-1 px-3 py-1 transition-all ${
              activeTab === "inventory"
                ? "text-purple-400 scale-105"
                : "text-gray-500 hover:text-gray-300"
            }`}
          >
            <InventoryFilledIcon className={`h-6 w-6 ${activeTab === "inventory" ? "fill-purple-400" : "fill-gray-500"}`} />
            <span className={`text-[10px] font-bold ${activeTab === "inventory" ? "text-purple-400" : "text-gray-400"}`}>
              Inventário
            </span>
          </button>

          {/* Tab 4: Configurações */}
          <button
            onClick={() => setActiveTab("settings")}
            className={`flex flex-col items-center gap-1 px-3 py-1 transition-all ${
              activeTab === "settings"
                ? "text-purple-400 scale-105"
                : "text-gray-500 hover:text-gray-300"
            }`}
          >
            <SettingsFilledIcon className={`h-6 w-6 ${activeTab === "settings" ? "fill-purple-400" : "fill-gray-500"}`} />
            <span className={`text-[10px] font-bold ${activeTab === "settings" ? "text-purple-400" : "text-gray-400"}`}>
              Configurações
            </span>
          </button>
        </div>
      </nav>

      {/* Modais de Fase 5 — Pontos de Sombra e Duelo P2P */}
      {character && (
        <>
          <ShadowPointsModal
            characterId={character.id}
            campaignId={character.campaignId ?? ""}
            userShadowPoints={userShadowPoints}
            isOpen={showShadowModal}
            onClose={() => setShowShadowModal(false)}
            onSuccess={(addedBonus) => {
              alert(`Bônus +2 de Pontos de Sombra ativado no alvo: ${addedBonus.target}`);
            }}
          />

          <DuelInviteModal
            campaignId={character.campaignId ?? ""}
            challengerId={character.id}
            challengerName={character.name}
            roster={[{ id: character.id, name: character.name }]}
            isOpen={showDuelInviteModal}
            onClose={() => setShowDuelInviteModal(false)}
          />

          <DuelIncomingInviteModal
            invite={incomingDuelInvite}
            onRespond={() => setIncomingDuelInvite(null)}
          />

          <DuelArenaModal
            duelState={activeDuelState}
            myCharacterId={character.id}
            isOpen={Boolean(activeDuelState)}
            onClose={() => setActiveDuelState(null)}
          />
        </>
      )}

      {/* Pop-up Requisitado pelo Mestre: Rolar Iniciativa (RF-039) */}
      {showInitiativeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-md">
          <div className="flex w-full max-w-xs flex-col rounded-3xl border border-purple-600 bg-gray-950 p-6 text-center shadow-2xl space-y-4">
            <span className="text-4xl">⚔️</span>
            <h3 className="text-lg font-bold text-white">REQUISITADO PELO MESTRE</h3>
            <p className="text-xs text-purple-300">Role seu teste de Iniciativa para a rodada de combate!</p>

            <div className="space-y-2">
              <button
                onClick={() => {
                  const mod = Math.floor(((character?.attributes?.destreza ?? 10) - 10) / 2);
                  const die = Math.floor(Math.random() * 20) + 1;
                  handleSendInitiative(die + mod);
                }}
                className="w-full rounded-2xl bg-purple-600 py-3 text-sm font-bold text-white shadow-lg hover:bg-purple-500"
              >
                🎲 Rolar Digitalmente (1d20 + Mod)
              </button>

              <div className="flex items-center gap-2 pt-2 border-t border-gray-800">
                <input
                  type="number"
                  placeholder="Ou digite o dado físico..."
                  value={manualInitiative}
                  onChange={(e) => setManualInitiative(e.target.value)}
                  className="w-full rounded-xl border border-gray-800 bg-gray-900 px-3 py-2 text-center text-xs text-white"
                />
                <button
                  onClick={() => handleSendInitiative()}
                  disabled={!manualInitiative}
                  className="rounded-xl bg-purple-900 px-3 py-2 text-xs font-bold text-purple-200 disabled:opacity-40"
                >
                  Enviar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Reação Defensiva quando Atacado (RF-066) */}
      {defenseRequestPayload && character && (
        <DefenseReactionModal
          requestPayload={defenseRequestPayload}
          targetVigor={character.attributes.vigor}
          targetDestreza={character.attributes.destreza}
          targetLevel={character.level}
          onRespond={handleRespondDefense}
          onClose={() => setDefenseRequestPayload(null)}
        />
      )}

      {/* Overlay de Morte / Caveira a 0 HP (RF-042, RF-043, RF-044) */}
      {character && character.hitPointsCurrent <= 0 && (
        <DeathSaveModal
          characterName={character.name}
          level={character.level}
          vigor={character.attributes.vigor}
          inteligencia={character.attributes.inteligencia}
          onRollDeathSave={(_success, _die, _dc, details) => {
            rollDice({
      campaignId: character.campaignId ?? "",
              actorId: character.id,
              actorName: character.name,
              rollType: "salvaguarda_morte",
              formula: "1d20 seco",
              result: _die,
              diceDetail: details,
            });
          }}
          onPhoenixRebirth={handlePhoenixRebirth}
          onPermanentDeath={handlePermanentDeath}
        />
      )}
    </div>
  );
}
