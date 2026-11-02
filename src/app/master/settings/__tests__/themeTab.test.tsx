import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, beforeEach } from "vitest";
import MasterSettingsPage from "../page";
import { ThemeProvider } from "@/context/ThemeContext";

describe("MasterSettingsPage Tabs & Theme Control", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute("data-theme");
  });

  const renderComponent = () => {
    return render(
      <ThemeProvider>
        <MasterSettingsPage />
      </ThemeProvider>,
    );
  };

  it("renders tab navigation with 'Tema e Aparência' and 'Tela do Mestre & Módulos'", () => {
    renderComponent();

    const themeTab = screen.getByRole("tab", { name: /Tema e Aparência/i });
    const screenTab = screen.getByRole("tab", { name: /Tela do Mestre & Módulos/i });

    expect(themeTab).toBeInTheDocument();
    expect(screenTab).toBeInTheDocument();
    expect(themeTab).toHaveAttribute("aria-selected", "true");
    expect(screenTab).toHaveAttribute("aria-selected", "false");
  });

  it("switches to 'Tela do Mestre & Módulos' tab when clicked", () => {
    renderComponent();

    const screenTab = screen.getByRole("tab", { name: /Tela do Mestre & Módulos/i });
    fireEvent.click(screenTab);

    expect(screenTab).toHaveAttribute("aria-selected", "true");
    const themeTab = screen.getByRole("tab", { name: /Tema e Aparência/i });
    expect(themeTab).toHaveAttribute("aria-selected", "false");
  });
});
