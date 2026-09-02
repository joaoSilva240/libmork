"use client";

import React, { useState, useEffect } from "react";
import { Button, Spinner } from "@/components/ui";

export interface HeartAwakeningResult {
  prophecy: string;
  attributes: {
    forca: number;
    destreza: number;
    vigor: number;
    inteligencia: number;
    empatia: number;
  };
  suggestedClass: string;
  suggestedTrait: string;
}

interface HeartAwakeningModalProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: (result: HeartAwakeningResult) => void;
}

type ChosenRelic = "conflito" | "salvaguarda" | "segredo";
type SacrificedRelic = "conflito" | "salvaguarda" | "segredo";
type Q1Origin = "carta" | "moeda" | "amuleto";
type Q2Impulse = "colina" | "floresta" | "mar";
type Q3End = "luzes" | "cidade" | "odiar";

const RELICS: Array<{ id: ChosenRelic; name: string; quote: string; icon: string }> = [
  {
    id: "conflito",
    name: "Relíquia do Conflito",
    quote: "Uma lâmina cega que busca propósito no sangue",
    icon: "⚔️",
  },
  {
    id: "salvaguarda",
    name: "Relíquia da Salvaguarda",
    quote: "Um elmo partido que ainda ecoa a promessa de proteger",
    icon: "🛡️",
  },
  {
    id: "segredo",
    name: "Relíquia do Segredo",
    quote: "Um espelho trincado que reflete verdades que os olhos desviam",
    icon: "👁️",
  },
];

const Q1_OPTIONS: Array<{ id: Q1Origin; title: string; desc: string }> = [
  { id: "carta", title: "Carta", desc: "Uma carta que nunca tive coragem de abrir" },
  { id: "moeda", title: "Moeda", desc: "Uma moeda de duas caras, ambas gastas" },
  { id: "amuleto", title: "Amuleto", desc: "O amuleto frio daqueles que já partiram" },
];

const Q2_OPTIONS: Array<{ id: Q2Impulse; title: string; desc: string }> = [
  { id: "colina", title: "Colina", desc: "Para o topo da colina, onde posso ver o mundo primeiro" },
  { id: "floresta", title: "Floresta", desc: "Para dentro da floresta, onde as sombras me escondem" },
  { id: "mar", title: "Mar", desc: "Para a beira do mar, esperando o que a maré vai trazer" },
];

const Q3_OPTIONS: Array<{ id: Q3End; title: string; desc: string }> = [
  { id: "luzes", title: "Luzes", desc: "Que eu tremo quando as luzes se apagam" },
  { id: "cidade", title: "Cidade", desc: "Que eu esqueci o som da voz mecânica da minha cidade" },
  { id: "odiar", title: "Odiar", desc: "Que eu mentiria para salvar quem odeio" },
];

export function HeartAwakeningModal({
  isOpen,
  onClose,
  onComplete,
}: HeartAwakeningModalProps) {
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Etapa 1
  const [chosenRelic, setChosenRelic] = useState<ChosenRelic | null>(null);
  const [sacrificedRelic, setSacrificedRelic] = useState<SacrificedRelic | null>(null);

  // Etapa 2
  const [q1Origin, setQ1Origin] = useState<Q1Origin | null>(null);
  const [q2Impulse, setQ2Impulse] = useState<Q2Impulse | null>(null);
  const [q3End, setQ3End] = useState<Q3End | null>(null);

  // Etapa 3
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [awakeningResult, setAwakeningResult] = useState<HeartAwakeningResult | null>(null);
  const [displayedText, setDisplayedText] = useState<string>("");

  // Control typing effect
  useEffect(() => {
    if (step === 3 && awakeningResult?.prophecy) {
      let index = 0;
      setDisplayedText("");
      const interval = setInterval(() => {
        if (index < awakeningResult.prophecy.length) {
          setDisplayedText(awakeningResult.prophecy.slice(0, index + 1));
          index++;
        } else {
          clearInterval(interval);
        }
      }, 25);
      return () => clearInterval(interval);
    }
  }, [step, awakeningResult]);

  if (!isOpen) return null;

  const handleNextStep1 = () => {
    if (chosenRelic && sacrificedRelic && chosenRelic !== sacrificedRelic) {
      setStep(2);
    }
  };

  const handleFetchAwakening = async () => {
    if (!chosenRelic || !sacrificedRelic || !q1Origin || !q2Impulse || !q3End) {
      return;
    }

    setIsLoading(true);
    setErrorMsg(null);
    setStep(3);

    try {
      const response = await fetch("/api/characters/awakening", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chosenRelic,
          sacrificedRelic,
          q1Origin,
          q2Impulse,
          q3End,
        }),
        credentials: "include",
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Falha ao obter o Despertar");
      }

      const data: HeartAwakeningResult = await response.json();
      setAwakeningResult(data);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Erro ao conectar ao Oráculo.";
      setErrorMsg(message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAcceptDestination = () => {
    if (awakeningResult) {
      onComplete(awakeningResult);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md transition-all">
      <div className="relative w-full max-w-2xl overflow-hidden rounded-2xl border border-purple-900/60 bg-gradient-to-b from-gray-950 via-purple-950/40 to-gray-950 p-6 sm:p-8 text-gray-100 shadow-[0_0_50px_rgba(112,26,117,0.3)]">
        
        {/* Decorative ambient elements */}
        <div className="pointer-events-none absolute -top-24 -left-24 h-64 w-64 rounded-full bg-purple-600/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -right-24 h-64 w-64 rounded-full bg-blue-600/10 blur-3xl" />

        {/* Modal Header */}
        <div className="relative mb-6 flex items-center justify-between border-b border-purple-900/40 pb-4">
          <div>
            <h2 className="text-xl sm:text-2xl font-extrabold tracking-wider text-purple-200 uppercase drop-shadow-[0_2px_10px_rgba(168,85,247,0.4)]">
              O Despertar do Coração
            </h2>
            <p className="text-xs text-purple-400/80 font-mono mt-0.5">
              Passo {step} de 3 — {step === 1 ? "A Escolha das Relíquias" : step === 2 ? "O Questionário das Vozes Sem Rosto" : "O Despertar"}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-gray-400 hover:bg-purple-950 hover:text-white transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Modal Content */}
        <div className="relative min-h-[360px] flex flex-col justify-between">
          
          {/* STEP 1: A Escolha das Relíquias */}
          {step === 1 && (
            <div className="space-y-6 animate-fadeIn">
              <div>
                <h3 className="text-sm font-bold uppercase tracking-wider text-purple-300 mb-1">
                  1. Escolha sua Relíquia Dominante
                </h3>
                <p className="text-xs text-gray-400">
                  Esta relíquia guiará os pilares da sua força interior.
                </p>
                <div className="mt-3 grid gap-3 sm:grid-cols-3">
                  {RELICS.map((relic) => {
                    const isChosen = chosenRelic === relic.id;
                    const isSacrificed = sacrificedRelic === relic.id;
                    return (
                      <button
                        key={relic.id}
                        type="button"
                        disabled={isSacrificed}
                        onClick={() => {
                          setChosenRelic(relic.id);
                        }}
                        className={`group relative flex flex-col justify-between rounded-xl border p-4 text-left transition-all duration-200 ${
                          isChosen
                            ? "border-purple-500 bg-purple-950/70 shadow-[0_0_15px_rgba(168,85,247,0.3)] ring-1 ring-purple-400"
                            : isSacrificed
                            ? "opacity-30 border-gray-800 bg-gray-900/40 cursor-not-allowed"
                            : "border-purple-900/40 bg-gray-900/60 hover:border-purple-700/60 hover:bg-purple-950/30"
                        }`}
                      >
                        <div>
                          <div className="text-2xl mb-2">{relic.icon}</div>
                          <div className="font-bold text-xs text-white group-hover:text-purple-300">
                            {relic.name}
                          </div>
                          <p className="mt-1 text-[11px] text-gray-400 italic leading-relaxed">
                            &quot;{relic.quote}&quot;
                          </p>
                        </div>
                        {isChosen && (
                          <span className="mt-3 inline-block rounded bg-purple-600 px-2 py-0.5 text-[10px] font-bold text-white uppercase tracking-wider">
                            Escolhida
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <h3 className="text-sm font-bold uppercase tracking-wider text-purple-300 mb-1">
                  2. Escolha uma Relíquia para Sacrificar
                </h3>
                <p className="text-xs text-gray-400">
                  Aquilo de que você se desfaz para alcançar o despertar.
                </p>
                <div className="mt-3 grid gap-3 sm:grid-cols-3">
                  {RELICS.map((relic) => {
                    const isChosen = chosenRelic === relic.id;
                    const isSacrificed = sacrificedRelic === relic.id;
                    return (
                      <button
                        key={relic.id}
                        type="button"
                        disabled={isChosen}
                        onClick={() => {
                          setSacrificedRelic(relic.id);
                        }}
                        className={`group relative flex flex-col justify-between rounded-xl border p-4 text-left transition-all duration-200 ${
                          isSacrificed
                            ? "border-red-500/80 bg-red-950/50 shadow-[0_0_15px_rgba(239,68,68,0.2)] ring-1 ring-red-400"
                            : isChosen
                            ? "opacity-30 border-gray-800 bg-gray-900/40 cursor-not-allowed"
                            : "border-purple-900/40 bg-gray-900/60 hover:border-red-900/60 hover:bg-red-950/20"
                        }`}
                      >
                        <div>
                          <div className="text-2xl mb-2">{relic.icon}</div>
                          <div className="font-bold text-xs text-white group-hover:text-red-300">
                            {relic.name}
                          </div>
                          <p className="mt-1 text-[11px] text-gray-400 italic leading-relaxed">
                            &quot;{relic.quote}&quot;
                          </p>
                        </div>
                        {isSacrificed && (
                          <span className="mt-3 inline-block rounded bg-red-600 px-2 py-0.5 text-[10px] font-bold text-white uppercase tracking-wider">
                            Sacrificada
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex justify-end pt-4 border-t border-purple-900/30">
                <Button
                  onClick={handleNextStep1}
                  disabled={!chosenRelic || !sacrificedRelic || chosenRelic === sacrificedRelic}
                  variant="master"
                  className="px-6 py-2 text-sm font-semibold"
                >
                  Avançar para as Vozes →
                </Button>
              </div>
            </div>
          )}

          {/* STEP 2: O Questionário das Vozes Sem Rosto */}
          {step === 2 && (
            <div className="space-y-5 animate-fadeIn">
              {/* Pergunta 1: Origem */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-purple-300 mb-2">
                  Pergunta 1 — Qual lembrança guardas do passado?
                </h4>
                <div className="grid gap-2 sm:grid-cols-3">
                  {Q1_OPTIONS.map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setQ1Origin(opt.id)}
                      className={`rounded-xl border p-3 text-left transition-all text-xs ${
                        q1Origin === opt.id
                          ? "border-purple-500 bg-purple-950/70 text-white font-semibold shadow-[0_0_10px_rgba(168,85,247,0.3)]"
                          : "border-purple-900/30 bg-gray-900/50 text-gray-300 hover:border-purple-700/50 hover:bg-purple-950/20"
                      }`}
                    >
                      <div className="font-bold text-purple-200 mb-0.5">{opt.title}</div>
                      <div className="text-[11px] text-gray-400 italic">&quot;{opt.desc}&quot;</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Pergunta 2: Impulso */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-purple-300 mb-2">
                  Pergunta 2 — Para onde teu olhar se dirige quando a tempestade se aproxima?
                </h4>
                <div className="grid gap-2 sm:grid-cols-3">
                  {Q2_OPTIONS.map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setQ2Impulse(opt.id)}
                      className={`rounded-xl border p-3 text-left transition-all text-xs ${
                        q2Impulse === opt.id
                          ? "border-purple-500 bg-purple-950/70 text-white font-semibold shadow-[0_0_10px_rgba(168,85,247,0.3)]"
                          : "border-purple-900/30 bg-gray-900/50 text-gray-300 hover:border-purple-700/50 hover:bg-purple-950/20"
                      }`}
                    >
                      <div className="font-bold text-purple-200 mb-0.5">{opt.title}</div>
                      <div className="text-[11px] text-gray-400 italic">&quot;{opt.desc}&quot;</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Pergunta 3: O Fim */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-purple-300 mb-2">
                  Pergunta 3 — Qual segredo confessarias apenas ao silêncio?
                </h4>
                <div className="grid gap-2 sm:grid-cols-3">
                  {Q3_OPTIONS.map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setQ3End(opt.id)}
                      className={`rounded-xl border p-3 text-left transition-all text-xs ${
                        q3End === opt.id
                          ? "border-purple-500 bg-purple-950/70 text-white font-semibold shadow-[0_0_10px_rgba(168,85,247,0.3)]"
                          : "border-purple-900/30 bg-gray-900/50 text-gray-300 hover:border-purple-700/50 hover:bg-purple-950/20"
                      }`}
                    >
                      <div className="font-bold text-purple-200 mb-0.5">{opt.title}</div>
                      <div className="text-[11px] text-gray-400 italic">&quot;{opt.desc}&quot;</div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-purple-900/30">
                <Button
                  onClick={() => setStep(1)}
                  variant="secondary"
                  className="px-4 py-2 text-xs"
                >
                  ← Voltar às Relíquias
                </Button>
                <Button
                  onClick={handleFetchAwakening}
                  disabled={!q1Origin || !q2Impulse || !q3End}
                  variant="master"
                  className="px-6 py-2 text-sm font-semibold"
                >
                  Consultar o Oráculo ✨
                </Button>
              </div>
            </div>
          )}

          {/* STEP 3: O Despertar (Profecia) */}
          {step === 3 && (
            <div className="flex flex-col justify-between min-h-[340px] space-y-6 animate-fadeIn">
              {isLoading ? (
                <div className="flex flex-col items-center justify-center my-auto py-12 space-y-4">
                  <Spinner size="lg" />
                  <p className="text-sm font-serif italic text-purple-300 animate-pulse">
                    O Oráculo escuta o eco das suas escolhas...
                  </p>
                </div>
              ) : errorMsg ? (
                <div className="my-auto rounded-xl border border-red-800 bg-red-950/40 p-6 text-center space-y-4">
                  <p className="text-sm text-red-300 font-semibold">{errorMsg}</p>
                  <Button onClick={() => setStep(2)} variant="secondary" className="mx-auto">
                    Tentar Novamente
                  </Button>
                </div>
              ) : (
                awakeningResult && (
                  <>
                    <div className="relative my-auto rounded-2xl border border-purple-800/40 bg-purple-950/30 p-6 sm:p-8 backdrop-blur-md shadow-inner overflow-hidden">
                      {/* Mystical watermark icon */}
                      <div className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-5 select-none text-9xl font-serif">
                        ✦
                      </div>

                      <div className="relative z-10 space-y-6">
                        {/* Profecia */}
                        <div>
                          <h4 className="text-xs font-bold uppercase tracking-widest text-purple-400 mb-2">
                            Profecia Revelada
                          </h4>
                          <p className="font-serif text-base sm:text-lg italic leading-relaxed text-purple-100 min-h-[90px]">
                            {displayedText}
                            {displayedText.length < awakeningResult.prophecy.length && (
                              <span className="inline-block w-2 h-4 ml-1 bg-purple-400 animate-ping" />
                            )}
                          </p>
                        </div>

                        {/* Detalhes Sugeridos & Atributos */}
                        <div className="grid gap-4 sm:grid-cols-2 pt-4 border-t border-purple-900/40">
                          <div>
                            <span className="text-[11px] font-bold uppercase tracking-wider text-purple-400 block mb-1">
                              Sugestões do Destino
                            </span>
                            <div className="text-xs text-gray-300 space-y-1">
                              <p>
                                Classe Sugerida:{" "}
                                <span className="font-bold text-white">{awakeningResult.suggestedClass}</span>
                              </p>
                              <p>
                                Traço Revelado:{" "}
                                <span className="font-bold text-purple-300">{awakeningResult.suggestedTrait}</span>
                              </p>
                            </div>
                          </div>

                          <div>
                            <span className="text-[11px] font-bold uppercase tracking-wider text-purple-400 block mb-1">
                              Atributos Despertados
                            </span>
                            <div className="flex flex-wrap gap-2 text-xs">
                              <span className="rounded bg-purple-900/60 border border-purple-700/50 px-2 py-0.5 text-purple-200">
                                FOR: <strong>{awakeningResult.attributes.forca}</strong>
                              </span>
                              <span className="rounded bg-purple-900/60 border border-purple-700/50 px-2 py-0.5 text-purple-200">
                                DES: <strong>{awakeningResult.attributes.destreza}</strong>
                              </span>
                              <span className="rounded bg-purple-900/60 border border-purple-700/50 px-2 py-0.5 text-purple-200">
                                VIG: <strong>{awakeningResult.attributes.vigor}</strong>
                              </span>
                              <span className="rounded bg-purple-900/60 border border-purple-700/50 px-2 py-0.5 text-purple-200">
                                INT: <strong>{awakeningResult.attributes.inteligencia}</strong>
                              </span>
                              <span className="rounded bg-purple-900/60 border border-purple-700/50 px-2 py-0.5 text-purple-200">
                                EMP: <strong>{awakeningResult.attributes.empatia}</strong>
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-end pt-4 border-t border-purple-900/30">
                      <Button
                        onClick={handleAcceptDestination}
                        variant="master"
                        className="w-full sm:w-auto px-8 py-3 text-sm font-bold tracking-wide uppercase shadow-[0_0_25px_rgba(168,85,247,0.5)]"
                      >
                        Despertar e Aceitar o Destino ✨
                      </Button>
                    </div>
                  </>
                )
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
