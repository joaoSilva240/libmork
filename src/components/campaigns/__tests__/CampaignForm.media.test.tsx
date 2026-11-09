import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { CampaignForm } from "../CampaignForm";

const mockPush = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

describe("CampaignForm — Mídia da Campanha por URL", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  it("preenche capa e mapa por URL e envia no payload da campanha", async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, data: { id: "camp-url-1" } }),
    });

    render(<CampaignForm />);

    fireEvent.change(screen.getByPlaceholderText(/As Crônicas de Morkvold/i), {
      target: { value: "Campanha com Mídia Externa" },
    });

    fireEvent.change(screen.getByLabelText("URL da imagem de capa"), {
      target: { value: "https://cdn.example.com/capa.jpg" },
    });
    fireEvent.change(screen.getByLabelText("URL da imagem do mapa mundi"), {
      target: { value: "https://cdn.example.com/mapa.jpg" },
    });

    fireEvent.click(screen.getByRole("button", { name: /Concluir e Criar Campanha/i }));

    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1));

    const [, options] = (global.fetch as any).mock.calls[0];
    const payload = JSON.parse(options.body);
    expect(payload.coverImageUrl).toBe("https://cdn.example.com/capa.jpg");
    expect(payload.worldMapUrl).toBe("https://cdn.example.com/mapa.jpg");
    expect(mockPush).toHaveBeenCalledWith("/master/campaigns/camp-url-1");
  });
});