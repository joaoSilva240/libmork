import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { PipBoyTabNav, type PipBoyTab } from "../PipBoyTabNav";

describe("PipBoyTabNav", () => {
  const tabs: PipBoyTab[] = [
    { id: "stat", label: "STAT", icon: <span data-testid="icon-stat">s</span> },
    { id: "special", label: "S.P.E.C.I.A.L.", icon: <span data-testid="icon-special">p</span> },
    { id: "inv", label: "INV", icon: <span data-testid="icon-inv">i</span> },
    { id: "data", label: "DATA", icon: <span data-testid="icon-data">d</span> },
  ];

  it("renderiza um dock flutuante no padrão BottomNav com tema Pip-Boy", () => {
    const { container } = render(
      <PipBoyTabNav tabs={tabs} activeId="stat" onChange={vi.fn()} />,
    );

    const nav = container.querySelector("nav");
    expect(nav).toHaveAttribute("aria-label", "Navegação do Pip-Boy");
    expect(nav).toHaveAttribute("role", "tablist");
    expect(nav?.className).toContain("fixed");
    expect(nav?.className).toContain("bottom-0");
    expect(nav?.className).toContain("inset-x-0");
    expect(nav?.className).toContain("pointer-events-none");

    const dock = nav?.querySelector(".pipboy-glass-dock");
    expect(dock).toBeDefined();
    expect(dock?.className).toContain("rounded-full");
    expect(dock?.className).toContain("pointer-events-auto");
  });

  it("expõe as abas com role=tab e aria-selected, mantendo compatibilidade de acessibilidade", () => {
    render(<PipBoyTabNav tabs={tabs} activeId="stat" onChange={vi.fn()} />);

    const active = screen.getByRole("tab", { name: "STAT" });
    expect(active).toHaveAttribute("aria-selected", "true");
    expect(active.querySelector(".pipboy-glass-pill")).not.toBeNull();
    expect(active.className).toContain("pipboy-glass-tab-active");

    const inactive = screen.getByRole("tab", { name: "INV" });
    expect(inactive).toHaveAttribute("aria-selected", "false");
    expect(inactive.querySelector(".pipboy-glass-pill")).toBeNull();
    expect(inactive.className).toContain("pipboy-glass-tab-inactive");
  });

  it("exibe apenas ícones (sem rótulos de texto), mantém aria-label e dispara onChange", () => {
    const onChange = vi.fn();
    render(<PipBoyTabNav tabs={tabs} activeId="stat" onChange={onChange} />);

    // Rótulos não aparecem mais como texto visível
    expect(screen.queryByText("S.P.E.C.I.A.L.")).not.toBeInTheDocument();
    expect(screen.queryByText("DATA")).not.toBeInTheDocument();

    // Ícones presentes e abas ainda acessíveis via aria-label
    expect(screen.getByTestId("icon-data")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "DATA" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "DATA" }));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith("data");
  });
});