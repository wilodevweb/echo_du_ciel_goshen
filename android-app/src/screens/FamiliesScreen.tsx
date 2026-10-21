import React, { memo, useMemo, useState } from 'react';
import { FlatList, Linking, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ScreenHeader } from './ScreenHeader';
import type { Child, Parent } from '../types';

export interface FamiliesScreenProps {
  parents: Parent[];
  childRecords: Child[];
  onBack: () => void;
}

interface FamilyGroup {
  key: string;
  name: string;
  phone: string | null;
  address: string | null;
  children: Child[];
}

export const FamiliesScreen = memo(function FamiliesScreen({ parents, childRecords: children, onBack }: FamiliesScreenProps) {
  const [query, setQuery] = useState('');
  const families = useMemo(() => {
    const parentsById = new Map(parents.map(parent => [parent.id, parent]));
    const parentsByPhone = new Map<string, Parent>();
    for (const parent of parents) {
      const phoneKey = normalizePhone(parent.phone);
      if (phoneKey && !parentsByPhone.has(phoneKey)) parentsByPhone.set(phoneKey, parent);
    }

    const groups = new Map<string, FamilyGroup>();
    const ensureGroup = (parent: Parent | undefined, child?: Child) => {
      const phone = cleanText(parent?.phone) || cleanText(child?.parentPhone) || null;
      const phoneKey = normalizePhone(phone);
      const name = meaningfulName(parent?.name) || meaningfulName(child?.parentName);
      const surname = cleanText(child?.lastName);
      const key = phoneKey
        ? 'phone:' + phoneKey
        : parent?.id
          ? 'parent:' + parent.id
          : name
            ? 'name:' + normalizeName(name)
            : surname
              ? 'surname:' + normalizeName(surname)
              : 'child:' + (child?.id ?? 'unknown');
      const familyName = name || (surname ? 'Famille ' + formatFamilyName(surname) : phone ? 'Famille (' + phone + ')' : 'Famille à compléter');
      const group = groups.get(key) ?? {
        key,
        name: familyName,
        phone,
        address: cleanText(parent?.address) || cleanText(child?.address) || null,
        children: [],
      };
      if (child) group.children.push(child);
      if (!group.phone && phone) group.phone = phone;
      if (!group.address) group.address = cleanText(parent?.address) || cleanText(child?.address) || null;
      if (group.name.startsWith('Famille ') && name) group.name = name;
      groups.set(key, group);
    };

    for (const parent of parents) {
      if (meaningfulName(parent.name) || cleanText(parent.phone)) ensureGroup(parent);
    }
    for (const child of children) {
      const normalizedPhone = normalizePhone(child.parentPhone);
      const parent = (child.parentId ? parentsById.get(child.parentId) : undefined)
        ?? (normalizedPhone ? parentsByPhone.get(normalizedPhone) : undefined);
      ensureGroup(parent, child);
    }

    for (const group of groups.values()) {
      group.children.sort((a, b) => formatChildName(a).localeCompare(formatChildName(b), 'fr', { sensitivity: 'base' }));
    }
    return Array.from(groups.values()).sort((a, b) => a.name.localeCompare(b.name, 'fr', { sensitivity: 'base' }));
  }, [children, parents]);
  const filteredFamilies = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase('fr');
    if (!normalizedQuery) return families;
    const normalizedPhoneQuery = normalizePhone(normalizedQuery);
    return families.filter(family => family.name.toLocaleLowerCase('fr').includes(normalizedQuery)
      || (normalizedPhoneQuery && normalizePhone(family.phone).includes(normalizedPhoneQuery))
      || family.children.some(child => formatChildName(child).toLocaleLowerCase('fr').includes(normalizedQuery)));
  }, [families, query]);
  return <SafeAreaView style={styles.root}>
    <ScreenHeader title="Familles" onBack={onBack} />
    <FlatList
      keyExtractor={family => family.key}
      renderItem={({ item }) => <FamilyCard family={item} />}
      ListHeaderComponent={<View style={styles.listHeader}><TextInput value={query} onChangeText={setQuery} placeholder="Rechercher une famille, un enfant ou un téléphone…" placeholderTextColor="#9ca3af" style={styles.search} /><Text style={styles.count}>{filteredFamilies.length} famille(s) · {filteredFamilies.reduce((total, family) => total + family.children.length, 0)} enfant(s)</Text></View>}
      ListEmptyComponent={<Text style={styles.empty}>Aucune famille enregistrée.</Text>}
      data={filteredFamilies}
      contentContainerStyle={styles.list}
      initialNumToRender={10}
      windowSize={7}
      removeClippedSubviews
    />
  </SafeAreaView>;
});


function cleanText(value?: string | null): string {
  return value?.trim().replace(/\s+/g, ' ') ?? '';
}

function meaningfulName(value?: string | null): string {
  const name = cleanText(value);
  const placeholder = ['parent', 'responsable', 'famille sans nom', 'sans nom'];
  return placeholder.includes(name.toLocaleLowerCase('fr-FR')) ? '' : name;
}

function normalizeName(value: string): string {
  return cleanText(value).toLocaleLowerCase('fr-FR');
}

function normalizePhone(value?: string | null): string {
  return value?.replace(/\D/g, '') ?? '';
}

function formatFamilyName(value: string): string {
  return value.toLocaleUpperCase('fr-FR');
}

function formatChildName(child: Child): string {
  const firstName = cleanText(child.firstName).toLocaleLowerCase('fr-FR');
  const formattedFirstName = firstName
    ? firstName.charAt(0).toLocaleUpperCase('fr-FR') + firstName.slice(1)
    : '';
  return [
    cleanText(child.lastName).toLocaleUpperCase('fr-FR'),
    cleanText(child.postName).toLocaleUpperCase('fr-FR'),
    formattedFirstName,
  ].filter(Boolean).join(' ');
}

const FamilyCard = memo(function FamilyCard({ family }: { family: FamilyGroup }) {
  return <View style={styles.card}>
    <View style={styles.cardHeader}><View style={styles.avatar}><Text style={styles.avatarText}>{family.name.charAt(0).toLocaleUpperCase('fr-FR')}</Text></View><View style={styles.copy}><Text style={styles.name}>{family.name}</Text>{family.phone ? <Pressable accessibilityRole="button" onPress={() => void Linking.openURL(`tel:${family.phone}`)}><Text style={styles.detail}>{family.phone}</Text></Pressable> : null}{family.address ? <Text style={styles.detail}>{family.address}</Text> : null}</View></View>
    <Text style={styles.childrenTitle}>Enfants ({family.children.length})</Text>
    {family.children.map(child => <Text key={child.id} style={styles.child}>{formatChildName(child)}</Text>)}
  </View>;
});

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f9fafb' }, list: { paddingHorizontal: 16, paddingBottom: 24 }, listHeader: { paddingTop: 5 }, search: { height: 44, marginBottom: 10, paddingHorizontal: 13, borderRadius: 12, borderWidth: 1, borderColor: '#e5e7eb', backgroundColor: '#fff', color: '#1f2937', fontSize: 12 }, count: { paddingBottom: 12, color: '#9ca3af', fontSize: 11 }, card: { marginBottom: 11, padding: 14, borderRadius: 15, borderWidth: 1, borderColor: '#f3f4f6', backgroundColor: '#fff' }, cardHeader: { flexDirection: 'row', alignItems: 'center' }, avatar: { width: 40, height: 40, borderRadius: 13, backgroundColor: '#00b22d18', alignItems: 'center', justifyContent: 'center' }, avatarText: { color: '#00b22d', fontSize: 15, fontWeight: '800' }, copy: { flex: 1, marginLeft: 10 }, name: { color: '#111827', fontSize: 14, fontWeight: '800' }, detail: { marginTop: 3, color: '#6b7280', fontSize: 11 }, childrenTitle: { marginTop: 13, marginBottom: 5, color: '#00a72b', fontSize: 11, fontWeight: '800' }, child: { paddingVertical: 3, color: '#374151', fontSize: 12 }, empty: { paddingVertical: 36, textAlign: 'center', color: '#6b7280', fontSize: 13 },
});
