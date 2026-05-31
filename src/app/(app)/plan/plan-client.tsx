"use client";

import { useEffect, useState } from "react";
import { CalendarDays, Trash2, ChevronDown, ChevronUp, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import type { MealPlanDay } from "@/types";
import { useUserSessionReady } from "@/components/user-session-provider";
import { PlanMealItem } from "@/components/plan/plan-meal-item";

interface MealPlan {
  id: string;
  title: string;
  startDate: string;
  endDate: string;
  days: MealPlanDay[];
  createdAt: string;
}

const DAY_NAMES = ["Ne", "Po", "Út", "St", "Čt", "Pá", "So"];
const MONTH_NAMES = [
  "ledna", "února", "března", "dubna", "května", "června",
  "července", "srpna", "září", "října", "listopadu", "prosince",
];

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return `${d.getDate()}. ${MONTH_NAMES[d.getMonth()]}`;
}

function formatDayHeader(dateStr: string): string {
  const d = new Date(dateStr);
  return `${DAY_NAMES[d.getDay()]} ${d.getDate()}. ${MONTH_NAMES[d.getMonth()]}`;
}

export function PlanClient() {
  const userReady = useUserSessionReady();
  const [plans, setPlans] = useState<MealPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    if (!userReady) return;
    fetchPlans();
  }, [userReady]);

  async function fetchPlans() {
    try {
      const res = await fetch("/api/plans");
      const data = await res.json();
      setPlans(data);
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: string) {
    await fetch("/api/plans", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    setPlans((prev) => prev.filter((p) => p.id !== id));
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-stone-400 text-sm">Načítám…</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="px-4 py-3 border-b border-stone-100 bg-white">
        <h1 className="text-base font-semibold text-stone-900">Jídelní plány</h1>
        <p className="text-xs text-stone-500">{plans.length} uložených plánů</p>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4">
        {plans.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-4 py-12">
            <div className="w-16 h-16 rounded-2xl bg-blue-50 flex items-center justify-center mb-4">
              <CalendarDays className="h-8 w-8 text-blue-300" />
            </div>
            <h2 className="text-base font-semibold text-stone-700 mb-2">
              Zatím žádné plány
            </h2>
            <p className="text-sm text-stone-400 max-w-xs leading-relaxed mb-4">
              Požádej asistenta o sestavení jídelního plánu. Stačí napsat
              například: „Vytvoř mi jídelní plán na příští týden."
            </p>
            <Link href="/chat">
              <Button variant="primary" size="md" className="gap-2">
                <MessageCircle className="h-4 w-4" />
                Otevřít chat
              </Button>
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {plans.map((plan) => {
              const isExpanded = expandedId === plan.id;
              return (
                <div
                  key={plan.id}
                  className="bg-white rounded-2xl border border-stone-200 overflow-hidden shadow-sm"
                >
                  <button
                    className="w-full p-4 text-left"
                    onClick={() => setExpandedId(isExpanded ? null : plan.id)}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <h3 className="text-base font-semibold text-stone-900">
                          {plan.title}
                        </h3>
                        <p className="text-xs text-stone-500 mt-0.5">
                          {formatDate(plan.startDate)} – {formatDate(plan.endDate)}
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(plan.id);
                          }}
                          className="text-stone-400 hover:text-red-500"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                        {isExpanded ? (
                          <ChevronUp className="h-4 w-4 text-stone-400" />
                        ) : (
                          <ChevronDown className="h-4 w-4 text-stone-400" />
                        )}
                      </div>
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="border-t border-stone-100 divide-y divide-stone-100">
                      {plan.days.map((day, i) => (
                        <div key={i} className="p-4">
                          <p className="text-xs font-semibold text-stone-500 uppercase tracking-wide mb-2">
                            {formatDayHeader(day.date)}
                          </p>
                          <div className="space-y-1.5">
                            {day.meals.map((meal, j) => (
                              <PlanMealItem key={j} meal={meal} />
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
