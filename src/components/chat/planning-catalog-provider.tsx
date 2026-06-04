"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { PlanningRecipe } from "@/types";
import { useUserSessionReady } from "@/components/user-session-provider";

type PlanningCatalogState = {
  version: string | undefined;
  recipes: PlanningRecipe[];
  ready: boolean;
  loading: boolean;
  error: string | null;
  refetch: () => void;
};

const PlanningCatalogContext = createContext<PlanningCatalogState | null>(null);

export function PlanningCatalogProvider({ children }: { children: ReactNode }) {
  const userReady = useUserSessionReady();
  const [version, setVersion] = useState<string | undefined>();
  const [recipes, setRecipes] = useState<PlanningRecipe[]>([]);
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchCatalog = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/chat/recipe-catalog");
      if (!res.ok) {
        throw new Error("Katalog receptů se nepodařilo načíst");
      }
      const data = (await res.json()) as {
        version: string;
        recipes: PlanningRecipe[];
      };
      setVersion(data.version);
      setRecipes(data.recipes);
      setReady(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Chyba načtení katalogu");
      setReady(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!userReady) return;
    void fetchCatalog();
  }, [userReady, fetchCatalog]);

  const value = useMemo(
    () => ({
      version,
      recipes,
      ready,
      loading,
      error,
      refetch: fetchCatalog,
    }),
    [version, recipes, ready, loading, error, fetchCatalog]
  );

  return (
    <PlanningCatalogContext.Provider value={value}>
      {children}
    </PlanningCatalogContext.Provider>
  );
}

export function usePlanningCatalog(): PlanningCatalogState {
  const ctx = useContext(PlanningCatalogContext);
  if (!ctx) {
    throw new Error(
      "usePlanningCatalog must be used within PlanningCatalogProvider"
    );
  }
  return ctx;
}
