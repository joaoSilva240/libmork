"use client";

import { useState, useEffect } from "react";
import type { CoinsBalance } from "@/lib/validators/character";
import { Spinner, Button } from "@/components/ui";
import { generateUUID } from "@/lib/utils/uuid";
import { formatPrice } from "@/lib/content/pf2e-item-formatter";

export interface WealthCharacter {
  id: string;
  name: string;
  imageUrl?: string | null;
  level: number;
  deathStatus?: string;
  coins: CoinsBalance;
}

export interface WealthData {
  totals: CoinsBalance;
  characters: WealthCharacter[];
}

export interface WealthManagerProps {
  initialData?: WealthData | null;
  isLoading?: boolean;
  error?: string | null;
  onRefresh?: () => Promise<void> | void;
  onShowToast?: (message: string, type?: "error" | "success" | "info" | "warning") => void;
}

const COIN_CONFIG: Record<
  keyof CoinsBalance,
  { name: string; icon: string; color: string; bg: string; border: string; valueInGold: number }
> = {
  diamante: {
    name: "Diamante",
    icon: "💎",
    color: "text-[#B9F2FF]",
    bg: "bg-cyan-950/40",
    border: "border-cyan-800/50",
    valueInGold: 1000,
  },
  platina: {
    name: "Platina",
    icon: "🔷",
    color: "text-[#E5E4E2]",
    bg: "bg-slate-900/60",
    border: "border-slate-700/50",
    valueInGold: 10,
  },
  ouro: {
    name: "Ouro",
    icon: "🟡",
    color: "text-[#FFD700]",
    bg: "bg-amber-950/40",
    border: "border-amber-700/50",
    valueInGold: 1,
  },
  prata: {
    name: "Prata",
    icon: "⚪",
    color: "text-[#C0C0C0]",
    bg: "bg-zinc-900/60",
    border: "border-zinc-700/50",
    valueInGold: 0.1,
  },
  bronze: {
    name: "Bronze",
    icon: "🟤",
    color: "text-[#CD7F32]",
    bg: "bg-orange-950/40",
    border: "border-orange-800/50",
    valueInGold: 0.01,
  },
};

const COIN_KEYS: (keyof CoinsBalance)[] = ["diamante", "platina", "ouro", "prata", "bronze"];

interface TransferLog {
  id: string;
  timestamp: string;
  sourceName: string;
  targetName: string;
  amount: number;
  coinType: keyof CoinsBalance;
}

interface InventoryItemData {
  content?: {
    id?: string;
    name?: string;
    price?: unknown;
    priceGold?: number;
    sourceData?: {
      price?: unknown;
      [key: string]: unknown;
    };
    [key: string]: unknown;
  };
  junction?: {
    quantity?: number;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

function parseItemPriceInGold(content?: InventoryItemData["content"]): number | null {
  if (!content) return null;
  const rawPrice = content.sourceData?.price ?? content.priceGold ?? content.price;
  if (rawPrice === null || rawPrice === undefined) return null;

  if (typeof rawPrice === "number") {
    return isNaN(rawPrice) ? null : rawPrice;
  }

  if (typeof rawPrice === "string") {
    const trimmed = rawPrice.trim();
    if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
      try {
        const parsed = JSON.parse(trimmed);
        return parseItemPriceInGold({ ...content, price: parsed, sourceData: undefined, priceGold: undefined });
      } catch {
        const num = parseFloat(trimmed);
        return isNaN(num) ? null : num;
      }
    }
    const num = parseFloat(trimmed);
    return isNaN(num) ? null : num;
  }

  if (typeof rawPrice === "object") {
    let valueObj = rawPrice as Record<string, unknown>;
    if (valueObj.value && typeof valueObj.value === "object") {
      valueObj = valueObj.value as Record<string, unknown>;
    }
    const pp = Number(valueObj.pp) || 0;
    const gp = Number(valueObj.gp) || 0;
    const sp = Number(valueObj.sp) || 0;
    const cp = Number(valueObj.cp) || 0;
    const hasAny =
      valueObj.pp !== undefined ||
      valueObj.gp !== undefined ||
      valueObj.sp !== undefined ||
      valueObj.cp !== undefined;
    if (!hasAny) return null;
    return pp * 10 + gp * 1 + sp * 0.1 + cp * 0.01;
  }

  return null;
}

function getItemPriceFormatted(content?: InventoryItemData["content"]): string {
  if (!content) return "Sem valor comercial";
  const rawPrice = content.sourceData?.price ?? content.priceGold ?? content.price;
  if (rawPrice === null || rawPrice === undefined) return "Sem valor comercial";
  const formatted = formatPrice(rawPrice, "pt");
  if (!formatted || formatted.trim() === "" || formatted === "0") {
    if (typeof rawPrice === "number" && rawPrice === 0) return "0 PO";
    return "Sem valor comercial";
  }
  return formatted;
}

export function WealthManager({
  initialData,
  isLoading,
  error,
  onRefresh,
  onShowToast,
}: WealthManagerProps) {
  const [sourceId, setSourceId] = useState<string>("");
  const [targetId, setTargetId] = useState<string>("");
  const [selectedCoin, setSelectedCoin] = useState<keyof CoinsBalance>("ouro");
  const [amount, setAmount] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [sessionLogs, setSessionLogs] = useState<TransferLog[]>([]);
  const [isTransferModalOpen, setIsTransferModalOpen] = useState<boolean>(false);
  const [detailChar, setDetailChar] = useState<WealthCharacter | null>(null);
  const [detailTab, setDetailTab] = useState<"inventory" | "statement">("inventory");
  const [inventoryMap, setInventoryMap] = useState<Record<string, InventoryItemData[]>>({});
  const [loadingInventory, setLoadingInventory] = useState<boolean>(false);

  const characters = initialData?.characters ?? [];
  const totals = initialData?.totals ?? {
    bronze: 0,
    prata: 0,
    ouro: 0,
    platina: 0,
    diamante: 0,
  };

  const totalInGold =
    totals.diamante * 1000 +
    totals.platina * 10 +
    totals.ouro * 1 +
    totals.prata * 0.1 +
    totals.bronze * 0.01;

  const sourceChar = characters.find((c) => c.id === sourceId);
  const targetChar = characters.find((c) => c.id === targetId);
  const availableInSource = sourceChar ? (sourceChar.coins[selectedCoin] ?? 0) : 0;

  const handleOpenTransfer = (charId: string) => {
    setSourceId(charId);
    const otherChar = characters.find((c) => c.id !== charId);
    if (!targetId || targetId === charId) {
      if (otherChar) {
        setTargetId(otherChar.id);
      }
    }
    setAmount("");
    setIsTransferModalOpen(true);
  };

  const handleCloseTransfer = () => {
    setIsTransferModalOpen(false);
  };

  const handleOpenDetail = (char: WealthCharacter) => {
    setDetailChar(char);
    setDetailTab("inventory");
  };

  const handleCloseDetail = () => {
    setDetailChar(null);
  };

  useEffect(() => {
    if (!detailChar) return;
    const charId = detailChar.id;
    if (inventoryMap[charId]) return;

    let isMounted = true;
    setLoadingInventory(true);

    fetch(`/api/characters/${charId}/content/items`, { credentials: "include" })
      .then((res) => {
        if (!res.ok) return { data: { linked: [] } };
        return res.json();
      })
      .then((data) => {
        if (!isMounted) return;
        const linkedItems: InventoryItemData[] =
          data?.data?.linked ?? (Array.isArray(data?.data) ? data.data : []);
        setInventoryMap((prev) => ({
          ...prev,
          [charId]: linkedItems,
        }));
      })
      .catch(() => {
        if (!isMounted) return;
        setInventoryMap((prev) => ({
          ...prev,
          [charId]: [],
        }));
      })
      .finally(() => {
        if (isMounted) setLoadingInventory(false);
      });

    return () => {
      isMounted = false;
    };
  }, [detailChar?.id]);

  const handleMaxAmount = () => {
    setAmount(String(availableInSource));
  };

  const handleTransfer = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!sourceId || !targetId) {
      onShowToast?.("Selecione o personagem de origem e de destino", "error");
      return;
    }

    if (sourceId === targetId) {
      onShowToast?.("O personagem de destino deve ser diferente da origem", "error");
      return;
    }

    const numAmount = parseInt(amount, 10);
    if (isNaN(numAmount) || numAmount <= 0) {
      onShowToast?.("Informe uma quantidade válida maior que zero", "error");
      return;
    }

    if (numAmount > availableInSource) {
      onShowToast?.(
        `Saldo insuficiente. O personagem possui apenas ${availableInSource} de ${COIN_CONFIG[selectedCoin].name.toLowerCase()}`,
        "error"
      );
      return;
    }

    try {
      setIsSubmitting(true);
      const res = await fetch("/api/player/wealth/transfer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          sourceCharacterId: sourceId,
          targetCharacterId: targetId,
          coinType: selectedCoin,
          amount: numAmount,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        onShowToast?.(data.error || "Erro ao realizar transferência", "error");
        return;
      }

      onShowToast?.("Transferência realizada com sucesso!", "success");

      const logTimestamp = new Intl.DateTimeFormat("pt-BR", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      }).format(new Date());
      const logId = generateUUID();

      // Adiciona ao log local da sessão
      setSessionLogs((prev) => [
        {
          id: logId,
          timestamp: logTimestamp,
          sourceName: sourceChar?.name ?? "Origem",
          targetName: targetChar?.name ?? "Destino",
          amount: numAmount,
          coinType: selectedCoin,
        },
        ...prev,
      ]);

      // Limpa campos e fecha o modal
      setAmount("");
      setIsTransferModalOpen(false);

      // Atualiza os dados
      if (onRefresh) {
        await onRefresh();
      }
    } catch {
      onShowToast?.("Erro de conexão ao transferir riqueza", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-[300px] items-center justify-center py-12">
        <Spinner size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-accent-vibrant/40 bg-accent-dark/30 p-4 text-secondary-pure">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 1. Cofre do Jogador & Tesouraria - Design Minimalista de 1 Linha */}
      <section
        aria-label="Cofre Consolidado"
        className="rounded-2xl border border-purple-800/40 bg-gradient-to-r from-gray-950 via-purple-950/20 to-gray-950 p-4 shadow-xl"
      >
        <div className="flex flex-wrap items-center justify-between gap-4">
          {/* Lado Esquerdo: Título & Saldo Principal Destacado */}
          <div className="flex flex-wrap items-center gap-4 sm:gap-6">
            <div className="flex items-center gap-2.5">
              <span className="text-2xl" role="img" aria-label="Tesouro">🏛️</span>
              <div>
                <h2 className="text-sm font-semibold tracking-wide text-gray-300">
                  Cofre do Jogador & Tesouraria
                </h2>
                <span className="text-[11px] text-gray-500 hidden sm:inline">
                  Patrimônio consolidado
                </span>
              </div>
            </div>

            <div className="h-7 w-px bg-gray-800 hidden sm:block" />

            {/* Saldo Consolidado em Ouro em Destaque Maior */}
            <div className="flex items-center gap-2 bg-amber-950/30 border border-amber-500/30 rounded-xl px-3.5 py-1.5 shadow-[0_0_15px_rgba(245,158,11,0.15)]">
              <span className="text-lg">🪙</span>
              <span className="text-xs font-semibold text-amber-300/90 uppercase tracking-wider hidden xs:inline">
                Total:
              </span>
              <span className="text-xl sm:text-2xl font-black tracking-tight text-amber-300">
                {totalInGold.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 2 })} PO
              </span>
            </div>
          </div>

          {/* Lado Direito: Badges Compactos Elegantes das Demais Moedas Inline */}
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
            {COIN_KEYS.map((key) => {
              const conf = COIN_CONFIG[key];
              const coinAmount = totals[key] ?? 0;
              return (
                <div
                  key={key}
                  title={`${conf.name}: ${coinAmount.toLocaleString("pt-BR")}`}
                  className={`inline-flex items-center gap-1.5 rounded-lg border ${conf.border} ${conf.bg} px-2.5 py-1 text-xs`}
                >
                  <span className="text-xs">{conf.icon}</span>
                  <span className="text-[10px] uppercase font-bold text-gray-400 hidden md:inline">
                    {conf.name}:
                  </span>
                  <span className={`font-bold ${conf.color}`}>
                    {coinAmount.toLocaleString("pt-BR")}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* 2. Grid de Personagens e seus Saldos Detalhados */}
      <section aria-label="Saldos por Personagem" className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-white">Saldos por Personagem</h3>
          {characters.length >= 2 && (
            <button
              type="button"
              onClick={() => handleOpenTransfer(characters[0].id)}
              className="text-xs font-semibold text-purple-300 hover:text-purple-200 transition-colors"
            >
              Transferir Riqueza ➔
            </button>
          )}
        </div>

        {characters.length === 0 ? (
          <div className="rounded-xl border border-gray-800 bg-gray-900/60 p-8 text-center text-sm text-gray-400">
            Nenhum personagem cadastrado.
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {characters.map((char) => {
              const charTotalInGold =
                (char.coins.diamante ?? 0) * 1000 +
                (char.coins.platina ?? 0) * 10 +
                (char.coins.ouro ?? 0) * 1 +
                (char.coins.prata ?? 0) * 0.1 +
                (char.coins.bronze ?? 0) * 0.01;

              return (
                <div
                  key={char.id}
                  onClick={() => handleOpenDetail(char)}
                  className="rounded-xl border border-gray-800 bg-gray-900/80 p-4 shadow-md flex flex-col justify-between hover:border-purple-600/50 hover:bg-gray-900 cursor-pointer transition-all"
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      handleOpenDetail(char);
                    }
                  }}
                  aria-label={`Ver detalhes de riqueza de ${char.name}`}
                >
                  <div className="flex items-center gap-3 border-b border-gray-800 pb-3">
                    {char.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={char.imageUrl}
                        alt={char.name}
                        className="h-10 w-10 rounded-full object-cover shrink-0 ring-2 ring-purple-600/40"
                      />
                    ) : (
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-purple-950 text-purple-300 font-bold text-sm shrink-0 border border-purple-800">
                        {char.name.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <h4 className="text-sm font-bold text-white truncate">{char.name}</h4>
                      <p className="text-[11px] text-gray-400">
                        Nível {char.level} ·{" "}
                        <span className="text-amber-400 font-semibold">
                          ~{charTotalInGold.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} PO
                        </span>
                      </p>
                    </div>

                    {/* Botão Transferir por Personagem: apenas ícone ⇄ */}
                    {characters.length >= 2 && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenTransfer(char.id);
                        }}
                        className="rounded-lg border border-purple-800/60 bg-purple-950/50 hover:bg-purple-900/60 p-2 text-sm font-semibold text-purple-300 transition-all shadow-sm shrink-0 flex items-center justify-center hover:text-white"
                        aria-label={`Transferir moedas de ${char.name}`}
                        title={`Transferir moedas de ${char.name}`}
                      >
                        <span className="text-base leading-none">⇄</span>
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-5 gap-1.5 pt-3">
                    {COIN_KEYS.map((k) => (
                      <div
                        key={k}
                        className="flex flex-col items-center bg-gray-950/70 border border-gray-800/80 rounded-lg py-1.5"
                        title={COIN_CONFIG[k].name}
                      >
                        <span className="text-xs">{COIN_CONFIG[k].icon}</span>
                        <span className={`text-[11px] font-bold mt-1 ${COIN_CONFIG[k].color}`}>
                          {(char.coins[k] ?? 0).toLocaleString("pt-BR")}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* 3. Histórico de Transferências Recentes (Discreto/Compacto) */}
      {sessionLogs.length > 0 && (
        <section
          aria-label="Transferências Recentes"
          className="rounded-xl border border-gray-800/80 bg-gray-900/40 p-4"
        >
          <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2.5 flex items-center gap-2">
            <span>📜</span>
            <span>Transferências Recentes (Sessão Atual)</span>
          </h4>
          <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
            {sessionLogs.map((log) => {
              const conf = COIN_CONFIG[log.coinType];
              return (
                <div
                  key={log.id}
                  className="flex items-center justify-between rounded-lg border border-gray-800/80 bg-gray-950/50 px-3 py-2 text-xs"
                >
                  <div className="flex items-center gap-2 text-gray-300">
                    <span className="text-gray-500 font-mono text-[10px]">{log.timestamp}</span>
                    <span className="font-semibold text-white">{log.sourceName}</span>
                    <span className="text-gray-500">➔</span>
                    <span className="font-semibold text-white">{log.targetName}</span>
                  </div>
                  <div className="flex items-center gap-1 font-bold">
                    <span className={conf.color}>+{log.amount.toLocaleString("pt-BR")}</span>
                    <span>{conf.icon}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* 4. Modal / Overlay Flutuante de Transferência */}
      {isTransferModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="transfer-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200"
          onClick={handleCloseTransfer}
        >
          <div
            className="w-full max-w-lg rounded-2xl border border-purple-800/60 bg-gray-950 p-6 text-gray-100 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Cabeçalho do Modal */}
            <div className="flex items-center justify-between border-b border-gray-800 pb-3">
              <div className="flex items-center gap-2">
                <span className="text-xl">⚖️</span>
                <div>
                  <h3 id="transfer-modal-title" className="text-base font-bold text-white">
                    Transferir Moedas
                  </h3>
                  <p className="text-xs text-gray-400">
                    Mova riquezas entre seus heróis sem taxas ou perdas
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleCloseTransfer}
                className="text-gray-400 hover:text-white rounded-lg p-1 text-sm transition-colors"
                aria-label="Fechar"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleTransfer} className="space-y-4 pt-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Origem */}
                <div>
                  <label htmlFor="source-character-select" className="block text-xs font-semibold text-gray-300 mb-1.5">
                    Personagem de Origem (Quem envia)
                  </label>
                  <select
                    id="source-character-select"
                    value={sourceId}
                    onChange={(e) => {
                      const newSourceId = e.target.value;
                      setSourceId(newSourceId);
                      if (newSourceId === targetId) {
                        const fallbackTarget = characters.find((c) => c.id !== newSourceId);
                        setTargetId(fallbackTarget ? fallbackTarget.id : "");
                      }
                    }}
                    className="w-full rounded-xl border border-gray-800 bg-gray-900 px-3.5 py-2.5 text-sm text-white focus:border-purple-600 focus:outline-none"
                  >
                    <option value="">Selecione a origem...</option>
                    {characters.map((char) => (
                      <option key={char.id} value={char.id} disabled={char.id === targetId}>
                        {char.name} (Nível {char.level})
                      </option>
                    ))}
                  </select>
                  {sourceChar && (
                    <p className="mt-1 text-[11px] text-gray-400">
                      Saldo disponível de {COIN_CONFIG[selectedCoin].name}:{" "}
                      <span className={`font-bold ${COIN_CONFIG[selectedCoin].color}`}>
                        {availableInSource.toLocaleString("pt-BR")}
                      </span>
                    </p>
                  )}
                </div>

                {/* Destino */}
                <div>
                  <label htmlFor="target-character-select" className="block text-xs font-semibold text-gray-300 mb-1.5">
                    Personagem de Destino (Quem recebe)
                  </label>
                  <select
                    id="target-character-select"
                    value={targetId}
                    onChange={(e) => setTargetId(e.target.value)}
                    className="w-full rounded-xl border border-gray-800 bg-gray-900 px-3.5 py-2.5 text-sm text-white focus:border-purple-600 focus:outline-none"
                  >
                    <option value="">Selecione o destino...</option>
                    {characters.map((char) => (
                      <option key={char.id} value={char.id} disabled={char.id === sourceId}>
                        {char.name} (Nível {char.level})
                      </option>
                    ))}
                  </select>
                  {targetChar && (
                    <p className="mt-1 text-[11px] text-gray-400">
                      Saldo atual de {COIN_CONFIG[selectedCoin].name}:{" "}
                      <span className={`font-bold ${COIN_CONFIG[selectedCoin].color}`}>
                        {(targetChar.coins[selectedCoin] ?? 0).toLocaleString("pt-BR")}
                      </span>
                    </p>
                  )}
                </div>
              </div>

              {/* Moeda e Quantidade */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1">
                <div>
                  <label htmlFor="coin-type-select" className="block text-xs font-semibold text-gray-300 mb-1.5">
                    Tipo de Moeda
                  </label>
                  <select
                    id="coin-type-select"
                    value={selectedCoin}
                    onChange={(e) => setSelectedCoin(e.target.value as keyof CoinsBalance)}
                    className="w-full rounded-xl border border-gray-800 bg-gray-900 px-3.5 py-2.5 text-sm text-white focus:border-purple-600 focus:outline-none"
                  >
                    {COIN_KEYS.map((key) => (
                      <option key={key} value={key}>
                        {COIN_CONFIG[key].icon} {COIN_CONFIG[key].name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <label htmlFor="transfer-amount-input" className="block text-xs font-semibold text-gray-300 mb-1.5">
                    Quantidade a Transferir
                  </label>
                  <div className="flex gap-2">
                    <input
                      id="transfer-amount-input"
                      type="number"
                      min="1"
                      max={availableInSource}
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      placeholder="Ex: 50"
                      className="flex-1 rounded-xl border border-gray-800 bg-gray-900 px-3.5 py-2.5 text-sm text-white placeholder-gray-600 focus:border-purple-600 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={handleMaxAmount}
                      disabled={!sourceChar || availableInSource <= 0}
                      className="rounded-xl border border-purple-800/60 bg-purple-950/50 px-4 text-xs font-bold text-purple-300 hover:bg-purple-900/60 transition-colors disabled:opacity-40"
                    >
                      Máximo
                    </button>
                  </div>
                </div>
              </div>

              {/* Botões de Ação do Modal */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-800">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={handleCloseTransfer}
                  disabled={isSubmitting}
                  className="px-4 py-2 text-xs text-gray-400 hover:text-white"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  disabled={isSubmitting || !sourceId || !targetId || !amount}
                  className="px-5 py-2 text-xs font-bold"
                >
                  {isSubmitting ? "Transferindo..." : "Confirmar Transferência"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 5. Modal de Detalhes de Riqueza do Personagem */}
      {detailChar && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="character-detail-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200"
          onClick={handleCloseDetail}
        >
          <div
            className="w-full max-w-2xl rounded-2xl border border-purple-800/60 bg-gray-950 p-6 text-gray-100 shadow-2xl space-y-5 max-h-[90vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header com Avatar, Nome, Nível e Botão Fechar */}
            <div className="flex items-start justify-between border-b border-gray-800 pb-4">
              <div className="flex items-center gap-3.5">
                {detailChar.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={detailChar.imageUrl}
                    alt={detailChar.name}
                    className="h-12 w-12 rounded-full object-cover shrink-0 ring-2 ring-purple-600/50"
                  />
                ) : (
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-purple-950 text-purple-300 font-bold text-lg shrink-0 border border-purple-800">
                    {detailChar.name.charAt(0).toUpperCase()}
                  </div>
                )}
                <div>
                  <h3 id="character-detail-modal-title" className="text-lg font-bold text-white">
                    {detailChar.name}
                  </h3>
                  <p className="text-xs text-gray-400">
                    Nível {detailChar.level} · Riqueza & Patrimônio Pessoal
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleCloseDetail}
                className="text-gray-400 hover:text-white rounded-lg p-1.5 text-base transition-colors"
                aria-label="Fechar"
              >
                ✕
              </button>
            </div>

            {/* Badges de Saldo das 5 Moedas */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              {COIN_KEYS.map((k) => {
                const conf = COIN_CONFIG[k];
                const amountCoin = detailChar.coins[k] ?? 0;
                return (
                  <div
                    key={k}
                    className={`flex flex-col items-center justify-center rounded-xl border ${conf.border} ${conf.bg} p-2.5 shadow-inner`}
                    title={`${conf.name}: ${amountCoin.toLocaleString("pt-BR")}`}
                  >
                    <span className="text-base">{conf.icon}</span>
                    <span className="text-[10px] uppercase font-bold text-gray-400 mt-0.5">
                      {conf.name}
                    </span>
                    <span className={`text-sm font-black mt-0.5 ${conf.color}`}>
                      {amountCoin.toLocaleString("pt-BR")}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Navegação por Abas: Inventário vs Extrato */}
            <div className="flex items-center gap-2 border-b border-gray-800 pb-2">
              <button
                type="button"
                onClick={() => setDetailTab("inventory")}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                  detailTab === "inventory"
                    ? "bg-purple-900/60 text-purple-200 border border-purple-700/60"
                    : "text-gray-400 hover:text-gray-200 hover:bg-gray-900"
                }`}
              >
                <span>🎒</span>
                <span>Itens & Inventário</span>
              </button>
              <button
                type="button"
                onClick={() => setDetailTab("statement")}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                  detailTab === "statement"
                    ? "bg-purple-900/60 text-purple-200 border border-purple-700/60"
                    : "text-gray-400 hover:text-gray-200 hover:bg-gray-900"
                }`}
              >
                <span>📜</span>
                <span>Extrato da Sessão</span>
              </button>
            </div>

            {/* Conteúdo da Aba */}
            <div className="flex-1 overflow-y-auto min-h-[220px] max-h-[360px] pr-1">
              {detailTab === "inventory" ? (
                <div>
                  {loadingInventory ? (
                    <div className="flex flex-col items-center justify-center py-12 gap-2 text-gray-400">
                      <Spinner size="md" />
                      <span className="text-xs">Carregando itens do inventário...</span>
                    </div>
                  ) : (() => {
                    const charItems = inventoryMap[detailChar.id] ?? [];
                    if (charItems.length === 0) {
                      return (
                        <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-8 text-center text-sm text-gray-400">
                          Nenhum item vinculado a este personagem.
                        </div>
                      );
                    }

                    // Calcula o valor total estimado em Ouro
                    let estimatedTotalGold = 0;
                    let hasCalculablePrice = false;

                    for (const item of charItems) {
                      const qty = item.junction?.quantity ?? 1;
                      const priceGold = parseItemPriceInGold(item.content);
                      if (priceGold !== null) {
                        hasCalculablePrice = true;
                        estimatedTotalGold += priceGold * qty;
                      }
                    }

                    return (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between rounded-xl border border-purple-800/40 bg-purple-950/20 px-3.5 py-2 text-xs">
                          <span className="text-gray-300 font-medium">
                            Patrimônio Estimado em Itens ({charItems.length}{" "}
                            {charItems.length === 1 ? "tipo" : "tipos"}):
                          </span>
                          <span className="font-bold text-amber-300">
                            {hasCalculablePrice
                              ? `~${estimatedTotalGold.toLocaleString("pt-BR", {
                                  minimumFractionDigits: 0,
                                  maximumFractionDigits: 1,
                                })} PO`
                              : "Sem valor definido"}
                          </span>
                        </div>

                        <div className="divide-y divide-gray-800/80 rounded-xl border border-gray-800 bg-gray-900/40 overflow-hidden">
                          {charItems.map((item, idx) => {
                            const name = item.content?.name ?? `Item desconhecido #${idx + 1}`;
                            const qty = item.junction?.quantity ?? 1;
                            const priceText = getItemPriceFormatted(item.content);

                            return (
                              <div
                                key={item.content?.id ?? item.junction?.id ?? idx}
                                className="flex items-center justify-between px-3.5 py-2.5 text-xs hover:bg-gray-900/80 transition-colors"
                              >
                                <div className="flex items-center gap-2.5 min-w-0">
                                  <span className="text-gray-500 font-mono text-[11px] shrink-0">
                                    {qty}x
                                  </span>
                                  <span className="font-medium text-white truncate">{name}</span>
                                </div>
                                <span
                                  className={`shrink-0 font-medium ml-3 ${
                                    priceText === "Sem valor comercial"
                                      ? "text-gray-500 italic text-[11px]"
                                      : "text-amber-400 font-semibold"
                                  }`}
                                >
                                  {priceText}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              ) : (
                /* Aba de Extrato / Movimentações */
                <div>
                  {(() => {
                    const charLogs = sessionLogs.filter(
                      (log) =>
                        log.sourceName === detailChar.name ||
                        log.targetName === detailChar.name
                    );

                    if (charLogs.length === 0) {
                      return (
                        <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-8 text-center text-sm text-gray-400">
                          Nenhuma movimentação registrada nesta sessão.
                        </div>
                      );
                    }

                    return (
                      <div className="space-y-2">
                        {charLogs.map((log) => {
                          const isSource = log.sourceName === detailChar.name;
                          const conf = COIN_CONFIG[log.coinType];

                          return (
                            <div
                              key={log.id}
                              className="flex items-center justify-between rounded-xl border border-gray-800 bg-gray-900/60 px-3.5 py-2.5 text-xs"
                            >
                              <div className="flex items-center gap-3">
                                <span className="font-mono text-gray-500 text-[11px]">
                                  {log.timestamp}
                                </span>
                                <div>
                                  <div className="flex items-center gap-1.5 font-medium text-white">
                                    <span>{isSource ? "Envio para" : "Recebido de"}</span>
                                    <span className="font-bold text-purple-300">
                                      {isSource ? log.targetName : log.sourceName}
                                    </span>
                                  </div>
                                </div>
                              </div>

                              <div className="flex items-center gap-1 font-bold">
                                <span
                                  className={
                                    isSource
                                      ? "text-rose-400"
                                      : "text-emerald-400"
                                  }
                                >
                                  {isSource ? "-" : "+"}
                                  {log.amount.toLocaleString("pt-BR")}
                                </span>
                                <span title={conf.name}>{conf.icon}</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>

            {/* Rodapé do Modal com Botão de Transferir e Fechar */}
            <div className="flex items-center justify-between pt-4 border-t border-gray-800">
              {characters.length >= 2 ? (
                <Button
                  type="button"
                  variant="primary"
                  onClick={() => {
                    const charToTransfer = detailChar.id;
                    handleCloseDetail();
                    handleOpenTransfer(charToTransfer);
                  }}
                  className="px-4 py-2 text-xs font-bold flex items-center gap-1.5"
                >
                  <span>⇄</span>
                  <span>Transferir</span>
                </Button>
              ) : (
                <div />
              )}
              <Button
                type="button"
                variant="ghost"
                onClick={handleCloseDetail}
                className="px-4 py-2 text-xs text-gray-400 hover:text-white"
              >
                Fechar
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
