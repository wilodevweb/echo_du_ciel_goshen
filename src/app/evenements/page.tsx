"use client";

import React, { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { CalendarDays, CheckCircle2, Circle, ChevronDown, ChevronRight, Loader2, Plus, X } from "lucide-react";
import { MobileHeader } from "@/components/ui/MobileHeader";
import { LoadingState } from "@/components/ui/LoadingState";
import db, { generateId, type ChildEvent, type ChildTask, getClassLabel, type TaskType } from "@/lib/db";
import { TASK_TYPES, getTaskTypeConfig } from "@/lib/taskTypes";
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

// ─── Formulaire ajout de tâche (Groupe ou Seul) ──────────────────────────────
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
  const [targetChildId, setTargetChildId] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const children = useLiveQuery(() => db.children.orderBy("firstName").toArray(), []);

  const handleAdd = async () => {
    if (!taskTitle.trim() || !children) return;
    setIsLoading(true);
    try {
      let targetChildren = [];
      if (audienceType === "SINGLE") {
        if (!targetChildId) return;
        targetChildren = children.filter((c) => c.id === targetChildId);
      } else {
        if (targetClass === "ALL") {
          targetChildren = children;
        } else {
          targetChildren = children.filter((c) => c.classLevel === targetClass);
        }
      }

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
      setTaskTitle("");
      setTaskType("autre");
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

      <div className="flex gap-2">
        <select
          value={taskType}
          onChange={(e) => setTaskType(e.target.value as TaskType)}
          className="w-1/3 h-9 px-2 rounded-lg border border-gray-200 bg-white text-sm focus:outline-none focus:border-[#00b22d]"
        >
          {TASK_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
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

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setAudienceType("GROUP")}
          className={`flex-1 h-8 rounded-lg text-xs font-bold transition-all ${
            audienceType === "GROUP" ? "bg-[#00b22d] text-white" : "bg-gray-200 text-gray-600 hover:bg-gray-300"
          }`}
        >
          En groupe
        </button>
        <button
          type="button"
          onClick={() => setAudienceType("SINGLE")}
          className={`flex-1 h-8 rounded-lg text-xs font-bold transition-all ${
            audienceType === "SINGLE" ? "bg-[#00b22d] text-white" : "bg-gray-200 text-gray-600 hover:bg-gray-300"
          }`}
        >
          Seul
        </button>
      </div>

      {audienceType === "GROUP" ? (
        <select
          value={targetClass}
          onChange={(e) => setTargetClass(e.target.value as any)}
          className="w-full h-9 px-3 rounded-lg border border-gray-200 bg-white text-sm focus:outline-none focus:border-[#00b22d]"
        >
          <option value="ALL">Toute l'école du dimanche</option>
          <option value="FIRST">Classe 1</option>
          <option value="SECOND">Classe 2</option>
          <option value="THIRD">Classe 3</option>
        </select>
      ) : (
        <select
          value={targetChildId}
          onChange={(e) => setTargetChildId(e.target.value)}
          className="w-full h-9 px-3 rounded-lg border border-gray-200 bg-white text-sm focus:outline-none focus:border-[#00b22d]"
        >
          <option value="">Sélectionner un enfant…</option>
          {(children || []).map((child) => (
            <option key={child.id} value={child.id}>
              {child.firstName} {child.lastName} ({getClassLabel(child.classLevel)})
            </option>
          ))}
        </select>
      )}

      <button
        type="button"
        disabled={!taskTitle.trim() || isLoading || (audienceType === "SINGLE" && !targetChildId)}
        onClick={handleAdd}
        className="w-full h-9 rounded-lg bg-gray-900 text-white text-sm font-bold disabled:opacity-40 transition-all flex items-center justify-center gap-2 hover:bg-gray-800"
      >
        {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
        Assigner
      </button>
    </div>
  );
}

function EventCard({ eventId, title, date, description, isAdmin }: {
  eventId: string;
  title: string;
  date: string;
  description?: string;
  isAdmin: boolean;
}) {
  const [isExpanded, setIsExpanded] = React.useState(false);
  const [showAddTask, setShowAddTask] = React.useState(false);

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

  // Grouper par activité (Type + Titre)
  const tasksByActivity = React.useMemo(() => {
    const map = new Map<string, typeof allTasks>();
    if (!allTasks) return map;
    for (const task of allTasks) {
      const typeKey = task.type || "autre";
      const key = `${typeKey}|${task.title}`;
      const list = map.get(key) ?? [];
      list.push(task);
      map.set(key, list);
    }
    return map;
  }, [allTasks]);

  const toggleTask = async (task: ChildTask) => {
    await db.tasks.update(task.id, { done: !task.done });
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return "";
    const parts = dateStr.split("-").map(Number);
    if (parts.length !== 3) return dateStr;
    const d = new Date(parts[0], parts[1] - 1, parts[2]);
    return d.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
  };

  const doneCount = allTasks?.filter((t) => t.done).length ?? 0;
  const totalCount = allTasks?.length ?? 0;
  
  // Compter le nombre d'enfants uniques touchés par cet événement
  const uniqueChildren = React.useMemo(() => {
    const set = new Set<string>();
    if (allTasks) {
      for (const t of allTasks) set.add(t.childId);
    }
    return set.size;
  }, [allTasks]);

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden mb-3">
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
                {uniqueChildren > 0 && ` · ${uniqueChildren} enfant${uniqueChildren > 1 ? "s" : ""}`}
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
          ) : tasksByActivity.size === 0 && !showAddTask ? (
            <p className="text-xs text-gray-400 italic py-3 text-center">Aucune tâche assignée.</p>
          ) : (
            <div className="space-y-4 pt-3">
              {Array.from(tasksByActivity.entries()).map(([activityKey, tasks]) => {
                const [typeRaw, ...titleParts] = activityKey.split("|");
                const taskTitle = titleParts.join("|");
                const config = getTaskTypeConfig(typeRaw as TaskType);
                const TypeIcon = config.icon;

                return (
                  <div key={activityKey} className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-white shadow-sm border border-gray-100 text-[#00b22d]">
                        <TypeIcon className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-gray-800 truncate">{taskTitle}</p>
                        <p className="text-[10px] uppercase tracking-widest font-bold text-gray-400">{config.label}</p>
                      </div>
                    </div>
                    <div className="space-y-1 mt-3 pl-1">
                      {(tasks ?? []).map((task) => {
                        const child = childById.get(task.childId);
                        const childName = child ? `${child.lastName} ${child.firstName}` : "Enfant inconnu";
                        return (
                          <div key={task.id} className="flex items-center gap-2.5 group">
                            {isAdmin ? (
                              <button
                                type="button"
                                onClick={() => toggleTask(task)}
                                className="shrink-0 text-gray-300 hover:text-gray-500 transition-colors"
                              >
                                {task.done ? (
                                  <CheckCircle2 className="w-5 h-5 text-[#00b22d]" />
                                ) : (
                                  <Circle className="w-5 h-5" />
                                )}
                              </button>
                            ) : (
                              <div className="shrink-0 text-gray-300">
                                {task.done ? (
                                  <CheckCircle2 className="w-5 h-5 text-[#00b22d]" />
                                ) : (
                                  <Circle className="w-5 h-5" />
                                )}
                              </div>
                            )}
                            <span
                              className={`text-sm ${
                                task.done ? "line-through text-gray-400" : "text-gray-700 font-medium"
                              }`}
                            >
                              {childName}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {isAdmin && (
            showAddTask ? (
              <AddTaskForm eventId={eventId} onDone={() => setShowAddTask(false)} />
            ) : (
              <button
                type="button"
                onClick={() => setShowAddTask(true)}
                className="mt-4 flex items-center justify-center gap-1.5 w-full h-10 rounded-xl border border-dashed border-gray-300 text-sm font-semibold text-gray-500 hover:text-gray-700 hover:border-gray-400 hover:bg-gray-50 transition-all"
              >
                <Plus className="w-4 h-4" />
                Assigner des tâches
              </button>
            )
          )}
        </div>
      )}
    </div>
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
                  isAdmin={isAdmin}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </main>
  );
}
