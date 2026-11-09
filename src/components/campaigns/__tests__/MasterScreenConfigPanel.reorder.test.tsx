import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { MasterScreenConfigPanel } from "../MasterScreenConfigPanel";
import { DEFAULT_MASTER_SCREEN_CONFIG } from "@/hooks/useMasterScreenConfig";

describe("MasterScreenConfigPanel - Reordering & Assets Visibility (Issue #75)", () => {
  it("renders Assets & Handouts visibility checkbox and calls onUpdate when clicked", () => {
    const handleUpdate = vi.fn();
    render(
      <MasterScreenConfigPanel
        config={DEFAULT_MASTER_SCREEN_CONFIG}
        onUpdate={handleUpdate}
        onReset={vi.fn()}
      />,
    );

    const assetsCheckbox = screen.getByLabelText(/Assets e Handouts/i);
    expect(assetsCheckbox).toBeInTheDocument();
    expect((assetsCheckbox as HTMLInputElement).checked).toBe(true);

    fireEvent.click(assetsCheckbox);
    expect(handleUpdate).toHaveBeenCalledWith({ showAssets: false });
  });

  it("renders both left and right columns with Lucide-styled module cards", () => {
    render(
      <MasterScreenConfigPanel
        config={DEFAULT_MASTER_SCREEN_CONFIG}
        onUpdate={vi.fn()}
        onReset={vi.fn()}
      />,
    );

    expect(screen.getByText("Coluna Esquerda (Gestão)")).toBeInTheDocument();
    expect(screen.getByText("Coluna Direita (Logs)")).toBeInTheDocument();

    expect(screen.getByTestId("module-card-mediaPanel")).toBeInTheDocument();
    expect(screen.getByTestId("module-card-actorsPanel")).toBeInTheDocument();
    expect(screen.getByTestId("module-card-sessionLog")).toBeInTheDocument();
  });

  it("moves consolidated block to opposite column when switch-column button is clicked", () => {
    const handleUpdate = vi.fn();
    render(
      <MasterScreenConfigPanel
        config={DEFAULT_MASTER_SCREEN_CONFIG}
        onUpdate={handleUpdate}
        onReset={vi.fn()}
      />,
    );

    const moveMediaBtn = screen.getByTestId("btn-move-col-mediaPanel");
    fireEvent.click(moveMediaBtn);

    expect(handleUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        leftColumnOrder: expect.not.arrayContaining(["mediaPanel"]),
        rightColumnOrder: expect.arrayContaining(["mediaPanel"]),
      }),
    );
  });

  it("reorders consolidated block within column when arrow buttons are clicked", () => {
    const handleUpdate = vi.fn();
    render(
      <MasterScreenConfigPanel
        config={DEFAULT_MASTER_SCREEN_CONFIG}
        onUpdate={handleUpdate}
        onReset={vi.fn()}
      />,
    );

    const moveDownMediaBtn = screen.getByTestId("btn-move-down-mediaPanel");
    fireEvent.click(moveDownMediaBtn);

    expect(handleUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        leftColumnOrder: ["actorsPanel", "mediaPanel"],
      }),
    );
  });

  it("handles native drag-and-drop between columns", () => {
    const handleUpdate = vi.fn();
    render(
      <MasterScreenConfigPanel
        config={DEFAULT_MASTER_SCREEN_CONFIG}
        onUpdate={handleUpdate}
        onReset={vi.fn()}
      />,
    );

    const mediaCard = screen.getByTestId("module-card-mediaPanel");
    const rightColDropZone = screen.getByTestId("dropzone-right");

    fireEvent.dragStart(mediaCard);
    fireEvent.dragOver(rightColDropZone);
    fireEvent.drop(rightColDropZone);

    expect(handleUpdate).toHaveBeenCalled();
  });
});
