import { beforeEach, describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MotionSettingsPanel } from "@/components/motion/MotionSettingsPanel";
import { getMotionPreferences, resetMotionPreferences } from "@/lib/motion";

describe("MotionSettingsPanel", () => {
  beforeEach(() => {
    window.localStorage.clear();
    resetMotionPreferences();
  });

  it("liga e desliga todas as animações", () => {
    render(<MotionSettingsPanel />);
    expect(screen.getByTestId("motion-status")).toHaveTextContent("Ativas");
    fireEvent.click(screen.getByRole("switch", { name: "Animações e Efeitos" }));
    expect(getMotionPreferences().enabled).toBe(false);
    expect(screen.getByTestId("motion-status")).toHaveTextContent("Desligadas");
    expect(screen.getByRole("radio", { name: /Zoom/ })).toBeDisabled();
  });

  it("altera velocidade, estilo, curva e categorias", () => {
    render(<MotionSettingsPanel />);
    fireEvent.click(screen.getByRole("button", { name: "Rápida" }));
    expect(screen.getByTestId("motion-speed")).toHaveTextContent("1,5x");
    fireEvent.change(screen.getByLabelText("Velocidade das animações"), {
      target: { value: "0.75" },
    });
    expect(getMotionPreferences().speed).toBe(0.75);

    fireEvent.click(screen.getByRole("radio", { name: /Zoom/ }));
    fireEvent.click(screen.getByRole("radio", { name: "Elástica" }));
    fireEvent.click(screen.getByRole("radio", { name: "Intensa" }));
    fireEvent.click(screen.getByRole("switch", { name: "Efeitos contínuos" }));

    const prefs = getMotionPreferences();
    expect(prefs.preset).toBe("zoom");
    expect(prefs.easing).toBe("spring");
    expect(prefs.intensity).toBe("strong");
    expect(prefs.categories.ambient).toBe(false);

    fireEvent.click(screen.getByRole("button", { name: "Restaurar padrão" }));
    expect(getMotionPreferences().preset).toBe("slide-up");
    expect(getMotionPreferences().categories.ambient).toBe(true);
  });
});
