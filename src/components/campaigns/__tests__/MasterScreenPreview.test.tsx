import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { MasterScreenPreview } from "../MasterScreenPreview";

describe("MasterScreenPreview Component", () => {
  it("renders with all flags active", () => {
    render(
      <MasterScreenPreview
        showRoster={true}
        showSessionLog={true}
        showCanvas={true}
        showMap={true}
      />
    );

    const preview = screen.getByRole("img", {
      name: "Preview do layout do Escudo do Mestre",
    });
    expect(preview).toBeInTheDocument();

    expect(screen.getByText("Gestão")).toBeInTheDocument();
    expect(screen.getByText("Canvas/Mapa")).toBeInTheDocument();
    expect(screen.getByText("Roster")).toBeInTheDocument();
    expect(screen.getByText("Logs")).toBeInTheDocument();
    expect(screen.queryByText("Vazio")).not.toBeInTheDocument();
  });

  it("hiding logs removes the right column", () => {
    render(
      <MasterScreenPreview
        showRoster={true}
        showSessionLog={false}
        showCanvas={true}
        showMap={true}
      />
    );

    expect(screen.getByText("Gestão")).toBeInTheDocument();
    expect(screen.getByText("Canvas/Mapa")).toBeInTheDocument();
    expect(screen.getByText("Roster")).toBeInTheDocument();
    expect(screen.queryByText("Logs")).not.toBeInTheDocument();
  });

  it("hiding roster removes the roster area", () => {
    render(
      <MasterScreenPreview
        showRoster={false}
        showSessionLog={true}
        showCanvas={true}
        showMap={true}
      />
    );

    expect(screen.getByText("Gestão")).toBeInTheDocument();
    expect(screen.getByText("Canvas/Mapa")).toBeInTheDocument();
    expect(screen.queryByText("Roster")).not.toBeInTheDocument();
    expect(screen.getByText("Logs")).toBeInTheDocument();
  });

  it("hiding canvas and map displays empty state", () => {
    render(
      <MasterScreenPreview
        showRoster={true}
        showSessionLog={true}
        showCanvas={false}
        showMap={false}
      />
    );

    expect(screen.queryByText("Canvas/Mapa")).not.toBeInTheDocument();
    expect(screen.getByText("Vazio")).toBeInTheDocument();
    expect(screen.getByText("Gestão")).toBeInTheDocument();
    expect(screen.getByText("Roster")).toBeInTheDocument();
    expect(screen.getByText("Logs")).toBeInTheDocument();
  });

  it("displays canvas/map when only showCanvas is active", () => {
    render(
      <MasterScreenPreview
        showRoster={true}
        showSessionLog={true}
        showCanvas={true}
        showMap={false}
      />
    );

    expect(screen.getByText("Canvas/Mapa")).toBeInTheDocument();
    expect(screen.queryByText("Vazio")).not.toBeInTheDocument();
  });

  it("displays canvas/map when only showMap is active", () => {
    render(
      <MasterScreenPreview
        showRoster={true}
        showSessionLog={true}
        showCanvas={false}
        showMap={true}
      />
    );

    expect(screen.getByText("Canvas/Mapa")).toBeInTheDocument();
    expect(screen.queryByText("Vazio")).not.toBeInTheDocument();
  });

  it("applies CSS transitions to elements", () => {
    const { container } = render(
      <MasterScreenPreview
        showRoster={true}
        showSessionLog={true}
        showCanvas={true}
        showMap={true}
      />
    );

    const transitionElements = container.querySelectorAll(".transition-all.duration-300");
    expect(transitionElements.length).toBeGreaterThan(0);
  });
});
