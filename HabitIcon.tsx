import {
  Footprints, BookOpen, Brain, Droplets, Dumbbell, Moon,
  PenLine, Code, Leaf, Heart, Coffee, Sparkles,
  type LucideIcon,
} from 'lucide-react';

export const HABIT_ICON_MAP: Record<string, LucideIcon> = {
  run: Footprints,
  book: BookOpen,
  mind: Brain,
  water: Droplets,
  gym: Dumbbell,
  sleep: Moon,
  journal: PenLine,
  code: Code,
  leaf: Leaf,
  heart: Heart,
  coffee: Coffee,
  spark: Sparkles,
};

export const ICON_KEYS = Object.keys(HABIT_ICON_MAP);

export const ICON_LABELS: Record<string, string> = {
  run: 'Run',
  book: 'Read',
  mind: 'Mind',
  water: 'Water',
  gym: 'Gym',
  sleep: 'Sleep',
  journal: 'Journal',
  code: 'Code',
  leaf: 'Nature',
  heart: 'Health',
  coffee: 'Ritual',
  spark: 'Spark',
};

export function HabitGlyph({
  k,
  size = 18,
  strokeWidth = 2.2,
  className,
}: {
  k: string;
  size?: number;
  strokeWidth?: number;
  className?: string;
}) {
  const C = HABIT_ICON_MAP[k] ?? Sparkles;
  return <C size={size} strokeWidth={strokeWidth} className={className} />;
}
