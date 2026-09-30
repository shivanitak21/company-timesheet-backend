export function todayDateString(timeZone: string, now = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const year = parts.find((part) => part.type === 'year')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  const day = parts.find((part) => part.type === 'day')?.value;
  if (!year || !month || !day) {
    throw new Error('Unable to resolve the company date');
  }
  return `${year}-${month}-${day}`;
}

export function monthKey(dateStr: string): string {
  return dateStr.slice(0, 7);
}

export function isFutureDate(dateStr: string, today: string): boolean {
  return dateStr > today;
}

export function entryWindowBounds(today: string): { openFrom: string; openThrough: string } {
  return { openFrom: addDays(today, -1), openThrough: today };
}

export function isWithinEntryWindow(dateStr: string, today: string): boolean {
  const { openFrom, openThrough } = entryWindowBounds(today);
  return dateStr >= openFrom && dateStr <= openThrough;
}

export function isPreviousMonth(dateStr: string, today: string): boolean {
  return monthKey(dateStr) < monthKey(today);
}

export function isCurrentMonth(dateStr: string, today: string): boolean {
  return monthKey(dateStr) === monthKey(today);
}

export function weekdayIndex(dateStr: string): number {
  return new Date(`${dateStr}T12:00:00.000Z`).getUTCDay();
}

export function isWeekendDate(dateStr: string): boolean {
  const day = weekdayIndex(dateStr);
  return day === 0 || day === 6;
}

export function addDays(dateStr: string, days: number): string {
  const date = new Date(`${dateStr}T12:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function diffDays(start: string, end: string): number {
  const ms = new Date(`${end}T12:00:00.000Z`).getTime() - new Date(`${start}T12:00:00.000Z`).getTime();
  return Math.round(ms / 86_400_000);
}

export function daysInMonth(year: number, month: number): string[] {
  const count = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const monthText = String(month).padStart(2, '0');
  return Array.from({ length: count }, (_, index) => {
    const day = String(index + 1).padStart(2, '0');
    return `${year}-${monthText}-${day}`;
  });
}

export function eachDateInclusive(start: string, end: string): string[] {
  const dates: string[] = [];
  let cursor = start;
  while (cursor <= end) {
    dates.push(cursor);
    if (dates.length > 366) {
      break;
    }
    cursor = addDays(cursor, 1);
  }
  return dates;
}

export function isoWeekStart(dateStr: string): string {
  const date = new Date(`${dateStr}T12:00:00.000Z`);
  const day = date.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setUTCDate(date.getUTCDate() + diff);
  return date.toISOString().slice(0, 10);
}

export function countWorkingDays(dates: string[], holidayDates: Set<string>): number {
  return dates.filter((date) => !isWeekendDate(date) && !holidayDates.has(date)).length;
}

export function monthBounds(year: number, month: number): { start: string; end: string } {
  const days = daysInMonth(year, month);
  return { start: days[0] ?? `${year}-01-01`, end: days[days.length - 1] ?? `${year}-01-01` };
}
