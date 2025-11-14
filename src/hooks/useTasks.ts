import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DerivedTask, Metrics, Task } from "@/types";
import {
  computeAverageROI,
  computePerformanceGrade,
  computeRevenuePerHour,
  computeTimeEfficiency,
  computeTotalRevenue,
  withDerived,
  sortTasks,
} from "@/utils/logic";

import { generateSalesTasks } from "@/utils/seed";

interface UseTasksState {
  tasks: Task[];
  loading: boolean;
  error: string | null;
  derivedSorted: DerivedTask[];
  metrics: Metrics;
  lastDeleted: Task | null;
  addTask: (task: Omit<Task, "id"> & { id?: string }) => void;
  updateTask: (id: string, patch: Partial<Task>) => void;
  deleteTask: (id: string) => void;
  undoDelete: () => void;
}

const INITIAL_METRICS: Metrics = {
  totalRevenue: 0,
  totalTimeTaken: 0,
  timeEfficiencyPct: 0,
  revenuePerHour: 0,
  averageROI: 0,
  performanceGrade: "Needs Improvement",
};

export function useTasks(): UseTasksState {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [lastDeleted, setLastDeleted] = useState<Task | null>(null);

  const fetchedRef = useRef<boolean>(false);

  function normalizeTasks(input: any[]): Task[] {
    const now = Date.now();
    return (Array.isArray(input) ? input : []).map((t: any, idx: number) => {
      const created = t.createdAt
        ? new Date(t.createdAt)
        : new Date(now - (idx + 1) * 24 * 3600 * 1000);

      const completed =
        t.completedAt ||
        (t.status === "Done"
          ? new Date(created.getTime() + 24 * 3600 * 1000).toISOString()
          : undefined);

      return {
        id: String(t.id),
        title: String(t.title),
        revenue: Number(t.revenue) ?? 0,
        timeTaken: Number(t.timeTaken) > 0 ? Number(t.timeTaken) : 1,
        priority: t.priority as Task["priority"],
        status: t.status as Task["status"],
        notes: t.notes ?? "",
        createdAt: created.toISOString(),
        completedAt: completed,
      };
    });
  }

  // --------------------------
  // LOAD TASKS
  // --------------------------
  useEffect(() => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;

    let isMounted = true;

    async function load() {
      console.log("---- LOAD START ----");
      try {
        console.log("Fetching /tasks.json ...");
        const res = await fetch("/tasks.json");

        if (!res.ok) throw new Error(`Failed to load tasks.json (${res.status})`);

        const json = await res.json();
        console.log("JSON loaded:", json);

        const normalized = normalizeTasks(json);
        console.log("Normalized tasks:", normalized);

        const finalTasks = normalized.length > 0 ? normalized : generateSalesTasks(50);

        if (isMounted) {
          console.log("Final tasks:", finalTasks.length);
          setTasks(finalTasks);
        }
      } catch (err: any) {
        console.error("LOAD ERROR:", err);
        if (isMounted) setError(err?.message ?? "Failed to load tasks");
      } finally {
        if (isMounted) setLoading(false);
        console.log("---- LOAD END ----");
      }
    }

    load();
    return () => {
      isMounted = false;
    };
  }, []);

  // --------------------------
  // DERIVED & METRICS
  // --------------------------
  const derivedSorted = useMemo<DerivedTask[]>(() => {
    const withCalc = tasks.map(withDerived);
    return sortTasks(withCalc);
  }, [tasks]);

  const metrics = useMemo<Metrics>(() => {
    if (tasks.length === 0) return INITIAL_METRICS;

    return {
      totalRevenue: computeTotalRevenue(tasks),
      totalTimeTaken: tasks.reduce((s, t) => s + t.timeTaken, 0),
      timeEfficiencyPct: computeTimeEfficiency(tasks),
      revenuePerHour: computeRevenuePerHour(tasks),
      averageROI: computeAverageROI(tasks),
      performanceGrade: computePerformanceGrade(computeAverageROI(tasks)),
    };
  }, [tasks]);

  // --------------------------
  // CRUD OPERATIONS
  // --------------------------
  const addTask = useCallback(
    (task: Omit<Task, "id"> & { id?: string }) => {
      setTasks((prev: Task[]) => {
        const id = task.id ?? crypto.randomUUID();
        const timeTaken = task.timeTaken <= 0 ? 1 : task.timeTaken;

        const createdAt = new Date().toISOString();
        const status = task.status;
        const completedAt = status === "Done" ? createdAt : undefined;

        return [
          ...prev,
          {
            ...task,
            id,
            timeTaken,
            createdAt,
            completedAt,
          },
        ];
      });
    },
    []
  );

  const updateTask = useCallback(
    (id: string, patch: Partial<Task>) => {
      setTasks((prev: Task[]) =>
        prev.map((t: Task): Task => {
          if (t.id !== id) return t;

          const merged = { ...t, ...patch };

          if (
            t.status !== "Done" &&
            merged.status === "Done" &&
            !merged.completedAt
          ) {
            merged.completedAt = new Date().toISOString();
          }

          if ((patch.timeTaken ?? merged.timeTaken) <= 0) {
            merged.timeTaken = 1;
          }

          return merged;
        })
      );
    },
    []
  );

  const deleteTask = useCallback((id: string) => {
    setTasks((prev: Task[]) => {
      const target = prev.find((t) => t.id === id) || null;
      setLastDeleted(target);
      return prev.filter((t) => t.id !== id);
    });
  }, []);

  const undoDelete = useCallback(() => {
    if (!lastDeleted) return;
    setTasks((prev: Task[]) => [...prev, lastDeleted]);
    setLastDeleted(null);
  }, [lastDeleted]);

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
  };
}
