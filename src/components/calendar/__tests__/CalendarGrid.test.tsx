import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { CalendarGrid, type CalendarEvent } from "../CalendarGrid";

const events: CalendarEvent[] = [
  { id: "s-1", date: "2026-11-10", title: "Sessão em Barovia", tone: "accent", badge: "2/5" },
];

function setup(view: "month" | "week" | "day" = "month") {
  const props = {
    view,
    cursor: new Date(2026, 10, 8),
    events,
    onNavigate: vi.fn(),
    onViewChange: vi.fn(),
    onEventClick: vi.fn(),
    onDayClick: vi.fn(),
  };
  render(<CalendarGrid {...props} />);
  return props;
}

describe("CalendarGrid", () => {
  it("renderiza título do mês e 42 células", () => {
    setup();
    expect(screen.getByText("novembro de 2026")).toBeInTheDocument();
    expect(screen.getAllByTestId(/^calendar-day-/)).toHaveLength(42);
  });

  it("navega para o mês seguinte/anterior e hoje", () => {
    const props = setup();
    fireEvent.click(screen.getByTestId("calendar-next"));
    expect(props.onNavigate).toHaveBeenCalledWith(expect.any(Date));
    const nextArg = props.onNavigate.mock.calls[0][0] as Date;
    expect(nextArg.getMonth()).toBe(11);
    fireEvent.click(screen.getByTestId("calendar-prev"));
    fireEvent.click(screen.getByTestId("calendar-today"));
    expect(props.onNavigate).toHaveBeenCalledTimes(3);
  });

  it("troca de view", () => {
    const props = setup();
    fireEvent.click(screen.getByTestId("calendar-view-week"));
    expect(props.onViewChange).toHaveBeenCalledWith("week");
  });

  it("renderiza evento e dispara clique", () => {
    const props = setup();
    const ev = screen.getByTestId("calendar-event-s-1");
    expect(ev).toHaveTextContent("Sessão em Barovia");
    fireEvent.click(ev);
    expect(props.onEventClick).toHaveBeenCalledWith(events[0]);
  });

  it("clique no dia dispara onDayClick", () => {
    const props = setup();
    fireEvent.click(screen.getByTestId("calendar-day-2026-11-10"));
    expect(props.onDayClick).toHaveBeenCalledWith(expect.any(Date));
  });

  it("view semana renderiza 7 colunas contendo o cursor", () => {
    setup("week");
    expect(screen.getAllByTestId(/^calendar-day-/)).toHaveLength(7);
    expect(screen.getByTestId("calendar-day-2026-11-08")).toBeInTheDocument();
  });

  it("view dia renderiza apenas o dia do cursor e seus eventos", () => {
    setup("day");
    expect(screen.getAllByTestId(/^calendar-day-/)).toHaveLength(1);
    expect(screen.getByTestId("calendar-day-2026-11-08")).toBeInTheDocument();
  });

  it("não aninha <button> dentro de <button> em nenhuma view", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    (["month", "week", "day"] as const).forEach((view) => {
      setup(view);
      cleanup();
    });
    const nestingErrors = spy.mock.calls.filter((call) =>
      String(call[0]).includes("cannot be a descendant of"),
    );
    expect(nestingErrors).toHaveLength(0);
    spy.mockRestore();
  });

  it("célula de dia com onDayClick é acessível por teclado", () => {
    const props = setup();
    const cell = screen.getByTestId("calendar-day-2026-11-10");
    expect(cell.tagName).toBe("DIV");
    expect(cell).toHaveAttribute("role", "button");
    fireEvent.keyDown(cell, { key: "Enter" });
    expect(props.onDayClick).toHaveBeenCalled();
  });
});
