"use client";

import React, { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { CalendarDays, Loader2, Plus, ChevronRight } from "lucide-react";
import Link from "next/link";
import { MobileHeader } from "@/components/ui/MobileHeader";
import { LoadingState } from "@/components/ui/LoadingState";
import db, { generateId, markEntityForSync, type ChildEvent } from "@/lib/db";
import { useAuthUser } from "@/hooks/useAuthUser";

// ─── Formulaire création d'événement ────────────────────────────────────────
function CreateEventForm({ onCreated }: { onCreated: (event: ChildEvent) => void }) {
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [description, setDescription] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async () => {
    if (!title.trim()) return;
    setIsLoading(true);
    try {
      const event: ChildEvent = {
        id: generateId(),
        title: title.trim(),
        date: date || new Date().toISOString().split("T")[0],
        description: description.trim() || undefined,
        createdAt: new Date().toISOString(),
      };
      await db.events.add(event);
      await markEntityForSync('event', event.id);
      onCreated(event);
      setTitle("");
      setDate("");
      setDescription("");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-3 rounded-2xl bg-white border border-gray-100 shadow-sm p-4 mb-4">
      <p className="text-sm font-bold text-gray-700 uppercase tracking-widest">Nouvel événement</p>
      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Nom de l'événement…"
        autoFocus
        className="w-full h-10 px-3 rounded-xl border border-gray-200 bg-white text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none focus:border-[#00b22d]"
      />
      <input
        type="date"
        value={date}
        onChange={(e) => setDate(e.target.value)}
        className="w-full h-10 px-3 rounded-xl border border-gray-200 bg-white text-sm text-gray-800 focus:outline-none focus:border-[#00b22d]"
      />
      <input
        type="text"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Description (optionnel)…"
        className="w-full h-10 px-3 rounded-xl border border-gray-200 bg-white text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none focus:border-[#00b22d]"
      />
      <button
        type="button"
        disabled={!title.trim() || isLoading}
        onClick={handleSubmit}
        className="w-full h-10 flex items-center justify-center gap-2 rounded-xl bg-[#00b22d] text-white text-sm font-bold disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#008f24] transition-all"
      >
        {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
        Créer l&apos;événement
      </button>
    </div>
  );
}

interface EventTaskSummary {
  doneCount: number;
  totalCount: number;
  uniqueChildren: number;
}

function EventCard({ eventId, title, date, summary }: {
  eventId: string;
  title: string;
  date: string;
  summary: EventTaskSummary;
}) {
  const formatDate = (dateStr: string) => {
    if (!dateStr) return "";
    const parts = dateStr.split("-").map(Number);
    if (parts.length !== 3) return dateStr;
    const d = new Date(parts[0], parts[1] - 1, parts[2]);
    return d.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
  };

  const { doneCount, totalCount, uniqueChildren } = summary;

  const pct = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;

  return (
    <Link
      href={`/evenements/${eventId}`}
      className="block bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden hover:shadow-md active:scale-[0.99] transition-all"
    >
      <div className="flex items-center gap-3 p-4">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#00b22d]/10 text-[#00b22d]">
          <CalendarDays className="w-6 h-6" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-gray-900 leading-tight truncate">{title}</p>
          <p className="text-xs text-gray-500 mt-0.5">
            {formatDate(date)}
            {uniqueChildren > 0 && (
              <span className="ml-2">
                · {uniqueChildren} enfant{uniqueChildren > 1 ? "s" : ""}
              </span>
            )}
          </p>
        </div>
        <ChevronRight className="w-4 h-4 text-gray-300 shrink-0" />
      </div>
      {totalCount > 0 && (
        <div className="px-4 pb-3">
          <div className="flex items-center gap-2">
            <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-[#00b22d] rounded-full transition-all"
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="text-[10px] text-gray-400 font-semibold whitespace-nowrap">{doneCount}/{totalCount}</span>
          </div>
        </div>
      )}
    </Link>
  );
}

export default function EvenementsPage() {
  const { isAdmin } = useAuthUser();
  const [showCreateForm, setShowCreateForm] = useState(false);

  const events = useLiveQuery(
    () => db.events.orderBy("date").reverse().toArray(),
    []
  );
  const eventIdsKey = (events ?? []).map((event) => event.id).join("\u0000");
  const eventTasks = useLiveQuery(() => {
    const eventIds = eventIdsKey ? eventIdsKey.split("\u0000") : [];
    return eventIds.length ? db.tasks.where("eventId").anyOf(eventIds).toArray() : [];
  }, [eventIdsKey]);
  const taskSummaryByEvent = React.useMemo(() => {
    const summaries = new Map<string, EventTaskSummary>();
    const childrenByEvent = new Map<string, Set<string>>();
    for (const task of eventTasks ?? []) {
      const summary = summaries.get(task.eventId) ?? { doneCount: 0, totalCount: 0, uniqueChildren: 0 };
      summary.totalCount += 1;
      if (task.done) summary.doneCount += 1;
      summaries.set(task.eventId, summary);
      const children = childrenByEvent.get(task.eventId) ?? new Set<string>();
      children.add(task.childId);
      childrenByEvent.set(task.eventId, children);
    }
    for (const [eventId, summary] of summaries) {
      summary.uniqueChildren = childrenByEvent.get(eventId)?.size ?? 0;
    }
    return summaries;
  }, [eventTasks]);

  return (
    <main className="flex min-h-screen flex-col bg-gray-50 pb-10">
      <MobileHeader
        title="Événements"
        rightElement={
          isAdmin ? (
            <button
              onClick={() => setShowCreateForm(!showCreateForm)}
              className="flex items-center gap-1.5 bg-white/20 hover:bg-white/30 text-white px-3 py-1.5 rounded-full text-sm font-bold transition-all"
            >
              <Plus className="w-4 h-4" />
              Nouveau
            </button>
          ) : (
            <CalendarDays className="w-6 h-6 ml-2 text-white" />
          )
        }
      />

      <div className="p-4 max-w-md mx-auto w-full">
        {showCreateForm && isAdmin && (
          <CreateEventForm onCreated={() => setShowCreateForm(false)} />
        )}

        {events === undefined ? (
          <LoadingState message="Chargement des événements…" />
        ) : events.length === 0 ? (
          <div className="text-center py-14">
            <CalendarDays className="w-12 h-12 text-gray-300 mx-auto mb-3" strokeWidth={1.5} />
            <p className="text-sm text-gray-500 font-medium">Aucun événement créé.</p>
            {!isAdmin && (
              <p className="text-xs text-gray-400 mt-1">
                Seuls les administrateurs peuvent créer des événements.
              </p>
            )}
          </div>
        ) : (
          <>
            <p className="text-xs text-gray-400 font-medium px-1 mb-3">
              {events.length} événement{events.length > 1 ? "s" : ""}
            </p>
            <div className="space-y-3">
              {events.map((event) => (
                <EventCard
                  key={event.id}
                  eventId={event.id}
                  title={event.title}
                  date={event.date}
                  summary={taskSummaryByEvent.get(event.id) ?? { doneCount: 0, totalCount: 0, uniqueChildren: 0 }}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </main>
  );
}
