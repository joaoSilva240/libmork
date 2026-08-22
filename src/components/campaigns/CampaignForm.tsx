"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Form, Input } from "@/components/ui";
import type { RulesEngine } from "@/lib/utils/constants";

export function CampaignForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [rulesEngine, setRulesEngine] = useState<RulesEngine>("d20_mod");
  const [pvpEnabled, setPvpEnabled] = useState(false);
  const [difficultyModifierShadowPoints, setDifficultyModifierShadowPoints] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const response = await fetch("/api/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          rulesEngine,
          pvpEnabled,
          difficultyModifierShadowPoints,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Erro ao criar campanha");
        return;
      }

      router.push(`/master/campaigns/${data.data.id}`);
    } catch {
      setError("Erro de conexão. Tente novamente.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-lg">
      <h2 className="mb-4 text-2xl font-bold text-white">Nova Campanha</h2>

      <Form onSubmit={handleSubmit} error={error ?? undefined}>
        <Input
          label="Nome da Campanha"
          name="name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          autoComplete="off"
          disabled={isLoading}
          className="bg-gray-900 text-white"
        />

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">
            Motor de Regras (RF-019)
          </label>
          <select
            value={rulesEngine}
            onChange={(e) => setRulesEngine(e.target.value as RulesEngine)}
            disabled={isLoading}
            className="w-full rounded-lg border border-gray-700 bg-gray-900 px-4 py-2 text-white focus:ring-2 focus:ring-purple-600 focus:border-transparent"
          >
            <option value="d20_mod">d20 + modificador</option>
            <option value="dual_d20_sum">2d20 somado</option>
          </select>
        </div>

        <div>
          <label className="flex items-center gap-2 text-sm font-medium text-gray-300">
            <input
              type="checkbox"
              checked={pvpEnabled}
              onChange={(e) => setPvpEnabled(e.target.checked)}
              disabled={isLoading}
              className="h-4 w-4 rounded border-gray-700 bg-gray-900 accent-purple-600"
            />
            Permitir PvP entre jogadores (RF-053)
          </label>
        </div>

        <Input
          label="Dificuldade por Pontos de Sombra"
          name="difficulty"
          type="number"
          min={0}
          value={difficultyModifierShadowPoints}
          onChange={(e) => setDifficultyModifierShadowPoints(Number(e.target.value))}
          disabled={isLoading}
          className="bg-gray-900 text-white"
        />

        <Button type="submit" variant="master" className="w-full" isLoading={isLoading}>
          Criar Campanha
        </Button>
      </Form>
    </div>
  );
}
