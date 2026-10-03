"use client";

import { useState } from "react";
import type { CoinsBalance } from "@/lib/validators/character";
import { CurrencyConversionModal } from "@/components/characters/CurrencyConversionModal";
import { COIN_KEYS, totalInBronze } from "@/lib/currency";

export { COIN_KEYS } from "@/lib/currency";

export const COIN_CONFIG: Record<
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

export interface CurrencySummaryProps {
  balance: CoinsBalance;
  variant: "consolidated" | "character";
  label?: string;
  showGoldEquivalent?: boolean;
  compact?: boolean;
  className?: string;
  ariaLabel?: string;
  onBalanceChange?: (coins: CoinsBalance) => void;
  isLoading?: boolean;
}

export function CurrencySummary({
  balance,
  variant,
  label,
  showGoldEquivalent = variant === "consolidated",
  compact = variant === "character",
  className = "",
  ariaLabel,
  onBalanceChange,
  isLoading = false,
}: CurrencySummaryProps) {
  const [sourceCoin, setSourceCoin] = useState<keyof CoinsBalance | null>(null);
  const totalInGold = totalInBronze(balance) / 100;

  return (
    <div
      className={`flex w-full max-w-full min-w-0 flex-col items-stretch gap-3 overflow-hidden ${className}`}
      aria-label={ariaLabel}
    >
      {label && <span className="sr-only">{label}</span>}
      {showGoldEquivalent && (
        <div className="flex max-w-full min-w-0 items-center gap-2 overflow-hidden rounded-xl border border-amber-500/30 bg-amber-950/30 px-3.5 py-1.5 shadow-[0_0_15px_rgba(245,158,11,0.15)]">
          <span className="text-lg" aria-hidden="true">
            🪙
          </span>
          <span className="text-xs font-semibold uppercase tracking-wider text-amber-300/90">
            Total:
          </span>
          <span className="text-xl font-black tracking-tight text-amber-300">
            {totalInGold.toLocaleString("pt-BR", {
              minimumFractionDigits: 0,
              maximumFractionDigits: 2,
            })}{" "}
            PO
          </span>
        </div>
      )}
      <div
        className={`flex w-full max-w-full min-w-0 flex-nowrap overflow-x-auto overflow-y-hidden overscroll-x-contain snap-x snap-mandatory touch-pan-x contain-[layout] pb-1 ${
          compact ? "" : "xl:max-w-4xl"
        }`}
      >
        <div className="flex w-max min-w-full flex-nowrap gap-2">
          {COIN_KEYS.map((key) => {
            const config = COIN_CONFIG[key];
            const amount = balance[key] ?? 0;
            return (
              <button
                type="button"
                key={key}
                disabled={!onBalanceChange || isLoading}
                onClick={(event) => {
                  event.stopPropagation();
                  if (onBalanceChange) setSourceCoin(key);
                }}
                title={`${config.name}: ${amount.toLocaleString("pt-BR")}`}
                aria-label={`${config.name}: ${amount.toLocaleString("pt-BR")}`}
                className={`flex size-16 shrink-0 snap-start flex-col items-center justify-center gap-1 overflow-hidden rounded-lg border ${config.border} ${config.bg} text-xs`}
              >
                <span className="shrink-0 text-lg leading-none" aria-hidden="true">
                  {config.icon}
                </span>
                <span className={`font-bold ${config.color}`}>
                  {amount.toLocaleString("pt-BR")}
                </span>
              </button>
            );
          })}
        </div>
      </div>
      {onBalanceChange && sourceCoin && (
        <CurrencyConversionModal
          isOpen
          sourceCoin={sourceCoin}
          coins={balance}
          onClose={() => setSourceCoin(null)}
          onConfirm={(nextCoins) => {
            onBalanceChange(nextCoins);
            setSourceCoin(null);
          }}
          isLoading={isLoading}
        />
      )}
    </div>
  );
}
