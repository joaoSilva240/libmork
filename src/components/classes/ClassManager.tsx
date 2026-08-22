"use client";

import { useCallback, useEffect, useState } from "react";
import type { RpgClass } from "@/types";
import { Button, Form, Input } from "@/components/ui";

type Benefit = {
  id: string;
  classId: string;
  level: number;
  benefits: Record<string, unknown>;
};

export function ClassManager() {
  const [classes, setClasses] = useState<RpgClass[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [expandedClassId, setExpandedClassId] = useState<string | null>(null);
  const [benefits, setBenefits] = useState<Benefit[]>([]);
  const [benefitLevel, setBenefitLevel] = useState("2");
  const [benefitDescription, setBenefitDescription] = useState("");
  const [isAddingBenefit, setIsAddingBenefit] = useState(false);

  const loadClasses = useCallback(async () => {
    try {
      const response = await fetch("/api/classes");
      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Erro ao carregar classes");
        return;
      }

      setClasses(data.data);
    } catch {
      setError("Erro de conexão. Tente novamente.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const response = await fetch("/api/classes");
        const data = await response.json();

        if (cancelled) return;

        if (!response.ok) {
          setError(data.error || "Erro ao carregar classes");
          return;
        }

        setClasses(data.data);
      } catch {
        if (!cancelled) {
          setError("Erro de conexão. Tente novamente.");
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const loadBenefits = useCallback(async (classId: string) => {
    try {
      const response = await fetch(`/api/classes/${classId}/benefits`);
      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Erro ao carregar benefícios");
        return;
      }

      setBenefits(data.data);
    } catch {
      setError("Erro de conexão. Tente novamente.");
    }
  }, []);

  const handleToggleClass = async (classId: string) => {
    if (expandedClassId === classId) {
      setExpandedClassId(null);
      return;
    }

    setExpandedClassId(classId);
    await loadBenefits(classId);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsCreating(true);

    try {
      const response = await fetch("/api/classes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description: description || null }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Erro ao criar classe");
        return;
      }

      setName("");
      setDescription("");
      await loadClasses();
    } catch {
      setError("Erro de conexão. Tente novamente.");
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteClass = async (classId: string) => {
    if (!window.confirm("Excluir esta classe?")) {
      return;
    }

    setError(null);
    try {
      const response = await fetch(`/api/classes/${classId}`, {
        method: "DELETE",
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Erro ao excluir classe");
        return;
      }

      if (expandedClassId === classId) {
        setExpandedClassId(null);
      }
      await loadClasses();
    } catch {
      setError("Erro de conexão. Tente novamente.");
    }
  };

  const handleAddBenefit = async (classId: string) => {
    setError(null);
    setIsAddingBenefit(true);

    try {
      const response = await fetch(`/api/classes/${classId}/benefits`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          level: Number(benefitLevel),
          benefits: {
            description: benefitDescription || undefined,
          },
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Erro ao adicionar benefício");
        return;
      }

      setBenefitLevel("2");
      setBenefitDescription("");
      await loadBenefits(classId);
    } catch {
      setError("Erro de conexão. Tente novamente.");
    } finally {
      setIsAddingBenefit(false);
    }
  };

  const handleDeleteBenefit = async (classId: string, benefitId: string) => {
    if (!window.confirm("Excluir este benefício?")) {
      return;
    }

    setError(null);
    try {
      const response = await fetch(`/api/classes/${classId}/benefits/${benefitId}`, {
        method: "DELETE",
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Erro ao excluir benefício");
        return;
      }

      await loadBenefits(classId);
    } catch {
      setError("Erro de conexão. Tente novamente.");
    }
  };

  return (
    <div>
      <h2 className="mb-4 text-2xl font-bold text-white">Classes</h2>

      {error && (
        <div className="mb-4 rounded-lg border border-red-800 bg-red-900/30 p-3 text-sm text-red-300">
          {error}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-lg border border-gray-800 bg-gray-900 p-4">
          <h3 className="mb-3 font-semibold text-white">Nova Classe</h3>
          <Form onSubmit={(e) => handleCreate(e as React.FormEvent)} error={undefined}>
            <Input
              label="Nome"
              name="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              disabled={isCreating}
              className="bg-gray-950 text-white"
            />
            <Input
              label="Descrição"
              name="description"
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={isCreating}
              className="bg-gray-950 text-white"
            />
            <Button type="submit" variant="master" isLoading={isCreating}>
              Criar
            </Button>
          </Form>
        </div>

        <div className="rounded-lg border border-gray-800 bg-gray-900 p-4">
          <h3 className="mb-3 font-semibold text-white">Classes ({classes.length})</h3>

          {isLoading ? (
            <div className="flex justify-center py-8">
              <div className="h-6 w-6 animate-spin rounded-full border-4 border-gray-700 border-t-purple-600" />
            </div>
          ) : classes.length === 0 ? (
            <p className="text-sm text-gray-400">Nenhuma classe cadastrada.</p>
          ) : (
            <div className="space-y-2">
              {classes.map((rpgClass) => (
                <div key={rpgClass.id} className="rounded-lg border border-gray-800 bg-gray-950">
                  <div className="flex items-center justify-between p-3">
                    <div>
                      <button
                        onClick={() => handleToggleClass(rpgClass.id)}
                        className="font-semibold text-white hover:text-purple-300"
                      >
                        {rpgClass.name} {expandedClassId === rpgClass.id ? "−" : "+"}
                      </button>
                      {rpgClass.description && (
                        <p className="mt-0.5 text-xs text-gray-400">{rpgClass.description}</p>
                      )}
                    </div>
                    <button
                      onClick={() => handleDeleteClass(rpgClass.id)}
                      className="ml-4 shrink-0 text-sm text-red-400 hover:text-red-300"
                    >
                      Excluir
                    </button>
                  </div>

                  {expandedClassId === rpgClass.id && (
                    <div className="border-t border-gray-800 p-3">
                      <h4 className="mb-2 text-sm font-semibold text-gray-300">
                        Benefícios por nível
                      </h4>
                      {benefits.length === 0 ? (
                        <p className="mb-3 text-sm text-gray-500">Sem benefícios ainda.</p>
                      ) : (
                        <div className="mb-3 space-y-2">
                          {benefits.map((benefit) => (
                            <div
                              key={benefit.id}
                              className="flex items-center justify-between rounded bg-gray-900 p-2"
                            >
                              <div>
                                <p className="text-sm font-medium text-white">
                                  Nível {benefit.level}
                                </p>
                                {typeof benefit.benefits.description === "string" && (
                                  <p className="text-xs text-gray-400">
                                    {benefit.benefits.description}
                                  </p>
                                )}
                              </div>
                              <button
                                onClick={() => handleDeleteBenefit(rpgClass.id, benefit.id)}
                                className="ml-3 shrink-0 text-xs text-red-400 hover:text-red-300"
                              >
                                Excluir
                              </button>
                            </div>
                          ))}
                        </div>
                      )}

                      <div className="flex flex-wrap items-end gap-2">
                        <Input
                          label="Nível"
                          name="benefitLevel"
                          type="number"
                          min={1}
                          max={20}
                          value={benefitLevel}
                          onChange={(e) => setBenefitLevel(e.target.value)}
                          disabled={isAddingBenefit}
                          className="w-24 bg-gray-900 text-white"
                        />
                        <Input
                          label="Descrição"
                          name="benefitDescription"
                          type="text"
                          value={benefitDescription}
                          onChange={(e) => setBenefitDescription(e.target.value)}
                          disabled={isAddingBenefit}
                          className="flex-1 bg-gray-900 text-white"
                        />
                        <Button
                          type="button"
                          variant="master"
                          isLoading={isAddingBenefit}
                          onClick={() => handleAddBenefit(rpgClass.id)}
                        >
                          Adicionar
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
