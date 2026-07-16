"use client";

import React, { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { CalendarDays, CheckCircle2, Loader2, Plus, X, ChevronRight } from "lucide-react";
import Link from "next/link";
import { MobileHeader } from "@/components/ui/MobileHeader";
import { LoadingState } from "@/components/ui/LoadingState";
import db, { generateId, markEntityForSync, type ChildEvent, type ChildTask, type TaskType } from "@/lib/db";
import { TASK_TYPES, getTaskTypeConfig } from "@/lib/taskTypes";
import { ChildSelector } from "@/components/children/ChildSelector";
import { useSession } from "next-auth/react";

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
        Créer l'événement
      </button>
    </div>
  );
}

// ─── Formulaire ajout de tâche (Groupe ou Sélection libre) ──────────────────
function AddTaskForm({
  eventId,
  onDone,
}: {
  eventId: string;
  onDone: () => void;
}) {
  const [taskTitle, setTaskTitle] = useState("");
  const [taskType, setTaskType] = useState<TaskType>("autre");
  const [audienceType, setAudienceType] = useState<"GROUP" | "SINGLE">("GROUP");
  const [targetClass, setTargetClass] = useState<"ALL" | "FIRST" | "SECOND" | "THIRD">("ALL");
  const [targetChildIds, setTargetChildIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const allChildren = useLiveQuery(() => db.children.orderBy("firstName").toArray(), []) ?? [];

  // Enfants filtrés par classe (mode Groupe), tous (mode Libre)
  const displayedChildren = React.useMemo(() => {
    if (audienceType === "SINGLE") return allChildren;
    if (targetClass === "ALL") return allChildren;
    return allChildren.filter((c) => c.classLevel === targetClass);
  }, [allChildren, audienceType, targetClass]);

  const handleAdd = async () => {
    if (!taskTitle.trim() || targetChildIds.length === 0) return;
    setIsLoading(true);
    try {
      const targetChildren = allChildren.filter((c) => targetChildIds.includes(c.id));
      if (targetChildren.length === 0) return;

      const newTasks: ChildTask[] = targetChildren.map((child) => ({
        id: generateId(),
        eventId,
        childId: child.id,
        title: taskTitle.trim(),
        type: taskType,
        done: false,
        createdAt: new Date().toISOString(),
      }));

      await db.tasks.bulkAdd(newTasks);
      // Marquer chaque tâche pour synchronisation
      for (const task of newTasks) {
        await markEntityForSync('task', task.id);
      }
      setTaskTitle("");
      setTaskType("autre");
      setTargetChildIds([]);
      onDone();
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="mt-4 p-3 bg-gray-50 rounded-xl border border-gray-100 space-y-3">
      <div className="flex justify-between items-center">
        <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">Assigner une tâche</p>
        <button type="button" onClick={onDone} className="text-gray-400 hover:text-gray-600">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Type + Intitulé */}
      <div className="flex gap-2">
        <select
          value={taskType}
          onChange={(e) => setTaskType(e.target.value as TaskType)}
          className="w-1/3 h-9 px-2 rounded-lg border border-gray-200 bg-white text-sm focus:outline-none focus:border-[#00b22d]"
        >
          {TASK_TYPES.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
        <input
          type="text"
          value={taskTitle}
          onChange={(e) => setTaskTitle(e.target.value)}
          placeholder="Intitulé de la tâche…"
          autoFocus
          className="flex-1 h-9 px-3 rounded-lg border border-gray-200 bg-white text-sm focus:outline-none focus:border-[#00b22d]"
        />
      </div>

      {/* Mode */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => { setAudienceType("GROUP"); setTargetChildIds([]); }}
          className={`flex-1 h-8 rounded-lg text-xs font-bold transition-all ${
            audienceType === "GROUP" ? "bg-[#00b22d] text-white" : "bg-gray-200 text-gray-600 hover:bg-gray-300"
          }`}
        >
          Par classe
        </button>
        <button
          type="button"
          onClick={() => { setAudienceType("SINGLE"); setTargetChildIds([]); }}
          className={`flex-1 h-8 rounded-lg text-xs font-bold transition-all ${
            audienceType === "SINGLE" ? "bg-[#00b22d] text-white" : "bg-gray-200 text-gray-600 hover:bg-gray-300"
          }`}
        >
          Sélection libre
        </button>
      </div>

      {/* Filtre de classe (mode Groupe seulement) */}
      {audienceType === "GROUP" && (
        <select
          value={targetClass}
          onChange={(e) => { setTargetClass(e.target.value as any); setTargetChildIds([]); }}
          className="w-full h-9 px-3 rounded-lg border border-gray-200 bg-white text-sm focus:outline-none focus:border-[#00b22d]"
        >
          <option value="ALL">Toute l'école du dimanche</option>
          <option value="FIRST">Classe 1</option>
          <option value="SECOND">Classe 2</option>
          <option value="THIRD">Classe 3</option>
        </select>
      )}

      {/* Sélecteur enfants */}
      <ChildSelector
        children={displayedChildren}
        selectedIds={targetChildIds}
        onChange={setTargetChildIds}
        variant="light"
        maxHeight="max-h-44"
      />

      <button
        type="button"
        disabled={!taskTitle.trim() || isLoading || targetChildIds.length === 0}
        onClick={handleAdd}
        className="w-full h-9 rounded-lg bg-gray-900 text-white text-sm font-bold disabled:opacity-40 transition-all flex items-center justify-center gap-2 hover:bg-gray-800"
      >
        {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
        Assigner{targetChildIds.length > 0 ? ` (${targetChildIds.length})` : ""}
      </button>
    </div>
  );
}



function EventCard({ eventId, title, date, description }: {
  eventId: string;
  title: string;
  date: string;
  description?: string;
}) {
  const allTasks = useLiveQuery(
    () => db.tasks.where("eventId").equals(eventId).toArray(),
    [eventId]
  );

  const formatDate = (dateStr: string) => {
    if (!dateStr) return "";
    const parts = dateStr.split("-").map(Number);
    if (parts.length !== 3) return dateStr;
    const d = new Date(parts[0], parts[1] - 1, parts[2]);
    return d.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
  };

  const doneCount = allTasks?.filter((t) => t.done).length ?? 0;
  const totalCount = allTasks?.length ?? 0;
  const uniqueChildren = React.useMemo(() => {
    const set = new Set<string>();
    if (allTasks) for (const t of allTasks) set.add(t.childId);
    return set.size;
  }, [allTasks]);

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
  const { data: session } = useSession();
  const isAdmin = (session?.user as any)?.role === "ADMIN";
  const [showCreateForm, setShowCreateForm] = useState(false);

  const events = useLiveQuery(
    () => db.events.orderBy("date").reverse().toArray(),
    []
  );

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
