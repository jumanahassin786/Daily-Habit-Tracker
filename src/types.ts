export type CheckStatus = 'done' | 'skipped';

export interface Habit {
  id: string;
  name: string;
  icon: string;
  color: string;
  note?: string;
  weeklyTarget?: number;
  createdAt: string;
}

export type ChecksMap = Record<string, CheckStatus>;

export const checkKey = (habitId: string, dateStr: string): string =>
  `${habitId}::${dateStr}`;

export type BoardMode = 'habits' | 'days';
export type SortKey = 'custom' | 'completion' | 'streak' | 'name';
