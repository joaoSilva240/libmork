import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import { TomeViewer, TOME_DEFAULT_URL } from "../TomeViewer";

describe("TomeViewer", () => {
  it("renders desktop viewer by default with 100% width, full height and natural interaction (no clipping wrapper)", () => {
    render(<TomeViewer />);

    const container = screen.getByTestId("tome-inline-viewer");
    expect(container).toBeInTheDocument();
    expect(container).not.toHaveClass("scrollbar-hide");

    // Desktop mode should not have the artificial mobile clip wrapper
    expect(screen.queryByTestId("tome-clip-wrapper")).not.toBeInTheDocument();

    const iframe = screen.getByTitle("Visualizador Tome");
    expect(iframe).toBeInTheDocument();
    expect(iframe).toHaveAttribute("src", TOME_DEFAULT_URL);
    expect(iframe).not.toHaveAttribute("scrolling");
    expect(iframe).toHaveClass("w-full", "h-full", "pointer-events-auto");
    expect(iframe).toHaveStyle({
      width: "100%",
      height: "100%",
    });
  });

  it("renders mobile viewer when viewport='mobile' with clip wrapper and cross-origin scrollbar-hide configuration", () => {
    render(<TomeViewer viewport="mobile" />);

    const container = screen.getByTestId("tome-inline-viewer");
    expect(container).toBeInTheDocument();
    expect(container).toHaveClass("scrollbar-hide");
    expect(container).not.toHaveClass("overflow-hidden");
    expect(container).toHaveClass("touch-auto");

    const clipWrapper = screen.getByTestId("tome-clip-wrapper");
    expect(clipWrapper).toBeInTheDocument();
    expect(clipWrapper).toHaveClass("overflow-hidden");
    expect(clipWrapper).toHaveStyle({
      width: "min(390px, 100%)",
    });

    const iframe = screen.getByTitle("Visualizador Tome");
    expect(iframe).toBeInTheDocument();
    expect(iframe).toHaveAttribute("src", TOME_DEFAULT_URL);
    expect(iframe).toHaveAttribute("scrolling", "no");
    expect(iframe).toHaveClass("scrollbar-hide");
    expect(iframe).toHaveClass("touch-auto");
    expect(iframe).toHaveClass("pointer-events-auto");
    expect(iframe).toHaveStyle({
      width: "calc(100% + 20px)",
      height: "100%",
      scrollbarWidth: "none",
    });
  });

  it("accepts custom url and className in desktop mode", () => {
    render(
      <TomeViewer
        url="http://example.com/tome"
        className="custom-class"
      />
    );

    const container = screen.getByTestId("tome-inline-viewer");
    expect(container).toHaveClass("custom-class");

    const iframe = screen.getByTitle("Visualizador Tome");
    expect(iframe).toHaveAttribute("src", "http://example.com/tome");
  });
});


