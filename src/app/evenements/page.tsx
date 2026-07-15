"use client";

import React from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { CalendarDays, CheckCircle2, Circle, ChevronDown, ChevronRight, Loader2 } from "lucide-react";
import { MobileHeader } from "@/components/ui/MobileHeader";
import { LoadingState } from "@/components/ui/LoadingState";
import db from "@/lib/db";

function EventCard({ eventId, title, date, description }: {
  eventId: string;
  title: string;
  date: string;
  description?: string;
}) {
  const [isExpanded, setIsExpanded] = React.useState(false);

  const allTasks = useLiveQuery(
    () => db.tasks.where("eventId").equals(eventId).toArray(),
    [eventId]
  );

  const children = useLiveQuery(() => db.children.toArray(), []);

  const childById = React.useMemo(() => {
    const map = new Map<string, { firstName: string; lastName: string }>();
    (children ?? []).forEach((c) => map.set(c.id, c));
    return map;
  }, [children]);

  const tasksByChild = React.useMemo(() => {
    const map = new Map<string, typeof allTasks>();
    if (!allTasks) return map;
    for (const task of allTasks) {
      const list = map.get(task.childId) ?? [];
      list.push(task);
      map.set(task.childId, list);
    }
    return map;
  }, [allTasks]);

  const formatDate = (dateStr: string) => {
    if (!dateStr) return "";
    const parts = dateStr.split("-").map(Number);
    if (parts.length !== 3) return dateStr;
    const d = new Date(parts[0], parts[1] - 1, parts[2]);
    return d.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
  };

  const doneCount = allTasks?.filter((t) => t.done).length ?? 0;
  const totalCount = allTasks?.length ?? 0;
  const childCount = tasksByChild.size;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      {/* En-tête */}
      <button
        type="button"
        onClick={() => setIsExpanded((v) => !v)}
        className="w-full flex items-center gap-3 p-4 text-left hover:bg-gray-50 transition-colors"
      >
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#00b22d]/10 text-[#00b22d]">
          <CalendarDays className="w-6 h-6" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-gray-900 leading-tight truncate">{title}</p>
          <p className="text-xs text-gray-500 mt-0.5">
            {formatDate(date)}
            {totalCount > 0 && (
              <span className="ml-2">
                · {doneCount}/{totalCount} tâche{totalCount > 1 ? "s" : ""}
                {childCount > 0 && ` · ${childCount} enfant${childCount > 1 ? "s" : ""}`}
              </span>
            )}
          </p>
        </div>
        {isExpanded ? (
          <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />
        ) : (
          <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />
        )}
      </button>

      {/* Corps */}
      {isExpanded && (
        <div className="border-t border-gray-100 px-4 pb-4">
          {description && (
            <p className="text-xs text-gray-400 italic pt-3 mb-2">{description}</p>
          )}

          {allTasks === undefined ? (
            <div className="flex justify-center py-4">
              <Loader2 className="w-4 h-4 animate-spin text-gray-300" />
            </div>
          ) : tasksByChild.size === 0 ? (
            <p className="text-xs text-gray-400 italic py-3 text-center">Aucune tâche assignée.</p>
          ) : (
            <div className="space-y-4 pt-3">
              {Array.from(tasksByChild.entries()).map(([childId, tasks]) => {
                const child = childById.get(childId);
                const childName = child
                  ? `${child.lastName} ${child.firstName}`
                  : "Enfant inconnu";
                return (
                  <div key={childId}>
                    <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">
                      {childName}
                    </p>
                    <div className="space-y-1">
                      {(tasks ?? []).map((task) => (
                        <div key={task.id} className="flex items-center gap-2.5">
                          {task.done ? (
                            <CheckCircle2 className="w-4 h-4 text-[#00b22d] shrink-0" />
                          ) : (
                            <Circle className="w-4 h-4 text-gray-300 shrink-0" />
                          )}
                          <span
                            className={`text-sm ${
                              task.done ? "line-through text-gray-400" : "text-gray-700"
                            }`}
                          >
                            {task.title}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function EvenementsPage() {
  const events = useLiveQuery(
    () => db.events.orderBy("date").reverse().toArray(),
    []
  );

  return (
    <main className="flex min-h-screen flex-col bg-gray-50 pb-10">
      <MobileHeader
        title="Événements"
        rightElement={<CalendarDays className="w-6 h-6 ml-2" />}
      />

      <div className="p-4 max-w-md mx-auto w-full space-y-4">
        {events === undefined ? (
          <LoadingState message="Chargement des événements…" />
        ) : events.length === 0 ? (
          <div className="text-center py-14">
            <CalendarDays className="w-12 h-12 text-gray-300 mx-auto mb-3" strokeWidth={1.5} />
            <p className="text-sm text-gray-500 font-medium">Aucun événement créé.</p>
            <p className="text-xs text-gray-400 mt-1">
              Crée des événements depuis la fiche d'un enfant.
            </p>
          </div>
        ) : (
          <>
            <p className="text-xs text-gray-400 font-medium px-1">
              {events.length} événement{events.length > 1 ? "s" : ""}
            </p>
            <div className="space-y-3">
              {events.map((event) => (
                <EventCard
                  key={event.id}
                  eventId={event.id}
                  title={event.title}
                  date={event.date}
                  description={event.description}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </main>
  );
}
