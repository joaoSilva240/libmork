"use client";

import { useState } from "react";
import type { CoinsBalance } from "@/lib/validators/character";

type CurrencyPouchProps = {
  characterId: string;
  coins: CoinsBalance;
  onChange: (coins: CoinsBalance) => void;
  isLoading?: boolean;
};

// Configuração de cada moeda
const COIN_CONFIG: Record<keyof CoinsBalance, { label: string; color: string; bg: string; border: string; icon: string }> = {
  bronze:  { label: "Bronze", color: "text-[#CD7F32]",  bg: "bg-[#CD7F32]/15",  border: "border-[#CD7F32]/30",  icon: "🟤" },
  prata:   { label: "Prata",  color: "text-[#C0C0C0]",  bg: "bg-[#C0C0C0]/15",  border: "border-[#C0C0C0]/30",  icon: "⚪" },
  ouro:    { label: "Ouro",   color: "text-[#FFD700]",  bg: "bg-[#FFD700]/15",  border: "border-[#FFD700]/30",  icon: "🟡" },
  platina: { label: "Platina",color: "text-[#E5E4E2]",  bg: "bg-[#E5E4E2]/15",  border: "border-[#E5E4E2]/30",  icon: "🔷" },
  diamante:{ label: "Diamante",color: "text-[#B9F2FF]", bg: "bg-[#B9F2FF]/15", border: "border-[#B9F2FF]/30", icon: "💎" },
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
    
    // Auto-conversão: 100 bronze = 1 prata, 100 prata = 1 ouro, etc.
    let newCoins = { ...coins };
    newCoins[coin] = value;
    
    // Simples normalização: converte deidades superiores para inferiores
    const order: (keyof CoinsBalance)[] = ["bronze", "prata", "ouro", "platina", "diamante"];
    for (let i = 4; i > 0; i--) {
      const current = order[i];
      const lower = order[i - 1];
      if (newCoins[current] >= 100) {
        const converted = Math.floor(newCoins[current] / 100);
        newCoins[current] = newCoins[current] % 100;
        // Só converte para diamante->platina e assim por diante (cadeia)
        if (lower) newCoins[lower] += converted;
      }
    }
    
    onChange(newCoins);
    setEditingCoin(null);
  };

  const handleCancel = () => {
    setEditingCoin(null);
  };

  return (
    <div className="flex flex-wrap items-center gap-1.5 p-2.5 rounded-xl border border-gray-800 bg-gray-950/60">
      {(Object.keys(COIN_CONFIG) as (keyof CoinsBalance)[]).map((coin) => {
        const config = COIN_CONFIG[coin];
        const value = coins[coin] ?? 0;
        const isEditing = editingCoin === coin;

        return (
          <div key={coin} className={`flex items-center gap-1 rounded-lg border px-2.5 py-1 ${config.bg} ${config.border} min-w-[80px] group`}>
            <span className="text-sm">{config.icon}</span>
            <div className="flex flex-col">
              <span className="text-[9px] font-semibold text-gray-400 uppercase">{config.label}</span>
              {isEditing ? (
                <div className="flex items-center gap-0.5">
                  <input
                    type="number"
                    min={0}
                    value={tempValue}
                    onChange={(e) => setTempValue(e.target.value)}
                    autoFocus
                    disabled={isLoading}
                    className="w-10 text-xs text-white bg-gray-900 border border-gray-700 rounded px-1 focus:outline-none focus:border-purple-600"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleSave(coin);
                      if (e.key === "Escape") handleCancel();
                    }}
                  />
                  <button
                    onClick={() => handleSave(coin)}
                    disabled={isLoading}
                    className="text-[8px] text-purple-400 hover:text-purple-300 font-bold"
                    title="Salvar"
                  >
                    ✓
                  </button>
                </div>
              ) : (
                <span className={`text-sm font-bold ${config.color}`}>{value.toLocaleString("pt-BR")}</span>
              )}
            </div>
            {!isEditing && (
              <button
                onClick={() => handleEdit(coin)}
                disabled={isLoading}
                className="ml-0.5 text-[9px] text-gray-600 hover:text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity"
                title={`Editar ${config.label}`}
              >
                ✏️
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
