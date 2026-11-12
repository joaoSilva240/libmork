"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { CharacterWizard } from "@/components/characters/CharacterWizard";
import { MissingHabitantCreateForm } from "@/components/systems/missing/MissingHabitantCreateForm";
import { FalloutCharacterWizard } from "@/components/systems/fallout";
import { Spinner } from "@/components/ui";

function NewCharacterContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const systemParam = searchParams.get("system");
  const campaignId = searchParams.get("campaignId");

  const initialSystem = systemParam
    ? systemParam === "missing" || systemParam === "missing_zero"
      ? "missing_zero"
      : systemParam === "fallout" || systemParam === "fallout_2d20"
        ? "fallout_2d20"
        : "libmork"
    : null;

  const [selectedSystem, setSelectedSystem] = useState<
    "libmork" | "missing_zero" | "fallout_2d20" | null
  >(initialSystem);

  if (selectedSystem === "libmork") {
    return <CharacterWizard />;
  }

  if (selectedSystem === "missing_zero") {
    return (
      <MissingHabitantCreateForm
        campaignId={campaignId}
        onCancel={!systemParam ? () => setSelectedSystem(null) : undefined}
      />
    );
  }

  if (selectedSystem === "fallout_2d20") {
    return (
      <div className="mx-auto w-full max-w-5xl py-6 px-4">
        <FalloutCharacterWizard
          campaignId={campaignId}
          onSuccess={() => router.push("/player")}
          onCancel={!systemParam ? () => setSelectedSystem(null) : undefined}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-4xl py-6 px-4">
      <div className="mb-8 text-center">
        <div className="flex items-center justify-center gap-2 mb-3">
          <Link
            href="/player"
            className="text-xs font-semibold text-purple-400 hover:text-purple-300 transition-colors"
          >
            ← Voltar ao Painel
          </Link>
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
          A qual sistema este personagem pertence?
        </h1>
        <p className="mt-2 text-sm text-gray-400">
          Escolha as regras e o estilo de jogo para iniciar a criação da sua ficha.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Card A: Libmork Clássico (d20) */}
        <div
          onClick={() => setSelectedSystem("libmork")}
          className="group relative cursor-pointer overflow-hidden rounded-2xl border border-gray-800 bg-gray-900/70 p-6 transition-all hover:border-purple-500 hover:bg-gray-900 hover:shadow-[0_0_25px_rgba(147,51,234,0.2)] flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between mb-4">
              <span className="rounded-full bg-purple-950/80 border border-purple-800/60 px-3 py-1 text-xs font-bold text-purple-300">
                Fantasia Clássica
              </span>
              <span className="text-2xl">⚔️</span>
            </div>
            <h2 className="text-xl font-bold text-white group-hover:text-purple-300 transition-colors">
              Libmork Clássico (d20)
            </h2>
            <p className="mt-2 text-xs text-gray-400 leading-relaxed">
              Crie seu herói com atributos clássicos (FOR, DES, CON, INT, SAB, CAR), raças e
              ancestralidades, classes customizadas, magias, perícias e progressão por níveis.
            </p>
          </div>
          <div className="mt-6 flex items-center justify-between border-t border-gray-800/80 pt-4">
            <span className="text-xs text-gray-500 font-medium">Wizard passo a passo</span>
            <span className="text-xs font-bold text-purple-400 group-hover:translate-x-1 transition-transform">
              Criar Personagem →
            </span>
          </div>
        </div>

        {/* Card B: MISSING — Edição ZERO (Horror Analógico) */}
        <div
          onClick={() => setSelectedSystem("missing_zero")}
          className="group relative cursor-pointer overflow-hidden rounded-2xl border border-zinc-800 bg-[#0e0f11] p-6 transition-all hover:border-rose-600 hover:bg-zinc-950 hover:shadow-[0_0_25px_rgba(225,29,72,0.2)] flex flex-col justify-between font-mono"
        >
          <div>
            <div className="flex items-center justify-between mb-4">
              <span className="rounded-full bg-rose-950/80 border border-rose-800/60 px-3 py-1 text-xs font-bold text-rose-300">
                Horror Analógico
              </span>
              <span className="text-2xl">📼</span>
            </div>
            <h2 className="text-xl font-bold text-zinc-100 group-hover:text-rose-400 transition-colors">
              MISSING — Edição ZERO (Horror Analógico)
            </h2>
            <p className="mt-2 text-xs text-zinc-400 leading-relaxed font-sans">
              Sistema minimalista baseado em dados d6. Crie um Habitante com registro pautado de
              memórias, slots de equipamento oficiais e mecânicas de esquecimento e desaparecimento.
            </p>
          </div>
          <div className="mt-6 flex items-center justify-between border-t border-zinc-800/80 pt-4">
            <span className="text-xs text-zinc-500 font-medium">Registro Pautado // 2d6</span>
            <span className="text-xs font-bold text-rose-400 group-hover:translate-x-1 transition-transform">
              Criar Habitante →
            </span>
          </div>
        </div>

        {/* Card C: Fallout 2d20 (Sobrevivência Pós-Apocalíptica) */}
        <div
          onClick={() => setSelectedSystem("fallout_2d20")}
          className="group relative cursor-pointer overflow-hidden rounded-2xl border border-emerald-900/60 bg-zinc-950 p-6 transition-all hover:border-emerald-400 hover:bg-black hover:shadow-[0_0_25px_rgba(16,185,129,0.2)] flex flex-col justify-between font-mono"
        >
          <div>
            <div className="flex items-center justify-between mb-4">
              <span className="rounded-full bg-emerald-950/80 border border-emerald-600/60 px-3 py-1 text-xs font-bold text-emerald-300">
                Pós-Apocalíptico
              </span>
              <span className="text-2xl">☢️</span>
            </div>
            <h2 className="text-xl font-bold text-emerald-100 group-hover:text-emerald-300 transition-colors">
              Fallout 2d20 (Pip-Boy)
            </h2>
            <p className="mt-2 text-xs text-zinc-400 leading-relaxed font-sans">
              Sistema oficial 2d20 da Modiphius. Distribua atributos S.P.E.C.I.A.L., escolha suas 3
              Tag Skills, gerencie radiação, membros e Action Points no Pip-Boy 3000.
            </p>
          </div>
          <div className="mt-6 flex items-center justify-between border-t border-emerald-900/50 pt-4">
            <span className="text-xs text-emerald-600 font-medium">RobCo Pip-Boy // 2d20</span>
            <span className="text-xs font-bold text-emerald-400 group-hover:translate-x-1 transition-transform">
              Criar Sobrevivente →
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function NewCharacterPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[300px] items-center justify-center">
          <Spinner size="lg" />
        </div>
      }
    >
      <NewCharacterContent />
    </Suspense>
  );
}
