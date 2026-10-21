import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, AppState, BackHandler, StyleSheet, Text, View } from 'react-native';
import NetInfo, { type NetInfoState } from '@react-native-community/netinfo';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AdminScreen } from './screens/AdminScreen';
import { ChildrenScreen } from './screens/ChildrenScreen';
import { EventsScreen } from './screens/EventsScreen';
import { FamiliesScreen } from './screens/FamiliesScreen';
import { HomeScreen } from './screens/HomeScreen';
import { LoginScreen } from './screens/LoginScreen';
import { NotificationsScreen } from './screens/NotificationsScreen';
import { buildNotificationSections, countNotifiedChildren } from './notifications';
import { ResourcesScreen } from './screens/ResourcesScreen';
import { syncData } from './services/syncRepository';
import { ApiError } from './services/api';
import { recordAttendance as persistAttendance } from './services/attendanceRepository';
import { storage } from './services/storage';
import type { Attendance, AttendanceStatus, Child, ChildTask, EditableChildField, Parent, SchoolEvent, Session } from './types';

type Screen = 'login' | 'home' | 'children' | 'families' | 'events' | 'notifications' | 'resources' | 'admin';
type ChildrenStartTarget = { kind: 'new' } | { kind: 'edit'; childId: string } | null;

function mergeChildUpdate(current: Child | undefined, update: Child, fields?: EditableChildField[]): Child {
  if (!current || !fields?.length) return update;
  return { ...current, ...Object.fromEntries(fields.map(field => [field, update[field]])) };
}

export default function App() {
  return <SafeAreaProvider><AppContent /></SafeAreaProvider>;
}

function AppContent() {
  const [screen, setScreen] = useState<Screen>('login');
  const [childrenStartTarget, setChildrenStartTarget] = useState<ChildrenStartTarget>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [children, setChildren] = useState<Child[]>([]);
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [parents, setParents] = useState<Parent[]>([]);
  const [events, setEvents] = useState<SchoolEvent[]>([]);
  const [tasks, setTasks] = useState<ChildTask[]>([]);
  const [online, setOnline] = useState<boolean | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState('');
  const [initialized, setInitialized] = useState(false);
  const [appState, setAppState] = useState(AppState.currentState);
  const syncInFlight = useRef<Promise<void> | null>(null);
  const syncRequested = useRef(false);
  const onlineRef = useRef(online);
  const sessionRef = useRef(session);
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryAttempt = useRef(0);
  const runSyncRef = useRef<(activeSession: Session) => Promise<void>>(async () => undefined);
  const notificationSections = useMemo(() => buildNotificationSections(children, attendance), [attendance, children]);
  const alertsCount = useMemo(() => countNotifiedChildren(notificationSections), [notificationSections]);

  useEffect(() => {
    let active = true;
    void storage.getStartupData()
      .then(({ session: savedSession, children: savedChildren, attendance: savedAttendance, parents: savedParents, events: savedEvents, tasks: savedTasks }) => {
        if (!active) return;
        setSession(savedSession);
        setChildren(savedChildren);
        setAttendance(savedAttendance);
        setParents(savedParents);
        setEvents(savedEvents);
        setTasks(savedTasks);
        if (savedSession) setScreen('home');
      })
      .catch(error => {
        if (active) setSyncMessage(error instanceof Error ? error.message : 'Impossible de charger les données locales.');
      })
      .finally(() => {
        if (active) setInitialized(true);
      });
    const unsubscribe = NetInfo.addEventListener((state: NetInfoState) => setOnline(Boolean(state.isConnected && state.isInternetReachable !== false)));
    void NetInfo.fetch().then(state => {
      if (active) setOnline(Boolean(state.isConnected && state.isInternetReachable !== false));
    }).catch(() => undefined);
    const appStateSubscription = AppState.addEventListener('change', setAppState);
    return () => {
      active = false;
      unsubscribe();
      appStateSubscription.remove();
      if (retryTimer.current) clearTimeout(retryTimer.current);
    };
  }, []);

  useEffect(() => {
    onlineRef.current = online;
    if (online !== true && retryTimer.current) {
      clearTimeout(retryTimer.current);
      retryTimer.current = null;
    }
  }, [online]);

  useEffect(() => {
    sessionRef.current = session;
    if (!session && retryTimer.current) {
      clearTimeout(retryTimer.current);
      retryTimer.current = null;
      retryAttempt.current = 0;
    }
  }, [session]);

  const runSync = useCallback(async (activeSession: Session) => {
    if (onlineRef.current !== true) { setSyncMessage('Connectez-vous à Internet pour synchroniser.'); return; }
    if (syncInFlight.current) {
      syncRequested.current = true;
      return syncInFlight.current;
    }
    setSyncing(true);
    setSyncMessage('');
    const task = (async () => {
      let continueWithMore = false;
      try {
        let hasMore = false;
        let batchCount = 0;
        do {
          syncRequested.current = false;
          do {
            const result = await syncData(activeSession);
            hasMore = result.hasMore === true;
            batchCount += 1;
          } while (hasMore && batchCount < 12 && onlineRef.current === true);
        } while (syncRequested.current && batchCount < 12 && onlineRef.current === true);
        hasMore = hasMore || syncRequested.current;
        continueWithMore = hasMore;
        retryAttempt.current = 0;
        if (retryTimer.current) {
          clearTimeout(retryTimer.current);
          retryTimer.current = null;
        }
        const [nextChildren, nextAttendance, nextParents, nextEvents, nextTasks] = await Promise.all([
          storage.getChildren(), storage.getAttendance(), storage.getParents(), storage.getEvents(), storage.getTasks(),
        ]);
        setChildren(nextChildren);
        setAttendance(nextAttendance);
        setParents(nextParents);
        setEvents(nextEvents);
        setTasks(nextTasks);
        setSyncMessage(hasMore ? 'Synchronisation partielle, suite en cours…' : 'Données synchronisées.');
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) {
          retryAttempt.current = 0;
          if (retryTimer.current) {
            clearTimeout(retryTimer.current);
            retryTimer.current = null;
          }
          await storage.clearSession().catch(() => undefined);
          setSession(null);
          setScreen('login');
          setSyncMessage('Session expirée. Reconnectez-vous pour synchroniser.');
          Alert.alert('Session expirée', 'Reconnectez-vous pour continuer à synchroniser vos données.');
          return;
        }
        setSyncMessage(error instanceof Error ? error.message : 'Synchronisation impossible.');
        if (onlineRef.current === true && sessionRef.current?.token === activeSession.token && !retryTimer.current) {
          const delays = [5_000, 15_000, 30_000, 60_000];
          const delay = delays[Math.min(retryAttempt.current, delays.length - 1)];
          retryAttempt.current += 1;
          retryTimer.current = setTimeout(() => {
            retryTimer.current = null;
            const currentSession = sessionRef.current;
            if (onlineRef.current === true && currentSession) void runSyncRef.current(currentSession);
          }, delay);
        }
      } finally {
        syncRequested.current = false;
        setSyncing(false);
        syncInFlight.current = null;
        if (continueWithMore && onlineRef.current === true && sessionRef.current?.token === activeSession.token && !retryTimer.current) {
          retryTimer.current = setTimeout(() => {
            retryTimer.current = null;
            const currentSession = sessionRef.current;
            if (onlineRef.current === true && currentSession) void runSyncRef.current(currentSession);
          }, 750);
        }
      }
    })();
    syncInFlight.current = task;
    return task;
  }, []);

  useEffect(() => {
    runSyncRef.current = runSync;
  }, [runSync]);

  useEffect(() => {
    if (online === true && appState === 'active' && session) void runSync(session);
  }, [online, appState, session, runSync]);

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (screen !== 'home' && screen !== 'login') { setScreen('home'); return true; }
      return screen !== 'login';
    });
    return () => subscription.remove();
  }, [screen]);

  const record = useCallback(async (childId: string, date: string, status: AttendanceStatus) => {
    try {
      setAttendance(await persistAttendance(childId, date, status));
      if (online === true && session) await runSync(session);
    } catch (error) {
      setSyncMessage(error instanceof Error ? error.message : 'Impossible d’enregistrer la présence.');
    }
  }, [online, runSync, session]);
  const handleAttendanceSave = useCallback((childId: string, date: string, status: AttendanceStatus) => {
    void record(childId, date, status);
  }, [record]);

  const signOut = useCallback(() => {
    Alert.alert('Se déconnecter ?', 'Les présences enregistrées sur cet appareil sont conservées.', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Se déconnecter', style: 'destructive', onPress: () => { void storage.clearSession(); setSession(null); setScreen('login'); } },
    ]);
  }, []);

  if (!initialized) return <View style={styles.loading}>
    <ActivityIndicator color="#00a72b" size="large" />
    <Text style={styles.loadingText}>Chargement de vos données…</Text>
  </View>;
  if (!session || screen === 'login') return <LoginScreen onSignedIn={async nextSession => {
    await storage.saveSession(nextSession);
    setSession(nextSession);
    setScreen('home');
  }} />;
  if (screen === 'children') return <ChildrenScreen childRecords={children} initialCreate={childrenStartTarget?.kind === 'new'} initialChildId={childrenStartTarget?.kind === 'edit' ? childrenStartTarget.childId : undefined} onInitialTargetHandled={() => setChildrenStartTarget(null)} onBack={() => { setChildrenStartTarget(null); setScreen('home'); }} onSaveChild={async (child, fields) => {
    await storage.upsertChildrenAndMark([child], [{ entity: 'child', id: child.id, fields }]);
    setChildren(current => {
      const existing = current.find(item => item.id === child.id);
      const updated = mergeChildUpdate(existing, child, fields);
      return existing ? current.map(item => item.id === child.id ? updated : item) : [...current, updated];
    });
    if (online === true && session) await runSync(session);
  }} />;
  if (screen === 'families') return <FamiliesScreen parents={parents} childRecords={children} onBack={() => setScreen('home')} />;
  if (screen === 'events') return <EventsScreen events={events} tasks={tasks} childRecords={children} isAdmin={session.role === 'ADMIN'} onBack={() => setScreen('home')}
    onCreateEvent={async event => {
      await storage.upsertEventsAndMark([event], [{ entity: 'event', id: event.id }]);
      setEvents(current => [...current.filter(item => item.id !== event.id), event]);
      if (online === true) await runSync(session);
    }}
    onSaveTasks={async newTasks => {
      if (!newTasks.length) return;
      await storage.upsertTasksAndMark(newTasks, newTasks.map(task => ({ entity: 'task' as const, id: task.id })));
      const newIds = new Set(newTasks.map(task => task.id));
      setTasks(current => [...current.filter(task => !newIds.has(task.id)), ...newTasks]);
      if (online === true) await runSync(session);
    }}
    onToggleTask={async task => {
      const updated = { ...task, done: !task.done };
      await storage.upsertTasksAndMark([updated], [{ entity: 'task', id: task.id }]);
      setTasks(current => current.map(item => item.id === task.id ? updated : item));
      if (online === true) await runSync(session);
    }} />;
  if (screen === 'notifications') return <NotificationsScreen sections={notificationSections} isAdmin={session.role === 'ADMIN'} onBack={() => setScreen('home')} onUpdateChild={async (child, fields) => {
    await storage.upsertChildrenAndMark([child], [{ entity: 'child', id: child.id, fields }]);
    setChildren(current => current.map(item => item.id === child.id ? mergeChildUpdate(item, child, fields) : item));
    if (online === true) await runSync(session);
  }} />;
  if (screen === 'resources') return <ResourcesScreen session={session} isAdmin={session.role === 'ADMIN'} onBack={() => setScreen('home')} />;
  if (screen === 'admin' && session.role === 'ADMIN') return <AdminScreen session={session} onBack={() => setScreen('home')} />;
  return <HomeScreen
    session={session}
    isAdmin={session.role === 'ADMIN'}
    childRecords={children}
    attendance={attendance}
    alertsCount={alertsCount}
    onSaveAttendance={handleAttendanceSave}
    onAddChild={() => { setChildrenStartTarget({ kind: 'new' }); setScreen('children'); }}
    onSelectChild={childId => { setChildrenStartTarget({ kind: 'edit', childId }); setScreen('children'); }}
    onChildren={() => setScreen('children')}
    onFamilies={() => setScreen('families')}
    onEvents={() => setScreen('events')}
    onNotifications={() => setScreen('notifications')}
    onResources={() => setScreen('resources')}
    onAdmin={() => setScreen('admin')}
    onSignOut={signOut}
    syncing={syncing}
    online={online}
    syncMessage={syncMessage}
  />;
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f5f8f6' },
  loadingText: { marginTop: 12, color: '#69756e', fontSize: 14 },
});
