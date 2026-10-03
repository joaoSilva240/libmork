"use client";

import type { CoinsBalance } from "@/lib/validators/character";
import { CurrencySummary } from "@/components/player/CurrencySummary";

type CurrencyPouchProps = {
  characterId: string;
  coins: CoinsBalance;
  onChange: (coins: CoinsBalance) => void;
  isLoading?: boolean;
};

export function CurrencyPouch({ characterId, coins, onChange, isLoading }: CurrencyPouchProps) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="mr-1 text-sm text-gray-500">💰</span>
      <CurrencySummary
        balance={coins}
        variant="character"
        ariaLabel={`Saldos de moedas do personagem ${characterId}`}
        onBalanceChange={onChange}
        isLoading={isLoading}
      />
    </div>
  );
}
