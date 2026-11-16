import type { ChecksMap, Habit } from '../types';
import { checkKey } from '../types';

export const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export const WEEKDAY_LETTER = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
export const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function toDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function parseDateStr(s: string): Date {
  const [y, m, dd] = s.split('-').map(Number);
  return new Date(y, (m || 1) - 1, dd || 1);
}

export function getTodayStr(): string {
  return toDateStr(new Date());
}

export function getMonthDays(year: number, month: number): Date[] {
  const n = new Date(year, month + 1, 0).getDate();
  return Array.from({ length: n }, (_, i) => new Date(year, month, i + 1));
}

export function isWeekendDate(d: Date): boolean {
  const g = d.getDay();
  return g === 0 || g === 6;
}

export function prettyLong(dateStr: string): string {
  const d = parseDateStr(dateStr);
  return d.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
}

export const HABIT_COLORS = [
  '#FF5A3C',
  '#FF9F0A',
  '#EAB308',
  '#22C55E',
  '#10B981',
  '#14B8A6',
  '#0EA5E9',
  '#6366F1',
  '#A855F7',
  '#EC4899',
  '#F43F5E',
  '#8D6E63',
];

export function seedHabits(): Habit[] {
  const now = new Date().toISOString();
  const defs: Array<[string, string, string, string, number]> = [
    ['run', 'Morning run', '30 min easy pace', '#FF5A3C', 5],
    ['water', 'Drink 2L water', 'Refill the bottle', '#0EA5E9', 7],
    ['book', 'Read 20 pages', 'Currently: Atomic Habits', '#A855F7', 6],
    ['mind', 'Meditate 10 min', 'Breath + body scan', '#14B8A6', 5],
    ['gym', 'Strength training', 'Push / pull / legs', '#F43F5E', 4],
    ['code', 'Code 1 hour', 'Side project sprint', '#22C55E', 5],
    ['journal', 'Evening journal', '3 lines minimum', '#FF9F0A', 7],
    ['sleep', 'Lights out 11pm', 'No screens after 10', '#6366F1', 6],
  ];
  return defs.map(([icon, name, note, color, weeklyTarget]) => ({
    id: `seed-${icon}`,
    name,
    icon,
    color,
    note,
    weeklyTarget,
    createdAt: now,
  }));
}

function roll(habitIdx: number, d: Date): number {
  const v = habitIdx * 37 + d.getDate() * 17 + d.getMonth() * 11 + d.getFullYear() * 3;
  return ((v % 100) + 100) % 100;
}

const STRENGTH = [62, 84, 70, 66, 55, 68, 78, 60];

export function seedChecks(habits: Habit[], todayStr: string): ChecksMap {
  const out: ChecksMap = {};
  const today = parseDateStr(todayStr);
  for (let back = 1; back <= 16; back++) {
    const d = new Date(today);
    d.setDate(d.getDate() - back);
    const ds = toDateStr(d);
    habits.forEach((h, i) => {
      const r = roll(i, d);
      const p = STRENGTH[i % STRENGTH.length];
      if (r < p) out[checkKey(h.id, ds)] = 'done';
      else if (r < p + 9) out[checkKey(h.id, ds)] = 'skipped';
    });
  }
  return out;
}

export interface HabitStats {
  done: number;
  skipped: number;
  open: number;
  counted: number;
  pct: number;
  currentStreak: number;
  bestStreak: number;
}

export function calcHabitStats(
  habitId: string,
  checks: ChecksMap,
  days: Date[],
  todayStr: string,
): HabitStats {
  let done = 0;
  let skipped = 0;
  const elapsed = days.filter((d) => toDateStr(d) <= todayStr);
  for (const d of elapsed) {
    const s = checks[checkKey(habitId, toDateStr(d))];
    if (s === 'done') done++;
    else if (s === 'skipped') skipped++;
  }
  const open = Math.max(0, elapsed.length - done - skipped);
  const counted = Math.max(0, elapsed.length - skipped);
  const pct = counted === 0 ? 0 : Math.round((done / counted) * 100);

  let best = 0;
  let cur = 0;
  for (const d of elapsed) {
    const s = checks[checkKey(habitId, toDateStr(d))];
    if (s === 'done') {
      cur++;
      if (cur > best) best = cur;
    } else if (s === 'skipped') {
      // hold
    } else {
      cur = 0;
    }
  }

  let streak = 0;
  let cursor = parseDateStr(todayStr);
  const todayStatus = checks[checkKey(habitId, todayStr)];
  if (todayStatus !== 'done' && todayStatus !== 'skipped') {
    cursor = new Date(cursor);
    cursor.setDate(cursor.getDate() - 1);
  }
  for (let i = 0; i < 500; i++) {
    const ds = toDateStr(cursor);
    const s = checks[checkKey(habitId, ds)];
    if (s === 'done') streak++;
    else if (s === 'skipped') {
      // neutral
    } else break;
    cursor = new Date(cursor);
    cursor.setDate(cursor.getDate() - 1);
  }

  return { done, skipped, open, counted, pct, currentStreak: streak, bestStreak: best };
}

export function calcDayPct(dayStr: string, habits: Habit[], checks: ChecksMap): number {
  if (habits.length === 0) return 0;
  let done = 0;
  let skipped = 0;
  for (const h of habits) {
    const s = checks[checkKey(h.id, dayStr)];
    if (s === 'done') done++;
    else if (s === 'skipped') skipped++;
  }
  const counted = habits.length - skipped;
  if (counted <= 0) return 100;
  return Math.round((done / counted) * 100);
}

export interface OverallStats {
  pct: number;
  done: number;
  total: number;
  checkins: number;
  perfectDays: number;
  bestStreak: number;
  elapsedDays: number;
  remainingDays: number;
}

export function calcOverall(
  habits: Habit[],
  checks: ChecksMap,
  days: Date[],
  todayStr: string,
): OverallStats {
  const elapsed = days.filter((d) => toDateStr(d) <= todayStr);
  let done = 0;
  let counted = 0;
  let perfectDays = 0;
  for (const d of elapsed) {
    const ds = toDateStr(d);
    let dayDone = 0;
    let daySkipped = 0;
    for (const h of habits) {
      const s = checks[checkKey(h.id, ds)];
      if (s === 'done') dayDone++;
      else if (s === 'skipped') daySkipped++;
    }
    done += dayDone;
    counted += habits.length - daySkipped;
    if (habits.length > 0 && dayDone === habits.length) perfectDays++;
  }
  let bestStreak = 0;
  for (const h of habits) {
    const s = calcHabitStats(h.id, checks, days, todayStr);
    if (s.bestStreak > bestStreak) bestStreak = s.bestStreak;
    if (s.currentStreak > bestStreak) bestStreak = s.currentStreak;
  }
  return {
    pct: counted === 0 ? 0 : Math.round((done / counted) * 100),
    done,
    total: counted,
    checkins: done,
    perfectDays,
    bestStreak,
    elapsedDays: elapsed.length,
    remainingDays: Math.max(0, days.length - elapsed.length),
  };
}

export const QUOTES = [
  { text: 'You do not rise to the level of your goals. You fall to the level of your systems.', by: 'James Clear' },
  { text: 'Small deeds done are better than great deeds planned.', by: 'Peter Marshall' },
  { text: 'Motivation is what gets you started. Habit is what keeps you going.', by: 'Jim Ryun' },
  { text: 'We are what we repeatedly do. Excellence, then, is not an act, but a habit.', by: 'Aristotle' },
  { text: 'Success is the sum of small efforts, repeated day in and day out.', by: 'Robert Collier' },
  { text: 'First we make our habits, and then our habits make us.', by: 'John Dryden' },
  { text: 'A year from now you may wish you had started today.', by: 'Karen Lamb' },
  { text: 'Chains of habit are too light to be felt until they are too heavy to be broken.', by: 'Warren Buffett' },
];

export function quoteFor(dateStr: string) {
  const n = parseDateStr(dateStr).getDate();
  return QUOTES[n % QUOTES.length];
}

export function greeting(): string {
  const h = new Date().getHours();
  if (h < 5) return 'Burning the midnight oil';
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}
