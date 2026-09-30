import { addDays, isoWeekStart } from './dates';

export type MinuteEntry = {
  date: string;
  durationMinutes: number;
};

export function summarizeEntries(entries: MinuteEntry[]) {
  const dailyMap = new Map<string, number>();
  for (const entry of entries) {
    dailyMap.set(entry.date, (dailyMap.get(entry.date) ?? 0) + entry.durationMinutes);
  }

  const dailyTotals = [...dailyMap.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([date, totalMinutes]) => ({ date, totalMinutes }));

  const weeklyMap = new Map<string, number>();
  for (const day of dailyTotals) {
    const weekStart = isoWeekStart(day.date);
    weeklyMap.set(weekStart, (weeklyMap.get(weekStart) ?? 0) + day.totalMinutes);
  }

  const weeklyTotals = [...weeklyMap.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([weekStart, totalMinutes]) => ({
      weekStart,
      weekEnd: addDays(weekStart, 6),
      totalMinutes,
    }));

  const monthlyTotalMinutes = dailyTotals.reduce((sum, day) => sum + day.totalMinutes, 0);
  return { dailyTotals, weeklyTotals, monthlyTotalMinutes };
}
