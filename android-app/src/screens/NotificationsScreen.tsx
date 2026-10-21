import React, { memo, useMemo, useState } from 'react';
import { Alert, Linking, Pressable, SectionList, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Lucide, type LucideIconName } from '@react-native-vector-icons/lucide';
import { classLabel, countNotifiedChildren, expectedClassForBirthday, type NotificationItem, type NotificationSection } from '../notifications';
import type { Child, EditableChildField } from '../types';

type NotificationRow = { kind: 'notice'; key: string; notice: NotificationItem };
interface NotificationListSection {
  id: NotificationSection['id'];
  title: string;
  tone: NotificationSection['tone'];
  count: number;
  data: NotificationRow[];
}

export interface NotificationsScreenProps {
  sections: NotificationSection[];
  isAdmin: boolean;
  onBack: () => void;
  onUpdateChild: (child: Child, fields: EditableChildField[]) => Promise<void>;
}

export const NotificationsScreen = memo(function NotificationsScreen({ sections, isAdmin, onBack, onUpdateChild }: NotificationsScreenProps) {
  const [savingChildId, setSavingChildId] = useState<string | null>(null);
  const [readAll, setReadAll] = useState(false);
  const unreadCount = readAll ? 0 : countNotifiedChildren(sections);
  const listSections = useMemo<NotificationListSection[]>(() => sections.filter(section => section.children.length > 0).map(section => ({
      id: section.id,
      title: section.title,
      tone: section.tone,
      count: section.children.length,
      data: section.children.map((notice): NotificationRow => ({ kind: 'notice', key: `${section.id}:${notice.child.id}`, notice })),
    })), [sections]);

  const handleNotice = async (sectionId: string, child: Child) => {
    if (!isAdmin || savingChildId) return;
    const expected = sectionId === 'birthdays' ? expectedClassForBirthday(child.birthDate) : null;
    const fields: EditableChildField[] = [];
    let updated = child;

    if (expected === 'ARCHIVE' && !child.notes?.includes('[ARCHIVE]')) {
      const notes = (child.notes ?? '').replace(/\s*\[ARCHIVE\]/g, '').trim();
      updated = { ...child, notes: [notes, '[ARCHIVE]'].filter(Boolean).join(' ') };
      fields.push('notes');
    } else if (expected && expected !== 'ARCHIVE' && expected !== child.classLevel) {
      updated = { ...child, classLevel: expected };
      fields.push('classLevel');
    }
    if (!fields.length) return;

    setSavingChildId(child.id);
    try {
      await onUpdateChild(updated, fields);
    } catch (error) {
      Alert.alert('Modification impossible', error instanceof Error ? error.message : 'Réessayez lorsque la connexion sera disponible.');
    } finally {
      setSavingChildId(null);
    }
  };

  return <SafeAreaView style={styles.root} edges={['top', 'left', 'right']}>
    <SectionList<NotificationRow, NotificationListSection>
      sections={listSections}
      keyExtractor={item => item.key}
      contentContainerStyle={styles.list}
      stickySectionHeadersEnabled={false}
      ListHeaderComponent={<View style={styles.header}>
        <View style={styles.headerActions}>
          <RoundAction label="Retour à l’accueil" icon="arrow-left" onPress={onBack} />
          <RoundAction label="Tout marquer comme lu" icon="check-check" onPress={() => setReadAll(true)} />
        </View>
        <Text style={styles.brand}>ÉCHO DU CIEL · GOSHEN</Text>
        <Text style={styles.title}>Notifications</Text>
        <Text style={styles.unread}>{unreadCount} {unreadCount === 1 ? 'non lue' : 'non lues'}</Text>
      </View>}
      ListEmptyComponent={<Text style={styles.empty}>Aucune notification à afficher.</Text>}
      renderSectionHeader={({ section }) => <Text style={styles.heading}>{section.title.toLocaleUpperCase('fr-FR')}</Text>}
      renderItem={({ item, section }) => {
        const notice = item.notice;
        const child = notice.child;
        const expected = notice.expectedClass;
        const needsAction = section.id === 'birthdays' && expected !== null
          && (expected === 'ARCHIVE' ? !child.notes?.includes('[ARCHIVE]') : expected !== child.classLevel);
        const isSaving = savingChildId === child.id;
        return <View style={styles.noticeRow}>
          <View style={[styles.noticeIcon, styles[section.tone]]}><NoticeIcon section={section.id} /></View>
          <View style={styles.cardCopy}>
            <Text style={styles.name}>{notice.title}</Text>
            <Text style={styles.detail}>{notice.details}</Text>
            {needsAction ? <Text style={styles.suggestion}>{expected === 'ARCHIVE' ? 'Âge limite dépassé : archiver l’enfant.' : 'Passage conseillé en ' + classLabel(expected) + '.'}</Text> : null}
            {needsAction && isAdmin ? <Pressable disabled={Boolean(savingChildId)} onPress={() => void handleNotice(section.id, child)} style={[styles.action, Boolean(savingChildId) && styles.disabledAction]}><Text style={styles.actionText}>{isSaving ? 'Enregistrement…' : expected === 'ARCHIVE' ? 'Archiver' : 'Transférer en ' + classLabel(expected)}</Text></Pressable> : null}
          </View>
          <View style={styles.noticeTrailing}>
            {child.parentPhone ? <Pressable accessibilityRole="button" accessibilityLabel={'Appeler ' + (child.parentName || 'le parent')} onPress={() => void Linking.openURL('tel:' + child.parentPhone)} style={styles.call}><NoticeIcon section="phone" /></Pressable> : null}
            {!readAll ? <View style={styles.unreadDot} /> : null}
          </View>
        </View>;
      }}
      initialNumToRender={4}
      maxToRenderPerBatch={10}
      windowSize={5}
      removeClippedSubviews
    />
  </SafeAreaView>;
});

function NoticeIcon({ section }: { section: NotificationSection['id'] | 'phone' }) {
  const icons: Record<NotificationSection['id'] | 'phone', LucideIconName> = {
    birthdays: 'gift', absences: 'user-round-x', sick: 'heart-pulse', incomplete: 'user-round', phone: 'phone',
  };
  return <Lucide name={icons[section]} size={23} color={section === 'birthdays' ? '#f2cc65' : section === 'absences' ? '#94bafa' : section === 'sick' ? '#9cd9b1' : section === 'phone' ? '#a7b2aa' : '#c3ccc6'} />;
}

function RoundAction({ label, icon, onPress }: { label: string; icon: 'arrow-left' | 'check-check'; onPress: () => void }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={styles.roundAction}><Lucide name={icon} size={22} color="#e7ece8" /></Pressable>;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0d1410' },
  list: { paddingHorizontal: 20, paddingBottom: 32 },
  header: { alignItems: 'center', paddingTop: 38, paddingBottom: 26 },
  headerActions: { width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  roundAction: { width: 44, height: 44, borderRadius: 24, borderWidth: 1, borderColor: '#39463e', backgroundColor: '#19231d', alignItems: 'center', justifyContent: 'center' },
  brand: { color: '#8d9f93', fontSize: 11, fontWeight: '700', letterSpacing: 1.7 },
  title: { marginTop: 8, color: '#e9eeea', fontSize: 40, lineHeight: 49, fontWeight: '700' },
  unread: { marginTop: 4, color: '#a7b2aa', fontSize: 14 },
  heading: { marginTop: 18, marginBottom: 10, color: '#8d9f93', fontSize: 13, fontWeight: '700', letterSpacing: 1.1 },
  empty: { paddingVertical: 24, color: '#a7b2aa', fontSize: 14, textAlign: 'center' },
  noticeRow: { minHeight: 76, flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#26332b' },
  noticeIcon: { width: 48, height: 48, borderRadius: 25, alignItems: 'center', justifyContent: 'center', marginRight: 14, borderWidth: 1 },
  purple: { backgroundColor: '#332d16', borderColor: '#5b5030' },
  red: { backgroundColor: '#202e43', borderColor: '#3b4d66' },
  blue: { backgroundColor: '#1d3829', borderColor: '#3f5a49' },
  orange: { backgroundColor: '#222d27', borderColor: '#39463e' },
  cardCopy: { flex: 1, minWidth: 0 },
  name: { color: '#e7ece8', fontSize: 16, fontWeight: '700' },
  detail: { marginTop: 2, color: '#a7b2aa', fontSize: 13, lineHeight: 18 },
  suggestion: { marginTop: 8, color: '#f2cc65', fontSize: 12, fontWeight: '700' },
  action: { alignSelf: 'flex-start', marginTop: 7, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 18, backgroundColor: '#2e814b' },
  disabledAction: { opacity: 0.55 },
  actionText: { color: '#fff', fontSize: 11, fontWeight: '800' },
  noticeTrailing: { minWidth: 18, alignItems: 'center', justifyContent: 'center', marginLeft: 8, gap: 7 },
  unreadDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#2e814b' },
  call: { width: 30, height: 30, alignItems: 'center', justifyContent: 'center', borderRadius: 15, backgroundColor: '#222d27' },
});
