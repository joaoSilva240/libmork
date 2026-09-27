"use client";

import { useState } from "react";
import type { CoinsBalance } from "@/lib/validators/character";

type CurrencyPouchProps = {
  characterId: string;
  coins: CoinsBalance;
  onChange: (coins: CoinsBalance) => void;
  isLoading?: boolean;
};

// Configuração minimalista
const COIN_CONFIG: Record<keyof CoinsBalance, { icon: string; color: string }> = {
  bronze:  { icon: "🟤", color: "text-[#CD7F32]" },
  prata:   { icon: "⚪", color: "text-[#C0C0C0]" },
  ouro:    { icon: "🟡", color: "text-[#FFD700]" },
  platina: { icon: "🔷", color: "text-[#E5E4E2]" },
  diamante:{ icon: "💎", color: "text-[#B9F2FF]" },
};

export function CurrencyPouch({ characterId, coins, onChange, isLoading }: CurrencyPouchProps) {
  const [editingCoin, setEditingCoin] = useState<keyof CoinsBalance | null>(null);
  const [tempValue, setTempValue] = useState<string>("");

  const handleEdit = (coin: keyof CoinsBalance) => {
    setEditingCoin(coin);
    setTempValue(String(coins[coin] || 0));
  };

  const handleSave = (coin: keyof CoinsBalance) => {
    const value = parseInt(tempValue, 10);
    if (isNaN(value) || value < 0) {
      setEditingCoin(null);
      return;
    }
    onChange({ ...coins, [coin]: value });
    setEditingCoin(null);
  };

  return (
    <div className="flex items-center gap-1.5">
      {/* Ícone de carteira */}
      <span className="text-sm text-gray-500 mr-1">💰</span>
      
      {/* Container individual por moeda */}
      {(Object.keys(COIN_CONFIG) as (keyof CoinsBalance)[]).map((coin) => {
        const config = COIN_CONFIG[coin];
        const value = coins[coin] ?? 0;
        const isEditing = editingCoin === coin;

        return (
          <div 
            key={coin} 
            className="flex items-center gap-1 px-2 py-1 rounded-md border border-gray-800/60 bg-gray-900/50 hover:bg-gray-900/70 transition-colors"
          >
            <span className="text-xs">{config.icon}</span>
            {isEditing ? (
              <input
                type="number"
                min={0}
                value={tempValue}
                onChange={(e) => setTempValue(e.target.value)}
                autoFocus
                disabled={isLoading}
                className="w-12 text-xs text-white bg-gray-950 border border-gray-700 rounded px-1 py-0.5 focus:outline-none focus:border-purple-500"
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSave(coin);
                  if (e.key === "Escape") setEditingCoin(null);
                }}
                onBlur={() => handleSave(coin)}
              />
            ) : (
              <button
                onClick={() => handleEdit(coin)}
                disabled={isLoading}
                className={`text-xs font-bold ${config.color} hover:underline cursor-pointer`}
                title={`Editar ${coin}`}
              >
                {value.toLocaleString("pt-BR")}
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
