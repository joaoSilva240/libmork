"use client";

import React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  addDays,
  addMonths,
  addWeeks,
  formatMonthYear,
  getMonthGrid,
  getWeekDays,
  isSameDay,
  toLocalDateISO,
} from "@/lib/utils/session-dates";

export type CalendarEvent = {
  id: string;
  date: string; // 'yyyy-MM-dd' local
  title: string;
  tone: "accent" | "success" | "muted";
  badge?: string;
};

export type CalendarView = "month" | "week" | "day";

type CalendarGridProps = {
  view: CalendarView;
  cursor: Date;
  events: CalendarEvent[];
  onNavigate: (date: Date) => void;
  onViewChange: (view: CalendarView) => void;
  onEventClick: (event: CalendarEvent) => void;
  onDayClick?: (date: Date) => void;
};

const WEEKDAY_LABELS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

const TONE_CLASSES: Record<CalendarEvent["tone"], string> = {
  accent: "bg-accent/20 border-accent/40 text-accent",
  success: "bg-green-900/40 border-green-700/50 text-green-300",
  muted: "bg-secondary-input border-secondary-border text-secondary-muted line-through",
};

function headerTitle(view: CalendarView, cursor: Date): string {
  if (view === "month") return formatMonthYear(cursor);
  if (view === "week") {
    const days = getWeekDays(cursor);
    const start = days[0];
    const end = days[6];
    const sameMonth = start.getMonth() === end.getMonth();
    const startLabel = new Intl.DateTimeFormat("pt-BR", { day: "2-digit" }).format(start);
    const endLabel = new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "long",
    }).format(end);
    return sameMonth
      ? `${startLabel} – ${endLabel}`
      : `${new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" }).format(start)} – ${endLabel}`;
  }
  return new Intl.DateTimeFormat("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(cursor);
}

export function CalendarGrid({
  view,
  cursor,
  events,
  onNavigate,
  onViewChange,
  onEventClick,
  onDayClick,
}: CalendarGridProps) {
  const today = new Date();

  const navigate = (direction: -1 | 1) => {
    if (view === "month") onNavigate(addMonths(cursor, direction));
    else if (view === "week") onNavigate(addWeeks(cursor, direction));
    else onNavigate(addDays(cursor, direction));
  };

  const eventsForDay = (iso: string) => events.filter((e) => e.date === iso);

  const renderEventBlock = (event: CalendarEvent) => (
    <button
      key={event.id}
      type="button"
      data-testid={`calendar-event-${event.id}`}
      onClick={(e) => {
        e.stopPropagation();
        onEventClick(event);
      }}
      title={event.title}
      className={`flex w-full items-center gap-1 truncate rounded border px-1 py-0.5 text-left text-[9px] font-semibold transition-colors cursor-pointer hover:brightness-125 ${TONE_CLASSES[event.tone]}`}
    >
      <span className="truncate">{event.title}</span>
      {event.badge && <span className="ml-auto shrink-0 opacity-80">{event.badge}</span>}
    </button>
  );

  const renderDayCell = (day: Date, inMonth: boolean) => {
    const iso = toLocalDateISO(day);
    const dayEvents = eventsForDay(iso);
    const isToday = isSameDay(day, today);

    const interactiveProps = onDayClick
      ? {
          role: "button" as const,
          tabIndex: 0,
          onClick: () => onDayClick(day),
          onKeyDown: (e: React.KeyboardEvent) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              onDayClick(day);
            }
          },
        }
      : {};

    return (
      <div
        key={iso}
        data-testid={`calendar-day-${iso}`}
        className={`flex min-h-16 flex-col gap-0.5 rounded-lg border p-1 text-left transition-colors md:min-h-24 ${
          onDayClick ? "cursor-pointer" : ""
        } ${
          isToday
            ? "border-accent ring-1 ring-accent bg-accent/5"
            : "border-secondary-border bg-secondary-input/30 hover:bg-secondary-input/60"
        } ${inMonth ? "" : "opacity-40"}`}
        {...interactiveProps}
      >
        <span className="text-[10px] font-bold text-secondary-pure">{day.getDate()}</span>
        {/* Desktop: até 3 blocos + "+N" */}
        <span className="hidden flex-col gap-0.5 md:flex">
          {dayEvents.slice(0, 3).map(renderEventBlock)}
          {dayEvents.length > 3 && (
            <span className="text-[9px] font-semibold text-secondary-muted">
              +{dayEvents.length - 3}
            </span>
          )}
        </span>
        {/* Mobile: pontos coloridos */}
        {dayEvents.length > 0 && (
          <span className="flex items-center gap-0.5 md:hidden">
            {dayEvents.slice(0, 3).map((ev) => (
              <span
                key={ev.id}
                className={`h-1.5 w-1.5 rounded-full ${
                  ev.tone === "accent"
                    ? "bg-accent"
                    : ev.tone === "success"
                      ? "bg-green-400"
                      : "bg-secondary-muted"
                }`}
              />
            ))}
            {dayEvents.length > 3 && (
              <span className="text-[8px] text-secondary-muted">+{dayEvents.length - 3}</span>
            )}
          </span>
        )}
      </div>
    );
  };

  return (
    <div
      data-testid="calendar-grid"
      className="flex flex-col overflow-hidden rounded-xl border border-secondary-border bg-secondary-card"
    >
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-secondary-border p-3">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            data-testid="calendar-prev"
            aria-label="Anterior"
            onClick={() => navigate(-1)}
            className="rounded-lg border border-secondary-border bg-secondary-input p-1.5 text-secondary-muted transition-colors hover:text-secondary-pure cursor-pointer"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            data-testid="calendar-next"
            aria-label="Próximo"
            onClick={() => navigate(1)}
            className="rounded-lg border border-secondary-border bg-secondary-input p-1.5 text-secondary-muted transition-colors hover:text-secondary-pure cursor-pointer"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          <button
            type="button"
            data-testid="calendar-today"
            onClick={() => onNavigate(new Date())}
            className="rounded-lg border border-secondary-border bg-secondary-input px-2.5 py-1.5 text-[11px] font-semibold text-secondary-muted transition-colors hover:text-secondary-pure cursor-pointer"
          >
            Hoje
          </button>
          <h3 className="ml-2 text-sm font-bold capitalize text-secondary-pure">
            {headerTitle(view, cursor)}
          </h3>
        </div>

        <div className="flex items-center gap-1">
          {(["month", "week", "day"] as CalendarView[]).map((v) => (
            <button
              key={v}
              type="button"
              data-testid={`calendar-view-${v}`}
              onClick={() => onViewChange(v)}
              className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold transition-colors cursor-pointer ${
                view === v
                  ? "bg-accent text-white"
                  : "text-secondary-muted hover:bg-secondary-input hover:text-secondary-pure"
              }`}
            >
              {v === "month" ? "Mês" : v === "week" ? "Semana" : "Dia"}
            </button>
          ))}
        </div>
      </div>

      {/* Grade */}
      {view === "month" && (
        <div className="p-2">
          <div className="mb-1 grid grid-cols-7 gap-px">
            {WEEKDAY_LABELS.map((label) => (
              <span
                key={label}
                className="py-1 text-center text-[10px] font-bold uppercase tracking-wide text-secondary-muted"
              >
                {label}
              </span>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {getMonthGrid(cursor.getFullYear(), cursor.getMonth()).map((day) =>
              renderDayCell(day, day.getMonth() === cursor.getMonth()),
            )}
          </div>
        </div>
      )}

      {view === "week" && (
        <div className="grid grid-cols-7 gap-1 p-2">
          {getWeekDays(cursor).map((day) => (
            <div key={toLocalDateISO(day)} className="flex flex-col gap-1">
              <span className="text-center text-[10px] font-bold uppercase text-secondary-muted">
                {WEEKDAY_LABELS[(day.getDay() + 6) % 7]} {day.getDate()}
              </span>
              <div
                data-testid={`calendar-day-${toLocalDateISO(day)}`}
                onClick={() => onDayClick?.(day)}
                className={`flex min-h-28 flex-col gap-1 rounded-lg border p-1.5 transition-colors ${
                  onDayClick ? "cursor-pointer" : ""
                } ${
                  isSameDay(day, today)
                    ? "border-accent ring-1 ring-accent bg-accent/5"
                    : "border-secondary-border bg-secondary-input/30 hover:bg-secondary-input/60"
                }`}
              >
                {eventsForDay(toLocalDateISO(day)).map(renderEventBlock)}
              </div>
            </div>
          ))}
        </div>
      )}

      {view === "day" && (
        <div className="flex flex-col gap-2 p-3">
          <div
            data-testid={`calendar-day-${toLocalDateISO(cursor)}`}
            onClick={() => onDayClick?.(cursor)}
            className={`flex flex-col gap-1.5 rounded-lg border p-3 text-left transition-colors ${
              onDayClick ? "cursor-pointer" : ""
            } ${
              isSameDay(cursor, today)
                ? "border-accent ring-1 ring-accent bg-accent/5"
                : "border-secondary-border bg-secondary-input/30"
            }`}
          >
            {eventsForDay(toLocalDateISO(cursor)).map((ev) => (
              <button
                key={ev.id}
                type="button"
                data-testid={`calendar-event-${ev.id}`}
                onClick={(e) => {
                  e.stopPropagation();
                  onEventClick(ev);
                }}
                className={`flex items-center gap-2 rounded-lg border px-2.5 py-2 text-xs font-semibold cursor-pointer hover:brightness-125 ${TONE_CLASSES[ev.tone]}`}
              >
                <span className="truncate">{ev.title}</span>
                {ev.badge && <span className="ml-auto shrink-0 opacity-80">{ev.badge}</span>}
              </button>
            ))}
            {eventsForDay(toLocalDateISO(cursor)).length === 0 && (
              <span className="py-2 text-center text-xs text-secondary-muted">
                Nenhuma sessão neste dia.
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
