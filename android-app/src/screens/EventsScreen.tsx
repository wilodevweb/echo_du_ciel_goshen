import React, { memo, useMemo, useState } from 'react';
import { Alert, FlatList, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ScreenHeader } from './ScreenHeader';
import type { Child, ChildTask, SchoolEvent } from '../types';
import type { ClassLevel } from '../types';

export interface EventsScreenProps {
  events: SchoolEvent[];
  tasks: ChildTask[];
  childRecords: Child[];
  onBack: () => void;
  isAdmin: boolean;
  onCreateEvent: (event: SchoolEvent) => Promise<void>;
  onSaveTasks: (tasks: ChildTask[]) => Promise<void>;
  onToggleTask: (task: ChildTask) => Promise<void>;
}

export const EventsScreen = memo(function EventsScreen({ events, tasks, childRecords: children, onBack, isAdmin, onCreateEvent, onSaveTasks, onToggleTask }: EventsScreenProps) {
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(localDate(new Date()));
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const childNames = useMemo(() => new Map(children.map(child => [child.id, `${child.firstName} ${child.lastName}`.trim()])), [children]);
  const sortedEvents = useMemo(() => [...events].sort((a, b) => a.date.localeCompare(b.date)), [events]);
  const tasksByEvent = useMemo(() => {
    const grouped = new Map<string, ChildTask[]>();
    for (const task of tasks) {
      const eventTasks = grouped.get(task.eventId) ?? [];
      eventTasks.push(task);
      grouped.set(task.eventId, eventTasks);
    }
    return grouped;
  }, [tasks]);

  return <SafeAreaView style={styles.root}>
    <ScreenHeader title="Événements" onBack={onBack} />
    <FlatList
      data={sortedEvents}
      keyExtractor={event => event.id}
      renderItem={({ item }) => <EventCard event={item} tasks={tasksByEvent.get(item.id) ?? []} childRecords={children} childNames={childNames} isAdmin={isAdmin} onSaveTasks={onSaveTasks} onToggleTask={onToggleTask} />}
      ListHeaderComponent={isAdmin ? <View style={styles.createBox}>{creating ? <><Text style={styles.formTitle}>Nouvel événement</Text><TextInput value={title} onChangeText={setTitle} placeholder="Nom de l’événement" style={styles.input} /><TextInput value={date} onChangeText={setDate} placeholder="AAAA-MM-JJ" style={styles.input} /><TextInput value={description} onChangeText={setDescription} placeholder="Description (facultative)" style={styles.input} /><View style={styles.formButtons}><Pressable onPress={() => setCreating(false)} style={styles.cancelButton}><Text style={styles.cancelText}>Annuler</Text></Pressable><Pressable disabled={!title.trim() || saving} onPress={async () => { setSaving(true); try { await onCreateEvent({ id: `mobile-${Date.now()}`, title: title.trim(), date: date.trim() || localDate(new Date()), description: description.trim() || null, createdAt: new Date().toISOString() }); setTitle(''); setDescription(''); setCreating(false); } finally { setSaving(false); } }} style={styles.createButton}><Text style={styles.createText}>{saving ? 'Enregistrement…' : 'Créer'}</Text></Pressable></View></> : <Pressable onPress={() => setCreating(true)} style={styles.addEvent}><Text style={styles.addEventText}>＋ Nouvel événement</Text></Pressable>}</View> : null}
      ListEmptyComponent={<Text style={styles.empty}>Aucun événement disponible pour le moment.</Text>}
      contentContainerStyle={styles.list}
      initialNumToRender={8}
      windowSize={7}
      removeClippedSubviews
    />
  </SafeAreaView>;
});

const EventCard = memo(function EventCard({ event, tasks, childNames, childRecords: children, isAdmin, onSaveTasks, onToggleTask }: {
  event: SchoolEvent;
  tasks: ChildTask[];
  childRecords: Child[];
  childNames: Map<string, string>;
  isAdmin: boolean;
  onSaveTasks: (tasks: ChildTask[]) => Promise<void>;
  onToggleTask: (task: ChildTask) => Promise<void>;
}) {
  const [expanded, setExpanded] = useState(false);
  const [addingTask, setAddingTask] = useState(false);
  const [taskTitle, setTaskTitle] = useState('');
  const [taskType, setTaskType] = useState('autre');
  const [targetClass, setTargetClass] = useState<ClassLevel | 'ALL'>('ALL');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [childQuery, setChildQuery] = useState('');
  const [childPickerOpen, setChildPickerOpen] = useState(false);
  const [savingTasks, setSavingTasks] = useState(false);
  const selectedIdSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const searchableChildren = useMemo(() => children.map(child => ({
    child,
    normalizedName: `${child.firstName} ${child.lastName} ${child.postName}`.toLocaleLowerCase('fr'),
  })), [children]);
  const eligibleChildren = useMemo(() => {
    const normalized = childQuery.trim().toLocaleLowerCase('fr');
    return searchableChildren.filter(({ child, normalizedName }) => (targetClass === 'ALL' || child.classLevel === targetClass)
      && (!normalized || normalizedName.includes(normalized))).map(({ child }) => child);
  }, [searchableChildren, childQuery, targetClass]);
  const completedCount = useMemo(() => tasks.reduce((count, task) => count + Number(task.done), 0), [tasks]);
  return <View style={styles.card}>
    <Pressable accessibilityRole="button" onPress={() => setExpanded(value => !value)} style={styles.eventHeader}>
      <View style={styles.dateBadge}><Text style={styles.dateDay}>{new Date(`${event.date}T12:00:00`).toLocaleDateString('fr-FR', { day: 'numeric' })}</Text><Text style={styles.dateMonth}>{new Date(`${event.date}T12:00:00`).toLocaleDateString('fr-FR', { month: 'short' }).toUpperCase()}</Text></View>
      <View style={styles.eventCopy}><Text numberOfLines={2} style={styles.title}>{event.title}</Text><Text style={styles.detail}>{new Date(`${event.date}T12:00:00`).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</Text></View>
      <Text style={styles.chevron}>{expanded ? '⌃' : '⌄'}</Text>
    </Pressable>
    {event.description ? <Text style={styles.description}>{event.description}</Text> : null}
    <Text style={styles.taskSummary}>{tasks.length ? `${completedCount}/${tasks.length} tâches terminées` : 'Aucune tâche associée'}</Text>
    {expanded ? <>
      {tasks.map(task => <Pressable accessibilityRole="button" key={task.id} onPress={() => void onToggleTask(task)} style={styles.taskRow}><Text style={[styles.taskMark, task.done && styles.taskDone]}>{task.done ? '✓' : '○'}</Text><View style={styles.taskCopy}><Text style={styles.taskTitle}>{task.title}</Text><Text style={styles.detail}>{childNames.get(task.childId) ?? 'Enfant'} · {task.type ?? 'Autre'}</Text></View></Pressable>)}
      {isAdmin && !addingTask ? <Pressable onPress={() => setAddingTask(true)} style={styles.assignButton}><Text style={styles.assignText}>＋ Assigner des tâches</Text></Pressable> : null}
      {isAdmin && addingTask ? <View style={styles.taskForm}><Text style={styles.formTitle}>Assigner une activité</Text><TextInput value={taskTitle} onChangeText={setTaskTitle} placeholder="Intitulé de la tâche" style={styles.input} /><View style={styles.typeRow}>{TASK_TYPES.map(type => <Pressable key={type.id} onPress={() => setTaskType(type.id)} style={[styles.typeChoice, taskType === type.id && styles.typeActive]}><Text style={[styles.typeText, taskType === type.id && styles.createText]}>{type.label}</Text></Pressable>)}</View><View style={styles.typeRow}>{(['ALL', 'FIRST', 'SECOND', 'THIRD'] as const).map(level => <Pressable key={level} onPress={() => { setTargetClass(level); setSelectedIds([]); }} style={[styles.typeChoice, targetClass === level && styles.typeActive]}><Text style={[styles.typeText, targetClass === level && styles.createText]}>{level === 'ALL' ? 'Toutes' : level === 'FIRST' ? '1ère' : level === 'SECOND' ? '2e' : '3e'}</Text></Pressable>)}</View><Pressable accessibilityRole="button" onPress={() => setChildPickerOpen(true)} style={styles.childPickerButton}><Text style={styles.childPickerText}>{selectedIds.length ? `${selectedIds.length} enfant(s) sélectionné(s) · Modifier` : 'Choisir les enfants'}</Text></Pressable><View style={styles.formButtons}><Pressable onPress={() => setAddingTask(false)} style={styles.cancelButton}><Text style={styles.cancelText}>Annuler</Text></Pressable><Pressable disabled={!taskTitle.trim() || !selectedIds.length || savingTasks} onPress={async () => {
        if (!taskTitle.trim() || !selectedIds.length || savingTasks) return;
        const targets = children.filter(child => selectedIdSet.has(child.id));
        const createdAt = new Date().toISOString();
        const newTasks = targets.map(child => ({
          id: 'mobile-' + Date.now() + '-' + child.id,
          eventId: event.id,
          childId: child.id,
          title: taskTitle.trim(),
          type: taskType,
          done: false,
          createdAt,
        }));
        setSavingTasks(true);
        try {
          await onSaveTasks(newTasks);
          setAddingTask(false);
          setTaskTitle('');
          setSelectedIds([]);
        } catch (cause) {
          Alert.alert('Attribution impossible', cause instanceof Error ? cause.message : 'Les tâches n’ont pas pu être enregistrées.');
        } finally {
          setSavingTasks(false);
        }
      }} style={styles.createButton}><Text style={styles.createText}>{savingTasks ? 'Enregistrement…' : 'Assigner (' + selectedIds.length + ')'}</Text></Pressable></View></View> : null}
    </> : null}
    <Modal visible={childPickerOpen} animationType="slide" onRequestClose={() => setChildPickerOpen(false)}>
      <SafeAreaView style={styles.pickerRoot}>
        <View style={styles.pickerHeader}><Text style={styles.formTitle}>Choisir les enfants</Text><Pressable onPress={() => setChildPickerOpen(false)}><Text style={styles.assignText}>Terminé ({selectedIds.length})</Text></Pressable></View>
        <TextInput value={childQuery} onChangeText={setChildQuery} placeholder="Rechercher un enfant" style={styles.input} returnKeyType="search" />
        <FlatList data={eligibleChildren} keyExtractor={child => child.id} initialNumToRender={16} maxToRenderPerBatch={16} windowSize={7} keyboardShouldPersistTaps="handled" ListEmptyComponent={<Text style={styles.empty}>Aucun enfant trouvé.</Text>} renderItem={({ item: child }) => {
          const selected = selectedIdSet.has(child.id);
          return <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: selected }} onPress={() => setSelectedIds(current => current.includes(child.id) ? current.filter(id => id !== child.id) : [...current, child.id])} style={[styles.pickerRow, selected && styles.typeActive]}><Text style={[styles.typeText, selected && styles.createText]}>{child.firstName} {child.lastName} {child.postName}</Text><Text style={[styles.typeText, selected && styles.createText]}>{selected ? '✓' : ''}</Text></Pressable>;
        }} />
      </SafeAreaView>
    </Modal>
  </View>;
});

const TASK_TYPES = [{ id: 'chant', label: 'Chant' }, { id: 'poeme', label: 'Poème' }, { id: 'emission', label: 'Émission' }, { id: 'sketch', label: 'Sketch' }, { id: 'theatre', label: 'Théâtre' }, { id: 'autre', label: 'Autre' }];
const localDate = (value: Date) => `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
const styles = StyleSheet.create({ root: { flex: 1, backgroundColor: '#f9fafb' }, list: { paddingHorizontal: 16, paddingBottom: 24 }, createBox: { paddingTop: 6, paddingBottom: 12 }, addEvent: { height: 46, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: '#00b22d' }, addEventText: { color: '#fff', fontSize: 12, fontWeight: '800' }, createButton: { flex: 1, minHeight: 38, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center', borderRadius: 10, backgroundColor: '#00b22d' }, createText: { color: '#fff', fontSize: 11, fontWeight: '800' }, formTitle: { marginBottom: 9, color: '#111827', fontSize: 12, fontWeight: '800' }, input: { minHeight: 42, marginBottom: 8, paddingHorizontal: 11, borderRadius: 10, borderWidth: 1, borderColor: '#e5e7eb', backgroundColor: '#fff', color: '#1f2937', fontSize: 12 }, formButtons: { flexDirection: 'row', gap: 8, marginTop: 4 }, cancelButton: { flex: 1, minHeight: 38, alignItems: 'center', justifyContent: 'center', borderRadius: 10, backgroundColor: '#f3f4f6' }, cancelText: { color: '#6b7280', fontSize: 11, fontWeight: '700' }, card: { marginBottom: 11, padding: 14, borderRadius: 15, borderWidth: 1, borderColor: '#f3f4f6', backgroundColor: '#fff' }, eventHeader: { flexDirection: 'row', alignItems: 'center' }, dateBadge: { width: 48, height: 52, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: '#00b22d18' }, dateDay: { color: '#00b22d', fontSize: 18, fontWeight: '900' }, dateMonth: { marginTop: -1, color: '#00b22d', fontSize: 9, fontWeight: '800' }, eventCopy: { flex: 1, marginHorizontal: 11 }, title: { color: '#111827', fontSize: 14, fontWeight: '800' }, detail: { marginTop: 4, color: '#6b7280', fontSize: 10, textTransform: 'capitalize' }, chevron: { color: '#9ca3af', fontSize: 18, paddingHorizontal: 4 }, description: { marginTop: 12, color: '#4b5563', fontSize: 12, lineHeight: 18 }, taskSummary: { marginTop: 11, color: '#00a72b', fontSize: 10, fontWeight: '700' }, taskRow: { flexDirection: 'row', alignItems: 'flex-start', marginTop: 10, paddingTop: 9, borderTopWidth: 1, borderColor: '#f3f4f6' }, taskMark: { color: '#9ca3af', fontSize: 16 }, taskDone: { color: '#00b22d' }, taskCopy: { marginLeft: 9 }, taskTitle: { color: '#374151', fontSize: 11, fontWeight: '700' }, empty: { paddingVertical: 36, textAlign: 'center', color: '#6b7280', fontSize: 13 }, assignButton: { marginTop: 12, paddingVertical: 10, alignItems: 'center', borderRadius: 10, backgroundColor: '#f3f4f6' }, assignText: { color: '#374151', fontSize: 11, fontWeight: '800' }, taskForm: { marginTop: 12, padding: 11, borderRadius: 12, backgroundColor: '#f9fafb' }, typeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginBottom: 8 }, typeChoice: { paddingHorizontal: 8, paddingVertical: 7, borderRadius: 8, backgroundColor: '#e5e7eb' }, typeActive: { backgroundColor: '#00b22d' }, typeText: { color: '#4b5563', fontSize: 9, fontWeight: '700' }, childPickerButton: { minHeight: 40, justifyContent: 'center', paddingHorizontal: 10, marginBottom: 8, borderRadius: 9, backgroundColor: '#e5e7eb' }, childPickerText: { color: '#374151', fontSize: 11, fontWeight: '700' }, pickerRoot: { flex: 1, padding: 16, backgroundColor: '#f9fafb' }, pickerHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10 }, pickerRow: { minHeight: 48, marginBottom: 6, paddingHorizontal: 12, borderRadius: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#e5e7eb' } });
