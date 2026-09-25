import { render, screen, act } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { WindowPortal } from "../WindowPortal";

describe("WindowPortal", () => {
  let externalDocument: Document;
  let externalWindow: Window & { closed: boolean };

  beforeEach(() => {
    externalDocument = document.implementation.createHTMLDocument("external");
    externalWindow = {
      document: externalDocument,
      closed: false,
      close: vi.fn(() => { externalWindow.closed = true; }),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    } as unknown as Window & { closed: boolean };
    vi.spyOn(window, "open").mockReturnValue(externalWindow);
  });

  afterEach(() => vi.restoreAllMocks());

  it("renders children in the external portal node", async () => {
    render(<WindowPortal isOpen onClose={vi.fn()}>Conteúdo da Mesa</WindowPortal>);
    await act(async () => {});
    expect(externalDocument.querySelector("#portal-root")).toBeTruthy();
    expect(externalDocument.body.textContent).toContain("Conteúdo da Mesa");
  });

  it("calls onBlocked when the popup is blocked", () => {
    const onBlocked = vi.fn();
    vi.spyOn(window, "open").mockReturnValue(null);
    render(<WindowPortal isOpen onClose={vi.fn()} onBlocked={onBlocked}>Mesa</WindowPortal>);
    expect(onBlocked).toHaveBeenCalledOnce();
  });

  it("closes the external window when isOpen changes", () => {
    const onClose = vi.fn();
    const { rerender } = render(<WindowPortal isOpen onClose={onClose}>Mesa</WindowPortal>);
    rerender(<WindowPortal isOpen={false} onClose={onClose}>Mesa</WindowPortal>);
    expect(externalWindow.close).toHaveBeenCalledOnce();
  });

  it("calls onClose when the external window emits beforeunload", () => {
    const onClose = vi.fn();
    render(<WindowPortal isOpen onClose={onClose}>Mesa</WindowPortal>);
    const addEventListener = externalWindow.addEventListener as ReturnType<typeof vi.fn>;
    const handler = addEventListener.mock.calls.find(([event]) => event === "beforeunload")?.[1] as () => void;
    handler();
    expect(onClose).toHaveBeenCalledOnce();
  });
});
