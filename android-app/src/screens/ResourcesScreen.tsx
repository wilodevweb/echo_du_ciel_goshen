import React, { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Image, Linking, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as DocumentPicker from 'expo-document-picker';
import { ScreenHeader } from './ScreenHeader';
import { getMobileResourceContent, getMobileResources, resolveResourceUrl, uploadMobileResource } from '../services/api';
import type { MediaResource, Session } from '../types';

type ResourceFilter = 'all' | MediaResource['type'];
const FILTERS: Array<{ id: ResourceFilter; label: string }> = [
  { id: 'all', label: 'Tout' },
  { id: 'image', label: 'Images' },
  { id: 'video', label: 'Vidéos' },
  { id: 'pdf', label: 'Documents' },
];

export interface ResourcesScreenProps {
  session: Session;
  isAdmin: boolean;
  onBack: () => void;
}

export const ResourcesScreen = memo(function ResourcesScreen({ session, isAdmin, onBack }: ResourcesScreenProps) {
  const [resources, setResources] = useState<MediaResource[]>([]);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<ResourceFilter>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);
  const [openingResourceId, setOpeningResourceId] = useState<string | null>(null);
  const [uploadTitle, setUploadTitle] = useState('');
  const [aspectRatio, setAspectRatio] = useState<'square' | 'wide' | 'tall'>('square');

  useEffect(() => {
    let active = true;
    void getMobileResources(session)
      .then(result => { if (active) setResources(result); })
      .catch(cause => { if (active) setError(cause instanceof Error ? cause.message : 'Ressources indisponibles.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [session]);

  const visibleResources = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase('fr');
    return resources.filter(resource => (filter === 'all' || resource.type === filter)
      && (!normalizedQuery || resource.title.toLocaleLowerCase('fr').includes(normalizedQuery)));
  }, [filter, query, resources]);
  const openResource = useCallback(async (resource: MediaResource) => {
    if (openingResourceId) return;
    setOpeningResourceId(resource.id);
    try {
      const resourceUrl = resource.url.startsWith('/api/mobile/resources?id=')
        ? await getMobileResourceContent(session, resource.id)
        : resolveResourceUrl(resource.url);
      await Linking.openURL(resourceUrl);
    } catch {
      Alert.alert('Ouverture impossible', 'Cette ressource ne peut pas être ouverte sur cet appareil.');
    } finally {
      setOpeningResourceId(null);
    }
  }, [openingResourceId, session]);
  const pickAndUpload = useCallback(async () => {
    try {
      const selection = await DocumentPicker.getDocumentAsync({ type: ['image/*', 'video/*', 'application/pdf'], copyToCacheDirectory: true });
      if (selection.canceled) return;
      const file = selection.assets[0];
      if (!file) return;
      const mimeType = file.mimeType ?? '';
      const type: MediaResource['type'] = mimeType.startsWith('video/') ? 'video' : mimeType === 'application/pdf' ? 'pdf' : 'image';
      setUploading(true);
      setError('');
      await uploadMobileResource(session, { uri: file.uri, fileName: file.name, mimeType, title: uploadTitle.trim() || file.name.replace(/\.[^.]+$/, ''), type, aspectRatio });
      setResources(await getMobileResources(session));
      setUploadTitle('');
      Alert.alert('Fichier ajouté', 'La ressource est maintenant disponible dans les archives.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Téléversement impossible.');
    } finally {
      setUploading(false);
    }
  }, [aspectRatio, session, uploadTitle]);

  return <SafeAreaView style={styles.root}>
    <ScreenHeader title="Archives" onBack={onBack} />
    <FlatList
      data={visibleResources}
      keyExtractor={resource => resource.id}
      renderItem={({ item }) => <ResourceRow resource={item} opening={openingResourceId === item.id} onPress={openResource} />}
      ListHeaderComponent={<View style={styles.filters}>
        <TextInput value={query} onChangeText={setQuery} placeholder="Rechercher une ressource" placeholderTextColor="#929b94" style={styles.search} returnKeyType="search" />
        {isAdmin ? <View style={styles.uploadBox}><TextInput value={uploadTitle} onChangeText={setUploadTitle} placeholder="Titre du fichier (facultatif)" placeholderTextColor="#9ca3af" style={styles.search} /><View style={styles.filterRow}>{([{ id: 'square', label: 'Carré' }, { id: 'wide', label: 'Large' }, { id: 'tall', label: 'Portrait' }] as const).map(option => <Pressable key={option.id} onPress={() => setAspectRatio(option.id)} style={[styles.filter, aspectRatio === option.id && styles.activeFilter]}><Text style={[styles.filterText, aspectRatio === option.id && styles.activeFilterText]}>{option.label}</Text></Pressable>)}</View><Pressable disabled={uploading} onPress={() => void pickAndUpload()} style={styles.uploadButton}><Text style={styles.uploadText}>{uploading ? 'Téléversement…' : '＋ Ajouter un fichier'}</Text></Pressable></View> : null}
        <View style={styles.filterRow}>{FILTERS.map(option => <Pressable key={option.id} onPress={() => setFilter(option.id)} style={[styles.filter, filter === option.id && styles.activeFilter]}><Text style={[styles.filterText, filter === option.id && styles.activeFilterText]}>{option.label}</Text></Pressable>)}</View>
        {loading ? <ActivityIndicator style={styles.loader} color="#087b2c" /> : null}
        {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
        {!loading && !error ? <Text style={styles.count}>{visibleResources.length} ressource(s)</Text> : null}
      </View>}
      ListEmptyComponent={!loading ? <Text style={styles.empty}>Aucune ressource à afficher.</Text> : null}
      contentContainerStyle={styles.list}
      initialNumToRender={8}
      maxToRenderPerBatch={8}
      windowSize={7}
      removeClippedSubviews
    />
  </SafeAreaView>;
});

const ResourceRow = memo(function ResourceRow({ resource, opening, onPress }: { resource: MediaResource; opening: boolean; onPress: (resource: MediaResource) => void }) {
  const previewUrl = resource.thumbnail || (/^(https?:\/\/|\/)/i.test(resource.url) && !resource.url.startsWith('/api/mobile/resources?') ? resource.url : null);
  return <Pressable accessibilityRole="button" onPress={() => onPress(resource)} style={styles.row}>
    {resource.type === 'image' && previewUrl ? <Image alt={resource.title} source={{ uri: resolveResourceUrl(previewUrl) }} style={styles.thumbnail} /> : <View style={[styles.thumbnail, styles.fileBadge]}><Text style={styles.fileBadgeText}>{resource.type === 'video' ? '▶' : resource.type === 'pdf' ? 'PDF' : 'IMG'}</Text></View>}
    <View style={styles.copy}><Text numberOfLines={2} style={styles.title}>{resource.title}</Text><Text style={styles.detail}>{resource.type === 'pdf' ? 'Document' : resource.type === 'video' ? 'Vidéo' : 'Image'}</Text></View>
    {opening ? <ActivityIndicator color="#087b2c" /> : <Text style={styles.open}>›</Text>}
  </Pressable>;
});

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f9fafb' }, list: { paddingHorizontal: 16, paddingBottom: 24 }, filters: { paddingTop: 5, paddingBottom: 13 }, search: { height: 46, borderRadius: 12, borderWidth: 1, borderColor: '#e5e7eb', backgroundColor: '#fff', paddingHorizontal: 13, color: '#1f2937' }, uploadBox: { marginTop: 9, gap: 7 }, uploadButton: { height: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 11, backgroundColor: '#00b22d' }, uploadText: { color: '#fff', fontSize: 11, fontWeight: '800' }, filterRow: { flexDirection: 'row', gap: 7, marginTop: 12 }, filter: { flex: 1, paddingVertical: 9, borderRadius: 10, alignItems: 'center', backgroundColor: '#f3f4f6' }, activeFilter: { backgroundColor: '#00b22d' }, filterText: { color: '#6b7280', fontSize: 10, fontWeight: '700' }, activeFilterText: { color: '#fff' }, loader: { marginTop: 15 }, error: { marginTop: 12, color: '#b42318', fontSize: 11 }, count: { marginTop: 11, color: '#9ca3af', fontSize: 11 }, row: { flexDirection: 'row', alignItems: 'center', padding: 10, marginBottom: 9, borderRadius: 14, borderWidth: 1, borderColor: '#f3f4f6', backgroundColor: '#fff' }, thumbnail: { width: 54, height: 54, borderRadius: 12, backgroundColor: '#e5e7eb' }, fileBadge: { alignItems: 'center', justifyContent: 'center', backgroundColor: '#f3f4f6' }, fileBadgeText: { color: '#00b22d', fontSize: 12, fontWeight: '900' }, copy: { flex: 1, marginHorizontal: 11 }, title: { color: '#111827', fontSize: 12, fontWeight: '800' }, detail: { marginTop: 4, color: '#6b7280', fontSize: 10 }, open: { color: '#9ca3af', fontSize: 24 }, empty: { paddingVertical: 36, textAlign: 'center', color: '#6b7280', fontSize: 13 },
});
