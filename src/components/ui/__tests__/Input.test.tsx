import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Input } from "../Input";

describe("Input Component", () => {
  it("associates label with input using htmlFor and id automatically", () => {
    render(<Input label="Nome do Personagem" placeholder="Digite o nome" />);

    const input = screen.getByLabelText("Nome do Personagem");
    expect(input).toBeInTheDocument();
    expect(input).toHaveAttribute("id");

    const label = screen.getByText("Nome do Personagem");
    expect(label).toHaveAttribute("for", input.getAttribute("id"));
  });

  it("respects custom id prop when passed", () => {
    render(<Input id="custom-input-id" label="Email" />);

    const input = screen.getByLabelText("Email");
    expect(input).toHaveAttribute("id", "custom-input-id");
    expect(screen.getByText("Email")).toHaveAttribute("for", "custom-input-id");
  });

  it("renders required indicator when required prop is true", () => {
    render(<Input label="Senha" required />);

    const input = screen.getByLabelText(/Senha/);
    expect(input).toBeRequired();

    const asterisk = screen.getByText("*");
    expect(asterisk).toBeInTheDocument();
    expect(asterisk).toHaveAttribute("aria-hidden", "true");
  });

  it("associates error message with aria-describedby, aria-invalid and role='alert'", () => {
    render(
      <Input
        label="Pontos de Vida"
        error="Valor inválido para Pontos de Vida"
        aria-describedby="hp-helper-text"
      />,
    );

    const input = screen.getByLabelText("Pontos de Vida");
    expect(input).toHaveAttribute("aria-invalid", "true");

    const errorAlert = screen.getByRole("alert");
    expect(errorAlert).toHaveTextContent("Valor inválido para Pontos de Vida");
    expect(input.getAttribute("aria-describedby")).toContain(errorAlert.id);
    expect(input.getAttribute("aria-describedby")).toContain("hp-helper-text");
  });

  it("does not set aria-invalid when there is no error", () => {
    render(<Input label="Bio" />);

    const input = screen.getByLabelText("Bio");
    expect(input).not.toHaveAttribute("aria-invalid");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
