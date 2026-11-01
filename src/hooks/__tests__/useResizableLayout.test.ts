import { renderHook, act } from "@testing-library/react";
import { describe, expect, it, beforeEach, vi } from "vitest";
import { useResizableLayout } from "../useResizableLayout";

describe("useResizableLayout", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("initializes with default values", () => {
    const { result } = renderHook(() =>
      useResizableLayout({
        initialWidth: 400,
        minWidth: 200,
        maxWidth: 800,
        initialHeight: 300,
        minHeight: 150,
        maxHeight: 600,
      })
    );

    expect(result.current.width).toBe(400);
    expect(result.current.height).toBe(300);
  });

  it("clamps width and height to min and max bounds", () => {
    const { result } = renderHook(() =>
      useResizableLayout({
        initialWidth: 100,
        minWidth: 200,
        maxWidth: 800,
        initialHeight: 1000,
        minHeight: 150,
        maxHeight: 600,
      })
    );

    expect(result.current.width).toBe(200);
    expect(result.current.height).toBe(600);
  });

  it("updates dimensions via handleResize and respects bounds", () => {
    const { result } = renderHook(() =>
      useResizableLayout({
        initialWidth: 400,
        minWidth: 200,
        maxWidth: 600,
        initialHeight: 300,
        minHeight: 150,
        maxHeight: 500,
      })
    );

    act(() => {
      result.current.handleResize(50, 100);
    });
    expect(result.current.width).toBe(450);
    expect(result.current.height).toBe(400);

    act(() => {
      result.current.handleResize(200, 200);
    });
    expect(result.current.width).toBe(600);
    expect(result.current.height).toBe(500);

    act(() => {
      result.current.handleResize(-500, -500);
    });
    expect(result.current.width).toBe(200);
    expect(result.current.height).toBe(150);
  });

  it("updates dimensions via setWidth and setHeight", () => {
    const { result } = renderHook(() =>
      useResizableLayout({
        initialWidth: 400,
        minWidth: 200,
        maxWidth: 800,
        initialHeight: 300,
        minHeight: 150,
        maxHeight: 600,
      })
    );

    act(() => {
      result.current.setWidth(500);
    });
    expect(result.current.width).toBe(500);

    act(() => {
      result.current.setHeight(450);
    });
    expect(result.current.height).toBe(450);

    act(() => {
      result.current.setWidth(1000);
    });
    expect(result.current.width).toBe(800);

    act(() => {
      result.current.setHeight(50);
    });
    expect(result.current.height).toBe(150);
  });

  it("resets dimensions to initial values", () => {
    const { result } = renderHook(() =>
      useResizableLayout({
        initialWidth: 400,
        minWidth: 200,
        maxWidth: 800,
        initialHeight: 300,
        minHeight: 150,
        maxHeight: 600,
      })
    );

    act(() => {
      result.current.setWidth(700);
      result.current.setHeight(500);
    });
    expect(result.current.width).toBe(700);
    expect(result.current.height).toBe(500);

    act(() => {
      result.current.reset();
    });
    expect(result.current.width).toBe(400);
    expect(result.current.height).toBe(300);
  });

  it("persists dimensions to localStorage when storageKey is provided", () => {
    const { result } = renderHook(() =>
      useResizableLayout({
        storageKey: "test-panel",
        initialWidth: 400,
        minWidth: 200,
        maxWidth: 800,
        initialHeight: 300,
        minHeight: 150,
        maxHeight: 600,
      })
    );

    act(() => {
      result.current.setWidth(550);
      result.current.setHeight(450);
    });

    expect(localStorage.getItem("test-panel-width")).toBe("550");
    expect(localStorage.getItem("test-panel-height")).toBe("450");
  });

  it("restores dimensions from localStorage on initialization", () => {
    localStorage.setItem("restore-panel-width", "650");
    localStorage.setItem("restore-panel-height", "480");

    const { result } = renderHook(() =>
      useResizableLayout({
        storageKey: "restore-panel",
        initialWidth: 400,
        minWidth: 200,
        maxWidth: 800,
        initialHeight: 300,
        minHeight: 150,
        maxHeight: 600,
      })
    );

    expect(result.current.width).toBe(650);
    expect(result.current.height).toBe(480);
  });

  it("clamps restored values from localStorage", () => {
    localStorage.setItem("clamped-panel-width", "1000");
    localStorage.setItem("clamped-panel-height", "50");

    const { result } = renderHook(() =>
      useResizableLayout({
        storageKey: "clamped-panel",
        initialWidth: 400,
        minWidth: 200,
        maxWidth: 800,
        initialHeight: 300,
        minHeight: 150,
        maxHeight: 600,
      })
    );

    expect(result.current.width).toBe(800);
    expect(result.current.height).toBe(150);
  });

  it("ignores corrupted localStorage values", () => {
    localStorage.setItem("corrupt-panel-width", "not-a-number");
    localStorage.setItem("corrupt-panel-height", "invalid");

    const { result } = renderHook(() =>
      useResizableLayout({
        storageKey: "corrupt-panel",
        initialWidth: 400,
        minWidth: 200,
        maxWidth: 800,
        initialHeight: 300,
        minHeight: 150,
        maxHeight: 600,
      })
    );

    expect(result.current.width).toBe(400);
    expect(result.current.height).toBe(300);
  });

  it("re-hydrates dimensions when storageKey changes dynamically", () => {
    localStorage.setItem("dynamic-panel-width", "520");
    localStorage.setItem("dynamic-panel-height", "380");

    const initialProps: { storageKey: string | undefined } = { storageKey: undefined };
    const { result, rerender } = renderHook(
      ({ storageKey }: { storageKey: string | undefined }) =>
        useResizableLayout({
          storageKey,
          initialWidth: 400,
          minWidth: 200,
          maxWidth: 800,
          initialHeight: 300,
          minHeight: 150,
          maxHeight: 600,
        }),
      { initialProps }
    );

    expect(result.current.width).toBe(400);
    expect(result.current.height).toBe(300);

    // Dynamic update when campaign loads
    rerender({ storageKey: "dynamic-panel" });

    expect(result.current.width).toBe(520);
    expect(result.current.height).toBe(380);
  });
});
