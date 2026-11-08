import { describe, it, expect } from "vitest";
import {
  toLocalDateISO,
  getMonthGrid,
  getWeekDays,
  eachDayISO,
  isSameDay,
  addDays,
  addWeeks,
  addMonths,
  formatMonthYear,
} from "../session-dates";

describe("session-dates", () => {
  it("toLocalDateISO formata yyyy-MM-dd local", () => {
    expect(toLocalDateISO(new Date(2026, 10, 8, 15, 30))).toBe("2026-11-08");
  });

  it("getMonthGrid retorna 42 células começando numa segunda", () => {
    const grid = getMonthGrid(2026, 10); // novembro/2026
    expect(grid).toHaveLength(42);
    expect(grid[0].getDay()).toBe(1);
    expect(grid.some((d) => d.getMonth() === 10 && d.getDate() === 1)).toBe(true);
  });

  it("getMonthGrid atravessa virada de ano", () => {
    const grid = getMonthGrid(2026, 11); // dezembro
    expect(grid).toHaveLength(42);
    expect(grid[41].getFullYear()).toBeGreaterThanOrEqual(2026);
  });

  it("getWeekDays retorna 7 dias segunda-first contendo a data", () => {
    const week = getWeekDays(new Date(2026, 10, 11)); // quarta
    expect(week).toHaveLength(7);
    expect(week[0].getDay()).toBe(1);
    expect(week.some((d) => isSameDay(d, new Date(2026, 10, 11)))).toBe(true);
  });

  it("eachDayISO inclui o primeiro e o último dia", () => {
    expect(eachDayISO(new Date(2026, 10, 1), new Date(2026, 10, 3, 23, 59, 59))).toEqual([
      "2026-11-01",
      "2026-11-02",
      "2026-11-03",
    ]);
  });

  it("addDays/addWeeks/addMonths não mutam a data original", () => {
    const d = new Date(2026, 0, 31);
    expect(addMonths(d, 1).getMonth()).toBe(1);
    expect(addWeeks(d, 1).getDate()).toBe(7);
    expect(addDays(d, 1).getDate()).toBe(1);
    expect(d.getMonth()).toBe(0);
    expect(d.getDate()).toBe(31);
  });

  it("formatMonthYear em pt-BR", () => {
    expect(formatMonthYear(new Date(2026, 10, 8))).toBe("novembro de 2026");
  });
});
