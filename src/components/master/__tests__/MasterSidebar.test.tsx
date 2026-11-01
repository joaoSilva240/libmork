import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { MasterSidebar } from "../MasterSidebar";

const mockUsePathname = vi.fn();

vi.mock("next/navigation", () => ({
  usePathname: () => mockUsePathname(),
}));

describe("MasterSidebar Component", () => {
  it("renders navigation items including 'Configurações' with active state", () => {
    mockUsePathname.mockReturnValue("/master/settings");

    render(<MasterSidebar />);

    expect(screen.getByText("Campanhas")).toBeInTheDocument();
    expect(screen.getByText("Biblioteca")).toBeInTheDocument();
    expect(screen.getByText("Comunidade")).toBeInTheDocument();
    expect(screen.getByText("Configurações")).toBeInTheDocument();

    const settingsLink = screen.getByRole("link", { name: /configurações/i });
    expect(settingsLink).toHaveAttribute("href", "/master/settings");
    expect(settingsLink).toHaveClass("bg-gray-800", "text-white");
  });

  it("renders 'Comunidade' link with correct href", () => {
    mockUsePathname.mockReturnValue("/master/community");

    render(<MasterSidebar />);

    const communityLink = screen.getByRole("link", { name: /comunidade/i });
    expect(communityLink).toHaveAttribute("href", "/master/community");
    expect(communityLink).toHaveClass("bg-gray-800", "text-white");
  });
});
