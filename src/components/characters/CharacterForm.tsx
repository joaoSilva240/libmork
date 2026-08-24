"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ATTRIBUTES, ATTRIBUTE_BASE_VALUE, ATTRIBUTE_FREE_POINTS } from "@/lib/utils/constants";
import type { Attribute } from "@/lib/utils/constants";
import { getModifier } from "@/lib/engine/attributes";
import { Button, Form, Input } from "@/components/ui";

const ATTRIBUTE_LABELS: Record<Attribute, string> = {
  forca: "Força",
  destreza: "Destreza",
  vigor: "Vigor",
  inteligencia: "Inteligência",
  empatia: "Empatia",
};

const DEFAULT_ATTRIBUTES: Record<Attribute, number> = {
  forca: ATTRIBUTE_BASE_VALUE,
  destreza: ATTRIBUTE_BASE_VALUE,
  vigor: ATTRIBUTE_BASE_VALUE,
  inteligencia: ATTRIBUTE_BASE_VALUE,
  empatia: ATTRIBUTE_BASE_VALUE,
};

export function CharacterForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [attributes, setAttributes] = useState<Record<Attribute, number>>(DEFAULT_ATTRIBUTES);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const spentPoints = useMemo(
    () => ATTRIBUTES.reduce((sum, attr) => sum + (attributes[attr] - ATTRIBUTE_BASE_VALUE), 0),
    [attributes],
  );

  const remainingPoints = ATTRIBUTE_FREE_POINTS - spentPoints;

  const handleIncrement = (attr: Attribute) => {
    if (remainingPoints <= 0) return;
    setAttributes((prev) => ({ ...prev, [attr]: prev[attr] + 1 }));
  };

  const handleDecrement = (attr: Attribute) => {
    setAttributes((prev) => {
      if (prev[attr] <= ATTRIBUTE_BASE_VALUE) return prev;
      return { ...prev, [attr]: prev[attr] - 1 };
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    if (remainingPoints !== 0) {
      setError(`Distribua os ${ATTRIBUTE_FREE_POINTS} pontos livres. Restam ${remainingPoints}.`);
      setIsLoading(false);
      return;
    }

    try {
      const response = await fetch("/api/characters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, attributes }),
        credentials: "include",
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Erro ao criar personagem");
        return;
      }

      router.push(`/player/characters/${data.data.id}`);
    } catch {
      setError("Erro de conexão. Tente novamente.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-lg">
      <h2 className="mb-4 text-2xl font-bold text-white">Criar Personagem</h2>

      <Form onSubmit={handleSubmit} error={error ?? undefined}>
        <Input
          label="Nome"
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
          <div className="mb-2 flex items-center justify-between">
            <label className="text-sm font-medium text-gray-300">Atributos</label>
            <span
              className={`text-sm font-semibold ${
                remainingPoints === 0 ? "text-green-400" : "text-yellow-400"
              }`}
            >
              {remainingPoints} ponto(s) restante(s)
            </span>
          </div>

          <div className="space-y-2">
            {ATTRIBUTES.map((attr) => (
              <div
                key={attr}
                className="flex items-center justify-between rounded-lg border border-gray-800 bg-gray-900 px-3 py-2"
              >
                <div>
                  <span className="text-sm font-medium text-white">
                    {ATTRIBUTE_LABELS[attr]}
                  </span>
                  <span className="ml-2 text-xs text-gray-400">
                    mod {getModifier(attributes[attr]) >= 0 ? "+" : ""}
                    {getModifier(attributes[attr])}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleDecrement(attr)}
                    disabled={attributes[attr] <= ATTRIBUTE_BASE_VALUE || isLoading}
                    className="h-8 w-8 rounded bg-gray-800 font-bold text-white hover:bg-gray-700 disabled:opacity-40"
                  >
                    −
                  </button>
                  <span className="w-8 text-center font-bold text-white">
                    {attributes[attr]}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleIncrement(attr)}
                    disabled={remainingPoints <= 0 || isLoading}
                    className="h-8 w-8 rounded bg-gray-800 font-bold text-white hover:bg-gray-700 disabled:opacity-40"
                  >
                    +
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <Button type="submit" className="w-full" isLoading={isLoading}>
          Criar Personagem
        </Button>
      </Form>
    </div>
  );
}
