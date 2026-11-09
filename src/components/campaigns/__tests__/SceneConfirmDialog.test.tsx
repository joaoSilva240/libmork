import { fireEvent, render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { SceneConfirmDialog } from "../SceneConfirmDialog";

// Diálogo de confirmação trocável por cena (issue #86, Fase 2). Teste puro de
// render: as callbacks são injetadas e o harness não simula combate nem socket.

type DialogProps = {
  open: boolean;
  targetLabel: string;
  onCancel: () => void;
  onEndAndSwitch: () => void;
  onKeepAndSwitch: () => void;
};

function renderDialog(overrides: Partial<DialogProps> = {}) {
  const props: DialogProps = {
    open: true,
    targetLabel: "Interlúdio",
    onCancel: vi.fn(),
    onEndAndSwitch: vi.fn(),
    onKeepAndSwitch: vi.fn(),
    ...overrides,
  };
  const { container } = render(<SceneConfirmDialog {...props} />);
  return { ...props, container };
}

describe("SceneConfirmDialog (issue #86, Fase 2)", () => {
  it("aberto: exibe o título acessível e os 3 botões da spec", () => {
    renderDialog();

    expect(screen.getByRole("dialog", { name: "Combate em andamento" })).toBeInTheDocument();
    expect(screen.getByText("Há um combate em andamento")).toBeInTheDocument();
    expect(screen.getByTestId("scene-confirm-end")).toHaveTextContent("Encerrar e trocar");
    expect(screen.getByTestId("scene-confirm-keep")).toHaveTextContent("Manter em 2º plano");
    expect(screen.getByTestId("scene-confirm-cancel")).toHaveTextContent("Cancelar");
  });

  it("cada botão dispara exatamente o seu callback", () => {
    const { onCancel, onEndAndSwitch, onKeepAndSwitch } = renderDialog();

    fireEvent.click(screen.getByTestId("scene-confirm-keep"));
    expect(onKeepAndSwitch).toHaveBeenCalledTimes(1);
    expect(onEndAndSwitch).not.toHaveBeenCalled();
    expect(onCancel).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId("scene-confirm-end"));
    expect(onEndAndSwitch).toHaveBeenCalledTimes(1);
    expect(onKeepAndSwitch).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByTestId("scene-confirm-cancel"));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("exibe o label da cena alvo no corpo", () => {
    renderDialog({ targetLabel: "Interlúdio" });
    expect(screen.getByText("Interlúdio")).toBeInTheDocument();
    expect(screen.getByText(/Trocar para a cena/)).toBeInTheDocument();
  });

  it("fechado (!open): não renderiza nada", () => {
    const { container } = renderDialog({ open: false });
    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.queryByText("Há um combate em andamento")).toBeNull();
  });
});
