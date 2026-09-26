import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { OptimizedImage } from "../OptimizedImage";

describe("OptimizedImage Component", () => {
  it("renders image with lazy loading and async decoding", () => {
    render(<OptimizedImage src="/test.jpg" alt="Test image" />);
    const img = screen.getByAltText("Test image") as HTMLImageElement;
    expect(img).toBeInTheDocument();
    expect(img.getAttribute("loading")).toBe("lazy");
    expect(img.getAttribute("decoding")).toBe("async");
  });
});
