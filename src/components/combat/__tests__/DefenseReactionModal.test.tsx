import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { DefenseReactionModal } from "../DefenseReactionModal";
import type { DefenseReactionRequestPayload } from "@/context/SocketContext";

const payload: DefenseReactionRequestPayload = {
  campaignId: "camp-1",
  id: "react_1",
  attackerId: "npc-1",
  attackerName: "Goblin Chefe",
  targetId: "char-1",
  targetName: "Guerreiro",
  rawDamage: 11,
  attackRoll: 18,
  isPhysical: true,
  actionName: "Mordissa",
};

const baseProps = {
  requestPayload: payload,
  targetVigor: 10,
  targetDestreza: 12,
  targetLevel: 1,
  onRespond: vi.fn(),
  onClose: vi.fn(),
};

describe("DefenseReactionModal — sigilo até a escolha (issue #90)", () => {
  it("não revela rolagem nem dano antes da escolha", () => {
    render(<DefenseReactionModal {...baseProps} />);

    expect(screen.getByTestId("defense-hidden-values")).toBeInTheDocument();
    // Valores ocultos: dois "???" e nenhum número de ataque/dano exposto.
    expect(screen.getAllByText("???").length).toBe(2);
    expect(screen.queryByText("18")).not.toBeInTheDocument();
    expect(screen.queryByText("11")).not.toBeInTheDocument();
  });

  it("após escolher Esquivar, revela rolagem, dano e resultado; onRespond só no Concluir", () => {
    render(<DefenseReactionModal {...baseProps} />);

    fireEvent.click(screen.getByTestId("defense-choose-dodge"));

    expect(screen.getByTestId("defense-revealed-values")).toBeInTheDocument();
    expect(screen.getByTestId("defense-revealed-values")).toHaveTextContent("18");
    const takenDodge = Number(screen.getByTestId("defense-damage-taken").textContent);
    expect(Number.isFinite(takenDodge)).toBe(true);
    expect(baseProps.onRespond).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId("defense-confirm-result"));
    expect(baseProps.onRespond).toHaveBeenCalledWith("dodge", expect.any(String), takenDodge);
  });

  it("após escolher Bloquear, revela o dano reduzido", () => {
    render(<DefenseReactionModal {...baseProps} />);

    fireEvent.click(screen.getByTestId("defense-choose-block"));

    expect(screen.getByTestId("defense-revealed-values")).toBeInTheDocument();
    expect(screen.getByTestId("defense-revealed-values")).toHaveTextContent("11");
    const taken = Number(screen.getByTestId("defense-damage-taken").textContent);
    expect(taken).toBeGreaterThan(0);
    expect(taken).toBeLessThan(11);

    fireEvent.click(screen.getByTestId("defense-confirm-result"));
    expect(baseProps.onRespond).toHaveBeenCalledWith("block", expect.any(String), taken);
  });
});
