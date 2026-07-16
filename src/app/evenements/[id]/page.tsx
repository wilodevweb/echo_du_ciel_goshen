"use client";

import React, { useState, useMemo } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { useParams, useRouter } from "next/navigation";
import {
  CalendarDays, CheckCircle2, Circle, Loader2, Plus, X,
  Users, LayoutList, Info, Trash2, ArrowLeft, Pencil
} from "lucide-react";
import { MobileHeader } from "@/components/ui/MobileHeader";
import db, { generateId, markEntityForSync, type Child, type ChildTask, type TaskType } from "@/lib/db";
import { TASK_TYPES, getTaskTypeConfig } from "@/lib/taskTypes";
import { ChildSelector } from "@/components/ui/ChildSelector";
import { ChildDetailsModal } from "@/components/pointage/ChildDetailsModal";
import { useSession } from "next-auth/react";

type Tab = "infos" | "activites" | "participants";

// ─── Onglet Infos ─────────────────────────────────────────────────────────────
function InfosTab({
  title, date, description, tasks, isAdmin, eventId, onDelete,
}: {
  title: string;
  date: string;
  description?: string;
  tasks: ChildTask[];
  isAdmin: boolean;
  eventId: string;
  onDelete: () => void;
}) {
  const formatDate = (d: string) => {
    if (!d) return "";
    const parts = d.split("-").map(Number);
    if (parts.length !== 3) return d;
    return new Date(parts[0], parts[1] - 1, parts[2]).toLocaleDateString("fr-FR", {
      weekday: "long", day: "numeric", month: "long", year: "numeric",
    });
  };

  const done = tasks.filter((t) => t.done).length;
  const total = tasks.length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  const uniqueChildren = new Set(tasks.map((t) => t.childId)).size;
  const uniqueActivities = new Set(tasks.map((t) => `${t.type ?? "autre"}|${t.title}`)).size;

  return (
    <div className="space-y-5 pt-2">
      {/* Carte date */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-xl bg-[#00b22d]/10 flex items-center justify-center text-[#00b22d]">
            <CalendarDays className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs text-gray-400 font-medium uppercase tracking-widest">Date</p>
            <p className="text-sm font-bold text-gray-800 capitalize">{formatDate(date)}</p>
          </div>
        </div>
        {description && (
          <p className="text-sm text-gray-500 italic border-t border-gray-50 pt-3">{description}</p>
        )}
      </div>

      {/* Statistiques */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-3 text-center">
          <p className="text-2xl font-black text-[#00b22d]">{uniqueActivities}</p>
          <p className="text-[10px] text-gray-400 font-medium uppercase tracking-wide mt-0.5">
            Activité{uniqueActivities > 1 ? "s" : ""}
          </p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-3 text-center">
          <p className="text-2xl font-black text-gray-800">{uniqueChildren}</p>
          <p className="text-[10px] text-gray-400 font-medium uppercase tracking-wide mt-0.5">
            Enfant{uniqueChildren > 1 ? "s" : ""}
          </p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-3 text-center">
          <p className="text-2xl font-black text-gray-800">{pct}%</p>
          <p className="text-[10px] text-gray-400 font-medium uppercase tracking-wide mt-0.5">Complétés</p>
        </div>
      </div>

      {/* Barre progression */}
      {total > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <div className="flex justify-between items-center mb-2">
            <p className="text-xs font-bold text-gray-700">Progression globale</p>
            <p className="text-xs text-gray-400">{done}/{total} tâche{total > 1 ? "s" : ""}</p>
          </div>
          <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-[#00b22d] rounded-full transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      )}

      {/* Danger zone (admin) */}
      {isAdmin && (
        <button
          type="button"
          onClick={onDelete}
          className="w-full flex items-center justify-center gap-2 h-11 rounded-xl border border-red-200 text-red-500 text-sm font-bold hover:bg-red-50 transition-all"
        >
          <Trash2 className="w-4 h-4" />
          Supprimer cet événement
        </button>
      )}
    </div>
  );
}

// ─── Onglet Activités ─────────────────────────────────────────────────────────
function ActivitesTab({
  tasks, childById, isAdmin, eventId,
}: {
  tasks: ChildTask[];
  childById: Map<string, { firstName: string; lastName: string }>;
  isAdmin: boolean;
  eventId: string;
}) {
  const [showAddTask, setShowAddTask] = useState(false);
  const [taskTitle, setTaskTitle] = useState("");
  const [taskType, setTaskType] = useState<TaskType>("autre");
  const [audienceType, setAudienceType] = useState<"GROUP" | "SINGLE">("GROUP");
  const [targetClass, setTargetClass] = useState<"ALL" | "FIRST" | "SECOND" | "THIRD">("ALL");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const allChildren = useLiveQuery(() => db.children.orderBy("firstName").toArray(), []) ?? [];

  const displayedChildren = useMemo(() => {
    if (audienceType === "SINGLE") return allChildren;
    if (targetClass === "ALL") return allChildren;
    return allChildren.filter((c) => c.classLevel === targetClass);
  }, [allChildren, audienceType, targetClass]);

  const tasksByActivity = useMemo(() => {
    const map = new Map<string, ChildTask[]>();
    for (const task of tasks) {
      const key = `${task.type ?? "autre"}|${task.title}`;
      const list = map.get(key) ?? [];
      list.push(task);
      map.set(key, list);
    }
    return map;
  }, [tasks]);

  const toggleTask = async (task: ChildTask) => {
    await db.tasks.update(task.id, { done: !task.done });
    await markEntityForSync('task', task.id);
  };

  const deleteTask = async (taskId: string) => {
    // On ne peut pas synchroniser la suppression d'une tâche (pas de mécanisme de tombstone),
    // on la supprime juste localement et on retire de la queue de synchro
    await db.pendingSync.delete(`task:${taskId}`);
    await db.tasks.delete(taskId);
  };

  const handleAdd = async () => {
    if (!taskTitle.trim() || selectedIds.length === 0) return;
    setIsLoading(true);
    try {
      const targets = allChildren.filter((c) => selectedIds.includes(c.id));
      const newTasks: ChildTask[] = targets.map((child) => ({
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
      setSelectedIds([]);
      setShowAddTask(false);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-4 pt-2">
      {/* Bouton ajouter */}
      {isAdmin && !showAddTask && (
        <button
          type="button"
          onClick={() => setShowAddTask(true)}
          className="w-full flex items-center justify-center gap-2 h-10 rounded-xl border border-dashed border-gray-300 text-sm font-semibold text-gray-500 hover:text-gray-700 hover:border-gray-400 hover:bg-gray-50 transition-all"
        >
          <Plus className="w-4 h-4" />
          Assigner des tâches
        </button>
      )}

      {/* Formulaire */}
      {isAdmin && showAddTask && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-3">
          <div className="flex justify-between items-center">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">Assigner une tâche</p>
            <button type="button" onClick={() => setShowAddTask(false)} className="text-gray-400 hover:text-gray-600">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="flex gap-2">
            <select
              value={taskType}
              onChange={(e) => setTaskType(e.target.value as TaskType)}
              className="w-1/3 h-9 px-2 rounded-lg border border-gray-200 bg-white text-sm focus:outline-none focus:border-[#00b22d]"
            >
              {TASK_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
            <input
              type="text"
              value={taskTitle}
              onChange={(e) => setTaskTitle(e.target.value)}
              placeholder="Intitulé…"
              autoFocus
              className="flex-1 h-9 px-3 rounded-lg border border-gray-200 bg-white text-sm focus:outline-none focus:border-[#00b22d]"
            />
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => { setAudienceType("GROUP"); setSelectedIds([]); }}
              className={`flex-1 h-8 rounded-lg text-xs font-bold transition-all ${audienceType === "GROUP" ? "bg-[#00b22d] text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
            >Par classe</button>
            <button
              type="button"
              onClick={() => { setAudienceType("SINGLE"); setSelectedIds([]); }}
              className={`flex-1 h-8 rounded-lg text-xs font-bold transition-all ${audienceType === "SINGLE" ? "bg-[#00b22d] text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
            >Sélection libre</button>
          </div>
          {audienceType === "GROUP" && (
            <select
              value={targetClass}
              onChange={(e) => { setTargetClass(e.target.value as any); setSelectedIds([]); }}
              className="w-full h-9 px-3 rounded-lg border border-gray-200 bg-white text-sm focus:outline-none focus:border-[#00b22d]"
            >
              <option value="ALL">Toute l'école du dimanche</option>
              <option value="FIRST">Classe 1</option>
              <option value="SECOND">Classe 2</option>
              <option value="THIRD">Classe 3</option>
            </select>
          )}
          <ChildSelector
            children={displayedChildren}
            selectedIds={selectedIds}
            onChange={setSelectedIds}
            variant="light"
            maxHeight="max-h-40"
          />
          <button
            type="button"
            disabled={!taskTitle.trim() || isLoading || selectedIds.length === 0}
            onClick={handleAdd}
            className="w-full h-9 rounded-lg bg-gray-900 text-white text-sm font-bold disabled:opacity-40 transition-all flex items-center justify-center gap-2 hover:bg-gray-800"
          >
            {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
            Assigner{selectedIds.length > 0 ? ` (${selectedIds.length})` : ""}
          </button>
        </div>
      )}

      {/* Liste activités */}
      {tasksByActivity.size === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <LayoutList className="w-10 h-10 mx-auto mb-2 opacity-30" strokeWidth={1.5} />
          <p className="text-sm">Aucune tâche assignée.</p>
        </div>
      ) : (
        Array.from(tasksByActivity.entries()).map(([activityKey, actTasks]) => {
          const [typeRaw, ...titleParts] = activityKey.split("|");
          const actTitle = titleParts.join("|");
          const config = getTaskTypeConfig(typeRaw as TaskType);
          const TypeIcon = config.icon;
          const doneCount = actTasks.filter((t) => t.done).length;

          return (
            <div key={activityKey} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="flex items-center gap-3 p-4 border-b border-gray-50">
                <div className="w-9 h-9 rounded-lg bg-[#00b22d]/10 flex items-center justify-center text-[#00b22d] shrink-0">
                  <TypeIcon className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-gray-900 truncate">{actTitle}</p>
                  <p className="text-[10px] text-gray-400 uppercase tracking-widest font-semibold">{config.label}</p>
                </div>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                  doneCount === actTasks.length ? "bg-[#00b22d]/10 text-[#00b22d]" : "bg-gray-100 text-gray-500"
                }`}>
                  {doneCount}/{actTasks.length}
                </span>
              </div>
              <div className="divide-y divide-gray-50">
                {actTasks.map((task) => {
                  const child = childById.get(task.childId);
                  const childName = child ? `${child.lastName} ${child.firstName}` : "Enfant inconnu";
                  return (
                    <div key={task.id} className="flex items-center gap-3 px-4 py-2.5 group">
                      <button
                        type="button"
                        onClick={() => toggleTask(task)}
                        className="shrink-0 text-gray-300 hover:text-gray-500 transition-colors"
                      >
                        {task.done
                          ? <CheckCircle2 className="w-5 h-5 text-[#00b22d]" />
                          : <Circle className="w-5 h-5" />}
                      </button>
                      <span className={`flex-1 text-sm font-medium ${task.done ? "line-through text-gray-400" : "text-gray-800"}`}>
                        {childName}
                      </span>
                      {isAdmin && (
                        <button
                          type="button"
                          onClick={() => deleteTask(task.id)}
                          className="shrink-0 text-gray-300 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}

// ─── Onglet Participants ──────────────────────────────────────────────────────
function ParticipantsTab({
  tasks, childById,
}: {
  tasks: ChildTask[];
  childById: Map<string, Child>;
}) {
  const [selectedChild, setSelectedChild] = useState<Child | null>(null);
  const tasksByChild = useMemo(() => {
    const map = new Map<string, ChildTask[]>();
    for (const task of tasks) {
      const list = map.get(task.childId) ?? [];
      list.push(task);
      map.set(task.childId, list);
    }
    return map;
  }, [tasks]);

  if (tasksByChild.size === 0) {
    return (
      <div className="text-center py-12 text-gray-400 pt-6">
        <Users className="w-10 h-10 mx-auto mb-2 opacity-30" strokeWidth={1.5} />
        <p className="text-sm">Aucun participant pour l'instant.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3 pt-2">
      {Array.from(tasksByChild.entries()).map(([childId, childTasks]) => {
        const child = childById.get(childId);
        const childName = child ? `${child.lastName} ${child.firstName}` : "Enfant inconnu";
        const done = childTasks.filter((t) => t.done).length;
        const total = childTasks.length;
        const pct = total > 0 ? Math.round((done / total) * 100) : 0;

        return (
          <div key={childId} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            {/* En-tête enfant — cliquable pour ouvrir la modale */}
            <button
              type="button"
              onClick={() => child && setSelectedChild(child)}
              className="w-full flex items-center gap-3 p-4 border-b border-gray-50 text-left hover:bg-gray-50/70 transition-colors"
            >
              {/* Avatar (photo ou initiale) */}
              {child?.photoUrl ? (
                <img
                  src={child.photoUrl}
                  alt={childName}
                  className="w-10 h-10 rounded-full object-cover shrink-0 border-2 border-white shadow-sm"
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#00b22d]/20 to-[#00b22d]/5 flex items-center justify-center text-[#00b22d] font-black text-base shrink-0 border-2 border-white shadow-sm">
                  {(child?.firstName?.[0] ?? "?").toUpperCase()}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="font-bold text-gray-900 truncate">{childName}</p>
                <div className="flex items-center gap-2 mt-1">
                  <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#00b22d] rounded-full transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="text-[10px] text-gray-400 font-semibold whitespace-nowrap">{done}/{total}</span>
                </div>
              </div>
            </button>
            <div className="divide-y divide-gray-50">
              {childTasks.map((task) => {
                const config = getTaskTypeConfig(task.type);
                const TypeIcon = config.icon;
                return (
                  <div key={task.id} className="flex items-center gap-3 px-4 py-2.5">
                    {task.done
                      ? <CheckCircle2 className="w-4 h-4 text-[#00b22d] shrink-0" />
                      : <Circle className="w-4 h-4 text-gray-300 shrink-0" />}
                    <TypeIcon className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                    <span className={`flex-1 text-sm ${task.done ? "line-through text-gray-400" : "text-gray-700"}`}>
                      {task.title}
                    </span>
                    <span className="text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded shrink-0">
                      {config.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* Modale détail enfant */}
      {selectedChild && (
        <ChildDetailsModal
          child={selectedChild}
          onClose={() => setSelectedChild(null)}
        />
      )}
    </div>
  );
}

// ─── Page principale ─────────────────────────────────────────────────────────
export default function EventDetailPage() {
  const params = useParams();
  const router = useRouter();
  const eventId = params.id as string;
  const { data: session } = useSession();
  const isAdmin = (session?.user as any)?.role === "ADMIN";

  const [activeTab, setActiveTab] = useState<Tab>("infos");

  const event = useLiveQuery(() => db.events.get(eventId), [eventId]);
  const tasks = useLiveQuery(() => db.tasks.where("eventId").equals(eventId).toArray(), [eventId]) ?? [];
  const children = useLiveQuery(() => db.children.toArray(), []);

  const childById = useMemo(() => {
    const map = new Map<string, Child>();
    (children ?? []).forEach((c) => map.set(c.id, c));
    return map;
  }, [children]);

  const handleDelete = async () => {
    if (!confirm("Supprimer cet événement et toutes ses tâches ?")) return;
    // Récupérer les IDs des tâches avant suppression
    const eventTasks = await db.tasks.where("eventId").equals(eventId).toArray();
    const taskIds = eventTasks.map((t) => t.id);
    // Supprimer les tâches et l'événement
    await db.tasks.where("eventId").equals(eventId).delete();
    await db.events.delete(eventId);
    // Nettoyer la file de synchro
    const keysToDelete = [
      `event:${eventId}`,
      ...taskIds.map((id) => `task:${id}`),
    ];
    await db.pendingSync.bulkDelete(keysToDelete);
    router.back();
  };

  if (event === undefined) {
    return (
      <main className="flex min-h-screen flex-col bg-gray-50">
        <MobileHeader title="Événement" />
        <div className="flex justify-center items-center flex-1">
          <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
        </div>
      </main>
    );
  }

  if (event === null) {
    return (
      <main className="flex min-h-screen flex-col bg-gray-50">
        <MobileHeader title="Introuvable" />
        <div className="flex flex-col justify-center items-center flex-1 gap-4 text-gray-400">
          <CalendarDays className="w-12 h-12 opacity-30" strokeWidth={1.5} />
          <p className="text-sm">Cet événement n'existe pas.</p>
          <button onClick={() => router.back()} className="text-[#00b22d] text-sm font-bold">← Retour</button>
        </div>
      </main>
    );
  }

  const tabs: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: "infos", label: "Infos", icon: Info },
    { id: "activites", label: "Activités", icon: LayoutList },
    { id: "participants", label: "Participants", icon: Users },
  ];

  return (
    <main className="flex min-h-screen flex-col bg-gray-50 pb-10">
      <MobileHeader
        title={event.title}
        rightElement={
          <button onClick={() => router.back()} className="flex items-center gap-1 text-white/80 hover:text-white text-sm font-semibold">
            <ArrowLeft className="w-4 h-4" />
          </button>
        }
      />

      {/* Onglets */}
      <div className="sticky top-0 z-10 bg-white border-b border-gray-100 shadow-sm">
        <div className="flex max-w-md mx-auto w-full">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 flex flex-col items-center gap-1 py-3 text-xs font-bold transition-all border-b-2 ${
                  isActive
                    ? "border-[#00b22d] text-[#00b22d]"
                    : "border-transparent text-gray-400 hover:text-gray-600"
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Contenu */}
      <div className="p-4 max-w-md mx-auto w-full">
        {activeTab === "infos" && (
          <InfosTab
            title={event.title}
            date={event.date}
            description={event.description}
            tasks={tasks}
            isAdmin={isAdmin}
            eventId={eventId}
            onDelete={handleDelete}
          />
        )}
        {activeTab === "activites" && (
          <ActivitesTab
            tasks={tasks}
            childById={childById}
            isAdmin={isAdmin}
            eventId={eventId}
          />
        )}
        {activeTab === "participants" && (
          <ParticipantsTab
            tasks={tasks}
            childById={childById}
          />
        )}
      </div>
    </main>
  );
}
