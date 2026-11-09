"use client";

// =============================================================================
// Libmork — Confirmação de troca de cena com combate ativo (Issue #86, Fase 2)
// =============================================================================
// Diálogo puro (sem estado próprio): o CampaignDetail decide quando abrir e o
// que cada ação faz (encerrar encontro, manter em 2º plano ou cancelar).
// =============================================================================

import { Modal } from "@/components/ui";
import { Swords } from "lucide-react";

type SceneConfirmDialogProps = {
  open: boolean;
  targetLabel: string;
  onCancel: () => void;
  onEndAndSwitch: () => void;
  onKeepAndSwitch: () => void;
};

export function SceneConfirmDialog({
  open,
  targetLabel,
  onCancel,
  onEndAndSwitch,
  onKeepAndSwitch,
}: SceneConfirmDialogProps) {
  return (
    <Modal isOpen={open} onClose={onCancel} aria-label="Combate em andamento">
      <Modal.Header>
        <h2 className="flex items-center gap-2 text-sm font-bold text-white">
          <Swords size={16} className="text-red-400" />
          Há um combate em andamento
        </h2>
      </Modal.Header>
      <Modal.Body>
        <p className="text-xs text-gray-300">
          Trocar para a cena <span className="font-semibold text-white">{targetLabel}</span> pode
          afetar o encontro ativo. O que deseja fazer?
        </p>
      </Modal.Body>
      <Modal.Footer className="flex items-center justify-end gap-2">
        <button
          data-testid="scene-confirm-cancel"
          onClick={onCancel}
          className="rounded-lg border border-gray-700 bg-gray-800 px-3 py-1.5 text-xs font-semibold text-gray-200 hover:bg-gray-700"
        >
          Cancelar
        </button>
        <button
          data-testid="scene-confirm-keep"
          onClick={onKeepAndSwitch}
          className="rounded-lg bg-gray-700 px-3 py-1.5 text-xs font-bold text-white hover:bg-gray-600"
        >
          Manter em 2º plano
        </button>
        <button
          data-testid="scene-confirm-end"
          onClick={onEndAndSwitch}
          className="rounded-lg bg-red-800 px-3 py-1.5 text-xs font-bold text-red-100 hover:bg-red-700"
        >
          Encerrar e trocar
        </button>
      </Modal.Footer>
    </Modal>
  );
}
