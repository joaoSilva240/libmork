import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ResizeHandle } from "../ResizeHandle";

describe("ResizeHandle", () => {
  it.each([
    ["both", "cursor-se-resize"],
    ["horizontal", "cursor-ew-resize"],
    ["vertical", "cursor-ns-resize"],
  ] as const)("renders the %s cursor and SVG icon", (direction, cursor) => {
    render(<ResizeHandle direction={direction} onResize={vi.fn()} />);
    const handle = screen.getByRole("button");
    expect(handle).toHaveClass(cursor);
    expect(handle.querySelector("svg")).toBeInTheDocument();
  });

  it("respects title, className, and data-testid", () => {
    render(<ResizeHandle onResize={vi.fn()} title="Resize panel" className="custom" data-testid="resize" />);
    const handle = screen.getByTestId("resize");
    expect(handle).toHaveAttribute("title", "Resize panel");
    expect(handle).toHaveAttribute("aria-label", "Resize panel");
    expect(handle).toHaveClass("custom");
  });

  it("reports pointer deltas, captures/releases the pointer, and ends resizing", () => {
    const onResize = vi.fn();
    const onResizeEnd = vi.fn();
    render(<ResizeHandle onResize={onResize} onResizeEnd={onResizeEnd} data-testid="resize" />);
    const handle = screen.getByTestId("resize") as HTMLElement;
    const setPointerCapture = vi.fn();
    const releasePointerCapture = vi.fn();
    Object.assign(handle, {
      setPointerCapture,
      releasePointerCapture,
      hasPointerCapture: vi.fn().mockReturnValue(true),
    });

    if (!globalThis.PointerEvent) {
      class TestPointerEvent extends MouseEvent {
        pointerId: number;
        constructor(type: string, init: MouseEventInit & { pointerId?: number } = {}) {
          super(type, init);
          this.pointerId = init.pointerId ?? 0;
        }
      }
      Object.defineProperty(globalThis, "PointerEvent", { value: TestPointerEvent });
    }

    fireEvent.pointerDown(handle, { pointerId: 7, clientX: 10, clientY: 20, bubbles: true });
    fireEvent.pointerMove(handle, { pointerId: 7, clientX: 16, clientY: 27, bubbles: true });
    fireEvent.pointerMove(handle, { pointerId: 7, clientX: 12, clientY: 24, bubbles: true });
    fireEvent.pointerUp(handle, { pointerId: 7, clientX: 12, clientY: 24, bubbles: true });

    expect(setPointerCapture).toHaveBeenCalledWith(7);
    expect(onResize).toHaveBeenNthCalledWith(1, 6, 7);
    expect(onResize).toHaveBeenNthCalledWith(2, -4, -3);
    expect(releasePointerCapture).toHaveBeenCalledWith(7);
    expect(onResizeEnd).toHaveBeenCalledOnce();
  });
});
