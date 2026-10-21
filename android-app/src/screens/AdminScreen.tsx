import React, { memo, useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ScreenHeader } from './ScreenHeader';
import { getMobileAdmin, postMobileAdmin } from '../services/api';
import type { ActivityLog, AdminUser, Session } from '../types';

export interface AdminScreenProps { session: Session; onBack: () => void; }

export const AdminScreen = memo(function AdminScreen({ session, onBack }: AdminScreenProps) {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [currentUserId, setCurrentUserId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [title, setTitle] = useState('Moniteur');
  const [password, setPassword] = useState('');
  const [working, setWorking] = useState(false);
  const refresh = useCallback(async () => {
    const result = await getMobileAdmin(session);
    setUsers(result.users);
    setLogs(result.logs);
    setCurrentUserId(result.currentUserId);
  }, [session]);
  useEffect(() => {
    let alive = true;
    void getMobileAdmin(session).then(result => { if (alive) { setUsers(result.users); setLogs(result.logs); setCurrentUserId(result.currentUserId); } }).catch(cause => {
      if (alive) setError(cause instanceof Error ? cause.message : 'Administration indisponible.');
    }).finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [session]);
  const createUser = useCallback(async () => {
    setWorking(true);
    setError('');
    try {
      await postMobileAdmin(session, { action: 'create-user', name, username, title, password });
      setName(''); setUsername(''); setTitle('Moniteur'); setPassword(''); setShowForm(false);
      await refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Création du compte impossible.'); }
    finally { setWorking(false); }
  }, [name, password, refresh, session, title, username]);
  const toggleBlock = useCallback(async (user: AdminUser) => {
    setWorking(true); setError('');
    try { await postMobileAdmin(session, { action: 'toggle-block', userId: user.id, isBlocked: !user.isBlocked }); await refresh(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Modification du compte impossible.'); }
    finally { setWorking(false); }
  }, [refresh, session]);
  return <SafeAreaView style={styles.root}>
    <ScreenHeader title="Administration" variant="dark" onBack={onBack} />
    {loading ? <ActivityIndicator style={styles.loader} color="#00b22d" /> : error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : <FlatList
      data={logs}
      keyExtractor={item => item.id}
      renderItem={({ item }) => <View style={styles.log}><Text style={styles.logTitle}>{item.action.replaceAll('_', ' ')}</Text><Text style={styles.logBody}>{item.details}</Text><Text style={styles.meta}>{item.userFullName || item.username} · {new Date(item.createdAt).toLocaleString('fr-FR')}</Text></View>}
      ListHeaderComponent={<><Text style={styles.heading}>Comptes ({users.length})</Text><Pressable onPress={() => setShowForm(value => !value)} style={styles.addButton}><Text style={styles.addText}>{showForm ? 'Fermer' : '＋ Ajouter un compte'}</Text></Pressable>{showForm ? <View style={styles.form}><TextInput value={name} onChangeText={setName} placeholder="Nom complet" style={styles.input} /><TextInput value={username} onChangeText={setUsername} placeholder="Identifiant (facultatif)" autoCapitalize="none" style={styles.input} /><TextInput value={title} onChangeText={setTitle} placeholder="Titre / statut" style={styles.input} /><TextInput value={password} onChangeText={setPassword} placeholder="Mot de passe (12 caractères minimum)" secureTextEntry style={styles.input} /><Pressable disabled={working || !name.trim() || password.length < 12} onPress={() => void createUser()} style={styles.addButton}><Text style={styles.addText}>{working ? 'En cours…' : 'Créer le compte moniteur'}</Text></Pressable></View> : null}{users.map(user => <View key={user.id} style={styles.user}><View style={styles.avatar}><Text style={styles.avatarText}>{(user.name || user.username).charAt(0).toUpperCase()}</Text></View><View style={styles.userCopy}><Text style={styles.userName}>{user.name || user.username}</Text><Text style={styles.meta}>@{user.username} · {user.title || user.role} · {user.role === 'ADMIN' ? 'Admin' : 'Moniteur'}</Text></View>{user.role === 'ADMIN' ? <Text style={styles.meta}>Protégé</Text> : <Pressable disabled={working || user.id === currentUserId} onPress={() => void toggleBlock(user)}><Text style={[styles.status, user.isBlocked && styles.blocked]}>{user.isBlocked ? 'Débloquer' : 'Bloquer'}</Text></Pressable>}</View>)}<Text style={styles.heading}>Activité récente ({logs.length})</Text></>}
      ListEmptyComponent={<Text style={styles.empty}>Aucune activité récente.</Text>}
      contentContainerStyle={styles.list}
      initialNumToRender={14}
      windowSize={7}
      removeClippedSubviews
    />}
  </SafeAreaView>;
});

const styles = StyleSheet.create({ root: { flex: 1, backgroundColor: '#111827' }, list: { padding: 16, paddingBottom: 28 }, loader: { marginTop: 35 }, error: { margin: 18, color: '#fca5a5' }, heading: { color: '#f9fafb', fontSize: 17, fontWeight: '800', marginTop: 8, marginBottom: 11 }, addButton: { minHeight: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 11, backgroundColor: '#00b22d', marginBottom: 10 }, addText: { color: '#fff', fontSize: 11, fontWeight: '800' }, form: { marginBottom: 14, padding: 12, borderRadius: 14, backgroundColor: '#1f2937' }, input: { height: 42, marginBottom: 8, paddingHorizontal: 11, borderWidth: 1, borderColor: '#374151', borderRadius: 10, backgroundColor: '#111827', color: '#f9fafb', fontSize: 12 }, user: { flexDirection: 'row', alignItems: 'center', padding: 12, marginBottom: 8, borderRadius: 16, borderWidth: 1, borderColor: '#374151', backgroundColor: '#1f2937' }, avatar: { width: 40, height: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#00b22d28' }, avatarText: { color: '#00b22d', fontSize: 16, fontWeight: '800' }, userCopy: { flex: 1, marginLeft: 10 }, userName: { color: '#f9fafb', fontSize: 13, fontWeight: '800' }, meta: { marginTop: 4, color: '#9ca3af', fontSize: 10 }, status: { color: '#4ade80', fontSize: 10, fontWeight: '800' }, blocked: { color: '#f87171' }, log: { padding: 12, marginBottom: 8, borderRadius: 14, borderWidth: 1, borderColor: '#374151', backgroundColor: '#1f2937' }, logTitle: { color: '#e5e7eb', fontSize: 11, fontWeight: '800', textTransform: 'capitalize' }, logBody: { marginTop: 5, color: '#d1d5db', fontSize: 11, lineHeight: 16 }, empty: { padding: 20, textAlign: 'center', color: '#9ca3af' } });
