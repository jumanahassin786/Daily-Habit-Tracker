import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowDown, ArrowLeftRight, ArrowUp, CalendarDays, Check, ChevronLeft, ChevronRight,
  CircleDashed, Download, Flame, LayoutGrid, Minus, PartyPopper, PenLine, Plus,
  Quote, RotateCcw, Rows3, Search, Sparkles, Target, Trash2, Trophy, X, Zap,
  Columns3,
} from 'lucide-react';
import type { BoardMode, ChecksMap, Habit, SortKey } from './types';
import { checkKey } from './types';
import {
  MONTH_NAMES, WEEKDAY_LETTER, calcDayPct, calcHabitStats, calcOverall,
  getMonthDays, getTodayStr, greeting, isWeekendDate, parseDateStr,
  prettyLong, quoteFor, seedChecks, seedHabits, toDateStr, HABIT_COLORS,
} from './lib/habits';
import { HabitGlyph, ICON_KEYS, ICON_LABELS } from './components/HabitIcon';
import ProgressRing from './components/ProgressRing';
import { habitAPI, checkAPI } from './lib/api';

const LS_HABITS = 'ticked.habits.v1';
const LS_CHECKS = 'ticked.checks.v1';
const LS_SEEDED = 'ticked.seeded.v1';

function loadHabits(): Habit[] | null {
  try {
    const raw = localStorage.getItem(LS_HABITS);
    if (!raw) return null;
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : null;
  } catch { return null; }
}
function loadChecks(): ChecksMap {
  try {
    const raw = localStorage.getItem(LS_CHECKS);
    if (!raw) return {};
    const o = JSON.parse(raw);
    return o && typeof o === 'object' ? o : {};
  } catch { return {}; }
}

function uid() {
  return `h-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

export default function App() {
  const todayStr = useMemo(() => getTodayStr(), []);
  const todayDate = useMemo(() => parseDateStr(todayStr), [todayStr]);

  const [habits, setHabits] = useState<Habit[]>(() => {
    const stored = loadHabits();
    if (stored && stored.length > 0) return stored;
    return seedHabits();
  });
  const [checks, setChecks] = useState<ChecksMap>(() => {
    const stored = loadChecks();
    if (Object.keys(stored).length > 0) return stored;
    try {
      if (!localStorage.getItem(LS_SEEDED)) {
        const seeded = seedChecks(seedHabits(), getTodayStr());
        localStorage.setItem(LS_SEEDED, '1');
        return seeded;
      }
    } catch { /* ignore */ }
    return {};
  });

  const [viewYear, setViewYear] = useState(todayDate.getFullYear());
  const [viewMonth, setViewMonth] = useState(todayDate.getMonth());
  const [focusDate, setFocusDate] = useState(todayStr);
  const [boardMode, setBoardMode] = useState<BoardMode>('days');
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('custom');
  const [selectedHabitId, setSelectedHabitId] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingHabit, setEditingHabit] = useState<Habit | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<number | undefined>(undefined);
  const boardScrollRef = useRef<HTMLDivElement>(null);
  const backendSyncStarted = useRef(false);

  useEffect(() => {
    try {
      localStorage.setItem(LS_HABITS, JSON.stringify(habits));
      localStorage.setItem(LS_CHECKS, JSON.stringify(checks));
    } catch { /* ignore */ }
  }, [habits, checks]);

  const showToast = (msg: string) => {
    setToast(msg);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 2400);
  };

  useEffect(() => {
  if (backendSyncStarted.current) return;
  backendSyncStarted.current = true;

  const syncWithBackend = async () => {
    try {
      const [backendHabits, backendChecks] = await Promise.all([
        habitAPI.getAll(),
        checkAPI.getAll(),
      ]);

      // Backend already has data: load it into the frontend.
      if (backendHabits.length > 0) {
        const syncedChecks: ChecksMap = {};

        backendChecks.forEach((check) => {
          syncedChecks[
            checkKey(String(check.habitId), check.date)
          ] = check.status;
        });

        setHabits(backendHabits);
        setChecks(syncedChecks);
        return;
      }

      // Backend is empty: migrate existing frontend habits.
      const idMap = new Map<string, string>();
      const migratedHabits: Habit[] = [];

      for (const habit of habits) {
        const createdHabit = await habitAPI.create({
          name: habit.name,
          icon: habit.icon,
          color: habit.color,
          note: habit.note,
          weeklyTarget: habit.weeklyTarget,
        });

        idMap.set(habit.id, createdHabit.id);
        migratedHabits.push(createdHabit);
      }

      // Migrate existing check history using the new MongoDB IDs.
      const migratedChecks: ChecksMap = {};
      const checkPromises: Promise<unknown>[] = [];

      Object.entries(checks).forEach(([key, status]) => {
        const splitIndex = key.lastIndexOf('::');

        if (splitIndex === -1) return;

        const oldHabitId = key.substring(0, splitIndex);
        const date = key.substring(splitIndex + 2);
        const newHabitId = idMap.get(oldHabitId);

        if (!newHabitId) return;

        migratedChecks[checkKey(newHabitId, date)] = status;

        checkPromises.push(
          checkAPI.save(newHabitId, date, status)
        );
      });

      await Promise.all(checkPromises);

      setHabits(migratedHabits);
      setChecks(migratedChecks);

    } catch (error) {
      console.error('Backend synchronization failed:', error);
      showToast('Could not sync with server. Please try again.');
    }
  };

  void syncWithBackend();
}, []);

  const days = useMemo(() => getMonthDays(viewYear, viewMonth), [viewYear, viewMonth]);
  const isCurrentMonth = viewYear === todayDate.getFullYear() && viewMonth === todayDate.getMonth();

  const statsByHabit = useMemo(() => {
    const m = new Map<string, ReturnType<typeof calcHabitStats>>();
    for (const h of habits) m.set(h.id, calcHabitStats(h.id, checks, days, todayStr));
    return m;
  }, [habits, checks, days, todayStr]);

  const overall = useMemo(() => calcOverall(habits, checks, days, todayStr), [habits, checks, days, todayStr]);

  const visibleHabits = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = habits.filter((h) =>
      q === '' || h.name.toLowerCase().includes(q) || (h.note ?? '').toLowerCase().includes(q),
    );
    if (sortKey === 'name') list = [...list].sort((a, b) => a.name.localeCompare(b.name));
    else if (sortKey === 'completion') {
      list = [...list].sort((a, b) => (statsByHabit.get(b.id)?.pct ?? 0) - (statsByHabit.get(a.id)?.pct ?? 0));
    } else if (sortKey === 'streak') {
      list = [...list].sort((a, b) => (statsByHabit.get(b.id)?.currentStreak ?? 0) - (statsByHabit.get(a.id)?.currentStreak ?? 0));
    }
    return list;
  }, [habits, search, sortKey, statsByHabit]);

  const selectedHabit = habits.find((h) => h.id === selectedHabitId) ?? null;

  const bestStreakHabit = useMemo(() => {
    let best: Habit | null = null;
    let bestN = -1;
    for (const h of habits) {
      const s = statsByHabit.get(h.id);
      const n = s?.currentStreak ?? 0;
      if (n > bestN) { bestN = n; best = h; }
    }
    return bestN > 0 ? { habit: best!, n: bestN } : null;
  }, [habits, statsByHabit]);

  // Scroll the board so today is visible when viewing the current month
  useEffect(() => {
    if (!isCurrentMonth) return;
    const t = window.setTimeout(() => {
      const el = boardScrollRef.current?.querySelector('[data-today-col="true"]');
      el?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
    }, 350);
    return () => window.clearTimeout(t);
  }, [isCurrentMonth, viewYear, viewMonth, boardMode]);

  // ------------------------------ mutations ------------------------------
  const cycleCell = (habitId: string, dateStr: string) => {
  if (dateStr > todayStr) {
    showToast('That day has not happened yet');
    return;
  }

  const key = checkKey(habitId, dateStr);
  const currentStatus = checks[key];

  const nextStatus =
    !currentStatus
      ? 'done'
      : currentStatus === 'done'
        ? 'skipped'
        : null;

  setChecks((prev) => {
    const next = { ...prev };

    if (nextStatus) {
      next[key] = nextStatus;
    } else {
      delete next[key];
    }

    return next;
  });

  const request = nextStatus
    ? checkAPI.save(habitId, dateStr, nextStatus)
    : checkAPI.delete(habitId, dateStr);

  void request.catch((error) => {
    console.error('Failed to save check:', error);
    showToast('Could not save check to server');
  });
};

  const setCell = (
  habitId: string,
  dateStr: string,
  v: 'done' | 'skipped' | null
) => {
  if (dateStr > todayStr && v) {
    showToast('That day has not happened yet');
    return;
  }

  const key = checkKey(habitId, dateStr);

  setChecks((prev) => {
    const next = { ...prev };

    if (v) next[key] = v;
    else delete next[key];

    return next;
  });

  const request = v
    ? checkAPI.save(habitId, dateStr, v)
    : checkAPI.delete(habitId, dateStr);

  void request.catch((error) => {
    console.error('Failed to update check:', error);
    showToast('Could not save check to server');
  });
};

  const toggleDone = (habitId: string, dateStr: string) => {
    const cur = checks[checkKey(habitId, dateStr)];
    setCell(habitId, dateStr, cur === 'done' ? null : 'done');
  };

 const markAllDone = (dateStr: string) => {
  if (dateStr > todayStr) return;

  setChecks((prev) => {
    const next = { ...prev };
    for (const h of habits) next[checkKey(h.id, dateStr)] = 'done';
    return next;
  });

  void checkAPI.markAllDone(
    habits.map((h) => h.id),
    dateStr
  ).catch((error) => {
    console.error('Failed to mark all habits done:', error);
    showToast('Could not save changes to server');
  });

  showToast(`All habits ticked for ${prettyLong(dateStr)}`);
};

  const clearDay = (dateStr: string) => {
  setChecks((prev) => {
    const next = { ...prev };
    for (const h of habits) delete next[checkKey(h.id, dateStr)];
    return next;
  });

  void checkAPI.clearDay(dateStr).catch((error) => {
    console.error('Failed to clear day:', error);
    showToast('Could not clear checks on server');
  });
};

  const navMonth = (delta: number) => {
    let y = viewYear;
    let m = viewMonth + delta;
    while (m < 0) { m += 12; y -= 1; }
    while (m > 11) { m -= 12; y += 1; }
    setViewYear(y);
    setViewMonth(m);
  };

  const goToday = () => {
    setViewYear(todayDate.getFullYear());
    setViewMonth(todayDate.getMonth());
    setFocusDate(todayStr);
  };

  const openAdd = () => {
    setEditingHabit(null);
    setModalOpen(true);
  };
  const openEdit = (h: Habit) => {
    setEditingHabit(h);
    setModalOpen(true);
  };

  const saveHabit = async (
  data: {
    name: string;
    note: string;
    icon: string;
    color: string;
    weeklyTarget: number;
  },
  id?: string
) => {
  try {
    if (id) {
      const updatedHabit = await habitAPI.update(id, data);

      setHabits((prev) =>
        prev.map((h) => (h.id === id ? updatedHabit : h))
      );

      showToast('Habit updated');
    } else {
      const newHabit = await habitAPI.create(data);

      setHabits((prev) => [...prev, newHabit]);

      showToast(`“${data.name}” added to the board`);
    }

    setModalOpen(false);
  } catch (error) {
    console.error('Failed to save habit:', error);
    showToast('Could not save habit. Please try again.');
  }
};

  const deleteHabit = async (id: string) => {
  const h = habits.find((x) => x.id === id);
  if (!h) return;

  if (!window.confirm(`Delete “${h.name}” and all its ticks?`)) return;

  try {
    await habitAPI.delete(id);

    setHabits((prev) => prev.filter((x) => x.id !== id));

    setChecks((prev) => {
      const next = { ...prev };
      for (const k of Object.keys(next)) {
        if (k.startsWith(`${id}::`)) delete next[k];
      }
      return next;
    });

    if (selectedHabitId === id) setSelectedHabitId(null);
    setModalOpen(false);
    showToast('Habit deleted');
  } catch (error) {
    console.error('Failed to delete habit:', error);
    showToast('Could not delete habit. Please try again.');
  }
};

 const moveHabit = async (id: string, dir: -1 | 1) => {
  const i = habits.findIndex((h) => h.id === id);
  const j = i + dir;

  if (i < 0 || j < 0 || j >= habits.length) return;

  const next = [...habits];
  [next[i], next[j]] = [next[j], next[i]];

  try {
    await habitAPI.reorder(next.map((h) => h.id));
    setHabits(next);
  } catch (error) {
    console.error('Failed to reorder habits:', error);
    showToast('Could not update habit order');
  }
};

  const exportCSV = () => {
    const rows = ['habit,date,status'];
    for (const h of habits) {
      for (const d of days) {
        const ds = toDateStr(d);
        const s = checks[checkKey(h.id, ds)] ?? '';
        rows.push(`"${h.name.replace(/"/g, '""')}",${ds},${s}`);
      }
    }
    const blob = new Blob([rows.join('\n')], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `ticked-${viewYear}-${String(viewMonth + 1).padStart(2, '0')}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
    showToast('Month exported as CSV');
  };

  const resetDemo = () => {
    if (!window.confirm('Reset the board to fresh demo data? Your ticks will be replaced.')) return;
    const fresh = seedHabits();
    setHabits(fresh);
    setChecks(seedChecks(fresh, todayStr));
    try { localStorage.setItem(LS_SEEDED, '1'); } catch { /* ignore */ }
    showToast('Fresh demo board loaded');
  };

  const quote = quoteFor(focusDate);

  return (
    <div className="min-h-full relative">
      {/* backdrop — minimal */}
      <div className="pointer-events-none fixed inset-0 -z-10 bg-white" />

      <TopBar
        todayStr={todayStr}
        viewYear={viewYear}
        viewMonth={viewMonth}
        onNav={navMonth}
        onToday={goToday}
        isCurrentMonth={isCurrentMonth}
        boardMode={boardMode}
        setBoardMode={setBoardMode}
        search={search}
        setSearch={setSearch}
        onAdd={openAdd}
      />

      <main className="mx-auto w-full max-w-[1440px] px-4 sm:px-6 pb-16">
        {/* heading — minimal */}
        <div className="mt-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[12px] font-medium tracking-wide text-ink/45">
              {greeting()} — {prettyLong(todayStr)}
            </p>
            <h1 className="font-display text-[28px] leading-tight tracking-tight mt-1 font-semibold">
              {MONTH_NAMES[viewMonth]} {viewYear}
            </h1>
          </div>
          <p className="max-w-md text-[13px] leading-snug text-ink/45">
            <span>“{quote.text}”</span>{' '}
            <span>— {quote.by}</span>
          </p>
        </div>

        {/* 01 — tracking sheet */}
        <section aria-label="Tracking sheet" className="mt-8">
          <SectionHead
            index="01"
            title="Tracking sheet"
            desc="To-dos on the left, days of the month as rows — click any box to tick it."
          />
          <div className="mt-4 grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_350px] gap-5 items-start">
            <Board
            mode={boardMode}
            habits={visibleHabits}
            allHabits={habits}
            days={days}
            checks={checks}
            todayStr={todayStr}
            focusDate={focusDate}
            setFocusDate={setFocusDate}
            statsByHabit={statsByHabit}
            onCycle={cycleCell}
            onClear={(hid, ds) => setCell(hid, ds, null)}
            onSelectHabit={setSelectedHabitId}
            selectedHabitId={selectedHabitId}
            sortKey={sortKey}
            setSortKey={setSortKey}
            searchActive={search.trim() !== ''}
            totalCount={habits.length}
            scrollRef={boardScrollRef}
            onToday={goToday}
          />

          <DayPanel
            habits={habits}
            checks={checks}
            todayStr={todayStr}
            focusDate={focusDate}
            setFocusDate={setFocusDate}
            onToggleDone={toggleDone}
            onSetCell={setCell}
            onMarkAll={markAllDone}
            onClearDay={clearDay}
            onSelectHabit={setSelectedHabitId}
            showToast={showToast}
          />
          </div>
        </section>

        {/* 02 — weekly analysis */}
        <section aria-label="Weekly analysis" className="mt-10">
          <SectionHead
            index="02"
            title="Weekly analysis"
            desc="How the last 7 days went — momentum, streaks and weekly targets."
          />
          <div className="mt-4">
            <StatCards
              overall={overall}
              best={bestStreakHabit}
              daysCount={days.length}
              habitsCount={habits.length}
              monthLabel={`${MONTH_NAMES[viewMonth]} ${viewYear}`}
            />
          </div>
          <div className="mt-4">
            <WeeklyAnalysis
              habits={habits}
              checks={checks}
              todayStr={todayStr}
              focusDate={focusDate}
              setFocusDate={setFocusDate}
              statsByHabit={statsByHabit}
              onSelectHabit={setSelectedHabitId}
              onEdit={openEdit}
            />
          </div>
        </section>

        <footer className="mt-8 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-neutral-200 bg-white px-5 py-4">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[12px] text-ink/60">
            <LegendDot className="bg-ink text-white" label="Done — click a box to tick" icon={<Check size={11} strokeWidth={3.5} />} />
            <LegendDot className="cell-skipped border-ink/25 text-ink/60" label="Skipped — click again" icon={<Minus size={12} strokeWidth={3} />} />
            <LegendDot className="bg-white text-ink/30" label="Open — right-click clears" icon={<Plus size={11} strokeWidth={3} />} />
            <LegendDot className="cell-future text-ink/25" label="Future day" icon={<CircleDashed size={12} />} />
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={exportCSV}
              className="inline-flex items-center gap-1.5 rounded-full border border-neutral-200 bg-white px-3.5 py-2 text-[12px] font-semibold hover:border-neutral-400 transition-colors"
            >
              <Download size={14} /> Export CSV
            </button>
            <button
              onClick={resetDemo}
              className="inline-flex items-center gap-1.5 rounded-full border border-neutral-200 bg-white px-3.5 py-2 text-[12px] font-semibold hover:border-neutral-400 transition-colors"
            >
              <RotateCcw size={14} /> Reset demo
            </button>
          </div>
        </footer>
        <p className="mt-3 text-center text-[12px] text-ink/35">
          Your ticks are saved in this browser — no account needed
        </p>
      </main>

      {/* habit drawer */}
      <AnimatePresence>
        {selectedHabit && (
          <HabitDrawer
            key="drawer"
            habit={selectedHabit}
            checks={checks}
            days={days}
            todayStr={todayStr}
            stats={statsByHabit.get(selectedHabit.id)}
            onClose={() => setSelectedHabitId(null)}
            onToggle={toggleDone}
            onEdit={() => openEdit(selectedHabit)}
            onDelete={() => deleteHabit(selectedHabit.id)}
            onMove={(dir) => moveHabit(selectedHabit.id, dir)}
          />
        )}
      </AnimatePresence>

      {/* add / edit modal */}
      <AnimatePresence>
        {modalOpen && (
          <HabitModal
            key="modal"
            initial={editingHabit}
            onClose={() => setModalOpen(false)}
            onSave={saveHabit}
            onDelete={editingHabit ? () => deleteHabit(editingHabit.id) : undefined}
          />
        )}
      </AnimatePresence>

      {/* toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.97 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[80] flex items-center gap-2 rounded-full bg-ink px-5 py-3 text-cream shadow-2xl"
          >
            <Check size={16} strokeWidth={3} className="text-[#d7f542]" />
            <span className="text-[13px] font-semibold whitespace-nowrap">{toast}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ================================ TopBar ================================ */

function TopBar(props: {
  todayStr: string;
  viewYear: number;
  viewMonth: number;
  onNav: (d: number) => void;
  onToday: () => void;
  isCurrentMonth: boolean;
  boardMode: BoardMode;
  setBoardMode: (m: BoardMode) => void;
  search: string;
  setSearch: (s: string) => void;
  onAdd: () => void;
}) {
  return (
    <header className="sticky top-0 z-40 border-b border-neutral-200 bg-white/90 backdrop-blur-md">
      <div className="mx-auto w-full max-w-[1440px] px-4 sm:px-6 py-3 flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2.5 mr-1">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-ink">
            <Check size={18} strokeWidth={3} className="text-white" />
          </div>
          <div className="leading-none">
            <p className="font-display font-extrabold text-[19px] tracking-tight">Ticked</p>
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink/45">habit board</p>
          </div>
        </div>

        {/* month switcher */}
        <div className="flex items-center gap-1 rounded-full border border-neutral-200 bg-white p-1">
          <button onClick={() => props.onNav(-1)} className="grid h-8 w-8 place-items-center rounded-full hover:bg-neutral-100 transition-colors" aria-label="Previous month">
            <ChevronLeft size={17} />
          </button>
          <div className="min-w-[150px] text-center">
            <p className="font-display font-bold text-[15px] leading-none">
              {MONTH_NAMES[props.viewMonth]} {props.viewYear}
            </p>
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink/45 mt-0.5">
              {!props.isCurrentMonth ? 'browsing' : 'current month'}
            </p>
          </div>
          <button onClick={() => props.onNav(1)} className="grid h-8 w-8 place-items-center rounded-full hover:bg-neutral-100 transition-colors" aria-label="Next month">
            <ChevronRight size={17} />
          </button>
        </div>

        {!props.isCurrentMonth && (
          <button onClick={props.onToday} className="rounded-full bg-ink px-3.5 py-2 text-[12px] font-bold text-white hover:bg-neutral-800 transition">
            Back to today
          </button>
        )}

        <div className="flex-1" />

        {/* board mode */}
        <div className="flex items-center rounded-full border border-neutral-200 bg-white p-1 text-[12px] font-semibold">
          <button
            onClick={() => props.setBoardMode('habits')}
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 transition ${props.boardMode === 'habits' ? 'bg-ink text-cream' : 'text-ink/55 hover:text-ink'}`}
          >
            <Rows3 size={14} /> Habits as rows
          </button>
          <button
            onClick={() => props.setBoardMode('days')}
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 transition ${props.boardMode === 'days' ? 'bg-ink text-cream' : 'text-ink/55 hover:text-ink'}`}
          >
            <Columns3 size={14} /> Days as rows
          </button>
        </div>

        <label className="hidden md:flex items-center gap-2 rounded-full border border-neutral-200 bg-white px-3.5 py-2 w-48 focus-within:border-neutral-400 transition-colors">
          <Search size={15} className="text-ink/40 shrink-0" />
          <input
            value={props.search}
            onChange={(e) => props.setSearch(e.target.value)}
            placeholder="Filter habits…"
            className="w-full bg-transparent text-[13px] placeholder:text-ink/35"
          />
          {props.search && (
            <button onClick={() => props.setSearch('')} aria-label="Clear search"><X size={14} className="text-ink/40" /></button>
          )}
        </label>

        <button
          onClick={props.onAdd}
          className="inline-flex items-center gap-1.5 rounded-full bg-ink px-4 py-2.5 text-[13px] font-bold text-white transition-colors hover:bg-neutral-800"
        >
          <Plus size={16} strokeWidth={3} /> New habit
        </button>
      </div>
      {/* mobile search */}
      <div className="md:hidden px-4 pb-3">
        <label className="flex items-center gap-2 rounded-full border border-neutral-200 bg-white px-3.5 py-2 focus-within:border-neutral-400">
          <Search size={15} className="text-ink/40 shrink-0" />
          <input
            value={props.search}
            onChange={(e) => props.setSearch(e.target.value)}
            placeholder="Filter habits…"
            className="w-full bg-transparent text-[13px] placeholder:text-ink/35"
          />
        </label>
      </div>
    </header>
  );
}

/* =============================== StatCards =============================== */

function StatCards(props: {
  overall: ReturnType<typeof calcOverall>;
  best: { habit: Habit; n: number } | null;
  daysCount: number;
  habitsCount: number;
  monthLabel: string;
}) {
  const { overall } = props;
  const cards = [
    {
      icon: <Target size={17} />,
      chip: 'bg-neutral-100 text-ink',
      label: `${props.monthLabel} completion`,
      big: `${overall.pct}%`,
      sub: `${overall.done} of ${overall.total} ticks logged`,
      bar: overall.pct,
      barColor: '#1c1a17',
    },
    {
      icon: <Flame size={17} />,
      chip: 'bg-neutral-100 text-ink',
      label: 'Longest active chain',
      big: props.best ? `${props.best.n} day${props.best.n === 1 ? '' : 's'}` : '—',
      sub: props.best ? props.best.habit.name : 'Tick a habit to start a chain',
      bar: props.best ? Math.min(100, (props.best.n / 16) * 100) : 0,
      barColor: '#18181b',
    },
    {
      icon: <Trophy size={17} />,
      chip: 'bg-neutral-100 text-ink',
      label: 'Perfect days',
      big: `${overall.perfectDays}`,
      sub: overall.perfectDays === 1 ? 'day with every box ticked' : 'days with every box ticked',
      bar: overall.elapsedDays ? Math.round((overall.perfectDays / overall.elapsedDays) * 100) : 0,
      barColor: '#52525b',
    },
    {
      icon: <Zap size={17} />,
      chip: 'bg-neutral-100 text-ink',
      label: 'Month momentum',
      big: `${overall.checkins}`,
      sub: `${overall.remainingDays} day${overall.remainingDays === 1 ? '' : 's'} left · ${props.habitsCount} habits`,
      bar: overall.elapsedDays && props.daysCount ? Math.round((overall.elapsedDays / props.daysCount) * 100) : 0,
      barColor: '#71717a',
    },
  ];
  return (
    <div className="mt-5 grid grid-cols-2 xl:grid-cols-4 gap-3">
      {cards.map((c, i) => (
        <motion.div
          key={c.label}
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.06, duration: 0.4, ease: 'easeOut' }}
          className="rounded-2xl border border-neutral-200 bg-white p-4 sm:p-5"
        >
          <div className="flex items-center gap-2">
            <span className={`grid h-8 w-8 place-items-center rounded-lg ${c.chip}`}>{c.icon}</span>
            <p className="text-[11px] font-medium text-ink/50 leading-tight">{c.label}</p>
          </div>
          <p className="font-display font-semibold text-3xl sm:text-4xl tracking-tight mt-2 tabular">{c.big}</p>
          <p className="text-[12px] text-ink/55 mt-0.5 truncate">{c.sub}</p>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-ink/10">
            <motion.div
              className="h-full rounded-full"
              style={{ background: c.barColor }}
              initial={{ width: 0 }}
              animate={{ width: `${c.bar}%` }}
              transition={{ duration: 0.7, ease: 'easeOut', delay: 0.15 + i * 0.06 }}
            />
          </div>
        </motion.div>
      ))}
    </div>
  );
}

/* ============================= Section header ============================= */

function SectionHead({ index, title, desc }: { index: string; title: string; desc: string }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3 border-b border-neutral-200 pb-3">
      <div className="flex items-center gap-3">
        <span className="grid h-9 w-9 place-items-center rounded-lg bg-ink text-[12px] font-bold text-white tabular">
          {index}
        </span>
        <div>
          <h2 className="font-display text-[20px] leading-none font-semibold tracking-tight">{title}</h2>
          <p className="mt-1 text-[12.5px] text-ink/50">{desc}</p>
        </div>
      </div>
    </div>
  );
}

/* ================================= Board ================================= */

function LegendDot(props: { className: string; label: string; icon: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`grid h-5 w-5 place-items-center rounded-md border border-ink/15 ${props.className}`}>{props.icon}</span>
      {props.label}
    </span>
  );
}

function Board(props: {
  mode: BoardMode;
  habits: Habit[];
  allHabits: Habit[];
  days: Date[];
  checks: ChecksMap;
  todayStr: string;
  focusDate: string;
  setFocusDate: (s: string) => void;
  statsByHabit: Map<string, ReturnType<typeof calcHabitStats>>;
  onCycle: (hid: string, ds: string) => void;
  onClear: (hid: string, ds: string) => void;
  onSelectHabit: (id: string) => void;
  selectedHabitId: string | null;
  sortKey: SortKey;
  setSortKey: (s: SortKey) => void;
  searchActive: boolean;
  totalCount: number;
  scrollRef: React.RefObject<HTMLDivElement | null>;
  onToday: () => void;
}) {
  const { days, habits, todayStr } = props;

  const dayPct = useMemo(() => {
    const m = new Map<string, number>();
    for (const d of days) {
      const ds = toDateStr(d);
      m.set(ds, calcDayPct(ds, props.allHabits, props.checks));
    }
    return m;
  }, [days, props.allHabits, props.checks]);

  return (
    <section className="rounded-2xl border border-line bg-white overflow-hidden">
      {/* toolbar */}
      <div className="flex flex-wrap items-center gap-2 px-4 sm:px-5 py-3.5 border-b border-line">
        <div className="flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-ink text-white">
            <LayoutGrid size={16} />
          </span>
          <div className="leading-tight">
            <p className="font-display font-bold text-[15px]">Board</p>
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink/45">
              {props.totalCount} habits · {days.length} days · click a box to tick
            </p>
          </div>
        </div>
        <div className="flex-1" />
        <div className="flex items-center gap-1.5 text-[12px] font-semibold">
          <span className="hidden sm:inline text-ink/45 font-mono uppercase tracking-wider text-[10px]">Sort</span>
          {(['custom', 'streak', 'completion', 'name'] as SortKey[]).map((k) => (
            <button
              key={k}
              onClick={() => props.setSortKey(k)}
              className={`rounded-full px-3 py-1.5 capitalize transition ${props.sortKey === k ? 'bg-ink text-white' : 'text-ink/55 hover:bg-neutral-100'}`}
            >
              {k}
            </button>
          ))}
        </div>
      </div>

      {habits.length === 0 ? (
        <div className="px-6 py-16 text-center">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-ink/5">
            <Search size={22} className="text-ink/40" />
          </div>
          <p className="font-display font-bold text-xl mt-4">No habits match your filter</p>
          <p className="text-[13px] text-ink/55 mt-1">Try a different search, or add a brand-new habit to the board.</p>
        </div>
      ) : props.mode === 'habits' ? (
        <HabitsRowsBoard {...props} dayPct={dayPct} />
      ) : (
        <DaysRowsBoard {...props} dayPct={dayPct} />
      )}
    </section>
  );
}

/* ------------------------- Habits-as-rows (default) ------------------------ */

function HabitsRowsBoard(props: {
  habits: Habit[];
  days: Date[];
  checks: ChecksMap;
  todayStr: string;
  focusDate: string;
  setFocusDate: (s: string) => void;
  statsByHabit: Map<string, ReturnType<typeof calcHabitStats>>;
  onCycle: (hid: string, ds: string) => void;
  onClear: (hid: string, ds: string) => void;
  onSelectHabit: (id: string) => void;
  selectedHabitId: string | null;
  dayPct: Map<string, number>;
  scrollRef: React.RefObject<HTMLDivElement | null>;
  onToday: () => void;
}) {
  const { habits, days, todayStr } = props;
  const cols = `minmax(228px,272px) repeat(${days.length},46px) 74px`;

  return (
    <div ref={props.scrollRef} className="overflow-auto nice-scroll max-h-[66vh]">
      <div className="min-w-max" style={{ display: 'grid', gridTemplateColumns: cols }}>
        {/* header */}
        <div className="contents">
          <div className="sticky left-0 top-0 z-30 bg-white border-b border-line px-4 py-3 flex items-end">
            <p className="text-[11px] font-medium text-ink/45">To do</p>
          </div>
          {days.map((d) => (
            <DayHead
              key={toDateStr(d)}
              d={d}
              todayStr={todayStr}
              focusDate={props.focusDate}
              onFocus={() => props.setFocusDate(toDateStr(d))}
            />
          ))}
          <div className="sticky top-0 z-20 bg-white border-b border-line px-2 py-3 text-center">
            <p className="text-[11px] font-medium text-ink/45">Total</p>
          </div>
        </div>

        {/* rows */}
        {habits.map((h, ri) => {
          const st = props.statsByHabit.get(h.id);
          const selected = props.selectedHabitId === h.id;
          return (
            <div key={h.id} className="contents group">
              <button
                onClick={() => props.onSelectHabit(h.id)}
                className={`sticky left-0 z-10 text-left border-b border-line/70 px-3 py-2 bg-white transition-colors ${selected ? 'bg-neutral-100' : 'group-hover:bg-neutral-50'}`}
                style={{ animationDelay: `${ri * 20}ms` }}
              >
                <div className="flex items-center gap-2.5">
                  <span
                    className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-ink text-white"
                  >
                    <HabitGlyph k={h.icon} size={19} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13.5px] font-bold leading-tight">{h.name}</span>
                    <span className="mt-0.5 flex items-center gap-1.5">
                      {st && st.currentStreak > 0 ? (
                        <span className="inline-flex items-center gap-0.5 rounded-full bg-neutral-100 px-1.5 py-px text-[10px] font-semibold text-ink/60">
                          <Flame size={10} strokeWidth={2.8} /> {st.currentStreak}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-0.5 rounded-full bg-neutral-100 px-1.5 py-px text-[10px] font-medium text-ink/40">
                          <Flame size={10} /> 0
                        </span>
                      )}
                      <span className="text-[11px] font-medium text-ink/45 tabular">{st?.pct ?? 0}%</span>
                    </span>
                  </span>
                </div>
              </button>

              {days.map((d) => {
                const ds = toDateStr(d);
                return (
                  <div
                    key={ds}
                    className={`border-b border-line/60 px-0 py-2 grid place-items-center bg-white ${selected ? 'bg-neutral-100' : 'group-hover:bg-neutral-50'} ${ds === todayStr ? 'bg-neutral-50' : ''}`}
                  >
                    <TickCell
                      habit={h}
                      dateStr={ds}
                      status={props.checks[checkKey(h.id, ds)]}
                      future={ds > todayStr}
                      isToday={ds === todayStr}
                      focused={ds === props.focusDate}
                      onCycle={() => props.onCycle(h.id, ds)}
                      onClear={() => props.onClear(h.id, ds)}
                    />
                  </div>
                );
              })}

              <div className={`border-b border-line/70 px-2 py-2 grid place-items-center bg-white ${selected ? 'bg-neutral-100' : 'group-hover:bg-neutral-50'}`}>
                <ProgressRing value={st?.pct ?? 0} size={44} stroke={5} bar="#18181b">
                  <span className="font-mono text-[10px] font-bold tabular">{st?.pct ?? 0}</span>
                </ProgressRing>
              </div>
            </div>
          );
        })}

        {/* footer: day completion */}
        <div className="contents">
          <div className="sticky left-0 z-10 bg-white px-4 py-3 border-t border-line">
            <p className="text-[11px] font-medium text-ink/45">Day total</p>
          </div>
          {days.map((d) => {
            const ds = toDateStr(d);
            const p = props.dayPct.get(ds) ?? 0;
            const future = ds > todayStr;
            return (
              <button
                key={ds}
                onClick={() => props.setFocusDate(ds)}
                className={`border-t border-line px-0 py-2.5 flex flex-col items-center gap-1 bg-white transition-colors hover:bg-neutral-50 ${ds === props.focusDate ? 'bg-neutral-100' : ''}`}
                title={`${prettyLong(ds)} — ${p}%`}
              >
                <span className={`font-mono text-[10px] font-bold tabular ${future ? 'text-ink/25' : p === 100 ? 'text-emerald-700' : 'text-ink/60'}`}>
                  {future ? '·' : `${p}`}
                </span>
                <span className="h-6 w-1.5 overflow-hidden rounded-full bg-ink/10 flex items-end">
                  {!future && <span className={`w-full rounded-full ${p === 100 ? 'bg-emerald-500' : 'bg-ink'}`} style={{ height: `${p}%` }} />}
                </span>
              </button>
            );
          })}
          <div className="bg-white border-t border-line" />
        </div>
      </div>
    </div>
  );
}

/* ------------------------------ Day column head ----------------------------- */

function DayHead({ d, todayStr, focusDate, onFocus }: { d: Date; todayStr: string; focusDate: string; onFocus: () => void }) {
  const ds = toDateStr(d);
  const isToday = ds === todayStr;
  const future = ds > todayStr;
  const focused = ds === focusDate;
  return (
    <button
      onClick={onFocus}
      data-today-col={isToday ? 'true' : undefined}
      className={`sticky top-0 z-20 border-b border-line bg-white px-0 py-2 flex flex-col items-center gap-0.5 transition-colors hover:bg-neutral-50 ${focused ? 'bg-neutral-100' : ''}`}
      title={prettyLong(ds)}
    >
      <span className="text-[10px] font-semibold uppercase tracking-wide text-ink/40">
        {WEEKDAY_LETTER[d.getDay()]}
      </span>
      <span className={`grid h-7 w-7 place-items-center rounded-md text-[12px] font-semibold tabular ${isToday ? 'bg-ink text-white' : future ? 'text-ink/30' : 'text-ink'}`}>
        {d.getDate()}
      </span>
    </button>
  );
}

/* --------------------------- Days-as-rows (flipped) -------------------------- */

function DaysRowsBoard(props: {
  habits: Habit[];
  days: Date[];
  checks: ChecksMap;
  todayStr: string;
  focusDate: string;
  setFocusDate: (s: string) => void;
  statsByHabit: Map<string, ReturnType<typeof calcHabitStats>>;
  onCycle: (hid: string, ds: string) => void;
  onClear: (hid: string, ds: string) => void;
  onSelectHabit: (id: string) => void;
  dayPct: Map<string, number>;
  scrollRef: React.RefObject<HTMLDivElement | null>;
}) {
  const { habits, days, todayStr } = props;
  const cols = `minmax(168px,208px) repeat(${habits.length},56px) 74px`;
  return (
    <div ref={props.scrollRef} className="overflow-auto nice-scroll max-h-[66vh]">
      <div className="min-w-max" style={{ display: 'grid', gridTemplateColumns: cols }}>
        <div className="contents">
          <div className="sticky left-0 top-0 z-30 bg-white border-b border-line px-4 py-3 flex items-end">
            <p className="text-[11px] font-medium text-ink/45">Days</p>
          </div>
          {habits.map((h) => (
            <button
              key={h.id}
              onClick={() => props.onSelectHabit(h.id)}
              className="sticky top-0 z-20 bg-white border-b border-line px-0 py-2 flex flex-col items-center gap-1 hover:bg-neutral-50 transition-colors"
              title={h.name}
            >
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-ink text-white">
                <HabitGlyph k={h.icon} size={16} />
              </span>
              <span className="max-w-[52px] truncate text-[10px] font-bold">{h.name.split(' ')[0]}</span>
            </button>
          ))}
          <div className="sticky top-0 z-20 bg-white border-b border-line px-2 py-3 text-center">
            <p className="text-[11px] font-medium text-ink/45">Total</p>
          </div>
        </div>

        {days.map((d) => {
          const ds = toDateStr(d);
          const isToday = ds === todayStr;
          const future = ds > todayStr;
          const focused = ds === props.focusDate;
          const p = props.dayPct.get(ds) ?? 0;
          return (
            <div key={ds} className="contents group">
              <button
                onClick={() => props.setFocusDate(ds)}
                className={`sticky left-0 z-10 text-left border-b border-line/70 px-4 py-2 bg-white transition-colors ${focused ? 'bg-neutral-100' : 'group-hover:bg-neutral-50'}`}
              >
                <span className="flex items-center gap-2">
                  <span className="grid h-9 w-9 place-items-center rounded-lg bg-ink/6 text-[13px] font-bold text-ink tabular">
                    {d.getDate()}
                  </span>
                  <span>
                    <span className="block text-[12.5px] font-bold leading-tight">
                      {isToday ? 'Today' : d.toLocaleDateString('en-US', { weekday: 'short' })}
                    </span>
                    <span className="font-mono text-[10px] text-ink/45">
                      {d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      {!future && ` · ${p}%`}
                    </span>
                  </span>
                </span>
              </button>
              {habits.map((h) => (
                <div key={h.id} className={`border-b border-line/60 grid place-items-center py-2 bg-white ${focused ? 'bg-neutral-100' : 'group-hover:bg-neutral-50'}`}>
                  <TickCell
                    habit={h}
                    dateStr={ds}
                    status={props.checks[checkKey(h.id, ds)]}
                    future={future}
                    isToday={isToday}
                    focused={focused}
                    onCycle={() => props.onCycle(h.id, ds)}
                    onClear={() => props.onClear(h.id, ds)}
                  />
                </div>
              ))}
              <div className={`border-b border-line/70 grid place-items-center py-2 bg-white ${focused ? 'bg-neutral-100' : 'group-hover:bg-neutral-50'}`}>
                <span className={`font-mono text-[11px] font-bold tabular ${future ? 'text-ink/25' : 'text-ink/60'}`}>
                  {future ? '·' : `${p}%`}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* --------------------------------- TickCell -------------------------------- */

function TickCell(props: {
  habit: Habit;
  dateStr: string;
  status?: 'done' | 'skipped';
  future: boolean;
  isToday: boolean;
  focused: boolean;
  onCycle: () => void;
  onClear: () => void;
}) {
  const { status, future, habit } = props;
  const label = `${habit.name} — ${prettyLong(props.dateStr)}: ${status ?? 'open'}. Click to tick.`;
  if (future) {
    return (
      <span className="cell-future grid h-7 w-7 place-items-center rounded-md border border-ink/8 opacity-70" title="Future day">
        <span className="h-1 w-1 rounded-full bg-ink/25" />
      </span>
    );
  }
  if (status === 'done') {
    return (
      <motion.button
        whileTap={{ scale: 0.78 }}
        onClick={props.onCycle}
        onContextMenu={(e) => { e.preventDefault(); props.onClear(); }}
        title={label}
        aria-label={label}
        className={`grid h-7 w-7 place-items-center rounded-md bg-ink text-white ${props.focused ? 'ring-2 ring-ink ring-offset-2 ring-offset-white' : ''}`}
      >
        <motion.span initial={{ scale: 0.4 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 600, damping: 22 }}>
          <Check size={15} strokeWidth={3.5} />
        </motion.span>
      </motion.button>
    );
  }
  if (status === 'skipped') {
    return (
      <motion.button
        whileTap={{ scale: 0.82 }}
        onClick={props.onCycle}
        onContextMenu={(e) => { e.preventDefault(); props.onClear(); }}
        title={label}
        aria-label={label}
        className={`cell-skipped grid h-7 w-7 place-items-center rounded-md border border-ink/15 text-ink/45 hover:border-ink/40 ${props.focused ? 'ring-2 ring-ink/40 ring-offset-2 ring-offset-white' : ''}`}
      >
        <Minus size={15} strokeWidth={3} />
      </motion.button>
    );
  }
  return (
    <motion.button
      whileTap={{ scale: 0.82 }}
      whileHover={{ scale: 1.06 }}
      onClick={props.onCycle}
      onContextMenu={(e) => { e.preventDefault(); props.onClear(); }}
      title={label}
      aria-label={label}
      className={`group/cell grid h-7 w-7 place-items-center rounded-md border bg-white transition-colors ${props.isToday ? 'border-ink/45 hover:border-ink' : 'border-ink/12 hover:border-ink/50'} ${props.focused ? 'ring-2 ring-ink/40 ring-offset-2 ring-offset-white' : ''}`}
    >
      <Plus size={14} strokeWidth={2.6} className="text-ink/0 group-hover/cell:text-ink/45 transition-colors" />
    </motion.button>
  );
}

/* ------------------------------ DayPanel (section 01) ------------------------------ */

function DayPanel(props: {
  habits: Habit[];
  checks: ChecksMap;
  todayStr: string;
  focusDate: string;
  setFocusDate: (s: string) => void;
  onToggleDone: (hid: string, ds: string) => void;
  onSetCell: (hid: string, ds: string, v: 'done' | 'skipped' | null) => void;
  onMarkAll: (ds: string) => void;
  onClearDay: (ds: string) => void;
  onSelectHabit: (id: string) => void;
  showToast: (m: string) => void;
}) {
  const { focusDate, todayStr, habits, checks } = props;
  const focusD = parseDateStr(focusDate);
  const isFuture = focusDate > todayStr;
  const isToday = focusDate === todayStr;

  const dayHabits = habits;
  const doneCount = dayHabits.filter((h) => checks[checkKey(h.id, focusDate)] === 'done').length;
  const skippedCount = dayHabits.filter((h) => checks[checkKey(h.id, focusDate)] === 'skipped').length;
  const counted = Math.max(0, dayHabits.length - skippedCount);
  const pct = counted === 0 ? (dayHabits.length === 0 ? 0 : 100) : Math.round((doneCount / counted) * 100);
  const perfect = dayHabits.length > 0 && counted > 0 && doneCount === counted;

  const stepDay = (dir: -1 | 1) => {
    const d = new Date(focusD);
    d.setDate(d.getDate() + dir);
    props.setFocusDate(toDateStr(d));
  };

  return (
    <aside className="flex flex-col gap-4 xl:sticky xl:top-[76px]">
      <section className="rounded-2xl border border-neutral-200 bg-white p-5">
        <div className="flex items-center justify-between">
          <p className="text-[11px] font-medium text-ink/45">
            {isToday ? 'Today' : 'Selected day'}
          </p>
          <div className="flex items-center gap-1">
            <button onClick={() => stepDay(-1)} className="grid h-7 w-7 place-items-center rounded-full hover:bg-neutral-100 transition" aria-label="Previous day">
              <ChevronLeft size={15} />
            </button>
            <button onClick={() => stepDay(1)} className="grid h-7 w-7 place-items-center rounded-full hover:bg-neutral-100 transition" aria-label="Next day">
              <ChevronRight size={15} />
            </button>
          </div>
        </div>

        <h2 className="font-display font-semibold text-[20px] leading-tight mt-1">
          {isToday ? 'Today' : focusD.toLocaleDateString('en-US', { weekday: 'long' })}
          <span className="block text-[12.5px] font-sans font-normal text-ink/50">
            {prettyLong(focusDate)}{!isToday && !isFuture && ` · ${Math.max(0, Math.round((parseDateStr(todayStr).getTime() - focusD.getTime()) / 86400000))}d ago`}
          </span>
        </h2>

        <div className="mt-3 flex items-center gap-4">
          <ProgressRing value={isFuture ? 0 : pct} size={80} stroke={8} track="rgba(24,24,27,0.1)" bar="#18181b">
            <span className="text-[16px] font-semibold tabular">{isFuture ? '–' : `${pct}%`}</span>
          </ProgressRing>
          <div className="text-[12.5px] leading-relaxed text-ink/55">
            {isFuture ? (
              <p>This day hasn’t happened yet.<br />Boxes unlock at midnight.</p>
            ) : perfect ? (
              <p className="font-semibold text-ink">Perfect day.<br /><span className="font-normal text-ink/55">Every box ticked.</span></p>
            ) : (
              <p><span className="font-semibold text-ink tabular">{doneCount}/{counted}</span> habits ticked{skippedCount > 0 && ` · ${skippedCount} skipped`}.<br />{counted - doneCount} to go — one tap each.</p>
            )}
          </div>
        </div>

        {!isFuture && (
          <div className="mt-4 flex flex-col gap-1.5 max-h-[300px] overflow-auto nice-scroll pr-0.5">
            {dayHabits.map((h) => {
              const st = checks[checkKey(h.id, focusDate)];
              const done = st === 'done';
              const skipped = st === 'skipped';
              return (
                <div
                  key={h.id}
                  className={`flex items-center gap-2.5 rounded-xl border px-2.5 py-2 transition ${done ? 'border-ink bg-neutral-100' : skipped ? 'border-neutral-200 opacity-60' : 'border-neutral-200 hover:border-neutral-400'}`}
                >
                  <button
                    onClick={() => props.onToggleDone(h.id, focusDate)}
                    aria-label={`Tick ${h.name}`}
                    className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg transition-all ${done ? 'bg-ink text-white' : 'border border-neutral-300 hover:border-neutral-500'}`}
                  >
                    {done ? <Check size={16} strokeWidth={3} /> : skipped ? <Minus size={14} className="text-ink/40" /> : <span className="h-1.5 w-1.5 rounded-full bg-neutral-300" />}
                  </button>
                  <button onClick={() => props.onSelectHabit(h.id)} className="min-w-0 flex-1 text-left">
                    <span className={`block truncate text-[13px] font-semibold leading-tight ${skipped ? 'line-through text-ink/40' : ''}`}>{h.name}</span>
                    <span className="block truncate text-[11px] text-ink/45">{h.note || 'No note'}</span>
                  </button>
                  <button
                    onClick={() => props.onSetCell(h.id, focusDate, skipped ? null : 'skipped')}
                    title={skipped ? 'Un-skip' : 'Skip this day (rest / travel)'}
                    className={`rounded-full px-2 py-1 text-[10px] font-semibold transition ${skipped ? 'bg-neutral-200 text-ink' : 'text-ink/35 hover:text-ink hover:bg-neutral-100'}`}
                  >
                    {skipped ? 'unskip' : 'skip'}
                  </button>
                </div>
              );
            })}
            {dayHabits.length === 0 && (
              <p className="text-[12px] text-ink/45 py-4 text-center">No habits yet — add your first one.</p>
            )}
          </div>
        )}

        {!isFuture && dayHabits.length > 0 && (
          <div className="mt-3 flex gap-2">
            <button
              onClick={() => props.onMarkAll(focusDate)}
              className="flex-1 rounded-full bg-ink py-2.5 text-[12.5px] font-semibold text-white hover:bg-neutral-800 active:scale-[0.98] transition"
            >
              Tick all
            </button>
            <button
              onClick={() => { props.onClearDay(focusDate); props.showToast('Day cleared'); }}
              className="rounded-full border border-neutral-200 px-4 py-2.5 text-[12.5px] font-semibold text-ink/60 hover:border-neutral-400 hover:text-ink transition"
            >
              Clear
            </button>
          </div>
        )}

        {!isToday && (
          <button onClick={() => props.setFocusDate(todayStr)} className="mt-2 w-full text-center text-[11px] font-medium text-ink/45 hover:text-ink transition">
            Back to today
          </button>
        )}
      </section>
    </aside>
  );
}

/* --------------------------- WeeklyAnalysis (section 02) --------------------------- */

function WeeklyAnalysis(props: {
  habits: Habit[];
  checks: ChecksMap;
  todayStr: string;
  focusDate: string;
  setFocusDate: (s: string) => void;
  statsByHabit: Map<string, ReturnType<typeof calcHabitStats>>;
  onSelectHabit: (id: string) => void;
  onEdit: (h: Habit) => void;
}) {
  const { habits, checks, todayStr, focusDate } = props;

  // last 7 days ending today
  const last7 = useMemo(() => {
    const t = parseDateStr(todayStr);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(t);
      d.setDate(d.getDate() - (6 - i));
      return d;
    });
  }, [todayStr]);

  const ranked = useMemo(() => {
    return [...habits]
      .map((h) => ({ h, s: props.statsByHabit.get(h.id) }))
      .sort((a, b) => (b.s?.currentStreak ?? 0) - (a.s?.currentStreak ?? 0))
      .slice(0, 5);
  }, [habits, props.statsByHabit]);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      {/* week */}
      <section className="rounded-2xl border border-neutral-200 bg-white p-5">
        <div className="flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-neutral-100 text-ink/60"><CalendarDays size={16} /></span>
          <div>
            <p className="font-display font-semibold text-[15px] leading-none">Last 7 days</p>
            <p className="text-[11px] text-ink/45 mt-0.5">Select a day to review it</p>
          </div>
        </div>
        <div className="mt-4 flex items-end justify-between gap-1.5">
          {last7.map((d) => {
            const ds = toDateStr(d);
            const p = calcDayPct(ds, habits, checks);
            const active = ds === focusDate;
            const isT = ds === todayStr;
            return (
              <button key={ds} onClick={() => props.setFocusDate(ds)} className="flex-1 flex flex-col items-center gap-1.5 group" title={`${prettyLong(ds)} — ${p}%`}>
                <span className={`text-[11px] font-medium tabular ${active ? 'text-ink' : 'text-ink/40'}`}>{p}</span>
                <span className="flex h-20 w-full items-end overflow-hidden rounded-lg bg-neutral-100">
                  <motion.span
                    initial={{ height: 0 }}
                    animate={{ height: `${p}%` }}
                    transition={{ duration: 0.5, ease: 'easeOut' }}
                    className={`w-full rounded-lg ${active ? 'bg-ink' : 'bg-neutral-400 group-hover:bg-neutral-500'} transition-colors`}
                  />
                </span>
                <span className={`text-[10px] font-semibold uppercase ${isT ? 'text-white bg-ink rounded px-1' : active ? 'text-ink' : 'text-ink/40'}`}>
                  {isT ? 'now' : WEEKDAY_LETTER[d.getDay()]}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {/* streaks */}
      <section className="rounded-2xl border border-neutral-200 bg-white p-5">
        <div className="flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-neutral-100 text-ink/60"><Flame size={16} /></span>
          <div>
            <p className="font-display font-semibold text-[15px] leading-none">Streaks</p>
            <p className="text-[11px] text-ink/45 mt-0.5">Longest active chains</p>
          </div>
        </div>
        <div className="mt-3 flex flex-col gap-1.5">
          {ranked.map(({ h, s }, i) => (
            <button
              key={h.id}
              onClick={() => props.onSelectHabit(h.id)}
              className="flex items-center gap-2.5 rounded-xl px-2.5 py-2 hover:bg-neutral-50 transition text-left"
            >
              <span className="text-[11px] font-medium text-ink/35 w-5">{i + 1}</span>
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-ink text-white shrink-0">
                <HabitGlyph k={h.icon} size={15} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[12.5px] font-semibold">{h.name}</span>
                <span className="block h-1.5 mt-1 overflow-hidden rounded-full bg-neutral-100">
                  <span className="block h-full rounded-full bg-ink" style={{ width: `${s?.pct ?? 0}%` }} />
                </span>
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-neutral-100 px-2 py-1 text-[11px] font-semibold text-ink/60 tabular">
                <Flame size={11} strokeWidth={2.8} />{s?.currentStreak ?? 0}
              </span>
            </button>
          ))}
          {ranked.length === 0 && <p className="text-[12px] text-ink/50 py-2 text-center">Add habits to start ranking chains.</p>}
        </div>
      </section>

      {/* weekly targets */}
      <section className="rounded-2xl border border-neutral-200 bg-white p-5">
        <div className="flex items-center gap-2">
          <Sparkles size={14} className="text-ink/45" />
          <p className="text-[11px] font-medium text-ink/45">Weekly target · last 7 days</p>
        </div>
        <div className="mt-3 flex flex-col gap-2.5">
          {habits.slice(0, 6).map((h) => {
            const target = h.weeklyTarget ?? 5;
            let n = 0;
            for (const d of last7) if (checks[checkKey(h.id, toDateStr(d))] === 'done') n++;
            return (
              <div key={h.id} className="flex items-center gap-2.5">
                <span className="w-28 truncate text-[12px] font-semibold">{h.name}</span>
                <div className="flex flex-1 gap-1">
                  {Array.from({ length: 7 }, (_, i) => (
                    <span key={i} className="h-2.5 flex-1 rounded-full" style={{ background: i < n ? '#18181b' : '#ececee' }} />
                  ))}
                </div>
                <span className="text-[11px] font-medium text-ink/50 tabular">{n}/{target}</span>
              </div>
            );
          })}
        </div>
        <button onClick={() => habits[0] && props.onEdit(habits[0])} className="mt-3 inline-flex items-center gap-1 text-[12px] font-semibold text-ink/55 hover:text-ink transition">
          <PenLine size={13} /> Edit targets
        </button>
      </section>
    </div>
  );
}

/* ------------------------------- Celebration ------------------------------ */

function Celebrate() {
  const pieces = useMemo(
    () =>
      Array.from({ length: 26 }, (_, i) => ({
        id: i,
        x: (Math.sin(i * 2.7) * 130).toFixed(0),
        y: (60 + ((i * 53) % 150)).toFixed(0),
        r: ((i * 137) % 360).toFixed(0),
        c: ['#d7f542', '#ff5a3c', '#0ea5e9', '#faf7ef', '#a855f7'][i % 5],
        d: (0.9 + (i % 5) * 0.18).toFixed(2),
        s: 5 + (i % 4) * 2,
      })),
    [],
  );
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {pieces.map((p) => (
        <motion.span
          key={p.id}
          initial={{ x: 0, y: 0, opacity: 1, rotate: 0 }}
          animate={{ x: Number(p.x), y: Number(p.y), opacity: 0, rotate: Number(p.r) }}
          transition={{ duration: Number(p.d) + 0.5, ease: 'easeOut', repeat: Infinity, repeatDelay: 1.6, delay: (p.id % 7) * 0.12 }}
          className="absolute left-1/2 top-1/3 rounded-[2px]"
          style={{ width: p.s, height: p.s * 0.6, background: p.c }}
        />
      ))}
    </div>
  );
}

/* -------------------------------- HabitDrawer ------------------------------ */

function HabitDrawer(props: {
  habit: Habit;
  checks: ChecksMap;
  days: Date[];
  todayStr: string;
  stats?: ReturnType<typeof calcHabitStats>;
  onClose: () => void;
  onToggle: (hid: string, ds: string) => void;
  onEdit: () => void;
  onDelete: () => void;
  onMove: (dir: -1 | 1) => void;
}) {
  const { habit, stats } = props;
  const last14 = useMemo(() => {
    const t = parseDateStr(props.todayStr);
    return Array.from({ length: 14 }, (_, i) => {
      const d = new Date(t);
      d.setDate(d.getDate() - (13 - i));
      return d;
    });
  }, [props.todayStr]);

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={props.onClose}
        className="fixed inset-0 z-50 bg-ink/35 backdrop-blur-[2px]"
      />
      <motion.aside
        initial={{ x: 420 }}
        animate={{ x: 0 }}
        exit={{ x: 420 }}
        transition={{ type: 'spring', stiffness: 320, damping: 34 }}
        className="fixed right-0 top-0 z-50 flex h-full w-full max-w-[400px] flex-col bg-cream shadow-2xl"
      >
        <div className="h-2.5 w-full" style={{ background: habit.color }} />
        <div className="flex items-start gap-3 p-5 pb-3">
          <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl text-cream shadow-[3px_3px_0_0_rgba(28,26,23,0.9)]" style={{ background: habit.color }}>
            <HabitGlyph k={habit.icon} size={26} />
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="font-display font-extrabold text-[20px] leading-tight">{habit.name}</h3>
            <p className="text-[12.5px] text-ink/55">{habit.note || 'No note yet.'}</p>
            <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.18em] text-ink/40">target {habit.weeklyTarget ?? 5}x / week</p>
          </div>
          <button onClick={props.onClose} className="grid h-9 w-9 place-items-center rounded-full hover:bg-ink/8 transition" aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div className="grid grid-cols-4 gap-2 px-5">
          {[
            { l: 'Score', v: `${stats?.pct ?? 0}%` },
            { l: 'Chain', v: `${stats?.currentStreak ?? 0}d` },
            { l: 'Best', v: `${stats?.bestStreak ?? 0}d` },
            { l: 'Ticks', v: `${stats?.done ?? 0}` },
          ].map((s) => (
            <div key={s.l} className="rounded-2xl border border-line bg-paper px-2 py-2.5 text-center">
              <p className="font-display font-extrabold text-[17px] tabular">{s.v}</p>
              <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-ink/45">{s.l}</p>
            </div>
          ))}
        </div>

        <div className="px-5 mt-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink/45 mb-2">Last 14 days — tap to tick</p>
          <div className="grid grid-cols-7 gap-1.5">
            {last14.map((d) => {
              const ds = toDateStr(d);
              const st = props.checks[checkKey(habit.id, ds)];
              const isT = ds === props.todayStr;
              return (
                <button
                  key={ds}
                  onClick={() => props.onToggle(habit.id, ds)}
                  title={`${prettyLong(ds)} — ${st ?? 'open'}`}
                  className={`flex flex-col items-center gap-1 rounded-xl border py-1.5 transition ${isT ? 'border-ink' : 'border-line'} ${st === 'done' ? '' : 'bg-paper hover:border-ink/40'}`}
                  style={st === 'done' ? { background: habit.color, borderColor: habit.color } : undefined}
                >
                  <span className={`font-mono text-[9px] font-bold ${st === 'done' ? 'text-cream/85' : 'text-ink/40'}`}>
                    {d.toLocaleDateString('en-US', { weekday: 'narrow' })}
                  </span>
                  <span className={`font-mono text-[12px] font-bold tabular ${st === 'done' ? 'text-cream' : ''}`}>{d.getDate()}</span>
                  {st === 'done'
                    ? <Check size={12} strokeWidth={3.5} className="text-cream" />
                    : st === 'skipped'
                      ? <Minus size={12} className="text-ink/40" />
                      : <span className="h-3 w-3 rounded-full border border-ink/20" />}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex-1" />

        <div className="border-t border-line p-4 flex flex-wrap gap-2">
          <button onClick={props.onEdit} className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-full bg-ink px-4 py-2.5 text-[13px] font-bold text-cream hover:brightness-110 transition">
            <PenLine size={14} /> Edit
          </button>
          <button onClick={() => props.onMove(-1)} className="grid h-10 w-10 place-items-center rounded-full border border-ink/15 hover:border-ink/50 transition" title="Move up" aria-label="Move up">
            <ArrowUp size={15} />
          </button>
          <button onClick={() => props.onMove(1)} className="grid h-10 w-10 place-items-center rounded-full border border-ink/15 hover:border-ink/50 transition" title="Move down" aria-label="Move down">
            <ArrowDown size={15} />
          </button>
          <button onClick={props.onDelete} className="grid h-10 w-10 place-items-center rounded-full border border-[#ff5a3c]/40 text-[#c2410c] hover:bg-[#ff5a3c]/10 transition" title="Delete habit" aria-label="Delete habit">
            <Trash2 size={15} />
          </button>
        </div>
      </motion.aside>
    </>
  );
}

/* -------------------------------- HabitModal ------------------------------- */

function HabitModal(props: {
  initial: Habit | null;
  onClose: () => void;
  onSave: (data: { name: string; note: string; icon: string; color: string; weeklyTarget: number }, id?: string) => void;
  onDelete?: () => void;
}) {
  const [name, setName] = useState(props.initial?.name ?? '');
  const [note, setNote] = useState(props.initial?.note ?? '');
  const [icon, setIcon] = useState(props.initial?.icon ?? 'spark');
  const [color, setColor] = useState(props.initial?.color ?? HABIT_COLORS[0]);
  const [target, setTarget] = useState(props.initial?.weeklyTarget ?? 5);
  const valid = name.trim().length > 0;

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={props.onClose}
        className="fixed inset-0 z-50 bg-ink/40 backdrop-blur-[3px] grid place-items-center p-4"
      >
        <motion.div
          initial={{ opacity: 0, y: 26, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 16, scale: 0.97 }}
          transition={{ type: 'spring', stiffness: 380, damping: 32 }}
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-[480px] rounded-[26px] bg-cream shadow-2xl overflow-hidden"
        >
          <div className="flex items-center justify-between bg-ink px-5 py-4 text-cream">
            <p className="font-display font-extrabold text-[17px]">{props.initial ? 'Edit habit' : 'New habit'}</p>
            <button onClick={props.onClose} className="grid h-8 w-8 place-items-center rounded-full hover:bg-cream/15 transition" aria-label="Close">
              <X size={17} />
            </button>
          </div>

          <div className="p-5 flex flex-col gap-4 max-h-[70vh] overflow-auto nice-scroll">
            <div className="flex items-center gap-3">
              <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl text-cream shadow-[3px_3px_0_0_rgba(28,26,23,0.9)]" style={{ background: color }}>
                <HabitGlyph k={icon} size={25} />
              </span>
              <div className="flex-1">
                <label className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink/45">Habit name</label>
                <input
                  autoFocus
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Read 20 pages"
                  maxLength={48}
                  className="mt-0.5 w-full rounded-xl border-2 border-ink/12 bg-paper px-3 py-2 text-[15px] font-bold placeholder:font-medium placeholder:text-ink/30 focus:border-ink transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink/45">Note (optional)</label>
              <input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="e.g. Before bed, no phone nearby"
                maxLength={80}
                className="mt-1 w-full rounded-xl border-2 border-ink/12 bg-paper px-3 py-2 text-[13.5px] font-medium placeholder:text-ink/30 focus:border-ink transition-colors"
              />
            </div>

            <div>
              <label className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink/45">Icon</label>
              <div className="mt-1.5 grid grid-cols-6 gap-1.5">
                {ICON_KEYS.map((k) => (
                  <button
                    key={k}
                    onClick={() => setIcon(k)}
                    title={ICON_LABELS[k]}
                    className={`grid h-11 place-items-center rounded-xl border-2 transition ${icon === k ? 'border-ink bg-ink text-[#d7f542]' : 'border-ink/10 bg-paper text-ink/60 hover:border-ink/40'}`}
                  >
                    <HabitGlyph k={k} size={18} />
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink/45">Tick color</label>
              <div className="mt-1.5 flex flex-wrap gap-2">
                {HABIT_COLORS.map((c) => (
                  <button
                    key={c}
                    onClick={() => setColor(c)}
                    aria-label={`Color ${c}`}
                    className={`h-9 w-9 rounded-full transition-transform hover:scale-110 ${color === c ? 'ring-[3px] ring-ink ring-offset-2 ring-offset-cream scale-110' : ''}`}
                    style={{ background: c }}
                  />
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between rounded-2xl border border-line bg-paper px-4 py-3">
              <div className="flex items-center gap-2">
                <ArrowLeftRight size={15} className="text-ink/45" />
                <div>
                  <p className="text-[13px] font-bold">Weekly target</p>
                  <p className="text-[11.5px] text-ink/50">How many days per week?</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => setTarget((t) => Math.max(1, t - 1))} className="grid h-8 w-8 place-items-center rounded-full border border-ink/15 font-bold hover:border-ink transition" aria-label="Decrease target">−</button>
                <span className="font-mono text-[16px] font-bold tabular w-6 text-center">{target}</span>
                <button onClick={() => setTarget((t) => Math.min(7, t + 1))} className="grid h-8 w-8 place-items-center rounded-full border border-ink/15 font-bold hover:border-ink transition" aria-label="Increase target">+</button>
              </div>
            </div>
          </div>

          <div className="flex gap-2 border-t border-line p-4">
            {props.onDelete && (
              <button onClick={props.onDelete} className="inline-flex items-center gap-1.5 rounded-full border border-[#ff5a3c]/40 px-4 py-2.5 text-[13px] font-bold text-[#c2410c] hover:bg-[#ff5a3c]/10 transition">
                <Trash2 size={14} /> Delete
              </button>
            )}
            <div className="flex-1" />
            <button onClick={props.onClose} className="rounded-full px-4 py-2.5 text-[13px] font-bold text-ink/55 hover:text-ink transition">
              Cancel
            </button>
            <button
              disabled={!valid}
              onClick={() => valid && props.onSave({ name: name.trim(), note: note.trim(), icon, color, weeklyTarget: target }, props.initial?.id)}
              className="inline-flex items-center gap-1.5 rounded-full bg-ink px-5 py-2.5 text-[13px] font-bold text-cream transition hover:brightness-110 disabled:opacity-35 disabled:pointer-events-none"
            >
              <Check size={15} strokeWidth={3} /> {props.initial ? 'Save changes' : 'Add to board'}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </>
  );
}