import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { CreatePollModal } from "../CreatePollModal";

describe("CreatePollModal (Issue #62)", () => {
  it("renderiza campos de pergunta, opções e toggle de múltipla escolha", () => {
    render(<CreatePollModal isOpen={true} onClose={vi.fn()} onSubmit={vi.fn()} />);

    expect(screen.getByText("Nova Enquete da Campanha")).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Qual dia vocês preferem/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Opção 1")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Opção 2")).toBeInTheDocument();
    expect(
      screen.getByText(/Permitir que jogadores escolham múltiplas opções/i),
    ).toBeInTheDocument();
  });

  it("permite adicionar mais opções até o limite", () => {
    render(<CreatePollModal isOpen={true} onClose={vi.fn()} onSubmit={vi.fn()} />);

    const addBtn = screen.getByText("Adicionar mais uma opção");
    fireEvent.click(addBtn);

    expect(screen.getByPlaceholderText("Opção 3")).toBeInTheDocument();
  });

  it("chama onSubmit com os dados preenchidos corretamente", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<CreatePollModal isOpen={true} onClose={vi.fn()} onSubmit={onSubmit} />);

    const titleInput = screen.getByPlaceholderText(/Qual dia vocês preferem/i);
    const opt1Input = screen.getByPlaceholderText("Opção 1");
    const opt2Input = screen.getByPlaceholderText("Opção 2");
    const multiCheckbox = screen.getByRole("checkbox");

    fireEvent.change(titleInput, { target: { value: "Melhor horário?" } });
    fireEvent.change(opt1Input, { target: { value: "Manhã" } });
    fireEvent.change(opt2Input, { target: { value: "Noite" } });
    fireEvent.click(multiCheckbox);

    const submitBtn = screen.getByText("Criar Enquete");
    fireEvent.click(submitBtn);

    expect(onSubmit).toHaveBeenCalledWith({
      title: "Melhor horário?",
      options: ["Manhã", "Noite"],
      isMultipleChoice: true,
    });
  });
});
