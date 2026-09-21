import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { BottomNav, type BottomNavTab } from "../BottomNav";

describe("BottomNav", () => {
  const tabs: BottomNavTab[] = [
    { id: "characters", label: "Meus Personagens", icon: <span data-testid="icon-char">icon1</span> },
    { id: "campaigns", label: "Campanhas", icon: <span data-testid="icon-camp">icon2</span> },
  ];

  it("renders nav touching bottom 0 across viewport with centered inner container", () => {
    const { container } = render(
      <BottomNav tabs={tabs} activeId="characters" onChange={vi.fn()} />
    );

    const nav = container.querySelector("nav");
    expect(nav).toBeDefined();
    expect(nav).toHaveAttribute("aria-label", "Navegação principal");
    
    // Navigation fixed at bottom, spanning full width with background
    expect(nav?.className).toContain("fixed");
    expect(nav?.className).toContain("bottom-0");
    expect(nav?.className).toContain("inset-x-0");
    expect(nav?.className).toContain("bg-gray-900/95");

    // Inner container preserves max width, centering, and compact padding
    const innerContainer = nav?.firstElementChild;
    expect(innerContainer?.className).toContain("mx-auto");
    expect(innerContainer?.className).toContain("w-full");
    expect(innerContainer?.className).toContain("max-w-md");
    expect(innerContainer?.className).toContain("py-1");
    expect(innerContainer?.className).toContain("border-t");
  });

  it("triggers onChange when a tab is clicked", () => {
    const onChange = vi.fn();
    render(<BottomNav tabs={tabs} activeId="characters" onChange={onChange} />);

    const campaignsTab = screen.getByRole("button", { name: "Campanhas" });
    fireEvent.click(campaignsTab);

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith("campaigns");
  });

  it("marks the active tab with aria-current='page'", () => {
    render(<BottomNav tabs={tabs} activeId="characters" onChange={vi.fn()} />);

    const activeTab = screen.getByRole("button", { name: "Meus Personagens" });
    expect(activeTab).toHaveAttribute("aria-current", "page");

    const inactiveTab = screen.getByRole("button", { name: "Campanhas" });
    expect(inactiveTab).not.toHaveAttribute("aria-current");
  });
});
