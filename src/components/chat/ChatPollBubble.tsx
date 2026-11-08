"use client";

import React, { useState } from "react";
import { BarChart2, CheckSquare, Square, Circle, CheckCircle2, Lock } from "lucide-react";
import type { PollDetail } from "@/lib/server/chat-service";

type ChatPollBubbleProps = {
  poll: PollDetail;
  isMaster: boolean;
  currentUserId?: string;
  onVote: (pollId: string, optionIds: string[]) => Promise<void>;
  onClosePoll: (pollId: string) => Promise<void>;
};

export function ChatPollBubble({
  poll,
  isMaster,
  currentUserId,
  onVote,
  onClosePoll,
}: ChatPollBubbleProps) {
  const [selectedOptionIds, setSelectedOptionIds] = useState<string[]>(
    poll.userVotedOptionIds || [],
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isClosing, setIsClosing] = useState(false);

  const isOpen = poll.status === "open";
  const canClose = isMaster || (currentUserId && poll.createdById === currentUserId);

  const toggleOption = async (optionId: string) => {
    if (!isOpen || isSubmitting) return;

    let nextSelected: string[];
    if (poll.isMultipleChoice) {
      if (selectedOptionIds.includes(optionId)) {
        nextSelected = selectedOptionIds.filter((id) => id !== optionId);
      } else {
        nextSelected = [...selectedOptionIds, optionId];
      }
    } else {
      nextSelected = [optionId];
    }

    if (nextSelected.length === 0) return;

    setSelectedOptionIds(nextSelected);
    setIsSubmitting(true);
    try {
      await onVote(poll.id, nextSelected);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = async () => {
    if (!canClose || isClosing || !isOpen) return;
    setIsClosing(true);
    try {
      await onClosePoll(poll.id);
    } finally {
      setIsClosing(false);
    }
  };

  return (
    <div
      data-testid="chat-poll-bubble"
      className="flex flex-col gap-3 rounded-xl border border-secondary-border bg-secondary-card p-4 min-w-[260px] max-w-[420px] text-secondary-pure shadow-sm"
    >
      {/* Header da Enquete */}
      <div className="flex items-start justify-between gap-2 border-b border-secondary-border/50 pb-2.5">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-accent/20 text-accent">
            <BarChart2 className="h-4 w-4" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-secondary-pure leading-tight">{poll.title}</h4>
            <span className="text-[10px] text-secondary-muted">
              Criada por {poll.createdByName} ·{" "}
              {poll.isMultipleChoice ? "Múltipla Escolha" : "Voto Único"}
            </span>
          </div>
        </div>
        {!isOpen && (
          <span
            data-testid="poll-closed-badge"
            className="flex items-center gap-1 rounded bg-red-950/70 border border-red-800/60 px-2 py-0.5 text-[10px] font-bold text-red-300 shrink-0"
          >
            <Lock className="h-3 w-3" />
            Encerrada
          </span>
        )}
      </div>

      {/* Lista de Opções */}
      <div className="flex flex-col gap-2">
        {poll.options.map((option) => {
          const isSelected = (poll.userVotedOptionIds || []).includes(option.id);
          return (
            <button
              key={option.id}
              type="button"
              disabled={!isOpen || isSubmitting}
              onClick={() => void toggleOption(option.id)}
              data-testid={`poll-option-${option.id}`}
              className={`group relative flex flex-col overflow-hidden rounded-lg border text-left transition-all p-2.5 cursor-pointer disabled:cursor-default ${
                isSelected
                  ? "border-accent bg-accent/15"
                  : "border-secondary-border/80 bg-secondary-input hover:border-accent/60"
              }`}
            >
              {/* Barra de progresso visual */}
              <div
                className="absolute inset-y-0 left-0 bg-accent/25 transition-all duration-500 ease-out pointer-events-none"
                style={{ width: `${option.percentage}%` }}
              />

              <div className="relative z-10 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  {poll.isMultipleChoice ? (
                    isSelected ? (
                      <CheckSquare className="h-4 w-4 shrink-0 text-accent" />
                    ) : (
                      <Square className="h-4 w-4 shrink-0 text-secondary-muted" />
                    )
                  ) : isSelected ? (
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-accent" />
                  ) : (
                    <Circle className="h-4 w-4 shrink-0 text-secondary-muted" />
                  )}
                  <span className="text-xs font-medium text-secondary-pure truncate">
                    {option.text}
                  </span>
                </div>

                <div className="flex items-center gap-1.5 shrink-0 text-right">
                  <span className="text-xs font-bold text-secondary-pure">
                    {option.percentage}%
                  </span>
                  <span className="text-[10px] text-secondary-muted">({option.votesCount})</span>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Footer da Enquete */}
      <div className="flex items-center justify-between gap-2 pt-1 text-[11px] text-secondary-muted">
        <span>
          Total: {poll.totalVotes} voto{poll.totalVotes === 1 ? "" : "s"}
        </span>

        {isOpen && canClose && (
          <button
            type="button"
            disabled={isClosing}
            onClick={() => void handleClose()}
            data-testid="close-poll-button"
            className="rounded border border-red-800/80 bg-red-950/40 px-2 py-1 text-[10px] font-semibold text-red-300 hover:bg-red-900/50 transition-colors disabled:opacity-50 cursor-pointer"
          >
            {isClosing ? "Encerrando..." : "Encerrar Enquete"}
          </button>
        )}
      </div>
    </div>
  );
}
