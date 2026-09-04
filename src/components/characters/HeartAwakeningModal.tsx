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
    icon: "A",
  },
  {
    id: "salvaguarda",
    name: "Relíquia da Salvaguarda",
    quote: "Um elmo partido que ainda ecoa a promessa de proteger",
    icon: "B",
  },
  {
    id: "segredo",
    name: "Relíquia do Segredo",
    quote: "Um espelho trincado que reflete verdades que os olhos desviam",
    icon: "C",
  },
];

const Q1_OPTIONS: Array<{ id: Q1Origin; title: string; desc: string; glyph: string }> = [
  { id: "carta", title: "Carta", desc: "Uma carta que nunca tive coragem de abrir", glyph: "D" },
  { id: "moeda", title: "Moeda", desc: "Uma moeda de duas caras, ambas gastas", glyph: "E" },
  { id: "amuleto", title: "Amuleto", desc: "O amuleto frio daqueles que já partiram", glyph: "F" },
];

const Q2_OPTIONS: Array<{ id: Q2Impulse; title: string; desc: string; glyph: string }> = [
  { id: "colina", title: "Colina", desc: "Para o topo da colina, onde posso ver o mundo primeiro", glyph: "G" },
  { id: "floresta", title: "Floresta", desc: "Para dentro da floresta, onde as sombras me escondem", glyph: "H" },
  { id: "mar", title: "Mar", desc: "Para a beira do mar, esperando o que a maré vai trazer", glyph: "I" },
];

const Q3_OPTIONS: Array<{ id: Q3End; title: string; desc: string; glyph: string }> = [
  { id: "luzes", title: "Luzes", desc: "Que eu tremo quando as luzes se apagam", glyph: "J" },
  { id: "cidade", title: "Cidade", desc: "Que eu esqueci o som da voz mecânica da minha cidade", glyph: "K" },
  { id: "odiar", title: "Odiar", desc: "Que eu mentiria para salvar quem odeio", glyph: "L" },
];

export function HeartAwakeningModal({
  isOpen,
  onClose,
  onComplete,
}: HeartAwakeningModalProps) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [questionStep, setQuestionStep] = useState<1 | 2 | 3>(1);

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
      setQuestionStep(1);
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-3 sm:p-4 backdrop-blur-md transition-all w-full overflow-hidden">
      <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-purple-900/60 bg-gradient-to-b from-gray-950 via-purple-950/40 to-gray-950 p-4 sm:p-8 text-gray-100 shadow-[0_0_50px_rgba(112,26,117,0.3)]">
        
        {/* Decorative ambient elements */}
        <div className="pointer-events-none absolute -top-24 -left-24 h-64 w-64 rounded-full bg-purple-600/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -right-24 h-64 w-64 rounded-full bg-blue-600/10 blur-3xl" />

        {/* Modal Header */}
        <div className="relative mb-4 sm:mb-6 flex items-center justify-between border-b border-purple-900/40 pb-3 sm:pb-4">
          <div>
            <h2 className="text-lg sm:text-2xl font-extrabold tracking-wider text-purple-200 uppercase drop-shadow-[0_2px_10px_rgba(168,85,247,0.4)]">
              O Despertar do Coração
            </h2>
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 text-[10px] sm:text-xs font-mono mt-1">
              <span className={step === 1 ? "text-purple-200 font-bold underline" : step > 1 ? "text-purple-400/60" : "text-gray-500"}>
                Relíquias
              </span>
              <span className="text-purple-600/60">→</span>
              <span className={step === 2 && questionStep === 1 ? "text-purple-200 font-bold underline" : (step === 2 && questionStep > 1) || step > 2 ? "text-purple-400/60" : "text-gray-500"}>
                Pergunta 1/3
              </span>
              <span className="text-purple-600/60">→</span>
              <span className={step === 2 && questionStep === 2 ? "text-purple-200 font-bold underline" : (step === 2 && questionStep > 2) || step > 2 ? "text-purple-400/60" : "text-gray-500"}>
                Pergunta 2/3
              </span>
              <span className="text-purple-600/60">→</span>
              <span className={step === 2 && questionStep === 3 ? "text-purple-200 font-bold underline" : step > 2 ? "text-purple-400/60" : "text-gray-500"}>
                Pergunta 3/3
              </span>
              <span className="text-purple-600/60">→</span>
              <span className={step === 3 ? "text-purple-200 font-bold underline" : "text-gray-500"}>
                O Despertar
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1.5 sm:p-2 text-gray-400 hover:bg-purple-950 hover:text-white transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Modal Content */}
        <div className="relative min-h-[300px] sm:min-h-[360px] flex flex-col justify-between">
          
          {/* STEP 1: A Escolha das Relíquias */}
          {step === 1 && (
            <div className="space-y-5 sm:space-y-6 animate-fadeIn">
              <div>
                <h3 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-purple-300 mb-1">
                  Escolha suas Relíquias
                </h3>
                <p className="text-[11px] sm:text-xs text-gray-400">
                  Selecione uma relíquia como Dominante e outra como Sacrificada.
                </p>
                <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-3">
                  {RELICS.map((relic) => {
                    const isChosen = chosenRelic === relic.id;
                    const isSacrificed = sacrificedRelic === relic.id;
                    return (
                      <div
                        key={relic.id}
                        className={`group relative flex flex-col justify-between rounded-xl border p-3 sm:p-4 text-left transition-all duration-200 ${
                          isChosen
                            ? "border-purple-400 bg-purple-950/80 shadow-[0_0_15px_rgba(168,85,247,0.4)] ring-1 ring-amber-400/60"
                            : isSacrificed
                            ? "border-red-500/80 bg-red-950/50 shadow-[0_0_15px_rgba(239,68,68,0.2)] ring-1 ring-red-400/50"
                            : "border-purple-900/40 bg-gray-900/60 hover:border-purple-700/60 hover:bg-purple-950/30"
                        }`}
                      >
                        <div>
                          <div className="flex items-center justify-between mb-1 sm:mb-2">
                            <div
                              className={`font-fantasy text-2xl sm:text-3xl leading-none ${
                                isChosen
                                  ? "text-amber-300"
                                  : isSacrificed
                                  ? "text-red-400"
                                  : "text-purple-300"
                              }`}
                            >
                              {relic.icon}
                            </div>
                            {isChosen && (
                              <span className="rounded bg-gradient-to-r from-purple-600 to-amber-500 px-2 py-0.5 text-[9px] sm:text-[10px] font-bold text-white uppercase tracking-wider">
                                Escolhida
                              </span>
                            )}
                            {isSacrificed && (
                              <span className="rounded bg-red-600 px-2 py-0.5 text-[9px] sm:text-[10px] font-bold text-white uppercase tracking-wider">
                                Sacrificada
                              </span>
                            )}
                          </div>
                          <div className="font-bold text-xs sm:text-sm text-white">
                            {relic.name}
                          </div>
                          <p className="mt-1 text-[10px] sm:text-[11px] text-gray-400 italic leading-relaxed">
                            &quot;{relic.quote}&quot;
                          </p>
                        </div>

                        <div className="mt-3 pt-3 border-t border-purple-900/30 grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            disabled={isSacrificed}
                            onClick={() => setChosenRelic(relic.id)}
                            className={`px-2 py-1.5 rounded text-[10px] sm:text-xs font-semibold transition-all ${
                              isChosen
                                ? "bg-purple-600 text-white shadow-sm ring-1 ring-amber-300"
                                : isSacrificed
                                ? "bg-gray-800/50 text-gray-600 cursor-not-allowed border border-gray-800"
                                : "bg-purple-950/60 text-purple-200 border border-purple-800/60 hover:bg-purple-900 hover:text-white"
                            }`}
                          >
                            Escolher
                          </button>
                          <button
                            type="button"
                            disabled={isChosen}
                            onClick={() => setSacrificedRelic(relic.id)}
                            className={`px-2 py-1.5 rounded text-[10px] sm:text-xs font-semibold transition-all ${
                              isSacrificed
                                ? "bg-red-600 text-white shadow-sm ring-1 ring-red-300"
                                : isChosen
                                ? "bg-gray-800/50 text-gray-600 cursor-not-allowed border border-gray-800"
                                : "bg-red-950/40 text-red-300 border border-red-900/60 hover:bg-red-900 hover:text-white"
                            }`}
                          >
                            Sacrificar
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="flex justify-end pt-3 sm:pt-4 border-t border-purple-900/30">
                <Button
                  onClick={handleNextStep1}
                  disabled={!chosenRelic || !sacrificedRelic || chosenRelic === sacrificedRelic}
                  variant="master"
                  className="w-full sm:w-auto px-6 py-2 text-xs sm:text-sm font-semibold"
                >
                  Avançar para as Vozes →
                </Button>
              </div>
            </div>
          )}

          {/* STEP 2: O Questionário das Vozes Sem Rosto (1 Pergunta por Vez) */}
          {step === 2 && (
            <div className="space-y-4 sm:space-y-6 animate-fadeIn">
              {/* Sub-etapa 1: Pergunta 1 (Origem) */}
              {questionStep === 1 && (
                <>
                  <div>
                    <span className="text-[10px] sm:text-xs font-semibold tracking-wider text-purple-400 uppercase">
                      Vozes Sem Rosto — Pergunta 1 de 3
                    </span>
                    <h3 className="text-sm sm:text-base font-bold text-purple-200 mt-1">
                      Pergunta 1 (Origem) — &quot;Qual lembrança guardas do passado?&quot;
                    </h3>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-3">
                    {Q1_OPTIONS.map((opt) => {
                      const isSelected = q1Origin === opt.id;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => setQ1Origin(opt.id)}
                          className={`group relative flex flex-col justify-between rounded-xl border p-3 sm:p-4 text-left transition-all duration-200 ${
                            isSelected
                              ? "border-purple-500 bg-purple-950/70 text-white font-semibold shadow-[0_0_15px_rgba(168,85,247,0.3)] ring-1 ring-purple-400"
                              : "border-purple-900/40 bg-gray-900/60 text-gray-300 hover:border-purple-700/60 hover:bg-purple-950/30"
                          }`}
                        >
                          <div>
                            <div className="flex items-center gap-2.5 mb-2">
                              <span className="font-fantasy text-2xl text-purple-400 group-hover:text-purple-300 leading-none">
                                {opt.glyph}
                              </span>
                              <span className="font-bold text-xs sm:text-sm text-purple-200 group-hover:text-white">
                                {opt.title}
                              </span>
                            </div>
                            <p className="text-[10px] sm:text-[11px] text-gray-400 italic leading-relaxed">
                              &quot;{opt.desc}&quot;
                            </p>
                          </div>
                          {isSelected && (
                            <span className="mt-3 inline-block self-start rounded bg-purple-600 px-2 py-0.5 text-[9px] sm:text-[10px] font-bold text-white uppercase tracking-wider">
                              Selecionado
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>

                  <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 sm:pt-4 border-t border-purple-900/30">
                    <Button
                      onClick={() => setStep(1)}
                      variant="secondary"
                      className="w-full sm:w-auto px-4 py-2 text-xs"
                    >
                      ← Voltar às Relíquias
                    </Button>
                    <Button
                      onClick={() => setQuestionStep(2)}
                      disabled={!q1Origin}
                      variant="master"
                      className="w-full sm:w-auto px-6 py-2 text-xs sm:text-sm font-semibold"
                    >
                      Avançar →
                    </Button>
                  </div>
                </>
              )}

              {/* Sub-etapa 2: Pergunta 2 (Impulso) */}
              {questionStep === 2 && (
                <>
                  <div>
                    <span className="text-[10px] sm:text-xs font-semibold tracking-wider text-purple-400 uppercase">
                      Vozes Sem Rosto — Pergunta 2 de 3
                    </span>
                    <h3 className="text-sm sm:text-base font-bold text-purple-200 mt-1">
                      Pergunta 2 (Impulso) — &quot;Para onde teu olhar se dirige quando a tempestade se aproxima?&quot;
                    </h3>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-3">
                    {Q2_OPTIONS.map((opt) => {
                      const isSelected = q2Impulse === opt.id;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => setQ2Impulse(opt.id)}
                          className={`group relative flex flex-col justify-between rounded-xl border p-3 sm:p-4 text-left transition-all duration-200 ${
                            isSelected
                              ? "border-purple-500 bg-purple-950/70 text-white font-semibold shadow-[0_0_15px_rgba(168,85,247,0.3)] ring-1 ring-purple-400"
                              : "border-purple-900/40 bg-gray-900/60 text-gray-300 hover:border-purple-700/60 hover:bg-purple-950/30"
                          }`}
                        >
                          <div>
                            <div className="flex items-center gap-2.5 mb-2">
                              <span className="font-fantasy text-2xl text-purple-400 group-hover:text-purple-300 leading-none">
                                {opt.glyph}
                              </span>
                              <span className="font-bold text-xs sm:text-sm text-purple-200 group-hover:text-white">
                                {opt.title}
                              </span>
                            </div>
                            <p className="text-[10px] sm:text-[11px] text-gray-400 italic leading-relaxed">
                              &quot;{opt.desc}&quot;
                            </p>
                          </div>
                          {isSelected && (
                            <span className="mt-3 inline-block self-start rounded bg-purple-600 px-2 py-0.5 text-[9px] sm:text-[10px] font-bold text-white uppercase tracking-wider">
                              Selecionado
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>

                  <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 sm:pt-4 border-t border-purple-900/30">
                    <Button
                      onClick={() => setQuestionStep(1)}
                      variant="secondary"
                      className="w-full sm:w-auto px-4 py-2 text-xs"
                    >
                      ← Voltar
                    </Button>
                    <Button
                      onClick={() => setQuestionStep(3)}
                      disabled={!q2Impulse}
                      variant="master"
                      className="w-full sm:w-auto px-6 py-2 text-xs sm:text-sm font-semibold"
                    >
                      Avançar →
                    </Button>
                  </div>
                </>
              )}

              {/* Sub-etapa 3: Pergunta 3 (O Fim) */}
              {questionStep === 3 && (
                <>
                  <div>
                    <span className="text-[10px] sm:text-xs font-semibold tracking-wider text-purple-400 uppercase">
                      Vozes Sem Rosto — Pergunta 3 de 3
                    </span>
                    <h3 className="text-sm sm:text-base font-bold text-purple-200 mt-1">
                      Pergunta 3 (O Fim) — &quot;Qual segredo confessarias apenas ao silêncio?&quot;
                    </h3>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-3">
                    {Q3_OPTIONS.map((opt) => {
                      const isSelected = q3End === opt.id;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => setQ3End(opt.id)}
                          className={`group relative flex flex-col justify-between rounded-xl border p-3 sm:p-4 text-left transition-all duration-200 ${
                            isSelected
                              ? "border-purple-500 bg-purple-950/70 text-white font-semibold shadow-[0_0_15px_rgba(168,85,247,0.3)] ring-1 ring-purple-400"
                              : "border-purple-900/40 bg-gray-900/60 text-gray-300 hover:border-purple-700/60 hover:bg-purple-950/30"
                          }`}
                        >
                          <div>
                            <div className="flex items-center gap-2.5 mb-2">
                              <span className="font-fantasy text-2xl text-purple-400 group-hover:text-purple-300 leading-none">
                                {opt.glyph}
                              </span>
                              <span className="font-bold text-xs sm:text-sm text-purple-200 group-hover:text-white">
                                {opt.title}
                              </span>
                            </div>
                            <p className="text-[10px] sm:text-[11px] text-gray-400 italic leading-relaxed">
                              &quot;{opt.desc}&quot;
                            </p>
                          </div>
                          {isSelected && (
                            <span className="mt-3 inline-block self-start rounded bg-purple-600 px-2 py-0.5 text-[9px] sm:text-[10px] font-bold text-white uppercase tracking-wider">
                              Selecionado
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>

                  <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 sm:pt-4 border-t border-purple-900/30">
                    <Button
                      onClick={() => setQuestionStep(2)}
                      variant="secondary"
                      className="w-full sm:w-auto px-4 py-2 text-xs"
                    >
                      ← Voltar
                    </Button>
                    <Button
                      onClick={handleFetchAwakening}
                      disabled={!q3End}
                      variant="master"
                      className="w-full sm:w-auto px-6 py-2 text-xs sm:text-sm font-semibold"
                    >
                      Consultar o Oráculo ✨
                    </Button>
                  </div>
                </>
              )}
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
                  <Button onClick={() => { setStep(2); setQuestionStep(3); }} variant="secondary" className="mx-auto">
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
