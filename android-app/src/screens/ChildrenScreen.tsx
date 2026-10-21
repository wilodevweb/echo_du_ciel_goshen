import React, { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Image, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as DocumentPicker from 'expo-document-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { persistPhotoUri } from '../services/photoStorage';
import { ScreenHeader } from './ScreenHeader';
import type { Child, ClassLevel, EditableChildField } from '../types';

const CLASSES: Array<{ id: ClassLevel | 'ALL'; label: string }> = [
  { id: 'ALL', label: 'Toutes' },
  { id: 'FIRST', label: '1ère' },
  { id: 'SECOND', label: '2e' },
  { id: 'THIRD', label: '3e' },
];
const EDITABLE_CHILD_FIELDS: EditableChildField[] = ['firstName', 'lastName', 'postName', 'gender', 'classLevel', 'parentPhone', 'parentName', 'parentId', 'address', 'birthDate', 'notes', 'photoUrl'];

export interface ChildrenScreenProps {
  childRecords: Child[];
  initialCreate?: boolean;
  initialChildId?: string;
  onInitialTargetHandled?: () => void;
  onBack: () => void;
  onSaveChild: (child: Child, fields: EditableChildField[]) => Promise<void>;
}

export const ChildrenScreen = memo(function ChildrenScreen({ childRecords: children, initialCreate = false, initialChildId, onInitialTargetHandled, onBack, onSaveChild }: ChildrenScreenProps) {
  const [query, setQuery] = useState('');
  const [activeClass, setActiveClass] = useState<ClassLevel | 'ALL'>('ALL');
  const [showArchived, setShowArchived] = useState(false);
  const [draft, setDraft] = useState<Child | null>(null);
  const [saving, setSaving] = useState(false);
  const [processingPhoto, setProcessingPhoto] = useState(false);
  const searchableChildren = useMemo(() => children.map(child => ({
    child,
    sortName: `${child.lastName} ${child.firstName}`,
    normalizedSearch: `${child.firstName} ${child.lastName} ${child.postName} ${child.parentPhone}`.toLocaleLowerCase('fr'),
    hasName: Boolean(child.firstName.trim() || child.lastName.trim() || child.postName.trim()),
    archived: Boolean(child.notes?.includes('[ARCHIVE]')),
  })).sort((a, b) => a.sortName.localeCompare(b.sortName, 'fr')), [children]);
  const visibleChildren = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase('fr');
    return searchableChildren.filter(({ archived, hasName, normalizedSearch, child }) => {
      if (!hasName) return false;
      if (archived !== showArchived) return false;
      if (activeClass !== 'ALL' && child.classLevel !== activeClass) return false;
      if (!normalizedQuery) return true;
      return normalizedSearch.includes(normalizedQuery);
    }).map(({ child }) => child);
  }, [activeClass, searchableChildren, query, showArchived]);
  const openDetails = useCallback((child: Child) => setDraft(child), []);
  const renderChild = useCallback(({ item }: { item: Child }) => <ChildRow child={item} onPress={openDetails} />, [openDetails]);
  const openNew = useCallback(() => setDraft({ id: `mobile-${Date.now()}`, firstName: '', lastName: '', postName: '', gender: 'M', classLevel: 'FIRST', parentPhone: '', parentName: '', address: '', birthDate: '', notes: '' }), []);
  useEffect(() => {
    if (initialCreate) openNew();
    else if (initialChildId) {
      const child = children.find(item => item.id === initialChildId);
      if (child) setDraft(child);
    }
    if (initialCreate || initialChildId) onInitialTargetHandled?.();
  }, [children, initialChildId, initialCreate, onInitialTargetHandled, openNew]);
  const saveDraft = useCallback(async () => {
    if (!draft?.firstName.trim() || !draft.lastName.trim()) return;
    if (draft.birthDate && !/^\d{4}-\d{2}-\d{2}$/.test(draft.birthDate)) {
      Alert.alert('Date incorrecte', 'Saisissez la date au format AAAA-MM-JJ.');
      return;
    }
    if (draft.birthDate && draft.birthDate > localDate(new Date())) {
      Alert.alert('Date incorrecte', 'La date de naissance ne peut pas être dans le futur.');
      return;
    }
    setSaving(true);
    try {
      const child: Child = { ...draft, firstName: draft.firstName.trim(), lastName: draft.lastName.trim(), postName: draft.postName.trim(), parentName: draft.parentName?.trim() || null, parentPhone: draft.parentPhone.trim(), address: draft.address.trim(), notes: draft.notes?.trim() || null };
      const original = children.find(item => item.id === child.id);
      const changedFields = original
        ? EDITABLE_CHILD_FIELDS.filter(field => (original[field] ?? null) !== (child[field] ?? null))
        : EDITABLE_CHILD_FIELDS;
      if (changedFields.length) await onSaveChild(child, changedFields);
      setDraft(null);
    } finally { setSaving(false); }
  }, [children, draft, onSaveChild]);
  const choosePhoto = useCallback(async () => {
    try {
      const selection = await DocumentPicker.getDocumentAsync({ type: 'image/*', copyToCacheDirectory: true });
      if (selection.canceled || !selection.assets[0] || !draft) return;
      setProcessingPhoto(true);
      const sourceSize = await new Promise<{ width: number; height: number }>((resolve, reject) => Image.getSize(selection.assets[0].uri, (width, height) => resolve({ width, height }), reject));
      const scale = Math.min(1, 360 / Math.max(sourceSize.width, sourceSize.height));
      const context = ImageManipulator.manipulate(selection.assets[0].uri);
      context.resize({ width: Math.round(sourceSize.width * scale) });
      const image = await context.renderAsync();
      const result = await image.saveAsync({ format: SaveFormat.JPEG, compress: 0.7, base64: false });
      context.release();
      image.release();
      if (!result.uri) throw new Error('La compression de la photo a échoué.');
      const photoUrl = await persistPhotoUri(result.uri, draft.id);
      setDraft(current => current ? { ...current, photoUrl } : current);
    } catch (cause) {
      Alert.alert('Photo non ajoutée', cause instanceof Error ? cause.message : 'Impossible de traiter cette image.');
    } finally { setProcessingPhoto(false); }
  }, [draft]);

  return <SafeAreaView style={styles.root}>
    <ScreenHeader title={showArchived ? 'Archives' : 'Annuaire'} onBack={onBack} />
    <FlatList
      data={visibleChildren}
      keyExtractor={child => child.id}
      renderItem={renderChild}
      ListHeaderComponent={<View style={styles.filters}>
        <TextInput value={query} onChangeText={setQuery} placeholder="Rechercher un enfant ou parent" placeholderTextColor="#929b94" style={styles.search} returnKeyType="search" />
        <View style={styles.filterRow}>{CLASSES.map(level => <Pressable key={level.id} onPress={() => setActiveClass(level.id)} style={[styles.filter, activeClass === level.id && styles.activeFilter]}><Text style={[styles.filterText, activeClass === level.id && styles.activeFilterText]}>{level.label}</Text></Pressable>)}</View>
        <Pressable accessibilityRole="button" onPress={() => setShowArchived(value => !value)} style={styles.archiveToggle}><Text style={styles.archiveText}>{showArchived ? 'Afficher les enfants actifs' : 'Afficher les enfants archivés'}</Text></Pressable>
        <Pressable accessibilityRole="button" onPress={openNew} style={styles.addButton}><Text style={styles.addButtonText}>＋ Ajouter un enfant</Text></Pressable>
        <Text style={styles.count}>{visibleChildren.length} {showArchived ? 'enfant(s) archivé(s)' : 'enfant(s)'}</Text>
      </View>}
      ListEmptyComponent={<Text style={styles.empty}>Aucun enfant à afficher.</Text>}
      contentContainerStyle={styles.list}
      initialNumToRender={14}
      maxToRenderPerBatch={14}
      windowSize={7}
      removeClippedSubviews
    />
    <Modal visible={Boolean(draft)} animationType="slide" onRequestClose={() => setDraft(null)}>
      {draft ? <SafeAreaView style={styles.modalRoot}><View style={styles.modalHeader}><Pressable onPress={() => setDraft(null)}><Text style={styles.cancel}>Annuler</Text></Pressable><Text style={styles.modalTitle}>{children.some(child => child.id === draft.id) ? 'Modifier la fiche' : 'Nouvel enfant'}</Text><Pressable disabled={saving || !draft.firstName.trim() || !draft.lastName.trim()} onPress={() => void saveDraft()}><Text style={[styles.save, (saving || !draft.firstName.trim() || !draft.lastName.trim()) && styles.disabledSave]}>{saving ? '…' : 'Enregistrer'}</Text></Pressable></View>
        <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
          <Pressable onPress={() => void choosePhoto()} style={{ minHeight: 62, marginBottom: 8, padding: 9, flexDirection: 'row', alignItems: 'center', gap: 11, borderRadius: 12, borderWidth: 1, borderColor: '#e5e7eb', backgroundColor: '#fff' }}>{draft.photoUrl ? <Image alt="Photo de l’enfant" source={{ uri: draft.photoUrl }} style={{ width: 48, height: 48, borderRadius: 14, backgroundColor: '#f3f4f6' }} /> : <View style={{ width: 48, height: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 14, backgroundColor: '#00b22d18' }}><Text style={{ color: '#00b22d', fontSize: 22, fontWeight: '800' }}>＋</Text></View>}<Text style={{ flex: 1, color: '#00a72b', fontSize: 11, fontWeight: '800' }}>{processingPhoto ? 'Compression…' : 'Ajouter ou changer la photo'}</Text>{processingPhoto ? <ActivityIndicator color="#00b22d" /> : null}</Pressable>
          <Text style={styles.fieldLabel}>Prénom *</Text><TextInput value={draft.firstName} onChangeText={firstName => setDraft(current => current ? { ...current, firstName } : current)} style={styles.input} placeholder="Prénom" />
          <Text style={styles.fieldLabel}>Nom *</Text><TextInput value={draft.lastName} onChangeText={lastName => setDraft(current => current ? { ...current, lastName } : current)} style={styles.input} placeholder="Nom" />
          <Text style={styles.fieldLabel}>Postnom</Text><TextInput value={draft.postName} onChangeText={postName => setDraft(current => current ? { ...current, postName } : current)} style={styles.input} placeholder="Postnom" />
          <Text style={styles.fieldLabel}>Classe</Text><View style={styles.choiceRow}>{CLASSES.filter(level => level.id !== 'ALL').map(level => <Pressable key={level.id} onPress={() => setDraft(current => current ? { ...current, classLevel: level.id as ClassLevel } : current)} style={[styles.choice, draft.classLevel === level.id && styles.activeChoice]}><Text style={[styles.choiceText, draft.classLevel === level.id && styles.activeChoiceText]}>{level.label}</Text></Pressable>)}</View>
          <Text style={styles.fieldLabel}>Genre</Text><View style={styles.choiceRow}>{(['M', 'F'] as const).map(gender => <Pressable key={gender} onPress={() => setDraft(current => current ? { ...current, gender } : current)} style={[styles.choice, draft.gender === gender && styles.activeChoice]}><Text style={[styles.choiceText, draft.gender === gender && styles.activeChoiceText]}>{gender === 'M' ? 'Garçon' : 'Fille'}</Text></Pressable>)}</View>
          <Text style={styles.fieldLabel}>Parent / responsable</Text><TextInput value={draft.parentName ?? ''} onChangeText={parentName => setDraft(current => current ? { ...current, parentName } : current)} style={styles.input} placeholder="Nom du parent" />
          <TextInput value={draft.parentPhone} onChangeText={parentPhone => setDraft(current => current ? { ...current, parentPhone } : current)} style={[styles.input, styles.spaced]} placeholder="Téléphone" keyboardType="phone-pad" />
          <Text style={styles.fieldLabel}>Adresse</Text><TextInput value={draft.address} onChangeText={address => setDraft(current => current ? { ...current, address } : current)} style={styles.input} placeholder="Adresse" />
          <Text style={styles.fieldLabel}>Date de naissance</Text><TextInput value={draft.birthDate ?? ''} onChangeText={birthDate => setDraft(current => current ? { ...current, birthDate } : current)} style={styles.input} placeholder="AAAA-MM-JJ" />
          <Text style={styles.fieldLabel}>Notes</Text><TextInput multiline value={draft.notes ?? ''} onChangeText={notes => setDraft(current => current ? { ...current, notes } : current)} style={[styles.input, styles.notes]} placeholder="Notes" />
          {children.some(child => child.id === draft.id) ? <Pressable onPress={() => setDraft(current => current ? { ...current, notes: current.notes?.includes('[ARCHIVE]') ? current.notes.replace('[ARCHIVE]', '').trim() : `${current.notes ?? ''} [ARCHIVE]`.trim() } : current)} style={styles.archiveAction}><Text style={styles.archiveText}>{draft.notes?.includes('[ARCHIVE]') ? 'Restaurer de l’archive' : 'Archiver cet enfant'}</Text></Pressable> : null}
        </ScrollView>
      </SafeAreaView> : null}
    </Modal>
  </SafeAreaView>;
});

const ChildRow = memo(function ChildRow({ child, onPress }: { child: Child; onPress: (child: Child) => void }) {
  const [photoFailed, setPhotoFailed] = useState(false);
  useEffect(() => setPhotoFailed(false), [child.photoUrl]);
  const fullName = [
    child.lastName.trim().toLocaleUpperCase('fr-FR'),
    child.postName.trim().toLocaleUpperCase('fr-FR'),
    formatFirstName(child.firstName),
  ].filter(Boolean).join(' ');
  const photoUri = child.photoUrl?.trim();

  return <Pressable accessibilityRole="button" accessibilityLabel={'Ouvrir la fiche de ' + fullName} onPress={() => onPress(child)} style={styles.row}>
    <View style={styles.avatar}>
      {photoUri && !photoFailed
        ? <Image alt={`Photo de ${fullName}`} source={{ uri: photoUri }} style={styles.avatarPhoto} resizeMode="cover" onError={() => setPhotoFailed(true)} />
        : <Text style={styles.avatarText}>{child.firstName.trim().charAt(0).toLocaleUpperCase('fr-FR')}</Text>}
    </View>
    <View style={styles.rowCopy}><Text numberOfLines={1} style={styles.name}>{fullName}</Text><Text style={styles.classText}>{classLabel(child.classLevel)}</Text>{child.parentPhone ? <Text style={styles.phone}>{child.parentPhone}</Text> : null}</View>
    <Text style={styles.chevron}>›</Text>
  </Pressable>;
});

function formatFirstName(value: string): string {
  const normalized = value.trim().toLocaleLowerCase('fr-FR');
  if (!normalized) return '';
  return normalized.charAt(0).toLocaleUpperCase('fr-FR') + normalized.slice(1);
}

function classLabel(level: ClassLevel): string {
  return level === 'FIRST' ? '1ère classe' : level === 'SECOND' ? '2e classe' : '3e classe';
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f9fafb' }, list: { paddingHorizontal: 16, paddingBottom: 24 }, filters: { paddingTop: 5, paddingBottom: 14 }, search: { height: 46, borderRadius: 12, borderWidth: 1, borderColor: '#e5e7eb', backgroundColor: '#fff', paddingHorizontal: 13, color: '#1f2937' }, filterRow: { flexDirection: 'row', gap: 7, marginTop: 12 }, filter: { flex: 1, paddingVertical: 9, borderRadius: 10, alignItems: 'center', backgroundColor: '#f3f4f6' }, activeFilter: { backgroundColor: '#00b22d' }, filterText: { color: '#6b7280', fontSize: 11, fontWeight: '700' }, activeFilterText: { color: '#fff' }, archiveToggle: { alignSelf: 'flex-start', marginTop: 11, paddingVertical: 4 }, archiveText: { color: '#00a72b', fontSize: 12, fontWeight: '700' }, addButton: { marginTop: 9, paddingVertical: 11, alignItems: 'center', borderRadius: 11, backgroundColor: '#00b22d' }, addButtonText: { color: '#fff', fontSize: 12, fontWeight: '800' }, count: { marginTop: 8, color: '#9ca3af', fontSize: 11 }, row: { flexDirection: 'row', alignItems: 'center', padding: 12, marginBottom: 9, borderRadius: 14, borderWidth: 1, borderColor: '#f3f4f6', backgroundColor: '#fff' }, avatar: { width: 48, height: 48, borderRadius: 24, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', backgroundColor: '#00b22d18' }, avatarPhoto: { width: '100%', height: '100%', borderRadius: 24 }, avatarText: { color: '#00b22d', fontSize: 16, fontWeight: '800' }, rowCopy: { flex: 1, marginLeft: 11 }, name: { color: '#111827', fontSize: 13, fontWeight: '800' }, classText: { marginTop: 3, color: '#00a72b', fontSize: 10, fontWeight: '700' }, phone: { marginTop: 3, color: '#6b7280', fontSize: 11 }, chevron: { marginLeft: 8, color: '#9ca3af', fontSize: 24 }, empty: { paddingVertical: 36, textAlign: 'center', color: '#6b7280', fontSize: 13 }, modalRoot: { flex: 1, backgroundColor: '#f9fafb' }, modalHeader: { height: 54, paddingHorizontal: 17, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderColor: '#f3f4f6', backgroundColor: '#fff' }, modalTitle: { color: '#111827', fontSize: 15, fontWeight: '800' }, cancel: { color: '#6b7280', fontSize: 12, fontWeight: '700' }, save: { color: '#00a72b', fontSize: 12, fontWeight: '800' }, disabledSave: { color: '#9ca3af' }, form: { padding: 17, paddingBottom: 40 }, fieldLabel: { marginTop: 14, marginBottom: 6, color: '#374151', fontSize: 11, fontWeight: '800' }, input: { minHeight: 44, paddingHorizontal: 12, borderRadius: 11, borderWidth: 1, borderColor: '#e5e7eb', backgroundColor: '#fff', color: '#1f2937', fontSize: 13 }, spaced: { marginTop: 8 }, notes: { minHeight: 90, textAlignVertical: 'top', paddingTop: 11 }, choiceRow: { flexDirection: 'row', gap: 8 }, choice: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 10, backgroundColor: '#f3f4f6' }, activeChoice: { backgroundColor: '#00b22d' }, choiceText: { color: '#6b7280', fontSize: 11, fontWeight: '700' }, activeChoiceText: { color: '#fff' }, archiveAction: { marginTop: 18, padding: 13, alignItems: 'center', borderRadius: 11, borderWidth: 1, borderColor: '#00b22d55', backgroundColor: '#00b22d0c' },
});

function localDate(value: Date): string {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
}
