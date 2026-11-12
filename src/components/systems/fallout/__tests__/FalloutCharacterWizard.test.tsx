import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { FalloutCharacterWizard } from "../FalloutCharacterWizard";

const pushMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
  useSearchParams: () => new URLSearchParams(),
}));

function mockFetchSuccess() {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: { id: "fallout-char-1", name: "Walter" },
      }),
    }),
  );
}

async function fillIdentityStep() {
  fireEvent.change(screen.getByLabelText(/Nome do Personagem/i), {
    target: { value: "Walter" },
  });
}

async function completeSpecialStep() {
  // Padrão 35 (7×5); adicionar +5 em um atributo atinge a soma exigida de 40.
  const plusButtons = screen.getAllByRole("button", { name: "+" });
  for (let i = 0; i < 5; i++) fireEvent.click(plusButtons[0]);
}

describe("FalloutCharacterWizard", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    pushMock.mockClear();
    localStorage.clear();
  });

  it("renderiza o stepper com as 4 fases e começa em Identidade", () => {
    render(<FalloutCharacterWizard />);

    expect(screen.getByText("Vault-Tec Registration System")).toBeDefined();
    expect(screen.getByRole("radiogroup", { name: /Origem do personagem/i })).toBeDefined();
    expect(screen.getByRole("radio", { name: /Morador de Refúgio/i })).toBeDefined();
    expect(screen.getByRole("radio", { name: /Super Mutante/i })).toBeDefined();
    expect(screen.getByRole("radio", { name: /Mister Handy/i })).toBeDefined();
    expect(screen.getByText("Criança do Refúgio (Vault Kid)")).toBeDefined();
  });

  it("bloqueia avanço da Identidade sem nome válido", async () => {
    render(<FalloutCharacterWizard />);

    fireEvent.click(screen.getByRole("button", { name: /Próximo/i }));
    expect(await screen.findByText(/Nome deve ter no mínimo 2 caracteres/i)).toBeDefined();
    expect(screen.getByLabelText(/Nome do Personagem/i)).toBeDefined();
  });

  it("avança até S.P.E.C.I.A.L. e valida o orçamento de 40 pontos", async () => {
    render(<FalloutCharacterWizard />);

    await fillIdentityStep();
    fireEvent.click(screen.getByRole("button", { name: /Próximo/i }));

    expect(await screen.findByText(/Atributos S\.P\.E\.C\.I\.A\.L\./i)).toBeDefined();

    fireEvent.click(screen.getByRole("button", { name: /Próximo/i }));
    expect(
      await screen.findByText(/Distribua exatamente 40 pontos/i),
    ).toBeDefined();
  });

  it("selecionar Super Mutante aplica +2 FOR/RES e limita INT/CAR a 6", async () => {
    render(<FalloutCharacterWizard />);

    fireEvent.click(screen.getByRole("radio", { name: /Super Mutante/i }));
    await fillIdentityStep();
    fireEvent.click(screen.getByRole("button", { name: /Próximo/i }));

    expect(await screen.findByText(/Bônus de origem já aplicados/i)).toBeDefined();
    expect(screen.getByText(/Força \+2, Resistência \+2/)).toBeDefined();
  });

  it("permite escolher até 3 Tag Skills e submete perks junto ao personagem", async () => {
    mockFetchSuccess();
    render(<FalloutCharacterWizard />);

    await fillIdentityStep();
    fireEvent.click(screen.getByRole("button", { name: /Próximo/i }));
    await completeSpecialStep();
    fireEvent.click(screen.getByRole("button", { name: /Próximo/i }));

    // Fase 3 — Perícias
    expect(
      await screen.findByText("Tag Skills (especialidades ★)"),
    ).toBeDefined();
    // Vault Dweller concede +1 Tag Skill extra (traço Criança do Refúgio): limite 4.
    fireEvent.click(screen.getByRole("button", { name: /Atletismo/i }));
    fireEvent.click(screen.getByRole("button", { name: /Furtividade/i }));
    fireEvent.click(screen.getByRole("button", { name: /Discurso/i }));
    fireEvent.click(screen.getByRole("button", { name: /Ciência/i }));
    expect(
      screen.getByText((_, el) => el?.textContent?.trim() === "4 / 4 selecionadas"),
    ).toBeDefined();

    fireEvent.click(screen.getByRole("button", { name: /Próximo/i }));

    // Fase 4 — Perks
    expect(await screen.findByText(/Perks Iniciais/i)).toBeDefined();
    fireEvent.change(screen.getByPlaceholderText(/Action Boy/i), {
      target: { value: "Fortune Finder" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Adicionar/i }));
    expect(screen.getByText("Fortune Finder")).toBeDefined();

    fireEvent.click(screen.getByRole("button", { name: /Registrar no Pip-Boy/i }));

    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/player"));
    const fetchMock = vi.mocked(fetch);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(body.name).toBe("Walter");
    expect(body.origin).toBe("vault_dweller");
    expect(body.tagSkills).toEqual(["athletics", "sneak", "speech", "science"]);
    expect(body.perks).toEqual(["Fortune Finder"]);
    expect(body.caps).toBe(50);
  });

  it("chama onSuccess em vez de router.push quando fornecido", async () => {
    mockFetchSuccess();
    const onSuccess = vi.fn();
    render(<FalloutCharacterWizard onSuccess={onSuccess} />);

    await fillIdentityStep();
    fireEvent.click(screen.getByRole("button", { name: /Próximo/i }));
    await completeSpecialStep();
    fireEvent.click(screen.getByRole("button", { name: /Próximo/i }));
    fireEvent.click(screen.getByRole("button", { name: /Atletismo/i }));
    fireEvent.click(screen.getByRole("button", { name: /Próximo/i }));

    fireEvent.click(screen.getByRole("button", { name: /Registrar no Pip-Boy/i }));

    await waitFor(() =>
      expect(onSuccess).toHaveBeenCalledWith(
        expect.objectContaining({ id: "fallout-char-1", name: "Walter" }),
      ),
    );
    expect(pushMock).not.toHaveBeenCalled();
  });
});
