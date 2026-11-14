import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { PipBoyPaperdoll } from "../PipBoyPaperdoll";
import type { FalloutBodyLocation, FalloutBodyPart } from "@/lib/systems/fallout/types";
import { FALLOUT_BODY_LOCATIONS } from "@/lib/systems/fallout/types";

function buildBodyParts(): Record<FalloutBodyLocation, FalloutBodyPart> {
  const parts = {} as any;
  for (const loc of FALLOUT_BODY_LOCATIONS) {
    parts[loc] = {
      location: loc, label: loc, minRoll: 1, maxRoll: 20,
      injuries: [0, 0, 0], status: "healthy",
      resistances: { physical: 0, energy: 0, radiation: 0, poison: 0 },
    };
  }
  return parts;
}

describe("PipBoyPaperdoll — injury slots", () => {
  it("cicla slot 0→2 ao clicar", () => {
    const onUpdate = vi.fn();
    const parts = buildBodyParts();
    render(<PipBoyPaperdoll bodyParts={parts} onUpdateBodyPart={onUpdate} />);
    const dot = screen.getByLabelText(/Injúria torso slot 1/);
    fireEvent.click(dot);
    expect(onUpdate).toHaveBeenCalledWith("torso", expect.objectContaining({ injuries: [2, 0, 0] }));
  });

  it("segundo click cicla 2→1", () => {
    const onUpdate = vi.fn();
    const parts = buildBodyParts();
    parts.torso.injuries = [2, 0, 0];
    parts.torso.status = "crippled";
    render(<PipBoyPaperdoll bodyParts={parts} onUpdateBodyPart={onUpdate} />);
    const dot = screen.getByLabelText(/Injúria torso slot 1/);
    fireEvent.click(dot);
    expect(onUpdate).toHaveBeenCalledWith("torso", expect.objectContaining({ injuries: [1, 0, 0] }));
  });

  it("terceiro click cicla 1→0", () => {
    const onUpdate = vi.fn();
    const parts = buildBodyParts();
    parts.torso.injuries = [1, 0, 0];
    parts.torso.status = "wounded";
    render(<PipBoyPaperdoll bodyParts={parts} onUpdateBodyPart={onUpdate} />);
    const dot = screen.getByLabelText(/Injúria torso slot 1/);
    fireEvent.click(dot);
    expect(onUpdate).toHaveBeenCalledWith("torso", expect.objectContaining({ injuries: [0, 0, 0] }));
  });

  it("readOnly nao renderiza dots clicaveis", () => {
    const parts = buildBodyParts();
    render(<PipBoyPaperdoll bodyParts={parts} readOnly />);
    const dots = screen.queryAllByRole("button", { name: /Injúria/ });
    expect(dots).toHaveLength(0);
  });

  it("exibe status badge por parte", () => {
    const parts = buildBodyParts();
    parts.head.injuries = [2, 0, 0];
    parts.head.status = "crippled";
    render(<PipBoyPaperdoll bodyParts={parts} />);
    expect(screen.getByText("Aleijado")).toBeTruthy();
  });
});
