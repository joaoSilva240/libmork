"use client";

import { useEffect, useMemo, useState } from "react";
import { Spinner } from "@/components/ui";
import type { RpgClass, ClassLevelBenefit } from "@/types";

type ClassWithBenefits = {
  rpgClass: RpgClass;
  benefits: Array<{
    id: string;
    classId: string;
    level: number;
    benefits: ClassLevelBenefit;
  }>;
};

type FlattenedFeature = {
  id: string;
  className: string;
  classId: string;
  level: number;
  advantages: string;
  description: string;
  hpBonus: number;
  manaBonus: number;
  attributeBonus?: { attribute: string; value: number };
  extraSkills: number;
};

export function LibraryClassFeatures() {
  const [classesData, setClassesData] = useState<ClassWithBenefits[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filtros
  const [search, setSearch] = useState("");
  const [selectedClassId, setSelectedClassId] = useState<string>("all");
  const [selectedLevel, setSelectedLevel] = useState<number | "all">("all");

  useEffect(() => {
    let cancelled = false;

    async function loadAllClassFeatures() {
      setIsLoading(true);
      setError(null);

      try {
        const classesRes = await fetch("/api/classes", { credentials: "include" });
        if (!classesRes.ok) {
          throw new Error("Erro ao buscar classes");
        }
        const classesJson = await classesRes.json();
        if (!classesJson.success || !Array.isArray(classesJson.data)) {
          throw new Error("Dados de classes inválidos");
        }

        const classesList: RpgClass[] = classesJson.data;

        // Buscar os benefícios de cada classe em paralelo
        const results = await Promise.allSettled(
          classesList.map(async (cls) => {
            const benRes = await fetch(`/api/classes/${cls.id}/benefits`, { credentials: "include" });
            if (!benRes.ok) return { rpgClass: cls, benefits: [] };
            const benJson = await benRes.json();
            return {
              rpgClass: cls,
              benefits: Array.isArray(benJson.data) ? benJson.data : [],
            };
          })
        );

        if (cancelled) return;

        const loaded: ClassWithBenefits[] = [];
        for (const res of results) {
          if (res.status === "fulfilled") {
            loaded.push(res.value);
          }
        }

        setClassesData(loaded);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Erro ao carregar habilidades de classe");
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadAllClassFeatures();
    return () => {
      cancelled = true;
    };
  }, []);

  // Achatar em uma lista de habilidades
  const featuresList = useMemo(() => {
    const list: FlattenedFeature[] = [];

    for (const item of classesData) {
      const cls = item.rpgClass;
      for (const b of item.benefits) {
        const ben = b.benefits || {};
        const advantages = Array.isArray(ben.advantages)
          ? ben.advantages.join(", ")
          : (ben as Record<string, unknown>).advantages
          ? String((ben as Record<string, unknown>).advantages)
          : ben.description || "Habilidade de Nível";
        const description = ben.description || "";
        const hpBonus = ben.hp_bonus ?? (ben as Record<string, unknown>).hit_points_bonus ?? 0;
        const manaBonus = ben.mana_bonus ?? (ben as Record<string, unknown>).manaBonus ?? 0;
        const extraSkills = ben.extra_trained_skills ?? (ben as Record<string, unknown>).extra_skills ?? 0;
        const attributeBonus = ben.attribute_bonuses
          ? Object.entries(ben.attribute_bonuses).map(([attr, val]) => ({ attribute: attr, value: Number(val) }))[0]
          : undefined;

        list.push({
          id: b.id || `${cls.id}-${b.level}`,
          className: cls.name,
          classId: cls.id,
          level: b.level,
          advantages: String(advantages),
          description,
          hpBonus: Number(hpBonus) || 0,
          manaBonus: Number(manaBonus) || 0,
          attributeBonus,
          extraSkills: Number(extraSkills) || 0,
        });
      }
    }

    // Ordenar por classe e depois por nível
    return list.sort((a, b) => {
      const nameCompare = a.className.localeCompare(b.className);
      if (nameCompare !== 0) return nameCompare;
      return a.level - b.level;
    });
  }, [classesData]);

  // Lista de classes disponíveis para o filtro
  const availableClasses = useMemo(() => {
    return classesData.map((c) => ({ id: c.rpgClass.id, name: c.rpgClass.name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [classesData]);

  // Filtragem das habilidades
  const filteredFeatures = useMemo(() => {
    return featuresList.filter((feat) => {
      if (selectedClassId !== "all" && feat.classId !== selectedClassId) {
        return false;
      }
      if (selectedLevel !== "all" && feat.level !== selectedLevel) {
        return false;
      }
      if (search.trim()) {
        const q = search.toLowerCase().trim();
        const matchesName = feat.advantages.toLowerCase().includes(q);
        const matchesDesc = feat.description.toLowerCase().includes(q);
        const matchesClass = feat.className.toLowerCase().includes(q);
        const matchesLevel = `nível ${feat.level}`.includes(q) || `nv ${feat.level}`.includes(q) || `nivel ${feat.level}`.includes(q);
        if (!matchesName && !matchesDesc && !matchesClass && !matchesLevel) {
          return false;
        }
      }
      return true;
    });
  }, [featuresList, selectedClassId, selectedLevel, search]);

  if (isLoading) {
    return (
      <div className="flex min-h-[300px] items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-800 bg-red-900/30 p-4 text-sm text-red-300">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-gray-800 bg-gray-900 p-4 shadow-xl">
        <div className="flex-1 min-w-[200px]">
          <input
            type="text"
            placeholder="Buscar por habilidade, classe ou nível..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-gray-800 bg-gray-950 px-3.5 py-2 text-xs text-white placeholder-gray-500 focus:border-purple-500 focus:outline-none transition"
          />
        </div>

        <select
          value={selectedClassId}
          onChange={(e) => setSelectedClassId(e.target.value)}
          className="rounded-xl border border-gray-800 bg-gray-950 px-3 py-2 text-xs text-white focus:border-purple-500 focus:outline-none transition"
        >
          <option value="all">Todas as Classes</option>
          {availableClasses.map((cls) => (
            <option key={cls.id} value={cls.id}>
              {cls.name}
            </option>
          ))}
        </select>

        <select
          value={selectedLevel}
          onChange={(e) => setSelectedLevel(e.target.value === "all" ? "all" : Number(e.target.value))}
          className="rounded-xl border border-gray-800 bg-gray-950 px-3 py-2 text-xs text-white focus:border-purple-500 focus:outline-none transition"
        >
          <option value="all">Todos os Níveis (1-20)</option>
          {Array.from({ length: 20 }, (_, i) => i + 1).map((lvl) => (
            <option key={lvl} value={lvl}>
              Nível {lvl}
            </option>
          ))}
        </select>

        {(search || selectedClassId !== "all" || selectedLevel !== "all") && (
          <button
            type="button"
            onClick={() => {
              setSearch("");
              setSelectedClassId("all");
              setSelectedLevel("all");
            }}
            className="rounded-xl border border-gray-800 bg-gray-950 px-3 py-2 text-xs font-bold text-purple-400 hover:bg-gray-800 transition"
          >
            Limpar Filtros
          </button>
        )}
      </div>

      {/* Estatística de resultados */}
      <div className="flex items-center justify-between px-1">
        <span className="text-xs text-gray-400">
          Exibindo <strong className="text-white">{filteredFeatures.length}</strong> habilidade(s)
        </span>
      </div>

      {/* Grid de Cards de Habilidades */}
      {filteredFeatures.length === 0 ? (
        <div className="rounded-2xl border border-gray-800 bg-gray-900/60 py-12 text-center text-gray-400 text-sm">
          Nenhuma habilidade de classe encontrada com os filtros atuais.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 max-h-[calc(100vh-18rem)] overflow-y-auto pr-1">
          {filteredFeatures.map((feat) => (
            <div
              key={feat.id}
              className="flex flex-col justify-between rounded-xl border border-gray-800 bg-gray-950 p-4 hover:border-purple-600/60 hover:shadow-lg transition-all"
            >
              <div className="space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <h4 className="font-bold text-white text-base leading-snug">
                    {feat.advantages}
                  </h4>
                  <span className="shrink-0 rounded-lg bg-purple-950/80 border border-purple-800/60 px-2 py-0.5 text-[10px] font-bold text-purple-300 whitespace-nowrap">
                    {feat.className} · Nível {feat.level}
                  </span>
                </div>

                {/* Badges de Bônus Concedidos */}
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {feat.hpBonus > 0 && (
                    <span className="rounded bg-red-950/80 border border-red-800/60 px-2 py-0.5 text-[10px] font-semibold text-red-300">
                      HP +{feat.hpBonus}
                    </span>
                  )}
                  {feat.manaBonus > 0 && (
                    <span className="rounded bg-blue-950/80 border border-blue-800/60 px-2 py-0.5 text-[10px] font-semibold text-blue-300">
                      Mana +{feat.manaBonus}
                    </span>
                  )}
                  {feat.attributeBonus && (
                    <span className="rounded bg-purple-950/80 border border-purple-800/60 px-2 py-0.5 text-[10px] font-semibold text-purple-300">
                      {feat.attributeBonus.attribute} +{feat.attributeBonus.value}
                    </span>
                  )}
                  {feat.extraSkills > 0 && (
                    <span className="rounded bg-amber-950/80 border border-amber-800/60 px-2 py-0.5 text-[10px] font-semibold text-amber-300">
                      +{feat.extraSkills} Perícia(s)
                    </span>
                  )}
                </div>

                {feat.description && (
                  <p className="text-xs text-gray-300 leading-relaxed pt-1">
                    {feat.description}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
