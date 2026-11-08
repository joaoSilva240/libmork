// =============================================================================
// Libmork — Utilitários de data para o calendário de sessões (Issue #63)
// =============================================================================
// Sem dependências externas; datas locais do navegador.

/**
 * Formata uma data local como 'yyyy-MM-dd'.
 */
export function toLocalDateISO(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Compara apenas a parte de data local (ignora horas).
 */
export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function addDays(date: Date, n: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

export function addWeeks(date: Date, n: number): Date {
  return addDays(date, n * 7);
}

export function addMonths(date: Date, n: number): Date {
  const d = new Date(date);
  d.setDate(1);
  d.setMonth(d.getMonth() + n);
  return d;
}

/**
 * Grade de 42 células do mês (6 semanas), começando na segunda-feira.
 */
export function getMonthGrid(year: number, monthIndex: number): Date[] {
  const first = new Date(year, monthIndex, 1);
  const offset = (first.getDay() + 6) % 7; // segunda = 0
  const start = addDays(first, -offset);
  return Array.from({ length: 42 }, (_, i) => addDays(start, i));
}

/**
 * Os 7 dias da semana (segunda a domingo) que contêm a data informada.
 */
export function getWeekDays(date: Date): Date[] {
  const offset = (date.getDay() + 6) % 7;
  const monday = addDays(date, -offset);
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
}

/**
 * Lista de 'yyyy-MM-dd' locais de start até end (inclusivo, comparando só o dia).
 */
export function eachDayISO(start: Date, end: Date): string[] {
  const days: string[] = [];
  let cursor = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const last = new Date(end.getFullYear(), end.getMonth(), end.getDate());
  while (cursor <= last) {
    days.push(toLocalDateISO(cursor));
    cursor = addDays(cursor, 1);
  }
  return days;
}

/**
 * Título do mês/ano em pt-BR (ex.: "novembro de 2026").
 */
export function formatMonthYear(date: Date): string {
  return new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" }).format(date);
}
