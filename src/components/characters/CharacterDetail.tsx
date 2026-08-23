"use client";

import { useEffect, useState } from "react";
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
import { useSocket, type DefenseReactionRequestPayload } from "@/context/SocketContext";
import { DefenseReactionModal } from "@/components/combat/DefenseReactionModal";
import { DeathSaveModal } from "@/components/combat/DeathSaveModal";
import type { CombatSessionState } from "@/lib/engine";

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
    subscribeInitiativeRequest,
    subscribeDefenseRequest,
    subscribeCombatState,
    respondDefenseReaction,
  } = useSocket();

  const [character, setCharacter] = useState<Character | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>("status");
  const [isMutatingHpMp, setIsMutatingHpMp] = useState(false);

  // Combate & Interações ao vivo
  const [combatState, setCombatState] = useState<CombatSessionState | null>(null);
  const [showInitiativeModal, setShowInitiativeModal] = useState(false);
  const [manualInitiative, setManualInitiative] = useState("");
  const [defenseRequestPayload, setDefenseRequestPayload] = useState<DefenseReactionRequestPayload | null>(null);

  // Rolagem de Dados
  const [activeRollResult, setActiveRollResult] = useState<{
    title: string;
    formula: string;
    result: number;
    detail: string;
  } | null>(null);

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

    const unsubInit = subscribeInitiativeRequest(() => {
      setShowInitiativeModal(true);
    });

    const unsubDefense = subscribeDefenseRequest((payload) => {
      if (character && payload.targetId === character.id) {
        setDefenseRequestPayload(payload);
      }
    });

    const unsubCombat = subscribeCombatState((state) => {
      setCombatState(state);
    });

    return () => {
      cancelled = true;
      unsubInit();
      unsubDefense();
      unsubCombat();
    };
  }, [params.id, character, subscribeInitiativeRequest, subscribeDefenseRequest, subscribeCombatState]);

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

  const handleModifyHpMp = async (hpDelta: number, manaDelta: number) => {
    if (!character || isMutatingHpMp) return;
    setIsMutatingHpMp(true);

    const newHp = Math.max(0, Math.min(character.hitPointsMax, character.hitPointsCurrent + hpDelta));
    const newMana = Math.max(0, Math.min(character.manaPointsMax, character.manaPointsCurrent + manaDelta));

    // Atualização otimista local
    setCharacter((prev) =>
      prev
        ? {
            ...prev,
            hitPointsCurrent: newHp,
            manaPointsCurrent: newMana,
          }
        : prev
    );

    try {
      // Usar a rota de atualização do personagem se disponível ou a rota da campanha
      // Atualização via socket para a mesa em tempo real
      updateActorStatus({
        campaignId: character.id,
        actorId: character.id,
        currentHp: newHp,
        currentMana: newMana,
      });
    } catch {
      // ignore
    } finally {
      setIsMutatingHpMp(false);
    }
  };

  const handleRespondDefense = async (
    reaction: "dodge" | "block",
    details: string,
    damageTaken: number
  ) => {
    if (!character || !defenseRequestPayload) return;

    if (damageTaken > 0) {
      await handleModifyHpMp(-damageTaken, 0);
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

  const handleSendInitiative = (val?: number) => {
    if (!character) return;
    const finalVal = val ?? (Number(manualInitiative) || Math.floor(Math.random() * 20) + 1);

    rollDice({
      campaignId: "global",
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

  const handleRollAttribute = (attr: Attribute) => {
    if (!character) return;
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
      campaignId: character.id,
      actorId: character.id,
      actorName: character.name,
      rollType: `Atributo: ${label}`,
      formula,
      result: total,
      diceDetail: detail,
      isManual: false,
    });
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
        <Link href="/player" className="flex items-center gap-1.5 text-xs font-semibold text-gray-400 hover:text-white">
          <span>‹</span> Meus Personagens
        </Link>

        <div className="flex items-center gap-2">
          <span
            className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${
              isConnected ? "bg-emerald-950 text-emerald-400 border border-emerald-800/60" : "bg-gray-800 text-gray-400"
            }`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${isConnected ? "bg-emerald-400 animate-pulse" : "bg-gray-500"}`} />
            {isConnected ? "Mesa Ao Vivo" : "Offline"}
          </span>
        </div>
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
                  <div className="flex gap-1 pt-1">
                    <button
                      onClick={() => handleModifyHpMp(-1, 0)}
                      className="flex-1 rounded-md bg-red-900/60 py-1 text-[10px] font-bold text-red-200 hover:bg-red-800 active:scale-95"
                    >
                      -1
                    </button>
                    <button
                      onClick={() => handleModifyHpMp(1, 0)}
                      className="flex-1 rounded-md bg-red-900/60 py-1 text-[10px] font-bold text-red-200 hover:bg-red-800 active:scale-95"
                    >
                      +1
                    </button>
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
                  <div className="flex gap-1 pt-1">
                    <button
                      onClick={() => handleModifyHpMp(0, -1)}
                      className="flex-1 rounded-md bg-blue-900/60 py-1 text-[10px] font-bold text-blue-200 hover:bg-blue-800 active:scale-95"
                    >
                      -1
                    </button>
                    <button
                      onClick={() => handleModifyHpMp(0, 1)}
                      className="flex-1 rounded-md bg-blue-900/60 py-1 text-[10px] font-bold text-blue-200 hover:bg-blue-800 active:scale-95"
                    >
                      +1
                    </button>
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
                      className="flex w-full items-center justify-between rounded-xl border border-gray-800/80 bg-gray-950 p-2.5 transition-all hover:border-purple-600/60 hover:bg-purple-950/20 active:scale-[0.99]"
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
            <CharacterContent characterId={character.id} defaultType="skills" allowedTypes={["skills"]} />
          </div>
        )}

        {/* TAB 3: INVENTÁRIO */}
        {activeTab === "inventory" && (
          <div className="space-y-4 animate-in fade-in duration-200">
            {/* Conteúdo da Ficha (Itens, Magias, Habilidades, Condições) */}
            <CharacterContent characterId={character.id} defaultType="items" allowedTypes={["items", "spells", "conditions"]} />
          </div>
        )}

        {/* TAB 4: CONFIGURAÇÕES */}
        {activeTab === "settings" && (
          <div className="space-y-4 animate-in fade-in duration-200">
            <div className="rounded-2xl border border-gray-800 bg-gray-900 p-4 space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-gray-300">
                Gerenciamento da Ficha
              </h3>

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
              campaignId: character.id,
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
