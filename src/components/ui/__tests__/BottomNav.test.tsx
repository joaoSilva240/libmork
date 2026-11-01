import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { BottomNav, type BottomNavTab } from "../BottomNav";

describe("BottomNav", () => {
  const tabs: BottomNavTab[] = [
    { id: "characters", label: "Meus Personagens", icon: <span data-testid="icon-char">icon1</span> },
    { id: "campaigns", label: "Campanhas", icon: <span data-testid="icon-camp">icon2</span> },
  ];

  it("renders a centered floating liquid glass dock", () => {
    const { container } = render(
      <BottomNav tabs={tabs} activeId="characters" onChange={vi.fn()} />
    );

    const nav = container.querySelector("nav");
    expect(nav).toBeDefined();
    expect(nav).toHaveAttribute("aria-label", "Navegação principal");
    
    // Navigation is fixed at bottom, full width but non-blocking
    expect(nav?.className).toContain("fixed");
    expect(nav?.className).toContain("bottom-0");
    expect(nav?.className).toContain("inset-x-0");
    expect(nav?.className).toContain("pointer-events-none");

    // Inner dock is centered with liquid glass styling
    const dock = nav?.querySelector(".liquid-glass-dock");
    expect(dock).toBeDefined();
    expect(dock?.className).toContain("rounded-full");
    expect(dock?.className).toContain("pointer-events-auto");
  });

  it("triggers onChange when a tab is clicked", () => {
    const onChange = vi.fn();
    render(<BottomNav tabs={tabs} activeId="characters" onChange={onChange} />);

    const campaignsTab = screen.getByRole("button", { name: "Campanhas" });
    fireEvent.click(campaignsTab);

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith("campaigns");
  });

  it("marks the active tab with aria-current='page' and renders the active pill only on it", () => {
    render(<BottomNav tabs={tabs} activeId="characters" onChange={vi.fn()} />);

    const activeTab = screen.getByRole("button", { name: "Meus Personagens" });
    expect(activeTab).toHaveAttribute("aria-current", "page");
    expect(activeTab.querySelector(".liquid-glass-pill")).not.toBeNull();

    const inactiveTab = screen.getByRole("button", { name: "Campanhas" });
    expect(inactiveTab).not.toHaveAttribute("aria-current");
    expect(inactiveTab.querySelector(".liquid-glass-pill")).toBeNull();
  });

  it("renders buttons accessible by name but does not render visual text labels in the DOM", () => {
    const { container } = render(
      <BottomNav tabs={tabs} activeId="characters" onChange={vi.fn()} />
    );

    // Buttons remain discoverable by screen readers through their accessible name (aria-label)
    expect(screen.getByRole("button", { name: "Meus Personagens" })).toBeDefined();
    expect(screen.getByRole("button", { name: "Campanhas" })).toBeDefined();

    // Visual text elements/labels should not be rendered in the DOM
    expect(screen.queryByText("Meus Personagens")).toBeNull();
    expect(screen.queryByText("Campanhas")).toBeNull();

    // Verify icons are present
    expect(container.querySelector("[data-testid='icon-char']")).toBeDefined();
    expect(container.querySelector("[data-testid='icon-camp']")).toBeDefined();
  });
});
