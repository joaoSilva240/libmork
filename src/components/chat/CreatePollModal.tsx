"use client";

import React, { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Plus, Trash2, BarChart2 } from "lucide-react";
import type { CreatePollInput } from "@/lib/validators/chat";

type CreatePollModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (pollData: CreatePollInput) => Promise<void>;
};

export function CreatePollModal({ isOpen, onClose, onSubmit }: CreatePollModalProps) {
  const [title, setTitle] = useState("");
  const [options, setOptions] = useState<string[]>(["", ""]);
  const [isMultipleChoice, setIsMultipleChoice] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAddOption = () => {
    if (options.length < 10) {
      setOptions([...options, ""]);
    }
  };

  const handleRemoveOption = (index: number) => {
    if (options.length > 2) {
      setOptions(options.filter((_, idx) => idx !== index));
    }
  };

  const handleOptionChange = (text: string, index: number) => {
    const updated = [...options];
    updated[index] = text;
    setOptions(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedTitle = title.trim();
    if (trimmedTitle.length < 2) {
      setError("A pergunta deve ter pelo menos 2 caracteres");
      return;
    }

    const trimmedOptions = options.map((o) => o.trim()).filter((o) => o.length > 0);
    if (trimmedOptions.length < 2) {
      setError("Preencha pelo menos 2 opções para a enquete");
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit({
        title: trimmedTitle,
        options: trimmedOptions,
        isMultipleChoice,
      });
      setTitle("");
      setOptions(["", ""]);
      setIsMultipleChoice(false);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao criar enquete");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      className="mx-auto max-w-lg overflow-hidden bg-secondary-card border border-secondary-border rounded-2xl shadow-2xl"
    >
      <form onSubmit={handleSubmit} className="flex flex-col h-full">
        <Modal.Header className="flex items-center justify-between border-b border-secondary-border bg-dominant-deep/50 px-5 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-accent/15 border border-accent/30 text-accent">
              <BarChart2 className="h-4 w-4" />
            </div>
            <h3 className="text-base font-bold text-secondary-pure">Nova Enquete da Campanha</h3>
          </div>
          <Modal.CloseButton className="rounded-lg p-1.5 text-secondary-muted hover:text-secondary-pure hover:bg-secondary-input transition-colors cursor-pointer" />
        </Modal.Header>

        <Modal.Body className="flex flex-col gap-4 p-4 overflow-y-auto max-h-[70vh]">
          {error && (
            <div className="rounded-lg bg-red-950/80 border border-red-800 p-2.5 text-xs text-red-300">
              {error}
            </div>
          )}

          {/* Pergunta */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="poll-title" className="text-xs font-semibold text-secondary-pure">
              Pergunta ou Proposta *
            </label>
            <input
              id="poll-title"
              type="text"
              required
              placeholder="Ex.: Qual dia vocês preferem para a próxima sessão?"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="rounded-lg border border-secondary-border bg-secondary-input px-3 py-2 text-sm text-secondary-pure focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>

          {/* Opções */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-secondary-pure">
                Opções de Resposta *
              </label>
              <span className="text-[10px] text-secondary-muted">{options.length}/10 opções</span>
            </div>

            <div className="flex flex-col gap-2">
              {options.map((option, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <span className="text-xs font-bold text-secondary-muted w-4 text-center">
                    {idx + 1}
                  </span>
                  <input
                    type="text"
                    required
                    placeholder={`Opção ${idx + 1}`}
                    value={option}
                    onChange={(e) => handleOptionChange(e.target.value, idx)}
                    className="flex-1 rounded-lg border border-secondary-border bg-secondary-input px-3 py-1.5 text-xs text-secondary-pure focus:outline-none focus:ring-2 focus:ring-accent"
                  />
                  {options.length > 2 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveOption(idx)}
                      className="rounded p-1.5 text-secondary-muted hover:text-red-400 hover:bg-secondary-input transition-colors cursor-pointer"
                      title="Remover opção"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>

            {options.length < 10 && (
              <button
                type="button"
                onClick={handleAddOption}
                className="mt-1 flex items-center justify-center gap-1.5 rounded-lg border border-dashed border-secondary-border py-2 text-xs font-medium text-accent hover:bg-accent/10 transition-colors cursor-pointer"
              >
                <Plus className="h-3.5 w-3.5" />
                Adicionar mais uma opção
              </button>
            )}
          </div>

          {/* Toggle Múltipla Escolha */}
          <label className="flex items-center gap-2.5 pt-1 cursor-pointer">
            <input
              type="checkbox"
              checked={isMultipleChoice}
              onChange={(e) => setIsMultipleChoice(e.target.checked)}
              className="h-4 w-4 rounded border-secondary-border bg-secondary-input text-accent focus:ring-accent accent-accent"
            />
            <span className="text-xs font-medium text-secondary-pure">
              Permitir que jogadores escolham múltiplas opções
            </span>
          </label>
        </Modal.Body>

        <Modal.Footer className="flex items-center justify-end gap-2 border-t border-secondary-border p-4">
          <Button type="button" variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button type="submit" variant="primary" disabled={isSubmitting}>
            {isSubmitting ? "Criando..." : "Criar Enquete"}
          </Button>
        </Modal.Footer>
      </form>
    </Modal>
  );
}
