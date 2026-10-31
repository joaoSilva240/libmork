import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MapEditor } from "../MapEditor";

// Mock do Leaflet
vi.mock("leaflet", () => {
  const Icon = {
    Default: {
      prototype: {},
      mergeOptions: vi.fn(),
    },
  };

  const mapInstance = {
    setView: vi.fn().mockReturnThis(),
    fitBounds: vi.fn(),
    remove: vi.fn(),
    on: vi.fn(),
    eachLayer: vi.fn(),
    removeLayer: vi.fn(),
    options: {},
  };

  const L = {
    map: vi.fn(() => mapInstance),
    tileLayer: vi.fn(() => ({ addTo: vi.fn() })),
    marker: vi.fn(() => ({
      addTo: vi.fn().mockReturnThis(),
      bindPopup: vi.fn().mockReturnThis(),
      openPopup: vi.fn().mockReturnThis(),
      on: vi.fn(),
    })),
    latLngBounds: vi.fn(() => ({})),
    Icon,
  };

  return {
    default: L,
    ...L,
  };
});

describe("MapEditor Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: [] }),
    } as Response);
  });

  it("renderiza o cabeçalho confidencial e a moldura de dossiê quando isMissing=true", async () => {
    const { container } = render(
      <MapEditor worldId="world-1" isMissing={true} />
    );

    await waitFor(() => {
      expect(
        screen.getByText("[ MAPA DE CAMPO // TOPOGRAFIA DE INVESTIGAÇÃO — CONFIDENCIAL ]")
      ).toBeInTheDocument();
    });

    expect(screen.getByText("Salvar Posições")).toBeInTheDocument();
    expect(screen.getByText(/Topografia de campo: arraste para escanear a área/)).toBeInTheDocument();

    const rootWrapper = container.firstChild as HTMLElement;
    expect(rootWrapper.className).toContain("border-2 border-zinc-700 bg-[#0d0e11]");
  });

  it("renderiza a interface padrão de mapa d20 quando isMissing=false", async () => {
    const { container } = render(
      <MapEditor worldId="world-1" isMissing={false} />
    );

    await waitFor(() => {
      expect(screen.getByText("Salvar Mapa")).toBeInTheDocument();
    });

    expect(
      screen.queryByText("[ MAPA DE CAMPO // TOPOGRAFIA DE INVESTIGAÇÃO — CONFIDENCIAL ]")
    ).not.toBeInTheDocument();

    const rootWrapper = container.firstChild as HTMLElement;
    expect(rootWrapper.className).toContain("bg-gray-950");
  });
});
