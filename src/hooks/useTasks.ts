import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DerivedTask, Metrics, Task } from '@/types';
import {
  computeAverageROI,
  computePerformanceGrade,
  computeRevenuePerHour,
  computeTimeEfficiency,
  computeTotalRevenue,
  withDerived,
  sortTasks as sortDerived,
} from '@/utils/logic';

import { generateSalesTasks } from '@/utils/seed';

interface UseTasksState {
  tasks: Task[];
  loading: boolean;
  error: string | null;
  derivedSorted: DerivedTask[];
  metrics: Metrics;
  lastDeleted: Task | null;
  addTask: (task: Omit<Task, 'id'> & { id?: string }) => void;
  updateTask: (id: string, patch: Partial<Task>) => void;
  deleteTask: (id: string) => void;
  undoDelete: () => void;
  clearLastDeleted: () => void;   // <--- NEW
}

const INITIAL_METRICS: Metrics = {
  totalRevenue: 0,
  totalTimeTaken: 0,
  timeEfficiencyPct: 0,
  revenuePerHour: 0,
  averageROI: 0,
  performanceGrade: 'Needs Improvement',
};

export function useTasks(): UseTasksState {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastDeleted, setLastDeleted] = useState<Task | null>(null);

  // Prevent double-fetch in StrictMode
  const fetchedRef = useRef(false);

  function normalizeTasks(input: any[]): Task[] {
  // Generate a stable timestamp from ID (e.g., t-2001 → 2001 → reproducible date)
  const stableDateFromId = (id: string) => {
    const num = Number(id.replace(/\D/g, "")) || 1;
    // Map number to a stable day in 2020 (without changing each reload)
    return new Date(2020, 0, (num % 28) + 1); 
  };

  return (Array.isArray(input) ? input : []).map((t) => {
    // Use real createdAt → else generate stable fallback
    const created = t.createdAt
      ? new Date(t.createdAt)
      : stableDateFromId(t.id ?? "");

    // Compute completedAt deterministically
    const completed =
      t.completedAt ||
      (t.status === "Done"
        ? new Date(created.getTime() + 24 * 3600 * 1000).toISOString()
        : undefined);

    return {
      id: t.id,
      title: t.title,
      revenue: Number(t.revenue) ?? 0,
      timeTaken: Number(t.timeTaken) > 0 ? Number(t.timeTaken) : 1,
      priority: t.priority,
      status: t.status,
      notes: t.notes,
      createdAt: created.toISOString(), // stable + reproducible
      completedAt: completed,
    } as Task;
  });
}

  // ----------------------------------------------------------
  // FIXED: Initial load (Bug 1)
  // ----------------------------------------------------------
  useEffect(() => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;

    let isMounted = true;

    async function load() {
      console.log("---- LOAD START ----");

      try {
        const res = await fetch('/tasks.json');
        if (!res.ok) throw new Error(`Failed to load tasks.json (${res.status})`);

        const data = await res.json();
        const normalized = normalizeTasks(data);

        const finalData =
          normalized.length > 0 ? normalized : generateSalesTasks(50);

        if (isMounted) {
          setTasks(finalData);
        }
      } catch (err: any) {
        console.error("LOAD ERROR:", err);
        if (isMounted) {
          setError(err?.message ?? 'Failed to load tasks');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
        console.log("---- LOAD END ----");
      }
    }

    load();

    return () => {
      isMounted = false;
    };
  }, []);

  // ----------------------------------------------------------
  // SORTED + METRICS
  // ----------------------------------------------------------
  const derivedSorted = useMemo<DerivedTask[]>(() => {
    const withRoi = tasks.map(withDerived);
    return sortDerived(withRoi);
  }, [tasks]);

  const metrics = useMemo<Metrics>(() => {
    if (tasks.length === 0) return INITIAL_METRICS;

    const totalRevenue = computeTotalRevenue(tasks);
    const totalTimeTaken = tasks.reduce((s, t) => s + t.timeTaken, 0);
    const timeEfficiencyPct = computeTimeEfficiency(tasks);
    const revenuePerHour = computeRevenuePerHour(tasks);
    const averageROI = computeAverageROI(tasks);
    const performanceGrade = computePerformanceGrade(averageROI);

    return {
      totalRevenue,
      totalTimeTaken,
      timeEfficiencyPct,
      revenuePerHour,
      averageROI,
      performanceGrade,
    };
  }, [tasks]);

  // ----------------------------------------------------------
  // CRUD OPERATIONS
  // ----------------------------------------------------------
  const addTask = useCallback((task: Omit<Task, 'id'> & { id?: string }) => {
    setTasks(prev => {
      const id = task.id ?? crypto.randomUUID();
      const timeTaken = task.timeTaken <= 0 ? 1 : task.timeTaken;

      const createdAt = new Date().toISOString();
      const status = task.status;
      const completedAt = status === 'Done' ? createdAt : undefined;

      return [...prev, { ...task, id, timeTaken, createdAt, completedAt }];
    });
  }, []);

  const updateTask = useCallback((id: string, patch: Partial<Task>) => {
    setTasks(prev => {
      const next = prev.map(t => {
        if (t.id !== id) return t;

        const merged = { ...t, ...patch } as Task;

        if (
          t.status !== 'Done' &&
          merged.status === 'Done' &&
          !merged.completedAt
        ) {
          merged.completedAt = new Date().toISOString();
        }

        return merged;
      });

      return next.map(t =>
        t.id === id && (patch.timeTaken ?? t.timeTaken) <= 0
          ? { ...t, timeTaken: 1 }
          : t
      );
    });
  }, []);

  const deleteTask = useCallback((id: string) => {
    setTasks(prev => {
      const target = prev.find(t => t.id === id) || null;
      setLastDeleted(target);
      return prev.filter(t => t.id !== id);
    });
  }, []);

  const undoDelete = useCallback(() => {
    if (!lastDeleted) return;
    setTasks(prev => [...prev, lastDeleted]);
    setLastDeleted(null);
  }, [lastDeleted]);

  // ----------------------------------------------------------
  // NEW: CLEAR lastDeleted for BUG 2
  // ----------------------------------------------------------
  const clearLastDeleted = useCallback(() => {
    setLastDeleted(null);
  }, []);

  return {
    tasks,
    loading,
    error,
    derivedSorted,
    metrics,
    lastDeleted,
    addTask,
    updateTask,
    deleteTask,
    undoDelete,
    clearLastDeleted,   // <-- required
  };
}
