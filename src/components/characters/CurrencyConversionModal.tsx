"use client";

import { useMemo, useState } from "react";
import type { CoinsBalance } from "@/lib/validators/character";
import { Modal } from "@/components/ui/Modal";
import { COIN_CONFIG } from "@/components/player/CurrencySummary";
import { COIN_KEYS, COIN_UNITS } from "@/lib/currency";

export { COIN_UNITS } from "@/lib/currency";

type CurrencyConversionModalProps = {
  isOpen: boolean;
  sourceCoin: keyof CoinsBalance;
  coins: CoinsBalance;
  onClose: () => void;
  onConfirm: (coins: CoinsBalance) => void;
  isLoading?: boolean;
  title?: string;
};

export function CurrencyConversionModal({
  isOpen,
  sourceCoin,
  coins,
  onClose,
  onConfirm,
  isLoading = false,
  title = "Converter moedas",
}: CurrencyConversionModalProps) {
  const [targetCoin, setTargetCoin] = useState<keyof CoinsBalance>(
    COIN_KEYS.find((coin) => coin !== sourceCoin) ?? "ouro",
  );
  const [quantity, setQuantity] = useState("");
  const sourceAmount = coins[sourceCoin] ?? 0;
  const safeTargetCoin =
    targetCoin === sourceCoin
      ? (COIN_KEYS.find((coin) => coin !== sourceCoin) ?? "ouro")
      : targetCoin;
  const parsedQuantity = Number(quantity);
  const error = useMemo(() => {
    if (!quantity || !/^\d+$/.test(quantity) || parsedQuantity <= 0)
      return "Informe uma quantidade inteira maior que zero.";
    if (parsedQuantity > sourceAmount) return "Saldo insuficiente para esta conversão.";
    if (sourceCoin === safeTargetCoin) return "A moeda de destino deve ser diferente da origem.";
    if ((parsedQuantity * COIN_UNITS[sourceCoin]) % COIN_UNITS[safeTargetCoin] !== 0)
      return "Esta quantidade não pode ser convertida exatamente para a moeda escolhida.";
    return null;
  }, [quantity, parsedQuantity, sourceAmount, sourceCoin, safeTargetCoin]);
  const result = error
    ? null
    : (parsedQuantity * COIN_UNITS[sourceCoin]) / COIN_UNITS[safeTargetCoin];

  const confirm = () => {
    if (error || result === null) return;
    onConfirm({
      ...coins,
      [sourceCoin]: sourceAmount - parsedQuantity,
      [safeTargetCoin]: (coins[safeTargetCoin] ?? 0) + result,
    });
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      labelledBy="currency-conversion-title"
      className="max-w-md rounded-2xl border border-gray-800 bg-gray-950 p-5 shadow-2xl"
    >
      <Modal.Header className="flex items-start justify-between gap-4">
        <div>
          <h2 id="currency-conversion-title" className="text-lg font-bold text-white">
            {title}
          </h2>
          <p className="mt-1 text-xs text-gray-400">
            Moeda de origem: {COIN_CONFIG[sourceCoin].icon} {COIN_CONFIG[sourceCoin].name} · saldo
            disponível: {sourceAmount.toLocaleString("pt-BR")}
          </p>
        </div>
        <Modal.CloseButton className="rounded p-1 text-gray-400 hover:text-white" />
      </Modal.Header>
      <Modal.Body className="space-y-4 py-5">
        <label className="block text-sm text-gray-300">
          Moeda de destino
          <select
            value={safeTargetCoin}
            onChange={(event) => setTargetCoin(event.target.value as keyof CoinsBalance)}
            className="mt-1 w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-white"
            aria-label="Moeda de destino"
          >
            {COIN_KEYS.filter((coin) => coin !== sourceCoin).map((coin) => (
              <option key={coin} value={coin}>
                {COIN_CONFIG[coin].icon} {COIN_CONFIG[coin].name}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm text-gray-300">
          Quantidade
          <input
            type="number"
            min="1"
            step="1"
            inputMode="numeric"
            value={quantity}
            onChange={(event) => setQuantity(event.target.value)}
            className="mt-1 w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-white"
            aria-label="Quantidade"
          />
        </label>
        <div
          aria-live="polite"
          className="rounded-lg border border-gray-800 bg-gray-900/70 p-3 text-sm text-gray-200"
        >
          <span className="font-semibold">Resultado da conversão:</span>{" "}
          {quantity && result !== null
            ? `${parsedQuantity.toLocaleString("pt-BR")} ${COIN_CONFIG[sourceCoin].name.toLowerCase()} → ${result.toLocaleString("pt-BR")} ${COIN_CONFIG[safeTargetCoin].name.toLowerCase()}`
            : "Informe uma quantidade válida."}
        </div>
        {error && (
          <p role="alert" className="text-sm text-red-300">
            {error}
          </p>
        )}
      </Modal.Body>
      <Modal.Footer className="flex justify-end gap-2 pt-2">
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg border border-gray-700 px-4 py-2 text-sm text-gray-300 hover:bg-gray-900"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={confirm}
          disabled={Boolean(error) || isLoading}
          className="rounded-lg bg-purple-700 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          Confirmar conversão
        </button>
      </Modal.Footer>
    </Modal>
  );
}
