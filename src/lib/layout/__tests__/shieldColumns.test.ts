import { describe, it, expect } from "vitest";
import {
  SHIELD_CENTER_MIN,
  SHIELD_GRID_GAP,
  SHIELD_LEFT_MAX,
  SHIELD_LEFT_MIN,
  SHIELD_RIGHT_MAX,
  SHIELD_RIGHT_MIN,
  fitShieldColumns,
  getMaxSideWidth,
  getShieldGridTemplate,
} from "../shieldColumns";

const centerWidth = (containerWidth: number, left: number, right: number) =>
  containerWidth - 2 * SHIELD_GRID_GAP - left - right;

describe("shieldColumns", () => {
  it("builds an elastic center track with contained side tracks", () => {
    expect(getShieldGridTemplate(true)).toBe(
      "minmax(200px, clamp(200px, var(--w-l), 380px)) minmax(380px, 1fr) minmax(240px, clamp(240px, var(--w-r), 420px))",
    );
    expect(getShieldGridTemplate(false)).toBe(
      "minmax(200px, clamp(200px, var(--w-l), 380px)) minmax(380px, 1fr)",
    );
  });

  it("clamps side widths to their own limits", () => {
    expect(fitShieldColumns({ left: 10, right: 9999, containerWidth: 0, showSessionLog: true })).toEqual({
      left: SHIELD_LEFT_MIN,
      right: SHIELD_RIGHT_MAX,
    });
  });

  it("keeps widths untouched when the center still has room", () => {
    expect(fitShieldColumns({ left: 300, right: 300, containerWidth: 1600, showSessionLog: true })).toEqual({
      left: 300,
      right: 300,
    });
  });

  it("shrinks sides so the center never drops below its minimum", () => {
    const containerWidth = 1024;
    const fitted = fitShieldColumns({ left: 380, right: 420, containerWidth, showSessionLog: true });
    expect(fitted.left).toBeGreaterThanOrEqual(SHIELD_LEFT_MIN);
    expect(fitted.right).toBeGreaterThanOrEqual(SHIELD_RIGHT_MIN);
    expect(centerWidth(containerWidth, fitted.left, fitted.right)).toBeGreaterThanOrEqual(SHIELD_CENTER_MIN);
  });

  it("never goes below side minimums even on tiny containers", () => {
    expect(fitShieldColumns({ left: 380, right: 420, containerWidth: 500, showSessionLog: true })).toEqual({
      left: SHIELD_LEFT_MIN,
      right: SHIELD_RIGHT_MIN,
    });
  });

  it("limits growth of a side column to the space left for the center", () => {
    const containerWidth = 1100;
    const maxLeft = getMaxSideWidth("left", { left: 200, right: 400, containerWidth, showSessionLog: true });
    expect(maxLeft).toBe(containerWidth - 2 * SHIELD_GRID_GAP - SHIELD_CENTER_MIN - 400);
    expect(centerWidth(containerWidth, maxLeft, 400)).toBe(SHIELD_CENTER_MIN);

    const maxRight = getMaxSideWidth("right", { left: 380, right: 240, containerWidth, showSessionLog: true });
    expect(centerWidth(containerWidth, 380, maxRight)).toBe(SHIELD_CENTER_MIN);
  });

  it("ignores the right column when the session log is hidden", () => {
    expect(getMaxSideWidth("left", { left: 200, right: 420, containerWidth: 900, showSessionLog: false })).toBe(
      SHIELD_LEFT_MAX,
    );
  });

  it("falls back to the side maximum when the container width is unknown", () => {
    expect(getMaxSideWidth("right", { left: 200, right: 240, containerWidth: 0, showSessionLog: true })).toBe(
      SHIELD_RIGHT_MAX,
    );
  });
});
