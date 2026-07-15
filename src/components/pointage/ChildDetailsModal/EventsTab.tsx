import React, { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { CalendarDays, CheckCircle2, Circle, Plus, ChevronDown, ChevronRight, Loader2, X, Pencil } from "lucide-react";
import db, { generateId, type ChildEvent, type ChildTask } from "@/lib/db";

interface EventsTabProps {
  childId: string;
  isEditMode: boolean;
}

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
    <div className="space-y-3 rounded-2xl bg-white/5 border border-white/10 p-4">
      <p className="text-sm font-bold text-white/70 uppercase tracking-widest">Nouvel événement</p>
      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Nom de l'événement…"
        autoFocus
        className="w-full h-10 px-3 rounded-xl border border-white/10 bg-white/5 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-white/30"
      />
      <input
        type="date"
        value={date}
        onChange={(e) => setDate(e.target.value)}
        className="w-full h-10 px-3 rounded-xl border border-white/10 bg-white/5 text-sm text-white focus:outline-none focus:border-white/30"
      />
      <input
        type="text"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Description (optionnel)…"
        className="w-full h-10 px-3 rounded-xl border border-white/10 bg-white/5 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-white/30"
      />
      <button
        type="button"
        disabled={!title.trim() || isLoading}
        onClick={handleSubmit}
        className="w-full h-10 flex items-center justify-center gap-2 rounded-xl bg-fiverr text-white text-sm font-bold disabled:opacity-40 disabled:cursor-not-allowed hover:bg-fiverr-dark transition-all"
      >
        {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
        Créer l'événement
      </button>
    </div>
  );
}

// ─── Formulaire ajout de tâche ───────────────────────────────────────────────
function AddTaskForm({
  eventId,
  childId,
  onDone,
}: {
  eventId: string;
  childId: string;
  onDone: () => void;
}) {
  const [taskTitle, setTaskTitle] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleAdd = async () => {
    if (!taskTitle.trim()) return;
    setIsLoading(true);
    try {
      await db.tasks.add({
        id: generateId(),
        eventId,
        childId,
        title: taskTitle.trim(),
        done: false,
        createdAt: new Date().toISOString(),
      });
      setTaskTitle("");
      onDone();
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex gap-2 mt-2">
      <input
        type="text"
        value={taskTitle}
        onChange={(e) => setTaskTitle(e.target.value)}
        placeholder="Nouvelle tâche…"
        autoFocus
        onKeyDown={(e) => { if (e.key === "Enter") handleAdd(); }}
        className="flex-1 h-9 px-3 rounded-xl border border-white/10 bg-white/5 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-white/25"
      />
      <button
        type="button"
        disabled={!taskTitle.trim() || isLoading}
        onClick={handleAdd}
        className="h-9 px-3 rounded-xl bg-white/10 text-white text-sm font-bold disabled:opacity-40 hover:bg-white/15 transition-all flex items-center gap-1"
      >
        {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
      </button>
    </div>
  );
}

// ─── Carte d'un événement ────────────────────────────────────────────────────
function EventCard({
  event,
  childId,
  isEditMode,
}: {
  event: ChildEvent;
  childId: string;
  isEditMode: boolean;
}) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [showAddTask, setShowAddTask] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");

  const tasks = useLiveQuery(
    () =>
      db.tasks
        .where("[eventId+childId]")
        .equals([event.id, childId])
        .sortBy("createdAt"),
    [event.id, childId]
  );

  const toggleTask = async (task: ChildTask) => {
    await db.tasks.update(task.id, { done: !task.done });
  };

  const deleteTask = async (taskId: string) => {
    await db.tasks.delete(taskId);
  };

  const saveTaskEdit = async (taskId: string) => {
    if (!editingTitle.trim()) return;
    await db.tasks.update(taskId, { title: editingTitle.trim() });
    setEditingTaskId(null);
    setEditingTitle("");
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return "";
    const parts = dateStr.split("-").map(Number);
    if (parts.length !== 3) return dateStr;
    const d = new Date(parts[0], parts[1] - 1, parts[2]);
    return d.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
  };

  const doneCount = tasks?.filter((t) => t.done).length ?? 0;
  const totalCount = tasks?.length ?? 0;

  return (
    <div className="rounded-2xl bg-white/5 border border-white/10 overflow-hidden">
      {/* En-tête événement */}
      <button
        type="button"
        onClick={() => setIsExpanded((v) => !v)}
        className="w-full flex items-center gap-3 p-4 text-left hover:bg-white/5 transition-colors"
      >
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-fiverr/20 text-fiverr">
          <CalendarDays className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-white leading-tight truncate">{event.title}</p>
          <p className="text-xs text-white/45 mt-0.5">
            {formatDate(event.date)}
            {totalCount > 0 && (
              <span className="ml-2 text-white/50">· {doneCount}/{totalCount} tâche{totalCount > 1 ? "s" : ""}</span>
            )}
          </p>
        </div>
        {isExpanded ? (
          <ChevronDown className="w-4 h-4 text-white/40 shrink-0" />
        ) : (
          <ChevronRight className="w-4 h-4 text-white/40 shrink-0" />
        )}
      </button>

      {/* Corps — liste de tâches */}
      {isExpanded && (
        <div className="px-4 pb-4 space-y-1.5 border-t border-white/8">
          {event.description && (
            <p className="text-xs text-white/40 italic pt-3">{event.description}</p>
          )}

          {tasks === undefined ? (
            <div className="flex justify-center py-4">
              <Loader2 className="w-4 h-4 animate-spin text-white/40" />
            </div>
          ) : tasks.length === 0 && !showAddTask ? (
            <p className="text-xs text-white/35 italic py-3 text-center">Aucune tâche pour cet enfant.</p>
          ) : (
            <div className="pt-2 space-y-1.5">
              {tasks.map((task) => (
                <div
                  key={task.id}
                  className="flex items-center gap-2.5 group"
                >
                  {isEditMode && editingTaskId === task.id ? (
                    <>
                      <input
                        type="text"
                        value={editingTitle}
                        onChange={(e) => setEditingTitle(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") saveTaskEdit(task.id);
                          if (e.key === "Escape") setEditingTaskId(null);
                        }}
                        autoFocus
                        className="flex-1 h-8 px-2 rounded-lg border border-white/15 bg-white/5 text-sm text-white focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => saveTaskEdit(task.id)}
                        className="text-xs font-bold text-fiverr hover:text-fiverr-dark"
                      >
                        OK
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingTaskId(null)}
                        className="text-white/40 hover:text-white/60"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </>
                  ) : (
                    <>
                      {/* Cocher/décocher toujours visible */}
                      <button
                        type="button"
                        onClick={() => toggleTask(task)}
                        className="shrink-0 text-white/60 hover:text-white transition-colors"
                        aria-label={task.done ? "Marquer non fait" : "Marquer fait"}
                      >
                        {task.done ? (
                          <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                        ) : (
                          <Circle className="w-5 h-5" />
                        )}
                      </button>
                      <span
                        className={`flex-1 text-sm leading-snug ${
                          task.done ? "line-through text-white/35" : "text-white/80"
                        }`}
                      >
                        {task.title}
                      </span>
                      {/* Modifier / Supprimer — uniquement en mode édition */}
                      {isEditMode && (
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingTaskId(task.id);
                              setEditingTitle(task.title);
                            }}
                            className="p-1 rounded-lg text-white/40 hover:text-white/70 hover:bg-white/10"
                            aria-label="Modifier"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteTask(task.id)}
                            className="p-1 rounded-lg text-white/40 hover:text-red-400 hover:bg-red-500/10"
                            aria-label="Supprimer"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Ajouter une tâche — uniquement en mode édition */}
          {isEditMode && (
            showAddTask ? (
              <AddTaskForm
                eventId={event.id}
                childId={childId}
                onDone={() => setShowAddTask(false)}
              />
            ) : (
              <button
                type="button"
                onClick={() => setShowAddTask(true)}
                className="mt-2 flex items-center gap-1.5 text-xs text-white/40 hover:text-white/70 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                Ajouter une tâche
              </button>
            )
          )}
        </div>
      )}
    </div>
  );
}

// ─── Onglet principal ────────────────────────────────────────────────────────
export function EventsTab({ childId, isEditMode }: EventsTabProps) {
  const [showCreateForm, setShowCreateForm] = useState(false);

  const events = useLiveQuery(
    () => db.events.orderBy("date").reverse().toArray(),
    []
  );

  if (events === undefined) {
    return (
      <div className="flex justify-center py-10">
        <Loader2 className="w-6 h-6 animate-spin text-white/40" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-lg font-semibold leading-tight text-white">Événements</p>
          <p className="text-xs text-white/50 mt-0.5">Tâches assignées à cet enfant.</p>
        </div>
        {/* Bouton "Créer événement" — uniquement en mode édition */}
        {isEditMode && (
          <button
            type="button"
            onClick={() => setShowCreateForm((v) => !v)}
            className={`flex items-center gap-1.5 h-9 px-3 rounded-full text-sm font-bold transition-all ${
              showCreateForm
                ? "bg-white/15 text-white"
                : "bg-white/8 text-white/65 hover:bg-white/12"
            }`}
          >
            <Plus className="w-4 h-4" />
            Événement
          </button>
        )}
      </div>

      {isEditMode && showCreateForm && (
        <CreateEventForm
          onCreated={() => setShowCreateForm(false)}
        />
      )}

      {events.length === 0 ? (
        <div className="text-center py-10 border border-white/8 rounded-2xl bg-white/3">
          <CalendarDays className="w-10 h-10 text-white/20 mx-auto mb-3" strokeWidth={1.5} />
          <p className="text-sm text-white/40 font-medium">Aucun événement créé.</p>
          {isEditMode && (
            <p className="text-xs text-white/25 mt-1">Crée un événement pour assigner des tâches.</p>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {events.map((event) => (
            <EventCard
              key={event.id}
              event={event}
              childId={childId}
              isEditMode={isEditMode}
            />
          ))}
        </div>
      )}
    </div>
  );
}
