import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, beforeEach } from "vitest";
import MasterSettingsPage from "../page";
import { masterScreenConfigKey } from "@/hooks/useMasterScreenConfig";

describe("MasterSettingsPage (/master/settings)", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("renders page header and MasterScreenConfigPanel directly without campaign selector", () => {
    render(<MasterSettingsPage />);

    expect(screen.getByText("Configurações do Mestre")).toBeInTheDocument();
    expect(screen.getByText("Preferências de Visibilidade")).toBeInTheDocument();
    expect(screen.getByText("Visibilidade do Escudo")).toBeInTheDocument();
    expect(screen.getByText("Carrossel de Personagens")).toBeInTheDocument();
    expect(screen.getByText("Log da Sessão")).toBeInTheDocument();
    expect(screen.getByText("Canvas Infinito")).toBeInTheDocument();
    expect(screen.getByText("Mapa Tático")).toBeInTheDocument();
    expect(screen.queryByLabelText("Selecione uma campanha")).not.toBeInTheDocument();
  });

  it("renders the preview component with default configuration", () => {
    render(<MasterSettingsPage />);

    expect(screen.getByText("Preview do Layout")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Preview do layout do Escudo do Mestre" })).toBeInTheDocument();
    expect(screen.getByText("Gestão")).toBeInTheDocument();
    expect(screen.getByText("Canvas/Mapa")).toBeInTheDocument();
    expect(screen.getByText("Roster")).toBeInTheDocument();
    expect(screen.getByText("Logs")).toBeInTheDocument();
  });

  it("persists toggles globally to localStorage", () => {
    render(<MasterSettingsPage />);

    const canvasToggle = screen.getByLabelText("Canvas Infinito") as HTMLInputElement;
    expect(canvasToggle.checked).toBe(true);

    fireEvent.click(canvasToggle);
    expect(canvasToggle.checked).toBe(false);

    const saved = JSON.parse(localStorage.getItem(masterScreenConfigKey) || "{}");
    expect(saved.showCanvas).toBe(false);
  });

  it("restores default settings on reset button click", () => {
    render(<MasterSettingsPage />);

    const rosterToggle = screen.getByLabelText("Carrossel de Personagens") as HTMLInputElement;
    fireEvent.click(rosterToggle);
    expect(rosterToggle.checked).toBe(false);

    fireEvent.click(screen.getByRole("button", { name: "Restaurar Padrão" }));
    expect(rosterToggle.checked).toBe(true);

    const saved = JSON.parse(localStorage.getItem(masterScreenConfigKey) || "{}");
    expect(saved.showRoster).toBe(true);
  });

  it("updates preview immediately when toggles are clicked without reload", () => {
    render(<MasterSettingsPage />);

    expect(screen.getByText("Logs")).toBeInTheDocument();
    expect(screen.getByText("Roster")).toBeInTheDocument();
    expect(screen.getByText("Canvas/Mapa")).toBeInTheDocument();

    // Toggle logs off
    const logsToggle = screen.getByLabelText("Log da Sessão") as HTMLInputElement;
    fireEvent.click(logsToggle);
    expect(screen.queryByText("Logs")).not.toBeInTheDocument();

    // Toggle roster off
    const rosterToggle = screen.getByLabelText("Carrossel de Personagens") as HTMLInputElement;
    fireEvent.click(rosterToggle);
    expect(screen.queryByText("Roster")).not.toBeInTheDocument();

    // Toggle canvas and map off
    const canvasToggle = screen.getByLabelText("Canvas Infinito") as HTMLInputElement;
    const mapToggle = screen.getByLabelText("Mapa Tático") as HTMLInputElement;
    fireEvent.click(canvasToggle);
    fireEvent.click(mapToggle);
    expect(screen.queryByText("Canvas/Mapa")).not.toBeInTheDocument();
    expect(screen.getByText("Vazio")).toBeInTheDocument();
  });

  it("configures AI API key and endpoint for library translation and persists to localStorage", () => {
    render(<MasterSettingsPage />);

    // Alterna para a aba de Tela do Mestre & Módulos
    fireEvent.click(screen.getByRole("tab", { name: /Tela do Mestre & Módulos/i }));

    expect(screen.getByText("Inteligência Artificial & Tradução da Biblioteca")).toBeInTheDocument();

    const endpointInput = screen.getByPlaceholderText(/https:\/\/api\.openai\.com\/v1/i);
    const apiKeyInput = screen.getByPlaceholderText(/sk-\.\.\. ou sua chave de acesso/i);

    fireEvent.change(endpointInput, { target: { value: "https://api.openai.com/v1" } });
    fireEvent.change(apiKeyInput, { target: { value: "sk-test-secret-key-12345" } });

    const saved = JSON.parse(localStorage.getItem(masterScreenConfigKey) || "{}");
    expect(saved.aiApiEndpoint).toBe("https://api.openai.com/v1");
    expect(saved.aiApiKey).toBe("sk-test-secret-key-12345");
  });
});
